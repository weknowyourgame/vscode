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
import { EventType } from '../../../../../base/browser/dom.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { DisposableStore, dispose, toDisposable } from '../../../../../base/common/lifecycle.js';
import { isMacintosh, OS } from '../../../../../base/common/platform.js';
import { URI } from '../../../../../base/common/uri.js';
import * as nls from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ITunnelService } from '../../../../../platform/tunnel/common/tunnel.js';
import { TerminalExternalLinkDetector } from './terminalExternalLinkDetector.js';
import { TerminalLinkDetectorAdapter } from './terminalLinkDetectorAdapter.js';
import { TerminalLocalFileLinkOpener, TerminalLocalFolderInWorkspaceLinkOpener, TerminalLocalFolderOutsideWorkspaceLinkOpener, TerminalSearchLinkOpener, TerminalUrlLinkOpener } from './terminalLinkOpeners.js';
import { TerminalLocalLinkDetector } from './terminalLocalLinkDetector.js';
import { TerminalUriLinkDetector } from './terminalUriLinkDetector.js';
import { TerminalWordLinkDetector } from './terminalWordLinkDetector.js';
import { ITerminalConfigurationService, TerminalLinkQuickPickEvent } from '../../../terminal/browser/terminal.js';
import { TerminalHover } from '../../../terminal/browser/widgets/terminalHoverWidget.js';
import { TERMINAL_CONFIG_SECTION } from '../../../terminal/common/terminal.js';
import { convertBufferRangeToViewport } from './terminalLinkHelpers.js';
import { RunOnceScheduler } from '../../../../../base/common/async.js';
import { ITerminalLogService } from '../../../../../platform/terminal/common/terminal.js';
import { TerminalMultiLineLinkDetector } from './terminalMultiLineLinkDetector.js';
import { INotificationService, Severity } from '../../../../../platform/notification/common/notification.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { isString } from '../../../../../base/common/types.js';
/**
 * An object responsible for managing registration of link matchers and link providers.
 */
