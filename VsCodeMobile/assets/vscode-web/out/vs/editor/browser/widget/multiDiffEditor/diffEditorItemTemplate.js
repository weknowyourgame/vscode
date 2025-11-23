var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { h } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { autorun, derived, globalTransaction, observableValue } from '../../../../base/common/observable.js';
import { createActionViewItem } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { MenuWorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { observableCodeEditor } from '../../observableCodeEditor.js';
import { DiffEditorWidget } from '../diffEditor/diffEditorWidget.js';
import { ActionRunnerWithContext } from './utils.js';
export class TemplateData {
    constructor(viewModel, deltaScrollVertical) {
        this.viewModel = viewModel;
        this.deltaScrollVertical = deltaScrollVertical;
    }
    getId() {
        return this.viewModel;
    }
}
let DiffEditorItemTemplate = class DiffEditorItemTemplate extends Disposable {
    constructor(_container, _overflowWidgetsDomNode, _workbenchUIElementFactory, _instantiationService, _parentContextKeyService) {
        super();
        this._container = _container;
        this._overflowWidgetsDomNode = _overflowWidgetsDomNode;
        this._workbenchUIElementFactory = _workbenchUIElementFactory;
        this._instantiationService = _instantiationService;
        this._viewModel = observableValue(this, undefined);
        this._collapsed = derived(this, reader => this._viewModel.read(reader)?.collapsed.read(reader));
        this._editorContentHeight = observableValue(this, 500);
        this.contentHeight = derived(this, reader => {
            const h = this._collapsed.read(reader) ? 0 : this._editorContentHeight.read(reader);
            return h + this._outerEditorHeight;
        });
        this._modifiedContentWidth = observableValue(this, 0);
        this._modifiedWidth = observableValue(this, 0);
        this._originalContentWidth = observableValue(this, 0);
        this._originalWidth = observableValue(this, 0);
        this.maxScroll = derived(this, reader => {
            const scroll1 = this._modifiedContentWidth.read(reader) - this._modifiedWidth.read(reader);
            const scroll2 = this._originalContentWidth.read(reader) - this._originalWidth.read(reader);
            if (scroll1 > scroll2) {
                return { maxScroll: scroll1, width: this._modifiedWidth.read(reader) };
            }
            else {
                return { maxScroll: scroll2, width: this._originalWidth.read(reader) };
            }
        });
        this._elements = h('div.multiDiffEntry', [
            h('div.header@header', [
                h('div.header-content', [
                    h('div.collapse-button@collapseButton'),
                    h('div.file-path', [
                        // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
                        h('div.title.modified.show-file-icons@primaryPath', []),
                        h('div.status.deleted@status', ['R']),
                        // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
                        h('div.title.original.show-file-icons@secondaryPath', []),
                    ]),
                    h('div.actions@actions'),
                ]),
            ]),
            h('div.editorParent', [
                h('div.editorContainer@editor'),
            ])
        ]);
        this.editor = this._register(this._instantiationService.createInstance(DiffEditorWidget, this._elements.editor, {
            overflowWidgetsDomNode: this._overflowWidgetsDomNode,
            fixedOverflowWidgets: true
        }, {}));
        this.isModifedFocused = observableCodeEditor(this.editor.getModifiedEditor()).isFocused;
        this.isOriginalFocused = observableCodeEditor(this.editor.getOriginalEditor()).isFocused;
        this.isFocused = derived(this, reader => this.isModifedFocused.read(reader) || this.isOriginalFocused.read(reader));
        this._resourceLabel = this._workbenchUIElementFactory.createResourceLabel
            ? this._register(this._workbenchUIElementFactory.createResourceLabel(this._elements.primaryPath))
            : undefined;
        this._resourceLabel2 = this._workbenchUIElementFactory.createResourceLabel
            ? this._register(this._workbenchUIElementFactory.createResourceLabel(this._elements.secondaryPath))
            : undefined;
        this._dataStore = this._register(new DisposableStore());
        this._headerHeight = 40;
        this._lastScrollTop = -1;
        this._isSettingScrollTop = false;
        const btn = new Button(this._elements.collapseButton, {});
        this._register(autorun(reader => {
            btn.element.className = '';
            btn.icon = this._collapsed.read(reader) ? Codicon.chevronRight : Codicon.chevronDown;
        }));
        this._register(btn.onDidClick(() => {
            this._viewModel.get()?.collapsed.set(!this._collapsed.get(), undefined);
        }));
        this._register(autorun(reader => {
            this._elements.editor.style.display = this._collapsed.read(reader) ? 'none' : 'block';
        }));
        this._register(this.editor.getModifiedEditor().onDidLayoutChange(e => {
            const width = this.editor.getModifiedEditor().getLayoutInfo().contentWidth;
            this._modifiedWidth.set(width, undefined);
        }));
        this._register(this.editor.getOriginalEditor().onDidLayoutChange(e => {
            const width = this.editor.getOriginalEditor().getLayoutInfo().contentWidth;
            this._originalWidth.set(width, undefined);
        }));
        this._register(this.editor.onDidContentSizeChange(e => {
            globalTransaction(tx => {
                this._editorContentHeight.set(e.contentHeight, tx);
                this._modifiedContentWidth.set(this.editor.getModifiedEditor().getContentWidth(), tx);
                this._originalContentWidth.set(this.editor.getOriginalEditor().getContentWidth(), tx);
            });
        }));
        this._register(this.editor.getOriginalEditor().onDidScrollChange(e => {
            if (this._isSettingScrollTop) {
                return;
            }
            if (!e.scrollTopChanged || !this._data) {
                return;
            }
            const delta = e.scrollTop - this._lastScrollTop;
            this._data.deltaScrollVertical(delta);
        }));
        this._register(autorun(reader => {
            const isActive = this._viewModel.read(reader)?.isActive.read(reader);
            this._elements.root.classList.toggle('active', isActive);
        }));
        this._container.appendChild(this._elements.root);
        this._outerEditorHeight = this._headerHeight;
        this._contextKeyService = this._register(_parentContextKeyService.createScoped(this._elements.actions));
        const instantiationService = this._register(this._instantiationService.createChild(new ServiceCollection([IContextKeyService, this._contextKeyService])));
        this._register(instantiationService.createInstance(MenuWorkbenchToolBar, this._elements.actions, MenuId.MultiDiffEditorFileToolbar, {
            actionRunner: this._register(new ActionRunnerWithContext(() => (this._viewModel.get()?.modifiedUri ?? this._viewModel.get()?.originalUri))),
            menuOptions: {
                shouldForwardArgs: true,
            },
            toolbarOptions: { primaryGroup: g => g.startsWith('navigation') },
            actionViewItemProvider: (action, options) => createActionViewItem(instantiationService, action, options),
        }));
    }
    setScrollLeft(left) {
        if (this._modifiedContentWidth.get() - this._modifiedWidth.get() > this._originalContentWidth.get() - this._originalWidth.get()) {
            this.editor.getModifiedEditor().setScrollLeft(left);
        }
        else {
            this.editor.getOriginalEditor().setScrollLeft(left);
        }
    }
    setData(data) {
        this._data = data;
        function updateOptions(options) {
            return {
                ...options,
                scrollBeyondLastLine: false,
                hideUnchangedRegions: {
                    enabled: true,
                },
                scrollbar: {
                    vertical: 'hidden',
                    horizontal: 'hidden',
                    handleMouseWheel: false,
                    useShadows: false,
                },
                renderOverviewRuler: false,
                fixedOverflowWidgets: true,
                overviewRulerBorder: false,
            };
        }
        if (!data) {
            globalTransaction(tx => {
                this._viewModel.set(undefined, tx);
                this.editor.setDiffModel(null, tx);
                this._dataStore.clear();
            });
            return;
        }
        const value = data.viewModel.documentDiffItem;
        globalTransaction(tx => {
            this._resourceLabel?.setUri(data.viewModel.modifiedUri ?? data.viewModel.originalUri, { strikethrough: data.viewModel.modifiedUri === undefined });
            let isRenamed = false;
            let isDeleted = false;
            let isAdded = false;
            let flag = '';
            if (data.viewModel.modifiedUri && data.viewModel.originalUri && data.viewModel.modifiedUri.path !== data.viewModel.originalUri.path) {
                flag = 'R';
                isRenamed = true;
            }
            else if (!data.viewModel.modifiedUri) {
                flag = 'D';
                isDeleted = true;
            }
            else if (!data.viewModel.originalUri) {
                flag = 'A';
                isAdded = true;
            }
            this._elements.status.classList.toggle('renamed', isRenamed);
            this._elements.status.classList.toggle('deleted', isDeleted);
            this._elements.status.classList.toggle('added', isAdded);
            this._elements.status.innerText = flag;
            this._resourceLabel2?.setUri(isRenamed ? data.viewModel.originalUri : undefined, { strikethrough: true });
            this._dataStore.clear();
            this._viewModel.set(data.viewModel, tx);
            this.editor.setDiffModel(data.viewModel.diffEditorViewModelRef, tx);
            this.editor.updateOptions(updateOptions(value.options ?? {}));
        });
        if (value.onOptionsDidChange) {
            this._dataStore.add(value.onOptionsDidChange(() => {
                this.editor.updateOptions(updateOptions(value.options ?? {}));
            }));
        }
        data.viewModel.isAlive.recomputeInitiallyAndOnChange(this._dataStore, value => {
            if (!value) {
                this.setData(undefined);
            }
        });
        if (data.viewModel.documentDiffItem.contextKeys) {
            for (const [key, value] of Object.entries(data.viewModel.documentDiffItem.contextKeys)) {
                this._contextKeyService.createKey(key, value);
            }
        }
    }
    render(verticalRange, width, editorScroll, viewPort) {
        this._elements.root.style.visibility = 'visible';
        this._elements.root.style.top = `${verticalRange.start}px`;
        this._elements.root.style.height = `${verticalRange.length}px`;
        this._elements.root.style.width = `${width}px`;
        this._elements.root.style.position = 'absolute';
        // For sticky scroll
        const maxDelta = verticalRange.length - this._headerHeight;
        const delta = Math.max(0, Math.min(viewPort.start - verticalRange.start, maxDelta));
        this._elements.header.style.transform = `translateY(${delta}px)`;
        globalTransaction(tx => {
            this.editor.layout({
                width: width - 2 * 8 - 2 * 1,
                height: verticalRange.length - this._outerEditorHeight,
            });
        });
        try {
            this._isSettingScrollTop = true;
            this._lastScrollTop = editorScroll;
            this.editor.getOriginalEditor().setScrollTop(editorScroll);
        }
        finally {
            this._isSettingScrollTop = false;
        }
        this._elements.header.classList.toggle('shadow', delta > 0 || editorScroll > 0);
        this._elements.header.classList.toggle('collapsed', delta === maxDelta);
    }
    hide() {
        this._elements.root.style.top = `-100000px`;
        this._elements.root.style.visibility = 'hidden'; // Some editor parts are still visible
    }
};
DiffEditorItemTemplate = __decorate([
    __param(3, IInstantiationService),
    __param(4, IContextKeyService)
], DiffEditorItemTemplate);
export { DiffEditorItemTemplate };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlmZkVkaXRvckl0ZW1UZW1wbGF0ZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci93aWRnZXQvbXVsdGlEaWZmRWRpdG9yL2RpZmZFZGl0b3JJdGVtVGVtcGxhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUE7OztnR0FHZ0c7QUFDaEcsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3BELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRixPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxlQUFlLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUM3RyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxpRUFBaUUsQ0FBQztBQUN2RyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUN2RixPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDeEUsT0FBTyxFQUFFLGtCQUFrQixFQUFpQyxNQUFNLHNEQUFzRCxDQUFDO0FBQ3pILE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBR25HLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3JFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBR3JFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUdyRCxNQUFNLE9BQU8sWUFB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