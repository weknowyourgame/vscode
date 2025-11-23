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
import { $, append } from '../../../../../base/browser/dom.js';
import { alert } from '../../../../../base/browser/ui/aria/aria.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { createMarkdownCommandLink, MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Disposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { localize } from '../../../../../nls.js';
import { IChatToolInvocation } from '../../common/chatService.js';
import { isResponseVM } from '../../common/chatViewModel.js';
import { renderFileWidgets } from '../chatInlineAnchorWidget.js';
import { IChatMarkdownAnchorService } from './chatMarkdownAnchorService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { ILanguageModelToolsService } from '../../common/languageModelToolsService.js';
let ChatProgressContentPart = class ChatProgressContentPart extends Disposable {
    constructor(progress, chatContentMarkdownRenderer, context, forceShowSpinner, forceShowMessage, icon, toolInvocation, instantiationService, chatMarkdownAnchorService, configurationService) {
        super();
        this.chatContentMarkdownRenderer = chatContentMarkdownRenderer;
        this.toolInvocation = toolInvocation;
        this.instantiationService = instantiationService;
        this.chatMarkdownAnchorService = chatMarkdownAnchorService;
        this.configurationService = configurationService;
        this.renderedMessage = this._register(new MutableDisposable());
        const followingContent = context.content.slice(context.contentIndex + 1);
        this.showSpinner = forceShowSpinner ?? shouldShowSpinner(followingContent, context.element);
        this.isHidden = forceShowMessage !== true && followingContent.some(part => part.kind !== 'progressMessage');
        if (this.isHidden) {
            // Placeholder, don't show the progress message
            this.domNode = $('');
            return;
        }
        if (this.showSpinner && !this.configurationService.getValue("accessibility.verboseChatProgressUpdates" /* AccessibilityWorkbenchSettingId.VerboseChatProgressUpdates */)) {
            // TODO@roblourens is this the right place for this?
            // this step is in progress, communicate it to SR users
            alert(progress.content.value);
        }
        const codicon = icon ? icon : this.showSpinner ? ThemeIcon.modify(Codicon.loading, 'spin') : Codicon.check;
        const result = this.chatContentMarkdownRenderer.render(progress.content);
        result.element.classList.add('progress-step');
        renderFileWidgets(result.element, this.instantiationService, this.chatMarkdownAnchorService, this._store);
        const tooltip = this.createApprovalMessage();
        const progressPart = this._register(instantiationService.createInstance(ChatProgressSubPart, result.element, codicon, tooltip));
        this.domNode = progressPart.domNode;
        this.renderedMessage.value = result;
    }
    updateMessage(content) {
        if (this.isHidden) {
            return;
        }
        // Render the new message
        const result = this._register(this.chatContentMarkdownRenderer.render(content));
        result.element.classList.add('progress-step');
        renderFileWidgets(result.element, this.instantiationService, this.chatMarkdownAnchorService, this._store);
        // Replace the old message container with the new one
        if (this.renderedMessage.value) {
            this.renderedMessage.value.element.replaceWith(result.element);
        }
        else {
            this.domNode.appendChild(result.element);
        }
        this.renderedMessage.value = result;
    }
    hasSameContent(other, followingContent, element) {
        // Progress parts render render until some other content shows up, then they hide.
        // When some other content shows up, need to signal to be rerendered as hidden.
        if (followingContent.some(part => part.kind !== 'progressMessage') && !this.isHidden) {
            return false;
        }
        // Needs rerender when spinner state changes
        const showSpinner = shouldShowSpinner(followingContent, element);
        return other.kind === 'progressMessage' && this.showSpinner === showSpinner;
    }
    createApprovalMessage() {
        if (!this.toolInvocation) {
            return undefined;
        }
        const reason = IChatToolInvocation.executionConfirmedOrDenied(this.toolInvocation);
        if (!reason || typeof reason === 'boolean') {
            return undefined;
        }
        let md;
        switch (reason.type) {
            case 2 /* ToolConfirmKind.Setting */:
                md = localize('chat.autoapprove.setting', 'Auto approved by {0}', createMarkdownCommandLink({ title: '`' + reason.id + '`', id: 'workbench.action.openSettings', arguments: [reason.id] }, false));
                break;
            case 3 /* ToolConfirmKind.LmServicePerTool */:
                md = reason.scope === 'session'
                    ? localize('chat.autoapprove.lmServicePerTool.session', 'Auto approved for this session')
                    : reason.scope === 'workspace'
                        ? localize('chat.autoapprove.lmServicePerTool.workspace', 'Auto approved for this workspace')
                        : localize('chat.autoapprove.lmServicePerTool.profile', 'Auto approved for this profile');
                md += ' (' + createMarkdownCommandLink({ title: localize('edit', 'Edit'), id: 'workbench.action.chat.editToolApproval', arguments: [reason.scope] }) + ')';
                break;
            case 4 /* ToolConfirmKind.UserAction */:
            case 0 /* ToolConfirmKind.Denied */:
            case 1 /* ToolConfirmKind.ConfirmationNotNeeded */:
            default:
                return;
        }
        if (!md) {
            return undefined;
        }
        return new MarkdownString(md, { isTrusted: true });
    }
};
ChatProgressContentPart = __decorate([
    __param(7, IInstantiationService),
    __param(8, IChatMarkdownAnchorService),
    __param(9, IConfigurationService)
], ChatProgressContentPart);
export { ChatProgressContentPart };
function shouldShowSpinner(followingContent, element) {
    return isResponseVM(element) && !element.isComplete && followingContent.length === 0;
}
let ChatProgressSubPart = class ChatProgressSubPart extends Disposable {
    constructor(messageElement, icon, tooltip, hoverService) {
        super();
        this.domNode = $('.progress-container');
        const iconElement = $('div');
        iconElement.classList.add(...ThemeIcon.asClassNameArray(icon));
        if (tooltip) {
            this._register(hoverService.setupDelayedHover(iconElement, {
                content: tooltip,
                style: 1 /* HoverStyle.Pointer */,
            }));
        }
        append(this.domNode, iconElement);
        messageElement.classList.add('progress-step');
        append(this.domNode, messageElement);
    }
};
ChatProgressSubPart = __decorate([
    __param(3, IHoverService)
], ChatProgressSubPart);
export { ChatProgressSubPart };
let ChatWorkingProgressContentPart = class ChatWorkingProgressContentPart extends ChatProgressContentPart {
    constructor(_workingProgress, chatContentMarkdownRenderer, context, instantiationService, chatMarkdownAnchorService, configurationService, languageModelToolsService) {
        const progressMessage = {
            kind: 'progressMessage',
            content: new MarkdownString().appendText(localize('workingMessage', "Working..."))
        };
        super(progressMessage, chatContentMarkdownRenderer, context, undefined, undefined, undefined, undefined, instantiationService, chatMarkdownAnchorService, configurationService);
        this._register(languageModelToolsService.onDidPrepareToolCallBecomeUnresponsive(e => {
            if (context.element.sessionId === e.sessionId) {
                this.updateMessage(new MarkdownString(localize('toolCallUnresponsive', "Waiting for tool '{0}' to respond...", e.toolData.displayName)));
            }
        }));
    }
    hasSameContent(other, followingContent, element) {
        return other.kind === 'working';
    }
};
ChatWorkingProgressContentPart = __decorate([
    __param(3, IInstantiationService),
    __param(4, IChatMarkdownAnchorService),
    __param(5, IConfigurationService),
    __param(6, ILanguageModelToolsService)
], ChatWorkingProgressContentPart);
export { ChatWorkingProgressContentPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFByb2dyZXNzQ29udGVudFBhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRDb250ZW50UGFydHMvY2hhdFByb2dyZXNzQ29udGVudFBhcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDcEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxjQUFjLEVBQXdCLE1BQU0sMkNBQTJDLENBQUM7QUFDNUgsT0FBTyxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUdwRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUF3RCxtQkFBbUIsRUFBa0QsTUFBTSw2QkFBNkIsQ0FBQztBQUN4SyxPQUFPLEVBQXdCLFlBQVksRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBRW5GLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRWpFLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBRXRHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUUvRSxPQUFPLEVBQUUs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