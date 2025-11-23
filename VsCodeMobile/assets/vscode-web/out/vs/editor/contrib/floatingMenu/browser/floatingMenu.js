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
import { h } from '../../../../base/browser/dom.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { autorun, constObservable, observableFromEvent } from '../../../../base/common/observable.js';
import { MenuEntryActionViewItem } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { MenuWorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { IMenuService, MenuId, MenuItemAction } from '../../../../platform/actions/common/actions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { observableCodeEditor } from '../../../browser/observableCodeEditor.js';
let FloatingEditorToolbar = class FloatingEditorToolbar extends Disposable {
    static { this.ID = 'editor.contrib.floatingToolbar'; }
    constructor(editor, instantiationService, keybindingService, menuService) {
        super();
        const editorObs = this._register(observableCodeEditor(editor));
        const menu = this._register(menuService.createMenu(MenuId.EditorContent, editor.contextKeyService));
        const menuIsEmptyObs = observableFromEvent(this, menu.onDidChange, () => menu.getActions().length === 0);
        this._register(autorun(reader => {
            const menuIsEmpty = menuIsEmptyObs.read(reader);
            if (menuIsEmpty) {
                return;
            }
            const container = h('div.floating-menu-overlay-widget');
            // Set height explicitly to ensure that the floating menu element
            // is rendered in the lower right corner at the correct position.
            container.root.style.height = '28px';
            // Toolbar
            const toolbar = instantiationService.createInstance(MenuWorkbenchToolBar, container.root, MenuId.EditorContent, {
                actionViewItemProvider: (action, options) => {
                    if (!(action instanceof MenuItemAction)) {
                        return undefined;
                    }
                    const keybinding = keybindingService.lookupKeybinding(action.id);
                    if (!keybinding) {
                        return undefined;
                    }
                    return instantiationService.createInstance(class extends MenuEntryActionViewItem {
                        updateLabel() {
                            if (this.options.label && this.label) {
                                this.label.textContent = `${this._commandAction.label} (${keybinding.getLabel()})`;
                            }
                        }
                    }, action, { ...options, keybindingNotRenderedWithLabel: true });
                },
                hiddenItemStrategy: 0 /* HiddenItemStrategy.Ignore */,
                menuOptions: {
                    shouldForwardArgs: true
                },
                telemetrySource: 'editor.overlayToolbar',
                toolbarOptions: {
                    primaryGroup: () => true,
                    useSeparatorsInPrimaryActions: true
                },
            });
            reader.store.add(toolbar);
            reader.store.add(autorun(reader => {
                const model = editorObs.model.read(reader);
                toolbar.context = model?.uri;
            }));
            // Overlay widget
            reader.store.add(editorObs.createOverlayWidget({
                allowEditorOverflow: false,
                domNode: container.root,
                minContentWidthInPx: constObservable(0),
                position: constObservable({
                    preference: 1 /* OverlayWidgetPositionPreference.BOTTOM_RIGHT_CORNER */
                })
            }));
        }));
    }
};
FloatingEditorToolbar = __decorate([
    __param(1, IInstantiationService),
    __param(2, IKeybindingService),
    __param(3, IMenuService)
], FloatingEditorToolbar);
export { FloatingEditorToolbar };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmxvYXRpbmdNZW51LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2Zsb2F0aW5nTWVudS9icm93c2VyL2Zsb2F0aW5nTWVudS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDcEQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLG1CQUFtQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDdEcsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0saUVBQWlFLENBQUM7QUFDMUcsT0FBTyxFQUFzQixvQkFBb0IsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQzNHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBRTFGLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBR3pFLElBQU0scUJBQXFCLEdBQTNCLE1BQU0scUJBQXNCLFNBQVEsVUFBVTthQUNwQyxPQUFFLEdBQUcsZ0NBQWdDLEFBQW5DLENBQW9DO0lBRXRELFlBQ0MsTUFBbUIsRUFDSSxvQkFBMkMsRUFDOUMsaUJBQXFDLEVBQzNDLFdBQXlCO1FBRXZDLEtBQUssRUFBRSxDQUFDO1FBRVIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBRS9ELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxT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