/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../base/common/codicons.js';
import * as nls from '../../../../../nls.js';
import { registerIcon } from '../../../../../platform/theme/common/iconRegistry.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
const ChatManagementEditorIcon = registerIcon('ai-management-editor-label-icon', Codicon.copilot, nls.localize('aiManagementEditorLabelIcon', 'Icon of the AI Management editor label.'));
const ModelsManagementEditorIcon = registerIcon('models-management-editor-label-icon', Codicon.settings, nls.localize('modelsManagementEditorLabelIcon', 'Icon of the Models Management editor label.'));
export const CHAT_MANAGEMENT_SECTION_USAGE = 'usage';
export const CHAT_MANAGEMENT_SECTION_MODELS = 'models';
export class ChatManagementEditorInput extends EditorInput {
    static { this.ID = 'workbench.input.chatManagement'; }
    constructor() {
        super();
        this.resource = undefined;
    }
    matches(otherInput) {
        return super.matches(otherInput) || otherInput instanceof ChatManagementEditorInput;
    }
    get typeId() {
        return ChatManagementEditorInput.ID;
    }
    getName() {
        return nls.localize('aiManagementEditorInputName', "Manage Copilot");
    }
    getIcon() {
        return ChatManagementEditorIcon;
    }
    async resolve() {
        return null;
    }
}
export class ModelsManagementEditorInput extends EditorInput {
    static { this.ID = 'workbench.input.modelsManagement'; }
    constructor() {
        super();
        this.resource = undefined;
    }
    matches(otherInput) {
        return super.matches(otherInput) || otherInput instanceof ModelsManagementEditorInput;
    }
    get typeId() {
        return ModelsManagementEditorInput.ID;
    }
    getName() {
        return nls.localize('modelsManagementEditorInputName', "Language Models");
    }
    getIcon() {
        return ModelsManagementEditorIcon;
    }
    async resolve() {
        return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1hbmFnZW1lbnRFZGl0b3JJbnB1dC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdE1hbmFnZW1lbnQvY2hhdE1hbmFnZW1lbnRFZGl0b3JJbnB1dC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFakUsT0FBTyxLQUFLLEdBQUcsTUFBTSx1QkFBdUIsQ0FBQztBQUM3QyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFcEYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRXZFLE1BQU0sd0JBQXdCLEdBQUcsWUFBWSxDQUFDLGlDQUFpQyxFQUFFLE9BQU8sQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyw2QkFBNkIsRUFBRSx5Q0FBeUMsQ0FBQyxDQUFDLENBQUM7QUFDMUwsTUFBTSwwQkFBMEIsR0FBRyxZQUFZLENBQUMscUNBQXFDLEVBQUUsT0FBTyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLGlDQUFpQyxFQUFFLDZDQUE2QyxDQUFDLENBQUMsQ0FBQztBQUV6TSxNQUFNLENBQUMsTUFBTSw2QkFBNkIsR0FBRyxPQUFPLENBQUM7QUFDckQsTUFBTSxDQUFDLE1BQU0sOEJBQThCLEdBQUcsUUFBUSxDQUFDO0FBRXZELE1BQU0sT0FBTyx5QkFBMEIsU0FBUSxXQUFXO2FBRXpDLE9BQUUsR0FBVyxnQ0FBZ0MsQUFBM0MsQ0FBNEM7SUFJOUQ7UUFDQyxLQUFLLEVBQUUsQ0FBQztRQUhBLGFBQVEsR0FBRyxTQUFTLENBQUM7SUFJOUIsQ0FBQztJQUVRLE9BQU8sQ0FBQyxVQUE2QztRQUM3RCxPQUFPLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksVUFBVSxZQUFZLHlCQUF5QixDQUFDO0lBQ3JGLENBQUM7SUFFRCxJQUFhLE1BQU07UUFDbEIsT0FBTyx5QkFBeUIsQ0FBQyxFQUFFLENBQUM7SUFDckMsQ0FBQztJQUVRLE9BQU87UUFDZixPQUFPLEdBQUcsQ0FBQyxRQUFRLENBQUMsNkJBQTZCLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBRVEsT0FBTztRQUNmLE9BQU8sd0JBQXdCLENBQUM7SUFDakMsQ0FBQztJQUVRLEtBQUssQ0FBQyxPQUFPO1FBQ3JCLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQzs7QUFHRixNQUFNLE9BQU8sMkJBQTRCLFNBQVEsV0FBVzthQUUzQyxPQUFFLEdBQVcsa0NBQWtDLEFBQTdDLENBQThDO0lBSWhFO1FBQ0MsS0FBSyxFQUFFLENBQUM7UUFIQSxhQUFRLEdBQUcsU0FBUyxDQUFDO0lBSTlCLENBQUM7SUFFUSxPQUFPLENBQUMsVUFBNkM7UUFDN0QsT0FBTyxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLFVBQVUsWUFBWSwyQkFBMkIsQ0FBQztJQUN2RixDQUFDO0lBRUQsSUFBYSxNQUFNO1FBQ2xCLE9BQU8sMkJBQTJCLENBQUMsRUFBRSxDQUFDO0lBQ3ZDLENBQUM7SUFFUSxPQUFPO1FBQ2YsT0FBTyxHQUFHLENBQUMsUUFBUSxDQUFDLGlDQUFpQyxFQUFFLGlCQUFpQixDQUFDLENBQUM7SUFDM0UsQ0FBQztJQUVRLE9BQU87UUFDZixPQUFPLDBCQUEwQixDQUFDO0lBQ25DLENBQUM7SUFFUSxLQUFLLENBQUMsT0FBTztRQUNyQixPQUFPLElBQUksQ0FBQztJQUNiLENBQUMifQ==