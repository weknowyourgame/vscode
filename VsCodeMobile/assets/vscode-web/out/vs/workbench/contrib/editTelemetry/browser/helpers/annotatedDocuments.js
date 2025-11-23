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
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { mapObservableArrayCached, derived, derivedObservableWithCache, observableFromEvent, observableSignalFromEvent } from '../../../../../base/common/observable.js';
import { isDefined } from '../../../../../base/common/types.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { EditorResourceAccessor } from '../../../../common/editor.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { DocumentWithSourceAnnotatedEdits, CombineStreamedChanges, MinimizeEditsProcessor } from './documentWithAnnotatedEdits.js';
let AnnotatedDocuments = class AnnotatedDocuments extends Disposable {
    constructor(_workspace, _instantiationService) {
        super();
        this._workspace = _workspace;
        this._instantiationService = _instantiationService;
        const uriVisibilityProvider = this._instantiationService.createInstance(UriVisibilityProvider);
        this._states = mapObservableArrayCached(this, this._workspace.documents, (doc, store) => {
            const docIsVisible = derived(reader => uriVisibilityProvider.isVisible(doc.uri, reader));
            const wasEverVisible = derivedObservableWithCache(this, (reader, lastVal) => lastVal || docIsVisible.read(reader));
            return wasEverVisible.map(v => v ? store.add(this._instantiationService.createInstance(AnnotatedDocument, doc, docIsVisible)) : undefined);
        });
        this.documents = this._states.map((vals, reader) => vals.map(v => v.read(reader)).filter(isDefined));
        this.documents.recomputeInitiallyAndOnChange(this._store);
    }
};
AnnotatedDocuments = __decorate([
    __param(1, IInstantiationService)
], AnnotatedDocuments);
export { AnnotatedDocuments };
let UriVisibilityProvider = class UriVisibilityProvider {
    constructor(_editorGroupsService) {
        this._editorGroupsService = _editorGroupsService;
        const onDidAddGroupSignal = observableSignalFromEvent(this, this._editorGroupsService.onDidAddGroup);
        const onDidRemoveGroupSignal = observableSignalFromEvent(this, this._editorGroupsService.onDidRemoveGroup);
        const groups = derived(this, reader => {
            onDidAddGroupSignal.read(reader);
            onDidRemoveGroupSignal.read(reader);
            return this._editorGroupsService.groups;
        });
        this.visibleUris = mapObservableArrayCached(this, groups, g => {
            const editors = observableFromEvent(this, g.onDidModelChange, () => g.editors);
            return editors.map(e => e.map(editor => EditorResourceAccessor.getCanonicalUri(editor)));
        }).map((editors, reader) => {
            const map = new Map();
            for (const urisObs of editors) {
                for (const uri of urisObs.read(reader)) {
                    if (isDefined(uri)) {
                        map.set(uri.toString(), uri);
                    }
                }
            }
            return map;
        });
    }
    isVisible(uri, reader) {
        return this.visibleUris.read(reader).has(uri.toString());
    }
};
UriVisibilityProvider = __decorate([
    __param(0, IEditorGroupsService)
], UriVisibilityProvider);
export { UriVisibilityProvider };
let AnnotatedDocument = class AnnotatedDocument extends Disposable {
    constructor(document, isVisible, _instantiationService) {
        super();
        this.document = document;
        this.isVisible = isVisible;
        this._instantiationService = _instantiationService;
        let processedDoc = this._store.add(new DocumentWithSourceAnnotatedEdits(document));
        // Combine streaming edits into one and make edit smaller
        processedDoc = this._store.add(this._instantiationService.createInstance((CombineStreamedChanges), processedDoc));
        // Remove common suffix and prefix from edits
        processedDoc = this._store.add(new MinimizeEditsProcessor(processedDoc));
        this.documentWithAnnotations = processedDoc;
    }
};
AnnotatedDocument = __decorate([
    __param(2, IInstantiationService)
], AnnotatedDocument);
export { AnnotatedDocument };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5ub3RhdGVkRG9jdW1lbnRzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2VkaXRUZWxlbWV0cnkvYnJvd3Nlci9oZWxwZXJzL2Fubm90YXRlZERvY3VtZW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckUsT0FBTyxFQUFlLHdCQUF3QixFQUFFLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxtQkFBbUIsRUFBRSx5QkFBeUIsRUFBVyxNQUFNLDBDQUEwQyxDQUFDO0FBQy9MLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUVoRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUN0RSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUNqRyxPQUFPLEVBQStDLGdDQUFnQyxFQUFFLHNCQUFzQixFQUFFLHNCQUFzQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFPekssSUFBTSxrQkFBa0IsR0FBeEIsTUFBTSxrQkFBbUIsU0FBUSxVQUFVO0lBSWpELFlBQ2tCLFVBQStCLEVBQ1IscUJBQTRDO1FBRXBGLEtBQUssRUFBRSxDQUFDO1FBSFMsZUFBVSxHQUFWLFVBQVUsQ0FBcUI7UUFDUiwwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO1FBSXBGLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLGNBQWMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBRS9GLElBQUksQ0FBQyxPQUFPLEdBQUcsd0JBQXdCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMs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