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
var StoredFileWorkingCopy_1;
import { localize } from '../../../../nls.js';
import { Event, Emitter } from '../../../../base/common/event.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { ETAG_DISABLED, IFileService, NotModifiedSinceFileOperationError } from '../../../../platform/files/common/files.js';
import { IWorkingCopyService } from './workingCopyService.js';
import { raceCancellation, TaskSequentializer, timeout } from '../../../../base/common/async.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { IWorkingCopyFileService } from './workingCopyFileService.js';
import { IFilesConfigurationService } from '../../filesConfiguration/common/filesConfigurationService.js';
import { IWorkingCopyBackupService } from './workingCopyBackup.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { hash } from '../../../../base/common/hash.js';
import { isErrorWithActions, toErrorMessage } from '../../../../base/common/errorMessage.js';
import { toAction } from '../../../../base/common/actions.js';
import { isWindows } from '../../../../base/common/platform.js';
import { IWorkingCopyEditorService } from './workingCopyEditorService.js';
import { IEditorService } from '../../editor/common/editorService.js';
import { IElevatedFileService } from '../../files/common/elevatedFileService.js';
import { ResourceWorkingCopy } from './resourceWorkingCopy.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { isCancellationError } from '../../../../base/common/errors.js';
/**
 * States the stored file working copy can be in.
 */
