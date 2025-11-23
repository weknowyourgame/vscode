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
import { addDisposableListener, addStandardDisposableListener, reset } from '../../../../../base/browser/dom.js';
import { createTrustedTypesPolicy } from '../../../../../base/browser/trustedTypes.js';
import { ActionBar } from '../../../../../base/browser/ui/actionbar/actionbar.js';
import { DomScrollableElement } from '../../../../../base/browser/ui/scrollbar/scrollableElement.js';
import { forEachAdjacent, groupAdjacentBy } from '../../../../../base/common/arrays.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun, autorunWithStore, derived, observableValue, subtransaction, transaction } from '../../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { applyFontInfo } from '../../../config/domFontInfo.js';
import { applyStyle } from '../utils.js';
import { EditorFontLigatures } from '../../../../common/config/editorOptions.js';
import { LineRange } from '../../../../common/core/ranges/lineRange.js';
import { OffsetRange } from '../../../../common/core/ranges/offsetRange.js';
import { Position } from '../../../../common/core/position.js';
import { Range } from '../../../../common/core/range.js';
import { LineRangeMapping } from '../../../../common/diff/rangeMapping.js';
import { ILanguageService } from '../../../../common/languages/language.js';
import { LineTokens } from '../../../../common/tokens/lineTokens.js';
import { RenderLineInput, renderViewLine2 } from '../../../../common/viewLayout/viewLineRenderer.js';
import { ViewLineRenderingData } from '../../../../common/viewModel.js';
import { localize } from '../../../../../nls.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { registerIcon } from '../../../../../platform/theme/common/iconRegistry.js';
import './accessibleDiffViewer.css';
import { toAction } from '../../../../../base/common/actions.js';
const accessibleDiffViewerInsertIcon = registerIcon('diff-review-insert', Codicon.add, localize('accessibleDiffViewerInsertIcon', 'Icon for \'Insert\' in accessible diff viewer.'));
const accessibleDiffViewerRemoveIcon = registerIcon('diff-review-remove', Codicon.remove, localize('accessibleDiffViewerRemoveIcon', 'Icon for \'Remove\' in accessible diff viewer.'));
const accessibleDiffViewerCloseIcon = registerIcon('diff-review-close', Codicon.close, localize('accessibleDiffViewerCloseIcon', 'Icon for \'Close\' in accessible diff viewer.'));
let AccessibleDiffViewer = class AccessibleDiffViewer extends Disposable {
    static { this._ttPolicy = createTrustedTypesPolicy('diffReview', { createHTML: value => value }); }
    constructor(_parentNode, _visible, _setVisible, _canClose, _width, _height, _diffs, _models, _instantiationService) {
        super();
        this._parentNode = _parentNode;
        this._visible = _visible;
        this._setVisible = _setVisible;
        this._canClose = _canClose;
        this._width = _width;
        this._height = _height;
        this._diffs = _diffs;
        this._models = _models;
        this._instantiationService = _instantiationService;
        this._state = derived(this, (reader) => {
            const visible = this._visible.read(reader);
            this._parentNode.style.visibility = visible ? 'visible' : 'hidden';
            if (!visible) {
                return null;
            }
            const model = reader.store.add(this._instantiationService.createInstance(ViewModel, this._diffs, this._models, this._setVisible, this._canClose));
            const view = reader.store.add(this._instantiationService.createInstance(View, this._parentNode, model, this._width, this._height, this._models));
            return { model, view, };
        }).recomputeInitiallyAndOnChange(this._store);
    }
    next() {
        transaction(tx => {
            const isVisible = this._visible.get();
            this._setVisible(true, tx);
            if (isVisible) {
                this._state.get().model.nextGroup(tx);
            }
        });
    }
    prev() {
        transaction(tx => {
            this._setVisible(true, tx);
            this._state.get().model.previousGroup(tx);
        });
    }
    close() {
        transaction(tx => {
            this._setVisible(false, tx);
        });
    }
};
AccessibleDiffViewer = __decorate([
    __param(8, IInstantiationService)
], AccessibleDiffViewer);
export { AccessibleDiffViewer };
let ViewModel = class ViewModel extends Disposable {
    constructor(_diffs, _models, _setVisible, canClose, _accessibilitySignalService) {
        super();
        this._diffs = _diffs;
        this._models = _models;
        this._setVisible = _setVisible;
        this.canClose = canClose;
        this._accessibilitySignalService = _accessibilitySignalService;
        this._groups = observableValue(this, []);
        this._currentGroupIdx = observableValue(this, 0);
        this._currentElementIdx = observableValue(this, 0);
        this.groups = this._groups;
        this.currentGroup = this._currentGroupIdx.map((idx, r) => this._groups.read(r)[idx]);
        this.currentGroupIndex = this._currentGroupIdx;
        this.currentElement = this._currentElementIdx.map((idx, r) => this.currentGroup.read(r)?.lines[idx]);
        this._register(autorun(reader => {
            /** @description update groups */
            const diffs = this._diffs.read(reader);
            if (!diffs) {
                this._groups.set([], undefined);
                return;
            }
            const groups = computeViewElementGroups(diffs, this._models.getOriginalModel().getLineCount(), this._models.getModifiedModel().getLineCount());
            transaction(tx => {
                const p = this._models.getModifiedPosition();
                if (p) {
                    const nextGroup = groups.findIndex(g => p?.lineNumber < g.range.modified.endLineNumberExclusive);
                    if (nextGroup !== -1) {
                        this._currentGroupIdx.set(nextGroup, tx);
                    }
                }
                this._groups.set(groups, tx);
            });
        }));
        this._register(autorun(reader => {
            /** @description play audio-cue for diff */
            const currentViewItem = this.currentElement.read(reader);
            if (currentViewItem?.type === LineType.Deleted) {
                this._accessibilitySignalService.playSignal(AccessibilitySignal.diffLineDeleted, { source: 'accessibleDiffViewer.currentElementChanged' });
            }
            else if (currentViewItem?.type === LineType.Added) {
                this._accessibilitySignalService.playSignal(AccessibilitySignal.diffLineInserted, { source: 'accessibleDiffViewer.currentElementChanged' });
            }
        }));
        this._register(autorun(reader => {
            /** @description select lines in editor */
            // This ensures editor commands (like revert/stage) work
            const currentViewItem = this.currentElement.read(reader);
            if (currentViewItem && currentViewItem.type !== LineType.Header) {
                const lineNumber = currentViewItem.modifiedLineNumber ?? currentViewItem.diff.modified.startLineNumber;
                this._models.modifiedSetSelection(Range.fromPositions(new Position(lineNumber, 1)));
            }
        }));
    }
    _goToGroupDelta(delta, tx) {
        const groups = this.groups.get();
        if (!groups || groups.length <= 1) {
            return;
        }
        subtransaction(tx, tx => {
            this._currentGroupIdx.set(OffsetRange.ofLength(groups.length).clipCyclic(this._currentGroupIdx.get() + delta), tx);
            this._currentElementIdx.set(0, tx);
        });
    }
    nextGroup(tx) { this._goToGroupDelta(1, tx); }
    previousGroup(tx) { this._goToGroupDelta(-1, tx); }
    _goToLineDelta(delta) {
        const group = this.currentGroup.get();
        if (!group || group.lines.length <= 1) {
            return;
        }
        transaction(tx => {
            this._currentElementIdx.set(OffsetRange.ofLength(group.lines.length).clip(this._currentElementIdx.get() + delta), tx);
        });
    }
    goToNextLine() { this._goToLineDelta(1); }
    goToPreviousLine() { this._goToLineDelta(-1); }
    goToLine(line) {
        const group = this.currentGroup.get();
        if (!group) {
            return;
        }
        const idx = group.lines.indexOf(line);
        if (idx === -1) {
            return;
        }
        transaction(tx => {
            this._currentElementIdx.set(idx, tx);
        });
    }
    revealCurrentElementInEditor() {
        if (!this.canClose.get()) {
            return;
        }
        this._setVisible(false, undefined);
        const curElem = this.currentElement.get();
        if (curElem) {
            if (curElem.type === LineType.Deleted) {
                this._models.originalReveal(Range.fromPositions(new Position(curElem.originalLineNumber, 1)));
            }
            else {
                this._models.modifiedReveal(curElem.type !== LineType.Header
                    ? Range.fromPositions(new Position(curElem.modifiedLineNumber, 1))
                    : undefined);
            }
        }
    }
    close() {
        if (!this.canClose.get()) {
            return;
        }
        this._setVisible(false, undefined);
        this._models.modifiedFocus();
    }
};
ViewModel = __decorate([
    __param(4, IAccessibilitySignalService)
], ViewModel);
const viewElementGroupLineMargin = 3;
function computeViewElementGroups(diffs, originalLineCount, modifiedLineCount) {
    const result = [];
    for (const g of groupAdjacentBy(diffs, (a, b) => (b.modified.startLineNumber - a.modified.endLineNumberExclusive < 2 * viewElementGroupLineMargin))) {
        const viewElements = [];
        viewElements.push(new HeaderViewElement());
        const origFullRange = new LineRange(Math.max(1, g[0].original.startLineNumber - viewElementGroupLineMargin), Math.min(g[g.length - 1].original.endLineNumberExclusive + viewElementGroupLineMargin, originalLineCount + 1));
        const modifiedFullRange = new LineRange(Math.max(1, g[0].modified.startLineNumber - viewElementGroupLineMargin), Math.min(g[g.length - 1].modified.endLineNumberExclusive + viewElementGroupLineMargin, modifiedLineCount + 1));
        forEachAdjacent(g, (a, b) => {
            const origRange = new LineRange(a ? a.original.endLineNumberExclusive : origFullRange.startLineNumber, b ? b.original.startLineNumber : origFullRange.endLineNumberExclusive);
            const modifiedRange = new LineRange(a ? a.modified.endLineNumberExclusive : modifiedFullRange.startLineNumber, b ? b.modified.startLineNumber : modifiedFullRange.endLineNumberExclusive);
            origRange.forEach(origLineNumber => {
                viewElements.push(new UnchangedLineViewElement(origLineNumber, modifiedRange.startLineNumber + (origLineNumber - origRange.startLineNumber)));
            });
            if (b) {
                b.original.forEach(origLineNumber => {
                    viewElements.push(new DeletedLineViewElement(b, origLineNumber));
                });
                b.modified.forEach(modifiedLineNumber => {
                    viewElements.push(new AddedLineViewElement(b, modifiedLineNumber));
                });
            }
        });
        const modifiedRange = g[0].modified.join(g[g.length - 1].modified);
        const originalRange = g[0].original.join(g[g.length - 1].original);
        result.push(new ViewElementGroup(new LineRangeMapping(modifiedRange, originalRange), viewElements));
    }
    return result;
}
var LineType;
(function (LineType) {
    LineType[LineType["Header"] = 0] = "Header";
    LineType[LineType["Unchanged"] = 1] = "Unchanged";
    LineType[LineType["Deleted"] = 2] = "Deleted";
    LineType[LineType["Added"] = 3] = "Added";
})(LineType || (LineType = {}));
class ViewElementGroup {
    constructor(range, lines) {
        this.range = range;
        this.lines = lines;
    }
}
class HeaderViewElement {
    constructor() {
        this.type = LineType.Header;
    }
}
class DeletedLineViewElement {
    constructor(diff, originalLineNumber) {
        this.diff = diff;
        this.originalLineNumber = originalLineNumber;
        this.type = LineType.Deleted;
        this.modifiedLineNumber = undefined;
    }
}
class AddedLineViewElement {
    constructor(diff, modifiedLineNumber) {
        this.diff = diff;
        this.modifiedLineNumber = modifiedLineNumber;
        this.type = LineType.Added;
        this.originalLineNumber = undefined;
    }
}
class UnchangedLineViewElement {
    constructor(originalLineNumber, modifiedLineNumber) {
        this.originalLineNumber = originalLineNumber;
        this.modifiedLineNumber = modifiedLineNumber;
        this.type = LineType.Unchanged;
    }
}
let View = class View extends Disposable {
    constructor(_element, _model, _width, _height, _models, _languageService) {
        super();
        this._element = _element;
        this._model = _model;
        this._width = _width;
        this._height = _height;
        this._models = _models;
        this._languageService = _languageService;
        this.domNode = this._element;
        this.domNode.className = 'monaco-component diff-review monaco-editor-background';
        const actionBarContainer = document.createElement('div');
        actionBarContainer.className = 'diff-review-actions';
        this._actionBar = this._register(new ActionBar(actionBarContainer));
        this._register(autorun(reader => {
            /** @description update actions */
            this._actionBar.clear();
            if (this._model.canClose.read(reader)) {
                this._actionBar.push(toAction({
                    id: 'diffreview.close',
                    label: localize('label.close', "Close"),
                    class: 'close-diff-review ' + ThemeIcon.asClassName(accessibleDiffViewerCloseIcon),
                    enabled: true,
                    run: async () => _model.close()
                }), { label: false, icon: true });
            }
        }));
        this._content = document.createElement('div');
        this._content.className = 'diff-review-content';
        this._content.setAttribute('role', 'code');
        this._scrollbar = this._register(new DomScrollableElement(this._content, {}));
        reset(this.domNode, this._scrollbar.getDomNode(), actionBarContainer);
        this._register(autorun(r => {
            this._height.read(r);
            this._width.read(r);
            this._scrollbar.scanDomNode();
        }));
        this._register(toDisposable(() => { reset(this.domNode); }));
        this._register(applyStyle(this.domNode, { width: this._width, height: this._height }));
        this._register(applyStyle(this._content, { width: this._width, height: this._height }));
        this._register(autorunWithStore((reader, store) => {
            /** @description render */
            this._model.currentGroup.read(reader);
            this._render(store);
        }));
        // TODO@hediet use commands
        this._register(addStandardDisposableListener(this.domNode, 'keydown', (e) => {
            if (e.equals(18 /* KeyCode.DownArrow */)
                || e.equals(2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */)
                || e.equals(512 /* KeyMod.Alt */ | 18 /* KeyCode.DownArrow */)) {
                e.preventDefault();
                this._model.goToNextLine();
            }
            if (e.equals(16 /* KeyCode.UpArrow */)
                || e.equals(2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */)
                || e.equals(512 /* KeyMod.Alt */ | 16 /* KeyCode.UpArrow */)) {
                e.preventDefault();
                this._model.goToPreviousLine();
            }
            if (e.equals(9 /* KeyCode.Escape */)
                || e.equals(2048 /* KeyMod.CtrlCmd */ | 9 /* KeyCode.Escape */)
                || e.equals(512 /* KeyMod.Alt */ | 9 /* KeyCode.Escape */)
                || e.equals(1024 /* KeyMod.Shift */ | 9 /* KeyCode.Escape */)) {
                e.preventDefault();
                this._model.close();
            }
            if (e.equals(10 /* KeyCode.Space */)
                || e.equals(3 /* KeyCode.Enter */)) {
                e.preventDefault();
                this._model.revealCurrentElementInEditor();
            }
        }));
    }
    _render(store) {
        const originalOptions = this._models.getOriginalOptions();
        const modifiedOptions = this._models.getModifiedOptions();
        const container = document.createElement('div');
        container.className = 'diff-review-table';
        container.setAttribute('role', 'list');
        container.setAttribute('aria-label', localize('ariaLabel', 'Accessible Diff Viewer. Use arrow up and down to navigate.'));
        applyFontInfo(container, modifiedOptions.get(59 /* EditorOption.fontInfo */));
        reset(this._content, container);
        const originalModel = this._models.getOriginalModel();
        const modifiedModel = this._models.getModifiedModel();
        if (!originalModel || !modifiedModel) {
            return;
        }
        const originalModelOpts = originalModel.getOptions();
        const modifiedModelOpts = modifiedModel.getOptions();
        const lineHeight = modifiedOptions.get(75 /* EditorOption.lineHeight */);
        const group = this._model.currentGroup.get();
        for (const viewItem of group?.lines || []) {
            if (!group) {
                break;
            }
            let row;
            if (viewItem.type === LineType.Header) {
                const header = document.createElement('div');
                header.className = 'diff-review-row';
                header.setAttribute('role', 'listitem');
                const r = group.range;
                const diffIndex = this._model.currentGroupIndex.get();
                const diffsLength = this._model.groups.get().length;
                const getAriaLines = (lines) => lines === 0 ? localize('no_lines_changed', "no lines changed")
                    : lines === 1 ? localize('one_line_changed', "1 line changed")
                        : localize('more_lines_changed', "{0} lines changed", lines);
                const originalChangedLinesCntAria = getAriaLines(r.original.length);
                const modifiedChangedLinesCntAria = getAriaLines(r.modified.length);
                header.setAttribute('aria-label', localize({
                    key: 'header',
                    comment: [
                        'This is the ARIA label for a git diff header.',
                        'A git diff header looks like this: @@ -154,12 +159,39 @@.',
                        'That encodes that at original line 154 (which is now line 159), 12 lines were removed/changed with 39 lines.',
                        'Variables 0 and 1 refer to the diff index out of total number of diffs.',
                        'Variables 2 and 4 will be numbers (a line number).',
                        'Variables 3 and 5 will be "no lines changed", "1 line changed" or "X lines changed", localized separately.'
                    ]
                }, "Difference {0} of {1}: original line {2}, {3}, modified line {4}, {5}", (diffIndex + 1), diffsLength, r.original.startLineNumber, originalChangedLinesCntAria, r.modified.startLineNumber, modifiedChangedLinesCntAria));
                const cell = document.createElement('div');
                cell.className = 'diff-review-cell diff-review-summary';
                // e.g.: `1/10: @@ -504,7 +517,7 @@`
                cell.appendChild(document.createTextNode(`${diffIndex + 1}/${diffsLength}: @@ -${r.original.startLineNumber},${r.original.length} +${r.modified.startLineNumber},${r.modified.length} @@`));
                header.appendChild(cell);
                row = header;
            }
            else {
                row = this._createRow(viewItem, lineHeight, this._width.get(), originalOptions, originalModel, originalModelOpts, modifiedOptions, modifiedModel, modifiedModelOpts);
            }
            container.appendChild(row);
            const isSelectedObs = derived(reader => /** @description isSelected */ this._model.currentElement.read(reader) === viewItem);
            store.add(autorun(reader => {
                /** @description update tab index */
                const isSelected = isSelectedObs.read(reader);
                row.tabIndex = isSelected ? 0 : -1;
                if (isSelected) {
                    row.focus();
                }
            }));
            store.add(addDisposableListener(row, 'focus', () => {
                this._model.goToLine(viewItem);
            }));
        }
        this._scrollbar.scanDomNode();
    }
    _createRow(item, lineHeight, width, originalOptions, originalModel, originalModelOpts, modifiedOptions, modifiedModel, modifiedModelOpts) {
        const originalLayoutInfo = originalOptions.get(165 /* EditorOption.layoutInfo */);
        const originalLineNumbersWidth = originalLayoutInfo.glyphMarginWidth + originalLayoutInfo.lineNumbersWidth;
        const modifiedLayoutInfo = modifiedOptions.get(165 /* EditorOption.layoutInfo */);
        const modifiedLineNumbersWidth = 10 + modifiedLayoutInfo.glyphMarginWidth + modifiedLayoutInfo.lineNumbersWidth;
        let rowClassName = 'diff-review-row';
        let lineNumbersExtraClassName = '';
        const spacerClassName = 'diff-review-spacer';
        let spacerIcon = null;
        switch (item.type) {
            case LineType.Added:
                rowClassName = 'diff-review-row line-insert';
                lineNumbersExtraClassName = ' char-insert';
                spacerIcon = accessibleDiffViewerInsertIcon;
                break;
            case LineType.Deleted:
                rowClassName = 'diff-review-row line-delete';
                lineNumbersExtraClassName = ' char-delete';
                spacerIcon = accessibleDiffViewerRemoveIcon;
                break;
        }
        const row = document.createElement('div');
        row.style.minWidth = width + 'px';
        row.className = rowClassName;
        row.setAttribute('role', 'listitem');
        row.ariaLevel = '';
        const cell = document.createElement('div');
        cell.className = 'diff-review-cell';
        cell.style.height = `${lineHeight}px`;
        row.appendChild(cell);
        const originalLineNumber = document.createElement('span');
        originalLineNumber.style.width = (originalLineNumbersWidth + 'px');
        originalLineNumber.style.minWidth = (originalLineNumbersWidth + 'px');
        originalLineNumber.className = 'diff-review-line-number' + lineNumbersExtraClassName;
        if (item.originalLineNumber !== undefined) {
            originalLineNumber.appendChild(document.createTextNode(String(item.originalLineNumber)));
        }
        else {
            originalLineNumber.innerText = '\u00a0';
        }
        cell.appendChild(originalLineNumber);
        const modifiedLineNumber = document.createElement('span');
        modifiedLineNumber.style.width = (modifiedLineNumbersWidth + 'px');
        modifiedLineNumber.style.minWidth = (modifiedLineNumbersWidth + 'px');
        modifiedLineNumber.style.paddingRight = '10px';
        modifiedLineNumber.className = 'diff-review-line-number' + lineNumbersExtraClassName;
        if (item.modifiedLineNumber !== undefined) {
            modifiedLineNumber.appendChild(document.createTextNode(String(item.modifiedLineNumber)));
        }
        else {
            modifiedLineNumber.innerText = '\u00a0';
        }
        cell.appendChild(modifiedLineNumber);
        const spacer = document.createElement('span');
        spacer.className = spacerClassName;
        if (spacerIcon) {
            const spacerCodicon = document.createElement('span');
            spacerCodicon.className = ThemeIcon.asClassName(spacerIcon);
            spacerCodicon.innerText = '\u00a0\u00a0';
            spacer.appendChild(spacerCodicon);
        }
        else {
            spacer.innerText = '\u00a0\u00a0';
        }
        cell.appendChild(spacer);
        let lineContent;
        if (item.modifiedLineNumber !== undefined) {
            let html = this._getLineHtml(modifiedModel, modifiedOptions, modifiedModelOpts.tabSize, item.modifiedLineNumber, this._languageService.languageIdCodec);
            if (AccessibleDiffViewer._ttPolicy) {
                html = AccessibleDiffViewer._ttPolicy.createHTML(html);
            }
            cell.insertAdjacentHTML('beforeend', html);
            lineContent = modifiedModel.getLineContent(item.modifiedLineNumber);
        }
        else {
            let html = this._getLineHtml(originalModel, originalOptions, originalModelOpts.tabSize, item.originalLineNumber, this._languageService.languageIdCodec);
            if (AccessibleDiffViewer._ttPolicy) {
                html = AccessibleDiffViewer._ttPolicy.createHTML(html);
            }
            cell.insertAdjacentHTML('beforeend', html);
            lineContent = originalModel.getLineContent(item.originalLineNumber);
        }
        if (lineContent.length === 0) {
            lineContent = localize('blankLine', "blank");
        }
        let ariaLabel = '';
        switch (item.type) {
            case LineType.Unchanged:
                if (item.originalLineNumber === item.modifiedLineNumber) {
                    ariaLabel = localize({ key: 'unchangedLine', comment: ['The placeholders are contents of the line and should not be translated.'] }, "{0} unchanged line {1}", lineContent, item.originalLineNumber);
                }
                else {
                    ariaLabel = localize('equalLine', "{0} original line {1} modified line {2}", lineContent, item.originalLineNumber, item.modifiedLineNumber);
                }
                break;
            case LineType.Added:
                ariaLabel = localize('insertLine', "+ {0} modified line {1}", lineContent, item.modifiedLineNumber);
                break;
            case LineType.Deleted:
                ariaLabel = localize('deleteLine', "- {0} original line {1}", lineContent, item.originalLineNumber);
                break;
        }
        row.setAttribute('aria-label', ariaLabel);
        return row;
    }
    _getLineHtml(model, options, tabSize, lineNumber, languageIdCodec) {
        const lineContent = model.getLineContent(lineNumber);
        const fontInfo = options.get(59 /* EditorOption.fontInfo */);
        const verticalScrollbarSize = options.get(117 /* EditorOption.scrollbar */).verticalScrollbarSize;
        const lineTokens = LineTokens.createEmpty(lineContent, languageIdCodec);
        const isBasicASCII = ViewLineRenderingData.isBasicASCII(lineContent, model.mightContainNonBasicASCII());
        const containsRTL = ViewLineRenderingData.containsRTL(lineContent, isBasicASCII, model.mightContainRTL());
        const r = renderViewLine2(new RenderLineInput((fontInfo.isMonospace && !options.get(40 /* EditorOption.disableMonospaceOptimizations */)), fontInfo.canUseHalfwidthRightwardsArrow, lineContent, false, isBasicASCII, containsRTL, 0, lineTokens, [], tabSize, 0, fontInfo.spaceWidth, fontInfo.middotWidth, fontInfo.wsmiddotWidth, options.get(133 /* EditorOption.stopRenderingLineAfter */), options.get(113 /* EditorOption.renderWhitespace */), options.get(108 /* EditorOption.renderControlCharacters */), options.get(60 /* EditorOption.fontLigatures */) !== EditorFontLigatures.OFF, null, null, verticalScrollbarSize));
        return r.html;
    }
};
View = __decorate([
    __param(5, ILanguageService)
], View);
export class AccessibleDiffViewerModelFromEditors {
    constructor(editors) {
        this.editors = editors;
    }
    getOriginalModel() {
        return this.editors.original.getModel();
    }
    getOriginalOptions() {
        return this.editors.original.getOptions();
    }
    originalReveal(range) {
        this.editors.original.revealRange(range);
        this.editors.original.setSelection(range);
        this.editors.original.focus();
    }
    getModifiedModel() {
        return this.editors.modified.getModel();
    }
    getModifiedOptions() {
        return this.editors.modified.getOptions();
    }
    modifiedReveal(range) {
        if (range) {
            this.editors.modified.revealRange(range);
            this.editors.modified.setSelection(range);
        }
        this.editors.modified.focus();
    }
    modifiedSetSelection(range) {
        this.editors.modified.setSelection(range);
    }
    modifiedFocus() {
        this.editors.modified.focus();
    }
    getModifiedPosition() {
        return this.editors.modified.getPosition() ?? undefined;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWNjZXNzaWJsZURpZmZWaWV3ZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3IvY29tcG9uZW50cy9hY2Nlc3NpYmxlRGlmZlZpZXdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsNkJBQTZCLEVBQUUsS0FBSyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDakgsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDdkYsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxlQUFlLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDeEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRWpFLE9BQU8sRUFBRSxVQUFVLEVBQW1CLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BHLE9BQU8sRUFBNkIsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3ZLLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUN6QyxPQUFPLEVBQUUsbUJBQW1CLEVBQXdDLE1BQU0sNENBQTRDLENBQUM7QUFDdkgsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3hFLE9BQU8sRUFB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