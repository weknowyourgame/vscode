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
var TextEdit_1;
import { illegalArgument } from '../../../../base/common/errors.js';
import { es5ClassCompat } from './es5ClassCompat.js';
import { Position } from './position.js';
import { Range } from './range.js';
export var EndOfLine;
(function (EndOfLine) {
    EndOfLine[EndOfLine["LF"] = 1] = "LF";
    EndOfLine[EndOfLine["CRLF"] = 2] = "CRLF";
})(EndOfLine || (EndOfLine = {}));
let TextEdit = TextEdit_1 = class TextEdit {
    static isTextEdit(thing) {
        if (thing instanceof TextEdit_1) {
            return true;
        }
        if (!thing || typeof thing !== 'object') {
            return false;
        }
        return Range.isRange(thing)
            && typeof thing.newText === 'string';
    }
    static replace(range, newText) {
        return new TextEdit_1(range, newText);
    }
    static insert(position, newText) {
        return TextEdit_1.replace(new Range(position, position), newText);
    }
    static delete(range) {
        return TextEdit_1.replace(range, '');
    }
    static setEndOfLine(eol) {
        const ret = new TextEdit_1(new Range(new Position(0, 0), new Position(0, 0)), '');
        ret.newEol = eol;
        return ret;
    }
    get range() {
        return this._range;
    }
    set range(value) {
        if (value && !Range.isRange(value)) {
            throw illegalArgument('range');
        }
        this._range = value;
    }
    get newText() {
        return this._newText || '';
    }
    set newText(value) {
        if (value && typeof value !== 'string') {
            throw illegalArgument('newText');
        }
        this._newText = value;
    }
    get newEol() {
        return this._newEol;
    }
    set newEol(value) {
        if (value && typeof value !== 'number') {
            throw illegalArgument('newEol');
        }
        this._newEol = value;
    }
    constructor(range, newText) {
        this._range = range;
        this._newText = newText;
    }
    toJSON() {
        return {
            range: this.range,
            newText: this.newText,
            newEol: this._newEol
        };
    }
};
TextEdit = TextEdit_1 = __decorate([
    es5ClassCompat
], TextEdit);
export { TextEdit };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dEVkaXQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9jb21tb24vZXh0SG9zdFR5cGVzL3RleHRFZGl0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDcEUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQ3JELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDekMsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLFlBQVksQ0FBQztBQUVuQyxNQUFNLENBQU4sSUFBWSxTQUdYO0FBSEQsV0FBWSxTQUFTO0lBQ3BCLHFDQUFNLENBQUE7SUFDTix5Q0FBUSxDQUFBO0FBQ1QsQ0FBQyxFQUhXLFNBQVMsS0FBVCxTQUFTLFFBR3BCO0FBR00sSUFBTSxRQUFRLGdCQUFkLE1BQU0sUUFBUTtJQUVwQixNQUFNLENBQUMsVUFBVSxDQUFDLEtBQWM7UUFDL0IsSUFBSSxLQUFLLFlBQVksVUFBUSxFQUFFLENBQUM7WUFDL0IsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBQ0QsSUFBSSxDQUFDLEtBQUssSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUN6QyxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFDRCxPQUFPLEtBQUssQ0FBQyxPQUFPLENBQVksS0FBTSxDQUFDO2VBQ25DLE9BQWtCLEtBQU0sQ0FBQyxPQUFPLEtBQUssUUFBUSxDQUFDO0lBQ25ELENBQUM7SUFFRCxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQVksRUFBRSxPQUFlO1FBQzNDLE9BQU8sSUFBSSxVQUFRLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3JDLENBQUM7SUFFRCxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQWtCLEVBQUUsT0FBZTtRQUNoRCxPQUFPLFVBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFFRCxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQVk7UUFDekIsT0FBTyxVQUFRLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsTUFBTSxDQUFDLFlBQVksQ0FBQyxHQUFjO1FBQ2pDLE1BQU0sR0FBRyxHQUFHLElBQUksVUFBUSxDQUFDLElBQUksS0FBSyxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNoRixHQUFHLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQztRQUNqQixPQUFPLEdBQUcsQ0FBQztJQUNaLENBQUM7SUFNRCxJQUFJLEtBQUs7UUFDUixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDcEIsQ0FBQztJQUVELElBQUksS0FBSyxDQUFDLEtBQVk7UUFDckIsSUFBSSxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDcEMsTUFBTSxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDaEMsQ0FBQztRQUNELElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO0lBQ3JCLENBQUM7SUFFRCxJQUFJLE9BQU87UUFDVixPQUFPLElBQUksQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDO0lBQzVCLENBQUM7SUFFRCxJQUFJLE9BQU8sQ0FBQyxLQUFhO1FBQ3hCLElBQUksS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ3hDLE1BQU0sZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2xDLENBQUM7UUFDRCxJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQztJQUN2QixDQUFDO0lBRUQsSUFBSSxNQUFNO1FBQ1QsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDO0lBQ3JCLENBQUM7SUFFRCxJQUFJLE1BQU0sQ0FBQyxLQUE0QjtRQUN0QyxJQUFJLEtBQUssSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUN4QyxNQUFNLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBQ0QsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFDdEIsQ0FBQztJQUVELFlBQVksS0FBWSxFQUFFLE9BQXNCO1FBQy9DLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO1FBQ3BCLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDO0lBQ3pCLENBQUM7SUFFRCxNQUFNO1FBQ0wsT0FBTztZQUNOLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSztZQUNqQixPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU87WUFDckIsTUFBTSxFQUFFLElBQUksQ0FBQyxPQUFPO1NBQ3BCLENBQUM7SUFDSCxDQUFDO0NBQ0QsQ0FBQTtBQWhGWSxRQUFRO0lBRHBCLGNBQWM7R0FDRixRQUFRLENBZ0ZwQiJ9