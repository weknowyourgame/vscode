/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Size2D } from '../../../../common/core/2d/size.js';
import { OffsetRange } from '../../../../common/core/ranges/offsetRange.js';
import { getMaxTowerHeightInAvailableArea } from '../../browser/view/inlineEdits/utils/towersLayout.js';
suite('Layout - getMaxTowerHeightInAvailableArea', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('tower fits within single available area', () => {
        const towerHorizontalRange = new OffsetRange(5, 15); // width of 10
        const availableTowerAreas = [new Size2D(50, 30)];
        // Should return the available height (30)
        assert.strictEqual(getMaxTowerHeightInAvailableArea(towerHorizontalRange, availableTowerAreas), 30);
    });
    test('max height available in area', () => {
        const towerHorizontalRange = new OffsetRange(5, 15); // width of 10
        const availableTowerAreas = [new Size2D(50, 30)];
        // Should return the available height (30), even if original tower was 40
        assert.strictEqual(getMaxTowerHeightInAvailableArea(towerHorizontalRange, availableTowerAreas), 30);
    });
    test('tower extends beyond available width', () => {
        const towerHorizontalRange = new OffsetRange(0, 60); // width of 60
        const availableTowerAreas = [new Size2D(50, 30)];
        // Should return 0 because tower extends beyond available areas
        assert.strictEqual(getMaxTowerHeightInAvailableArea(towerHorizontalRange, availableTowerAreas), 0);
    });
    test('tower fits across multiple available areas', () => {
        const towerHorizontalRange = new OffsetRange(10, 40); // width of 30
        const availableTowerAreas = [
            new Size2D(20, 30),
            new Size2D(20, 25),
            new Size2D(20, 30)
        ];
        // Should return the minimum height across overlapping areas (25)
        assert.strictEqual(getMaxTowerHeightInAvailableArea(towerHorizontalRange, availableTowerAreas), 25);
    });
    test('min height across overlapping areas', () => {
        const towerHorizontalRange = new OffsetRange(10, 40); // width of 30
        const availableTowerAreas = [
            new Size2D(20, 30),
            new Size2D(20, 15), // Shortest area
            new Size2D(20, 30)
        ];
        // Should return the minimum height (15)
        assert.strictEqual(getMaxTowerHeightInAvailableArea(towerHorizontalRange, availableTowerAreas), 15);
    });
    test('tower at left edge of available areas', () => {
        const towerHorizontalRange = new OffsetRange(0, 10); // width of 10
        const availableTowerAreas = [new Size2D(50, 30)];
        // Should return the available height (30)
        assert.strictEqual(getMaxTowerHeightInAvailableArea(towerHorizontalRange, availableTowerAreas), 30);
    });
    test('tower at right edge of available areas', () => {
        const towerHorizontalRange = new OffsetRange(40, 50); // width of 10
        const availableTowerAreas = [new Size2D(50, 30)];
        // Should return the available height (30)
        assert.strictEqual(getMaxTowerHeightInAvailableArea(towerHorizontalRange, availableTowerAreas), 30);
    });
    test('tower exactly matches available area', () => {
        const towerHorizontalRange = new OffsetRange(0, 50); // width of 50
        const availableTowerAreas = [new Size2D(50, 30)];
        // Should return the available height (30)
        assert.strictEqual(getMaxTowerHeightInAvailableArea(towerHorizontalRange, availableTowerAreas), 30);
    });
    test('empty available areas', () => {
        const towerHorizontalRange = new OffsetRange(0, 10); // width of 10
        const availableTowerAreas = [];
        // Should return 0 for empty areas
        assert.strictEqual(getMaxTowerHeightInAvailableArea(towerHorizontalRange, availableTowerAreas), 0);
    });
    test('tower spans exactly two available areas', () => {
        const towerHorizontalRange = new OffsetRange(10, 50); // width of 40
        const availableTowerAreas = [
            new Size2D(30, 25),
            new Size2D(30, 25)
        ];
        // Should return the minimum height across both areas (25)
        assert.strictEqual(getMaxTowerHeightInAvailableArea(towerHorizontalRange, availableTowerAreas), 25);
    });
    test('tower starts at boundary between two areas', () => {
        const towerHorizontalRange = new OffsetRange(30, 50); // width of 20
        const availableTowerAreas = [
            new Size2D(30, 25),
            new Size2D(30, 25)
        ];
        // Should return the height of the second area (25)
        assert.strictEqual(getMaxTowerHeightInAvailableArea(towerHorizontalRange, availableTowerAreas), 25);
    });
    test('tower with varying height available areas', () => {
        const towerHorizontalRange = new OffsetRange(0, 50); // width of 50
        const availableTowerAreas = [
            new Size2D(10, 30),
            new Size2D(10, 15), // Shortest area
            new Size2D(10, 25),
            new Size2D(10, 30),
            new Size2D(10, 40)
        ];
        // Should return the minimum height (15)
        assert.strictEqual(getMaxTowerHeightInAvailableArea(towerHorizontalRange, availableTowerAreas), 15);
    });
    test('tower beyond all available areas to the right', () => {
        const towerHorizontalRange = new OffsetRange(100, 110); // width of 10
        const availableTowerAreas = [new Size2D(50, 30)];
        // Should return 0 because tower is beyond available areas
        assert.strictEqual(getMaxTowerHeightInAvailableArea(towerHorizontalRange, availableTowerAreas), 0);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5b3V0LnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvdGVzdC9icm93c2VyL2xheW91dC50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDNUQsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBRXhHLEtBQUssQ0FBQywyQ0FBMkMsRUFBRSxHQUFHLEVBQUU7SUFDdkQsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxJQUFJLENBQUMseUNBQXlDLEVBQUUsR0FBRyxFQUFFO1FBQ3BELE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxXQUFXLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYztRQUNuRSxNQUFNLG1CQUFtQixHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFakQsMENBQTBDO1FBQzFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsZ0NBQWdDLENBQUMsb0JBQW9CLEVBQUUsbUJBQW1CLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNyRyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw4QkFBOEIsRUFBRSxHQUFHLEVBQUU7UUFDekMsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLFdBQVcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxjQUFjO1FBQ25FLE1BQU0sbUJBQW1CLEdBQUcs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