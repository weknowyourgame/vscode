var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from '../../../../../base/common/event.js';
import { DisposableMap, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { autorun, constObservable, derived, observableFromEvent } from '../../../../../base/common/observable.js';
import { localize } from '../../../../../nls.js';
import { RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { EditorResourceAccessor, SideBySideEditor } from '../../../../common/editor.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IInlineChatSessionService } from '../../../inlineChat/browser/inlineChatSessionService.js';
import { IChatEditingService } from '../../common/chatEditingService.js';
import { IChatService } from '../../common/chatService.js';
export const ctxIsGlobalEditingSession = new RawContextKey('chatEdits.isGlobalEditingSession', undefined, localize('chat.ctxEditSessionIsGlobal', "The current editor is part of the global edit session"));
export const ctxHasEditorModification = new RawContextKey('chatEdits.hasEditorModifications', undefined, localize('chat.hasEditorModifications', "The current editor contains chat modifications"));
export const ctxIsCurrentlyBeingModified = new RawContextKey('chatEdits.isCurrentlyBeingModified', undefined, localize('chat.isCurrentlyBeingModified', "The current editor is currently being modified"));
export const ctxReviewModeEnabled = new RawContextKey('chatEdits.isReviewModeEnabled', true, localize('chat.ctxReviewModeEnabled', "Review mode for chat changes is enabled"));
export const ctxHasRequestInProgress = new RawContextKey('chatEdits.isRequestInProgress', false, localize('chat.ctxHasRequestInProgress', "The current editor shows a file from an edit session which is still in progress"));
export const ctxRequestCount = new RawContextKey('chatEdits.requestCount', 0, localize('chatEdits.requestCount', "The number of turns the editing session in this editor has"));
export const ctxCursorInChangeRange = new RawContextKey('chatEdits.cursorInChangeRange', false, localize('chat.ctxCursorInChangeRange', "The cursor is inside a change range made by chat editing."));
let ChatEditingEditorContextKeys = class ChatEditingEditorContextKeys {
    static { this.ID = 'chat.edits.editorContextKeys'; }
    constructor(instaService, editorGroupsService) {
        this._store = new DisposableStore();
        const editorGroupCtx = this._store.add(new DisposableMap());
        const editorGroups = observableFromEvent(this, Event.any(editorGroupsService.onDidAddGroup, editorGroupsService.onDidRemoveGroup), () => editorGroupsService.groups);
        this._store.add(autorun(r => {
            const toDispose = new Set(editorGroupCtx.keys());
            for (const group of editorGroups.read(r)) {
                toDispose.delete(group);
                if (editorGroupCtx.has(group)) {
                    continue;
                }
                editorGroupCtx.set(group, instaService.createInstance(ContextKeyGroup, group));
            }
            for (const item of toDispose) {
                editorGroupCtx.deleteAndDispose(item);
            }
        }));
    }
    dispose() {
        this._store.dispose();
    }
};
ChatEditingEditorContextKeys = __decorate([
    __param(0, IInstantiationService),
    __param(1, IEditorGroupsService)
], ChatEditingEditorContextKeys);
export { ChatEditingEditorContextKeys };
let ContextKeyGroup = class ContextKeyGroup {
    constructor(group, inlineChatSessionService, chatEditingService, chatService) {
        this._store = new DisposableStore();
        this._ctxIsGlobalEditingSession = ctxIsGlobalEditingSession.bindTo(group.scopedContextKeyService);
        this._ctxHasEditorModification = ctxHasEditorModification.bindTo(group.scopedContextKeyService);
        this._ctxIsCurrentlyBeingModified = ctxIsCurrentlyBeingModified.bindTo(group.scopedContextKeyService);
        this._ctxHasRequestInProgress = ctxHasRequestInProgress.bindTo(group.scopedContextKeyService);
        this._ctxReviewModeEnabled = ctxReviewModeEnabled.bindTo(group.scopedContextKeyService);
        this._ctxRequestCount = ctxRequestCount.bindTo(group.scopedContextKeyService);
        const editorObs = observableFromEvent(this, group.onDidModelChange, () => group.activeEditor);
        const tupleObs = derived(r => {
            const editor = editorObs.read(r);
            const uri = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
            if (!uri) {
                this._reset();
                return;
            }
            return new ObservableEditorSession(uri, chatEditingService, inlineChatSessionService).value.read(r);
        });
        this._store.add(autorun(r => {
            const tuple = tupleObs.read(r);
            if (!tuple) {
                this._reset();
                return;
            }
            const { session, entry } = tuple;
            const chatModel = chatService.getSession(session.chatSessionResource);
            this._ctxHasEditorModification.set(entry?.state.read(r) === 0 /* ModifiedFileEntryState.Modified */);
            this._ctxIsGlobalEditingSession.set(session.isGlobalEditingSession);
            this._ctxReviewModeEnabled.set(entry ? entry.reviewMode.read(r) : false);
            this._ctxHasRequestInProgress.set(chatModel?.requestInProgress.read(r) ?? false);
            this._ctxIsCurrentlyBeingModified.set(!!entry?.isCurrentlyBeingModifiedBy.read(r));
            // number of requests
            const requestCount = chatModel
                ? observableFromEvent(this, chatModel.onDidChange, () => chatModel.getRequests().length)
                : constObservable(0);
            this._ctxRequestCount.set(requestCount.read(r));
        }));
    }
    _reset() {
        this._ctxIsGlobalEditingSession.reset();
        this._ctxHasEditorModification.reset();
        this._ctxHasRequestInProgress.reset();
        this._ctxReviewModeEnabled.reset();
        this._ctxRequestCount.reset();
    }
    dispose() {
        this._store.dispose();
        this._reset();
    }
};
ContextKeyGroup = __decorate([
    __param(1, IInlineChatSessionService),
    __param(2, IChatEditingService),
    __param(3, IChatService)
], ContextKeyGroup);
let ObservableEditorSession = class ObservableEditorSession {
    constructor(uri, chatEditingService, inlineChatService) {
        const inlineSessionObs = observableFromEvent(this, inlineChatService.onDidChangeSessions, () => inlineChatService.getSession2(uri));
        const sessionObs = chatEditingService.editingSessionsObs.map((value, r) => {
            for (const session of value) {
                const entry = session.readEntry(uri, r);
                if (entry) {
                    return { session, entry, isInlineChat: false };
                }
            }
            return undefined;
        });
        this.value = derived(r => {
            const inlineSession = inlineSessionObs.read(r);
            if (inlineSession) {
                return { session: inlineSession.editingSession, entry: inlineSession.editingSession.readEntry(uri, r), isInlineChat: true };
            }
            return sessionObs.read(r);
        });
    }
};
ObservableEditorSession = __decorate([
    __param(1, IChatEditingService),
    __param(2, IInlineChatSessionService)
], ObservableEditorSession);
export { ObservableEditorSession };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdFZGl0b3JDb250ZXh0S2V5cy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdFZGl0b3JDb250ZXh0S2V5cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQTs7O2dHQUdnRztBQUNoRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDNUQsT0FBTyxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN6RixPQUFPLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQWUsbUJBQW1CLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUUvSCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFlLGFBQWEsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBRXRHLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3hGLE9BQU8sRUFBZ0Isb0JBQW9CLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUMvRyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUNwRyxPQUFPLEVBQUUsbUJBQW1CLEVBQW1FLE1BQU0sb0NBQW9DLENBQUM7QUFDMUksT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBRTNELE1BQU0sQ0FBQyxNQUFNLHlCQUF5QixHQUFHLElBQUksYUFBYSxDQUFVLGtDQUFrQyxFQUFFLFNBQVMsRUFBRSxRQUFRLENBQUMsNkJBQTZCLEVBQUUsdURBQXVELENBQUMsQ0FBQyxDQUFDO0FBQ3JOLE1B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