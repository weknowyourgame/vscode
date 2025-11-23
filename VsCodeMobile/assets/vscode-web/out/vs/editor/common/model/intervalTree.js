/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
//
// The red-black tree is based on the "Introduction to Algorithms" by Cormen, Leiserson and Rivest.
//
export var ClassName;
(function (ClassName) {
    ClassName["EditorHintDecoration"] = "squiggly-hint";
    ClassName["EditorInfoDecoration"] = "squiggly-info";
    ClassName["EditorWarningDecoration"] = "squiggly-warning";
    ClassName["EditorErrorDecoration"] = "squiggly-error";
    ClassName["EditorUnnecessaryDecoration"] = "squiggly-unnecessary";
    ClassName["EditorUnnecessaryInlineDecoration"] = "squiggly-inline-unnecessary";
    ClassName["EditorDeprecatedInlineDecoration"] = "squiggly-inline-deprecated";
})(ClassName || (ClassName = {}));
export var NodeColor;
(function (NodeColor) {
    NodeColor[NodeColor["Black"] = 0] = "Black";
    NodeColor[NodeColor["Red"] = 1] = "Red";
})(NodeColor || (NodeColor = {}));
var Constants;
(function (Constants) {
    Constants[Constants["ColorMask"] = 1] = "ColorMask";
    Constants[Constants["ColorMaskInverse"] = 254] = "ColorMaskInverse";
    Constants[Constants["ColorOffset"] = 0] = "ColorOffset";
    Constants[Constants["IsVisitedMask"] = 2] = "IsVisitedMask";
    Constants[Constants["IsVisitedMaskInverse"] = 253] = "IsVisitedMaskInverse";
    Constants[Constants["IsVisitedOffset"] = 1] = "IsVisitedOffset";
    Constants[Constants["IsForValidationMask"] = 4] = "IsForValidationMask";
    Constants[Constants["IsForValidationMaskInverse"] = 251] = "IsForValidationMaskInverse";
    Constants[Constants["IsForValidationOffset"] = 2] = "IsForValidationOffset";
    Constants[Constants["StickinessMask"] = 24] = "StickinessMask";
    Constants[Constants["StickinessMaskInverse"] = 231] = "StickinessMaskInverse";
    Constants[Constants["StickinessOffset"] = 3] = "StickinessOffset";
    Constants[Constants["CollapseOnReplaceEditMask"] = 32] = "CollapseOnReplaceEditMask";
    Constants[Constants["CollapseOnReplaceEditMaskInverse"] = 223] = "CollapseOnReplaceEditMaskInverse";
    Constants[Constants["CollapseOnReplaceEditOffset"] = 5] = "CollapseOnReplaceEditOffset";
    Constants[Constants["IsMarginMask"] = 64] = "IsMarginMask";
    Constants[Constants["IsMarginMaskInverse"] = 191] = "IsMarginMaskInverse";
    Constants[Constants["IsMarginOffset"] = 6] = "IsMarginOffset";
    Constants[Constants["AffectsFontMask"] = 128] = "AffectsFontMask";
    Constants[Constants["AffectsFontMaskInverse"] = 127] = "AffectsFontMaskInverse";
    Constants[Constants["AffectsFontOffset"] = 7] = "AffectsFontOffset";
    /**
     * Due to how deletion works (in order to avoid always walking the right subtree of the deleted node),
     * the deltas for nodes can grow and shrink dramatically. It has been observed, in practice, that unless
     * the deltas are corrected, integer overflow will occur.
     *
     * The integer overflow occurs when 53 bits are used in the numbers, but we will try to avoid it as
     * a node's delta gets below a negative 30 bits number.
     *
     * MIN SMI (SMall Integer) as defined in v8.
     * one bit is lost for boxing/unboxing flag.
     * one bit is lost for sign flag.
     * See https://thibaultlaurens.github.io/javascript/2013/04/29/how-the-v8-engine-works/#tagged-values
     */
    Constants[Constants["MIN_SAFE_DELTA"] = -1073741824] = "MIN_SAFE_DELTA";
    /**
     * MAX SMI (SMall Integer) as defined in v8.
     * one bit is lost for boxing/unboxing flag.
     * one bit is lost for sign flag.
     * See https://thibaultlaurens.github.io/javascript/2013/04/29/how-the-v8-engine-works/#tagged-values
     */
    Constants[Constants["MAX_SAFE_DELTA"] = 1073741824] = "MAX_SAFE_DELTA";
})(Constants || (Constants = {}));
export function getNodeColor(node) {
    return ((node.metadata & 1 /* Constants.ColorMask */) >>> 0 /* Constants.ColorOffset */);
}
function setNodeColor(node, color) {
    node.metadata = ((node.metadata & 254 /* Constants.ColorMaskInverse */) | (color << 0 /* Constants.ColorOffset */));
}
function getNodeIsVisited(node) {
    return ((node.metadata & 2 /* Constants.IsVisitedMask */) >>> 1 /* Constants.IsVisitedOffset */) === 1;
}
function setNodeIsVisited(node, value) {
    node.metadata = ((node.metadata & 253 /* Constants.IsVisitedMaskInverse */) | ((value ? 1 : 0) << 1 /* Constants.IsVisitedOffset */));
}
function getNodeIsForValidation(node) {
    return ((node.metadata & 4 /* Constants.IsForValidationMask */) >>> 2 /* Constants.IsForValidationOffset */) === 1;
}
function setNodeIsForValidation(node, value) {
    node.metadata = ((node.metadata & 251 /* Constants.IsForValidationMaskInverse */) | ((value ? 1 : 0) << 2 /* Constants.IsForValidationOffset */));
}
function getNodeIsInGlyphMargin(node) {
    return ((node.metadata & 64 /* Constants.IsMarginMask */) >>> 6 /* Constants.IsMarginOffset */) === 1;
}
function setNodeIsInGlyphMargin(node, value) {
    node.metadata = ((node.metadata & 191 /* Constants.IsMarginMaskInverse */) | ((value ? 1 : 0) << 6 /* Constants.IsMarginOffset */));
}
function getNodeAffectsFont(node) {
    return ((node.metadata & 128 /* Constants.AffectsFontMask */) >>> 7 /* Constants.AffectsFontOffset */) === 1;
}
function setNodeAffectsFont(node, value) {
    node.metadata = ((node.metadata & 127 /* Constants.AffectsFontMaskInverse */) | ((value ? 1 : 0) << 7 /* Constants.AffectsFontOffset */));
}
function getNodeStickiness(node) {
    return ((node.metadata & 24 /* Constants.StickinessMask */) >>> 3 /* Constants.StickinessOffset */);
}
function _setNodeStickiness(node, stickiness) {
    node.metadata = ((node.metadata & 231 /* Constants.StickinessMaskInverse */) | (stickiness << 3 /* Constants.StickinessOffset */));
}
function getCollapseOnReplaceEdit(node) {
    return ((node.metadata & 32 /* Constants.CollapseOnReplaceEditMask */) >>> 5 /* Constants.CollapseOnReplaceEditOffset */) === 1;
}
function setCollapseOnReplaceEdit(node, value) {
    node.metadata = ((node.metadata & 223 /* Constants.CollapseOnReplaceEditMaskInverse */) | ((value ? 1 : 0) << 5 /* Constants.CollapseOnReplaceEditOffset */));
}
export function setNodeStickiness(node, stickiness) {
    _setNodeStickiness(node, stickiness);
}
export class IntervalNode {
    constructor(id, start, end) {
        this.metadata = 0;
        this.parent = this;
        this.left = this;
        this.right = this;
        setNodeColor(this, 1 /* NodeColor.Red */);
        this.start = start;
        this.end = end;
        // FORCE_OVERFLOWING_TEST: this.delta = start;
        this.delta = 0;
        this.maxEnd = end;
        this.id = id;
        this.ownerId = 0;
        this.options = null;
        setNodeIsForValidation(this, false);
        setNodeIsInGlyphMargin(this, false);
        _setNodeStickiness(this, 1 /* TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges */);
        setCollapseOnReplaceEdit(this, false);
        setNodeAffectsFont(this, false);
        this.cachedVersionId = 0;
        this.cachedAbsoluteStart = start;
        this.cachedAbsoluteEnd = end;
        this.range = null;
        setNodeIsVisited(this, false);
    }
    reset(versionId, start, end, range) {
        this.start = start;
        this.end = end;
        this.maxEnd = end;
        this.cachedVersionId = versionId;
        this.cachedAbsoluteStart = start;
        this.cachedAbsoluteEnd = end;
        this.range = range;
    }
    setOptions(options) {
        this.options = options;
        const className = this.options.className;
        setNodeIsForValidation(this, (className === "squiggly-error" /* ClassName.EditorErrorDecoration */
            || className === "squiggly-warning" /* ClassName.EditorWarningDecoration */
            || className === "squiggly-info" /* ClassName.EditorInfoDecoration */));
        setNodeIsInGlyphMargin(this, this.options.glyphMarginClassName !== null);
        _setNodeStickiness(this, this.options.stickiness);
        setCollapseOnReplaceEdit(this, this.options.collapseOnReplaceEdit);
        setNodeAffectsFont(this, this.options.affectsFont ?? false);
    }
    setCachedOffsets(absoluteStart, absoluteEnd, cachedVersionId) {
        if (this.cachedVersionId !== cachedVersionId) {
            this.range = null;
        }
        this.cachedVersionId = cachedVersionId;
        this.cachedAbsoluteStart = absoluteStart;
        this.cachedAbsoluteEnd = absoluteEnd;
    }
    detach() {
        this.parent = null;
        this.left = null;
        this.right = null;
    }
}
export const SENTINEL = new IntervalNode(null, 0, 0);
SENTINEL.parent = SENTINEL;
SENTINEL.left = SENTINEL;
SENTINEL.right = SENTINEL;
setNodeColor(SENTINEL, 0 /* NodeColor.Black */);
export class IntervalTree {
    constructor() {
        this.root = SENTINEL;
        this.requestNormalizeDelta = false;
    }
    intervalSearch(start, end, filterOwnerId, filterOutValidation, filterFontDecorations, cachedVersionId, onlyMarginDecorations) {
        if (this.root === SENTINEL) {
            return [];
        }
        return intervalSearch(this, start, end, filterOwnerId, filterOutValidation, filterFontDecorations, cachedVersionId, onlyMarginDecorations);
    }
    search(filterOwnerId, filterOutValidation, filterFontDecorations, cachedVersionId, onlyMarginDecorations) {
        if (this.root === SENTINEL) {
            return [];
        }
        return search(this, filterOwnerId, filterOutValidation, filterFontDecorations, cachedVersionId, onlyMarginDecorations);
    }
    /**
     * Will not set `cachedAbsoluteStart` nor `cachedAbsoluteEnd` on the returned nodes!
     */
    collectNodesFromOwner(ownerId) {
        return collectNodesFromOwner(this, ownerId);
    }
    /**
     * Will not set `cachedAbsoluteStart` nor `cachedAbsoluteEnd` on the returned nodes!
     */
    collectNodesPostOrder() {
        return collectNodesPostOrder(this);
    }
    insert(node) {
        rbTreeInsert(this, node);
        this._normalizeDeltaIfNecessary();
    }
    delete(node) {
        rbTreeDelete(this, node);
        this._normalizeDeltaIfNecessary();
    }
    resolveNode(node, cachedVersionId) {
        const initialNode = node;
        let delta = 0;
        while (node !== this.root) {
            if (node === node.parent.right) {
                delta += node.parent.delta;
            }
            node = node.parent;
        }
        const nodeStart = initialNode.start + delta;
        const nodeEnd = initialNode.end + delta;
        initialNode.setCachedOffsets(nodeStart, nodeEnd, cachedVersionId);
    }
    acceptReplace(offset, length, textLength, forceMoveMarkers) {
        // Our strategy is to remove all directly impacted nodes, and then add them back to the tree.
        // (1) collect all nodes that are intersecting this edit as nodes of interest
        const nodesOfInterest = searchForEditing(this, offset, offset + length);
        // (2) remove all nodes that are intersecting this edit
        for (let i = 0, len = nodesOfInterest.length; i < len; i++) {
            const node = nodesOfInterest[i];
            rbTreeDelete(this, node);
        }
        this._normalizeDeltaIfNecessary();
        // (3) edit all tree nodes except the nodes of interest
        noOverlapReplace(this, offset, offset + length, textLength);
        this._normalizeDeltaIfNecessary();
        // (4) edit the nodes of interest and insert them back in the tree
        for (let i = 0, len = nodesOfInterest.length; i < len; i++) {
            const node = nodesOfInterest[i];
            node.start = node.cachedAbsoluteStart;
            node.end = node.cachedAbsoluteEnd;
            nodeAcceptEdit(node, offset, (offset + length), textLength, forceMoveMarkers);
            node.maxEnd = node.end;
            rbTreeInsert(this, node);
        }
        this._normalizeDeltaIfNecessary();
    }
    getAllInOrder() {
        return search(this, 0, false, false, 0, false);
    }
    _normalizeDeltaIfNecessary() {
        if (!this.requestNormalizeDelta) {
            return;
        }
        this.requestNormalizeDelta = false;
        normalizeDelta(this);
    }
}
//#region Delta Normalization
function normalizeDelta(T) {
    let node = T.root;
    let delta = 0;
    while (node !== SENTINEL) {
        if (node.left !== SENTINEL && !getNodeIsVisited(node.left)) {
            // go left
            node = node.left;
            continue;
        }
        if (node.right !== SENTINEL && !getNodeIsVisited(node.right)) {
            // go right
            delta += node.delta;
            node = node.right;
            continue;
        }
        // handle current node
        node.start = delta + node.start;
        node.end = delta + node.end;
        node.delta = 0;
        recomputeMaxEnd(node);
        setNodeIsVisited(node, true);
        // going up from this node
        setNodeIsVisited(node.left, false);
        setNodeIsVisited(node.right, false);
        if (node === node.parent.right) {
            delta -= node.parent.delta;
        }
        node = node.parent;
    }
    setNodeIsVisited(T.root, false);
}
//#endregion
//#region Editing
var MarkerMoveSemantics;
(function (MarkerMoveSemantics) {
    MarkerMoveSemantics[MarkerMoveSemantics["MarkerDefined"] = 0] = "MarkerDefined";
    MarkerMoveSemantics[MarkerMoveSemantics["ForceMove"] = 1] = "ForceMove";
    MarkerMoveSemantics[MarkerMoveSemantics["ForceStay"] = 2] = "ForceStay";
})(MarkerMoveSemantics || (MarkerMoveSemantics = {}));
function adjustMarkerBeforeColumn(markerOffset, markerStickToPreviousCharacter, checkOffset, moveSemantics) {
    if (markerOffset < checkOffset) {
        return true;
    }
    if (markerOffset > checkOffset) {
        return false;
    }
    if (moveSemantics === 1 /* MarkerMoveSemantics.ForceMove */) {
        return false;
    }
    if (moveSemantics === 2 /* MarkerMoveSemantics.ForceStay */) {
        return true;
    }
    return markerStickToPreviousCharacter;
}
/**
 * This is a lot more complicated than strictly necessary to maintain the same behaviour
 * as when decorations were implemented using two markers.
 */
