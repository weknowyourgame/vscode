/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { safeIntl } from '../../../base/common/date.js';
export function createContentSegmenter(lineData, options) {
    if (lineData.isBasicASCII && options.useMonospaceOptimizations) {
        return new AsciiContentSegmenter(lineData);
    }
    return new GraphemeContentSegmenter(lineData);
}
class AsciiContentSegmenter {
    constructor(lineData) {
        this._content = lineData.content;
    }
    getSegmentAtIndex(index) {
        return this._content[index];
    }
    getSegmentData(index) {
        return undefined;
    }
}
/**
 * This is a more modern version of {@link GraphemeIterator}, relying on browser APIs instead of a
 * manual table approach.
 */
class GraphemeContentSegmenter {
    constructor(lineData) {
        this._segments = [];
        const content = lineData.content;
        const segmenter = safeIntl.Segmenter(undefined, { granularity: 'grapheme' }).value;
        const segmentedContent = Array.from(segmenter.segment(content));
        let segmenterIndex = 0;
        for (let x = 0; x < content.length; x++) {
            const segment = segmentedContent[segmenterIndex];
            // No more segments in the string (eg. an emoji is the last segment)
            if (!segment) {
                break;
            }
            // The segment isn't renderable (eg. the tail end of an emoji)
            if (segment.index !== x) {
                this._segments.push(undefined);
                continue;
            }
            segmenterIndex++;
            this._segments.push(segment);
        }
    }
    getSegmentAtIndex(index) {
        return this._segments[index]?.segment;
    }
    getSegmentData(index) {
        return this._segments[index];
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudFNlZ21lbnRlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci9ncHUvY29udGVudFNlZ21lbnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFnQnhELE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxRQUErQixFQUFFLE9BQXdCO0lBQy9GLElBQUksUUFBUSxDQUFDLFlBQVksSUFBSSxPQUFPLENBQUMseUJBQXlCLEVBQUUsQ0FBQztRQUNoRSxPQUFPLElBQUkscUJBQXFCLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNELE9BQU8sSUFBSSx3QkFBd0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMvQyxDQUFDO0FBRUQsTUFBTSxxQkFBcUI7SUFHMUIsWUFBWSxRQUErQjtRQUMxQyxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUM7SUFDbEMsQ0FBQztJQUVELGlCQUFpQixDQUFDLEtBQWE7UUFDOUIsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFFRCxjQUFjLENBQUMsS0FBYTtRQUMzQixPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0NBQ0Q7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLHdCQUF3QjtJQUc3QixZQUFZLFFBQStCO1FBRjFCLGNBQVMsR0FBcUMsRUFBRSxDQUFDO1FBR2pFLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUM7UUFDakMsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFDbkYsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNoRSxJQUFJLGNBQWMsR0FBRyxDQUFDLENBQUM7UUFFdkIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUN6QyxNQUFNLE9BQU8sR0FBRyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUVqRCxvRUFBb0U7WUFDcEUsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNkLE1BQU07WUFDUCxDQUFDO1lBRUQsOERBQThEO1lBQzlELElBQUksT0FBTyxDQUFDLEtBQUssS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDekIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQy9CLFNBQVM7WUFDVixDQUFDO1lBRUQsY0FBYyxFQUFFLENBQUM7WUFDakIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDOUIsQ0FBQztJQUNGLENBQUM7SUFFRCxpQkFBaUIsQ0FBQyxLQUFhO1FBQzlCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsRUFBRSxPQUFPLENBQUM7SUFDdkMsQ0FBQztJQUVELGNBQWMsQ0FBQyxLQUFhO1FBQzNCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM5QixDQUFDO0NBQ0QifQ==