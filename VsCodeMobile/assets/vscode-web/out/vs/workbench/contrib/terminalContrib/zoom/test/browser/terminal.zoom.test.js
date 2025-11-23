/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { strictEqual } from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { clampTerminalFontSize } from '../../browser/terminal.zoom.contribution.js';
suite('Terminal Mouse Wheel Zoom', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('clamps font size to minimum value when below bounds', () => {
        const result = clampTerminalFontSize(3 + (-2)); // 3 - 2 = 1, clamped to 6
        strictEqual(result, 6, 'Font size should be clamped to minimum value of 6');
    });
    test('clamps font size to maximum value when above bounds', () => {
        const result = clampTerminalFontSize(99 + 5); // 99 + 5 = 104, clamped to 100
        strictEqual(result, 100, 'Font size should be clamped to maximum value of 100');
    });
    test('preserves font size when within bounds', () => {
        const result = clampTerminalFontSize(12 + 3); // 12 + 3 = 15, within bounds
        strictEqual(result, 15, 'Font size should remain unchanged when within bounds');
    });
    test('clamps font size when going below minimum', () => {
        const result = clampTerminalFontSize(6 + (-1)); // 6 - 1 = 5, clamped to 6
        strictEqual(result, 6, 'Font size should be clamped when going below minimum');
    });
    test('clamps font size when going above maximum', () => {
        const result = clampTerminalFontSize(100 + 1); // 100 + 1 = 101, clamped to 100
        strictEqual(result, 100, 'Font size should be clamped when going above maximum');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWwuem9vbS50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi96b29tL3Rlc3QvYnJvd3Nlci90ZXJtaW5hbC56b29tLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUNyQyxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN0RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUVwRixLQUFLLENBQUMsMkJBQTJCLEVBQUUsR0FBRyxFQUFFO0lBQ3ZDLHVDQUF1QyxFQUFFLENBQUM7SUFFMUMsSUFBSSxDQUFDLHFEQUFxRCxFQUFFLEdBQUcsRUFBRTtRQUNoRSxNQUFNLE1BQU0sR0FBRyxxQkFBcUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQywwQkFBMEI7UUFDMUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsbURBQW1ELENBQUMsQ0FBQztJQUM3RSxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxxREFBcUQsRUFBRSxHQUFHLEVBQUU7UUFDaEUsTUFBTSxNQUFNLEdBQUcscUJBQXFCLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsK0JBQStCO1FBQzdFLFdBQVcsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLHFEQUFxRCxDQUFDLENBQUM7SUFDakYsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsd0NBQXdDLEVBQUUsR0FBRyxFQUFFO1FBQ25ELE1BQU0sTUFBTSxHQUFHLHFCQUFxQixDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLDZCQUE2QjtRQUMzRSxXQUFXLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxzREFBc0QsQ0FBQyxDQUFDO0lBQ2pGLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDJDQUEyQyxFQUFFLEdBQUcsRUFBRTtRQUN0RCxNQUFNLE1BQU0sR0FBRyxxQkFBcUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQywwQkFBMEI7UUFDMUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsc0RBQXNELENBQUMsQ0FBQztJQUNoRixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQywyQ0FBMkMsRUFBRSxHQUFHLEVBQUU7UUFDdEQsTUFBTSxNQUFNLEdBQUcscUJBQXFCLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsZ0NBQWdDO1FBQy9FLFdBQVcsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLHNEQUFzRCxDQUFDLENBQUM7SUFDbEYsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9