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
import { $, addDisposableListener } from '../../../../../../base/browser/dom.js';
import { ArrayQueue } from '../../../../../../base/common/arrays.js';
import { RunOnceScheduler } from '../../../../../../base/common/async.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { Disposable, DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { autorun, derived, observableFromEvent, observableValue } from '../../../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { assertReturnsDefined } from '../../../../../../base/common/types.js';
import { applyFontInfo } from '../../../../config/domFontInfo.js';
import { diffDeleteDecoration, diffRemoveIcon } from '../../registrations.contribution.js';
import { DiffMapping } from '../../diffEditorViewModel.js';
import { InlineDiffDeletedCodeMargin } from './inlineDiffDeletedCodeMargin.js';
import { LineSource, RenderOptions, renderLines } from './renderLines.js';
import { animatedObservable, joinCombine } from '../../utils.js';
import { LineRange } from '../../../../../common/core/ranges/lineRange.js';
import { Position } from '../../../../../common/core/position.js';
import { IClipboardService } from '../../../../../../platform/clipboard/common/clipboardService.js';
import { IContextMenuService } from '../../../../../../platform/contextview/browser/contextView.js';
import { Range } from '../../../../../common/core/range.js';
import { InlineDecoration } from '../../../../../common/viewModel/inlineDecorations.js';
/**
 * Ensures both editors have the same height by aligning unchanged lines.
 * In inline view mode, inserts viewzones to show deleted code from the original text model in the modified code editor.
 * Synchronizes scrolling.
 *
 * Make sure to add the view zones!
 */
