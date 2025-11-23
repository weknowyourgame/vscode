/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class Node {
    static { this.Undefined = new Node(undefined); }
    constructor(element) {
        this.element = element;
        this.next = Node.Undefined;
        this.prev = Node.Undefined;
    }
}
export class LinkedList {
    constructor() {
        this._first = Node.Undefined;
        this._last = Node.Undefined;
        this._size = 0;
    }
    get size() {
        return this._size;
    }
    isEmpty() {
        return this._first === Node.Undefined;
    }
    clear() {
        let node = this._first;
        while (node !== Node.Undefined) {
            const next = node.next;
            node.prev = Node.Undefined;
            node.next = Node.Undefined;
            node = next;
        }
        this._first = Node.Undefined;
        this._last = Node.Undefined;
        this._size = 0;
    }
    unshift(element) {
        return this._insert(element, false);
    }
    push(element) {
        return this._insert(element, true);
    }
    _insert(element, atTheEnd) {
        const newNode = new Node(element);
        if (this._first === Node.Undefined) {
            this._first = newNode;
            this._last = newNode;
        }
        else if (atTheEnd) {
            // push
            const oldLast = this._last;
            this._last = newNode;
            newNode.prev = oldLast;
            oldLast.next = newNode;
        }
        else {
            // unshift
            const oldFirst = this._first;
            this._first = newNode;
            newNode.next = oldFirst;
            oldFirst.prev = newNode;
        }
        this._size += 1;
        let didRemove = false;
        return () => {
            if (!didRemove) {
                didRemove = true;
                this._remove(newNode);
            }
        };
    }
    shift() {
        if (this._first === Node.Undefined) {
            return undefined;
        }
        else {
            const res = this._first.element;
            this._remove(this._first);
            return res;
        }
    }
    pop() {
        if (this._last === Node.Undefined) {
            return undefined;
        }
        else {
            const res = this._last.element;
            this._remove(this._last);
            return res;
        }
    }
    peek() {
        if (this._last === Node.Undefined) {
            return undefined;
        }
        else {
            const res = this._last.element;
            return res;
        }
    }
    _remove(node) {
        if (node.prev !== Node.Undefined && node.next !== Node.Undefined) {
            // middle
            const anchor = node.prev;
            anchor.next = node.next;
            node.next.prev = anchor;
        }
        else if (node.prev === Node.Undefined && node.next === Node.Undefined) {
            // only node
            this._first = Node.Undefined;
            this._last = Node.Undefined;
        }
        else if (node.next === Node.Undefined) {
            // last
            this._last = this._last.prev;
            this._last.next = Node.Undefined;
        }
        else if (node.prev === Node.Undefined) {
            // first
            this._first = this._first.next;
            this._first.prev = Node.Undefined;
        }
        // done
        this._size -= 1;
    }
    *[Symbol.iterator]() {
        let node = this._first;
        while (node !== Node.Undefined) {
            yield node.element;
            node = node.next;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlua2VkTGlzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi9saW5rZWRMaXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE1BQU0sSUFBSTthQUVPLGNBQVMsR0FBRyxJQUFJLElBQUksQ0FBVSxTQUFTLENBQUMsQ0FBQztJQU16RCxZQUFZLE9BQVU7UUFDckIsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdkIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQzNCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUM1QixDQUFDOztBQUdGLE1BQU0sT0FBTyxVQUFVO0lBQXZCO1FBRVMsV0FBTSxHQUFvQyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ3pELFVBQUssR0FBb0MsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUN4RCxVQUFLLEdBQVcsQ0FBQyxDQUFDO0lBOEgzQixDQUFDO0lBNUhBLElBQUksSUFBSTtRQUNQLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNuQixDQUFDO0lBRUQsT0FBTztRQUNOLE9BQU8sSUFBSSxDQUFDLE1BQU0sS0FBSyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ3ZDLENBQUM7SUFFRCxLQUFLO1FBQ0osSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUN2QixPQUFPLElBQUksS0FBSyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztZQUN2QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDM0IsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO1lBQzNCLElBQUksR0FBRyxJQUFJLENBQUM7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