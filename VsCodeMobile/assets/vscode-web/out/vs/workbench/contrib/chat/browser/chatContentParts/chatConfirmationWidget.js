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
import { Button, ButtonWithDropdown } from '../../../../../base/browser/ui/button/button.js';
import { Action, Separator } from '../../../../../base/common/actions.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { MenuWorkbenchToolBar } from '../../../../../platform/actions/browser/toolbar.js';
import { MenuId } from '../../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IMarkdownRendererService } from '../../../../../platform/markdown/browser/markdownRenderer.js';
import { defaultButtonStyles } from '../../../../../platform/theme/browser/defaultStyles.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { IChatWidgetService } from '../chat.js';
import { renderFileWidgets } from '../chatInlineAnchorWidget.js';
import { IChatMarkdownAnchorService } from './chatMarkdownAnchorService.js';
import { ChatMarkdownContentPart } from './chatMarkdownContentPart.js';
import './media/chatConfirmationWidget.css';
let ChatQueryTitlePart = class ChatQueryTitlePart extends Disposable {
    get title() {
        return this._title;
    }
    set title(value) {
        this._title = value;
        const next = this._renderer.render(this.toMdString(value), {
            asyncRenderCallback: () => this._onDidChangeHeight.fire(),
        });
        const previousEl = this._renderedTitle.value?.element;
        if (previousEl?.parentElement) {
            previousEl.replaceWith(next.element);
        }
        else {
            this.element.appendChild(next.element); // unreachable?
        }
        this._renderedTitle.value = next;
    }
    constructor(element, _title, subtitle, _renderer) {
        super();
        this.element = element;
        this._title = _title;
        this._renderer = _renderer;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this._renderedTitle = this._register(new MutableDisposable());
        element.classList.add('chat-query-title-part');
        this._renderedTitle.value = _renderer.render(this.toMdString(_title), {
            asyncRenderCallback: () => this._onDidChangeHeight.fire(),
        });
        element.append(this._renderedTitle.value.element);
        if (subtitle) {
            const str = this.toMdString(subtitle);
            const renderedTitle = this._register(_renderer.render(str, {
                asyncRenderCallback: () => this._onDidChangeHeight.fire(),
            }));
            const wrapper = document.createElement('small');
            wrapper.appendChild(renderedTitle.element);
            element.append(wrapper);
        }
    }
    toMdString(value) {
        if (typeof value === 'string') {
            return new MarkdownString('', { supportThemeIcons: true }).appendText(value);
        }
        else {
            return new MarkdownString(value.value, { supportThemeIcons: true, isTrusted: value.isTrusted });
        }
    }
};
ChatQueryTitlePart = __decorate([
    __param(3, IMarkdownRendererService)
], ChatQueryTitlePart);
export { ChatQueryTitlePart };
let ChatConfirmationNotifier = class ChatConfirmationNotifier extends Disposable {
    constructor(_hostService, _chatWidgetService) {
        super();
        this._hostService = _hostService;
        this._chatWidgetService = _chatWidgetService;
        this.disposables = this._register(new MutableDisposable());
    }
    async notify(targetWindow, sessionResource) {
        // Focus Window
        this._hostService.focus(targetWindow, { mode: 1 /* FocusMode.Notify */ });
        // Notify
        const widget = this._chatWidgetService.getWidgetBySessionResource(sessionResource);
        const title = widget?.viewModel?.model.title ? localize('chatTitle', "Chat: {0}", widget.viewModel.model.title) : localize('chat.untitledChat', "Untitled Chat");
        const notification = await dom.triggerNotification(title, {
            detail: localize('notificationDetail', "Approval needed to continue.")
        });
        if (notification) {
            const disposables = this.disposables.value = new DisposableStore();
            disposables.add(notification);
            disposables.add(Event.once(notification.onClick)(async () => {
                await this._hostService.focus(targetWindow, { mode: 2 /* FocusMode.Force */ });
                if (widget) {
                    await this._chatWidgetService.reveal(widget);
                    widget.focusInput();
                }
                disposables.dispose();
            }));
            disposables.add(this._hostService.onDidChangeFocus(focus => {
                if (focus) {
                    disposables.dispose();
                }
            }));
        }
    }
};
ChatConfirmationNotifier = __decorate([
    __param(0, IHostService),
    __param(1, IChatWidgetService)
], ChatConfirmationNotifier);
let BaseSimpleChatConfirmationWidget = class BaseSimpleChatConfirmationWidget extends Disposable {
    get onDidClick() { return this._onDidClick.event; }
    get onDidChangeHeight() { return this._onDidChangeHeight.event; }
    get domNode() {
        return this._domNode;
    }
    get showingButtons() {
        return !this.domNode.classList.contains('hideButtons');
    }
    setShowButtons(showButton) {
        this.domNode.classList.toggle('hideButtons', !showButton);
    }
    constructor(context, options, instantiationService, _markdownRendererService, contextMenuService, _configurationService, contextKeyService) {
        super();
        this.context = context;
        this.instantiationService = instantiationService;
        this._markdownRendererService = _markdownRendererService;
        this._configurationService = _configurationService;
        this._onDidClick = this._register(new Emitter());
        this._onDidChangeHeight = this._register(new Emitter());
        const { title, subtitle, message, buttons, silent } = options;
        this.silent = !!silent;
        this.notificationManager = this._register(instantiationService.createInstance(ChatConfirmationNotifier));
        const elements = dom.h('.chat-confirmation-widget-container@container', [
            dom.h('.chat-confirmation-widget@root', [
                dom.h('.chat-confirmation-widget-title@title'),
                dom.h('.chat-confirmation-widget-message@message'),
                dom.h('.chat-buttons-container@buttonsContainer', [
                    dom.h('.chat-buttons@buttons'),
                    dom.h('.chat-toolbar@toolbar'),
                ]),
            ]),
        ]);
        configureAccessibilityContainer(elements.container, title, message);
        this._domNode = elements.root;
        const titlePart = this._register(instantiationService.createInstance(ChatQueryTitlePart, elements.title, title, subtitle));
        this._register(titlePart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
        this.messageElement = elements.message;
        // Create buttons
        buttons.forEach(buttonData => {
            const buttonOptions = { ...defaultButtonStyles, secondary: buttonData.isSecondary, title: buttonData.tooltip, disabled: buttonData.disabled };
            let button;
            if (buttonData.moreActions) {
                button = new ButtonWithDropdown(elements.buttons, {
                    ...buttonOptions,
                    contextMenuProvider: contextMenuService,
                    addPrimaryActionToDropdown: false,
                    actions: buttonData.moreActions.map(action => {
                        if (action instanceof Separator) {
                            return action;
                        }
                        return this._register(new Action(action.label, action.label, undefined, !action.disabled, () => {
                            this._onDidClick.fire(action);
                            return Promise.resolve();
                        }));
                    }),
                });
            }
            else {
                button = new Button(elements.buttons, buttonOptions);
            }
            this._register(button);
            button.label = buttonData.label;
            this._register(button.onDidClick(() => this._onDidClick.fire(buttonData)));
            if (buttonData.onDidChangeDisablement) {
                this._register(buttonData.onDidChangeDisablement(disabled => button.enabled = !disabled));
            }
        });
        // Create toolbar if actions are provided
        if (options?.toolbarData) {
            const overlay = contextKeyService.createOverlay([
                ['chatConfirmationPartType', options.toolbarData.partType],
                ['chatConfirmationPartSource', options.toolbarData.partSource],
            ]);
            const nestedInsta = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, overlay])));
            this._register(nestedInsta.createInstance(MenuWorkbenchToolBar, elements.toolbar, MenuId.ChatConfirmationMenu, {
                // buttonConfigProvider: () => ({ showLabel: false, showIcon: true }),
                menuOptions: {
                    arg: options.toolbarData.arg,
                    shouldForwardArgs: true,
                }
            }));
        }
    }
    renderMessage(element, listContainer) {
        this.messageElement.append(element);
        if (this.showingButtons && this._configurationService.getValue('chat.notifyWindowOnConfirmation') && !this.silent) {
            const targetWindow = dom.getWindow(listContainer);
            if (!targetWindow.document.hasFocus()) {
                this.notificationManager.notify(targetWindow, this.context.element.sessionResource);
            }
        }
    }
};
BaseSimpleChatConfirmationWidget = __decorate([
    __param(2, IInstantiationService),
    __param(3, IMarkdownRendererService),
    __param(4, IContextMenuService),
    __param(5, IConfigurationService),
    __param(6, IContextKeyService)
], BaseSimpleChatConfirmationWidget);
/** @deprecated Use ChatConfirmationWidget instead */
let SimpleChatConfirmationWidget = class SimpleChatConfirmationWidget extends BaseSimpleChatConfirmationWidget {
    constructor(context, options, instantiationService, markdownRendererService, contextMenuService, configurationService, contextKeyService) {
        super(context, options, instantiationService, markdownRendererService, contextMenuService, configurationService, contextKeyService);
        this.updateMessage(options.message);
    }
    updateMessage(message) {
        this._renderedMessage?.remove();
        const renderedMessage = this._register(this._markdownRendererService.render(typeof message === 'string' ? new MarkdownString(message) : message, { asyncRenderCallback: () => this._onDidChangeHeight.fire() }));
        this.renderMessage(renderedMessage.element, this.context.container);
        this._renderedMessage = renderedMessage.element;
    }
};
SimpleChatConfirmationWidget = __decorate([
    __param(2, IInstantiationService),
    __param(3, IMarkdownRendererService),
    __param(4, IContextMenuService),
    __param(5, IConfigurationService),
    __param(6, IContextKeyService)
], SimpleChatConfirmationWidget);
export { SimpleChatConfirmationWidget };
let BaseChatConfirmationWidget = class BaseChatConfirmationWidget extends Disposable {
    get onDidClick() { return this._onDidClick.event; }
    get onDidChangeHeight() { return this._onDidChangeHeight.event; }
    get domNode() {
        return this._domNode;
    }
    get showingButtons() {
        return !this.domNode.classList.contains('hideButtons');
    }
    setShowButtons(showButton) {
        this.domNode.classList.toggle('hideButtons', !showButton);
    }
    get codeblocksPartId() {
        return this.markdownContentPart.value?.codeblocksPartId;
    }
    get codeblocks() {
        return this.markdownContentPart.value?.codeblocks;
    }
    constructor(_context, options, instantiationService, markdownRendererService, contextMenuService, _configurationService, contextKeyService, chatMarkdownAnchorService) {
        super();
        this._context = _context;
        this.instantiationService = instantiationService;
        this.markdownRendererService = markdownRendererService;
        this.contextMenuService = contextMenuService;
        this._configurationService = _configurationService;
        this.chatMarkdownAnchorService = chatMarkdownAnchorService;
        this._onDidClick = this._register(new Emitter());
        this._onDidChangeHeight = this._register(new Emitter());
        this.markdownContentPart = this._register(new MutableDisposable());
        const { title, subtitle, message, buttons, icon } = options;
        this.notificationManager = this._register(instantiationService.createInstance(ChatConfirmationNotifier));
        const elements = dom.h('.chat-confirmation-widget-container@container', [
            dom.h('.chat-confirmation-widget2@root', [
                dom.h('.chat-confirmation-widget-title', [
                    dom.h('.chat-title@title'),
                    dom.h('.chat-toolbar-container@buttonsContainer', [
                        dom.h('.chat-toolbar@toolbar'),
                    ]),
                ]),
                dom.h('.chat-confirmation-widget-message@message'),
                dom.h('.chat-confirmation-widget-buttons', [
                    dom.h('.chat-buttons@buttons'),
                ]),
            ]),
        ]);
        configureAccessibilityContainer(elements.container, title, message);
        this._domNode = elements.root;
        this._buttonsDomNode = elements.buttons;
        const titlePart = this._register(instantiationService.createInstance(ChatQueryTitlePart, elements.title, new MarkdownString(icon ? `$(${icon.id}) ${typeof title === 'string' ? title : title.value}` : typeof title === 'string' ? title : title.value), subtitle));
        this._register(titlePart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
        this.messageElement = elements.message;
        this.updateButtons(buttons);
        // Create toolbar if actions are provided
        if (options?.toolbarData) {
            const overlay = contextKeyService.createOverlay([
                ['chatConfirmationPartType', options.toolbarData.partType],
                ['chatConfirmationPartSource', options.toolbarData.partSource],
            ]);
            const nestedInsta = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, overlay])));
            this._register(nestedInsta.createInstance(MenuWorkbenchToolBar, elements.toolbar, MenuId.ChatConfirmationMenu, {
                // buttonConfigProvider: () => ({ showLabel: false, showIcon: true }),
                menuOptions: {
                    arg: options.toolbarData.arg,
                    shouldForwardArgs: true,
                }
            }));
        }
    }
    updateButtons(buttons) {
        while (this._buttonsDomNode.children.length > 0) {
            this._buttonsDomNode.children[0].remove();
        }
        for (const buttonData of buttons) {
            const buttonOptions = { ...defaultButtonStyles, secondary: buttonData.isSecondary, title: buttonData.tooltip, disabled: buttonData.disabled };
            let button;
            if (buttonData.moreActions) {
                button = new ButtonWithDropdown(this._buttonsDomNode, {
                    ...buttonOptions,
                    contextMenuProvider: this.contextMenuService,
                    addPrimaryActionToDropdown: false,
                    actions: buttonData.moreActions.map(action => {
                        if (action instanceof Separator) {
                            return action;
                        }
                        return this._register(new Action(action.label, action.label, undefined, !action.disabled, () => {
                            this._onDidClick.fire(action);
                            return Promise.resolve();
                        }));
                    }),
                });
            }
            else {
                button = new Button(this._buttonsDomNode, buttonOptions);
            }
            this._register(button);
            button.label = buttonData.label;
            this._register(button.onDidClick(() => this._onDidClick.fire(buttonData)));
            if (buttonData.onDidChangeDisablement) {
                this._register(buttonData.onDidChangeDisablement(disabled => button.enabled = !disabled));
            }
        }
    }
    renderMessage(element, listContainer) {
        this.markdownContentPart.clear();
        if (!dom.isHTMLElement(element)) {
            const part = this._register(this.instantiationService.createInstance(ChatMarkdownContentPart, {
                kind: 'markdownContent',
                content: typeof element === 'string' ? new MarkdownString().appendMarkdown(element) : element
            }, this._context, this._context.editorPool, false, this._context.codeBlockStartIndex, this.markdownRendererService, undefined, this._context.currentWidth(), this._context.codeBlockModelCollection, {
                allowInlineDiffs: true,
                horizontalPadding: 6,
            }));
            renderFileWidgets(part.domNode, this.instantiationService, this.chatMarkdownAnchorService, this._store);
            this._register(part.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
            this.markdownContentPart.value = part;
            element = part.domNode;
        }
        for (const child of this.messageElement.children) {
            child.remove();
        }
        this.messageElement.append(element);
        if (this.showingButtons && this._configurationService.getValue('chat.notifyWindowOnConfirmation')) {
            const targetWindow = dom.getWindow(listContainer);
            if (!targetWindow.document.hasFocus()) {
                this.notificationManager.notify(targetWindow, this._context.element.sessionResource);
            }
        }
    }
};
BaseChatConfirmationWidget = __decorate([
    __param(2, IInstantiationService),
    __param(3, IMarkdownRendererService),
    __param(4, IContextMenuService),
    __param(5, IConfigurationService),
    __param(6, IContextKeyService),
    __param(7, IChatMarkdownAnchorService)
], BaseChatConfirmationWidget);
let ChatConfirmationWidget = class ChatConfirmationWidget extends BaseChatConfirmationWidget {
    constructor(context, options, instantiationService, markdownRendererService, contextMenuService, configurationService, contextKeyService, chatMarkdownAnchorService) {
        super(context, options, instantiationService, markdownRendererService, contextMenuService, configurationService, contextKeyService, chatMarkdownAnchorService);
        this.renderMessage(options.message, context.container);
    }
    updateMessage(message) {
        this._renderedMessage?.remove();
        const renderedMessage = this._register(this.markdownRendererService.render(typeof message === 'string' ? new MarkdownString(message) : message, { asyncRenderCallback: () => this._onDidChangeHeight.fire() }));
        this.renderMessage(renderedMessage.element, this._context.container);
        this._renderedMessage = renderedMessage.element;
    }
};
ChatConfirmationWidget = __decorate([
    __param(2, IInstantiationService),
    __param(3, IMarkdownRendererService),
    __param(4, IContextMenuService),
    __param(5, IConfigurationService),
    __param(6, IContextKeyService),
    __param(7, IChatMarkdownAnchorService)
], ChatConfirmationWidget);
export { ChatConfirmationWidget };
let ChatCustomConfirmationWidget = class ChatCustomConfirmationWidget extends BaseChatConfirmationWidget {
    constructor(context, options, instantiationService, markdownRendererService, contextMenuService, configurationService, contextKeyService, chatMarkdownAnchorService) {
        super(context, options, instantiationService, markdownRendererService, contextMenuService, configurationService, contextKeyService, chatMarkdownAnchorService);
        this.renderMessage(options.message, context.container);
    }
};
ChatCustomConfirmationWidget = __decorate([
    __param(2, IInstantiationService),
    __param(3, IMarkdownRendererService),
    __param(4, IContextMenuService),
    __param(5, IConfigurationService),
    __param(6, IContextKeyService),
    __param(7, IChatMarkdownAnchorService)
], ChatCustomConfirmationWidget);
export { ChatCustomConfirmationWidget };
function configureAccessibilityContainer(container, title, message) {
    container.tabIndex = 0;
    const titleAsString = typeof title === 'string' ? title : title.value;
    const messageAsString = typeof message === 'string' ? message : message && 'value' in message ? message.value : message && 'textContent' in message ? message.textContent : '';
    container.setAttribute('aria-label', localize('chat.confirmationWidget.ariaLabel', "Chat Confirmation Dialog {0} {1}", titleAsString, messageAsString));
    container.classList.add('chat-confirmation-widget-container');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdENvbmZpcm1hdGlvbldpZGdldC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy9jaGF0Q29uZmlybWF0aW9uV2lkZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFFMUQsT0FBTyxFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBMkIsTUFBTSxpREFBaUQsQ0FBQztBQUN0SCxPQUFPLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDckUsT0FBTyxFQUFtQixjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUM1RixPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBR3pHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDM0UsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDN0YsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDakcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFD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