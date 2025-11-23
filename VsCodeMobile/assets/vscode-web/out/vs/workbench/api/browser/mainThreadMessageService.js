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
var MainThreadMessageService_1;
import * as nls from '../../../nls.js';
import { toAction } from '../../../base/common/actions.js';
import { MainContext } from '../common/extHost.protocol.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { IDialogService } from '../../../platform/dialogs/common/dialogs.js';
import { INotificationService, NotificationPriority } from '../../../platform/notification/common/notification.js';
import { Event } from '../../../base/common/event.js';
import { ICommandService } from '../../../platform/commands/common/commands.js';
import { IExtensionService } from '../../services/extensions/common/extensions.js';
let MainThreadMessageService = class MainThreadMessageService {
    static { MainThreadMessageService_1 = this; }
    static { this.URGENT_NOTIFICATION_SOURCES = [
        'vscode.github-authentication',
        'vscode.microsoft-authentication'
    ]; }
    constructor(extHostContext, _notificationService, _commandService, _dialogService, extensionService) {
        this._notificationService = _notificationService;
        this._commandService = _commandService;
        this._dialogService = _dialogService;
        this.extensionsListener = extensionService.onDidChangeExtensions(e => {
            for (const extension of e.removed) {
                this._notificationService.removeFilter(extension.identifier.value);
            }
        });
    }
    dispose() {
        this.extensionsListener.dispose();
    }
    $showMessage(severity, message, options, commands) {
        if (options.modal) {
            return this._showModalMessage(severity, message, options.detail, commands, options.useCustom);
        }
        else {
            return this._showMessage(severity, message, commands, options);
        }
    }
    _showMessage(severity, message, commands, options) {
        return new Promise(resolve => {
            const primaryActions = commands.map(command => toAction({
                id: `_extension_message_handle_${command.handle}`,
                label: command.title,
                enabled: true,
                run: () => {
                    resolve(command.handle);
                    return Promise.resolve();
                }
            }));
            let source;
            let sourceIsUrgent = false;
            if (options.source) {
                source = {
                    label: options.source.label,
                    id: options.source.identifier.value
                };
                sourceIsUrgent = MainThreadMessageService_1.URGENT_NOTIFICATION_SOURCES.includes(source.id);
            }
            if (!source) {
                source = nls.localize('defaultSource', "Extension");
            }
            const secondaryActions = [];
            if (options.source) {
                secondaryActions.push(toAction({
                    id: options.source.identifier.value,
                    label: nls.localize('manageExtension', "Manage Extension"),
                    run: () => {
                        return this._commandService.executeCommand('_extensions.manage', options.source.identifier.value);
                    }
                }));
            }
            const messageHandle = this._notificationService.notify({
                severity,
                message,
                actions: { primary: primaryActions, secondary: secondaryActions },
                source,
                priority: sourceIsUrgent ? NotificationPriority.URGENT : NotificationPriority.DEFAULT,
                sticky: sourceIsUrgent
            });
            // if promise has not been resolved yet, now is the time to ensure a return value
            // otherwise if already resolved it means the user clicked one of the buttons
            Event.once(messageHandle.onDidClose)(() => {
                resolve(undefined);
            });
        });
    }
    async _showModalMessage(severity, message, detail, commands, useCustom) {
        const buttons = [];
        let cancelButton = undefined;
        for (const command of commands) {
            const button = {
                label: command.title,
                run: () => command.handle
            };
            if (command.isCloseAffordance) {
                cancelButton = button;
            }
            else {
                buttons.push(button);
            }
        }
        if (!cancelButton) {
            if (buttons.length > 0) {
                cancelButton = {
                    label: nls.localize('cancel', "Cancel"),
                    run: () => undefined
                };
            }
            else {
                cancelButton = {
                    label: nls.localize({ key: 'ok', comment: ['&& denotes a mnemonic'] }, "&&OK"),
                    run: () => undefined
                };
            }
        }
        const { result } = await this._dialogService.prompt({
            type: severity,
            message,
            detail,
            buttons,
            cancelButton,
            custom: useCustom
        });
        return result;
    }
};
MainThreadMessageService = MainThreadMessageService_1 = __decorate([
    extHostNamedCustomer(MainContext.MainThreadMessageService),
    __param(1, INotificationService),
    __param(2, ICommandService),
    __param(3, IDialogService),
    __param(4, IExtensionService)
], MainThreadMessageService);
export { MainThreadMessageService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZE1lc3NhZ2VTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvYnJvd3Nlci9tYWluVGhyZWFkTWVzc2FnZVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0saUJBQWlCLENBQUM7QUFFdkMsT0FBTyxFQUFXLFFBQVEsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3BFLE9BQU8sRUFBaUMsV0FBVyxFQUE0QixNQUFNLCtCQUErQixDQUFDO0FBQ3JILE9BQU8sRUFBRSxvQkFBb0IsRUFBbUIsTUFBTSxzREFBc0QsQ0FBQztBQUM3RyxPQUFPLEVBQUUsY0FBYyxFQUFpQixNQUFNLDZDQUE2QyxDQUFDO0FBQzVGLE9BQU8sRUFBRSxvQkFBb0IsRUFBdUIsb0JBQW9CLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN4SSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDdEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBSTVFLElBQU0sd0JBQXdCLEdBQTlCLE1BQU0sd0JBQXdCOzthQUlaLGdDQUEyQixHQUFHO1FBQ3JELDhCQUE4QjtRQUM5QixpQ0FBaUM7S0FDakMsQUFIa0QsQ0FHakQ7SUFFRixZQUNDLGNBQStCLEVBQ1Esb0JBQTBDLEVBQy9DLGVBQWdDLEVBQ2pDLGNBQThCLEVBQzVDLGdCQUFtQztRQUhmLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBc0I7UUFDL0Msb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBQ2pDLG1CQUFjLEdBQWQsY0FBYyxDQUFnQjtRQUcvRCxJQUFJLENBQUMsa0JBQWtCLEdBQUcsZ0JBQWdC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