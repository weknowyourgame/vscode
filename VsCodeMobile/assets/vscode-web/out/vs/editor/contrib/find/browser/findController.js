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
var CommonFindController_1;
import { Delayer } from '../../../../base/common/async.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import * as strings from '../../../../base/common/strings.js';
import { EditorAction, EditorCommand, MultiEditorAction, registerEditorAction, registerEditorCommand, registerEditorContribution, registerMultiEditorAction } from '../../../browser/editorExtensions.js';
import { overviewRulerRangeHighlight } from '../../../common/core/editorColorRegistry.js';
import { EditorContextKeys } from '../../../common/editorContextKeys.js';
import { OverviewRulerLane } from '../../../common/model.js';
import { CONTEXT_FIND_INPUT_FOCUSED, CONTEXT_FIND_WIDGET_VISIBLE, CONTEXT_REPLACE_INPUT_FOCUSED, FindModelBoundToEditorModel, FIND_IDS, ToggleCaseSensitiveKeybinding, TogglePreserveCaseKeybinding, ToggleRegexKeybinding, ToggleSearchScopeKeybinding, ToggleWholeWordKeybinding } from './findModel.js';
import { FindOptionsWidget } from './findOptionsWidget.js';
import { FindReplaceState } from './findState.js';
import { FindWidget } from './findWidget.js';
import * as nls from '../../../../nls.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { themeColorFromId } from '../../../../platform/theme/common/themeService.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { FindWidgetSearchHistory } from './findWidgetSearchHistory.js';
import { ReplaceWidgetHistory } from './replaceWidgetHistory.js';
const SEARCH_STRING_MAX_LENGTH = 524288;
export function getSelectionSearchString(editor, seedSearchStringFromSelection = 'single', seedSearchStringFromNonEmptySelection = false) {
    if (!editor.hasModel()) {
        return null;
    }
    const selection = editor.getSelection();
    // if selection spans multiple lines, default search string to empty
    if ((seedSearchStringFromSelection === 'single' && selection.startLineNumber === selection.endLineNumber)
        || seedSearchStringFromSelection === 'multiple') {
        if (selection.isEmpty()) {
            const wordAtPosition = editor.getConfiguredWordAtPosition(selection.getStartPosition());
            if (wordAtPosition && (false === seedSearchStringFromNonEmptySelection)) {
                return wordAtPosition.word;
            }
        }
        else {
            if (editor.getModel().getValueLengthInRange(selection) < SEARCH_STRING_MAX_LENGTH) {
                return editor.getModel().getValueInRange(selection);
            }
        }
    }
    return null;
}
export var FindStartFocusAction;
(function (FindStartFocusAction) {
    FindStartFocusAction[FindStartFocusAction["NoFocusChange"] = 0] = "NoFocusChange";
    FindStartFocusAction[FindStartFocusAction["FocusFindInput"] = 1] = "FocusFindInput";
    FindStartFocusAction[FindStartFocusAction["FocusReplaceInput"] = 2] = "FocusReplaceInput";
})(FindStartFocusAction || (FindStartFocusAction = {}));
let CommonFindController = class CommonFindController extends Disposable {
    static { CommonFindController_1 = this; }
    static { this.ID = 'editor.contrib.findController'; }
    get editor() {
        return this._editor;
    }
    static get(editor) {
        return editor.getContribution(CommonFindController_1.ID);
    }
    constructor(editor, contextKeyService, storageService, clipboardService, notificationService, hoverService) {
        super();
        this._editor = editor;
        this._findWidgetVisible = CONTEXT_FIND_WIDGET_VISIBLE.bindTo(contextKeyService);
        this._contextKeyService = contextKeyService;
        this._storageService = storageService;
        this._clipboardService = clipboardService;
        this._notificationService = notificationService;
        this._hoverService = hoverService;
        this._updateHistoryDelayer = new Delayer(500);
        this._state = this._register(new FindReplaceState());
        this.loadQueryState();
        this._register(this._state.onFindReplaceStateChange((e) => this._onStateChanged(e)));
        this._model = null;
        this._register(this._editor.onDidChangeModel(() => {
            const shouldRestartFind = (this._editor.getModel() && this._state.isRevealed);
            this.disposeModel();
            this._state.change({
                searchScope: null,
                matchCase: this._storageService.getBoolean('editor.matchCase', 1 /* StorageScope.WORKSPACE */, false),
                wholeWord: this._storageService.getBoolean('editor.wholeWord', 1 /* StorageScope.WORKSPACE */, false),
                isRegex: this._storageService.getBoolean('editor.isRegex', 1 /* StorageScope.WORKSPACE */, false),
                preserveCase: this._storageService.getBoolean('editor.preserveCase', 1 /* StorageScope.WORKSPACE */, false)
            }, false);
            if (shouldRestartFind) {
                this._start({
                    forceRevealReplace: false,
                    seedSearchStringFromSelection: 'none',
                    seedSearchStringFromNonEmptySelection: false,
                    seedSearchStringFromGlobalClipboard: false,
                    shouldFocus: 0 /* FindStartFocusAction.NoFocusChange */,
                    shouldAnimate: false,
                    updateSearchScope: false,
                    loop: this._editor.getOption(50 /* EditorOption.find */).loop
                });
            }
        }));
    }
    dispose() {
        this.disposeModel();
        super.dispose();
    }
    disposeModel() {
        if (this._model) {
            this._model.dispose();
            this._model = null;
        }
    }
    _onStateChanged(e) {
        this.saveQueryState(e);
        if (e.isRevealed) {
            if (this._state.isRevealed) {
                this._findWidgetVisible.set(true);
            }
            else {
                this._findWidgetVisible.reset();
                this.disposeModel();
            }
        }
        if (e.searchString) {
            this.setGlobalBufferTerm(this._state.searchString);
        }
    }
    saveQueryState(e) {
        if (e.isRegex) {
            this._storageService.store('editor.isRegex', this._state.actualIsRegex, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        }
        if (e.wholeWord) {
            this._storageService.store('editor.wholeWord', this._state.actualWholeWord, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        }
        if (e.matchCase) {
            this._storageService.store('editor.matchCase', this._state.actualMatchCase, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        }
        if (e.preserveCase) {
            this._storageService.store('editor.preserveCase', this._state.actualPreserveCase, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        }
    }
    loadQueryState() {
        this._state.change({
            matchCase: this._storageService.getBoolean('editor.matchCase', 1 /* StorageScope.WORKSPACE */, this._state.matchCase),
            wholeWord: this._storageService.getBoolean('editor.wholeWord', 1 /* StorageScope.WORKSPACE */, this._state.wholeWord),
            isRegex: this._storageService.getBoolean('editor.isRegex', 1 /* StorageScope.WORKSPACE */, this._state.isRegex),
            preserveCase: this._storageService.getBoolean('editor.preserveCase', 1 /* StorageScope.WORKSPACE */, this._state.preserveCase)
        }, false);
    }
    isFindInputFocused() {
        return !!CONTEXT_FIND_INPUT_FOCUSED.getValue(this._contextKeyService);
    }
    getState() {
        return this._state;
    }
    closeFindWidget() {
        this._state.change({
            isRevealed: false,
            searchScope: null
        }, false);
        this._editor.focus();
    }
    toggleCaseSensitive() {
        this._state.change({ matchCase: !this._state.matchCase }, false);
        if (!this._state.isRevealed) {
            this.highlightFindOptions();
        }
    }
    toggleWholeWords() {
        this._state.change({ wholeWord: !this._state.wholeWord }, false);
        if (!this._state.isRevealed) {
            this.highlightFindOptions();
        }
    }
    toggleRegex() {
        this._state.change({ isRegex: !this._state.isRegex }, false);
        if (!this._state.isRevealed) {
            this.highlightFindOptions();
        }
    }
    togglePreserveCase() {
        this._state.change({ preserveCase: !this._state.preserveCase }, false);
        if (!this._state.isRevealed) {
            this.highlightFindOptions();
        }
    }
    toggleSearchScope() {
        if (this._state.searchScope) {
            this._state.change({ searchScope: null }, true);
        }
        else {
            if (this._editor.hasModel()) {
                let selections = this._editor.getSelections();
                selections = selections.map(selection => {
                    if (selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber) {
                        selection = selection.setEndPosition(selection.endLineNumber - 1, this._editor.getModel().getLineMaxColumn(selection.endLineNumber - 1));
                    }
                    if (!selection.isEmpty()) {
                        return selection;
                    }
                    return null;
                }).filter((element) => !!element);
                if (selections.length) {
                    this._state.change({ searchScope: selections }, true);
                }
            }
        }
    }
    setSearchString(searchString) {
        if (this._state.isRegex) {
            searchString = strings.escapeRegExpCharacters(searchString);
        }
        this._state.change({ searchString: searchString }, false);
    }
    highlightFindOptions(ignoreWhenVisible = false) {
        // overwritten in subclass
    }
    async _start(opts, newState) {
        this.disposeModel();
        if (!this._editor.hasModel()) {
            // cannot do anything with an editor that doesn't have a model...
            return;
        }
        const stateChanges = {
            ...newState,
            isRevealed: true
        };
        if (opts.seedSearchStringFromSelection === 'single') {
            const selectionSearchString = getSelectionSearchString(this._editor, opts.seedSearchStringFromSelection, opts.seedSearchStringFromNonEmptySelection);
            if (selectionSearchString) {
                if (this._state.isRegex) {
                    stateChanges.searchString = strings.escapeRegExpCharacters(selectionSearchString);
                }
                else {
                    stateChanges.searchString = selectionSearchString;
                }
            }
        }
        else if (opts.seedSearchStringFromSelection === 'multiple' && !opts.updateSearchScope) {
            const selectionSearchString = getSelectionSearchString(this._editor, opts.seedSearchStringFromSelection);
            if (selectionSearchString) {
                stateChanges.searchString = selectionSearchString;
            }
        }
        if (!stateChanges.searchString && opts.seedSearchStringFromGlobalClipboard) {
            const selectionSearchString = await this.getGlobalBufferTerm();
            if (!this._editor.hasModel()) {
                // the editor has lost its model in the meantime
                return;
            }
            if (selectionSearchString) {
                stateChanges.searchString = selectionSearchString;
            }
        }
        // Overwrite isReplaceRevealed
        if (opts.forceRevealReplace || stateChanges.isReplaceRevealed) {
            stateChanges.isReplaceRevealed = true;
        }
        else if (!this._findWidgetVisible.get()) {
            stateChanges.isReplaceRevealed = false;
        }
        if (opts.updateSearchScope) {
            const currentSelections = this._editor.getSelections();
            if (currentSelections.some(selection => !selection.isEmpty())) {
                stateChanges.searchScope = currentSelections;
            }
        }
        stateChanges.loop = opts.loop;
        this._state.change(stateChanges, false);
        if (!this._model) {
            this._model = new FindModelBoundToEditorModel(this._editor, this._state);
        }
    }
    start(opts, newState) {
        return this._start(opts, newState);
    }
    moveToNextMatch() {
        if (this._model) {
            this._model.moveToNextMatch();
            return true;
        }
        return false;
    }
    moveToPrevMatch() {
        if (this._model) {
            this._model.moveToPrevMatch();
            return true;
        }
        return false;
    }
    goToMatch(index) {
        if (this._model) {
            this._model.moveToMatch(index);
            return true;
        }
        return false;
    }
    replace() {
        if (this._model) {
            this._model.replace();
            return true;
        }
        return false;
    }
    replaceAll() {
        if (this._model) {
            if (this._editor.getModel()?.isTooLargeForHeapOperation()) {
                this._notificationService.warn(nls.localize('too.large.for.replaceall', "The file is too large to perform a replace all operation."));
                return false;
            }
            this._model.replaceAll();
            return true;
        }
        return false;
    }
    selectAllMatches() {
        if (this._model) {
            this._model.selectAllMatches();
            this._editor.focus();
            return true;
        }
        return false;
    }
    async getGlobalBufferTerm() {
        if (this._editor.getOption(50 /* EditorOption.find */).globalFindClipboard
            && this._editor.hasModel()
            && !this._editor.getModel().isTooLargeForSyncing()) {
            return this._clipboardService.readFindText();
        }
        return '';
    }
    setGlobalBufferTerm(text) {
        if (this._editor.getOption(50 /* EditorOption.find */).globalFindClipboard
            && this._editor.hasModel()
            && !this._editor.getModel().isTooLargeForSyncing()) {
            // intentionally not awaited
            this._clipboardService.writeFindText(text);
        }
    }
};
CommonFindController = CommonFindController_1 = __decorate([
    __param(1, IContextKeyService),
    __param(2, IStorageService),
    __param(3, IClipboardService),
    __param(4, INotificationService),
    __param(5, IHoverService)
], CommonFindController);
export { CommonFindController };
let FindController = class FindController extends CommonFindController {
    constructor(editor, _contextViewService, _contextKeyService, _keybindingService, notificationService, _storageService, clipboardService, hoverService) {
        super(editor, _contextKeyService, _storageService, clipboardService, notificationService, hoverService);
        this._contextViewService = _contextViewService;
        this._keybindingService = _keybindingService;
        this._widget = null;
        this._findOptionsWidget = null;
        this._findWidgetSearchHistory = FindWidgetSearchHistory.getOrCreate(_storageService);
        this._replaceWidgetHistory = ReplaceWidgetHistory.getOrCreate(_storageService);
    }
    async _start(opts, newState) {
        if (!this._widget) {
            this._createFindWidget();
        }
        const selection = this._editor.getSelection();
        let updateSearchScope = false;
        switch (this._editor.getOption(50 /* EditorOption.find */).autoFindInSelection) {
            case 'always':
                updateSearchScope = true;
                break;
            case 'never':
                updateSearchScope = false;
                break;
            case 'multiline': {
                const isSelectionMultipleLine = !!selection && selection.startLineNumber !== selection.endLineNumber;
                updateSearchScope = isSelectionMultipleLine;
                break;
            }
            default:
                break;
        }
        opts.updateSearchScope = opts.updateSearchScope || updateSearchScope;
        await super._start(opts, newState);
        if (this._widget) {
            if (opts.shouldFocus === 2 /* FindStartFocusAction.FocusReplaceInput */) {
                this._widget.focusReplaceInput();
            }
            else if (opts.shouldFocus === 1 /* FindStartFocusAction.FocusFindInput */) {
                this._widget.focusFindInput();
            }
        }
    }
    highlightFindOptions(ignoreWhenVisible = false) {
        if (!this._widget) {
            this._createFindWidget();
        }
        if (this._state.isRevealed && !ignoreWhenVisible) {
            this._widget.highlightFindOptions();
        }
        else {
            this._findOptionsWidget.highlightFindOptions();
        }
    }
    _createFindWidget() {
        this._widget = this._register(new FindWidget(this._editor, this, this._state, this._contextViewService, this._keybindingService, this._contextKeyService, this._hoverService, this._findWidgetSearchHistory, this._replaceWidgetHistory));
        this._findOptionsWidget = this._register(new FindOptionsWidget(this._editor, this._state, this._keybindingService));
    }
    saveViewState() {
        return this._widget?.getViewState();
    }
    restoreViewState(state) {
        this._widget?.setViewState(state);
    }
};
FindController = __decorate([
    __param(1, IContextViewService),
    __param(2, IContextKeyService),
    __param(3, IKeybindingService),
    __param(4, INotificationService),
    __param(5, IStorageService),
    __param(6, IClipboardService),
    __param(7, IHoverService)
], FindController);
export { FindController };
export const StartFindAction = registerMultiEditorAction(new MultiEditorAction({
    id: FIND_IDS.StartFindAction,
    label: nls.localize2('startFindAction', "Find"),
    precondition: ContextKeyExpr.or(EditorContextKeys.focus, ContextKeyExpr.has('editorIsOpen')),
    kbOpts: {
        kbExpr: null,
        primary: 2048 /* KeyMod.CtrlCmd */ | 36 /* KeyCode.KeyF */,
        weight: 100 /* KeybindingWeight.EditorContrib */
    },
    menuOpts: {
        menuId: MenuId.MenubarEditMenu,
        group: '3_find',
        title: nls.localize({ key: 'miFind', comment: ['&& denotes a mnemonic'] }, "&&Find"),
        order: 1
    }
}));
StartFindAction.addImplementation(0, (accessor, editor, args) => {
    const controller = CommonFindController.get(editor);
    if (!controller) {
        return false;
    }
    return controller.start({
        forceRevealReplace: false,
        seedSearchStringFromSelection: editor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection !== 'never' ? 'single' : 'none',
        seedSearchStringFromNonEmptySelection: editor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection === 'selection',
        seedSearchStringFromGlobalClipboard: editor.getOption(50 /* EditorOption.find */).globalFindClipboard,
        shouldFocus: 1 /* FindStartFocusAction.FocusFindInput */,
        shouldAnimate: true,
        updateSearchScope: false,
        loop: editor.getOption(50 /* EditorOption.find */).loop
    });
});
const findArgDescription = {
    description: 'Open a new In-Editor Find Widget.',
    args: [{
            name: 'Open a new In-Editor Find Widget args',
            schema: {
                properties: {
                    searchString: { type: 'string' },
                    replaceString: { type: 'string' },
                    isRegex: { type: 'boolean' },
                    matchWholeWord: { type: 'boolean' },
                    isCaseSensitive: { type: 'boolean' },
                    preserveCase: { type: 'boolean' },
                    findInSelection: { type: 'boolean' },
                }
            }
        }]
};
export class StartFindWithArgsAction extends EditorAction {
    constructor() {
        super({
            id: FIND_IDS.StartFindWithArgs,
            label: nls.localize2('startFindWithArgsAction', "Find with Arguments"),
            precondition: undefined,
            kbOpts: {
                kbExpr: null,
                primary: 0,
                weight: 100 /* KeybindingWeight.EditorContrib */
            },
            metadata: findArgDescription
        });
    }
    async run(accessor, editor, args) {
        const controller = CommonFindController.get(editor);
        if (controller) {
            const newState = args ? {
                searchString: args.searchString,
                replaceString: args.replaceString,
                isReplaceRevealed: args.replaceString !== undefined,
                isRegex: args.isRegex,
                // isRegexOverride: args.regexOverride,
                wholeWord: args.matchWholeWord,
                // wholeWordOverride: args.wholeWordOverride,
                matchCase: args.isCaseSensitive,
                // matchCaseOverride: args.matchCaseOverride,
                preserveCase: args.preserveCase,
                // preserveCaseOverride: args.preserveCaseOverride,
            } : {};
            await controller.start({
                forceRevealReplace: false,
                seedSearchStringFromSelection: (controller.getState().searchString.length === 0) && editor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection !== 'never' ? 'single' : 'none',
                seedSearchStringFromNonEmptySelection: editor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection === 'selection',
                seedSearchStringFromGlobalClipboard: true,
                shouldFocus: 1 /* FindStartFocusAction.FocusFindInput */,
                shouldAnimate: true,
                updateSearchScope: args?.findInSelection || false,
                loop: editor.getOption(50 /* EditorOption.find */).loop
            }, newState);
            controller.setGlobalBufferTerm(controller.getState().searchString);
        }
    }
}
export class StartFindWithSelectionAction extends EditorAction {
    constructor() {
        super({
            id: FIND_IDS.StartFindWithSelection,
            label: nls.localize2('startFindWithSelectionAction', "Find with Selection"),
            precondition: undefined,
            kbOpts: {
                kbExpr: null,
                primary: 0,
                mac: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 35 /* KeyCode.KeyE */,
                },
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
    async run(accessor, editor) {
        const controller = CommonFindController.get(editor);
        if (controller) {
            await controller.start({
                forceRevealReplace: false,
                seedSearchStringFromSelection: 'multiple',
                seedSearchStringFromNonEmptySelection: false,
                seedSearchStringFromGlobalClipboard: false,
                shouldFocus: 0 /* FindStartFocusAction.NoFocusChange */,
                shouldAnimate: true,
                updateSearchScope: false,
                loop: editor.getOption(50 /* EditorOption.find */).loop
            });
            controller.setGlobalBufferTerm(controller.getState().searchString);
        }
    }
}
export class MatchFindAction extends EditorAction {
    async run(accessor, editor) {
        const controller = CommonFindController.get(editor);
        if (controller && !this._run(controller)) {
            await controller.start({
                forceRevealReplace: false,
                seedSearchStringFromSelection: (controller.getState().searchString.length === 0) && editor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection !== 'never' ? 'single' : 'none',
                seedSearchStringFromNonEmptySelection: editor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection === 'selection',
                seedSearchStringFromGlobalClipboard: true,
                shouldFocus: 0 /* FindStartFocusAction.NoFocusChange */,
                shouldAnimate: true,
                updateSearchScope: false,
                loop: editor.getOption(50 /* EditorOption.find */).loop
            });
            this._run(controller);
        }
    }
}
async function matchFindAction(editor, next) {
    const controller = CommonFindController.get(editor);
    if (!controller) {
        return;
    }
    const runMatch = () => {
        const result = next ? controller.moveToNextMatch() : controller.moveToPrevMatch();
        if (result) {
            controller.editor.pushUndoStop();
            return true;
        }
        return false;
    };
    if (!runMatch()) {
        await controller.start({
            forceRevealReplace: false,
            seedSearchStringFromSelection: (controller.getState().searchString.length === 0) && editor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection !== 'never' ? 'single' : 'none',
            seedSearchStringFromNonEmptySelection: editor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection === 'selection',
            seedSearchStringFromGlobalClipboard: true,
            shouldFocus: 0 /* FindStartFocusAction.NoFocusChange */,
            shouldAnimate: true,
            updateSearchScope: false,
            loop: editor.getOption(50 /* EditorOption.find */).loop
        });
        runMatch();
    }
}
export const NextMatchFindAction = registerMultiEditorAction(new MultiEditorAction({
    id: FIND_IDS.NextMatchFindAction,
    label: nls.localize2('findNextMatchAction', "Find Next"),
    precondition: undefined,
    kbOpts: [{
            kbExpr: EditorContextKeys.focus,
            primary: 61 /* KeyCode.F3 */,
            mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 37 /* KeyCode.KeyG */, secondary: [61 /* KeyCode.F3 */] },
            weight: 100 /* KeybindingWeight.EditorContrib */
        }, {
            kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, CONTEXT_FIND_INPUT_FOCUSED),
            primary: 3 /* KeyCode.Enter */,
            weight: 100 /* KeybindingWeight.EditorContrib */
        }]
}));
NextMatchFindAction.addImplementation(0, async (accessor, editor, args) => {
    return matchFindAction(editor, true);
});
export const PreviousMatchFindAction = registerMultiEditorAction(new MultiEditorAction({
    id: FIND_IDS.PreviousMatchFindAction,
    label: nls.localize2('findPreviousMatchAction', "Find Previous"),
    precondition: undefined,
    kbOpts: [{
            kbExpr: EditorContextKeys.focus,
            primary: 1024 /* KeyMod.Shift */ | 61 /* KeyCode.F3 */,
            mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 37 /* KeyCode.KeyG */, secondary: [1024 /* KeyMod.Shift */ | 61 /* KeyCode.F3 */] },
            weight: 100 /* KeybindingWeight.EditorContrib */
        }, {
            kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, CONTEXT_FIND_INPUT_FOCUSED),
            primary: 1024 /* KeyMod.Shift */ | 3 /* KeyCode.Enter */,
            weight: 100 /* KeybindingWeight.EditorContrib */
        }]
}));
PreviousMatchFindAction.addImplementation(0, async (accessor, editor, args) => {
    return matchFindAction(editor, false);
});
export class MoveToMatchFindAction extends EditorAction {
    constructor() {
        super({
            id: FIND_IDS.GoToMatchFindAction,
            label: nls.localize2('findMatchAction.goToMatch', "Go to Match..."),
            precondition: CONTEXT_FIND_WIDGET_VISIBLE
        });
        this._highlightDecorations = [];
    }
    run(accessor, editor) {
        const controller = CommonFindController.get(editor);
        if (!controller) {
            return;
        }
        const matchesCount = controller.getState().matchesCount;
        if (matchesCount < 1) {
            const notificationService = accessor.get(INotificationService);
            notificationService.notify({
                severity: Severity.Warning,
                message: nls.localize('findMatchAction.noResults', "No matches. Try searching for something else.")
            });
            return;
        }
        const quickInputService = accessor.get(IQuickInputService);
        const disposables = new DisposableStore();
        const inputBox = disposables.add(quickInputService.createInputBox());
        inputBox.placeholder = nls.localize('findMatchAction.inputPlaceHolder', "Type a number to go to a specific match (between 1 and {0})", matchesCount);
        const toFindMatchIndex = (value) => {
            const index = parseInt(value);
            if (isNaN(index)) {
                return undefined;
            }
            const matchCount = controller.getState().matchesCount;
            if (index > 0 && index <= matchCount) {
                return index - 1; // zero based
            }
            else if (index < 0 && index >= -matchCount) {
                return matchCount + index;
            }
            return undefined;
        };
        const updatePickerAndEditor = (value) => {
            const index = toFindMatchIndex(value);
            if (typeof index === 'number') {
                // valid
                inputBox.validationMessage = undefined;
                controller.goToMatch(index);
                const currentMatch = controller.getState().currentMatch;
                if (currentMatch) {
                    this.addDecorations(editor, currentMatch);
                }
            }
            else {
                inputBox.validationMessage = nls.localize('findMatchAction.inputValidationMessage', "Please type a number between 1 and {0}", controller.getState().matchesCount);
                this.clearDecorations(editor);
            }
        };
        disposables.add(inputBox.onDidChangeValue(value => {
            updatePickerAndEditor(value);
        }));
        disposables.add(inputBox.onDidAccept(() => {
            const index = toFindMatchIndex(inputBox.value);
            if (typeof index === 'number') {
                controller.goToMatch(index);
                inputBox.hide();
            }
            else {
                inputBox.validationMessage = nls.localize('findMatchAction.inputValidationMessage', "Please type a number between 1 and {0}", controller.getState().matchesCount);
            }
        }));
        disposables.add(inputBox.onDidHide(() => {
            this.clearDecorations(editor);
            disposables.dispose();
        }));
        inputBox.show();
    }
    clearDecorations(editor) {
        editor.changeDecorations(changeAccessor => {
            this._highlightDecorations = changeAccessor.deltaDecorations(this._highlightDecorations, []);
        });
    }
    addDecorations(editor, range) {
        editor.changeDecorations(changeAccessor => {
            this._highlightDecorations = changeAccessor.deltaDecorations(this._highlightDecorations, [
                {
                    range,
                    options: {
                        description: 'find-match-quick-access-range-highlight',
                        className: 'rangeHighlight',
                        isWholeLine: true
                    }
                },
                {
                    range,
                    options: {
                        description: 'find-match-quick-access-range-highlight-overview',
                        overviewRuler: {
                            color: themeColorFromId(overviewRulerRangeHighlight),
                            position: OverviewRulerLane.Full
                        }
                    }
                }
            ]);
        });
    }
}
export class SelectionMatchFindAction extends EditorAction {
    async run(accessor, editor) {
        const controller = CommonFindController.get(editor);
        if (!controller) {
            return;
        }
        const selectionSearchString = getSelectionSearchString(editor, 'single', false);
        if (selectionSearchString) {
            controller.setSearchString(selectionSearchString);
        }
        if (!this._run(controller)) {
            await controller.start({
                forceRevealReplace: false,
                seedSearchStringFromSelection: 'none',
                seedSearchStringFromNonEmptySelection: false,
                seedSearchStringFromGlobalClipboard: false,
                shouldFocus: 0 /* FindStartFocusAction.NoFocusChange */,
                shouldAnimate: true,
                updateSearchScope: false,
                loop: editor.getOption(50 /* EditorOption.find */).loop
            });
            this._run(controller);
        }
    }
}
export class NextSelectionMatchFindAction extends SelectionMatchFindAction {
    constructor() {
        super({
            id: FIND_IDS.NextSelectionMatchFindAction,
            label: nls.localize2('nextSelectionMatchFindAction', "Find Next Selection"),
            precondition: undefined,
            kbOpts: {
                kbExpr: EditorContextKeys.focus,
                primary: 2048 /* KeyMod.CtrlCmd */ | 61 /* KeyCode.F3 */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
    _run(controller) {
        return controller.moveToNextMatch();
    }
}
export class PreviousSelectionMatchFindAction extends SelectionMatchFindAction {
    constructor() {
        super({
            id: FIND_IDS.PreviousSelectionMatchFindAction,
            label: nls.localize2('previousSelectionMatchFindAction', "Find Previous Selection"),
            precondition: undefined,
            kbOpts: {
                kbExpr: EditorContextKeys.focus,
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 61 /* KeyCode.F3 */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
    _run(controller) {
        return controller.moveToPrevMatch();
    }
}
export const StartFindReplaceAction = registerMultiEditorAction(new MultiEditorAction({
    id: FIND_IDS.StartFindReplaceAction,
    label: nls.localize2('startReplace', "Replace"),
    precondition: ContextKeyExpr.or(EditorContextKeys.focus, ContextKeyExpr.has('editorIsOpen')),
    kbOpts: {
        kbExpr: null,
        primary: 2048 /* KeyMod.CtrlCmd */ | 38 /* KeyCode.KeyH */,
        mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 36 /* KeyCode.KeyF */ },
        weight: 100 /* KeybindingWeight.EditorContrib */
    },
    menuOpts: {
        menuId: MenuId.MenubarEditMenu,
        group: '3_find',
        title: nls.localize({ key: 'miReplace', comment: ['&& denotes a mnemonic'] }, "&&Replace"),
        order: 2
    }
}));
StartFindReplaceAction.addImplementation(0, (accessor, editor, args) => {
    if (!editor.hasModel() || editor.getOption(104 /* EditorOption.readOnly */)) {
        return false;
    }
    const controller = CommonFindController.get(editor);
    if (!controller) {
        return false;
    }
    const currentSelection = editor.getSelection();
    const findInputFocused = controller.isFindInputFocused();
    // we only seed search string from selection when the current selection is single line and not empty,
    // + the find input is not focused
    const seedSearchStringFromSelection = !currentSelection.isEmpty()
        && currentSelection.startLineNumber === currentSelection.endLineNumber
        && (editor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection !== 'never')
        && !findInputFocused;
    /*
    * if the existing search string in find widget is empty and we don't seed search string from selection, it means the Find Input is still empty, so we should focus the Find Input instead of Replace Input.

    * findInputFocused true -> seedSearchStringFromSelection false, FocusReplaceInput
    * findInputFocused false, seedSearchStringFromSelection true FocusReplaceInput
    * findInputFocused false seedSearchStringFromSelection false FocusFindInput
    */
    const shouldFocus = (findInputFocused || seedSearchStringFromSelection) ?
        2 /* FindStartFocusAction.FocusReplaceInput */ : 1 /* FindStartFocusAction.FocusFindInput */;
    return controller.start({
        forceRevealReplace: true,
        seedSearchStringFromSelection: seedSearchStringFromSelection ? 'single' : 'none',
        seedSearchStringFromNonEmptySelection: editor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection === 'selection',
        seedSearchStringFromGlobalClipboard: editor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection !== 'never',
        shouldFocus: shouldFocus,
        shouldAnimate: true,
        updateSearchScope: false,
        loop: editor.getOption(50 /* EditorOption.find */).loop
    });
});
registerEditorContribution(CommonFindController.ID, FindController, 0 /* EditorContributionInstantiation.Eager */); // eager because it uses `saveViewState`/`restoreViewState`
registerEditorAction(StartFindWithArgsAction);
registerEditorAction(StartFindWithSelectionAction);
registerEditorAction(MoveToMatchFindAction);
registerEditorAction(NextSelectionMatchFindAction);
registerEditorAction(PreviousSelectionMatchFindAction);
const FindCommand = EditorCommand.bindToContribution(CommonFindController.get);
registerEditorCommand(new FindCommand({
    id: FIND_IDS.CloseFindWidgetCommand,
    precondition: CONTEXT_FIND_WIDGET_VISIBLE,
    handler: x => x.closeFindWidget(),
    kbOpts: {
        weight: 100 /* KeybindingWeight.EditorContrib */ + 5,
        kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, ContextKeyExpr.not('isComposing')),
        primary: 9 /* KeyCode.Escape */,
        secondary: [1024 /* KeyMod.Shift */ | 9 /* KeyCode.Escape */]
    }
}));
registerEditorCommand(new FindCommand({
    id: FIND_IDS.ToggleCaseSensitiveCommand,
    precondition: undefined,
    handler: x => x.toggleCaseSensitive(),
    kbOpts: {
        weight: 100 /* KeybindingWeight.EditorContrib */ + 5,
        kbExpr: EditorContextKeys.focus,
        primary: ToggleCaseSensitiveKeybinding.primary,
        mac: ToggleCaseSensitiveKeybinding.mac,
        win: ToggleCaseSensitiveKeybinding.win,
        linux: ToggleCaseSensitiveKeybinding.linux
    }
}));
registerEditorCommand(new FindCommand({
    id: FIND_IDS.ToggleWholeWordCommand,
    precondition: undefined,
    handler: x => x.toggleWholeWords(),
    kbOpts: {
        weight: 100 /* KeybindingWeight.EditorContrib */ + 5,
        kbExpr: EditorContextKeys.focus,
        primary: ToggleWholeWordKeybinding.primary,
        mac: ToggleWholeWordKeybinding.mac,
        win: ToggleWholeWordKeybinding.win,
        linux: ToggleWholeWordKeybinding.linux
    }
}));
registerEditorCommand(new FindCommand({
    id: FIND_IDS.ToggleRegexCommand,
    precondition: undefined,
    handler: x => x.toggleRegex(),
    kbOpts: {
        weight: 100 /* KeybindingWeight.EditorContrib */ + 5,
        kbExpr: EditorContextKeys.focus,
        primary: ToggleRegexKeybinding.primary,
        mac: ToggleRegexKeybinding.mac,
        win: ToggleRegexKeybinding.win,
        linux: ToggleRegexKeybinding.linux
    }
}));
registerEditorCommand(new FindCommand({
    id: FIND_IDS.ToggleSearchScopeCommand,
    precondition: undefined,
    handler: x => x.toggleSearchScope(),
    kbOpts: {
        weight: 100 /* KeybindingWeight.EditorContrib */ + 5,
        kbExpr: EditorContextKeys.focus,
        primary: ToggleSearchScopeKeybinding.primary,
        mac: ToggleSearchScopeKeybinding.mac,
        win: ToggleSearchScopeKeybinding.win,
        linux: ToggleSearchScopeKeybinding.linux
    }
}));
registerEditorCommand(new FindCommand({
    id: FIND_IDS.TogglePreserveCaseCommand,
    precondition: undefined,
    handler: x => x.togglePreserveCase(),
    kbOpts: {
        weight: 100 /* KeybindingWeight.EditorContrib */ + 5,
        kbExpr: EditorContextKeys.focus,
        primary: TogglePreserveCaseKeybinding.primary,
        mac: TogglePreserveCaseKeybinding.mac,
        win: TogglePreserveCaseKeybinding.win,
        linux: TogglePreserveCaseKeybinding.linux
    }
}));
registerEditorCommand(new FindCommand({
    id: FIND_IDS.ReplaceOneAction,
    precondition: CONTEXT_FIND_WIDGET_VISIBLE,
    handler: x => x.replace(),
    kbOpts: {
        weight: 100 /* KeybindingWeight.EditorContrib */ + 5,
        kbExpr: EditorContextKeys.focus,
        primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 22 /* KeyCode.Digit1 */
    }
}));
registerEditorCommand(new FindCommand({
    id: FIND_IDS.ReplaceOneAction,
    precondition: CONTEXT_FIND_WIDGET_VISIBLE,
    handler: x => x.replace(),
    kbOpts: {
        weight: 100 /* KeybindingWeight.EditorContrib */ + 5,
        kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, CONTEXT_REPLACE_INPUT_FOCUSED),
        primary: 3 /* KeyCode.Enter */
    }
}));
registerEditorCommand(new FindCommand({
    id: FIND_IDS.ReplaceAllAction,
    precondition: CONTEXT_FIND_WIDGET_VISIBLE,
    handler: x => x.replaceAll(),
    kbOpts: {
        weight: 100 /* KeybindingWeight.EditorContrib */ + 5,
        kbExpr: EditorContextKeys.focus,
        primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 3 /* KeyCode.Enter */
    }
}));
registerEditorCommand(new FindCommand({
    id: FIND_IDS.ReplaceAllAction,
    precondition: CONTEXT_FIND_WIDGET_VISIBLE,
    handler: x => x.replaceAll(),
    kbOpts: {
        weight: 100 /* KeybindingWeight.EditorContrib */ + 5,
        kbExpr: ContextKeyExpr.and(EditorContextKeys.focus, CONTEXT_REPLACE_INPUT_FOCUSED),
        primary: undefined,
        mac: {
            primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */,
        }
    }
}));
registerEditorCommand(new FindCommand({
    id: FIND_IDS.SelectAllMatchesAction,
    precondition: CONTEXT_FIND_WIDGET_VISIBLE,
    handler: x => x.selectAllMatches(),
    kbOpts: {
        weight: 100 /* KeybindingWeight.EditorContrib */ + 5,
        kbExpr: EditorContextKeys.focus,
        primary: 512 /* KeyMod.Alt */ | 3 /* KeyCode.Enter */
    }
}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZENvbnRyb2xsZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvZmluZC9icm93c2VyL2ZpbmRDb250cm9sbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFM0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRixPQUFPLEtBQUssT0FBTyxNQUFNLG9DQUFvQyxDQUFDO0FBRTlELE9BQU8sRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFtQyxpQkFBaUIsRUFBRSxvQkFBb0IsRUFBRSxxQkFBcUIsRUFBRSwwQkFBMEIsRUFBRSx5QkFBeUIsRUFBb0IsTUFBTSxzQ0FBc0MsQ0FBQztBQUU3UCxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUcxRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUM3RCxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsMkJBQTJCLEVBQUUsNkJBQTZCLEVBQUUsMkJBQTJCLEVBQUUsUUFBUSxFQUFFLDZCQUE2QixFQUFFLDRCQUE0QixFQUFFLHFCQUFxQixFQUFFLDJCQUEyQixFQUFFLHlCQUF5QixFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDM1MsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDM0QsT0FBTyxFQUFFLGdCQUFnQixFQUFzRCxNQUFNLGdCQUFnQixDQUFDO0FBQ3RHLE9BQU8sRUFBRSxVQUFVLEVBQW1CLE1BQU0saUJBQWlCLENBQUM7QUFDOUQsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0Is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