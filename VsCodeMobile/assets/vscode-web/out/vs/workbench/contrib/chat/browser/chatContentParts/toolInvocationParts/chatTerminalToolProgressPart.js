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
import { h } from '../../../../../../base/browser/dom.js';
import { ActionBar } from '../../../../../../base/browser/ui/actionbar/actionbar.js';
import { isMarkdownString, MarkdownString } from '../../../../../../base/common/htmlContent.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { migrateLegacyTerminalToolSpecificData } from '../../../common/chat.js';
import { IChatWidgetService } from '../../chat.js';
import { ChatQueryTitlePart } from '../chatConfirmationWidget.js';
import { ChatMarkdownContentPart } from '../chatMarkdownContentPart.js';
import { ChatProgressSubPart } from '../chatProgressContentPart.js';
import { BaseChatToolInvocationSubPart } from './chatToolInvocationSubPart.js';
import '../media/chatTerminalToolProgressPart.css';
import { Action } from '../../../../../../base/common/actions.js';
import { ITerminalChatService, ITerminalConfigurationService, ITerminalEditorService, ITerminalGroupService, ITerminalService } from '../../../../terminal/browser/terminal.js';
import { Disposable, MutableDisposable, toDisposable } from '../../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../../base/common/event.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { getTerminalCommandDecorationState, getTerminalCommandDecorationTooltip } from '../../../../terminal/browser/xterm/decorationStyles.js';
import * as dom from '../../../../../../base/browser/dom.js';
import { DomScrollableElement } from '../../../../../../base/browser/ui/scrollbar/scrollableElement.js';
import { localize } from '../../../../../../nls.js';
import { IHoverService } from '../../../../../../platform/hover/browser/hover.js';
import { URI } from '../../../../../../base/common/uri.js';
import { stripIcons } from '../../../../../../base/common/iconLabels.js';
import { IAccessibleViewService } from '../../../../../../platform/accessibility/browser/accessibleView.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { ChatContextKeys } from '../../../common/chatContextKeys.js';
import { IKeybindingService } from '../../../../../../platform/keybinding/common/keybinding.js';
import { DetachedTerminalCommandMirror } from '../../../../terminal/browser/chatTerminalCommandMirror.js';
import { TerminalLocation } from '../../../../../../platform/terminal/common/terminal.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { ITelemetryService } from '../../../../../../platform/telemetry/common/telemetry.js';
import { isNumber } from '../../../../../../base/common/types.js';
const MIN_OUTPUT_ROWS = 1;
const MAX_OUTPUT_ROWS = 10;
/**
 * Remembers whether a tool invocation was last expanded so state survives virtualization re-renders.
 */
