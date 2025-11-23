/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { LineReplacement } from '../../../../../common/core/edits/lineEdit.js';
import { LineRange } from '../../../../../common/core/ranges/lineRange.js';
export class InlineEditWithChanges {
    get lineEdit() {
        if (this.edit.replacements.length === 0) {
            return new LineReplacement(new LineRange(1, 1), []);
        }
        return LineReplacement.fromSingleTextEdit(this.edit.toReplacement(this.originalText), this.originalText);
    }
    get originalLineRange() { return this.lineEdit.lineRange; }
    get modifiedLineRange() { return this.lineEdit.toLineEdit().getNewLineRanges()[0]; }
    get displayRange() {
        return this.originalText.lineRange.intersect(this.originalLineRange.join(LineRange.ofLength(this.originalLineRange.startLineNumber, this.lineEdit.newLines.length)));
    }
    constructor(originalText, edit, cursorPosition, multiCursorPositions, commands, inlineCompletion) {
        this.originalText = originalText;
        this.edit = edit;
        this.cursorPosition = cursorPosition;
        this.multiCursorPositions = multiCursorPositions;
        this.commands = commands;
        this.inlineCompletion = inlineCompletion;
    }
    equals(other) {
        return this.originalText.getValue() === other.originalText.getValue() &&
            this.edit.equals(other.edit) &&
            this.cursorPosition.equals(other.cursorPosition) &&
            this.commands === other.commands &&
            this.inlineCompletion === other.inlineCompletion;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdFdpdGhDaGFuZ2VzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvdmlldy9pbmxpbmVFZGl0cy9pbmxpbmVFZGl0V2l0aENoYW5nZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBRy9FLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUszRSxNQUFNLE9BQU8scUJBQXFCO0lBQ2pDLElBQVcsUUFBUTtRQUNsQixJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUN6QyxPQUFPLElBQUksZUFBZSxDQUFDLElBQUksU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNyRCxDQUFDO1FBQ0QsT0FBTyxlQUFlLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUMxRyxDQUFDO0lBRUQsSUFBVyxpQkFBaUIsS0FBSyxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztJQUNsRSxJQUFXLGlCQUFpQixLQUFLLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUUzRixJQUFXLFlBQVk7UUFDdEIsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQzNDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQzFCLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FDekYsQ0FDQSxDQUFDO0lBQ0osQ0FBQztJQUVELFlBQ2lCLFlBQTBCLEVBQzFCLElBQWMsRUFDZCxjQUF3QixFQUN4QixvQkFBeUMsRUFDekMsUUFBNEMsRUFDNUMsZ0JBQXNDO1FBTHRDLGlCQUFZLEdBQVosWUFBWSxDQUFjO1FBQzFCLFNBQUksR0FBSixJQUFJLENBQVU7UUFDZCxtQkFBYyxHQUFkLGNBQWMsQ0FBVTtRQUN4Qix5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXFCO1FBQ3pDLGFBQVEsR0FBUixRQUFRLENBQW9DO1FBQzVDLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBc0I7SUFFdkQsQ0FBQztJQUVELE1BQU0sQ0FBQyxLQUE0QjtRQUNsQyxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLEtBQUssS0FBSyxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUU7WUFDcEUsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUM1QixJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDO1lBQ2hELElBQUksQ0FBQyxRQUFRLEtBQUssS0FBSyxDQUFDLFFBQVE7WUFDaEMsSUFBSSxDQUFDLGdCQUFnQixLQUFLLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQztJQUNuRCxDQUFDO0NBQ0QifQ==