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
import { Separator, toAction } from '../../../base/common/actions.js';
import { localize } from '../../../nls.js';
import { IWorkbenchLayoutService } from '../../services/layout/browser/layoutService.js';
import { IContextMenuService } from '../../../platform/contextview/browser/contextView.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { EventHelper, addDisposableListener, getActiveDocument, getWindow, isHTMLInputElement, isHTMLTextAreaElement } from '../../../base/browser/dom.js';
import { registerWorkbenchContribution2 } from '../../common/contributions.js';
import { IClipboardService } from '../../../platform/clipboard/common/clipboardService.js';
import { StandardMouseEvent } from '../../../base/browser/mouseEvent.js';
import { Event as BaseEvent } from '../../../base/common/event.js';
import { Lazy } from '../../../base/common/lazy.js';
import { ILogService } from '../../../platform/log/common/log.js';
export function createTextInputActions(clipboardService, logService) {
    return [
        toAction({ id: 'undo', label: localize('undo', "Undo"), run: () => getActiveDocument().execCommand('undo') }),
        toAction({ id: 'redo', label: localize('redo', "Redo"), run: () => getActiveDocument().execCommand('redo') }),
        new Separator(),
        toAction({
            id: 'editor.action.clipboardCutAction', label: localize('cut', "Cut"), run: () => {
                logService.trace('TextInputActionsProvider#cut');
                getActiveDocument().execCommand('cut');
            }
        }),
        toAction({
            id: 'editor.action.clipboardCopyAction', label: localize('copy', "Copy"), run: () => {
                logService.trace('TextInputActionsProvider#copy');
                getActiveDocument().execCommand('copy');
            }
        }),
        toAction({
            id: 'editor.action.clipboardPasteAction',
            label: localize('paste', "Paste"),
            run: async (element) => {
                logService.trace('TextInputActionsProvider#paste');
                const clipboardText = await clipboardService.readText();
                if (isHTMLTextAreaElement(element) || isHTMLInputElement(element)) {
                    const selectionStart = element.selectionStart || 0;
                    const selectionEnd = element.selectionEnd || 0;
                    element.value = `${element.value.substring(0, selectionStart)}${clipboardText}${element.value.substring(selectionEnd, element.value.length)}`;
                    element.selectionStart = selectionStart + clipboardText.length;
                    element.selectionEnd = element.selectionStart;
                    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                }
            }
        }),
        new Separator(),
        toAction({ id: 'editor.action.selectAll', label: localize('selectAll', "Select All"), run: () => getActiveDocument().execCommand('selectAll') })
    ];
}
let TextInputActionsProvider = class TextInputActionsProvider extends Disposable {
    static { this.ID = 'workbench.contrib.textInputActionsProvider'; }
    constructor(layoutService, contextMenuService, clipboardService, logService) {
        super();
        this.layoutService = layoutService;
        this.contextMenuService = contextMenuService;
        this.clipboardService = clipboardService;
        this.logService = logService;
        this.textInputActions = new Lazy(() => createTextInputActions(this.clipboardService, this.logService));
        this.registerListeners();
    }
    registerListeners() {
        // Context menu support in input/textarea
        this._register(BaseEvent.runAndSubscribe(this.layoutService.onDidAddContainer, ({ container, disposables }) => {
            disposables.add(addDisposableListener(container, 'contextmenu', e => this.onContextMenu(getWindow(container), e)));
        }, { container: this.layoutService.mainContainer, disposables: this._store }));
    }
    onContextMenu(targetWindow, e) {
        if (e.defaultPrevented) {
            return; // make sure to not show these actions by accident if component indicated to prevent
        }
        const target = e.target;
        if (!isHTMLTextAreaElement(target) && !isHTMLInputElement(target)) {
            return; // only for inputs or textareas
        }
        EventHelper.stop(e, true);
        const event = new StandardMouseEvent(targetWindow, e);
        this.contextMenuService.showContextMenu({
            getAnchor: () => event,
            getActions: () => this.textInputActions.value,
            getActionsContext: () => target,
        });
    }
};
TextInputActionsProvider = __decorate([
    __param(0, IWorkbenchLayoutService),
    __param(1, IContextMenuService),
    __param(2, IClipboardService),
    __param(3, ILogService)
], TextInputActionsProvider);
export { TextInputActionsProvider };
registerWorkbenchContribution2(TextInputActionsProvider.ID, TextInputActionsProvider, 2 /* WorkbenchPhase.BlockRestore */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dElucHV0QWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYnJvd3Nlci9hY3Rpb25zL3RleHRJbnB1dEFjdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFXLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMvRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDM0MsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDekYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDM0YsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxXQUFXLEVBQUUscUJBQXFCLEVBQUUsaUJBQWlCLEVBQUUsU0FBUyxFQUFFLGtCQUFrQixFQUFFLHFCQUFxQixFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDM0osT0FBTyxFQUEwQyw4QkFBOEIsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3ZILE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzNGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxLQUFLLElBQUksU0FBUyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDbkUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3BELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUVsRSxNQUFNLFVBQVUsc0JBQXNCLENBQUMsZ0JBQW1DLEVBQUUsVUFBdUI7SUFDbEcsT0FBTztRQUVOLFFBQVEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUs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