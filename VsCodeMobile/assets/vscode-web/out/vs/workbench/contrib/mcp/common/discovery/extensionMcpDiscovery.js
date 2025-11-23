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
var ExtensionMcpDiscovery_1;
import { Disposable, DisposableMap } from '../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { isFalsyOrWhitespace } from '../../../../../base/common/strings.js';
import { localize } from '../../../../../nls.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import * as extensionsRegistry from '../../../../services/extensions/common/extensionsRegistry.js';
import { mcpActivationEvent, mcpContributionPoint } from '../mcpConfiguration.js';
import { IMcpRegistry } from '../mcpRegistryTypes.js';
import { extensionPrefixedIdentifier, McpServerDefinition } from '../mcpTypes.js';
const cacheKey = 'mcp.extCachedServers';
const _mcpExtensionPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint(mcpContributionPoint);
var PersistWhen;
(function (PersistWhen) {
    PersistWhen[PersistWhen["CollectionExists"] = 0] = "CollectionExists";
    PersistWhen[PersistWhen["Always"] = 1] = "Always";
})(PersistWhen || (PersistWhen = {}));
let ExtensionMcpDiscovery = ExtensionMcpDiscovery_1 = class ExtensionMcpDiscovery extends Disposable {
    constructor(_mcpRegistry, storageService, _extensionService, _contextKeyService) {
        super();
        this._mcpRegistry = _mcpRegistry;
        this._extensionService = _extensionService;
        this._contextKeyService = _contextKeyService;
        this.fromGallery = false;
        this._extensionCollectionIdsToPersist = new Map();
        this._conditionalCollections = this._register(new DisposableMap());
        this.cachedServers = storageService.getObject(cacheKey, 1 /* StorageScope.WORKSPACE */, {});
        this._register(storageService.onWillSaveState(() => {
            let updated = false;
            for (const [collectionId, behavior] of this._extensionCollectionIdsToPersist.entries()) {
                const collection = this._mcpRegistry.collections.get().find(c => c.id === collectionId);
                let defs = collection?.serverDefinitions.get();
                if (!collection || collection.lazy) {
                    if (behavior === 1 /* PersistWhen.Always */) {
                        defs = [];
                    }
                    else {
                        continue;
                    }
                }
                if (defs) {
                    updated = true;
                    this.cachedServers[collectionId] = { servers: defs.map(McpServerDefinition.toSerialized) };
                }
            }
            if (updated) {
                storageService.store(cacheKey, this.cachedServers, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
            }
        }));
    }
    start() {
        const extensionCollections = this._register(new DisposableMap());
        this._register(_mcpExtensionPoint.setHandler((_extensions, delta) => {
            const { added, removed } = delta;
            for (const collections of removed) {
                for (const coll of collections.value) {
                    const id = extensionPrefixedIdentifier(collections.description.identifier, coll.id);
                    extensionCollections.deleteAndDispose(id);
                    this._conditionalCollections.deleteAndDispose(id);
                }
            }
            for (const collections of added) {
                if (!ExtensionMcpDiscovery_1._validate(collections)) {
                    continue;
                }
                for (const coll of collections.value) {
                    const id = extensionPrefixedIdentifier(collections.description.identifier, coll.id);
                    this._extensionCollectionIdsToPersist.set(id, 0 /* PersistWhen.CollectionExists */);
                    // Handle conditional collections with 'when' clause
                    if (coll.when) {
                        this._registerConditionalCollection(id, coll, collections, extensionCollections);
                    }
                    else {
                        // Register collection immediately if no 'when' clause
                        this._registerCollection(id, coll, collections, extensionCollections);
                    }
                }
            }
        }));
    }
    _registerCollection(id, coll, collections, extensionCollections) {
        const serverDefs = this.cachedServers.hasOwnProperty(id) ? this.cachedServers[id].servers : undefined;
        const dispo = this._mcpRegistry.registerCollection({
            id,
            label: coll.label,
            remoteAuthority: null,
            trustBehavior: 0 /* McpServerTrust.Kind.Trusted */,
            scope: 1 /* StorageScope.WORKSPACE */,
            configTarget: 2 /* ConfigurationTarget.USER */,
            serverDefinitions: observableValue(this, serverDefs?.map(McpServerDefinition.fromSerialized) || []),
            lazy: {
                isCached: !!serverDefs,
                load: () => this._activateExtensionServers(coll.id).then(() => {
                    // persist (an empty collection) in case the extension doesn't end up publishing one
                    this._extensionCollectionIdsToPersist.set(id, 1 /* PersistWhen.Always */);
                }),
                removed: () => {
                    extensionCollections.deleteAndDispose(id);
                    this._conditionalCollections.deleteAndDispose(id);
                },
            },
            source: collections.description.identifier
        });
        extensionCollections.set(id, dispo);
    }
    _registerConditionalCollection(id, coll, collections, extensionCollections) {
        const whenClause = ContextKeyExpr.deserialize(coll.when);
        if (!whenClause) {
            // Invalid when clause, treat as always false
            return;
        }
        const evaluate = () => {
            const nowSatisfied = this._contextKeyService.contextMatchesRules(whenClause);
            const isRegistered = extensionCollections.has(id);
            if (nowSatisfied && !isRegistered) {
                this._registerCollection(id, coll, collections, extensionCollections);
            }
            else if (!nowSatisfied && isRegistered) {
                extensionCollections.deleteAndDispose(id);
            }
        };
        const contextKeyListener = this._contextKeyService.onDidChangeContext(evaluate);
        evaluate();
        // Store disposable for this conditional collection
        this._conditionalCollections.set(id, contextKeyListener);
    }
    async _activateExtensionServers(collectionId) {
        await this._extensionService.activateByEvent(mcpActivationEvent(collectionId));
        await Promise.all(this._mcpRegistry.delegates.get()
            .map(r => r.waitForInitialProviderPromises()));
    }
    static _validate(user) {
        if (!Array.isArray(user.value)) {
            user.collector.error(localize('invalidData', "Expected an array of MCP collections"));
            return false;
        }
        for (const contribution of user.value) {
            if (typeof contribution.id !== 'string' || isFalsyOrWhitespace(contribution.id)) {
                user.collector.error(localize('invalidId', "Expected 'id' to be a non-empty string."));
                return false;
            }
            if (typeof contribution.label !== 'string' || isFalsyOrWhitespace(contribution.label)) {
                user.collector.error(localize('invalidLabel', "Expected 'label' to be a non-empty string."));
                return false;
            }
            if (contribution.when !== undefined && (typeof contribution.when !== 'string' || isFalsyOrWhitespace(contribution.when))) {
                user.collector.error(localize('invalidWhen', "Expected 'when' to be a non-empty string."));
                return false;
            }
        }
        return true;
    }
};
ExtensionMcpDiscovery = ExtensionMcpDiscovery_1 = __decorate([
    __param(0, IMcpRegistry),
    __param(1, IStorageService),
    __param(2, IExtensionService),
    __param(3, IContextKeyService)
], ExtensionMcpDiscovery);
export { ExtensionMcpDiscovery };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uTWNwRGlzY292ZXJ5LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL21jcC9jb21tb24vZGlzY292ZXJ5L2V4dGVuc2lvbk1jcERpc2NvdmVyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDM0UsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDNUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBRWpELE9BQU8sRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUU3RyxPQUFPLEVBQUUsZUFBZSxFQUErQixNQUFNLG1EQUFtRCxDQUFDO0FBQ2pILE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3pGLE9BQU8sS0FBSyxrQkFBa0IsTUFBTSw4REFBOEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUNsRixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdEQsT0FBTyxFQUFFLDJCQUEyQixFQUFFLG1CQUFtQixFQUFrQixNQUFNLGdCQUFnQixDQUFDO0FBR2xHLE1BQU0sUUFBUSxHQUFHLHNCQUFzQixDQUFDO0FBTXhDLE1BQU0sa0JBQWtCLEdBQUcsa0JBQWtCLENBQUMsa0JBQWtCLENBQUMsc0JBQXNCLENBQUMsb0JBQW9CLENBQUMsQ0FBQztBQUU5RyxJQUFXLFdBR1Y7QUFIRCxXQUFXLFdBQVc7SUFDckIscUVBQWdC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