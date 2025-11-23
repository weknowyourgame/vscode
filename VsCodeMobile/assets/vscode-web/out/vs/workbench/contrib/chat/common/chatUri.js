/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { encodeBase64, VSBuffer, decodeBase64 } from '../../../../base/common/buffer.js';
import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { localChatSessionType } from './chatSessionsService.js';
export var LocalChatSessionUri;
(function (LocalChatSessionUri) {
    LocalChatSessionUri.scheme = Schemas.vscodeLocalChatSession;
    function forSession(sessionId) {
        const encodedId = encodeBase64(VSBuffer.wrap(new TextEncoder().encode(sessionId)), false, true);
        return URI.from({ scheme: LocalChatSessionUri.scheme, authority: localChatSessionType, path: '/' + encodedId });
    }
    LocalChatSessionUri.forSession = forSession;
    function parseLocalSessionId(resource) {
        const parsed = parse(resource);
        return parsed?.chatSessionType === localChatSessionType ? parsed.sessionId : undefined;
    }
    LocalChatSessionUri.parseLocalSessionId = parseLocalSessionId;
    function parse(resource) {
        if (resource.scheme !== LocalChatSessionUri.scheme) {
            return undefined;
        }
        if (!resource.authority) {
            return undefined;
        }
        const parts = resource.path.split('/');
        if (parts.length !== 2) {
            return undefined;
        }
        const chatSessionType = resource.authority;
        const decodedSessionId = decodeBase64(parts[1]);
        return { chatSessionType, sessionId: new TextDecoder().decode(decodedSessionId.buffer) };
    }
})(LocalChatSessionUri || (LocalChatSessionUri = {}));
/**
 * Converts a chat session resource URI to a string ID.
 *
 * This exists mainly for backwards compatibility with existing code that uses string IDs in telemetry and storage.
 */
export function chatSessionResourceToId(resource) {
    // If we have a local session, prefer using just the id part
    const localId = LocalChatSessionUri.parseLocalSessionId(resource);
    if (localId) {
        return localId;
    }
    return resource.toString();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFVyaS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0VXJpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFRaEUsTUFBTSxLQUFXLG1CQUFtQixDQWdDbkM7QUFoQ0QsV0FBaUIsbUJBQW1CO0lBRXRCLDBCQUFNLEdBQUcsT0FBTyxDQUFDLHNCQUFzQixDQUFDO0lBRXJELFNBQWdCLFVBQVUsQ0FBQyxTQUFpQjtRQUMzQyxNQUFNLFNBQVMsR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLFdBQVcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNoRyxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQU4sb0JBQUEsTUFBTSxFQUFFLFNBQVMsRUFBRSxvQkFBb0IsRUFBRSxJQUFJLEVBQUUsR0FBRyxHQUFHLFNBQVMsRUFBRSxDQUFDLENBQUM7SUFDckYsQ0FBQztJQUhlLDhCQUFVLGFBR3pCLENBQUE7SUFFRCxTQUFnQixtQkFBbUIsQ0FBQyxRQUFhO1FBQ2hELE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMvQixPQUFPLE1BQU0sRUFBRSxlQUFlLEtBQUssb0JBQW9CLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUN4RixDQUFDO0lBSGUsdUNBQW1CLHNCQUdsQyxDQUFBO0lBRUQsU0FBUyxLQUFLLENBQUMsUUFBYTtRQUMzQixJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssb0JBQUEsTUFBTSxFQUFFLENBQUM7WUFDaEMsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDekIsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZDLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUN4QixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsTUFBTSxlQUFlLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQztRQUMzQyxNQUFNLGdCQUFnQixHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoRCxPQUFPLEVBQUUsZUFBZSxFQUFFLFNBQVMsRUFBRSxJQUFJLFdBQVcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO0lBQzFGLENBQUM7QUFDRixDQUFDLEVBaENnQixtQkFBbUIsS0FBbkIsbUJBQW1CLFFBZ0NuQztBQUVEOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUsdUJBQXVCLENBQUMsUUFBYTtJQUNwRCw0REFBNEQ7SUFDNUQsTUFBTSxPQUFPLEdBQUcsbUJBQW1CLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDbEUsSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUNiLE9BQU8sT0FBTyxDQUFDO0lBQ2hCLENBQUM7SUFFRCxPQUFPLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztBQUM1QixDQUFDIn0=