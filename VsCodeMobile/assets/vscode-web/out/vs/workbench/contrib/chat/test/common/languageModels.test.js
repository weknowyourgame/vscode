/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { AsyncIterableSource, DeferredPromise, timeout } from '../../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { languageModelChatProviderExtensionPoint, LanguageModelsService } from '../../common/languageModels.js';
import { nullExtensionDescription } from '../../../../services/extensions/common/extensions.js';
import { ExtensionsRegistry } from '../../../../services/extensions/common/extensionsRegistry.js';
import { DEFAULT_MODEL_PICKER_CATEGORY } from '../../common/modelPicker/modelPickerWidget.js';
import { TestChatEntitlementService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { Event } from '../../../../../base/common/event.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
suite('LanguageModels', function () {
    let languageModels;
    const store = new DisposableStore();
    const activationEvents = new Set();
    setup(function () {
        languageModels = new LanguageModelsService(new class extends mock() {
            activateByEvent(name) {
                activationEvents.add(name);
                return Promise.resolve();
            }
        }, new NullLogService(), new TestStorageService(), new MockContextKeyService(), new TestConfigurationService(), new TestChatEntitlementService());
        const ext = ExtensionsRegistry.getExtensionPoints().find(e => e.name === languageModelChatProviderExtensionPoint.name);
        ext.acceptUsers([{
                description: { ...nullExtensionDescription },
                value: { vendor: 'test-vendor' },
                collector: null
            }, {
                description: { ...nullExtensionDescription },
                value: { vendor: 'actual-vendor' },
                collector: null
            }]);
        store.add(languageModels.registerLanguageModelProvider('test-vendor', {
            onDidChange: Event.None,
            provideLanguageModelChatInfo: async () => {
                const modelMetadata = [
                    {
                        extension: nullExtensionDescription.identifier,
                        name: 'Pretty Name',
                        vendor: 'test-vendor',
                        family: 'test-family',
                        version: 'test-version',
                        modelPickerCategory: undefined,
                        id: 'test-id-1',
                        maxInputTokens: 100,
                        maxOutputTokens: 100,
                    },
                    {
                        extension: nullExtensionDescription.identifier,
                        name: 'Pretty Name',
                        vendor: 'test-vendor',
                        family: 'test2-family',
                        version: 'test2-version',
                        modelPickerCategory: undefined,
                        id: 'test-id-12',
                        maxInputTokens: 100,
                        maxOutputTokens: 100,
                    }
                ];
                const modelMetadataAndIdentifier = modelMetadata.map(m => ({
                    metadata: m,
                    identifier: m.id,
                }));
                return modelMetadataAndIdentifier;
            },
            sendChatRequest: async () => {
                throw new Error();
            },
            provideTokenCount: async () => {
                throw new Error();
            }
        }));
    });
    teardown(function () {
        languageModels.dispose();
        activationEvents.clear();
        store.clear();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('empty selector returns all', async function () {
        const result1 = await languageModels.selectLanguageModels({});
        assert.deepStrictEqual(result1.length, 2);
        assert.deepStrictEqual(result1[0], 'test-id-1');
        assert.deepStrictEqual(result1[1], 'test-id-12');
    });
    test('selector with id works properly', async function () {
        const result1 = await languageModels.selectLanguageModels({ id: 'test-id-1' });
        assert.deepStrictEqual(result1.length, 1);
        assert.deepStrictEqual(result1[0], 'test-id-1');
    });
    test('no warning that a matching model was not found #213716', async function () {
        const result1 = await languageModels.selectLanguageModels({ vendor: 'test-vendor' });
        assert.deepStrictEqual(result1.length, 2);
        const result2 = await languageModels.selectLanguageModels({ vendor: 'test-vendor', family: 'FAKE' });
        assert.deepStrictEqual(result2.length, 0);
    });
    test('sendChatRequest returns a response-stream', async function () {
        store.add(languageModels.registerLanguageModelProvider('actual-vendor', {
            onDidChange: Event.None,
            provideLanguageModelChatInfo: async () => {
                const modelMetadata = [
                    {
                        extension: nullExtensionDescription.identifier,
                        name: 'Pretty Name',
                        vendor: 'actual-vendor',
                        family: 'actual-family',
                        version: 'actual-version',
                        id: 'actual-lm',
                        maxInputTokens: 100,
                        maxOutputTokens: 100,
                        modelPickerCategory: DEFAULT_MODEL_PICKER_CATEGORY,
                    }
                ];
                const modelMetadataAndIdentifier = modelMetadata.map(m => ({
                    metadata: m,
                    identifier: m.id,
                }));
                return modelMetadataAndIdentifier;
            },
            sendChatRequest: async (modelId, messages, _from, _options, token) => {
                // const message = messages.at(-1);
                const defer = new DeferredPromise();
                const stream = new AsyncIterableSource();
                (async () => {
                    while (!token.isCancellationRequested) {
                        stream.emitOne({ type: 'text', value: Date.now().toString() });
                        await timeout(10);
                    }
                    defer.complete(undefined);
                })();
                return {
                    stream: stream.asyncIterable,
                    result: defer.p
                };
            },
            provideTokenCount: async () => {
                throw new Error();
            }
        }));
        // Register the extension point for the actual vendor
        const ext = ExtensionsRegistry.getExtensionPoints().find(e => e.name === languageModelChatProviderExtensionPoint.name);
        ext.acceptUsers([{
                description: { ...nullExtensionDescription },
                value: { vendor: 'actual-vendor' },
                collector: null
            }]);
        const models = await languageModels.selectLanguageModels({ id: 'actual-lm' });
        assert.ok(models.length === 1);
        const first = models[0];
        const cts = new CancellationTokenSource();
        const request = await languageModels.sendChatRequest(first, nullExtensionDescription.identifier, [{ role: 1 /* ChatMessageRole.User */, content: [{ type: 'text', value: 'hello' }] }], {}, cts.token);
        assert.ok(request);
        cts.dispose(true);
        await request.result;
    });
    test('when clause defaults to true when omitted', async function () {
        const vendors = languageModels.getVendors();
        // Both test-vendor and actual-vendor have no when clause, so they should be visible
        assert.ok(vendors.length >= 2);
        assert.ok(vendors.some(v => v.vendor === 'test-vendor'));
        assert.ok(vendors.some(v => v.vendor === 'actual-vendor'));
    });
});
suite('LanguageModels - When Clause', function () {
    class TestContextKeyService extends MockContextKeyService {
        contextMatchesRules(rules) {
            if (!rules) {
                return true;
            }
            // Simple evaluation based on stored keys
            const keys = rules.keys();
            for (const key of keys) {
                const contextKey = this.getContextKeyValue(key);
                // If the key exists and is truthy, the rule matches
                if (contextKey) {
                    return true;
                }
            }
            return false;
        }
    }
    let languageModelsWithWhen;
    let contextKeyService;
    setup(function () {
        contextKeyService = new TestContextKeyService();
        contextKeyService.createKey('testKey', true);
        languageModelsWithWhen = new LanguageModelsService(new class extends mock() {
            activateByEvent(name) {
                return Promise.resolve();
            }
        }, new NullLogService(), new TestStorageService(), contextKeyService, new TestConfigurationService(), new TestChatEntitlementService());
        const ext = ExtensionsRegistry.getExtensionPoints().find(e => e.name === languageModelChatProviderExtensionPoint.name);
        ext.acceptUsers([{
                description: { ...nullExtensionDescription },
                value: { vendor: 'visible-vendor', displayName: 'Visible Vendor' },
                collector: null
            }, {
                description: { ...nullExtensionDescription },
                value: { vendor: 'conditional-vendor', displayName: 'Conditional Vendor', when: 'testKey' },
                collector: null
            }, {
                description: { ...nullExtensionDescription },
                value: { vendor: 'hidden-vendor', displayName: 'Hidden Vendor', when: 'falseKey' },
                collector: null
            }]);
    });
    teardown(function () {
        languageModelsWithWhen.dispose();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('when clause filters vendors correctly', async function () {
        const vendors = languageModelsWithWhen.getVendors();
        assert.strictEqual(vendors.length, 2);
        assert.ok(vendors.some(v => v.vendor === 'visible-vendor'));
        assert.ok(vendors.some(v => v.vendor === 'conditional-vendor'));
        assert.ok(!vendors.some(v => v.vendor === 'hidden-vendor'));
    });
    test('when clause evaluates to true when context key is true', async function () {
        const vendors = languageModelsWithWhen.getVendors();
        assert.ok(vendors.some(v => v.vendor === 'conditional-vendor'), 'conditional-vendor should be visible when testKey is true');
    });
    test('when clause evaluates to false when context key is false', async function () {
        const vendors = languageModelsWithWhen.getVendors();
        assert.ok(!vendors.some(v => v.vendor === 'hidden-vendor'), 'hidden-vendor should be hidden when falseKey is false');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFuZ3VhZ2VNb2RlbHMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL2xhbmd1YWdlTW9kZWxzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDcEcsT0FBTyxFQUFxQix1QkFBdUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3hHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDL0QsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQzNFLE9BQU8sRUFBbUIsdUNBQXVDLEVBQUUscUJBQXFCLEVBQW1DLE1BQU0sZ0NBQWdDLENBQUM7QUFDbEssT0FBTyxFQUFxQix3QkFBd0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ25ILE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQ2xHLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBRTlGLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ2xILE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx5RUFBeUUsQ0FBQztBQUNoSCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwrRUFBK0Us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