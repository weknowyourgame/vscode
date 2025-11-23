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
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { constObservable, derived, derivedObservableWithWritableCache, mapObservableArrayCached, observableFromValueWithChangeEvent, observableValue, transaction } from '../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IModelService } from '../../../common/services/model.js';
import { DiffEditorOptions } from '../diffEditor/diffEditorOptions.js';
import { DiffEditorViewModel } from '../diffEditor/diffEditorViewModel.js';
import { RefCounted } from '../diffEditor/utils.js';
export class MultiDiffEditorViewModel extends Disposable {
    async waitForDiffs() {
        for (const d of this.items.get()) {
            await d.diffEditorViewModel.waitForDiff();
        }
    }
    collapseAll() {
        transaction(tx => {
            for (const d of this.items.get()) {
                d.collapsed.set(true, tx);
            }
        });
    }
    expandAll() {
        transaction(tx => {
            for (const d of this.items.get()) {
                d.collapsed.set(false, tx);
            }
        });
    }
    get contextKeys() {
        return this.model.contextKeys;
    }
    constructor(model, _instantiationService) {
        super();
        this.model = model;
        this._instantiationService = _instantiationService;
        this._documents = observableFromValueWithChangeEvent(this.model, this.model.documents);
        this._documentsArr = derived(this, reader => {
            const result = this._documents.read(reader);
            if (result === 'loading') {
                return [];
            }
            return result;
        });
        this.isLoading = derived(this, reader => this._documents.read(reader) === 'loading');
        this.items = mapObservableArrayCached(this, this._documentsArr, (d, store) => store.add(this._instantiationService.createInstance(DocumentDiffItemViewModel, d, this))).recomputeInitiallyAndOnChange(this._store);
        this.focusedDiffItem = derived(this, reader => this.items.read(reader).find(i => i.isFocused.read(reader)));
        this.activeDiffItem = derivedObservableWithWritableCache(this, (reader, lastValue) => this.focusedDiffItem.read(reader) ?? (lastValue && this.items.read(reader).indexOf(lastValue) !== -1) ? lastValue : undefined);
    }
}
let DocumentDiffItemViewModel = class DocumentDiffItemViewModel extends Disposable {
    get diffEditorViewModel() {
        return this.diffEditorViewModelRef.object;
    }
    get originalUri() { return this.documentDiffItem.original?.uri; }
    get modifiedUri() { return this.documentDiffItem.modified?.uri; }
    setIsFocused(source, tx) {
        this._isFocusedSource.set(source, tx);
    }
    get documentDiffItem() {
        return this.documentDiffItemRef.object;
    }
    constructor(documentDiffItem, _editorViewModel, _instantiationService, _modelService) {
        super();
        this._editorViewModel = _editorViewModel;
        this._instantiationService = _instantiationService;
        this._modelService = _modelService;
        this.collapsed = observableValue(this, false);
        this.lastTemplateData = observableValue(this, { contentHeight: 500, selections: undefined, });
        this.isActive = derived(this, reader => this._editorViewModel.activeDiffItem.read(reader) === this);
        this._isFocusedSource = observableValue(this, constObservable(false));
        this.isFocused = derived(this, reader => this._isFocusedSource.read(reader).read(reader));
        this.isAlive = observableValue(this, true);
        this._register(toDisposable(() => {
            this.isAlive.set(false, undefined);
        }));
        this.documentDiffItemRef = this._register(documentDiffItem.createNewRef(this));
        function updateOptions(options) {
            return {
                ...options,
                hideUnchangedRegions: {
                    enabled: true,
                },
            };
        }
        const options = this._instantiationService.createInstance(DiffEditorOptions, updateOptions(this.documentDiffItem.options || {}));
        if (this.documentDiffItem.onOptionsDidChange) {
            this._register(this.documentDiffItem.onOptionsDidChange(() => {
                options.updateOptions(updateOptions(this.documentDiffItem.options || {}));
            }));
        }
        const diffEditorViewModelStore = new DisposableStore();
        const originalTextModel = this.documentDiffItem.original ?? diffEditorViewModelStore.add(this._modelService.createModel('', null));
        const modifiedTextModel = this.documentDiffItem.modified ?? diffEditorViewModelStore.add(this._modelService.createModel('', null));
        diffEditorViewModelStore.add(this.documentDiffItemRef.createNewRef(this));
        this.diffEditorViewModelRef = this._register(RefCounted.createWithDisposable(this._instantiationService.createInstance(DiffEditorViewModel, {
            original: originalTextModel,
            modified: modifiedTextModel,
        }, options), diffEditorViewModelStore, this));
    }
    getKey() {
        return JSON.stringify([
            this.originalUri?.toString(),
            this.modifiedUri?.toString()
        ]);
    }
};
DocumentDiffItemViewModel = __decorate([
    __param(2, IInstantiationService),
    __param(3, IModelService)
], DocumentDiffItemViewModel);
export { DocumentDiffItemViewModel };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVsdGlEaWZmRWRpdG9yVmlld01vZGVsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9icm93c2VyL3dpZGdldC9tdWx0aURpZmZFZGl0b3IvbXVsdGlEaWZmRWRpdG9yVmlld01vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pHLE9BQU8sRUFBNkIsZUFBZSxFQUFFLE9BQU8sRUFBRSxrQ0FBa0MsRUFBRSx3QkFBd0IsRUFBRSxrQ0FBa0MsRUFBRSxlQUFlLEVBQUUsV0FBVyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFHNU8sT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFJbkcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUdwRCxNQUFNLE9BQU8sd0JBQXlCLFNBQVEsVUFBVTtJQVloRCxLQUFLLENBQUMsWUFBWTtRQUN4QixLQUFLLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztZQUNsQyxNQUFNLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUMzQyxDQUFDO0lBQ0YsQ0FBQztJQUVNLFdBQVc7UUFDakIsV0FBVyxDQUFDLEVBQUUsQ0FBQyxFQUFFO1lBQ2hCLEtBQUssTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFH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