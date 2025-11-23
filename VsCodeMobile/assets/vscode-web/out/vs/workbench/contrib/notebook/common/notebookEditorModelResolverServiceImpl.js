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
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { URI } from '../../../../base/common/uri.js';
import { CellUri, NotebookSetting, NotebookWorkingCopyTypeIdentifier } from './notebookCommon.js';
import { NotebookFileWorkingCopyModelFactory, SimpleNotebookEditorModel } from './notebookEditorModel.js';
import { combinedDisposable, DisposableStore, dispose, ReferenceCollection, toDisposable } from '../../../../base/common/lifecycle.js';
import { INotebookService } from './notebookService.js';
import { AsyncEmitter, Emitter } from '../../../../base/common/event.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { FileWorkingCopyManager } from '../../../services/workingCopy/common/fileWorkingCopyManager.js';
import { Schemas } from '../../../../base/common/network.js';
import { NotebookProviderInfo } from './notebookProvider.js';
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { INotebookLoggingService } from './notebookLoggingService.js';
import { parse } from '../../../services/notebook/common/notebookDocumentService.js';
let NotebookModelReferenceCollection = class NotebookModelReferenceCollection extends ReferenceCollection {
    constructor(_instantiationService, _notebookService, _configurationService, _telemetryService, _notebookLoggingService) {
        super();
        this._instantiationService = _instantiationService;
        this._notebookService = _notebookService;
        this._configurationService = _configurationService;
        this._telemetryService = _telemetryService;
        this._notebookLoggingService = _notebookLoggingService;
        this._disposables = new DisposableStore();
        this._workingCopyManagers = new Map();
        this._modelListener = new Map();
        this._onDidSaveNotebook = new Emitter();
        this.onDidSaveNotebook = this._onDidSaveNotebook.event;
        this._onDidChangeDirty = new Emitter();
        this.onDidChangeDirty = this._onDidChangeDirty.event;
        this._dirtyStates = new ResourceMap();
        this.modelsToDispose = new Set();
    }
    dispose() {
        this._disposables.dispose();
        this._onDidSaveNotebook.dispose();
        this._onDidChangeDirty.dispose();
        dispose(this._modelListener.values());
        dispose(this._workingCopyManagers.values());
    }
    isDirty(resource) {
        return this._dirtyStates.get(resource) ?? false;
    }
    isListeningToModel(uri) {
        for (const key of this._modelListener.keys()) {
            if (key.resource.toString() === uri.toString()) {
                return true;
            }
        }
        return false;
    }
    async createReferencedObject(key, notebookType, hasAssociatedFilePath, limits, isScratchpad, viewType) {
        // Untrack as being disposed
        this.modelsToDispose.delete(key);
        const uri = URI.parse(key);
        const workingCopyTypeId = NotebookWorkingCopyTypeIdentifier.create(notebookType, viewType);
        let workingCopyManager = this._workingCopyManagers.get(workingCopyTypeId);
        if (!workingCopyManager) {
            const factory = new NotebookFileWorkingCopyModelFactory(notebookType, this._notebookService, this._configurationService, this._telemetryService, this._notebookLoggingService);
            workingCopyManager = this._instantiationService.createInstance((FileWorkingCopyManager), workingCopyTypeId, factory, factory);
            this._workingCopyManagers.set(workingCopyTypeId, workingCopyManager);
        }
        const isScratchpadView = isScratchpad || (notebookType === 'interactive' && this._configurationService.getValue(NotebookSetting.InteractiveWindowPromptToSave) !== true);
        const model = this._instantiationService.createInstance(SimpleNotebookEditorModel, uri, hasAssociatedFilePath, notebookType, workingCopyManager, isScratchpadView);
        const result = await model.load({ limits });
        // Whenever a notebook model is dirty we automatically reference it so that
        // we can ensure that at least one reference exists. That guarantees that
        // a model with unsaved changes is never disposed.
        let onDirtyAutoReference;
        this._modelListener.set(result, combinedDisposable(result.onDidSave(() => this._onDidSaveNotebook.fire(result.resource)), result.onDidChangeDirty(() => {
            const isDirty = result.isDirty();
            this._dirtyStates.set(result.resource, isDirty);
            // isDirty -> add reference
            // !isDirty -> free reference
            if (isDirty && !onDirtyAutoReference) {
                onDirtyAutoReference = this.acquire(key, notebookType);
            }
            else if (onDirtyAutoReference) {
                onDirtyAutoReference.dispose();
                onDirtyAutoReference = undefined;
            }
            this._onDidChangeDirty.fire(result);
        }), toDisposable(() => onDirtyAutoReference?.dispose())));
        return result;
    }
    destroyReferencedObject(key, object) {
        this.modelsToDispose.add(key);
        (async () => {
            try {
                const model = await object;
                if (!this.modelsToDispose.has(key)) {
                    // return if model has been acquired again meanwhile
                    return;
                }
                if (model instanceof SimpleNotebookEditorModel) {
                    await model.canDispose();
                }
                if (!this.modelsToDispose.has(key)) {
                    // return if model has been acquired again meanwhile
                    return;
                }
                // Finally we can dispose the model
                this._modelListener.get(model)?.dispose();
                this._modelListener.delete(model);
                model.dispose();
            }
            catch (err) {
                this._notebookLoggingService.error('NotebookModelCollection', 'FAILED to destory notebook - ' + err);
            }
            finally {
                this.modelsToDispose.delete(key); // Untrack as being disposed
            }
        })();
    }
};
NotebookModelReferenceCollection = __decorate([
    __param(0, IInstantiationService),
    __param(1, INotebookService),
    __param(2, IConfigurationService),
    __param(3, ITelemetryService),
    __param(4, INotebookLoggingService)
], NotebookModelReferenceCollection);
let NotebookModelResolverServiceImpl = class NotebookModelResolverServiceImpl {
    constructor(instantiationService, _notebookService, _extensionService, _uriIdentService) {
        this._notebookService = _notebookService;
        this._extensionService = _extensionService;
        this._uriIdentService = _uriIdentService;
        this._onWillFailWithConflict = new AsyncEmitter();
        this.onWillFailWithConflict = this._onWillFailWithConflict.event;
        this._data = instantiationService.createInstance(NotebookModelReferenceCollection);
        this.onDidSaveNotebook = this._data.onDidSaveNotebook;
        this.onDidChangeDirty = this._data.onDidChangeDirty;
    }
    dispose() {
        this._data.dispose();
    }
    isDirty(resource) {
        return this._data.isDirty(resource);
    }
    createUntitledUri(notebookType) {
        const info = this._notebookService.getContributedNotebookType(assertReturnsDefined(notebookType));
        if (!info) {
            throw new Error('UNKNOWN notebook type: ' + notebookType);
        }
        const suffix = NotebookProviderInfo.possibleFileEnding(info.selectors) ?? '';
        for (let counter = 1;; counter++) {
            const candidate = URI.from({ scheme: Schemas.untitled, path: `Untitled-${counter}${suffix}`, query: notebookType });
            if (!this._notebookService.getNotebookTextModel(candidate) && !this._data.isListeningToModel(candidate)) {
                return candidate;
            }
        }
    }
    async validateResourceViewType(uri, viewType) {
        if (!uri && !viewType) {
            throw new Error('Must provide at least one of resource or viewType');
        }
        if (uri?.scheme === CellUri.scheme) {
            const originalUri = uri;
            uri = parse(uri)?.notebook;
            if (!uri) {
                throw new Error(`CANNOT open a cell-uri as notebook. Tried with ${originalUri.toString()}`);
            }
        }
        const resource = this._uriIdentService.asCanonicalUri(uri ?? this.createUntitledUri(viewType));
        const existingNotebook = this._notebookService.getNotebookTextModel(resource);
        if (!viewType) {
            if (existingNotebook) {
                viewType = existingNotebook.viewType;
            }
            else {
                await this._extensionService.whenInstalledExtensionsRegistered();
                const providers = this._notebookService.getContributedNotebookTypes(resource);
                viewType = providers.find(provider => provider.priority === 'exclusive')?.id ??
                    providers.find(provider => provider.priority === 'default')?.id ??
                    providers[0]?.id;
            }
        }
        if (!viewType) {
            throw new Error(`Missing viewType for '${resource}'`);
        }
        if (existingNotebook && existingNotebook.viewType !== viewType) {
            await this._onWillFailWithConflict.fireAsync({ resource: resource, viewType }, CancellationToken.None);
            // check again, listener should have done cleanup
            const existingViewType2 = this._notebookService.getNotebookTextModel(resource)?.viewType;
            if (existingViewType2 && existingViewType2 !== viewType) {
                throw new Error(`A notebook with view type '${existingViewType2}' already exists for '${resource}', CANNOT create another notebook with view type ${viewType}`);
            }
        }
        return { resource, viewType };
    }
    async createUntitledNotebookTextModel(viewType) {
        const resource = this._uriIdentService.asCanonicalUri(this.createUntitledUri(viewType));
        return (await this._notebookService.createNotebookTextModel(viewType, resource));
    }
    async resolve(arg0, viewType, options) {
        let resource;
        let hasAssociatedFilePath;
        if (URI.isUri(arg0)) {
            resource = arg0;
        }
        else if (arg0.untitledResource) {
            if (arg0.untitledResource.scheme === Schemas.untitled) {
                resource = arg0.untitledResource;
            }
            else {
                resource = arg0.untitledResource.with({ scheme: Schemas.untitled });
                hasAssociatedFilePath = true;
            }
        }
        const validated = await this.validateResourceViewType(resource, viewType);
        const reference = this._data.acquire(validated.resource.toString(), validated.viewType, hasAssociatedFilePath, options?.limits, options?.scratchpad, options?.viewType);
        try {
            const model = await reference.object;
            return {
                object: model,
                dispose() { reference.dispose(); }
            };
        }
        catch (err) {
            reference.dispose();
            throw err;
        }
    }
};
NotebookModelResolverServiceImpl = __decorate([
    __param(0, IInstantiationService),
    __param(1, INotebookService),
    __param(2, IExtensionService),
    __param(3, IUriIdentityService)
], NotebookModelResolverServiceImpl);
export { NotebookModelResolverServiceImpl };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tFZGl0b3JNb2RlbFJlc29sdmVyU2VydmljZUltcGwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svY29tbW9uL25vdGVib29rRWRpdG9yTW9kZWxSZXNvbHZlclNlcnZpY2VJbXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsT0FBTyxFQUFvRSxlQUFlLEVBQUUsaUNBQWlDLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNwSyxPQUFPLEVBQWdDLG1DQUFtQyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDeEksT0FBTyxFQUFFLGtCQUFrQixFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQTJCLG1CQUFtQixFQUFFLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hLLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxZQUFZLEVBQUUsT0FBTyxFQUFTLE1BQU0sa0NBQWtDLENBQUM7QUFDaEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDdEYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFFN0YsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxzQkFBc0IsRUFBMkIsTUFBTSxnRUFBZ0UsQ0FBQztBQUNqSSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1B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