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
var LanguageDetectionService_1;
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILanguageDetectionService, LanguageDetectionStatsId } from '../common/languageDetectionWorkerService.js';
import { FileAccess, nodeModulesAsarPath, nodeModulesPath, Schemas } from '../../../../base/common/network.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { URI } from '../../../../base/common/uri.js';
import { isWeb } from '../../../../base/common/platform.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IDiagnosticsService } from '../../../../platform/diagnostics/common/diagnostics.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IEditorService } from '../../editor/common/editorService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { LRUCache } from '../../../../base/common/map.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { canASAR } from '../../../../amdX.js';
import { WebWorkerDescriptor } from '../../../../platform/webWorker/browser/webWorkerDescriptor.js';
import { IWebWorkerService } from '../../../../platform/webWorker/browser/webWorkerService.js';
import { WorkerTextModelSyncClient } from '../../../../editor/common/services/textModelSync/textModelSync.impl.js';
import { LanguageDetectionWorkerHost } from './languageDetectionWorker.protocol.js';
const TOP_LANG_COUNTS = 12;
const regexpModuleLocation = `${nodeModulesPath}/vscode-regexp-languagedetection`;
const regexpModuleLocationAsar = `${nodeModulesAsarPath}/vscode-regexp-languagedetection`;
const moduleLocation = `${nodeModulesPath}/@vscode/vscode-languagedetection`;
const moduleLocationAsar = `${nodeModulesAsarPath}/@vscode/vscode-languagedetection`;
let LanguageDetectionService = class LanguageDetectionService extends Disposable {
    static { LanguageDetectionService_1 = this; }
    static { this.enablementSettingKey = 'workbench.editor.languageDetection'; }
    static { this.historyBasedEnablementConfig = 'workbench.editor.historyBasedLanguageDetection'; }
    static { this.preferHistoryConfig = 'workbench.editor.preferHistoryBasedLanguageDetection'; }
    static { this.workspaceOpenedLanguagesStorageKey = 'workbench.editor.languageDetectionOpenedLanguages.workspace'; }
    static { this.globalOpenedLanguagesStorageKey = 'workbench.editor.languageDetectionOpenedLanguages.global'; }
    constructor(_environmentService, languageService, _configurationService, _diagnosticsService, _workspaceContextService, modelService, _editorService, telemetryService, storageService, _logService, webWorkerService) {
        super();
        this._environmentService = _environmentService;
        this._configurationService = _configurationService;
        this._diagnosticsService = _diagnosticsService;
        this._workspaceContextService = _workspaceContextService;
        this._editorService = _editorService;
        this._logService = _logService;
        this.hasResolvedWorkspaceLanguageIds = false;
        this.workspaceLanguageIds = new Set();
        this.sessionOpenedLanguageIds = new Set();
        this.historicalGlobalOpenedLanguageIds = new LRUCache(TOP_LANG_COUNTS);
        this.historicalWorkspaceOpenedLanguageIds = new LRUCache(TOP_LANG_COUNTS);
        this.dirtyBiases = true;
        this.langBiases = {};
        const useAsar = canASAR && this._environmentService.isBuilt && !isWeb;
        this._languageDetectionWorkerClient = this._register(new LanguageDetectionWorkerClient(modelService, languageService, telemetryService, webWorkerService, 
        // TODO See if it's possible to bundle vscode-languagedetection
        useAsar
            ? FileAccess.asBrowserUri(`${moduleLocationAsar}/dist/lib/index.js`).toString(true)
            : FileAccess.asBrowserUri(`${moduleLocation}/dist/lib/index.js`).toString(true), useAsar
            ? FileAccess.asBrowserUri(`${moduleLocationAsar}/model/model.json`).toString(true)
            : FileAccess.asBrowserUri(`${moduleLocation}/model/model.json`).toString(true), useAsar
            ? FileAccess.asBrowserUri(`${moduleLocationAsar}/model/group1-shard1of1.bin`).toString(true)
            : FileAccess.asBrowserUri(`${moduleLocation}/model/group1-shard1of1.bin`).toString(true), useAsar
            ? FileAccess.asBrowserUri(`${regexpModuleLocationAsar}/dist/index.js`).toString(true)
            : FileAccess.asBrowserUri(`${regexpModuleLocation}/dist/index.js`).toString(true)));
        this.initEditorOpenedListeners(storageService);
    }
    async resolveWorkspaceLanguageIds() {
        if (this.hasResolvedWorkspaceLanguageIds) {
            return;
        }
        this.hasResolvedWorkspaceLanguageIds = true;
        const fileExtensions = await this._diagnosticsService.getWorkspaceFileExtensions(this._workspaceContextService.getWorkspace());
        let count = 0;
        for (const ext of fileExtensions.extensions) {
            const langId = this._languageDetectionWorkerClient.getLanguageId(ext);
            if (langId && count < TOP_LANG_COUNTS) {
                this.workspaceLanguageIds.add(langId);
                count++;
                if (count > TOP_LANG_COUNTS) {
                    break;
                }
            }
        }
        this.dirtyBiases = true;
    }
    isEnabledForLanguage(languageId) {
        return !!languageId && this._configurationService.getValue(LanguageDetectionService_1.enablementSettingKey, { overrideIdentifier: languageId });
    }
    getLanguageBiases() {
        if (!this.dirtyBiases) {
            return this.langBiases;
        }
        const biases = {};
        // Give different weight to the biases depending on relevance of source
        this.sessionOpenedLanguageIds.forEach(lang => biases[lang] = (biases[lang] ?? 0) + 7);
        this.workspaceLanguageIds.forEach(lang => biases[lang] = (biases[lang] ?? 0) + 5);
        [...this.historicalWorkspaceOpenedLanguageIds.keys()].forEach(lang => biases[lang] = (biases[lang] ?? 0) + 3);
        [...this.historicalGlobalOpenedLanguageIds.keys()].forEach(lang => biases[lang] = (biases[lang] ?? 0) + 1);
        this._logService.trace('Session Languages:', JSON.stringify([...this.sessionOpenedLanguageIds]));
        this._logService.trace('Workspace Languages:', JSON.stringify([...this.workspaceLanguageIds]));
        this._logService.trace('Historical Workspace Opened Languages:', JSON.stringify([...this.historicalWorkspaceOpenedLanguageIds.keys()]));
        this._logService.trace('Historical Globally Opened Languages:', JSON.stringify([...this.historicalGlobalOpenedLanguageIds.keys()]));
        this._logService.trace('Computed Language Detection Biases:', JSON.stringify(biases));
        this.dirtyBiases = false;
        this.langBiases = biases;
        return biases;
    }
    async detectLanguage(resource, supportedLangs) {
        const useHistory = this._configurationService.getValue(LanguageDetectionService_1.historyBasedEnablementConfig);
        const preferHistory = this._configurationService.getValue(LanguageDetectionService_1.preferHistoryConfig);
        if (useHistory) {
            await this.resolveWorkspaceLanguageIds();
        }
        const biases = useHistory ? this.getLanguageBiases() : undefined;
        return this._languageDetectionWorkerClient.detectLanguage(resource, biases, preferHistory, supportedLangs);
    }
    // TODO: explore using the history service or something similar to provide this list of opened editors
    // so this service can support delayed instantiation. This may be tricky since it seems the IHistoryService
    // only gives history for a workspace... where this takes advantage of history at a global level as well.
    initEditorOpenedListeners(storageService) {
        try {
            const globalLangHistoryData = JSON.parse(storageService.get(LanguageDetectionService_1.globalOpenedLanguagesStorageKey, 0 /* StorageScope.PROFILE */, '[]'));
            this.historicalGlobalOpenedLanguageIds.fromJSON(globalLangHistoryData);
        }
        catch (e) {
            console.error(e);
        }
        try {
            const workspaceLangHistoryData = JSON.parse(storageService.get(LanguageDetectionService_1.workspaceOpenedLanguagesStorageKey, 1 /* StorageScope.WORKSPACE */, '[]'));
            this.historicalWorkspaceOpenedLanguageIds.fromJSON(workspaceLangHistoryData);
        }
        catch (e) {
            console.error(e);
        }
        this._register(this._editorService.onDidActiveEditorChange(() => {
            const activeLanguage = this._editorService.activeTextEditorLanguageId;
            if (activeLanguage && this._editorService.activeEditor?.resource?.scheme !== Schemas.untitled) {
                this.sessionOpenedLanguageIds.add(activeLanguage);
                this.historicalGlobalOpenedLanguageIds.set(activeLanguage, true);
                this.historicalWorkspaceOpenedLanguageIds.set(activeLanguage, true);
                storageService.store(LanguageDetectionService_1.globalOpenedLanguagesStorageKey, JSON.stringify(this.historicalGlobalOpenedLanguageIds.toJSON()), 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
                storageService.store(LanguageDetectionService_1.workspaceOpenedLanguagesStorageKey, JSON.stringify(this.historicalWorkspaceOpenedLanguageIds.toJSON()), 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
                this.dirtyBiases = true;
            }
        }));
    }
};
LanguageDetectionService = LanguageDetectionService_1 = __decorate([
    __param(0, IWorkbenchEnvironmentService),
    __param(1, ILanguageService),
    __param(2, IConfigurationService),
    __param(3, IDiagnosticsService),
    __param(4, IWorkspaceContextService),
    __param(5, IModelService),
    __param(6, IEditorService),
    __param(7, ITelemetryService),
    __param(8, IStorageService),
    __param(9, ILogService),
    __param(10, IWebWorkerService)
], LanguageDetectionService);
export { LanguageDetectionService };
export class LanguageDetectionWorkerClient extends Disposable {
    constructor(_modelService, _languageService, _telemetryService, _webWorkerService, _indexJsUri, _modelJsonUri, _weightsUri, _regexpModelUri) {
        super();
        this._modelService = _modelService;
        this._languageService = _languageService;
        this._telemetryService = _telemetryService;
        this._webWorkerService = _webWorkerService;
        this._indexJsUri = _indexJsUri;
        this._modelJsonUri = _modelJsonUri;
        this._weightsUri = _weightsUri;
        this._regexpModelUri = _regexpModelUri;
    }
    _getOrCreateLanguageDetectionWorker() {
        if (!this.worker) {
            const workerClient = this._register(this._webWorkerService.createWorkerClient(new WebWorkerDescriptor({
                esmModuleLocation: FileAccess.asBrowserUri('vs/workbench/services/languageDetection/browser/languageDetectionWebWorkerMain.js'),
                label: 'LanguageDetectionWorker'
            })));
            LanguageDetectionWorkerHost.setChannel(workerClient, {
                $getIndexJsUri: async () => this.getIndexJsUri(),
                $getLanguageId: async (languageIdOrExt) => this.getLanguageId(languageIdOrExt),
                $sendTelemetryEvent: async (languages, confidences, timeSpent) => this.sendTelemetryEvent(languages, confidences, timeSpent),
                $getRegexpModelUri: async () => this.getRegexpModelUri(),
                $getModelJsonUri: async () => this.getModelJsonUri(),
                $getWeightsUri: async () => this.getWeightsUri(),
            });
            const workerTextModelSyncClient = this._register(WorkerTextModelSyncClient.create(workerClient, this._modelService));
            this.worker = { workerClient, workerTextModelSyncClient };
        }
        return this.worker;
    }
    _guessLanguageIdByUri(uri) {
        const guess = this._languageService.guessLanguageIdByFilepathOrFirstLine(uri);
        if (guess && guess !== 'unknown') {
            return guess;
        }
        return undefined;
    }
    async getIndexJsUri() {
        return this._indexJsUri;
    }
    getLanguageId(languageIdOrExt) {
        if (!languageIdOrExt) {
            return undefined;
        }
        if (this._languageService.isRegisteredLanguageId(languageIdOrExt)) {
            return languageIdOrExt;
        }
        const guessed = this._guessLanguageIdByUri(URI.file(`file.${languageIdOrExt}`));
        if (!guessed || guessed === 'unknown') {
            return undefined;
        }
        return guessed;
    }
    async getModelJsonUri() {
        return this._modelJsonUri;
    }
    async getWeightsUri() {
        return this._weightsUri;
    }
    async getRegexpModelUri() {
        return this._regexpModelUri;
    }
    async sendTelemetryEvent(languages, confidences, timeSpent) {
        this._telemetryService.publicLog2(LanguageDetectionStatsId, {
            languages: languages.join(','),
            confidences: confidences.join(','),
            timeSpent
        });
    }
    async detectLanguage(resource, langBiases, preferHistory, supportedLangs) {
        const startTime = Date.now();
        const quickGuess = this._guessLanguageIdByUri(resource);
        if (quickGuess) {
            return quickGuess;
        }
        const { workerClient, workerTextModelSyncClient } = this._getOrCreateLanguageDetectionWorker();
        workerTextModelSyncClient.ensureSyncedResources([resource]);
        const modelId = await workerClient.proxy.$detectLanguage(resource.toString(), langBiases, preferHistory, supportedLangs);
        const languageId = this.getLanguageId(modelId);
        const LanguageDetectionStatsId = 'automaticlanguagedetection.perf';
        this._telemetryService.publicLog2(LanguageDetectionStatsId, {
            timeSpent: Date.now() - startTime,
            detection: languageId || 'unknown',
        });
        return languageId;
    }
}
// For now we use Eager until we handle keeping track of history better.
registerSingleton(ILanguageDetectionService, LanguageDetectionService, 0 /* InstantiationType.Eager */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFuZ3VhZ2VEZXRlY3Rpb25Xb3JrZXJTZXJ2aWNlSW1wbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvbGFuZ3VhZ2VEZXRlY3Rpb24vYnJvd3Nlci9sYW5ndWFnZURldGVjdGlvbldvcmtlclNlcnZpY2VJbXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFFLHlCQUF5QixFQUFpRSx3QkFBd0IsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ2pMLE9BQU8sRUFBbUIsVUFBVSxFQUFFLG1CQUFtQixFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNoSSxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUM5RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUNuRixPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzVELE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFNUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDdkYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDN0YsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDOUYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sZ0RBQWdELENBQUM7QUFDOUcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDOUMsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDcEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDL0YsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sd0VBQXdFLENBQUM7QUFDbkgsT0FBTyxFQUE0QiwyQkFBMkIsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBRTlHLE1BQU0sZUFBZSxHQUFHLEVBQUUsQ0FBQztBQUUzQixNQUFNLG9CQUFvQixHQUFvQixHQUFHLGVBQWUsa0NBQWtDLENBQUM7QUFDbkcsTUFBTSx3QkFBd0IsR0FBb0IsR0FBRyxtQkFBbUIsa0NBQWtDLENBQUM7QUFDM0csTUFBTSxjQUFjLEdBQW9CLEdBQUcsZUFBZSxtQ0FBbUMsQ0FBQztBQUM5RixNQUFNLGtCQUFrQixHQUFvQixHQUFHLG1CQUFtQixtQ0FBbUMsQ0FBQztBQUUvRixJQUFNLHdCQUF3QixHQUE5QixNQUFNLHdCQUF5QixTQUFRLFVBQVU7O2FBQ3ZDLHlCQUFvQixHQUFHLG9DQUFvQyxBQUF2QyxDQUF3QzthQUM1RCxpQ0FBNEIsR0FBRyxnREFBZ0QsQUFBbkQsQ0FBb0Q7YUFDaEYsd0JBQW1CLEdBQUcsc0RBQXNELEFBQXpELENBQTBEO2FBQzdFLHVDQUFrQyxHQUFHLDZEQUE2RCxBQUFoRSxDQUFpRTthQUNuRyxvQ0FBK0IsR0FBRywwREFBMEQsQUFBN0QsQ0FBOEQ7SUFjN0csWUFDK0IsbUJBQWtFLEVBQzlFLGVBQWlDLEVBQzVCLHFCQUE2RCxFQUMvRCxtQkFBeUQsRUFDcEQsd0JBQW1FLEVBQzlFLFlBQTJCLEVBQzFCLGNBQStDLEVBQzVDLGdCQUFtQyxFQUNyQyxjQUErQixFQUNuQyxXQUF5QyxFQUNuQyxnQkFBbUM7UUFFdEQsS0FBSyxFQUFFLENBQUM7UUFadUMsd0JBQW1CLEdBQW5CLG1CQUFtQixDQUE4QjtRQUV4RCwwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO1FBQzlDLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBcUI7UUFDbkMsNkJBQXdCLEdBQXhCLHdCQUF3QixDQUEwQjtRQUU1RCxtQkFBYyxHQUFkLGNBQWMsQ0FBZ0I7UUFHakMsZ0JBQVcsR0FBWCxXQUFXLENBQWE7UUFsQi9DLG9DQUErQixHQUFHLEtBQUssQ0FBQztRQUN4Qyx5QkFBb0IsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO1FBQ3pDLDZCQUF3QixHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFDN0Msc0NBQWlDLEdBQUcsSUFBSSxRQUFRLENBQWUsZUFBZSxDQUFDLENBQUM7UUFDaEYseUNBQW9DLEdBQUcsSUFBSSxRQUFRLENBQWUsZUFBZSxDQUFDLENBQUM7UUFDbkYsZ0JBQVcsR0FBWSxJQUFJLENBQUM7UUFDNUIsZUFBVSxHQUEyQixFQUFFLENBQUM7UUFpQi9DLE1BQU0sT0FBTyxHQUFHLE9BQU8sSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQ3RFLElBQUksQ0FBQyw4QkFBOEIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksNkJBQTZCLENBQ3JGLFlBQVksRUFDWixlQUFlLEVBQ2YsZ0JBQWdCLEVBQ2hCLGdCQUFnQjtRQUNoQiwrREFBK0Q7UUFDL0QsT0FBTztZQUNOLENBQUMsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLEdBQUcsa0JBQWtCLG9CQUFvQixDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztZQUNuRixDQUFDLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxHQUFHLGNBQWMsb0JBQW9CLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQ2hGLE9BQU87WUFDTixDQUFDLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxHQUFHLGtCQUFrQixtQkFBbUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUM7WUFDbEYsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsR0FBRyxjQUFjLG1CQUFtQixDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUMvRSxPQUFPO1lBQ04sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsR0FBRyxrQkFBa0IsNkJBQTZCLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDO1lBQzVGLENBQUMsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLEdBQUcsY0FBYyw2QkFBNkIsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFDekYsT0FBTztZQUNOLENBQUMsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLEdBQUcsd0JBQXdCLGdCQUFnQixDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztZQUNyRixDQUFDLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxHQUFHLG9CQUFvQixnQkFBZ0IsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FDbEYsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHlCQUF5QixDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ2hELENBQUM7SUFFTyxLQUFLLENBQUMsMkJBQTJCO1FBQ3hDLElBQUksSUFBSSxDQUFDLCtCQUErQixFQUFFLENBQUM7WUFBQyxPQUFPO1FBQUMsQ0FBQztRQUNyRCxJQUFJLENBQUMsK0JBQStCLEdBQUcsSUFBSSxDQUFDO1FBQzVDLE1BQU0sY0FBYyxHQUFHLE1BQU0sSUFBSSxDQUFDLG1CQUFtQixDQUFDLDBCQUEwQixDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO1FBRS9ILElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztRQUNkLEtBQUssTUFBTSxHQUFHLElBQUksY0FBYyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQzdDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDdEUsSUFBSSxNQUFNLElBQUksS0FBSyxHQUFHLGVBQWUsRUFBRSxDQUFDO2dCQUN2QyxJQUFJLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUN0QyxLQUFLLEVBQUUsQ0FBQztnQkFDUixJQUFJLEtBQUssR0FBRyxlQUFlLEVBQUUsQ0FBQztvQkFBQyxNQUFNO2dCQUFDLENBQUM7WUFDeEMsQ0FBQztRQUNGLENBQUM7UUFDRCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztJQUN6QixDQUFDO0lBRU0sb0JBQW9CLENBQUMsVUFBa0I7UUFDN0MsT0FBTyxDQUFDLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQVUsMEJBQXdCLENBQUMsb0JBQW9CLEVBQUUsRUFBRSxrQkFBa0IsRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO0lBQ3hKLENBQUM7SUFHTyxpQkFBaUI7UUFDeEIsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUFDLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUFDLENBQUM7UUFFbEQsTUFBTSxNQUFNLEdBQTJCLEVBQUUsQ0FBQztRQUUxQyx1RUFBdUU7UUFDdkUsSUFBSSxDQUFDLHdCQUF3QixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUM1QyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFFekMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUN4QyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFFekMsQ0FBQyxHQUFHLElBQUksQ0FBQyxvQ0FBb0MsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUNwRSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFFekMsQ0FBQyxHQUFHLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUNqRSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFFekMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pHLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLHNCQUFzQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvRixJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyx3Q0FBd0MsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsb0NBQW9DLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEksSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsdUNBQXVDLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BJLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLHFDQUFxQyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUN0RixJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQztRQUN6QixJQUFJLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQztRQUN6QixPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFFRCxLQUFLLENBQUMsY0FBYyxDQUFDLFFBQWEsRUFBRSxjQUF5QjtRQUM1RCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxDQUFXLDBCQUF3QixDQUFDLDRCQUE0QixDQUFDLENBQUM7UUFDeEgsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBVSwwQkFBd0IsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ2pILElBQUksVUFBVSxFQUFFLENBQUM7WUFDaEIsTUFBTSxJQUFJLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztRQUMxQyxDQUFDO1FBQ0QsTUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ2pFLE9BQU8sSUFBSSxDQUFDLDhCQUE4QixDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxjQUFjLENBQUMsQ0FBQztJQUM1RyxDQUFDO0lBRUQsc0dBQXNHO0lBQ3RHLDJHQUEyRztJQUMzRyx5R0FBeUc7SUFDakcseUJBQXlCLENBQUMsY0FBK0I7UUFDaEUsSUFBSSxDQUFDO1lBQ0osTUFBTSxxQkFBcUIsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsMEJBQXdCLENBQUMsK0JBQStCLGdDQUF3QixJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ25KLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxRQUFRLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUN4RSxDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFBQyxDQUFDO1FBRWpDLElBQUksQ0FBQztZQUNKLE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLDBCQUF3QixDQUFDLGtDQUFrQyxrQ0FBMEIsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUMzSixJQUFJLENBQUMsb0NBQW9DLENBQUMsUUFBUSxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFDOUUsQ0FBQztRQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQUMsQ0FBQztRQUVqQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsdUJBQXVCLENBQUMsR0FBRyxFQUFFO1lBQy9ELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsMEJBQTBCLENBQUM7WUFDdEUsSUFBSSxjQUFjLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsUUFBUSxFQUFFLE1BQU0sS0FBSyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQy9GLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7Z0JBQ2xELElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNqRSxJQUFJLENBQUMsb0NBQW9DLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDcEUsY0FBYyxDQUFDLEtBQUssQ0FBQywwQkFBd0IsQ0FBQywrQkFBK0IsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyw4REFBOEMsQ0FBQztnQkFDN0wsY0FBYyxDQUFDLEtBQUssQ0FBQywwQkFBd0IsQ0FBQyxrQ0FBa0MsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxvQ0FBb0MsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxnRUFBZ0QsQ0FBQztnQkFDck0sSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7WUFDekIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDOztBQS9JVyx3QkFBd0I7SUFvQmxDLFdBQUEsNEJBQTRCLENBQUE7SUFDNUIsV0FBQSxnQkFBZ0IsQ0FBQTtJQUNoQixXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEsbUJBQW1CLENBQUE7SUFDbkIsV0FBQSx3QkFBd0IsQ0FBQTtJQUN4QixXQUFBLGFBQWEsQ0FBQTtJQUNiLFdBQUEsY0FBYyxDQUFBO0lBQ2QsV0FBQSxpQkFBaUIsQ0FBQTtJQUNqQixXQUFBLGVBQWUsQ0FBQTtJQUNmLFdBQUEsV0FBVyxDQUFBO0lBQ1gsWUFBQSxpQkFBaUIsQ0FBQTtHQTlCUCx3QkFBd0IsQ0FnSnBDOztBQUVELE1BQU0sT0FBTyw2QkFBOEIsU0FBUSxVQUFVO0lBTTVELFlBQ2tCLGFBQTRCLEVBQzVCLGdCQUFrQyxFQUNsQyxpQkFBb0MsRUFDcEMsaUJBQW9DLEVBQ3BDLFdBQW1CLEVBQ25CLGFBQXFCLEVBQ3JCLFdBQW1CLEVBQ25CLGVBQXVCO1FBRXhDLEtBQUssRUFBRSxDQUFDO1FBVFMsa0JBQWEsR0FBYixhQUFhLENBQWU7UUFDNUIscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFrQjtRQUNsQyxzQkFBaUIsR0FBakIsaUJBQWlCLENBQW1CO1FBQ3BDLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBbUI7UUFDcEMsZ0JBQVcsR0FBWCxXQUFXLENBQVE7UUFDbkIsa0JBQWEsR0FBYixhQUFhLENBQVE7UUFDckIsZ0JBQVcsR0FBWCxXQUFXLENBQVE7UUFDbkIsb0JBQWUsR0FBZixlQUFlLENBQVE7SUFHekMsQ0FBQztJQUVPLG1DQUFtQztRQUkxQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2xCLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGtCQUFrQixDQUM1RSxJQUFJLG1CQUFtQixDQUFDO2dCQUN2QixpQkFBaUIsRUFBRSxVQUFVLENBQUMsWUFBWSxDQUFDLG1GQUFtRixDQUFDO2dCQUMvSCxLQUFLLEVBQUUseUJBQXlCO2FBQ2hDLENBQUMsQ0FDRixDQUFDLENBQUM7WUFDSCwyQkFBMkIsQ0FBQyxVQUFVLENBQUMsWUFBWSxFQUFFO2dCQUNwRCxjQUFjLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFO2dCQUNoRCxjQUFjLEVBQUUsS0FBSyxFQUFFLGVBQWUsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUM7Z0JBQzlFLG1CQUFtQixFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDO2dCQUM1SCxrQkFBa0IsRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtnQkFDeEQsZ0JBQWdCLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFO2dCQUNwRCxjQUFjLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFO2FBQ2hELENBQUMsQ0FBQztZQUNILE1BQU0seUJBQXlCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyx5QkFBeUIsQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1lBQ3JILElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxZQUFZLEVBQUUseUJBQXlCLEVBQUUsQ0FBQztRQUMzRCxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3BCLENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxHQUFRO1FBQ3JDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxvQ0FBb0MsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM5RSxJQUFJLEtBQUssSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDbEMsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVELEtBQUssQ0FBQyxhQUFhO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQztJQUN6QixDQUFDO0lBRUQsYUFBYSxDQUFDLGVBQW1DO1FBQ2hELElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUN0QixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBQ0QsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQztZQUNuRSxPQUFPLGVBQWUsQ0FBQztRQUN4QixDQUFDO1FBQ0QsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDaEYsSUFBSSxDQUFDLE9BQU8sSUFBSSxPQUFPLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDdkMsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUNELE9BQU8sT0FBTyxDQUFDO0lBQ2hCLENBQUM7SUFFRCxLQUFLLENBQUMsZUFBZTtRQUNwQixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUM7SUFDM0IsQ0FBQztJQUVELEtBQUssQ0FBQyxhQUFhO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQztJQUN6QixDQUFDO0lBRUQsS0FBSyxDQUFDLGlCQUFpQjtRQUN0QixPQUFPLElBQUksQ0FBQyxlQUFlLENBQUM7SUFDN0IsQ0FBQztJQUVELEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxTQUFtQixFQUFFLFdBQXFCLEVBQUUsU0FBaUI7UUFDckYsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBZ0Usd0JBQXdCLEVBQUU7WUFDMUgsU0FBUyxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO1lBQzlCLFdBQVcsRUFBRSxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztZQUNsQyxTQUFTO1NBQ1QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVNLEtBQUssQ0FBQyxjQUFjLENBQUMsUUFBYSxFQUFFLFVBQThDLEVBQUUsYUFBc0IsRUFBRSxjQUF5QjtRQUMzSSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDN0IsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3hELElBQUksVUFBVSxFQUFFLENBQUM7WUFDaEIsT0FBTyxVQUFVLENBQUM7UUFDbkIsQ0FBQztRQUVELE1BQU0sRUFBRSxZQUFZLEVBQUUseUJBQXlCLEVBQUUsR0FBRyxJQUFJLENBQUMsbUNBQW1DLEVBQUUsQ0FBQztRQUMvRix5QkFBeUIsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDNUQsTUFBTSxPQUFPLEdBQUcsTUFBTSxZQUFZLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUN6SCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRS9DLE1BQU0sd0JBQXdCLEdBQUcsaUNBQWlDLENBQUM7UUFjbkUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBOEQsd0JBQXdCLEVBQUU7WUFDeEgsU0FBUyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxTQUFTO1lBQ2pDLFNBQVMsRUFBRSxVQUFVLElBQUksU0FBUztTQUNsQyxDQUFDLENBQUM7UUFFSCxPQUFPLFVBQVUsQ0FBQztJQUNuQixDQUFDO0NBQ0Q7QUFFRCx3RUFBd0U7QUFDeEUsaUJBQWlCLENBQUMseUJBQXlCLEVBQUUsd0JBQXdCLGtDQUEwQixDQUFDIn0=