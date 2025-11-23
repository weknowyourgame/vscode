/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SnippetString } from './snippetString.js';
import { Range } from './range.js';
export class SnippetTextEdit {
    static isSnippetTextEdit(thing) {
        if (thing instanceof SnippetTextEdit) {
            return true;
        }
        if (!thing) {
            return false;
        }
        return Range.isRange(thing.range)
            && SnippetString.isSnippetString(thing.snippet);
    }
    static replace(range, snippet) {
        return new SnippetTextEdit(range, snippet);
    }
    static insert(position, snippet) {
        return SnippetTextEdit.replace(new Range(position, position), snippet);
    }
    constructor(range, snippet) {
        this.range = range;
        this.snippet = snippet;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic25pcHBldFRleHRFZGl0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvY29tbW9uL2V4dEhvc3RUeXBlcy9zbmlwcGV0VGV4dEVkaXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBRW5ELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFbkMsTUFBTSxPQUFPLGVBQWU7SUFFM0IsTUFBTSxDQUFDLGlCQUFpQixDQUFDLEtBQWM7UUFDdEMsSUFBSSxLQUFLLFlBQVksZUFBZSxFQUFFLENBQUM7WUFDdEMsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBQ0QsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1osT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUMsT0FBTyxDQUFtQixLQUFNLENBQUMsS0FBSyxDQUFDO2VBQ2hELGFBQWEsQ0FBQyxlQUFlLENBQW1CLEtBQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNyRSxDQUFDO0lBRUQsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFZLEVBQUUsT0FBc0I7UUFDbEQsT0FBTyxJQUFJLGVBQWUsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVELE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBa0IsRUFBRSxPQUFzQjtRQUN2RCxPQUFPLGVBQWUsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFRRCxZQUFZLEtBQVksRUFBRSxPQUFzQjtRQUMvQyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztJQUN4QixDQUFDO0NBQ0QifQ==