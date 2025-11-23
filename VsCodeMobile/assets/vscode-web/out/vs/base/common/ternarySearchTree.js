/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { shuffle } from './arrays.js';
import { assert } from './assert.js';
import { compare, compareIgnoreCase, compareSubstring, compareSubstringIgnoreCase } from './strings.js';
export class StringIterator {
    constructor() {
        this._value = '';
        this._pos = 0;
    }
    reset(key) {
        this._value = key;
        this._pos = 0;
        return this;
    }
    next() {
        this._pos += 1;
        return this;
    }
    hasNext() {
        return this._pos < this._value.length - 1;
    }
    cmp(a) {
        const aCode = a.charCodeAt(0);
        const thisCode = this._value.charCodeAt(this._pos);
        return aCode - thisCode;
    }
    value() {
        return this._value[this._pos];
    }
}
export class ConfigKeysIterator {
    constructor(_caseSensitive = true) {
        this._caseSensitive = _caseSensitive;
    }
    reset(key) {
        this._value = key;
        this._from = 0;
        this._to = 0;
        return this.next();
    }
    hasNext() {
        return this._to < this._value.length;
    }
    next() {
        // this._data = key.split(/[\\/]/).filter(s => !!s);
        this._from = this._to;
        let justSeps = true;
        for (; this._to < this._value.length; this._to++) {
            const ch = this._value.charCodeAt(this._to);
            if (ch === 46 /* CharCode.Period */) {
                if (justSeps) {
                    this._from++;
                }
                else {
                    break;
                }
            }
            else {
                justSeps = false;
            }
        }
        return this;
    }
    cmp(a) {
        return this._caseSensitive
            ? compareSubstring(a, this._value, 0, a.length, this._from, this._to)
            : compareSubstringIgnoreCase(a, this._value, 0, a.length, this._from, this._to);
    }
    value() {
        return this._value.substring(this._from, this._to);
    }
}
export class PathIterator {
    constructor(_splitOnBackslash = true, _caseSensitive = true) {
        this._splitOnBackslash = _splitOnBackslash;
        this._caseSensitive = _caseSensitive;
    }
    reset(key) {
        this._from = 0;
        this._to = 0;
        this._value = key;
        this._valueLen = key.length;
        for (let pos = key.length - 1; pos >= 0; pos--, this._valueLen--) {
            const ch = this._value.charCodeAt(pos);
            if (!(ch === 47 /* CharCode.Slash */ || this._splitOnBackslash && ch === 92 /* CharCode.Backslash */)) {
                break;
            }
        }
        return this.next();
    }
    hasNext() {
        return this._to < this._valueLen;
    }
    next() {
        // this._data = key.split(/[\\/]/).filter(s => !!s);
        this._from = this._to;
        let justSeps = true;
        for (; this._to < this._valueLen; this._to++) {
            const ch = this._value.charCodeAt(this._to);
            if (ch === 47 /* CharCode.Slash */ || this._splitOnBackslash && ch === 92 /* CharCode.Backslash */) {
                if (justSeps) {
                    this._from++;
                }
                else {
                    break;
                }
            }
            else {
                justSeps = false;
            }
        }
        return this;
    }
    cmp(a) {
        return this._caseSensitive
            ? compareSubstring(a, this._value, 0, a.length, this._from, this._to)
            : compareSubstringIgnoreCase(a, this._value, 0, a.length, this._from, this._to);
    }
    value() {
        return this._value.substring(this._from, this._to);
    }
}
var UriIteratorState;
(function (UriIteratorState) {
    UriIteratorState[UriIteratorState["Scheme"] = 1] = "Scheme";
    UriIteratorState[UriIteratorState["Authority"] = 2] = "Authority";
    UriIteratorState[UriIteratorState["Path"] = 3] = "Path";
    UriIteratorState[UriIteratorState["Query"] = 4] = "Query";
    UriIteratorState[UriIteratorState["Fragment"] = 5] = "Fragment";
})(UriIteratorState || (UriIteratorState = {}));
export class UriIterator {
    constructor(_ignorePathCasing, _ignoreQueryAndFragment) {
        this._ignorePathCasing = _ignorePathCasing;
        this._ignoreQueryAndFragment = _ignoreQueryAndFragment;
        this._states = [];
        this._stateIdx = 0;
    }
    reset(key) {
        this._value = key;
        this._states = [];
        if (this._value.scheme) {
            this._states.push(1 /* UriIteratorState.Scheme */);
        }
        if (this._value.authority) {
            this._states.push(2 /* UriIteratorState.Authority */);
        }
        if (this._value.path) {
            this._pathIterator = new PathIterator(false, !this._ignorePathCasing(key));
            this._pathIterator.reset(key.path);
            if (this._pathIterator.value()) {
                this._states.push(3 /* UriIteratorState.Path */);
            }
        }
        if (!this._ignoreQueryAndFragment(key)) {
            if (this._value.query) {
                this._states.push(4 /* UriIteratorState.Query */);
            }
            if (this._value.fragment) {
                this._states.push(5 /* UriIteratorState.Fragment */);
            }
        }
        this._stateIdx = 0;
        return this;
    }
    next() {
        if (this._states[this._stateIdx] === 3 /* UriIteratorState.Path */ && this._pathIterator.hasNext()) {
            this._pathIterator.next();
        }
        else {
            this._stateIdx += 1;
        }
        return this;
    }
    hasNext() {
        return (this._states[this._stateIdx] === 3 /* UriIteratorState.Path */ && this._pathIterator.hasNext())
            || this._stateIdx < this._states.length - 1;
    }
    cmp(a) {
        if (this._states[this._stateIdx] === 1 /* UriIteratorState.Scheme */) {
            return compareIgnoreCase(a, this._value.scheme);
        }
        else if (this._states[this._stateIdx] === 2 /* UriIteratorState.Authority */) {
            return compareIgnoreCase(a, this._value.authority);
        }
        else if (this._states[this._stateIdx] === 3 /* UriIteratorState.Path */) {
            return this._pathIterator.cmp(a);
        }
        else if (this._states[this._stateIdx] === 4 /* UriIteratorState.Query */) {
            return compare(a, this._value.query);
        }
        else if (this._states[this._stateIdx] === 5 /* UriIteratorState.Fragment */) {
            return compare(a, this._value.fragment);
        }
        throw new Error();
    }
    value() {
        if (this._states[this._stateIdx] === 1 /* UriIteratorState.Scheme */) {
            return this._value.scheme;
        }
        else if (this._states[this._stateIdx] === 2 /* UriIteratorState.Authority */) {
            return this._value.authority;
        }
        else if (this._states[this._stateIdx] === 3 /* UriIteratorState.Path */) {
            return this._pathIterator.value();
        }
        else if (this._states[this._stateIdx] === 4 /* UriIteratorState.Query */) {
            return this._value.query;
        }
        else if (this._states[this._stateIdx] === 5 /* UriIteratorState.Fragment */) {
            return this._value.fragment;
        }
        throw new Error();
    }
}
class Undef {
    static { this.Val = Symbol('undefined_placeholder'); }
    static wrap(value) {
        return value === undefined ? Undef.Val : value;
    }
    static unwrap(value) {
        return value === Undef.Val ? undefined : value;
    }
}
class TernarySearchTreeNode {
    constructor() {
        this.height = 1;
        this.value = undefined;
        this.key = undefined;
        this.left = undefined;
        this.mid = undefined;
        this.right = undefined;
    }
    isEmpty() {
        return !this.left && !this.mid && !this.right && this.value === undefined;
    }
    rotateLeft() {
        const tmp = this.right;
        this.right = tmp.left;
        tmp.left = this;
        this.updateHeight();
        tmp.updateHeight();
        return tmp;
    }
    rotateRight() {
        const tmp = this.left;
        this.left = tmp.right;
        tmp.right = this;
        this.updateHeight();
        tmp.updateHeight();
        return tmp;
    }
    updateHeight() {
        this.height = 1 + Math.max(this.heightLeft, this.heightRight);
    }
    balanceFactor() {
        return this.heightRight - this.heightLeft;
    }
    get heightLeft() {
        return this.left?.height ?? 0;
    }
    get heightRight() {
        return this.right?.height ?? 0;
    }
}
var Dir;
(function (Dir) {
    Dir[Dir["Left"] = -1] = "Left";
    Dir[Dir["Mid"] = 0] = "Mid";
    Dir[Dir["Right"] = 1] = "Right";
})(Dir || (Dir = {}));
export class TernarySearchTree {
    static forUris(ignorePathCasing = () => false, ignoreQueryAndFragment = () => false) {
        return new TernarySearchTree(new UriIterator(ignorePathCasing, ignoreQueryAndFragment));
    }
    static forPaths(ignorePathCasing = false) {
        return new TernarySearchTree(new PathIterator(undefined, !ignorePathCasing));
    }
    static forStrings() {
        return new TernarySearchTree(new StringIterator());
    }
    static forConfigKeys() {
        return new TernarySearchTree(new ConfigKeysIterator());
    }
    constructor(segments) {
        this._iter = segments;
    }
    clear() {
        this._root = undefined;
    }
    fill(values, keys) {
        if (keys) {
            const arr = keys.slice(0);
            shuffle(arr);
            for (const k of arr) {
                this.set(k, values);
            }
        }
        else {
            const arr = values.slice(0);
            shuffle(arr);
            for (const entry of arr) {
                this.set(entry[0], entry[1]);
            }
        }
    }
    set(key, element) {
        const iter = this._iter.reset(key);
        let node;
        if (!this._root) {
            this._root = new TernarySearchTreeNode();
            this._root.segment = iter.value();
        }
        const stack = [];
        // find insert_node
        node = this._root;
        while (true) {
            const val = iter.cmp(node.segment);
            if (val > 0) {
                // left
                if (!node.left) {
                    node.left = new TernarySearchTreeNode();
                    node.left.segment = iter.value();
                }
                stack.push([-1 /* Dir.Left */, node]);
                node = node.left;
            }
            else if (val < 0) {
                // right
                if (!node.right) {
                    node.right = new TernarySearchTreeNode();
                    node.right.segment = iter.value();
                }
                stack.push([1 /* Dir.Right */, node]);
                node = node.right;
            }
            else if (iter.hasNext()) {
                // mid
                iter.next();
                if (!node.mid) {
                    node.mid = new TernarySearchTreeNode();
                    node.mid.segment = iter.value();
                }
                stack.push([0 /* Dir.Mid */, node]);
                node = node.mid;
            }
            else {
                break;
            }
        }
        // set value
        const oldElement = Undef.unwrap(node.value);
        node.value = Undef.wrap(element);
        node.key = key;
        // balance
        for (let i = stack.length - 1; i >= 0; i--) {
            const node = stack[i][1];
            node.updateHeight();
            const bf = node.balanceFactor();
            if (bf < -1 || bf > 1) {
                // needs rotate
                const d1 = stack[i][0];
                const d2 = stack[i + 1][0];
                if (d1 === 1 /* Dir.Right */ && d2 === 1 /* Dir.Right */) {
                    //right, right -> rotate left
                    stack[i][1] = node.rotateLeft();
                }
                else if (d1 === -1 /* Dir.Left */ && d2 === -1 /* Dir.Left */) {
                    // left, left -> rotate right
                    stack[i][1] = node.rotateRight();
                }
                else if (d1 === 1 /* Dir.Right */ && d2 === -1 /* Dir.Left */) {
                    // right, left -> double rotate right, left
                    node.right = stack[i + 1][1] = stack[i + 1][1].rotateRight();
                    stack[i][1] = node.rotateLeft();
                }
                else if (d1 === -1 /* Dir.Left */ && d2 === 1 /* Dir.Right */) {
                    // left, right -> double rotate left, right
                    node.left = stack[i + 1][1] = stack[i + 1][1].rotateLeft();
                    stack[i][1] = node.rotateRight();
                }
                else {
                    throw new Error();
                }
                // patch path to parent
                if (i > 0) {
                    switch (stack[i - 1][0]) {
                        case -1 /* Dir.Left */:
                            stack[i - 1][1].left = stack[i][1];
                            break;
                        case 1 /* Dir.Right */:
                            stack[i - 1][1].right = stack[i][1];
                            break;
                        case 0 /* Dir.Mid */:
                            stack[i - 1][1].mid = stack[i][1];
                            break;
                    }
                }
                else {
                    this._root = stack[0][1];
                }
            }
        }
        return oldElement;
    }
    get(key) {
        return Undef.unwrap(this._getNode(key)?.value);
    }
    _getNode(key) {
        const iter = this._iter.reset(key);
        let node = this._root;
        while (node) {
            const val = iter.cmp(node.segment);
            if (val > 0) {
                // left
                node = node.left;
            }
            else if (val < 0) {
                // right
                node = node.right;
            }
            else if (iter.hasNext()) {
                // mid
                iter.next();
                node = node.mid;
            }
            else {
                break;
            }
        }
        return node;
    }
    has(key) {
        const node = this._getNode(key);
        return !(node?.value === undefined && node?.mid === undefined);
    }
    delete(key) {
        return this._delete(key, false);
    }
    deleteSuperstr(key) {
        return this._delete(key, true);
    }
    _delete(key, superStr) {
        const iter = this._iter.reset(key);
        const stack = [];
        let node = this._root;
        // find node
        while (node) {
            const val = iter.cmp(node.segment);
            if (val > 0) {
                // left
                stack.push([-1 /* Dir.Left */, node]);
                node = node.left;
            }
            else if (val < 0) {
                // right
                stack.push([1 /* Dir.Right */, node]);
                node = node.right;
            }
            else if (iter.hasNext()) {
                // mid
                iter.next();
                stack.push([0 /* Dir.Mid */, node]);
                node = node.mid;
            }
            else {
                break;
            }
        }
        if (!node) {
            // node not found
            return;
        }
        if (superStr) {
            // removing children, reset height
            node.left = undefined;
            node.mid = undefined;
            node.right = undefined;
            node.height = 1;
        }
        else {
            // removing element
            node.key = undefined;
            node.value = undefined;
        }
        // BST node removal
        if (!node.mid && !node.value) {
            if (node.left && node.right) {
                // full node
                // replace deleted-node with the min-node of the right branch.
                // If there is no true min-node leave things as they are
                const stack2 = [[1 /* Dir.Right */, node]];
                const min = this._min(node.right, stack2);
                if (min.key) {
                    node.key = min.key;
                    node.value = min.value;
                    node.segment = min.segment;
                    // remove NODE (inorder successor can only have right child)
                    const newChild = min.right;
                    if (stack2.length > 1) {
                        const [dir, parent] = stack2[stack2.length - 1];
                        switch (dir) {
                            case -1 /* Dir.Left */:
                                parent.left = newChild;
                                break;
                            case 0 /* Dir.Mid */: assert(false);
                            case 1 /* Dir.Right */: assert(false);
                        }
                    }
                    else {
                        node.right = newChild;
                    }
                    // balance right branch and UPDATE parent pointer for stack
                    const newChild2 = this._balanceByStack(stack2);
                    if (stack.length > 0) {
                        const [dir, parent] = stack[stack.length - 1];
                        switch (dir) {
                            case -1 /* Dir.Left */:
                                parent.left = newChild2;
                                break;
                            case 0 /* Dir.Mid */:
                                parent.mid = newChild2;
                                break;
                            case 1 /* Dir.Right */:
                                parent.right = newChild2;
                                break;
                        }
                    }
                    else {
                        this._root = newChild2;
                    }
                }
            }
            else {
                // empty or half empty
                const newChild = node.left ?? node.right;
                if (stack.length > 0) {
                    const [dir, parent] = stack[stack.length - 1];
                    switch (dir) {
                        case -1 /* Dir.Left */:
                            parent.left = newChild;
                            break;
                        case 0 /* Dir.Mid */:
                            parent.mid = newChild;
                            break;
                        case 1 /* Dir.Right */:
                            parent.right = newChild;
                            break;
                    }
                }
                else {
                    this._root = newChild;
                }
            }
        }
        // AVL balance
        this._root = this._balanceByStack(stack) ?? this._root;
    }
    _min(node, stack) {
        while (node.left) {
            stack.push([-1 /* Dir.Left */, node]);
            node = node.left;
        }
        return node;
    }
    _balanceByStack(stack) {
        for (let i = stack.length - 1; i >= 0; i--) {
            const node = stack[i][1];
            node.updateHeight();
            const bf = node.balanceFactor();
            if (bf > 1) {
                // right heavy
                if (node.right.balanceFactor() >= 0) {
                    // right, right -> rotate left
                    stack[i][1] = node.rotateLeft();
                }
                else {
                    // right, left -> double rotate
                    node.right = node.right.rotateRight();
                    stack[i][1] = node.rotateLeft();
                }
            }
            else if (bf < -1) {
                // left heavy
                if (node.left.balanceFactor() <= 0) {
                    // left, left -> rotate right
                    stack[i][1] = node.rotateRight();
                }
                else {
                    // left, right -> double rotate
                    node.left = node.left.rotateLeft();
                    stack[i][1] = node.rotateRight();
                }
            }
            // patch path to parent
            if (i > 0) {
                switch (stack[i - 1][0]) {
                    case -1 /* Dir.Left */:
                        stack[i - 1][1].left = stack[i][1];
                        break;
                    case 1 /* Dir.Right */:
                        stack[i - 1][1].right = stack[i][1];
                        break;
                    case 0 /* Dir.Mid */:
                        stack[i - 1][1].mid = stack[i][1];
                        break;
                }
            }
            else {
                return stack[0][1];
            }
        }
        return undefined;
    }
    findSubstr(key) {
        const iter = this._iter.reset(key);
        let node = this._root;
        let candidate = undefined;
        while (node) {
            const val = iter.cmp(node.segment);
            if (val > 0) {
                // left
                node = node.left;
            }
            else if (val < 0) {
                // right
                node = node.right;
            }
            else if (iter.hasNext()) {
                // mid
                iter.next();
                candidate = Undef.unwrap(node.value) || candidate;
                node = node.mid;
            }
            else {
                break;
            }
        }
        return node && Undef.unwrap(node.value) || candidate;
    }
    findSuperstr(key) {
        return this._findSuperstrOrElement(key, false);
    }
    _findSuperstrOrElement(key, allowValue) {
        const iter = this._iter.reset(key);
        let node = this._root;
        while (node) {
            const val = iter.cmp(node.segment);
            if (val > 0) {
                // left
                node = node.left;
            }
            else if (val < 0) {
                // right
                node = node.right;
            }
            else if (iter.hasNext()) {
                // mid
                iter.next();
                node = node.mid;
            }
            else {
                // collect
                if (!node.mid) {
                    if (allowValue) {
                        return Undef.unwrap(node.value);
                    }
                    else {
                        return undefined;
                    }
                }
                else {
                    return this._entries(node.mid);
                }
            }
        }
        return undefined;
    }
    hasElementOrSubtree(key) {
        return this._findSuperstrOrElement(key, true) !== undefined;
    }
    forEach(callback) {
        for (const [key, value] of this) {
            callback(value, key);
        }
    }
    *[Symbol.iterator]() {
        yield* this._entries(this._root);
    }
    _entries(node) {
        const result = [];
        this._dfsEntries(node, result);
        return result[Symbol.iterator]();
    }
    _dfsEntries(node, bucket) {
        // DFS
        if (!node) {
            return;
        }
        if (node.left) {
            this._dfsEntries(node.left, bucket);
        }
        if (node.value !== undefined) {
            bucket.push([node.key, Undef.unwrap(node.value)]);
        }
        if (node.mid) {
            this._dfsEntries(node.mid, bucket);
        }
        if (node.right) {
            this._dfsEntries(node.right, bucket);
        }
    }
    // for debug/testing
    _isBalanced() {
        const nodeIsBalanced = (node) => {
            if (!node) {
                return true;
            }
            const bf = node.balanceFactor();
            if (bf < -1 || bf > 1) {
                return false;
            }
            return nodeIsBalanced(node.left) && nodeIsBalanced(node.right);
        };
        return nodeIsBalanced(this._root);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybmFyeVNlYXJjaFRyZWUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vdGVybmFyeVNlYXJjaFRyZWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUN0QyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBRXJDLE9BQU8sRUFBRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFZeEcsTUFBTSxPQUFPLGNBQWM7SUFBM0I7UUFFUyxXQUFNLEdBQVcsRUFBRSxDQUFDO1FBQ3BCLFNBQUksR0FBVyxDQUFDLENBQUM7SUEwQjFCLENBQUM7SUF4QkEsS0FBSyxDQUFDLEdBQVc7UUFDaEIsSUFBSSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUM7UUFDbEIsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7UUFDZCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxJQUFJO1FBQ0gsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUM7UUFDZixPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxPQUFPO1FBQ04sT0FBTyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBRUQsR0FBRyxDQUFDLENBQVM7UUFDWixNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRCxPQUFPLEtBQUssR0FBRyxRQUFRLENBQUM7SUFD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