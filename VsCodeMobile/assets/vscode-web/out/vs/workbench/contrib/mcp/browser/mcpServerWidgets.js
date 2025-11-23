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
import * as dom from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { verifiedPublisherIcon } from '../../../services/extensionManagement/common/extensionsIcons.js';
import { IThemeService, registerThemingParticipant } from '../../../../platform/theme/common/themeService.js';
import { isDark } from '../../../../platform/theme/common/theme.js';
import { Emitter } from '../../../../base/common/event.js';
import { reset } from '../../../../base/browser/dom.js';
import { mcpLicenseIcon, mcpServerIcon, mcpServerRemoteIcon, mcpServerWorkspaceIcon, mcpStarredIcon } from './mcpServerIcons.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { ExtensionIconBadge } from '../../extensions/browser/extensionsWidgets.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { registerColor } from '../../../../platform/theme/common/colorUtils.js';
import { textLinkForeground } from '../../../../platform/theme/common/colorRegistry.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
export class McpServerWidget extends Disposable {
    constructor() {
        super(...arguments);
        this._mcpServer = null;
    }
    get mcpServer() { return this._mcpServer; }
    set mcpServer(mcpServer) { this._mcpServer = mcpServer; this.update(); }
    update() { this.render(); }
}
export function onClick(element, callback) {
    const disposables = new DisposableStore();
    disposables.add(dom.addDisposableListener(element, dom.EventType.CLICK, dom.finalHandler(callback)));
    disposables.add(dom.addDisposableListener(element, dom.EventType.KEY_UP, e => {
        const keyboardEvent = new StandardKeyboardEvent(e);
        if (keyboardEvent.equals(10 /* KeyCode.Space */) || keyboardEvent.equals(3 /* KeyCode.Enter */)) {
            e.preventDefault();
            e.stopPropagation();
            callback();
        }
    }));
    return disposables;
}
let McpServerIconWidget = class McpServerIconWidget extends McpServerWidget {
    constructor(container, themeService) {
        super();
        this.themeService = themeService;
        this.iconLoadingDisposable = this._register(new MutableDisposable());
        this.element = dom.append(container, dom.$('.extension-icon'));
        this.iconElement = dom.append(this.element, dom.$('img.icon', { alt: '' }));
        this.iconElement.style.display = 'none';
        this.codiconIconElement = dom.append(this.element, dom.$(ThemeIcon.asCSSSelector(mcpServerIcon)));
        this.codiconIconElement.style.display = 'none';
        this.render();
        this._register(toDisposable(() => this.clear()));
        this._register(this.themeService.onDidColorThemeChange(() => this.render()));
    }
    clear() {
        this.iconUrl = undefined;
        this.iconElement.src = '';
        this.iconElement.style.display = 'none';
        this.codiconIconElement.style.display = 'none';
        this.codiconIconElement.className = ThemeIcon.asClassName(mcpServerIcon);
        this.iconLoadingDisposable.clear();
    }
    render() {
        if (!this.mcpServer) {
            this.clear();
            return;
        }
        if (this.mcpServer.icon) {
            const type = this.themeService.getColorTheme().type;
            const iconUrl = isDark(type) ? this.mcpServer.icon.dark : this.mcpServer.icon.light;
            if (this.iconUrl !== iconUrl) {
                this.iconElement.style.display = 'inherit';
                this.codiconIconElement.style.display = 'none';
                this.iconUrl = iconUrl;
                this.iconLoadingDisposable.value = dom.addDisposableListener(this.iconElement, 'error', () => {
                    this.iconElement.style.display = 'none';
                    this.codiconIconElement.style.display = 'inherit';
                }, { once: true });
                this.iconElement.src = this.iconUrl;
                if (!this.iconElement.complete) {
                    this.iconElement.style.visibility = 'hidden';
                    this.iconElement.onload = () => this.iconElement.style.visibility = 'inherit';
                }
                else {
                    this.iconElement.style.visibility = 'inherit';
                }
            }
        }
        else {
            this.iconUrl = undefined;
            this.iconElement.style.display = 'none';
            this.iconElement.src = '';
            this.codiconIconElement.className = this.mcpServer.codicon ? `codicon ${this.mcpServer.codicon}` : ThemeIcon.asClassName(mcpServerIcon);
            this.codiconIconElement.style.display = 'inherit';
            this.iconLoadingDisposable.clear();
        }
    }
};
McpServerIconWidget = __decorate([
    __param(1, IThemeService)
], McpServerIconWidget);
export { McpServerIconWidget };
let PublisherWidget = class PublisherWidget extends McpServerWidget {
    constructor(container, small, hoverService, openerService) {
        super();
        this.container = container;
        this.small = small;
        this.hoverService = hoverService;
        this.openerService = openerService;
        this.disposables = this._register(new DisposableStore());
        this.render();
        this._register(toDisposable(() => this.clear()));
    }
    clear() {
        this.element?.remove();
        this.disposables.clear();
    }
    render() {
        this.clear();
        if (!this.mcpServer?.publisherDisplayName) {
            return;
        }
        this.element = dom.append(this.container, dom.$('.publisher'));
        const publisherDisplayName = dom.$('.publisher-name.ellipsis');
        publisherDisplayName.textContent = this.mcpServer.publisherDisplayName;
        const verifiedPublisher = dom.$('.verified-publisher');
        dom.append(verifiedPublisher, dom.$('span.extension-verified-publisher.clickable'), renderIcon(verifiedPublisherIcon));
        if (this.small) {
            if (this.mcpServer.gallery?.publisherDomain?.verified) {
                dom.append(this.element, verifiedPublisher);
            }
            dom.append(this.element, publisherDisplayName);
        }
        else {
            this.element.classList.toggle('clickable', !!this.mcpServer.gallery?.publisherUrl);
            this.element.setAttribute('role', 'button');
            this.element.tabIndex = 0;
            this.containerHover = this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), this.element, localize('publisher', "Publisher ({0})", this.mcpServer.publisherDisplayName)));
            dom.append(this.element, publisherDisplayName);
            if (this.mcpServer.gallery?.publisherDomain?.verified) {
                dom.append(this.element, verifiedPublisher);
                const publisherDomainLink = URI.parse(this.mcpServer.gallery?.publisherDomain.link);
                verifiedPublisher.tabIndex = 0;
                verifiedPublisher.setAttribute('role', 'button');
                this.containerHover.update(localize('verified publisher', "This publisher has verified ownership of {0}", this.mcpServer.gallery?.publisherDomain.link));
                verifiedPublisher.setAttribute('role', 'link');
                dom.append(verifiedPublisher, dom.$('span.extension-verified-publisher-domain', undefined, publisherDomainLink.authority.startsWith('www.') ? publisherDomainLink.authority.substring(4) : publisherDomainLink.authority));
                this.disposables.add(onClick(verifiedPublisher, () => this.openerService.open(publisherDomainLink)));
            }
            if (this.mcpServer.gallery?.publisherUrl) {
                this.disposables.add(onClick(this.element, () => this.openerService.open(this.mcpServer?.gallery?.publisherUrl)));
            }
        }
    }
};
PublisherWidget = __decorate([
    __param(2, IHoverService),
    __param(3, IOpenerService)
], PublisherWidget);
export { PublisherWidget };
export class StarredWidget extends McpServerWidget {
    constructor(container, small) {
        super();
        this.container = container;
        this.small = small;
        this.disposables = this._register(new DisposableStore());
        this.container.classList.add('extension-ratings');
        if (this.small) {
            container.classList.add('small');
        }
        this.render();
        this._register(toDisposable(() => this.clear()));
    }
    clear() {
        this.container.innerText = '';
        this.disposables.clear();
    }
    render() {
        this.clear();
        if (!this.mcpServer?.starsCount) {
            return;
        }
        if (this.small && this.mcpServer.installState !== 3 /* McpServerInstallState.Uninstalled */) {
            return;
        }
        const parent = this.small ? this.container : dom.append(this.container, dom.$('span.rating', { tabIndex: 0 }));
        dom.append(parent, dom.$('span' + ThemeIcon.asCSSSelector(mcpStarredIcon)));
        const ratingCountElement = dom.append(parent, dom.$('span.count', undefined, StarredWidget.getCountLabel(this.mcpServer.starsCount)));
        if (!this.small) {
            ratingCountElement.style.paddingLeft = '3px';
        }
    }
    static getCountLabel(starsCount) {
        if (starsCount > 1000000) {
            return `${Math.floor(starsCount / 100000) / 10}M`;
        }
        else if (starsCount > 1000) {
            return `${Math.floor(starsCount / 1000)}K`;
        }
        else {
            return String(starsCount);
        }
    }
}
export class LicenseWidget extends McpServerWidget {
    constructor(container) {
        super();
        this.container = container;
        this.disposables = this._register(new DisposableStore());
        this.container.classList.add('license');
        this.render();
        this._register(toDisposable(() => this.clear()));
    }
    clear() {
        this.container.innerText = '';
        this.disposables.clear();
    }
    render() {
        this.clear();
        if (!this.mcpServer?.license) {
            return;
        }
        const parent = dom.append(this.container, dom.$('span.license', { tabIndex: 0 }));
        dom.append(parent, dom.$('span' + ThemeIcon.asCSSSelector(mcpLicenseIcon)));
        const licenseElement = dom.append(parent, dom.$('span', undefined, this.mcpServer.license));
        licenseElement.style.paddingLeft = '3px';
    }
}
let McpServerHoverWidget = class McpServerHoverWidget extends McpServerWidget {
    constructor(options, mcpServerStatusAction, hoverService, configurationService) {
        super();
        this.options = options;
        this.mcpServerStatusAction = mcpServerStatusAction;
        this.hoverService = hoverService;
        this.configurationService = configurationService;
        this.hover = this._register(new MutableDisposable());
    }
    render() {
        this.hover.value = undefined;
        if (this.mcpServer) {
            this.hover.value = this.hoverService.setupManagedHover({
                delay: this.configurationService.getValue('workbench.hover.delay'),
                showHover: (options, focus) => {
                    return this.hoverService.showInstantHover({
                        ...options,
                        additionalClasses: ['extension-hover'],
                        position: {
                            hoverPosition: this.options.position(),
                            forcePosition: true,
                        },
                        persistence: {
                            hideOnKeyDown: true,
                        }
                    }, focus);
                },
                placement: 'element'
            }, this.options.target, {
                markdown: () => Promise.resolve(this.getHoverMarkdown()),
                markdownNotSupportedFallback: undefined
            }, {
                appearance: {
                    showHoverHint: true
                }
            });
        }
    }
    getHoverMarkdown() {
        if (!this.mcpServer) {
            return undefined;
        }
        const markdown = new MarkdownString('', { isTrusted: true, supportThemeIcons: true });
        markdown.appendMarkdown(`**${this.mcpServer.label}**`);
        markdown.appendText(`\n`);
        let addSeparator = false;
        if (this.mcpServer.local?.scope === "workspace" /* LocalMcpServerScope.Workspace */) {
            markdown.appendMarkdown(`$(${mcpServerWorkspaceIcon.id})&nbsp;`);
            markdown.appendMarkdown(localize('workspace extension', "Workspace MCP Server"));
            addSeparator = true;
        }
        if (this.mcpServer.local?.scope === "remoteUser" /* LocalMcpServerScope.RemoteUser */) {
            markdown.appendMarkdown(`$(${mcpServerRemoteIcon.id})&nbsp;`);
            markdown.appendMarkdown(localize('remote user extension', "Remote MCP Server"));
            addSeparator = true;
        }
        if (this.mcpServer.installState === 1 /* McpServerInstallState.Installed */) {
            if (this.mcpServer.starsCount) {
                if (addSeparator) {
                    markdown.appendText(`  |  `);
                }
                const starsCountLabel = StarredWidget.getCountLabel(this.mcpServer.starsCount);
                markdown.appendMarkdown(`$(${mcpStarredIcon.id}) ${starsCountLabel}`);
                addSeparator = true;
            }
        }
        if (addSeparator) {
            markdown.appendText(`\n`);
        }
        if (this.mcpServer.description) {
            markdown.appendMarkdown(`${this.mcpServer.description}`);
        }
        const extensionStatus = this.mcpServerStatusAction.status;
        if (extensionStatus.length) {
            markdown.appendMarkdown(`---`);
            markdown.appendText(`\n`);
            for (const status of extensionStatus) {
                if (status.icon) {
                    markdown.appendMarkdown(`$(${status.icon.id})&nbsp;`);
                }
                markdown.appendMarkdown(status.message.value);
                markdown.appendText(`\n`);
            }
        }
        return markdown;
    }
};
McpServerHoverWidget = __decorate([
    __param(2, IHoverService),
    __param(3, IConfigurationService)
], McpServerHoverWidget);
export { McpServerHoverWidget };
let McpServerScopeBadgeWidget = class McpServerScopeBadgeWidget extends McpServerWidget {
    constructor(container, instantiationService) {
        super();
        this.container = container;
        this.instantiationService = instantiationService;
        this.badge = this._register(new MutableDisposable());
        this.element = dom.append(this.container, dom.$(''));
        this.render();
        this._register(toDisposable(() => this.clear()));
    }
    clear() {
        this.badge.value?.element.remove();
        this.badge.clear();
    }
    render() {
        this.clear();
        const scope = this.mcpServer?.local?.scope;
        if (!scope || scope === "user" /* LocalMcpServerScope.User */) {
            return;
        }
        let icon;
        switch (scope) {
            case "workspace" /* LocalMcpServerScope.Workspace */: {
                icon = mcpServerWorkspaceIcon;
                break;
            }
            case "remoteUser" /* LocalMcpServerScope.RemoteUser */: {
                icon = mcpServerRemoteIcon;
                break;
            }
        }
        this.badge.value = this.instantiationService.createInstance(ExtensionIconBadge, icon, undefined);
        dom.append(this.element, this.badge.value.element);
    }
};
McpServerScopeBadgeWidget = __decorate([
    __param(1, IInstantiationService)
], McpServerScopeBadgeWidget);
export { McpServerScopeBadgeWidget };
let McpServerStatusWidget = class McpServerStatusWidget extends McpServerWidget {
    constructor(container, extensionStatusAction, markdownRendererService) {
        super();
        this.container = container;
        this.extensionStatusAction = extensionStatusAction;
        this.markdownRendererService = markdownRendererService;
        this.renderDisposables = this._register(new MutableDisposable());
        this._onDidRender = this._register(new Emitter());
        this.onDidRender = this._onDidRender.event;
        this.render();
        this._register(extensionStatusAction.onDidChangeStatus(() => this.render()));
    }
    render() {
        reset(this.container);
        this.renderDisposables.value = undefined;
        const disposables = new DisposableStore();
        this.renderDisposables.value = disposables;
        const extensionStatus = this.extensionStatusAction.status;
        if (extensionStatus.length) {
            const markdown = new MarkdownString('', { isTrusted: true, supportThemeIcons: true });
            for (let i = 0; i < extensionStatus.length; i++) {
                const status = extensionStatus[i];
                if (status.icon) {
                    markdown.appendMarkdown(`$(${status.icon.id})&nbsp;`);
                }
                markdown.appendMarkdown(status.message.value);
                if (i < extensionStatus.length - 1) {
                    markdown.appendText(`\n`);
                }
            }
            const rendered = disposables.add(this.markdownRendererService.render(markdown));
            dom.append(this.container, rendered.element);
        }
        this._onDidRender.fire();
    }
};
McpServerStatusWidget = __decorate([
    __param(2, IMarkdownRendererService)
], McpServerStatusWidget);
export { McpServerStatusWidget };
export const mcpStarredIconColor = registerColor('mcpIcon.starForeground', { light: '#DF6100', dark: '#FF8E00', hcDark: '#FF8E00', hcLight: textLinkForeground }, localize('mcpIconStarForeground', "The icon color for mcp starred."), false);
registerThemingParticipant((theme, collector) => {
    const mcpStarredIconColorValue = theme.getColor(mcpStarredIconColor);
    if (mcpStarredIconColorValue) {
        collector.addRule(`.extension-ratings .codicon-mcp-server-starred { color: ${mcpStarredIconColorValue}; }`);
        collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(mcpStarredIcon)} { color: ${mcpStarredIconColorValue}; }`);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwU2VydmVyV2lkZ2V0cy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvYnJvd3Nlci9tY3BTZXJ2ZXJXaWRnZXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFFbEYsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDcEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBRWpGLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLGlCQUFpQixFQUFFLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pJLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDOUUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0saUVBQWlFLENBQUM7QUFFeEcsT0FBTyxFQUFFLGFBQWEsRUFBRSwwQkFBMEIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQzlHLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sa0NBQWtDLENBQUM7QUFFbEUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3hELE9B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