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
var ThreadedBackgroundTokenizerFactory_1;
import { canASAR } from '../../../../../amdX.js';
import { DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { FileAccess, nodeModulesAsarPath, nodeModulesPath } from '../../../../../base/common/network.js';
import { isWeb } from '../../../../../base/common/platform.js';
import { URI } from '../../../../../base/common/uri.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { IExtensionResourceLoaderService } from '../../../../../platform/extensionResourceLoader/common/extensionResourceLoader.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { TextMateWorkerHost } from './worker/textMateWorkerHost.js';
import { TextMateWorkerTokenizerController } from './textMateWorkerTokenizerController.js';
import { WebWorkerDescriptor } from '../../../../../platform/webWorker/browser/webWorkerDescriptor.js';
import { IWebWorkerService } from '../../../../../platform/webWorker/browser/webWorkerService.js';
let ThreadedBackgroundTokenizerFactory = class ThreadedBackgroundTokenizerFactory {
    static { ThreadedBackgroundTokenizerFactory_1 = this; }
    static { this._reportedMismatchingTokens = false; }
    constructor(_reportTokenizationTime, _shouldTokenizeAsync, _extensionResourceLoaderService, _configurationService, _languageService, _environmentService, _notificationService, _telemetryService, _webWorkerService) {
        this._reportTokenizationTime = _reportTokenizationTime;
        this._shouldTokenizeAsync = _shouldTokenizeAsync;
        this._extensionResourceLoaderService = _extensionResourceLoaderService;
        this._configurationService = _configurationService;
        this._languageService = _languageService;
        this._environmentService = _environmentService;
        this._notificationService = _notificationService;
        this._telemetryService = _telemetryService;
        this._webWorkerService = _webWorkerService;
        this._workerProxyPromise = null;
        this._worker = null;
        this._workerProxy = null;
        this._workerTokenizerControllers = new Map();
        this._currentTheme = null;
        this._currentTokenColorMap = null;
        this._grammarDefinitions = [];
    }
    dispose() {
        this._disposeWorker();
    }
    // Will be recreated after worker is disposed (because tokenizer is re-registered when languages change)
    createBackgroundTokenizer(textModel, tokenStore, maxTokenizationLineLength) {
        // fallback to default sync background tokenizer
        if (!this._shouldTokenizeAsync() || textModel.isTooLargeForSyncing()) {
            return undefined;
        }
        const store = new DisposableStore();
        const controllerContainer = this._getWorkerProxy().then((workerProxy) => {
            if (store.isDisposed || !workerProxy) {
                return undefined;
            }
            const controllerContainer = { controller: undefined, worker: this._worker };
            store.add(keepAliveWhenAttached(textModel, () => {
                const controller = new TextMateWorkerTokenizerController(textModel, workerProxy, this._languageService.languageIdCodec, tokenStore, this._configurationService, maxTokenizationLineLength);
                controllerContainer.controller = controller;
                this._workerTokenizerControllers.set(controller.controllerId, controller);
                return toDisposable(() => {
                    controllerContainer.controller = undefined;
                    this._workerTokenizerControllers.delete(controller.controllerId);
                    controller.dispose();
                });
            }));
            return controllerContainer;
        });
        return {
            dispose() {
                store.dispose();
            },
            requestTokens: async (startLineNumber, endLineNumberExclusive) => {
                const container = await controllerContainer;
                // If there is no controller, the model has been detached in the meantime.
                // Only request the proxy object if the worker is the same!
                if (container?.controller && container.worker === this._worker) {
                    container.controller.requestTokens(startLineNumber, endLineNumberExclusive);
                }
            },
            reportMismatchingTokens: (lineNumber) => {
                if (ThreadedBackgroundTokenizerFactory_1._reportedMismatchingTokens) {
                    return;
                }
                ThreadedBackgroundTokenizerFactory_1._reportedMismatchingTokens = true;
                this._notificationService.error({
                    message: 'Async Tokenization Token Mismatch in line ' + lineNumber,
                    name: 'Async Tokenization Token Mismatch',
                });
                this._telemetryService.publicLog2('asyncTokenizationMismatchingTokens', {});
            },
        };
    }
    setGrammarDefinitions(grammarDefinitions) {
        this._grammarDefinitions = grammarDefinitions;
        this._disposeWorker();
    }
    acceptTheme(theme, colorMap) {
        this._currentTheme = theme;
        this._currentTokenColorMap = colorMap;
        if (this._currentTheme && this._currentTokenColorMap && this._workerProxy) {
            this._workerProxy.$acceptTheme(this._currentTheme, this._currentTokenColorMap);
        }
    }
    _getWorkerProxy() {
        if (!this._workerProxyPromise) {
            this._workerProxyPromise = this._createWorkerProxy();
        }
        return this._workerProxyPromise;
    }
    async _createWorkerProxy() {
        const onigurumaModuleLocation = `${nodeModulesPath}/vscode-oniguruma`;
        const onigurumaModuleLocationAsar = `${nodeModulesAsarPath}/vscode-oniguruma`;
        const useAsar = canASAR && this._environmentService.isBuilt && !isWeb;
        const onigurumaLocation = useAsar ? onigurumaModuleLocationAsar : onigurumaModuleLocation;
        const onigurumaWASM = `${onigurumaLocation}/release/onig.wasm`;
        const createData = {
            grammarDefinitions: this._grammarDefinitions,
            onigurumaWASMUri: FileAccess.asBrowserUri(onigurumaWASM).toString(true),
        };
        const worker = this._worker = this._webWorkerService.createWorkerClient(new WebWorkerDescriptor({
            esmModuleLocation: FileAccess.asBrowserUri('vs/workbench/services/textMate/browser/backgroundTokenization/worker/textMateTokenizationWorker.workerMain.js'),
            label: 'TextMateWorker'
        }));
        TextMateWorkerHost.setChannel(worker, {
            $readFile: async (_resource) => {
                const resource = URI.revive(_resource);
                return this._extensionResourceLoaderService.readExtensionResource(resource);
            },
            $setTokensAndStates: async (controllerId, versionId, tokens, lineEndStateDeltas) => {
                const controller = this._workerTokenizerControllers.get(controllerId);
                // When a model detaches, it is removed synchronously from the map.
                // However, the worker might still be sending tokens for that model,
                // so we ignore the event when there is no controller.
                if (controller) {
                    controller.setTokensAndStates(controllerId, versionId, tokens, lineEndStateDeltas);
                }
            },
            $reportTokenizationTime: (timeMs, languageId, sourceExtensionId, lineLength, isRandomSample) => {
                this._reportTokenizationTime(timeMs, languageId, sourceExtensionId, lineLength, isRandomSample);
            }
        });
        await worker.proxy.$init(createData);
        if (this._worker !== worker) {
            // disposed in the meantime
            return null;
        }
        this._workerProxy = worker.proxy;
        if (this._currentTheme && this._currentTokenColorMap) {
            this._workerProxy.$acceptTheme(this._currentTheme, this._currentTokenColorMap);
        }
        return worker.proxy;
    }
    _disposeWorker() {
        for (const controller of this._workerTokenizerControllers.values()) {
            controller.dispose();
        }
        this._workerTokenizerControllers.clear();
        if (this._worker) {
            this._worker.dispose();
            this._worker = null;
        }
        this._workerProxy = null;
        this._workerProxyPromise = null;
    }
};
ThreadedBackgroundTokenizerFactory = ThreadedBackgroundTokenizerFactory_1 = __decorate([
    __param(2, IExtensionResourceLoaderService),
    __param(3, IConfigurationService),
    __param(4, ILanguageService),
    __param(5, IEnvironmentService),
    __param(6, INotificationService),
    __param(7, ITelemetryService),
    __param(8, IWebWorkerService)
], ThreadedBackgroundTokenizerFactory);
export { ThreadedBackgroundTokenizerFactory };
function keepAliveWhenAttached(textModel, factory) {
    const disposableStore = new DisposableStore();
    const subStore = disposableStore.add(new DisposableStore());
    function checkAttached() {
        if (textModel.isAttachedToEditor()) {
            subStore.add(factory());
        }
        else {
            subStore.clear();
        }
    }
    checkAttached();
    disposableStore.add(textModel.onDidChangeAttached(() => {
        checkAttached();
    }));
    return disposableStore;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhyZWFkZWRCYWNrZ3JvdW5kVG9rZW5pemVyRmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvdGV4dE1hdGUvYnJvd3Nlci9iYWNrZ3JvdW5kVG9rZW5pemF0aW9uL3RocmVhZGVkQmFja2dyb3VuZFRva2VuaXplckZhY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUNqRCxPQUFPLEVBQUUsZUFBZSxFQUFlLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JHLE9BQU8sRUFBbUIsVUFBVSxFQUFFLG1CQUFtQixFQUFFLGVBQWUsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBRTFILE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLG1DQUFtQyxDQUFDO0FBRXZFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBRXRGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSwrQkFBK0IsRUFBRSxNQUFNLG1GQUFtRixDQUFDO0FBQ3BJLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBRTFGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxpQ0FBaUMsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRzNGLE9BQU8sRUFBRSxtQkFBbUIs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