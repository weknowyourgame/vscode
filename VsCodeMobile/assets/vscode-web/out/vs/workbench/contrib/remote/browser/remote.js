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
import './media/remoteViewlet.css';
import * as nls from '../../../../nls.js';
import * as dom from '../../../../base/browser/dom.js';
import { URI } from '../../../../base/common/uri.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IExtensionService, isProposedApiEnabled } from '../../../services/extensions/common/extensions.js';
import { FilterViewPaneContainer } from '../../../browser/parts/views/viewsViewlet.js';
import { VIEWLET_ID } from './remoteExplorer.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { Extensions, IViewDescriptorService } from '../../../common/views.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import Severity from '../../../../base/common/severity.js';
import { ReloadWindowAction } from '../../../browser/actions/windowActions.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { SwitchRemoteViewItem } from './explorerViewItems.js';
import { isStringArray } from '../../../../base/common/types.js';
import { IRemoteExplorerService } from '../../../services/remote/common/remoteExplorerService.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { WorkbenchAsyncDataTree } from '../../../../platform/list/browser/listService.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { Event, Emitter } from '../../../../base/common/event.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import * as icons from './remoteIcons.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ITimerService } from '../../../services/timer/browser/timerService.js';
import { getRemoteName } from '../../../../platform/remote/common/remoteHosts.js';
import { getVirtualWorkspaceLocation } from '../../../../platform/workspace/common/virtualWorkspace.js';
import { IWalkthroughsService } from '../../welcomeGettingStarted/browser/gettingStartedService.js';
import { Schemas } from '../../../../base/common/network.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
class HelpTreeVirtualDelegate {
    getHeight(element) {
        return 22;
    }
    getTemplateId(element) {
        return 'HelpItemTemplate';
    }
}
class HelpTreeRenderer {
    constructor() {
        this.templateId = 'HelpItemTemplate';
    }
    renderTemplate(container) {
        container.classList.add('remote-help-tree-node-item');
        const icon = dom.append(container, dom.$('.remote-help-tree-node-item-icon'));
        const parent = container;
        return { parent, icon };
    }
    renderElement(element, index, templateData) {
        const container = templateData.parent;
        dom.append(container, templateData.icon);
        templateData.icon.classList.add(...element.element.iconClasses);
        const labelContainer = dom.append(container, dom.$('.help-item-label'));
        labelContainer.innerText = element.element.label;
    }
    disposeTemplate(templateData) {
    }
}
class HelpDataSource {
    hasChildren(element) {
        return element instanceof HelpModel;
    }
    getChildren(element) {
        if (element instanceof HelpModel && element.items) {
            return element.items;
        }
        return [];
    }
}
class HelpModel extends Disposable {
    constructor(viewModel, openerService, quickInputService, commandService, remoteExplorerService, environmentService, workspaceContextService, walkthroughsService) {
        super();
        this.viewModel = viewModel;
        this.openerService = openerService;
        this.quickInputService = quickInputService;
        this.commandService = commandService;
        this.remoteExplorerService = remoteExplorerService;
        this.environmentService = environmentService;
        this.workspaceContextService = workspaceContextService;
        this.walkthroughsService = walkthroughsService;
        this.updateItems();
        this._register(viewModel.onDidChangeHelpInformation(() => this.updateItems()));
    }
    createHelpItemValue(info, infoKey) {
        return new HelpItemValue(this.commandService, this.walkthroughsService, info.extensionDescription, (typeof info.remoteName === 'string') ? [info.remoteName] : info.remoteName, info.virtualWorkspace, info[infoKey]);
    }
    updateItems() {
        const helpItems = [];
        const getStarted = this.viewModel.helpInformation.filter(info => info.getStarted);
        if (getStarted.length) {
            const helpItemValues = getStarted.map((info) => this.createHelpItemValue(info, 'getStarted'));
            const getStartedHelpItem = this.items?.find(item => item.icon === icons.getStartedIcon) ?? new GetStartedHelpItem(icons.getStartedIcon, nls.localize('remote.help.getStarted', "Get Started"), helpItemValues, this.quickInputService, this.environmentService, this.openerService, this.remoteExplorerService, this.workspaceContextService, this.commandService);
            getStartedHelpItem.values = helpItemValues;
            helpItems.push(getStartedHelpItem);
        }
        const documentation = this.viewModel.helpInformation.filter(info => info.documentation);
        if (documentation.length) {
            const helpItemValues = documentation.map((info) => this.createHelpItemValue(info, 'documentation'));
            const documentationHelpItem = this.items?.find(item => item.icon === icons.documentationIcon) ?? new HelpItem(icons.documentationIcon, nls.localize('remote.help.documentation', "Read Documentation"), helpItemValues, this.quickInputService, this.environmentService, this.openerService, this.remoteExplorerService, this.workspaceContextService);
            documentationHelpItem.values = helpItemValues;
            helpItems.push(documentationHelpItem);
        }
        const issues = this.viewModel.helpInformation.filter(info => info.issues);
        if (issues.length) {
            const helpItemValues = issues.map((info) => this.createHelpItemValue(info, 'issues'));
            const reviewIssuesHelpItem = this.items?.find(item => item.icon === icons.reviewIssuesIcon) ?? new HelpItem(icons.reviewIssuesIcon, nls.localize('remote.help.issues', "Review Issues"), helpItemValues, this.quickInputService, this.environmentService, this.openerService, this.remoteExplorerService, this.workspaceContextService);
            reviewIssuesHelpItem.values = helpItemValues;
            helpItems.push(reviewIssuesHelpItem);
        }
        if (helpItems.length) {
            const helpItemValues = this.viewModel.helpInformation.map(info => this.createHelpItemValue(info, 'reportIssue'));
            const issueReporterItem = this.items?.find(item => item.icon === icons.reportIssuesIcon) ?? new IssueReporterItem(icons.reportIssuesIcon, nls.localize('remote.help.report', "Report Issue"), helpItemValues, this.quickInputService, this.environmentService, this.commandService, this.openerService, this.remoteExplorerService, this.workspaceContextService);
            issueReporterItem.values = helpItemValues;
            helpItems.push(issueReporterItem);
        }
        if (helpItems.length) {
            this.items = helpItems;
        }
    }
}
class HelpItemValue {
    constructor(commandService, walkthroughService, extensionDescription, remoteAuthority, virtualWorkspace, urlOrCommandOrId) {
        this.commandService = commandService;
        this.walkthroughService = walkthroughService;
        this.extensionDescription = extensionDescription;
        this.remoteAuthority = remoteAuthority;
        this.virtualWorkspace = virtualWorkspace;
        this.urlOrCommandOrId = urlOrCommandOrId;
    }
    get description() {
        return this.getUrl().then(() => this._description);
    }
    get url() {
        return this.getUrl();
    }
    async getUrl() {
        if (this._url === undefined) {
            if (typeof this.urlOrCommandOrId === 'string') {
                const url = URI.parse(this.urlOrCommandOrId);
                if (url.authority) {
                    this._url = this.urlOrCommandOrId;
                }
                else {
                    const urlCommand = this.commandService.executeCommand(this.urlOrCommandOrId).then((result) => {
                        // if executing this command times out, cache its value whenever it eventually resolves
                        this._url = result;
                        return this._url;
                    });
                    // We must be defensive. The command may never return, meaning that no help at all is ever shown!
                    const emptyString = new Promise(resolve => setTimeout(() => resolve(''), 500));
                    this._url = await Promise.race([urlCommand, emptyString]);
                }
            }
            else if (this.urlOrCommandOrId?.id) {
                try {
                    const walkthroughId = `${this.extensionDescription.id}#${this.urlOrCommandOrId.id}`;
                    const walkthrough = await this.walkthroughService.getWalkthrough(walkthroughId);
                    this._description = walkthrough.title;
                    this._url = walkthroughId;
                }
                catch { }
            }
        }
        if (this._url === undefined) {
            this._url = '';
        }
        return this._url;
    }
}
class HelpItemBase {
    constructor(icon, label, values, quickInputService, environmentService, remoteExplorerService, workspaceContextService) {
        this.icon = icon;
        this.label = label;
        this.values = values;
        this.quickInputService = quickInputService;
        this.environmentService = environmentService;
        this.remoteExplorerService = remoteExplorerService;
        this.workspaceContextService = workspaceContextService;
        this.iconClasses = [];
        this.iconClasses.push(...ThemeIcon.asClassNameArray(icon));
        this.iconClasses.push('remote-help-tree-node-item-icon');
    }
    async getActions() {
        return (await Promise.all(this.values.map(async (value) => {
            return {
                label: value.extensionDescription.displayName || value.extensionDescription.identifier.value,
                description: await value.description ?? await value.url,
                url: await value.url,
                extensionDescription: value.extensionDescription
            };
        }))).filter(item => item.description);
    }
    async handleClick() {
        const remoteAuthority = this.environmentService.remoteAuthority;
        if (remoteAuthority) {
            for (let i = 0; i < this.remoteExplorerService.targetType.length; i++) {
                if (remoteAuthority.startsWith(this.remoteExplorerService.targetType[i])) {
                    for (const value of this.values) {
                        if (value.remoteAuthority) {
                            for (const authority of value.remoteAuthority) {
                                if (remoteAuthority.startsWith(authority)) {
                                    await this.takeAction(value.extensionDescription, await value.url);
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        }
        else {
            const virtualWorkspace = getVirtualWorkspaceLocation(this.workspaceContextService.getWorkspace())?.scheme;
            if (virtualWorkspace) {
                for (let i = 0; i < this.remoteExplorerService.targetType.length; i++) {
                    for (const value of this.values) {
                        if (value.virtualWorkspace && value.remoteAuthority) {
                            for (const authority of value.remoteAuthority) {
                                if (this.remoteExplorerService.targetType[i].startsWith(authority) && virtualWorkspace.startsWith(value.virtualWorkspace)) {
                                    await this.takeAction(value.extensionDescription, await value.url);
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        }
        if (this.values.length > 1) {
            const actions = await this.getActions();
            if (actions.length) {
                const action = await this.quickInputService.pick(actions, { placeHolder: nls.localize('pickRemoteExtension', "Select url to open") });
                if (action) {
                    await this.takeAction(action.extensionDescription, action.url);
                }
            }
        }
        else {
            await this.takeAction(this.values[0].extensionDescription, await this.values[0].url);
        }
    }
}
class GetStartedHelpItem extends HelpItemBase {
    constructor(icon, label, values, quickInputService, environmentService, openerService, remoteExplorerService, workspaceContextService, commandService) {
        super(icon, label, values, quickInputService, environmentService, remoteExplorerService, workspaceContextService);
        this.openerService = openerService;
        this.commandService = commandService;
    }
    async takeAction(extensionDescription, urlOrWalkthroughId) {
        if ([Schemas.http, Schemas.https].includes(URI.parse(urlOrWalkthroughId).scheme)) {
            this.openerService.open(urlOrWalkthroughId, { allowCommands: true });
            return;
        }
        this.commandService.executeCommand('workbench.action.openWalkthrough', urlOrWalkthroughId);
    }
}
class HelpItem extends HelpItemBase {
    constructor(icon, label, values, quickInputService, environmentService, openerService, remoteExplorerService, workspaceContextService) {
        super(icon, label, values, quickInputService, environmentService, remoteExplorerService, workspaceContextService);
        this.openerService = openerService;
    }
    async takeAction(extensionDescription, url) {
        await this.openerService.open(URI.parse(url), { allowCommands: true });
    }
}
class IssueReporterItem extends HelpItemBase {
    constructor(icon, label, values, quickInputService, environmentService, commandService, openerService, remoteExplorerService, workspaceContextService) {
        super(icon, label, values, quickInputService, environmentService, remoteExplorerService, workspaceContextService);
        this.commandService = commandService;
        this.openerService = openerService;
    }
    async getActions() {
        return Promise.all(this.values.map(async (value) => {
            return {
                label: value.extensionDescription.displayName || value.extensionDescription.identifier.value,
                description: '',
                url: await value.url,
                extensionDescription: value.extensionDescription
            };
        }));
    }
    async takeAction(extensionDescription, url) {
        if (!url) {
            await this.commandService.executeCommand('workbench.action.openIssueReporter', [extensionDescription.identifier.value]);
        }
        else {
            await this.openerService.open(URI.parse(url));
        }
    }
}
let HelpPanel = class HelpPanel extends ViewPane {
    static { this.ID = '~remote.helpPanel'; }
    static { this.TITLE = nls.localize2('remote.help', "Help and feedback"); }
    constructor(viewModel, options, keybindingService, contextMenuService, contextKeyService, configurationService, instantiationService, viewDescriptorService, openerService, quickInputService, commandService, remoteExplorerService, environmentService, themeService, hoverService, workspaceContextService, walkthroughsService) {
        super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this.viewModel = viewModel;
        this.quickInputService = quickInputService;
        this.commandService = commandService;
        this.remoteExplorerService = remoteExplorerService;
        this.environmentService = environmentService;
        this.workspaceContextService = workspaceContextService;
        this.walkthroughsService = walkthroughsService;
    }
    renderBody(container) {
        super.renderBody(container);
        container.classList.add('remote-help');
        const treeContainer = document.createElement('div');
        treeContainer.classList.add('remote-help-content');
        container.appendChild(treeContainer);
        this.tree = this.instantiationService.createInstance((WorkbenchAsyncDataTree), 'RemoteHelp', treeContainer, new HelpTreeVirtualDelegate(), [new HelpTreeRenderer()], new HelpDataSource(), {
            accessibilityProvider: {
                getAriaLabel: (item) => {
                    return item.label;
                },
                getWidgetAriaLabel: () => nls.localize('remotehelp', "Remote Help")
            }
        });
        const model = this._register(new HelpModel(this.viewModel, this.openerService, this.quickInputService, this.commandService, this.remoteExplorerService, this.environmentService, this.workspaceContextService, this.walkthroughsService));
        this.tree.setInput(model);
        this._register(Event.debounce(this.tree.onDidOpen, (last, event) => event, 75, true)(e => {
            e.element?.handleClick();
        }));
    }
    layoutBody(height, width) {
        super.layoutBody(height, width);
        this.tree.layout(height, width);
    }
};
HelpPanel = __decorate([
    __param(2, IKeybindingService),
    __param(3, IContextMenuService),
    __param(4, IContextKeyService),
    __param(5, IConfigurationService),
    __param(6, IInstantiationService),
    __param(7, IViewDescriptorService),
    __param(8, IOpenerService),
    __param(9, IQuickInputService),
    __param(10, ICommandService),
    __param(11, IRemoteExplorerService),
    __param(12, IWorkbenchEnvironmentService),
    __param(13, IThemeService),
    __param(14, IHoverService),
    __param(15, IWorkspaceContextService),
    __param(16, IWalkthroughsService)
], HelpPanel);
class HelpPanelDescriptor {
    constructor(viewModel) {
        this.id = HelpPanel.ID;
        this.name = HelpPanel.TITLE;
        this.canToggleVisibility = true;
        this.hideByDefault = false;
        this.group = 'help@50';
        this.order = -10;
        this.ctorDescriptor = new SyncDescriptor(HelpPanel, [viewModel]);
    }
}
let RemoteViewPaneContainer = class RemoteViewPaneContainer extends FilterViewPaneContainer {
    constructor(layoutService, telemetryService, contextService, storageService, configurationService, instantiationService, themeService, contextMenuService, extensionService, remoteExplorerService, viewDescriptorService, logService) {
        super(VIEWLET_ID, remoteExplorerService.onDidChangeTargetType, configurationService, layoutService, telemetryService, storageService, instantiationService, themeService, contextMenuService, extensionService, contextService, viewDescriptorService, logService);
        this.remoteExplorerService = remoteExplorerService;
        this.helpPanelDescriptor = new HelpPanelDescriptor(this);
        this.helpInformation = [];
        this._onDidChangeHelpInformation = new Emitter();
        this.onDidChangeHelpInformation = this._onDidChangeHelpInformation.event;
        this.hasRegisteredHelpView = false;
        this.addConstantViewDescriptors([this.helpPanelDescriptor]);
        this._register(this.remoteSwitcher = this.instantiationService.createInstance(SwitchRemoteViewItem));
        this._register(this.remoteExplorerService.onDidChangeHelpInformation(extensions => {
            this._setHelpInformation(extensions);
        }));
        this._setHelpInformation(this.remoteExplorerService.helpInformation);
        const viewsRegistry = Registry.as(Extensions.ViewsRegistry);
        this.remoteSwitcher.createOptionItems(viewsRegistry.getViews(this.viewContainer));
        this._register(viewsRegistry.onViewsRegistered(e => {
            const remoteViews = [];
            for (const view of e) {
                if (view.viewContainer.id === VIEWLET_ID) {
                    remoteViews.push(...view.views);
                }
            }
            if (remoteViews.length > 0) {
                this.remoteSwitcher.createOptionItems(remoteViews);
            }
        }));
        this._register(viewsRegistry.onViewsDeregistered(e => {
            if (e.viewContainer.id === VIEWLET_ID) {
                this.remoteSwitcher.removeOptionItems(e.views);
            }
        }));
    }
    _setHelpInformation(extensions) {
        const helpInformation = [];
        for (const extension of extensions) {
            this._handleRemoteInfoExtensionPoint(extension, helpInformation);
        }
        this.helpInformation = helpInformation;
        this._onDidChangeHelpInformation.fire();
        const viewsRegistry = Registry.as(Extensions.ViewsRegistry);
        if (this.helpInformation.length && !this.hasRegisteredHelpView) {
            const view = viewsRegistry.getView(this.helpPanelDescriptor.id);
            if (!view) {
                viewsRegistry.registerViews([this.helpPanelDescriptor], this.viewContainer);
            }
            this.hasRegisteredHelpView = true;
        }
        else if (this.hasRegisteredHelpView) {
            viewsRegistry.deregisterViews([this.helpPanelDescriptor], this.viewContainer);
            this.hasRegisteredHelpView = false;
        }
    }
    _handleRemoteInfoExtensionPoint(extension, helpInformation) {
        if (!isProposedApiEnabled(extension.description, 'contribRemoteHelp')) {
            return;
        }
        if (!extension.value.documentation && !extension.value.getStarted && !extension.value.issues) {
            return;
        }
        helpInformation.push({
            extensionDescription: extension.description,
            getStarted: extension.value.getStarted,
            documentation: extension.value.documentation,
            reportIssue: extension.value.reportIssue,
            issues: extension.value.issues,
            remoteName: extension.value.remoteName,
            virtualWorkspace: extension.value.virtualWorkspace
        });
    }
    getFilterOn(viewDescriptor) {
        return isStringArray(viewDescriptor.remoteAuthority) ? viewDescriptor.remoteAuthority[0] : viewDescriptor.remoteAuthority;
    }
    setFilter(viewDescriptor) {
        this.remoteExplorerService.targetType = isStringArray(viewDescriptor.remoteAuthority) ? viewDescriptor.remoteAuthority : [viewDescriptor.remoteAuthority];
    }
    getTitle() {
        const title = nls.localize('remote.explorer', "Remote Explorer");
        return title;
    }
};
RemoteViewPaneContainer = __decorate([
    __param(0, IWorkbenchLayoutService),
    __param(1, ITelemetryService),
    __param(2, IWorkspaceContextService),
    __param(3, IStorageService),
    __param(4, IConfigurationService),
    __param(5, IInstantiationService),
    __param(6, IThemeService),
    __param(7, IContextMenuService),
    __param(8, IExtensionService),
    __param(9, IRemoteExplorerService),
    __param(10, IViewDescriptorService),
    __param(11, ILogService)
], RemoteViewPaneContainer);
Registry.as(Extensions.ViewContainersRegistry).registerViewContainer({
    id: VIEWLET_ID,
    title: nls.localize2('remote.explorer', "Remote Explorer"),
    ctorDescriptor: new SyncDescriptor(RemoteViewPaneContainer),
    hideIfEmpty: true,
    viewOrderDelegate: {
        getOrder: (group) => {
            if (!group) {
                return;
            }
            let matches = /^targets@(\d+)$/.exec(group);
            if (matches) {
                return -1000;
            }
            matches = /^details(@(\d+))?$/.exec(group);
            if (matches) {
                return -500 + Number(matches[2]);
            }
            matches = /^help(@(\d+))?$/.exec(group);
            if (matches) {
                return -10;
            }
            return;
        }
    },
    icon: icons.remoteExplorerViewIcon,
    order: 4
}, 0 /* ViewContainerLocation.Sidebar */);
let RemoteMarkers = class RemoteMarkers {
    constructor(remoteAgentService, timerService) {
        remoteAgentService.getEnvironment().then(remoteEnv => {
            if (remoteEnv) {
                timerService.setPerformanceMarks('server', remoteEnv.marks);
            }
        });
    }
};
RemoteMarkers = __decorate([
    __param(0, IRemoteAgentService),
    __param(1, ITimerService)
], RemoteMarkers);
export { RemoteMarkers };
class VisibleProgress {
    get lastReport() {
        return this._lastReport;
    }
    constructor(progressService, location, initialReport, buttons, onDidCancel) {
        this.location = location;
        this._isDisposed = false;
        this._lastReport = initialReport;
        this._currentProgressPromiseResolve = null;
        this._currentProgress = null;
        this._currentTimer = null;
        const promise = new Promise((resolve) => this._currentProgressPromiseResolve = resolve);
        progressService.withProgress({ location: location, buttons: buttons }, (progress) => { if (!this._isDisposed) {
            this._currentProgress = progress;
        } return promise; }, (choice) => onDidCancel(choice, this._lastReport));
        if (this._lastReport) {
            this.report();
        }
    }
    dispose() {
        this._isDisposed = true;
        if (this._currentProgressPromiseResolve) {
            this._currentProgressPromiseResolve();
            this._currentProgressPromiseResolve = null;
        }
        this._currentProgress = null;
        if (this._currentTimer) {
            this._currentTimer.dispose();
            this._currentTimer = null;
        }
    }
    report(message) {
        if (message) {
            this._lastReport = message;
        }
        if (this._lastReport && this._currentProgress) {
            this._currentProgress.report({ message: this._lastReport });
        }
    }
    startTimer(completionTime) {
        this.stopTimer();
        this._currentTimer = new ReconnectionTimer(this, completionTime);
    }
    stopTimer() {
        if (this._currentTimer) {
            this._currentTimer.dispose();
            this._currentTimer = null;
        }
    }
}
class ReconnectionTimer {
    constructor(parent, completionTime) {
        this._parent = parent;
        this._completionTime = completionTime;
        this._renderInterval = dom.disposableWindowInterval(mainWindow, () => this._render(), 1000);
        this._render();
    }
    dispose() {
        this._renderInterval.dispose();
    }
    _render() {
        const remainingTimeMs = this._completionTime - Date.now();
        if (remainingTimeMs < 0) {
            return;
        }
        const remainingTime = Math.ceil(remainingTimeMs / 1000);
        if (remainingTime === 1) {
            this._parent.report(nls.localize('reconnectionWaitOne', "Attempting to reconnect in {0} second...", remainingTime));
        }
        else {
            this._parent.report(nls.localize('reconnectionWaitMany', "Attempting to reconnect in {0} seconds...", remainingTime));
        }
    }
}
/**
 * The time when a prompt is shown to the user
 */
const DISCONNECT_PROMPT_TIME = 40 * 1000; // 40 seconds
let RemoteAgentConnectionStatusListener = class RemoteAgentConnectionStatusListener extends Disposable {
    constructor(remoteAgentService, progressService, dialogService, commandService, quickInputService, logService, environmentService, telemetryService) {
        super();
        this._reloadWindowShown = false;
        const connection = remoteAgentService.getConnection();
        if (connection) {
            let quickInputVisible = false;
            this._register(quickInputService.onShow(() => quickInputVisible = true));
            this._register(quickInputService.onHide(() => quickInputVisible = false));
            let visibleProgress = null;
            let reconnectWaitEvent = null;
            const disposableListener = this._register(new MutableDisposable());
            function showProgress(location, buttons, initialReport = null) {
                if (visibleProgress) {
                    visibleProgress.dispose();
                    visibleProgress = null;
                }
                if (!location) {
                    location = quickInputVisible ? 15 /* ProgressLocation.Notification */ : 20 /* ProgressLocation.Dialog */;
                }
                return new VisibleProgress(progressService, location, initialReport, buttons.map(button => button.label), (choice, lastReport) => {
                    // Handle choice from dialog
                    if (typeof choice !== 'undefined' && buttons[choice]) {
                        buttons[choice].callback();
                    }
                    else {
                        if (location === 20 /* ProgressLocation.Dialog */) {
                            visibleProgress = showProgress(15 /* ProgressLocation.Notification */, buttons, lastReport);
                        }
                        else {
                            hideProgress();
                        }
                    }
                });
            }
            function hideProgress() {
                if (visibleProgress) {
                    visibleProgress.dispose();
                    visibleProgress = null;
                }
            }
            let reconnectionToken = '';
            let lastIncomingDataTime = 0;
            let reconnectionAttempts = 0;
            const reconnectButton = {
                label: nls.localize('reconnectNow', "Reconnect Now"),
                callback: () => {
                    reconnectWaitEvent?.skipWait();
                }
            };
            const reloadButton = {
                label: nls.localize('reloadWindow', "Reload Window"),
                callback: () => {
                    telemetryService.publicLog2('remoteReconnectionReload', {
                        remoteName: getRemoteName(environmentService.remoteAuthority),
                        reconnectionToken: reconnectionToken,
                        millisSinceLastIncomingData: Date.now() - lastIncomingDataTime,
                        attempt: reconnectionAttempts
                    });
                    commandService.executeCommand(ReloadWindowAction.ID);
                }
            };
            // Possible state transitions:
            // ConnectionGain      -> ConnectionLost
            // ConnectionLost      -> ReconnectionWait, ReconnectionRunning
            // ReconnectionWait    -> ReconnectionRunning
            // ReconnectionRunning -> ConnectionGain, ReconnectionPermanentFailure
            this._register(connection.onDidStateChange((e) => {
                visibleProgress?.stopTimer();
                disposableListener.clear();
                switch (e.type) {
                    case 0 /* PersistentConnectionEventType.ConnectionLost */:
                        reconnectionToken = e.reconnectionToken;
                        lastIncomingDataTime = Date.now() - e.millisSinceLastIncomingData;
                        reconnectionAttempts = 0;
                        telemetryService.publicLog2('remoteConnectionLost', {
                            remoteName: getRemoteName(environmentService.remoteAuthority),
                            reconnectionToken: e.reconnectionToken,
                        });
                        if (visibleProgress || e.millisSinceLastIncomingData > DISCONNECT_PROMPT_TIME) {
                            if (!visibleProgress) {
                                visibleProgress = showProgress(null, [reconnectButton, reloadButton]);
                            }
                            visibleProgress.report(nls.localize('connectionLost', "Connection Lost"));
                        }
                        break;
                    case 1 /* PersistentConnectionEventType.ReconnectionWait */:
                        if (visibleProgress) {
                            reconnectWaitEvent = e;
                            visibleProgress = showProgress(null, [reconnectButton, reloadButton]);
                            visibleProgress.startTimer(Date.now() + 1000 * e.durationSeconds);
                        }
                        break;
                    case 2 /* PersistentConnectionEventType.ReconnectionRunning */:
                        reconnectionToken = e.reconnectionToken;
                        lastIncomingDataTime = Date.now() - e.millisSinceLastIncomingData;
                        reconnectionAttempts = e.attempt;
                        telemetryService.publicLog2('remoteReconnectionRunning', {
                            remoteName: getRemoteName(environmentService.remoteAuthority),
                            reconnectionToken: e.reconnectionToken,
                            millisSinceLastIncomingData: e.millisSinceLastIncomingData,
                            attempt: e.attempt
                        });
                        if (visibleProgress || e.millisSinceLastIncomingData > DISCONNECT_PROMPT_TIME) {
                            visibleProgress = showProgress(null, [reloadButton]);
                            visibleProgress.report(nls.localize('reconnectionRunning', "Disconnected. Attempting to reconnect..."));
                            // Register to listen for quick input is opened
                            disposableListener.value = quickInputService.onShow(() => {
                                // Need to move from dialog if being shown and user needs to type in a prompt
                                if (visibleProgress && visibleProgress.location === 20 /* ProgressLocation.Dialog */) {
                                    visibleProgress = showProgress(15 /* ProgressLocation.Notification */, [reloadButton], visibleProgress.lastReport);
                                }
                            });
                        }
                        break;
                    case 3 /* PersistentConnectionEventType.ReconnectionPermanentFailure */:
                        reconnectionToken = e.reconnectionToken;
                        lastIncomingDataTime = Date.now() - e.millisSinceLastIncomingData;
                        reconnectionAttempts = e.attempt;
                        telemetryService.publicLog2('remoteReconnectionPermanentFailure', {
                            remoteName: getRemoteName(environmentService.remoteAuthority),
                            reconnectionToken: e.reconnectionToken,
                            millisSinceLastIncomingData: e.millisSinceLastIncomingData,
                            attempt: e.attempt,
                            handled: e.handled
                        });
                        hideProgress();
                        if (e.handled) {
                            logService.info(`Error handled: Not showing a notification for the error.`);
                            console.log(`Error handled: Not showing a notification for the error.`);
                        }
                        else if (!this._reloadWindowShown) {
                            this._reloadWindowShown = true;
                            dialogService.confirm({
                                type: Severity.Error,
                                message: nls.localize('reconnectionPermanentFailure', "Cannot reconnect. Please reload the window."),
                                primaryButton: nls.localize({ key: 'reloadWindow.dialog', comment: ['&& denotes a mnemonic'] }, "&&Reload Window")
                            }).then(result => {
                                if (result.confirmed) {
                                    commandService.executeCommand(ReloadWindowAction.ID);
                                }
                            });
                        }
                        break;
                    case 4 /* PersistentConnectionEventType.ConnectionGain */:
                        reconnectionToken = e.reconnectionToken;
                        lastIncomingDataTime = Date.now() - e.millisSinceLastIncomingData;
                        reconnectionAttempts = e.attempt;
                        telemetryService.publicLog2('remoteConnectionGain', {
                            remoteName: getRemoteName(environmentService.remoteAuthority),
                            reconnectionToken: e.reconnectionToken,
                            millisSinceLastIncomingData: e.millisSinceLastIncomingData,
                            attempt: e.attempt
                        });
                        hideProgress();
                        break;
                }
            }));
        }
    }
};
RemoteAgentConnectionStatusListener = __decorate([
    __param(0, IRemoteAgentService),
    __param(1, IProgressService),
    __param(2, IDialogService),
    __param(3, ICommandService),
    __param(4, IQuickInputService),
    __param(5, ILogService),
    __param(6, IWorkbenchEnvironmentService),
    __param(7, ITelemetryService)
], RemoteAgentConnectionStatusListener);
export { RemoteAgentConnectionStatusListener };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVtb3RlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3JlbW90ZS9icm93c2VyL3JlbW90ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLDJCQUEyQixDQUFDO0FBQ25DLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDNUYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDdkYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDOUYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNsRixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDOUYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLG9CQUFvQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDNUcsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDdkYsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQ2pELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxN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