var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { TaskQueue } from '../../../../../base/common/async.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { observableValue, transaction } from '../../../../../base/common/observable.js';
import { setTimeout0 } from '../../../../../base/common/platform.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { TextLength } from '../../../core/text/textLength.js';
import { gotoParent, getClosestPreviousNodes, nextSiblingOrParentSibling, gotoNthChild } from './cursorUtils.js';
import { Range } from '../../../core/range.js';
let TreeSitterTree = class TreeSitterTree extends Disposable {
    constructor(languageId, _ranges, 
    // readonly treeSitterLanguage: Language,
    /** Must have the language set! */
    _parser, _parserClass, 
    // private readonly _injectionQuery: TreeSitter.Query,
    textModel, _logService, _telemetryService) {
        super();
        this.languageId = languageId;
        this._ranges = _ranges;
        this._parser = _parser;
        this._parserClass = _parserClass;
        this.textModel = textModel;
        this._logService = _logService;
        this._telemetryService = _telemetryService;
        this._tree = observableValue(this, undefined);
        this.tree = this._tree;
        this._treeLastParsedVersion = observableValue(this, -1);
        this.treeLastParsedVersion = this._treeLastParsedVersion;
        this._onDidChangeContentQueue = new TaskQueue();
        this._tree = observableValue(this, undefined);
        this.tree = this._tree;
        this._register(toDisposable(() => {
            this._tree.get()?.delete();
            this._lastFullyParsed?.delete();
            this._lastFullyParsedWithEdits?.delete();
            this._parser.delete();
        }));
        this.handleContentChange(undefined, this._ranges);
    }
    handleContentChange(e, ranges) {
        const version = this.textModel.getVersionId();
        let newRanges = [];
        if (ranges) {
            newRanges = this._setRanges(ranges);
        }
        if (e) {
            this._applyEdits(e.changes);
        }
        this._onDidChangeContentQueue.clearPending();
        this._onDidChangeContentQueue.schedule(async () => {
            if (this._store.isDisposed) {
                // No need to continue the queue if we are disposed
                return;
            }
            const oldTree = this._lastFullyParsed;
            let changedNodes;
            if (this._lastFullyParsedWithEdits && this._lastFullyParsed) {
                changedNodes = this._findChangedNodes(this._lastFullyParsedWithEdits, this._lastFullyParsed);
            }
            const completed = await this._parseAndUpdateTree(version);
            if (completed) {
                let ranges;
                if (!changedNodes) {
                    if (this._ranges) {
                        ranges = this._ranges.map(r => ({ newRange: new Range(r.startPosition.row + 1, r.startPosition.column + 1, r.endPosition.row + 1, r.endPosition.column + 1), oldRangeLength: r.endIndex - r.startIndex, newRangeStartOffset: r.startIndex, newRangeEndOffset: r.endIndex }));
                    }
                }
                else if (oldTree && changedNodes) {
                    ranges = this._findTreeChanges(completed, changedNodes, newRanges);
                }
                if (!ranges) {
                    ranges = [{ newRange: this.textModel.getFullModelRange(), newRangeStartOffset: 0, newRangeEndOffset: this.textModel.getValueLength() }];
                }
                const previousTree = this._tree.get();
                transaction(tx => {
                    this._tree.set(completed, tx, { ranges, versionId: version });
                    this._treeLastParsedVersion.set(version, tx);
                });
                previousTree?.delete();
            }
        });
    }
    get ranges() {
        return this._ranges;
    }
    getInjectionTrees(startIndex, languageId) {
        // TODO
        return undefined;
    }
    _applyEdits(changes) {
        for (const change of changes) {
            const originalTextLength = TextLength.ofRange(Range.lift(change.range));
            const newTextLength = TextLength.ofText(change.text);
            const summedTextLengths = change.text.length === 0 ? newTextLength : originalTextLength.add(newTextLength);
            const edit = {
                startIndex: change.rangeOffset,
                oldEndIndex: change.rangeOffset + change.rangeLength,
                newEndIndex: change.rangeOffset + change.text.length,
                startPosition: { row: change.range.startLineNumber - 1, column: change.range.startColumn - 1 },
                oldEndPosition: { row: change.range.endLineNumber - 1, column: change.range.endColumn - 1 },
                newEndPosition: { row: change.range.startLineNumber + summedTextLengths.lineCount - 1, column: summedTextLengths.lineCount ? summedTextLengths.columnCount : (change.range.endColumn + summedTextLengths.columnCount) }
            };
            this._tree.get()?.edit(edit);
            this._lastFullyParsedWithEdits?.edit(edit);
        }
    }
    _findChangedNodes(newTree, oldTree) {
        if ((this._ranges && this._ranges.every(range => range.startPosition.row !== newTree.rootNode.startPosition.row)) || newTree.rootNode.startPosition.row !== 0) {
            return [];
        }
        const newCursor = newTree.walk();
        const oldCursor = oldTree.walk();
        const nodes = [];
        let next = true;
        do {
            if (newCursor.currentNode.hasChanges) {
                // Check if only one of the children has changes.
                // If it's only one, then we go to that child.
                // If it's more then, we need to go to each child
                // If it's none, then we've found one of our ranges
                const newChildren = newCursor.currentNode.children;
                const indexChangedChildren = [];
                const changedChildren = newChildren.filter((c, index) => {
                    if (c?.hasChanges || (oldCursor.currentNode.children.length <= index)) {
                        indexChangedChildren.push(index);
                        return true;
                    }
                    return false;
                });
                // If we have changes and we *had* an error, the whole node should be refreshed.
                if ((changedChildren.length === 0) || (newCursor.currentNode.hasError !== oldCursor.currentNode.hasError)) {
                    // walk up again until we get to the first one that's named as unnamed nodes can be too granular
                    while (newCursor.currentNode.parent && next && !newCursor.currentNode.isNamed) {
                        next = gotoParent(newCursor, oldCursor);
                    }
                    // Use the end position of the previous node and the start position of the current node
                    const newNode = newCursor.currentNode;
                    const closestPreviousNode = getClosestPreviousNodes(newCursor, newTree) ?? newNode;
                    nodes.push({
                        startIndex: closestPreviousNode.startIndex,
                        endIndex: newNode.endIndex,
                        startPosition: closestPreviousNode.startPosition,
                        endPosition: newNode.endPosition
                    });
                    next = nextSiblingOrParentSibling(newCursor, oldCursor);
                }
                else if (changedChildren.length >= 1) {
                    next = gotoNthChild(newCursor, oldCursor, indexChangedChildren[0]);
                }
            }
            else {
                next = nextSiblingOrParentSibling(newCursor, oldCursor);
            }
        } while (next);
        newCursor.delete();
        oldCursor.delete();
        return nodes;
    }
    _findTreeChanges(newTree, changedNodes, newRanges) {
        let newRangeIndex = 0;
        const mergedChanges = [];
        // Find the parent in the new tree of the changed node
        for (let nodeIndex = 0; nodeIndex < changedNodes.length; nodeIndex++) {
            const node = changedNodes[nodeIndex];
            if (mergedChanges.length > 0) {
                if ((node.startIndex >= mergedChanges[mergedChanges.length - 1].newRangeStartOffset) && (node.endIndex <= mergedChanges[mergedChanges.length - 1].newRangeEndOffset)) {
                    // This node is within the previous range, skip it
                    continue;
                }
            }
            const cursor = newTree.walk();
            const cursorContainersNode = () => cursor.startIndex < node.startIndex && cursor.endIndex > node.endIndex;
            while (cursorContainersNode()) {
                // See if we can go to a child
                let child = cursor.gotoFirstChild();
                let foundChild = false;
                while (child) {
                    if (cursorContainersNode() && cursor.currentNode.isNamed) {
                        foundChild = true;
                        break;
                    }
                    else {
                        child = cursor.gotoNextSibling();
                    }
                }
                if (!foundChild) {
                    cursor.gotoParent();
                    break;
                }
                if (cursor.currentNode.childCount === 0) {
                    break;
                }
            }
            const startPosition = cursor.currentNode.startPosition;
            const endPosition = cursor.currentNode.endPosition;
            const startIndex = cursor.currentNode.startIndex;
            const endIndex = cursor.currentNode.endIndex;
            const newChange = { newRange: new Range(startPosition.row + 1, startPosition.column + 1, endPosition.row + 1, endPosition.column + 1), newRangeStartOffset: startIndex, newRangeEndOffset: endIndex };
            if ((newRangeIndex < newRanges.length) && rangesIntersect(newRanges[newRangeIndex], { startIndex, endIndex, startPosition, endPosition })) {
                // combine the new change with the range
                if (newRanges[newRangeIndex].startIndex < newChange.newRangeStartOffset) {
                    newChange.newRange = newChange.newRange.setStartPosition(newRanges[newRangeIndex].startPosition.row + 1, newRanges[newRangeIndex].startPosition.column + 1);
                    newChange.newRangeStartOffset = newRanges[newRangeIndex].startIndex;
                }
                if (newRanges[newRangeIndex].endIndex > newChange.newRangeEndOffset) {
                    newChange.newRange = newChange.newRange.setEndPosition(newRanges[newRangeIndex].endPosition.row + 1, newRanges[newRangeIndex].endPosition.column + 1);
                    newChange.newRangeEndOffset = newRanges[newRangeIndex].endIndex;
                }
                newRangeIndex++;
            }
            else if (newRangeIndex < newRanges.length && newRanges[newRangeIndex].endIndex < newChange.newRangeStartOffset) {
                // add the full range to the merged changes
                mergedChanges.push({
                    newRange: new Range(newRanges[newRangeIndex].startPosition.row + 1, newRanges[newRangeIndex].startPosition.column + 1, newRanges[newRangeIndex].endPosition.row + 1, newRanges[newRangeIndex].endPosition.column + 1),
                    newRangeStartOffset: newRanges[newRangeIndex].startIndex,
                    newRangeEndOffset: newRanges[newRangeIndex].endIndex
                });
            }
            if ((mergedChanges.length > 0) && (mergedChanges[mergedChanges.length - 1].newRangeEndOffset >= newChange.newRangeStartOffset)) {
                // Merge the changes
                mergedChanges[mergedChanges.length - 1].newRange = Range.fromPositions(mergedChanges[mergedChanges.length - 1].newRange.getStartPosition(), newChange.newRange.getEndPosition());
                mergedChanges[mergedChanges.length - 1].newRangeEndOffset = newChange.newRangeEndOffset;
            }
            else {
                mergedChanges.push(newChange);
            }
        }
        return this._constrainRanges(mergedChanges);
    }
    _constrainRanges(changes) {
        if (!this._ranges) {
            return changes;
        }
        const constrainedChanges = [];
        let changesIndex = 0;
        let rangesIndex = 0;
        while (changesIndex < changes.length && rangesIndex < this._ranges.length) {
            const change = changes[changesIndex];
            const range = this._ranges[rangesIndex];
            if (change.newRangeEndOffset < range.startIndex) {
                // Change is before the range, move to the next change
                changesIndex++;
            }
            else if (change.newRangeStartOffset > range.endIndex) {
                // Change is after the range, move to the next range
                rangesIndex++;
            }
            else {
                // Change is within the range, constrain it
                const newRangeStartOffset = Math.max(change.newRangeStartOffset, range.startIndex);
                const newRangeEndOffset = Math.min(change.newRangeEndOffset, range.endIndex);
                const newRange = change.newRange.intersectRanges(new Range(range.startPosition.row + 1, range.startPosition.column + 1, range.endPosition.row + 1, range.endPosition.column + 1));
                constrainedChanges.push({
                    newRange,
                    newRangeEndOffset,
                    newRangeStartOffset
                });
                // Remove the intersected range from the current change
                if (newRangeEndOffset < change.newRangeEndOffset) {
                    change.newRange = Range.fromPositions(newRange.getEndPosition(), change.newRange.getEndPosition());
                    change.newRangeStartOffset = newRangeEndOffset + 1;
                }
                else {
                    // Move to the next change
                    changesIndex++;
                }
            }
        }
        return constrainedChanges;
    }
    async _parseAndUpdateTree(version) {
        const tree = await this._parse();
        if (tree) {
            this._lastFullyParsed?.delete();
            this._lastFullyParsed = tree.copy();
            this._lastFullyParsedWithEdits?.delete();
            this._lastFullyParsedWithEdits = tree.copy();
            return tree;
        }
        else if (!this._tree.get()) {
            // No tree means this is the initial parse and there were edits
            // parse function doesn't handle this well and we can end up with an incorrect tree, so we reset
            this._parser.reset();
        }
        return undefined;
    }
    _parse() {
        let parseType = "fullParse" /* TelemetryParseType.Full */;
        if (this._tree.get()) {
            parseType = "incrementalParse" /* TelemetryParseType.Incremental */;
        }
        return this._parseAndYield(parseType);
    }
    async _parseAndYield(parseType) {
        let time = 0;
        let passes = 0;
        const inProgressVersion = this.textModel.getVersionId();
        let newTree;
        const progressCallback = newTimeOutProgressCallback();
        do {
            const timer = performance.now();
            newTree = this._parser.parse((index, position) => this._parseCallback(index), this._tree.get(), { progressCallback, includedRanges: this._ranges });
            time += performance.now() - timer;
            passes++;
            // So long as this isn't the initial parse, even if the model changes and edits are applied, the tree parsing will continue correctly after the await.
            await new Promise(resolve => setTimeout0(resolve));
        } while (!this._store.isDisposed && !newTree && inProgressVersion === this.textModel.getVersionId());
        this._sendParseTimeTelemetry(parseType, time, passes);
        return (newTree && (inProgressVersion === this.textModel.getVersionId())) ? newTree : undefined;
    }
    _parseCallback(index) {
        try {
            return this.textModel.getTextBuffer().getNearestChunk(index);
        }
        catch (e) {
            this._logService.debug('Error getting chunk for tree-sitter parsing', e);
        }
        return undefined;
    }
    _setRanges(newRanges) {
        const unKnownRanges = [];
        // If we have existing ranges, find the parts of the new ranges that are not included in the existing ones
        if (this._ranges) {
            for (const newRange of newRanges) {
                let isFullyIncluded = false;
                for (let i = 0; i < this._ranges.length; i++) {
                    const existingRange = this._ranges[i];
                    if (rangesEqual(existingRange, newRange) || rangesIntersect(existingRange, newRange)) {
                        isFullyIncluded = true;
                        break;
                    }
                }
                if (!isFullyIncluded) {
                    unKnownRanges.push(newRange);
                }
            }
        }
        else {
            // No existing ranges, all new ranges are unknown
            unKnownRanges.push(...newRanges);
        }
        this._ranges = newRanges;
        return unKnownRanges;
    }
    _sendParseTimeTelemetry(parseType, time, passes) {
        this._logService.debug(`Tree parsing (${parseType}) took ${time} ms and ${passes} passes.`);
        if (parseType === "fullParse" /* TelemetryParseType.Full */) {
            this._telemetryService.publicLog2(`treeSitter.fullParse`, { languageId: this.languageId, time, passes });
        }
        else {
            this._telemetryService.publicLog2(`treeSitter.incrementalParse`, { languageId: this.languageId, time, passes });
        }
    }
    createParsedTreeSync(src) {
        const parser = new this._parserClass();
        parser.setLanguage(this._parser.language);
        const tree = parser.parse(src);
        parser.delete();
        return tree ?? undefined;
    }
};
TreeSitterTree = __decorate([
    __param(5, ILogService),
    __param(6, ITelemetryService)
], TreeSitterTree);
export { TreeSitterTree };
var TelemetryParseType;
(function (TelemetryParseType) {
    TelemetryParseType["Full"] = "fullParse";
    TelemetryParseType["Incremental"] = "incrementalParse";
})(TelemetryParseType || (TelemetryParseType = {}));
function newTimeOutProgressCallback() {
    let lastYieldTime = performance.now();
    return function parseProgressCallback(_state) {
        const now = performance.now();
        if (now - lastYieldTime > 50) {
            lastYieldTime = now;
            return true;
        }
        return false;
    };
}
export function rangesEqual(a, b) {
    return (a.startPosition.row === b.startPosition.row)
        && (a.startPosition.column === b.startPosition.column)
        && (a.endPosition.row === b.endPosition.row)
        && (a.endPosition.column === b.endPosition.column)
        && (a.startIndex === b.startIndex)
        && (a.endIndex === b.endIndex);
}
export function rangesIntersect(a, b) {
    return (a.startIndex <= b.startIndex && a.endIndex >= b.startIndex) ||
        (b.startIndex <= a.startIndex && b.endIndex >= a.startIndex);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJlZVNpdHRlclRyZWUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi9tb2RlbC90b2tlbnMvdHJlZVNpdHRlci90cmVlU2l0dGVyVHJlZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFLQSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNuRixPQUFPLEVBQWUsZUFBZSxFQUFFLFdBQVcsRUFBeUIsTUFBTSwwQ0FBMEMsQ0FBQztBQUM1SCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDckUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUk5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLHVCQUF1QixFQUFFLDBCQUEwQixFQUFFLFlBQVksRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ2pILE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUV4QyxJQUFNLGNBQWMsR0FBcEIsTUFBTSxjQUFlLFNBQVEsVUFBVTtJQWE3QyxZQUNpQixVQUFrQixFQUMxQixPQUF1QztJQUMvQyx5Q0FBeUM7SUFDekMsa0NBQWtDO0lBQ2pCLE9BQTBCLEVBQzFCLFlBQXNDO0lBQ3ZELHNEQUFzRDtJQUN0QyxTQUFvQixFQUN2QixXQUF5QyxFQUNuQyxpQkFBcUQ7UUFFeEUsS0FBSyxFQUFFLENBQUM7UUFYUSxlQUFVLEdBQVYsVUFBVSxDQUFRO1FBQzFCLFlBQU8sR0FBUCxPQUFPLENBQWdDO1FBRzlCLFlBQU8sR0FBUCxPQUFP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LGtCQUdWO0FBSEQsV0FBVyxrQkFBa0I7SUFDNUIsd0NBQWtCLENBQUE7SUFDbEIsc0RBQWdDLENBQUE7QUFDakMsQ0FBQyxFQUhVLGtCQUFrQixLQUFsQixrQkFBa0IsUUFHNUI7QUFtQkQsU0FBUywwQkFBMEI7SUFDbEMsSUFBSSxhQUFhLEdBQVcsV0FBVyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQzlDLE9BQU8sU0FBUyxxQkFBcUIsQ0FBQyxNQUE2QjtRQUNsRSxNQUFNLEdBQUcsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDOUIsSUFBSSxHQUFHLEdBQUcsYUFBYSxHQUFHLEVBQUUsRUFBRSxDQUFDO1lBQzlCLGFBQWEsR0FBRyxHQUFHLENBQUM7WUFDcEIsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDLENBQUM7QUFDSCxDQUFDO0FBQ0QsTUFBTSxVQUFVLFdBQVcsQ0FBQyxDQUFtQixFQUFFLENBQW1CO0lBQ25FLE9BQU8sQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQztXQUNoRCxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDO1dBQ25ELENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUM7V0FDekMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQztXQUMvQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEtBQUssQ0FBQyxDQUFDLFVBQVUsQ0FBQztXQUMvQixDQUFDLENBQUMsQ0FBQyxRQUFRLEtBQUssQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ2pDLENBQUM7QUFFRCxNQUFNLFVBQVUsZUFBZSxDQUFDLENBQW1CLEVBQUUsQ0FBbUI7SUFDdkUsT0FBTyxDQUFDLENBQUMsQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDLFVBQVUsSUFBSSxDQUFDLENBQUMsUUFBUSxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUM7UUFDbEUsQ0FBQyxDQUFDLENBQUMsVUFBVSxJQUFJLENBQUMsQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDL0QsQ0FBQyJ9