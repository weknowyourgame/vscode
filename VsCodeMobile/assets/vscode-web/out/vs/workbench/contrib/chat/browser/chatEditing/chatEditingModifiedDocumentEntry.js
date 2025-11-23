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
import { MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { autorun, transaction } from '../../../../../base/common/observable.js';
import { assertType } from '../../../../../base/common/types.js';
import { getCodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { TextEdit as EditorTextEdit } from '../../../../../editor/common/core/edits/textEdit.js';
import { StringText } from '../../../../../editor/common/core/text/abstractText.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { SingleModelEditStackElement } from '../../../../../editor/common/model/editStack.js';
import { createTextBufferFactoryFromSnapshot } from '../../../../../editor/common/model/textModel.js';
import { IEditorWorkerService } from '../../../../../editor/common/services/editorWorker.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IMarkerService } from '../../../../../platform/markers/common/markers.js';
import { IUndoRedoService } from '../../../../../platform/undoRedo/common/undoRedo.js';
import { IFilesConfigurationService } from '../../../../services/filesConfiguration/common/filesConfigurationService.js';
import { ITextFileService, isTextFileEditorModel, stringToSnapshot } from '../../../../services/textfile/common/textfiles.js';
import { IAiEditTelemetryService } from '../../../editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js';
import { IChatService } from '../../common/chatService.js';
import { ChatEditingCodeEditorIntegration } from './chatEditingCodeEditorIntegration.js';
import { AbstractChatEditingModifiedFileEntry } from './chatEditingModifiedFileEntry.js';
import { ChatEditingTextModelChangeService } from './chatEditingTextModelChangeService.js';
import { ChatEditingSnapshotTextModelContentProvider, ChatEditingTextModelContentProvider } from './chatEditingTextModelContentProviders.js';
let ChatEditingModifiedDocumentEntry = class ChatEditingModifiedDocumentEntry extends AbstractChatEditingModifiedFileEntry {
    get changesCount() {
        return this._textModelChangeService.diffInfo.map(diff => diff.changes.length);
    }
    get diffInfo() {
        return this._textModelChangeService.diffInfo;
    }
    get linesAdded() {
        return this._textModelChangeService.diffInfo.map(diff => {
            let added = 0;
            for (const c of diff.changes) {
                added += Math.max(0, c.modified.endLineNumberExclusive - c.modified.startLineNumber);
            }
            return added;
        });
    }
    get linesRemoved() {
        return this._textModelChangeService.diffInfo.map(diff => {
            let removed = 0;
            for (const c of diff.changes) {
                removed += Math.max(0, c.original.endLineNumberExclusive - c.original.startLineNumber);
            }
            return removed;
        });
    }
    constructor(resourceRef, _multiDiffEntryDelegate, telemetryInfo, kind, initialContent, markerService, modelService, textModelService, languageService, configService, fileConfigService, chatService, _textFileService, fileService, undoRedoService, instantiationService, aiEditTelemetryService, _editorWorkerService) {
        super(resourceRef.object.textEditorModel.uri, telemetryInfo, kind, configService, fileConfigService, chatService, fileService, undoRedoService, instantiationService, aiEditTelemetryService);
        this._multiDiffEntryDelegate = _multiDiffEntryDelegate;
        this._textFileService = _textFileService;
        this._editorWorkerService = _editorWorkerService;
        this._docFileEditorModel = this._register(resourceRef).object;
        this.modifiedModel = resourceRef.object.textEditorModel;
        this.originalURI = ChatEditingTextModelContentProvider.getFileURI(telemetryInfo.sessionResource, this.entryId, this.modifiedURI.path);
        this.initialContent = initialContent ?? this.modifiedModel.getValue();
        const docSnapshot = this.originalModel = this._register(modelService.createModel(createTextBufferFactoryFromSnapshot(initialContent !== undefined ? stringToSnapshot(initialContent) : this.modifiedModel.createSnapshot()), languageService.createById(this.modifiedModel.getLanguageId()), this.originalURI, false));
        this._textModelChangeService = this._register(instantiationService.createInstance(ChatEditingTextModelChangeService, this.originalModel, this.modifiedModel, this._stateObs, () => this._isExternalEditInProgress));
        this._register(this._textModelChangeService.onDidAcceptOrRejectAllHunks(action => {
            this._stateObs.set(action, undefined);
            this._notifySessionAction(action === 1 /* ModifiedFileEntryState.Accepted */ ? 'accepted' : 'rejected');
        }));
        this._register(this._textModelChangeService.onDidAcceptOrRejectLines(action => {
            this._notifyAction({
                kind: 'chatEditingHunkAction',
                uri: this.modifiedURI,
                outcome: action.state,
                languageId: this.modifiedModel.getLanguageId(),
                ...action
            });
        }));
        // Create a reference to this model to avoid it being disposed from under our nose
        (async () => {
            const reference = await textModelService.createModelReference(docSnapshot.uri);
            if (this._store.isDisposed) {
                reference.dispose();
                return;
            }
            this._register(reference);
        })();
        this._register(this._textModelChangeService.onDidUserEditModel(() => {
            this._userEditScheduler.schedule();
            const didResetToOriginalContent = this.modifiedModel.getValue() === this.initialContent;
            if (this._stateObs.get() === 0 /* ModifiedFileEntryState.Modified */ && didResetToOriginalContent) {
                this._stateObs.set(2 /* ModifiedFileEntryState.Rejected */, undefined);
            }
        }));
        const resourceFilter = this._register(new MutableDisposable());
        this._register(autorun(r => {
            const inProgress = this._waitsForLastEdits.read(r);
            if (inProgress) {
                const res = this._lastModifyingResponseObs.read(r);
                const req = res && res.session.getRequests().find(value => value.id === res.requestId);
                resourceFilter.value = markerService.installResourceFilter(this.modifiedURI, req?.message.text || localize('default', "Chat Edits"));
            }
            else {
                resourceFilter.clear();
            }
        }));
    }
    equalsSnapshot(snapshot) {
        return !!snapshot &&
            this.modifiedURI.toString() === snapshot.resource.toString() &&
            this.modifiedModel.getLanguageId() === snapshot.languageId &&
            this.originalModel.getValue() === snapshot.original &&
            this.modifiedModel.getValue() === snapshot.current &&
            this.state.get() === snapshot.state;
    }
    createSnapshot(chatSessionResource, requestId, undoStop) {
        return {
            resource: this.modifiedURI,
            languageId: this.modifiedModel.getLanguageId(),
            snapshotUri: ChatEditingSnapshotTextModelContentProvider.getSnapshotFileURI(chatSessionResource, requestId, undoStop, this.modifiedURI.path),
            original: this.originalModel.getValue(),
            current: this.modifiedModel.getValue(),
            state: this.state.get(),
            telemetryInfo: this._telemetryInfo
        };
    }
    getCurrentContents() {
        return this.modifiedModel.getValue();
    }
    hasModificationAt(location) {
        return location.uri.toString() === this.modifiedModel.uri.toString() && this._textModelChangeService.hasHunkAt(location.range);
    }
    async restoreFromSnapshot(snapshot, restoreToDisk = true) {
        this._stateObs.set(snapshot.state, undefined);
        await this._textModelChangeService.resetDocumentValues(snapshot.original, restoreToDisk ? snapshot.current : undefined);
    }
    async resetToInitialContent() {
        await this._textModelChangeService.resetDocumentValues(undefined, this.initialContent);
    }
    async _areOriginalAndModifiedIdentical() {
        return this._textModelChangeService.areOriginalAndModifiedIdentical();
    }
    _resetEditsState(tx) {
        super._resetEditsState(tx);
        this._textModelChangeService.clearCurrentEditLineDecoration();
    }
    _createUndoRedoElement(response) {
        const request = response.session.getRequests().find(req => req.id === response.requestId);
        const label = request?.message.text ? localize('chatEditing1', "Chat Edit: '{0}'", request.message.text) : localize('chatEditing2', "Chat Edit");
        return new SingleModelEditStackElement(label, 'chat.edit', this.modifiedModel, null);
    }
    async acceptAgentEdits(resource, textEdits, isLastEdits, responseModel) {
        const result = await this._textModelChangeService.acceptAgentEdits(resource, textEdits, isLastEdits, responseModel);
        transaction((tx) => {
            this._waitsForLastEdits.set(!isLastEdits, tx);
            this._stateObs.set(0 /* ModifiedFileEntryState.Modified */, tx);
            if (!isLastEdits) {
                this._rewriteRatioObs.set(result.rewriteRatio, tx);
            }
            else {
                this._resetEditsState(tx);
                this._rewriteRatioObs.set(1, tx);
            }
        });
        if (isLastEdits && this._shouldAutoSave()) {
            await this._textFileService.save(this.modifiedModel.uri, {
                reason: 2 /* SaveReason.AUTO */,
                skipSaveParticipants: true,
            });
        }
    }
    async _doAccept() {
        this._textModelChangeService.keep();
        this._multiDiffEntryDelegate.collapse(undefined);
        const config = this._fileConfigService.getAutoSaveConfiguration(this.modifiedURI);
        if (!config.autoSave || !this._textFileService.isDirty(this.modifiedURI)) {
            // SAVE after accept for manual-savers, for auto-savers
            // trigger explict save to get save participants going
            try {
                await this._textFileService.save(this.modifiedURI, {
                    reason: 1 /* SaveReason.EXPLICIT */,
                    force: true,
                    ignoreErrorHandler: true
                });
            }
            catch {
                // ignored
            }
        }
    }
    async _doReject() {
        if (this.createdInRequestId === this._telemetryInfo.requestId) {
            if (isTextFileEditorModel(this._docFileEditorModel)) {
                await this._docFileEditorModel.revert({ soft: true });
                await this._fileService.del(this.modifiedURI).catch(err => {
                    // don't block if file is already deleted
                });
            }
            this._onDidDelete.fire();
        }
        else {
            this._textModelChangeService.undo();
            if (this._textModelChangeService.allEditsAreFromUs && isTextFileEditorModel(this._docFileEditorModel) && this._shouldAutoSave()) {
                // save the file after discarding so that the dirty indicator goes away
                // and so that an intermediate saved state gets reverted
                await this._docFileEditorModel.save({ reason: 1 /* SaveReason.EXPLICIT */, skipSaveParticipants: true });
            }
            this._multiDiffEntryDelegate.collapse(undefined);
        }
    }
    _createEditorIntegration(editor) {
        const codeEditor = getCodeEditor(editor.getControl());
        assertType(codeEditor);
        const diffInfo = this._textModelChangeService.diffInfo;
        return this._instantiationService.createInstance(ChatEditingCodeEditorIntegration, this, codeEditor, diffInfo, false);
    }
    _shouldAutoSave() {
        return this.modifiedURI.scheme !== Schemas.untitled;
    }
    async computeEditsFromSnapshots(beforeSnapshot, afterSnapshot) {
        const stringEdit = await this._editorWorkerService.computeStringEditFromDiff(beforeSnapshot, afterSnapshot, { maxComputationTimeMs: 5000 }, 'advanced');
        const editorTextEdit = EditorTextEdit.fromStringEdit(stringEdit, new StringText(beforeSnapshot));
        return editorTextEdit.replacements.slice();
    }
    async save() {
        if (this.modifiedModel.uri.scheme === Schemas.untitled) {
            return;
        }
        // Save the current model state to disk if dirty
        if (this._textFileService.isDirty(this.modifiedModel.uri)) {
            await this._textFileService.save(this.modifiedModel.uri, {
                reason: 1 /* SaveReason.EXPLICIT */,
                skipSaveParticipants: true
            });
        }
    }
    async revertToDisk() {
        if (this.modifiedModel.uri.scheme === Schemas.untitled) {
            return;
        }
        // Revert to reload from disk, ensuring in-memory model matches disk
        const fileModel = this._textFileService.files.get(this.modifiedModel.uri);
        if (fileModel && !fileModel.isDisposed()) {
            await fileModel.revert({ soft: false });
        }
    }
};
ChatEditingModifiedDocumentEntry = __decorate([
    __param(5, IMarkerService),
    __param(6, IModelService),
    __param(7, ITextModelService),
    __param(8, ILanguageService),
    __param(9, IConfigurationService),
    __param(10, IFilesConfigurationService),
    __param(11, IChatService),
    __param(12, ITextFileService),
    __param(13, IFileService),
    __param(14, IUndoRedoService),
    __param(15, IInstantiationService),
    __param(16, IAiEditTelemetryService),
    __param(17, IEditorWorkerService)
], ChatEditingModifiedDocumentEntry);
export { ChatEditingModifiedDocumentEntry };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdNb2RpZmllZERvY3VtZW50RW50cnkuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRFZGl0aW5nL2NoYXRFZGl0aW5nTW9kaWZpZWREb2N1bWVudEVudHJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBYyxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEVBQWdCLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUM5RixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFakUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQy9FLE9BQU8sRUFBRSxRQUFRLElBQUksY0FBYyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDakcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBRXBGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBRXRGLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxtQ0FBbUMsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMvRSxPQUFPLEVBQTRCLGlCQUFpQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDdkgsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxx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