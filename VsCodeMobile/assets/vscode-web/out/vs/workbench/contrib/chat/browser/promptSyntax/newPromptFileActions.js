/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isEqual } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { getCodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { SnippetController2 } from '../../../../../editor/contrib/snippet/browser/snippetController2.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { INotificationService, NeverShowAgainScope, Severity } from '../../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { getLanguageIdForPromptsType, PromptsType } from '../../common/promptSyntax/promptTypes.js';
import { IUserDataSyncEnablementService } from '../../../../../platform/userDataSync/common/userDataSync.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { CONFIGURE_SYNC_COMMAND_ID } from '../../../../services/userDataSync/common/userDataSync.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { CHAT_CATEGORY } from '../actions/chatActions.js';
import { askForPromptFileName } from './pickers/askForPromptName.js';
import { askForPromptSourceFolder } from './pickers/askForPromptSourceFolder.js';
import { IChatModeService } from '../../common/chatModes.js';
class AbstractNewPromptFileAction extends Action2 {
    constructor(id, title, type) {
        super({
            id,
            title,
            f1: false,
            precondition: ChatContextKeys.enabled,
            category: CHAT_CATEGORY,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */
            },
            menu: {
                id: MenuId.CommandPalette,
                when: ChatContextKeys.enabled
            }
        });
        this.type = type;
    }
    async run(accessor) {
        const logService = accessor.get(ILogService);
        const openerService = accessor.get(IOpenerService);
        const commandService = accessor.get(ICommandService);
        const notificationService = accessor.get(INotificationService);
        const userDataSyncEnablementService = accessor.get(IUserDataSyncEnablementService);
        const editorService = accessor.get(IEditorService);
        const fileService = accessor.get(IFileService);
        const instaService = accessor.get(IInstantiationService);
        const chatModeService = accessor.get(IChatModeService);
        const selectedFolder = await instaService.invokeFunction(askForPromptSourceFolder, this.type);
        if (!selectedFolder) {
            return;
        }
        const fileName = await instaService.invokeFunction(askForPromptFileName, this.type, selectedFolder.uri);
        if (!fileName) {
            return;
        }
        // create the prompt file
        await fileService.createFolder(selectedFolder.uri);
        const promptUri = URI.joinPath(selectedFolder.uri, fileName);
        await fileService.createFile(promptUri);
        await openerService.open(promptUri);
        const editor = getCodeEditor(editorService.activeTextEditorControl);
        if (editor && editor.hasModel() && isEqual(editor.getModel().uri, promptUri)) {
            SnippetController2.get(editor)?.apply([{
                    range: editor.getModel().getFullModelRange(),
                    template: getDefaultContentSnippet(this.type, chatModeService),
                }]);
        }
        if (selectedFolder.storage !== 'user') {
            return;
        }
        // due to PII concerns, synchronization of the 'user' reusable prompts
        // is disabled by default, but we want to make that fact clear to the user
        // hence after a 'user' prompt is create, we check if the synchronization
        // was explicitly configured before, and if it wasn't, we show a suggestion
        // to enable the synchronization logic in the Settings Sync configuration
        const isConfigured = userDataSyncEnablementService
            .isResourceEnablementConfigured("prompts" /* SyncResource.Prompts */);
        const isSettingsSyncEnabled = userDataSyncEnablementService.isEnabled();
        // if prompts synchronization has already been configured before or
        // if settings sync service is currently disabled, nothing to do
        if ((isConfigured === true) || (isSettingsSyncEnabled === false)) {
            return;
        }
        // show suggestion to enable synchronization of the user prompts and instructions to the user
        notificationService.prompt(Severity.Info, localize('workbench.command.prompts.create.user.enable-sync-notification', "Do you want to backup and sync your user prompt, instruction and custom agent files with Setting Sync?'"), [
            {
                label: localize('enable.capitalized', "Enable"),
                run: () => {
                    commandService.executeCommand(CONFIGURE_SYNC_COMMAND_ID)
                        .catch((error) => {
                        logService.error(`Failed to run '${CONFIGURE_SYNC_COMMAND_ID}' command: ${error}.`);
                    });
                },
            },
            {
                label: localize('learnMore.capitalized', "Learn More"),
                run: () => {
                    openerService.open(URI.parse('https://aka.ms/vscode-settings-sync-help'));
                },
            },
        ], {
            neverShowAgain: {
                id: 'workbench.command.prompts.create.user.enable-sync-notification',
                scope: NeverShowAgainScope.PROFILE,
            },
        });
    }
}
function getDefaultContentSnippet(promptType, chatModeService) {
    const agents = chatModeService.getModes();
    const agentNames = agents.builtin.map(agent => agent.name.get()).join(',') + (agents.custom.length ? (',' + agents.custom.map(agent => agent.name.get()).join(',')) : '');
    switch (promptType) {
        case PromptsType.prompt:
            return [
                `---`,
                `agent: \${1|${agentNames}|}`,
                `---`,
                `\${2:Define the task to achieve, including specific requirements, constraints, and success criteria.}`,
            ].join('\n');
        case PromptsType.instructions:
            return [
                `---`,
                `applyTo: '\${1|**,**/*.ts|}'`,
                `---`,
                `\${2:Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.}`,
            ].join('\n');
        case PromptsType.agent:
            return [
                `---`,
                `description: '\${1:Describe what this custom agent does and when to use it.}'`,
                `tools: []`,
                `---`,
                `\${2:Define what this custom agent accomplishes for the user, when to use it, and the edges it won't cross. Specify its ideal inputs/outputs, the tools it may call, and how it reports progress or asks for help.}`,
            ].join('\n');
        default:
            throw new Error(`Unknown prompt type: ${promptType}`);
    }
}
export const NEW_PROMPT_COMMAND_ID = 'workbench.command.new.prompt';
export const NEW_INSTRUCTIONS_COMMAND_ID = 'workbench.command.new.instructions';
export const NEW_AGENT_COMMAND_ID = 'workbench.command.new.agent';
class NewPromptFileAction extends AbstractNewPromptFileAction {
    constructor() {
        super(NEW_PROMPT_COMMAND_ID, localize('commands.new.prompt.local.title', "New Prompt File..."), PromptsType.prompt);
    }
}
class NewInstructionsFileAction extends AbstractNewPromptFileAction {
    constructor() {
        super(NEW_INSTRUCTIONS_COMMAND_ID, localize('commands.new.instructions.local.title', "New Instructions File..."), PromptsType.instructions);
    }
}
class NewAgentFileAction extends AbstractNewPromptFileAction {
    constructor() {
        super(NEW_AGENT_COMMAND_ID, localize('commands.new.agent.local.title', "New Custom Agent..."), PromptsType.agent);
    }
}
class NewUntitledPromptFileAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.command.new.untitled.prompt',
            title: localize2('commands.new.untitled.prompt.title', "New Untitled Prompt File"),
            f1: true,
            precondition: ChatContextKeys.enabled,
            category: CHAT_CATEGORY,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */
            },
        });
    }
    async run(accessor) {
        const editorService = accessor.get(IEditorService);
        const chatModeService = accessor.get(IChatModeService);
        const languageId = getLanguageIdForPromptsType(PromptsType.prompt);
        const input = await editorService.openEditor({
            resource: undefined,
            languageId,
            options: {
                pinned: true
            }
        });
        const type = PromptsType.prompt;
        const editor = getCodeEditor(editorService.activeTextEditorControl);
        if (editor && editor.hasModel()) {
            SnippetController2.get(editor)?.apply([{
                    range: editor.getModel().getFullModelRange(),
                    template: getDefaultContentSnippet(type, chatModeService),
                }]);
        }
        return input;
    }
}
export function registerNewPromptFileActions() {
    registerAction2(NewPromptFileAction);
    registerAction2(NewInstructionsFileAction);
    registerAction2(NewAgentFileAction);
    registerAction2(NewUntitledPromptFileAction);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV3UHJvbXB0RmlsZUFjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL3Byb21wdFN5bnRheC9uZXdQcm9tcHRGaWxlQWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDbEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMvRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxxRUFBcUUsQ0FBQztBQUN6RyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzVELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN0RixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDN0UsT0FBTyxFQUFFLHFCQUFxQixFQUFvQixNQUFNLCtEQUErRCxDQUFDO0FBRXhILE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsbUJBQW1CLEVBQUUsUUFBUSxFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDbEksT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxXQUFXLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNwRyxPQUFPLEVBQUUsOEJBQThCLEVBQWdCLE1BQU0sNkRBQTZELENBQUM7QUFDM0gsT0FB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