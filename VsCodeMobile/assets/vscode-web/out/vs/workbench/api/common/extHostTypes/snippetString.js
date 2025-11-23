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
var SnippetString_1;
import { es5ClassCompat } from './es5ClassCompat.js';
let SnippetString = SnippetString_1 = class SnippetString {
    static isSnippetString(thing) {
        if (thing instanceof SnippetString_1) {
            return true;
        }
        if (!thing || typeof thing !== 'object') {
            return false;
        }
        return typeof thing.value === 'string';
    }
    static _escape(value) {
        return value.replace(/\$|}|\\/g, '\\$&');
    }
    constructor(value) {
        this._tabstop = 1;
        this.value = value || '';
    }
    appendText(string) {
        this.value += SnippetString_1._escape(string);
        return this;
    }
    appendTabstop(number = this._tabstop++) {
        this.value += '$';
        this.value += number;
        return this;
    }
    appendPlaceholder(value, number = this._tabstop++) {
        if (typeof value === 'function') {
            const nested = new SnippetString_1();
            nested._tabstop = this._tabstop;
            value(nested);
            this._tabstop = nested._tabstop;
            value = nested.value;
        }
        else {
            value = SnippetString_1._escape(value);
        }
        this.value += '${';
        this.value += number;
        this.value += ':';
        this.value += value;
        this.value += '}';
        return this;
    }
    appendChoice(values, number = this._tabstop++) {
        const value = values.map(s => s.replaceAll(/[|\\,]/g, '\\$&')).join(',');
        this.value += '${';
        this.value += number;
        this.value += '|';
        this.value += value;
        this.value += '|}';
        return this;
    }
    appendVariable(name, defaultValue) {
        if (typeof defaultValue === 'function') {
            const nested = new SnippetString_1();
            nested._tabstop = this._tabstop;
            defaultValue(nested);
            this._tabstop = nested._tabstop;
            defaultValue = nested.value;
        }
        else if (typeof defaultValue === 'string') {
            defaultValue = defaultValue.replace(/\$|}/g, '\\$&'); // CodeQL [SM02383] I do not want to escape backslashes here
        }
        this.value += '${';
        this.value += name;
        if (defaultValue) {
            this.value += ':';
            this.value += defaultValue;
        }
        this.value += '}';
        return this;
    }
};
SnippetString = SnippetString_1 = __decorate([
    es5ClassCompat
], SnippetString);
export { SnippetString };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic25pcHBldFN0cmluZy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0VHlwZXMvc25pcHBldFN0cmluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBRzlDLElBQU0sYUFBYSxxQkFBbkIsTUFBTSxhQUFhO0lBRXpCLE1BQU0sQ0FBQyxlQUFlLENBQUMsS0FBYztRQUNwQyxJQUFJLEtBQUssWUFBWSxlQUFhLEVBQUUsQ0FBQztZQUNwQyxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFDRCxJQUFJLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ3pDLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELE9BQU8sT0FBdUIsS0FBTSxDQUFDLEtBQUssS0FBSyxRQUFRLENBQUM7SUFDekQsQ0FBQztJQUVPLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBYTtRQUNuQyxPQUFPLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFNRCxZQUFZLEtBQWM7UUFKbEIsYUFBUSxHQUFXLENBQUMsQ0FBQztRQUs1QixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssSUFBSSxFQUFFLENBQUM7SUFDMUIsQ0FBQztJQUVELFVBQVUsQ0FBQyxNQUFjO1FBQ3hCLElBQUksQ0FBQyxLQUFLLElBQUksZUFBYSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM1QyxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxhQUFhLENBQUMsU0FBaUIsSUFBSSxDQUFDLFFBQVEsRUFBRTtRQUM3QyxJQUFJLENBQUMsS0FBSyxJQUFJLEdBQUcsQ0FBQztR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