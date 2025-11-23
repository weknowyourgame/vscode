/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { KeyChord } from '../../../../base/common/keyCodes.js';
import { isEqual } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { ITextResourceConfigurationService } from '../../../../editor/common/services/textResourceConfiguration.js';
import { localize, localize2 } from '../../../../nls.js';
import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { KeybindingsRegistry } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { TextDiffEditor } from './textDiffEditor.js';
import { ActiveCompareEditorCanSwapContext, TextCompareEditorActiveContext, TextCompareEditorVisibleContext } from '../../../common/contextkeys.js';
import { DiffEditorInput } from '../../../common/editor/diffEditorInput.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { isDiffEditor } from '../../../../editor/browser/editorBrowser.js';
export const TOGGLE_DIFF_SIDE_BY_SIDE = 'toggle.diff.renderSideBySide';
export const GOTO_NEXT_CHANGE = 'workbench.action.compareEditor.nextChange';
export const GOTO_PREVIOUS_CHANGE = 'workbench.action.compareEditor.previousChange';
export const DIFF_FOCUS_PRIMARY_SIDE = 'workbench.action.compareEditor.focusPrimarySide';
export const DIFF_FOCUS_SECONDARY_SIDE = 'workbench.action.compareEditor.focusSecondarySide';
export const DIFF_FOCUS_OTHER_SIDE = 'workbench.action.compareEditor.focusOtherSide';
export const DIFF_OPEN_SIDE = 'workbench.action.compareEditor.openSide';
export const TOGGLE_DIFF_IGNORE_TRIM_WHITESPACE = 'toggle.diff.ignoreTrimWhitespace';
export const DIFF_SWAP_SIDES = 'workbench.action.compareEditor.swapSides';
export function registerDiffEditorCommands() {
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: DIFF_OPEN_SIDE,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: EditorContextKeys.inDiffEditor,
        primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 1024 /* KeyMod.Shift */ | 45 /* KeyCode.KeyO */),
        handler: async (accessor) => {
            const editorService = accessor.get(IEditorService);
            const editorGroupsService = accessor.get(IEditorGroupsService);
            const activeEditor = editorService.activeEditor;
            const activeTextEditorControl = editorService.activeTextEditorControl;
            if (!isDiffEditor(activeTextEditorControl) || !(activeEditor instanceof DiffEditorInput)) {
                return;
            }
            let editor;
            const originalEditor = activeTextEditorControl.getOriginalEditor();
            if (originalEditor.hasTextFocus()) {
                editor = activeEditor.original;
            }
            else {
                editor = activeEditor.modified;
            }
            return editorGroupsService.activeGroup.openEditor(editor);
        }
    });
    MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
        command: {
            id: DIFF_OPEN_SIDE,
            title: localize2('compare.openSide', 'Open Active Diff Side'),
        }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: GOTO_NEXT_CHANGE,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: TextCompareEditorVisibleContext,
        primary: 512 /* KeyMod.Alt */ | 63 /* KeyCode.F5 */,
        handler: (accessor, ...args) => navigateInDiffEditor(accessor, args, true)
    });
    MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
        command: {
            id: GOTO_NEXT_CHANGE,
            title: localize2('compare.nextChange', 'Go to Next Change'),
        }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: GOTO_PREVIOUS_CHANGE,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: TextCompareEditorVisibleContext,
        primary: 512 /* KeyMod.Alt */ | 1024 /* KeyMod.Shift */ | 63 /* KeyCode.F5 */,
        handler: (accessor, ...args) => navigateInDiffEditor(accessor, args, false)
    });
    MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
        command: {
            id: GOTO_PREVIOUS_CHANGE,
            title: localize2('compare.previousChange', 'Go to Previous Change'),
        }
    });
    function getActiveTextDiffEditor(accessor, args) {
        const editorService = accessor.get(IEditorService);
        const resource = args.length > 0 && args[0] instanceof URI ? args[0] : undefined;
        for (const editor of [editorService.activeEditorPane, ...editorService.visibleEditorPanes]) {
            if (editor instanceof TextDiffEditor && (!resource || editor.input instanceof DiffEditorInput && isEqual(editor.input.primary.resource, resource))) {
                return editor;
            }
        }
        return undefined;
    }
    function navigateInDiffEditor(accessor, args, next) {
        const activeTextDiffEditor = getActiveTextDiffEditor(accessor, args);
        if (activeTextDiffEditor) {
            activeTextDiffEditor.getControl()?.goToDiff(next ? 'next' : 'previous');
        }
    }
    let FocusTextDiffEditorMode;
    (function (FocusTextDiffEditorMode) {
        FocusTextDiffEditorMode[FocusTextDiffEditorMode["Original"] = 0] = "Original";
        FocusTextDiffEditorMode[FocusTextDiffEditorMode["Modified"] = 1] = "Modified";
        FocusTextDiffEditorMode[FocusTextDiffEditorMode["Toggle"] = 2] = "Toggle";
    })(FocusTextDiffEditorMode || (FocusTextDiffEditorMode = {}));
    function focusInDiffEditor(accessor, args, mode) {
        const activeTextDiffEditor = getActiveTextDiffEditor(accessor, args);
        if (activeTextDiffEditor) {
            switch (mode) {
                case FocusTextDiffEditorMode.Original:
                    activeTextDiffEditor.getControl()?.getOriginalEditor().focus();
                    break;
                case FocusTextDiffEditorMode.Modified:
                    activeTextDiffEditor.getControl()?.getModifiedEditor().focus();
                    break;
                case FocusTextDiffEditorMode.Toggle:
                    if (activeTextDiffEditor.getControl()?.getModifiedEditor().hasWidgetFocus()) {
                        return focusInDiffEditor(accessor, args, FocusTextDiffEditorMode.Original);
                    }
                    else {
                        return focusInDiffEditor(accessor, args, FocusTextDiffEditorMode.Modified);
                    }
            }
        }
    }
    function toggleDiffSideBySide(accessor, args) {
        const configService = accessor.get(ITextResourceConfigurationService);
        const activeTextDiffEditor = getActiveTextDiffEditor(accessor, args);
        const m = activeTextDiffEditor?.getControl()?.getModifiedEditor()?.getModel();
        if (!m) {
            return;
        }
        const key = 'diffEditor.renderSideBySide';
        const val = configService.getValue(m.uri, key);
        configService.updateValue(m.uri, key, !val);
    }
    function toggleDiffIgnoreTrimWhitespace(accessor, args) {
        const configService = accessor.get(ITextResourceConfigurationService);
        const activeTextDiffEditor = getActiveTextDiffEditor(accessor, args);
        const m = activeTextDiffEditor?.getControl()?.getModifiedEditor()?.getModel();
        if (!m) {
            return;
        }
        const key = 'diffEditor.ignoreTrimWhitespace';
        const val = configService.getValue(m.uri, key);
        configService.updateValue(m.uri, key, !val);
    }
    async function swapDiffSides(accessor, args) {
        const editorService = accessor.get(IEditorService);
        const diffEditor = getActiveTextDiffEditor(accessor, args);
        const activeGroup = diffEditor?.group;
        const diffInput = diffEditor?.input;
        if (!diffEditor || typeof activeGroup === 'undefined' || !(diffInput instanceof DiffEditorInput) || !diffInput.modified.resource) {
            return;
        }
        const untypedDiffInput = diffInput.toUntyped({ preserveViewState: activeGroup.id, preserveResource: true });
        if (!untypedDiffInput) {
            return;
        }
        // Since we are about to replace the diff editor, make
        // sure to first open the modified side if it is not
        // yet opened. This ensures that the swapping is not
        // bringing up a confirmation dialog to save.
        if (diffInput.modified.isModified() && editorService.findEditors({ resource: diffInput.modified.resource, typeId: diffInput.modified.typeId, editorId: diffInput.modified.editorId }).length === 0) {
            const editorToOpen = { ...untypedDiffInput.modified };
            if (!editorToOpen.options) {
                editorToOpen.options = {};
            }
            editorToOpen.options.pinned = true;
            editorToOpen.options.inactive = true;
            await editorService.openEditor(editorToOpen, activeGroup);
        }
        // Replace the input with the swapped variant
        await editorService.replaceEditors([
            {
                editor: diffInput,
                replacement: {
                    ...untypedDiffInput,
                    original: untypedDiffInput.modified,
                    modified: untypedDiffInput.original,
                    options: {
                        ...untypedDiffInput.options,
                        pinned: true
                    }
                }
            }
        ], activeGroup);
    }
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: TOGGLE_DIFF_SIDE_BY_SIDE,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: undefined,
        primary: undefined,
        handler: (accessor, ...args) => toggleDiffSideBySide(accessor, args)
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: DIFF_FOCUS_PRIMARY_SIDE,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: undefined,
        primary: undefined,
        handler: (accessor, ...args) => focusInDiffEditor(accessor, args, FocusTextDiffEditorMode.Modified)
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: DIFF_FOCUS_SECONDARY_SIDE,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: undefined,
        primary: undefined,
        handler: (accessor, ...args) => focusInDiffEditor(accessor, args, FocusTextDiffEditorMode.Original)
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: DIFF_FOCUS_OTHER_SIDE,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: undefined,
        primary: undefined,
        handler: (accessor, ...args) => focusInDiffEditor(accessor, args, FocusTextDiffEditorMode.Toggle)
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: TOGGLE_DIFF_IGNORE_TRIM_WHITESPACE,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: undefined,
        primary: undefined,
        handler: (accessor, ...args) => toggleDiffIgnoreTrimWhitespace(accessor, args)
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: DIFF_SWAP_SIDES,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: undefined,
        primary: undefined,
        handler: (accessor, ...args) => swapDiffSides(accessor, args)
    });
    MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
        command: {
            id: TOGGLE_DIFF_SIDE_BY_SIDE,
            title: localize2('toggleInlineView', "Toggle Inline View"),
            category: localize('compare', "Compare")
        },
        when: TextCompareEditorActiveContext
    });
    MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
        command: {
            id: DIFF_SWAP_SIDES,
            title: localize2('swapDiffSides', "Swap Left and Right Editor Side"),
            category: localize('compare', "Compare")
        },
        when: ContextKeyExpr.and(TextCompareEditorActiveContext, ActiveCompareEditorCanSwapContext)
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlmZkVkaXRvckNvbW1hbmRzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9icm93c2VyL3BhcnRzL2VkaXRvci9kaWZmRWRpdG9yQ29tbWFuZHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBbUIsTUFBTSxxQ0FBcUMsQ0FBQztBQUNoRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDL0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxpQ0FBaUMsRUFBRSxNQUFNLGlFQUFpRSxDQUFDO0FBQ3BILE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUN0RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFdEYsT0FBTyxFQUFFLG1CQUFtQixFQUFvQixNQUFNLCtEQUErRCxDQUFDO0FBQ3RILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsaUNBQWlDLEVBQUUsOEJBQThCLEVBQUUsK0JBQStCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNwSixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDNUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBRWxGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztB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