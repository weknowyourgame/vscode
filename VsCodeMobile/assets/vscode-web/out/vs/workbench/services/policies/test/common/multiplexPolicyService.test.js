/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { DefaultAccountService } from '../../../accounts/common/defaultAccount.js';
import { AccountPolicyService } from '../../common/accountPolicyService.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { DefaultConfiguration, PolicyConfiguration } from '../../../../../platform/configuration/common/configurations.js';
import { MultiplexPolicyService } from '../../common/multiplexPolicyService.js';
import { FilePolicyService } from '../../../../../platform/policy/common/filePolicyService.js';
import { URI } from '../../../../../base/common/uri.js';
import { InMemoryFileSystemProvider } from '../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { FileService } from '../../../../../platform/files/common/fileService.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { PolicyCategory } from '../../../../../base/common/policy.js';
const BASE_DEFAULT_ACCOUNT = {
    enterprise: false,
    sessionId: 'abc123',
};
suite('MultiplexPolicyService', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let policyService;
    let fileService;
    let defaultAccountService;
    let policyConfiguration;
    const logService = new NullLogService();
    const policyFile = URI.file('policyFile').with({ scheme: 'vscode-tests' });
    const policyConfigurationNode = {
        'id': 'policyConfiguration',
        'order': 1,
        'title': 'a',
        'type': 'object',
        'properties': {
            'setting.A': {
                'type': 'string',
                'default': 'defaultValueA',
                policy: {
                    name: 'PolicySettingA',
                    category: PolicyCategory.Extensions,
                    minimumVersion: '1.0.0',
                    localization: { description: { key: '', value: '' } }
                }
            },
            'setting.B': {
                'type': 'string',
                'default': 'defaultValueB',
                policy: {
                    name: 'PolicySettingB',
                    category: PolicyCategory.Extensions,
                    minimumVersion: '1.0.0',
                    localization: { description: { key: '', value: '' } },
                    value: account => account.chat_preview_features_enabled === false ? 'policyValueB' : undefined,
                }
            },
            'setting.C': {
                'type': 'array',
                'default': ['defaultValueC1', 'defaultValueC2'],
                policy: {
                    name: 'PolicySettingC',
                    category: PolicyCategory.Extensions,
                    minimumVersion: '1.0.0',
                    localization: { description: { key: '', value: '' } },
                    value: account => account.chat_preview_features_enabled === false ? JSON.stringify(['policyValueC1', 'policyValueC2']) : undefined,
                }
            },
            'setting.D': {
                'type': 'boolean',
                'default': true,
                policy: {
                    name: 'PolicySettingD',
                    category: PolicyCategory.Extensions,
                    minimumVersion: '1.0.0',
                    localization: { description: { key: '', value: '' } },
                    value: account => account.chat_preview_features_enabled === false ? false : undefined,
                }
            },
            'setting.E': {
                'type': 'boolean',
                'default': true,
            }
        }
    };
    suiteSetup(() => Registry.as(Extensions.Configuration).registerConfiguration(policyConfigurationNode));
    suiteTeardown(() => Registry.as(Extensions.Configuration).deregisterConfigurations([policyConfigurationNode]));
    setup(async () => {
        const defaultConfiguration = disposables.add(new DefaultConfiguration(new NullLogService()));
        await defaultConfiguration.initialize();
        fileService = disposables.add(new FileService(new NullLogService()));
        const diskFileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
        disposables.add(fileService.registerProvider(policyFile.scheme, diskFileSystemProvider));
        defaultAccountService = disposables.add(new DefaultAccountService());
        policyService = disposables.add(new MultiplexPolicyService([
            disposables.add(new FilePolicyService(policyFile, fileService, new NullLogService())),
            disposables.add(new AccountPolicyService(logService, defaultAccountService)),
        ], logService));
        policyConfiguration = disposables.add(new PolicyConfiguration(defaultConfiguration, policyService, new NullLogService()));
    });
    async function clear() {
        // Reset
        defaultAccountService.setDefaultAccount({ ...BASE_DEFAULT_ACCOUNT });
        await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({})));
    }
    test('no policy', async () => {
        await clear();
        await policyConfiguration.initialize();
        {
            const A = policyService.getPolicyValue('PolicySettingA');
            const B = policyService.getPolicyValue('PolicySettingB');
            const C = policyService.getPolicyValue('PolicySettingC');
            const D = policyService.getPolicyValue('PolicySettingD');
            // No policy is set
            assert.strictEqual(A, undefined);
            assert.strictEqual(B, undefined);
            assert.strictEqual(C, undefined);
            assert.strictEqual(D, undefined);
        }
        {
            const A = policyConfiguration.configurationModel.getValue('setting.A');
            const B = policyConfiguration.configurationModel.getValue('setting.B');
            const C = policyConfiguration.configurationModel.getValue('setting.C');
            const D = policyConfiguration.configurationModel.getValue('setting.D');
            const E = policyConfiguration.configurationModel.getValue('setting.E');
            assert.strictEqual(A, undefined);
            assert.strictEqual(B, undefined);
            assert.deepStrictEqual(C, undefined);
            assert.strictEqual(D, undefined);
            assert.strictEqual(E, undefined);
        }
    });
    test('policy from file only', async () => {
        await clear();
        const defaultAccount = { ...BASE_DEFAULT_ACCOUNT };
        defaultAccountService.setDefaultAccount(defaultAccount);
        await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicySettingA': 'policyValueA' })));
        await policyConfiguration.initialize();
        {
            const A = policyService.getPolicyValue('PolicySettingA');
            const B = policyService.getPolicyValue('PolicySettingB');
            const C = policyService.getPolicyValue('PolicySettingC');
            const D = policyService.getPolicyValue('PolicySettingD');
            assert.strictEqual(A, 'policyValueA');
            assert.strictEqual(B, undefined);
            assert.strictEqual(C, undefined);
            assert.strictEqual(D, undefined);
        }
        {
            const A = policyConfiguration.configurationModel.getValue('setting.A');
            const B = policyConfiguration.configurationModel.getValue('setting.B');
            const C = policyConfiguration.configurationModel.getValue('setting.C');
            const D = policyConfiguration.configurationModel.getValue('setting.D');
            const E = policyConfiguration.configurationModel.getValue('setting.E');
            assert.strictEqual(A, 'policyValueA');
            assert.strictEqual(B, undefined);
            assert.deepStrictEqual(C, undefined);
            assert.strictEqual(D, undefined);
            assert.strictEqual(E, undefined);
        }
    });
    test('policy from default account only', async () => {
        await clear();
        const defaultAccount = { ...BASE_DEFAULT_ACCOUNT, chat_preview_features_enabled: false };
        defaultAccountService.setDefaultAccount(defaultAccount);
        await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({})));
        await policyConfiguration.initialize();
        const actualConfigurationModel = policyConfiguration.configurationModel;
        {
            const A = policyService.getPolicyValue('PolicySettingA');
            const B = policyService.getPolicyValue('PolicySettingB');
            const C = policyService.getPolicyValue('PolicySettingC');
            const D = policyService.getPolicyValue('PolicySettingD');
            assert.strictEqual(A, undefined); // Not tagged with preview tags
            assert.strictEqual(B, 'policyValueB');
            assert.strictEqual(C, JSON.stringify(['policyValueC1', 'policyValueC2']));
            assert.strictEqual(D, false);
        }
        {
            const A = policyConfiguration.configurationModel.getValue('setting.A');
            const B = actualConfigurationModel.getValue('setting.B');
            const C = actualConfigurationModel.getValue('setting.C');
            const D = actualConfigurationModel.getValue('setting.D');
            assert.strictEqual(A, undefined);
            assert.strictEqual(B, 'policyValueB');
            assert.deepStrictEqual(C, ['policyValueC1', 'policyValueC2']);
            assert.strictEqual(D, false);
        }
    });
    test('policy from file and default account', async () => {
        await clear();
        const defaultAccount = { ...BASE_DEFAULT_ACCOUNT, chat_preview_features_enabled: false };
        defaultAccountService.setDefaultAccount(defaultAccount);
        await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicySettingA': 'policyValueA' })));
        await policyConfiguration.initialize();
        const actualConfigurationModel = policyConfiguration.configurationModel;
        {
            const A = policyService.getPolicyValue('PolicySettingA');
            const B = policyService.getPolicyValue('PolicySettingB');
            const C = policyService.getPolicyValue('PolicySettingC');
            const D = policyService.getPolicyValue('PolicySettingD');
            assert.strictEqual(A, 'policyValueA');
            assert.strictEqual(B, 'policyValueB');
            assert.strictEqual(C, JSON.stringify(['policyValueC1', 'policyValueC2']));
            assert.strictEqual(D, false);
        }
        {
            const A = actualConfigurationModel.getValue('setting.A');
            const B = actualConfigurationModel.getValue('setting.B');
            const C = actualConfigurationModel.getValue('setting.C');
            const D = actualConfigurationModel.getValue('setting.D');
            assert.strictEqual(A, 'policyValueA');
            assert.strictEqual(B, 'policyValueB');
            assert.deepStrictEqual(C, ['policyValueC1', 'policyValueC2']);
            assert.strictEqual(D, false);
        }
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVsdGlwbGV4UG9saWN5U2VydmljZS50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9wb2xpY2llcy90ZXN0L2NvbW1vbi9tdWx0aXBsZXhQb2xpY3lTZXJ2aWNlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMzRSxPQUFPLEVBQUUscUJBQXFCLEVBQTBCLE1BQU0sNENBQTRDLENBQUM7QUFDM0csT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDNUUsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQy9FLE9BQU8sRUFBRSxVQUFVLEVBQThDLE1BQU0sdUVBQXVFLENBQUM7QUFDL0ksT0FBTyxFQUFFLG9CQUFvQixFQUFFLG1CQUFtQixFQUFFLE1BQU0sZ0VBQWdFLENBQUM7QUFDM0gsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDaEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDL0YsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRXhELE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLG9FQUFvRSxDQUFDO0FBQ2hILE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNsRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFaEUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRXRFLE1BQU0sb0JB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