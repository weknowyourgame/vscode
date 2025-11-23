/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IFileDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { CHAT_CATEGORY } from './chatActions.js';
import { IChatWidgetService } from '../chat.js';
import { ChatEditorInput } from '../chatEditorInput.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { isExportableSessionData } from '../../common/chatModel.js';
import { IChatService } from '../../common/chatService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
const defaultFileName = 'chat.json';
const filters = [{ name: localize('chat.file.label', "Chat Session"), extensions: ['json'] }];
export function registerChatExportActions() {
    registerAction2(class ExportChatAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.export',
                category: CHAT_CATEGORY,
                title: localize2('chat.export.label', "Export Chat..."),
                precondition: ChatContextKeys.enabled,
                f1: true,
            });
        }
        async run(accessor, outputPath) {
            const widgetService = accessor.get(IChatWidgetService);
            const fileDialogService = accessor.get(IFileDialogService);
            const fileService = accessor.get(IFileService);
            const chatService = accessor.get(IChatService);
            const widget = widgetService.lastFocusedWidget;
            if (!widget || !widget.viewModel) {
                return;
            }
            if (!outputPath) {
                const defaultUri = joinPath(await fileDialogService.defaultFilePath(), defaultFileName);
                const result = await fileDialogService.showSaveDialog({
                    defaultUri,
                    filters
                });
                if (!result) {
                    return;
                }
                outputPath = result;
            }
            const model = chatService.getSession(widget.viewModel.sessionResource);
            if (!model) {
                return;
            }
            // Using toJSON on the model
            const content = VSBuffer.fromString(JSON.stringify(model.toExport(), undefined, 2));
            await fileService.writeFile(outputPath, content);
        }
    });
    registerAction2(class ImportChatAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.import',
                title: localize2('chat.import.label', "Import Chat..."),
                category: CHAT_CATEGORY,
                precondition: ChatContextKeys.enabled,
                f1: true,
            });
        }
        async run(accessor, ...args) {
            const fileDialogService = accessor.get(IFileDialogService);
            const fileService = accessor.get(IFileService);
            const editorService = accessor.get(IEditorService);
            const defaultUri = joinPath(await fileDialogService.defaultFilePath(), defaultFileName);
            const result = await fileDialogService.showOpenDialog({
                defaultUri,
                canSelectFiles: true,
                filters
            });
            if (!result) {
                return;
            }
            const content = await fileService.readFile(result[0]);
            try {
                const data = JSON.parse(content.value.toString());
                if (!isExportableSessionData(data)) {
                    throw new Error('Invalid chat session data');
                }
                const options = { target: { data }, pinned: true };
                await editorService.openEditor({ resource: ChatEditorInput.getNewEditorUri(), options });
            }
            catch (err) {
                throw err;
            }
        }
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEltcG9ydEV4cG9ydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0SW1wb3J0RXhwb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFFbkUsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUM3RSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDakQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRWhELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUN4RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDbEUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDcEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQzNELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUdyRixNQUFNLGVBQWUsR0FBRyxXQUFXLENBQUM7QUFDcEMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsaUJBQWlCLEVBQUUsY0FBYyxDQUFDLEVBQUUsVUFBVSxF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