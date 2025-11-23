/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Schemas } from '../../../../../base/common/network.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { ChatEditorInput } from '../chatEditorInput.js';
export async function clearChatEditor(accessor, chatEditorInput) {
    const editorService = accessor.get(IEditorService);
    if (!chatEditorInput) {
        const editorInput = editorService.activeEditor;
        chatEditorInput = editorInput instanceof ChatEditorInput ? editorInput : undefined;
    }
    if (chatEditorInput instanceof ChatEditorInput) {
        // If we have a contributed session, make sure we create an untitled session for it.
        // Otherwise create a generic new chat editor.
        const resource = chatEditorInput.sessionResource && chatEditorInput.sessionResource.scheme !== Schemas.vscodeLocalChatSession
            ? chatEditorInput.sessionResource.with({ path: `/untitled-${generateUuid()}` })
            : ChatEditorInput.getNewEditorUri();
        // A chat editor can only be open in one group
        const identifier = editorService.findEditors(chatEditorInput.resource)[0];
        await editorService.replaceEditors([{
                editor: chatEditorInput,
                replacement: { resource, options: { pinned: true } }
            }], identifier.groupId);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdENsZWFyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9hY3Rpb25zL2NoYXRDbGVhci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBRWxFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUVyRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFFeEQsTUFBTSxDQUFDLEtBQUssVUFBVSxlQUFlLENBQUMsUUFBMEIsRUFBRSxlQUFpQztJQUNsRyxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBRW5ELElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUN0QixNQUFNLFdBQVcsR0FBRyxhQUFhLENBQUMsWUFBWSxDQUFDO1FBQy9DLGVBQWUsR0FBRyxXQUFXLFlBQVksZUFBZSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUNwRixDQUFDO0lBRUQsSUFBSSxlQUFlLFlBQVksZUFBZSxFQUFFLENBQUM7UUFDaEQsb0ZBQW9GO1FBQ3BGLDhDQUE4QztRQUM5QyxNQUFNLFFBQVEsR0FBRyxlQUFlLENBQUMsZUFBZSxJQUFJLGVBQWUsQ0FBQyxlQUFlLENBQUMsTUFBTSxLQUFLLE9BQU8sQ0FBQyxzQkFBc0I7WUFDNUgsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLGFBQWEsWUFBWSxFQUFFLEVBQUUsRUFBRSxDQUFDO1lBQy9FLENBQUMsQ0FBQyxlQUFlLENBQUMsZUFBZSxFQUFFLENBQUM7UUFFckMsOENBQThDO1FBQzlDLE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzFFLE1BQU0sYUFBYSxDQUFDLGNBQWMsQ0FBQyxDQUFDO2dCQUNuQyxNQUFNLEVBQUUsZUFBZTtnQkFDdkIsV0FBVyxFQUFFLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQStCLEVBQUU7YUFDakYsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN6QixDQUFDO0FBQ0YsQ0FBQyJ9