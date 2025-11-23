/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { findLastIdxMonotonous } from '../../../../base/common/arraysFind.js';
import { OffsetRange } from '../ranges/offsetRange.js';
import { Position } from '../position.js';
import { Range } from '../range.js';
export class PositionOffsetTransformerBase {
    getOffsetRange(range) {
        return new OffsetRange(this.getOffset(range.getStartPosition()), this.getOffset(range.getEndPosition()));
    }
    getRange(offsetRange) {
        return Range.fromPositions(this.getPosition(offsetRange.start), this.getPosition(offsetRange.endExclusive));
    }
    getStringEdit(edit) {
        const edits = edit.replacements.map(e => this.getStringReplacement(e));
        return new Deps.deps.StringEdit(edits);
    }
    getStringReplacement(edit) {
        return new Deps.deps.StringReplacement(this.getOffsetRange(edit.range), edit.text);
    }
    getTextReplacement(edit) {
        return new Deps.deps.TextReplacement(this.getRange(edit.replaceRange), edit.newText);
    }
    getTextEdit(edit) {
        const edits = edit.replacements.map(e => this.getTextReplacement(e));
        return new Deps.deps.TextEdit(edits);
    }
}
class Deps {
    static { this._deps = undefined; }
    static get deps() {
        if (!this._deps) {
            throw new Error('Dependencies not set. Call _setDependencies first.');
        }
        return this._deps;
    }
}
/** This is to break circular module dependencies. */
export function _setPositionOffsetTransformerDependencies(deps) {
    Deps._deps = deps;
}
export class PositionOffsetTransformer extends PositionOffsetTransformerBase {
    constructor(text) {
        super();
        this.text = text;
        this.lineStartOffsetByLineIdx = [];
        this.lineEndOffsetByLineIdx = [];
        this.lineStartOffsetByLineIdx.push(0);
        for (let i = 0; i < text.length; i++) {
            if (text.charAt(i) === '\n') {
                this.lineStartOffsetByLineIdx.push(i + 1);
                if (i > 0 && text.charAt(i - 1) === '\r') {
                    this.lineEndOffsetByLineIdx.push(i - 1);
                }
                else {
                    this.lineEndOffsetByLineIdx.push(i);
                }
            }
        }
        this.lineEndOffsetByLineIdx.push(text.length);
    }
    getOffset(position) {
        const valPos = this._validatePosition(position);
        return this.lineStartOffsetByLineIdx[valPos.lineNumber - 1] + valPos.column - 1;
    }
    _validatePosition(position) {
        if (position.lineNumber < 1) {
            return new Position(1, 1);
        }
        const lineCount = this.textLength.lineCount + 1;
        if (position.lineNumber > lineCount) {
            const lineLength = this.getLineLength(lineCount);
            return new Position(lineCount, lineLength + 1);
        }
        if (position.column < 1) {
            return new Position(position.lineNumber, 1);
        }
        const lineLength = this.getLineLength(position.lineNumber);
        if (position.column - 1 > lineLength) {
            return new Position(position.lineNumber, lineLength + 1);
        }
        return position;
    }
    getPosition(offset) {
        const idx = findLastIdxMonotonous(this.lineStartOffsetByLineIdx, i => i <= offset);
        const lineNumber = idx + 1;
        const column = offset - this.lineStartOffsetByLineIdx[idx] + 1;
        return new Position(lineNumber, column);
    }
    getTextLength(offsetRange) {
        return Deps.deps.TextLength.ofRange(this.getRange(offsetRange));
    }
    get textLength() {
        const lineIdx = this.lineStartOffsetByLineIdx.length - 1;
        return new Deps.deps.TextLength(lineIdx, this.text.length - this.lineStartOffsetByLineIdx[lineIdx]);
    }
    getLineLength(lineNumber) {
        return this.lineEndOffsetByLineIdx[lineNumber - 1] - this.lineStartOffsetByLineIdx[lineNumber - 1];
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9zaXRpb25Ub09mZnNldEltcGwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi9jb3JlL3RleHQvcG9zaXRpb25Ub09mZnNldEltcGwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFOUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBSXBDLE1BQU0sT0FBZ0IsNkJBQTZCO0lBR2xELGNBQWMsQ0FBQyxLQUFZO1FBQzFCLE9BQU8sSUFBSSxXQUFXLENBQ3JCLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLGdCQUFnQixFQUFFLENBQUMsRUFDeEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FDdEMsQ0FBQztJQUNILENBQUM7SUFJRCxRQUFRLENBQUMsV0FBd0I7UUFDaEMsT0FBTyxLQUFLLENBQUMsYUFBYSxDQUN6QixJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsRUFDbkMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQzFDLENBQUM7SUFDSCxDQUFDO0lBRUQsYUFBYSxDQUFDLElBQWM7UUFDM0IsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2RSxPQUFPLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FB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