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
var InputEditorDecorations_1;
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Disposable, MutableDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun } from '../../../../../base/common/observable.js';
import { themeColorFromId } from '../../../../../base/common/themables.js';
import { URI } from '../../../../../base/common/uri.js';
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { inputPlaceholderForeground } from '../../../../../platform/theme/common/colorRegistry.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IChatAgentService } from '../../common/chatAgents.js';
import { chatSlashCommandBackground, chatSlashCommandForeground } from '../../common/chatColors.js';
import { ChatRequestAgentPart, ChatRequestAgentSubcommandPart, ChatRequestDynamicVariablePart, ChatRequestSlashCommandPart, ChatRequestSlashPromptPart, ChatRequestTextPart, ChatRequestToolPart, ChatRequestToolSetPart, chatAgentLeader, chatSubcommandLeader } from '../../common/chatParserTypes.js';
import { ChatRequestParser } from '../../common/chatRequestParser.js';
import { IPromptsService } from '../../common/promptSyntax/service/promptsService.js';
import { ChatWidget } from '../chatWidget.js';
import { dynamicVariableDecorationType } from './chatDynamicVariables.js';
import { NativeEditContextRegistry } from '../../../../../editor/browser/controller/editContext/native/nativeEditContextRegistry.js';
import { ThrottledDelayer } from '../../../../../base/common/async.js';
const decorationDescription = 'chat';
const placeholderDecorationType = 'chat-session-detail';
const slashCommandTextDecorationType = 'chat-session-text';
const variableTextDecorationType = 'chat-variable-text';
function agentAndCommandToKey(agent, subcommand) {
    return subcommand ? `${agent.id}__${subcommand}` : agent.id;
}
function isWhitespaceOrPromptPart(p) {
    return (p instanceof ChatRequestTextPart && !p.text.trim().length) || (p instanceof ChatRequestSlashPromptPart);
}
function exactlyOneSpaceAfterPart(parsedRequest, part) {
    const partIdx = parsedRequest.indexOf(part);
    if (parsedRequest.length > partIdx + 2) {
        return false;
    }
    const nextPart = parsedRequest[partIdx + 1];
    return nextPart && nextPart instanceof ChatRequestTextPart && nextPart.text === ' ';
}
function getRangeForPlaceholder(part) {
    return {
        startLineNumber: part.editorRange.startLineNumber,
        endLineNumber: part.editorRange.endLineNumber,
        startColumn: part.editorRange.endColumn + 1,
        endColumn: 1000
    };
}
let InputEditorDecorations = class InputEditorDecorations extends Disposable {
    static { InputEditorDecorations_1 = this; }
    static { this.UPDATE_DELAY = 200; }
    constructor(widget, codeEditorService, themeService, chatAgentService, labelService, promptsService) {
        super();
        this.widget = widget;
        this.codeEditorService = codeEditorService;
        this.themeService = themeService;
        this.chatAgentService = chatAgentService;
        this.labelService = labelService;
        this.promptsService = promptsService;
        this.id = 'inputEditorDecorations';
        this.previouslyUsedAgents = new Set();
        this.viewModelDisposables = this._register(new MutableDisposable());
        this.updateThrottle = this._register(new ThrottledDelayer(InputEditorDecorations_1.UPDATE_DELAY));
        this.codeEditorService.registerDecorationType(decorationDescription, placeholderDecorationType, {});
        this.registeredDecorationTypes();
        this.triggerInputEditorDecorationsUpdate();
        this._register(this.widget.inputEditor.onDidChangeModelContent(() => this.triggerInputEditorDecorationsUpdate()));
        this._register(this.widget.onDidChangeParsedInput(() => this.triggerInputEditorDecorationsUpdate()));
        this._register(this.widget.onDidChangeViewModel(() => {
            this.registerViewModelListeners();
            this.previouslyUsedAgents.clear();
            this.triggerInputEditorDecorationsUpdate();
        }));
        this._register(this.widget.onDidSubmitAgent((e) => {
            this.previouslyUsedAgents.add(agentAndCommandToKey(e.agent, e.slashCommand?.name));
        }));
        this._register(this.chatAgentService.onDidChangeAgents(() => this.triggerInputEditorDecorationsUpdate()));
        this._register(this.promptsService.onDidChangeSlashCommands(() => this.triggerInputEditorDecorationsUpdate()));
        this._register(autorun(reader => {
            // Watch for changes to the current mode and its properties
            const currentMode = this.widget.input.currentModeObs.read(reader);
            if (currentMode) {
                // Also watch the mode's description to react to any changes
                currentMode.description.read(reader);
            }
            // Trigger decoration update when mode or its properties change
            this.triggerInputEditorDecorationsUpdate();
        }));
        this.registerViewModelListeners();
    }
    registerViewModelListeners() {
        this.viewModelDisposables.value = this.widget.viewModel?.onDidChange(e => {
            if (e?.kind === 'changePlaceholder' || e?.kind === 'initialize') {
                this.triggerInputEditorDecorationsUpdate();
            }
        });
    }
    registeredDecorationTypes() {
        this.codeEditorService.registerDecorationType(decorationDescription, slashCommandTextDecorationType, {
            color: themeColorFromId(chatSlashCommandForeground),
            backgroundColor: themeColorFromId(chatSlashCommandBackground),
            borderRadius: '3px'
        });
        this.codeEditorService.registerDecorationType(decorationDescription, variableTextDecorationType, {
            color: themeColorFromId(chatSlashCommandForeground),
            backgroundColor: themeColorFromId(chatSlashCommandBackground),
            borderRadius: '3px'
        });
        this.codeEditorService.registerDecorationType(decorationDescription, dynamicVariableDecorationType, {
            color: themeColorFromId(chatSlashCommandForeground),
            backgroundColor: themeColorFromId(chatSlashCommandBackground),
            borderRadius: '3px',
            rangeBehavior: 1 /* TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges */
        });
        this._register(toDisposable(() => {
            this.codeEditorService.removeDecorationType(variableTextDecorationType);
            this.codeEditorService.removeDecorationType(dynamicVariableDecorationType);
            this.codeEditorService.removeDecorationType(slashCommandTextDecorationType);
        }));
    }
    getPlaceholderColor() {
        const theme = this.themeService.getColorTheme();
        const transparentForeground = theme.getColor(inputPlaceholderForeground);
        return transparentForeground?.toString();
    }
    triggerInputEditorDecorationsUpdate() {
        // update placeholder decorations immediately, in sync
        this.updateInputPlaceholderDecoration();
        // with a delay, update the rest of the decorations
        this.updateThrottle.trigger(token => this.updateAsyncInputEditorDecorations(token));
    }
    updateInputPlaceholderDecoration() {
        const inputValue = this.widget.inputEditor.getValue();
        const viewModel = this.widget.viewModel;
        if (!viewModel) {
            this.updateAriaPlaceholder(undefined);
            return;
        }
        if (!inputValue) {
            const mode = this.widget.input.currentModeObs.get();
            const placeholder = mode.argumentHint?.get() ?? mode.description.get() ?? '';
            const displayPlaceholder = viewModel.inputPlaceholder || placeholder;
            const decoration = [
                {
                    range: {
                        startLineNumber: 1,
                        endLineNumber: 1,
                        startColumn: 1,
                        endColumn: 1000
                    },
                    renderOptions: {
                        after: {
                            contentText: displayPlaceholder,
                            color: this.getPlaceholderColor()
                        }
                    }
                }
            ];
            this.updateAriaPlaceholder(displayPlaceholder || undefined);
            this.widget.inputEditor.setDecorationsByType(decorationDescription, placeholderDecorationType, decoration);
            return;
        }
        this.updateAriaPlaceholder(undefined);
        const parsedRequest = this.widget.parsedInput.parts;
        let placeholderDecoration;
        const agentPart = parsedRequest.find((p) => p instanceof ChatRequestAgentPart);
        const agentSubcommandPart = parsedRequest.find((p) => p instanceof ChatRequestAgentSubcommandPart);
        const onlyAgentAndWhitespace = agentPart && parsedRequest.every(p => p instanceof ChatRequestTextPart && !p.text.trim().length || p instanceof ChatRequestAgentPart);
        if (onlyAgentAndWhitespace) {
            // Agent reference with no other text - show the placeholder
            const isFollowupSlashCommand = this.previouslyUsedAgents.has(agentAndCommandToKey(agentPart.agent, undefined));
            const shouldRenderFollowupPlaceholder = isFollowupSlashCommand && agentPart.agent.metadata.followupPlaceholder;
            if (agentPart.agent.description && exactlyOneSpaceAfterPart(parsedRequest, agentPart)) {
                placeholderDecoration = [{
                        range: getRangeForPlaceholder(agentPart),
                        renderOptions: {
                            after: {
                                contentText: shouldRenderFollowupPlaceholder ? agentPart.agent.metadata.followupPlaceholder : agentPart.agent.description,
                                color: this.getPlaceholderColor(),
                            }
                        }
                    }];
            }
        }
        const onlyAgentAndAgentCommandAndWhitespace = agentPart && agentSubcommandPart && parsedRequest.every(p => p instanceof ChatRequestTextPart && !p.text.trim().length || p instanceof ChatRequestAgentPart || p instanceof ChatRequestAgentSubcommandPart);
        if (onlyAgentAndAgentCommandAndWhitespace) {
            // Agent reference and subcommand with no other text - show the placeholder
            const isFollowupSlashCommand = this.previouslyUsedAgents.has(agentAndCommandToKey(agentPart.agent, agentSubcommandPart.command.name));
            const shouldRenderFollowupPlaceholder = isFollowupSlashCommand && agentSubcommandPart.command.followupPlaceholder;
            if (agentSubcommandPart?.command.description && exactlyOneSpaceAfterPart(parsedRequest, agentSubcommandPart)) {
                placeholderDecoration = [{
                        range: getRangeForPlaceholder(agentSubcommandPart),
                        renderOptions: {
                            after: {
                                contentText: shouldRenderFollowupPlaceholder ? agentSubcommandPart.command.followupPlaceholder : agentSubcommandPart.command.description,
                                color: this.getPlaceholderColor(),
                            }
                        }
                    }];
            }
        }
        const onlyAgentCommandAndWhitespace = agentSubcommandPart && parsedRequest.every(p => p instanceof ChatRequestTextPart && !p.text.trim().length || p instanceof ChatRequestAgentSubcommandPart);
        if (onlyAgentCommandAndWhitespace) {
            // Agent subcommand with no other text - show the placeholder
            if (agentSubcommandPart?.command.description && exactlyOneSpaceAfterPart(parsedRequest, agentSubcommandPart)) {
                placeholderDecoration = [{
                        range: getRangeForPlaceholder(agentSubcommandPart),
                        renderOptions: {
                            after: {
                                contentText: agentSubcommandPart.command.description,
                                color: this.getPlaceholderColor(),
                            }
                        }
                    }];
            }
        }
        this.widget.inputEditor.setDecorationsByType(decorationDescription, placeholderDecorationType, placeholderDecoration ?? []);
    }
    async updateAsyncInputEditorDecorations(token) {
        const parsedRequest = this.widget.parsedInput.parts;
        const agentPart = parsedRequest.find((p) => p instanceof ChatRequestAgentPart);
        const agentSubcommandPart = parsedRequest.find((p) => p instanceof ChatRequestAgentSubcommandPart);
        const slashCommandPart = parsedRequest.find((p) => p instanceof ChatRequestSlashCommandPart);
        const slashPromptPart = parsedRequest.find((p) => p instanceof ChatRequestSlashPromptPart);
        // first, fetch all async context
        const promptSlashCommand = slashPromptPart ? await this.promptsService.resolvePromptSlashCommand(slashPromptPart.name, token) : undefined;
        if (token.isCancellationRequested) {
            // a new update came in while we were waiting
            return;
        }
        if (slashPromptPart && promptSlashCommand) {
            const onlyPromptCommandAndWhitespace = slashPromptPart && parsedRequest.every(isWhitespaceOrPromptPart);
            if (onlyPromptCommandAndWhitespace && exactlyOneSpaceAfterPart(parsedRequest, slashPromptPart) && promptSlashCommand) {
                const description = promptSlashCommand.argumentHint ?? promptSlashCommand.description;
                if (description) {
                    this.widget.inputEditor.setDecorationsByType(decorationDescription, placeholderDecorationType, [{
                            range: getRangeForPlaceholder(slashPromptPart),
                            renderOptions: {
                                after: {
                                    contentText: description,
                                    color: this.getPlaceholderColor(),
                                }
                            }
                        }]);
                }
            }
        }
        const textDecorations = [];
        if (agentPart) {
            textDecorations.push({ range: agentPart.editorRange });
        }
        if (agentSubcommandPart) {
            textDecorations.push({ range: agentSubcommandPart.editorRange, hoverMessage: new MarkdownString(agentSubcommandPart.command.description) });
        }
        if (slashCommandPart) {
            textDecorations.push({ range: slashCommandPart.editorRange });
        }
        if (slashPromptPart && promptSlashCommand) {
            textDecorations.push({ range: slashPromptPart.editorRange });
        }
        this.widget.inputEditor.setDecorationsByType(decorationDescription, slashCommandTextDecorationType, textDecorations);
        const varDecorations = [];
        const toolParts = parsedRequest.filter((p) => p instanceof ChatRequestToolPart || p instanceof ChatRequestToolSetPart);
        for (const tool of toolParts) {
            varDecorations.push({ range: tool.editorRange });
        }
        const dynamicVariableParts = parsedRequest.filter((p) => p instanceof ChatRequestDynamicVariablePart);
        const isEditingPreviousRequest = !!this.widget.viewModel?.editing;
        if (isEditingPreviousRequest) {
            for (const variable of dynamicVariableParts) {
                varDecorations.push({ range: variable.editorRange, hoverMessage: URI.isUri(variable.data) ? new MarkdownString(this.labelService.getUriLabel(variable.data, { relative: true })) : undefined });
            }
        }
        this.widget.inputEditor.setDecorationsByType(decorationDescription, variableTextDecorationType, varDecorations);
    }
    updateAriaPlaceholder(value) {
        const nativeEditContext = NativeEditContextRegistry.get(this.widget.inputEditor.getId());
        const domNode = nativeEditContext?.domNode.domNode;
        if (!domNode) {
            return;
        }
        if (value && value.trim().length) {
            domNode.setAttribute('aria-placeholder', value);
        }
        else {
            domNode.removeAttribute('aria-placeholder');
        }
    }
};
InputEditorDecorations = InputEditorDecorations_1 = __decorate([
    __param(1, ICodeEditorService),
    __param(2, IThemeService),
    __param(3, IChatAgentService),
    __param(4, ILabelService),
    __param(5, IPromptsService)
], InputEditorDecorations);
class InputEditorSlashCommandMode extends Disposable {
    constructor(widget) {
        super();
        this.widget = widget;
        this.id = 'InputEditorSlashCommandMode';
        this._register(this.widget.onDidChangeAgent(e => {
            if (e.slashCommand && e.slashCommand.isSticky || !e.slashCommand && e.agent.metadata.isSticky) {
                this.repopulateAgentCommand(e.agent, e.slashCommand);
            }
        }));
        this._register(this.widget.onDidSubmitAgent(e => {
            this.repopulateAgentCommand(e.agent, e.slashCommand);
        }));
    }
    async repopulateAgentCommand(agent, slashCommand) {
        // Make sure we don't repopulate if the user already has something in the input
        if (this.widget.inputEditor.getValue().trim()) {
            return;
        }
        let value;
        if (slashCommand && slashCommand.isSticky) {
            value = `${chatAgentLeader}${agent.name} ${chatSubcommandLeader}${slashCommand.name} `;
        }
        else if (agent.metadata.isSticky) {
            value = `${chatAgentLeader}${agent.name} `;
        }
        if (value) {
            this.widget.inputEditor.setValue(value);
            this.widget.inputEditor.setPosition({ lineNumber: 1, column: value.length + 1 });
        }
    }
}
ChatWidget.CONTRIBS.push(InputEditorDecorations, InputEditorSlashCommandMode);
let ChatTokenDeleter = class ChatTokenDeleter extends Disposable {
    constructor(widget, instantiationService) {
        super();
        this.widget = widget;
        this.instantiationService = instantiationService;
        this.id = 'chatTokenDeleter';
        const parser = this.instantiationService.createInstance(ChatRequestParser);
        const inputValue = this.widget.inputEditor.getValue();
        let previousInputValue;
        let previousSelectedAgent;
        // A simple heuristic to delete the previous token when the user presses backspace.
        // The sophisticated way to do this would be to have a parse tree that can be updated incrementally.
        this._register(this.widget.inputEditor.onDidChangeModelContent(e => {
            if (!previousInputValue) {
                previousInputValue = inputValue;
                previousSelectedAgent = this.widget.lastSelectedAgent;
            }
            // Don't try to handle multicursor edits right now
            const change = e.changes[0];
            // If this was a simple delete, try to find out whether it was inside a token
            if (!change.text && this.widget.viewModel) {
                const previousParsedValue = parser.parseChatRequest(this.widget.viewModel.sessionResource, previousInputValue, widget.location, { selectedAgent: previousSelectedAgent, mode: this.widget.input.currentModeKind });
                // For dynamic variables, this has to happen in ChatDynamicVariableModel with the other bookkeeping
                const deletableTokens = previousParsedValue.parts.filter(p => p instanceof ChatRequestAgentPart || p instanceof ChatRequestAgentSubcommandPart || p instanceof ChatRequestSlashCommandPart || p instanceof ChatRequestSlashPromptPart || p instanceof ChatRequestToolPart);
                deletableTokens.forEach(token => {
                    const deletedRangeOfToken = Range.intersectRanges(token.editorRange, change.range);
                    // Part of this token was deleted, or the space after it was deleted, and the deletion range doesn't go off the front of the token, for simpler math
                    if (deletedRangeOfToken && Range.compareRangesUsingStarts(token.editorRange, change.range) < 0) {
                        // Assume single line tokens
                        const length = deletedRangeOfToken.endColumn - deletedRangeOfToken.startColumn;
                        const rangeToDelete = new Range(token.editorRange.startLineNumber, token.editorRange.startColumn, token.editorRange.endLineNumber, token.editorRange.endColumn - length);
                        this.widget.inputEditor.executeEdits(this.id, [{
                                range: rangeToDelete,
                                text: '',
                            }]);
                        this.widget.refreshParsedInput();
                    }
                });
            }
            previousInputValue = this.widget.inputEditor.getValue();
            previousSelectedAgent = this.widget.lastSelectedAgent;
        }));
    }
};
ChatTokenDeleter = __decorate([
    __param(1, IInstantiationService)
], ChatTokenDeleter);
ChatWidget.CONTRIBS.push(ChatTokenDeleter);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdElucHV0RWRpdG9yQ29udHJpYi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY29udHJpYi9jaGF0SW5wdXRFZGl0b3JDb250cmliLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDM0UsT0FBTyxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN0RyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDM0UsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUduRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDOUUsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDbkcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3JGLE9BQU8sRUFBcUMsaUJBQWlCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNsRyxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNwRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsOEJBQThCLEVBQUUsOEJBQThCLEVBQUUsMkJBQTJCLEVBQUUsMEJBQTBC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