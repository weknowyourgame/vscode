/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CancellationTokenSource } from '../../../base/common/cancellation.js';
import * as errors from '../../../base/common/errors.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { combinedDisposable } from '../../../base/common/lifecycle.js';
import { Schemas, matchesScheme } from '../../../base/common/network.js';
import Severity from '../../../base/common/severity.js';
import { URI } from '../../../base/common/uri.js';
import { TextEditorCursorStyle } from '../../../editor/common/config/editorOptions.js';
import { score, targetsNotebooks } from '../../../editor/common/languageSelector.js';
import * as languageConfiguration from '../../../editor/common/languages/languageConfiguration.js';
import { OverviewRulerLane } from '../../../editor/common/model.js';
import { ExtensionError, ExtensionIdentifierSet } from '../../../platform/extensions/common/extensions.js';
import * as files from '../../../platform/files/common/files.js';
import { ILogService, ILoggerService, LogLevel } from '../../../platform/log/common/log.js';
import { getRemoteName } from '../../../platform/remote/common/remoteHosts.js';
import { TelemetryTrustedValue } from '../../../platform/telemetry/common/telemetryUtils.js';
import { EditSessionIdentityMatch } from '../../../platform/workspace/common/editSessions.js';
import { DebugConfigurationProviderTriggerKind } from '../../contrib/debug/common/debug.js';
import { UIKind } from '../../services/extensions/common/extensionHostProtocol.js';
import { checkProposedApiEnabled, isProposedApiEnabled } from '../../services/extensions/common/extensions.js';
import { AISearchKeyword, ExcludeSettingOptions, TextSearchCompleteMessageType, TextSearchContext2, TextSearchMatch2 } from '../../services/search/common/searchExtTypes.js';
import { CandidatePortSource, ExtHostContext, MainContext } from './extHost.protocol.js';
import { ExtHostRelatedInformation } from './extHostAiRelatedInformation.js';
import { ExtHostAiSettingsSearch } from './extHostAiSettingsSearch.js';
import { ExtHostApiCommands } from './extHostApiCommands.js';
import { IExtHostApiDeprecationService } from './extHostApiDeprecationService.js';
import { IExtHostAuthentication } from './extHostAuthentication.js';
import { ExtHostBulkEdits } from './extHostBulkEdits.js';
import { ExtHostChatAgents2 } from './extHostChatAgents2.js';
import { ExtHostChatOutputRenderer } from './extHostChatOutputRenderer.js';
import { ExtHostChatSessions } from './extHostChatSessions.js';
import { ExtHostChatStatus } from './extHostChatStatus.js';
import { ExtHostClipboard } from './extHostClipboard.js';
import { ExtHostEditorInsets } from './extHostCodeInsets.js';
import { ExtHostCodeMapper } from './extHostCodeMapper.js';
import { IExtHostCommands } from './extHostCommands.js';
import { createExtHostComments } from './extHostComments.js';
import { IExtHostConfiguration } from './extHostConfiguration.js';
import { ExtHostCustomEditors } from './extHostCustomEditors.js';
import { IExtHostDataChannels } from './extHostDataChannels.js';
import { IExtHostDebugService } from './extHostDebugService.js';
import { IExtHostDecorations } from './extHostDecorations.js';
import { ExtHostDiagnostics } from './extHostDiagnostics.js';
import { ExtHostDialogs } from './extHostDialogs.js';
import { ExtHostDocumentContentProvider } from './extHostDocumentContentProviders.js';
import { ExtHostDocumentSaveParticipant } from './extHostDocumentSaveParticipant.js';
import { ExtHostDocuments } from './extHostDocuments.js';
import { IExtHostDocumentsAndEditors } from './extHostDocumentsAndEditors.js';
import { IExtHostEditorTabs } from './extHostEditorTabs.js';
import { ExtHostEmbeddings } from './extHostEmbedding.js';
import { ExtHostAiEmbeddingVector } from './extHostEmbeddingVector.js';
import { Extension, IExtHostExtensionService } from './extHostExtensionService.js';
import { ExtHostFileSystem } from './extHostFileSystem.js';
import { IExtHostConsumerFileSystem } from './extHostFileSystemConsumer.js';
import { ExtHostFileSystemEventService } from './extHostFileSystemEventService.js';
import { IExtHostFileSystemInfo } from './extHostFileSystemInfo.js';
import { IExtHostInitDataService } from './extHostInitDataService.js';
import { ExtHostInteractive } from './extHostInteractive.js';
import { ExtHostLabelService } from './extHostLabelService.js';
import { ExtHostLanguageFeatures } from './extHostLanguageFeatures.js';
import { ExtHostLanguageModelTools } from './extHostLanguageModelTools.js';
import { IExtHostLanguageModels } from './extHostLanguageModels.js';
import { ExtHostLanguages } from './extHostLanguages.js';
import { IExtHostLocalizationService } from './extHostLocalizationService.js';
import { IExtHostManagedSockets } from './extHostManagedSockets.js';
import { IExtHostMpcService } from './extHostMcp.js';
import { ExtHostMessageService } from './extHostMessageService.js';
import { ExtHostNotebookController } from './extHostNotebook.js';
import { ExtHostNotebookDocumentSaveParticipant } from './extHostNotebookDocumentSaveParticipant.js';
import { ExtHostNotebookDocuments } from './extHostNotebookDocuments.js';
import { ExtHostNotebookEditors } from './extHostNotebookEditors.js';
import { ExtHostNotebookKernels } from './extHostNotebookKernels.js';
import { ExtHostNotebookRenderers } from './extHostNotebookRenderers.js';
import { IExtHostOutputService } from './extHostOutput.js';
import { ExtHostProfileContentHandlers } from './extHostProfileContentHandler.js';
import { IExtHostProgress } from './extHostProgress.js';
import { ExtHostQuickDiff } from './extHostQuickDiff.js';
import { createExtHostQuickOpen } from './extHostQuickOpen.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import { ExtHostSCM } from './extHostSCM.js';
import { IExtHostSearch } from './extHostSearch.js';
import { IExtHostSecretState } from './extHostSecretState.js';
import { ExtHostShare } from './extHostShare.js';
import { ExtHostSpeech } from './extHostSpeech.js';
import { ExtHostStatusBar } from './extHostStatusBar.js';
import { IExtHostStorage } from './extHostStorage.js';
import { IExtensionStoragePaths } from './extHostStoragePaths.js';
import { IExtHostTask } from './extHostTask.js';
import { ExtHostTelemetryLogger, IExtHostTelemetry, isNewAppInstall } from './extHostTelemetry.js';
import { IExtHostTerminalService } from './extHostTerminalService.js';
import { IExtHostTerminalShellIntegration } from './extHostTerminalShellIntegration.js';
import { IExtHostTesting } from './extHostTesting.js';
import { ExtHostEditors } from './extHostTextEditors.js';
import { ExtHostTheming } from './extHostTheming.js';
import { ExtHostTimeline } from './extHostTimeline.js';
import { ExtHostTreeViews } from './extHostTreeViews.js';
import { IExtHostTunnelService } from './extHostTunnelService.js';
import * as typeConverters from './extHostTypeConverters.js';
import * as extHostTypes from './extHostTypes.js';
import { ExtHostUriOpeners } from './extHostUriOpener.js';
import { IURITransformerService } from './extHostUriTransformerService.js';
import { IExtHostUrlsService } from './extHostUrls.js';
import { ExtHostWebviews } from './extHostWebview.js';
import { ExtHostWebviewPanels } from './extHostWebviewPanels.js';
import { ExtHostWebviewViews } from './extHostWebviewView.js';
import { IExtHostWindow } from './extHostWindow.js';
import { IExtHostWorkspace } from './extHostWorkspace.js';
import { ExtHostChatContext } from './extHostChatContext.js';
/**
 * This method instantiates and returns the extension API surface
 */
