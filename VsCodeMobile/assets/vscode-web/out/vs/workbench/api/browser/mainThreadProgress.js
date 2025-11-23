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
var MainThreadProgress_1;
import { IProgressService } from '../../../platform/progress/common/progress.js';
import { MainContext, ExtHostContext } from '../common/extHost.protocol.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { ICommandService } from '../../../platform/commands/common/commands.js';
import { localize } from '../../../nls.js';
import { onUnexpectedExternalError } from '../../../base/common/errors.js';
import { toAction } from '../../../base/common/actions.js';
import { NotificationPriority } from '../../../platform/notification/common/notification.js';
let MainThreadProgress = class MainThreadProgress {
    static { MainThreadProgress_1 = this; }
    static { this.URGENT_PROGRESS_SOURCES = [
        'vscode.github-authentication',
        'vscode.microsoft-authentication'
    ]; }
    constructor(extHostContext, progressService, _commandService) {
        this._commandService = _commandService;
        this._progress = new Map();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostProgress);
        this._progressService = progressService;
    }
    dispose() {
        this._progress.forEach(handle => handle.resolve());
        this._progress.clear();
    }
    async $startProgress(handle, options, extensionId) {
        const task = this._createTask(handle);
        if (options.location === 15 /* ProgressLocation.Notification */ && extensionId) {
            const sourceIsUrgent = MainThreadProgress_1.URGENT_PROGRESS_SOURCES.includes(extensionId);
            const notificationOptions = {
                ...options,
                priority: sourceIsUrgent ? NotificationPriority.URGENT : NotificationPriority.DEFAULT,
                location: 15 /* ProgressLocation.Notification */,
                secondaryActions: [toAction({
                        id: extensionId,
                        label: localize('manageExtension', "Manage Extension"),
                        run: () => this._commandService.executeCommand('_extensions.manage', extensionId)
                    })]
            };
            options = notificationOptions;
        }
        try {
            this._progressService.withProgress(options, task, () => this._proxy.$acceptProgressCanceled(handle));
        }
        catch (err) {
            // the withProgress-method will throw synchronously when invoked with bad options
            // which is then an enternal/extension error
            onUnexpectedExternalError(err);
        }
    }
    $progressReport(handle, message) {
        const entry = this._progress.get(handle);
        entry?.progress.report(message);
    }
    $progressEnd(handle) {
        const entry = this._progress.get(handle);
        if (entry) {
            entry.resolve();
            this._progress.delete(handle);
        }
    }
    _createTask(handle) {
        return (progress) => {
            return new Promise(resolve => {
                this._progress.set(handle, { resolve, progress });
            });
        };
    }
};
MainThreadProgress = MainThreadProgress_1 = __decorate([
    extHostNamedCustomer(MainContext.MainThreadProgress),
    __param(1, IProgressService),
    __param(2, ICommandService)
], MainThreadProgress);
export { MainThreadProgress };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZFByb2dyZXNzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvYnJvd3Nlci9tYWluVGhyZWFkUHJvZ3Jlc3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBYSxnQkFBZ0IsRUFBbUYsTUFBTSwrQ0FBK0MsQ0FBQztBQUM3SyxPQUFPLEVBQTJCLFdBQVcsRUFBd0IsY0FBYyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDM0gsT0FBTyxFQUFFLG9CQUFvQixFQUFtQixNQUFNLHNEQUFzRCxDQUFDO0FBQzdHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUNoRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDM0MsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDM0UsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBR3RGLElBQU0sa0JBQWtCLEdBQXhCLE1BQU0sa0JBQWtCOzthQUVOLDRCQUF1QixHQUFHO1FBQ2pELDhCQUE4QjtRQUM5QixpQ0FBaUM7S0FDakMsQUFIOEMsQ0FHN0M7SUFNRixZQUNDLGNBQStCLEVBQ2IsZUFBaUMsRUFDbEMsZUFBaUQ7UUFBaEMsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBTjNELGNBQVMsR0FBRyxJQUFJLEdBQUcsRUFBdUUsQ0FBQztRQVFsRyxJQUFJLENBQUMsTUFBTSxHQUFHLGNBQWMsQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3RFLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxlQUFlLENBQUM7SUFDekMsQ0FBQztJQUVELE9BQU87UUFDTixJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ25ELElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDeEIsQ0FBQztJQUVELEtBQUssQ0FBQyxjQUFjLENBQUMsTUFBYyxFQUFFLE9BQXlCLEVBQUUsV0FBb0I7UUFDbkYsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUV0QyxJQUFJLE9BQU8sQ0FBQyxRQUFRLDJDQUFrQyxJQUFJLFdBQVcsRUFBRSxDQUFDO1lBQ3ZFLE1BQU0sY0FBYyxHQUFHLG9CQUFrQixDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUN4RixNQUFNLG1CQUFtQixHQUFpQztnQkFDekQsR0FBRyxPQUFPO2dCQUNWLFFBQVEsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsb0JBQW9CLENBQUMsT0FBTztnQkFDckYsUUFBUSx3Q0FBK0I7Z0JBQ3ZDLGdCQUFnQixFQUFFLENBQUMsUUFBUSxDQUFDO3dCQUMzQixFQUFFLEVBQUUsV0FBVzt3QkFDZixLQUFLLEVBQUUsUUFBUSxDQUFDLGlCQUFpQixFQUFFLGtCQUFrQixDQUFDO3dCQUN0RCxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsb0JBQW9CLEVBQUUsV0FBVyxDQUFDO3FCQUNqRixDQUFDLENBQUM7YUFDSCxDQUFDO1lBRUYsT0FBTyxHQUFHLG1CQUFtQixDQUFDO1FBQy9CLENBQUM7UUFFRCxJQUFJLENBQUM7WUFDSixJQUFJLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ3RHLENBQUM7UUFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1lBQ2QsaUZBQWlGO1lBQ2pGLDRDQUE0QztZQUM1Qyx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNoQyxDQUFDO0lBQ0YsQ0FBQztJQUVELGVBQWUsQ0FBQyxNQUFjLEVBQUUsT0FBc0I7UUFDckQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDekMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUVELFlBQVksQ0FBQyxNQUFjO1FBQzFCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3pDLElBQUksS0FBSyxFQUFFLENBQUM7WUFDWCxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDL0IsQ0FBQztJQUNGLENBQUM7SUFFTyxXQUFXLENBQUMsTUFBYztRQUNqQyxPQUFPLENBQUMsUUFBa0MsRUFBRSxFQUFFO1lBQzdDLE9BQU8sSUFBSSxPQUFPLENBQU8sT0FBTyxDQUFDLEVBQUU7Z0JBQ2xDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ25ELENBQUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDO0lBQ0gsQ0FBQzs7QUF4RVcsa0JBQWtCO0lBRDlCLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQztJQWNsRCxXQUFBLGdCQUFnQixDQUFBO0lBQ2hCLFdBQUEsZUFBZSxDQUFBO0dBZEwsa0JBQWtCLENBeUU5QiJ9