/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class ViewModelDecoration {
    constructor(range, options) {
        this._viewModelDecorationBrand = undefined;
        this.range = range;
        this.options = options;
    }
}
export function isModelDecorationVisible(model, decoration) {
    if (decoration.options.hideInCommentTokens && isModelDecorationInComment(model, decoration)) {
        return false;
    }
    if (decoration.options.hideInStringTokens && isModelDecorationInString(model, decoration)) {
        return false;
    }
    return true;
}
export function isModelDecorationInComment(model, decoration) {
    return testTokensInRange(model, decoration.range, (tokenType) => tokenType === 1 /* StandardTokenType.Comment */);
}
export function isModelDecorationInString(model, decoration) {
    return testTokensInRange(model, decoration.range, (tokenType) => tokenType === 2 /* StandardTokenType.String */);
}
/**
 * Calls the callback for every token that intersects the range.
 * If the callback returns `false`, iteration stops and `false` is returned.
 * Otherwise, `true` is returned.
 */
function testTokensInRange(model, range, callback) {
    for (let lineNumber = range.startLineNumber; lineNumber <= range.endLineNumber; lineNumber++) {
        const lineTokens = model.tokenization.getLineTokens(lineNumber);
        const isFirstLine = lineNumber === range.startLineNumber;
        const isEndLine = lineNumber === range.endLineNumber;
        let tokenIdx = isFirstLine ? lineTokens.findTokenIndexAtOffset(range.startColumn - 1) : 0;
        while (tokenIdx < lineTokens.getCount()) {
            if (isEndLine) {
                const startOffset = lineTokens.getStartOffset(tokenIdx);
                if (startOffset > range.endColumn - 1) {
                    break;
                }
            }
            const callbackResult = callback(lineTokens.getStandardTokenType(tokenIdx));
            if (!callbackResult) {
                return false;
            }
            tokenIdx++;
        }
    }
    return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld01vZGVsRGVjb3JhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL3ZpZXdNb2RlbC92aWV3TW9kZWxEZWNvcmF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBTWhHLE1BQU0sT0FBTyxtQkFBbUI7SUFNL0IsWUFBWSxLQUFZLEVBQUUsT0FBZ0M7UUFMMUQsOEJBQXlCLEdBQVMsU0FBUyxDQUFDO1FBTTNDLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0lBQ3hCLENBQUM7Q0FDRDtBQUVELE1BQU0sVUFBVSx3QkFBd0IsQ0FBQyxLQUFpQixFQUFFLFVBQTRCO0lBQ3ZGLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsSUFBSSwwQkFBMEIsQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLEVBQUUsQ0FBQztRQUM3RixPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFRCxJQUFJLFVBQVUsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLElBQUkseUJBQXlCLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxFQUFFLENBQUM7UUFDM0YsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDYixDQUFDO0FBRUQsTUFBTSxVQUFVLDBCQUEwQixDQUFDLEtBQWlCLEVBQUUsVUFBNEI7SUFDekYsT0FBTyxpQkFBaUIsQ0FDdkIsS0FBSyxFQUNMLFVBQVUsQ0FBQyxLQUFLLEVBQ2hCLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxTQUFTLHNDQUE4QixDQUN0RCxDQUFDO0FBQ0gsQ0FBQztBQUVELE1BQU0sVUFBVSx5QkFBeUIsQ0FBQyxLQUFpQixFQUFFLFVBQTRCO0lBQ3hGLE9BQU8saUJBQWlCLENBQ3ZCLEtBQUssRUFDTCxVQUFVLENBQUMsS0FBSyxFQUNoQixDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsU0FBUyxxQ0FBNkIsQ0FDckQsQ0FBQztBQUNILENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsU0FBUyxpQkFBaUIsQ0FBQyxLQUFpQixFQUFFLEtBQVksRUFBRSxRQUFtRDtJQUM5RyxLQUFLLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQyxlQUFlLEVBQUUsVUFBVSxJQUFJLEtBQUssQ0FBQyxhQUFhLEVBQUUsVUFBVSxFQUFFLEVBQUUsQ0FBQztRQUM5RixNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoRSxNQUFNLFdBQVcsR0FBRyxVQUFVLEtBQUssS0FBSyxDQUFDLGVBQWUsQ0FBQztRQUN6RCxNQUFNLFNBQVMsR0FBRyxVQUFVLEtBQUssS0FBSyxDQUFDLGFBQWEsQ0FBQztRQUVyRCxJQUFJLFFBQVEsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDMUYsT0FBTyxRQUFRLEdBQUcsVUFBVSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUM7WUFDekMsSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDZixNQUFNLFdBQVcsR0FBRyxVQUFVLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUN4RCxJQUFJLFdBQVcsR0FBRyxLQUFLLENBQUMsU0FBUyxHQUFHLENBQUMsRUFBRSxDQUFDO29CQUN2QyxNQUFNO2dCQUNQLENBQUM7WUFDRixDQUFDO1lBRUQsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBQzNFLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFDckIsT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDO1lBQ0QsUUFBUSxFQUFFLENBQUM7UUFDWixDQUFDO0lBQ0YsQ0FBQztJQUNELE9BQU8sSUFBSSxDQUFDO0FBQ2IsQ0FBQyJ9