/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { derived } from '../../../../../../base/common/observable.js';
import { isSuggestionInViewport } from '../../model/inlineCompletionsModel.js';
/**
 * Warning: This is not per inline edit id and gets created often.
 * @deprecated TODO@hediet remove
*/
export class ModelPerInlineEdit {
    constructor(_model, inlineEdit, tabAction) {
        this._model = _model;
        this.inlineEdit = inlineEdit;
        this.tabAction = tabAction;
        this.isInDiffEditor = this._model.isInDiffEditor;
        this.displayLocation = this.inlineEdit.inlineCompletion.hint;
        this.inViewPort = derived(this, reader => isSuggestionInViewport(this._model.editor, this.inlineEdit.inlineCompletion, reader));
        this.onDidAccept = this._model.onDidAccept;
    }
    accept() {
        this._model.accept();
    }
    handleInlineEditShown(viewKind, viewData) {
        this._model.handleInlineSuggestionShown(this.inlineEdit.inlineCompletion, viewKind, viewData);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdHNNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvaW5saW5lRWRpdHNNb2RlbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsT0FBTyxFQUFlLE1BQU0sNkNBQTZDLENBQUM7QUFDbkYsT0FBTyxFQUEwQixzQkFBc0IsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBS3ZHOzs7RUFHRTtBQUNGLE1BQU0sT0FBTyxrQkFBa0I7SUFZOUIsWUFDa0IsTUFBOEIsRUFDdEMsVUFBaUMsRUFDakMsU0FBMkM7UUFGbkMsV0FBTSxHQUFOLE1BQU0sQ0FBd0I7UUFDdEMsZUFBVSxHQUFWLFVBQVUsQ0FBdUI7UUFDakMsY0FBUyxHQUFULFNBQVMsQ0FBa0M7UUFFcEQsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQztRQUVqRCxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDO1FBRTdELElBQUksQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUNoSSxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDO0lBQzVDLENBQUM7SUFFRCxNQUFNO1FBQ0wsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUN0QixDQUFDO0lBRUQscUJBQXFCLENBQUMsUUFBa0MsRUFBRSxRQUFrQztRQUMzRixJQUFJLENBQUMsTUFBTSxDQUFDLDJCQUEyQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQy9GLENBQUM7Q0FDRCJ9