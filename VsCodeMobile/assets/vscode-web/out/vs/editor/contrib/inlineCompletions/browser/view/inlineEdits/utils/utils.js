/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { getDomNodePagePosition, h } from '../../../../../../../base/browser/dom.js';
import { KeybindingLabel, unthemedKeybindingLabelOptions } from '../../../../../../../base/browser/ui/keybindingLabel/keybindingLabel.js';
import { numberComparator } from '../../../../../../../base/common/arrays.js';
import { findFirstMin } from '../../../../../../../base/common/arraysFind.js';
import { toDisposable } from '../../../../../../../base/common/lifecycle.js';
import { DebugLocation, derived, derivedObservableWithCache, derivedOpts, observableSignalFromEvent, observableValue, transaction } from '../../../../../../../base/common/observable.js';
import { OS } from '../../../../../../../base/common/platform.js';
import { splitLines } from '../../../../../../../base/common/strings.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { MenuEntryActionViewItem } from '../../../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { observableCodeEditor } from '../../../../../../browser/observableCodeEditor.js';
import { Rect } from '../../../../../../common/core/2d/rect.js';
import { OffsetRange } from '../../../../../../common/core/ranges/offsetRange.js';
import { Position } from '../../../../../../common/core/position.js';
import { Range } from '../../../../../../common/core/range.js';
import { TextReplacement, TextEdit } from '../../../../../../common/core/edits/textEdit.js';
import { RangeMapping } from '../../../../../../common/diff/rangeMapping.js';
import { indentOfLine } from '../../../../../../common/model/textModel.js';
import { BugIndicatingError } from '../../../../../../../base/common/errors.js';
import { Size2D } from '../../../../../../common/core/2d/size.js';
export function maxContentWidthInRange(editor, range, reader) {
    editor.layoutInfo.read(reader);
    editor.value.read(reader);
    const model = editor.model.read(reader);
    if (!model) {
        return 0;
    }
    let maxContentWidth = 0;
    editor.scrollTop.read(reader);
    for (let i = range.startLineNumber; i < range.endLineNumberExclusive; i++) {
        const column = model.getLineMaxColumn(i);
        const lineContentWidth = editor.getLeftOfPosition(new Position(i, column), reader);
        maxContentWidth = Math.max(maxContentWidth, lineContentWidth);
    }
    const lines = range.mapToLineArray(l => model.getLineContent(l));
    if (maxContentWidth < 5 && lines.some(l => l.length > 0) && model.uri.scheme !== 'file') {
        console.error('unexpected width');
    }
    return maxContentWidth;
}
export function getContentSizeOfLines(editor, range, reader) {
    editor.layoutInfo.read(reader);
    editor.value.read(reader);
    observableSignalFromEvent(editor, editor.editor.onDidChangeLineHeight).read(reader);
    const model = editor.model.read(reader);
    if (!model) {
        throw new BugIndicatingError('Model is required');
    }
    const sizes = [];
    editor.scrollTop.read(reader);
    for (let i = range.startLineNumber; i < range.endLineNumberExclusive; i++) {
        const column = model.getLineMaxColumn(i);
        let lineContentWidth = editor.editor.getOffsetForColumn(i, column);
        if (lineContentWidth === -1) {
            // approximation
            const typicalHalfwidthCharacterWidth = editor.editor.getOption(59 /* EditorOption.fontInfo */).typicalHalfwidthCharacterWidth;
            const approximation = column * typicalHalfwidthCharacterWidth;
            lineContentWidth = approximation;
        }
        const height = editor.editor.getLineHeightForPosition(new Position(i, 1));
        sizes.push(new Size2D(lineContentWidth, height));
    }
    return sizes;
}
export function getOffsetForPos(editor, pos, reader) {
    editor.layoutInfo.read(reader);
    editor.value.read(reader);
    const model = editor.model.read(reader);
    if (!model) {
        return 0;
    }
    editor.scrollTop.read(reader);
    const lineContentWidth = editor.editor.getOffsetForColumn(pos.lineNumber, pos.column);
    return lineContentWidth;
}
export function getPrefixTrim(diffRanges, originalLinesRange, modifiedLines, editor, reader = undefined) {
    const textModel = editor.getModel();
    if (!textModel) {
        return { prefixTrim: 0, prefixLeftOffset: 0 };
    }
    const replacementStart = diffRanges.map(r => r.isSingleLine() ? r.startColumn - 1 : 0);
    const originalIndents = originalLinesRange.mapToLineArray(line => indentOfLine(textModel.getLineContent(line)));
    const modifiedIndents = modifiedLines.filter(line => line !== '').map(line => indentOfLine(line));
    const prefixTrim = Math.min(...replacementStart, ...originalIndents, ...modifiedIndents);
    let prefixLeftOffset;
    const startLineIndent = textModel.getLineIndentColumn(originalLinesRange.startLineNumber);
    if (startLineIndent >= prefixTrim + 1) {
        // We can use the editor to get the offset
        // TODO go through other usages of getOffsetForColumn and come up with a robust reactive solution to read it
        observableCodeEditor(editor).scrollTop.read(reader); // getOffsetForColumn requires the line number to be visible. This might change on scroll top.
        prefixLeftOffset = editor.getOffsetForColumn(originalLinesRange.startLineNumber, prefixTrim + 1);
    }
    else if (modifiedLines.length > 0) {
        // Content is not in the editor, we can use the content width to calculate the offset
        prefixLeftOffset = getContentRenderWidth(modifiedLines[0].slice(0, prefixTrim), editor, textModel);
    }
    else {
        // unable to approximate the offset
        return { prefixTrim: 0, prefixLeftOffset: 0 };
    }
    return { prefixTrim, prefixLeftOffset };
}
export function getContentRenderWidth(content, editor, textModel) {
    const w = editor.getOption(59 /* EditorOption.fontInfo */).typicalHalfwidthCharacterWidth;
    const tabSize = textModel.getOptions().tabSize * w;
    const numTabs = content.split('\t').length - 1;
    const numNoneTabs = content.length - numTabs;
    return numNoneTabs * w + numTabs * tabSize;
}
export function getEditorValidOverlayRect(editor) {
    const contentLeft = editor.layoutInfoContentLeft;
    const width = derived({ name: 'editor.validOverlay.width' }, r => {
        const hasMinimapOnTheRight = editor.layoutInfoMinimap.read(r).minimapLeft !== 0;
        const editorWidth = editor.layoutInfoWidth.read(r) - contentLeft.read(r);
        if (hasMinimapOnTheRight) {
            const minimapAndScrollbarWidth = editor.layoutInfoMinimap.read(r).minimapWidth + editor.layoutInfoVerticalScrollbarWidth.read(r);
            return editorWidth - minimapAndScrollbarWidth;
        }
        return editorWidth;
    });
    const height = derived({ name: 'editor.validOverlay.height' }, r => editor.layoutInfoHeight.read(r) + editor.contentHeight.read(r));
    return derived({ name: 'editor.validOverlay' }, r => Rect.fromLeftTopWidthHeight(contentLeft.read(r), 0, width.read(r), height.read(r)));
}
export class StatusBarViewItem extends MenuEntryActionViewItem {
    constructor() {
        super(...arguments);
        this._updateLabelListener = this._register(this._contextKeyService.onDidChangeContext(() => {
            this.updateLabel();
        }));
    }
    updateLabel() {
        const kb = this._keybindingService.lookupKeybinding(this._action.id, this._contextKeyService, true);
        if (!kb) {
            return super.updateLabel();
        }
        if (this.label) {
            const div = h('div.keybinding').root;
            const keybindingLabel = this._register(new KeybindingLabel(div, OS, { disableTitle: true, ...unthemedKeybindingLabelOptions }));
            keybindingLabel.set(kb);
            this.label.textContent = this._action.label;
            this.label.appendChild(div);
            this.label.classList.add('inlineSuggestionStatusBarItemLabel');
        }
    }
    updateTooltip() {
        // NOOP, disable tooltip
    }
}
export class UniqueUriGenerator {
    static { this._modelId = 0; }
    constructor(scheme) {
        this.scheme = scheme;
    }
    getUniqueUri() {
        return URI.from({ scheme: this.scheme, path: new Date().toString() + String(UniqueUriGenerator._modelId++) });
    }
}
export function applyEditToModifiedRangeMappings(rangeMapping, edit) {
    const updatedMappings = [];
    for (const m of rangeMapping) {
        const updatedRange = edit.mapRange(m.modifiedRange);
        updatedMappings.push(new RangeMapping(m.originalRange, updatedRange));
    }
    return updatedMappings;
}
export function classNames(...classes) {
    return classes.filter(c => typeof c === 'string').join(' ');
}
function offsetRangeToRange(columnOffsetRange, startPos) {
    return new Range(startPos.lineNumber, startPos.column + columnOffsetRange.start, startPos.lineNumber, startPos.column + columnOffsetRange.endExclusive);
}
/**
 * Calculates the indentation size (in spaces) of a given line,
 * interpreting tabs as the specified tab size.
 */
