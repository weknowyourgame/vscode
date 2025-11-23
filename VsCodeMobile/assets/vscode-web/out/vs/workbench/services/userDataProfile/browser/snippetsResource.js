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
import { VSBuffer } from '../../../../base/common/buffer.js';
import { ResourceSet } from '../../../../base/common/map.js';
import { localize } from '../../../../nls.js';
import { FileOperationError, IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { API_OPEN_EDITOR_COMMAND_ID } from '../../../browser/parts/editor/editorCommands.js';
import { TreeItemCollapsibleState } from '../../../common/views.js';
import { IUserDataProfileService } from '../common/userDataProfile.js';
let SnippetsResourceInitializer = class SnippetsResourceInitializer {
    constructor(userDataProfileService, fileService, uriIdentityService) {
        this.userDataProfileService = userDataProfileService;
        this.fileService = fileService;
        this.uriIdentityService = uriIdentityService;
    }
    async initialize(content) {
        const snippetsContent = JSON.parse(content);
        for (const key in snippetsContent.snippets) {
            const resource = this.uriIdentityService.extUri.joinPath(this.userDataProfileService.currentProfile.snippetsHome, key);
            await this.fileService.writeFile(resource, VSBuffer.fromString(snippetsContent.snippets[key]));
        }
    }
};
SnippetsResourceInitializer = __decorate([
    __param(0, IUserDataProfileService),
    __param(1, IFileService),
    __param(2, IUriIdentityService)
], SnippetsResourceInitializer);
export { SnippetsResourceInitializer };
let SnippetsResource = class SnippetsResource {
    constructor(fileService, uriIdentityService) {
        this.fileService = fileService;
        this.uriIdentityService = uriIdentityService;
    }
    async getContent(profile, excluded) {
        const snippets = await this.getSnippets(profile, excluded);
        return JSON.stringify({ snippets });
    }
    async apply(content, profile) {
        const snippetsContent = JSON.parse(content);
        for (const key in snippetsContent.snippets) {
            const resource = this.uriIdentityService.extUri.joinPath(profile.snippetsHome, key);
            await this.fileService.writeFile(resource, VSBuffer.fromString(snippetsContent.snippets[key]));
        }
    }
    async getSnippets(profile, excluded) {
        const snippets = {};
        const snippetsResources = await this.getSnippetsResources(profile, excluded);
        for (const resource of snippetsResources) {
            const key = this.uriIdentityService.extUri.relativePath(profile.snippetsHome, resource);
            const content = await this.fileService.readFile(resource);
            snippets[key] = content.value.toString();
        }
        return snippets;
    }
    async getSnippetsResources(profile, excluded) {
        const snippets = [];
        let stat;
        try {
            stat = await this.fileService.resolve(profile.snippetsHome);
        }
        catch (e) {
            // No snippets
            if (e instanceof FileOperationError && e.fileOperationResult === 1 /* FileOperationResult.FILE_NOT_FOUND */) {
                return snippets;
            }
            else {
                throw e;
            }
        }
        for (const { resource } of stat.children || []) {
            if (excluded?.has(resource)) {
                continue;
            }
            const extension = this.uriIdentityService.extUri.extname(resource);
            if (extension === '.json' || extension === '.code-snippets') {
                snippets.push(resource);
            }
        }
        return snippets;
    }
};
SnippetsResource = __decorate([
    __param(0, IFileService),
    __param(1, IUriIdentityService)
], SnippetsResource);
export { SnippetsResource };
let SnippetsResourceTreeItem = class SnippetsResourceTreeItem {
    constructor(profile, instantiationService, uriIdentityService) {
        this.profile = profile;
        this.instantiationService = instantiationService;
        this.uriIdentityService = uriIdentityService;
        this.type = "snippets" /* ProfileResourceType.Snippets */;
        this.label = { label: localize('snippets', "Snippets") };
        this.collapsibleState = TreeItemCollapsibleState.Collapsed;
        this.excludedSnippets = new ResourceSet();
        this.handle = this.profile.snippetsHome.toString();
    }
    async getChildren() {
        const snippetsResources = await this.instantiationService.createInstance(SnippetsResource).getSnippetsResources(this.profile);
        const that = this;
        return snippetsResources.map(resource => ({
            handle: resource.toString(),
            parent: that,
            resourceUri: resource,
            collapsibleState: TreeItemCollapsibleState.None,
            accessibilityInformation: {
                label: this.uriIdentityService.extUri.basename(resource),
            },
            checkbox: that.checkbox ? {
                get isChecked() { return !that.excludedSnippets.has(resource); },
                set isChecked(value) {
                    if (value) {
                        that.excludedSnippets.delete(resource);
                    }
                    else {
                        that.excludedSnippets.add(resource);
                    }
                },
                accessibilityInformation: {
                    label: localize('exclude', "Select Snippet {0}", this.uriIdentityService.extUri.basename(resource)),
                }
            } : undefined,
            command: {
                id: API_OPEN_EDITOR_COMMAND_ID,
                title: '',
                arguments: [resource, undefined, undefined]
            }
        }));
    }
    async hasContent() {
        const snippetsResources = await this.instantiationService.createInstance(SnippetsResource).getSnippetsResources(this.profile);
        return snippetsResources.length > 0;
    }
    async getContent() {
        return this.instantiationService.createInstance(SnippetsResource).getContent(this.profile, this.excludedSnippets);
    }
    isFromDefaultProfile() {
        return !this.profile.isDefault && !!this.profile.useDefaultFlags?.snippets;
    }
};
SnippetsResourceTreeItem = __decorate([
    __param(1, IInstantiationService),
    __param(2, IUriIdentityService)
], SnippetsResourceTreeItem);
export { SnippetsResourceTreeItem };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic25pcHBldHNSZXNvdXJjZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2Jyb3dzZXIvc25pcHBldHNSZXNvdXJjZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFN0QsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRTdELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsa0JBQWtCLEVBQXVCLFlBQVksRUFBYSxNQUFNLDRDQUE0QyxDQUFDO0FBQzlILE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBRTdGLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQzdGLE9BQU8sRUFBMEIsd0JBQXdCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUM1RixPQUFPLEVBQTBHLHVCQUF1QixFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFNeEssSUFBTSwyQkFBMkIsR0FBakMsTUFBTSwyQkFBMkI7SUFFdkMsWUFDMkMsc0JBQStDLEVBQzFELFdBQXlCLEVBQ2xCLGtCQUF1QztRQUZuQywyQkFBc0IsR0FBdEIsc0JBQXNCLENBQXlCO1FBQzFELGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBQ2xCLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBcUI7SUFFOUUsQ0FBQztJQUVELEtBQUssQ0FBQyxVQUFVLENBQUMsT0FBZTtRQUMvQixNQUFNLGVBQWUsR0FBcUIsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM5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