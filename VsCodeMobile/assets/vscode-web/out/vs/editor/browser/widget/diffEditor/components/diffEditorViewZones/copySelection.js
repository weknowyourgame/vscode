/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { addDisposableListener } from '../../../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { Range } from '../../../../../common/core/range.js';
export function enableCopySelection(options) {
    const { domNode, renderLinesResult, diffEntry, originalModel, clipboardService } = options;
    const viewZoneDisposable = new DisposableStore();
    viewZoneDisposable.add(addDisposableListener(domNode, 'copy', (e) => {
        e.preventDefault();
        const selection = domNode.ownerDocument.getSelection();
        if (!selection || selection.rangeCount === 0) {
            return;
        }
        const domRange = selection.getRangeAt(0);
        if (!domRange || domRange.collapsed) {
            return;
        }
        const startElement = domRange.startContainer.nodeType === Node.TEXT_NODE
            ? domRange.startContainer.parentElement
            : domRange.startContainer;
        const endElement = domRange.endContainer.nodeType === Node.TEXT_NODE
            ? domRange.endContainer.parentElement
            : domRange.endContainer;
        if (!startElement || !endElement) {
            return;
        }
        const startPosition = renderLinesResult.getModelPositionAt(startElement, domRange.startOffset);
        const endPosition = renderLinesResult.getModelPositionAt(endElement, domRange.endOffset);
        if (!startPosition || !endPosition) {
            return;
        }
        const adjustedStart = startPosition.delta(diffEntry.original.startLineNumber - 1);
        const adjustedEnd = endPosition.delta(diffEntry.original.startLineNumber - 1);
        const range = adjustedEnd.isBefore(adjustedStart) ?
            Range.fromPositions(adjustedEnd, adjustedStart) :
            Range.fromPositions(adjustedStart, adjustedEnd);
        const selectedText = originalModel.getValueInRange(range);
        clipboardService.writeText(selectedText);
    }));
    return viewZoneDisposable;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29weVNlbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9jb21wb25lbnRzL2RpZmZFZGl0b3JWaWV3Wm9uZXMvY29weVNlbGVjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDN0UsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBdUI1RCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsT0FBNEM7SUFDL0UsTUFBTSxFQUFFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxTQUFTLEVBQUUsYUFBYSxFQUFFLGdCQUFnQixFQUFFLEdBQUcsT0FBTyxDQUFDO0lBQzNGLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztJQUVqRCxrQkFBa0IsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFO1FBQ25FLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUNuQixNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3ZELElBQUksQ0FBQyxTQUFTLElBQUksU0FBUyxDQUFDLFVBQVUsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUM5QyxPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekMsSUFBSSxDQUFDLFFBQVEsSUFBSSxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDckMsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLFFBQVEsS0FBSyxJQUFJLENBQUMsU0FBUztZQUN2RSxDQUFDLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxhQUFhO1lBQ3ZDLENBQUMsQ0FBQyxRQUFRLENBQUMsY0FBNkIsQ0FBQztRQUMxQyxNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUMsWUFBWSxDQUFDLFFBQVEsS0FBSyxJQUFJLENBQUMsU0FBUztZQUNuRSxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxhQUFhO1lBQ3JDLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBMkIsQ0FBQztRQUV4QyxJQUFJLENBQUMsWUFBWSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDbEMsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLGFBQWEsR0FBRyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQy9GLE1BQU0sV0FBVyxHQUFHLGlCQUFpQixDQUFDLGtCQUFrQixDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFekYsSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ3BDLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxhQUFhLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLGVBQWUsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNsRixNQUFNLFdBQVcsR0FBRyxXQUFXLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBRTlFLE1BQU0sS0FBSyxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztZQUNsRCxLQUFLLENBQUMsYUFBYSxDQUFDLFdBQVcsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDO1lBQ2pELEtBQUssQ0FBQyxhQUFhLENBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBRWpELE1BQU0sWUFBWSxHQUFHLGFBQWEsQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDMUQsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQzFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFSixPQUFPLGtCQUFrQixDQUFDO0FBQzNCLENBQUMifQ==