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
import * as dom from '../../../../../base/browser/dom.js';
import { RunOnceScheduler } from '../../../../../base/common/async.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter } from '../../../../../base/common/event.js';
import { escapeMarkdownSyntaxTokens, createMarkdownCommandLink, MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Lazy } from '../../../../../base/common/lazy.js';
import { Disposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun } from '../../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { IMarkdownRendererService, openLinkFromMarkdown } from '../../../../../platform/markdown/browser/markdownRenderer.js';
import { localize } from '../../../../../nls.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IMcpService } from '../../../mcp/common/mcpTypes.js';
import { startServerAndWaitForLiveTools } from '../../../mcp/common/mcpTypesUtils.js';
import { isResponseVM } from '../../common/chatViewModel.js';
import { ChatProgressContentPart } from './chatProgressContentPart.js';
import './media/chatMcpServersInteractionContent.css';
let ChatMcpServersInteractionContentPart = class ChatMcpServersInteractionContentPart extends Disposable {
    constructor(data, context, mcpService, instantiationService, _openerService, _markdownRendererService) {
        super();
        this.data = data;
        this.context = context;
        this.mcpService = mcpService;
        this.instantiationService = instantiationService;
        this._openerService = _openerService;
        this._markdownRendererService = _markdownRendererService;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this.interactionMd = this._register(new MutableDisposable());
        this.showSpecificServersScheduler = this._register(new RunOnceScheduler(() => this.updateDetailedProgress(this.data.state.get()), 2500));
        this.previousParts = new Lazy(() => {
            if (!isResponseVM(this.context.element)) {
                return [];
            }
            return this.context.element.session.getItems()
                .filter((r, i) => isResponseVM(r) && i < this.context.elementIndex)
                .flatMap(i => i.response.value.filter(c => c.kind === 'mcpServersStarting'))
                .map(p => p.state?.get());
        });
        this.domNode = dom.$('.chat-mcp-servers-interaction');
        // Listen to autostart state changes if available
        if (data.state) {
            this._register(autorun(reader => {
                const state = data.state.read(reader);
                this.updateForState(state);
            }));
        }
    }
    updateForState(state) {
        if (!state.working) {
            this.workingProgressPart?.domNode.remove();
            this.workingProgressPart = undefined;
            this.showSpecificServersScheduler.cancel();
        }
        else if (!this.workingProgressPart) {
            if (!this.showSpecificServersScheduler.isScheduled()) {
                this.showSpecificServersScheduler.schedule();
            }
        }
        else if (this.workingProgressPart) {
            this.updateDetailedProgress(state);
        }
        const requiringInteraction = state.serversRequiringInteraction.filter(s => {
            // don't note interaction for a server we already started
            if (this.data.didStartServerIds?.includes(s.id)) {
                return false;
            }
            // don't note interaction for a server we previously noted interaction for
            if (this.previousParts.value.some(p => p?.serversRequiringInteraction.some(s2 => s.id === s2.id))) {
                return false;
            }
            return true;
        });
        if (requiringInteraction.length > 0) {
            if (!this.interactionMd.value) {
                this.renderInteractionRequired(requiringInteraction);
            }
            else {
                this.updateInteractionRequired(this.interactionMd.value.element, requiringInteraction);
            }
        }
        else if (requiringInteraction.length === 0 && this.interactionContainer) {
            this.interactionContainer.remove();
            this.interactionContainer = undefined;
        }
        this._onDidChangeHeight.fire();
    }
    createServerCommandLinks(servers) {
        return servers.map(s => createMarkdownCommandLink({
            title: '`' + escapeMarkdownSyntaxTokens(s.label) + '`',
            id: "workbench.mcp.serverOptions" /* McpCommandIds.ServerOptions */,
            arguments: [s.id],
        }, false)).join(', ');
    }
    updateDetailedProgress(state) {
        const skipText = createMarkdownCommandLink({
            title: localize('mcp.skip.link', 'Skip?'),
            id: "workbench.mcp.skipAutostart" /* McpCommandIds.SkipCurrentAutostart */,
        });
        let content;
        if (state.starting.length === 0) {
            content = new MarkdownString(undefined, { isTrusted: true }).appendText(localize('mcp.working.mcp', 'Activating MCP extensions...') + ' ').appendMarkdown(skipText);
        }
        else {
            // Update to show specific server names as command links
            const serverLinks = this.createServerCommandLinks(state.starting);
            content = new MarkdownString(undefined, { isTrusted: true }).appendMarkdown(localize('mcp.starting.servers', 'Starting MCP servers {0}...', serverLinks) + ' ').appendMarkdown(skipText);
        }
        if (this.workingProgressPart) {
            this.workingProgressPart.updateMessage(content);
        }
        else {
            this.workingProgressPart = this._register(this.instantiationService.createInstance(ChatProgressContentPart, { kind: 'progressMessage', content }, this._markdownRendererService, this.context, true, // forceShowSpinner
            true, // forceShowMessage
            undefined, // icon
            undefined));
            this.domNode.appendChild(this.workingProgressPart.domNode);
        }
        this._onDidChangeHeight.fire();
    }
    renderInteractionRequired(serversRequiringInteraction) {
        this.interactionContainer = dom.$('.chat-mcp-servers-interaction-hint');
        // Create subtle hint message
        const messageContainer = dom.$('.chat-mcp-servers-message');
        const icon = dom.$('.chat-mcp-servers-icon');
        icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.mcp));
        const { messageMd } = this.createInteractionMessage(serversRequiringInteraction);
        messageContainer.appendChild(icon);
        messageContainer.appendChild(messageMd.element);
        this.interactionContainer.appendChild(messageContainer);
        this.domNode.prepend(this.interactionContainer);
    }
    updateInteractionRequired(oldElement, serversRequiringInteraction) {
        const { messageMd } = this.createInteractionMessage(serversRequiringInteraction);
        oldElement.replaceWith(messageMd.element);
    }
    createInteractionMessage(serversRequiringInteraction) {
        const count = serversRequiringInteraction.length;
        const links = this.createServerCommandLinks(serversRequiringInteraction);
        const content = count === 1
            ? localize('mcp.start.single', 'The MCP server {0} may have new tools and requires interaction to start. [Start it now?]({1})', links, '#start')
            : localize('mcp.start.multiple', 'The MCP servers {0} may have new tools and require interaction to start. [Start them now?]({1})', links, '#start');
        const str = new MarkdownString(content, { isTrusted: true });
        const messageMd = this.interactionMd.value = this._markdownRendererService.render(str, {
            asyncRenderCallback: () => this._onDidChangeHeight.fire(),
            actionHandler: (content) => {
                if (!content.startsWith('command:')) {
                    this._start(startLink);
                    return Promise.resolve(true);
                }
                return openLinkFromMarkdown(this._openerService, content, true);
            }
        });
        // eslint-disable-next-line no-restricted-syntax
        const startLink = [...messageMd.element.querySelectorAll('a')].find(a => !a.getAttribute('data-href')?.startsWith('command:'));
        if (!startLink) {
            // Should not happen
            return { messageMd, startLink: undefined };
        }
        startLink.setAttribute('role', 'button');
        startLink.href = '';
        return { messageMd, startLink };
    }
    async _start(startLink) {
        // Update to starting state
        startLink.style.pointerEvents = 'none';
        startLink.style.opacity = '0.7';
        try {
            if (!this.data.state) {
                return;
            }
            const state = this.data.state.get();
            const serversToStart = state.serversRequiringInteraction;
            // Start servers in sequence with progress updates
            for (let i = 0; i < serversToStart.length; i++) {
                const serverInfo = serversToStart[i];
                startLink.textContent = localize('mcp.starting', "Starting {0}...", serverInfo.label);
                this._onDidChangeHeight.fire();
                const server = this.mcpService.servers.get().find(s => s.definition.id === serverInfo.id);
                if (server) {
                    await startServerAndWaitForLiveTools(server, { promptType: 'all-untrusted' });
                    this.data.didStartServerIds ??= [];
                    this.data.didStartServerIds.push(serverInfo.id);
                }
            }
            // Remove the interaction container after successful start
            if (this.interactionContainer) {
                this.interactionContainer.remove();
                this.interactionContainer = undefined;
            }
        }
        catch (error) {
            // Reset link on error
            startLink.style.pointerEvents = '';
            startLink.style.opacity = '';
            startLink.textContent = 'Start now?';
        }
        finally {
            this._onDidChangeHeight.fire();
        }
    }
    hasSameContent(other) {
        // Simple implementation that checks if it's the same type
        return other.kind === 'mcpServersStarting';
    }
    addDisposable(disposable) {
        this._register(disposable);
    }
};
ChatMcpServersInteractionContentPart = __decorate([
    __param(2, IMcpService),
    __param(3, IInstantiationService),
    __param(4, IOpenerService),
    __param(5, IMarkdownRendererService)
], ChatMcpServersInteractionContentPart);
export { ChatMcpServersInteractionContentPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1jcFNlcnZlcnNJbnRlcmFjdGlvbkNvbnRlbnRQYXJ0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGVudFBhcnRzL2NoYXRNY3BTZXJ2ZXJzSW50ZXJhY3Rpb25Db250ZW50UGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9DQUFvQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLDBCQUEwQixFQUFFLHlCQUF5QixFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ2xJLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsVUFBVSxFQUFlLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUU5SCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBRWpGLE9BQU8sRUFBb0IsV0FBVyxFQUFFLE1BQU0s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