let DiffEditorViewZones = class DiffEditorViewZones extends Disposable {
    constructor(_targetWindow, _editors, _diffModel, _options, _diffEditorWidget, _canIgnoreViewZoneUpdateEvent, _origViewZonesToIgnore, _modViewZonesToIgnore, _clipboardService, _contextMenuService) {
        super();
        this._targetWindow = _targetWindow;
        this._editors = _editors;
        this._diffModel = _diffModel;
        this._options = _options;
        this._diffEditorWidget = _diffEditorWidget;
        this._canIgnoreViewZoneUpdateEvent = _canIgnoreViewZoneUpdateEvent;
        this._origViewZonesToIgnore = _origViewZonesToIgnore;
        this._modViewZonesToIgnore = _modViewZonesToIgnore;
        this._clipboardService = _clipboardService;
        this._contextMenuService = _contextMenuService;
        this._originalTopPadding = observableValue(this, 0);
        this._originalScrollOffset = observableValue(this, 0);
        this._originalScrollOffsetAnimated = animatedObservable(this._targetWindow, this._originalScrollOffset, this._store);
        this._modifiedTopPadding = observableValue(this, 0);
        this._modifiedScrollOffset = observableValue(this, 0);
        this._modifiedScrollOffsetAnimated = animatedObservable(this._targetWindow, this._modifiedScrollOffset, this._store);
        const state = observableValue('invalidateAlignmentsState', 0);
        const updateImmediately = this._register(new RunOnceScheduler(() => {
            state.set(state.get() + 1, undefined);
        }, 0));
        this._register(this._editors.original.onDidChangeViewZones((_args) => { if (!this._canIgnoreViewZoneUpdateEvent()) {
            updateImmediately.schedule();
        } }));
        this._register(this._editors.modified.onDidChangeViewZones((_args) => { if (!this._canIgnoreViewZoneUpdateEvent()) {
            updateImmediately.schedule();
        } }));
        this._register(this._editors.original.onDidChangeConfiguration((args) => {
            if (args.hasChanged(166 /* EditorOption.wrappingInfo */) || args.hasChanged(75 /* EditorOption.lineHeight */)) {
                updateImmediately.schedule();
            }
        }));
        this._register(this._editors.modified.onDidChangeConfiguration((args) => {
            if (args.hasChanged(166 /* EditorOption.wrappingInfo */) || args.hasChanged(75 /* EditorOption.lineHeight */)) {
                updateImmediately.schedule();
            }
        }));
        const originalModelTokenizationCompleted = this._diffModel.map(m => m ? observableFromEvent(this, m.model.original.onDidChangeTokens, () => m.model.original.tokenization.backgroundTokenizationState === 2 /* BackgroundTokenizationState.Completed */) : undefined).map((m, reader) => m?.read(reader));
        const alignments = derived((reader) => {
            /** @description alignments */
            const diffModel = this._diffModel.read(reader);
            const diff = diffModel?.diff.read(reader);
            if (!diffModel || !diff) {
                return null;
            }
            state.read(reader);
            const renderSideBySide = this._options.renderSideBySide.read(reader);
            const innerHunkAlignment = renderSideBySide;
            return computeRangeAlignment(this._editors.original, this._editors.modified, diff.mappings, this._origViewZonesToIgnore, this._modViewZonesToIgnore, innerHunkAlignment);
        });
        const alignmentsSyncedMovedText = derived((reader) => {
            /** @description alignmentsSyncedMovedText */
            const syncedMovedText = this._diffModel.read(reader)?.movedTextToCompare.read(reader);
            if (!syncedMovedText) {
                return null;
            }
            state.read(reader);
            const mappings = syncedMovedText.changes.map(c => new DiffMapping(c));
            // TODO dont include alignments outside syncedMovedText
            return computeRangeAlignment(this._editors.original, this._editors.modified, mappings, this._origViewZonesToIgnore, this._modViewZonesToIgnore, true);
        });
        function createFakeLinesDiv() {
            const r = document.createElement('div');
            r.className = 'diagonal-fill';
            return r;
        }
        const alignmentViewZonesDisposables = this._register(new DisposableStore());
        this.viewZones = derived(this, (reader) => {
            alignmentViewZonesDisposables.clear();
            const alignmentsVal = alignments.read(reader) || [];
            const origViewZones = [];
            const modViewZones = [];
            const modifiedTopPaddingVal = this._modifiedTopPadding.read(reader);
            if (modifiedTopPaddingVal > 0) {
                modViewZones.push({
                    afterLineNumber: 0,
                    domNode: document.createElement('div'),
                    heightInPx: modifiedTopPaddingVal,
                    showInHiddenAreas: true,
                    suppressMouseDown: true,
                });
            }
            const originalTopPaddingVal = this._originalTopPadding.read(reader);
            if (originalTopPaddingVal > 0) {
                origViewZones.push({
                    afterLineNumber: 0,
                    domNode: document.createElement('div'),
                    heightInPx: originalTopPaddingVal,
                    showInHiddenAreas: true,
                    suppressMouseDown: true,
                });
            }
            const renderSideBySide = this._options.renderSideBySide.read(reader);
            const deletedCodeLineBreaksComputer = !renderSideBySide ? this._editors.modified._getViewModel()?.createLineBreaksComputer() : undefined;
            if (deletedCodeLineBreaksComputer) {
                const originalModel = this._editors.original.getModel();
                for (const a of alignmentsVal) {
                    if (a.diff) {
                        for (let i = a.originalRange.startLineNumber; i < a.originalRange.endLineNumberExclusive; i++) {
                            // `i` can be out of bound when the diff has not been updated yet.
                            // In this case, we do an early return.
                            // TODO@hediet: Fix this by applying the edit directly to the diff model, so that the diff is always valid.
                            if (i > originalModel.getLineCount()) {
                                return { orig: origViewZones, mod: modViewZones };
                            }
                            deletedCodeLineBreaksComputer?.addRequest(originalModel.getLineContent(i), null, null);
                        }
                    }
                }
            }
            const lineBreakData = deletedCodeLineBreaksComputer?.finalize() ?? [];
            let lineBreakDataIdx = 0;
            const modLineHeight = this._editors.modified.getOption(75 /* EditorOption.lineHeight */);
            const syncedMovedText = this._diffModel.read(reader)?.movedTextToCompare.read(reader);
            const mightContainNonBasicASCII = this._editors.original.getModel()?.mightContainNonBasicASCII() ?? false;
            const mightContainRTL = this._editors.original.getModel()?.mightContainRTL() ?? false;
            const renderOptions = RenderOptions.fromEditor(this._editors.modified);
            for (const a of alignmentsVal) {
                if (a.diff && !renderSideBySide && (!this._options.useTrueInlineDiffRendering.read(reader) || !allowsTrueInlineDiffRendering(a.diff))) {
                    if (!a.originalRange.isEmpty) {
                        originalModelTokenizationCompleted.read(reader); // Update view-zones once tokenization completes
                        const deletedCodeDomNode = document.createElement('div');
                        deletedCodeDomNode.classList.add('view-lines', 'line-delete', 'line-delete-selectable', 'monaco-mouse-cursor-text');
                        const originalModel = this._editors.original.getModel();
                        // `a.originalRange` can be out of bound when the diff has not been updated yet.
                        // In this case, we do an early return.
                        // TODO@hediet: Fix this by applying the edit directly to the diff model, so that the diff is always valid.
                        if (a.originalRange.endLineNumberExclusive - 1 > originalModel.getLineCount()) {
                            return { orig: origViewZones, mod: modViewZones };
                        }
                        const source = new LineSource(a.originalRange.mapToLineArray(l => originalModel.tokenization.getLineTokens(l)), a.originalRange.mapToLineArray(_ => lineBreakData[lineBreakDataIdx++]), mightContainNonBasicASCII, mightContainRTL);
                        const decorations = [];
                        for (const i of a.diff.innerChanges || []) {
                            decorations.push(new InlineDecoration(i.originalRange.delta(-(a.diff.original.startLineNumber - 1)), diffDeleteDecoration.className, 0 /* InlineDecorationType.Regular */));
                        }
                        const result = renderLines(source, renderOptions, decorations, deletedCodeDomNode);
                        const marginDomNode = document.createElement('div');
                        marginDomNode.className = 'inline-deleted-margin-view-zone';
                        applyFontInfo(marginDomNode, renderOptions.fontInfo);
                        if (this._options.renderIndicators.read(reader)) {
                            for (let i = 0; i < result.heightInLines; i++) {
                                const marginElement = document.createElement('div');
                                marginElement.className = `delete-sign ${ThemeIcon.asClassName(diffRemoveIcon)}`;
                                marginElement.setAttribute('style', `position:absolute;top:${i * modLineHeight}px;width:${renderOptions.lineDecorationsWidth}px;height:${modLineHeight}px;right:0;`);
                                marginDomNode.appendChild(marginElement);
                            }
                        }
                        let zoneId = undefined;
                        alignmentViewZonesDisposables.add(new InlineDiffDeletedCodeMargin(() => assertReturnsDefined(zoneId), marginDomNode, deletedCodeDomNode, this._editors.modified, a.diff, this._diffEditorWidget, result, this._editors.original.getModel(), this._contextMenuService, this._clipboardService));
                        for (let i = 0; i < result.viewLineCounts.length; i++) {
                            const count = result.viewLineCounts[i];
                            // Account for wrapped lines in the (collapsed) original editor (which doesn't wrap lines).
                            if (count > 1) {
                                origViewZones.push({
                                    afterLineNumber: a.originalRange.startLineNumber + i,
                                    domNode: createFakeLinesDiv(),
                                    heightInPx: (count - 1) * modLineHeight,
                                    showInHiddenAreas: true,
                                    suppressMouseDown: true,
                                });
                            }
                        }
                        modViewZones.push({
                            afterLineNumber: a.modifiedRange.startLineNumber - 1,
                            domNode: deletedCodeDomNode,
                            heightInPx: result.heightInLines * modLineHeight,
                            minWidthInPx: result.minWidthInPx,
                            marginDomNode,
                            setZoneId(id) { zoneId = id; },
                            showInHiddenAreas: true,
                            suppressMouseDown: false,
                        });
                    }
                    const marginDomNode = document.createElement('div');
                    marginDomNode.className = 'gutter-delete';
                    origViewZones.push({
                        afterLineNumber: a.originalRange.endLineNumberExclusive - 1,
                        domNode: createFakeLinesDiv(),
                        heightInPx: a.modifiedHeightInPx,
                        marginDomNode,
                        showInHiddenAreas: true,
                        suppressMouseDown: true,
                    });
                }
                else {
                    const delta = a.modifiedHeightInPx - a.originalHeightInPx;
                    if (delta > 0) {
                        if (syncedMovedText?.lineRangeMapping.original.delta(-1).deltaLength(2).contains(a.originalRange.endLineNumberExclusive - 1)) {
                            continue;
                        }
                        origViewZones.push({
                            afterLineNumber: a.originalRange.endLineNumberExclusive - 1,
                            domNode: createFakeLinesDiv(),
                            heightInPx: delta,
                            showInHiddenAreas: true,
                            suppressMouseDown: true,
                        });
                    }
                    else {
                        if (syncedMovedText?.lineRangeMapping.modified.delta(-1).deltaLength(2).contains(a.modifiedRange.endLineNumberExclusive - 1)) {
                            continue;
                        }
                        function createViewZoneMarginArrow() {
                            const arrow = document.createElement('div');
                            arrow.className = 'arrow-revert-change ' + ThemeIcon.asClassName(Codicon.arrowRight);
                            reader.store.add(addDisposableListener(arrow, 'mousedown', e => e.stopPropagation()));
                            reader.store.add(addDisposableListener(arrow, 'click', e => {
                                e.stopPropagation();
                                _diffEditorWidget.revert(a.diff);
                            }));
                            return $('div', {}, arrow);
                        }
                        let marginDomNode = undefined;
                        if (a.diff && a.diff.modified.isEmpty && this._options.shouldRenderOldRevertArrows.read(reader)) {
                            marginDomNode = createViewZoneMarginArrow();
                        }
                        modViewZones.push({
                            afterLineNumber: a.modifiedRange.endLineNumberExclusive - 1,
                            domNode: createFakeLinesDiv(),
                            heightInPx: -delta,
                            marginDomNode,
                            showInHiddenAreas: true,
                            suppressMouseDown: true,
                        });
                    }
                }
            }
            for (const a of alignmentsSyncedMovedText.read(reader) ?? []) {
                if (!syncedMovedText?.lineRangeMapping.original.intersect(a.originalRange)
                    || !syncedMovedText?.lineRangeMapping.modified.intersect(a.modifiedRange)) {
                    // ignore unrelated alignments outside the synced moved text
                    continue;
                }
                const delta = a.modifiedHeightInPx - a.originalHeightInPx;
                if (delta > 0) {
                    origViewZones.push({
                        afterLineNumber: a.originalRange.endLineNumberExclusive - 1,
                        domNode: createFakeLinesDiv(),
                        heightInPx: delta,
                        showInHiddenAreas: true,
                        suppressMouseDown: true,
                    });
                }
                else {
                    modViewZones.push({
                        afterLineNumber: a.modifiedRange.endLineNumberExclusive - 1,
                        domNode: createFakeLinesDiv(),
                        heightInPx: -delta,
                        showInHiddenAreas: true,
                        suppressMouseDown: true,
                    });
                }
            }
            return { orig: origViewZones, mod: modViewZones };
        });
        let ignoreChange = false;
        this._register(this._editors.original.onDidScrollChange(e => {
            if (e.scrollLeftChanged && !ignoreChange) {
                ignoreChange = true;
                this._editors.modified.setScrollLeft(e.scrollLeft);
                ignoreChange = false;
            }
        }));
        this._register(this._editors.modified.onDidScrollChange(e => {
            if (e.scrollLeftChanged && !ignoreChange) {
                ignoreChange = true;
                this._editors.original.setScrollLeft(e.scrollLeft);
                ignoreChange = false;
            }
        }));
        this._originalScrollTop = observableFromEvent(this._editors.original.onDidScrollChange, () => /** @description original.getScrollTop */ this._editors.original.getScrollTop());
        this._modifiedScrollTop = observableFromEvent(this._editors.modified.onDidScrollChange, () => /** @description modified.getScrollTop */ this._editors.modified.getScrollTop());
        // origExtraHeight + origOffset - origScrollTop = modExtraHeight + modOffset - modScrollTop
        // origScrollTop = origExtraHeight + origOffset - modExtraHeight - modOffset + modScrollTop
        // modScrollTop = modExtraHeight + modOffset - origExtraHeight - origOffset + origScrollTop
        // origOffset - modOffset = heightOfLines(1..Y) - heightOfLines(1..X)
        // origScrollTop >= 0, modScrollTop >= 0
        this._register(autorun(reader => {
            /** @description update scroll modified */
            const newScrollTopModified = this._originalScrollTop.read(reader)
                - (this._originalScrollOffsetAnimated.read(undefined) - this._modifiedScrollOffsetAnimated.read(reader))
                - (this._originalTopPadding.read(undefined) - this._modifiedTopPadding.read(reader));
            if (newScrollTopModified !== this._editors.modified.getScrollTop()) {
                this._editors.modified.setScrollTop(newScrollTopModified, 1 /* ScrollType.Immediate */);
            }
        }));
        this._register(autorun(reader => {
            /** @description update scroll original */
            const newScrollTopOriginal = this._modifiedScrollTop.read(reader)
                - (this._modifiedScrollOffsetAnimated.read(undefined) - this._originalScrollOffsetAnimated.read(reader))
                - (this._modifiedTopPadding.read(undefined) - this._originalTopPadding.read(reader));
            if (newScrollTopOriginal !== this._editors.original.getScrollTop()) {
                this._editors.original.setScrollTop(newScrollTopOriginal, 1 /* ScrollType.Immediate */);
            }
        }));
        this._register(autorun(reader => {
            /** @description update editor top offsets */
            const m = this._diffModel.read(reader)?.movedTextToCompare.read(reader);
            let deltaOrigToMod = 0;
            if (m) {
                const trueTopOriginal = this._editors.original.getTopForLineNumber(m.lineRangeMapping.original.startLineNumber, true) - this._originalTopPadding.read(undefined);
                const trueTopModified = this._editors.modified.getTopForLineNumber(m.lineRangeMapping.modified.startLineNumber, true) - this._modifiedTopPadding.read(undefined);
                deltaOrigToMod = trueTopModified - trueTopOriginal;
            }
            if (deltaOrigToMod > 0) {
                this._modifiedTopPadding.set(0, undefined);
                this._originalTopPadding.set(deltaOrigToMod, undefined);
            }
            else if (deltaOrigToMod < 0) {
                this._modifiedTopPadding.set(-deltaOrigToMod, undefined);
                this._originalTopPadding.set(0, undefined);
            }
            else {
                setTimeout(() => {
                    this._modifiedTopPadding.set(0, undefined);
                    this._originalTopPadding.set(0, undefined);
                }, 400);
            }
            if (this._editors.modified.hasTextFocus()) {
                this._originalScrollOffset.set(this._modifiedScrollOffset.read(undefined) - deltaOrigToMod, undefined, true);
            }
            else {
                this._modifiedScrollOffset.set(this._originalScrollOffset.read(undefined) + deltaOrigToMod, undefined, true);
            }
        }));
    }
};
DiffEditorViewZones = __decorate([
    __param(8, IClipboardService),
    __param(9, IContextMenuService)
], DiffEditorViewZones);
export { DiffEditorViewZones };
function computeRangeAlignment(originalEditor, modifiedEditor, diffs, originalEditorAlignmentViewZones, modifiedEditorAlignmentViewZones, innerHunkAlignment) {
    const originalLineHeightOverrides = new ArrayQueue(getAdditionalLineHeights(originalEditor, originalEditorAlignmentViewZones));
    const modifiedLineHeightOverrides = new ArrayQueue(getAdditionalLineHeights(modifiedEditor, modifiedEditorAlignmentViewZones));
    const origLineHeight = originalEditor.getOption(75 /* EditorOption.lineHeight */);
    const modLineHeight = modifiedEditor.getOption(75 /* EditorOption.lineHeight */);
    const result = [];
    let lastOriginalLineNumber = 0;
    let lastModifiedLineNumber = 0;
    function handleAlignmentsOutsideOfDiffs(untilOriginalLineNumberExclusive, untilModifiedLineNumberExclusive) {
        while (true) {
            let origNext = originalLineHeightOverrides.peek();
            let modNext = modifiedLineHeightOverrides.peek();
            if (origNext && origNext.lineNumber >= untilOriginalLineNumberExclusive) {
                origNext = undefined;
            }
            if (modNext && modNext.lineNumber >= untilModifiedLineNumberExclusive) {
                modNext = undefined;
            }
            if (!origNext && !modNext) {
                break;
            }
            const distOrig = origNext ? origNext.lineNumber - lastOriginalLineNumber : Number.MAX_VALUE;
            const distNext = modNext ? modNext.lineNumber - lastModifiedLineNumber : Number.MAX_VALUE;
            if (distOrig < distNext) {
                originalLineHeightOverrides.dequeue();
                modNext = {
                    lineNumber: origNext.lineNumber - lastOriginalLineNumber + lastModifiedLineNumber,
                    heightInPx: 0,
                };
            }
            else if (distOrig > distNext) {
                modifiedLineHeightOverrides.dequeue();
                origNext = {
                    lineNumber: modNext.lineNumber - lastModifiedLineNumber + lastOriginalLineNumber,
                    heightInPx: 0,
                };
            }
            else {
                originalLineHeightOverrides.dequeue();
                modifiedLineHeightOverrides.dequeue();
            }
            result.push({
                originalRange: LineRange.ofLength(origNext.lineNumber, 1),
                modifiedRange: LineRange.ofLength(modNext.lineNumber, 1),
                originalHeightInPx: origLineHeight + origNext.heightInPx,
                modifiedHeightInPx: modLineHeight + modNext.heightInPx,
                diff: undefined,
            });
        }
    }
    for (const m of diffs) {
        const c = m.lineRangeMapping;
        handleAlignmentsOutsideOfDiffs(c.original.startLineNumber, c.modified.startLineNumber);
        let first = true;
        let lastModLineNumber = c.modified.startLineNumber;
        let lastOrigLineNumber = c.original.startLineNumber;
        function emitAlignment(origLineNumberExclusive, modLineNumberExclusive, forceAlignment = false) {
            if (origLineNumberExclusive < lastOrigLineNumber || modLineNumberExclusive < lastModLineNumber) {
                return;
            }
            if (first) {
                first = false;
            }
            else if (!forceAlignment && (origLineNumberExclusive === lastOrigLineNumber || modLineNumberExclusive === lastModLineNumber)) {
                // This causes a re-alignment of an already aligned line.
                // However, we don't care for the final alignment.
                return;
            }
            const originalRange = new LineRange(lastOrigLineNumber, origLineNumberExclusive);
            const modifiedRange = new LineRange(lastModLineNumber, modLineNumberExclusive);
            if (originalRange.isEmpty && modifiedRange.isEmpty) {
                return;
            }
            const originalAdditionalHeight = originalLineHeightOverrides
                .takeWhile(v => v.lineNumber < origLineNumberExclusive)
                ?.reduce((p, c) => p + c.heightInPx, 0) ?? 0;
            const modifiedAdditionalHeight = modifiedLineHeightOverrides
                .takeWhile(v => v.lineNumber < modLineNumberExclusive)
                ?.reduce((p, c) => p + c.heightInPx, 0) ?? 0;
            result.push({
                originalRange,
                modifiedRange,
                originalHeightInPx: originalRange.length * origLineHeight + originalAdditionalHeight,
                modifiedHeightInPx: modifiedRange.length * modLineHeight + modifiedAdditionalHeight,
                diff: m.lineRangeMapping,
            });
            lastOrigLineNumber = origLineNumberExclusive;
            lastModLineNumber = modLineNumberExclusive;
        }
        if (innerHunkAlignment) {
            for (const i of c.innerChanges || []) {
                if (i.originalRange.startColumn > 1 && i.modifiedRange.startColumn > 1) {
                    // There is some unmodified text on this line before the diff
                    emitAlignment(i.originalRange.startLineNumber, i.modifiedRange.startLineNumber);
                }
                const originalModel = originalEditor.getModel();
                // When the diff is invalid, the ranges might be out of bounds (this should be fixed in the diff model by applying edits directly).
                const maxColumn = i.originalRange.endLineNumber <= originalModel.getLineCount() ? originalModel.getLineMaxColumn(i.originalRange.endLineNumber) : Number.MAX_SAFE_INTEGER;
                if (i.originalRange.endColumn < maxColumn) {
                    // // There is some unmodified text on this line after the diff
                    emitAlignment(i.originalRange.endLineNumber, i.modifiedRange.endLineNumber);
                }
            }
        }
        emitAlignment(c.original.endLineNumberExclusive, c.modified.endLineNumberExclusive, true);
        lastOriginalLineNumber = c.original.endLineNumberExclusive;
        lastModifiedLineNumber = c.modified.endLineNumberExclusive;
    }
    handleAlignmentsOutsideOfDiffs(Number.MAX_VALUE, Number.MAX_VALUE);
    return result;
}
function getAdditionalLineHeights(editor, viewZonesToIgnore) {
    const viewZoneHeights = [];
    const wrappingZoneHeights = [];
    const hasWrapping = editor.getOption(166 /* EditorOption.wrappingInfo */).wrappingColumn !== -1;
    const coordinatesConverter = editor._getViewModel().coordinatesConverter;
    const editorLineHeight = editor.getOption(75 /* EditorOption.lineHeight */);
    if (hasWrapping) {
        for (let i = 1; i <= editor.getModel().getLineCount(); i++) {
            const lineCount = coordinatesConverter.getModelLineViewLineCount(i);
            if (lineCount > 1) {
                wrappingZoneHeights.push({ lineNumber: i, heightInPx: editorLineHeight * (lineCount - 1) });
            }
        }
    }
    for (const w of editor.getWhitespaces()) {
        if (viewZonesToIgnore.has(w.id)) {
            continue;
        }
        const modelLineNumber = w.afterLineNumber === 0 ? 0 : coordinatesConverter.convertViewPositionToModelPosition(new Position(w.afterLineNumber, 1)).lineNumber;
        viewZoneHeights.push({ lineNumber: modelLineNumber, heightInPx: w.height });
    }
    const result = joinCombine(viewZoneHeights, wrappingZoneHeights, v => v.lineNumber, (v1, v2) => ({ lineNumber: v1.lineNumber, heightInPx: v1.heightInPx + v2.heightInPx }));
    return result;
}
export function allowsTrueInlineDiffRendering(mapping) {
    if (!mapping.innerChanges) {
        return false;
    }
    return mapping.innerChanges.every(c => (rangeIsSingleLine(c.modifiedRange) && rangeIsSingleLine(c.originalRange))
        || c.originalRange.equalsRange(new Range(1, 1, 1, 1)));
}
export function rangeIsSingleLine(range) {
    return range.startLineNumber === range.endLineNumber;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlmZkVkaXRvclZpZXdab25lcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9jb21wb25lbnRzL2RpZmZFZGl0b3JWaWV3Wm9uZXMvZGlmZkVkaXRvclZpZXdab25lcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsQ0FBQyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDakYsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3pGLE9BQU8sRUFBZSxPQUFPLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLGVBQWUsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ2xJLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUM5RSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFbEUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLGNBQWMsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRTNGLE9BQU8sRUFBdUIsV0FBVyxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFFaEYsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDL0UsT0FBTyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsV0FBVyxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDMUUs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