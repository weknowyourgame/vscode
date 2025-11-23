/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../base/common/codicons.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { localize } from '../../../../../nls.js';
import { MenuId, MenuRegistry, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { InputFocusedContext } from '../../../../../platform/contextkey/common/contextkeys.js';
import { insertCell } from './cellOperations.js';
import { NotebookAction } from './coreActions.js';
import { NOTEBOOK_CELL_LIST_FOCUSED, NOTEBOOK_EDITOR_EDITABLE } from '../../common/notebookContextKeys.js';
import { CellKind, NotebookSetting } from '../../common/notebookCommon.js';
import { INotebookKernelHistoryService } from '../../common/notebookKernelService.js';
const INSERT_CODE_CELL_ABOVE_COMMAND_ID = 'notebook.cell.insertCodeCellAbove';
const INSERT_CODE_CELL_BELOW_COMMAND_ID = 'notebook.cell.insertCodeCellBelow';
const INSERT_CODE_CELL_ABOVE_AND_FOCUS_CONTAINER_COMMAND_ID = 'notebook.cell.insertCodeCellAboveAndFocusContainer';
const INSERT_CODE_CELL_BELOW_AND_FOCUS_CONTAINER_COMMAND_ID = 'notebook.cell.insertCodeCellBelowAndFocusContainer';
const INSERT_CODE_CELL_AT_TOP_COMMAND_ID = 'notebook.cell.insertCodeCellAtTop';
const INSERT_MARKDOWN_CELL_ABOVE_COMMAND_ID = 'notebook.cell.insertMarkdownCellAbove';
const INSERT_MARKDOWN_CELL_BELOW_COMMAND_ID = 'notebook.cell.insertMarkdownCellBelow';
const INSERT_MARKDOWN_CELL_AT_TOP_COMMAND_ID = 'notebook.cell.insertMarkdownCellAtTop';
export function insertNewCell(accessor, context, kind, direction, focusEditor) {
    let newCell = null;
    if (context.ui) {
        context.notebookEditor.focus();
    }
    const languageService = accessor.get(ILanguageService);
    const kernelHistoryService = accessor.get(INotebookKernelHistoryService);
    if (context.cell) {
        const idx = context.notebookEditor.getCellIndex(context.cell);
        newCell = insertCell(languageService, context.notebookEditor, idx, kind, direction, undefined, true, kernelHistoryService);
    }
    else {
        const focusRange = context.notebookEditor.getFocus();
        const next = Math.max(focusRange.end - 1, 0);
        newCell = insertCell(languageService, context.notebookEditor, next, kind, direction, undefined, true, kernelHistoryService);
    }
    return newCell;
}
export class InsertCellCommand extends NotebookAction {
    constructor(desc, kind, direction, focusEditor) {
        super(desc);
        this.kind = kind;
        this.direction = direction;
        this.focusEditor = focusEditor;
    }
    async runWithContext(accessor, context) {
        const newCell = await insertNewCell(accessor, context, this.kind, this.direction, this.focusEditor);
        if (newCell) {
            await context.notebookEditor.focusNotebookCell(newCell, this.focusEditor ? 'editor' : 'container');
        }
    }
}
registerAction2(class InsertCodeCellAboveAction extends InsertCellCommand {
    constructor() {
        super({
            id: INSERT_CODE_CELL_ABOVE_COMMAND_ID,
            title: localize('notebookActions.insertCodeCellAbove', "Insert Code Cell Above"),
            keybinding: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 3 /* KeyCode.Enter */,
                when: ContextKeyExpr.and(NOTEBOOK_CELL_LIST_FOCUSED, InputFocusedContext.toNegated()),
                weight: 200 /* KeybindingWeight.WorkbenchContrib */
            },
            menu: {
                id: MenuId.NotebookCellInsert,
                order: 0
            }
        }, CellKind.Code, 'above', true);
    }
});
registerAction2(class InsertCodeCellAboveAndFocusContainerAction extends InsertCellCommand {
    constructor() {
        super({
            id: INSERT_CODE_CELL_ABOVE_AND_FOCUS_CONTAINER_COMMAND_ID,
            title: localize('notebookActions.insertCodeCellAboveAndFocusContainer', "Insert Code Cell Above and Focus Container")
        }, CellKind.Code, 'above', false);
    }
});
registerAction2(class InsertCodeCellBelowAction extends InsertCellCommand {
    constructor() {
        super({
            id: INSERT_CODE_CELL_BELOW_COMMAND_ID,
            title: localize('notebookActions.insertCodeCellBelow', "Insert Code Cell Below"),
            keybinding: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */,
                when: ContextKeyExpr.and(NOTEBOOK_CELL_LIST_FOCUSED, InputFocusedContext.toNegated()),
                weight: 200 /* KeybindingWeight.WorkbenchContrib */
            },
            menu: {
                id: MenuId.NotebookCellInsert,
                order: 1
            }
        }, CellKind.Code, 'below', true);
    }
});
registerAction2(class InsertCodeCellBelowAndFocusContainerAction extends InsertCellCommand {
    constructor() {
        super({
            id: INSERT_CODE_CELL_BELOW_AND_FOCUS_CONTAINER_COMMAND_ID,
            title: localize('notebookActions.insertCodeCellBelowAndFocusContainer', "Insert Code Cell Below and Focus Container"),
        }, CellKind.Code, 'below', false);
    }
});
registerAction2(class InsertMarkdownCellAboveAction extends InsertCellCommand {
    constructor() {
        super({
            id: INSERT_MARKDOWN_CELL_ABOVE_COMMAND_ID,
            title: localize('notebookActions.insertMarkdownCellAbove', "Insert Markdown Cell Above"),
            menu: {
                id: MenuId.NotebookCellInsert,
                order: 2
            }
        }, CellKind.Markup, 'above', true);
    }
});
registerAction2(class InsertMarkdownCellBelowAction extends InsertCellCommand {
    constructor() {
        super({
            id: INSERT_MARKDOWN_CELL_BELOW_COMMAND_ID,
            title: localize('notebookActions.insertMarkdownCellBelow', "Insert Markdown Cell Below"),
            menu: {
                id: MenuId.NotebookCellInsert,
                order: 3
            }
        }, CellKind.Markup, 'below', true);
    }
});
registerAction2(class InsertCodeCellAtTopAction extends NotebookAction {
    constructor() {
        super({
            id: INSERT_CODE_CELL_AT_TOP_COMMAND_ID,
            title: localize('notebookActions.insertCodeCellAtTop', "Add Code Cell At Top"),
            f1: false
        });
    }
    async run(accessor, context) {
        context = context ?? this.getEditorContextFromArgsOrActive(accessor);
        if (context) {
            this.runWithContext(accessor, context);
        }
    }
    async runWithContext(accessor, context) {
        const languageService = accessor.get(ILanguageService);
        const kernelHistoryService = accessor.get(INotebookKernelHistoryService);
        const newCell = insertCell(languageService, context.notebookEditor, 0, CellKind.Code, 'above', undefined, true, kernelHistoryService);
        if (newCell) {
            await context.notebookEditor.focusNotebookCell(newCell, 'editor');
        }
    }
});
registerAction2(class InsertMarkdownCellAtTopAction extends NotebookAction {
    constructor() {
        super({
            id: INSERT_MARKDOWN_CELL_AT_TOP_COMMAND_ID,
            title: localize('notebookActions.insertMarkdownCellAtTop', "Add Markdown Cell At Top"),
            f1: false
        });
    }
    async run(accessor, context) {
        context = context ?? this.getEditorContextFromArgsOrActive(accessor);
        if (context) {
            this.runWithContext(accessor, context);
        }
    }
    async runWithContext(accessor, context) {
        const languageService = accessor.get(ILanguageService);
        const kernelHistoryService = accessor.get(INotebookKernelHistoryService);
        const newCell = insertCell(languageService, context.notebookEditor, 0, CellKind.Markup, 'above', undefined, true, kernelHistoryService);
        if (newCell) {
            await context.notebookEditor.focusNotebookCell(newCell, 'editor');
        }
    }
});
MenuRegistry.appendMenuItem(MenuId.NotebookCellBetween, {
    command: {
        id: INSERT_CODE_CELL_BELOW_COMMAND_ID,
        title: '$(add) ' + localize('notebookActions.menu.insertCode', "Code"),
        tooltip: localize('notebookActions.menu.insertCode.tooltip', "Add Code Cell")
    },
    order: 0,
    group: 'inline',
    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true), ContextKeyExpr.notEquals('config.notebook.experimental.insertToolbarAlignment', 'left'))
});
MenuRegistry.appendMenuItem(MenuId.NotebookCellBetween, {
    command: {
        id: INSERT_CODE_CELL_BELOW_COMMAND_ID,
        title: localize('notebookActions.menu.insertCode.minimalToolbar', "Add Code"),
        icon: Codicon.add,
        tooltip: localize('notebookActions.menu.insertCode.tooltip', "Add Code Cell")
    },
    order: 0,
    group: 'inline',
    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true), ContextKeyExpr.equals('config.notebook.experimental.insertToolbarAlignment', 'left'))
});
MenuRegistry.appendMenuItem(MenuId.NotebookToolbar, {
    command: {
        id: INSERT_CODE_CELL_BELOW_COMMAND_ID,
        icon: Codicon.add,
        title: localize('notebookActions.menu.insertCode.ontoolbar', "Code"),
        tooltip: localize('notebookActions.menu.insertCode.tooltip', "Add Code Cell")
    },
    order: -5,
    group: 'navigation/add',
    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true), ContextKeyExpr.notEquals('config.notebook.insertToolbarLocation', 'betweenCells'), ContextKeyExpr.notEquals('config.notebook.insertToolbarLocation', 'hidden'))
});
MenuRegistry.appendMenuItem(MenuId.NotebookCellListTop, {
    command: {
        id: INSERT_CODE_CELL_AT_TOP_COMMAND_ID,
        title: '$(add) ' + localize('notebookActions.menu.insertCode', "Code"),
        tooltip: localize('notebookActions.menu.insertCode.tooltip', "Add Code Cell")
    },
    order: 0,
    group: 'inline',
    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true), ContextKeyExpr.notEquals('config.notebook.experimental.insertToolbarAlignment', 'left'))
});
MenuRegistry.appendMenuItem(MenuId.NotebookCellListTop, {
    command: {
        id: INSERT_CODE_CELL_AT_TOP_COMMAND_ID,
        title: localize('notebookActions.menu.insertCode.minimaltoolbar', "Add Code"),
        icon: Codicon.add,
        tooltip: localize('notebookActions.menu.insertCode.tooltip', "Add Code Cell")
    },
    order: 0,
    group: 'inline',
    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true), ContextKeyExpr.equals('config.notebook.experimental.insertToolbarAlignment', 'left'))
});
MenuRegistry.appendMenuItem(MenuId.NotebookCellBetween, {
    command: {
        id: INSERT_MARKDOWN_CELL_BELOW_COMMAND_ID,
        title: '$(add) ' + localize('notebookActions.menu.insertMarkdown', "Markdown"),
        tooltip: localize('notebookActions.menu.insertMarkdown.tooltip', "Add Markdown Cell")
    },
    order: 1,
    group: 'inline',
    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true), ContextKeyExpr.notEquals('config.notebook.experimental.insertToolbarAlignment', 'left'))
});
MenuRegistry.appendMenuItem(MenuId.NotebookToolbar, {
    command: {
        id: INSERT_MARKDOWN_CELL_BELOW_COMMAND_ID,
        icon: Codicon.add,
        title: localize('notebookActions.menu.insertMarkdown.ontoolbar', "Markdown"),
        tooltip: localize('notebookActions.menu.insertMarkdown.tooltip', "Add Markdown Cell")
    },
    order: -5,
    group: 'navigation/add',
    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true), ContextKeyExpr.notEquals('config.notebook.insertToolbarLocation', 'betweenCells'), ContextKeyExpr.notEquals('config.notebook.insertToolbarLocation', 'hidden'), ContextKeyExpr.notEquals(`config.${NotebookSetting.globalToolbarShowLabel}`, false), ContextKeyExpr.notEquals(`config.${NotebookSetting.globalToolbarShowLabel}`, 'never'))
});
MenuRegistry.appendMenuItem(MenuId.NotebookCellListTop, {
    command: {
        id: INSERT_MARKDOWN_CELL_AT_TOP_COMMAND_ID,
        title: '$(add) ' + localize('notebookActions.menu.insertMarkdown', "Markdown"),
        tooltip: localize('notebookActions.menu.insertMarkdown.tooltip', "Add Markdown Cell")
    },
    order: 1,
    group: 'inline',
    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_EDITABLE.isEqualTo(true), ContextKeyExpr.notEquals('config.notebook.experimental.insertToolbarAlignment', 'left'))
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zZXJ0Q2VsbEFjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svYnJvd3Nlci9jb250cm9sbGVyL2luc2VydENlbGxBY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUVqRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN0RixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFtQixNQUFNLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQzNILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUcvRixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDakQsT0FBTyxFQUEwQixjQUFjLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUMxRSxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUUzRyxPQUFPLEVBQUUsUUFBUSxFQUFFLGVBQWUsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBRXRGLE1BQU0saUNBQWlDLEdBQUcsbUNBQW1DLENBQUM7QUFDOUUsTUFBTSxpQ0FBaUMsR0FBRyxtQ0FBbUMsQ0FBQztBQUM5RSxNQUFNLHFEQUFxRCxHQUFHLG9EQUFvRCxDQUFDO0FBQ25ILE1BQU0scURBQXFELEdBQUcsb0RBQW9ELENBQUM7QUFDbkgsTUFBTSxrQ0FBa0MsR0FBRyxt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