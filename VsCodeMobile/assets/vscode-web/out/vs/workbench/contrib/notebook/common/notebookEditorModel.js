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
var SimpleNotebookEditorModel_1;
import { streamToBuffer } from '../../../../base/common/buffer.js';
import { CancellationError } from '../../../../base/common/errors.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { assertType, hasKey } from '../../../../base/common/types.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { FileOperationError } from '../../../../platform/files/common/files.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { EditorModel } from '../../../common/editor/editorModel.js';
import { NotebookCellsChangeType, NotebookSetting } from './notebookCommon.js';
import { INotebookLoggingService } from './notebookLoggingService.js';
import { INotebookService, SimpleNotebookProviderInfo } from './notebookService.js';
import { IFilesConfigurationService } from '../../../services/filesConfiguration/common/filesConfigurationService.js';
//#region --- simple content provider
let SimpleNotebookEditorModel = SimpleNotebookEditorModel_1 = class SimpleNotebookEditorModel extends EditorModel {
    constructor(resource, _hasAssociatedFilePath, viewType, _workingCopyManager, scratchpad, _filesConfigurationService) {
        super();
        this.resource = resource;
        this._hasAssociatedFilePath = _hasAssociatedFilePath;
        this.viewType = viewType;
        this._workingCopyManager = _workingCopyManager;
        this._filesConfigurationService = _filesConfigurationService;
        this._onDidChangeDirty = this._register(new Emitter());
        this._onDidSave = this._register(new Emitter());
        this._onDidChangeOrphaned = this._register(new Emitter());
        this._onDidChangeReadonly = this._register(new Emitter());
        this._onDidRevertUntitled = this._register(new Emitter());
        this.onDidChangeDirty = this._onDidChangeDirty.event;
        this.onDidSave = this._onDidSave.event;
        this.onDidChangeOrphaned = this._onDidChangeOrphaned.event;
        this.onDidChangeReadonly = this._onDidChangeReadonly.event;
        this.onDidRevertUntitled = this._onDidRevertUntitled.event;
        this._workingCopyListeners = this._register(new DisposableStore());
        this.scratchPad = scratchpad;
    }
    dispose() {
        this._workingCopy?.dispose();
        super.dispose();
    }
    get notebook() {
        return this._workingCopy?.model?.notebookModel;
    }
    isResolved() {
        return Boolean(this._workingCopy?.model?.notebookModel);
    }
    async canDispose() {
        if (!this._workingCopy) {
            return true;
        }
        if (SimpleNotebookEditorModel_1._isStoredFileWorkingCopy(this._workingCopy)) {
            return this._workingCopyManager.stored.canDispose(this._workingCopy);
        }
        else {
            return true;
        }
    }
    isDirty() {
        return this._workingCopy?.isDirty() ?? false;
    }
    isModified() {
        return this._workingCopy?.isModified() ?? false;
    }
    isOrphaned() {
        return SimpleNotebookEditorModel_1._isStoredFileWorkingCopy(this._workingCopy) && this._workingCopy.hasState(4 /* StoredFileWorkingCopyState.ORPHAN */);
    }
    hasAssociatedFilePath() {
        return !SimpleNotebookEditorModel_1._isStoredFileWorkingCopy(this._workingCopy) && !!this._workingCopy?.hasAssociatedFilePath;
    }
    isReadonly() {
        if (SimpleNotebookEditorModel_1._isStoredFileWorkingCopy(this._workingCopy)) {
            return this._workingCopy?.isReadonly();
        }
        else {
            return this._filesConfigurationService.isReadonly(this.resource);
        }
    }
    get hasErrorState() {
        if (this._workingCopy && hasKey(this._workingCopy, { hasState: true })) {
            return this._workingCopy.hasState(5 /* StoredFileWorkingCopyState.ERROR */);
        }
        return false;
    }
    async revert(options) {
        assertType(this.isResolved());
        return this._workingCopy.revert(options);
    }
    async save(options) {
        assertType(this.isResolved());
        return this._workingCopy.save(options);
    }
    async load(options) {
        if (!this._workingCopy || !this._workingCopy.model) {
            if (this.resource.scheme === Schemas.untitled) {
                if (this._hasAssociatedFilePath) {
                    this._workingCopy = await this._workingCopyManager.resolve({ associatedResource: this.resource });
                }
                else {
                    this._workingCopy = await this._workingCopyManager.resolve({ untitledResource: this.resource, isScratchpad: this.scratchPad });
                }
                this._register(this._workingCopy.onDidRevert(() => this._onDidRevertUntitled.fire()));
            }
            else {
                this._workingCopy = await this._workingCopyManager.resolve(this.resource, {
                    limits: options?.limits,
                    reload: options?.forceReadFromFile ? { async: false, force: true } : undefined
                });
                this._workingCopyListeners.add(this._workingCopy.onDidSave(e => this._onDidSave.fire(e)));
                this._workingCopyListeners.add(this._workingCopy.onDidChangeOrphaned(() => this._onDidChangeOrphaned.fire()));
                this._workingCopyListeners.add(this._workingCopy.onDidChangeReadonly(() => this._onDidChangeReadonly.fire()));
            }
            this._workingCopyListeners.add(this._workingCopy.onDidChangeDirty(() => this._onDidChangeDirty.fire(), undefined));
            this._workingCopyListeners.add(this._workingCopy.onWillDispose(() => {
                this._workingCopyListeners.clear();
                this._workingCopy?.model?.dispose();
            }));
        }
        else {
            await this._workingCopyManager.resolve(this.resource, {
                reload: {
                    async: !options?.forceReadFromFile,
                    force: options?.forceReadFromFile
                },
                limits: options?.limits
            });
        }
        assertType(this.isResolved());
        return this;
    }
    async saveAs(target) {
        const newWorkingCopy = await this._workingCopyManager.saveAs(this.resource, target);
        if (!newWorkingCopy) {
            return undefined;
        }
        // this is a little hacky because we leave the new working copy alone. BUT
        // the newly created editor input will pick it up and claim ownership of it.
        return { resource: newWorkingCopy.resource };
    }
    static _isStoredFileWorkingCopy(candidate) {
        const isUntitled = candidate && candidate.capabilities & 2 /* WorkingCopyCapabilities.Untitled */;
        return !isUntitled;
    }
};
SimpleNotebookEditorModel = SimpleNotebookEditorModel_1 = __decorate([
    __param(5, IFilesConfigurationService)
], SimpleNotebookEditorModel);
export { SimpleNotebookEditorModel };
export class NotebookFileWorkingCopyModel extends Disposable {
    constructor(_notebookModel, _notebookService, _configurationService, _telemetryService, _notebookLogService) {
        super();
        this._notebookModel = _notebookModel;
        this._notebookService = _notebookService;
        this._configurationService = _configurationService;
        this._telemetryService = _telemetryService;
        this._notebookLogService = _notebookLogService;
        this._onDidChangeContent = this._register(new Emitter());
        this.onDidChangeContent = this._onDidChangeContent.event;
        this.configuration = undefined;
        this.onWillDispose = _notebookModel.onWillDispose.bind(_notebookModel);
        this._register(_notebookModel.onDidChangeContent(e => {
            for (const rawEvent of e.rawEvents) {
                if (rawEvent.kind === NotebookCellsChangeType.Initialize) {
                    continue;
                }
                if (rawEvent.transient) {
                    continue;
                }
                this._onDidChangeContent.fire({
                    isRedoing: false, //todo@rebornix forward this information from notebook model
                    isUndoing: false,
                    isInitial: false, //_notebookModel.cells.length === 0 // todo@jrieken non transient metadata?
                });
                break;
            }
        }));
        const saveWithReducedCommunication = this._configurationService.getValue(NotebookSetting.remoteSaving);
        if (saveWithReducedCommunication || _notebookModel.uri.scheme === Schemas.vscodeRemote) {
            this.configuration = {
                // Intentionally pick a larger delay for triggering backups to allow auto-save
                // to complete first on the optimized save path
                backupDelay: 10000
            };
        }
        // Override save behavior to avoid transferring the buffer across the wire 3 times
        if (saveWithReducedCommunication) {
            this.setSaveDelegate().catch(error => this._notebookLogService.error('WorkingCopyModel', `Failed to set save delegate: ${error}`));
        }
    }
    async setSaveDelegate() {
        // make sure we wait for a serializer to resolve before we try to handle saves in the EH
        await this.getNotebookSerializer();
        this.save = async (options, token) => {
            try {
                let serializer = this._notebookService.tryGetDataProviderSync(this.notebookModel.viewType)?.serializer;
                if (!serializer) {
                    this._notebookLogService.info('WorkingCopyModel', 'No serializer found for notebook model, checking if provider still needs to be resolved');
                    serializer = await this.getNotebookSerializer().catch(error => {
                        this._notebookLogService.error('WorkingCopyModel', `Failed to get notebook serializer: ${error}`);
                        // The serializer was set initially but somehow is no longer available
                        this.save = undefined;
                        throw new NotebookSaveError('Failed to get notebook serializer');
                    });
                }
                if (token.isCancellationRequested) {
                    throw new CancellationError();
                }
                const stat = await serializer.save(this._notebookModel.uri, this._notebookModel.versionId, options, token);
                return stat;
            }
            catch (error) {
                if (!token.isCancellationRequested && error.name !== 'Canceled') {
                    const isIPynb = this._notebookModel.viewType === 'jupyter-notebook' || this._notebookModel.viewType === 'interactive';
                    const errorMessage = getSaveErrorMessage(error);
                    this._telemetryService.publicLogError2('notebook/SaveError', {
                        isRemote: this._notebookModel.uri.scheme === Schemas.vscodeRemote,
                        isIPyNbWorkerSerializer: isIPynb && this._configurationService.getValue('ipynb.experimental.serialization'),
                        error: errorMessage
                    });
                }
                throw error;
            }
        };
    }
    dispose() {
        this._notebookModel.dispose();
        super.dispose();
    }
    get notebookModel() {
        return this._notebookModel;
    }
    async snapshot(context, token) {
        return this._notebookService.createNotebookTextDocumentSnapshot(this._notebookModel.uri, context, token);
    }
    async update(stream, token) {
        const serializer = await this.getNotebookSerializer();
        const bytes = await streamToBuffer(stream);
        const data = await serializer.dataToNotebook(bytes);
        if (token.isCancellationRequested) {
            throw new CancellationError();
        }
        this._notebookLogService.info('WorkingCopyModel', 'Notebook content updated from file system - ' + this._notebookModel.uri.toString());
        this._notebookModel.reset(data.cells, data.metadata, serializer.options);
    }
    async getNotebookSerializer() {
        const info = await this._notebookService.withNotebookDataProvider(this.notebookModel.viewType);
        if (!(info instanceof SimpleNotebookProviderInfo)) {
            const message = 'CANNOT open notebook with this provider';
            throw new NotebookSaveError(message);
        }
        return info.serializer;
    }
    get versionId() {
        return this._notebookModel.alternativeVersionId;
    }
    pushStackElement() {
        this._notebookModel.pushStackElement();
    }
}
let NotebookFileWorkingCopyModelFactory = class NotebookFileWorkingCopyModelFactory {
    constructor(_viewType, _notebookService, _configurationService, _telemetryService, _notebookLogService) {
        this._viewType = _viewType;
        this._notebookService = _notebookService;
        this._configurationService = _configurationService;
        this._telemetryService = _telemetryService;
        this._notebookLogService = _notebookLogService;
    }
    async createModel(resource, stream, token) {
        const notebookModel = this._notebookService.getNotebookTextModel(resource) ??
            await this._notebookService.createNotebookTextModel(this._viewType, resource, stream);
        return new NotebookFileWorkingCopyModel(notebookModel, this._notebookService, this._configurationService, this._telemetryService, this._notebookLogService);
    }
};
NotebookFileWorkingCopyModelFactory = __decorate([
    __param(1, INotebookService),
    __param(2, IConfigurationService),
    __param(3, ITelemetryService),
    __param(4, INotebookLoggingService)
], NotebookFileWorkingCopyModelFactory);
export { NotebookFileWorkingCopyModelFactory };
//#endregion
class NotebookSaveError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotebookSaveError';
    }
}
function getSaveErrorMessage(error) {
    if (error.name === 'NotebookSaveError') {
        return error.message;
    }
    else if (error instanceof FileOperationError) {
        switch (error.fileOperationResult) {
            case 0 /* FileOperationResult.FILE_IS_DIRECTORY */:
                return 'File is a directory';
            case 1 /* FileOperationResult.FILE_NOT_FOUND */:
                return 'File not found';
            case 2 /* FileOperationResult.FILE_NOT_MODIFIED_SINCE */:
                return 'File not modified since';
            case 3 /* FileOperationResult.FILE_MODIFIED_SINCE */:
                return 'File modified since';
            case 4 /* FileOperationResult.FILE_MOVE_CONFLICT */:
                return 'File move conflict';
            case 5 /* FileOperationResult.FILE_WRITE_LOCKED */:
                return 'File write locked';
            case 6 /* FileOperationResult.FILE_PERMISSION_DENIED */:
                return 'File permission denied';
            case 7 /* FileOperationResult.FILE_TOO_LARGE */:
                return 'File too large';
            case 8 /* FileOperationResult.FILE_INVALID_PATH */:
                return 'File invalid path';
            case 9 /* FileOperationResult.FILE_NOT_DIRECTORY */:
                return 'File not directory';
            case 10 /* FileOperationResult.FILE_OTHER_ERROR */:
                return 'File other error';
        }
    }
    return 'Unknown error';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tFZGl0b3JNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tFZGl0b3JNb2RlbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUEwQixjQUFjLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUUzRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sa0NBQWtDLENBQUM7QUFFbEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUV0RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQTRDLGtCQUFrQixFQUF1QixNQUFNLDRDQUE0QyxDQUFDO0FBQy9JLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBRXZGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUVwRSxPQUFPLEVBQTRFLHVCQUF1QixFQUFFLGVBQWUsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQ3pKLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3RFLE9BQU8sRUFBdUIsZ0JBQWdCLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUN6RyxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSwwRUFBMEUsQ0FBQztBQU90SCxxQ0FBcUM7QUFFOUIsSUFB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