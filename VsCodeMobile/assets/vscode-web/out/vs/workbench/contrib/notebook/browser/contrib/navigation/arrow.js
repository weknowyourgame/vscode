/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { timeout } from '../../../../../../base/common/async.js';
import { EditorExtensionsRegistry } from '../../../../../../editor/browser/editorExtensions.js';
import { EditorContextKeys } from '../../../../../../editor/common/editorContextKeys.js';
import { localize, localize2 } from '../../../../../../nls.js';
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from '../../../../../../platform/accessibility/common/accessibility.js';
import { Action2, registerAction2 } from '../../../../../../platform/actions/common/actions.js';
import { Extensions as ConfigurationExtensions } from '../../../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr } from '../../../../../../platform/contextkey/common/contextkey.js';
import { InputFocusedContextKey, IsWindowsContext } from '../../../../../../platform/contextkey/common/contextkeys.js';
import { Registry } from '../../../../../../platform/registry/common/platform.js';
import { InlineChatController } from '../../../../inlineChat/browser/inlineChatController.js';
import { NotebookAction, NotebookCellAction, NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT, findTargetCellEditor } from '../../controller/coreActions.js';
import { CellEditState } from '../../notebookBrowser.js';
import { CellKind, NOTEBOOK_EDITOR_CURSOR_BOUNDARY, NOTEBOOK_EDITOR_CURSOR_LINE_BOUNDARY } from '../../../common/notebookCommon.js';
import { NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_CELL_MARKDOWN_EDIT_MODE, NOTEBOOK_CELL_TYPE, NOTEBOOK_CURSOR_NAVIGATION_MODE, NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_OUTPUT_INPUT_FOCUSED, NOTEBOOK_OUTPUT_FOCUSED, NOTEBOOK_CELL_EDITOR_FOCUSED, IS_COMPOSITE_NOTEBOOK, NOTEBOOK_OR_COMPOSITE_IS_ACTIVE_EDITOR } from '../../../common/notebookContextKeys.js';
const NOTEBOOK_FOCUS_TOP = 'notebook.focusTop';
const NOTEBOOK_FOCUS_BOTTOM = 'notebook.focusBottom';
const NOTEBOOK_FOCUS_PREVIOUS_EDITOR = 'notebook.focusPreviousEditor';
const NOTEBOOK_FOCUS_NEXT_EDITOR = 'notebook.focusNextEditor';
const FOCUS_IN_OUTPUT_COMMAND_ID = 'notebook.cell.focusInOutput';
const FOCUS_OUT_OUTPUT_COMMAND_ID = 'notebook.cell.focusOutOutput';
export const CENTER_ACTIVE_CELL = 'notebook.centerActiveCell';
const NOTEBOOK_CURSOR_PAGEUP_COMMAND_ID = 'notebook.cell.cursorPageUp';
const NOTEBOOK_CURSOR_PAGEUP_SELECT_COMMAND_ID = 'notebook.cell.cursorPageUpSelect';
const NOTEBOOK_CURSOR_PAGEDOWN_COMMAND_ID = 'notebook.cell.cursorPageDown';
const NOTEBOOK_CURSOR_PAGEDOWN_SELECT_COMMAND_ID = 'notebook.cell.cursorPageDownSelect';
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'notebook.cell.nullAction',
            title: localize('notebook.cell.webviewHandledEvents', "Keypresses that should be handled by the focused element in the cell output."),
            keybinding: [{
                    when: NOTEBOOK_OUTPUT_INPUT_FOCUSED,
                    primary: 18 /* KeyCode.DownArrow */,
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1
                }, {
                    when: NOTEBOOK_OUTPUT_INPUT_FOCUSED,
                    primary: 16 /* KeyCode.UpArrow */,
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1
                }],
            f1: false
        });
    }
    run() {
        // noop, these are handled by the output webview
        return;
    }
});
registerAction2(class FocusNextCellAction extends NotebookCellAction {
    constructor() {
        super({
            id: NOTEBOOK_FOCUS_NEXT_EDITOR,
            title: localize('cursorMoveDown', 'Focus Next Cell Editor'),
            keybinding: [
                {
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate(), ContextKeyExpr.equals('config.notebook.navigation.allowNavigateToSurroundingCells', true), ContextKeyExpr.and(ContextKeyExpr.has(InputFocusedContextKey), EditorContextKeys.editorTextFocus, NOTEBOOK_EDITOR_CURSOR_BOUNDARY.notEqualsTo('top'), NOTEBOOK_EDITOR_CURSOR_BOUNDARY.notEqualsTo('none'), ContextKeyExpr.or(NOTEBOOK_EDITOR_CURSOR_LINE_BOUNDARY.isEqualTo('end'), NOTEBOOK_EDITOR_CURSOR_LINE_BOUNDARY.isEqualTo('both'))), EditorContextKeys.isEmbeddedDiffEditor.negate()),
                    primary: 18 /* KeyCode.DownArrow */,
                    weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT, // code cell keybinding, focus inside editor: lower weight to not override suggest widget
                },
                {
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate(), ContextKeyExpr.equals('config.notebook.navigation.allowNavigateToSurroundingCells', true), ContextKeyExpr.and(NOTEBOOK_CELL_TYPE.isEqualTo('markup'), NOTEBOOK_CELL_MARKDOWN_EDIT_MODE.isEqualTo(false), NOTEBOOK_CURSOR_NAVIGATION_MODE), EditorContextKeys.isEmbeddedDiffEditor.negate()),
                    primary: 18 /* KeyCode.DownArrow */,
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */, // markdown keybinding, focus on list: higher weight to override list.focusDown
                },
                {
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_OUTPUT_FOCUSED),
                    primary: 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */,
                    mac: { primary: 256 /* KeyMod.WinCtrl */ | 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */, },
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */
                },
                {
                    when: ContextKeyExpr.and(NOTEBOOK_CELL_EDITOR_FOCUSED, CONTEXT_ACCESSIBILITY_MODE_ENABLED),
                    primary: 2048 /* KeyMod.CtrlCmd */ | 12 /* KeyCode.PageDown */,
                    mac: { primary: 256 /* KeyMod.WinCtrl */ | 11 /* KeyCode.PageUp */, },
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1
                },
            ]
        });
    }
    async runWithContext(accessor, context) {
        const editor = context.notebookEditor;
        const activeCell = context.cell;
        const idx = editor.getCellIndex(activeCell);
        if (typeof idx !== 'number') {
            return;
        }
        if (idx >= editor.getLength() - 1) {
            // last one
            return;
        }
        const focusEditorLine = activeCell.textBuffer.getLineCount();
        const targetCell = (context.cell ?? context.selectedCells?.[0]);
        const foundEditor = targetCell ? findTargetCellEditor(context, targetCell) : undefined;
        if (foundEditor && foundEditor.hasTextFocus() && InlineChatController.get(foundEditor)?.getWidgetPosition()?.lineNumber === focusEditorLine) {
            InlineChatController.get(foundEditor)?.focus();
        }
        else {
            const newCell = editor.cellAt(idx + 1);
            const newFocusMode = newCell.cellKind === CellKind.Markup && newCell.getEditState() === CellEditState.Preview ? 'container' : 'editor';
            await editor.focusNotebookCell(newCell, newFocusMode, { focusEditorLine: 1 });
        }
    }
});
registerAction2(class FocusPreviousCellAction extends NotebookCellAction {
    constructor() {
        super({
            id: NOTEBOOK_FOCUS_PREVIOUS_EDITOR,
            title: localize('cursorMoveUp', 'Focus Previous Cell Editor'),
            keybinding: [
                {
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate(), ContextKeyExpr.equals('config.notebook.navigation.allowNavigateToSurroundingCells', true), ContextKeyExpr.and(ContextKeyExpr.has(InputFocusedContextKey), EditorContextKeys.editorTextFocus, NOTEBOOK_EDITOR_CURSOR_BOUNDARY.notEqualsTo('bottom'), NOTEBOOK_EDITOR_CURSOR_BOUNDARY.notEqualsTo('none'), ContextKeyExpr.or(NOTEBOOK_EDITOR_CURSOR_LINE_BOUNDARY.isEqualTo('start'), NOTEBOOK_EDITOR_CURSOR_LINE_BOUNDARY.isEqualTo('both'))), EditorContextKeys.isEmbeddedDiffEditor.negate()),
                    primary: 16 /* KeyCode.UpArrow */,
                    weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT, // code cell keybinding, focus inside editor: lower weight to not override suggest widget
                },
                {
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate(), ContextKeyExpr.equals('config.notebook.navigation.allowNavigateToSurroundingCells', true), ContextKeyExpr.and(NOTEBOOK_CELL_TYPE.isEqualTo('markup'), NOTEBOOK_CELL_MARKDOWN_EDIT_MODE.isEqualTo(false), NOTEBOOK_CURSOR_NAVIGATION_MODE), EditorContextKeys.isEmbeddedDiffEditor.negate()),
                    primary: 16 /* KeyCode.UpArrow */,
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */, // markdown keybinding, focus on list: higher weight to override list.focusDown
                },
                {
                    when: ContextKeyExpr.and(NOTEBOOK_CELL_EDITOR_FOCUSED, CONTEXT_ACCESSIBILITY_MODE_ENABLED),
                    primary: 2048 /* KeyMod.CtrlCmd */ | 11 /* KeyCode.PageUp */,
                    mac: { primary: 256 /* KeyMod.WinCtrl */ | 11 /* KeyCode.PageUp */, },
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1
                },
            ],
        });
    }
    async runWithContext(accessor, context) {
        const editor = context.notebookEditor;
        const activeCell = context.cell;
        const idx = editor.getCellIndex(activeCell);
        if (typeof idx !== 'number') {
            return;
        }
        if (idx < 1 || editor.getLength() === 0) {
            // we don't do loop
            return;
        }
        const newCell = editor.cellAt(idx - 1);
        const newFocusMode = newCell.cellKind === CellKind.Markup && newCell.getEditState() === CellEditState.Preview ? 'container' : 'editor';
        const focusEditorLine = newCell.textBuffer.getLineCount();
        await editor.focusNotebookCell(newCell, newFocusMode, { focusEditorLine: focusEditorLine });
        const foundEditor = findTargetCellEditor(context, newCell);
        if (foundEditor && InlineChatController.get(foundEditor)?.getWidgetPosition()?.lineNumber === focusEditorLine) {
            InlineChatController.get(foundEditor)?.focus();
        }
    }
});
registerAction2(class extends NotebookAction {
    constructor() {
        super({
            id: NOTEBOOK_FOCUS_TOP,
            title: localize('focusFirstCell', 'Focus First Cell'),
            keybinding: [
                {
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey)),
                    primary: 2048 /* KeyMod.CtrlCmd */ | 14 /* KeyCode.Home */,
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */
                },
                {
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey)),
                    mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */ },
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */
                }
            ],
        });
    }
    async runWithContext(accessor, context) {
        const editor = context.notebookEditor;
        if (editor.getLength() === 0) {
            return;
        }
        const firstCell = editor.cellAt(0);
        await editor.focusNotebookCell(firstCell, 'container');
    }
});
registerAction2(class extends NotebookAction {
    constructor() {
        super({
            id: NOTEBOOK_FOCUS_BOTTOM,
            title: localize('focusLastCell', 'Focus Last Cell'),
            keybinding: [
                {
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey)),
                    primary: 2048 /* KeyMod.CtrlCmd */ | 13 /* KeyCode.End */,
                    mac: undefined,
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */
                },
                {
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.not(InputFocusedContextKey)),
                    mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */ },
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */
                }
            ],
        });
    }
    async runWithContext(accessor, context) {
        const editor = context.notebookEditor;
        if (!editor.hasModel() || editor.getLength() === 0) {
            return;
        }
        const lastIdx = editor.getLength() - 1;
        const lastVisibleIdx = editor.getPreviousVisibleCellIndex(lastIdx);
        if (lastVisibleIdx) {
            const cell = editor.cellAt(lastVisibleIdx);
            await editor.focusNotebookCell(cell, 'container');
        }
    }
});
registerAction2(class extends NotebookCellAction {
    constructor() {
        super({
            id: FOCUS_IN_OUTPUT_COMMAND_ID,
            title: localize2('focusOutput', 'Focus In Active Cell Output'),
            f1: true,
            keybinding: [{
                    when: ContextKeyExpr.and(IS_COMPOSITE_NOTEBOOK.negate(), IsWindowsContext, NOTEBOOK_CELL_HAS_OUTPUTS),
                    primary: 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */,
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */
                }, {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 18 /* KeyCode.DownArrow */,
                    mac: { primary: 256 /* KeyMod.WinCtrl */ | 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */, },
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */
                }],
            precondition: NOTEBOOK_OR_COMPOSITE_IS_ACTIVE_EDITOR
        });
    }
    async runWithContext(accessor, context) {
        const editor = context.notebookEditor;
        const activeCell = context.cell;
        return timeout(0).then(() => editor.focusNotebookCell(activeCell, 'output'));
    }
});
registerAction2(class extends NotebookCellAction {
    constructor() {
        super({
            id: FOCUS_OUT_OUTPUT_COMMAND_ID,
            title: localize('focusOutputOut', 'Focus Out Active Cell Output'),
            keybinding: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 16 /* KeyCode.UpArrow */,
                mac: { primary: 256 /* KeyMod.WinCtrl */ | 2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */, },
                weight: 200 /* KeybindingWeight.WorkbenchContrib */
            },
            precondition: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_OUTPUT_FOCUSED),
        });
    }
    async runWithContext(accessor, context) {
        const editor = context.notebookEditor;
        const activeCell = context.cell;
        await editor.focusNotebookCell(activeCell, 'editor');
    }
});
registerAction2(class CenterActiveCellAction extends NotebookCellAction {
    constructor() {
        super({
            id: CENTER_ACTIVE_CELL,
            title: localize('notebookActions.centerActiveCell', "Center Active Cell"),
            keybinding: {
                when: NOTEBOOK_EDITOR_FOCUSED,
                primary: 2048 /* KeyMod.CtrlCmd */ | 42 /* KeyCode.KeyL */,
                mac: {
                    primary: 256 /* KeyMod.WinCtrl */ | 42 /* KeyCode.KeyL */,
                },
                weight: 200 /* KeybindingWeight.WorkbenchContrib */
            },
        });
    }
    async runWithContext(accessor, context) {
        return context.notebookEditor.revealInCenter(context.cell);
    }
});
registerAction2(class extends NotebookCellAction {
    constructor() {
        super({
            id: NOTEBOOK_CURSOR_PAGEUP_COMMAND_ID,
            title: localize('cursorPageUp', "Cell Cursor Page Up"),
            keybinding: [
                {
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.has(InputFocusedContextKey), EditorContextKeys.editorTextFocus),
                    primary: 11 /* KeyCode.PageUp */,
                    weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
                }
            ]
        });
    }
    async runWithContext(accessor, context) {
        EditorExtensionsRegistry.getEditorCommand('cursorPageUp').runCommand(accessor, { pageSize: getPageSize(context) });
    }
});
registerAction2(class extends NotebookCellAction {
    constructor() {
        super({
            id: NOTEBOOK_CURSOR_PAGEUP_SELECT_COMMAND_ID,
            title: localize('cursorPageUpSelect', "Cell Cursor Page Up Select"),
            keybinding: [
                {
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.has(InputFocusedContextKey), EditorContextKeys.editorTextFocus, NOTEBOOK_OUTPUT_FOCUSED.negate()),
                    primary: 1024 /* KeyMod.Shift */ | 11 /* KeyCode.PageUp */,
                    weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
                }
            ]
        });
    }
    async runWithContext(accessor, context) {
        EditorExtensionsRegistry.getEditorCommand('cursorPageUpSelect').runCommand(accessor, { pageSize: getPageSize(context) });
    }
});
registerAction2(class extends NotebookCellAction {
    constructor() {
        super({
            id: NOTEBOOK_CURSOR_PAGEDOWN_COMMAND_ID,
            title: localize('cursorPageDown', "Cell Cursor Page Down"),
            keybinding: [
                {
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.has(InputFocusedContextKey), EditorContextKeys.editorTextFocus),
                    primary: 12 /* KeyCode.PageDown */,
                    weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
                }
            ]
        });
    }
    async runWithContext(accessor, context) {
        EditorExtensionsRegistry.getEditorCommand('cursorPageDown').runCommand(accessor, { pageSize: getPageSize(context) });
    }
});
registerAction2(class extends NotebookCellAction {
    constructor() {
        super({
            id: NOTEBOOK_CURSOR_PAGEDOWN_SELECT_COMMAND_ID,
            title: localize('cursorPageDownSelect', "Cell Cursor Page Down Select"),
            keybinding: [
                {
                    when: ContextKeyExpr.and(NOTEBOOK_EDITOR_FOCUSED, ContextKeyExpr.has(InputFocusedContextKey), EditorContextKeys.editorTextFocus, NOTEBOOK_OUTPUT_FOCUSED.negate()),
                    primary: 1024 /* KeyMod.Shift */ | 12 /* KeyCode.PageDown */,
                    weight: NOTEBOOK_EDITOR_WIDGET_ACTION_WEIGHT
                }
            ]
        });
    }
    async runWithContext(accessor, context) {
        EditorExtensionsRegistry.getEditorCommand('cursorPageDownSelect').runCommand(accessor, { pageSize: getPageSize(context) });
    }
});
function getPageSize(context) {
    const editor = context.notebookEditor;
    const layoutInfo = editor.getViewModel().layoutInfo;
    const lineHeight = layoutInfo?.fontInfo.lineHeight || 17;
    return Math.max(1, Math.floor((layoutInfo?.height || 0) / lineHeight) - 2);
}
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
    id: 'notebook',
    order: 100,
    type: 'object',
    'properties': {
        'notebook.navigation.allowNavigateToSurroundingCells': {
            type: 'boolean',
            default: true,
            markdownDescription: localize('notebook.navigation.allowNavigateToSurroundingCells', "When enabled cursor can navigate to the next/previous cell when the current cursor in the cell editor is at the first/last line.")
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJyb3cuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svYnJvd3Nlci9jb250cmliL25hdmlnYXRpb24vYXJyb3cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBR2pFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDL0QsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDdEgsT0FBTyxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNoRyxPQUFPLEVBQUUsVUFBVSxJQUFJLHVCQUF1QixFQUEwQixNQUFNLDBFQUEwRSxDQUFDO0FBQ3pKLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUM1RixPQUFPLEVBQUUsc0JBQXNCLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUd2SCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDbEYsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDOUYsT0FBTyxFQUFzRCxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsb0NBQW9DLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNyTSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDekQsT0FBTyxFQUFFLFFBQVEsRUFBRSwrQkFBK0IsRUFBRSxvQ0FBb0MsRUFBRSxNQUFN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