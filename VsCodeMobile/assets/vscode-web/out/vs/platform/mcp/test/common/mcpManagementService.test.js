/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { AbstractCommonMcpManagementService } from '../../common/mcpManagementService.js';
import { Event } from '../../../../base/common/event.js';
import { NullLogService } from '../../../log/common/log.js';
class TestMcpManagementService extends AbstractCommonMcpManagementService {
    constructor() {
        super(...arguments);
        this.onInstallMcpServer = Event.None;
        this.onDidInstallMcpServers = Event.None;
        this.onDidUpdateMcpServers = Event.None;
        this.onUninstallMcpServer = Event.None;
        this.onDidUninstallMcpServer = Event.None;
    }
    getInstalled(mcpResource) {
        throw new Error('Method not implemented.');
    }
    install(server, options) {
        throw new Error('Method not implemented.');
    }
    installFromGallery(server, options) {
        throw new Error('Method not implemented.');
    }
    updateMetadata(local, server, profileLocation) {
        throw new Error('Method not implemented.');
    }
    uninstall(server, options) {
        throw new Error('Method not implemented.');
    }
    canInstall(server) {
        throw new Error('Not supported');
    }
}
suite('McpManagementService - getMcpServerConfigurationFromManifest', () => {
    let service;
    setup(() => {
        service = new TestMcpManagementService(new NullLogService());
    });
    teardown(() => {
        service.dispose();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('NPM Package Tests', () => {
        test('basic NPM package configuration', () => {
            const manifest = {
                packages: [{
                        registryType: "npm" /* RegistryType.NODE */,
                        registryBaseUrl: 'https://registry.npmjs.org',
                        identifier: '@modelcontextprotocol/server-brave-search',
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        version: '1.0.2',
                        environmentVariables: [{
                                name: 'BRAVE_API_KEY',
                                value: 'test-key'
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            assert.strictEqual(result.mcpServerConfiguration.config.type, "stdio" /* McpServerType.LOCAL */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.strictEqual(result.mcpServerConfiguration.config.command, 'npx');
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, ['@modelcontextprotocol/server-brave-search@1.0.2']);
                assert.deepStrictEqual(result.mcpServerConfiguration.config.env, { 'BRAVE_API_KEY': 'test-key' });
            }
            assert.strictEqual(result.mcpServerConfiguration.inputs, undefined);
        });
        test('NPM package without version', () => {
            const manifest = {
                packages: [{
                        registryType: "npm" /* RegistryType.NODE */,
                        registryBaseUrl: 'https://registry.npmjs.org',
                        identifier: '@modelcontextprotocol/everything',
                        version: '',
                        transport: { type: "stdio" /* TransportType.STDIO */ }
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            assert.strictEqual(result.mcpServerConfiguration.config.type, "stdio" /* McpServerType.LOCAL */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.strictEqual(result.mcpServerConfiguration.config.command, 'npx');
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, ['@modelcontextprotocol/everything']);
            }
        });
        test('NPM package with environment variables containing variables', () => {
            const manifest = {
                packages: [{
                        registryType: "npm" /* RegistryType.NODE */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        identifier: 'test-server',
                        version: '1.0.0',
                        environmentVariables: [{
                                name: 'API_KEY',
                                value: 'key-{api_token}',
                                variables: {
                                    api_token: {
                                        description: 'Your API token',
                                        isSecret: true,
                                        isRequired: true
                                    }
                                }
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            assert.strictEqual(result.mcpServerConfiguration.config.type, "stdio" /* McpServerType.LOCAL */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.env, { 'API_KEY': 'key-${input:api_token}' });
            }
            assert.strictEqual(result.mcpServerConfiguration.inputs?.length, 1);
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].id, 'api_token');
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].type, "promptString" /* McpServerVariableType.PROMPT */);
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].description, 'Your API token');
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].password, true);
        });
        test('environment variable with empty value should create input variable (GitHub issue #266106)', () => {
            const manifest = {
                packages: [{
                        registryType: "npm" /* RegistryType.NODE */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        identifier: '@modelcontextprotocol/server-brave-search',
                        version: '1.0.2',
                        environmentVariables: [{
                                name: 'BRAVE_API_KEY',
                                value: '', // Empty value should create input variable
                                description: 'Brave Search API Key',
                                isRequired: true,
                                isSecret: true
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            // BUG: Currently this creates env with empty string instead of input variable
            // Should create an input variable since no meaningful value is provided
            assert.strictEqual(result.mcpServerConfiguration.inputs?.length, 1);
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].id, 'BRAVE_API_KEY');
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].description, 'Brave Search API Key');
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].password, true);
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].type, "promptString" /* McpServerVariableType.PROMPT */);
            // Environment should use input variable interpolation
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.env, { 'BRAVE_API_KEY': '${input:BRAVE_API_KEY}' });
            }
        });
        test('environment variable with choices but empty value should create pick input (GitHub issue #266106)', () => {
            const manifest = {
                packages: [{
                        registryType: "npm" /* RegistryType.NODE */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        identifier: 'test-server',
                        version: '1.0.0',
                        environmentVariables: [{
                                name: 'SSL_MODE',
                                value: '', // Empty value should create input variable
                                description: 'SSL connection mode',
                                default: 'prefer',
                                choices: ['disable', 'prefer', 'require']
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            // BUG: Currently this creates env with empty string instead of input variable
            // Should create a pick input variable since choices are provided
            assert.strictEqual(result.mcpServerConfiguration.inputs?.length, 1);
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].id, 'SSL_MODE');
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].description, 'SSL connection mode');
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].default, 'prefer');
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].type, "pickString" /* McpServerVariableType.PICK */);
            assert.deepStrictEqual(result.mcpServerConfiguration.inputs?.[0].options, ['disable', 'prefer', 'require']);
            // Environment should use input variable interpolation
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.env, { 'SSL_MODE': '${input:SSL_MODE}' });
            }
        });
        test('NPM package with package arguments', () => {
            const manifest = {
                packages: [{
                        registryType: "npm" /* RegistryType.NODE */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        identifier: 'snyk',
                        version: '1.1298.0',
                        packageArguments: [
                            { type: 'positional', value: 'mcp', valueHint: 'command', isRepeated: false },
                            {
                                type: 'named',
                                name: '-t',
                                value: 'stdio',
                                isRepeated: false
                            }
                        ]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            assert.strictEqual(result.mcpServerConfiguration.config.type, "stdio" /* McpServerType.LOCAL */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, ['snyk@1.1298.0', 'mcp', '-t', 'stdio']);
            }
        });
    });
    suite('Python Package Tests', () => {
        test('basic Python package configuration', () => {
            const manifest = {
                packages: [{
                        registryType: "pypi" /* RegistryType.PYTHON */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        registryBaseUrl: 'https://pypi.org',
                        identifier: 'weather-mcp-server',
                        version: '0.5.0',
                        environmentVariables: [{
                                name: 'WEATHER_API_KEY',
                                value: 'test-key'
                            }, {
                                name: 'WEATHER_UNITS',
                                value: 'celsius'
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "pypi" /* RegistryType.PYTHON */);
            assert.strictEqual(result.mcpServerConfiguration.config.type, "stdio" /* McpServerType.LOCAL */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.strictEqual(result.mcpServerConfiguration.config.command, 'uvx');
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, ['weather-mcp-server==0.5.0']);
                assert.deepStrictEqual(result.mcpServerConfiguration.config.env, {
                    'WEATHER_API_KEY': 'test-key',
                    'WEATHER_UNITS': 'celsius'
                });
            }
        });
        test('Python package without version', () => {
            const manifest = {
                packages: [{
                        registryType: "pypi" /* RegistryType.PYTHON */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        identifier: 'weather-mcp-server',
                        version: ''
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "pypi" /* RegistryType.PYTHON */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, ['weather-mcp-server']);
            }
        });
    });
    suite('Docker Package Tests', () => {
        test('basic Docker package configuration', () => {
            const manifest = {
                packages: [{
                        registryType: "oci" /* RegistryType.DOCKER */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        registryBaseUrl: 'https://docker.io',
                        identifier: 'mcp/filesystem',
                        version: '1.0.2',
                        runtimeArguments: [{
                                type: 'named',
                                name: '--mount',
                                value: 'type=bind,src=/host/path,dst=/container/path',
                                isRepeated: false
                            }],
                        environmentVariables: [{
                                name: 'LOG_LEVEL',
                                value: 'info'
                            }],
                        packageArguments: [{
                                type: 'positional',
                                value: '/project',
                                valueHint: 'directory',
                                isRepeated: false
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "oci" /* RegistryType.DOCKER */);
            assert.strictEqual(result.mcpServerConfiguration.config.type, "stdio" /* McpServerType.LOCAL */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.strictEqual(result.mcpServerConfiguration.config.command, 'docker');
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, [
                    'run', '-i', '--rm',
                    '--mount', 'type=bind,src=/host/path,dst=/container/path',
                    '-e', 'LOG_LEVEL',
                    'mcp/filesystem:1.0.2',
                    '/project'
                ]);
                assert.deepStrictEqual(result.mcpServerConfiguration.config.env, { 'LOG_LEVEL': 'info' });
            }
        });
        test('Docker package with variables in runtime arguments', () => {
            const manifest = {
                packages: [{
                        registryType: "oci" /* RegistryType.DOCKER */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        identifier: 'example/database-manager-mcp',
                        version: '3.1.0',
                        runtimeArguments: [{
                                type: 'named',
                                name: '-e',
                                value: 'DB_TYPE={db_type}',
                                isRepeated: false,
                                variables: {
                                    db_type: {
                                        description: 'Type of database',
                                        choices: ['postgres', 'mysql', 'mongodb', 'redis'],
                                        isRequired: true
                                    }
                                }
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "oci" /* RegistryType.DOCKER */);
            assert.strictEqual(result.mcpServerConfiguration.config.type, "stdio" /* McpServerType.LOCAL */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, [
                    'run', '-i', '--rm',
                    '-e', 'DB_TYPE=${input:db_type}',
                    'example/database-manager-mcp:3.1.0'
                ]);
            }
            assert.strictEqual(result.mcpServerConfiguration.inputs?.length, 1);
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].id, 'db_type');
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].type, "pickString" /* McpServerVariableType.PICK */);
            assert.deepStrictEqual(result.mcpServerConfiguration.inputs?.[0].options, ['postgres', 'mysql', 'mongodb', 'redis']);
        });
        test('Docker package arguments without values should create input variables (GitHub issue #266106)', () => {
            const manifest = {
                packages: [{
                        registryType: "oci" /* RegistryType.DOCKER */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        identifier: 'example/database-manager-mcp',
                        version: '3.1.0',
                        packageArguments: [{
                                type: 'named',
                                name: '--host',
                                description: 'Database host',
                                default: 'localhost',
                                isRequired: true,
                                isRepeated: false
                                // Note: No 'value' field - should create input variable
                            }, {
                                type: 'positional',
                                valueHint: 'database_name',
                                description: 'Name of the database to connect to',
                                isRequired: true,
                                isRepeated: false
                                // Note: No 'value' field - should create input variable
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "oci" /* RegistryType.DOCKER */);
            // BUG: Currently named args without value are ignored, positional uses value_hint as literal
            // Should create input variables for both arguments
            assert.strictEqual(result.mcpServerConfiguration.inputs?.length, 2);
            const hostInput = result.mcpServerConfiguration.inputs?.find((i) => i.id === 'host');
            assert.strictEqual(hostInput?.description, 'Database host');
            assert.strictEqual(hostInput?.default, 'localhost');
            assert.strictEqual(hostInput?.type, "promptString" /* McpServerVariableType.PROMPT */);
            const dbNameInput = result.mcpServerConfiguration.inputs?.find((i) => i.id === 'database_name');
            assert.strictEqual(dbNameInput?.description, 'Name of the database to connect to');
            assert.strictEqual(dbNameInput?.type, "promptString" /* McpServerVariableType.PROMPT */);
            // Args should use input variable interpolation
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, [
                    'run', '-i', '--rm',
                    'example/database-manager-mcp:3.1.0',
                    '--host', '${input:host}',
                    '${input:database_name}'
                ]);
            }
        });
        test('Docker Hub backward compatibility', () => {
            const manifest = {
                packages: [{
                        registryType: "oci" /* RegistryType.DOCKER */,
                        identifier: 'example/test-image',
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        version: '1.0.0'
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "oci" /* RegistryType.DOCKER */);
            assert.strictEqual(result.mcpServerConfiguration.config.type, "stdio" /* McpServerType.LOCAL */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.strictEqual(result.mcpServerConfiguration.config.command, 'docker');
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, [
                    'run', '-i', '--rm',
                    'example/test-image:1.0.0'
                ]);
            }
        });
    });
    suite('NuGet Package Tests', () => {
        test('basic NuGet package configuration', () => {
            const manifest = {
                packages: [{
                        registryType: "nuget" /* RegistryType.NUGET */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        registryBaseUrl: 'https://api.nuget.org',
                        identifier: 'Knapcode.SampleMcpServer',
                        version: '0.5.0',
                        environmentVariables: [{
                                name: 'WEATHER_CHOICES',
                                value: 'sunny,cloudy,rainy'
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "nuget" /* RegistryType.NUGET */);
            assert.strictEqual(result.mcpServerConfiguration.config.type, "stdio" /* McpServerType.LOCAL */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.strictEqual(result.mcpServerConfiguration.config.command, 'dnx');
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, ['Knapcode.SampleMcpServer@0.5.0', '--yes']);
                assert.deepStrictEqual(result.mcpServerConfiguration.config.env, { 'WEATHER_CHOICES': 'sunny,cloudy,rainy' });
            }
        });
        test('NuGet package with package arguments', () => {
            const manifest = {
                packages: [{
                        registryType: "nuget" /* RegistryType.NUGET */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        identifier: 'Knapcode.SampleMcpServer',
                        version: '0.4.0-beta',
                        packageArguments: [{
                                type: 'positional',
                                value: 'mcp',
                                valueHint: 'command',
                                isRepeated: false
                            }, {
                                type: 'positional',
                                value: 'start',
                                valueHint: 'action',
                                isRepeated: false
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "nuget" /* RegistryType.NUGET */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, [
                    'Knapcode.SampleMcpServer@0.4.0-beta',
                    '--yes',
                    '--',
                    'mcp',
                    'start'
                ]);
            }
        });
    });
    suite('Remote Server Tests', () => {
        test('SSE remote server configuration', () => {
            const manifest = {
                remotes: [{
                        type: "sse" /* TransportType.SSE */,
                        url: 'http://mcp-fs.anonymous.modelcontextprotocol.io/sse'
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "remote" /* RegistryType.REMOTE */);
            assert.strictEqual(result.mcpServerConfiguration.config.type, "http" /* McpServerType.REMOTE */);
            if (result.mcpServerConfiguration.config.type === "http" /* McpServerType.REMOTE */) {
                assert.strictEqual(result.mcpServerConfiguration.config.url, 'http://mcp-fs.anonymous.modelcontextprotocol.io/sse');
                assert.strictEqual(result.mcpServerConfiguration.config.headers, undefined);
            }
        });
        test('SSE remote server with headers and variables', () => {
            const manifest = {
                remotes: [{
                        type: "sse" /* TransportType.SSE */,
                        url: 'https://mcp.anonymous.modelcontextprotocol.io/sse',
                        headers: [{
                                name: 'X-API-Key',
                                value: '{api_key}',
                                variables: {
                                    api_key: {
                                        description: 'API key for authentication',
                                        isRequired: true,
                                        isSecret: true
                                    }
                                }
                            }, {
                                name: 'X-Region',
                                value: 'us-east-1'
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "remote" /* RegistryType.REMOTE */);
            assert.strictEqual(result.mcpServerConfiguration.config.type, "http" /* McpServerType.REMOTE */);
            if (result.mcpServerConfiguration.config.type === "http" /* McpServerType.REMOTE */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.headers, {
                    'X-API-Key': '${input:api_key}',
                    'X-Region': 'us-east-1'
                });
            }
            assert.strictEqual(result.mcpServerConfiguration.inputs?.length, 1);
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].id, 'api_key');
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].password, true);
        });
        test('streamable HTTP remote server', () => {
            const manifest = {
                remotes: [{
                        type: "streamable-http" /* TransportType.STREAMABLE_HTTP */,
                        url: 'https://mcp.anonymous.modelcontextprotocol.io/http'
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "remote" /* RegistryType.REMOTE */);
            assert.strictEqual(result.mcpServerConfiguration.config.type, "http" /* McpServerType.REMOTE */);
            if (result.mcpServerConfiguration.config.type === "http" /* McpServerType.REMOTE */) {
                assert.strictEqual(result.mcpServerConfiguration.config.url, 'https://mcp.anonymous.modelcontextprotocol.io/http');
            }
        });
        test('remote headers without values should create input variables', () => {
            const manifest = {
                remotes: [{
                        type: "sse" /* TransportType.SSE */,
                        url: 'https://api.example.com/mcp',
                        headers: [{
                                name: 'Authorization',
                                description: 'API token for authentication',
                                isSecret: true,
                                isRequired: true
                                // Note: No 'value' field - should create input variable
                            }, {
                                name: 'X-Custom-Header',
                                description: 'Custom header value',
                                default: 'default-value',
                                choices: ['option1', 'option2', 'option3']
                                // Note: No 'value' field - should create input variable with choices
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "remote" /* RegistryType.REMOTE */);
            assert.strictEqual(result.mcpServerConfiguration.config.type, "http" /* McpServerType.REMOTE */);
            if (result.mcpServerConfiguration.config.type === "http" /* McpServerType.REMOTE */) {
                assert.strictEqual(result.mcpServerConfiguration.config.url, 'https://api.example.com/mcp');
                assert.deepStrictEqual(result.mcpServerConfiguration.config.headers, {
                    'Authorization': '${input:Authorization}',
                    'X-Custom-Header': '${input:X-Custom-Header}'
                });
            }
            // Should create input variables for headers without values
            assert.strictEqual(result.mcpServerConfiguration.inputs?.length, 2);
            const authInput = result.mcpServerConfiguration.inputs?.find((i) => i.id === 'Authorization');
            assert.strictEqual(authInput?.description, 'API token for authentication');
            assert.strictEqual(authInput?.password, true);
            assert.strictEqual(authInput?.type, "promptString" /* McpServerVariableType.PROMPT */);
            const customInput = result.mcpServerConfiguration.inputs?.find((i) => i.id === 'X-Custom-Header');
            assert.strictEqual(customInput?.description, 'Custom header value');
            assert.strictEqual(customInput?.default, 'default-value');
            assert.strictEqual(customInput?.type, "pickString" /* McpServerVariableType.PICK */);
            assert.deepStrictEqual(customInput?.options, ['option1', 'option2', 'option3']);
        });
    });
    suite('Variable Interpolation Tests', () => {
        test('multiple variables in single value', () => {
            const manifest = {
                packages: [{
                        registryType: "npm" /* RegistryType.NODE */,
                        identifier: 'test-server',
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        version: '1.0.0',
                        environmentVariables: [{
                                name: 'CONNECTION_STRING',
                                value: 'server={host};port={port};database={db_name}',
                                variables: {
                                    host: {
                                        description: 'Database host',
                                        default: 'localhost'
                                    },
                                    port: {
                                        description: 'Database port',
                                        format: 'number',
                                        default: '5432'
                                    },
                                    db_name: {
                                        description: 'Database name',
                                        isRequired: true
                                    }
                                }
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.env, {
                    'CONNECTION_STRING': 'server=${input:host};port=${input:port};database=${input:db_name}'
                });
            }
            assert.strictEqual(result.mcpServerConfiguration.inputs?.length, 3);
            const hostInput = result.mcpServerConfiguration.inputs?.find((i) => i.id === 'host');
            assert.strictEqual(hostInput?.default, 'localhost');
            assert.strictEqual(hostInput?.type, "promptString" /* McpServerVariableType.PROMPT */);
            const portInput = result.mcpServerConfiguration.inputs?.find((i) => i.id === 'port');
            assert.strictEqual(portInput?.default, '5432');
            const dbNameInput = result.mcpServerConfiguration.inputs?.find((i) => i.id === 'db_name');
            assert.strictEqual(dbNameInput?.description, 'Database name');
        });
        test('variable with choices creates pick input', () => {
            const manifest = {
                packages: [{
                        registryType: "npm" /* RegistryType.NODE */,
                        identifier: 'test-server',
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        version: '1.0.0',
                        runtimeArguments: [{
                                type: 'named',
                                name: '--log-level',
                                value: '{level}',
                                isRepeated: false,
                                variables: {
                                    level: {
                                        description: 'Log level',
                                        choices: ['debug', 'info', 'warn', 'error'],
                                        default: 'info'
                                    }
                                }
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            assert.strictEqual(result.mcpServerConfiguration.inputs?.length, 1);
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].type, "pickString" /* McpServerVariableType.PICK */);
            assert.deepStrictEqual(result.mcpServerConfiguration.inputs?.[0].options, ['debug', 'info', 'warn', 'error']);
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].default, 'info');
        });
        test('variables in package arguments', () => {
            const manifest = {
                packages: [{
                        registryType: "oci" /* RegistryType.DOCKER */,
                        identifier: 'test-image',
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        version: '1.0.0',
                        packageArguments: [{
                                type: 'named',
                                name: '--host',
                                value: '{db_host}',
                                isRepeated: false,
                                variables: {
                                    db_host: {
                                        description: 'Database host',
                                        default: 'localhost'
                                    }
                                }
                            }, {
                                type: 'positional',
                                value: '{database_name}',
                                valueHint: 'database_name',
                                isRepeated: false,
                                variables: {
                                    database_name: {
                                        description: 'Name of the database to connect to',
                                        isRequired: true
                                    }
                                }
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "oci" /* RegistryType.DOCKER */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, [
                    'run', '-i', '--rm',
                    'test-image:1.0.0',
                    '--host', '${input:db_host}',
                    '${input:database_name}'
                ]);
            }
            assert.strictEqual(result.mcpServerConfiguration.inputs?.length, 2);
        });
        test('positional arguments with value_hint should create input variables (GitHub issue #266106)', () => {
            const manifest = {
                packages: [{
                        registryType: "npm" /* RegistryType.NODE */,
                        identifier: '@example/math-tool',
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        version: '2.0.1',
                        packageArguments: [{
                                type: 'positional',
                                valueHint: 'calculation_type',
                                description: 'Type of calculation to enable',
                                isRequired: true,
                                isRepeated: false
                                // Note: No 'value' field, only value_hint - should create input variable
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            // BUG: Currently value_hint is used as literal value instead of creating input variable
            // Should create input variable instead
            assert.strictEqual(result.mcpServerConfiguration.inputs?.length, 1);
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].id, 'calculation_type');
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].description, 'Type of calculation to enable');
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].type, "promptString" /* McpServerVariableType.PROMPT */);
            // Args should use input variable interpolation
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, [
                    '@example/math-tool@2.0.1',
                    '${input:calculation_type}'
                ]);
            }
        });
    });
    suite('Edge Cases and Error Handling', () => {
        test('empty manifest should throw error', () => {
            const manifest = {};
            assert.throws(() => {
                service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            }, /No server package found/);
        });
        test('manifest with no matching package type should use first package', () => {
            const manifest = {
                packages: [{
                        registryType: "pypi" /* RegistryType.PYTHON */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        identifier: 'python-server',
                        version: '1.0.0'
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            assert.strictEqual(result.mcpServerConfiguration.config.type, "stdio" /* McpServerType.LOCAL */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.strictEqual(result.mcpServerConfiguration.config.command, 'uvx'); // Python command since that's the package type
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, ['python-server==1.0.0']);
            }
        });
        test('manifest with matching package type should use that package', () => {
            const manifest = {
                packages: [{
                        registryType: "pypi" /* RegistryType.PYTHON */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        identifier: 'python-server',
                        version: '1.0.0'
                    }, {
                        registryType: "npm" /* RegistryType.NODE */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        identifier: 'node-server',
                        version: '2.0.0'
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.strictEqual(result.mcpServerConfiguration.config.command, 'npx');
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, ['node-server@2.0.0']);
            }
        });
        test('undefined environment variables should be omitted', () => {
            const manifest = {
                packages: [{
                        registryType: "npm" /* RegistryType.NODE */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        identifier: 'test-server',
                        version: '1.0.0'
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.strictEqual(result.mcpServerConfiguration.config.env, undefined);
            }
        });
        test('named argument without value should only add name', () => {
            const manifest = {
                packages: [{
                        registryType: "npm" /* RegistryType.NODE */,
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        identifier: 'test-server',
                        version: '1.0.0',
                        runtimeArguments: [{
                                type: 'named',
                                name: '--verbose',
                                isRepeated: false
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, ['--verbose', 'test-server@1.0.0']);
            }
        });
        test('positional argument with undefined value should use value_hint', () => {
            const manifest = {
                packages: [{
                        registryType: "npm" /* RegistryType.NODE */,
                        identifier: 'test-server',
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        version: '1.0.0',
                        packageArguments: [{
                                type: 'positional',
                                valueHint: 'target_directory',
                                isRepeated: false
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, ['test-server@1.0.0', 'target_directory']);
            }
        });
        test('named argument with no name should generate notice', () => {
            const manifest = {
                packages: [{
                        registryType: "npm" /* RegistryType.NODE */,
                        identifier: 'test-server',
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        version: '1.0.0',
                        runtimeArguments: [{
                                type: 'named',
                                value: 'some-value',
                                isRepeated: false
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            // Should generate a notice about the missing name
            assert.strictEqual(result.notices.length, 1);
            assert.ok(result.notices[0].includes('Named argument is missing a name'));
            assert.ok(result.notices[0].includes('some-value')); // Should include the argument details in JSON format
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, ['test-server@1.0.0']);
            }
        });
        test('named argument with empty name should generate notice', () => {
            const manifest = {
                packages: [{
                        registryType: "npm" /* RegistryType.NODE */,
                        identifier: 'test-server',
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        version: '1.0.0',
                        runtimeArguments: [{
                                type: 'named',
                                name: '',
                                value: 'some-value',
                                isRepeated: false
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            // Should generate a notice about the missing name
            assert.strictEqual(result.notices.length, 1);
            assert.ok(result.notices[0].includes('Named argument is missing a name'));
            assert.ok(result.notices[0].includes('some-value')); // Should include the argument details in JSON format
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.deepStrictEqual(result.mcpServerConfiguration.config.args, ['test-server@1.0.0']);
            }
        });
    });
    suite('Variable Processing Order', () => {
        test('should use explicit variables instead of auto-generating when both are possible', () => {
            const manifest = {
                packages: [{
                        registryType: "npm" /* RegistryType.NODE */,
                        identifier: 'test-server',
                        transport: { type: "stdio" /* TransportType.STDIO */ },
                        version: '1.0.0',
                        environmentVariables: [{
                                name: 'API_KEY',
                                value: 'Bearer {api_key}',
                                description: 'Should not be used', // This should be ignored since we have explicit variables
                                variables: {
                                    api_key: {
                                        description: 'Your API key',
                                        isSecret: true
                                    }
                                }
                            }]
                    }]
            };
            const result = service.getMcpServerConfigurationFromManifest(manifest, "npm" /* RegistryType.NODE */);
            assert.strictEqual(result.mcpServerConfiguration.inputs?.length, 1);
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].id, 'api_key');
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].description, 'Your API key');
            assert.strictEqual(result.mcpServerConfiguration.inputs?.[0].password, true);
            if (result.mcpServerConfiguration.config.type === "stdio" /* McpServerType.LOCAL */) {
                assert.strictEqual(result.mcpServerConfiguration.config.env?.['API_KEY'], 'Bearer ${input:api_key}');
            }
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwTWFuYWdlbWVudFNlcnZpY2UudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9tY3AvdGVzdC9jb21tb24vbWNwTWFuYWdlbWVudFNlcnZpY2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEcsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFJMUYsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRXpELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUU1RCxNQUFNLHdCQUF5QixTQUFRLGtDQUFrQztJQUF6RTs7UUFFVSx1QkFBa0IsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1FBQ2hDLDJCQUFzQixHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7UUFDcEMsMEJBQXFCLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztRQUNuQyx5QkFBb0IsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO1FBQ2xDLDRCQUF1QixHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7SUFxQi9DLENBQUM7SUFuQlMsWUFBWSxDQUFDLFdBQWlCO1FBQ3RDLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ1EsT0FBTyxDQUFDLE1BQTZCLEVBQUUsT0FBd0I7UUFDdkUsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDUSxrQkFBa0IsQ0FBQyxNQUF5QixFQUFFLE9BQXdCO1FBQzlFLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFD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