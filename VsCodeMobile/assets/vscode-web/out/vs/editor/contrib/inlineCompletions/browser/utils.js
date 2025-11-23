/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Permutation, compareBy } from '../../../../base/common/arrays.js';
import { observableValue, autorun, transaction } from '../../../../base/common/observable.js';
import { bindContextKey } from '../../../../platform/observable/common/platformObservableUtils.js';
import { Position } from '../../../common/core/position.js';
import { PositionOffsetTransformer } from '../../../common/core/text/positionToOffset.js';
import { Range } from '../../../common/core/range.js';
import { TextEdit } from '../../../common/core/edits/textEdit.js';
import { getPositionOffsetTransformerFromTextModel } from '../../../common/core/text/getPositionOffsetTransformerFromTextModel.js';
const array = [];
export function getReadonlyEmptyArray() {
    return array;
}
export function addPositions(pos1, pos2) {
    return new Position(pos1.lineNumber + pos2.lineNumber - 1, pos2.lineNumber === 1 ? pos1.column + pos2.column - 1 : pos2.column);
}
export function subtractPositions(pos1, pos2) {
    return new Position(pos1.lineNumber - pos2.lineNumber + 1, pos1.lineNumber - pos2.lineNumber === 0 ? pos1.column - pos2.column + 1 : pos1.column);
}
export function substringPos(text, pos) {
    const transformer = new PositionOffsetTransformer(text);
    const offset = transformer.getOffset(pos);
    return text.substring(offset);
}
export function getEndPositionsAfterApplying(edits) {
    const newRanges = getModifiedRangesAfterApplying(edits);
    return newRanges.map(range => range.getEndPosition());
}
export function getModifiedRangesAfterApplying(edits) {
    const sortPerm = Permutation.createSortPermutation(edits, compareBy(e => e.range, Range.compareRangesUsingStarts));
    const edit = new TextEdit(sortPerm.apply(edits));
    const sortedNewRanges = edit.getNewRanges();
    return sortPerm.inverse().apply(sortedNewRanges);
}
export function removeTextReplacementCommonSuffixPrefix(edits, textModel) {
    const transformer = getPositionOffsetTransformerFromTextModel(textModel);
    const text = textModel.getValue();
    const stringReplacements = edits.map(edit => transformer.getStringReplacement(edit));
    const minimalStringReplacements = stringReplacements.map(replacement => replacement.removeCommonSuffixPrefix(text));
    return minimalStringReplacements.map(replacement => transformer.getTextReplacement(replacement));
}
export function convertItemsToStableObservables(items, store) {
    const result = observableValue('result', []);
    const innerObservables = [];
    store.add(autorun(reader => {
        const itemsValue = items.read(reader);
        transaction(tx => {
            if (itemsValue.length !== innerObservables.length) {
                innerObservables.length = itemsValue.length;
                for (let i = 0; i < innerObservables.length; i++) {
                    if (!innerObservables[i]) {
                        innerObservables[i] = observableValue('item', itemsValue[i]);
                    }
                }
                result.set([...innerObservables], tx);
            }
            innerObservables.forEach((o, i) => o.set(itemsValue[i], tx));
        });
    }));
    return result;
}
export class ObservableContextKeyService {
    constructor(_contextKeyService) {
        this._contextKeyService = _contextKeyService;
    }
    bind(key, obs) {
        return bindContextKey(key, this._contextKeyService, obs instanceof Function ? obs : reader => obs.read(reader));
    }
}
export function wait(ms, cancellationToken) {
    return new Promise(resolve => {
        let d = undefined;
        const handle = setTimeout(() => {
            if (d) {
                d.dispose();
            }
            resolve();
        }, ms);
        if (cancellationToken) {
            d = cancellationToken.onCancellationRequested(() => {
                clearTimeout(handle);
                if (d) {
                    d.dispose();
                }
                resolve();
            });
        }
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvYnJvd3Nlci91dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRzNFLE9BQU8sRUFBZSxlQUFlLEVBQXVCLE9BQU8sRUFBRSxXQUFXLEVBQVcsTUFBTSx1Q0FBdUMsQ0FBQztBQUV6SSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFDbkcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzVELE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzFGLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RCxPQUFPLEVBQW1CLFFBQVEsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ25GLE9BQU8sRUFBRSx5Q0FBeUMsRUFBRSxNQUFNLHdFQUF3RSxDQUFDO0FBR25JLE1BQU0sS0FBSyxHQUF1QixFQUFFLENBQUM7QUFDckMsTUFBTSxVQUFVLHFCQUFxQjtJQUNwQyxPQUFPLEtBQUssQ0FBQztBQUNkLENBQUM7QUFFRCxNQUFNLFVBQVUsWUFBWSxDQUFDLElBQWMsRUFBRSxJQUFjO0lBQzFELE9BQU8sSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2pJLENBQUM7QUFFRCxNQUFNLFVBQVUsaUJBQWlCLENBQUMsSUFBYyxFQUFFLElBQWM7SUFDL0QsT0FBTyxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNuSixDQUFDO0FBRUQsTUFBTSxVQUFVLFlBQVksQ0FBQyxJQUFZLEVBQUUsR0FBYTtJQUN2RCxNQUFNLFdBQVcsR0FBRyxJQUFJLHlCQUF5QixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hELE1BQU0sTUFBTSxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDMUMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQy9CLENBQUM7QUFFRCxNQUFNLFVBQVUsNEJBQTRCLENBQUMsS0FBaUM7SUFDN0UsTUFBTSxTQUFTLEdBQUcsOEJBQThCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDeEQsT0FBTyxTQUFTLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUM7QUFDdkQsQ0FBQztBQUVELE1BQU0sVUFBVSw4QkFBOEIsQ0FBQyxLQUFpQztJQUMvRSxNQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMscUJBQXFCLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQztJQUNuSCxNQUFNLElBQUksR0FBRyxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDakQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQzVDLE9BQU8sUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUNsRCxDQUFDO0FBRUQsTUFBTSxVQUFVLHVDQUF1QyxDQUFDLEtBQWlDLEVBQUUsU0FBcUI7SUFDL0csTUFBTSxXQUFXLEdBQUcseUNBQXlDLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDekUsTUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ2xDLE1BQU0sa0JBQWtCLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3JGLE1BQU0seUJBQXlCLEdBQUcsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDcEgsT0FBTyx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztBQUNsRyxDQUFDO0FBRUQsTUFBTSxVQUFVLCtCQUErQixDQUFJLEtBQWdDLEVBQUUsS0FBc0I7SUFDMUcsTUFBTSxNQUFNLEdBQUcsZUFBZSxDQUFtQixRQUFRLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDL0QsTUFBTSxnQkFBZ0IsR0FBNkIsRUFBRSxDQUFDO0lBRXRELEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1FBQzFCLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFdEMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBQ2hCLElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDbkQsZ0JBQWdCLENBQUMsTUFBTSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUM7Z0JBQzVDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztvQkFDbEQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7d0JBQzFCLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxHQUFHLGVBQWUsQ0FBSSxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2pFLENBQUM7Z0JBQ0YsQ0FBQztnQkFDRCxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxnQkFBZ0IsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZDLENBQUM7WUFDRCxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzlELENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUVKLE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVELE1BQU0sT0FBTywyQkFBMkI7SUFDdkMsWUFDa0Isa0JBQXNDO1FBQXRDLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBb0I7SUFFeEQsQ0FBQztJQUlELElBQUksQ0FBNEIsR0FBcUIsRUFBRSxHQUE4QztRQUNwRyxPQUFPLGNBQWMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixFQUFFLEdBQUcsWUFBWSxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDakgsQ0FBQztDQUNEO0FBRUQsTUFBTSxVQUFVLElBQUksQ0FBQyxFQUFVLEVBQUUsaUJBQXFDO0lBQ3JFLE9BQU8sSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDNUIsSUFBSSxDQUFDLEdBQTRCLFNBQVMsQ0FBQztRQUMzQyxNQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsR0FBRyxFQUFFO1lBQzlCLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQUMsQ0FBQztZQUN2QixPQUFPLEVBQUUsQ0FBQztRQUNYLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNQLElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUN2QixDQUFDLEdBQUcsaUJBQWlCLENBQUMsdUJBQXVCLENBQUMsR0FBRyxFQUFFO2dCQUNsRCxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ3JCLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUFDLENBQUM7Z0JBQ3ZCLE9BQU8sRUFBRSxDQUFDO1lBQ1gsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO0lBQ0YsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDIn0=