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
import { timeout } from '../../../../../../../base/common/async.js';
import { Emitter } from '../../../../../../../base/common/event.js';
import { MarkdownString } from '../../../../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../../../../base/common/lifecycle.js';
import { isObject, isString } from '../../../../../../../base/common/types.js';
import { localize } from '../../../../../../../nls.js';
import { ExtensionIdentifier } from '../../../../../../../platform/extensions/common/extensions.js';
import { IChatWidgetService } from '../../../../../chat/browser/chat.js';
import { ChatElicitationRequestPart } from '../../../../../chat/browser/chatElicitationRequestPart.js';
import { ChatModel } from '../../../../../chat/common/chatModel.js';
import { IChatService } from '../../../../../chat/common/chatService.js';
import { ChatAgentLocation } from '../../../../../chat/common/constants.js';
import { ILanguageModelsService } from '../../../../../chat/common/languageModels.js';
import { ITaskService } from '../../../../../tasks/common/taskService.js';
import { OutputMonitorState } from './types.js';
import { getTextResponseFromStream } from './utils.js';
import { IConfigurationService } from '../../../../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../../../../platform/log/common/log.js';
import { ITerminalService } from '../../../../../terminal/browser/terminal.js';
import { LocalChatSessionUri } from '../../../../../chat/common/chatUri.js';
let OutputMonitor = class OutputMonitor extends Disposable {
    get state() { return this._state; }
    get pollingResult() { return this._pollingResult; }
    get outputMonitorTelemetryCounters() { return this._outputMonitorTelemetryCounters; }
    constructor(_execution, _pollFn, invocationContext, token, command, _languageModelsService, _taskService, _chatService, _chatWidgetService, _configurationService, _logService, _terminalService) {
        super();
        this._execution = _execution;
        this._pollFn = _pollFn;
        this._languageModelsService = _languageModelsService;
        this._taskService = _taskService;
        this._chatService = _chatService;
        this._chatWidgetService = _chatWidgetService;
        this._configurationService = _configurationService;
        this._logService = _logService;
        this._terminalService = _terminalService;
        this._state = OutputMonitorState.PollingForIdle;
        this._outputMonitorTelemetryCounters = {
            inputToolManualAcceptCount: 0,
            inputToolManualRejectCount: 0,
            inputToolManualChars: 0,
            inputToolAutoAcceptCount: 0,
            inputToolAutoChars: 0,
            inputToolManualShownCount: 0,
            inputToolFreeFormInputShownCount: 0,
            inputToolFreeFormInputCount: 0,
        };
        this._onDidFinishCommand = this._register(new Emitter());
        this.onDidFinishCommand = this._onDidFinishCommand.event;
        // Start async to ensure listeners are set up
        timeout(0).then(() => {
            this._startMonitoring(command, invocationContext, token);
        });
    }
    async _startMonitoring(command, invocationContext, token) {
        const pollStartTime = Date.now();
        let modelOutputEvalResponse;
        let resources;
        let output;
        let extended = false;
        try {
            while (!token.isCancellationRequested) {
                switch (this._state) {
                    case OutputMonitorState.PollingForIdle: {
                        this._state = await this._waitForIdle(this._execution, extended, token);
                        continue;
                    }
                    case OutputMonitorState.Timeout: {
                        const shouldContinuePolling = await this._handleTimeoutState(command, invocationContext, extended, token);
                        if (shouldContinuePolling) {
                            extended = true;
                            continue;
                        }
                        else {
                            this._promptPart?.hide();
                            this._promptPart = undefined;
                            break;
                        }
                    }
                    case OutputMonitorState.Cancelled:
                        break;
                    case OutputMonitorState.Idle: {
                        const idleResult = await this._handleIdleState(token);
                        if (idleResult.shouldContinuePollling) {
                            this._state = OutputMonitorState.PollingForIdle;
                            continue;
                        }
                        else {
                            resources = idleResult.resources;
                            modelOutputEvalResponse = idleResult.modelOutputEvalResponse;
                            output = idleResult.output;
                        }
                        break;
                    }
                }
                if (this._state === OutputMonitorState.Idle || this._state === OutputMonitorState.Cancelled || this._state === OutputMonitorState.Timeout) {
                    break;
                }
            }
            if (token.isCancellationRequested) {
                this._state = OutputMonitorState.Cancelled;
            }
        }
        finally {
            this._pollingResult = {
                state: this._state,
                output: output ?? this._execution.getOutput(),
                modelOutputEvalResponse: token.isCancellationRequested ? 'Cancelled' : modelOutputEvalResponse,
                pollDurationMs: Date.now() - pollStartTime,
                resources
            };
            this._promptPart?.hide();
            this._promptPart = undefined;
            this._onDidFinishCommand.fire();
        }
    }
    async _handleIdleState(token) {
        const confirmationPrompt = await this._determineUserInputOptions(this._execution, token);
        if (confirmationPrompt?.detectedRequestForFreeFormInput) {
            this._outputMonitorTelemetryCounters.inputToolFreeFormInputShownCount++;
            const receivedTerminalInput = await this._requestFreeFormTerminalInput(token, this._execution, confirmationPrompt);
            if (receivedTerminalInput) {
                // Small delay to ensure input is processed
                await timeout(200);
                // Continue polling as we sent the input
                return { shouldContinuePollling: true };
            }
            else {
                // User declined
                return { shouldContinuePollling: false };
            }
        }
        if (confirmationPrompt?.options.length) {
            const suggestedOptionResult = await this._selectAndHandleOption(confirmationPrompt, token);
            if (suggestedOptionResult?.sentToTerminal) {
                // Continue polling as we sent the input
                return { shouldContinuePollling: true };
            }
            const confirmed = await this._confirmRunInTerminal(token, suggestedOptionResult?.suggestedOption ?? confirmationPrompt.options[0], this._execution, confirmationPrompt);
            if (confirmed) {
                // Continue polling as we sent the input
                return { shouldContinuePollling: true };
            }
            else {
                // User declined
                this._execution.instance.focus(true);
                return { shouldContinuePollling: false };
            }
        }
        // Let custom poller override if provided
        const custom = await this._pollFn?.(this._execution, token, this._taskService);
        const resources = custom?.resources;
        const modelOutputEvalResponse = await this._assessOutputForErrors(this._execution.getOutput(), token);
        return { resources, modelOutputEvalResponse, shouldContinuePollling: false, output: custom?.output };
    }
    async _handleTimeoutState(command, invocationContext, extended, token) {
        let continuePollingPart;
        if (extended) {
            this._state = OutputMonitorState.Cancelled;
            return false;
        }
        extended = true;
        const { promise: p, part } = await this._promptForMorePolling(command, token, invocationContext);
        let continuePollingDecisionP = p;
        continuePollingPart = part;
        // Start another polling pass and race it against the user's decision
        const nextPollP = this._waitForIdle(this._execution, extended, token)
            .catch(() => ({
            state: OutputMonitorState.Cancelled,
            output: this._execution.getOutput(),
            modelOutputEvalResponse: 'Cancelled'
        }));
        const race = await Promise.race([
            continuePollingDecisionP.then(v => ({ kind: 'decision', v })),
            nextPollP.then(r => ({ kind: 'poll', r }))
        ]);
        if (race.kind === 'decision') {
            try {
                continuePollingPart?.hide();
            }
            catch { /* noop */ }
            continuePollingPart = undefined;
            // User explicitly declined to keep waiting, so finish with the timed-out result
            if (race.v === false) {
                this._state = OutputMonitorState.Cancelled;
                return false;
            }
            // User accepted; keep polling (the loop iterates again).
            // Clear the decision so we don't race on a resolved promise.
            continuePollingDecisionP = undefined;
            return true;
        }
        else {
            // A background poll completed while waiting for a decision
            const r = race.r;
            if (r === OutputMonitorState.Idle || r === OutputMonitorState.Cancelled || r === OutputMonitorState.Timeout) {
                try {
                    continuePollingPart?.hide();
                }
                catch { /* noop */ }
                continuePollingPart = undefined;
                continuePollingDecisionP = undefined;
                return false;
            }
            // Still timing out; loop and race again with the same prompt.
            return true;
        }
    }
    /**
     * Single bounded polling pass that returns when:
     *  - terminal becomes inactive/idle, or
     *  - timeout window elapses.
     */
    async _waitForIdle(execution, extendedPolling, token) {
        const maxWaitMs = extendedPolling ? 120000 /* PollingConsts.ExtendedPollingMaxDuration */ : 20000 /* PollingConsts.FirstPollingMaxDuration */;
        const maxInterval = 2000 /* PollingConsts.MaxPollingIntervalDuration */;
        let currentInterval = 500 /* PollingConsts.MinPollingDuration */;
        let waited = 0;
        let consecutiveIdleEvents = 0;
        let hasReceivedData = false;
        const onDataDisposable = execution.instance.onData((_data) => {
            hasReceivedData = true;
        });
        try {
            while (!token.isCancellationRequested && waited < maxWaitMs) {
                const waitTime = Math.min(currentInterval, maxWaitMs - waited);
                await timeout(waitTime, token);
                waited += waitTime;
                currentInterval = Math.min(currentInterval * 2, maxInterval);
                const currentOutput = execution.getOutput();
                const promptResult = detectsInputRequiredPattern(currentOutput);
                if (promptResult) {
                    this._state = OutputMonitorState.Idle;
                    return this._state;
                }
                if (hasReceivedData) {
                    consecutiveIdleEvents = 0;
                    hasReceivedData = false;
                }
                else {
                    consecutiveIdleEvents++;
                }
                const recentlyIdle = consecutiveIdleEvents >= 2 /* PollingConsts.MinIdleEvents */;
                const isActive = execution.isActive ? await execution.isActive() : undefined;
                this._logService.trace(`OutputMonitor: waitForIdle check: waited=${waited}ms, recentlyIdle=${recentlyIdle}, isActive=${isActive}`);
                if (recentlyIdle && isActive !== true) {
                    this._state = OutputMonitorState.Idle;
                    return this._state;
                }
            }
        }
        finally {
            onDataDisposable.dispose();
        }
        if (token.isCancellationRequested) {
            return OutputMonitorState.Cancelled;
        }
        return OutputMonitorState.Timeout;
    }
    async _promptForMorePolling(command, token, context) {
        if (token.isCancellationRequested || this._state === OutputMonitorState.Cancelled) {
            return { promise: Promise.resolve(false) };
        }
        const result = this._createElicitationPart(token, context?.sessionId, new MarkdownString(localize('poll.terminal.waiting', "Continue waiting for `{0}`?", command)), new MarkdownString(localize('poll.terminal.polling', "This will continue to poll for output to determine when the terminal becomes idle for up to 2 minutes.")), '', localize('poll.terminal.accept', 'Yes'), localize('poll.terminal.reject', 'No'), async () => true, async () => { this._state = OutputMonitorState.Cancelled; return false; });
        return { promise: result.promise.then(p => p ?? false), part: result.part };
    }
    async _assessOutputForErrors(buffer, token) {
        const model = await this._getLanguageModel();
        if (!model) {
            return 'No models available';
        }
        const response = await this._languageModelsService.sendChatRequest(model, new ExtensionIdentifier('core'), [{ role: 1 /* ChatMessageRole.User */, content: [{ type: 'text', value: `Evaluate this terminal output to determine if there were errors. If there are errors, return them. Otherwise, return undefined: ${buffer}.` }] }], {}, token);
        try {
            const responseFromStream = getTextResponseFromStream(response);
            await Promise.all([response.result, responseFromStream]);
            return await responseFromStream;
        }
        catch (err) {
            return 'Error occurred ' + err;
        }
    }
    async _determineUserInputOptions(execution, token) {
        if (token.isCancellationRequested) {
            return;
        }
        const model = await this._getLanguageModel();
        if (!model) {
            return undefined;
        }
        const lastLines = execution.getOutput(this._lastPromptMarker).trimEnd().split('\n').slice(-15).join('\n');
        const promptText = `Analyze the following terminal output. If it contains a prompt requesting user input (such as a confirmation, selection, or yes/no question) and that prompt has NOT already been answered, extract the prompt text. The prompt may ask to choose from a set. If so, extract the possible options as a JSON object with keys 'prompt', 'options' (an array of strings or an object with option to description mappings), and 'freeFormInput': false. If no options are provided, and free form input is requested, for example: Password:, return the word freeFormInput. For example, if the options are "[Y] Yes  [A] Yes to All  [N] No  [L] No to All  [C] Cancel", the option to description mappings would be {"Y": "Yes", "A": "Yes to All", "N": "No", "L": "No to All", "C": "Cancel"}. If there is no such prompt, return null. If the option is ambiguous, return null.
			Examples:
			1. Output: "Do you want to overwrite? (y/n)"
				Response: {"prompt": "Do you want to overwrite?", "options": ["y", "n"], "freeFormInput": false}

			2. Output: "Confirm: [Y] Yes  [A] Yes to All  [N] No  [L] No to All  [C] Cancel"
				Response: {"prompt": "Confirm", "options": ["Y", "A", "N", "L", "C"], "freeFormInput": false}

			3. Output: "Accept license terms? (yes/no)"
				Response: {"prompt": "Accept license terms?", "options": ["yes", "no"], "freeFormInput": false}

			4. Output: "Press Enter to continue"
				Response: {"prompt": "Press Enter to continue", "options": ["Enter"], "freeFormInput": false}

			5. Output: "Type Yes to proceed"
				Response: {"prompt": "Type Yes to proceed", "options": ["Yes"], "freeFormInput": false}

			6. Output: "Continue [y/N]"
				Response: {"prompt": "Continue", "options": ["y", "N"], "freeFormInput": false}

			7. Output: "Press any key to close the terminal."
				Response: {"prompt": "Press any key to continue...", "options": ["a"], "freeFormInput": false}

			8. Output: "Terminal will be reused by tasks, press any key to close it."
				Response: {"prompt": "Terminal will be reused by tasks, press any key to close it.", "options": ["a"], "freeFormInput": false}

			9. Output: "Password:"
				Response: {"prompt": "Password:", "freeFormInput": true, "options": []}
			10. Output: "press ctrl-c to detach, ctrl-d to kill"
				Response: null

			Alternatively, the prompt may request free form input, for example:
			1. Output: "Enter your username:"
				Response: {"prompt": "Enter your username:", "freeFormInput": true, "options": []}
			2. Output: "Password:"
				Response: {"prompt": "Password:", "freeFormInput": true, "options": []}
			Now, analyze this output:
			${lastLines}
			`;
        const response = await this._languageModelsService.sendChatRequest(model, new ExtensionIdentifier('core'), [{ role: 1 /* ChatMessageRole.User */, content: [{ type: 'text', value: promptText }] }], {}, token);
        const responseText = await getTextResponseFromStream(response);
        try {
            const match = responseText.match(/\{[\s\S]*\}/);
            if (match) {
                const obj = JSON.parse(match[0]);
                if (isObject(obj) &&
                    'prompt' in obj && isString(obj.prompt) &&
                    'options' in obj &&
                    'options' in obj &&
                    'freeFormInput' in obj && typeof obj.freeFormInput === 'boolean') {
                    if (this._lastPrompt === obj.prompt) {
                        return;
                    }
                    if (obj.freeFormInput === true) {
                        return { prompt: obj.prompt, options: [], detectedRequestForFreeFormInput: true };
                    }
                    if (Array.isArray(obj.options) && obj.options.every(isString)) {
                        return { prompt: obj.prompt, options: obj.options, detectedRequestForFreeFormInput: obj.freeFormInput };
                    }
                    else if (isObject(obj.options) && Object.values(obj.options).every(isString)) {
                        const keys = Object.keys(obj.options);
                        if (keys.length === 0) {
                            return undefined;
                        }
                        const descriptions = keys.map(key => obj.options[key]);
                        return { prompt: obj.prompt, options: keys, descriptions, detectedRequestForFreeFormInput: obj.freeFormInput };
                    }
                }
            }
        }
        catch (err) {
            console.error('Failed to parse confirmation prompt from language model response:', err);
        }
        return undefined;
    }
    async _selectAndHandleOption(confirmationPrompt, token) {
        if (!confirmationPrompt?.options.length) {
            return undefined;
        }
        const model = this._chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Chat)[0]?.input.currentLanguageModel;
        if (!model) {
            return undefined;
        }
        const models = await this._languageModelsService.selectLanguageModels({ vendor: 'copilot', family: model.replaceAll('copilot/', '') });
        if (!models.length) {
            return undefined;
        }
        const prompt = confirmationPrompt.prompt;
        const options = confirmationPrompt.options;
        const currentMarker = this._execution.instance.registerMarker();
        if (!currentMarker) {
            // Unable to register marker, so cannot track prompt location
            return undefined;
        }
        this._lastPromptMarker = currentMarker;
        this._lastPrompt = prompt;
        const promptText = `Given the following confirmation prompt and options from a terminal output, which option is the default?\nPrompt: "${prompt}"\nOptions: ${JSON.stringify(options)}\nRespond with only the option string.`;
        const response = await this._languageModelsService.sendChatRequest(models[0], new ExtensionIdentifier('core'), [
            { role: 1 /* ChatMessageRole.User */, content: [{ type: 'text', value: promptText }] }
        ], {}, token);
        const suggestedOption = (await getTextResponseFromStream(response)).trim();
        if (!suggestedOption) {
            return;
        }
        const parsed = suggestedOption.replace(/['"`]/g, '').trim();
        const index = confirmationPrompt.options.indexOf(parsed);
        const validOption = confirmationPrompt.options.find(opt => parsed === 'any key' || parsed === opt.replace(/['"`]/g, '').trim());
        if (!validOption || index === -1) {
            return;
        }
        let sentToTerminal = false;
        if (this._configurationService.getValue("chat.tools.terminal.autoReplyToPrompts" /* TerminalChatAgentToolsSettingId.AutoReplyToPrompts */)) {
            await this._execution.instance.sendText(validOption, true);
            this._outputMonitorTelemetryCounters.inputToolAutoAcceptCount++;
            this._outputMonitorTelemetryCounters.inputToolAutoChars += validOption?.length || 0;
            sentToTerminal = true;
        }
        const description = confirmationPrompt.descriptions?.[index];
        return description ? { suggestedOption: { description, option: validOption }, sentToTerminal } : { suggestedOption: validOption, sentToTerminal };
    }
    async _requestFreeFormTerminalInput(token, execution, confirmationPrompt) {
        const focusTerminalSelection = Symbol('focusTerminalSelection');
        const { promise: userPrompt, part } = this._createElicitationPart(token, execution.sessionId, new MarkdownString(localize('poll.terminal.inputRequest', "The terminal is awaiting input.")), new MarkdownString(localize('poll.terminal.requireInput', "{0}\nPlease provide the required input to the terminal.\n\n", confirmationPrompt.prompt)), '', localize('poll.terminal.enterInput', 'Focus terminal'), undefined, () => {
            this._showInstance(execution.instance.instanceId);
            return focusTerminalSelection;
        });
        let inputDataDisposable = Disposable.None;
        let instanceDisposedDisposable = Disposable.None;
        const inputPromise = new Promise(resolve => {
            let settled = false;
            const settle = (value, state) => {
                if (settled) {
                    return;
                }
                settled = true;
                part.hide();
                inputDataDisposable.dispose();
                instanceDisposedDisposable.dispose();
                this._state = state;
                resolve(value);
            };
            inputDataDisposable = this._register(execution.instance.onDidInputData((data) => {
                if (!data || data === '\r' || data === '\n' || data === '\r\n') {
                    this._outputMonitorTelemetryCounters.inputToolFreeFormInputCount++;
                    settle(true, OutputMonitorState.PollingForIdle);
                }
            }));
            instanceDisposedDisposable = this._register(execution.instance.onDisposed(() => {
                settle(false, OutputMonitorState.Cancelled);
            }));
        });
        const disposeListeners = () => {
            inputDataDisposable.dispose();
            instanceDisposedDisposable.dispose();
        };
        const result = await Promise.race([userPrompt, inputPromise]);
        if (result === focusTerminalSelection) {
            execution.instance.focus(true);
            return await inputPromise;
        }
        if (result === undefined) {
            disposeListeners();
            // Prompt was dismissed without providing input
            return false;
        }
        disposeListeners();
        return !!result;
    }
    async _confirmRunInTerminal(token, suggestedOption, execution, confirmationPrompt) {
        let suggestedOptionValue = isString(suggestedOption) ? suggestedOption : suggestedOption.option;
        if (suggestedOptionValue === 'any key') {
            suggestedOptionValue = 'a';
        }
        const focusTerminalSelection = Symbol('focusTerminalSelection');
        let inputDataDisposable = Disposable.None;
        let instanceDisposedDisposable = Disposable.None;
        const { promise: userPrompt, part } = this._createElicitationPart(token, execution.sessionId, new MarkdownString(localize('poll.terminal.confirmRequired', "The terminal is awaiting input.")), new MarkdownString(localize('poll.terminal.confirmRunDetail', "{0}\n Do you want to send `{1}`{2} followed by `Enter` to the terminal?", confirmationPrompt.prompt, suggestedOptionValue, isString(suggestedOption) ? '' : suggestedOption.description ? ' (' + suggestedOption.description + ')' : '')), '', localize('poll.terminal.acceptRun', 'Allow'), localize('poll.terminal.rejectRun', 'Focus Terminal'), async (value) => {
            let option = undefined;
            if (value === true) {
                option = suggestedOptionValue;
            }
            else if (typeof value === 'object' && 'label' in value) {
                option = value.label.split(' (')[0];
            }
            this._outputMonitorTelemetryCounters.inputToolManualAcceptCount++;
            this._outputMonitorTelemetryCounters.inputToolManualChars += option?.length || 0;
            return option;
        }, () => {
            this._showInstance(execution.instance.instanceId);
            this._outputMonitorTelemetryCounters.inputToolManualRejectCount++;
            return focusTerminalSelection;
        }, getMoreActions(suggestedOption, confirmationPrompt));
        const inputPromise = new Promise(resolve => {
            let settled = false;
            const settle = (value, state) => {
                if (settled) {
                    return;
                }
                settled = true;
                part.hide();
                inputDataDisposable.dispose();
                instanceDisposedDisposable.dispose();
                this._state = state;
                resolve(value);
            };
            inputDataDisposable = this._register(execution.instance.onDidInputData(() => {
                settle(true, OutputMonitorState.PollingForIdle);
            }));
            instanceDisposedDisposable = this._register(execution.instance.onDisposed(() => {
                settle(false, OutputMonitorState.Cancelled);
            }));
        });
        const disposeListeners = () => {
            inputDataDisposable.dispose();
            instanceDisposedDisposable.dispose();
        };
        const optionToRun = await Promise.race([userPrompt, inputPromise]);
        if (optionToRun === focusTerminalSelection) {
            execution.instance.focus(true);
            return await inputPromise;
        }
        if (optionToRun === true) {
            disposeListeners();
            return true;
        }
        if (typeof optionToRun === 'string' && optionToRun.length) {
            execution.instance.focus(true);
            disposeListeners();
            await execution.instance.sendText(optionToRun, true);
            return optionToRun;
        }
        disposeListeners();
        return optionToRun;
    }
    _showInstance(instanceId) {
        if (!instanceId) {
            return;
        }
        const instance = this._terminalService.getInstanceFromId(instanceId);
        if (!instance) {
            return;
        }
        this._terminalService.setActiveInstance(instance);
        this._terminalService.revealActiveTerminal(true);
    }
    // Helper to create, register, and wire a ChatElicitationRequestPart. Returns the promise that
    // resolves when the part is accepted/rejected and the registered part itself so callers can
    // attach additional listeners (e.g., onDidRequestHide) or compose with other promises.
    _createElicitationPart(token, sessionId, title, detail, subtitle, acceptLabel, rejectLabel, onAccept, onReject, moreActions) {
        const chatModel = sessionId && this._chatService.getSession(LocalChatSessionUri.forSession(sessionId));
        if (!(chatModel instanceof ChatModel)) {
            throw new Error('No model');
        }
        const request = chatModel.getRequests().at(-1);
        if (!request) {
            throw new Error('No request');
        }
        let part;
        const promise = new Promise(resolve => {
            const thePart = part = this._register(new ChatElicitationRequestPart(title, detail, subtitle, acceptLabel, rejectLabel, async (value) => {
                thePart.hide();
                this._promptPart = undefined;
                try {
                    const r = await (onAccept ? onAccept(value) : undefined);
                    resolve(r);
                }
                catch {
                    resolve(undefined);
                }
                return "accepted" /* ElicitationState.Accepted */;
            }, async () => {
                thePart.hide();
                this._promptPart = undefined;
                try {
                    const r = await (onReject ? onReject() : undefined);
                    resolve(r);
                }
                catch {
                    resolve(undefined);
                }
                return "rejected" /* ElicitationState.Rejected */;
            }, undefined, // source
            moreActions, () => this._outputMonitorTelemetryCounters.inputToolManualShownCount++));
            chatModel.acceptResponseProgress(request, thePart);
            this._promptPart = thePart;
        });
        this._register(token.onCancellationRequested(() => part.hide()));
        return { promise, part };
    }
    async _getLanguageModel() {
        let models = await this._languageModelsService.selectLanguageModels({ vendor: 'copilot', id: 'copilot-fast' });
        // Fallback to gpt-4o-mini if copilot-fast is not available for backwards compatibility
        if (!models.length) {
            models = await this._languageModelsService.selectLanguageModels({ vendor: 'copilot', family: 'gpt-4o-mini' });
        }
        return models.length ? models[0] : undefined;
    }
};
OutputMonitor = __decorate([
    __param(5, ILanguageModelsService),
    __param(6, ITaskService),
    __param(7, IChatService),
    __param(8, IChatWidgetService),
    __param(9, IConfigurationService),
    __param(10, ILogService),
    __param(11, ITerminalService)
], OutputMonitor);
export { OutputMonitor };
function getMoreActions(suggestedOption, confirmationPrompt) {
    const moreActions = [];
    const moreOptions = confirmationPrompt.options.filter(a => a !== (isString(suggestedOption) ? suggestedOption : suggestedOption.option));
    let i = 0;
    for (const option of moreOptions) {
        const label = option + (confirmationPrompt.descriptions ? ' (' + confirmationPrompt.descriptions[i] + ')' : '');
        const action = {
            label,
            tooltip: label,
            id: `terminal.poll.send.${option}`,
            class: undefined,
            enabled: true,
            run: async () => { }
        };
        i++;
        moreActions.push(action);
    }
    return moreActions.length ? moreActions : undefined;
}
export function detectsInputRequiredPattern(cursorLine) {
    return [
        // PowerShell-style multi-option line (supports [?] Help and optional default suffix) ending
        // in whitespace
        /\s*(?:\[[^\]]\]\s+[^\[]+\s*)+(?:\(default is\s+"[^"]+"\):)?\s+$/,
        // Bracketed/parenthesized yes/no pairs at end of line: (y/n), [Y/n], (yes/no), [no/yes]
        /(?:\(|\[)\s*(?:y(?:es)?\s*\/\s*n(?:o)?|n(?:o)?\s*\/\s*y(?:es)?)\s*(?:\]|\))\s+$/i,
        // Same as above but allows a preceding '?' or ':' and optional wrappers e.g.
        // "Continue? (y/n)" or "Overwrite: [yes/no]"
        /[?:]\s*(?:\(|\[)?\s*y(?:es)?\s*\/\s*n(?:o)?\s*(?:\]|\))?\s+$/i,
        // Confirmation prompts ending with (y) e.g. "Ok to proceed? (y)"
        /\(y\)\s*$/i,
        // Line ends with ':'
        /:\s*$/,
        // Line contains (END) which is common in pagers
        /\(END\)$/,
        // Password prompt
        /password[:]?$/i,
        // Line ends with '?'
        /\?\s*(?:\([a-z\s]+\))?$/i,
        // "Press a key" or "Press any key"
        /press a(?:ny)? key/i,
    ].some(e => e.test(cursorLine));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0TW9uaXRvci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvY2hhdEFnZW50VG9vbHMvYnJvd3Nlci90b29scy9tb25pdG9yaW5nL291dHB1dE1vbml0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFJaEcsT0FBTyxFQUFFLE9BQU8sRUFBcUIsTUFBTSwyQ0FBMkMsQ0FBQztBQUV2RixPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sMkNBQTJDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxVQUFVLEVBQW9CLE1BQU0sK0NBQStDLENBQUM7QUFDN0YsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMvRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDcEcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDekUsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDdkcsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BFLE9BQU8sRUFBb0IsWUFBWSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDM0YsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDNUUsT0FBTyxFQUFtQixzQkFBc0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBRXZHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUUxRSxPQUFPLEVBQW1ELGtCQUFrQixFQUFpQixNQUFN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