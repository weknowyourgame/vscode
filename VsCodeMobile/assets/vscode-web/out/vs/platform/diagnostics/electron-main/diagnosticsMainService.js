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
import { app } from 'electron';
import { validatedIpcMain } from '../../../base/parts/ipc/electron-main/ipcMain.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { getAllWindowsExcludingOffscreen, IWindowsMainService } from '../../windows/electron-main/windows.js';
import { isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier } from '../../workspace/common/workspace.js';
import { IWorkspacesManagementMainService } from '../../workspaces/electron-main/workspacesManagementMainService.js';
import { assertReturnsDefined } from '../../../base/common/types.js';
import { ILogService } from '../../log/common/log.js';
import { UtilityProcess } from '../../utilityProcess/electron-main/utilityProcess.js';
export const ID = 'diagnosticsMainService';
export const IDiagnosticsMainService = createDecorator(ID);
let DiagnosticsMainService = class DiagnosticsMainService {
    constructor(windowsMainService, workspacesManagementMainService, logService) {
        this.windowsMainService = windowsMainService;
        this.workspacesManagementMainService = workspacesManagementMainService;
        this.logService = logService;
    }
    async getRemoteDiagnostics(options) {
        const windows = this.windowsMainService.getWindows();
        const diagnostics = await Promise.all(windows.map(async (window) => {
            const remoteAuthority = window.remoteAuthority;
            if (!remoteAuthority) {
                return undefined;
            }
            const replyChannel = `vscode:getDiagnosticInfoResponse${window.id}`;
            const args = {
                includeProcesses: options.includeProcesses,
                folders: options.includeWorkspaceMetadata ? await this.getFolderURIs(window) : undefined
            };
            return new Promise(resolve => {
                window.sendWhenReady('vscode:getDiagnosticInfo', CancellationToken.None, { replyChannel, args });
                validatedIpcMain.once(replyChannel, (_, data) => {
                    // No data is returned if getting the connection fails.
                    if (!data) {
                        resolve({ hostName: remoteAuthority, errorMessage: `Unable to resolve connection to '${remoteAuthority}'.` });
                    }
                    resolve(data);
                });
                setTimeout(() => {
                    resolve({ hostName: remoteAuthority, errorMessage: `Connection to '${remoteAuthority}' could not be established` });
                }, 5000);
            });
        }));
        return diagnostics.filter((x) => !!x);
    }
    async getMainDiagnostics() {
        this.logService.trace('Received request for main process info from other instance.');
        const windows = [];
        for (const window of getAllWindowsExcludingOffscreen()) {
            const codeWindow = this.windowsMainService.getWindowById(window.id);
            if (codeWindow) {
                windows.push(await this.codeWindowToInfo(codeWindow));
            }
            else {
                windows.push(this.browserWindowToInfo(window));
            }
        }
        const pidToNames = [];
        for (const { pid, name } of UtilityProcess.getAll()) {
            pidToNames.push({ pid, name });
        }
        return {
            mainPID: process.pid,
            mainArguments: process.argv.slice(1),
            windows,
            pidToNames,
            screenReader: !!app.accessibilitySupportEnabled,
            gpuFeatureStatus: app.getGPUFeatureStatus()
        };
    }
    async codeWindowToInfo(window) {
        const folderURIs = await this.getFolderURIs(window);
        const win = assertReturnsDefined(window.win);
        return this.browserWindowToInfo(win, folderURIs, window.remoteAuthority);
    }
    browserWindowToInfo(window, folderURIs = [], remoteAuthority) {
        return {
            id: window.id,
            pid: window.webContents.getOSProcessId(),
            title: window.getTitle(),
            folderURIs,
            remoteAuthority
        };
    }
    async getFolderURIs(window) {
        const folderURIs = [];
        const workspace = window.openedWorkspace;
        if (isSingleFolderWorkspaceIdentifier(workspace)) {
            folderURIs.push(workspace.uri);
        }
        else if (isWorkspaceIdentifier(workspace)) {
            const resolvedWorkspace = await this.workspacesManagementMainService.resolveLocalWorkspace(workspace.configPath); // workspace folders can only be shown for local (resolved) workspaces
            if (resolvedWorkspace) {
                const rootFolders = resolvedWorkspace.folders;
                rootFolders.forEach(root => {
                    folderURIs.push(root.uri);
                });
            }
        }
        return folderURIs;
    }
};
DiagnosticsMainService = __decorate([
    __param(0, IWindowsMainService),
    __param(1, IWorkspacesManagementMainService),
    __param(2, ILogService)
], DiagnosticsMainService);
export { DiagnosticsMainService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhZ25vc3RpY3NNYWluU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9kaWFnbm9zdGljcy9lbGVjdHJvbi1tYWluL2RpYWdub3N0aWNzTWFpblNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLEdBQUcsRUFBb0MsTUFBTSxVQUFVLENBQUM7QUFDakUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDcEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFHekUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRTlFLE9BQU8sRUFBRSwrQkFBK0IsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQzlHLE9BQU8sRUFBRSxpQ0FBaUMsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9HLE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSxNQUFNLG1FQUFtRSxDQUFDO0FBQ3JILE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3JFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFdEYsTUFBTSxDQUFDLE1BQU0sRUFBRSxHQUFHLHdCQUF3QixDQUFDO0FBQzNDLE1BQU0sQ0FBQyxNQUFNLHVCQUF1QixHQUFHLGVBQWUsQ0FBMEIsRUFBRSxDQUFDLENBQUM7QUFhN0UsSUFBTSxzQkFBc0IsR0FBNUIsTUFBTSxzQkFBc0I7SUFJbEMsWUFDdUMsa0JBQXVDLEVBQzFCLCtCQUFpRSxFQUN0RixVQUF1QjtRQUZmLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBcUI7UUFD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