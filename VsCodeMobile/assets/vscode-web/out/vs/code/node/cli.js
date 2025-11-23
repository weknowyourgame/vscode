/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { spawn } from 'child_process';
import { chmodSync, existsSync, readFileSync, statSync, truncateSync, unlinkSync } from 'fs';
import { homedir, release, tmpdir } from 'os';
import { Event } from '../../base/common/event.js';
import { isAbsolute, resolve, join, dirname } from '../../base/common/path.js';
import { isMacintosh, isWindows } from '../../base/common/platform.js';
import { randomPort } from '../../base/common/ports.js';
import { whenDeleted, writeFileSync } from '../../base/node/pfs.js';
import { findFreePort } from '../../base/node/ports.js';
import { watchFileContents } from '../../platform/files/node/watcher/nodejs/nodejsWatcherLib.js';
import { buildHelpMessage, buildStdinMessage, buildVersionMessage, NATIVE_CLI_COMMANDS, OPTIONS } from '../../platform/environment/node/argv.js';
import { addArg, parseCLIProcessArgv } from '../../platform/environment/node/argvHelper.js';
import { getStdinFilePath, hasStdinWithoutTty, readFromStdin, stdinDataListener } from '../../platform/environment/node/stdin.js';
import { createWaitMarkerFileSync } from '../../platform/environment/node/wait.js';
import product from '../../platform/product/common/product.js';
import { CancellationTokenSource } from '../../base/common/cancellation.js';
import { isUNC, randomPath } from '../../base/common/extpath.js';
import { Utils } from '../../platform/profiling/common/profiling.js';
import { FileAccess } from '../../base/common/network.js';
import { cwd } from '../../base/common/process.js';
import { addUNCHostToAllowlist } from '../../base/node/unc.js';
import { URI } from '../../base/common/uri.js';
import { DeferredPromise } from '../../base/common/async.js';
function shouldSpawnCliProcess(argv) {
    return !!argv['install-source']
        || !!argv['list-extensions']
        || !!argv['install-extension']
        || !!argv['uninstall-extension']
        || !!argv['update-extensions']
        || !!argv['locate-extension']
        || !!argv['add-mcp']
        || !!argv['telemetry'];
}
export async function main(argv) {
    let args;
    try {
        args = parseCLIProcessArgv(argv);
    }
    catch (err) {
        console.error(err.message);
        return;
    }
    for (const subcommand of NATIVE_CLI_COMMANDS) {
        if (args[subcommand]) {
            if (!product.tunnelApplicationName) {
                console.error(`'${subcommand}' command not supported in ${product.applicationName}`);
                return;
            }
            const env = {
                ...process.env
            };
            // bootstrap-esm.js determines the electron environment based
            // on the following variable. For the server we need to unset
            // it to prevent importing any electron specific modules.
            // Refs https://github.com/microsoft/vscode/issues/221883
            delete env['ELECTRON_RUN_AS_NODE'];
            const tunnelArgs = argv.slice(argv.indexOf(subcommand) + 1); // all arguments behind `tunnel`
            return new Promise((resolve, reject) => {
                let tunnelProcess;
                const stdio = ['ignore', 'pipe', 'pipe'];
                if (process.env['VSCODE_DEV']) {
                    tunnelProcess = spawn('cargo', ['run', '--', subcommand, ...tunnelArgs], { cwd: join(getAppRoot(), 'cli'), stdio, env });
                }
                else {
                    const appPath = process.platform === 'darwin'
                        // ./Contents/MacOS/Electron => ./Contents/Resources/app/bin/code-tunnel-insiders
                        ? join(dirname(dirname(process.execPath)), 'Resources', 'app')
                        : dirname(process.execPath);
                    const tunnelCommand = join(appPath, 'bin', `${product.tunnelApplicationName}${isWindows ? '.exe' : ''}`);
                    tunnelProcess = spawn(tunnelCommand, [subcommand, ...tunnelArgs], { cwd: cwd(), stdio, env });
                }
                tunnelProcess.stdout.pipe(process.stdout);
                tunnelProcess.stderr.pipe(process.stderr);
                tunnelProcess.on('exit', resolve);
                tunnelProcess.on('error', reject);
            });
        }
    }
    // Help (general)
    if (args.help) {
        const executable = `${product.applicationName}${isWindows ? '.exe' : ''}`;
        console.log(buildHelpMessage(product.nameLong, executable, product.version, OPTIONS));
    }
    // Help (chat)
    else if (args.chat?.help) {
        const executable = `${product.applicationName}${isWindows ? '.exe' : ''}`;
        console.log(buildHelpMessage(product.nameLong, executable, product.version, OPTIONS.chat.options, { isChat: true }));
    }
    // Version Info
    else if (args.version) {
        console.log(buildVersionMessage(product.version, product.commit));
    }
    // Shell integration
    else if (args['locate-shell-integration-path']) {
        let file;
        switch (args['locate-shell-integration-path']) {
            // Usage: `[[ "$TERM_PROGRAM" == "vscode" ]] && . "$(code --locate-shell-integration-path bash)"`
            case 'bash':
                file = 'shellIntegration-bash.sh';
                break;
            // Usage: `if ($env:TERM_PROGRAM -eq "vscode") { . "$(code --locate-shell-integration-path pwsh)" }`
            case 'pwsh':
                file = 'shellIntegration.ps1';
                break;
            // Usage: `[[ "$TERM_PROGRAM" == "vscode" ]] && . "$(code --locate-shell-integration-path zsh)"`
            case 'zsh':
                file = 'shellIntegration-rc.zsh';
                break;
            // Usage: `string match -q "$TERM_PROGRAM" "vscode"; and . (code --locate-shell-integration-path fish)`
            case 'fish':
                file = 'shellIntegration.fish';
                break;
            default: throw new Error('Error using --locate-shell-integration-path: Invalid shell type');
        }
        console.log(join(getAppRoot(), 'out', 'vs', 'workbench', 'contrib', 'terminal', 'common', 'scripts', file));
    }
    // Extensions Management
    else if (shouldSpawnCliProcess(args)) {
        // We do not bundle `cliProcessMain.js` into this file because
        // it is rather large and only needed for very few CLI operations.
        // This has the downside that we need to know if we run OSS or
        // built, because our location on disk is different if built.
        let cliProcessMain;
        if (process.env['VSCODE_DEV']) {
            cliProcessMain = './cliProcessMain.js';
        }
        else {
            cliProcessMain = './vs/code/node/cliProcessMain.js';
        }
        const cli = await import(cliProcessMain);
        await cli.main(args);
        return;
    }
    // Write File
    else if (args['file-write']) {
        const argsFile = args._[0];
        if (!argsFile || !isAbsolute(argsFile) || !existsSync(argsFile) || !statSync(argsFile).isFile()) {
            throw new Error('Using --file-write with invalid arguments.');
        }
        let source;
        let target;
        try {
            const argsContents = JSON.parse(readFileSync(argsFile, 'utf8'));
            source = argsContents.source;
            target = argsContents.target;
        }
        catch (error) {
            throw new Error('Using --file-write with invalid arguments.');
        }
        // Windows: set the paths as allowed UNC paths given
        // they are explicitly provided by the user as arguments
        if (isWindows) {
            for (const path of [source, target]) {
                if (typeof path === 'string' && isUNC(path)) {
                    addUNCHostToAllowlist(URI.file(path).authority);
                }
            }
        }
        // Validate
        if (!source || !target || source === target || // make sure source and target are provided and are not the same
            !isAbsolute(source) || !isAbsolute(target) || // make sure both source and target are absolute paths
            !existsSync(source) || !statSync(source).isFile() || // make sure source exists as file
            !existsSync(target) || !statSync(target).isFile() // make sure target exists as file
        ) {
            throw new Error('Using --file-write with invalid arguments.');
        }
        try {
            // Check for readonly status and chmod if so if we are told so
            let targetMode = 0;
            let restoreMode = false;
            if (args['file-chmod']) {
                targetMode = statSync(target).mode;
                if (!(targetMode & 0o200 /* File mode indicating writable by owner */)) {
                    chmodSync(target, targetMode | 0o200);
                    restoreMode = true;
                }
            }
            // Write source to target
            const data = readFileSync(source);
            if (isWindows) {
                // On Windows we use a different strategy of saving the file
                // by first truncating the file and then writing with r+ mode.
                // This helps to save hidden files on Windows
                // (see https://github.com/microsoft/vscode/issues/931) and
                // prevent removing alternate data streams
                // (see https://github.com/microsoft/vscode/issues/6363)
                truncateSync(target, 0);
                writeFileSync(target, data, { flag: 'r+' });
            }
            else {
                writeFileSync(target, data);
            }
            // Restore previous mode as needed
            if (restoreMode) {
                chmodSync(target, targetMode);
            }
        }
        catch (error) {
            error.message = `Error using --file-write: ${error.message}`;
            throw error;
        }
    }
    // Just Code
    else {
        const env = {
            ...process.env,
            'ELECTRON_NO_ATTACH_CONSOLE': '1'
        };
        delete env['ELECTRON_RUN_AS_NODE'];
        const processCallbacks = [];
        if (args.verbose) {
            env['ELECTRON_ENABLE_LOGGING'] = '1';
        }
        if (args.verbose || args.status) {
            processCallbacks.push(async (child) => {
                child.stdout?.on('data', (data) => console.log(data.toString('utf8').trim()));
                child.stderr?.on('data', (data) => console.log(data.toString('utf8').trim()));
                await Event.toPromise(Event.fromNodeEventEmitter(child, 'exit'));
            });
        }
        // Handle --transient option
        if (args['transient']) {
            const tempParentDir = randomPath(tmpdir(), 'vscode');
            const tempUserDataDir = join(tempParentDir, 'data');
            const tempExtensionsDir = join(tempParentDir, 'extensions');
            addArg(argv, '--user-data-dir', tempUserDataDir);
            addArg(argv, '--extensions-dir', tempExtensionsDir);
            console.log(`State is temporarily stored. Relaunch this state with: ${product.applicationName} --user-data-dir "${tempUserDataDir}" --extensions-dir "${tempExtensionsDir}"`);
        }
        const hasReadStdinArg = args._.some(arg => arg === '-') || args.chat?._.some(arg => arg === '-');
        if (hasReadStdinArg) {
            // remove the "-" argument when we read from stdin
            args._ = args._.filter(a => a !== '-');
            argv = argv.filter(a => a !== '-');
        }
        let stdinFilePath;
        if (hasStdinWithoutTty()) {
            // Read from stdin: we require a single "-" argument to be passed in order to start reading from
            // stdin. We do this because there is no reliable way to find out if data is piped to stdin. Just
            // checking for stdin being connected to a TTY is not enough (https://github.com/microsoft/vscode/issues/40351)
            if (hasReadStdinArg) {
                stdinFilePath = getStdinFilePath();
                try {
                    const readFromStdinDone = new DeferredPromise();
                    await readFromStdin(stdinFilePath, !!args.verbose, () => readFromStdinDone.complete());
                    if (!args.wait) {
                        // if `--wait` is not provided, we keep this process alive
                        // for at least as long as the stdin stream is open to
                        // ensure that we read all the data.
                        // the downside is that the Code CLI process will then not
                        // terminate until stdin is closed, but users can always
                        // pass `--wait` to prevent that from happening (this is
                        // actually what we enforced until v1.85.x but then was
                        // changed to not enforce it anymore).
                        // a solution in the future would possibly be to exit, when
                        // the Code process exits. this would require some careful
                        // solution though in case Code is already running and this
                        // is a second instance telling the first instance what to
                        // open.
                        processCallbacks.push(() => readFromStdinDone.p);
                    }
                    if (args.chat) {
                        // Make sure to add tmp file as context to chat
                        addArg(argv, '--add-file', stdinFilePath);
                    }
                    else {
                        // Make sure to open tmp file as editor but ignore
                        // it in the "recently open" list
                        addArg(argv, stdinFilePath);
                        addArg(argv, '--skip-add-to-recently-opened');
                    }
                    console.log(`Reading from stdin via: ${stdinFilePath}`);
                }
                catch (e) {
                    console.log(`Failed to create file to read via stdin: ${e.toString()}`);
                    stdinFilePath = undefined;
                }
            }
            else {
                // If the user pipes data via stdin but forgot to add the "-" argument, help by printing a message
                // if we detect that data flows into via stdin after a certain timeout.
                processCallbacks.push(_ => stdinDataListener(1000).then(dataReceived => {
                    if (dataReceived) {
                        console.log(buildStdinMessage(product.applicationName, !!args.chat));
                    }
                }));
            }
        }
        const isMacOSBigSurOrNewer = isMacintosh && release() > '20.0.0';
        // If we are started with --wait create a random temporary file
        // and pass it over to the starting instance. We can use this file
        // to wait for it to be deleted to monitor that the edited file
        // is closed and then exit the waiting process.
        let waitMarkerFilePath;
        if (args.wait) {
            waitMarkerFilePath = createWaitMarkerFileSync(args.verbose);
            if (waitMarkerFilePath) {
                addArg(argv, '--waitMarkerFilePath', waitMarkerFilePath);
            }
            // When running with --wait, we want to continue running CLI process
            // until either:
            // - the wait marker file has been deleted (e.g. when closing the editor)
            // - the launched process terminates (e.g. due to a crash)
            processCallbacks.push(async (child) => {
                let childExitPromise;
                if (isMacOSBigSurOrNewer) {
                    // On Big Sur, we resolve the following promise only when the child,
                    // i.e. the open command, exited with a signal or error. Otherwise, we
                    // wait for the marker file to be deleted or for the child to error.
                    childExitPromise = new Promise(resolve => {
                        // Only resolve this promise if the child (i.e. open) exited with an error
                        child.on('exit', (code, signal) => {
                            if (code !== 0 || signal) {
                                resolve();
                            }
                        });
                    });
                }
                else {
                    // On other platforms, we listen for exit in case the child exits before the
                    // marker file is deleted.
                    childExitPromise = Event.toPromise(Event.fromNodeEventEmitter(child, 'exit'));
                }
                try {
                    await Promise.race([
                        whenDeleted(waitMarkerFilePath),
                        Event.toPromise(Event.fromNodeEventEmitter(child, 'error')),
                        childExitPromise
                    ]);
                }
                finally {
                    if (stdinFilePath) {
                        unlinkSync(stdinFilePath); // Make sure to delete the tmp stdin file if we have any
                    }
                }
            });
        }
        // If we have been started with `--prof-startup` we need to find free ports to profile
        // the main process, the renderer, and the extension host. We also disable v8 cached data
        // to get better profile traces. Last, we listen on stdout for a signal that tells us to
        // stop profiling.
        if (args['prof-startup']) {
            const profileHost = '127.0.0.1';
            const portMain = await findFreePort(randomPort(), 10, 3000);
            const portRenderer = await findFreePort(portMain + 1, 10, 3000);
            const portExthost = await findFreePort(portRenderer + 1, 10, 3000);
            // fail the operation when one of the ports couldn't be acquired.
            if (portMain * portRenderer * portExthost === 0) {
                throw new Error('Failed to find free ports for profiler. Make sure to shutdown all instances of the editor first.');
            }
            const filenamePrefix = randomPath(homedir(), 'prof');
            addArg(argv, `--inspect-brk=${profileHost}:${portMain}`);
            addArg(argv, `--remote-debugging-port=${profileHost}:${portRenderer}`);
            addArg(argv, `--inspect-brk-extensions=${profileHost}:${portExthost}`);
            addArg(argv, `--prof-startup-prefix`, filenamePrefix);
            addArg(argv, `--no-cached-data`);
            writeFileSync(filenamePrefix, argv.slice(-6).join('|'));
            processCallbacks.push(async (_child) => {
                class Profiler {
                    static async start(name, filenamePrefix, opts) {
                        const profiler = await import('v8-inspect-profiler');
                        let session;
                        try {
                            session = await profiler.startProfiling({ ...opts, host: profileHost });
                        }
                        catch (err) {
                            console.error(`FAILED to start profiling for '${name}' on port '${opts.port}'`);
                        }
                        return {
                            async stop() {
                                if (!session) {
                                    return;
                                }
                                let suffix = '';
                                const result = await session.stop();
                                if (!process.env['VSCODE_DEV']) {
                                    // when running from a not-development-build we remove
                                    // absolute filenames because we don't want to reveal anything
                                    // about users. We also append the `.txt` suffix to make it
                                    // easier to attach these files to GH issues
                                    result.profile = Utils.rewriteAbsolutePaths(result.profile, 'piiRemoved');
                                    suffix = '.txt';
                                }
                                writeFileSync(`${filenamePrefix}.${name}.cpuprofile${suffix}`, JSON.stringify(result.profile, undefined, 4));
                            }
                        };
                    }
                }
                try {
                    // load and start profiler
                    const mainProfileRequest = Profiler.start('main', filenamePrefix, { port: portMain });
                    const extHostProfileRequest = Profiler.start('extHost', filenamePrefix, { port: portExthost, tries: 300 });
                    const rendererProfileRequest = Profiler.start('renderer', filenamePrefix, {
                        port: portRenderer,
                        tries: 200,
                        target: function (targets) {
                            return targets.filter(target => {
                                if (!target.webSocketDebuggerUrl) {
                                    return false;
                                }
                                if (target.type === 'page') {
                                    return target.url.indexOf('workbench/workbench.html') > 0 || target.url.indexOf('workbench/workbench-dev.html') > 0;
                                }
                                else {
                                    return true;
                                }
                            })[0];
                        }
                    });
                    const main = await mainProfileRequest;
                    const extHost = await extHostProfileRequest;
                    const renderer = await rendererProfileRequest;
                    // wait for the renderer to delete the marker file
                    await whenDeleted(filenamePrefix);
                    // stop profiling
                    await main.stop();
                    await renderer.stop();
                    await extHost.stop();
                    // re-create the marker file to signal that profiling is done
                    writeFileSync(filenamePrefix, '');
                }
                catch (e) {
                    console.error('Failed to profile startup. Make sure to quit Code first.');
                }
            });
        }
        const options = {
            detached: true,
            env
        };
        if (!args.verbose) {
            options['stdio'] = 'ignore';
        }
        let child;
        if (!isMacOSBigSurOrNewer) {
            if (!args.verbose && args.status) {
                options['stdio'] = ['ignore', 'pipe', 'ignore']; // restore ability to see output when --status is used
            }
            // We spawn process.execPath directly
            child = spawn(process.execPath, argv.slice(2), options);
        }
        else {
            // On Big Sur, we spawn using the open command to obtain behavior
            // similar to if the app was launched from the dock
            // https://github.com/microsoft/vscode/issues/102975
            // The following args are for the open command itself, rather than for VS Code:
            // -n creates a new instance.
            //    Without -n, the open command re-opens the existing instance as-is.
            // -g starts the new instance in the background.
            //    Later, Electron brings the instance to the foreground.
            //    This way, Mac does not automatically try to foreground the new instance, which causes
            //    focusing issues when the new instance only sends data to a previous instance and then closes.
            const spawnArgs = ['-n', '-g'];
            // -a opens the given application.
            spawnArgs.push('-a', process.execPath); // -a: opens a specific application
            if (args.verbose || args.status) {
                spawnArgs.push('--wait-apps'); // `open --wait-apps`: blocks until the launched app is closed (even if they were already running)
                // The open command only allows for redirecting stderr and stdout to files,
                // so we make it redirect those to temp files, and then use a logger to
                // redirect the file output to the console
                for (const outputType of args.verbose ? ['stdout', 'stderr'] : ['stdout']) {
                    // Tmp file to target output to
                    const tmpName = randomPath(tmpdir(), `code-${outputType}`);
                    writeFileSync(tmpName, '');
                    spawnArgs.push(`--${outputType}`, tmpName);
                    // Listener to redirect content to stdout/stderr
                    processCallbacks.push(async (child) => {
                        try {
                            const stream = outputType === 'stdout' ? process.stdout : process.stderr;
                            const cts = new CancellationTokenSource();
                            child.on('close', () => {
                                // We must dispose the token to stop watching,
                                // but the watcher might still be reading data.
                                setTimeout(() => cts.dispose(true), 200);
                            });
                            await watchFileContents(tmpName, chunk => stream.write(chunk), () => { }, cts.token);
                        }
                        finally {
                            unlinkSync(tmpName);
                        }
                    });
                }
            }
            for (const e in env) {
                // Ignore the _ env var, because the open command
                // ignores it anyway.
                // Pass the rest of the env vars in to fix
                // https://github.com/microsoft/vscode/issues/134696.
                if (e !== '_') {
                    spawnArgs.push('--env');
                    spawnArgs.push(`${e}=${env[e]}`);
                }
            }
            spawnArgs.push('--args', ...argv.slice(2)); // pass on our arguments
            if (env['VSCODE_DEV']) {
                // If we're in development mode, replace the . arg with the
                // vscode source arg. Because the OSS app isn't bundled,
                // it needs the full vscode source arg to launch properly.
                const curdir = '.';
                const launchDirIndex = spawnArgs.indexOf(curdir);
                if (launchDirIndex !== -1) {
                    spawnArgs[launchDirIndex] = resolve(curdir);
                }
            }
            // We already passed over the env variables
            // using the --env flags, so we can leave them out here.
            // Also, we don't need to pass env._, which is different from argv._
            child = spawn('open', spawnArgs, { ...options, env: {} });
        }
        await Promise.all(processCallbacks.map(callback => callback(child)));
    }
}
function getAppRoot() {
    return dirname(FileAccess.asFileUri('').fsPath);
}
function eventuallyExit(code) {
    setTimeout(() => process.exit(code), 0);
}
main(process.argv)
    .then(() => eventuallyExit(0))
    .then(null, err => {
    console.error(err.message || err.stack || err);
    eventuallyExit(1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2NvZGUvbm9kZS9jbGkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFnQixLQUFLLEVBQThCLE1BQU0sZUFBZSxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLFVBQVUsRUFBRSxNQUFNLElBQUksQ0FBQztBQUM3RixPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFFOUMsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ25ELE9BQU8sRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUMvRSxPQUFPLEVBQXVCLFdBQVcsRUFBRSxTQUFTLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUM1RixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDeEQsT0FBTyxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUNwRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDeEQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sOERBQThELENBQUM7QUFFakcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLGlCQUFpQixFQUFFLG1CQUFtQixFQUFFLG1CQUFtQixFQUFFLE9BQU8sRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2pKLE9BQU8sRUFBRSxNQUFNLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUM1RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsa0JBQWtCLEVBQUUsYUFBYSxFQUFFLGlCQUFpQixF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