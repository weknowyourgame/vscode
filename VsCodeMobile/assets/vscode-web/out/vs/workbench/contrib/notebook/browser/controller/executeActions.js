/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Iterable } from '../../../../../base/common/iterator.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { localize, localize2 } from '../../../../../nls.js';
import { MenuId, MenuRegistry, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IDebugService } from '../../../debug/common/debug.js';
import { CTX_INLINE_CHAT_FOCUSED } from '../../../inlineChat/common/inlineChat.js';
import { insertCell } from './cellOperations.js';
import { CELL_TITLE_CELL_GROUP_ID, NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT, NotebookAction, NotebookCellAction, NotebookMultiCellAction, cellExecutionArgs, getContextFromActiveEditor, getContextFromUri, parseMultiCellExecutionArgs } from './coreActions.js';
import { CellEditState, CellFocusMode, EXECUTE_CELL_COMMAND_ID, ScrollToRevealBehavior } from '../notebookBrowser.js';
import * as icons from '../notebookIcons.js';
import { CellKind, CellUri, NotebookSetting } from '../../common/notebookCommon.js';
import { NOTEBOOK_CELL_EXECUTING, NOTEBOOK_CELL_EXECUTION_STATE, NOTEBOOK_CELL_LIST_FOCUSED, NOTEBOOK_CELL_TYPE, NOTEBOOK_HAS_RUNNING_CELL, NOTEBOOK_HAS_SOMETHING_RUNNING, NOTEBOOK_INTERRUPTIBLE_KERNEL, NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_KERNEL_COUNT, NOTEBOOK_KERNEL_SOURCE_COUNT, NOTEBOOK_LAST_CELL_FAILED, NOTEBOOK_MISSING_KERNEL_EXTENSION } from '../../common/notebookContextKeys.js';
import { NotebookEditorInput } from '../../common/notebookEditorInput.js';
import { INotebookExecutionStateService } from '../../common/notebookExecutionStateService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { CodeCellViewModel } from '../viewModel/codeCellViewModel.js';
const EXECUTE_NOTEBOOK_COMMAND_ID = 'notebook.execute';
const CANCEL_NOTEBOOK_COMMAND_ID = 'notebook.cancelExecution';
const INTERRUPT_NOTEBOOK_COMMAND_ID = 'notebook.interruptExecution';
const CANCEL_CELL_COMMAND_ID = 'notebook.cell.cancelExecution';
const EXECUTE_CELL_FOCUS_CONTAINER_COMMAND_ID = 'notebook.cell.executeAndFocusContainer';
const EXECUTE_CELL_SELECT_BELOW = 'notebook.cell.executeAndSelectBelow';
const EXECUTE_CELL_INSERT_BELOW = 'notebook.cell.executeAndInsertBelow';
const EXECUTE_CELL_AND_BELOW = 'notebook.cell.executeCellAndBelow';
const EXECUTE_CELLS_ABOVE = 'notebook.cell.executeCellsAbove';
const RENDER_ALL_MARKDOWN_CELLS = 'notebook.renderAllMarkdownCells';
const REVEAL_RUNNING_CELL = 'notebook.revealRunningCell';
const REVEAL_LAST_FAILED_CELL = 'notebook.revealLastFailedCell';
// If this changes, update getCodeCellExecutionContextKeyService to match
export const executeCondition = ContextKeyExpr.and(NOTEBOOK_CELL_TYPE.isEqualTo('code'), ContextKeyExpr.or(ContextKeyExpr.greater(NOTEBOOK_KERNEL_COUNT.key, 0), ContextKeyExpr.greater(NOTEBOOK_KERNEL_SOURCE_COUNT.key, 0), NOTEBOOK_MISSING_KERNEL_EXTENSION));
export const executeThisCellCondition = ContextKeyExpr.and(executeCondition, NOTEBOOK_CELL_EXECUTING.toNegated());
export const executeSectionCondition = ContextKeyExpr.and(NOTEBOOK_CELL_TYPE.isEqualTo('markup'));
function renderAllMarkdownCells(context) {
    for (let i = 0; i < context.notebookEditor.getLength(); i++) {
        const cell = context.notebookEditor.cellAt(i);
        if (cell.cellKind === CellKind.Markup) {
            cell.updateEditState(CellEditState.Preview, 'renderAllMarkdownCells');
        }
    }
}
async function runCell(editorGroupsService, context, editorService) {
    const group = editorGroupsService.activeGroup;
    if (group) {
        if (group.activeEditor) {
            group.pinEditor(group.activeEditor);
        }
    }
    // If auto-reveal is enabled, ensure the notebook editor is visible before revealing cells
    if (context.autoReveal && (context.cell || context.selectedCells?.length) && editorService) {
        editorService.openEditor({ resource: context.notebookEditor.textModel.uri, options: { revealIfOpened: true } });
    }
    if (context.ui && context.cell) {
        if (context.autoReveal) {
            handleAutoReveal(context.cell, context.notebookEditor);
        }
        await context.notebookEditor.executeNotebookCells(Iterable.single(context.cell));
    }
    else if (context.selectedCells?.length || context.cell) {
        const selectedCells = context.selectedCells?.length ? context.selectedCells : [context.cell];
        const firstCell = selectedCells[0];
        if (firstCell && context.autoReveal) {
            handleAutoReveal(firstCell, context.notebookEditor);
        }
        await context.notebookEditor.executeNotebookCells(selectedCells);
    }
    let foundEditor = undefined;
    for (const [, codeEditor] of context.notebookEditor.codeEditors) {
        if (isEqual(codeEditor.getModel()?.uri, (context.cell ?? context.selectedCells?.[0])?.uri)) {
            foundEditor = codeEditor;
            break;
        }
    }
    if (!foundEditor) {
        return;
    }
}
const SMART_VIEWPORT_TOP_REVEAL_PADDING = 20; // enough to not cut off top of cell toolbar
const SMART_VIEWPORT_BOTTOM_REVEAL_PADDING = 60; // enough to show full bottom of output element + tiny buffer below that vertical bar
function handleAutoReveal(cell, notebookEditor) {
    // always focus the container, blue bar is a good visual aid in tracking what's happening
    notebookEditor.focusNotebookCell(cell, 'container', { skipReveal: true });
    // Handle markup cells with simple reveal
    if (cell.cellKind === CellKind.Markup) {
        const cellIndex = notebookEditor.getCellIndex(cell);
        notebookEditor.revealCellRangeInView({ start: cellIndex, end: cellIndex + 1 });
        return;
    }
    // Ensure we're working with a code cell - we need the CodeCellViewModel type for accessing layout properties like outputTotalHeight
    if (!(cell instanceof CodeCellViewModel)) {
        return;
    }
    // Get all dimensions
    const cellEditorScrollTop = notebookEditor.getAbsoluteTopOfElement(cell);
    const cellEditorScrollBottom = cellEditorScrollTop + cell.layoutInfo.outputContainerOffset;
    const cellOutputHeight = cell.layoutInfo.outputTotalHeight;
    const cellOutputScrollBottom = notebookEditor.getAbsoluteBottomOfElement(cell);
    const viewportHeight = notebookEditor.getLayoutInfo().height;
    const viewportHeight34 = viewportHeight * 0.34;
    const viewportHeight66 = viewportHeight * 0.66;
    const totalHeight = cell.layoutInfo.totalHeight;
    const isFullyVisible = cellEditorScrollTop >= notebookEditor.scrollTop && cellOutputScrollBottom <= notebookEditor.scrollBottom;
    const isEditorBottomVisible = ((cellEditorScrollBottom - 25 /* padding for the cell status bar */) >= notebookEditor.scrollTop) &&
        ((cellEditorScrollBottom + 25 /* padding to see a sliver of the beginning of outputs */) <= notebookEditor.scrollBottom);
    // Common scrolling functions
    const revealWithTopPadding = (position) => { notebookEditor.setScrollTop(position - SMART_VIEWPORT_TOP_REVEAL_PADDING); };
    const revealWithNoPadding = (position) => { notebookEditor.setScrollTop(position); };
    const revealWithBottomPadding = (position) => { notebookEditor.setScrollTop(position + SMART_VIEWPORT_BOTTOM_REVEAL_PADDING); };
    // CASE 0: Total is already visible
    if (isFullyVisible) {
        return;
    }
    // CASE 1: Total fits within viewport
    if (totalHeight <= viewportHeight && !isEditorBottomVisible) {
        revealWithTopPadding(cellEditorScrollTop);
        return;
    }
    // CASE 2: Total doesn't fit in the viewport
    if (totalHeight > viewportHeight && !isEditorBottomVisible) {
        if (cellOutputHeight > 0 && cellOutputHeight >= viewportHeight66) {
            // has large outputs -- Show 34% editor, 66% output
            revealWithNoPadding(cellEditorScrollBottom - viewportHeight34);
        }
        else if (cellOutputHeight > 0) {
            // has small outputs -- Show output at viewport bottom
            revealWithBottomPadding(cellOutputScrollBottom - viewportHeight);
        }
        else {
            // No outputs, just big cell -- put editor bottom @ 2/3 of viewport height
            revealWithNoPadding(cellEditorScrollBottom - viewportHeight66);
        }
    }
}
registerAction2(class RenderAllMarkdownCellsAction extends NotebookAction {
    constructor() {
        super({
            id: RENDER_ALL_MARKDOWN_CELLS,
            title: localize('notebookActions.renderMarkdown', "Render All Markdown Cells"),
        });
    }
    async runWithContext(accessor, context) {
        renderAllMarkdownCells(context);
    }
});
registerAction2(class ExecuteNotebookAction extends NotebookAction {
    constructor() {
        super({
            id: EXECUTE_NOTEBOOK_COMMAND_ID,
            title: localize('notebookActions.executeNotebook', "Run All"),
            icon: icons.executeAllIcon,
            metadata: {
                description: localize('notebookActions.executeNotebook', "Run All"),
                args: [
                    {
                        name: 'uri',
                        description: 'The document uri'
                    }
                ]
            },
            menu: [
                {
                    id: MenuId.EditorTitle,
                    order: -1,
                    group: 'navigation',
                    when: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, ContextKeyExpr.or(NOTEBOOK_INTERRUPTIBLE_KERNEL.toNegated(), NOTEBOOK_HAS_SOMETHING_RUNNING.toNegated()), ContextKeyExpr.notEquals('config.notebook.globalToolbar', true))
                },
                {
                    id: MenuId.NotebookToolbar,
                    order: -1,
                    group: 'navigation/execute',
                    when: ContextKeyExpr.and(ContextKeyExpr.or(NOTEBOOK_INTERRUPTIBLE_KERNEL.toNegated(), NOTEBOOK_HAS_SOMETHING_RUNNING.toNegated()), ContextKeyExpr.and(NOTEBOOK_HAS_SOMETHING_RUNNING, NOTEBOOK_INTERRUPTIBLE_KERNEL.toNegated())?.negate(), ContextKeyExpr.equals('config.notebook.globalToolbar', true))
                }
            ]
        });
    }
    getEditorContextFromArgsOrActive(accessor, context) {
        return getContextFromUri(accessor, context) ?? getContextFromActiveEditor(accessor.get(IEditorService));
    }
    async runWithContext(accessor, context) {
        renderAllMarkdownCells(context);
        const editorService = accessor.get(IEditorService);
        const editor = editorService.findEditors({
            resource: context.notebookEditor.textModel.uri,
            typeId: NotebookEditorInput.ID,
            editorId: context.notebookEditor.textModel.viewType
        }).at(0);
        const editorGroupService = accessor.get(IEditorGroupsService);
        if (editor) {
            const group = editorGroupService.getGroup(editor.groupId);
            group?.pinEditor(editor.editor);
        }
        return context.notebookEditor.executeNotebookCells();
    }
});
registerAction2(class ExecuteCell extends NotebookMultiCellAction {
    constructor() {
        super({
            id: EXECUTE_CELL_COMMAND_ID,
            precondition: executeThisCellCondition,
            title: localize('notebookActions.execute', "Execute Cell"),
            keybinding: {
                when: NOTEBOOK_CELL_LIST_FOCUSED,
                primary: 256 /* KeyMod.WinCtrl */ | 3 /* KeyCode.Enter */,
                win: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 3 /* KeyCode.Enter */
                },
                weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
            },
            menu: {
                id: MenuId.NotebookCellExecutePrimary,
                when: executeThisCellCondition,
                group: 'inline'
            },
            metadata: {
                description: localize('notebookActions.execute', "Execute Cell"),
                args: cellExecutionArgs
            },
            icon: icons.executeIcon
        });
    }
    parseArgs(accessor, ...args) {
        return parseMultiCellExecutionArgs(accessor, ...args);
    }
    async runWithContext(accessor, context) {
        const editorGroupsService = accessor.get(IEditorGroupsService);
        const editorService = accessor.get(IEditorService);
        if (context.ui) {
            await context.notebookEditor.focusNotebookCell(context.cell, 'container', { skipReveal: true });
        }
        await runCell(editorGroupsService, context, editorService);
    }
});
registerAction2(class ExecuteAboveCells extends NotebookMultiCellAction {
    constructor() {
        super({
            id: EXECUTE_CELLS_ABOVE,
            precondition: executeCondition,
            title: localize('notebookActions.executeAbove', "Execute Above Cells"),
            menu: [
                {
                    id: MenuId.NotebookCellExecute,
                    when: ContextKeyExpr.and(executeCondition, ContextKeyExpr.equals(`config.${NotebookSetting.consolidatedRunButton}`, true))
                },
                {
                    id: MenuId.NotebookCellTitle,
                    order: 2 /* CellToolbarOrder.ExecuteAboveCells */,
                    group: CELL_TITLE_CELL_GROUP_ID,
                    when: ContextKeyExpr.and(executeCondition, ContextKeyExpr.equals(`config.${NotebookSetting.consolidatedRunButton}`, false))
                }
            ],
            icon: icons.executeAboveIcon
        });
    }
    parseArgs(accessor, ...args) {
        return parseMultiCellExecutionArgs(accessor, ...args);
    }
    async runWithContext(accessor, context) {
        let endCellIdx = undefined;
        if (context.ui) {
            endCellIdx = context.notebookEditor.getCellIndex(context.cell);
            await context.notebookEditor.focusNotebookCell(context.cell, 'container', { skipReveal: true });
        }
        else {
            endCellIdx = Math.min(...context.selectedCells.map(cell => context.notebookEditor.getCellIndex(cell)));
        }
        if (typeof endCellIdx === 'number') {
            const range = { start: 0, end: endCellIdx };
            const cells = context.notebookEditor.getCellsInRange(range);
            context.notebookEditor.executeNotebookCells(cells);
        }
    }
});
registerAction2(class ExecuteCellAndBelow extends NotebookMultiCellAction {
    constructor() {
        super({
            id: EXECUTE_CELL_AND_BELOW,
            precondition: executeCondition,
            title: localize('notebookActions.executeBelow', "Execute Cell and Below"),
            menu: [
                {
                    id: MenuId.NotebookCellExecute,
                    when: ContextKeyExpr.and(executeCondition, ContextKeyExpr.equals(`config.${NotebookSetting.consolidatedRunButton}`, true))
                },
                {
                    id: MenuId.NotebookCellTitle,
                    order: 3 /* CellToolbarOrder.ExecuteCellAndBelow */,
                    group: CELL_TITLE_CELL_GROUP_ID,
                    when: ContextKeyExpr.and(executeCondition, ContextKeyExpr.equals(`config.${NotebookSetting.consolidatedRunButton}`, false))
                }
            ],
            icon: icons.executeBelowIcon
        });
    }
    parseArgs(accessor, ...args) {
        return parseMultiCellExecutionArgs(accessor, ...args);
    }
    async runWithContext(accessor, context) {
        let startCellIdx = undefined;
        if (context.ui) {
            startCellIdx = context.notebookEditor.getCellIndex(context.cell);
            await context.notebookEditor.focusNotebookCell(context.cell, 'container', { skipReveal: true });
        }
        else {
            startCellIdx = Math.min(...context.selectedCells.map(cell => context.notebookEditor.getCellIndex(cell)));
        }
        if (typeof startCellIdx === 'number') {
            const range = { start: startCellIdx, end: context.notebookEditor.getLength() };
            const cells = context.notebookEditor.getCellsInRange(range);
            context.notebookEditor.executeNotebookCells(cells);
        }
    }
});
registerAction2(class ExecuteCellFocusContainer extends NotebookMultiCellAction {
    constructor() {
        super({
            id: EXECUTE_CELL_FOCUS_CONTAINER_COMMAND_ID,
            precondition: executeThisCellCondition,
            title: localize('notebookActions.executeAndFocusContainer', "Execute Cell and Focus Container"),
            metadata: {
                description: localize('notebookActions.executeAndFocusContainer', "Execute Cell and Focus Container"),
                args: cellExecutionArgs
            },
            icon: icons.executeIcon
        });
    }
    parseArgs(accessor, ...args) {
        return parseMultiCellExecutionArgs(accessor, ...args);
    }
    async runWithContext(accessor, context) {
        const editorGroupsService = accessor.get(IEditorGroupsService);
        const editorService = accessor.get(IEditorService);
        if (context.ui) {
            await context.notebookEditor.focusNotebookCell(context.cell, 'container', { skipReveal: true });
        }
        else {
            const firstCell = context.selectedCells[0];
            if (firstCell) {
                await context.notebookEditor.focusNotebookCell(firstCell, 'container', { skipReveal: true });
            }
        }
        await runCell(editorGroupsService, context, editorService);
    }
});
const cellCancelCondition = ContextKeyExpr.or(ContextKeyExpr.equals(NOTEBOOK_CELL_EXECUTION_STATE.key, 'executing'), ContextKeyExpr.equals(NOTEBOOK_CELL_EXECUTION_STATE.key, 'pending'));
registerAction2(class CancelExecuteCell extends NotebookMultiCellAction {
    constructor() {
        super({
            id: CANCEL_CELL_COMMAND_ID,
            precondition: cellCancelCondition,
            title: localize('notebookActions.cancel', "Stop Cell Execution"),
            icon: icons.stopIcon,
            menu: {
                id: MenuId.NotebookCellExecutePrimary,
                when: cellCancelCondition,
                group: 'inline'
            },
            metadata: {
                description: localize('notebookActions.cancel', "Stop Cell Execution"),
                args: [
                    {
                        name: 'options',
                        description: 'The cell range options',
                        schema: {
                            'type': 'object',
                            'required': ['ranges'],
                            'properties': {
                                'ranges': {
                                    'type': 'array',
                                    items: [
                                        {
                                            'type': 'object',
                                            'required': ['start', 'end'],
                                            'properties': {
                                                'start': {
                                                    'type': 'number'
                                                },
                                                'end': {
                                                    'type': 'number'
                                                }
                                            }
                                        }
                                    ]
                                },
                                'document': {
                                    'type': 'object',
                                    'description': 'The document uri',
                                }
                            }
                        }
                    }
                ]
            },
        });
    }
    parseArgs(accessor, ...args) {
        return parseMultiCellExecutionArgs(accessor, ...args);
    }
    async runWithContext(accessor, context) {
        if (context.ui) {
            await context.notebookEditor.focusNotebookCell(context.cell, 'container', { skipReveal: true });
            return context.notebookEditor.cancelNotebookCells(Iterable.single(context.cell));
        }
        else {
            return context.notebookEditor.cancelNotebookCells(context.selectedCells);
        }
    }
});
registerAction2(class ExecuteCellSelectBelow extends NotebookCellAction {
    constructor() {
        super({
            id: EXECUTE_CELL_SELECT_BELOW,
            precondition: ContextKeyExpr.or(executeThisCellCondition, NOTEBOOK_CELL_TYPE.isEqualTo('markup')),
            title: localize('notebookActions.executeAndSelectBelow', "Execute Notebook Cell and Select Below"),
            keybinding: {
                when: ContextKeyExpr.and(NOTEBOOK_CELL_LIST_FOCUSED, CTX_INLINE_CHAT_FOCUSED.negate()),
                primary: 1024 /* KeyMod.Shift */ | 3 /* KeyCode.Enter */,
                weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
            },
        });
    }
    async runWithContext(accessor, context) {
        const editorGroupsService = accessor.get(IEditorGroupsService);
        const editorService = accessor.get(IEditorService);
        const idx = context.notebookEditor.getCellIndex(context.cell);
        if (typeof idx !== 'number') {
            return;
        }
        const languageService = accessor.get(ILanguageService);
        const config = accessor.get(IConfigurationService);
        const scrollBehavior = config.getValue(NotebookSetting.scrollToRevealCell);
        let focusOptions;
        if (scrollBehavior === 'none') {
            focusOptions = { skipReveal: true };
        }
        else {
            focusOptions = {
                revealBehavior: scrollBehavior === 'fullCell' ? ScrollToRevealBehavior.fullCell : ScrollToRevealBehavior.firstLine
            };
        }
        if (context.cell.cellKind === CellKind.Markup) {
            const nextCell = context.notebookEditor.cellAt(idx + 1);
            context.cell.updateEditState(CellEditState.Preview, EXECUTE_CELL_SELECT_BELOW);
            if (nextCell) {
                await context.notebookEditor.focusNotebookCell(nextCell, 'container', focusOptions);
            }
            else {
                const newCell = insertCell(languageService, context.notebookEditor, idx, CellKind.Markup, 'below');
                if (newCell) {
                    await context.notebookEditor.focusNotebookCell(newCell, 'editor', focusOptions);
                }
            }
            return;
        }
        else {
            const nextCell = context.notebookEditor.cellAt(idx + 1);
            if (nextCell) {
                await context.notebookEditor.focusNotebookCell(nextCell, 'container', focusOptions);
            }
            else {
                const newCell = insertCell(languageService, context.notebookEditor, idx, CellKind.Code, 'below');
                if (newCell) {
                    await context.notebookEditor.focusNotebookCell(newCell, 'editor', focusOptions);
                }
            }
            return runCell(editorGroupsService, context, editorService);
        }
    }
});
registerAction2(class ExecuteCellInsertBelow extends NotebookCellAction {
    constructor() {
        super({
            id: EXECUTE_CELL_INSERT_BELOW,
            precondition: ContextKeyExpr.or(executeThisCellCondition, NOTEBOOK_CELL_TYPE.isEqualTo('markup')),
            title: localize('notebookActions.executeAndInsertBelow', "Execute Notebook Cell and Insert Below"),
            keybinding: {
                when: NOTEBOOK_CELL_LIST_FOCUSED,
                primary: 512 /* KeyMod.Alt */ | 3 /* KeyCode.Enter */,
                weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
            },
        });
    }
    async runWithContext(accessor, context) {
        const editorGroupsService = accessor.get(IEditorGroupsService);
        const editorService = accessor.get(IEditorService);
        const idx = context.notebookEditor.getCellIndex(context.cell);
        const languageService = accessor.get(ILanguageService);
        const newFocusMode = context.cell.focusMode === CellFocusMode.Editor ? 'editor' : 'container';
        const newCell = insertCell(languageService, context.notebookEditor, idx, context.cell.cellKind, 'below');
        if (newCell) {
            await context.notebookEditor.focusNotebookCell(newCell, newFocusMode);
        }
        if (context.cell.cellKind === CellKind.Markup) {
            context.cell.updateEditState(CellEditState.Preview, EXECUTE_CELL_INSERT_BELOW);
        }
        else {
            runCell(editorGroupsService, context, editorService);
        }
    }
});
class CancelNotebook extends NotebookAction {
    getEditorContextFromArgsOrActive(accessor, context) {
        return getContextFromUri(accessor, context) ?? getContextFromActiveEditor(accessor.get(IEditorService));
    }
    async runWithContext(accessor, context) {
        return context.notebookEditor.cancelNotebookCells();
    }
}
registerAction2(class CancelAllNotebook extends CancelNotebook {
    constructor() {
        super({
            id: CANCEL_NOTEBOOK_COMMAND_ID,
            title: localize2('notebookActions.cancelNotebook', "Stop Execution"),
            icon: icons.stopIcon,
            menu: [
                {
                    id: MenuId.EditorTitle,
                    order: -1,
                    group: 'navigation',
                    when: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_HAS_SOMETHING_RUNNING, NOTEBOOK_INTERRUPTIBLE_KERNEL.toNegated(), ContextKeyExpr.notEquals('config.notebook.globalToolbar', true))
                },
                {
                    id: MenuId.NotebookToolbar,
                    order: -1,
                    group: 'navigation/execute',
                    when: ContextKeyExpr.and(NOTEBOOK_HAS_SOMETHING_RUNNING, NOTEBOOK_INTERRUPTIBLE_KERNEL.toNegated(), ContextKeyExpr.equals('config.notebook.globalToolbar', true))
                }
            ]
        });
    }
});
registerAction2(class InterruptNotebook extends CancelNotebook {
    constructor() {
        super({
            id: INTERRUPT_NOTEBOOK_COMMAND_ID,
            title: localize2('notebookActions.interruptNotebook', "Interrupt"),
            precondition: ContextKeyExpr.and(NOTEBOOK_HAS_SOMETHING_RUNNING, NOTEBOOK_INTERRUPTIBLE_KERNEL),
            icon: icons.stopIcon,
            menu: [
                {
                    id: MenuId.EditorTitle,
                    order: -1,
                    group: 'navigation',
                    when: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_HAS_SOMETHING_RUNNING, NOTEBOOK_INTERRUPTIBLE_KERNEL, ContextKeyExpr.notEquals('config.notebook.globalToolbar', true))
                },
                {
                    id: MenuId.NotebookToolbar,
                    order: -1,
                    group: 'navigation/execute',
                    when: ContextKeyExpr.and(NOTEBOOK_HAS_SOMETHING_RUNNING, NOTEBOOK_INTERRUPTIBLE_KERNEL, ContextKeyExpr.equals('config.notebook.globalToolbar', true))
                },
                {
                    id: MenuId.InteractiveToolbar,
                    group: 'navigation/execute'
                }
            ]
        });
    }
});
MenuRegistry.appendMenuItem(MenuId.NotebookToolbar, {
    title: localize('revealRunningCellShort', "Go To"),
    submenu: MenuId.NotebookCellExecuteGoTo,
    group: 'navigation/execute',
    order: 20,
    icon: ThemeIcon.modify(icons.executingStateIcon, 'spin')
});
registerAction2(class RevealRunningCellAction extends NotebookAction {
    constructor() {
        super({
            id: REVEAL_RUNNING_CELL,
            title: localize('revealRunningCell', "Go to Running Cell"),
            tooltip: localize('revealRunningCell', "Go to Running Cell"),
            shortTitle: localize('revealRunningCell', "Go to Running Cell"),
            precondition: NOTEBOOK_HAS_RUNNING_CELL,
            menu: [
                {
                    id: MenuId.EditorTitle,
                    when: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_HAS_RUNNING_CELL, ContextKeyExpr.notEquals('config.notebook.globalToolbar', true)),
                    group: 'navigation',
                    order: 0
                },
                {
                    id: MenuId.NotebookCellExecuteGoTo,
                    when: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_HAS_RUNNING_CELL, ContextKeyExpr.equals('config.notebook.globalToolbar', true)),
                    group: 'navigation/execute',
                    order: 20
                },
                {
                    id: MenuId.InteractiveToolbar,
                    when: ContextKeyExpr.and(NOTEBOOK_HAS_RUNNING_CELL, ContextKeyExpr.equals('activeEditor', 'workbench.editor.interactive')),
                    group: 'navigation',
                    order: 10
                }
            ],
            icon: ThemeIcon.modify(icons.executingStateIcon, 'spin')
        });
    }
    async runWithContext(accessor, context) {
        const notebookExecutionStateService = accessor.get(INotebookExecutionStateService);
        const notebook = context.notebookEditor.textModel.uri;
        const executingCells = notebookExecutionStateService.getCellExecutionsForNotebook(notebook);
        if (executingCells[0]) {
            const topStackFrameCell = this.findCellAtTopFrame(accessor, notebook);
            const focusHandle = topStackFrameCell ?? executingCells[0].cellHandle;
            const cell = context.notebookEditor.getCellByHandle(focusHandle);
            if (cell) {
                context.notebookEditor.focusNotebookCell(cell, 'container');
            }
        }
    }
    findCellAtTopFrame(accessor, notebook) {
        const debugService = accessor.get(IDebugService);
        for (const session of debugService.getModel().getSessions()) {
            for (const thread of session.getAllThreads()) {
                const sf = thread.getTopStackFrame();
                if (sf) {
                    const parsed = CellUri.parse(sf.source.uri);
                    if (parsed && parsed.notebook.toString() === notebook.toString()) {
                        return parsed.handle;
                    }
                }
            }
        }
        return undefined;
    }
});
registerAction2(class RevealLastFailedCellAction extends NotebookAction {
    constructor() {
        super({
            id: REVEAL_LAST_FAILED_CELL,
            title: localize('revealLastFailedCell', "Go to Most Recently Failed Cell"),
            tooltip: localize('revealLastFailedCell', "Go to Most Recently Failed Cell"),
            shortTitle: localize('revealLastFailedCellShort', "Go to Most Recently Failed Cell"),
            precondition: NOTEBOOK_LAST_CELL_FAILED,
            menu: [
                {
                    id: MenuId.EditorTitle,
                    when: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_LAST_CELL_FAILED, NOTEBOOK_HAS_RUNNING_CELL.toNegated(), ContextKeyExpr.notEquals('config.notebook.globalToolbar', true)),
                    group: 'navigation',
                    order: 0
                },
                {
                    id: MenuId.NotebookCellExecuteGoTo,
                    when: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_LAST_CELL_FAILED, NOTEBOOK_HAS_RUNNING_CELL.toNegated(), ContextKeyExpr.equals('config.notebook.globalToolbar', true)),
                    group: 'navigation/execute',
                    order: 20
                },
            ],
            icon: icons.errorStateIcon,
        });
    }
    async runWithContext(accessor, context) {
        const notebookExecutionStateService = accessor.get(INotebookExecutionStateService);
        const notebook = context.notebookEditor.textModel.uri;
        const lastFailedCellHandle = notebookExecutionStateService.getLastFailedCellForNotebook(notebook);
        if (lastFailedCellHandle !== undefined) {
            const lastFailedCell = context.notebookEditor.getCellByHandle(lastFailedCellHandle);
            if (lastFailedCell) {
                context.notebookEditor.focusNotebookCell(lastFailedCell, 'container');
            }
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhlY3V0ZUFjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svYnJvd3Nlci9jb250cm9sbGVyL2V4ZWN1dGVBY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUVsRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBR3BFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUQsT0FBTyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDMUcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBRXpGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDakQsT0FBTyxFQUFFLHdCQUF3QixFQUFvSSxvQ0FBb0MsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsdUJBQXVCLEVBQUUsaUJBQWlCLEVBQUUsMEJBQTBCLEVBQUUsaUJBQWlCLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUNoWSxPQUFPLEVBQUUsYUFBYSxFQUFFLGFBQWEsRUFBRSx1QkFBdUIsRUFB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