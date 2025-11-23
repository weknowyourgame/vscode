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
import { match, splitGlobAware } from '../../../../../base/common/glob.js';
import { ResourceMap, ResourceSet } from '../../../../../base/common/map.js';
import { Schemas } from '../../../../../base/common/network.js';
import { basename, dirname } from '../../../../../base/common/resources.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { ChatRequestVariableSet, IChatRequestVariableEntry, isPromptFileVariableEntry, toPromptFileVariableEntry, toPromptTextVariableEntry, PromptFileVariableKind } from '../chatVariableEntries.js';
import { PromptsConfig } from './config/config.js';
import { isPromptOrInstructionsFile } from './config/promptFileLocations.js';
import { PromptsType } from './promptTypes.js';
import { IPromptsService } from './service/promptsService.js';
export function newInstructionsCollectionEvent() {
    return { applyingInstructionsCount: 0, referencedInstructionsCount: 0, agentInstructionsCount: 0, listedInstructionsCount: 0, totalInstructionsCount: 0 };
}
let ComputeAutomaticInstructions = class ComputeAutomaticInstructions {
    constructor(_readFileTool, _promptsService, _logService, _labelService, _configurationService, _workspaceService, _fileService, _telemetryService) {
        this._readFileTool = _readFileTool;
        this._promptsService = _promptsService;
        this._logService = _logService;
        this._labelService = _labelService;
        this._configurationService = _configurationService;
        this._workspaceService = _workspaceService;
        this._fileService = _fileService;
        this._telemetryService = _telemetryService;
        this._parseResults = new ResourceMap();
    }
    async _parseInstructionsFile(uri, token) {
        if (this._parseResults.has(uri)) {
            return this._parseResults.get(uri);
        }
        try {
            const result = await this._promptsService.parseNew(uri, token);
            this._parseResults.set(uri, result);
            return result;
        }
        catch (error) {
            this._logService.error(`[InstructionsContextComputer] Failed to parse instruction file: ${uri}`, error);
            return undefined;
        }
    }
    async collect(variables, token) {
        const instructionFiles = await this._promptsService.listPromptFiles(PromptsType.instructions, token);
        this._logService.trace(`[InstructionsContextComputer] ${instructionFiles.length} instruction files available.`);
        const telemetryEvent = newInstructionsCollectionEvent();
        const context = this._getContext(variables);
        // find instructions where the `applyTo` matches the attached context
        await this.addApplyingInstructions(instructionFiles, context, variables, telemetryEvent, token);
        // add all instructions referenced by all instruction files that are in the context
        await this._addReferencedInstructions(variables, telemetryEvent, token);
        // get copilot instructions
        await this._addAgentInstructions(variables, telemetryEvent, token);
        const instructionsWithPatternsList = await this._getInstructionsWithPatternsList(instructionFiles, variables, token);
        if (instructionsWithPatternsList.length > 0) {
            const text = instructionsWithPatternsList.join('\n');
            variables.add(toPromptTextVariableEntry(text, true));
            telemetryEvent.listedInstructionsCount++;
        }
        this.sendTelemetry(telemetryEvent);
    }
    sendTelemetry(telemetryEvent) {
        // Emit telemetry
        telemetryEvent.totalInstructionsCount = telemetryEvent.agentInstructionsCount + telemetryEvent.referencedInstructionsCount + telemetryEvent.applyingInstructionsCount + telemetryEvent.listedInstructionsCount;
        this._telemetryService.publicLog2('instructionsCollected', telemetryEvent);
    }
    /** public for testing */
    async addApplyingInstructions(instructionFiles, context, variables, telemetryEvent, token) {
        for (const { uri } of instructionFiles) {
            const parsedFile = await this._parseInstructionsFile(uri, token);
            if (!parsedFile) {
                this._logService.trace(`[InstructionsContextComputer] Unable to read: ${uri}`);
                continue;
            }
            const applyTo = parsedFile.header?.applyTo;
            if (!applyTo) {
                this._logService.trace(`[InstructionsContextComputer] No 'applyTo' found: ${uri}`);
                continue;
            }
            if (context.instructions.has(uri)) {
                // the instruction file is already part of the input or has already been processed
                this._logService.trace(`[InstructionsContextComputer] Skipping already processed instruction file: ${uri}`);
                continue;
            }
            const match = this._matches(context.files, applyTo);
            if (match) {
                this._logService.trace(`[InstructionsContextComputer] Match for ${uri} with ${match.pattern}${match.file ? ` for file ${match.file}` : ''}`);
                const reason = !match.file ?
                    localize('instruction.file.reason.allFiles', 'Automatically attached as pattern is **') :
                    localize('instruction.file.reason.specificFile', 'Automatically attached as pattern {0} matches {1}', applyTo, this._labelService.getUriLabel(match.file, { relative: true }));
                variables.add(toPromptFileVariableEntry(uri, PromptFileVariableKind.Instruction, reason, true));
                telemetryEvent.applyingInstructionsCount++;
            }
            else {
                this._logService.trace(`[InstructionsContextComputer] No match for ${uri} with ${applyTo}`);
            }
        }
    }
    _getContext(attachedContext) {
        const files = new ResourceSet();
        const instructions = new ResourceSet();
        for (const variable of attachedContext.asArray()) {
            if (isPromptFileVariableEntry(variable)) {
                instructions.add(variable.value);
            }
            else {
                const uri = IChatRequestVariableEntry.toUri(variable);
                if (uri) {
                    files.add(uri);
                }
            }
        }
        return { files, instructions };
    }
    async _addAgentInstructions(variables, telemetryEvent, token) {
        const useCopilotInstructionsFiles = this._configurationService.getValue(PromptsConfig.USE_COPILOT_INSTRUCTION_FILES);
        const useAgentMd = this._configurationService.getValue(PromptsConfig.USE_AGENT_MD);
        if (!useCopilotInstructionsFiles && !useAgentMd) {
            this._logService.trace(`[InstructionsContextComputer] No agent instructions files added (settings disabled).`);
            return;
        }
        const entries = new ChatRequestVariableSet();
        if (useCopilotInstructionsFiles) {
            const files = await this._promptsService.listCopilotInstructionsMDs(token);
            for (const file of files) {
                entries.add(toPromptFileVariableEntry(file, PromptFileVariableKind.Instruction, localize('instruction.file.reason.copilot', 'Automatically attached as setting {0} is enabled', PromptsConfig.USE_COPILOT_INSTRUCTION_FILES), true));
                telemetryEvent.agentInstructionsCount++;
                this._logService.trace(`[InstructionsContextComputer] copilot-instruction.md files added: ${file.toString()}`);
            }
            await this._addReferencedInstructions(entries, telemetryEvent, token);
        }
        if (useAgentMd) {
            const files = await this._promptsService.listAgentMDs(token, false);
            for (const file of files) {
                entries.add(toPromptFileVariableEntry(file, PromptFileVariableKind.Instruction, localize('instruction.file.reason.agentsmd', 'Automatically attached as setting {0} is enabled', PromptsConfig.USE_AGENT_MD), true));
                telemetryEvent.agentInstructionsCount++;
                this._logService.trace(`[InstructionsContextComputer] AGENTS.md files added: ${file.toString()}`);
            }
        }
        for (const entry of entries.asArray()) {
            variables.add(entry);
        }
    }
    _matches(files, applyToPattern) {
        const patterns = splitGlobAware(applyToPattern, ',');
        const patterMatches = (pattern) => {
            pattern = pattern.trim();
            if (pattern.length === 0) {
                // if glob pattern is empty, skip it
                return undefined;
            }
            if (pattern === '**' || pattern === '**/*' || pattern === '*') {
                // if glob pattern is one of the special wildcard values,
                // add the instructions file event if no files are attached
                return { pattern };
            }
            if (!pattern.startsWith('/') && !pattern.startsWith('**/')) {
                // support relative glob patterns, e.g. `src/**/*.js`
                pattern = '**/' + pattern;
            }
            // match each attached file with each glob pattern and
            // add the instructions file if its rule matches the file
            for (const file of files) {
                // if the file is not a valid URI, skip it
                if (match(pattern, file.path, { ignoreCase: true })) {
                    return { pattern, file }; // return the matched pattern and file URI
                }
            }
            return undefined;
        };
        for (const pattern of patterns) {
            const matchResult = patterMatches(pattern);
            if (matchResult) {
                return matchResult; // return the first matched pattern and file URI
            }
        }
        return undefined;
    }
    async _getInstructionsWithPatternsList(instructionFiles, _existingVariables, token) {
        if (!this._readFileTool) {
            this._logService.trace('[InstructionsContextComputer] No readFile tool available, skipping instructions with patterns list.');
            return [];
        }
        const searchNestedAgentMd = this._configurationService.getValue(PromptsConfig.USE_NESTED_AGENT_MD);
        const agentsMdPromise = searchNestedAgentMd ? this._promptsService.findAgentMDsInWorkspace(token) : Promise.resolve([]);
        const toolName = 'read_file'; // workaround https://github.com/microsoft/vscode/issues/252167
        const entries = [
            'Here is a list of instruction files that contain rules for modifying or creating new code.',
            'These files are important for ensuring that the code is modified or created correctly.',
            'Please make sure to follow the rules specified in these files when working with the codebase.',
            `If the file is not already available as attachment, use the \`${toolName}\` tool to acquire it.`,
            'Make sure to acquire the instructions before making any changes to the code.',
            '| File | Applies To | Description |',
            '| ------- | --------- | ----------- |',
        ];
        let hasContent = false;
        for (const { uri } of instructionFiles) {
            const parsedFile = await this._parseInstructionsFile(uri, token);
            if (parsedFile) {
                const applyTo = parsedFile.header?.applyTo ?? '';
                const description = parsedFile.header?.description ?? '';
                entries.push(`| '${getFilePath(uri)}' | ${applyTo} | ${description} |`);
                hasContent = true;
            }
        }
        const agentsMdFiles = await agentsMdPromise;
        for (const uri of agentsMdFiles) {
            if (uri) {
                const folderName = this._labelService.getUriLabel(dirname(uri), { relative: true });
                const description = folderName.trim().length === 0 ? localize('instruction.file.description.agentsmd.root', 'Instructions for the workspace') : localize('instruction.file.description.agentsmd.folder', 'Instructions for folder \'{0}\'', folderName);
                entries.push(`| '${getFilePath(uri)}' |    | ${description} |`);
                hasContent = true;
            }
        }
        if (!hasContent) {
            entries.length = 0; // clear entries
        }
        else {
            entries.push('', ''); // add trailing newline
        }
        const claudeSkills = await this._promptsService.findClaudeSkills(token);
        if (claudeSkills && claudeSkills.length > 0) {
            entries.push('Here is a list of skills that contain domain specific knowledge on a variety of topics.', 'Each skill comes with a description of the topic and a file path that contains the detailed instructions.', 'When a user asks you to perform a task that falls within the domain of a skill, use the \`${toolName}\` tool to acquire the full instructions from the file URI.', '| Name | Description | File', '| ------- | --------- | ----------- |');
            for (const skill of claudeSkills) {
                entries.push(`| ${skill.name} | ${skill.description} | '${getFilePath(skill.uri)}' |`);
            }
        }
        return entries;
    }
    async _addReferencedInstructions(attachedContext, telemetryEvent, token) {
        const seen = new ResourceSet();
        const todo = [];
        for (const variable of attachedContext.asArray()) {
            if (isPromptFileVariableEntry(variable)) {
                if (!seen.has(variable.value)) {
                    todo.push(variable.value);
                    seen.add(variable.value);
                }
            }
        }
        let next = todo.pop();
        while (next) {
            const result = await this._parseInstructionsFile(next, token);
            if (result && result.body) {
                const refsToCheck = [];
                for (const ref of result.body.fileReferences) {
                    const url = result.body.resolveFilePath(ref.content);
                    if (url && !seen.has(url) && (isPromptOrInstructionsFile(url) || this._workspaceService.getWorkspaceFolder(url) !== undefined)) {
                        // only add references that are either prompt or instruction files or are part of the workspace
                        refsToCheck.push({ resource: url });
                        seen.add(url);
                    }
                }
                if (refsToCheck.length > 0) {
                    const stats = await this._fileService.resolveAll(refsToCheck);
                    for (let i = 0; i < stats.length; i++) {
                        const stat = stats[i];
                        const uri = refsToCheck[i].resource;
                        if (stat.success && stat.stat?.isFile) {
                            if (isPromptOrInstructionsFile(uri)) {
                                // only recursively parse instruction files
                                todo.push(uri);
                            }
                            const reason = localize('instruction.file.reason.referenced', 'Referenced by {0}', basename(next));
                            attachedContext.add(toPromptFileVariableEntry(uri, PromptFileVariableKind.InstructionReference, reason, true));
                            telemetryEvent.referencedInstructionsCount++;
                            this._logService.trace(`[InstructionsContextComputer] ${uri.toString()} added, referenced by ${next.toString()}`);
                        }
                    }
                }
            }
            next = todo.pop();
        }
    }
};
ComputeAutomaticInstructions = __decorate([
    __param(1, IPromptsService),
    __param(2, ILogService),
    __param(3, ILabelService),
    __param(4, IConfigurationService),
    __param(5, IWorkspaceContextService),
    __param(6, IFileService),
    __param(7, ITelemetryService)
], ComputeAutomaticInstructions);
export { ComputeAutomaticInstructions };
function getFilePath(uri) {
    if (uri.scheme === Schemas.file || uri.scheme === Schemas.vscodeRemote) {
        return uri.fsPath;
    }
    return uri.toString();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZUF1dG9tYXRpY0luc3RydWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvY29tcHV0ZUF1dG9tYXRpY0luc3RydWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsS0FBSyxFQUFFLGNBQWMsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDN0UsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFFNUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUM3RSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDOUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQzFGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSx5QkFBeUIsRUFBRSx5QkFBeUIsRUFBRSx5QkFBeUIsRUFBRSx5QkFBeUIsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBRXZNLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUNu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