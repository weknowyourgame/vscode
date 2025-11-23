/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from '../../../../../base/common/event.js';
import { ResourceMap } from '../../../../../base/common/map.js';
import { observableValue } from '../../../../../base/common/observable.js';
export class MockChatService {
    constructor() {
        this.requestInProgressObs = observableValue('name', false);
        this.edits2Enabled = false;
        this.editingSessions = [];
        this.onDidSubmitRequest = Event.None;
        this.sessions = new ResourceMap();
        this.onDidPerformUserAction = undefined;
        this.onDidDisposeSession = undefined;
    }
    isEnabled(location) {
        throw new Error('Method not implemented.');
    }
    hasSessions() {
        throw new Error('Method not implemented.');
    }
    getProviderInfos() {
        throw new Error('Method not implemented.');
    }
    startSession(location, token) {
        throw new Error('Method not implemented.');
    }
    addSession(session) {
        this.sessions.set(session.sessionResource, session);
    }
    getSession(sessionResource) {
        // eslint-disable-next-line local/code-no-dangerous-type-assertions
        return this.sessions.get(sessionResource) ?? {};
    }
    async getOrRestoreSession(sessionResource) {
        throw new Error('Method not implemented.');
    }
    getPersistedSessionTitle(sessionResource) {
        throw new Error('Method not implemented.');
    }
    loadSessionFromContent(data) {
        throw new Error('Method not implemented.');
    }
    loadSessionForResource(resource, position, token) {
        throw new Error('Method not implemented.');
    }
    getActiveSessionReference(sessionResource) {
        return undefined;
    }
    setTitle(sessionResource, title) {
        throw new Error('Method not implemented.');
    }
    appendProgress(request, progress) {
    }
    /**
     * Returns whether the request was accepted.
     */
    sendRequest(sessionResource, message) {
        throw new Error('Method not implemented.');
    }
    resendRequest(request, options) {
        throw new Error('Method not implemented.');
    }
    adoptRequest(sessionResource, request) {
        throw new Error('Method not implemented.');
    }
    removeRequest(sessionResource, requestId) {
        throw new Error('Method not implemented.');
    }
    cancelCurrentRequestForSession(sessionResource) {
        throw new Error('Method not implemented.');
    }
    forceClearSession(sessionResource) {
        throw new Error('Method not implemented.');
    }
    addCompleteRequest(sessionResource, message, variableData, attempt, response) {
        throw new Error('Method not implemented.');
    }
    async getLocalSessionHistory() {
        throw new Error('Method not implemented.');
    }
    async clearAllHistoryEntries() {
        throw new Error('Method not implemented.');
    }
    async removeHistoryEntry(resource) {
        throw new Error('Method not implemented.');
    }
    notifyUserAction(event) {
        throw new Error('Method not implemented.');
    }
    transferChatSession(transferredSessionData, toWorkspace) {
        throw new Error('Method not implemented.');
    }
    setChatSessionTitle(sessionResource, title) {
        throw new Error('Method not implemented.');
    }
    isEditingLocation(location) {
        throw new Error('Method not implemented.');
    }
    getChatStorageFolder() {
        throw new Error('Method not implemented.');
    }
    logChatIndex() {
        throw new Error('Method not implemented.');
    }
    isPersistedSessionEmpty(sessionResource) {
        throw new Error('Method not implemented.');
    }
    activateDefaultAgent(location) {
        throw new Error('Method not implemented.');
    }
    getChatSessionFromInternalUri(sessionResource) {
        throw new Error('Method not implemented.');
    }
    getLiveSessionItems() {
        throw new Error('Method not implemented.');
    }
    getHistorySessionItems() {
        throw new Error('Method not implemented.');
    }
    waitForModelDisposals() {
        throw new Error('Method not implemented.');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja0NoYXRTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvdGVzdC9jb21tb24vbW9ja0NoYXRTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBTzNFLE1BQU0sT0FBTyxlQUFlO0lBQTVCO1FBQ0MseUJBQW9CLEdBQUcsZUFBZSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN0RCxrQkFBYSxHQUFZLEtBQUssQ0FBQztRQUUvQixvQkFBZSxHQUFHLEVBQUUsQ0FBQztRQUVaLHVCQUFrQixHQUFpRCxLQUFLLENBQUMsSUFBSSxDQUFDO1FBRS9FLGFBQVEsR0FBRyxJQUFJLFdBQVcsRUFBYyxDQUFDO1FBNEV4QywyQkFBc0IsR0FBZ0MsU0FBVSxDQUFDO1FBSWpFLHdCQUFtQixHQUF1RCxTQUFVLENBQUM7SUE0Qy9GLENBQUM7SUExSEEsU0FBUyxDQUFDLFFBQTJCO1FBQ3BDLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ0QsV0FBVztRQUNWLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ0QsZ0JBQWdCO1FBQ2YsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxZQUFZLENBQUMsUUFBMkIsRUFBRSxLQUF3QjtRQUNqRSxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNELFVB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