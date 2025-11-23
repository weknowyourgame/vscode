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
var PolicyExportContribution_1;
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchConfigurationService } from '../../../services/configuration/common/configuration.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INativeHostService } from '../../../../platform/native/common/native.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { PolicyCategory, PolicyCategoryData } from '../../../../base/common/policy.js';
import { join } from '../../../../base/common/path.js';
let PolicyExportContribution = class PolicyExportContribution extends Disposable {
    static { PolicyExportContribution_1 = this; }
    static { this.ID = 'workbench.contrib.policyExport'; }
    static { this.DEFAULT_POLICY_EXPORT_PATH = 'build/lib/policies/policyData.jsonc'; }
    constructor(nativeEnvironmentService, extensionService, fileService, configurationService, nativeHostService, progressService, logService) {
        super();
        this.nativeEnvironmentService = nativeEnvironmentService;
        this.extensionService = extensionService;
        this.fileService = fileService;
        this.configurationService = configurationService;
        this.nativeHostService = nativeHostService;
        this.progressService = progressService;
        this.logService = logService;
        // Skip for non-development flows
        if (this.nativeEnvironmentService.isBuilt) {
            return;
        }
        const policyDataPath = this.nativeEnvironmentService.exportPolicyData;
        if (policyDataPath !== undefined) {
            const defaultPath = join(this.nativeEnvironmentService.appRoot, PolicyExportContribution_1.DEFAULT_POLICY_EXPORT_PATH);
            void this.exportPolicyDataAndQuit(policyDataPath ? policyDataPath : defaultPath);
        }
    }
    log(msg, ...args) {
        this.logService.info(`[${PolicyExportContribution_1.ID}]`, msg, ...args);
    }
    async exportPolicyDataAndQuit(policyDataPath) {
        try {
            await this.progressService.withProgress({
                location: 15 /* ProgressLocation.Notification */,
                title: `Exporting policy data to ${policyDataPath}`
            }, async (_progress) => {
                this.log('Export started. Waiting for configurations to load.');
                await this.extensionService.whenInstalledExtensionsRegistered();
                await this.configurationService.whenRemoteConfigurationLoaded();
                this.log('Extensions and configuration loaded.');
                const configurationRegistry = Registry.as(Extensions.Configuration);
                const configurationProperties = {
                    ...configurationRegistry.getExcludedConfigurationProperties(),
                    ...configurationRegistry.getConfigurationProperties(),
                };
                const policyData = {
                    categories: Object.values(PolicyCategory).map(category => ({
                        key: category,
                        name: PolicyCategoryData[category].name
                    })),
                    policies: []
                };
                for (const [key, schema] of Object.entries(configurationProperties)) {
                    // Check for the localization property for now to remain backwards compatible.
                    if (schema.policy?.localization) {
                        policyData.policies.push({
                            key,
                            name: schema.policy.name,
                            category: schema.policy.category,
                            minimumVersion: schema.policy.minimumVersion,
                            localization: {
                                description: schema.policy.localization.description,
                                enumDescriptions: schema.policy.localization.enumDescriptions,
                            },
                            type: schema.type,
                            default: schema.default,
                            enum: schema.enum,
                        });
                    }
                }
                this.log(`Discovered ${policyData.policies.length} policies to export.`);
                const disclaimerComment = `/** THIS FILE IS AUTOMATICALLY GENERATED USING \`code --export-policy-data\`. DO NOT MODIFY IT MANUALLY. **/`;
                const policyDataFileContent = `${disclaimerComment}\n${JSON.stringify(policyData, null, 4)}\n`;
                await this.fileService.writeFile(URI.file(policyDataPath), VSBuffer.fromString(policyDataFileContent));
                this.log(`Successfully exported ${policyData.policies.length} policies to ${policyDataPath}.`);
            });
            await this.nativeHostService.exit(0);
        }
        catch (error) {
            this.log('Failed to export policy', error);
            await this.nativeHostService.exit(1);
        }
    }
};
PolicyExportContribution = PolicyExportContribution_1 = __decorate([
    __param(0, INativeEnvironmentService),
    __param(1, IExtensionService),
    __param(2, IFileService),
    __param(3, IWorkbenchConfigurationService),
    __param(4, INativeHostService),
    __param(5, IProgressService),
    __param(6, ILogService)
], PolicyExportContribution);
export { PolicyExportContribution };
registerWorkbenchContribution2(PolicyExportContribution.ID, PolicyExportContribution, 4 /* WorkbenchPhase.Eventually */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9saWN5RXhwb3J0LmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9wb2xpY3lFeHBvcnQvZWxlY3Ryb24tYnJvd3Nlci9wb2xpY3lFeHBvcnQuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQTBCLDhCQUE4QixFQUFrQixNQUFNLGtDQUFrQyxDQUFDO0FBQzFILE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsOEJBQThCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN6RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUN0RixPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUNuRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDckUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDbEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzVFLE9BQU8sRUFBRSxVQUFVLEVBQTBCLE1BQU0sb0VBQW9FLENBQUM7QUFDeEgsT0FBTyxFQUFFLGdCQUFnQixFQUFvQixNQUFNLGtEQUFrRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUV2RixPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0s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