export function nodeAcceptEdit(node, start, end, textLength, forceMoveMarkers) {
    const nodeStickiness = getNodeStickiness(node);
    const startStickToPreviousCharacter = (nodeStickiness === 0 /* TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges */
        || nodeStickiness === 2 /* TrackedRangeStickiness.GrowsOnlyWhenTypingBefore */);
    const endStickToPreviousCharacter = (nodeStickiness === 1 /* TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges */
        || nodeStickiness === 2 /* TrackedRangeStickiness.GrowsOnlyWhenTypingBefore */);
    const deletingCnt = (end - start);
    const insertingCnt = textLength;
    const commonLength = Math.min(deletingCnt, insertingCnt);
    const nodeStart = node.start;
    let startDone = false;
    const nodeEnd = node.end;
    let endDone = false;
    if (start <= nodeStart && nodeEnd <= end && getCollapseOnReplaceEdit(node)) {
        // This edit encompasses the entire decoration range
        // and the decoration has asked to become collapsed
        node.start = start;
        startDone = true;
        node.end = start;
        endDone = true;
    }
    {
        const moveSemantics = forceMoveMarkers ? 1 /* MarkerMoveSemantics.ForceMove */ : (deletingCnt > 0 ? 2 /* MarkerMoveSemantics.ForceStay */ : 0 /* MarkerMoveSemantics.MarkerDefined */);
        if (!startDone && adjustMarkerBeforeColumn(nodeStart, startStickToPreviousCharacter, start, moveSemantics)) {
            startDone = true;
        }
        if (!endDone && adjustMarkerBeforeColumn(nodeEnd, endStickToPreviousCharacter, start, moveSemantics)) {
            endDone = true;
        }
    }
    if (commonLength > 0 && !forceMoveMarkers) {
        const moveSemantics = (deletingCnt > insertingCnt ? 2 /* MarkerMoveSemantics.ForceStay */ : 0 /* MarkerMoveSemantics.MarkerDefined */);
        if (!startDone && adjustMarkerBeforeColumn(nodeStart, startStickToPreviousCharacter, start + commonLength, moveSemantics)) {
            startDone = true;
        }
        if (!endDone && adjustMarkerBeforeColumn(nodeEnd, endStickToPreviousCharacter, start + commonLength, moveSemantics)) {
            endDone = true;
        }
    }
    {
        const moveSemantics = forceMoveMarkers ? 1 /* MarkerMoveSemantics.ForceMove */ : 0 /* MarkerMoveSemantics.MarkerDefined */;
        if (!startDone && adjustMarkerBeforeColumn(nodeStart, startStickToPreviousCharacter, end, moveSemantics)) {
            node.start = start + insertingCnt;
            startDone = true;
        }
        if (!endDone && adjustMarkerBeforeColumn(nodeEnd, endStickToPreviousCharacter, end, moveSemantics)) {
            node.end = start + insertingCnt;
            endDone = true;
        }
    }
    // Finish
    const deltaColumn = (insertingCnt - deletingCnt);
    if (!startDone) {
        node.start = Math.max(0, nodeStart + deltaColumn);
    }
    if (!endDone) {
        node.end = Math.max(0, nodeEnd + deltaColumn);
    }
    if (node.start > node.end) {
        node.end = node.start;
    }
}
function searchForEditing(T, start, end) {
    // https://en.wikipedia.org/wiki/Interval_tree#Augmented_tree
    // Now, it is known that two intervals A and B overlap only when both
    // A.low <= B.high and A.high >= B.low. When searching the trees for
    // nodes overlapping with a given interval, you can immediately skip:
    //  a) all nodes to the right of nodes whose low value is past the end of the given interval.
    //  b) all nodes that have their maximum 'high' value below the start of the given interval.
    let node = T.root;
    let delta = 0;
    let nodeMaxEnd = 0;
    let nodeStart = 0;
    let nodeEnd = 0;
    const result = [];
    let resultLen = 0;
    while (node !== SENTINEL) {
        if (getNodeIsVisited(node)) {
            // going up from this node
            setNodeIsVisited(node.left, false);
            setNodeIsVisited(node.right, false);
            if (node === node.parent.right) {
                delta -= node.parent.delta;
            }
            node = node.parent;
            continue;
        }
        if (!getNodeIsVisited(node.left)) {
            // first time seeing this node
            nodeMaxEnd = delta + node.maxEnd;
            if (nodeMaxEnd < start) {
                // cover case b) from above
                // there is no need to search this node or its children
                setNodeIsVisited(node, true);
                continue;
            }
            if (node.left !== SENTINEL) {
                // go left
                node = node.left;
                continue;
            }
        }
        // handle current node
        nodeStart = delta + node.start;
        if (nodeStart > end) {
            // cover case a) from above
            // there is no need to search this node or its right subtree
            setNodeIsVisited(node, true);
            continue;
        }
        nodeEnd = delta + node.end;
        if (nodeEnd >= start) {
            node.setCachedOffsets(nodeStart, nodeEnd, 0);
            result[resultLen++] = node;
        }
        setNodeIsVisited(node, true);
        if (node.right !== SENTINEL && !getNodeIsVisited(node.right)) {
            // go right
            delta += node.delta;
            node = node.right;
            continue;
        }
    }
    setNodeIsVisited(T.root, false);
    return result;
}
function noOverlapReplace(T, start, end, textLength) {
    // https://en.wikipedia.org/wiki/Interval_tree#Augmented_tree
    // Now, it is known that two intervals A and B overlap only when both
    // A.low <= B.high and A.high >= B.low. When searching the trees for
    // nodes overlapping with a given interval, you can immediately skip:
    //  a) all nodes to the right of nodes whose low value is past the end of the given interval.
    //  b) all nodes that have their maximum 'high' value below the start of the given interval.
    let node = T.root;
    let delta = 0;
    let nodeMaxEnd = 0;
    let nodeStart = 0;
    const editDelta = (textLength - (end - start));
    while (node !== SENTINEL) {
        if (getNodeIsVisited(node)) {
            // going up from this node
            setNodeIsVisited(node.left, false);
            setNodeIsVisited(node.right, false);
            if (node === node.parent.right) {
                delta -= node.parent.delta;
            }
            recomputeMaxEnd(node);
            node = node.parent;
            continue;
        }
        if (!getNodeIsVisited(node.left)) {
            // first time seeing this node
            nodeMaxEnd = delta + node.maxEnd;
            if (nodeMaxEnd < start) {
                // cover case b) from above
                // there is no need to search this node or its children
                setNodeIsVisited(node, true);
                continue;
            }
            if (node.left !== SENTINEL) {
                // go left
                node = node.left;
                continue;
            }
        }
        // handle current node
        nodeStart = delta + node.start;
        if (nodeStart > end) {
            node.start += editDelta;
            node.end += editDelta;
            node.delta += editDelta;
            if (node.delta < -1073741824 /* Constants.MIN_SAFE_DELTA */ || node.delta > 1073741824 /* Constants.MAX_SAFE_DELTA */) {
                T.requestNormalizeDelta = true;
            }
            // cover case a) from above
            // there is no need to search this node or its right subtree
            setNodeIsVisited(node, true);
            continue;
        }
        setNodeIsVisited(node, true);
        if (node.right !== SENTINEL && !getNodeIsVisited(node.right)) {
            // go right
            delta += node.delta;
            node = node.right;
            continue;
        }
    }
    setNodeIsVisited(T.root, false);
}
//#endregion
//#region Searching
function collectNodesFromOwner(T, ownerId) {
    let node = T.root;
    const result = [];
    let resultLen = 0;
    while (node !== SENTINEL) {
        if (getNodeIsVisited(node)) {
            // going up from this node
            setNodeIsVisited(node.left, false);
            setNodeIsVisited(node.right, false);
            node = node.parent;
            continue;
        }
        if (node.left !== SENTINEL && !getNodeIsVisited(node.left)) {
            // go left
            node = node.left;
            continue;
        }
        // handle current node
        if (node.ownerId === ownerId) {
            result[resultLen++] = node;
        }
        setNodeIsVisited(node, true);
        if (node.right !== SENTINEL && !getNodeIsVisited(node.right)) {
            // go right
            node = node.right;
            continue;
        }
    }
    setNodeIsVisited(T.root, false);
    return result;
}
function collectNodesPostOrder(T) {
    let node = T.root;
    const result = [];
    let resultLen = 0;
    while (node !== SENTINEL) {
        if (getNodeIsVisited(node)) {
            // going up from this node
            setNodeIsVisited(node.left, false);
            setNodeIsVisited(node.right, false);
            node = node.parent;
            continue;
        }
        if (node.left !== SENTINEL && !getNodeIsVisited(node.left)) {
            // go left
            node = node.left;
            continue;
        }
        if (node.right !== SENTINEL && !getNodeIsVisited(node.right)) {
            // go right
            node = node.right;
            continue;
        }
        // handle current node
        result[resultLen++] = node;
        setNodeIsVisited(node, true);
    }
    setNodeIsVisited(T.root, false);
    return result;
}
function search(T, filterOwnerId, filterOutValidation, filterFontDecorations, cachedVersionId, onlyMarginDecorations) {
    let node = T.root;
    let delta = 0;
    let nodeStart = 0;
    let nodeEnd = 0;
    const result = [];
    let resultLen = 0;
    while (node !== SENTINEL) {
        if (getNodeIsVisited(node)) {
            // going up from this node
            setNodeIsVisited(node.left, false);
            setNodeIsVisited(node.right, false);
            if (node === node.parent.right) {
                delta -= node.parent.delta;
            }
            node = node.parent;
            continue;
        }
        if (node.left !== SENTINEL && !getNodeIsVisited(node.left)) {
            // go left
            node = node.left;
            continue;
        }
        // handle current node
        nodeStart = delta + node.start;
        nodeEnd = delta + node.end;
        node.setCachedOffsets(nodeStart, nodeEnd, cachedVersionId);
        let include = true;
        if (filterOwnerId && node.ownerId && node.ownerId !== filterOwnerId) {
            include = false;
        }
        if (filterOutValidation && getNodeIsForValidation(node)) {
            include = false;
        }
        if (filterFontDecorations && getNodeAffectsFont(node)) {
            include = false;
        }
        if (onlyMarginDecorations && !getNodeIsInGlyphMargin(node)) {
            include = false;
        }
        if (include) {
            result[resultLen++] = node;
        }
        setNodeIsVisited(node, true);
        if (node.right !== SENTINEL && !getNodeIsVisited(node.right)) {
            // go right
            delta += node.delta;
            node = node.right;
            continue;
        }
    }
    setNodeIsVisited(T.root, false);
    return result;
}
function intervalSearch(T, intervalStart, intervalEnd, filterOwnerId, filterOutValidation, filterFontDecorations, cachedVersionId, onlyMarginDecorations) {
    // https://en.wikipedia.org/wiki/Interval_tree#Augmented_tree
    // Now, it is known that two intervals A and B overlap only when both
    // A.low <= B.high and A.high >= B.low. When searching the trees for
    // nodes overlapping with a given interval, you can immediately skip:
    //  a) all nodes to the right of nodes whose low value is past the end of the given interval.
    //  b) all nodes that have their maximum 'high' value below the start of the given interval.
    let node = T.root;
    let delta = 0;
    let nodeMaxEnd = 0;
    let nodeStart = 0;
    let nodeEnd = 0;
    const result = [];
    let resultLen = 0;
    while (node !== SENTINEL) {
        if (getNodeIsVisited(node)) {
            // going up from this node
            setNodeIsVisited(node.left, false);
            setNodeIsVisited(node.right, false);
            if (node === node.parent.right) {
                delta -= node.parent.delta;
            }
            node = node.parent;
            continue;
        }
        if (!getNodeIsVisited(node.left)) {
            // first time seeing this node
            nodeMaxEnd = delta + node.maxEnd;
            if (nodeMaxEnd < intervalStart) {
                // cover case b) from above
                // there is no need to search this node or its children
                setNodeIsVisited(node, true);
                continue;
            }
            if (node.left !== SENTINEL) {
                // go left
                node = node.left;
                continue;
            }
        }
        // handle current node
        nodeStart = delta + node.start;
        if (nodeStart > intervalEnd) {
            // cover case a) from above
            // there is no need to search this node or its right subtree
            setNodeIsVisited(node, true);
            continue;
        }
        nodeEnd = delta + node.end;
        if (nodeEnd >= intervalStart) {
            // There is overlap
            node.setCachedOffsets(nodeStart, nodeEnd, cachedVersionId);
            let include = true;
            if (filterOwnerId && node.ownerId && node.ownerId !== filterOwnerId) {
                include = false;
            }
            if (filterOutValidation && getNodeIsForValidation(node)) {
                include = false;
            }
            if (filterFontDecorations && getNodeAffectsFont(node)) {
                include = false;
            }
            if (onlyMarginDecorations && !getNodeIsInGlyphMargin(node)) {
                include = false;
            }
            if (include) {
                result[resultLen++] = node;
            }
        }
        setNodeIsVisited(node, true);
        if (node.right !== SENTINEL && !getNodeIsVisited(node.right)) {
            // go right
            delta += node.delta;
            node = node.right;
            continue;
        }
    }
    setNodeIsVisited(T.root, false);
    return result;
}
//#endregion
//#region Insertion
function rbTreeInsert(T, newNode) {
    if (T.root === SENTINEL) {
        newNode.parent = SENTINEL;
        newNode.left = SENTINEL;
        newNode.right = SENTINEL;
        setNodeColor(newNode, 0 /* NodeColor.Black */);
        T.root = newNode;
        return T.root;
    }
    treeInsert(T, newNode);
    recomputeMaxEndWalkToRoot(newNode.parent);
    // repair tree
    let x = newNode;
    while (x !== T.root && getNodeColor(x.parent) === 1 /* NodeColor.Red */) {
        if (x.parent === x.parent.parent.left) {
            const y = x.parent.parent.right;
            if (getNodeColor(y) === 1 /* NodeColor.Red */) {
                setNodeColor(x.parent, 0 /* NodeColor.Black */);
                setNodeColor(y, 0 /* NodeColor.Black */);
                setNodeColor(x.parent.parent, 1 /* NodeColor.Red */);
                x = x.parent.parent;
            }
            else {
                if (x === x.parent.right) {
                    x = x.parent;
                    leftRotate(T, x);
                }
                setNodeColor(x.parent, 0 /* NodeColor.Black */);
                setNodeColor(x.parent.parent, 1 /* NodeColor.Red */);
                rightRotate(T, x.parent.parent);
            }
        }
        else {
            const y = x.parent.parent.left;
            if (getNodeColor(y) === 1 /* NodeColor.Red */) {
                setNodeColor(x.parent, 0 /* NodeColor.Black */);
                setNodeColor(y, 0 /* NodeColor.Black */);
                setNodeColor(x.parent.parent, 1 /* NodeColor.Red */);
                x = x.parent.parent;
            }
            else {
                if (x === x.parent.left) {
                    x = x.parent;
                    rightRotate(T, x);
                }
                setNodeColor(x.parent, 0 /* NodeColor.Black */);
                setNodeColor(x.parent.parent, 1 /* NodeColor.Red */);
                leftRotate(T, x.parent.parent);
            }
        }
    }
    setNodeColor(T.root, 0 /* NodeColor.Black */);
    return newNode;
}
function treeInsert(T, z) {
    let delta = 0;
    let x = T.root;
    const zAbsoluteStart = z.start;
    const zAbsoluteEnd = z.end;
    while (true) {
        const cmp = intervalCompare(zAbsoluteStart, zAbsoluteEnd, x.start + delta, x.end + delta);
        if (cmp < 0) {
            // this node should be inserted to the left
            // => it is not affected by the node's delta
            if (x.left === SENTINEL) {
                z.start -= delta;
                z.end -= delta;
                z.maxEnd -= delta;
                x.left = z;
                break;
            }
            else {
                x = x.left;
            }
        }
        else {
            // this node should be inserted to the right
            // => it is not affected by the node's delta
            if (x.right === SENTINEL) {
                z.start -= (delta + x.delta);
                z.end -= (delta + x.delta);
                z.maxEnd -= (delta + x.delta);
                x.right = z;
                break;
            }
            else {
                delta += x.delta;
                x = x.right;
            }
        }
    }
    z.parent = x;
    z.left = SENTINEL;
    z.right = SENTINEL;
    setNodeColor(z, 1 /* NodeColor.Red */);
}
//#endregion
//#region Deletion
function rbTreeDelete(T, z) {
    let x;
    let y;
    // RB-DELETE except we don't swap z and y in case c)
    // i.e. we always delete what's pointed at by z.
    if (z.left === SENTINEL) {
        x = z.right;
        y = z;
        // x's delta is no longer influenced by z's delta
        x.delta += z.delta;
        if (x.delta < -1073741824 /* Constants.MIN_SAFE_DELTA */ || x.delta > 1073741824 /* Constants.MAX_SAFE_DELTA */) {
            T.requestNormalizeDelta = true;
        }
        x.start += z.delta;
        x.end += z.delta;
    }
    else if (z.right === SENTINEL) {
        x = z.left;
        y = z;
    }
    else {
        y = leftest(z.right);
        x = y.right;
        // y's delta is no longer influenced by z's delta,
        // but we don't want to walk the entire right-hand-side subtree of x.
        // we therefore maintain z's delta in y, and adjust only x
        x.start += y.delta;
        x.end += y.delta;
        x.delta += y.delta;
        if (x.delta < -1073741824 /* Constants.MIN_SAFE_DELTA */ || x.delta > 1073741824 /* Constants.MAX_SAFE_DELTA */) {
            T.requestNormalizeDelta = true;
        }
        y.start += z.delta;
        y.end += z.delta;
        y.delta = z.delta;
        if (y.delta < -1073741824 /* Constants.MIN_SAFE_DELTA */ || y.delta > 1073741824 /* Constants.MAX_SAFE_DELTA */) {
            T.requestNormalizeDelta = true;
        }
    }
    if (y === T.root) {
        T.root = x;
        setNodeColor(x, 0 /* NodeColor.Black */);
        z.detach();
        resetSentinel();
        recomputeMaxEnd(x);
        T.root.parent = SENTINEL;
        return;
    }
    const yWasRed = (getNodeColor(y) === 1 /* NodeColor.Red */);
    if (y === y.parent.left) {
        y.parent.left = x;
    }
    else {
        y.parent.right = x;
    }
    if (y === z) {
        x.parent = y.parent;
    }
    else {
        if (y.parent === z) {
            x.parent = y;
        }
        else {
            x.parent = y.parent;
        }
        y.left = z.left;
        y.right = z.right;
        y.parent = z.parent;
        setNodeColor(y, getNodeColor(z));
        if (z === T.root) {
            T.root = y;
        }
        else {
            if (z === z.parent.left) {
                z.parent.left = y;
            }
            else {
                z.parent.right = y;
            }
        }
        if (y.left !== SENTINEL) {
            y.left.parent = y;
        }
        if (y.right !== SENTINEL) {
            y.right.parent = y;
        }
    }
    z.detach();
    if (yWasRed) {
        recomputeMaxEndWalkToRoot(x.parent);
        if (y !== z) {
            recomputeMaxEndWalkToRoot(y);
            recomputeMaxEndWalkToRoot(y.parent);
        }
        resetSentinel();
        return;
    }
    recomputeMaxEndWalkToRoot(x);
    recomputeMaxEndWalkToRoot(x.parent);
    if (y !== z) {
        recomputeMaxEndWalkToRoot(y);
        recomputeMaxEndWalkToRoot(y.parent);
    }
    // RB-DELETE-FIXUP
    let w;
    while (x !== T.root && getNodeColor(x) === 0 /* NodeColor.Black */) {
        if (x === x.parent.left) {
            w = x.parent.right;
            if (getNodeColor(w) === 1 /* NodeColor.Red */) {
                setNodeColor(w, 0 /* NodeColor.Black */);
                setNodeColor(x.parent, 1 /* NodeColor.Red */);
                leftRotate(T, x.parent);
                w = x.parent.right;
            }
            if (getNodeColor(w.left) === 0 /* NodeColor.Black */ && getNodeColor(w.right) === 0 /* NodeColor.Black */) {
                setNodeColor(w, 1 /* NodeColor.Red */);
                x = x.parent;
            }
            else {
                if (getNodeColor(w.right) === 0 /* NodeColor.Black */) {
                    setNodeColor(w.left, 0 /* NodeColor.Black */);
                    setNodeColor(w, 1 /* NodeColor.Red */);
                    rightRotate(T, w);
                    w = x.parent.right;
                }
                setNodeColor(w, getNodeColor(x.parent));
                setNodeColor(x.parent, 0 /* NodeColor.Black */);
                setNodeColor(w.right, 0 /* NodeColor.Black */);
                leftRotate(T, x.parent);
                x = T.root;
            }
        }
        else {
            w = x.parent.left;
            if (getNodeColor(w) === 1 /* NodeColor.Red */) {
                setNodeColor(w, 0 /* NodeColor.Black */);
                setNodeColor(x.parent, 1 /* NodeColor.Red */);
                rightRotate(T, x.parent);
                w = x.parent.left;
            }
            if (getNodeColor(w.left) === 0 /* NodeColor.Black */ && getNodeColor(w.right) === 0 /* NodeColor.Black */) {
                setNodeColor(w, 1 /* NodeColor.Red */);
                x = x.parent;
            }
            else {
                if (getNodeColor(w.left) === 0 /* NodeColor.Black */) {
                    setNodeColor(w.right, 0 /* NodeColor.Black */);
                    setNodeColor(w, 1 /* NodeColor.Red */);
                    leftRotate(T, w);
                    w = x.parent.left;
                }
                setNodeColor(w, getNodeColor(x.parent));
                setNodeColor(x.parent, 0 /* NodeColor.Black */);
                setNodeColor(w.left, 0 /* NodeColor.Black */);
                rightRotate(T, x.parent);
                x = T.root;
            }
        }
    }
    setNodeColor(x, 0 /* NodeColor.Black */);
    resetSentinel();
}
function leftest(node) {
    while (node.left !== SENTINEL) {
        node = node.left;
    }
    return node;
}
function resetSentinel() {
    SENTINEL.parent = SENTINEL;
    SENTINEL.delta = 0; // optional
    SENTINEL.start = 0; // optional
    SENTINEL.end = 0; // optional
}
//#endregion
//#region Rotations
function leftRotate(T, x) {
    const y = x.right; // set y.
    y.delta += x.delta; // y's delta is no longer influenced by x's delta
    if (y.delta < -1073741824 /* Constants.MIN_SAFE_DELTA */ || y.delta > 1073741824 /* Constants.MAX_SAFE_DELTA */) {
        T.requestNormalizeDelta = true;
    }
    y.start += x.delta;
    y.end += x.delta;
    x.right = y.left; // turn y's left subtree into x's right subtree.
    if (y.left !== SENTINEL) {
        y.left.parent = x;
    }
    y.parent = x.parent; // link x's parent to y.
    if (x.parent === SENTINEL) {
        T.root = y;
    }
    else if (x === x.parent.left) {
        x.parent.left = y;
    }
    else {
        x.parent.right = y;
    }
    y.left = x; // put x on y's left.
    x.parent = y;
    recomputeMaxEnd(x);
    recomputeMaxEnd(y);
}
function rightRotate(T, y) {
    const x = y.left;
    y.delta -= x.delta;
    if (y.delta < -1073741824 /* Constants.MIN_SAFE_DELTA */ || y.delta > 1073741824 /* Constants.MAX_SAFE_DELTA */) {
        T.requestNormalizeDelta = true;
    }
    y.start -= x.delta;
    y.end -= x.delta;
    y.left = x.right;
    if (x.right !== SENTINEL) {
        x.right.parent = y;
    }
    x.parent = y.parent;
    if (y.parent === SENTINEL) {
        T.root = x;
    }
    else if (y === y.parent.right) {
        y.parent.right = x;
    }
    else {
        y.parent.left = x;
    }
    x.right = y;
    y.parent = x;
    recomputeMaxEnd(y);
    recomputeMaxEnd(x);
}
//#endregion
//#region max end computation
function computeMaxEnd(node) {
    let maxEnd = node.end;
    if (node.left !== SENTINEL) {
        const leftMaxEnd = node.left.maxEnd;
        if (leftMaxEnd > maxEnd) {
            maxEnd = leftMaxEnd;
        }
    }
    if (node.right !== SENTINEL) {
        const rightMaxEnd = node.right.maxEnd + node.delta;
        if (rightMaxEnd > maxEnd) {
            maxEnd = rightMaxEnd;
        }
    }
    return maxEnd;
}
export function recomputeMaxEnd(node) {
    node.maxEnd = computeMaxEnd(node);
}
function recomputeMaxEndWalkToRoot(node) {
    while (node !== SENTINEL) {
        const maxEnd = computeMaxEnd(node);
        if (node.maxEnd === maxEnd) {
            // no need to go further
            return;
        }
        node.maxEnd = maxEnd;
        node = node.parent;
    }
}
//#endregion
//#region utils
export function intervalCompare(aStart, aEnd, bStart, bEnd) {
    if (aStart === bStart) {
        return aEnd - bEnd;
    }
    return aStart - bStart;
}
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJ2YWxUcmVlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb21tb24vbW9kZWwvaW50ZXJ2YWxUcmVlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBTWhHLEVBQUU7QUFDRixtR0FBbUc7QUFDbkcsRUFBRTtBQUVGLE1BQU0sQ0FBTixJQUFrQixTQVFqQjtBQVJELFdBQWtCLFNBQVM7SUFDMUIsbURBQXNDLENBQUE7SUFDdEMsbURBQXNDLENBQUE7SUFDdEMseURBQTRDLENBQUE7SUFDNUMscURBQXdDLENBQUE7SUFDeEMsaUVBQW9ELENBQUE7SUFDcEQsOEVBQWlFLENBQUE7SUFDakUsNEVBQStELENBQUE7QUFDaEUsQ0FBQyxFQVJpQixTQUFTLEtBQVQsU0FBUyxRQVExQjtBQUVELE1BQU0sQ0FBTixJQUFrQixTQUdqQjtBQUhELFdBQWtCLFNBQVM7SUFDMUIsMkNBQVMsQ0FBQTtJQUNULHVDQUFPLENBQUE7QUFDUixDQUFDLEVBSGlCLFNBQVMsS0FBVCxTQUFTLFFBRzFCO0FBRUQsSUFBVyxTQWtEVjtBQWxERCxXQUFXLFNBQVM7SUFDbkIsbURBQXNCLENBQUE7SUFDdEIsbUVBQTZCLENBQUE7SUFDN0IsdURBQWUsQ0FBQTtJQUVmLDJEQUEwQixDQUFBO0lBQzFCLDJFQUFpQyxDQUFBO0lBQ2pDLCtEQUFtQixDQUFBO0lBRW5CLHVFQUFnQyxDQUFBO0lBQ2hDLHVGQUF1QyxDQUFBO0lBQ3ZDLDJFQUF5QixDQUFBO0lBRXpCLDhEQUEyQixDQUFBO0lBQzNCLDZFQUFrQyxDQUFBO0lBQ2xDLGlFQUFvQixDQUFBO0lBRXBCLG9GQUFzQyxDQUFBO0lBQ3RDLG1HQUE2QyxDQUFBO0lBQzdDLHVGQUErQixDQUFBO0lBRS9CLDBEQUF5QixDQUFBO0lBQ3pCLHlFQUFnQyxDQUFBO0lBQ2hDLDZEQUFrQixDQUFBO0lBRWxCLGlFQUE0QixDQUFB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