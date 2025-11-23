/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { fromNow } from '../../../../../base/common/date.js';
import { Schemas } from '../../../../../base/common/network.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { localChatSessionType } from '../../common/chatSessionsService.js';
import { ChatEditorInput } from '../chatEditorInput.js';
export const NEW_CHAT_SESSION_ACTION_ID = 'workbench.action.chat.openNewSessionEditor';
export function isChatSession(schemes, editor) {
    if (!(editor instanceof ChatEditorInput)) {
        return false;
    }
    if (!schemes.includes(editor.resource?.scheme) && editor.resource?.scheme !== Schemas.vscodeLocalChatSession && editor.resource?.scheme !== Schemas.vscodeChatEditor) {
        return false;
    }
    if (editor.options.ignoreInView) {
        return false;
    }
    return true;
}
/**
 * Find existing chat editors that have the same session URI (for external providers)
 */
export function findExistingChatEditorByUri(sessionUri, editorGroupsService) {
    for (const group of editorGroupsService.groups) {
        for (const editor of group.editors) {
            if (editor instanceof ChatEditorInput && isEqual(editor.sessionResource, sessionUri)) {
                return { editor, group };
            }
        }
    }
    return undefined;
}
// Helper function to update relative time for chat sessions (similar to timeline)
function updateRelativeTime(item, lastRelativeTime) {
    if (item.timing?.startTime) {
        item.relativeTime = fromNow(item.timing.startTime);
        item.relativeTimeFullWord = fromNow(item.timing.startTime, false, true);
        if (lastRelativeTime === undefined || item.relativeTime !== lastRelativeTime) {
            lastRelativeTime = item.relativeTime;
            item.hideRelativeTime = false;
        }
        else {
            item.hideRelativeTime = true;
        }
    }
    else {
        // Clear timestamp properties if no timestamp
        item.relativeTime = undefined;
        item.relativeTimeFullWord = undefined;
        item.hideRelativeTime = false;
    }
    return lastRelativeTime;
}
// Helper function to extract timestamp from session item
export function extractTimestamp(item) {
    // Use timing.startTime if available from the API
    if (item.timing?.startTime) {
        return item.timing.startTime;
    }
    // For other items, timestamp might already be set
    if ('timestamp' in item) {
        // eslint-disable-next-line local/code-no-any-casts
        return item.timestamp;
    }
    return undefined;
}
// Helper function to sort sessions by timestamp (newest first)
function sortSessionsByTimestamp(sessions) {
    sessions.sort((a, b) => {
        const aTime = a.timing?.startTime ?? 0;
        const bTime = b.timing?.startTime ?? 0;
        return bTime - aTime; // newest first
    });
}
// Helper function to apply time grouping to a list of sessions
function applyTimeGrouping(sessions) {
    let lastRelativeTime;
    sessions.forEach(session => {
        lastRelativeTime = updateRelativeTime(session, lastRelativeTime);
    });
}
// Helper function to process session items with timestamps, sorting, and grouping
export function processSessionsWithTimeGrouping(sessions) {
    const sessionsTemp = [...sessions];
    // Only process if we have sessions with timestamps
    if (sessions.some(session => session.timing?.startTime !== undefined)) {
        sortSessionsByTimestamp(sessionsTemp);
        applyTimeGrouping(sessionsTemp);
    }
    return sessionsTemp;
}
// Helper function to create context overlay for session items
export function getSessionItemContextOverlay(session, provider, chatWidgetService, chatService, editorGroupsService) {
    const overlay = [];
    if (provider) {
        overlay.push([ChatContextKeys.sessionType.key, provider.chatSessionType]);
    }
    // Mark history items
    overlay.push([ChatContextKeys.isArchivedItem.key, session.archived]);
    // Mark active sessions - check if session is currently open in editor or widget
    let isActiveSession = false;
    if (!session.archived && provider?.chatSessionType === localChatSessionType) {
        // Local non-history sessions are always active
        isActiveSession = true;
    }
    else if (session.archived && chatWidgetService && chatService && editorGroupsService) {
        // Check if session is open in a chat widget
        const widget = chatWidgetService.getWidgetBySessionResource(session.resource);
        if (widget) {
            isActiveSession = true;
        }
        else {
            // Check if session is open in any editor
            isActiveSession = !!findExistingChatEditorByUri(session.resource, editorGroupsService);
        }
    }
    overlay.push([ChatContextKeys.isActiveSession.key, isActiveSession]);
    return overlay;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0U2Vzc2lvbnMvY29tbW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBSWxFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUVsRSxPQUFPLEVBQThDLG9CQUFvQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFdkgsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBR3hELE1BQU0sQ0FBQyxNQUFNLDBCQUEwQixHQUFHLDRDQUE0QyxDQUFDO0FBU3ZGLE1BQU0sVUFBVSxhQUFhLENBQUMsT0FBMEIsRUFBRSxNQUFvQjtJQUM3RSxJQUFJLENBQUMsQ0FBQyxNQUFNLFlBQVksZUFBZSxDQUFDLEVBQUUsQ0FBQztRQUMxQyxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFRCxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxRQUFRLEVBQUUsTUFBTSxLQUFLLE9BQU8sQ0FBQyxzQkFBc0IsSUFBSSxNQUFNLENBQUMsUUFBUSxFQUFFLE1BQU0sS0FBSyxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUN0SyxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFRCxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDakMsT0FBTyxLQUFLLENBQUM7SUFDZCxD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