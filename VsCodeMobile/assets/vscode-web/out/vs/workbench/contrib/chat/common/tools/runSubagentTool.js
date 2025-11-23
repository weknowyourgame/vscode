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
import { Codicon } from '../../../../../base/common/codicons.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IChatAgentService } from '../chatAgents.js';
import { IChatModeService } from '../chatModes.js';
import { IChatService } from '../chatService.js';
import { ChatAgentLocation, ChatConfiguration, ChatModeKind } from '../constants.js';
import { ILanguageModelChatMetadata, ILanguageModelsService } from '../languageModels.js';
import { ILanguageModelToolsService, ToolDataSource, ToolSet, VSCodeToolReference } from '../languageModelToolsService.js';
import { ManageTodoListToolToolId } from './manageTodoListTool.js';
import { createToolSimpleTextResult } from './toolHelpers.js';
export const RunSubagentToolId = 'runSubagent';
const BaseModelDescription = `Launch a new agent to handle complex, multi-step tasks autonomously. This tool is good at researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries, use this agent to perform the search for you.

- Agents do not run async or in the background, you will wait for the agent\'s result.
- When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.
- Each agent invocation is stateless. You will not be able to send additional messages to the agent, nor will the agent be able to communicate with you outside of its final report. Therefore, your prompt should contain a highly detailed task description for the agent to perform autonomously and you should specify exactly what information the agent should return back to you in its final and only message to you.
- The agent's outputs should generally be trusted
- Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the user\'s intent`;
let RunSubagentTool = class RunSubagentTool extends Disposable {
    constructor(chatAgentService, chatService, chatModeService, languageModelToolsService, languageModelsService, logService, toolsService, configurationService) {
        super();
        this.chatAgentService = chatAgentService;
        this.chatService = chatService;
        this.chatModeService = chatModeService;
        this.languageModelToolsService = languageModelToolsService;
        this.languageModelsService = languageModelsService;
        this.logService = logService;
        this.toolsService = toolsService;
        this.configurationService = configurationService;
    }
    getToolData() {
        const runSubagentToolData = {
            id: RunSubagentToolId,
            toolReferenceName: VSCodeToolReference.runSubagent,
            legacyToolReferenceFullNames: ['runSubagent'],
            icon: ThemeIcon.fromId(Codicon.organization.id),
            displayName: localize('tool.runSubagent.displayName', 'Run Subagent'),
            userDescription: localize('tool.runSubagent.userDescription', 'Run a task within an isolated subagent context to enable efficient organization of tasks and context window management.'),
            modelDescription: BaseModelDescription,
            source: ToolDataSource.Internal,
            inputSchema: {
                type: 'object',
                properties: {
                    prompt: {
                        type: 'string',
                        description: 'A detailed description of the task for the agent to perform'
                    },
                    description: {
                        type: 'string',
                        description: 'A short (3-5 word) description of the task'
                    }
                },
                required: ['prompt', 'description']
            }
        };
        if (this.configurationService.getValue(ChatConfiguration.SubagentToolCustomAgents)) {
            runSubagentToolData.inputSchema.properties['subagentType'] = {
                type: 'string',
                description: 'Optional ID of a specific agent to invoke. If not provided, uses the current agent.'
            };
            runSubagentToolData.modelDescription += `\n- If the user asks for a certain agent by name, you MUST provide that EXACT subagentType (case-sensitive) to invoke that specific agent.`;
        }
        return runSubagentToolData;
    }
    async invoke(invocation, _countTokens, _progress, token) {
        const args = invocation.parameters;
        this.logService.debug(`RunSubagentTool: Invoking with prompt: ${args.prompt.substring(0, 100)}...`);
        if (!invocation.context) {
            throw new Error('toolInvocationToken is required for this tool');
        }
        // Get the chat model and request for writing progress
        const model = this.chatService.getSession(invocation.context.sessionResource);
        if (!model) {
            throw new Error('Chat model not found for session');
        }
        const request = model.getRequests().at(-1);
        try {
            // Get the default agent
            const defaultAgent = this.chatAgentService.getDefaultAgent(ChatAgentLocation.Chat, ChatModeKind.Agent);
            if (!defaultAgent) {
                return createToolSimpleTextResult('Error: No default agent available');
            }
            // Resolve mode-specific configuration if subagentId is provided
            let modeModelId = invocation.modelId;
            let modeTools = invocation.userSelectedTools;
            let modeInstructions;
            if (args.subagentType) {
                const mode = this.chatModeService.findModeByName(args.subagentType);
                if (mode) {
                    // Use mode-specific model if available
                    const modeModelQualifiedName = mode.model?.get();
                    if (modeModelQualifiedName) {
                        // Find the actual model identifier from the qualified name
                        const modelIds = this.languageModelsService.getLanguageModelIds();
                        for (const modelId of modelIds) {
                            const metadata = this.languageModelsService.lookupLanguageModel(modelId);
                            if (metadata && ILanguageModelChatMetadata.matchesQualifiedName(modeModelQualifiedName, metadata)) {
                                modeModelId = modelId;
                                break;
                            }
                        }
                    }
                    // Use mode-specific tools if available
                    const modeCustomTools = mode.customTools?.get();
                    if (modeCustomTools) {
                        // Convert the mode's custom tools (array of qualified names) to UserSelectedTools format
                        const enablementMap = this.languageModelToolsService.toToolAndToolSetEnablementMap(modeCustomTools, mode.target?.get());
                        // Convert enablement map to UserSelectedTools (Record<string, boolean>)
                        modeTools = {};
                        for (const [tool, enabled] of enablementMap) {
                            if (!(tool instanceof ToolSet)) {
                                modeTools[tool.id] = enabled;
                            }
                        }
                    }
                    const instructions = mode.modeInstructions?.get();
                    modeInstructions = instructions && {
                        name: mode.name.get(),
                        content: instructions.content,
                        toolReferences: this.toolsService.toToolReferences(instructions.toolReferences),
                        metadata: instructions.metadata,
                    };
                }
                else {
                    this.logService.warn(`RunSubagentTool: Agent '${args.subagentType}' not found, using current configuration`);
                }
            }
            // Track whether we should collect markdown (after the last prepare tool invocation)
            const markdownParts = [];
            let inEdit = false;
            const progressCallback = (parts) => {
                for (const part of parts) {
                    // Write certain parts immediately to the model
                    if (part.kind === 'prepareToolInvocation' || part.kind === 'textEdit' || part.kind === 'notebookEdit' || part.kind === 'codeblockUri') {
                        if (part.kind === 'codeblockUri' && !inEdit) {
                            inEdit = true;
                            model.acceptResponseProgress(request, { kind: 'markdownContent', content: new MarkdownString('```\n'), fromSubagent: true });
                        }
                        model.acceptResponseProgress(request, part);
                        // When we see a prepare tool invocation, reset markdown collection
                        if (part.kind === 'prepareToolInvocation') {
                            markdownParts.length = 0; // Clear previously collected markdown
                        }
                    }
                    else if (part.kind === 'markdownContent') {
                        if (inEdit) {
                            model.acceptResponseProgress(request, { kind: 'markdownContent', content: new MarkdownString('\n```\n\n'), fromSubagent: true });
                            inEdit = false;
                        }
                        // Collect markdown content for the tool result
                        markdownParts.push(part.content.value);
                    }
                }
            };
            if (modeTools) {
                modeTools[RunSubagentToolId] = false;
                modeTools[ManageTodoListToolToolId] = false;
            }
            // Build the agent request
            const agentRequest = {
                sessionId: invocation.context.sessionId,
                sessionResource: invocation.context.sessionResource,
                requestId: invocation.callId ?? `subagent-${Date.now()}`,
                agentId: defaultAgent.id,
                message: args.prompt,
                variables: { variables: [] },
                location: ChatAgentLocation.Chat,
                isSubagent: true,
                userSelectedModelId: modeModelId,
                userSelectedTools: modeTools,
                modeInstructions,
            };
            // Invoke the agent
            const result = await this.chatAgentService.invokeAgent(defaultAgent.id, agentRequest, progressCallback, [], token);
            // Check for errors
            if (result.errorDetails) {
                return createToolSimpleTextResult(`Agent error: ${result.errorDetails.message}`);
            }
            return createToolSimpleTextResult(markdownParts.join('') || 'Agent completed with no output');
        }
        catch (error) {
            const errorMessage = `Error invoking subagent: ${error instanceof Error ? error.message : 'Unknown error'}`;
            this.logService.error(errorMessage, error);
            return createToolSimpleTextResult(errorMessage);
        }
    }
    async prepareToolInvocation(context, _token) {
        const args = context.parameters;
        return {
            invocationMessage: args.description,
        };
    }
};
RunSubagentTool = __decorate([
    __param(0, IChatAgentService),
    __param(1, IChatService),
    __param(2, IChatModeService),
    __param(3, ILanguageModelToolsService),
    __param(4, ILanguageModelsService),
    __param(5, ILogService),
    __param(6, ILanguageModelToolsService),
    __param(7, IConfigurationService)
], RunSubagentTool);
export { RunSubagentTool };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVuU3ViYWdlbnRUb29sLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Rvb2xzL3J1blN1YmFnZW50VG9vbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUN4RSxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFFeEUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDbkQsT0FBTyxFQUFpQixZQUFZLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUNoRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDckYsT0FBTyxFQUFFLDBCQUEwQixFQUFFLHNCQUFzQixFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDMUYsT0FBTyxFQUVOLDBCQUEwQixFQU8xQixjQUFjLEVBRWQsT0FBTyxFQUNQLG1CQUFtQixFQUNuQixNQUFNLGlDQUFpQyxDQUFDO0FBQ3pDLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ25FLE9B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