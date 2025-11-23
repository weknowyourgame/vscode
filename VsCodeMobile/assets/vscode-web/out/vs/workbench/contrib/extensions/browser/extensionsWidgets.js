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
var InstallCountWidget_1, ExtensionHoverWidget_1;
import './media/extensionsWidgets.css';
import * as semver from '../../../../base/common/semver/semver.js';
import { Disposable, toDisposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { IExtensionsWorkbenchService } from '../common/extensions.js';
import { append, $, reset, addDisposableListener, EventType, finalHandler } from '../../../../base/browser/dom.js';
import * as platform from '../../../../base/common/platform.js';
import { localize } from '../../../../nls.js';
import { IExtensionManagementServerService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionIgnoredRecommendationsService, IExtensionRecommendationsService } from '../../../services/extensionRecommendations/common/extensionRecommendations.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { extensionButtonProminentBackground } from './extensionsActions.js';
import { IThemeService, registerThemingParticipant } from '../../../../platform/theme/common/themeService.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { EXTENSION_BADGE_BACKGROUND, EXTENSION_BADGE_FOREGROUND } from '../../../common/theme.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { CountBadge } from '../../../../base/browser/ui/countBadge/countBadge.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IUserDataSyncEnablementService } from '../../../../platform/userDataSync/common/userDataSync.js';
import { activationTimeIcon, errorIcon, infoIcon, installCountIcon, preReleaseIcon, privateExtensionIcon, ratingIcon, remoteIcon, sponsorIcon, starEmptyIcon, starFullIcon, starHalfIcon, syncIgnoredIcon, warningIcon } from './extensionsIcons.js';
import { registerColor, textLinkForeground } from '../../../../platform/theme/common/colorRegistry.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { createCommandUri, MarkdownString } from '../../../../base/common/htmlContent.js';
import { URI } from '../../../../base/common/uri.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { areSameExtensions } from '../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import Severity from '../../../../base/common/severity.js';
import { Color } from '../../../../base/common/color.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { defaultCountBadgeStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions, IExtensionFeaturesManagementService } from '../../../services/extensionManagement/common/extensionFeatures.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { extensionDefaultIcon, extensionVerifiedPublisherIconColor, verifiedPublisherIcon } from '../../../services/extensionManagement/common/extensionsIcons.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IExplorerService } from '../../files/browser/files.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { VIEW_ID as EXPLORER_VIEW_ID } from '../../files/common/files.js';
import { IExtensionGalleryManifestService } from '../../../../platform/extensionManagement/common/extensionGalleryManifest.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
export class ExtensionWidget extends Disposable {
    constructor() {
        super(...arguments);
        this._extension = null;
    }
    get extension() { return this._extension; }
    set extension(extension) { this._extension = extension; this.update(); }
    update() { this.render(); }
}
export function onClick(element, callback) {
    const disposables = new DisposableStore();
    disposables.add(addDisposableListener(element, EventType.CLICK, finalHandler(callback)));
    disposables.add(addDisposableListener(element, EventType.KEY_UP, e => {
        const keyboardEvent = new StandardKeyboardEvent(e);
        if (keyboardEvent.equals(10 /* KeyCode.Space */) || keyboardEvent.equals(3 /* KeyCode.Enter */)) {
            e.preventDefault();
            e.stopPropagation();
            callback();
        }
    }));
    return disposables;
}
export class ExtensionIconWidget extends ExtensionWidget {
    constructor(container) {
        super();
        this.iconLoadingDisposable = this._register(new MutableDisposable());
        this.element = append(container, $('.extension-icon'));
        this.iconElement = append(this.element, $('img.icon', { alt: '' }));
        this.iconElement.style.display = 'none';
        this.defaultIconElement = append(this.element, $(ThemeIcon.asCSSSelector(extensionDefaultIcon)));
        this.defaultIconElement.style.display = 'none';
        this.render();
        this._register(toDisposable(() => this.clear()));
    }
    clear() {
        this.iconUrl = undefined;
        this.iconElement.src = '';
        this.iconElement.style.display = 'none';
        this.defaultIconElement.style.display = 'none';
        this.iconLoadingDisposable.clear();
    }
    render() {
        if (!this.extension) {
            this.clear();
            return;
        }
        if (this.extension.iconUrl) {
            if (this.iconUrl !== this.extension.iconUrl) {
                this.iconElement.style.display = 'inherit';
                this.defaultIconElement.style.display = 'none';
                this.iconUrl = this.extension.iconUrl;
                this.iconLoadingDisposable.value = addDisposableListener(this.iconElement, 'error', () => {
                    if (this.extension?.iconUrlFallback) {
                        this.iconElement.src = this.extension.iconUrlFallback;
                    }
                    else {
                        this.iconElement.style.display = 'none';
                        this.defaultIconElement.style.display = 'inherit';
                    }
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
            this.defaultIconElement.style.display = 'inherit';
            this.iconLoadingDisposable.clear();
        }
    }
}
let InstallCountWidget = InstallCountWidget_1 = class InstallCountWidget extends ExtensionWidget {
    constructor(container, small, hoverService) {
        super();
        this.container = container;
        this.small = small;
        this.hoverService = hoverService;
        this.disposables = this._register(new DisposableStore());
        this.render();
        this._register(toDisposable(() => this.clear()));
    }
    clear() {
        this.container.innerText = '';
        this.disposables.clear();
    }
    render() {
        this.clear();
        if (!this.extension) {
            return;
        }
        if (this.small && this.extension.state !== 3 /* ExtensionState.Uninstalled */) {
            return;
        }
        const installLabel = InstallCountWidget_1.getInstallLabel(this.extension, this.small);
        if (!installLabel) {
            return;
        }
        const parent = this.small ? this.container : append(this.container, $('span.install', { tabIndex: 0 }));
        append(parent, $('span' + ThemeIcon.asCSSSelector(installCountIcon)));
        const count = append(parent, $('span.count'));
        count.textContent = installLabel;
        if (!this.small) {
            this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), this.container, localize('install count', "Install count")));
        }
    }
    static getInstallLabel(extension, small) {
        const installCount = extension.installCount;
        if (!installCount) {
            return undefined;
        }
        let installLabel;
        if (small) {
            if (installCount > 1000000) {
                installLabel = `${Math.floor(installCount / 100000) / 10}M`;
            }
            else if (installCount > 1000) {
                installLabel = `${Math.floor(installCount / 1000)}K`;
            }
            else {
                installLabel = String(installCount);
            }
        }
        else {
            installLabel = installCount.toLocaleString(platform.language);
        }
        return installLabel;
    }
};
InstallCountWidget = InstallCountWidget_1 = __decorate([
    __param(2, IHoverService)
], InstallCountWidget);
export { InstallCountWidget };
let RatingsWidget = class RatingsWidget extends ExtensionWidget {
    constructor(container, small, hoverService, openerService) {
        super();
        this.container = container;
        this.small = small;
        this.hoverService = hoverService;
        this.openerService = openerService;
        this.disposables = this._register(new DisposableStore());
        container.classList.add('extension-ratings');
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
        if (!this.extension) {
            return;
        }
        if (this.small && this.extension.state !== 3 /* ExtensionState.Uninstalled */) {
            return;
        }
        if (this.extension.rating === undefined) {
            return;
        }
        if (this.small && !this.extension.ratingCount) {
            return;
        }
        if (!this.extension.url) {
            return;
        }
        const rating = Math.round(this.extension.rating * 2) / 2;
        if (this.small) {
            append(this.container, $('span' + ThemeIcon.asCSSSelector(starFullIcon)));
            const count = append(this.container, $('span.count'));
            count.textContent = String(rating);
        }
        else {
            const element = append(this.container, $('span.rating.clickable', { tabIndex: 0 }));
            for (let i = 1; i <= 5; i++) {
                if (rating >= i) {
                    append(element, $('span' + ThemeIcon.asCSSSelector(starFullIcon)));
                }
                else if (rating >= i - 0.5) {
                    append(element, $('span' + ThemeIcon.asCSSSelector(starHalfIcon)));
                }
                else {
                    append(element, $('span' + ThemeIcon.asCSSSelector(starEmptyIcon)));
                }
            }
            if (this.extension.ratingCount) {
                const ratingCountElemet = append(element, $('span', undefined, ` (${this.extension.ratingCount})`));
                ratingCountElemet.style.paddingLeft = '1px';
            }
            this.containerHover = this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), element, ''));
            this.containerHover.update(localize('ratedLabel', "Average rating: {0} out of 5", rating));
            element.setAttribute('role', 'link');
            if (this.extension.ratingUrl) {
                this.disposables.add(onClick(element, () => this.openerService.open(URI.parse(this.extension.ratingUrl))));
            }
        }
    }
};
RatingsWidget = __decorate([
    __param(2, IHoverService),
    __param(3, IOpenerService)
], RatingsWidget);
export { RatingsWidget };
let PublisherWidget = class PublisherWidget extends ExtensionWidget {
    constructor(container, small, extensionsWorkbenchService, hoverService, openerService) {
        super();
        this.container = container;
        this.small = small;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
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
        if (!this.extension) {
            return;
        }
        if (this.extension.resourceExtension) {
            return;
        }
        if (this.extension.local?.source === 'resource') {
            return;
        }
        this.element = append(this.container, $('.publisher'));
        const publisherDisplayName = $('.publisher-name.ellipsis');
        publisherDisplayName.textContent = this.extension.publisherDisplayName;
        const verifiedPublisher = $('.verified-publisher');
        append(verifiedPublisher, $('span.extension-verified-publisher.clickable'), renderIcon(verifiedPublisherIcon));
        if (this.small) {
            if (this.extension.publisherDomain?.verified) {
                append(this.element, verifiedPublisher);
            }
            append(this.element, publisherDisplayName);
        }
        else {
            this.element.classList.toggle('clickable', !!this.extension.url);
            this.element.setAttribute('role', 'button');
            this.element.tabIndex = 0;
            this.containerHover = this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), this.element, localize('publisher', "Publisher ({0})", this.extension.publisherDisplayName)));
            append(this.element, publisherDisplayName);
            if (this.extension.publisherDomain?.verified) {
                append(this.element, verifiedPublisher);
                const publisherDomainLink = URI.parse(this.extension.publisherDomain.link);
                verifiedPublisher.tabIndex = 0;
                verifiedPublisher.setAttribute('role', 'button');
                this.containerHover.update(localize('verified publisher', "This publisher has verified ownership of {0}", this.extension.publisherDomain.link));
                verifiedPublisher.setAttribute('role', 'link');
                append(verifiedPublisher, $('span.extension-verified-publisher-domain', undefined, publisherDomainLink.authority.startsWith('www.') ? publisherDomainLink.authority.substring(4) : publisherDomainLink.authority));
                this.disposables.add(onClick(verifiedPublisher, () => this.openerService.open(publisherDomainLink)));
            }
            if (this.extension.url) {
                this.disposables.add(onClick(this.element, () => this.extensionsWorkbenchService.openSearch(`publisher:"${this.extension?.publisherDisplayName}"`)));
            }
        }
    }
};
PublisherWidget = __decorate([
    __param(2, IExtensionsWorkbenchService),
    __param(3, IHoverService),
    __param(4, IOpenerService)
], PublisherWidget);
export { PublisherWidget };
let SponsorWidget = class SponsorWidget extends ExtensionWidget {
    constructor(container, hoverService, openerService) {
        super();
        this.container = container;
        this.hoverService = hoverService;
        this.openerService = openerService;
        this.disposables = this._register(new DisposableStore());
        this.render();
    }
    render() {
        reset(this.container);
        this.disposables.clear();
        if (!this.extension?.publisherSponsorLink) {
            return;
        }
        const sponsor = append(this.container, $('span.sponsor.clickable', { tabIndex: 0 }));
        this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), sponsor, this.extension?.publisherSponsorLink.toString() ?? ''));
        sponsor.setAttribute('role', 'link'); // #132645
        const sponsorIconElement = renderIcon(sponsorIcon);
        const label = $('span', undefined, localize('sponsor', "Sponsor"));
        append(sponsor, sponsorIconElement, label);
        this.disposables.add(onClick(sponsor, () => {
            this.openerService.open(this.extension.publisherSponsorLink);
        }));
    }
};
SponsorWidget = __decorate([
    __param(1, IHoverService),
    __param(2, IOpenerService)
], SponsorWidget);
export { SponsorWidget };
let RecommendationWidget = class RecommendationWidget extends ExtensionWidget {
    constructor(parent, extensionRecommendationsService) {
        super();
        this.parent = parent;
        this.extensionRecommendationsService = extensionRecommendationsService;
        this.disposables = this._register(new DisposableStore());
        this.render();
        this._register(toDisposable(() => this.clear()));
        this._register(this.extensionRecommendationsService.onDidChangeRecommendations(() => this.render()));
    }
    clear() {
        this.element?.remove();
        this.element = undefined;
        this.disposables.clear();
    }
    render() {
        this.clear();
        if (!this.extension || this.extension.state === 1 /* ExtensionState.Installed */ || this.extension.deprecationInfo) {
            return;
        }
        const extRecommendations = this.extensionRecommendationsService.getAllRecommendationsWithReason();
        if (extRecommendations[this.extension.identifier.id.toLowerCase()]) {
            this.element = append(this.parent, $('div.extension-bookmark'));
            const recommendation = append(this.element, $('.recommendation'));
            append(recommendation, $('span' + ThemeIcon.asCSSSelector(ratingIcon)));
        }
    }
};
RecommendationWidget = __decorate([
    __param(1, IExtensionRecommendationsService)
], RecommendationWidget);
export { RecommendationWidget };
export class PreReleaseBookmarkWidget extends ExtensionWidget {
    constructor(parent) {
        super();
        this.parent = parent;
        this.disposables = this._register(new DisposableStore());
        this.render();
        this._register(toDisposable(() => this.clear()));
    }
    clear() {
        this.element?.remove();
        this.element = undefined;
        this.disposables.clear();
    }
    render() {
        this.clear();
        if (this.extension?.state === 1 /* ExtensionState.Installed */ ? this.extension.preRelease : this.extension?.hasPreReleaseVersion) {
            this.element = append(this.parent, $('div.extension-bookmark'));
            const preRelease = append(this.element, $('.pre-release'));
            append(preRelease, $('span' + ThemeIcon.asCSSSelector(preReleaseIcon)));
        }
    }
}
let RemoteBadgeWidget = class RemoteBadgeWidget extends ExtensionWidget {
    constructor(parent, tooltip, extensionManagementServerService, instantiationService) {
        super();
        this.tooltip = tooltip;
        this.extensionManagementServerService = extensionManagementServerService;
        this.instantiationService = instantiationService;
        this.remoteBadge = this._register(new MutableDisposable());
        this.element = append(parent, $(''));
        this.render();
        this._register(toDisposable(() => this.clear()));
    }
    clear() {
        this.remoteBadge.value?.element.remove();
        this.remoteBadge.clear();
    }
    render() {
        this.clear();
        if (!this.extension || !this.extension.local || !this.extension.server || !(this.extensionManagementServerService.localExtensionManagementServer && this.extensionManagementServerService.remoteExtensionManagementServer) || this.extension.server !== this.extensionManagementServerService.remoteExtensionManagementServer) {
            return;
        }
        let tooltip;
        if (this.tooltip && this.extensionManagementServerService.remoteExtensionManagementServer) {
            tooltip = localize('remote extension title', "Extension in {0}", this.extensionManagementServerService.remoteExtensionManagementServer.label);
        }
        this.remoteBadge.value = this.instantiationService.createInstance(ExtensionIconBadge, remoteIcon, tooltip);
        append(this.element, this.remoteBadge.value.element);
    }
};
RemoteBadgeWidget = __decorate([
    __param(2, IExtensionManagementServerService),
    __param(3, IInstantiationService)
], RemoteBadgeWidget);
export { RemoteBadgeWidget };
let ExtensionIconBadge = class ExtensionIconBadge extends Disposable {
    constructor(icon, tooltip, hoverService, labelService, themeService) {
        super();
        this.icon = icon;
        this.tooltip = tooltip;
        this.labelService = labelService;
        this.themeService = themeService;
        this.element = $('div.extension-badge.extension-icon-badge');
        this.elementHover = this._register(hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), this.element, ''));
        this.render();
    }
    render() {
        append(this.element, $('span' + ThemeIcon.asCSSSelector(this.icon)));
        const applyBadgeStyle = () => {
            if (!this.element) {
                return;
            }
            const bgColor = this.themeService.getColorTheme().getColor(EXTENSION_BADGE_BACKGROUND);
            const fgColor = this.themeService.getColorTheme().getColor(EXTENSION_BADGE_FOREGROUND);
            this.element.style.backgroundColor = bgColor ? bgColor.toString() : '';
            this.element.style.color = fgColor ? fgColor.toString() : '';
        };
        applyBadgeStyle();
        this._register(this.themeService.onDidColorThemeChange(() => applyBadgeStyle()));
        if (this.tooltip) {
            const updateTitle = () => {
                if (this.element) {
                    this.elementHover.update(this.tooltip);
                }
            };
            this._register(this.labelService.onDidChangeFormatters(() => updateTitle()));
            updateTitle();
        }
    }
};
ExtensionIconBadge = __decorate([
    __param(2, IHoverService),
    __param(3, ILabelService),
    __param(4, IThemeService)
], ExtensionIconBadge);
export { ExtensionIconBadge };
export class ExtensionPackCountWidget extends ExtensionWidget {
    constructor(parent) {
        super();
        this.parent = parent;
        this.render();
        this._register(toDisposable(() => this.clear()));
    }
    clear() {
        this.element?.remove();
        this.countBadge?.dispose();
        this.countBadge = undefined;
    }
    render() {
        this.clear();
        if (!this.extension || !(this.extension.categories?.some(category => category.toLowerCase() === 'extension packs')) || !this.extension.extensionPack.length) {
            return;
        }
        this.element = append(this.parent, $('.extension-badge.extension-pack-badge'));
        this.countBadge = new CountBadge(this.element, {}, defaultCountBadgeStyles);
        this.countBadge.setCount(this.extension.extensionPack.length);
    }
}
let ExtensionKindIndicatorWidget = class ExtensionKindIndicatorWidget extends ExtensionWidget {
    constructor(container, small, hoverService, contextService, uriIdentityService, explorerService, viewsService, extensionGalleryManifestService) {
        super();
        this.container = container;
        this.small = small;
        this.hoverService = hoverService;
        this.contextService = contextService;
        this.uriIdentityService = uriIdentityService;
        this.explorerService = explorerService;
        this.viewsService = viewsService;
        this.extensionGalleryManifest = null;
        this.disposables = this._register(new DisposableStore());
        this.render();
        this._register(toDisposable(() => this.clear()));
        extensionGalleryManifestService.getExtensionGalleryManifest().then(manifest => {
            if (this._store.isDisposed) {
                return;
            }
            this.extensionGalleryManifest = manifest;
            this.render();
        });
    }
    clear() {
        this.element?.remove();
        this.disposables.clear();
    }
    render() {
        this.clear();
        if (!this.extension) {
            return;
        }
        if (this.extension?.private) {
            this.element = append(this.container, $('.extension-kind-indicator'));
            if (!this.small || (this.extensionGalleryManifest?.capabilities.extensions?.includePublicExtensions && this.extensionGalleryManifest?.capabilities.extensions?.includePrivateExtensions)) {
                append(this.element, $('span' + ThemeIcon.asCSSSelector(privateExtensionIcon)));
            }
            if (!this.small) {
                append(this.element, $('span.private-extension-label', undefined, localize('privateExtension', "Private Extension")));
            }
            return;
        }
        if (!this.small) {
            return;
        }
        const location = this.extension.resourceExtension?.location ?? (this.extension.local?.source === 'resource' ? this.extension.local?.location : undefined);
        if (!location) {
            return;
        }
        this.element = append(this.container, $('.extension-kind-indicator'));
        const workspaceFolder = this.contextService.getWorkspaceFolder(location);
        if (workspaceFolder && this.extension.isWorkspaceScoped) {
            this.element.textContent = localize('workspace extension', "Workspace Extension");
            this.element.classList.add('clickable');
            this.element.setAttribute('role', 'button');
            this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), this.element, this.uriIdentityService.extUri.relativePath(workspaceFolder.uri, location)));
            this.disposables.add(onClick(this.element, () => {
                this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true));
            }));
        }
        else {
            this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), this.element, location.path));
            this.element.textContent = localize('local extension', "Local Extension");
        }
    }
};
ExtensionKindIndicatorWidget = __decorate([
    __param(2, IHoverService),
    __param(3, IWorkspaceContextService),
    __param(4, IUriIdentityService),
    __param(5, IExplorerService),
    __param(6, IViewsService),
    __param(7, IExtensionGalleryManifestService)
], ExtensionKindIndicatorWidget);
export { ExtensionKindIndicatorWidget };
let SyncIgnoredWidget = class SyncIgnoredWidget extends ExtensionWidget {
    constructor(container, configurationService, extensionsWorkbenchService, hoverService, userDataSyncEnablementService) {
        super();
        this.container = container;
        this.configurationService = configurationService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.hoverService = hoverService;
        this.userDataSyncEnablementService = userDataSyncEnablementService;
        this.disposables = this._register(new DisposableStore());
        this._register(Event.filter(this.configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('settingsSync.ignoredExtensions'))(() => this.render()));
        this._register(userDataSyncEnablementService.onDidChangeEnablement(() => this.update()));
        this.render();
    }
    render() {
        this.disposables.clear();
        this.container.innerText = '';
        if (this.extension && this.extension.state === 1 /* ExtensionState.Installed */ && this.userDataSyncEnablementService.isEnabled() && this.extensionsWorkbenchService.isExtensionIgnoredToSync(this.extension)) {
            const element = append(this.container, $('span.extension-sync-ignored' + ThemeIcon.asCSSSelector(syncIgnoredIcon)));
            this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), element, localize('syncingore.label', "This extension is ignored during sync.")));
            element.classList.add(...ThemeIcon.asClassNameArray(syncIgnoredIcon));
        }
    }
};
SyncIgnoredWidget = __decorate([
    __param(1, IConfigurationService),
    __param(2, IExtensionsWorkbenchService),
    __param(3, IHoverService),
    __param(4, IUserDataSyncEnablementService)
], SyncIgnoredWidget);
export { SyncIgnoredWidget };
let ExtensionRuntimeStatusWidget = class ExtensionRuntimeStatusWidget extends ExtensionWidget {
    constructor(extensionViewState, container, extensionService, extensionFeaturesManagementService, extensionsWorkbenchService) {
        super();
        this.extensionViewState = extensionViewState;
        this.container = container;
        this.extensionFeaturesManagementService = extensionFeaturesManagementService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this._register(extensionService.onDidChangeExtensionsStatus(extensions => {
            if (this.extension && extensions.some(e => areSameExtensions({ id: e.value }, this.extension.identifier))) {
                this.update();
            }
        }));
        this._register(extensionFeaturesManagementService.onDidChangeAccessData(e => {
            if (this.extension && ExtensionIdentifier.equals(this.extension.identifier.id, e.extension)) {
                this.update();
            }
        }));
    }
    render() {
        this.container.innerText = '';
        if (!this.extension) {
            return;
        }
        if (this.extensionViewState.filters.featureId && this.extension.state === 1 /* ExtensionState.Installed */) {
            const accessData = this.extensionFeaturesManagementService.getAllAccessDataForExtension(new ExtensionIdentifier(this.extension.identifier.id)).get(this.extensionViewState.filters.featureId);
            const feature = Registry.as(Extensions.ExtensionFeaturesRegistry).getExtensionFeature(this.extensionViewState.filters.featureId);
            if (feature?.icon && accessData) {
                const featureAccessTimeElement = append(this.container, $('span.activationTime'));
                featureAccessTimeElement.textContent = localize('feature access label', "{0} reqs", accessData.accessTimes.length);
                const iconElement = append(this.container, $('span' + ThemeIcon.asCSSSelector(feature.icon)));
                iconElement.style.paddingLeft = '4px';
                return;
            }
        }
        const extensionStatus = this.extensionsWorkbenchService.getExtensionRuntimeStatus(this.extension);
        if (extensionStatus?.activationTimes) {
            const activationTime = extensionStatus.activationTimes.codeLoadingTime + extensionStatus.activationTimes.activateCallTime;
            append(this.container, $('span' + ThemeIcon.asCSSSelector(activationTimeIcon)));
            const activationTimeElement = append(this.container, $('span.activationTime'));
            activationTimeElement.textContent = `${activationTime}ms`;
        }
    }
};
ExtensionRuntimeStatusWidget = __decorate([
    __param(2, IExtensionService),
    __param(3, IExtensionFeaturesManagementService),
    __param(4, IExtensionsWorkbenchService)
], ExtensionRuntimeStatusWidget);
export { ExtensionRuntimeStatusWidget };
let ExtensionHoverWidget = ExtensionHoverWidget_1 = class ExtensionHoverWidget extends ExtensionWidget {
    constructor(options, extensionStatusAction, extensionsWorkbenchService, extensionFeaturesManagementService, hoverService, configurationService, extensionRecommendationsService, themeService, contextService) {
        super();
        this.options = options;
        this.extensionStatusAction = extensionStatusAction;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionFeaturesManagementService = extensionFeaturesManagementService;
        this.hoverService = hoverService;
        this.configurationService = configurationService;
        this.extensionRecommendationsService = extensionRecommendationsService;
        this.themeService = themeService;
        this.contextService = contextService;
        this.hover = this._register(new MutableDisposable());
    }
    render() {
        this.hover.value = undefined;
        if (this.extension) {
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
        if (!this.extension) {
            return undefined;
        }
        const markdown = new MarkdownString('', { isTrusted: true, supportThemeIcons: true });
        markdown.appendMarkdown(`**${this.extension.displayName}**`);
        if (semver.valid(this.extension.version)) {
            markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">**&nbsp;_v${this.extension.version}${(this.extension.isPreReleaseVersion ? ' (pre-release)' : '')}_**&nbsp;</span>`);
        }
        markdown.appendText(`\n`);
        let addSeparator = false;
        if (this.extension.private) {
            markdown.appendMarkdown(`$(${privateExtensionIcon.id}) ${localize('privateExtension', "Private Extension")}`);
            addSeparator = true;
        }
        if (this.extension.state === 1 /* ExtensionState.Installed */) {
            const installLabel = InstallCountWidget.getInstallLabel(this.extension, true);
            if (installLabel) {
                if (addSeparator) {
                    markdown.appendText(`  |  `);
                }
                markdown.appendMarkdown(`$(${installCountIcon.id}) ${installLabel}`);
                addSeparator = true;
            }
            if (this.extension.rating) {
                if (addSeparator) {
                    markdown.appendText(`  |  `);
                }
                const rating = Math.round(this.extension.rating * 2) / 2;
                markdown.appendMarkdown(`$(${starFullIcon.id}) [${rating}](${this.extension.url}&ssr=false#review-details)`);
                addSeparator = true;
            }
            if (this.extension.publisherSponsorLink) {
                if (addSeparator) {
                    markdown.appendText(`  |  `);
                }
                markdown.appendMarkdown(`$(${sponsorIcon.id}) [${localize('sponsor', "Sponsor")}](${this.extension.publisherSponsorLink})`);
                addSeparator = true;
            }
        }
        if (addSeparator) {
            markdown.appendText(`\n`);
        }
        const location = this.extension.resourceExtension?.location ?? (this.extension.local?.source === 'resource' ? this.extension.local?.location : undefined);
        if (location) {
            if (this.extension.isWorkspaceScoped && this.contextService.isInsideWorkspace(location)) {
                markdown.appendMarkdown(localize('workspace extension', "Workspace Extension"));
            }
            else {
                markdown.appendMarkdown(localize('local extension', "Local Extension"));
            }
            markdown.appendText(`\n`);
        }
        if (this.extension.description) {
            markdown.appendMarkdown(`${this.extension.description}`);
            markdown.appendText(`\n`);
        }
        if (this.extension.publisherDomain?.verified) {
            const bgColor = this.themeService.getColorTheme().getColor(extensionVerifiedPublisherIconColor);
            const publisherVerifiedTooltip = localize('publisher verified tooltip', "This publisher has verified ownership of {0}", `[${URI.parse(this.extension.publisherDomain.link).authority}](${this.extension.publisherDomain.link})`);
            markdown.appendMarkdown(`<span style="color:${bgColor ? Color.Format.CSS.formatHex(bgColor) : '#ffffff'};">$(${verifiedPublisherIcon.id})</span>&nbsp;${publisherVerifiedTooltip}`);
            markdown.appendText(`\n`);
        }
        if (this.extension.outdated) {
            markdown.appendMarkdown(localize('updateRequired', "Latest version:"));
            markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">**&nbsp;_v${this.extension.latestVersion}_**&nbsp;</span>`);
            markdown.appendText(`\n`);
        }
        const preReleaseMessage = ExtensionHoverWidget_1.getPreReleaseMessage(this.extension);
        const extensionRuntimeStatus = this.extensionsWorkbenchService.getExtensionRuntimeStatus(this.extension);
        const extensionFeaturesAccessData = this.extensionFeaturesManagementService.getAllAccessDataForExtension(new ExtensionIdentifier(this.extension.identifier.id));
        const extensionStatus = this.extensionStatusAction.status;
        const runtimeState = this.extension.runtimeState;
        const recommendationMessage = this.getRecommendationMessage(this.extension);
        if (extensionRuntimeStatus || extensionFeaturesAccessData.size || extensionStatus.length || runtimeState || recommendationMessage || preReleaseMessage) {
            markdown.appendMarkdown(`---`);
            markdown.appendText(`\n`);
            if (extensionRuntimeStatus) {
                if (extensionRuntimeStatus.activationTimes) {
                    const activationTime = extensionRuntimeStatus.activationTimes.codeLoadingTime + extensionRuntimeStatus.activationTimes.activateCallTime;
                    markdown.appendMarkdown(`${localize('activation', "Activation time")}${extensionRuntimeStatus.activationTimes.activationReason.startup ? ` (${localize('startup', "Startup")})` : ''}: \`${activationTime}ms\``);
                    markdown.appendText(`\n`);
                }
                if (extensionRuntimeStatus.runtimeErrors.length || extensionRuntimeStatus.messages.length) {
                    const hasErrors = extensionRuntimeStatus.runtimeErrors.length || extensionRuntimeStatus.messages.some(message => message.type === Severity.Error);
                    const hasWarnings = extensionRuntimeStatus.messages.some(message => message.type === Severity.Warning);
                    const errorsLink = extensionRuntimeStatus.runtimeErrors.length ? `[${extensionRuntimeStatus.runtimeErrors.length === 1 ? localize('uncaught error', '1 uncaught error') : localize('uncaught errors', '{0} uncaught errors', extensionRuntimeStatus.runtimeErrors.length)}](${createCommandUri('extension.open', this.extension.identifier.id, "features" /* ExtensionEditorTab.Features */)})` : undefined;
                    const messageLink = extensionRuntimeStatus.messages.length ? `[${extensionRuntimeStatus.messages.length === 1 ? localize('message', '1 message') : localize('messages', '{0} messages', extensionRuntimeStatus.messages.length)}](${createCommandUri('extension.open', this.extension.identifier.id, "features" /* ExtensionEditorTab.Features */)})` : undefined;
                    markdown.appendMarkdown(`$(${hasErrors ? errorIcon.id : hasWarnings ? warningIcon.id : infoIcon.id}) This extension has reported `);
                    if (errorsLink && messageLink) {
                        markdown.appendMarkdown(`${errorsLink} and ${messageLink}`);
                    }
                    else {
                        markdown.appendMarkdown(`${errorsLink || messageLink}`);
                    }
                    markdown.appendText(`\n`);
                }
            }
            if (extensionFeaturesAccessData.size) {
                const registry = Registry.as(Extensions.ExtensionFeaturesRegistry);
                for (const [featureId, accessData] of extensionFeaturesAccessData) {
                    if (accessData?.accessTimes.length) {
                        const feature = registry.getExtensionFeature(featureId);
                        if (feature) {
                            markdown.appendMarkdown(localize('feature usage label', "{0} usage", feature.label));
                            markdown.appendMarkdown(`: [${localize('total', "{0} {1} requests in last 30 days", accessData.accessTimes.length, feature.accessDataLabel ?? feature.label)}](${createCommandUri('extension.open', this.extension.identifier.id, "features" /* ExtensionEditorTab.Features */)})`);
                            markdown.appendText(`\n`);
                        }
                    }
                }
            }
            for (const status of extensionStatus) {
                if (status.icon) {
                    markdown.appendMarkdown(`$(${status.icon.id})&nbsp;`);
                }
                markdown.appendMarkdown(status.message.value);
                markdown.appendText(`\n`);
            }
            if (runtimeState) {
                markdown.appendMarkdown(`$(${infoIcon.id})&nbsp;`);
                markdown.appendMarkdown(`${runtimeState.reason}`);
                markdown.appendText(`\n`);
            }
            if (preReleaseMessage) {
                const extensionPreReleaseIcon = this.themeService.getColorTheme().getColor(extensionPreReleaseIconColor);
                markdown.appendMarkdown(`<span style="color:${extensionPreReleaseIcon ? Color.Format.CSS.formatHex(extensionPreReleaseIcon) : '#ffffff'};">$(${preReleaseIcon.id})</span>&nbsp;${preReleaseMessage}`);
                markdown.appendText(`\n`);
            }
            if (recommendationMessage) {
                markdown.appendMarkdown(recommendationMessage);
                markdown.appendText(`\n`);
            }
        }
        return markdown;
    }
    getRecommendationMessage(extension) {
        if (extension.state === 1 /* ExtensionState.Installed */) {
            return undefined;
        }
        if (extension.deprecationInfo) {
            return undefined;
        }
        const recommendation = this.extensionRecommendationsService.getAllRecommendationsWithReason()[extension.identifier.id.toLowerCase()];
        if (!recommendation?.reasonText) {
            return undefined;
        }
        const bgColor = this.themeService.getColorTheme().getColor(extensionButtonProminentBackground);
        return `<span style="color:${bgColor ? Color.Format.CSS.formatHex(bgColor) : '#ffffff'};">$(${starEmptyIcon.id})</span>&nbsp;${recommendation.reasonText}`;
    }
    static getPreReleaseMessage(extension) {
        if (!extension.hasPreReleaseVersion) {
            return undefined;
        }
        if (extension.isBuiltin) {
            return undefined;
        }
        if (extension.isPreReleaseVersion) {
            return undefined;
        }
        if (extension.preRelease) {
            return undefined;
        }
        const preReleaseVersionLink = `[${localize('Show prerelease version', "Pre-Release version")}](${createCommandUri('workbench.extensions.action.showPreReleaseVersion', extension.identifier.id)})`;
        return localize('has prerelease', "This extension has a {0} available", preReleaseVersionLink);
    }
};
ExtensionHoverWidget = ExtensionHoverWidget_1 = __decorate([
    __param(2, IExtensionsWorkbenchService),
    __param(3, IExtensionFeaturesManagementService),
    __param(4, IHoverService),
    __param(5, IConfigurationService),
    __param(6, IExtensionRecommendationsService),
    __param(7, IThemeService),
    __param(8, IWorkspaceContextService)
], ExtensionHoverWidget);
export { ExtensionHoverWidget };
let ExtensionStatusWidget = class ExtensionStatusWidget extends ExtensionWidget {
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
            append(this.container, rendered.element);
        }
        this._onDidRender.fire();
    }
};
ExtensionStatusWidget = __decorate([
    __param(2, IMarkdownRendererService)
], ExtensionStatusWidget);
export { ExtensionStatusWidget };
let ExtensionRecommendationWidget = class ExtensionRecommendationWidget extends ExtensionWidget {
    constructor(container, extensionRecommendationsService, extensionIgnoredRecommendationsService) {
        super();
        this.container = container;
        this.extensionRecommendationsService = extensionRecommendationsService;
        this.extensionIgnoredRecommendationsService = extensionIgnoredRecommendationsService;
        this._onDidRender = this._register(new Emitter());
        this.onDidRender = this._onDidRender.event;
        this.render();
        this._register(this.extensionRecommendationsService.onDidChangeRecommendations(() => this.render()));
    }
    render() {
        reset(this.container);
        const recommendationStatus = this.getRecommendationStatus();
        if (recommendationStatus) {
            if (recommendationStatus.icon) {
                append(this.container, $(`div${ThemeIcon.asCSSSelector(recommendationStatus.icon)}`));
            }
            append(this.container, $(`div.recommendation-text`, undefined, recommendationStatus.message));
        }
        this._onDidRender.fire();
    }
    getRecommendationStatus() {
        if (!this.extension
            || this.extension.deprecationInfo
            || this.extension.state === 1 /* ExtensionState.Installed */) {
            return undefined;
        }
        const extRecommendations = this.extensionRecommendationsService.getAllRecommendationsWithReason();
        if (extRecommendations[this.extension.identifier.id.toLowerCase()]) {
            const reasonText = extRecommendations[this.extension.identifier.id.toLowerCase()].reasonText;
            if (reasonText) {
                return { icon: starEmptyIcon, message: reasonText };
            }
        }
        else if (this.extensionIgnoredRecommendationsService.globalIgnoredRecommendations.indexOf(this.extension.identifier.id.toLowerCase()) !== -1) {
            return { icon: undefined, message: localize('recommendationHasBeenIgnored', "You have chosen not to receive recommendations for this extension.") };
        }
        return undefined;
    }
};
ExtensionRecommendationWidget = __decorate([
    __param(1, IExtensionRecommendationsService),
    __param(2, IExtensionIgnoredRecommendationsService)
], ExtensionRecommendationWidget);
export { ExtensionRecommendationWidget };
export const extensionRatingIconColor = registerColor('extensionIcon.starForeground', { light: '#DF6100', dark: '#FF8E00', hcDark: '#FF8E00', hcLight: textLinkForeground }, localize('extensionIconStarForeground', "The icon color for extension ratings."), false);
export const extensionPreReleaseIconColor = registerColor('extensionIcon.preReleaseForeground', { dark: '#1d9271', light: '#1d9271', hcDark: '#1d9271', hcLight: textLinkForeground }, localize('extensionPreReleaseForeground', "The icon color for pre-release extension."), false);
export const extensionSponsorIconColor = registerColor('extensionIcon.sponsorForeground', { light: '#B51E78', dark: '#D758B3', hcDark: null, hcLight: '#B51E78' }, localize('extensionIcon.sponsorForeground', "The icon color for extension sponsor."), false);
export const extensionPrivateBadgeBackground = registerColor('extensionIcon.privateForeground', { dark: '#ffffff60', light: '#00000060', hcDark: '#ffffff60', hcLight: '#00000060' }, localize('extensionIcon.private', "The icon color for private extensions."));
registerThemingParticipant((theme, collector) => {
    const extensionRatingIcon = theme.getColor(extensionRatingIconColor);
    if (extensionRatingIcon) {
        collector.addRule(`.extension-ratings .codicon-extensions-star-full, .extension-ratings .codicon-extensions-star-half { color: ${extensionRatingIcon}; }`);
        collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(starFullIcon)} { color: ${extensionRatingIcon}; }`);
    }
    const extensionVerifiedPublisherIcon = theme.getColor(extensionVerifiedPublisherIconColor);
    if (extensionVerifiedPublisherIcon) {
        collector.addRule(`${ThemeIcon.asCSSSelector(verifiedPublisherIcon)} { color: ${extensionVerifiedPublisherIcon}; }`);
    }
    collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(sponsorIcon)} { color: var(--vscode-extensionIcon-sponsorForeground); }`);
    collector.addRule(`.extension-editor > .header > .details > .subtitle .sponsor ${ThemeIcon.asCSSSelector(sponsorIcon)} { color: var(--vscode-extensionIcon-sponsorForeground); }`);
    const privateBadgeBackground = theme.getColor(extensionPrivateBadgeBackground);
    if (privateBadgeBackground) {
        collector.addRule(`.extension-private-badge { color: ${privateBadgeBackground}; }`);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uc1dpZGdldHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZXh0ZW5zaW9ucy9icm93c2VyL2V4dGVuc2lvbnNXaWRnZXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLCtCQUErQixDQUFDO0FBQ3ZDLE9BQU8sS0FBSyxNQUFNLE1BQU0sMENBQTBDLENBQUM7QUFDbkUsT0FBTyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLGlCQUFpQixFQUFlLE1BQU0sc0NBQXNDLENBQUM7QUFDakksT0FBTyxFQUFjLDJCQUEyQixFQUFpRixNQUFNLHlCQUF5QixDQUFDO0FBQ2pLLE9BQU8sRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxxQkFBcUIsRUFBRSxTQUFTLEVBQUUsWUFBWSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDbkgsT0FBTyxLQUFLLFFBQVEsTUFBTSxxQ0FBcUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLGlDQUFpQyxFQUFFLE1BQU0scUVBQXFFLENBQUM7QUFDeEgsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLGdDQUFnQyxFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFDMUssT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxrQ0FBa0MsRUFBeUIsTUFBTSx3QkFBd0IsQ0FBQztBQUNuRyxPQUFPLEVBQUUsYUFBYSxFQUFFLDBCQUEwQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDOUcsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSwwQkFBMEIsRUFBRSxN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