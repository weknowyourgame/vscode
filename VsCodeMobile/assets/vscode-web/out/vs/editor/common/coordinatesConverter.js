/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class IdentityCoordinatesConverter {
    constructor(model) {
        this._model = model;
    }
    _validPosition(pos) {
        return this._model.validatePosition(pos);
    }
    _validRange(range) {
        return this._model.validateRange(range);
    }
    // View -> Model conversion and related methods
    convertViewPositionToModelPosition(viewPosition) {
        return this._validPosition(viewPosition);
    }
    convertViewRangeToModelRange(viewRange) {
        return this._validRange(viewRange);
    }
    validateViewPosition(_viewPosition, expectedModelPosition) {
        return this._validPosition(expectedModelPosition);
    }
    validateViewRange(_viewRange, expectedModelRange) {
        return this._validRange(expectedModelRange);
    }
    // Model -> View conversion and related methods
    convertModelPositionToViewPosition(modelPosition) {
        return this._validPosition(modelPosition);
    }
    convertModelRangeToViewRange(modelRange) {
        return this._validRange(modelRange);
    }
    modelPositionIsVisible(modelPosition) {
        const lineCount = this._model.getLineCount();
        if (modelPosition.lineNumber < 1 || modelPosition.lineNumber > lineCount) {
            // invalid arguments
            return false;
        }
        return true;
    }
    modelRangeIsVisible(modelRange) {
        const lineCount = this._model.getLineCount();
        if (modelRange.startLineNumber < 1 || modelRange.startLineNumber > lineCount) {
            // invalid arguments
            return false;
        }
        if (modelRange.endLineNumber < 1 || modelRange.endLineNumber > lineCount) {
            // invalid arguments
            return false;
        }
        return true;
    }
    getModelLineViewLineCount(modelLineNumber) {
        return 1;
    }
    getViewLineNumberOfModelPosition(modelLineNumber, modelColumn) {
        return modelLineNumber;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29vcmRpbmF0ZXNDb252ZXJ0ZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi9jb29yZGluYXRlc0NvbnZlcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQTRCaEcsTUFBTSxPQUFPLDRCQUE0QjtJQUl4QyxZQUFZLEtBQWlCO1FBQzVCLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO0lBQ3JCLENBQUM7SUFFTyxjQUFjLENBQUMsR0FBYTtRQUNuQyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUVPLFdBQVcsQ0FBQyxLQUFZO1FBQy9CLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVELCtDQUErQztJQUV4QyxrQ0FBa0MsQ0FBQyxZQUFzQjtRQUMvRCxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUVNLDRCQUE0QixDQUFDLFNBQWdCO1FBQ25ELE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRU0sb0JBQW9CLENBQUMsYUFBdUIsRUFBRSxxQkFBK0I7UUFDbkYsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLHFCQUFxQixDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVNLGlCQUFpQixDQUFDLFVBQWlCLEVBQUUsa0JBQXlCO1FBQ3BFLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFRCwrQ0FBK0M7SUFFeEMsa0NBQWtDLENBQUMsYUFBdUI7UUFDaEUsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFFTSw0QkFBNEIsQ0FBQyxVQUFpQjtRQUNwRCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVNLHNCQUFzQixDQUFDLGFBQXVCO1FBQ3BELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDN0MsSUFBSSxhQUFhLENBQUMsVUFBVSxHQUFHLENBQUMsSUFBSSxhQUFhLENBQUMsVUFBVSxHQUFHLFNBQVMsRUFBRSxDQUFDO1lBQzFFLG9CQUFvQjtZQUNwQixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFTSxtQkFBbUIsQ0FBQyxVQUFpQjtRQUMzQyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQzdDLElBQUksVUFBVSxDQUFDLGVBQWUsR0FBRyxDQUFDLElBQUksVUFBVSxDQUFDLGVBQWUsR0FBRyxTQUFTLEVBQUUsQ0FBQztZQUM5RSxvQkFBb0I7WUFDcEIsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBQ0QsSUFBSSxVQUFVLENBQUMsYUFBYSxHQUFHLENBQUMsSUFBSSxVQUFVLENBQUMsYUFBYSxHQUFHLFNBQVMsRUFBRSxDQUFDO1lBQzFFLG9CQUFvQjtZQUNwQixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFTSx5QkFBeUIsQ0FBQyxlQUF1QjtRQUN2RCxPQUFPLENBQUMsQ0FBQztJQUNWLENBQUM7SUFFTSxnQ0FBZ0MsQ0FBQyxlQUF1QixFQUFFLFdBQW1CO1FBQ25GLE9BQU8sZUFBZSxDQUFDO0lBQ3hCLENBQUM7Q0FDRCJ9