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
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { registerAction2 } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { SignOutOfAccountAction } from './actions/signOutOfAccountAction.js';
import { IBrowserWorkbenchEnvironmentService } from '../../../services/environment/browser/environmentService.js';
import { Extensions } from '../../../services/extensionManagement/common/extensionFeatures.js';
import { ManageTrustedExtensionsForAccountAction } from './actions/manageTrustedExtensionsForAccountAction.js';
import { ManageAccountPreferencesForExtensionAction } from './actions/manageAccountPreferencesForExtensionAction.js';
import { IAuthenticationUsageService } from '../../../services/authentication/browser/authenticationUsageService.js';
import { ManageAccountPreferencesForMcpServerAction } from './actions/manageAccountPreferencesForMcpServerAction.js';
import { ManageTrustedMcpServersForAccountAction } from './actions/manageTrustedMcpServersForAccountAction.js';
import { RemoveDynamicAuthenticationProvidersAction } from './actions/manageDynamicAuthenticationProvidersAction.js';
import { ManageAccountsAction } from './actions/manageAccountsAction.js';
const codeExchangeProxyCommand = CommandsRegistry.registerCommand('workbench.getCodeExchangeProxyEndpoints', function (accessor, _) {
    const environmentService = accessor.get(IBrowserWorkbenchEnvironmentService);
    return environmentService.options?.codeExchangeProxyEndpoints;
});
class AuthenticationDataRenderer extends Disposable {
    constructor() {
        super(...arguments);
        this.type = 'table';
    }
    shouldRender(manifest) {
        return !!manifest.contributes?.authentication;
    }
    render(manifest) {
        const authentication = manifest.contributes?.authentication || [];
        if (!authentication.length) {
            return { data: { headers: [], rows: [] }, dispose: () => { } };
        }
        const headers = [
            localize('authenticationlabel', "Label"),
            localize('authenticationid', "ID"),
            localize('authenticationMcpAuthorizationServers', "MCP Authorization Servers")
        ];
        const rows = authentication
            .sort((a, b) => a.label.localeCompare(b.label))
            .map(auth => {
            return [
                auth.label,
                auth.id,
                (auth.authorizationServerGlobs ?? []).join(',\n')
            ];
        });
        return {
            data: {
                headers,
                rows
            },
            dispose: () => { }
        };
    }
}
const extensionFeature = Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
    id: 'authentication',
    label: localize('authentication', "Authentication"),
    access: {
        canToggle: false
    },
    renderer: new SyncDescriptor(AuthenticationDataRenderer),
});
class AuthenticationContribution extends Disposable {
    static { this.ID = 'workbench.contrib.authentication'; }
    constructor() {
        super();
        this._register(codeExchangeProxyCommand);
        this._register(extensionFeature);
        this._registerActions();
    }
    _registerActions() {
        this._register(registerAction2(ManageAccountsAction));
        this._register(registerAction2(SignOutOfAccountAction));
        this._register(registerAction2(ManageTrustedExtensionsForAccountAction));
        this._register(registerAction2(ManageAccountPreferencesForExtensionAction));
        this._register(registerAction2(ManageTrustedMcpServersForAccountAction));
        this._register(registerAction2(ManageAccountPreferencesForMcpServerAction));
        this._register(registerAction2(RemoveDynamicAuthenticationProvidersAction));
    }
}
let AuthenticationUsageContribution = class AuthenticationUsageContribution {
    static { this.ID = 'workbench.contrib.authenticationUsage'; }
    constructor(_authenticationUsageService) {
        this._authenticationUsageService = _authenticationUsageService;
        this._initializeExtensionUsageCache();
    }
    async _initializeExtensionUsageCache() {
        await this._authenticationUsageService.initializeExtensionUsageCache();
    }
};
AuthenticationUsageContribution = __decorate([
    __param(0, IAuthenticationUsageService)
], AuthenticationUsageContribution);
// class AuthenticationExtensionsContribution extends Disposable implements IWorkbenchContribution {
// 	static ID = 'workbench.contrib.authenticationExtensions';
// 	constructor(
// 		@IExtensionService private readonly _extensionService: IExtensionService,
// 		@IAuthenticationQueryService private readonly _authenticationQueryService: IAuthenticationQueryService,
// 		@IAuthenticationService private readonly _authenticationService: IAuthenticationService
// 	) {
// 		super();
// 		void this.run();
// 		this._register(this._extensionService.onDidChangeExtensions(this._onDidChangeExtensions, this));
// 		this._register(
// 			Event.any(
// 				this._authenticationService.onDidChangeDeclaredProviders,
// 				this._authenticationService.onDidRegisterAuthenticationProvider
// 			)(() => this._cleanupRemovedExtensions())
// 		);
// 	}
// 	async run(): Promise<void> {
// 		await this._extensionService.whenInstalledExtensionsRegistered();
// 		this._cleanupRemovedExtensions();
// 	}
// 	private _onDidChangeExtensions(delta: { readonly added: readonly IExtensionDescription[]; readonly removed: readonly IExtensionDescription[] }): void {
// 		if (delta.removed.length > 0) {
// 			this._cleanupRemovedExtensions(delta.removed);
// 		}
// 	}
// 	private _cleanupRemovedExtensions(removedExtensions?: readonly IExtensionDescription[]): void {
// 		const extensionIdsToRemove = removedExtensions
// 			? new Set(removedExtensions.map(e => e.identifier.value))
// 			: new Set(this._extensionService.extensions.map(e => e.identifier.value));
// 		// If we are cleaning up specific removed extensions, we only remove those.
// 		const isTargetedCleanup = !!removedExtensions;
// 		const providerIds = this._authenticationQueryService.getProviderIds();
// 		for (const providerId of providerIds) {
// 			this._authenticationQueryService.provider(providerId).forEachAccount(account => {
// 				account.extensions().forEach(extension => {
// 					const shouldRemove = isTargetedCleanup
// 						? extensionIdsToRemove.has(extension.extensionId)
// 						: !extensionIdsToRemove.has(extension.extensionId);
// 					if (shouldRemove) {
// 						extension.removeUsage();
// 						extension.setAccessAllowed(false);
// 					}
// 				});
// 			});
// 		}
// 	}
// }
// class AuthenticationMcpContribution extends Disposable implements IWorkbenchContribution {
// 	static ID = 'workbench.contrib.authenticationMcp';
// 	constructor(
// 		@IMcpRegistry private readonly _mcpRegistry: IMcpRegistry,
// 		@IAuthenticationQueryService private readonly _authenticationQueryService: IAuthenticationQueryService,
// 		@IAuthenticationService private readonly _authenticationService: IAuthenticationService
// 	) {
// 		super();
// 		this._cleanupRemovedMcpServers();
// 		// Listen for MCP collections changes using autorun with observables
// 		this._register(autorun(reader => {
// 			// Read the collections observable to register dependency
// 			this._mcpRegistry.collections.read(reader);
// 			// Schedule cleanup for next tick to avoid running during observable updates
// 			queueMicrotask(() => this._cleanupRemovedMcpServers());
// 		}));
// 		this._register(
// 			Event.any(
// 				this._authenticationService.onDidChangeDeclaredProviders,
// 				this._authenticationService.onDidRegisterAuthenticationProvider
// 			)(() => this._cleanupRemovedMcpServers())
// 		);
// 	}
// 	private _cleanupRemovedMcpServers(): void {
// 		const currentServerIds = new Set(this._mcpRegistry.collections.get().flatMap(c => c.serverDefinitions.get()).map(s => s.id));
// 		const providerIds = this._authenticationQueryService.getProviderIds();
// 		for (const providerId of providerIds) {
// 			this._authenticationQueryService.provider(providerId).forEachAccount(account => {
// 				account.mcpServers().forEach(server => {
// 					if (!currentServerIds.has(server.mcpServerId)) {
// 						server.removeUsage();
// 						server.setAccessAllowed(false);
// 					}
// 				});
// 			});
// 		}
// 	}
// }
registerWorkbenchContribution2(AuthenticationContribution.ID, AuthenticationContribution, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(AuthenticationUsageContribution.ID, AuthenticationUsageContribution, 4 /* WorkbenchPhase.Eventually */);
// registerWorkbenchContribution2(AuthenticationExtensionsContribution.ID, AuthenticationExtensionsContribution, WorkbenchPhase.Eventually);
// registerWorkbenchContribution2(AuthenticationMcpContribution.ID, AuthenticationMcpContribution, WorkbenchPhase.Eventually);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aGVudGljYXRpb24uY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2F1dGhlbnRpY2F0aW9uL2Jyb3dzZXIvYXV0aGVudGljYXRpb24uY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBRXBGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUMxRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDNUUsT0FBTyxFQUEwQyw4QkFBOEIsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzFILE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxtQ0FBbUMsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ2xILE9BQU8sRUFBRSxVQUFVLEVBQW1HLE1BQU0sbUVBQW1FLENBQUM7QUFDaE0sT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDL0csT0FBTyxFQUFFLDBDQUEwQyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDckgsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sd0VBQXdFLENBQUM7QUFDckgsT0FBTyxFQUFFLDBDQUEwQyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDckgsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sc0RBQXNELENBQUM7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