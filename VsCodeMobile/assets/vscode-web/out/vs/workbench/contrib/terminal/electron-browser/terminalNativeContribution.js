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
import { ipcRenderer } from '../../../../base/parts/sandbox/electron-browser/globals.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { registerRemoteContributions } from './terminalRemote.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { INativeHostService } from '../../../../platform/native/common/native.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ITerminalService } from '../browser/terminal.js';
import { disposableWindowInterval, getActiveWindow } from '../../../../base/browser/dom.js';
let TerminalNativeContribution = class TerminalNativeContribution extends Disposable {
    constructor(_fileService, _terminalService, remoteAgentService, nativeHostService) {
        super();
        this._fileService = _fileService;
        this._terminalService = _terminalService;
        ipcRenderer.on('vscode:openFiles', (_, ...args) => { this._onOpenFileRequest(args[0]); });
        this._register(nativeHostService.onDidResumeOS(() => this._onOsResume()));
        this._terminalService.setNativeDelegate({
            getWindowCount: () => nativeHostService.getWindowCount()
        });
        const connection = remoteAgentService.getConnection();
        if (connection && connection.remoteAuthority) {
            registerRemoteContributions();
        }
    }
    _onOsResume() {
        for (const instance of this._terminalService.instances) {
            instance.xterm?.forceRedraw();
        }
    }
    async _onOpenFileRequest(request) {
        // if the request to open files is coming in from the integrated terminal (identified though
        // the termProgram variable) and we are instructed to wait for editors close, wait for the
        // marker file to get deleted and then focus back to the integrated terminal.
        if (request.termProgram === 'vscode' && request.filesToWait) {
            const waitMarkerFileUri = URI.revive(request.filesToWait.waitMarkerFileUri);
            await this._whenFileDeleted(waitMarkerFileUri);
            // Focus active terminal
            this._terminalService.activeInstance?.focus();
        }
    }
    _whenFileDeleted(path) {
        // Complete when wait marker file is deleted
        return new Promise(resolve => {
            let running = false;
            const interval = disposableWindowInterval(getActiveWindow(), async () => {
                if (!running) {
                    running = true;
                    const exists = await this._fileService.exists(path);
                    running = false;
                    if (!exists) {
                        interval.dispose();
                        resolve(undefined);
                    }
                }
            }, 1000);
        });
    }
};
TerminalNativeContribution = __decorate([
    __param(0, IFileService),
    __param(1, ITerminalService),
    __param(2, IRemoteAgentService),
    __param(3, INativeHostService)
], TerminalNativeContribution);
export { TerminalNativeContribution };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxOYXRpdmVDb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWwvZWxlY3Ryb24tYnJvd3Nlci90ZXJtaW5hbE5hdGl2ZUNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFFekYsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNsRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUM1RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNsRixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFFMUQsT0FBTyxFQUFFLHdCQUF3QixFQUFFLGVBQWUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRXJGLElBQU0sMEJBQTBCLEdBQWhDLE1BQU0sMEJBQTJCLFNBQVEsVUFBVTtJQUd6RCxZQUNnQyxZQUEwQixFQUN0QixnQkFBa0MsRUFDaEQsa0JBQXVDLEVBQ3hDLGlCQUFxQztRQUV6RCxLQUFLLEVBQUUsQ0FBQztRQUx1QixpQkFBWSxHQUFaLFlBQVksQ0FBYztRQUN0QixxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQWtCO1FBTXJFLFdBQVcsQ0FBQyxFQUFFLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFVLEVBQUUsR0FBRyxJQUFlLEVBQUUsRUFBRSxH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