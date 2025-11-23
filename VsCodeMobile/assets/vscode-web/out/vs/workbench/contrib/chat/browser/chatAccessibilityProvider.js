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
import { marked } from '../../../../base/common/marked/marked.js';
import { isDefined } from '../../../../base/common/types.js';
import { localize } from '../../../../nls.js';
import { IAccessibleViewService } from '../../../../platform/accessibility/browser/accessibleView.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { migrateLegacyTerminalToolSpecificData } from '../common/chat.js';
import { isRequestVM, isResponseVM } from '../common/chatViewModel.js';
import { toolContentToA11yString } from '../common/languageModelToolsService.js';
import { CancelChatActionId } from './actions/chatExecuteActions.js';
import { AcceptToolConfirmationActionId } from './actions/chatToolActions.js';
export const getToolConfirmationAlert = (accessor, toolInvocation) => {
    const keybindingService = accessor.get(IKeybindingService);
    const contextKeyService = accessor.get(IContextKeyService);
    const acceptKb = keybindingService.lookupKeybinding(AcceptToolConfirmationActionId, contextKeyService)?.getAriaLabel();
    const cancelKb = keybindingService.lookupKeybinding(CancelChatActionId, contextKeyService)?.getAriaLabel();
    const text = toolInvocation.map(v => {
        const state = v.state.get();
        if (state.type === 2 /* IChatToolInvocation.StateKind.WaitingForPostApproval */) {
            return {
                title: localize('toolPostApprovalTitle', "Approve results of tool"),
                detail: toolContentToA11yString(state.contentForModel),
            };
        }
        if (!(v.confirmationMessages?.message && state.type === 0 /* IChatToolInvocation.StateKind.WaitingForConfirmation */)) {
            return;
        }
        let input = '';
        if (v.toolSpecificData) {
            if (v.toolSpecificData.kind === 'terminal') {
                const terminalData = migrateLegacyTerminalToolSpecificData(v.toolSpecificData);
                input = terminalData.commandLine.toolEdited ?? terminalData.commandLine.original;
            }
            else if (v.toolSpecificData.kind === 'extensions') {
                input = JSON.stringify(v.toolSpecificData.extensions);
            }
            else if (v.toolSpecificData.kind === 'input') {
                input = JSON.stringify(v.toolSpecificData.rawInput);
            }
        }
        const titleObj = v.confirmationMessages?.title;
        const title = typeof titleObj === 'string' ? titleObj : titleObj?.value || '';
        return {
            title: (title + (input ? ': ' + input : '')).trim(),
            detail: undefined,
        };
    }).filter(isDefined);
    let message = acceptKb && cancelKb
        ? localize('toolInvocationsHintKb', "Chat confirmation required: {0}. Press {1} to accept or {2} to cancel.", text.map(t => t.title).join(', '), acceptKb, cancelKb)
        : localize('toolInvocationsHint', "Chat confirmation required: {0}", text.map(t => t.title).join(', '));
    if (text.some(t => t.detail)) {
        message += ' ' + localize('toolInvocationsHintDetails', "Details: {0}", text.map(t => t.detail ? t.detail : '').join(' '));
    }
    return message;
};
let ChatAccessibilityProvider = class ChatAccessibilityProvider {
    constructor(_accessibleViewService, _instantiationService) {
        this._accessibleViewService = _accessibleViewService;
        this._instantiationService = _instantiationService;
    }
    getWidgetRole() {
        return 'list';
    }
    getRole(element) {
        return 'listitem';
    }
    getWidgetAriaLabel() {
        return localize('chat', "Chat");
    }
    getAriaLabel(element) {
        if (isRequestVM(element)) {
            return element.messageText;
        }
        if (isResponseVM(element)) {
            return this._getLabelWithInfo(element);
        }
        return '';
    }
    _getLabelWithInfo(element) {
        const accessibleViewHint = this._accessibleViewService.getOpenAriaHint("accessibility.verbosity.panelChat" /* AccessibilityVerbositySettingId.Chat */);
        let label = '';
        const toolInvocation = element.response.value.filter(v => v.kind === 'toolInvocation');
        let toolInvocationHint = '';
        if (toolInvocation.length) {
            const waitingForConfirmation = toolInvocation.filter(v => {
                const state = v.state.get().type;
                return state === 0 /* IChatToolInvocation.StateKind.WaitingForConfirmation */ || state === 2 /* IChatToolInvocation.StateKind.WaitingForPostApproval */;
            });
            if (waitingForConfirmation.length) {
                toolInvocationHint = this._instantiationService.invokeFunction(getToolConfirmationAlert, toolInvocation);
            }
        }
        const tableCount = marked.lexer(element.response.toString()).filter(token => token.type === 'table')?.length ?? 0;
        let tableCountHint = '';
        switch (tableCount) {
            case 0:
                break;
            case 1:
                tableCountHint = localize('singleTableHint', "1 table ");
                break;
            default:
                tableCountHint = localize('multiTableHint', "{0} tables ", tableCount);
                break;
        }
        const fileTreeCount = element.response.value.filter(v => v.kind === 'treeData').length ?? 0;
        let fileTreeCountHint = '';
        switch (fileTreeCount) {
            case 0:
                break;
            case 1:
                fileTreeCountHint = localize('singleFileTreeHint', "1 file tree ");
                break;
            default:
                fileTreeCountHint = localize('multiFileTreeHint', "{0} file trees ", fileTreeCount);
                break;
        }
        const elicitationCount = element.response.value.filter(v => v.kind === 'elicitation2' || v.kind === 'elicitationSerialized');
        let elicitationHint = '';
        for (const elicitation of elicitationCount) {
            const title = typeof elicitation.title === 'string' ? elicitation.title : elicitation.title.value;
            const message = typeof elicitation.message === 'string' ? elicitation.message : elicitation.message.value;
            elicitationHint += title + ' ' + message;
        }
        const codeBlockCount = marked.lexer(element.response.toString()).filter(token => token.type === 'code')?.length ?? 0;
        switch (codeBlockCount) {
            case 0:
                label = accessibleViewHint
                    ? localize('noCodeBlocksHint', "{0}{1}{2}{3}{4} {5}", toolInvocationHint, fileTreeCountHint, elicitationHint, tableCountHint, element.response.toString(), accessibleViewHint)
                    : localize('noCodeBlocks', "{0}{1}{2} {3}", fileTreeCountHint, elicitationHint, tableCountHint, element.response.toString());
                break;
            case 1:
                label = accessibleViewHint
                    ? localize('singleCodeBlockHint', "{0}{1}{2}1 code block: {3} {4}{5}", toolInvocationHint, fileTreeCountHint, elicitationHint, tableCountHint, element.response.toString(), accessibleViewHint)
                    : localize('singleCodeBlock', "{0}{1}1 code block: {2} {3}", fileTreeCountHint, elicitationHint, tableCountHint, element.response.toString());
                break;
            default:
                label = accessibleViewHint
                    ? localize('multiCodeBlockHint', "{0}{1}{2}{3} code blocks: {4}{5} {6}", toolInvocationHint, fileTreeCountHint, elicitationHint, tableCountHint, codeBlockCount, element.response.toString(), accessibleViewHint)
                    : localize('multiCodeBlock', "{0}{1}{2} code blocks: {3} {4}", fileTreeCountHint, elicitationHint, codeBlockCount, tableCountHint, element.response.toString());
                break;
        }
        return label;
    }
};
ChatAccessibilityProvider = __decorate([
    __param(0, IAccessibleViewService),
    __param(1, IInstantiationService)
], ChatAccessibilityProvider);
export { ChatAccessibilityProvider };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEFjY2Vzc2liaWxpdHlQcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEFjY2Vzc2liaWxpdHlQcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUloRyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUN0RyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFPLEVBQUUscUJBQXFCLEVBQW9CLE1BQU0sNERBQTRELENBQUM7QUFDckgsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFMUYsT0FBTyxFQUFFLHFDQUFxQyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFFMUUsT0FBTyxFQUEwQixXQUFXLEVBQUUsWUFBWSxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDL0YsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDckUsT0FBTyxFQUFFLDhCQUE4QixFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFHOUUsTUFBTSxDQUFDLE1BQU0sd0JBQXdCLEdBQUcsQ0FBQyxRQUEwQixFQUFFLGNBQXFDLEVBQUUsRUFBRTtJQUM3RyxNQUFNLGlCQUFpQixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUMzRCxNQUFN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