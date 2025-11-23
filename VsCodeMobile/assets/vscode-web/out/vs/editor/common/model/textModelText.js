/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { AbstractText } from '../core/text/abstractText.js';
import { TextLength } from '../core/text/textLength.js';
export class TextModelText extends AbstractText {
    constructor(_textModel) {
        super();
        this._textModel = _textModel;
    }
    getValueOfRange(range) {
        return this._textModel.getValueInRange(range);
    }
    getLineLength(lineNumber) {
        return this._textModel.getLineLength(lineNumber);
    }
    get length() {
        const lastLineNumber = this._textModel.getLineCount();
        const lastLineLen = this._textModel.getLineLength(lastLineNumber);
        return new TextLength(lastLineNumber - 1, lastLineLen);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dE1vZGVsVGV4dC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL21vZGVsL3RleHRNb2RlbFRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQzVELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUd4RCxNQUFNLE9BQU8sYUFBYyxTQUFRLFlBQVk7SUFDOUMsWUFBNkIsVUFBc0I7UUFDbEQsS0FBSyxFQUFFLENBQUM7UUFEb0IsZUFBVSxHQUFWLFVBQVUsQ0FBWTtJQUVuRCxDQUFDO0lBRVEsZUFBZSxDQUFDLEtBQVk7UUFDcEMsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRVEsYUFBYSxDQUFDLFVBQWtCO1FBQ3hDLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVELElBQUksTUFBTTtRQUNULE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDdEQsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDbEUsT0FBTyxJQUFJLFVBQVUsQ0FBQyxjQUFjLEdBQUcsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQ3hELENBQUM7Q0FDRCJ9