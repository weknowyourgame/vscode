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
var Selection_1;
import { es5ClassCompat } from './es5ClassCompat.js';
import { Position } from './position.js';
import { getDebugDescriptionOfRange, Range } from './range.js';
let Selection = Selection_1 = class Selection extends Range {
    static isSelection(thing) {
        if (thing instanceof Selection_1) {
            return true;
        }
        if (!thing || typeof thing !== 'object') {
            return false;
        }
        return Range.isRange(thing)
            && Position.isPosition(thing.anchor)
            && Position.isPosition(thing.active)
            && typeof thing.isReversed === 'boolean';
    }
    get anchor() {
        return this._anchor;
    }
    get active() {
        return this._active;
    }
    constructor(anchorLineOrAnchor, anchorColumnOrActive, activeLine, activeColumn) {
        let anchor;
        let active;
        if (typeof anchorLineOrAnchor === 'number' && typeof anchorColumnOrActive === 'number' && typeof activeLine === 'number' && typeof activeColumn === 'number') {
            anchor = new Position(anchorLineOrAnchor, anchorColumnOrActive);
            active = new Position(activeLine, activeColumn);
        }
        else if (Position.isPosition(anchorLineOrAnchor) && Position.isPosition(anchorColumnOrActive)) {
            anchor = Position.of(anchorLineOrAnchor);
            active = Position.of(anchorColumnOrActive);
        }
        if (!anchor || !active) {
            throw new Error('Invalid arguments');
        }
        super(anchor, active);
        this._anchor = anchor;
        this._active = active;
    }
    get isReversed() {
        return this._anchor === this._end;
    }
    toJSON() {
        return {
            start: this.start,
            end: this.end,
            active: this.active,
            anchor: this.anchor
        };
    }
    [Symbol.for('debug.description')]() {
        return getDebugDescriptionOfSelection(this);
    }
};
Selection = Selection_1 = __decorate([
    es5ClassCompat
], Selection);
export { Selection };
export function getDebugDescriptionOfSelection(selection) {
    let rangeStr = getDebugDescriptionOfRange(selection);
    if (!selection.isEmpty) {
        if (selection.active.isEqual(selection.start)) {
            rangeStr = `|${rangeStr}`;
        }
        else {
            rangeStr = `${rangeStr}|`;
        }
    }
    return rangeStr;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VsZWN0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvY29tbW9uL2V4dEhvc3RUeXBlcy9zZWxlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3pDLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFHeEQsSUFBTSxTQUFTLGlCQUFmLE1BQU0sU0FBVSxTQUFRLEtBQUs7SUFFbkMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFjO1FBQ2hDLElBQUksS0FBSyxZQUFZLFdBQVMsRUFBRSxDQUFDO1lBQ2hDLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUNELElBQUksQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDekMsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztlQUN2QixRQUFRLENBQUMsVUFBVSxDQUFhLEtBQU0sQ0FBQyxNQUFNLENBQUM7ZUFDOUMsUUFBUSxDQUFDLFVBQVUsQ0FBYSxLQUFNLENBQUMsTUFBTSxDQUFDO2VBQzlDLE9BQW1CLEtBQU0sQ0FBQyxVQUFVLEtBQUssU0FBUyxDQUFDO0lBQ3hELENBQUM7SUFJRCxJQUFXLE1BQU07UUFDaEIsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDO0lBQ3JCLENBQUM7SUFJRCxJQUFXLE1BQU07UUFDaEIsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDO0lBQ3JCLENBQUM7SUFJRCxZQUFZLGtCQUFxQyxFQUFFLG9CQUF1QyxFQUFFLFVBQW1CLEVBQUUsWUFBcUI7UUFDckksSUFBSSxNQUE0QixDQUFDO1FBQ2pDLElBQUksTUFBNEIsQ0FBQztRQUVqQyxJQUFJLE9BQU8sa0JBQWtCLEtBQUssUUFBUSxJQUFJLE9BQU8sb0JBQW9CLEtBQUssUUFBUSxJQUFJLE9BQU8sVUFBVSxLQUFLLFFBQVEsSUFBSSxPQUFPLFlBQVksS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUM5SixNQUFNLEdBQUcsSUFBSSxRQUFRLENBQUMsa0JBQWtCLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztZQUNoRSxNQUFNLEdBQUcsSUFBSSxRQUFRLENBQUMsVUFBVSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQ2pELENBQUM7YUFBTSxJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsa0JBQWtCLENBQUMsSUFBSSxRQUFRLENBQUMsVUFBVSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQztZQUNqRyxNQUFNLEdBQUcsUUFBUSxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1lBQ3pDLE1BQU0sR0FBRyxRQUFRLENBQUMsRUFBRSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUVELElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN4QixNQUFNLElBQUksS0FBSyxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDdEMsQ0FBQztRQUVELEtBQUssQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFdEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFDdEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7SUFDdkIsQ0FBQztJQUVELElBQUksVUFBVTtRQUNiLE9BQU8sSUFBSSxDQUFDLE9BQU8sS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ25DLENBQUM7SUFFUSxNQUFNO1FBQ2QsT0FBTztZQUNOLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSztZQUNqQixHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUc7WUFDYixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07WUFDbkIsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO1NBQ25CLENBQUM7SUFDSCxDQUFDO0lBR0QsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDaEMsT0FBTyw4QkFBOEIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM3QyxDQUFDO0NBQ0QsQ0FBQTtBQXBFWSxTQUFTO0lBRHJCLGNBQWM7R0FDRixTQUFTLENBb0VyQjs7QUFFRCxNQUFNLFVBQVUsOEJBQThCLENBQUMsU0FBMkI7SUFDekUsSUFBSSxRQUFRLEdBQUcsMEJBQTBCLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDckQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN4QixJQUFJLFNBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQy9DLFFBQVEsR0FBRyxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBQzNCLENBQUM7YUFBTSxDQUFDO1lBQ1AsUUFBUSxHQUFHLEdBQUcsUUFBUSxHQUFHLENBQUM7UUFDM0IsQ0FBQztJQUNGLENBQUM7SUFDRCxPQUFPLFFBQVEsQ0FBQztBQUNqQixDQUFDIn0=