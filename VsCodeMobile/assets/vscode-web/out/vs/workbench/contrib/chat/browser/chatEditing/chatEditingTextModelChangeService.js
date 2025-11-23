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
var ChatEditingTextModelChangeService_1;
import { addDisposableListener, getWindow } from '../../../../../base/browser/dom.js';
import { assert } from '../../../../../base/common/assert.js';
import { DeferredPromise, RunOnceScheduler, timeout } from '../../../../../base/common/async.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun, observableValue } from '../../../../../base/common/observable.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { themeColorFromId } from '../../../../../base/common/themables.js';
import { assertType } from '../../../../../base/common/types.js';
import { EditOperation } from '../../../../../editor/common/core/editOperation.js';
import { StringEdit } from '../../../../../editor/common/core/edits/stringEdit.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { LineRange } from '../../../../../editor/common/core/ranges/lineRange.js';
import { nullDocumentDiff } from '../../../../../editor/common/diff/documentDiffProvider.js';
import { TextEdit, VersionedExtensionId } from '../../../../../editor/common/languages.js';
import { OverviewRulerLane } from '../../../../../editor/common/model.js';
import { ModelDecorationOptions } from '../../../../../editor/common/model/textModel.js';
import { offsetEditFromContentChanges, offsetEditFromLineRangeMapping, offsetEditToEditOperations } from '../../../../../editor/common/model/textModelStringEdit.js';
import { IEditorWorkerService } from '../../../../../editor/common/services/editorWorker.js';
import { EditSources } from '../../../../../editor/common/textModelEditSource.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { editorSelectionBackground } from '../../../../../platform/theme/common/colorRegistry.js';
import { ChatAgentLocation } from '../../common/constants.js';
import { pendingRewriteMinimap } from './chatEditingModifiedFileEntry.js';
let ChatEditingTextModelChangeService = class ChatEditingTextModelChangeService extends Disposable {
    static { ChatEditingTextModelChangeService_1 = this; }
    static { this._lastEditDecorationOptions = ModelDecorationOptions.register({
        isWholeLine: true,
        description: 'chat-last-edit',
        className: 'chat-editing-last-edit-line',
        marginClassName: 'chat-editing-last-edit',
        overviewRuler: {
            position: OverviewRulerLane.Full,
            color: themeColorFromId(editorSelectionBackground)
        },
    }); }
    static { this._pendingEditDecorationOptions = ModelDecorationOptions.register({
        isWholeLine: true,
        description: 'chat-pending-edit',
        className: 'chat-editing-pending-edit',
        minimap: {
            position: 1 /* MinimapPosition.Inline */,
            color: themeColorFromId(pendingRewriteMinimap)
        }
    }); }
    static { this._atomicEditDecorationOptions = ModelDecorationOptions.register({
        isWholeLine: true,
        description: 'chat-atomic-edit',
        className: 'chat-editing-atomic-edit',
        minimap: {
            position: 1 /* MinimapPosition.Inline */,
            color: themeColorFromId(pendingRewriteMinimap)
        }
    }); }
    get isEditFromUs() {
        return this._isEditFromUs;
    }
    get allEditsAreFromUs() {
        return this._allEditsAreFromUs;
    }
    get diffInfo() {
        return this._diffInfo.map(value => {
            return {
                ...value,
                originalModel: this.originalModel,
                modifiedModel: this.modifiedModel,
                keep: changes => this._keepHunk(changes),
                undo: changes => this._undoHunk(changes)
            };
        });
    }
    notifyHunkAction(state, affectedLines) {
        if (affectedLines.lineCount > 0) {
            this._didAcceptOrRejectLines.fire({ state, ...affectedLines });
        }
    }
    constructor(originalModel, modifiedModel, state, isExternalEditInProgress, _editorWorkerService, _accessibilitySignalService) {
        super();
        this.originalModel = originalModel;
        this.modifiedModel = modifiedModel;
        this.state = state;
        this._editorWorkerService = _editorWorkerService;
        this._accessibilitySignalService = _accessibilitySignalService;
        this._isEditFromUs = false;
        this._allEditsAreFromUs = true;
        this._diffOperationIds = 0;
        this._diffInfo = observableValue(this, nullDocumentDiff);
        this._editDecorationClear = this._register(new RunOnceScheduler(() => { this._editDecorations = this.modifiedModel.deltaDecorations(this._editDecorations, []); }, 500));
        this._editDecorations = [];
        this._didAcceptOrRejectAllHunks = this._register(new Emitter());
        this.onDidAcceptOrRejectAllHunks = this._didAcceptOrRejectAllHunks.event;
        this._didAcceptOrRejectLines = this._register(new Emitter());
        this.onDidAcceptOrRejectLines = this._didAcceptOrRejectLines.event;
        this._didUserEditModelFired = false;
        this._didUserEditModel = this._register(new Emitter());
        this.onDidUserEditModel = this._didUserEditModel.event;
        this._originalToModifiedEdit = StringEdit.empty;
        this.lineChangeCount = 0;
        this.linesAdded = 0;
        this.linesRemoved = 0;
        this._isExternalEditInProgress = isExternalEditInProgress;
        this._register(this.modifiedModel.onDidChangeContent(e => {
            this._mirrorEdits(e);
        }));
        this._register(toDisposable(() => {
            this.clearCurrentEditLineDecoration();
        }));
        this._register(autorun(r => this.updateLineChangeCount(this._diffInfo.read(r))));
        if (!originalModel.equalsTextBuffer(modifiedModel.getTextBuffer())) {
            this._updateDiffInfoSeq();
        }
    }
    updateLineChangeCount(diff) {
        this.lineChangeCount = 0;
        this.linesAdded = 0;
        this.linesRemoved = 0;
        for (const change of diff.changes) {
            const modifiedRange = change.modified.endLineNumberExclusive - change.modified.startLineNumber;
            this.linesAdded += Math.max(0, modifiedRange);
            const originalRange = change.original.endLineNumberExclusive - change.original.startLineNumber;
            this.linesRemoved += Math.max(0, originalRange);
            this.lineChangeCount += Math.max(modifiedRange, originalRange);
        }
    }
    clearCurrentEditLineDecoration() {
        if (!this.modifiedModel.isDisposed()) {
            this._editDecorations = this.modifiedModel.deltaDecorations(this._editDecorations, []);
        }
    }
    async areOriginalAndModifiedIdentical() {
        const diff = await this._diffOperation;
        return diff ? diff.identical : false;
    }
    async acceptAgentEdits(resource, textEdits, isLastEdits, responseModel) {
        assertType(textEdits.every(TextEdit.isTextEdit), 'INVALID args, can only handle text edits');
        assert(isEqual(resource, this.modifiedModel.uri), ' INVALID args, can only edit THIS document');
        const isAtomicEdits = textEdits.length > 0 && isLastEdits;
        let maxLineNumber = 0;
        let rewriteRatio = 0;
        const source = this._createEditSource(responseModel);
        if (isAtomicEdits) {
            // EDIT and DONE
            const minimalEdits = await this._editorWorkerService.computeMoreMinimalEdits(this.modifiedModel.uri, textEdits) ?? textEdits;
            const ops = minimalEdits.map(TextEdit.asEditOperation);
            const undoEdits = this._applyEdits(ops, source);
            if (undoEdits.length > 0) {
                let range;
                for (let i = 0; i < undoEdits.length; i++) {
                    const op = undoEdits[i];
                    if (!range) {
                        range = Range.lift(op.range);
                    }
                    else {
                        range = Range.plusRange(range, op.range);
                    }
                }
                if (range) {
                    const defer = new DeferredPromise();
                    const listener = addDisposableListener(getWindow(undefined), 'animationend', e => {
                        if (e.animationName === 'kf-chat-editing-atomic-edit') { // CHECK with chat.css
                            defer.complete();
                            listener.dispose();
                        }
                    });
                    this._editDecorations = this.modifiedModel.deltaDecorations(this._editDecorations, [{
                            options: ChatEditingTextModelChangeService_1._atomicEditDecorationOptions,
                            range
                        }]);
                    await Promise.any([defer.p, timeout(500)]); // wait for animation to finish but also time-cap it
                    listener.dispose();
                }
            }
        }
        else {
            // EDIT a bit, then DONE
            const ops = textEdits.map(TextEdit.asEditOperation);
            const undoEdits = this._applyEdits(ops, source);
            maxLineNumber = undoEdits.reduce((max, op) => Math.max(max, op.range.startLineNumber), 0);
            rewriteRatio = Math.min(1, maxLineNumber / this.modifiedModel.getLineCount());
            const newDecorations = [
                // decorate pending edit (region)
                {
                    options: ChatEditingTextModelChangeService_1._pendingEditDecorationOptions,
                    range: new Range(maxLineNumber + 1, 1, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
                }
            ];
            if (maxLineNumber > 0) {
                // decorate last edit
                newDecorations.push({
                    options: ChatEditingTextModelChangeService_1._lastEditDecorationOptions,
                    range: new Range(maxLineNumber, 1, maxLineNumber, Number.MAX_SAFE_INTEGER)
                });
            }
            this._editDecorations = this.modifiedModel.deltaDecorations(this._editDecorations, newDecorations);
        }
        if (isLastEdits) {
            this._updateDiffInfoSeq();
            this._editDecorationClear.schedule();
        }
        return { rewriteRatio, maxLineNumber };
    }
    _createEditSource(responseModel) {
        if (!responseModel) {
            return EditSources.unknown({ name: 'editSessionUndoRedo' });
        }
        const sessionId = responseModel.session.sessionId;
        const request = responseModel.session.getRequests().at(-1);
        const languageId = this.modifiedModel.getLanguageId();
        const agent = responseModel.agent;
        const extensionId = VersionedExtensionId.tryCreate(agent?.extensionId.value, agent?.extensionVersion);
        if (responseModel.request?.locationData?.type === ChatAgentLocation.EditorInline) {
            return EditSources.inlineChatApplyEdit({
                modelId: request?.modelId,
                requestId: request?.id,
                sessionId,
                languageId,
                extensionId,
            });
        }
        return EditSources.chatApplyEdits({
            modelId: request?.modelId,
            requestId: request?.id,
            sessionId,
            languageId,
            mode: request?.modeInfo?.modeId,
            extensionId,
            codeBlockSuggestionId: request?.modeInfo?.applyCodeBlockSuggestionId,
        });
    }
    _applyEdits(edits, source) {
        if (edits.length === 0) {
            return [];
        }
        try {
            this._isEditFromUs = true;
            // make the actual edit
            let result = [];
            this.modifiedModel.pushEditOperations(null, edits, (undoEdits) => {
                result = undoEdits;
                return null;
            }, undefined, source);
            return result;
        }
        finally {
            this._isEditFromUs = false;
        }
    }
    /**
     * Keeps the current modified document as the final contents.
     */
    keep() {
        this.notifyHunkAction('accepted', { linesAdded: this.linesAdded, linesRemoved: this.linesRemoved, lineCount: this.lineChangeCount, hasRemainingEdits: false });
        this.originalModel.setValue(this.modifiedModel.createSnapshot());
        this._reset();
    }
    /**
     * Undoes the current modified document as the final contents.
     */
    undo() {
        this.notifyHunkAction('rejected', { linesAdded: this.linesAdded, linesRemoved: this.linesRemoved, lineCount: this.lineChangeCount, hasRemainingEdits: false });
        this.modifiedModel.pushStackElement();
        this._applyEdits([(EditOperation.replace(this.modifiedModel.getFullModelRange(), this.originalModel.getValue()))], EditSources.chatUndoEdits());
        this.modifiedModel.pushStackElement();
        this._reset();
    }
    _reset() {
        this._originalToModifiedEdit = StringEdit.empty;
        this._diffInfo.set(nullDocumentDiff, undefined);
        this._didUserEditModelFired = false;
    }
    async resetDocumentValues(newOriginal, newModified) {
        let didChange = false;
        if (newOriginal !== undefined) {
            this.originalModel.setValue(newOriginal);
            didChange = true;
        }
        if (newModified !== undefined && this.modifiedModel.getValue() !== newModified) {
            // NOTE that this isn't done via `setValue` so that the undo stack is preserved
            this.modifiedModel.pushStackElement();
            this._applyEdits([(EditOperation.replace(this.modifiedModel.getFullModelRange(), newModified))], EditSources.chatReset());
            this.modifiedModel.pushStackElement();
            didChange = true;
        }
        if (didChange) {
            await this._updateDiffInfoSeq();
        }
    }
    _mirrorEdits(event) {
        const edit = offsetEditFromContentChanges(event.changes);
        const isExternalEdit = this._isExternalEditInProgress?.();
        if (this._isEditFromUs || isExternalEdit) {
            const e_sum = this._originalToModifiedEdit;
            const e_ai = edit;
            this._originalToModifiedEdit = e_sum.compose(e_ai);
            if (isExternalEdit) {
                this._updateDiffInfoSeq();
            }
        }
        else {
            //           e_ai
            //   d0 ---------------> s0
            //   |                   |
            //   |                   |
            //   | e_user_r          | e_user
            //   |                   |
            //   |                   |
            //   v       e_ai_r      v
            ///  d1 ---------------> s1
            //
            // d0 - document snapshot
            // s0 - document
            // e_ai - ai edits
            // e_user - user edits
            //
            const e_ai = this._originalToModifiedEdit;
            const e_user = edit;
            const e_user_r = e_user.tryRebase(e_ai.inverse(this.originalModel.getValue()));
            if (e_user_r === undefined) {
                // user edits overlaps/conflicts with AI edits
                this._originalToModifiedEdit = e_ai.compose(e_user);
            }
            else {
                const edits = offsetEditToEditOperations(e_user_r, this.originalModel);
                this.originalModel.applyEdits(edits);
                this._originalToModifiedEdit = e_ai.rebaseSkipConflicting(e_user_r);
            }
            this._allEditsAreFromUs = false;
            this._updateDiffInfoSeq();
            if (!this._didUserEditModelFired) {
                this._didUserEditModelFired = true;
                this._didUserEditModel.fire();
            }
        }
    }
    async _keepHunk(change) {
        if (!this._diffInfo.get().changes.includes(change)) {
            // diffInfo should have model version ids and check them (instead of the caller doing that)
            return false;
        }
        const edits = [];
        for (const edit of change.innerChanges ?? []) {
            const newText = this.modifiedModel.getValueInRange(edit.modifiedRange);
            edits.push(EditOperation.replace(edit.originalRange, newText));
        }
        this.originalModel.pushEditOperations(null, edits, _ => null);
        await this._updateDiffInfoSeq('accepted');
        if (this._diffInfo.get().identical) {
            this._didAcceptOrRejectAllHunks.fire(1 /* ModifiedFileEntryState.Accepted */);
        }
        this._accessibilitySignalService.playSignal(AccessibilitySignal.editsKept, { allowManyInParallel: true });
        return true;
    }
    async _undoHunk(change) {
        if (!this._diffInfo.get().changes.includes(change)) {
            return false;
        }
        const edits = [];
        for (const edit of change.innerChanges ?? []) {
            const newText = this.originalModel.getValueInRange(edit.originalRange);
            edits.push(EditOperation.replace(edit.modifiedRange, newText));
        }
        this.modifiedModel.pushEditOperations(null, edits, _ => null);
        await this._updateDiffInfoSeq('rejected');
        if (this._diffInfo.get().identical) {
            this._didAcceptOrRejectAllHunks.fire(2 /* ModifiedFileEntryState.Rejected */);
        }
        this._accessibilitySignalService.playSignal(AccessibilitySignal.editsUndone, { allowManyInParallel: true });
        return true;
    }
    async _updateDiffInfoSeq(notifyAction = undefined) {
        const myDiffOperationId = ++this._diffOperationIds;
        await Promise.resolve(this._diffOperation);
        const previousCount = this.lineChangeCount;
        const previousAdded = this.linesAdded;
        const previousRemoved = this.linesRemoved;
        if (this._diffOperationIds === myDiffOperationId) {
            const thisDiffOperation = this._updateDiffInfo();
            this._diffOperation = thisDiffOperation;
            await thisDiffOperation;
            if (notifyAction) {
                const affectedLines = {
                    linesAdded: previousAdded - this.linesAdded,
                    linesRemoved: previousRemoved - this.linesRemoved,
                    lineCount: previousCount - this.lineChangeCount,
                    hasRemainingEdits: this.lineChangeCount > 0
                };
                this.notifyHunkAction(notifyAction, affectedLines);
            }
        }
    }
    hasHunkAt(range) {
        // return true if the range overlaps a diff range
        return this._diffInfo.get().changes.some(c => c.modified.intersectsStrict(LineRange.fromRangeInclusive(range)));
    }
    async _updateDiffInfo() {
        if (this.originalModel.isDisposed() || this.modifiedModel.isDisposed() || this._store.isDisposed) {
            return undefined;
        }
        if (this.state.get() !== 0 /* ModifiedFileEntryState.Modified */) {
            this._diffInfo.set(nullDocumentDiff, undefined);
            this._originalToModifiedEdit = StringEdit.empty;
            return nullDocumentDiff;
        }
        const docVersionNow = this.modifiedModel.getVersionId();
        const snapshotVersionNow = this.originalModel.getVersionId();
        const diff = await this._editorWorkerService.computeDiff(this.originalModel.uri, this.modifiedModel.uri, {
            ignoreTrimWhitespace: false, // NEVER ignore whitespace so that undo/accept edits are correct and so that all changes (1 of 2) are spelled out
            computeMoves: false,
            maxComputationTimeMs: 3000
        }, 'advanced');
        if (this.originalModel.isDisposed() || this.modifiedModel.isDisposed() || this._store.isDisposed) {
            return undefined;
        }
        // only update the diff if the documents didn't change in the meantime
        if (this.modifiedModel.getVersionId() === docVersionNow && this.originalModel.getVersionId() === snapshotVersionNow) {
            const diff2 = diff ?? nullDocumentDiff;
            this._diffInfo.set(diff2, undefined);
            this._originalToModifiedEdit = offsetEditFromLineRangeMapping(this.originalModel, this.modifiedModel, diff2.changes);
            return diff2;
        }
        return undefined;
    }
};
ChatEditingTextModelChangeService = ChatEditingTextModelChangeService_1 = __decorate([
    __param(4, IEditorWorkerService),
    __param(5, IAccessibilitySignalService)
], ChatEditingTextModelChangeService);
export { ChatEditingTextModelChangeService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdUZXh0TW9kZWxDaGFuZ2VTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0RWRpdGluZy9jaGF0RWRpdGluZ1RleHRNb2RlbENoYW5nZVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxTQUFTLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN0RixPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDOUQsT0FBTyxFQUFFLGVBQWUsRUFBRSxnQkFBZ0IsRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNqRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNuRixPQUFPLEVBQUUsT0FBTyxFQUFlLGVBQWUsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFakUsT0FBTyxFQUFFLGFBQWEsRUFBd0IsTUFBTSxvREFBb0QsQ0FBQztBQUN6RyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDbkYsT0FBTyxFQUFVLEtBQUssRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNsRixPQUFPLEVBQWlCLGdCQUFnQixFQUFFLE1BQU0s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