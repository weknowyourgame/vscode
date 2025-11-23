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
import { $, append } from '../../../../../base/browser/dom.js';
import { DEFAULT_FONT_FAMILY } from '../../../../../base/browser/fonts.js';
import { Widget } from '../../../../../base/browser/ui/widget.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { HistoryNavigator } from '../../../../../base/common/history.js';
import { mixin } from '../../../../../base/common/objects.js';
import { isMacintosh } from '../../../../../base/common/platform.js';
import { URI as uri } from '../../../../../base/common/uri.js';
import './suggestEnabledInput.css';
import { EditorExtensionsRegistry } from '../../../../../editor/browser/editorExtensions.js';
import { CodeEditorWidget } from '../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { EditOperation } from '../../../../../editor/common/core/editOperation.js';
import { Position } from '../../../../../editor/common/core/position.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { ensureValidWordDefinition, getWordAtText } from '../../../../../editor/common/core/wordHelper.js';
import { ILanguageFeaturesService } from '../../../../../editor/common/services/languageFeatures.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { ContextMenuController } from '../../../../../editor/contrib/contextmenu/browser/contextmenu.js';
import { SnippetController2 } from '../../../../../editor/contrib/snippet/browser/snippetController2.js';
import { SuggestController } from '../../../../../editor/contrib/suggest/browser/suggestController.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { registerAndCreateHistoryNavigationContext } from '../../../../../platform/history/browser/contextScopedHistoryWidget.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { asCssVariable, asCssVariableWithDefault, inputBackground, inputBorder, inputForeground, inputPlaceholderForeground } from '../../../../../platform/theme/common/colorRegistry.js';
import { MenuPreventer } from '../menuPreventer.js';
import { SelectionClipboardContributionID } from '../selectionClipboard.js';
import { getSimpleEditorOptions, setupSimpleEditorSelectionStyling } from '../simpleEditorOptions.js';
let SuggestEnabledInput = class SuggestEnabledInput extends Widget {
    constructor(id, parent, suggestionProvider, ariaLabel, resourceHandle, options, defaultInstantiationService, modelService, contextKeyService, languageFeaturesService, configurationService) {
        super();
        this._onShouldFocusResults = new Emitter();
        this.onShouldFocusResults = this._onShouldFocusResults.event;
        this._onInputDidChange = new Emitter();
        this.onInputDidChange = this._onInputDidChange.event;
        this._onDidFocus = this._register(new Emitter());
        this.onDidFocus = this._onDidFocus.event;
        this._onDidBlur = this._register(new Emitter());
        this.onDidBlur = this._onDidBlur.event;
        this.stylingContainer = append(parent, $('.suggest-input-container'));
        this.element = parent;
        this.placeholderText = append(this.stylingContainer, $('.suggest-input-placeholder', undefined, options.placeholderText || ''));
        const editorOptions = mixin(getSimpleEditorOptions(configurationService), getSuggestEnabledInputOptions(ariaLabel));
        editorOptions.overflowWidgetsDomNode = options.overflowWidgetsDomNode;
        const scopedContextKeyService = this.getScopedContextKeyService(contextKeyService);
        const instantiationService = scopedContextKeyService
            ? this._register(defaultInstantiationService.createChild(new ServiceCollection([IContextKeyService, scopedContextKeyService])))
            : defaultInstantiationService;
        this.inputWidget = this._register(instantiationService.createInstance(CodeEditorWidget, this.stylingContainer, editorOptions, {
            contributions: EditorExtensionsRegistry.getSomeEditorContributions([
                SuggestController.ID,
                SnippetController2.ID,
                ContextMenuController.ID,
                MenuPreventer.ID,
                SelectionClipboardContributionID,
            ]),
            isSimpleWidget: true,
        }));
        this._register(configurationService.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('editor.accessibilitySupport') ||
                e.affectsConfiguration('editor.cursorBlinking')) {
                const accessibilitySupport = configurationService.getValue('editor.accessibilitySupport');
                const cursorBlinking = configurationService.getValue('editor.cursorBlinking');
                this.inputWidget.updateOptions({
                    accessibilitySupport,
                    cursorBlinking
                });
            }
        }));
        this._register(this.inputWidget.onDidFocusEditorText(() => this._onDidFocus.fire()));
        this._register(this.inputWidget.onDidBlurEditorText(() => this._onDidBlur.fire()));
        const scopeHandle = uri.parse(resourceHandle);
        this.inputModel = modelService.createModel('', null, scopeHandle, true);
        this._register(this.inputModel);
        this.inputWidget.setModel(this.inputModel);
        this._register(this.inputWidget.onDidPaste(() => this.setValue(this.getValue()))); // setter cleanses
        this._register((this.inputWidget.onDidFocusEditorText(() => {
            if (options.focusContextKey) {
                options.focusContextKey.set(true);
            }
            this.stylingContainer.classList.add('synthetic-focus');
        })));
        this._register((this.inputWidget.onDidBlurEditorText(() => {
            if (options.focusContextKey) {
                options.focusContextKey.set(false);
            }
            this.stylingContainer.classList.remove('synthetic-focus');
        })));
        this._register(Event.chain(this.inputWidget.onKeyDown, $ => $.filter(e => e.keyCode === 3 /* KeyCode.Enter */))(e => { e.preventDefault(); /** Do nothing. Enter causes new line which is not expected. */ }, this));
        this._register(Event.chain(this.inputWidget.onKeyDown, $ => $.filter(e => e.keyCode === 18 /* KeyCode.DownArrow */ && (isMacintosh ? e.metaKey : e.ctrlKey)))(() => this._onShouldFocusResults.fire(), this));
        let preexistingContent = this.getValue();
        const inputWidgetModel = this.inputWidget.getModel();
        if (inputWidgetModel) {
            this._register(inputWidgetModel.onDidChangeContent(() => {
                const content = this.getValue();
                this.placeholderText.style.visibility = content ? 'hidden' : 'visible';
                if (preexistingContent.trim() === content.trim()) {
                    return;
                }
                this._onInputDidChange.fire(undefined);
                preexistingContent = content;
            }));
        }
        const validatedSuggestProvider = {
            provideResults: suggestionProvider.provideResults,
            sortKey: suggestionProvider.sortKey || (a => a),
            triggerCharacters: suggestionProvider.triggerCharacters || [],
            wordDefinition: suggestionProvider.wordDefinition ? ensureValidWordDefinition(suggestionProvider.wordDefinition) : undefined,
            alwaysShowSuggestions: !!suggestionProvider.alwaysShowSuggestions,
        };
        this.setValue(options.value || '');
        this._register(languageFeaturesService.completionProvider.register({ scheme: scopeHandle.scheme, pattern: '**/' + scopeHandle.path, hasAccessToAllModels: true }, {
            _debugDisplayName: `suggestEnabledInput/${id}`,
            triggerCharacters: validatedSuggestProvider.triggerCharacters,
            provideCompletionItems: (model, position, _context) => {
                const query = model.getValue();
                const zeroIndexedColumn = position.column - 1;
                let alreadyTypedCount = 0, zeroIndexedWordStart = 0;
                if (validatedSuggestProvider.wordDefinition) {
                    const wordAtText = getWordAtText(position.column, validatedSuggestProvider.wordDefinition, query, 0);
                    alreadyTypedCount = wordAtText?.word.length ?? 0;
                    zeroIndexedWordStart = wordAtText ? wordAtText.startColumn - 1 : 0;
                }
                else {
                    zeroIndexedWordStart = query.lastIndexOf(' ', zeroIndexedColumn - 1) + 1;
                    alreadyTypedCount = zeroIndexedColumn - zeroIndexedWordStart;
                }
                // dont show suggestions if the user has typed something, but hasn't used the trigger character
                if (!validatedSuggestProvider.alwaysShowSuggestions && alreadyTypedCount > 0 && validatedSuggestProvider.triggerCharacters?.indexOf(query[zeroIndexedWordStart]) === -1) {
                    return { suggestions: [] };
                }
                return {
                    suggestions: suggestionProvider.provideResults(query).map((result) => {
                        let label;
                        let rest;
                        if (typeof result === 'string') {
                            label = result;
                        }
                        else {
                            label = result.label;
                            rest = result;
                        }
                        return {
                            label,
                            insertText: label,
                            range: Range.fromPositions(position.delta(0, -alreadyTypedCount), position),
                            sortText: validatedSuggestProvider.sortKey(label),
                            kind: 17 /* languages.CompletionItemKind.Keyword */,
                            ...rest
                        };
                    })
                };
            }
        }));
        this.style(options.styleOverrides || {});
    }
    getScopedContextKeyService(_contextKeyService) {
        return undefined;
    }
    updateAriaLabel(label) {
        this.inputWidget.updateOptions({ ariaLabel: label });
    }
    setValue(val) {
        val = val.replace(/\s/g, ' ');
        const fullRange = this.inputModel.getFullModelRange();
        this.inputWidget.executeEdits('suggestEnabledInput.setValue', [EditOperation.replace(fullRange, val)]);
        this.inputWidget.setScrollTop(0);
        this.inputWidget.setPosition(new Position(1, val.length + 1));
    }
    getValue() {
        return this.inputWidget.getValue();
    }
    style(styleOverrides) {
        this.stylingContainer.style.backgroundColor = asCssVariable(styleOverrides.inputBackground ?? inputBackground);
        this.stylingContainer.style.color = asCssVariable(styleOverrides.inputForeground ?? inputForeground);
        this.placeholderText.style.color = asCssVariable(styleOverrides.inputPlaceholderForeground ?? inputPlaceholderForeground);
        this.stylingContainer.style.borderWidth = '1px';
        this.stylingContainer.style.borderStyle = 'solid';
        this.stylingContainer.style.borderColor = asCssVariableWithDefault(styleOverrides.inputBorder ?? inputBorder, 'transparent');
        // eslint-disable-next-line no-restricted-syntax
        const cursor = this.stylingContainer.getElementsByClassName('cursor')[0];
        if (cursor) {
            cursor.style.backgroundColor = asCssVariable(styleOverrides.inputForeground ?? inputForeground);
        }
    }
    focus(selectAll) {
        this.inputWidget.focus();
        if (selectAll && this.inputWidget.getValue()) {
            this.selectAll();
        }
    }
    onHide() {
        this.inputWidget.onHide();
    }
    layout(dimension) {
        this.inputWidget.layout(dimension);
        this.placeholderText.style.width = `${dimension.width - 2}px`;
    }
    selectAll() {
        this.inputWidget.setSelection(new Range(1, 1, 1, this.getValue().length + 1));
    }
};
SuggestEnabledInput = __decorate([
    __param(6, IInstantiationService),
    __param(7, IModelService),
    __param(8, IContextKeyService),
    __param(9, ILanguageFeaturesService),
    __param(10, IConfigurationService)
], SuggestEnabledInput);
export { SuggestEnabledInput };
let SuggestEnabledInputWithHistory = class SuggestEnabledInputWithHistory extends SuggestEnabledInput {
    constructor({ id, parent, ariaLabel, suggestionProvider, resourceHandle, suggestOptions, history }, instantiationService, modelService, contextKeyService, languageFeaturesService, configurationService) {
        super(id, parent, suggestionProvider, ariaLabel, resourceHandle, suggestOptions, instantiationService, modelService, contextKeyService, languageFeaturesService, configurationService);
        this.history = this._register(new HistoryNavigator(new Set(history), 100));
    }
    addToHistory() {
        const value = this.getValue();
        if (value && value !== this.getCurrentValue()) {
            this.history.add(value);
        }
    }
    getHistory() {
        return this.history.getHistory();
    }
    showNextValue() {
        if (!this.history.has(this.getValue())) {
            this.addToHistory();
        }
        let next = this.getNextValue();
        if (next) {
            next = next === this.getValue() ? this.getNextValue() : next;
        }
        this.setValue(next ?? '');
    }
    showPreviousValue() {
        if (!this.history.has(this.getValue())) {
            this.addToHistory();
        }
        let previous = this.getPreviousValue();
        if (previous) {
            previous = previous === this.getValue() ? this.getPreviousValue() : previous;
        }
        if (previous) {
            this.setValue(previous);
            this.inputWidget.setPosition({ lineNumber: 0, column: 0 });
        }
    }
    clearHistory() {
        this.history.clear();
    }
    getCurrentValue() {
        let currentValue = this.history.current();
        if (!currentValue) {
            currentValue = this.history.last();
            this.history.next();
        }
        return currentValue;
    }
    getPreviousValue() {
        return this.history.previous() || this.history.first();
    }
    getNextValue() {
        return this.history.next();
    }
};
SuggestEnabledInputWithHistory = __decorate([
    __param(1, IInstantiationService),
    __param(2, IModelService),
    __param(3, IContextKeyService),
    __param(4, ILanguageFeaturesService),
    __param(5, IConfigurationService)
], SuggestEnabledInputWithHistory);
export { SuggestEnabledInputWithHistory };
let ContextScopedSuggestEnabledInputWithHistory = class ContextScopedSuggestEnabledInputWithHistory extends SuggestEnabledInputWithHistory {
    constructor(options, instantiationService, modelService, contextKeyService, languageFeaturesService, configurationService) {
        super(options, instantiationService, modelService, contextKeyService, languageFeaturesService, configurationService);
        const { historyNavigationBackwardsEnablement, historyNavigationForwardsEnablement } = this.historyContext;
        this._register(this.inputWidget.onDidChangeCursorPosition(({ position }) => {
            const viewModel = this.inputWidget._getViewModel();
            const lastLineNumber = viewModel.getLineCount();
            const lastLineCol = viewModel.getLineLength(lastLineNumber) + 1;
            const viewPosition = viewModel.coordinatesConverter.convertModelPositionToViewPosition(position);
            historyNavigationBackwardsEnablement.set(viewPosition.lineNumber === 1 && viewPosition.column === 1);
            historyNavigationForwardsEnablement.set(viewPosition.lineNumber === lastLineNumber && viewPosition.column === lastLineCol);
        }));
    }
    getScopedContextKeyService(contextKeyService) {
        const scopedContextKeyService = this._register(contextKeyService.createScoped(this.element));
        this.historyContext = this._register(registerAndCreateHistoryNavigationContext(scopedContextKeyService, this));
        return scopedContextKeyService;
    }
};
ContextScopedSuggestEnabledInputWithHistory = __decorate([
    __param(1, IInstantiationService),
    __param(2, IModelService),
    __param(3, IContextKeyService),
    __param(4, ILanguageFeaturesService),
    __param(5, IConfigurationService)
], ContextScopedSuggestEnabledInputWithHistory);
export { ContextScopedSuggestEnabledInputWithHistory };
setupSimpleEditorSelectionStyling('.suggest-input-container');
function getSuggestEnabledInputOptions(ariaLabel) {
    return {
        fontSize: 13,
        lineHeight: 20,
        wordWrap: 'off',
        scrollbar: { vertical: 'hidden', },
        roundedSelection: false,
        guides: {
            indentation: false
        },
        cursorWidth: 1,
        fontFamily: DEFAULT_FONT_FAMILY,
        ariaLabel: ariaLabel || '',
        snippetSuggestions: 'none',
        suggest: { filterGraceful: false, showIcons: false },
        autoClosingBrackets: 'never'
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3VnZ2VzdEVuYWJsZWRJbnB1dC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvc3VnZ2VzdEVuYWJsZWRJbnB1dC9zdWdnZXN0RW5hYmxlZElucHV0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxDQUFDLEVBQWEsTUFBTSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDMUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFM0UsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDckUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFekUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQzlELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsR0FBRyxJQUFJLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQy9ELE9BQU8sMkJBQTJCLENBQUM7QUFFbkMsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDN0YsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0scUVBQXFFLENBQUM7QUFFdkcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDbkUsT0FBTyxFQUFFLHlCQUF5QixFQUFFLGFBQWEsRUFBRSxNQUFNLGlE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