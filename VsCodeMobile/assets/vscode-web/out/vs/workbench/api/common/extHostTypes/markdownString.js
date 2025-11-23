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
var MarkdownString_1;
import { MarkdownString as BaseMarkdownString } from '../../../../base/common/htmlContent.js';
import { es5ClassCompat } from './es5ClassCompat.js';
let MarkdownString = MarkdownString_1 = class MarkdownString {
    #delegate;
    static isMarkdownString(thing) {
        if (thing instanceof MarkdownString_1) {
            return true;
        }
        if (!thing || typeof thing !== 'object') {
            return false;
        }
        return thing.appendCodeblock && thing.appendMarkdown && thing.appendText && (thing.value !== undefined);
    }
    constructor(value, supportThemeIcons = false) {
        this.#delegate = new BaseMarkdownString(value, { supportThemeIcons });
    }
    get value() {
        return this.#delegate.value;
    }
    set value(value) {
        this.#delegate.value = value;
    }
    get isTrusted() {
        return this.#delegate.isTrusted;
    }
    set isTrusted(value) {
        this.#delegate.isTrusted = value;
    }
    get supportThemeIcons() {
        return this.#delegate.supportThemeIcons;
    }
    set supportThemeIcons(value) {
        this.#delegate.supportThemeIcons = value;
    }
    get supportHtml() {
        return this.#delegate.supportHtml;
    }
    set supportHtml(value) {
        this.#delegate.supportHtml = value;
    }
    get supportAlertSyntax() {
        return this.#delegate.supportAlertSyntax;
    }
    set supportAlertSyntax(value) {
        this.#delegate.supportAlertSyntax = value;
    }
    get baseUri() {
        return this.#delegate.baseUri;
    }
    set baseUri(value) {
        this.#delegate.baseUri = value;
    }
    appendText(value) {
        this.#delegate.appendText(value);
        return this;
    }
    appendMarkdown(value) {
        this.#delegate.appendMarkdown(value);
        return this;
    }
    appendCodeblock(value, language) {
        this.#delegate.appendCodeblock(language ?? '', value);
        return this;
    }
};
MarkdownString = MarkdownString_1 = __decorate([
    es5ClassCompat
], MarkdownString);
export { MarkdownString };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFya2Rvd25TdHJpbmcuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9jb21tb24vZXh0SG9zdFR5cGVzL21hcmtkb3duU3RyaW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7OztBQUtoRyxPQUFPLEVBQUUsY0FBYyxJQUFJLGtCQUFrQixFQUFnQyxNQUFNLHdDQUF3QyxDQUFDO0FBQzVILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUc5QyxJQUFNLGNBQWMsc0JBQXBCLE1BQU0sY0FBYztJQUVqQixTQUFTLENBQXFCO0lBRXZDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFjO1FBQ3JDLElBQUksS0FBSyxZQUFZLGdCQUFjLEVBQUUsQ0FBQztZQUNyQyxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFDRCxJQUFJLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ3pDLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELE9BQVEsS0FBK0IsQ0FBQyxlQUFlLElBQUssS0FBK0IsQ0FBQyxjQUFjLElBQUssS0FBK0IsQ0FBQyxVQUFVLElBQUksQ0FBRSxLQUErQixDQUFDLEtBQUssS0FBSyxTQUFTLENBQUMsQ0FBQztJQUNyTixDQUFDO0lBRUQsWUFBWSxLQUFjLEVBQUUsb0JBQTZCLEtBQUs7UUFDN0QsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLGtCQUFrQixDQUFDLEtBQUssRUFBRSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRUQsSUFBSSxLQUFLO1FBQ1IsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQztJQUM3QixDQUFDO0lBQ0QsSUFBSSxLQUFLLENBQUMsS0FBYTtRQUN0QixJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDOUIsQ0FBQztJQUVELElBQUksU0FBUztRQUNaLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUM7SUFDakMsQ0FBQztJQUVELElBQUksU0FBUyxDQUFDLEtBQXlEO1FBQ3RFLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztJQUNsQyxDQUFDO0lBRUQsSUFBSSxpQkFBaUI7UUFDcEIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLGlCQUFpQixDQUFDO0lBQ3pDLENBQUM7SUFFRCxJQUFJLGlCQUFpQixDQUFDLEtBQTBCO1FBQy9DLElBQUksQ0FBQyxTQUFTLENBQUMsaUJBQWlCLEdBQUcsS0FBSyxDQUFDO0lBQzFDLENBQUM7SUFFRCxJQUFJLFdBQVc7UUFDZCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDO0lBQ25DLENBQUM7SUFFRCxJQUFJLFdBQVcsQ0FBQyxLQUEwQjtRQUN6QyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7SUFDcEMsQ0FBQztJQUVELElBQUksa0JBQWtCO1FBQ3JCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQztJQUMxQyxDQUFDO0lBRUQsSUFBSSxrQkFBa0IsQ0FBQyxLQUEwQjtRQUNoRCxJQUFJLENBQUMsU0FBUyxDQUFDLGtCQUFrQixHQUFHLEtBQUssQ0FBQztJQUMzQyxDQUFDO0lBRUQsSUFBSSxPQUFPO1FBQ1YsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQztJQUMvQixDQUFDO0lBRUQsSUFBSSxPQUFPLENBQUMsS0FBNkI7UUFDeEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO0lBQ2hDLENBQUM7SUFFRCxVQUFVLENBQUMsS0FBYTtRQUN2QixJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNqQyxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxjQUFjLENBQUMsS0FBYTtRQUMzQixJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyQyxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxlQUFlLENBQUMsS0FBYSxFQUFFLFFBQWlCO1FBQy9DLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFFBQVEsSUFBSSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDdEQsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0NBQ0QsQ0FBQTtBQS9FWSxjQUFjO0lBRDFCLGNBQWM7R0FDRixjQUFjLENBK0UxQiJ9