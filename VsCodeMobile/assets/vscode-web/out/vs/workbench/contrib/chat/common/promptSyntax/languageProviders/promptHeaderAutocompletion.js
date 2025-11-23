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
import { Position } from '../../../../../../editor/common/core/position.js';
import { Range } from '../../../../../../editor/common/core/range.js';
import { ILanguageModelChatMetadata, ILanguageModelsService } from '../../languageModels.js';
import { ILanguageModelToolsService } from '../../languageModelToolsService.js';
import { IChatModeService } from '../../chatModes.js';
import { getPromptsTypeForLanguageId, PromptsType } from '../promptTypes.js';
import { IPromptsService } from '../service/promptsService.js';
import { Iterable } from '../../../../../../base/common/iterator.js';
import { PromptHeaderAttributes } from '../promptFileParser.js';
import { getValidAttributeNames, isGithubTarget, knownGithubCopilotTools } from './promptValidator.js';
import { localize } from '../../../../../../nls.js';
let PromptHeaderAutocompletion = class PromptHeaderAutocompletion {
    constructor(promptsService, languageModelsService, languageModelToolsService, chatModeService) {
        this.promptsService = promptsService;
        this.languageModelsService = languageModelsService;
        this.languageModelToolsService = languageModelToolsService;
        this.chatModeService = chatModeService;
        /**
         * Debug display name for this provider.
         */
        this._debugDisplayName = 'PromptHeaderAutocompletion';
        /**
         * List of trigger characters handled by this provider.
         */
        this.triggerCharacters = [':'];
    }
    /**
     * The main function of this provider that calculates
     * completion items based on the provided arguments.
     */
    async provideCompletionItems(model, position, context, token) {
        const promptType = getPromptsTypeForLanguageId(model.getLanguageId());
        if (!promptType) {
            // if the model is not a prompt, we don't provide any completions
            return undefined;
        }
        const parsedAST = this.promptsService.getParsedPromptFile(model);
        const header = parsedAST.header;
        if (!header) {
            return undefined;
        }
        const headerRange = parsedAST.header.range;
        if (position.lineNumber < headerRange.startLineNumber || position.lineNumber >= headerRange.endLineNumber) {
            // if the position is not inside the header, we don't provide any completions
            return undefined;
        }
        const lineText = model.getLineContent(position.lineNumber);
        const colonIndex = lineText.indexOf(':');
        const colonPosition = colonIndex !== -1 ? new Position(position.lineNumber, colonIndex + 1) : undefined;
        if (!colonPosition || position.isBeforeOrEqual(colonPosition)) {
            return this.provideAttributeNameCompletions(model, position, header, colonPosition, promptType);
        }
        else if (colonPosition && colonPosition.isBefore(position)) {
            return this.provideValueCompletions(model, position, header, colonPosition, promptType);
        }
        return undefined;
    }
    async provideAttributeNameCompletions(model, position, header, colonPosition, promptType) {
        const suggestions = [];
        const isGitHubTarget = isGithubTarget(promptType, header.target);
        const attributesToPropose = new Set(getValidAttributeNames(promptType, false, isGitHubTarget));
        for (const attr of header.attributes) {
            attributesToPropose.delete(attr.key);
        }
        const getInsertText = (key) => {
            if (colonPosition) {
                return key;
            }
            const valueSuggestions = this.getValueSuggestions(promptType, key);
            if (valueSuggestions.length > 0) {
                return `${key}: \${0:${valueSuggestions[0]}}`;
            }
            else {
                return `${key}: \$0`;
            }
        };
        for (const attribute of attributesToPropose) {
            const item = {
                label: attribute,
                kind: 9 /* CompletionItemKind.Property */,
                insertText: getInsertText(attribute),
                insertTextRules: 4 /* CompletionItemInsertTextRule.InsertAsSnippet */,
                range: new Range(position.lineNumber, 1, position.lineNumber, !colonPosition ? model.getLineMaxColumn(position.lineNumber) : colonPosition.column),
            };
            suggestions.push(item);
        }
        return { suggestions };
    }
    async provideValueCompletions(model, position, header, colonPosition, promptType) {
        const suggestions = [];
        const lineContent = model.getLineContent(position.lineNumber);
        const attribute = lineContent.substring(0, colonPosition.column - 1).trim();
        const isGitHubTarget = isGithubTarget(promptType, header.target);
        if (!getValidAttributeNames(promptType, true, isGitHubTarget).includes(attribute)) {
            return undefined;
        }
        if (promptType === PromptsType.prompt || promptType === PromptsType.agent) {
            // if the position is inside the tools metadata, we provide tool name completions
            const result = this.provideToolCompletions(model, position, header, isGitHubTarget);
            if (result) {
                return result;
            }
        }
        const bracketIndex = lineContent.indexOf('[');
        if (bracketIndex !== -1 && bracketIndex <= position.column - 1) {
            // if the value is already inside a bracket, we don't provide value completions
            return undefined;
        }
        const whilespaceAfterColon = (lineContent.substring(colonPosition.column).match(/^\s*/)?.[0].length) ?? 0;
        const values = this.getValueSuggestions(promptType, attribute);
        for (const value of values) {
            const item = {
                label: value,
                kind: 13 /* CompletionItemKind.Value */,
                insertText: whilespaceAfterColon === 0 ? ` ${value}` : value,
                range: new Range(position.lineNumber, colonPosition.column + whilespaceAfterColon + 1, position.lineNumber, model.getLineMaxColumn(position.lineNumber)),
            };
            suggestions.push(item);
        }
        if (attribute === PromptHeaderAttributes.handOffs && (promptType === PromptsType.agent)) {
            const value = [
                '',
                '  - label: Start Implementation',
                '    agent: agent',
                '    prompt: Implement the plan',
                '    send: true'
            ].join('\n');
            const item = {
                label: localize('promptHeaderAutocompletion.handoffsExample', "Handoff Example"),
                kind: 13 /* CompletionItemKind.Value */,
                insertText: whilespaceAfterColon === 0 ? ` ${value}` : value,
                range: new Range(position.lineNumber, colonPosition.column + whilespaceAfterColon + 1, position.lineNumber, model.getLineMaxColumn(position.lineNumber)),
            };
            suggestions.push(item);
        }
        return { suggestions };
    }
    getValueSuggestions(promptType, attribute) {
        switch (attribute) {
            case PromptHeaderAttributes.applyTo:
                if (promptType === PromptsType.instructions) {
                    return [`'**'`, `'**/*.ts, **/*.js'`, `'**/*.php'`, `'**/*.py'`];
                }
                break;
            case PromptHeaderAttributes.agent:
            case PromptHeaderAttributes.mode:
                if (promptType === PromptsType.prompt) {
                    // Get all available agents (builtin + custom)
                    const agents = this.chatModeService.getModes();
                    const suggestions = [];
                    for (const agent of Iterable.concat(agents.builtin, agents.custom)) {
                        suggestions.push(agent.name.get());
                    }
                    return suggestions;
                }
            case PromptHeaderAttributes.target:
                if (promptType === PromptsType.agent) {
                    return ['vscode', 'github-copilot'];
                }
                break;
            case PromptHeaderAttributes.tools:
                if (promptType === PromptsType.prompt || promptType === PromptsType.agent) {
                    return ['[]', `['search', 'edit', 'fetch']`];
                }
                break;
            case PromptHeaderAttributes.model:
                if (promptType === PromptsType.prompt || promptType === PromptsType.agent) {
                    return this.getModelNames(promptType === PromptsType.agent);
                }
        }
        return [];
    }
    getModelNames(agentModeOnly) {
        const result = [];
        for (const model of this.languageModelsService.getLanguageModelIds()) {
            const metadata = this.languageModelsService.lookupLanguageModel(model);
            if (metadata && metadata.isUserSelectable !== false) {
                if (!agentModeOnly || ILanguageModelChatMetadata.suitableForAgentMode(metadata)) {
                    result.push(ILanguageModelChatMetadata.asQualifiedName(metadata));
                }
            }
        }
        return result;
    }
    provideToolCompletions(model, position, header, isGitHubTarget) {
        const toolsAttr = header.getAttribute(PromptHeaderAttributes.tools);
        if (!toolsAttr || toolsAttr.value.type !== 'array' || !toolsAttr.range.containsPosition(position)) {
            return undefined;
        }
        const getSuggestions = (toolRange) => {
            const suggestions = [];
            const toolNames = isGitHubTarget ? Object.keys(knownGithubCopilotTools) : this.languageModelToolsService.getQualifiedToolNames();
            for (const toolName of toolNames) {
                let insertText;
                if (!toolRange.isEmpty()) {
                    const firstChar = model.getValueInRange(toolRange).charCodeAt(0);
                    insertText = firstChar === 39 /* CharCode.SingleQuote */ ? `'${toolName}'` : firstChar === 34 /* CharCode.DoubleQuote */ ? `"${toolName}"` : toolName;
                }
                else {
                    insertText = `'${toolName}'`;
                }
                suggestions.push({
                    label: toolName,
                    kind: 13 /* CompletionItemKind.Value */,
                    filterText: insertText,
                    insertText: insertText,
                    range: toolRange,
                });
            }
            return { suggestions };
        };
        for (const toolNameNode of toolsAttr.value.items) {
            if (toolNameNode.range.containsPosition(position)) {
                // if the position is inside a tool range, we provide tool name completions
                return getSuggestions(toolNameNode.range);
            }
        }
        const prefix = model.getValueInRange(new Range(position.lineNumber, 1, position.lineNumber, position.column));
        if (prefix.match(/[,[]\s*$/)) {
            // if the position is after a comma or bracket
            return getSuggestions(new Range(position.lineNumber, position.column, position.lineNumber, position.column));
        }
        return undefined;
    }
};
PromptHeaderAutocompletion = __decorate([
    __param(0, IPromptsService),
    __param(1, ILanguageModelsService),
    __param(2, ILanguageModelToolsService),
    __param(3, IChatModeService)
], PromptHeaderAutocompletion);
export { PromptHeaderAutocompletion };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0SGVhZGVyQXV0b2NvbXBsZXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vcHJvbXB0U3ludGF4L2xhbmd1YWdlUHJvdmlkZXJzL3Byb21wdEhlYWRlckF1dG9jb21wbGV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBSWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFHdEUsT0FBTyxFQUFFLDBCQUEwQixFQUFFLHNCQUFzQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDN0YsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDaEYsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDdEQsT0FBTyxFQUFFLDJCQUEyQixFQUFFLFdBQVcsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQzdFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMvRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDckUsT0FBTyxFQUFnQixzQkFBc0IsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQzlFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxjQUFjLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUN2RyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFFN0MsSUFBTSwwQkFBMEIsR0FBaEMsTUFBTSwwQkFBMEI7SUFXdEMsWUFDa0IsY0FBZ0QsRUFDekMscUJBQThELEVBQzFELHlCQUFzRSxFQUNoRixlQUFrRDtRQUhsQyxtQkFBYyxHQUFkLGNBQWMsQ0FB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