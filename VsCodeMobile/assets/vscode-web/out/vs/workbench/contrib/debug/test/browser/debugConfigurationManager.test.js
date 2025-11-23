/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ContextKeyService } from '../../../../../platform/contextkey/browser/contextKeyService.js';
import { FileService } from '../../../../../platform/files/common/fileService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { UriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentityService.js';
import { ConfigurationManager } from '../../browser/debugConfigurationManager.js';
import { DebugConfigurationProviderTriggerKind } from '../../common/debug.js';
import { IPreferencesService } from '../../../../services/preferences/common/preferences.js';
import { TestQuickInputService } from '../../../../test/browser/workbenchTestServices.js';
import { TestHistoryService, TestContextService, TestExtensionService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
suite('debugConfigurationManager', () => {
    const configurationProviderType = 'custom-type';
    let _debugConfigurationManager;
    let disposables;
    const adapterManager = {
        getDebugAdapterDescriptor(session, config) {
            return Promise.resolve(undefined);
        },
        activateDebuggers(activationEvent, debugType) {
            return Promise.resolve();
        },
        get onDidDebuggersExtPointRead() {
            return Event.None;
        }
    };
    const preferencesService = {
        userSettingsResource: URI.file('/tmp/settings.json')
    };
    const configurationService = new TestConfigurationService();
    setup(() => {
        disposables = new DisposableStore();
        const fileService = disposables.add(new FileService(new NullLogService()));
        const instantiationService = disposables.add(new TestInstantiationService(new ServiceCollection([IPreferencesService, preferencesService], [IConfigurationService, configurationService])));
        _debugConfigurationManager = new ConfigurationManager(adapterManager, new TestContextService(), configurationService, new TestQuickInputService(), instantiationService, new TestStorageService(), new TestExtensionService(), new TestHistoryService(), new UriIdentityService(fileService), disposables.add(new ContextKeyService(configurationService)), new NullLogService());
    });
    teardown(() => disposables.dispose());
    ensureNoDisposablesAreLeakedInTestSuite();
    test('resolves configuration based on type', async () => {
        disposables.add(_debugConfigurationManager.registerDebugConfigurationProvider({
            type: configurationProviderType,
            resolveDebugConfiguration: (folderUri, config, token) => {
                assert.strictEqual(config.type, configurationProviderType);
                return Promise.resolve({
                    ...config,
                    configurationResolved: true
                });
            },
            triggerKind: DebugConfigurationProviderTriggerKind.Initial
        }));
        const initialConfig = {
            type: configurationProviderType,
            request: 'launch',
            name: 'configName',
        };
        const resultConfig = await _debugConfigurationManager.resolveConfigurationByProviders(undefined, configurationProviderType, initialConfig, CancellationToken.None);
        // eslint-disable-next-line local/code-no-any-casts
        assert.strictEqual(resultConfig.configurationResolved, true, 'Configuration should be updated by test provider');
    });
    test('resolves configuration from second provider if type changes', async () => {
        const secondProviderType = 'second-provider';
        disposables.add(_debugConfigurationManager.registerDebugConfigurationProvider({
            type: configurationProviderType,
            resolveDebugConfiguration: (folderUri, config, token) => {
                assert.strictEqual(config.type, configurationProviderType);
                return Promise.resolve({
                    ...config,
                    type: secondProviderType
                });
            },
            triggerKind: DebugConfigurationProviderTriggerKind.Initial
        }));
        disposables.add(_debugConfigurationManager.registerDebugConfigurationProvider({
            type: secondProviderType,
            resolveDebugConfiguration: (folderUri, config, token) => {
                assert.strictEqual(config.type, secondProviderType);
                return Promise.resolve({
                    ...config,
                    configurationResolved: true
                });
            },
            triggerKind: DebugConfigurationProviderTriggerKind.Initial
        }));
        const initialConfig = {
            type: configurationProviderType,
            request: 'launch',
            name: 'configName',
        };
        const resultConfig = await _debugConfigurationManager.resolveConfigurationByProviders(undefined, configurationProviderType, initialConfig, CancellationToken.None);
        assert.strictEqual(resultConfig.type, secondProviderType);
        // eslint-disable-next-line local/code-no-any-casts
        assert.strictEqual(resultConfig.configurationResolved, true, 'Configuration should be updated by test provider');
    });
    teardown(() => disposables.clear());
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWdDb25maWd1cmF0aW9uTWFuYWdlci50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2RlYnVnL3Rlc3QvYnJvd3Nlci9kZWJ1Z0NvbmZpZ3VyYXRpb25NYW5hZ2VyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDMUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLCtFQUErRSxDQUFDO0FBQ3pILE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGlFQUFpRSxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNsRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUN0RyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUN6SCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDdEcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDbEYsT0FBTyxFQUFFLHFDQUFx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