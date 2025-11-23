/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shouldShowHover } from '../../browser/hoverUtils.js';
suite('Hover Utils', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('shouldShowHover', () => {
        function createMockMouseEvent(ctrlKey, altKey, metaKey) {
            return {
                event: {
                    ctrlKey,
                    altKey,
                    metaKey,
                    shiftKey: false,
                }
            };
        }
        test('returns true when enabled is "on"', () => {
            const mouseEvent = createMockMouseEvent(false, false, false);
            const result = shouldShowHover('on', 'altKey', mouseEvent);
            assert.strictEqual(result, true);
        });
        test('returns false when enabled is "off"', () => {
            const mouseEvent = createMockMouseEvent(false, false, false);
            const result = shouldShowHover('off', 'altKey', mouseEvent);
            assert.strictEqual(result, false);
        });
        test('returns true with ctrl pressed when multiCursorModifier is altKey', () => {
            const mouseEvent = createMockMouseEvent(true, false, false);
            const result = shouldShowHover('onKeyboardModifier', 'altKey', mouseEvent);
            assert.strictEqual(result, true);
        });
        test('returns false without ctrl pressed when multiCursorModifier is altKey', () => {
            const mouseEvent = createMockMouseEvent(false, false, false);
            const result = shouldShowHover('onKeyboardModifier', 'altKey', mouseEvent);
            assert.strictEqual(result, false);
        });
        test('returns true with metaKey pressed when multiCursorModifier is altKey', () => {
            const mouseEvent = createMockMouseEvent(false, false, true);
            const result = shouldShowHover('onKeyboardModifier', 'altKey', mouseEvent);
            assert.strictEqual(result, true);
        });
        test('returns true with alt pressed when multiCursorModifier is ctrlKey', () => {
            const mouseEvent = createMockMouseEvent(false, true, false);
            const result = shouldShowHover('onKeyboardModifier', 'ctrlKey', mouseEvent);
            assert.strictEqual(result, true);
        });
        test('returns false without alt pressed when multiCursorModifier is ctrlKey', () => {
            const mouseEvent = createMockMouseEvent(false, false, false);
            const result = shouldShowHover('onKeyboardModifier', 'ctrlKey', mouseEvent);
            assert.strictEqual(result, false);
        });
        test('returns true with alt pressed when multiCursorModifier is metaKey', () => {
            const mouseEvent = createMockMouseEvent(false, true, false);
            const result = shouldShowHover('onKeyboardModifier', 'metaKey', mouseEvent);
            assert.strictEqual(result, true);
        });
        test('ignores alt when multiCursorModifier is altKey', () => {
            const mouseEvent = createMockMouseEvent(false, true, false);
            const result = shouldShowHover('onKeyboardModifier', 'altKey', mouseEvent);
            assert.strictEqual(result, false);
        });
        test('ignores ctrl when multiCursorModifier is ctrlKey', () => {
            const mouseEvent = createMockMouseEvent(true, false, false);
            const result = shouldShowHover('onKeyboardModifier', 'ctrlKey', mouseEvent);
            assert.strictEqual(result, false);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG92ZXJVdGlscy50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2hvdmVyL3Rlc3QvYnJvd3Nlci9ob3ZlclV0aWxzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUc5RCxLQUFLLENBQUMsYUFBYSxFQUFFLEdBQUcsRUFBRTtJQUV6Qix1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxHQUFHLEVBQUU7UUFFN0IsU0FBUyxvQkFBb0IsQ0FBQyxPQUFnQixFQUFFLE1BQWUsRUFBRSxPQUFnQjtZQUNoRixPQUFPO2dCQUNOLEtBQUssRUFBRTtvQkFDTixPQUFPO29CQUNQLE1BQU07b0JBQ04sT0FBTztvQkFDUCxRQUFRLEVBQUUsS0FBSztpQkFDZjthQUNvQixDQUFDO1FBQ3hCLENBQUM7UUFFRCxJQUFJLENBQUMsbUNBQW1DLEVBQUUsR0FBRyxFQUFFO1lBQzlDLE1BQU0sVUFBVSxHQUFHLG9CQUFvQixDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDN0QsTUFBTSxNQUFNLEdBQUcsZUFBZSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDM0QsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbEMsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMscUNBQXFDLEVBQUUsR0FBRyxFQUFFO1lBQ2hELE1BQU0sVUFBVSxHQUFHLG9CQUFvQixDQUFDLEtBQUssRUFBRSxLQUFLLEVB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