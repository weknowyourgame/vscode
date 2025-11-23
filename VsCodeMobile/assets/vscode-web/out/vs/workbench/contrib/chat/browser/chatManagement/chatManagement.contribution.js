/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isObject, isString } from '../../../../../base/common/types.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { ProductQualityContext } from '../../../../../platform/contextkey/common/contextkeys.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor } from '../../../../browser/editor.js';
import { EditorExtensions } from '../../../../common/editor.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { CONTEXT_MODELS_EDITOR, CONTEXT_MODELS_SEARCH_FOCUS, MANAGE_CHAT_COMMAND_ID } from '../../common/constants.js';
import { CHAT_CATEGORY } from '../actions/chatActions.js';
import { ChatManagementEditor, ModelsManagementEditor } from './chatManagementEditor.js';
import { ChatManagementEditorInput, ModelsManagementEditorInput } from './chatManagementEditorInput.js';
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(ChatManagementEditor, ChatManagementEditor.ID, localize('chatManagementEditor', "Chat Management Editor")), [
    new SyncDescriptor(ChatManagementEditorInput)
]);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(ModelsManagementEditor, ModelsManagementEditor.ID, localize('modelsManagementEditor', "Models Management Editor")), [
    new SyncDescriptor(ModelsManagementEditorInput)
]);
class ChatManagementEditorInputSerializer {
    canSerialize(editorInput) {
        return true;
    }
    serialize(input) {
        return '';
    }
    deserialize(instantiationService) {
        return instantiationService.createInstance(ChatManagementEditorInput);
    }
}
class ModelsManagementEditorInputSerializer {
    canSerialize(editorInput) {
        return true;
    }
    serialize(input) {
        return '';
    }
    deserialize(instantiationService) {
        return instantiationService.createInstance(ModelsManagementEditorInput);
    }
}
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(ChatManagementEditorInput.ID, ChatManagementEditorInputSerializer);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(ModelsManagementEditorInput.ID, ModelsManagementEditorInputSerializer);
function sanitizeString(arg) {
    return isString(arg) ? arg : undefined;
}
function sanitizeOpenManageCopilotEditorArgs(input) {
    if (!isObject(input)) {
        input = {};
    }
    const args = input;
    return {
        query: sanitizeString(args?.query),
        section: sanitizeString(args?.section)
    };
}
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: MANAGE_CHAT_COMMAND_ID,
            title: localize2('openAiManagement', "Manage Language Models"),
            category: CHAT_CATEGORY,
            precondition: ContextKeyExpr.and(ProductQualityContext.notEqualsTo('stable'), ChatContextKeys.enabled, ContextKeyExpr.or(ChatContextKeys.Entitlement.planFree, ChatContextKeys.Entitlement.planPro, ChatContextKeys.Entitlement.planProPlus, ChatContextKeys.Entitlement.internal)),
            f1: true,
        });
    }
    async run(accessor, args) {
        const editorGroupsService = accessor.get(IEditorGroupsService);
        args = sanitizeOpenManageCopilotEditorArgs(args);
        return editorGroupsService.activeGroup.openEditor(new ModelsManagementEditorInput(), { pinned: true });
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'chat.models.action.clearSearchResults',
            precondition: CONTEXT_MODELS_EDITOR,
            keybinding: {
                primary: 9 /* KeyCode.Escape */,
                weight: 100 /* KeybindingWeight.EditorContrib */,
                when: CONTEXT_MODELS_SEARCH_FOCUS
            },
            title: localize2('models.clearResults', "Clear Models Search Results")
        });
    }
    run(accessor) {
        const activeEditorPane = accessor.get(IEditorService).activeEditorPane;
        if (activeEditorPane instanceof ModelsManagementEditor) {
            activeEditorPane.clearSearch();
        }
        return null;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1hbmFnZW1lbnQuY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0TWFuYWdlbWVudC9jaGF0TWFuYWdlbWVudC5jb250cmlidXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzVELE9BQU8sRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDN0YsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUc3RixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDL0UsT0FBTyxFQUF1QixvQkFBb0IsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQzFGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBNkMsTUFBTSw4QkFBOEIsQ0FBQztBQUUzRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUNqRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDckYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSwyQkFBMkIsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ3ZILE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztB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