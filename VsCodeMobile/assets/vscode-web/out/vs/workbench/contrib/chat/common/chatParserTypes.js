/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { revive } from '../../../../base/common/marshalling.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { OffsetRange } from '../../../../editor/common/core/ranges/offsetRange.js';
import { reviveSerializedAgent } from './chatAgents.js';
import { IDiagnosticVariableEntryFilterData } from './chatVariableEntries.js';
export function getPromptText(request) {
    const message = request.parts.map(r => r.promptText).join('').trimStart();
    const diff = request.text.length - message.length;
    return { message, diff };
}
export class ChatRequestTextPart {
    static { this.Kind = 'text'; }
    constructor(range, editorRange, text) {
        this.range = range;
        this.editorRange = editorRange;
        this.text = text;
        this.kind = ChatRequestTextPart.Kind;
    }
    get promptText() {
        return this.text;
    }
}
// warning, these also show up in a regex in the parser
export const chatVariableLeader = '#';
export const chatAgentLeader = '@';
export const chatSubcommandLeader = '/';
/**
 * An invocation of a static variable that can be resolved by the variable service
 * @deprecated, but kept for backwards compatibility with old persisted chat requests
 */
class ChatRequestVariablePart {
    static { this.Kind = 'var'; }
    constructor(range, editorRange, variableName, variableArg, variableId) {
        this.range = range;
        this.editorRange = editorRange;
        this.variableName = variableName;
        this.variableArg = variableArg;
        this.variableId = variableId;
        this.kind = ChatRequestVariablePart.Kind;
    }
    get text() {
        const argPart = this.variableArg ? `:${this.variableArg}` : '';
        return `${chatVariableLeader}${this.variableName}${argPart}`;
    }
    get promptText() {
        return this.text;
    }
}
/**
 * An invocation of a tool
 */
export class ChatRequestToolPart {
    static { this.Kind = 'tool'; }
    constructor(range, editorRange, toolName, toolId, displayName, icon) {
        this.range = range;
        this.editorRange = editorRange;
        this.toolName = toolName;
        this.toolId = toolId;
        this.displayName = displayName;
        this.icon = icon;
        this.kind = ChatRequestToolPart.Kind;
    }
    get text() {
        return `${chatVariableLeader}${this.toolName}`;
    }
    get promptText() {
        return this.text;
    }
    toVariableEntry() {
        return { kind: 'tool', id: this.toolId, name: this.toolName, range: this.range, value: undefined, icon: ThemeIcon.isThemeIcon(this.icon) ? this.icon : undefined, fullName: this.displayName };
    }
}
/**
 * An invocation of a tool
 */
export class ChatRequestToolSetPart {
    static { this.Kind = 'toolset'; }
    constructor(range, editorRange, id, name, icon, tools) {
        this.range = range;
        this.editorRange = editorRange;
        this.id = id;
        this.name = name;
        this.icon = icon;
        this.tools = tools;
        this.kind = ChatRequestToolSetPart.Kind;
    }
    get text() {
        return `${chatVariableLeader}${this.name}`;
    }
    get promptText() {
        return this.text;
    }
    toVariableEntry() {
        return { kind: 'toolset', id: this.id, name: this.name, range: this.range, icon: this.icon, value: this.tools };
    }
}
/**
 * An invocation of an agent that can be resolved by the agent service
 */
export class ChatRequestAgentPart {
    static { this.Kind = 'agent'; }
    constructor(range, editorRange, agent) {
        this.range = range;
        this.editorRange = editorRange;
        this.agent = agent;
        this.kind = ChatRequestAgentPart.Kind;
    }
    get text() {
        return `${chatAgentLeader}${this.agent.name}`;
    }
    get promptText() {
        return '';
    }
}
/**
 * An invocation of an agent's subcommand
 */
export class ChatRequestAgentSubcommandPart {
    static { this.Kind = 'subcommand'; }
    constructor(range, editorRange, command) {
        this.range = range;
        this.editorRange = editorRange;
        this.command = command;
        this.kind = ChatRequestAgentSubcommandPart.Kind;
    }
    get text() {
        return `${chatSubcommandLeader}${this.command.name}`;
    }
    get promptText() {
        return '';
    }
}
/**
 * An invocation of a standalone slash command
 */
export class ChatRequestSlashCommandPart {
    static { this.Kind = 'slash'; }
    constructor(range, editorRange, slashCommand) {
        this.range = range;
        this.editorRange = editorRange;
        this.slashCommand = slashCommand;
        this.kind = ChatRequestSlashCommandPart.Kind;
    }
    get text() {
        return `${chatSubcommandLeader}${this.slashCommand.command}`;
    }
    get promptText() {
        return `${chatSubcommandLeader}${this.slashCommand.command}`;
    }
}
/**
 * An invocation of a standalone slash command
 */
export class ChatRequestSlashPromptPart {
    static { this.Kind = 'prompt'; }
    constructor(range, editorRange, name) {
        this.range = range;
        this.editorRange = editorRange;
        this.name = name;
        this.kind = ChatRequestSlashPromptPart.Kind;
    }
    get text() {
        return `${chatSubcommandLeader}${this.name}`;
    }
    get promptText() {
        return `${chatSubcommandLeader}${this.name}`;
    }
}
/**
 * An invocation of a dynamic reference like '#file:'
 */
