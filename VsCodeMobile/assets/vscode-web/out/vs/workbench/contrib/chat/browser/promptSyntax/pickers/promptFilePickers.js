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
import { localize } from '../../../../../../nls.js';
import { URI } from '../../../../../../base/common/uri.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { IPromptsService, PromptsStorage } from '../../../common/promptSyntax/service/promptsService.js';
import { dirname, extUri, joinPath } from '../../../../../../base/common/resources.js';
import { DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { IOpenerService } from '../../../../../../platform/opener/common/opener.js';
import { IDialogService } from '../../../../../../platform/dialogs/common/dialogs.js';
import { ICommandService } from '../../../../../../platform/commands/common/commands.js';
import { getCleanPromptName } from '../../../common/promptSyntax/config/promptFileLocations.js';
import { PromptsType, INSTRUCTIONS_DOCUMENTATION_URL, AGENT_DOCUMENTATION_URL, PROMPT_DOCUMENTATION_URL } from '../../../common/promptSyntax/promptTypes.js';
import { NEW_PROMPT_COMMAND_ID, NEW_INSTRUCTIONS_COMMAND_ID, NEW_AGENT_COMMAND_ID } from '../newPromptFileActions.js';
import { IQuickInputService } from '../../../../../../platform/quickinput/common/quickInput.js';
import { askForPromptFileName } from './askForPromptName.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { CancellationToken, CancellationTokenSource } from '../../../../../../base/common/cancellation.js';
import { askForPromptSourceFolder } from './askForPromptSourceFolder.js';
import { ILabelService } from '../../../../../../platform/label/common/label.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { PromptsConfig } from '../../../common/promptSyntax/config/config.js';
import { ResourceSet } from '../../../../../../base/common/map.js';
import { PromptFileRewriter } from '../promptFileRewriter.js';
/**
 * Button that opens the documentation.
 */
function newHelpButton(type) {
    const iconClass = ThemeIcon.asClassName(Codicon.question);
    switch (type) {
        case PromptsType.prompt:
            return {
                tooltip: localize('help.prompt', "Show help on prompt files"),
                helpURI: URI.parse(PROMPT_DOCUMENTATION_URL),
                iconClass
            };
        case PromptsType.instructions:
            return {
                tooltip: localize('help.instructions', "Show help on instruction files"),
                helpURI: URI.parse(INSTRUCTIONS_DOCUMENTATION_URL),
                iconClass
            };
        case PromptsType.agent:
            return {
                tooltip: localize('help.agent', "Show help on custom agent files"),
                helpURI: URI.parse(AGENT_DOCUMENTATION_URL),
                iconClass
            };
    }
}
function isHelpButton(button) {
    return button.helpURI !== undefined;
}
function isPromptFileItem(item) {
    return item.type === 'item' && !!item.promptFileUri;
}
/**
 * A quick pick item that starts the 'New Prompt File' command.
 */
const NEW_PROMPT_FILE_OPTION = {
    type: 'item',
    label: `$(plus) ${localize('commands.new-promptfile.select-dialog.label', 'New prompt file...')}`,
    pickable: false,
    alwaysShow: true,
    buttons: [newHelpButton(PromptsType.prompt)],
    commandId: NEW_PROMPT_COMMAND_ID,
};
/**
 * A quick pick item that starts the 'New Instructions File' command.
 */
const NEW_INSTRUCTIONS_FILE_OPTION = {
    type: 'item',
    label: `$(plus) ${localize('commands.new-instructionsfile.select-dialog.label', 'New instruction file...')}`,
    pickable: false,
    alwaysShow: true,
    buttons: [newHelpButton(PromptsType.instructions)],
    commandId: NEW_INSTRUCTIONS_COMMAND_ID,
};
/**
 * A quick pick item that starts the 'Update Instructions' command.
 */
const UPDATE_INSTRUCTIONS_OPTION = {
    type: 'item',
    label: `$(refresh) ${localize('commands.update-instructions.select-dialog.label', 'Generate agent instructions...')}`,
    pickable: false,
    alwaysShow: true,
    buttons: [newHelpButton(PromptsType.instructions)],
    commandId: 'workbench.action.chat.generateInstructions',
};
/**
 * A quick pick item that starts the 'New Instructions File' command.
 */
const NEW_AGENT_FILE_OPTION = {
    type: 'item',
    label: `$(plus) ${localize('commands.new-agentfile.select-dialog.label', 'Create new custom agent...')}`,
    pickable: false,
    alwaysShow: true,
    buttons: [newHelpButton(PromptsType.agent)],
    commandId: NEW_AGENT_COMMAND_ID,
};
/**
 * Button that opens a prompt file in the editor.
 */
const EDIT_BUTTON = {
    tooltip: localize('open', "Open in Editor"),
    iconClass: ThemeIcon.asClassName(Codicon.fileCode),
};
/**
 * Button that deletes a prompt file.
 */
const DELETE_BUTTON = {
    tooltip: localize('delete', "Delete"),
    iconClass: ThemeIcon.asClassName(Codicon.trash),
};
/**
 * Button that renames a prompt file.
 */
const RENAME_BUTTON = {
    tooltip: localize('rename', "Move and/or Rename"),
    iconClass: ThemeIcon.asClassName(Codicon.replace),
};
/**
 * Button that copies a prompt file.
 */
const COPY_BUTTON = {
    tooltip: localize('copy', "Copy"),
    iconClass: ThemeIcon.asClassName(Codicon.copy),
};
/**
 * Button that sets a prompt file to be visible.
 */
const MAKE_VISIBLE_BUTTON = {
    tooltip: localize('makeVisible', "Hidden from chat view agent picker. Click to show."),
    iconClass: ThemeIcon.asClassName(Codicon.eyeClosed),
    alwaysVisible: true,
};
/**
 * Button that sets a prompt file to be invisible.
 */
const MAKE_INVISIBLE_BUTTON = {
    tooltip: localize('makeInvisible', "Hide from agent picker"),
    iconClass: ThemeIcon.asClassName(Codicon.eyeClosed),
};
let PromptFilePickers = class PromptFilePickers {
    constructor(_quickInputService, _openerService, _fileService, _dialogService, _commandService, _instaService, _promptsService, _labelService, _configurationService) {
        this._quickInputService = _quickInputService;
        this._openerService = _openerService;
        this._fileService = _fileService;
        this._dialogService = _dialogService;
        this._commandService = _commandService;
        this._instaService = _instaService;
        this._promptsService = _promptsService;
        this._labelService = _labelService;
        this._configurationService = _configurationService;
    }
    /**
     * Shows the prompt file selection dialog to the user that allows to run a prompt file(s).
     *
     * If {@link ISelectOptions.resource resource} is provided, the dialog will have
     * the resource pre-selected in the prompts list.
     */
    async selectPromptFile(options) {
        const cts = new CancellationTokenSource();
        const quickPick = this._quickInputService.createQuickPick({ useSeparators: true });
        quickPick.busy = true;
        quickPick.placeholder = localize('searching', 'Searching file system...');
        try {
            const fileOptions = await this._createPromptPickItems(options, cts.token);
            const activeItem = options.resource && fileOptions.find(f => f.type === 'item' && extUri.isEqual(f.promptFileUri, options.resource));
            if (activeItem) {
                quickPick.activeItems = [activeItem];
            }
            quickPick.placeholder = options.placeholder;
            quickPick.matchOnDescription = true;
            quickPick.items = fileOptions;
        }
        finally {
            quickPick.busy = false;
        }
        return new Promise(resolve => {
            const disposables = new DisposableStore();
            let isResolved = false;
            let isClosed = false;
            disposables.add(quickPick);
            disposables.add(cts);
            const refreshItems = async () => {
                const active = quickPick.activeItems;
                const newItems = await this._createPromptPickItems(options, CancellationToken.None);
                quickPick.items = newItems;
                quickPick.activeItems = active;
            };
            // handle the prompt `accept` event
            disposables.add(quickPick.onDidAccept(async () => {
                const { selectedItems } = quickPick;
                const { keyMods } = quickPick;
                const selectedItem = selectedItems[0];
                if (isPromptFileItem(selectedItem)) {
                    resolve({ promptFile: selectedItem.promptFileUri, keyMods: { ...keyMods } });
                    isResolved = true;
                }
                else {
                    if (selectedItem.commandId) {
                        await this._commandService.executeCommand(selectedItem.commandId);
                        return;
                    }
                }
                quickPick.hide();
            }));
            // handle the `button click` event on a list item (edit, delete, etc.)
            disposables.add(quickPick.onDidTriggerItemButton(async (e) => {
                const shouldRefresh = await this._handleButtonClick(quickPick, e, options);
                if (!isClosed && shouldRefresh) {
                    await refreshItems();
                }
            }));
            disposables.add(quickPick.onDidHide(() => {
                if (!quickPick.ignoreFocusOut) {
                    disposables.dispose();
                    isClosed = true;
                    if (!isResolved) {
                        resolve(undefined);
                        isResolved = true;
                    }
                }
            }));
            // finally, reveal the dialog
            quickPick.show();
        });
    }
    async _createPromptPickItems(options, token) {
        const buttons = [];
        if (options.optionEdit !== false) {
            buttons.push(EDIT_BUTTON);
        }
        if (options.optionCopy !== false) {
            buttons.push(COPY_BUTTON);
        }
        if (options.optionRename !== false) {
            buttons.push(RENAME_BUTTON);
        }
        if (options.optionDelete !== false) {
            buttons.push(DELETE_BUTTON);
        }
        const result = [];
        if (options.optionNew !== false) {
            result.push(...this._getNewItems(options.type));
        }
        let getVisibility = () => undefined;
        if (options.optionVisibility) {
            const disabled = this._promptsService.getDisabledPromptFiles(options.type);
            getVisibility = p => !disabled.has(p.uri);
        }
        const locals = await this._promptsService.listPromptFilesForStorage(options.type, PromptsStorage.local, token);
        if (locals.length) {
            result.push({ type: 'separator', label: localize('separator.workspace', "Workspace") });
            result.push(...await Promise.all(locals.map(l => this._createPromptPickItem(l, buttons, getVisibility(l), token))));
        }
        // Agent instruction files (copilot-instructions.md and AGENTS.md) are added here and not included in the output of
        // listPromptFilesForStorage() because that function only handles *.instructions.md files (under `.github/instructions/`, etc.)
        let agentInstructionFiles = [];
        if (options.type === PromptsType.instructions) {
            const useNestedAgentMD = this._configurationService.getValue(PromptsConfig.USE_NESTED_AGENT_MD);
            const agentInstructionUris = [
                ...await this._promptsService.listCopilotInstructionsMDs(token),
                ...await this._promptsService.listAgentMDs(token, !!useNestedAgentMD)
            ];
            agentInstructionFiles = agentInstructionUris.map(uri => {
                const folderName = this._labelService.getUriLabel(dirname(uri), { relative: true });
                // Don't show the folder path for files under .github folder (namely, copilot-instructions.md) since that is only defined once per repo.
                const shouldShowFolderPath = folderName?.toLowerCase() !== '.github';
                return {
                    uri,
                    description: shouldShowFolderPath ? folderName : undefined,
                    storage: PromptsStorage.local,
                    type: options.type
                };
            });
        }
        if (agentInstructionFiles.length) {
            const agentButtons = buttons.filter(b => b !== RENAME_BUTTON);
            result.push({ type: 'separator', label: localize('separator.workspace-agent-instructions', "Agent Instructions") });
            result.push(...await Promise.all(agentInstructionFiles.map(l => this._createPromptPickItem(l, agentButtons, getVisibility(l), token))));
        }
        const exts = await this._promptsService.listPromptFilesForStorage(options.type, PromptsStorage.extension, token);
        if (exts.length) {
            result.push({ type: 'separator', label: localize('separator.extensions', "Extensions") });
            const extButtons = [];
            if (options.optionEdit !== false) {
                extButtons.push(EDIT_BUTTON);
            }
            if (options.optionCopy !== false) {
                extButtons.push(COPY_BUTTON);
            }
            result.push(...await Promise.all(exts.map(e => this._createPromptPickItem(e, extButtons, getVisibility(e), token))));
        }
        const users = await this._promptsService.listPromptFilesForStorage(options.type, PromptsStorage.user, token);
        if (users.length) {
            result.push({ type: 'separator', label: localize('separator.user', "User Data") });
            result.push(...await Promise.all(users.map(u => this._createPromptPickItem(u, buttons, getVisibility(u), token))));
        }
        return result;
    }
    _getNewItems(type) {
        switch (type) {
            case PromptsType.prompt:
                return [NEW_PROMPT_FILE_OPTION];
            case PromptsType.instructions:
                return [NEW_INSTRUCTIONS_FILE_OPTION, UPDATE_INSTRUCTIONS_OPTION];
            case PromptsType.agent:
                return [NEW_AGENT_FILE_OPTION];
            default:
                throw new Error(`Unknown prompt type '${type}'.`);
        }
    }
    async _createPromptPickItem(promptFile, buttons, visibility, token) {
        const parsedPromptFile = await this._promptsService.parseNew(promptFile.uri, token).catch(() => undefined);
        let promptName = parsedPromptFile?.header?.name ?? promptFile.name ?? getCleanPromptName(promptFile.uri);
        const promptDescription = parsedPromptFile?.header?.description ?? promptFile.description;
        let tooltip;
        switch (promptFile.storage) {
            case PromptsStorage.extension:
                tooltip = promptFile.extension.displayName ?? promptFile.extension.id;
                break;
            case PromptsStorage.local:
                tooltip = this._labelService.getUriLabel(dirname(promptFile.uri), { relative: true });
                break;
            case PromptsStorage.user:
                tooltip = undefined;
                break;
        }
        let iconClass;
        if (visibility === false) {
            buttons = (buttons ?? []).concat(MAKE_VISIBLE_BUTTON);
            promptName = localize('hiddenLabelInfo', "{0} (hidden)", promptName);
            tooltip = localize('hiddenInAgentPicker', "Hidden from chat view agent picker");
            //iconClass = ThemeIcon.asClassName(Codicon.eyeClosed);
        }
        else if (visibility === true) {
            buttons = (buttons ?? []).concat(MAKE_INVISIBLE_BUTTON);
        }
        return {
            id: promptFile.uri.toString(),
            type: 'item',
            label: promptName,
            description: promptDescription,
            iconClass,
            tooltip,
            promptFileUri: promptFile.uri,
            buttons,
        };
    }
    async keepQuickPickOpen(quickPick, work) {
        const previousIgnoreFocusOut = quickPick.ignoreFocusOut;
        quickPick.ignoreFocusOut = true;
        try {
            return await work();
        }
        finally {
            quickPick.ignoreFocusOut = previousIgnoreFocusOut;
            quickPick.show();
        }
    }
    async _handleButtonClick(quickPick, context, options) {
        const { item, button } = context;
        if (!isPromptFileItem(item)) {
            if (isHelpButton(button)) {
                await this._openerService.open(button.helpURI);
                return false;
            }
            throw new Error(`Unknown button '${JSON.stringify(button)}'.`);
        }
        const value = item.promptFileUri;
        // `edit` button was pressed, open the prompt file in editor
        if (button === EDIT_BUTTON) {
            await this._openerService.open(value);
            return false;
        }
        // `copy` button was pressed, make a copy of the prompt file, open the copy in editor
        if (button === RENAME_BUTTON || button === COPY_BUTTON) {
            return await this.keepQuickPickOpen(quickPick, async () => {
                const currentFolder = dirname(value);
                const isMove = button === RENAME_BUTTON && quickPick.keyMods.ctrlCmd;
                const newFolder = await this._instaService.invokeFunction(askForPromptSourceFolder, options.type, currentFolder, isMove);
                if (!newFolder) {
                    return false;
                }
                const newName = await this._instaService.invokeFunction(askForPromptFileName, options.type, newFolder.uri, item.label);
                if (!newName) {
                    return false;
                }
                const newFile = joinPath(newFolder.uri, newName);
                if (isMove) {
                    await this._fileService.move(value, newFile);
                }
                else {
                    await this._fileService.copy(value, newFile);
                }
                await this._openerService.open(newFile);
                await this._instaService.createInstance(PromptFileRewriter).openAndRewriteName(newFile, getCleanPromptName(newFile), CancellationToken.None);
                return true;
            });
        }
        // `delete` button was pressed, delete the prompt file
        if (button === DELETE_BUTTON) {
            // don't close the main prompt selection dialog by the confirmation dialog
            return await this.keepQuickPickOpen(quickPick, async () => {
                const filename = getCleanPromptName(value);
                const message = localize('commands.prompts.use.select-dialog.delete-prompt.confirm.message', "Are you sure you want to delete '{0}'?", filename);
                const { confirmed } = await this._dialogService.confirm({ message });
                // if prompt deletion was not confirmed, nothing to do
                if (!confirmed) {
                    return false;
                }
                // prompt deletion was confirmed so delete the prompt file
                await this._fileService.del(value);
                return true;
            });
        }
        if (button === MAKE_VISIBLE_BUTTON || button === MAKE_INVISIBLE_BUTTON) {
            const disabled = this._promptsService.getDisabledPromptFiles(options.type);
            if (button === MAKE_VISIBLE_BUTTON) {
                disabled.delete(value);
            }
            else {
                disabled.add(value);
            }
            this._promptsService.setDisabledPromptFiles(options.type, disabled);
            return true;
        }
        throw new Error(`Unknown button '${JSON.stringify(button)}'.`);
    }
    // --- Enablement Configuration -------------------------------------------------------
    /**
     * Shows a multi-select (checkbox) quick pick to configure which prompt files of the given
     * type are enabled. Currently only used for agent prompt files.
     */
    async managePromptFiles(type, placeholder) {
        const cts = new CancellationTokenSource();
        const quickPick = this._quickInputService.createQuickPick({ useSeparators: true });
        quickPick.placeholder = placeholder;
        quickPick.canSelectMany = true;
        quickPick.matchOnDescription = true;
        quickPick.sortByLabel = false;
        quickPick.busy = true;
        const options = {
            placeholder: '',
            type,
            optionNew: true,
            optionEdit: true,
            optionDelete: true,
            optionRename: true,
            optionCopy: true,
            optionVisibility: false
        };
        try {
            const disabled = this._promptsService.getDisabledPromptFiles(type);
            const items = await this._createPromptPickItems(options, cts.token);
            quickPick.items = items;
            quickPick.selectedItems = items.filter(i => isPromptFileItem(i)).filter(i => !disabled.has(i.promptFileUri));
        }
        finally {
            quickPick.busy = false;
        }
        return new Promise(resolve => {
            const disposables = new DisposableStore();
            disposables.add(quickPick);
            disposables.add(cts);
            let isClosed = false;
            let isResolved = false;
            const getDisabled = () => {
                const selected = quickPick.selectedItems;
                return new ResourceSet(quickPick.items.filter(i => isPromptFileItem(i)).filter(i => !selected.includes(i)).map(i => i.promptFileUri));
            };
            const refreshItems = async () => {
                const active = quickPick.activeItems;
                const disabled = getDisabled();
                const newItems = await this._createPromptPickItems(options, CancellationToken.None);
                quickPick.items = newItems;
                quickPick.selectedItems = newItems.filter(i => isPromptFileItem(i)).filter(i => !disabled.has(i.promptFileUri));
                quickPick.activeItems = active;
            };
            disposables.add(quickPick.onDidAccept(async () => {
                const clickedItem = quickPick.activeItems;
                if (clickedItem.length === 1 && clickedItem[0].commandId) {
                    const commandId = clickedItem[0].commandId;
                    await this.keepQuickPickOpen(quickPick, async () => {
                        await this._commandService.executeCommand(commandId);
                    });
                    if (!isClosed) {
                        await refreshItems();
                    }
                    return;
                }
                this._promptsService.setDisabledPromptFiles(type, getDisabled());
                isResolved = true;
                resolve(true);
                quickPick.hide();
            }));
            disposables.add(quickPick.onDidTriggerItemButton(async (e) => {
                const shouldRefresh = await this._handleButtonClick(quickPick, e, options);
                if (!isClosed && shouldRefresh) {
                    await refreshItems();
                }
            }));
            disposables.add(quickPick.onDidHide(() => {
                if (!quickPick.ignoreFocusOut) {
                    disposables.dispose();
                    isClosed = true;
                    if (!isResolved) {
                        resolve(false);
                        isResolved = true;
                    }
                }
            }));
            quickPick.show();
        });
    }
};
PromptFilePickers = __decorate([
    __param(0, IQuickInputService),
    __param(1, IOpenerService),
    __param(2, IFileService),
    __param(3, IDialogService),
    __param(4, ICommandService),
    __param(5, IInstantiationService),
    __param(6, IPromptsService),
    __param(7, ILabelService),
    __param(8, IConfigurationService)
], PromptFilePickers);
export { PromptFilePickers };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0RmlsZVBpY2tlcnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL3Byb21wdFN5bnRheC9waWNrZXJzL3Byb21wdEZpbGVQaWNrZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDM0QsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN2RSxPQUFPLEVBQWUsZUFBZSxFQUFFLGNBQWMsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQ3RILE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUM3RSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDaEYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN0RixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDekYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSw4QkFBOEIsRUFBRSx1QkFBdUIsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzdKLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSwyQkFBMkIsRUFBRSxvQkFBb0Is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