export var StoredFileWorkingCopyState;
(function (StoredFileWorkingCopyState) {
    /**
     * A stored file working copy is saved.
     */
    StoredFileWorkingCopyState[StoredFileWorkingCopyState["SAVED"] = 0] = "SAVED";
    /**
     * A stored file working copy is dirty.
     */
    StoredFileWorkingCopyState[StoredFileWorkingCopyState["DIRTY"] = 1] = "DIRTY";
    /**
     * A stored file working copy is currently being saved but
     * this operation has not completed yet.
     */
    StoredFileWorkingCopyState[StoredFileWorkingCopyState["PENDING_SAVE"] = 2] = "PENDING_SAVE";
    /**
     * A stored file working copy is in conflict mode when changes
     * cannot be saved because the underlying file has changed.
     * Stored file working copies in conflict mode are always dirty.
     */
    StoredFileWorkingCopyState[StoredFileWorkingCopyState["CONFLICT"] = 3] = "CONFLICT";
    /**
     * A stored file working copy is in orphan state when the underlying
     * file has been deleted.
     */
    StoredFileWorkingCopyState[StoredFileWorkingCopyState["ORPHAN"] = 4] = "ORPHAN";
    /**
     * Any error that happens during a save that is not causing
     * the `StoredFileWorkingCopyState.CONFLICT` state.
     * Stored file working copies in error mode are always dirty.
     */
    StoredFileWorkingCopyState[StoredFileWorkingCopyState["ERROR"] = 5] = "ERROR";
})(StoredFileWorkingCopyState || (StoredFileWorkingCopyState = {}));
export function isStoredFileWorkingCopySaveEvent(e) {
    const candidate = e;
    return !!candidate.stat;
}
let StoredFileWorkingCopy = class StoredFileWorkingCopy extends ResourceWorkingCopy {
    static { StoredFileWorkingCopy_1 = this; }
    get model() { return this._model; }
    //#endregion
    constructor(typeId, resource, name, modelFactory, externalResolver, fileService, logService, workingCopyFileService, filesConfigurationService, workingCopyBackupService, workingCopyService, notificationService, workingCopyEditorService, editorService, elevatedFileService, progressService) {
        super(resource, fileService);
        this.typeId = typeId;
        this.name = name;
        this.modelFactory = modelFactory;
        this.externalResolver = externalResolver;
        this.logService = logService;
        this.workingCopyFileService = workingCopyFileService;
        this.filesConfigurationService = filesConfigurationService;
        this.workingCopyBackupService = workingCopyBackupService;
        this.notificationService = notificationService;
        this.workingCopyEditorService = workingCopyEditorService;
        this.editorService = editorService;
        this.elevatedFileService = elevatedFileService;
        this.progressService = progressService;
        this.capabilities = 0 /* WorkingCopyCapabilities.None */;
        this._model = undefined;
        //#region events
        this._onDidChangeContent = this._register(new Emitter());
        this.onDidChangeContent = this._onDidChangeContent.event;
        this._onDidResolve = this._register(new Emitter());
        this.onDidResolve = this._onDidResolve.event;
        this._onDidChangeDirty = this._register(new Emitter());
        this.onDidChangeDirty = this._onDidChangeDirty.event;
        this._onDidSaveError = this._register(new Emitter());
        this.onDidSaveError = this._onDidSaveError.event;
        this._onDidSave = this._register(new Emitter());
        this.onDidSave = this._onDidSave.event;
        this._onDidRevert = this._register(new Emitter());
        this.onDidRevert = this._onDidRevert.event;
        this._onDidChangeReadonly = this._register(new Emitter());
        this.onDidChangeReadonly = this._onDidChangeReadonly.event;
        //#region Dirty
        this.dirty = false;
        this.ignoreDirtyOnModelContentChange = false;
        //#endregion
        //#region Save
        this.versionId = 0;
        this.lastContentChangeFromUndoRedo = undefined;
        this.saveSequentializer = new TaskSequentializer();
        this.ignoreSaveFromSaveParticipants = false;
        //#endregion
        //#region State
        this.inConflictMode = false;
        this.inErrorMode = false;
        // Make known to working copy service
        this._register(workingCopyService.registerWorkingCopy(this));
        this.registerListeners();
    }
    registerListeners() {
        this._register(this.filesConfigurationService.onDidChangeReadonly(() => this._onDidChangeReadonly.fire()));
    }
    isDirty() {
        return this.dirty;
    }
    markModified() {
        this.setDirty(true); // stored file working copy tracks modified via dirty
    }
    setDirty(dirty) {
        if (!this.isResolved()) {
            return; // only resolved working copies can be marked dirty
        }
        // Track dirty state and version id
        const wasDirty = this.dirty;
        this.doSetDirty(dirty);
        // Emit as Event if dirty changed
        if (dirty !== wasDirty) {
            this._onDidChangeDirty.fire();
        }
    }
    doSetDirty(dirty) {
        const wasDirty = this.dirty;
        const wasInConflictMode = this.inConflictMode;
        const wasInErrorMode = this.inErrorMode;
        const oldSavedVersionId = this.savedVersionId;
        if (!dirty) {
            this.dirty = false;
            this.inConflictMode = false;
            this.inErrorMode = false;
            // we remember the models alternate version id to remember when the version
            // of the model matches with the saved version on disk. we need to keep this
            // in order to find out if the model changed back to a saved version (e.g.
            // when undoing long enough to reach to a version that is saved and then to
            // clear the dirty flag)
            if (this.isResolved()) {
                this.savedVersionId = this.model.versionId;
            }
        }
        else {
            this.dirty = true;
        }
        // Return function to revert this call
        return () => {
            this.dirty = wasDirty;
            this.inConflictMode = wasInConflictMode;
            this.inErrorMode = wasInErrorMode;
            this.savedVersionId = oldSavedVersionId;
        };
    }
    isResolved() {
        return !!this.model;
    }
    async resolve(options) {
        this.trace('resolve() - enter');
        // Return early if we are disposed
        if (this.isDisposed()) {
            this.trace('resolve() - exit - without resolving because file working copy is disposed');
            return;
        }
        // Unless there are explicit contents provided, it is important that we do not
        // resolve a working copy that is dirty or is in the process of saving to prevent
        // data loss.
        if (!options?.contents && (this.dirty || this.saveSequentializer.isRunning())) {
            this.trace('resolve() - exit - without resolving because file working copy is dirty or being saved');
            return;
        }
        return this.doResolve(options);
    }
    async doResolve(options) {
        // First check if we have contents to use for the working copy
        if (options?.contents) {
            return this.resolveFromBuffer(options.contents);
        }
        // Second, check if we have a backup to resolve from (only for new working copies)
        const isNew = !this.isResolved();
        if (isNew) {
            const resolvedFromBackup = await this.resolveFromBackup();
            if (resolvedFromBackup) {
                return;
            }
        }
        // Finally, resolve from file resource
        return this.resolveFromFile(options);
    }
    async resolveFromBuffer(buffer) {
        this.trace('resolveFromBuffer()');
        // Try to resolve metdata from disk
        let mtime;
        let ctime;
        let size;
        let etag;
        try {
            const metadata = await this.fileService.stat(this.resource);
            mtime = metadata.mtime;
            ctime = metadata.ctime;
            size = metadata.size;
            etag = metadata.etag;
            // Clear orphaned state when resolving was successful
            this.setOrphaned(false);
        }
        catch (error) {
            // Put some fallback values in error case
            mtime = Date.now();
            ctime = Date.now();
            size = 0;
            etag = ETAG_DISABLED;
            // Apply orphaned state based on error code
            this.setOrphaned(error.fileOperationResult === 1 /* FileOperationResult.FILE_NOT_FOUND */);
        }
        // Resolve with buffer
        return this.resolveFromContent({
            resource: this.resource,
            name: this.name,
            mtime,
            ctime,
            size,
            etag,
            value: buffer,
            readonly: false,
            locked: false
        }, true /* dirty (resolved from buffer) */);
    }
    async resolveFromBackup() {
        // Resolve backup if any
        const backup = await this.workingCopyBackupService.resolve(this);
        // Abort if someone else managed to resolve the working copy by now
        const isNew = !this.isResolved();
        if (!isNew) {
            this.trace('resolveFromBackup() - exit - withoutresolving because previously new file working copy got created meanwhile');
            return true; // imply that resolving has happened in another operation
        }
        // Try to resolve from backup if we have any
        if (backup) {
            await this.doResolveFromBackup(backup);
            return true;
        }
        // Otherwise signal back that resolving did not happen
        return false;
    }
    async doResolveFromBackup(backup) {
        this.trace('doResolveFromBackup()');
        // Resolve with backup
        await this.resolveFromContent({
            resource: this.resource,
            name: this.name,
            mtime: backup.meta ? backup.meta.mtime : Date.now(),
            ctime: backup.meta ? backup.meta.ctime : Date.now(),
            size: backup.meta ? backup.meta.size : 0,
            etag: backup.meta ? backup.meta.etag : ETAG_DISABLED, // etag disabled if unknown!
            value: backup.value,
            readonly: false,
            locked: false
        }, true /* dirty (resolved from backup) */);
        // Restore orphaned flag based on state
        if (backup.meta?.orphaned) {
            this.setOrphaned(true);
        }
    }
    async resolveFromFile(options) {
        this.trace('resolveFromFile()');
        const forceReadFromFile = options?.forceReadFromFile;
        // Decide on etag
        let etag;
        if (forceReadFromFile) {
            etag = ETAG_DISABLED; // disable ETag if we enforce to read from disk
        }
        else if (this.lastResolvedFileStat) {
            etag = this.lastResolvedFileStat.etag; // otherwise respect etag to support caching
        }
        // Remember current version before doing any long running operation
        // to ensure we are not changing a working copy that was changed
        // meanwhile
        const currentVersionId = this.versionId;
        // Resolve Content
        try {
            const content = await this.fileService.readFileStream(this.resource, {
                etag,
                limits: options?.limits
            });
            // Clear orphaned state when resolving was successful
            this.setOrphaned(false);
            // Return early if the working copy content has changed
            // meanwhile to prevent loosing any changes
            if (currentVersionId !== this.versionId) {
                this.trace('resolveFromFile() - exit - without resolving because file working copy content changed');
                return;
            }
            await this.resolveFromContent(content, false /* not dirty (resolved from file) */);
        }
        catch (error) {
            const result = error.fileOperationResult;
            // Apply orphaned state based on error code
            this.setOrphaned(result === 1 /* FileOperationResult.FILE_NOT_FOUND */);
            // NotModified status is expected and can be handled gracefully
            // if we are resolved. We still want to update our last resolved
            // stat to e.g. detect changes to the file's readonly state
            if (this.isResolved() && result === 2 /* FileOperationResult.FILE_NOT_MODIFIED_SINCE */) {
                if (error instanceof NotModifiedSinceFileOperationError) {
                    this.updateLastResolvedFileStat(error.stat);
                }
                return;
            }
            // Unless we are forced to read from the file, ignore when a working copy has
            // been resolved once and the file was deleted meanwhile. Since we already have
            // the working copy resolved, we can return to this state and update the orphaned
            // flag to indicate that this working copy has no version on disk anymore.
            if (this.isResolved() && result === 1 /* FileOperationResult.FILE_NOT_FOUND */ && !forceReadFromFile) {
                return;
            }
            // Otherwise bubble up the error
            throw error;
        }
    }
    async resolveFromContent(content, dirty) {
        this.trace('resolveFromContent() - enter');
        // Return early if we are disposed
        if (this.isDisposed()) {
            this.trace('resolveFromContent() - exit - because working copy is disposed');
            return;
        }
        // Update our resolved disk stat
        this.updateLastResolvedFileStat({
            resource: this.resource,
            name: content.name,
            mtime: content.mtime,
            ctime: content.ctime,
            size: content.size,
            etag: content.etag,
            readonly: content.readonly,
            locked: content.locked,
            isFile: true,
            isDirectory: false,
            isSymbolicLink: false,
            children: undefined
        });
        // Update existing model if we had been resolved
        if (this.isResolved()) {
            await this.doUpdateModel(content.value);
        }
        // Create new model otherwise
        else {
            await this.doCreateModel(content.value);
        }
        // Update working copy dirty flag. This is very important to call
        // in both cases of dirty or not because it conditionally updates
        // the `savedVersionId` to determine the version when to consider
        // the working copy as saved again (e.g. when undoing back to the
        // saved state)
        this.setDirty(!!dirty);
        // Emit as event
        this._onDidResolve.fire();
    }
    async doCreateModel(contents) {
        this.trace('doCreateModel()');
        // Create model and dispose it when we get disposed
        this._model = this._register(await this.modelFactory.createModel(this.resource, contents, CancellationToken.None));
        // Model listeners
        this.installModelListeners(this._model);
    }
    async doUpdateModel(contents) {
        this.trace('doUpdateModel()');
        // Update model value in a block that ignores content change events for dirty tracking
        this.ignoreDirtyOnModelContentChange = true;
        try {
            await this.model?.update(contents, CancellationToken.None);
        }
        finally {
            this.ignoreDirtyOnModelContentChange = false;
        }
    }
    installModelListeners(model) {
        // See https://github.com/microsoft/vscode/issues/30189
        // This code has been extracted to a different method because it caused a memory leak
        // where `value` was captured in the content change listener closure scope.
        // Content Change
        this._register(model.onDidChangeContent(e => this.onModelContentChanged(model, e.isUndoing || e.isRedoing)));
        // Lifecycle
        this._register(model.onWillDispose(() => this.dispose()));
    }
    onModelContentChanged(model, isUndoingOrRedoing) {
        this.trace(`onModelContentChanged() - enter`);
        // In any case increment the version id because it tracks the content state of the model at all times
        this.versionId++;
        this.trace(`onModelContentChanged() - new versionId ${this.versionId}`);
        // Remember when the user changed the model through a undo/redo operation.
        // We need this information to throttle save participants to fix
        // https://github.com/microsoft/vscode/issues/102542
        if (isUndoingOrRedoing) {
            this.lastContentChangeFromUndoRedo = Date.now();
        }
        // We mark check for a dirty-state change upon model content change, unless:
        // - explicitly instructed to ignore it (e.g. from model.resolve())
        // - the model is readonly (in that case we never assume the change was done by the user)
        if (!this.ignoreDirtyOnModelContentChange && !this.isReadonly()) {
            // The contents changed as a matter of Undo and the version reached matches the saved one
            // In this case we clear the dirty flag and emit a SAVED event to indicate this state.
            if (model.versionId === this.savedVersionId) {
                this.trace('onModelContentChanged() - model content changed back to last saved version');
                // Clear flags
                const wasDirty = this.dirty;
                this.setDirty(false);
                // Emit revert event if we were dirty
                if (wasDirty) {
                    this._onDidRevert.fire();
                }
            }
            // Otherwise the content has changed and we signal this as becoming dirty
            else {
                this.trace('onModelContentChanged() - model content changed and marked as dirty');
                // Mark as dirty
                this.setDirty(true);
            }
        }
        // Emit as event
        this._onDidChangeContent.fire();
    }
    async forceResolveFromFile() {
        if (this.isDisposed()) {
            return; // return early when the working copy is invalid
        }
        // We go through the resolver to make
        // sure this kind of `resolve` is properly
        // running in sequence with any other running
        // `resolve` if any, including subsequent runs
        // that are triggered right after.
        await this.externalResolver({
            forceReadFromFile: true
        });
    }
    //#endregion
    //#region Backup
    get backupDelay() {
        return this.model?.configuration?.backupDelay;
    }
    async backup(token) {
        // Fill in metadata if we are resolved
        let meta = undefined;
        if (this.lastResolvedFileStat) {
            meta = {
                mtime: this.lastResolvedFileStat.mtime,
                ctime: this.lastResolvedFileStat.ctime,
                size: this.lastResolvedFileStat.size,
                etag: this.lastResolvedFileStat.etag,
                orphaned: this.isOrphaned()
            };
        }
        // Fill in content if we are resolved
        let content = undefined;
        if (this.isResolved()) {
            content = await raceCancellation(this.model.snapshot(2 /* SnapshotContext.Backup */, token), token);
        }
        return { meta, content };
    }
    static { this.UNDO_REDO_SAVE_PARTICIPANTS_AUTO_SAVE_THROTTLE_THRESHOLD = 500; }
    async save(options = Object.create(null)) {
        if (!this.isResolved()) {
            return false;
        }
        if (this.isReadonly()) {
            this.trace('save() - ignoring request for readonly resource');
            return false; // if working copy is readonly we do not attempt to save at all
        }
        if ((this.hasState(3 /* StoredFileWorkingCopyState.CONFLICT */) || this.hasState(5 /* StoredFileWorkingCopyState.ERROR */)) &&
            (options.reason === 2 /* SaveReason.AUTO */ || options.reason === 3 /* SaveReason.FOCUS_CHANGE */ || options.reason === 4 /* SaveReason.WINDOW_CHANGE */)) {
            this.trace('save() - ignoring auto save request for file working copy that is in conflict or error');
            return false; // if working copy is in save conflict or error, do not save unless save reason is explicit
        }
        // Actually do save
        this.trace('save() - enter');
        await this.doSave(options);
        this.trace('save() - exit');
        return this.hasState(0 /* StoredFileWorkingCopyState.SAVED */);
    }
    async doSave(options) {
        if (typeof options.reason !== 'number') {
            options.reason = 1 /* SaveReason.EXPLICIT */;
        }
        const versionId = this.versionId;
        this.trace(`doSave(${versionId}) - enter with versionId ${versionId}`);
        // Return early if saved from within save participant to break recursion
        //
        // Scenario: a save participant triggers a save() on the working copy
        if (this.ignoreSaveFromSaveParticipants) {
            this.trace(`doSave(${versionId}) - exit - refusing to save() recursively from save participant`);
            return;
        }
        // Lookup any running save for this versionId and return it if found
        //
        // Scenario: user invoked the save action multiple times quickly for the same contents
        //           while the save was not yet finished to disk
        //
        if (this.saveSequentializer.isRunning(versionId)) {
            this.trace(`doSave(${versionId}) - exit - found a running save for versionId ${versionId}`);
            return this.saveSequentializer.running;
        }
        // Return early if not dirty (unless forced)
        //
        // Scenario: user invoked save action even though the working copy is not dirty
        if (!options.force && !this.dirty) {
            this.trace(`doSave(${versionId}) - exit - because not dirty and/or versionId is different (this.isDirty: ${this.dirty}, this.versionId: ${this.versionId})`);
            return;
        }
        // Return if currently saving by storing this save request as the next save that should happen.
        // Never ever must 2 saves execute at the same time because this can lead to dirty writes and race conditions.
        //
        // Scenario A: auto save was triggered and is currently busy saving to disk. this takes long enough that another auto save
        //             kicks in.
        // Scenario B: save is very slow (e.g. network share) and the user manages to change the working copy and trigger another save
        //             while the first save has not returned yet.
        //
        if (this.saveSequentializer.isRunning()) {
            this.trace(`doSave(${versionId}) - exit - because busy saving`);
            // Indicate to the save sequentializer that we want to
            // cancel the running operation so that ours can run
            // before the running one finishes.
            // Currently this will try to cancel running save
            // participants and running snapshots from the
            // save operation, but not the actual save which does
            // not support cancellation yet.
            this.saveSequentializer.cancelRunning();
            // Queue this as the upcoming save and return
            return this.saveSequentializer.queue(() => this.doSave(options));
        }
        // Push all edit operations to the undo stack so that the user has a chance to
        // Ctrl+Z back to the saved version.
        if (this.isResolved()) {
            this.model.pushStackElement();
        }
        const saveCancellation = new CancellationTokenSource();
        return this.progressService.withProgress({
            title: localize('saveParticipants', "Saving '{0}'", this.name),
            location: 10 /* ProgressLocation.Window */,
            cancellable: true,
            delay: this.isDirty() ? 3000 : 5000
        }, progress => {
            return this.doSaveSequential(versionId, options, progress, saveCancellation);
        }, () => {
            saveCancellation.cancel();
        }).finally(() => {
            saveCancellation.dispose();
        });
    }
    doSaveSequential(versionId, options, progress, saveCancellation) {
        return this.saveSequentializer.run(versionId, (async () => {
            // A save participant can still change the working copy now
            // and since we are so close to saving we do not want to trigger
            // another auto save or similar, so we block this
            // In addition we update our version right after in case it changed
            // because of a working copy change
            // Save participants can also be skipped through API.
            if (this.isResolved() && !options.skipSaveParticipants && this.workingCopyFileService.hasSaveParticipants) {
                try {
                    // Measure the time it took from the last undo/redo operation to this save. If this
                    // time is below `UNDO_REDO_SAVE_PARTICIPANTS_THROTTLE_THRESHOLD`, we make sure to
                    // delay the save participant for the remaining time if the reason is auto save.
                    //
                    // This fixes the following issue:
                    // - the user has configured auto save with delay of 100ms or shorter
                    // - the user has a save participant enabled that modifies the file on each save
                    // - the user types into the file and the file gets saved
                    // - the user triggers undo operation
                    // - this will undo the save participant change but trigger the save participant right after
                    // - the user has no chance to undo over the save participant
                    //
                    // Reported as: https://github.com/microsoft/vscode/issues/102542
                    if (options.reason === 2 /* SaveReason.AUTO */ && typeof this.lastContentChangeFromUndoRedo === 'number') {
                        const timeFromUndoRedoToSave = Date.now() - this.lastContentChangeFromUndoRedo;
                        if (timeFromUndoRedoToSave < StoredFileWorkingCopy_1.UNDO_REDO_SAVE_PARTICIPANTS_AUTO_SAVE_THROTTLE_THRESHOLD) {
                            await timeout(StoredFileWorkingCopy_1.UNDO_REDO_SAVE_PARTICIPANTS_AUTO_SAVE_THROTTLE_THRESHOLD - timeFromUndoRedoToSave);
                        }
                    }
                    // Run save participants unless save was cancelled meanwhile
                    if (!saveCancellation.token.isCancellationRequested) {
                        this.ignoreSaveFromSaveParticipants = true;
                        try {
                            await this.workingCopyFileService.runSaveParticipants(this, { reason: options.reason ?? 1 /* SaveReason.EXPLICIT */, savedFrom: options.from }, progress, saveCancellation.token);
                        }
                        catch (err) {
                            if (isCancellationError(err) && !saveCancellation.token.isCancellationRequested) {
                                // participant wants to cancel this operation
                                saveCancellation.cancel();
                            }
                        }
                        finally {
                            this.ignoreSaveFromSaveParticipants = false;
                        }
                    }
                }
                catch (error) {
                    this.logService.error(`[stored file working copy] runSaveParticipants(${versionId}) - resulted in an error: ${error.toString()}`, this.resource.toString(), this.typeId);
                }
            }
            // It is possible that a subsequent save is cancelling this
            // running save. As such we return early when we detect that.
            if (saveCancellation.token.isCancellationRequested) {
                return;
            }
            // We have to protect against being disposed at this point. It could be that the save() operation
            // was triggerd followed by a dispose() operation right after without waiting. Typically we cannot
            // be disposed if we are dirty, but if we are not dirty, save() and dispose() can still be triggered
            // one after the other without waiting for the save() to complete. If we are disposed(), we risk
            // saving contents to disk that are stale (see https://github.com/microsoft/vscode/issues/50942).
            // To fix this issue, we will not store the contents to disk when we got disposed.
            if (this.isDisposed()) {
                return;
            }
            // We require a resolved working copy from this point on, since we are about to write data to disk.
            if (!this.isResolved()) {
                return;
            }
            // update versionId with its new value (if pre-save changes happened)
            versionId = this.versionId;
            // Clear error flag since we are trying to save again
            this.inErrorMode = false;
            // Save to Disk. We mark the save operation as currently running with
            // the latest versionId because it might have changed from a save
            // participant triggering
            progress.report({ message: localize('saveTextFile', "Writing into file...") });
            this.trace(`doSave(${versionId}) - before write()`);
            const lastResolvedFileStat = assertReturnsDefined(this.lastResolvedFileStat);
            const resolvedFileWorkingCopy = this;
            return this.saveSequentializer.run(versionId, (async () => {
                try {
                    const writeFileOptions = {
                        mtime: lastResolvedFileStat.mtime,
                        etag: (options.ignoreModifiedSince || !this.filesConfigurationService.preventSaveConflicts(lastResolvedFileStat.resource)) ? ETAG_DISABLED : lastResolvedFileStat.etag,
                        unlock: options.writeUnlock
                    };
                    let stat;
                    // Delegate to working copy model save method if any
                    if (typeof resolvedFileWorkingCopy.model.save === 'function') {
                        try {
                            stat = await resolvedFileWorkingCopy.model.save(writeFileOptions, saveCancellation.token);
                        }
                        catch (error) {
                            if (saveCancellation.token.isCancellationRequested) {
                                return undefined; // save was cancelled
                            }
                            throw error;
                        }
                    }
                    // Otherwise ask for a snapshot and save via file services
                    else {
                        // Snapshot working copy model contents
                        const snapshot = await raceCancellation(resolvedFileWorkingCopy.model.snapshot(1 /* SnapshotContext.Save */, saveCancellation.token), saveCancellation.token);
                        // It is possible that a subsequent save is cancelling this
                        // running save. As such we return early when we detect that
                        // However, we do not pass the token into the file service
                        // because that is an atomic operation currently without
                        // cancellation support, so we dispose the cancellation if
                        // it was not cancelled yet.
                        if (saveCancellation.token.isCancellationRequested) {
                            return;
                        }
                        else {
                            saveCancellation.dispose();
                        }
                        // Write them to disk
                        if (options?.writeElevated && this.elevatedFileService.isSupported(lastResolvedFileStat.resource)) {
                            stat = await this.elevatedFileService.writeFileElevated(lastResolvedFileStat.resource, assertReturnsDefined(snapshot), writeFileOptions);
                        }
                        else {
                            stat = await this.fileService.writeFile(lastResolvedFileStat.resource, assertReturnsDefined(snapshot), writeFileOptions);
                        }
                    }
                    this.handleSaveSuccess(stat, versionId, options);
                }
                catch (error) {
                    this.handleSaveError(error, versionId, options);
                }
            })(), () => saveCancellation.cancel());
        })(), () => saveCancellation.cancel());
    }
    handleSaveSuccess(stat, versionId, options) {
        // Updated resolved stat with updated stat
        this.updateLastResolvedFileStat(stat);
        // Update dirty state unless working copy has changed meanwhile
        if (versionId === this.versionId) {
            this.trace(`handleSaveSuccess(${versionId}) - setting dirty to false because versionId did not change`);
            this.setDirty(false);
        }
        else {
            this.trace(`handleSaveSuccess(${versionId}) - not setting dirty to false because versionId did change meanwhile`);
        }
        // Update orphan state given save was successful
        this.setOrphaned(false);
        // Emit Save Event
        this._onDidSave.fire({ reason: options.reason, stat, source: options.source });
    }
    handleSaveError(error, versionId, options) {
        (options.ignoreErrorHandler ? this.logService.trace : this.logService.error).apply(this.logService, [`[stored file working copy] handleSaveError(${versionId}) - exit - resulted in a save error: ${error.toString()}`, this.resource.toString(), this.typeId]);
        // Return early if the save() call was made asking to
        // handle the save error itself.
        if (options.ignoreErrorHandler) {
            throw error;
        }
        // In any case of an error, we mark the working copy as dirty to prevent data loss
        // It could be possible that the write corrupted the file on disk (e.g. when
        // an error happened after truncating the file) and as such we want to preserve
        // the working copy contents to prevent data loss.
        this.setDirty(true);
        // Flag as error state
        this.inErrorMode = true;
        // Look out for a save conflict
        if (error.fileOperationResult === 3 /* FileOperationResult.FILE_MODIFIED_SINCE */) {
            this.inConflictMode = true;
        }
        // Show save error to user for handling
        this.doHandleSaveError(error, options);
        // Emit as event
        this._onDidSaveError.fire();
    }
    doHandleSaveError(error, options) {
        const fileOperationError = error;
        const primaryActions = [];
        let message;
        // Dirty write prevention
        if (fileOperationError.fileOperationResult === 3 /* FileOperationResult.FILE_MODIFIED_SINCE */) {
            message = localize('staleSaveError', "Failed to save '{0}': The content of the file is newer. Do you want to overwrite the file with your changes?", this.name);
            primaryActions.push(toAction({ id: 'fileWorkingCopy.overwrite', label: localize('overwrite', "Overwrite"), run: () => this.save({ ...options, ignoreModifiedSince: true, reason: 1 /* SaveReason.EXPLICIT */ }) }));
            primaryActions.push(toAction({ id: 'fileWorkingCopy.revert', label: localize('revert', "Revert"), run: () => this.revert() }));
        }
        // Any other save error
        else {
            const isWriteLocked = fileOperationError.fileOperationResult === 5 /* FileOperationResult.FILE_WRITE_LOCKED */;
            const triedToUnlock = isWriteLocked && fileOperationError.options?.unlock;
            const isPermissionDenied = fileOperationError.fileOperationResult === 6 /* FileOperationResult.FILE_PERMISSION_DENIED */;
            const canSaveElevated = this.elevatedFileService.isSupported(this.resource);
            // Error with Actions
            if (isErrorWithActions(error)) {
                primaryActions.push(...error.actions);
            }
            // Save Elevated
            if (canSaveElevated && (isPermissionDenied || triedToUnlock)) {
                primaryActions.push(toAction({
                    id: 'fileWorkingCopy.saveElevated',
                    label: triedToUnlock ?
                        isWindows ? localize('overwriteElevated', "Overwrite as Admin...") : localize('overwriteElevatedSudo', "Overwrite as Sudo...") :
                        isWindows ? localize('saveElevated', "Retry as Admin...") : localize('saveElevatedSudo', "Retry as Sudo..."),
                    run: () => {
                        this.save({ ...options, writeElevated: true, writeUnlock: triedToUnlock, reason: 1 /* SaveReason.EXPLICIT */ });
                    }
                }));
            }
            // Unlock
            else if (isWriteLocked) {
                primaryActions.push(toAction({ id: 'fileWorkingCopy.unlock', label: localize('overwrite', "Overwrite"), run: () => this.save({ ...options, writeUnlock: true, reason: 1 /* SaveReason.EXPLICIT */ }) }));
            }
            // Retry
            else {
                primaryActions.push(toAction({ id: 'fileWorkingCopy.retry', label: localize('retry', "Retry"), run: () => this.save({ ...options, reason: 1 /* SaveReason.EXPLICIT */ }) }));
            }
            // Save As
            primaryActions.push(toAction({
                id: 'fileWorkingCopy.saveAs',
                label: localize('saveAs', "Save As..."),
                run: async () => {
                    const editor = this.workingCopyEditorService.findEditor(this);
                    if (editor) {
                        const result = await this.editorService.save(editor, { saveAs: true, reason: 1 /* SaveReason.EXPLICIT */ });
                        if (!result.success) {
                            this.doHandleSaveError(error, options); // show error again given the operation failed
                        }
                    }
                }
            }));
            // Revert
            primaryActions.push(toAction({ id: 'fileWorkingCopy.revert', label: localize('revert', "Revert"), run: () => this.revert() }));
            // Message
            if (isWriteLocked) {
                if (triedToUnlock && canSaveElevated) {
                    message = isWindows ?
                        localize('readonlySaveErrorAdmin', "Failed to save '{0}': File is read-only. Select 'Overwrite as Admin' to retry as administrator.", this.name) :
                        localize('readonlySaveErrorSudo', "Failed to save '{0}': File is read-only. Select 'Overwrite as Sudo' to retry as superuser.", this.name);
                }
                else {
                    message = localize('readonlySaveError', "Failed to save '{0}': File is read-only. Select 'Overwrite' to attempt to make it writeable.", this.name);
                }
            }
            else if (canSaveElevated && isPermissionDenied) {
                message = isWindows ?
                    localize('permissionDeniedSaveError', "Failed to save '{0}': Insufficient permissions. Select 'Retry as Admin' to retry as administrator.", this.name) :
                    localize('permissionDeniedSaveErrorSudo', "Failed to save '{0}': Insufficient permissions. Select 'Retry as Sudo' to retry as superuser.", this.name);
            }
            else {
                message = localize({ key: 'genericSaveError', comment: ['{0} is the resource that failed to save and {1} the error message'] }, "Failed to save '{0}': {1}", this.name, toErrorMessage(error, false));
            }
        }
        // Show to the user as notification
        const handle = this.notificationService.notify({ id: `${hash(this.resource.toString())}`, severity: Severity.Error, message, actions: { primary: primaryActions } });
        // Remove automatically when we get saved/reverted
        const listener = this._register(Event.once(Event.any(this.onDidSave, this.onDidRevert))(() => handle.close()));
        this._register(Event.once(handle.onDidClose)(() => listener.dispose()));
    }
    updateLastResolvedFileStat(newFileStat) {
        const oldReadonly = this.isReadonly();
        // First resolve - just take
        if (!this.lastResolvedFileStat) {
            this.lastResolvedFileStat = newFileStat;
        }
        // Subsequent resolve - make sure that we only assign it if the mtime
        // is equal or has advanced.
        // This prevents race conditions from resolving and saving. If a save
        // comes in late after a revert was called, the mtime could be out of
        // sync.
        else if (this.lastResolvedFileStat.mtime <= newFileStat.mtime) {
            this.lastResolvedFileStat = newFileStat;
        }
        // In all other cases update only the readonly and locked flags
        else {
            this.lastResolvedFileStat = { ...this.lastResolvedFileStat, readonly: newFileStat.readonly, locked: newFileStat.locked };
        }
        // Signal that the readonly state changed
        if (this.isReadonly() !== oldReadonly) {
            this._onDidChangeReadonly.fire();
        }
    }
    //#endregion
    //#region Revert
    async revert(options) {
        if (!this.isResolved() || (!this.dirty && !options?.force)) {
            return; // ignore if not resolved or not dirty and not enforced
        }
        this.trace('revert()');
        // Unset flags
        const wasDirty = this.dirty;
        const undoSetDirty = this.doSetDirty(false);
        // Force read from disk unless reverting soft
        const softUndo = options?.soft;
        if (!softUndo) {
            try {
                await this.forceResolveFromFile();
            }
            catch (error) {
                // FileNotFound means the file got deleted meanwhile, so ignore it
                if (error.fileOperationResult !== 1 /* FileOperationResult.FILE_NOT_FOUND */) {
                    // Set flags back to previous values, we are still dirty if revert failed
                    undoSetDirty();
                    throw error;
                }
            }
        }
        // Emit file change event
        this._onDidRevert.fire();
        // Emit dirty change event
        if (wasDirty) {
            this._onDidChangeDirty.fire();
        }
    }
    hasState(state) {
        switch (state) {
            case 3 /* StoredFileWorkingCopyState.CONFLICT */:
                return this.inConflictMode;
            case 1 /* StoredFileWorkingCopyState.DIRTY */:
                return this.dirty;
            case 5 /* StoredFileWorkingCopyState.ERROR */:
                return this.inErrorMode;
            case 4 /* StoredFileWorkingCopyState.ORPHAN */:
                return this.isOrphaned();
            case 2 /* StoredFileWorkingCopyState.PENDING_SAVE */:
                return this.saveSequentializer.isRunning();
            case 0 /* StoredFileWorkingCopyState.SAVED */:
                return !this.dirty;
        }
    }
    async joinState(state) {
        return this.saveSequentializer.running;
    }
    //#endregion
    //#region Utilities
    isReadonly() {
        return this.filesConfigurationService.isReadonly(this.resource, this.lastResolvedFileStat);
    }
    trace(msg) {
        this.logService.trace(`[stored file working copy] ${msg}`, this.resource.toString(), this.typeId);
    }
    //#endregion
    //#region Dispose
    dispose() {
        this.trace('dispose()');
        // State
        this.inConflictMode = false;
        this.inErrorMode = false;
        // Free up model for GC
        this._model = undefined;
        super.dispose();
    }
};
StoredFileWorkingCopy = StoredFileWorkingCopy_1 = __decorate([
    __param(5, IFileService),
    __param(6, ILogService),
    __param(7, IWorkingCopyFileService),
    __param(8, IFilesConfigurationService),
    __param(9, IWorkingCopyBackupService),
    __param(10, IWorkingCopyService),
    __param(11, INotificationService),
    __param(12, IWorkingCopyEditorService),
    __param(13, IEditorService),
    __param(14, IElevatedFileService),
    __param(15, IProgressService)
], StoredFileWorkingCopy);
export { StoredFileWorkingCopy };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmVkRmlsZVdvcmtpbmdDb3B5LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vc3RvcmVkRmlsZVdvcmtpbmdDb3B5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFOUMsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRyxPQUFPLEVBQUUsYUFBYSxFQUE0RCxZQUFZLEVBQWdFLGtDQUFrQyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFclAsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFFOUQsT0FBTyxFQUFFLGdCQUFnQixFQUFFLGtCQUFrQixFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUV0RSxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUMxRyxPQUFPLEVBQUUseUJBQXlCLEVBQThCLE1BQU0sd0JBQXdCLENBQUM7QUFDL0YsT0FBTyxFQUFFLG9CQUFvQixFQUFFLFFBQVEsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzFHLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsY0FBYyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDN0YsT0FBTyxFQUFXLFFBQVEsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMxRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdEUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDakYsT0FBTyxFQUF3QixtQkFBbUIsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBR3JGLE9BQU8sRUFBYSxnQkFBZ0IsRUFBbUMsTUFBTSxrREFBa0QsQ0FBQztBQUNoSSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQW1KeEU7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBa0IsMEJBcUNqQjtBQXJDRCxXQUFrQiwwQkFBMEI7SUFFM0M7O09BRUc7SUFDSCw2RUFBSyxDQUFBO0lBRUw7O09BRUc7SUFDSCw2RUFBSyxDQUFBO0lBRUw7OztPQUdHO0lBQ0gsMkZBQVksQ0FBQTtJQUVaOzs7O09BSUc7SUFDSCxtRkFBUSxDQUFBO0lBRVI7OztPQUdHO0lBQ0gsK0VBQU0sQ0FBQTtJQUVOOzs7O09BSUc7SUFDSCw2RUFBSyxDQUFBO0FBQ04sQ0FBQyxFQXJDaUIsMEJBQTBCLEtBQTFCLDBCQUEwQixRQXFDM0M7QUEyRkQsTUFBTSxVQUFVLGdDQUFnQyxDQUFDLENBQXdCO0lBQ3hFLE1BQU0sU0FBUyxHQUFHLENBQW9DLENBQUM7SUFFdkQsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztBQUN6QixDQUFDO0FBRU0sSUFBTSxxQkFBcUIsR0FBM0IsTUFBTSxxQkFBNkQsU0FBUSxtQkFBbUI7O0lBS3BHLElBQUksS0FBSyxLQUFvQixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBeUJsRCxZQUFZO0lBRVosWUFDVSxNQUFjLEVBQ3ZCLFFBQWEsRUFDSixJQUFZLEVBQ0osWUFBbUQsRUFDbkQsZ0JBQWdELEVBQ25ELFdBQXlCLEVBQzFCLFVBQXdDLEVBQzVCLHNCQUFnRSxFQUM3RCx5QkFBc0UsRUFDdkUsd0JBQW9FLEVBQzFFLGtCQUF1QyxFQUN0QyxtQkFBMEQsRUFDckQsd0JBQW9FLEVBQy9FLGFBQThDLEVBQ3hDLG1CQUEwRCxFQUM5RCxlQUFrRDtRQUVwRSxLQUFLLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBakJwQixXQUFNLEdBQU4sTUFBTSxDQUFRO1FBRWQsU0FBSSxHQUFKLElBQUksQ0FBUTtRQUNKLGlCQUFZLEdBQVosWUFBWSxDQUF1QztRQUNuRCxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQWdDO1FBRW5DLGVBQVUsR0FBVixVQUFVLENBQWE7UUFDWCwyQkFBc0IsR0FBdEIsc0JBQXNCLENBQXlCO1FBQzVDLDhCQUF5QixHQUF6Qix5QkFBeUIsQ0FBNEI7UUFDdEQsNkJBQXdCLEdBQXhCLHdCQUF3QixDQUEyQjtRQUV4RCx3QkFBbUIsR0FBbkIsbUJBQW1CLENBQXNCO1FBQ3BDLDZCQUF3QixHQUF4Qix3QkFBd0IsQ0FBMkI7UUFDOUQsa0JBQWEsR0FBYixhQUFhLENBQWdCO1FBQ3ZCLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBc0I7UUFDN0Msb0JBQWUsR0FBZixlQUFlLENBQWtCO1FBOUM1RCxpQkFBWSx3Q0FBeUQ7UUFFdEUsV0FBTSxHQUFrQixTQUFTLENBQUM7UUFHMUMsZ0JBQWdCO1FBRUMsd0JBQW1CLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFDbEUsdUJBQWtCLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQztRQUU1QyxrQkFBYSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVEsQ0FBQyxDQUFDO1FBQzVELGlCQUFZLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUM7UUFFaEMsc0JBQWlCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFDaEUscUJBQWdCLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQztRQUV4QyxvQkFBZSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVEsQ0FBQyxDQUFDO1FBQzlELG1CQUFjLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUM7UUFFcEMsZUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQW1DLENBQUMsQ0FBQztRQUNwRixjQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUM7UUFFMUIsaUJBQVksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUMzRCxnQkFBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDO1FBRTlCLHlCQUFvQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVEsQ0FBQyxDQUFDO1FBQ25FLHdCQUFtQixHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUM7UUFrQy9ELGVBQWU7UUFFUCxVQUFLLEdBQUcsS0FBSyxDQUFDO1FBbVVkLG9DQUErQixHQUFHLEtBQUssQ0FBQztRQXlIaEQsWUFBWTtRQUVaLGNBQWM7UUFFTixjQUFTLEdBQUcsQ0FBQyxDQUFDO1FBR2Qsa0NBQTZCLEdBQXVCLFNBQVMsQ0FBQztRQUVyRCx1QkFBa0IsR0FBRyxJQUFJLGtCQUFrQixFQUFFLENBQUM7UUFFdkQsbUNBQThCLEdBQUcsS0FBSyxDQUFDO1FBb2QvQyxZQUFZO1FBRVosZUFBZTtRQUVQLG1CQUFjLEdBQUcsS0FBSyxDQUFDO1FBQ3ZCLGdCQUFXLEdBQUcsS0FBSyxDQUFDO1FBNTZCM0IscUNBQXFDO1FBQ3JDLElBQUksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUU3RCxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztJQUMxQixDQUFDO0lBRU8saUJBQWlCO1FBQ3hCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLG1CQUFtQixDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDNUcsQ0FBQztJQU9ELE9BQU87UUFDTixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDbkIsQ0FBQztJQUVELFlBQVk7UUFDWCxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMscURBQXFEO0lBQzNFLENBQUM7SUFFTyxRQUFRLENBQUMsS0FBYztRQUM5QixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUM7WUFDeEIsT0FBTyxDQUFDLG1EQUFtRDtRQUM1RCxDQUFDO1FBRUQsbUNBQW1DO1FBQ25DLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDNUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUV2QixpQ0FBaUM7UUFDakMsSUFBSSxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDeEIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxDQUFDO1FBQy9CLENBQUM7SUFDRixDQUFDO0lBRU8sVUFBVSxDQUFDLEtBQWM7UUFDaEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUM1QixNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7UUFDOUMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUN4QyxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7UUFFOUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1osSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7WUFDbkIsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUM7WUFDNUIsSUFBSSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUM7WUFFekIsMkVBQTJFO1lBQzNFLDRFQUE0RTtZQUM1RSwwRUFBMEU7WUFDMUUsMkVBQTJFO1lBQzNFLHdCQUF3QjtZQUN4QixJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO2dCQUN2QixJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDO1lBQzVDLENBQUM7UUFDRixDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDO1FBQ25CLENBQUM7UUFFRCxzQ0FBc0M7UUFDdEMsT0FBTyxHQUFHLEVBQUU7WUFDWCxJQUFJLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQztZQUN0QixJQUFJLENBQUMsY0FBYyxHQUFHLGlCQUFpQixDQUFDO1lBQ3hDLElBQUksQ0FBQyxXQUFXLEdBQUcsY0FBYyxDQUFDO1lBQ2xDLElBQUksQ0FBQyxjQUFjLEdBQUcsaUJBQWlCLENBQUM7UUFDekMsQ0FBQyxDQUFDO0lBQ0gsQ0FBQztJQVFELFVBQVU7UUFDVCxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO0lBQ3JCLENBQUM7SUFFRCxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQThDO1FBQzNELElBQUksQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUVoQyxrQ0FBa0M7UUFDbEMsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQztZQUN2QixJQUFJLENBQUMsS0FBSyxDQUFDLDRFQUE0RSxDQUFDLENBQUM7WUFFekYsT0FBTztRQUNSLENBQUM7UUFFRCw4RUFBOEU7UUFDOUUsaUZBQWlGO1FBQ2pGLGFBQWE7UUFDYixJQUFJLENBQUMsT0FBTyxFQUFFLFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUMvRSxJQUFJLENBQUMsS0FBSyxDQUFDLHdGQUF3RixDQUFDLENBQUM7WUFFckcsT0FBTztRQUNSLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUVPLEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBOEM7UUFFckUsOERBQThEO1FBQzlELElBQUksT0FBTyxFQUFFLFFBQVEsRUFBRSxDQUFDO1lBQ3ZCLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNqRCxDQUFDO1FBRUQsa0ZBQWtGO1FBQ2xGLE1BQU0sS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2pDLElBQUksS0FBSyxFQUFFLENBQUM7WUFDWCxNQUFNLGtCQUFrQixHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDMUQsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO2dCQUN4QixPQUFPO1lBQ1IsQ0FBQztRQUNGLENBQUM7UUFFRCxzQ0FBc0M7UUFDdEMsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFFTyxLQUFLLENBQUMsaUJBQWlCLENBQUMsTUFBOEI7UUFDN0QsSUFBSSxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBRWxDLG1DQUFtQztRQUNuQyxJQUFJLEtBQWEsQ0FBQztRQUNsQixJQUFJLEtBQWEsQ0FBQztRQUNsQixJQUFJLElBQVksQ0FBQztRQUNqQixJQUFJLElBQVksQ0FBQztRQUNqQixJQUFJLENBQUM7WUFDSixNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM1RCxLQUFLLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQztZQUN2QixLQUFLLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQztZQUN2QixJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQztZQUNyQixJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQztZQUVyQixxREFBcUQ7WUFDckQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN6QixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUVoQix5Q0FBeUM7WUFDekMsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNuQixLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ25CLElBQUksR0FBRyxDQUFDLENBQUM7WUFDVCxJQUFJLEdBQUcsYUFBYSxDQUFDO1lBRXJCLDJDQUEyQztZQUMzQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsK0NBQXVDLENBQUMsQ0FBQztRQUNwRixDQUFDO1FBRUQsc0JBQXNCO1FBQ3RCLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDO1lBQzlCLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUN2QixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDZixLQUFLO1lBQ0wsS0FBSztZQUNMLElBQUk7WUFDSixJQUFJO1lBQ0osS0FBSyxFQUFFLE1BQU07WUFDYixRQUFRLEVBQUUsS0FBSztZQUNmLE1BQU0sRUFBRSxLQUFLO1NBQ2IsRUFBRSxJQUFJLENBQUMsa0NBQWtDLENBQUMsQ0FBQztJQUM3QyxDQUFDO0lBRU8sS0FBSyxDQUFDLGlCQUFpQjtRQUU5Qix3QkFBd0I7UUFDeEIsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsd0JBQXdCLENBQUMsT0FBTyxDQUF1QyxJQUFJLENBQUMsQ0FBQztRQUV2RyxtRUFBbUU7UUFDbkUsTUFBTSxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDakMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1osSUFBSSxDQUFDLEtBQUssQ0FBQyw4R0FBOEcsQ0FBQyxDQUFDO1lBRTNILE9BQU8sSUFBSSxDQUFDLENBQUMseURBQXlEO1FBQ3ZFLENBQUM7UUFFRCw0Q0FBNEM7UUFDNUMsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUNaLE1BQU0sSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBRXZDLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELHNEQUFzRDtRQUN0RCxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFTyxLQUFLLENBQUMsbUJBQW1CLENBQUMsTUFBd0U7UUFDekcsSUFBSSxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBRXBDLHNCQUFzQjtRQUN0QixNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztZQUM3QixRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVE7WUFDdkIsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ2YsS0FBSyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO1lBQ25ELEtBQUssRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtZQUNuRCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDeEMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxhQUFhLEVBQUUsNEJBQTRCO1lBQ2xGLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSztZQUNuQixRQUFRLEVBQUUsS0FBSztZQUNmLE1BQU0sRUFBRSxLQUFLO1NBQ2IsRUFBRSxJQUFJLENBQUMsa0NBQWtDLENBQUMsQ0FBQztRQUU1Qyx1Q0FBdUM7UUFDdkMsSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxDQUFDO1lBQzNCLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDeEIsQ0FBQztJQUNGLENBQUM7SUFFTyxLQUFLLENBQUMsZUFBZSxDQUFDLE9BQThDO1FBQzNFLElBQUksQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUVoQyxNQUFNLGlCQUFpQixHQUFHLE9BQU8sRUFBRSxpQkFBaUIsQ0FBQztRQUVyRCxpQkFBaUI7UUFDakIsSUFBSSxJQUF3QixDQUFDO1FBQzdCLElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUN2QixJQUFJLEdBQUcsYUFBYSxDQUFDLENBQUMsK0NBQStDO1FBQ3RFLENBQUM7YUFBTSxJQUFJLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1lBQ3RDLElBQUksR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUMsNENBQTRDO1FBQ3BGLENBQUM7UUFFRCxtRUFBbUU7UUFDbkUsZ0VBQWdFO1FBQ2hFLFlBQVk7UUFDWixNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7UUFFeEMsa0JBQWtCO1FBQ2xCLElBQUksQ0FBQztZQUNKLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRTtnQkFDcEUsSUFBSTtnQkFDSixNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU07YUFDdkIsQ0FBQyxDQUFDO1lBRUgscURBQXFEO1lBQ3JELElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFeEIsdURBQXVEO1lBQ3ZELDJDQUEyQztZQUMzQyxJQUFJLGdCQUFnQixLQUFLLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDekMsSUFBSSxDQUFDLEtBQUssQ0FBQyx3RkFBd0YsQ0FBQyxDQUFDO2dCQUVyRyxPQUFPO1lBQ1IsQ0FBQztZQUVELE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsb0NBQW9DLENBQUMsQ0FBQztRQUNwRixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNoQixNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsbUJBQW1CLENBQUM7WUFFekMsMkNBQTJDO1lBQzNDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSwrQ0FBdUMsQ0FBQyxDQUFDO1lBRWhFLCtEQUErRDtZQUMvRCxnRUFBZ0U7WUFDaEUsMkRBQTJEO1lBQzNELElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLE1BQU0sd0RBQWdELEVBQUUsQ0FBQztnQkFDakYsSUFBSSxLQUFLLFlBQVksa0NBQWtDLEVBQUUsQ0FBQztvQkFDekQsSUFBSSxDQUFDLDBCQUEwQixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDN0MsQ0FBQztnQkFFRCxPQUFPO1lBQ1IsQ0FBQztZQUVELDZFQUE2RTtZQUM3RSwrRUFBK0U7WUFDL0UsaUZBQWlGO1lBQ2pGLDBFQUEwRTtZQUMxRSxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxNQUFNLCtDQUF1QyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztnQkFDOUYsT0FBTztZQUNSLENBQUM7WUFFRCxnQ0FBZ0M7WUFDaEMsTUFBTSxLQUFLLENBQUM7UUFDYixDQUFDO0lBQ0YsQ0FBQztJQUVPLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxPQUEyQixFQUFFLEtBQWM7UUFDM0UsSUFBSSxDQUFDLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO1FBRTNDLGtDQUFrQztRQUNsQyxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxLQUFLLENBQUMsZ0VBQWdFLENBQUMsQ0FBQztZQUU3RSxPQUFPO1FBQ1IsQ0FBQztRQUVELGdDQUFnQztRQUNoQyxJQUFJLENBQUMsMEJBQTBCLENBQUM7WUFDL0IsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3ZCLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtZQUNsQixLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUs7WUFDcEIsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO1lBQ3BCLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtZQUNsQixJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7WUFDbEIsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRO1lBQzFCLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTTtZQUN0QixNQUFNLEVBQUUsSUFBSTtZQUNaLFdBQVcsRUFBRSxLQUFLO1lBQ2xCLGNBQWMsRUFBRSxLQUFLO1lBQ3JCLFFBQVEsRUFBRSxTQUFTO1NBQ25CLENBQUMsQ0FBQztRQUVILGdEQUFnRDtRQUNoRCxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBQ3ZCLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDekMsQ0FBQztRQUVELDZCQUE2QjthQUN4QixDQUFDO1lBQ0wsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN6QyxDQUFDO1FBRUQsaUVBQWlFO1FBQ2pFLGlFQUFpRTtRQUNqRSxpRUFBaUU7UUFDakUsaUVBQWlFO1FBQ2pFLGVBQWU7UUFDZixJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUV2QixnQkFBZ0I7UUFDaEIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUMzQixDQUFDO0lBRU8sS0FBSyxDQUFDLGFBQWEsQ0FBQyxRQUFnQztRQUMzRCxJQUFJLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFFOUIsbURBQW1EO1FBQ25ELElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFbkgsa0JBQWtCO1FBQ2xCLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUlPLEtBQUssQ0FBQyxhQUFhLENBQUMsUUFBZ0M7UUFDM0QsSUFBSSxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBRTlCLHNGQUFzRjtRQUN0RixJQUFJLENBQUMsK0JBQStCLEdBQUcsSUFBSSxDQUFDO1FBQzVDLElBQUksQ0FBQztZQUNKLE1BQU0sSUFBSSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsUUFBUSxFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzVELENBQUM7Z0JBQVMsQ0FBQztZQUNWLElBQUksQ0FBQywrQkFBK0IsR0FBRyxLQUFLLENBQUM7UUFDOUMsQ0FBQztJQUNGLENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxLQUFRO1FBRXJDLHVEQUF1RDtRQUN2RCxxRkFBcUY7UUFDckYsMkVBQTJFO1FBRTNFLGlCQUFpQjtRQUNqQixJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTdHLFlBQVk7UUFDWixJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBRU8scUJBQXFCLENBQUMsS0FBUSxFQUFFLGtCQUEyQjtRQUNsRSxJQUFJLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7UUFFOUMscUdBQXFHO1FBQ3JHLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUNqQixJQUFJLENBQUMsS0FBSyxDQUFDLDJDQUEyQyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUV4RSwwRUFBMEU7UUFDMUUsZ0VBQWdFO1FBQ2hFLG9EQUFvRDtRQUNwRCxJQUFJLGtCQUFrQixFQUFFLENBQUM7WUFDeEIsSUFBSSxDQUFDLDZCQUE2QixHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNqRCxDQUFDO1FBRUQsNEVBQTRFO1FBQzVFLG1FQUFtRTtRQUNuRSx5RkFBeUY7UUFDekYsSUFBSSxDQUFDLElBQUksQ0FBQywrQkFBK0IsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBRWpFLHlGQUF5RjtZQUN6RixzRkFBc0Y7WUFDdEYsSUFBSSxLQUFLLENBQUMsU0FBUyxLQUFLLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFDN0MsSUFBSSxDQUFDLEtBQUssQ0FBQyw0RUFBNEUsQ0FBQyxDQUFDO2dCQUV6RixjQUFjO2dCQUNkLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7Z0JBQzVCLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBRXJCLHFDQUFxQztnQkFDckMsSUFBSSxRQUFRLEVBQUUsQ0FBQztvQkFDZCxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUMxQixDQUFDO1lBQ0YsQ0FBQztZQUVELHlFQUF5RTtpQkFDcEUsQ0FBQztnQkFDTCxJQUFJLENBQUMsS0FBSyxDQUFDLHFFQUFxRSxDQUFDLENBQUM7Z0JBRWxGLGdCQUFnQjtnQkFDaEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNyQixDQUFDO1FBQ0YsQ0FBQztRQUVELGdCQUFnQjtRQUNoQixJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDakMsQ0FBQztJQUVPLEtBQUssQ0FBQyxvQkFBb0I7UUFDakMsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQztZQUN2QixPQUFPLENBQUMsZ0RBQWdEO1FBQ3pELENBQUM7UUFFRCxxQ0FBcUM7UUFDckMsMENBQTBDO1FBQzFDLDZDQUE2QztRQUM3Qyw4Q0FBOEM7UUFDOUMsa0NBQWtDO1FBRWxDLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDO1lBQzNCLGlCQUFpQixFQUFFLElBQUk7U0FDdkIsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELFlBQVk7SUFFWixnQkFBZ0I7SUFFaEIsSUFBSSxXQUFXO1FBQ2QsT0FBTyxJQUFJLENBQUMsS0FBSyxFQUFFLGFBQWEsRUFBRSxXQUFXLENBQUM7SUFDL0MsQ0FBQztJQUVELEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBd0I7UUFFcEMsc0NBQXNDO1FBQ3RDLElBQUksSUFBSSxHQUFxRCxTQUFTLENBQUM7UUFDdkUsSUFBSSxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztZQUMvQixJQUFJLEdBQUc7Z0JBQ04sS0FBSyxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLO2dCQUN0QyxLQUFLLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUs7Z0JBQ3RDLElBQUksRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSTtnQkFDcEMsSUFBSSxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJO2dCQUNwQyxRQUFRLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRTthQUMzQixDQUFDO1FBQ0gsQ0FBQztRQUVELHFDQUFxQztRQUNyQyxJQUFJLE9BQU8sR0FBdUMsU0FBUyxDQUFDO1FBQzVELElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUM7WUFDdkIsT0FBTyxHQUFHLE1BQU0sZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLGlDQUF5QixLQUFLLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUM3RixDQUFDO1FBRUQsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQztJQUMxQixDQUFDO2FBUXVCLDZEQUF3RCxHQUFHLEdBQUcsQUFBTixDQUFPO0lBT3ZGLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBK0MsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDNUUsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBQ3hCLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUM7WUFDdkIsSUFBSSxDQUFDLEtBQUssQ0FBQyxpREFBaUQsQ0FBQyxDQUFDO1lBRTlELE9BQU8sS0FBSyxDQUFDLENBQUMsK0RBQStEO1FBQzlFLENBQUM7UUFFRCxJQUNDLENBQUMsSUFBSSxDQUFDLFFBQVEsNkNBQXFDLElBQUksSUFBSSxDQUFDLFFBQVEsMENBQWtDLENBQUM7WUFDdkcsQ0FBQyxPQUFPLENBQUMsTUFBTSw0QkFBb0IsSUFBSSxPQUFPLENBQUMsTUFBTSxvQ0FBNEIsSUFBSSxPQUFPLENBQUMsTUFBTSxxQ0FBNkIsQ0FBQyxFQUNoSSxDQUFDO1lBQ0YsSUFBSSxDQUFDLEtBQUssQ0FBQyx3RkFBd0YsQ0FBQyxDQUFDO1lBRXJHLE9BQU8sS0FBSyxDQUFDLENBQUMsMkZBQTJGO1FBQzFHLENBQUM7UUFFRCxtQkFBbUI7UUFDbkIsSUFBSSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQzdCLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMzQixJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRTVCLE9BQU8sSUFBSSxDQUFDLFFBQVEsMENBQWtDLENBQUM7SUFDeEQsQ0FBQztJQUVPLEtBQUssQ0FBQyxNQUFNLENBQUMsT0FBNEM7UUFDaEUsSUFBSSxPQUFPLE9BQU8sQ0FBQyxNQUFNLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDeEMsT0FBTyxDQUFDLE1BQU0sOEJBQXNCLENBQUM7UUFDdEMsQ0FBQztRQUVELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDakMsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLFNBQVMsNEJBQTRCLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFFdkUsd0VBQXdFO1FBQ3hFLEVBQUU7UUFDRixxRUFBcUU7UUFDckUsSUFBSSxJQUFJLENBQUMsOEJBQThCLEVBQUUsQ0FBQztZQUN6QyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsU0FBUyxpRUFBaUUsQ0FBQyxDQUFDO1lBRWpHLE9BQU87UUFDUixDQUFDO1FBRUQsb0VBQW9FO1FBQ3BFLEVBQUU7UUFDRixzRkFBc0Y7UUFDdEYsd0RBQXdEO1FBQ3hELEVBQUU7UUFDRixJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztZQUNsRCxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsU0FBUyxpREFBaUQsU0FBUyxFQUFFLENBQUMsQ0FBQztZQUU1RixPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUM7UUFDeEMsQ0FBQztRQUVELDRDQUE0QztRQUM1QyxFQUFFO1FBQ0YsK0VBQStFO1FBQy9FLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ25DLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxTQUFTLDZFQUE2RSxJQUFJLENBQUMsS0FBSyxxQkFBcUIsSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7WUFFN0osT0FBTztRQUNSLENBQUM7UUFFRCwrRkFBK0Y7UUFDL0YsOEdBQThHO1FBQzlHLEVBQUU7UUFDRiwwSEFBMEg7UUFDMUgsd0JBQXdCO1FBQ3hCLDhIQUE4SDtRQUM5SCx5REFBeUQ7UUFDekQsRUFBRTtRQUNGLElBQUksSUFBSSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUM7WUFDekMsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLFNBQVMsZ0NBQWdDLENBQUMsQ0FBQztZQUVoRSxzREFBc0Q7WUFDdEQsb0RBQW9EO1lBQ3BELG1DQUFtQztZQUNuQyxpREFBaUQ7WUFDakQsOENBQThDO1lBQzlDLHFEQUFxRDtZQUNyRCxnQ0FBZ0M7WUFDaEMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGFBQWEsRUFBRSxDQUFDO1lBRXhDLDZDQUE2QztZQUM3QyxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ2xFLENBQUM7UUFFRCw4RUFBOEU7UUFDOUUsb0NBQW9DO1FBQ3BDLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUM7WUFDdkIsSUFBSSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQy9CLENBQUM7UUFFRCxNQUFNLGdCQUFnQixHQUFHLElBQUksdUJBQXVCLEVBQUUsQ0FBQztRQUV2RCxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDO1lBQ3hDLEtBQUssRUFBRSxRQUFRLENBQUMsa0JBQWtCLEVBQUUsY0FBYyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUM7WUFDOUQsUUFBUSxrQ0FBeUI7WUFDakMsV0FBVyxFQUFFLElBQUk7WUFDakIsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJO1NBQ25DLEVBQUUsUUFBUSxDQUFDLEVBQUU7WUFDYixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQzlFLENBQUMsRUFBRSxHQUFHLEVBQUU7WUFDUCxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUMzQixDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFO1lBQ2YsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDNUIsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU8sZ0JBQWdCLENBQUMsU0FBaUIsRUFBRSxPQUE0QyxFQUFFLFFBQWtDLEVBQUUsZ0JBQXlDO1FBQ3RLLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxLQUFLLElBQUksRUFBRTtZQUV6RCwyREFBMkQ7WUFDM0QsZ0VBQWdFO1lBQ2hFLGlEQUFpRDtZQUNqRCxtRUFBbUU7WUFDbkUsbUNBQW1DO1lBQ25DLHFEQUFxRDtZQUNyRCxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsSUFBSSxJQUFJLENBQUMsc0JBQXNCLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztnQkFDM0csSUFBSSxDQUFDO29CQUVKLG1GQUFtRjtvQkFDbkYsa0ZBQWtGO29CQUNsRixnRkFBZ0Y7b0JBQ2hGLEVBQUU7b0JBQ0Ysa0NBQWtDO29CQUNsQyxxRUFBcUU7b0JBQ3JFLGdGQUFnRjtvQkFDaEYseURBQXlEO29CQUN6RCxxQ0FBcUM7b0JBQ3JDLDRGQUE0RjtvQkFDNUYsNkRBQTZEO29CQUM3RCxFQUFFO29CQUNGLGlFQUFpRTtvQkFDakUsSUFBSSxPQUFPLENBQUMsTUFBTSw0QkFBb0IsSUFBSSxPQUFPLElBQUksQ0FBQyw2QkFBNkIsS0FBSyxRQUFRLEVBQUUsQ0FBQzt3QkFDbEcsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLDZCQUE2QixDQUFDO3dCQUMvRSxJQUFJLHNCQUFzQixHQUFHLHVCQUFxQixDQUFDLHdEQUF3RCxFQUFFLENBQUM7NEJBQzdHLE1BQU0sT0FBTyxDQUFDLHVCQUFxQixDQUFDLHdEQUF3RCxHQUFHLHNCQUFzQixDQUFDLENBQUM7d0JBQ3hILENBQUM7b0JBQ0YsQ0FBQztvQkFFRCw0REFBNEQ7b0JBQzVELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQzt3QkFDckQsSUFBSSxDQUFDLDhCQUE4QixHQUFHLElBQUksQ0FBQzt3QkFDM0MsSUFBSSxDQUFDOzRCQUNKLE1BQU0sSUFBSSxDQUFDLHNCQUFzQixDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTSwrQkFBdUIsRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLElBQUksRUFBRSxFQUFFLFFBQVEsRUFBRSxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFDM0ssQ0FBQzt3QkFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDOzRCQUNkLElBQUksbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztnQ0FDakYsNkNBQTZDO2dDQUM3QyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQzs0QkFDM0IsQ0FBQzt3QkFDRixDQUFDO2dDQUFTLENBQUM7NEJBQ1YsSUFBSSxDQUFDLDhCQUE4QixHQUFHLEtBQUssQ0FBQzt3QkFDN0MsQ0FBQztvQkFDRixDQUFDO2dCQUNGLENBQUM7Z0JBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztvQkFDaEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsa0RBQWtELFNBQVMsNkJBQTZCLEtBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUMxSyxDQUFDO1lBQ0YsQ0FBQztZQUVELDJEQUEyRDtZQUMzRCw2REFBNkQ7WUFDN0QsSUFBSSxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztnQkFDcEQsT0FBTztZQUNSLENBQUM7WUFFRCxpR0FBaUc7WUFDakcsa0dBQWtHO1lBQ2xHLG9HQUFvRztZQUNwRyxnR0FBZ0c7WUFDaEcsaUdBQWlHO1lBQ2pHLGtGQUFrRjtZQUNsRixJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO2dCQUN2QixPQUFPO1lBQ1IsQ0FBQztZQUVELG1HQUFtRztZQUNuRyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUM7Z0JBQ3hCLE9BQU87WUFDUixDQUFDO1lBRUQscUVBQXFFO1lBQ3JFLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO1lBRTNCLHFEQUFxRDtZQUNyRCxJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQztZQUV6QixxRUFBcUU7WUFDckUsaUVBQWlFO1lBQ2pFLHlCQUF5QjtZQUN6QixRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsT0FBTyxFQUFFLFFBQVEsQ0FBQyxjQUFjLEVBQUUsc0JBQXNCLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDL0UsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLFNBQVMsb0JBQW9CLENBQUMsQ0FBQztZQUNwRCxNQUFNLG9CQUFvQixHQUFHLG9CQUFvQixDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1lBQzdFLE1BQU0sdUJBQXVCLEdBQUcsSUFBSSxDQUFDO1lBQ3JDLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxLQUFLLElBQUksRUFBRTtnQkFDekQsSUFBSSxDQUFDO29CQUNKLE1BQU0sZ0JBQWdCLEdBQXNCO3dCQUMzQyxLQUFLLEVBQUUsb0JBQW9CLENBQUMsS0FBSzt3QkFDakMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLG1CQUFtQixJQUFJLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLG9CQUFvQixDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsb0JBQW9CLENBQUMsSUFBSTt3QkFDdEssTUFBTSxFQUFFLE9BQU8sQ0FBQyxXQUFXO3FCQUMzQixDQUFDO29CQUVGLElBQUksSUFBMkIsQ0FBQztvQkFFaEMsb0RBQW9EO29CQUNwRCxJQUFJLE9BQU8sdUJBQXVCLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxVQUFVLEVBQUUsQ0FBQzt3QkFDOUQsSUFBSSxDQUFDOzRCQUNKLElBQUksR0FBRyxNQUFNLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7d0JBQzNGLENBQUM7d0JBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQzs0QkFDaEIsSUFBSSxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztnQ0FDcEQsT0FBTyxTQUFTLENBQUMsQ0FBQyxxQkFBcUI7NEJBQ3hDLENBQUM7NEJBRUQsTUFBTSxLQUFLLENBQUM7d0JBQ2IsQ0FBQztvQkFDRixDQUFDO29CQUVELDBEQUEwRDt5QkFDckQsQ0FBQzt3QkFFTCx1Q0FBdUM7d0JBQ3ZDLE1BQU0sUUFBUSxHQUFHLE1BQU0sZ0JBQWdCLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLFFBQVEsK0JBQXVCLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxFQUFFLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUV0SiwyREFBMkQ7d0JBQzNELDREQUE0RDt3QkFDNUQsMERBQTBEO3dCQUMxRCx3REFBd0Q7d0JBQ3hELDBEQUEwRDt3QkFDMUQsNEJBQTRCO3dCQUM1QixJQUFJLGdCQUFnQixDQUFDLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxDQUFDOzRCQUNwRCxPQUFPO3dCQUNSLENBQUM7NkJBQU0sQ0FBQzs0QkFDUCxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQzt3QkFDNUIsQ0FBQzt3QkFFRCxxQkFBcUI7d0JBQ3JCLElBQUksT0FBTyxFQUFFLGFBQWEsSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsV0FBVyxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7NEJBQ25HLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxpQkFBaUIsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUUsb0JBQW9CLENBQUMsUUFBUSxDQUFDLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQzt3QkFDMUksQ0FBQzs2QkFBTSxDQUFDOzRCQUNQLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLFFBQVEsRUFBRSxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO3dCQUMxSCxDQUFDO29CQUNGLENBQUM7b0JBRUQsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ2xELENBQUM7Z0JBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztvQkFDaEIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUNqRCxDQUFDO1lBQ0YsQ0FBQyxDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ3hDLENBQUMsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUN4QyxDQUFDO0lBRU8saUJBQWlCLENBQUMsSUFBMkIsRUFBRSxTQUFpQixFQUFFLE9BQTRDO1FBRXJILDBDQUEwQztRQUMxQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdEMsK0RBQStEO1FBQy9ELElBQUksU0FBUyxLQUFLLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNsQyxJQUFJLENBQUMsS0FBSyxDQUFDLHFCQUFxQixTQUFTLDZEQUE2RCxDQUFDLENBQUM7WUFDeEcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN0QixDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksQ0FBQyxLQUFLLENBQUMscUJBQXFCLFNBQVMsdUVBQXVFLENBQUMsQ0FBQztRQUNuSCxDQUFDO1FBRUQsZ0RBQWdEO1FBQ2hELElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFeEIsa0JBQWtCO1FBQ2xCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUNoRixDQUFDO0lBRU8sZUFBZSxDQUFDLEtBQVksRUFBRSxTQUFpQixFQUFFLE9BQTRDO1FBQ3BHLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLDhDQUE4QyxTQUFTLHdDQUF3QyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBRWhRLHFEQUFxRDtRQUNyRCxnQ0FBZ0M7UUFDaEMsSUFBSSxPQUFPLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUNoQyxNQUFNLEtBQUssQ0FBQztRQUNiLENBQUM7UUFFRCxrRkFBa0Y7UUFDbEYsNEVBQTRFO1FBQzVFLCtFQUErRTtRQUMvRSxrREFBa0Q7UUFDbEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVwQixzQkFBc0I7UUFDdEIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7UUFFeEIsK0JBQStCO1FBQy9CLElBQUssS0FBNEIsQ0FBQyxtQkFBbUIsb0RBQTRDLEVBQUUsQ0FBQztZQUNuRyxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQztRQUM1QixDQUFDO1FBRUQsdUNBQXVDO1FBQ3ZDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFdkMsZ0JBQWdCO1FBQ2hCLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDN0IsQ0FBQztJQUVPLGlCQUFpQixDQUFDLEtBQVksRUFBRSxPQUE0QztRQUNuRixNQUFNLGtCQUFrQixHQUFHLEtBQTJCLENBQUM7UUFDdkQsTUFBTSxjQUFjLEdBQWMsRUFBRSxDQUFDO1FBRXJDLElBQUksT0FBZSxDQUFDO1FBRXBCLHlCQUF5QjtRQUN6QixJQUFJLGtCQUFrQixDQUFDLG1CQUFtQixvREFBNEMsRUFBRSxDQUFDO1lBQ3hGLE9BQU8sR0FBRyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsOEdBQThHLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRWhLLGNBQWMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxFQUFFLDJCQUEyQixFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsSUFBSSxFQUFFLE1BQU0sNkJBQXFCLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzVNLGNBQWMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxFQUFFLHdCQUF3QixFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDaEksQ0FBQztRQUVELHVCQUF1QjthQUNsQixDQUFDO1lBQ0wsTUFBTSxhQUFhLEdBQUcsa0JBQWtCLENBQUMsbUJBQW1CLGtEQUEwQyxDQUFDO1lBQ3ZHLE1BQU0sYUFBYSxHQUFHLGFBQWEsSUFBSyxrQkFBa0IsQ0FBQyxPQUF5QyxFQUFFLE1BQU0sQ0FBQztZQUM3RyxNQUFNLGtCQUFrQixHQUFHLGtCQUFrQixDQUFDLG1CQUFtQix1REFBK0MsQ0FBQztZQUNqSCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUU1RSxxQkFBcUI7WUFDckIsSUFBSSxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUMvQixjQUFjLENBQUMsSUFBSSxDQUFDLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3ZDLENBQUM7WUFFRCxnQkFBZ0I7WUFDaEIsSUFBSSxlQUFlLElBQUksQ0FBQyxrQkFBa0IsSUFBSSxhQUFhLENBQUMsRUFBRSxDQUFDO2dCQUM5RCxjQUFjLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztvQkFDNUIsRUFBRSxFQUFFLDhCQUE4QjtvQkFDbEMsS0FBSyxFQUFFLGFBQWEsQ0FBQyxDQUFDO3dCQUNyQixTQUFTLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsRUFBRSx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsdUJBQXVCLEVBQUUsc0JBQXNCLENBQUMsQ0FBQyxDQUFDO3dCQUNoSSxTQUFTLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLGtCQUFrQixFQUFFLGtCQUFrQixDQUFDO29CQUM3RyxHQUFHLEVBQUUsR0FBRyxFQUFFO3dCQUNULElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLE9BQU8sRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsTUFBTSw2QkFBcUIsRUFBRSxDQUFDLENBQUM7b0JBQ3pHLENBQUM7aUJBQ0QsQ0FBQyxDQUFDLENBQUM7WUFDTCxDQUFDO1lBRUQsU0FBUztpQkFDSixJQUFJLGFBQWEsRUFBRSxDQUFDO2dCQUN4QixjQUFjLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsRUFBRSx3QkFBd0IsRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsT0FBTyxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsTUFBTSw2QkFBcUIsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDbE0sQ0FBQztZQUVELFFBQVE7aUJBQ0gsQ0FBQztnQkFDTCxjQUFjLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsRUFBRSx1QkFBdUIsRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsT0FBTyxFQUFFLE1BQU0sNkJBQXFCLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3RLLENBQUM7WUFFRCxVQUFVO1lBQ1YsY0FBYyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUM7Z0JBQzVCLEVBQUUsRUFBRSx3QkFBd0I7Z0JBQzVCLEtBQUssRUFBRSxRQUFRLENBQUMsUUFBUSxFQUFFLFlBQVksQ0FBQztnQkFDdkMsR0FBRyxFQUFFLEtBQUssSUFBSSxFQUFFO29CQUNmLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQzlELElBQUksTUFBTSxFQUFFLENBQUM7d0JBQ1osTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sNkJBQXFCLEVBQUUsQ0FBQyxDQUFDO3dCQUNwRyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDOzRCQUNyQixJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsOENBQThDO3dCQUN2RixDQUFDO29CQUNGLENBQUM7Z0JBQ0YsQ0FBQzthQUNELENBQUMsQ0FBQyxDQUFDO1lBRUosU0FBUztZQUNULGNBQWMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxFQUFFLHdCQUF3QixFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFFL0gsVUFBVTtZQUNWLElBQUksYUFBYSxFQUFFLENBQUM7Z0JBQ25CLElBQUksYUFBYSxJQUFJLGVBQWUsRUFBRSxDQUFDO29CQUN0QyxPQUFPLEdBQUcsU0FBUyxDQUFDLENBQUM7d0JBQ3BCLFFBQVEsQ0FBQyx3QkFBd0IsRUFBRSxpR0FBaUcsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzt3QkFDbEosUUFBUSxDQUFDLHVCQUF1QixFQUFFLDRGQUE0RixFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDN0ksQ0FBQztxQkFBTSxDQUFDO29CQUNQLE9BQU8sR0FBRyxRQUFRLENBQUMsbUJBQW1CLEVBQUUsOEZBQThGLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNwSixDQUFDO1lBQ0YsQ0FBQztpQkFBTSxJQUFJLGVBQWUsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO2dCQUNsRCxPQUFPLEdBQUcsU0FBUyxDQUFDLENBQUM7b0JBQ3BCLFFBQVEsQ0FBQywyQkFBMkIsRUFBRSxvR0FBb0csRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztvQkFDeEosUUFBUSxDQUFDLCtCQUErQixFQUFFLCtGQUErRixFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN4SixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsT0FBTyxHQUFHLFFBQVEsQ0FBQyxFQUFFLEdBQUcsRUFBRSxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsQ0FBQyxtRUFBbUUsQ0FBQyxFQUFFLEVBQUUsMkJBQTJCLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDdk0sQ0FBQztRQUNGLENBQUM7UUFFRCxtQ0FBbUM7UUFDbkMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDLEVBQUUsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVySyxrREFBa0Q7UUFDbEQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQy9HLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBRU8sMEJBQTBCLENBQUMsV0FBa0M7UUFDcEUsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBRXRDLDRCQUE0QjtRQUM1QixJQUFJLENBQUMsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFDaEMsSUFBSSxDQUFDLG9CQUFvQixHQUFHLFdBQVcsQ0FBQztRQUN6QyxDQUFDO1FBRUQscUVBQXFFO1FBQ3JFLDRCQUE0QjtRQUM1QixxRUFBcUU7UUFDckUscUVBQXFFO1FBQ3JFLFFBQVE7YUFDSCxJQUFJLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLElBQUksV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQy9ELElBQUksQ0FBQyxvQkFBb0IsR0FBRyxXQUFXLENBQUM7UUFDekMsQ0FBQztRQUVELCtEQUErRDthQUMxRCxDQUFDO1lBQ0wsSUFBSSxDQUFDLG9CQUFvQixHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsUUFBUSxFQUFFLFdBQVcsQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUMxSCxDQUFDO1FBRUQseUNBQXlDO1FBQ3pDLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxLQUFLLFdBQVcsRUFBRSxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNsQyxDQUFDO0lBQ0YsQ0FBQztJQUVELFlBQVk7SUFFWixnQkFBZ0I7SUFFaEIsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUF3QjtRQUNwQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDNUQsT0FBTyxDQUFDLHVEQUF1RDtRQUNoRSxDQUFDO1FBRUQsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUV2QixjQUFjO1FBQ2QsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUM1QixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTVDLDZDQUE2QztRQUM3QyxNQUFNLFFBQVEsR0FBRyxPQUFPLEVBQUUsSUFBSSxDQUFDO1FBQy9CLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQztnQkFDSixNQUFNLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1lBQ25DLENBQUM7WUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO2dCQUVoQixrRUFBa0U7Z0JBQ2xFLElBQUssS0FBNEIsQ0FBQyxtQkFBbUIsK0NBQXVDLEVBQUUsQ0FBQztvQkFFOUYseUVBQXlFO29CQUN6RSxZQUFZLEVBQUUsQ0FBQztvQkFFZixNQUFNLEtBQUssQ0FBQztnQkFDYixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFFRCx5QkFBeUI7UUFDekIsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUV6QiwwQkFBMEI7UUFDMUIsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNkLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUMvQixDQUFDO0lBQ0YsQ0FBQztJQVNELFFBQVEsQ0FBQyxLQUFpQztRQUN6QyxRQUFRLEtBQUssRUFBRSxDQUFDO1lBQ2Y7Z0JBQ0MsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDO1lBQzVCO2dCQUNDLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQztZQUNuQjtnQkFDQyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUM7WUFDekI7Z0JBQ0MsT0FBTyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDMUI7Z0JBQ0MsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDNUM7Z0JBQ0MsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDckIsQ0FBQztJQUNGLENBQUM7SUFFRCxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQThDO1FBQzdELE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQztJQUN4QyxDQUFDO0lBRUQsWUFBWTtJQUVaLG1CQUFtQjtJQUVuQixVQUFVO1FBQ1QsT0FBTyxJQUFJLENBQUMseUJBQXlCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7SUFDNUYsQ0FBQztJQUVPLEtBQUssQ0FBQyxHQUFXO1FBQ3hCLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLDhCQUE4QixHQUFHLEVBQUUsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNuRyxDQUFDO0lBRUQsWUFBWTtJQUVaLGlCQUFpQjtJQUVSLE9BQU87UUFDZixJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRXhCLFFBQVE7UUFDUixJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQztRQUM1QixJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQztRQUV6Qix1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLE1BQU0sR0FBRyxTQUFTLENBQUM7UUFFeEIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2pCLENBQUM7O0FBbGhDVyxxQkFBcUI7SUFzQy9CLFdBQUEsWUFBWSxDQUFBO0lBQ1osV0FBQSxXQUFXLENBQUE7SUFDWCxXQUFBLHVCQUF1QixDQUFBO0lBQ3ZCLFdBQUEsMEJBQTBCLENBQUE7SUFDMUIsV0FBQSx5QkFBeUIsQ0FBQTtJQUN6QixZQUFBLG1CQUFtQixDQUFBO0lBQ25CLFlBQUEsb0JBQW9CLENBQUE7SUFDcEIsWUFBQSx5QkFBeUIsQ0FBQTtJQUN6QixZQUFBLGNBQWMsQ0FBQTtJQUNkLFlBQUEsb0JBQW9CLENBQUE7SUFDcEIsWUFBQSxnQkFBZ0IsQ0FBQTtHQWhETixxQkFBcUIsQ0FxaENqQyJ9