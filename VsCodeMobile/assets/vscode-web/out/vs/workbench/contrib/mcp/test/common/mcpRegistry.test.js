/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import * as sinon from 'sinon';
import { timeout } from '../../../../../base/common/async.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { upcast } from '../../../../../base/common/types.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILoggerService, ILogService, NullLogger, NullLogService } from '../../../../../platform/log/common/log.js';
import { mcpAccessConfig } from '../../../../../platform/mcp/common/mcpManagement.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { ISecretStorageService } from '../../../../../platform/secrets/common/secrets.js';
import { TestSecretStorageService } from '../../../../../platform/secrets/test/common/testSecretStorageService.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IConfigurationResolverService } from '../../../../services/configurationResolver/common/configurationResolver.js';
import { ConfigurationResolverExpression } from '../../../../services/configurationResolver/common/configurationResolverExpression.js';
import { IOutputService } from '../../../../services/output/common/output.js';
import { TestLoggerService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { McpRegistry } from '../../common/mcpRegistry.js';
import { McpStartServerInteraction } from '../../common/mcpTypes.js';
import { TestMcpMessageTransport } from './mcpRegistryTypes.js';
class TestConfigurationResolverService {
    constructor() {
        this.interactiveCounter = 0;
        // Used to simulate stored/resolved variables
        this.resolvedVariables = new Map();
        // Add some test variables
        this.resolvedVariables.set('workspaceFolder', '/test/workspace');
        this.resolvedVariables.set('fileBasename', 'test.txt');
    }
    resolveAsync(folder, value) {
        const parsed = ConfigurationResolverExpression.parse(value);
        for (const variable of parsed.unresolved()) {
            const resolved = this.resolvedVariables.get(variable.inner);
            if (resolved) {
                parsed.resolve(variable, resolved);
            }
        }
        return Promise.resolve(parsed.toObject());
    }
    resolveWithInteraction(folder, config, section, variables, target) {
        const parsed = ConfigurationResolverExpression.parse(config);
        // For testing, we simulate interaction by returning a map with some variables
        const result = new Map();
        result.set('input:testInteractive', `interactiveValue${this.interactiveCounter++}`);
        result.set('command:testCommand', `commandOutput${this.interactiveCounter++}}`);
        // If variables are provided, include those too
        for (const [k, v] of result.entries()) {
            const replacement = {
                id: '${' + k + '}',
                inner: k,
                name: k.split(':')[0] || k,
                arg: k.split(':')[1]
            };
            parsed.resolve(replacement, v);
        }
        return Promise.resolve(result);
    }
}
class TestMcpHostDelegate {
    constructor() {
        this.priority = 0;
    }
    substituteVariables(serverDefinition, launch) {
        return Promise.resolve(launch);
    }
    canStart() {
        return true;
    }
    start() {
        return new TestMcpMessageTransport();
    }
    waitForInitialProviderPromises() {
        return Promise.resolve();
    }
}
class TestDialogService {
    constructor() {
        this._promptResult = true;
        this._promptSpy = sinon.stub();
        this._promptSpy.callsFake(() => {
            return Promise.resolve({ result: this._promptResult });
        });
    }
    setPromptResult(result) {
        this._promptResult = result;
    }
    get promptSpy() {
        return this._promptSpy;
    }
    prompt(options) {
        return this._promptSpy(options);
    }
}
class TestMcpRegistry extends McpRegistry {
    _promptForTrustOpenDialog() {
        return Promise.resolve(this.nextDefinitionIdsToTrust);
    }
}
suite('Workbench - MCP - Registry', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let registry;
    let testStorageService;
    let testConfigResolverService;
    let testDialogService;
    let testCollection;
    let baseDefinition;
    let configurationService;
    let logger;
    let trustNonceBearer;
    setup(() => {
        testConfigResolverService = new TestConfigurationResolverService();
        testStorageService = store.add(new TestStorageService());
        testDialogService = new TestDialogService();
        configurationService = new TestConfigurationService({ [mcpAccessConfig]: "all" /* McpAccessValue.All */ });
        trustNonceBearer = { trustedAtNonce: undefined };
        const services = new ServiceCollection([IConfigurationService, configurationService], [IConfigurationResolverService, testConfigResolverService], [IStorageService, testStorageService], [ISecretStorageService, new TestSecretStorageService()], [ILoggerService, store.add(new TestLoggerService())], [ILogService, store.add(new NullLogService())], [IOutputService, upcast({ showChannel: () => { } })], [IDialogService, testDialogService], [IProductService, {}]);
        logger = new NullLogger();
        const instaService = store.add(new TestInstantiationService(services));
        registry = store.add(instaService.createInstance(TestMcpRegistry));
        // Create test collection that can be reused
        testCollection = {
            id: 'test-collection',
            label: 'Test Collection',
            remoteAuthority: null,
            serverDefinitions: observableValue('serverDefs', []),
            trustBehavior: 0 /* McpServerTrust.Kind.Trusted */,
            scope: -1 /* StorageScope.APPLICATION */,
            configTarget: 2 /* ConfigurationTarget.USER */,
        };
        // Create base definition that can be reused
        baseDefinition = {
            id: 'test-server',
            label: 'Test Server',
            cacheNonce: 'a',
            launch: {
                type: 1 /* McpServerTransportType.Stdio */,
                command: 'test-command',
                args: [],
                env: {},
                envFile: undefined,
                cwd: '/test',
            }
        };
    });
    test('registerCollection adds collection to registry', () => {
        const disposable = registry.registerCollection(testCollection);
        store.add(disposable);
        assert.strictEqual(registry.collections.get().length, 1);
        assert.strictEqual(registry.collections.get()[0], testCollection);
        disposable.dispose();
        assert.strictEqual(registry.collections.get().length, 0);
    });
    test('collections are not visible when not enabled', () => {
        const disposable = registry.registerCollection(testCollection);
        store.add(disposable);
        assert.strictEqual(registry.collections.get().length, 1);
        configurationService.setUserConfiguration(mcpAccessConfig, "none" /* McpAccessValue.None */);
        configurationService.onDidChangeConfigurationEmitter.fire({
            affectsConfiguration: () => true,
            affectedKeys: new Set([mcpAccessConfig]),
            change: { keys: [mcpAccessConfig], overrides: [] },
            source: 2 /* ConfigurationTarget.USER */
        });
        assert.strictEqual(registry.collections.get().length, 0);
        configurationService.setUserConfiguration(mcpAccessConfig, "all" /* McpAccessValue.All */);
        configurationService.onDidChangeConfigurationEmitter.fire({
            affectsConfiguration: () => true,
            affectedKeys: new Set([mcpAccessConfig]),
            change: { keys: [mcpAccessConfig], overrides: [] },
            source: 2 /* ConfigurationTarget.USER */
        });
    });
    test('registerDelegate adds delegate to registry', () => {
        const delegate = new TestMcpHostDelegate();
        const disposable = registry.registerDelegate(delegate);
        store.add(disposable);
        assert.strictEqual(registry.delegates.get().length, 1);
        assert.strictEqual(registry.delegates.get()[0], delegate);
        disposable.dispose();
        assert.strictEqual(registry.delegates.get().length, 0);
    });
    test('resolveConnection creates connection with resolved variables and memorizes them until cleared', async () => {
        const definition = {
            ...baseDefinition,
            launch: {
                type: 1 /* McpServerTransportType.Stdio */,
                command: '${workspaceFolder}/cmd',
                args: ['--file', '${fileBasename}'],
                env: {
                    PATH: '${input:testInteractive}'
                },
                envFile: undefined,
                cwd: '/test',
            },
            variableReplacement: {
                section: 'mcp',
                target: 5 /* ConfigurationTarget.WORKSPACE */,
            }
        };
        const delegate = new TestMcpHostDelegate();
        store.add(registry.registerDelegate(delegate));
        testCollection.serverDefinitions.set([definition], undefined);
        store.add(registry.registerCollection(testCollection));
        const connection = await registry.resolveConnection({ collectionRef: testCollection, definitionRef: definition, logger, trustNonceBearer });
        assert.ok(connection);
        assert.strictEqual(connection.definition, definition);
        assert.strictEqual(connection.launchDefinition.command, '/test/workspace/cmd');
        assert.strictEqual(connection.launchDefinition.env.PATH, 'interactiveValue0');
        connection.dispose();
        const connection2 = await registry.resolveConnection({ collectionRef: testCollection, definitionRef: definition, logger, trustNonceBearer });
        assert.ok(connection2);
        assert.strictEqual(connection2.launchDefinition.env.PATH, 'interactiveValue0');
        connection2.dispose();
        registry.clearSavedInputs(1 /* StorageScope.WORKSPACE */);
        const connection3 = await registry.resolveConnection({ collectionRef: testCollection, definitionRef: definition, logger, trustNonceBearer });
        assert.ok(connection3);
        assert.strictEqual(connection3.launchDefinition.env.PATH, 'interactiveValue4');
        connection3.dispose();
    });
    test('resolveConnection uses user-provided launch configuration', async () => {
        // Create a collection with custom launch resolver
        const customCollection = {
            ...testCollection,
            resolveServerLanch: async (def) => {
                return {
                    ...def.launch,
                    env: { CUSTOM_ENV: 'value' },
                };
            }
        };
        // Create a definition with variable replacement
        const definition = {
            ...baseDefinition,
            variableReplacement: {
                section: 'mcp',
                target: 5 /* ConfigurationTarget.WORKSPACE */,
            }
        };
        const delegate = new TestMcpHostDelegate();
        store.add(registry.registerDelegate(delegate));
        testCollection.serverDefinitions.set([definition], undefined);
        store.add(registry.registerCollection(customCollection));
        // Resolve connection should use the custom launch configuration
        const connection = await registry.resolveConnection({
            collectionRef: customCollection,
            definitionRef: definition,
            logger,
            trustNonceBearer,
        });
        assert.ok(connection);
        // Verify the launch configuration passed to _replaceVariablesInLaunch was the custom one
        assert.deepStrictEqual(connection.launchDefinition.env, { CUSTOM_ENV: 'value' });
        connection.dispose();
    });
    suite('Lazy Collections', () => {
        let lazyCollection;
        let normalCollection;
        let removedCalled;
        setup(() => {
            removedCalled = false;
            lazyCollection = {
                ...testCollection,
                id: 'lazy-collection',
                lazy: {
                    isCached: false,
                    load: () => Promise.resolve(),
                    removed: () => { removedCalled = true; }
                }
            };
            normalCollection = {
                ...testCollection,
                id: 'lazy-collection',
                serverDefinitions: observableValue('serverDefs', [baseDefinition])
            };
        });
        test('registers lazy collection', () => {
            const disposable = registry.registerCollection(lazyCollection);
            store.add(disposable);
            assert.strictEqual(registry.collections.get().length, 1);
            assert.strictEqual(registry.collections.get()[0], lazyCollection);
            assert.strictEqual(registry.lazyCollectionState.get().state, 0 /* LazyCollectionState.HasUnknown */);
        });
        test('lazy collection is replaced by normal collection', () => {
            store.add(registry.registerCollection(lazyCollection));
            store.add(registry.registerCollection(normalCollection));
            const collections = registry.collections.get();
            assert.strictEqual(collections.length, 1);
            assert.strictEqual(collections[0], normalCollection);
            assert.strictEqual(collections[0].lazy, undefined);
            assert.strictEqual(registry.lazyCollectionState.get().state, 2 /* LazyCollectionState.AllKnown */);
        });
        test('lazyCollectionState updates correctly during loading', async () => {
            lazyCollection = {
                ...lazyCollection,
                lazy: {
                    ...lazyCollection.lazy,
                    load: async () => {
                        await timeout(0);
                        store.add(registry.registerCollection(normalCollection));
                        return Promise.resolve();
                    }
                }
            };
            store.add(registry.registerCollection(lazyCollection));
            assert.strictEqual(registry.lazyCollectionState.get().state, 0 /* LazyCollectionState.HasUnknown */);
            const loadingPromise = registry.discoverCollections();
            assert.strictEqual(registry.lazyCollectionState.get().state, 1 /* LazyCollectionState.LoadingUnknown */);
            await loadingPromise;
            // The collection wasn't replaced, so it should be removed
            assert.strictEqual(registry.collections.get().length, 1);
            assert.strictEqual(registry.lazyCollectionState.get().state, 2 /* LazyCollectionState.AllKnown */);
            assert.strictEqual(removedCalled, false);
        });
        test('removed callback is called when lazy collection is not replaced', async () => {
            store.add(registry.registerCollection(lazyCollection));
            await registry.discoverCollections();
            assert.strictEqual(removedCalled, true);
        });
        test('cached lazy collections are tracked correctly', () => {
            lazyCollection.lazy.isCached = true;
            store.add(registry.registerCollection(lazyCollection));
            assert.strictEqual(registry.lazyCollectionState.get().state, 2 /* LazyCollectionState.AllKnown */);
            // Adding an uncached lazy collection changes the state
            const uncachedLazy = {
                ...lazyCollection,
                id: 'uncached-lazy',
                lazy: {
                    ...lazyCollection.lazy,
                    isCached: false
                }
            };
            store.add(registry.registerCollection(uncachedLazy));
            assert.strictEqual(registry.lazyCollectionState.get().state, 0 /* LazyCollectionState.HasUnknown */);
        });
    });
    suite('Trust Flow', () => {
        /**
         * Helper to create a test MCP collection with a specific trust behavior
         */
        function createTestCollection(trustBehavior, id = 'test-collection') {
            return {
                id,
                label: 'Test Collection',
                remoteAuthority: null,
                serverDefinitions: observableValue('serverDefs', []),
                trustBehavior,
                scope: -1 /* StorageScope.APPLICATION */,
                configTarget: 2 /* ConfigurationTarget.USER */,
            };
        }
        /**
         * Helper to create a test server definition with a specific cache nonce
         */
        function createTestDefinition(id = 'test-server', cacheNonce = 'nonce-a') {
            return {
                id,
                label: 'Test Server',
                cacheNonce,
                launch: {
                    type: 1 /* McpServerTransportType.Stdio */,
                    command: 'test-command',
                    args: [],
                    env: {},
                    envFile: undefined,
                    cwd: '/test',
                }
            };
        }
        /**
         * Helper to set up a basic registry with delegate and collection
         */
        function setupRegistry(trustBehavior = 1 /* McpServerTrust.Kind.TrustedOnNonce */, cacheNonce = 'nonce-a') {
            const delegate = new TestMcpHostDelegate();
            store.add(registry.registerDelegate(delegate));
            const collection = createTestCollection(trustBehavior);
            const definition = createTestDefinition('test-server', cacheNonce);
            collection.serverDefinitions.set([definition], undefined);
            store.add(registry.registerCollection(collection));
            return { collection, definition, delegate };
        }
        test('trusted collection allows connection without prompting', async () => {
            const { collection, definition } = setupRegistry(0 /* McpServerTrust.Kind.Trusted */);
            const connection = await registry.resolveConnection({
                collectionRef: collection,
                definitionRef: definition,
                logger,
                trustNonceBearer,
            });
            assert.ok(connection, 'Connection should be created for trusted collection');
            assert.strictEqual(registry.nextDefinitionIdsToTrust, undefined, 'Trust dialog should not have been called');
            connection.dispose();
        });
        test('nonce-based trust allows connection when nonce matches', async () => {
            const { collection, definition } = setupRegistry(1 /* McpServerTrust.Kind.TrustedOnNonce */, 'nonce-a');
            trustNonceBearer.trustedAtNonce = 'nonce-a';
            const connection = await registry.resolveConnection({
                collectionRef: collection,
                definitionRef: definition,
                logger,
                trustNonceBearer,
            });
            assert.ok(connection, 'Connection should be created when nonce matches');
            assert.strictEqual(registry.nextDefinitionIdsToTrust, undefined, 'Trust dialog should not have been called');
            connection.dispose();
        });
        test('nonce-based trust prompts when nonce changes', async () => {
            const { collection, definition } = setupRegistry(1 /* McpServerTrust.Kind.TrustedOnNonce */, 'nonce-b');
            trustNonceBearer.trustedAtNonce = 'nonce-a'; // Different nonce
            registry.nextDefinitionIdsToTrust = [definition.id]; // User trusts the server
            const connection = await registry.resolveConnection({
                collectionRef: collection,
                definitionRef: definition,
                logger,
                trustNonceBearer,
            });
            assert.ok(connection, 'Connection should be created when user trusts');
            assert.strictEqual(trustNonceBearer.trustedAtNonce, 'nonce-b', 'Nonce should be updated');
            connection.dispose();
        });
        test('nonce-based trust denies connection when user rejects', async () => {
            const { collection, definition } = setupRegistry(1 /* McpServerTrust.Kind.TrustedOnNonce */, 'nonce-b');
            trustNonceBearer.trustedAtNonce = 'nonce-a'; // Different nonce
            registry.nextDefinitionIdsToTrust = []; // User does not trust the server
            const connection = await registry.resolveConnection({
                collectionRef: collection,
                definitionRef: definition,
                logger,
                trustNonceBearer,
            });
            assert.strictEqual(connection, undefined, 'Connection should not be created when user rejects');
            assert.strictEqual(trustNonceBearer.trustedAtNonce, '__vscode_not_trusted', 'Should mark as explicitly not trusted');
        });
        test('autoTrustChanges bypasses prompt when nonce changes', async () => {
            const { collection, definition } = setupRegistry(1 /* McpServerTrust.Kind.TrustedOnNonce */, 'nonce-b');
            trustNonceBearer.trustedAtNonce = 'nonce-a'; // Different nonce
            const connection = await registry.resolveConnection({
                collectionRef: collection,
                definitionRef: definition,
                logger,
                trustNonceBearer,
                autoTrustChanges: true,
            });
            assert.ok(connection, 'Connection should be created with autoTrustChanges');
            assert.strictEqual(trustNonceBearer.trustedAtNonce, 'nonce-b', 'Nonce should be updated');
            assert.strictEqual(registry.nextDefinitionIdsToTrust, undefined, 'Trust dialog should not have been called');
            connection.dispose();
        });
        test('promptType "never" skips prompt and fails silently', async () => {
            const { collection, definition } = setupRegistry(1 /* McpServerTrust.Kind.TrustedOnNonce */, 'nonce-b');
            trustNonceBearer.trustedAtNonce = 'nonce-a'; // Different nonce
            const connection = await registry.resolveConnection({
                collectionRef: collection,
                definitionRef: definition,
                logger,
                trustNonceBearer,
                promptType: 'never',
            });
            assert.strictEqual(connection, undefined, 'Connection should not be created with promptType "never"');
            assert.strictEqual(registry.nextDefinitionIdsToTrust, undefined, 'Trust dialog should not have been called');
        });
        test('promptType "only-new" skips previously untrusted servers', async () => {
            const { collection, definition } = setupRegistry(1 /* McpServerTrust.Kind.TrustedOnNonce */, 'nonce-b');
            trustNonceBearer.trustedAtNonce = '__vscode_not_trusted'; // Previously explicitly denied
            const connection = await registry.resolveConnection({
                collectionRef: collection,
                definitionRef: definition,
                logger,
                trustNonceBearer,
                promptType: 'only-new',
            });
            assert.strictEqual(connection, undefined, 'Connection should not be created for previously untrusted server');
            assert.strictEqual(registry.nextDefinitionIdsToTrust, undefined, 'Trust dialog should not have been called');
        });
        test('promptType "all-untrusted" prompts for previously untrusted servers', async () => {
            const { collection, definition } = setupRegistry(1 /* McpServerTrust.Kind.TrustedOnNonce */, 'nonce-b');
            trustNonceBearer.trustedAtNonce = '__vscode_not_trusted'; // Previously explicitly denied
            registry.nextDefinitionIdsToTrust = [definition.id]; // User now trusts the server
            const connection = await registry.resolveConnection({
                collectionRef: collection,
                definitionRef: definition,
                logger,
                trustNonceBearer,
                promptType: 'all-untrusted',
            });
            assert.ok(connection, 'Connection should be created when user trusts previously untrusted server');
            assert.strictEqual(trustNonceBearer.trustedAtNonce, 'nonce-b', 'Nonce should be updated');
            connection.dispose();
        });
        test('concurrent resolveConnection calls with same interaction are grouped', async () => {
            const { collection, definition } = setupRegistry(1 /* McpServerTrust.Kind.TrustedOnNonce */, 'nonce-b');
            trustNonceBearer.trustedAtNonce = 'nonce-a'; // Different nonce
            // Create a second definition that also needs trust
            const definition2 = createTestDefinition('test-server-2', 'nonce-c');
            collection.serverDefinitions.set([definition, definition2], undefined);
            // Create shared interaction
            const interaction = new McpStartServerInteraction();
            // Manually set participants as mentioned in the requirements
            interaction.participants.set(definition.id, { s: 'unknown' });
            interaction.participants.set(definition2.id, { s: 'unknown' });
            const trustNonceBearer2 = { trustedAtNonce: 'nonce-b' }; // Different nonce for second server
            // Trust both servers
            registry.nextDefinitionIdsToTrust = [definition.id, definition2.id];
            // Start both connections concurrently with the same interaction
            const [connection1, connection2] = await Promise.all([
                registry.resolveConnection({
                    collectionRef: collection,
                    definitionRef: definition,
                    logger,
                    trustNonceBearer,
                    interaction,
                }),
                registry.resolveConnection({
                    collectionRef: collection,
                    definitionRef: definition2,
                    logger,
                    trustNonceBearer: trustNonceBearer2,
                    interaction,
                })
            ]);
            assert.ok(connection1, 'First connection should be created');
            assert.ok(connection2, 'Second connection should be created');
            assert.strictEqual(trustNonceBearer.trustedAtNonce, 'nonce-b', 'First nonce should be updated');
            assert.strictEqual(trustNonceBearer2.trustedAtNonce, 'nonce-c', 'Second nonce should be updated');
            connection1.dispose();
            connection2.dispose();
        });
        test('user cancelling trust dialog returns undefined for all pending connections', async () => {
            const { collection, definition } = setupRegistry(1 /* McpServerTrust.Kind.TrustedOnNonce */, 'nonce-b');
            trustNonceBearer.trustedAtNonce = 'nonce-a'; // Different nonce
            // Create a second definition that also needs trust
            const definition2 = createTestDefinition('test-server-2', 'nonce-c');
            collection.serverDefinitions.set([definition, definition2], undefined);
            // Create shared interaction
            const interaction = new McpStartServerInteraction();
            // Manually set participants as mentioned in the requirements
            interaction.participants.set(definition.id, { s: 'unknown' });
            interaction.participants.set(definition2.id, { s: 'unknown' });
            const trustNonceBearer2 = { trustedAtNonce: 'nonce-b' }; // Different nonce for second server
            // User cancels the dialog
            registry.nextDefinitionIdsToTrust = undefined;
            // Start both connections concurrently with the same interaction
            const [connection1, connection2] = await Promise.all([
                registry.resolveConnection({
                    collectionRef: collection,
                    definitionRef: definition,
                    logger,
                    trustNonceBearer,
                    interaction,
                }),
                registry.resolveConnection({
                    collectionRef: collection,
                    definitionRef: definition2,
                    logger,
                    trustNonceBearer: trustNonceBearer2,
                    interaction,
                })
            ]);
            assert.strictEqual(connection1, undefined, 'First connection should not be created when user cancels');
            assert.strictEqual(connection2, undefined, 'Second connection should not be created when user cancels');
        });
        test('partial trust selection in grouped interaction', async () => {
            const { collection, definition } = setupRegistry(1 /* McpServerTrust.Kind.TrustedOnNonce */, 'nonce-b');
            trustNonceBearer.trustedAtNonce = 'nonce-a'; // Different nonce
            // Create a second definition that also needs trust
            const definition2 = createTestDefinition('test-server-2', 'nonce-c');
            collection.serverDefinitions.set([definition, definition2], undefined);
            // Create shared interaction
            const interaction = new McpStartServerInteraction();
            // Manually set participants as mentioned in the requirements
            interaction.participants.set(definition.id, { s: 'unknown' });
            interaction.participants.set(definition2.id, { s: 'unknown' });
            const trustNonceBearer2 = { trustedAtNonce: 'nonce-b' }; // Different nonce for second server
            // User trusts only the first server
            registry.nextDefinitionIdsToTrust = [definition.id];
            // Start both connections concurrently with the same interaction
            const [connection1, connection2] = await Promise.all([
                registry.resolveConnection({
                    collectionRef: collection,
                    definitionRef: definition,
                    logger,
                    trustNonceBearer,
                    interaction,
                }),
                registry.resolveConnection({
                    collectionRef: collection,
                    definitionRef: definition2,
                    logger,
                    trustNonceBearer: trustNonceBearer2,
                    interaction,
                })
            ]);
            assert.ok(connection1, 'First connection should be created when trusted');
            assert.strictEqual(connection2, undefined, 'Second connection should not be created when not trusted');
            assert.strictEqual(trustNonceBearer.trustedAtNonce, 'nonce-b', 'First nonce should be updated');
            assert.strictEqual(trustNonceBearer2.trustedAtNonce, '__vscode_not_trusted', 'Second nonce should be marked as not trusted');
            connection1.dispose();
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwUmVnaXN0cnkudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvdGVzdC9jb21tb24vbWNwUmVnaXN0cnkudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUNqQyxPQUFPLEtBQUssS0FBSyxNQUFNLE9BQU8sQ0FBQztBQUMvQixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUF1QixlQUFlLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNoRyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDN0QsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFrRCxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RKLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLCtFQUErRSxDQUFDO0FBQ3pILE9BQU8sRUFBRSxjQUFjLEVBQVcsTUFBTSxtREFBbUQsQ0FBQztBQUM1RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUN0RyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUN6SCxPQUFPLEVBQVcsY0FBYyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDN0gsT0FBTyxFQUFFLGVBQWUsRUFBa0IsTUFBTSxxREFBcUQsQ0FBQztBQUN0RyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDM0YsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDMUYsT0FBTyxFQUFFLHdCQUF3QixFQUFF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