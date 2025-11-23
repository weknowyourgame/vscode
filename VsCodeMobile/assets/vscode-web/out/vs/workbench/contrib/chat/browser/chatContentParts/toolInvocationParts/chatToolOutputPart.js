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
var ChatToolOutputSubPart_1;
import * as dom from '../../../../../../base/browser/dom.js';
import { renderMarkdown } from '../../../../../../base/browser/markdownRenderer.js';
import { decodeBase64 } from '../../../../../../base/common/buffer.js';
import { CancellationTokenSource } from '../../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { generateUuid } from '../../../../../../base/common/uuid.js';
import { localize } from '../../../../../../nls.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IChatToolInvocation } from '../../../common/chatService.js';
import { IChatWidgetService } from '../../chat.js';
import { IChatOutputRendererService } from '../../chatOutputItemRenderer.js';
import { ChatProgressSubPart } from '../chatProgressContentPart.js';
import { BaseChatToolInvocationSubPart } from './chatToolInvocationSubPart.js';
// TODO: see if we can reuse existing types instead of adding ChatToolOutputSubPart
let ChatToolOutputSubPart = class ChatToolOutputSubPart extends BaseChatToolInvocationSubPart {
    static { ChatToolOutputSubPart_1 = this; }
    /** Remembers cached state on re-render */
    static { this._cachedStates = new WeakMap(); }
    constructor(toolInvocation, context, chatOutputItemRendererService, chatWidgetService, instantiationService) {
        super(toolInvocation);
        this.context = context;
        this.chatOutputItemRendererService = chatOutputItemRendererService;
        this.chatWidgetService = chatWidgetService;
        this.instantiationService = instantiationService;
        this.codeblocks = [];
        this._disposeCts = this._register(new CancellationTokenSource());
        const details = toolInvocation.kind === 'toolInvocation'
            ? IChatToolInvocation.resultDetails(toolInvocation)
            : {
                output: {
                    type: 'data',
                    mimeType: toolInvocation.resultDetails.output.mimeType,
                    value: decodeBase64(toolInvocation.resultDetails.output.base64Data),
                },
            };
        this.domNode = dom.$('div.tool-output-part');
        const titleEl = dom.$('.output-title');
        this.domNode.appendChild(titleEl);
        if (typeof toolInvocation.invocationMessage === 'string') {
            titleEl.textContent = toolInvocation.invocationMessage;
        }
        else {
            const md = this._register(renderMarkdown(toolInvocation.invocationMessage));
            titleEl.appendChild(md.element);
        }
        this.domNode.appendChild(this.createOutputPart(toolInvocation, details));
    }
    dispose() {
        this._disposeCts.dispose(true);
        super.dispose();
    }
    createOutputPart(toolInvocation, details) {
        const vm = this.chatWidgetService.getWidgetBySessionResource(this.context.element.sessionResource)?.viewModel;
        const parent = dom.$('div.webview-output');
        parent.style.maxHeight = '80vh';
        let partState = { height: 0, webviewOrigin: generateUuid() };
        if (vm) {
            let allStates = ChatToolOutputSubPart_1._cachedStates.get(vm);
            if (!allStates) {
                allStates = new Map();
                ChatToolOutputSubPart_1._cachedStates.set(vm, allStates);
            }
            const cachedState = allStates.get(toolInvocation.toolCallId);
            if (cachedState) {
                partState = cachedState;
            }
            else {
                allStates.set(toolInvocation.toolCallId, partState);
            }
        }
        if (partState.height) {
            parent.style.height = `${partState.height}px`;
        }
        const progressMessage = dom.$('span');
        progressMessage.textContent = localize('loading', 'Rendering tool output...');
        const progressPart = this._register(this.instantiationService.createInstance(ChatProgressSubPart, progressMessage, ThemeIcon.modify(Codicon.loading, 'spin'), undefined));
        parent.appendChild(progressPart.domNode);
        // TODO: we also need to show the tool output in the UI
        this.chatOutputItemRendererService.renderOutputPart(details.output.mimeType, details.output.value.buffer, parent, { origin: partState.webviewOrigin }, this._disposeCts.token).then((renderedItem) => {
            if (this._disposeCts.token.isCancellationRequested) {
                return;
            }
            this._register(renderedItem);
            progressPart.domNode.remove();
            this._onDidChangeHeight.fire();
            this._register(renderedItem.onDidChangeHeight(newHeight => {
                this._onDidChangeHeight.fire();
                partState.height = newHeight;
            }));
            this._register(renderedItem.webview.onDidWheel(e => {
                this.chatWidgetService.getWidgetBySessionResource(this.context.element.sessionResource)?.delegateScrollFromMouseWheelEvent({
                    ...e,
                    preventDefault: () => { },
                    stopPropagation: () => { }
                });
            }));
            // When the webview is disconnected from the DOM due to being hidden, we need to reload it when it is shown again.
            const widget = this.chatWidgetService.getWidgetBySessionResource(this.context.element.sessionResource);
            if (widget) {
                this._register(widget?.onDidShow(() => {
                    renderedItem.reinitialize();
                }));
            }
        }, (error) => {
            console.error('Error rendering tool output:', error);
            const errorNode = dom.$('.output-error');
            const errorHeaderNode = dom.$('.output-error-header');
            dom.append(errorNode, errorHeaderNode);
            const iconElement = dom.$('div');
            iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.error));
            errorHeaderNode.append(iconElement);
            const errorTitleNode = dom.$('.output-error-title');
            errorTitleNode.textContent = localize('chat.toolOutputError', "Error rendering the tool output");
            errorHeaderNode.append(errorTitleNode);
            const errorMessageNode = dom.$('.output-error-details');
            errorMessageNode.textContent = error?.message || String(error);
            errorNode.append(errorMessageNode);
            progressPart.domNode.replaceWith(errorNode);
        });
        return parent;
    }
};
ChatToolOutputSubPart = ChatToolOutputSubPart_1 = __decorate([
    __param(2, IChatOutputRendererService),
    __param(3, IChatWidgetService),
    __param(4, IInstantiationService)
], ChatToolOutputSubPart);
export { ChatToolOutputSubPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvb2xPdXRwdXRQYXJ0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGVudFBhcnRzL3Rvb2xJbnZvY2F0aW9uUGFydHMvY2hhdFRvb2xPdXRwdXRQYXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLHVDQUF1QyxDQUFDO0FBQzdELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUNwRixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDdkUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDeEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDckUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3BELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxtQkFBbUIsRUFBcUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUd4SSxPQUFPLEVBQXNCLGtCQUFrQixFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRTdFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3BFLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBTy9FLG1GQUFtRjtBQUM1RSxJQUFNLHFCQUFxQixHQUEzQixNQUFNLHFC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