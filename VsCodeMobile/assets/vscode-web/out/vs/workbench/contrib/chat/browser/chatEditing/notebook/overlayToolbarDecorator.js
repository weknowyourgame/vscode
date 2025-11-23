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
import { ActionViewItem } from '../../../../../../base/browser/ui/actionbar/actionViewItems.js';
import { Disposable, DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { MenuWorkbenchToolBar } from '../../../../../../platform/actions/browser/toolbar.js';
import { MenuId } from '../../../../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { CellEditState } from '../../../../notebook/browser/notebookBrowser.js';
import { CellKind } from '../../../../notebook/common/notebookCommon.js';
let OverlayToolbarDecorator = class OverlayToolbarDecorator extends Disposable {
    constructor(notebookEditor, notebookModel, instantiationService, accessibilitySignalService) {
        super();
        this.notebookEditor = notebookEditor;
        this.notebookModel = notebookModel;
        this.instantiationService = instantiationService;
        this.accessibilitySignalService = accessibilitySignalService;
        this._timeout = undefined;
        this.overlayDisposables = this._register(new DisposableStore());
    }
    decorate(changes) {
        if (this._timeout !== undefined) {
            clearTimeout(this._timeout);
        }
        this._timeout = setTimeout(() => {
            this._timeout = undefined;
            this.createMarkdownPreviewToolbars(changes);
        }, 100);
    }
    createMarkdownPreviewToolbars(changes) {
        this.overlayDisposables.clear();
        const accessibilitySignalService = this.accessibilitySignalService;
        const editor = this.notebookEditor;
        for (const change of changes) {
            const cellViewModel = this.getCellViewModel(change);
            if (!cellViewModel || cellViewModel.cellKind !== CellKind.Markup) {
                continue;
            }
            const toolbarContainer = document.createElement('div');
            let overlayId = undefined;
            editor.changeCellOverlays((accessor) => {
                toolbarContainer.style.right = '44px';
                overlayId = accessor.addOverlay({
                    cell: cellViewModel,
                    domNode: toolbarContainer,
                });
            });
            const removeOverlay = () => {
                editor.changeCellOverlays(accessor => {
                    if (overlayId) {
                        accessor.removeOverlay(overlayId);
                    }
                });
            };
            this.overlayDisposables.add({ dispose: removeOverlay });
            const toolbar = document.createElement('div');
            toolbarContainer.appendChild(toolbar);
            toolbar.className = 'chat-diff-change-content-widget';
            toolbar.classList.add('hover'); // Show by default
            toolbar.style.position = 'relative';
            toolbar.style.top = '18px';
            toolbar.style.zIndex = '10';
            toolbar.style.display = cellViewModel.getEditState() === CellEditState.Editing ? 'none' : 'block';
            this.overlayDisposables.add(cellViewModel.onDidChangeState((e) => {
                if (e.editStateChanged) {
                    if (cellViewModel.getEditState() === CellEditState.Editing) {
                        toolbar.style.display = 'none';
                    }
                    else {
                        toolbar.style.display = 'block';
                    }
                }
            }));
            const scopedInstaService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, this.notebookEditor.scopedContextKeyService])));
            const toolbarWidget = scopedInstaService.createInstance(MenuWorkbenchToolBar, toolbar, MenuId.ChatEditingEditorHunk, {
                telemetrySource: 'chatEditingNotebookHunk',
                hiddenItemStrategy: -1 /* HiddenItemStrategy.NoHide */,
                toolbarOptions: { primaryGroup: () => true },
                menuOptions: {
                    renderShortTitle: true,
                    arg: {
                        async accept() {
                            accessibilitySignalService.playSignal(AccessibilitySignal.editsKept, { allowManyInParallel: true });
                            removeOverlay();
                            toolbarWidget.dispose();
                            for (const singleChange of change.diff.get().changes) {
                                await change.keep(singleChange);
                            }
                            return true;
                        },
                        async reject() {
                            accessibilitySignalService.playSignal(AccessibilitySignal.editsUndone, { allowManyInParallel: true });
                            removeOverlay();
                            toolbarWidget.dispose();
                            for (const singleChange of change.diff.get().changes) {
                                await change.undo(singleChange);
                            }
                            return true;
                        }
                    },
                },
                actionViewItemProvider: (action, options) => {
                    if (!action.class) {
                        return new class extends ActionViewItem {
                            constructor() {
                                super(undefined, action, { ...options, keybindingNotRenderedWithLabel: true /* hide keybinding for actions without icon */, icon: false, label: true });
                            }
                        };
                    }
                    return undefined;
                }
            });
            this.overlayDisposables.add(toolbarWidget);
        }
    }
    getCellViewModel(change) {
        if (change.type === 'delete' || change.modifiedCellIndex === undefined) {
            return undefined;
        }
        const cell = this.notebookModel.cells[change.modifiedCellIndex];
        const cellViewModel = this.notebookEditor.getViewModel()?.viewCells.find(c => c.handle === cell.handle);
        return cellViewModel;
    }
    dispose() {
        super.dispose();
        if (this._timeout !== undefined) {
            clearTimeout(this._timeout);
        }
    }
};
OverlayToolbarDecorator = __decorate([
    __param(2, IInstantiationService),
    __param(3, IAccessibilitySignalService)
], OverlayToolbarDecorator);
export { OverlayToolbarDecorator };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3ZlcmxheVRvb2xiYXJEZWNvcmF0b3IuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRFZGl0aW5nL25vdGVib29rL292ZXJsYXlUb29sYmFyRGVjb3JhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUNoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSwyQkFBMkIsRUFBRSxNQUFNLHNGQUFzRixDQUFDO0FBQ3hKLE9BQU8sRUFBRSxvQkFBb0IsRUFBc0IsTUFBTSx1REFBdUQsQ0FBQztBQUNqSCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDOUUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDaEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDekcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0VBQXNFLENBQUM7QUFDekcsT0FBTyxFQUFFLGFBQWEsRUFBbUIsTUFBTSxpREFBaUQsQ0FBQztBQUVqRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFLbEUsSUFBTSx1QkFBdUIsR0FBN0IsTUFBTSx1QkFBd0IsU0FBUSxVQUFVO0lBS3RELFlBQ2tCLGNBQStCLEVBQy9CLGFBQWdDLEVBQzFCLG9CQUE0RCxFQUN0RCwwQkFBd0U7UUFFckcsS0FBSyxFQUFFLENBQUM7UUFMUyxtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7UUFDL0Isa0JBQWEsR0FBYixhQUFhLENBQW1CO1FBQ1QseUJBQW9CLEdBQXBCLG9C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