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
import { EventType, addDisposableListener, getActiveWindow, getWindow, isActiveElement } from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { alert } from '../../../../base/browser/ui/aria/aria.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import * as marked from '../../../../base/common/marked/marked.js';
import { Schemas } from '../../../../base/common/network.js';
import { isMacintosh, isWindows } from '../../../../base/common/platform.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { EditorExtensionsRegistry } from '../../../../editor/browser/editorExtensions.js';
import { CodeEditorWidget } from '../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { Position } from '../../../../editor/common/core/position.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { AccessibilityHelpNLS } from '../../../../editor/common/standaloneStrings.js';
import { CodeActionController } from '../../../../editor/contrib/codeAction/browser/codeActionController.js';
import { FloatingEditorToolbar } from '../../../../editor/contrib/floatingMenu/browser/floatingMenu.js';
import { localize } from '../../../../nls.js';
import { AccessibleContentProvider, ExtensionContentProvider, isIAccessibleViewContentProvider } from '../../../../platform/accessibility/browser/accessibleView.js';
import { ACCESSIBLE_VIEW_SHOWN_STORAGE_PREFIX, IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { getFlatActionBarActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { WorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { IMenuService, MenuId } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { FloatingEditorClickMenu } from '../../../browser/codeeditor.js';
import { IChatCodeBlockContextProviderService } from '../../chat/browser/chat.js';
import { getSimpleEditorOptions } from '../../codeEditor/browser/simpleEditorOptions.js';
import { accessibilityHelpIsShown, accessibleViewContainsCodeBlocks, accessibleViewCurrentProviderId, accessibleViewGoToSymbolSupported, accessibleViewHasAssignedKeybindings, accessibleViewHasUnassignedKeybindings, accessibleViewInCodeBlock, accessibleViewIsShown, accessibleViewOnLastLine, accessibleViewSupportsNavigation, accessibleViewVerbosityEnabled } from './accessibilityConfiguration.js';
import { resolveContentAndKeybindingItems } from './accessibleViewKeybindingResolver.js';
var DIMENSIONS;
(function (DIMENSIONS) {
    DIMENSIONS[DIMENSIONS["MAX_WIDTH"] = 600] = "MAX_WIDTH";
})(DIMENSIONS || (DIMENSIONS = {}));
let AccessibleView = class AccessibleView extends Disposable {
    get editorWidget() { return this._editorWidget; }
    constructor(_openerService, _instantiationService, _configurationService, _modelService, _contextViewService, _contextKeyService, _accessibilityService, _keybindingService, _layoutService, _menuService, _commandService, _codeBlockContextProviderService, _storageService, textModelResolverService, _quickInputService, _accessibilitySignalService) {
        super();
        this._openerService = _openerService;
        this._instantiationService = _instantiationService;
        this._configurationService = _configurationService;
        this._modelService = _modelService;
        this._contextViewService = _contextViewService;
        this._contextKeyService = _contextKeyService;
        this._accessibilityService = _accessibilityService;
        this._keybindingService = _keybindingService;
        this._layoutService = _layoutService;
        this._menuService = _menuService;
        this._commandService = _commandService;
        this._codeBlockContextProviderService = _codeBlockContextProviderService;
        this._storageService = _storageService;
        this.textModelResolverService = textModelResolverService;
        this._quickInputService = _quickInputService;
        this._accessibilitySignalService = _accessibilitySignalService;
        this._isInQuickPick = false;
        this._accessiblityHelpIsShown = accessibilityHelpIsShown.bindTo(this._contextKeyService);
        this._accessibleViewIsShown = accessibleViewIsShown.bindTo(this._contextKeyService);
        this._accessibleViewSupportsNavigation = accessibleViewSupportsNavigation.bindTo(this._contextKeyService);
        this._accessibleViewVerbosityEnabled = accessibleViewVerbosityEnabled.bindTo(this._contextKeyService);
        this._accessibleViewGoToSymbolSupported = accessibleViewGoToSymbolSupported.bindTo(this._contextKeyService);
        this._accessibleViewCurrentProviderId = accessibleViewCurrentProviderId.bindTo(this._contextKeyService);
        this._accessibleViewInCodeBlock = accessibleViewInCodeBlock.bindTo(this._contextKeyService);
        this._accessibleViewContainsCodeBlocks = accessibleViewContainsCodeBlocks.bindTo(this._contextKeyService);
        this._onLastLine = accessibleViewOnLastLine.bindTo(this._contextKeyService);
        this._hasUnassignedKeybindings = accessibleViewHasUnassignedKeybindings.bindTo(this._contextKeyService);
        this._hasAssignedKeybindings = accessibleViewHasAssignedKeybindings.bindTo(this._contextKeyService);
        this._container = document.createElement('div');
        this._container.classList.add('accessible-view');
        if (this._configurationService.getValue("accessibility.hideAccessibleView" /* AccessibilityWorkbenchSettingId.HideAccessibleView */)) {
            this._container.classList.add('hide');
        }
        const codeEditorWidgetOptions = {
            contributions: EditorExtensionsRegistry.getEditorContributions()
                .filter(c => c.id !== CodeActionController.ID && c.id !== FloatingEditorClickMenu.ID && c.id !== FloatingEditorToolbar.ID)
        };
        const titleBar = document.createElement('div');
        titleBar.classList.add('accessible-view-title-bar');
        this._title = document.createElement('div');
        this._title.classList.add('accessible-view-title');
        titleBar.appendChild(this._title);
        const actionBar = document.createElement('div');
        actionBar.classList.add('accessible-view-action-bar');
        titleBar.appendChild(actionBar);
        this._container.appendChild(titleBar);
        this._toolbar = this._register(_instantiationService.createInstance(WorkbenchToolBar, actionBar, { orientation: 0 /* ActionsOrientation.HORIZONTAL */ }));
        this._toolbar.context = { viewId: 'accessibleView' };
        const toolbarElt = this._toolbar.getElement();
        toolbarElt.tabIndex = 0;
        const editorOptions = {
            ...getSimpleEditorOptions(this._configurationService),
            lineDecorationsWidth: 6,
            dragAndDrop: false,
            cursorWidth: 1,
            wordWrap: 'off',
            wrappingStrategy: 'advanced',
            wrappingIndent: 'none',
            padding: { top: 2, bottom: 2 },
            quickSuggestions: false,
            renderWhitespace: 'none',
            dropIntoEditor: { enabled: false },
            readOnly: true,
            fontFamily: 'var(--monaco-monospace-font)'
        };
        this.textModelResolverService.registerTextModelContentProvider(Schemas.accessibleView, this);
        this._editorWidget = this._register(this._instantiationService.createInstance(CodeEditorWidget, this._container, editorOptions, codeEditorWidgetOptions));
        this._register(this._accessibilityService.onDidChangeScreenReaderOptimized(() => {
            if (this._currentProvider && this._accessiblityHelpIsShown.get()) {
                this.show(this._currentProvider);
            }
        }));
        this._register(this._configurationService.onDidChangeConfiguration(e => {
            if (isIAccessibleViewContentProvider(this._currentProvider) && e.affectsConfiguration(this._currentProvider.verbositySettingKey)) {
                if (this._accessiblityHelpIsShown.get()) {
                    this.show(this._currentProvider);
                }
                this._accessibleViewVerbosityEnabled.set(this._configurationService.getValue(this._currentProvider.verbositySettingKey));
                this._updateToolbar(this._currentProvider.actions, this._currentProvider.options.type);
            }
            if (e.affectsConfiguration("accessibility.hideAccessibleView" /* AccessibilityWorkbenchSettingId.HideAccessibleView */)) {
                this._container.classList.toggle('hide', this._configurationService.getValue("accessibility.hideAccessibleView" /* AccessibilityWorkbenchSettingId.HideAccessibleView */));
            }
        }));
        this._register(this._editorWidget.onDidDispose(() => this._resetContextKeys()));
        this._register(this._editorWidget.onDidChangeCursorPosition(() => {
            this._onLastLine.set(this._editorWidget.getPosition()?.lineNumber === this._editorWidget.getModel()?.getLineCount());
            const cursorPosition = this._editorWidget.getPosition()?.lineNumber;
            if (this._codeBlocks && cursorPosition !== undefined) {
                const inCodeBlock = this._codeBlocks.find(c => c.startLine <= cursorPosition && c.endLine >= cursorPosition) !== undefined;
                this._accessibleViewInCodeBlock.set(inCodeBlock);
            }
            this._playDiffSignals();
        }));
    }
    _playDiffSignals() {
        if (this._currentProvider?.id !== "diffEditor" /* AccessibleViewProviderId.DiffEditor */ && this._currentProvider?.id !== "inlineCompletions" /* AccessibleViewProviderId.InlineCompletions */) {
            return;
        }
        const position = this._editorWidget.getPosition();
        const model = this._editorWidget.getModel();
        if (!position || !model) {
            return undefined;
        }
        const lineContent = model.getLineContent(position.lineNumber);
        if (lineContent?.startsWith('+')) {
            this._accessibilitySignalService.playSignal(AccessibilitySignal.diffLineInserted);
        }
        else if (lineContent?.startsWith('-')) {
            this._accessibilitySignalService.playSignal(AccessibilitySignal.diffLineDeleted);
        }
    }
    provideTextContent(resource) {
        return this._getTextModel(resource);
    }
    _resetContextKeys() {
        this._accessiblityHelpIsShown.reset();
        this._accessibleViewIsShown.reset();
        this._accessibleViewSupportsNavigation.reset();
        this._accessibleViewVerbosityEnabled.reset();
        this._accessibleViewGoToSymbolSupported.reset();
        this._accessibleViewCurrentProviderId.reset();
        this._hasAssignedKeybindings.reset();
        this._hasUnassignedKeybindings.reset();
    }
    getPosition(id) {
        if (!id || !this._lastProvider || this._lastProvider.id !== id) {
            return undefined;
        }
        return this._editorWidget.getPosition() || undefined;
    }
    setPosition(position, reveal, select) {
        this._editorWidget.setPosition(position);
        if (reveal) {
            this._editorWidget.revealPosition(position);
        }
        if (select) {
            const lineLength = this._editorWidget.getModel()?.getLineLength(position.lineNumber) ?? 0;
            if (lineLength) {
                this._editorWidget.setSelection({ startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: lineLength + 1 });
            }
        }
    }
    getCodeBlockContext() {
        const position = this._editorWidget.getPosition();
        if (!this._codeBlocks?.length || !position) {
            return;
        }
        const codeBlockIndex = this._codeBlocks?.findIndex(c => c.startLine <= position?.lineNumber && c.endLine >= position?.lineNumber);
        const codeBlock = codeBlockIndex !== undefined && codeBlockIndex > -1 ? this._codeBlocks[codeBlockIndex] : undefined;
        if (!codeBlock || codeBlockIndex === undefined) {
            return;
        }
        return { code: codeBlock.code, languageId: codeBlock.languageId, codeBlockIndex, element: undefined, chatSessionResource: codeBlock.chatSessionResource };
    }
    navigateToCodeBlock(type) {
        const position = this._editorWidget.getPosition();
        if (!this._codeBlocks?.length || !position) {
            return;
        }
        let codeBlock;
        const codeBlocks = this._codeBlocks.slice();
        if (type === 'previous') {
            codeBlock = codeBlocks.reverse().find(c => c.endLine < position.lineNumber);
        }
        else {
            codeBlock = codeBlocks.find(c => c.startLine > position.lineNumber);
        }
        if (!codeBlock) {
            return;
        }
        this.setPosition(new Position(codeBlock.startLine, 1), true);
    }
    showLastProvider(id) {
        if (!this._lastProvider || this._lastProvider.options.id !== id) {
            return;
        }
        this.show(this._lastProvider);
    }
    show(provider, symbol, showAccessibleViewHelp, position) {
        provider = provider ?? this._currentProvider;
        if (!provider) {
            return;
        }
        provider.onOpen?.();
        const delegate = {
            getAnchor: () => { return { x: (getActiveWindow().innerWidth / 2) - ((Math.min(this._layoutService.activeContainerDimension.width * 0.62 /* golden cut */, 600 /* DIMENSIONS.MAX_WIDTH */)) / 2), y: this._layoutService.activeContainerOffset.quickPickTop }; },
            render: (container) => {
                this._viewContainer = container;
                this._viewContainer.classList.add('accessible-view-container');
                return this._render(provider, container, showAccessibleViewHelp);
            },
            onHide: () => {
                if (!showAccessibleViewHelp) {
                    this._updateLastProvider();
                    this._currentProvider?.dispose();
                    this._currentProvider = undefined;
                    this._resetContextKeys();
                }
            }
        };
        this._contextViewService.showContextView(delegate);
        if (position) {
            // Context view takes time to show up, so we need to wait for it to show up before we can set the position
            queueMicrotask(() => {
                this._editorWidget.revealLine(position.lineNumber);
                this._editorWidget.setSelection({ startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: position.column });
            });
        }
        if (symbol && this._currentProvider) {
            this.showSymbol(this._currentProvider, symbol);
        }
        if (provider instanceof AccessibleContentProvider && provider.onDidRequestClearLastProvider) {
            this._register(provider.onDidRequestClearLastProvider((id) => {
                if (this._lastProvider?.options.id === id) {
                    this._lastProvider = undefined;
                }
            }));
        }
        if (provider.options.id) {
            // only cache a provider with an ID so that it will eventually be cleared.
            this._lastProvider = provider;
        }
        if (provider.id === "panelChat" /* AccessibleViewProviderId.PanelChat */ || provider.id === "quickChat" /* AccessibleViewProviderId.QuickChat */) {
            this._register(this._codeBlockContextProviderService.registerProvider({ getCodeBlockContext: () => this.getCodeBlockContext() }, 'accessibleView'));
        }
        if (provider instanceof ExtensionContentProvider) {
            this._storageService.store(`${ACCESSIBLE_VIEW_SHOWN_STORAGE_PREFIX}${provider.id}`, true, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
        }
        if (provider.onDidChangeContent) {
            this._register(provider.onDidChangeContent(() => {
                if (this._viewContainer) {
                    this._render(provider, this._viewContainer, showAccessibleViewHelp);
                }
            }));
        }
    }
    previous() {
        const newContent = this._currentProvider?.providePreviousContent?.();
        if (!this._currentProvider || !this._viewContainer || !newContent) {
            return;
        }
        this._render(this._currentProvider, this._viewContainer, undefined, newContent);
    }
    next() {
        const newContent = this._currentProvider?.provideNextContent?.();
        if (!this._currentProvider || !this._viewContainer || !newContent) {
            return;
        }
        this._render(this._currentProvider, this._viewContainer, undefined, newContent);
    }
    _verbosityEnabled() {
        if (!this._currentProvider) {
            return false;
        }
        return isIAccessibleViewContentProvider(this._currentProvider) ? this._configurationService.getValue(this._currentProvider.verbositySettingKey) === true : this._storageService.getBoolean(`${ACCESSIBLE_VIEW_SHOWN_STORAGE_PREFIX}${this._currentProvider.id}`, -1 /* StorageScope.APPLICATION */, false);
    }
    goToSymbol() {
        if (!this._currentProvider) {
            return;
        }
        this._isInQuickPick = true;
        this._instantiationService.createInstance(AccessibleViewSymbolQuickPick, this).show(this._currentProvider);
    }
    calculateCodeBlocks(markdown) {
        if (!markdown) {
            return;
        }
        if (this._currentProvider?.id !== "panelChat" /* AccessibleViewProviderId.PanelChat */ && this._currentProvider?.id !== "quickChat" /* AccessibleViewProviderId.QuickChat */) {
            return;
        }
        if (this._currentProvider.options.language && this._currentProvider.options.language !== 'markdown') {
            // Symbols haven't been provided and we cannot parse this language
            return;
        }
        const lines = markdown.split('\n');
        this._codeBlocks = [];
        let inBlock = false;
        let startLine = 0;
        let languageId;
        lines.forEach((line, i) => {
            if (!inBlock && line.startsWith('```')) {
                inBlock = true;
                startLine = i + 1;
                languageId = line.substring(3).trim();
            }
            else if (inBlock && line.endsWith('```')) {
                inBlock = false;
                const endLine = i;
                const code = lines.slice(startLine, endLine).join('\n');
                this._codeBlocks?.push({ startLine, endLine, code, languageId, chatSessionResource: undefined });
            }
        });
        this._accessibleViewContainsCodeBlocks.set(this._codeBlocks.length > 0);
    }
    getSymbols() {
        const provider = this._currentProvider ? this._currentProvider : undefined;
        if (!this._currentContent || !provider) {
            return;
        }
        const symbols = 'getSymbols' in provider ? provider.getSymbols?.() || [] : [];
        if (symbols?.length) {
            return symbols;
        }
        if (provider.options.language && provider.options.language !== 'markdown') {
            // Symbols haven't been provided and we cannot parse this language
            return;
        }
        const markdownTokens = marked.marked.lexer(this._currentContent);
        if (!markdownTokens) {
            return;
        }
        this._convertTokensToSymbols(markdownTokens, symbols);
        return symbols.length ? symbols : undefined;
    }
    openHelpLink() {
        if (!this._currentProvider?.options.readMoreUrl) {
            return;
        }
        this._openerService.open(URI.parse(this._currentProvider.options.readMoreUrl));
    }
    configureKeybindings(unassigned) {
        this._isInQuickPick = true;
        const provider = this._updateLastProvider();
        const items = unassigned ? provider?.options?.configureKeybindingItems : provider?.options?.configuredKeybindingItems;
        if (!items) {
            return;
        }
        const disposables = this._register(new DisposableStore());
        const quickPick = disposables.add(this._quickInputService.createQuickPick());
        quickPick.items = items;
        quickPick.title = localize('keybindings', 'Configure keybindings');
        quickPick.placeholder = localize('selectKeybinding', 'Select a command ID to configure a keybinding for it');
        quickPick.show();
        disposables.add(quickPick.onDidAccept(async () => {
            const item = quickPick.selectedItems[0];
            if (item) {
                await this._commandService.executeCommand('workbench.action.openGlobalKeybindings', item.id);
            }
            quickPick.dispose();
        }));
        disposables.add(quickPick.onDidHide(() => {
            if (!quickPick.selectedItems.length && provider) {
                this.show(provider);
            }
            disposables.dispose();
            this._isInQuickPick = false;
        }));
    }
    _convertTokensToSymbols(tokens, symbols) {
        let firstListItem;
        for (const token of tokens) {
            let label = undefined;
            if ('type' in token) {
                switch (token.type) {
                    case 'heading':
                    case 'paragraph':
                    case 'code':
                        label = token.text;
                        break;
                    case 'list': {
                        const firstItem = token.items[0];
                        if (!firstItem) {
                            break;
                        }
                        firstListItem = `- ${firstItem.text}`;
                        label = token.items.map(i => i.text).join(', ');
                        break;
                    }
                }
            }
            if (label) {
                symbols.push({ markdownToParse: label, label: localize('symbolLabel', "({0}) {1}", token.type, label), ariaLabel: localize('symbolLabelAria', "({0}) {1}", token.type, label), firstListItem });
                firstListItem = undefined;
            }
        }
    }
    showSymbol(provider, symbol) {
        if (!this._currentContent) {
            return;
        }
        let lineNumber = symbol.lineNumber;
        const markdownToParse = symbol.markdownToParse;
        if (lineNumber === undefined && markdownToParse === undefined) {
            // No symbols provided and we cannot parse this language
            return;
        }
        if (lineNumber === undefined && markdownToParse) {
            // Note that this scales poorly, thus isn't used for worst case scenarios like the terminal, for which a line number will always be provided.
            // Parse the markdown to find the line number
            const index = this._currentContent.split('\n').findIndex(line => line.includes(markdownToParse.split('\n')[0]) || (symbol.firstListItem && line.includes(symbol.firstListItem))) ?? -1;
            if (index >= 0) {
                lineNumber = index + 1;
            }
        }
        if (lineNumber === undefined) {
            return;
        }
        this._isInQuickPick = false;
        this.show(provider, undefined, undefined, { lineNumber, column: 1 });
        this._updateContextKeys(provider, true);
    }
    disableHint() {
        if (!isIAccessibleViewContentProvider(this._currentProvider)) {
            return;
        }
        this._configurationService.updateValue(this._currentProvider?.verbositySettingKey, false);
        alert(localize('disableAccessibilityHelp', '{0} accessibility verbosity is now disabled', this._currentProvider.verbositySettingKey));
    }
    _updateContextKeys(provider, shown) {
        if (provider.options.type === "help" /* AccessibleViewType.Help */) {
            this._accessiblityHelpIsShown.set(shown);
            this._accessibleViewIsShown.reset();
        }
        else {
            this._accessibleViewIsShown.set(shown);
            this._accessiblityHelpIsShown.reset();
        }
        this._accessibleViewSupportsNavigation.set(provider.provideNextContent !== undefined || provider.providePreviousContent !== undefined);
        this._accessibleViewVerbosityEnabled.set(this._verbosityEnabled());
        this._accessibleViewGoToSymbolSupported.set(this._goToSymbolsSupported() ? this.getSymbols()?.length > 0 : false);
    }
    _updateContent(provider, updatedContent) {
        let content = updatedContent ?? provider.provideContent();
        if (provider.options.type === "view" /* AccessibleViewType.View */) {
            this._currentContent = content;
            this._hasUnassignedKeybindings.reset();
            this._hasAssignedKeybindings.reset();
            return;
        }
        const readMoreLinkHint = this._readMoreHint(provider);
        const disableHelpHint = this._disableVerbosityHint(provider);
        const screenReaderModeHint = this._screenReaderModeHint(provider);
        const exitThisDialogHint = this._exitDialogHint(provider);
        let configureKbHint = '';
        let configureAssignedKbHint = '';
        const resolvedContent = resolveContentAndKeybindingItems(this._keybindingService, screenReaderModeHint + content + readMoreLinkHint + disableHelpHint + exitThisDialogHint);
        if (resolvedContent) {
            content = resolvedContent.content.value;
            if (resolvedContent.configureKeybindingItems) {
                provider.options.configureKeybindingItems = resolvedContent.configureKeybindingItems;
                this._hasUnassignedKeybindings.set(true);
                configureKbHint = this._configureUnassignedKbHint();
            }
            else {
                this._hasAssignedKeybindings.reset();
            }
            if (resolvedContent.configuredKeybindingItems) {
                provider.options.configuredKeybindingItems = resolvedContent.configuredKeybindingItems;
                this._hasAssignedKeybindings.set(true);
                configureAssignedKbHint = this._configureAssignedKbHint();
            }
            else {
                this._hasAssignedKeybindings.reset();
            }
        }
        this._currentContent = content + configureKbHint + configureAssignedKbHint;
    }
    _render(provider, container, showAccessibleViewHelp, updatedContent) {
        this._currentProvider = provider;
        this._accessibleViewCurrentProviderId.set(provider.id);
        const verbose = this._verbosityEnabled();
        this._updateContent(provider, updatedContent);
        this.calculateCodeBlocks(this._currentContent);
        this._updateContextKeys(provider, true);
        const widgetIsFocused = this._editorWidget.hasTextFocus() || this._editorWidget.hasWidgetFocus();
        this._getTextModel(URI.from({ path: `accessible-view-${provider.id}`, scheme: Schemas.accessibleView, fragment: this._currentContent })).then((model) => {
            if (!model) {
                return;
            }
            this._editorWidget.setModel(model);
            const domNode = this._editorWidget.getDomNode();
            if (!domNode) {
                return;
            }
            model.setLanguage(provider.options.language ?? 'markdown');
            container.appendChild(this._container);
            let actionsHint = '';
            const hasActions = this._accessibleViewSupportsNavigation.get() || this._accessibleViewVerbosityEnabled.get() || this._accessibleViewGoToSymbolSupported.get() || provider.actions?.length;
            if (verbose && !showAccessibleViewHelp && hasActions) {
                actionsHint = provider.options.position ? localize('ariaAccessibleViewActionsBottom', 'Explore actions such as disabling this hint (Shift+Tab), use Escape to exit this dialog.') : localize('ariaAccessibleViewActions', 'Explore actions such as disabling this hint (Shift+Tab).');
            }
            let ariaLabel = provider.options.type === "help" /* AccessibleViewType.Help */ ? localize('accessibility-help', "Accessibility Help") : localize('accessible-view', "Accessible View");
            this._title.textContent = ariaLabel;
            if (actionsHint && provider.options.type === "view" /* AccessibleViewType.View */) {
                ariaLabel = localize('accessible-view-hint', "Accessible View, {0}", actionsHint);
            }
            else if (actionsHint) {
                ariaLabel = localize('accessibility-help-hint', "Accessibility Help, {0}", actionsHint);
            }
            if (isWindows && widgetIsFocused) {
                // prevent the screen reader on windows from reading
                // the aria label again when it's refocused
                ariaLabel = '';
            }
            this._editorWidget.updateOptions({ ariaLabel });
            this._editorWidget.focus();
            if (this._currentProvider?.options.position) {
                const position = this._editorWidget.getPosition();
                const isDefaultPosition = position?.lineNumber === 1 && position.column === 1;
                if (this._currentProvider.options.position === 'bottom' || this._currentProvider.options.position === 'initial-bottom' && isDefaultPosition) {
                    const lastLine = this.editorWidget.getModel()?.getLineCount();
                    const position = lastLine !== undefined && lastLine > 0 ? new Position(lastLine, 1) : undefined;
                    if (position) {
                        this._editorWidget.setPosition(position);
                        this._editorWidget.revealLine(position.lineNumber);
                    }
                }
            }
        });
        this._updateToolbar(this._currentProvider.actions, provider.options.type);
        const hide = (e) => {
            const thisWindowIsFocused = getWindow(this._editorWidget.getDomNode()).document.hasFocus();
            if (!thisWindowIsFocused) {
                // When switching windows, keep accessible view open
                e?.preventDefault();
                e?.stopPropagation();
                return;
            }
            if (!this._isInQuickPick) {
                provider.onClose();
            }
            e?.stopPropagation();
            this._contextViewService.hideContextView();
            if (this._isInQuickPick) {
                return;
            }
            this._updateContextKeys(provider, false);
            this._lastProvider = undefined;
            this._currentContent = undefined;
            this._currentProvider?.dispose();
            this._currentProvider = undefined;
        };
        const disposableStore = new DisposableStore();
        disposableStore.add(this._editorWidget.onKeyDown((e) => {
            if (e.keyCode === 3 /* KeyCode.Enter */) {
                this._commandService.executeCommand('editor.action.openLink');
            }
            else if (e.keyCode === 9 /* KeyCode.Escape */ || shouldHide(e.browserEvent, this._keybindingService, this._configurationService)) {
                hide(e);
            }
            else if (e.keyCode === 38 /* KeyCode.KeyH */ && provider.options.readMoreUrl) {
                const url = provider.options.readMoreUrl;
                alert(AccessibilityHelpNLS.openingDocs);
                this._openerService.open(URI.parse(url));
                e.preventDefault();
                e.stopPropagation();
            }
            if (provider instanceof AccessibleContentProvider) {
                provider.onKeyDown?.(e);
            }
        }));
        disposableStore.add(addDisposableListener(this._toolbar.getElement(), EventType.KEY_DOWN, (e) => {
            const keyboardEvent = new StandardKeyboardEvent(e);
            if (keyboardEvent.equals(9 /* KeyCode.Escape */)) {
                hide(e);
            }
        }));
        disposableStore.add(this._editorWidget.onDidBlurEditorWidget(() => {
            if (!isActiveElement(this._toolbar.getElement())) {
                hide();
            }
        }));
        disposableStore.add(this._editorWidget.onDidContentSizeChange(() => this._layout()));
        disposableStore.add(this._layoutService.onDidLayoutActiveContainer(() => this._layout()));
        return disposableStore;
    }
    _updateToolbar(providedActions, type) {
        this._toolbar.setAriaLabel(type === "help" /* AccessibleViewType.Help */ ? localize('accessibleHelpToolbar', 'Accessibility Help') : localize('accessibleViewToolbar', "Accessible View"));
        const toolbarMenu = this._register(this._menuService.createMenu(MenuId.AccessibleView, this._contextKeyService));
        const menuActions = getFlatActionBarActions(toolbarMenu.getActions({}));
        if (providedActions) {
            for (const providedAction of providedActions) {
                providedAction.class = providedAction.class || ThemeIcon.asClassName(Codicon.primitiveSquare);
                providedAction.checked = undefined;
            }
            this._toolbar.setActions([...providedActions, ...menuActions]);
        }
        else {
            this._toolbar.setActions(menuActions);
        }
    }
    _layout() {
        const dimension = this._layoutService.activeContainerDimension;
        const maxHeight = dimension.height && dimension.height * .4;
        const height = Math.min(maxHeight, this._editorWidget.getContentHeight());
        const width = Math.min(dimension.width * 0.62 /* golden cut */, 600 /* DIMENSIONS.MAX_WIDTH */);
        this._editorWidget.layout({ width, height });
    }
    async _getTextModel(resource) {
        const existing = this._modelService.getModel(resource);
        if (existing && !existing.isDisposed()) {
            return existing;
        }
        return this._modelService.createModel(resource.fragment, null, resource, false);
    }
    _goToSymbolsSupported() {
        if (!this._currentProvider) {
            return false;
        }
        return this._currentProvider.options.type === "help" /* AccessibleViewType.Help */ || this._currentProvider.options.language === 'markdown' || this._currentProvider.options.language === undefined || (this._currentProvider instanceof AccessibleContentProvider && !!this._currentProvider.getSymbols?.());
    }
    _updateLastProvider() {
        const provider = this._currentProvider;
        if (!provider) {
            return;
        }
        const lastProvider = provider instanceof AccessibleContentProvider ? new AccessibleContentProvider(provider.id, provider.options, provider.provideContent.bind(provider), provider.onClose.bind(provider), provider.verbositySettingKey, provider.onOpen?.bind(provider), provider.actions, provider.provideNextContent?.bind(provider), provider.providePreviousContent?.bind(provider), provider.onDidChangeContent?.bind(provider), provider.onKeyDown?.bind(provider), provider.getSymbols?.bind(provider)) : new ExtensionContentProvider(provider.id, provider.options, provider.provideContent.bind(provider), provider.onClose.bind(provider), provider.onOpen?.bind(provider), provider.provideNextContent?.bind(provider), provider.providePreviousContent?.bind(provider), provider.actions, provider.onDidChangeContent?.bind(provider));
        return lastProvider;
    }
    showAccessibleViewHelp() {
        const lastProvider = this._updateLastProvider();
        if (!lastProvider) {
            return;
        }
        let accessibleViewHelpProvider;
        if (lastProvider instanceof AccessibleContentProvider) {
            accessibleViewHelpProvider = new AccessibleContentProvider(lastProvider.id, { type: "help" /* AccessibleViewType.Help */ }, () => lastProvider.options.customHelp ? lastProvider?.options.customHelp() : this._accessibleViewHelpDialogContent(this._goToSymbolsSupported()), () => {
                this._contextViewService.hideContextView();
                // HACK: Delay to allow the context view to hide #207638
                queueMicrotask(() => this.show(lastProvider));
            }, lastProvider.verbositySettingKey);
        }
        else {
            accessibleViewHelpProvider = new ExtensionContentProvider(lastProvider.id, { type: "help" /* AccessibleViewType.Help */ }, () => lastProvider.options.customHelp ? lastProvider?.options.customHelp() : this._accessibleViewHelpDialogContent(this._goToSymbolsSupported()), () => {
                this._contextViewService.hideContextView();
                // HACK: Delay to allow the context view to hide #207638
                queueMicrotask(() => this.show(lastProvider));
            });
        }
        this._contextViewService.hideContextView();
        // HACK: Delay to allow the context view to hide #186514
        if (accessibleViewHelpProvider) {
            queueMicrotask(() => this.show(accessibleViewHelpProvider, undefined, true));
        }
    }
    _accessibleViewHelpDialogContent(providerHasSymbols) {
        const navigationHint = this._navigationHint();
        const goToSymbolHint = this._goToSymbolHint(providerHasSymbols);
        const toolbarHint = localize('toolbar', "Navigate to the toolbar (Shift+Tab).");
        const chatHints = this._getChatHints();
        let hint = localize('intro', "In the accessible view, you can:\n");
        if (navigationHint) {
            hint += ' - ' + navigationHint + '\n';
        }
        if (goToSymbolHint) {
            hint += ' - ' + goToSymbolHint + '\n';
        }
        if (toolbarHint) {
            hint += ' - ' + toolbarHint + '\n';
        }
        if (chatHints) {
            hint += chatHints;
        }
        return hint;
    }
    _getChatHints() {
        if (this._currentProvider?.id !== "panelChat" /* AccessibleViewProviderId.PanelChat */ && this._currentProvider?.id !== "quickChat" /* AccessibleViewProviderId.QuickChat */) {
            return;
        }
        return [localize('insertAtCursor', " - Insert the code block at the cursor{0}.", '<keybinding:workbench.action.chat.insertCodeBlock>'),
            localize('insertIntoNewFile', " - Insert the code block into a new file{0}.", '<keybinding:workbench.action.chat.insertIntoNewFile>'),
            localize('runInTerminal', " - Run the code block in the terminal{0}.\n", '<keybinding:workbench.action.chat.runInTerminal>')].join('\n');
    }
    _navigationHint() {
        return localize('accessibleViewNextPreviousHint', "Show the next item{0} or previous item{1}.", `<keybinding:${"editor.action.accessibleViewNext" /* AccessibilityCommandId.ShowNext */}`, `<keybinding:${"editor.action.accessibleViewPrevious" /* AccessibilityCommandId.ShowPrevious */}>`);
    }
    _disableVerbosityHint(provider) {
        if (provider.options.type === "help" /* AccessibleViewType.Help */ && this._verbosityEnabled()) {
            return localize('acessibleViewDisableHint', "\nDisable accessibility verbosity for this feature{0}.", `<keybinding:${"editor.action.accessibleViewDisableHint" /* AccessibilityCommandId.DisableVerbosityHint */}>`);
        }
        return '';
    }
    _goToSymbolHint(providerHasSymbols) {
        if (!providerHasSymbols) {
            return;
        }
        return localize('goToSymbolHint', 'Go to a symbol{0}.', `<keybinding:${"editor.action.accessibleViewGoToSymbol" /* AccessibilityCommandId.GoToSymbol */}>`);
    }
    _configureUnassignedKbHint() {
        const configureKb = this._keybindingService.lookupKeybinding("editor.action.accessibilityHelpConfigureKeybindings" /* AccessibilityCommandId.AccessibilityHelpConfigureKeybindings */)?.getAriaLabel();
        const keybindingToConfigureQuickPick = configureKb ? '(' + configureKb + ')' : 'by assigning a keybinding to the command Accessibility Help Configure Unassigned Keybindings.';
        return localize('configureKb', '\nConfigure keybindings for commands that lack them {0}.', keybindingToConfigureQuickPick);
    }
    _configureAssignedKbHint() {
        const configureKb = this._keybindingService.lookupKeybinding("editor.action.accessibilityHelpConfigureAssignedKeybindings" /* AccessibilityCommandId.AccessibilityHelpConfigureAssignedKeybindings */)?.getAriaLabel();
        const keybindingToConfigureQuickPick = configureKb ? '(' + configureKb + ')' : 'by assigning a keybinding to the command Accessibility Help Configure Assigned Keybindings.';
        return localize('configureKbAssigned', '\nConfigure keybindings for commands that already have assignments {0}.', keybindingToConfigureQuickPick);
    }
    _screenReaderModeHint(provider) {
        const accessibilitySupport = this._accessibilityService.isScreenReaderOptimized();
        let screenReaderModeHint = '';
        const turnOnMessage = (isMacintosh
            ? AccessibilityHelpNLS.changeConfigToOnMac
            : AccessibilityHelpNLS.changeConfigToOnWinLinux);
        if (accessibilitySupport && provider.id === "editor" /* AccessibleViewProviderId.Editor */) {
            screenReaderModeHint = AccessibilityHelpNLS.auto_on;
            screenReaderModeHint += '\n';
        }
        else if (!accessibilitySupport) {
            screenReaderModeHint = AccessibilityHelpNLS.auto_off + '\n' + turnOnMessage;
            screenReaderModeHint += '\n';
        }
        return screenReaderModeHint;
    }
    _exitDialogHint(provider) {
        return this._verbosityEnabled() && !provider.options.position ? localize('exit', '\nExit this dialog (Escape).') : '';
    }
    _readMoreHint(provider) {
        return provider.options.readMoreUrl ? localize("openDoc", "\nOpen a browser window with more information related to accessibility{0}.", `<keybinding:${"editor.action.accessibilityHelpOpenHelpLink" /* AccessibilityCommandId.AccessibilityHelpOpenHelpLink */}>`) : '';
    }
};
AccessibleView = __decorate([
    __param(0, IOpenerService),
    __param(1, IInstantiationService),
    __param(2, IConfigurationService),
    __param(3, IModelService),
    __param(4, IContextViewService),
    __param(5, IContextKeyService),
    __param(6, IAccessibilityService),
    __param(7, IKeybindingService),
    __param(8, ILayoutService),
    __param(9, IMenuService),
    __param(10, ICommandService),
    __param(11, IChatCodeBlockContextProviderService),
    __param(12, IStorageService),
    __param(13, ITextModelService),
    __param(14, IQuickInputService),
    __param(15, IAccessibilitySignalService)
], AccessibleView);
export { AccessibleView };
let AccessibleViewService = class AccessibleViewService extends Disposable {
    constructor(_instantiationService, _configurationService, _keybindingService) {
        super();
        this._instantiationService = _instantiationService;
        this._configurationService = _configurationService;
        this._keybindingService = _keybindingService;
    }
    show(provider, position) {
        if (!this._accessibleView) {
            this._accessibleView = this._register(this._instantiationService.createInstance(AccessibleView));
        }
        this._accessibleView.show(provider, undefined, undefined, position);
    }
    configureKeybindings(unassigned) {
        this._accessibleView?.configureKeybindings(unassigned);
    }
    openHelpLink() {
        this._accessibleView?.openHelpLink();
    }
    showLastProvider(id) {
        this._accessibleView?.showLastProvider(id);
    }
    next() {
        this._accessibleView?.next();
    }
    previous() {
        this._accessibleView?.previous();
    }
    goToSymbol() {
        this._accessibleView?.goToSymbol();
    }
    getOpenAriaHint(verbositySettingKey) {
        if (!this._configurationService.getValue(verbositySettingKey)) {
            return null;
        }
        const keybinding = this._keybindingService.lookupKeybinding("editor.action.accessibleView" /* AccessibilityCommandId.OpenAccessibleView */)?.getAriaLabel();
        let hint = null;
        if (keybinding) {
            hint = localize('acessibleViewHint', "Inspect this in the accessible view with {0}", keybinding);
        }
        else {
            hint = localize('acessibleViewHintNoKbEither', "Inspect this in the accessible view via the command Open Accessible View which is currently not triggerable via keybinding.");
        }
        return hint;
    }
    disableHint() {
        this._accessibleView?.disableHint();
    }
    showAccessibleViewHelp() {
        this._accessibleView?.showAccessibleViewHelp();
    }
    getPosition(id) {
        return this._accessibleView?.getPosition(id) ?? undefined;
    }
    getLastPosition() {
        const lastLine = this._accessibleView?.editorWidget.getModel()?.getLineCount();
        return lastLine !== undefined && lastLine > 0 ? new Position(lastLine, 1) : undefined;
    }
    setPosition(position, reveal, select) {
        this._accessibleView?.setPosition(position, reveal, select);
    }
    getCodeBlockContext() {
        return this._accessibleView?.getCodeBlockContext();
    }
    navigateToCodeBlock(type) {
        this._accessibleView?.navigateToCodeBlock(type);
    }
};
AccessibleViewService = __decorate([
    __param(0, IInstantiationService),
    __param(1, IConfigurationService),
    __param(2, IKeybindingService)
], AccessibleViewService);
export { AccessibleViewService };
let AccessibleViewSymbolQuickPick = class AccessibleViewSymbolQuickPick {
    constructor(_accessibleView, _quickInputService) {
        this._accessibleView = _accessibleView;
        this._quickInputService = _quickInputService;
    }
    show(provider) {
        const disposables = new DisposableStore();
        const quickPick = disposables.add(this._quickInputService.createQuickPick());
        quickPick.placeholder = localize('accessibleViewSymbolQuickPickPlaceholder', "Type to search symbols");
        quickPick.title = localize('accessibleViewSymbolQuickPickTitle', "Go to Symbol Accessible View");
        const picks = [];
        const symbols = this._accessibleView.getSymbols();
        if (!symbols) {
            return;
        }
        for (const symbol of symbols) {
            picks.push({
                label: symbol.label,
                ariaLabel: symbol.ariaLabel,
                firstListItem: symbol.firstListItem,
                lineNumber: symbol.lineNumber,
                endLineNumber: symbol.endLineNumber,
                markdownToParse: symbol.markdownToParse
            });
        }
        quickPick.canSelectMany = false;
        quickPick.items = picks;
        quickPick.show();
        disposables.add(quickPick.onDidAccept(() => {
            this._accessibleView.showSymbol(provider, quickPick.selectedItems[0]);
            quickPick.hide();
        }));
        disposables.add(quickPick.onDidHide(() => {
            if (quickPick.selectedItems.length === 0) {
                // this was escaped, so refocus the accessible view
                this._accessibleView.show(provider);
            }
            disposables.dispose();
        }));
    }
};
AccessibleViewSymbolQuickPick = __decorate([
    __param(1, IQuickInputService)
], AccessibleViewSymbolQuickPick);
function shouldHide(event, keybindingService, configurationService) {
    if (!configurationService.getValue("accessibility.accessibleView.closeOnKeyPress" /* AccessibilityWorkbenchSettingId.AccessibleViewCloseOnKeyPress */)) {
        return false;
    }
    const standardKeyboardEvent = new StandardKeyboardEvent(event);
    const resolveResult = keybindingService.softDispatch(standardKeyboardEvent, standardKeyboardEvent.target);
    const isValidChord = resolveResult.kind === 1 /* ResultKind.MoreChordsNeeded */;
    if (keybindingService.inChordMode || isValidChord) {
        return false;
    }
    return shouldHandleKey(event) && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;
}
function shouldHandleKey(event) {
    return !!event.code.match(/^(Key[A-Z]|Digit[0-9]|Equal|Comma|Period|Slash|Quote|Backquote|Backslash|Minus|Semicolon|Space|Enter)$/);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWNjZXNzaWJsZVZpZXcuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvYWNjZXNzaWJpbGl0eS9icm93c2VyL2FjY2Vzc2libGVWaWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxTQUFTLEVBQUUscUJBQXFCLEVBQUUsZUFBZSxFQUFFLFNBQVMsRUFBRSxlQUFlLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNoSSxPQUFPLEVBQWtCLHFCQUFxQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFFbEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRWpFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUU5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hHLE9BQU8sS0FBSyxNQUFNLE1BQU0sMENBQTBDLENBQUM7QUFDbkUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDN0UsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVyRCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsZ0JBQWdCLEVBQTRCLE1BQU0sa0VBQWtFLENBQUM7QUFDOUgsT0FBTyxFQUFhLFFBQVEsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBRWpGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM1RSxPQUFPLEVBQTZCLGlCQUFpQixF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