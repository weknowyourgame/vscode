/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { decodeHex, encodeHex, VSBuffer } from '../../../../base/common/buffer.js';
import { autorunSelfDisposable } from '../../../../base/common/observable.js';
import { hasKey } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
export const IChatEditingService = createDecorator('chatEditingService');
export function chatEditingSessionIsReady(session) {
    return new Promise(resolve => {
        autorunSelfDisposable(reader => {
            const state = session.state.read(reader);
            if (state !== 0 /* ChatEditingSessionState.Initial */) {
                reader.dispose();
                resolve();
            }
        });
    });
}
export var ModifiedFileEntryState;
(function (ModifiedFileEntryState) {
    ModifiedFileEntryState[ModifiedFileEntryState["Modified"] = 0] = "Modified";
    ModifiedFileEntryState[ModifiedFileEntryState["Accepted"] = 1] = "Accepted";
    ModifiedFileEntryState[ModifiedFileEntryState["Rejected"] = 2] = "Rejected";
})(ModifiedFileEntryState || (ModifiedFileEntryState = {}));
export var ChatEditingSessionState;
(function (ChatEditingSessionState) {
    ChatEditingSessionState[ChatEditingSessionState["Initial"] = 0] = "Initial";
    ChatEditingSessionState[ChatEditingSessionState["StreamingEdits"] = 1] = "StreamingEdits";
    ChatEditingSessionState[ChatEditingSessionState["Idle"] = 2] = "Idle";
    ChatEditingSessionState[ChatEditingSessionState["Disposed"] = 3] = "Disposed";
})(ChatEditingSessionState || (ChatEditingSessionState = {}));
export const CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME = 'chat-editing-multi-diff-source';
export const chatEditingWidgetFileStateContextKey = new RawContextKey('chatEditingWidgetFileState', undefined, localize('chatEditingWidgetFileState', "The current state of the file in the chat editing widget"));
export const chatEditingAgentSupportsReadonlyReferencesContextKey = new RawContextKey('chatEditingAgentSupportsReadonlyReferences', undefined, localize('chatEditingAgentSupportsReadonlyReferences', "Whether the chat editing agent supports readonly references (temporary)"));
export const decidedChatEditingResourceContextKey = new RawContextKey('decidedChatEditingResource', []);
export const chatEditingResourceContextKey = new RawContextKey('chatEditingResource', undefined);
export const inChatEditingSessionContextKey = new RawContextKey('inChatEditingSession', undefined);
export const hasUndecidedChatEditingResourceContextKey = new RawContextKey('hasUndecidedChatEditingResource', false);
export const hasAppliedChatEditsContextKey = new RawContextKey('hasAppliedChatEdits', false);
export const applyingChatEditsFailedContextKey = new RawContextKey('applyingChatEditsFailed', false);
export const chatEditingMaxFileAssignmentName = 'chatEditingSessionFileLimit';
export const defaultChatEditingMaxFileLimit = 10;
export var ChatEditKind;
(function (ChatEditKind) {
    ChatEditKind[ChatEditKind["Created"] = 0] = "Created";
    ChatEditKind[ChatEditKind["Modified"] = 1] = "Modified";
})(ChatEditKind || (ChatEditKind = {}));
export function isChatEditingActionContext(thing) {
    return typeof thing === 'object' && !!thing && hasKey(thing, { sessionResource: true });
}
export function getMultiDiffSourceUri(session, showPreviousChanges) {
    return URI.from({
        scheme: CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME,
        authority: encodeHex(VSBuffer.fromString(session.chatSessionResource.toString())),
        query: showPreviousChanges ? 'previous' : undefined,
    });
}
export function parseChatMultiDiffUri(uri) {
    const chatSessionResource = URI.parse(decodeHex(uri.authority).toString());
    const showPreviousChanges = uri.query === 'previous';
    return { chatSessionResource, showPreviousChanges };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL2NoYXRFZGl0aW5nU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUluRixPQUFPLEVBQUUscUJBQXFCLEVBQXdCLE1BQU0sdUNBQXVDLENBQUM7QUFDcEcsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUtyRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQU83RixNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBRyxlQUFlLENBQXNCLG9CQUFvQixDQUFDLENBQUM7QUEySjlGLE1BQU0sVUFBVSx5QkFBeUIsQ0FBQyxPQUE0QjtJQUNyRSxPQUFPLElBQUksT0FBTyxDQUFPLE9BQU8sQ0FBQyxFQUFFO1FBQ2xDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQzlCLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3pDLElBQUksS0FBSyw0Q0FBb0MsRUFBRSxDQUFDO2dCQUMvQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2pCLE9BQU8sRUFBRSxDQUFDO1lBQ1gsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDSixD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