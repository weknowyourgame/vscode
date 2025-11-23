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
import { Position } from '../../../../editor/common/core/position.js';
import { Range } from '../../../../editor/common/core/range.js';
import { OffsetRange } from '../../../../editor/common/core/ranges/offsetRange.js';
import { IChatAgentService } from './chatAgents.js';
import { ChatRequestAgentPart, ChatRequestAgentSubcommandPart, ChatRequestDynamicVariablePart, ChatRequestSlashCommandPart, ChatRequestSlashPromptPart, ChatRequestTextPart, ChatRequestToolPart, ChatRequestToolSetPart, chatAgentLeader, chatSubcommandLeader, chatVariableLeader } from './chatParserTypes.js';
import { IChatSlashCommandService } from './chatSlashCommands.js';
import { IChatVariablesService } from './chatVariables.js';
import { ChatAgentLocation, ChatModeKind } from './constants.js';
import { ToolSet } from './languageModelToolsService.js';
import { IPromptsService } from './promptSyntax/service/promptsService.js';
const agentReg = /^@([\w_\-\.]+)(?=(\s|$|\b))/i; // An @-agent
const variableReg = /^#([\w_\-]+)(:\d+)?(?=(\s|$|\b))/i; // A #-variable with an optional numeric : arg (@response:2)
const slashReg = /^\/([\p{L}\d_\-\.:]+)(?=(\s|$|\b))/iu; // A / command
let ChatRequestParser = class ChatRequestParser {
    constructor(agentService, variableService, slashCommandService, promptsService) {
        this.agentService = agentService;
        this.variableService = variableService;
        this.slashCommandService = slashCommandService;
        this.promptsService = promptsService;
    }
    parseChatRequest(sessionResource, message, location = ChatAgentLocation.Chat, context) {
        const parts = [];
        const references = this.variableService.getDynamicVariables(sessionResource); // must access this list before any async calls
        const toolsByName = new Map();
        const toolSetsByName = new Map();
        for (const [entry, enabled] of this.variableService.getSelectedToolAndToolSets(sessionResource)) {
            if (enabled) {
                if (entry instanceof ToolSet) {
                    toolSetsByName.set(entry.referenceName, entry);
                }
                else {
                    toolsByName.set(entry.toolReferenceName ?? entry.displayName, entry);
                }
            }
        }
        let lineNumber = 1;
        let column = 1;
        for (let i = 0; i < message.length; i++) {
            const previousChar = message.charAt(i - 1);
            const char = message.charAt(i);
            let newPart;
            if (previousChar.match(/\s/) || i === 0) {
                if (char === chatVariableLeader) {
                    newPart = this.tryToParseVariable(message.slice(i), i, new Position(lineNumber, column), parts, toolsByName, toolSetsByName);
                }
                else if (char === chatAgentLeader) {
                    newPart = this.tryToParseAgent(message.slice(i), message, i, new Position(lineNumber, column), parts, location, context);
                }
                else if (char === chatSubcommandLeader) {
                    newPart = this.tryToParseSlashCommand(message.slice(i), message, i, new Position(lineNumber, column), parts, location, context);
                }
                if (!newPart) {
                    newPart = this.tryToParseDynamicVariable(message.slice(i), i, new Position(lineNumber, column), references);
                }
            }
            if (newPart) {
                if (i !== 0) {
                    // Insert a part for all the text we passed over, then insert the new parsed part
                    const previousPart = parts.at(-1);
                    const previousPartEnd = previousPart?.range.endExclusive ?? 0;
                    const previousPartEditorRangeEndLine = previousPart?.editorRange.endLineNumber ?? 1;
                    const previousPartEditorRangeEndCol = previousPart?.editorRange.endColumn ?? 1;
                    parts.push(new ChatRequestTextPart(new OffsetRange(previousPartEnd, i), new Range(previousPartEditorRangeEndLine, previousPartEditorRangeEndCol, lineNumber, column), message.slice(previousPartEnd, i)));
                }
                parts.push(newPart);
            }
            if (char === '\n') {
                lineNumber++;
                column = 1;
            }
            else {
                column++;
            }
        }
        const lastPart = parts.at(-1);
        const lastPartEnd = lastPart?.range.endExclusive ?? 0;
        if (lastPartEnd < message.length) {
            parts.push(new ChatRequestTextPart(new OffsetRange(lastPartEnd, message.length), new Range(lastPart?.editorRange.endLineNumber ?? 1, lastPart?.editorRange.endColumn ?? 1, lineNumber, column), message.slice(lastPartEnd, message.length)));
        }
        return {
            parts,
            text: message,
        };
    }
    tryToParseAgent(message, fullMessage, offset, position, parts, location, context) {
        const nextAgentMatch = message.match(agentReg);
        if (!nextAgentMatch) {
            return;
        }
        const [full, name] = nextAgentMatch;
        const agentRange = new OffsetRange(offset, offset + full.length);
        const agentEditorRange = new Range(position.lineNumber, position.column, position.lineNumber, position.column + full.length);
        let agents = this.agentService.getAgentsByName(name);
        if (!agents.length) {
            const fqAgent = this.agentService.getAgentByFullyQualifiedId(name);
            if (fqAgent) {
                agents = [fqAgent];
            }
        }
        // If there is more than one agent with this name, and the user picked it from the suggest widget, then the selected agent should be in the
        // context and we use that one.
        const agent = agents.length > 1 && context?.selectedAgent ?
            context.selectedAgent :
            agents.find((a) => a.locations.includes(location));
        if (!agent) {
            return;
        }
        if (context?.mode && !agent.modes.includes(context.mode)) {
            return;
        }
        if (parts.some(p => p instanceof ChatRequestAgentPart)) {
            // Only one agent allowed
            return;
        }
        // The agent must come first
        if (parts.some(p => (p instanceof ChatRequestTextPart && p.text.trim() !== '') || !(p instanceof ChatRequestAgentPart))) {
            return;
        }
        const previousPart = parts.at(-1);
        const previousPartEnd = previousPart?.range.endExclusive ?? 0;
        const textSincePreviousPart = fullMessage.slice(previousPartEnd, offset);
        if (textSincePreviousPart.trim() !== '') {
            return;
        }
        return new ChatRequestAgentPart(agentRange, agentEditorRange, agent);
    }
    tryToParseVariable(message, offset, position, parts, toolsByName, toolSetsByName) {
        const nextVariableMatch = message.match(variableReg);
        if (!nextVariableMatch) {
            return;
        }
        const [full, name] = nextVariableMatch;
        const varRange = new OffsetRange(offset, offset + full.length);
        const varEditorRange = new Range(position.lineNumber, position.column, position.lineNumber, position.column + full.length);
        const tool = toolsByName.get(name);
        if (tool) {
            return new ChatRequestToolPart(varRange, varEditorRange, name, tool.id, tool.displayName, tool.icon);
        }
        const toolset = toolSetsByName.get(name);
        if (toolset) {
            const value = Array.from(toolset.getTools()).map(t => new ChatRequestToolPart(varRange, varEditorRange, t.toolReferenceName ?? t.displayName, t.id, t.displayName, t.icon).toVariableEntry());
            return new ChatRequestToolSetPart(varRange, varEditorRange, toolset.id, toolset.referenceName, toolset.icon, value);
        }
        return;
    }
    tryToParseSlashCommand(remainingMessage, fullMessage, offset, position, parts, location, context) {
        const nextSlashMatch = remainingMessage.match(slashReg);
        if (!nextSlashMatch) {
            return;
        }
        if (parts.some(p => !(p instanceof ChatRequestAgentPart) && !(p instanceof ChatRequestTextPart && p.text.trim() === ''))) {
            // no other part than agent or non-whitespace text allowed: that also means no other slash command
            return;
        }
        // only whitespace after the last part
        const previousPart = parts.at(-1);
        const previousPartEnd = previousPart?.range.endExclusive ?? 0;
        const textSincePreviousPart = fullMessage.slice(previousPartEnd, offset);
        if (textSincePreviousPart.trim() !== '') {
            return;
        }
        const [full, command] = nextSlashMatch;
        const slashRange = new OffsetRange(offset, offset + full.length);
        const slashEditorRange = new Range(position.lineNumber, position.column, position.lineNumber, position.column + full.length);
        const usedAgent = parts.find((p) => p instanceof ChatRequestAgentPart)?.agent ??
            (context?.forcedAgent ? context.forcedAgent : undefined);
        if (usedAgent) {
            const subCommand = usedAgent.slashCommands.find(c => c.name === command);
            if (subCommand) {
                // Valid agent subcommand
                return new ChatRequestAgentSubcommandPart(slashRange, slashEditorRange, subCommand);
            }
        }
        else {
            const slashCommands = this.slashCommandService.getCommands(location, context?.mode ?? ChatModeKind.Ask);
            const slashCommand = slashCommands.find(c => c.command === command);
            if (slashCommand) {
                // Valid standalone slash command
                return new ChatRequestSlashCommandPart(slashRange, slashEditorRange, slashCommand);
            }
            else {
                // check for with default agent for this location
                const defaultAgent = this.agentService.getDefaultAgent(location, context?.mode);
                const subCommand = defaultAgent?.slashCommands.find(c => c.name === command);
                if (subCommand) {
                    // Valid default agent subcommand
                    return new ChatRequestAgentSubcommandPart(slashRange, slashEditorRange, subCommand);
                }
            }
            // if there's no agent, asume it is a prompt slash command
            const isPromptCommand = this.promptsService.isValidSlashCommandName(command);
            if (isPromptCommand) {
                return new ChatRequestSlashPromptPart(slashRange, slashEditorRange, command);
            }
        }
        return;
    }
    tryToParseDynamicVariable(message, offset, position, references) {
        const refAtThisPosition = references.find(r => r.range.startLineNumber === position.lineNumber &&
            r.range.startColumn === position.column);
        if (refAtThisPosition) {
            const length = refAtThisPosition.range.endColumn - refAtThisPosition.range.startColumn;
            const text = message.substring(0, length);
            const range = new OffsetRange(offset, offset + length);
            return new ChatRequestDynamicVariablePart(range, refAtThisPosition.range, text, refAtThisPosition.id, refAtThisPosition.modelDescription, refAtThisPosition.data, refAtThisPosition.fullName, refAtThisPosition.icon, refAtThisPosition.isFile, refAtThisPosition.isDirectory);
        }
        return;
    }
};
ChatRequestParser = __decorate([
    __param(0, IChatAgentService),
    __param(1, IChatVariablesService),
    __param(2, IChatSlashCommandService),
    __param(3, IPromptsService)
], ChatRequestParser);
export { ChatRequestParser };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFJlcXVlc3RQYXJzZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vY2hhdFJlcXVlc3RQYXJzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFhLFFBQVEsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDbkYsT0FBTyxFQUFrQixpQkFBaUIsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3BFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSw4QkFBOEIsRUFBRSw4QkFBOEIsRUFBRSwyQkFBMkIsRUFBRSwwQkFBMEIsRUFBRSxtQkFBbUIsRUFBRSxtQkFBbUIsRUFBRSxzQkFBc0IsRUFBOEMsZUFBZSxFQUFFLG9CQUFvQixFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDOVYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDbEUsT0FBTyxFQUFFLHFCQUFxQixFQUFvQixNQUFNLG9CQUFvQixDQUFDO0FBQzdFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUNqRSxPQUFPLEVBQWEsT0FBTyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDcEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRTNFLE1BQU0sUUFBUSxHQUFHLDhCQUE4QixDQUFDLENBQUMsYUFBYTtBQUM5RCxNQUFNLFdBQVcsR0FBRyxtQ0FBbUMsQ0FBQyxDQUFDLDREQUE0RDtBQUNySCxNQUFNLFFBQVEsR0FBRyxzQ0FBc0MsQ0FBQyxDQUFD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