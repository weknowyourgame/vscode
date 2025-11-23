/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Schemas } from '../../../../../base/common/network.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { localize2 } from '../../../../../nls.js';
import { Action2, MenuId } from '../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ResourceContextKey } from '../../../../common/contextkeys.js';
import { ITextFileService } from '../../../../services/textfile/common/textfiles.js';
import { chatEditingWidgetFileStateContextKey } from '../../common/chatEditingService.js';
import { getCleanPromptName } from '../../common/promptSyntax/config/promptFileLocations.js';
import { AGENT_LANGUAGE_ID, INSTRUCTIONS_LANGUAGE_ID, PROMPT_LANGUAGE_ID, PromptsType } from '../../common/promptSyntax/promptTypes.js';
import { CHAT_CATEGORY } from '../actions/chatActions.js';
import { askForPromptFileName } from './pickers/askForPromptName.js';
import { askForPromptSourceFolder } from './pickers/askForPromptSourceFolder.js';
class BaseSaveAsPromptFileAction extends Action2 {
    constructor(opts, promptType) {
        super(opts);
        this.promptType = promptType;
    }
    async run(accessor, configUri) {
        const instantiationService = accessor.get(IInstantiationService);
        const codeEditorService = accessor.get(ICodeEditorService);
        const textFileService = accessor.get(ITextFileService);
        const fileService = accessor.get(IFileService);
        const activeCodeEditor = codeEditorService.getActiveCodeEditor();
        if (!activeCodeEditor) {
            return;
        }
        const model = activeCodeEditor.getModel();
        if (!model) {
            return;
        }
        const newFolder = await instantiationService.invokeFunction(askForPromptSourceFolder, this.promptType, undefined, true);
        if (!newFolder) {
            return;
        }
        const newName = await instantiationService.invokeFunction(askForPromptFileName, this.promptType, newFolder.uri, getCleanPromptName(model.uri));
        if (!newName) {
            return;
        }
        const newFile = joinPath(newFolder.uri, newName);
        if (model.uri.scheme === Schemas.untitled) {
            await textFileService.saveAs(model.uri, newFile, { from: model.uri });
        }
        else {
            await fileService.copy(model.uri, newFile);
        }
        await codeEditorService.openCodeEditor({ resource: newFile }, activeCodeEditor);
    }
}
function createOptions(id, title, description, languageId) {
    return {
        id: id,
        title: title,
        metadata: {
            description: description,
        },
        category: CHAT_CATEGORY,
        f1: false,
        menu: {
            id: MenuId.EditorContent,
            when: ContextKeyExpr.and(ContextKeyExpr.equals(ResourceContextKey.Scheme.key, Schemas.untitled), ContextKeyExpr.equals(ResourceContextKey.LangId.key, languageId), ContextKeyExpr.notEquals(chatEditingWidgetFileStateContextKey.key, 0 /* ModifiedFileEntryState.Modified */))
        }
    };
}
export const SAVE_AS_PROMPT_FILE_ACTION_ID = 'workbench.action.chat.save-as-prompt';
export class SaveAsPromptFileAction extends BaseSaveAsPromptFileAction {
    constructor() {
        super(createOptions(SAVE_AS_PROMPT_FILE_ACTION_ID, localize2('promptfile.savePromptFile', "Save As Prompt File"), localize2('promptfile.savePromptFile.description', "Save as prompt file"), PROMPT_LANGUAGE_ID), PromptsType.prompt);
    }
}
export const SAVE_AS_AGENT_FILE_ACTION_ID = 'workbench.action.chat.save-as-agent';
export class SaveAsAgentFileAction extends BaseSaveAsPromptFileAction {
    constructor() {
        super(createOptions(SAVE_AS_AGENT_FILE_ACTION_ID, localize2('promptfile.saveAgentFile', "Save As Agent File"), localize2('promptfile.saveAgentFile.description', "Save as agent file"), AGENT_LANGUAGE_ID), PromptsType.agent);
    }
}
export const SAVE_AS_INSTRUCTIONS_FILE_ACTION_ID = 'workbench.action.chat.save-as-instructions';
export class SaveAsInstructionsFileAction extends BaseSaveAsPromptFileAction {
    constructor() {
        super(createOptions(SAVE_AS_INSTRUCTIONS_FILE_ACTION_ID, localize2('promptfile.saveInstructionsFile', "Save As Instructions File"), localize2('promptfile.saveInstructionsFile.description', "Save as instructions file"), INSTRUCTIONS_LANGUAGE_ID), PromptsType.instructions);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2F2ZUFzUHJvbXB0RmlsZUFjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL3Byb21wdFN5bnRheC9zYXZlQXNQcm9tcHRGaWxlQWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRW5FLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ2pHLE9BQU8sRUFBb0IsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFFcEUsT0FBTyxFQUFFLE9BQU8sRUFBbUIsTUFBTSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDckcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUM3RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNyRixPQUFPLEVBQUUsb0NBQW9DLEVBQTBCLE1BQU0sb0NBQW9DLENBQUM7QUFDbEgsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDN0YsT0FBTyxFQUFFLGlCQUFpQixFQUFFLHdCQUF3QixFQUFFLGtCQUFrQixFQUFFLFdBQVcsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3hJLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUMxRCxPQUFPLEVBQUUs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