/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../../base/common/event.js';
import { ResourceMap } from '../../../../../base/common/map.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
export class MockChatSessionsService {
    constructor() {
        this._onDidChangeItemsProviders = new Emitter();
        this.onDidChangeItemsProviders = this._onDidChangeItemsProviders.event;
        this._onDidChangeSessionItems = new Emitter();
        this.onDidChangeSessionItems = this._onDidChangeSessionItems.event;
        this._onDidChangeAvailability = new Emitter();
        this.onDidChangeAvailability = this._onDidChangeAvailability.event;
        this._onDidChangeInProgress = new Emitter();
        this.onDidChangeInProgress = this._onDidChangeInProgress.event;
        this._onDidChangeContentProviderSchemes = new Emitter();
        this.onDidChangeContentProviderSchemes = this._onDidChangeContentProviderSchemes.event;
        this.sessionItemProviders = new Map();
        this.contentProviders = new Map();
        this.contributions = [];
        this.optionGroups = new Map();
        this.sessionOptions = new ResourceMap();
        this.editableData = new ResourceMap();
        this.inProgress = new Map();
    }
    // For testing: allow triggering events
    fireDidChangeItemsProviders(provider) {
        this._onDidChangeItemsProviders.fire(provider);
    }
    fireDidChangeSessionItems(chatSessionType) {
        this._onDidChangeSessionItems.fire(chatSessionType);
    }
    fireDidChangeAvailability() {
        this._onDidChangeAvailability.fire();
    }
    fireDidChangeInProgress() {
        this._onDidChangeInProgress.fire();
    }
    registerChatSessionItemProvider(provider) {
        this.sessionItemProviders.set(provider.chatSessionType, provider);
        return {
            dispose: () => {
                this.sessionItemProviders.delete(provider.chatSessionType);
            }
        };
    }
    getAllChatSessionContributions() {
        return this.contributions;
    }
    setContributions(contributions) {
        this.contributions = contributions;
    }
    async activateChatSessionItemProvider(chatSessionType) {
        return this.sessionItemProviders.get(chatSessionType);
    }
    getAllChatSessionItemProviders() {
        return Array.from(this.sessionItemProviders.values());
    }
    getIconForSessionType(chatSessionType) {
        const contribution = this.contributions.find(c => c.type === chatSessionType);
        return contribution?.icon && typeof contribution.icon === 'string' ? ThemeIcon.fromId(contribution.icon) : undefined;
    }
    getWelcomeTitleForSessionType(chatSessionType) {
        return this.contributions.find(c => c.type === chatSessionType)?.welcomeTitle;
    }
    getWelcomeMessageForSessionType(chatSessionType) {
        return this.contributions.find(c => c.type === chatSessionType)?.welcomeMessage;
    }
    getInputPlaceholderForSessionType(chatSessionType) {
        return this.contributions.find(c => c.type === chatSessionType)?.inputPlaceholder;
    }
    async getNewChatSessionItem(chatSessionType, options, token) {
        const provider = this.sessionItemProviders.get(chatSessionType);
        if (!provider?.provideNewChatSessionItem) {
            throw new Error(`No provider for ${chatSessionType}`);
        }
        return provider.provideNewChatSessionItem(options, token);
    }
    getAllChatSessionItems(token) {
        return Promise.all(Array.from(this.sessionItemProviders.values(), async (provider) => {
            return {
                chatSessionType: provider.chatSessionType,
                items: await provider.provideChatSessionItems(token),
            };
        }));
    }
    reportInProgress(chatSessionType, count) {
        this.inProgress.set(chatSessionType, count);
        this._onDidChangeInProgress.fire();
    }
    getInProgress() {
        return Array.from(this.inProgress.entries()).map(([displayName, count]) => ({ displayName, count }));
    }
    registerChatSessionContentProvider(chatSessionType, provider) {
        this.contentProviders.set(chatSessionType, provider);
        this._onDidChangeContentProviderSchemes.fire({ added: [chatSessionType], removed: [] });
        return {
            dispose: () => {
                this.contentProviders.delete(chatSessionType);
            }
        };
    }
    async canResolveContentProvider(chatSessionType) {
        return this.contentProviders.has(chatSessionType);
    }
    async getOrCreateChatSession(sessionResource, token) {
        const provider = this.contentProviders.get(sessionResource.scheme);
        if (!provider) {
            throw new Error(`No content provider for ${sessionResource.scheme}`);
        }
        return provider.provideChatSessionContent(sessionResource, token);
    }
    async canResolveChatSession(chatSessionResource) {
        return this.contentProviders.has(chatSessionResource.scheme);
    }
    getOptionGroupsForSessionType(chatSessionType) {
        return this.optionGroups.get(chatSessionType);
    }
    setOptionGroupsForSessionType(chatSessionType, handle, optionGroups) {
        if (optionGroups) {
            this.optionGroups.set(chatSessionType, optionGroups);
        }
        else {
            this.optionGroups.delete(chatSessionType);
        }
    }
    setOptionsChangeCallback(callback) {
        this.optionsChangeCallback = callback;
    }
    async notifySessionOptionsChange(sessionResource, updates) {
        await this.optionsChangeCallback?.(sessionResource, updates);
    }
    async setEditableSession(sessionResource, data) {
        if (data) {
            this.editableData.set(sessionResource, data);
        }
        else {
            this.editableData.delete(sessionResource);
        }
    }
    getEditableData(sessionResource) {
        return this.editableData.get(sessionResource);
    }
    isEditable(sessionResource) {
        return this.editableData.has(sessionResource);
    }
    notifySessionItemsChanged(chatSessionType) {
        this._onDidChangeSessionItems.fire(chatSessionType);
    }
    getSessionOption(sessionResource, optionId) {
        return this.sessionOptions.get(sessionResource)?.get(optionId);
    }
    setSessionOption(sessionResource, optionId, value) {
        if (!this.sessionOptions.has(sessionResource)) {
            this.sessionOptions.set(sessionResource, new Map());
        }
        this.sessionOptions.get(sessionResource).set(optionId, value);
        return true;
    }
    hasAnySessionOptions(resource) {
        return this.sessionOptions.has(resource) && this.sessionOptions.get(resource).size > 0;
    }
    getCapabilitiesForSessionType(chatSessionType) {
        return this.contributions.find(c => c.type === chatSessionType)?.capabilities;
    }
    getContentProviderSchemes() {
        return Array.from(this.contentProviders.keys());
    }
    registerModelProgressListener(model, callback) {
        throw new Error('Method not implemented.');
    }
    getSessionDescription(chatModel) {
        throw new Error('Method not implemented.');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja0NoYXRTZXNzaW9uc1NlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2NvbW1vbi9tb2NrQ2hhdFNlc3Npb25zU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFOUQsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQU9wRSxNQUFNLE9BQU8sdUJBQXVCO0lBQXBDO1FBR2tCLCtCQUEwQixHQUFHLElBQUksT0FBTyxFQUE0QixDQUFDO1FBQzdFLDhCQUF5QixHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLENBQUM7UUFFMUQsNkJBQXdCLEdBQUcsSUFBSSxPQUFPLEVBQVUsQ0FBQztRQUN6RCw0QkFBdUIsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsS0FBSyxDQUFDO1FBRXRELDZCQUF3QixHQUFHLElBQUksT0FBTyxFQUFRLENBQUM7UUFDdkQsNEJBQXVCLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQztRQUV0RCwyQkFBc0IsR0FBRyxJQUFJLE9BQU8sRUFBUSxDQUFDO1FBQ3JELDBCQUFxQixHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUM7UUFFbEQsdUNBQWtDLEdBQUcsSUFBSSxPQUFPLEVBQTRELENBQUM7UUFDckgsc0NBQWlDLEdBQUcsSUFBSSxDQUFDLGtDQUFrQyxDQUFDLEtBQUssQ0FBQztRQUVuRix5QkFBb0IsR0FBRyxJQUFJLEdBQUcsRUFBb0MsQ0FBQztRQUNuRSxxQkFBZ0IsR0FBRyxJQUFJLEdBQUcsRUFBdUMsQ0FBQztRQUNsRSxrQkFB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