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
import { GettingStartedInputSerializer, GettingStartedPage, inWelcomeContext } from './gettingStarted.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorExtensions } from '../../../common/editor.js';
import { MenuId, registerAction2, Action2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { EditorPaneDescriptor } from '../../../browser/editor.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IWalkthroughsService } from './gettingStartedService.js';
import { GettingStartedInput } from './gettingStartedInput.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { workbenchConfigurationNodeBase } from '../../../common/configuration.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { isLinux, isMacintosh, isWindows } from '../../../../base/common/platform.js';
import { IExtensionManagementServerService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { StartupPageEditorResolverContribution, StartupPageRunnerContribution } from './startupPage.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { AccessibleViewRegistry } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { GettingStartedAccessibleView } from './gettingStartedAccessibleView.js';
export * as icons from './gettingStartedIcons.js';
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.openWalkthrough',
            title: localize2('miWelcome', 'Welcome'),
            category: Categories.Help,
            f1: true,
            menu: {
                id: MenuId.MenubarHelpMenu,
                group: '1_welcome',
                order: 1,
            },
            metadata: {
                description: localize2('minWelcomeDescription', 'Opens a Walkthrough to help you get started in VS Code.')
            }
        });
    }
    run(accessor, walkthroughID, optionsOrToSide) {
        const editorService = accessor.get(IEditorService);
        const commandService = accessor.get(ICommandService);
        const toSide = typeof optionsOrToSide === 'object' ? optionsOrToSide.toSide : optionsOrToSide;
        const inactive = typeof optionsOrToSide === 'object' ? optionsOrToSide.inactive : false;
        const activeEditor = editorService.activeEditor;
        if (walkthroughID) {
            const selectedCategory = typeof walkthroughID === 'string' ? walkthroughID : walkthroughID.category;
            let selectedStep;
            if (typeof walkthroughID === 'object' && 'category' in walkthroughID && 'step' in walkthroughID) {
                selectedStep = `${walkthroughID.category}#${walkthroughID.step}`;
            }
            else {
                selectedStep = undefined;
            }
            // If the walkthrough is already open just reveal the step
            if (selectedStep && activeEditor instanceof GettingStartedInput && activeEditor.selectedCategory === selectedCategory) {
                activeEditor.showWelcome = false;
                commandService.executeCommand('walkthroughs.selectStep', selectedStep);
                return;
            }
            let options;
            if (selectedCategory) {
                // Otherwise open the walkthrough editor with the selected category and step
                options = { selectedCategory, selectedStep, showWelcome: false, preserveFocus: toSide ?? false, inactive };
            }
            else {
                // Open Welcome page
                options = { selectedCategory, selectedStep, showWelcome: true, preserveFocus: toSide ?? false, inactive };
            }
            editorService.openEditor({
                resource: GettingStartedInput.RESOURCE,
                options
            }, toSide ? SIDE_GROUP : undefined);
        }
        else {
            editorService.openEditor({
                resource: GettingStartedInput.RESOURCE,
                options: { preserveFocus: toSide ?? false, inactive }
            }, toSide ? SIDE_GROUP : undefined);
        }
    }
});
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(GettingStartedInput.ID, GettingStartedInputSerializer);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(GettingStartedPage, GettingStartedPage.ID, localize('welcome', "Welcome")), [
    new SyncDescriptor(GettingStartedInput)
]);
const category = localize2('welcome', "Welcome");
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'welcome.goBack',
            title: localize2('welcome.goBack', 'Go Back'),
            category,
            keybinding: {
                weight: 100 /* KeybindingWeight.EditorContrib */,
                primary: 9 /* KeyCode.Escape */,
                when: inWelcomeContext
            },
            precondition: ContextKeyExpr.equals('activeEditor', 'gettingStartedPage'),
            f1: true
        });
    }
    run(accessor) {
        const editorService = accessor.get(IEditorService);
        const editorPane = editorService.activeEditorPane;
        if (editorPane instanceof GettingStartedPage) {
            editorPane.escape();
        }
    }
});
CommandsRegistry.registerCommand({
    id: 'walkthroughs.selectStep',
    handler: (accessor, stepID) => {
        const editorService = accessor.get(IEditorService);
        const editorPane = editorService.activeEditorPane;
        if (editorPane instanceof GettingStartedPage) {
            editorPane.selectStepLoose(stepID);
        }
        else {
            console.error('Cannot run walkthroughs.selectStep outside of walkthrough context');
        }
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'welcome.markStepComplete',
            title: localize('welcome.markStepComplete', "Mark Step Complete"),
            category,
        });
    }
    run(accessor, arg) {
        if (!arg) {
            return;
        }
        const gettingStartedService = accessor.get(IWalkthroughsService);
        gettingStartedService.progressStep(arg);
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'welcome.markStepIncomplete',
            title: localize('welcome.markStepInomplete', "Mark Step Incomplete"),
            category,
        });
    }
    run(accessor, arg) {
        if (!arg) {
            return;
        }
        const gettingStartedService = accessor.get(IWalkthroughsService);
        gettingStartedService.deprogressStep(arg);
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'welcome.showAllWalkthroughs',
            title: localize2('welcome.showAllWalkthroughs', 'Open Walkthrough...'),
            category,
            f1: true,
            menu: {
                id: MenuId.MenubarHelpMenu,
                group: '1_welcome',
                order: 3,
            },
        });
    }
    async getQuickPickItems(contextService, gettingStartedService) {
        const categories = await gettingStartedService.getWalkthroughs();
        return categories
            .filter(c => contextService.contextMatchesRules(c.when))
            .map(x => ({
            id: x.id,
            label: x.title,
            detail: x.description,
            description: x.source,
        }));
    }
    async run(accessor) {
        const commandService = accessor.get(ICommandService);
        const contextService = accessor.get(IContextKeyService);
        const quickInputService = accessor.get(IQuickInputService);
        const gettingStartedService = accessor.get(IWalkthroughsService);
        const extensionService = accessor.get(IExtensionService);
        const disposables = new DisposableStore();
        const quickPick = disposables.add(quickInputService.createQuickPick());
        quickPick.canSelectMany = false;
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;
        quickPick.placeholder = localize('pickWalkthroughs', 'Select a walkthrough to open');
        quickPick.items = await this.getQuickPickItems(contextService, gettingStartedService);
        quickPick.busy = true;
        disposables.add(quickPick.onDidAccept(() => {
            const selection = quickPick.selectedItems[0];
            if (selection) {
                commandService.executeCommand('workbench.action.openWalkthrough', selection.id);
            }
            quickPick.hide();
        }));
        disposables.add(quickPick.onDidHide(() => disposables.dispose()));
        await extensionService.whenInstalledExtensionsRegistered();
        disposables.add(gettingStartedService.onDidAddWalkthrough(async () => {
            quickPick.items = await this.getQuickPickItems(contextService, gettingStartedService);
        }));
        quickPick.show();
        quickPick.busy = false;
    }
});
CommandsRegistry.registerCommand({
    id: 'welcome.newWorkspaceChat',
    handler: (accessor, stepID) => {
        const commandService = accessor.get(ICommandService);
        commandService.executeCommand('workbench.action.chat.open', { mode: 'agent', query: '#new ', isPartialQuery: true });
    }
});
export const WorkspacePlatform = new RawContextKey('workspacePlatform', undefined, localize('workspacePlatform', "The platform of the current workspace, which in remote or serverless contexts may be different from the platform of the UI"));
let WorkspacePlatformContribution = class WorkspacePlatformContribution {
    static { this.ID = 'workbench.contrib.workspacePlatform'; }
    constructor(extensionManagementServerService, remoteAgentService, contextService) {
        this.extensionManagementServerService = extensionManagementServerService;
        this.remoteAgentService = remoteAgentService;
        this.contextService = contextService;
        this.remoteAgentService.getEnvironment().then(env => {
            const remoteOS = env?.os;
            const remotePlatform = remoteOS === 2 /* OS.Macintosh */ ? 'mac'
                : remoteOS === 1 /* OS.Windows */ ? 'windows'
                    : remoteOS === 3 /* OS.Linux */ ? 'linux'
                        : undefined;
            if (remotePlatform) {
                WorkspacePlatform.bindTo(this.contextService).set(remotePlatform);
            }
            else if (this.extensionManagementServerService.localExtensionManagementServer) {
                if (isMacintosh) {
                    WorkspacePlatform.bindTo(this.contextService).set('mac');
                }
                else if (isLinux) {
                    WorkspacePlatform.bindTo(this.contextService).set('linux');
                }
                else if (isWindows) {
                    WorkspacePlatform.bindTo(this.contextService).set('windows');
                }
            }
            else if (this.extensionManagementServerService.webExtensionManagementServer) {
                WorkspacePlatform.bindTo(this.contextService).set('webworker');
            }
            else {
                console.error('Error: Unable to detect workspace platform');
            }
        });
    }
};
WorkspacePlatformContribution = __decorate([
    __param(0, IExtensionManagementServerService),
    __param(1, IRemoteAgentService),
    __param(2, IContextKeyService)
], WorkspacePlatformContribution);
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
    ...workbenchConfigurationNodeBase,
    properties: {
        'workbench.welcomePage.walkthroughs.openOnInstall': {
            scope: 2 /* ConfigurationScope.MACHINE */,
            type: 'boolean',
            default: true,
            description: localize('workbench.welcomePage.walkthroughs.openOnInstall', "When enabled, an extension's walkthrough will open upon install of the extension.")
        },
        'workbench.startupEditor': {
            'scope': 5 /* ConfigurationScope.RESOURCE */,
            'type': 'string',
            'enum': ['none', 'welcomePage', 'readme', 'newUntitledFile', 'welcomePageInEmptyWorkbench', 'terminal'],
            'enumDescriptions': [
                localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.none' }, "Start without an editor."),
                localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.welcomePage' }, "Open the Welcome page, with content to aid in getting started with VS Code and extensions."),
                localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.readme' }, "Open the README when opening a folder that contains one, fallback to 'welcomePage' otherwise. Note: This is only observed as a global configuration, it will be ignored if set in a workspace or folder configuration."),
                localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.newUntitledFile' }, "Open a new untitled text file (only applies when opening an empty window)."),
                localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.welcomePageInEmptyWorkbench' }, "Open the Welcome page when opening an empty workbench."),
                localize({ comment: ['This is the description for a setting. Values surrounded by single quotes are not to be translated.'], key: 'workbench.startupEditor.terminal' }, "Open a new terminal in the editor area."),
            ],
            'default': 'welcomePage',
            'description': localize('workbench.startupEditor', "Controls which editor is shown at startup, if none are restored from the previous session.")
        },
        'workbench.welcomePage.preferReducedMotion': {
            scope: 1 /* ConfigurationScope.APPLICATION */,
            type: 'boolean',
            default: false,
            deprecationMessage: localize('deprecationMessage', "Deprecated, use the global `workbench.reduceMotion`."),
            description: localize('workbench.welcomePage.preferReducedMotion', "When enabled, reduce motion in welcome page.")
        }
    }
});
registerWorkbenchContribution2(WorkspacePlatformContribution.ID, WorkspacePlatformContribution, 3 /* WorkbenchPhase.AfterRestored */);
registerWorkbenchContribution2(StartupPageEditorResolverContribution.ID, StartupPageEditorResolverContribution, 2 /* WorkbenchPhase.BlockRestore */);
registerWorkbenchContribution2(StartupPageRunnerContribution.ID, StartupPageRunnerContribution, 3 /* WorkbenchPhase.AfterRestored */);
AccessibleViewRegistry.register(new GettingStartedAccessibleView());
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0dGluZ1N0YXJ0ZWQuY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3dlbGNvbWVHZXR0aW5nU3RhcnRlZC9icm93c2VyL2dldHRpbmdTdGFydGVkLmNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3pELE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxrQkFBa0IsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQzFHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQTBCLE1BQU0sMkJBQTJCLENBQUM7QUFDckYsT0FBTyxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFFbEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxhQUFhLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN6SCxPQUFPLEVBQUUsY0FBYyxFQUFFLFVBQVUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBRzlGLE9BQU8sRUFBRSxvQkFBb0IsRUFBdUIsTUFBTSw0QkFBNEIsQ0FBQztBQUN2RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDMUYsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDbEUsT0FBTyxFQUErQixtQkFBbUIsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzVGLE9BQU8sRUFBRSw4QkFBOEIsRUFBa0IsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRyxPQUFPLEVBQXNCLFVBQVUsSUFBSSx1QkFBdUIsRUFBMEIs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