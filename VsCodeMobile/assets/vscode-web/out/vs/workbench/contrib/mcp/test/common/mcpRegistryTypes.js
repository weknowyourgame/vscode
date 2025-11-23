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
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { LogLevel, NullLogger } from '../../../../../platform/log/common/log.js';
import { McpServerConnection } from '../../common/mcpServerConnection.js';
import { MCP } from '../../common/modelContextProtocol.js';
/**
 * Implementation of IMcpMessageTransport for testing purposes.
 * Allows tests to easily send/receive messages and control the connection state.
 */
export class TestMcpMessageTransport extends Disposable {
    constructor() {
        super();
        this._onDidLog = this._register(new Emitter());
        this.onDidLog = this._onDidLog.event;
        this._onDidReceiveMessage = this._register(new Emitter());
        this.onDidReceiveMessage = this._onDidReceiveMessage.event;
        this._stateValue = observableValue('testTransportState', { state: 1 /* McpConnectionState.Kind.Starting */ });
        this.state = this._stateValue;
        this._sentMessages = [];
        this.setResponder('initialize', () => ({
            jsonrpc: MCP.JSONRPC_VERSION,
            id: 1, // The handler uses 1 for the first request
            result: {
                protocolVersion: MCP.LATEST_PROTOCOL_VERSION,
                serverInfo: {
                    name: 'Test MCP Server',
                    version: '1.0.0',
                },
                capabilities: {
                    resources: {
                        supportedTypes: ['text/plain'],
                    },
                    tools: {
                        supportsCancellation: true,
                    }
                }
            }
        }));
    }
    /**
     * Set a responder function for a specific method.
     * The responder receives the sent message and should return a response object,
     * which will be simulated as a server response.
     */
    setResponder(method, responder) {
        if (!this._responders) {
            this._responders = new Map();
        }
        this._responders.set(method, responder);
    }
    /**
     * Send a message through the transport.
     */
    send(message) {
        this._sentMessages.push(message);
        if (this._responders && 'method' in message && typeof message.method === 'string') {
            const responder = this._responders.get(message.method);
            if (responder) {
                const response = responder(message);
                if (response) {
                    setTimeout(() => this.simulateReceiveMessage(response));
                }
            }
        }
    }
    /**
     * Stop the transport.
     */
    stop() {
        this._stateValue.set({ state: 0 /* McpConnectionState.Kind.Stopped */ }, undefined);
    }
    // Test Helper Methods
    /**
     * Simulate receiving a message from the server.
     */
    simulateReceiveMessage(message) {
        this._onDidReceiveMessage.fire(message);
    }
    /**
     * Simulates a reply to an 'initialized' request.
     */
    simulateInitialized() {
        if (!this._sentMessages.length) {
            throw new Error('initialize was not called yet');
        }
        this.simulateReceiveMessage({
            jsonrpc: MCP.JSONRPC_VERSION,
            id: this.getSentMessages()[0].id,
            result: {
                protocolVersion: MCP.LATEST_PROTOCOL_VERSION,
                capabilities: {
                    tools: {},
                },
                serverInfo: {
                    name: 'Test Server',
                    version: '1.0.0'
                },
            }
        });
    }
    /**
     * Simulate a log event.
     */
    simulateLog(message) {
        this._onDidLog.fire({ level: LogLevel.Info, message });
    }
    /**
     * Set the connection state.
     */
    setConnectionState(state) {
        this._stateValue.set(state, undefined);
    }
    /**
     * Get all messages that have been sent.
     */
    getSentMessages() {
        return [...this._sentMessages];
    }
    /**
     * Clear the sent messages history.
     */
    clearSentMessages() {
        this._sentMessages.length = 0;
    }
}
let TestMcpRegistry = class TestMcpRegistry {
    constructor(_instantiationService) {
        this._instantiationService = _instantiationService;
        this.makeTestTransport = () => new TestMcpMessageTransport();
        this.onDidChangeInputs = Event.None;
        this.collections = observableValue(this, [{
                id: 'test-collection',
                remoteAuthority: null,
                label: 'Test Collection',
                configTarget: 2 /* ConfigurationTarget.USER */,
                serverDefinitions: observableValue(this, [{
                        id: 'test-server',
                        label: 'Test Server',
                        launch: { type: 1 /* McpServerTransportType.Stdio */, command: 'echo', args: ['Hello MCP'], env: {}, envFile: undefined, cwd: undefined },
                        cacheNonce: 'a',
                    }]),
                trustBehavior: 0 /* McpServerTrust.Kind.Trusted */,
                scope: -1 /* StorageScope.APPLICATION */,
            }]);
        this.delegates = observableValue(this, [{
                priority: 0,
                canStart: () => true,
                substituteVariables(serverDefinition, launch) {
                    return Promise.resolve(launch);
                },
                start: () => {
                    const t = this.makeTestTransport();
                    setTimeout(() => t.setConnectionState({ state: 2 /* McpConnectionState.Kind.Running */ }));
                    return t;
                },
                waitForInitialProviderPromises: () => Promise.resolve(),
            }]);
        this.lazyCollectionState = observableValue(this, { state: 2 /* LazyCollectionState.AllKnown */, collections: [] });
    }
    collectionToolPrefix(collection) {
        return observableValue(this, `mcp-${collection.id}-`);
    }
    getServerDefinition(collectionRef, definitionRef) {
        const collectionObs = this.collections.map(cols => cols.find(c => c.id === collectionRef.id));
        return collectionObs.map((collection, reader) => {
            const server = collection?.serverDefinitions.read(reader).find(s => s.id === definitionRef.id);
            return { collection, server };
        });
    }
    discoverCollections() {
        throw new Error('Method not implemented.');
    }
    registerDelegate(delegate) {
        throw new Error('Method not implemented.');
    }
    registerCollection(collection) {
        throw new Error('Method not implemented.');
    }
    resetTrust() {
        throw new Error('Method not implemented.');
    }
    clearSavedInputs(scope, inputId) {
        throw new Error('Method not implemented.');
    }
    editSavedInput(inputId, folderData, configSection, target) {
        throw new Error('Method not implemented.');
    }
    setSavedInput(inputId, target, value) {
        throw new Error('Method not implemented.');
    }
    getSavedInputs(scope) {
        throw new Error('Method not implemented.');
    }
    resolveConnection(options) {
        const collection = this.collections.get().find(c => c.id === options.collectionRef.id);
        const definition = collection?.serverDefinitions.get().find(d => d.id === options.definitionRef.id);
        if (!collection || !definition) {
            throw new Error(`Collection or definition not found: ${options.collectionRef.id}, ${options.definitionRef.id}`);
        }
        const del = this.delegates.get()[0];
        return Promise.resolve(new McpServerConnection(collection, definition, del, definition.launch, new NullLogger(), false, this._instantiationService));
    }
};
TestMcpRegistry = __decorate([
    __param(0, IInstantiationService)
], TestMcpRegistry);
export { TestMcpRegistry };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwUmVnaXN0cnlUeXBlcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvdGVzdC9jb21tb24vbWNwUmVnaXN0cnlUeXBlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNsRixPQUFPLEVBQWUsZUFBZSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFeEYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUtqRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUUxRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFM0Q7OztHQUdHO0FBQ0gsTUFBTSxPQUFPLHVCQUF3QixTQUFRLFVBQVU7SUFZdEQ7UUFDQyxLQUFLLEVBQUUsQ0FBQztRQVpRLGNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUF3QyxDQUFDLENBQUM7UUFDakYsYUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDO1FBRS9CLHlCQUFvQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQXNCLENBQUMsQ0FBQztRQUMxRSx3QkFBbUIsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDO1FBRXJELGdCQUFXLEdBQUcsZUFBZSxDQUFxQixvQkFBb0IsRUFBRSxFQUFFLEtBQUssMENBQWtDLEVBQUUsQ0FBQyxDQUFDO1FBQ3RI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