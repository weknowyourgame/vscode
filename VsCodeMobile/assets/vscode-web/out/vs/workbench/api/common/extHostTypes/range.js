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
var Range_1;
import { illegalArgument } from '../../../../base/common/errors.js';
import { es5ClassCompat } from './es5ClassCompat.js';
import { Position } from './position.js';
let Range = Range_1 = class Range {
    static isRange(thing) {
        if (thing instanceof Range_1) {
            return true;
        }
        if (!thing || typeof thing !== 'object') {
            return false;
        }
        return Position.isPosition(thing.start)
            && Position.isPosition(thing.end);
    }
    static of(obj) {
        if (obj instanceof Range_1) {
            return obj;
        }
        if (this.isRange(obj)) {
            return new Range_1(obj.start, obj.end);
        }
        throw new Error('Invalid argument, is NOT a range-like object');
    }
    get start() {
        return this._start;
    }
    get end() {
        return this._end;
    }
    constructor(startLineOrStart, startColumnOrEnd, endLine, endColumn) {
        let start;
        let end;
        if (typeof startLineOrStart === 'number' && typeof startColumnOrEnd === 'number' && typeof endLine === 'number' && typeof endColumn === 'number') {
            start = new Position(startLineOrStart, startColumnOrEnd);
            end = new Position(endLine, endColumn);
        }
        else if (Position.isPosition(startLineOrStart) && Position.isPosition(startColumnOrEnd)) {
            start = Position.of(startLineOrStart);
            end = Position.of(startColumnOrEnd);
        }
        if (!start || !end) {
            throw new Error('Invalid arguments');
        }
        if (start.isBefore(end)) {
            this._start = start;
            this._end = end;
        }
        else {
            this._start = end;
            this._end = start;
        }
    }
    contains(positionOrRange) {
        if (Range_1.isRange(positionOrRange)) {
            return this.contains(positionOrRange.start)
                && this.contains(positionOrRange.end);
        }
        else if (Position.isPosition(positionOrRange)) {
            if (Position.of(positionOrRange).isBefore(this._start)) {
                return false;
            }
            if (this._end.isBefore(positionOrRange)) {
                return false;
            }
            return true;
        }
        return false;
    }
    isEqual(other) {
        return this._start.isEqual(other._start) && this._end.isEqual(other._end);
    }
    intersection(other) {
        const start = Position.Max(other.start, this._start);
        const end = Position.Min(other.end, this._end);
        if (start.isAfter(end)) {
            // this happens when there is no overlap:
            // |-----|
            //          |----|
            return undefined;
        }
        return new Range_1(start, end);
    }
    union(other) {
        if (this.contains(other)) {
            return this;
        }
        else if (other.contains(this)) {
            return other;
        }
        const start = Position.Min(other.start, this._start);
        const end = Position.Max(other.end, this.end);
        return new Range_1(start, end);
    }
    get isEmpty() {
        return this._start.isEqual(this._end);
    }
    get isSingleLine() {
        return this._start.line === this._end.line;
    }
    with(startOrChange, end = this.end) {
        if (startOrChange === null || end === null) {
            throw illegalArgument();
        }
        let start;
        if (!startOrChange) {
            start = this.start;
        }
        else if (Position.isPosition(startOrChange)) {
            start = startOrChange;
        }
        else {
            start = startOrChange.start || this.start;
            end = startOrChange.end || this.end;
        }
        if (start.isEqual(this._start) && end.isEqual(this.end)) {
            return this;
        }
        return new Range_1(start, end);
    }
    toJSON() {
        return [this.start, this.end];
    }
    [Symbol.for('debug.description')]() {
        return getDebugDescriptionOfRange(this);
    }
};
Range = Range_1 = __decorate([
    es5ClassCompat
], Range);
export { Range };
export function getDebugDescriptionOfRange(range) {
    return range.isEmpty
        ? `[${range.start.line}:${range.start.character})`
        : `[${range.start.line}:${range.start.character} -> ${range.end.line}:${range.end.character})`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmFuZ2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9jb21tb24vZXh0SG9zdFR5cGVzL3JhbmdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDcEUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQ3JELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFHbEMsSUFBTSxLQUFLLGFBQVgsTUFBTSxLQUFLO0lBRWpCLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBYztRQUM1QixJQUFJLEtBQUssWUFBWSxPQUFLLEVBQUUsQ0FBQztZQUM1QixPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFDRCxJQUFJLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ3pDLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELE9BQU8sUUFBUSxDQUFDLFVBQVUsQ0FBUyxLQUFNLENBQUMsS0FBSyxDQUFDO2VBQzVDLFFBQVEsQ0FBQyxVQUFVLENBQVMsS0FBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFRCxNQUFNLENBQUMsRUFBRSxDQUFDLEdBQWlCO1FBQzFCLElBQUksR0FBRyxZQUFZLE9BQUssRUFBRSxDQUFDO1lBQzFCLE9BQU8sR0FBRyxDQUFDO1FBQ1osQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3ZCLE9BQU8sSUFBSSxPQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDdEMsQ0FBQztRQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsOENBQThDLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBS0QsSUFBSSxLQUFLO1FBQ1IsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3BCLENBQUM7SUFFRCxJQUFJLEdBQUc7UUFDTixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDbEIsQ0FBQztJQUtELFlBQVksZ0JBQXFELEVBQUUsZ0JBQXFELEVBQUUsT0FBZ0IsRUFBRSxTQUFrQjtRQUM3SixJQUFJLEtBQTJCLENBQUM7UUFDaEMsSUFBSSxHQUF5QixDQUFDO1FBRTlCLElBQUksT0FBTyxnQkFBZ0IsS0FBSyxRQUFRLElBQUksT0FBTyxnQkFBZ0IsS0FBSyxRQUFRLElBQUksT0FBTyxPQUFPLEtBQUssUUFBUSxJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ2xKLEtBQUssR0FBRyxJQUFJLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ3pELEdBQUcsR0FBRyxJQUFJLFFBQVEsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDeEMsQ0FBQzthQUFNLElBQUksUUFBUSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDO1lBQzNGLEtBQUssR0FBRyxRQUFRLENBQUMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFDdEMsR0FBRyxHQUFHLFFBQVEsQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUNyQyxDQUFDO1FBRUQsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ3BCLE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUN0QyxDQUFDO1FBRUQsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7WUFDcEIsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHLENBQUM7UUFDakIsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQztZQUNsQixJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQztRQUNuQixDQUFDO0lBQ0YsQ0FBQztJQUVELFFBQVEsQ0FBQyxlQUFpQztRQUN6QyxJQUFJLE9BQUssQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQztZQUNwQyxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQzttQkFDdkMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFeEMsQ0FBQzthQUFNLElBQUksUUFBUSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsRUFBRSxDQUFDO1lBQ2pELElBQUksUUFBUSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7Z0JBQ3hELE9BQU8sS0FBSyxDQUFDO1lBQ2QsQ0FBQztZQUNELElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQztnQkFDekMsT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDO1lBQ0QsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0lBRUQsT0FBTyxDQUFDLEtBQVk7UUFDbkIsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzNFLENBQUM7SUFFRCxZQUFZLENBQUMsS0FBWTtRQUN4QixNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JELE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0MsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDeEIseUNBQXlDO1lBQ3pDLFVBQVU7WUFDVixrQkFBa0I7WUFDbEIsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUNELE9BQU8sSUFBSSxPQUFLLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFRCxLQUFLLENBQUMsS0FBWTtRQUNqQixJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUMxQixPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7YUFBTSxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUNqQyxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFDRCxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JELE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDOUMsT0FBTyxJQUFJLE9BQUssQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVELElBQUksT0FBTztRQUNWLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFFRCxJQUFJLFlBQVk7UUFDZixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQzVDLENBQUM7SUFJRCxJQUFJLENBQUMsYUFBMEUsRUFBRSxNQUFnQixJQUFJLENBQUMsR0FBRztRQUV4RyxJQUFJLGFBQWEsS0FBSyxJQUFJLElBQUksR0FBRyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQzVDLE1BQU0sZUFBZSxFQUFFLENBQUM7UUFDekIsQ0FBQztRQUVELElBQUksS0FBZSxDQUFDO1FBQ3BCLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUNwQixLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUVwQixDQUFDO2FBQU0sSUFBSSxRQUFRLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7WUFDL0MsS0FBSyxHQUFHLGFBQWEsQ0FBQztRQUV2QixDQUFDO2FBQU0sQ0FBQztZQUNQLEtBQUssR0FBRyxhQUFhLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDMUMsR0FBRyxHQUFHLGFBQWEsQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUNyQyxDQUFDO1FBRUQsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3pELE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUNELE9BQU8sSUFBSSxPQUFLLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFRCxNQUFNO1FBQ0wsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRCxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUNoQyxPQUFPLDBCQUEwQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pDLENBQUM7Q0FDRCxDQUFBO0FBbkpZLEtBQUs7SUFEakIsY0FBYztHQUNGLEtBQUssQ0FtSmpCOztBQUVELE1BQU0sVUFBVSwwQkFBMEIsQ0FBQyxLQUFtQjtJQUM3RCxPQUFPLEtBQUssQ0FBQyxPQUFPO1FBQ25CLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHO1FBQ2xELENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsU0FBUyxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLENBQUM7QUFDakcsQ0FBQyJ9