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
var LanguageModelToolsService_1;
import { renderAsPlaintext } from '../../../../base/browser/markdownRenderer.js';
import { assertNever } from '../../../../base/common/assert.js';
import { RunOnceScheduler, timeout } from '../../../../base/common/async.js';
import { encodeBase64 } from '../../../../base/common/buffer.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { toErrorMessage } from '../../../../base/common/errorMessage.js';
import { CancellationError, isCancellationError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createMarkdownCommandLink, MarkdownString } from '../../../../base/common/htmlContent.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { combinedDisposable, Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { ObservableSet } from '../../../../base/common/observable.js';
import Severity from '../../../../base/common/severity.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize, localize2 } from '../../../../nls.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import * as JSONContributionRegistry from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { ChatContextKeys } from '../common/chatContextKeys.js';
import { ChatToolInvocation } from '../common/chatProgressTypes/chatToolInvocation.js';
import { IChatService, IChatToolInvocation } from '../common/chatService.js';
import { toToolSetVariableEntry, toToolVariableEntry } from '../common/chatVariableEntries.js';
import { ChatConfiguration } from '../common/constants.js';
import { ILanguageModelToolsConfirmationService } from '../common/languageModelToolsConfirmationService.js';
import { createToolSchemaUri, GithubCopilotToolReference, stringifyPromptTsxPart, ToolDataSource, ToolSet, VSCodeToolReference } from '../common/languageModelToolsService.js';
import { getToolConfirmationAlert } from './chatAccessibilityProvider.js';
const jsonSchemaRegistry = Registry.as(JSONContributionRegistry.Extensions.JSONContribution);
var AutoApproveStorageKeys;
(function (AutoApproveStorageKeys) {
    AutoApproveStorageKeys["GlobalAutoApproveOptIn"] = "chat.tools.global.autoApprove.optIn";
})(AutoApproveStorageKeys || (AutoApproveStorageKeys = {}));
const SkipAutoApproveConfirmationKey = 'vscode.chat.tools.global.autoApprove.testMode';
export const globalAutoApproveDescription = localize2({
    key: 'autoApprove2.markdown',
    comment: [
        '{Locked=\'](https://github.com/features/codespaces)\'}',
        '{Locked=\'](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)\'}',
        '{Locked=\'](https://code.visualstudio.com/docs/copilot/security)\'}',
        '{Locked=\'**\'}',
    ]
}, 'Global auto approve also known as "YOLO mode" disables manual approval completely for _all tools in all workspaces_, allowing the agent to act fully autonomously. This is extremely dangerous and is *never* recommended, even containerized environments like [Codespaces](https://github.com/features/codespaces) and [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) have user keys forwarded into the container that could be compromised.\n\n**This feature disables [critical security protections](https://code.visualstudio.com/docs/copilot/security) and makes it much easier for an attacker to compromise the machine.**');
let LanguageModelToolsService = class LanguageModelToolsService extends Disposable {
    static { LanguageModelToolsService_1 = this; }
    constructor(_instantiationService, _extensionService, _contextKeyService, _chatService, _dialogService, _telemetryService, _logService, _configurationService, _accessibilityService, _accessibilitySignalService, _storageService, _confirmationService) {
        super();
        this._instantiationService = _instantiationService;
        this._extensionService = _extensionService;
        this._contextKeyService = _contextKeyService;
        this._chatService = _chatService;
        this._dialogService = _dialogService;
        this._telemetryService = _telemetryService;
        this._logService = _logService;
        this._configurationService = _configurationService;
        this._accessibilityService = _accessibilityService;
        this._accessibilitySignalService = _accessibilitySignalService;
        this._storageService = _storageService;
        this._confirmationService = _confirmationService;
        this._onDidChangeTools = this._register(new Emitter());
        this.onDidChangeTools = this._onDidChangeTools.event;
        this._onDidPrepareToolCallBecomeUnresponsive = this._register(new Emitter());
        this.onDidPrepareToolCallBecomeUnresponsive = this._onDidPrepareToolCallBecomeUnresponsive.event;
        /** Throttle tools updates because it sends all tools and runs on context key updates */
        this._onDidChangeToolsScheduler = new RunOnceScheduler(() => this._onDidChangeTools.fire(), 750);
        this._tools = new Map();
        this._toolContextKeys = new Set();
        this._callsByRequestId = new Map();
        this._toolSets = new ObservableSet();
        this.toolSets = this._toolSets.observable;
        this._register(this._contextKeyService.onDidChangeContext(e => {
            if (e.affectsSome(this._toolContextKeys)) {
                // Not worth it to compute a delta here unless we have many tools changing often
                this._onDidChangeToolsScheduler.schedule();
            }
        }));
        this._register(this._configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(ChatConfiguration.ExtensionToolsEnabled)) {
                this._onDidChangeToolsScheduler.schedule();
            }
        }));
        // Clear out warning accepted state if the setting is disabled
        this._register(Event.runAndSubscribe(this._configurationService.onDidChangeConfiguration, e => {
            if (!e || e.affectsConfiguration(ChatConfiguration.GlobalAutoApprove)) {
                if (this._configurationService.getValue(ChatConfiguration.GlobalAutoApprove) !== true) {
                    this._storageService.remove("chat.tools.global.autoApprove.optIn" /* AutoApproveStorageKeys.GlobalAutoApproveOptIn */, -1 /* StorageScope.APPLICATION */);
                }
            }
        }));
        this._ctxToolsCount = ChatContextKeys.Tools.toolsCount.bindTo(_contextKeyService);
        // Create the internal VS Code tool set
        this.vscodeToolSet = this._register(this.createToolSet(ToolDataSource.Internal, 'vscode', VSCodeToolReference.vscode, {
            icon: ThemeIcon.fromId(Codicon.vscode.id),
            description: localize('copilot.toolSet.vscode.description', 'Use VS Code features'),
        }));
        // Create the internal Execute tool set
        this.executeToolSet = this._register(this.createToolSet(ToolDataSource.Internal, 'execute', VSCodeToolReference.execute, {
            icon: ThemeIcon.fromId(Codicon.terminal.id),
            description: localize('copilot.toolSet.execute.description', 'Execute code and applications on your machine'),
        }));
        // Create the internal Read tool set
        this.readToolSet = this._register(this.createToolSet(ToolDataSource.Internal, 'read', VSCodeToolReference.read, {
            icon: ThemeIcon.fromId(Codicon.eye.id),
            description: localize('copilot.toolSet.read.description', 'Read files in your workspace'),
        }));
    }
    dispose() {
        super.dispose();
        this._callsByRequestId.forEach(calls => calls.forEach(call => call.store.dispose()));
        this._ctxToolsCount.reset();
    }
    registerToolData(toolData) {
        if (this._tools.has(toolData.id)) {
            throw new Error(`Tool "${toolData.id}" is already registered.`);
        }
        this._tools.set(toolData.id, { data: toolData });
        this._ctxToolsCount.set(this._tools.size);
        this._onDidChangeToolsScheduler.schedule();
        toolData.when?.keys().forEach(key => this._toolContextKeys.add(key));
        let store;
        if (toolData.inputSchema) {
            store = new DisposableStore();
            const schemaUrl = createToolSchemaUri(toolData.id).toString();
            jsonSchemaRegistry.registerSchema(schemaUrl, toolData.inputSchema, store);
            store.add(jsonSchemaRegistry.registerSchemaAssociation(schemaUrl, `/lm/tool/${toolData.id}/tool_input.json`));
        }
        return toDisposable(() => {
            store?.dispose();
            this._tools.delete(toolData.id);
            this._ctxToolsCount.set(this._tools.size);
            this._refreshAllToolContextKeys();
            this._onDidChangeToolsScheduler.schedule();
        });
    }
    flushToolUpdates() {
        this._onDidChangeToolsScheduler.flush();
    }
    _refreshAllToolContextKeys() {
        this._toolContextKeys.clear();
        for (const tool of this._tools.values()) {
            tool.data.when?.keys().forEach(key => this._toolContextKeys.add(key));
        }
    }
    registerToolImplementation(id, tool) {
        const entry = this._tools.get(id);
        if (!entry) {
            throw new Error(`Tool "${id}" was not contributed.`);
        }
        if (entry.impl) {
            throw new Error(`Tool "${id}" already has an implementation.`);
        }
        entry.impl = tool;
        return toDisposable(() => {
            entry.impl = undefined;
        });
    }
    registerTool(toolData, tool) {
        return combinedDisposable(this.registerToolData(toolData), this.registerToolImplementation(toolData.id, tool));
    }
    getTools(includeDisabled) {
        const toolDatas = Iterable.map(this._tools.values(), i => i.data);
        const extensionToolsEnabled = this._configurationService.getValue(ChatConfiguration.ExtensionToolsEnabled);
        return Iterable.filter(toolDatas, toolData => {
            const satisfiesWhenClause = includeDisabled || !toolData.when || this._contextKeyService.contextMatchesRules(toolData.when);
            const satisfiesExternalToolCheck = toolData.source.type !== 'extension' || !!extensionToolsEnabled;
            return satisfiesWhenClause && satisfiesExternalToolCheck;
        });
    }
    getTool(id) {
        return this._getToolEntry(id)?.data;
    }
    _getToolEntry(id) {
        const entry = this._tools.get(id);
        if (entry && (!entry.data.when || this._contextKeyService.contextMatchesRules(entry.data.when))) {
            return entry;
        }
        else {
            return undefined;
        }
    }
    getToolByName(name, includeDisabled) {
        for (const tool of this.getTools(!!includeDisabled)) {
            if (tool.toolReferenceName === name) {
                return tool;
            }
        }
        return undefined;
    }
    async invokeTool(dto, countTokens, token) {
        this._logService.trace(`[LanguageModelToolsService#invokeTool] Invoking tool ${dto.toolId} with parameters ${JSON.stringify(dto.parameters)}`);
        // When invoking a tool, don't validate the "when" clause. An extension may have invoked a tool just as it was becoming disabled, and just let it go through rather than throw and break the chat.
        let tool = this._tools.get(dto.toolId);
        if (!tool) {
            throw new Error(`Tool ${dto.toolId} was not contributed`);
        }
        if (!tool.impl) {
            await this._extensionService.activateByEvent(`onLanguageModelTool:${dto.toolId}`);
            // Extension should activate and register the tool implementation
            tool = this._tools.get(dto.toolId);
            if (!tool?.impl) {
                throw new Error(`Tool ${dto.toolId} does not have an implementation registered.`);
            }
        }
        // Shortcut to write to the model directly here, but could call all the way back to use the real stream.
        let toolInvocation;
        let requestId;
        let store;
        let toolResult;
        let prepareTimeWatch;
        let invocationTimeWatch;
        let preparedInvocation;
        try {
            if (dto.context) {
                store = new DisposableStore();
                const model = this._chatService.getSession(dto.context.sessionResource);
                if (!model) {
                    throw new Error(`Tool called for unknown chat session`);
                }
                const request = model.getRequests().at(-1);
                requestId = request.id;
                dto.modelId = request.modelId;
                dto.userSelectedTools = request.userSelectedTools;
                // Replace the token with a new token that we can cancel when cancelToolCallsForRequest is called
                if (!this._callsByRequestId.has(requestId)) {
                    this._callsByRequestId.set(requestId, []);
                }
                const trackedCall = { store };
                this._callsByRequestId.get(requestId).push(trackedCall);
                const source = new CancellationTokenSource();
                store.add(toDisposable(() => {
                    source.dispose(true);
                }));
                store.add(token.onCancellationRequested(() => {
                    IChatToolInvocation.confirmWith(toolInvocation, { type: 0 /* ToolConfirmKind.Denied */ });
                    source.cancel();
                }));
                store.add(source.token.onCancellationRequested(() => {
                    IChatToolInvocation.confirmWith(toolInvocation, { type: 0 /* ToolConfirmKind.Denied */ });
                }));
                token = source.token;
                prepareTimeWatch = StopWatch.create(true);
                preparedInvocation = await this.prepareToolInvocation(tool, dto, token);
                prepareTimeWatch.stop();
                toolInvocation = new ChatToolInvocation(preparedInvocation, tool.data, dto.callId, dto.fromSubAgent, dto.parameters);
                trackedCall.invocation = toolInvocation;
                const autoConfirmed = await this.shouldAutoConfirm(tool.data.id, tool.data.runsInWorkspace, tool.data.source, dto.parameters);
                if (autoConfirmed) {
                    IChatToolInvocation.confirmWith(toolInvocation, autoConfirmed);
                }
                this._chatService.appendProgress(request, toolInvocation);
                dto.toolSpecificData = toolInvocation?.toolSpecificData;
                if (preparedInvocation?.confirmationMessages?.title) {
                    if (!IChatToolInvocation.executionConfirmedOrDenied(toolInvocation) && !autoConfirmed) {
                        this.playAccessibilitySignal([toolInvocation]);
                    }
                    const userConfirmed = await IChatToolInvocation.awaitConfirmation(toolInvocation, token);
                    if (userConfirmed.type === 0 /* ToolConfirmKind.Denied */) {
                        throw new CancellationError();
                    }
                    if (userConfirmed.type === 5 /* ToolConfirmKind.Skipped */) {
                        toolResult = {
                            content: [{
                                    kind: 'text',
                                    value: 'The user chose to skip the tool call, they want to proceed without running it'
                                }]
                        };
                        return toolResult;
                    }
                    if (dto.toolSpecificData?.kind === 'input') {
                        dto.parameters = dto.toolSpecificData.rawInput;
                        dto.toolSpecificData = undefined;
                    }
                }
            }
            else {
                prepareTimeWatch = StopWatch.create(true);
                preparedInvocation = await this.prepareToolInvocation(tool, dto, token);
                prepareTimeWatch.stop();
                if (preparedInvocation?.confirmationMessages?.title && !(await this.shouldAutoConfirm(tool.data.id, tool.data.runsInWorkspace, tool.data.source, dto.parameters))) {
                    const result = await this._dialogService.confirm({ message: renderAsPlaintext(preparedInvocation.confirmationMessages.title), detail: renderAsPlaintext(preparedInvocation.confirmationMessages.message) });
                    if (!result.confirmed) {
                        throw new CancellationError();
                    }
                }
                dto.toolSpecificData = preparedInvocation?.toolSpecificData;
            }
            if (token.isCancellationRequested) {
                throw new CancellationError();
            }
            invocationTimeWatch = StopWatch.create(true);
            toolResult = await tool.impl.invoke(dto, countTokens, {
                report: step => {
                    toolInvocation?.acceptProgress(step);
                }
            }, token);
            invocationTimeWatch.stop();
            this.ensureToolDetails(dto, toolResult, tool.data);
            if (toolInvocation?.didExecuteTool(toolResult).type === 2 /* IChatToolInvocation.StateKind.WaitingForPostApproval */) {
                const autoConfirmedPost = await this.shouldAutoConfirmPostExecution(tool.data.id, tool.data.runsInWorkspace, tool.data.source, dto.parameters);
                if (autoConfirmedPost) {
                    IChatToolInvocation.confirmWith(toolInvocation, autoConfirmedPost);
                }
                const postConfirm = await IChatToolInvocation.awaitPostConfirmation(toolInvocation, token);
                if (postConfirm.type === 0 /* ToolConfirmKind.Denied */) {
                    throw new CancellationError();
                }
                if (postConfirm.type === 5 /* ToolConfirmKind.Skipped */) {
                    toolResult = {
                        content: [{
                                kind: 'text',
                                value: 'The tool executed but the user chose not to share the results'
                            }]
                    };
                }
            }
            this._telemetryService.publicLog2('languageModelToolInvoked', {
                result: 'success',
                chatSessionId: dto.context?.sessionId,
                toolId: tool.data.id,
                toolExtensionId: tool.data.source.type === 'extension' ? tool.data.source.extensionId.value : undefined,
                toolSourceKind: tool.data.source.type,
                prepareTimeMs: prepareTimeWatch?.elapsed(),
                invocationTimeMs: invocationTimeWatch?.elapsed(),
            });
            return toolResult;
        }
        catch (err) {
            const result = isCancellationError(err) ? 'userCancelled' : 'error';
            this._telemetryService.publicLog2('languageModelToolInvoked', {
                result,
                chatSessionId: dto.context?.sessionId,
                toolId: tool.data.id,
                toolExtensionId: tool.data.source.type === 'extension' ? tool.data.source.extensionId.value : undefined,
                toolSourceKind: tool.data.source.type,
                prepareTimeMs: prepareTimeWatch?.elapsed(),
                invocationTimeMs: invocationTimeWatch?.elapsed(),
            });
            this._logService.error(`[LanguageModelToolsService#invokeTool] Error from tool ${dto.toolId} with parameters ${JSON.stringify(dto.parameters)}:\n${toErrorMessage(err, true)}`);
            toolResult ??= { content: [] };
            toolResult.toolResultError = err instanceof Error ? err.message : String(err);
            if (tool.data.alwaysDisplayInputOutput) {
                toolResult.toolResultDetails = { input: this.formatToolInput(dto), output: [{ type: 'embed', isText: true, value: String(err) }], isError: true };
            }
            throw err;
        }
        finally {
            toolInvocation?.didExecuteTool(toolResult, true);
            if (store) {
                this.cleanupCallDisposables(requestId, store);
            }
        }
    }
    async prepareToolInvocation(tool, dto, token) {
        let prepared;
        if (tool.impl.prepareToolInvocation) {
            const preparePromise = tool.impl.prepareToolInvocation({
                parameters: dto.parameters,
                chatRequestId: dto.chatRequestId,
                chatSessionId: dto.context?.sessionId,
                chatInteractionId: dto.chatInteractionId
            }, token);
            const raceResult = await Promise.race([
                timeout(3000, token).then(() => 'timeout'),
                preparePromise
            ]);
            if (raceResult === 'timeout') {
                this._onDidPrepareToolCallBecomeUnresponsive.fire({
                    sessionId: dto.context?.sessionId ?? '',
                    toolData: tool.data
                });
            }
            prepared = await preparePromise;
        }
        const isEligibleForAutoApproval = this.isToolEligibleForAutoApproval(tool.data);
        // Default confirmation messages if tool is not eligible for auto-approval
        if (!isEligibleForAutoApproval && !prepared?.confirmationMessages?.title) {
            if (!prepared) {
                prepared = {};
            }
            const toolReferenceName = getToolReferenceFullName(tool.data);
            // TODO: This should be more detailed per tool.
            prepared.confirmationMessages = {
                ...prepared.confirmationMessages,
                title: localize('defaultToolConfirmation.title', 'Allow tool to execute?'),
                message: localize('defaultToolConfirmation.message', 'Run the \'{0}\' tool?', toolReferenceName),
                disclaimer: new MarkdownString(localize('defaultToolConfirmation.disclaimer', 'Auto approval for \'{0}\' is restricted via {1}.', getToolReferenceFullName(tool.data), createMarkdownCommandLink({ title: '`' + ChatConfiguration.EligibleForAutoApproval + '`', id: 'workbench.action.openSettings', arguments: [ChatConfiguration.EligibleForAutoApproval] }, false)), { isTrusted: true }),
                allowAutoConfirm: false,
            };
        }
        if (!isEligibleForAutoApproval && prepared?.confirmationMessages?.title) {
            // Always overwrite the disclaimer if not eligible for auto-approval
            prepared.confirmationMessages.disclaimer = new MarkdownString(localize('defaultToolConfirmation.disclaimer', 'Auto approval for \'{0}\' is restricted via {1}.', getToolReferenceFullName(tool.data), createMarkdownCommandLink({ title: '`' + ChatConfiguration.EligibleForAutoApproval + '`', id: 'workbench.action.openSettings', arguments: [ChatConfiguration.EligibleForAutoApproval] }, false)), { isTrusted: true });
        }
        if (prepared?.confirmationMessages?.title) {
            if (prepared.toolSpecificData?.kind !== 'terminal' && prepared.confirmationMessages.allowAutoConfirm !== false) {
                prepared.confirmationMessages.allowAutoConfirm = isEligibleForAutoApproval;
            }
            if (!prepared.toolSpecificData && tool.data.alwaysDisplayInputOutput) {
                prepared.toolSpecificData = {
                    kind: 'input',
                    rawInput: dto.parameters,
                };
            }
        }
        return prepared;
    }
    playAccessibilitySignal(toolInvocations) {
        const autoApproved = this._configurationService.getValue(ChatConfiguration.GlobalAutoApprove);
        if (autoApproved) {
            return;
        }
        const setting = this._configurationService.getValue(AccessibilitySignal.chatUserActionRequired.settingsKey);
        if (!setting) {
            return;
        }
        const soundEnabled = setting.sound === 'on' || (setting.sound === 'auto' && (this._accessibilityService.isScreenReaderOptimized()));
        const announcementEnabled = this._accessibilityService.isScreenReaderOptimized() && setting.announcement === 'auto';
        if (soundEnabled || announcementEnabled) {
            this._accessibilitySignalService.playSignal(AccessibilitySignal.chatUserActionRequired, { customAlertMessage: this._instantiationService.invokeFunction(getToolConfirmationAlert, toolInvocations), userGesture: true, modality: !soundEnabled ? 'announcement' : undefined });
        }
    }
    ensureToolDetails(dto, toolResult, toolData) {
        if (!toolResult.toolResultDetails && toolData.alwaysDisplayInputOutput) {
            toolResult.toolResultDetails = {
                input: this.formatToolInput(dto),
                output: this.toolResultToIO(toolResult),
            };
        }
    }
    formatToolInput(dto) {
        return JSON.stringify(dto.parameters, undefined, 2);
    }
    toolResultToIO(toolResult) {
        return toolResult.content.map(part => {
            if (part.kind === 'text') {
                return { type: 'embed', isText: true, value: part.value };
            }
            else if (part.kind === 'promptTsx') {
                return { type: 'embed', isText: true, value: stringifyPromptTsxPart(part) };
            }
            else if (part.kind === 'data') {
                return { type: 'embed', value: encodeBase64(part.value.data), mimeType: part.value.mimeType };
            }
            else {
                assertNever(part);
            }
        });
    }
    getEligibleForAutoApprovalSpecialCase(toolData) {
        if (toolData.id === 'vscode_fetchWebPage_internal') {
            return 'fetch';
        }
        return undefined;
    }
    isToolEligibleForAutoApproval(toolData) {
        const toolReferenceName = this.getEligibleForAutoApprovalSpecialCase(toolData) ?? getToolReferenceFullName(toolData);
        if (toolData.id === 'copilot_fetchWebPage') {
            // Special case, this fetch will call an internal tool 'vscode_fetchWebPage_internal'
            return true;
        }
        const eligibilityConfig = this._configurationService.getValue(ChatConfiguration.EligibleForAutoApproval);
        if (eligibilityConfig && typeof eligibilityConfig === 'object' && toolReferenceName) {
            // Direct match
            if (Object.prototype.hasOwnProperty.call(eligibilityConfig, toolReferenceName)) {
                return eligibilityConfig[toolReferenceName];
            }
            // Back compat with legacy names
            if (toolData.legacyToolReferenceFullNames) {
                for (const legacyName of toolData.legacyToolReferenceFullNames) {
                    if (Object.prototype.hasOwnProperty.call(eligibilityConfig, legacyName)) {
                        return eligibilityConfig[legacyName];
                    }
                }
            }
        }
        // Default true
        return true;
    }
    async shouldAutoConfirm(toolId, runsInWorkspace, source, parameters) {
        const tool = this._tools.get(toolId);
        if (!tool) {
            return undefined;
        }
        if (!this.isToolEligibleForAutoApproval(tool.data)) {
            return undefined;
        }
        const reason = this._confirmationService.getPreConfirmAction({ toolId, source, parameters });
        if (reason) {
            return reason;
        }
        const config = this._configurationService.inspect(ChatConfiguration.GlobalAutoApprove);
        // If we know the tool runs at a global level, only consider the global config.
        // If we know the tool runs at a workspace level, use those specific settings when appropriate.
        let value = config.value ?? config.defaultValue;
        if (typeof runsInWorkspace === 'boolean') {
            value = config.userLocalValue ?? config.applicationValue;
            if (runsInWorkspace) {
                value = config.workspaceValue ?? config.workspaceFolderValue ?? config.userRemoteValue ?? value;
            }
        }
        const autoConfirm = value === true || (typeof value === 'object' && value.hasOwnProperty(toolId) && value[toolId] === true);
        if (autoConfirm) {
            if (await this._checkGlobalAutoApprove()) {
                return { type: 2 /* ToolConfirmKind.Setting */, id: ChatConfiguration.GlobalAutoApprove };
            }
        }
        return undefined;
    }
    async shouldAutoConfirmPostExecution(toolId, runsInWorkspace, source, parameters) {
        if (this._configurationService.getValue(ChatConfiguration.GlobalAutoApprove) && await this._checkGlobalAutoApprove()) {
            return { type: 2 /* ToolConfirmKind.Setting */, id: ChatConfiguration.GlobalAutoApprove };
        }
        return this._confirmationService.getPostConfirmAction({ toolId, source, parameters });
    }
    async _checkGlobalAutoApprove() {
        const optedIn = this._storageService.getBoolean("chat.tools.global.autoApprove.optIn" /* AutoApproveStorageKeys.GlobalAutoApproveOptIn */, -1 /* StorageScope.APPLICATION */, false);
        if (optedIn) {
            return true;
        }
        if (this._contextKeyService.getContextKeyValue(SkipAutoApproveConfirmationKey) === true) {
            return true;
        }
        const promptResult = await this._dialogService.prompt({
            type: Severity.Warning,
            message: localize('autoApprove2.title', 'Enable global auto approve?'),
            buttons: [
                {
                    label: localize('autoApprove2.button.enable', 'Enable'),
                    run: () => true
                },
                {
                    label: localize('autoApprove2.button.disable', 'Disable'),
                    run: () => false
                },
            ],
            custom: {
                icon: Codicon.warning,
                disableCloseAction: true,
                markdownDetails: [{
                        markdown: new MarkdownString(globalAutoApproveDescription.value),
                    }],
            }
        });
        if (promptResult.result !== true) {
            await this._configurationService.updateValue(ChatConfiguration.GlobalAutoApprove, false);
            return false;
        }
        this._storageService.store("chat.tools.global.autoApprove.optIn" /* AutoApproveStorageKeys.GlobalAutoApproveOptIn */, true, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
        return true;
    }
    cleanupCallDisposables(requestId, store) {
        if (requestId) {
            const disposables = this._callsByRequestId.get(requestId);
            if (disposables) {
                const index = disposables.findIndex(d => d.store === store);
                if (index > -1) {
                    disposables.splice(index, 1);
                }
                if (disposables.length === 0) {
                    this._callsByRequestId.delete(requestId);
                }
            }
        }
        store.dispose();
    }
    cancelToolCallsForRequest(requestId) {
        const calls = this._callsByRequestId.get(requestId);
        if (calls) {
            calls.forEach(call => call.store.dispose());
            this._callsByRequestId.delete(requestId);
        }
    }
    static { this.githubMCPServerAliases = ['github/github-mcp-server', 'io.github.github/github-mcp-server', 'github-mcp-server']; }
    static { this.playwrightMCPServerAliases = ['microsoft/playwright-mcp', 'com.microsoft/playwright-mcp']; }
    *getToolSetAliases(toolSet, toolReferenceName) {
        if (toolReferenceName !== toolSet.referenceName) {
            yield toolSet.referenceName; // full name, with '/*'
        }
        if (toolSet.legacyFullNames) {
            yield* toolSet.legacyFullNames;
        }
        switch (toolSet.referenceName) {
            case 'github':
                for (const alias of LanguageModelToolsService_1.githubMCPServerAliases) {
                    yield alias + '/*';
                }
                break;
            case 'playwright':
                for (const alias of LanguageModelToolsService_1.playwrightMCPServerAliases) {
                    yield alias + '/*';
                }
                break;
            case VSCodeToolReference.execute: // 'execute'
                yield GithubCopilotToolReference.shell;
                break;
            case VSCodeToolReference.agent: // 'agent'
                yield VSCodeToolReference.runSubagent;
                yield GithubCopilotToolReference.customAgent;
                break;
        }
    }
    *getToolAliases(toolSet, toolReferenceName) {
        const unqualifiedName = toolSet.toolReferenceName ?? toolSet.displayName;
        if (toolReferenceName !== unqualifiedName) {
            yield unqualifiedName; // simple name, without toolset name
        }
        if (toolSet.legacyToolReferenceFullNames) {
            for (const legacyName of toolSet.legacyToolReferenceFullNames) {
                yield legacyName;
                const lastSlashIndex = legacyName.lastIndexOf('/');
                if (lastSlashIndex !== -1) {
                    yield legacyName.substring(lastSlashIndex + 1); // it was also known under the simple name
                }
            }
        }
        const slashIndex = toolReferenceName.lastIndexOf('/');
        if (slashIndex !== -1) {
            switch (toolReferenceName.substring(0, slashIndex)) {
                case 'github':
                    for (const alias of LanguageModelToolsService_1.githubMCPServerAliases) {
                        yield alias + toolReferenceName.substring(slashIndex);
                    }
                    break;
                case 'playwright':
                    for (const alias of LanguageModelToolsService_1.playwrightMCPServerAliases) {
                        yield alias + toolReferenceName.substring(slashIndex);
                    }
                    break;
            }
        }
    }
    /**
     * Create a map that contains all tools and toolsets with their enablement state.
     * @param toolOrToolSetNames A list of tool or toolset names that are enabled.
     * @returns A map of tool or toolset instances to their enablement state.
     */
    toToolAndToolSetEnablementMap(enabledQualifiedToolOrToolSetNames, _target) {
        const toolOrToolSetNames = new Set(enabledQualifiedToolOrToolSetNames);
        const result = new Map();
        for (const [tool, toolReferenceName] of this.getPromptReferencableTools()) {
            if (tool instanceof ToolSet) {
                const enabled = toolOrToolSetNames.has(toolReferenceName) || Iterable.some(this.getToolSetAliases(tool, toolReferenceName), name => toolOrToolSetNames.has(name));
                result.set(tool, enabled);
                if (enabled) {
                    for (const memberTool of tool.getTools()) {
                        result.set(memberTool, true);
                    }
                }
            }
            else {
                if (!result.has(tool)) { // already set via an enabled toolset
                    const enabled = toolOrToolSetNames.has(toolReferenceName)
                        || Iterable.some(this.getToolAliases(tool, toolReferenceName), name => toolOrToolSetNames.has(name))
                        || !!tool.legacyToolReferenceFullNames?.some(toolFullName => {
                            // enable tool if just the legacy tool set name is present
                            const index = toolFullName.lastIndexOf('/');
                            return index !== -1 && toolOrToolSetNames.has(toolFullName.substring(0, index));
                        });
                    result.set(tool, enabled);
                }
            }
        }
        // also add all user tool sets (not part of the prompt referencable tools)
        for (const toolSet of this._toolSets) {
            if (toolSet.source.type === 'user') {
                const enabled = Iterable.every(toolSet.getTools(), t => result.get(t) === true);
                result.set(toolSet, enabled);
            }
        }
        return result;
    }
    toQualifiedToolNames(map) {
        const result = [];
        const toolsCoveredByEnabledToolSet = new Set();
        for (const [tool, toolReferenceName] of this.getPromptReferencableTools()) {
            if (tool instanceof ToolSet) {
                if (map.get(tool)) {
                    result.push(toolReferenceName);
                    for (const memberTool of tool.getTools()) {
                        toolsCoveredByEnabledToolSet.add(memberTool);
                    }
                }
            }
            else {
                if (map.get(tool) && !toolsCoveredByEnabledToolSet.has(tool)) {
                    result.push(toolReferenceName);
                }
            }
        }
        return result;
    }
    toToolReferences(variableReferences) {
        const toolsOrToolSetByName = new Map();
        for (const [tool, toolReferenceName] of this.getPromptReferencableTools()) {
            toolsOrToolSetByName.set(toolReferenceName, tool);
        }
        const result = [];
        for (const ref of variableReferences) {
            const toolOrToolSet = toolsOrToolSetByName.get(ref.name);
            if (toolOrToolSet) {
                if (toolOrToolSet instanceof ToolSet) {
                    result.push(toToolSetVariableEntry(toolOrToolSet, ref.range));
                }
                else {
                    result.push(toToolVariableEntry(toolOrToolSet, ref.range));
                }
            }
        }
        return result;
    }
    getToolSet(id) {
        for (const toolSet of this._toolSets) {
            if (toolSet.id === id) {
                return toolSet;
            }
        }
        return undefined;
    }
    getToolSetByName(name) {
        for (const toolSet of this._toolSets) {
            if (toolSet.referenceName === name) {
                return toolSet;
            }
        }
        return undefined;
    }
    getSpecedToolSetName(referenceName) {
        if (LanguageModelToolsService_1.githubMCPServerAliases.includes(referenceName)) {
            return 'github';
        }
        if (LanguageModelToolsService_1.playwrightMCPServerAliases.includes(referenceName)) {
            return 'playwright';
        }
        return referenceName;
    }
    createToolSet(source, id, referenceName, options) {
        const that = this;
        referenceName = this.getSpecedToolSetName(referenceName);
        const result = new class extends ToolSet {
            dispose() {
                if (that._toolSets.has(result)) {
                    this._tools.clear();
                    that._toolSets.delete(result);
                }
            }
        }(id, referenceName, options?.icon ?? Codicon.tools, source, options?.description, options?.legacyFullNames);
        this._toolSets.add(result);
        return result;
    }
    *getPromptReferencableTools() {
        const coveredByToolSets = new Set();
        for (const toolSet of this.toolSets.get()) {
            if (toolSet.source.type !== 'user') {
                yield [toolSet, getToolSetReferenceName(toolSet)];
                for (const tool of toolSet.getTools()) {
                    yield [tool, getToolReferenceFullName(tool, toolSet)];
                    coveredByToolSets.add(tool);
                }
            }
        }
        for (const tool of this.getTools()) {
            if (tool.canBeReferencedInPrompt && !coveredByToolSets.has(tool)) {
                yield [tool, getToolReferenceFullName(tool)];
            }
        }
    }
    *getQualifiedToolNames() {
        for (const [, toolReferenceName] of this.getPromptReferencableTools()) {
            yield toolReferenceName;
        }
    }
    getDeprecatedQualifiedToolNames() {
        const result = new Map();
        const knownToolSetNames = new Set();
        const add = (name, toolReferenceName) => {
            if (name !== toolReferenceName) {
                if (!result.has(name)) {
                    result.set(name, new Set());
                }
                result.get(name).add(toolReferenceName);
            }
        };
        for (const [tool, _] of this.getPromptReferencableTools()) {
            if (tool instanceof ToolSet) {
                knownToolSetNames.add(tool.referenceName);
                if (tool.legacyFullNames) {
                    for (const legacyName of tool.legacyFullNames) {
                        knownToolSetNames.add(legacyName);
                    }
                }
            }
        }
        for (const [tool, toolReferenceName] of this.getPromptReferencableTools()) {
            if (tool instanceof ToolSet) {
                for (const alias of this.getToolSetAliases(tool, toolReferenceName)) {
                    add(alias, toolReferenceName);
                }
            }
            else {
                for (const alias of this.getToolAliases(tool, toolReferenceName)) {
                    add(alias, toolReferenceName);
                }
                if (tool.legacyToolReferenceFullNames) {
                    for (const legacyName of tool.legacyToolReferenceFullNames) {
                        // for any 'orphaned' toolsets (toolsets that no longer exist and
                        // do not have an explicit legacy mapping), we should
                        // just point them to the list of tools directly
                        if (legacyName.includes('/')) {
                            const toolSetFullName = legacyName.substring(0, legacyName.lastIndexOf('/'));
                            if (!knownToolSetNames.has(toolSetFullName)) {
                                add(toolSetFullName, toolReferenceName);
                            }
                        }
                    }
                }
            }
        }
        return result;
    }
    getToolByQualifiedName(qualifiedName) {
        for (const [tool, toolReferenceName] of this.getPromptReferencableTools()) {
            if (qualifiedName === toolReferenceName) {
                return tool;
            }
            const aliases = tool instanceof ToolSet ? this.getToolSetAliases(tool, toolReferenceName) : this.getToolAliases(tool, toolReferenceName);
            if (Iterable.some(aliases, alias => qualifiedName === alias)) {
                return tool;
            }
        }
        return undefined;
    }
    getQualifiedToolName(tool, toolSet) {
        if (tool instanceof ToolSet) {
            return getToolSetReferenceName(tool);
        }
        return getToolReferenceFullName(tool, toolSet);
    }
};
LanguageModelToolsService = LanguageModelToolsService_1 = __decorate([
    __param(0, IInstantiationService),
    __param(1, IExtensionService),
    __param(2, IContextKeyService),
    __param(3, IChatService),
    __param(4, IDialogService),
    __param(5, ITelemetryService),
    __param(6, ILogService),
    __param(7, IConfigurationService),
    __param(8, IAccessibilityService),
    __param(9, IAccessibilitySignalService),
    __param(10, IStorageService),
    __param(11, ILanguageModelToolsConfirmationService)
], LanguageModelToolsService);
export { LanguageModelToolsService };
function getToolReferenceFullName(tool, toolSet) {
    const toolName = tool.toolReferenceName ?? tool.displayName;
    if (toolSet) {
        return `${toolSet.referenceName}/${toolName}`;
    }
    else if (tool.source.type === 'extension') {
        return `${tool.source.extensionId.value.toLowerCase()}/${toolName}`;
    }
    return toolName;
}
function getToolSetReferenceName(toolSet) {
    if (toolSet.source.type === 'mcp') {
        return `${toolSet.referenceName}/*`;
    }
    return toolSet.referenceName;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvbGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDakYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM3RSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDakUsT0FBTyxFQUFxQix1QkFBdUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDekUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLG1CQUFtQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDM0YsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsY0FBYyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbkcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xJLE9BQU8sRUFBZSxhQUFhLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNuRixPQUFPLFFBQVEsTUFBTSxxQ0FBcUMsQ0FBQztB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