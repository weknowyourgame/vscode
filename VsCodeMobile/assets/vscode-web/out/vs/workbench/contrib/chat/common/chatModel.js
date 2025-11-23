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
var ChatModel_1;
import { asArray } from '../../../../base/common/arrays.js';
import { softAssertNever } from '../../../../base/common/assert.js';
import { BugIndicatingError } from '../../../../base/common/errors.js';
import { Emitter } from '../../../../base/common/event.js';
import { MarkdownString, isMarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { revive } from '../../../../base/common/marshalling.js';
import { Schemas } from '../../../../base/common/network.js';
import { equals } from '../../../../base/common/objects.js';
import { autorun, autorunSelfDisposable, derived, observableFromEvent, observableSignalFromEvent, observableValue, observableValueOpts } from '../../../../base/common/observable.js';
import { basename, isEqual } from '../../../../base/common/resources.js';
import { URI, isUriComponents } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { OffsetRange } from '../../../../editor/common/core/ranges/offsetRange.js';
import { TextEdit } from '../../../../editor/common/languages.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { CellUri } from '../../notebook/common/notebookCommon.js';
import { migrateLegacyTerminalToolSpecificData } from './chat.js';
import { IChatAgentService, reviveSerializedAgent } from './chatAgents.js';
import { IChatEditingService } from './chatEditingService.js';
import { ChatRequestTextPart, reviveParsedChatRequest } from './chatParserTypes.js';
import { ChatResponseClearToPreviousToolInvocationReason, IChatService, IChatToolInvocation, isIUsedContext } from './chatService.js';
import { LocalChatSessionUri } from './chatUri.js';
import { ChatAgentLocation, ChatModeKind } from './constants.js';
export const CHAT_ATTACHABLE_IMAGE_MIME_TYPES = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
};
export function getAttachableImageExtension(mimeType) {
    return Object.entries(CHAT_ATTACHABLE_IMAGE_MIME_TYPES).find(([_, value]) => value === mimeType)?.[0];
}
export function isCellTextEditOperation(value) {
    const candidate = value;
    return !!candidate && !!candidate.edit && !!candidate.uri && URI.isUri(candidate.uri);
}
export function isCellTextEditOperationArray(value) {
    return value.some(isCellTextEditOperation);
}
const nonHistoryKinds = new Set(['toolInvocation', 'toolInvocationSerialized', 'undoStop', 'prepareToolInvocation']);
function isChatProgressHistoryResponseContent(content) {
    return !nonHistoryKinds.has(content.kind);
}
export function toChatHistoryContent(content) {
    return content.filter(isChatProgressHistoryResponseContent);
}
export const defaultChatResponseModelChangeReason = { reason: 'other' };
export class ChatRequestModel {
    get session() {
        return this._session;
    }
    get attempt() {
        return this._attempt;
    }
    get variableData() {
        return this._variableData;
    }
    set variableData(v) {
        this._variableData = v;
    }
    get confirmation() {
        return this._confirmation;
    }
    get locationData() {
        return this._locationData;
    }
    get attachedContext() {
        return this._attachedContext;
    }
    get editedFileEvents() {
        return this._editedFileEvents;
    }
    constructor(params) {
        this.shouldBeBlocked = false;
        this._session = params.session;
        this.message = params.message;
        this._variableData = params.variableData;
        this.timestamp = params.timestamp;
        this._attempt = params.attempt ?? 0;
        this.modeInfo = params.modeInfo;
        this._confirmation = params.confirmation;
        this._locationData = params.locationData;
        this._attachedContext = params.attachedContext;
        this.isCompleteAddedRequest = params.isCompleteAddedRequest ?? false;
        this.modelId = params.modelId;
        this.id = params.restoredId ?? 'request_' + generateUuid();
        this._editedFileEvents = params.editedFileEvents;
        this.userSelectedTools = params.userSelectedTools;
    }
    adoptTo(session) {
        this._session = session;
    }
}
class AbstractResponse {
    get value() {
        return this._responseParts;
    }
    constructor(value) {
        /**
         * A stringified representation of response data which might be presented to a screenreader or used when copying a response.
         */
        this._responseRepr = '';
        /**
         * Just the markdown content of the response, used for determining the rendering rate of markdown
         */
        this._markdownContent = '';
        this._responseParts = value;
        this._updateRepr();
    }
    toString() {
        return this._responseRepr;
    }
    /**
     * _Just_ the content of markdown parts in the response
     */
    getMarkdown() {
        return this._markdownContent;
    }
    _updateRepr() {
        this._responseRepr = this.partsToRepr(this._responseParts);
        this._markdownContent = this._responseParts.map(part => {
            if (part.kind === 'inlineReference') {
                return this.inlineRefToRepr(part);
            }
            else if (part.kind === 'markdownContent' || part.kind === 'markdownVuln') {
                return part.content.value;
            }
            else {
                return '';
            }
        })
            .filter(s => s.length > 0)
            .join('');
    }
    partsToRepr(parts) {
        const blocks = [];
        let currentBlockSegments = [];
        let hasEditGroupsAfterLastClear = false;
        for (const part of parts) {
            let segment;
            switch (part.kind) {
                case 'clearToPreviousToolInvocation':
                    currentBlockSegments = [];
                    blocks.length = 0;
                    hasEditGroupsAfterLastClear = false; // Reset edit groups flag when clearing
                    continue;
                case 'treeData':
                case 'progressMessage':
                case 'codeblockUri':
                case 'extensions':
                case 'pullRequest':
                case 'undoStop':
                case 'prepareToolInvocation':
                case 'elicitation2':
                case 'elicitationSerialized':
                case 'thinking':
                case 'multiDiffData':
                case 'mcpServersStarting':
                    // Ignore
                    continue;
                case 'toolInvocation':
                case 'toolInvocationSerialized':
                    // Include tool invocations in the copy text
                    segment = this.getToolInvocationText(part);
                    break;
                case 'inlineReference':
                    segment = { text: this.inlineRefToRepr(part) };
                    break;
                case 'command':
                    segment = { text: part.command.title, isBlock: true };
                    break;
                case 'textEditGroup':
                case 'notebookEditGroup':
                    // Mark that we have edit groups after the last clear
                    hasEditGroupsAfterLastClear = true;
                    // Skip individual edit groups to avoid duplication
                    continue;
                case 'confirmation':
                    if (part.message instanceof MarkdownString) {
                        segment = { text: `${part.title}\n${part.message.value}`, isBlock: true };
                        break;
                    }
                    segment = { text: `${part.title}\n${part.message}`, isBlock: true };
                    break;
                case 'markdownContent':
                case 'markdownVuln':
                case 'progressTask':
                case 'progressTaskSerialized':
                case 'warning':
                    segment = { text: part.content.value };
                    break;
                default:
                    // Ignore any unknown/obsolete parts, but assert that all are handled:
                    softAssertNever(part);
                    continue;
            }
            if (segment.isBlock) {
                if (currentBlockSegments.length) {
                    blocks.push(currentBlockSegments.join(''));
                    currentBlockSegments = [];
                }
                blocks.push(segment.text);
            }
            else {
                currentBlockSegments.push(segment.text);
            }
        }
        if (currentBlockSegments.length) {
            blocks.push(currentBlockSegments.join(''));
        }
        // Add consolidated edit summary at the end if there were any edit groups after the last clear
        if (hasEditGroupsAfterLastClear) {
            blocks.push(localize('editsSummary', "Made changes."));
        }
        return blocks.join('\n\n');
    }
    inlineRefToRepr(part) {
        if ('uri' in part.inlineReference) {
            return this.uriToRepr(part.inlineReference.uri);
        }
        return 'name' in part.inlineReference
            ? '`' + part.inlineReference.name + '`'
            : this.uriToRepr(part.inlineReference);
    }
    getToolInvocationText(toolInvocation) {
        // Extract the message and input details
        let message = '';
        let input = '';
        if (toolInvocation.pastTenseMessage) {
            message = typeof toolInvocation.pastTenseMessage === 'string'
                ? toolInvocation.pastTenseMessage
                : toolInvocation.pastTenseMessage.value;
        }
        else {
            message = typeof toolInvocation.invocationMessage === 'string'
                ? toolInvocation.invocationMessage
                : toolInvocation.invocationMessage.value;
        }
        // Handle different types of tool invocations
        if (toolInvocation.toolSpecificData) {
            if (toolInvocation.toolSpecificData.kind === 'terminal') {
                message = 'Ran terminal command';
                const terminalData = migrateLegacyTerminalToolSpecificData(toolInvocation.toolSpecificData);
                input = terminalData.commandLine.userEdited ?? terminalData.commandLine.toolEdited ?? terminalData.commandLine.original;
            }
        }
        // Format the tool invocation text
        let text = message;
        if (input) {
            text += `: ${input}`;
        }
        // For completed tool invocations, also include the result details if available
        if (toolInvocation.kind === 'toolInvocationSerialized' || (toolInvocation.kind === 'toolInvocation' && IChatToolInvocation.isComplete(toolInvocation))) {
            const resultDetails = IChatToolInvocation.resultDetails(toolInvocation);
            if (resultDetails && 'input' in resultDetails) {
                const resultPrefix = toolInvocation.kind === 'toolInvocationSerialized' || IChatToolInvocation.isComplete(toolInvocation) ? 'Completed' : 'Errored';
                text += `\n${resultPrefix} with input: ${resultDetails.input}`;
            }
        }
        return { text, isBlock: true };
    }
    uriToRepr(uri) {
        if (uri.scheme === Schemas.http || uri.scheme === Schemas.https) {
            return uri.toString(false);
        }
        return basename(uri);
    }
}
/** A view of a subset of a response */
class ResponseView extends AbstractResponse {
    constructor(_response, undoStop) {
        let idx = _response.value.findIndex(v => v.kind === 'undoStop' && v.id === undoStop);
        // Undo stops are inserted before `codeblockUri`'s, which are preceeded by a
        // markdownContent containing the opening code fence. Adjust the index
        // backwards to avoid a buggy response if it looked like this happened.
        if (_response.value[idx + 1]?.kind === 'codeblockUri' && _response.value[idx - 1]?.kind === 'markdownContent') {
            idx--;
        }
        super(idx === -1 ? _response.value.slice() : _response.value.slice(0, idx));
        this.undoStop = undoStop;
    }
}
export class Response extends AbstractResponse {
    get onDidChangeValue() {
        return this._onDidChangeValue.event;
    }
    constructor(value) {
        super(asArray(value).map((v) => ('kind' in v ? v :
            isMarkdownString(v) ? { content: v, kind: 'markdownContent' } :
                { kind: 'treeData', treeData: v })));
        this._onDidChangeValue = new Emitter();
        this._citations = [];
    }
    dispose() {
        this._onDidChangeValue.dispose();
    }
    clear() {
        this._responseParts = [];
        this._updateRepr(true);
    }
    clearToPreviousToolInvocation(message) {
        // look through the response parts and find the last tool invocation, then slice the response parts to that point
        let lastToolInvocationIndex = -1;
        for (let i = this._responseParts.length - 1; i >= 0; i--) {
            const part = this._responseParts[i];
            if (part.kind === 'toolInvocation' || part.kind === 'toolInvocationSerialized') {
                lastToolInvocationIndex = i;
                break;
            }
        }
        if (lastToolInvocationIndex !== -1) {
            this._responseParts = this._responseParts.slice(0, lastToolInvocationIndex + 1);
        }
        else {
            this._responseParts = [];
        }
        if (message) {
            this._responseParts.push({ kind: 'warning', content: new MarkdownString(message) });
        }
        this._updateRepr(true);
    }
    updateContent(progress, quiet) {
        if (progress.kind === 'clearToPreviousToolInvocation') {
            if (progress.reason === ChatResponseClearToPreviousToolInvocationReason.CopyrightContentRetry) {
                this.clearToPreviousToolInvocation(localize('copyrightContentRetry', "Response cleared due to possible match to public code, retrying with modified prompt."));
            }
            else if (progress.reason === ChatResponseClearToPreviousToolInvocationReason.FilteredContentRetry) {
                this.clearToPreviousToolInvocation(localize('filteredContentRetry', "Response cleared due to content safety filters, retrying with modified prompt."));
            }
            else {
                this.clearToPreviousToolInvocation();
            }
            return;
        }
        else if (progress.kind === 'markdownContent') {
            // last response which is NOT a text edit group because we do want to support heterogenous streaming but not have
            // the MD be chopped up by text edit groups (and likely other non-renderable parts)
            const lastResponsePart = this._responseParts
                .filter(p => p.kind !== 'textEditGroup')
                .at(-1);
            if (!lastResponsePart || lastResponsePart.kind !== 'markdownContent' || !canMergeMarkdownStrings(lastResponsePart.content, progress.content)) {
                // The last part can't be merged with- not markdown, or markdown with different permissions
                this._responseParts.push(progress);
            }
            else {
                // Don't modify the current object, since it's being diffed by the renderer
                const idx = this._responseParts.indexOf(lastResponsePart);
                this._responseParts[idx] = { ...lastResponsePart, content: appendMarkdownString(lastResponsePart.content, progress.content) };
            }
            this._updateRepr(quiet);
        }
        else if (progress.kind === 'thinking') {
            // tries to split thinking chunks if it is an array. only while certain models give us array chunks.
            const lastResponsePart = this._responseParts
                .filter(p => p.kind !== 'textEditGroup')
                .at(-1);
            const lastText = lastResponsePart && lastResponsePart.kind === 'thinking'
                ? (Array.isArray(lastResponsePart.value) ? lastResponsePart.value.join('') : (lastResponsePart.value || ''))
                : '';
            const currText = Array.isArray(progress.value) ? progress.value.join('') : (progress.value || '');
            const isEmpty = (s) => s.trim().length === 0;
            // Do not merge if either the current or last thinking chunk is empty; empty chunks separate thinking
            if (!lastResponsePart
                || lastResponsePart.kind !== 'thinking'
                || isEmpty(currText)
                || isEmpty(lastText)
                || !canMergeMarkdownStrings(new MarkdownString(lastText), new MarkdownString(currText))) {
                this._responseParts.push(progress);
            }
            else {
                const idx = this._responseParts.indexOf(lastResponsePart);
                this._responseParts[idx] = {
                    ...lastResponsePart,
                    value: appendMarkdownString(new MarkdownString(lastText), new MarkdownString(currText)).value
                };
            }
            this._updateRepr(quiet);
        }
        else if (progress.kind === 'textEdit' || progress.kind === 'notebookEdit') {
            // If the progress.uri is a cell Uri, its possible its part of the inline chat.
            // Old approach of notebook inline chat would not start and end with notebook Uri, so we need to check for old approach.
            const useOldApproachForInlineNotebook = progress.uri.scheme === Schemas.vscodeNotebookCell && !this._responseParts.find(part => part.kind === 'notebookEditGroup');
            // merge edits for the same file no matter when they come in
            const notebookUri = useOldApproachForInlineNotebook ? undefined : CellUri.parse(progress.uri)?.notebook;
            const uri = notebookUri ?? progress.uri;
            let found = false;
            const groupKind = progress.kind === 'textEdit' && !notebookUri ? 'textEditGroup' : 'notebookEditGroup';
            const edits = groupKind === 'textEditGroup' ? progress.edits : progress.edits.map(edit => TextEdit.isTextEdit(edit) ? { uri: progress.uri, edit } : edit);
            const isExternalEdit = progress.isExternalEdit;
            for (let i = 0; !found && i < this._responseParts.length; i++) {
                const candidate = this._responseParts[i];
                if (candidate.kind === groupKind && !candidate.done && isEqual(candidate.uri, uri)) {
                    candidate.edits.push(edits);
                    candidate.done = progress.done;
                    found = true;
                }
            }
            if (!found) {
                this._responseParts.push({
                    kind: groupKind,
                    uri,
                    edits: groupKind === 'textEditGroup' ? [edits] : edits,
                    done: progress.done,
                    isExternalEdit,
                });
            }
            this._updateRepr(quiet);
        }
        else if (progress.kind === 'progressTask') {
            // Add a new resolving part
            const responsePosition = this._responseParts.push(progress) - 1;
            this._updateRepr(quiet);
            const disp = progress.onDidAddProgress(() => {
                this._updateRepr(false);
            });
            progress.task?.().then((content) => {
                // Stop listening for progress updates once the task settles
                disp.dispose();
                // Replace the resolving part's content with the resolved response
                if (typeof content === 'string') {
                    this._responseParts[responsePosition].content = new MarkdownString(content);
                }
                this._updateRepr(false);
            });
        }
        else if (progress.kind === 'toolInvocation') {
            autorunSelfDisposable(reader => {
                progress.state.read(reader); // update repr when state changes
                this._updateRepr(false);
                if (IChatToolInvocation.isComplete(progress, reader)) {
                    reader.dispose();
                }
            });
            this._responseParts.push(progress);
            this._updateRepr(quiet);
        }
        else {
            this._responseParts.push(progress);
            this._updateRepr(quiet);
        }
    }
    addCitation(citation) {
        this._citations.push(citation);
        this._updateRepr();
    }
    _updateRepr(quiet) {
        super._updateRepr();
        if (!this._onDidChangeValue) {
            return; // called from parent constructor
        }
        this._responseRepr += this._citations.length ? '\n\n' + getCodeCitationsMessage(this._citations) : '';
        if (!quiet) {
            this._onDidChangeValue.fire();
        }
    }
}
var ResponseModelState;
(function (ResponseModelState) {
    ResponseModelState[ResponseModelState["Pending"] = 0] = "Pending";
    ResponseModelState[ResponseModelState["Complete"] = 1] = "Complete";
    ResponseModelState[ResponseModelState["Cancelled"] = 2] = "Cancelled";
})(ResponseModelState || (ResponseModelState = {}));
export class ChatResponseModel extends Disposable {
    get shouldBeBlocked() {
        return this._shouldBeBlocked;
    }
    get request() {
        return this.session.getRequests().find(r => r.id === this.requestId);
    }
    get session() {
        return this._session;
    }
    get shouldBeRemovedOnSend() {
        return this._shouldBeRemovedOnSend;
    }
    get isComplete() {
        return this._modelState.get().value !== 0 /* ResponseModelState.Pending */;
    }
    get timestamp() {
        return this._timestamp;
    }
    set shouldBeRemovedOnSend(disablement) {
        this._shouldBeRemovedOnSend = disablement;
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    get isCanceled() {
        return this._modelState.get().value === 2 /* ResponseModelState.Cancelled */;
    }
    get completedAt() {
        const state = this._modelState.get();
        if (state.value === 1 /* ResponseModelState.Complete */ || state.value === 2 /* ResponseModelState.Cancelled */) {
            return state.completedAt;
        }
        return undefined;
    }
    get vote() {
        return this._vote;
    }
    get voteDownReason() {
        return this._voteDownReason;
    }
    get followups() {
        return this._followups;
    }
    get entireResponse() {
        return this._finalizedResponse || this._response;
    }
    get result() {
        return this._result;
    }
    get username() {
        return this.session.responderUsername;
    }
    get avatarIcon() {
        return this.session.responderAvatarIcon;
    }
    get agent() {
        return this._agent;
    }
    get slashCommand() {
        return this._slashCommand;
    }
    get agentOrSlashCommandDetected() {
        return this._agentOrSlashCommandDetected ?? false;
    }
    get usedContext() {
        return this._usedContext;
    }
    get contentReferences() {
        return Array.from(this._contentReferences);
    }
    get codeCitations() {
        return this._codeCitations;
    }
    get progressMessages() {
        return this._progressMessages;
    }
    get isStale() {
        return this._isStale;
    }
    get response() {
        const undoStop = this._shouldBeRemovedOnSend?.afterUndoStop;
        if (!undoStop) {
            return this._finalizedResponse || this._response;
        }
        if (this._responseView?.undoStop !== undoStop) {
            this._responseView = new ResponseView(this._response, undoStop);
        }
        return this._responseView;
    }
    get codeBlockInfos() {
        return this._codeBlockInfos;
    }
    constructor(params) {
        super();
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._modelState = observableValue(this, { value: 0 /* ResponseModelState.Pending */ });
        this._shouldBeBlocked = false;
        this._contentReferences = [];
        this._codeCitations = [];
        this._progressMessages = [];
        this._isStale = false;
        this._session = params.session;
        this._agent = params.agent;
        this._slashCommand = params.slashCommand;
        this.requestId = params.requestId;
        this._timestamp = params.timestamp || Date.now();
        if (params.modelState) {
            this._modelState.set(params.modelState, undefined);
        }
        this._timeSpentWaitingAccumulator = params.timeSpentWaiting || 0;
        this._vote = params.vote;
        this._voteDownReason = params.voteDownReason;
        this._result = params.result;
        this._followups = params.followups ? [...params.followups] : undefined;
        this.isCompleteAddedRequest = params.isCompleteAddedRequest ?? false;
        this._shouldBeRemovedOnSend = params.shouldBeRemovedOnSend;
        this._shouldBeBlocked = params.shouldBeBlocked ?? false;
        // If we are creating a response with some existing content, consider it stale
        this._isStale = Array.isArray(params.responseContent) && (params.responseContent.length !== 0 || isMarkdownString(params.responseContent) && params.responseContent.value.length !== 0);
        this._response = this._register(new Response(params.responseContent));
        this._codeBlockInfos = params.codeBlockInfos ? [...params.codeBlockInfos] : undefined;
        const signal = observableSignalFromEvent(this, this.onDidChange);
        const _isPendingBool = signal.map((_value, r) => {
            signal.read(r);
            return this._response.value.some(part => part.kind === 'toolInvocation' && part.state.read(r).type === 0 /* IChatToolInvocation.StateKind.WaitingForConfirmation */
                || part.kind === 'confirmation' && part.isUsed === false
                || part.kind === 'elicitation2' && part.state.read(r) === "pending" /* ElicitationState.Pending */);
        });
        this.isPendingConfirmation = _isPendingBool.map(pending => pending ? { startedWaitingAt: Date.now() } : undefined);
        this.isInProgress = signal.map((_value, r) => {
            signal.read(r);
            return !_isPendingBool.read(r)
                && !this.shouldBeRemovedOnSend
                && this._modelState.read(r).value === 0 /* ResponseModelState.Pending */;
        });
        this._register(this._response.onDidChangeValue(() => this._onDidChange.fire(defaultChatResponseModelChangeReason)));
        this.id = params.restoredId ?? 'response_' + generateUuid();
        this._register(this._session.onDidChange((e) => {
            if (e.kind === 'setCheckpoint') {
                const isDisabled = e.disabledResponseIds.has(this.id);
                const didChange = this._shouldBeBlocked === isDisabled;
                this._shouldBeBlocked = isDisabled;
                if (didChange) {
                    this._onDidChange.fire(defaultChatResponseModelChangeReason);
                }
            }
        }));
        let lastStartedWaitingAt = undefined;
        this.confirmationAdjustedTimestamp = derived(reader => {
            const pending = this.isPendingConfirmation.read(reader);
            if (pending && !lastStartedWaitingAt) {
                lastStartedWaitingAt = pending.startedWaitingAt;
            }
            else if (!pending && lastStartedWaitingAt) {
                this._timeSpentWaitingAccumulator += Date.now() - lastStartedWaitingAt;
                lastStartedWaitingAt = undefined;
            }
            return this._timestamp + this._timeSpentWaitingAccumulator;
        }).recomputeInitiallyAndOnChange(this._store);
    }
    initializeCodeBlockInfos(codeBlockInfo) {
        if (this._codeBlockInfos) {
            throw new BugIndicatingError('Code block infos have already been initialized');
        }
        this._codeBlockInfos = [...codeBlockInfo];
    }
    /**
     * Apply a progress update to the actual response content.
     */
    updateContent(responsePart, quiet) {
        this._response.updateContent(responsePart, quiet);
    }
    /**
     * Adds an undo stop at the current position in the stream.
     */
    addUndoStop(undoStop) {
        this._onDidChange.fire({ reason: 'undoStop', id: undoStop.id });
        this._response.updateContent(undoStop, true);
    }
    /**
     * Apply one of the progress updates that are not part of the actual response content.
     */
    applyReference(progress) {
        if (progress.kind === 'usedContext') {
            this._usedContext = progress;
        }
        else if (progress.kind === 'reference') {
            this._contentReferences.push(progress);
            this._onDidChange.fire(defaultChatResponseModelChangeReason);
        }
    }
    applyCodeCitation(progress) {
        this._codeCitations.push(progress);
        this._response.addCitation(progress);
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    setAgent(agent, slashCommand) {
        this._agent = agent;
        this._slashCommand = slashCommand;
        this._agentOrSlashCommandDetected = !agent.isDefault || !!slashCommand;
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    setResult(result) {
        this._result = result;
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    complete() {
        if (this._result?.errorDetails?.responseIsRedacted) {
            this._response.clear();
        }
        this._modelState.set({ value: 1 /* ResponseModelState.Complete */, completedAt: Date.now() }, undefined);
        this._onDidChange.fire({ reason: 'completedRequest' });
    }
    cancel() {
        this._modelState.set({ value: 2 /* ResponseModelState.Cancelled */, completedAt: Date.now() }, undefined);
        this._onDidChange.fire({ reason: 'completedRequest' });
    }
    setFollowups(followups) {
        this._followups = followups;
        this._onDidChange.fire(defaultChatResponseModelChangeReason); // Fire so that command followups get rendered on the row
    }
    setVote(vote) {
        this._vote = vote;
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    setVoteDownReason(reason) {
        this._voteDownReason = reason;
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    setEditApplied(edit, editCount) {
        if (!this.response.value.includes(edit)) {
            return false;
        }
        if (!edit.state) {
            return false;
        }
        edit.state.applied = editCount; // must not be edit.edits.length
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
        return true;
    }
    adoptTo(session) {
        this._session = session;
        this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
    finalizeUndoState() {
        this._finalizedResponse = this.response;
        this._responseView = undefined;
        this._shouldBeRemovedOnSend = undefined;
    }
    toJSON() {
        const modelState = this._modelState.get();
        const pendingConfirmation = this.isPendingConfirmation.get();
        return {
            responseId: this.id,
            result: this.result,
            responseMarkdownInfo: this.codeBlockInfos?.map(info => ({ suggestionId: info.suggestionId })),
            followups: this.followups,
            modelState: modelState.value === 0 /* ResponseModelState.Pending */ ? { value: 2 /* ResponseModelState.Cancelled */, completedAt: Date.now() } : modelState,
            vote: this.vote,
            voteDownReason: this.voteDownReason,
            slashCommand: this.slashCommand,
            usedContext: this.usedContext,
            contentReferences: this.contentReferences,
            codeCitations: this.codeCitations,
            timestamp: this._timestamp,
            timeSpentWaiting: (pendingConfirmation ? Date.now() - pendingConfirmation.startedWaitingAt : 0) + this._timeSpentWaitingAccumulator,
        };
    }
}
/**
 * Normalize chat data from storage to the current format.
 * TODO- ChatModel#_deserialize and reviveSerializedAgent also still do some normalization and maybe that should be done in here too.
 */
export function normalizeSerializableChatData(raw) {
    normalizeOldFields(raw);
    if (!('version' in raw)) {
        return {
            version: 3,
            ...raw,
            lastMessageDate: raw.creationDate,
            customTitle: undefined,
        };
    }
    if (raw.version === 2) {
        return {
            ...raw,
            version: 3,
            customTitle: raw.computedTitle
        };
    }
    return raw;
}
function normalizeOldFields(raw) {
    // Fill in fields that very old chat data may be missing
    if (!raw.sessionId) {
        raw.sessionId = generateUuid();
    }
    if (!raw.creationDate) {
        raw.creationDate = getLastYearDate();
    }
    if ('version' in raw && (raw.version === 2 || raw.version === 3)) {
        if (!raw.lastMessageDate) {
            // A bug led to not porting creationDate properly, and that was copied to lastMessageDate, so fix that up if missing.
            raw.lastMessageDate = getLastYearDate();
        }
    }
    // eslint-disable-next-line local/code-no-any-casts
    if (raw.initialLocation === 'editing-session') {
        raw.initialLocation = ChatAgentLocation.Chat;
    }
}
function getLastYearDate() {
    const lastYearDate = new Date();
    lastYearDate.setFullYear(lastYearDate.getFullYear() - 1);
    return lastYearDate.getTime();
}
export function isExportableSessionData(obj) {
    const data = obj;
    return typeof data === 'object';
}
export function isSerializableSessionData(obj) {
    const data = obj;
    return isExportableSessionData(obj) &&
        typeof data.creationDate === 'number' &&
        typeof data.sessionId === 'string' &&
        obj.requests.every((request) => !request.usedContext /* for backward compat allow missing usedContext */ || isIUsedContext(request.usedContext));
}
export var ChatRequestRemovalReason;
(function (ChatRequestRemovalReason) {
    /**
     * "Normal" remove
     */
    ChatRequestRemovalReason[ChatRequestRemovalReason["Removal"] = 0] = "Removal";
    /**
     * Removed because the request will be resent
     */
    ChatRequestRemovalReason[ChatRequestRemovalReason["Resend"] = 1] = "Resend";
    /**
     * Remove because the request is moving to another model
     */
    ChatRequestRemovalReason[ChatRequestRemovalReason["Adoption"] = 2] = "Adoption";
})(ChatRequestRemovalReason || (ChatRequestRemovalReason = {}));
/**
 * Internal implementation of IInputModel
 */
class InputModel {
    constructor(initialState) {
        this._state = observableValueOpts({ debugName: 'inputModelState', equalsFn: equals }, initialState);
        this.state = this._state;
    }
    setState(state) {
        const current = this._state.get();
        this._state.set({
            // If current is undefined, provide defaults for required fields
            attachments: [],
            mode: { id: 'agent', kind: ChatModeKind.Agent },
            selectedModel: undefined,
            inputText: '',
            selections: [],
            contrib: {},
            ...current,
            ...state
        }, undefined);
    }
    clearState() {
        this._state.set(undefined, undefined);
    }
}
let ChatModel = ChatModel_1 = class ChatModel extends Disposable {
    static getDefaultTitle(requests) {
        const firstRequestMessage = requests.at(0)?.message ?? '';
        const message = typeof firstRequestMessage === 'string' ?
            firstRequestMessage :
            firstRequestMessage.text;
        return message.split('\n')[0].substring(0, 200);
    }
    get contributedChatSession() {
        return this._contributedChatSession;
    }
    setContributedChatSession(session) {
        this._contributedChatSession = session;
    }
    /** @deprecated Use {@link sessionResource} instead */
    get sessionId() {
        return this._sessionId;
    }
    get sessionResource() {
        return this._sessionResource;
    }
    get hasRequests() {
        return this._requests.length > 0;
    }
    get lastRequest() {
        return this._requests.at(-1);
    }
    get timestamp() {
        return this._timestamp;
    }
    get lastMessageDate() {
        return this._lastMessageDate;
    }
    get _defaultAgent() {
        return this.chatAgentService.getDefaultAgent(ChatAgentLocation.Chat, ChatModeKind.Ask);
    }
    get responderUsername() {
        return this._defaultAgent?.fullName ??
            this._initialResponderUsername ?? '';
    }
    get responderAvatarIcon() {
        return this._defaultAgent?.metadata.themeIcon ??
            this._initialResponderAvatarIconUri;
    }
    get isImported() {
        return this._isImported;
    }
    get customTitle() {
        return this._customTitle;
    }
    get title() {
        return this._customTitle || ChatModel_1.getDefaultTitle(this._requests);
    }
    get hasCustomTitle() {
        return this._customTitle !== undefined;
    }
    get editingSession() {
        return this._editingSession;
    }
    get initialLocation() {
        return this._initialLocation;
    }
    get canUseTools() {
        return this._canUseTools;
    }
    constructor(initialData, initialModelProps, logService, chatAgentService, chatEditingService, chatService, configurationService) {
        super();
        this.logService = logService;
        this.chatAgentService = chatAgentService;
        this.chatEditingService = chatEditingService;
        this._onDidDispose = this._register(new Emitter());
        this.onDidDispose = this._onDidDispose.event;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._isImported = false;
        this._canUseTools = true;
        this.currentEditedFileEvents = new ResourceMap();
        this._checkpoint = undefined;
        const isValid = isSerializableSessionData(initialData);
        if (initialData && !isValid) {
            this.logService.warn(`ChatModel#constructor: Loaded malformed session data: ${JSON.stringify(initialData)}`);
        }
        this._isImported = (!!initialData && !isValid) || (initialData?.isImported ?? false);
        this._sessionId = (isValid && initialData.sessionId) || initialModelProps.sessionId || generateUuid();
        this._sessionResource = initialModelProps.resource ?? LocalChatSessionUri.forSession(this._sessionId);
        this._requests = initialData ? this._deserialize(initialData) : [];
        this._timestamp = (isValid && initialData.creationDate) || Date.now();
        this._lastMessageDate = (isValid && initialData.lastMessageDate) || this._timestamp;
        this._customTitle = isValid ? initialData.customTitle : undefined;
        // Initialize input model from serialized data (undefined for new chats)
        const serializedInputState = isValid && initialData.inputState ? initialData.inputState : undefined;
        this.inputModel = new InputModel(serializedInputState && {
            attachments: serializedInputState.attachments,
            mode: serializedInputState.mode,
            selectedModel: serializedInputState.selectedModel && {
                identifier: serializedInputState.selectedModel.identifier,
                metadata: serializedInputState.selectedModel.metadata
            },
            contrib: serializedInputState.contrib,
            inputText: serializedInputState.inputText,
            selections: serializedInputState.selections
        });
        this._initialResponderUsername = initialData?.responderUsername;
        this._initialResponderAvatarIconUri = isUriComponents(initialData?.responderAvatarIconUri) ? URI.revive(initialData.responderAvatarIconUri) : initialData?.responderAvatarIconUri;
        this._initialLocation = initialData?.initialLocation ?? initialModelProps.initialLocation;
        this._canUseTools = initialModelProps.canUseTools;
        const lastRequest = observableFromEvent(this, this.onDidChange, () => this._requests.at(-1));
        this._register(autorun(reader => {
            const request = lastRequest.read(reader);
            if (!request?.response) {
                return;
            }
            reader.store.add(request.response.onDidChange(ev => {
                if (ev.reason === 'completedRequest') {
                    this._onDidChange.fire({ kind: 'completedRequest', request });
                }
            }));
        }));
        this.requestInProgress = lastRequest.map((request, r) => {
            return request?.response?.isInProgress.read(r) ?? false;
        });
        this.requestNeedsInput = lastRequest.map((request, r) => {
            return !!request?.response?.isPendingConfirmation.read(r);
        });
        // Retain a reference to itself when a request is in progress, so the ChatModel stays alive in the background
        // only while running a request. TODO also keep it alive for 5min or so so we don't have to dispose/restore too often?
        if (this.initialLocation === ChatAgentLocation.Chat && configurationService.getValue('chat.localBackgroundSessions')) {
            const selfRef = this._register(new MutableDisposable());
            this._register(autorun(r => {
                const inProgress = this.requestInProgress.read(r);
                const isWaitingForConfirmation = this.requestNeedsInput.read(r);
                const shouldStayAlive = inProgress || isWaitingForConfirmation;
                if (shouldStayAlive && !selfRef.value) {
                    selfRef.value = chatService.getActiveSessionReference(this._sessionResource);
                }
                else if (!shouldStayAlive && selfRef.value) {
                    selfRef.clear();
                }
            }));
        }
    }
    startEditingSession(isGlobalEditingSession, transferFromSession) {
        const session = this._editingSession ??= this._register(transferFromSession
            ? this.chatEditingService.transferEditingSession(this, transferFromSession)
            : isGlobalEditingSession
                ? this.chatEditingService.startOrContinueGlobalEditingSession(this)
                : this.chatEditingService.createEditingSession(this));
        this._register(autorun(reader => {
            this._setDisabledRequests(session.requestDisablement.read(reader));
        }));
    }
    notifyEditingAction(action) {
        const state = action.outcome === 'accepted' ? ChatRequestEditedFileEventKind.Keep :
            action.outcome === 'rejected' ? ChatRequestEditedFileEventKind.Undo :
                action.outcome === 'userModified' ? ChatRequestEditedFileEventKind.UserModification : null;
        if (state === null) {
            return;
        }
        if (!this.currentEditedFileEvents.has(action.uri) || this.currentEditedFileEvents.get(action.uri)?.eventKind === ChatRequestEditedFileEventKind.Keep) {
            this.currentEditedFileEvents.set(action.uri, { eventKind: state, uri: action.uri });
        }
    }
    _deserialize(obj) {
        const requests = obj.requests;
        if (!Array.isArray(requests)) {
            this.logService.error(`Ignoring malformed session data: ${JSON.stringify(obj)}`);
            return [];
        }
        try {
            return requests.map((raw) => {
                const parsedRequest = typeof raw.message === 'string'
                    ? this.getParsedRequestFromString(raw.message)
                    : reviveParsedChatRequest(raw.message);
                // Old messages don't have variableData, or have it in the wrong (non-array) shape
                const variableData = this.reviveVariableData(raw.variableData);
                const request = new ChatRequestModel({
                    session: this,
                    message: parsedRequest,
                    variableData,
                    timestamp: raw.timestamp ?? -1,
                    restoredId: raw.requestId,
                    confirmation: raw.confirmation,
                    editedFileEvents: raw.editedFileEvents,
                    modelId: raw.modelId,
                });
                request.shouldBeRemovedOnSend = raw.isHidden ? { requestId: raw.requestId } : raw.shouldBeRemovedOnSend;
                // eslint-disable-next-line local/code-no-any-casts
                if (raw.response || raw.result || raw.responseErrorDetails) {
                    const agent = (raw.agent && 'metadata' in raw.agent) ? // Check for the new format, ignore entries in the old format
                        reviveSerializedAgent(raw.agent) : undefined;
                    // Port entries from old format
                    const result = 'responseErrorDetails' in raw ?
                        // eslint-disable-next-line local/code-no-dangerous-type-assertions
                        { errorDetails: raw.responseErrorDetails } : raw.result;
                    request.response = new ChatResponseModel({
                        responseContent: raw.response ?? [new MarkdownString(raw.response)],
                        session: this,
                        agent,
                        slashCommand: raw.slashCommand,
                        requestId: request.id,
                        modelState: raw.modelState || { value: raw.isCanceled ? 2 /* ResponseModelState.Cancelled */ : 1 /* ResponseModelState.Complete */, completedAt: Date.now() },
                        vote: raw.vote,
                        timestamp: raw.timestamp,
                        voteDownReason: raw.voteDownReason,
                        result,
                        followups: raw.followups,
                        restoredId: raw.responseId,
                        timeSpentWaiting: raw.timeSpentWaiting,
                        shouldBeBlocked: request.shouldBeBlocked,
                        codeBlockInfos: raw.responseMarkdownInfo?.map(info => ({ suggestionId: info.suggestionId })),
                    });
                    request.response.shouldBeRemovedOnSend = raw.isHidden ? { requestId: raw.requestId } : raw.shouldBeRemovedOnSend;
                    if (raw.usedContext) { // @ulugbekna: if this's a new vscode sessions, doc versions are incorrect anyway?
                        request.response.applyReference(revive(raw.usedContext));
                    }
                    raw.contentReferences?.forEach(r => request.response.applyReference(revive(r)));
                    raw.codeCitations?.forEach(c => request.response.applyCodeCitation(revive(c)));
                }
                return request;
            });
        }
        catch (error) {
            this.logService.error('Failed to parse chat data', error);
            return [];
        }
    }
    reviveVariableData(raw) {
        const variableData = raw && Array.isArray(raw.variables)
            ? raw :
            { variables: [] };
        variableData.variables = variableData.variables.map((v) => {
            // Old variables format
            if (v && 'values' in v && Array.isArray(v.values)) {
                return {
                    kind: 'generic',
                    id: v.id ?? '',
                    name: v.name,
                    value: v.values[0]?.value,
                    range: v.range,
                    modelDescription: v.modelDescription,
                    references: v.references
                };
            }
            else {
                return v;
            }
        });
        return variableData;
    }
    getParsedRequestFromString(message) {
        // TODO These offsets won't be used, but chat replies need to go through the parser as well
        const parts = [new ChatRequestTextPart(new OffsetRange(0, message.length), { startColumn: 1, startLineNumber: 1, endColumn: 1, endLineNumber: 1 }, message)];
        return {
            text: message,
            parts
        };
    }
    getRequests() {
        return this._requests;
    }
    resetCheckpoint() {
        for (const request of this._requests) {
            request.shouldBeBlocked = false;
        }
    }
    setCheckpoint(requestId) {
        let checkpoint;
        let checkpointIndex = -1;
        if (requestId !== undefined) {
            this._requests.forEach((request, index) => {
                if (request.id === requestId) {
                    checkpointIndex = index;
                    checkpoint = request;
                    request.shouldBeBlocked = true;
                }
            });
            if (!checkpoint) {
                return; // Invalid request ID
            }
        }
        const disabledRequestIds = new Set();
        const disabledResponseIds = new Set();
        for (let i = this._requests.length - 1; i >= 0; i -= 1) {
            const request = this._requests[i];
            if (this._checkpoint && !checkpoint) {
                request.shouldBeBlocked = false;
            }
            else if (checkpoint && i >= checkpointIndex) {
                request.shouldBeBlocked = true;
                disabledRequestIds.add(request.id);
                if (request.response) {
                    disabledResponseIds.add(request.response.id);
                }
            }
            else if (checkpoint && i < checkpointIndex) {
                request.shouldBeBlocked = false;
            }
        }
        this._checkpoint = checkpoint;
        this._onDidChange.fire({
            kind: 'setCheckpoint',
            disabledRequestIds,
            disabledResponseIds
        });
    }
    get checkpoint() {
        return this._checkpoint;
    }
    _setDisabledRequests(requestIds) {
        this._requests.forEach((request) => {
            const shouldBeRemovedOnSend = requestIds.find(r => r.requestId === request.id);
            request.shouldBeRemovedOnSend = shouldBeRemovedOnSend;
            if (request.response) {
                request.response.shouldBeRemovedOnSend = shouldBeRemovedOnSend;
            }
        });
        this._onDidChange.fire({ kind: 'setHidden' });
    }
    addRequest(message, variableData, attempt, modeInfo, chatAgent, slashCommand, confirmation, locationData, attachments, isCompleteAddedRequest, modelId, userSelectedTools) {
        const editedFileEvents = [...this.currentEditedFileEvents.values()];
        this.currentEditedFileEvents.clear();
        const request = new ChatRequestModel({
            session: this,
            message,
            variableData,
            timestamp: Date.now(),
            attempt,
            modeInfo,
            confirmation,
            locationData,
            attachedContext: attachments,
            isCompleteAddedRequest,
            modelId,
            editedFileEvents: editedFileEvents.length ? editedFileEvents : undefined,
            userSelectedTools,
        });
        request.response = new ChatResponseModel({
            responseContent: [],
            session: this,
            agent: chatAgent,
            slashCommand,
            requestId: request.id,
            isCompleteAddedRequest,
            codeBlockInfos: undefined,
        });
        this._requests.push(request);
        this._lastMessageDate = Date.now();
        this._onDidChange.fire({ kind: 'addRequest', request });
        return request;
    }
    setCustomTitle(title) {
        this._customTitle = title;
        this._onDidChange.fire({ kind: 'setCustomTitle', title });
    }
    updateRequest(request, variableData) {
        request.variableData = variableData;
        this._onDidChange.fire({ kind: 'changedRequest', request });
    }
    adoptRequest(request) {
        // this doesn't use `removeRequest` because it must not dispose the request object
        const oldOwner = request.session;
        const index = oldOwner._requests.findIndex((candidate) => candidate.id === request.id);
        if (index === -1) {
            return;
        }
        oldOwner._requests.splice(index, 1);
        request.adoptTo(this);
        request.response?.adoptTo(this);
        this._requests.push(request);
        oldOwner._onDidChange.fire({ kind: 'removeRequest', requestId: request.id, responseId: request.response?.id, reason: 2 /* ChatRequestRemovalReason.Adoption */ });
        this._onDidChange.fire({ kind: 'addRequest', request });
    }
    acceptResponseProgress(request, progress, quiet) {
        if (!request.response) {
            request.response = new ChatResponseModel({
                responseContent: [],
                session: this,
                requestId: request.id,
                codeBlockInfos: undefined,
            });
        }
        if (request.response.isComplete) {
            throw new Error('acceptResponseProgress: Adding progress to a completed response');
        }
        if (progress.kind === 'usedContext' || progress.kind === 'reference') {
            request.response.applyReference(progress);
        }
        else if (progress.kind === 'codeCitation') {
            request.response.applyCodeCitation(progress);
        }
        else if (progress.kind === 'move') {
            this._onDidChange.fire({ kind: 'move', target: progress.uri, range: progress.range });
        }
        else if (progress.kind === 'codeblockUri' && progress.isEdit) {
            request.response.addUndoStop({ id: generateUuid(), kind: 'undoStop' });
            request.response.updateContent(progress, quiet);
        }
        else if (progress.kind === 'progressTaskResult') {
            // Should have been handled upstream, not sent to model
            this.logService.error(`Couldn't handle progress: ${JSON.stringify(progress)}`);
        }
        else {
            request.response.updateContent(progress, quiet);
        }
    }
    removeRequest(id, reason = 0 /* ChatRequestRemovalReason.Removal */) {
        const index = this._requests.findIndex(request => request.id === id);
        const request = this._requests[index];
        if (index !== -1) {
            this._onDidChange.fire({ kind: 'removeRequest', requestId: request.id, responseId: request.response?.id, reason });
            this._requests.splice(index, 1);
            request.response?.dispose();
        }
    }
    cancelRequest(request) {
        if (request.response) {
            request.response.cancel();
        }
    }
    setResponse(request, result) {
        if (!request.response) {
            request.response = new ChatResponseModel({
                responseContent: [],
                session: this,
                requestId: request.id,
                codeBlockInfos: undefined,
            });
        }
        request.response.setResult(result);
    }
    setFollowups(request, followups) {
        if (!request.response) {
            // Maybe something went wrong?
            return;
        }
        request.response.setFollowups(followups);
    }
    setResponseModel(request, response) {
        request.response = response;
        this._onDidChange.fire({ kind: 'addResponse', response });
    }
    toExport() {
        return {
            responderUsername: this.responderUsername,
            responderAvatarIconUri: this.responderAvatarIcon,
            initialLocation: this.initialLocation,
            requests: this._requests.map((r) => {
                const message = {
                    ...r.message,
                    parts: r.message.parts.map((p) => p && 'toJSON' in p ? p.toJSON() : p)
                };
                const agent = r.response?.agent;
                const agentJson = agent && 'toJSON' in agent ? agent.toJSON() :
                    agent ? { ...agent } : undefined;
                return {
                    requestId: r.id,
                    message,
                    variableData: r.variableData,
                    response: r.response ?
                        r.response.entireResponse.value.map(item => {
                            // Keeping the shape of the persisted data the same for back compat
                            if (item.kind === 'treeData') {
                                return item.treeData;
                            }
                            else if (item.kind === 'markdownContent') {
                                return item.content;
                            }
                            else if (item.kind === 'thinking') {
                                return {
                                    kind: 'thinking',
                                    value: item.value,
                                    id: item.id,
                                    metadata: item.metadata
                                };
                            }
                            else if (item.kind === 'confirmation') {
                                return { ...item, isLive: false };
                            }
                            else {
                                // eslint-disable-next-line local/code-no-any-casts
                                return item; // TODO
                            }
                        })
                        : undefined,
                    shouldBeRemovedOnSend: r.shouldBeRemovedOnSend,
                    agent: agentJson,
                    timestamp: r.timestamp,
                    confirmation: r.confirmation,
                    editedFileEvents: r.editedFileEvents,
                    modelId: r.modelId,
                    ...r.response?.toJSON(),
                };
            }),
        };
    }
    toJSON() {
        const inputState = this.inputModel.state.get();
        return {
            version: 3,
            ...this.toExport(),
            sessionId: this.sessionId,
            creationDate: this._timestamp,
            isImported: this._isImported,
            lastMessageDate: this._lastMessageDate,
            customTitle: this._customTitle,
            // Only include inputState if it has been set
            ...(inputState ? {
                inputState: {
                    contrib: inputState.contrib,
                    attachments: inputState.attachments,
                    mode: inputState.mode,
                    selectedModel: inputState.selectedModel ? {
                        identifier: inputState.selectedModel.identifier,
                        metadata: inputState.selectedModel.metadata
                    } : undefined,
                    inputText: inputState.inputText,
                    selections: inputState.selections
                }
            } : {})
        };
    }
    dispose() {
        this._requests.forEach(r => r.response?.dispose());
        this._onDidDispose.fire();
        super.dispose();
    }
};
ChatModel = ChatModel_1 = __decorate([
    __param(2, ILogService),
    __param(3, IChatAgentService),
    __param(4, IChatEditingService),
    __param(5, IChatService),
    __param(6, IConfigurationService)
], ChatModel);
export { ChatModel };
export function updateRanges(variableData, diff) {
    return {
        variables: variableData.variables.map(v => ({
            ...v,
            range: v.range && {
                start: v.range.start - diff,
                endExclusive: v.range.endExclusive - diff
            }
        }))
    };
}
export function canMergeMarkdownStrings(md1, md2) {
    if (md1.baseUri && md2.baseUri) {
        const baseUriEquals = md1.baseUri.scheme === md2.baseUri.scheme
            && md1.baseUri.authority === md2.baseUri.authority
            && md1.baseUri.path === md2.baseUri.path
            && md1.baseUri.query === md2.baseUri.query
            && md1.baseUri.fragment === md2.baseUri.fragment;
        if (!baseUriEquals) {
            return false;
        }
    }
    else if (md1.baseUri || md2.baseUri) {
        return false;
    }
    return equals(md1.isTrusted, md2.isTrusted) &&
        md1.supportHtml === md2.supportHtml &&
        md1.supportThemeIcons === md2.supportThemeIcons;
}
export function appendMarkdownString(md1, md2) {
    const appendedValue = typeof md2 === 'string' ? md2 : md2.value;
    return {
        value: md1.value + appendedValue,
        isTrusted: md1.isTrusted,
        supportThemeIcons: md1.supportThemeIcons,
        supportHtml: md1.supportHtml,
        baseUri: md1.baseUri
    };
}
export function getCodeCitationsMessage(citations) {
    if (citations.length === 0) {
        return '';
    }
    const licenseTypes = citations.reduce((set, c) => set.add(c.license), new Set());
    const label = licenseTypes.size === 1 ?
        localize('codeCitation', "Similar code found with 1 license type", licenseTypes.size) :
        localize('codeCitations', "Similar code found with {0} license types", licenseTypes.size);
    return label;
}
export var ChatRequestEditedFileEventKind;
(function (ChatRequestEditedFileEventKind) {
    ChatRequestEditedFileEventKind[ChatRequestEditedFileEventKind["Keep"] = 1] = "Keep";
    ChatRequestEditedFileEventKind[ChatRequestEditedFileEventKind["Undo"] = 2] = "Undo";
    ChatRequestEditedFileEventKind[ChatRequestEditedFileEventKind["UserModification"] = 3] = "UserModification";
})(ChatRequestEditedFileEventKind || (ChatRequestEditedFileEventKind = {}));
/** URI for a resource embedded in a chat request/response */
export var ChatResponseResource;
(function (ChatResponseResource) {
    ChatResponseResource.scheme = 'vscode-chat-response-resource';
    function createUri(sessionId, toolCallId, index, basename) {
        return URI.from({
            scheme: ChatResponseResource.scheme,
            authority: sessionId,
            path: `/tool/${toolCallId}/${index}` + (basename ? `/${basename}` : ''),
        });
    }
    ChatResponseResource.createUri = createUri;
    function parseUri(uri) {
        if (uri.scheme !== ChatResponseResource.scheme) {
            return undefined;
        }
        const parts = uri.path.split('/');
        if (parts.length < 5) {
            return undefined;
        }
        const [, kind, toolCallId, index] = parts;
        if (kind !== 'tool') {
            return undefined;
        }
        return {
            sessionId: uri.authority,
            toolCallId: toolCallId,
            index: Number(index),
        };
    }
    ChatResponseResource.parseUri = parseUri;
})(ChatResponseResource || (ChatResponseResource = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1vZGVsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL2NoYXRNb2RlbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFtQixjQUFjLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUMzRyxPQUFPLEVBQUUsVUFBVSxFQUFlLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzVELE9BQU8sRUFBZSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLHlCQUF5QixFQUFFLGVBQWUsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ25NLE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFHekUsT0FBTyxFQUFFLEdBQUcsRUFBeUIsZUFBZSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDN0YsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlDQUFp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