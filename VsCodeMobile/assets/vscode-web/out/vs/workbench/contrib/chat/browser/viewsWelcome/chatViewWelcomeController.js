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
import { asCSSUrl } from '../../../../../base/browser/cssValue.js';
import * as dom from '../../../../../base/browser/dom.js';
import { createCSSRule } from '../../../../../base/browser/domStylesheets.js';
import { StandardKeyboardEvent } from '../../../../../base/browser/keyboardEvent.js';
import { Button } from '../../../../../base/browser/ui/button/button.js';
import { renderIcon } from '../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Action } from '../../../../../base/common/actions.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Event } from '../../../../../base/common/event.js';
import { StringSHA1 } from '../../../../../base/common/hash.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize } from '../../../../../nls.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IMarkdownRendererService } from '../../../../../platform/markdown/browser/markdownRenderer.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { defaultButtonStyles } from '../../../../../platform/theme/browser/defaultStyles.js';
import { ChatAgentLocation } from '../../common/constants.js';
import { IChatWidgetService } from '../chat.js';
import { chatViewsWelcomeRegistry } from './chatViewsWelcome.js';
const $ = dom.$;
let ChatViewWelcomeController = class ChatViewWelcomeController extends Disposable {
    get isShowingWelcome() {
        return this._isShowingWelcome;
    }
    constructor(container, delegate, location, contextKeyService, instantiationService) {
        super();
        this.container = container;
        this.delegate = delegate;
        this.location = location;
        this.contextKeyService = contextKeyService;
        this.instantiationService = instantiationService;
        this.enabled = false;
        this.enabledDisposables = this._register(new DisposableStore());
        this.renderDisposables = this._register(new DisposableStore());
        this._isShowingWelcome = observableValue(this, false);
        this.element = dom.append(this.container, dom.$('.chat-view-welcome'));
        this._register(Event.runAndSubscribe(delegate.onDidChangeViewWelcomeState, () => this.update()));
        this._register(chatViewsWelcomeRegistry.onDidChange(() => this.update(true)));
    }
    update(force) {
        const enabled = this.delegate.shouldShowWelcome();
        if (this.enabled === enabled && !force) {
            return;
        }
        this.enabled = enabled;
        this.enabledDisposables.clear();
        if (!enabled) {
            this.container.classList.toggle('chat-view-welcome-visible', false);
            this.renderDisposables.clear();
            this._isShowingWelcome.set(false, undefined);
            return;
        }
        const descriptors = chatViewsWelcomeRegistry.get();
        if (descriptors.length) {
            this.render(descriptors);
            const descriptorKeys = new Set(descriptors.flatMap(d => d.when.keys()));
            this.enabledDisposables.add(this.contextKeyService.onDidChangeContext(e => {
                if (e.affectsSome(descriptorKeys)) {
                    this.render(descriptors);
                }
            }));
        }
    }
    render(descriptors) {
        this.renderDisposables.clear();
        dom.clearNode(this.element);
        const matchingDescriptors = descriptors.filter(descriptor => this.contextKeyService.contextMatchesRules(descriptor.when));
        const enabledDescriptor = matchingDescriptors.at(0);
        if (enabledDescriptor) {
            const content = {
                icon: enabledDescriptor.icon,
                title: enabledDescriptor.title,
                message: enabledDescriptor.content
            };
            const welcomeView = this.renderDisposables.add(this.instantiationService.createInstance(ChatViewWelcomePart, content, { firstLinkToButton: true, location: this.location }));
            this.element.appendChild(welcomeView.element);
            this.container.classList.toggle('chat-view-welcome-visible', true);
            this._isShowingWelcome.set(true, undefined);
        }
        else {
            this.container.classList.toggle('chat-view-welcome-visible', false);
            this._isShowingWelcome.set(false, undefined);
        }
    }
};
ChatViewWelcomeController = __decorate([
    __param(3, IContextKeyService),
    __param(4, IInstantiationService)
], ChatViewWelcomeController);
export { ChatViewWelcomeController };
let ChatViewWelcomePart = class ChatViewWelcomePart extends Disposable {
    constructor(content, options, openerService, logService, chatWidgetService, telemetryService, markdownRendererService, contextMenuService) {
        super();
        this.content = content;
        this.openerService = openerService;
        this.logService = logService;
        this.chatWidgetService = chatWidgetService;
        this.telemetryService = telemetryService;
        this.markdownRendererService = markdownRendererService;
        this.contextMenuService = contextMenuService;
        this.element = dom.$('.chat-welcome-view');
        try {
            // Icon
            const icon = dom.append(this.element, $('.chat-welcome-view-icon'));
            if (content.useLargeIcon) {
                icon.classList.add('large-icon');
            }
            if (content.icon) {
                if (ThemeIcon.isThemeIcon(content.icon)) {
                    const iconElement = renderIcon(content.icon);
                    icon.appendChild(iconElement);
                }
                else if (URI.isUri(content.icon)) {
                    const cssUrl = asCSSUrl(content.icon);
                    const hash = new StringSHA1();
                    hash.update(cssUrl);
                    const iconId = `chat-welcome-icon-${hash.digest()}`;
                    const iconClass = `.chat-welcome-view-icon.${iconId}`;
                    createCSSRule(iconClass, `
					mask: ${cssUrl} no-repeat 50% 50%;
					-webkit-mask: ${cssUrl} no-repeat 50% 50%;
					background-color: var(--vscode-icon-foreground);
				`);
                    icon.classList.add(iconId, 'custom-icon');
                }
            }
            const title = dom.append(this.element, $('.chat-welcome-view-title'));
            title.textContent = content.title;
            const message = dom.append(this.element, $('.chat-welcome-view-message'));
            const messageResult = this.renderMarkdownMessageContent(content.message, options);
            dom.append(message, messageResult.element);
            // Additional message
            if (content.additionalMessage) {
                const disclaimers = dom.append(this.element, $('.chat-welcome-view-disclaimer'));
                if (typeof content.additionalMessage === 'string') {
                    disclaimers.textContent = content.additionalMessage;
                }
                else {
                    const additionalMessageResult = this.renderMarkdownMessageContent(content.additionalMessage, options);
                    disclaimers.appendChild(additionalMessageResult.element);
                }
            }
            // Render suggested prompts for both new user and regular modes
            if (content.suggestedPrompts && content.suggestedPrompts.length) {
                const suggestedPromptsContainer = dom.append(this.element, $('.chat-welcome-view-suggested-prompts'));
                const titleElement = dom.append(suggestedPromptsContainer, $('.chat-welcome-view-suggested-prompts-title'));
                titleElement.textContent = localize('chatWidget.suggestedActions', 'Suggested Actions');
                for (const prompt of content.suggestedPrompts) {
                    const promptElement = dom.append(suggestedPromptsContainer, $('.chat-welcome-view-suggested-prompt'));
                    // Make the prompt element keyboard accessible
                    promptElement.setAttribute('role', 'button');
                    promptElement.setAttribute('tabindex', '0');
                    const promptAriaLabel = prompt.description
                        ? localize('suggestedPromptAriaLabelWithDescription', 'Suggested prompt: {0}, {1}', prompt.label, prompt.description)
                        : localize('suggestedPromptAriaLabel', 'Suggested prompt: {0}', prompt.label);
                    promptElement.setAttribute('aria-label', promptAriaLabel);
                    const titleElement = dom.append(promptElement, $('.chat-welcome-view-suggested-prompt-title'));
                    titleElement.textContent = prompt.label;
                    const tooltip = localize('runPromptTitle', "Suggested prompt: {0}", prompt.prompt);
                    promptElement.title = tooltip;
                    titleElement.title = tooltip;
                    if (prompt.description) {
                        const descriptionElement = dom.append(promptElement, $('.chat-welcome-view-suggested-prompt-description'));
                        descriptionElement.textContent = prompt.description;
                        descriptionElement.title = prompt.description;
                    }
                    const executePrompt = () => {
                        this.telemetryService.publicLog2('chat.clickedSuggestedPrompt', {
                            suggestedPrompt: prompt.prompt,
                        });
                        if (!this.chatWidgetService.lastFocusedWidget) {
                            const widgets = this.chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Chat);
                            if (widgets.length) {
                                widgets[0].setInput(prompt.prompt);
                            }
                        }
                        else {
                            this.chatWidgetService.lastFocusedWidget.setInput(prompt.prompt);
                        }
                    };
                    // Add context menu handler
                    this._register(dom.addDisposableListener(promptElement, dom.EventType.CONTEXT_MENU, (e) => {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        const actions = this.getPromptContextMenuActions(prompt);
                        this.contextMenuService.showContextMenu({
                            getAnchor: () => ({ x: e.clientX, y: e.clientY }),
                            getActions: () => actions,
                        });
                    }));
                    // Add click handler
                    this._register(dom.addDisposableListener(promptElement, dom.EventType.CLICK, executePrompt));
                    // Add keyboard handler
                    this._register(dom.addDisposableListener(promptElement, dom.EventType.KEY_DOWN, (e) => {
                        const event = new StandardKeyboardEvent(e);
                        if (event.equals(3 /* KeyCode.Enter */) || event.equals(10 /* KeyCode.Space */)) {
                            e.preventDefault();
                            e.stopPropagation();
                            executePrompt();
                        }
                        else if (event.equals(68 /* KeyCode.F10 */) && event.shiftKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            const actions = this.getPromptContextMenuActions(prompt);
                            this.contextMenuService.showContextMenu({
                                getAnchor: () => promptElement,
                                getActions: () => actions,
                            });
                        }
                    }));
                }
            }
            // Tips
            if (content.tips) {
                const tips = dom.append(this.element, $('.chat-welcome-view-tips'));
                const tipsResult = this._register(this.markdownRendererService.render(content.tips));
                tips.appendChild(tipsResult.element);
            }
        }
        catch (err) {
            this.logService.error('Failed to render chat view welcome content', err);
        }
    }
    getPromptContextMenuActions(prompt) {
        const actions = [];
        if (prompt.uri) {
            const uri = prompt.uri;
            actions.push(new Action('chat.editPromptFile', localize('editPromptFile', "Edit Prompt File"), ThemeIcon.asClassName(Codicon.goToFile), true, async () => {
                try {
                    await this.openerService.open(uri);
                }
                catch (error) {
                    this.logService.error('Failed to open prompt file:', error);
                }
            }));
        }
        return actions;
    }
    needsRerender(content) {
        // Heuristic based on content that changes between states
        return !!(this.content.title !== content.title ||
            this.content.message.value !== content.message.value ||
            this.content.additionalMessage !== content.additionalMessage ||
            this.content.tips?.value !== content.tips?.value ||
            this.content.suggestedPrompts?.length !== content.suggestedPrompts?.length ||
            this.content.suggestedPrompts?.some((prompt, index) => {
                const incoming = content.suggestedPrompts?.[index];
                return incoming?.label !== prompt.label || incoming?.description !== prompt.description;
            }));
    }
    renderMarkdownMessageContent(content, options) {
        const messageResult = this._register(this.markdownRendererService.render(content));
        // eslint-disable-next-line no-restricted-syntax
        const firstLink = options?.firstLinkToButton ? messageResult.element.querySelector('a') : undefined;
        if (firstLink) {
            const target = firstLink.getAttribute('data-href');
            const button = this._register(new Button(firstLink.parentElement, defaultButtonStyles));
            button.label = firstLink.textContent ?? '';
            if (target) {
                this._register(button.onDidClick(() => {
                    this.openerService.open(target, { allowCommands: true });
                }));
            }
            firstLink.replaceWith(button.element);
        }
        return messageResult;
    }
};
ChatViewWelcomePart = __decorate([
    __param(2, IOpenerService),
    __param(3, ILogService),
    __param(4, IChatWidgetService),
    __param(5, ITelemetryService),
    __param(6, IMarkdownRendererService),
    __param(7, IContextMenuService)
], ChatViewWelcomePart);
export { ChatViewWelcomePart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFZpZXdXZWxjb21lQ29udHJvbGxlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvdmlld3NXZWxjb21lL2NoYXRWaWV3V2VsY29tZUNvbnRyb2xsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ25FLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBRXJGLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUN6RSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDcEYsT0FBTyxFQUFFLE1BQU0sRUFBVyxNQUFNLHVDQUF1QyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDNUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBR2hFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDdEYsT0FBTyxFQUFvQyxlQUFlLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUM3RyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDcEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVB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