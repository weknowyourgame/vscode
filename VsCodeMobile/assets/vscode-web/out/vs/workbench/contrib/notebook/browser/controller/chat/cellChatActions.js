/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../../base/common/codicons.js';
import { KeyChord } from '../../../../../../base/common/keyCodes.js';
import { localize, localize2 } from '../../../../../../nls.js';
import { MenuId, MenuRegistry, registerAction2 } from '../../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../../../platform/contextkey/common/contextkey.js';
import { InputFocusedContextKey } from '../../../../../../platform/contextkey/common/contextkeys.js';
import { CTX_INLINE_CHAT_REQUEST_IN_PROGRESS, CTX_INLINE_CHAT_RESPONSE_TYPE, CTX_INLINE_CHAT_VISIBLE, MENU_INLINE_CHAT_WIDGET_STATUS } from '../../../../inlineChat/common/inlineChat.js';
import { CTX_NOTEBOOK_CHAT_HAS_AGENT } from './notebookChatContext.js';
import { NotebookAction, getContextFromActiveEditor, getEditorFromArgsOrActivePane } from '../coreActions.js';
import { insertNewCell } from '../insertCellActions.js';
import { CellKind, NotebookSetting } from '../../../common/notebookCommon.js';
import { NOTEBOOK_EDITOR_EDITABLE, NOTEBOOK_EDITOR_FOCUSED } from '../../../common/notebookContextKeys.js';
import { Iterable } from '../../../../../../base/common/iterator.js';
import { IEditorService } from '../../../../../services/editor/common/editorService.js';
import { ChatContextKeys } from '../../../../chat/common/chatContextKeys.js';
import { InlineChatController } from '../../../../inlineChat/browser/inlineChatController.js';
import { EditorAction2 } from '../../../../../../editor/browser/editorExtensions.js';
async function startChat(accessor, context, index, input, autoSend, source) {
    const configurationService = accessor.get(IConfigurationService);
    const commandService = accessor.get(ICommandService);
    if (configurationService.getValue(NotebookSetting.cellGenerate) || configurationService.getValue(NotebookSetting.cellChat)) {
        const activeCell = context.notebookEditor.getActiveCell();
        const targetCell = activeCell?.getTextLength() === 0 && source !== 'insertToolbar' ? activeCell : (await insertNewCell(accessor, context, CellKind.Code, 'below', true));
        if (targetCell) {
            targetCell.enableAutoLanguageDetection();
            await context.notebookEditor.revealFirstLineIfOutsideViewport(targetCell);
            const codeEditor = context.notebookEditor.codeEditors.find(ce => ce[0] === targetCell)?.[1];
            if (codeEditor) {
                codeEditor.focus();
                commandService.executeCommand('inlineChat.start');
            }
        }
    }
}
registerAction2(class extends NotebookAction {
    constructor() {
        super({
            id: 'notebook.cell.chat.start',
            title: {
                value: '$(sparkle) ' + localize('notebookActions.menu.insertCodeCellWithChat', "Generate"),
                original: '$(sparkle) Generate',
            },
            tooltip: localize('notebookActions.menu.insertCodeCellWithChat.tooltip', "Start Chat to Generate Code"),
            metadata: {
                description: localize('notebookActions.menu.insertCodeCellWithChat.tooltip', "Start Chat to Generate Code"),
                args: [
                    {
                        name: 'args',
                        schema: {
                            type: 'object',
                            required: ['index'],
                            properties: {
                                'index': {
                                    type: 'number'
                                },
                                'input': {
                                    type: 'string'
                                },
                                'autoSend': {
                                    type: 'boolean'
                                }
                            }
                        }
                    }
                ]
            },
            f1: false,
            keybinding: {
                when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true), ContextKeyExpr.not(InputFocusedContextKey), CTX_NOTEBOOK_CHAT_HAS_AGENT, ContextKeyExpr.or(ContextKeyExpr.equals(`config.${NotebookSetting.cellChat}`, true), ContextKeyExpr.equals(`config.${NotebookSetting.cellGenerate}`, true))),
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 39 /* KeyCode.KeyI */,
                secondary: [KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 39 /* KeyCode.KeyI */)],
            },
            menu: [
                {
                    id: MenuId.NotebookCellBetween,
                    group: 'inline',
                    order: -1,
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true), CTX_NOTEBOOK_CHAT_HAS_AGENT, ContextKeyExpr.or(ContextKeyExpr.equals(`config.${NotebookSetting.cellChat}`, true), ContextKeyExpr.equals(`config.${NotebookSetting.cellGenerate}`, true)))
                }
            ]
        });
    }
    getEditorContextFromArgsOrActive(accessor, ...args) {
        const [firstArg] = args;
        if (!firstArg) {
            const notebookEditor = getEditorFromArgsOrActivePane(accessor);
            if (!notebookEditor) {
                return undefined;
            }
            const activeCell = notebookEditor.getActiveCell();
            if (!activeCell) {
                return undefined;
            }
            return {
                cell: activeCell,
                notebookEditor,
                input: undefined,
                autoSend: undefined
            };
        }
        if (typeof firstArg !== 'object' || typeof firstArg.index !== 'number') {
            return undefined;
        }
        const notebookEditor = getEditorFromArgsOrActivePane(accessor);
        if (!notebookEditor) {
            return undefined;
        }
        const cell = firstArg.index <= 0 ? undefined : notebookEditor.cellAt(firstArg.index - 1);
        return {
            cell,
            notebookEditor,
            input: firstArg.input,
            autoSend: firstArg.autoSend
        };
    }
    async runWithContext(accessor, context) {
        const index = Math.max(0, context.cell ? context.notebookEditor.getCellIndex(context.cell) + 1 : 0);
        await startChat(accessor, context, index, context.input, context.autoSend, context.source);
    }
});
registerAction2(class extends NotebookAction {
    constructor() {
        super({
            id: 'notebook.cell.chat.startAtTop',
            title: {
                value: '$(sparkle) ' + localize('notebookActions.menu.insertCodeCellWithChat', "Generate"),
                original: '$(sparkle) Generate',
            },
            tooltip: localize('notebookActions.menu.insertCodeCellWithChat.tooltip', "Start Chat to Generate Code"),
            f1: false,
            menu: [
                {
                    id: MenuId.NotebookCellListTop,
                    group: 'inline',
                    order: -1,
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true), CTX_NOTEBOOK_CHAT_HAS_AGENT, ContextKeyExpr.or(ContextKeyExpr.equals(`config.${NotebookSetting.cellChat}`, true), ContextKeyExpr.equals(`config.${NotebookSetting.cellGenerate}`, true)))
                },
            ]
        });
    }
    async runWithContext(accessor, context) {
        await startChat(accessor, context, 0, '', false);
    }
});
MenuRegistry.appendMenuItem(MenuId.NotebookToolbar, {
    command: {
        id: 'notebook.cell.chat.start',
        icon: Codicon.sparkle,
        title: localize('notebookActions.menu.insertCode.ontoolbar', "Generate"),
        tooltip: localize('notebookActions.menu.insertCode.tooltip', "Start Chat to Generate Code")
    },
    order: -10,
    group: 'navigation/add',
    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true), ContextKeyExpr.notEquals('config.notebook.insertToolbarLocation', 'betweenCells'), ContextKeyExpr.notEquals('config.notebook.insertToolbarLocation', 'hidden'), CTX_NOTEBOOK_CHAT_HAS_AGENT, ContextKeyExpr.or(ContextKeyExpr.equals(`config.${NotebookSetting.cellChat}`, true), ContextKeyExpr.equals(`config.${NotebookSetting.cellGenerate}`, true)))
});
export class AcceptChangesAndRun extends EditorAction2 {
    constructor() {
        super({
            id: 'notebook.inlineChat.acceptChangesAndRun',
            title: localize2('notebook.apply1', "Accept and Run"),
            shortTitle: localize('notebook.apply2', 'Accept & Run'),
            tooltip: localize('notebook.apply3', 'Accept the changes and run the cell'),
            icon: Codicon.check,
            f1: true,
            precondition: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true), CTX_INLINE_CHAT_VISIBLE),
            keybinding: undefined,
            menu: [{
                    id: MENU_INLINE_CHAT_WIDGET_STATUS,
                    group: '0_main',
                    order: 2,
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true), ChatContextKeys.inputHasText.toNegated(), CTX_INLINE_CHAT_REQUEST_IN_PROGRESS.toNegated(), CTX_INLINE_CHAT_RESPONSE_TYPE.isEqualTo("messagesAndEdits" /* InlineChatResponseType.MessagesAndEdits */))
                }]
        });
    }
    runEditorCommand(accessor, codeEditor) {
        const editor = getContextFromActiveEditor(accessor.get(IEditorService));
        const ctrl = InlineChatController.get(codeEditor);
        if (!editor || !ctrl) {
            return;
        }
        const matchedCell = editor.notebookEditor.codeEditors.find(e => e[1] === codeEditor);
        const cell = matchedCell?.[0];
        if (!cell) {
            return;
        }
        ctrl.acceptSession();
        return editor.notebookEditor.executeNotebookCells(Iterable.single(cell));
    }
}
registerAction2(AcceptChangesAndRun);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2VsbENoYXRBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL25vdGVib29rL2Jyb3dzZXIvY29udHJvbGxlci9jaGF0L2NlbGxDaGF0QWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFFBQVEsRUFBbUIsTUFBTSwyQ0FBMkMsQ0FBQztBQUN0RixPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzdHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUN6RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUN6RyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDNUYsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFHckcsT0FBTyxFQUFFLG1DQUFtQyxFQUFFLDZCQUE2QixFQUFFLHVCQUF1QixFQUEwQiw4QkFBOEIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ2xOLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3ZFLE9BQU8sRUFBMEIsY0FBYyxFQUFFLDBCQUEwQixFQUFFLDZCQUE2QixFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDdEksT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ3hELE9BQU8sRUFBRSxRQUFRLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUUsT0FBTyxFQUFFLHdCQUF3QixFQUFFLHVCQUF1QixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDM0csT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBRXJFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUN4RixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDN0UsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDOUYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBUXJGLEtBQUssVUFBVSxTQUFTLENBQUMsUUFBMEIsRUFBRSxPQUErQixFQUFFLEtBQWEsRUFBRSxLQUFjLEVBQUUsUUFBa0IsRUFBRSxNQUFlO0lBQ3ZKLE1BQU0sb0JBQW9CLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBQ2pFLE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUM7SUFFckQsSUFBSSxvQkFBb0IsQ0FBQyxRQUFRLENBQVUsZUFBZSxDQUFDLFlBQVksQ0FBQyxJQUFJLG9CQUFvQixDQUFDLFFBQVEsQ0FBVSxlQUFlLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztRQUM5SSxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQzFELE1BQU0sVUFBVSxHQUFHLFVBQVUsRUFBRSxhQUFhLEVBQUUsS0FBSyxDQUFDLElBQUksTUFBTSxLQUFLLGVBQWUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sYUFBYSxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUV6SyxJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ2hCLFVBQVUsQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1lBQ3pDLE1BQU0sT0FBTyxDQUFDLGNBQWMsQ0FBQyxnQ0FBZ0MsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUMxRSxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1RixJQUFJLFVBQVUsRUFBRSxDQUFDO2dCQUNoQixVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ25CLGNBQWMsQ0FBQyxjQUFjLENBQUMsa0JBQWtCLENBQUMsQ0FBQztZQUNuRCxDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7QUFDRixDQUFDO0FBRUQsZUFBZSxDQUFDLEtBQU0sU0FBUSxjQUFjO0lBQzNDO1FBQ0MsS0FBSyxDQUNKO1lBQ0MsRUFBRSxFQUFFLDBCQUEwQjtZQUM5QixLQUFLLEVBQUU7Z0JBQ04sS0FBSyxFQUFFLGFBQWEsR0FBRyxRQUFRLENBQUMsNkNBQTZDLEVBQUUsVUFBVSxDQUFDO2dCQUMxRixRQUFRLEVBQUUscUJBQXFCO2FBQy9CO1lBQ0QsT0FBTyxFQUFFLFFBQVEsQ0FBQyxxREFBcUQsRUFBRSw2QkFBNkIsQ0FBQztZQUN2RyxRQUFRLEVBQUU7Z0JBQ1QsV0FBVyxFQUFFLFFBQVEsQ0FBQyxxREFBcUQsRUFBRSw2QkFBNkIsQ0FBQztnQkFDM0csSUFBSSxFQUFFO29CQUNMO3dCQUNDLElBQUksRUFBRSxNQUFNO3dCQUNaLE1BQU0sRUFBRTs0QkFDUCxJQUFJLEVBQUUsUUFBUTs0QkFDZCxRQUFRLEVBQUUsQ0FBQyxPQUFPLENBQUM7NEJBQ25CLFVBQVUsRUFBRTtnQ0FDWCxPQUFPLEVBQUU7b0NBQ1IsSUFBSSxFQUFFLFFBQVE7aUNBQ2Q7Z0NBQ0QsT0FBTyxFQUFFO29DQUNSLElBQUksRUFBRSxRQUFRO2lDQUNkO2dDQUNELFVBQVUsRUFBRTtvQ0FDWCxJQUFJLEVBQUUsU0FBUztpQ0FDZjs2QkFDRDt5QkFDRDtxQkFDRDtpQkFDRDthQUNEO1lBQ0QsRUFBRSxFQUFFLEtBQUs7WUFDVCxVQUFVLEVBQUU7Z0JBQ1gsSUFBSSxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQ3ZCLHVCQUF1QixFQUN2Qix3QkFBd0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQ3hDLGNBQWMsQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsRUFDMUMsMkJBQTJCLEVBQzNCLGNBQWMsQ0FBQyxFQUFFLENBQ2hCLGNBQWMsQ0FBQyxNQUFNLENBQUMsVUFBVSxlQUFlLENBQUMsUUFBUSxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQ2pFLGNBQWMsQ0FBQyxNQUFNLENBQUMsVUFBVSxlQUFlLENBQUMsWUFBWSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQ3JFLENBQ0Q7Z0JBQ0QsTUFBTSw2Q0FBbUM7Z0JBQ3pDLE9BQU8sRUFBRSxpREFBNkI7Z0JBQ3RDLFNBQVMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxpREFBNkIsd0JBQWUsQ0FBQzthQUNsRTtZQUNELElBQUksRUFBRTtnQkFDTDtvQkFDQyxFQUFFLEVBQUUsTUFBTSxDQUFDLG1CQUFtQjtvQkFDOUIsS0FBSyxFQUFFLFFBQVE7b0JBQ2YsS0FBSyxFQUFFLENBQUMsQ0FBQztvQkFDVCxJQUFJLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FDdkIsd0JBQXdCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUN4QywyQkFBMkIsRUFDM0IsY0FBYyxDQUFDLEVBQUUsQ0FDaEIsY0FBYyxDQUFDLE1BQU0sQ0FBQyxVQUFVLGVBQWUsQ0FBQyxRQUFRLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFDakUsY0FBYyxDQUFDLE1BQU0sQ0FBQyxVQUFVLGVBQWUsQ0FBQyxZQUFZLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FDckUsQ0FDRDtpQkFDRDthQUNEO1NBQ0QsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVRLGdDQUFnQyxDQUFDLFFBQTBCLEVBQUUsR0FBRyxJQUFXO1FBQ25GLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxJQUFJLENBQUM7UUFDeEIsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2YsTUFBTSxjQUFjLEdBQUcsNkJBQTZCLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDL0QsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUNyQixPQUFPLFNBQVMsQ0FBQztZQUNsQixDQUFDO1lBRUQsTUFBTSxVQUFVLEdBQUcsY0FBYyxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ2xELElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDakIsT0FBTyxTQUFTLENBQUM7WUFDbEIsQ0FBQztZQUVELE9BQU87Z0JBQ04sSUFBSSxFQUFFLFVBQVU7Z0JBQ2hCLGNBQWM7Z0JBQ2QsS0FBSyxFQUFFLFNBQVM7Z0JBQ2hCLFFBQVEsRUFBRSxTQUFTO2FBQ25CLENBQUM7UUFDSCxDQUFDO1FBRUQsSUFBSSxPQUFPLFFBQVEsS0FBSyxRQUFRLElBQUksT0FBTyxRQUFRLENBQUMsS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ3hFLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxNQUFNLGNBQWMsR0FBRyw2QkFBNkIsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMvRCxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDckIsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztRQUV6RixPQUFPO1lBQ04sSUFBSTtZQUNKLGNBQWM7WUFDZCxLQUFLLEVBQUUsUUFBUSxDQUFDLEtBQUs7WUFDckIsUUFBUSxFQUFFLFFBQVEsQ0FBQyxRQUFRO1NBQzNCLENBQUM7SUFDSCxDQUFDO0lBRUQsS0FBSyxDQUFDLGNBQWMsQ0FBQyxRQUEwQixFQUFFLE9BQWdDO1FBQ2hGLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BHLE1BQU0sU0FBUyxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDNUYsQ0FBQztDQUNELENBQUMsQ0FBQztBQUVILGVBQWUsQ0FBQyxLQUFNLFNBQVEsY0FBYztJQUMzQztRQUNDLEtBQUssQ0FDSjtZQUNDLEVBQUUsRUFBRSwrQkFBK0I7WUFDbkMsS0FBSyxFQUFFO2dCQUNOLEtBQUssRUFBRSxhQUFhLEdBQUcsUUFBUSxDQUFDLDZDQUE2QyxFQUFFLFVBQVUsQ0FBQztnQkFDMUYsUUFBUSxFQUFFLHFCQUFxQjthQUMvQjtZQUNELE9BQU8sRUFBRSxRQUFRLENBQUMscURBQXFELEVBQUUsNkJBQTZCLENBQUM7WUFDdkcsRUFBRSxFQUFFLEtBQUs7WUFDVCxJQUFJLEVBQUU7Z0JBQ0w7b0JBQ0MsRUFBRSxFQUFFLE1BQU0sQ0FBQyxtQkFBbUI7b0JBQzlCLEtBQUssRUFBRSxRQUFRO29CQUNmLEtBQUssRUFBRSxDQUFDLENBQUM7b0JBQ1QsSUFBSSxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQ3ZCLHdCQUF3QixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFDeEMsMkJBQTJCLEVBQzNCLGNBQWMsQ0FBQyxFQUFFLENBQ2hCLGNBQWMsQ0FBQyxNQUFNLENBQUMsVUFBVSxlQUFlLENBQUMsUUFBUSxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQ2pFLGNBQWMsQ0FBQyxNQUFNLENBQUMsVUFBVSxlQUFlLENBQUMsWUFBWSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQ3JFLENBQ0Q7aUJBQ0Q7YUFDRDtTQUNELENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxLQUFLLENBQUMsY0FBYyxDQUFDLFFBQTBCLEVBQUUsT0FBK0I7UUFDL0UsTUFBTSxTQUFTLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2xELENBQUM7Q0FDRCxDQUFDLENBQUM7QUFFSCxZQUFZLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxlQUFlLEVBQUU7SUFDbkQsT0FBTyxFQUFFO1FBQ1IsRUFBRSxFQUFFLDBCQUEwQjtRQUM5QixJQUFJLEVBQUUsT0FBTyxDQUFDLE9BQU87UUFDckIsS0FBSyxFQUFFLFFBQVEsQ0FBQywyQ0FBMkMsRUFBRSxVQUFVLENBQUM7UUFDeEUsT0FBTyxFQUFFLFFBQVEsQ0FBQyx5Q0FBeUMsRUFBRSw2QkFBNkIsQ0FBQztLQUMzRjtJQUNELEtBQUssRUFBRSxDQUFDLEVBQUU7SUFDVixLQUFLLEVBQUUsZ0JBQWdCO0lBQ3ZCLElBQUksRUFBRSxjQUFjLENBQUMsR0FBRyxDQUN2Qix3QkFBd0IsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQ3hDLGNBQWMsQ0FBQyxTQUFTLENBQUMsdUNBQXVDLEVBQUUsY0FBYyxDQUFDLEVBQ2pGLGNBQWMsQ0FBQyxTQUFTLENBQUMsdUNBQXVDLEVBQUUsUUFBUSxDQUFDLEVBQzNFLDJCQUEyQixFQUMzQixjQUFjLENBQUMsRUFBRSxDQUNoQixjQUFjLENBQUMsTUFBTSxDQUFDLFVBQVUsZUFBZSxDQUFDLFFBQVEsRUFBRSxFQUFFLElBQUksQ0FBQyxFQUNqRSxjQUFjLENBQUMsTUFBTSxDQUFDLFVBQVUsZUFBZSxDQUFDLFlBQVksRUFBRSxFQUFFLElBQUksQ0FBQyxDQUNyRSxDQUNEO0NBQ0QsQ0FBQyxDQUFDO0FBRUgsTUFBTSxPQUFPLG1CQUFvQixTQUFRLGFBQWE7SUFFckQ7UUFDQyxLQUFLLENBQUM7WUFDTCxFQUFFLEVBQUUseUNBQXlDO1lBQzdDLEtBQUssRUFBRSxTQUFTLENBQUMsaUJBQWlCLEVBQUUsZ0JBQWdCLENBQUM7WUFDckQsVUFBVSxFQUFFLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRSxjQUFjLENBQUM7WUFDdkQsT0FBTyxFQUFFLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRSxxQ0FBcUMsQ0FBQztZQUMzRSxJQUFJLEVBQUUsT0FBTyxDQUFDLEtBQUs7WUFDbkIsRUFBRSxFQUFFLElBQUk7WUFDUixZQUFZLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FDL0Isd0JBQXdCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUN4Qyx1QkFBdUIsQ0FDdkI7WUFDRCxVQUFVLEVBQUUsU0FBUztZQUNyQixJQUFJLEVBQUUsQ0FBQztvQkFDTixFQUFFLEVBQUUsOEJBQThCO29CQUNsQyxLQUFLLEVBQUUsUUFBUTtvQkFDZixLQUFLLEVBQUUsQ0FBQztvQkFDUixJQUFJLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FDdkIsd0JBQXdCLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUN4QyxlQUFlLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSxFQUN4QyxtQ0FBbUMsQ0FBQyxTQUFTLEVBQUUsRUFDL0MsNkJBQTZCLENBQUMsU0FBUyxrRUFBeUMsQ0FDaEY7aUJBQ0QsQ0FBQztTQUNGLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFUSxnQkFBZ0IsQ0FBQyxRQUEwQixFQUFFLFVBQXVCO1FBQzVFLE1BQU0sTUFBTSxHQUFHLDBCQUEwQixDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztRQUN4RSxNQUFNLElBQUksR0FBRyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFbEQsSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ3RCLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLFVBQVUsQ0FBQyxDQUFDO1FBQ3JGLE1BQU0sSUFBSSxHQUFHLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTlCLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNYLE9BQU87UUFDUixDQUFDO1FBRUQsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ3JCLE9BQU8sTUFBTSxDQUFDLGNBQWMsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDMUUsQ0FBQztDQUNEO0FBQ0QsZUFBZSxDQUFDLG1CQUFtQixDQUFDLENBQUMifQ==