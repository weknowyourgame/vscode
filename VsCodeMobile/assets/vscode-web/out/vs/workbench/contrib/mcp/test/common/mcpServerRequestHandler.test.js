/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { upcast } from '../../../../../base/common/types.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILoggerService } from '../../../../../platform/log/common/log.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { TestLoggerService, TestProductService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { McpServerRequestHandler } from '../../common/mcpServerRequestHandler.js';
import { MCP } from '../../common/modelContextProtocol.js';
import { TestMcpMessageTransport } from './mcpRegistryTypes.js';
import { IOutputService } from '../../../../services/output/common/output.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
class TestMcpHostDelegate extends Disposable {
    constructor() {
        super();
        this.priority = 0;
        this._transport = this._register(new TestMcpMessageTransport());
    }
    substituteVariables(serverDefinition, launch) {
        return Promise.resolve(launch);
    }
    canStart() {
        return true;
    }
    start() {
        return this._transport;
    }
    getTransport() {
        return this._transport;
    }
    waitForInitialProviderPromises() {
        return Promise.resolve();
    }
}
suite('Workbench - MCP - ServerRequestHandler', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let delegate;
    let transport;
    let handler;
    let cts;
    setup(async () => {
        delegate = store.add(new TestMcpHostDelegate());
        transport = delegate.getTransport();
        cts = store.add(new CancellationTokenSource());
        // Setup test services
        const services = new ServiceCollection([ILoggerService, store.add(new TestLoggerService())], [IOutputService, upcast({ showChannel: () => { } })], [IStorageService, store.add(new TestStorageService())], [IProductService, TestProductService]);
        instantiationService = store.add(new TestInstantiationService(services));
        transport.setConnectionState({ state: 2 /* McpConnectionState.Kind.Running */ });
        // Manually create the handler since we need the transport already set up
        const logger = store.add(instantiationService.get(ILoggerService)
            .createLogger('mcpServerTest', { hidden: true, name: 'MCP Test' }));
        // Start the handler creation
        const handlerPromise = McpServerRequestHandler.create(instantiationService, { logger, launch: transport }, cts.token);
        handler = await handlerPromise;
        store.add(handler);
    });
    test('should send and receive JSON-RPC requests', async () => {
        // Setup request
        const requestPromise = handler.listResources();
        // Get the sent message and verify it
        const sentMessages = transport.getSentMessages();
        assert.strictEqual(sentMessages.length, 3); // initialize + listResources
        // Verify listResources request format
        const listResourcesRequest = sentMessages[2];
        assert.strictEqual(listResourcesRequest.method, 'resources/list');
        assert.strictEqual(listResourcesRequest.jsonrpc, MCP.JSONRPC_VERSION);
        assert.ok(typeof listResourcesRequest.id === 'number');
        // Simulate server response with mock resources that match the expected Resource interface
        transport.simulateReceiveMessage({
            jsonrpc: MCP.JSONRPC_VERSION,
            id: listResourcesRequest.id,
            result: {
                resources: [
                    { uri: 'resource1', type: 'text/plain', name: 'Test Resource 1' },
                    { uri: 'resource2', type: 'text/plain', name: 'Test Resource 2' }
                ]
            }
        });
        // Verify the result
        const resources = await requestPromise;
        assert.strictEqual(resources.length, 2);
        assert.strictEqual(resources[0].uri, 'resource1');
        assert.strictEqual(resources[1].name, 'Test Resource 2');
    });
    test('should handle paginated requests', async () => {
        // Setup request
        const requestPromise = handler.listResources();
        // Get the first request and respond with pagination
        const sentMessages = transport.getSentMessages();
        const listResourcesRequest = sentMessages[2];
        // Send first page with nextCursor
        transport.simulateReceiveMessage({
            jsonrpc: MCP.JSONRPC_VERSION,
            id: listResourcesRequest.id,
            result: {
                resources: [
                    { uri: 'resource1', type: 'text/plain', name: 'Test Resource 1' }
                ],
                nextCursor: 'page2'
            }
        });
        // Clear the sent messages to only capture the next page request
        transport.clearSentMessages();
        // Wait a bit to allow the handler to process and send the next request
        await new Promise(resolve => setTimeout(resolve, 0));
        // Get the second request and verify cursor is included
        const sentMessages2 = transport.getSentMessages();
        assert.strictEqual(sentMessages2.length, 1);
        const listResourcesRequest2 = sentMessages2[0];
        assert.strictEqual(listResourcesRequest2.method, 'resources/list');
        assert.deepStrictEqual(listResourcesRequest2.params, { cursor: 'page2' });
        // Send final page with no nextCursor
        transport.simulateReceiveMessage({
            jsonrpc: MCP.JSONRPC_VERSION,
            id: listResourcesRequest2.id,
            result: {
                resources: [
                    { uri: 'resource2', type: 'text/plain', name: 'Test Resource 2' }
                ]
            }
        });
        // Verify the combined result
        const resources = await requestPromise;
        assert.strictEqual(resources.length, 2);
        assert.strictEqual(resources[0].uri, 'resource1');
        assert.strictEqual(resources[1].uri, 'resource2');
    });
    test('should handle error responses', async () => {
        // Setup request
        const requestPromise = handler.readResource({ uri: 'non-existent' });
        // Get the sent message
        const sentMessages = transport.getSentMessages();
        const readResourceRequest = sentMessages[2]; // [0] is initialize
        // Simulate error response
        transport.simulateReceiveMessage({
            jsonrpc: MCP.JSONRPC_VERSION,
            id: readResourceRequest.id,
            error: {
                code: MCP.METHOD_NOT_FOUND,
                message: 'Resource not found'
            }
        });
        // Verify the error is thrown correctly
        try {
            await requestPromise;
            assert.fail('Expected error was not thrown');
        }
        catch (e) {
            assert.strictEqual(e.message, 'MPC -32601: Resource not found');
            assert.strictEqual(e.code, MCP.METHOD_NOT_FOUND);
        }
    });
    test('should handle server requests', async () => {
        // Simulate ping request from server
        const pingRequest = {
            jsonrpc: MCP.JSONRPC_VERSION,
            id: 100,
            method: 'ping'
        };
        transport.simulateReceiveMessage(pingRequest);
        // The handler should have sent a response
        const sentMessages = transport.getSentMessages();
        const pingResponse = sentMessages.find(m => 'id' in m && m.id === pingRequest.id && 'result' in m);
        assert.ok(pingResponse, 'No ping response was sent');
        assert.deepStrictEqual(pingResponse.result, {});
    });
    test('should handle roots list requests', async () => {
        // Set roots
        handler.roots = [
            { uri: 'file:///test/root1', name: 'Root 1' },
            { uri: 'file:///test/root2', name: 'Root 2' }
        ];
        // Simulate roots/list request from server
        const rootsRequest = {
            jsonrpc: MCP.JSONRPC_VERSION,
            id: 101,
            method: 'roots/list'
        };
        transport.simulateReceiveMessage(rootsRequest);
        // The handler should have sent a response
        const sentMessages = transport.getSentMessages();
        const rootsResponse = sentMessages.find(m => 'id' in m && m.id === rootsRequest.id && 'result' in m);
        assert.ok(rootsResponse, 'No roots/list response was sent');
        assert.strictEqual(rootsResponse.result.roots.length, 2);
        assert.strictEqual(rootsResponse.result.roots[0].uri, 'file:///test/root1');
    });
    test('should handle server notifications', async () => {
        let progressNotificationReceived = false;
        store.add(handler.onDidReceiveProgressNotification(notification => {
            progressNotificationReceived = true;
            assert.strictEqual(notification.method, 'notifications/progress');
            assert.strictEqual(notification.params.progressToken, 'token1');
            assert.strictEqual(notification.params.progress, 50);
        }));
        // Simulate progress notification with correct format
        const progressNotification = {
            jsonrpc: MCP.JSONRPC_VERSION,
            method: 'notifications/progress',
            params: {
                progressToken: 'token1',
                progress: 50,
                total: 100
            }
        };
        transport.simulateReceiveMessage(progressNotification);
        assert.strictEqual(progressNotificationReceived, true);
    });
    test('should handle cancellation', async () => {
        // Setup a new cancellation token source for this specific test
        const testCts = store.add(new CancellationTokenSource());
        const requestPromise = handler.listResources(undefined, testCts.token);
        // Get the request ID
        const sentMessages = transport.getSentMessages();
        const listResourcesRequest = sentMessages[2];
        const requestId = listResourcesRequest.id;
        // Cancel the request
        testCts.cancel();
        // Check that a cancellation notification was sent
        const cancelNotification = transport.getSentMessages().find(m => !('id' in m) &&
            'method' in m &&
            m.method === 'notifications/cancelled' &&
            'params' in m &&
            m.params && m.params.requestId === requestId);
        assert.ok(cancelNotification, 'No cancellation notification was sent');
        // Verify the promise was cancelled
        try {
            await requestPromise;
            assert.fail('Promise should have been cancelled');
        }
        catch (e) {
            assert.strictEqual(e.name, 'Canceled');
        }
    });
    test('should handle cancelled notification from server', async () => {
        // Setup request
        const requestPromise = handler.listResources();
        // Get the request ID
        const sentMessages = transport.getSentMessages();
        const listResourcesRequest = sentMessages[2];
        const requestId = listResourcesRequest.id;
        // Simulate cancelled notification from server
        const cancelledNotification = {
            jsonrpc: MCP.JSONRPC_VERSION,
            method: 'notifications/cancelled',
            params: {
                requestId
            }
        };
        transport.simulateReceiveMessage(cancelledNotification);
        // Verify the promise was cancelled
        try {
            await requestPromise;
            assert.fail('Promise should have been cancelled');
        }
        catch (e) {
            assert.strictEqual(e.name, 'Canceled');
        }
    });
    test('should dispose properly and cancel pending requests', async () => {
        // Setup multiple requests
        const request1 = handler.listResources();
        const request2 = handler.listTools();
        // Dispose the handler
        handler.dispose();
        // Verify all promises were cancelled
        try {
            await request1;
            assert.fail('Promise 1 should have been cancelled');
        }
        catch (e) {
            assert.strictEqual(e.name, 'Canceled');
        }
        try {
            await request2;
            assert.fail('Promise 2 should have been cancelled');
        }
        catch (e) {
            assert.strictEqual(e.name, 'Canceled');
        }
    });
    test('should handle connection error by cancelling requests', async () => {
        // Setup request
        const requestPromise = handler.listResources();
        // Simulate connection error
        transport.setConnectionState({
            state: 3 /* McpConnectionState.Kind.Error */,
            message: 'Connection lost'
        });
        // Verify the promise was cancelled
        try {
            await requestPromise;
            assert.fail('Promise should have been cancelled');
        }
        catch (e) {
            assert.strictEqual(e.name, 'Canceled');
        }
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwU2VydmVyUmVxdWVzdEhhbmRsZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvdGVzdC9jb21tb24vbWNwU2VydmVyUmVxdWVzdEhhbmRsZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUNqQyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDN0QsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFDdEcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFDekgsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUMzRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDcEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLGtCQUFrQixFQUFFLGtCQUFrQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFFN0gsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFFbEYsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNELE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2hFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFF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