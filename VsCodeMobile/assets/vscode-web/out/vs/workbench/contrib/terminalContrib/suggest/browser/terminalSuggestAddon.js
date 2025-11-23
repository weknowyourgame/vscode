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
var SuggestAddon_1;
import * as dom from '../../../../../base/browser/dom.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { combinedDisposable, Disposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { sep } from '../../../../../base/common/path.js';
import { commonPrefixLength } from '../../../../../base/common/strings.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { terminalSuggestConfigSection } from '../common/terminalSuggestConfiguration.js';
import { LineContext } from '../../../../services/suggest/browser/simpleCompletionModel.js';
import { SimpleSuggestWidget } from '../../../../services/suggest/browser/simpleSuggestWidget.js';
import { ITerminalCompletionService } from './terminalCompletionService.js';
import { ITerminalLogService } from '../../../../../platform/terminal/common/terminal.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { createCancelablePromise, IntervalTimer, TimeoutTimer } from '../../../../../base/common/async.js';
import { MenuId } from '../../../../../platform/actions/common/actions.js';
import { ITerminalConfigurationService } from '../../../terminal/browser/terminal.js';
import { GOLDEN_LINE_HEIGHT_RATIO } from '../../../../../editor/common/config/fontInfo.js';
import { TerminalCompletionModel } from './terminalCompletionModel.js';
import { TerminalCompletionItem, TerminalCompletionItemKind } from './terminalCompletionItem.js';
import { localize } from '../../../../../nls.js';
import { TerminalSuggestTelemetry } from './terminalSuggestTelemetry.js';
import { terminalSymbolAliasIcon, terminalSymbolArgumentIcon, terminalSymbolEnumMember, terminalSymbolFileIcon, terminalSymbolFlagIcon, terminalSymbolInlineSuggestionIcon, terminalSymbolMethodIcon, terminalSymbolOptionIcon, terminalSymbolFolderIcon, terminalSymbolSymbolicLinkFileIcon, terminalSymbolSymbolicLinkFolderIcon, terminalSymbolCommitIcon, terminalSymbolBranchIcon, terminalSymbolTagIcon, terminalSymbolStashIcon, terminalSymbolRemoteIcon, terminalSymbolPullRequestIcon, terminalSymbolPullRequestDoneIcon, terminalSymbolSymbolTextIcon } from './terminalSymbolIcons.js';
import { TerminalSuggestShownTracker } from './terminalSuggestShownTracker.js';
import { isString } from '../../../../../base/common/types.js';
export function isInlineCompletionSupported(shellType) {
    if (!shellType) {
        return false;
    }
    return shellType === "bash" /* PosixShellType.Bash */ ||
        shellType === "zsh" /* PosixShellType.Zsh */ ||
        shellType === "fish" /* PosixShellType.Fish */ ||
        shellType === "pwsh" /* GeneralShellType.PowerShell */ ||
        shellType === "gitbash" /* WindowsShellType.GitBash */;
}
let SuggestAddon = class SuggestAddon extends Disposable {
    static { SuggestAddon_1 = this; }
    static { this.lastAcceptedCompletionTimestamp = 0; }
    constructor(_sessionId, shellType, _capabilities, _terminalSuggestWidgetVisibleContextKey, _terminalCompletionService, _configurationService, _instantiationService, _terminalConfigurationService, _logService) {
        super();
        this._sessionId = _sessionId;
        this._capabilities = _capabilities;
        this._terminalSuggestWidgetVisibleContextKey = _terminalSuggestWidgetVisibleContextKey;
        this._terminalCompletionService = _terminalCompletionService;
        this._configurationService = _configurationService;
        this._instantiationService = _instantiationService;
        this._terminalConfigurationService = _terminalConfigurationService;
        this._logService = _logService;
        this._promptInputModelSubscriptions = this._register(new MutableDisposable());
        this._enableWidget = true;
        this._pathSeparator = sep;
        this._isFilteringDirectories = false;
        this._cursorIndexDelta = 0;
        this._requestedCompletionsIndex = 0;
        this._lastUserDataTimestamp = 0;
        this._ignoreFocusEvents = false;
        this._requestCompletionsOnNextSync = false;
        this.isPasting = false;
        this._onBell = this._register(new Emitter());
        this.onBell = this._onBell.event;
        this._onAcceptedCompletion = this._register(new Emitter());
        this.onAcceptedCompletion = this._onAcceptedCompletion.event;
        this._onDidReceiveCompletions = this._register(new Emitter());
        this.onDidReceiveCompletions = this._onDidReceiveCompletions.event;
        this._onDidFontConfigurationChange = this._register(new Emitter());
        this.onDidFontConfigurationChange = this._onDidFontConfigurationChange.event;
        this._kindToIconMap = new Map([
            [TerminalCompletionItemKind.File, terminalSymbolFileIcon],
            [TerminalCompletionItemKind.Folder, terminalSymbolFolderIcon],
            [TerminalCompletionItemKind.SymbolicLinkFile, terminalSymbolSymbolicLinkFileIcon],
            [TerminalCompletionItemKind.SymbolicLinkFolder, terminalSymbolSymbolicLinkFolderIcon],
            [TerminalCompletionItemKind.Method, terminalSymbolMethodIcon],
            [TerminalCompletionItemKind.Alias, terminalSymbolAliasIcon],
            [TerminalCompletionItemKind.Argument, terminalSymbolArgumentIcon],
            [TerminalCompletionItemKind.Option, terminalSymbolOptionIcon],
            [TerminalCompletionItemKind.OptionValue, terminalSymbolEnumMember],
            [TerminalCompletionItemKind.Flag, terminalSymbolFlagIcon],
            [TerminalCompletionItemKind.Commit, terminalSymbolCommitIcon],
            [TerminalCompletionItemKind.Branch, terminalSymbolBranchIcon],
            [TerminalCompletionItemKind.Tag, terminalSymbolTagIcon],
            [TerminalCompletionItemKind.Stash, terminalSymbolStashIcon],
            [TerminalCompletionItemKind.Remote, terminalSymbolRemoteIcon],
            [TerminalCompletionItemKind.PullRequest, terminalSymbolPullRequestIcon],
            [TerminalCompletionItemKind.PullRequestDone, terminalSymbolPullRequestDoneIcon],
            [TerminalCompletionItemKind.InlineSuggestion, terminalSymbolInlineSuggestionIcon],
            [TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop, terminalSymbolInlineSuggestionIcon],
        ]);
        this._kindToKindLabelMap = new Map([
            [TerminalCompletionItemKind.File, localize('file', 'File')],
            [TerminalCompletionItemKind.Folder, localize('folder', 'Folder')],
            [TerminalCompletionItemKind.SymbolicLinkFile, localize('symbolicLinkFile', 'Symbolic Link File')],
            [TerminalCompletionItemKind.SymbolicLinkFolder, localize('symbolicLinkFolder', 'Symbolic Link Folder')],
            [TerminalCompletionItemKind.Method, localize('method', 'Method')],
            [TerminalCompletionItemKind.Alias, localize('alias', 'Alias')],
            [TerminalCompletionItemKind.Argument, localize('argument', 'Argument')],
            [TerminalCompletionItemKind.Option, localize('option', 'Option')],
            [TerminalCompletionItemKind.OptionValue, localize('optionValue', 'Option Value')],
            [TerminalCompletionItemKind.Flag, localize('flag', 'Flag')],
            [TerminalCompletionItemKind.Commit, localize('commit', 'Commit')],
            [TerminalCompletionItemKind.Branch, localize('branch', 'Branch')],
            [TerminalCompletionItemKind.Tag, localize('tag', 'Tag')],
            [TerminalCompletionItemKind.Stash, localize('stash', 'Stash')],
            [TerminalCompletionItemKind.Remote, localize('remote', 'Remote')],
            [TerminalCompletionItemKind.PullRequest, localize('pullRequest', 'Pull Request')],
            [TerminalCompletionItemKind.PullRequestDone, localize('pullRequestDone', 'Pull Request (Done)')],
            [TerminalCompletionItemKind.InlineSuggestion, localize('inlineSuggestion', 'Inline Suggestion')],
            [TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop, localize('inlineSuggestionAlwaysOnTop', 'Inline Suggestion')],
        ]);
        this._inlineCompletion = {
            label: '',
            // Right arrow is used to accept the completion. This is a common keybinding in pwsh, zsh
            // and fish.
            inputData: '\x1b[C',
            replacementRange: [0, 0],
            provider: 'core:inlineSuggestion',
            detail: 'Inline suggestion',
            kind: TerminalCompletionItemKind.InlineSuggestion,
            kindLabel: 'Inline suggestion',
            icon: this._kindToIconMap.get(TerminalCompletionItemKind.InlineSuggestion),
        };
        this._inlineCompletionItem = new TerminalCompletionItem(this._inlineCompletion);
        this._shouldSyncWhenReady = false;
        // Initialize shell type, including a promise that completions can await for that resolves:
        // - immediately if shell type
        // - after a short delay if shell type gets set
        // - after a long delay if it doesn't get set
        this.shellType = shellType;
        if (this.shellType) {
            this._shellTypeInit = Promise.resolve();
        }
        else {
            const intervalTimer = this._register(new IntervalTimer());
            const timeoutTimer = this._register(new TimeoutTimer());
            this._shellTypeInit = new Promise(r => {
                intervalTimer.cancelAndSet(() => {
                    if (this.shellType) {
                        r();
                    }
                }, 50);
                timeoutTimer.cancelAndSet(r, 5000);
            }).then(() => {
                this._store.delete(intervalTimer);
                this._store.delete(timeoutTimer);
            });
        }
        this._register(Event.runAndSubscribe(this._capabilities.onDidChangeCapabilities, () => {
            const commandDetection = this._capabilities.get(2 /* TerminalCapability.CommandDetection */);
            if (commandDetection) {
                if (this._promptInputModel !== commandDetection.promptInputModel) {
                    this._promptInputModel = commandDetection.promptInputModel;
                    this._suggestTelemetry = this._register(this._instantiationService.createInstance(TerminalSuggestTelemetry, commandDetection, this._promptInputModel));
                    this._promptInputModelSubscriptions.value = combinedDisposable(this._promptInputModel.onDidChangeInput(e => this._sync(e)), this._promptInputModel.onDidFinishInput(() => {
                        this.hideSuggestWidget(true);
                    }));
                    if (this._shouldSyncWhenReady) {
                        this._sync(this._promptInputModel);
                        this._shouldSyncWhenReady = false;
                    }
                }
            }
            else {
                this._promptInputModel = undefined;
            }
        }));
        this._register(this._terminalConfigurationService.onConfigChanged(() => this._cachedFontInfo = undefined));
        this._register(Event.runAndSubscribe(this._configurationService.onDidChangeConfiguration, e => {
            if (!e || e.affectsConfiguration("terminal.integrated.suggest.inlineSuggestion" /* TerminalSuggestSettingId.InlineSuggestion */)) {
                const value = this._configurationService.getValue(terminalSuggestConfigSection).inlineSuggestion;
                this._inlineCompletionItem.isInvalid = value === 'off';
                switch (value) {
                    case 'alwaysOnTopExceptExactMatch': {
                        this._inlineCompletion.kind = TerminalCompletionItemKind.InlineSuggestion;
                        break;
                    }
                    case 'alwaysOnTop':
                    default: {
                        this._inlineCompletion.kind = TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop;
                        break;
                    }
                }
                this._model?.forceRefilterAll();
            }
        }));
    }
    activate(xterm) {
        this._terminal = xterm;
        this._register(xterm.onKey(async (e) => {
            this._lastUserData = e.key;
            this._lastUserDataTimestamp = Date.now();
        }));
        this._register(xterm.onScroll(() => this.hideSuggestWidget(true)));
    }
    async _handleCompletionProviders(terminal, token, explicitlyInvoked) {
        this._logService.trace('SuggestAddon#_handleCompletionProviders');
        // Nothing to handle if the terminal is not attached
        if (!terminal?.element || !this._enableWidget || !this._promptInputModel) {
            return;
        }
        // Only show the suggest widget if the terminal is focused
        if (!dom.isAncestorOfActiveElement(terminal.element)) {
            return;
        }
        // Wait for the shell type to initialize. This will wait a short period after launching to
        // allow the shell type to be set if possible. This prevents user requests sometimes getting
        // lost if requested shortly after the terminal is created. Completion providers can still
        // work with undefined shell types such as Pseudoterminal-based extension terminals.
        await this._shellTypeInit;
        let doNotRequestExtensionCompletions = false;
        // Ensure that a key has been pressed since the last accepted completion in order to prevent
        // completions being requested again right after accepting a completion
        if (this._promptInputModel.value !== '' && this._lastUserDataTimestamp < SuggestAddon_1.lastAcceptedCompletionTimestamp) {
            doNotRequestExtensionCompletions = true;
        }
        this._currentPromptInputState = {
            value: this._promptInputModel.value,
            prefix: this._promptInputModel.prefix,
            suffix: this._promptInputModel.suffix,
            cursorIndex: this._promptInputModel.cursorIndex,
            ghostTextIndex: this._promptInputModel.ghostTextIndex
        };
        this._requestedCompletionsIndex = this._currentPromptInputState.cursorIndex;
        // Show loading indicator before making async completion request (only for explicit invocations)
        if (explicitlyInvoked) {
            const suggestWidget = this._ensureSuggestWidget(terminal);
            const cursorPosition = this._getCursorPosition(terminal);
            if (cursorPosition) {
                suggestWidget.showTriggered(true, cursorPosition);
            }
        }
        const quickSuggestionsConfig = this._configurationService.getValue(terminalSuggestConfigSection).quickSuggestions;
        const allowFallbackCompletions = explicitlyInvoked || quickSuggestionsConfig.unknown === 'on';
        this._logService.trace('SuggestAddon#_handleCompletionProviders provideCompletions');
        const providedCompletions = await this._terminalCompletionService.provideCompletions(this._currentPromptInputState.value, this._currentPromptInputState.cursorIndex, allowFallbackCompletions, this.shellType, this._capabilities, token, false, doNotRequestExtensionCompletions, explicitlyInvoked);
        this._logService.trace('SuggestAddon#_handleCompletionProviders provideCompletions done');
        if (token.isCancellationRequested) {
            return;
        }
        this._onDidReceiveCompletions.fire();
        this._cursorIndexDelta = this._promptInputModel.cursorIndex - this._requestedCompletionsIndex;
        this._leadingLineContent = this._promptInputModel.prefix.substring(0, this._requestedCompletionsIndex + this._cursorIndexDelta);
        const completions = providedCompletions?.flat() || [];
        if (!explicitlyInvoked && !completions.length) {
            this.hideSuggestWidget(true);
            return;
        }
        const firstChar = this._leadingLineContent.length === 0 ? '' : this._leadingLineContent[0];
        // This is a TabExpansion2 result
        if (this._leadingLineContent.includes(' ') || firstChar === '[') {
            this._leadingLineContent = this._promptInputModel.prefix;
        }
        let normalizedLeadingLineContent = this._leadingLineContent;
        // If there is a single directory in the completions:
        // - `\` and `/` are normalized such that either can be used
        // - Using `\` or `/` will request new completions. It's important that this only occurs
        //   when a directory is present, if not completions like git branches could be requested
        //   which leads to flickering
        this._isFilteringDirectories = completions.some(e => e.kind === TerminalCompletionItemKind.Folder);
        if (this._isFilteringDirectories) {
            const firstDir = completions.find(e => e.kind === TerminalCompletionItemKind.Folder);
            const textLabel = isString(firstDir?.label) ? firstDir.label : firstDir?.label.label;
            this._pathSeparator = textLabel?.match(/(?<sep>[\\\/])/)?.groups?.sep ?? sep;
            normalizedLeadingLineContent = normalizePathSeparator(normalizedLeadingLineContent, this._pathSeparator);
        }
        // Add any "ghost text" suggestion suggested by the shell. This aligns with behavior of the
        // editor and how it interacts with inline completions. This object is tracked and reused as
        // it may change on input.
        this._refreshInlineCompletion(completions);
        // Add any missing icons based on the completion item kind
        for (const completion of completions) {
            if (!completion.icon) {
                if (completion.kind !== undefined) {
                    completion.icon = this._kindToIconMap.get(completion.kind);
                    completion.kindLabel = this._kindToKindLabelMap.get(completion.kind);
                }
                else {
                    completion.icon = terminalSymbolSymbolTextIcon;
                }
            }
        }
        const lineContext = new LineContext(normalizedLeadingLineContent, this._cursorIndexDelta);
        const items = completions.filter(c => !!c.label).map(c => new TerminalCompletionItem(c));
        if (isInlineCompletionSupported(this.shellType)) {
            items.push(this._inlineCompletionItem);
        }
        this._logService.trace('TerminalCompletionService#_collectCompletions create model');
        const model = new TerminalCompletionModel(items, lineContext);
        this._logService.trace('TerminalCompletionService#_collectCompletions create model done');
        if (token.isCancellationRequested) {
            this._completionRequestTimestamp = undefined;
            return;
        }
        this._showCompletions(model, explicitlyInvoked);
    }
    setContainerWithOverflow(container) {
        this._container = container;
    }
    setScreen(screen) {
        this._screen = screen;
    }
    toggleExplainMode() {
        this._suggestWidget?.toggleExplainMode();
    }
    toggleSuggestionFocus() {
        this._suggestWidget?.toggleDetailsFocus();
    }
    toggleSuggestionDetails() {
        this._suggestWidget?.toggleDetails();
    }
    resetWidgetSize() {
        this._suggestWidget?.resetWidgetSize();
    }
    async requestCompletions(explicitlyInvoked) {
        this._logService.trace('SuggestAddon#requestCompletions');
        if (!this._promptInputModel) {
            this._shouldSyncWhenReady = true;
            return;
        }
        if (this.isPasting) {
            return;
        }
        if (this._cancellationTokenSource) {
            this._cancellationTokenSource.cancel();
            this._cancellationTokenSource.dispose();
        }
        this._cancellationTokenSource = new CancellationTokenSource();
        const token = this._cancellationTokenSource.token;
        // Track the time when completions are requested
        this._completionRequestTimestamp = Date.now();
        await this._handleCompletionProviders(this._terminal, token, explicitlyInvoked);
        // If completions are not shown (widget not visible), reset the tracker
        if (!this._terminalSuggestWidgetVisibleContextKey.get()) {
            this._completionRequestTimestamp = undefined;
        }
    }
    _addPropertiesToInlineCompletionItem(completions) {
        const inlineCompletionLabel = (isString(this._inlineCompletionItem.completion.label) ? this._inlineCompletionItem.completion.label : this._inlineCompletionItem.completion.label.label).trim();
        const inlineCompletionMatchIndex = completions.findIndex(c => isString(c.label) ? c.label === inlineCompletionLabel : c.label.label === inlineCompletionLabel);
        if (inlineCompletionMatchIndex !== -1) {
            // Remove the existing inline completion item from the completions list
            const richCompletionMatchingInline = completions.splice(inlineCompletionMatchIndex, 1)[0];
            // Apply its properties to the inline completion item
            this._inlineCompletionItem.completion.label = richCompletionMatchingInline.label;
            this._inlineCompletionItem.completion.detail = richCompletionMatchingInline.detail;
            this._inlineCompletionItem.completion.documentation = richCompletionMatchingInline.documentation;
        }
        else if (this._inlineCompletionItem.completion) {
            this._inlineCompletionItem.completion.detail = undefined;
            this._inlineCompletionItem.completion.documentation = undefined;
        }
    }
    _requestTriggerCharQuickSuggestCompletions() {
        if (!this._wasLastInputVerticalArrowKey() && !this._wasLastInputTabKey()) {
            // Only request on trigger character when it's a regular input, or on an arrow if the widget
            // is already visible
            if (!this._wasLastInputIncludedEscape() || this._terminalSuggestWidgetVisibleContextKey.get()) {
                this.requestCompletions();
                return true;
            }
        }
        return false;
    }
    _checkProviderTriggerCharacters(char) {
        for (const provider of this._terminalCompletionService.providers) {
            if (!provider.triggerCharacters) {
                continue;
            }
            for (const triggerChar of provider.triggerCharacters) {
                if (char === triggerChar) {
                    return true;
                }
            }
        }
        return false;
    }
    _wasLastInputRightArrowKey() {
        return !!this._lastUserData?.match(/^\x1b[\[O]?C$/);
    }
    _wasLastInputVerticalArrowKey() {
        return !!this._lastUserData?.match(/^\x1b[\[O]?[A-B]$/);
    }
    /**
     * Whether the last input included the escape character. Typically this will mean it was more
     * than just a simple character, such as arrow keys, home, end, etc.
     */
    _wasLastInputIncludedEscape() {
        return !!this._lastUserData?.includes('\x1b');
    }
    _wasLastInputArrowKey() {
        // Never request completions if the last key sequence was up or down as the user was likely
        // navigating history
        return !!this._lastUserData?.match(/^\x1b[\[O]?[A-D]$/);
    }
    _wasLastInputTabKey() {
        return this._lastUserData === '\t';
    }
    _sync(promptInputState) {
        const config = this._configurationService.getValue(terminalSuggestConfigSection);
        {
            let sent = false;
            // If completions were requested from the addon
            if (this._requestCompletionsOnNextSync) {
                this._requestCompletionsOnNextSync = false;
                sent = this._requestTriggerCharQuickSuggestCompletions();
            }
            // If the cursor moved to the right
            if (!this._mostRecentPromptInputState || promptInputState.cursorIndex > this._mostRecentPromptInputState.cursorIndex) {
                // Quick suggestions - Trigger whenever a new non-whitespace character is used
                if (!this._terminalSuggestWidgetVisibleContextKey.get()) {
                    const commandLineHasSpace = promptInputState.prefix.trim().match(/\s/);
                    if ((!commandLineHasSpace && config.quickSuggestions.commands !== 'off') ||
                        (commandLineHasSpace && config.quickSuggestions.arguments !== 'off')) {
                        if (promptInputState.prefix.match(/[^\s]$/)) {
                            sent = this._requestTriggerCharQuickSuggestCompletions();
                        }
                    }
                }
                // Trigger characters - this happens even if the widget is showing
                if (config.suggestOnTriggerCharacters && !sent) {
                    const prefix = promptInputState.prefix;
                    if (
                    // Only trigger on `-` if it's after a space. This is required to not clear
                    // completions when typing the `-` in `git cherry-pick`
                    prefix?.match(/\s[\-]$/) ||
                        // Only trigger on `\` and `/` if it's a directory. Not doing so causes problems
                        // with git branches in particular
                        this._isFilteringDirectories && prefix?.match(/[\\\/]$/)) {
                        sent = this._requestTriggerCharQuickSuggestCompletions();
                    }
                    if (!sent) {
                        for (const provider of this._terminalCompletionService.providers) {
                            if (!provider.triggerCharacters) {
                                continue;
                            }
                            for (const char of provider.triggerCharacters) {
                                if (prefix?.endsWith(char)) {
                                    sent = this._requestTriggerCharQuickSuggestCompletions();
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            // If the cursor moved to the left
            if (this._mostRecentPromptInputState && promptInputState.cursorIndex < this._mostRecentPromptInputState.cursorIndex && promptInputState.cursorIndex > 0) {
                // We only want to refresh via trigger characters in this case if the widget is
                // already visible
                if (this._terminalSuggestWidgetVisibleContextKey.get()) {
                    // Backspace or left past a trigger character
                    if (config.suggestOnTriggerCharacters && !sent && this._mostRecentPromptInputState.cursorIndex > 0) {
                        const char = this._mostRecentPromptInputState.value[this._mostRecentPromptInputState.cursorIndex - 1];
                        if (
                        // Only trigger on `\` and `/` if it's a directory. Not doing so causes problems
                        // with git branches in particular
                        this._isFilteringDirectories && char.match(/[\\\/]$/) ||
                            // Check if the character is a trigger character from providers
                            this._checkProviderTriggerCharacters(char)) {
                            sent = this._requestTriggerCharQuickSuggestCompletions();
                        }
                    }
                }
            }
        }
        // Hide the widget if ghost text was just completed via right arrow
        if (this._wasLastInputRightArrowKey() &&
            this._mostRecentPromptInputState?.ghostTextIndex !== -1 &&
            promptInputState.ghostTextIndex === -1 &&
            this._mostRecentPromptInputState?.value === promptInputState.value) {
            this.hideSuggestWidget(false);
        }
        this._mostRecentPromptInputState = promptInputState;
        if (!this._promptInputModel || !this._terminal || !this._suggestWidget || this._leadingLineContent === undefined) {
            return;
        }
        const previousPromptInputState = this._currentPromptInputState;
        this._currentPromptInputState = promptInputState;
        // Hide the widget if the latest character was a space
        if (this._currentPromptInputState.cursorIndex > 1 && this._currentPromptInputState.value.at(this._currentPromptInputState.cursorIndex - 1) === ' ') {
            if (!this._wasLastInputArrowKey()) {
                this.hideSuggestWidget(false);
                return;
            }
        }
        // Hide the widget if the cursor moves to the left and invalidates the completions.
        // Originally this was to the left of the initial position that the completions were
        // requested, but since extensions are expected to allow the client-side to filter, they are
        // only invalidated when whitespace is encountered.
        if (this._currentPromptInputState && this._currentPromptInputState.cursorIndex < this._leadingLineContent.length) {
            if (this._currentPromptInputState.cursorIndex <= 0 || previousPromptInputState?.value[this._currentPromptInputState.cursorIndex]?.match(/[\\\/\s]/)) {
                this.hideSuggestWidget(false);
                return;
            }
        }
        if (this._terminalSuggestWidgetVisibleContextKey.get()) {
            this._cursorIndexDelta = this._currentPromptInputState.cursorIndex - (this._requestedCompletionsIndex);
            let normalizedLeadingLineContent = this._currentPromptInputState.value.substring(0, this._requestedCompletionsIndex + this._cursorIndexDelta);
            if (this._isFilteringDirectories) {
                normalizedLeadingLineContent = normalizePathSeparator(normalizedLeadingLineContent, this._pathSeparator);
            }
            const lineContext = new LineContext(normalizedLeadingLineContent, this._cursorIndexDelta);
            this._suggestWidget.setLineContext(lineContext);
        }
        this._refreshInlineCompletion(this._model?.items.map(i => i.completion) || []);
        // Hide and clear model if there are no more items
        if (!this._suggestWidget.hasCompletions()) {
            this.hideSuggestWidget(false);
            return;
        }
        const cursorPosition = this._getCursorPosition(this._terminal);
        if (!cursorPosition) {
            return;
        }
        this._suggestWidget.showSuggestions(0, false, true, cursorPosition);
    }
    _refreshInlineCompletion(completions) {
        if (!isInlineCompletionSupported(this.shellType)) {
            // If the shell type is not supported, the inline completion item is invalid
            return;
        }
        const oldIsInvalid = this._inlineCompletionItem.isInvalid;
        if (!this._currentPromptInputState || this._currentPromptInputState.ghostTextIndex === -1) {
            this._inlineCompletionItem.isInvalid = true;
        }
        else {
            this._inlineCompletionItem.isInvalid = false;
            // Update properties
            const spaceIndex = this._currentPromptInputState.value.lastIndexOf(' ', this._currentPromptInputState.ghostTextIndex - 1);
            const replacementIndex = spaceIndex === -1 ? 0 : spaceIndex + 1;
            const suggestion = this._currentPromptInputState.value.substring(replacementIndex);
            this._inlineCompletion.label = suggestion;
            // Update replacementRange (inclusive start, exclusive end) for replacement
            const end = this._currentPromptInputState.cursorIndex - this._cursorIndexDelta;
            this._inlineCompletion.replacementRange = [replacementIndex, end];
            // Reset the completion item as the object reference must remain the same but its
            // contents will differ across syncs. This is done so we don't need to reassign the
            // model and the slowdown/flickering that could potentially cause.
            this._addPropertiesToInlineCompletionItem(completions);
            const x = new TerminalCompletionItem(this._inlineCompletion);
            this._inlineCompletionItem.idx = x.idx;
            this._inlineCompletionItem.score = x.score;
            this._inlineCompletionItem.labelLow = x.labelLow;
            this._inlineCompletionItem.textLabel = x.textLabel;
            this._inlineCompletionItem.fileExtLow = x.fileExtLow;
            this._inlineCompletionItem.labelLowExcludeFileExt = x.labelLowExcludeFileExt;
            this._inlineCompletionItem.labelLowNormalizedPath = x.labelLowNormalizedPath;
            this._inlineCompletionItem.punctuationPenalty = x.punctuationPenalty;
            this._inlineCompletionItem.word = x.word;
            this._model?.forceRefilterAll();
        }
        // Force a filter all in order to re-evaluate the inline completion
        if (this._inlineCompletionItem.isInvalid !== oldIsInvalid) {
            this._model?.forceRefilterAll();
        }
    }
    _getTerminalDimensions() {
        const cssCellDims = this._terminal._core._renderService.dimensions.css.cell;
        return {
            width: cssCellDims.width,
            height: cssCellDims.height,
        };
    }
    _getCursorPosition(terminal) {
        const dimensions = this._getTerminalDimensions();
        if (!dimensions.width || !dimensions.height) {
            return undefined;
        }
        const xtermBox = this._screen.getBoundingClientRect();
        return {
            left: xtermBox.left + terminal.buffer.active.cursorX * dimensions.width,
            top: xtermBox.top + terminal.buffer.active.cursorY * dimensions.height,
            height: dimensions.height
        };
    }
    _getFontInfo() {
        if (this._cachedFontInfo) {
            return this._cachedFontInfo;
        }
        const core = this._terminal._core;
        const font = this._terminalConfigurationService.getFont(dom.getActiveWindow(), core);
        let lineHeight = font.lineHeight;
        const fontSize = font.fontSize;
        const fontFamily = font.fontFamily;
        const letterSpacing = font.letterSpacing;
        const fontWeight = this._configurationService.getValue('editor.fontWeight');
        // Unlike editor suggestions, line height in terminal is always multiplied to the font size.
        // Make sure that we still enforce a minimum line height to avoid content from being clipped.
        // See https://github.com/microsoft/vscode/issues/255851
        lineHeight = lineHeight * fontSize;
        // Enforce integer, minimum constraints
        lineHeight = Math.round(lineHeight);
        const minTerminalLineHeight = GOLDEN_LINE_HEIGHT_RATIO * fontSize;
        if (lineHeight < minTerminalLineHeight) {
            lineHeight = minTerminalLineHeight;
        }
        const fontInfo = {
            fontSize,
            lineHeight,
            fontWeight: fontWeight.toString(),
            letterSpacing,
            fontFamily
        };
        this._cachedFontInfo = fontInfo;
        return fontInfo;
    }
    _getAdvancedExplainModeDetails() {
        return `promptInputModel: ${this._promptInputModel?.getCombinedString()}`;
    }
    _showCompletions(model, explicitlyInvoked) {
        this._logService.trace('SuggestAddon#_showCompletions');
        if (!this._terminal?.element) {
            return;
        }
        const suggestWidget = this._ensureSuggestWidget(this._terminal);
        this._logService.trace('SuggestAddon#_showCompletions setCompletionModel');
        suggestWidget.setCompletionModel(model);
        this._register(suggestWidget.onDidFocus(() => this._terminal?.focus()));
        if (!this._promptInputModel || !explicitlyInvoked && model.items.length === 0) {
            return;
        }
        this._model = model;
        const cursorPosition = this._getCursorPosition(this._terminal);
        if (!cursorPosition) {
            return;
        }
        // Track the time when completions are shown for the first time
        if (this._completionRequestTimestamp !== undefined) {
            const completionLatency = Date.now() - this._completionRequestTimestamp;
            if (this._suggestTelemetry && this._discoverability) {
                const firstShown = this._discoverability.getFirstShown(this.shellType);
                this._discoverability.updateShown();
                this._suggestTelemetry.logCompletionLatency(this._sessionId, completionLatency, firstShown);
            }
            this._completionRequestTimestamp = undefined;
        }
        this._logService.trace('SuggestAddon#_showCompletions suggestWidget.showSuggestions');
        suggestWidget.showSuggestions(0, false, !explicitlyInvoked, cursorPosition);
    }
    _ensureSuggestWidget(terminal) {
        if (!this._suggestWidget) {
            this._suggestWidget = this._register(this._instantiationService.createInstance(SimpleSuggestWidget, this._container, this._instantiationService.createInstance(PersistedWidgetSize), {
                statusBarMenuId: MenuId.MenubarTerminalSuggestStatusMenu,
                showStatusBarSettingId: "terminal.integrated.suggest.showStatusBar" /* TerminalSuggestSettingId.ShowStatusBar */,
                selectionModeSettingId: "terminal.integrated.suggest.selectionMode" /* TerminalSuggestSettingId.SelectionMode */,
                preventDetailsPlacements: [1 /* SimpleSuggestDetailsPlacement.West */],
            }, this._getFontInfo.bind(this), this._onDidFontConfigurationChange.event.bind(this), this._getAdvancedExplainModeDetails.bind(this)));
            this._register(this._suggestWidget.onDidSelect(async (e) => this.acceptSelectedSuggestion(e)));
            this._register(this._suggestWidget.onDidHide(() => this._terminalSuggestWidgetVisibleContextKey.reset()));
            this._register(this._suggestWidget.onDidShow(() => this._terminalSuggestWidgetVisibleContextKey.set(true)));
            this._register(this._configurationService.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration("terminal.integrated.fontFamily" /* TerminalSettingId.FontFamily */) || e.affectsConfiguration("terminal.integrated.fontSize" /* TerminalSettingId.FontSize */) || e.affectsConfiguration("terminal.integrated.lineHeight" /* TerminalSettingId.LineHeight */) || e.affectsConfiguration("terminal.integrated.fontFamily" /* TerminalSettingId.FontFamily */) || e.affectsConfiguration('editor.fontSize') || e.affectsConfiguration('editor.fontFamily')) {
                    this._onDidFontConfigurationChange.fire();
                }
            }));
            this._register(this._suggestWidget.onDidFocus(async (e) => {
                if (this._ignoreFocusEvents) {
                    return;
                }
                const focusedItem = e.item;
                const focusedIndex = e.index;
                if (focusedItem === this._focusedItem) {
                    return;
                }
                // Cancel any previous resolution
                this._currentSuggestionDetails?.cancel();
                this._currentSuggestionDetails = undefined;
                this._focusedItem = focusedItem;
                // Check if the item needs resolution and hasn't been resolved yet
                if (focusedItem && (!focusedItem.completion.documentation || !focusedItem.completion.detail)) {
                    this._currentSuggestionDetails = createCancelablePromise(async (token) => {
                        try {
                            await focusedItem.resolve(token);
                        }
                        catch (error) {
                            // Silently fail - the item is still usable without details
                            this._logService.warn(`Failed to resolve suggestion details for item ${focusedItem} at index ${focusedIndex}`, error);
                        }
                    });
                    this._currentSuggestionDetails.then(() => {
                        // Check if this is still the focused item and it's still in the list
                        if (focusedItem !== this._focusedItem || !this._suggestWidget?.list || focusedIndex >= this._suggestWidget.list.length) {
                            return;
                        }
                        // Re-render the specific item to show resolved details (like editor does)
                        this._ignoreFocusEvents = true;
                        // Use splice to replace the item and trigger re-render
                        this._suggestWidget.list.splice(focusedIndex, 1, [focusedItem]);
                        this._suggestWidget.list.setFocus([focusedIndex]);
                        this._ignoreFocusEvents = false;
                    });
                }
            }));
            // eslint-disable-next-line no-restricted-syntax
            const element = this._terminal?.element?.querySelector('.xterm-helper-textarea');
            if (element) {
                this._register(dom.addDisposableListener(dom.getActiveDocument(), 'click', (event) => {
                    const target = event.target;
                    if (this._terminal?.element?.contains(target)) {
                        this._suggestWidget?.hide();
                    }
                }));
            }
            this._register(this._suggestWidget.onDidShow(() => this._updateDiscoverabilityState()));
            this._register(this._suggestWidget.onDidBlurDetails((e) => {
                const elt = e.relatedTarget;
                if (this._terminal?.element?.contains(elt)) {
                    // Do nothing, just the terminal getting focused
                    // If there was a mouse click, the suggest widget will be
                    // hidden above
                    return;
                }
                this._suggestWidget?.hide();
            }));
            this._terminalSuggestWidgetVisibleContextKey.set(false);
        }
        return this._suggestWidget;
    }
    _updateDiscoverabilityState() {
        if (!this._discoverability) {
            this._discoverability = this._register(this._instantiationService.createInstance(TerminalSuggestShownTracker, this.shellType));
        }
        if (!this._suggestWidget || this._discoverability?.done) {
            return;
        }
        this._discoverability?.update(this._suggestWidget.element.domNode);
    }
    resetDiscoverability() {
        this._discoverability?.resetState();
    }
    selectPreviousSuggestion() {
        this._suggestWidget?.selectPrevious();
    }
    selectPreviousPageSuggestion() {
        this._suggestWidget?.selectPreviousPage();
    }
    selectNextSuggestion() {
        this._suggestWidget?.selectNext();
    }
    selectNextPageSuggestion() {
        this._suggestWidget?.selectNextPage();
    }
    acceptSelectedSuggestion(suggestion, respectRunOnEnter) {
        if (!suggestion) {
            suggestion = this._suggestWidget?.getFocusedItem();
        }
        const initialPromptInputState = this._mostRecentPromptInputState;
        if (!suggestion?.item || !initialPromptInputState || this._leadingLineContent === undefined || !this._model) {
            this._suggestTelemetry?.acceptCompletion(this._sessionId, undefined, this._mostRecentPromptInputState?.value);
            return;
        }
        SuggestAddon_1.lastAcceptedCompletionTimestamp = Date.now();
        this._suggestWidget?.hide();
        const currentPromptInputState = this._currentPromptInputState ?? initialPromptInputState;
        // The replacement text is any text after the replacement index for the completions, this
        // includes any text that was there before the completions were requested and any text added
        // since to refine the completion.
        const startIndex = suggestion.item.completion.replacementRange?.[0] ?? currentPromptInputState.cursorIndex;
        const replacementText = currentPromptInputState.value.substring(startIndex, currentPromptInputState.cursorIndex);
        // Right side of replacement text in the same word
        let rightSideReplacementText = '';
        if (
        // The line didn't end with ghost text
        (currentPromptInputState.ghostTextIndex === -1 || currentPromptInputState.ghostTextIndex > currentPromptInputState.cursorIndex) &&
            // There is more than one charatcer
            currentPromptInputState.value.length > currentPromptInputState.cursorIndex + 1 &&
            // THe next character is not a space
            currentPromptInputState.value.at(currentPromptInputState.cursorIndex) !== ' ') {
            const spaceIndex = currentPromptInputState.value.substring(currentPromptInputState.cursorIndex, currentPromptInputState.ghostTextIndex === -1 ? undefined : currentPromptInputState.ghostTextIndex).indexOf(' ');
            rightSideReplacementText = currentPromptInputState.value.substring(currentPromptInputState.cursorIndex, spaceIndex === -1 ? undefined : currentPromptInputState.cursorIndex + spaceIndex);
        }
        const completion = suggestion.item.completion;
        let resultSequence = completion.inputData;
        // Use for amend the label if inputData is not defined
        if (resultSequence === undefined) {
            let completionText = isString(completion.label) ? completion.label : completion.label.label;
            if ((completion.kind === TerminalCompletionItemKind.Folder || completion.isFileOverride) && completionText.includes(' ')) {
                // Escape spaces in files or folders so they're valid paths
                completionText = completionText.replaceAll(' ', '\\ ');
            }
            let runOnEnter = false;
            if (respectRunOnEnter) {
                const runOnEnterConfig = this._configurationService.getValue(terminalSuggestConfigSection).runOnEnter;
                switch (runOnEnterConfig) {
                    case 'always': {
                        runOnEnter = true;
                        break;
                    }
                    case 'exactMatch': {
                        runOnEnter = replacementText.toLowerCase() === completionText.toLowerCase();
                        break;
                    }
                    case 'exactMatchIgnoreExtension': {
                        runOnEnter = replacementText.toLowerCase() === completionText.toLowerCase();
                        if (completion.isFileOverride) {
                            runOnEnter ||= replacementText.toLowerCase() === completionText.toLowerCase().replace(/\.[^\.]+$/, '');
                        }
                        break;
                    }
                }
            }
            const commonPrefixLen = commonPrefixLength(replacementText, completionText);
            const commonPrefix = replacementText.substring(replacementText.length - 1 - commonPrefixLen, replacementText.length - 1);
            const completionSuffix = completionText.substring(commonPrefixLen);
            if (currentPromptInputState.suffix.length > 0 && currentPromptInputState.prefix.endsWith(commonPrefix) && currentPromptInputState.suffix.startsWith(completionSuffix)) {
                // Move right to the end of the completion
                resultSequence = '\x1bOC'.repeat(completionText.length - commonPrefixLen);
            }
            else {
                resultSequence = [
                    // Backspace (left) to remove all additional input
                    '\x7F'.repeat(replacementText.length - commonPrefixLen),
                    // Delete (right) to remove any additional text in the same word
                    '\x1b[3~'.repeat(rightSideReplacementText.length),
                    // Write the completion
                    completionSuffix,
                    // Run on enter if needed
                    runOnEnter ? '\r' : ''
                ].join('');
            }
        }
        // For folders, allow the next completion request to get completions for that folder
        if (completion.kind === TerminalCompletionItemKind.Folder) {
            SuggestAddon_1.lastAcceptedCompletionTimestamp = 0;
        }
        // Add trailing space if enabled and not a folder or symbolic link folder
        const config = this._configurationService.getValue(terminalSuggestConfigSection);
        if (config.insertTrailingSpace && completion.kind !== TerminalCompletionItemKind.Folder && completion.kind !== TerminalCompletionItemKind.SymbolicLinkFolder) {
            resultSequence += ' ';
            this._lastUserDataTimestamp = Date.now();
            this._requestCompletionsOnNextSync = true;
        }
        // Send the completion
        this._onAcceptedCompletion.fire(resultSequence);
        this._suggestTelemetry?.acceptCompletion(this._sessionId, completion, this._mostRecentPromptInputState?.value);
        this.hideSuggestWidget(true);
    }
    hideSuggestWidget(cancelAnyRequest) {
        this._discoverability?.resetTimer();
        if (cancelAnyRequest) {
            this._cancellationTokenSource?.cancel();
            this._cancellationTokenSource = undefined;
            // Also cancel any pending resolution requests
            this._currentSuggestionDetails?.cancel();
            this._currentSuggestionDetails = undefined;
        }
        this._currentPromptInputState = undefined;
        this._leadingLineContent = undefined;
        this._focusedItem = undefined;
        this._suggestWidget?.hide();
    }
};
SuggestAddon = SuggestAddon_1 = __decorate([
    __param(4, ITerminalCompletionService),
    __param(5, IConfigurationService),
    __param(6, IInstantiationService),
    __param(7, ITerminalConfigurationService),
    __param(8, ITerminalLogService)
], SuggestAddon);
export { SuggestAddon };
let PersistedWidgetSize = class PersistedWidgetSize {
    constructor(_storageService) {
        this._storageService = _storageService;
        this._key = "terminal.integrated.suggestSize" /* TerminalStorageKeys.TerminalSuggestSize */;
    }
    restore() {
        const raw = this._storageService.get(this._key, 0 /* StorageScope.PROFILE */) ?? '';
        try {
            const obj = JSON.parse(raw);
            if (dom.Dimension.is(obj)) {
                return dom.Dimension.lift(obj);
            }
        }
        catch {
            // ignore
        }
        return undefined;
    }
    store(size) {
        this._storageService.store(this._key, JSON.stringify(size), 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
    }
    reset() {
        this._storageService.remove(this._key, 0 /* StorageScope.PROFILE */);
    }
};
PersistedWidgetSize = __decorate([
    __param(0, IStorageService)
], PersistedWidgetSize);
export function normalizePathSeparator(path, sep) {
    if (sep === '/') {
        return path.replaceAll('\\', '/');
    }
    return path.replaceAll('/', '\\');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxTdWdnZXN0QWRkb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL3N1Z2dlc3QvYnJvd3Nlci90ZXJtaW5hbFN1Z2dlc3RBZGRvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQ0FBb0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM1RyxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDekQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDM0UsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFFdEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxtREFBbUQsQ0FBQztBQUtqSCxPQUFPLEVBQUUsNEJBQTRCLEVBQWdFLE1BQU0sMkNBQTJDLENBQUM7QUFDdkosT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQzVGLE9BQU8sRUFBNkIsbUJBQW1CLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUM3SCxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUM1RSxPQUFPLEVBQTRGLG1CQUFtQixFQUFFLE1BQU0scURBQXFELENBQUM7QUFDcEwsT0FBTyxFQUFxQix1QkFBdUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3hHLE9BQU8sRUFBRSx1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