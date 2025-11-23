/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { MenuId, MenuRegistry, Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IURLService } from '../../../../platform/url/common/url.js';
import { Extensions as WorkbenchExtensions, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { ExternalUriResolverContribution } from './externalUriResolver.js';
import { manageTrustedDomainSettingsCommand } from './trustedDomains.js';
import { TrustedDomainsFileSystemProvider } from './trustedDomainsFileSystemProvider.js';
import { OpenerValidatorContributions } from './trustedDomainsValidator.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { workbenchConfigurationNodeBase } from '../../../common/configuration.js';
import { ITrustedDomainService, TrustedDomainService } from './trustedDomainService.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
class OpenUrlAction extends Action2 {
    static { this.STORAGE_KEY = 'workbench.action.url.openUrl.lastInput'; }
    constructor() {
        super({
            id: 'workbench.action.url.openUrl',
            title: localize2('openUrl', 'Open URL'),
            category: Categories.Developer,
            f1: true
        });
    }
    async run(accessor) {
        const quickInputService = accessor.get(IQuickInputService);
        const urlService = accessor.get(IURLService);
        const storageService = accessor.get(IStorageService);
        const value = storageService.get(OpenUrlAction.STORAGE_KEY, 1 /* StorageScope.WORKSPACE */, '');
        return quickInputService.input({ prompt: localize('urlToOpen', "URL to open"), value }).then(input => {
            if (input) {
                const uri = URI.parse(input);
                urlService.open(uri, { originalUrl: input });
                storageService.store(OpenUrlAction.STORAGE_KEY, input, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
            }
        });
    }
}
registerAction2(OpenUrlAction);
/**
 * Trusted Domains Contribution
 */
CommandsRegistry.registerCommand(manageTrustedDomainSettingsCommand);
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
    command: {
        id: manageTrustedDomainSettingsCommand.id,
        title: manageTrustedDomainSettingsCommand.description.description
    }
});
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(OpenerValidatorContributions, 3 /* LifecyclePhase.Restored */);
registerWorkbenchContribution2(TrustedDomainsFileSystemProvider.ID, TrustedDomainsFileSystemProvider, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(ExternalUriResolverContribution.ID, ExternalUriResolverContribution, 2 /* WorkbenchPhase.BlockRestore */);
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
    ...workbenchConfigurationNodeBase,
    properties: {
        'workbench.trustedDomains.promptInTrustedWorkspace': {
            scope: 1 /* ConfigurationScope.APPLICATION */,
            type: 'boolean',
            default: false,
            description: localize('workbench.trustedDomains.promptInTrustedWorkspace', "When enabled, trusted domain prompts will appear when opening links in trusted workspaces.")
        }
    }
});
registerSingleton(ITrustedDomainService, TrustedDomainService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXJsLmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi91cmwvYnJvd3Nlci91cmwuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3pELE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNoSCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUVwRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDNUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxVQUFVLElBQUksbUJBQW1CLEVBQW1ELDhCQUE4QixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDdEssT0FBTyxFQUFFLCtCQUErQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0UsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDekUsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDekYsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFFNUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQzFGLE9BQU8sRUFBc0IsVUFBVSxJQUFJLHVCQUF1QixFQUEwQixNQUFNLG9FQUFvRSxDQUFDO0FBQ3ZLLE9BQU8sRUFB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