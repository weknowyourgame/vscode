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
import { ResourceMap } from '../../../../base/common/map.js';
import { createDecorator, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { isTextFileEditorModel, ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { Disposable, DisposableMap, DisposableStore, ReferenceCollection } from '../../../../base/common/lifecycle.js';
import { IEditorWorkerService } from '../../../../editor/common/services/editorWorker.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { shouldSynchronizeModel } from '../../../../editor/common/model.js';
import { compareChanges, getModifiedEndLineNumber, IQuickDiffService } from '../common/quickDiff.js';
import { ThrottledDelayer } from '../../../../base/common/async.js';
import { ISCMService } from '../common/scm.js';
import { sortedDiff, equals } from '../../../../base/common/arrays.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { DiffState } from '../../../../editor/browser/widget/diffEditor/diffEditorViewModel.js';
import { toLineChanges } from '../../../../editor/browser/widget/diffEditor/diffEditorWidget.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { IChatEditingService } from '../../chat/common/chatEditingService.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { autorun } from '../../../../base/common/observable.js';
export const IQuickDiffModelService = createDecorator('IQuickDiffModelService');
const decoratorQuickDiffModelOptions = {
    algorithm: 'advanced',
    maxComputationTimeMs: 1000
};
let QuickDiffModelReferenceCollection = class QuickDiffModelReferenceCollection extends ReferenceCollection {
    constructor(_instantiationService) {
        super();
        this._instantiationService = _instantiationService;
    }
    createReferencedObject(_key, textFileModel, options) {
        return this._instantiationService.createInstance(QuickDiffModel, textFileModel, options);
    }
    destroyReferencedObject(_key, object) {
        object.dispose();
    }
};
QuickDiffModelReferenceCollection = __decorate([
    __param(0, IInstantiationService)
], QuickDiffModelReferenceCollection);
let QuickDiffModelService = class QuickDiffModelService {
    constructor(instantiationService, textFileService, uriIdentityService) {
        this.instantiationService = instantiationService;
        this.textFileService = textFileService;
        this.uriIdentityService = uriIdentityService;
        this._references = this.instantiationService.createInstance(QuickDiffModelReferenceCollection);
    }
    createQuickDiffModelReference(resource, options = decoratorQuickDiffModelOptions) {
        const textFileModel = this.textFileService.files.get(resource);
        if (!textFileModel?.isResolved()) {
            return undefined;
        }
        resource = this.uriIdentityService.asCanonicalUri(resource).with({ query: JSON.stringify(options) });
        return this._references.acquire(resource.toString(), textFileModel, options);
    }
};
QuickDiffModelService = __decorate([
    __param(0, IInstantiationService),
    __param(1, ITextFileService),
    __param(2, IUriIdentityService)
], QuickDiffModelService);
export { QuickDiffModelService };
let QuickDiffModel = class QuickDiffModel extends Disposable {
    get originalTextModels() {
        return Iterable.map(this._originalEditorModels.values(), editorModel => editorModel.textEditorModel);
    }
    get allChanges() { return this._allChanges; }
    get changes() { return this._changes; }
    get quickDiffChanges() { return this._quickDiffChanges; }
    constructor(textFileModel, options, scmService, quickDiffService, editorWorkerService, configurationService, textModelResolverService, _chatEditingService, progressService) {
        super();
        this.options = options;
        this.scmService = scmService;
        this.quickDiffService = quickDiffService;
        this.editorWorkerService = editorWorkerService;
        this.configurationService = configurationService;
        this.textModelResolverService = textModelResolverService;
        this._chatEditingService = _chatEditingService;
        this.progressService = progressService;
        this._originalEditorModels = new ResourceMap();
        this._originalEditorModelsDisposables = this._register(new DisposableStore());
        this._disposed = false;
        this._quickDiffs = [];
        this._diffDelayer = this._register(new ThrottledDelayer(200));
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._allChanges = [];
        this._changes = [];
        /**
         * Map of quick diff name to the index of the change in `this.changes`
         */
        this._quickDiffChanges = new Map();
        this._repositoryDisposables = new DisposableMap();
        this._model = textFileModel;
        this._register(textFileModel.textEditorModel.onDidChangeContent(() => this.triggerDiff()));
        this._register(Event.filter(configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('scm.diffDecorationsIgnoreTrimWhitespace') || e.affectsConfiguration('diffEditor.ignoreTrimWhitespace'))(this.triggerDiff, this));
        this._register(scmService.onDidAddRepository(this.onDidAddRepository, this));
        for (const r of scmService.repositories) {
            this.onDidAddRepository(r);
        }
        this._register(this._model.onDidChangeEncoding(() => {
            this._diffDelayer.cancel();
            this._quickDiffs = [];
            this._originalEditorModels.clear();
            this._quickDiffsPromise = undefined;
            this.setChanges([], [], new Map());
            this.triggerDiff();
        }));
        this._register(this.quickDiffService.onDidChangeQuickDiffProviders(() => this.triggerDiff()));
        this._register(autorun(reader => {
            for (const session of this._chatEditingService.editingSessionsObs.read(reader)) {
                reader.store.add(autorun(r => {
                    for (const entry of session.entries.read(r)) {
                        entry.state.read(r); // signal
                    }
                    this.triggerDiff();
                }));
            }
        }));
        this.triggerDiff();
    }
    get quickDiffs() {
        return this._quickDiffs;
    }
    getQuickDiffResults() {
        return this._quickDiffs.map(quickDiff => {
            const changes = this.allChanges
                .filter(change => change.providerId === quickDiff.id);
            return {
                original: quickDiff.originalResource,
                modified: this._model.resource,
                changes: changes.map(change => change.change),
                changes2: changes.map(change => change.change2)
            };
        });
    }
    getDiffEditorModel(originalUri) {
        const editorModel = this._originalEditorModels.get(originalUri);
        return editorModel ?
            {
                modified: this._model.textEditorModel,
                original: editorModel.textEditorModel
            } : undefined;
    }
    onDidAddRepository(repository) {
        const disposables = new DisposableStore();
        disposables.add(repository.provider.onDidChangeResources(this.triggerDiff, this));
        const onDidRemoveRepository = Event.filter(this.scmService.onDidRemoveRepository, r => r === repository);
        disposables.add(onDidRemoveRepository(() => this._repositoryDisposables.deleteAndDispose(repository)));
        this._repositoryDisposables.set(repository, disposables);
        this.triggerDiff();
    }
    triggerDiff() {
        if (!this._diffDelayer) {
            return;
        }
        this._diffDelayer
            .trigger(async () => {
            const result = await this.diff();
            const editorModels = Array.from(this._originalEditorModels.values());
            if (!result || this._disposed || this._model.isDisposed() || editorModels.some(editorModel => editorModel.isDisposed())) {
                return; // disposed
            }
            this.setChanges(result.allChanges, result.changes, result.mapChanges);
        })
            .catch(err => onUnexpectedError(err));
    }
    setChanges(allChanges, changes, mapChanges) {
        const diff = sortedDiff(this.changes, changes, (a, b) => compareChanges(a.change, b.change));
        this._allChanges = allChanges;
        this._changes = changes;
        this._quickDiffChanges = mapChanges;
        this._onDidChange.fire({ changes, diff });
    }
    diff() {
        return this.progressService.withProgress({ location: 3 /* ProgressLocation.Scm */, delay: 250 }, async () => {
            const originalURIs = await this.getQuickDiffsPromise();
            if (this._disposed || this._model.isDisposed() || (originalURIs.length === 0)) {
                // Disposed
                return Promise.resolve({ allChanges: [], changes: [], mapChanges: new Map() });
            }
            const quickDiffs = originalURIs
                .filter(quickDiff => this.editorWorkerService.canComputeDirtyDiff(quickDiff.originalResource, this._model.resource));
            if (quickDiffs.length === 0) {
                // All files are too large
                return Promise.resolve({ allChanges: [], changes: [], mapChanges: new Map() });
            }
            const quickDiffPrimary = quickDiffs.find(quickDiff => quickDiff.kind === 'primary');
            const ignoreTrimWhitespaceSetting = this.configurationService.getValue('scm.diffDecorationsIgnoreTrimWhitespace');
            const ignoreTrimWhitespace = ignoreTrimWhitespaceSetting === 'inherit'
                ? this.configurationService.getValue('diffEditor.ignoreTrimWhitespace')
                : ignoreTrimWhitespaceSetting !== 'false';
            const diffs = [];
            const secondaryDiffs = [];
            for (const quickDiff of quickDiffs) {
                const diff = await this._diff(quickDiff.originalResource, this._model.resource, ignoreTrimWhitespace);
                if (diff.changes && diff.changes2 && diff.changes.length === diff.changes2.length) {
                    for (let index = 0; index < diff.changes.length; index++) {
                        const change2 = diff.changes2[index];
                        // The secondary diffs are complimentary to the primary diffs, and
                        // they can overlap. We need to remove the secondary quick diffs that
                        // overlap for the UI, but we need to expose all diffs through the API.
                        if (quickDiffPrimary && quickDiff.kind === 'secondary') {
                            // Check whether the:
                            // 1. the modified line range is equal
                            // 2. the original line range length is equal
                            const primaryQuickDiffChange = diffs
                                .find(d => d.change2.modified.equals(change2.modified) &&
                                d.change2.original.length === change2.original.length);
                            if (primaryQuickDiffChange) {
                                // Check whether the original content matches
                                const primaryModel = this._originalEditorModels.get(quickDiffPrimary.originalResource)?.textEditorModel;
                                const primaryContent = primaryModel?.getValueInRange(primaryQuickDiffChange.change2.toRangeMapping().originalRange);
                                const secondaryModel = this._originalEditorModels.get(quickDiff.originalResource)?.textEditorModel;
                                const secondaryContent = secondaryModel?.getValueInRange(change2.toRangeMapping().originalRange);
                                if (primaryContent === secondaryContent) {
                                    secondaryDiffs.push({
                                        providerId: quickDiff.id,
                                        original: quickDiff.originalResource,
                                        modified: this._model.resource,
                                        change: diff.changes[index],
                                        change2: diff.changes2[index]
                                    });
                                    continue;
                                }
                            }
                        }
                        diffs.push({
                            providerId: quickDiff.id,
                            original: quickDiff.originalResource,
                            modified: this._model.resource,
                            change: diff.changes[index],
                            change2: diff.changes2[index]
                        });
                    }
                }
            }
            const diffsSorted = diffs.sort((a, b) => compareChanges(a.change, b.change));
            const allDiffsSorted = [...diffs, ...secondaryDiffs].sort((a, b) => compareChanges(a.change, b.change));
            const map = new Map();
            for (let i = 0; i < diffsSorted.length; i++) {
                const providerId = diffsSorted[i].providerId;
                if (!map.has(providerId)) {
                    map.set(providerId, []);
                }
                map.get(providerId).push(i);
            }
            return { allChanges: allDiffsSorted, changes: diffsSorted, mapChanges: map };
        });
    }
    async _diff(original, modified, ignoreTrimWhitespace) {
        const maxComputationTimeMs = this.options.maxComputationTimeMs ?? Number.MAX_SAFE_INTEGER;
        const result = await this.editorWorkerService.computeDiff(original, modified, {
            computeMoves: false, ignoreTrimWhitespace, maxComputationTimeMs
        }, this.options.algorithm);
        return { changes: result ? toLineChanges(DiffState.fromDiffResult(result)) : null, changes2: result?.changes ?? null };
    }
    getQuickDiffsPromise() {
        if (this._quickDiffsPromise) {
            return this._quickDiffsPromise;
        }
        this._quickDiffsPromise = this.getOriginalResource().then(async (quickDiffs) => {
            if (this._disposed) { // disposed
                return [];
            }
            if (quickDiffs.length === 0) {
                this._quickDiffs = [];
                this._originalEditorModels.clear();
                return [];
            }
            if (equals(this._quickDiffs, quickDiffs, (a, b) => a.id === b.id &&
                a.originalResource.toString() === b.originalResource.toString() &&
                this.quickDiffService.isQuickDiffProviderVisible(a.id) === this.quickDiffService.isQuickDiffProviderVisible(b.id))) {
                return quickDiffs;
            }
            this._quickDiffs = quickDiffs;
            this._originalEditorModels.clear();
            this._originalEditorModelsDisposables.clear();
            return (await Promise.all(quickDiffs.map(async (quickDiff) => {
                try {
                    const ref = await this.textModelResolverService.createModelReference(quickDiff.originalResource);
                    if (this._disposed) { // disposed
                        ref.dispose();
                        return [];
                    }
                    this._originalEditorModels.set(quickDiff.originalResource, ref.object);
                    if (isTextFileEditorModel(ref.object) && !ref.object.isDirty()) {
                        const encoding = this._model.getEncoding();
                        if (encoding) {
                            ref.object.setEncoding(encoding, 1 /* EncodingMode.Decode */);
                        }
                    }
                    this._originalEditorModelsDisposables.add(ref);
                    this._originalEditorModelsDisposables.add(ref.object.textEditorModel.onDidChangeContent(() => this.triggerDiff()));
                    return quickDiff;
                }
                catch (error) {
                    return []; // possibly invalid reference
                }
            }))).flat();
        });
        return this._quickDiffsPromise.finally(() => {
            this._quickDiffsPromise = undefined;
        });
    }
    async getOriginalResource() {
        if (this._disposed) {
            return Promise.resolve([]);
        }
        const uri = this._model.resource;
        // disable dirty diff when doing chat edits
        const isBeingModifiedByChatEdits = this._chatEditingService.editingSessionsObs.get()
            .some(session => session.getEntry(uri)?.state.get() === 0 /* ModifiedFileEntryState.Modified */);
        if (isBeingModifiedByChatEdits) {
            return Promise.resolve([]);
        }
        const isSynchronized = this._model.textEditorModel ? shouldSynchronizeModel(this._model.textEditorModel) : undefined;
        return this.quickDiffService.getQuickDiffs(uri, this._model.getLanguageId(), isSynchronized);
    }
    findNextClosestChange(lineNumber, inclusive = true, providerId) {
        const visibleQuickDiffIds = this.quickDiffs
            .filter(quickDiff => (!providerId || quickDiff.id === providerId) &&
            this.quickDiffService.isQuickDiffProviderVisible(quickDiff.id))
            .map(quickDiff => quickDiff.id);
        if (!inclusive) {
            // Next visible change
            let nextChangeIndex = this.changes
                .findIndex(change => visibleQuickDiffIds.includes(change.providerId) &&
                change.change.modifiedStartLineNumber > lineNumber);
            if (nextChangeIndex !== -1) {
                return nextChangeIndex;
            }
            // First visible change
            nextChangeIndex = this.changes
                .findIndex(change => visibleQuickDiffIds.includes(change.providerId));
            return nextChangeIndex !== -1 ? nextChangeIndex : 0;
        }
        const primaryQuickDiffId = this.quickDiffs
            .find(quickDiff => quickDiff.kind === 'primary')?.id;
        const primaryInclusiveChangeIndex = this.changes
            .findIndex(change => change.providerId === primaryQuickDiffId &&
            change.change.modifiedStartLineNumber <= lineNumber &&
            getModifiedEndLineNumber(change.change) >= lineNumber);
        if (primaryInclusiveChangeIndex !== -1) {
            return primaryInclusiveChangeIndex;
        }
        // Next visible change
        let nextChangeIndex = this.changes
            .findIndex(change => visibleQuickDiffIds.includes(change.providerId) &&
            change.change.modifiedStartLineNumber <= lineNumber &&
            getModifiedEndLineNumber(change.change) >= lineNumber);
        if (nextChangeIndex !== -1) {
            return nextChangeIndex;
        }
        // First visible change
        nextChangeIndex = this.changes
            .findIndex(change => visibleQuickDiffIds.includes(change.providerId));
        return nextChangeIndex !== -1 ? nextChangeIndex : 0;
    }
    findPreviousClosestChange(lineNumber, inclusive = true, providerId) {
        for (let i = this.changes.length - 1; i >= 0; i--) {
            if (providerId && this.changes[i].providerId !== providerId) {
                continue;
            }
            // Skip quick diffs that are not visible
            const quickDiff = this.quickDiffs.find(quickDiff => quickDiff.id === this.changes[i].providerId);
            if (!quickDiff || !this.quickDiffService.isQuickDiffProviderVisible(quickDiff.id)) {
                continue;
            }
            const change = this.changes[i].change;
            if (inclusive) {
                if (change.modifiedStartLineNumber <= lineNumber) {
                    return i;
                }
            }
            else {
                if (getModifiedEndLineNumber(change) < lineNumber) {
                    return i;
                }
            }
        }
        return this.changes.length - 1;
    }
    dispose() {
        this._disposed = true;
        this._quickDiffs = [];
        this._diffDelayer.cancel();
        this._originalEditorModels.clear();
        this._repositoryDisposables.dispose();
        super.dispose();
    }
};
QuickDiffModel = __decorate([
    __param(2, ISCMService),
    __param(3, IQuickDiffService),
    __param(4, IEditorWorkerService),
    __param(5, IConfigurationService),
    __param(6, ITextModelService),
    __param(7, IChatEditingService),
    __param(8, IProgressService)
], QuickDiffModel);
export { QuickDiffModel };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVpY2tEaWZmTW9kZWwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvc2NtL2Jyb3dzZXIvcXVpY2tEaWZmTW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxlQUFlLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNwSCxPQUFPLEVBQThDLHFCQUFxQixFQUF3QixnQkFBZ0IsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQzNLLE9BQU8sRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBYyxtQkFBbUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ25JLE9BQU8sRUFBcUIsb0JBQW9CLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUM3RyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUc3RixPQUFPLEVBQTRCLGlCQUFpQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDcEgsT0FBTyxFQUFjLHNCQUFzQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDeEYsT0FBTyxFQUFFLGNBQWMsRUFBRSx3QkFBd0IsRUFBRSxpQkFBaUIsRUFBK0MsTUFBTSx3QkFBd0IsQ0FBQztBQUNsSixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNwRSxPQUFPLEVBQWtCLFdBQVcsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdkUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFD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