export function createApiFactoryAndRegisterActors(accessor) {
    // services
    const initData = accessor.get(IExtHostInitDataService);
    const extHostFileSystemInfo = accessor.get(IExtHostFileSystemInfo);
    const extHostConsumerFileSystem = accessor.get(IExtHostConsumerFileSystem);
    const extensionService = accessor.get(IExtHostExtensionService);
    const extHostWorkspace = accessor.get(IExtHostWorkspace);
    const extHostTelemetry = accessor.get(IExtHostTelemetry);
    const extHostConfiguration = accessor.get(IExtHostConfiguration);
    const uriTransformer = accessor.get(IURITransformerService);
    const rpcProtocol = accessor.get(IExtHostRpcService);
    const extHostStorage = accessor.get(IExtHostStorage);
    const extensionStoragePaths = accessor.get(IExtensionStoragePaths);
    const extHostLoggerService = accessor.get(ILoggerService);
    const extHostLogService = accessor.get(ILogService);
    const extHostTunnelService = accessor.get(IExtHostTunnelService);
    const extHostApiDeprecation = accessor.get(IExtHostApiDeprecationService);
    const extHostWindow = accessor.get(IExtHostWindow);
    const extHostUrls = accessor.get(IExtHostUrlsService);
    const extHostSecretState = accessor.get(IExtHostSecretState);
    const extHostEditorTabs = accessor.get(IExtHostEditorTabs);
    const extHostManagedSockets = accessor.get(IExtHostManagedSockets);
    const extHostProgress = accessor.get(IExtHostProgress);
    const extHostAuthentication = accessor.get(IExtHostAuthentication);
    const extHostLanguageModels = accessor.get(IExtHostLanguageModels);
    const extHostMcp = accessor.get(IExtHostMpcService);
    const extHostDataChannels = accessor.get(IExtHostDataChannels);
    // register addressable instances
    rpcProtocol.set(ExtHostContext.ExtHostFileSystemInfo, extHostFileSystemInfo);
    // eslint-disable-next-line local/code-no-any-casts
    rpcProtocol.set(ExtHostContext.ExtHostLogLevelServiceShape, extHostLoggerService);
    rpcProtocol.set(ExtHostContext.ExtHostWorkspace, extHostWorkspace);
    rpcProtocol.set(ExtHostContext.ExtHostConfiguration, extHostConfiguration);
    rpcProtocol.set(ExtHostContext.ExtHostExtensionService, extensionService);
    rpcProtocol.set(ExtHostContext.ExtHostStorage, extHostStorage);
    rpcProtocol.set(ExtHostContext.ExtHostTunnelService, extHostTunnelService);
    rpcProtocol.set(ExtHostContext.ExtHostWindow, extHostWindow);
    rpcProtocol.set(ExtHostContext.ExtHostUrls, extHostUrls);
    rpcProtocol.set(ExtHostContext.ExtHostSecretState, extHostSecretState);
    rpcProtocol.set(ExtHostContext.ExtHostTelemetry, extHostTelemetry);
    rpcProtocol.set(ExtHostContext.ExtHostEditorTabs, extHostEditorTabs);
    rpcProtocol.set(ExtHostContext.ExtHostManagedSockets, extHostManagedSockets);
    rpcProtocol.set(ExtHostContext.ExtHostProgress, extHostProgress);
    rpcProtocol.set(ExtHostContext.ExtHostAuthentication, extHostAuthentication);
    rpcProtocol.set(ExtHostContext.ExtHostChatProvider, extHostLanguageModels);
    rpcProtocol.set(ExtHostContext.ExtHostDataChannels, extHostDataChannels);
    // automatically create and register addressable instances
    const extHostDecorations = rpcProtocol.set(ExtHostContext.ExtHostDecorations, accessor.get(IExtHostDecorations));
    const extHostDocumentsAndEditors = rpcProtocol.set(ExtHostContext.ExtHostDocumentsAndEditors, accessor.get(IExtHostDocumentsAndEditors));
    const extHostCommands = rpcProtocol.set(ExtHostContext.ExtHostCommands, accessor.get(IExtHostCommands));
    const extHostTerminalService = rpcProtocol.set(ExtHostContext.ExtHostTerminalService, accessor.get(IExtHostTerminalService));
    const extHostTerminalShellIntegration = rpcProtocol.set(ExtHostContext.ExtHostTerminalShellIntegration, accessor.get(IExtHostTerminalShellIntegration));
    const extHostDebugService = rpcProtocol.set(ExtHostContext.ExtHostDebugService, accessor.get(IExtHostDebugService));
    const extHostSearch = rpcProtocol.set(ExtHostContext.ExtHostSearch, accessor.get(IExtHostSearch));
    const extHostTask = rpcProtocol.set(ExtHostContext.ExtHostTask, accessor.get(IExtHostTask));
    const extHostOutputService = rpcProtocol.set(ExtHostContext.ExtHostOutputService, accessor.get(IExtHostOutputService));
    const extHostLocalization = rpcProtocol.set(ExtHostContext.ExtHostLocalization, accessor.get(IExtHostLocalizationService));
    // manually create and register addressable instances
    const extHostDocuments = rpcProtocol.set(ExtHostContext.ExtHostDocuments, new ExtHostDocuments(rpcProtocol, extHostDocumentsAndEditors));
    const extHostDocumentContentProviders = rpcProtocol.set(ExtHostContext.ExtHostDocumentContentProviders, new ExtHostDocumentContentProvider(rpcProtocol, extHostDocumentsAndEditors, extHostLogService));
    const extHostDocumentSaveParticipant = rpcProtocol.set(ExtHostContext.ExtHostDocumentSaveParticipant, new ExtHostDocumentSaveParticipant(extHostLogService, extHostDocuments, rpcProtocol.getProxy(MainContext.MainThreadBulkEdits)));
    const extHostNotebook = rpcProtocol.set(ExtHostContext.ExtHostNotebook, new ExtHostNotebookController(rpcProtocol, extHostCommands, extHostDocumentsAndEditors, extHostDocuments, extHostConsumerFileSystem, extHostSearch, extHostLogService));
    const extHostNotebookDocuments = rpcProtocol.set(ExtHostContext.ExtHostNotebookDocuments, new ExtHostNotebookDocuments(extHostNotebook));
    const extHostNotebookEditors = rpcProtocol.set(ExtHostContext.ExtHostNotebookEditors, new ExtHostNotebookEditors(extHostLogService, extHostNotebook));
    const extHostNotebookKernels = rpcProtocol.set(ExtHostContext.ExtHostNotebookKernels, new ExtHostNotebookKernels(rpcProtocol, initData, extHostNotebook, extHostCommands, extHostLogService));
    const extHostNotebookRenderers = rpcProtocol.set(ExtHostContext.ExtHostNotebookRenderers, new ExtHostNotebookRenderers(rpcProtocol, extHostNotebook));
    const extHostNotebookDocumentSaveParticipant = rpcProtocol.set(ExtHostContext.ExtHostNotebookDocumentSaveParticipant, new ExtHostNotebookDocumentSaveParticipant(extHostLogService, extHostNotebook, rpcProtocol.getProxy(MainContext.MainThreadBulkEdits)));
    const extHostEditors = rpcProtocol.set(ExtHostContext.ExtHostEditors, new ExtHostEditors(rpcProtocol, extHostDocumentsAndEditors));
    const extHostTreeViews = rpcProtocol.set(ExtHostContext.ExtHostTreeViews, new ExtHostTreeViews(rpcProtocol.getProxy(MainContext.MainThreadTreeViews), extHostCommands, extHostLogService));
    const extHostEditorInsets = rpcProtocol.set(ExtHostContext.ExtHostEditorInsets, new ExtHostEditorInsets(rpcProtocol.getProxy(MainContext.MainThreadEditorInsets), extHostEditors, initData.remote));
    const extHostDiagnostics = rpcProtocol.set(ExtHostContext.ExtHostDiagnostics, new ExtHostDiagnostics(rpcProtocol, extHostLogService, extHostFileSystemInfo, extHostDocumentsAndEditors));
    const extHostLanguages = rpcProtocol.set(ExtHostContext.ExtHostLanguages, new ExtHostLanguages(rpcProtocol, extHostDocuments, extHostCommands.converter, uriTransformer));
    const extHostLanguageFeatures = rpcProtocol.set(ExtHostContext.ExtHostLanguageFeatures, new ExtHostLanguageFeatures(rpcProtocol, uriTransformer, extHostDocuments, extHostCommands, extHostDiagnostics, extHostLogService, extHostApiDeprecation, extHostTelemetry));
    const extHostCodeMapper = rpcProtocol.set(ExtHostContext.ExtHostCodeMapper, new ExtHostCodeMapper(rpcProtocol));
    const extHostFileSystem = rpcProtocol.set(ExtHostContext.ExtHostFileSystem, new ExtHostFileSystem(rpcProtocol, extHostLanguageFeatures));
    const extHostFileSystemEvent = rpcProtocol.set(ExtHostContext.ExtHostFileSystemEventService, new ExtHostFileSystemEventService(rpcProtocol, extHostLogService, extHostDocumentsAndEditors));
    const extHostQuickOpen = rpcProtocol.set(ExtHostContext.ExtHostQuickOpen, createExtHostQuickOpen(rpcProtocol, extHostWorkspace, extHostCommands));
    const extHostSCM = rpcProtocol.set(ExtHostContext.ExtHostSCM, new ExtHostSCM(rpcProtocol, extHostCommands, extHostDocuments, extHostLogService));
    const extHostQuickDiff = rpcProtocol.set(ExtHostContext.ExtHostQuickDiff, new ExtHostQuickDiff(rpcProtocol, uriTransformer));
    const extHostShare = rpcProtocol.set(ExtHostContext.ExtHostShare, new ExtHostShare(rpcProtocol, uriTransformer));
    const extHostComment = rpcProtocol.set(ExtHostContext.ExtHostComments, createExtHostComments(rpcProtocol, extHostCommands, extHostDocuments));
    const extHostLabelService = rpcProtocol.set(ExtHostContext.ExtHostLabelService, new ExtHostLabelService(rpcProtocol));
    const extHostTheming = rpcProtocol.set(ExtHostContext.ExtHostTheming, new ExtHostTheming(rpcProtocol));
    const extHostTimeline = rpcProtocol.set(ExtHostContext.ExtHostTimeline, new ExtHostTimeline(rpcProtocol, extHostCommands));
    const extHostWebviews = rpcProtocol.set(ExtHostContext.ExtHostWebviews, new ExtHostWebviews(rpcProtocol, initData.remote, extHostWorkspace, extHostLogService, extHostApiDeprecation));
    const extHostWebviewPanels = rpcProtocol.set(ExtHostContext.ExtHostWebviewPanels, new ExtHostWebviewPanels(rpcProtocol, extHostWebviews, extHostWorkspace));
    const extHostCustomEditors = rpcProtocol.set(ExtHostContext.ExtHostCustomEditors, new ExtHostCustomEditors(rpcProtocol, extHostDocuments, extensionStoragePaths, extHostWebviews, extHostWebviewPanels));
    const extHostWebviewViews = rpcProtocol.set(ExtHostContext.ExtHostWebviewViews, new ExtHostWebviewViews(rpcProtocol, extHostWebviews));
    const extHostTesting = rpcProtocol.set(ExtHostContext.ExtHostTesting, accessor.get(IExtHostTesting));
    const extHostUriOpeners = rpcProtocol.set(ExtHostContext.ExtHostUriOpeners, new ExtHostUriOpeners(rpcProtocol));
    const extHostProfileContentHandlers = rpcProtocol.set(ExtHostContext.ExtHostProfileContentHandlers, new ExtHostProfileContentHandlers(rpcProtocol));
    const extHostChatOutputRenderer = rpcProtocol.set(ExtHostContext.ExtHostChatOutputRenderer, new ExtHostChatOutputRenderer(rpcProtocol, extHostWebviews));
    rpcProtocol.set(ExtHostContext.ExtHostInteractive, new ExtHostInteractive(rpcProtocol, extHostNotebook, extHostDocumentsAndEditors, extHostCommands, extHostLogService));
    const extHostLanguageModelTools = rpcProtocol.set(ExtHostContext.ExtHostLanguageModelTools, new ExtHostLanguageModelTools(rpcProtocol, extHostLanguageModels));
    const extHostChatSessions = rpcProtocol.set(ExtHostContext.ExtHostChatSessions, new ExtHostChatSessions(extHostCommands, extHostLanguageModels, rpcProtocol, extHostLogService));
    const extHostChatAgents2 = rpcProtocol.set(ExtHostContext.ExtHostChatAgents2, new ExtHostChatAgents2(rpcProtocol, extHostLogService, extHostCommands, extHostDocuments, extHostLanguageModels, extHostDiagnostics, extHostLanguageModelTools));
    const extHostChatContext = rpcProtocol.set(ExtHostContext.ExtHostChatContext, new ExtHostChatContext(rpcProtocol));
    const extHostAiRelatedInformation = rpcProtocol.set(ExtHostContext.ExtHostAiRelatedInformation, new ExtHostRelatedInformation(rpcProtocol));
    const extHostAiEmbeddingVector = rpcProtocol.set(ExtHostContext.ExtHostAiEmbeddingVector, new ExtHostAiEmbeddingVector(rpcProtocol));
    const extHostAiSettingsSearch = rpcProtocol.set(ExtHostContext.ExtHostAiSettingsSearch, new ExtHostAiSettingsSearch(rpcProtocol));
    const extHostStatusBar = rpcProtocol.set(ExtHostContext.ExtHostStatusBar, new ExtHostStatusBar(rpcProtocol, extHostCommands.converter));
    const extHostSpeech = rpcProtocol.set(ExtHostContext.ExtHostSpeech, new ExtHostSpeech(rpcProtocol));
    const extHostEmbeddings = rpcProtocol.set(ExtHostContext.ExtHostEmbeddings, new ExtHostEmbeddings(rpcProtocol));
    rpcProtocol.set(ExtHostContext.ExtHostMcp, accessor.get(IExtHostMpcService));
    // Check that no named customers are missing
    const expected = Object.values(ExtHostContext);
    rpcProtocol.assertRegistered(expected);
    // Other instances
    const extHostBulkEdits = new ExtHostBulkEdits(rpcProtocol, extHostDocumentsAndEditors);
    const extHostClipboard = new ExtHostClipboard(rpcProtocol);
    const extHostMessageService = new ExtHostMessageService(rpcProtocol, extHostLogService);
    const extHostDialogs = new ExtHostDialogs(rpcProtocol);
    const extHostChatStatus = new ExtHostChatStatus(rpcProtocol);
    // Register API-ish commands
    ExtHostApiCommands.register(extHostCommands);
    return function (extension, extensionInfo, configProvider) {
        // Wraps an event with error handling and telemetry so that we know what extension fails
        // handling events. This will prevent us from reporting this as "our" error-telemetry and
        // allows for better blaming
        function _asExtensionEvent(actual) {
            return (listener, thisArgs, disposables) => {
                const handle = actual(e => {
                    try {
                        listener.call(thisArgs, e);
                    }
                    catch (err) {
                        errors.onUnexpectedExternalError(new ExtensionError(extension.identifier, err, 'FAILED to handle event'));
                    }
                });
                disposables?.push(handle);
                return handle;
            };
        }
        // Check document selectors for being overly generic. Technically this isn't a problem but
        // in practice many extensions say they support `fooLang` but need fs-access to do so. Those
        // extension should specify then the `file`-scheme, e.g. `{ scheme: 'fooLang', language: 'fooLang' }`
        // We only inform once, it is not a warning because we just want to raise awareness and because
        // we cannot say if the extension is doing it right or wrong...
        const checkSelector = (function () {
            let done = !extension.isUnderDevelopment;
            function informOnce() {
                if (!done) {
                    extHostLogService.info(`Extension '${extension.identifier.value}' uses a document selector without scheme. Learn more about this: https://go.microsoft.com/fwlink/?linkid=872305`);
                    done = true;
                }
            }
            return function perform(selector) {
                if (Array.isArray(selector)) {
                    selector.forEach(perform);
                }
                else if (typeof selector === 'string') {
                    informOnce();
                }
                else {
                    const filter = selector; // TODO: microsoft/TypeScript#42768
                    if (typeof filter.scheme === 'undefined') {
                        informOnce();
                    }
                    if (typeof filter.exclusive === 'boolean') {
                        checkProposedApiEnabled(extension, 'documentFiltersExclusive');
                    }
                }
                return selector;
            };
        })();
        const authentication = {
            getSession(providerId, scopesOrChallenge, options) {
                if ((typeof options?.forceNewSession === 'object' && options.forceNewSession.learnMore) ||
                    (typeof options?.createIfNone === 'object' && options.createIfNone.learnMore)) {
                    checkProposedApiEnabled(extension, 'authLearnMore');
                }
                if (options?.authorizationServer) {
                    checkProposedApiEnabled(extension, 'authIssuers');
                }
                // eslint-disable-next-line local/code-no-any-casts
                return extHostAuthentication.getSession(extension, providerId, scopesOrChallenge, options);
            },
            getAccounts(providerId) {
                return extHostAuthentication.getAccounts(providerId);
            },
            // TODO: remove this after GHPR and Codespaces move off of it
            async hasSession(providerId, scopes) {
                checkProposedApiEnabled(extension, 'authSession');
                // eslint-disable-next-line local/code-no-any-casts
                return !!(await extHostAuthentication.getSession(extension, providerId, scopes, { silent: true }));
            },
            get onDidChangeSessions() {
                return _asExtensionEvent(extHostAuthentication.getExtensionScopedSessionsEvent(extension.identifier.value));
            },
            registerAuthenticationProvider(id, label, provider, options) {
                if (options?.supportedAuthorizationServers) {
                    checkProposedApiEnabled(extension, 'authIssuers');
                }
                return extHostAuthentication.registerAuthenticationProvider(id, label, provider, options);
            }
        };
        // namespace: commands
        const commands = {
            registerCommand(id, command, thisArgs) {
                return extHostCommands.registerCommand(true, id, command, thisArgs, undefined, extension);
            },
            registerTextEditorCommand(id, callback, thisArg) {
                return extHostCommands.registerCommand(true, id, (...args) => {
                    const activeTextEditor = extHostEditors.getActiveTextEditor();
                    if (!activeTextEditor) {
                        extHostLogService.warn('Cannot execute ' + id + ' because there is no active text editor.');
                        return undefined;
                    }
                    return activeTextEditor.edit((edit) => {
                        callback.apply(thisArg, [activeTextEditor, edit, ...args]);
                    }).then((result) => {
                        if (!result) {
                            extHostLogService.warn('Edits from command ' + id + ' were not applied.');
                        }
                    }, (err) => {
                        extHostLogService.warn('An error occurred while running command ' + id, err);
                    });
                }, undefined, undefined, extension);
            },
            registerDiffInformationCommand: (id, callback, thisArg) => {
                checkProposedApiEnabled(extension, 'diffCommand');
                return extHostCommands.registerCommand(true, id, async (...args) => {
                    const activeTextEditor = extHostDocumentsAndEditors.activeEditor(true);
                    if (!activeTextEditor) {
                        extHostLogService.warn('Cannot execute ' + id + ' because there is no active text editor.');
                        return undefined;
                    }
                    const diff = await extHostEditors.getDiffInformation(activeTextEditor.id);
                    callback.apply(thisArg, [diff, ...args]);
                }, undefined, undefined, extension);
            },
            executeCommand(id, ...args) {
                return extHostCommands.executeCommand(id, ...args);
            },
            getCommands(filterInternal = false) {
                return extHostCommands.getCommands(filterInternal);
            }
        };
        // namespace: env
        const env = {
            get machineId() { return initData.telemetryInfo.machineId; },
            get devDeviceId() {
                checkProposedApiEnabled(extension, 'devDeviceId');
                return initData.telemetryInfo.devDeviceId ?? initData.telemetryInfo.machineId;
            },
            get sessionId() { return initData.telemetryInfo.sessionId; },
            get language() { return initData.environment.appLanguage; },
            get appName() { return initData.environment.appName; },
            get appRoot() { return initData.environment.appRoot?.fsPath ?? ''; },
            get appHost() { return initData.environment.appHost; },
            get uriScheme() { return initData.environment.appUriScheme; },
            get clipboard() { return extHostClipboard.value; },
            get shell() {
                return extHostTerminalService.getDefaultShell(false);
            },
            get onDidChangeShell() {
                return _asExtensionEvent(extHostTerminalService.onDidChangeShell);
            },
            get isTelemetryEnabled() {
                return extHostTelemetry.getTelemetryConfiguration();
            },
            get onDidChangeTelemetryEnabled() {
                return _asExtensionEvent(extHostTelemetry.onDidChangeTelemetryEnabled);
            },
            get telemetryConfiguration() {
                checkProposedApiEnabled(extension, 'telemetry');
                return extHostTelemetry.getTelemetryDetails();
            },
            get onDidChangeTelemetryConfiguration() {
                checkProposedApiEnabled(extension, 'telemetry');
                return _asExtensionEvent(extHostTelemetry.onDidChangeTelemetryConfiguration);
            },
            get isNewAppInstall() {
                return isNewAppInstall(initData.telemetryInfo.firstSessionDate);
            },
            createTelemetryLogger(sender, options) {
                ExtHostTelemetryLogger.validateSender(sender);
                return extHostTelemetry.instantiateLogger(extension, sender, options);
            },
            async openExternal(uri, options) {
                return extHostWindow.openUri(uri, {
                    allowTunneling: initData.remote.isRemote ?? (initData.remote.authority ? await extHostTunnelService.hasTunnelProvider() : false),
                    allowContributedOpeners: options?.allowContributedOpeners,
                });
            },
            async asExternalUri(uri) {
                if (uri.scheme === initData.environment.appUriScheme) {
                    return extHostUrls.createAppUri(uri);
                }
                try {
                    return await extHostWindow.asExternalUri(uri, { allowTunneling: !!initData.remote.authority });
                }
                catch (err) {
                    if (matchesScheme(uri, Schemas.http) || matchesScheme(uri, Schemas.https)) {
                        return uri;
                    }
                    throw err;
                }
            },
            get remoteName() {
                return getRemoteName(initData.remote.authority);
            },
            get remoteAuthority() {
                checkProposedApiEnabled(extension, 'resolvers');
                return initData.remote.authority;
            },
            get uiKind() {
                return initData.uiKind;
            },
            get logLevel() {
                return extHostLogService.getLevel();
            },
            get onDidChangeLogLevel() {
                return _asExtensionEvent(extHostLogService.onDidChangeLogLevel);
            },
            get appQuality() {
                checkProposedApiEnabled(extension, 'resolvers');
                return initData.quality;
            },
            get appCommit() {
                checkProposedApiEnabled(extension, 'resolvers');
                return initData.commit;
            },
            getDataChannel(channelId) {
                checkProposedApiEnabled(extension, 'dataChannels');
                return extHostDataChannels.createDataChannel(extension, channelId);
            }
        };
        if (!initData.environment.extensionTestsLocationURI) {
            // allow to patch env-function when running tests
            Object.freeze(env);
        }
        // namespace: tests
        const tests = {
            createTestController(provider, label, refreshHandler) {
                return extHostTesting.createTestController(extension, provider, label, refreshHandler);
            },
            createTestObserver() {
                checkProposedApiEnabled(extension, 'testObserver');
                return extHostTesting.createTestObserver();
            },
            runTests(provider) {
                checkProposedApiEnabled(extension, 'testObserver');
                return extHostTesting.runTests(provider);
            },
            registerTestFollowupProvider(provider) {
                checkProposedApiEnabled(extension, 'testObserver');
                return extHostTesting.registerTestFollowupProvider(provider);
            },
            get onDidChangeTestResults() {
                checkProposedApiEnabled(extension, 'testObserver');
                return _asExtensionEvent(extHostTesting.onResultsChanged);
            },
            get testResults() {
                checkProposedApiEnabled(extension, 'testObserver');
                return extHostTesting.results;
            },
        };
        // namespace: extensions
        const extensionKind = initData.remote.isRemote
            ? extHostTypes.ExtensionKind.Workspace
            : extHostTypes.ExtensionKind.UI;
        const extensions = {
            getExtension(extensionId, includeFromDifferentExtensionHosts) {
                if (!isProposedApiEnabled(extension, 'extensionsAny')) {
                    includeFromDifferentExtensionHosts = false;
                }
                const mine = extensionInfo.mine.getExtensionDescription(extensionId);
                if (mine) {
                    return new Extension(extensionService, extension.identifier, mine, extensionKind, false);
                }
                if (includeFromDifferentExtensionHosts) {
                    const foreign = extensionInfo.all.getExtensionDescription(extensionId);
                    if (foreign) {
                        return new Extension(extensionService, extension.identifier, foreign, extensionKind /* TODO@alexdima THIS IS WRONG */, true);
                    }
                }
                return undefined;
            },
            get all() {
                const result = [];
                for (const desc of extensionInfo.mine.getAllExtensionDescriptions()) {
                    result.push(new Extension(extensionService, extension.identifier, desc, extensionKind, false));
                }
                return result;
            },
            get allAcrossExtensionHosts() {
                checkProposedApiEnabled(extension, 'extensionsAny');
                const local = new ExtensionIdentifierSet(extensionInfo.mine.getAllExtensionDescriptions().map(desc => desc.identifier));
                const result = [];
                for (const desc of extensionInfo.all.getAllExtensionDescriptions()) {
                    const isFromDifferentExtensionHost = !local.has(desc.identifier);
                    result.push(new Extension(extensionService, extension.identifier, desc, extensionKind /* TODO@alexdima THIS IS WRONG */, isFromDifferentExtensionHost));
                }
                return result;
            },
            get onDidChange() {
                if (isProposedApiEnabled(extension, 'extensionsAny')) {
                    return _asExtensionEvent(Event.any(extensionInfo.mine.onDidChange, extensionInfo.all.onDidChange));
                }
                return _asExtensionEvent(extensionInfo.mine.onDidChange);
            }
        };
        // namespace: languages
        const languages = {
            createDiagnosticCollection(name) {
                return extHostDiagnostics.createDiagnosticCollection(extension.identifier, name);
            },
            get onDidChangeDiagnostics() {
                return _asExtensionEvent(extHostDiagnostics.onDidChangeDiagnostics);
            },
            getDiagnostics: (resource) => {
                // eslint-disable-next-line local/code-no-any-casts
                return extHostDiagnostics.getDiagnostics(resource);
            },
            getLanguages() {
                return extHostLanguages.getLanguages();
            },
            setTextDocumentLanguage(document, languageId) {
                return extHostLanguages.changeLanguage(document.uri, languageId);
            },
            match(selector, document) {
                const interalSelector = typeConverters.LanguageSelector.from(selector);
                let notebook;
                if (targetsNotebooks(interalSelector)) {
                    notebook = extHostNotebook.notebookDocuments.find(value => value.apiNotebook.getCells().find(c => c.document === document))?.apiNotebook;
                }
                return score(interalSelector, document.uri, document.languageId, true, notebook?.uri, notebook?.notebookType);
            },
            registerCodeActionsProvider(selector, provider, metadata) {
                return extHostLanguageFeatures.registerCodeActionProvider(extension, checkSelector(selector), provider, metadata);
            },
            registerDocumentPasteEditProvider(selector, provider, metadata) {
                return extHostLanguageFeatures.registerDocumentPasteEditProvider(extension, checkSelector(selector), provider, metadata);
            },
            registerCodeLensProvider(selector, provider) {
                return extHostLanguageFeatures.registerCodeLensProvider(extension, checkSelector(selector), provider);
            },
            registerDefinitionProvider(selector, provider) {
                return extHostLanguageFeatures.registerDefinitionProvider(extension, checkSelector(selector), provider);
            },
            registerDeclarationProvider(selector, provider) {
                return extHostLanguageFeatures.registerDeclarationProvider(extension, checkSelector(selector), provider);
            },
            registerImplementationProvider(selector, provider) {
                return extHostLanguageFeatures.registerImplementationProvider(extension, checkSelector(selector), provider);
            },
            registerTypeDefinitionProvider(selector, provider) {
                return extHostLanguageFeatures.registerTypeDefinitionProvider(extension, checkSelector(selector), provider);
            },
            registerHoverProvider(selector, provider) {
                return extHostLanguageFeatures.registerHoverProvider(extension, checkSelector(selector), provider, extension.identifier);
            },
            registerEvaluatableExpressionProvider(selector, provider) {
                return extHostLanguageFeatures.registerEvaluatableExpressionProvider(extension, checkSelector(selector), provider, extension.identifier);
            },
            registerInlineValuesProvider(selector, provider) {
                return extHostLanguageFeatures.registerInlineValuesProvider(extension, checkSelector(selector), provider, extension.identifier);
            },
            registerDocumentHighlightProvider(selector, provider) {
                return extHostLanguageFeatures.registerDocumentHighlightProvider(extension, checkSelector(selector), provider);
            },
            registerMultiDocumentHighlightProvider(selector, provider) {
                return extHostLanguageFeatures.registerMultiDocumentHighlightProvider(extension, checkSelector(selector), provider);
            },
            registerLinkedEditingRangeProvider(selector, provider) {
                return extHostLanguageFeatures.registerLinkedEditingRangeProvider(extension, checkSelector(selector), provider);
            },
            registerReferenceProvider(selector, provider) {
                return extHostLanguageFeatures.registerReferenceProvider(extension, checkSelector(selector), provider);
            },
            registerRenameProvider(selector, provider) {
                return extHostLanguageFeatures.registerRenameProvider(extension, checkSelector(selector), provider);
            },
            registerNewSymbolNamesProvider(selector, provider) {
                checkProposedApiEnabled(extension, 'newSymbolNamesProvider');
                return extHostLanguageFeatures.registerNewSymbolNamesProvider(extension, checkSelector(selector), provider);
            },
            registerDocumentSymbolProvider(selector, provider, metadata) {
                return extHostLanguageFeatures.registerDocumentSymbolProvider(extension, checkSelector(selector), provider, metadata);
            },
            registerWorkspaceSymbolProvider(provider) {
                return extHostLanguageFeatures.registerWorkspaceSymbolProvider(extension, provider);
            },
            registerDocumentFormattingEditProvider(selector, provider) {
                return extHostLanguageFeatures.registerDocumentFormattingEditProvider(extension, checkSelector(selector), provider);
            },
            registerDocumentRangeFormattingEditProvider(selector, provider) {
                return extHostLanguageFeatures.registerDocumentRangeFormattingEditProvider(extension, checkSelector(selector), provider);
            },
            registerOnTypeFormattingEditProvider(selector, provider, firstTriggerCharacter, ...moreTriggerCharacters) {
                return extHostLanguageFeatures.registerOnTypeFormattingEditProvider(extension, checkSelector(selector), provider, [firstTriggerCharacter].concat(moreTriggerCharacters));
            },
            registerDocumentSemanticTokensProvider(selector, provider, legend) {
                return extHostLanguageFeatures.registerDocumentSemanticTokensProvider(extension, checkSelector(selector), provider, legend);
            },
            registerDocumentRangeSemanticTokensProvider(selector, provider, legend) {
                return extHostLanguageFeatures.registerDocumentRangeSemanticTokensProvider(extension, checkSelector(selector), provider, legend);
            },
            registerSignatureHelpProvider(selector, provider, firstItem, ...remaining) {
                if (typeof firstItem === 'object') {
                    return extHostLanguageFeatures.registerSignatureHelpProvider(extension, checkSelector(selector), provider, firstItem);
                }
                return extHostLanguageFeatures.registerSignatureHelpProvider(extension, checkSelector(selector), provider, typeof firstItem === 'undefined' ? [] : [firstItem, ...remaining]);
            },
            registerCompletionItemProvider(selector, provider, ...triggerCharacters) {
                return extHostLanguageFeatures.registerCompletionItemProvider(extension, checkSelector(selector), provider, triggerCharacters);
            },
            registerInlineCompletionItemProvider(selector, provider, metadata) {
                if (provider.handleDidShowCompletionItem) {
                    checkProposedApiEnabled(extension, 'inlineCompletionsAdditions');
                }
                if (provider.handleDidPartiallyAcceptCompletionItem) {
                    checkProposedApiEnabled(extension, 'inlineCompletionsAdditions');
                }
                if (metadata) {
                    checkProposedApiEnabled(extension, 'inlineCompletionsAdditions');
                }
                return extHostLanguageFeatures.registerInlineCompletionsProvider(extension, checkSelector(selector), provider, metadata);
            },
            get inlineCompletionsUnificationState() {
                checkProposedApiEnabled(extension, 'inlineCompletionsAdditions');
                return extHostLanguageFeatures.inlineCompletionsUnificationState;
            },
            onDidChangeCompletionsUnificationState(listener, thisArg, disposables) {
                checkProposedApiEnabled(extension, 'inlineCompletionsAdditions');
                return _asExtensionEvent(extHostLanguageFeatures.onDidChangeInlineCompletionsUnificationState)(listener, thisArg, disposables);
            },
            registerDocumentLinkProvider(selector, provider) {
                return extHostLanguageFeatures.registerDocumentLinkProvider(extension, checkSelector(selector), provider);
            },
            registerColorProvider(selector, provider) {
                return extHostLanguageFeatures.registerColorProvider(extension, checkSelector(selector), provider);
            },
            registerFoldingRangeProvider(selector, provider) {
                return extHostLanguageFeatures.registerFoldingRangeProvider(extension, checkSelector(selector), provider);
            },
            registerSelectionRangeProvider(selector, provider) {
                return extHostLanguageFeatures.registerSelectionRangeProvider(extension, selector, provider);
            },
            registerCallHierarchyProvider(selector, provider) {
                return extHostLanguageFeatures.registerCallHierarchyProvider(extension, selector, provider);
            },
            registerTypeHierarchyProvider(selector, provider) {
                return extHostLanguageFeatures.registerTypeHierarchyProvider(extension, selector, provider);
            },
            setLanguageConfiguration: (language, configuration) => {
                return extHostLanguageFeatures.setLanguageConfiguration(extension, language, configuration);
            },
            getTokenInformationAtPosition(doc, pos) {
                checkProposedApiEnabled(extension, 'tokenInformation');
                return extHostLanguages.tokenAtPosition(doc, pos);
            },
            registerInlayHintsProvider(selector, provider) {
                return extHostLanguageFeatures.registerInlayHintsProvider(extension, selector, provider);
            },
            createLanguageStatusItem(id, selector) {
                return extHostLanguages.createLanguageStatusItem(extension, id, selector);
            },
            registerDocumentDropEditProvider(selector, provider, metadata) {
                return extHostLanguageFeatures.registerDocumentOnDropEditProvider(extension, selector, provider, metadata);
            }
        };
        // namespace: window
        const window = {
            get activeTextEditor() {
                return extHostEditors.getActiveTextEditor();
            },
            get visibleTextEditors() {
                return extHostEditors.getVisibleTextEditors();
            },
            get activeTerminal() {
                return extHostTerminalService.activeTerminal;
            },
            get terminals() {
                return extHostTerminalService.terminals;
            },
            async showTextDocument(documentOrUri, columnOrOptions, preserveFocus) {
                if (URI.isUri(documentOrUri) && documentOrUri.scheme === Schemas.vscodeRemote && !documentOrUri.authority) {
                    extHostApiDeprecation.report('workspace.showTextDocument', extension, `A URI of 'vscode-remote' scheme requires an authority.`);
                }
                const document = await (URI.isUri(documentOrUri)
                    ? Promise.resolve(workspace.openTextDocument(documentOrUri))
                    : Promise.resolve(documentOrUri));
                return extHostEditors.showTextDocument(document, columnOrOptions, preserveFocus);
            },
            createTextEditorDecorationType(options) {
                return extHostEditors.createTextEditorDecorationType(extension, options);
            },
            onDidChangeActiveTextEditor(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostEditors.onDidChangeActiveTextEditor)(listener, thisArg, disposables);
            },
            onDidChangeVisibleTextEditors(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostEditors.onDidChangeVisibleTextEditors)(listener, thisArg, disposables);
            },
            onDidChangeTextEditorSelection(listener, thisArgs, disposables) {
                return _asExtensionEvent(extHostEditors.onDidChangeTextEditorSelection)(listener, thisArgs, disposables);
            },
            onDidChangeTextEditorOptions(listener, thisArgs, disposables) {
                return _asExtensionEvent(extHostEditors.onDidChangeTextEditorOptions)(listener, thisArgs, disposables);
            },
            onDidChangeTextEditorVisibleRanges(listener, thisArgs, disposables) {
                return _asExtensionEvent(extHostEditors.onDidChangeTextEditorVisibleRanges)(listener, thisArgs, disposables);
            },
            onDidChangeTextEditorViewColumn(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostEditors.onDidChangeTextEditorViewColumn)(listener, thisArg, disposables);
            },
            onDidChangeTextEditorDiffInformation(listener, thisArg, disposables) {
                checkProposedApiEnabled(extension, 'textEditorDiffInformation');
                return _asExtensionEvent(extHostEditors.onDidChangeTextEditorDiffInformation)(listener, thisArg, disposables);
            },
            onDidCloseTerminal(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostTerminalService.onDidCloseTerminal)(listener, thisArg, disposables);
            },
            onDidOpenTerminal(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostTerminalService.onDidOpenTerminal)(listener, thisArg, disposables);
            },
            onDidChangeActiveTerminal(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostTerminalService.onDidChangeActiveTerminal)(listener, thisArg, disposables);
            },
            onDidChangeTerminalDimensions(listener, thisArg, disposables) {
                checkProposedApiEnabled(extension, 'terminalDimensions');
                return _asExtensionEvent(extHostTerminalService.onDidChangeTerminalDimensions)(listener, thisArg, disposables);
            },
            onDidChangeTerminalState(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostTerminalService.onDidChangeTerminalState)(listener, thisArg, disposables);
            },
            onDidWriteTerminalData(listener, thisArg, disposables) {
                checkProposedApiEnabled(extension, 'terminalDataWriteEvent');
                return _asExtensionEvent(extHostTerminalService.onDidWriteTerminalData)(listener, thisArg, disposables);
            },
            onDidExecuteTerminalCommand(listener, thisArg, disposables) {
                checkProposedApiEnabled(extension, 'terminalExecuteCommandEvent');
                return _asExtensionEvent(extHostTerminalService.onDidExecuteTerminalCommand)(listener, thisArg, disposables);
            },
            onDidChangeTerminalShellIntegration(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostTerminalShellIntegration.onDidChangeTerminalShellIntegration)(listener, thisArg, disposables);
            },
            onDidStartTerminalShellExecution(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostTerminalShellIntegration.onDidStartTerminalShellExecution)(listener, thisArg, disposables);
            },
            onDidEndTerminalShellExecution(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostTerminalShellIntegration.onDidEndTerminalShellExecution)(listener, thisArg, disposables);
            },
            get state() {
                return extHostWindow.getState();
            },
            onDidChangeWindowState(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostWindow.onDidChangeWindowState)(listener, thisArg, disposables);
            },
            showInformationMessage(message, ...rest) {
                return extHostMessageService.showMessage(extension, Severity.Info, message, rest[0], rest.slice(1));
            },
            showWarningMessage(message, ...rest) {
                return extHostMessageService.showMessage(extension, Severity.Warning, message, rest[0], rest.slice(1));
            },
            showErrorMessage(message, ...rest) {
                return extHostMessageService.showMessage(extension, Severity.Error, message, rest[0], rest.slice(1));
            },
            showQuickPick(items, options, token) {
                return extHostQuickOpen.showQuickPick(extension, items, options, token);
            },
            showWorkspaceFolderPick(options) {
                return extHostQuickOpen.showWorkspaceFolderPick(options);
            },
            showInputBox(options, token) {
                return extHostQuickOpen.showInput(options, token);
            },
            showOpenDialog(options) {
                return extHostDialogs.showOpenDialog(options);
            },
            showSaveDialog(options) {
                return extHostDialogs.showSaveDialog(options);
            },
            createStatusBarItem(alignmentOrId, priorityOrAlignment, priorityArg) {
                let id;
                let alignment;
                let priority;
                if (typeof alignmentOrId === 'string') {
                    id = alignmentOrId;
                    alignment = priorityOrAlignment;
                    priority = priorityArg;
                }
                else {
                    alignment = alignmentOrId;
                    priority = priorityOrAlignment;
                }
                return extHostStatusBar.createStatusBarEntry(extension, id, alignment, priority);
            },
            setStatusBarMessage(text, timeoutOrThenable) {
                return extHostStatusBar.setStatusBarMessage(text, timeoutOrThenable);
            },
            withScmProgress(task) {
                extHostApiDeprecation.report('window.withScmProgress', extension, `Use 'withProgress' instead.`);
                return extHostProgress.withProgress(extension, { location: extHostTypes.ProgressLocation.SourceControl }, (progress, token) => task({ report(n) { } }));
            },
            withProgress(options, task) {
                return extHostProgress.withProgress(extension, options, task);
            },
            createOutputChannel(name, options) {
                return extHostOutputService.createOutputChannel(name, options, extension);
            },
            createWebviewPanel(viewType, title, showOptions, options) {
                return extHostWebviewPanels.createWebviewPanel(extension, viewType, title, showOptions, options);
            },
            createWebviewTextEditorInset(editor, line, height, options) {
                checkProposedApiEnabled(extension, 'editorInsets');
                return extHostEditorInsets.createWebviewEditorInset(editor, line, height, options, extension);
            },
            createTerminal(nameOrOptions, shellPath, shellArgs) {
                if (typeof nameOrOptions === 'object') {
                    if ('pty' in nameOrOptions) {
                        return extHostTerminalService.createExtensionTerminal(nameOrOptions);
                    }
                    return extHostTerminalService.createTerminalFromOptions(nameOrOptions);
                }
                return extHostTerminalService.createTerminal(nameOrOptions, shellPath, shellArgs);
            },
            registerTerminalLinkProvider(provider) {
                return extHostTerminalService.registerLinkProvider(provider);
            },
            registerTerminalProfileProvider(id, provider) {
                return extHostTerminalService.registerProfileProvider(extension, id, provider);
            },
            registerTerminalCompletionProvider(provider, ...triggerCharacters) {
                checkProposedApiEnabled(extension, 'terminalCompletionProvider');
                return extHostTerminalService.registerTerminalCompletionProvider(extension, provider, ...triggerCharacters);
            },
            registerTerminalQuickFixProvider(id, provider) {
                checkProposedApiEnabled(extension, 'terminalQuickFixProvider');
                return extHostTerminalService.registerTerminalQuickFixProvider(id, extension.identifier.value, provider);
            },
            registerTreeDataProvider(viewId, treeDataProvider) {
                return extHostTreeViews.registerTreeDataProvider(viewId, treeDataProvider, extension);
            },
            createTreeView(viewId, options) {
                return extHostTreeViews.createTreeView(viewId, options, extension);
            },
            registerWebviewPanelSerializer: (viewType, serializer) => {
                return extHostWebviewPanels.registerWebviewPanelSerializer(extension, viewType, serializer);
            },
            registerCustomEditorProvider: (viewType, provider, options = {}) => {
                return extHostCustomEditors.registerCustomEditorProvider(extension, viewType, provider, options);
            },
            registerFileDecorationProvider(provider) {
                return extHostDecorations.registerFileDecorationProvider(provider, extension);
            },
            registerUriHandler(handler) {
                return extHostUrls.registerUriHandler(extension, handler);
            },
            createQuickPick() {
                return extHostQuickOpen.createQuickPick(extension);
            },
            createInputBox() {
                return extHostQuickOpen.createInputBox(extension);
            },
            get activeColorTheme() {
                return extHostTheming.activeColorTheme;
            },
            onDidChangeActiveColorTheme(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostTheming.onDidChangeActiveColorTheme)(listener, thisArg, disposables);
            },
            registerWebviewViewProvider(viewId, provider, options) {
                return extHostWebviewViews.registerWebviewViewProvider(extension, viewId, provider, options?.webviewOptions);
            },
            get activeNotebookEditor() {
                return extHostNotebook.activeNotebookEditor;
            },
            onDidChangeActiveNotebookEditor(listener, thisArgs, disposables) {
                return _asExtensionEvent(extHostNotebook.onDidChangeActiveNotebookEditor)(listener, thisArgs, disposables);
            },
            get visibleNotebookEditors() {
                return extHostNotebook.visibleNotebookEditors;
            },
            get onDidChangeVisibleNotebookEditors() {
                return _asExtensionEvent(extHostNotebook.onDidChangeVisibleNotebookEditors);
            },
            onDidChangeNotebookEditorSelection(listener, thisArgs, disposables) {
                return _asExtensionEvent(extHostNotebookEditors.onDidChangeNotebookEditorSelection)(listener, thisArgs, disposables);
            },
            onDidChangeNotebookEditorVisibleRanges(listener, thisArgs, disposables) {
                return _asExtensionEvent(extHostNotebookEditors.onDidChangeNotebookEditorVisibleRanges)(listener, thisArgs, disposables);
            },
            showNotebookDocument(document, options) {
                return extHostNotebook.showNotebookDocument(document, options);
            },
            registerExternalUriOpener(id, opener, metadata) {
                checkProposedApiEnabled(extension, 'externalUriOpener');
                return extHostUriOpeners.registerExternalUriOpener(extension.identifier, id, opener, metadata);
            },
            registerProfileContentHandler(id, handler) {
                checkProposedApiEnabled(extension, 'profileContentHandlers');
                return extHostProfileContentHandlers.registerProfileContentHandler(extension, id, handler);
            },
            registerQuickDiffProvider(selector, quickDiffProvider, id, label, rootUri) {
                checkProposedApiEnabled(extension, 'quickDiffProvider');
                return extHostQuickDiff.registerQuickDiffProvider(extension, checkSelector(selector), quickDiffProvider, id, label, rootUri);
            },
            get tabGroups() {
                return extHostEditorTabs.tabGroups;
            },
            registerShareProvider(selector, provider) {
                checkProposedApiEnabled(extension, 'shareProvider');
                return extHostShare.registerShareProvider(checkSelector(selector), provider);
            },
            get nativeHandle() {
                checkProposedApiEnabled(extension, 'nativeWindowHandle');
                return extHostWindow.nativeHandle;
            },
            createChatStatusItem: (id) => {
                checkProposedApiEnabled(extension, 'chatStatusItem');
                return extHostChatStatus.createChatStatusItem(extension, id);
            },
        };
        // namespace: workspace
        const workspace = {
            get rootPath() {
                extHostApiDeprecation.report('workspace.rootPath', extension, `Please use 'workspace.workspaceFolders' instead. More details: https://aka.ms/vscode-eliminating-rootpath`);
                return extHostWorkspace.getPath();
            },
            set rootPath(value) {
                throw new errors.ReadonlyError('rootPath');
            },
            getWorkspaceFolder(resource) {
                return extHostWorkspace.getWorkspaceFolder(resource);
            },
            get workspaceFolders() {
                return extHostWorkspace.getWorkspaceFolders();
            },
            get name() {
                return extHostWorkspace.name;
            },
            set name(value) {
                throw new errors.ReadonlyError('name');
            },
            get workspaceFile() {
                return extHostWorkspace.workspaceFile;
            },
            set workspaceFile(value) {
                throw new errors.ReadonlyError('workspaceFile');
            },
            updateWorkspaceFolders: (index, deleteCount, ...workspaceFoldersToAdd) => {
                return extHostWorkspace.updateWorkspaceFolders(extension, index, deleteCount || 0, ...workspaceFoldersToAdd);
            },
            onDidChangeWorkspaceFolders: function (listener, thisArgs, disposables) {
                return _asExtensionEvent(extHostWorkspace.onDidChangeWorkspace)(listener, thisArgs, disposables);
            },
            asRelativePath: (pathOrUri, includeWorkspace) => {
                return extHostWorkspace.getRelativePath(pathOrUri, includeWorkspace);
            },
            findFiles: (include, exclude, maxResults, token) => {
                // Note, undefined/null have different meanings on "exclude"
                return extHostWorkspace.findFiles(include, exclude, maxResults, extension.identifier, token);
            },
            findFiles2: (filePattern, options, token) => {
                checkProposedApiEnabled(extension, 'findFiles2');
                return extHostWorkspace.findFiles2(filePattern, options, extension.identifier, token);
            },
            findTextInFiles: (query, optionsOrCallback, callbackOrToken, token) => {
                checkProposedApiEnabled(extension, 'findTextInFiles');
                let options;
                let callback;
                if (typeof optionsOrCallback === 'object') {
                    options = optionsOrCallback;
                    callback = callbackOrToken;
                }
                else {
                    options = {};
                    callback = optionsOrCallback;
                    token = callbackOrToken;
                }
                return extHostWorkspace.findTextInFiles(query, options || {}, callback, extension.identifier, token);
            },
            findTextInFiles2: (query, options, token) => {
                checkProposedApiEnabled(extension, 'findTextInFiles2');
                checkProposedApiEnabled(extension, 'textSearchProvider2');
                return extHostWorkspace.findTextInFiles2(query, options, extension.identifier, token);
            },
            save: (uri) => {
                return extHostWorkspace.save(uri);
            },
            saveAs: (uri) => {
                return extHostWorkspace.saveAs(uri);
            },
            saveAll: (includeUntitled) => {
                return extHostWorkspace.saveAll(includeUntitled);
            },
            applyEdit(edit, metadata) {
                return extHostBulkEdits.applyWorkspaceEdit(edit, extension, metadata);
            },
            createFileSystemWatcher: (pattern, optionsOrIgnoreCreate, ignoreChange, ignoreDelete) => {
                const options = {
                    ignoreCreateEvents: Boolean(optionsOrIgnoreCreate),
                    ignoreChangeEvents: Boolean(ignoreChange),
                    ignoreDeleteEvents: Boolean(ignoreDelete),
                };
                return extHostFileSystemEvent.createFileSystemWatcher(extHostWorkspace, configProvider, extension, pattern, options);
            },
            get textDocuments() {
                return extHostDocuments.getAllDocumentData().map(data => data.document);
            },
            set textDocuments(value) {
                throw new errors.ReadonlyError('textDocuments');
            },
            openTextDocument(uriOrFileNameOrOptions, options) {
                let uriPromise;
                options = (options ?? uriOrFileNameOrOptions);
                if (typeof uriOrFileNameOrOptions === 'string') {
                    uriPromise = Promise.resolve(URI.file(uriOrFileNameOrOptions));
                }
                else if (URI.isUri(uriOrFileNameOrOptions)) {
                    uriPromise = Promise.resolve(uriOrFileNameOrOptions);
                }
                else if (!options || typeof options === 'object') {
                    uriPromise = extHostDocuments.createDocumentData(options);
                }
                else {
                    throw new Error('illegal argument - uriOrFileNameOrOptions');
                }
                return uriPromise.then(uri => {
                    extHostLogService.trace(`openTextDocument from ${extension.identifier}`);
                    if (uri.scheme === Schemas.vscodeRemote && !uri.authority) {
                        extHostApiDeprecation.report('workspace.openTextDocument', extension, `A URI of 'vscode-remote' scheme requires an authority.`);
                    }
                    return extHostDocuments.ensureDocumentData(uri, options).then(documentData => {
                        return documentData.document;
                    });
                });
            },
            onDidOpenTextDocument: (listener, thisArgs, disposables) => {
                return _asExtensionEvent(extHostDocuments.onDidAddDocument)(listener, thisArgs, disposables);
            },
            onDidCloseTextDocument: (listener, thisArgs, disposables) => {
                return _asExtensionEvent(extHostDocuments.onDidRemoveDocument)(listener, thisArgs, disposables);
            },
            onDidChangeTextDocument: (listener, thisArgs, disposables) => {
                if (isProposedApiEnabled(extension, 'textDocumentChangeReason')) {
                    return _asExtensionEvent(extHostDocuments.onDidChangeDocumentWithReason)(listener, thisArgs, disposables);
                }
                return _asExtensionEvent(extHostDocuments.onDidChangeDocument)(listener, thisArgs, disposables);
            },
            onDidSaveTextDocument: (listener, thisArgs, disposables) => {
                return _asExtensionEvent(extHostDocuments.onDidSaveDocument)(listener, thisArgs, disposables);
            },
            onWillSaveTextDocument: (listener, thisArgs, disposables) => {
                return _asExtensionEvent(extHostDocumentSaveParticipant.getOnWillSaveTextDocumentEvent(extension))(listener, thisArgs, disposables);
            },
            get notebookDocuments() {
                return extHostNotebook.notebookDocuments.map(d => d.apiNotebook);
            },
            async openNotebookDocument(uriOrType, content) {
                let uri;
                if (URI.isUri(uriOrType)) {
                    uri = uriOrType;
                    await extHostNotebook.openNotebookDocument(uriOrType);
                }
                else if (typeof uriOrType === 'string') {
                    uri = URI.revive(await extHostNotebook.createNotebookDocument({ viewType: uriOrType, content }));
                }
                else {
                    throw new Error('Invalid arguments');
                }
                return extHostNotebook.getNotebookDocument(uri).apiNotebook;
            },
            onDidSaveNotebookDocument(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostNotebookDocuments.onDidSaveNotebookDocument)(listener, thisArg, disposables);
            },
            onDidChangeNotebookDocument(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostNotebookDocuments.onDidChangeNotebookDocument)(listener, thisArg, disposables);
            },
            onWillSaveNotebookDocument(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostNotebookDocumentSaveParticipant.getOnWillSaveNotebookDocumentEvent(extension))(listener, thisArg, disposables);
            },
            get onDidOpenNotebookDocument() {
                return _asExtensionEvent(extHostNotebook.onDidOpenNotebookDocument);
            },
            get onDidCloseNotebookDocument() {
                return _asExtensionEvent(extHostNotebook.onDidCloseNotebookDocument);
            },
            registerNotebookSerializer(viewType, serializer, options, registration) {
                return extHostNotebook.registerNotebookSerializer(extension, viewType, serializer, options, isProposedApiEnabled(extension, 'notebookLiveShare') ? registration : undefined);
            },
            onDidChangeConfiguration: (listener, thisArgs, disposables) => {
                return _asExtensionEvent(configProvider.onDidChangeConfiguration)(listener, thisArgs, disposables);
            },
            getConfiguration(section, scope) {
                scope = arguments.length === 1 ? undefined : scope;
                return configProvider.getConfiguration(section, scope, extension);
            },
            registerTextDocumentContentProvider(scheme, provider) {
                return extHostDocumentContentProviders.registerTextDocumentContentProvider(scheme, provider);
            },
            registerTaskProvider: (type, provider) => {
                extHostApiDeprecation.report('window.registerTaskProvider', extension, `Use the corresponding function on the 'tasks' namespace instead`);
                return extHostTask.registerTaskProvider(extension, type, provider);
            },
            registerFileSystemProvider(scheme, provider, options) {
                return combinedDisposable(extHostFileSystem.registerFileSystemProvider(extension, scheme, provider, options), extHostConsumerFileSystem.addFileSystemProvider(scheme, provider, options));
            },
            get fs() {
                return extHostConsumerFileSystem.value;
            },
            registerFileSearchProvider: (scheme, provider) => {
                checkProposedApiEnabled(extension, 'fileSearchProvider');
                return extHostSearch.registerFileSearchProviderOld(scheme, provider);
            },
            registerTextSearchProvider: (scheme, provider) => {
                checkProposedApiEnabled(extension, 'textSearchProvider');
                return extHostSearch.registerTextSearchProviderOld(scheme, provider);
            },
            registerAITextSearchProvider: (scheme, provider) => {
                // there are some dependencies on textSearchProvider, so we need to check for both
                checkProposedApiEnabled(extension, 'aiTextSearchProvider');
                checkProposedApiEnabled(extension, 'textSearchProvider2');
                return extHostSearch.registerAITextSearchProvider(scheme, provider);
            },
            registerFileSearchProvider2: (scheme, provider) => {
                checkProposedApiEnabled(extension, 'fileSearchProvider2');
                return extHostSearch.registerFileSearchProvider(scheme, provider);
            },
            registerTextSearchProvider2: (scheme, provider) => {
                checkProposedApiEnabled(extension, 'textSearchProvider2');
                return extHostSearch.registerTextSearchProvider(scheme, provider);
            },
            registerRemoteAuthorityResolver: (authorityPrefix, resolver) => {
                checkProposedApiEnabled(extension, 'resolvers');
                return extensionService.registerRemoteAuthorityResolver(authorityPrefix, resolver);
            },
            registerResourceLabelFormatter: (formatter) => {
                checkProposedApiEnabled(extension, 'resolvers');
                return extHostLabelService.$registerResourceLabelFormatter(formatter);
            },
            getRemoteExecServer: (authority) => {
                checkProposedApiEnabled(extension, 'resolvers');
                return extensionService.getRemoteExecServer(authority);
            },
            onDidCreateFiles: (listener, thisArg, disposables) => {
                return _asExtensionEvent(extHostFileSystemEvent.onDidCreateFile)(listener, thisArg, disposables);
            },
            onDidDeleteFiles: (listener, thisArg, disposables) => {
                return _asExtensionEvent(extHostFileSystemEvent.onDidDeleteFile)(listener, thisArg, disposables);
            },
            onDidRenameFiles: (listener, thisArg, disposables) => {
                return _asExtensionEvent(extHostFileSystemEvent.onDidRenameFile)(listener, thisArg, disposables);
            },
            onWillCreateFiles: (listener, thisArg, disposables) => {
                return _asExtensionEvent(extHostFileSystemEvent.getOnWillCreateFileEvent(extension))(listener, thisArg, disposables);
            },
            onWillDeleteFiles: (listener, thisArg, disposables) => {
                return _asExtensionEvent(extHostFileSystemEvent.getOnWillDeleteFileEvent(extension))(listener, thisArg, disposables);
            },
            onWillRenameFiles: (listener, thisArg, disposables) => {
                return _asExtensionEvent(extHostFileSystemEvent.getOnWillRenameFileEvent(extension))(listener, thisArg, disposables);
            },
            openTunnel: (forward) => {
                checkProposedApiEnabled(extension, 'tunnels');
                return extHostTunnelService.openTunnel(extension, forward).then(value => {
                    if (!value) {
                        throw new Error('cannot open tunnel');
                    }
                    return value;
                });
            },
            get tunnels() {
                checkProposedApiEnabled(extension, 'tunnels');
                return extHostTunnelService.getTunnels();
            },
            onDidChangeTunnels: (listener, thisArg, disposables) => {
                checkProposedApiEnabled(extension, 'tunnels');
                return _asExtensionEvent(extHostTunnelService.onDidChangeTunnels)(listener, thisArg, disposables);
            },
            registerPortAttributesProvider: (portSelector, provider) => {
                checkProposedApiEnabled(extension, 'portsAttributes');
                return extHostTunnelService.registerPortsAttributesProvider(portSelector, provider);
            },
            registerTunnelProvider: (tunnelProvider, information) => {
                checkProposedApiEnabled(extension, 'tunnelFactory');
                return extHostTunnelService.registerTunnelProvider(tunnelProvider, information);
            },
            registerTimelineProvider: (scheme, provider) => {
                checkProposedApiEnabled(extension, 'timeline');
                return extHostTimeline.registerTimelineProvider(scheme, provider, extension.identifier, extHostCommands.converter);
            },
            get isTrusted() {
                return extHostWorkspace.trusted;
            },
            requestWorkspaceTrust: (options) => {
                checkProposedApiEnabled(extension, 'workspaceTrust');
                return extHostWorkspace.requestWorkspaceTrust(options);
            },
            onDidGrantWorkspaceTrust: (listener, thisArgs, disposables) => {
                return _asExtensionEvent(extHostWorkspace.onDidGrantWorkspaceTrust)(listener, thisArgs, disposables);
            },
            registerEditSessionIdentityProvider: (scheme, provider) => {
                checkProposedApiEnabled(extension, 'editSessionIdentityProvider');
                return extHostWorkspace.registerEditSessionIdentityProvider(scheme, provider);
            },
            onWillCreateEditSessionIdentity: (listener, thisArgs, disposables) => {
                checkProposedApiEnabled(extension, 'editSessionIdentityProvider');
                return _asExtensionEvent(extHostWorkspace.getOnWillCreateEditSessionIdentityEvent(extension))(listener, thisArgs, disposables);
            },
            registerCanonicalUriProvider: (scheme, provider) => {
                checkProposedApiEnabled(extension, 'canonicalUriProvider');
                return extHostWorkspace.registerCanonicalUriProvider(scheme, provider);
            },
            getCanonicalUri: (uri, options, token) => {
                checkProposedApiEnabled(extension, 'canonicalUriProvider');
                return extHostWorkspace.provideCanonicalUri(uri, options, token);
            },
            decode(content, options) {
                return extHostWorkspace.decode(content, options);
            },
            encode(content, options) {
                return extHostWorkspace.encode(content, options);
            },
        };
        // namespace: scm
        const scm = {
            get inputBox() {
                extHostApiDeprecation.report('scm.inputBox', extension, `Use 'SourceControl.inputBox' instead`);
                return extHostSCM.getLastInputBox(extension); // Strict null override - Deprecated api
            },
            createSourceControl(id, label, rootUri, iconPath, parent) {
                if (iconPath || parent) {
                    checkProposedApiEnabled(extension, 'scmProviderOptions');
                }
                return extHostSCM.createSourceControl(extension, id, label, rootUri, iconPath, parent);
            }
        };
        // namespace: comments
        const comments = {
            createCommentController(id, label) {
                return extHostComment.createCommentController(extension, id, label);
            }
        };
        // namespace: debug
        const debug = {
            get activeDebugSession() {
                return extHostDebugService.activeDebugSession;
            },
            get activeDebugConsole() {
                return extHostDebugService.activeDebugConsole;
            },
            get breakpoints() {
                return extHostDebugService.breakpoints;
            },
            get activeStackItem() {
                return extHostDebugService.activeStackItem;
            },
            registerDebugVisualizationProvider(id, provider) {
                checkProposedApiEnabled(extension, 'debugVisualization');
                return extHostDebugService.registerDebugVisualizationProvider(extension, id, provider);
            },
            registerDebugVisualizationTreeProvider(id, provider) {
                checkProposedApiEnabled(extension, 'debugVisualization');
                return extHostDebugService.registerDebugVisualizationTree(extension, id, provider);
            },
            onDidStartDebugSession(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostDebugService.onDidStartDebugSession)(listener, thisArg, disposables);
            },
            onDidTerminateDebugSession(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostDebugService.onDidTerminateDebugSession)(listener, thisArg, disposables);
            },
            onDidChangeActiveDebugSession(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostDebugService.onDidChangeActiveDebugSession)(listener, thisArg, disposables);
            },
            onDidReceiveDebugSessionCustomEvent(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostDebugService.onDidReceiveDebugSessionCustomEvent)(listener, thisArg, disposables);
            },
            onDidChangeBreakpoints(listener, thisArgs, disposables) {
                return _asExtensionEvent(extHostDebugService.onDidChangeBreakpoints)(listener, thisArgs, disposables);
            },
            onDidChangeActiveStackItem(listener, thisArg, disposables) {
                return _asExtensionEvent(extHostDebugService.onDidChangeActiveStackItem)(listener, thisArg, disposables);
            },
            registerDebugConfigurationProvider(debugType, provider, triggerKind) {
                return extHostDebugService.registerDebugConfigurationProvider(debugType, provider, triggerKind || DebugConfigurationProviderTriggerKind.Initial);
            },
            registerDebugAdapterDescriptorFactory(debugType, factory) {
                return extHostDebugService.registerDebugAdapterDescriptorFactory(extension, debugType, factory);
            },
            registerDebugAdapterTrackerFactory(debugType, factory) {
                return extHostDebugService.registerDebugAdapterTrackerFactory(debugType, factory);
            },
            startDebugging(folder, nameOrConfig, parentSessionOrOptions) {
                if (!parentSessionOrOptions || (typeof parentSessionOrOptions === 'object' && 'configuration' in parentSessionOrOptions)) {
                    return extHostDebugService.startDebugging(folder, nameOrConfig, { parentSession: parentSessionOrOptions });
                }
                return extHostDebugService.startDebugging(folder, nameOrConfig, parentSessionOrOptions || {});
            },
            stopDebugging(session) {
                return extHostDebugService.stopDebugging(session);
            },
            addBreakpoints(breakpoints) {
                return extHostDebugService.addBreakpoints(breakpoints);
            },
            removeBreakpoints(breakpoints) {
                return extHostDebugService.removeBreakpoints(breakpoints);
            },
            asDebugSourceUri(source, session) {
                return extHostDebugService.asDebugSourceUri(source, session);
            }
        };
        const tasks = {
            registerTaskProvider: (type, provider) => {
                return extHostTask.registerTaskProvider(extension, type, provider);
            },
            fetchTasks: (filter) => {
                return extHostTask.fetchTasks(filter);
            },
            executeTask: (task) => {
                return extHostTask.executeTask(extension, task);
            },
            get taskExecutions() {
                return extHostTask.taskExecutions;
            },
            onDidStartTask: (listener, thisArgs, disposables) => {
                const wrappedListener = (event) => {
                    if (!isProposedApiEnabled(extension, 'taskExecutionTerminal')) {
                        if (event?.execution?.terminal !== undefined) {
                            event.execution.terminal = undefined;
                        }
                    }
                    const eventWithExecution = {
                        ...event,
                        execution: event.execution
                    };
                    return listener.call(thisArgs, eventWithExecution);
                };
                return _asExtensionEvent(extHostTask.onDidStartTask)(wrappedListener, thisArgs, disposables);
            },
            onDidEndTask: (listeners, thisArgs, disposables) => {
                return _asExtensionEvent(extHostTask.onDidEndTask)(listeners, thisArgs, disposables);
            },
            onDidStartTaskProcess: (listeners, thisArgs, disposables) => {
                return _asExtensionEvent(extHostTask.onDidStartTaskProcess)(listeners, thisArgs, disposables);
            },
            onDidEndTaskProcess: (listeners, thisArgs, disposables) => {
                return _asExtensionEvent(extHostTask.onDidEndTaskProcess)(listeners, thisArgs, disposables);
            },
            onDidStartTaskProblemMatchers: (listeners, thisArgs, disposables) => {
                checkProposedApiEnabled(extension, 'taskProblemMatcherStatus');
                return _asExtensionEvent(extHostTask.onDidStartTaskProblemMatchers)(listeners, thisArgs, disposables);
            },
            onDidEndTaskProblemMatchers: (listeners, thisArgs, disposables) => {
                checkProposedApiEnabled(extension, 'taskProblemMatcherStatus');
                return _asExtensionEvent(extHostTask.onDidEndTaskProblemMatchers)(listeners, thisArgs, disposables);
            }
        };
        // namespace: notebook
        const notebooks = {
            createNotebookController(id, notebookType, label, handler, rendererScripts) {
                return extHostNotebookKernels.createNotebookController(extension, id, notebookType, label, handler, isProposedApiEnabled(extension, 'notebookMessaging') ? rendererScripts : undefined);
            },
            registerNotebookCellStatusBarItemProvider: (notebookType, provider) => {
                return extHostNotebook.registerNotebookCellStatusBarItemProvider(extension, notebookType, provider);
            },
            createRendererMessaging(rendererId) {
                return extHostNotebookRenderers.createRendererMessaging(extension, rendererId);
            },
            createNotebookControllerDetectionTask(notebookType) {
                checkProposedApiEnabled(extension, 'notebookKernelSource');
                return extHostNotebookKernels.createNotebookControllerDetectionTask(extension, notebookType);
            },
            registerKernelSourceActionProvider(notebookType, provider) {
                checkProposedApiEnabled(extension, 'notebookKernelSource');
                return extHostNotebookKernels.registerKernelSourceActionProvider(extension, notebookType, provider);
            },
        };
        // namespace: l10n
        const l10n = {
            t(...params) {
                if (typeof params[0] === 'string') {
                    const key = params.shift();
                    // We have either rest args which are Array<string | number | boolean> or an array with a single Record<string, any>.
                    // This ensures we get a Record<string | number, any> which will be formatted correctly.
                    const argsFormatted = !params || typeof params[0] !== 'object' ? params : params[0];
                    return extHostLocalization.getMessage(extension.identifier.value, { message: key, args: argsFormatted });
                }
                return extHostLocalization.getMessage(extension.identifier.value, params[0]);
            },
            get bundle() {
                return extHostLocalization.getBundle(extension.identifier.value);
            },
            get uri() {
                return extHostLocalization.getBundleUri(extension.identifier.value);
            }
        };
        // namespace: interactive
        const interactive = {
            transferActiveChat(toWorkspace) {
                checkProposedApiEnabled(extension, 'interactive');
                return extHostChatAgents2.transferActiveChat(toWorkspace);
            }
        };
        // namespace: ai
        const ai = {
            getRelatedInformation(query, types) {
                checkProposedApiEnabled(extension, 'aiRelatedInformation');
                return extHostAiRelatedInformation.getRelatedInformation(extension, query, types);
            },
            registerRelatedInformationProvider(type, provider) {
                checkProposedApiEnabled(extension, 'aiRelatedInformation');
                return extHostAiRelatedInformation.registerRelatedInformationProvider(extension, type, provider);
            },
            registerEmbeddingVectorProvider(model, provider) {
                checkProposedApiEnabled(extension, 'aiRelatedInformation');
                return extHostAiEmbeddingVector.registerEmbeddingVectorProvider(extension, model, provider);
            },
            registerSettingsSearchProvider(provider) {
                checkProposedApiEnabled(extension, 'aiSettingsSearch');
                return extHostAiSettingsSearch.registerSettingsSearchProvider(extension, provider);
            }
        };
        // namespace: chatregisterMcpServerDefinitionProvider
        const chat = {
            registerMappedEditsProvider(_selector, _provider) {
                checkProposedApiEnabled(extension, 'mappedEditsProvider');
                // no longer supported
                return { dispose() { } };
            },
            registerMappedEditsProvider2(provider) {
                checkProposedApiEnabled(extension, 'mappedEditsProvider');
                return extHostCodeMapper.registerMappedEditsProvider(extension, provider);
            },
            createChatParticipant(id, handler) {
                return extHostChatAgents2.createChatAgent(extension, id, handler);
            },
            createDynamicChatParticipant(id, dynamicProps, handler) {
                checkProposedApiEnabled(extension, 'chatParticipantPrivate');
                return extHostChatAgents2.createDynamicChatAgent(extension, id, dynamicProps, handler);
            },
            registerChatParticipantDetectionProvider(provider) {
                checkProposedApiEnabled(extension, 'chatParticipantPrivate');
                return extHostChatAgents2.registerChatParticipantDetectionProvider(extension, provider);
            },
            registerRelatedFilesProvider(provider, metadata) {
                checkProposedApiEnabled(extension, 'chatEditing');
                return extHostChatAgents2.registerRelatedFilesProvider(extension, provider, metadata);
            },
            onDidDisposeChatSession: (listeners, thisArgs, disposables) => {
                checkProposedApiEnabled(extension, 'chatParticipantPrivate');
                return _asExtensionEvent(extHostChatAgents2.onDidDisposeChatSession)(listeners, thisArgs, disposables);
            },
            registerChatSessionItemProvider: (chatSessionType, provider) => {
                checkProposedApiEnabled(extension, 'chatSessionsProvider');
                return extHostChatSessions.registerChatSessionItemProvider(extension, chatSessionType, provider);
            },
            registerChatSessionContentProvider(scheme, provider, chatParticipant, capabilities) {
                checkProposedApiEnabled(extension, 'chatSessionsProvider');
                return extHostChatSessions.registerChatSessionContentProvider(extension, scheme, chatParticipant, provider, capabilities);
            },
            registerChatOutputRenderer: (viewType, renderer) => {
                checkProposedApiEnabled(extension, 'chatOutputRenderer');
                return extHostChatOutputRenderer.registerChatOutputRenderer(extension, viewType, renderer);
            },
            registerChatContextProvider(selector, id, provider) {
                checkProposedApiEnabled(extension, 'chatContextProvider');
                return extHostChatContext.registerChatContextProvider(selector ? checkSelector(selector) : undefined, `${extension.id}-${id}`, provider);
            },
        };
        // namespace: lm
        const lm = {
            selectChatModels: (selector) => {
                return extHostLanguageModels.selectLanguageModels(extension, selector ?? {});
            },
            onDidChangeChatModels: (listener, thisArgs, disposables) => {
                return extHostLanguageModels.onDidChangeProviders(listener, thisArgs, disposables);
            },
            registerLanguageModelChatProvider: (vendor, provider) => {
                return extHostLanguageModels.registerLanguageModelChatProvider(extension, vendor, provider);
            },
            get isModelProxyAvailable() {
                checkProposedApiEnabled(extension, 'languageModelProxy');
                return extHostLanguageModels.isModelProxyAvailable;
            },
            onDidChangeModelProxyAvailability: (listener, thisArgs, disposables) => {
                checkProposedApiEnabled(extension, 'languageModelProxy');
                return extHostLanguageModels.onDidChangeModelProxyAvailability(listener, thisArgs, disposables);
            },
            getModelProxy: () => {
                checkProposedApiEnabled(extension, 'languageModelProxy');
                return extHostLanguageModels.getModelProxy(extension);
            },
            registerLanguageModelProxyProvider: (provider) => {
                checkProposedApiEnabled(extension, 'chatParticipantPrivate');
                return extHostLanguageModels.registerLanguageModelProxyProvider(extension, provider);
            },
            // --- embeddings
            get embeddingModels() {
                checkProposedApiEnabled(extension, 'embeddings');
                return extHostEmbeddings.embeddingsModels;
            },
            onDidChangeEmbeddingModels: (listener, thisArgs, disposables) => {
                checkProposedApiEnabled(extension, 'embeddings');
                return extHostEmbeddings.onDidChange(listener, thisArgs, disposables);
            },
            registerEmbeddingsProvider(embeddingsModel, provider) {
                checkProposedApiEnabled(extension, 'embeddings');
                return extHostEmbeddings.registerEmbeddingsProvider(extension, embeddingsModel, provider);
            },
            async computeEmbeddings(embeddingsModel, input, token) {
                checkProposedApiEnabled(extension, 'embeddings');
                if (typeof input === 'string') {
                    return extHostEmbeddings.computeEmbeddings(embeddingsModel, input, token);
                }
                else {
                    return extHostEmbeddings.computeEmbeddings(embeddingsModel, input, token);
                }
            },
            registerTool(name, tool) {
                return extHostLanguageModelTools.registerTool(extension, name, tool);
            },
            invokeTool(name, parameters, token) {
                return extHostLanguageModelTools.invokeTool(extension, name, parameters, token);
            },
            get tools() {
                return extHostLanguageModelTools.getTools(extension);
            },
            fileIsIgnored(uri, token) {
                return extHostLanguageModels.fileIsIgnored(extension, uri, token);
            },
            registerIgnoredFileProvider(provider) {
                return extHostLanguageModels.registerIgnoredFileProvider(extension, provider);
            },
            registerMcpServerDefinitionProvider(id, provider) {
                return extHostMcp.registerMcpConfigurationProvider(extension, id, provider);
            },
            onDidChangeChatRequestTools(...args) {
                checkProposedApiEnabled(extension, 'chatParticipantAdditions');
                return _asExtensionEvent(extHostChatAgents2.onDidChangeChatRequestTools)(...args);
            }
        };
        // namespace: speech
        const speech = {
            registerSpeechProvider(id, provider) {
                checkProposedApiEnabled(extension, 'speech');
                return extHostSpeech.registerProvider(extension.identifier, id, provider);
            }
        };
        // eslint-disable-next-line local/code-no-dangerous-type-assertions
        return {
            version: initData.version,
            // namespaces
            ai,
            authentication,
            commands,
            comments,
            chat,
            debug,
            env,
            extensions,
            interactive,
            l10n,
            languages,
            lm,
            notebooks,
            scm,
            speech,
            tasks,
            tests,
            window,
            workspace,
            // types
            Breakpoint: extHostTypes.Breakpoint,
            TerminalOutputAnchor: extHostTypes.TerminalOutputAnchor,
            ChatResultFeedbackKind: extHostTypes.ChatResultFeedbackKind,
            ChatVariableLevel: extHostTypes.ChatVariableLevel,
            ChatCompletionItem: extHostTypes.ChatCompletionItem,
            ChatReferenceDiagnostic: extHostTypes.ChatReferenceDiagnostic,
            CallHierarchyIncomingCall: extHostTypes.CallHierarchyIncomingCall,
            CallHierarchyItem: extHostTypes.CallHierarchyItem,
            CallHierarchyOutgoingCall: extHostTypes.CallHierarchyOutgoingCall,
            CancellationError: errors.CancellationError,
            CancellationTokenSource: CancellationTokenSource,
            CandidatePortSource: CandidatePortSource,
            CodeAction: extHostTypes.CodeAction,
            CodeActionKind: extHostTypes.CodeActionKind,
            CodeActionTriggerKind: extHostTypes.CodeActionTriggerKind,
            CodeLens: extHostTypes.CodeLens,
            Color: extHostTypes.Color,
            ColorInformation: extHostTypes.ColorInformation,
            ColorPresentation: extHostTypes.ColorPresentation,
            ColorThemeKind: extHostTypes.ColorThemeKind,
            CommentMode: extHostTypes.CommentMode,
            CommentState: extHostTypes.CommentState,
            CommentThreadCollapsibleState: extHostTypes.CommentThreadCollapsibleState,
            CommentThreadState: extHostTypes.CommentThreadState,
            CommentThreadApplicability: extHostTypes.CommentThreadApplicability,
            CommentThreadFocus: extHostTypes.CommentThreadFocus,
            CompletionItem: extHostTypes.CompletionItem,
            CompletionItemKind: extHostTypes.CompletionItemKind,
            CompletionItemTag: extHostTypes.CompletionItemTag,
            CompletionList: extHostTypes.CompletionList,
            CompletionTriggerKind: extHostTypes.CompletionTriggerKind,
            ConfigurationTarget: extHostTypes.ConfigurationTarget,
            CustomExecution: extHostTypes.CustomExecution,
            DebugAdapterExecutable: extHostTypes.DebugAdapterExecutable,
            DebugAdapterInlineImplementation: extHostTypes.DebugAdapterInlineImplementation,
            DebugAdapterNamedPipeServer: extHostTypes.DebugAdapterNamedPipeServer,
            DebugAdapterServer: extHostTypes.DebugAdapterServer,
            DebugConfigurationProviderTriggerKind: DebugConfigurationProviderTriggerKind,
            DebugConsoleMode: extHostTypes.DebugConsoleMode,
            DebugVisualization: extHostTypes.DebugVisualization,
            DecorationRangeBehavior: extHostTypes.DecorationRangeBehavior,
            Diagnostic: extHostTypes.Diagnostic,
            DiagnosticRelatedInformation: extHostTypes.DiagnosticRelatedInformation,
            DiagnosticSeverity: extHostTypes.DiagnosticSeverity,
            DiagnosticTag: extHostTypes.DiagnosticTag,
            Disposable: extHostTypes.Disposable,
            DocumentHighlight: extHostTypes.DocumentHighlight,
            DocumentHighlightKind: extHostTypes.DocumentHighlightKind,
            MultiDocumentHighlight: extHostTypes.MultiDocumentHighlight,
            DocumentLink: extHostTypes.DocumentLink,
            DocumentSymbol: extHostTypes.DocumentSymbol,
            EndOfLine: extHostTypes.EndOfLine,
            EnvironmentVariableMutatorType: extHostTypes.EnvironmentVariableMutatorType,
            EvaluatableExpression: extHostTypes.EvaluatableExpression,
            InlineValueText: extHostTypes.InlineValueText,
            InlineValueVariableLookup: extHostTypes.InlineValueVariableLookup,
            InlineValueEvaluatableExpression: extHostTypes.InlineValueEvaluatableExpression,
            InlineCompletionTriggerKind: extHostTypes.InlineCompletionTriggerKind,
            InlineCompletionsDisposeReasonKind: extHostTypes.InlineCompletionsDisposeReasonKind,
            EventEmitter: Emitter,
            ExtensionKind: extHostTypes.ExtensionKind,
            ExtensionMode: extHostTypes.ExtensionMode,
            ExternalUriOpenerPriority: extHostTypes.ExternalUriOpenerPriority,
            FileChangeType: extHostTypes.FileChangeType,
            FileDecoration: extHostTypes.FileDecoration,
            FileDecoration2: extHostTypes.FileDecoration,
            FileSystemError: extHostTypes.FileSystemError,
            FileType: files.FileType,
            FilePermission: files.FilePermission,
            FoldingRange: extHostTypes.FoldingRange,
            FoldingRangeKind: extHostTypes.FoldingRangeKind,
            FunctionBreakpoint: extHostTypes.FunctionBreakpoint,
            InlineCompletionItem: extHostTypes.InlineSuggestion,
            InlineCompletionList: extHostTypes.InlineSuggestionList,
            Hover: extHostTypes.Hover,
            VerboseHover: extHostTypes.VerboseHover,
            HoverVerbosityAction: extHostTypes.HoverVerbosityAction,
            IndentAction: languageConfiguration.IndentAction,
            Location: extHostTypes.Location,
            MarkdownString: extHostTypes.MarkdownString,
            OverviewRulerLane: OverviewRulerLane,
            ParameterInformation: extHostTypes.ParameterInformation,
            PortAutoForwardAction: extHostTypes.PortAutoForwardAction,
            Position: extHostTypes.Position,
            ProcessExecution: extHostTypes.ProcessExecution,
            ProgressLocation: extHostTypes.ProgressLocation,
            QuickInputButtonLocation: extHostTypes.QuickInputButtonLocation,
            QuickInputButtons: extHostTypes.QuickInputButtons,
            Range: extHostTypes.Range,
            RelativePattern: extHostTypes.RelativePattern,
            Selection: extHostTypes.Selection,
            SelectionRange: extHostTypes.SelectionRange,
            SemanticTokens: extHostTypes.SemanticTokens,
            SemanticTokensBuilder: extHostTypes.SemanticTokensBuilder,
            SemanticTokensEdit: extHostTypes.SemanticTokensEdit,
            SemanticTokensEdits: extHostTypes.SemanticTokensEdits,
            SemanticTokensLegend: extHostTypes.SemanticTokensLegend,
            ShellExecution: extHostTypes.ShellExecution,
            ShellQuoting: extHostTypes.ShellQuoting,
            SignatureHelp: extHostTypes.SignatureHelp,
            SignatureHelpTriggerKind: extHostTypes.SignatureHelpTriggerKind,
            SignatureInformation: extHostTypes.SignatureInformation,
            SnippetString: extHostTypes.SnippetString,
            SourceBreakpoint: extHostTypes.SourceBreakpoint,
            StandardTokenType: extHostTypes.StandardTokenType,
            StatusBarAlignment: extHostTypes.StatusBarAlignment,
            SymbolInformation: extHostTypes.SymbolInformation,
            SymbolKind: extHostTypes.SymbolKind,
            SymbolTag: extHostTypes.SymbolTag,
            Task: extHostTypes.Task,
            TaskEventKind: extHostTypes.TaskEventKind,
            TaskGroup: extHostTypes.TaskGroup,
            TaskPanelKind: extHostTypes.TaskPanelKind,
            TaskRevealKind: extHostTypes.TaskRevealKind,
            TaskScope: extHostTypes.TaskScope,
            TerminalLink: extHostTypes.TerminalLink,
            TerminalQuickFixTerminalCommand: extHostTypes.TerminalQuickFixCommand,
            TerminalQuickFixOpener: extHostTypes.TerminalQuickFixOpener,
            TerminalLocation: extHostTypes.TerminalLocation,
            TerminalProfile: extHostTypes.TerminalProfile,
            TerminalExitReason: extHostTypes.TerminalExitReason,
            TerminalShellExecutionCommandLineConfidence: extHostTypes.TerminalShellExecutionCommandLineConfidence,
            TerminalCompletionItem: extHostTypes.TerminalCompletionItem,
            TerminalCompletionItemKind: extHostTypes.TerminalCompletionItemKind,
            TerminalCompletionList: extHostTypes.TerminalCompletionList,
            TerminalShellType: extHostTypes.TerminalShellType,
            TextDocumentSaveReason: extHostTypes.TextDocumentSaveReason,
            TextEdit: extHostTypes.TextEdit,
            SnippetTextEdit: extHostTypes.SnippetTextEdit,
            TextEditorCursorStyle: TextEditorCursorStyle,
            TextEditorChangeKind: extHostTypes.TextEditorChangeKind,
            TextEditorLineNumbersStyle: extHostTypes.TextEditorLineNumbersStyle,
            TextEditorRevealType: extHostTypes.TextEditorRevealType,
            TextEditorSelectionChangeKind: extHostTypes.TextEditorSelectionChangeKind,
            SyntaxTokenType: extHostTypes.SyntaxTokenType,
            TextDocumentChangeReason: extHostTypes.TextDocumentChangeReason,
            ThemeColor: extHostTypes.ThemeColor,
            ThemeIcon: extHostTypes.ThemeIcon,
            TreeItem: extHostTypes.TreeItem,
            TreeItemCheckboxState: extHostTypes.TreeItemCheckboxState,
            TreeItemCollapsibleState: extHostTypes.TreeItemCollapsibleState,
            TypeHierarchyItem: extHostTypes.TypeHierarchyItem,
            UIKind: UIKind,
            Uri: URI,
            ViewColumn: extHostTypes.ViewColumn,
            WorkspaceEdit: extHostTypes.WorkspaceEdit,
            // proposed api types
            DocumentPasteTriggerKind: extHostTypes.DocumentPasteTriggerKind,
            DocumentDropEdit: extHostTypes.DocumentDropEdit,
            DocumentDropOrPasteEditKind: extHostTypes.DocumentDropOrPasteEditKind,
            DocumentPasteEdit: extHostTypes.DocumentPasteEdit,
            InlayHint: extHostTypes.InlayHint,
            InlayHintLabelPart: extHostTypes.InlayHintLabelPart,
            InlayHintKind: extHostTypes.InlayHintKind,
            RemoteAuthorityResolverError: extHostTypes.RemoteAuthorityResolverError,
            ResolvedAuthority: extHostTypes.ResolvedAuthority,
            ManagedResolvedAuthority: extHostTypes.ManagedResolvedAuthority,
            SourceControlInputBoxValidationType: extHostTypes.SourceControlInputBoxValidationType,
            ExtensionRuntime: extHostTypes.ExtensionRuntime,
            TimelineItem: extHostTypes.TimelineItem,
            NotebookRange: extHostTypes.NotebookRange,
            NotebookCellKind: extHostTypes.NotebookCellKind,
            NotebookCellExecutionState: extHostTypes.NotebookCellExecutionState,
            NotebookCellData: extHostTypes.NotebookCellData,
            NotebookData: extHostTypes.NotebookData,
            NotebookRendererScript: extHostTypes.NotebookRendererScript,
            NotebookCellStatusBarAlignment: extHostTypes.NotebookCellStatusBarAlignment,
            NotebookEditorRevealType: extHostTypes.NotebookEditorRevealType,
            NotebookCellOutput: extHostTypes.NotebookCellOutput,
            NotebookCellOutputItem: extHostTypes.NotebookCellOutputItem,
            CellErrorStackFrame: extHostTypes.CellErrorStackFrame,
            NotebookCellStatusBarItem: extHostTypes.NotebookCellStatusBarItem,
            NotebookControllerAffinity: extHostTypes.NotebookControllerAffinity,
            NotebookControllerAffinity2: extHostTypes.NotebookControllerAffinity2,
            NotebookEdit: extHostTypes.NotebookEdit,
            NotebookKernelSourceAction: extHostTypes.NotebookKernelSourceAction,
            NotebookVariablesRequestKind: extHostTypes.NotebookVariablesRequestKind,
            PortAttributes: extHostTypes.PortAttributes,
            LinkedEditingRanges: extHostTypes.LinkedEditingRanges,
            TestResultState: extHostTypes.TestResultState,
            TestRunRequest: extHostTypes.TestRunRequest,
            TestMessage: extHostTypes.TestMessage,
            TestMessageStackFrame: extHostTypes.TestMessageStackFrame,
            TestTag: extHostTypes.TestTag,
            TestRunProfileKind: extHostTypes.TestRunProfileKind,
            TextSearchCompleteMessageType: TextSearchCompleteMessageType,
            DataTransfer: extHostTypes.DataTransfer,
            DataTransferItem: extHostTypes.DataTransferItem,
            TestCoverageCount: extHostTypes.TestCoverageCount,
            FileCoverage: extHostTypes.FileCoverage,
            StatementCoverage: extHostTypes.StatementCoverage,
            BranchCoverage: extHostTypes.BranchCoverage,
            DeclarationCoverage: extHostTypes.DeclarationCoverage,
            WorkspaceTrustState: extHostTypes.WorkspaceTrustState,
            LanguageStatusSeverity: extHostTypes.LanguageStatusSeverity,
            QuickPickItemKind: extHostTypes.QuickPickItemKind,
            InputBoxValidationSeverity: extHostTypes.InputBoxValidationSeverity,
            TabInputText: extHostTypes.TextTabInput,
            TabInputTextDiff: extHostTypes.TextDiffTabInput,
            TabInputTextMerge: extHostTypes.TextMergeTabInput,
            TabInputCustom: extHostTypes.CustomEditorTabInput,
            TabInputNotebook: extHostTypes.NotebookEditorTabInput,
            TabInputNotebookDiff: extHostTypes.NotebookDiffEditorTabInput,
            TabInputWebview: extHostTypes.WebviewEditorTabInput,
            TabInputTerminal: extHostTypes.TerminalEditorTabInput,
            TabInputInteractiveWindow: extHostTypes.InteractiveWindowInput,
            TabInputChat: extHostTypes.ChatEditorTabInput,
            TabInputTextMultiDiff: extHostTypes.TextMultiDiffTabInput,
            TelemetryTrustedValue: TelemetryTrustedValue,
            LogLevel: LogLevel,
            EditSessionIdentityMatch: EditSessionIdentityMatch,
            InteractiveSessionVoteDirection: extHostTypes.InteractiveSessionVoteDirection,
            ChatCopyKind: extHostTypes.ChatCopyKind,
            ChatEditingSessionActionOutcome: extHostTypes.ChatEditingSessionActionOutcome,
            InteractiveEditorResponseFeedbackKind: extHostTypes.InteractiveEditorResponseFeedbackKind,
            DebugStackFrame: extHostTypes.DebugStackFrame,
            DebugThread: extHostTypes.DebugThread,
            RelatedInformationType: extHostTypes.RelatedInformationType,
            SpeechToTextStatus: extHostTypes.SpeechToTextStatus,
            TextToSpeechStatus: extHostTypes.TextToSpeechStatus,
            PartialAcceptTriggerKind: extHostTypes.PartialAcceptTriggerKind,
            InlineCompletionEndOfLifeReasonKind: extHostTypes.InlineCompletionEndOfLifeReasonKind,
            InlineCompletionDisplayLocationKind: extHostTypes.InlineCompletionDisplayLocationKind,
            KeywordRecognitionStatus: extHostTypes.KeywordRecognitionStatus,
            ChatImageMimeType: extHostTypes.ChatImageMimeType,
            ChatResponseMarkdownPart: extHostTypes.ChatResponseMarkdownPart,
            ChatResponseFileTreePart: extHostTypes.ChatResponseFileTreePart,
            ChatResponseAnchorPart: extHostTypes.ChatResponseAnchorPart,
            ChatResponseProgressPart: extHostTypes.ChatResponseProgressPart,
            ChatResponseProgressPart2: extHostTypes.ChatResponseProgressPart2,
            ChatResponseThinkingProgressPart: extHostTypes.ChatResponseThinkingProgressPart,
            ChatResponseReferencePart: extHostTypes.ChatResponseReferencePart,
            ChatResponseReferencePart2: extHostTypes.ChatResponseReferencePart,
            ChatResponseCodeCitationPart: extHostTypes.ChatResponseCodeCitationPart,
            ChatResponseCodeblockUriPart: extHostTypes.ChatResponseCodeblockUriPart,
            ChatResponseWarningPart: extHostTypes.ChatResponseWarningPart,
            ChatResponseTextEditPart: extHostTypes.ChatResponseTextEditPart,
            ChatResponseNotebookEditPart: extHostTypes.ChatResponseNotebookEditPart,
            ChatResponseMarkdownWithVulnerabilitiesPart: extHostTypes.ChatResponseMarkdownWithVulnerabilitiesPart,
            ChatResponseCommandButtonPart: extHostTypes.ChatResponseCommandButtonPart,
            ChatResponseConfirmationPart: extHostTypes.ChatResponseConfirmationPart,
            ChatResponseMovePart: extHostTypes.ChatResponseMovePart,
            ChatResponseExtensionsPart: extHostTypes.ChatResponseExtensionsPart,
            ChatResponseExternalEditPart: extHostTypes.ChatResponseExternalEditPart,
            ChatResponsePullRequestPart: extHostTypes.ChatResponsePullRequestPart,
            ChatPrepareToolInvocationPart: extHostTypes.ChatPrepareToolInvocationPart,
            ChatResponseMultiDiffPart: extHostTypes.ChatResponseMultiDiffPart,
            ChatResponseReferencePartStatusKind: extHostTypes.ChatResponseReferencePartStatusKind,
            ChatResponseClearToPreviousToolInvocationReason: extHostTypes.ChatResponseClearToPreviousToolInvocationReason,
            ChatRequestTurn: extHostTypes.ChatRequestTurn,
            ChatRequestTurn2: extHostTypes.ChatRequestTurn,
            ChatResponseTurn: extHostTypes.ChatResponseTurn,
            ChatResponseTurn2: extHostTypes.ChatResponseTurn2,
            ChatToolInvocationPart: extHostTypes.ChatToolInvocationPart,
            ChatLocation: extHostTypes.ChatLocation,
            ChatSessionStatus: extHostTypes.ChatSessionStatus,
            ChatRequestEditorData: extHostTypes.ChatRequestEditorData,
            ChatRequestNotebookData: extHostTypes.ChatRequestNotebookData,
            ChatReferenceBinaryData: extHostTypes.ChatReferenceBinaryData,
            ChatRequestEditedFileEventKind: extHostTypes.ChatRequestEditedFileEventKind,
            LanguageModelChatMessageRole: extHostTypes.LanguageModelChatMessageRole,
            LanguageModelChatMessage: extHostTypes.LanguageModelChatMessage,
            LanguageModelChatMessage2: extHostTypes.LanguageModelChatMessage2,
            LanguageModelToolResultPart: extHostTypes.LanguageModelToolResultPart,
            LanguageModelToolResultPart2: extHostTypes.LanguageModelToolResultPart,
            LanguageModelTextPart: extHostTypes.LanguageModelTextPart,
            LanguageModelTextPart2: extHostTypes.LanguageModelTextPart,
            LanguageModelPartAudience: extHostTypes.LanguageModelPartAudience,
            ToolResultAudience: extHostTypes.LanguageModelPartAudience, // back compat
            LanguageModelToolCallPart: extHostTypes.LanguageModelToolCallPart,
            LanguageModelThinkingPart: extHostTypes.LanguageModelThinkingPart,
            LanguageModelError: extHostTypes.LanguageModelError,
            LanguageModelToolResult: extHostTypes.LanguageModelToolResult,
            LanguageModelToolResult2: extHostTypes.LanguageModelToolResult2,
            LanguageModelDataPart: extHostTypes.LanguageModelDataPart,
            LanguageModelDataPart2: extHostTypes.LanguageModelDataPart,
            LanguageModelToolExtensionSource: extHostTypes.LanguageModelToolExtensionSource,
            LanguageModelToolMCPSource: extHostTypes.LanguageModelToolMCPSource,
            ExtendedLanguageModelToolResult: extHostTypes.ExtendedLanguageModelToolResult,
            LanguageModelChatToolMode: extHostTypes.LanguageModelChatToolMode,
            LanguageModelPromptTsxPart: extHostTypes.LanguageModelPromptTsxPart,
            NewSymbolName: extHostTypes.NewSymbolName,
            NewSymbolNameTag: extHostTypes.NewSymbolNameTag,
            NewSymbolNameTriggerKind: extHostTypes.NewSymbolNameTriggerKind,
            ExcludeSettingOptions: ExcludeSettingOptions,
            TextSearchContext2: TextSearchContext2,
            TextSearchMatch2: TextSearchMatch2,
            AISearchKeyword: AISearchKeyword,
            TextSearchCompleteMessageTypeNew: TextSearchCompleteMessageType,
            ChatErrorLevel: extHostTypes.ChatErrorLevel,
            McpHttpServerDefinition: extHostTypes.McpHttpServerDefinition,
            McpHttpServerDefinition2: extHostTypes.McpHttpServerDefinition,
            McpStdioServerDefinition: extHostTypes.McpStdioServerDefinition,
            McpStdioServerDefinition2: extHostTypes.McpStdioServerDefinition,
            McpToolAvailability: extHostTypes.McpToolAvailability,
            SettingsSearchResultKind: extHostTypes.SettingsSearchResultKind
        };
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdC5hcGkuaW1wbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0LmFwaS5pbXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQy9FLE9BQU8sS0FBSyxNQUFNLE1BQU0sZ0NBQWdDLENBQUM7QUFDekQsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3pFLE9BQU8sUUFBUSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNsRCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUN2RixPQUFPLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDckYsT0FBTyxLQUFLLHFCQUFxQixNQUFNLDJEQUEyRCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxjQUFjLEVBQUUsc0JBQXNCLEVBQXlCLE1BQU0sbURBQW1ELENBQUM7QUFDbEksT0FBTyxLQUFLLEtBQUssTUFBTSx5Q0FBeUMsQ0FBQztBQUVqRSxPQUFPLEVBQUUsV0FBVyxFQUFFLGNBQWMsRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM1RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDL0UsT0FBTyxFQUFFLHFCQUFx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