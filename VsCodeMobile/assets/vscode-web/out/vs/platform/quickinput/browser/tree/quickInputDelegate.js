/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { QuickInputTreeRenderer } from './quickInputTreeRenderer.js';
/**
 * Delegate for QuickInputTree that provides height and template information.
 */
export class QuickInputTreeDelegate {
    getHeight(_element) {
        return 22;
    }
    getTemplateId(_element) {
        return QuickInputTreeRenderer.ID;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVpY2tJbnB1dERlbGVnYXRlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3F1aWNraW5wdXQvYnJvd3Nlci90cmVlL3F1aWNrSW5wdXREZWxlZ2F0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUloRyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUVyRTs7R0FFRztBQUNILE1BQU0sT0FBTyxzQkFBc0I7SUFDbEMsU0FBUyxDQUFDLFFBQVc7UUFDcEIsT0FBTyxFQUFFLENBQUM7SUFDWCxDQUFDO0lBRUQsYUFBYSxDQUFDLFFBQVc7UUFDeEIsT0FBTyxzQkFBc0IsQ0FBQyxFQUFFLENBQUM7SUFDbEMsQ0FBQztDQUNEIn0=