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
var InstallAction_1, InstallInWorkspaceAction_1, InstallInRemoteAction_1, UninstallAction_1, ManageMcpServerAction_1, StartServerAction_1, StopServerAction_1, RestartServerAction_1, AuthServerAction_1, ShowServerOutputAction_1, ShowServerConfigurationAction_1, ShowServerJsonConfigurationAction_1, ConfigureModelAccessAction_1, ShowSamplingRequestsAction_1, BrowseResourcesAction_1, McpServerStatusAction_1;
import { getDomNodePagePosition } from '../../../../base/browser/dom.js';
import { ActionViewItem } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { alert } from '../../../../base/browser/ui/aria/aria.js';
import { Action, Separator } from '../../../../base/common/actions.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { disposeIfDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { IAuthenticationQueryService } from '../../../services/authentication/common/authenticationQuery.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { errorIcon, infoIcon, manageExtensionIcon, trustIcon, warningIcon } from '../../extensions/browser/extensionsIcons.js';
import { IMcpRegistry } from '../common/mcpRegistryTypes.js';
import { IMcpSamplingService, IMcpService, IMcpWorkbenchService, McpConnectionState } from '../common/mcpTypes.js';
import { startServerByFilter } from '../common/mcpTypesUtils.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { Schemas } from '../../../../base/common/network.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { ActionWithDropdownActionViewItem } from '../../../../base/browser/ui/dropdown/dropdownActionViewItem.js';
import Severity from '../../../../base/common/severity.js';
export class McpServerAction extends Action {
    constructor() {
        super(...arguments);
        this._onDidChange = this._register(new Emitter());
        this._hidden = false;
        this.hideOnDisabled = true;
        this._mcpServer = null;
    }
    get onDidChange() { return this._onDidChange.event; }
    static { this.EXTENSION_ACTION_CLASS = 'extension-action'; }
    static { this.TEXT_ACTION_CLASS = `${McpServerAction.EXTENSION_ACTION_CLASS} text`; }
    static { this.LABEL_ACTION_CLASS = `${McpServerAction.EXTENSION_ACTION_CLASS} label`; }
    static { this.PROMINENT_LABEL_ACTION_CLASS = `${McpServerAction.LABEL_ACTION_CLASS} prominent`; }
    static { this.ICON_ACTION_CLASS = `${McpServerAction.EXTENSION_ACTION_CLASS} icon`; }
    get hidden() { return this._hidden; }
    set hidden(hidden) {
        if (this._hidden !== hidden) {
            this._hidden = hidden;
            this._onDidChange.fire({ hidden });
        }
    }
    _setEnabled(value) {
        super._setEnabled(value);
        if (this.hideOnDisabled) {
            this.hidden = !value;
        }
    }
    get mcpServer() { return this._mcpServer; }
    set mcpServer(mcpServer) { this._mcpServer = mcpServer; this.update(); }
}
export class ButtonWithDropDownExtensionAction extends McpServerAction {
    get menuActions() { return [...this._menuActions]; }
    get mcpServer() {
        return super.mcpServer;
    }
    set mcpServer(mcpServer) {
        this.actions.forEach(a => a.mcpServer = mcpServer);
        super.mcpServer = mcpServer;
    }
    constructor(id, clazz, actionsGroups) {
        clazz = `${clazz} action-dropdown`;
        super(id, undefined, clazz);
        this.actionsGroups = actionsGroups;
        this.menuActionClassNames = [];
        this._menuActions = [];
        this.menuActionClassNames = clazz.split(' ');
        this.hideOnDisabled = false;
        this.actions = actionsGroups.flat();
        this.update();
        this._register(Event.any(...this.actions.map(a => a.onDidChange))(() => this.update(true)));
        this.actions.forEach(a => this._register(a));
    }
    update(donotUpdateActions) {
        if (!donotUpdateActions) {
            this.actions.forEach(a => a.update());
        }
        const actionsGroups = this.actionsGroups.map(actionsGroup => actionsGroup.filter(a => !a.hidden));
        let actions = [];
        for (const visibleActions of actionsGroups) {
            if (visibleActions.length) {
                actions = [...actions, ...visibleActions, new Separator()];
            }
        }
        actions = actions.length ? actions.slice(0, actions.length - 1) : actions;
        this.primaryAction = actions[0];
        this._menuActions = actions.length > 1 ? actions : [];
        this._onDidChange.fire({ menuActions: this._menuActions });
        if (this.primaryAction) {
            this.enabled = this.primaryAction.enabled;
            this.label = this.getLabel(this.primaryAction);
            this.tooltip = this.primaryAction.tooltip;
        }
        else {
            this.enabled = false;
        }
    }
    async run() {
        if (this.enabled) {
            await this.primaryAction?.run();
        }
    }
    getLabel(action) {
        return action.label;
    }
}
export class ButtonWithDropdownExtensionActionViewItem extends ActionWithDropdownActionViewItem {
    constructor(action, options, contextMenuProvider) {
        super(null, action, options, contextMenuProvider);
        this._register(action.onDidChange(e => {
            if (e.hidden !== undefined || e.menuActions !== undefined) {
                this.updateClass();
            }
        }));
    }
    render(container) {
        super.render(container);
        this.updateClass();
    }
    updateClass() {
        super.updateClass();
        if (this.element && this.dropdownMenuActionViewItem?.element) {
            this.element.classList.toggle('hide', this._action.hidden);
            const isMenuEmpty = this._action.menuActions.length === 0;
            this.element.classList.toggle('empty', isMenuEmpty);
            this.dropdownMenuActionViewItem.element.classList.toggle('hide', isMenuEmpty);
        }
    }
}
let DropDownAction = class DropDownAction extends McpServerAction {
    constructor(id, label, cssClass, enabled, instantiationService) {
        super(id, label, cssClass, enabled);
        this.instantiationService = instantiationService;
        this._actionViewItem = null;
    }
    createActionViewItem(options) {
        this._actionViewItem = this.instantiationService.createInstance(DropDownExtensionActionViewItem, this, options);
        return this._actionViewItem;
    }
    run(actionGroups) {
        this._actionViewItem?.showMenu(actionGroups);
        return Promise.resolve();
    }
};
DropDownAction = __decorate([
    __param(4, IInstantiationService)
], DropDownAction);
export { DropDownAction };
let DropDownExtensionActionViewItem = class DropDownExtensionActionViewItem extends ActionViewItem {
    constructor(action, options, contextMenuService) {
        super(null, action, { ...options, icon: true, label: true });
        this.contextMenuService = contextMenuService;
    }
    showMenu(menuActionGroups) {
        if (this.element) {
            const actions = this.getActions(menuActionGroups);
            const elementPosition = getDomNodePagePosition(this.element);
            const anchor = { x: elementPosition.left, y: elementPosition.top + elementPosition.height + 10 };
            this.contextMenuService.showContextMenu({
                getAnchor: () => anchor,
                getActions: () => actions,
                actionRunner: this.actionRunner,
                onHide: () => disposeIfDisposable(actions)
            });
        }
    }
    getActions(menuActionGroups) {
        let actions = [];
        for (const menuActions of menuActionGroups) {
            actions = [...actions, ...menuActions, new Separator()];
        }
        return actions.length ? actions.slice(0, actions.length - 1) : actions;
    }
};
DropDownExtensionActionViewItem = __decorate([
    __param(2, IContextMenuService)
], DropDownExtensionActionViewItem);
export { DropDownExtensionActionViewItem };
let InstallAction = class InstallAction extends McpServerAction {
    static { InstallAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent install`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(open, mcpWorkbenchService, telemetryService, mcpService) {
        super('extensions.install', localize('install', "Install"), InstallAction_1.CLASS, false);
        this.open = open;
        this.mcpWorkbenchService = mcpWorkbenchService;
        this.telemetryService = telemetryService;
        this.mcpService = mcpService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = InstallAction_1.HIDE;
        if (!this.mcpServer?.gallery && !this.mcpServer?.installable) {
            return;
        }
        if (this.mcpServer.installState !== 3 /* McpServerInstallState.Uninstalled */) {
            return;
        }
        this.class = InstallAction_1.CLASS;
        this.enabled = this.mcpWorkbenchService.canInstall(this.mcpServer) === true;
    }
    async run() {
        if (!this.mcpServer) {
            return;
        }
        if (this.open) {
            this.mcpWorkbenchService.open(this.mcpServer);
            alert(localize('mcpServerInstallation', "Installing MCP Server {0} started. An editor is now open with more details on this MCP Server", this.mcpServer.label));
        }
        this.telemetryService.publicLog2('mcp:action:install', { name: this.mcpServer.gallery?.name });
        const installed = await this.mcpWorkbenchService.install(this.mcpServer);
        await startServerByFilter(this.mcpService, s => {
            return s.definition.label === installed.name;
        });
    }
};
InstallAction = InstallAction_1 = __decorate([
    __param(1, IMcpWorkbenchService),
    __param(2, ITelemetryService),
    __param(3, IMcpService)
], InstallAction);
export { InstallAction };
let InstallInWorkspaceAction = class InstallInWorkspaceAction extends McpServerAction {
    static { InstallInWorkspaceAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent install`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(open, mcpWorkbenchService, workspaceService, quickInputService, telemetryService, mcpService) {
        super('extensions.installWorkspace', localize('installInWorkspace', "Install in Workspace"), InstallAction.CLASS, false);
        this.open = open;
        this.mcpWorkbenchService = mcpWorkbenchService;
        this.workspaceService = workspaceService;
        this.quickInputService = quickInputService;
        this.telemetryService = telemetryService;
        this.mcpService = mcpService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = InstallInWorkspaceAction_1.HIDE;
        if (this.workspaceService.getWorkbenchState() === 1 /* WorkbenchState.EMPTY */) {
            return;
        }
        if (!this.mcpServer?.gallery && !this.mcpServer?.installable) {
            return;
        }
        if (this.mcpServer.installState !== 3 /* McpServerInstallState.Uninstalled */ && this.mcpServer.local?.scope === "workspace" /* LocalMcpServerScope.Workspace */) {
            return;
        }
        this.class = InstallAction.CLASS;
        this.enabled = this.mcpWorkbenchService.canInstall(this.mcpServer) === true;
    }
    async run() {
        if (!this.mcpServer) {
            return;
        }
        if (this.open) {
            this.mcpWorkbenchService.open(this.mcpServer, { preserveFocus: true });
            alert(localize('mcpServerInstallation', "Installing MCP Server {0} started. An editor is now open with more details on this MCP Server", this.mcpServer.label));
        }
        const target = await this.getConfigurationTarget();
        if (!target) {
            return;
        }
        this.telemetryService.publicLog2('mcp:action:install:workspace', { name: this.mcpServer.gallery?.name });
        const installed = await this.mcpWorkbenchService.install(this.mcpServer, { target });
        await startServerByFilter(this.mcpService, s => {
            return s.definition.label === installed.name;
        });
    }
    async getConfigurationTarget() {
        const options = [];
        for (const folder of this.workspaceService.getWorkspace().folders) {
            options.push({ target: folder, label: folder.name, description: localize('install in workspace folder', "Workspace Folder") });
        }
        if (this.workspaceService.getWorkbenchState() === 3 /* WorkbenchState.WORKSPACE */) {
            if (options.length > 0) {
                options.push({ type: 'separator' });
            }
            options.push({ target: 5 /* ConfigurationTarget.WORKSPACE */, label: localize('mcp.target.workspace', "Workspace") });
        }
        if (options.length === 1) {
            return options[0].target;
        }
        const targetPick = await this.quickInputService.pick(options, {
            title: localize('mcp.target.title', "Choose where to install the MCP server"),
        });
        return targetPick?.target;
    }
};
InstallInWorkspaceAction = InstallInWorkspaceAction_1 = __decorate([
    __param(1, IMcpWorkbenchService),
    __param(2, IWorkspaceContextService),
    __param(3, IQuickInputService),
    __param(4, ITelemetryService),
    __param(5, IMcpService)
], InstallInWorkspaceAction);
export { InstallInWorkspaceAction };
let InstallInRemoteAction = class InstallInRemoteAction extends McpServerAction {
    static { InstallInRemoteAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent install`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(open, mcpWorkbenchService, environmentService, telemetryService, labelService, mcpService) {
        super('extensions.installRemote', localize('installInRemote', "Install (Remote)"), InstallAction.CLASS, false);
        this.open = open;
        this.mcpWorkbenchService = mcpWorkbenchService;
        this.environmentService = environmentService;
        this.telemetryService = telemetryService;
        this.labelService = labelService;
        this.mcpService = mcpService;
        const remoteLabel = this.labelService.getHostLabel(Schemas.vscodeRemote, this.environmentService.remoteAuthority);
        this.label = localize('installInRemoteLabel', "Install in {0}", remoteLabel);
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = InstallInRemoteAction_1.HIDE;
        if (!this.environmentService.remoteAuthority) {
            return;
        }
        if (!this.mcpServer?.gallery && !this.mcpServer?.installable) {
            return;
        }
        if (this.mcpServer.installState !== 3 /* McpServerInstallState.Uninstalled */) {
            if (this.mcpServer.local?.scope === "remoteUser" /* LocalMcpServerScope.RemoteUser */) {
                return;
            }
            if (this.mcpWorkbenchService.local.find(mcpServer => mcpServer.name === this.mcpServer?.name && mcpServer.local?.scope === "remoteUser" /* LocalMcpServerScope.RemoteUser */)) {
                return;
            }
        }
        this.class = InstallAction.CLASS;
        this.enabled = this.mcpWorkbenchService.canInstall(this.mcpServer) === true;
    }
    async run() {
        if (!this.mcpServer) {
            return;
        }
        if (this.open) {
            this.mcpWorkbenchService.open(this.mcpServer);
            alert(localize('mcpServerInstallation', "Installing MCP Server {0} started. An editor is now open with more details on this MCP Server", this.mcpServer.label));
        }
        this.telemetryService.publicLog2('mcp:action:install:remote', { name: this.mcpServer.gallery?.name });
        const installed = await this.mcpWorkbenchService.install(this.mcpServer, { target: 4 /* ConfigurationTarget.USER_REMOTE */ });
        await startServerByFilter(this.mcpService, s => {
            return s.definition.label === installed.name;
        });
    }
};
InstallInRemoteAction = InstallInRemoteAction_1 = __decorate([
    __param(1, IMcpWorkbenchService),
    __param(2, IWorkbenchEnvironmentService),
    __param(3, ITelemetryService),
    __param(4, ILabelService),
    __param(5, IMcpService)
], InstallInRemoteAction);
export { InstallInRemoteAction };
export class InstallingLabelAction extends McpServerAction {
    static { this.LABEL = localize('installing', "Installing"); }
    static { this.CLASS = `${McpServerAction.LABEL_ACTION_CLASS} install installing`; }
    constructor() {
        super('extension.installing', InstallingLabelAction.LABEL, InstallingLabelAction.CLASS, false);
    }
    update() {
        this.class = `${InstallingLabelAction.CLASS}${this.mcpServer && this.mcpServer.installState === 0 /* McpServerInstallState.Installing */ ? '' : ' hide'}`;
    }
}
let UninstallAction = class UninstallAction extends McpServerAction {
    static { UninstallAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent uninstall`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpWorkbenchService) {
        super('extensions.uninstall', localize('uninstall', "Uninstall"), UninstallAction_1.CLASS, false);
        this.mcpWorkbenchService = mcpWorkbenchService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = UninstallAction_1.HIDE;
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        if (this.mcpServer.installState !== 1 /* McpServerInstallState.Installed */) {
            this.enabled = false;
            return;
        }
        this.class = UninstallAction_1.CLASS;
        this.enabled = true;
        this.label = localize('uninstall', "Uninstall");
    }
    async run() {
        if (!this.mcpServer) {
            return;
        }
        await this.mcpWorkbenchService.uninstall(this.mcpServer);
    }
};
UninstallAction = UninstallAction_1 = __decorate([
    __param(0, IMcpWorkbenchService)
], UninstallAction);
export { UninstallAction };
export function getContextMenuActions(mcpServer, isEditorAction, instantiationService) {
    return instantiationService.invokeFunction(accessor => {
        const workspaceService = accessor.get(IWorkspaceContextService);
        const environmentService = accessor.get(IWorkbenchEnvironmentService);
        const groups = [];
        const isInstalled = mcpServer.installState === 1 /* McpServerInstallState.Installed */;
        if (isInstalled) {
            groups.push([
                instantiationService.createInstance(StartServerAction),
            ]);
            groups.push([
                instantiationService.createInstance(StopServerAction),
                instantiationService.createInstance(RestartServerAction),
            ]);
            groups.push([
                instantiationService.createInstance(AuthServerAction),
            ]);
            groups.push([
                instantiationService.createInstance(ShowServerOutputAction),
                instantiationService.createInstance(ShowServerConfigurationAction),
                instantiationService.createInstance(ShowServerJsonConfigurationAction),
            ]);
            groups.push([
                instantiationService.createInstance(ConfigureModelAccessAction),
                instantiationService.createInstance(ShowSamplingRequestsAction),
            ]);
            groups.push([
                instantiationService.createInstance(BrowseResourcesAction),
            ]);
            if (!isEditorAction) {
                const installGroup = [instantiationService.createInstance(UninstallAction)];
                if (workspaceService.getWorkbenchState() !== 1 /* WorkbenchState.EMPTY */) {
                    installGroup.push(instantiationService.createInstance(InstallInWorkspaceAction, false));
                }
                if (environmentService.remoteAuthority && mcpServer.local?.scope !== "remoteUser" /* LocalMcpServerScope.RemoteUser */) {
                    installGroup.push(instantiationService.createInstance(InstallInRemoteAction, false));
                }
                groups.push(installGroup);
            }
        }
        else {
            const installGroup = [];
            if (workspaceService.getWorkbenchState() !== 1 /* WorkbenchState.EMPTY */) {
                installGroup.push(instantiationService.createInstance(InstallInWorkspaceAction, !isEditorAction));
            }
            if (environmentService.remoteAuthority) {
                installGroup.push(instantiationService.createInstance(InstallInRemoteAction, !isEditorAction));
            }
            groups.push(installGroup);
        }
        groups.forEach(group => group.forEach(extensionAction => extensionAction.mcpServer = mcpServer));
        return groups;
    });
}
let ManageMcpServerAction = class ManageMcpServerAction extends DropDownAction {
    static { ManageMcpServerAction_1 = this; }
    static { this.ID = 'mcpServer.manage'; }
    static { this.Class = `${McpServerAction.ICON_ACTION_CLASS} manage ` + ThemeIcon.asClassName(manageExtensionIcon); }
    static { this.HideManageExtensionClass = `${this.Class} hide`; }
    constructor(isEditorAction, instantiationService) {
        super(ManageMcpServerAction_1.ID, '', '', true, instantiationService);
        this.isEditorAction = isEditorAction;
        this.tooltip = localize('manage', "Manage");
        this.update();
    }
    async run() {
        return super.run(this.mcpServer ? getContextMenuActions(this.mcpServer, this.isEditorAction, this.instantiationService) : []);
    }
    update() {
        this.class = ManageMcpServerAction_1.HideManageExtensionClass;
        this.enabled = false;
        if (!this.mcpServer) {
            return;
        }
        if (this.isEditorAction) {
            this.enabled = true;
            this.class = ManageMcpServerAction_1.Class;
        }
        else {
            this.enabled = !!this.mcpServer.local;
            this.class = this.enabled ? ManageMcpServerAction_1.Class : ManageMcpServerAction_1.HideManageExtensionClass;
        }
    }
};
ManageMcpServerAction = ManageMcpServerAction_1 = __decorate([
    __param(1, IInstantiationService)
], ManageMcpServerAction);
export { ManageMcpServerAction };
let StartServerAction = class StartServerAction extends McpServerAction {
    static { StartServerAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent start`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpService) {
        super('extensions.start', localize('start', "Start Server"), StartServerAction_1.CLASS, false);
        this.mcpService = mcpService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = StartServerAction_1.HIDE;
        const server = this.getServer();
        if (!server) {
            return;
        }
        const serverState = server.connectionState.get();
        if (!McpConnectionState.canBeStarted(serverState.state)) {
            return;
        }
        this.class = StartServerAction_1.CLASS;
        this.enabled = true;
        this.label = localize('start', "Start Server");
    }
    async run() {
        const server = this.getServer();
        if (!server) {
            return;
        }
        await server.start({ promptType: 'all-untrusted' });
        server.showOutput();
    }
    getServer() {
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        return this.mcpService.servers.get().find(s => s.definition.id === this.mcpServer?.id);
    }
};
StartServerAction = StartServerAction_1 = __decorate([
    __param(0, IMcpService)
], StartServerAction);
export { StartServerAction };
let StopServerAction = class StopServerAction extends McpServerAction {
    static { StopServerAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent stop`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpService) {
        super('extensions.stop', localize('stop', "Stop Server"), StopServerAction_1.CLASS, false);
        this.mcpService = mcpService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = StopServerAction_1.HIDE;
        const server = this.getServer();
        if (!server) {
            return;
        }
        const serverState = server.connectionState.get();
        if (McpConnectionState.canBeStarted(serverState.state)) {
            return;
        }
        this.class = StopServerAction_1.CLASS;
        this.enabled = true;
        this.label = localize('stop', "Stop Server");
    }
    async run() {
        const server = this.getServer();
        if (!server) {
            return;
        }
        await server.stop();
    }
    getServer() {
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        return this.mcpService.servers.get().find(s => s.definition.id === this.mcpServer?.id);
    }
};
StopServerAction = StopServerAction_1 = __decorate([
    __param(0, IMcpService)
], StopServerAction);
export { StopServerAction };
let RestartServerAction = class RestartServerAction extends McpServerAction {
    static { RestartServerAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent restart`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpService) {
        super('extensions.restart', localize('restart', "Restart Server"), RestartServerAction_1.CLASS, false);
        this.mcpService = mcpService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = RestartServerAction_1.HIDE;
        const server = this.getServer();
        if (!server) {
            return;
        }
        const serverState = server.connectionState.get();
        if (McpConnectionState.canBeStarted(serverState.state)) {
            return;
        }
        this.class = RestartServerAction_1.CLASS;
        this.enabled = true;
        this.label = localize('restart', "Restart Server");
    }
    async run() {
        const server = this.getServer();
        if (!server) {
            return;
        }
        await server.stop();
        await server.start({ promptType: 'all-untrusted' });
        server.showOutput();
    }
    getServer() {
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        return this.mcpService.servers.get().find(s => s.definition.id === this.mcpServer?.id);
    }
};
RestartServerAction = RestartServerAction_1 = __decorate([
    __param(0, IMcpService)
], RestartServerAction);
export { RestartServerAction };
let AuthServerAction = class AuthServerAction extends McpServerAction {
    static { AuthServerAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent account`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    static { this.SIGN_OUT = localize('mcp.signOut', 'Sign Out'); }
    static { this.DISCONNECT = localize('mcp.disconnect', 'Disconnect Account'); }
    constructor(mcpService, _authenticationQueryService, _authenticationService) {
        super('extensions.restart', localize('restart', "Restart Server"), RestartServerAction.CLASS, false);
        this.mcpService = mcpService;
        this._authenticationQueryService = _authenticationQueryService;
        this._authenticationService = _authenticationService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = AuthServerAction_1.HIDE;
        const server = this.getServer();
        if (!server) {
            return;
        }
        const accountQuery = this.getAccountQuery();
        if (!accountQuery) {
            return;
        }
        this._accountQuery = accountQuery;
        this.class = AuthServerAction_1.CLASS;
        this.enabled = true;
        let label = accountQuery.entities().getEntityCount().total > 1 ? AuthServerAction_1.DISCONNECT : AuthServerAction_1.SIGN_OUT;
        label += ` (${accountQuery.accountName})`;
        this.label = label;
    }
    async run() {
        const server = this.getServer();
        if (!server) {
            return;
        }
        const accountQuery = this.getAccountQuery();
        if (!accountQuery) {
            return;
        }
        await server.stop();
        const { providerId, accountName } = accountQuery;
        accountQuery.mcpServer(server.definition.id).setAccessAllowed(false, server.definition.label);
        if (this.label === AuthServerAction_1.SIGN_OUT) {
            const accounts = await this._authenticationService.getAccounts(providerId);
            const account = accounts.find(a => a.label === accountName);
            if (account) {
                const sessions = await this._authenticationService.getSessions(providerId, undefined, { account });
                for (const session of sessions) {
                    await this._authenticationService.removeSession(providerId, session.id);
                }
            }
        }
    }
    getServer() {
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        return this.mcpService.servers.get().find(s => s.definition.id === this.mcpServer?.id);
    }
    getAccountQuery() {
        const server = this.getServer();
        if (!server) {
            return undefined;
        }
        if (this._accountQuery) {
            return this._accountQuery;
        }
        const serverId = server.definition.id;
        const preferences = this._authenticationQueryService.mcpServer(serverId).getAllAccountPreferences();
        if (!preferences.size) {
            return undefined;
        }
        for (const [providerId, accountName] of preferences) {
            const accountQuery = this._authenticationQueryService.provider(providerId).account(accountName);
            if (!accountQuery.mcpServer(serverId).isAccessAllowed()) {
                continue; // skip accounts that are not allowed
            }
            return accountQuery;
        }
        return undefined;
    }
};
AuthServerAction = AuthServerAction_1 = __decorate([
    __param(0, IMcpService),
    __param(1, IAuthenticationQueryService),
    __param(2, IAuthenticationService)
], AuthServerAction);
export { AuthServerAction };
let ShowServerOutputAction = class ShowServerOutputAction extends McpServerAction {
    static { ShowServerOutputAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent output`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpService) {
        super('extensions.output', localize('output', "Show Output"), ShowServerOutputAction_1.CLASS, false);
        this.mcpService = mcpService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = ShowServerOutputAction_1.HIDE;
        const server = this.getServer();
        if (!server) {
            return;
        }
        this.class = ShowServerOutputAction_1.CLASS;
        this.enabled = true;
        this.label = localize('output', "Show Output");
    }
    async run() {
        const server = this.getServer();
        if (!server) {
            return;
        }
        server.showOutput();
    }
    getServer() {
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        return this.mcpService.servers.get().find(s => s.definition.id === this.mcpServer?.id);
    }
};
ShowServerOutputAction = ShowServerOutputAction_1 = __decorate([
    __param(0, IMcpService)
], ShowServerOutputAction);
export { ShowServerOutputAction };
let ShowServerConfigurationAction = class ShowServerConfigurationAction extends McpServerAction {
    static { ShowServerConfigurationAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent config`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpWorkbenchService) {
        super('extensions.config', localize('config', "Show Configuration"), ShowServerConfigurationAction_1.CLASS, false);
        this.mcpWorkbenchService = mcpWorkbenchService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = ShowServerConfigurationAction_1.HIDE;
        if (!this.mcpServer?.local) {
            return;
        }
        this.class = ShowServerConfigurationAction_1.CLASS;
        this.enabled = true;
    }
    async run() {
        if (!this.mcpServer?.local) {
            return;
        }
        this.mcpWorkbenchService.open(this.mcpServer, { tab: "configuration" /* McpServerEditorTab.Configuration */ });
    }
};
ShowServerConfigurationAction = ShowServerConfigurationAction_1 = __decorate([
    __param(0, IMcpWorkbenchService)
], ShowServerConfigurationAction);
export { ShowServerConfigurationAction };
let ShowServerJsonConfigurationAction = class ShowServerJsonConfigurationAction extends McpServerAction {
    static { ShowServerJsonConfigurationAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent config`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpService, mcpRegistry, editorService) {
        super('extensions.jsonConfig', localize('configJson', "Show Configuration (JSON)"), ShowServerJsonConfigurationAction_1.CLASS, false);
        this.mcpService = mcpService;
        this.mcpRegistry = mcpRegistry;
        this.editorService = editorService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = ShowServerJsonConfigurationAction_1.HIDE;
        const configurationTarget = this.getConfigurationTarget();
        if (!configurationTarget) {
            return;
        }
        this.class = ShowServerConfigurationAction.CLASS;
        this.enabled = true;
    }
    async run() {
        const configurationTarget = this.getConfigurationTarget();
        if (!configurationTarget) {
            return;
        }
        this.editorService.openEditor({
            resource: URI.isUri(configurationTarget) ? configurationTarget : configurationTarget.uri,
            options: { selection: URI.isUri(configurationTarget) ? undefined : configurationTarget.range }
        });
    }
    getConfigurationTarget() {
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        const server = this.mcpService.servers.get().find(s => s.definition.label === this.mcpServer?.name);
        if (!server) {
            return;
        }
        const collection = this.mcpRegistry.collections.get().find(c => c.id === server.collection.id);
        const serverDefinition = collection?.serverDefinitions.get().find(s => s.id === server.definition.id);
        return serverDefinition?.presentation?.origin || collection?.presentation?.origin;
    }
};
ShowServerJsonConfigurationAction = ShowServerJsonConfigurationAction_1 = __decorate([
    __param(0, IMcpService),
    __param(1, IMcpRegistry),
    __param(2, IEditorService)
], ShowServerJsonConfigurationAction);
export { ShowServerJsonConfigurationAction };
let ConfigureModelAccessAction = class ConfigureModelAccessAction extends McpServerAction {
    static { ConfigureModelAccessAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent config`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpService, commandService) {
        super('extensions.config', localize('mcp.configAccess', 'Configure Model Access'), ConfigureModelAccessAction_1.CLASS, false);
        this.mcpService = mcpService;
        this.commandService = commandService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = ConfigureModelAccessAction_1.HIDE;
        const server = this.getServer();
        if (!server) {
            return;
        }
        this.class = ConfigureModelAccessAction_1.CLASS;
        this.enabled = true;
        this.label = localize('mcp.configAccess', 'Configure Model Access');
    }
    async run() {
        const server = this.getServer();
        if (!server) {
            return;
        }
        this.commandService.executeCommand("workbench.mcp.configureSamplingModels" /* McpCommandIds.ConfigureSamplingModels */, server);
    }
    getServer() {
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        return this.mcpService.servers.get().find(s => s.definition.id === this.mcpServer?.id);
    }
};
ConfigureModelAccessAction = ConfigureModelAccessAction_1 = __decorate([
    __param(0, IMcpService),
    __param(1, ICommandService)
], ConfigureModelAccessAction);
export { ConfigureModelAccessAction };
let ShowSamplingRequestsAction = class ShowSamplingRequestsAction extends McpServerAction {
    static { ShowSamplingRequestsAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent config`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpService, samplingService, editorService) {
        super('extensions.config', localize('mcp.samplingLog', 'Show Sampling Requests'), ShowSamplingRequestsAction_1.CLASS, false);
        this.mcpService = mcpService;
        this.samplingService = samplingService;
        this.editorService = editorService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = ShowSamplingRequestsAction_1.HIDE;
        const server = this.getServer();
        if (!server) {
            return;
        }
        if (!this.samplingService.hasLogs(server)) {
            return;
        }
        this.class = ShowSamplingRequestsAction_1.CLASS;
        this.enabled = true;
    }
    async run() {
        const server = this.getServer();
        if (!server) {
            return;
        }
        if (!this.samplingService.hasLogs(server)) {
            return;
        }
        this.editorService.openEditor({
            resource: undefined,
            contents: this.samplingService.getLogText(server),
            label: localize('mcp.samplingLog.title', 'MCP Sampling: {0}', server.definition.label),
        });
    }
    getServer() {
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        return this.mcpService.servers.get().find(s => s.definition.id === this.mcpServer?.id);
    }
};
ShowSamplingRequestsAction = ShowSamplingRequestsAction_1 = __decorate([
    __param(0, IMcpService),
    __param(1, IMcpSamplingService),
    __param(2, IEditorService)
], ShowSamplingRequestsAction);
export { ShowSamplingRequestsAction };
let BrowseResourcesAction = class BrowseResourcesAction extends McpServerAction {
    static { BrowseResourcesAction_1 = this; }
    static { this.CLASS = `${this.LABEL_ACTION_CLASS} prominent config`; }
    static { this.HIDE = `${this.CLASS} hide`; }
    constructor(mcpService, commandService) {
        super('extensions.config', localize('mcp.resources', 'Browse Resources'), BrowseResourcesAction_1.CLASS, false);
        this.mcpService = mcpService;
        this.commandService = commandService;
        this.update();
    }
    update() {
        this.enabled = false;
        this.class = BrowseResourcesAction_1.HIDE;
        const server = this.getServer();
        if (!server) {
            return;
        }
        const capabilities = server.capabilities.get();
        if (capabilities !== undefined && !(capabilities & 16 /* McpCapability.Resources */)) {
            return;
        }
        this.class = BrowseResourcesAction_1.CLASS;
        this.enabled = true;
    }
    async run() {
        const server = this.getServer();
        if (!server) {
            return;
        }
        const capabilities = server.capabilities.get();
        if (capabilities !== undefined && !(capabilities & 16 /* McpCapability.Resources */)) {
            return;
        }
        return this.commandService.executeCommand("workbench.mcp.browseResources" /* McpCommandIds.BrowseResources */, server);
    }
    getServer() {
        if (!this.mcpServer) {
            return;
        }
        if (!this.mcpServer.local) {
            return;
        }
        return this.mcpService.servers.get().find(s => s.definition.id === this.mcpServer?.id);
    }
};
BrowseResourcesAction = BrowseResourcesAction_1 = __decorate([
    __param(0, IMcpService),
    __param(1, ICommandService)
], BrowseResourcesAction);
export { BrowseResourcesAction };
let McpServerStatusAction = class McpServerStatusAction extends McpServerAction {
    static { McpServerStatusAction_1 = this; }
    static { this.CLASS = `${McpServerAction.ICON_ACTION_CLASS} extension-status`; }
    get status() { return this._status; }
    constructor(mcpWorkbenchService, commandService) {
        super('extensions.status', '', `${McpServerStatusAction_1.CLASS} hide`, false);
        this.mcpWorkbenchService = mcpWorkbenchService;
        this.commandService = commandService;
        this._status = [];
        this._onDidChangeStatus = this._register(new Emitter());
        this.onDidChangeStatus = this._onDidChangeStatus.event;
        this.update();
    }
    update() {
        this.computeAndUpdateStatus();
    }
    computeAndUpdateStatus() {
        this.updateStatus(undefined, true);
        this.enabled = false;
        if (!this.mcpServer) {
            return;
        }
        if ((this.mcpServer.gallery || this.mcpServer.installable) && this.mcpServer.installState === 3 /* McpServerInstallState.Uninstalled */) {
            const result = this.mcpWorkbenchService.canInstall(this.mcpServer);
            if (result !== true) {
                this.updateStatus({ icon: warningIcon, message: result }, true);
                return;
            }
        }
        const runtimeState = this.mcpServer.runtimeStatus;
        if (runtimeState?.message) {
            this.updateStatus({ icon: runtimeState.message.severity === Severity.Warning ? warningIcon : runtimeState.message.severity === Severity.Error ? errorIcon : infoIcon, message: runtimeState.message.text }, true);
        }
    }
    updateStatus(status, updateClass) {
        if (status) {
            if (this._status.some(s => s.message.value === status.message.value && s.icon?.id === status.icon?.id)) {
                return;
            }
        }
        else {
            if (this._status.length === 0) {
                return;
            }
            this._status = [];
        }
        if (status) {
            this._status.push(status);
            this._status.sort((a, b) => b.icon === trustIcon ? -1 :
                a.icon === trustIcon ? 1 :
                    b.icon === errorIcon ? -1 :
                        a.icon === errorIcon ? 1 :
                            b.icon === warningIcon ? -1 :
                                a.icon === warningIcon ? 1 :
                                    b.icon === infoIcon ? -1 :
                                        a.icon === infoIcon ? 1 :
                                            0);
        }
        if (updateClass) {
            if (status?.icon === errorIcon) {
                this.class = `${McpServerStatusAction_1.CLASS} extension-status-error ${ThemeIcon.asClassName(errorIcon)}`;
            }
            else if (status?.icon === warningIcon) {
                this.class = `${McpServerStatusAction_1.CLASS} extension-status-warning ${ThemeIcon.asClassName(warningIcon)}`;
            }
            else if (status?.icon === infoIcon) {
                this.class = `${McpServerStatusAction_1.CLASS} extension-status-info ${ThemeIcon.asClassName(infoIcon)}`;
            }
            else if (status?.icon === trustIcon) {
                this.class = `${McpServerStatusAction_1.CLASS} ${ThemeIcon.asClassName(trustIcon)}`;
            }
            else {
                this.class = `${McpServerStatusAction_1.CLASS} hide`;
            }
        }
        this._onDidChangeStatus.fire();
    }
    async run() {
        if (this._status[0]?.icon === trustIcon) {
            return this.commandService.executeCommand('workbench.trust.manage');
        }
    }
};
McpServerStatusAction = McpServerStatusAction_1 = __decorate([
    __param(0, IMcpWorkbenchService),
    __param(1, ICommandService)
], McpServerStatusAction);
export { McpServerStatusAction };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwU2VydmVyQWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvYnJvd3Nlci9tY3BTZXJ2ZXJBY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsY0FBYyxFQUEwQixNQUFNLDBEQUEwRCxDQUFDO0FBQ2xILE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNqRSxPQUFPLEVBQUUsTUFBTSxFQUErQixTQUFTLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNwRyxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRWxFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBRTlDLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNuRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM5RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN2RixPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUNuRyxPQUFPLEVBQWlCLDJCQUEyQixFQUFFLE1BQU0sZ0VBQWdFLENBQUM7QUFDNUgsT0FBTyxFQUFF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