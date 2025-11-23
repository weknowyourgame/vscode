/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../base/common/codicons.js';
import { EditorContextKeys } from '../../../../../editor/common/editorContextKeys.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IListService } from '../../../../../platform/list/browser/listService.js';
import { resolveCommandsContext } from '../../../../browser/parts/editor/editorCommandsContext.js';
import { ActiveEditorContext } from '../../../../common/contextkeys.js';
import { EditorResourceAccessor, SideBySideEditor, TEXT_DIFF_EDITOR_ID } from '../../../../common/editor.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { ACTIVE_GROUP, IEditorService } from '../../../../services/editor/common/editorService.js';
import { MultiDiffEditorInput } from '../../../multiDiffEditor/browser/multiDiffEditorInput.js';
import { NOTEBOOK_CELL_LIST_FOCUSED, NOTEBOOK_EDITOR_FOCUSED } from '../../../notebook/common/notebookContextKeys.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME, IChatEditingService } from '../../common/chatEditingService.js';
import { LocalChatSessionUri } from '../../common/chatUri.js';
import { CHAT_CATEGORY } from '../actions/chatActions.js';
import { ctxCursorInChangeRange, ctxHasEditorModification, ctxIsCurrentlyBeingModified, ctxIsGlobalEditingSession, ctxReviewModeEnabled } from './chatEditingEditorContextKeys.js';
class ChatEditingEditorAction extends Action2 {
    constructor(desc) {
        super({
            category: CHAT_CATEGORY,
            ...desc
        });
    }
    async run(accessor, ...args) {
        const instaService = accessor.get(IInstantiationService);
        const chatEditingService = accessor.get(IChatEditingService);
        const editorService = accessor.get(IEditorService);
        const uri = EditorResourceAccessor.getOriginalUri(editorService.activeEditorPane?.input, { supportSideBySide: SideBySideEditor.PRIMARY });
        if (!uri || !editorService.activeEditorPane) {
            return;
        }
        const session = chatEditingService.editingSessionsObs.get()
            .find(candidate => candidate.getEntry(uri));
        if (!session) {
            return;
        }
        const entry = session.getEntry(uri);
        const ctrl = entry.getEditorIntegration(editorService.activeEditorPane);
        return instaService.invokeFunction(this.runChatEditingCommand.bind(this), session, entry, ctrl, ...args);
    }
}
class NavigateAction extends ChatEditingEditorAction {
    constructor(next) {
        super({
            id: next
                ? 'chatEditor.action.navigateNext'
                : 'chatEditor.action.navigatePrevious',
            title: next
                ? localize2('next', 'Go to Next Chat Edit')
                : localize2('prev', 'Go to Previous Chat Edit'),
            icon: next ? Codicon.arrowDown : Codicon.arrowUp,
            precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ctxHasEditorModification),
            keybinding: {
                primary: next
                    ? 512 /* KeyMod.Alt */ | 63 /* KeyCode.F5 */
                    : 512 /* KeyMod.Alt */ | 1024 /* KeyMod.Shift */ | 63 /* KeyCode.F5 */,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                when: ContextKeyExpr.and(ctxHasEditorModification, ContextKeyExpr.or(EditorContextKeys.focus, NOTEBOOK_CELL_LIST_FOCUSED)),
            },
            f1: true,
            menu: {
                id: MenuId.ChatEditingEditorContent,
                group: 'navigate',
                order: !next ? 2 : 3,
                when: ContextKeyExpr.and(ctxReviewModeEnabled, ctxHasEditorModification)
            }
        });
        this.next = next;
    }
    async runChatEditingCommand(accessor, session, entry, ctrl) {
        const instaService = accessor.get(IInstantiationService);
        const done = this.next
            ? ctrl.next(false)
            : ctrl.previous(false);
        if (done) {
            return;
        }
        const didOpenNext = await instaService.invokeFunction(openNextOrPreviousChange, session, entry, this.next);
        if (didOpenNext) {
            return;
        }
        //ELSE: wrap inside the same file
        this.next
            ? ctrl.next(true)
            : ctrl.previous(true);
    }
}
async function openNextOrPreviousChange(accessor, session, entry, next) {
    const editorService = accessor.get(IEditorService);
    const entries = session.entries.get();
    let idx = entries.indexOf(entry);
    let newEntry;
    while (true) {
        idx = (idx + (next ? 1 : -1) + entries.length) % entries.length;
        newEntry = entries[idx];
        if (newEntry.state.get() === 0 /* ModifiedFileEntryState.Modified */) {
            break;
        }
        else if (newEntry === entry) {
            return false;
        }
    }
    const pane = await editorService.openEditor({
        resource: newEntry.modifiedURI,
        options: {
            revealIfOpened: false,
            revealIfVisible: false,
        }
    }, ACTIVE_GROUP);
    if (!pane) {
        return false;
    }
    if (session.entries.get().includes(newEntry)) {
        // make sure newEntry is still valid!
        newEntry.getEditorIntegration(pane).reveal(next);
    }
    return true;
}
class KeepOrUndoAction extends ChatEditingEditorAction {
    constructor(id, _keep) {
        super({
            id,
            title: _keep
                ? localize2('accept', 'Keep Chat Edits')
                : localize2('discard', 'Undo Chat Edits'),
            shortTitle: _keep
                ? localize2('accept2', 'Keep')
                : localize2('discard2', 'Undo'),
            tooltip: _keep
                ? localize2('accept3', 'Keep Chat Edits in this File')
                : localize2('discard3', 'Undo Chat Edits in this File'),
            precondition: ContextKeyExpr.and(ctxIsGlobalEditingSession, ctxHasEditorModification, ctxIsCurrentlyBeingModified.negate()),
            icon: _keep
                ? Codicon.check
                : Codicon.discard,
            f1: true,
            keybinding: {
                when: ContextKeyExpr.or(EditorContextKeys.focus, NOTEBOOK_EDITOR_FOCUSED),
                weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 10, // win over new-window-action
                primary: _keep
                    ? 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 55 /* KeyCode.KeyY */
                    : 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 44 /* KeyCode.KeyN */,
            },
            menu: {
                id: MenuId.ChatEditingEditorContent,
                group: 'a_resolve',
                order: _keep ? 0 : 1,
                when: !_keep ? ctxReviewModeEnabled : undefined
            }
        });
        this._keep = _keep;
    }
    async runChatEditingCommand(accessor, session, entry, _integration) {
        const instaService = accessor.get(IInstantiationService);
        if (this._keep) {
            session.accept(entry.modifiedURI);
        }
        else {
            session.reject(entry.modifiedURI);
        }
        await instaService.invokeFunction(openNextOrPreviousChange, session, entry, true);
    }
}
export class AcceptAction extends KeepOrUndoAction {
    static { this.ID = 'chatEditor.action.accept'; }
    constructor() {
        super(AcceptAction.ID, true);
    }
}
export class RejectAction extends KeepOrUndoAction {
    static { this.ID = 'chatEditor.action.reject'; }
    constructor() {
        super(RejectAction.ID, false);
    }
}
const acceptHunkId = 'chatEditor.action.acceptHunk';
const undoHunkId = 'chatEditor.action.undoHunk';
class AcceptRejectHunkAction extends ChatEditingEditorAction {
    constructor(_accept) {
        super({
            id: _accept ? acceptHunkId : undoHunkId,
            title: _accept ? localize2('acceptHunk', 'Keep this Change') : localize2('undo', 'Undo this Change'),
            shortTitle: _accept ? localize2('acceptHunkShort', 'Keep') : localize2('undoShort', 'Undo'),
            precondition: ContextKeyExpr.and(ctxHasEditorModification, ctxIsCurrentlyBeingModified.negate()),
            f1: true,
            keybinding: {
                when: ContextKeyExpr.and(ctxCursorInChangeRange, ContextKeyExpr.or(EditorContextKeys.focus, NOTEBOOK_CELL_LIST_FOCUSED)),
                weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
                primary: _accept
                    ? 2048 /* KeyMod.CtrlCmd */ | 55 /* KeyCode.KeyY */
                    : 2048 /* KeyMod.CtrlCmd */ | 44 /* KeyCode.KeyN */
            },
            menu: {
                id: MenuId.ChatEditingEditorHunk,
                order: 1
            }
        });
        this._accept = _accept;
    }
    async runChatEditingCommand(accessor, session, entry, ctrl, ...args) {
        const instaService = accessor.get(IInstantiationService);
        if (this._accept) {
            await ctrl.acceptNearestChange(args[0]);
        }
        else {
            await ctrl.rejectNearestChange(args[0]);
        }
        if (entry.changesCount.get() === 0) {
            // no more changes, move to next file
            await instaService.invokeFunction(openNextOrPreviousChange, session, entry, true);
        }
    }
}
export class AcceptHunkAction extends AcceptRejectHunkAction {
    static { this.ID = acceptHunkId; }
    constructor() {
        super(true);
    }
}
export class RejectHunkAction extends AcceptRejectHunkAction {
    static { this.ID = undoHunkId; }
    constructor() {
        super(false);
    }
}
class ToggleDiffAction extends ChatEditingEditorAction {
    constructor() {
        super({
            id: 'chatEditor.action.toggleDiff',
            title: localize2('diff', 'Toggle Diff Editor for Chat Edits'),
            category: CHAT_CATEGORY,
            toggled: {
                condition: ContextKeyExpr.or(EditorContextKeys.inDiffEditor, ActiveEditorContext.isEqualTo(TEXT_DIFF_EDITOR_ID)),
                icon: Codicon.goToFile,
            },
            precondition: ContextKeyExpr.and(ctxHasEditorModification),
            icon: Codicon.diffSingle,
            keybinding: {
                when: EditorContextKeys.focus,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 512 /* KeyMod.Alt */ | 1024 /* KeyMod.Shift */ | 65 /* KeyCode.F7 */,
            },
            menu: [{
                    id: MenuId.ChatEditingEditorHunk,
                    order: 10
                }, {
                    id: MenuId.ChatEditingEditorContent,
                    group: 'a_resolve',
                    order: 2,
                    when: ContextKeyExpr.and(ctxReviewModeEnabled)
                }]
        });
    }
    runChatEditingCommand(_accessor, _session, _entry, integration, ...args) {
        integration.toggleDiff(args[0]);
    }
}
class ToggleAccessibleDiffViewAction extends ChatEditingEditorAction {
    constructor() {
        super({
            id: 'chatEditor.action.showAccessibleDiffView',
            title: localize2('accessibleDiff', 'Show Accessible Diff View for Chat Edits'),
            f1: true,
            precondition: ContextKeyExpr.and(ctxHasEditorModification, ctxIsCurrentlyBeingModified.negate()),
            keybinding: {
                when: EditorContextKeys.focus,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 65 /* KeyCode.F7 */,
            }
        });
    }
    runChatEditingCommand(_accessor, _session, _entry, integration) {
        integration.enableAccessibleDiffView();
    }
}
export class ReviewChangesAction extends ChatEditingEditorAction {
    constructor() {
        super({
            id: 'chatEditor.action.reviewChanges',
            title: localize2('review', "Review"),
            precondition: ContextKeyExpr.and(ctxHasEditorModification, ctxIsCurrentlyBeingModified.negate()),
            menu: [{
                    id: MenuId.ChatEditingEditorContent,
                    group: 'a_resolve',
                    order: 3,
                    when: ContextKeyExpr.and(ctxReviewModeEnabled.negate(), ctxIsCurrentlyBeingModified.negate()),
                }]
        });
    }
    runChatEditingCommand(_accessor, _session, entry, _integration, ..._args) {
        entry.enableReviewModeUntilSettled();
    }
}
export class AcceptAllEditsAction extends ChatEditingEditorAction {
    static { this.ID = 'chatEditor.action.acceptAllEdits'; }
    constructor() {
        super({
            id: AcceptAllEditsAction.ID,
            title: localize2('acceptAllEdits', 'Keep All Chat Edits'),
            tooltip: localize2('acceptAllEditsTooltip', 'Keep All Chat Edits in this Session'),
            precondition: ContextKeyExpr.and(ctxHasEditorModification, ctxIsCurrentlyBeingModified.negate()),
            icon: Codicon.checkAll,
            f1: true,
            keybinding: {
                when: ContextKeyExpr.or(EditorContextKeys.focus, NOTEBOOK_EDITOR_FOCUSED),
                weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 10,
                primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 55 /* KeyCode.KeyY */,
            },
        });
    }
    async runChatEditingCommand(_accessor, session, _entry, _integration, ..._args) {
        await session.accept();
    }
}
// --- multi file diff
class MultiDiffAcceptDiscardAction extends Action2 {
    constructor(accept) {
        super({
            id: accept ? 'chatEditing.multidiff.acceptAllFiles' : 'chatEditing.multidiff.discardAllFiles',
            title: accept ? localize('accept4', 'Keep All Edits') : localize('discard4', 'Undo All Edits'),
            icon: accept ? Codicon.check : Codicon.discard,
            menu: {
                when: ContextKeyExpr.equals('resourceScheme', CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME),
                id: MenuId.EditorTitle,
                order: accept ? 0 : 1,
                group: 'navigation',
            },
        });
        this.accept = accept;
    }
    async run(accessor, ...args) {
        const chatEditingService = accessor.get(IChatEditingService);
        const editorService = accessor.get(IEditorService);
        const editorGroupsService = accessor.get(IEditorGroupsService);
        const listService = accessor.get(IListService);
        const resolvedContext = resolveCommandsContext(args, editorService, editorGroupsService, listService);
        const groupContext = resolvedContext.groupedEditors[0];
        if (!groupContext) {
            return;
        }
        const editor = groupContext.editors[0];
        if (!(editor instanceof MultiDiffEditorInput) || !editor.resource) {
            return;
        }
        const session = chatEditingService.getEditingSession(LocalChatSessionUri.forSession(editor.resource.authority));
        if (this.accept) {
            await session?.accept();
        }
        else {
            await session?.reject();
        }
    }
}
export function registerChatEditorActions() {
    registerAction2(class NextAction extends NavigateAction {
        constructor() { super(true); }
    });
    registerAction2(class PrevAction extends NavigateAction {
        constructor() { super(false); }
    });
    registerAction2(ReviewChangesAction);
    registerAction2(AcceptAction);
    registerAction2(RejectAction);
    registerAction2(AcceptAllEditsAction);
    registerAction2(AcceptHunkAction);
    registerAction2(RejectHunkAction);
    registerAction2(ToggleDiffAction);
    registerAction2(ToggleAccessibleDiffViewAction);
    registerAction2(class extends MultiDiffAcceptDiscardAction {
        constructor() { super(true); }
    });
    registerAction2(class extends MultiDiffAcceptDiscardAction {
        constructor() { super(false); }
    });
    MenuRegistry.appendMenuItem(MenuId.ChatEditingEditorContent, {
        command: {
            id: navigationBearingFakeActionId,
            title: localize('label', "Navigation Status"),
            precondition: ContextKeyExpr.false(),
        },
        group: 'navigate',
        order: -1,
        when: ContextKeyExpr.and(ctxReviewModeEnabled, ctxHasEditorModification),
    });
}
export const navigationBearingFakeActionId = 'chatEditor.navigation.bearings';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdFZGl0b3JBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0RWRpdGluZy9jaGF0RWRpdGluZ0VkaXRvckFjdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFDaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBR2pFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDNUQsT0FBTyxFQUFFLE9BQU8sRUFBbUIsTUFBTSxFQUFFLFlBQVksRUFBRSxlQUFlLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNwSSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDekYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFFdEcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxnQkFBZ0IsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQzdHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxZQUFZLEVBQUUsY0FBYyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDbkcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDaEcsT0FBTyxFQUFFLDBCQUEwQixFQUFFLHVC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