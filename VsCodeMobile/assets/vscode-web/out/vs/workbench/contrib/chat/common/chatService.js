/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { autorun, autorunSelfDisposable } from '../../../../base/common/observable.js';
import { URI } from '../../../../base/common/uri.js';
import { Range } from '../../../../editor/common/core/range.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
export var ChatErrorLevel;
(function (ChatErrorLevel) {
    ChatErrorLevel[ChatErrorLevel["Info"] = 0] = "Info";
    ChatErrorLevel[ChatErrorLevel["Warning"] = 1] = "Warning";
    ChatErrorLevel[ChatErrorLevel["Error"] = 2] = "Error";
})(ChatErrorLevel || (ChatErrorLevel = {}));
export function isIDocumentContext(obj) {
    return (!!obj &&
        typeof obj === 'object' &&
        'uri' in obj && obj.uri instanceof URI &&
        'version' in obj && typeof obj.version === 'number' &&
        'ranges' in obj && Array.isArray(obj.ranges) && obj.ranges.every(Range.isIRange));
}
export function isIUsedContext(obj) {
    return (!!obj &&
        typeof obj === 'object' &&
        'documents' in obj &&
        Array.isArray(obj.documents) &&
        obj.documents.every(isIDocumentContext));
}
export var ChatResponseReferencePartStatusKind;
(function (ChatResponseReferencePartStatusKind) {
    ChatResponseReferencePartStatusKind[ChatResponseReferencePartStatusKind["Complete"] = 1] = "Complete";
    ChatResponseReferencePartStatusKind[ChatResponseReferencePartStatusKind["Partial"] = 2] = "Partial";
    ChatResponseReferencePartStatusKind[ChatResponseReferencePartStatusKind["Omitted"] = 3] = "Omitted";
})(ChatResponseReferencePartStatusKind || (ChatResponseReferencePartStatusKind = {}));
export var ChatResponseClearToPreviousToolInvocationReason;
(function (ChatResponseClearToPreviousToolInvocationReason) {
    ChatResponseClearToPreviousToolInvocationReason[ChatResponseClearToPreviousToolInvocationReason["NoReason"] = 0] = "NoReason";
    ChatResponseClearToPreviousToolInvocationReason[ChatResponseClearToPreviousToolInvocationReason["FilteredContentRetry"] = 1] = "FilteredContentRetry";
    ChatResponseClearToPreviousToolInvocationReason[ChatResponseClearToPreviousToolInvocationReason["CopyrightContentRetry"] = 2] = "CopyrightContentRetry";
})(ChatResponseClearToPreviousToolInvocationReason || (ChatResponseClearToPreviousToolInvocationReason = {}));
export var ElicitationState;
(function (ElicitationState) {
    ElicitationState["Pending"] = "pending";
    ElicitationState["Accepted"] = "accepted";
    ElicitationState["Rejected"] = "rejected";
})(ElicitationState || (ElicitationState = {}));
export var ToolConfirmKind;
(function (ToolConfirmKind) {
    ToolConfirmKind[ToolConfirmKind["Denied"] = 0] = "Denied";
    ToolConfirmKind[ToolConfirmKind["ConfirmationNotNeeded"] = 1] = "ConfirmationNotNeeded";
    ToolConfirmKind[ToolConfirmKind["Setting"] = 2] = "Setting";
    ToolConfirmKind[ToolConfirmKind["LmServicePerTool"] = 3] = "LmServicePerTool";
    ToolConfirmKind[ToolConfirmKind["UserAction"] = 4] = "UserAction";
    ToolConfirmKind[ToolConfirmKind["Skipped"] = 5] = "Skipped";
})(ToolConfirmKind || (ToolConfirmKind = {}));
export var IChatToolInvocation;
(function (IChatToolInvocation) {
    let StateKind;
    (function (StateKind) {
        StateKind[StateKind["WaitingForConfirmation"] = 0] = "WaitingForConfirmation";
        StateKind[StateKind["Executing"] = 1] = "Executing";
        StateKind[StateKind["WaitingForPostApproval"] = 2] = "WaitingForPostApproval";
        StateKind[StateKind["Completed"] = 3] = "Completed";
        StateKind[StateKind["Cancelled"] = 4] = "Cancelled";
    })(StateKind = IChatToolInvocation.StateKind || (IChatToolInvocation.StateKind = {}));
    function executionConfirmedOrDenied(invocation, reader) {
        if (invocation.kind === 'toolInvocationSerialized') {
            if (invocation.isConfirmed === undefined || typeof invocation.isConfirmed === 'boolean') {
                return { type: invocation.isConfirmed ? 4 /* ToolConfirmKind.UserAction */ : 0 /* ToolConfirmKind.Denied */ };
            }
            return invocation.isConfirmed;
        }
        const state = invocation.state.read(reader);
        if (state.type === 0 /* StateKind.WaitingForConfirmation */) {
            return undefined; // don't know yet
        }
        if (state.type === 4 /* StateKind.Cancelled */) {
            return { type: state.reason };
        }
        return state.confirmed;
    }
    IChatToolInvocation.executionConfirmedOrDenied = executionConfirmedOrDenied;
    function awaitConfirmation(invocation, token) {
        const reason = executionConfirmedOrDenied(invocation);
        if (reason) {
            return Promise.resolve(reason);
        }
        const store = new DisposableStore();
        return new Promise(resolve => {
            if (token) {
                store.add(token.onCancellationRequested(() => {
                    resolve({ type: 0 /* ToolConfirmKind.Denied */ });
                }));
            }
            store.add(autorun(reader => {
                const reason = executionConfirmedOrDenied(invocation, reader);
                if (reason) {
                    store.dispose();
                    resolve(reason);
                }
            }));
        }).finally(() => {
            store.dispose();
        });
    }
    IChatToolInvocation.awaitConfirmation = awaitConfirmation;
    function postApprovalConfirmedOrDenied(invocation, reader) {
        const state = invocation.state.read(reader);
        if (state.type === 3 /* StateKind.Completed */) {
            return state.postConfirmed || { type: 1 /* ToolConfirmKind.ConfirmationNotNeeded */ };
        }
        if (state.type === 4 /* StateKind.Cancelled */) {
            return { type: state.reason };
        }
        return undefined;
    }
    function confirmWith(invocation, reason) {
        const state = invocation?.state.get();
        if (state?.type === 0 /* StateKind.WaitingForConfirmation */ || state?.type === 2 /* StateKind.WaitingForPostApproval */) {
            state.confirm(reason);
            return true;
        }
        return false;
    }
    IChatToolInvocation.confirmWith = confirmWith;
    function awaitPostConfirmation(invocation, token) {
        const reason = postApprovalConfirmedOrDenied(invocation);
        if (reason) {
            return Promise.resolve(reason);
        }
        const store = new DisposableStore();
        return new Promise(resolve => {
            if (token) {
                store.add(token.onCancellationRequested(() => {
                    resolve({ type: 0 /* ToolConfirmKind.Denied */ });
                }));
            }
            store.add(autorun(reader => {
                const reason = postApprovalConfirmedOrDenied(invocation, reader);
                if (reason) {
                    store.dispose();
                    resolve(reason);
                }
            }));
        }).finally(() => {
            store.dispose();
        });
    }
    IChatToolInvocation.awaitPostConfirmation = awaitPostConfirmation;
    function resultDetails(invocation, reader) {
        if (invocation.kind === 'toolInvocationSerialized') {
            return invocation.resultDetails;
        }
        const state = invocation.state.read(reader);
        if (state.type === 3 /* StateKind.Completed */ || state.type === 2 /* StateKind.WaitingForPostApproval */) {
            return state.resultDetails;
        }
        return undefined;
    }
    IChatToolInvocation.resultDetails = resultDetails;
    function isComplete(invocation, reader) {
        if ('isComplete' in invocation) { // serialized
            return true; // always cancelled or complete
        }
        const state = invocation.state.read(reader);
        return state.type === 3 /* StateKind.Completed */ || state.type === 4 /* StateKind.Cancelled */;
    }
    IChatToolInvocation.isComplete = isComplete;
})(IChatToolInvocation || (IChatToolInvocation = {}));
export class ChatMcpServersStarting {
    get isEmpty() {
        const s = this.state.get();
        return !s.working && s.serversRequiringInteraction.length === 0;
    }
    constructor(state) {
        this.state = state;
        this.kind = 'mcpServersStarting';
        this.didStartServerIds = [];
    }
    wait() {
        return new Promise(resolve => {
            autorunSelfDisposable(reader => {
                const s = this.state.read(reader);
                if (!s.working) {
                    reader.dispose();
                    resolve(s);
                }
            });
        });
    }
    toJSON() {
        return { kind: 'mcpServersStarting', didStartServerIds: this.didStartServerIds };
    }
}
export function isChatFollowup(obj) {
    return (!!obj &&
        obj.kind === 'reply' &&
        typeof obj.message === 'string' &&
        typeof obj.agentId === 'string');
}
export var ChatAgentVoteDirection;
(function (ChatAgentVoteDirection) {
    ChatAgentVoteDirection[ChatAgentVoteDirection["Down"] = 0] = "Down";
    ChatAgentVoteDirection[ChatAgentVoteDirection["Up"] = 1] = "Up";
})(ChatAgentVoteDirection || (ChatAgentVoteDirection = {}));
export var ChatAgentVoteDownReason;
(function (ChatAgentVoteDownReason) {
    ChatAgentVoteDownReason["IncorrectCode"] = "incorrectCode";
    ChatAgentVoteDownReason["DidNotFollowInstructions"] = "didNotFollowInstructions";
    ChatAgentVoteDownReason["IncompleteCode"] = "incompleteCode";
    ChatAgentVoteDownReason["MissingContext"] = "missingContext";
    ChatAgentVoteDownReason["PoorlyWrittenOrFormatted"] = "poorlyWrittenOrFormatted";
    ChatAgentVoteDownReason["RefusedAValidRequest"] = "refusedAValidRequest";
    ChatAgentVoteDownReason["OffensiveOrUnsafe"] = "offensiveOrUnsafe";
    ChatAgentVoteDownReason["Other"] = "other";
    ChatAgentVoteDownReason["WillReportIssue"] = "willReportIssue";
})(ChatAgentVoteDownReason || (ChatAgentVoteDownReason = {}));
export var ChatCopyKind;
(function (ChatCopyKind) {
    // Keyboard shortcut or context menu
    ChatCopyKind[ChatCopyKind["Action"] = 1] = "Action";
    ChatCopyKind[ChatCopyKind["Toolbar"] = 2] = "Toolbar";
})(ChatCopyKind || (ChatCopyKind = {}));
export const IChatService = createDecorator('IChatService');
export const KEYWORD_ACTIVIATION_SETTING_ID = 'accessibility.voice.keywordActivation';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vY2hhdFNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFPaEcsT0FBTyxFQUFFLGVBQWUsRUFBYyxNQUFNLHNDQUFzQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxPQUFPLEVBQUUscUJBQXFCLEVBQXdCLE1BQU0sdUNBQXVDLENBQUM7QUFFN0csT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNwRSxPQUFPLEVBQVUsS0FBSyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFJeEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBbUI3RixNQUFNLENBQU4sSUFBWSxjQUlYO0FBSkQsV0FBWSxjQUFjO0lBQ3pCLG1EQUFRLENBQUE7SUFDUix5REFBVyxDQUFBO0lBQ1gscURBQVMsQ0FBQTtBQUNWLENBQUMsRUFKVyxjQUFjLEtBQWQsY0FBYyxRQUl6QjtBQWlDRCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsR0FBWTtJQUM5QyxPQUFPLENBQ04sQ0FBQyxDQUFDLEdBQUc7UUFDTCxPQUFPLEdBQUcsS0FBSyxRQUFRO1FBQ3ZCLEtBQUssSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsWUFBWSxHQUFHO1FBQ3RDLFNBQVMsSUFBSSxHQUFHLElBQUksT0FBTyxHQUFHLENBQUMsT0FBTyxLQUFLLFFBQVE7UUFDbkQsUUFBUSxJQUFJLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQ2hGLENBQUM7QUFDSCxDQUFDO0FBT0QsTUFBTSxVQUFVLGNBQWMsQ0FB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