/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { TestDialogService } from '../../../../platform/dialogs/test/common/testDialogService.js';
import { TestInstantiationService } from '../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { TestNotificationService } from '../../../../platform/notification/test/common/testNotificationService.js';
import { IQuickInputService, QuickInputHideReason } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../../../platform/telemetry/common/telemetryUtils.js';
import { MainThreadAuthentication } from '../../browser/mainThreadAuthentication.js';
import { ExtHostContext, MainContext } from '../../common/extHost.protocol.js';
import { ExtHostAuthentication } from '../../common/extHostAuthentication.js';
import { IActivityService } from '../../../services/activity/common/activity.js';
import { AuthenticationService } from '../../../services/authentication/browser/authenticationService.js';
import { IAuthenticationExtensionsService, IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { IExtensionService, nullExtensionDescription as extensionDescription } from '../../../services/extensions/common/extensions.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { TestRPCProtocol } from '../common/testRPCProtocol.js';
import { TestEnvironmentService, TestHostService, TestQuickInputService, TestRemoteAgentService } from '../../../test/browser/workbenchTestServices.js';
import { TestActivityService, TestExtensionService, TestLoggerService, TestProductService, TestStorageService } from '../../../test/common/workbenchTestServices.js';
import { IBrowserWorkbenchEnvironmentService } from '../../../services/environment/browser/environmentService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { AuthenticationAccessService, IAuthenticationAccessService } from '../../../services/authentication/browser/authenticationAccessService.js';
import { IAuthenticationUsageService } from '../../../services/authentication/browser/authenticationUsageService.js';
import { AuthenticationExtensionsService } from '../../../services/authentication/browser/authenticationExtensionsService.js';
import { ILogService, NullLogService } from '../../../../platform/log/common/log.js';
import { ExtHostWindow } from '../../common/extHostWindow.js';
import { MainThreadWindow } from '../../browser/mainThreadWindow.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IUserActivityService, UserActivityService } from '../../../services/userActivity/common/userActivityService.js';
import { ExtHostUrls } from '../../common/extHostUrls.js';
import { ISecretStorageService } from '../../../../platform/secrets/common/secrets.js';
import { TestSecretStorageService } from '../../../../platform/secrets/test/common/testSecretStorageService.js';
import { IDynamicAuthenticationProviderStorageService } from '../../../services/authentication/common/dynamicAuthenticationProviderStorage.js';
import { DynamicAuthenticationProviderStorageService } from '../../../services/authentication/browser/dynamicAuthenticationProviderStorageService.js';
import { ExtHostProgress } from '../../common/extHostProgress.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
class AuthQuickPick {
    constructor() {
        this.items = [];
    }
    get selectedItems() {
        return this.items;
    }
    onDidAccept(listener) {
        this.accept = listener;
    }
    onDidHide(listener) {
        this.hide = listener;
    }
    dispose() {
    }
    show() {
        this.accept?.({ inBackground: false });
        this.hide?.({ reason: QuickInputHideReason.Other });
    }
}
class AuthTestQuickInputService extends TestQuickInputService {
    createQuickPick() {
        // eslint-disable-next-line local/code-no-any-casts
        return new AuthQuickPick();
    }
}
class TestAuthUsageService {
    initializeExtensionUsageCache() { return Promise.resolve(); }
    extensionUsesAuth(extensionId) { return Promise.resolve(false); }
    readAccountUsages(providerId, accountName) { return []; }
    removeAccountUsage(providerId, accountName) { }
    addAccountUsage(providerId, accountName, scopes, extensionId, extensionName) { }
}
class TestAuthProvider {
    constructor(authProviderName) {
        this.authProviderName = authProviderName;
        this.id = 1;
        this.sessions = new Map();
        this.onDidChangeSessions = () => { return { dispose() { } }; };
    }
    async getSessions(scopes) {
        if (!scopes) {
            return [...this.sessions.values()];
        }
        if (scopes[0] === 'return multiple') {
            return [...this.sessions.values()];
        }
        const sessions = this.sessions.get(scopes.join(' '));
        return sessions ? [sessions] : [];
    }
    async createSession(scopes) {
        const scopesStr = scopes.join(' ');
        const session = {
            scopes,
            id: `${this.id}`,
            account: {
                label: this.authProviderName,
                id: `${this.id}`,
            },
            accessToken: Math.random() + '',
        };
        this.sessions.set(scopesStr, session);
        this.id++;
        return session;
    }
    async removeSession(sessionId) {
        this.sessions.delete(sessionId);
    }
}
suite('ExtHostAuthentication', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let extHostAuthentication;
    let mainInstantiationService;
    setup(async () => {
        // services
        const services = new ServiceCollection();
        services.set(ILogService, new SyncDescriptor(NullLogService));
        services.set(IDialogService, new SyncDescriptor(TestDialogService, [{ confirmed: true }]));
        services.set(IStorageService, new SyncDescriptor(TestStorageService));
        services.set(ISecretStorageService, new SyncDescriptor(TestSecretStorageService));
        services.set(IDynamicAuthenticationProviderStorageService, new SyncDescriptor(DynamicAuthenticationProviderStorageService));
        services.set(IQuickInputService, new SyncDescriptor(AuthTestQuickInputService));
        services.set(IExtensionService, new SyncDescriptor(TestExtensionService));
        services.set(IActivityService, new SyncDescriptor(TestActivityService));
        services.set(IRemoteAgentService, new SyncDescriptor(TestRemoteAgentService));
        services.set(INotificationService, new SyncDescriptor(TestNotificationService));
        services.set(IHostService, new SyncDescriptor(TestHostService));
        services.set(IUserActivityService, new SyncDescriptor(UserActivityService));
        services.set(IAuthenticationAccessService, new SyncDescriptor(AuthenticationAccessService));
        services.set(IAuthenticationService, new SyncDescriptor(AuthenticationService));
        services.set(IAuthenticationUsageService, new SyncDescriptor(TestAuthUsageService));
        services.set(IAuthenticationExtensionsService, new SyncDescriptor(AuthenticationExtensionsService));
        mainInstantiationService = disposables.add(new TestInstantiationService(services, undefined, undefined, true));
        // stubs
        // eslint-disable-next-line local/code-no-dangerous-type-assertions
        mainInstantiationService.stub(IOpenerService, {});
        mainInstantiationService.stub(ITelemetryService, NullTelemetryService);
        mainInstantiationService.stub(IBrowserWorkbenchEnvironmentService, TestEnvironmentService);
        mainInstantiationService.stub(IProductService, TestProductService);
        const rpcProtocol = disposables.add(new TestRPCProtocol());
        rpcProtocol.set(MainContext.MainThreadAuthentication, disposables.add(mainInstantiationService.createInstance(MainThreadAuthentication, rpcProtocol)));
        rpcProtocol.set(MainContext.MainThreadWindow, disposables.add(mainInstantiationService.createInstance(MainThreadWindow, rpcProtocol)));
        // eslint-disable-next-line local/code-no-any-casts
        const initData = {
            environment: {
                appUriScheme: 'test',
                appName: 'Test'
            }
        };
        extHostAuthentication = new ExtHostAuthentication(rpcProtocol, 
        // eslint-disable-next-line local/code-no-any-casts
        {
            environment: {
                appUriScheme: 'test',
                appName: 'Test'
            }
        }, new ExtHostWindow(initData, rpcProtocol), new ExtHostUrls(rpcProtocol), new ExtHostProgress(rpcProtocol), disposables.add(new TestLoggerService()), new NullLogService());
        rpcProtocol.set(ExtHostContext.ExtHostAuthentication, extHostAuthentication);
        disposables.add(extHostAuthentication.registerAuthenticationProvider('test', 'test provider', new TestAuthProvider('test')));
        disposables.add(extHostAuthentication.registerAuthenticationProvider('test-multiple', 'test multiple provider', new TestAuthProvider('test-multiple'), { supportsMultipleAccounts: true }));
    });
    test('createIfNone - true', async () => {
        const scopes = ['foo'];
        const session = await extHostAuthentication.getSession(extensionDescription, 'test', scopes, {
            createIfNone: true
        });
        assert.strictEqual(session?.id, '1');
        assert.strictEqual(session?.scopes[0], 'foo');
    });
    test('createIfNone - false', async () => {
        const scopes = ['foo'];
        const nosession = await extHostAuthentication.getSession(extensionDescription, 'test', scopes, {});
        assert.strictEqual(nosession, undefined);
        // Now create the session
        const session = await extHostAuthentication.getSession(extensionDescription, 'test', scopes, {
            createIfNone: true
        });
        assert.strictEqual(session?.id, '1');
        assert.strictEqual(session?.scopes[0], 'foo');
        const session2 = await extHostAuthentication.getSession(extensionDescription, 'test', scopes, {});
        assert.strictEqual(session2?.id, session.id);
        assert.strictEqual(session2?.scopes[0], session.scopes[0]);
        assert.strictEqual(session2?.accessToken, session.accessToken);
    });
    // should behave the same as createIfNone: false
    test('silent - true', async () => {
        const scopes = ['foo'];
        const nosession = await extHostAuthentication.getSession(extensionDescription, 'test', scopes, {
            silent: true
        });
        assert.strictEqual(nosession, undefined);
        // Now create the session
        const session = await extHostAuthentication.getSession(extensionDescription, 'test', scopes, {
            createIfNone: true
        });
        assert.strictEqual(session?.id, '1');
        assert.strictEqual(session?.scopes[0], 'foo');
        const session2 = await extHostAuthentication.getSession(extensionDescription, 'test', scopes, {
            silent: true
        });
        assert.strictEqual(session.id, session2?.id);
        assert.strictEqual(session.scopes[0], session2?.scopes[0]);
    });
    test('forceNewSession - true - existing session', async () => {
        const scopes = ['foo'];
        const session1 = await extHostAuthentication.getSession(extensionDescription, 'test', scopes, {
            createIfNone: true
        });
        // Now create the session
        const session2 = await extHostAuthentication.getSession(extensionDescription, 'test', scopes, {
            forceNewSession: true
        });
        assert.strictEqual(session2?.id, '2');
        assert.strictEqual(session2?.scopes[0], 'foo');
        assert.notStrictEqual(session1.accessToken, session2?.accessToken);
    });
    // Should behave like createIfNone: true
    test('forceNewSession - true - no existing session', async () => {
        const scopes = ['foo'];
        const session = await extHostAuthentication.getSession(extensionDescription, 'test', scopes, {
            forceNewSession: true
        });
        assert.strictEqual(session?.id, '1');
        assert.strictEqual(session?.scopes[0], 'foo');
    });
    test('forceNewSession - detail', async () => {
        const scopes = ['foo'];
        const session1 = await extHostAuthentication.getSession(extensionDescription, 'test', scopes, {
            createIfNone: true
        });
        // Now create the session
        const session2 = await extHostAuthentication.getSession(extensionDescription, 'test', scopes, {
            forceNewSession: { detail: 'bar' }
        });
        assert.strictEqual(session2?.id, '2');
        assert.strictEqual(session2?.scopes[0], 'foo');
        assert.notStrictEqual(session1.accessToken, session2?.accessToken);
    });
    //#region Multi-Account AuthProvider
    test('clearSessionPreference - true', async () => {
        const scopes = ['foo'];
        // Now create the session
        const session = await extHostAuthentication.getSession(extensionDescription, 'test-multiple', scopes, {
            createIfNone: true
        });
        assert.strictEqual(session?.id, '1');
        assert.strictEqual(session?.scopes[0], scopes[0]);
        const scopes2 = ['bar'];
        const session2 = await extHostAuthentication.getSession(extensionDescription, 'test-multiple', scopes2, {
            createIfNone: true
        });
        assert.strictEqual(session2?.id, '2');
        assert.strictEqual(session2?.scopes[0], scopes2[0]);
        const session3 = await extHostAuthentication.getSession(extensionDescription, 'test-multiple', ['return multiple'], {
            clearSessionPreference: true,
            createIfNone: true
        });
        // clearing session preference causes us to get the first session
        // because it would normally show a quick pick for the user to choose
        assert.strictEqual(session3?.id, session.id);
        assert.strictEqual(session3?.scopes[0], session.scopes[0]);
        assert.strictEqual(session3?.accessToken, session.accessToken);
    });
    test('silently getting session should return a session (if any) regardless of preference - fixes #137819', async () => {
        const scopes = ['foo'];
        // Now create the session
        const session = await extHostAuthentication.getSession(extensionDescription, 'test-multiple', scopes, {
            createIfNone: true
        });
        assert.strictEqual(session?.id, '1');
        assert.strictEqual(session?.scopes[0], scopes[0]);
        const scopes2 = ['bar'];
        const session2 = await extHostAuthentication.getSession(extensionDescription, 'test-multiple', scopes2, {
            createIfNone: true
        });
        assert.strictEqual(session2?.id, '2');
        assert.strictEqual(session2?.scopes[0], scopes2[0]);
        const shouldBeSession1 = await extHostAuthentication.getSession(extensionDescription, 'test-multiple', scopes, {});
        assert.strictEqual(shouldBeSession1?.id, session.id);
        assert.strictEqual(shouldBeSession1?.scopes[0], session.scopes[0]);
        assert.strictEqual(shouldBeSession1?.accessToken, session.accessToken);
        const shouldBeSession2 = await extHostAuthentication.getSession(extensionDescription, 'test-multiple', scopes2, {});
        assert.strictEqual(shouldBeSession2?.id, session2.id);
        assert.strictEqual(shouldBeSession2?.scopes[0], session2.scopes[0]);
        assert.strictEqual(shouldBeSession2?.accessToken, session2.accessToken);
    });
    //#endregion
    //#region error cases
    test('createIfNone and forceNewSession', async () => {
        try {
            await extHostAuthentication.getSession(extensionDescription, 'test', ['foo'], {
                createIfNone: true,
                forceNewSession: true
            });
            assert.fail('should have thrown an Error.');
        }
        catch (e) {
            assert.ok(e);
        }
    });
    test('forceNewSession and silent', async () => {
        try {
            await extHostAuthentication.getSession(extensionDescription, 'test', ['foo'], {
                forceNewSession: true,
                silent: true
            });
            assert.fail('should have thrown an Error.');
        }
        catch (e) {
            assert.ok(e);
        }
    });
    test('createIfNone and silent', async () => {
        try {
            await extHostAuthentication.getSession(extensionDescription, 'test', ['foo'], {
                createIfNone: true,
                silent: true
            });
            assert.fail('should have thrown an Error.');
        }
        catch (e) {
            assert.ok(e);
        }
    });
    test('Can get multiple sessions (with different scopes) in one extension', async () => {
        let session = await extHostAuthentication.getSession(extensionDescription, 'test-multiple', ['foo'], {
            createIfNone: true
        });
        session = await extHostAuthentication.getSession(extensionDescription, 'test-multiple', ['bar'], {
            createIfNone: true
        });
        assert.strictEqual(session?.id, '2');
        assert.strictEqual(session?.scopes[0], 'bar');
        session = await extHostAuthentication.getSession(extensionDescription, 'test-multiple', ['foo'], {
            createIfNone: false
        });
        assert.strictEqual(session?.id, '1');
        assert.strictEqual(session?.scopes[0], 'foo');
    });
    test('Can get multiple sessions (from different providers) in one extension', async () => {
        let session = await extHostAuthentication.getSession(extensionDescription, 'test-multiple', ['foo'], {
            createIfNone: true
        });
        session = await extHostAuthentication.getSession(extensionDescription, 'test', ['foo'], {
            createIfNone: true
        });
        assert.strictEqual(session?.id, '1');
        assert.strictEqual(session?.scopes[0], 'foo');
        assert.strictEqual(session?.account.label, 'test');
        const session2 = await extHostAuthentication.getSession(extensionDescription, 'test-multiple', ['foo'], {
            createIfNone: false
        });
        assert.strictEqual(session2?.id, '1');
        assert.strictEqual(session2?.scopes[0], 'foo');
        assert.strictEqual(session2?.account.label, 'test-multiple');
    });
    test('Can get multiple sessions (from different providers) in one extension at the same time', async () => {
        const sessionP = extHostAuthentication.getSession(extensionDescription, 'test', ['foo'], {
            createIfNone: true
        });
        const session2P = extHostAuthentication.getSession(extensionDescription, 'test-multiple', ['foo'], {
            createIfNone: true
        });
        const session = await sessionP;
        assert.strictEqual(session?.id, '1');
        assert.strictEqual(session?.scopes[0], 'foo');
        assert.strictEqual(session?.account.label, 'test');
        const session2 = await session2P;
        assert.strictEqual(session2?.id, '1');
        assert.strictEqual(session2?.scopes[0], 'foo');
        assert.strictEqual(session2?.account.label, 'test-multiple');
    });
    //#endregion
    //#region Race Condition and Sequencing Tests
    test('concurrent operations on same provider are serialized', async () => {
        const provider = new TestAuthProvider('concurrent-test');
        const operationOrder = [];
        // Mock the provider methods to track operation order
        const originalCreateSession = provider.createSession.bind(provider);
        const originalGetSessions = provider.getSessions.bind(provider);
        provider.createSession = async (scopes) => {
            operationOrder.push(`create-start-${scopes[0]}`);
            await new Promise(resolve => setTimeout(resolve, 20)); // Simulate async work
            const result = await originalCreateSession(scopes);
            operationOrder.push(`create-end-${scopes[0]}`);
            return result;
        };
        provider.getSessions = async (scopes) => {
            const scopeKey = scopes ? scopes[0] : 'all';
            operationOrder.push(`get-start-${scopeKey}`);
            await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async work
            const result = await originalGetSessions(scopes);
            operationOrder.push(`get-end-${scopeKey}`);
            return result;
        };
        const disposable = extHostAuthentication.registerAuthenticationProvider('concurrent-test', 'Concurrent Test', provider);
        disposables.add(disposable);
        // Start multiple operations simultaneously on the same provider
        const promises = [
            extHostAuthentication.getSession(extensionDescription, 'concurrent-test', ['scope1'], { createIfNone: true }),
            extHostAuthentication.getSession(extensionDescription, 'concurrent-test', ['scope2'], { createIfNone: true }),
            extHostAuthentication.getSession(extensionDescription, 'concurrent-test', ['scope1'], {}) // This should get the existing session
        ];
        await Promise.all(promises);
        // Verify that operations were serialized - no overlapping operations
        // Build a map of operation starts to their corresponding ends
        const operationPairs = [];
        for (let i = 0; i < operationOrder.length; i++) {
            const current = operationOrder[i];
            if (current.includes('-start-')) {
                const scope = current.split('-start-')[1];
                const operationType = current.split('-start-')[0];
                const endOperation = `${operationType}-end-${scope}`;
                const endIndex = operationOrder.indexOf(endOperation, i + 1);
                if (endIndex !== -1) {
                    operationPairs.push({
                        start: i,
                        end: endIndex,
                        operation: `${operationType}-${scope}`
                    });
                }
            }
        }
        // Verify no operations overlap (serialization)
        for (let i = 0; i < operationPairs.length; i++) {
            for (let j = i + 1; j < operationPairs.length; j++) {
                const op1 = operationPairs[i];
                const op2 = operationPairs[j];
                // Operations should not overlap - one should completely finish before the other starts
                const op1EndsBeforeOp2Starts = op1.end < op2.start;
                const op2EndsBeforeOp1Starts = op2.end < op1.start;
                assert.ok(op1EndsBeforeOp2Starts || op2EndsBeforeOp1Starts, `Operations ${op1.operation} and ${op2.operation} should not overlap. ` +
                    `Op1: ${op1.start}-${op1.end}, Op2: ${op2.start}-${op2.end}. ` +
                    `Order: [${operationOrder.join(', ')}]`);
            }
        }
        // Verify we have the expected operations
        assert.ok(operationOrder.includes('create-start-scope1'), 'Should have created session for scope1');
        assert.ok(operationOrder.includes('create-end-scope1'), 'Should have completed creating session for scope1');
        assert.ok(operationOrder.includes('create-start-scope2'), 'Should have created session for scope2');
        assert.ok(operationOrder.includes('create-end-scope2'), 'Should have completed creating session for scope2');
        // The third call should use getSessions to find the existing scope1 session
        assert.ok(operationOrder.includes('get-start-scope1'), 'Should have called getSessions for existing scope1 session');
        assert.ok(operationOrder.includes('get-end-scope1'), 'Should have completed getSessions for existing scope1 session');
    });
    test('provider registration and immediate disposal race condition', async () => {
        const provider = new TestAuthProvider('race-test');
        // Register and immediately dispose
        const disposable = extHostAuthentication.registerAuthenticationProvider('race-test', 'Race Test', provider);
        disposable.dispose();
        // Try to use the provider after disposal - should fail gracefully
        try {
            await extHostAuthentication.getSession(extensionDescription, 'race-test', ['scope'], { createIfNone: true });
            assert.fail('Should have thrown an error for non-existent provider');
        }
        catch (error) {
            // Expected - provider should be unavailable
            assert.ok(error);
        }
    });
    test('provider re-registration after proper disposal', async () => {
        const provider1 = new TestAuthProvider('reregister-test-1');
        const provider2 = new TestAuthProvider('reregister-test-2');
        // First registration
        const disposable1 = extHostAuthentication.registerAuthenticationProvider('reregister-test', 'Provider 1', provider1);
        // Create a session with first provider
        const session1 = await extHostAuthentication.getSession(extensionDescription, 'reregister-test', ['scope'], { createIfNone: true });
        assert.strictEqual(session1?.account.label, 'reregister-test-1');
        // Dispose first provider
        disposable1.dispose();
        // Re-register with different provider
        const disposable2 = extHostAuthentication.registerAuthenticationProvider('reregister-test', 'Provider 2', provider2);
        disposables.add(disposable2);
        // Create session with second provider
        const session2 = await extHostAuthentication.getSession(extensionDescription, 'reregister-test', ['scope'], { createIfNone: true });
        assert.strictEqual(session2?.account.label, 'reregister-test-2');
        assert.notStrictEqual(session1?.accessToken, session2?.accessToken);
    });
    test('session operations during provider lifecycle changes', async () => {
        const provider = new TestAuthProvider('lifecycle-test');
        const disposable = extHostAuthentication.registerAuthenticationProvider('lifecycle-test', 'Lifecycle Test', provider);
        // Start a session creation
        const sessionPromise = extHostAuthentication.getSession(extensionDescription, 'lifecycle-test', ['scope'], { createIfNone: true });
        // Don't dispose immediately - let the session creation start
        await new Promise(resolve => setTimeout(resolve, 5));
        // Dispose the provider while the session creation is likely still in progress
        disposable.dispose();
        // The session creation should complete successfully even if we dispose during the operation
        const session = await sessionPromise;
        assert.ok(session);
        assert.strictEqual(session.account.label, 'lifecycle-test');
    });
    test('operations on different providers run concurrently', async () => {
        const provider1 = new TestAuthProvider('concurrent-1');
        const provider2 = new TestAuthProvider('concurrent-2');
        let provider1Started = false;
        let provider2Started = false;
        let provider1Finished = false;
        let provider2Finished = false;
        let concurrencyVerified = false;
        // Override createSession to track timing
        const originalCreate1 = provider1.createSession.bind(provider1);
        const originalCreate2 = provider2.createSession.bind(provider2);
        provider1.createSession = async (scopes) => {
            provider1Started = true;
            await new Promise(resolve => setTimeout(resolve, 20));
            const result = await originalCreate1(scopes);
            provider1Finished = true;
            return result;
        };
        provider2.createSession = async (scopes) => {
            provider2Started = true;
            // Provider 2 should start before provider 1 finishes (concurrent execution)
            if (provider1Started && !provider1Finished) {
                concurrencyVerified = true;
            }
            await new Promise(resolve => setTimeout(resolve, 10));
            const result = await originalCreate2(scopes);
            provider2Finished = true;
            return result;
        };
        const disposable1 = extHostAuthentication.registerAuthenticationProvider('concurrent-1', 'Concurrent 1', provider1);
        const disposable2 = extHostAuthentication.registerAuthenticationProvider('concurrent-2', 'Concurrent 2', provider2);
        disposables.add(disposable1);
        disposables.add(disposable2);
        // Start operations on both providers simultaneously
        const [session1, session2] = await Promise.all([
            extHostAuthentication.getSession(extensionDescription, 'concurrent-1', ['scope'], { createIfNone: true }),
            extHostAuthentication.getSession(extensionDescription, 'concurrent-2', ['scope'], { createIfNone: true })
        ]);
        // Verify both operations completed successfully
        assert.ok(session1);
        assert.ok(session2);
        assert.ok(provider1Started, 'Provider 1 should have started');
        assert.ok(provider2Started, 'Provider 2 should have started');
        assert.ok(provider1Finished, 'Provider 1 should have finished');
        assert.ok(provider2Finished, 'Provider 2 should have finished');
        assert.strictEqual(session1.account.label, 'concurrent-1');
        assert.strictEqual(session2.account.label, 'concurrent-2');
        // Verify that operations ran concurrently (provider 2 started while provider 1 was still running)
        assert.ok(concurrencyVerified, 'Operations should have run concurrently - provider 2 should start while provider 1 is still running');
    });
    //#endregion
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdEF1dGhlbnRpY2F0aW9uLmludGVncmF0aW9uVGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0QXV0aGVudGljYXRpb24uaW50ZWdyYXRpb25UZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDbEcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sNEVBQTRFLENBQUM7QUFDdEgsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDaEcsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sMEVBQTBFLENBQUM7QUFDbkgsT0FBTyxFQUF3QixrQkFBa0IsRUFBNEMsb0JBQW9CLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNoTCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDakYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDdkYsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0YsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDckYsT0FBTyxFQUFFLGNBQWMsRUFBRSxXQUFXLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMvRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUNqRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxt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