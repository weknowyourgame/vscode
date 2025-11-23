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
import { Separator } from '../../../../../base/common/actions.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, DisposableMap, DisposableStore, dispose, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { INotificationService, Severity } from '../../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { terminalDecorationMark } from '../terminalIcons.js';
import { getTerminalCommandDecorationState, getTerminalDecorationHoverContent, updateLayout } from './decorationStyles.js';
import { TERMINAL_COMMAND_DECORATION_DEFAULT_BACKGROUND_COLOR, TERMINAL_COMMAND_DECORATION_ERROR_BACKGROUND_COLOR, TERMINAL_COMMAND_DECORATION_SUCCESS_BACKGROUND_COLOR } from '../../common/terminalColorRegistry.js';
import { ILifecycleService } from '../../../../services/lifecycle/common/lifecycle.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { IChatContextPickService } from '../../../chat/browser/chatContextPickService.js';
import { IChatWidgetService } from '../../../chat/browser/chat.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { TerminalContext } from '../../../chat/browser/actions/chatContext.js';
import { getTerminalUri, parseTerminalUri } from '../terminalUri.js';
import { ChatAgentLocation } from '../../../chat/common/constants.js';
import { isString } from '../../../../../base/common/types.js';
let DecorationAddon = class DecorationAddon extends Disposable {
    constructor(_resource, _capabilities, _clipboardService, _contextMenuService, _configurationService, _themeService, _openerService, _quickInputService, lifecycleService, _commandService, _accessibilitySignalService, _notificationService, _hoverService, _contextPickService, _chatWidgetService, _instantiationService) {
        super();
        this._resource = _resource;
        this._capabilities = _capabilities;
        this._clipboardService = _clipboardService;
        this._contextMenuService = _contextMenuService;
        this._configurationService = _configurationService;
        this._themeService = _themeService;
        this._openerService = _openerService;
        this._quickInputService = _quickInputService;
        this._commandService = _commandService;
        this._accessibilitySignalService = _accessibilitySignalService;
        this._notificationService = _notificationService;
        this._hoverService = _hoverService;
        this._contextPickService = _contextPickService;
        this._chatWidgetService = _chatWidgetService;
        this._instantiationService = _instantiationService;
        this._capabilityDisposables = this._register(new DisposableMap());
        this._decorations = new Map();
        this._registeredMenuItems = new Map();
        this._onDidRequestRunCommand = this._register(new Emitter());
        this.onDidRequestRunCommand = this._onDidRequestRunCommand.event;
        this._onDidRequestCopyAsHtml = this._register(new Emitter());
        this.onDidRequestCopyAsHtml = this._onDidRequestCopyAsHtml.event;
        this._register(toDisposable(() => this._dispose()));
        this._register(this._configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("terminal.integrated.fontSize" /* TerminalSettingId.FontSize */) || e.affectsConfiguration("terminal.integrated.lineHeight" /* TerminalSettingId.LineHeight */)) {
                this.refreshLayouts();
            }
            else if (e.affectsConfiguration('workbench.colorCustomizations')) {
                this._refreshStyles(true);
            }
            else if (e.affectsConfiguration("terminal.integrated.shellIntegration.decorationsEnabled" /* TerminalSettingId.ShellIntegrationDecorationsEnabled */)) {
                this._removeCapabilityDisposables(2 /* TerminalCapability.CommandDetection */);
                this._updateDecorationVisibility();
            }
        }));
        this._register(this._themeService.onDidColorThemeChange(() => this._refreshStyles(true)));
        this._updateDecorationVisibility();
        this._register(this._capabilities.onDidAddCapability(c => this._createCapabilityDisposables(c.id)));
        this._register(this._capabilities.onDidRemoveCapability(c => this._removeCapabilityDisposables(c.id)));
        this._register(lifecycleService.onWillShutdown(() => this._disposeAllDecorations()));
    }
    _createCapabilityDisposables(c) {
        const capability = this._capabilities.get(c);
        if (!capability || this._capabilityDisposables.has(c)) {
            return;
        }
        const store = new DisposableStore();
        switch (capability.type) {
            case 4 /* TerminalCapability.BufferMarkDetection */:
                store.add(capability.onMarkAdded(mark => this.registerMarkDecoration(mark)));
                break;
            case 2 /* TerminalCapability.CommandDetection */: {
                const disposables = this._getCommandDetectionListeners(capability);
                for (const d of disposables) {
                    store.add(d);
                }
                break;
            }
        }
        this._capabilityDisposables.set(c, store);
    }
    _removeCapabilityDisposables(c) {
        this._capabilityDisposables.deleteAndDispose(c);
    }
    registerMarkDecoration(mark) {
        if (!this._terminal || (!this._showGutterDecorations && !this._showOverviewRulerDecorations)) {
            return undefined;
        }
        if (mark.hidden) {
            return undefined;
        }
        return this.registerCommandDecoration(undefined, undefined, mark);
    }
    _updateDecorationVisibility() {
        const showDecorations = this._configurationService.getValue("terminal.integrated.shellIntegration.decorationsEnabled" /* TerminalSettingId.ShellIntegrationDecorationsEnabled */);
        this._showGutterDecorations = (showDecorations === 'both' || showDecorations === 'gutter');
        this._showOverviewRulerDecorations = (showDecorations === 'both' || showDecorations === 'overviewRuler');
        this._disposeAllDecorations();
        if (this._showGutterDecorations || this._showOverviewRulerDecorations) {
            this._attachToCommandCapability();
            this._updateGutterDecorationVisibility();
        }
        const currentCommand = this._capabilities.get(2 /* TerminalCapability.CommandDetection */)?.executingCommandObject;
        if (currentCommand) {
            this.registerCommandDecoration(currentCommand, true);
        }
    }
    _disposeAllDecorations() {
        this._placeholderDecoration?.dispose();
        for (const value of this._decorations.values()) {
            value.decoration.dispose();
            dispose(value.disposables);
        }
    }
    _updateGutterDecorationVisibility() {
        // eslint-disable-next-line no-restricted-syntax
        const commandDecorationElements = this._terminal?.element?.querySelectorAll("terminal-command-decoration" /* DecorationSelector.CommandDecoration */);
        if (commandDecorationElements) {
            for (const commandDecorationElement of commandDecorationElements) {
                this._updateCommandDecorationVisibility(commandDecorationElement);
            }
        }
    }
    _updateCommandDecorationVisibility(commandDecorationElement) {
        if (this._showGutterDecorations) {
            commandDecorationElement.classList.remove("hide" /* DecorationSelector.Hide */);
        }
        else {
            commandDecorationElement.classList.add("hide" /* DecorationSelector.Hide */);
        }
    }
    refreshLayouts() {
        updateLayout(this._configurationService, this._placeholderDecoration?.element);
        for (const decoration of this._decorations) {
            updateLayout(this._configurationService, decoration[1].decoration.element);
        }
    }
    _refreshStyles(refreshOverviewRulerColors) {
        if (refreshOverviewRulerColors) {
            for (const decoration of this._decorations.values()) {
                const color = this._getDecorationCssColor(decoration.command)?.toString() ?? '';
                if (decoration.decoration.options?.overviewRulerOptions) {
                    decoration.decoration.options.overviewRulerOptions.color = color;
                }
                else if (decoration.decoration.options) {
                    decoration.decoration.options.overviewRulerOptions = { color };
                }
            }
        }
        this._updateClasses(this._placeholderDecoration?.element);
        for (const decoration of this._decorations.values()) {
            this._updateClasses(decoration.decoration.element, decoration.command, decoration.markProperties);
        }
    }
    _dispose() {
        for (const disposable of this._capabilityDisposables.values()) {
            dispose(disposable);
        }
        this.clearDecorations();
    }
    _clearPlaceholder() {
        this._placeholderDecoration?.dispose();
        this._placeholderDecoration = undefined;
    }
    clearDecorations() {
        this._placeholderDecoration?.marker.dispose();
        this._clearPlaceholder();
        this._disposeAllDecorations();
        this._decorations.clear();
    }
    _attachToCommandCapability() {
        if (this._capabilities.has(2 /* TerminalCapability.CommandDetection */)) {
            const capability = this._capabilities.get(2 /* TerminalCapability.CommandDetection */);
            const disposables = this._getCommandDetectionListeners(capability);
            const store = new DisposableStore();
            for (const d of disposables) {
                store.add(d);
            }
            this._capabilityDisposables.set(2 /* TerminalCapability.CommandDetection */, store);
        }
    }
    _getCommandDetectionListeners(capability) {
        this._removeCapabilityDisposables(2 /* TerminalCapability.CommandDetection */);
        const commandDetectionListeners = [];
        // Command started
        if (capability.executingCommandObject?.marker) {
            this.registerCommandDecoration(capability.executingCommandObject, true);
        }
        commandDetectionListeners.push(capability.onCommandStarted(command => this.registerCommandDecoration(command, true)));
        // Command finished
        for (const command of capability.commands) {
            this.registerCommandDecoration(command);
        }
        commandDetectionListeners.push(capability.onCommandFinished(command => {
            const buffer = this._terminal?.buffer?.active;
            const marker = command.promptStartMarker;
            // Edge case: Handle case where tsc watch commands clears buffer, but decoration of that tsc command re-appears
            const shouldRegisterDecoration = (command.exitCode === undefined ||
                // Only register decoration if the cursor is at or below the promptStart marker.
                (buffer && marker && buffer.baseY + buffer.cursorY >= marker.line));
            if (shouldRegisterDecoration) {
                this.registerCommandDecoration(command);
            }
            if (command.exitCode) {
                this._accessibilitySignalService.playSignal(AccessibilitySignal.terminalCommandFailed);
            }
            else {
                this._accessibilitySignalService.playSignal(AccessibilitySignal.terminalCommandSucceeded);
            }
        }));
        // Command invalidated
        commandDetectionListeners.push(capability.onCommandInvalidated(commands => {
            for (const command of commands) {
                const id = command.marker?.id;
                if (id) {
                    const match = this._decorations.get(id);
                    if (match) {
                        match.decoration.dispose();
                        dispose(match.disposables);
                    }
                }
            }
        }));
        // Current command invalidated
        commandDetectionListeners.push(capability.onCurrentCommandInvalidated((request) => {
            if (request.reason === "noProblemsReported" /* CommandInvalidationReason.NoProblemsReported */) {
                const lastDecoration = Array.from(this._decorations.entries())[this._decorations.size - 1];
                lastDecoration?.[1].decoration.dispose();
            }
            else if (request.reason === "windows" /* CommandInvalidationReason.Windows */) {
                this._clearPlaceholder();
            }
        }));
        return commandDetectionListeners;
    }
    activate(terminal) {
        this._terminal = terminal;
        this._attachToCommandCapability();
    }
    registerCommandDecoration(command, beforeCommandExecution, markProperties) {
        if (!this._terminal || (beforeCommandExecution && !command) || (!this._showGutterDecorations && !this._showOverviewRulerDecorations)) {
            return undefined;
        }
        const marker = command?.marker || markProperties?.marker;
        if (!marker) {
            throw new Error(`cannot add a decoration for a command ${JSON.stringify(command)} with no marker`);
        }
        this._clearPlaceholder();
        const color = this._getDecorationCssColor(command)?.toString() ?? '';
        const decoration = this._terminal.registerDecoration({
            marker,
            overviewRulerOptions: this._showOverviewRulerDecorations ? (beforeCommandExecution
                ? { color, position: 'left' }
                : { color, position: command?.exitCode ? 'right' : 'left' }) : undefined
        });
        if (!decoration) {
            return undefined;
        }
        if (beforeCommandExecution) {
            this._placeholderDecoration = decoration;
        }
        decoration.onRender(element => {
            if (element.classList.contains(".xterm-decoration-overview-ruler" /* DecorationSelector.OverviewRuler */)) {
                return;
            }
            if (!this._decorations.get(decoration.marker.id)) {
                decoration.onDispose(() => this._decorations.delete(decoration.marker.id));
                this._decorations.set(decoration.marker.id, {
                    decoration,
                    disposables: this._createDisposables(element, command, markProperties),
                    command,
                    markProperties: command?.markProperties || markProperties
                });
            }
            if (!element.classList.contains("codicon" /* DecorationSelector.Codicon */) || command?.marker?.line === 0) {
                // first render or buffer was cleared
                updateLayout(this._configurationService, element);
                this._updateClasses(element, command, command?.markProperties || markProperties);
            }
        });
        return decoration;
    }
    registerMenuItems(command, items) {
        const existingItems = this._registeredMenuItems.get(command);
        if (existingItems) {
            existingItems.push(...items);
        }
        else {
            this._registeredMenuItems.set(command, [...items]);
        }
        return toDisposable(() => {
            const commandItems = this._registeredMenuItems.get(command);
            if (commandItems) {
                for (const item of items.values()) {
                    const index = commandItems.indexOf(item);
                    if (index !== -1) {
                        commandItems.splice(index, 1);
                    }
                }
            }
        });
    }
    _createDisposables(element, command, markProperties) {
        if (command?.exitCode === undefined && !command?.markProperties) {
            return [];
        }
        else if (command?.markProperties || markProperties) {
            return [this._createHover(element, command || markProperties, markProperties?.hoverMessage)];
        }
        return [...this._createContextMenu(element, command), this._createHover(element, command)];
    }
    _createHover(element, command, hoverMessage) {
        return this._hoverService.setupDelayedHover(element, () => ({
            content: new MarkdownString(getTerminalDecorationHoverContent(command, hoverMessage, true))
        }));
    }
    _updateClasses(element, command, markProperties) {
        if (!element) {
            return;
        }
        for (const classes of element.classList) {
            element.classList.remove(classes);
        }
        element.classList.add("terminal-command-decoration" /* DecorationSelector.CommandDecoration */, "codicon" /* DecorationSelector.Codicon */, "xterm-decoration" /* DecorationSelector.XtermDecoration */);
        if (markProperties) {
            element.classList.add("default-color" /* DecorationSelector.DefaultColor */, ...ThemeIcon.asClassNameArray(terminalDecorationMark));
            if (!markProperties.hoverMessage) {
                //disable the mouse pointer
                element.classList.add("default" /* DecorationSelector.Default */);
            }
        }
        else {
            // command decoration
            const state = getTerminalCommandDecorationState(command);
            this._updateCommandDecorationVisibility(element);
            for (const className of state.classNames) {
                element.classList.add(className);
            }
            element.classList.add(...ThemeIcon.asClassNameArray(state.icon));
        }
        element.removeAttribute('title');
        element.removeAttribute('aria-label');
    }
    _createContextMenu(element, command) {
        // When the xterm Decoration gets disposed of, its element gets removed from the dom
        // along with its listeners
        return [
            dom.addDisposableListener(element, dom.EventType.MOUSE_DOWN, async (e) => {
                e.stopImmediatePropagation();
            }),
            dom.addDisposableListener(element, dom.EventType.CLICK, async (e) => {
                e.stopImmediatePropagation();
                const actions = await this._getCommandActions(command);
                this._contextMenuService.showContextMenu({ getAnchor: () => element, getActions: () => actions });
            }),
            dom.addDisposableListener(element, dom.EventType.CONTEXT_MENU, async (e) => {
                e.stopImmediatePropagation();
                const chatActions = await this._getCommandActions(command);
                const actions = this._getContextMenuActions();
                this._contextMenuService.showContextMenu({ getAnchor: () => element, getActions: () => [...actions, ...chatActions] });
            }),
        ];
    }
    _getContextMenuActions() {
        const label = localize('workbench.action.terminal.toggleVisibility', "Toggle Visibility");
        return [
            {
                class: undefined, tooltip: label, id: 'terminal.toggleVisibility', label, enabled: true,
                run: async () => {
                    this._showToggleVisibilityQuickPick();
                }
            }
        ];
    }
    async _getCommandActions(command) {
        const actions = [];
        const registeredMenuItems = this._registeredMenuItems.get(command);
        if (registeredMenuItems?.length) {
            actions.push(...registeredMenuItems, new Separator());
        }
        const attachToChatAction = this._createAttachToChatAction(command);
        if (attachToChatAction) {
            actions.push(attachToChatAction, new Separator());
        }
        if (command.command !== '') {
            const labelRun = localize("terminal.rerunCommand", 'Rerun Command');
            actions.push({
                class: undefined, tooltip: labelRun, id: 'terminal.rerunCommand', label: labelRun, enabled: true,
                run: async () => {
                    if (command.command === '') {
                        return;
                    }
                    if (!command.isTrusted) {
                        const shouldRun = await new Promise(r => {
                            this._notificationService.prompt(Severity.Info, localize('rerun', 'Do you want to run the command: {0}', command.command), [{
                                    label: localize('yes', 'Yes'),
                                    run: () => r(true)
                                }, {
                                    label: localize('no', 'No'),
                                    run: () => r(false)
                                }]);
                        });
                        if (!shouldRun) {
                            return;
                        }
                    }
                    this._onDidRequestRunCommand.fire({ command });
                }
            });
            // The second section is the clipboard section
            actions.push(new Separator());
            const labelCopy = localize("terminal.copyCommand", 'Copy Command');
            actions.push({
                class: undefined, tooltip: labelCopy, id: 'terminal.copyCommand', label: labelCopy, enabled: true,
                run: () => this._clipboardService.writeText(command.command)
            });
        }
        if (command.hasOutput()) {
            const labelCopyCommandAndOutput = localize("terminal.copyCommandAndOutput", 'Copy Command and Output');
            actions.push({
                class: undefined, tooltip: labelCopyCommandAndOutput, id: 'terminal.copyCommandAndOutput', label: labelCopyCommandAndOutput, enabled: true,
                run: () => {
                    const output = command.getOutput();
                    if (isString(output)) {
                        this._clipboardService.writeText(`${command.command !== '' ? command.command + '\n' : ''}${output}`);
                    }
                }
            });
            const labelText = localize("terminal.copyOutput", 'Copy Output');
            actions.push({
                class: undefined, tooltip: labelText, id: 'terminal.copyOutput', label: labelText, enabled: true,
                run: () => {
                    const text = command.getOutput();
                    if (isString(text)) {
                        this._clipboardService.writeText(text);
                    }
                }
            });
            const labelHtml = localize("terminal.copyOutputAsHtml", 'Copy Output as HTML');
            actions.push({
                class: undefined, tooltip: labelHtml, id: 'terminal.copyOutputAsHtml', label: labelHtml, enabled: true,
                run: () => this._onDidRequestCopyAsHtml.fire({ command })
            });
        }
        if (actions.length > 0) {
            actions.push(new Separator());
        }
        const labelRunRecent = localize('workbench.action.terminal.runRecentCommand', "Run Recent Command");
        actions.push({
            class: undefined, tooltip: labelRunRecent, id: 'workbench.action.terminal.runRecentCommand', label: labelRunRecent, enabled: true,
            run: () => this._commandService.executeCommand('workbench.action.terminal.runRecentCommand')
        });
        const labelGoToRecent = localize('workbench.action.terminal.goToRecentDirectory', "Go To Recent Directory");
        actions.push({
            class: undefined, tooltip: labelRunRecent, id: 'workbench.action.terminal.goToRecentDirectory', label: labelGoToRecent, enabled: true,
            run: () => this._commandService.executeCommand('workbench.action.terminal.goToRecentDirectory')
        });
        actions.push(new Separator());
        const labelAbout = localize("terminal.learnShellIntegration", 'Learn About Shell Integration');
        actions.push({
            class: undefined, tooltip: labelAbout, id: 'terminal.learnShellIntegration', label: labelAbout, enabled: true,
            run: () => this._openerService.open('https://code.visualstudio.com/docs/terminal/shell-integration')
        });
        return actions;
    }
    _createAttachToChatAction(command) {
        const chatIsEnabled = this._chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Chat).some(w => w.attachmentCapabilities.supportsTerminalAttachments);
        if (!chatIsEnabled) {
            return undefined;
        }
        const labelAttachToChat = localize("terminal.attachToChat", 'Attach To Chat');
        return {
            class: undefined, tooltip: labelAttachToChat, id: 'terminal.attachToChat', label: labelAttachToChat, enabled: true,
            run: async () => {
                let widget = this._chatWidgetService.lastFocusedWidget ?? this._chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Chat)?.find(w => w.attachmentCapabilities.supportsTerminalAttachments);
                // If no widget found (e.g., after window reload when chat hasn't been focused), open chat view
                if (!widget) {
                    widget = await this._chatWidgetService.revealWidget();
                }
                if (!widget) {
                    return;
                }
                let terminalContext;
                if (this._resource) {
                    const parsedUri = parseTerminalUri(this._resource);
                    terminalContext = this._instantiationService.createInstance(TerminalContext, getTerminalUri(parsedUri.workspaceId, parsedUri.instanceId, undefined, command.id));
                }
                if (terminalContext && widget.attachmentCapabilities.supportsTerminalAttachments) {
                    try {
                        const attachment = await terminalContext.asAttachment(widget);
                        if (attachment) {
                            widget.attachmentModel.addContext(attachment);
                            widget.focusInput();
                            return;
                        }
                    }
                    catch (err) {
                    }
                    this._store.add(this._contextPickService.registerChatContextItem(terminalContext));
                }
            }
        };
    }
    _showToggleVisibilityQuickPick() {
        const quickPick = this._register(this._quickInputService.createQuickPick());
        quickPick.hideInput = true;
        quickPick.hideCheckAll = true;
        quickPick.canSelectMany = true;
        quickPick.title = localize('toggleVisibility', 'Toggle visibility');
        const configValue = this._configurationService.getValue("terminal.integrated.shellIntegration.decorationsEnabled" /* TerminalSettingId.ShellIntegrationDecorationsEnabled */);
        const gutterIcon = {
            label: localize('gutter', 'Gutter command decorations'),
            picked: configValue !== 'never' && configValue !== 'overviewRuler'
        };
        const overviewRulerIcon = {
            label: localize('overviewRuler', 'Overview ruler command decorations'),
            picked: configValue !== 'never' && configValue !== 'gutter'
        };
        quickPick.items = [gutterIcon, overviewRulerIcon];
        const selectedItems = [];
        if (configValue !== 'never') {
            if (configValue !== 'gutter') {
                selectedItems.push(gutterIcon);
            }
            if (configValue !== 'overviewRuler') {
                selectedItems.push(overviewRulerIcon);
            }
        }
        quickPick.selectedItems = selectedItems;
        this._register(quickPick.onDidChangeSelection(async (e) => {
            let newValue = 'never';
            if (e.includes(gutterIcon)) {
                if (e.includes(overviewRulerIcon)) {
                    newValue = 'both';
                }
                else {
                    newValue = 'gutter';
                }
            }
            else if (e.includes(overviewRulerIcon)) {
                newValue = 'overviewRuler';
            }
            await this._configurationService.updateValue("terminal.integrated.shellIntegration.decorationsEnabled" /* TerminalSettingId.ShellIntegrationDecorationsEnabled */, newValue);
        }));
        quickPick.ok = false;
        quickPick.show();
    }
    _getDecorationCssColor(command) {
        let colorId;
        if (command?.exitCode === undefined) {
            colorId = TERMINAL_COMMAND_DECORATION_DEFAULT_BACKGROUND_COLOR;
        }
        else {
            colorId = command.exitCode ? TERMINAL_COMMAND_DECORATION_ERROR_BACKGROUND_COLOR : TERMINAL_COMMAND_DECORATION_SUCCESS_BACKGROUND_COLOR;
        }
        return this._themeService.getColorTheme().getColor(colorId)?.toString();
    }
};
DecorationAddon = __decorate([
    __param(2, IClipboardService),
    __param(3, IContextMenuService),
    __param(4, IConfigurationService),
    __param(5, IThemeService),
    __param(6, IOpenerService),
    __param(7, IQuickInputService),
    __param(8, ILifecycleService),
    __param(9, ICommandService),
    __param(10, IAccessibilitySignalService),
    __param(11, INotificationService),
    __param(12, IHoverService),
    __param(13, IChatContextPickService),
    __param(14, IChatWidgetService),
    __param(15, IInstantiationService)
], DecorationAddon);
export { DecorationAddon };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjb3JhdGlvbkFkZG9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL2Jyb3dzZXIveHRlcm0vZGVjb3JhdGlvbkFkZG9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxFQUFXLFNBQVMsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQWUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3pJLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLG1CQUFtQixFQUFFLDJCQUEyQixFQUFFLE1BQU0sbUZBQW1GLENBQUM7QUFDckosT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sOERBQThELENBQUM7QUFDakcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxRQUFRLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUM3RyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0saURBQWlELENBQUM7QUFDakYsT0FBTyxFQUFFLGtCQUFrQixFQUFrQixNQUFNLHlEQUF5RCxDQUFDO0FBRzdHLE9BQU8sRUFBRSxh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