/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { extUri, isEqual } from '../../../../../../base/common/resources.js';
import { URI } from '../../../../../../base/common/uri.js';
import { localize } from '../../../../../../nls.js';
import { ILabelService } from '../../../../../../platform/label/common/label.js';
import { IOpenerService } from '../../../../../../platform/opener/common/opener.js';
import { PROMPT_DOCUMENTATION_URL, PromptsType } from '../../../common/promptSyntax/promptTypes.js';
import { IQuickInputService } from '../../../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService } from '../../../../../../platform/workspace/common/workspace.js';
import { IPromptsService, PromptsStorage } from '../../../common/promptSyntax/service/promptsService.js';
/**
 * Asks the user for a specific prompt folder, if multiple folders provided.
 */
export async function askForPromptSourceFolder(accessor, type, existingFolder, isMove = false) {
    const quickInputService = accessor.get(IQuickInputService);
    const promptsService = accessor.get(IPromptsService);
    const labelService = accessor.get(ILabelService);
    const workspaceService = accessor.get(IWorkspaceContextService);
    // get prompts source folders based on the prompt type
    const folders = promptsService.getSourceFolders(type);
    // if no source folders found, show 'learn more' dialog
    // note! this is a temporary solution and must be replaced with a dialog to select
    //       a custom folder path, or switch to a different prompt type
    if (folders.length === 0) {
        await showNoFoldersDialog(accessor, type);
        return;
    }
    const pickOptions = {
        placeHolder: existingFolder ? getPlaceholderStringforMove(type, isMove) : getPlaceholderStringforNew(type),
        canPickMany: false,
        matchOnDescription: true,
    };
    // create list of source folder locations
    const foldersList = folders.map(folder => {
        const uri = folder.uri;
        const detail = (existingFolder && isEqual(uri, existingFolder)) ? localize('current.folder', "Current Location") : undefined;
        if (folder.storage !== PromptsStorage.local) {
            return {
                type: 'item',
                label: promptsService.getPromptLocationLabel(folder),
                detail,
                tooltip: labelService.getUriLabel(uri),
                folder
            };
        }
        const { folders } = workspaceService.getWorkspace();
        const isMultirootWorkspace = (folders.length > 1);
        const firstFolder = folders[0];
        // if multi-root or empty workspace, or source folder `uri` does not point to
        // the root folder of a single-root workspace, return the default label and description
        if (isMultirootWorkspace || !firstFolder || !extUri.isEqual(firstFolder.uri, uri)) {
            return {
                type: 'item',
                label: labelService.getUriLabel(uri, { relative: true }),
                detail,
                tooltip: labelService.getUriLabel(uri),
                folder,
            };
        }
        // if source folder points to the root of this single-root workspace,
        // use appropriate label and description strings to prevent confusion
        return {
            type: 'item',
            label: localize('commands.prompts.create.source-folder.current-workspace', "Current Workspace"),
            detail,
            tooltip: labelService.getUriLabel(uri),
            folder,
        };
    });
    const answer = await quickInputService.pick(foldersList, pickOptions);
    if (!answer) {
        return;
    }
    return answer.folder;
}
function getPlaceholderStringforNew(type) {
    switch (type) {
        case PromptsType.instructions:
            return localize('workbench.command.instructions.create.location.placeholder', "Select a location to create the instructions file in...");
        case PromptsType.prompt:
            return localize('workbench.command.prompt.create.location.placeholder', "Select a location to create the prompt file in...");
        case PromptsType.agent:
            return localize('workbench.command.agent.create.location.placeholder', "Select a location to create the agent file in...");
        default:
            throw new Error('Unknown prompt type');
    }
}
function getPlaceholderStringforMove(type, isMove) {
    if (isMove) {
        switch (type) {
            case PromptsType.instructions:
                return localize('instructions.move.location.placeholder', "Select a location to move the instructions file to...");
            case PromptsType.prompt:
                return localize('prompt.move.location.placeholder', "Select a location to move the prompt file to...");
            case PromptsType.agent:
                return localize('agent.move.location.placeholder', "Select a location to move the agent file to...");
            default:
                throw new Error('Unknown prompt type');
        }
    }
    switch (type) {
        case PromptsType.instructions:
            return localize('instructions.copy.location.placeholder', "Select a location to copy the instructions file to...");
        case PromptsType.prompt:
            return localize('prompt.copy.location.placeholder', "Select a location to copy the prompt file to...");
        case PromptsType.agent:
            return localize('agent.copy.location.placeholder', "Select a location to copy the agent file to...");
        default:
            throw new Error('Unknown prompt type');
    }
}
/**
 * Shows a dialog to the user when no prompt source folders are found.
 *
 * Note! this is a temporary solution and must be replaced with a dialog to select
 *       a custom folder path, or switch to a different prompt type
 */
async function showNoFoldersDialog(accessor, type) {
    const quickInputService = accessor.get(IQuickInputService);
    const openerService = accessor.get(IOpenerService);
    const docsQuickPick = {
        type: 'item',
        label: getLearnLabel(type),
        description: PROMPT_DOCUMENTATION_URL,
        tooltip: PROMPT_DOCUMENTATION_URL,
        value: URI.parse(PROMPT_DOCUMENTATION_URL),
    };
    const result = await quickInputService.pick([docsQuickPick], {
        placeHolder: getMissingSourceFolderString(type),
        canPickMany: false,
    });
    if (result) {
        await openerService.open(result.value);
    }
}
function getLearnLabel(type) {
    switch (type) {
        case PromptsType.prompt:
            return localize('commands.prompts.create.ask-folder.empty.docs-label', 'Learn how to configure reusable prompts');
        case PromptsType.instructions:
            return localize('commands.instructions.create.ask-folder.empty.docs-label', 'Learn how to configure reusable instructions');
        case PromptsType.agent:
            return localize('commands.agent.create.ask-folder.empty.docs-label', 'Learn how to configure custom agents');
        default:
            throw new Error('Unknown prompt type');
    }
}
function getMissingSourceFolderString(type) {
    switch (type) {
        case PromptsType.instructions:
            return localize('commands.instructions.create.ask-folder.empty.placeholder', 'No instruction source folders found.');
        case PromptsType.prompt:
            return localize('commands.prompts.create.ask-folder.empty.placeholder', 'No prompt source folders found.');
        case PromptsType.agent:
            return localize('commands.agent.create.ask-folder.empty.placeholder', 'No agent source folders found.');
        default:
            throw new Error('Unknown prompt type');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNrRm9yUHJvbXB0U291cmNlRm9sZGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9wcm9tcHRTeW50YXgvcGlja2Vycy9hc2tGb3JQcm9tcHRTb3VyY2VGb2xkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUM3RSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFM0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3BELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNqRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDcEYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLFdBQVcsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3BHLE9BQU8sRUFBZ0Isa0JBQWtCLEVBQWtCLE1BQU0sNERBQTRELENBQUM7QUFDOUgsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDcEcsT0FBTyxFQUFlLGVBQWUsRUFBRSxjQUFjLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQU90SDs7R0FFRztBQUNILE1BQU0sQ0FBQyxLQUFLLFVBQVUsd0JBQXdCLENBQzdDLFFBQTBCLEVBQzFCLElBQWlCLEVBQ2pCLGNBQWdDLEVBQ2hDLFNBQWtCLEtBQUs7SUFFdkIsTUFBTSxpQkFBaUIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFDM0QsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUNyRCxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMs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