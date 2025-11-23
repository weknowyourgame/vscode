/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var LifecycleMainService_1;
import electron from 'electron';
import { validatedIpcMain } from '../../../base/parts/ipc/electron-main/ipcMain.js';
import { Barrier, Promises, timeout } from '../../../base/common/async.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../base/common/lifecycle.js';
import { isMacintosh, isWindows } from '../../../base/common/platform.js';
import { cwd } from '../../../base/common/process.js';
import { assertReturnsDefined } from '../../../base/common/types.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ILogService } from '../../log/common/log.js';
import { IStateService } from '../../state/node/state.js';
import { IEnvironmentMainService } from '../../environment/electron-main/environmentMainService.js';
import { getAllWindowsExcludingOffscreen } from '../../windows/electron-main/windows.js';
export const ILifecycleMainService = createDecorator('lifecycleMainService');
export var ShutdownReason;
(function (ShutdownReason) {
    /**
     * The application exits normally.
     */
    ShutdownReason[ShutdownReason["QUIT"] = 1] = "QUIT";
    /**
     * The application exits abnormally and is being
     * killed with an exit code (e.g. from integration
     * test run)
     */
    ShutdownReason[ShutdownReason["KILL"] = 2] = "KILL";
})(ShutdownReason || (ShutdownReason = {}));
export var LifecycleMainPhase;
(function (LifecycleMainPhase) {
    /**
     * The first phase signals that we are about to startup.
     */
    LifecycleMainPhase[LifecycleMainPhase["Starting"] = 1] = "Starting";
    /**
     * Services are ready and first window is about to open.
     */
    LifecycleMainPhase[LifecycleMainPhase["Ready"] = 2] = "Ready";
    /**
     * This phase signals a point in time after the window has opened
     * and is typically the best place to do work that is not required
     * for the window to open.
     */
    LifecycleMainPhase[LifecycleMainPhase["AfterWindowOpen"] = 3] = "AfterWindowOpen";
    /**
     * The last phase after a window has opened and some time has passed
     * (2-5 seconds).
     */
    LifecycleMainPhase[LifecycleMainPhase["Eventually"] = 4] = "Eventually";
})(LifecycleMainPhase || (LifecycleMainPhase = {}));
let LifecycleMainService = class LifecycleMainService extends Disposable {
    static { LifecycleMainService_1 = this; }
    static { this.QUIT_AND_RESTART_KEY = 'lifecycle.quitAndRestart'; }
    get quitRequested() { return this._quitRequested; }
    get wasRestarted() { return this._wasRestarted; }
    get phase() { return this._phase; }
    constructor(logService, stateService, environmentMainService) {
        super();
        this.logService = logService;
        this.stateService = stateService;
        this.environmentMainService = environmentMainService;
        this._onBeforeShutdown = this._register(new Emitter());
        this.onBeforeShutdown = this._onBeforeShutdown.event;
        this._onWillShutdown = this._register(new Emitter());
        this.onWillShutdown = this._onWillShutdown.event;
        this._onWillLoadWindow = this._register(new Emitter());
        this.onWillLoadWindow = this._onWillLoadWindow.event;
        this._onBeforeCloseWindow = this._register(new Emitter());
        this.onBeforeCloseWindow = this._onBeforeCloseWindow.event;
        this._quitRequested = false;
        this._wasRestarted = false;
        this._phase = 1 /* LifecycleMainPhase.Starting */;
        this.windowToCloseRequest = new Set();
        this.oneTimeListenerTokenGenerator = 0;
        this.windowCounter = 0;
        this.pendingQuitPromise = undefined;
        this.pendingQuitPromiseResolve = undefined;
        this.pendingWillShutdownPromise = undefined;
        this.mapWindowIdToPendingUnload = new Map();
        this.phaseWhen = new Map();
        this.relaunchHandler = undefined;
        this.resolveRestarted();
        this.when(2 /* LifecycleMainPhase.Ready */).then(() => this.registerListeners());
    }
    resolveRestarted() {
        this._wasRestarted = !!this.stateService.getItem(LifecycleMainService_1.QUIT_AND_RESTART_KEY);
        if (this._wasRestarted) {
            // remove the marker right after if found
            this.stateService.removeItem(LifecycleMainService_1.QUIT_AND_RESTART_KEY);
        }
    }
    registerListeners() {
        // before-quit: an event that is fired if application quit was
        // requested but before any window was closed.
        const beforeQuitListener = () => {
            if (this._quitRequested) {
                return;
            }
            this.trace('Lifecycle#app.on(before-quit)');
            this._quitRequested = true;
            // Emit event to indicate that we are about to shutdown
            this.trace('Lifecycle#onBeforeShutdown.fire()');
            this._onBeforeShutdown.fire();
            // macOS: can run without any window open. in that case we fire
            // the onWillShutdown() event directly because there is no veto
            // to be expected.
            if (isMacintosh && this.windowCounter === 0) {
                this.fireOnWillShutdown(1 /* ShutdownReason.QUIT */);
            }
        };
        electron.app.addListener('before-quit', beforeQuitListener);
        // window-all-closed: an event that only fires when the last window
        // was closed. We override this event to be in charge if app.quit()
        // should be called or not.
        const windowAllClosedListener = () => {
            this.trace('Lifecycle#app.on(window-all-closed)');
            // Windows/Linux: we quit when all windows have closed
            // Mac: we only quit when quit was requested
            if (this._quitRequested || !isMacintosh) {
                electron.app.quit();
            }
        };
        electron.app.addListener('window-all-closed', windowAllClosedListener);
        // will-quit: an event that is fired after all windows have been
        // closed, but before actually quitting.
        electron.app.once('will-quit', e => {
            this.trace('Lifecycle#app.on(will-quit) - begin');
            // Prevent the quit until the shutdown promise was resolved
            e.preventDefault();
            // Start shutdown sequence
            const shutdownPromise = this.fireOnWillShutdown(1 /* ShutdownReason.QUIT */);
            // Wait until shutdown is signaled to be complete
            shutdownPromise.finally(() => {
                this.trace('Lifecycle#app.on(will-quit) - after fireOnWillShutdown');
                // Resolve pending quit promise now without veto
                this.resolvePendingQuitPromise(false /* no veto */);
                // Quit again, this time do not prevent this, since our
                // will-quit listener is only installed "once". Also
                // remove any listener we have that is no longer needed
                electron.app.removeListener('before-quit', beforeQuitListener);
                electron.app.removeListener('window-all-closed', windowAllClosedListener);
                this.trace('Lifecycle#app.on(will-quit) - calling app.quit()');
                electron.app.quit();
            });
        });
    }
    fireOnWillShutdown(reason) {
        if (this.pendingWillShutdownPromise) {
            return this.pendingWillShutdownPromise; // shutdown is already running
        }
        const logService = this.logService;
        this.trace('Lifecycle#onWillShutdown.fire()');
        const joiners = [];
        this._onWillShutdown.fire({
            reason,
            join(id, promise) {
                logService.trace(`Lifecycle#onWillShutdown - begin '${id}'`);
                joiners.push(promise.finally(() => {
                    logService.trace(`Lifecycle#onWillShutdown - end '${id}'`);
                }));
            }
        });
        this.pendingWillShutdownPromise = (async () => {
            // Settle all shutdown event joiners
            try {
                await Promises.settled(joiners);
            }
            catch (error) {
                this.logService.error(error);
            }
            // Then, always make sure at the end
            // the state service is flushed.
            try {
                await this.stateService.close();
            }
            catch (error) {
                this.logService.error(error);
            }
        })();
        return this.pendingWillShutdownPromise;
    }
    set phase(value) {
        if (value < this.phase) {
            throw new Error('Lifecycle cannot go backwards');
        }
        if (this._phase === value) {
            return;
        }
        this.trace(`lifecycle (main): phase changed (value: ${value})`);
        this._phase = value;
        const barrier = this.phaseWhen.get(this._phase);
        if (barrier) {
            barrier.open();
            this.phaseWhen.delete(this._phase);
        }
    }
    async when(phase) {
        if (phase <= this._phase) {
            return;
        }
        let barrier = this.phaseWhen.get(phase);
        if (!barrier) {
            barrier = new Barrier();
            this.phaseWhen.set(phase, barrier);
        }
        await barrier.wait();
    }
    registerWindow(window) {
        const windowListeners = new DisposableStore();
        // track window count
        this.windowCounter++;
        // Window Will Load
        windowListeners.add(window.onWillLoad(e => this._onWillLoadWindow.fire({ window, workspace: e.workspace, reason: e.reason })));
        // Window Before Closing: Main -> Renderer
        const win = assertReturnsDefined(window.win);
        windowListeners.add(Event.fromNodeEventEmitter(win, 'close')(e => {
            // The window already acknowledged to be closed
            const windowId = window.id;
            if (this.windowToCloseRequest.delete(windowId)) {
                return;
            }
            this.trace(`Lifecycle#window.on('close') - window ID ${window.id}`);
            // Otherwise prevent unload and handle it from window
            e.preventDefault();
            this.unload(window, 1 /* UnloadReason.CLOSE */).then(veto => {
                if (veto) {
                    this.windowToCloseRequest.delete(windowId);
                    return;
                }
                this.windowToCloseRequest.add(windowId);
                // Fire onBeforeCloseWindow before actually closing
                this.trace(`Lifecycle#onBeforeCloseWindow.fire() - window ID ${windowId}`);
                this._onBeforeCloseWindow.fire(window);
                // No veto, close window now
                window.close();
            });
        }));
        windowListeners.add(Event.fromNodeEventEmitter(win, 'closed')(() => {
            this.trace(`Lifecycle#window.on('closed') - window ID ${window.id}`);
            // update window count
            this.windowCounter--;
            // clear window listeners
            windowListeners.dispose();
            // if there are no more code windows opened, fire the onWillShutdown event, unless
            // we are on macOS where it is perfectly fine to close the last window and
            // the application continues running (unless quit was actually requested)
            if (this.windowCounter === 0 && (!isMacintosh || this._quitRequested)) {
                this.fireOnWillShutdown(1 /* ShutdownReason.QUIT */);
            }
        }));
    }
    registerAuxWindow(auxWindow) {
        const win = assertReturnsDefined(auxWindow.win);
        const windowListeners = new DisposableStore();
        windowListeners.add(Event.fromNodeEventEmitter(win, 'close')(e => {
            this.trace(`Lifecycle#auxWindow.on('close') - window ID ${auxWindow.id}`);
            if (this._quitRequested) {
                this.trace(`Lifecycle#auxWindow.on('close') - preventDefault() because quit requested`);
                // When quit is requested, Electron will close all
                // auxiliary windows before closing the main windows.
                // This prevents us from storing the auxiliary window
                // state on shutdown and thus we prevent closing if
                // quit is requested.
                //
                // Interestingly, this will not prevent the application
                // from quitting because the auxiliary windows will still
                // close once the owning window closes.
                e.preventDefault();
            }
        }));
        windowListeners.add(Event.fromNodeEventEmitter(win, 'closed')(() => {
            this.trace(`Lifecycle#auxWindow.on('closed') - window ID ${auxWindow.id}`);
            windowListeners.dispose();
        }));
    }
    async reload(window, cli) {
        // Only reload when the window has not vetoed this
        const veto = await this.unload(window, 3 /* UnloadReason.RELOAD */);
        if (!veto) {
            window.reload(cli);
        }
    }
    unload(window, reason) {
        // Ensure there is only 1 unload running at the same time
        const pendingUnloadPromise = this.mapWindowIdToPendingUnload.get(window.id);
        if (pendingUnloadPromise) {
            return pendingUnloadPromise;
        }
        // Start unload and remember in map until finished
        const unloadPromise = this.doUnload(window, reason).finally(() => {
            this.mapWindowIdToPendingUnload.delete(window.id);
        });
        this.mapWindowIdToPendingUnload.set(window.id, unloadPromise);
        return unloadPromise;
    }
    async doUnload(window, reason) {
        // Always allow to unload a window that is not yet ready
        if (!window.isReady) {
            return false;
        }
        this.trace(`Lifecycle#unload() - window ID ${window.id}`);
        // first ask the window itself if it vetos the unload
        const windowUnloadReason = this._quitRequested ? 2 /* UnloadReason.QUIT */ : reason;
        const veto = await this.onBeforeUnloadWindowInRenderer(window, windowUnloadReason);
        if (veto) {
            this.trace(`Lifecycle#unload() - veto in renderer (window ID ${window.id})`);
            return this.handleWindowUnloadVeto(veto);
        }
        // finally if there are no vetos, unload the renderer
        await this.onWillUnloadWindowInRenderer(window, windowUnloadReason);
        return false;
    }
    handleWindowUnloadVeto(veto) {
        if (!veto) {
            return false; // no veto
        }
        // a veto resolves any pending quit with veto
        this.resolvePendingQuitPromise(true /* veto */);
        // a veto resets the pending quit request flag
        this._quitRequested = false;
        return true; // veto
    }
    resolvePendingQuitPromise(veto) {
        if (this.pendingQuitPromiseResolve) {
            this.pendingQuitPromiseResolve(veto);
            this.pendingQuitPromiseResolve = undefined;
            this.pendingQuitPromise = undefined;
        }
    }
    onBeforeUnloadWindowInRenderer(window, reason) {
        return new Promise(resolve => {
            const oneTimeEventToken = this.oneTimeListenerTokenGenerator++;
            const okChannel = `vscode:ok${oneTimeEventToken}`;
            const cancelChannel = `vscode:cancel${oneTimeEventToken}`;
            validatedIpcMain.once(okChannel, () => {
                resolve(false); // no veto
            });
            validatedIpcMain.once(cancelChannel, () => {
                resolve(true); // veto
            });
            window.send('vscode:onBeforeUnload', { okChannel, cancelChannel, reason });
        });
    }
    onWillUnloadWindowInRenderer(window, reason) {
        return new Promise(resolve => {
            const oneTimeEventToken = this.oneTimeListenerTokenGenerator++;
            const replyChannel = `vscode:reply${oneTimeEventToken}`;
            validatedIpcMain.once(replyChannel, () => resolve());
            window.send('vscode:onWillUnload', { replyChannel, reason });
        });
    }
    quit(willRestart) {
        return this.doQuit(willRestart).then(veto => {
            if (!veto && willRestart) {
                // Windows: we are about to restart and as such we need to restore the original
                // current working directory we had on startup to get the exact same startup
                // behaviour. As such, we briefly change back to that directory and then when
                // Code starts it will set it back to the installation directory again.
                try {
                    if (isWindows) {
                        const currentWorkingDir = cwd();
                        if (currentWorkingDir !== process.cwd()) {
                            process.chdir(currentWorkingDir);
                        }
                    }
                }
                catch (err) {
                    this.logService.error(err);
                }
            }
            return veto;
        });
    }
    doQuit(willRestart) {
        this.trace(`Lifecycle#quit() - begin (willRestart: ${willRestart})`);
        if (this.pendingQuitPromise) {
            this.trace('Lifecycle#quit() - returning pending quit promise');
            return this.pendingQuitPromise;
        }
        // Remember if we are about to restart
        if (willRestart) {
            this.stateService.setItem(LifecycleMainService_1.QUIT_AND_RESTART_KEY, true);
        }
        this.pendingQuitPromise = new Promise(resolve => {
            // Store as field to access it from a window cancellation
            this.pendingQuitPromiseResolve = resolve;
            // Calling app.quit() will trigger the close handlers of each opened window
            // and only if no window vetoed the shutdown, we will get the will-quit event
            this.trace('Lifecycle#quit() - calling app.quit()');
            electron.app.quit();
        });
        return this.pendingQuitPromise;
    }
    trace(msg) {
        if (this.environmentMainService.args['enable-smoke-test-driver']) {
            this.logService.info(msg); // helps diagnose issues with exiting from smoke tests
        }
        else {
            this.logService.trace(msg);
        }
    }
    setRelaunchHandler(handler) {
        this.relaunchHandler = handler;
    }
    async relaunch(options) {
        this.trace('Lifecycle#relaunch()');
        const args = process.argv.slice(1);
        if (options?.addArgs) {
            args.push(...options.addArgs);
        }
        if (options?.removeArgs) {
            for (const a of options.removeArgs) {
                const idx = args.indexOf(a);
                if (idx >= 0) {
                    args.splice(idx, 1);
                }
            }
        }
        const quitListener = () => {
            if (!this.relaunchHandler?.handleRelaunch(options)) {
                this.trace('Lifecycle#relaunch() - calling app.relaunch()');
                electron.app.relaunch({ args });
            }
        };
        electron.app.once('quit', quitListener);
        // `app.relaunch()` does not quit automatically, so we quit first,
        // check for vetoes and then relaunch from the `app.on('quit')` event
        const veto = await this.quit(true /* will restart */);
        if (veto) {
            electron.app.removeListener('quit', quitListener);
        }
    }
    async kill(code) {
        this.trace('Lifecycle#kill()');
        // Give main process participants a chance to orderly shutdown
        await this.fireOnWillShutdown(2 /* ShutdownReason.KILL */);
        // From extension tests we have seen issues where calling app.exit()
        // with an opened window can lead to native crashes (Linux). As such,
        // we should make sure to destroy any opened window before calling
        // `app.exit()`.
        //
        // Note: Electron implements a similar logic here:
        // https://github.com/electron/electron/blob/fe5318d753637c3903e23fc1ed1b263025887b6a/spec-main/window-helpers.ts#L5
        await Promise.race([
            // Still do not block more than 1s
            timeout(1000),
            // Destroy any opened window: we do not unload windows here because
            // there is a chance that the unload is veto'd or long running due
            // to a participant within the window. this is not wanted when we
            // are asked to kill the application.
            (async () => {
                for (const window of getAllWindowsExcludingOffscreen()) {
                    if (window && !window.isDestroyed()) {
                        let whenWindowClosed;
                        if (window.webContents && !window.webContents.isDestroyed()) {
                            whenWindowClosed = new Promise(resolve => window.once('closed', resolve));
                        }
                        else {
                            whenWindowClosed = Promise.resolve();
                        }
                        window.destroy();
                        await whenWindowClosed;
                    }
                }
            })()
        ]);
        // Now exit either after 1s or all windows destroyed
        electron.app.exit(code);
    }
};
LifecycleMainService = LifecycleMainService_1 = __decorate([
    __param(0, ILogService),
    __param(1, IStateService),
    __param(2, IEnvironmentMainService)
], LifecycleMainService);
export { LifecycleMainService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlmZWN5Y2xlTWFpblNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vbGlmZWN5Y2xlL2VsZWN0cm9uLW1haW4vbGlmZWN5Y2xlTWFpblNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sUUFBUSxNQUFNLFVBQVUsQ0FBQztBQUNoQyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNwRixPQUFPLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMzRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEYsT0FBTyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMxRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdEQsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFckUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFHMUQsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFFcEcsT0FBTyxFQUFFLCtCQUErQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFekYsTUFBTSxDQUFDLE1BQU0scUJBQXFCLEdBQUcsZUFBZSxDQUF3QixzQkFBc0IsQ0FBQyxDQUFDO0FBb0JwRyxNQUFNLENBQU4sSUFB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