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
import { listProcesses } from '../../../base/node/ps.js';
import { localize } from '../../../nls.js';
import { IDiagnosticsService, isRemoteDiagnosticError } from '../../diagnostics/common/diagnostics.js';
import { IDiagnosticsMainService } from '../../diagnostics/electron-main/diagnosticsMainService.js';
import { ILogService } from '../../log/common/log.js';
import { UtilityProcess } from '../../utilityProcess/electron-main/utilityProcess.js';
let ProcessMainService = class ProcessMainService {
    constructor(logService, diagnosticsService, diagnosticsMainService) {
        this.logService = logService;
        this.diagnosticsService = diagnosticsService;
        this.diagnosticsMainService = diagnosticsMainService;
    }
    async resolveProcesses() {
        const mainProcessInfo = await this.diagnosticsMainService.getMainDiagnostics();
        const pidToNames = [];
        for (const window of mainProcessInfo.windows) {
            pidToNames.push([window.pid, `window [${window.id}] (${window.title})`]);
        }
        for (const { pid, name } of UtilityProcess.getAll()) {
            pidToNames.push([pid, name]);
        }
        const processes = [];
        try {
            processes.push({ name: localize('local', "Local"), rootProcess: await listProcesses(process.pid) });
            const remoteDiagnostics = await this.diagnosticsMainService.getRemoteDiagnostics({ includeProcesses: true });
            remoteDiagnostics.forEach(data => {
                if (isRemoteDiagnosticError(data)) {
                    processes.push({
                        name: data.hostName,
                        rootProcess: data
                    });
                }
                else {
                    if (data.processes) {
                        processes.push({
                            name: data.hostName,
                            rootProcess: data.processes
                        });
                    }
                }
            });
        }
        catch (e) {
            this.logService.error(`Listing processes failed: ${e}`);
        }
        return { pidToNames, processes };
    }
    async getSystemStatus() {
        const [info, remoteData] = await Promise.all([this.diagnosticsMainService.getMainDiagnostics(), this.diagnosticsMainService.getRemoteDiagnostics({ includeProcesses: false, includeWorkspaceMetadata: false })]);
        return this.diagnosticsService.getDiagnostics(info, remoteData);
    }
    async getSystemInfo() {
        const [info, remoteData] = await Promise.all([this.diagnosticsMainService.getMainDiagnostics(), this.diagnosticsMainService.getRemoteDiagnostics({ includeProcesses: false, includeWorkspaceMetadata: false })]);
        const msg = await this.diagnosticsService.getSystemInfo(info, remoteData);
        return msg;
    }
    async getPerformanceInfo() {
        try {
            const [info, remoteData] = await Promise.all([this.diagnosticsMainService.getMainDiagnostics(), this.diagnosticsMainService.getRemoteDiagnostics({ includeProcesses: true, includeWorkspaceMetadata: true })]);
            return await this.diagnosticsService.getPerformanceInfo(info, remoteData);
        }
        catch (error) {
            this.logService.warn('issueService#getPerformanceInfo ', error.message);
            throw error;
        }
    }
};
ProcessMainService = __decorate([
    __param(0, ILogService),
    __param(1, IDiagnosticsService),
    __param(2, IDiagnosticsMainService)
], ProcessMainService);
export { ProcessMainService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzc01haW5TZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3Byb2Nlc3MvZWxlY3Ryb24tbWFpbi9wcm9jZXNzTWFpblNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3pELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMzQyxPQUFPLEVBQUUsbUJBQW1CLEVBQTBCLHVCQUF1QixFQUErQixNQUFNLHlDQUF5QyxDQUFDO0FBQzVKLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBRXBHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFHL0UsSUFBTSxrQkFBa0IsR0FBeEIsTUFBTSxrQkFBa0I7SUFJOUIsWUFDK0IsVUFBdUIsRUFDZixrQkFBdUMsRUFDbkMsc0JBQStDO1FBRjNELGVBQVUsR0FBVixVQUFVLENBQWE7UUFDZix1QkFBa0IsR0FBbEIsa0JBQWtCLENBQXFCO1FBQ25DLDJCQUFzQixHQUF0QixzQkFBc0IsQ0FBeUI7SUFFMUYsQ0FBQztJQUVELEtBQUssQ0FBQyxnQkFBZ0I7UUFDckIsTUFBTSxlQUFlLEdBQUcsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUUvRSxNQUFNLFVBQVUsR0FBdUIsRUFBRSxDQUFDO1FBQzFDLEtBQUssTUFBTSxNQUFNLElBQUksZUFBZSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQzlDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLFdBQVcsTUFBTSxDQUFDLEVBQUUsTUFBTSxNQUFNLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzFFLENBQUM7UUFFRCxLQUFLLE1BQU0sRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLElBQUksY0FBYyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUM7WUFDckQsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQzlCLENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBMEUsRUFBRSxDQUFDO1FBQzVGLElBQUksQ0FBQztZQUNKLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsRUFBRSxXQUFXLEVBQUUsTUFBTSxhQUFhLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUVwRyxNQUFNLGlCQUFpQixHQUFHLE1BQU0sSUFBSSxDQUFDLHNCQUFzQixDQUFDLG9CQUFvQixDQUFDLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUM3RyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ2hDLElBQUksdUJBQXVCLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztvQkFDbkMsU0FBUyxDQUFDLElBQUksQ0FBQzt3QkFDZCxJQUFJLEVBQUUsSUFBSSxDQUFDLFFBQVE7d0JBQ25CLFdBQVcsRUFBRSxJQUFJO3FCQUNqQixDQUFDLENBQUM7Z0JBQ0osQ0FBQztxQkFBTSxDQUFDO29CQUNQLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO3dCQUNwQixTQUFTLENBQUMsSUFBSSxDQUFDOzRCQUNkLElBQUksRUFBRSxJQUFJLENBQUMsUUFBUTs0QkFDbkIsV0FBVyxFQUFFLElBQUksQ0FBQyxTQUFTO3lCQUMzQixDQUFDLENBQUM7b0JBQ0osQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNaLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLDZCQUE2QixDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3pELENBQUM7UUFFRCxPQUFPLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxDQUFDO0lBQ2xDLENBQUM7SUFFRCxLQUFLLENBQUMsZUFBZTtRQUNwQixNQUFNLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLGdCQUFnQixFQUFFLEtBQUssRUFBRSx3QkFBd0IsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVqTixPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFFRCxLQUFLLENBQUMsYUFBYTtRQUNsQixNQUFNLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxHQUFHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLGdCQUFnQixFQUFFLEtBQUssRUFBRSx3QkFBd0IsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNqTixNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBRTFFLE9BQU8sR0FBRyxDQUFDO0lBQ1osQ0FBQztJQUVELEtBQUssQ0FBQyxrQkFBa0I7UUFDdkIsSUFBSSxDQUFDO1lBQ0osTUFBTSxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxJQUFJLENBQUMsc0JBQXNCLENBQUMsb0JBQW9CLENBQUMsRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsd0JBQXdCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDL00sT0FBTyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDM0UsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsa0NBQWtDLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBRXhFLE1BQU0sS0FBSyxDQUFDO1FBQ2IsQ0FBQztJQUNGLENBQUM7Q0FDRCxDQUFBO0FBekVZLGtCQUFrQjtJQUs1QixXQUFBLFdBQVcsQ0FBQTtJQUNYLFdBQUEsbUJBQW1CLENBQUE7SUFDbkIsV0FBQSx1QkFBdUIsQ0FBQTtHQVBiLGtCQUFrQixDQXlFOUIifQ==