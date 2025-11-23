/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { renderAsPlaintext } from '../../../../base/browser/markdownRenderer.js';
import { isMarkdownString, MarkdownString } from '../../../../base/common/htmlContent.js';
import { stripIcons } from '../../../../base/common/iconLabels.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { migrateLegacyTerminalToolSpecificData } from '../common/chat.js';
import { ChatContextKeys } from '../common/chatContextKeys.js';
import { IChatToolInvocation } from '../common/chatService.js';
import { isResponseVM } from '../common/chatViewModel.js';
import { toolContentToA11yString } from '../common/languageModelToolsService.js';
import { IChatWidgetService } from './chat.js';
export class ChatResponseAccessibleView {
    constructor() {
        this.priority = 100;
        this.name = 'panelChat';
        this.type = "view" /* AccessibleViewType.View */;
        this.when = ChatContextKeys.inChatSession;
    }
    getProvider(accessor) {
        const widgetService = accessor.get(IChatWidgetService);
        const widget = widgetService.lastFocusedWidget;
        if (!widget) {
            return;
        }
        const chatInputFocused = widget.hasInputFocus();
        if (chatInputFocused) {
            widget.focusResponseItem();
        }
        const verifiedWidget = widget;
        const focusedItem = verifiedWidget.getFocus();
        if (!focusedItem) {
            return;
        }
        return new ChatResponseAccessibleProvider(verifiedWidget, focusedItem, chatInputFocused);
    }
}
class ChatResponseAccessibleProvider extends Disposable {
    constructor(_widget, item, _wasOpenedFromInput) {
        super();
        this._widget = _widget;
        this._wasOpenedFromInput = _wasOpenedFromInput;
        this.id = "panelChat" /* AccessibleViewProviderId.PanelChat */;
        this.verbositySettingKey = "accessibility.verbosity.panelChat" /* AccessibilityVerbositySettingId.Chat */;
        this.options = { type: "view" /* AccessibleViewType.View */ };
        this._focusedItem = item;
    }
    provideContent() {
        return this._getContent(this._focusedItem);
    }
    _getContent(item) {
        let responseContent = isResponseVM(item) ? item.response.toString() : '';
        if (!responseContent && 'errorDetails' in item && item.errorDetails) {
            responseContent = item.errorDetails.message;
        }
        if (isResponseVM(item)) {
            item.response.value.filter(item => item.kind === 'elicitation2' || item.kind === 'elicitationSerialized').forEach(elicitation => {
                const title = elicitation.title;
                if (typeof title === 'string') {
                    responseContent += `${title}\n`;
                }
                else if (isMarkdownString(title)) {
                    responseContent += renderAsPlaintext(title, { includeCodeBlocksFences: true }) + '\n';
                }
                const message = elicitation.message;
                if (isMarkdownString(message)) {
                    responseContent += renderAsPlaintext(message, { includeCodeBlocksFences: true });
                }
                else {
                    responseContent += message;
                }
            });
            const toolInvocations = item.response.value.filter(item => item.kind === 'toolInvocation');
            for (const toolInvocation of toolInvocations) {
                const state = toolInvocation.state.get();
                if (toolInvocation.confirmationMessages?.title && state.type === 0 /* IChatToolInvocation.StateKind.WaitingForConfirmation */) {
                    const title = typeof toolInvocation.confirmationMessages.title === 'string' ? toolInvocation.confirmationMessages.title : toolInvocation.confirmationMessages.title.value;
                    const message = typeof toolInvocation.confirmationMessages.message === 'string' ? toolInvocation.confirmationMessages.message : stripIcons(renderAsPlaintext(toolInvocation.confirmationMessages.message));
                    let input = '';
                    if (toolInvocation.toolSpecificData) {
                        if (toolInvocation.toolSpecificData?.kind === 'terminal') {
                            const terminalData = migrateLegacyTerminalToolSpecificData(toolInvocation.toolSpecificData);
                            input = terminalData.commandLine.userEdited ?? terminalData.commandLine.toolEdited ?? terminalData.commandLine.original;
                        }
                        else {
                            input = toolInvocation.toolSpecificData?.kind === 'extensions'
                                ? JSON.stringify(toolInvocation.toolSpecificData.extensions)
                                : toolInvocation.toolSpecificData?.kind === 'todoList'
                                    ? JSON.stringify(toolInvocation.toolSpecificData.todoList)
                                    : toolInvocation.toolSpecificData?.kind === 'pullRequest'
                                        ? JSON.stringify(toolInvocation.toolSpecificData)
                                        : JSON.stringify(toolInvocation.toolSpecificData.rawInput);
                        }
                    }
                    responseContent += `${title}`;
                    if (input) {
                        responseContent += `: ${input}`;
                    }
                    responseContent += `\n${message}\n`;
                }
                else if (state.type === 2 /* IChatToolInvocation.StateKind.WaitingForPostApproval */) {
                    responseContent += localize('toolPostApprovalA11yView', "Approve results of {0}? Result: ", toolInvocation.toolId) + toolContentToA11yString(state.contentForModel) + '\n';
                }
                else {
                    const resultDetails = IChatToolInvocation.resultDetails(toolInvocation);
                    if (resultDetails && 'input' in resultDetails) {
                        responseContent += '\n' + (resultDetails.isError ? 'Errored ' : 'Completed ');
                        responseContent += `${`${typeof toolInvocation.invocationMessage === 'string' ? toolInvocation.invocationMessage : stripIcons(renderAsPlaintext(toolInvocation.invocationMessage))} with input: ${resultDetails.input}`}\n`;
                    }
                }
            }
            const pastConfirmations = item.response.value.filter(item => item.kind === 'toolInvocationSerialized');
            for (const pastConfirmation of pastConfirmations) {
                if (pastConfirmation.isComplete && pastConfirmation.resultDetails && 'input' in pastConfirmation.resultDetails) {
                    if (pastConfirmation.pastTenseMessage) {
                        responseContent += `\n${`${typeof pastConfirmation.pastTenseMessage === 'string' ? pastConfirmation.pastTenseMessage : stripIcons(renderAsPlaintext(pastConfirmation.pastTenseMessage))} with input: ${pastConfirmation.resultDetails.input}`}\n`;
                    }
                }
            }
        }
        return renderAsPlaintext(new MarkdownString(responseContent), { includeCodeBlocksFences: true });
    }
    onClose() {
        this._widget.reveal(this._focusedItem);
        if (this._wasOpenedFromInput) {
            this._widget.focusInput();
        }
        else {
            this._widget.focus(this._focusedItem);
        }
    }
    provideNextContent() {
        const next = this._widget.getSibling(this._focusedItem, 'next');
        if (next) {
            this._focusedItem = next;
            return this._getContent(next);
        }
        return;
    }
    providePreviousContent() {
        const previous = this._widget.getSibling(this._focusedItem, 'previous');
        if (previous) {
            this._focusedItem = previous;
            return this._getContent(previous);
        }
        return;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFJlc3BvbnNlQWNjZXNzaWJsZVZpZXcuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRSZXNwb25zZUFjY2Vzc2libGVWaWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxjQUFjLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUMxRixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDbkUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUs5QyxPQUFPLEVBQUUscUNBQXFDLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUMxRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDL0QsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQzFELE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pGLE9BQU8sRUFBNkIsa0JBQWtCLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFFMUUsTUFBTSxPQUFPLDBCQUEwQjtJQUF2QztRQUNVLGFBQVEsR0FBRyxHQUFHLENBQUM7UUFDZixTQUFJLEdBQUcsV0FBVyxDQUFDO1FBQ25CLFNBQUksd0NBQTJCO1FBQy9CLFNBQUksR0FBRyxlQUFlLENBQUMsYUFBYSxDQUFDO0lBb0IvQyxDQUFDO0lBbkJBLFdBQVcsQ0FBQyxRQUEwQjtRQUNyQyxNQUFNLGFBQWEsR0FBRyxRQUFR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