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
import { ExtensionRecommendations } from './extensionRecommendations.js';
import { IExtensionIgnoredRecommendationsService } from '../../../services/extensionRecommendations/common/extensionRecommendations.js';
import { IExtensionsWorkbenchService } from '../common/extensions.js';
import { localize } from '../../../../nls.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { Schemas } from '../../../../base/common/network.js';
import { basename, extname } from '../../../../base/common/resources.js';
import { match } from '../../../../base/common/glob.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { IExtensionRecommendationNotificationService } from '../../../../platform/extensionRecommendations/common/extensionRecommendations.js';
import { distinct } from '../../../../base/common/arrays.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { CellUri } from '../../notebook/common/notebookCommon.js';
import { disposableTimeout } from '../../../../base/common/async.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { areSameExtensions } from '../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { isEmptyObject } from '../../../../base/common/types.js';
import { PLAINTEXT_LANGUAGE_ID } from '../../../../editor/common/languages/modesRegistry.js';
import { IUntitledTextEditorService } from '../../../services/untitled/common/untitledTextEditorService.js';
const promptedRecommendationsStorageKey = 'fileBasedRecommendations/promptedRecommendations';
const recommendationsStorageKey = 'extensionsAssistant/recommendations';
const milliSecondsInADay = 1000 * 60 * 60 * 24;
// Minimum length of untitled file to allow triggering extension recommendations for auto-detected language.
const untitledFileRecommendationsMinLength = 1000;
let FileBasedRecommendations = class FileBasedRecommendations extends ExtensionRecommendations {
    get recommendations() {
        const recommendations = [];
        [...this.fileBasedRecommendations.keys()]
            .sort((a, b) => {
            if (this.fileBasedRecommendations.get(a).recommendedTime === this.fileBasedRecommendations.get(b).recommendedTime) {
                if (this.fileBasedImportantRecommendations.has(a)) {
                    return -1;
                }
                if (this.fileBasedImportantRecommendations.has(b)) {
                    return 1;
                }
            }
            return this.fileBasedRecommendations.get(a).recommendedTime > this.fileBasedRecommendations.get(b).recommendedTime ? -1 : 1;
        })
            .forEach(extensionId => {
            recommendations.push({
                extension: extensionId,
                reason: {
                    reasonId: 1 /* ExtensionRecommendationReason.File */,
                    reasonText: localize('fileBasedRecommendation', "This extension is recommended based on the files you recently opened.")
                }
            });
        });
        return recommendations;
    }
    get importantRecommendations() {
        return this.recommendations.filter(e => this.fileBasedImportantRecommendations.has(e.extension));
    }
    get otherRecommendations() {
        return this.recommendations.filter(e => !this.fileBasedImportantRecommendations.has(e.extension));
    }
    constructor(extensionsWorkbenchService, modelService, languageService, productService, storageService, extensionRecommendationNotificationService, extensionIgnoredRecommendationsService, workspaceContextService, untitledTextEditorService) {
        super();
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.modelService = modelService;
        this.languageService = languageService;
        this.storageService = storageService;
        this.extensionRecommendationNotificationService = extensionRecommendationNotificationService;
        this.extensionIgnoredRecommendationsService = extensionIgnoredRecommendationsService;
        this.workspaceContextService = workspaceContextService;
        this.untitledTextEditorService = untitledTextEditorService;
        this.recommendationsByPattern = new Map();
        this.fileBasedRecommendations = new Map();
        this.fileBasedImportantRecommendations = new Set();
        this.fileOpenRecommendations = {};
        if (productService.extensionRecommendations) {
            for (const [extensionId, recommendation] of Object.entries(productService.extensionRecommendations)) {
                if (recommendation.onFileOpen) {
                    this.fileOpenRecommendations[extensionId.toLowerCase()] = recommendation.onFileOpen;
                }
            }
        }
    }
    async doActivate() {
        if (isEmptyObject(this.fileOpenRecommendations)) {
            return;
        }
        await this.extensionsWorkbenchService.whenInitialized;
        const cachedRecommendations = this.getCachedRecommendations();
        const now = Date.now();
        // Retire existing recommendations if they are older than a week or are not part of this.productService.extensionTips anymore
        Object.entries(cachedRecommendations).forEach(([key, value]) => {
            const diff = (now - value) / milliSecondsInADay;
            if (diff <= 7 && this.fileOpenRecommendations[key]) {
                this.fileBasedRecommendations.set(key.toLowerCase(), { recommendedTime: value });
            }
        });
        this._register(this.modelService.onModelAdded(model => this.onModelAdded(model)));
        this.modelService.getModels().forEach(model => this.onModelAdded(model));
    }
    onModelAdded(model) {
        const uri = model.uri.scheme === Schemas.vscodeNotebookCell ? CellUri.parse(model.uri)?.notebook : model.uri;
        if (!uri) {
            return;
        }
        const supportedSchemes = distinct([Schemas.untitled, Schemas.file, Schemas.vscodeRemote, ...this.workspaceContextService.getWorkspace().folders.map(folder => folder.uri.scheme)]);
        if (!uri || !supportedSchemes.includes(uri.scheme)) {
            return;
        }
        // re-schedule this bit of the operation to be off the critical path - in case glob-match is slow
        disposableTimeout(() => this.promptImportantRecommendations(uri, model), 0, this._store);
    }
    /**
     * Prompt the user to either install the recommended extension for the file type in the current editor model
     * or prompt to search the marketplace if it has extensions that can support the file type
     */
    promptImportantRecommendations(uri, model, extensionRecommendations) {
        if (model.isDisposed()) {
            return;
        }
        const pattern = extname(uri).toLowerCase();
        extensionRecommendations = extensionRecommendations ?? this.recommendationsByPattern.get(pattern) ?? this.fileOpenRecommendations;
        const extensionRecommendationEntries = Object.entries(extensionRecommendations);
        if (extensionRecommendationEntries.length === 0) {
            return;
        }
        const processedPathGlobs = new Map();
        const installed = this.extensionsWorkbenchService.local;
        const recommendationsByPattern = {};
        const matchedRecommendations = {};
        const unmatchedRecommendations = {};
        let listenOnLanguageChange = false;
        const languageId = model.getLanguageId();
        // Allow language-specific recommendations for untitled files when language is auto-detected only when the file is large.
        const untitledModel = this.untitledTextEditorService.get(uri);
        const allowLanguageMatch = !untitledModel ||
            untitledModel.hasLanguageSetExplicitly ||
            model.getValueLength() > untitledFileRecommendationsMinLength;
        for (const [extensionId, conditions] of extensionRecommendationEntries) {
            const conditionsByPattern = [];
            const matchedConditions = [];
            const unmatchedConditions = [];
            for (const condition of conditions) {
                let languageMatched = false;
                let pathGlobMatched = false;
                const isLanguageCondition = !!condition.languages;
                const isFileContentCondition = !!condition.contentPattern;
                if (isLanguageCondition || isFileContentCondition) {
                    conditionsByPattern.push(condition);
                }
                if (isLanguageCondition && allowLanguageMatch) {
                    if (condition.languages.includes(languageId)) {
                        languageMatched = true;
                    }
                }
                const pathGlob = condition.pathGlob;
                if (pathGlob) {
                    if (processedPathGlobs.get(pathGlob) ?? match(pathGlob, uri.with({ fragment: '' }).toString(), { ignoreCase: true })) {
                        pathGlobMatched = true;
                    }
                    processedPathGlobs.set(pathGlob, pathGlobMatched);
                }
                let matched = languageMatched || pathGlobMatched;
                // If the resource has pattern (extension) and not matched, then we don't need to check the other conditions
                if (pattern && !matched) {
                    continue;
                }
                if (matched && condition.whenInstalled) {
                    if (!condition.whenInstalled.every(id => installed.some(local => areSameExtensions({ id }, local.identifier)))) {
                        matched = false;
                    }
                }
                if (matched && condition.whenNotInstalled) {
                    if (installed.some(local => condition.whenNotInstalled?.some(id => areSameExtensions({ id }, local.identifier)))) {
                        matched = false;
                    }
                }
                if (matched && isFileContentCondition) {
                    if (!model.findMatches(condition.contentPattern, false, true, false, null, false).length) {
                        matched = false;
                    }
                }
                if (matched) {
                    matchedConditions.push(condition);
                    conditionsByPattern.pop();
                }
                else {
                    if (isLanguageCondition || isFileContentCondition) {
                        unmatchedConditions.push(condition);
                        if (isLanguageCondition) {
                            listenOnLanguageChange = true;
                        }
                    }
                }
            }
            if (matchedConditions.length) {
                matchedRecommendations[extensionId] = matchedConditions;
            }
            if (unmatchedConditions.length) {
                unmatchedRecommendations[extensionId] = unmatchedConditions;
            }
            if (conditionsByPattern.length) {
                recommendationsByPattern[extensionId] = conditionsByPattern;
            }
        }
        if (pattern) {
            this.recommendationsByPattern.set(pattern, recommendationsByPattern);
        }
        if (Object.keys(unmatchedRecommendations).length) {
            if (listenOnLanguageChange) {
                const disposables = new DisposableStore();
                disposables.add(model.onDidChangeLanguage(() => {
                    // re-schedule this bit of the operation to be off the critical path - in case glob-match is slow
                    disposableTimeout(() => {
                        if (!disposables.isDisposed) {
                            this.promptImportantRecommendations(uri, model, unmatchedRecommendations);
                            disposables.dispose();
                        }
                    }, 0, disposables);
                }));
                disposables.add(model.onWillDispose(() => disposables.dispose()));
            }
        }
        if (Object.keys(matchedRecommendations).length) {
            this.promptFromRecommendations(uri, model, matchedRecommendations);
        }
    }
    promptFromRecommendations(uri, model, extensionRecommendations) {
        let isImportantRecommendationForLanguage = false;
        const importantRecommendations = new Set();
        const fileBasedRecommendations = new Set();
        for (const [extensionId, conditions] of Object.entries(extensionRecommendations)) {
            for (const condition of conditions) {
                fileBasedRecommendations.add(extensionId);
                if (condition.important) {
                    importantRecommendations.add(extensionId);
                    this.fileBasedImportantRecommendations.add(extensionId);
                }
                if (condition.languages) {
                    isImportantRecommendationForLanguage = true;
                }
            }
        }
        // Update file based recommendations
        for (const recommendation of fileBasedRecommendations) {
            const filedBasedRecommendation = this.fileBasedRecommendations.get(recommendation) || { recommendedTime: Date.now(), sources: [] };
            filedBasedRecommendation.recommendedTime = Date.now();
            this.fileBasedRecommendations.set(recommendation, filedBasedRecommendation);
        }
        this.storeCachedRecommendations();
        if (this.extensionRecommendationNotificationService.hasToIgnoreRecommendationNotifications()) {
            return;
        }
        const language = model.getLanguageId();
        const languageName = this.languageService.getLanguageName(language);
        if (importantRecommendations.size &&
            this.promptRecommendedExtensionForFileType(languageName && isImportantRecommendationForLanguage && language !== PLAINTEXT_LANGUAGE_ID ? localize('languageName', "the {0} language", languageName) : basename(uri), language, [...importantRecommendations])) {
            return;
        }
    }
    promptRecommendedExtensionForFileType(name, language, recommendations) {
        recommendations = this.filterIgnoredOrNotAllowed(recommendations);
        if (recommendations.length === 0) {
            return false;
        }
        recommendations = this.filterInstalled(recommendations, this.extensionsWorkbenchService.local)
            .filter(extensionId => this.fileBasedImportantRecommendations.has(extensionId));
        const promptedRecommendations = language !== PLAINTEXT_LANGUAGE_ID ? this.getPromptedRecommendations()[language] : undefined;
        if (promptedRecommendations) {
            recommendations = recommendations.filter(extensionId => !promptedRecommendations.includes(extensionId));
        }
        if (recommendations.length === 0) {
            return false;
        }
        this.promptImportantExtensionsInstallNotification(recommendations, name, language);
        return true;
    }
    async promptImportantExtensionsInstallNotification(extensions, name, language) {
        try {
            const result = await this.extensionRecommendationNotificationService.promptImportantExtensionsInstallNotification({ extensions, name, source: 1 /* RecommendationSource.FILE */ });
            if (result === "reacted" /* RecommendationsNotificationResult.Accepted */) {
                this.addToPromptedRecommendations(language, extensions);
            }
        }
        catch (error) { /* Ignore */ }
    }
    getPromptedRecommendations() {
        return JSON.parse(this.storageService.get(promptedRecommendationsStorageKey, 0 /* StorageScope.PROFILE */, '{}'));
    }
    addToPromptedRecommendations(language, extensions) {
        const promptedRecommendations = this.getPromptedRecommendations();
        promptedRecommendations[language] = distinct([...(promptedRecommendations[language] ?? []), ...extensions]);
        this.storageService.store(promptedRecommendationsStorageKey, JSON.stringify(promptedRecommendations), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
    }
    filterIgnoredOrNotAllowed(recommendationsToSuggest) {
        const ignoredRecommendations = [...this.extensionIgnoredRecommendationsService.ignoredRecommendations, ...this.extensionRecommendationNotificationService.ignoredRecommendations];
        return recommendationsToSuggest.filter(id => !ignoredRecommendations.includes(id));
    }
    filterInstalled(recommendationsToSuggest, installed) {
        const installedExtensionsIds = installed.reduce((result, i) => {
            if (i.enablementState !== 1 /* EnablementState.DisabledByExtensionKind */) {
                result.add(i.identifier.id.toLowerCase());
            }
            return result;
        }, new Set());
        return recommendationsToSuggest.filter(id => !installedExtensionsIds.has(id.toLowerCase()));
    }
    getCachedRecommendations() {
        let storedRecommendations = JSON.parse(this.storageService.get(recommendationsStorageKey, 0 /* StorageScope.PROFILE */, '[]'));
        if (Array.isArray(storedRecommendations)) {
            storedRecommendations = storedRecommendations.reduce((result, id) => { result[id] = Date.now(); return result; }, {});
        }
        const result = {};
        Object.entries(storedRecommendations).forEach(([key, value]) => {
            if (typeof value === 'number') {
                result[key.toLowerCase()] = value;
            }
        });
        return result;
    }
    storeCachedRecommendations() {
        const storedRecommendations = {};
        this.fileBasedRecommendations.forEach((value, key) => storedRecommendations[key] = value.recommendedTime);
        this.storageService.store(recommendationsStorageKey, JSON.stringify(storedRecommendations), 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
    }
};
FileBasedRecommendations = __decorate([
    __param(0, IExtensionsWorkbenchService),
    __param(1, IModelService),
    __param(2, ILanguageService),
    __param(3, IProductService),
    __param(4, IStorageService),
    __param(5, IExtensionRecommendationNotificationService),
    __param(6, IExtensionIgnoredRecommendationsService),
    __param(7, IWorkspaceContextService),
    __param(8, IUntitledTextEditorService)
], FileBasedRecommendations);
export { FileBasedRecommendations };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmlsZUJhc2VkUmVjb21tZW5kYXRpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2V4dGVuc2lvbnMvYnJvd3Nlci9maWxlQmFzZWRSZWNvbW1lbmRhdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLHdCQUF3QixFQUFrQyxNQUFNLCtCQUErQixDQUFDO0FBRXpHLE9BQU8sRUFBaUMsdUNBQXVDLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUN2SyxPQUFPLEVBQUUsMkJBQTJCLEVBQWMsTUFBTSx5QkFBeUIsQ0FBQztBQUNsRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFnQixlQUFlLEVBQWlCLE1BQU0sZ0RBQWdELENBQUM7QUFDOUcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBSXhGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUV4RCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDNUUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDbkYsT0FBTyxFQUFFLDJDQUEyQyxFQUEyRCxNQUFNLGtGQUFrRixDQUFDO0FBQ3hNLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdkUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDRFQUE0RSxDQUFDO0FBQy9HLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUM3RixPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUU1RyxNQUFNLGlDQUFpQyxHQUFHLGtEQUFrRCxDQUFDO0FBQzdGLE1BQU0seUJBQXlCLEdBQUcscUNBQXFDLENBQUM7QUFDeEUsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUM7QUFFL0MsNEdBQTRHO0FBQzVHLE1BQU0sb0NBQW9DLEdBQUcsSUFBSSxDQUFDO0FBRTNDLElBQU0sd0JBQXdCLEdBQTlCLE1BQU0sd0JBQXlCLFNBQVEsd0JBQXdCO0lBT3JFLElBQUksZUFBZTtRQUNsQixNQUFNLGVBQWUsR0FBcUMsRUFBRSxDQUFDO1FBQzdELENBQUMsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxFQUFFLENBQUM7YUFDdkMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ2QsSUFBSSxJQUFJLENBQUMsd0JBQXdCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBRSxDQUFDLGVBQWUsS0FBSyxJQUFJLENBQUMsd0JBQXdCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBRSxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUNySCxJQUFJLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDbkQsT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDWCxDQUFDO2dCQUNELElBQUksSUFBSSxDQUFDLGlDQUFpQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO29CQUNuRCxPQUFPLENBQUMsQ0FBQztnQkFDVixDQUFDO1lBQ0YsQ0FBQztZQUNELE9BQU8sSUFBSSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUUsQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUUsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0gsQ0FBQyxDQUFDO2FBQ0QsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQ3RCLGVBQWUsQ0FBQyxJQUFJLENBQUM7Z0JBQ3BCLFNBQVMsRUFBRSxXQUFXO2dCQUN0QixNQUFNLEVBQUU7b0JBQ1AsUUFBUSw0Q0FBb0M7b0JBQzVDLFVBQVUsRUFBRSxRQUFRLENBQUMseUJBQXlCLEVBQUUsdUVBQXVFLENBQUM7aUJBQ3hIO2FBQ0QsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7UUFDSixPQUFPLGVBQWUsQ0FBQztJQUN4QixDQUFDO0lBRUQsSUFBSSx3QkFBd0I7UUFDM0IsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7SUFDbEcsQ0FBQztJQUVELElBQUksb0JBQW9CO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7SUFDbkcsQ0FBQztJQUVELFlBQzhCLDBCQUF3RSxFQUN0RixZQUE0QyxFQUN6QyxlQUFrRCxFQUNuRCxjQUErQixFQUMvQixjQUFnRCxFQUNwQiwwQ0FBd0csRUFDNUcsc0NBQWdHLEVBQy9HLHVCQUFrRSxFQUNoRSx5QkFBc0U7UUFFbEcsS0FBSyxFQUFFLENBQUM7UUFWc0MsK0JBQTBCLEdBQTFCLDBCQUEwQixDQUE2QjtRQUNyRSxpQkFBWSxHQUFaLFlBQVksQ0FBZTtRQUN4QixvQkFBZSxHQUFmLGVBQWUsQ0FBa0I7UUFFbEMsbUJBQWMsR0FBZCxjQUFjLENBQWlCO1FBQ0gsK0NBQTBDLEdBQTFDLDBDQUEwQyxDQUE2QztRQUMzRiwyQ0FBc0MsR0FBdEMsc0NBQXNDLENBQXlDO1FBQzlGLDRCQUF1QixHQUF2Qix1QkFBdUIsQ0FBMEI7UUFDL0MsOEJBQXlCLEdBQXpCLHlCQUF5QixDQUE0QjtRQS9DbEYsNkJBQXdCLEdBQUcsSUFBSSxHQUFHLEVBQW1ELENBQUM7UUFDdEYsNkJBQXdCLEdBQUcsSUFBSSxHQUFHLEVBQXVDLENBQUM7UUFDMUUsc0NBQWlDLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQWdEdEUsSUFBSSxDQUFDLHVCQUF1QixHQUFHLEVBQUUsQ0FBQztRQUNsQyxJQUFJLGNBQWMsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1lBQzdDLEtBQUssTUFBTSxDQUFDLFdBQVcsRUFBRSxjQUFjLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFLENBQUM7Z0JBQ3JHLElBQUksY0FBYyxDQUFDLFVBQVUsRUFBRSxDQUFDO29CQUMvQixJQUFJLENBQUMsdUJBQXVCLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRSxDQUFDLEdBQUcsY0FBYyxDQUFDLFVBQVUsQ0FBQztnQkFDckYsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVTLEtBQUssQ0FBQyxVQUFVO1FBQ3pCLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLENBQUM7WUFDakQsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxlQUFlLENBQUM7UUFFdEQsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztRQUM5RCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDdkIsNkhBQTZIO1FBQzdILE1BQU0sQ0FBQyxPQUFPLENBQUMscUJBQXFCLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFO1lBQzlELE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxHQUFHLGtCQUFrQixDQUFDO1lBQ2hELElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDcEQsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLEVBQUUsRUFBRSxlQUFlLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztZQUNsRixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEYsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDMUUsQ0FBQztJQUVPLFlBQVksQ0FBQyxLQUFpQjtRQUNyQyxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sS0FBSyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQztRQUM3RyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDVixPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sZ0JBQWdCLEdBQUcsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxZQUFZLEVBQUUsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsWUFBWSxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ25MLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDcEQsT0FBTztRQUNSLENBQUM7UUFFRCxpR0FBaUc7UUFDakcsaUJBQWlCLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLDhCQUE4QixDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzFGLENBQUM7SUFFRDs7O09BR0c7SUFDSyw4QkFBOEIsQ0FBQyxHQUFRLEVBQUUsS0FBaUIsRUFBRSx3QkFBa0U7UUFDckksSUFBSSxLQUFLLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQztZQUN4QixPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUMzQyx3QkFBd0IsR0FBRyx3QkFBd0IsSUFBSSxJQUFJLENBQUMsd0JBQXdCLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQztRQUNsSSxNQUFNLDhCQUE4QixHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsd0JBQXdCLENBQUMsQ0FBQztRQUNoRixJQUFJLDhCQUE4QixDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNqRCxPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxHQUFHLEVBQW1CLENBQUM7UUFDdEQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLDBCQUEwQixDQUFDLEtBQUssQ0FBQztRQUN4RCxNQUFNLHdCQUF3QixHQUE0QyxFQUFFLENBQUM7UUFDN0UsTUFBTSxzQkFBc0IsR0FBNEMsRUFBRSxDQUFDO1FBQzNFLE1BQU0sd0JBQXdCLEdBQTRDLEVBQUUsQ0FBQztRQUM3RSxJQUFJLHNCQUFzQixHQUFHLEtBQUssQ0FBQztRQUNuQyxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsYUFBYSxFQUFFLENBQUM7UUFFekMseUhBQXlIO1FBQ3pILE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDOUQsTUFBTSxrQkFBa0IsR0FDdkIsQ0FBQyxhQUFhO1lBQ2QsYUFBYSxDQUFDLHdCQUF3QjtZQUN0QyxLQUFLLENBQUMsY0FBYyxFQUFFLEdBQUcsb0NBQW9DLENBQUM7UUFFL0QsS0FBSyxNQUFNLENBQUMsV0FBVyxFQUFFLFVBQVUsQ0FBQyxJQUFJLDhCQUE4QixFQUFFLENBQUM7WUFDeEUsTUFBTSxtQkFBbUIsR0FBeUIsRUFBRSxDQUFDO1lBQ3JELE1BQU0saUJBQWlCLEdBQXlCLEVBQUUsQ0FBQztZQUNuRCxNQUFNLG1CQUFtQixHQUF5QixFQUFFLENBQUM7WUFDckQsS0FBSyxNQUFNLFNBQVMsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDcEMsSUFBSSxlQUFlLEdBQUcsS0FBSyxDQUFDO2dCQUM1QixJQUFJLGVBQWUsR0FBRyxLQUFLLENBQUM7Z0JBRTVCLE1BQU0sbUJBQW1CLEdBQUcsQ0FBQyxDQUEwQixTQUFVLENBQUMsU0FBUyxDQUFDO2dCQUM1RSxNQUFNLHNCQUFzQixHQUFHLENBQUMsQ0FBeUIsU0FBVSxDQUFDLGNBQWMsQ0FBQztnQkFDbkYsSUFBSSxtQkFBbUIsSUFBSSxzQkFBc0IsRUFBRSxDQUFDO29CQUNuRCxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQ3JDLENBQUM7Z0JBRUQsSUFBSSxtQkFBbUIsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO29CQUMvQyxJQUE2QixTQUFVLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO3dCQUN4RSxlQUFlLEdBQUcsSUFBSSxDQUFDO29CQUN4QixDQUFDO2dCQUNGLENBQUM7Z0JBRUQsTUFBTSxRQUFRLEdBQXdCLFNBQVUsQ0FBQyxRQUFRLENBQUM7Z0JBQzFELElBQUksUUFBUSxFQUFFLENBQUM7b0JBQ2QsSUFBSSxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO3dCQUN0SCxlQUFlLEdBQUcsSUFBSSxDQUFDO29CQUN4QixDQUFDO29CQUNELGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsZUFBZSxDQUFDLENBQUM7Z0JBQ25ELENBQUM7Z0JBRUQsSUFBSSxPQUFPLEdBQUcsZUFBZSxJQUFJLGVBQWUsQ0FBQztnQkFFakQsNEdBQTRHO2dCQUM1RyxJQUFJLE9BQU8sSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUN6QixTQUFTO2dCQUNWLENBQUM7Z0JBRUQsSUFBSSxPQUFPLElBQUksU0FBUyxDQUFDLGFBQWEsRUFBRSxDQUFDO29CQUN4QyxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7d0JBQ2hILE9BQU8sR0FBRyxLQUFLLENBQUM7b0JBQ2pCLENBQUM7Z0JBQ0YsQ0FBQztnQkFFRCxJQUFJLE9BQU8sSUFBSSxTQUFTLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztvQkFDM0MsSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO3dCQUNsSCxPQUFPLEdBQUcsS0FBSyxDQUFDO29CQUNqQixDQUFDO2dCQUNGLENBQUM7Z0JBRUQsSUFBSSxPQUFPLElBQUksc0JBQXNCLEVBQUUsQ0FBQztvQkFDdkMsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQXlCLFNBQVUsQ0FBQyxjQUFjLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO3dCQUNuSCxPQUFPLEdBQUcsS0FBSyxDQUFDO29CQUNqQixDQUFDO2dCQUNGLENBQUM7Z0JBRUQsSUFBSSxPQUFPLEVBQUUsQ0FBQztvQkFDYixpQkFBaUIsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7b0JBQ2xDLG1CQUFtQixDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUMzQixDQUFDO3FCQUFNLENBQUM7b0JBQ1AsSUFBSSxtQkFBbUIsSUFBSSxzQkFBc0IsRUFBRSxDQUFDO3dCQUNuRCxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7d0JBQ3BDLElBQUksbUJBQW1CLEVBQUUsQ0FBQzs0QkFDekIsc0JBQXNCLEdBQUcsSUFBSSxDQUFDO3dCQUMvQixDQUFDO29CQUNGLENBQUM7Z0JBQ0YsQ0FBQztZQUVGLENBQUM7WUFDRCxJQUFJLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUM5QixzQkFBc0IsQ0FBQyxXQUFXLENBQUMsR0FBRyxpQkFBaUIsQ0FBQztZQUN6RCxDQUFDO1lBQ0QsSUFBSSxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDaEMsd0JBQXdCLENBQUMsV0FBVyxDQUFDLEdBQUcsbUJBQW1CLENBQUM7WUFDN0QsQ0FBQztZQUNELElBQUksbUJBQW1CLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ2hDLHdCQUF3QixDQUFDLFdBQVcsQ0FBQyxHQUFHLG1CQUFtQixDQUFDO1lBQzdELENBQUM7UUFDRixDQUFDO1FBRUQsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNiLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLHdCQUF3QixDQUFDLENBQUM7UUFDdEUsQ0FBQztRQUNELElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2xELElBQUksc0JBQXNCLEVBQUUsQ0FBQztnQkFDNUIsTUFBTSxXQUFXLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztnQkFDMUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUMsR0FBRyxFQUFFO29CQUM5QyxpR0FBaUc7b0JBQ2pHLGlCQUFpQixDQUFDLEdBQUcsRUFBRTt3QkFDdEIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLEVBQUUsQ0FBQzs0QkFDN0IsSUFBSSxDQUFDLDhCQUE4QixDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsd0JBQXdCLENBQUMsQ0FBQzs0QkFDMUUsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUN2QixDQUFDO29CQUNGLENBQUMsRUFBRSxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7Z0JBQ3BCLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ0osV0FBVyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDbkUsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNoRCxJQUFJLENBQUMseUJBQXlCLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3BFLENBQUM7SUFDRixDQUFDO0lBRU8seUJBQXlCLENBQUMsR0FBUSxFQUFFLEtBQWlCLEVBQUUsd0JBQWlFO1FBQy9ILElBQUksb0NBQW9DLEdBQUcsS0FBSyxDQUFDO1FBQ2pELE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUNuRCxNQUFNLHdCQUF3QixHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFDbkQsS0FBSyxNQUFNLENBQUMsV0FBVyxFQUFFLFVBQVUsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsd0JBQXdCLENBQUMsRUFBRSxDQUFDO1lBQ2xGLEtBQUssTUFBTSxTQUFTLElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQ3BDLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDMUMsSUFBSSxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUM7b0JBQ3pCLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztvQkFDMUMsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDekQsQ0FBQztnQkFDRCxJQUE2QixTQUFVLENBQUMsU0FBUyxFQUFFLENBQUM7b0JBQ25ELG9DQUFvQyxHQUFHLElBQUksQ0FBQztnQkFDN0MsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQsb0NBQW9DO1FBQ3BDLEtBQUssTUFBTSxjQUFjLElBQUksd0JBQXdCLEVBQUUsQ0FBQztZQUN2RCxNQUFNLHdCQUF3QixHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsQ0FBQztZQUNuSSx3QkFBd0IsQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ3RELElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLHdCQUF3QixDQUFDLENBQUM7UUFDN0UsQ0FBQztRQUVELElBQUksQ0FBQywwQkFBMEIsRUFBRSxDQUFDO1FBRWxDLElBQUksSUFBSSxDQUFDLDBDQUEwQyxDQUFDLHNDQUFzQyxFQUFFLEVBQUUsQ0FBQztZQUM5RixPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUN2QyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNwRSxJQUFJLHdCQUF3QixDQUFDLElBQUk7WUFDaEMsSUFBSSxDQUFDLHFDQUFxQyxDQUFDLFlBQVksSUFBSSxvQ0FBb0MsSUFBSSxRQUFRLEtBQUsscUJBQXFCLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxHQUFHLHdCQUF3QixDQUFDLENBQUMsRUFBRSxDQUFDO1lBQy9QLE9BQU87UUFDUixDQUFDO0lBQ0YsQ0FBQztJQUVPLHFDQUFxQyxDQUFDLElBQVksRUFBRSxRQUFnQixFQUFFLGVBQXlCO1FBQ3RHLGVBQWUsR0FBRyxJQUFJLENBQUMseUJBQXlCLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDbEUsSUFBSSxlQUFlLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ2xDLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUVELGVBQWUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsMEJBQTBCLENBQUMsS0FBSyxDQUFDO2FBQzVGLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUVqRixNQUFNLHVCQUF1QixHQUFHLFFBQVEsS0FBSyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLDBCQUEwQixFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUM3SCxJQUFJLHVCQUF1QixFQUFFLENBQUM7WUFDN0IsZUFBZSxHQUFHLGVBQWUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBQ3pHLENBQUM7UUFFRCxJQUFJLGVBQWUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDbEMsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBRUQsSUFBSSxDQUFDLDRDQUE0QyxDQUFDLGVBQWUsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDbkYsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRU8sS0FBSyxDQUFDLDRDQUE0QyxDQUFDLFVBQW9CLEVBQUUsSUFBWSxFQUFFLFFBQWdCO1FBQzlHLElBQUksQ0FBQztZQUNKLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLDBDQUEwQyxDQUFDLDRDQUE0QyxDQUFDLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxNQUFNLG1DQUEyQixFQUFFLENBQUMsQ0FBQztZQUMzSyxJQUFJLE1BQU0sK0RBQStDLEVBQUUsQ0FBQztnQkFDM0QsSUFBSSxDQUFDLDRCQUE0QixDQUFDLFFBQVEsRUFBRSxVQUFVLENBQUMsQ0FBQztZQUN6RCxDQUFDO1FBQ0YsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRU8sMEJBQTBCO1FBQ2pDLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxpQ0FBaUMsZ0NBQXdCLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDM0csQ0FBQztJQUVPLDRCQUE0QixDQUFDLFFBQWdCLEVBQUUsVUFBb0I7UUFDMUUsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztRQUNsRSx1QkFBdUIsQ0FBQyxRQUFRLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQzVHLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsdUJBQXVCLENBQUMsMkRBQTJDLENBQUM7SUFDakosQ0FBQztJQUVPLHlCQUF5QixDQUFDLHdCQUFrQztRQUNuRSxNQUFNLHNCQUFzQixHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsc0NBQXNDLENBQUMsc0JBQXNCLEVBQUUsR0FBRyxJQUFJLENBQUMsMENBQTBDLENBQUMsc0JBQXNCLENBQUMsQ0FBQztRQUNsTCxPQUFPLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsc0JBQXNCLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDcEYsQ0FBQztJQUVPLGVBQWUsQ0FBQyx3QkFBa0MsRUFBRSxTQUF1QjtRQUNsRixNQUFNLHNCQUFzQixHQUFHLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDN0QsSUFBSSxDQUFDLENBQUMsZUFBZSxvREFBNEMsRUFBRSxDQUFDO2dCQUNuRSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7WUFDM0MsQ0FBQztZQUNELE9BQU8sTUFBTSxDQUFDO1FBQ2YsQ0FBQyxFQUFFLElBQUksR0FBRyxFQUFVLENBQUMsQ0FBQztRQUN0QixPQUFPLHdCQUF3QixDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsc0JBQXNCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDN0YsQ0FBQztJQUVPLHdCQUF3QjtRQUMvQixJQUFJLHFCQUFxQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMseUJBQXlCLGdDQUF3QixJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3ZILElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFLENBQUM7WUFDMUMscUJBQXFCLEdBQUcscUJBQXFCLENBQUMsTUFBTSxDQUE0QixDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHLE1BQU0sQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNsSixDQUFDO1FBQ0QsTUFBTSxNQUFNLEdBQThCLEVBQUUsQ0FBQztRQUM3QyxNQUFNLENBQUMsT0FBTyxDQUFDLHFCQUFxQixDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRTtZQUM5RCxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUMvQixNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDO1lBQ25DLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztRQUNILE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQUVPLDBCQUEwQjtRQUNqQyxNQUFNLHFCQUFxQixHQUE4QixFQUFFLENBQUM7UUFDNUQsSUFBSSxDQUFDLHdCQUF3QixDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUMxRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLDhEQUE4QyxDQUFDO0lBQzFJLENBQUM7Q0FDRCxDQUFBO0FBeFZZLHdCQUF3QjtJQTBDbEMsV0FBQSwyQkFBMkIsQ0FBQTtJQUMzQixXQUFBLGFBQWEsQ0FBQTtJQUNiLFdBQUEsZ0JBQWdCLENBQUE7SUFDaEIsV0FBQSxlQUFlLENBQUE7SUFDZixXQUFBLGVBQWUsQ0FBQTtJQUNmLFdBQUEsMkNBQTJDLENBQUE7SUFDM0MsV0FBQSx1Q0FBdUMsQ0FBQTtJQUN2QyxXQUFBLHdCQUF3QixDQUFBO0lBQ3hCLFdBQUEsMEJBQTBCLENBQUE7R0FsRGhCLHdCQUF3QixDQXdWcEMifQ==