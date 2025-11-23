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
import './media/explorerviewlet.css';
import { localize, localize2 } from '../../../../nls.js';
import { mark } from '../../../../base/common/performance.js';
import { VIEWLET_ID, VIEW_ID, ExplorerViewletVisibleContext } from '../common/files.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ExplorerView } from './views/explorerView.js';
import { EmptyView } from './views/emptyView.js';
import { OpenEditorsView } from './views/openEditorsView.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IContextKeyService, ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { Extensions, IViewDescriptorService, ViewContentGroups } from '../../../common/views.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { KeyChord } from '../../../../base/common/keyCodes.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { WorkbenchStateContext, RemoteNameContext, OpenFolderWorkspaceSupportContext } from '../../../common/contextkeys.js';
import { IsWebContext } from '../../../../platform/contextkey/common/contextkeys.js';
import { AddRootFolderAction, OpenFolderAction, OpenFolderViaWorkspaceAction } from '../../../browser/actions/workspaceActions.js';
import { OpenRecentAction } from '../../../browser/actions/windowActions.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { isMouseEvent } from '../../../../base/browser/dom.js';
import { ILogService } from '../../../../platform/log/common/log.js';
const explorerViewIcon = registerIcon('explorer-view-icon', Codicon.files, localize('explorerViewIcon', 'View icon of the explorer view.'));
const openEditorsViewIcon = registerIcon('open-editors-view-icon', Codicon.book, localize('openEditorsIcon', 'View icon of the open editors view.'));
let ExplorerViewletViewsContribution = class ExplorerViewletViewsContribution extends Disposable {
    static { this.ID = 'workbench.contrib.explorerViewletViews'; }
    constructor(workspaceContextService, progressService) {
        super();
        this.workspaceContextService = workspaceContextService;
        progressService.withProgress({ location: 1 /* ProgressLocation.Explorer */ }, () => workspaceContextService.getCompleteWorkspace()).finally(() => {
            this.registerViews();
            this._register(workspaceContextService.onDidChangeWorkbenchState(() => this.registerViews()));
            this._register(workspaceContextService.onDidChangeWorkspaceFolders(() => this.registerViews()));
        });
    }
    registerViews() {
        mark('code/willRegisterExplorerViews');
        const viewDescriptors = viewsRegistry.getViews(VIEW_CONTAINER);
        const viewDescriptorsToRegister = [];
        const viewDescriptorsToDeregister = [];
        const openEditorsViewDescriptor = this.createOpenEditorsViewDescriptor();
        if (!viewDescriptors.some(v => v.id === openEditorsViewDescriptor.id)) {
            viewDescriptorsToRegister.push(openEditorsViewDescriptor);
        }
        const explorerViewDescriptor = this.createExplorerViewDescriptor();
        const registeredExplorerViewDescriptor = viewDescriptors.find(v => v.id === explorerViewDescriptor.id);
        const emptyViewDescriptor = this.createEmptyViewDescriptor();
        const registeredEmptyViewDescriptor = viewDescriptors.find(v => v.id === emptyViewDescriptor.id);
        if (this.workspaceContextService.getWorkbenchState() === 1 /* WorkbenchState.EMPTY */ || this.workspaceContextService.getWorkspace().folders.length === 0) {
            if (registeredExplorerViewDescriptor) {
                viewDescriptorsToDeregister.push(registeredExplorerViewDescriptor);
            }
            if (!registeredEmptyViewDescriptor) {
                viewDescriptorsToRegister.push(emptyViewDescriptor);
            }
        }
        else {
            if (registeredEmptyViewDescriptor) {
                viewDescriptorsToDeregister.push(registeredEmptyViewDescriptor);
            }
            if (!registeredExplorerViewDescriptor) {
                viewDescriptorsToRegister.push(explorerViewDescriptor);
            }
        }
        if (viewDescriptorsToDeregister.length) {
            viewsRegistry.deregisterViews(viewDescriptorsToDeregister, VIEW_CONTAINER);
        }
        if (viewDescriptorsToRegister.length) {
            viewsRegistry.registerViews(viewDescriptorsToRegister, VIEW_CONTAINER);
        }
        mark('code/didRegisterExplorerViews');
    }
    createOpenEditorsViewDescriptor() {
        return {
            id: OpenEditorsView.ID,
            name: OpenEditorsView.NAME,
            ctorDescriptor: new SyncDescriptor(OpenEditorsView),
            containerIcon: openEditorsViewIcon,
            order: 0,
            canToggleVisibility: true,
            canMoveView: true,
            collapsed: false,
            hideByDefault: true,
            focusCommand: {
                id: 'workbench.files.action.focusOpenEditorsView',
                keybindings: { primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 35 /* KeyCode.KeyE */) }
            }
        };
    }
    createEmptyViewDescriptor() {
        return {
            id: EmptyView.ID,
            name: EmptyView.NAME,
            containerIcon: explorerViewIcon,
            ctorDescriptor: new SyncDescriptor(EmptyView),
            order: 1,
            canToggleVisibility: true,
            focusCommand: {
                id: 'workbench.explorer.fileView.focus'
            }
        };
    }
    createExplorerViewDescriptor() {
        return {
            id: VIEW_ID,
            name: localize2('folders', "Folders"),
            containerIcon: explorerViewIcon,
            ctorDescriptor: new SyncDescriptor(ExplorerView),
            order: 1,
            canMoveView: true,
            canToggleVisibility: false,
            focusCommand: {
                id: 'workbench.explorer.fileView.focus'
            }
        };
    }
};
ExplorerViewletViewsContribution = __decorate([
    __param(0, IWorkspaceContextService),
    __param(1, IProgressService)
], ExplorerViewletViewsContribution);
export { ExplorerViewletViewsContribution };
let ExplorerViewPaneContainer = class ExplorerViewPaneContainer extends ViewPaneContainer {
    constructor(layoutService, telemetryService, contextService, storageService, configurationService, instantiationService, contextKeyService, themeService, contextMenuService, extensionService, viewDescriptorService, logService) {
        super(VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }, instantiationService, configurationService, layoutService, contextMenuService, telemetryService, extensionService, themeService, storageService, contextService, viewDescriptorService, logService);
        this.viewletVisibleContextKey = ExplorerViewletVisibleContext.bindTo(contextKeyService);
        this._register(this.contextService.onDidChangeWorkspaceName(e => this.updateTitleArea()));
    }
    create(parent) {
        super.create(parent);
        parent.classList.add('explorer-viewlet');
    }
    createView(viewDescriptor, options) {
        if (viewDescriptor.id === VIEW_ID) {
            return this.instantiationService.createInstance(ExplorerView, {
                ...options, delegate: {
                    willOpenElement: e => {
                        if (!isMouseEvent(e)) {
                            return; // only delay when user clicks
                        }
                        const openEditorsView = this.getOpenEditorsView();
                        if (openEditorsView) {
                            let delay = 0;
                            const config = this.configurationService.getValue();
                            if (config.workbench?.editor?.enablePreview) {
                                // delay open editors view when preview is enabled
                                // to accomodate for the user doing a double click
                                // to pin the editor.
                                // without this delay a double click would be not
                                // possible because the next element would move
                                // under the mouse after the first click.
                                delay = 250;
                            }
                            openEditorsView.setStructuralRefreshDelay(delay);
                        }
                    },
                    didOpenElement: e => {
                        if (!isMouseEvent(e)) {
                            return; // only delay when user clicks
                        }
                        const openEditorsView = this.getOpenEditorsView();
                        openEditorsView?.setStructuralRefreshDelay(0);
                    }
                }
            });
        }
        return super.createView(viewDescriptor, options);
    }
    getExplorerView() {
        return this.getView(VIEW_ID);
    }
    getOpenEditorsView() {
        return this.getView(OpenEditorsView.ID);
    }
    setVisible(visible) {
        this.viewletVisibleContextKey.set(visible);
        super.setVisible(visible);
    }
    focus() {
        const explorerView = this.getView(VIEW_ID);
        if (explorerView && this.panes.every(p => !p.isExpanded())) {
            explorerView.setExpanded(true);
        }
        if (explorerView?.isExpanded()) {
            explorerView.focus();
        }
        else {
            super.focus();
        }
    }
};
ExplorerViewPaneContainer = __decorate([
    __param(0, IWorkbenchLayoutService),
    __param(1, ITelemetryService),
    __param(2, IWorkspaceContextService),
    __param(3, IStorageService),
    __param(4, IConfigurationService),
    __param(5, IInstantiationService),
    __param(6, IContextKeyService),
    __param(7, IThemeService),
    __param(8, IContextMenuService),
    __param(9, IExtensionService),
    __param(10, IViewDescriptorService),
    __param(11, ILogService)
], ExplorerViewPaneContainer);
export { ExplorerViewPaneContainer };
const viewContainerRegistry = Registry.as(Extensions.ViewContainersRegistry);
/**
 * Explorer viewlet container.
 */
