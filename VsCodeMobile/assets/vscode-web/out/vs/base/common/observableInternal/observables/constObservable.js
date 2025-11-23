/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ConvenientObservable } from './baseObservable.js';
/**
 * Represents an efficient observable whose value never changes.
 */
export function constObservable(value) {
    return new ConstObservable(value);
}
class ConstObservable extends ConvenientObservable {
    constructor(value) {
        super();
        this.value = value;
    }
    get debugName() {
        return this.toString();
    }
    get() {
        return this.value;
    }
    addObserver(observer) {
        // NO OP
    }
    removeObserver(observer) {
        // NO OP
    }
    log() {
        return this;
    }
    toString() {
        return `Const: ${this.value}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RPYnNlcnZhYmxlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvY29tbW9uL29ic2VydmFibGVJbnRlcm5hbC9vYnNlcnZhYmxlcy9jb25zdE9ic2VydmFibGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFFM0Q7O0dBRUc7QUFFSCxNQUFNLFVBQVUsZUFBZSxDQUFJLEtBQVE7SUFDMUMsT0FBTyxJQUFJLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNuQyxDQUFDO0FBQ0QsTUFBTSxlQUFtQixTQUFRLG9CQUE2QjtJQUM3RCxZQUE2QixLQUFRO1FBQ3BDLEtBQUssRUFBRSxDQUFDO1FBRG9CLFVBQUssR0FBTCxLQUFLLENBQUc7SUFFckMsQ0FBQztJQUVELElBQW9CLFNBQVM7UUFDNUIsT0FBTyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDeEIsQ0FBQztJQUVNLEdBQUc7UUFDVCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDbkIsQ0FBQztJQUNNLFdBQVcsQ0FBQyxRQUFtQjtRQUNyQyxRQUFRO0lBQ1QsQ0FBQztJQUNNLGNBQWMsQ0FBQyxRQUFtQjtRQUN4QyxRQUFRO0lBQ1QsQ0FBQztJQUVRLEdBQUc7UUFDWCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFUSxRQUFRO1FBQ2hCLE9BQU8sVUFBVSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDL0IsQ0FBQztDQUNEIn0=