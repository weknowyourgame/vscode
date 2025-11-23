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
import { ChatViewId, IChatWidgetService } from '../chat.js';
import { CHAT_CATEGORY, CHAT_CONFIG_MENU_ID } from '../actions/chatActions.js';
import { localize, localize2 } from '../../../../../nls.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { IPromptsService } from '../../common/promptSyntax/service/promptsService.js';
import { PromptFilePickers } from './pickers/promptFilePickers.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { getCleanPromptName } from '../../common/promptSyntax/config/promptFileLocations.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { INSTRUCTIONS_LANGUAGE_ID, PromptsType } from '../../common/promptSyntax/promptTypes.js';
import { compare } from '../../../../../base/common/strings.js';
import { PromptFileVariableKind, toPromptFileVariableEntry } from '../../common/chatVariableEntries.js';
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
/**
 * Action ID for the `Attach Instruction` action.
 */
const ATTACH_INSTRUCTIONS_ACTION_ID = 'workbench.action.chat.attach.instructions';
/**
 * Action ID for the `Configure Instruction` action.
 */
const CONFIGURE_INSTRUCTIONS_ACTION_ID = 'workbench.action.chat.configure.instructions';
/**
 * Action to attach a prompt to a chat widget input.
 */
class AttachInstructionsAction extends Action2 {
    constructor() {
        super({
            id: ATTACH_INSTRUCTIONS_ACTION_ID,
            title: localize2('attach-instructions.capitalized.ellipses', "Attach Instructions..."),
            f1: false,
            precondition: ChatContextKeys.enabled,
            category: CHAT_CATEGORY,
            keybinding: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 90 /* KeyCode.Slash */,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */
            },
            menu: {
                id: MenuId.CommandPalette,
                when: ChatContextKeys.enabled
            }
        });
    }
    async run(accessor, options) {
        const instaService = accessor.get(IInstantiationService);
        const widgetService = accessor.get(IChatWidgetService);
        if (!options) {
            options = {
                resource: getActiveInstructionsFileUri(accessor),
                widget: getFocusedChatWidget(accessor),
            };
        }
        const pickers = instaService.createInstance(PromptFilePickers);
        const { skipSelectionDialog, resource } = options;
        const widget = options.widget ?? (await widgetService.revealWidget());
        if (!widget) {
            return;
        }
        if (skipSelectionDialog && resource) {
            widget.attachmentModel.addContext(toPromptFileVariableEntry(resource, PromptFileVariableKind.Instruction));
            widget.focusInput();
            return;
        }
        const placeholder = localize('commands.instructions.select-dialog.placeholder', 'Select instructions files to attach');
        const result = await pickers.selectPromptFile({ resource, placeholder, type: PromptsType.instructions });
        if (result !== undefined) {
            widget.attachmentModel.addContext(toPromptFileVariableEntry(result.promptFile, PromptFileVariableKind.Instruction));
            widget.focusInput();
        }
    }
}
class ManageInstructionsFilesAction extends Action2 {
    constructor() {
        super({
            id: CONFIGURE_INSTRUCTIONS_ACTION_ID,
            title: localize2('configure-instructions', "Configure Instructions..."),
            shortTitle: localize2('configure-instructions.short', "Chat Instructions"),
            icon: Codicon.bookmark,
            f1: true,
            precondition: ChatContextKeys.enabled,
            category: CHAT_CATEGORY,
            menu: {
                id: CHAT_CONFIG_MENU_ID,
                when: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.equals('view', ChatViewId)),
                order: 10,
                group: '1_level'
            }
        });
    }
    async run(accessor) {
        const openerService = accessor.get(IOpenerService);
        const instaService = accessor.get(IInstantiationService);
        const pickers = instaService.createInstance(PromptFilePickers);
        const placeholder = localize('commands.prompt.manage-dialog.placeholder', 'Select the instructions file to open');
        const result = await pickers.selectPromptFile({ placeholder, type: PromptsType.instructions, optionEdit: false });
        if (result !== undefined) {
            await openerService.open(result.promptFile);
        }
    }
}
function getFocusedChatWidget(accessor) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const { lastFocusedWidget } = chatWidgetService;
    if (!lastFocusedWidget) {
        return undefined;
    }
    // the widget input `must` be focused at the time when command run
    if (!lastFocusedWidget.hasInputFocus()) {
        return undefined;
    }
    return lastFocusedWidget;
}
/**
 * Gets `URI` of a instructions file open in an active editor instance, if any.
 */
function getActiveInstructionsFileUri(accessor) {
    const codeEditorService = accessor.get(ICodeEditorService);
    const model = codeEditorService.getActiveCodeEditor()?.getModel();
    if (model?.getLanguageId() === INSTRUCTIONS_LANGUAGE_ID) {
        return model.uri;
    }
    return undefined;
}
/**
 * Helper to register the `Attach Prompt` action.
 */
export function registerAttachPromptActions() {
    registerAction2(AttachInstructionsAction);
    registerAction2(ManageInstructionsFilesAction);
}
let ChatInstructionsPickerPick = class ChatInstructionsPickerPick {
    constructor(promptsService) {
        this.promptsService = promptsService;
        this.type = 'pickerPick';
        this.label = localize('chatContext.attach.instructions.label', 'Instructions...');
        this.icon = Codicon.bookmark;
        this.commandId = ATTACH_INSTRUCTIONS_ACTION_ID;
    }
    isEnabled(widget) {
        return !!widget.attachmentCapabilities.supportsInstructionAttachments;
    }
    asPicker() {
        const picks = this.promptsService.listPromptFiles(PromptsType.instructions, CancellationToken.None).then(value => {
            const result = [];
            value = value.slice(0).sort((a, b) => compare(a.storage, b.storage));
            let storageType;
            for (const promptsPath of value) {
                if (storageType !== promptsPath.storage) {
                    storageType = promptsPath.storage;
                    result.push({
                        type: 'separator',
                        label: this.promptsService.getPromptLocationLabel(promptsPath)
                    });
                }
                result.push({
                    label: promptsPath.name ?? getCleanPromptName(promptsPath.uri),
                    asAttachment: () => {
                        return toPromptFileVariableEntry(promptsPath.uri, PromptFileVariableKind.Instruction);
                    }
                });
            }
            return result;
        });
        return {
            placeholder: localize('placeholder', 'Select instructions files to attach'),
            picks,
            configure: {
                label: localize('configureInstructions', 'Configure Instructions...'),
                commandId: CONFIGURE_INSTRUCTIONS_ACTION_ID
            }
        };
    }
};
ChatInstructionsPickerPick = __decorate([
    __param(0, IPromptsService)
], ChatInstructionsPickerPick);
export { ChatInstructionsPickerPick };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXR0YWNoSW5zdHJ1Y3Rpb25zQWN0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9wcm9tcHRTeW50YXgvYXR0YWNoSW5zdHJ1Y3Rpb25zQWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQWUsa0JBQWtCLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDekUsT0FBTyxFQUFFLGFBQWEsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBRS9FLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN0RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVuRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNyRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUd0RyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDN0YsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxXQUFXLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNqRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEUsT0FBTyxFQUE0QixzQkFBc0IsRUFBRSx5QkFBeUIsRUFB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