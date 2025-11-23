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
var QuickDiffService_1;
import { Disposable } from '../../../../base/common/lifecycle.js';
import { isEqualOrParent } from '../../../../base/common/resources.js';
import { score } from '../../../../editor/common/languageSelector.js';
import { Emitter } from '../../../../base/common/event.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
function createProviderComparer(uri) {
    return (a, b) => {
        if (a.rootUri && !b.rootUri) {
            return -1;
        }
        else if (!a.rootUri && b.rootUri) {
            return 1;
        }
        else if (!a.rootUri && !b.rootUri) {
            return 0;
        }
        const aIsParent = isEqualOrParent(uri, a.rootUri);
        const bIsParent = isEqualOrParent(uri, b.rootUri);
        if (aIsParent && bIsParent) {
            return providerComparer(a, b);
        }
        else if (aIsParent) {
            return -1;
        }
        else if (bIsParent) {
            return 1;
        }
        else {
            return 0;
        }
    };
}
function providerComparer(a, b) {
    if (a.kind === 'primary') {
        return -1;
    }
    else if (b.kind === 'primary') {
        return 1;
    }
    else if (a.kind === 'secondary') {
        return -1;
    }
    else if (b.kind === 'secondary') {
        return 1;
    }
    return 0;
}
let QuickDiffService = class QuickDiffService extends Disposable {
    static { QuickDiffService_1 = this; }
    static { this.STORAGE_KEY = 'workbench.scm.quickDiffProviders.hidden'; }
    get providers() {
        return Array.from(this.quickDiffProviders).sort(providerComparer);
    }
    constructor(storageService, uriIdentityService) {
        super();
        this.storageService = storageService;
        this.uriIdentityService = uriIdentityService;
        this.quickDiffProviders = new Set();
        this._onDidChangeQuickDiffProviders = this._register(new Emitter());
        this.onDidChangeQuickDiffProviders = this._onDidChangeQuickDiffProviders.event;
        this.hiddenQuickDiffProviders = new Set();
        this.loadState();
    }
    addQuickDiffProvider(quickDiff) {
        this.quickDiffProviders.add(quickDiff);
        this._onDidChangeQuickDiffProviders.fire();
        return {
            dispose: () => {
                this.quickDiffProviders.delete(quickDiff);
                this._onDidChangeQuickDiffProviders.fire();
            }
        };
    }
    async getQuickDiffs(uri, language = '', isSynchronized = false) {
        const providers = Array.from(this.quickDiffProviders)
            .filter(provider => !provider.rootUri || this.uriIdentityService.extUri.isEqualOrParent(uri, provider.rootUri))
            .sort(createProviderComparer(uri));
        const quickDiffOriginalResources = await Promise.allSettled(providers.map(async (provider) => {
            const scoreValue = provider.selector ? score(provider.selector, uri, language, isSynchronized, undefined, undefined) : 10;
            const originalResource = scoreValue > 0 ? await provider.getOriginalResource(uri) ?? undefined : undefined;
            return { provider, originalResource };
        }));
        const quickDiffs = [];
        for (const quickDiffOriginalResource of quickDiffOriginalResources) {
            if (quickDiffOriginalResource.status === 'rejected') {
                continue;
            }
            const { provider, originalResource } = quickDiffOriginalResource.value;
            if (!originalResource) {
                continue;
            }
            quickDiffs.push({
                id: provider.id,
                label: provider.label,
                kind: provider.kind,
                originalResource,
            });
        }
        return quickDiffs;
    }
    toggleQuickDiffProviderVisibility(id) {
        if (this.isQuickDiffProviderVisible(id)) {
            this.hiddenQuickDiffProviders.add(id);
        }
        else {
            this.hiddenQuickDiffProviders.delete(id);
        }
        this.saveState();
        this._onDidChangeQuickDiffProviders.fire();
    }
    isQuickDiffProviderVisible(id) {
        return !this.hiddenQuickDiffProviders.has(id);
    }
    loadState() {
        const raw = this.storageService.get(QuickDiffService_1.STORAGE_KEY, 0 /* StorageScope.PROFILE */);
        if (raw) {
            try {
                this.hiddenQuickDiffProviders = new Set(JSON.parse(raw));
            }
            catch { }
        }
    }
    saveState() {
        if (this.hiddenQuickDiffProviders.size === 0) {
            this.storageService.remove(QuickDiffService_1.STORAGE_KEY, 0 /* StorageScope.PROFILE */);
        }
        else {
            this.storageService.store(QuickDiffService_1.STORAGE_KEY, JSON.stringify(Array.from(this.hiddenQuickDiffProviders)), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        }
    }
};
QuickDiffService = QuickDiffService_1 = __decorate([
    __param(0, IStorageService),
    __param(1, IUriIdentityService)
], QuickDiffService);
export { QuickDiffService };
export async function getOriginalResource(quickDiffService, uri, language, isSynchronized) {
    const quickDiffs = await quickDiffService.getQuickDiffs(uri, language, isSynchronized);
    return quickDiffs.length > 0 ? quickDiffs[0].originalResource : null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVpY2tEaWZmU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9zY20vY29tbW9uL3F1aWNrRGlmZlNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSxzQ0FBc0MsQ0FBQztBQUUvRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdkUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUM3RixPQUFPLEVBQUUsZUFBZSxFQUErQixNQUFNLGdEQUFnRCxDQUFDO0FBRTlHLFNBQVMsc0JBQXNCLENBQUMsR0FBUTtJQUN2QyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQ2YsSUFBSSxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQzdCLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDWCxDQUFDO2FBQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3BDLE9BQU8sQ0FBQyxDQUFDO1FBQ1YsQ0FBQzthQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3JDLE9BQU8sQ0FBQyxDQUFDO1FBQ1YsQ0FBQztRQUVELE1BQU0sU0FBUyxHQUFHLGVBQWUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLE9BQVEsQ0FBQyxDQUFDO1FBQ25ELE1BQU0sU0FBUyxHQUFH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