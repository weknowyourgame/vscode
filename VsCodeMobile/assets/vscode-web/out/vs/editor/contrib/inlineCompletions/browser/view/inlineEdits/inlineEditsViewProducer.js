/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { derived } from '../../../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { observableCodeEditor } from '../../../../../browser/observableCodeEditor.js';
import { Range } from '../../../../../common/core/range.js';
import { TextReplacement, TextEdit } from '../../../../../common/core/edits/textEdit.js';
import { TextModelText } from '../../../../../common/model/textModelText.js';
import { InlineEditWithChanges } from './inlineEditWithChanges.js';
import { ModelPerInlineEdit } from './inlineEditsModel.js';
import { InlineEditsView } from './inlineEditsView.js';
import { InlineEditTabAction } from './inlineEditsViewInterface.js';
import { InlineSuggestionGutterMenuData, SimpleInlineSuggestModel } from './components/gutterIndicatorView.js';
let InlineEditsViewAndDiffProducer = class InlineEditsViewAndDiffProducer extends Disposable {
    constructor(_editor, _edit, _model, _showCollapsed, instantiationService) {
        super();
        this._editor = _editor;
        this._edit = _edit;
        this._model = _model;
        this._showCollapsed = _showCollapsed;
        this._inlineEdit = derived(this, (reader) => {
            const model = this._model.read(reader);
            if (!model) {
                return undefined;
            }
            const inlineEdit = this._edit.read(reader);
            if (!inlineEdit) {
                return undefined;
            }
            const textModel = this._editor.getModel();
            if (!textModel) {
                return undefined;
            }
            const editOffset = model.inlineEditState.read(undefined)?.inlineSuggestion.updatedEdit;
            if (!editOffset) {
                return undefined;
            }
            const edits = editOffset.replacements.map(e => {
                const innerEditRange = Range.fromPositions(textModel.getPositionAt(e.replaceRange.start), textModel.getPositionAt(e.replaceRange.endExclusive));
                return new TextReplacement(innerEditRange, e.newText);
            });
            const diffEdits = new TextEdit(edits);
            const text = new TextModelText(textModel);
            return new InlineEditWithChanges(text, diffEdits, model.primaryPosition.read(undefined), model.allPositions.read(undefined), inlineEdit.commands, inlineEdit.inlineSuggestion);
        });
        this._inlineEditModel = derived(this, reader => {
            const model = this._model.read(reader);
            if (!model) {
                return undefined;
            }
            const edit = this._inlineEdit.read(reader);
            if (!edit) {
                return undefined;
            }
            const tabAction = derived(this, reader => {
                /** @description tabAction */
                if (this._editorObs.isFocused.read(reader)) {
                    if (model.tabShouldJumpToInlineEdit.read(reader)) {
                        return InlineEditTabAction.Jump;
                    }
                    if (model.tabShouldAcceptInlineEdit.read(reader)) {
                        return InlineEditTabAction.Accept;
                    }
                }
                return InlineEditTabAction.Inactive;
            });
            return new ModelPerInlineEdit(model, edit, tabAction);
        });
        this._editorObs = observableCodeEditor(this._editor);
        this.view = this._register(instantiationService.createInstance(InlineEditsView, this._editor, this._inlineEditModel, this._model.map(model => model ? SimpleInlineSuggestModel.fromInlineCompletionModel(model) : undefined), this._inlineEdit.map(e => e ? InlineSuggestionGutterMenuData.fromInlineSuggestion(e.inlineCompletion) : undefined), this._showCollapsed));
    }
};
InlineEditsViewAndDiffProducer = __decorate([
    __param(4, IInstantiationService)
], InlineEditsViewAndDiffProducer);
export { InlineEditsViewAndDiffProducer };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdHNWaWV3UHJvZHVjZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvYnJvd3Nlci92aWV3L2lubGluZUVkaXRzL2lubGluZUVkaXRzVmlld1Byb2R1Y2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsT0FBTyxFQUFlLE1BQU0sNkNBQTZDLENBQUM7QUFDbkYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFFekcsT0FBTyxFQUF3QixvQkFBb0IsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQzVHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUsZUFBZSxFQUFFLFFBQVEsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUc3RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNuRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDdkQsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDcEUsT0FBTyxFQUFFLDhCQUE4QixFQUFFLHdCQUF3QixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFeEcsSUFBTSw4QkFBOEIsR0FBcEMsTUFBTSw4QkFBK0IsU0FBUSxVQUFVO0lBZ0Q3RCxZQUNrQixPQUFvQixFQUNwQixLQUEwQyxFQUMxQyxNQUF1RCxFQUN2RCxjQUFvQyxFQUM5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