export class ChatRequestDynamicVariablePart {
    static { this.Kind = 'dynamic'; }
    constructor(range, editorRange, text, id, modelDescription, data, fullName, icon, isFile, isDirectory) {
        this.range = range;
        this.editorRange = editorRange;
        this.text = text;
        this.id = id;
        this.modelDescription = modelDescription;
        this.data = data;
        this.fullName = fullName;
        this.icon = icon;
        this.isFile = isFile;
        this.isDirectory = isDirectory;
        this.kind = ChatRequestDynamicVariablePart.Kind;
    }
    get referenceText() {
        return this.text.replace(chatVariableLeader, '');
    }
    get promptText() {
        return this.text;
    }
    toVariableEntry() {
        if (this.id === 'vscode.problems') {
            return IDiagnosticVariableEntryFilterData.toEntry(this.data.filter);
        }
        return { kind: this.isDirectory ? 'directory' : this.isFile ? 'file' : 'generic', id: this.id, name: this.referenceText, range: this.range, value: this.data, fullName: this.fullName, icon: this.icon };
    }
}
export function reviveParsedChatRequest(serialized) {
    return {
        text: serialized.text,
        parts: serialized.parts.map(part => {
            if (part.kind === ChatRequestTextPart.Kind) {
                return new ChatRequestTextPart(new OffsetRange(part.range.start, part.range.endExclusive), part.editorRange, part.text);
            }
            else if (part.kind === ChatRequestVariablePart.Kind) {
                return new ChatRequestVariablePart(new OffsetRange(part.range.start, part.range.endExclusive), part.editorRange, part.variableName, part.variableArg, part.variableId || '');
            }
            else if (part.kind === ChatRequestToolPart.Kind) {
                return new ChatRequestToolPart(new OffsetRange(part.range.start, part.range.endExclusive), part.editorRange, part.toolName, part.toolId, part.displayName, part.icon);
            }
            else if (part.kind === ChatRequestToolSetPart.Kind) {
                return new ChatRequestToolSetPart(new OffsetRange(part.range.start, part.range.endExclusive), part.editorRange, part.id, part.name, part.icon, part.tools ?? []);
            }
            else if (part.kind === ChatRequestAgentPart.Kind) {
                let agent = part.agent;
                agent = reviveSerializedAgent(agent);
                return new ChatRequestAgentPart(new OffsetRange(part.range.start, part.range.endExclusive), part.editorRange, agent);
            }
            else if (part.kind === ChatRequestAgentSubcommandPart.Kind) {
                return new ChatRequestAgentSubcommandPart(new OffsetRange(part.range.start, part.range.endExclusive), part.editorRange, part.command);
            }
            else if (part.kind === ChatRequestSlashCommandPart.Kind) {
                return new ChatRequestSlashCommandPart(new OffsetRange(part.range.start, part.range.endExclusive), part.editorRange, part.slashCommand);
            }
            else if (part.kind === ChatRequestSlashPromptPart.Kind) {
                return new ChatRequestSlashPromptPart(new OffsetRange(part.range.start, part.range.endExclusive), part.editorRange, part.name);
            }
            else if (part.kind === ChatRequestDynamicVariablePart.Kind) {
                return new ChatRequestDynamicVariablePart(new OffsetRange(part.range.start, part.range.endExclusive), part.editorRange, part.text, part.id, part.modelDescription, revive(part.data), part.fullName, part.icon, part.isFile, part.isDirectory);
            }
            else {
                throw new Error(`Unknown chat request part: ${part.kind}`);
            }
        })
    };
}
export function extractAgentAndCommand(parsed) {
    const agentPart = parsed.parts.find((r) => r instanceof ChatRequestAgentPart);
    const commandPart = parsed.parts.find((r) => r instanceof ChatRequestAgentSubcommandPart);
    return { agentPart, commandPart };
}
export function formatChatQuestion(chatAgentService, location, prompt, participant = null, command = null) {
    let question = '';
    if (participant && participant !== chatAgentService.getDefaultAgent(location)?.id) {
        const agent = chatAgentService.getAgent(participant);
        if (!agent) {
            // Refers to agent that doesn't exist
            return undefined;
        }
        question += `${chatAgentLeader}${agent.name} `;
        if (command) {
            question += `${chatSubcommandLeader}${command} `;
        }
    }
    return question + prompt;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFBhcnNlclR5cGVzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL2NoYXRQYXJzZXJUeXBlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBZ0IsV0FBVyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFakcsT0FBTyxFQUF3RCxxQkFBcUIsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBSzlHLE9BQU8sRUFBOEUsa0NBQWtDLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQWtCMUosTUFBTSxVQUFVLGFBQWEsQ0FBQyxPQUEyQjtJQUN4RCxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUM7SUFDMUUsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztJQUVsRCxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDO0FBQzFCLENBQUM7QUFFRCxNQUFNLE9BQU8sbUJBQW1CO2FBQ2YsU0FBSSxHQUFHLE1BQU0sQUFBVCxDQUFVO0lBRTlCLFlBQXFCLEtBQWtCLEVBQVcsV0FBbUIsRUFBVyxJQUFZO1FBQXZFLFVBQUssR0FBTCxLQUFLLENBQWE7UUFBVyxnQkFBVyxHQUFYLFdBQVcsQ0FBUTtRQUFXLFNBQUksR0FBSixJQUFJLENBQVE7UUFEbkYsU0FBSSxHQUFHLG1CQUFtQixDQUFD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