export const VIEW_CONTAINER = viewContainerRegistry.registerViewContainer({
    id: VIEWLET_ID,
    title: localize2('explore', "Explorer"),
    ctorDescriptor: new SyncDescriptor(ExplorerViewPaneContainer),
    storageId: 'workbench.explorer.views.state',
    icon: explorerViewIcon,
    alwaysUseContainerInfo: true,
    hideIfEmpty: true,
    order: 0,
    openCommandActionDescriptor: {
        id: VIEWLET_ID,
        title: localize2('explore', "Explorer"),
        mnemonicTitle: localize({ key: 'miViewExplorer', comment: ['&& denotes a mnemonic'] }, "&&Explorer"),
        keybindings: { primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 35 /* KeyCode.KeyE */ },
        order: 0
    },
}, 0 /* ViewContainerLocation.Sidebar */, { isDefault: true });
const openFolder = localize('openFolder', "Open Folder");
const addAFolder = localize('addAFolder', "add a folder");
const openRecent = localize('openRecent', "Open Recent");
const addRootFolderButton = `[${openFolder}](command:${AddRootFolderAction.ID})`;
const addAFolderButton = `[${addAFolder}](command:${AddRootFolderAction.ID})`;
const openFolderButton = `[${openFolder}](command:${OpenFolderAction.ID})`;
const openFolderViaWorkspaceButton = `[${openFolder}](command:${OpenFolderViaWorkspaceAction.ID})`;
const openRecentButton = `[${openRecent}](command:${OpenRecentAction.ID})`;
const viewsRegistry = Registry.as(Extensions.ViewsRegistry);
viewsRegistry.registerViewWelcomeContent(EmptyView.ID, {
    content: localize({ key: 'noWorkspaceHelp', comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change'] }, "You have not yet added a folder to the workspace.\n{0}", addRootFolderButton),
    when: ContextKeyExpr.and(
    // inside a .code-workspace
    WorkbenchStateContext.isEqualTo('workspace'), 
    // unless we cannot enter or open workspaces (e.g. web serverless)
    OpenFolderWorkspaceSupportContext),
    group: ViewContentGroups.Open,
    order: 1
});
viewsRegistry.registerViewWelcomeContent(EmptyView.ID, {
    content: localize({ key: 'noFolderHelpWeb', comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change'] }, "You have not yet opened a folder.\n{0}\n{1}", openFolderViaWorkspaceButton, openRecentButton),
    when: ContextKeyExpr.and(
    // inside a .code-workspace
    WorkbenchStateContext.isEqualTo('workspace'), 
    // we cannot enter workspaces (e.g. web serverless)
    OpenFolderWorkspaceSupportContext.toNegated()),
    group: ViewContentGroups.Open,
    order: 1
});
viewsRegistry.registerViewWelcomeContent(EmptyView.ID, {
    content: localize({ key: 'remoteNoFolderHelp', comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change'] }, "Connected to remote.\n{0}", openFolderButton),
    when: ContextKeyExpr.and(
    // not inside a .code-workspace
    WorkbenchStateContext.notEqualsTo('workspace'), 
    // connected to a remote
    RemoteNameContext.notEqualsTo(''), 
    // but not in web
    IsWebContext.toNegated()),
    group: ViewContentGroups.Open,
    order: 1
});
viewsRegistry.registerViewWelcomeContent(EmptyView.ID, {
    content: localize({ key: 'noFolderButEditorsHelp', comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change'] }, "You have not yet opened a folder.\n{0}\nOpening a folder will close all currently open editors. To keep them open, {1} instead.", openFolderButton, addAFolderButton),
    when: ContextKeyExpr.and(
    // editors are opened
    ContextKeyExpr.has('editorIsOpen'), ContextKeyExpr.or(
    // not inside a .code-workspace and local
    ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo('workspace'), RemoteNameContext.isEqualTo('')), 
    // not inside a .code-workspace and web
    ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo('workspace'), IsWebContext))),
    group: ViewContentGroups.Open,
    order: 1
});
viewsRegistry.registerViewWelcomeContent(EmptyView.ID, {
    content: localize({ key: 'noFolderHelp', comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change'] }, "You have not yet opened a folder.\n{0}", openFolderButton),
    when: ContextKeyExpr.and(
    // no editor is open
    ContextKeyExpr.has('editorIsOpen')?.negate(), ContextKeyExpr.or(
    // not inside a .code-workspace and local
    ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo('workspace'), RemoteNameContext.isEqualTo('')), 
    // not inside a .code-workspace and web
    ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo('workspace'), IsWebContext))),
    group: ViewContentGroups.Open,
    order: 1
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwbG9yZXJWaWV3bGV0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2ZpbGVzL2Jyb3dzZXIvZXhwbG9yZXJWaWV3bGV0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sNkJBQTZCLENBQUM7QUFDckMsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUN6RCxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQXVCLDZCQUE2QixFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFN0csT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUNqRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDN0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSx3QkFBd0IsRUFBa0IsTUFBTSxvREFBb0QsQ0FBQztBQUM5RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN2RixPQUFPLEVBQUUsa0JBQWtCLEVBQWUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdkgsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ2xGLE9BQU8sRUFBbUMs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