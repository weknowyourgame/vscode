/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { cellRangesEqual } from '../../common/notebookRange.js';
// Challenge is List View talks about `element`, which needs extra work to convert to ICellRange as we support Folding and Cell Move
export class NotebookCellSelectionCollection extends Disposable {
    constructor() {
        super(...arguments);
        this._onDidChangeSelection = this._register(new Emitter());
        this._primary = { start: 0, end: 0 };
        this._selections = [{ start: 0, end: 0 }];
    }
    get onDidChangeSelection() { return this._onDidChangeSelection.event; }
    get selections() {
        return this._selections;
    }
    get focus() {
        return this._primary;
    }
    setState(primary, selections, forceEventEmit, source) {
        const validPrimary = primary ?? { start: 0, end: 0 };
        const validSelections = selections.length > 0 ? selections : [{ start: 0, end: 0 }];
        const changed = !cellRangesEqual([validPrimary], [this._primary]) || !cellRangesEqual(this._selections, validSelections);
        this._primary = validPrimary;
        this._selections = validSelections;
        if (changed || forceEventEmit) {
            this._onDidChangeSelection.fire(source);
        }
    }
    setSelections(selections, forceEventEmit, source) {
        this.setState(this._primary, selections, forceEventEmit, source);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2VsbFNlbGVjdGlvbkNvbGxlY3Rpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svYnJvd3Nlci92aWV3TW9kZWwvY2VsbFNlbGVjdGlvbkNvbGxlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLHFDQUFxQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsZUFBZSxFQUFjLE1BQU0sK0JBQStCLENBQUM7QUFFNUUsb0lBQW9JO0FBQ3BJLE1BQU0sT0FBTywrQkFBZ0MsU0FBUSxVQUFVO0lBQS9EOztRQUVrQiwwQkFBcUIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFVLENBQUMsQ0FBQztRQUd2RSxhQUFRLEdBQWUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQztRQUU1QyxnQkFBVyxHQUFpQixDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQTBCNUQsQ0FBQztJQTlCQSxJQUFJLG9CQUFvQixLQUFvQixPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBTXRGLElBQUksVUFBVTtRQUNiLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQztJQUN6QixDQUFDO0lBRUQsSUFBSSxLQUFLO1FBQ1IsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDO0lBQ3RCLENBQUM7SUFFRCxRQUFRLENBQUMsT0FBMEIsRUFBRSxVQUF3QixFQUFFLGNBQXVCLEVBQUUsTUFBd0I7UUFDL0csTUFBTSxZQUFZLEdBQUcsT0FBTyxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUM7UUFDckQsTUFBTSxlQUFlLEdBQUcsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFcEYsTUFBTSxPQUFPLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFFekgsSUFBSSxDQUFDLFFBQVEsR0FBRyxZQUFZLENBQUM7UUFDN0IsSUFBSSxDQUFDLFdBQVcsR0FBRyxlQUFlLENBQUM7UUFDbkMsSUFBSSxPQUFPLElBQUksY0FBYyxFQUFFLENBQUM7WUFDL0IsSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN6QyxDQUFDO0lBQ0YsQ0FBQztJQUVELGFBQWEsQ0FBQyxVQUF3QixFQUFFLGNBQXVCLEVBQUUsTUFBd0I7UUFDeEYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDbEUsQ0FBQztDQUNEIn0=