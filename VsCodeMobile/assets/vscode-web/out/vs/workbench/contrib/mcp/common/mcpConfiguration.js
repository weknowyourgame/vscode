/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { mcpSchemaId } from '../../../services/configuration/common/configuration.js';
import { inputsSchema } from '../../../services/configurationResolver/common/configurationResolverSchema.js';
import { Extensions } from '../../../services/extensionManagement/common/extensionFeatures.js';
const mcpActivationEventPrefix = 'onMcpCollection:';
/**
 * note: `contributedCollectionId` is _not_ the collection ID. The collection
 * ID is formed by passing the contributed ID through `extensionPrefixedIdentifier`
 */
export const mcpActivationEvent = (contributedCollectionId) => mcpActivationEventPrefix + contributedCollectionId;
export var DiscoverySource;
(function (DiscoverySource) {
    DiscoverySource["ClaudeDesktop"] = "claude-desktop";
    DiscoverySource["Windsurf"] = "windsurf";
    DiscoverySource["CursorGlobal"] = "cursor-global";
    DiscoverySource["CursorWorkspace"] = "cursor-workspace";
})(DiscoverySource || (DiscoverySource = {}));
export const allDiscoverySources = Object.keys({
    ["claude-desktop" /* DiscoverySource.ClaudeDesktop */]: true,
    ["windsurf" /* DiscoverySource.Windsurf */]: true,
    ["cursor-global" /* DiscoverySource.CursorGlobal */]: true,
    ["cursor-workspace" /* DiscoverySource.CursorWorkspace */]: true,
});
export const discoverySourceLabel = {
    ["claude-desktop" /* DiscoverySource.ClaudeDesktop */]: localize('mcp.discovery.source.claude-desktop', "Claude Desktop"),
    ["windsurf" /* DiscoverySource.Windsurf */]: localize('mcp.discovery.source.windsurf', "Windsurf"),
    ["cursor-global" /* DiscoverySource.CursorGlobal */]: localize('mcp.discovery.source.cursor-global', "Cursor (Global)"),
    ["cursor-workspace" /* DiscoverySource.CursorWorkspace */]: localize('mcp.discovery.source.cursor-workspace', "Cursor (Workspace)"),
};
export const discoverySourceSettingsLabel = {
    ["claude-desktop" /* DiscoverySource.ClaudeDesktop */]: localize('mcp.discovery.source.claude-desktop.config', "Claude Desktop configuration (`claude_desktop_config.json`)"),
    ["windsurf" /* DiscoverySource.Windsurf */]: localize('mcp.discovery.source.windsurf.config', "Windsurf configurations (`~/.codeium/windsurf/mcp_config.json`)"),
    ["cursor-global" /* DiscoverySource.CursorGlobal */]: localize('mcp.discovery.source.cursor-global.config', "Cursor global configuration (`~/.cursor/mcp.json`)"),
    ["cursor-workspace" /* DiscoverySource.CursorWorkspace */]: localize('mcp.discovery.source.cursor-workspace.config', "Cursor workspace configuration (`.cursor/mcp.json`)"),
};
export const mcpConfigurationSection = 'mcp';
export const mcpDiscoverySection = 'chat.mcp.discovery.enabled';
export const mcpServerSamplingSection = 'chat.mcp.serverSampling';
export const mcpSchemaExampleServers = {
    'mcp-server-time': {
        command: 'python',
        args: ['-m', 'mcp_server_time', '--local-timezone=America/Los_Angeles'],
        env: {},
    }
};
const httpSchemaExamples = {
    'my-mcp-server': {
        url: 'http://localhost:3001/mcp',
        headers: {},
    }
};
const mcpDevModeProps = (stdio) => ({
    dev: {
        type: 'object',
        markdownDescription: localize('app.mcp.dev', 'Enabled development mode for the server. When present, the server will be started eagerly and output will be included in its output. Properties inside the `dev` object can configure additional behavior.'),
        examples: [{ watch: 'src/**/*.ts', debug: { type: 'node' } }],
        properties: {
            watch: {
                description: localize('app.mcp.dev.watch', 'A glob pattern or list of glob patterns relative to the workspace folder to watch. The MCP server will be restarted when these files change.'),
                examples: ['src/**/*.ts'],
                oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
            },
            ...(stdio && {
                debug: {
                    markdownDescription: localize('app.mcp.dev.debug', 'If set, debugs the MCP server using the given runtime as it\'s started.'),
                    oneOf: [
                        {
                            type: 'object',
                            required: ['type'],
                            properties: {
                                type: {
                                    type: 'string',
                                    enum: ['node'],
                                    description: localize('app.mcp.dev.debug.type.node', "Debug the MCP server using Node.js.")
                                }
                            },
                            additionalProperties: false
                        },
                        {
                            type: 'object',
                            required: ['type'],
                            properties: {
                                type: {
                                    type: 'string',
                                    enum: ['debugpy'],
                                    description: localize('app.mcp.dev.debug.type.python', "Debug the MCP server using Python and debugpy.")
                                },
                                debugpyPath: {
                                    type: 'string',
                                    description: localize('app.mcp.dev.debug.debugpyPath', "Path to the debugpy executable.")
                                },
                            },
                            additionalProperties: false
                        }
                    ]
                }
            })
        }
    }
});
export const mcpStdioServerSchema = {
    type: 'object',
    additionalProperties: false,
    examples: [mcpSchemaExampleServers['mcp-server-time']],
    properties: {
        type: {
            type: 'string',
            enum: ['stdio'],
            description: localize('app.mcp.json.type', "The type of the server.")
        },
        command: {
            type: 'string',
            description: localize('app.mcp.json.command', "The command to run the server.")
        },
        cwd: {
            type: 'string',
            description: localize('app.mcp.json.cwd', "The working directory for the server command. Defaults to the workspace folder when run in a workspace."),
            examples: ['${workspaceFolder}'],
        },
        args: {
            type: 'array',
            description: localize('app.mcp.args.command', "Arguments passed to the server."),
            items: {
                type: 'string'
            },
        },
        envFile: {
            type: 'string',
            description: localize('app.mcp.envFile.command', "Path to a file containing environment variables for the server."),
            examples: ['${workspaceFolder}/.env'],
        },
        env: {
            description: localize('app.mcp.env.command', "Environment variables passed to the server."),
            additionalProperties: {
                anyOf: [
                    { type: 'null' },
                    { type: 'string' },
                    { type: 'number' },
                ]
            }
        },
        ...mcpDevModeProps(true),
    }
};
export const mcpServerSchema = {
    id: mcpSchemaId,
    type: 'object',
    title: localize('app.mcp.json.title', "Model Context Protocol Servers"),
    allowTrailingCommas: true,
    allowComments: true,
    additionalProperties: false,
    properties: {
        servers: {
            examples: [
                mcpSchemaExampleServers,
                httpSchemaExamples,
            ],
            additionalProperties: {
                oneOf: [
                    mcpStdioServerSchema, {
                        type: 'object',
                        additionalProperties: false,
                        required: ['url'],
                        examples: [httpSchemaExamples['my-mcp-server']],
                        properties: {
                            type: {
                                type: 'string',
                                enum: ['http', 'sse'],
                                description: localize('app.mcp.json.type', "The type of the server.")
                            },
                            url: {
                                type: 'string',
                                format: 'uri',
                                pattern: '^https?:\\/\\/.+',
                                patternErrorMessage: localize('app.mcp.json.url.pattern', "The URL must start with 'http://' or 'https://'."),
                                description: localize('app.mcp.json.url', "The URL of the Streamable HTTP or SSE endpoint.")
                            },
                            headers: {
                                type: 'object',
                                description: localize('app.mcp.json.headers', "Additional headers sent to the server."),
                                additionalProperties: { type: 'string' },
                            },
                            ...mcpDevModeProps(false),
                        }
                    },
                ]
            }
        },
        inputs: inputsSchema.definitions.inputs
    }
};
export const mcpContributionPoint = {
    extensionPoint: 'mcpServerDefinitionProviders',
    activationEventsGenerator: function* (contribs) {
        for (const contrib of contribs) {
            if (contrib.id) {
                yield mcpActivationEvent(contrib.id);
            }
        }
    },
    jsonSchema: {
        description: localize('vscode.extension.contributes.mcp', 'Contributes Model Context Protocol servers. Users of this should also use `vscode.lm.registerMcpServerDefinitionProvider`.'),
        type: 'array',
        defaultSnippets: [{ body: [{ id: '', label: '' }] }],
        items: {
            additionalProperties: false,
            type: 'object',
            defaultSnippets: [{ body: { id: '', label: '' } }],
            properties: {
                id: {
                    description: localize('vscode.extension.contributes.mcp.id', "Unique ID for the collection."),
                    type: 'string'
                },
                label: {
                    description: localize('vscode.extension.contributes.mcp.label', "Display name for the collection."),
                    type: 'string'
                },
                when: {
                    description: localize('vscode.extension.contributes.mcp.when', "Condition which must be true to enable this collection."),
                    type: 'string'
                }
            }
        }
    }
};
class McpServerDefinitionsProviderRenderer extends Disposable {
    constructor() {
        super(...arguments);
        this.type = 'table';
    }
    shouldRender(manifest) {
        return !!manifest.contributes?.mcpServerDefinitionProviders && Array.isArray(manifest.contributes.mcpServerDefinitionProviders) && manifest.contributes.mcpServerDefinitionProviders.length > 0;
    }
    render(manifest) {
        const mcpServerDefinitionProviders = manifest.contributes?.mcpServerDefinitionProviders ?? [];
        const headers = [localize('id', "ID"), localize('name', "Name")];
        const rows = mcpServerDefinitionProviders
            .map(mcpServerDefinitionProvider => {
            return [
                new MarkdownString().appendMarkdown(`\`${mcpServerDefinitionProvider.id}\``),
                mcpServerDefinitionProvider.label
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
    id: mcpConfigurationSection,
    label: localize('mcpServerDefinitionProviders', "MCP Servers"),
    access: {
        canToggle: false
    },
    renderer: new SyncDescriptor(McpServerDefinitionsProviderRenderer),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwQ29uZmlndXJhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL21jcENvbmZpZ3VyYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRXhFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFOUMsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDdEYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLCtFQUErRSxDQUFDO0FBQzdHLE9BQU8sRUFBRSxVQUFVLEVBQW1HLE1BQU0sbUVBQW1FLENBQUM7QUFHaE0sTUFBTSx3QkFBd0IsR0FBRyxrQkFBa0IsQ0FBQztBQUVwRDs7O0dBR0c7QUFDSCxNQUFNLENBQUMsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLHVCQUErQixFQUFFLEVBQUUsQ0FDckUsd0JBQXdCLEdBQUcsdUJBQXVCLENBQUM7QUFFcEQsTUFBTSxDQUFOLElBQWtCLGVBS2pCO0FBTEQsV0FBa0IsZUFBZTtJQUNoQyxtREFBZ0MsQ0FBQTtJQUNoQyx3Q0FBcUIsQ0FBQTtJQUNyQixpREFBOEIsQ0FBQTtJQUM5Qix1REFBb0MsQ0FBQTtBQUNyQyxDQUFDLEVBTGlCLGVBQWUsS0FBZixlQUFlLFFBS2hDO0FBRUQsTUFBTSxDQUFDLE1BQU0sbUJBQW1CLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztJQUM5QyxzREFBK0IsRUFBRSxJQUFJO0lB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