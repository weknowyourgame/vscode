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
var StickyScrollController_1;
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { ILanguageFeaturesService } from '../../../common/services/languageFeatures.js';
import { StickyScrollWidget, StickyScrollWidgetState } from './stickyScrollWidget.js';
import { StickyLineCandidateProvider } from './stickyScrollProvider.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { EditorContextKeys } from '../../../common/editorContextKeys.js';
import { ClickLinkGesture } from '../../gotoSymbol/browser/link/clickLinkGesture.js';
import { Range } from '../../../common/core/range.js';
import { getDefinitionsAtPosition } from '../../gotoSymbol/browser/goToSymbol.js';
import { goToDefinitionWithLocation } from '../../inlayHints/browser/inlayHintsLocations.js';
import { Position } from '../../../common/core/position.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { ILanguageConfigurationService } from '../../../common/languages/languageConfigurationRegistry.js';
import { ILanguageFeatureDebounceService } from '../../../common/services/languageFeatureDebounce.js';
import * as dom from '../../../../base/browser/dom.js';
import { StickyRange } from './stickyScrollElement.js';
import { StandardMouseEvent } from '../../../../base/browser/mouseEvent.js';
import { FoldingController } from '../../folding/browser/folding.js';
import { toggleCollapseState } from '../../folding/browser/foldingModel.js';
import { Emitter } from '../../../../base/common/event.js';
import { mainWindow } from '../../../../base/browser/window.js';
let StickyScrollController = class StickyScrollController extends Disposable {
    static { StickyScrollController_1 = this; }
    static { this.ID = 'store.contrib.stickyScrollController'; }
    constructor(_editor, _contextMenuService, _languageFeaturesService, _instaService, _languageConfigurationService, _languageFeatureDebounceService, _contextKeyService) {
        super();
        this._editor = _editor;
        this._contextMenuService = _contextMenuService;
        this._languageFeaturesService = _languageFeaturesService;
        this._instaService = _instaService;
        this._contextKeyService = _contextKeyService;
        this._sessionStore = new DisposableStore();
        this._maxStickyLines = Number.MAX_SAFE_INTEGER;
        this._candidateDefinitionsLength = -1;
        this._focusedStickyElementIndex = -1;
        this._enabled = false;
        this._focused = false;
        this._positionRevealed = false;
        this._onMouseDown = false;
        this._endLineNumbers = [];
        this._mouseTarget = null;
        this._onDidChangeStickyScrollHeight = this._register(new Emitter());
        this.onDidChangeStickyScrollHeight = this._onDidChangeStickyScrollHeight.event;
        this._stickyScrollWidget = new StickyScrollWidget(this._editor);
        this._stickyLineCandidateProvider = new StickyLineCandidateProvider(this._editor, _languageFeaturesService, _languageConfigurationService);
        this._register(this._stickyScrollWidget);
        this._register(this._stickyLineCandidateProvider);
        this._widgetState = StickyScrollWidgetState.Empty;
        const stickyScrollDomNode = this._stickyScrollWidget.getDomNode();
        this._register(this._editor.onDidChangeLineHeight((e) => {
            e.changes.forEach((change) => {
                const lineNumber = change.lineNumber;
                if (this._widgetState.startLineNumbers.includes(lineNumber)) {
                    this._renderStickyScroll(lineNumber);
                }
            });
        }));
        this._register(this._editor.onDidChangeFont((e) => {
            e.changes.forEach((change) => {
                const lineNumber = change.lineNumber;
                if (this._widgetState.startLineNumbers.includes(lineNumber)) {
                    this._renderStickyScroll(lineNumber);
                }
            });
        }));
        this._register(this._editor.onDidChangeConfiguration(e => {
            this._readConfigurationChange(e);
        }));
        this._register(dom.addDisposableListener(stickyScrollDomNode, dom.EventType.CONTEXT_MENU, async (event) => {
            this._onContextMenu(dom.getWindow(stickyScrollDomNode), event);
        }));
        this._stickyScrollFocusedContextKey = EditorContextKeys.stickyScrollFocused.bindTo(this._contextKeyService);
        this._stickyScrollVisibleContextKey = EditorContextKeys.stickyScrollVisible.bindTo(this._contextKeyService);
        const focusTracker = this._register(dom.trackFocus(stickyScrollDomNode));
        this._register(focusTracker.onDidBlur(_ => {
            // Suppose that the blurring is caused by scrolling, then keep the focus on the sticky scroll
            // This is determined by the fact that the height of the widget has become zero and there has been no position revealing
            if (this._positionRevealed === false && stickyScrollDomNode.clientHeight === 0) {
                this._focusedStickyElementIndex = -1;
                this.focus();
            }
            // In all other casees, dispose the focus on the sticky scroll
            else {
                this._disposeFocusStickyScrollStore();
            }
        }));
        this._register(focusTracker.onDidFocus(_ => {
            this.focus();
        }));
        this._registerMouseListeners();
        // Suppose that mouse down on the sticky scroll, then do not focus on the sticky scroll because this will be followed by the revealing of a position
        this._register(dom.addDisposableListener(stickyScrollDomNode, dom.EventType.MOUSE_DOWN, (e) => {
            this._onMouseDown = true;
        }));
        this._register(this._stickyScrollWidget.onDidChangeStickyScrollHeight((e) => {
            this._onDidChangeStickyScrollHeight.fire(e);
        }));
        this._onDidResize();
        this._readConfiguration();
    }
    get stickyScrollCandidateProvider() {
        return this._stickyLineCandidateProvider;
    }
    get stickyScrollWidgetState() {
        return this._widgetState;
    }
    get stickyScrollWidgetHeight() {
        return this._stickyScrollWidget.height;
    }
    static get(editor) {
        return editor.getContribution(StickyScrollController_1.ID);
    }
    _disposeFocusStickyScrollStore() {
        this._stickyScrollFocusedContextKey.set(false);
        this._focusDisposableStore?.dispose();
        this._focused = false;
        this._positionRevealed = false;
        this._onMouseDown = false;
    }
    isFocused() {
        return this._focused;
    }
    focus() {
        // If the mouse is down, do not focus on the sticky scroll
        if (this._onMouseDown) {
            this._onMouseDown = false;
            this._editor.focus();
            return;
        }
        const focusState = this._stickyScrollFocusedContextKey.get();
        if (focusState === true) {
            return;
        }
        this._focused = true;
        this._focusDisposableStore = new DisposableStore();
        this._stickyScrollFocusedContextKey.set(true);
        this._focusedStickyElementIndex = this._stickyScrollWidget.lineNumbers.length - 1;
        this._stickyScrollWidget.focusLineWithIndex(this._focusedStickyElementIndex);
    }
    focusNext() {
        if (this._focusedStickyElementIndex < this._stickyScrollWidget.lineNumberCount - 1) {
            this._focusNav(true);
        }
    }
    focusPrevious() {
        if (this._focusedStickyElementIndex > 0) {
            this._focusNav(false);
        }
    }
    selectEditor() {
        this._editor.focus();
    }
    // True is next, false is previous
    _focusNav(direction) {
        this._focusedStickyElementIndex = direction ? this._focusedStickyElementIndex + 1 : this._focusedStickyElementIndex - 1;
        this._stickyScrollWidget.focusLineWithIndex(this._focusedStickyElementIndex);
    }
    goToFocused() {
        const lineNumbers = this._stickyScrollWidget.lineNumbers;
        this._disposeFocusStickyScrollStore();
        this._revealPosition({ lineNumber: lineNumbers[this._focusedStickyElementIndex], column: 1 });
    }
    _revealPosition(position) {
        this._reveaInEditor(position, () => this._editor.revealPosition(position));
    }
    _revealLineInCenterIfOutsideViewport(position) {
        this._reveaInEditor(position, () => this._editor.revealLineInCenterIfOutsideViewport(position.lineNumber, 0 /* ScrollType.Smooth */));
    }
    _reveaInEditor(position, revealFunction) {
        if (this._focused) {
            this._disposeFocusStickyScrollStore();
        }
        this._positionRevealed = true;
        revealFunction();
        this._editor.setSelection(Range.fromPositions(position));
        this._editor.focus();
    }
    _registerMouseListeners() {
        const sessionStore = this._register(new DisposableStore());
        const gesture = this._register(new ClickLinkGesture(this._editor, {
            extractLineNumberFromMouseEvent: (e) => {
                const position = this._stickyScrollWidget.getEditorPositionFromNode(e.target.element);
                return position ? position.lineNumber : 0;
            }
        }));
        const getMouseEventTarget = (mouseEvent) => {
            if (!this._editor.hasModel()) {
                return null;
            }
            if (mouseEvent.target.type !== 12 /* MouseTargetType.OVERLAY_WIDGET */ || mouseEvent.target.detail !== this._stickyScrollWidget.getId()) {
                // not hovering over our widget
                return null;
            }
            const mouseTargetElement = mouseEvent.target.element;
            if (!mouseTargetElement || mouseTargetElement.innerText !== mouseTargetElement.innerHTML) {
                // not on a span element rendering text
                return null;
            }
            const position = this._stickyScrollWidget.getEditorPositionFromNode(mouseTargetElement);
            if (!position) {
                // not hovering a sticky scroll line
                return null;
            }
            return {
                range: new Range(position.lineNumber, position.column, position.lineNumber, position.column + mouseTargetElement.innerText.length),
                textElement: mouseTargetElement
            };
        };
        const stickyScrollWidgetDomNode = this._stickyScrollWidget.getDomNode();
        this._register(dom.addStandardDisposableListener(stickyScrollWidgetDomNode, dom.EventType.CLICK, (mouseEvent) => {
            if (mouseEvent.ctrlKey || mouseEvent.altKey || mouseEvent.metaKey) {
                // modifier pressed
                return;
            }
            if (!mouseEvent.leftButton) {
                // not left click
                return;
            }
            if (mouseEvent.shiftKey) {
                // shift click
                const lineIndex = this._stickyScrollWidget.getLineIndexFromChildDomNode(mouseEvent.target);
                if (lineIndex === null) {
                    return;
                }
                const position = new Position(this._endLineNumbers[lineIndex], 1);
                this._revealLineInCenterIfOutsideViewport(position);
                return;
            }
            const isInFoldingIconDomNode = this._stickyScrollWidget.isInFoldingIconDomNode(mouseEvent.target);
            if (isInFoldingIconDomNode) {
                // clicked on folding icon
                const lineNumber = this._stickyScrollWidget.getLineNumberFromChildDomNode(mouseEvent.target);
                this._toggleFoldingRegionForLine(lineNumber);
                return;
            }
            const isInStickyLine = this._stickyScrollWidget.isInStickyLine(mouseEvent.target);
            if (!isInStickyLine) {
                return;
            }
            // normal click
            let position = this._stickyScrollWidget.getEditorPositionFromNode(mouseEvent.target);
            if (!position) {
                const lineNumber = this._stickyScrollWidget.getLineNumberFromChildDomNode(mouseEvent.target);
                if (lineNumber === null) {
                    // not hovering a sticky scroll line
                    return;
                }
                position = new Position(lineNumber, 1);
            }
            this._revealPosition(position);
        }));
        this._register(dom.addDisposableListener(mainWindow, dom.EventType.MOUSE_MOVE, mouseEvent => {
            this._mouseTarget = mouseEvent.target;
            this._onMouseMoveOrKeyDown(mouseEvent);
        }));
        this._register(dom.addDisposableListener(mainWindow, dom.EventType.KEY_DOWN, mouseEvent => {
            this._onMouseMoveOrKeyDown(mouseEvent);
        }));
        this._register(dom.addDisposableListener(mainWindow, dom.EventType.KEY_UP, () => {
            if (this._showEndForLine !== undefined) {
                this._showEndForLine = undefined;
                this._renderStickyScroll();
            }
        }));
        this._register(gesture.onMouseMoveOrRelevantKeyDown(([mouseEvent, _keyboardEvent]) => {
            const mouseTarget = getMouseEventTarget(mouseEvent);
            if (!mouseTarget || !mouseEvent.hasTriggerModifier || !this._editor.hasModel()) {
                sessionStore.clear();
                return;
            }
            const { range, textElement } = mouseTarget;
            if (!range.equalsRange(this._stickyRangeProjectedOnEditor)) {
                this._stickyRangeProjectedOnEditor = range;
                sessionStore.clear();
            }
            else if (textElement.style.textDecoration === 'underline') {
                return;
            }
            const cancellationToken = new CancellationTokenSource();
            sessionStore.add(toDisposable(() => cancellationToken.dispose(true)));
            let currentHTMLChild;
            getDefinitionsAtPosition(this._languageFeaturesService.definitionProvider, this._editor.getModel(), new Position(range.startLineNumber, range.startColumn + 1), false, cancellationToken.token).then((candidateDefinitions => {
                if (cancellationToken.token.isCancellationRequested) {
                    return;
                }
                if (candidateDefinitions.length !== 0) {
                    this._candidateDefinitionsLength = candidateDefinitions.length;
                    const childHTML = textElement;
                    if (currentHTMLChild !== childHTML) {
                        sessionStore.clear();
                        currentHTMLChild = childHTML;
                        currentHTMLChild.style.textDecoration = 'underline';
                        sessionStore.add(toDisposable(() => {
                            currentHTMLChild.style.textDecoration = 'none';
                        }));
                    }
                    else if (!currentHTMLChild) {
                        currentHTMLChild = childHTML;
                        currentHTMLChild.style.textDecoration = 'underline';
                        sessionStore.add(toDisposable(() => {
                            currentHTMLChild.style.textDecoration = 'none';
                        }));
                    }
                }
                else {
                    sessionStore.clear();
                }
            }));
        }));
        this._register(gesture.onCancel(() => {
            sessionStore.clear();
        }));
        this._register(gesture.onExecute(async (e) => {
            if (e.target.type !== 12 /* MouseTargetType.OVERLAY_WIDGET */ || e.target.detail !== this._stickyScrollWidget.getId()) {
                // not hovering over our widget
                return;
            }
            const position = this._stickyScrollWidget.getEditorPositionFromNode(e.target.element);
            if (!position) {
                // not hovering a sticky scroll line
                return;
            }
            if (!this._editor.hasModel() || !this._stickyRangeProjectedOnEditor) {
                return;
            }
            if (this._candidateDefinitionsLength > 1) {
                if (this._focused) {
                    this._disposeFocusStickyScrollStore();
                }
                this._revealPosition({ lineNumber: position.lineNumber, column: 1 });
            }
            this._instaService.invokeFunction(goToDefinitionWithLocation, e, this._editor, { uri: this._editor.getModel().uri, range: this._stickyRangeProjectedOnEditor });
        }));
    }
    _onContextMenu(targetWindow, e) {
        const event = new StandardMouseEvent(targetWindow, e);
        this._contextMenuService.showContextMenu({
            menuId: MenuId.StickyScrollContext,
            getAnchor: () => event,
        });
    }
    _onMouseMoveOrKeyDown(mouseEvent) {
        if (!mouseEvent.shiftKey) {
            return;
        }
        if (!this._mouseTarget || !dom.isHTMLElement(this._mouseTarget)) {
            return;
        }
        const currentEndForLineIndex = this._stickyScrollWidget.getLineIndexFromChildDomNode(this._mouseTarget);
        if (currentEndForLineIndex === null || this._showEndForLine === currentEndForLineIndex) {
            return;
        }
        this._showEndForLine = currentEndForLineIndex;
        this._renderStickyScroll();
    }
    _toggleFoldingRegionForLine(line) {
        if (!this._foldingModel || line === null) {
            return;
        }
        const stickyLine = this._stickyScrollWidget.getRenderedStickyLine(line);
        const foldingIcon = stickyLine?.foldingIcon;
        if (!foldingIcon) {
            return;
        }
        toggleCollapseState(this._foldingModel, 1, [line]);
        foldingIcon.isCollapsed = !foldingIcon.isCollapsed;
        const scrollTop = (foldingIcon.isCollapsed ?
            this._editor.getTopForLineNumber(foldingIcon.foldingEndLine)
            : this._editor.getTopForLineNumber(foldingIcon.foldingStartLine))
            - this._editor.getOption(75 /* EditorOption.lineHeight */) * stickyLine.index + 1;
        this._editor.setScrollTop(scrollTop);
        this._renderStickyScroll(line);
    }
    _readConfiguration() {
        const options = this._editor.getOption(131 /* EditorOption.stickyScroll */);
        if (options.enabled === false) {
            this._editor.removeOverlayWidget(this._stickyScrollWidget);
            this._resetState();
            this._sessionStore.clear();
            this._enabled = false;
            return;
        }
        else if (options.enabled && !this._enabled) {
            // When sticky scroll was just enabled, add the listeners on the sticky scroll
            this._editor.addOverlayWidget(this._stickyScrollWidget);
            this._sessionStore.add(this._editor.onDidScrollChange((e) => {
                if (e.scrollTopChanged) {
                    this._showEndForLine = undefined;
                    this._renderStickyScroll();
                }
            }));
            this._sessionStore.add(this._editor.onDidLayoutChange(() => this._onDidResize()));
            this._sessionStore.add(this._editor.onDidChangeModelTokens((e) => this._onTokensChange(e)));
            this._sessionStore.add(this._stickyLineCandidateProvider.onDidChangeStickyScroll(() => {
                this._showEndForLine = undefined;
                this._renderStickyScroll();
            }));
            this._enabled = true;
        }
        const lineNumberOption = this._editor.getOption(76 /* EditorOption.lineNumbers */);
        if (lineNumberOption.renderType === 2 /* RenderLineNumbersType.Relative */) {
            this._sessionStore.add(this._editor.onDidChangeCursorPosition(() => {
                this._showEndForLine = undefined;
                this._renderStickyScroll(0);
            }));
        }
    }
    _readConfigurationChange(event) {
        if (event.hasChanged(131 /* EditorOption.stickyScroll */)
            || event.hasChanged(81 /* EditorOption.minimap */)
            || event.hasChanged(75 /* EditorOption.lineHeight */)
            || event.hasChanged(126 /* EditorOption.showFoldingControls */)
            || event.hasChanged(76 /* EditorOption.lineNumbers */)) {
            this._readConfiguration();
        }
        if (event.hasChanged(76 /* EditorOption.lineNumbers */) || event.hasChanged(52 /* EditorOption.folding */) || event.hasChanged(126 /* EditorOption.showFoldingControls */)) {
            this._renderStickyScroll(0);
        }
    }
    _needsUpdate(event) {
        const stickyLineNumbers = this._stickyScrollWidget.getCurrentLines();
        for (const stickyLineNumber of stickyLineNumbers) {
            for (const range of event.ranges) {
                if (stickyLineNumber >= range.fromLineNumber && stickyLineNumber <= range.toLineNumber) {
                    return true;
                }
            }
        }
        return false;
    }
    _onTokensChange(event) {
        if (this._needsUpdate(event)) {
            // Rebuilding the whole widget from line 0
            this._renderStickyScroll(0);
        }
    }
    _onDidResize() {
        const layoutInfo = this._editor.getLayoutInfo();
        // Make sure sticky scroll doesn't take up more than 25% of the editor
        const theoreticalLines = layoutInfo.height / this._editor.getOption(75 /* EditorOption.lineHeight */);
        this._maxStickyLines = Math.round(theoreticalLines * .25);
        this._renderStickyScroll(0);
    }
    async _renderStickyScroll(rebuildFromLine) {
        const model = this._editor.getModel();
        if (!model || model.isTooLargeForTokenization()) {
            this._resetState();
            return;
        }
        const nextRebuildFromLine = this._updateAndGetMinRebuildFromLine(rebuildFromLine);
        const stickyWidgetVersion = this._stickyLineCandidateProvider.getVersionId();
        const shouldUpdateState = stickyWidgetVersion === undefined || stickyWidgetVersion === model.getVersionId();
        if (shouldUpdateState) {
            if (!this._focused) {
                await this._updateState(nextRebuildFromLine);
            }
            else {
                // Suppose that previously the sticky scroll widget had height 0, then if there are visible lines, set the last line as focused
                if (this._focusedStickyElementIndex === -1) {
                    await this._updateState(nextRebuildFromLine);
                    this._focusedStickyElementIndex = this._stickyScrollWidget.lineNumberCount - 1;
                    if (this._focusedStickyElementIndex !== -1) {
                        this._stickyScrollWidget.focusLineWithIndex(this._focusedStickyElementIndex);
                    }
                }
                else {
                    const focusedStickyElementLineNumber = this._stickyScrollWidget.lineNumbers[this._focusedStickyElementIndex];
                    await this._updateState(nextRebuildFromLine);
                    // Suppose that after setting the state, there are no sticky lines, set the focused index to -1
                    if (this._stickyScrollWidget.lineNumberCount === 0) {
                        this._focusedStickyElementIndex = -1;
                    }
                    else {
                        const previousFocusedLineNumberExists = this._stickyScrollWidget.lineNumbers.includes(focusedStickyElementLineNumber);
                        // If the line number is still there, do not change anything
                        // If the line number is not there, set the new focused line to be the last line
                        if (!previousFocusedLineNumberExists) {
                            this._focusedStickyElementIndex = this._stickyScrollWidget.lineNumberCount - 1;
                        }
                        this._stickyScrollWidget.focusLineWithIndex(this._focusedStickyElementIndex);
                    }
                }
            }
        }
    }
    _updateAndGetMinRebuildFromLine(rebuildFromLine) {
        if (rebuildFromLine !== undefined) {
            const minRebuildFromLineOrInfinity = this._minRebuildFromLine !== undefined ? this._minRebuildFromLine : Infinity;
            this._minRebuildFromLine = Math.min(rebuildFromLine, minRebuildFromLineOrInfinity);
        }
        return this._minRebuildFromLine;
    }
    async _updateState(rebuildFromLine) {
        this._minRebuildFromLine = undefined;
        this._foldingModel = await FoldingController.get(this._editor)?.getFoldingModel() ?? undefined;
        this._widgetState = this.findScrollWidgetState();
        const stickyWidgetHasLines = this._widgetState.startLineNumbers.length > 0;
        this._stickyScrollVisibleContextKey.set(stickyWidgetHasLines);
        this._stickyScrollWidget.setState(this._widgetState, this._foldingModel, rebuildFromLine);
    }
    async _resetState() {
        this._minRebuildFromLine = undefined;
        this._foldingModel = undefined;
        this._widgetState = StickyScrollWidgetState.Empty;
        this._stickyScrollVisibleContextKey.set(false);
        this._stickyScrollWidget.setState(undefined, undefined);
    }
    findScrollWidgetState() {
        const maxNumberStickyLines = Math.min(this._maxStickyLines, this._editor.getOption(131 /* EditorOption.stickyScroll */).maxLineCount);
        const scrollTop = this._editor.getScrollTop();
        let lastLineRelativePosition = 0;
        const startLineNumbers = [];
        const endLineNumbers = [];
        const arrayVisibleRanges = this._editor.getVisibleRanges();
        if (arrayVisibleRanges.length !== 0) {
            const fullVisibleRange = new StickyRange(arrayVisibleRanges[0].startLineNumber, arrayVisibleRanges[arrayVisibleRanges.length - 1].endLineNumber);
            const candidateRanges = this._stickyLineCandidateProvider.getCandidateStickyLinesIntersecting(fullVisibleRange);
            for (const range of candidateRanges) {
                const start = range.startLineNumber;
                const end = range.endLineNumber;
                const topOfElement = range.top;
                const bottomOfElement = topOfElement + range.height;
                const topOfBeginningLine = this._editor.getTopForLineNumber(start) - scrollTop;
                const bottomOfEndLine = this._editor.getBottomForLineNumber(end) - scrollTop;
                if (topOfElement > topOfBeginningLine && topOfElement <= bottomOfEndLine) {
                    startLineNumbers.push(start);
                    endLineNumbers.push(end + 1);
                    if (bottomOfElement > bottomOfEndLine) {
                        lastLineRelativePosition = bottomOfEndLine - bottomOfElement;
                    }
                }
                if (startLineNumbers.length === maxNumberStickyLines) {
                    break;
                }
            }
        }
        this._endLineNumbers = endLineNumbers;
        return new StickyScrollWidgetState(startLineNumbers, endLineNumbers, lastLineRelativePosition, this._showEndForLine);
    }
    dispose() {
        super.dispose();
        this._sessionStore.dispose();
    }
};
StickyScrollController = StickyScrollController_1 = __decorate([
    __param(1, IContextMenuService),
    __param(2, ILanguageFeaturesService),
    __param(3, IInstantiationService),
    __param(4, ILanguageConfigurationService),
    __param(5, ILanguageFeatureDebounceService),
    __param(6, IContextKeyService)
], StickyScrollController);
export { StickyScrollController };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RpY2t5U2Nyb2xsQ29udHJvbGxlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9zdGlja3lTY3JvbGwvYnJvd3Nlci9zdGlja3lTY3JvbGxDb250cm9sbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUdqRyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUV4RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RixPQUFPLEVBQWdDLDJCQUEyQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFFdEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDOUYsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3hFLE9BQU8sRUFBZSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBdUIsTUFBTSxtREFBbUQsQ0FBQztBQUMxRyxPQUFPLEVBQVUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDOUQsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbEYsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDN0YsT0FBTyxFQUFhLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSx1QkFBdUIs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