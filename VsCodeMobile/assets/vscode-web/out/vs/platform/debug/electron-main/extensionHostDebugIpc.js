/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { VSBuffer } from '../../../base/common/buffer.js';
import { DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { upgradeToISocket } from '../../../base/parts/ipc/node/ipc.net.js';
import { OPTIONS, parseArgs } from '../../environment/node/argv.js';
import { ExtensionHostDebugBroadcastChannel } from '../common/extensionHostDebugIpc.js';
export class ElectronExtensionHostDebugBroadcastChannel extends ExtensionHostDebugBroadcastChannel {
    constructor(windowsMainService) {
        super();
        this.windowsMainService = windowsMainService;
    }
    call(ctx, command, arg) {
        if (command === 'openExtensionDevelopmentHostWindow') {
            return this.openExtensionDevelopmentHostWindow(arg[0], arg[1]);
        }
        else if (command === 'attachToCurrentWindowRenderer') {
            return this.attachToCurrentWindowRenderer(arg[0]);
        }
        else {
            return super.call(ctx, command, arg);
        }
    }
    async attachToCurrentWindowRenderer(windowId) {
        const codeWindow = this.windowsMainService.getWindowById(windowId);
        if (!codeWindow?.win) {
            return { success: false };
        }
        return this.openCdp(codeWindow.win);
    }
    async openExtensionDevelopmentHostWindow(args, debugRenderer) {
        const pargs = parseArgs(args, OPTIONS);
        pargs.debugRenderer = debugRenderer;
        const extDevPaths = pargs.extensionDevelopmentPath;
        if (!extDevPaths) {
            return { success: false };
        }
        const [codeWindow] = await this.windowsMainService.openExtensionDevelopmentHostWindow(extDevPaths, {
            context: 5 /* OpenContext.API */,
            cli: pargs,
            forceProfile: pargs.profile,
            forceTempProfile: pargs['profile-temp']
        });
        if (!debugRenderer) {
            return { success: true };
        }
        const win = codeWindow.win;
        if (!win) {
            return { success: true };
        }
        return this.openCdp(win);
    }
    async openCdpServer(ident, onSocket) {
        const { createServer } = await import('http'); // Lazy due to https://github.com/nodejs/node/issues/59686
        const server = createServer((req, res) => {
            res.statusCode = 404;
            res.end();
        });
        server.on('upgrade', (req, socket) => {
            if (!req.url?.includes(ident)) {
                socket.end();
                return;
            }
            const upgraded = upgradeToISocket(req, socket, {
                debugLabel: 'extension-host-cdp-' + generateUuid(),
            });
            if (upgraded) {
                onSocket(upgraded);
            }
        });
        return server;
    }
    async openCdp(win) {
        const debug = win.webContents.debugger;
        let listeners = debug.isAttached() ? Infinity : 0;
        const ident = generateUuid();
        const server = await this.openCdpServer(ident, listener => {
            if (listeners++ === 0) {
                debug.attach();
            }
            const store = new DisposableStore();
            store.add(listener);
            const writeMessage = (message) => {
                if (!store.isDisposed) { // in case sendCommand promises settle after closed
                    listener.write(VSBuffer.fromString(JSON.stringify(message))); // null-delimited, CDP-compatible
                }
            };
            const onMessage = (_event, method, params, sessionId) => writeMessage({ method, params, sessionId });
            const onWindowClose = () => {
                listener.end();
                store.dispose();
            };
            win.addListener('close', onWindowClose);
            store.add(toDisposable(() => win.removeListener('close', onWindowClose)));
            debug.addListener('message', onMessage);
            store.add(toDisposable(() => debug.removeListener('message', onMessage)));
            store.add(listener.onData(rawData => {
                let data;
                try {
                    data = JSON.parse(rawData.toString());
                }
                catch (e) {
                    console.error('error reading cdp line', e);
                    return;
                }
                debug.sendCommand(data.method, data.params, data.sessionId)
                    .then((result) => writeMessage({ id: data.id, sessionId: data.sessionId, result }))
                    .catch((error) => writeMessage({ id: data.id, sessionId: data.sessionId, error: { code: 0, message: error.message } }));
            }));
            store.add(listener.onClose(() => {
                if (--listeners === 0) {
                    debug.detach();
                }
            }));
        });
        await new Promise(r => server.listen(0, '127.0.0.1', r));
        win.on('close', () => server.close());
        const serverAddr = server.address();
        const serverAddrBase = typeof serverAddr === 'string' ? serverAddr : `ws://127.0.0.1:${serverAddr?.port}`;
        return { rendererDebugAddr: `${serverAddrBase}/${ident}`, success: true };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uSG9zdERlYnVnSXBjLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2RlYnVnL2VsZWN0cm9uLW1haW4vZXh0ZW5zaW9uSG9zdERlYnVnSXBjLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBSWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUU1RCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBR3BFLE9BQU8sRUFBRSxrQ0FBa0MsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBRXhGLE1BQU0sT0FBTywwQ0FBcUQsU0FBUSxrQ0FBNEM7SUFFckgsWUFDUyxrQkFBdUM7UUFFL0MsS0FBSyxFQUFFLENBQUM7UUFGQSx1QkFBa0IsR0FBbEIsa0JBQWtCLENBQXFCO0lBR2hELENBQUM7SUFFUSxJQUFJLENBQUMsR0FBYSxFQUFFLE9BQWUsRUFBRSxHQUFTO1FBQ3RELElBQUksT0FBTyxLQUFLLG9DQUFvQyxFQUFFLENBQUM7WUFDdEQsT0FBTyxJQUFJLENBQUMsa0NBQWtDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2hFLENBQUM7YUFBTSxJQUFJLE9BQU8sS0FBSywrQkFBK0IsRUFBRSxDQUFDO1lBQ3hELE9BQU8sSUFBSSxDQUFDLDZCQUE2QixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ25ELENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDdEMsQ0FBQztJQUNGLENBQUM7SUFFTyxLQUFLLENBQUMsNkJBQTZCLENBQUMsUUFBZ0I7UUFDM0QsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNuRSxJQUFJLENBQUMsVUFBVSxFQUFFLEdBQUcsRUFBRSxDQUFDO1lBQ3RCLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUM7UUFDM0IsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVPLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxJQUFjLEVBQUUsYUFBc0I7UUFDdEYsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN2QyxLQUFLLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUVwQyxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsd0JBQXdCLENBQUM7UUFDbkQsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ2xCLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUM7UUFDM0IsQ0FBQztRQUVELE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxrQ0FBa0MsQ0FBQyxXQUFXLEVBQUU7WUFDbEcsT0FBTyx5QkFBaUI7WUFDeEIsR0FBRyxFQUFFLEtBQUs7WUFDVixZQUFZLEVBQUUsS0FBSyxDQUFDLE9BQU87WUFDM0IsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQztTQUN2QyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDcEIsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUMxQixDQUFDO1FBRUQsTUFBTSxHQUFHLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQztRQUMzQixJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDVixPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDO1FBQzFCLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDMUIsQ0FBQztJQUVPLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBYSxFQUFFLFFBQW1DO1FBQzdFLE1BQU0sRUFBRSxZQUFZLEVBQUUsR0FBRyxNQUFNLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLDBEQUEwRDtRQUN6RyxNQUFNLE1BQU0sR0FBRyxZQUFZLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUU7WUFDeEMsR0FBRyxDQUFDLFVBQVUsR0FBRyxHQUFHLENBQUM7WUFDckIsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ1gsQ0FBQyxDQUFDLENBQUM7UUFFSCxNQUFNLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUNwQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDL0IsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNiLE9BQU87WUFDUixDQUFDO1lBQ0QsTUFBTSxRQUFRLEdBQUcsZ0JBQWdCLENBQUMsR0FBRyxFQUFFLE1BQWdCLEVBQUU7Z0JBQ3hELFVBQVUsRUFBRSxxQkFBcUIsR0FBRyxZQUFZLEVBQUU7YUFDbEQsQ0FBQyxDQUFDO1lBRUgsSUFBSSxRQUFRLEVBQUUsQ0FBQztnQkFDZCxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDcEIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBRU8sS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFrQjtRQUN2QyxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQztRQUV2QyxJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xELE1BQU0sS0FBSyxHQUFHLFlBQVksRUFBRSxDQUFDO1FBQzdCLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLEVBQUU7WUFDekQsSUFBSSxTQUFTLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDdkIsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2hCLENBQUM7WUFFRCxNQUFNLEtBQUssR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1lBQ3BDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7WUFFcEIsTUFBTSxZQUFZLEdBQUcsQ0FBQyxPQUFlLEVBQUUsRUFBRTtnQkFDeEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLG1EQUFtRDtvQkFDM0UsUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsaUNBQWlDO2dCQUNoRyxDQUFDO1lBQ0YsQ0FBQyxDQUFDO1lBRUYsTUFBTSxTQUFTLEdBQUcsQ0FBQyxNQUFzQixFQUFFLE1BQWMsRUFBRSxNQUFlLEVBQUUsU0FBa0IsRUFBRSxFQUFFLENBQ2pHLFlBQVksQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztZQUU3QyxNQUFNLGFBQWEsR0FBRyxHQUFHLEVBQUU7Z0JBQzFCLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDZixLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDakIsQ0FBQyxDQUFDO1lBRUYsR0FBRyxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFDeEMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRTFFLEtBQUssQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ3hDLEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUUxRSxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQ25DLElBQUksSUFBbUUsQ0FBQztnQkFDeEUsSUFBSSxDQUFDO29CQUNKLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO2dCQUN2QyxDQUFDO2dCQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7b0JBQ1osT0FBTyxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDM0MsT0FBTztnQkFDUixDQUFDO2dCQUVELEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7cUJBQ3pELElBQUksQ0FBQyxDQUFDLE1BQWMsRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztxQkFDMUYsS0FBSyxDQUFDLENBQUMsS0FBWSxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDakksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUVKLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUU7Z0JBQy9CLElBQUksRUFBRSxTQUFTLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ3ZCLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDaEIsQ0FBQztZQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sSUFBSSxPQUFPLENBQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvRCxHQUFHLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUV0QyxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDcEMsTUFBTSxjQUFjLEdBQUcsT0FBTyxVQUFVLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixVQUFVLEVBQUUsSUFBSSxFQUFFLENBQUM7UUFDMUcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLEdBQUcsY0FBYyxJQUFJLEtBQUssRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQztJQUMzRSxDQUFDO0NBQ0QifQ==