function getIndentationSize(line, tabSize) {
    let currentSize = 0;
    loop: for (let i = 0, len = line.length; i < len; i++) {
        switch (line.charCodeAt(i)) {
            case 9 /* CharCode.Tab */:
                currentSize += tabSize;
                break;
            case 32 /* CharCode.Space */:
                currentSize++;
                break;
            default: break loop;
        }
    }
    // if currentSize % tabSize !== 0,
    // then there are spaces which are not part of the indentation
    return currentSize - (currentSize % tabSize);
}
/**
 * Calculates the number of characters at the start of a line that correspond to a given indentation size,
 * taking into account both tabs and spaces.
 */
function indentSizeToIndentLength(line, indentSize, tabSize) {
    let remainingSize = indentSize - (indentSize % tabSize);
    let i = 0;
    for (; i < line.length; i++) {
        if (remainingSize === 0) {
            break;
        }
        switch (line.charCodeAt(i)) {
            case 9 /* CharCode.Tab */:
                remainingSize -= tabSize;
                break;
            case 32 /* CharCode.Space */:
                remainingSize--;
                break;
            default: throw new BugIndicatingError('Unexpected character found while calculating indent length');
        }
    }
    return i;
}
export function createReindentEdit(text, range, tabSize) {
    const newLines = splitLines(text);
    const edits = [];
    const minIndentSize = findFirstMin(range.mapToLineArray(l => getIndentationSize(newLines[l - 1], tabSize)), numberComparator);
    range.forEach(lineNumber => {
        const indentLength = indentSizeToIndentLength(newLines[lineNumber - 1], minIndentSize, tabSize);
        edits.push(new TextReplacement(offsetRangeToRange(new OffsetRange(0, indentLength), new Position(lineNumber, 1)), ''));
    });
    return new TextEdit(edits);
}
export class PathBuilder {
    constructor() {
        this._data = '';
    }
    moveTo(point) {
        this._data += `M ${point.x} ${point.y} `;
        return this;
    }
    lineTo(point) {
        this._data += `L ${point.x} ${point.y} `;
        return this;
    }
    curveTo(cp, to) {
        this._data += `Q ${cp.x} ${cp.y} ${to.x} ${to.y} `;
        return this;
    }
    curveTo2(cp1, cp2, to) {
        this._data += `C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${to.x} ${to.y} `;
        return this;
    }
    build() {
        return this._data;
    }
}
// Arguments are a bit messy currently, could be improved
export function createRectangle(layout, padding, borderRadius, options = {}) {
    const topLeftInner = layout.topLeft;
    const topRightInner = topLeftInner.deltaX(layout.width);
    const bottomLeftInner = topLeftInner.deltaY(layout.height);
    const bottomRightInner = bottomLeftInner.deltaX(layout.width);
    // padding
    const { top: paddingTop, bottom: paddingBottom, left: paddingLeft, right: paddingRight } = typeof padding === 'number' ?
        { top: padding, bottom: padding, left: padding, right: padding }
        : padding;
    // corner radius
    const { topLeft: radiusTL, topRight: radiusTR, bottomLeft: radiusBL, bottomRight: radiusBR } = typeof borderRadius === 'number' ?
        { topLeft: borderRadius, topRight: borderRadius, bottomLeft: borderRadius, bottomRight: borderRadius } :
        borderRadius;
    const totalHeight = layout.height + paddingTop + paddingBottom;
    const totalWidth = layout.width + paddingLeft + paddingRight;
    // The path is drawn from bottom left at the end of the rounded corner in a clockwise direction
    // Before: before the rounded corner
    // After: after the rounded corner
    const topLeft = topLeftInner.deltaX(-paddingLeft).deltaY(-paddingTop);
    const topRight = topRightInner.deltaX(paddingRight).deltaY(-paddingTop);
    const topLeftBefore = topLeft.deltaY(Math.min(radiusTL, totalHeight / 2));
    const topLeftAfter = topLeft.deltaX(Math.min(radiusTL, totalWidth / 2));
    const topRightBefore = topRight.deltaX(-Math.min(radiusTR, totalWidth / 2));
    const topRightAfter = topRight.deltaY(Math.min(radiusTR, totalHeight / 2));
    const bottomLeft = bottomLeftInner.deltaX(-paddingLeft).deltaY(paddingBottom);
    const bottomRight = bottomRightInner.deltaX(paddingRight).deltaY(paddingBottom);
    const bottomLeftBefore = bottomLeft.deltaX(Math.min(radiusBL, totalWidth / 2));
    const bottomLeftAfter = bottomLeft.deltaY(-Math.min(radiusBL, totalHeight / 2));
    const bottomRightBefore = bottomRight.deltaY(-Math.min(radiusBR, totalHeight / 2));
    const bottomRightAfter = bottomRight.deltaX(-Math.min(radiusBR, totalWidth / 2));
    const path = new PathBuilder();
    if (!options.hideLeft) {
        path.moveTo(bottomLeftAfter).lineTo(topLeftBefore);
    }
    if (!options.hideLeft && !options.hideTop) {
        path.curveTo(topLeft, topLeftAfter);
    }
    else {
        path.moveTo(topLeftAfter);
    }
    if (!options.hideTop) {
        path.lineTo(topRightBefore);
    }
    if (!options.hideTop && !options.hideRight) {
        path.curveTo(topRight, topRightAfter);
    }
    else {
        path.moveTo(topRightAfter);
    }
    if (!options.hideRight) {
        path.lineTo(bottomRightBefore);
    }
    if (!options.hideRight && !options.hideBottom) {
        path.curveTo(bottomRight, bottomRightAfter);
    }
    else {
        path.moveTo(bottomRightAfter);
    }
    if (!options.hideBottom) {
        path.lineTo(bottomLeftBefore);
    }
    if (!options.hideBottom && !options.hideLeft) {
        path.curveTo(bottomLeft, bottomLeftAfter);
    }
    else {
        path.moveTo(bottomLeftAfter);
    }
    return path.build();
}
export function mapOutFalsy(obs) {
    const nonUndefinedObs = derivedObservableWithCache(undefined, (reader, lastValue) => obs.read(reader) || lastValue);
    return derivedOpts({
        debugName: () => `${obs.debugName}.mapOutFalsy`
    }, reader => {
        nonUndefinedObs.read(reader);
        const val = obs.read(reader);
        if (!val) {
            return undefined;
        }
        return nonUndefinedObs;
    });
}
export function observeElementPosition(element, store) {
    const topLeft = getDomNodePagePosition(element);
    const top = observableValue('top', topLeft.top);
    const left = observableValue('left', topLeft.left);
    const resizeObserver = new ResizeObserver(() => {
        transaction(tx => {
            const topLeft = getDomNodePagePosition(element);
            top.set(topLeft.top, tx);
            left.set(topLeft.left, tx);
        });
    });
    resizeObserver.observe(element);
    store.add(toDisposable(() => resizeObserver.disconnect()));
    return {
        top,
        left
    };
}
export function rectToProps(fn, debugLocation = DebugLocation.ofCaller()) {
    return {
        left: derived({ name: 'editor.validOverlay.left' }, reader => /** @description left */ fn(reader)?.left, debugLocation),
        top: derived({ name: 'editor.validOverlay.top' }, reader => /** @description top */ fn(reader)?.top, debugLocation),
        width: derived({ name: 'editor.validOverlay.width' }, reader => {
            /** @description width */
            const val = fn(reader);
            if (!val) {
                return undefined;
            }
            return val.width;
        }, debugLocation),
        height: derived({ name: 'editor.validOverlay.height' }, reader => {
            /** @description height */
            const val = fn(reader);
            if (!val) {
                return undefined;
            }
            return val.height;
        }, debugLocation),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvYnJvd3Nlci92aWV3L2lubGluZUVkaXRzL3V0aWxzL3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxDQUFDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNyRixPQUFPLEVBQUUsZUFBZSxFQUFFLDhCQUE4QixFQUFFLE1BQU0seUVBQXlFLENBQUM7QUFDMUksT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDOUUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQzlFLE9BQU8sRUFBbUIsWUFBWSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDOUYsT0FBTyxFQUFFLGFBQWEsRUFBRSxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsV0FBVyxFQUF3Qix5QkFBeUIsRUFBRSxlQUFlLEVBQUUsV0FBVyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaE4sT0FBTyxFQUFFLEVBQUUsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDOUQsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sMEVBQTBFLENBQUM7QUFFbkgsT0FBTyxFQUFFLG9CQUFvQixFQUF3QixNQUFNLG1EQUFtRCxDQUFDO0FBRS9HLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUdoRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDbEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDJDQUEyQyxD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