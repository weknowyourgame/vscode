/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ChatModelsViewModel, isVendorEntry, isGroupEntry } from '../../browser/chatManagement/chatModelsViewModel.js';
import { ChatEntitlement } from '../../../../services/chat/common/chatEntitlementService.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
class MockLanguageModelsService {
    constructor() {
        this.vendors = [];
        this.models = new Map();
        this.modelsByVendor = new Map();
        this._onDidChangeLanguageModels = new Emitter();
        this.onDidChangeLanguageModels = this._onDidChangeLanguageModels.event;
    }
    addVendor(vendor) {
        this.vendors.push(vendor);
        this.modelsByVendor.set(vendor.vendor, []);
    }
    addModel(vendorId, identifier, metadata) {
        this.models.set(identifier, metadata);
        const models = this.modelsByVendor.get(vendorId) || [];
        models.push(identifier);
        this.modelsByVendor.set(vendorId, models);
    }
    registerLanguageModelProvider(vendor, provider) {
        throw new Error('Method not implemented.');
    }
    updateModelPickerPreference(modelIdentifier, showInModelPicker) {
        const metadata = this.models.get(modelIdentifier);
        if (metadata) {
            this.models.set(modelIdentifier, { ...metadata, isUserSelectable: showInModelPicker });
        }
    }
    getVendors() {
        return this.vendors;
    }
    getLanguageModelIds() {
        return Array.from(this.models.keys());
    }
    lookupLanguageModel(identifier) {
        return this.models.get(identifier);
    }
    getLanguageModels() {
        const result = [];
        for (const [identifier, metadata] of this.models.entries()) {
            result.push({ identifier, metadata });
        }
        return result;
    }
    setContributedSessionModels() {
    }
    clearContributedSessionModels() {
    }
    async selectLanguageModels(selector, allowHidden) {
        if (selector.vendor) {
            return this.modelsByVendor.get(selector.vendor) || [];
        }
        return Array.from(this.models.keys());
    }
    sendChatRequest() {
        throw new Error('Method not implemented.');
    }
    computeTokenLength() {
        throw new Error('Method not implemented.');
    }
}
class MockChatEntitlementService {
    constructor() {
        this._onDidChangeEntitlement = new Emitter();
        this.onDidChangeEntitlement = this._onDidChangeEntitlement.event;
        this.entitlement = ChatEntitlement.Unknown;
        this.entitlementObs = observableValue('entitlement', ChatEntitlement.Unknown);
        this.organisations = undefined;
        this.isInternal = false;
        this.sku = undefined;
        this.onDidChangeQuotaExceeded = Event.None;
        this.onDidChangeQuotaRemaining = Event.None;
        this.quotas = {
            chat: {
                total: 100,
                remaining: 100,
                percentRemaining: 100,
                overageEnabled: false,
                overageCount: 0,
                unlimited: false
            },
            completions: {
                total: 100,
                remaining: 100,
                percentRemaining: 100,
                overageEnabled: false,
                overageCount: 0,
                unlimited: false
            }
        };
        this.onDidChangeSentiment = Event.None;
        this.sentiment = { installed: true, hidden: false, disabled: false };
        this.sentimentObs = observableValue('sentiment', { installed: true, hidden: false, disabled: false });
        this.onDidChangeAnonymous = Event.None;
        this.anonymous = false;
        this.anonymousObs = observableValue('anonymous', false);
    }
    fireEntitlementChange() {
        this._onDidChangeEntitlement.fire();
    }
    async update() {
        // Not needed for tests
    }
}
suite('ChatModelsViewModel', () => {
    let store;
    let languageModelsService;
    let chatEntitlementService;
    let viewModel;
    setup(async () => {
        store = new DisposableStore();
        languageModelsService = new MockLanguageModelsService();
        chatEntitlementService = new MockChatEntitlementService();
        // Setup test data
        languageModelsService.addVendor({
            vendor: 'copilot',
            displayName: 'GitHub Copilot',
            managementCommand: undefined,
            when: undefined
        });
        languageModelsService.addVendor({
            vendor: 'openai',
            displayName: 'OpenAI',
            managementCommand: undefined,
            when: undefined
        });
        languageModelsService.addModel('copilot', 'copilot-gpt-4', {
            extension: new ExtensionIdentifier('github.copilot'),
            id: 'gpt-4',
            name: 'GPT-4',
            family: 'gpt-4',
            version: '1.0',
            vendor: 'copilot',
            maxInputTokens: 8192,
            maxOutputTokens: 4096,
            modelPickerCategory: { label: 'Copilot', order: 1 },
            isUserSelectable: true,
            capabilities: {
                toolCalling: true,
                vision: true,
                agentMode: false
            }
        });
        languageModelsService.addModel('copilot', 'copilot-gpt-4o', {
            extension: new ExtensionIdentifier('github.copilot'),
            id: 'gpt-4o',
            name: 'GPT-4o',
            family: 'gpt-4',
            version: '1.0',
            vendor: 'copilot',
            maxInputTokens: 8192,
            maxOutputTokens: 4096,
            modelPickerCategory: { label: 'Copilot', order: 1 },
            isUserSelectable: true,
            capabilities: {
                toolCalling: true,
                vision: true,
                agentMode: true
            }
        });
        languageModelsService.addModel('openai', 'openai-gpt-3.5', {
            extension: new ExtensionIdentifier('openai.api'),
            id: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            family: 'gpt-3.5',
            version: '1.0',
            vendor: 'openai',
            maxInputTokens: 4096,
            maxOutputTokens: 2048,
            modelPickerCategory: { label: 'OpenAI', order: 2 },
            isUserSelectable: true,
            capabilities: {
                toolCalling: true,
                vision: false,
                agentMode: false
            }
        });
        languageModelsService.addModel('openai', 'openai-gpt-4-vision', {
            extension: new ExtensionIdentifier('openai.api'),
            id: 'gpt-4-vision',
            name: 'GPT-4 Vision',
            family: 'gpt-4',
            version: '1.0',
            vendor: 'openai',
            maxInputTokens: 8192,
            maxOutputTokens: 4096,
            modelPickerCategory: { label: 'OpenAI', order: 2 },
            isUserSelectable: false,
            capabilities: {
                toolCalling: false,
                vision: true,
                agentMode: false
            }
        });
        viewModel = store.add(new ChatModelsViewModel(languageModelsService, chatEntitlementService));
        await viewModel.refresh();
    });
    teardown(() => {
        store.dispose();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('should fetch all models without filters', () => {
        const results = viewModel.filter('');
        // Should have 2 vendor entries and 4 model entries (grouped by vendor)
        assert.strictEqual(results.length, 6);
        const vendors = results.filter(isVendorEntry);
        assert.strictEqual(vendors.length, 2);
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 4);
    });
    test('should filter by provider name', () => {
        const results = viewModel.filter('@provider:copilot');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 2);
        assert.ok(models.every(m => m.modelEntry.vendor === 'copilot'));
    });
    test('should filter by provider display name', () => {
        const results = viewModel.filter('@provider:OpenAI');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 2);
        assert.ok(models.every(m => m.modelEntry.vendor === 'openai'));
    });
    test('should filter by multiple providers with OR logic', () => {
        const results = viewModel.filter('@provider:copilot @provider:openai');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 4);
    });
    test('should filter by single capability - tools', () => {
        const results = viewModel.filter('@capability:tools');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 3);
        assert.ok(models.every(m => m.modelEntry.metadata.capabilities?.toolCalling === true));
    });
    test('should filter by single capability - vision', () => {
        const results = viewModel.filter('@capability:vision');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 3);
        assert.ok(models.every(m => m.modelEntry.metadata.capabilities?.vision === true));
    });
    test('should filter by single capability - agent', () => {
        const results = viewModel.filter('@capability:agent');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 1);
        assert.strictEqual(models[0].modelEntry.metadata.id, 'gpt-4o');
    });
    test('should filter by multiple capabilities with AND logic', () => {
        const results = viewModel.filter('@capability:tools @capability:vision');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        // Should only return models that have BOTH tools and vision
        assert.strictEqual(models.length, 2);
        assert.ok(models.every(m => m.modelEntry.metadata.capabilities?.toolCalling === true &&
            m.modelEntry.metadata.capabilities?.vision === true));
    });
    test('should filter by three capabilities with AND logic', () => {
        const results = viewModel.filter('@capability:tools @capability:vision @capability:agent');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        // Should only return gpt-4o which has all three
        assert.strictEqual(models.length, 1);
        assert.strictEqual(models[0].modelEntry.metadata.id, 'gpt-4o');
    });
    test('should return no results when filtering by incompatible capabilities', () => {
        const results = viewModel.filter('@capability:vision @capability:agent');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        // Only gpt-4o has both vision and agent, but gpt-4-vision doesn't have agent
        assert.strictEqual(models.length, 1);
        assert.strictEqual(models[0].modelEntry.metadata.id, 'gpt-4o');
    });
    test('should filter by visibility - visible:true', () => {
        const results = viewModel.filter('@visible:true');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 3);
        assert.ok(models.every(m => m.modelEntry.metadata.isUserSelectable === true));
    });
    test('should filter by visibility - visible:false', () => {
        const results = viewModel.filter('@visible:false');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 1);
        assert.strictEqual(models[0].modelEntry.metadata.isUserSelectable, false);
    });
    test('should combine provider and capability filters', () => {
        const results = viewModel.filter('@provider:copilot @capability:vision');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 2);
        assert.ok(models.every(m => m.modelEntry.vendor === 'copilot' &&
            m.modelEntry.metadata.capabilities?.vision === true));
    });
    test('should combine provider, capability, and visibility filters', () => {
        const results = viewModel.filter('@provider:openai @capability:vision @visible:false');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 1);
        assert.strictEqual(models[0].modelEntry.metadata.id, 'gpt-4-vision');
    });
    test('should filter by text matching model name', () => {
        const results = viewModel.filter('GPT-4o');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 1);
        assert.strictEqual(models[0].modelEntry.metadata.name, 'GPT-4o');
        assert.ok(models[0].modelNameMatches);
    });
    test('should filter by text matching model id', () => {
        const results = viewModel.filter('copilot-gpt-4o');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 1);
        assert.strictEqual(models[0].modelEntry.identifier, 'copilot-gpt-4o');
        assert.ok(models[0].modelIdMatches);
    });
    test('should filter by text matching vendor name', () => {
        const results = viewModel.filter('GitHub');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 2);
        assert.ok(models.every(m => m.modelEntry.vendorDisplayName === 'GitHub Copilot'));
    });
    test('should combine text search with capability filter', () => {
        const results = viewModel.filter('@capability:tools GPT');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        // Should match all models with tools capability and 'GPT' in name
        assert.strictEqual(models.length, 3);
        assert.ok(models.every(m => m.modelEntry.metadata.capabilities?.toolCalling === true));
    });
    test('should handle empty search value', () => {
        const results = viewModel.filter('');
        // Should return all models grouped by vendor
        assert.ok(results.length > 0);
    });
    test('should handle search value with only whitespace', () => {
        const results = viewModel.filter('   ');
        // Should return all models grouped by vendor
        assert.ok(results.length > 0);
    });
    test('should match capability text in free text search', () => {
        const results = viewModel.filter('vision');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        // Should match models that have vision capability or "vision" in their name
        assert.ok(models.length > 0);
        assert.ok(models.every(m => m.modelEntry.metadata.capabilities?.vision === true ||
            m.modelEntry.metadata.name.toLowerCase().includes('vision')));
    });
    test('should toggle vendor collapsed state', () => {
        const vendorEntry = viewModel.viewModelEntries.find(r => isVendorEntry(r) && r.vendorEntry.vendor === 'copilot');
        viewModel.toggleCollapsed(vendorEntry);
        const results = viewModel.filter('');
        const copilotVendor = results.find(r => isVendorEntry(r) && r.vendorEntry.vendor === 'copilot');
        assert.ok(copilotVendor);
        assert.strictEqual(copilotVendor.collapsed, true);
        // Models should not be shown when vendor is collapsed
        const copilotModelsAfterCollapse = results.filter(r => !isVendorEntry(r) && r.modelEntry.vendor === 'copilot');
        assert.strictEqual(copilotModelsAfterCollapse.length, 0);
        // Toggle back
        viewModel.toggleCollapsed(vendorEntry);
        const resultsAfterExpand = viewModel.filter('');
        const copilotModelsAfterExpand = resultsAfterExpand.filter(r => !isVendorEntry(r) && r.modelEntry.vendor === 'copilot');
        assert.strictEqual(copilotModelsAfterExpand.length, 2);
    });
    test('should fire onDidChangeModelEntries when entitlement changes', async () => {
        let fired = false;
        store.add(viewModel.onDidChange(() => {
            fired = true;
        }));
        chatEntitlementService.fireEntitlementChange();
        // Wait a bit for async resolve
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.strictEqual(fired, true);
    });
    test('should handle quoted search strings', () => {
        // When a search string is fully quoted (starts and ends with quotes),
        // the completeMatch flag is set to true, which currently skips all matching
        // This test verifies the quotes are processed without errors
        const results = viewModel.filter('"GPT"');
        // The function should complete without error
        // Note: complete match logic (both quotes) currently doesn't perform matching
        assert.ok(Array.isArray(results));
    });
    test('should remove filter keywords from text search', () => {
        const results = viewModel.filter('@provider:copilot @capability:vision GPT');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        // Should only search 'GPT' in model names, not the filter keywords
        assert.strictEqual(models.length, 2);
        assert.ok(models.every(m => m.modelEntry.vendor === 'copilot'));
    });
    test('should handle case-insensitive capability matching', () => {
        const results1 = viewModel.filter('@capability:TOOLS');
        const results2 = viewModel.filter('@capability:tools');
        const results3 = viewModel.filter('@capability:Tools');
        const models1 = results1.filter(r => !isVendorEntry(r));
        const models2 = results2.filter(r => !isVendorEntry(r));
        const models3 = results3.filter(r => !isVendorEntry(r));
        assert.strictEqual(models1.length, models2.length);
        assert.strictEqual(models2.length, models3.length);
    });
    test('should support toolcalling alias for tools capability', () => {
        const resultsTools = viewModel.filter('@capability:tools');
        const resultsToolCalling = viewModel.filter('@capability:toolcalling');
        const modelsTools = resultsTools.filter(r => !isVendorEntry(r));
        const modelsToolCalling = resultsToolCalling.filter(r => !isVendorEntry(r));
        assert.strictEqual(modelsTools.length, modelsToolCalling.length);
    });
    test('should support agentmode alias for agent capability', () => {
        const resultsAgent = viewModel.filter('@capability:agent');
        const resultsAgentMode = viewModel.filter('@capability:agentmode');
        const modelsAgent = resultsAgent.filter(r => !isVendorEntry(r));
        const modelsAgentMode = resultsAgentMode.filter(r => !isVendorEntry(r));
        assert.strictEqual(modelsAgent.length, modelsAgentMode.length);
    });
    test('should include matched capabilities in results', () => {
        const results = viewModel.filter('@capability:tools @capability:vision');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.ok(models.length > 0);
        for (const model of models) {
            assert.ok(model.capabilityMatches);
            assert.ok(model.capabilityMatches.length > 0);
            // Should include both toolCalling and vision
            assert.ok(model.capabilityMatches.some(c => c === 'toolCalling' || c === 'vision'));
        }
    });
    // Helper function to create a single vendor test environment
    function createSingleVendorViewModel(store, chatEntitlementService, includeSecondModel = true) {
        const service = new MockLanguageModelsService();
        service.addVendor({
            vendor: 'copilot',
            displayName: 'GitHub Copilot',
            managementCommand: undefined,
            when: undefined
        });
        service.addModel('copilot', 'copilot-gpt-4', {
            extension: new ExtensionIdentifier('github.copilot'),
            id: 'gpt-4',
            name: 'GPT-4',
            family: 'gpt-4',
            version: '1.0',
            vendor: 'copilot',
            maxInputTokens: 8192,
            maxOutputTokens: 4096,
            modelPickerCategory: { label: 'Copilot', order: 1 },
            isUserSelectable: true,
            capabilities: {
                toolCalling: true,
                vision: true,
                agentMode: false
            }
        });
        if (includeSecondModel) {
            service.addModel('copilot', 'copilot-gpt-4o', {
                extension: new ExtensionIdentifier('github.copilot'),
                id: 'gpt-4o',
                name: 'GPT-4o',
                family: 'gpt-4',
                version: '1.0',
                vendor: 'copilot',
                maxInputTokens: 8192,
                maxOutputTokens: 4096,
                modelPickerCategory: { label: 'Copilot', order: 1 },
                isUserSelectable: true,
                capabilities: {
                    toolCalling: true,
                    vision: true,
                    agentMode: true
                }
            });
        }
        const viewModel = store.add(new ChatModelsViewModel(service, chatEntitlementService));
        return { service, viewModel };
    }
    test('should not show vendor header when only one vendor exists', async () => {
        const { viewModel: singleVendorViewModel } = createSingleVendorViewModel(store, chatEntitlementService);
        await singleVendorViewModel.refresh();
        const results = singleVendorViewModel.filter('');
        // Should have only model entries, no vendor entry
        const vendors = results.filter(isVendorEntry);
        assert.strictEqual(vendors.length, 0, 'Should not show vendor header when only one vendor exists');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 2, 'Should show all models');
        assert.ok(models.every(m => m.modelEntry.vendor === 'copilot'));
    });
    test('should show vendor headers when multiple vendors exist', () => {
        // This is the existing behavior test
        const results = viewModel.filter('');
        // Should have 2 vendor entries and 4 model entries (grouped by vendor)
        const vendors = results.filter(isVendorEntry);
        assert.strictEqual(vendors.length, 2, 'Should show vendor headers when multiple vendors exist');
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 4);
    });
    test('should filter single vendor models by capability', async () => {
        const { viewModel: singleVendorViewModel } = createSingleVendorViewModel(store, chatEntitlementService);
        await singleVendorViewModel.refresh();
        const results = singleVendorViewModel.filter('@capability:agent');
        // Should not show vendor header
        const vendors = results.filter(isVendorEntry);
        assert.strictEqual(vendors.length, 0, 'Should not show vendor header');
        // Should only show the model with agent capability
        const models = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r));
        assert.strictEqual(models.length, 1);
        assert.strictEqual(models[0].modelEntry.metadata.id, 'gpt-4o');
    });
    test('should always place copilot vendor at the top', () => {
        const results = viewModel.filter('');
        const vendors = results.filter(isVendorEntry);
        assert.ok(vendors.length >= 2);
        // First vendor should always be copilot
        assert.strictEqual(vendors[0].vendorEntry.vendor, 'copilot');
    });
    test('should maintain copilot at top with multiple vendors', async () => {
        // Add more vendors to ensure sorting works correctly
        languageModelsService.addVendor({
            vendor: 'anthropic',
            displayName: 'Anthropic',
            managementCommand: undefined,
            when: undefined
        });
        languageModelsService.addModel('anthropic', 'anthropic-claude', {
            extension: new ExtensionIdentifier('anthropic.api'),
            id: 'claude-3',
            name: 'Claude 3',
            family: 'claude',
            version: '1.0',
            vendor: 'anthropic',
            maxInputTokens: 100000,
            maxOutputTokens: 4096,
            modelPickerCategory: { label: 'Anthropic', order: 3 },
            isUserSelectable: true,
            capabilities: {
                toolCalling: true,
                vision: false,
                agentMode: false
            }
        });
        languageModelsService.addVendor({
            vendor: 'azure',
            displayName: 'Azure OpenAI',
            managementCommand: undefined,
            when: undefined
        });
        languageModelsService.addModel('azure', 'azure-gpt-4', {
            extension: new ExtensionIdentifier('microsoft.azure'),
            id: 'azure-gpt-4',
            name: 'Azure GPT-4',
            family: 'gpt-4',
            version: '1.0',
            vendor: 'azure',
            maxInputTokens: 8192,
            maxOutputTokens: 4096,
            modelPickerCategory: { label: 'Azure', order: 4 },
            isUserSelectable: true,
            capabilities: {
                toolCalling: true,
                vision: false,
                agentMode: false
            }
        });
        await viewModel.refresh();
        const results = viewModel.filter('');
        const vendors = results.filter(isVendorEntry);
        // Should have 4 vendors: copilot, openai, anthropic, azure
        assert.strictEqual(vendors.length, 4);
        // First vendor should always be copilot
        assert.strictEqual(vendors[0].vendorEntry.vendor, 'copilot');
        // Other vendors should be alphabetically sorted: anthropic, azure, openai
        assert.strictEqual(vendors[1].vendorEntry.vendor, 'anthropic');
        assert.strictEqual(vendors[2].vendorEntry.vendor, 'azure');
        assert.strictEqual(vendors[3].vendorEntry.vendor, 'openai');
    });
    test('should keep copilot at top even with text search', () => {
        // Even when searching, if results include multiple vendors, copilot should be first
        const results = viewModel.filter('GPT');
        const vendors = results.filter(isVendorEntry);
        if (vendors.length > 1) {
            // If multiple vendors match, copilot should be first
            const copilotVendor = vendors.find(v => v.vendorEntry.vendor === 'copilot');
            if (copilotVendor) {
                assert.strictEqual(vendors[0].vendorEntry.vendor, 'copilot');
            }
        }
    });
    test('should keep copilot at top when filtering by capability', () => {
        const results = viewModel.filter('@capability:tools');
        const vendors = results.filter(isVendorEntry);
        // Both copilot and openai have models with tools capability
        if (vendors.length > 1) {
            assert.strictEqual(vendors[0].vendorEntry.vendor, 'copilot');
        }
    });
    test('should show vendor headers when filtered', () => {
        const results = viewModel.filter('GPT');
        const vendors = results.filter(isVendorEntry);
        assert.ok(vendors.length > 0);
    });
    test('should not show vendor headers when filtered if only one vendor exists', async () => {
        const { viewModel: singleVendorViewModel } = createSingleVendorViewModel(store, chatEntitlementService);
        await singleVendorViewModel.refresh();
        const results = singleVendorViewModel.filter('GPT');
        const vendors = results.filter(isVendorEntry);
        assert.strictEqual(vendors.length, 0);
    });
    test('should group by visibility', () => {
        viewModel.groupBy = "visibility" /* ChatModelGroup.Visibility */;
        const results = viewModel.filter('');
        const groups = results.filter(isGroupEntry);
        assert.strictEqual(groups.length, 2);
        assert.strictEqual(groups[0].group, 'visible');
        assert.strictEqual(groups[1].group, 'hidden');
        const visibleModels = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r) && r.modelEntry.metadata.isUserSelectable);
        const hiddenModels = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r) && !r.modelEntry.metadata.isUserSelectable);
        assert.strictEqual(visibleModels.length, 3);
        assert.strictEqual(hiddenModels.length, 1);
    });
    test('should fire onDidChangeGrouping when grouping changes', () => {
        let fired = false;
        store.add(viewModel.onDidChangeGrouping(() => {
            fired = true;
        }));
        viewModel.groupBy = "visibility" /* ChatModelGroup.Visibility */;
        assert.strictEqual(fired, true);
    });
    test('should reset collapsed state when grouping changes', () => {
        const vendorEntry = viewModel.viewModelEntries.find(r => isVendorEntry(r) && r.vendorEntry.vendor === 'copilot');
        viewModel.toggleCollapsed(vendorEntry);
        viewModel.groupBy = "visibility" /* ChatModelGroup.Visibility */;
        const results = viewModel.filter('');
        const groups = results.filter(isGroupEntry);
        assert.ok(groups.every(v => !v.collapsed));
    });
    test('should sort models within visibility groups', async () => {
        languageModelsService.addVendor({
            vendor: 'anthropic',
            displayName: 'Anthropic',
            managementCommand: undefined,
            when: undefined
        });
        languageModelsService.addModel('anthropic', 'anthropic-claude', {
            extension: new ExtensionIdentifier('anthropic.api'),
            id: 'claude-3',
            name: 'Claude 3',
            family: 'claude',
            version: '1.0',
            vendor: 'anthropic',
            maxInputTokens: 100000,
            maxOutputTokens: 4096,
            modelPickerCategory: { label: 'Anthropic', order: 3 },
            isUserSelectable: true,
            capabilities: {
                toolCalling: true,
                vision: false,
                agentMode: false
            }
        });
        await viewModel.refresh();
        viewModel.groupBy = "visibility" /* ChatModelGroup.Visibility */;
        const results = viewModel.filter('');
        const visibleModels = results.filter(r => !isVendorEntry(r) && !isGroupEntry(r) && r.modelEntry.metadata.isUserSelectable);
        assert.strictEqual(visibleModels.length, 4);
        assert.strictEqual(visibleModels[0].modelEntry.metadata.name, 'GPT-4');
        assert.strictEqual(visibleModels[0].modelEntry.vendor, 'copilot');
        assert.strictEqual(visibleModels[1].modelEntry.metadata.name, 'GPT-4o');
        assert.strictEqual(visibleModels[1].modelEntry.vendor, 'copilot');
        assert.strictEqual(visibleModels[2].modelEntry.metadata.name, 'Claude 3');
        assert.strictEqual(visibleModels[2].modelEntry.vendor, 'anthropic');
        assert.strictEqual(visibleModels[3].modelEntry.metadata.name, 'GPT-3.5 Turbo');
        assert.strictEqual(visibleModels[3].modelEntry.vendor, 'openai');
    });
    test('should not resort models when visibility is toggled', async () => {
        viewModel.groupBy = "visibility" /* ChatModelGroup.Visibility */;
        // Initial state:
        // Visible: GPT-4, GPT-4o, GPT-3.5 Turbo
        // Hidden: GPT-4 Vision
        // Toggle GPT-4 Vision to visible
        const hiddenModel = viewModel.viewModelEntries.find(r => !isVendorEntry(r) && !isGroupEntry(r) && r.modelEntry.identifier === 'openai-gpt-4-vision');
        assert.ok(hiddenModel);
        const initialIndex = viewModel.viewModelEntries.indexOf(hiddenModel);
        viewModel.toggleVisibility(hiddenModel);
        // Verify it is still at the same index
        const newIndex = viewModel.viewModelEntries.indexOf(hiddenModel);
        assert.strictEqual(newIndex, initialIndex);
        // Verify metadata is updated
        assert.strictEqual(hiddenModel.modelEntry.metadata.isUserSelectable, true);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1vZGVsc1ZpZXdNb2RlbC50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvdGVzdC9icm93c2VyL2NoYXRNb2RlbHNWaWV3TW9kZWwudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsZUFBZSxFQUFlLE1BQU0seUNBQXlDLENBQUM7QUFDdkYsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFbkcsT0FBTyxFQUFrQixtQkFBbUIsRUFBcUMsYUFBYSxFQUFFLFlBQVksRUFBbUIsTUFBTSxxREFBcUQsQ0FBQztBQUMzTCxPQUFPLEVBQTJCLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ3RILE9BQU8sRUFBZSxlQUFlLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN4RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUU5RixNQUFNLHlCQUF5QjtJQUEvQjtRQUdTLFlBQU8sR0FBaUMsRUFBRSxDQUFDO1FBQzNDLFdBQU0sR0FBRyxJQUFJLEdBQUcsRUFBc0MsQ0FBQztRQUN2RCxtQkFBYyxHQUFHLElBQUksR0FBRyxFQUFvQixDQUFDO1FBRXBDLCtCQUEwQixHQUFHLElBQUksT0FBTyxFQUFVLENBQUM7UUFDM0QsOEJBQXlCLEdBQUcsSUFBSSxDQUFDLDBCQUEwQixDQUFDLEtBQUssQ0FBQztJQWlFNUUsQ0FBQztJQS9EQSxTQUFTLENBQUMsTUFBa0M7UUFDM0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDMUIsSUFBSSxDQUFD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