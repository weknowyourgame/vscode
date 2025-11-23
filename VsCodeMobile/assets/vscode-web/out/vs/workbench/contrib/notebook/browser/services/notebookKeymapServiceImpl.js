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
import { onUnexpectedError } from '../../../../../base/common/errors.js';
import { Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { INotificationService, Severity } from '../../../../../platform/notification/common/notification.js';
import { getInstalledExtensions } from '../../../extensions/common/extensionsUtils.js';
import { IWorkbenchExtensionEnablementService } from '../../../../services/extensionManagement/common/extensionManagement.js';
import { ILifecycleService } from '../../../../services/lifecycle/common/lifecycle.js';
import { IExtensionManagementService } from '../../../../../platform/extensionManagement/common/extensionManagement.js';
import { areSameExtensions } from '../../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { Memento } from '../../../../common/memento.js';
import { distinct } from '../../../../../base/common/arrays.js';
function onExtensionChanged(accessor) {
    const extensionService = accessor.get(IExtensionManagementService);
    const extensionEnablementService = accessor.get(IWorkbenchExtensionEnablementService);
    const onDidInstallExtensions = Event.chain(extensionService.onDidInstallExtensions, $ => $.filter(e => e.some(({ operation }) => operation === 2 /* InstallOperation.Install */))
        .map(e => e.map(({ identifier }) => identifier)));
    return Event.debounce(Event.any(Event.any(onDidInstallExtensions, Event.map(extensionService.onDidUninstallExtension, e => [e.identifier])), Event.map(extensionEnablementService.onEnablementChanged, extensions => extensions.map(e => e.identifier))), (result, identifiers) => {
        result = result || (identifiers.length ? [identifiers[0]] : []);
        for (const identifier of identifiers) {
            if (result.some(l => !areSameExtensions(l, identifier))) {
                result.push(identifier);
            }
        }
        return result;
    });
}
const hasRecommendedKeymapKey = 'hasRecommendedKeymap';
let NotebookKeymapService = class NotebookKeymapService extends Disposable {
    constructor(instantiationService, extensionEnablementService, notificationService, storageService, lifecycleService) {
        super();
        this.instantiationService = instantiationService;
        this.extensionEnablementService = extensionEnablementService;
        this.notificationService = notificationService;
        this.notebookKeymapMemento = new Memento('notebookKeymap', storageService);
        this.notebookKeymap = this.notebookKeymapMemento.getMemento(0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        this._register(lifecycleService.onDidShutdown(() => this.dispose()));
        this._register(this.instantiationService.invokeFunction(onExtensionChanged)((identifiers => {
            Promise.all(identifiers.map(identifier => this.checkForOtherKeymaps(identifier)))
                .then(undefined, onUnexpectedError);
        })));
    }
    checkForOtherKeymaps(extensionIdentifier) {
        return this.instantiationService.invokeFunction(getInstalledExtensions).then(extensions => {
            const keymaps = extensions.filter(extension => isNotebookKeymapExtension(extension));
            const extension = keymaps.find(extension => areSameExtensions(extension.identifier, extensionIdentifier));
            if (extension && extension.globallyEnabled) {
                // there is already a keymap extension
                this.notebookKeymap[hasRecommendedKeymapKey] = true;
                this.notebookKeymapMemento.saveMemento();
                const otherKeymaps = keymaps.filter(extension => !areSameExtensions(extension.identifier, extensionIdentifier) && extension.globallyEnabled);
                if (otherKeymaps.length) {
                    return this.promptForDisablingOtherKeymaps(extension, otherKeymaps);
                }
            }
            return undefined;
        });
    }
    promptForDisablingOtherKeymaps(newKeymap, oldKeymaps) {
        const onPrompt = (confirmed) => {
            if (confirmed) {
                this.extensionEnablementService.setEnablement(oldKeymaps.map(keymap => keymap.local), 10 /* EnablementState.DisabledGlobally */);
            }
        };
        this.notificationService.prompt(Severity.Info, localize('disableOtherKeymapsConfirmation', "Disable other keymaps ({0}) to avoid conflicts between keybindings?", distinct(oldKeymaps.map(k => k.local.manifest.displayName)).map(name => `'${name}'`).join(', ')), [{
                label: localize('yes', "Yes"),
                run: () => onPrompt(true)
            }, {
                label: localize('no', "No"),
                run: () => onPrompt(false)
            }]);
    }
};
NotebookKeymapService = __decorate([
    __param(0, IInstantiationService),
    __param(1, IWorkbenchExtensionEnablementService),
    __param(2, INotificationService),
    __param(3, IStorageService),
    __param(4, ILifecycleService)
], NotebookKeymapService);
export { NotebookKeymapService };
export function isNotebookKeymapExtension(extension) {
    if (extension.local.manifest.extensionPack) {
        return false;
    }
    const keywords = extension.local.manifest.keywords;
    if (!keywords) {
        return false;
    }
    return keywords.indexOf('notebook-keymap') !== -1;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tLZXltYXBTZXJ2aWNlSW1wbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3NlcnZpY2VzL25vdGVib29rS2V5bWFwU2VydmljZUltcGwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDekUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLHFCQUFxQixFQUFvQixNQUFNLCtEQUErRCxDQUFDO0FBQ3hILE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxRQUFRLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUM3RyxPQUFPLEVBQUUsc0JBQXNCLEVBQW9CLE1BQU0sK0NBQStDLENBQUM7QUFFekcsT0FBTyxFQUFtQixvQ0FBb0MsRUFBRSxNQUFNLHdFQUF3RSxDQUFDO0FBQy9JLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBd0IsMkJBQTJCLEVBQW9CLE1BQU0sMkVBQTJFLENBQUM7QUFDaEssT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFDbEgsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxtREFBbUQsQ0FBQztBQUNqSCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDeEQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRWhFLFNBQVMsa0JBQWtCLENBQUMsUUFBMEI7SUFD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