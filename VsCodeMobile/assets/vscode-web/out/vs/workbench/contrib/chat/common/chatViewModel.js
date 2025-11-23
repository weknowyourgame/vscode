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
import { Emitter } from '../../../../base/common/event.js';
import { hash } from '../../../../base/common/hash.js';
import { Disposable, dispose } from '../../../../base/common/lifecycle.js';
import * as marked from '../../../../base/common/marked/marked.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { annotateVulnerabilitiesInText } from './annotations.js';
import { getFullyQualifiedId, IChatAgentNameService } from './chatAgents.js';
import { countWords } from './chatWordCounter.js';
import { Codicon } from '../../../../base/common/codicons.js';
export function isRequestVM(item) {
    return !!item && typeof item === 'object' && 'message' in item;
}
export function isResponseVM(item) {
    return !!item && typeof item.setVote !== 'undefined';
}
export function isChatTreeItem(item) {
    return isRequestVM(item) || isResponseVM(item);
}
export function assertIsResponseVM(item) {
    if (!isResponseVM(item)) {
        throw new Error('Expected item to be IChatResponseViewModel');
    }
}
let ChatViewModel = class ChatViewModel extends Disposable {
    get inputPlaceholder() {
        return this._inputPlaceholder;
    }
    get model() {
        return this._model;
    }
    setInputPlaceholder(text) {
        this._inputPlaceholder = text;
        this._onDidChange.fire({ kind: 'changePlaceholder' });
    }
    resetInputPlaceholder() {
        this._inputPlaceholder = undefined;
        this._onDidChange.fire({ kind: 'changePlaceholder' });
    }
    get sessionResource() {
        return this._model.sessionResource;
    }
    constructor(_model, codeBlockModelCollection, instantiationService) {
        super();
        this._model = _model;
        this.codeBlockModelCollection = codeBlockModelCollection;
        this.instantiationService = instantiationService;
        this._onDidDisposeModel = this._register(new Emitter());
        this.onDidDisposeModel = this._onDidDisposeModel.event;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._items = [];
        this._inputPlaceholder = undefined;
        this._editing = undefined;
        _model.getRequests().forEach((request, i) => {
            const requestModel = this.instantiationService.createInstance(ChatRequestViewModel, request);
            this._items.push(requestModel);
            this.updateCodeBlockTextModels(requestModel);
            if (request.response) {
                this.onAddResponse(request.response);
            }
        });
        this._register(_model.onDidDispose(() => this._onDidDisposeModel.fire()));
        this._register(_model.onDidChange(e => {
            if (e.kind === 'addRequest') {
                const requestModel = this.instantiationService.createInstance(ChatRequestViewModel, e.request);
                this._items.push(requestModel);
                this.updateCodeBlockTextModels(requestModel);
                if (e.request.response) {
                    this.onAddResponse(e.request.response);
                }
            }
            else if (e.kind === 'addResponse') {
                this.onAddResponse(e.response);
            }
            else if (e.kind === 'removeRequest') {
                const requestIdx = this._items.findIndex(item => isRequestVM(item) && item.id === e.requestId);
                if (requestIdx >= 0) {
                    this._items.splice(requestIdx, 1);
                }
                const responseIdx = e.responseId && this._items.findIndex(item => isResponseVM(item) && item.id === e.responseId);
                if (typeof responseIdx === 'number' && responseIdx >= 0) {
                    const items = this._items.splice(responseIdx, 1);
                    const item = items[0];
                    if (item instanceof ChatResponseViewModel) {
                        item.dispose();
                    }
                }
            }
            const modelEventToVmEvent = e.kind === 'addRequest' ? { kind: 'addRequest' }
                : e.kind === 'initialize' ? { kind: 'initialize' }
                    : e.kind === 'setHidden' ? { kind: 'setHidden' }
                        : null;
            this._onDidChange.fire(modelEventToVmEvent);
        }));
    }
    onAddResponse(responseModel) {
        const response = this.instantiationService.createInstance(ChatResponseViewModel, responseModel, this);
        this._register(response.onDidChange(() => {
            if (response.isComplete) {
                this.updateCodeBlockTextModels(response);
            }
            return this._onDidChange.fire(null);
        }));
        this._items.push(response);
        this.updateCodeBlockTextModels(response);
    }
    getItems() {
        return this._items.filter((item) => !item.shouldBeRemovedOnSend || item.shouldBeRemovedOnSend.afterUndoStop);
    }
    get editing() {
        return this._editing;
    }
    setEditing(editing) {
        if (this.editing && editing && this.editing.id === editing.id) {
            return; // already editing this request
        }
        this._editing = editing;
    }
    dispose() {
        super.dispose();
        dispose(this._items.filter((item) => item instanceof ChatResponseViewModel));
    }
    updateCodeBlockTextModels(model) {
        let content;
        if (isRequestVM(model)) {
            content = model.messageText;
        }
        else {
            content = annotateVulnerabilitiesInText(model.response.value).map(x => x.content.value).join('');
        }
        let codeBlockIndex = 0;
        marked.walkTokens(marked.lexer(content), token => {
            if (token.type === 'code') {
                const lang = token.lang || '';
                const text = token.text;
                this.codeBlockModelCollection.update(this._model.sessionResource, model, codeBlockIndex++, { text, languageId: lang, isComplete: true });
            }
        });
    }
};
ChatViewModel = __decorate([
    __param(2, IInstantiationService)
], ChatViewModel);
export { ChatViewModel };
export class ChatRequestViewModel {
    get id() {
        return this._model.id;
    }
    get dataId() {
        return this.id + `_${hash(this.variables)}_${hash(this.isComplete)}`;
    }
    /** @deprecated */
    get sessionId() {
        return this._model.session.sessionId;
    }
    get sessionResource() {
        return this._model.session.sessionResource;
    }
    get username() {
        return 'User';
    }
    get avatarIcon() {
        return Codicon.account;
    }
    get message() {
        return this._model.message;
    }
    get messageText() {
        return this.message.text;
    }
    get attempt() {
        return this._model.attempt;
    }
    get variables() {
        return this._model.variableData.variables;
    }
    get contentReferences() {
        return this._model.response?.contentReferences;
    }
    get confirmation() {
        return this._model.confirmation;
    }
    get isComplete() {
        return this._model.response?.isComplete ?? false;
    }
    get isCompleteAddedRequest() {
        return this._model.isCompleteAddedRequest;
    }
    get shouldBeRemovedOnSend() {
        return this._model.shouldBeRemovedOnSend;
    }
    get shouldBeBlocked() {
        return this._model.shouldBeBlocked;
    }
    get slashCommand() {
        return this._model.response?.slashCommand;
    }
    get agentOrSlashCommandDetected() {
        return this._model.response?.agentOrSlashCommandDetected ?? false;
    }
    get modelId() {
        return this._model.modelId;
    }
    constructor(_model) {
        this._model = _model;
    }
}
let ChatResponseViewModel = class ChatResponseViewModel extends Disposable {
    get model() {
        return this._model;
    }
    get id() {
        return this._model.id;
    }
    get dataId() {
        return this._model.id +
            `_${this._modelChangeCount}` +
            (this.isLast ? '_last' : '');
    }
    /** @deprecated */
    get sessionId() {
        return this._model.session.sessionId;
    }
    get sessionResource() {
        return this._model.session.sessionResource;
    }
    get username() {
        if (this.agent) {
            const isAllowed = this.chatAgentNameService.getAgentNameRestriction(this.agent);
            if (isAllowed) {
                return this.agent.fullName || this.agent.name;
            }
            else {
                return getFullyQualifiedId(this.agent);
            }
        }
        return this._model.username;
    }
    get avatarIcon() {
        return this._model.avatarIcon;
    }
    get agent() {
        return this._model.agent;
    }
    get slashCommand() {
        return this._model.slashCommand;
    }
    get agentOrSlashCommandDetected() {
        return this._model.agentOrSlashCommandDetected;
    }
    get response() {
        return this._model.response;
    }
    get usedContext() {
        return this._model.usedContext;
    }
    get contentReferences() {
        return this._model.contentReferences;
    }
    get codeCitations() {
        return this._model.codeCitations;
    }
    get progressMessages() {
        return this._model.progressMessages;
    }
    get isComplete() {
        return this._model.isComplete;
    }
    get isCanceled() {
        return this._model.isCanceled;
    }
    get shouldBeBlocked() {
        return this._model.shouldBeBlocked;
    }
    get shouldBeRemovedOnSend() {
        return this._model.shouldBeRemovedOnSend;
    }
    get isCompleteAddedRequest() {
        return this._model.isCompleteAddedRequest;
    }
    get replyFollowups() {
        return this._model.followups?.filter((f) => f.kind === 'reply');
    }
    get result() {
        return this._model.result;
    }
    get errorDetails() {
        return this.result?.errorDetails;
    }
    get vote() {
        return this._model.vote;
    }
    get voteDownReason() {
        return this._model.voteDownReason;
    }
    get requestId() {
        return this._model.requestId;
    }
    get isStale() {
        return this._model.isStale;
    }
    get isLast() {
        return this.session.getItems().at(-1) === this;
    }
    get usedReferencesExpanded() {
        if (typeof this._usedReferencesExpanded === 'boolean') {
            return this._usedReferencesExpanded;
        }
        return undefined;
    }
    set usedReferencesExpanded(v) {
        this._usedReferencesExpanded = v;
    }
    get vulnerabilitiesListExpanded() {
        return this._vulnerabilitiesListExpanded;
    }
    set vulnerabilitiesListExpanded(v) {
        this._vulnerabilitiesListExpanded = v;
    }
    get contentUpdateTimings() {
        return this._contentUpdateTimings;
    }
    constructor(_model, session, logService, chatAgentNameService) {
        super();
        this._model = _model;
        this.session = session;
        this.logService = logService;
        this.chatAgentNameService = chatAgentNameService;
        this._modelChangeCount = 0;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this.renderData = undefined;
        this._vulnerabilitiesListExpanded = false;
        this._contentUpdateTimings = undefined;
        if (!_model.isComplete) {
            this._contentUpdateTimings = {
                totalTime: 0,
                lastUpdateTime: Date.now(),
                impliedWordLoadRate: 0,
                lastWordCount: 0,
            };
        }
        this._register(_model.onDidChange(() => {
            // This is set when the response is loading, but the model can change later for other reasons
            if (this._contentUpdateTimings) {
                const now = Date.now();
                const wordCount = countWords(_model.entireResponse.getMarkdown());
                if (wordCount === this._contentUpdateTimings.lastWordCount) {
                    this.trace('onDidChange', `Update- no new words`);
                }
                else {
                    if (this._contentUpdateTimings.lastWordCount === 0) {
                        this._contentUpdateTimings.lastUpdateTime = now;
                    }
                    const timeDiff = Math.min(now - this._contentUpdateTimings.lastUpdateTime, 500);
                    const newTotalTime = Math.max(this._contentUpdateTimings.totalTime + timeDiff, 250);
                    const impliedWordLoadRate = wordCount / (newTotalTime / 1000);
                    this.trace('onDidChange', `Update- got ${wordCount} words over last ${newTotalTime}ms = ${impliedWordLoadRate} words/s`);
                    this._contentUpdateTimings = {
                        totalTime: this._contentUpdateTimings.totalTime !== 0 || this.response.value.some(v => v.kind === 'markdownContent') ?
                            newTotalTime :
                            this._contentUpdateTimings.totalTime,
                        lastUpdateTime: now,
                        impliedWordLoadRate,
                        lastWordCount: wordCount
                    };
                }
            }
            // new data -> new id, new content to render
            this._modelChangeCount++;
            this._onDidChange.fire();
        }));
    }
    trace(tag, message) {
        this.logService.trace(`ChatResponseViewModel#${tag}: ${message}`);
    }
    setVote(vote) {
        this._modelChangeCount++;
        this._model.setVote(vote);
    }
    setVoteDownReason(reason) {
        this._modelChangeCount++;
        this._model.setVoteDownReason(reason);
    }
    setEditApplied(edit, editCount) {
        this._modelChangeCount++;
        this._model.setEditApplied(edit, editCount);
    }
};
ChatResponseViewModel = __decorate([
    __param(2, ILogService),
    __param(3, IChatAgentNameService)
], ChatResponseViewModel);
export { ChatResponseViewModel };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFZpZXdNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0Vmlld01vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFFdkQsT0FBTyxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMzRSxPQUFPLEtBQUssTUFBTSxNQUFNLDBDQUEwQyxDQUFDO0FBR25FLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUNqRSxPQUFPLEVBQUUsbUJBQW1CLEVBQXFDLHFCQUFxQixFQUFvQixNQUFNLGlCQUFpQixDQUFDO0FBS2xJLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUVsRCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFOUQsTUFBTSxVQUFVLFdBQVcsQ0FBQyxJQUFhO0lBQ3hDLE9BQU8sQ0FBQyxDQUFDLElBQUksSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLElBQUksU0FBUyxJQUFJLElBQUksQ0FBQztBQUNoRSxDQUFDO0FBRUQsTUFBTSxVQUFVLFlBQVksQ0FBQyxJQUFhO0lBQ3pDLE9BQU8sQ0FBQyxDQUFDLElBQUksSUFBSSxPQUFRLElBQStCLENBQUMsT0FBTyxLQUFLLFdBQVcsQ0FBQztBQUNsRixDQUFDO0FBRUQsTUFBTSxVQUFVLGNBQWMsQ0FB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