let TerminalLinkManager = class TerminalLinkManager extends DisposableStore {
    constructor(_xterm, _processInfo, capabilities, _linkResolver, _configurationService, _instantiationService, notificationService, _telemetryService, terminalConfigurationService, _logService, _tunnelService) {
        super();
        this._xterm = _xterm;
        this._processInfo = _processInfo;
        this._linkResolver = _linkResolver;
        this._configurationService = _configurationService;
        this._instantiationService = _instantiationService;
        this._telemetryService = _telemetryService;
        this._logService = _logService;
        this._tunnelService = _tunnelService;
        this._standardLinkProviders = new Map();
        this._linkProvidersDisposables = [];
        this._externalLinkProviders = [];
        this._openers = new Map();
        let enableFileLinks = true;
        const enableFileLinksConfig = this._configurationService.getValue(TERMINAL_CONFIG_SECTION).enableFileLinks;
        switch (enableFileLinksConfig) {
            case 'off':
            case false: // legacy from v1.75
                enableFileLinks = false;
                break;
            case 'notRemote':
                enableFileLinks = !this._processInfo.remoteAuthority;
                break;
        }
        // Setup link detectors in their order of priority
        if (enableFileLinks) {
            this._setupLinkDetector(TerminalMultiLineLinkDetector.id, this._instantiationService.createInstance(TerminalMultiLineLinkDetector, this._xterm, this._processInfo, this._linkResolver));
            this._setupLinkDetector(TerminalLocalLinkDetector.id, this._instantiationService.createInstance(TerminalLocalLinkDetector, this._xterm, capabilities, this._processInfo, this._linkResolver));
        }
        this._setupLinkDetector(TerminalUriLinkDetector.id, this._instantiationService.createInstance(TerminalUriLinkDetector, this._xterm, this._processInfo, this._linkResolver));
        this._setupLinkDetector(TerminalWordLinkDetector.id, this.add(this._instantiationService.createInstance(TerminalWordLinkDetector, this._xterm)));
        // Setup link openers
        const localFileOpener = this._instantiationService.createInstance(TerminalLocalFileLinkOpener);
        const localFolderInWorkspaceOpener = this._instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
        const localFolderOutsideWorkspaceOpener = this._instantiationService.createInstance(TerminalLocalFolderOutsideWorkspaceLinkOpener);
        this._openers.set("LocalFile" /* TerminalBuiltinLinkType.LocalFile */, localFileOpener);
        this._openers.set("LocalFolderInWorkspace" /* TerminalBuiltinLinkType.LocalFolderInWorkspace */, localFolderInWorkspaceOpener);
        this._openers.set("LocalFolderOutsideWorkspace" /* TerminalBuiltinLinkType.LocalFolderOutsideWorkspace */, localFolderOutsideWorkspaceOpener);
        this._openers.set("Search" /* TerminalBuiltinLinkType.Search */, this._instantiationService.createInstance(TerminalSearchLinkOpener, capabilities, this._processInfo.initialCwd, localFileOpener, localFolderInWorkspaceOpener, () => this._processInfo.os || OS));
        this._openers.set("Url" /* TerminalBuiltinLinkType.Url */, this._instantiationService.createInstance(TerminalUrlLinkOpener, !!this._processInfo.remoteAuthority, localFileOpener, localFolderInWorkspaceOpener, localFolderOutsideWorkspaceOpener));
        this._registerStandardLinkProviders();
        let activeHoverDisposable;
        let activeTooltipScheduler;
        this.add(toDisposable(() => {
            this._clearLinkProviders();
            dispose(this._externalLinkProviders);
            activeHoverDisposable?.dispose();
            activeTooltipScheduler?.dispose();
        }));
        this._xterm.options.linkHandler = {
            allowNonHttpProtocols: true,
            activate: async (event, text) => {
                if (!this._isLinkActivationModifierDown(event)) {
                    return;
                }
                const colonIndex = text.indexOf(':');
                if (colonIndex === -1) {
                    throw new Error(`Could not find scheme in link "${text}"`);
                }
                const scheme = text.substring(0, colonIndex);
                if (terminalConfigurationService.config.allowedLinkSchemes.indexOf(scheme) === -1) {
                    const userAllowed = await new Promise((resolve) => {
                        notificationService.prompt(Severity.Warning, nls.localize('scheme', 'Opening URIs can be insecure, do you want to allow opening links with the scheme {0}?', scheme), [
                            {
                                label: nls.localize('allow', 'Allow {0}', scheme),
                                run: () => {
                                    const allowedLinkSchemes = [
                                        ...terminalConfigurationService.config.allowedLinkSchemes,
                                        scheme
                                    ];
                                    this._configurationService.updateValue(`terminal.integrated.allowedLinkSchemes`, allowedLinkSchemes);
                                    resolve(true);
                                }
                            }
                        ], {
                            onCancel: () => resolve(false)
                        });
                    });
                    if (!userAllowed) {
                        return;
                    }
                }
                this._openers.get("Url" /* TerminalBuiltinLinkType.Url */)?.open({
                    type: "Url" /* TerminalBuiltinLinkType.Url */,
                    text,
                    bufferRange: null,
                    uri: URI.parse(text)
                });
            },
            hover: (e, text, range) => {
                activeHoverDisposable?.dispose();
                activeHoverDisposable = undefined;
                activeTooltipScheduler?.dispose();
                activeTooltipScheduler = new RunOnceScheduler(() => {
                    const core = this._xterm._core;
                    const cellDimensions = {
                        width: core._renderService.dimensions.css.cell.width,
                        height: core._renderService.dimensions.css.cell.height
                    };
                    const terminalDimensions = {
                        width: this._xterm.cols,
                        height: this._xterm.rows
                    };
                    activeHoverDisposable = this._showHover({
                        viewportRange: convertBufferRangeToViewport(range, this._xterm.buffer.active.viewportY),
                        cellDimensions,
                        terminalDimensions
                    }, this._getLinkHoverString(text, text), undefined, (text) => this._xterm.options.linkHandler?.activate(e, text, range));
                    // Clear out scheduler until next hover event
                    activeTooltipScheduler?.dispose();
                    activeTooltipScheduler = undefined;
                }, this._configurationService.getValue('workbench.hover.delay'));
                activeTooltipScheduler.schedule();
            }
        };
    }
    _setupLinkDetector(id, detector, isExternal = false) {
        const detectorAdapter = this.add(this._instantiationService.createInstance(TerminalLinkDetectorAdapter, detector));
        this.add(detectorAdapter.onDidActivateLink(e => {
            // Prevent default electron link handling so Alt+Click mode works normally
            e.event?.preventDefault();
            // Require correct modifier on click unless event is coming from linkQuickPick selection
            if (e.event && !(e.event instanceof TerminalLinkQuickPickEvent) && !this._isLinkActivationModifierDown(e.event)) {
                return;
            }
            // Just call the handler if there is no before listener
            if (e.link.activate) {
                // Custom activate call (external links only)
                e.link.activate(e.link.text);
            }
            else {
                this._openLink(e.link);
            }
        }));
        this.add(detectorAdapter.onDidShowHover(e => this._tooltipCallback(e.link, e.viewportRange, e.modifierDownCallback, e.modifierUpCallback)));
        if (!isExternal) {
            this._standardLinkProviders.set(id, detectorAdapter);
        }
        return detectorAdapter;
    }
    async _openLink(link) {
        this._logService.debug('Opening link', link);
        const opener = this._openers.get(link.type);
        if (!opener) {
            throw new Error(`No matching opener for link type "${link.type}"`);
        }
        this._telemetryService.publicLog2('terminal/openLink', { linkType: isString(link.type) ? link.type : `extension:${link.type.id}` });
        await opener.open(link);
    }
    async openRecentLink(type) {
        let links;
        let i = this._xterm.buffer.active.length;
        while ((!links || links.length === 0) && i >= this._xterm.buffer.active.viewportY) {
            links = await this._getLinksForType(i, type);
            i--;
        }
        if (!links || links.length < 1) {
            return undefined;
        }
        const event = new TerminalLinkQuickPickEvent(EventType.CLICK);
        links[0].activate(event, links[0].text);
        return links[0];
    }
    async getLinks() {
        // Fetch and await the viewport results
        const viewportLinksByLinePromises = [];
        for (let i = this._xterm.buffer.active.viewportY + this._xterm.rows - 1; i >= this._xterm.buffer.active.viewportY; i--) {
            viewportLinksByLinePromises.push(this._getLinksForLine(i));
        }
        const viewportLinksByLine = await Promise.all(viewportLinksByLinePromises);
        // Assemble viewport links
        const viewportLinks = {
            wordLinks: [],
            webLinks: [],
            fileLinks: [],
            folderLinks: [],
        };
        for (const links of viewportLinksByLine) {
            if (links) {
                const { wordLinks, webLinks, fileLinks, folderLinks } = links;
                if (wordLinks?.length) {
                    viewportLinks.wordLinks.push(...wordLinks.reverse());
                }
                if (webLinks?.length) {
                    viewportLinks.webLinks.push(...webLinks.reverse());
                }
                if (fileLinks?.length) {
                    viewportLinks.fileLinks.push(...fileLinks.reverse());
                }
                if (folderLinks?.length) {
                    viewportLinks.folderLinks.push(...folderLinks.reverse());
                }
            }
        }
        // Fetch the remaining results async
        const aboveViewportLinksPromises = [];
        for (let i = this._xterm.buffer.active.viewportY - 1; i >= 0; i--) {
            aboveViewportLinksPromises.push(this._getLinksForLine(i));
        }
        const belowViewportLinksPromises = [];
        for (let i = this._xterm.buffer.active.length - 1; i >= this._xterm.buffer.active.viewportY + this._xterm.rows; i--) {
            belowViewportLinksPromises.push(this._getLinksForLine(i));
        }
        // Assemble all links in results
        const allLinks = Promise.all(aboveViewportLinksPromises).then(async (aboveViewportLinks) => {
            const belowViewportLinks = await Promise.all(belowViewportLinksPromises);
            const allResults = {
                wordLinks: [...viewportLinks.wordLinks],
                webLinks: [...viewportLinks.webLinks],
                fileLinks: [...viewportLinks.fileLinks],
                folderLinks: [...viewportLinks.folderLinks]
            };
            for (const links of [...belowViewportLinks, ...aboveViewportLinks]) {
                if (links) {
                    const { wordLinks, webLinks, fileLinks, folderLinks } = links;
                    if (wordLinks?.length) {
                        allResults.wordLinks.push(...wordLinks.reverse());
                    }
                    if (webLinks?.length) {
                        allResults.webLinks.push(...webLinks.reverse());
                    }
                    if (fileLinks?.length) {
                        allResults.fileLinks.push(...fileLinks.reverse());
                    }
                    if (folderLinks?.length) {
                        allResults.folderLinks.push(...folderLinks.reverse());
                    }
                }
            }
            return allResults;
        });
        return {
            viewport: viewportLinks,
            all: allLinks
        };
    }
    async _getLinksForLine(y) {
        const unfilteredWordLinks = await this._getLinksForType(y, 'word');
        const webLinks = await this._getLinksForType(y, 'url');
        const fileLinks = await this._getLinksForType(y, 'localFile');
        const folderLinks = await this._getLinksForType(y, 'localFolder');
        const words = new Set();
        let wordLinks;
        if (unfilteredWordLinks) {
            wordLinks = [];
            for (const link of unfilteredWordLinks) {
                if (!words.has(link.text) && link.text.length > 1) {
                    wordLinks.push(link);
                    words.add(link.text);
                }
            }
        }
        return { wordLinks, webLinks, fileLinks, folderLinks };
    }
    async _getLinksForType(y, type) {
        switch (type) {
            case 'word':
                return (await new Promise(r => this._standardLinkProviders.get(TerminalWordLinkDetector.id)?.provideLinks(y, r)));
            case 'url':
                return (await new Promise(r => this._standardLinkProviders.get(TerminalUriLinkDetector.id)?.provideLinks(y, r)));
            case 'localFile': {
                const links = (await new Promise(r => this._standardLinkProviders.get(TerminalLocalLinkDetector.id)?.provideLinks(y, r)));
                return links?.filter(link => link.type === "LocalFile" /* TerminalBuiltinLinkType.LocalFile */);
            }
            case 'localFolder': {
                const links = (await new Promise(r => this._standardLinkProviders.get(TerminalLocalLinkDetector.id)?.provideLinks(y, r)));
                return links?.filter(link => link.type === "LocalFolderInWorkspace" /* TerminalBuiltinLinkType.LocalFolderInWorkspace */);
            }
        }
    }
    _tooltipCallback(link, viewportRange, modifierDownCallback, modifierUpCallback) {
        if (!this._widgetManager) {
            return;
        }
        const core = this._xterm._core;
        const cellDimensions = {
            width: core._renderService.dimensions.css.cell.width,
            height: core._renderService.dimensions.css.cell.height
        };
        const terminalDimensions = {
            width: this._xterm.cols,
            height: this._xterm.rows
        };
        // Don't pass the mouse event as this avoids the modifier check
        this._showHover({
            viewportRange,
            cellDimensions,
            terminalDimensions,
            modifierDownCallback,
            modifierUpCallback
        }, this._getLinkHoverString(link.text, link.label), link.actions, (text) => link.activate(undefined, text), link);
    }
    _showHover(targetOptions, text, actions, linkHandler, link) {
        if (this._widgetManager) {
            const widget = this._instantiationService.createInstance(TerminalHover, targetOptions, text, actions, linkHandler);
            const attached = this._widgetManager.attachWidget(widget);
            if (attached) {
                link?.onInvalidated(() => attached.dispose());
            }
            return attached;
        }
        return undefined;
    }
    setWidgetManager(widgetManager) {
        this._widgetManager = widgetManager;
    }
    _clearLinkProviders() {
        dispose(this._linkProvidersDisposables);
        this._linkProvidersDisposables.length = 0;
    }
    _registerStandardLinkProviders() {
        // Forward any external link provider requests to the registered provider if it exists. This
        // helps maintain the relative priority of the link providers as it's defined by the order
        // in which they're registered in xterm.js.
        //
        /**
         * There's a bit going on here but here's another view:
         * - {@link externalProvideLinksCb} The external callback that gives the links (eg. from
         *   exthost)
         * - {@link proxyLinkProvider} A proxy that forwards the call over to
         *   {@link externalProvideLinksCb}
         * - {@link wrappedLinkProvider} Wraps the above in an `TerminalLinkDetectorAdapter`
         */
        const proxyLinkProvider = async (bufferLineNumber) => {
            return this.externalProvideLinksCb?.(bufferLineNumber);
        };
        const detectorId = `extension-${this._externalLinkProviders.length}`;
        const wrappedLinkProvider = this._setupLinkDetector(detectorId, new TerminalExternalLinkDetector(detectorId, this._xterm, proxyLinkProvider), true);
        this._linkProvidersDisposables.push(this._xterm.registerLinkProvider(wrappedLinkProvider));
        for (const p of this._standardLinkProviders.values()) {
            this._linkProvidersDisposables.push(this._xterm.registerLinkProvider(p));
        }
    }
    _isLinkActivationModifierDown(event) {
        const editorConf = this._configurationService.getValue('editor');
        if (editorConf.multiCursorModifier === 'ctrlCmd') {
            return !!event.altKey;
        }
        return isMacintosh ? event.metaKey : event.ctrlKey;
    }
    _getLinkHoverString(uri, label) {
        const editorConf = this._configurationService.getValue('editor');
        let clickLabel = '';
        if (editorConf.multiCursorModifier === 'ctrlCmd') {
            if (isMacintosh) {
                clickLabel = nls.localize('terminalLinkHandler.followLinkAlt.mac', "option + click");
            }
            else {
                clickLabel = nls.localize('terminalLinkHandler.followLinkAlt', "alt + click");
            }
        }
        else {
            if (isMacintosh) {
                clickLabel = nls.localize('terminalLinkHandler.followLinkCmd', "cmd + click");
            }
            else {
                clickLabel = nls.localize('terminalLinkHandler.followLinkCtrl', "ctrl + click");
            }
        }
        let fallbackLabel = nls.localize('followLink', "Follow link");
        try {
            if (this._tunnelService.canTunnel(URI.parse(uri))) {
                fallbackLabel = nls.localize('followForwardedLink', "Follow link using forwarded port");
            }
        }
        catch {
            // No-op, already set to fallback
        }
        const markdown = new MarkdownString('', true);
        // Escapes markdown in label & uri
        if (label) {
            label = markdown.appendText(label).value;
            markdown.value = '';
        }
        if (uri) {
            uri = markdown.appendText(uri).value;
            markdown.value = '';
        }
        label = label || fallbackLabel;
        // Use the label when uri is '' so the link displays correctly
        uri = uri || label;
        // Although if there is a space in the uri, just replace it completely
        if (/(\s|&nbsp;)/.test(uri)) {
            uri = nls.localize('followLinkUrl', 'Link');
        }
        return markdown.appendLink(uri, label).appendMarkdown(` (${clickLabel})`);
    }
};
TerminalLinkManager = __decorate([
    __param(4, IConfigurationService),
    __param(5, IInstantiationService),
    __param(6, INotificationService),
    __param(7, ITelemetryService),
    __param(8, ITerminalConfigurationService),
    __param(9, ITerminalLogService),
    __param(10, ITunnelService)
], TerminalLinkManager);
export { TerminalLinkManager };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxMaW5rTWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvbGlua3MvYnJvd3Nlci90ZXJtaW5hbExpbmtNYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRCxPQUFPLEVBQW1CLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQzVGLE9BQU8sRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFlLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzlHLE9BQU8sRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDekUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sS0FBSyxHQUFHLE1BQU0sdUJBQXVCLENBQUM7QUFDN0MsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBRWpGLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRWpGLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSx3Q0FBd0MsRUFBRSw2Q0FBNkMsRUFBRSx3QkFBd0IsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ2pOLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxN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