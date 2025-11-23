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
var ChatInputOutputMarkdownProgressPart_1;
import { ProgressBar } from '../../../../../../base/browser/ui/progressbar/progressbar.js';
import { decodeBase64 } from '../../../../../../base/common/buffer.js';
import { createMarkdownCommandLink, MarkdownString } from '../../../../../../base/common/htmlContent.js';
import { Lazy } from '../../../../../../base/common/lazy.js';
import { toDisposable } from '../../../../../../base/common/lifecycle.js';
import { getExtensionForMimeType } from '../../../../../../base/common/mime.js';
import { autorun } from '../../../../../../base/common/observable.js';
import { basename } from '../../../../../../base/common/resources.js';
import { ILanguageService } from '../../../../../../editor/common/languages/language.js';
import { IModelService } from '../../../../../../editor/common/services/model.js';
import { localize } from '../../../../../../nls.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { ChatResponseResource } from '../../../common/chatModel.js';
import { IChatToolInvocation } from '../../../common/chatService.js';
import { ChatCollapsibleInputOutputContentPart } from '../chatToolInputOutputContentPart.js';
import { BaseChatToolInvocationSubPart } from './chatToolInvocationSubPart.js';
let ChatInputOutputMarkdownProgressPart = class ChatInputOutputMarkdownProgressPart extends BaseChatToolInvocationSubPart {
    static { ChatInputOutputMarkdownProgressPart_1 = this; }
    /** Remembers expanded tool parts on re-render */
    static { this._expandedByDefault = new WeakMap(); }
    get codeblocks() {
        return this._codeblocks;
    }
    constructor(toolInvocation, context, codeBlockStartIndex, message, subtitle, input, output, isError, instantiationService, modelService, languageService) {
        super(toolInvocation);
        this._codeblocks = [];
        let codeBlockIndex = codeBlockStartIndex;
        const toCodePart = (data) => {
            const model = this._register(modelService.createModel(data, languageService.createById('json'), undefined, true));
            return {
                kind: 'code',
                textModel: model,
                languageId: model.getLanguageId(),
                options: {
                    hideToolbar: true,
                    reserveWidth: 19,
                    maxHeightInLines: 13,
                    verticalPadding: 5,
                    editorOptions: {
                        wordWrap: 'on'
                    }
                },
                codeBlockInfo: {
                    codeBlockIndex: codeBlockIndex++,
                    codemapperUri: undefined,
                    elementId: context.element.id,
                    focus: () => { },
                    ownerMarkdownPartId: this.codeblocksPartId,
                    uri: model.uri,
                    chatSessionResource: context.element.sessionResource,
                    uriPromise: Promise.resolve(model.uri)
                }
            };
        };
        let processedOutput = output;
        if (typeof output === 'string') { // back compat with older stored versions
            processedOutput = [{ type: 'embed', value: output, isText: true }];
        }
        const collapsibleListPart = this._register(instantiationService.createInstance(ChatCollapsibleInputOutputContentPart, message, subtitle, this.getAutoApproveMessageContent(), context, toCodePart(input), processedOutput && {
            parts: processedOutput.map((o, i) => {
                const permalinkBasename = o.type === 'ref' || o.uri
                    ? basename(o.uri)
                    : o.mimeType && getExtensionForMimeType(o.mimeType)
                        ? `file${getExtensionForMimeType(o.mimeType)}`
                        : 'file' + (o.isText ? '.txt' : '.bin');
                if (o.type === 'ref') {
                    return { kind: 'data', uri: o.uri, mimeType: o.mimeType };
                }
                else if (o.isText && !o.asResource) {
                    return toCodePart(o.value);
                }
                else {
                    let decoded;
                    try {
                        if (!o.isText) {
                            decoded = decodeBase64(o.value).buffer;
                        }
                    }
                    catch {
                        // ignored
                    }
                    // Fall back to text if it's not valid base64
                    const permalinkUri = ChatResponseResource.createUri(context.element.sessionId, toolInvocation.toolCallId, i, permalinkBasename);
                    return { kind: 'data', value: decoded || new TextEncoder().encode(o.value), mimeType: o.mimeType, uri: permalinkUri, audience: o.audience };
                }
            }),
        }, isError, ChatInputOutputMarkdownProgressPart_1._expandedByDefault.get(toolInvocation) ?? false));
        this._codeblocks.push(...collapsibleListPart.codeblocks);
        this._register(collapsibleListPart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
        this._register(toDisposable(() => ChatInputOutputMarkdownProgressPart_1._expandedByDefault.set(toolInvocation, collapsibleListPart.expanded)));
        const progressObservable = toolInvocation.kind === 'toolInvocation' ? toolInvocation.state.map((s, r) => s.type === 1 /* IChatToolInvocation.StateKind.Executing */ ? s.progress.read(r) : undefined) : undefined;
        const progressBar = new Lazy(() => this._register(new ProgressBar(collapsibleListPart.domNode)));
        if (progressObservable) {
            this._register(autorun(reader => {
                const progress = progressObservable?.read(reader);
                if (progress?.message) {
                    collapsibleListPart.title = progress.message;
                }
                if (progress?.progress && !IChatToolInvocation.isComplete(toolInvocation, reader)) {
                    progressBar.value.setWorked(progress.progress * 100);
                }
            }));
        }
        this.domNode = collapsibleListPart.domNode;
    }
    getAutoApproveMessageContent() {
        const reason = IChatToolInvocation.executionConfirmedOrDenied(this.toolInvocation);
        if (!reason || typeof reason === 'boolean') {
            return;
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
        return new MarkdownString(md, { isTrusted: true });
    }
};
ChatInputOutputMarkdownProgressPart = ChatInputOutputMarkdownProgressPart_1 = __decorate([
    __param(8, IInstantiationService),
    __param(9, IModelService),
    __param(10, ILanguageService)
], ChatInputOutputMarkdownProgressPart);
export { ChatInputOutputMarkdownProgressPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdElucHV0T3V0cHV0TWFya2Rvd25Qcm9ncmVzc1BhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRDb250ZW50UGFydHMvdG9vbEludm9jYXRpb25QYXJ0cy9jaGF0SW5wdXRPdXRwdXRNYXJrZG93blByb2dyZXNzUGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQzNGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN2RSxPQUFPLEVBQW1CLHlCQUF5QixFQUFFLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzFILE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDMUUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3BELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3BFLE9BQU8sRUFBRSxtQkFBbUIsRUFBa0QsTUFBTSxnQ0FBZ0MsQ0FBQztBQUlySCxPQUFPLEVBQUUscUNBQXFDLEVBQXFELE1BQU0sc0NBQXNDLENBQUM7QUFDaEosT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFeEUsSUFBTSxtQ0FBbUMsR0FBekMsTUFBTSxtQ0FBb0MsU0FBUSw2QkFBNkI7O0lBQ3JGLGlEQUFpRDthQUN6Qix1QkFBa0IsR0FBRyxJQUFJLE9BQU8sRUFBZ0UsQUFBOUUsQ0FBK0U7SUFLekgsSUFBVyxVQUFVO1FBQ3BCLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQztJQUN6QixDQUFDO0lBRUQsWUFDQyxjQUFtRSxFQUNuRSxPQUFzQyxFQUN0QyxtQkFBMkIsRUFDM0IsT0FBaUMsRUFDakMsUUFBOEMsRUFDOUMsS0FBYSxFQUNiLE1BQTJELEVBQzNELE9BQWdCLEVBQ08sb0JBQTJDLEVBQ25ELFlBQTJCLEVBQ3hCLGVBQWlDO1FBRW5ELEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQztRQWxCZixnQkFBVyxHQUF5QixFQUFFLENBQUM7UUFvQjlDLElBQUksY0FBYyxHQUFHLG1CQUFtQixDQUFDO1FBQ3pDLE1BQU0sVUFBVSxHQUFHLENBQUMsSUFBWSxFQUE4QixFQUFFO1lBQy9ELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FDcEQsSUFBSSxFQUNKLGVBQWUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQ2xDLFNBQVMsRUFDVCxJQUFJLENBQ0osQ0FBQyxDQUFDO1lBRUgsT0FBTztnQkFDTixJQUFJLEVBQUUsTUFBTTtnQkFDWixTQUFTLEVBQUUsS0FBSztnQkFDaEIsVUFBVSxFQUFFLEtBQUssQ0FBQyxhQUFhLEVBQUU7Z0JBQ2pDLE9BQU8sRUFBRTtvQkFDUixXQUFXLEVBQUUsSUFBSTtvQkFDakIsWUFBWSxFQUFFLEVBQUU7b0JBQ2hCLGdCQUFnQixFQUFFLEVBQUU7b0JBQ3BCLGVBQWUsRUFBRSxDQUFDO29CQUNsQixhQUFhLEVBQUU7d0JBQ2QsUUFBUSxFQUFFLElBQUk7cUJBQ2Q7aUJBQ0Q7Z0JBQ0QsYUFBYSxFQUFFO29CQUNkLGNBQWMsRUFBRSxjQUFjLEVBQUU7b0JBQ2hDLGFBQWEsRUFBRSxTQUFTO29CQUN4QixTQUFTLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFO29CQUM3QixLQUFLLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQztvQkFDaEIsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLGdCQUFnQjtvQkFDMUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxHQUFHO29CQUNkLG1CQUFtQixFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsZUFBZTtvQkFDcEQsVUFBVSxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQztpQkFDdEM7YUFDRCxDQUFDO1FBQ0gsQ0FBQyxDQUFDO1FBRUYsSUFBSSxlQUFlLEdBQUcsTUFBTSxDQUFDO1FBQzdCLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFLENBQUMsQ0FBQyx5Q0FBeUM7WUFDMUUsZUFBZSxHQUFHLENBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDcEUsQ0FBQztRQUVELE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQzdFLHFDQUFxQyxFQUNyQyxPQUFPLEVBQ1AsUUFBUSxFQUNSLElBQUksQ0FBQyw0QkFBNEIsRUFBRSxFQUNuQyxPQUFPLEVBQ1AsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUNqQixlQUFlLElBQUk7WUFDbEIsS0FBSyxFQUFFLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUF5QixFQUFFO2dCQUMxRCxNQUFNLGlCQUFpQixHQUFHLENBQUMsQ0FBQyxJQUFJLEtBQUssS0FBSyxJQUFJLENBQUMsQ0FBQyxHQUFHO29CQUNsRCxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFJLENBQUM7b0JBQ2xCLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxJQUFJLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7d0JBQ2xELENBQUMsQ0FBQyxPQUFPLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRTt3QkFDOUMsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBRzFDLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxLQUFLLEVBQUUsQ0FBQztvQkFDdEIsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxHQUFHLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDM0QsQ0FBQztxQkFBTSxJQUFJLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLENBQUM7b0JBQ3RDLE9BQU8sVUFBVSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDNUIsQ0FBQztxQkFBTSxDQUFDO29CQUNQLElBQUksT0FBK0IsQ0FBQztvQkFDcEMsSUFBSSxDQUFDO3dCQUNKLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7NEJBQ2YsT0FBTyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDO3dCQUN4QyxDQUFDO29CQUNGLENBQUM7b0JBQUMsTUFBTSxDQUFDO3dCQUNSLFVBQVU7b0JBQ1gsQ0FBQztvQkFFRCw2Q0FBNkM7b0JBQzdDLE1BQU0sWUFBWSxHQUFHLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxjQUFjLENBQUMsVUFBVSxFQUFFLENBQUMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO29CQUNoSSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsT0FBTyxJQUFJLElBQUksV0FBVyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUUsWUFBWSxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQzdJLENBQUM7WUFDRixDQUFDLENBQUM7U0FDRixFQUNELE9BQU8sRUFDUCxxQ0FBbUMsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLElBQUksS0FBSyxDQUNuRixDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3pELElBQUksQ0FBQyxTQUFTLENBQUMsbUJBQW1CLENBQUMsaUJBQWlCLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1RixJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxxQ0FBbUMsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUU3SSxNQUFNLGtCQUFrQixHQUFHLGNBQWMsQ0FBQyxJQUFJLEtBQUssZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksb0RBQTRDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQzFNLE1BQU0sV0FBVyxHQUFHLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxXQUFXLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pHLElBQUksa0JBQWtCLEVBQUUsQ0FBQztZQUN4QixJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDL0IsTUFBTSxRQUFRLEdBQUcsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNsRCxJQUFJLFFBQVEsRUFBRSxPQUFPLEVBQUUsQ0FBQztvQkFDdkIsbUJBQW1CLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUM7Z0JBQzlDLENBQUM7Z0JBQ0QsSUFBSSxRQUFRLEVBQUUsUUFBUSxJQUFJLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDO29CQUNuRixXQUFXLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsUUFBUSxHQUFHLEdBQUcsQ0FBQyxDQUFDO2dCQUN0RCxDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxJQUFJLENBQUMsT0FBTyxHQUFHLG1CQUFtQixDQUFDLE9BQU8sQ0FBQztJQUM1QyxDQUFDO0lBRU8sNEJBQTRCO1FBQ25DLE1BQU0sTUFBTSxHQUFHLG1CQUFtQixDQUFDLDBCQUEwQixDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNuRixJQUFJLENBQUMsTUFBTSxJQUFJLE9BQU8sTUFBTSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzVDLE9BQU87UUFDUixDQUFDO1FBRUQsSUFBSSxFQUFVLENBQUM7UUFDZixRQUFRLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNyQjtnQkFDQyxFQUFFLEdBQUcsUUFBUSxDQUFDLDBCQUEwQixFQUFFLHNCQUFzQixFQUFFLHlCQUF5QixDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsR0FBRyxNQUFNLENBQUMsRUFBRSxHQUFHLEdBQUcsRUFBRSxFQUFFLEVBQUUsK0JBQStCLEVBQUUsU0FBUyxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztnQkFDbk0sTUFBTTtZQUNQO2dCQUNDLEVBQUUsR0FBRyxNQUFNLENBQUMsS0FBSyxLQUFLLFNBQVM7b0JBQzlCLENBQUMsQ0FBQyxRQUFRLENBQUMsMkNBQTJDLEVBQUUsZ0NBQWdDLENBQUM7b0JBQ3pGLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxLQUFLLFdBQVc7d0JBQzdCLENBQUMsQ0FBQyxRQUFRLENBQUMsNkNBQTZDLEVBQUUsa0NBQWtDLENBQUM7d0JBQzdGLENBQUMsQ0FBQyxRQUFRLENBQUMsMkNBQTJDLEVBQUUsZ0NBQWdDLENBQUMsQ0FBQztnQkFDNUYsRUFBRSxJQUFJLElBQUksR0FBRyx5QkFBeUIsQ0FBQyxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxFQUFFLEVBQUUsRUFBRSx3Q0FBd0MsRUFBRSxTQUFTLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQztnQkFDM0osTUFBTTtZQUNQLHdDQUFnQztZQUNoQyxvQ0FBNEI7WUFDNUIsbURBQTJDO1lBQzNDO2dCQUNDLE9BQU87UUFDVCxDQUFDO1FBR0QsT0FBTyxJQUFJLGNBQWMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUNwRCxDQUFDOztBQTFKVyxtQ0FBbUM7SUFvQjdDLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxhQUFhLENBQUE7SUFDYixZQUFBLGdCQUFnQixDQUFBO0dBdEJOLG1DQUFtQyxDQTJKL0MifQ==