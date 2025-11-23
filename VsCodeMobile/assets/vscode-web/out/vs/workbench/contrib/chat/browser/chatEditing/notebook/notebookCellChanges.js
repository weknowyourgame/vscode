/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export function countChanges(changes) {
    return changes.reduce((count, change) => {
        const diff = change.diff.get();
        // When we accept some of the cell insert/delete the items might still be in the list.
        if (diff.identical) {
            return count;
        }
        switch (change.type) {
            case 'delete':
                return count + 1; // We want to see 1 deleted entry in the pill for navigation
            case 'insert':
                return count + 1; // We want to see 1 new entry in the pill for navigation
            case 'modified':
                return count + diff.changes.length;
            default:
                return count;
        }
    }, 0);
}
export function sortCellChanges(changes) {
    const indexes = new Map();
    changes.forEach((c, i) => indexes.set(c, i));
    return [...changes].sort((a, b) => {
        // For unchanged and modified, use modifiedCellIndex
        if ((a.type === 'unchanged' || a.type === 'modified') &&
            (b.type === 'unchanged' || b.type === 'modified')) {
            return a.modifiedCellIndex - b.modifiedCellIndex;
        }
        // For delete entries, use originalCellIndex
        if (a.type === 'delete' && b.type === 'delete') {
            return a.originalCellIndex - b.originalCellIndex;
        }
        // For insert entries, use modifiedCellIndex
        if (a.type === 'insert' && b.type === 'insert') {
            return a.modifiedCellIndex - b.modifiedCellIndex;
        }
        if (a.type === 'delete' && b.type === 'insert') {
            // If the deleted cell comes before the inserted cell, we want the delete to come first
            // As this means the cell was deleted before it was inserted
            // We would like to see the deleted cell first in the list
            // Else in the UI it would look weird to see an inserted cell before a deleted cell,
            // When the users operation was to first delete the cell and then insert a new one
            // I.e. this is merely just a simple way to ensure we have a stable sort.
            return indexes.get(a) - indexes.get(b);
        }
        if (a.type === 'insert' && b.type === 'delete') {
            // If the deleted cell comes before the inserted cell, we want the delete to come first
            // As this means the cell was deleted before it was inserted
            // We would like to see the deleted cell first in the list
            // Else in the UI it would look weird to see an inserted cell before a deleted cell,
            // When the users operation was to first delete the cell and then insert a new one
            // I.e. this is merely just a simple way to ensure we have a stable sort.
            return indexes.get(a) - indexes.get(b);
        }
        if ((a.type === 'delete' && b.type !== 'insert') || (a.type !== 'insert' && b.type === 'delete')) {
            return a.originalCellIndex - b.originalCellIndex;
        }
        // Mixed types: compare based on available indices
        const aIndex = a.type === 'delete' ? a.originalCellIndex :
            (a.type === 'insert' ? a.modifiedCellIndex : a.modifiedCellIndex);
        const bIndex = b.type === 'delete' ? b.originalCellIndex :
            (b.type === 'insert' ? b.modifiedCellIndex : b.modifiedCellIndex);
        return aIndex - bIndex;
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tDZWxsQ2hhbmdlcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvbm90ZWJvb2svbm90ZWJvb2tDZWxsQ2hhbmdlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQTREaEcsTUFBTSxVQUFVLFlBQVksQ0FBQyxPQUF3QjtJQUNwRCxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEVBQUU7UUFDdkMsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUMvQixzRkFBc0Y7UUFDdEYsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDcEIsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBQ0QsUUFBUSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDckIsS0FBSyxRQUFRO2dCQUNaLE9BQU8sS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLDREQUE0RDtZQUMvRSxLQUFLLFFBQVE7Z0JBQ1osT0FBTyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsd0RBQXdEO1lBQzNFLEtBQUssVUFBVTtnQkFDZCxPQUFPLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztZQUNwQztnQkFDQyxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7SUFDRixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFFUCxDQUFDO0FBRUQsTUFBTSxVQUFVLGVBQWUsQ0FBQyxPQUF3QjtJQUN2RCxNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBeUIsQ0FBQztJQUNqRCxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FB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