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
import { Action } from '../../../../../base/common/actions.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IChatSessionsService } from '../../common/chatSessionsService.js';
import { AgentSessionProviders, getAgentSessionProviderIcon, getAgentSessionProviderName } from '../agentSessions/agentSessions.js';
let ChatSuggestNextWidget = class ChatSuggestNextWidget extends Disposable {
    constructor(contextMenuService, chatSessionsService) {
        super();
        this.contextMenuService = contextMenuService;
        this.chatSessionsService = chatSessionsService;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this._onDidSelectPrompt = this._register(new Emitter());
        this.onDidSelectPrompt = this._onDidSelectPrompt.event;
        this.buttonDisposables = new Map();
        this.domNode = this.createSuggestNextWidget();
    }
    get height() {
        return this.domNode.style.display === 'none' ? 0 : this.domNode.offsetHeight;
    }
    getCurrentMode() {
        return this._currentMode;
    }
    createSuggestNextWidget() {
        // Reuse welcome view classes for consistent styling
        const container = dom.$('.chat-suggest-next-widget.chat-welcome-view-suggested-prompts');
        container.style.display = 'none';
        // Title element using welcome view class
        this.titleElement = dom.append(container, dom.$('.chat-welcome-view-suggested-prompts-title'));
        // Container for prompt buttons
        this.promptsContainer = container;
        return container;
    }
    render(mode) {
        const handoffs = mode.handOffs?.get();
        if (!handoffs || handoffs.length === 0) {
            this.hide();
            return;
        }
        this._currentMode = mode;
        // Update title with mode name: "Proceed from {Mode}"
        const modeName = mode.name.get() || mode.label.get() || localize('chat.currentMode', 'current mode');
        this.titleElement.textContent = localize('chat.proceedFrom', 'Proceed from {0}', modeName);
        // Clear existing prompt buttons (keep title which is first child)
        const childrenToRemove = [];
        for (let i = 1; i < this.promptsContainer.children.length; i++) {
            childrenToRemove.push(this.promptsContainer.children[i]);
        }
        for (const child of childrenToRemove) {
            const disposables = this.buttonDisposables.get(child);
            if (disposables) {
                disposables.dispose();
                this.buttonDisposables.delete(child);
            }
            this.promptsContainer.removeChild(child);
        }
        for (const handoff of handoffs) {
            const promptButton = this.createPromptButton(handoff);
            this.promptsContainer.appendChild(promptButton);
        }
        this.domNode.style.display = 'flex';
        this._onDidChangeHeight.fire();
    }
    createPromptButton(handoff) {
        const disposables = new DisposableStore();
        const button = dom.$('.chat-welcome-view-suggested-prompt');
        button.setAttribute('tabindex', '0');
        button.setAttribute('role', 'button');
        button.setAttribute('aria-label', localize('chat.suggestNext.item', '{0}', handoff.label));
        const titleElement = dom.append(button, dom.$('.chat-welcome-view-suggested-prompt-title'));
        titleElement.textContent = handoff.label;
        // Optional showContinueOn behaves like send: only present if specified
        const showContinueOn = handoff.showContinueOn ?? true;
        // Get chat session contributions to show in chevron dropdown
        const contributions = this.chatSessionsService.getAllChatSessionContributions();
        const availableContributions = contributions.filter(c => c.canDelegate !== false);
        if (showContinueOn && availableContributions.length > 0) {
            const separator = dom.append(button, dom.$('.chat-suggest-next-separator'));
            separator.setAttribute('aria-hidden', 'true');
            const chevron = dom.append(button, dom.$('.codicon.codicon-chevron-down.dropdown-chevron'));
            chevron.setAttribute('tabindex', '0');
            chevron.setAttribute('role', 'button');
            chevron.setAttribute('aria-label', localize('chat.suggestNext.moreOptions', 'More options for {0}', handoff.label));
            chevron.setAttribute('aria-haspopup', 'true');
            const showContextMenu = (e, anchor) => {
                e.preventDefault();
                e.stopPropagation();
                const actions = availableContributions.map(contrib => {
                    const provider = contrib.type === AgentSessionProviders.Background ? AgentSessionProviders.Background : AgentSessionProviders.Cloud;
                    const icon = getAgentSessionProviderIcon(provider);
                    const name = getAgentSessionProviderName(provider);
                    return new Action(contrib.type, localize('continueIn', "Continue in {0}", name), ThemeIcon.isThemeIcon(icon) ? ThemeIcon.asClassName(icon) : undefined, true, () => {
                        this._onDidSelectPrompt.fire({ handoff, agentId: contrib.name });
                    });
                });
                this.contextMenuService.showContextMenu({
                    getAnchor: () => anchor || button,
                    getActions: () => actions,
                    autoSelectFirstItem: true,
                });
            };
            disposables.add(dom.addDisposableListener(chevron, 'click', (e) => {
                showContextMenu(e, chevron);
            }));
            disposables.add(dom.addDisposableListener(chevron, 'keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    showContextMenu(e, chevron);
                }
            }));
            disposables.add(dom.addDisposableListener(button, 'click', (e) => {
                if (e.target.classList.contains('dropdown-chevron')) {
                    return;
                }
                this._onDidSelectPrompt.fire({ handoff });
            }));
        }
        else {
            disposables.add(dom.addDisposableListener(button, 'click', () => {
                this._onDidSelectPrompt.fire({ handoff });
            }));
        }
        disposables.add(dom.addDisposableListener(button, 'keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._onDidSelectPrompt.fire({ handoff });
            }
        }));
        // Store disposables for this button so they can be disposed when the button is removed
        this.buttonDisposables.set(button, disposables);
        return button;
    }
    hide() {
        if (this.domNode.style.display !== 'none') {
            this._currentMode = undefined;
            this.domNode.style.display = 'none';
            this._onDidChangeHeight.fire();
        }
    }
    dispose() {
        // Dispose all button disposables
        for (const disposables of this.buttonDisposables.values()) {
            disposables.dispose();
        }
        this.buttonDisposables.clear();
        super.dispose();
    }
};
ChatSuggestNextWidget = __decorate([
    __param(0, IContextMenuService),
    __param(1, IChatSessionsService)
], ChatSuggestNextWidget);
export { ChatSuggestNextWidget };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFN1Z2dlc3ROZXh0V2lkZ2V0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGVudFBhcnRzL2NoYXRTdWdnZXN0TmV4dFdpZGdldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9DQUFvQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0scUNBQXFDLENBQUM7QUFDckUsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN0RixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRWpHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRTNFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSwyQkFBMkIsRUFBRSwyQkFBMkIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBTzdILElBQU0scUJBQXFCLEdBQTNCLE1BQU0scUJBQXNCLFNBQVEsVUFBVTtJQWNwRCxZQUNzQixrQkFBd0QsRUFDdkQsbUJBQTBEO1FBRWhGLEtBQUssRUFBRSxDQUFDO1FBSDhCLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBcUI7UUFDdEMsd0JBQW1CLEdBQW5CLG1CQUFtQixDQUFzQjtRQWJoRSx1QkFBa0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUMxRCxzQkFBaUIsR0FBZ0IsSUFB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