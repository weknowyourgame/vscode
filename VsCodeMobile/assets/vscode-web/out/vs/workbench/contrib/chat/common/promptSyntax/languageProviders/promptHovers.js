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
import { MarkdownString } from '../../../../../../base/common/htmlContent.js';
import { localize } from '../../../../../../nls.js';
import { ILanguageModelChatMetadata, ILanguageModelsService } from '../../languageModels.js';
import { ILanguageModelToolsService, ToolSet } from '../../languageModelToolsService.js';
import { IChatModeService, isBuiltinChatMode } from '../../chatModes.js';
import { getPromptsTypeForLanguageId, PromptsType } from '../promptTypes.js';
import { IPromptsService } from '../service/promptsService.js';
import { PromptHeaderAttributes, Target } from '../promptFileParser.js';
import { isGithubTarget, knownGithubCopilotTools } from './promptValidator.js';
let PromptHoverProvider = class PromptHoverProvider {
    constructor(promptsService, languageModelToolsService, languageModelsService, chatModeService) {
        this.promptsService = promptsService;
        this.languageModelToolsService = languageModelToolsService;
        this.languageModelsService = languageModelsService;
        this.chatModeService = chatModeService;
        /**
         * Debug display name for this provider.
         */
        this._debugDisplayName = 'PromptHoverProvider';
    }
    createHover(contents, range) {
        return {
            contents: [new MarkdownString(contents)],
            range
        };
    }
    async provideHover(model, position, token, _context) {
        const promptType = getPromptsTypeForLanguageId(model.getLanguageId());
        if (!promptType) {
            // if the model is not a prompt, we don't provide any hovers
            return undefined;
        }
        const promptAST = this.promptsService.getParsedPromptFile(model);
        if (promptAST.header?.range.containsPosition(position)) {
            return this.provideHeaderHover(position, promptType, promptAST.header);
        }
        if (promptAST.body?.range.containsPosition(position)) {
            return this.provideBodyHover(position, promptAST.body);
        }
        return undefined;
    }
    async provideBodyHover(position, body) {
        for (const ref of body.variableReferences) {
            if (ref.range.containsPosition(position)) {
                const toolName = ref.name;
                return this.getToolHoverByName(toolName, ref.range);
            }
        }
        return undefined;
    }
    async provideHeaderHover(position, promptType, header) {
        if (promptType === PromptsType.instructions) {
            for (const attribute of header.attributes) {
                if (attribute.range.containsPosition(position)) {
                    switch (attribute.key) {
                        case PromptHeaderAttributes.name:
                            return this.createHover(localize('promptHeader.instructions.name', 'The name of the instruction file as shown in the UI. If not set, the name is derived from the file name.'), attribute.range);
                        case PromptHeaderAttributes.description:
                            return this.createHover(localize('promptHeader.instructions.description', 'The description of the instruction file. It can be used to provide additional context or information about the instructions and is passed to the language model as part of the prompt.'), attribute.range);
                        case PromptHeaderAttributes.applyTo:
                            return this.createHover(localize('promptHeader.instructions.applyToRange', 'One or more glob pattern (separated by comma) that describe for which files the instructions apply to. Based on these patterns, the file is automatically included in the prompt, when the context contains a file that matches one or more of these patterns. Use `**` when you want this file to always be added.\nExample: `**/*.ts`, `**/*.js`, `client/**`'), attribute.range);
                    }
                }
            }
        }
        else if (promptType === PromptsType.agent) {
            const isGitHubTarget = isGithubTarget(promptType, header.target);
            for (const attribute of header.attributes) {
                if (attribute.range.containsPosition(position)) {
                    switch (attribute.key) {
                        case PromptHeaderAttributes.name:
                            return this.createHover(localize('promptHeader.agent.name', 'The name of the agent as shown in the UI.'), attribute.range);
                        case PromptHeaderAttributes.description:
                            return this.createHover(localize('promptHeader.agent.description', 'The description of the custom agent, what it does and when to use it.'), attribute.range);
                        case PromptHeaderAttributes.argumentHint:
                            return this.createHover(localize('promptHeader.agent.argumentHint', 'The argument-hint describes what inputs the custom agent expects or supports.'), attribute.range);
                        case PromptHeaderAttributes.model:
                            return this.getModelHover(attribute, attribute.range, localize('promptHeader.agent.model', 'Specify the model that runs this custom agent.'), isGitHubTarget);
                        case PromptHeaderAttributes.tools:
                            return this.getToolHover(attribute, position, localize('promptHeader.agent.tools', 'The set of tools that the custom agent has access to.'), header.target);
                        case PromptHeaderAttributes.handOffs:
                            return this.getHandsOffHover(attribute, position, isGitHubTarget);
                        case PromptHeaderAttributes.target:
                            return this.createHover(localize('promptHeader.agent.target', 'The target to which the header attributes like tools apply to. Possible values are `github-copilot` and `vscode`.'), attribute.range);
                    }
                }
            }
        }
        else {
            for (const attribute of header.attributes) {
                if (attribute.range.containsPosition(position)) {
                    switch (attribute.key) {
                        case PromptHeaderAttributes.name:
                            return this.createHover(localize('promptHeader.prompt.name', 'The name of the prompt. This is also the name of the slash command that will run this prompt.'), attribute.range);
                        case PromptHeaderAttributes.description:
                            return this.createHover(localize('promptHeader.prompt.description', 'The description of the reusable prompt, what it does and when to use it.'), attribute.range);
                        case PromptHeaderAttributes.argumentHint:
                            return this.createHover(localize('promptHeader.prompt.argumentHint', 'The argument-hint describes what inputs the prompt expects or supports.'), attribute.range);
                        case PromptHeaderAttributes.model:
                            return this.getModelHover(attribute, attribute.range, localize('promptHeader.prompt.model', 'The model to use in this prompt.'), false);
                        case PromptHeaderAttributes.tools:
                            return this.getToolHover(attribute, position, localize('promptHeader.prompt.tools', 'The tools to use in this prompt.'), Target.VSCode);
                        case PromptHeaderAttributes.agent:
                        case PromptHeaderAttributes.mode:
                            return this.getAgentHover(attribute, position);
                    }
                }
            }
        }
        return undefined;
    }
    getToolHover(node, position, baseMessage, target) {
        if (node.value.type === 'array') {
            for (const toolName of node.value.items) {
                if (toolName.type === 'string' && toolName.range.containsPosition(position)) {
                    const toolNameValue = toolName.value;
                    if (target === Target.VSCode || target === undefined) {
                        const description = this.getToolHoverByName(toolNameValue, toolName.range);
                        if (description) {
                            return description;
                        }
                    }
                    if (target === Target.GitHubCopilot || target === undefined) {
                        const description = knownGithubCopilotTools[toolNameValue];
                        if (description) {
                            return this.createHover(description, toolName.range);
                        }
                    }
                }
            }
        }
        return this.createHover(baseMessage, node.range);
    }
    getToolHoverByName(toolName, range) {
        const tool = this.languageModelToolsService.getToolByQualifiedName(toolName);
        if (tool !== undefined) {
            if (tool instanceof ToolSet) {
                return this.getToolsetHover(tool, range);
            }
            else {
                return this.createHover(tool.userDescription ?? tool.modelDescription, range);
            }
        }
        return undefined;
    }
    getToolsetHover(toolSet, range) {
        const lines = [];
        lines.push(localize('toolSetName', 'ToolSet: {0}\n\n', toolSet.referenceName));
        if (toolSet.description) {
            lines.push(toolSet.description);
        }
        for (const tool of toolSet.getTools()) {
            lines.push(`- ${tool.toolReferenceName ?? tool.displayName}`);
        }
        return this.createHover(lines.join('\n'), range);
    }
    getModelHover(node, range, baseMessage, isGitHubTarget) {
        if (isGitHubTarget) {
            return this.createHover(baseMessage + '\n\n' + localize('promptHeader.agent.model.githubCopilot', 'Note: This attribute is not used when target is github-copilot.'), range);
        }
        if (node.value.type === 'string') {
            for (const id of this.languageModelsService.getLanguageModelIds()) {
                const meta = this.languageModelsService.lookupLanguageModel(id);
                if (meta && ILanguageModelChatMetadata.matchesQualifiedName(node.value.value, meta)) {
                    const lines = [];
                    lines.push(baseMessage + '\n');
                    lines.push(localize('modelName', '- Name: {0}', meta.name));
                    lines.push(localize('modelFamily', '- Family: {0}', meta.family));
                    lines.push(localize('modelVendor', '- Vendor: {0}', meta.vendor));
                    if (meta.tooltip) {
                        lines.push('', '', meta.tooltip);
                    }
                    return this.createHover(lines.join('\n'), range);
                }
            }
        }
        return this.createHover(baseMessage, range);
    }
    getAgentHover(agentAttribute, position) {
        const lines = [];
        const value = agentAttribute.value;
        if (value.type === 'string' && value.range.containsPosition(position)) {
            const agent = this.chatModeService.findModeByName(value.value);
            if (agent) {
                const description = agent.description.get() || (isBuiltinChatMode(agent) ? localize('promptHeader.prompt.agent.builtInDesc', 'Built-in agent') : localize('promptHeader.prompt.agent.customDesc', 'Custom agent'));
                lines.push(`\`${agent.name.get()}\`: ${description}`);
            }
        }
        else {
            const agents = this.chatModeService.getModes();
            lines.push(localize('promptHeader.prompt.agent.description', 'The agent to use when running this prompt.'));
            lines.push('');
            // Built-in agents
            lines.push(localize('promptHeader.prompt.agent.builtin', '**Built-in agents:**'));
            for (const agent of agents.builtin) {
                lines.push(`- \`${agent.name.get()}\`: ${agent.description.get() || agent.label.get()}`);
            }
            // Custom agents
            if (agents.custom.length > 0) {
                lines.push('');
                lines.push(localize('promptHeader.prompt.agent.custom', '**Custom agents:**'));
                for (const agent of agents.custom) {
                    const description = agent.description.get();
                    lines.push(`- \`${agent.name.get()}\`: ${description || localize('promptHeader.prompt.agent.customDesc', 'Custom agent')}`);
                }
            }
        }
        return this.createHover(lines.join('\n'), agentAttribute.range);
    }
    getHandsOffHover(attribute, position, isGitHubTarget) {
        const handoffsBaseMessage = localize('promptHeader.agent.handoffs', 'Possible handoff actions when the agent has completed its task.');
        if (isGitHubTarget) {
            return this.createHover(handoffsBaseMessage + '\n\n' + localize('promptHeader.agent.handoffs.githubCopilot', 'Note: This attribute is not used when target is github-copilot.'), attribute.range);
        }
        return this.createHover(handoffsBaseMessage, attribute.range);
    }
};
PromptHoverProvider = __decorate([
    __param(0, IPromptsService),
    __param(1, ILanguageModelToolsService),
    __param(2, ILanguageModelsService),
    __param(3, IChatModeService)
], PromptHoverProvider);
export { PromptHoverProvider };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0SG92ZXJzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Byb21wdFN5bnRheC9sYW5ndWFnZVByb3ZpZGVycy9wcm9tcHRIb3ZlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBSzlFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUM3RixPQUFPLEVBQUUsMEJBQTBCLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDekYsT0FBTyxFQUFFLGdCQUFnQixFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekUsT0FBTyxFQUFFLDJCQUEyQixFQUFFLFdBQVcsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQzdFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMvRCxPQUFPLEVBQThDLHNCQUFzQixFQUFFLE1BQU0sRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3BILE9BQU8sRUFBRSxjQUFjLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUV4RSxJQUFNLG1CQUFtQixHQUF6QixNQUFNLG1CQUFtQjtJQU0vQixZQUNrQixjQUFnRCxFQUNyQyx5QkFBc0UsRUFDMUUscUJBQThELEVBQ3BFLGVBQWtEO1FBSGxDLG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUNwQiw4QkFBeUIsR0FBekIseUJBQXlCLENBQTRCO1FBQ3pELDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBd0I7UUFDbkQsb0JBQWUsR0FBZixlQUFlLENBQWtCO1FBVHJFOztXQUVHO1FBQ2Esc0JBQWlCLEdBQVcscUJBQXFCLENBQUM7SUFRbEUsQ0FBQztJQUVPLFdBQVcsQ0FBQyxRQUFnQixFQUFFLEtBQVk7UUFDakQsT0FBTztZQUNOLFFBQVEsRUFBRSxDQUFDLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3hDLEtBQUs7U0FDTCxDQUFDO0lBQ0gsQ0FBQztJQUVNLEtBQUssQ0FBQyxZQUFZLENBQUMsS0FBaUIsRUFBRSxRQUFrQixFQUFFLEtBQXdCLEVBQUUsUUFBdUI7UUFFakgsTUFBTSxVQUFVLEdBQUcsMkJBQTJCLENBQUMsS0FBSyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUM7UUFDdEUsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2pCLDREQUE0RDtZQUM1RCxPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNqRSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDeEQsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxFQUFFLFVBQVUsRUFBRSxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDeEUsQ0FBQztRQUNELElBQUksU0FBUyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUN0RCxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hELENBQUM7UUFDRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRU8sS0FBSyxDQUFDLGdCQUFnQixDQUFDLFFBQWtCLEVBQUUsSUFBZ0I7UUFDbEUsS0FBSyxNQUFNLEdBQUcsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUMzQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztnQkFDMUMsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQztnQkFDMUIsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNyRCxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFTyxLQUFLLENBQUMsa0JBQWtCLENBQUMsUUFBa0IsRUFBRSxVQUF1QixFQUFFLE1BQW9CO1FBQ2pHLElBQUksVUFBVSxLQUFLLFdBQVcsQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUM3QyxLQUFLLE1BQU0sU0FBUyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDM0MsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7b0JBQ2hELFFBQVEsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDO3dCQUN2QixLQUFLLHNCQUFzQixDQUFDLElBQUk7NEJBQy9CLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsZ0NBQWdDLEVBQUUsMEdBQTBHLENBQUMsRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7d0JBQ2xNLEtBQUssc0JBQXNCLENBQUMsV0FBVzs0QkFDdEMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyx1Q0FBdUMsRUFBRSx3TEFBd0wsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFDdlIsS0FBSyxzQkFBc0IsQ0FBQyxPQUFPOzRCQUNsQyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLHdDQUF3QyxFQUFFLGlXQUFpVyxDQUFDLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUNsYyxDQUFDO2dCQUNGLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQzthQUFNLElBQUksVUFBVSxLQUFLLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUM3QyxNQUFNLGNBQWMsR0FBRyxjQUFjLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNqRSxLQUFLLE1BQU0sU0FBUyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDM0MsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7b0JBQ2hELFFBQVEsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDO3dCQUN2QixLQUFLLHNCQUFzQixDQUFDLElBQUk7NEJBQy9CLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMseUJBQXlCLEVBQUUsMkNBQTJDLENBQUMsRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7d0JBQzVILEtBQUssc0JBQXNCLENBQUMsV0FBVzs0QkFDdEMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxnQ0FBZ0MsRUFBRSx1RUFBdUUsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFDL0osS0FBSyxzQkFBc0IsQ0FBQyxZQUFZOzRCQUN2QyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLGlDQUFpQyxFQUFFLCtFQUErRSxDQUFDLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUN4SyxLQUFLLHNCQUFzQixDQUFDLEtBQUs7NEJBQ2hDLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsMEJBQTBCLEVBQUUsZ0RBQWdELENBQUMsRUFBRSxjQUFjLENBQUMsQ0FBQzt3QkFDL0osS0FBSyxzQkFBc0IsQ0FBQyxLQUFLOzRCQUNoQyxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsMEJBQTBCLEVBQUUsdURBQXVELENBQUMsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7d0JBQzdKLEtBQUssc0JBQXNCLENBQUMsUUFBUTs0QkFDbkMsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRSxjQUFjLENBQUMsQ0FBQzt3QkFDbkUsS0FBSyxzQkFBc0IsQ0FBQyxNQUFNOzRCQUNqQyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLDJCQUEyQixFQUFFLG1IQUFtSCxDQUFDLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUN2TSxDQUFDO2dCQUNGLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQzthQUFNLENBQUM7WUFDUCxLQUFLLE1BQU0sU0FBUyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDM0MsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7b0JBQ2hELFFBQVEsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDO3dCQUN2QixLQUFLLHNCQUFzQixDQUFDLElBQUk7NEJBQy9CLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsMEJBQTBCLEVBQUUsK0ZBQStGLENBQUMsRUFBRSxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7d0JBQ2pMLEtBQUssc0JBQXNCLENBQUMsV0FBVzs0QkFDdEMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxpQ0FBaUMsRUFBRSwwRUFBMEUsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFDbkssS0FBSyxzQkFBc0IsQ0FBQyxZQUFZOzRCQUN2QyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLGtDQUFrQyxFQUFFLHlFQUF5RSxDQUFDLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUNuSyxLQUFLLHNCQUFzQixDQUFDLEtBQUs7NEJBQ2hDLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsMkJBQTJCLEVBQUUsa0NBQWtDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQzt3QkFDekksS0FBSyxzQkFBc0IsQ0FBQyxLQUFLOzRCQUNoQyxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsMkJBQTJCLEVBQUUsa0NBQWtDLENBQUMsRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7d0JBQ3pJLEtBQUssc0JBQXNCLENBQUMsS0FBSyxDQUFDO3dCQUNsQyxLQUFLLHNCQUFzQixDQUFDLElBQUk7NEJBQy9CLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7b0JBQ2pELENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVPLFlBQVksQ0FBQyxJQUFzQixFQUFFLFFBQWtCLEVBQUUsV0FBbUIsRUFBRSxNQUEwQjtRQUMvRyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBRSxDQUFDO1lBQ2pDLEtBQUssTUFBTSxRQUFRLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDekMsSUFBSSxRQUFRLENBQUMsSUFBSSxLQUFLLFFBQVEsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7b0JBQzdFLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUM7b0JBQ3JDLElBQUksTUFBTSxLQUFLLE1BQU0sQ0FBQyxNQUFNLElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRSxDQUFDO3dCQUN0RCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsYUFBYSxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFDM0UsSUFBSSxXQUFXLEVBQUUsQ0FBQzs0QkFDakIsT0FBTyxXQUFXLENBQUM7d0JBQ3BCLENBQUM7b0JBQ0YsQ0FBQztvQkFDRCxJQUFJLE1BQU0sS0FBSyxNQUFNLENBQUMsYUFBYSxJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUUsQ0FBQzt3QkFDN0QsTUFBTSxXQUFXLEdBQUcsdUJBQXVCLENBQUMsYUFBYSxDQUFDLENBQUM7d0JBQzNELElBQUksV0FBVyxFQUFFLENBQUM7NEJBQ2pCLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO3dCQUN0RCxDQUFDO29CQUNGLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVPLGtCQUFrQixDQUFDLFFBQWdCLEVBQUUsS0FBWTtRQUN4RCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMseUJBQXlCLENBQUMsc0JBQXNCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDN0UsSUFBSSxJQUFJLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDeEIsSUFBSSxJQUFJLFlBQVksT0FBTyxFQUFFLENBQUM7Z0JBQzdCLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDMUMsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsZUFBZSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUMvRSxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFTyxlQUFlLENBQUMsT0FBZ0IsRUFBRSxLQUFZO1FBQ3JELE1BQU0sS0FBSyxHQUFhLEVBQUUsQ0FBQztRQUMzQixLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsa0JBQWtCLEVBQUUsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7UUFDL0UsSUFBSSxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDekIsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDakMsQ0FBQztRQUNELEtBQUssTUFBTSxJQUFJLElBQUksT0FBTyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUM7WUFDdkMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxpQkFBaUIsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUMvRCxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVPLGFBQWEsQ0FBQyxJQUFzQixFQUFFLEtBQVksRUFBRSxXQUFtQixFQUFFLGNBQXVCO1FBQ3ZHLElBQUksY0FBYyxFQUFFLENBQUM7WUFDcEIsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsR0FBRyxNQUFNLEdBQUcsUUFBUSxDQUFDLHdDQUF3QyxFQUFFLGlFQUFpRSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDOUssQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDbEMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMscUJBQXFCLENBQUMsbUJBQW1CLEVBQUUsRUFBRSxDQUFDO2dCQUNuRSxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ2hFLElBQUksSUFBSSxJQUFJLDBCQUEwQixDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQ3JGLE1BQU0sS0FBSyxHQUFhLEVBQUUsQ0FBQztvQkFDM0IsS0FBSyxDQUFDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLENBQUM7b0JBQy9CLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxhQUFhLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQzVELEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxlQUFlLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7b0JBQ2xFLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxlQUFlLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7b0JBQ2xFLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUNsQixLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUNsQyxDQUFDO29CQUNELE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUNsRCxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFTyxhQUFhLENBQUMsY0FBZ0MsRUFBRSxRQUFrQjtRQUN6RSxNQUFNLEtBQUssR0FBYSxFQUFFLENBQUM7UUFDM0IsTUFBTSxLQUFLLEdBQUcsY0FBYyxDQUFDLEtBQUssQ0FBQztRQUNuQyxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUN2RSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDL0QsSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDWCxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyx1Q0FBdUMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsc0NBQXNDLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQztnQkFDbk4sS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLE9BQU8sV0FBVyxFQUFFLENBQUMsQ0FBQztZQUN2RCxDQUFDO1FBQ0YsQ0FBQzthQUFNLENBQUM7WUFDUCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQy9DLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLHVDQUF1QyxFQUFFLDRDQUE0QyxDQUFDLENBQUMsQ0FBQztZQUM1RyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBRWYsa0JBQWtCO1lBQ2xCLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLG1DQUFtQyxFQUFFLHNCQUFzQixDQUFDLENBQUMsQ0FBQztZQUNsRixLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDcEMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLE9BQU8sS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMxRixDQUFDO1lBRUQsZ0JBQWdCO1lBQ2hCLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQzlCLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ2YsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsa0NBQWtDLEVBQUUsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO2dCQUMvRSxLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztvQkFDbkMsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztvQkFDNUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLE9BQU8sV0FBVyxJQUFJLFFBQVEsQ0FBQyxzQ0FBc0MsRUFBRSxjQUFjLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQzdILENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRU8sZ0JBQWdCLENBQUMsU0FBMkIsRUFBRSxRQUFrQixFQUFFLGNBQXVCO1FBQ2hHLE1BQU0sbUJBQW1CLEdBQUcsUUFBUSxDQUFDLDZCQUE2QixFQUFFLGlFQUFpRSxDQUFDLENBQUM7UUFDdkksSUFBSSxjQUFjLEVBQUUsQ0FBQztZQUNwQixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsbUJBQW1CLEdBQUcsTUFBTSxHQUFHLFFBQVEsQ0FBQywyQ0FBMkMsRUFBRSxpRUFBaUUsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNuTSxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLG1CQUFtQixFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUUvRCxDQUFDO0NBQ0QsQ0FBQTtBQTVOWSxtQkFBbUI7SUFPN0IsV0FBQSxlQUFlLENBQUE7SUFDZixXQUFBLDBCQUEwQixDQUFBO0lBQzFCLFdBQUEsc0JBQXNCLENBQUE7SUFDdEIsV0FBQSxnQkFBZ0IsQ0FBQTtHQVZOLG1CQUFtQixDQTROL0IifQ==