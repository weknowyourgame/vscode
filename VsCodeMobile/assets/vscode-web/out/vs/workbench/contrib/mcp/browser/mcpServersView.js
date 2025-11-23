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
var McpServerRenderer_1;
import './media/mcpServersView.css';
import * as dom from '../../../../base/browser/dom.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createMarkdownCommandLink, MarkdownString } from '../../../../base/common/htmlContent.js';
import { combinedDisposable, Disposable, DisposableStore, dispose, isDisposable } from '../../../../base/common/lifecycle.js';
import { DelayedPagedModel, PagedModel, IterativePagedModel } from '../../../../base/common/paging.js';
import { localize, localize2 } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyDefinedExpr, ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { WorkbenchPagedList } from '../../../../platform/list/browser/listService.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { getLocationBasedViewColors } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService, Extensions as ViewExtensions } from '../../../common/views.js';
import { HasInstalledMcpServersContext, IMcpWorkbenchService, InstalledMcpServersViewId, McpServerContainers, McpServersGalleryStatusContext } from '../common/mcpTypes.js';
import { DropDownAction, getContextMenuActions, InstallAction, InstallingLabelAction, ManageMcpServerAction, McpServerStatusAction } from './mcpServerActions.js';
import { PublisherWidget, StarredWidget, McpServerIconWidget, McpServerHoverWidget, McpServerScopeBadgeWidget } from './mcpServerWidgets.js';
import { ActionRunner, Separator } from '../../../../base/common/actions.js';
import { mcpGalleryServiceEnablementConfig, mcpGalleryServiceUrlConfig } from '../../../../platform/mcp/common/mcpManagement.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { alert } from '../../../../base/browser/ui/aria/aria.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { DefaultViewsContext, SearchMcpServersContext } from '../../extensions/common/extensions.js';
import { VIEW_CONTAINER } from '../../extensions/browser/extensions.contribution.js';
import { ChatContextKeys } from '../../chat/common/chatContextKeys.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { AbstractExtensionsListView } from '../../extensions/browser/extensionsViews.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { mcpServerIcon } from './mcpServerIcons.js';
import { IMcpGalleryManifestService } from '../../../../platform/mcp/common/mcpGalleryManifest.js';
import { ProductQualityContext } from '../../../../platform/contextkey/common/contextkeys.js';
import { SeverityIcon } from '../../../../base/browser/ui/severityIcon/severityIcon.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
let McpServersListView = class McpServersListView extends AbstractExtensionsListView {
    constructor(mpcViewOptions, options, keybindingService, contextMenuService, instantiationService, themeService, hoverService, configurationService, contextKeyService, viewDescriptorService, openerService, dialogService, mcpWorkbenchService, mcpGalleryManifestService, layoutService, markdownRendererService) {
        super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this.mpcViewOptions = mpcViewOptions;
        this.dialogService = dialogService;
        this.mcpWorkbenchService = mcpWorkbenchService;
        this.mcpGalleryManifestService = mcpGalleryManifestService;
        this.layoutService = layoutService;
        this.markdownRendererService = markdownRendererService;
        this.list = null;
        this.listContainer = null;
        this.welcomeContainer = null;
        this.contextMenuActionRunner = this._register(new ActionRunner());
    }
    renderBody(container) {
        super.renderBody(container);
        // Create welcome container
        this.welcomeContainer = dom.append(container, dom.$('.mcp-welcome-container.hide'));
        this.createWelcomeContent(this.welcomeContainer);
        const messageContainer = dom.append(container, dom.$('.message-container'));
        const messageSeverityIcon = dom.append(messageContainer, dom.$(''));
        const messageBox = dom.append(messageContainer, dom.$('.message'));
        const mcpServersList = dom.$('.mcp-servers-list');
        this.bodyTemplate = {
            mcpServersList,
            messageBox,
            messageContainer,
            messageSeverityIcon
        };
        this.listContainer = dom.append(container, mcpServersList);
        this.list = this._register(this.instantiationService.createInstance(WorkbenchPagedList, `${this.id}-MCP-Servers`, this.listContainer, {
            getHeight() { return 72; },
            getTemplateId: () => McpServerRenderer.templateId,
        }, [this.instantiationService.createInstance(McpServerRenderer, {
                hoverOptions: {
                    position: () => {
                        const viewLocation = this.viewDescriptorService.getViewLocationById(this.id);
                        if (viewLocation === 0 /* ViewContainerLocation.Sidebar */) {
                            return this.layoutService.getSideBarPosition() === 0 /* Position.LEFT */ ? 1 /* HoverPosition.RIGHT */ : 0 /* HoverPosition.LEFT */;
                        }
                        if (viewLocation === 2 /* ViewContainerLocation.AuxiliaryBar */) {
                            return this.layoutService.getSideBarPosition() === 0 /* Position.LEFT */ ? 0 /* HoverPosition.LEFT */ : 1 /* HoverPosition.RIGHT */;
                        }
                        return 1 /* HoverPosition.RIGHT */;
                    }
                }
            })], {
            multipleSelectionSupport: false,
            setRowLineHeight: false,
            horizontalScrolling: false,
            accessibilityProvider: {
                getAriaLabel(mcpServer) {
                    return mcpServer?.label ?? '';
                },
                getWidgetAriaLabel() {
                    return localize('mcp servers', "MCP Servers");
                }
            },
            overrideStyles: getLocationBasedViewColors(this.viewDescriptorService.getViewLocationById(this.id)).listOverrideStyles,
            openOnSingleClick: true,
        }));
        this._register(Event.debounce(Event.filter(this.list.onDidOpen, e => e.element !== null), (_, event) => event, 75, true)(options => {
            this.mcpWorkbenchService.open(options.element, options.editorOptions);
        }));
        this._register(this.list.onContextMenu(e => this.onContextMenu(e), this));
        if (this.input) {
            this.renderInput();
        }
    }
    async onContextMenu(e) {
        if (e.element) {
            const disposables = new DisposableStore();
            const mcpServer = e.element ? this.mcpWorkbenchService.local.find(local => local.id === e.element.id) || e.element
                : e.element;
            const groups = getContextMenuActions(mcpServer, false, this.instantiationService);
            const actions = [];
            for (const menuActions of groups) {
                for (const menuAction of menuActions) {
                    actions.push(menuAction);
                    if (isDisposable(menuAction)) {
                        disposables.add(menuAction);
                    }
                }
                actions.push(new Separator());
            }
            actions.pop();
            this.contextMenuService.showContextMenu({
                getAnchor: () => e.anchor,
                getActions: () => actions,
                actionRunner: this.contextMenuActionRunner,
                onHide: () => disposables.dispose()
            });
        }
    }
    layoutBody(height, width) {
        super.layoutBody(height, width);
        this.list?.layout(height, width);
    }
    async show(query) {
        if (this.input) {
            this.input.disposables.dispose();
            this.input = undefined;
        }
        if (this.mpcViewOptions.showWelcome) {
            this.input = { model: new PagedModel([]), disposables: new DisposableStore(), showWelcomeContent: true };
        }
        else {
            this.input = await this.query(query.trim());
        }
        this.renderInput();
        if (this.input.onDidChangeModel) {
            this.input.disposables.add(this.input.onDidChangeModel(model => {
                if (!this.input) {
                    return;
                }
                this.input.model = model;
                this.renderInput();
            }));
        }
        return this.input.model;
    }
    renderInput() {
        if (!this.input) {
            return;
        }
        if (this.list) {
            this.list.model = new DelayedPagedModel(this.input.model);
        }
        this.showWelcomeContent(!!this.input.showWelcomeContent);
        if (!this.input.showWelcomeContent) {
            this.updateBody();
        }
    }
    showWelcomeContent(show) {
        this.welcomeContainer?.classList.toggle('hide', !show);
        this.listContainer?.classList.toggle('hide', show);
    }
    createWelcomeContent(welcomeContainer) {
        const welcomeContent = dom.append(welcomeContainer, dom.$('.mcp-welcome-content'));
        const iconContainer = dom.append(welcomeContent, dom.$('.mcp-welcome-icon'));
        const iconElement = dom.append(iconContainer, dom.$('span'));
        iconElement.className = ThemeIcon.asClassName(mcpServerIcon);
        const title = dom.append(welcomeContent, dom.$('.mcp-welcome-title'));
        title.textContent = localize('mcp.welcome.title', "MCP Servers");
        const settingsCommandLink = createMarkdownCommandLink({ id: 'workbench.action.openSettings', arguments: [`@id:${mcpGalleryServiceEnablementConfig}`], title: mcpGalleryServiceEnablementConfig, tooltip: localize('mcp.welcome.settings.tooltip', "Open Settings") }).toString();
        const description = dom.append(welcomeContent, dom.$('.mcp-welcome-description'));
        const markdownResult = this._register(this.markdownRendererService.render(new MarkdownString(localize('mcp.welcome.descriptionWithLink', "Browse and install [Model Context Protocol (MCP) servers](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) directly from VS Code to extend agent mode with extra tools for connecting to databases, invoking APIs and performing specialized tasks."), { isTrusted: { enabledCommands: ['workbench.action.openSettings'] } })
            .appendMarkdown('\n\n')
            .appendMarkdown(localize('mcp.gallery.enableDialog.setting', "This feature is currently in preview. You can disable it anytime using the setting {0}.", settingsCommandLink))));
        description.appendChild(markdownResult.element);
        const buttonContainer = dom.append(welcomeContent, dom.$('.mcp-welcome-button-container'));
        const button = this._register(new Button(buttonContainer, {
            title: localize('mcp.welcome.enableGalleryButton', "Enable MCP Servers Marketplace"),
            ...defaultButtonStyles
        }));
        button.label = localize('mcp.welcome.enableGalleryButton', "Enable MCP Servers Marketplace");
        this._register(button.onDidClick(async () => {
            const { result } = await this.dialogService.prompt({
                type: 'info',
                message: localize('mcp.gallery.enableDialog.title', "Enable MCP Servers Marketplace?"),
                custom: {
                    markdownDetails: [{
                            markdown: new MarkdownString(localize('mcp.gallery.enableDialog.setting', "This feature is currently in preview. You can disable it anytime using the setting {0}.", settingsCommandLink), { isTrusted: true })
                        }]
                },
                buttons: [
                    { label: localize('mcp.gallery.enableDialog.enable', "Enable"), run: () => true },
                    { label: localize('mcp.gallery.enableDialog.cancel', "Cancel"), run: () => false }
                ]
            });
            if (result) {
                await this.configurationService.updateValue(mcpGalleryServiceEnablementConfig, true);
            }
        }));
    }
    updateBody(message) {
        if (this.bodyTemplate) {
            const count = this.input?.model.length ?? 0;
            this.bodyTemplate.mcpServersList.classList.toggle('hidden', count === 0);
            this.bodyTemplate.messageContainer.classList.toggle('hidden', !message && count > 0);
            if (this.isBodyVisible()) {
                if (message) {
                    this.bodyTemplate.messageSeverityIcon.className = SeverityIcon.className(message.severity);
                    this.bodyTemplate.messageBox.textContent = message.text;
                }
                else if (count === 0) {
                    this.bodyTemplate.messageSeverityIcon.className = '';
                    this.bodyTemplate.messageBox.textContent = localize('no extensions found', "No MCP Servers found.");
                }
                if (this.bodyTemplate.messageBox.textContent) {
                    alert(this.bodyTemplate.messageBox.textContent);
                }
            }
        }
    }
    async query(query) {
        const disposables = new DisposableStore();
        if (query) {
            const servers = await this.mcpWorkbenchService.queryGallery({ text: query.replace('@mcp', '') });
            const model = disposables.add(new IterativePagedModel(servers));
            return { model, disposables };
        }
        const onDidChangeModel = disposables.add(new Emitter());
        let servers = await this.mcpWorkbenchService.queryLocal();
        disposables.add(Event.debounce(this.mcpWorkbenchService.onChange, () => undefined)(() => {
            const mergedMcpServers = this.mergeChangedMcpServers(servers, [...this.mcpWorkbenchService.local]);
            if (mergedMcpServers) {
                servers = mergedMcpServers;
                onDidChangeModel.fire(new PagedModel(servers));
            }
        }));
        disposables.add(this.mcpWorkbenchService.onReset(() => onDidChangeModel.fire(new PagedModel([...this.mcpWorkbenchService.local]))));
        return { model: new PagedModel(servers), onDidChangeModel: onDidChangeModel.event, disposables };
    }
    mergeChangedMcpServers(mcpServers, newMcpServers) {
        const oldMcpServers = [...mcpServers];
        const findPreviousMcpServerIndex = (from) => {
            let index = -1;
            const previousMcpServerInNew = newMcpServers[from];
            if (previousMcpServerInNew) {
                index = oldMcpServers.findIndex(e => e.id === previousMcpServerInNew.id);
                if (index === -1) {
                    return findPreviousMcpServerIndex(from - 1);
                }
            }
            return index;
        };
        let hasChanged = false;
        for (let index = 0; index < newMcpServers.length; index++) {
            const newMcpServer = newMcpServers[index];
            if (mcpServers.every(r => r.id !== newMcpServer.id)) {
                hasChanged = true;
                mcpServers.splice(findPreviousMcpServerIndex(index - 1) + 1, 0, newMcpServer);
            }
        }
        for (let index = mcpServers.length - 1; index >= 0; index--) {
            const oldMcpServer = mcpServers[index];
            if (newMcpServers.every(r => r.id !== oldMcpServer.id) && newMcpServers.some(r => r.name === oldMcpServer.name)) {
                hasChanged = true;
                mcpServers.splice(index, 1);
            }
        }
        if (!hasChanged) {
            if (mcpServers.length === newMcpServers.length) {
                for (let index = 0; index < newMcpServers.length; index++) {
                    if (mcpServers[index]?.id !== newMcpServers[index]?.id) {
                        hasChanged = true;
                        mcpServers = newMcpServers;
                        break;
                    }
                }
            }
        }
        return hasChanged ? mcpServers : undefined;
    }
};
McpServersListView = __decorate([
    __param(2, IKeybindingService),
    __param(3, IContextMenuService),
    __param(4, IInstantiationService),
    __param(5, IThemeService),
    __param(6, IHoverService),
    __param(7, IConfigurationService),
    __param(8, IContextKeyService),
    __param(9, IViewDescriptorService),
    __param(10, IOpenerService),
    __param(11, IDialogService),
    __param(12, IMcpWorkbenchService),
    __param(13, IMcpGalleryManifestService),
    __param(14, IWorkbenchLayoutService),
    __param(15, IMarkdownRendererService)
], McpServersListView);
export { McpServersListView };
let McpServerRenderer = class McpServerRenderer {
    static { McpServerRenderer_1 = this; }
    static { this.templateId = 'mcpServer'; }
    constructor(options, instantiationService, mcpWorkbenchService, notificationService) {
        this.options = options;
        this.instantiationService = instantiationService;
        this.mcpWorkbenchService = mcpWorkbenchService;
        this.notificationService = notificationService;
        this.templateId = McpServerRenderer_1.templateId;
    }
    renderTemplate(root) {
        const element = dom.append(root, dom.$('.mcp-server-item.extension-list-item'));
        const iconContainer = dom.append(element, dom.$('.icon-container'));
        const iconWidget = this.instantiationService.createInstance(McpServerIconWidget, iconContainer);
        const details = dom.append(element, dom.$('.details'));
        const headerContainer = dom.append(details, dom.$('.header-container'));
        const header = dom.append(headerContainer, dom.$('.header'));
        const name = dom.append(header, dom.$('span.name'));
        const starred = dom.append(header, dom.$('span.ratings'));
        const description = dom.append(details, dom.$('.description.ellipsis'));
        const footer = dom.append(details, dom.$('.footer'));
        const publisherWidget = this.instantiationService.createInstance(PublisherWidget, dom.append(footer, dom.$('.publisher-container')), true);
        const actionbar = new ActionBar(footer, {
            actionViewItemProvider: (action, options) => {
                if (action instanceof DropDownAction) {
                    return action.createActionViewItem(options);
                }
                return undefined;
            },
            focusOnlyEnabledItems: true
        });
        actionbar.setFocusable(false);
        const actionBarListener = actionbar.onDidRun(({ error }) => error && this.notificationService.error(error));
        const mcpServerStatusAction = this.instantiationService.createInstance(McpServerStatusAction);
        const actions = [
            this.instantiationService.createInstance(InstallAction, true),
            this.instantiationService.createInstance(InstallingLabelAction),
            this.instantiationService.createInstance(ManageMcpServerAction, false),
            mcpServerStatusAction
        ];
        const widgets = [
            iconWidget,
            publisherWidget,
            this.instantiationService.createInstance(StarredWidget, starred, true),
            this.instantiationService.createInstance(McpServerScopeBadgeWidget, iconContainer),
            this.instantiationService.createInstance(McpServerHoverWidget, { target: root, position: this.options.hoverOptions.position }, mcpServerStatusAction)
        ];
        const extensionContainers = this.instantiationService.createInstance(McpServerContainers, [...actions, ...widgets]);
        actionbar.push(actions, { icon: true, label: true });
        const disposable = combinedDisposable(...actions, ...widgets, actionbar, actionBarListener, extensionContainers);
        return {
            root, element, name, description, starred, disposables: [disposable], actionbar,
            mcpServerDisposables: [],
            set mcpServer(mcpServer) {
                extensionContainers.mcpServer = mcpServer;
            }
        };
    }
    renderPlaceholder(index, data) {
        data.element.classList.add('loading');
        data.mcpServerDisposables = dispose(data.mcpServerDisposables);
        data.name.textContent = '';
        data.description.textContent = '';
        data.starred.style.display = 'none';
        data.mcpServer = null;
    }
    renderElement(mcpServer, index, data) {
        data.element.classList.remove('loading');
        data.mcpServerDisposables = dispose(data.mcpServerDisposables);
        data.root.setAttribute('data-mcp-server-id', mcpServer.id);
        data.name.textContent = mcpServer.label;
        data.description.textContent = mcpServer.description;
        data.starred.style.display = '';
        data.mcpServer = mcpServer;
        const updateEnablement = () => data.root.classList.toggle('disabled', !!mcpServer.runtimeStatus?.state && mcpServer.runtimeStatus.state !== 2 /* McpServerEnablementState.Enabled */);
        updateEnablement();
        data.mcpServerDisposables.push(this.mcpWorkbenchService.onChange(e => {
            if (!e || e.id === mcpServer.id) {
                updateEnablement();
            }
        }));
    }
    disposeElement(mcpServer, index, data) {
        data.mcpServerDisposables = dispose(data.mcpServerDisposables);
    }
    disposeTemplate(data) {
        data.mcpServerDisposables = dispose(data.mcpServerDisposables);
        data.disposables = dispose(data.disposables);
    }
};
McpServerRenderer = McpServerRenderer_1 = __decorate([
    __param(1, IInstantiationService),
    __param(2, IMcpWorkbenchService),
    __param(3, INotificationService)
], McpServerRenderer);
export class DefaultBrowseMcpServersView extends McpServersListView {
    renderBody(container) {
        super.renderBody(container);
        this._register(this.mcpGalleryManifestService.onDidChangeMcpGalleryManifest(() => this.show()));
    }
    async show() {
        return super.show('@mcp');
    }
}
export class McpServersViewsContribution extends Disposable {
    static { this.ID = 'workbench.mcp.servers.views.contribution'; }
    constructor() {
        super();
        Registry.as(ViewExtensions.ViewsRegistry).registerViews([
            {
                id: InstalledMcpServersViewId,
                name: localize2('mcp-installed', "MCP Servers - Installed"),
                ctorDescriptor: new SyncDescriptor(McpServersListView, [{}]),
                when: ContextKeyExpr.and(DefaultViewsContext, HasInstalledMcpServersContext, ChatContextKeys.Setup.hidden.negate()),
                weight: 40,
                order: 4,
                canToggleVisibility: true
            },
            {
                id: 'workbench.views.mcp.default.marketplace',
                name: localize2('mcp', "MCP Servers"),
                ctorDescriptor: new SyncDescriptor(DefaultBrowseMcpServersView, [{}]),
                when: ContextKeyExpr.and(DefaultViewsContext, HasInstalledMcpServersContext.toNegated(), ChatContextKeys.Setup.hidden.negate(), McpServersGalleryStatusContext.isEqualTo("available" /* McpGalleryManifestStatus.Available */), ContextKeyExpr.or(ContextKeyDefinedExpr.create(`config.${mcpGalleryServiceUrlConfig}`), ProductQualityContext.notEqualsTo('stable'), ContextKeyDefinedExpr.create(`config.${mcpGalleryServiceEnablementConfig}`))),
                weight: 40,
                order: 4,
                canToggleVisibility: true
            },
            {
                id: 'workbench.views.mcp.marketplace',
                name: localize2('mcp', "MCP Servers"),
                ctorDescriptor: new SyncDescriptor(McpServersListView, [{}]),
                when: ContextKeyExpr.and(SearchMcpServersContext, ChatContextKeys.Setup.hidden.negate(), McpServersGalleryStatusContext.isEqualTo("available" /* McpGalleryManifestStatus.Available */), ContextKeyExpr.or(ContextKeyDefinedExpr.create(`config.${mcpGalleryServiceUrlConfig}`), ProductQualityContext.notEqualsTo('stable'), ContextKeyDefinedExpr.create(`config.${mcpGalleryServiceEnablementConfig}`))),
            },
            {
                id: 'workbench.views.mcp.default.welcomeView',
                name: localize2('mcp', "MCP Servers"),
                ctorDescriptor: new SyncDescriptor(DefaultBrowseMcpServersView, [{ showWelcome: true }]),
                when: ContextKeyExpr.and(DefaultViewsContext, HasInstalledMcpServersContext.toNegated(), ChatContextKeys.Setup.hidden.negate(), McpServersGalleryStatusContext.isEqualTo("available" /* McpGalleryManifestStatus.Available */), ContextKeyDefinedExpr.create(`config.${mcpGalleryServiceUrlConfig}`).negate(), ProductQualityContext.isEqualTo('stable'), ContextKeyDefinedExpr.create(`config.${mcpGalleryServiceEnablementConfig}`).negate()),
                weight: 40,
                order: 4,
                canToggleVisibility: true
            },
            {
                id: 'workbench.views.mcp.welcomeView',
                name: localize2('mcp', "MCP Servers"),
                ctorDescriptor: new SyncDescriptor(McpServersListView, [{ showWelcome: true }]),
                when: ContextKeyExpr.and(SearchMcpServersContext, ChatContextKeys.Setup.hidden.negate(), McpServersGalleryStatusContext.isEqualTo("available" /* McpGalleryManifestStatus.Available */), ContextKeyDefinedExpr.create(`config.${mcpGalleryServiceUrlConfig}`).negate(), ProductQualityContext.isEqualTo('stable'), ContextKeyDefinedExpr.create(`config.${mcpGalleryServiceEnablementConfig}`).negate()),
            }
        ], VIEW_CONTAINER);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwU2VydmVyc1ZpZXcuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2Jyb3dzZXIvbWNwU2VydmVyc1ZpZXcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sNEJBQTRCLENBQUM7QUFDcEMsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFFL0UsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsY0FBYyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbkcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFlLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNJLE9BQU8sRUFBRSxpQkFBaUIsRUFBZSxVQUFVLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNwSCxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3pELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNqSSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM5RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxD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