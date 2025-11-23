/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { equals } from '../../../../../base/common/arrays.js';
import { Range } from '../../../../../editor/common/core/range.js';
/**
 * Represents an edit, expressed in whole lines:
 * At (before) {@link MergeEditorLineRange.startLineNumber}, delete {@link MergeEditorLineRange.length} many lines and insert {@link newLines}.
*/
export class LineRangeEdit {
    constructor(range, newLines) {
        this.range = range;
        this.newLines = newLines;
    }
    equals(other) {
        return this.range.equals(other.range) && equals(this.newLines, other.newLines);
    }
    toEdits(modelLineCount) {
        return new LineEdits([this]).toEdits(modelLineCount);
    }
}
export class RangeEdit {
    constructor(range, newText) {
        this.range = range;
        this.newText = newText;
    }
    equals(other) {
        return Range.equalsRange(this.range, other.range) && this.newText === other.newText;
    }
}
export class LineEdits {
    constructor(edits) {
        this.edits = edits;
    }
    toEdits(modelLineCount) {
        return this.edits.map((e) => {
            if (e.range.endLineNumberExclusive <= modelLineCount) {
                return {
                    range: new Range(e.range.startLineNumber, 1, e.range.endLineNumberExclusive, 1),
                    text: e.newLines.map(s => s + '\n').join(''),
                };
            }
            if (e.range.startLineNumber === 1) {
                return {
                    range: new Range(1, 1, modelLineCount, Number.MAX_SAFE_INTEGER),
                    text: e.newLines.join('\n'),
                };
            }
            return {
                range: new Range(e.range.startLineNumber - 1, Number.MAX_SAFE_INTEGER, modelLineCount, Number.MAX_SAFE_INTEGER),
                text: e.newLines.map(s => '\n' + s).join(''),
            };
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdGluZy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL21vZGVsL2VkaXRpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUluRTs7O0VBR0U7QUFDRixNQUFNLE9BQU8sYUFBYTtJQUN6QixZQUNpQixLQUEyQixFQUMzQixRQUFrQjtRQURsQixVQUFLLEdBQUwsS0FBSyxDQUFzQjtRQUMzQixhQUFRLEdBQVIsUUFBUSxDQUFVO0lBQy9CLENBQUM7SUFFRSxNQUFNLENBQUMsS0FBb0I7UUFDakMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ2hGLENBQUM7SUFFTSxPQUFPLENBQUMsY0FBc0I7UUFDcEMsT0FBTyxJQUFJLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ3RELENBQUM7Q0FDRDtBQUVELE1BQU0sT0FBTyxTQUFTO0lBQ3JCLFlBQ2lCLEtBQVksRUFDWixPQUFlO1FBRGYsVUFBSyxHQUFMLEtBQUssQ0FBTztRQUNaLFlBQU8sR0FBUCxPQUFPLENBQVE7SUFDNUIsQ0FBQztJQUVFLE1BQU0sQ0FBQyxLQUFnQjtRQUM3QixPQUFPLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sS0FBSyxLQUFLLENBQUMsT0FBTyxDQUFDO0lBQ3JGLENBQUM7Q0FDRDtBQUVELE1BQU0sT0FBTyxTQUFTO0lBQ3JCLFlBQTRCLEtBQStCO1FBQS9CLFVBQUssR0FBTCxLQUFLLENBQTBCO0lBQUksQ0FBQztJQUV6RCxPQUFPLENBQUMsY0FBc0I7UUFDcEMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO1lBQzNCLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsSUFBSSxjQUFjLEVBQUUsQ0FBQztnQkFDdEQsT0FBTztvQkFDTixLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxlQUFlLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsc0JBQXNCLEVBQUUsQ0FBQyxDQUFDO29CQUMvRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztpQkFDNUMsQ0FBQztZQUNILENBQUM7WUFFRCxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsZUFBZSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUNuQyxPQUFPO29CQUNOLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLGNBQWMsRUFBRSxNQUFNLENBQUMsZ0JBQWdCLENBQUM7b0JBQy9ELElBQUksRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7aUJBQzNCLENBQUM7WUFDSCxDQUFDO1lBRUQsT0FBTztnQkFDTixLQUFLLEVBQUUsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRSxjQUFjLEVBQUUsTUFBTSxDQUFDLGdCQUFnQixDQUFDO2dCQUMvRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQzthQUM1QyxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0NBQ0QifQ==