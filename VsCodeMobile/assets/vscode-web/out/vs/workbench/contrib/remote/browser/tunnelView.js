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
var TunnelPanel_1;
import './media/tunnelView.css';
import * as nls from '../../../../nls.js';
import * as dom from '../../../../base/browser/dom.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService, IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IContextKeyService, RawContextKey, ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ICommandService, CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { Event } from '../../../../base/common/event.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { Disposable, toDisposable, dispose, DisposableStore } from '../../../../base/common/lifecycle.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { IconLabel } from '../../../../base/browser/ui/iconLabel/iconLabel.js';
import { ActionRunner } from '../../../../base/common/actions.js';
import { IMenuService, MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { createActionViewItem, getFlatActionBarActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IRemoteExplorerService, TunnelType, TUNNEL_VIEW_ID, TunnelEditId } from '../../../services/remote/common/remoteExplorerService.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { InputBox } from '../../../../base/browser/ui/inputbox/inputBox.js';
import { createSingleCallFunction } from '../../../../base/common/functional.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { URI } from '../../../../base/common/uri.js';
import { isAllInterfaces, isLocalhost, isRemoteTunnel, ITunnelService, TunnelPrivacyId, TunnelProtocol } from '../../../../platform/tunnel/common/tunnel.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { KeybindingsRegistry } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ActionViewItem } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { copyAddressIcon, forwardedPortWithoutProcessIcon, forwardedPortWithProcessIcon, forwardPortIcon, labelPortIcon, openBrowserIcon, openPreviewIcon, portsViewIcon, privatePortIcon, stopForwardIcon } from './remoteIcons.js';
import { IExternalUriOpenerService } from '../../externalUriOpener/common/externalUriOpenerService.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { isMacintosh } from '../../../../base/common/platform.js';
import { WorkbenchTable } from '../../../../platform/list/browser/listService.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { registerColor } from '../../../../platform/theme/common/colorRegistry.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { STATUS_BAR_REMOTE_ITEM_BACKGROUND } from '../../../common/theme.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { defaultButtonStyles, defaultInputBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { TunnelCloseReason, TunnelSource, forwardedPortsViewEnabled, makeAddress, mapHasAddressLocalhostOrAllInterfaces, parseAddress } from '../../../services/remote/common/tunnelModel.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
export const openPreviewEnabledContext = new RawContextKey('openPreviewEnabled', false);
class TunnelTreeVirtualDelegate {
    constructor(remoteExplorerService) {
        this.remoteExplorerService = remoteExplorerService;
        this.headerRowHeight = 22;
    }
    getHeight(row) {
        return (row.tunnelType === TunnelType.Add && !this.remoteExplorerService.getEditableData(undefined)) ? 30 : 22;
    }
}
let TunnelViewModel = class TunnelViewModel {
    constructor(remoteExplorerService, tunnelService) {
        this.remoteExplorerService = remoteExplorerService;
        this.tunnelService = tunnelService;
        this._candidates = new Map();
        this.input = {
            label: nls.localize('remote.tunnelsView.addPort', "Add Port"),
            icon: undefined,
            tunnelType: TunnelType.Add,
            hasRunningProcess: false,
            remoteHost: '',
            remotePort: 0,
            processDescription: '',
            tooltipPostfix: '',
            iconTooltip: '',
            portTooltip: '',
            processTooltip: '',
            originTooltip: '',
            privacyTooltip: '',
            source: { source: TunnelSource.User, description: '' },
            protocol: TunnelProtocol.Http,
            privacy: {
                id: TunnelPrivacyId.Private,
                themeIcon: privatePortIcon.id,
                label: nls.localize('tunnelPrivacy.private', "Private")
            },
            strip: () => undefined
        };
        this.model = remoteExplorerService.tunnelModel;
        this.onForwardedPortsChanged = Event.any(this.model.onForwardPort, this.model.onClosePort, this.model.onPortName, this.model.onCandidatesChanged);
    }
    get all() {
        const result = [];
        this._candidates = new Map();
        this.model.candidates.forEach(candidate => {
            this._candidates.set(makeAddress(candidate.host, candidate.port), candidate);
        });
        if ((this.model.forwarded.size > 0) || this.remoteExplorerService.getEditableData(undefined)) {
            result.push(...this.forwarded);
        }
        if (this.model.detected.size > 0) {
            result.push(...this.detected);
        }
        result.push(this.input);
        return result;
    }
    addProcessInfoFromCandidate(tunnelItem) {
        const key = makeAddress(tunnelItem.remoteHost, tunnelItem.remotePort);
        if (this._candidates.has(key)) {
            tunnelItem.processDescription = this._candidates.get(key).detail;
        }
    }
    get forwarded() {
        const forwarded = Array.from(this.model.forwarded.values()).map(tunnel => {
            const tunnelItem = TunnelItem.createFromTunnel(this.remoteExplorerService, this.tunnelService, tunnel);
            this.addProcessInfoFromCandidate(tunnelItem);
            return tunnelItem;
        }).sort((a, b) => {
            if (a.remotePort === b.remotePort) {
                return a.remoteHost < b.remoteHost ? -1 : 1;
            }
            else {
                return a.remotePort < b.remotePort ? -1 : 1;
            }
        });
        return forwarded;
    }
    get detected() {
        return Array.from(this.model.detected.values()).map(tunnel => {
            const tunnelItem = TunnelItem.createFromTunnel(this.remoteExplorerService, this.tunnelService, tunnel, TunnelType.Detected, false);
            this.addProcessInfoFromCandidate(tunnelItem);
            return tunnelItem;
        });
    }
    isEmpty() {
        return (this.detected.length === 0) &&
            ((this.forwarded.length === 0) || (this.forwarded.length === 1 &&
                (this.forwarded[0].tunnelType === TunnelType.Add) && !this.remoteExplorerService.getEditableData(undefined)));
    }
};
TunnelViewModel = __decorate([
    __param(0, IRemoteExplorerService),
    __param(1, ITunnelService)
], TunnelViewModel);
export { TunnelViewModel };
function emptyCell(item) {
    return { label: '', tunnel: item, editId: TunnelEditId.None, tooltip: '' };
}
class IconColumn {
    constructor() {
        this.label = '';
        this.tooltip = '';
        this.weight = 1;
        this.minimumWidth = 40;
        this.maximumWidth = 40;
        this.templateId = 'actionbar';
    }
    project(row) {
        if (row.tunnelType === TunnelType.Add) {
            return emptyCell(row);
        }
        const icon = row.processDescription ? forwardedPortWithProcessIcon : forwardedPortWithoutProcessIcon;
        let tooltip = '';
        if (row instanceof TunnelItem) {
            tooltip = `${row.iconTooltip} ${row.tooltipPostfix}`;
        }
        return {
            label: '', icon, tunnel: row, editId: TunnelEditId.None, tooltip
        };
    }
}
class PortColumn {
    constructor() {
        this.label = nls.localize('tunnel.portColumn.label', "Port");
        this.tooltip = nls.localize('tunnel.portColumn.tooltip', "The label and remote port number of the forwarded port.");
        this.weight = 1;
        this.templateId = 'actionbar';
    }
    project(row) {
        const isAdd = row.tunnelType === TunnelType.Add;
        const label = row.label;
        let tooltip = '';
        if (row instanceof TunnelItem && !isAdd) {
            tooltip = `${row.portTooltip} ${row.tooltipPostfix}`;
        }
        else {
            tooltip = label;
        }
        return {
            label, tunnel: row, menuId: MenuId.TunnelPortInline,
            editId: row.tunnelType === TunnelType.Add ? TunnelEditId.New : TunnelEditId.Label, tooltip
        };
    }
}
class LocalAddressColumn {
    constructor() {
        this.label = nls.localize('tunnel.addressColumn.label', "Forwarded Address");
        this.tooltip = nls.localize('tunnel.addressColumn.tooltip', "The address that the forwarded port is available at.");
        this.weight = 1;
        this.templateId = 'actionbar';
    }
    project(row) {
        if (row.tunnelType === TunnelType.Add) {
            return emptyCell(row);
        }
        const label = row.localAddress ?? '';
        let tooltip = label;
        if (row instanceof TunnelItem) {
            tooltip = row.tooltipPostfix;
        }
        return {
            label,
            menuId: MenuId.TunnelLocalAddressInline,
            tunnel: row,
            editId: TunnelEditId.LocalPort,
            tooltip,
            markdownTooltip: label ? LocalAddressColumn.getHoverText(label) : undefined
        };
    }
    static getHoverText(localAddress) {
        return function (configurationService) {
            const editorConf = configurationService.getValue('editor');
            let clickLabel = '';
            if (editorConf.multiCursorModifier === 'ctrlCmd') {
                if (isMacintosh) {
                    clickLabel = nls.localize('portsLink.followLinkAlt.mac', "option + click");
                }
                else {
                    clickLabel = nls.localize('portsLink.followLinkAlt', "alt + click");
                }
            }
            else {
                if (isMacintosh) {
                    clickLabel = nls.localize('portsLink.followLinkCmd', "cmd + click");
                }
                else {
                    clickLabel = nls.localize('portsLink.followLinkCtrl', "ctrl + click");
                }
            }
            const markdown = new MarkdownString('', true);
            const uri = localAddress.startsWith('http') ? localAddress : `http://${localAddress}`;
            return markdown.appendLink(uri, 'Follow link').appendMarkdown(` (${clickLabel})`);
        };
    }
}
class RunningProcessColumn {
    constructor() {
        this.label = nls.localize('tunnel.processColumn.label', "Running Process");
        this.tooltip = nls.localize('tunnel.processColumn.tooltip', "The command line of the process that is using the port.");
        this.weight = 2;
        this.templateId = 'actionbar';
    }
    project(row) {
        if (row.tunnelType === TunnelType.Add) {
            return emptyCell(row);
        }
        const label = row.processDescription ?? '';
        return { label, tunnel: row, editId: TunnelEditId.None, tooltip: row instanceof TunnelItem ? row.processTooltip : '' };
    }
}
class OriginColumn {
    constructor() {
        this.label = nls.localize('tunnel.originColumn.label', "Origin");
        this.tooltip = nls.localize('tunnel.originColumn.tooltip', "The source that a forwarded port originates from. Can be an extension, user forwarded, statically forwarded, or automatically forwarded.");
        this.weight = 1;
        this.templateId = 'actionbar';
    }
    project(row) {
        if (row.tunnelType === TunnelType.Add) {
            return emptyCell(row);
        }
        const label = row.source.description;
        const tooltip = `${row instanceof TunnelItem ? row.originTooltip : ''}. ${row instanceof TunnelItem ? row.tooltipPostfix : ''}`;
        return { label, menuId: MenuId.TunnelOriginInline, tunnel: row, editId: TunnelEditId.None, tooltip };
    }
}
class PrivacyColumn {
    constructor() {
        this.label = nls.localize('tunnel.privacyColumn.label', "Visibility");
        this.tooltip = nls.localize('tunnel.privacyColumn.tooltip', "The availability of the forwarded port.");
        this.weight = 1;
        this.templateId = 'actionbar';
    }
    project(row) {
        if (row.tunnelType === TunnelType.Add) {
            return emptyCell(row);
        }
        const label = row.privacy?.label;
        let tooltip = '';
        if (row instanceof TunnelItem) {
            tooltip = `${row.privacy.label} ${row.tooltipPostfix}`;
        }
        return { label, tunnel: row, icon: { id: row.privacy.themeIcon }, editId: TunnelEditId.None, tooltip };
    }
}
let ActionBarRenderer = class ActionBarRenderer extends Disposable {
    constructor(instantiationService, contextKeyService, menuService, contextViewService, remoteExplorerService, commandService, configurationService) {
        super();
        this.instantiationService = instantiationService;
        this.contextKeyService = contextKeyService;
        this.menuService = menuService;
        this.contextViewService = contextViewService;
        this.remoteExplorerService = remoteExplorerService;
        this.commandService = commandService;
        this.configurationService = configurationService;
        this.templateId = 'actionbar';
        this._hoverDelegate = getDefaultHoverDelegate('mouse');
    }
    set actionRunner(actionRunner) {
        this._actionRunner = actionRunner;
    }
    renderTemplate(container) {
        const cell = dom.append(container, dom.$('.ports-view-actionbar-cell'));
        const icon = dom.append(cell, dom.$('.ports-view-actionbar-cell-icon'));
        const label = new IconLabel(cell, {
            supportHighlights: true,
            hoverDelegate: this._hoverDelegate
        });
        const actionsContainer = dom.append(cell, dom.$('.actions'));
        const actionBar = new ActionBar(actionsContainer, {
            actionViewItemProvider: createActionViewItem.bind(undefined, this.instantiationService),
            hoverDelegate: this._hoverDelegate
        });
        return { label, icon, actionBar, container: cell, elementDisposable: Disposable.None };
    }
    renderElement(element, index, templateData) {
        // reset
        templateData.actionBar.clear();
        templateData.icon.className = 'ports-view-actionbar-cell-icon';
        templateData.icon.style.display = 'none';
        templateData.label.setLabel('');
        templateData.label.element.style.display = 'none';
        templateData.container.style.height = '22px';
        if (templateData.button) {
            templateData.button.element.style.display = 'none';
            templateData.button.dispose();
        }
        templateData.container.style.paddingLeft = '0px';
        templateData.elementDisposable.dispose();
        let editableData;
        if (element.editId === TunnelEditId.New && (editableData = this.remoteExplorerService.getEditableData(undefined))) {
            this.renderInputBox(templateData.container, editableData);
        }
        else {
            editableData = this.remoteExplorerService.getEditableData(element.tunnel, element.editId);
            if (editableData) {
                this.renderInputBox(templateData.container, editableData);
            }
            else if ((element.tunnel.tunnelType === TunnelType.Add) && (element.menuId === MenuId.TunnelPortInline)) {
                this.renderButton(element, templateData);
            }
            else {
                this.renderActionBarItem(element, templateData);
            }
        }
    }
    renderButton(element, templateData) {
        templateData.container.style.paddingLeft = '7px';
        templateData.container.style.height = '28px';
        templateData.button = this._register(new Button(templateData.container, defaultButtonStyles));
        templateData.button.label = element.label;
        templateData.button.element.title = element.tooltip;
        this._register(templateData.button.onDidClick(() => {
            this.commandService.executeCommand(ForwardPortAction.INLINE_ID);
        }));
    }
    tunnelContext(tunnel) {
        let context;
        if (tunnel instanceof TunnelItem) {
            context = tunnel.strip();
        }
        if (!context) {
            context = {
                tunnelType: tunnel.tunnelType,
                remoteHost: tunnel.remoteHost,
                remotePort: tunnel.remotePort,
                localAddress: tunnel.localAddress,
                protocol: tunnel.protocol,
                localUri: tunnel.localUri,
                localPort: tunnel.localPort,
                name: tunnel.name,
                closeable: tunnel.closeable,
                source: tunnel.source,
                privacy: tunnel.privacy,
                processDescription: tunnel.processDescription,
                label: tunnel.label
            };
        }
        return context;
    }
    renderActionBarItem(element, templateData) {
        templateData.label.element.style.display = 'flex';
        templateData.label.setLabel(element.label, undefined, {
            title: element.markdownTooltip ?
                { markdown: element.markdownTooltip(this.configurationService), markdownNotSupportedFallback: element.tooltip }
                : element.tooltip,
            extraClasses: element.menuId === MenuId.TunnelLocalAddressInline ? ['ports-view-actionbar-cell-localaddress'] : undefined
        });
        templateData.actionBar.context = this.tunnelContext(element.tunnel);
        templateData.container.style.paddingLeft = '10px';
        const context = [
            ['view', TUNNEL_VIEW_ID],
            [TunnelTypeContextKey.key, element.tunnel.tunnelType],
            [TunnelCloseableContextKey.key, element.tunnel.closeable],
            [TunnelPrivacyContextKey.key, element.tunnel.privacy.id],
            [TunnelProtocolContextKey.key, element.tunnel.protocol]
        ];
        const contextKeyService = this.contextKeyService.createOverlay(context);
        const disposableStore = new DisposableStore();
        templateData.elementDisposable = disposableStore;
        if (element.menuId) {
            const menu = disposableStore.add(this.menuService.createMenu(element.menuId, contextKeyService));
            let actions = getFlatActionBarActions(menu.getActions({ shouldForwardArgs: true }));
            if (actions) {
                const labelActions = actions.filter(action => action.id.toLowerCase().indexOf('label') >= 0);
                if (labelActions.length > 1) {
                    labelActions.sort((a, b) => a.label.length - b.label.length);
                    labelActions.pop();
                    actions = actions.filter(action => labelActions.indexOf(action) < 0);
                }
                templateData.actionBar.push(actions, { icon: true, label: false });
                if (this._actionRunner) {
                    templateData.actionBar.actionRunner = this._actionRunner;
                }
            }
        }
        if (element.icon) {
            templateData.icon.className = `ports-view-actionbar-cell-icon ${ThemeIcon.asClassName(element.icon)}`;
            templateData.icon.title = element.tooltip;
            templateData.icon.style.display = 'inline';
        }
    }
    renderInputBox(container, editableData) {
        // Required for FireFox. The blur event doesn't fire on FireFox when you just mash the "+" button to forward a port.
        if (this.inputDone) {
            this.inputDone(false, false);
            this.inputDone = undefined;
        }
        container.style.paddingLeft = '5px';
        const value = editableData.startingValue || '';
        const inputBox = new InputBox(container, this.contextViewService, {
            ariaLabel: nls.localize('remote.tunnelsView.input', "Press Enter to confirm or Escape to cancel."),
            validationOptions: {
                validation: (value) => {
                    const message = editableData.validationMessage(value);
                    if (!message) {
                        return null;
                    }
                    return {
                        content: message.content,
                        formatContent: true,
                        type: message.severity === Severity.Error ? 3 /* MessageType.ERROR */ : 1 /* MessageType.INFO */
                    };
                }
            },
            placeholder: editableData.placeholder || '',
            inputBoxStyles: defaultInputBoxStyles
        });
        inputBox.value = value;
        inputBox.focus();
        inputBox.select({ start: 0, end: editableData.startingValue ? editableData.startingValue.length : 0 });
        const done = createSingleCallFunction(async (success, finishEditing) => {
            dispose(toDispose);
            if (this.inputDone) {
                this.inputDone = undefined;
            }
            inputBox.element.style.display = 'none';
            const inputValue = inputBox.value;
            if (finishEditing) {
                return editableData.onFinish(inputValue, success);
            }
        });
        this.inputDone = done;
        const toDispose = [
            inputBox,
            dom.addStandardDisposableListener(inputBox.inputElement, dom.EventType.KEY_DOWN, async (e) => {
                if (e.equals(3 /* KeyCode.Enter */)) {
                    e.stopPropagation();
                    if (inputBox.validate() !== 3 /* MessageType.ERROR */) {
                        return done(true, true);
                    }
                    else {
                        return done(false, true);
                    }
                }
                else if (e.equals(9 /* KeyCode.Escape */)) {
                    e.preventDefault();
                    e.stopPropagation();
                    return done(false, true);
                }
            }),
            dom.addDisposableListener(inputBox.inputElement, dom.EventType.BLUR, () => {
                return done(inputBox.validate() !== 3 /* MessageType.ERROR */, true);
            })
        ];
        return toDisposable(() => {
            done(false, false);
        });
    }
    disposeElement(element, index, templateData) {
        templateData.elementDisposable.dispose();
    }
    disposeTemplate(templateData) {
        templateData.label.dispose();
        templateData.actionBar.dispose();
        templateData.elementDisposable.dispose();
        templateData.button?.dispose();
    }
};
ActionBarRenderer = __decorate([
    __param(0, IInstantiationService),
    __param(1, IContextKeyService),
    __param(2, IMenuService),
    __param(3, IContextViewService),
    __param(4, IRemoteExplorerService),
    __param(5, ICommandService),
    __param(6, IConfigurationService)
], ActionBarRenderer);
class TunnelItem {
    static createFromTunnel(remoteExplorerService, tunnelService, tunnel, type = TunnelType.Forwarded, closeable) {
        return new TunnelItem(type, tunnel.remoteHost, tunnel.remotePort, tunnel.source, !!tunnel.hasRunningProcess, tunnel.protocol, tunnel.localUri, tunnel.localAddress, tunnel.localPort, closeable === undefined ? tunnel.closeable : closeable, tunnel.name, tunnel.runningProcess, tunnel.pid, tunnel.privacy, remoteExplorerService, tunnelService);
    }
    /**
     * Removes all non-serializable properties from the tunnel
     * @returns A new TunnelItem without any services
     */
    strip() {
        return new TunnelItem(this.tunnelType, this.remoteHost, this.remotePort, this.source, this.hasRunningProcess, this.protocol, this.localUri, this.localAddress, this.localPort, this.closeable, this.name, this.runningProcess, this.pid, this._privacy);
    }
    constructor(tunnelType, remoteHost, remotePort, source, hasRunningProcess, protocol, localUri, localAddress, localPort, closeable, name, runningProcess, pid, _privacy, remoteExplorerService, tunnelService) {
        this.tunnelType = tunnelType;
        this.remoteHost = remoteHost;
        this.remotePort = remotePort;
        this.source = source;
        this.hasRunningProcess = hasRunningProcess;
        this.protocol = protocol;
        this.localUri = localUri;
        this.localAddress = localAddress;
        this.localPort = localPort;
        this.closeable = closeable;
        this.name = name;
        this.runningProcess = runningProcess;
        this.pid = pid;
        this._privacy = _privacy;
        this.remoteExplorerService = remoteExplorerService;
        this.tunnelService = tunnelService;
    }
    get label() {
        if (this.tunnelType === TunnelType.Add && this.name) {
            return this.name;
        }
        const portNumberLabel = (isLocalhost(this.remoteHost) || isAllInterfaces(this.remoteHost))
            ? `${this.remotePort}`
            : `${this.remoteHost}:${this.remotePort}`;
        if (this.name) {
            return `${this.name} (${portNumberLabel})`;
        }
        else {
            return portNumberLabel;
        }
    }
    set processDescription(description) {
        this.runningProcess = description;
    }
    get processDescription() {
        let description = '';
        if (this.runningProcess) {
            if (this.pid && this.remoteExplorerService?.namedProcesses.has(this.pid)) {
                // This is a known process. Give it a friendly name.
                description = this.remoteExplorerService.namedProcesses.get(this.pid);
            }
            else {
                description = this.runningProcess.replace(/\0/g, ' ').trim();
            }
            if (this.pid) {
                description += ` (${this.pid})`;
            }
        }
        else if (this.hasRunningProcess) {
            description = nls.localize('tunnelView.runningProcess.inacessable', "Process information unavailable");
        }
        return description;
    }
    get tooltipPostfix() {
        let information;
        if (this.localAddress) {
            information = nls.localize('remote.tunnel.tooltipForwarded', "Remote port {0}:{1} forwarded to local address {2}. ", this.remoteHost, this.remotePort, this.localAddress);
        }
        else {
            information = nls.localize('remote.tunnel.tooltipCandidate', "Remote port {0}:{1} not forwarded. ", this.remoteHost, this.remotePort);
        }
        return information;
    }
    get iconTooltip() {
        const isAdd = this.tunnelType === TunnelType.Add;
        if (!isAdd) {
            return `${this.processDescription ? nls.localize('tunnel.iconColumn.running', "Port has running process.") :
                nls.localize('tunnel.iconColumn.notRunning', "No running process.")}`;
        }
        else {
            return this.label;
        }
    }
    get portTooltip() {
        const isAdd = this.tunnelType === TunnelType.Add;
        if (!isAdd) {
            return `${this.name ? nls.localize('remote.tunnel.tooltipName', "Port labeled {0}. ", this.name) : ''}`;
        }
        else {
            return '';
        }
    }
    get processTooltip() {
        return this.processDescription ?? '';
    }
    get originTooltip() {
        return this.source.description;
    }
    get privacy() {
        if (this.tunnelService?.privacyOptions) {
            return this.tunnelService?.privacyOptions.find(element => element.id === this._privacy) ??
                {
                    id: '',
                    themeIcon: Codicon.question.id,
                    label: nls.localize('tunnelPrivacy.unknown', "Unknown")
                };
        }
        else {
            return {
                id: TunnelPrivacyId.Private,
                themeIcon: privatePortIcon.id,
                label: nls.localize('tunnelPrivacy.private', "Private")
            };
        }
    }
}
const TunnelTypeContextKey = new RawContextKey('tunnelType', TunnelType.Add, true);
const TunnelCloseableContextKey = new RawContextKey('tunnelCloseable', false, true);
const TunnelPrivacyContextKey = new RawContextKey('tunnelPrivacy', undefined, true);
const TunnelPrivacyEnabledContextKey = new RawContextKey('tunnelPrivacyEnabled', false, true);
const TunnelProtocolContextKey = new RawContextKey('tunnelProtocol', TunnelProtocol.Http, true);
const TunnelViewFocusContextKey = new RawContextKey('tunnelViewFocus', false, nls.localize('tunnel.focusContext', "Whether the Ports view has focus."));
const TunnelViewSelectionKeyName = 'tunnelViewSelection';
// host:port
const TunnelViewSelectionContextKey = new RawContextKey(TunnelViewSelectionKeyName, undefined, true);
const TunnelViewMultiSelectionKeyName = 'tunnelViewMultiSelection';
// host:port[]
const TunnelViewMultiSelectionContextKey = new RawContextKey(TunnelViewMultiSelectionKeyName, undefined, true);
const PortChangableContextKey = new RawContextKey('portChangable', false, true);
const ProtocolChangeableContextKey = new RawContextKey('protocolChangable', true, true);
let TunnelPanel = class TunnelPanel extends ViewPane {
    static { TunnelPanel_1 = this; }
    static { this.ID = TUNNEL_VIEW_ID; }
    static { this.TITLE = nls.localize2('remote.tunnel', "Ports"); }
    constructor(viewModel, options, keybindingService, contextMenuService, contextKeyService, configurationService, instantiationService, viewDescriptorService, openerService, quickInputService, commandService, menuService, themeService, remoteExplorerService, hoverService, tunnelService, contextViewService) {
        super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this.viewModel = viewModel;
        this.quickInputService = quickInputService;
        this.commandService = commandService;
        this.menuService = menuService;
        this.remoteExplorerService = remoteExplorerService;
        this.tunnelService = tunnelService;
        this.contextViewService = contextViewService;
        this.tableDisposables = this._register(new DisposableStore());
        this.isEditing = false;
        // TODO: Should this be removed?
        //@ts-expect-error
        this.titleActions = [];
        this.lastFocus = [];
        this.height = 0;
        this.width = 0;
        this.tunnelTypeContext = TunnelTypeContextKey.bindTo(contextKeyService);
        this.tunnelCloseableContext = TunnelCloseableContextKey.bindTo(contextKeyService);
        this.tunnelPrivacyContext = TunnelPrivacyContextKey.bindTo(contextKeyService);
        this.tunnelPrivacyEnabledContext = TunnelPrivacyEnabledContextKey.bindTo(contextKeyService);
        this.tunnelPrivacyEnabledContext.set(tunnelService.canChangePrivacy);
        this.protocolChangableContextKey = ProtocolChangeableContextKey.bindTo(contextKeyService);
        this.protocolChangableContextKey.set(tunnelService.canChangeProtocol);
        this.tunnelProtocolContext = TunnelProtocolContextKey.bindTo(contextKeyService);
        this.tunnelViewFocusContext = TunnelViewFocusContextKey.bindTo(contextKeyService);
        this.tunnelViewSelectionContext = TunnelViewSelectionContextKey.bindTo(contextKeyService);
        this.tunnelViewMultiSelectionContext = TunnelViewMultiSelectionContextKey.bindTo(contextKeyService);
        this.portChangableContextKey = PortChangableContextKey.bindTo(contextKeyService);
        const overlayContextKeyService = this.contextKeyService.createOverlay([['view', TunnelPanel_1.ID]]);
        const titleMenu = this._register(this.menuService.createMenu(MenuId.TunnelTitle, overlayContextKeyService));
        const updateActions = () => {
            this.titleActions = getFlatActionBarActions(titleMenu.getActions());
            this.updateActions();
        };
        this._register(titleMenu.onDidChange(updateActions));
        updateActions();
        this._register(toDisposable(() => {
            this.titleActions = [];
        }));
        this.registerPrivacyActions();
        this._register(Event.once(this.tunnelService.onAddedTunnelProvider)(() => {
            let updated = false;
            if (this.tunnelPrivacyEnabledContext.get() === false) {
                this.tunnelPrivacyEnabledContext.set(tunnelService.canChangePrivacy);
                updated = true;
            }
            if (this.protocolChangableContextKey.get() === true) {
                this.protocolChangableContextKey.set(tunnelService.canChangeProtocol);
                updated = true;
            }
            if (updated) {
                updateActions();
                this.registerPrivacyActions();
                this.createTable();
                this.table?.layout(this.height, this.width);
            }
        }));
    }
    registerPrivacyActions() {
        for (const privacyOption of this.tunnelService.privacyOptions) {
            const optionId = `remote.tunnel.privacy${privacyOption.id}`;
            CommandsRegistry.registerCommand(optionId, ChangeTunnelPrivacyAction.handler(privacyOption.id));
            MenuRegistry.appendMenuItem(MenuId.TunnelPrivacy, ({
                order: 0,
                command: {
                    id: optionId,
                    title: privacyOption.label,
                    toggled: TunnelPrivacyContextKey.isEqualTo(privacyOption.id)
                }
            }));
        }
    }
    get portCount() {
        return this.remoteExplorerService.tunnelModel.forwarded.size + this.remoteExplorerService.tunnelModel.detected.size;
    }
    createTable() {
        if (!this.panelContainer) {
            return;
        }
        this.tableDisposables.clear();
        dom.clearNode(this.panelContainer);
        const widgetContainer = dom.append(this.panelContainer, dom.$('.customview-tree'));
        widgetContainer.classList.add('ports-view');
        widgetContainer.classList.add('file-icon-themable-tree', 'show-file-icons');
        const actionBarRenderer = new ActionBarRenderer(this.instantiationService, this.contextKeyService, this.menuService, this.contextViewService, this.remoteExplorerService, this.commandService, this.configurationService);
        const columns = [new IconColumn(), new PortColumn(), new LocalAddressColumn(), new RunningProcessColumn()];
        if (this.tunnelService.canChangePrivacy) {
            columns.push(new PrivacyColumn());
        }
        columns.push(new OriginColumn());
        this.table = this.instantiationService.createInstance(WorkbenchTable, 'RemoteTunnels', widgetContainer, new TunnelTreeVirtualDelegate(this.remoteExplorerService), columns, [actionBarRenderer], {
            keyboardNavigationLabelProvider: {
                getKeyboardNavigationLabel: (item) => {
                    return item.label;
                }
            },
            multipleSelectionSupport: true,
            accessibilityProvider: {
                getAriaLabel: (item) => {
                    if (item instanceof TunnelItem) {
                        return `${item.tooltipPostfix} ${item.portTooltip} ${item.iconTooltip} ${item.processTooltip} ${item.originTooltip} ${this.tunnelService.canChangePrivacy ? item.privacy.label : ''}`;
                    }
                    else {
                        return item.label;
                    }
                },
                getWidgetAriaLabel: () => nls.localize('tunnelView', "Tunnel View")
            },
            openOnSingleClick: true
        });
        const actionRunner = this.tableDisposables.add(new ActionRunner());
        actionBarRenderer.actionRunner = actionRunner;
        this.tableDisposables.add(this.table);
        this.tableDisposables.add(this.table.onContextMenu(e => this.onContextMenu(e, actionRunner)));
        this.tableDisposables.add(this.table.onMouseDblClick(e => this.onMouseDblClick(e)));
        this.tableDisposables.add(this.table.onDidChangeFocus(e => this.onFocusChanged(e)));
        this.tableDisposables.add(this.table.onDidChangeSelection(e => this.onSelectionChanged(e)));
        this.tableDisposables.add(this.table.onDidFocus(() => this.tunnelViewFocusContext.set(true)));
        this.tableDisposables.add(this.table.onDidBlur(() => this.tunnelViewFocusContext.set(false)));
        const rerender = () => this.table?.splice(0, Number.POSITIVE_INFINITY, this.viewModel.all);
        rerender();
        let lastPortCount = this.portCount;
        this.tableDisposables.add(Event.debounce(this.viewModel.onForwardedPortsChanged, (_last, e) => e, 50)(() => {
            const newPortCount = this.portCount;
            if (((lastPortCount === 0) || (newPortCount === 0)) && (lastPortCount !== newPortCount)) {
                this._onDidChangeViewWelcomeState.fire();
            }
            lastPortCount = newPortCount;
            rerender();
        }));
        this.tableDisposables.add(this.table.onMouseClick(e => {
            if (this.hasOpenLinkModifier(e.browserEvent) && this.table) {
                const selection = this.table.getSelectedElements();
                if ((selection.length === 0) ||
                    ((selection.length === 1) && (selection[0] === e.element))) {
                    this.commandService.executeCommand(OpenPortInBrowserAction.ID, e.element);
                }
            }
        }));
        this.tableDisposables.add(this.table.onDidOpen(e => {
            if (!e.element || (e.element.tunnelType !== TunnelType.Forwarded)) {
                return;
            }
            if (e.browserEvent?.type === 'dblclick') {
                this.commandService.executeCommand(LabelTunnelAction.ID);
            }
        }));
        this.tableDisposables.add(this.remoteExplorerService.onDidChangeEditable(e => {
            this.isEditing = !!this.remoteExplorerService.getEditableData(e?.tunnel, e?.editId);
            this._onDidChangeViewWelcomeState.fire();
            if (!this.isEditing) {
                widgetContainer.classList.remove('highlight');
            }
            rerender();
            if (this.isEditing) {
                widgetContainer.classList.add('highlight');
                if (!e) {
                    // When we are in editing mode for a new forward, rather than updating an existing one we need to reveal the input box since it might be out of view.
                    this.table?.reveal(this.table.indexOf(this.viewModel.input));
                }
            }
            else {
                if (e && (e.tunnel.tunnelType !== TunnelType.Add)) {
                    this.table?.setFocus(this.lastFocus);
                }
                this.focus();
            }
        }));
    }
    renderBody(container) {
        super.renderBody(container);
        this.panelContainer = dom.append(container, dom.$('.tree-explorer-viewlet-tree-view'));
        this.createTable();
    }
    shouldShowWelcome() {
        return this.viewModel.isEmpty() && !this.isEditing;
    }
    focus() {
        super.focus();
        this.table?.domFocus();
    }
    onFocusChanged(event) {
        if (event.indexes.length > 0 && event.elements.length > 0) {
            this.lastFocus = [...event.indexes];
        }
        const elements = event.elements;
        const item = elements && elements.length ? elements[0] : undefined;
        if (item) {
            this.tunnelViewSelectionContext.set(makeAddress(item.remoteHost, item.remotePort));
            this.tunnelTypeContext.set(item.tunnelType);
            this.tunnelCloseableContext.set(!!item.closeable);
            this.tunnelPrivacyContext.set(item.privacy.id);
            this.tunnelProtocolContext.set(item.protocol === TunnelProtocol.Https ? TunnelProtocol.Https : TunnelProtocol.Https);
            this.portChangableContextKey.set(!!item.localPort);
        }
        else {
            this.tunnelTypeContext.reset();
            this.tunnelViewSelectionContext.reset();
            this.tunnelCloseableContext.reset();
            this.tunnelPrivacyContext.reset();
            this.tunnelProtocolContext.reset();
            this.portChangableContextKey.reset();
        }
    }
    hasOpenLinkModifier(e) {
        const editorConf = this.configurationService.getValue('editor');
        let modifierKey = false;
        if (editorConf.multiCursorModifier === 'ctrlCmd') {
            modifierKey = e.altKey;
        }
        else {
            if (isMacintosh) {
                modifierKey = e.metaKey;
            }
            else {
                modifierKey = e.ctrlKey;
            }
        }
        return modifierKey;
    }
    onSelectionChanged(event) {
        const elements = event.elements;
        if (elements.length > 1) {
            this.tunnelViewMultiSelectionContext.set(elements.map(element => makeAddress(element.remoteHost, element.remotePort)));
        }
        else {
            this.tunnelViewMultiSelectionContext.set(undefined);
        }
    }
    onContextMenu(event, actionRunner) {
        if ((event.element !== undefined) && !(event.element instanceof TunnelItem)) {
            return;
        }
        event.browserEvent.preventDefault();
        event.browserEvent.stopPropagation();
        const node = event.element;
        if (node) {
            this.table?.setFocus([this.table.indexOf(node)]);
            this.tunnelTypeContext.set(node.tunnelType);
            this.tunnelCloseableContext.set(!!node.closeable);
            this.tunnelPrivacyContext.set(node.privacy.id);
            this.tunnelProtocolContext.set(node.protocol);
            this.portChangableContextKey.set(!!node.localPort);
        }
        else {
            this.tunnelTypeContext.set(TunnelType.Add);
            this.tunnelCloseableContext.set(false);
            this.tunnelPrivacyContext.set(undefined);
            this.tunnelProtocolContext.set(undefined);
            this.portChangableContextKey.set(false);
        }
        this.contextMenuService.showContextMenu({
            menuId: MenuId.TunnelContext,
            menuActionOptions: { shouldForwardArgs: true },
            contextKeyService: this.table?.contextKeyService,
            getAnchor: () => event.anchor,
            getActionViewItem: (action) => {
                const keybinding = this.keybindingService.lookupKeybinding(action.id);
                if (keybinding) {
                    return new ActionViewItem(action, action, { label: true, keybinding: keybinding.getLabel() });
                }
                return undefined;
            },
            onHide: (wasCancelled) => {
                if (wasCancelled) {
                    this.table?.domFocus();
                }
            },
            getActionsContext: () => node?.strip(),
            actionRunner
        });
    }
    onMouseDblClick(e) {
        if (!e.element) {
            this.commandService.executeCommand(ForwardPortAction.INLINE_ID);
        }
    }
    layoutBody(height, width) {
        this.height = height;
        this.width = width;
        super.layoutBody(height, width);
        this.table?.layout(height, width);
    }
};
TunnelPanel = TunnelPanel_1 = __decorate([
    __param(2, IKeybindingService),
    __param(3, IContextMenuService),
    __param(4, IContextKeyService),
    __param(5, IConfigurationService),
    __param(6, IInstantiationService),
    __param(7, IViewDescriptorService),
    __param(8, IOpenerService),
    __param(9, IQuickInputService),
    __param(10, ICommandService),
    __param(11, IMenuService),
    __param(12, IThemeService),
    __param(13, IRemoteExplorerService),
    __param(14, IHoverService),
    __param(15, ITunnelService),
    __param(16, IContextViewService)
], TunnelPanel);
export { TunnelPanel };
export class TunnelPanelDescriptor {
    constructor(viewModel, environmentService) {
        this.id = TunnelPanel.ID;
        this.name = TunnelPanel.TITLE;
        this.canToggleVisibility = true;
        this.hideByDefault = false;
        // group is not actually used for views that are not extension contributed. Use order instead.
        this.group = 'details@0';
        // -500 comes from the remote explorer viewOrderDelegate
        this.order = -500;
        this.canMoveView = true;
        this.containerIcon = portsViewIcon;
        this.ctorDescriptor = new SyncDescriptor(TunnelPanel, [viewModel]);
        this.remoteAuthority = environmentService.remoteAuthority ? environmentService.remoteAuthority.split('+')[0] : undefined;
    }
}
function isITunnelItem(item) {
    return item && item.tunnelType && item.remoteHost && item.source;
}
var LabelTunnelAction;
(function (LabelTunnelAction) {
    LabelTunnelAction.ID = 'remote.tunnel.label';
    LabelTunnelAction.LABEL = nls.localize('remote.tunnel.label', "Set Port Label");
    LabelTunnelAction.COMMAND_ID_KEYWORD = 'label';
    function handler() {
        return async (accessor, arg) => {
            const remoteExplorerService = accessor.get(IRemoteExplorerService);
            let tunnelContext;
            if (isITunnelItem(arg)) {
                tunnelContext = arg;
            }
            else {
                const context = accessor.get(IContextKeyService).getContextKeyValue(TunnelViewSelectionKeyName);
                const tunnel = context ? remoteExplorerService.tunnelModel.forwarded.get(context) : undefined;
                if (tunnel) {
                    const tunnelService = accessor.get(ITunnelService);
                    tunnelContext = TunnelItem.createFromTunnel(remoteExplorerService, tunnelService, tunnel);
                }
            }
            if (tunnelContext) {
                const tunnelItem = tunnelContext;
                return new Promise(resolve => {
                    const startingValue = tunnelItem.name ? tunnelItem.name : `${tunnelItem.remotePort}`;
                    remoteExplorerService.setEditable(tunnelItem, TunnelEditId.Label, {
                        onFinish: async (value, success) => {
                            value = value.trim();
                            remoteExplorerService.setEditable(tunnelItem, TunnelEditId.Label, null);
                            const changed = success && (value !== startingValue);
                            if (changed) {
                                await remoteExplorerService.tunnelModel.name(tunnelItem.remoteHost, tunnelItem.remotePort, value);
                            }
                            resolve(changed ? { port: tunnelItem.remotePort, label: value } : undefined);
                        },
                        validationMessage: () => null,
                        placeholder: nls.localize('remote.tunnelsView.labelPlaceholder', "Port label"),
                        startingValue
                    });
                });
            }
            return undefined;
        };
    }
    LabelTunnelAction.handler = handler;
})(LabelTunnelAction || (LabelTunnelAction = {}));
const invalidPortString = nls.localize('remote.tunnelsView.portNumberValid', "Forwarded port should be a number or a host:port.");
const maxPortNumber = 65536;
const invalidPortNumberString = nls.localize('remote.tunnelsView.portNumberToHigh', "Port number must be \u2265 0 and < {0}.", maxPortNumber);
const requiresSudoString = nls.localize('remote.tunnelView.inlineElevationMessage', "May Require Sudo");
const alreadyForwarded = nls.localize('remote.tunnelView.alreadyForwarded', "Port is already forwarded");
export var ForwardPortAction;
(function (ForwardPortAction) {
    ForwardPortAction.INLINE_ID = 'remote.tunnel.forwardInline';
    ForwardPortAction.COMMANDPALETTE_ID = 'remote.tunnel.forwardCommandPalette';
    ForwardPortAction.LABEL = nls.localize2('remote.tunnel.forward', "Forward a Port");
    ForwardPortAction.TREEITEM_LABEL = nls.localize('remote.tunnel.forwardItem', "Forward Port");
    const forwardPrompt = nls.localize('remote.tunnel.forwardPrompt', "Port number or address (eg. 3000 or 10.10.10.10:2000).");
    function validateInput(remoteExplorerService, tunnelService, value, canElevate) {
        const parsed = parseAddress(value);
        if (!parsed) {
            return { content: invalidPortString, severity: Severity.Error };
        }
        else if (parsed.port >= maxPortNumber) {
            return { content: invalidPortNumberString, severity: Severity.Error };
        }
        else if (canElevate && tunnelService.isPortPrivileged(parsed.port)) {
            return { content: requiresSudoString, severity: Severity.Info };
        }
        else if (mapHasAddressLocalhostOrAllInterfaces(remoteExplorerService.tunnelModel.forwarded, parsed.host, parsed.port)) {
            return { content: alreadyForwarded, severity: Severity.Error };
        }
        return null;
    }
    function error(notificationService, tunnelOrError, host, port) {
        if (!tunnelOrError) {
            notificationService.warn(nls.localize('remote.tunnel.forwardError', "Unable to forward {0}:{1}. The host may not be available or that remote port may already be forwarded", host, port));
        }
        else if (typeof tunnelOrError === 'string') {
            notificationService.warn(nls.localize('remote.tunnel.forwardErrorProvided', "Unable to forward {0}:{1}. {2}", host, port, tunnelOrError));
        }
    }
    function inlineHandler() {
        return async (accessor, arg) => {
            const remoteExplorerService = accessor.get(IRemoteExplorerService);
            const notificationService = accessor.get(INotificationService);
            const tunnelService = accessor.get(ITunnelService);
            remoteExplorerService.setEditable(undefined, TunnelEditId.New, {
                onFinish: async (value, success) => {
                    remoteExplorerService.setEditable(undefined, TunnelEditId.New, null);
                    let parsed;
                    if (success && (parsed = parseAddress(value))) {
                        remoteExplorerService.forward({
                            remote: { host: parsed.host, port: parsed.port },
                            elevateIfNeeded: true
                        }).then(tunnelOrError => error(notificationService, tunnelOrError, parsed.host, parsed.port));
                    }
                },
                validationMessage: (value) => validateInput(remoteExplorerService, tunnelService, value, tunnelService.canElevate),
                placeholder: forwardPrompt
            });
        };
    }
    ForwardPortAction.inlineHandler = inlineHandler;
    function commandPaletteHandler() {
        return async (accessor, arg) => {
            const remoteExplorerService = accessor.get(IRemoteExplorerService);
            const notificationService = accessor.get(INotificationService);
            const viewsService = accessor.get(IViewsService);
            const quickInputService = accessor.get(IQuickInputService);
            const tunnelService = accessor.get(ITunnelService);
            await viewsService.openView(TunnelPanel.ID, true);
            const value = await quickInputService.input({
                prompt: forwardPrompt,
                validateInput: (value) => Promise.resolve(validateInput(remoteExplorerService, tunnelService, value, tunnelService.canElevate))
            });
            let parsed;
            if (value && (parsed = parseAddress(value))) {
                remoteExplorerService.forward({
                    remote: { host: parsed.host, port: parsed.port },
                    elevateIfNeeded: true
                }).then(tunnel => error(notificationService, tunnel, parsed.host, parsed.port));
            }
        };
    }
    ForwardPortAction.commandPaletteHandler = commandPaletteHandler;
})(ForwardPortAction || (ForwardPortAction = {}));
function makeTunnelPicks(tunnels, remoteExplorerService, tunnelService) {
    const picks = tunnels.map(forwarded => {
        const item = TunnelItem.createFromTunnel(remoteExplorerService, tunnelService, forwarded);
        return {
            label: item.label,
            description: item.processDescription,
            tunnel: item
        };
    });
    if (picks.length === 0) {
        picks.push({
            label: nls.localize('remote.tunnel.closeNoPorts', "No ports currently forwarded. Try running the {0} command", ForwardPortAction.LABEL.value)
        });
    }
    return picks;
}
var ClosePortAction;
(function (ClosePortAction) {
    ClosePortAction.INLINE_ID = 'remote.tunnel.closeInline';
    ClosePortAction.COMMANDPALETTE_ID = 'remote.tunnel.closeCommandPalette';
    ClosePortAction.LABEL = nls.localize2('remote.tunnel.close', "Stop Forwarding Port");
    function inlineHandler() {
        return async (accessor, arg) => {
            const contextKeyService = accessor.get(IContextKeyService);
            const remoteExplorerService = accessor.get(IRemoteExplorerService);
            let ports = [];
            const multiSelectContext = contextKeyService.getContextKeyValue(TunnelViewMultiSelectionKeyName);
            if (multiSelectContext) {
                multiSelectContext.forEach(context => {
                    const tunnel = remoteExplorerService.tunnelModel.forwarded.get(context);
                    if (tunnel) {
                        ports?.push(tunnel);
                    }
                });
            }
            else if (isITunnelItem(arg)) {
                ports = [arg];
            }
            else {
                const context = contextKeyService.getContextKeyValue(TunnelViewSelectionKeyName);
                const tunnel = context ? remoteExplorerService.tunnelModel.forwarded.get(context) : undefined;
                if (tunnel) {
                    ports = [tunnel];
                }
            }
            if (!ports || ports.length === 0) {
                return;
            }
            return Promise.all(ports.map(port => remoteExplorerService.close({ host: port.remoteHost, port: port.remotePort }, TunnelCloseReason.User)));
        };
    }
    ClosePortAction.inlineHandler = inlineHandler;
    function commandPaletteHandler() {
        return async (accessor) => {
            const quickInputService = accessor.get(IQuickInputService);
            const remoteExplorerService = accessor.get(IRemoteExplorerService);
            const tunnelService = accessor.get(ITunnelService);
            const commandService = accessor.get(ICommandService);
            const picks = makeTunnelPicks(Array.from(remoteExplorerService.tunnelModel.forwarded.values()).filter(tunnel => tunnel.closeable), remoteExplorerService, tunnelService);
            const result = await quickInputService.pick(picks, { placeHolder: nls.localize('remote.tunnel.closePlaceholder', "Choose a port to stop forwarding") });
            if (result && result.tunnel) {
                await remoteExplorerService.close({ host: result.tunnel.remoteHost, port: result.tunnel.remotePort }, TunnelCloseReason.User);
            }
            else if (result) {
                await commandService.executeCommand(ForwardPortAction.COMMANDPALETTE_ID);
            }
        };
    }
    ClosePortAction.commandPaletteHandler = commandPaletteHandler;
})(ClosePortAction || (ClosePortAction = {}));
export var OpenPortInBrowserAction;
(function (OpenPortInBrowserAction) {
    OpenPortInBrowserAction.ID = 'remote.tunnel.open';
    OpenPortInBrowserAction.LABEL = nls.localize('remote.tunnel.open', "Open in Browser");
    function handler() {
        return async (accessor, arg) => {
            let key;
            if (isITunnelItem(arg)) {
                key = makeAddress(arg.remoteHost, arg.remotePort);
            }
            else if (isRemoteTunnel(arg)) {
                key = makeAddress(arg.tunnelRemoteHost, arg.tunnelRemotePort);
            }
            if (key) {
                const model = accessor.get(IRemoteExplorerService).tunnelModel;
                const openerService = accessor.get(IOpenerService);
                return run(model, openerService, key);
            }
        };
    }
    OpenPortInBrowserAction.handler = handler;
    function run(model, openerService, key) {
        const tunnel = model.forwarded.get(key) || model.detected.get(key);
        if (tunnel) {
            return openerService.open(tunnel.localUri, { allowContributedOpeners: false });
        }
        return Promise.resolve();
    }
    OpenPortInBrowserAction.run = run;
})(OpenPortInBrowserAction || (OpenPortInBrowserAction = {}));
export var OpenPortInPreviewAction;
(function (OpenPortInPreviewAction) {
    OpenPortInPreviewAction.ID = 'remote.tunnel.openPreview';
    OpenPortInPreviewAction.LABEL = nls.localize('remote.tunnel.openPreview', "Preview in Editor");
    function handler() {
        return async (accessor, arg) => {
            let key;
            if (isITunnelItem(arg)) {
                key = makeAddress(arg.remoteHost, arg.remotePort);
            }
            else if (isRemoteTunnel(arg)) {
                key = makeAddress(arg.tunnelRemoteHost, arg.tunnelRemotePort);
            }
            if (key) {
                const model = accessor.get(IRemoteExplorerService).tunnelModel;
                const openerService = accessor.get(IOpenerService);
                const externalOpenerService = accessor.get(IExternalUriOpenerService);
                return run(model, openerService, externalOpenerService, key);
            }
        };
    }
    OpenPortInPreviewAction.handler = handler;
    async function run(model, openerService, externalOpenerService, key) {
        const tunnel = model.forwarded.get(key) || model.detected.get(key);
        if (tunnel) {
            const remoteHost = tunnel.remoteHost.includes(':') ? `[${tunnel.remoteHost}]` : tunnel.remoteHost;
            const sourceUri = URI.parse(`http://${remoteHost}:${tunnel.remotePort}`);
            const opener = await externalOpenerService.getOpener(tunnel.localUri, { sourceUri }, CancellationToken.None);
            if (opener) {
                return opener.openExternalUri(tunnel.localUri, { sourceUri }, CancellationToken.None);
            }
            return openerService.open(tunnel.localUri);
        }
        return Promise.resolve();
    }
    OpenPortInPreviewAction.run = run;
})(OpenPortInPreviewAction || (OpenPortInPreviewAction = {}));
var OpenPortInBrowserCommandPaletteAction;
(function (OpenPortInBrowserCommandPaletteAction) {
    OpenPortInBrowserCommandPaletteAction.ID = 'remote.tunnel.openCommandPalette';
    OpenPortInBrowserCommandPaletteAction.LABEL = nls.localize('remote.tunnel.openCommandPalette', "Open Port in Browser");
    function handler() {
        return async (accessor, arg) => {
            const remoteExplorerService = accessor.get(IRemoteExplorerService);
            const tunnelService = accessor.get(ITunnelService);
            const model = remoteExplorerService.tunnelModel;
            const quickPickService = accessor.get(IQuickInputService);
            const openerService = accessor.get(IOpenerService);
            const commandService = accessor.get(ICommandService);
            const options = [...model.forwarded, ...model.detected].map(value => {
                const tunnelItem = TunnelItem.createFromTunnel(remoteExplorerService, tunnelService, value[1]);
                return {
                    label: tunnelItem.label,
                    description: tunnelItem.processDescription,
                    tunnel: tunnelItem
                };
            });
            if (options.length === 0) {
                options.push({
                    label: nls.localize('remote.tunnel.openCommandPaletteNone', "No ports currently forwarded. Open the Ports view to get started.")
                });
            }
            else {
                options.push({
                    label: nls.localize('remote.tunnel.openCommandPaletteView', "Open the Ports view...")
                });
            }
            const picked = await quickPickService.pick(options, { placeHolder: nls.localize('remote.tunnel.openCommandPalettePick', "Choose the port to open") });
            if (picked && picked.tunnel) {
                return OpenPortInBrowserAction.run(model, openerService, makeAddress(picked.tunnel.remoteHost, picked.tunnel.remotePort));
            }
            else if (picked) {
                return commandService.executeCommand(`${TUNNEL_VIEW_ID}.focus`);
            }
        };
    }
    OpenPortInBrowserCommandPaletteAction.handler = handler;
})(OpenPortInBrowserCommandPaletteAction || (OpenPortInBrowserCommandPaletteAction = {}));
var CopyAddressAction;
(function (CopyAddressAction) {
    CopyAddressAction.INLINE_ID = 'remote.tunnel.copyAddressInline';
    CopyAddressAction.COMMANDPALETTE_ID = 'remote.tunnel.copyAddressCommandPalette';
    CopyAddressAction.INLINE_LABEL = nls.localize('remote.tunnel.copyAddressInline', "Copy Local Address");
    CopyAddressAction.COMMANDPALETTE_LABEL = nls.localize('remote.tunnel.copyAddressCommandPalette', "Copy Forwarded Port Address");
    async function copyAddress(remoteExplorerService, clipboardService, tunnelItem) {
        const address = remoteExplorerService.tunnelModel.address(tunnelItem.remoteHost, tunnelItem.remotePort);
        if (address) {
            await clipboardService.writeText(address.toString());
        }
    }
    function inlineHandler() {
        return async (accessor, arg) => {
            const remoteExplorerService = accessor.get(IRemoteExplorerService);
            let tunnelItem;
            if (isITunnelItem(arg)) {
                tunnelItem = arg;
            }
            else {
                const context = accessor.get(IContextKeyService).getContextKeyValue(TunnelViewSelectionKeyName);
                tunnelItem = context ? remoteExplorerService.tunnelModel.forwarded.get(context) : undefined;
            }
            if (tunnelItem) {
                return copyAddress(remoteExplorerService, accessor.get(IClipboardService), tunnelItem);
            }
        };
    }
    CopyAddressAction.inlineHandler = inlineHandler;
    function commandPaletteHandler() {
        return async (accessor, arg) => {
            const quickInputService = accessor.get(IQuickInputService);
            const remoteExplorerService = accessor.get(IRemoteExplorerService);
            const tunnelService = accessor.get(ITunnelService);
            const commandService = accessor.get(ICommandService);
            const clipboardService = accessor.get(IClipboardService);
            const tunnels = Array.from(remoteExplorerService.tunnelModel.forwarded.values()).concat(Array.from(remoteExplorerService.tunnelModel.detected.values()));
            const result = await quickInputService.pick(makeTunnelPicks(tunnels, remoteExplorerService, tunnelService), { placeHolder: nls.localize('remote.tunnel.copyAddressPlaceholdter', "Choose a forwarded port") });
            if (result && result.tunnel) {
                await copyAddress(remoteExplorerService, clipboardService, result.tunnel);
            }
            else if (result) {
                await commandService.executeCommand(ForwardPortAction.COMMANDPALETTE_ID);
            }
        };
    }
    CopyAddressAction.commandPaletteHandler = commandPaletteHandler;
})(CopyAddressAction || (CopyAddressAction = {}));
var ChangeLocalPortAction;
(function (ChangeLocalPortAction) {
    ChangeLocalPortAction.ID = 'remote.tunnel.changeLocalPort';
    ChangeLocalPortAction.LABEL = nls.localize('remote.tunnel.changeLocalPort', "Change Local Address Port");
    function validateInput(tunnelService, value, canElevate) {
        if (!value.match(/^[0-9]+$/)) {
            return { content: nls.localize('remote.tunnelsView.portShouldBeNumber', "Local port should be a number."), severity: Severity.Error };
        }
        else if (Number(value) >= maxPortNumber) {
            return { content: invalidPortNumberString, severity: Severity.Error };
        }
        else if (canElevate && tunnelService.isPortPrivileged(Number(value))) {
            return { content: requiresSudoString, severity: Severity.Info };
        }
        return null;
    }
    function handler() {
        return async (accessor, arg) => {
            const remoteExplorerService = accessor.get(IRemoteExplorerService);
            const notificationService = accessor.get(INotificationService);
            const tunnelService = accessor.get(ITunnelService);
            let tunnelContext;
            if (isITunnelItem(arg)) {
                tunnelContext = arg;
            }
            else {
                const context = accessor.get(IContextKeyService).getContextKeyValue(TunnelViewSelectionKeyName);
                const tunnel = context ? remoteExplorerService.tunnelModel.forwarded.get(context) : undefined;
                if (tunnel) {
                    const tunnelService = accessor.get(ITunnelService);
                    tunnelContext = TunnelItem.createFromTunnel(remoteExplorerService, tunnelService, tunnel);
                }
            }
            if (tunnelContext) {
                const tunnelItem = tunnelContext;
                remoteExplorerService.setEditable(tunnelItem, TunnelEditId.LocalPort, {
                    onFinish: async (value, success) => {
                        remoteExplorerService.setEditable(tunnelItem, TunnelEditId.LocalPort, null);
                        if (success) {
                            await remoteExplorerService.close({ host: tunnelItem.remoteHost, port: tunnelItem.remotePort }, TunnelCloseReason.Other);
                            const numberValue = Number(value);
                            const newForward = await remoteExplorerService.forward({
                                remote: { host: tunnelItem.remoteHost, port: tunnelItem.remotePort },
                                local: numberValue,
                                name: tunnelItem.name,
                                elevateIfNeeded: true,
                                source: tunnelItem.source
                            });
                            if (newForward && (typeof newForward !== 'string') && newForward.tunnelLocalPort !== numberValue) {
                                notificationService.warn(nls.localize('remote.tunnel.changeLocalPortNumber', "The local port {0} is not available. Port number {1} has been used instead", value, newForward.tunnelLocalPort ?? newForward.localAddress));
                            }
                        }
                    },
                    validationMessage: (value) => validateInput(tunnelService, value, tunnelService.canElevate),
                    placeholder: nls.localize('remote.tunnelsView.changePort', "New local port")
                });
            }
        };
    }
    ChangeLocalPortAction.handler = handler;
})(ChangeLocalPortAction || (ChangeLocalPortAction = {}));
var ChangeTunnelPrivacyAction;
(function (ChangeTunnelPrivacyAction) {
    function handler(privacyId) {
        return async (accessor, arg) => {
            if (isITunnelItem(arg)) {
                const remoteExplorerService = accessor.get(IRemoteExplorerService);
                await remoteExplorerService.close({ host: arg.remoteHost, port: arg.remotePort }, TunnelCloseReason.Other);
                return remoteExplorerService.forward({
                    remote: { host: arg.remoteHost, port: arg.remotePort },
                    local: arg.localPort,
                    name: arg.name,
                    elevateIfNeeded: true,
                    privacy: privacyId,
                    source: arg.source
                });
            }
            return undefined;
        };
    }
    ChangeTunnelPrivacyAction.handler = handler;
})(ChangeTunnelPrivacyAction || (ChangeTunnelPrivacyAction = {}));
var SetTunnelProtocolAction;
(function (SetTunnelProtocolAction) {
    SetTunnelProtocolAction.ID_HTTP = 'remote.tunnel.setProtocolHttp';
    SetTunnelProtocolAction.ID_HTTPS = 'remote.tunnel.setProtocolHttps';
    SetTunnelProtocolAction.LABEL_HTTP = nls.localize('remote.tunnel.protocolHttp', "HTTP");
    SetTunnelProtocolAction.LABEL_HTTPS = nls.localize('remote.tunnel.protocolHttps', "HTTPS");
    async function handler(arg, protocol, remoteExplorerService, environmentService) {
        if (isITunnelItem(arg)) {
            const attributes = {
                protocol
            };
            const target = environmentService.remoteAuthority ? 4 /* ConfigurationTarget.USER_REMOTE */ : 3 /* ConfigurationTarget.USER_LOCAL */;
            return remoteExplorerService.tunnelModel.configPortsAttributes.addAttributes(arg.remotePort, attributes, target);
        }
    }
    function handlerHttp() {
        return async (accessor, arg) => {
            return handler(arg, TunnelProtocol.Http, accessor.get(IRemoteExplorerService), accessor.get(IWorkbenchEnvironmentService));
        };
    }
    SetTunnelProtocolAction.handlerHttp = handlerHttp;
    function handlerHttps() {
        return async (accessor, arg) => {
            return handler(arg, TunnelProtocol.Https, accessor.get(IRemoteExplorerService), accessor.get(IWorkbenchEnvironmentService));
        };
    }
    SetTunnelProtocolAction.handlerHttps = handlerHttps;
})(SetTunnelProtocolAction || (SetTunnelProtocolAction = {}));
const tunnelViewCommandsWeightBonus = 10; // give our commands a little bit more weight over other default list/tree commands
const isForwardedExpr = TunnelTypeContextKey.isEqualTo(TunnelType.Forwarded);
const isForwardedOrDetectedExpr = ContextKeyExpr.or(isForwardedExpr, TunnelTypeContextKey.isEqualTo(TunnelType.Detected));
const isNotMultiSelectionExpr = TunnelViewMultiSelectionContextKey.isEqualTo(undefined);
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: LabelTunnelAction.ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + tunnelViewCommandsWeightBonus,
    when: ContextKeyExpr.and(TunnelViewFocusContextKey, isForwardedExpr, isNotMultiSelectionExpr),
    primary: 60 /* KeyCode.F2 */,
    mac: {
        primary: 3 /* KeyCode.Enter */
    },
    handler: LabelTunnelAction.handler()
});
CommandsRegistry.registerCommand(ForwardPortAction.INLINE_ID, ForwardPortAction.inlineHandler());
CommandsRegistry.registerCommand(ForwardPortAction.COMMANDPALETTE_ID, ForwardPortAction.commandPaletteHandler());
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: ClosePortAction.INLINE_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + tunnelViewCommandsWeightBonus,
    when: ContextKeyExpr.and(TunnelCloseableContextKey, TunnelViewFocusContextKey),
    primary: 20 /* KeyCode.Delete */,
    mac: {
        primary: 2048 /* KeyMod.CtrlCmd */ | 1 /* KeyCode.Backspace */,
        secondary: [20 /* KeyCode.Delete */]
    },
    handler: ClosePortAction.inlineHandler()
});
CommandsRegistry.registerCommand(ClosePortAction.COMMANDPALETTE_ID, ClosePortAction.commandPaletteHandler());
CommandsRegistry.registerCommand(OpenPortInBrowserAction.ID, OpenPortInBrowserAction.handler());
CommandsRegistry.registerCommand(OpenPortInPreviewAction.ID, OpenPortInPreviewAction.handler());
CommandsRegistry.registerCommand(OpenPortInBrowserCommandPaletteAction.ID, OpenPortInBrowserCommandPaletteAction.handler());
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: CopyAddressAction.INLINE_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + tunnelViewCommandsWeightBonus,
    when: ContextKeyExpr.and(TunnelViewFocusContextKey, isForwardedOrDetectedExpr, isNotMultiSelectionExpr),
    primary: 2048 /* KeyMod.CtrlCmd */ | 33 /* KeyCode.KeyC */,
    handler: CopyAddressAction.inlineHandler()
});
CommandsRegistry.registerCommand(CopyAddressAction.COMMANDPALETTE_ID, CopyAddressAction.commandPaletteHandler());
CommandsRegistry.registerCommand(ChangeLocalPortAction.ID, ChangeLocalPortAction.handler());
CommandsRegistry.registerCommand(SetTunnelProtocolAction.ID_HTTP, SetTunnelProtocolAction.handlerHttp());
CommandsRegistry.registerCommand(SetTunnelProtocolAction.ID_HTTPS, SetTunnelProtocolAction.handlerHttps());
MenuRegistry.appendMenuItem(MenuId.CommandPalette, ({
    command: {
        id: ClosePortAction.COMMANDPALETTE_ID,
        title: ClosePortAction.LABEL
    },
    when: forwardedPortsViewEnabled
}));
MenuRegistry.appendMenuItem(MenuId.CommandPalette, ({
    command: {
        id: ForwardPortAction.COMMANDPALETTE_ID,
        title: ForwardPortAction.LABEL
    },
    when: forwardedPortsViewEnabled
}));
MenuRegistry.appendMenuItem(MenuId.CommandPalette, ({
    command: {
        id: CopyAddressAction.COMMANDPALETTE_ID,
        title: CopyAddressAction.COMMANDPALETTE_LABEL
    },
    when: forwardedPortsViewEnabled
}));
MenuRegistry.appendMenuItem(MenuId.CommandPalette, ({
    command: {
        id: OpenPortInBrowserCommandPaletteAction.ID,
        title: OpenPortInBrowserCommandPaletteAction.LABEL
    },
    when: forwardedPortsViewEnabled
}));
MenuRegistry.appendMenuItem(MenuId.TunnelContext, ({
    group: '._open',
    order: 0,
    command: {
        id: OpenPortInBrowserAction.ID,
        title: OpenPortInBrowserAction.LABEL,
    },
    when: ContextKeyExpr.and(isForwardedOrDetectedExpr, isNotMultiSelectionExpr)
}));
MenuRegistry.appendMenuItem(MenuId.TunnelContext, ({
    group: '._open',
    order: 1,
    command: {
        id: OpenPortInPreviewAction.ID,
        title: OpenPortInPreviewAction.LABEL,
    },
    when: ContextKeyExpr.and(isForwardedOrDetectedExpr, isNotMultiSelectionExpr)
}));
// The group 0_manage is used by extensions, so try not to change it
MenuRegistry.appendMenuItem(MenuId.TunnelContext, ({
    group: '0_manage',
    order: 1,
    command: {
        id: LabelTunnelAction.ID,
        title: LabelTunnelAction.LABEL,
        icon: labelPortIcon
    },
    when: ContextKeyExpr.and(isForwardedExpr, isNotMultiSelectionExpr)
}));
MenuRegistry.appendMenuItem(MenuId.TunnelContext, ({
    group: '2_localaddress',
    order: 0,
    command: {
        id: CopyAddressAction.INLINE_ID,
        title: CopyAddressAction.INLINE_LABEL,
    },
    when: ContextKeyExpr.and(isForwardedOrDetectedExpr, isNotMultiSelectionExpr)
}));
MenuRegistry.appendMenuItem(MenuId.TunnelContext, ({
    group: '2_localaddress',
    order: 1,
    command: {
        id: ChangeLocalPortAction.ID,
        title: ChangeLocalPortAction.LABEL,
    },
    when: ContextKeyExpr.and(isForwardedExpr, PortChangableContextKey, isNotMultiSelectionExpr)
}));
MenuRegistry.appendMenuItem(MenuId.TunnelContext, ({
    group: '2_localaddress',
    order: 2,
    submenu: MenuId.TunnelPrivacy,
    title: nls.localize('tunnelContext.privacyMenu', "Port Visibility"),
    when: ContextKeyExpr.and(isForwardedExpr, TunnelPrivacyEnabledContextKey)
}));
MenuRegistry.appendMenuItem(MenuId.TunnelContext, ({
    group: '2_localaddress',
    order: 3,
    submenu: MenuId.TunnelProtocol,
    title: nls.localize('tunnelContext.protocolMenu', "Change Port Protocol"),
    when: ContextKeyExpr.and(isForwardedExpr, isNotMultiSelectionExpr, ProtocolChangeableContextKey)
}));
MenuRegistry.appendMenuItem(MenuId.TunnelContext, ({
    group: '3_forward',
    order: 0,
    command: {
        id: ClosePortAction.INLINE_ID,
        title: ClosePortAction.LABEL,
    },
    when: TunnelCloseableContextKey
}));
MenuRegistry.appendMenuItem(MenuId.TunnelContext, ({
    group: '3_forward',
    order: 1,
    command: {
        id: ForwardPortAction.INLINE_ID,
        title: ForwardPortAction.LABEL,
    },
}));
MenuRegistry.appendMenuItem(MenuId.TunnelProtocol, ({
    order: 0,
    command: {
        id: SetTunnelProtocolAction.ID_HTTP,
        title: SetTunnelProtocolAction.LABEL_HTTP,
        toggled: TunnelProtocolContextKey.isEqualTo(TunnelProtocol.Http)
    }
}));
MenuRegistry.appendMenuItem(MenuId.TunnelProtocol, ({
    order: 1,
    command: {
        id: SetTunnelProtocolAction.ID_HTTPS,
        title: SetTunnelProtocolAction.LABEL_HTTPS,
        toggled: TunnelProtocolContextKey.isEqualTo(TunnelProtocol.Https)
    }
}));
MenuRegistry.appendMenuItem(MenuId.TunnelPortInline, ({
    group: '0_manage',
    order: 0,
    command: {
        id: ForwardPortAction.INLINE_ID,
        title: ForwardPortAction.TREEITEM_LABEL,
        icon: forwardPortIcon
    },
    when: TunnelTypeContextKey.isEqualTo(TunnelType.Candidate)
}));
MenuRegistry.appendMenuItem(MenuId.TunnelPortInline, ({
    group: '0_manage',
    order: 4,
    command: {
        id: LabelTunnelAction.ID,
        title: LabelTunnelAction.LABEL,
        icon: labelPortIcon
    },
    when: isForwardedExpr
}));
MenuRegistry.appendMenuItem(MenuId.TunnelPortInline, ({
    group: '0_manage',
    order: 5,
    command: {
        id: ClosePortAction.INLINE_ID,
        title: ClosePortAction.LABEL,
        icon: stopForwardIcon
    },
    when: TunnelCloseableContextKey
}));
MenuRegistry.appendMenuItem(MenuId.TunnelLocalAddressInline, ({
    order: -1,
    command: {
        id: CopyAddressAction.INLINE_ID,
        title: CopyAddressAction.INLINE_LABEL,
        icon: copyAddressIcon
    },
    when: isForwardedOrDetectedExpr
}));
MenuRegistry.appendMenuItem(MenuId.TunnelLocalAddressInline, ({
    order: 0,
    command: {
        id: OpenPortInBrowserAction.ID,
        title: OpenPortInBrowserAction.LABEL,
        icon: openBrowserIcon
    },
    when: isForwardedOrDetectedExpr
}));
MenuRegistry.appendMenuItem(MenuId.TunnelLocalAddressInline, ({
    order: 1,
    command: {
        id: OpenPortInPreviewAction.ID,
        title: OpenPortInPreviewAction.LABEL,
        icon: openPreviewIcon
    },
    when: isForwardedOrDetectedExpr
}));
registerColor('ports.iconRunningProcessForeground', STATUS_BAR_REMOTE_ITEM_BACKGROUND, nls.localize('portWithRunningProcess.foreground', "The color of the icon for a port that has an associated running process."));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHVubmVsVmlldy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9yZW1vdGUvYnJvd3Nlci90dW5uZWxWaWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLHdCQUF3QixDQUFDO0FBQ2hDLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQWtDLHNCQUFzQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDbEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQy9FLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ25ILE9BQU8sRUFBRSxrQkFBa0IsRUFBZSxhQUFhLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdEksT0FBTyxFQUF1QixxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ3hILE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsa0JBQWtCLEVBQWtDLE1BQU0sc0RBQXNELENBQUM7QUFDMUgsT0FBTyxFQUFFLGVBQWUsRUFBbUIsZ0JBQWdCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUN0SCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekQsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDMUcsT0FBTyxFQUFFLFVBQVUsRUFBZSxZ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