const expandedStateByInvocation = new WeakMap();
let TerminalCommandDecoration = class TerminalCommandDecoration extends Disposable {
    constructor(_options, _hoverService) {
        super();
        this._options = _options;
        this._hoverService = _hoverService;
        const decorationElements = h('span.chat-terminal-command-decoration@decoration', { role: 'img', tabIndex: 0 });
        this._element = decorationElements.decoration;
        this._attachElementToContainer();
    }
    _attachElementToContainer() {
        const container = this._options.getCommandBlock();
        if (!container) {
            return;
        }
        const decoration = this._element;
        if (!decoration.isConnected || decoration.parentElement !== container) {
            const icon = this._options.getIconElement();
            if (icon && icon.parentElement === container) {
                icon.insertAdjacentElement('afterend', decoration);
            }
            else {
                container.insertBefore(decoration, container.firstElementChild ?? null);
            }
        }
        this._register(this._hoverService.setupDelayedHover(decoration, () => ({
            content: this._getHoverText()
        })));
        this._attachInteractionHandlers(decoration);
    }
    _getHoverText() {
        const command = this._options.getResolvedCommand();
        const storedState = this._options.terminalData.terminalCommandState;
        return getTerminalCommandDecorationTooltip(command, storedState) || '';
    }
    update(command) {
        this._attachElementToContainer();
        const decoration = this._element;
        const resolvedCommand = command ?? this._options.getResolvedCommand();
        this._apply(decoration, resolvedCommand);
    }
    _apply(decoration, command) {
        const terminalData = this._options.terminalData;
        let storedState = terminalData.terminalCommandState;
        if (command) {
            const existingState = terminalData.terminalCommandState ?? {};
            terminalData.terminalCommandState = {
                ...existingState,
                exitCode: command.exitCode,
                timestamp: command.timestamp ?? existingState.timestamp,
                duration: command.duration ?? existingState.duration
            };
            storedState = terminalData.terminalCommandState;
        }
        else if (!storedState) {
            const now = Date.now();
            terminalData.terminalCommandState = { exitCode: undefined, timestamp: now };
            storedState = terminalData.terminalCommandState;
        }
        const decorationState = getTerminalCommandDecorationState(command, storedState);
        const tooltip = getTerminalCommandDecorationTooltip(command, storedState);
        decoration.className = `chat-terminal-command-decoration ${"terminal-command-decoration" /* DecorationSelector.CommandDecoration */}`;
        decoration.classList.add("codicon" /* DecorationSelector.Codicon */);
        for (const className of decorationState.classNames) {
            decoration.classList.add(className);
        }
        decoration.classList.add(...ThemeIcon.asClassNameArray(decorationState.icon));
        const isInteractive = !decoration.classList.contains("default" /* DecorationSelector.Default */);
        decoration.tabIndex = isInteractive ? 0 : -1;
        if (isInteractive) {
            decoration.removeAttribute('aria-disabled');
        }
        else {
            decoration.setAttribute('aria-disabled', 'true');
        }
        const hoverText = tooltip || decorationState.hoverMessage;
        if (hoverText) {
            decoration.setAttribute('aria-label', hoverText);
        }
        else {
            decoration.removeAttribute('aria-label');
        }
    }
    _attachInteractionHandlers(decoration) {
        if (this._interactionElement === decoration) {
            return;
        }
        this._interactionElement = decoration;
    }
};
TerminalCommandDecoration = __decorate([
    __param(1, IHoverService)
], TerminalCommandDecoration);
let ChatTerminalToolProgressPart = class ChatTerminalToolProgressPart extends BaseChatToolInvocationSubPart {
    get codeblocks() {
        return this.markdownPart?.codeblocks ?? [];
    }
    get elementIndex() {
        return this._elementIndex;
    }
    get contentIndex() {
        return this._contentIndex;
    }
    constructor(toolInvocation, terminalData, context, renderer, editorPool, currentWidthDelegate, codeBlockStartIndex, codeBlockModelCollection, _instantiationService, _terminalChatService, _terminalService, _contextKeyService, _chatWidgetService, _keybindingService) {
        super(toolInvocation);
        this._instantiationService = _instantiationService;
        this._terminalChatService = _terminalChatService;
        this._terminalService = _terminalService;
        this._contextKeyService = _contextKeyService;
        this._chatWidgetService = _chatWidgetService;
        this._keybindingService = _keybindingService;
        this._showOutputAction = this._register(new MutableDisposable());
        this._showOutputActionAdded = false;
        this._focusAction = this._register(new MutableDisposable());
        this._elementIndex = context.elementIndex;
        this._contentIndex = context.contentIndex;
        this._sessionResource = context.element.sessionResource;
        terminalData = migrateLegacyTerminalToolSpecificData(terminalData);
        this._terminalData = terminalData;
        this._terminalCommandUri = terminalData.terminalCommandUri ? URI.revive(terminalData.terminalCommandUri) : undefined;
        this._storedCommandId = this._terminalCommandUri ? new URLSearchParams(this._terminalCommandUri.query ?? '').get('command') ?? undefined : undefined;
        this._isSerializedInvocation = (toolInvocation.kind === 'toolInvocationSerialized');
        const elements = h('.chat-terminal-content-part@container', [
            h('.chat-terminal-content-title@title', [
                h('.chat-terminal-command-block@commandBlock')
            ]),
            h('.chat-terminal-content-message@message')
        ]);
        const command = terminalData.commandLine.userEdited ?? terminalData.commandLine.toolEdited ?? terminalData.commandLine.original;
        this._terminalOutputContextKey = ChatContextKeys.inChatTerminalToolOutput.bindTo(this._contextKeyService);
        this._decoration = this._register(this._instantiationService.createInstance(TerminalCommandDecoration, {
            terminalData: this._terminalData,
            getCommandBlock: () => elements.commandBlock,
            getIconElement: () => undefined,
            getResolvedCommand: () => this._getResolvedCommand()
        }));
        const titlePart = this._register(_instantiationService.createInstance(ChatQueryTitlePart, elements.commandBlock, new MarkdownString([
            `\`\`\`${terminalData.language}`,
            `${command.replaceAll('```', '\\`\\`\\`')}`,
            `\`\`\``
        ].join('\n'), { supportThemeIcons: true }), undefined));
        this._register(titlePart.onDidChangeHeight(() => {
            this._decoration.update();
            this._onDidChangeHeight.fire();
        }));
        this._outputView = this._register(this._instantiationService.createInstance(ChatTerminalToolOutputSection, () => this._onDidChangeHeight.fire(), () => this._ensureTerminalInstance(), () => this._getResolvedCommand()));
        elements.container.append(this._outputView.domNode);
        this._register(this._outputView.onDidFocus(() => this._handleOutputFocus()));
        this._register(this._outputView.onDidBlur(e => this._handleOutputBlur(e)));
        this._register(toDisposable(() => this._handleDispose()));
        this._register(this._keybindingService.onDidUpdateKeybindings(() => {
            this._focusAction.value?.refreshKeybindingTooltip();
            this._showOutputAction.value?.refreshKeybindingTooltip();
        }));
        const actionBarEl = h('.chat-terminal-action-bar@actionBar');
        elements.title.append(actionBarEl.root);
        this._actionBar = this._register(new ActionBar(actionBarEl.actionBar, {}));
        this._initializeTerminalActions();
        this._terminalService.whenConnected.then(() => this._initializeTerminalActions());
        let pastTenseMessage;
        if (toolInvocation.pastTenseMessage) {
            pastTenseMessage = `${typeof toolInvocation.pastTenseMessage === 'string' ? toolInvocation.pastTenseMessage : toolInvocation.pastTenseMessage.value}`;
        }
        const markdownContent = new MarkdownString(pastTenseMessage, {
            supportThemeIcons: true,
            isTrusted: isMarkdownString(toolInvocation.pastTenseMessage) ? toolInvocation.pastTenseMessage.isTrusted : false,
        });
        const chatMarkdownContent = {
            kind: 'markdownContent',
            content: markdownContent,
        };
        const codeBlockRenderOptions = {
            hideToolbar: true,
            reserveWidth: 19,
            verticalPadding: 5,
            editorOptions: {
                wordWrap: 'on'
            }
        };
        const markdownOptions = {
            codeBlockRenderOptions,
            accessibilityOptions: pastTenseMessage ? {
                statusMessage: localize('terminalToolCommand', '{0}', stripIcons(pastTenseMessage))
            } : undefined
        };
        this.markdownPart = this._register(_instantiationService.createInstance(ChatMarkdownContentPart, chatMarkdownContent, context, editorPool, false, codeBlockStartIndex, renderer, {}, currentWidthDelegate(), codeBlockModelCollection, markdownOptions));
        this._register(this.markdownPart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
        elements.message.append(this.markdownPart.domNode);
        const progressPart = this._register(_instantiationService.createInstance(ChatProgressSubPart, elements.container, this.getIcon(), terminalData.autoApproveInfo));
        this.domNode = progressPart.domNode;
        this._decoration.update();
        if (expandedStateByInvocation.get(toolInvocation)) {
            void this._toggleOutput(true);
        }
        this._register(this._terminalChatService.registerProgressPart(this));
    }
    async _initializeTerminalActions() {
        if (this._store.isDisposed) {
            return;
        }
        const terminalToolSessionId = this._terminalData.terminalToolSessionId;
        if (!terminalToolSessionId) {
            this._addActions();
            return;
        }
        const attachInstance = async (instance) => {
            if (this._store.isDisposed) {
                return;
            }
            if (!instance) {
                if (this._isSerializedInvocation) {
                    this._clearCommandAssociation();
                }
                this._addActions(undefined, terminalToolSessionId);
                return;
            }
            const isNewInstance = this._terminalInstance !== instance;
            if (isNewInstance) {
                this._terminalInstance = instance;
                this._registerInstanceListener(instance);
            }
            // Always call _addActions to ensure actions are added, even if instance was set earlier
            // (e.g., by the output view during expanded state restoration)
            this._addActions(instance, terminalToolSessionId);
        };
        const initialInstance = await this._terminalChatService.getTerminalInstanceByToolSessionId(terminalToolSessionId);
        await attachInstance(initialInstance);
        if (!initialInstance) {
            this._addActions(undefined, terminalToolSessionId);
        }
        if (this._store.isDisposed) {
            return;
        }
        if (!this._terminalSessionRegistration) {
            const listener = this._terminalChatService.onDidRegisterTerminalInstanceWithToolSession(async (instance) => {
                const registeredInstance = await this._terminalChatService.getTerminalInstanceByToolSessionId(terminalToolSessionId);
                if (instance !== registeredInstance) {
                    return;
                }
                this._terminalSessionRegistration?.dispose();
                this._terminalSessionRegistration = undefined;
                await attachInstance(instance);
            });
            this._terminalSessionRegistration = this._store.add(listener);
        }
    }
    _addActions(terminalInstance, terminalToolSessionId) {
        if (this._store.isDisposed) {
            return;
        }
        const actionBar = this._actionBar;
        this._removeFocusAction();
        const resolvedCommand = this._getResolvedCommand(terminalInstance);
        if (terminalInstance) {
            const isTerminalHidden = terminalInstance && terminalToolSessionId ? this._terminalChatService.isBackgroundTerminal(terminalToolSessionId) : false;
            const focusAction = this._instantiationService.createInstance(FocusChatInstanceAction, terminalInstance, resolvedCommand, this._terminalCommandUri, this._storedCommandId, isTerminalHidden);
            this._focusAction.value = focusAction;
            actionBar.push(focusAction, { icon: true, label: false, index: 0 });
        }
        this._ensureShowOutputAction(resolvedCommand);
        this._decoration.update(resolvedCommand);
    }
    _getResolvedCommand(instance) {
        const target = instance ?? this._terminalInstance;
        if (!target) {
            return undefined;
        }
        return this._resolveCommand(target);
    }
    _ensureShowOutputAction(command) {
        if (this._store.isDisposed) {
            return;
        }
        let resolvedCommand = command;
        if (!resolvedCommand) {
            resolvedCommand = this._getResolvedCommand();
        }
        if (!resolvedCommand) {
            return;
        }
        let showOutputAction = this._showOutputAction.value;
        if (!showOutputAction) {
            showOutputAction = this._instantiationService.createInstance(ToggleChatTerminalOutputAction, () => this._toggleOutputFromAction());
            this._showOutputAction.value = showOutputAction;
            if (resolvedCommand?.exitCode) {
                this._toggleOutput(true);
            }
        }
        showOutputAction.syncPresentation(this._outputView.isExpanded);
        const actionBar = this._actionBar;
        if (this._showOutputActionAdded) {
            const existingIndex = actionBar.viewItems.findIndex(item => item.action === showOutputAction);
            if (existingIndex >= 0 && existingIndex !== actionBar.length() - 1) {
                actionBar.pull(existingIndex);
                this._showOutputActionAdded = false;
            }
            else if (existingIndex >= 0) {
                return;
            }
        }
        if (this._showOutputActionAdded) {
            return;
        }
        actionBar.push([showOutputAction], { icon: true, label: false });
        this._showOutputActionAdded = true;
    }
    _clearCommandAssociation() {
        this._terminalCommandUri = undefined;
        this._storedCommandId = undefined;
        if (this._terminalData.terminalCommandUri) {
            delete this._terminalData.terminalCommandUri;
        }
        if (this._terminalData.terminalToolSessionId) {
            delete this._terminalData.terminalToolSessionId;
        }
        this._decoration.update();
    }
    _registerInstanceListener(terminalInstance) {
        const commandDetectionListener = this._register(new MutableDisposable());
        const tryResolveCommand = async () => {
            const resolvedCommand = this._resolveCommand(terminalInstance);
            this._addActions(terminalInstance, this._terminalData.terminalToolSessionId);
            return resolvedCommand;
        };
        const attachCommandDetection = async (commandDetection) => {
            commandDetectionListener.clear();
            if (!commandDetection) {
                await tryResolveCommand();
                return;
            }
            commandDetectionListener.value = commandDetection.onCommandFinished(() => {
                this._addActions(terminalInstance, this._terminalData.terminalToolSessionId);
                commandDetectionListener.clear();
            });
            const resolvedImmediately = await tryResolveCommand();
            if (resolvedImmediately?.endMarker) {
                return;
            }
        };
        attachCommandDetection(terminalInstance.capabilities.get(2 /* TerminalCapability.CommandDetection */));
        this._register(terminalInstance.capabilities.onDidAddCommandDetectionCapability(cd => attachCommandDetection(cd)));
        const instanceListener = this._register(terminalInstance.onDisposed(() => {
            if (this._terminalInstance === terminalInstance) {
                this._terminalInstance = undefined;
            }
            this._clearCommandAssociation();
            commandDetectionListener.clear();
            if (!this._store.isDisposed) {
                this._actionBar.clear();
            }
            this._removeFocusAction();
            this._showOutputActionAdded = false;
            this._showOutputAction.clear();
            this._addActions(undefined, this._terminalData.terminalToolSessionId);
            instanceListener.dispose();
        }));
    }
    _removeFocusAction() {
        if (this._store.isDisposed) {
            return;
        }
        const actionBar = this._actionBar;
        const focusAction = this._focusAction.value;
        if (actionBar && focusAction) {
            const existingIndex = actionBar.viewItems.findIndex(item => item.action === focusAction);
            if (existingIndex >= 0) {
                actionBar.pull(existingIndex);
            }
        }
        this._focusAction.clear();
    }
    async _toggleOutput(expanded) {
        const didChange = await this._outputView.toggle(expanded);
        this._showOutputAction.value?.syncPresentation(this._outputView.isExpanded);
        if (didChange) {
            expandedStateByInvocation.set(this.toolInvocation, this._outputView.isExpanded);
        }
        return didChange;
    }
    async _ensureTerminalInstance() {
        if (!this._terminalInstance && this._terminalData.terminalToolSessionId) {
            this._terminalInstance = await this._terminalChatService.getTerminalInstanceByToolSessionId(this._terminalData.terminalToolSessionId);
        }
        return this._terminalInstance;
    }
    _handleOutputFocus() {
        this._terminalOutputContextKey.set(true);
        this._terminalChatService.setFocusedProgressPart(this);
        this._outputView.updateAriaLabel();
    }
    _handleOutputBlur(event) {
        const nextTarget = event.relatedTarget;
        if (this._outputView.containsElement(nextTarget)) {
            return;
        }
        this._terminalOutputContextKey.reset();
        this._terminalChatService.clearFocusedProgressPart(this);
    }
    _handleDispose() {
        this._terminalOutputContextKey.reset();
        this._terminalChatService.clearFocusedProgressPart(this);
    }
    getCommandAndOutputAsText() {
        return this._outputView.getCommandAndOutputAsText();
    }
    focusOutput() {
        this._outputView.focus();
    }
    _focusChatInput() {
        const widget = this._chatWidgetService.getWidgetBySessionResource(this._sessionResource);
        widget?.focusInput();
    }
    async focusTerminal() {
        if (this._focusAction.value) {
            await this._focusAction.value.run();
            return;
        }
        if (this._terminalCommandUri) {
            this._terminalService.openResource(this._terminalCommandUri);
        }
    }
    async toggleOutputFromKeyboard() {
        if (!this._outputView.isExpanded) {
            await this._toggleOutput(true);
            this.focusOutput();
            return;
        }
        await this._collapseOutputAndFocusInput();
    }
    async _toggleOutputFromAction() {
        if (!this._outputView.isExpanded) {
            await this._toggleOutput(true);
            return;
        }
        await this._toggleOutput(false);
    }
    async _collapseOutputAndFocusInput() {
        if (this._outputView.isExpanded) {
            await this._toggleOutput(false);
        }
        this._focusChatInput();
    }
    _resolveCommand(instance) {
        const commandDetection = instance.capabilities.get(2 /* TerminalCapability.CommandDetection */);
        const commands = commandDetection?.commands;
        if (!commands || commands.length === 0) {
            return undefined;
        }
        return commands.find(c => c.id === this._terminalData.terminalCommandId);
    }
};
ChatTerminalToolProgressPart = __decorate([
    __param(8, IInstantiationService),
    __param(9, ITerminalChatService),
    __param(10, ITerminalService),
    __param(11, IContextKeyService),
    __param(12, IChatWidgetService),
    __param(13, IKeybindingService)
], ChatTerminalToolProgressPart);
export { ChatTerminalToolProgressPart };
let ChatTerminalToolOutputSection = class ChatTerminalToolOutputSection extends Disposable {
    get isExpanded() {
        return this.domNode.classList.contains('expanded');
    }
    get onDidFocus() { return this._onDidFocusEmitter.event; }
    get onDidBlur() { return this._onDidBlurEmitter.event; }
    constructor(_onDidChangeHeight, _ensureTerminalInstance, _resolveCommand, _accessibleViewService, _instantiationService, _terminalConfigurationService) {
        super();
        this._onDidChangeHeight = _onDidChangeHeight;
        this._ensureTerminalInstance = _ensureTerminalInstance;
        this._resolveCommand = _resolveCommand;
        this._accessibleViewService = _accessibleViewService;
        this._instantiationService = _instantiationService;
        this._terminalConfigurationService = _terminalConfigurationService;
        this._onDidFocusEmitter = this._register(new Emitter());
        this._onDidBlurEmitter = this._register(new Emitter());
        const containerElements = h('.chat-terminal-output-container@container', [
            h('.chat-terminal-output-body@body', [
                h('.chat-terminal-output-content@content', [
                    h('.chat-terminal-output-terminal@terminal'),
                    h('.chat-terminal-output-empty@empty')
                ])
            ])
        ]);
        this.domNode = containerElements.container;
        this.domNode.classList.add('collapsed');
        this._outputBody = containerElements.body;
        this._contentContainer = containerElements.content;
        this._terminalContainer = containerElements.terminal;
        this._emptyElement = containerElements.empty;
        this._contentContainer.appendChild(this._emptyElement);
        this._register(dom.addDisposableListener(this.domNode, dom.EventType.FOCUS_IN, () => this._onDidFocusEmitter.fire()));
        this._register(dom.addDisposableListener(this.domNode, dom.EventType.FOCUS_OUT, event => this._onDidBlurEmitter.fire(event)));
    }
    async toggle(expanded) {
        const currentlyExpanded = this.isExpanded;
        if (expanded === currentlyExpanded) {
            if (expanded) {
                await this._updateTerminalContent();
            }
            return false;
        }
        this._setExpanded(expanded);
        if (!expanded) {
            this._renderedOutputHeight = undefined;
            this._onDidChangeHeight();
            return true;
        }
        if (!this._scrollableContainer) {
            await this._createScrollableContainer();
        }
        await this._updateTerminalContent();
        this._layoutOutput();
        this._scrollOutputToBottom();
        this._scheduleOutputRelayout();
        return true;
    }
    focus() {
        this._scrollableContainer?.getDomNode().focus();
    }
    containsElement(element) {
        return !!element && this.domNode.contains(element);
    }
    updateAriaLabel() {
        if (!this._scrollableContainer) {
            return;
        }
        const command = this._resolveCommand();
        if (!command) {
            return;
        }
        const ariaLabel = localize('chatTerminalOutputAriaLabel', 'Terminal output for {0}', command.command);
        const scrollableDomNode = this._scrollableContainer.getDomNode();
        scrollableDomNode.setAttribute('role', 'region');
        const accessibleViewHint = this._accessibleViewService.getOpenAriaHint("accessibility.verbosity.terminalChatOutput" /* AccessibilityVerbositySettingId.TerminalChatOutput */);
        const label = accessibleViewHint
            ? ariaLabel + ', ' + accessibleViewHint
            : ariaLabel;
        scrollableDomNode.setAttribute('aria-label', label);
    }
    getCommandAndOutputAsText() {
        const command = this._resolveCommand();
        if (!command) {
            return undefined;
        }
        const commandHeader = localize('chatTerminalOutputAccessibleViewHeader', 'Command: {0}', command.command);
        if (!command) {
            return commandHeader;
        }
        const rawOutput = command.getOutput();
        if (!rawOutput || rawOutput.trim().length === 0) {
            return `${commandHeader}\n${localize('chat.terminalOutputEmpty', 'No output was produced by the command.')}`;
        }
        const lines = rawOutput.split('\n');
        return `${commandHeader}\n${lines.join('\n').trimEnd()}`;
    }
    _setExpanded(expanded) {
        this.domNode.classList.toggle('expanded', expanded);
        this.domNode.classList.toggle('collapsed', !expanded);
    }
    async _createScrollableContainer() {
        this._scrollableContainer = this._register(new DomScrollableElement(this._outputBody, {
            vertical: 2 /* ScrollbarVisibility.Hidden */,
            horizontal: 1 /* ScrollbarVisibility.Auto */,
            handleMouseWheel: true
        }));
        const scrollableDomNode = this._scrollableContainer.getDomNode();
        scrollableDomNode.tabIndex = 0;
        const rowHeight = this._computeRowHeightPx();
        const padding = this._getOutputPadding();
        const maxHeight = rowHeight * MAX_OUTPUT_ROWS + padding;
        scrollableDomNode.style.maxHeight = `${maxHeight}px`;
        this.domNode.appendChild(scrollableDomNode);
        this.updateAriaLabel();
    }
    async _updateTerminalContent() {
        const terminalInstance = await this._ensureTerminalInstance();
        if (!terminalInstance) {
            this._showEmptyMessage(localize('chat.terminalOutputTerminalMissing', 'Terminal is no longer available.'));
            return;
        }
        const command = this._resolveCommand();
        if (!command) {
            this._showEmptyMessage(localize('chat.terminalOutputCommandMissing', 'Command information is not available.'));
            return;
        }
        if (!this._mirror) {
            await terminalInstance.xtermReadyPromise;
            this._mirror = this._register(this._instantiationService.createInstance(DetachedTerminalCommandMirror, terminalInstance.xterm, command));
        }
        await this._mirror.attach(this._terminalContainer);
        const result = await this._mirror.renderCommand();
        if (!result) {
            this._showEmptyMessage(localize('chat.terminalOutputPending', 'Command output will appear here once available.'));
            return;
        }
        if (result.lineCount === 0) {
            this._showEmptyMessage(localize('chat.terminalOutputEmpty', 'No output was produced by the command.'));
        }
        else {
            this._hideEmptyMessage();
        }
        this._layoutOutput(result.lineCount);
    }
    _showEmptyMessage(message) {
        this._emptyElement.textContent = message;
        this._terminalContainer.classList.add('chat-terminal-output-terminal-no-output');
    }
    _hideEmptyMessage() {
        this._emptyElement.textContent = '';
        this._terminalContainer.classList.remove('chat-terminal-output-terminal-no-output');
    }
    _scheduleOutputRelayout() {
        dom.getActiveWindow().requestAnimationFrame(() => {
            this._layoutOutput();
            this._scrollOutputToBottom();
        });
    }
    _layoutOutput(lineCount) {
        if (!this._scrollableContainer || !this.isExpanded || !lineCount) {
            return;
        }
        const scrollableDomNode = this._scrollableContainer.getDomNode();
        const rowHeight = this._computeRowHeightPx();
        const padding = this._getOutputPadding();
        const minHeight = rowHeight * MIN_OUTPUT_ROWS + padding;
        const maxHeight = rowHeight * MAX_OUTPUT_ROWS + padding;
        const contentHeight = this._getOutputContentHeight(lineCount, rowHeight, padding);
        const clampedHeight = Math.min(contentHeight, maxHeight);
        const measuredBodyHeight = Math.max(this._outputBody.clientHeight, minHeight);
        const appliedHeight = Math.min(clampedHeight, measuredBodyHeight);
        scrollableDomNode.style.maxHeight = `${maxHeight}px`;
        scrollableDomNode.style.height = `${appliedHeight}px`;
        this._scrollableContainer.scanDomNode();
        if (this._renderedOutputHeight !== appliedHeight) {
            this._renderedOutputHeight = appliedHeight;
            this._onDidChangeHeight();
        }
    }
    _scrollOutputToBottom() {
        if (!this._scrollableContainer) {
            return;
        }
        const dimensions = this._scrollableContainer.getScrollDimensions();
        this._scrollableContainer.setScrollPosition({ scrollTop: dimensions.scrollHeight });
    }
    _getOutputContentHeight(lineCount, rowHeight, padding) {
        const contentRows = Math.max(lineCount, MIN_OUTPUT_ROWS);
        return (contentRows * rowHeight) + padding;
    }
    _getOutputPadding() {
        const style = dom.getComputedStyle(this._outputBody);
        const paddingTop = Number.parseFloat(style.paddingTop || '0');
        const paddingBottom = Number.parseFloat(style.paddingBottom || '0');
        return paddingTop + paddingBottom;
    }
    _computeRowHeightPx() {
        const window = dom.getActiveWindow();
        const font = this._terminalConfigurationService.getFont(window);
        const hasCharHeight = isNumber(font.charHeight) && font.charHeight > 0;
        const hasFontSize = isNumber(font.fontSize) && font.fontSize > 0;
        const hasLineHeight = isNumber(font.lineHeight) && font.lineHeight > 0;
        const charHeight = (hasCharHeight ? font.charHeight : (hasFontSize ? font.fontSize : 1)) ?? 1;
        const lineHeight = hasLineHeight ? font.lineHeight : 1;
        const rowHeight = Math.ceil(charHeight * lineHeight);
        return Math.max(rowHeight, 1);
    }
};
ChatTerminalToolOutputSection = __decorate([
    __param(3, IAccessibleViewService),
    __param(4, IInstantiationService),
    __param(5, ITerminalConfigurationService)
], ChatTerminalToolOutputSection);
let ToggleChatTerminalOutputAction = class ToggleChatTerminalOutputAction extends Action {
    constructor(_toggle, _keybindingService, _telemetryService) {
        super("workbench.action.terminal.chat.toggleChatTerminalOutput" /* TerminalContribCommandId.ToggleChatTerminalOutput */, localize('showTerminalOutput', 'Show Output'), ThemeIcon.asClassName(Codicon.chevronRight), true);
        this._toggle = _toggle;
        this._keybindingService = _keybindingService;
        this._telemetryService = _telemetryService;
        this._expanded = false;
        this._updateTooltip();
    }
    async run() {
        this._telemetryService.publicLog2('terminal/chatToggleOutput', {
            previousExpanded: this._expanded
        });
        await this._toggle();
    }
    syncPresentation(expanded) {
        this._expanded = expanded;
        this._updatePresentation();
        this._updateTooltip();
    }
    refreshKeybindingTooltip() {
        this._updateTooltip();
    }
    _updatePresentation() {
        if (this._expanded) {
            this.label = localize('hideTerminalOutput', 'Hide Output');
            this.class = ThemeIcon.asClassName(Codicon.chevronDown);
        }
        else {
            this.label = localize('showTerminalOutput', 'Show Output');
            this.class = ThemeIcon.asClassName(Codicon.chevronRight);
        }
    }
    _updateTooltip() {
        const keybinding = this._keybindingService.lookupKeybinding("workbench.action.terminal.chat.focusMostRecentChatTerminalOutput" /* TerminalContribCommandId.FocusMostRecentChatTerminalOutput */);
        const label = keybinding?.getLabel();
        this.tooltip = label ? `${this.label} (${label})` : this.label;
    }
};
ToggleChatTerminalOutputAction = __decorate([
    __param(1, IKeybindingService),
    __param(2, ITelemetryService)
], ToggleChatTerminalOutputAction);
export { ToggleChatTerminalOutputAction };
let FocusChatInstanceAction = class FocusChatInstanceAction extends Action {
    constructor(_instance, _command, _commandUri, _commandId, isTerminalHidden, _terminalService, _terminalEditorService, _terminalGroupService, _keybindingService, _telemetryService) {
        super("workbench.action.terminal.chat.focusChatInstance" /* TerminalContribCommandId.FocusChatInstanceAction */, isTerminalHidden ? localize('showTerminal', 'Show and Focus Terminal') : localize('focusTerminal', 'Focus Terminal'), ThemeIcon.asClassName(Codicon.openInProduct), true);
        this._instance = _instance;
        this._command = _command;
        this._commandUri = _commandUri;
        this._commandId = _commandId;
        this._terminalService = _terminalService;
        this._terminalEditorService = _terminalEditorService;
        this._terminalGroupService = _terminalGroupService;
        this._keybindingService = _keybindingService;
        this._telemetryService = _telemetryService;
        this._updateTooltip();
    }
    async run() {
        this.label = localize('focusTerminal', 'Focus Terminal');
        this._updateTooltip();
        let target = 'none';
        let location = 'panel';
        if (this._instance) {
            target = 'instance';
            location = this._instance.target === TerminalLocation.Editor ? 'editor' : 'panel';
        }
        else if (this._commandUri) {
            target = 'commandUri';
        }
        this._telemetryService.publicLog2('terminal/chatFocusInstance', {
            target,
            location
        });
        if (this._instance) {
            this._terminalService.setActiveInstance(this._instance);
            if (this._instance.target === TerminalLocation.Editor) {
                this._terminalEditorService.openEditor(this._instance);
            }
            else {
                await this._terminalGroupService.showPanel(true);
            }
            this._terminalService.setActiveInstance(this._instance);
            await this._instance.focusWhenReady(true);
            const command = this._resolveCommand();
            if (command) {
                this._instance.xterm?.markTracker.revealCommand(command);
            }
            return;
        }
        if (this._commandUri) {
            this._terminalService.openResource(this._commandUri);
        }
    }
    refreshKeybindingTooltip() {
        this._updateTooltip();
    }
    _resolveCommand() {
        if (this._command && !this._command.endMarker?.isDisposed) {
            return this._command;
        }
        if (!this._instance || !this._commandId) {
            return this._command;
        }
        const commandDetection = this._instance.capabilities.get(2 /* TerminalCapability.CommandDetection */);
        const resolved = commandDetection?.commands.find(c => c.id === this._commandId);
        if (resolved) {
            this._command = resolved;
        }
        return this._command;
    }
    _updateTooltip() {
        const keybinding = this._keybindingService.lookupKeybinding("workbench.action.terminal.chat.focusMostRecentChatTerminal" /* TerminalContribCommandId.FocusMostRecentChatTerminal */);
        const label = keybinding?.getLabel();
        this.tooltip = label ? `${this.label} (${label})` : this.label;
    }
};
FocusChatInstanceAction = __decorate([
    __param(5, ITerminalService),
    __param(6, ITerminalEditorService),
    __param(7, ITerminalGroupService),
    __param(8, IKeybindingService),
    __param(9, ITelemetryService)
], FocusChatInstanceAction);
export { FocusChatInstanceAction };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRlcm1pbmFsVG9vbFByb2dyZXNzUGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy90b29sSW52b2NhdGlvblBhcnRzL2NoYXRUZXJtaW5hbFRvb2xQcm9ncmVzc1BhcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQzFELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUNyRixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDaEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDekcsT0FBTyxFQUFFLHFDQUFxQyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFHaEYsT0FBTyxFQUFzQixrQkFBa0IsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUN2RSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUVsRSxPQUFPLEVBQUUsdUJBQXVCLEVBQXdDLE1BQU0sK0JBQStCLENBQUM7QUFDOUcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDcEUsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDL0UsT0FBTywyQ0FBMkMsQ0FBQztBQUVuRCxPQUFPLEVBQUUsTUFBTSxFQUFXLE1BQU0sMENBQTBDLENBQUM7QUFDM0UsT0FBTyxFQUFpQyxvQkFBb0IsRUFBRSw2QkFBNkIsRUFBRSxzQkFBc0IsRUFBRSxxQkFBcUIsRUFBcUIsZ0JBQWdCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNsTyxPQUFPLEVBQUUsVUFB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