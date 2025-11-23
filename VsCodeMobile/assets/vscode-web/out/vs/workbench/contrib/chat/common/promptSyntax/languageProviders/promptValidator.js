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
import { isEmptyPattern, parse, splitGlobAware } from '../../../../../../base/common/glob.js';
import { Iterable } from '../../../../../../base/common/iterator.js';
import { Range } from '../../../../../../editor/common/core/range.js';
import { IModelService } from '../../../../../../editor/common/services/model.js';
import { localize } from '../../../../../../nls.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IMarkerService, MarkerSeverity } from '../../../../../../platform/markers/common/markers.js';
import { IChatModeService } from '../../chatModes.js';
import { ChatModeKind } from '../../constants.js';
import { ILanguageModelChatMetadata, ILanguageModelsService } from '../../languageModels.js';
import { ILanguageModelToolsService } from '../../languageModelToolsService.js';
import { getPromptsTypeForLanguageId, PromptsType } from '../promptTypes.js';
import { GithubPromptHeaderAttributes, PromptHeaderAttributes, Target } from '../promptFileParser.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../../../base/common/lifecycle.js';
import { Delayer } from '../../../../../../base/common/async.js';
import { ResourceMap } from '../../../../../../base/common/map.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { IPromptsService } from '../service/promptsService.js';
import { ILabelService } from '../../../../../../platform/label/common/label.js';
import { AGENTS_SOURCE_FOLDER, LEGACY_MODE_FILE_EXTENSION } from '../config/promptFileLocations.js';
import { Lazy } from '../../../../../../base/common/lazy.js';
const MARKERS_OWNER_ID = 'prompts-diagnostics-provider';
let PromptValidator = class PromptValidator {
    constructor(languageModelsService, languageModelToolsService, chatModeService, fileService, labelService, promptsService) {
        this.languageModelsService = languageModelsService;
        this.languageModelToolsService = languageModelToolsService;
        this.chatModeService = chatModeService;
        this.fileService = fileService;
        this.labelService = labelService;
        this.promptsService = promptsService;
    }
    async validate(promptAST, promptType, report) {
        promptAST.header?.errors.forEach(error => report(toMarker(error.message, error.range, MarkerSeverity.Error)));
        this.validateHeader(promptAST, promptType, report);
        await this.validateBody(promptAST, promptType, report);
        await this.validateFileName(promptAST, promptType, report);
    }
    async validateFileName(promptAST, promptType, report) {
        if (promptType === PromptsType.agent && promptAST.uri.path.endsWith(LEGACY_MODE_FILE_EXTENSION)) {
            const location = this.promptsService.getAgentFileURIFromModeFile(promptAST.uri);
            if (location && await this.fileService.canCreateFile(location)) {
                report(toMarker(localize('promptValidator.chatModesRenamedToAgents', "Chat modes have been renamed to agents. Please move this file to {0}", location.toString()), new Range(1, 1, 1, 4), MarkerSeverity.Warning));
            }
            else {
                report(toMarker(localize('promptValidator.chatModesRenamedToAgentsNoMove', "Chat modes have been renamed to agents. Please move the file to {0}", AGENTS_SOURCE_FOLDER), new Range(1, 1, 1, 4), MarkerSeverity.Warning));
            }
        }
    }
    async validateBody(promptAST, promptType, report) {
        const body = promptAST.body;
        if (!body) {
            return;
        }
        // Validate file references
        const fileReferenceChecks = [];
        for (const ref of body.fileReferences) {
            const resolved = body.resolveFilePath(ref.content);
            if (!resolved) {
                report(toMarker(localize('promptValidator.invalidFileReference', "Invalid file reference '{0}'.", ref.content), ref.range, MarkerSeverity.Warning));
                continue;
            }
            if (promptAST.uri.scheme === resolved.scheme) {
                // only validate if the link is in the file system of the prompt file
                fileReferenceChecks.push((async () => {
                    try {
                        const exists = await this.fileService.exists(resolved);
                        if (exists) {
                            return;
                        }
                    }
                    catch {
                    }
                    const loc = this.labelService.getUriLabel(resolved);
                    report(toMarker(localize('promptValidator.fileNotFound', "File '{0}' not found at '{1}'.", ref.content, loc), ref.range, MarkerSeverity.Warning));
                })());
            }
        }
        const isGitHubTarget = isGithubTarget(promptType, promptAST.header?.target);
        // Validate variable references (tool or toolset names)
        if (body.variableReferences.length && !isGitHubTarget) {
            const headerTools = promptAST.header?.tools;
            const headerTarget = promptAST.header?.target;
            const headerToolsMap = headerTools ? this.languageModelToolsService.toToolAndToolSetEnablementMap(headerTools, headerTarget) : undefined;
            const available = new Set(this.languageModelToolsService.getQualifiedToolNames());
            const deprecatedNames = this.languageModelToolsService.getDeprecatedQualifiedToolNames();
            for (const variable of body.variableReferences) {
                if (!available.has(variable.name)) {
                    if (deprecatedNames.has(variable.name)) {
                        const currentNames = deprecatedNames.get(variable.name);
                        if (currentNames && currentNames.size > 0) {
                            if (currentNames.size === 1) {
                                const newName = Array.from(currentNames)[0];
                                report(toMarker(localize('promptValidator.deprecatedVariableReference', "Tool or toolset '{0}' has been renamed, use '{1}' instead.", variable.name, newName), variable.range, MarkerSeverity.Info));
                            }
                            else {
                                const newNames = Array.from(currentNames).sort((a, b) => a.localeCompare(b)).join(', ');
                                report(toMarker(localize('promptValidator.deprecatedVariableReferenceMultipleNames', "Tool or toolset '{0}' has been renamed, use the following tools instead: {1}", variable.name, newNames), variable.range, MarkerSeverity.Info));
                            }
                        }
                    }
                    else {
                        report(toMarker(localize('promptValidator.unknownVariableReference', "Unknown tool or toolset '{0}'.", variable.name), variable.range, MarkerSeverity.Warning));
                    }
                }
                else if (headerToolsMap) {
                    const tool = this.languageModelToolsService.getToolByQualifiedName(variable.name);
                    if (tool && headerToolsMap.get(tool) === false) {
                        report(toMarker(localize('promptValidator.disabledTool', "Tool or toolset '{0}' also needs to be enabled in the header.", variable.name), variable.range, MarkerSeverity.Warning));
                    }
                }
            }
        }
        await Promise.all(fileReferenceChecks);
    }
    validateHeader(promptAST, promptType, report) {
        const header = promptAST.header;
        if (!header) {
            return;
        }
        const attributes = header.attributes;
        const isGitHubTarget = isGithubTarget(promptType, header.target);
        this.checkForInvalidArguments(attributes, promptType, isGitHubTarget, report);
        this.validateName(attributes, isGitHubTarget, report);
        this.validateDescription(attributes, report);
        this.validateArgumentHint(attributes, report);
        switch (promptType) {
            case PromptsType.prompt: {
                const agent = this.validateAgent(attributes, report);
                this.validateTools(attributes, agent?.kind ?? ChatModeKind.Agent, header.target, report);
                this.validateModel(attributes, agent?.kind ?? ChatModeKind.Agent, report);
                break;
            }
            case PromptsType.instructions:
                this.validateApplyTo(attributes, report);
                this.validateExcludeAgent(attributes, report);
                break;
            case PromptsType.agent: {
                this.validateTarget(attributes, report);
                this.validateTools(attributes, ChatModeKind.Agent, header.target, report);
                if (!isGitHubTarget) {
                    this.validateModel(attributes, ChatModeKind.Agent, report);
                    this.validateHandoffs(attributes, report);
                }
                break;
            }
        }
    }
    checkForInvalidArguments(attributes, promptType, isGitHubTarget, report) {
        const validAttributeNames = getValidAttributeNames(promptType, true, isGitHubTarget);
        const validGithubCopilotAttributeNames = new Lazy(() => new Set(getValidAttributeNames(promptType, false, true)));
        for (const attribute of attributes) {
            if (!validAttributeNames.includes(attribute.key)) {
                const supportedNames = new Lazy(() => getValidAttributeNames(promptType, false, isGitHubTarget).sort().join(', '));
                switch (promptType) {
                    case PromptsType.prompt:
                        report(toMarker(localize('promptValidator.unknownAttribute.prompt', "Attribute '{0}' is not supported in prompt files. Supported: {1}.", attribute.key, supportedNames.value), attribute.range, MarkerSeverity.Warning));
                        break;
                    case PromptsType.agent:
                        if (isGitHubTarget) {
                            report(toMarker(localize('promptValidator.unknownAttribute.github-agent', "Attribute '{0}' is not supported in custom GitHub Copilot agent files. Supported: {1}.", attribute.key, supportedNames.value), attribute.range, MarkerSeverity.Warning));
                        }
                        else {
                            if (validGithubCopilotAttributeNames.value.has(attribute.key)) {
                                report(toMarker(localize('promptValidator.ignoredAttribute.vscode-agent', "Attribute '{0}' is ignored when running locally in VS Code.", attribute.key), attribute.range, MarkerSeverity.Info));
                            }
                            else {
                                report(toMarker(localize('promptValidator.unknownAttribute.vscode-agent', "Attribute '{0}' is not supported in VS Code agent files. Supported: {1}.", attribute.key, supportedNames.value), attribute.range, MarkerSeverity.Warning));
                            }
                        }
                        break;
                    case PromptsType.instructions:
                        report(toMarker(localize('promptValidator.unknownAttribute.instructions', "Attribute '{0}' is not supported in instructions files. Supported: {1}.", attribute.key, supportedNames.value), attribute.range, MarkerSeverity.Warning));
                        break;
                }
            }
        }
    }
    validateName(attributes, isGitHubTarget, report) {
        const nameAttribute = attributes.find(attr => attr.key === PromptHeaderAttributes.name);
        if (!nameAttribute) {
            return;
        }
        if (nameAttribute.value.type !== 'string') {
            report(toMarker(localize('promptValidator.nameMustBeString', "The 'name' attribute must be a string."), nameAttribute.range, MarkerSeverity.Error));
            return;
        }
        if (nameAttribute.value.value.trim().length === 0) {
            report(toMarker(localize('promptValidator.nameShouldNotBeEmpty', "The 'name' attribute must not be empty."), nameAttribute.value.range, MarkerSeverity.Error));
            return;
        }
    }
    validateDescription(attributes, report) {
        const descriptionAttribute = attributes.find(attr => attr.key === PromptHeaderAttributes.description);
        if (!descriptionAttribute) {
            return;
        }
        if (descriptionAttribute.value.type !== 'string') {
            report(toMarker(localize('promptValidator.descriptionMustBeString', "The 'description' attribute must be a string."), descriptionAttribute.range, MarkerSeverity.Error));
            return;
        }
        if (descriptionAttribute.value.value.trim().length === 0) {
            report(toMarker(localize('promptValidator.descriptionShouldNotBeEmpty', "The 'description' attribute should not be empty."), descriptionAttribute.value.range, MarkerSeverity.Error));
            return;
        }
    }
    validateArgumentHint(attributes, report) {
        const argumentHintAttribute = attributes.find(attr => attr.key === PromptHeaderAttributes.argumentHint);
        if (!argumentHintAttribute) {
            return;
        }
        if (argumentHintAttribute.value.type !== 'string') {
            report(toMarker(localize('promptValidator.argumentHintMustBeString', "The 'argument-hint' attribute must be a string."), argumentHintAttribute.range, MarkerSeverity.Error));
            return;
        }
        if (argumentHintAttribute.value.value.trim().length === 0) {
            report(toMarker(localize('promptValidator.argumentHintShouldNotBeEmpty', "The 'argument-hint' attribute should not be empty."), argumentHintAttribute.value.range, MarkerSeverity.Error));
            return;
        }
    }
    validateModel(attributes, agentKind, report) {
        const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.model);
        if (!attribute) {
            return;
        }
        if (attribute.value.type !== 'string') {
            report(toMarker(localize('promptValidator.modelMustBeString', "The 'model' attribute must be a string."), attribute.value.range, MarkerSeverity.Error));
            return;
        }
        const modelName = attribute.value.value.trim();
        if (modelName.length === 0) {
            report(toMarker(localize('promptValidator.modelMustBeNonEmpty', "The 'model' attribute must be a non-empty string."), attribute.value.range, MarkerSeverity.Error));
            return;
        }
        const languageModes = this.languageModelsService.getLanguageModelIds();
        if (languageModes.length === 0) {
            // likely the service is not initialized yet
            return;
        }
        const modelMetadata = this.findModelByName(languageModes, modelName);
        if (!modelMetadata) {
            report(toMarker(localize('promptValidator.modelNotFound', "Unknown model '{0}'.", modelName), attribute.value.range, MarkerSeverity.Warning));
        }
        else if (agentKind === ChatModeKind.Agent && !ILanguageModelChatMetadata.suitableForAgentMode(modelMetadata)) {
            report(toMarker(localize('promptValidator.modelNotSuited', "Model '{0}' is not suited for agent mode.", modelName), attribute.value.range, MarkerSeverity.Warning));
        }
    }
    findModelByName(languageModes, modelName) {
        for (const model of languageModes) {
            const metadata = this.languageModelsService.lookupLanguageModel(model);
            if (metadata && metadata.isUserSelectable !== false && ILanguageModelChatMetadata.matchesQualifiedName(modelName, metadata)) {
                return metadata;
            }
        }
        return undefined;
    }
    validateAgent(attributes, report) {
        const agentAttribute = attributes.find(attr => attr.key === PromptHeaderAttributes.agent);
        const modeAttribute = attributes.find(attr => attr.key === PromptHeaderAttributes.mode);
        if (modeAttribute) {
            if (agentAttribute) {
                report(toMarker(localize('promptValidator.modeDeprecated', "The 'mode' attribute has been deprecated. The 'agent' attribute is used instead."), modeAttribute.range, MarkerSeverity.Warning));
            }
            else {
                report(toMarker(localize('promptValidator.modeDeprecated.useAgent', "The 'mode' attribute has been deprecated. Please rename it to 'agent'."), modeAttribute.range, MarkerSeverity.Error));
            }
        }
        const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.agent) ?? modeAttribute;
        if (!attribute) {
            return undefined; // default agent for prompts is Agent
        }
        if (attribute.value.type !== 'string') {
            report(toMarker(localize('promptValidator.attributeMustBeString', "The '{0}' attribute must be a string.", attribute.key), attribute.value.range, MarkerSeverity.Error));
            return undefined;
        }
        const agentValue = attribute.value.value;
        if (agentValue.trim().length === 0) {
            report(toMarker(localize('promptValidator.attributeMustBeNonEmpty', "The '{0}' attribute must be a non-empty string.", attribute.key), attribute.value.range, MarkerSeverity.Error));
            return undefined;
        }
        return this.validateAgentValue(attribute.value, report);
    }
    validateAgentValue(value, report) {
        const agents = this.chatModeService.getModes();
        const availableAgents = [];
        // Check if agent exists in builtin or custom agents
        for (const agent of Iterable.concat(agents.builtin, agents.custom)) {
            if (agent.name.get() === value.value) {
                return agent;
            }
            availableAgents.push(agent.name.get()); // collect all available agent names
        }
        const errorMessage = localize('promptValidator.agentNotFound', "Unknown agent '{0}'. Available agents: {1}.", value.value, availableAgents.join(', '));
        report(toMarker(errorMessage, value.range, MarkerSeverity.Warning));
        return undefined;
    }
    validateTools(attributes, agentKind, target, report) {
        const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.tools);
        if (!attribute) {
            return;
        }
        if (agentKind !== ChatModeKind.Agent) {
            report(toMarker(localize('promptValidator.toolsOnlyInAgent', "The 'tools' attribute is only supported when using agents. Attribute will be ignored."), attribute.range, MarkerSeverity.Warning));
        }
        switch (attribute.value.type) {
            case 'array':
                if (target === Target.GitHubCopilot) {
                    // no validation for github-copilot target
                }
                else {
                    this.validateVSCodeTools(attribute.value, target, report);
                }
                break;
            default:
                report(toMarker(localize('promptValidator.toolsMustBeArrayOrMap', "The 'tools' attribute must be an array."), attribute.value.range, MarkerSeverity.Error));
        }
    }
    validateVSCodeTools(valueItem, target, report) {
        if (valueItem.items.length > 0) {
            const available = new Set(this.languageModelToolsService.getQualifiedToolNames());
            const deprecatedNames = this.languageModelToolsService.getDeprecatedQualifiedToolNames();
            for (const item of valueItem.items) {
                if (item.type !== 'string') {
                    report(toMarker(localize('promptValidator.eachToolMustBeString', "Each tool name in the 'tools' attribute must be a string."), item.range, MarkerSeverity.Error));
                }
                else if (item.value) {
                    if (!available.has(item.value)) {
                        const currentNames = deprecatedNames.get(item.value);
                        if (currentNames) {
                            if (currentNames?.size === 1) {
                                const newName = Array.from(currentNames)[0];
                                report(toMarker(localize('promptValidator.toolDeprecated', "Tool or toolset '{0}' has been renamed, use '{1}' instead.", item.value, newName), item.range, MarkerSeverity.Info));
                            }
                            else {
                                const newNames = Array.from(currentNames).sort((a, b) => a.localeCompare(b)).join(', ');
                                report(toMarker(localize('promptValidator.toolDeprecatedMultipleNames', "Tool or toolset '{0}' has been renamed, use the following tools instead: {1}", item.value, newNames), item.range, MarkerSeverity.Info));
                            }
                        }
                        else {
                            report(toMarker(localize('promptValidator.toolNotFound', "Unknown tool '{0}'.", item.value), item.range, MarkerSeverity.Warning));
                        }
                    }
                }
            }
        }
    }
    validateApplyTo(attributes, report) {
        const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.applyTo);
        if (!attribute) {
            return;
        }
        if (attribute.value.type !== 'string') {
            report(toMarker(localize('promptValidator.applyToMustBeString', "The 'applyTo' attribute must be a string."), attribute.value.range, MarkerSeverity.Error));
            return;
        }
        const pattern = attribute.value.value;
        try {
            const patterns = splitGlobAware(pattern, ',');
            if (patterns.length === 0) {
                report(toMarker(localize('promptValidator.applyToMustBeValidGlob', "The 'applyTo' attribute must be a valid glob pattern."), attribute.value.range, MarkerSeverity.Error));
                return;
            }
            for (const pattern of patterns) {
                const globPattern = parse(pattern);
                if (isEmptyPattern(globPattern)) {
                    report(toMarker(localize('promptValidator.applyToMustBeValidGlob', "The 'applyTo' attribute must be a valid glob pattern."), attribute.value.range, MarkerSeverity.Error));
                    return;
                }
            }
        }
        catch (_error) {
            report(toMarker(localize('promptValidator.applyToMustBeValidGlob', "The 'applyTo' attribute must be a valid glob pattern."), attribute.value.range, MarkerSeverity.Error));
        }
    }
    validateExcludeAgent(attributes, report) {
        const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.excludeAgent);
        if (!attribute) {
            return;
        }
        if (attribute.value.type !== 'array') {
            report(toMarker(localize('promptValidator.excludeAgentMustBeArray', "The 'excludeAgent' attribute must be an array."), attribute.value.range, MarkerSeverity.Error));
            return;
        }
    }
    validateHandoffs(attributes, report) {
        const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.handOffs);
        if (!attribute) {
            return;
        }
        if (attribute.value.type !== 'array') {
            report(toMarker(localize('promptValidator.handoffsMustBeArray', "The 'handoffs' attribute must be an array."), attribute.value.range, MarkerSeverity.Error));
            return;
        }
        for (const item of attribute.value.items) {
            if (item.type !== 'object') {
                report(toMarker(localize('promptValidator.eachHandoffMustBeObject', "Each handoff in the 'handoffs' attribute must be an object with 'label', 'agent', 'prompt' and optional 'send'."), item.range, MarkerSeverity.Error));
                continue;
            }
            const required = new Set(['label', 'agent', 'prompt']);
            for (const prop of item.properties) {
                switch (prop.key.value) {
                    case 'label':
                        if (prop.value.type !== 'string' || prop.value.value.trim().length === 0) {
                            report(toMarker(localize('promptValidator.handoffLabelMustBeNonEmptyString', "The 'label' property in a handoff must be a non-empty string."), prop.value.range, MarkerSeverity.Error));
                        }
                        break;
                    case 'agent':
                        if (prop.value.type !== 'string' || prop.value.value.trim().length === 0) {
                            report(toMarker(localize('promptValidator.handoffAgentMustBeNonEmptyString', "The 'agent' property in a handoff must be a non-empty string."), prop.value.range, MarkerSeverity.Error));
                        }
                        else {
                            this.validateAgentValue(prop.value, report);
                        }
                        break;
                    case 'prompt':
                        if (prop.value.type !== 'string') {
                            report(toMarker(localize('promptValidator.handoffPromptMustBeString', "The 'prompt' property in a handoff must be a string."), prop.value.range, MarkerSeverity.Error));
                        }
                        break;
                    case 'send':
                        if (prop.value.type !== 'boolean') {
                            report(toMarker(localize('promptValidator.handoffSendMustBeBoolean', "The 'send' property in a handoff must be a boolean."), prop.value.range, MarkerSeverity.Error));
                        }
                        break;
                    case 'showContinueOn':
                        if (prop.value.type !== 'boolean') {
                            report(toMarker(localize('promptValidator.handoffShowContinueOnMustBeBoolean', "The 'showContinueOn' property in a handoff must be a boolean."), prop.value.range, MarkerSeverity.Error));
                        }
                        break;
                    default:
                        report(toMarker(localize('promptValidator.unknownHandoffProperty', "Unknown property '{0}' in handoff object. Supported properties are 'label', 'agent', 'prompt' and optional 'send', 'showContinueOn'.", prop.key.value), prop.value.range, MarkerSeverity.Warning));
                }
                required.delete(prop.key.value);
            }
            if (required.size > 0) {
                report(toMarker(localize('promptValidator.missingHandoffProperties', "Missing required properties {0} in handoff object.", Array.from(required).map(s => `'${s}'`).join(', ')), item.range, MarkerSeverity.Error));
            }
        }
    }
    validateTarget(attributes, report) {
        const attribute = attributes.find(attr => attr.key === PromptHeaderAttributes.target);
        if (!attribute) {
            return;
        }
        if (attribute.value.type !== 'string') {
            report(toMarker(localize('promptValidator.targetMustBeString', "The 'target' attribute must be a string."), attribute.value.range, MarkerSeverity.Error));
            return;
        }
        const targetValue = attribute.value.value.trim();
        if (targetValue.length === 0) {
            report(toMarker(localize('promptValidator.targetMustBeNonEmpty', "The 'target' attribute must be a non-empty string."), attribute.value.range, MarkerSeverity.Error));
            return;
        }
        const validTargets = ['github-copilot', 'vscode'];
        if (!validTargets.includes(targetValue)) {
            report(toMarker(localize('promptValidator.targetInvalidValue', "The 'target' attribute must be one of: {0}.", validTargets.join(', ')), attribute.value.range, MarkerSeverity.Error));
        }
    }
};
PromptValidator = __decorate([
    __param(0, ILanguageModelsService),
    __param(1, ILanguageModelToolsService),
    __param(2, IChatModeService),
    __param(3, IFileService),
    __param(4, ILabelService),
    __param(5, IPromptsService)
], PromptValidator);
export { PromptValidator };
const allAttributeNames = {
    [PromptsType.prompt]: [PromptHeaderAttributes.name, PromptHeaderAttributes.description, PromptHeaderAttributes.model, PromptHeaderAttributes.tools, PromptHeaderAttributes.mode, PromptHeaderAttributes.agent, PromptHeaderAttributes.argumentHint],
    [PromptsType.instructions]: [PromptHeaderAttributes.name, PromptHeaderAttributes.description, PromptHeaderAttributes.applyTo, PromptHeaderAttributes.excludeAgent],
    [PromptsType.agent]: [PromptHeaderAttributes.name, PromptHeaderAttributes.description, PromptHeaderAttributes.model, PromptHeaderAttributes.tools, PromptHeaderAttributes.advancedOptions, PromptHeaderAttributes.handOffs, PromptHeaderAttributes.argumentHint, PromptHeaderAttributes.target]
};
const githubCopilotAgentAttributeNames = [PromptHeaderAttributes.name, PromptHeaderAttributes.description, PromptHeaderAttributes.tools, PromptHeaderAttributes.target, GithubPromptHeaderAttributes.mcpServers];
const recommendedAttributeNames = {
    [PromptsType.prompt]: allAttributeNames[PromptsType.prompt].filter(name => !isNonRecommendedAttribute(name)),
    [PromptsType.instructions]: allAttributeNames[PromptsType.instructions].filter(name => !isNonRecommendedAttribute(name)),
    [PromptsType.agent]: allAttributeNames[PromptsType.agent].filter(name => !isNonRecommendedAttribute(name))
};
export function getValidAttributeNames(promptType, includeNonRecommended, isGitHubTarget) {
    if (isGitHubTarget && promptType === PromptsType.agent) {
        return githubCopilotAgentAttributeNames;
    }
    return includeNonRecommended ? allAttributeNames[promptType] : recommendedAttributeNames[promptType];
}
export function isNonRecommendedAttribute(attributeName) {
    return attributeName === PromptHeaderAttributes.advancedOptions || attributeName === PromptHeaderAttributes.excludeAgent || attributeName === PromptHeaderAttributes.mode;
}
// The list of tools known to be used by GitHub Copilot custom agents
export const knownGithubCopilotTools = {
    'shell': localize('githubCopilotTools.shell', 'Execute shell commands'),
    'edit': localize('githubCopilotTools.edit', 'Edit files'),
    'search': localize('githubCopilotTools.search', 'Search in files'),
    'custom-agent': localize('githubCopilotTools.customAgent', 'Call custom agents')
};
export function isGithubTarget(promptType, target) {
    return promptType === PromptsType.agent && target === Target.GitHubCopilot;
}
function toMarker(message, range, severity = MarkerSeverity.Error) {
    return { severity, message, ...range };
}
let PromptValidatorContribution = class PromptValidatorContribution extends Disposable {
    constructor(modelService, instantiationService, markerService, promptsService, languageModelsService, languageModelToolsService, chatModeService) {
        super();
        this.modelService = modelService;
        this.markerService = markerService;
        this.promptsService = promptsService;
        this.languageModelsService = languageModelsService;
        this.languageModelToolsService = languageModelToolsService;
        this.chatModeService = chatModeService;
        this.localDisposables = this._register(new DisposableStore());
        this.validator = instantiationService.createInstance(PromptValidator);
        this.updateRegistration();
    }
    updateRegistration() {
        this.localDisposables.clear();
        const trackers = new ResourceMap();
        this.localDisposables.add(toDisposable(() => {
            trackers.forEach(tracker => tracker.dispose());
            trackers.clear();
        }));
        this.modelService.getModels().forEach(model => {
            const promptType = getPromptsTypeForLanguageId(model.getLanguageId());
            if (promptType) {
                trackers.set(model.uri, new ModelTracker(model, promptType, this.validator, this.promptsService, this.markerService));
            }
        });
        this.localDisposables.add(this.modelService.onModelAdded((model) => {
            const promptType = getPromptsTypeForLanguageId(model.getLanguageId());
            if (promptType && !trackers.has(model.uri)) {
                trackers.set(model.uri, new ModelTracker(model, promptType, this.validator, this.promptsService, this.markerService));
            }
        }));
        this.localDisposables.add(this.modelService.onModelRemoved((model) => {
            const tracker = trackers.get(model.uri);
            if (tracker) {
                tracker.dispose();
                trackers.delete(model.uri);
            }
        }));
        this.localDisposables.add(this.modelService.onModelLanguageChanged((event) => {
            const { model } = event;
            const tracker = trackers.get(model.uri);
            if (tracker) {
                tracker.dispose();
                trackers.delete(model.uri);
            }
            const promptType = getPromptsTypeForLanguageId(model.getLanguageId());
            if (promptType) {
                trackers.set(model.uri, new ModelTracker(model, promptType, this.validator, this.promptsService, this.markerService));
            }
        }));
        const validateAll = () => trackers.forEach(tracker => tracker.validate());
        this.localDisposables.add(this.languageModelToolsService.onDidChangeTools(() => validateAll()));
        this.localDisposables.add(this.chatModeService.onDidChangeChatModes(() => validateAll()));
        this.localDisposables.add(this.languageModelsService.onDidChangeLanguageModels(() => validateAll()));
    }
};
PromptValidatorContribution = __decorate([
    __param(0, IModelService),
    __param(1, IInstantiationService),
    __param(2, IMarkerService),
    __param(3, IPromptsService),
    __param(4, ILanguageModelsService),
    __param(5, ILanguageModelToolsService),
    __param(6, IChatModeService)
], PromptValidatorContribution);
export { PromptValidatorContribution };
let ModelTracker = class ModelTracker extends Disposable {
    constructor(textModel, promptType, validator, promptsService, markerService) {
        super();
        this.textModel = textModel;
        this.promptType = promptType;
        this.validator = validator;
        this.promptsService = promptsService;
        this.markerService = markerService;
        this.delayer = this._register(new Delayer(200));
        this._register(textModel.onDidChangeContent(() => this.validate()));
        this.validate();
    }
    validate() {
        this.delayer.trigger(async () => {
            const markers = [];
            const ast = this.promptsService.getParsedPromptFile(this.textModel);
            await this.validator.validate(ast, this.promptType, m => markers.push(m));
            this.markerService.changeOne(MARKERS_OWNER_ID, this.textModel.uri, markers);
        });
    }
    dispose() {
        this.markerService.remove(MARKERS_OWNER_ID, [this.textModel.uri]);
        super.dispose();
    }
};
ModelTracker = __decorate([
    __param(3, IPromptsService),
    __param(4, IMarkerService)
], ModelTracker);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0VmFsaWRhdG9yLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Byb21wdFN5bnRheC9sYW5ndWFnZVByb3ZpZGVycy9wcm9tcHRWYWxpZGF0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxLQUFLLEVBQUUsY0FBYyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDOUYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUV0RSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3BELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3pHLE9BQU8sRUFBZSxjQUFjLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDbkgsT0FBTyxFQUFhLGdCQUFnQixFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDakUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ2xELE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQzdGLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxXQUFXLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUM3RSxPQUFPLEVBQUUsNEJBQTRCLEVBQWlFLHNCQUFzQixFQUFFLE1BQU0sRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3JLLE9BQU8sRUFBRSxVQUFVLEVB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