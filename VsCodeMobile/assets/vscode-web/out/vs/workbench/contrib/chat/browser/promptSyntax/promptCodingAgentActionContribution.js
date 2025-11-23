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
import { Disposable, DisposableMap } from '../../../../../base/common/lifecycle.js';
import { registerEditorContribution } from '../../../../../editor/browser/editorExtensions.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { PROMPT_LANGUAGE_ID } from '../../common/promptSyntax/promptTypes.js';
import { PromptCodingAgentActionOverlayWidget } from './promptCodingAgentActionOverlay.js';
let PromptCodingAgentActionContribution = class PromptCodingAgentActionContribution extends Disposable {
    static { this.ID = 'promptCodingAgentActionContribution'; }
    constructor(_editor, _instantiationService) {
        super();
        this._editor = _editor;
        this._instantiationService = _instantiationService;
        this._overlayWidgets = this._register(new DisposableMap());
        this._register(this._editor.onDidChangeModel(() => {
            this._updateOverlayWidget();
        }));
        this._updateOverlayWidget();
    }
    _updateOverlayWidget() {
        const model = this._editor.getModel();
        // Remove existing overlay if present
        this._overlayWidgets.deleteAndDispose(this._editor);
        // Add overlay if this is a prompt file
        if (model && model.getLanguageId() === PROMPT_LANGUAGE_ID) {
            const widget = this._instantiationService.createInstance(PromptCodingAgentActionOverlayWidget, this._editor);
            this._overlayWidgets.set(this._editor, widget);
        }
    }
};
PromptCodingAgentActionContribution = __decorate([
    __param(1, IInstantiationService)
], PromptCodingAgentActionContribution);
export { PromptCodingAgentActionContribution };
registerEditorContribution(PromptCodingAgentActionContribution.ID, PromptCodingAgentActionContribution, 1 /* EditorContributionInstantiation.AfterFirstRender */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0Q29kaW5nQWdlbnRBY3Rpb25Db250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL3Byb21wdFN5bnRheC9wcm9tcHRDb2RpbmdBZ2VudEFjdGlvbkNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRXBGLE9BQU8sRUFBRSwwQkFBMEIsRUFBbUMsTUFBTSxtREFBbUQsQ0FBQztBQUNoSSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsb0NBQW9DLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUVwRixJQUFNLG1DQUFtQyxHQUF6QyxNQUFNLG1DQUFvQyxTQUFRLFVBQVU7YUFDbEQsT0FBRSxHQUFHLHFDQUFxQyxBQUF4QyxDQUF5QztJQUkzRCxZQUNrQixPQUFvQixFQUNkLHFCQUE2RDtRQUVwRixLQUFLLEVBQUUsQ0FBQztRQUhTLFlBQU8sR0FBUCxPQUFPLENBQWE7UUFDRywwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO1FBSnBFLG9CQUFlLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGFBQWEsRUFBcUQsQ0FBQyxDQUFDO1FBUXpILElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUU7WUFDakQsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7UUFDN0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO0lBQzdCLENBQUM7SUFDTyxvQkFBb0I7UUFDM0IsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUV0QyxxQ0FBcUM7UUFDckMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFcEQsdUNBQXVDO1FBQ3ZDLElBQUksS0FBSyxJQUFJLEtBQUssQ0FBQyxhQUFhLEVBQUUsS0FBSyxrQkFBa0IsRUFBRSxDQUFDO1lBQzNELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLENBQUMsb0NBQW9DLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzdHLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDaEQsQ0FBQztJQUNGLENBQUM7O0FBNUJXLG1DQUFtQztJQU83QyxXQUFBLHFCQUFxQixDQUFBO0dBUFgsbUNBQW1DLENBNkIvQzs7QUFFRCwwQkFBMEIsQ0FBQyxtQ0FBbUMsQ0FBQyxFQUFFLEVBQUUsbUNBQW1DLDJEQUFtRCxDQUFDIn0=