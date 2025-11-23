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
import { ResourceMap } from '../../../../../base/common/map.js';
import { getDefaultNotebookCreationOptions, NotebookEditorWidget } from '../notebookEditorWidget.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { isCompositeNotebookEditorInput, isNotebookEditorInput, NotebookEditorInput } from '../../common/notebookEditorInput.js';
import { Emitter } from '../../../../../base/common/event.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { InteractiveWindowOpen, MOST_RECENT_REPL_EDITOR } from '../../common/notebookContextKeys.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IEditorProgressService } from '../../../../../platform/progress/common/progress.js';
import { NotebookDiffEditorInput } from '../../common/notebookDiffEditorInput.js';
let NotebookEditorWidgetService = class NotebookEditorWidgetService {
    constructor(editorGroupService, editorService, contextKeyService, instantiationService) {
        this.editorGroupService = editorGroupService;
        this.instantiationService = instantiationService;
        this._tokenPool = 1;
        this._disposables = new DisposableStore();
        this._notebookEditors = new Map();
        this.groupListener = new Map();
        this._onNotebookEditorAdd = new Emitter();
        this._onNotebookEditorsRemove = new Emitter();
        this.onDidAddNotebookEditor = this._onNotebookEditorAdd.event;
        this.onDidRemoveNotebookEditor = this._onNotebookEditorsRemove.event;
        this._borrowableEditors = new Map();
        const onNewGroup = (group) => {
            const { id } = group;
            const listeners = [];
            listeners.push(group.onDidCloseEditor(e => {
                const widgetMap = this._borrowableEditors.get(group.id);
                if (!widgetMap) {
                    return;
                }
                const inputs = e.editor instanceof NotebookEditorInput || e.editor instanceof NotebookDiffEditorInput
                    ? [e.editor]
                    : (isCompositeNotebookEditorInput(e.editor) ? e.editor.editorInputs : []);
                inputs.forEach(input => {
                    const widgets = widgetMap.get(input.resource);
                    const index = widgets?.findIndex(widget => widget.editorType === input.typeId);
                    if (!widgets || index === undefined || index === -1) {
                        return;
                    }
                    const value = widgets.splice(index, 1)[0];
                    value.token = undefined;
                    this._disposeWidget(value.widget);
                    value.disposableStore.dispose();
                    // eslint-disable-next-line local/code-no-any-casts
                    value.widget = undefined; // unset the widget so that others that still hold a reference don't harm us
                });
            }));
            listeners.push(group.onWillMoveEditor(e => {
                if (isNotebookEditorInput(e.editor)) {
                    this._allowWidgetMove(e.editor, e.groupId, e.target);
                }
                if (isCompositeNotebookEditorInput(e.editor)) {
                    e.editor.editorInputs.forEach(input => {
                        this._allowWidgetMove(input, e.groupId, e.target);
                    });
                }
            }));
            this.groupListener.set(id, listeners);
        };
        this._disposables.add(editorGroupService.onDidAddGroup(onNewGroup));
        editorGroupService.whenReady.then(() => editorGroupService.groups.forEach(onNewGroup));
        // group removed -> clean up listeners, clean up widgets
        this._disposables.add(editorGroupService.onDidRemoveGroup(group => {
            const listeners = this.groupListener.get(group.id);
            if (listeners) {
                listeners.forEach(listener => listener.dispose());
                this.groupListener.delete(group.id);
            }
            const widgets = this._borrowableEditors.get(group.id);
            this._borrowableEditors.delete(group.id);
            if (widgets) {
                for (const values of widgets.values()) {
                    for (const value of values) {
                        value.token = undefined;
                        this._disposeWidget(value.widget);
                        value.disposableStore.dispose();
                    }
                }
            }
        }));
        this._mostRecentRepl = MOST_RECENT_REPL_EDITOR.bindTo(contextKeyService);
        const interactiveWindowOpen = InteractiveWindowOpen.bindTo(contextKeyService);
        this._disposables.add(editorService.onDidEditorsChange(e => {
            if (e.event.kind === 5 /* GroupModelChangeKind.EDITOR_OPEN */ && !interactiveWindowOpen.get()) {
                if (editorService.editors.find(editor => isCompositeNotebookEditorInput(editor))) {
                    interactiveWindowOpen.set(true);
                }
            }
            else if (e.event.kind === 6 /* GroupModelChangeKind.EDITOR_CLOSE */ && interactiveWindowOpen.get()) {
                if (!editorService.editors.find(editor => isCompositeNotebookEditorInput(editor))) {
                    interactiveWindowOpen.set(false);
                }
            }
        }));
    }
    dispose() {
        this._disposables.dispose();
        this._onNotebookEditorAdd.dispose();
        this._onNotebookEditorsRemove.dispose();
        this.groupListener.forEach((listeners) => {
            listeners.forEach(listener => listener.dispose());
        });
        this.groupListener.clear();
        this._borrowableEditors.forEach(widgetMap => {
            widgetMap.forEach(widgets => {
                widgets.forEach(widget => widget.disposableStore.dispose());
            });
        });
    }
    // --- group-based editor borrowing...
    _disposeWidget(widget) {
        widget.onWillHide();
        const domNode = widget.getDomNode();
        widget.dispose();
        domNode.remove();
    }
    _allowWidgetMove(input, sourceID, targetID) {
        const sourcePart = this.editorGroupService.getPart(sourceID);
        const targetPart = this.editorGroupService.getPart(targetID);
        if (sourcePart.windowId !== targetPart.windowId) {
            return;
        }
        const target = this._borrowableEditors.get(targetID)?.get(input.resource)?.findIndex(widget => widget.editorType === input.typeId);
        if (target !== undefined && target !== -1) {
            // not needed, a separate widget is already there
            return;
        }
        const widget = this._borrowableEditors.get(sourceID)?.get(input.resource)?.find(widget => widget.editorType === input.typeId);
        if (!widget) {
            throw new Error('no widget at source group');
        }
        // don't allow the widget to be retrieved at its previous location any more
        const sourceWidgets = this._borrowableEditors.get(sourceID)?.get(input.resource);
        if (sourceWidgets) {
            const indexToRemove = sourceWidgets.findIndex(widget => widget.editorType === input.typeId);
            if (indexToRemove !== -1) {
                sourceWidgets.splice(indexToRemove, 1);
            }
        }
        // allow the widget to be retrieved at its new location
        let targetMap = this._borrowableEditors.get(targetID);
        if (!targetMap) {
            targetMap = new ResourceMap();
            this._borrowableEditors.set(targetID, targetMap);
        }
        const widgetsAtTarget = targetMap.get(input.resource) ?? [];
        widgetsAtTarget?.push(widget);
        targetMap.set(input.resource, widgetsAtTarget);
    }
    retrieveExistingWidgetFromURI(resource) {
        for (const widgetInfo of this._borrowableEditors.values()) {
            const widgets = widgetInfo.get(resource);
            if (widgets && widgets.length > 0) {
                return this._createBorrowValue(widgets[0].token, widgets[0]);
            }
        }
        return undefined;
    }
    retrieveAllExistingWidgets() {
        const ret = [];
        for (const widgetInfo of this._borrowableEditors.values()) {
            for (const widgets of widgetInfo.values()) {
                for (const widget of widgets) {
                    ret.push(this._createBorrowValue(widget.token, widget));
                }
            }
        }
        return ret;
    }
    retrieveWidget(accessor, groupId, input, creationOptions, initialDimension, codeWindow) {
        let value = this._borrowableEditors.get(groupId)?.get(input.resource)?.find(widget => widget.editorType === input.typeId);
        if (!value) {
            // NEW widget
            const editorGroupContextKeyService = accessor.get(IContextKeyService);
            const editorGroupEditorProgressService = accessor.get(IEditorProgressService);
            const widgetDisposeStore = new DisposableStore();
            const widget = this.createWidget(editorGroupContextKeyService, widgetDisposeStore, editorGroupEditorProgressService, creationOptions, codeWindow, initialDimension);
            const token = this._tokenPool++;
            value = { widget, editorType: input.typeId, token, disposableStore: widgetDisposeStore };
            let map = this._borrowableEditors.get(groupId);
            if (!map) {
                map = new ResourceMap();
                this._borrowableEditors.set(groupId, map);
            }
            const values = map.get(input.resource) ?? [];
            values.push(value);
            map.set(input.resource, values);
        }
        else {
            // reuse a widget which was either free'ed before or which
            // is simply being reused...
            value.token = this._tokenPool++;
        }
        return this._createBorrowValue(value.token, value);
    }
    // protected for unit testing overrides
    createWidget(editorGroupContextKeyService, widgetDisposeStore, editorGroupEditorProgressService, creationOptions, codeWindow, initialDimension) {
        const notebookInstantiationService = widgetDisposeStore.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, editorGroupContextKeyService], [IEditorProgressService, editorGroupEditorProgressService])));
        const ctorOptions = creationOptions ?? getDefaultNotebookCreationOptions();
        const widget = notebookInstantiationService.createInstance(NotebookEditorWidget, {
            ...ctorOptions,
            codeWindow: codeWindow ?? ctorOptions.codeWindow,
        }, initialDimension);
        return widget;
    }
    _createBorrowValue(myToken, widget) {
        return {
            get value() {
                return widget.token === myToken ? widget.widget : undefined;
            }
        };
    }
    // --- editor management
    addNotebookEditor(editor) {
        this._notebookEditors.set(editor.getId(), editor);
        this._onNotebookEditorAdd.fire(editor);
    }
    removeNotebookEditor(editor) {
        const notebookUri = editor.getViewModel()?.notebookDocument.uri;
        if (this._notebookEditors.delete(editor.getId())) {
            this._onNotebookEditorsRemove.fire(editor);
        }
        if (this._mostRecentRepl.get() === notebookUri?.toString()) {
            this._mostRecentRepl.reset();
        }
    }
    getNotebookEditor(editorId) {
        return this._notebookEditors.get(editorId);
    }
    listNotebookEditors() {
        return [...this._notebookEditors].map(e => e[1]);
    }
    getNotebookForPossibleCell(candidate) {
        for (const editor of this._notebookEditors.values()) {
            for (const [, codeEditor] of editor.codeEditors) {
                if (codeEditor === candidate) {
                    return editor;
                }
            }
        }
        return undefined;
    }
    updateReplContextKey(uri) {
        this._mostRecentRepl.set(uri);
    }
};
NotebookEditorWidgetService = __decorate([
    __param(0, IEditorGroupsService),
    __param(1, IEditorService),
    __param(2, IContextKeyService),
    __param(3, IInstantiationService)
], NotebookEditorWidgetService);
export { NotebookEditorWidgetService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tFZGl0b3JTZXJ2aWNlSW1wbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3NlcnZpY2VzL25vdGVib29rRWRpdG9yU2VydmljZUltcGwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxpQ0FBaUMsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ3JHLE9BQU8sRUFBRSxlQUFlLEVBQWUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN2RixPQUFPLEVBQUUsb0JBQW9CLEVBQWdCLE1BQU0sMkRBQTJELENBQUM7QUFDL0csT0FBTyxFQUFFLHFCQUFxQixFQUFvQixNQUFNLCtEQUErRCxDQUFDO0FBQ3hILE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxxQkFBcUIsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBR2pJLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUk5RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDckYsT0FBTyxFQUFlLGtCQUFrQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDMUcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLHVCQUF1QixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDckcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFDdEcsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0scURBQXFELENBQUM7QUFDN0YsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFHM0UsSUFBTSwyQkFBMkIsR0FBakMsTUFBTSwyQkFBMkI7SUFv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