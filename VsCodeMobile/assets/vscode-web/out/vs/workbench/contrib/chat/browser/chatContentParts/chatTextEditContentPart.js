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
import * as dom from '../../../../../base/browser/dom.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable, RefCountedDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { assertType } from '../../../../../base/common/types.js';
import { URI } from '../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { TextEdit } from '../../../../../editor/common/languages.js';
import { createTextBufferFactoryFromSnapshot } from '../../../../../editor/common/model/textModel.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { DefaultModelSHA1Computer } from '../../../../../editor/common/services/modelService.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../../nls.js';
import { registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IChatService } from '../../common/chatService.js';
import { isResponseVM } from '../../common/chatViewModel.js';
const $ = dom.$;
const ICodeCompareModelService = createDecorator('ICodeCompareModelService');
let ChatTextEditContentPart = class ChatTextEditContentPart extends Disposable {
    constructor(chatTextEdit, context, rendererOptions, diffEditorPool, currentWidth, codeCompareModelService) {
        super();
        this.codeCompareModelService = codeCompareModelService;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        const element = context.element;
        assertType(isResponseVM(element));
        // TODO@jrieken move this into the CompareCodeBlock and properly say what kind of changes happen
        if (rendererOptions.renderTextEditsAsSummary?.(chatTextEdit.uri)) {
            if (element.response.value.every(item => item.kind === 'textEditGroup')) {
                this.domNode = $('.interactive-edits-summary', undefined, !element.isComplete
                    ? ''
                    : element.isCanceled
                        ? localize('edits0', "Making changes was aborted.")
                        : localize('editsSummary', "Made changes."));
            }
            else {
                this.domNode = $('div');
            }
            // TODO@roblourens this case is now handled outside this Part in ChatListRenderer, but can it be cleaned up?
            // return;
        }
        else {
            const cts = new CancellationTokenSource();
            let isDisposed = false;
            this._register(toDisposable(() => {
                isDisposed = true;
                cts.dispose(true);
            }));
            this.comparePart = this._register(diffEditorPool.get());
            // Attach this after updating text/layout of the editor, so it should only be fired when the size updates later (horizontal scrollbar, wrapping)
            // not during a renderElement OR a progressive render (when we will be firing this event anyway at the end of the render)
            this._register(this.comparePart.object.onDidChangeContentHeight(() => {
                this._onDidChangeHeight.fire();
            }));
            const data = {
                element,
                edit: chatTextEdit,
                diffData: (async () => {
                    const ref = await this.codeCompareModelService.createModel(element, chatTextEdit);
                    if (isDisposed) {
                        ref.dispose();
                        return;
                    }
                    this._register(ref);
                    return {
                        modified: ref.object.modified.textEditorModel,
                        original: ref.object.original.textEditorModel,
                        originalSha1: ref.object.originalSha1
                    };
                })()
            };
            this.comparePart.object.render(data, currentWidth, cts.token);
            this.domNode = this.comparePart.object.element;
        }
    }
    layout(width) {
        this.comparePart?.object.layout(width);
    }
    hasSameContent(other) {
        // No other change allowed for this content type
        return other.kind === 'textEditGroup';
    }
    addDisposable(disposable) {
        this._register(disposable);
    }
};
ChatTextEditContentPart = __decorate([
    __param(5, ICodeCompareModelService)
], ChatTextEditContentPart);
export { ChatTextEditContentPart };
let CodeCompareModelService = class CodeCompareModelService {
    constructor(textModelService, modelService, chatService) {
        this.textModelService = textModelService;
        this.modelService = modelService;
        this.chatService = chatService;
    }
    async createModel(element, chatTextEdit) {
        const original = await this.textModelService.createModelReference(chatTextEdit.uri);
        const modified = await this.textModelService.createModelReference((this.modelService.createModel(createTextBufferFactoryFromSnapshot(original.object.textEditorModel.createSnapshot()), { languageId: original.object.textEditorModel.getLanguageId(), onDidChange: Event.None }, URI.from({ scheme: Schemas.vscodeChatCodeBlock, path: chatTextEdit.uri.path, query: generateUuid() }), false)).uri);
        const d = new RefCountedDisposable(toDisposable(() => {
            original.dispose();
            modified.dispose();
        }));
        // compute the sha1 of the original model
        let originalSha1 = '';
        if (chatTextEdit.state) {
            originalSha1 = chatTextEdit.state.sha1;
        }
        else {
            const sha1 = new DefaultModelSHA1Computer();
            if (sha1.canComputeSHA1(original.object.textEditorModel)) {
                originalSha1 = sha1.computeSHA1(original.object.textEditorModel);
                chatTextEdit.state = { sha1: originalSha1, applied: 0 };
            }
        }
        // apply edits to the "modified" model
        const chatModel = this.chatService.getSession(element.sessionResource);
        const editGroups = [];
        for (const request of chatModel.getRequests()) {
            if (!request.response) {
                continue;
            }
            for (const item of request.response.response.value) {
                if (item.kind !== 'textEditGroup' || item.state?.applied || !isEqual(item.uri, chatTextEdit.uri)) {
                    continue;
                }
                for (const group of item.edits) {
                    const edits = group.map(TextEdit.asEditOperation);
                    editGroups.push(edits);
                }
            }
            if (request.response === element.model) {
                break;
            }
        }
        for (const edits of editGroups) {
            modified.object.textEditorModel.pushEditOperations(null, edits, () => null);
        }
        // self-acquire a reference to diff models for a short while
        // because streaming usually means we will be using the original-model
        // repeatedly and thereby also should reuse the modified-model and just
        // update it with more edits
        d.acquire();
        setTimeout(() => d.release(), 5000);
        return {
            object: {
                originalSha1,
                original: original.object,
                modified: modified.object
            },
            dispose() {
                d.release();
            },
        };
    }
};
CodeCompareModelService = __decorate([
    __param(0, ITextModelService),
    __param(1, IModelService),
    __param(2, IChatService)
], CodeCompareModelService);
registerSingleton(ICodeCompareModelService, CodeCompareModelService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRleHRFZGl0Q29udGVudFBhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRDb250ZW50UGFydHMvY2hhdFRleHRFZGl0Q29udGVudFBhcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQ0FBb0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNyRixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxVQUFVLEVBQTJCLG9CQUFvQixFQUFFLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2xJLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFFbEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxtQ0FBbUMsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMvRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNqRyxPQUFPLEVBQTRCLGlCQUFpQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDdkgsT0FBTyxFQUFFLFFBQVEsRUFBRSxN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