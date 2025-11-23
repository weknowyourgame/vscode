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
var Position_1;
import { illegalArgument } from '../../../../base/common/errors.js';
import { es5ClassCompat } from './es5ClassCompat.js';
let Position = Position_1 = class Position {
    static Min(...positions) {
        if (positions.length === 0) {
            throw new TypeError();
        }
        let result = positions[0];
        for (let i = 1; i < positions.length; i++) {
            const p = positions[i];
            if (p.isBefore(result)) {
                result = p;
            }
        }
        return result;
    }
    static Max(...positions) {
        if (positions.length === 0) {
            throw new TypeError();
        }
        let result = positions[0];
        for (let i = 1; i < positions.length; i++) {
            const p = positions[i];
            if (p.isAfter(result)) {
                result = p;
            }
        }
        return result;
    }
    static isPosition(other) {
        if (!other) {
            return false;
        }
        if (other instanceof Position_1) {
            return true;
        }
        const { line, character } = other;
        if (typeof line === 'number' && typeof character === 'number') {
            return true;
        }
        return false;
    }
    static of(obj) {
        if (obj instanceof Position_1) {
            return obj;
        }
        else if (this.isPosition(obj)) {
            return new Position_1(obj.line, obj.character);
        }
        throw new Error('Invalid argument, is NOT a position-like object');
    }
    get line() {
        return this._line;
    }
    get character() {
        return this._character;
    }
    constructor(line, character) {
        if (line < 0) {
            throw illegalArgument('line must be non-negative');
        }
        if (character < 0) {
            throw illegalArgument('character must be non-negative');
        }
        this._line = line;
        this._character = character;
    }
    isBefore(other) {
        if (this._line < other._line) {
            return true;
        }
        if (other._line < this._line) {
            return false;
        }
        return this._character < other._character;
    }
    isBeforeOrEqual(other) {
        if (this._line < other._line) {
            return true;
        }
        if (other._line < this._line) {
            return false;
        }
        return this._character <= other._character;
    }
    isAfter(other) {
        return !this.isBeforeOrEqual(other);
    }
    isAfterOrEqual(other) {
        return !this.isBefore(other);
    }
    isEqual(other) {
        return this._line === other._line && this._character === other._character;
    }
    compareTo(other) {
        if (this._line < other._line) {
            return -1;
        }
        else if (this._line > other.line) {
            return 1;
        }
        else {
            // equal line
            if (this._character < other._character) {
                return -1;
            }
            else if (this._character > other._character) {
                return 1;
            }
            else {
                // equal line and character
                return 0;
            }
        }
    }
    translate(lineDeltaOrChange, characterDelta = 0) {
        if (lineDeltaOrChange === null || characterDelta === null) {
            throw illegalArgument();
        }
        let lineDelta;
        if (typeof lineDeltaOrChange === 'undefined') {
            lineDelta = 0;
        }
        else if (typeof lineDeltaOrChange === 'number') {
            lineDelta = lineDeltaOrChange;
        }
        else {
            lineDelta = typeof lineDeltaOrChange.lineDelta === 'number' ? lineDeltaOrChange.lineDelta : 0;
            characterDelta = typeof lineDeltaOrChange.characterDelta === 'number' ? lineDeltaOrChange.characterDelta : 0;
        }
        if (lineDelta === 0 && characterDelta === 0) {
            return this;
        }
        return new Position_1(this.line + lineDelta, this.character + characterDelta);
    }
    with(lineOrChange, character = this.character) {
        if (lineOrChange === null || character === null) {
            throw illegalArgument();
        }
        let line;
        if (typeof lineOrChange === 'undefined') {
            line = this.line;
        }
        else if (typeof lineOrChange === 'number') {
            line = lineOrChange;
        }
        else {
            line = typeof lineOrChange.line === 'number' ? lineOrChange.line : this.line;
            character = typeof lineOrChange.character === 'number' ? lineOrChange.character : this.character;
        }
        if (line === this.line && character === this.character) {
            return this;
        }
        return new Position_1(line, character);
    }
    toJSON() {
        return { line: this.line, character: this.character };
    }
    [Symbol.for('debug.description')]() {
        return `(${this.line}:${this.character})`;
    }
};
Position = Position_1 = __decorate([
    es5ClassCompat
], Position);
export { Position };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9zaXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9jb21tb24vZXh0SG9zdFR5cGVzL3Bvc2l0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDcEUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBRzlDLElBQU0sUUFBUSxnQkFBZCxNQUFNLFFBQVE7SUFFcEIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFNBQXFCO1FBQ2xDLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUM1QixNQUFNLElBQUksU0FBUyxFQUFFLENBQUM7UUFDdkIsQ0FBQztRQUNELElBQUksTUFBTSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMxQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQzNDLE1BQU0sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN2QixJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztnQkFDeEIsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUNaLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBRUQsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFNBQXFCO1FBQ2xDLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUM1QixNQUFNLElBQUksU0FBUyxFQUFFLENBQUM7UUFDdkIsQ0FBQztRQUNELElBQUksTUFBTSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMs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