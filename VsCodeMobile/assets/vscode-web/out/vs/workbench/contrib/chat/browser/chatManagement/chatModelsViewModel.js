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
var ChatModelsViewModel_1;
import { distinct, coalesce } from '../../../../../base/common/arrays.js';
import { or, matchesCamelCase, matchesWords, matchesBaseContiguousSubString } from '../../../../../base/common/filters.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ILanguageModelsService } from '../../../chat/common/languageModels.js';
import { IChatEntitlementService } from '../../../../services/chat/common/chatEntitlementService.js';
import { localize } from '../../../../../nls.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
export const MODEL_ENTRY_TEMPLATE_ID = 'model.entry.template';
export const VENDOR_ENTRY_TEMPLATE_ID = 'vendor.entry.template';
export const GROUP_ENTRY_TEMPLATE_ID = 'group.entry.template';
const wordFilter = or(matchesBaseContiguousSubString, matchesWords);
const CAPABILITY_REGEX = /@capability:\s*([^\s]+)/gi;
const VISIBLE_REGEX = /@visible:\s*(true|false)/i;
const PROVIDER_REGEX = /@provider:\s*((".+?")|([^\s]+))/gi;
export const SEARCH_SUGGESTIONS = {
    FILTER_TYPES: [
        '@provider:',
        '@capability:',
        '@visible:'
    ],
    CAPABILITIES: [
        '@capability:tools',
        '@capability:vision',
        '@capability:agent'
    ],
    VISIBILITY: [
        '@visible:true',
        '@visible:false'
    ]
};
export function isVendorEntry(entry) {
    return entry.type === 'vendor';
}
export function isGroupEntry(entry) {
    return entry.type === 'group';
}
export var ChatModelGroup;
(function (ChatModelGroup) {
    ChatModelGroup["Vendor"] = "vendor";
    ChatModelGroup["Visibility"] = "visibility";
})(ChatModelGroup || (ChatModelGroup = {}));
let ChatModelsViewModel = ChatModelsViewModel_1 = class ChatModelsViewModel extends Disposable {
    get groupBy() { return this._groupBy; }
    set groupBy(groupBy) {
        if (this._groupBy !== groupBy) {
            this._groupBy = groupBy;
            this.collapsedGroups.clear();
            this.modelEntries = this.sortModels(this.modelEntries);
            this.filter(this.searchValue);
            this._onDidChangeGrouping.fire(groupBy);
        }
    }
    constructor(languageModelsService, chatEntitlementService) {
        super();
        this.languageModelsService = languageModelsService;
        this.chatEntitlementService = chatEntitlementService;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._onDidChangeGrouping = this._register(new Emitter());
        this.onDidChangeGrouping = this._onDidChangeGrouping.event;
        this.collapsedGroups = new Set();
        this.searchValue = '';
        this.modelsSorted = false;
        this._groupBy = "vendor" /* ChatModelGroup.Vendor */;
        this._viewModelEntries = [];
        this.modelEntries = [];
        this._register(this.chatEntitlementService.onDidChangeEntitlement(() => this.refresh()));
    }
    get viewModelEntries() {
        return this._viewModelEntries;
    }
    splice(at, removed, added) {
        this._viewModelEntries.splice(at, removed, ...added);
        if (this.selectedEntry) {
            this.selectedEntry = this._viewModelEntries.find(entry => entry.id === this.selectedEntry?.id);
        }
        this._onDidChange.fire({ at, removed, added });
    }
    shouldRefilter() {
        return !this.modelsSorted;
    }
    filter(searchValue) {
        this.searchValue = searchValue;
        if (!this.modelsSorted) {
            this.modelEntries = this.sortModels(this.modelEntries);
        }
        const filtered = this.filterModels(this.modelEntries, searchValue);
        this.splice(0, this._viewModelEntries.length, filtered);
        return this.viewModelEntries;
    }
    filterModels(modelEntries, searchValue) {
        let visible;
        const visibleMatches = VISIBLE_REGEX.exec(searchValue);
        if (visibleMatches && visibleMatches[1]) {
            visible = visibleMatches[1].toLowerCase() === 'true';
            searchValue = searchValue.replace(VISIBLE_REGEX, '');
        }
        const providerNames = [];
        let providerMatch;
        PROVIDER_REGEX.lastIndex = 0;
        while ((providerMatch = PROVIDER_REGEX.exec(searchValue)) !== null) {
            const providerName = providerMatch[2] ? providerMatch[2].substring(1, providerMatch[2].length - 1) : providerMatch[3];
            providerNames.push(providerName);
        }
        if (providerNames.length > 0) {
            searchValue = searchValue.replace(PROVIDER_REGEX, '');
        }
        const capabilities = [];
        let capabilityMatch;
        CAPABILITY_REGEX.lastIndex = 0;
        while ((capabilityMatch = CAPABILITY_REGEX.exec(searchValue)) !== null) {
            capabilities.push(capabilityMatch[1].toLowerCase());
        }
        if (capabilities.length > 0) {
            searchValue = searchValue.replace(CAPABILITY_REGEX, '');
        }
        const quoteAtFirstChar = searchValue.charAt(0) === '"';
        const quoteAtLastChar = searchValue.charAt(searchValue.length - 1) === '"';
        const completeMatch = quoteAtFirstChar && quoteAtLastChar;
        if (quoteAtFirstChar) {
            searchValue = searchValue.substring(1);
        }
        if (quoteAtLastChar) {
            searchValue = searchValue.substring(0, searchValue.length - 1);
        }
        searchValue = searchValue.trim();
        const isFiltering = searchValue !== '' || capabilities.length > 0 || providerNames.length > 0 || visible !== undefined;
        const result = [];
        const words = searchValue.split(' ');
        const allVendors = new Set(this.modelEntries.map(m => m.vendor));
        const showHeaders = allVendors.size > 1;
        const addedGroups = new Set();
        const lowerProviders = providerNames.map(p => p.toLowerCase().trim());
        for (const modelEntry of modelEntries) {
            if (visible !== undefined) {
                if ((modelEntry.metadata.isUserSelectable ?? false) !== visible) {
                    continue;
                }
            }
            if (lowerProviders.length > 0) {
                const matchesProvider = lowerProviders.some(provider => modelEntry.vendor.toLowerCase() === provider ||
                    modelEntry.vendorDisplayName.toLowerCase() === provider);
                if (!matchesProvider) {
                    continue;
                }
            }
            // Filter by capabilities
            let matchedCapabilities = [];
            if (capabilities.length > 0) {
                if (!modelEntry.metadata.capabilities) {
                    continue;
                }
                let matchesAll = true;
                for (const capability of capabilities) {
                    const matchedForThisCapability = this.getMatchingCapabilities(modelEntry, capability);
                    if (matchedForThisCapability.length === 0) {
                        matchesAll = false;
                        break;
                    }
                    matchedCapabilities.push(...matchedForThisCapability);
                }
                if (!matchesAll) {
                    continue;
                }
                matchedCapabilities = distinct(matchedCapabilities);
            }
            // Filter by text
            let modelMatches;
            if (searchValue) {
                modelMatches = new ModelItemMatches(modelEntry, searchValue, words, completeMatch);
                if (!modelMatches.modelNameMatches && !modelMatches.modelIdMatches && !modelMatches.providerMatches && !modelMatches.capabilityMatches) {
                    continue;
                }
            }
            if (this.groupBy === "vendor" /* ChatModelGroup.Vendor */) {
                if (showHeaders) {
                    if (!addedGroups.has(modelEntry.vendor)) {
                        const isCollapsed = !isFiltering && this.collapsedGroups.has(modelEntry.vendor);
                        const vendorInfo = this.languageModelsService.getVendors().find(v => v.vendor === modelEntry.vendor);
                        result.push({
                            type: 'vendor',
                            id: `vendor-${modelEntry.vendor}`,
                            vendorEntry: {
                                vendor: modelEntry.vendor,
                                vendorDisplayName: modelEntry.vendorDisplayName,
                                managementCommand: vendorInfo?.managementCommand
                            },
                            templateId: VENDOR_ENTRY_TEMPLATE_ID,
                            collapsed: isCollapsed
                        });
                        addedGroups.add(modelEntry.vendor);
                    }
                    if (!isFiltering && this.collapsedGroups.has(modelEntry.vendor)) {
                        continue;
                    }
                }
            }
            else if (this.groupBy === "visibility" /* ChatModelGroup.Visibility */) {
                const isVisible = modelEntry.metadata.isUserSelectable ?? false;
                const groupKey = isVisible ? 'visible' : 'hidden';
                if (!addedGroups.has(groupKey)) {
                    const isCollapsed = !isFiltering && this.collapsedGroups.has(groupKey);
                    result.push({
                        type: 'group',
                        id: `group-${groupKey}`,
                        group: groupKey,
                        label: isVisible ? localize('visible', "Visible") : localize('hidden', "Hidden"),
                        templateId: GROUP_ENTRY_TEMPLATE_ID,
                        collapsed: isCollapsed
                    });
                    addedGroups.add(groupKey);
                }
                if (!isFiltering && this.collapsedGroups.has(groupKey)) {
                    continue;
                }
            }
            const modelId = ChatModelsViewModel_1.getId(modelEntry);
            result.push({
                type: 'model',
                id: modelId,
                templateId: MODEL_ENTRY_TEMPLATE_ID,
                modelEntry,
                modelNameMatches: modelMatches?.modelNameMatches || undefined,
                modelIdMatches: modelMatches?.modelIdMatches || undefined,
                providerMatches: modelMatches?.providerMatches || undefined,
                capabilityMatches: matchedCapabilities.length ? matchedCapabilities : undefined,
            });
        }
        return result;
    }
    getMatchingCapabilities(modelEntry, capability) {
        const matchedCapabilities = [];
        if (!modelEntry.metadata.capabilities) {
            return matchedCapabilities;
        }
        switch (capability) {
            case 'tools':
            case 'toolcalling':
                if (modelEntry.metadata.capabilities.toolCalling === true) {
                    matchedCapabilities.push('toolCalling');
                }
                break;
            case 'vision':
                if (modelEntry.metadata.capabilities.vision === true) {
                    matchedCapabilities.push('vision');
                }
                break;
            case 'agent':
            case 'agentmode':
                if (modelEntry.metadata.capabilities.agentMode === true) {
                    matchedCapabilities.push('agentMode');
                }
                break;
            default:
                // Check edit tools
                if (modelEntry.metadata.capabilities.editTools) {
                    for (const tool of modelEntry.metadata.capabilities.editTools) {
                        if (tool.toLowerCase().includes(capability)) {
                            matchedCapabilities.push(tool);
                        }
                    }
                }
                break;
        }
        return matchedCapabilities;
    }
    sortModels(modelEntries) {
        if (this.groupBy === "visibility" /* ChatModelGroup.Visibility */) {
            modelEntries.sort((a, b) => {
                const aVisible = a.metadata.isUserSelectable ?? false;
                const bVisible = b.metadata.isUserSelectable ?? false;
                if (aVisible === bVisible) {
                    if (a.vendor === b.vendor) {
                        return a.metadata.name.localeCompare(b.metadata.name);
                    }
                    if (a.vendor === 'copilot') {
                        return -1;
                    }
                    if (b.vendor === 'copilot') {
                        return 1;
                    }
                    return a.vendorDisplayName.localeCompare(b.vendorDisplayName);
                }
                return aVisible ? -1 : 1;
            });
        }
        else if (this.groupBy === "vendor" /* ChatModelGroup.Vendor */) {
            modelEntries.sort((a, b) => {
                if (a.vendor === b.vendor) {
                    return a.metadata.name.localeCompare(b.metadata.name);
                }
                if (a.vendor === 'copilot') {
                    return -1;
                }
                if (b.vendor === 'copilot') {
                    return 1;
                }
                return a.vendorDisplayName.localeCompare(b.vendorDisplayName);
            });
        }
        this.modelsSorted = true;
        return modelEntries;
    }
    getVendors() {
        return [...this.languageModelsService.getVendors()].sort((a, b) => {
            if (a.vendor === 'copilot') {
                return -1;
            }
            if (b.vendor === 'copilot') {
                return 1;
            }
            return a.displayName.localeCompare(b.displayName);
        });
    }
    async refresh() {
        this.modelEntries = [];
        for (const vendor of this.getVendors()) {
            const modelIdentifiers = await this.languageModelsService.selectLanguageModels({ vendor: vendor.vendor }, vendor.vendor === 'copilot');
            const models = coalesce(modelIdentifiers.map(identifier => {
                const metadata = this.languageModelsService.lookupLanguageModel(identifier);
                if (!metadata) {
                    return undefined;
                }
                if (vendor.vendor === 'copilot' && metadata.id === 'auto') {
                    return undefined;
                }
                return {
                    vendor: vendor.vendor,
                    vendorDisplayName: vendor.displayName,
                    identifier,
                    metadata
                };
            }));
            this.modelEntries.push(...models.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name)));
        }
        const modelEntries = distinct(this.modelEntries, modelEntry => ChatModelsViewModel_1.getId(modelEntry));
        this.modelEntries = this._groupBy === "visibility" /* ChatModelGroup.Visibility */ ? this.sortModels(modelEntries) : modelEntries;
        this.filter(this.searchValue);
    }
    toggleVisibility(model) {
        const isVisible = model.modelEntry.metadata.isUserSelectable ?? false;
        const newVisibility = !isVisible;
        this.languageModelsService.updateModelPickerPreference(model.modelEntry.identifier, newVisibility);
        const metadata = this.languageModelsService.lookupLanguageModel(model.modelEntry.identifier);
        const index = this.viewModelEntries.indexOf(model);
        if (metadata && index !== -1) {
            model.id = ChatModelsViewModel_1.getId(model.modelEntry);
            model.modelEntry.metadata = metadata;
            if (this.groupBy === "visibility" /* ChatModelGroup.Visibility */) {
                this.modelsSorted = false;
            }
            this.splice(index, 1, [model]);
        }
    }
    static getId(modelEntry) {
        return `${modelEntry.identifier}.${modelEntry.metadata.version}-visible:${modelEntry.metadata.isUserSelectable}`;
    }
    toggleCollapsed(viewModelEntry) {
        const id = isGroupEntry(viewModelEntry) ? viewModelEntry.group : isVendorEntry(viewModelEntry) ? viewModelEntry.vendorEntry.vendor : undefined;
        if (!id) {
            return;
        }
        this.selectedEntry = viewModelEntry;
        if (!this.collapsedGroups.delete(id)) {
            this.collapsedGroups.add(id);
        }
        this.filter(this.searchValue);
    }
    getConfiguredVendors() {
        const result = [];
        const seenVendors = new Set();
        for (const modelEntry of this.modelEntries) {
            if (!seenVendors.has(modelEntry.vendor)) {
                seenVendors.add(modelEntry.vendor);
                const vendorInfo = this.languageModelsService.getVendors().find(v => v.vendor === modelEntry.vendor);
                result.push({
                    vendor: modelEntry.vendor,
                    vendorDisplayName: modelEntry.vendorDisplayName,
                    managementCommand: vendorInfo?.managementCommand
                });
            }
        }
        return result;
    }
};
ChatModelsViewModel = ChatModelsViewModel_1 = __decorate([
    __param(0, ILanguageModelsService),
    __param(1, IChatEntitlementService)
], ChatModelsViewModel);
export { ChatModelsViewModel };
class ModelItemMatches {
    constructor(modelEntry, searchValue, words, completeMatch) {
        this.modelNameMatches = null;
        this.modelIdMatches = null;
        this.providerMatches = null;
        this.capabilityMatches = null;
        if (!completeMatch) {
            // Match against model name
            this.modelNameMatches = modelEntry.metadata.name ?
                this.matches(searchValue, modelEntry.metadata.name, (word, wordToMatchAgainst) => matchesWords(word, wordToMatchAgainst, true), words) :
                null;
            this.modelIdMatches = this.matches(searchValue, modelEntry.identifier, or(matchesWords, matchesCamelCase), words);
            // Match against vendor display name
            this.providerMatches = this.matches(searchValue, modelEntry.vendorDisplayName, (word, wordToMatchAgainst) => matchesWords(word, wordToMatchAgainst, true), words);
            // Match against capabilities
            if (modelEntry.metadata.capabilities) {
                const capabilityStrings = [];
                if (modelEntry.metadata.capabilities.toolCalling) {
                    capabilityStrings.push('tools', 'toolCalling');
                }
                if (modelEntry.metadata.capabilities.vision) {
                    capabilityStrings.push('vision');
                }
                if (modelEntry.metadata.capabilities.agentMode) {
                    capabilityStrings.push('agent', 'agentMode');
                }
                if (modelEntry.metadata.capabilities.editTools) {
                    capabilityStrings.push(...modelEntry.metadata.capabilities.editTools);
                }
                const capabilityString = capabilityStrings.join(' ');
                if (capabilityString) {
                    this.capabilityMatches = this.matches(searchValue, capabilityString, or(matchesWords, matchesCamelCase), words);
                }
            }
        }
    }
    matches(searchValue, wordToMatchAgainst, wordMatchesFilter, words) {
        let matches = searchValue ? wordFilter(searchValue, wordToMatchAgainst) : null;
        if (!matches) {
            matches = this.matchesWords(words, wordToMatchAgainst, wordMatchesFilter);
        }
        if (matches) {
            matches = this.filterAndSort(matches);
        }
        return matches;
    }
    matchesWords(words, wordToMatchAgainst, wordMatchesFilter) {
        let matches = [];
        for (const word of words) {
            const wordMatches = wordMatchesFilter(word, wordToMatchAgainst);
            if (wordMatches) {
                matches = [...(matches || []), ...wordMatches];
            }
            else {
                matches = null;
                break;
            }
        }
        return matches;
    }
    filterAndSort(matches) {
        return distinct(matches, (a => a.start + '.' + a.end))
            .filter(match => !matches.some(m => !(m.start === match.start && m.end === match.end) && (m.start <= match.start && m.end >= match.end)))
            .sort((a, b) => a.start - b.start);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1vZGVsc1ZpZXdNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdE1hbmFnZW1lbnQvY2hhdE1vZGVsc1ZpZXdNb2RlbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMxRSxPQUFPLEVBQW1CLEVBQUUsRUFBRSxnQkFBZ0IsRUFBRSxZQUFZLEVBQUUsOEJBQThCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUM1SSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLHNCQUFzQixFQUEwRCxNQUFNLHdDQUF3QyxDQUFDO0FBQ3hJLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFFckUsTUFBTSxDQUFDLE1BQU0sdUJBQXVCLEdBQUcsc0JBQXNCLENBQUM7QUFDOUQsTUFBTSxDQUFDLE1BQU0sd0JBQXdCLEdBQUcsdUJBQXVCLENBQUM7QUFDaEUsTUFBTSxDQUFDLE1BQU0sdUJBQXVCLEdBQUcsc0JBQXNCLENBQUM7QUFFOUQsTUFBTSxVQUFVLEdBQUcsRUFBRSxDQUFDLDhCQUE4QixFQUFFLFlBQVksQ0FBQyxDQUFDO0FBQ3BFLE1BQU0sZ0JBQWdCLEdBQUcsMkJBQTJCLENBQUM7QUFDckQsTUFBTSxhQUFhLEdBQUcsMkJBQTJCLENBQUM7QUFDbEQsTUFBTSxjQUFjLEdBQUcsbUNBQW1DLENBQUM7QUFFM0QsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdB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