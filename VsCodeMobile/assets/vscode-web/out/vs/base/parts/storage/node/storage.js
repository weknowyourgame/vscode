/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import { timeout } from '../../../common/async.js';
import { Event } from '../../../common/event.js';
import { mapToString, setToString } from '../../../common/map.js';
import { basename } from '../../../common/path.js';
import { Promises } from '../../../node/pfs.js';
export class SQLiteStorageDatabase {
    static { this.IN_MEMORY_PATH = ':memory:'; }
    get onDidChangeItemsExternal() { return Event.None; } // since we are the only client, there can be no external changes
    static { this.BUSY_OPEN_TIMEOUT = 2000; } // timeout in ms to retry when opening DB fails with SQLITE_BUSY
    static { this.MAX_HOST_PARAMETERS = 256; } // maximum number of parameters within a statement
    constructor(path, options = Object.create(null)) {
        this.path = path;
        this.name = basename(this.path);
        this.logger = new SQLiteStorageDatabaseLogger(options.logging);
        this.whenConnected = this.connect(this.path);
    }
    async getItems() {
        const connection = await this.whenConnected;
        const items = new Map();
        const rows = await this.all(connection, 'SELECT * FROM ItemTable');
        rows.forEach(row => items.set(row.key, row.value));
        if (this.logger.isTracing) {
            this.logger.trace(`[storage ${this.name}] getItems(): ${items.size} rows`);
        }
        return items;
    }
    async updateItems(request) {
        const connection = await this.whenConnected;
        return this.doUpdateItems(connection, request);
    }
    doUpdateItems(connection, request) {
        if (this.logger.isTracing) {
            this.logger.trace(`[storage ${this.name}] updateItems(): insert(${request.insert ? mapToString(request.insert) : '0'}), delete(${request.delete ? setToString(request.delete) : '0'})`);
        }
        return this.transaction(connection, () => {
            const toInsert = request.insert;
            const toDelete = request.delete;
            // INSERT
            if (toInsert && toInsert.size > 0) {
                const keysValuesChunks = [];
                keysValuesChunks.push([]); // seed with initial empty chunk
                // Split key/values into chunks of SQLiteStorageDatabase.MAX_HOST_PARAMETERS
                // so that we can efficiently run the INSERT with as many HOST parameters as possible
                let currentChunkIndex = 0;
                toInsert.forEach((value, key) => {
                    let keyValueChunk = keysValuesChunks[currentChunkIndex];
                    if (keyValueChunk.length > SQLiteStorageDatabase.MAX_HOST_PARAMETERS) {
                        currentChunkIndex++;
                        keyValueChunk = [];
                        keysValuesChunks.push(keyValueChunk);
                    }
                    keyValueChunk.push(key, value);
                });
                keysValuesChunks.forEach(keysValuesChunk => {
                    this.prepare(connection, `INSERT INTO ItemTable VALUES ${new Array(keysValuesChunk.length / 2).fill('(?,?)').join(',')} ON CONFLICT (key) DO UPDATE SET value = excluded.value WHERE value != excluded.value`, stmt => stmt.run(keysValuesChunk), () => {
                        const keys = [];
                        let length = 0;
                        toInsert.forEach((value, key) => {
                            keys.push(key);
                            length += value.length;
                        });
                        return `Keys: ${keys.join(', ')} Length: ${length}`;
                    });
                });
            }
            // DELETE
            if (toDelete?.size) {
                const keysChunks = [];
                keysChunks.push([]); // seed with initial empty chunk
                // Split keys into chunks of SQLiteStorageDatabase.MAX_HOST_PARAMETERS
                // so that we can efficiently run the DELETE with as many HOST parameters
                // as possible
                let currentChunkIndex = 0;
                toDelete.forEach(key => {
                    let keyChunk = keysChunks[currentChunkIndex];
                    if (keyChunk.length > SQLiteStorageDatabase.MAX_HOST_PARAMETERS) {
                        currentChunkIndex++;
                        keyChunk = [];
                        keysChunks.push(keyChunk);
                    }
                    keyChunk.push(key);
                });
                keysChunks.forEach(keysChunk => {
                    this.prepare(connection, `DELETE FROM ItemTable WHERE key IN (${new Array(keysChunk.length).fill('?').join(',')})`, stmt => stmt.run(keysChunk), () => {
                        const keys = [];
                        toDelete.forEach(key => {
                            keys.push(key);
                        });
                        return `Keys: ${keys.join(', ')}`;
                    });
                });
            }
        });
    }
    async optimize() {
        this.logger.trace(`[storage ${this.name}] vacuum()`);
        const connection = await this.whenConnected;
        return this.exec(connection, 'VACUUM');
    }
    async close(recovery) {
        this.logger.trace(`[storage ${this.name}] close()`);
        const connection = await this.whenConnected;
        return this.doClose(connection, recovery);
    }
    doClose(connection, recovery) {
        return new Promise((resolve, reject) => {
            connection.db.close(closeError => {
                if (closeError) {
                    this.handleSQLiteError(connection, `[storage ${this.name}] close(): ${closeError}`);
                }
                // Return early if this storage was created only in-memory
                // e.g. when running tests we do not need to backup.
                if (this.path === SQLiteStorageDatabase.IN_MEMORY_PATH) {
                    return resolve();
                }
                // If the DB closed successfully and we are not running in-memory
                // and the DB did not get errors during runtime, make a backup
                // of the DB so that we can use it as fallback in case the actual
                // DB becomes corrupt in the future.
                if (!connection.isErroneous && !connection.isInMemory) {
                    return this.backup().then(resolve, error => {
                        this.logger.error(`[storage ${this.name}] backup(): ${error}`);
                        return resolve(); // ignore failing backup
                    });
                }
                // Recovery: if we detected errors while using the DB or we are using
                // an inmemory DB (as a fallback to not being able to open the DB initially)
                // and we have a recovery function provided, we recreate the DB with this
                // data to recover all known data without loss if possible.
                if (typeof recovery === 'function') {
                    // Delete the existing DB. If the path does not exist or fails to
                    // be deleted, we do not try to recover anymore because we assume
                    // that the path is no longer writeable for us.
                    return fs.promises.unlink(this.path).then(() => {
                        // Re-open the DB fresh
                        return this.doConnect(this.path).then(recoveryConnection => {
                            const closeRecoveryConnection = () => {
                                return this.doClose(recoveryConnection, undefined /* do not attempt to recover again */);
                            };
                            // Store items
                            return this.doUpdateItems(recoveryConnection, { insert: recovery() }).then(() => closeRecoveryConnection(), error => {
                                // In case of an error updating items, still ensure to close the connection
                                // to prevent SQLITE_BUSY errors when the connection is reestablished
                                closeRecoveryConnection();
                                return Promise.reject(error);
                            });
                        });
                    }).then(resolve, reject);
                }
                // Finally without recovery we just reject
                return reject(closeError || new Error('Database has errors or is in-memory without recovery option'));
            });
        });
    }
    backup() {
        const backupPath = this.toBackupPath(this.path);
        return Promises.copy(this.path, backupPath, { preserveSymlinks: false });
    }
    toBackupPath(path) {
        return `${path}.backup`;
    }
    async checkIntegrity(full) {
        this.logger.trace(`[storage ${this.name}] checkIntegrity(full: ${full})`);
        const connection = await this.whenConnected;
        const row = await this.get(connection, full ? 'PRAGMA integrity_check' : 'PRAGMA quick_check');
        const integrity = full ? row.integrity_check : row.quick_check;
        if (connection.isErroneous) {
            return `${integrity} (last error: ${connection.lastError})`;
        }
        if (connection.isInMemory) {
            return `${integrity} (in-memory!)`;
        }
        return integrity;
    }
    async connect(path, retryOnBusy = true) {
        this.logger.trace(`[storage ${this.name}] open(${path}, retryOnBusy: ${retryOnBusy})`);
        try {
            return await this.doConnect(path);
        }
        catch (error) {
            this.logger.error(`[storage ${this.name}] open(): Unable to open DB due to ${error}`);
            // SQLITE_BUSY should only arise if another process is locking the same DB we want
            // to open at that time. This typically never happens because a DB connection is
            // limited per window. However, in the event of a window reload, it may be possible
            // that the previous connection was not properly closed while the new connection is
            // already established.
            //
            // In this case we simply wait for some time and retry once to establish the connection.
            //
            if (error.code === 'SQLITE_BUSY' && retryOnBusy) {
                await timeout(SQLiteStorageDatabase.BUSY_OPEN_TIMEOUT);
                return this.connect(path, false /* not another retry */);
            }
            // Otherwise, best we can do is to recover from a backup if that exists, as such we
            // move the DB to a different filename and try to load from backup. If that fails,
            // a new empty DB is being created automatically.
            //
            // The final fallback is to use an in-memory DB which should only happen if the target
            // folder is really not writeable for us.
            //
            try {
                await fs.promises.unlink(path);
                try {
                    await Promises.rename(this.toBackupPath(path), path, false /* no retry */);
                }
                catch {
                    // ignore
                }
                return await this.doConnect(path);
            }
            catch (error) {
                this.logger.error(`[storage ${this.name}] open(): Unable to use backup due to ${error}`);
                // In case of any error to open the DB, use an in-memory
                // DB so that we always have a valid DB to talk to.
                return this.doConnect(SQLiteStorageDatabase.IN_MEMORY_PATH);
            }
        }
    }
    handleSQLiteError(connection, msg) {
        connection.isErroneous = true;
        connection.lastError = msg;
        this.logger.error(msg);
    }
    doConnect(path) {
        return new Promise((resolve, reject) => {
            import('@vscode/sqlite3').then(sqlite3 => {
                const ctor = (this.logger.isTracing ? sqlite3.default.verbose().Database : sqlite3.default.Database);
                const connection = {
                    db: new ctor(path, (error) => {
                        if (error) {
                            return (connection.db && error.code !== 'SQLITE_CANTOPEN' /* https://github.com/TryGhost/node-sqlite3/issues/1617 */) ? connection.db.close(() => reject(error)) : reject(error);
                        }
                        // The following exec() statement serves two purposes:
                        // - create the DB if it does not exist yet
                        // - validate that the DB is not corrupt (the open() call does not throw otherwise)
                        return this.exec(connection, [
                            'PRAGMA user_version = 1;',
                            'CREATE TABLE IF NOT EXISTS ItemTable (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB)'
                        ].join('')).then(() => {
                            return resolve(connection);
                        }, error => {
                            return connection.db.close(() => reject(error));
                        });
                    }),
                    isInMemory: path === SQLiteStorageDatabase.IN_MEMORY_PATH
                };
                // Errors
                connection.db.on('error', error => this.handleSQLiteError(connection, `[storage ${this.name}] Error (event): ${error}`));
                // Tracing
                if (this.logger.isTracing) {
                    connection.db.on('trace', sql => this.logger.trace(`[storage ${this.name}] Trace (event): ${sql}`));
                }
            }, reject);
        });
    }
    exec(connection, sql) {
        return new Promise((resolve, reject) => {
            connection.db.exec(sql, error => {
                if (error) {
                    this.handleSQLiteError(connection, `[storage ${this.name}] exec(): ${error}`);
                    return reject(error);
                }
                return resolve();
            });
        });
    }
    get(connection, sql) {
        return new Promise((resolve, reject) => {
            connection.db.get(sql, (error, row) => {
                if (error) {
                    this.handleSQLiteError(connection, `[storage ${this.name}] get(): ${error}`);
                    return reject(error);
                }
                return resolve(row);
            });
        });
    }
    all(connection, sql) {
        return new Promise((resolve, reject) => {
            connection.db.all(sql, (error, rows) => {
                if (error) {
                    this.handleSQLiteError(connection, `[storage ${this.name}] all(): ${error}`);
                    return reject(error);
                }
                return resolve(rows);
            });
        });
    }
    transaction(connection, transactions) {
        return new Promise((resolve, reject) => {
            connection.db.serialize(() => {
                connection.db.run('BEGIN TRANSACTION');
                transactions();
                connection.db.run('END TRANSACTION', error => {
                    if (error) {
                        this.handleSQLiteError(connection, `[storage ${this.name}] transaction(): ${error}`);
                        return reject(error);
                    }
                    return resolve();
                });
            });
        });
    }
    prepare(connection, sql, runCallback, errorDetails) {
        const stmt = connection.db.prepare(sql);
        const statementErrorListener = (error) => {
            this.handleSQLiteError(connection, `[storage ${this.name}] prepare(): ${error} (${sql}). Details: ${errorDetails()}`);
        };
        stmt.on('error', statementErrorListener);
        runCallback(stmt);
        stmt.finalize(error => {
            if (error) {
                statementErrorListener(error);
            }
            stmt.removeListener('error', statementErrorListener);
        });
    }
}
class SQLiteStorageDatabaseLogger {
    // to reduce lots of output, require an environment variable to enable tracing
    // this helps when running with --verbose normally where the storage tracing
    // might hide useful output to look at
    static { this.VSCODE_TRACE_STORAGE = 'VSCODE_TRACE_STORAGE'; }
    constructor(options) {
        if (options && typeof options.logTrace === 'function' && process.env[SQLiteStorageDatabaseLogger.VSCODE_TRACE_STORAGE]) {
            this.logTrace = options.logTrace;
        }
        if (options && typeof options.logError === 'function') {
            this.logError = options.logError;
        }
    }
    get isTracing() {
        return !!this.logTrace;
    }
    trace(msg) {
        this.logTrace?.(msg);
    }
    error(error) {
        this.logError?.(error);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL3BhcnRzL3N0b3JhZ2Uvbm9kZS9zdG9yYWdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3pCLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNuRCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDakQsT0FBTyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUNsRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDbkQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBcUJoRCxNQUFNLE9BQU8scUJBQXFCO2FBRWpCLG1CQUFjLEdBQUcsVUFBVSxDQUFDO0lBRTVDLElBQUksd0JBQXdCLEtBQXNDLE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxpRUFBaUU7YUFFaEksc0JBQWlCLEdBQUcsSUFBSSxDQUFDLEdBQUMsZ0VBQWdFO2FBQzFGLHdCQUFtQixHQUFHLEdBQUcsQ0FBQyxHQUFDLGtEQUFrRDtJQVFyRyxZQUNrQixJQUFZLEVBQzdCLFVBQXlDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBRDNDLFNBQUksR0FBSixJQUFJLENBQVE7UUFHN0IsSUFBSSxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSwyQkFBMkIsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDL0QsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FB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