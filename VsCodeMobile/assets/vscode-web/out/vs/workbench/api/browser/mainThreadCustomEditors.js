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
var MainThreadCustomEditorModel_1;
import { multibyteAwareBtoa } from '../../../base/common/strings.js';
import { createCancelablePromise } from '../../../base/common/async.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { isCancellationError, onUnexpectedError } from '../../../base/common/errors.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../base/common/lifecycle.js';
import { Schemas } from '../../../base/common/network.js';
import { basename } from '../../../base/common/path.js';
import { isEqual, isEqualOrParent, toLocalResource } from '../../../base/common/resources.js';
import { URI } from '../../../base/common/uri.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { localize } from '../../../nls.js';
import { IFileDialogService } from '../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../platform/label/common/label.js';
import { IStorageService } from '../../../platform/storage/common/storage.js';
import { IUndoRedoService } from '../../../platform/undoRedo/common/undoRedo.js';
import { reviveWebviewExtension } from './mainThreadWebviews.js';
import * as extHostProtocol from '../common/extHost.protocol.js';
import { CustomEditorInput } from '../../contrib/customEditor/browser/customEditorInput.js';
import { ICustomEditorService } from '../../contrib/customEditor/common/customEditor.js';
import { CustomTextEditorModel } from '../../contrib/customEditor/common/customTextEditorModel.js';
import { ExtensionKeyedWebviewOriginStore } from '../../contrib/webview/browser/webview.js';
import { IWebviewWorkbenchService } from '../../contrib/webviewPanel/browser/webviewWorkbenchService.js';
import { editorGroupToColumn } from '../../services/editor/common/editorGroupColumn.js';
import { IEditorGroupsService } from '../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../services/environment/common/environmentService.js';
import { IExtensionService } from '../../services/extensions/common/extensions.js';
import { IPathService } from '../../services/path/common/pathService.js';
import { ResourceWorkingCopy } from '../../services/workingCopy/common/resourceWorkingCopy.js';
import { NO_TYPE_ID } from '../../services/workingCopy/common/workingCopy.js';
import { IWorkingCopyFileService } from '../../services/workingCopy/common/workingCopyFileService.js';
import { IWorkingCopyService } from '../../services/workingCopy/common/workingCopyService.js';
import { IUriIdentityService } from '../../../platform/uriIdentity/common/uriIdentity.js';
var CustomEditorModelType;
(function (CustomEditorModelType) {
    CustomEditorModelType[CustomEditorModelType["Custom"] = 0] = "Custom";
    CustomEditorModelType[CustomEditorModelType["Text"] = 1] = "Text";
})(CustomEditorModelType || (CustomEditorModelType = {}));
let MainThreadCustomEditors = class MainThreadCustomEditors extends Disposable {
    constructor(context, mainThreadWebview, mainThreadWebviewPanels, extensionService, storageService, workingCopyService, workingCopyFileService, _customEditorService, _editorGroupService, _editorService, _instantiationService, _webviewWorkbenchService, _uriIdentityService) {
        super();
        this.mainThreadWebview = mainThreadWebview;
        this.mainThreadWebviewPanels = mainThreadWebviewPanels;
        this._customEditorService = _customEditorService;
        this._editorGroupService = _editorGroupService;
        this._editorService = _editorService;
        this._instantiationService = _instantiationService;
        this._webviewWorkbenchService = _webviewWorkbenchService;
        this._uriIdentityService = _uriIdentityService;
        this._editorProviders = this._register(new DisposableMap());
        this._editorRenameBackups = new Map();
        this._webviewOriginStore = new ExtensionKeyedWebviewOriginStore('mainThreadCustomEditors.origins', storageService);
        this._proxyCustomEditors = context.getProxy(extHostProtocol.ExtHostContext.ExtHostCustomEditors);
        this._register(workingCopyFileService.registerWorkingCopyProvider((editorResource) => {
            const matchedWorkingCopies = [];
            for (const workingCopy of workingCopyService.workingCopies) {
                if (workingCopy instanceof MainThreadCustomEditorModel) {
                    if (isEqualOrParent(editorResource, workingCopy.editorResource)) {
                        matchedWorkingCopies.push(workingCopy);
                    }
                }
            }
            return matchedWorkingCopies;
        }));
        // This reviver's only job is to activate custom editor extensions.
        this._register(_webviewWorkbenchService.registerResolver({
            canResolve: (webview) => {
                if (webview instanceof CustomEditorInput) {
                    extensionService.activateByEvent(`onCustomEditor:${webview.viewType}`);
                }
                return false;
            },
            resolveWebview: () => { throw new Error('not implemented'); }
        }));
        // Working copy operations
        this._register(workingCopyFileService.onWillRunWorkingCopyFileOperation(async (e) => this.onWillRunWorkingCopyFileOperation(e)));
    }
    $registerTextEditorProvider(extensionData, viewType, options, capabilities, serializeBuffersForPostMessage) {
        this.registerEditorProvider(1 /* CustomEditorModelType.Text */, reviveWebviewExtension(extensionData), viewType, options, capabilities, true, serializeBuffersForPostMessage);
    }
    $registerCustomEditorProvider(extensionData, viewType, options, supportsMultipleEditorsPerDocument, serializeBuffersForPostMessage) {
        this.registerEditorProvider(0 /* CustomEditorModelType.Custom */, reviveWebviewExtension(extensionData), viewType, options, {}, supportsMultipleEditorsPerDocument, serializeBuffersForPostMessage);
    }
    registerEditorProvider(modelType, extension, viewType, options, capabilities, supportsMultipleEditorsPerDocument, serializeBuffersForPostMessage) {
        if (this._editorProviders.has(viewType)) {
            throw new Error(`Provider for ${viewType} already registered`);
        }
        const disposables = new DisposableStore();
        disposables.add(this._customEditorService.registerCustomEditorCapabilities(viewType, {
            supportsMultipleEditorsPerDocument
        }));
        disposables.add(this._webviewWorkbenchService.registerResolver({
            canResolve: (webviewInput) => {
                return webviewInput instanceof CustomEditorInput && webviewInput.viewType === viewType;
            },
            resolveWebview: async (webviewInput, cancellation) => {
                const handle = generateUuid();
                const resource = webviewInput.resource;
                webviewInput.webview.origin = this._webviewOriginStore.getOrigin(viewType, extension.id);
                this.mainThreadWebviewPanels.addWebviewInput(handle, webviewInput, { serializeBuffersForPostMessage });
                webviewInput.webview.options = options;
                webviewInput.webview.extension = extension;
                // If there's an old resource this was a move and we must resolve the backup at the same time as the webview
                // This is because the backup must be ready upon model creation, and the input resolve method comes after
                let backupId = webviewInput.backupId;
                if (webviewInput.oldResource && !webviewInput.backupId) {
                    const backup = this._editorRenameBackups.get(webviewInput.oldResource.toString());
                    backupId = backup?.backupId;
                    this._editorRenameBackups.delete(webviewInput.oldResource.toString());
                }
                let modelRef;
                try {
                    modelRef = await this.getOrCreateCustomEditorModel(modelType, resource, viewType, { backupId }, cancellation);
                }
                catch (error) {
                    onUnexpectedError(error);
                    webviewInput.webview.setHtml(this.mainThreadWebview.getWebviewResolvedFailedContent(viewType));
                    return;
                }
                if (cancellation.isCancellationRequested) {
                    modelRef.dispose();
                    return;
                }
                const disposeSub = webviewInput.webview.onDidDispose(() => {
                    disposeSub.dispose();
                    // If the model is still dirty, make sure we have time to save it
                    if (modelRef.object.isDirty()) {
                        const sub = modelRef.object.onDidChangeDirty(() => {
                            if (!modelRef.object.isDirty()) {
                                sub.dispose();
                                modelRef.dispose();
                            }
                        });
                        return;
                    }
                    modelRef.dispose();
                });
                if (capabilities.supportsMove) {
                    webviewInput.onMove(async (newResource) => {
                        const oldModel = modelRef;
                        modelRef = await this.getOrCreateCustomEditorModel(modelType, newResource, viewType, {}, CancellationToken.None);
                        this._proxyCustomEditors.$onMoveCustomEditor(handle, newResource, viewType);
                        oldModel.dispose();
                    });
                }
                try {
                    const actualResource = modelType === 1 /* CustomEditorModelType.Text */ ? this._uriIdentityService.asCanonicalUri(resource) : resource;
                    await this._proxyCustomEditors.$resolveCustomEditor(actualResource, handle, viewType, {
                        title: webviewInput.getTitle(),
                        contentOptions: webviewInput.webview.contentOptions,
                        options: webviewInput.webview.options,
                        active: webviewInput === this._editorService.activeEditor,
                    }, editorGroupToColumn(this._editorGroupService, webviewInput.group || 0), cancellation);
                }
                catch (error) {
                    onUnexpectedError(error);
                    webviewInput.webview.setHtml(this.mainThreadWebview.getWebviewResolvedFailedContent(viewType));
                    modelRef.dispose();
                    return;
                }
            }
        }));
        this._editorProviders.set(viewType, disposables);
    }
    $unregisterEditorProvider(viewType) {
        if (!this._editorProviders.has(viewType)) {
            throw new Error(`No provider for ${viewType} registered`);
        }
        this._editorProviders.deleteAndDispose(viewType);
        this._customEditorService.models.disposeAllModelsForView(viewType);
    }
    async getOrCreateCustomEditorModel(modelType, resource, viewType, options, cancellation) {
        const existingModel = this._customEditorService.models.tryRetain(resource, viewType);
        if (existingModel) {
            return existingModel;
        }
        switch (modelType) {
            case 1 /* CustomEditorModelType.Text */:
                {
                    const model = CustomTextEditorModel.create(this._instantiationService, viewType, resource);
                    return this._customEditorService.models.add(resource, viewType, model);
                }
            case 0 /* CustomEditorModelType.Custom */:
                {
                    const model = MainThreadCustomEditorModel.create(this._instantiationService, this._proxyCustomEditors, viewType, resource, options, () => {
                        return Array.from(this.mainThreadWebviewPanels.webviewInputs)
                            .filter(editor => editor instanceof CustomEditorInput && isEqual(editor.resource, resource));
                    }, cancellation);
                    return this._customEditorService.models.add(resource, viewType, model);
                }
        }
    }
    async $onDidEdit(resourceComponents, viewType, editId, label) {
        const model = await this.getCustomEditorModel(resourceComponents, viewType);
        model.pushEdit(editId, label);
    }
    async $onContentChange(resourceComponents, viewType) {
        const model = await this.getCustomEditorModel(resourceComponents, viewType);
        model.changeContent();
    }
    async getCustomEditorModel(resourceComponents, viewType) {
        const resource = URI.revive(resourceComponents);
        const model = await this._customEditorService.models.get(resource, viewType);
        if (!model || !(model instanceof MainThreadCustomEditorModel)) {
            throw new Error('Could not find model for webview editor');
        }
        return model;
    }
    //#region Working Copy
    async onWillRunWorkingCopyFileOperation(e) {
        if (e.operation !== 2 /* FileOperation.MOVE */) {
            return;
        }
        e.waitUntil((async () => {
            const models = [];
            for (const file of e.files) {
                if (file.source) {
                    models.push(...(await this._customEditorService.models.getAllModels(file.source)));
                }
            }
            for (const model of models) {
                if (model instanceof MainThreadCustomEditorModel && model.isDirty()) {
                    const workingCopy = await model.backup(CancellationToken.None);
                    if (workingCopy.meta) {
                        // This cast is safe because we do an instanceof check above and a custom document backup data is always returned
                        this._editorRenameBackups.set(model.editorResource.toString(), workingCopy.meta);
                    }
                }
            }
        })());
    }
};
MainThreadCustomEditors = __decorate([
    __param(3, IExtensionService),
    __param(4, IStorageService),
    __param(5, IWorkingCopyService),
    __param(6, IWorkingCopyFileService),
    __param(7, ICustomEditorService),
    __param(8, IEditorGroupsService),
    __param(9, IEditorService),
    __param(10, IInstantiationService),
    __param(11, IWebviewWorkbenchService),
    __param(12, IUriIdentityService)
], MainThreadCustomEditors);
export { MainThreadCustomEditors };
var HotExitState;
(function (HotExitState) {
    let Type;
    (function (Type) {
        Type[Type["Allowed"] = 0] = "Allowed";
        Type[Type["NotAllowed"] = 1] = "NotAllowed";
        Type[Type["Pending"] = 2] = "Pending";
    })(Type = HotExitState.Type || (HotExitState.Type = {}));
    HotExitState.Allowed = Object.freeze({ type: 0 /* Type.Allowed */ });
    HotExitState.NotAllowed = Object.freeze({ type: 1 /* Type.NotAllowed */ });
    class Pending {
        constructor(operation) {
            this.operation = operation;
            this.type = 2 /* Type.Pending */;
        }
    }
    HotExitState.Pending = Pending;
})(HotExitState || (HotExitState = {}));
let MainThreadCustomEditorModel = MainThreadCustomEditorModel_1 = class MainThreadCustomEditorModel extends ResourceWorkingCopy {
    static async create(instantiationService, proxy, viewType, resource, options, getEditors, cancellation) {
        const editors = getEditors();
        let untitledDocumentData;
        if (editors.length !== 0) {
            untitledDocumentData = editors[0].untitledDocumentData;
        }
        const { editable } = await proxy.$createCustomDocument(resource, viewType, options.backupId, untitledDocumentData, cancellation);
        return instantiationService.createInstance(MainThreadCustomEditorModel_1, proxy, viewType, resource, !!options.backupId, editable, !!untitledDocumentData, getEditors);
    }
    constructor(_proxy, _viewType, _editorResource, fromBackup, _editable, startDirty, _getEditors, _fileDialogService, fileService, _labelService, _undoService, _environmentService, workingCopyService, _pathService, extensionService) {
        super(MainThreadCustomEditorModel_1.toWorkingCopyResource(_viewType, _editorResource), fileService);
        this._proxy = _proxy;
        this._viewType = _viewType;
        this._editorResource = _editorResource;
        this._editable = _editable;
        this._getEditors = _getEditors;
        this._fileDialogService = _fileDialogService;
        this._labelService = _labelService;
        this._undoService = _undoService;
        this._environmentService = _environmentService;
        this._pathService = _pathService;
        this._fromBackup = false;
        this._hotExitState = HotExitState.Allowed;
        this._currentEditIndex = -1;
        this._savePoint = -1;
        this._edits = [];
        this._isDirtyFromContentChange = false;
        // TODO@mjbvz consider to enable a `typeId` that is specific for custom
        // editors. Using a distinct `typeId` allows the working copy to have
        // any resource (including file based resources) even if other working
        // copies exist with the same resource.
        //
        // IMPORTANT: changing the `typeId` has an impact on backups for this
        // working copy. Any value that is not the empty string will be used
        // as seed to the backup. Only change the `typeId` if you have implemented
        // a fallback solution to resolve any existing backups that do not have
        // this seed.
        this.typeId = NO_TYPE_ID;
        this._onDidChangeDirty = this._register(new Emitter());
        this.onDidChangeDirty = this._onDidChangeDirty.event;
        this._onDidChangeContent = this._register(new Emitter());
        this.onDidChangeContent = this._onDidChangeContent.event;
        this._onDidSave = this._register(new Emitter());
        this.onDidSave = this._onDidSave.event;
        this.onDidChangeReadonly = Event.None;
        this._fromBackup = fromBackup;
        if (_editable) {
            this._register(workingCopyService.registerWorkingCopy(this));
            this._register(extensionService.onWillStop(e => {
                e.veto(true, localize('vetoExtHostRestart', "An extension provided editor for '{0}' is still open that would close otherwise.", this.name));
            }));
        }
        // Normally means we're re-opening an untitled file
        if (startDirty) {
            this._isDirtyFromContentChange = true;
        }
    }
    get editorResource() {
        return this._editorResource;
    }
    dispose() {
        if (this._editable) {
            this._undoService.removeElements(this._editorResource);
        }
        this._proxy.$disposeCustomDocument(this._editorResource, this._viewType);
        super.dispose();
    }
    //#region IWorkingCopy
    // Make sure each custom editor has a unique resource for backup and edits
    static toWorkingCopyResource(viewType, resource) {
        const authority = viewType.replace(/[^a-z0-9\-_]/gi, '-');
        const path = `/${multibyteAwareBtoa(resource.with({ query: null, fragment: null }).toString(true))}`;
        return URI.from({
            scheme: Schemas.vscodeCustomEditor,
            authority: authority,
            path: path,
            query: JSON.stringify(resource.toJSON()),
        });
    }
    get name() {
        return basename(this._labelService.getUriLabel(this._editorResource));
    }
    get capabilities() {
        return this.isUntitled() ? 2 /* WorkingCopyCapabilities.Untitled */ : 0 /* WorkingCopyCapabilities.None */;
    }
    isDirty() {
        if (this._isDirtyFromContentChange) {
            return true;
        }
        if (this._edits.length > 0) {
            return this._savePoint !== this._currentEditIndex;
        }
        return this._fromBackup;
    }
    isUntitled() {
        return this._editorResource.scheme === Schemas.untitled;
    }
    //#endregion
    isReadonly() {
        return !this._editable;
    }
    get viewType() {
        return this._viewType;
    }
    get backupId() {
        return this._backupId;
    }
    pushEdit(editId, label) {
        if (!this._editable) {
            throw new Error('Document is not editable');
        }
        this.change(() => {
            this.spliceEdits(editId);
            this._currentEditIndex = this._edits.length - 1;
        });
        this._undoService.pushElement({
            type: 0 /* UndoRedoElementType.Resource */,
            resource: this._editorResource,
            label: label ?? localize('defaultEditLabel', "Edit"),
            code: 'undoredo.customEditorEdit',
            undo: () => this.undo(),
            redo: () => this.redo(),
        });
    }
    changeContent() {
        this.change(() => {
            this._isDirtyFromContentChange = true;
        });
    }
    async undo() {
        if (!this._editable) {
            return;
        }
        if (this._currentEditIndex < 0) {
            // nothing to undo
            return;
        }
        const undoneEdit = this._edits[this._currentEditIndex];
        this.change(() => {
            --this._currentEditIndex;
        });
        await this._proxy.$undo(this._editorResource, this.viewType, undoneEdit, this.isDirty());
    }
    async redo() {
        if (!this._editable) {
            return;
        }
        if (this._currentEditIndex >= this._edits.length - 1) {
            // nothing to redo
            return;
        }
        const redoneEdit = this._edits[this._currentEditIndex + 1];
        this.change(() => {
            ++this._currentEditIndex;
        });
        await this._proxy.$redo(this._editorResource, this.viewType, redoneEdit, this.isDirty());
    }
    spliceEdits(editToInsert) {
        const start = this._currentEditIndex + 1;
        const toRemove = this._edits.length - this._currentEditIndex;
        const removedEdits = typeof editToInsert === 'number'
            ? this._edits.splice(start, toRemove, editToInsert)
            : this._edits.splice(start, toRemove);
        if (removedEdits.length) {
            this._proxy.$disposeEdits(this._editorResource, this._viewType, removedEdits);
        }
    }
    change(makeEdit) {
        const wasDirty = this.isDirty();
        makeEdit();
        this._onDidChangeContent.fire();
        if (this.isDirty() !== wasDirty) {
            this._onDidChangeDirty.fire();
        }
    }
    async revert(options) {
        if (!this._editable) {
            return;
        }
        if (this._currentEditIndex === this._savePoint && !this._isDirtyFromContentChange && !this._fromBackup) {
            return;
        }
        if (!options?.soft) {
            this._proxy.$revert(this._editorResource, this.viewType, CancellationToken.None);
        }
        this.change(() => {
            this._isDirtyFromContentChange = false;
            this._fromBackup = false;
            this._currentEditIndex = this._savePoint;
            this.spliceEdits();
        });
    }
    async save(options) {
        const result = !!await this.saveCustomEditor(options);
        // Emit Save Event
        if (result) {
            this._onDidSave.fire({ reason: options?.reason, source: options?.source });
        }
        return result;
    }
    async saveCustomEditor(options) {
        if (!this._editable) {
            return undefined;
        }
        if (this.isUntitled()) {
            const targetUri = await this.suggestUntitledSavePath(options);
            if (!targetUri) {
                return undefined;
            }
            await this.saveCustomEditorAs(this._editorResource, targetUri, options);
            return targetUri;
        }
        const savePromise = createCancelablePromise(token => this._proxy.$onSave(this._editorResource, this.viewType, token));
        this._ongoingSave?.cancel();
        this._ongoingSave = savePromise;
        try {
            await savePromise;
            if (this._ongoingSave === savePromise) { // Make sure we are still doing the same save
                this.change(() => {
                    this._isDirtyFromContentChange = false;
                    this._savePoint = this._currentEditIndex;
                    this._fromBackup = false;
                });
            }
        }
        finally {
            if (this._ongoingSave === savePromise) { // Make sure we are still doing the same save
                this._ongoingSave = undefined;
            }
        }
        return this._editorResource;
    }
    suggestUntitledSavePath(options) {
        if (!this.isUntitled()) {
            throw new Error('Resource is not untitled');
        }
        const remoteAuthority = this._environmentService.remoteAuthority;
        const localResource = toLocalResource(this._editorResource, remoteAuthority, this._pathService.defaultUriScheme);
        return this._fileDialogService.pickFileToSave(localResource, options?.availableFileSystems);
    }
    async saveCustomEditorAs(resource, targetResource, _options) {
        if (this._editable) {
            // TODO: handle cancellation
            await createCancelablePromise(token => this._proxy.$onSaveAs(this._editorResource, this.viewType, targetResource, token));
            this.change(() => {
                this._savePoint = this._currentEditIndex;
            });
            return true;
        }
        else {
            // Since the editor is readonly, just copy the file over
            await this.fileService.copy(resource, targetResource, false /* overwrite */);
            return true;
        }
    }
    get canHotExit() { return typeof this._backupId === 'string' && this._hotExitState.type === 0 /* HotExitState.Type.Allowed */; }
    async backup(token) {
        const editors = this._getEditors();
        if (!editors.length) {
            throw new Error('No editors found for resource, cannot back up');
        }
        const primaryEditor = editors[0];
        const backupMeta = {
            viewType: this.viewType,
            editorResource: this._editorResource,
            customTitle: primaryEditor.getWebviewTitle(),
            iconPath: primaryEditor.iconPath,
            backupId: '',
            extension: primaryEditor.extension ? {
                id: primaryEditor.extension.id.value,
                location: primaryEditor.extension.location,
            } : undefined,
            webview: {
                origin: primaryEditor.webview.origin,
                options: primaryEditor.webview.options,
                state: primaryEditor.webview.state,
            }
        };
        const backupData = {
            meta: backupMeta
        };
        if (!this._editable) {
            return backupData;
        }
        if (this._hotExitState.type === 2 /* HotExitState.Type.Pending */) {
            this._hotExitState.operation.cancel();
        }
        const pendingState = new HotExitState.Pending(createCancelablePromise(token => this._proxy.$backup(this._editorResource.toJSON(), this.viewType, token)));
        this._hotExitState = pendingState;
        token.onCancellationRequested(() => {
            pendingState.operation.cancel();
        });
        let errorMessage = '';
        try {
            const backupId = await pendingState.operation;
            // Make sure state has not changed in the meantime
            if (this._hotExitState === pendingState) {
                this._hotExitState = HotExitState.Allowed;
                backupData.meta.backupId = backupId;
                this._backupId = backupId;
            }
        }
        catch (e) {
            if (isCancellationError(e)) {
                // This is expected
                throw e;
            }
            // Otherwise it could be a real error. Make sure state has not changed in the meantime.
            if (this._hotExitState === pendingState) {
                this._hotExitState = HotExitState.NotAllowed;
            }
            if (e.message) {
                errorMessage = e.message;
            }
        }
        if (this._hotExitState === HotExitState.Allowed) {
            return backupData;
        }
        throw new Error(`Cannot backup in this state: ${errorMessage}`);
    }
};
MainThreadCustomEditorModel = MainThreadCustomEditorModel_1 = __decorate([
    __param(7, IFileDialogService),
    __param(8, IFileService),
    __param(9, ILabelService),
    __param(10, IUndoRedoService),
    __param(11, IWorkbenchEnvironmentService),
    __param(12, IWorkingCopyService),
    __param(13, IPathService),
    __param(14, IExtensionService)
], MainThreadCustomEditorModel);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZEN1c3RvbUVkaXRvcnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9icm93c2VyL21haW5UaHJlYWRDdXN0b21FZGl0b3JzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNyRSxPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFM0YsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDekUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDeEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQWMsTUFBTSxtQ0FBbUMsQ0FBQztBQUMzRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDMUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3hELE9BQU8sRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzlGLE9BQU8sRUFBRSxHQUFHLEVBQWlCLE1BQU0sNkJBQTZCLENBQUM7QUFDakUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQzVELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMzQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUNqRixPQUFPLEVBQWlCLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3RGLE9BQU8sRUFB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