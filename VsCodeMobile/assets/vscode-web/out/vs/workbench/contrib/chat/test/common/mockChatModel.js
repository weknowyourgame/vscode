/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { ChatAgentLocation } from '../../common/constants.js';
export class MockChatModel extends Disposable {
    constructor(sessionResource) {
        super();
        this.sessionResource = sessionResource;
        this.onDidDispose = this._register(new Emitter()).event;
        this.onDidChange = this._register(new Emitter()).event;
        this.sessionId = '';
        this.timestamp = 0;
        this.initialLocation = ChatAgentLocation.Chat;
        this.title = '';
        this.hasCustomTitle = false;
        this.requestInProgress = observableValue('requestInProgress', false);
        this.requestNeedsInput = observableValue('requestNeedsInput', false);
        this.inputPlaceholder = undefined;
        this.editingSession = undefined;
        this.checkpoint = undefined;
        this.inputModel = {
            state: observableValue('inputModelState', undefined),
            setState: () => { },
            clearState: () => { }
        };
        this.contributedChatSession = undefined;
        this.isDisposed = false;
    }
    dispose() {
        this.isDisposed = true;
        super.dispose();
    }
    startEditingSession(isGlobalEditingSession, transferFromSession) { }
    getRequests() { return []; }
    setCheckpoint(requestId) { }
    toExport() {
        return {
            initialLocation: this.initialLocation,
            requests: [],
            responderUsername: '',
            responderAvatarIconUri: undefined
        };
    }
    toJSON() {
        return {
            version: 3,
            sessionId: this.sessionId,
            creationDate: this.timestamp,
            isImported: false,
            lastMessageDate: this.timestamp,
            customTitle: undefined,
            initialLocation: this.initialLocation,
            requests: [],
            responderUsername: '',
            responderAvatarIconUri: undefined
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja0NoYXRNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL21vY2tDaGF0TW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFJM0UsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFFOUQsTUFBTSxPQUFPLGFBQWMsU0FBUSxVQUFVO0lBcUI1QyxZQUFxQixlQUFvQjtRQUN4QyxLQUFLLEVBQUUsQ0FBQztRQURZLG9CQUFlLEdBQWYsZUFBZSxDQUFLO1FBcEJoQyxpQkFBWSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVEsQ0FBQyxDQUFDLEtBQUssQ0FBQztRQUN6RCxnQkFBVyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQW9CLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFDcEUsY0FBUyxHQUFHLEVBQUUsQ0FBQztRQUNmLGNBQVMsR0FBRyxDQUFDLENBQUM7UUFDZCxvQkFBZSxHQUFHLGlCQUFpQixDQUFDLElBQUksQ0FBQztRQUN6QyxVQUFLLEdBQUcsRUFBRSxDQUFDO1FBQ1gsbUJBQWMsR0FBRyxLQUFLLENBQUM7UUFDdkIsc0JBQWlCLEdBQUcsZUFBZSxDQUFDLG1CQUFtQixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2hFLHNCQUFpQixHQUFHLGVBQWUsQ0FBQyxtQkFBbUIsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNoRSxxQkFBZ0IsR0FBRyxTQUFTLENBQUM7UUFDN0IsbUJBQWMsR0FBRyxTQUFTLENBQUM7UUFDM0IsZUFBVSxHQUFHLFNBQVMsQ0FBQztRQUN2QixlQUFVLEdBQWdCO1lBQ2xDLEtBQUssRUFBRSxlQUFlLENBQUMsaUJBQWlCLEVBQUUsU0FBUyxDQUFDO1lBQ3BELFFBQVEsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO1lBQ25CLFVBQVUsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO1NBQ3JCLENBQUM7UUFDTywyQkFBc0IsR0FBRyxTQUFTLENBQUM7UUFDNUMsZUFBVSxHQUFHLEtBQUssQ0FBQztJQUluQixDQUFDO0lBRVEsT0FBTztRQUNmLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO1FBQ3ZCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNqQixDQUFDO0lBRUQsbUJBQW1CLENBQUMsc0JBQWdDLEVBQUUsbUJBQXlDLElBQVUsQ0FBQztJQUMxRyxXQUFXLEtBQTBCLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNqRCxhQUFhLENBQUMsU0FBNkIsSUFBVSxDQUFDO0lBQ3RELFFBQVE7UUFDUCxPQUFPO1lBQ04sZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFlO1lBQ3JDLFFBQVEsRUFBRSxFQUFFO1lBQ1osaUJBQWlCLEVBQUUsRUFBRTtZQUNyQixzQkFBc0IsRUFBRSxTQUFTO1NBQ2pDLENBQUM7SUFDSCxDQUFDO0lBQ0QsTUFBTTtRQUNMLE9BQU87WUFDTixPQUFPLEVBQUUsQ0FBQztZQUNWLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUztZQUN6QixZQUFZLEVBQUUsSUFBSSxDQUFDLFNBQVM7WUFDNUIsVUFBVSxFQUFFLEtBQUs7WUFDakIsZUFBZSxFQUFFLElBQUksQ0FBQyxTQUFTO1lBQy9CLFdBQVcsRUFBRSxTQUFTO1lBQ3RCLGVBQWUsRUFBRSxJQUFJLENBQUMsZUFBZTtZQUNyQyxRQUFRLEVBQUUsRUFBRTtZQUNaLGlCQUFpQixFQUFFLEVBQUU7WUFDckIsc0JBQXNCLEVBQUUsU0FBUztTQUNqQyxDQUFDO0lBQ0gsQ0FBQztDQUNEIn0=