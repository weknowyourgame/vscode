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
var CopilotAssignmentFilterProvider_1;
import { IExtensionService } from '../../extensions/common/extensions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Emitter } from '../../../../base/common/event.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IChatEntitlementService } from '../../chat/common/chatEntitlementService.js';
export var ExtensionsFilter;
(function (ExtensionsFilter) {
    /**
     * Version of the github.copilot extension.
     */
    ExtensionsFilter["CopilotExtensionVersion"] = "X-Copilot-RelatedPluginVersion-githubcopilot";
    /**
     * Version of the github.copilot-chat extension.
     */
    ExtensionsFilter["CopilotChatExtensionVersion"] = "X-Copilot-RelatedPluginVersion-githubcopilotchat";
    /**
     * Version of the completions version.
     */
    ExtensionsFilter["CompletionsVersionInCopilotChat"] = "X-VSCode-CompletionsInChatExtensionVersion";
    /**
     * SKU of the copilot entitlement.
     */
    ExtensionsFilter["CopilotSku"] = "X-GitHub-Copilot-SKU";
    /**
     * The internal org of the user.
     */
    ExtensionsFilter["MicrosoftInternalOrg"] = "X-Microsoft-Internal-Org";
})(ExtensionsFilter || (ExtensionsFilter = {}));
var StorageVersionKeys;
(function (StorageVersionKeys) {
    StorageVersionKeys["CopilotExtensionVersion"] = "extensionsAssignmentFilterProvider.copilotExtensionVersion";
    StorageVersionKeys["CopilotChatExtensionVersion"] = "extensionsAssignmentFilterProvider.copilotChatExtensionVersion";
    StorageVersionKeys["CompletionsVersion"] = "extensionsAssignmentFilterProvider.copilotCompletionsVersion";
    StorageVersionKeys["CopilotSku"] = "extensionsAssignmentFilterProvider.copilotSku";
    StorageVersionKeys["CopilotInternalOrg"] = "extensionsAssignmentFilterProvider.copilotInternalOrg";
})(StorageVersionKeys || (StorageVersionKeys = {}));
let CopilotAssignmentFilterProvider = CopilotAssignmentFilterProvider_1 = class CopilotAssignmentFilterProvider extends Disposable {
    constructor(_extensionService, _logService, _storageService, _chatEntitlementService) {
        super();
        this._extensionService = _extensionService;
        this._logService = _logService;
        this._storageService = _storageService;
        this._chatEntitlementService = _chatEntitlementService;
        this._onDidChangeFilters = this._register(new Emitter());
        this.onDidChangeFilters = this._onDidChangeFilters.event;
        this.copilotExtensionVersion = this._storageService.get(StorageVersionKeys.CopilotExtensionVersion, 0 /* StorageScope.PROFILE */);
        this.copilotChatExtensionVersion = this._storageService.get(StorageVersionKeys.CopilotChatExtensionVersion, 0 /* StorageScope.PROFILE */);
        this.copilotCompletionsVersion = this._storageService.get(StorageVersionKeys.CompletionsVersion, 0 /* StorageScope.PROFILE */);
        this.copilotSku = this._storageService.get(StorageVersionKeys.CopilotSku, 0 /* StorageScope.PROFILE */);
        this.copilotInternalOrg = this._storageService.get(StorageVersionKeys.CopilotInternalOrg, 0 /* StorageScope.PROFILE */);
        this._register(this._extensionService.onDidChangeExtensionsStatus(extensionIdentifiers => {
            if (extensionIdentifiers.some(identifier => ExtensionIdentifier.equals(identifier, 'github.copilot') || ExtensionIdentifier.equals(identifier, 'github.copilot-chat'))) {
                this.updateExtensionVersions();
            }
        }));
        this._register(this._chatEntitlementService.onDidChangeEntitlement(() => {
            this.updateCopilotEntitlementInfo();
        }));
        this.updateExtensionVersions();
        this.updateCopilotEntitlementInfo();
    }
    async updateExtensionVersions() {
        let copilotExtensionVersion;
        let copilotChatExtensionVersion;
        let copilotCompletionsVersion;
        try {
            const [copilotExtension, copilotChatExtension] = await Promise.all([
                this._extensionService.getExtension('github.copilot'),
                this._extensionService.getExtension('github.copilot-chat'),
            ]);
            copilotExtensionVersion = copilotExtension?.version;
            copilotChatExtensionVersion = copilotChatExtension?.version;
            copilotCompletionsVersion = copilotChatExtension?.completionsCoreVersion;
        }
        catch (error) {
            this._logService.error('Failed to update extension version assignments', error);
        }
        if (this.copilotCompletionsVersion === copilotCompletionsVersion &&
            this.copilotExtensionVersion === copilotExtensionVersion &&
            this.copilotChatExtensionVersion === copilotChatExtensionVersion) {
            return;
        }
        this.copilotExtensionVersion = copilotExtensionVersion;
        this.copilotChatExtensionVersion = copilotChatExtensionVersion;
        this.copilotCompletionsVersion = copilotCompletionsVersion;
        this._storageService.store(StorageVersionKeys.CopilotExtensionVersion, this.copilotExtensionVersion, 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        this._storageService.store(StorageVersionKeys.CopilotChatExtensionVersion, this.copilotChatExtensionVersion, 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        this._storageService.store(StorageVersionKeys.CompletionsVersion, this.copilotCompletionsVersion, 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        // Notify that the filters have changed.
        this._onDidChangeFilters.fire();
    }
    updateCopilotEntitlementInfo() {
        const newSku = this._chatEntitlementService.sku;
        const newIsGitHubInternal = this._chatEntitlementService.organisations?.includes('github');
        const newIsMicrosoftInternal = this._chatEntitlementService.organisations?.includes('microsoft') || this._chatEntitlementService.organisations?.includes('ms-copilot') || this._chatEntitlementService.organisations?.includes('MicrosoftCopilot');
        const newInternalOrg = newIsGitHubInternal ? 'github' : newIsMicrosoftInternal ? 'microsoft' : undefined;
        if (this.copilotSku === newSku && this.copilotInternalOrg === newInternalOrg) {
            return;
        }
        this.copilotSku = newSku;
        this.copilotInternalOrg = newInternalOrg;
        this._storageService.store(StorageVersionKeys.CopilotSku, this.copilotSku, 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        this._storageService.store(StorageVersionKeys.CopilotInternalOrg, this.copilotInternalOrg, 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        // Notify that the filters have changed.
        this._onDidChangeFilters.fire();
    }
    /**
     * Returns a version string that can be parsed by the TAS client.
     * The tas client cannot handle suffixes lke "-insider"
     * Ref: https://github.com/microsoft/tas-client/blob/30340d5e1da37c2789049fcf45928b954680606f/vscode-tas-client/src/vscode-tas-client/VSCodeFilterProvider.ts#L35
     *
     * @param version Version string to be trimmed.
    */
    static trimVersionSuffix(version) {
        const regex = /\-[a-zA-Z0-9]+$/;
        const result = version.split(regex);
        return result[0];
    }
    getFilterValue(filter) {
        switch (filter) {
            case ExtensionsFilter.CopilotExtensionVersion:
                return this.copilotExtensionVersion ? CopilotAssignmentFilterProvider_1.trimVersionSuffix(this.copilotExtensionVersion) : null;
            case ExtensionsFilter.CompletionsVersionInCopilotChat:
                return this.copilotCompletionsVersion ? CopilotAssignmentFilterProvider_1.trimVersionSuffix(this.copilotCompletionsVersion) : null;
            case ExtensionsFilter.CopilotChatExtensionVersion:
                return this.copilotChatExtensionVersion ? CopilotAssignmentFilterProvider_1.trimVersionSuffix(this.copilotChatExtensionVersion) : null;
            case ExtensionsFilter.CopilotSku:
                return this.copilotSku ?? null;
            case ExtensionsFilter.MicrosoftInternalOrg:
                return this.copilotInternalOrg ?? null;
            default:
                return null;
        }
    }
    getFilters() {
        const filters = new Map();
        const filterValues = Object.values(ExtensionsFilter);
        for (const value of filterValues) {
            filters.set(value, this.getFilterValue(value));
        }
        return filters;
    }
};
CopilotAssignmentFilterProvider = CopilotAssignmentFilterProvider_1 = __decorate([
    __param(0, IExtensionService),
    __param(1, ILogService),
    __param(2, IStorageService),
    __param(3, IChatEntitlementService)
], CopilotAssignmentFilterProvider);
export { CopilotAssignmentFilterProvider };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzaWdubWVudEZpbHRlcnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL2Fzc2lnbm1lbnQvY29tbW9uL2Fzc2lnbm1lbnRGaWx0ZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDM0YsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsZUFBZSxFQUErQixNQUFNLGdEQUFnRCxDQUFDO0FBQzlHLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRXRGLE1BQU0sQ0FBTixJQUFZLGdCQTBCWDtBQTFCRCxXQUFZLGdCQUFnQjtJQUUzQjs7T0FFRztJQUNILDRGQUF3RSxDQUFBO0lBRXhFOztPQUVHO0lBQ0gsb0dBQWdGLENBQUE7SUFFaEY7O09BRUc7SUFDSCxrR0FBOEUsQ0FBQTtJQUU5RTs7T0FFRztJQUNILHVEQUFtQyxDQUFBO0lBRW5DOztPQUVHO0lBQ0gscUVBQWlELENBQUE7QUFDbEQsQ0FBQyxFQTFCVyxnQkFBZ0IsS0FBaEIsZ0JBQWdCLFFBMEIzQjtBQUVELElBQUssa0JBTUo7QUFORCxXQUFLLGtCQUFrQjtJQUN0Qiw0R0FBc0YsQ0FBQTtJQUN0RixvSEFBOEYsQ0FBQTtJQUM5Rix5R0FBbUYsQ0FBQTtJQUNuRixrRkFBNEQsQ0FBQTtJQUM1RCxrR0FBNEUsQ0FBQTtBQUM3RSxDQUFDLEVBTkksa0JBQWtC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