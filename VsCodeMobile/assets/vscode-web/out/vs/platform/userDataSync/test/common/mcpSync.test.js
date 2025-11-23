/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { runWithFakedTimers } from '../../../../base/test/common/timeTravelScheduler.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IFileService } from '../../../files/common/files.js';
import { ILogService } from '../../../log/common/log.js';
import { IUserDataProfilesService } from '../../../userDataProfile/common/userDataProfile.js';
import { getMcpContentFromSyncContent } from '../../common/mcpSync.js';
import { IUserDataSyncStoreService } from '../../common/userDataSync.js';
import { UserDataSyncClient, UserDataSyncTestServer } from './userDataSyncClient.js';
suite('McpSync', () => {
    const server = new UserDataSyncTestServer();
    let client;
    let testObject;
    teardown(async () => {
        await client.instantiationService.get(IUserDataSyncStoreService).clear();
    });
    const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();
    setup(async () => {
        client = disposableStore.add(new UserDataSyncClient(server));
        await client.setUp(true);
        testObject = client.getSynchronizer("mcp" /* SyncResource.Mcp */);
    });
    test('when mcp file does not exist', async () => {
        await runWithFakedTimers({}, async () => {
            const fileService = client.instantiationService.get(IFileService);
            const mcpResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            assert.deepStrictEqual(await testObject.getLastSyncUserData(), null);
            let manifest = await client.getLatestRef("mcp" /* SyncResource.Mcp */);
            server.reset();
            await testObject.sync(manifest);
            assert.deepStrictEqual(server.requests, []);
            assert.ok(!await fileService.exists(mcpResource));
            const lastSyncUserData = await testObject.getLastSyncUserData();
            const remoteUserData = await testObject.getRemoteUserData(null);
            assert.deepStrictEqual(lastSyncUserData.ref, remoteUserData.ref);
            assert.deepStrictEqual(lastSyncUserData.syncData, remoteUserData.syncData);
            assert.strictEqual(lastSyncUserData.syncData, null);
            manifest = await client.getLatestRef("mcp" /* SyncResource.Mcp */);
            server.reset();
            await testObject.sync(manifest);
            assert.deepStrictEqual(server.requests, []);
            manifest = await client.getLatestRef("mcp" /* SyncResource.Mcp */);
            server.reset();
            await testObject.sync(manifest);
            assert.deepStrictEqual(server.requests, []);
        });
    });
    test('when mcp file does not exist and remote has changes', async () => {
        await runWithFakedTimers({}, async () => {
            const client2 = disposableStore.add(new UserDataSyncClient(server));
            await client2.setUp(true);
            const content = JSON.stringify({
                'mcpServers': {
                    'test-server': {
                        'command': 'node',
                        'args': ['./server.js']
                    }
                }
            });
            const mcpResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            await client2.instantiationService.get(IFileService).writeFile(mcpResource2, VSBuffer.fromString(content));
            await client2.sync();
            const fileService = client.instantiationService.get(IFileService);
            const mcpResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            assert.deepStrictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
            const lastSyncUserData = await testObject.getLastSyncUserData();
            const remoteUserData = await testObject.getRemoteUserData(null);
            assert.strictEqual(getMcpContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual(getMcpContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual((await fileService.readFile(mcpResource)).value.toString(), content);
        });
    });
    test('when mcp file exists locally and remote has no mcp', async () => {
        await runWithFakedTimers({}, async () => {
            const fileService = client.instantiationService.get(IFileService);
            const mcpResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            const content = JSON.stringify({
                'mcpServers': {
                    'test-server': {
                        'command': 'node',
                        'args': ['./server.js']
                    }
                }
            });
            fileService.writeFile(mcpResource, VSBuffer.fromString(content));
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            assert.deepStrictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
            const lastSyncUserData = await testObject.getLastSyncUserData();
            const remoteUserData = await testObject.getRemoteUserData(null);
            assert.strictEqual(getMcpContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual(getMcpContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
        });
    });
    test('first time sync: when mcp file exists locally with same content as remote', async () => {
        await runWithFakedTimers({}, async () => {
            const client2 = disposableStore.add(new UserDataSyncClient(server));
            await client2.setUp(true);
            const content = JSON.stringify({
                'mcpServers': {
                    'test-server': {
                        'command': 'node',
                        'args': ['./server.js']
                    }
                }
            });
            const mcpResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            await client2.instantiationService.get(IFileService).writeFile(mcpResource2, VSBuffer.fromString(content));
            await client2.sync();
            const fileService = client.instantiationService.get(IFileService);
            const mcpResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            await fileService.writeFile(mcpResource, VSBuffer.fromString(content));
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            assert.deepStrictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
            const lastSyncUserData = await testObject.getLastSyncUserData();
            const remoteUserData = await testObject.getRemoteUserData(null);
            assert.strictEqual(getMcpContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual(getMcpContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual((await fileService.readFile(mcpResource)).value.toString(), content);
        });
    });
    test('when mcp file locally has moved forward', async () => {
        await runWithFakedTimers({}, async () => {
            const fileService = client.instantiationService.get(IFileService);
            const mcpResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            fileService.writeFile(mcpResource, VSBuffer.fromString(JSON.stringify({
                'mcpServers': {}
            })));
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            const content = JSON.stringify({
                'mcpServers': {
                    'test-server': {
                        'command': 'node',
                        'args': ['./server.js']
                    }
                }
            });
            fileService.writeFile(mcpResource, VSBuffer.fromString(content));
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            assert.deepStrictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
            const lastSyncUserData = await testObject.getLastSyncUserData();
            const remoteUserData = await testObject.getRemoteUserData(null);
            assert.strictEqual(getMcpContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual(getMcpContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
        });
    });
    test('when mcp file remotely has moved forward', async () => {
        await runWithFakedTimers({}, async () => {
            const client2 = disposableStore.add(new UserDataSyncClient(server));
            await client2.setUp(true);
            const mcpResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            const fileService2 = client2.instantiationService.get(IFileService);
            await fileService2.writeFile(mcpResource2, VSBuffer.fromString(JSON.stringify({
                'mcpServers': {}
            })));
            const fileService = client.instantiationService.get(IFileService);
            const mcpResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            await client2.sync();
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            const content = JSON.stringify({
                'mcpServers': {
                    'test-server': {
                        'command': 'node',
                        'args': ['./server.js']
                    }
                }
            });
            fileService2.writeFile(mcpResource2, VSBuffer.fromString(content));
            await client2.sync();
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            assert.deepStrictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
            const lastSyncUserData = await testObject.getLastSyncUserData();
            const remoteUserData = await testObject.getRemoteUserData(null);
            assert.strictEqual(getMcpContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual(getMcpContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual((await fileService.readFile(mcpResource)).value.toString(), content);
        });
    });
    test('when mcp file has moved forward locally and remotely with same changes', async () => {
        await runWithFakedTimers({}, async () => {
            const client2 = disposableStore.add(new UserDataSyncClient(server));
            await client2.setUp(true);
            const mcpResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            const fileService2 = client2.instantiationService.get(IFileService);
            await fileService2.writeFile(mcpResource2, VSBuffer.fromString(JSON.stringify({
                'mcpServers': {}
            })));
            const fileService = client.instantiationService.get(IFileService);
            const mcpResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            await client2.sync();
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            const content = JSON.stringify({
                'mcpServers': {
                    'test-server': {
                        'command': 'node',
                        'args': ['./server.js']
                    }
                }
            });
            fileService2.writeFile(mcpResource2, VSBuffer.fromString(content));
            await client2.sync();
            fileService.writeFile(mcpResource, VSBuffer.fromString(content));
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            assert.deepStrictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
            const lastSyncUserData = await testObject.getLastSyncUserData();
            const remoteUserData = await testObject.getRemoteUserData(null);
            assert.strictEqual(getMcpContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual(getMcpContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual((await fileService.readFile(mcpResource)).value.toString(), content);
        });
    });
    test('when mcp file has moved forward locally and remotely - accept preview', async () => {
        await runWithFakedTimers({}, async () => {
            const client2 = disposableStore.add(new UserDataSyncClient(server));
            await client2.setUp(true);
            const mcpResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            const fileService2 = client2.instantiationService.get(IFileService);
            await fileService2.writeFile(mcpResource2, VSBuffer.fromString(JSON.stringify({
                'mcpServers': {}
            })));
            const fileService = client.instantiationService.get(IFileService);
            const mcpResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            await client2.sync();
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            fileService2.writeFile(mcpResource2, VSBuffer.fromString(JSON.stringify({
                'mcpServers': {
                    'server1': {
                        'command': 'node',
                        'args': ['./server1.js']
                    }
                }
            })));
            await client2.sync();
            const content = JSON.stringify({
                'mcpServers': {
                    'server2': {
                        'command': 'node',
                        'args': ['./server2.js']
                    }
                }
            });
            fileService.writeFile(mcpResource, VSBuffer.fromString(content));
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            const previewContent = (await fileService.readFile(testObject.conflicts.conflicts[0].previewResource)).value.toString();
            assert.deepStrictEqual(testObject.status, "hasConflicts" /* SyncStatus.HasConflicts */);
            assert.deepStrictEqual(testObject.conflicts.conflicts.length, 1);
            assert.deepStrictEqual(testObject.conflicts.conflicts[0].mergeState, "conflict" /* MergeState.Conflict */);
            assert.deepStrictEqual(testObject.conflicts.conflicts[0].localChange, 2 /* Change.Modified */);
            assert.deepStrictEqual(testObject.conflicts.conflicts[0].remoteChange, 2 /* Change.Modified */);
            await testObject.accept(testObject.conflicts.conflicts[0].previewResource);
            await testObject.apply(false);
            assert.deepStrictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
            const lastSyncUserData = await testObject.getLastSyncUserData();
            const remoteUserData = await testObject.getRemoteUserData(null);
            assert.strictEqual(getMcpContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), previewContent);
            assert.strictEqual(getMcpContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), previewContent);
            assert.strictEqual((await fileService.readFile(mcpResource)).value.toString(), previewContent);
        });
    });
    test('when mcp file has moved forward locally and remotely - accept modified preview', async () => {
        await runWithFakedTimers({}, async () => {
            const client2 = disposableStore.add(new UserDataSyncClient(server));
            await client2.setUp(true);
            const mcpResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            const fileService2 = client2.instantiationService.get(IFileService);
            await fileService2.writeFile(mcpResource2, VSBuffer.fromString(JSON.stringify({
                'mcpServers': {}
            })));
            const fileService = client.instantiationService.get(IFileService);
            const mcpResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            await client2.sync();
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            fileService2.writeFile(mcpResource2, VSBuffer.fromString(JSON.stringify({
                'mcpServers': {
                    'server1': {
                        'command': 'node',
                        'args': ['./server1.js']
                    }
                }
            })));
            await client2.sync();
            fileService.writeFile(mcpResource, VSBuffer.fromString(JSON.stringify({
                'mcpServers': {
                    'server2': {
                        'command': 'node',
                        'args': ['./server2.js']
                    }
                }
            })));
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            const content = JSON.stringify({
                'mcpServers': {
                    'server1': {
                        'command': 'node',
                        'args': ['./server1.js']
                    },
                    'server2': {
                        'command': 'node',
                        'args': ['./server2.js']
                    }
                }
            });
            await testObject.accept(testObject.conflicts.conflicts[0].previewResource, content);
            await testObject.apply(false);
            assert.deepStrictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
            const lastSyncUserData = await testObject.getLastSyncUserData();
            const remoteUserData = await testObject.getRemoteUserData(null);
            assert.strictEqual(getMcpContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual(getMcpContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual((await fileService.readFile(mcpResource)).value.toString(), content);
        });
    });
    test('when mcp file has moved forward locally and remotely - accept remote', async () => {
        await runWithFakedTimers({}, async () => {
            const client2 = disposableStore.add(new UserDataSyncClient(server));
            await client2.setUp(true);
            const mcpResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            const fileService2 = client2.instantiationService.get(IFileService);
            await fileService2.writeFile(mcpResource2, VSBuffer.fromString(JSON.stringify({
                'mcpServers': {}
            })));
            const fileService = client.instantiationService.get(IFileService);
            const mcpResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            await client2.sync();
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            const content = JSON.stringify({
                'mcpServers': {
                    'server1': {
                        'command': 'node',
                        'args': ['./server1.js']
                    }
                }
            });
            fileService2.writeFile(mcpResource2, VSBuffer.fromString(content));
            await client2.sync();
            fileService.writeFile(mcpResource, VSBuffer.fromString(JSON.stringify({
                'mcpServers': {
                    'server2': {
                        'command': 'node',
                        'args': ['./server2.js']
                    }
                }
            })));
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            assert.deepStrictEqual(testObject.status, "hasConflicts" /* SyncStatus.HasConflicts */);
            await testObject.accept(testObject.conflicts.conflicts[0].remoteResource);
            await testObject.apply(false);
            assert.deepStrictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
            const lastSyncUserData = await testObject.getLastSyncUserData();
            const remoteUserData = await testObject.getRemoteUserData(null);
            assert.strictEqual(getMcpContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual(getMcpContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual((await fileService.readFile(mcpResource)).value.toString(), content);
        });
    });
    test('when mcp file has moved forward locally and remotely - accept local', async () => {
        await runWithFakedTimers({}, async () => {
            const client2 = disposableStore.add(new UserDataSyncClient(server));
            await client2.setUp(true);
            const mcpResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            const fileService2 = client2.instantiationService.get(IFileService);
            await fileService2.writeFile(mcpResource2, VSBuffer.fromString(JSON.stringify({
                'mcpServers': {}
            })));
            const fileService = client.instantiationService.get(IFileService);
            const mcpResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            await client2.sync();
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            fileService2.writeFile(mcpResource2, VSBuffer.fromString(JSON.stringify({
                'mcpServers': {
                    'server1': {
                        'command': 'node',
                        'args': ['./server1.js']
                    }
                }
            })));
            await client2.sync();
            const content = JSON.stringify({
                'mcpServers': {
                    'server2': {
                        'command': 'node',
                        'args': ['./server2.js']
                    }
                }
            });
            fileService.writeFile(mcpResource, VSBuffer.fromString(content));
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            assert.deepStrictEqual(testObject.status, "hasConflicts" /* SyncStatus.HasConflicts */);
            await testObject.accept(testObject.conflicts.conflicts[0].localResource);
            await testObject.apply(false);
            assert.deepStrictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
            const lastSyncUserData = await testObject.getLastSyncUserData();
            const remoteUserData = await testObject.getRemoteUserData(null);
            assert.strictEqual(getMcpContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual(getMcpContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
            assert.strictEqual((await fileService.readFile(mcpResource)).value.toString(), content);
        });
    });
    test('when mcp file was removed in one client', async () => {
        await runWithFakedTimers({}, async () => {
            const fileService = client.instantiationService.get(IFileService);
            const mcpResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            await fileService.writeFile(mcpResource, VSBuffer.fromString(JSON.stringify({
                'mcpServers': {}
            })));
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            const client2 = disposableStore.add(new UserDataSyncClient(server));
            await client2.setUp(true);
            await client2.sync();
            const mcpResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            const fileService2 = client2.instantiationService.get(IFileService);
            fileService2.del(mcpResource2);
            await client2.sync();
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            assert.deepStrictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
            const lastSyncUserData = await testObject.getLastSyncUserData();
            const remoteUserData = await testObject.getRemoteUserData(null);
            assert.strictEqual(getMcpContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), null);
            assert.strictEqual(getMcpContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), null);
            assert.strictEqual(await fileService.exists(mcpResource), false);
        });
    });
    test('when mcp file is created after first sync', async () => {
        await runWithFakedTimers({}, async () => {
            const fileService = client.instantiationService.get(IFileService);
            const mcpResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */));
            const content = JSON.stringify({
                'mcpServers': {
                    'test-server': {
                        'command': 'node',
                        'args': ['./server.js']
                    }
                }
            });
            await fileService.createFile(mcpResource, VSBuffer.fromString(content));
            let lastSyncUserData = await testObject.getLastSyncUserData();
            const manifest = await client.getLatestRef("mcp" /* SyncResource.Mcp */);
            server.reset();
            await testObject.sync(manifest);
            assert.deepStrictEqual(server.requests, [
                { type: 'POST', url: `${server.url}/v1/resource/${testObject.resource}`, headers: { 'If-Match': lastSyncUserData?.ref } },
            ]);
            lastSyncUserData = await testObject.getLastSyncUserData();
            const remoteUserData = await testObject.getRemoteUserData(null);
            assert.deepStrictEqual(lastSyncUserData.ref, remoteUserData.ref);
            assert.deepStrictEqual(lastSyncUserData.syncData, remoteUserData.syncData);
            assert.strictEqual(getMcpContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
        });
    });
    test('apply remote when mcp file does not exist', async () => {
        await runWithFakedTimers({}, async () => {
            const fileService = client.instantiationService.get(IFileService);
            const mcpResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.mcpResource;
            if (await fileService.exists(mcpResource)) {
                await fileService.del(mcpResource);
            }
            const preview = (await testObject.sync(await client.getLatestRef("mcp" /* SyncResource.Mcp */), true));
            server.reset();
            const content = await testObject.resolveContent(preview.resourcePreviews[0].remoteResource);
            await testObject.accept(preview.resourcePreviews[0].remoteResource, content);
            await testObject.apply(false);
            assert.deepStrictEqual(server.requests, []);
        });
    });
    test('sync profile mcp', async () => {
        await runWithFakedTimers({}, async () => {
            const client2 = disposableStore.add(new UserDataSyncClient(server));
            await client2.setUp(true);
            const profile = await client2.instantiationService.get(IUserDataProfilesService).createNamedProfile('profile1');
            const expected = JSON.stringify({
                'mcpServers': {
                    'test-server': {
                        'command': 'node',
                        'args': ['./server.js']
                    }
                }
            });
            await client2.instantiationService.get(IFileService).createFile(profile.mcpResource, VSBuffer.fromString(expected));
            await client2.sync();
            await client.sync();
            const syncedProfile = client.instantiationService.get(IUserDataProfilesService).profiles.find(p => p.id === profile.id);
            const actual = (await client.instantiationService.get(IFileService).readFile(syncedProfile.mcpResource)).value.toString();
            assert.strictEqual(actual, expected);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwU3luYy50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3VzZXJEYXRhU3luYy90ZXN0L2NvbW1vbi9tY3BTeW5jLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ3pELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQzlGLE9BQU8sRUFBRSw0QkFBNEIsRUFBbUIsTUFBTSx5QkFBeUIsQ0FBQztBQUN4RixPQUFPLEVBQVUseUJBQXlCLEVBQXdDLE1BQU0sOEJBQThCLENBQUM7QUFDdkgsT0FBTyxFQUFFLGtCQUFrQixFQUFFLHNCQUFzQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFFckYsS0FBSyxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUU7SUFFckIsTUFBTSxNQUFNLEdBQUcsSUFBSSxzQkFBc0IsRUFBRSxDQUFDO0lBQzVDLElBQUksTUFBMEIsQ0FBQztJQUUvQixJQUFJLFVBQTJCLENBQUM7SUFFaEMsUUFBUSxDQUFDLEtBQUssSUFBSSxFQUFFO1FBQ25CLE1BQU0sTUFBTSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQzFFLENBQUMsQ0FBQyxDQUFDO0lBRUgsTUFBTSxlQUFlLEdB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