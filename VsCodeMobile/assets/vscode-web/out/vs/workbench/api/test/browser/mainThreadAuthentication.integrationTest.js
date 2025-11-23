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
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../../../platform/telemetry/common/telemetryUtils.js';
import { MainThreadAuthentication } from '../../browser/mainThreadAuthentication.js';
import { ExtHostContext, MainContext } from '../../common/extHost.protocol.js';
import { IActivityService } from '../../../services/activity/common/activity.js';
import { AuthenticationService } from '../../../services/authentication/browser/authenticationService.js';
import { IAuthenticationExtensionsService, IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { TestRPCProtocol } from '../common/testRPCProtocol.js';
import { TestEnvironmentService, TestHostService, TestQuickInputService, TestRemoteAgentService } from '../../../test/browser/workbenchTestServices.js';
import { TestActivityService, TestExtensionService, TestProductService, TestStorageService } from '../../../test/common/workbenchTestServices.js';
import { IBrowserWorkbenchEnvironmentService } from '../../../services/environment/browser/environmentService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { AuthenticationAccessService, IAuthenticationAccessService } from '../../../services/authentication/browser/authenticationAccessService.js';
import { IAuthenticationUsageService } from '../../../services/authentication/browser/authenticationUsageService.js';
import { AuthenticationExtensionsService } from '../../../services/authentication/browser/authenticationExtensionsService.js';
import { ILogService, NullLogService } from '../../../../platform/log/common/log.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IUserActivityService, UserActivityService } from '../../../services/userActivity/common/userActivityService.js';
import { ISecretStorageService } from '../../../../platform/secrets/common/secrets.js';
import { TestSecretStorageService } from '../../../../platform/secrets/test/common/testSecretStorageService.js';
import { IDynamicAuthenticationProviderStorageService } from '../../../services/authentication/common/dynamicAuthenticationProviderStorage.js';
import { DynamicAuthenticationProviderStorageService } from '../../../services/authentication/browser/dynamicAuthenticationProviderStorageService.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
class TestAuthUsageService {
    initializeExtensionUsageCache() { return Promise.resolve(); }
    extensionUsesAuth(extensionId) { return Promise.resolve(false); }
    readAccountUsages(providerId, accountName) { return []; }
    removeAccountUsage(providerId, accountName) { }
    addAccountUsage(providerId, accountName, scopes, extensionId, extensionName) { }
}
suite('MainThreadAuthentication', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let mainThreadAuthentication;
    let instantiationService;
    let rpcProtocol;
    setup(async () => {
        // services
        const services = new ServiceCollection();
        services.set(ILogService, new SyncDescriptor(NullLogService));
        services.set(IDialogService, new SyncDescriptor(TestDialogService, [{ confirmed: true }]));
        services.set(IStorageService, new SyncDescriptor(TestStorageService));
        services.set(ISecretStorageService, new SyncDescriptor(TestSecretStorageService));
        services.set(IDynamicAuthenticationProviderStorageService, new SyncDescriptor(DynamicAuthenticationProviderStorageService));
        services.set(IQuickInputService, new SyncDescriptor(TestQuickInputService));
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
        instantiationService = disposables.add(new TestInstantiationService(services, undefined, undefined, true));
        // stubs
        // eslint-disable-next-line local/code-no-dangerous-type-assertions
        instantiationService.stub(IOpenerService, {});
        instantiationService.stub(ITelemetryService, NullTelemetryService);
        instantiationService.stub(IBrowserWorkbenchEnvironmentService, TestEnvironmentService);
        instantiationService.stub(IProductService, TestProductService);
        rpcProtocol = disposables.add(new TestRPCProtocol());
        mainThreadAuthentication = disposables.add(instantiationService.createInstance(MainThreadAuthentication, rpcProtocol));
        rpcProtocol.set(MainContext.MainThreadAuthentication, mainThreadAuthentication);
    });
    test('provider registration completes without errors', async () => {
        // Test basic registration - this should complete without throwing
        await mainThreadAuthentication.$registerAuthenticationProvider({
            id: 'test-provider',
            label: 'Test Provider',
            supportsMultipleAccounts: false
        });
        // Test unregistration - this should also complete without throwing
        await mainThreadAuthentication.$unregisterAuthenticationProvider('test-provider');
        // Success if we reach here without timeout
        assert.ok(true, 'Registration and unregistration completed successfully');
    });
    test('event suppression during explicit unregistration', async () => {
        let unregisterEventFired = false;
        let eventProviderId;
        // Mock the ext host to capture unregister events
        const mockExtHost = {
            $onDidUnregisterAuthenticationProvider: (id) => {
                unregisterEventFired = true;
                eventProviderId = id;
                return Promise.resolve();
            },
            $getSessions: () => Promise.resolve([]),
            // eslint-disable-next-line local/code-no-any-casts
            $createSession: () => Promise.resolve({}),
            $removeSession: () => Promise.resolve(),
            $onDidChangeAuthenticationSessions: () => Promise.resolve(),
            $registerDynamicAuthProvider: () => Promise.resolve('test'),
            $onDidChangeDynamicAuthProviderTokens: () => Promise.resolve(),
            $getSessionsFromChallenges: () => Promise.resolve([]),
            // eslint-disable-next-line local/code-no-any-casts
            $createSessionFromChallenges: () => Promise.resolve({}),
        };
        rpcProtocol.set(ExtHostContext.ExtHostAuthentication, mockExtHost);
        // Register a provider
        await mainThreadAuthentication.$registerAuthenticationProvider({
            id: 'test-suppress',
            label: 'Test Suppress',
            supportsMultipleAccounts: false
        });
        // Reset the flag
        unregisterEventFired = false;
        eventProviderId = undefined;
        // Unregister the provider - this should NOT fire the event due to suppression
        await mainThreadAuthentication.$unregisterAuthenticationProvider('test-suppress');
        // Verify the event was suppressed
        assert.strictEqual(unregisterEventFired, false, 'Unregister event should be suppressed during explicit unregistration');
        assert.strictEqual(eventProviderId, undefined, 'No provider ID should be captured from suppressed event');
    });
    test('concurrent provider registrations complete without errors', async () => {
        // Register multiple providers simultaneously
        const registrationPromises = [
            mainThreadAuthentication.$registerAuthenticationProvider({
                id: 'concurrent-1',
                label: 'Concurrent 1',
                supportsMultipleAccounts: false
            }),
            mainThreadAuthentication.$registerAuthenticationProvider({
                id: 'concurrent-2',
                label: 'Concurrent 2',
                supportsMultipleAccounts: false
            }),
            mainThreadAuthentication.$registerAuthenticationProvider({
                id: 'concurrent-3',
                label: 'Concurrent 3',
                supportsMultipleAccounts: false
            })
        ];
        await Promise.all(registrationPromises);
        // Unregister all providers
        const unregistrationPromises = [
            mainThreadAuthentication.$unregisterAuthenticationProvider('concurrent-1'),
            mainThreadAuthentication.$unregisterAuthenticationProvider('concurrent-2'),
            mainThreadAuthentication.$unregisterAuthenticationProvider('concurrent-3')
        ];
        await Promise.all(unregistrationPromises);
        // Success if we reach here without timeout
        assert.ok(true, 'Concurrent registrations and unregistrations completed successfully');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZEF1dGhlbnRpY2F0aW9uLmludGVncmF0aW9uVGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9tYWluVGhyZWFkQXV0aGVudGljYXRpb24uaW50ZWdyYXRpb25UZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDbEcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sNEVBQTRFLENBQUM7QUFDdEgsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDaEcsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sMEVBQTBFLENBQUM7QUFDbkgsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQy9GLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxjQUFjLEVBQUUsV0FBVyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDL0UsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDakYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFDMUcsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLHNCQUFzQixFQUFFLE1B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