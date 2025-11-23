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
import { isFalsyOrEmpty } from '../../../../../base/common/arrays.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { transaction } from '../../../../../base/common/observable.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { isFalsyOrWhitespace } from '../../../../../base/common/strings.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions } from '../../../../services/extensionManagement/common/extensionFeatures.js';
import { isProposedApiEnabled } from '../../../../services/extensions/common/extensions.js';
import * as extensionsRegistry from '../../../../services/extensions/common/extensionsRegistry.js';
import { ILanguageModelToolsService, ToolDataSource } from '../languageModelToolsService.js';
import { toolsParametersSchemaSchemaId } from './languageModelToolsParametersSchema.js';
const languageModelToolsExtensionPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: 'languageModelTools',
    activationEventsGenerator: function* (contributions) {
        for (const contrib of contributions) {
            yield `onLanguageModelTool:${contrib.name}`;
        }
    },
    jsonSchema: {
        description: localize('vscode.extension.contributes.tools', 'Contributes a tool that can be invoked by a language model in a chat session, or from a standalone command. Registered tools can be used by all extensions.'),
        type: 'array',
        items: {
            additionalProperties: false,
            type: 'object',
            defaultSnippets: [{
                    body: {
                        name: '${1}',
                        modelDescription: '${2}',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                '${3:name}': {
                                    type: 'string',
                                    description: '${4:description}'
                                }
                            }
                        },
                    }
                }],
            required: ['name', 'displayName', 'modelDescription'],
            properties: {
                name: {
                    description: localize('toolName', "A unique name for this tool. This name must be a globally unique identifier, and is also used as a name when presenting this tool to a language model."),
                    type: 'string',
                    // [\\w-]+ is OpenAI's requirement for tool names
                    pattern: '^(?!copilot_|vscode_)[\\w-]+$'
                },
                toolReferenceName: {
                    markdownDescription: localize('toolName2', "If {0} is enabled for this tool, the user may use '#' with this name to invoke the tool in a query. Otherwise, the name is not required. Name must not contain whitespace.", '`canBeReferencedInPrompt`'),
                    type: 'string',
                    pattern: '^[\\w-]+$'
                },
                legacyToolReferenceFullNames: {
                    markdownDescription: localize('legacyToolReferenceFullNames', "An array of deprecated names for backwards compatibility that can also be used to reference this tool in a query. Each name must not contain whitespace. Full names are generally in the format `toolsetName/toolReferenceName` (e.g., `search/readFile`) or just `toolReferenceName` when there is no toolset (e.g., `readFile`)."),
                    type: 'array',
                    items: {
                        type: 'string',
                        pattern: '^[\\w-]+(/[\\w-]+)?$'
                    }
                },
                displayName: {
                    description: localize('toolDisplayName', "A human-readable name for this tool that may be used to describe it in the UI."),
                    type: 'string'
                },
                userDescription: {
                    description: localize('toolUserDescription', "A description of this tool that may be shown to the user."),
                    type: 'string'
                },
                // eslint-disable-next-line local/code-no-localized-model-description
                modelDescription: {
                    description: localize('toolModelDescription', "A description of this tool that may be used by a language model to select it."),
                    type: 'string'
                },
                inputSchema: {
                    description: localize('parametersSchema', "A JSON schema for the input this tool accepts. The input must be an object at the top level. A particular language model may not support all JSON schema features. See the documentation for the language model family you are using for more information."),
                    $ref: toolsParametersSchemaSchemaId
                },
                canBeReferencedInPrompt: {
                    markdownDescription: localize('canBeReferencedInPrompt', "If true, this tool shows up as an attachment that the user can add manually to their request. Chat participants will receive the tool in {0}.", '`ChatRequest#toolReferences`'),
                    type: 'boolean'
                },
                icon: {
                    markdownDescription: localize('icon', 'An icon that represents this tool. Either a file path, an object with file paths for dark and light themes, or a theme icon reference, like "\\$(zap)"'),
                    anyOf: [{
                            type: 'string'
                        },
                        {
                            type: 'object',
                            properties: {
                                light: {
                                    description: localize('icon.light', 'Icon path when a light theme is used'),
                                    type: 'string'
                                },
                                dark: {
                                    description: localize('icon.dark', 'Icon path when a dark theme is used'),
                                    type: 'string'
                                }
                            }
                        }]
                },
                when: {
                    markdownDescription: localize('condition', "Condition which must be true for this tool to be enabled. Note that a tool may still be invoked by another extension even when its `when` condition is false."),
                    type: 'string'
                },
                tags: {
                    description: localize('toolTags', "A set of tags that roughly describe the tool's capabilities. A tool user may use these to filter the set of tools to just ones that are relevant for the task at hand, or they may want to pick a tag that can be used to identify just the tools contributed by this extension."),
                    type: 'array',
                    items: {
                        type: 'string',
                        pattern: '^(?!copilot_|vscode_)'
                    }
                }
            }
        }
    }
});
const languageModelToolSetsExtensionPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: 'languageModelToolSets',
    deps: [languageModelToolsExtensionPoint],
    jsonSchema: {
        description: localize('vscode.extension.contributes.toolSets', 'Contributes a set of language model tools that can be used together.'),
        type: 'array',
        items: {
            additionalProperties: false,
            type: 'object',
            defaultSnippets: [{
                    body: {
                        name: '${1}',
                        description: '${2}',
                        tools: ['${3}']
                    }
                }],
            required: ['name', 'description', 'tools'],
            properties: {
                name: {
                    description: localize('toolSetName', "A name for this tool set. Used as reference and should not contain whitespace."),
                    type: 'string',
                    pattern: '^[\\w-]+$'
                },
                legacyFullNames: {
                    markdownDescription: localize('toolSetLegacyFullNames', "An array of deprecated names for backwards compatibility that can also be used to reference this tool set. Each name must not contain whitespace. Full names are generally in the format `parentToolSetName/toolSetName` (e.g., `github/repo`) or just `toolSetName` when there is no parent toolset (e.g., `repo`)."),
                    type: 'array',
                    items: {
                        type: 'string',
                        pattern: '^[\\w-]+$'
                    }
                },
                description: {
                    description: localize('toolSetDescription', "A description of this tool set."),
                    type: 'string'
                },
                icon: {
                    markdownDescription: localize('toolSetIcon', "An icon that represents this tool set, like `$(zap)`"),
                    type: 'string'
                },
                tools: {
                    markdownDescription: localize('toolSetTools', "A list of tools or tool sets to include in this tool set. Cannot be empty and must reference tools by their `toolReferenceName`."),
                    type: 'array',
                    minItems: 1,
                    items: {
                        type: 'string'
                    }
                }
            }
        }
    }
});
function toToolKey(extensionIdentifier, toolName) {
    return `${extensionIdentifier.value}/${toolName}`;
}
function toToolSetKey(extensionIdentifier, toolName) {
    return `toolset:${extensionIdentifier.value}/${toolName}`;
}
let LanguageModelToolsExtensionPointHandler = class LanguageModelToolsExtensionPointHandler {
    static { this.ID = 'workbench.contrib.toolsExtensionPointHandler'; }
    constructor(productService, languageModelToolsService) {
        this._registrationDisposables = new DisposableMap();
        languageModelToolsExtensionPoint.setHandler((_extensions, delta) => {
            for (const extension of delta.added) {
                for (const rawTool of extension.value) {
                    if (!rawTool.name || !rawTool.modelDescription || !rawTool.displayName) {
                        extension.collector.error(`Extension '${extension.description.identifier.value}' CANNOT register tool without name, modelDescription, and displayName: ${JSON.stringify(rawTool)}`);
                        continue;
                    }
                    if (!rawTool.name.match(/^[\w-]+$/)) {
                        extension.collector.error(`Extension '${extension.description.identifier.value}' CANNOT register tool with invalid id: ${rawTool.name}. The id must match /^[\\w-]+$/.`);
                        continue;
                    }
                    if (rawTool.canBeReferencedInPrompt && !rawTool.toolReferenceName) {
                        extension.collector.error(`Extension '${extension.description.identifier.value}' CANNOT register tool with 'canBeReferencedInPrompt' set without a 'toolReferenceName': ${JSON.stringify(rawTool)}`);
                        continue;
                    }
                    if ((rawTool.name.startsWith('copilot_') || rawTool.name.startsWith('vscode_')) && !isProposedApiEnabled(extension.description, 'chatParticipantPrivate')) {
                        extension.collector.error(`Extension '${extension.description.identifier.value}' CANNOT register tool with name starting with "vscode_" or "copilot_"`);
                        continue;
                    }
                    if (rawTool.tags?.some(tag => tag.startsWith('copilot_') || tag.startsWith('vscode_')) && !isProposedApiEnabled(extension.description, 'chatParticipantPrivate')) {
                        extension.collector.error(`Extension '${extension.description.identifier.value}' CANNOT register tool with tags starting with "vscode_" or "copilot_"`);
                    }
                    if (rawTool.legacyToolReferenceFullNames && !isProposedApiEnabled(extension.description, 'chatParticipantPrivate')) {
                        extension.collector.error(`Extension '${extension.description.identifier.value}' CANNOT use 'legacyToolReferenceFullNames' without the 'chatParticipantPrivate' API proposal enabled`);
                        continue;
                    }
                    const rawIcon = rawTool.icon;
                    let icon;
                    if (typeof rawIcon === 'string') {
                        icon = ThemeIcon.fromString(rawIcon) ?? {
                            dark: joinPath(extension.description.extensionLocation, rawIcon),
                            light: joinPath(extension.description.extensionLocation, rawIcon)
                        };
                    }
                    else if (rawIcon) {
                        icon = {
                            dark: joinPath(extension.description.extensionLocation, rawIcon.dark),
                            light: joinPath(extension.description.extensionLocation, rawIcon.light)
                        };
                    }
                    // If OSS and the product.json is not set up, fall back to checking api proposal
                    const isBuiltinTool = productService.defaultChatAgent?.chatExtensionId ?
                        ExtensionIdentifier.equals(extension.description.identifier, productService.defaultChatAgent.chatExtensionId) :
                        isProposedApiEnabled(extension.description, 'chatParticipantPrivate');
                    const source = isBuiltinTool
                        ? ToolDataSource.Internal
                        : { type: 'extension', label: extension.description.displayName ?? extension.description.name, extensionId: extension.description.identifier };
                    const tool = {
                        ...rawTool,
                        source,
                        inputSchema: rawTool.inputSchema,
                        id: rawTool.name,
                        icon,
                        when: rawTool.when ? ContextKeyExpr.deserialize(rawTool.when) : undefined,
                        alwaysDisplayInputOutput: !isBuiltinTool,
                    };
                    try {
                        const disposable = languageModelToolsService.registerToolData(tool);
                        this._registrationDisposables.set(toToolKey(extension.description.identifier, rawTool.name), disposable);
                    }
                    catch (e) {
                        extension.collector.error(`Failed to register tool '${rawTool.name}': ${e}`);
                    }
                }
            }
            for (const extension of delta.removed) {
                for (const tool of extension.value) {
                    this._registrationDisposables.deleteAndDispose(toToolKey(extension.description.identifier, tool.name));
                }
            }
        });
        languageModelToolSetsExtensionPoint.setHandler((_extensions, delta) => {
            for (const extension of delta.added) {
                if (!isProposedApiEnabled(extension.description, 'contribLanguageModelToolSets')) {
                    extension.collector.error(`Extension '${extension.description.identifier.value}' CANNOT register language model tools because the 'contribLanguageModelToolSets' API proposal is not enabled.`);
                    continue;
                }
                const isBuiltinTool = productService.defaultChatAgent?.chatExtensionId ?
                    ExtensionIdentifier.equals(extension.description.identifier, productService.defaultChatAgent.chatExtensionId) :
                    isProposedApiEnabled(extension.description, 'chatParticipantPrivate');
                const source = isBuiltinTool
                    ? ToolDataSource.Internal
                    : { type: 'extension', label: extension.description.displayName ?? extension.description.name, extensionId: extension.description.identifier };
                for (const toolSet of extension.value) {
                    if (isFalsyOrWhitespace(toolSet.name)) {
                        extension.collector.error(`Tool set '${toolSet.name}' CANNOT have an empty name`);
                        continue;
                    }
                    if (toolSet.legacyFullNames && !isProposedApiEnabled(extension.description, 'contribLanguageModelToolSets')) {
                        extension.collector.error(`Tool set '${toolSet.name}' CANNOT use 'legacyFullNames' without the 'contribLanguageModelToolSets' API proposal enabled`);
                        continue;
                    }
                    if (isFalsyOrEmpty(toolSet.tools)) {
                        extension.collector.error(`Tool set '${toolSet.name}' CANNOT have an empty tools array`);
                        continue;
                    }
                    const tools = [];
                    const toolSets = [];
                    for (const toolName of toolSet.tools) {
                        const toolObj = languageModelToolsService.getToolByName(toolName, true);
                        if (toolObj) {
                            tools.push(toolObj);
                            continue;
                        }
                        const toolSetObj = languageModelToolsService.getToolSetByName(toolName);
                        if (toolSetObj) {
                            toolSets.push(toolSetObj);
                            continue;
                        }
                        extension.collector.warn(`Tool set '${toolSet.name}' CANNOT find tool or tool set by name: ${toolName}`);
                    }
                    if (toolSets.length === 0 && tools.length === 0) {
                        extension.collector.error(`Tool set '${toolSet.name}' CANNOT have an empty tools array (none of the tools were found)`);
                        continue;
                    }
                    const store = new DisposableStore();
                    const referenceName = toolSet.referenceName ?? toolSet.name;
                    const existingToolSet = languageModelToolsService.getToolSetByName(referenceName);
                    const mergeExisting = isBuiltinTool && existingToolSet?.source === ToolDataSource.Internal;
                    let obj;
                    // Allow built-in tool to update the tool set if it already exists
                    if (mergeExisting) {
                        obj = existingToolSet;
                    }
                    else {
                        obj = languageModelToolsService.createToolSet(source, toToolSetKey(extension.description.identifier, toolSet.name), referenceName, { icon: toolSet.icon ? ThemeIcon.fromString(toolSet.icon) : undefined, description: toolSet.description, legacyFullNames: toolSet.legacyFullNames });
                    }
                    transaction(tx => {
                        if (!mergeExisting) {
                            store.add(obj);
                        }
                        tools.forEach(tool => store.add(obj.addTool(tool, tx)));
                        toolSets.forEach(toolSet => store.add(obj.addToolSet(toolSet, tx)));
                    });
                    this._registrationDisposables.set(toToolSetKey(extension.description.identifier, toolSet.name), store);
                }
            }
            for (const extension of delta.removed) {
                for (const toolSet of extension.value) {
                    this._registrationDisposables.deleteAndDispose(toToolSetKey(extension.description.identifier, toolSet.name));
                }
            }
        });
    }
};
LanguageModelToolsExtensionPointHandler = __decorate([
    __param(0, IProductService),
    __param(1, ILanguageModelToolsService)
], LanguageModelToolsExtensionPointHandler);
export { LanguageModelToolsExtensionPointHandler };
// --- render
class LanguageModelToolDataRenderer extends Disposable {
    constructor() {
        super(...arguments);
        this.type = 'table';
    }
    shouldRender(manifest) {
        return !!manifest.contributes?.languageModelTools;
    }
    render(manifest) {
        const contribs = manifest.contributes?.languageModelTools ?? [];
        if (!contribs.length) {
            return { data: { headers: [], rows: [] }, dispose: () => { } };
        }
        const headers = [
            localize('toolTableName', "Name"),
            localize('toolTableDisplayName', "Display Name"),
            localize('toolTableDescription', "Description"),
        ];
        const rows = contribs.map(t => {
            return [
                new MarkdownString(`\`${t.name}\``),
                t.displayName,
                t.userDescription ?? t.modelDescription,
            ];
        });
        return {
            data: {
                headers,
                rows
            },
            dispose: () => { }
        };
    }
}
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
    id: 'languageModelTools',
    label: localize('langModelTools', "Language Model Tools"),
    access: {
        canToggle: false
    },
    renderer: new SyncDescriptor(LanguageModelToolDataRenderer),
});
class LanguageModelToolSetDataRenderer extends Disposable {
    constructor() {
        super(...arguments);
        this.type = 'table';
    }
    shouldRender(manifest) {
        return !!manifest.contributes?.languageModelToolSets;
    }
    render(manifest) {
        const contribs = manifest.contributes?.languageModelToolSets ?? [];
        if (!contribs.length) {
            return { data: { headers: [], rows: [] }, dispose: () => { } };
        }
        const headers = [
            localize('name', "Name"),
            localize('reference', "Reference Name"),
            localize('tools', "Tools"),
            localize('descriptions', "Description"),
        ];
        const rows = contribs.map(t => {
            return [
                new MarkdownString(`\`${t.name}\``),
                t.referenceName ? new MarkdownString(`\`#${t.referenceName}\``) : 'none',
                t.tools.join(', '),
                t.description,
            ];
        });
        return {
            data: {
                headers,
                rows
            },
            dispose: () => { }
        };
    }
}
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
    id: 'languageModelToolSets',
    label: localize('langModelToolSets', "Language Model Tool Sets"),
    access: {
        canToggle: false
    },
    renderer: new SyncDescriptor(LanguageModelToolSetDataRenderer),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFuZ3VhZ2VNb2RlbFRvb2xzQ29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Rvb2xzL2xhbmd1YWdlTW9kZWxUb29sc0NvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdEUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBRTNFLE9BQU8sRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBZSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2xILE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDbkUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDNUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDekYsT0FBTyxFQUFFLG1CQUFtQixFQUFzQixNQUFNLHlEQUF5RCxDQUFDO0FBQ2xILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUM3RixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDM0YsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBRS9FLE9BQU8sRUFBRSxVQUFVLEVBQW1HLE1BQU0sc0VBQXNFLENBQUM7QUFDbk0sT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sc0RB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