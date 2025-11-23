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
import { localize, localize2 } from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IProcessService } from '../../../../platform/process/common/process.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { Extensions as QuickAccessExtensions } from '../../../../platform/quickinput/common/quickAccess.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions } from '../../../common/contributions.js';
import { IssueQuickAccess } from '../browser/issueQuickAccess.js';
import '../browser/issueTroubleshoot.js';
import { BaseIssueContribution } from '../common/issue.contribution.js';
import { IIssueFormService, IWorkbenchIssueService } from '../common/issue.js';
import { NativeIssueService } from './issueService.js';
import { NativeIssueFormService } from './nativeIssueFormService.js';
//#region Issue Contribution
registerSingleton(IWorkbenchIssueService, NativeIssueService, 1 /* InstantiationType.Delayed */);
registerSingleton(IIssueFormService, NativeIssueFormService, 1 /* InstantiationType.Delayed */);
let NativeIssueContribution = class NativeIssueContribution extends BaseIssueContribution {
    constructor(productService, configurationService) {
        super(productService, configurationService);
        if (!configurationService.getValue('telemetry.feedback.enabled')) {
            return;
        }
        if (productService.reportIssueUrl) {
            this._register(registerAction2(ReportPerformanceIssueUsingReporterAction));
        }
        let disposable;
        const registerQuickAccessProvider = () => {
            disposable = Registry.as(QuickAccessExtensions.Quickaccess).registerQuickAccessProvider({
                ctor: IssueQuickAccess,
                prefix: IssueQuickAccess.PREFIX,
                contextKey: 'inReportIssuePicker',
                placeholder: localize('tasksQuickAccessPlaceholder', "Type the name of an extension to report on."),
                helpEntries: [{
                        description: localize('openIssueReporter', "Open Issue Reporter"),
                        commandId: 'workbench.action.openIssueReporter'
                    }]
            });
        };
        this._register(configurationService.onDidChangeConfiguration(e => {
            if (!configurationService.getValue('extensions.experimental.issueQuickAccess') && disposable) {
                disposable.dispose();
                disposable = undefined;
            }
            else if (!disposable) {
                registerQuickAccessProvider();
            }
        }));
        if (configurationService.getValue('extensions.experimental.issueQuickAccess')) {
            registerQuickAccessProvider();
        }
    }
};
NativeIssueContribution = __decorate([
    __param(0, IProductService),
    __param(1, IConfigurationService)
], NativeIssueContribution);
Registry.as(Extensions.Workbench).registerWorkbenchContribution(NativeIssueContribution, 3 /* LifecyclePhase.Restored */);
class ReportPerformanceIssueUsingReporterAction extends Action2 {
    static { this.ID = 'workbench.action.reportPerformanceIssueUsingReporter'; }
    constructor() {
        super({
            id: ReportPerformanceIssueUsingReporterAction.ID,
            title: localize2({ key: 'reportPerformanceIssue', comment: [`Here, 'issue' means problem or bug`] }, "Report Performance Issue..."),
            category: Categories.Help,
            f1: true
        });
    }
    async run(accessor) {
        const issueService = accessor.get(IWorkbenchIssueService); // later can just get IIssueFormService
        return issueService.openReporter({ issueType: 1 /* IssueType.PerformanceIssue */ });
    }
}
CommandsRegistry.registerCommand('_issues.getSystemStatus', (accessor) => {
    return accessor.get(IProcessService).getSystemStatus();
});
// #endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXNzdWUuY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2lzc3VlL2VsZWN0cm9uLWJyb3dzZXIvaXNzdWUuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDMUYsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDcEYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFxQixpQkFBaUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBRS9HLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNqRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDeEYsT0FBTyxFQUF3QixVQUFVLElBQUkscUJBQXFCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNsSSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDNUUsT0FBTyxFQUFFLFVBQVUsRUFBbUMsTUFBTSxrQ0FBa0MsQ0FBQztBQUUvRixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNsRSxPQUFPLGlDQUFpQyxDQUFDO0FBQ3pDLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxzQkFBc0IsRUFBYSxNQUFNLG9CQUFvQixDQUFD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