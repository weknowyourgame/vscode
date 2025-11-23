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
import { renderAsPlaintext } from '../../../../base/browser/markdownRenderer.js';
import { alert, status } from '../../../../base/browser/ui/aria/aria.js';
import { Event } from '../../../../base/common/event.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { AccessibilityProgressSignalScheduler } from '../../../../platform/accessibilitySignal/browser/progressAccessibilitySignalScheduler.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { ChatConfiguration } from '../common/constants.js';
import { IChatWidgetService } from './chat.js';
const CHAT_RESPONSE_PENDING_ALLOWANCE_MS = 4000;
let ChatAccessibilityService = class ChatAccessibilityService extends Disposable {
    constructor(_accessibilitySignalService, _instantiationService, _configurationService, _hostService, _widgetService) {
        super();
        this._accessibilitySignalService = _accessibilitySignalService;
        this._instantiationService = _instantiationService;
        this._configurationService = _configurationService;
        this._hostService = _hostService;
        this._widgetService = _widgetService;
        this._pendingSignalMap = this._register(new DisposableMap());
        this._requestId = 0;
        this.notifications = new Set();
    }
    dispose() {
        for (const ds of Array.from(this.notifications)) {
            ds.dispose();
        }
        this.notifications.clear();
        super.dispose();
    }
    acceptRequest() {
        this._requestId++;
        this._accessibilitySignalService.playSignal(AccessibilitySignal.chatRequestSent, { allowManyInParallel: true });
        this._pendingSignalMap.set(this._requestId, this._instantiationService.createInstance(AccessibilityProgressSignalScheduler, CHAT_RESPONSE_PENDING_ALLOWANCE_MS, undefined));
        return this._requestId;
    }
    acceptResponse(widget, container, response, requestId, isVoiceInput) {
        this._pendingSignalMap.deleteAndDispose(requestId);
        const isPanelChat = typeof response !== 'string';
        const responseContent = typeof response === 'string' ? response : response?.response.toString();
        this._accessibilitySignalService.playSignal(AccessibilitySignal.chatResponseReceived, { allowManyInParallel: true });
        if (!response || !responseContent) {
            return;
        }
        const plainTextResponse = renderAsPlaintext(new MarkdownString(responseContent));
        const errorDetails = isPanelChat && response.errorDetails ? ` ${response.errorDetails.message}` : '';
        this._showOSNotification(widget, container, plainTextResponse + errorDetails);
        if (!isVoiceInput || this._configurationService.getValue("accessibility.voice.autoSynthesize" /* AccessibilityVoiceSettingId.AutoSynthesize */) !== 'on') {
            status(plainTextResponse + errorDetails);
        }
    }
    acceptElicitation(elicitation) {
        if (elicitation.state.get() !== "pending" /* ElicitationState.Pending */) {
            return;
        }
        const title = typeof elicitation.title === 'string' ? elicitation.title : elicitation.title.value;
        const message = typeof elicitation.message === 'string' ? elicitation.message : elicitation.message.value;
        alert(title + ' ' + message);
        this._accessibilitySignalService.playSignal(AccessibilitySignal.chatUserActionRequired, { allowManyInParallel: true });
    }
    async _showOSNotification(widget, container, responseContent) {
        if (!this._configurationService.getValue(ChatConfiguration.NotifyWindowOnResponseReceived)) {
            return;
        }
        const targetWindow = dom.getWindow(container);
        if (!targetWindow) {
            return;
        }
        if (targetWindow.document.hasFocus()) {
            return;
        }
        // Don't show notification if there's no meaningful content
        if (!responseContent || !responseContent.trim()) {
            return;
        }
        await this._hostService.focus(targetWindow, { mode: 1 /* FocusMode.Notify */ });
        // Dispose any previous unhandled notifications to avoid replacement/coalescing.
        for (const ds of Array.from(this.notifications)) {
            ds.dispose();
            this.notifications.delete(ds);
        }
        const title = widget?.viewModel?.model.title ? localize('chatTitle', "Chat: {0}", widget.viewModel.model.title) : localize('chat.untitledChat', "Untitled Chat");
        const notification = await dom.triggerNotification(title, {
            detail: localize('notificationDetail', "New chat response.")
        });
        if (!notification) {
            return;
        }
        const disposables = new DisposableStore();
        disposables.add(notification);
        this.notifications.add(disposables);
        disposables.add(Event.once(notification.onClick)(async () => {
            await this._hostService.focus(targetWindow, { mode: 2 /* FocusMode.Force */ });
            await this._widgetService.reveal(widget);
            widget.focusInput();
            disposables.dispose();
            this.notifications.delete(disposables);
        }));
        disposables.add(this._hostService.onDidChangeFocus(focus => {
            if (focus) {
                disposables.dispose();
                this.notifications.delete(disposables);
            }
        }));
    }
};
ChatAccessibilityService = __decorate([
    __param(0, IAccessibilitySignalService),
    __param(1, IInstantiationService),
    __param(2, IConfigurationService),
    __param(3, IHostService),
    __param(4, IChatWidgetService)
], ChatAccessibilityService);
export { ChatAccessibilityService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEFjY2Vzc2liaWxpdHlTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0QWNjZXNzaWJpbGl0eVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNqRixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSwyQkFBMkIsRUFBRSxNQUFNLGdGQUFnRixDQUFDO0FBQ2xKLE9BQU8sRUFBRSxvQ0FBb0MsRUFBRSxNQUFNLDBGQUEwRixDQUFDO0FBQ2hKLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRW5HLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUl0RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUMzRCxPQUFPLEVBQTZCLGtCQUFrQixFQUFFLE1BQU0sV0FBVyxDQUFDO0FBRzFFLE1BQU0sa0NBQWtDLEdBQUcsSUFBSSxD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