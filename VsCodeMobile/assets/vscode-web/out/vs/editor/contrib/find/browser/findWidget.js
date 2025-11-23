/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as dom from '../../../../base/browser/dom.js';
import { alert as alertFn } from '../../../../base/browser/ui/aria/aria.js';
import { Toggle } from '../../../../base/browser/ui/toggle/toggle.js';
import { Sash } from '../../../../base/browser/ui/sash/sash.js';
import { Widget } from '../../../../base/browser/ui/widget.js';
import { Delayer } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import * as platform from '../../../../base/common/platform.js';
import * as strings from '../../../../base/common/strings.js';
import './findWidget.css';
import { Range } from '../../../common/core/range.js';
import { CONTEXT_FIND_INPUT_FOCUSED, CONTEXT_REPLACE_INPUT_FOCUSED, FIND_IDS, MATCHES_LIMIT } from './findModel.js';
import * as nls from '../../../../nls.js';
import { ContextScopedFindInput, ContextScopedReplaceInput } from '../../../../platform/history/browser/contextScopedHistoryWidget.js';
import { showHistoryKeybindingHint } from '../../../../platform/history/browser/historyWidgetKeybindingHint.js';
import { asCssVariable, contrastBorder, editorFindMatchForeground, editorFindMatchHighlightBorder, editorFindMatchHighlightForeground, editorFindRangeHighlightBorder, inputActiveOptionBackground, inputActiveOptionBorder, inputActiveOptionForeground } from '../../../../platform/theme/common/colorRegistry.js';
import { registerIcon, widgetClose } from '../../../../platform/theme/common/iconRegistry.js';
import { registerThemingParticipant } from '../../../../platform/theme/common/themeService.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { isHighContrast } from '../../../../platform/theme/common/theme.js';
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { defaultInputBoxStyles, defaultToggleStyles } from '../../../../platform/theme/browser/defaultStyles.js';
const findCollapsedIcon = registerIcon('find-collapsed', Codicon.chevronRight, nls.localize('findCollapsedIcon', 'Icon to indicate that the editor find widget is collapsed.'));
const findExpandedIcon = registerIcon('find-expanded', Codicon.chevronDown, nls.localize('findExpandedIcon', 'Icon to indicate that the editor find widget is expanded.'));
export const findSelectionIcon = registerIcon('find-selection', Codicon.selection, nls.localize('findSelectionIcon', 'Icon for \'Find in Selection\' in the editor find widget.'));
export const findReplaceIcon = registerIcon('find-replace', Codicon.replace, nls.localize('findReplaceIcon', 'Icon for \'Replace\' in the editor find widget.'));
export const findReplaceAllIcon = registerIcon('find-replace-all', Codicon.replaceAll, nls.localize('findReplaceAllIcon', 'Icon for \'Replace All\' in the editor find widget.'));
export const findPreviousMatchIcon = registerIcon('find-previous-match', Codicon.arrowUp, nls.localize('findPreviousMatchIcon', 'Icon for \'Find Previous\' in the editor find widget.'));
export const findNextMatchIcon = registerIcon('find-next-match', Codicon.arrowDown, nls.localize('findNextMatchIcon', 'Icon for \'Find Next\' in the editor find widget.'));
const NLS_FIND_DIALOG_LABEL = nls.localize('label.findDialog', "Find / Replace");
const NLS_FIND_INPUT_LABEL = nls.localize('label.find', "Find");
const NLS_FIND_INPUT_PLACEHOLDER = nls.localize('placeholder.find', "Find");
const NLS_PREVIOUS_MATCH_BTN_LABEL = nls.localize('label.previousMatchButton', "Previous Match");
const NLS_NEXT_MATCH_BTN_LABEL = nls.localize('label.nextMatchButton', "Next Match");
const NLS_TOGGLE_SELECTION_FIND_TITLE = nls.localize('label.toggleSelectionFind', "Find in Selection");
const NLS_CLOSE_BTN_LABEL = nls.localize('label.closeButton', "Close");
const NLS_REPLACE_INPUT_LABEL = nls.localize('label.replace', "Replace");
const NLS_REPLACE_INPUT_PLACEHOLDER = nls.localize('placeholder.replace', "Replace");
const NLS_REPLACE_BTN_LABEL = nls.localize('label.replaceButton', "Replace");
const NLS_REPLACE_ALL_BTN_LABEL = nls.localize('label.replaceAllButton', "Replace All");
const NLS_TOGGLE_REPLACE_MODE_BTN_LABEL = nls.localize('label.toggleReplaceButton', "Toggle Replace");
const NLS_MATCHES_COUNT_LIMIT_TITLE = nls.localize('title.matchesCountLimit', "Only the first {0} results are highlighted, but all find operations work on the entire text.", MATCHES_LIMIT);
export const NLS_MATCHES_LOCATION = nls.localize('label.matchesLocation', "{0} of {1}");
export const NLS_NO_RESULTS = nls.localize('label.noResults', "No results");
const FIND_WIDGET_INITIAL_WIDTH = 419;
const PART_WIDTH = 275;
const FIND_INPUT_AREA_WIDTH = PART_WIDTH - 54;
let MAX_MATCHES_COUNT_WIDTH = 69;
// let FIND_ALL_CONTROLS_WIDTH = 17/** Find Input margin-left */ + (MAX_MATCHES_COUNT_WIDTH + 3 + 1) /** Match Results */ + 23 /** Button */ * 4 + 2/** sash */;
const FIND_INPUT_AREA_HEIGHT = 33; // The height of Find Widget when Replace Input is not visible.
const ctrlKeyMod = (platform.isMacintosh ? 256 /* KeyMod.WinCtrl */ : 2048 /* KeyMod.CtrlCmd */);
export class FindWidgetViewZone {
    constructor(afterLineNumber) {
        this.afterLineNumber = afterLineNumber;
        this.heightInPx = FIND_INPUT_AREA_HEIGHT;
        this.suppressMouseDown = false;
        this.domNode = document.createElement('div');
        this.domNode.className = 'dock-find-viewzone';
    }
}
function stopPropagationForMultiLineUpwards(event, value, textarea) {
    const isMultiline = !!value.match(/\n/);
    if (textarea && isMultiline && textarea.selectionStart > 0) {
        event.stopPropagation();
        return;
    }
}
function stopPropagationForMultiLineDownwards(event, value, textarea) {
    const isMultiline = !!value.match(/\n/);
    if (textarea && isMultiline && textarea.selectionEnd < textarea.value.length) {
        event.stopPropagation();
        return;
    }
}
export class FindWidget extends Widget {
    static { this.ID = 'editor.contrib.findWidget'; }
    constructor(codeEditor, controller, state, contextViewProvider, keybindingService, contextKeyService, _hoverService, _findWidgetSearchHistory, _replaceWidgetHistory) {
        super();
        this._hoverService = _hoverService;
        this._findWidgetSearchHistory = _findWidgetSearchHistory;
        this._replaceWidgetHistory = _replaceWidgetHistory;
        this._cachedHeight = null;
        this._revealTimeouts = [];
        this._codeEditor = codeEditor;
        this._controller = controller;
        this._state = state;
        this._contextViewProvider = contextViewProvider;
        this._keybindingService = keybindingService;
        this._contextKeyService = contextKeyService;
        this._isVisible = false;
        this._isReplaceVisible = false;
        this._ignoreChangeEvent = false;
        this._updateHistoryDelayer = new Delayer(500);
        this._register(toDisposable(() => this._updateHistoryDelayer.cancel()));
        this._register(this._state.onFindReplaceStateChange((e) => this._onStateChanged(e)));
        this._buildDomNode();
        this._updateButtons();
        this._tryUpdateWidgetWidth();
        this._findInput.inputBox.layout();
        this._register(this._codeEditor.onDidChangeConfiguration((e) => {
            if (e.hasChanged(104 /* EditorOption.readOnly */)) {
                if (this._codeEditor.getOption(104 /* EditorOption.readOnly */)) {
                    // Hide replace part if editor becomes read only
                    this._state.change({ isReplaceRevealed: false }, false);
                }
                this._updateButtons();
            }
            if (e.hasChanged(165 /* EditorOption.layoutInfo */)) {
                this._tryUpdateWidgetWidth();
            }
            if (e.hasChanged(2 /* EditorOption.accessibilitySupport */)) {
                this.updateAccessibilitySupport();
            }
            if (e.hasChanged(50 /* EditorOption.find */)) {
                const supportLoop = this._codeEditor.getOption(50 /* EditorOption.find */).loop;
                this._state.change({ loop: supportLoop }, false);
                const addExtraSpaceOnTop = this._codeEditor.getOption(50 /* EditorOption.find */).addExtraSpaceOnTop;
                if (addExtraSpaceOnTop && !this._viewZone) {
                    this._viewZone = new FindWidgetViewZone(0);
                    this._showViewZone();
                }
                if (!addExtraSpaceOnTop && this._viewZone) {
                    this._removeViewZone();
                }
            }
        }));
        this.updateAccessibilitySupport();
        this._register(this._codeEditor.onDidChangeCursorSelection(() => {
            if (this._isVisible) {
                this._updateToggleSelectionFindButton();
            }
        }));
        this._register(this._codeEditor.onDidFocusEditorWidget(async () => {
            if (this._isVisible) {
                const globalBufferTerm = await this._controller.getGlobalBufferTerm();
                if (globalBufferTerm && globalBufferTerm !== this._state.searchString) {
                    this._state.change({ searchString: globalBufferTerm }, false);
                    this._findInput.select();
                }
            }
        }));
        this._findInputFocused = CONTEXT_FIND_INPUT_FOCUSED.bindTo(contextKeyService);
        this._findFocusTracker = this._register(dom.trackFocus(this._findInput.inputBox.inputElement));
        this._register(this._findFocusTracker.onDidFocus(() => {
            this._findInputFocused.set(true);
            this._updateSearchScope();
        }));
        this._register(this._findFocusTracker.onDidBlur(() => {
            this._findInputFocused.set(false);
        }));
        this._replaceInputFocused = CONTEXT_REPLACE_INPUT_FOCUSED.bindTo(contextKeyService);
        this._replaceFocusTracker = this._register(dom.trackFocus(this._replaceInput.inputBox.inputElement));
        this._register(this._replaceFocusTracker.onDidFocus(() => {
            this._replaceInputFocused.set(true);
            this._updateSearchScope();
        }));
        this._register(this._replaceFocusTracker.onDidBlur(() => {
            this._replaceInputFocused.set(false);
        }));
        this._codeEditor.addOverlayWidget(this);
        if (this._codeEditor.getOption(50 /* EditorOption.find */).addExtraSpaceOnTop) {
            this._viewZone = new FindWidgetViewZone(0); // Put it before the first line then users can scroll beyond the first line.
        }
        this._register(this._codeEditor.onDidChangeModel(() => {
            if (!this._isVisible) {
                return;
            }
            this._viewZoneId = undefined;
        }));
        this._register(this._codeEditor.onDidScrollChange((e) => {
            if (e.scrollTopChanged) {
                this._layoutViewZone();
                return;
            }
            // for other scroll changes, layout the viewzone in next tick to avoid ruining current rendering.
            setTimeout(() => {
                this._layoutViewZone();
            }, 0);
        }));
    }
    // ----- IOverlayWidget API
    getId() {
        return FindWidget.ID;
    }
    getDomNode() {
        return this._domNode;
    }
    getPosition() {
        if (this._isVisible) {
            return {
                preference: 0 /* OverlayWidgetPositionPreference.TOP_RIGHT_CORNER */
            };
        }
        return null;
    }
    // ----- React to state changes
    _onStateChanged(e) {
        if (e.searchString) {
            try {
                this._ignoreChangeEvent = true;
                this._findInput.setValue(this._state.searchString);
            }
            finally {
                this._ignoreChangeEvent = false;
            }
            this._updateButtons();
        }
        if (e.replaceString) {
            this._replaceInput.inputBox.value = this._state.replaceString;
        }
        if (e.isRevealed) {
            if (this._state.isRevealed) {
                this._reveal();
            }
            else {
                this._hide(true);
            }
        }
        if (e.isReplaceRevealed) {
            if (this._state.isReplaceRevealed) {
                if (!this._codeEditor.getOption(104 /* EditorOption.readOnly */) && !this._isReplaceVisible) {
                    this._isReplaceVisible = true;
                    this._replaceInput.width = dom.getTotalWidth(this._findInput.domNode);
                    this._updateButtons();
                    this._replaceInput.inputBox.layout();
                }
            }
            else {
                if (this._isReplaceVisible) {
                    this._isReplaceVisible = false;
                    this._updateButtons();
                }
            }
        }
        if ((e.isRevealed || e.isReplaceRevealed) && (this._state.isRevealed || this._state.isReplaceRevealed)) {
            if (this._tryUpdateHeight()) {
                this._showViewZone();
            }
        }
        if (e.isRegex) {
            this._findInput.setRegex(this._state.isRegex);
        }
        if (e.wholeWord) {
            this._findInput.setWholeWords(this._state.wholeWord);
        }
        if (e.matchCase) {
            this._findInput.setCaseSensitive(this._state.matchCase);
        }
        if (e.preserveCase) {
            this._replaceInput.setPreserveCase(this._state.preserveCase);
        }
        if (e.searchScope) {
            if (this._state.searchScope) {
                this._toggleSelectionFind.checked = true;
            }
            else {
                this._toggleSelectionFind.checked = false;
            }
            this._updateToggleSelectionFindButton();
        }
        if (e.searchString || e.matchesCount || e.matchesPosition) {
            const showRedOutline = (this._state.searchString.length > 0 && this._state.matchesCount === 0);
            this._domNode.classList.toggle('no-results', showRedOutline);
            this._updateMatchesCount();
            this._updateButtons();
        }
        if (e.searchString || e.currentMatch) {
            this._layoutViewZone();
        }
        if (e.updateHistory) {
            this._delayedUpdateHistory();
        }
        if (e.loop) {
            this._updateButtons();
        }
    }
    _delayedUpdateHistory() {
        this._updateHistoryDelayer.trigger(this._updateHistory.bind(this)).then(undefined, onUnexpectedError);
    }
    _updateHistory() {
        if (this._state.searchString) {
            this._findInput.inputBox.addToHistory();
        }
        if (this._state.replaceString) {
            this._replaceInput.inputBox.addToHistory();
        }
    }
    _updateMatchesCount() {
        this._matchesCount.style.minWidth = MAX_MATCHES_COUNT_WIDTH + 'px';
        if (this._state.matchesCount >= MATCHES_LIMIT) {
            this._matchesCount.title = NLS_MATCHES_COUNT_LIMIT_TITLE;
        }
        else {
            this._matchesCount.title = '';
        }
        // remove previous content
        this._matchesCount.firstChild?.remove();
        let label;
        if (this._state.matchesCount > 0) {
            let matchesCount = String(this._state.matchesCount);
            if (this._state.matchesCount >= MATCHES_LIMIT) {
                matchesCount += '+';
            }
            let matchesPosition = String(this._state.matchesPosition);
            if (matchesPosition === '0') {
                matchesPosition = '?';
            }
            label = strings.format(NLS_MATCHES_LOCATION, matchesPosition, matchesCount);
        }
        else {
            label = NLS_NO_RESULTS;
        }
        this._matchesCount.appendChild(document.createTextNode(label));
        alertFn(this._getAriaLabel(label, this._state.currentMatch, this._state.searchString));
        MAX_MATCHES_COUNT_WIDTH = Math.max(MAX_MATCHES_COUNT_WIDTH, this._matchesCount.clientWidth);
    }
    // ----- actions
    _getAriaLabel(label, currentMatch, searchString) {
        if (label === NLS_NO_RESULTS) {
            return searchString === ''
                ? nls.localize('ariaSearchNoResultEmpty', "{0} found", label)
                : nls.localize('ariaSearchNoResult', "{0} found for '{1}'", label, searchString);
        }
        if (currentMatch) {
            const ariaLabel = nls.localize('ariaSearchNoResultWithLineNum', "{0} found for '{1}', at {2}", label, searchString, currentMatch.startLineNumber + ':' + currentMatch.startColumn);
            const model = this._codeEditor.getModel();
            if (model && (currentMatch.startLineNumber <= model.getLineCount()) && (currentMatch.startLineNumber >= 1)) {
                const lineContent = model.getLineContent(currentMatch.startLineNumber);
                return `${lineContent}, ${ariaLabel}`;
            }
            return ariaLabel;
        }
        return nls.localize('ariaSearchNoResultWithLineNumNoCurrentMatch', "{0} found for '{1}'", label, searchString);
    }
    /**
     * If 'selection find' is ON we should not disable the button (its function is to cancel 'selection find').
     * If 'selection find' is OFF we enable the button only if there is a selection.
     */
    _updateToggleSelectionFindButton() {
        const selection = this._codeEditor.getSelection();
        const isSelection = selection ? (selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn) : false;
        const isChecked = this._toggleSelectionFind.checked;
        if (this._isVisible && (isChecked || isSelection)) {
            this._toggleSelectionFind.enable();
        }
        else {
            this._toggleSelectionFind.disable();
        }
    }
    _updateButtons() {
        this._findInput.setEnabled(this._isVisible);
        this._replaceInput.setEnabled(this._isVisible && this._isReplaceVisible);
        this._updateToggleSelectionFindButton();
        this._closeBtn.setEnabled(this._isVisible);
        const findInputIsNonEmpty = (this._state.searchString.length > 0);
        const matchesCount = this._state.matchesCount ? true : false;
        this._prevBtn.setEnabled(this._isVisible && findInputIsNonEmpty && matchesCount && this._state.canNavigateBack());
        this._nextBtn.setEnabled(this._isVisible && findInputIsNonEmpty && matchesCount && this._state.canNavigateForward());
        this._replaceBtn.setEnabled(this._isVisible && this._isReplaceVisible && findInputIsNonEmpty);
        this._replaceAllBtn.setEnabled(this._isVisible && this._isReplaceVisible && findInputIsNonEmpty);
        this._domNode.classList.toggle('replaceToggled', this._isReplaceVisible);
        this._toggleReplaceBtn.setExpanded(this._isReplaceVisible);
        const canReplace = !this._codeEditor.getOption(104 /* EditorOption.readOnly */);
        this._toggleReplaceBtn.setEnabled(this._isVisible && canReplace);
    }
    _reveal() {
        this._revealTimeouts.forEach(e => {
            clearTimeout(e);
        });
        this._revealTimeouts = [];
        if (!this._isVisible) {
            this._isVisible = true;
            const selection = this._codeEditor.getSelection();
            switch (this._codeEditor.getOption(50 /* EditorOption.find */).autoFindInSelection) {
                case 'always':
                    this._toggleSelectionFind.checked = true;
                    break;
                case 'never':
                    this._toggleSelectionFind.checked = false;
                    break;
                case 'multiline': {
                    const isSelectionMultipleLine = !!selection && selection.startLineNumber !== selection.endLineNumber;
                    this._toggleSelectionFind.checked = isSelectionMultipleLine;
                    break;
                }
                default:
                    break;
            }
            this._tryUpdateWidgetWidth();
            this._updateButtons();
            this._revealTimeouts.push(setTimeout(() => {
                this._domNode.classList.add('visible');
                this._domNode.setAttribute('aria-hidden', 'false');
            }, 0));
            // validate query again as it's being dismissed when we hide the find widget.
            this._revealTimeouts.push(setTimeout(() => {
                this._findInput.validate();
            }, 200));
            this._codeEditor.layoutOverlayWidget(this);
            let adjustEditorScrollTop = true;
            if (this._codeEditor.getOption(50 /* EditorOption.find */).seedSearchStringFromSelection && selection) {
                const domNode = this._codeEditor.getDomNode();
                if (domNode) {
                    const editorCoords = dom.getDomNodePagePosition(domNode);
                    const startCoords = this._codeEditor.getScrolledVisiblePosition(selection.getStartPosition());
                    const startLeft = editorCoords.left + (startCoords ? startCoords.left : 0);
                    const startTop = startCoords ? startCoords.top : 0;
                    if (this._viewZone && startTop < this._viewZone.heightInPx) {
                        if (selection.endLineNumber > selection.startLineNumber) {
                            adjustEditorScrollTop = false;
                        }
                        const leftOfFindWidget = dom.getTopLeftOffset(this._domNode).left;
                        if (startLeft > leftOfFindWidget) {
                            adjustEditorScrollTop = false;
                        }
                        const endCoords = this._codeEditor.getScrolledVisiblePosition(selection.getEndPosition());
                        const endLeft = editorCoords.left + (endCoords ? endCoords.left : 0);
                        if (endLeft > leftOfFindWidget) {
                            adjustEditorScrollTop = false;
                        }
                    }
                }
            }
            this._showViewZone(adjustEditorScrollTop);
        }
    }
    _hide(focusTheEditor) {
        this._revealTimeouts.forEach(e => {
            clearTimeout(e);
        });
        this._revealTimeouts = [];
        if (this._isVisible) {
            this._isVisible = false;
            this._updateButtons();
            this._domNode.classList.remove('visible');
            this._domNode.setAttribute('aria-hidden', 'true');
            this._findInput.clearMessage();
            if (focusTheEditor) {
                this._codeEditor.focus();
            }
            this._codeEditor.layoutOverlayWidget(this);
            this._removeViewZone();
        }
    }
    _layoutViewZone(targetScrollTop) {
        const addExtraSpaceOnTop = this._codeEditor.getOption(50 /* EditorOption.find */).addExtraSpaceOnTop;
        if (!addExtraSpaceOnTop) {
            this._removeViewZone();
            return;
        }
        if (!this._isVisible) {
            return;
        }
        const viewZone = this._viewZone;
        if (this._viewZoneId !== undefined || !viewZone) {
            return;
        }
        this._codeEditor.changeViewZones((accessor) => {
            viewZone.heightInPx = this._getHeight();
            this._viewZoneId = accessor.addZone(viewZone);
            // scroll top adjust to make sure the editor doesn't scroll when adding viewzone at the beginning.
            this._codeEditor.setScrollTop(targetScrollTop || this._codeEditor.getScrollTop() + viewZone.heightInPx);
        });
    }
    _showViewZone(adjustScroll = true) {
        if (!this._isVisible) {
            return;
        }
        const addExtraSpaceOnTop = this._codeEditor.getOption(50 /* EditorOption.find */).addExtraSpaceOnTop;
        if (!addExtraSpaceOnTop) {
            return;
        }
        if (this._viewZone === undefined) {
            this._viewZone = new FindWidgetViewZone(0);
        }
        const viewZone = this._viewZone;
        this._codeEditor.changeViewZones((accessor) => {
            if (this._viewZoneId !== undefined) {
                // the view zone already exists, we need to update the height
                const newHeight = this._getHeight();
                if (newHeight === viewZone.heightInPx) {
                    return;
                }
                const scrollAdjustment = newHeight - viewZone.heightInPx;
                viewZone.heightInPx = newHeight;
                accessor.layoutZone(this._viewZoneId);
                if (adjustScroll) {
                    this._codeEditor.setScrollTop(this._codeEditor.getScrollTop() + scrollAdjustment);
                }
                return;
            }
            else {
                let scrollAdjustment = this._getHeight();
                // if the editor has top padding, factor that into the zone height
                scrollAdjustment -= this._codeEditor.getOption(96 /* EditorOption.padding */).top;
                if (scrollAdjustment <= 0) {
                    return;
                }
                viewZone.heightInPx = scrollAdjustment;
                this._viewZoneId = accessor.addZone(viewZone);
                if (adjustScroll) {
                    this._codeEditor.setScrollTop(this._codeEditor.getScrollTop() + scrollAdjustment);
                }
            }
        });
    }
    _removeViewZone() {
        this._codeEditor.changeViewZones((accessor) => {
            if (this._viewZoneId !== undefined) {
                accessor.removeZone(this._viewZoneId);
                this._viewZoneId = undefined;
                if (this._viewZone) {
                    this._codeEditor.setScrollTop(this._codeEditor.getScrollTop() - this._viewZone.heightInPx);
                    this._viewZone = undefined;
                }
            }
        });
    }
    _tryUpdateWidgetWidth() {
        if (!this._isVisible) {
            return;
        }
        if (!this._domNode.isConnected) {
            // the widget is not in the DOM
            return;
        }
        const layoutInfo = this._codeEditor.getLayoutInfo();
        const editorContentWidth = layoutInfo.contentWidth;
        if (editorContentWidth <= 0) {
            // for example, diff view original editor
            this._domNode.classList.add('hiddenEditor');
            return;
        }
        else if (this._domNode.classList.contains('hiddenEditor')) {
            this._domNode.classList.remove('hiddenEditor');
        }
        const editorWidth = layoutInfo.width;
        const minimapWidth = layoutInfo.minimap.minimapWidth;
        let collapsedFindWidget = false;
        let reducedFindWidget = false;
        let narrowFindWidget = false;
        if (this._resized) {
            const widgetWidth = dom.getTotalWidth(this._domNode);
            if (widgetWidth > FIND_WIDGET_INITIAL_WIDTH) {
                // as the widget is resized by users, we may need to change the max width of the widget as the editor width changes.
                this._domNode.style.maxWidth = `${editorWidth - 28 - minimapWidth - 15}px`;
                this._replaceInput.width = dom.getTotalWidth(this._findInput.domNode);
                return;
            }
        }
        if (FIND_WIDGET_INITIAL_WIDTH + 28 + minimapWidth >= editorWidth) {
            reducedFindWidget = true;
        }
        if (FIND_WIDGET_INITIAL_WIDTH + 28 + minimapWidth - MAX_MATCHES_COUNT_WIDTH >= editorWidth) {
            narrowFindWidget = true;
        }
        if (FIND_WIDGET_INITIAL_WIDTH + 28 + minimapWidth - MAX_MATCHES_COUNT_WIDTH >= editorWidth + 50) {
            collapsedFindWidget = true;
        }
        this._domNode.classList.toggle('collapsed-find-widget', collapsedFindWidget);
        this._domNode.classList.toggle('narrow-find-widget', narrowFindWidget);
        this._domNode.classList.toggle('reduced-find-widget', reducedFindWidget);
        if (!narrowFindWidget && !collapsedFindWidget) {
            // the minimal left offset of findwidget is 15px.
            this._domNode.style.maxWidth = `${editorWidth - 28 - minimapWidth - 15}px`;
        }
        this._findInput.layout({ collapsedFindWidget, narrowFindWidget, reducedFindWidget });
        if (this._resized) {
            const findInputWidth = this._findInput.inputBox.element.clientWidth;
            if (findInputWidth > 0) {
                this._replaceInput.width = findInputWidth;
            }
        }
        else if (this._isReplaceVisible) {
            this._replaceInput.width = dom.getTotalWidth(this._findInput.domNode);
        }
    }
    _getHeight() {
        let totalheight = 0;
        // find input margin top
        totalheight += 4;
        // find input height
        totalheight += this._findInput.inputBox.height + 2 /** input box border */;
        if (this._isReplaceVisible) {
            // replace input margin
            totalheight += 4;
            totalheight += this._replaceInput.inputBox.height + 2 /** input box border */;
        }
        // margin bottom
        totalheight += 4;
        return totalheight;
    }
    _tryUpdateHeight() {
        const totalHeight = this._getHeight();
        if (this._cachedHeight !== null && this._cachedHeight === totalHeight) {
            return false;
        }
        this._cachedHeight = totalHeight;
        this._domNode.style.height = `${totalHeight}px`;
        return true;
    }
    // ----- Public
    focusFindInput() {
        this._findInput.select();
        // Edge browser requires focus() in addition to select()
        this._findInput.focus();
    }
    focusReplaceInput() {
        this._replaceInput.select();
        // Edge browser requires focus() in addition to select()
        this._replaceInput.focus();
    }
    highlightFindOptions() {
        this._findInput.highlightFindOptions();
    }
    _updateSearchScope() {
        if (!this._codeEditor.hasModel()) {
            return;
        }
        if (this._toggleSelectionFind.checked) {
            const selections = this._codeEditor.getSelections();
            selections.map(selection => {
                if (selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber) {
                    selection = selection.setEndPosition(selection.endLineNumber - 1, this._codeEditor.getModel().getLineMaxColumn(selection.endLineNumber - 1));
                }
                const currentMatch = this._state.currentMatch;
                if (selection.startLineNumber !== selection.endLineNumber) {
                    if (!Range.equalsRange(selection, currentMatch)) {
                        return selection;
                    }
                }
                return null;
            }).filter(element => !!element);
            if (selections.length) {
                this._state.change({ searchScope: selections }, true);
            }
        }
    }
    _onFindInputMouseDown(e) {
        // on linux, middle key does pasting.
        if (e.middleButton) {
            e.stopPropagation();
        }
    }
    _onFindInputKeyDown(e) {
        if (e.equals(ctrlKeyMod | 3 /* KeyCode.Enter */)) {
            if (this._keybindingService.dispatchEvent(e, e.target)) {
                e.preventDefault();
                return;
            }
            else {
                this._findInput.inputBox.insertAtCursor('\n');
                e.preventDefault();
                return;
            }
        }
        if (e.equals(2 /* KeyCode.Tab */)) {
            if (this._isReplaceVisible) {
                this._replaceInput.focus();
            }
            else {
                this._findInput.focusOnCaseSensitive();
            }
            e.preventDefault();
            return;
        }
        if (e.equals(2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */)) {
            this._codeEditor.focus();
            e.preventDefault();
            return;
        }
        if (e.equals(16 /* KeyCode.UpArrow */)) {
            // eslint-disable-next-line no-restricted-syntax
            return stopPropagationForMultiLineUpwards(e, this._findInput.getValue(), this._findInput.domNode.querySelector('textarea'));
        }
        if (e.equals(18 /* KeyCode.DownArrow */)) {
            // eslint-disable-next-line no-restricted-syntax
            return stopPropagationForMultiLineDownwards(e, this._findInput.getValue(), this._findInput.domNode.querySelector('textarea'));
        }
    }
    _onReplaceInputKeyDown(e) {
        if (e.equals(ctrlKeyMod | 3 /* KeyCode.Enter */)) {
            if (this._keybindingService.dispatchEvent(e, e.target)) {
                e.preventDefault();
                return;
            }
            else {
                this._replaceInput.inputBox.insertAtCursor('\n');
                e.preventDefault();
                return;
            }
        }
        if (e.equals(2 /* KeyCode.Tab */)) {
            this._findInput.focusOnCaseSensitive();
            e.preventDefault();
            return;
        }
        if (e.equals(1024 /* KeyMod.Shift */ | 2 /* KeyCode.Tab */)) {
            this._findInput.focus();
            e.preventDefault();
            return;
        }
        if (e.equals(2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */)) {
            this._codeEditor.focus();
            e.preventDefault();
            return;
        }
        if (e.equals(16 /* KeyCode.UpArrow */)) {
            // eslint-disable-next-line no-restricted-syntax
            return stopPropagationForMultiLineUpwards(e, this._replaceInput.inputBox.value, this._replaceInput.inputBox.element.querySelector('textarea'));
        }
        if (e.equals(18 /* KeyCode.DownArrow */)) {
            // eslint-disable-next-line no-restricted-syntax
            return stopPropagationForMultiLineDownwards(e, this._replaceInput.inputBox.value, this._replaceInput.inputBox.element.querySelector('textarea'));
        }
    }
    // ----- sash
    getVerticalSashLeft(_sash) {
        return 0;
    }
    // ----- initialization
    _keybindingLabelFor(actionId) {
        const kb = this._keybindingService.lookupKeybinding(actionId);
        if (!kb) {
            return '';
        }
        return ` (${kb.getLabel()})`;
    }
    _buildDomNode() {
        const flexibleHeight = true;
        const flexibleWidth = true;
        // Find input
        const findSearchHistoryConfig = this._codeEditor.getOption(50 /* EditorOption.find */).history;
        const replaceHistoryConfig = this._codeEditor.getOption(50 /* EditorOption.find */).replaceHistory;
        this._findInput = this._register(new ContextScopedFindInput(null, this._contextViewProvider, {
            width: FIND_INPUT_AREA_WIDTH,
            label: NLS_FIND_INPUT_LABEL,
            placeholder: NLS_FIND_INPUT_PLACEHOLDER,
            appendCaseSensitiveLabel: this._keybindingLabelFor(FIND_IDS.ToggleCaseSensitiveCommand),
            appendWholeWordsLabel: this._keybindingLabelFor(FIND_IDS.ToggleWholeWordCommand),
            appendRegexLabel: this._keybindingLabelFor(FIND_IDS.ToggleRegexCommand),
            validation: (value) => {
                if (value.length === 0 || !this._findInput.getRegex()) {
                    return null;
                }
                try {
                    // use `g` and `u` which are also used by the TextModel search
                    new RegExp(value, 'gu');
                    return null;
                }
                catch (e) {
                    return { content: e.message };
                }
            },
            flexibleHeight,
            flexibleWidth,
            flexibleMaxHeight: 118,
            showCommonFindToggles: true,
            showHistoryHint: () => showHistoryKeybindingHint(this._keybindingService),
            inputBoxStyles: defaultInputBoxStyles,
            toggleStyles: defaultToggleStyles,
            history: findSearchHistoryConfig === 'workspace' ? this._findWidgetSearchHistory : new Set([]),
        }, this._contextKeyService));
        this._findInput.setRegex(!!this._state.isRegex);
        this._findInput.setCaseSensitive(!!this._state.matchCase);
        this._findInput.setWholeWords(!!this._state.wholeWord);
        this._register(this._findInput.onKeyDown((e) => {
            if (e.equals(3 /* KeyCode.Enter */) && !this._codeEditor.getOption(50 /* EditorOption.find */).findOnType) {
                this._state.change({ searchString: this._findInput.getValue() }, true);
            }
            this._onFindInputKeyDown(e);
        }));
        this._register(this._findInput.inputBox.onDidChange(() => {
            if (this._ignoreChangeEvent || !this._codeEditor.getOption(50 /* EditorOption.find */).findOnType) {
                return;
            }
            this._state.change({ searchString: this._findInput.getValue() }, true);
        }));
        this._register(this._findInput.onDidOptionChange(() => {
            this._state.change({
                isRegex: this._findInput.getRegex(),
                wholeWord: this._findInput.getWholeWords(),
                matchCase: this._findInput.getCaseSensitive()
            }, true);
        }));
        this._register(this._findInput.onCaseSensitiveKeyDown((e) => {
            if (e.equals(1024 /* KeyMod.Shift */ | 2 /* KeyCode.Tab */)) {
                if (this._isReplaceVisible) {
                    this._replaceInput.focus();
                    e.preventDefault();
                }
            }
        }));
        this._register(this._findInput.onRegexKeyDown((e) => {
            if (e.equals(2 /* KeyCode.Tab */)) {
                if (this._isReplaceVisible) {
                    this._replaceInput.focusOnPreserve();
                    e.preventDefault();
                }
            }
        }));
        this._register(this._findInput.inputBox.onDidHeightChange((e) => {
            if (this._tryUpdateHeight()) {
                this._showViewZone();
            }
        }));
        if (platform.isLinux) {
            this._register(this._findInput.onMouseDown((e) => this._onFindInputMouseDown(e)));
        }
        this._matchesCount = document.createElement('div');
        this._matchesCount.className = 'matchesCount';
        this._updateMatchesCount();
        const hoverLifecycleOptions = { groupId: 'find-widget' };
        // Previous button
        this._prevBtn = this._register(new SimpleButton({
            label: NLS_PREVIOUS_MATCH_BTN_LABEL + this._keybindingLabelFor(FIND_IDS.PreviousMatchFindAction),
            icon: findPreviousMatchIcon,
            hoverLifecycleOptions,
            onTrigger: () => {
                assertReturnsDefined(this._codeEditor.getAction(FIND_IDS.PreviousMatchFindAction)).run().then(undefined, onUnexpectedError);
            }
        }, this._hoverService));
        // Next button
        this._nextBtn = this._register(new SimpleButton({
            label: NLS_NEXT_MATCH_BTN_LABEL + this._keybindingLabelFor(FIND_IDS.NextMatchFindAction),
            icon: findNextMatchIcon,
            hoverLifecycleOptions,
            onTrigger: () => {
                assertReturnsDefined(this._codeEditor.getAction(FIND_IDS.NextMatchFindAction)).run().then(undefined, onUnexpectedError);
            }
        }, this._hoverService));
        const findPart = document.createElement('div');
        findPart.className = 'find-part';
        findPart.appendChild(this._findInput.domNode);
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'find-actions';
        findPart.appendChild(actionsContainer);
        actionsContainer.appendChild(this._matchesCount);
        actionsContainer.appendChild(this._prevBtn.domNode);
        actionsContainer.appendChild(this._nextBtn.domNode);
        // Toggle selection button
        this._toggleSelectionFind = this._register(new Toggle({
            icon: findSelectionIcon,
            title: NLS_TOGGLE_SELECTION_FIND_TITLE + this._keybindingLabelFor(FIND_IDS.ToggleSearchScopeCommand),
            isChecked: false,
            hoverLifecycleOptions,
            inputActiveOptionBackground: asCssVariable(inputActiveOptionBackground),
            inputActiveOptionBorder: asCssVariable(inputActiveOptionBorder),
            inputActiveOptionForeground: asCssVariable(inputActiveOptionForeground),
        }));
        this._register(this._toggleSelectionFind.onChange(() => {
            if (this._toggleSelectionFind.checked) {
                if (this._codeEditor.hasModel()) {
                    let selections = this._codeEditor.getSelections();
                    selections = selections.map(selection => {
                        if (selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber) {
                            selection = selection.setEndPosition(selection.endLineNumber - 1, this._codeEditor.getModel().getLineMaxColumn(selection.endLineNumber - 1));
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
            else {
                this._state.change({ searchScope: null }, true);
            }
        }));
        actionsContainer.appendChild(this._toggleSelectionFind.domNode);
        // Close button
        this._closeBtn = this._register(new SimpleButton({
            label: NLS_CLOSE_BTN_LABEL + this._keybindingLabelFor(FIND_IDS.CloseFindWidgetCommand),
            icon: widgetClose,
            hoverLifecycleOptions,
            onTrigger: () => {
                this._state.change({ isRevealed: false, searchScope: null }, false);
            },
            onKeyDown: (e) => {
                if (e.equals(2 /* KeyCode.Tab */)) {
                    if (this._isReplaceVisible) {
                        if (this._replaceBtn.isEnabled()) {
                            this._replaceBtn.focus();
                        }
                        else {
                            this._codeEditor.focus();
                        }
                        e.preventDefault();
                    }
                }
            }
        }, this._hoverService));
        // Replace input
        this._replaceInput = this._register(new ContextScopedReplaceInput(null, undefined, {
            label: NLS_REPLACE_INPUT_LABEL,
            placeholder: NLS_REPLACE_INPUT_PLACEHOLDER,
            appendPreserveCaseLabel: this._keybindingLabelFor(FIND_IDS.TogglePreserveCaseCommand),
            history: replaceHistoryConfig === 'workspace' ? this._replaceWidgetHistory : new Set([]),
            flexibleHeight,
            flexibleWidth,
            flexibleMaxHeight: 118,
            showHistoryHint: () => showHistoryKeybindingHint(this._keybindingService),
            inputBoxStyles: defaultInputBoxStyles,
            toggleStyles: defaultToggleStyles,
            hoverLifecycleOptions,
        }, this._contextKeyService, true));
        this._replaceInput.setPreserveCase(!!this._state.preserveCase);
        this._register(this._replaceInput.onKeyDown((e) => this._onReplaceInputKeyDown(e)));
        this._register(this._replaceInput.inputBox.onDidChange(() => {
            this._state.change({ replaceString: this._replaceInput.inputBox.value }, false);
        }));
        this._register(this._replaceInput.inputBox.onDidHeightChange((e) => {
            if (this._isReplaceVisible && this._tryUpdateHeight()) {
                this._showViewZone();
            }
        }));
        this._register(this._replaceInput.onDidOptionChange(() => {
            this._state.change({
                preserveCase: this._replaceInput.getPreserveCase()
            }, true);
        }));
        this._register(this._replaceInput.onPreserveCaseKeyDown((e) => {
            if (e.equals(2 /* KeyCode.Tab */)) {
                if (this._prevBtn.isEnabled()) {
                    this._prevBtn.focus();
                }
                else if (this._nextBtn.isEnabled()) {
                    this._nextBtn.focus();
                }
                else if (this._toggleSelectionFind.enabled) {
                    this._toggleSelectionFind.focus();
                }
                else if (this._closeBtn.isEnabled()) {
                    this._closeBtn.focus();
                }
                e.preventDefault();
            }
        }));
        // Replace one button
        this._replaceBtn = this._register(new SimpleButton({
            label: NLS_REPLACE_BTN_LABEL + this._keybindingLabelFor(FIND_IDS.ReplaceOneAction),
            icon: findReplaceIcon,
            hoverLifecycleOptions,
            onTrigger: () => {
                this._controller.replace();
            },
            onKeyDown: (e) => {
                if (e.equals(1024 /* KeyMod.Shift */ | 2 /* KeyCode.Tab */)) {
                    this._closeBtn.focus();
                    e.preventDefault();
                }
            }
        }, this._hoverService));
        // Replace all button
        this._replaceAllBtn = this._register(new SimpleButton({
            label: NLS_REPLACE_ALL_BTN_LABEL + this._keybindingLabelFor(FIND_IDS.ReplaceAllAction),
            icon: findReplaceAllIcon,
            hoverLifecycleOptions,
            onTrigger: () => {
                this._controller.replaceAll();
            }
        }, this._hoverService));
        const replacePart = document.createElement('div');
        replacePart.className = 'replace-part';
        replacePart.appendChild(this._replaceInput.domNode);
        const replaceActionsContainer = document.createElement('div');
        replaceActionsContainer.className = 'replace-actions';
        replacePart.appendChild(replaceActionsContainer);
        replaceActionsContainer.appendChild(this._replaceBtn.domNode);
        replaceActionsContainer.appendChild(this._replaceAllBtn.domNode);
        // Toggle replace button
        this._toggleReplaceBtn = this._register(new SimpleButton({
            label: NLS_TOGGLE_REPLACE_MODE_BTN_LABEL,
            className: 'codicon toggle left',
            onTrigger: () => {
                this._state.change({ isReplaceRevealed: !this._isReplaceVisible }, false);
                if (this._isReplaceVisible) {
                    this._replaceInput.width = dom.getTotalWidth(this._findInput.domNode);
                    this._replaceInput.inputBox.layout();
                }
                this._showViewZone();
            }
        }, this._hoverService));
        this._toggleReplaceBtn.setExpanded(this._isReplaceVisible);
        // Widget
        this._domNode = document.createElement('div');
        this._domNode.className = 'editor-widget find-widget';
        this._domNode.setAttribute('aria-hidden', 'true');
        this._domNode.ariaLabel = NLS_FIND_DIALOG_LABEL;
        this._domNode.role = 'dialog';
        // We need to set this explicitly, otherwise on IE11, the width inheritence of flex doesn't work.
        this._domNode.style.width = `${FIND_WIDGET_INITIAL_WIDTH}px`;
        this._domNode.appendChild(this._toggleReplaceBtn.domNode);
        this._domNode.appendChild(findPart);
        this._domNode.appendChild(this._closeBtn.domNode);
        this._domNode.appendChild(replacePart);
        this._resizeSash = this._register(new Sash(this._domNode, this, { orientation: 0 /* Orientation.VERTICAL */, size: 2 }));
        this._resized = false;
        let originalWidth = FIND_WIDGET_INITIAL_WIDTH;
        this._register(this._resizeSash.onDidStart(() => {
            originalWidth = dom.getTotalWidth(this._domNode);
        }));
        this._register(this._resizeSash.onDidChange((evt) => {
            this._resized = true;
            const width = originalWidth + evt.startX - evt.currentX;
            if (width < FIND_WIDGET_INITIAL_WIDTH) {
                // narrow down the find widget should be handled by CSS.
                return;
            }
            const maxWidth = parseFloat(dom.getComputedStyle(this._domNode).maxWidth) || 0;
            if (width > maxWidth) {
                return;
            }
            this._domNode.style.width = `${width}px`;
            if (this._isReplaceVisible) {
                this._replaceInput.width = dom.getTotalWidth(this._findInput.domNode);
            }
            this._findInput.inputBox.layout();
            this._tryUpdateHeight();
        }));
        this._register(this._resizeSash.onDidReset(() => {
            // users double click on the sash
            const currentWidth = dom.getTotalWidth(this._domNode);
            if (currentWidth < FIND_WIDGET_INITIAL_WIDTH) {
                // The editor is narrow and the width of the find widget is controlled fully by CSS.
                return;
            }
            let width = FIND_WIDGET_INITIAL_WIDTH;
            if (!this._resized || currentWidth === FIND_WIDGET_INITIAL_WIDTH) {
                // 1. never resized before, double click should maximizes it
                // 2. users resized it already but its width is the same as default
                const layoutInfo = this._codeEditor.getLayoutInfo();
                width = layoutInfo.width - 28 - layoutInfo.minimap.minimapWidth - 15;
                this._resized = true;
            }
            else {
                /**
                 * no op, the find widget should be shrinked to its default size.
                 */
            }
            this._domNode.style.width = `${width}px`;
            if (this._isReplaceVisible) {
                this._replaceInput.width = dom.getTotalWidth(this._findInput.domNode);
            }
            this._findInput.inputBox.layout();
        }));
    }
    updateAccessibilitySupport() {
        const value = this._codeEditor.getOption(2 /* EditorOption.accessibilitySupport */);
        this._findInput.setFocusInputOnOptionClick(value !== 2 /* AccessibilitySupport.Enabled */);
    }
    getViewState() {
        let widgetViewZoneVisible = false;
        if (this._viewZone && this._viewZoneId) {
            widgetViewZoneVisible = this._viewZone.heightInPx > this._codeEditor.getScrollTop();
        }
        return {
            widgetViewZoneVisible,
            scrollTop: this._codeEditor.getScrollTop()
        };
    }
    setViewState(state) {
        if (!state) {
            return;
        }
        if (state.widgetViewZoneVisible) {
            // we should add the view zone
            this._layoutViewZone(state.scrollTop);
        }
    }
}
export class SimpleButton extends Widget {
    constructor(opts, hoverService) {
        super();
        this._opts = opts;
        let className = 'button';
        if (this._opts.className) {
            className = className + ' ' + this._opts.className;
        }
        if (this._opts.icon) {
            className = className + ' ' + ThemeIcon.asClassName(this._opts.icon);
        }
        this._domNode = document.createElement('div');
        this._domNode.tabIndex = 0;
        this._domNode.className = className;
        this._domNode.setAttribute('role', 'button');
        this._domNode.setAttribute('aria-label', this._opts.label);
        this._register(hoverService.setupDelayedHover(this._domNode, {
            content: this._opts.label,
            style: 1 /* HoverStyle.Pointer */,
        }, opts.hoverLifecycleOptions));
        this.onclick(this._domNode, (e) => {
            this._opts.onTrigger();
            e.preventDefault();
        });
        this.onkeydown(this._domNode, (e) => {
            if (e.equals(10 /* KeyCode.Space */) || e.equals(3 /* KeyCode.Enter */)) {
                this._opts.onTrigger();
                e.preventDefault();
                return;
            }
            this._opts.onKeyDown?.(e);
        });
    }
    get domNode() {
        return this._domNode;
    }
    isEnabled() {
        return (this._domNode.tabIndex >= 0);
    }
    focus() {
        this._domNode.focus();
    }
    setEnabled(enabled) {
        this._domNode.classList.toggle('disabled', !enabled);
        this._domNode.setAttribute('aria-disabled', String(!enabled));
        this._domNode.tabIndex = enabled ? 0 : -1;
    }
    setExpanded(expanded) {
        this._domNode.setAttribute('aria-expanded', String(!!expanded));
        if (expanded) {
            this._domNode.classList.remove(...ThemeIcon.asClassNameArray(findCollapsedIcon));
            this._domNode.classList.add(...ThemeIcon.asClassNameArray(findExpandedIcon));
        }
        else {
            this._domNode.classList.remove(...ThemeIcon.asClassNameArray(findExpandedIcon));
            this._domNode.classList.add(...ThemeIcon.asClassNameArray(findCollapsedIcon));
        }
    }
}
// theming
registerThemingParticipant((theme, collector) => {
    const findMatchHighlightBorder = theme.getColor(editorFindMatchHighlightBorder);
    if (findMatchHighlightBorder) {
        collector.addRule(`.monaco-editor .findMatch { border: 1px ${isHighContrast(theme.type) ? 'dotted' : 'solid'} ${findMatchHighlightBorder}; box-sizing: border-box; }`);
    }
    const findRangeHighlightBorder = theme.getColor(editorFindRangeHighlightBorder);
    if (findRangeHighlightBorder) {
        collector.addRule(`.monaco-editor .findScope { border: 1px ${isHighContrast(theme.type) ? 'dashed' : 'solid'} ${findRangeHighlightBorder}; }`);
    }
    const hcBorder = theme.getColor(contrastBorder);
    if (hcBorder) {
        collector.addRule(`.monaco-editor .find-widget { border: 1px solid ${hcBorder}; }`);
    }
    const findMatchForeground = theme.getColor(editorFindMatchForeground);
    if (findMatchForeground) {
        collector.addRule(`.monaco-editor .findMatchInline { color: ${findMatchForeground}; }`);
    }
    const findMatchHighlightForeground = theme.getColor(editorFindMatchHighlightForeground);
    if (findMatchHighlightForeground) {
        collector.addRule(`.monaco-editor .currentFindMatchInline { color: ${findMatchHighlightForeground}; }`);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmluZFdpZGdldC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9maW5kL2Jyb3dzZXIvZmluZFdpZGdldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBR3ZELE9BQU8sRUFBRSxLQUFLLElBQUksT0FBTyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDNUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBS3RFLE9BQU8sRUFBd0QsSUFBSSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDdEgsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFdEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3BFLE9BQU8sS0FBSyxRQUFRLE1BQU0scUNBQXFDLENBQUM7QUFDaEUsT0FBTyxLQUFLLE9BQU8sTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RCxPQUFPLGtCQUFrQixDQUFDO0FBRzFCLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RCxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsNkJBQTZCLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBRXBILE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFFMUMsT0FBTyxFQUFFLHNCQUFzQixFQUFFLHlCQUF5QixFQUFFLE1BQU0sb0VBQW9FLENBQUM7QUFDdkksT0FBTyxF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