/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * The tower areas are arranged from left to right, touch and are aligned at the bottom.
 * How high can a tower be placed at the requested horizontal range, so that its size fits into the union of the stacked availableTowerAreas?
 */
export function getMaxTowerHeightInAvailableArea(towerHorizontalRange, availableTowerAreas) {
    const towerLeftOffset = towerHorizontalRange.start;
    const towerRightOffset = towerHorizontalRange.endExclusive;
    let minHeight = Number.MAX_VALUE;
    // Calculate the accumulated width to find which tower areas the requested tower overlaps
    let currentLeftOffset = 0;
    for (const availableArea of availableTowerAreas) {
        const currentRightOffset = currentLeftOffset + availableArea.width;
        // Check if the requested tower overlaps with this available area
        const overlapLeft = Math.max(towerLeftOffset, currentLeftOffset);
        const overlapRight = Math.min(towerRightOffset, currentRightOffset);
        if (overlapLeft < overlapRight) {
            // There is an overlap - track the minimum height
            minHeight = Math.min(minHeight, availableArea.height);
        }
        currentLeftOffset = currentRightOffset;
    }
    if (towerRightOffset > currentLeftOffset) {
        return 0;
    }
    // If no overlap was found, return 0
    return minHeight === Number.MAX_VALUE ? 0 : minHeight;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG93ZXJzTGF5b3V0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvdmlldy9pbmxpbmVFZGl0cy91dGlscy90b3dlcnNMYXlvdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFLaEc7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLGdDQUFnQyxDQUFDLG9CQUFpQyxFQUFFLG1CQUE2QjtJQUNoSCxNQUFNLGVBQWUsR0FBRyxvQkFBb0IsQ0FBQyxLQUFLLENBQUM7SUFDbkQsTUFBTSxnQkFBZ0IsR0FBRyxvQkFBb0IsQ0FBQyxZQUFZLENBQUM7SUFFM0QsSUFBSSxTQUFTLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQztJQUVqQyx5RkFBeUY7SUFDekYsSUFBSSxpQkFBaUIsR0FBRyxDQUFDLENBQUM7SUFDMUIsS0FBSyxNQUFNLGFBQWEsSUFBSSxtQkFBbUIsRUFBRSxDQUFDO1FBQ2pELE1BQU0sa0JBQWtCLEdBQUcsaUJBQWlCLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQztRQUVuRSxpRUFBaUU7UUFDakUsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztRQUNqRSxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFFcEUsSUFBSSxXQUFXLEdBQUcsWUFBWSxFQUFFLENBQUM7WUFDaEMsaURBQWlEO1lBQ2pELFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdkQsQ0FBQztRQUVELGlCQUFpQixHQUFHLGtCQUFrQixDQUFDO0lBQ3hDLENBQUM7SUFFRCxJQUFJLGdCQUFnQixHQUFHLGlCQUFpQixFQUFFLENBQUM7UUFDMUMsT0FBTyxDQUFDLENBQUM7SUFDVixDQUFDO0lBRUQsb0NBQW9DO0lBQ3BDLE9BQU8sU0FBUyxLQUFLLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0FBQ3ZELENBQUMifQ==