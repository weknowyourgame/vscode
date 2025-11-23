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
import * as dom from '../../../../base/browser/dom.js';
import { raceCancellablePromises, timeout } from '../../../../base/common/async.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { combinedDisposable, Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { isEqual } from '../../../../base/common/resources.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { IEditorService } from '../../../../workbench/services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { ChatViewId, ChatViewPaneTarget, IQuickChatService, isIChatViewViewContext } from './chat.js';
import { ChatEditor } from './chatEditor.js';
import { findExistingChatEditorByUri } from './chatSessions/common.js';
let ChatWidgetService = class ChatWidgetService extends Disposable {
    constructor(editorGroupsService, viewsService, quickChatService, layoutService, editorService) {
        super();
        this.editorGroupsService = editorGroupsService;
        this.viewsService = viewsService;
        this.quickChatService = quickChatService;
        this.layoutService = layoutService;
        this.editorService = editorService;
        this._widgets = [];
        this._lastFocusedWidget = undefined;
        this._onDidAddWidget = this._register(new Emitter());
        this.onDidAddWidget = this._onDidAddWidget.event;
    }
    get lastFocusedWidget() {
        return this._lastFocusedWidget;
    }
    getAllWidgets() {
        return this._widgets;
    }
    getWidgetsByLocations(location) {
        return this._widgets.filter(w => w.location === location);
    }
    getWidgetByInputUri(uri) {
        return this._widgets.find(w => isEqual(w.input.inputUri, uri));
    }
    getWidgetBySessionResource(sessionResource) {
        return this._widgets.find(w => isEqual(w.viewModel?.sessionResource, sessionResource));
    }
    async revealWidget(preserveFocus) {
        const last = this.lastFocusedWidget;
        if (last && await this.reveal(last, preserveFocus)) {
            return last;
        }
        return (await this.viewsService.openView(ChatViewId, !preserveFocus))?.widget;
    }
    async reveal(widget, preserveFocus) {
        if (widget.viewModel?.sessionResource) {
            const alreadyOpenWidget = await this.revealSessionIfAlreadyOpen(widget.viewModel.sessionResource, preserveFocus);
            if (alreadyOpenWidget) {
                return true;
            }
        }
        if (isIChatViewViewContext(widget.viewContext)) {
            const view = await this.viewsService.openView(widget.viewContext.viewId, !preserveFocus);
            if (!preserveFocus) {
                view?.focus();
            }
            return !!view;
        }
        return false;
    }
    async openSession(sessionResource, target, options) {
        const alreadyOpenWidget = await this.revealSessionIfAlreadyOpen(sessionResource, options?.preserveFocus);
        if (alreadyOpenWidget) {
            return alreadyOpenWidget;
        }
        // Load this session in chat view
        if (target === ChatViewPaneTarget) {
            const chatViewPane = await this.viewsService.openView(ChatViewId, true);
            if (chatViewPane) {
                await chatViewPane.loadSession(sessionResource);
                if (!options?.preserveFocus) {
                    chatViewPane.focusInput();
                }
            }
            return chatViewPane?.widget;
        }
        // Open in chat editor
        const pane = await this.editorService.openEditor({ resource: sessionResource, options }, target);
        return pane instanceof ChatEditor ? pane.widget : undefined;
    }
    async revealSessionIfAlreadyOpen(sessionResource, preserveFocus) {
        // Already open in chat view?
        const chatView = this.viewsService.getViewWithId(ChatViewId);
        if (chatView?.widget.viewModel?.sessionResource && isEqual(chatView.widget.viewModel.sessionResource, sessionResource)) {
            const view = await this.viewsService.openView(ChatViewId, true);
            if (!preserveFocus) {
                view?.focus();
            }
            return chatView.widget;
        }
        // Already open in an editor?
        const existingEditor = findExistingChatEditorByUri(sessionResource, this.editorGroupsService);
        if (existingEditor) {
            // focus transfer to other documents is async. If we depend on the focus
            // being synchronously transferred in consuming code, this can fail, so
            // wait for it to propagate
            const isGroupActive = () => dom.getWindowId(dom.getWindow(this.layoutService.activeContainer)) === existingEditor.group.windowId;
            let ensureFocusTransfer;
            if (!isGroupActive()) {
                ensureFocusTransfer = raceCancellablePromises([
                    timeout(500),
                    Event.toPromise(Event.once(Event.filter(this.layoutService.onDidChangeActiveContainer, isGroupActive))),
                ]);
            }
            const pane = await this.editorService.openEditor(existingEditor.editor, { preserveFocus }, existingEditor.group);
            await ensureFocusTransfer;
            return pane instanceof ChatEditor ? pane.widget : undefined;
        }
        // Already open in quick chat?
        if (isEqual(sessionResource, this.quickChatService.sessionResource)) {
            this.quickChatService.focus();
            return undefined;
        }
        return undefined;
    }
    setLastFocusedWidget(widget) {
        if (widget === this._lastFocusedWidget) {
            return;
        }
        this._lastFocusedWidget = widget;
    }
    register(newWidget) {
        if (this._widgets.some(widget => widget === newWidget)) {
            throw new Error('Cannot register the same widget multiple times');
        }
        this._widgets.push(newWidget);
        this._onDidAddWidget.fire(newWidget);
        return combinedDisposable(newWidget.onDidFocus(() => this.setLastFocusedWidget(newWidget)), toDisposable(() => this._widgets.splice(this._widgets.indexOf(newWidget), 1)));
    }
};
ChatWidgetService = __decorate([
    __param(0, IEditorGroupsService),
    __param(1, IViewsService),
    __param(2, IQuickChatService),
    __param(3, ILayoutService),
    __param(4, IEditorService)
], ChatWidgetService);
export { ChatWidgetService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFdpZGdldFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRXaWRnZXRTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLFVBQVUsRUFBZSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqSCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFL0QsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxjQUFjLEVBQWtCLE1BQU0sK0RBQStELENBQUM7QUFDL0csT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDOUYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBRS9FLE9BQU8sRUFBRSxVQUFVLEVBQUUsa0JBQWtCLEVBQW1DLGlCQUFpQixFQUFFLHNCQUFzQixFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQ3ZJLE9BQU8sRUFBRSxVQUFVLEVBQXNCLE1BQU0saUJBQWlCLENBQUM7QUFDakUsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFHaEUsSUFBTSxpQkFBaUIsR0FBdkIsTUFBTSxpQkFBa0IsU0FBUSxVQUFVO0lBVWhELFlBQ3VCLG1CQUEwRCxFQUNqRSxZQUE0QyxFQUN4QyxnQkFBb0QsRUFDdkQsYUFB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