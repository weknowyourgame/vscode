/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as arrays from '../../../base/common/arrays.js';
import { Position } from '../core/position.js';
import { Range } from '../core/range.js';
import { IndentGuide, IndentGuideHorizontalLine } from '../textModelGuides.js';
import { ModelDecorationOptions } from '../model/textModel.js';
import { LineInjectedText } from '../textModelEvents.js';
import * as viewEvents from '../viewEvents.js';
import { createModelLineProjection } from './modelLineProjection.js';
import { ConstantTimePrefixSumComputer } from '../model/prefixSumComputer.js';
import { ViewLineData } from '../viewModel.js';
import { IdentityCoordinatesConverter } from '../coordinatesConverter.js';
export class ViewModelLinesFromProjectedModel {
    constructor(editorId, model, domLineBreaksComputerFactory, monospaceLineBreaksComputerFactory, fontInfo, tabSize, wrappingStrategy, wrappingColumn, wrappingIndent, wordBreak, wrapOnEscapedLineFeeds) {
        this._editorId = editorId;
        this.model = model;
        this._validModelVersionId = -1;
        this._domLineBreaksComputerFactory = domLineBreaksComputerFactory;
        this._monospaceLineBreaksComputerFactory = monospaceLineBreaksComputerFactory;
        this.fontInfo = fontInfo;
        this.tabSize = tabSize;
        this.wrappingStrategy = wrappingStrategy;
        this.wrappingColumn = wrappingColumn;
        this.wrappingIndent = wrappingIndent;
        this.wordBreak = wordBreak;
        this.wrapOnEscapedLineFeeds = wrapOnEscapedLineFeeds;
        this._constructLines(/*resetHiddenAreas*/ true, null);
    }
    dispose() {
        this.hiddenAreasDecorationIds = this.model.deltaDecorations(this.hiddenAreasDecorationIds, []);
    }
    createCoordinatesConverter() {
        return new CoordinatesConverter(this);
    }
    _constructLines(resetHiddenAreas, previousLineBreaks) {
        this.modelLineProjections = [];
        if (resetHiddenAreas) {
            this.hiddenAreasDecorationIds = this.model.deltaDecorations(this.hiddenAreasDecorationIds, []);
        }
        const linesContent = this.model.getLinesContent();
        const injectedTextDecorations = this.model.getInjectedTextDecorations(this._editorId);
        const lineCount = linesContent.length;
        const lineBreaksComputer = this.createLineBreaksComputer();
        const injectedTextQueue = new arrays.ArrayQueue(LineInjectedText.fromDecorations(injectedTextDecorations));
        for (let i = 0; i < lineCount; i++) {
            const lineInjectedText = injectedTextQueue.takeWhile(t => t.lineNumber === i + 1);
            lineBreaksComputer.addRequest(linesContent[i], lineInjectedText, previousLineBreaks ? previousLineBreaks[i] : null);
        }
        const linesBreaks = lineBreaksComputer.finalize();
        const values = [];
        const hiddenAreas = this.hiddenAreasDecorationIds.map((areaId) => this.model.getDecorationRange(areaId)).sort(Range.compareRangesUsingStarts);
        let hiddenAreaStart = 1, hiddenAreaEnd = 0;
        let hiddenAreaIdx = -1;
        let nextLineNumberToUpdateHiddenArea = (hiddenAreaIdx + 1 < hiddenAreas.length) ? hiddenAreaEnd + 1 : lineCount + 2;
        for (let i = 0; i < lineCount; i++) {
            const lineNumber = i + 1;
            if (lineNumber === nextLineNumberToUpdateHiddenArea) {
                hiddenAreaIdx++;
                hiddenAreaStart = hiddenAreas[hiddenAreaIdx].startLineNumber;
                hiddenAreaEnd = hiddenAreas[hiddenAreaIdx].endLineNumber;
                nextLineNumberToUpdateHiddenArea = (hiddenAreaIdx + 1 < hiddenAreas.length) ? hiddenAreaEnd + 1 : lineCount + 2;
            }
            const isInHiddenArea = (lineNumber >= hiddenAreaStart && lineNumber <= hiddenAreaEnd);
            const line = createModelLineProjection(linesBreaks[i], !isInHiddenArea);
            values[i] = line.getViewLineCount();
            this.modelLineProjections[i] = line;
        }
        this._validModelVersionId = this.model.getVersionId();
        this.projectedModelLineLineCounts = new ConstantTimePrefixSumComputer(values);
    }
    getHiddenAreas() {
        return this.hiddenAreasDecorationIds.map((decId) => this.model.getDecorationRange(decId));
    }
    setHiddenAreas(_ranges) {
        const validatedRanges = _ranges.map(r => this.model.validateRange(r));
        const newRanges = normalizeLineRanges(validatedRanges);
        // TODO@Martin: Please stop calling this method on each model change!
        // This checks if there really was a change
        const oldRanges = this.hiddenAreasDecorationIds.map((areaId) => this.model.getDecorationRange(areaId)).sort(Range.compareRangesUsingStarts);
        if (newRanges.length === oldRanges.length) {
            let hasDifference = false;
            for (let i = 0; i < newRanges.length; i++) {
                if (!newRanges[i].equalsRange(oldRanges[i])) {
                    hasDifference = true;
                    break;
                }
            }
            if (!hasDifference) {
                return false;
            }
        }
        const newDecorations = newRanges.map((r) => ({
            range: r,
            options: ModelDecorationOptions.EMPTY,
        }));
        this.hiddenAreasDecorationIds = this.model.deltaDecorations(this.hiddenAreasDecorationIds, newDecorations);
        const hiddenAreas = newRanges;
        let hiddenAreaStart = 1, hiddenAreaEnd = 0;
        let hiddenAreaIdx = -1;
        let nextLineNumberToUpdateHiddenArea = (hiddenAreaIdx + 1 < hiddenAreas.length) ? hiddenAreaEnd + 1 : this.modelLineProjections.length + 2;
        let hasVisibleLine = false;
        for (let i = 0; i < this.modelLineProjections.length; i++) {
            const lineNumber = i + 1;
            if (lineNumber === nextLineNumberToUpdateHiddenArea) {
                hiddenAreaIdx++;
                hiddenAreaStart = hiddenAreas[hiddenAreaIdx].startLineNumber;
                hiddenAreaEnd = hiddenAreas[hiddenAreaIdx].endLineNumber;
                nextLineNumberToUpdateHiddenArea = (hiddenAreaIdx + 1 < hiddenAreas.length) ? hiddenAreaEnd + 1 : this.modelLineProjections.length + 2;
            }
            let lineChanged = false;
            if (lineNumber >= hiddenAreaStart && lineNumber <= hiddenAreaEnd) {
                // Line should be hidden
                if (this.modelLineProjections[i].isVisible()) {
                    this.modelLineProjections[i] = this.modelLineProjections[i].setVisible(false);
                    lineChanged = true;
                }
            }
            else {
                hasVisibleLine = true;
                // Line should be visible
                if (!this.modelLineProjections[i].isVisible()) {
                    this.modelLineProjections[i] = this.modelLineProjections[i].setVisible(true);
                    lineChanged = true;
                }
            }
            if (lineChanged) {
                const newOutputLineCount = this.modelLineProjections[i].getViewLineCount();
                this.projectedModelLineLineCounts.setValue(i, newOutputLineCount);
            }
        }
        if (!hasVisibleLine) {
            // Cannot have everything be hidden => reveal everything!
            this.setHiddenAreas([]);
        }
        return true;
    }
    modelPositionIsVisible(modelLineNumber, _modelColumn) {
        if (modelLineNumber < 1 || modelLineNumber > this.modelLineProjections.length) {
            // invalid arguments
            return false;
        }
        return this.modelLineProjections[modelLineNumber - 1].isVisible();
    }
    getModelLineViewLineCount(modelLineNumber) {
        if (modelLineNumber < 1 || modelLineNumber > this.modelLineProjections.length) {
            // invalid arguments
            return 1;
        }
        return this.modelLineProjections[modelLineNumber - 1].getViewLineCount();
    }
    setTabSize(newTabSize) {
        if (this.tabSize === newTabSize) {
            return false;
        }
        this.tabSize = newTabSize;
        this._constructLines(/*resetHiddenAreas*/ false, null);
        return true;
    }
    setWrappingSettings(fontInfo, wrappingStrategy, wrappingColumn, wrappingIndent, wordBreak) {
        const equalFontInfo = this.fontInfo.equals(fontInfo);
        const equalWrappingStrategy = (this.wrappingStrategy === wrappingStrategy);
        const equalWrappingColumn = (this.wrappingColumn === wrappingColumn);
        const equalWrappingIndent = (this.wrappingIndent === wrappingIndent);
        const equalWordBreak = (this.wordBreak === wordBreak);
        if (equalFontInfo && equalWrappingStrategy && equalWrappingColumn && equalWrappingIndent && equalWordBreak) {
            return false;
        }
        const onlyWrappingColumnChanged = (equalFontInfo && equalWrappingStrategy && !equalWrappingColumn && equalWrappingIndent && equalWordBreak);
        this.fontInfo = fontInfo;
        this.wrappingStrategy = wrappingStrategy;
        this.wrappingColumn = wrappingColumn;
        this.wrappingIndent = wrappingIndent;
        this.wordBreak = wordBreak;
        let previousLineBreaks = null;
        if (onlyWrappingColumnChanged) {
            previousLineBreaks = [];
            for (let i = 0, len = this.modelLineProjections.length; i < len; i++) {
                previousLineBreaks[i] = this.modelLineProjections[i].getProjectionData();
            }
        }
        this._constructLines(/*resetHiddenAreas*/ false, previousLineBreaks);
        return true;
    }
    createLineBreaksComputer() {
        const lineBreaksComputerFactory = (this.wrappingStrategy === 'advanced'
            ? this._domLineBreaksComputerFactory
            : this._monospaceLineBreaksComputerFactory);
        return lineBreaksComputerFactory.createLineBreaksComputer(this.fontInfo, this.tabSize, this.wrappingColumn, this.wrappingIndent, this.wordBreak, this.wrapOnEscapedLineFeeds);
    }
    onModelFlushed() {
        this._constructLines(/*resetHiddenAreas*/ true, null);
    }
    onModelLinesDeleted(versionId, fromLineNumber, toLineNumber) {
        if (!versionId || versionId <= this._validModelVersionId) {
            // Here we check for versionId in case the lines were reconstructed in the meantime.
            // We don't want to apply stale change events on top of a newer read model state.
            return null;
        }
        const outputFromLineNumber = (fromLineNumber === 1 ? 1 : this.projectedModelLineLineCounts.getPrefixSum(fromLineNumber - 1) + 1);
        const outputToLineNumber = this.projectedModelLineLineCounts.getPrefixSum(toLineNumber);
        this.modelLineProjections.splice(fromLineNumber - 1, toLineNumber - fromLineNumber + 1);
        this.projectedModelLineLineCounts.removeValues(fromLineNumber - 1, toLineNumber - fromLineNumber + 1);
        return new viewEvents.ViewLinesDeletedEvent(outputFromLineNumber, outputToLineNumber);
    }
    onModelLinesInserted(versionId, fromLineNumber, _toLineNumber, lineBreaks) {
        if (!versionId || versionId <= this._validModelVersionId) {
            // Here we check for versionId in case the lines were reconstructed in the meantime.
            // We don't want to apply stale change events on top of a newer read model state.
            return null;
        }
        // cannot use this.getHiddenAreas() because those decorations have already seen the effect of this model change
        const isInHiddenArea = (fromLineNumber > 2 && !this.modelLineProjections[fromLineNumber - 2].isVisible());
        const outputFromLineNumber = (fromLineNumber === 1 ? 1 : this.projectedModelLineLineCounts.getPrefixSum(fromLineNumber - 1) + 1);
        let totalOutputLineCount = 0;
        const insertLines = [];
        const insertPrefixSumValues = [];
        for (let i = 0, len = lineBreaks.length; i < len; i++) {
            const line = createModelLineProjection(lineBreaks[i], !isInHiddenArea);
            insertLines.push(line);
            const outputLineCount = line.getViewLineCount();
            totalOutputLineCount += outputLineCount;
            insertPrefixSumValues[i] = outputLineCount;
        }
        // TODO@Alex: use arrays.arrayInsert
        this.modelLineProjections =
            this.modelLineProjections.slice(0, fromLineNumber - 1)
                .concat(insertLines)
                .concat(this.modelLineProjections.slice(fromLineNumber - 1));
        this.projectedModelLineLineCounts.insertValues(fromLineNumber - 1, insertPrefixSumValues);
        return new viewEvents.ViewLinesInsertedEvent(outputFromLineNumber, outputFromLineNumber + totalOutputLineCount - 1);
    }
    onModelLineChanged(versionId, lineNumber, lineBreakData) {
        if (versionId !== null && versionId <= this._validModelVersionId) {
            // Here we check for versionId in case the lines were reconstructed in the meantime.
            // We don't want to apply stale change events on top of a newer read model state.
            return [false, null, null, null];
        }
        const lineIndex = lineNumber - 1;
        const oldOutputLineCount = this.modelLineProjections[lineIndex].getViewLineCount();
        const isVisible = this.modelLineProjections[lineIndex].isVisible();
        const line = createModelLineProjection(lineBreakData, isVisible);
        this.modelLineProjections[lineIndex] = line;
        const newOutputLineCount = this.modelLineProjections[lineIndex].getViewLineCount();
        let lineMappingChanged = false;
        let changeFrom = 0;
        let changeTo = -1;
        let insertFrom = 0;
        let insertTo = -1;
        let deleteFrom = 0;
        let deleteTo = -1;
        if (oldOutputLineCount > newOutputLineCount) {
            changeFrom = this.projectedModelLineLineCounts.getPrefixSum(lineNumber - 1) + 1;
            changeTo = changeFrom + newOutputLineCount - 1;
            deleteFrom = changeTo + 1;
            deleteTo = deleteFrom + (oldOutputLineCount - newOutputLineCount) - 1;
            lineMappingChanged = true;
        }
        else if (oldOutputLineCount < newOutputLineCount) {
            changeFrom = this.projectedModelLineLineCounts.getPrefixSum(lineNumber - 1) + 1;
            changeTo = changeFrom + oldOutputLineCount - 1;
            insertFrom = changeTo + 1;
            insertTo = insertFrom + (newOutputLineCount - oldOutputLineCount) - 1;
            lineMappingChanged = true;
        }
        else {
            changeFrom = this.projectedModelLineLineCounts.getPrefixSum(lineNumber - 1) + 1;
            changeTo = changeFrom + newOutputLineCount - 1;
        }
        this.projectedModelLineLineCounts.setValue(lineIndex, newOutputLineCount);
        const viewLinesChangedEvent = (changeFrom <= changeTo ? new viewEvents.ViewLinesChangedEvent(changeFrom, changeTo - changeFrom + 1) : null);
        const viewLinesInsertedEvent = (insertFrom <= insertTo ? new viewEvents.ViewLinesInsertedEvent(insertFrom, insertTo) : null);
        const viewLinesDeletedEvent = (deleteFrom <= deleteTo ? new viewEvents.ViewLinesDeletedEvent(deleteFrom, deleteTo) : null);
        return [lineMappingChanged, viewLinesChangedEvent, viewLinesInsertedEvent, viewLinesDeletedEvent];
    }
    acceptVersionId(versionId) {
        this._validModelVersionId = versionId;
        if (this.modelLineProjections.length === 1 && !this.modelLineProjections[0].isVisible()) {
            // At least one line must be visible => reset hidden areas
            this.setHiddenAreas([]);
        }
    }
    getViewLineCount() {
        return this.projectedModelLineLineCounts.getTotalSum();
    }
    _toValidViewLineNumber(viewLineNumber) {
        if (viewLineNumber < 1) {
            return 1;
        }
        const viewLineCount = this.getViewLineCount();
        if (viewLineNumber > viewLineCount) {
            return viewLineCount;
        }
        return viewLineNumber | 0;
    }
    getActiveIndentGuide(viewLineNumber, minLineNumber, maxLineNumber) {
        viewLineNumber = this._toValidViewLineNumber(viewLineNumber);
        minLineNumber = this._toValidViewLineNumber(minLineNumber);
        maxLineNumber = this._toValidViewLineNumber(maxLineNumber);
        const modelPosition = this.convertViewPositionToModelPosition(viewLineNumber, this.getViewLineMinColumn(viewLineNumber));
        const modelMinPosition = this.convertViewPositionToModelPosition(minLineNumber, this.getViewLineMinColumn(minLineNumber));
        const modelMaxPosition = this.convertViewPositionToModelPosition(maxLineNumber, this.getViewLineMinColumn(maxLineNumber));
        const result = this.model.guides.getActiveIndentGuide(modelPosition.lineNumber, modelMinPosition.lineNumber, modelMaxPosition.lineNumber);
        const viewStartPosition = this.convertModelPositionToViewPosition(result.startLineNumber, 1);
        const viewEndPosition = this.convertModelPositionToViewPosition(result.endLineNumber, this.model.getLineMaxColumn(result.endLineNumber));
        return {
            startLineNumber: viewStartPosition.lineNumber,
            endLineNumber: viewEndPosition.lineNumber,
            indent: result.indent
        };
    }
    // #region ViewLineInfo
    getViewLineInfo(viewLineNumber) {
        viewLineNumber = this._toValidViewLineNumber(viewLineNumber);
        const r = this.projectedModelLineLineCounts.getIndexOf(viewLineNumber - 1);
        const lineIndex = r.index;
        const remainder = r.remainder;
        return new ViewLineInfo(lineIndex + 1, remainder);
    }
    getMinColumnOfViewLine(viewLineInfo) {
        return this.modelLineProjections[viewLineInfo.modelLineNumber - 1].getViewLineMinColumn(this.model, viewLineInfo.modelLineNumber, viewLineInfo.modelLineWrappedLineIdx);
    }
    getMaxColumnOfViewLine(viewLineInfo) {
        return this.modelLineProjections[viewLineInfo.modelLineNumber - 1].getViewLineMaxColumn(this.model, viewLineInfo.modelLineNumber, viewLineInfo.modelLineWrappedLineIdx);
    }
    getModelStartPositionOfViewLine(viewLineInfo) {
        const line = this.modelLineProjections[viewLineInfo.modelLineNumber - 1];
        const minViewColumn = line.getViewLineMinColumn(this.model, viewLineInfo.modelLineNumber, viewLineInfo.modelLineWrappedLineIdx);
        const column = line.getModelColumnOfViewPosition(viewLineInfo.modelLineWrappedLineIdx, minViewColumn);
        return new Position(viewLineInfo.modelLineNumber, column);
    }
    getModelEndPositionOfViewLine(viewLineInfo) {
        const line = this.modelLineProjections[viewLineInfo.modelLineNumber - 1];
        const maxViewColumn = line.getViewLineMaxColumn(this.model, viewLineInfo.modelLineNumber, viewLineInfo.modelLineWrappedLineIdx);
        const column = line.getModelColumnOfViewPosition(viewLineInfo.modelLineWrappedLineIdx, maxViewColumn);
        return new Position(viewLineInfo.modelLineNumber, column);
    }
    getViewLineInfosGroupedByModelRanges(viewStartLineNumber, viewEndLineNumber) {
        const startViewLine = this.getViewLineInfo(viewStartLineNumber);
        const endViewLine = this.getViewLineInfo(viewEndLineNumber);
        const result = new Array();
        let lastVisibleModelPos = this.getModelStartPositionOfViewLine(startViewLine);
        let viewLines = new Array();
        for (let curModelLine = startViewLine.modelLineNumber; curModelLine <= endViewLine.modelLineNumber; curModelLine++) {
            const line = this.modelLineProjections[curModelLine - 1];
            if (line.isVisible()) {
                const startOffset = curModelLine === startViewLine.modelLineNumber
                    ? startViewLine.modelLineWrappedLineIdx
                    : 0;
                const endOffset = curModelLine === endViewLine.modelLineNumber
                    ? endViewLine.modelLineWrappedLineIdx + 1
                    : line.getViewLineCount();
                for (let i = startOffset; i < endOffset; i++) {
                    viewLines.push(new ViewLineInfo(curModelLine, i));
                }
            }
            if (!line.isVisible() && lastVisibleModelPos) {
                const lastVisibleModelPos2 = new Position(curModelLine - 1, this.model.getLineMaxColumn(curModelLine - 1) + 1);
                const modelRange = Range.fromPositions(lastVisibleModelPos, lastVisibleModelPos2);
                result.push(new ViewLineInfoGroupedByModelRange(modelRange, viewLines));
                viewLines = [];
                lastVisibleModelPos = null;
            }
            else if (line.isVisible() && !lastVisibleModelPos) {
                lastVisibleModelPos = new Position(curModelLine, 1);
            }
        }
        if (lastVisibleModelPos) {
            const modelRange = Range.fromPositions(lastVisibleModelPos, this.getModelEndPositionOfViewLine(endViewLine));
            result.push(new ViewLineInfoGroupedByModelRange(modelRange, viewLines));
        }
        return result;
    }
    // #endregion
    getViewLinesBracketGuides(viewStartLineNumber, viewEndLineNumber, activeViewPosition, options) {
        const modelActivePosition = activeViewPosition ? this.convertViewPositionToModelPosition(activeViewPosition.lineNumber, activeViewPosition.column) : null;
        const resultPerViewLine = [];
        for (const group of this.getViewLineInfosGroupedByModelRanges(viewStartLineNumber, viewEndLineNumber)) {
            const modelRangeStartLineNumber = group.modelRange.startLineNumber;
            const bracketGuidesPerModelLine = this.model.guides.getLinesBracketGuides(modelRangeStartLineNumber, group.modelRange.endLineNumber, modelActivePosition, options);
            for (const viewLineInfo of group.viewLines) {
                const bracketGuides = bracketGuidesPerModelLine[viewLineInfo.modelLineNumber - modelRangeStartLineNumber];
                // visibleColumns stay as they are (this is a bug and needs to be fixed, but it is not a regression)
                // model-columns must be converted to view-model columns.
                const result = bracketGuides.map(g => {
                    if (g.forWrappedLinesAfterColumn !== -1) {
                        const p = this.modelLineProjections[viewLineInfo.modelLineNumber - 1].getViewPositionOfModelPosition(0, g.forWrappedLinesAfterColumn);
                        if (p.lineNumber >= viewLineInfo.modelLineWrappedLineIdx) {
                            return undefined;
                        }
                    }
                    if (g.forWrappedLinesBeforeOrAtColumn !== -1) {
                        const p = this.modelLineProjections[viewLineInfo.modelLineNumber - 1].getViewPositionOfModelPosition(0, g.forWrappedLinesBeforeOrAtColumn);
                        if (p.lineNumber < viewLineInfo.modelLineWrappedLineIdx) {
                            return undefined;
                        }
                    }
                    if (!g.horizontalLine) {
                        return g;
                    }
                    let column = -1;
                    if (g.column !== -1) {
                        const p = this.modelLineProjections[viewLineInfo.modelLineNumber - 1].getViewPositionOfModelPosition(0, g.column);
                        if (p.lineNumber === viewLineInfo.modelLineWrappedLineIdx) {
                            column = p.column;
                        }
                        else if (p.lineNumber < viewLineInfo.modelLineWrappedLineIdx) {
                            column = this.getMinColumnOfViewLine(viewLineInfo);
                        }
                        else if (p.lineNumber > viewLineInfo.modelLineWrappedLineIdx) {
                            return undefined;
                        }
                    }
                    const viewPosition = this.convertModelPositionToViewPosition(viewLineInfo.modelLineNumber, g.horizontalLine.endColumn);
                    const p = this.modelLineProjections[viewLineInfo.modelLineNumber - 1].getViewPositionOfModelPosition(0, g.horizontalLine.endColumn);
                    if (p.lineNumber === viewLineInfo.modelLineWrappedLineIdx) {
                        return new IndentGuide(g.visibleColumn, column, g.className, new IndentGuideHorizontalLine(g.horizontalLine.top, viewPosition.column), -1, -1);
                    }
                    else if (p.lineNumber < viewLineInfo.modelLineWrappedLineIdx) {
                        return undefined;
                    }
                    else {
                        if (g.visibleColumn !== -1) {
                            // Don't repeat horizontal lines that use visibleColumn for unrelated lines.
                            return undefined;
                        }
                        return new IndentGuide(g.visibleColumn, column, g.className, new IndentGuideHorizontalLine(g.horizontalLine.top, this.getMaxColumnOfViewLine(viewLineInfo)), -1, -1);
                    }
                });
                resultPerViewLine.push(result.filter((r) => !!r));
            }
        }
        return resultPerViewLine;
    }
    getViewLinesIndentGuides(viewStartLineNumber, viewEndLineNumber) {
        // TODO: Use the same code as in `getViewLinesBracketGuides`.
        // Future TODO: Merge with `getViewLinesBracketGuides`.
        // However, this requires more refactoring of indent guides.
        viewStartLineNumber = this._toValidViewLineNumber(viewStartLineNumber);
        viewEndLineNumber = this._toValidViewLineNumber(viewEndLineNumber);
        const modelStart = this.convertViewPositionToModelPosition(viewStartLineNumber, this.getViewLineMinColumn(viewStartLineNumber));
        const modelEnd = this.convertViewPositionToModelPosition(viewEndLineNumber, this.getViewLineMaxColumn(viewEndLineNumber));
        let result = [];
        const resultRepeatCount = [];
        const resultRepeatOption = [];
        const modelStartLineIndex = modelStart.lineNumber - 1;
        const modelEndLineIndex = modelEnd.lineNumber - 1;
        let reqStart = null;
        for (let modelLineIndex = modelStartLineIndex; modelLineIndex <= modelEndLineIndex; modelLineIndex++) {
            const line = this.modelLineProjections[modelLineIndex];
            if (line.isVisible()) {
                const viewLineStartIndex = line.getViewLineNumberOfModelPosition(0, modelLineIndex === modelStartLineIndex ? modelStart.column : 1);
                const viewLineEndIndex = line.getViewLineNumberOfModelPosition(0, this.model.getLineMaxColumn(modelLineIndex + 1));
                const count = viewLineEndIndex - viewLineStartIndex + 1;
                let option = 0 /* IndentGuideRepeatOption.BlockNone */;
                if (count > 1 && line.getViewLineMinColumn(this.model, modelLineIndex + 1, viewLineEndIndex) === 1) {
                    // wrapped lines should block indent guides
                    option = (viewLineStartIndex === 0 ? 1 /* IndentGuideRepeatOption.BlockSubsequent */ : 2 /* IndentGuideRepeatOption.BlockAll */);
                }
                resultRepeatCount.push(count);
                resultRepeatOption.push(option);
                // merge into previous request
                if (reqStart === null) {
                    reqStart = new Position(modelLineIndex + 1, 0);
                }
            }
            else {
                // hit invisible line => flush request
                if (reqStart !== null) {
                    result = result.concat(this.model.guides.getLinesIndentGuides(reqStart.lineNumber, modelLineIndex));
                    reqStart = null;
                }
            }
        }
        if (reqStart !== null) {
            result = result.concat(this.model.guides.getLinesIndentGuides(reqStart.lineNumber, modelEnd.lineNumber));
            reqStart = null;
        }
        const viewLineCount = viewEndLineNumber - viewStartLineNumber + 1;
        const viewIndents = new Array(viewLineCount);
        let currIndex = 0;
        for (let i = 0, len = result.length; i < len; i++) {
            let value = result[i];
            const count = Math.min(viewLineCount - currIndex, resultRepeatCount[i]);
            const option = resultRepeatOption[i];
            let blockAtIndex;
            if (option === 2 /* IndentGuideRepeatOption.BlockAll */) {
                blockAtIndex = 0;
            }
            else if (option === 1 /* IndentGuideRepeatOption.BlockSubsequent */) {
                blockAtIndex = 1;
            }
            else {
                blockAtIndex = count;
            }
            for (let j = 0; j < count; j++) {
                if (j === blockAtIndex) {
                    value = 0;
                }
                viewIndents[currIndex++] = value;
            }
        }
        return viewIndents;
    }
    getViewLineContent(viewLineNumber) {
        const info = this.getViewLineInfo(viewLineNumber);
        return this.modelLineProjections[info.modelLineNumber - 1].getViewLineContent(this.model, info.modelLineNumber, info.modelLineWrappedLineIdx);
    }
    getViewLineLength(viewLineNumber) {
        const info = this.getViewLineInfo(viewLineNumber);
        return this.modelLineProjections[info.modelLineNumber - 1].getViewLineLength(this.model, info.modelLineNumber, info.modelLineWrappedLineIdx);
    }
    getViewLineMinColumn(viewLineNumber) {
        const info = this.getViewLineInfo(viewLineNumber);
        return this.modelLineProjections[info.modelLineNumber - 1].getViewLineMinColumn(this.model, info.modelLineNumber, info.modelLineWrappedLineIdx);
    }
    getViewLineMaxColumn(viewLineNumber) {
        const info = this.getViewLineInfo(viewLineNumber);
        return this.modelLineProjections[info.modelLineNumber - 1].getViewLineMaxColumn(this.model, info.modelLineNumber, info.modelLineWrappedLineIdx);
    }
    getViewLineData(viewLineNumber) {
        const info = this.getViewLineInfo(viewLineNumber);
        return this.modelLineProjections[info.modelLineNumber - 1].getViewLineData(this.model, info.modelLineNumber, info.modelLineWrappedLineIdx);
    }
    getViewLinesData(viewStartLineNumber, viewEndLineNumber, needed) {
        viewStartLineNumber = this._toValidViewLineNumber(viewStartLineNumber);
        viewEndLineNumber = this._toValidViewLineNumber(viewEndLineNumber);
        const start = this.projectedModelLineLineCounts.getIndexOf(viewStartLineNumber - 1);
        let viewLineNumber = viewStartLineNumber;
        const startModelLineIndex = start.index;
        const startRemainder = start.remainder;
        const result = [];
        for (let modelLineIndex = startModelLineIndex, len = this.model.getLineCount(); modelLineIndex < len; modelLineIndex++) {
            const line = this.modelLineProjections[modelLineIndex];
            if (!line.isVisible()) {
                continue;
            }
            const fromViewLineIndex = (modelLineIndex === startModelLineIndex ? startRemainder : 0);
            let remainingViewLineCount = line.getViewLineCount() - fromViewLineIndex;
            let lastLine = false;
            if (viewLineNumber + remainingViewLineCount > viewEndLineNumber) {
                lastLine = true;
                remainingViewLineCount = viewEndLineNumber - viewLineNumber + 1;
            }
            line.getViewLinesData(this.model, modelLineIndex + 1, fromViewLineIndex, remainingViewLineCount, viewLineNumber - viewStartLineNumber, needed, result);
            viewLineNumber += remainingViewLineCount;
            if (lastLine) {
                break;
            }
        }
        return result;
    }
    validateViewPosition(viewLineNumber, viewColumn, expectedModelPosition) {
        viewLineNumber = this._toValidViewLineNumber(viewLineNumber);
        const r = this.projectedModelLineLineCounts.getIndexOf(viewLineNumber - 1);
        const lineIndex = r.index;
        const remainder = r.remainder;
        const line = this.modelLineProjections[lineIndex];
        const minColumn = line.getViewLineMinColumn(this.model, lineIndex + 1, remainder);
        const maxColumn = line.getViewLineMaxColumn(this.model, lineIndex + 1, remainder);
        if (viewColumn < minColumn) {
            viewColumn = minColumn;
        }
        if (viewColumn > maxColumn) {
            viewColumn = maxColumn;
        }
        const computedModelColumn = line.getModelColumnOfViewPosition(remainder, viewColumn);
        const computedModelPosition = this.model.validatePosition(new Position(lineIndex + 1, computedModelColumn));
        if (computedModelPosition.equals(expectedModelPosition)) {
            return new Position(viewLineNumber, viewColumn);
        }
        return this.convertModelPositionToViewPosition(expectedModelPosition.lineNumber, expectedModelPosition.column);
    }
    validateViewRange(viewRange, expectedModelRange) {
        const validViewStart = this.validateViewPosition(viewRange.startLineNumber, viewRange.startColumn, expectedModelRange.getStartPosition());
        const validViewEnd = this.validateViewPosition(viewRange.endLineNumber, viewRange.endColumn, expectedModelRange.getEndPosition());
        return new Range(validViewStart.lineNumber, validViewStart.column, validViewEnd.lineNumber, validViewEnd.column);
    }
    convertViewPositionToModelPosition(viewLineNumber, viewColumn) {
        const info = this.getViewLineInfo(viewLineNumber);
        const inputColumn = this.modelLineProjections[info.modelLineNumber - 1].getModelColumnOfViewPosition(info.modelLineWrappedLineIdx, viewColumn);
        // console.log('out -> in ' + viewLineNumber + ',' + viewColumn + ' ===> ' + (lineIndex+1) + ',' + inputColumn);
        return this.model.validatePosition(new Position(info.modelLineNumber, inputColumn));
    }
    convertViewRangeToModelRange(viewRange) {
        const start = this.convertViewPositionToModelPosition(viewRange.startLineNumber, viewRange.startColumn);
        const end = this.convertViewPositionToModelPosition(viewRange.endLineNumber, viewRange.endColumn);
        return new Range(start.lineNumber, start.column, end.lineNumber, end.column);
    }
    convertModelPositionToViewPosition(_modelLineNumber, _modelColumn, affinity = 2 /* PositionAffinity.None */, allowZeroLineNumber = false, belowHiddenRanges = false) {
        const validPosition = this.model.validatePosition(new Position(_modelLineNumber, _modelColumn));
        const inputLineNumber = validPosition.lineNumber;
        const inputColumn = validPosition.column;
        let lineIndex = inputLineNumber - 1, lineIndexChanged = false;
        if (belowHiddenRanges) {
            while (lineIndex < this.modelLineProjections.length && !this.modelLineProjections[lineIndex].isVisible()) {
                lineIndex++;
                lineIndexChanged = true;
            }
        }
        else {
            while (lineIndex > 0 && !this.modelLineProjections[lineIndex].isVisible()) {
                lineIndex--;
                lineIndexChanged = true;
            }
        }
        if (lineIndex === 0 && !this.modelLineProjections[lineIndex].isVisible()) {
            // Could not reach a real line
            // console.log('in -> out ' + inputLineNumber + ',' + inputColumn + ' ===> ' + 1 + ',' + 1);
            // TODO@alexdima@hediet this isn't soo pretty
            return new Position(allowZeroLineNumber ? 0 : 1, 1);
        }
        const deltaLineNumber = 1 + this.projectedModelLineLineCounts.getPrefixSum(lineIndex);
        let r;
        if (lineIndexChanged) {
            if (belowHiddenRanges) {
                r = this.modelLineProjections[lineIndex].getViewPositionOfModelPosition(deltaLineNumber, 1, affinity);
            }
            else {
                r = this.modelLineProjections[lineIndex].getViewPositionOfModelPosition(deltaLineNumber, this.model.getLineMaxColumn(lineIndex + 1), affinity);
            }
        }
        else {
            r = this.modelLineProjections[inputLineNumber - 1].getViewPositionOfModelPosition(deltaLineNumber, inputColumn, affinity);
        }
        // console.log('in -> out ' + inputLineNumber + ',' + inputColumn + ' ===> ' + r.lineNumber + ',' + r);
        return r;
    }
    /**
     * @param affinity The affinity in case of an empty range. Has no effect for non-empty ranges.
    */
    convertModelRangeToViewRange(modelRange, affinity = 0 /* PositionAffinity.Left */) {
        if (modelRange.isEmpty()) {
            const start = this.convertModelPositionToViewPosition(modelRange.startLineNumber, modelRange.startColumn, affinity);
            return Range.fromPositions(start);
        }
        else {
            const start = this.convertModelPositionToViewPosition(modelRange.startLineNumber, modelRange.startColumn, 1 /* PositionAffinity.Right */);
            const end = this.convertModelPositionToViewPosition(modelRange.endLineNumber, modelRange.endColumn, 0 /* PositionAffinity.Left */);
            return new Range(start.lineNumber, start.column, end.lineNumber, end.column);
        }
    }
    getViewLineNumberOfModelPosition(modelLineNumber, modelColumn) {
        let lineIndex = modelLineNumber - 1;
        if (this.modelLineProjections[lineIndex].isVisible()) {
            // this model line is visible
            const deltaLineNumber = 1 + this.projectedModelLineLineCounts.getPrefixSum(lineIndex);
            return this.modelLineProjections[lineIndex].getViewLineNumberOfModelPosition(deltaLineNumber, modelColumn);
        }
        // this model line is not visible
        while (lineIndex > 0 && !this.modelLineProjections[lineIndex].isVisible()) {
            lineIndex--;
        }
        if (lineIndex === 0 && !this.modelLineProjections[lineIndex].isVisible()) {
            // Could not reach a real line
            return 1;
        }
        const deltaLineNumber = 1 + this.projectedModelLineLineCounts.getPrefixSum(lineIndex);
        return this.modelLineProjections[lineIndex].getViewLineNumberOfModelPosition(deltaLineNumber, this.model.getLineMaxColumn(lineIndex + 1));
    }
    getDecorationsInRange(range, ownerId, filterOutValidation, filterFontDecorations, onlyMinimapDecorations, onlyMarginDecorations) {
        const modelStart = this.convertViewPositionToModelPosition(range.startLineNumber, range.startColumn);
        const modelEnd = this.convertViewPositionToModelPosition(range.endLineNumber, range.endColumn);
        if (modelEnd.lineNumber - modelStart.lineNumber <= range.endLineNumber - range.startLineNumber) {
            // most likely there are no hidden lines => fast path
            // fetch decorations from column 1 to cover the case of wrapped lines that have whole line decorations at column 1
            return this.model.getDecorationsInRange(new Range(modelStart.lineNumber, 1, modelEnd.lineNumber, modelEnd.column), ownerId, filterOutValidation, filterFontDecorations, onlyMinimapDecorations, onlyMarginDecorations);
        }
        let result = [];
        const modelStartLineIndex = modelStart.lineNumber - 1;
        const modelEndLineIndex = modelEnd.lineNumber - 1;
        let reqStart = null;
        for (let modelLineIndex = modelStartLineIndex; modelLineIndex <= modelEndLineIndex; modelLineIndex++) {
            const line = this.modelLineProjections[modelLineIndex];
            if (line.isVisible()) {
                // merge into previous request
                if (reqStart === null) {
                    reqStart = new Position(modelLineIndex + 1, modelLineIndex === modelStartLineIndex ? modelStart.column : 1);
                }
            }
            else {
                // hit invisible line => flush request
                if (reqStart !== null) {
                    const maxLineColumn = this.model.getLineMaxColumn(modelLineIndex);
                    result = result.concat(this.model.getDecorationsInRange(new Range(reqStart.lineNumber, reqStart.column, modelLineIndex, maxLineColumn), ownerId, filterOutValidation, filterFontDecorations, onlyMinimapDecorations));
                    reqStart = null;
                }
            }
        }
        if (reqStart !== null) {
            result = result.concat(this.model.getDecorationsInRange(new Range(reqStart.lineNumber, reqStart.column, modelEnd.lineNumber, modelEnd.column), ownerId, filterOutValidation, filterFontDecorations, onlyMinimapDecorations));
            reqStart = null;
        }
        result.sort((a, b) => {
            const res = Range.compareRangesUsingStarts(a.range, b.range);
            if (res === 0) {
                if (a.id < b.id) {
                    return -1;
                }
                if (a.id > b.id) {
                    return 1;
                }
                return 0;
            }
            return res;
        });
        // Eliminate duplicate decorations that might have intersected our visible ranges multiple times
        const finalResult = [];
        let finalResultLen = 0;
        let prevDecId = null;
        for (const dec of result) {
            const decId = dec.id;
            if (prevDecId === decId) {
                // skip
                continue;
            }
            prevDecId = decId;
            finalResult[finalResultLen++] = dec;
        }
        return finalResult;
    }
    getInjectedTextAt(position) {
        const info = this.getViewLineInfo(position.lineNumber);
        return this.modelLineProjections[info.modelLineNumber - 1].getInjectedTextAt(info.modelLineWrappedLineIdx, position.column);
    }
    normalizePosition(position, affinity) {
        const info = this.getViewLineInfo(position.lineNumber);
        return this.modelLineProjections[info.modelLineNumber - 1].normalizePosition(info.modelLineWrappedLineIdx, position, affinity);
    }
    getLineIndentColumn(lineNumber) {
        const info = this.getViewLineInfo(lineNumber);
        if (info.modelLineWrappedLineIdx === 0) {
            return this.model.getLineIndentColumn(info.modelLineNumber);
        }
        // wrapped lines have no indentation.
        // We deliberately don't handle the case that indentation is wrapped
        // to avoid two view lines reporting indentation for the very same model line.
        return 0;
    }
}
/**
 * Overlapping unsorted ranges:
 * [   )      [ )       [  )
 *    [    )      [       )
 * ->
 * Non overlapping sorted ranges:
 * [       )  [ ) [        )
 *
 * Note: This function only considers line information! Columns are ignored.
*/
function normalizeLineRanges(ranges) {
    if (ranges.length === 0) {
        return [];
    }
    const sortedRanges = ranges.slice();
    sortedRanges.sort(Range.compareRangesUsingStarts);
    const result = [];
    let currentRangeStart = sortedRanges[0].startLineNumber;
    let currentRangeEnd = sortedRanges[0].endLineNumber;
    for (let i = 1, len = sortedRanges.length; i < len; i++) {
        const range = sortedRanges[i];
        if (range.startLineNumber > currentRangeEnd + 1) {
            result.push(new Range(currentRangeStart, 1, currentRangeEnd, 1));
            currentRangeStart = range.startLineNumber;
            currentRangeEnd = range.endLineNumber;
        }
        else if (range.endLineNumber > currentRangeEnd) {
            currentRangeEnd = range.endLineNumber;
        }
    }
    result.push(new Range(currentRangeStart, 1, currentRangeEnd, 1));
    return result;
}
/**
 * Represents a view line. Can be used to efficiently query more information about it.
 */
