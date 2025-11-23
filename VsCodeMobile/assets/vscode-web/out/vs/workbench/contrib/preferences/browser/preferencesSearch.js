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
import { distinct } from '../../../../base/common/arrays.js';
import { matchesBaseContiguousSubString, matchesContiguousSubString, matchesSubString, matchesWords } from '../../../../base/common/filters.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import * as strings from '../../../../base/common/strings.js';
import { TfIdfCalculator } from '../../../../base/common/tfIdf.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IExtensionManagementService } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IAiSettingsSearchService } from '../../../services/aiSettingsSearch/common/aiSettingsSearch.js';
import { IWorkbenchExtensionEnablementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { SettingKeyMatchTypes, SettingMatchType } from '../../../services/preferences/common/preferences.js';
import { nullRange } from '../../../services/preferences/common/preferencesModels.js';
import { EMBEDDINGS_ONLY_SEARCH_PROVIDER_NAME, EMBEDDINGS_SEARCH_PROVIDER_NAME, IPreferencesSearchService, LLM_RANKED_SEARCH_PROVIDER_NAME, STRING_MATCH_SEARCH_PROVIDER_NAME, TF_IDF_SEARCH_PROVIDER_NAME } from '../common/preferences.js';
let PreferencesSearchService = class PreferencesSearchService extends Disposable {
    constructor(instantiationService, configurationService, extensionManagementService, extensionEnablementService) {
        super();
        this.instantiationService = instantiationService;
        this.configurationService = configurationService;
        this.extensionManagementService = extensionManagementService;
        this.extensionEnablementService = extensionEnablementService;
        // This request goes to the shared process but results won't change during a window's lifetime, so cache the results.
        this._installedExtensions = this.extensionManagementService.getInstalled(1 /* ExtensionType.User */).then(exts => {
            // Filter to enabled extensions that have settings
            return exts
                .filter(ext => this.extensionEnablementService.isEnabled(ext))
                .filter(ext => ext.manifest && ext.manifest.contributes && ext.manifest.contributes.configuration)
                .filter(ext => !!ext.identifier.uuid);
        });
    }
    getLocalSearchProvider(filter) {
        return this.instantiationService.createInstance(LocalSearchProvider, filter);
    }
    get remoteSearchAllowed() {
        const workbenchSettings = this.configurationService.getValue().workbench.settings;
        return workbenchSettings.enableNaturalLanguageSearch;
    }
    getRemoteSearchProvider(filter) {
        if (!this.remoteSearchAllowed) {
            return undefined;
        }
        this._remoteSearchProvider ??= this.instantiationService.createInstance(RemoteSearchProvider);
        this._remoteSearchProvider.setFilter(filter);
        return this._remoteSearchProvider;
    }
    getAiSearchProvider(filter) {
        if (!this.remoteSearchAllowed) {
            return undefined;
        }
        this._aiSearchProvider ??= this.instantiationService.createInstance(AiSearchProvider);
        this._aiSearchProvider.setFilter(filter);
        return this._aiSearchProvider;
    }
};
PreferencesSearchService = __decorate([
    __param(0, IInstantiationService),
    __param(1, IConfigurationService),
    __param(2, IExtensionManagementService),
    __param(3, IWorkbenchExtensionEnablementService)
], PreferencesSearchService);
export { PreferencesSearchService };
function cleanFilter(filter) {
    // Remove " and : which are likely to be copypasted as part of a setting name.
    // Leave other special characters which the user might want to search for.
    return filter
        .replace(/[":]/g, ' ')
        .replace(/  /g, ' ')
        .trim();
}
let LocalSearchProvider = class LocalSearchProvider {
    constructor(_filter, configurationService) {
        this._filter = _filter;
        this.configurationService = configurationService;
        this._filter = cleanFilter(this._filter);
    }
    searchModel(preferencesModel, token) {
        if (!this._filter) {
            return Promise.resolve(null);
        }
        const settingMatcher = (setting) => {
            let { matches, matchType, keyMatchScore } = new SettingMatches(this._filter, setting, true, this.configurationService);
            if (matchType === SettingMatchType.None || matches.length === 0) {
                return null;
            }
            if (strings.equalsIgnoreCase(this._filter, setting.key)) {
                matchType = SettingMatchType.ExactMatch;
            }
            return {
                matches,
                matchType,
                keyMatchScore,
                score: 0 // only used for RemoteSearchProvider matches.
            };
        };
        const filterMatches = preferencesModel.filterSettings(this._filter, this.getGroupFilter(this._filter), settingMatcher);
        // Check the top key match type.
        const topKeyMatchType = Math.max(...filterMatches.map(m => (m.matchType & SettingKeyMatchTypes)));
        // Always allow description matches as part of https://github.com/microsoft/vscode/issues/239936.
        const alwaysAllowedMatchTypes = SettingMatchType.DescriptionOrValueMatch | SettingMatchType.LanguageTagSettingMatch;
        const filteredMatches = filterMatches
            .filter(m => (m.matchType & topKeyMatchType) || (m.matchType & alwaysAllowedMatchTypes) || m.matchType === SettingMatchType.ExactMatch)
            .map(m => ({ ...m, providerName: STRING_MATCH_SEARCH_PROVIDER_NAME }));
        return Promise.resolve({
            filterMatches: filteredMatches,
            exactMatch: filteredMatches.some(m => m.matchType === SettingMatchType.ExactMatch)
        });
    }
    getGroupFilter(filter) {
        const regex = strings.createRegExp(filter, false, { global: true });
        return (group) => {
            return group.id !== 'defaultOverrides' && regex.test(group.title);
        };
    }
};
LocalSearchProvider = __decorate([
    __param(1, IConfigurationService)
], LocalSearchProvider);
export { LocalSearchProvider };
export class SettingMatches {
    constructor(searchString, setting, searchDescription, configurationService) {
        this.searchDescription = searchDescription;
        this.configurationService = configurationService;
        this.matchType = SettingMatchType.None;
        /**
         * A match score for key matches to allow comparing key matches against each other.
         * Otherwise, all key matches are treated the same, and sorting is done by ToC order.
         */
        this.keyMatchScore = 0;
        this.matches = distinct(this._findMatchesInSetting(searchString, setting), (match) => `${match.startLineNumber}_${match.startColumn}_${match.endLineNumber}_${match.endColumn}_`);
    }
    _findMatchesInSetting(searchString, setting) {
        const result = this._doFindMatchesInSetting(searchString, setting);
        return result;
    }
    _keyToLabel(settingId) {
        const label = settingId
            .replace(/[-._]/g, ' ')
            .replace(/([a-z]+)([A-Z])/g, '$1 $2')
            .replace(/([A-Za-z]+)(\d+)/g, '$1 $2')
            .replace(/(\d+)([A-Za-z]+)/g, '$1 $2')
            .toLowerCase();
        return label;
    }
    _toAlphaNumeric(s) {
        return s.replace(/[^\p{L}\p{N}]+/gu, '');
    }
    _doFindMatchesInSetting(searchString, setting) {
        const descriptionMatchingWords = new Map();
        const keyMatchingWords = new Map();
        const valueMatchingWords = new Map();
        // Key (ID) search
        // First, search by the setting's ID and label.
        const settingKeyAsWords = this._keyToLabel(setting.key);
        const queryWords = new Set(searchString.split(' '));
        for (const word of queryWords) {
            // Check if the key contains the word. Use contiguous search.
            const keyMatches = matchesWords(word, settingKeyAsWords, true);
            if (keyMatches?.length) {
                keyMatchingWords.set(word, keyMatches.map(match => this.toKeyRange(setting, match)));
            }
        }
        if (keyMatchingWords.size === queryWords.size) {
            // All words in the query matched with something in the setting key.
            // Matches "edit format on paste" to "editor.formatOnPaste".
            this.matchType |= SettingMatchType.AllWordsInSettingsLabel;
        }
        else if (keyMatchingWords.size >= 2) {
            // Matches "edit paste" to "editor.formatOnPaste".
            // The if statement reduces noise by preventing "editor formatonpast" from matching all editor settings.
            this.matchType |= SettingMatchType.ContiguousWordsInSettingsLabel;
            this.keyMatchScore = keyMatchingWords.size;
        }
        const searchStringAlphaNumeric = this._toAlphaNumeric(searchString);
        const keyAlphaNumeric = this._toAlphaNumeric(setting.key);
        const keyIdMatches = matchesContiguousSubString(searchStringAlphaNumeric, keyAlphaNumeric);
        if (keyIdMatches?.length) {
            // Matches "editorformatonp" to "editor.formatonpaste".
            keyMatchingWords.set(setting.key, keyIdMatches.map(match => this.toKeyRange(setting, match)));
            this.matchType |= SettingMatchType.ContiguousQueryInSettingId;
        }
        // Fall back to non-contiguous key (ID) searches if nothing matched yet.
        if (this.matchType === SettingMatchType.None) {
            keyMatchingWords.clear();
            for (const word of queryWords) {
                const keyMatches = matchesWords(word, settingKeyAsWords, false);
                if (keyMatches?.length) {
                    keyMatchingWords.set(word, keyMatches.map(match => this.toKeyRange(setting, match)));
                }
            }
            if (keyMatchingWords.size >= 2 || (keyMatchingWords.size === 1 && queryWords.size === 1)) {
                // Matches "edforonpas" to "editor.formatOnPaste".
                // The if statement reduces noise by preventing "editor fomonpast" from matching all editor settings.
                this.matchType |= SettingMatchType.NonContiguousWordsInSettingsLabel;
                this.keyMatchScore = keyMatchingWords.size;
            }
            else {
                const keyIdMatches = matchesSubString(searchStringAlphaNumeric, keyAlphaNumeric);
                if (keyIdMatches?.length) {
                    // Matches "edfmonpas" to "editor.formatOnPaste".
                    keyMatchingWords.set(setting.key, keyIdMatches.map(match => this.toKeyRange(setting, match)));
                    this.matchType |= SettingMatchType.NonContiguousQueryInSettingId;
                }
            }
        }
        // Check if the match was for a language tag group setting such as [markdown].
        // In such a case, move that setting to be last.
        if (setting.overrides?.length && (this.matchType !== SettingMatchType.None)) {
            this.matchType = SettingMatchType.LanguageTagSettingMatch;
            const keyRanges = keyMatchingWords.size ?
                Array.from(keyMatchingWords.values()).flat() : [];
            return [...keyRanges];
        }
        // Description search
        // Search the description if we found non-contiguous key matches at best.
        const hasContiguousKeyMatchTypes = this.matchType >= SettingMatchType.ContiguousWordsInSettingsLabel;
        if (this.searchDescription && !hasContiguousKeyMatchTypes) {
            for (const word of queryWords) {
                // Search the description lines.
                for (let lineIndex = 0; lineIndex < setting.description.length; lineIndex++) {
                    const descriptionMatches = matchesBaseContiguousSubString(word, setting.description[lineIndex]);
                    if (descriptionMatches?.length) {
                        descriptionMatchingWords.set(word, descriptionMatches.map(match => this.toDescriptionRange(setting, match, lineIndex)));
                    }
                }
            }
            if (descriptionMatchingWords.size === queryWords.size) {
                this.matchType |= SettingMatchType.DescriptionOrValueMatch;
            }
            else {
                // Clear out the match for now. We want to require all words to match in the description.
                descriptionMatchingWords.clear();
            }
        }
        // Value search
        // Check if the value contains all the words.
        // Search the values if we found non-contiguous key matches at best.
        if (!hasContiguousKeyMatchTypes) {
            if (setting.enum?.length) {
                // Search all string values of enums.
                for (const option of setting.enum) {
                    if (typeof option !== 'string') {
                        continue;
                    }
                    valueMatchingWords.clear();
                    for (const word of queryWords) {
                        const valueMatches = matchesContiguousSubString(word, option);
                        if (valueMatches?.length) {
                            valueMatchingWords.set(word, valueMatches.map(match => this.toValueRange(setting, match)));
                        }
                    }
                    if (valueMatchingWords.size === queryWords.size) {
                        this.matchType |= SettingMatchType.DescriptionOrValueMatch;
                        break;
                    }
                    else {
                        // Clear out the match for now. We want to require all words to match in the value.
                        valueMatchingWords.clear();
                    }
                }
            }
            else {
                // Search single string value.
                const settingValue = this.configurationService.getValue(setting.key);
                if (typeof settingValue === 'string') {
                    for (const word of queryWords) {
                        const valueMatches = matchesContiguousSubString(word, settingValue);
                        if (valueMatches?.length) {
                            valueMatchingWords.set(word, valueMatches.map(match => this.toValueRange(setting, match)));
                        }
                    }
                    if (valueMatchingWords.size === queryWords.size) {
                        this.matchType |= SettingMatchType.DescriptionOrValueMatch;
                    }
                    else {
                        // Clear out the match for now. We want to require all words to match in the value.
                        valueMatchingWords.clear();
                    }
                }
            }
        }
        const descriptionRanges = descriptionMatchingWords.size ?
            Array.from(descriptionMatchingWords.values()).flat() : [];
        const keyRanges = keyMatchingWords.size ?
            Array.from(keyMatchingWords.values()).flat() : [];
        const valueRanges = valueMatchingWords.size ?
            Array.from(valueMatchingWords.values()).flat() : [];
        return [...descriptionRanges, ...keyRanges, ...valueRanges];
    }
    toKeyRange(setting, match) {
        return {
            startLineNumber: setting.keyRange.startLineNumber,
            startColumn: setting.keyRange.startColumn + match.start,
            endLineNumber: setting.keyRange.startLineNumber,
            endColumn: setting.keyRange.startColumn + match.end
        };
    }
    toDescriptionRange(setting, match, lineIndex) {
        const descriptionRange = setting.descriptionRanges[lineIndex];
        if (!descriptionRange) {
            // This case occurs with added settings such as the
            // manage extension setting.
            return nullRange;
        }
        return {
            startLineNumber: descriptionRange.startLineNumber,
            startColumn: descriptionRange.startColumn + match.start,
            endLineNumber: descriptionRange.endLineNumber,
            endColumn: descriptionRange.startColumn + match.end
        };
    }
    toValueRange(setting, match) {
        return {
            startLineNumber: setting.valueRange.startLineNumber,
            startColumn: setting.valueRange.startColumn + match.start + 1,
            endLineNumber: setting.valueRange.startLineNumber,
            endColumn: setting.valueRange.startColumn + match.end + 1
        };
    }
}
class SettingsRecordProvider {
    constructor() {
        this._settingsRecord = {};
    }
    updateModel(preferencesModel) {
        if (preferencesModel === this._currentPreferencesModel) {
            return;
        }
        this._currentPreferencesModel = preferencesModel;
        this.refresh();
    }
    refresh() {
        this._settingsRecord = {};
        if (!this._currentPreferencesModel) {
            return;
        }
        for (const group of this._currentPreferencesModel.settingsGroups) {
            if (group.id === 'mostCommonlyUsed') {
                continue;
            }
            for (const section of group.sections) {
                for (const setting of section.settings) {
                    this._settingsRecord[setting.key] = setting;
                }
            }
        }
    }
    getSettingsRecord() {
        return this._settingsRecord;
    }
}
class EmbeddingsSearchProvider {
    static { this.EMBEDDINGS_SETTINGS_SEARCH_MAX_PICKS = 10; }
    constructor(_aiSettingsSearchService, _excludeSelectionStep) {
        this._aiSettingsSearchService = _aiSettingsSearchService;
        this._excludeSelectionStep = _excludeSelectionStep;
        this._filter = '';
        this._recordProvider = new SettingsRecordProvider();
    }
    setFilter(filter) {
        this._filter = cleanFilter(filter);
    }
    async searchModel(preferencesModel, token) {
        if (!this._filter || !this._aiSettingsSearchService.isEnabled()) {
            return null;
        }
        this._recordProvider.updateModel(preferencesModel);
        this._aiSettingsSearchService.startSearch(this._filter, this._excludeSelectionStep, token);
        return {
            filterMatches: await this.getEmbeddingsItems(token),
            exactMatch: false
        };
    }
    async getEmbeddingsItems(token) {
        const settingsRecord = this._recordProvider.getSettingsRecord();
        const filterMatches = [];
        const settings = await this._aiSettingsSearchService.getEmbeddingsResults(this._filter, token);
        if (!settings) {
            return [];
        }
        const providerName = this._excludeSelectionStep ? EMBEDDINGS_ONLY_SEARCH_PROVIDER_NAME : EMBEDDINGS_SEARCH_PROVIDER_NAME;
        for (const settingKey of settings) {
            if (filterMatches.length === EmbeddingsSearchProvider.EMBEDDINGS_SETTINGS_SEARCH_MAX_PICKS) {
                break;
            }
            filterMatches.push({
                setting: settingsRecord[settingKey],
                matches: [settingsRecord[settingKey].range],
                matchType: SettingMatchType.RemoteMatch,
                keyMatchScore: 0,
                score: 0, // the results are sorted upstream.
                providerName
            });
        }
        return filterMatches;
    }
}
class TfIdfSearchProvider {
    static { this.TF_IDF_PRE_NORMALIZE_THRESHOLD = 50; }
    static { this.TF_IDF_POST_NORMALIZE_THRESHOLD = 0.7; }
    static { this.TF_IDF_MAX_PICKS = 5; }
    constructor() {
        this._filter = '';
        this._documents = [];
        this._settingsRecord = {};
    }
    setFilter(filter) {
        this._filter = cleanFilter(filter);
    }
    keyToLabel(settingId) {
        const label = settingId
            .replace(/[-._]/g, ' ')
            .replace(/([a-z]+)([A-Z])/g, '$1 $2')
            .replace(/([A-Za-z]+)(\d+)/g, '$1 $2')
            .replace(/(\d+)([A-Za-z]+)/g, '$1 $2')
            .toLowerCase();
        return label;
    }
    settingItemToEmbeddingString(item) {
        let result = `Setting Id: ${item.key}\n`;
        result += `Label: ${this.keyToLabel(item.key)}\n`;
        result += `Description: ${item.description}\n`;
        return result;
    }
    async searchModel(preferencesModel, token) {
        if (!this._filter) {
            return null;
        }
        if (this._currentPreferencesModel !== preferencesModel) {
            // Refresh the documents and settings record
            this._currentPreferencesModel = preferencesModel;
            this._documents = [];
            this._settingsRecord = {};
            for (const group of preferencesModel.settingsGroups) {
                if (group.id === 'mostCommonlyUsed') {
                    continue;
                }
                for (const section of group.sections) {
                    for (const setting of section.settings) {
                        this._documents.push({
                            key: setting.key,
                            textChunks: [this.settingItemToEmbeddingString(setting)]
                        });
                        this._settingsRecord[setting.key] = setting;
                    }
                }
            }
        }
        return {
            filterMatches: await this.getTfIdfItems(token),
            exactMatch: false
        };
    }
    async getTfIdfItems(token) {
        const filterMatches = [];
        const tfIdfCalculator = new TfIdfCalculator();
        tfIdfCalculator.updateDocuments(this._documents);
        const tfIdfRankings = tfIdfCalculator.calculateScores(this._filter, token);
        tfIdfRankings.sort((a, b) => b.score - a.score);
        const maxScore = tfIdfRankings[0].score;
        if (maxScore < TfIdfSearchProvider.TF_IDF_PRE_NORMALIZE_THRESHOLD) {
            // Reject all the matches.
            return [];
        }
        for (const info of tfIdfRankings) {
            if (info.score / maxScore < TfIdfSearchProvider.TF_IDF_POST_NORMALIZE_THRESHOLD || filterMatches.length === TfIdfSearchProvider.TF_IDF_MAX_PICKS) {
                break;
            }
            const pick = info.key;
            filterMatches.push({
                setting: this._settingsRecord[pick],
                matches: [this._settingsRecord[pick].range],
                matchType: SettingMatchType.RemoteMatch,
                keyMatchScore: 0,
                score: info.score,
                providerName: TF_IDF_SEARCH_PROVIDER_NAME
            });
        }
        return filterMatches;
    }
}
class RemoteSearchProvider {
    constructor() {
        this._filter = '';
        this._tfIdfSearchProvider = new TfIdfSearchProvider();
    }
    setFilter(filter) {
        this._filter = filter;
        this._tfIdfSearchProvider.setFilter(filter);
    }
    async searchModel(preferencesModel, token) {
        if (!this._filter) {
            return null;
        }
        const results = await this._tfIdfSearchProvider.searchModel(preferencesModel, token);
        return results;
    }
}
let AiSearchProvider = class AiSearchProvider {
    constructor(aiSettingsSearchService) {
        this.aiSettingsSearchService = aiSettingsSearchService;
        this._filter = '';
        this._embeddingsSearchProvider = new EmbeddingsSearchProvider(this.aiSettingsSearchService, false);
        this._recordProvider = new SettingsRecordProvider();
    }
    setFilter(filter) {
        this._filter = filter;
        this._embeddingsSearchProvider.setFilter(filter);
    }
    async searchModel(preferencesModel, token) {
        if (!this._filter || !this.aiSettingsSearchService.isEnabled()) {
            return null;
        }
        this._recordProvider.updateModel(preferencesModel);
        const results = await this._embeddingsSearchProvider.searchModel(preferencesModel, token);
        return results;
    }
    async getLLMRankedResults(token) {
        if (!this._filter || !this.aiSettingsSearchService.isEnabled()) {
            return null;
        }
        const items = await this.getLLMRankedItems(token);
        return {
            filterMatches: items,
            exactMatch: false
        };
    }
    async getLLMRankedItems(token) {
        const settingsRecord = this._recordProvider.getSettingsRecord();
        const filterMatches = [];
        const settings = await this.aiSettingsSearchService.getLLMRankedResults(this._filter, token);
        if (!settings) {
            return [];
        }
        for (const settingKey of settings) {
            if (!settingsRecord[settingKey]) {
                // Non-existent setting.
                continue;
            }
            filterMatches.push({
                setting: settingsRecord[settingKey],
                matches: [settingsRecord[settingKey].range],
                matchType: SettingMatchType.RemoteMatch,
                keyMatchScore: 0,
                score: 0, // the results are sorted upstream.
                providerName: LLM_RANKED_SEARCH_PROVIDER_NAME
            });
        }
        return filterMatches;
    }
};
AiSearchProvider = __decorate([
    __param(0, IAiSettingsSearchService)
], AiSearchProvider);
registerSingleton(IPreferencesSearchService, PreferencesSearchService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmVyZW5jZXNTZWFyY2guanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvcHJlZmVyZW5jZXMvYnJvd3Nlci9wcmVmZXJlbmNlc1NlYXJjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFHN0QsT0FBTyxFQUFVLDhCQUE4QixFQUFFLDBCQUEwQixFQUFFLGdCQUFnQixFQUFFLFlBQVksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3hKLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEtBQUssT0FBTyxNQUFNLG9DQUFvQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxlQUFlLEVBQWlCLE1BQU0sa0NBQWtDLENBQUM7QUFFbEYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLDJCQUEyQixFQUFtQixNQUFNLHdFQUF3RSxDQUFDO0FBRXRJLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN6RyxPQUFPLEVBQUUsb0NBQW9DLEVBQUUsTUFBTSxxRUFBcUUsQ0FBQztBQUMzSCxPQUFPLEVBQStHLG9CQUFvQixFQUFFLGdCQUFnQixFQUFFLE1BQU0scURBQXFELENBQUM7QUFDMU4sT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxvQ0FBb0MsRUFBRSwrQkFBK0IsRUFBcUIseUJBQXlCLEVBQTJFLCtCQUErQixFQUFFLGlD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