class ViewLineInfo {
    get isWrappedLineContinuation() {
        return this.modelLineWrappedLineIdx > 0;
    }
    constructor(modelLineNumber, modelLineWrappedLineIdx) {
        this.modelLineNumber = modelLineNumber;
        this.modelLineWrappedLineIdx = modelLineWrappedLineIdx;
    }
}
/**
 * A list of view lines that have a contiguous span in the model.
*/
class ViewLineInfoGroupedByModelRange {
    constructor(modelRange, viewLines) {
        this.modelRange = modelRange;
        this.viewLines = viewLines;
    }
}
class CoordinatesConverter {
    constructor(lines) {
        this._lines = lines;
    }
    // View -> Model conversion and related methods
    convertViewPositionToModelPosition(viewPosition) {
        return this._lines.convertViewPositionToModelPosition(viewPosition.lineNumber, viewPosition.column);
    }
    convertViewRangeToModelRange(viewRange) {
        return this._lines.convertViewRangeToModelRange(viewRange);
    }
    validateViewPosition(viewPosition, expectedModelPosition) {
        return this._lines.validateViewPosition(viewPosition.lineNumber, viewPosition.column, expectedModelPosition);
    }
    validateViewRange(viewRange, expectedModelRange) {
        return this._lines.validateViewRange(viewRange, expectedModelRange);
    }
    // Model -> View conversion and related methods
    convertModelPositionToViewPosition(modelPosition, affinity, allowZero, belowHiddenRanges) {
        return this._lines.convertModelPositionToViewPosition(modelPosition.lineNumber, modelPosition.column, affinity, allowZero, belowHiddenRanges);
    }
    convertModelRangeToViewRange(modelRange, affinity) {
        return this._lines.convertModelRangeToViewRange(modelRange, affinity);
    }
    modelPositionIsVisible(modelPosition) {
        return this._lines.modelPositionIsVisible(modelPosition.lineNumber, modelPosition.column);
    }
    getModelLineViewLineCount(modelLineNumber) {
        return this._lines.getModelLineViewLineCount(modelLineNumber);
    }
    getViewLineNumberOfModelPosition(modelLineNumber, modelColumn) {
        return this._lines.getViewLineNumberOfModelPosition(modelLineNumber, modelColumn);
    }
}
var IndentGuideRepeatOption;
(function (IndentGuideRepeatOption) {
    IndentGuideRepeatOption[IndentGuideRepeatOption["BlockNone"] = 0] = "BlockNone";
    IndentGuideRepeatOption[IndentGuideRepeatOption["BlockSubsequent"] = 1] = "BlockSubsequent";
    IndentGuideRepeatOption[IndentGuideRepeatOption["BlockAll"] = 2] = "BlockAll";
})(IndentGuideRepeatOption || (IndentGuideRepeatOption = {}));
export class ViewModelLinesFromModelAsIs {
    constructor(model) {
        this.model = model;
    }
    dispose() {
    }
    createCoordinatesConverter() {
        return new IdentityCoordinatesConverter(this.model);
    }
    getHiddenAreas() {
        return [];
    }
    setHiddenAreas(_ranges) {
        return false;
    }
    setTabSize(_newTabSize) {
        return false;
    }
    setWrappingSettings(_fontInfo, _wrappingStrategy, _wrappingColumn, _wrappingIndent) {
        return false;
    }
    createLineBreaksComputer() {
        const result = [];
        return {
            addRequest: (lineText, injectedText, previousLineBreakData) => {
                result.push(null);
            },
            finalize: () => {
                return result;
            }
        };
    }
    onModelFlushed() {
    }
    onModelLinesDeleted(_versionId, fromLineNumber, toLineNumber) {
        return new viewEvents.ViewLinesDeletedEvent(fromLineNumber, toLineNumber);
    }
    onModelLinesInserted(_versionId, fromLineNumber, toLineNumber, lineBreaks) {
        return new viewEvents.ViewLinesInsertedEvent(fromLineNumber, toLineNumber);
    }
    onModelLineChanged(_versionId, lineNumber, lineBreakData) {
        return [false, new viewEvents.ViewLinesChangedEvent(lineNumber, 1), null, null];
    }
    acceptVersionId(_versionId) {
    }
    getViewLineCount() {
        return this.model.getLineCount();
    }
    getActiveIndentGuide(viewLineNumber, _minLineNumber, _maxLineNumber) {
        return {
            startLineNumber: viewLineNumber,
            endLineNumber: viewLineNumber,
            indent: 0
        };
    }
    getViewLinesBracketGuides(startLineNumber, endLineNumber, activePosition) {
        return new Array(endLineNumber - startLineNumber + 1).fill([]);
    }
    getViewLinesIndentGuides(viewStartLineNumber, viewEndLineNumber) {
        const viewLineCount = viewEndLineNumber - viewStartLineNumber + 1;
        const result = new Array(viewLineCount);
        for (let i = 0; i < viewLineCount; i++) {
            result[i] = 0;
        }
        return result;
    }
    getViewLineContent(viewLineNumber) {
        return this.model.getLineContent(viewLineNumber);
    }
    getViewLineLength(viewLineNumber) {
        return this.model.getLineLength(viewLineNumber);
    }
    getViewLineMinColumn(viewLineNumber) {
        return this.model.getLineMinColumn(viewLineNumber);
    }
    getViewLineMaxColumn(viewLineNumber) {
        return this.model.getLineMaxColumn(viewLineNumber);
    }
    getViewLineData(viewLineNumber) {
        const lineTokens = this.model.tokenization.getLineTokens(viewLineNumber);
        const lineContent = lineTokens.getLineContent();
        return new ViewLineData(lineContent, false, 1, lineContent.length + 1, 0, lineTokens.inflate(), null);
    }
    getViewLinesData(viewStartLineNumber, viewEndLineNumber, needed) {
        const lineCount = this.model.getLineCount();
        viewStartLineNumber = Math.min(Math.max(1, viewStartLineNumber), lineCount);
        viewEndLineNumber = Math.min(Math.max(1, viewEndLineNumber), lineCount);
        const result = [];
        for (let lineNumber = viewStartLineNumber; lineNumber <= viewEndLineNumber; lineNumber++) {
            const idx = lineNumber - viewStartLineNumber;
            result[idx] = needed[idx] ? this.getViewLineData(lineNumber) : null;
        }
        return result;
    }
    getDecorationsInRange(range, ownerId, filterOutValidation, filterFontDecorations, onlyMinimapDecorations, onlyMarginDecorations) {
        return this.model.getDecorationsInRange(range, ownerId, filterOutValidation, filterFontDecorations, onlyMinimapDecorations, onlyMarginDecorations);
    }
    normalizePosition(position, affinity) {
        return this.model.normalizePosition(position, affinity);
    }
    getLineIndentColumn(lineNumber) {
        return this.model.getLineIndentColumn(lineNumber);
    }
    getInjectedTextAt(position) {
        // Identity lines collection does not support injected text.
        return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld01vZGVsTGluZXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi92aWV3TW9kZWwvdmlld01vZGVsTGluZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLE1BQU0sTUFBTSxnQ0FBZ0MsQ0FBQztBQUl6RCxPQUFPLEVBQWEsUUFBUSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDMUQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBRXpDLE9BQU8sRUFBK0MsV0FBVyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUgsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDL0QsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDekQsT0FBTyxLQUFLLFVBQVUsTUFBTSxrQkFBa0IsQ0FBQztBQUMvQyxPQUFPLEVBQUUseUJBQXlCLEVBQXdCLE1BQU0sMEJBQTBCLENBQUM7QUFFM0YsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDOUUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQy9DLE9BQU8sRUFBeUIsNEJBQTRCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQXdDakcsTUFBTSxPQUFPLGdDQUFnQztJQXlCNUMsWUFDQyxRQUFnQixFQUNoQixLQUFpQixFQUNqQiw0QkFBd0QsRUFDeEQsa0NBQThELEVBQzlELFFBQWtCLEVBQ2xCLE9BQWUsRUFDZixnQkFBdUMsRUFDdkMsY0FBc0IsRUFDdEIsY0FBOEIsRUFDOUIsU0FBK0IsRUFDL0Isc0JBQStCO1FBRS9CLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDO1FBQzFCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FB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