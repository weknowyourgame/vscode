/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ResourceMap } from '../../../../base/common/map.js';
import { join } from '../../../../base/common/path.js';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { Configuration, ConfigurationChangeEvent, ConfigurationModel, ConfigurationModelParser, mergeChanges } from '../../common/configurationModels.js';
import { Extensions } from '../../common/configurationRegistry.js';
import { NullLogService } from '../../../log/common/log.js';
import { Registry } from '../../../registry/common/platform.js';
import { WorkspaceFolder } from '../../../workspace/common/workspace.js';
import { Workspace } from '../../../workspace/test/common/testWorkspace.js';
suite('ConfigurationModelParser', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    suiteSetup(() => {
        Registry.as(Extensions.Configuration).registerConfiguration({
            'id': 'ConfigurationModelParserTest',
            'type': 'object',
            'properties': {
                'ConfigurationModelParserTest.windowSetting': {
                    'type': 'string',
                    'default': 'isSet',
                }
            }
        });
    });
    test('parse configuration model with single override identifier', () => {
        const testObject = new ConfigurationModelParser('', new NullLogService());
        testObject.parse(JSON.stringify({ '[x]': { 'a': 1 } }));
        assert.deepStrictEqual(JSON.stringify(testObject.configurationModel.overrides), JSON.stringify([{ identifiers: ['x'], keys: ['a'], contents: { 'a': 1 } }]));
    });
    test('parse configuration model with multiple override identifiers', () => {
        const testObject = new ConfigurationModelParser('', new NullLogService());
        testObject.parse(JSON.stringify({ '[x][y]': { 'a': 1 } }));
        assert.deepStrictEqual(JSON.stringify(testObject.configurationModel.overrides), JSON.stringify([{ identifiers: ['x', 'y'], keys: ['a'], contents: { 'a': 1 } }]));
    });
    test('parse configuration model with multiple duplicate override identifiers', () => {
        const testObject = new ConfigurationModelParser('', new NullLogService());
        testObject.parse(JSON.stringify({ '[x][y][x][z]': { 'a': 1 } }));
        assert.deepStrictEqual(JSON.stringify(testObject.configurationModel.overrides), JSON.stringify([{ identifiers: ['x', 'y', 'z'], keys: ['a'], contents: { 'a': 1 } }]));
    });
    test('parse configuration model with exclude option', () => {
        const testObject = new ConfigurationModelParser('', new NullLogService());
        testObject.parse(JSON.stringify({ 'a': 1, 'b': 2 }), { exclude: ['a'] });
        assert.strictEqual(testObject.configurationModel.getValue('a'), undefined);
        assert.strictEqual(testObject.configurationModel.getValue('b'), 2);
    });
    test('parse configuration model with exclude option even included', () => {
        const testObject = new ConfigurationModelParser('', new NullLogService());
        testObject.parse(JSON.stringify({ 'a': 1, 'b': 2 }), { exclude: ['a'], include: ['a'] });
        assert.strictEqual(testObject.configurationModel.getValue('a'), undefined);
        assert.strictEqual(testObject.configurationModel.getValue('b'), 2);
    });
    test('parse configuration model with scopes filter', () => {
        const testObject = new ConfigurationModelParser('', new NullLogService());
        testObject.parse(JSON.stringify({ 'ConfigurationModelParserTest.windowSetting': '1' }), { scopes: [1 /* ConfigurationScope.APPLICATION */] });
        assert.strictEqual(testObject.configurationModel.getValue('ConfigurationModelParserTest.windowSetting'), undefined);
    });
    test('parse configuration model with include option', () => {
        const testObject = new ConfigurationModelParser('', new NullLogService());
        testObject.parse(JSON.stringify({ 'ConfigurationModelParserTest.windowSetting': '1' }), { include: ['ConfigurationModelParserTest.windowSetting'], scopes: [1 /* ConfigurationScope.APPLICATION */] });
        assert.strictEqual(testObject.configurationModel.getValue('ConfigurationModelParserTest.windowSetting'), '1');
    });
    test('parse configuration model with invalid setting key', () => {
        const testObject = new ConfigurationModelParser('', new NullLogService());
        testObject.parse(JSON.stringify({ 'a': null, 'a.b.c': { c: 1 } }));
        assert.strictEqual(testObject.configurationModel.getValue('a'), null);
        assert.strictEqual(testObject.configurationModel.getValue('a.b'), undefined);
        assert.strictEqual(testObject.configurationModel.getValue('a.b.c'), undefined);
    });
});
suite('ConfigurationModelParser - Excluded Properties', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    const configurationRegistry = Registry.as(Extensions.Configuration);
    let testConfigurationNodes = [];
    setup(() => reset());
    teardown(() => reset());
    function reset() {
        if (testConfigurationNodes.length > 0) {
            configurationRegistry.deregisterConfigurations(testConfigurationNodes);
            testConfigurationNodes = [];
        }
    }
    function registerTestConfiguration() {
        const node = {
            'id': 'ExcludedPropertiesTest',
            'type': 'object',
            'properties': {
                'regularProperty': {
                    'type': 'string',
                    'default': 'regular',
                    'restricted': false
                },
                'restrictedProperty': {
                    'type': 'string',
                    'default': 'restricted',
                    'restricted': true
                },
                'excludedProperty': {
                    'type': 'string',
                    'default': 'excluded',
                    'restricted': true,
                    'included': false
                },
                'excludedNonRestrictedProperty': {
                    'type': 'string',
                    'default': 'excludedNonRestricted',
                    'restricted': false,
                    'included': false
                }
            }
        };
        configurationRegistry.registerConfiguration(node);
        testConfigurationNodes.push(node);
        return node;
    }
    test('should handle excluded restricted properties correctly', () => {
        registerTestConfiguration();
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        const testData = {
            'regularProperty': 'regularValue',
            'restrictedProperty': 'restrictedValue',
            'excludedProperty': 'excludedValue',
            'excludedNonRestrictedProperty': 'excludedNonRestrictedValue'
        };
        testObject.parse(JSON.stringify(testData), { skipRestricted: true });
        assert.strictEqual(testObject.configurationModel.getValue('regularProperty'), 'regularValue');
        assert.strictEqual(testObject.configurationModel.getValue('restrictedProperty'), undefined);
        assert.strictEqual(testObject.configurationModel.getValue('excludedProperty'), 'excludedValue');
        assert.strictEqual(testObject.configurationModel.getValue('excludedNonRestrictedProperty'), 'excludedNonRestrictedValue');
        assert.ok(testObject.restrictedConfigurations.includes('restrictedProperty'));
        assert.ok(!testObject.restrictedConfigurations.includes('excludedProperty'));
    });
    test('should find excluded properties when checking for restricted settings', () => {
        registerTestConfiguration();
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        const testData = {
            'excludedProperty': 'excludedValue'
        };
        testObject.parse(JSON.stringify(testData));
        assert.strictEqual(testObject.configurationModel.getValue('excludedProperty'), 'excludedValue');
        assert.ok(!testObject.restrictedConfigurations.includes('excludedProperty'));
    });
    test('should handle override properties with excluded configurations', () => {
        registerTestConfiguration();
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        const testData = {
            '[typescript]': {
                'regularProperty': 'overrideRegular',
                'restrictedProperty': 'overrideRestricted',
                'excludedProperty': 'overrideExcluded'
            }
        };
        testObject.parse(JSON.stringify(testData), { skipRestricted: true });
        const overrideConfig = testObject.configurationModel.override('typescript');
        assert.strictEqual(overrideConfig.getValue('regularProperty'), 'overrideRegular');
        assert.strictEqual(overrideConfig.getValue('restrictedProperty'), undefined);
        assert.strictEqual(overrideConfig.getValue('excludedProperty'), 'overrideExcluded');
    });
    test('should handle scope filtering with excluded properties', () => {
        const node = {
            'id': 'ScopeExcludedTest',
            'type': 'object',
            'properties': {
                'windowProperty': {
                    'type': 'string',
                    'default': 'window',
                    'scope': 4 /* ConfigurationScope.WINDOW */
                },
                'applicationProperty': {
                    'type': 'string',
                    'default': 'application',
                    'scope': 1 /* ConfigurationScope.APPLICATION */
                },
                'excludedApplicationProperty': {
                    'type': 'string',
                    'default': 'excludedApplication',
                    'scope': 1 /* ConfigurationScope.APPLICATION */,
                    'included': false
                }
            }
        };
        configurationRegistry.registerConfiguration(node);
        testConfigurationNodes.push(node);
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        const testData = {
            'windowProperty': 'windowValue',
            'applicationProperty': 'applicationValue',
            'excludedApplicationProperty': 'excludedApplicationValue'
        };
        testObject.parse(JSON.stringify(testData), { scopes: [4 /* ConfigurationScope.WINDOW */] });
        assert.strictEqual(testObject.configurationModel.getValue('windowProperty'), 'windowValue');
        assert.strictEqual(testObject.configurationModel.getValue('applicationProperty'), undefined);
        assert.strictEqual(testObject.configurationModel.getValue('excludedApplicationProperty'), undefined);
    });
    test('filter should handle include/exclude options with excluded properties', () => {
        registerTestConfiguration();
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        const testData = {
            'regularProperty': 'regularValue',
            'excludedProperty': 'excludedValue'
        };
        testObject.parse(JSON.stringify(testData), { include: ['excludedProperty'] });
        assert.strictEqual(testObject.configurationModel.getValue('regularProperty'), 'regularValue');
        assert.strictEqual(testObject.configurationModel.getValue('excludedProperty'), 'excludedValue');
    });
    test('should handle exclude options with excluded properties', () => {
        registerTestConfiguration();
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        const testData = {
            'regularProperty': 'regularValue',
            'excludedProperty': 'excludedValue'
        };
        testObject.parse(JSON.stringify(testData), { exclude: ['regularProperty'] });
        assert.strictEqual(testObject.configurationModel.getValue('regularProperty'), undefined);
        assert.strictEqual(testObject.configurationModel.getValue('excludedProperty'), 'excludedValue');
    });
    test('should report hasExcludedProperties correctly when excluded properties are filtered', () => {
        registerTestConfiguration();
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        const testData = {
            'regularProperty': 'regularValue',
            'restrictedProperty': 'restrictedValue',
            'excludedProperty': 'excludedValue'
        };
        testObject.parse(JSON.stringify(testData), { skipRestricted: true });
        const model = testObject.configurationModel;
        assert.notStrictEqual(model.raw, undefined, 'Raw should be set when properties are excluded');
    });
    test('skipUnregistered should exclude unregistered properties', () => {
        registerTestConfiguration();
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        testObject.parse(JSON.stringify({
            'unregisteredProperty': 'value3'
        }), { skipUnregistered: true });
        assert.strictEqual(testObject.configurationModel.getValue('unregisteredProperty'), undefined);
    });
    test('shouldInclude method works correctly with excluded properties for skipUnregistered', () => {
        registerTestConfiguration();
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        testObject.parse(JSON.stringify({
            'regularProperty': 'value1',
            'excludedProperty': 'value2',
            'unregisteredProperty': 'value3'
        }), { skipUnregistered: true });
        assert.strictEqual(testObject.configurationModel.getValue('regularProperty'), 'value1');
        assert.strictEqual(testObject.configurationModel.getValue('excludedProperty'), undefined);
        assert.strictEqual(testObject.configurationModel.getValue('unregisteredProperty'), undefined);
    });
    test('excluded properties are found during property schema lookup', () => {
        registerTestConfiguration();
        const registry = Registry.as(Extensions.Configuration);
        const excludedProperties = registry.getExcludedConfigurationProperties();
        assert.ok(excludedProperties['excludedProperty'], 'Excluded property should be in excluded properties map');
        assert.ok(excludedProperties['excludedNonRestrictedProperty'], 'Excluded non-restricted property should be in excluded properties map');
        const regularProperties = registry.getConfigurationProperties();
        assert.strictEqual(regularProperties['excludedProperty'], undefined, 'Excluded property should not be in regular properties map');
        assert.strictEqual(regularProperties['excludedNonRestrictedProperty'], undefined, 'Excluded non-restricted property should not be in regular properties map');
        assert.ok(regularProperties['regularProperty'], 'Regular property should be in regular properties map');
        assert.ok(regularProperties['restrictedProperty'], 'Restricted property should be in regular properties map');
    });
    test('should correctly use shouldInclude with excluded properties for scope and unregistered filtering', () => {
        registerTestConfiguration();
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        const testData = {
            'regularProperty': 'regularValue',
            'restrictedProperty': 'restrictedValue',
            'excludedProperty': 'excludedValue',
            'excludedNonRestrictedProperty': 'excludedNonRestrictedValue',
            'unknownProperty': 'unknownValue'
        };
        testObject.parse(JSON.stringify(testData), { skipRestricted: true });
        assert.strictEqual(testObject.configurationModel.getValue('regularProperty'), 'regularValue');
        assert.strictEqual(testObject.configurationModel.getValue('restrictedProperty'), undefined);
        assert.ok(testObject.restrictedConfigurations.includes('restrictedProperty'));
        assert.strictEqual(testObject.configurationModel.getValue('excludedProperty'), 'excludedValue');
        assert.ok(!testObject.restrictedConfigurations.includes('excludedProperty'));
        assert.strictEqual(testObject.configurationModel.getValue('excludedNonRestrictedProperty'), 'excludedNonRestrictedValue');
        assert.strictEqual(testObject.configurationModel.getValue('unknownProperty'), 'unknownValue');
    });
});
suite('ConfigurationModel', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('setValue for a key that has no sections and not defined', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': 1 } }, ['a.b'], [], undefined, new NullLogService());
        testObject.setValue('f', 1);
        assert.deepStrictEqual(testObject.contents, { 'a': { 'b': 1 }, 'f': 1 });
        assert.deepStrictEqual(testObject.keys, ['a.b', 'f']);
    });
    test('setValue for a key that has no sections and defined', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': 1 }, 'f': 1 }, ['a.b', 'f'], [], undefined, new NullLogService());
        testObject.setValue('f', 3);
        assert.deepStrictEqual(testObject.contents, { 'a': { 'b': 1 }, 'f': 3 });
        assert.deepStrictEqual(testObject.keys, ['a.b', 'f']);
    });
    test('setValue for a key that has sections and not defined', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': 1 }, 'f': 1 }, ['a.b', 'f'], [], undefined, new NullLogService());
        testObject.setValue('b.c', 1);
        const expected = {};
        expected['a'] = { 'b': 1 };
        expected['f'] = 1;
        expected['b'] = Object.create(null);
        expected['b']['c'] = 1;
        assert.deepStrictEqual(testObject.contents, expected);
        assert.deepStrictEqual(testObject.keys, ['a.b', 'f', 'b.c']);
    });
    test('setValue for a key that has sections and defined', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': 1 }, 'b': { 'c': 1 }, 'f': 1 }, ['a.b', 'b.c', 'f'], [], undefined, new NullLogService());
        testObject.setValue('b.c', 3);
        assert.deepStrictEqual(testObject.contents, { 'a': { 'b': 1 }, 'b': { 'c': 3 }, 'f': 1 });
        assert.deepStrictEqual(testObject.keys, ['a.b', 'b.c', 'f']);
    });
    test('setValue for a key that has sections and sub section not defined', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': 1 }, 'f': 1 }, ['a.b', 'f'], [], undefined, new NullLogService());
        testObject.setValue('a.c', 1);
        assert.deepStrictEqual(testObject.contents, { 'a': { 'b': 1, 'c': 1 }, 'f': 1 });
        assert.deepStrictEqual(testObject.keys, ['a.b', 'f', 'a.c']);
    });
    test('setValue for a key that has sections and sub section defined', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': 1, 'c': 1 }, 'f': 1 }, ['a.b', 'a.c', 'f'], [], undefined, new NullLogService());
        testObject.setValue('a.c', 3);
        assert.deepStrictEqual(testObject.contents, { 'a': { 'b': 1, 'c': 3 }, 'f': 1 });
        assert.deepStrictEqual(testObject.keys, ['a.b', 'a.c', 'f']);
    });
    test('setValue for a key that has sections and last section is added', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': {} }, 'f': 1 }, ['a.b', 'f'], [], undefined, new NullLogService());
        testObject.setValue('a.b.c', 1);
        assert.deepStrictEqual(testObject.contents, { 'a': { 'b': { 'c': 1 } }, 'f': 1 });
        assert.deepStrictEqual(testObject.keys, ['a.b', 'f', 'a.b.c']);
    });
    test('removeValue: remove a non existing key', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': 2 } }, ['a.b'], [], undefined, new NullLogService());
        testObject.removeValue('a.b.c');
        assert.deepStrictEqual(testObject.contents, { 'a': { 'b': 2 } });
        assert.deepStrictEqual(testObject.keys, ['a.b']);
    });
    test('removeValue: remove a single segmented key', () => {
        const testObject = new ConfigurationModel({ 'a': 1 }, ['a'], [], undefined, new NullLogService());
        testObject.removeValue('a');
        assert.deepStrictEqual(testObject.contents, {});
        assert.deepStrictEqual(testObject.keys, []);
    });
    test('removeValue: remove a multi segmented key', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': 1 } }, ['a.b'], [], undefined, new NullLogService());
        testObject.removeValue('a.b');
        assert.deepStrictEqual(testObject.contents, {});
        assert.deepStrictEqual(testObject.keys, []);
    });
    test('get overriding configuration model for an existing identifier', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': 1 }, 'f': 1 }, [], [{ identifiers: ['c'], contents: { 'a': { 'd': 1 } }, keys: ['a'] }], [], new NullLogService());
        assert.deepStrictEqual(testObject.override('c').contents, { 'a': { 'b': 1, 'd': 1 }, 'f': 1 });
    });
    test('get overriding configuration model for an identifier that does not exist', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': 1 }, 'f': 1 }, [], [{ identifiers: ['c'], contents: { 'a': { 'd': 1 } }, keys: ['a'] }], [], new NullLogService());
        assert.deepStrictEqual(testObject.override('xyz').contents, { 'a': { 'b': 1 }, 'f': 1 });
    });
    test('get overriding configuration when one of the keys does not exist in base', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': 1 }, 'f': 1 }, [], [{ identifiers: ['c'], contents: { 'a': { 'd': 1 }, 'g': 1 }, keys: ['a', 'g'] }], [], new NullLogService());
        assert.deepStrictEqual(testObject.override('c').contents, { 'a': { 'b': 1, 'd': 1 }, 'f': 1, 'g': 1 });
    });
    test('get overriding configuration when one of the key in base is not of object type', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': 1 }, 'f': 1 }, [], [{ identifiers: ['c'], contents: { 'a': { 'd': 1 }, 'f': { 'g': 1 } }, keys: ['a', 'f'] }], [], new NullLogService());
        assert.deepStrictEqual(testObject.override('c').contents, { 'a': { 'b': 1, 'd': 1 }, 'f': { 'g': 1 } });
    });
    test('get overriding configuration when one of the key in overriding contents is not of object type', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': 1 }, 'f': { 'g': 1 } }, [], [{ identifiers: ['c'], contents: { 'a': { 'd': 1 }, 'f': 1 }, keys: ['a', 'f'] }], [], new NullLogService());
        assert.deepStrictEqual(testObject.override('c').contents, { 'a': { 'b': 1, 'd': 1 }, 'f': 1 });
    });
    test('get overriding configuration if the value of overriding identifier is not object', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': 1 }, 'f': { 'g': 1 } }, [], [{ identifiers: ['c'], contents: 'abc', keys: [] }], [], new NullLogService());
        assert.deepStrictEqual(testObject.override('c').contents, { 'a': { 'b': 1 }, 'f': { 'g': 1 } });
    });
    test('get overriding configuration if the value of overriding identifier is an empty object', () => {
        const testObject = new ConfigurationModel({ 'a': { 'b': 1 }, 'f': { 'g': 1 } }, [], [{ identifiers: ['c'], contents: {}, keys: [] }], [], new NullLogService());
        assert.deepStrictEqual(testObject.override('c').contents, { 'a': { 'b': 1 }, 'f': { 'g': 1 } });
    });
    test('simple merge', () => {
        const base = new ConfigurationModel({ 'a': 1, 'b': 2 }, ['a', 'b'], [], undefined, new NullLogService());
        const add = new ConfigurationModel({ 'a': 3, 'c': 4 }, ['a', 'c'], [], undefined, new NullLogService());
        const result = base.merge(add);
        assert.deepStrictEqual(result.contents, { 'a': 3, 'b': 2, 'c': 4 });
        assert.deepStrictEqual(result.keys, ['a', 'b', 'c']);
    });
    test('recursive merge', () => {
        const base = new ConfigurationModel({ 'a': { 'b': 1 } }, ['a.b'], [], undefined, new NullLogService());
        const add = new ConfigurationModel({ 'a': { 'b': 2 } }, ['a.b'], [], undefined, new NullLogService());
        const result = base.merge(add);
        assert.deepStrictEqual(result.contents, { 'a': { 'b': 2 } });
        assert.deepStrictEqual(result.getValue('a'), { 'b': 2 });
        assert.deepStrictEqual(result.keys, ['a.b']);
    });
    test('simple merge overrides', () => {
        const base = new ConfigurationModel({ 'a': { 'b': 1 } }, ['a.b'], [{ identifiers: ['c'], contents: { 'a': 2 }, keys: ['a'] }], undefined, new NullLogService());
        const add = new ConfigurationModel({ 'a': { 'b': 2 } }, ['a.b'], [{ identifiers: ['c'], contents: { 'b': 2 }, keys: ['b'] }], undefined, new NullLogService());
        const result = base.merge(add);
        assert.deepStrictEqual(result.contents, { 'a': { 'b': 2 } });
        assert.deepStrictEqual(result.overrides, [{ identifiers: ['c'], contents: { 'a': 2, 'b': 2 }, keys: ['a', 'b'] }]);
        assert.deepStrictEqual(result.override('c').contents, { 'a': 2, 'b': 2 });
        assert.deepStrictEqual(result.keys, ['a.b']);
    });
    test('recursive merge overrides', () => {
        const base = new ConfigurationModel({ 'a': { 'b': 1 }, 'f': 1 }, ['a.b', 'f'], [{ identifiers: ['c'], contents: { 'a': { 'd': 1 } }, keys: ['a'] }], undefined, new NullLogService());
        const add = new ConfigurationModel({ 'a': { 'b': 2 } }, ['a.b'], [{ identifiers: ['c'], contents: { 'a': { 'e': 2 } }, keys: ['a'] }], undefined, new NullLogService());
        const result = base.merge(add);
        assert.deepStrictEqual(result.contents, { 'a': { 'b': 2 }, 'f': 1 });
        assert.deepStrictEqual(result.overrides, [{ identifiers: ['c'], contents: { 'a': { 'd': 1, 'e': 2 } }, keys: ['a'] }]);
        assert.deepStrictEqual(result.override('c').contents, { 'a': { 'b': 2, 'd': 1, 'e': 2 }, 'f': 1 });
        assert.deepStrictEqual(result.keys, ['a.b', 'f']);
    });
    test('Test contents while getting an existing property', () => {
        let testObject = new ConfigurationModel({ 'a': 1 }, [], [], undefined, new NullLogService());
        assert.deepStrictEqual(testObject.getValue('a'), 1);
        testObject = new ConfigurationModel({ 'a': { 'b': 1 } }, [], [], undefined, new NullLogService());
        assert.deepStrictEqual(testObject.getValue('a'), { 'b': 1 });
    });
    test('Test contents are undefined for non existing properties', () => {
        const testObject = new ConfigurationModel({ awesome: true }, [], [], undefined, new NullLogService());
        assert.deepStrictEqual(testObject.getValue('unknownproperty'), undefined);
    });
    test('Test override gives all content merged with overrides', () => {
        const testObject = new ConfigurationModel({ 'a': 1, 'c': 1 }, [], [{ identifiers: ['b'], contents: { 'a': 2 }, keys: ['a'] }], undefined, new NullLogService());
        assert.deepStrictEqual(testObject.override('b').contents, { 'a': 2, 'c': 1 });
    });
    test('Test override when an override has multiple identifiers', () => {
        const testObject = new ConfigurationModel({ 'a': 1, 'c': 1 }, ['a', 'c'], [{ identifiers: ['x', 'y'], contents: { 'a': 2 }, keys: ['a'] }], undefined, new NullLogService());
        let actual = testObject.override('x');
        assert.deepStrictEqual(actual.contents, { 'a': 2, 'c': 1 });
        assert.deepStrictEqual(actual.keys, ['a', 'c']);
        assert.deepStrictEqual(testObject.getKeysForOverrideIdentifier('x'), ['a']);
        actual = testObject.override('y');
        assert.deepStrictEqual(actual.contents, { 'a': 2, 'c': 1 });
        assert.deepStrictEqual(actual.keys, ['a', 'c']);
        assert.deepStrictEqual(testObject.getKeysForOverrideIdentifier('y'), ['a']);
    });
    test('Test override when an identifier is defined in multiple overrides', () => {
        const testObject = new ConfigurationModel({ 'a': 1, 'c': 1 }, ['a', 'c'], [{ identifiers: ['x'], contents: { 'a': 3, 'b': 1 }, keys: ['a', 'b'] }, { identifiers: ['x', 'y'], contents: { 'a': 2 }, keys: ['a'] }], undefined, new NullLogService());
        const actual = testObject.override('x');
        assert.deepStrictEqual(actual.contents, { 'a': 3, 'c': 1, 'b': 1 });
        assert.deepStrictEqual(actual.keys, ['a', 'c']);
        assert.deepStrictEqual(testObject.getKeysForOverrideIdentifier('x'), ['a', 'b']);
    });
    test('Test merge when configuration models have multiple identifiers', () => {
        const testObject = new ConfigurationModel({ 'a': 1, 'c': 1 }, ['a', 'c'], [{ identifiers: ['y'], contents: { 'c': 1 }, keys: ['c'] }, { identifiers: ['x', 'y'], contents: { 'a': 2 }, keys: ['a'] }], undefined, new NullLogService());
        const target = new ConfigurationModel({ 'a': 2, 'b': 1 }, ['a', 'b'], [{ identifiers: ['x'], contents: { 'a': 3, 'b': 2 }, keys: ['a', 'b'] }, { identifiers: ['x', 'y'], contents: { 'b': 3 }, keys: ['b'] }], undefined, new NullLogService());
        const actual = testObject.merge(target);
        assert.deepStrictEqual(actual.contents, { 'a': 2, 'c': 1, 'b': 1 });
        assert.deepStrictEqual(actual.keys, ['a', 'c', 'b']);
        assert.deepStrictEqual(actual.overrides, [
            { identifiers: ['y'], contents: { 'c': 1 }, keys: ['c'] },
            { identifiers: ['x', 'y'], contents: { 'a': 2, 'b': 3 }, keys: ['a', 'b'] },
            { identifiers: ['x'], contents: { 'a': 3, 'b': 2 }, keys: ['a', 'b'] },
        ]);
    });
    test('inspect when raw is same', () => {
        const testObject = new ConfigurationModel({ 'a': 1, 'c': 1 }, ['a', 'c'], [{ identifiers: ['x', 'y'], contents: { 'a': 2, 'b': 1 }, keys: ['a'] }], undefined, new NullLogService());
        assert.deepStrictEqual(testObject.inspect('a'), { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(testObject.inspect('a', 'x'), { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(testObject.inspect('b', 'x'), { value: undefined, override: 1, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 1 }] });
        assert.deepStrictEqual(testObject.inspect('d'), { value: undefined, override: undefined, merged: undefined, overrides: undefined });
    });
    test('inspect when raw is not same', () => {
        const testObject = new ConfigurationModel({ 'a': 1, 'c': 1 }, ['a', 'c'], [{ identifiers: ['x', 'y'], contents: { 'a': 2, }, keys: ['a'] }], {
            'a': 1,
            'b': 2,
            'c': 1,
            'd': 3,
            '[x][y]': {
                'a': 2,
                'b': 1
            }
        }, new NullLogService());
        assert.deepStrictEqual(testObject.inspect('a'), { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(testObject.inspect('a', 'x'), { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(testObject.inspect('b', 'x'), { value: 2, override: 1, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 1 }] });
        assert.deepStrictEqual(testObject.inspect('d'), { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(testObject.inspect('e'), { value: undefined, override: undefined, merged: undefined, overrides: undefined });
    });
    test('inspect in merged configuration when raw is same', () => {
        const target1 = new ConfigurationModel({ 'a': 1 }, ['a'], [{ identifiers: ['x', 'y'], contents: { 'a': 2, }, keys: ['a'] }], undefined, new NullLogService());
        const target2 = new ConfigurationModel({ 'b': 3 }, ['b'], [], undefined, new NullLogService());
        const testObject = target1.merge(target2);
        assert.deepStrictEqual(testObject.inspect('a'), { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(testObject.inspect('a', 'x'), { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(testObject.inspect('b'), { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(testObject.inspect('b', 'y'), { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(testObject.inspect('c'), { value: undefined, override: undefined, merged: undefined, overrides: undefined });
    });
    test('inspect in merged configuration when raw is not same for one model', () => {
        const target1 = new ConfigurationModel({ 'a': 1 }, ['a'], [{ identifiers: ['x', 'y'], contents: { 'a': 2, }, keys: ['a'] }], {
            'a': 1,
            'b': 2,
            'c': 3,
            '[x][y]': {
                'a': 2,
                'b': 4,
            }
        }, new NullLogService());
        const target2 = new ConfigurationModel({ 'b': 3 }, ['b'], [], undefined, new NullLogService());
        const testObject = target1.merge(target2);
        assert.deepStrictEqual(testObject.inspect('a'), { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(testObject.inspect('a', 'x'), { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(testObject.inspect('b'), { value: 3, override: undefined, merged: 3, overrides: [{ identifiers: ['x', 'y'], value: 4 }] });
        assert.deepStrictEqual(testObject.inspect('b', 'y'), { value: 3, override: 4, merged: 4, overrides: [{ identifiers: ['x', 'y'], value: 4 }] });
        assert.deepStrictEqual(testObject.inspect('c'), { value: 3, override: undefined, merged: 3, overrides: undefined });
    });
    test('inspect: return all overrides', () => {
        const testObject = new ConfigurationModel({ 'a': 1, 'c': 1 }, ['a', 'c'], [
            { identifiers: ['x', 'y'], contents: { 'a': 2, 'b': 1 }, keys: ['a', 'b'] },
            { identifiers: ['x'], contents: { 'a': 3 }, keys: ['a'] },
            { identifiers: ['y'], contents: { 'b': 3 }, keys: ['b'] }
        ], undefined, new NullLogService());
        assert.deepStrictEqual(testObject.inspect('a').overrides, [
            { identifiers: ['x', 'y'], value: 2 },
            { identifiers: ['x'], value: 3 }
        ]);
    });
    test('inspect when no overrides', () => {
        const testObject = new ConfigurationModel({ 'a': 1, 'c': 1 }, ['a', 'c'], [], undefined, new NullLogService());
        assert.strictEqual(testObject.inspect('a').overrides, undefined);
    });
});
suite('CustomConfigurationModel', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('simple merge using models', () => {
        const base = new ConfigurationModelParser('base', new NullLogService());
        base.parse(JSON.stringify({ 'a': 1, 'b': 2 }));
        const add = new ConfigurationModelParser('add', new NullLogService());
        add.parse(JSON.stringify({ 'a': 3, 'c': 4 }));
        const result = base.configurationModel.merge(add.configurationModel);
        assert.deepStrictEqual(result.contents, { 'a': 3, 'b': 2, 'c': 4 });
    });
    test('simple merge with an undefined contents', () => {
        let base = new ConfigurationModelParser('base', new NullLogService());
        base.parse(JSON.stringify({ 'a': 1, 'b': 2 }));
        let add = new ConfigurationModelParser('add', new NullLogService());
        let result = base.configurationModel.merge(add.configurationModel);
        assert.deepStrictEqual(result.contents, { 'a': 1, 'b': 2 });
        base = new ConfigurationModelParser('base', new NullLogService());
        add = new ConfigurationModelParser('add', new NullLogService());
        add.parse(JSON.stringify({ 'a': 1, 'b': 2 }));
        result = base.configurationModel.merge(add.configurationModel);
        assert.deepStrictEqual(result.contents, { 'a': 1, 'b': 2 });
        base = new ConfigurationModelParser('base', new NullLogService());
        add = new ConfigurationModelParser('add', new NullLogService());
        result = base.configurationModel.merge(add.configurationModel);
        assert.deepStrictEqual(result.contents, {});
    });
    test('Recursive merge using config models', () => {
        const base = new ConfigurationModelParser('base', new NullLogService());
        base.parse(JSON.stringify({ 'a': { 'b': 1 } }));
        const add = new ConfigurationModelParser('add', new NullLogService());
        add.parse(JSON.stringify({ 'a': { 'b': 2 } }));
        const result = base.configurationModel.merge(add.configurationModel);
        assert.deepStrictEqual(result.contents, { 'a': { 'b': 2 } });
    });
    test('Test contents while getting an existing property', () => {
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        testObject.parse(JSON.stringify({ 'a': 1 }));
        assert.deepStrictEqual(testObject.configurationModel.getValue('a'), 1);
        testObject.parse(JSON.stringify({ 'a': { 'b': 1 } }));
        assert.deepStrictEqual(testObject.configurationModel.getValue('a'), { 'b': 1 });
    });
    test('Test contents are undefined for non existing properties', () => {
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        testObject.parse(JSON.stringify({
            awesome: true
        }));
        assert.deepStrictEqual(testObject.configurationModel.getValue('unknownproperty'), undefined);
    });
    test('Test contents are undefined for undefined config', () => {
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        assert.deepStrictEqual(testObject.configurationModel.getValue('unknownproperty'), undefined);
    });
    test('Test configWithOverrides gives all content merged with overrides', () => {
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        testObject.parse(JSON.stringify({ 'a': 1, 'c': 1, '[b]': { 'a': 2 } }));
        assert.deepStrictEqual(testObject.configurationModel.override('b').contents, { 'a': 2, 'c': 1, '[b]': { 'a': 2 } });
    });
    test('Test configWithOverrides gives empty contents', () => {
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        assert.deepStrictEqual(testObject.configurationModel.override('b').contents, {});
    });
    test('Test update with empty data', () => {
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        testObject.parse('');
        assert.deepStrictEqual(testObject.configurationModel.contents, Object.create(null));
        assert.deepStrictEqual(testObject.configurationModel.keys, []);
        testObject.parse(null);
        assert.deepStrictEqual(testObject.configurationModel.contents, Object.create(null));
        assert.deepStrictEqual(testObject.configurationModel.keys, []);
        testObject.parse(undefined);
        assert.deepStrictEqual(testObject.configurationModel.contents, Object.create(null));
        assert.deepStrictEqual(testObject.configurationModel.keys, []);
    });
    test('Test empty property is not ignored', () => {
        const testObject = new ConfigurationModelParser('test', new NullLogService());
        testObject.parse(JSON.stringify({ '': 1 }));
        // deepStrictEqual seems to ignore empty properties, fall back
        // to comparing the output of JSON.stringify
        assert.strictEqual(JSON.stringify(testObject.configurationModel.contents), JSON.stringify({ '': 1 }));
        assert.deepStrictEqual(testObject.configurationModel.keys, ['']);
    });
});
export class TestConfiguration extends Configuration {
    constructor(defaultConfiguration, policyConfiguration, applicationConfiguration, localUserConfiguration, remoteUserConfiguration) {
        super(defaultConfiguration, policyConfiguration, applicationConfiguration, localUserConfiguration, remoteUserConfiguration ?? ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), new ResourceMap(), ConfigurationModel.createEmptyModel(new NullLogService()), new ResourceMap(), new NullLogService());
    }
}
suite('Configuration', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('Test inspect for overrideIdentifiers', () => {
        const defaultConfigurationModel = parseConfigurationModel({ '[l1]': { 'a': 1 }, '[l2]': { 'b': 1 } });
        const userConfigurationModel = parseConfigurationModel({ '[l3]': { 'a': 2 } });
        const workspaceConfigurationModel = parseConfigurationModel({ '[l1]': { 'a': 3 }, '[l4]': { 'a': 3 } });
        const testObject = new TestConfiguration(defaultConfigurationModel, ConfigurationModel.createEmptyModel(new NullLogService()), userConfigurationModel, workspaceConfigurationModel);
        const { overrideIdentifiers } = testObject.inspect('a', {}, undefined);
        assert.deepStrictEqual(overrideIdentifiers, ['l1', 'l3', 'l4']);
    });
    test('Test update value', () => {
        const parser = new ConfigurationModelParser('test', new NullLogService());
        parser.parse(JSON.stringify({ 'a': 1 }));
        const testObject = new TestConfiguration(parser.configurationModel, ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        testObject.updateValue('a', 2);
        assert.strictEqual(testObject.getValue('a', {}, undefined), 2);
    });
    test('Test update value after inspect', () => {
        const parser = new ConfigurationModelParser('test', new NullLogService());
        parser.parse(JSON.stringify({ 'a': 1 }));
        const testObject = new TestConfiguration(parser.configurationModel, ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        testObject.inspect('a', {}, undefined);
        testObject.updateValue('a', 2);
        assert.strictEqual(testObject.getValue('a', {}, undefined), 2);
    });
    test('Test compare and update default configuration', () => {
        const testObject = new TestConfiguration(ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        testObject.updateDefaultConfiguration(toConfigurationModel({
            'editor.lineNumbers': 'on',
        }));
        const actual = testObject.compareAndUpdateDefaultConfiguration(toConfigurationModel({
            'editor.lineNumbers': 'off',
            '[markdown]': {
                'editor.wordWrap': 'off'
            }
        }), ['editor.lineNumbers', '[markdown]']);
        assert.deepStrictEqual(actual, { keys: ['editor.lineNumbers', '[markdown]'], overrides: [['markdown', ['editor.wordWrap']]] });
    });
    test('Test compare and update application configuration', () => {
        const testObject = new TestConfiguration(ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        testObject.updateApplicationConfiguration(toConfigurationModel({
            'update.mode': 'on',
        }));
        const actual = testObject.compareAndUpdateApplicationConfiguration(toConfigurationModel({
            'update.mode': 'none',
            '[typescript]': {
                'editor.wordWrap': 'off'
            }
        }));
        assert.deepStrictEqual(actual, { keys: ['[typescript]', 'update.mode',], overrides: [['typescript', ['editor.wordWrap']]] });
    });
    test('Test compare and update user configuration', () => {
        const testObject = new TestConfiguration(ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        testObject.updateLocalUserConfiguration(toConfigurationModel({
            'editor.lineNumbers': 'off',
            'editor.fontSize': 12,
            '[typescript]': {
                'editor.wordWrap': 'off'
            }
        }));
        const actual = testObject.compareAndUpdateLocalUserConfiguration(toConfigurationModel({
            'editor.lineNumbers': 'on',
            'window.zoomLevel': 1,
            '[typescript]': {
                'editor.wordWrap': 'on',
                'editor.insertSpaces': false
            }
        }));
        assert.deepStrictEqual(actual, { keys: ['window.zoomLevel', 'editor.lineNumbers', '[typescript]', 'editor.fontSize'], overrides: [['typescript', ['editor.insertSpaces', 'editor.wordWrap']]] });
    });
    test('Test compare and update workspace configuration', () => {
        const testObject = new TestConfiguration(ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        testObject.updateWorkspaceConfiguration(toConfigurationModel({
            'editor.lineNumbers': 'off',
            'editor.fontSize': 12,
            '[typescript]': {
                'editor.wordWrap': 'off'
            }
        }));
        const actual = testObject.compareAndUpdateWorkspaceConfiguration(toConfigurationModel({
            'editor.lineNumbers': 'on',
            'window.zoomLevel': 1,
            '[typescript]': {
                'editor.wordWrap': 'on',
                'editor.insertSpaces': false
            }
        }));
        assert.deepStrictEqual(actual, { keys: ['window.zoomLevel', 'editor.lineNumbers', '[typescript]', 'editor.fontSize'], overrides: [['typescript', ['editor.insertSpaces', 'editor.wordWrap']]] });
    });
    test('Test compare and update workspace folder configuration', () => {
        const testObject = new TestConfiguration(ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        testObject.updateFolderConfiguration(URI.file('file1'), toConfigurationModel({
            'editor.lineNumbers': 'off',
            'editor.fontSize': 12,
            '[typescript]': {
                'editor.wordWrap': 'off'
            }
        }));
        const actual = testObject.compareAndUpdateFolderConfiguration(URI.file('file1'), toConfigurationModel({
            'editor.lineNumbers': 'on',
            'window.zoomLevel': 1,
            '[typescript]': {
                'editor.wordWrap': 'on',
                'editor.insertSpaces': false
            }
        }));
        assert.deepStrictEqual(actual, { keys: ['window.zoomLevel', 'editor.lineNumbers', '[typescript]', 'editor.fontSize'], overrides: [['typescript', ['editor.insertSpaces', 'editor.wordWrap']]] });
    });
    test('Test compare and delete workspace folder configuration', () => {
        const testObject = new TestConfiguration(ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        testObject.updateFolderConfiguration(URI.file('file1'), toConfigurationModel({
            'editor.lineNumbers': 'off',
            'editor.fontSize': 12,
            '[typescript]': {
                'editor.wordWrap': 'off'
            }
        }));
        const actual = testObject.compareAndDeleteFolderConfiguration(URI.file('file1'));
        assert.deepStrictEqual(actual, { keys: ['editor.lineNumbers', 'editor.fontSize', '[typescript]'], overrides: [['typescript', ['editor.wordWrap']]] });
    });
    function parseConfigurationModel(content) {
        const parser = new ConfigurationModelParser('test', new NullLogService());
        parser.parse(JSON.stringify(content));
        return parser.configurationModel;
    }
});
suite('ConfigurationChangeEvent', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('changeEvent affecting keys with new configuration', () => {
        const configuration = new TestConfiguration(ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        const change = configuration.compareAndUpdateLocalUserConfiguration(toConfigurationModel({
            'window.zoomLevel': 1,
            'workbench.editor.enablePreview': false,
            'files.autoSave': 'off',
        }));
        const testObject = new ConfigurationChangeEvent(change, undefined, configuration, undefined, new NullLogService());
        assert.deepStrictEqual([...testObject.affectedKeys], ['window.zoomLevel', 'workbench.editor.enablePreview', 'files.autoSave']);
        assert.ok(testObject.affectsConfiguration('window.zoomLevel'));
        assert.ok(testObject.affectsConfiguration('window'));
        assert.ok(testObject.affectsConfiguration('workbench.editor.enablePreview'));
        assert.ok(testObject.affectsConfiguration('workbench.editor'));
        assert.ok(testObject.affectsConfiguration('workbench'));
        assert.ok(testObject.affectsConfiguration('files'));
        assert.ok(testObject.affectsConfiguration('files.autoSave'));
        assert.ok(!testObject.affectsConfiguration('files.exclude'));
        assert.ok(!testObject.affectsConfiguration('[markdown]'));
        assert.ok(!testObject.affectsConfiguration('editor'));
    });
    test('changeEvent affecting keys when configuration changed', () => {
        const configuration = new TestConfiguration(ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        configuration.updateLocalUserConfiguration(toConfigurationModel({
            'window.zoomLevel': 2,
            'workbench.editor.enablePreview': true,
            'files.autoSave': 'off',
        }));
        const data = configuration.toData();
        const change = configuration.compareAndUpdateLocalUserConfiguration(toConfigurationModel({
            'window.zoomLevel': 1,
            'workbench.editor.enablePreview': false,
            'files.autoSave': 'off',
        }));
        const testObject = new ConfigurationChangeEvent(change, { data }, configuration, undefined, new NullLogService());
        assert.deepStrictEqual([...testObject.affectedKeys], ['window.zoomLevel', 'workbench.editor.enablePreview']);
        assert.ok(testObject.affectsConfiguration('window.zoomLevel'));
        assert.ok(testObject.affectsConfiguration('window'));
        assert.ok(testObject.affectsConfiguration('workbench.editor.enablePreview'));
        assert.ok(testObject.affectsConfiguration('workbench.editor'));
        assert.ok(testObject.affectsConfiguration('workbench'));
        assert.ok(!testObject.affectsConfiguration('files'));
        assert.ok(!testObject.affectsConfiguration('[markdown]'));
        assert.ok(!testObject.affectsConfiguration('editor'));
    });
    test('changeEvent affecting overrides with new configuration', () => {
        const configuration = new TestConfiguration(ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        const change = configuration.compareAndUpdateLocalUserConfiguration(toConfigurationModel({
            'files.autoSave': 'off',
            '[markdown]': {
                'editor.wordWrap': 'off'
            },
            '[typescript][jsonc]': {
                'editor.lineNumbers': 'off'
            }
        }));
        const testObject = new ConfigurationChangeEvent(change, undefined, configuration, undefined, new NullLogService());
        assert.deepStrictEqual([...testObject.affectedKeys], ['files.autoSave', '[markdown]', '[typescript][jsonc]', 'editor.wordWrap', 'editor.lineNumbers']);
        assert.ok(testObject.affectsConfiguration('files'));
        assert.ok(testObject.affectsConfiguration('files.autoSave'));
        assert.ok(!testObject.affectsConfiguration('files.exclude'));
        assert.ok(testObject.affectsConfiguration('[markdown]'));
        assert.ok(!testObject.affectsConfiguration('[markdown].editor'));
        assert.ok(!testObject.affectsConfiguration('[markdown].workbench'));
        assert.ok(testObject.affectsConfiguration('editor'));
        assert.ok(testObject.affectsConfiguration('editor.wordWrap'));
        assert.ok(testObject.affectsConfiguration('editor.lineNumbers'));
        assert.ok(testObject.affectsConfiguration('editor', { overrideIdentifier: 'markdown' }));
        assert.ok(testObject.affectsConfiguration('editor', { overrideIdentifier: 'jsonc' }));
        assert.ok(testObject.affectsConfiguration('editor', { overrideIdentifier: 'typescript' }));
        assert.ok(testObject.affectsConfiguration('editor.wordWrap', { overrideIdentifier: 'markdown' }));
        assert.ok(!testObject.affectsConfiguration('editor.wordWrap', { overrideIdentifier: 'jsonc' }));
        assert.ok(!testObject.affectsConfiguration('editor.wordWrap', { overrideIdentifier: 'typescript' }));
        assert.ok(!testObject.affectsConfiguration('editor.lineNumbers', { overrideIdentifier: 'markdown' }));
        assert.ok(testObject.affectsConfiguration('editor.lineNumbers', { overrideIdentifier: 'typescript' }));
        assert.ok(testObject.affectsConfiguration('editor.lineNumbers', { overrideIdentifier: 'jsonc' }));
        assert.ok(!testObject.affectsConfiguration('editor', { overrideIdentifier: 'json' }));
        assert.ok(!testObject.affectsConfiguration('editor.fontSize', { overrideIdentifier: 'markdown' }));
        assert.ok(!testObject.affectsConfiguration('editor.fontSize'));
        assert.ok(!testObject.affectsConfiguration('window'));
    });
    test('changeEvent affecting overrides when configuration changed', () => {
        const configuration = new TestConfiguration(ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        configuration.updateLocalUserConfiguration(toConfigurationModel({
            'workbench.editor.enablePreview': true,
            '[markdown]': {
                'editor.fontSize': 12,
                'editor.wordWrap': 'off'
            },
            '[css][scss]': {
                'editor.lineNumbers': 'off',
                'css.lint.emptyRules': 'error'
            },
            'files.autoSave': 'off',
        }));
        const data = configuration.toData();
        const change = configuration.compareAndUpdateLocalUserConfiguration(toConfigurationModel({
            'files.autoSave': 'off',
            '[markdown]': {
                'editor.fontSize': 13,
                'editor.wordWrap': 'off'
            },
            '[css][scss]': {
                'editor.lineNumbers': 'relative',
                'css.lint.emptyRules': 'error'
            },
            'window.zoomLevel': 1,
        }));
        const testObject = new ConfigurationChangeEvent(change, { data }, configuration, undefined, new NullLogService());
        assert.deepStrictEqual([...testObject.affectedKeys], ['window.zoomLevel', '[markdown]', '[css][scss]', 'workbench.editor.enablePreview', 'editor.fontSize', 'editor.lineNumbers']);
        assert.ok(!testObject.affectsConfiguration('files'));
        assert.ok(testObject.affectsConfiguration('[markdown]'));
        assert.ok(!testObject.affectsConfiguration('[markdown].editor'));
        assert.ok(!testObject.affectsConfiguration('[markdown].editor.fontSize'));
        assert.ok(!testObject.affectsConfiguration('[markdown].editor.wordWrap'));
        assert.ok(!testObject.affectsConfiguration('[markdown].workbench'));
        assert.ok(testObject.affectsConfiguration('[css][scss]'));
        assert.ok(testObject.affectsConfiguration('editor'));
        assert.ok(testObject.affectsConfiguration('editor', { overrideIdentifier: 'markdown' }));
        assert.ok(testObject.affectsConfiguration('editor', { overrideIdentifier: 'css' }));
        assert.ok(testObject.affectsConfiguration('editor', { overrideIdentifier: 'scss' }));
        assert.ok(testObject.affectsConfiguration('editor.fontSize', { overrideIdentifier: 'markdown' }));
        assert.ok(!testObject.affectsConfiguration('editor.fontSize', { overrideIdentifier: 'css' }));
        assert.ok(!testObject.affectsConfiguration('editor.fontSize', { overrideIdentifier: 'scss' }));
        assert.ok(testObject.affectsConfiguration('editor.lineNumbers', { overrideIdentifier: 'scss' }));
        assert.ok(testObject.affectsConfiguration('editor.lineNumbers', { overrideIdentifier: 'css' }));
        assert.ok(!testObject.affectsConfiguration('editor.lineNumbers', { overrideIdentifier: 'markdown' }));
        assert.ok(!testObject.affectsConfiguration('editor.wordWrap'));
        assert.ok(!testObject.affectsConfiguration('editor.wordWrap', { overrideIdentifier: 'markdown' }));
        assert.ok(!testObject.affectsConfiguration('editor', { overrideIdentifier: 'json' }));
        assert.ok(!testObject.affectsConfiguration('editor.fontSize', { overrideIdentifier: 'json' }));
        assert.ok(testObject.affectsConfiguration('window'));
        assert.ok(testObject.affectsConfiguration('window.zoomLevel'));
        assert.ok(testObject.affectsConfiguration('window', { overrideIdentifier: 'markdown' }));
        assert.ok(testObject.affectsConfiguration('window.zoomLevel', { overrideIdentifier: 'markdown' }));
        assert.ok(testObject.affectsConfiguration('workbench'));
        assert.ok(testObject.affectsConfiguration('workbench.editor'));
        assert.ok(testObject.affectsConfiguration('workbench.editor.enablePreview'));
        assert.ok(testObject.affectsConfiguration('workbench', { overrideIdentifier: 'markdown' }));
        assert.ok(testObject.affectsConfiguration('workbench.editor', { overrideIdentifier: 'markdown' }));
    });
    test('changeEvent affecting workspace folders', () => {
        const configuration = new TestConfiguration(ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        configuration.updateWorkspaceConfiguration(toConfigurationModel({ 'window.title': 'custom' }));
        configuration.updateFolderConfiguration(URI.file('folder1'), toConfigurationModel({ 'window.zoomLevel': 2, 'window.restoreFullscreen': true }));
        configuration.updateFolderConfiguration(URI.file('folder2'), toConfigurationModel({ 'workbench.editor.enablePreview': true, 'window.restoreWindows': true }));
        const data = configuration.toData();
        const workspace = new Workspace('a', [new WorkspaceFolder({ index: 0, name: 'a', uri: URI.file('folder1') }), new WorkspaceFolder({ index: 1, name: 'b', uri: URI.file('folder2') }), new WorkspaceFolder({ index: 2, name: 'c', uri: URI.file('folder3') })]);
        const change = mergeChanges(configuration.compareAndUpdateWorkspaceConfiguration(toConfigurationModel({ 'window.title': 'native' })), configuration.compareAndUpdateFolderConfiguration(URI.file('folder1'), toConfigurationModel({ 'window.zoomLevel': 1, 'window.restoreFullscreen': false })), configuration.compareAndUpdateFolderConfiguration(URI.file('folder2'), toConfigurationModel({ 'workbench.editor.enablePreview': false, 'window.restoreWindows': false })));
        const testObject = new ConfigurationChangeEvent(change, { data, workspace }, configuration, workspace, new NullLogService());
        assert.deepStrictEqual([...testObject.affectedKeys], ['window.title', 'window.zoomLevel', 'window.restoreFullscreen', 'workbench.editor.enablePreview', 'window.restoreWindows']);
        assert.ok(testObject.affectsConfiguration('window.zoomLevel'));
        assert.ok(testObject.affectsConfiguration('window.zoomLevel', { resource: URI.file('folder1') }));
        assert.ok(testObject.affectsConfiguration('window.zoomLevel', { resource: URI.file(join('folder1', 'file1')) }));
        assert.ok(!testObject.affectsConfiguration('window.zoomLevel', { resource: URI.file('file1') }));
        assert.ok(!testObject.affectsConfiguration('window.zoomLevel', { resource: URI.file('file2') }));
        assert.ok(!testObject.affectsConfiguration('window.zoomLevel', { resource: URI.file(join('folder2', 'file2')) }));
        assert.ok(!testObject.affectsConfiguration('window.zoomLevel', { resource: URI.file(join('folder3', 'file3')) }));
        assert.ok(testObject.affectsConfiguration('window.restoreFullscreen'));
        assert.ok(testObject.affectsConfiguration('window.restoreFullscreen', { resource: URI.file(join('folder1', 'file1')) }));
        assert.ok(testObject.affectsConfiguration('window.restoreFullscreen', { resource: URI.file('folder1') }));
        assert.ok(!testObject.affectsConfiguration('window.restoreFullscreen', { resource: URI.file('file1') }));
        assert.ok(!testObject.affectsConfiguration('window.restoreFullscreen', { resource: URI.file('file2') }));
        assert.ok(!testObject.affectsConfiguration('window.restoreFullscreen', { resource: URI.file(join('folder2', 'file2')) }));
        assert.ok(!testObject.affectsConfiguration('window.restoreFullscreen', { resource: URI.file(join('folder3', 'file3')) }));
        assert.ok(testObject.affectsConfiguration('window.restoreWindows'));
        assert.ok(testObject.affectsConfiguration('window.restoreWindows', { resource: URI.file('folder2') }));
        assert.ok(testObject.affectsConfiguration('window.restoreWindows', { resource: URI.file(join('folder2', 'file2')) }));
        assert.ok(!testObject.affectsConfiguration('window.restoreWindows', { resource: URI.file('file2') }));
        assert.ok(!testObject.affectsConfiguration('window.restoreWindows', { resource: URI.file(join('folder1', 'file1')) }));
        assert.ok(!testObject.affectsConfiguration('window.restoreWindows', { resource: URI.file(join('folder3', 'file3')) }));
        assert.ok(testObject.affectsConfiguration('window.title'));
        assert.ok(testObject.affectsConfiguration('window.title', { resource: URI.file('folder1') }));
        assert.ok(testObject.affectsConfiguration('window.title', { resource: URI.file(join('folder1', 'file1')) }));
        assert.ok(testObject.affectsConfiguration('window.title', { resource: URI.file('folder2') }));
        assert.ok(testObject.affectsConfiguration('window.title', { resource: URI.file(join('folder2', 'file2')) }));
        assert.ok(testObject.affectsConfiguration('window.title', { resource: URI.file('folder3') }));
        assert.ok(testObject.affectsConfiguration('window.title', { resource: URI.file(join('folder3', 'file3')) }));
        assert.ok(testObject.affectsConfiguration('window.title', { resource: URI.file('file1') }));
        assert.ok(testObject.affectsConfiguration('window.title', { resource: URI.file('file2') }));
        assert.ok(testObject.affectsConfiguration('window.title', { resource: URI.file('file3') }));
        assert.ok(testObject.affectsConfiguration('window'));
        assert.ok(testObject.affectsConfiguration('window', { resource: URI.file('folder1') }));
        assert.ok(testObject.affectsConfiguration('window', { resource: URI.file(join('folder1', 'file1')) }));
        assert.ok(testObject.affectsConfiguration('window', { resource: URI.file('folder2') }));
        assert.ok(testObject.affectsConfiguration('window', { resource: URI.file(join('folder2', 'file2')) }));
        assert.ok(testObject.affectsConfiguration('window', { resource: URI.file('folder3') }));
        assert.ok(testObject.affectsConfiguration('window', { resource: URI.file(join('folder3', 'file3')) }));
        assert.ok(testObject.affectsConfiguration('window', { resource: URI.file('file1') }));
        assert.ok(testObject.affectsConfiguration('window', { resource: URI.file('file2') }));
        assert.ok(testObject.affectsConfiguration('window', { resource: URI.file('file3') }));
        assert.ok(testObject.affectsConfiguration('workbench.editor.enablePreview'));
        assert.ok(testObject.affectsConfiguration('workbench.editor.enablePreview', { resource: URI.file('folder2') }));
        assert.ok(testObject.affectsConfiguration('workbench.editor.enablePreview', { resource: URI.file(join('folder2', 'file2')) }));
        assert.ok(!testObject.affectsConfiguration('workbench.editor.enablePreview', { resource: URI.file('folder1') }));
        assert.ok(!testObject.affectsConfiguration('workbench.editor.enablePreview', { resource: URI.file(join('folder1', 'file1')) }));
        assert.ok(!testObject.affectsConfiguration('workbench.editor.enablePreview', { resource: URI.file('folder3') }));
        assert.ok(testObject.affectsConfiguration('workbench.editor'));
        assert.ok(testObject.affectsConfiguration('workbench.editor', { resource: URI.file('folder2') }));
        assert.ok(testObject.affectsConfiguration('workbench.editor', { resource: URI.file(join('folder2', 'file2')) }));
        assert.ok(!testObject.affectsConfiguration('workbench.editor', { resource: URI.file('folder1') }));
        assert.ok(!testObject.affectsConfiguration('workbench.editor', { resource: URI.file(join('folder1', 'file1')) }));
        assert.ok(!testObject.affectsConfiguration('workbench.editor', { resource: URI.file('folder3') }));
        assert.ok(testObject.affectsConfiguration('workbench'));
        assert.ok(testObject.affectsConfiguration('workbench', { resource: URI.file('folder2') }));
        assert.ok(testObject.affectsConfiguration('workbench', { resource: URI.file(join('folder2', 'file2')) }));
        assert.ok(!testObject.affectsConfiguration('workbench', { resource: URI.file('folder1') }));
        assert.ok(!testObject.affectsConfiguration('workbench', { resource: URI.file('folder3') }));
        assert.ok(!testObject.affectsConfiguration('files'));
        assert.ok(!testObject.affectsConfiguration('files', { resource: URI.file('folder1') }));
        assert.ok(!testObject.affectsConfiguration('files', { resource: URI.file(join('folder1', 'file1')) }));
        assert.ok(!testObject.affectsConfiguration('files', { resource: URI.file('folder2') }));
        assert.ok(!testObject.affectsConfiguration('files', { resource: URI.file(join('folder2', 'file2')) }));
        assert.ok(!testObject.affectsConfiguration('files', { resource: URI.file('folder3') }));
        assert.ok(!testObject.affectsConfiguration('files', { resource: URI.file(join('folder3', 'file3')) }));
    });
    test('changeEvent - all', () => {
        const configuration = new TestConfiguration(ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        configuration.updateFolderConfiguration(URI.file('file1'), toConfigurationModel({ 'window.zoomLevel': 2, 'window.restoreFullscreen': true }));
        const data = configuration.toData();
        const change = mergeChanges(configuration.compareAndUpdateDefaultConfiguration(toConfigurationModel({
            'editor.lineNumbers': 'off',
            '[markdown]': {
                'editor.wordWrap': 'off'
            }
        }), ['editor.lineNumbers', '[markdown]']), configuration.compareAndUpdateLocalUserConfiguration(toConfigurationModel({
            '[json]': {
                'editor.lineNumbers': 'relative'
            }
        })), configuration.compareAndUpdateWorkspaceConfiguration(toConfigurationModel({ 'window.title': 'custom' })), configuration.compareAndDeleteFolderConfiguration(URI.file('file1')), configuration.compareAndUpdateFolderConfiguration(URI.file('file2'), toConfigurationModel({ 'workbench.editor.enablePreview': true, 'window.restoreWindows': true })));
        const workspace = new Workspace('a', [new WorkspaceFolder({ index: 0, name: 'a', uri: URI.file('file1') }), new WorkspaceFolder({ index: 1, name: 'b', uri: URI.file('file2') }), new WorkspaceFolder({ index: 2, name: 'c', uri: URI.file('folder3') })]);
        const testObject = new ConfigurationChangeEvent(change, { data, workspace }, configuration, workspace, new NullLogService());
        assert.deepStrictEqual([...testObject.affectedKeys], ['editor.lineNumbers', '[markdown]', '[json]', 'window.title', 'window.zoomLevel', 'window.restoreFullscreen', 'workbench.editor.enablePreview', 'window.restoreWindows', 'editor.wordWrap']);
        assert.ok(testObject.affectsConfiguration('window.title'));
        assert.ok(testObject.affectsConfiguration('window.title', { resource: URI.file('file1') }));
        assert.ok(testObject.affectsConfiguration('window.title', { resource: URI.file('file2') }));
        assert.ok(testObject.affectsConfiguration('window'));
        assert.ok(testObject.affectsConfiguration('window', { resource: URI.file('file1') }));
        assert.ok(testObject.affectsConfiguration('window', { resource: URI.file('file2') }));
        assert.ok(testObject.affectsConfiguration('window.zoomLevel'));
        assert.ok(testObject.affectsConfiguration('window.zoomLevel', { resource: URI.file('file1') }));
        assert.ok(!testObject.affectsConfiguration('window.zoomLevel', { resource: URI.file('file2') }));
        assert.ok(testObject.affectsConfiguration('window.restoreFullscreen'));
        assert.ok(testObject.affectsConfiguration('window.restoreFullscreen', { resource: URI.file('file1') }));
        assert.ok(!testObject.affectsConfiguration('window.restoreFullscreen', { resource: URI.file('file2') }));
        assert.ok(testObject.affectsConfiguration('window.restoreWindows'));
        assert.ok(testObject.affectsConfiguration('window.restoreWindows', { resource: URI.file('file2') }));
        assert.ok(!testObject.affectsConfiguration('window.restoreWindows', { resource: URI.file('file1') }));
        assert.ok(testObject.affectsConfiguration('workbench.editor.enablePreview'));
        assert.ok(testObject.affectsConfiguration('workbench.editor.enablePreview', { resource: URI.file('file2') }));
        assert.ok(!testObject.affectsConfiguration('workbench.editor.enablePreview', { resource: URI.file('file1') }));
        assert.ok(testObject.affectsConfiguration('workbench.editor'));
        assert.ok(testObject.affectsConfiguration('workbench.editor', { resource: URI.file('file2') }));
        assert.ok(!testObject.affectsConfiguration('workbench.editor', { resource: URI.file('file1') }));
        assert.ok(testObject.affectsConfiguration('workbench'));
        assert.ok(testObject.affectsConfiguration('workbench', { resource: URI.file('file2') }));
        assert.ok(!testObject.affectsConfiguration('workbench', { resource: URI.file('file1') }));
        assert.ok(!testObject.affectsConfiguration('files'));
        assert.ok(!testObject.affectsConfiguration('files', { resource: URI.file('file1') }));
        assert.ok(!testObject.affectsConfiguration('files', { resource: URI.file('file2') }));
        assert.ok(testObject.affectsConfiguration('editor'));
        assert.ok(testObject.affectsConfiguration('editor', { resource: URI.file('file1') }));
        assert.ok(testObject.affectsConfiguration('editor', { resource: URI.file('file2') }));
        assert.ok(testObject.affectsConfiguration('editor', { resource: URI.file('file1'), overrideIdentifier: 'json' }));
        assert.ok(testObject.affectsConfiguration('editor', { resource: URI.file('file1'), overrideIdentifier: 'markdown' }));
        assert.ok(testObject.affectsConfiguration('editor', { resource: URI.file('file1'), overrideIdentifier: 'typescript' }));
        assert.ok(testObject.affectsConfiguration('editor', { resource: URI.file('file2'), overrideIdentifier: 'json' }));
        assert.ok(testObject.affectsConfiguration('editor', { resource: URI.file('file2'), overrideIdentifier: 'markdown' }));
        assert.ok(testObject.affectsConfiguration('editor', { resource: URI.file('file2'), overrideIdentifier: 'typescript' }));
        assert.ok(testObject.affectsConfiguration('editor.lineNumbers'));
        assert.ok(testObject.affectsConfiguration('editor.lineNumbers', { resource: URI.file('file1') }));
        assert.ok(testObject.affectsConfiguration('editor.lineNumbers', { resource: URI.file('file2') }));
        assert.ok(testObject.affectsConfiguration('editor.lineNumbers', { resource: URI.file('file1'), overrideIdentifier: 'json' }));
        assert.ok(testObject.affectsConfiguration('editor.lineNumbers', { resource: URI.file('file1'), overrideIdentifier: 'markdown' }));
        assert.ok(testObject.affectsConfiguration('editor.lineNumbers', { resource: URI.file('file1'), overrideIdentifier: 'typescript' }));
        assert.ok(testObject.affectsConfiguration('editor.lineNumbers', { resource: URI.file('file2'), overrideIdentifier: 'json' }));
        assert.ok(testObject.affectsConfiguration('editor.lineNumbers', { resource: URI.file('file2'), overrideIdentifier: 'markdown' }));
        assert.ok(testObject.affectsConfiguration('editor.lineNumbers', { resource: URI.file('file2'), overrideIdentifier: 'typescript' }));
        assert.ok(testObject.affectsConfiguration('editor.wordWrap'));
        assert.ok(!testObject.affectsConfiguration('editor.wordWrap', { resource: URI.file('file1') }));
        assert.ok(!testObject.affectsConfiguration('editor.wordWrap', { resource: URI.file('file2') }));
        assert.ok(!testObject.affectsConfiguration('editor.wordWrap', { resource: URI.file('file1'), overrideIdentifier: 'json' }));
        assert.ok(testObject.affectsConfiguration('editor.wordWrap', { resource: URI.file('file1'), overrideIdentifier: 'markdown' }));
        assert.ok(!testObject.affectsConfiguration('editor.wordWrap', { resource: URI.file('file1'), overrideIdentifier: 'typescript' }));
        assert.ok(!testObject.affectsConfiguration('editor.wordWrap', { resource: URI.file('file2'), overrideIdentifier: 'json' }));
        assert.ok(testObject.affectsConfiguration('editor.wordWrap', { resource: URI.file('file2'), overrideIdentifier: 'markdown' }));
        assert.ok(!testObject.affectsConfiguration('editor.wordWrap', { resource: URI.file('file2'), overrideIdentifier: 'typescript' }));
        assert.ok(!testObject.affectsConfiguration('editor.fontSize'));
        assert.ok(!testObject.affectsConfiguration('editor.fontSize', { resource: URI.file('file1') }));
        assert.ok(!testObject.affectsConfiguration('editor.fontSize', { resource: URI.file('file2') }));
    });
    test('changeEvent affecting tasks and launches', () => {
        const configuration = new TestConfiguration(ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        const change = configuration.compareAndUpdateLocalUserConfiguration(toConfigurationModel({
            'launch': {
                'configuraiton': {}
            },
            'launch.version': 1,
            'tasks': {
                'version': 2
            }
        }));
        const testObject = new ConfigurationChangeEvent(change, undefined, configuration, undefined, new NullLogService());
        assert.deepStrictEqual([...testObject.affectedKeys], ['launch', 'launch.version', 'tasks']);
        assert.ok(testObject.affectsConfiguration('launch'));
        assert.ok(testObject.affectsConfiguration('launch.version'));
        assert.ok(testObject.affectsConfiguration('tasks'));
    });
    test('affectsConfiguration returns false for empty string', () => {
        const configuration = new TestConfiguration(ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()), ConfigurationModel.createEmptyModel(new NullLogService()));
        const change = configuration.compareAndUpdateLocalUserConfiguration(toConfigurationModel({ 'window.zoomLevel': 1 }));
        const testObject = new ConfigurationChangeEvent(change, undefined, configuration, undefined, new NullLogService());
        assert.strictEqual(false, testObject.affectsConfiguration(''));
    });
});
suite('Configuration.Parse', () => {
    const logService = new NullLogService();
    ensureNoDisposablesAreLeakedInTestSuite();
    test('parsing configuration only with local user configuration and raw is same', () => {
        const configuration = new TestConfiguration(ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), new ConfigurationModel({ 'a': 1, 'c': 1 }, ['a', 'c'], [{ identifiers: ['x', 'y'], contents: { 'a': 2, 'b': 1 }, keys: ['a'] }], undefined, logService));
        const actual = Configuration.parse(configuration.toData(), logService);
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).userLocal, { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).userLocal, { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'x' }, undefined).userLocal, { value: undefined, override: 1, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 1 }] });
        assert.deepStrictEqual(actual.inspect('d', {}, undefined).userLocal, undefined);
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).userRemote, undefined);
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).userRemote, undefined);
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'x' }, undefined).userRemote, undefined);
        assert.deepStrictEqual(actual.inspect('d', {}, undefined).userRemote, undefined);
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).user, { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).user, { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'x' }, undefined).user, { value: undefined, override: 1, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 1 }] });
        assert.deepStrictEqual(actual.inspect('d', {}, undefined).user, undefined);
    });
    test('parsing configuration only with local user configuration and raw is not same', () => {
        const configuration = new TestConfiguration(ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), new ConfigurationModel({ 'a': 1, 'c': 1 }, ['a', 'c'], [{ identifiers: ['x', 'y'], contents: { 'a': 2, }, keys: ['a'] }], {
            'a': 1,
            'b': 2,
            'c': 1,
            'd': 3,
            '[x][y]': {
                'a': 2,
                'b': 1
            }
        }, logService));
        const actual = Configuration.parse(configuration.toData(), logService);
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).userLocal, { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).userLocal, { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'x' }, undefined).userLocal, { value: 2, override: 1, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 1 }] });
        assert.deepStrictEqual(actual.inspect('d', {}, undefined).userLocal, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('e', {}, undefined).userLocal, undefined);
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).userRemote, undefined);
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).userRemote, undefined);
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'x' }, undefined).userRemote, undefined);
        assert.deepStrictEqual(actual.inspect('d', {}, undefined).userRemote, undefined);
        assert.deepStrictEqual(actual.inspect('e', {}, undefined).userRemote, undefined);
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).user, { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).user, { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'x' }, undefined).user, { value: 2, override: 1, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 1 }] });
        assert.deepStrictEqual(actual.inspect('d', {}, undefined).user, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('e', {}, undefined).user, undefined);
    });
    test('parsing configuration with local and remote user configuration and raw is same for both', () => {
        const configuration = new TestConfiguration(ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), new ConfigurationModel({ 'a': 1 }, ['a'], [{ identifiers: ['x', 'y'], contents: { 'a': 2, }, keys: ['a'] }], undefined, logService), new ConfigurationModel({ 'b': 3 }, ['b'], [], undefined, logService));
        const actual = Configuration.parse(configuration.toData(), logService);
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).userLocal, { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).userLocal, { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('b', {}, undefined).userLocal, undefined);
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'y' }, undefined).userLocal, undefined);
        assert.deepStrictEqual(actual.inspect('c', {}, undefined).userLocal, undefined);
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).userRemote, undefined);
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).userRemote, undefined);
        assert.deepStrictEqual(actual.inspect('b', {}, undefined).userRemote, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'y' }, undefined).userRemote, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('c', {}, undefined).userRemote, undefined);
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).user, { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).user, { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('b', {}, undefined).user, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'y' }, undefined).user, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('c', {}, undefined).user, undefined);
    });
    test('parsing configuration with local and remote user configuration and raw is not same for local user', () => {
        const configuration = new TestConfiguration(ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), new ConfigurationModel({ 'a': 1 }, ['a'], [{ identifiers: ['x', 'y'], contents: { 'a': 2, }, keys: ['a'] }], {
            'a': 1,
            'b': 2,
            'c': 3,
            '[x][y]': {
                'a': 2,
                'b': 4,
            }
        }, logService), new ConfigurationModel({ 'b': 3 }, ['b'], [], undefined, logService));
        const actual = Configuration.parse(configuration.toData(), logService);
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).userLocal, { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).userLocal, { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('b', {}, undefined).userLocal, { value: 2, override: undefined, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 4 }] });
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'y' }, undefined).userLocal, { value: 2, override: 4, merged: 4, overrides: [{ identifiers: ['x', 'y'], value: 4 }] });
        assert.deepStrictEqual(actual.inspect('c', {}, undefined).userLocal, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).userRemote, undefined);
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).userRemote, undefined);
        assert.deepStrictEqual(actual.inspect('b', {}, undefined).userRemote, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'y' }, undefined).userRemote, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('c', {}, undefined).userRemote, undefined);
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).user, { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).user, { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('b', {}, undefined).user, { value: 3, merged: 3, override: undefined, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'y' }, undefined).user, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('c', {}, undefined).user, undefined);
    });
    test('parsing configuration with local and remote user configuration and raw is not same for remote user', () => {
        const configuration = new TestConfiguration(ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), new ConfigurationModel({ 'b': 3 }, ['b'], [], undefined, logService), new ConfigurationModel({ 'a': 1 }, ['a'], [{ identifiers: ['x', 'y'], contents: { 'a': 2, }, keys: ['a'] }], {
            'a': 1,
            'b': 2,
            'c': 3,
            '[x][y]': {
                'a': 2,
                'b': 4,
            }
        }, logService));
        const actual = Configuration.parse(configuration.toData(), logService);
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).userLocal, undefined);
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).userLocal, undefined);
        assert.deepStrictEqual(actual.inspect('b', {}, undefined).userLocal, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'y' }, undefined).userLocal, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('c', {}, undefined).userLocal, undefined);
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).userRemote, { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).userRemote, { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('b', {}, undefined).userRemote, { value: 2, override: undefined, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 4 }] });
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'y' }, undefined).userRemote, { value: 2, override: 4, merged: 4, overrides: [{ identifiers: ['x', 'y'], value: 4 }] });
        assert.deepStrictEqual(actual.inspect('c', {}, undefined).userRemote, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).user, { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).user, { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('b', {}, undefined).user, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'y' }, undefined).user, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('c', {}, undefined).user, undefined);
    });
    test('parsing configuration with local and remote user configuration and raw is not same for both', () => {
        const configuration = new TestConfiguration(ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), new ConfigurationModel({ 'b': 3 }, ['b'], [], {
            'a': 4,
            'b': 3
        }, logService), new ConfigurationModel({ 'a': 1 }, ['a'], [{ identifiers: ['x', 'y'], contents: { 'a': 2, }, keys: ['a'] }], {
            'a': 1,
            'b': 2,
            'c': 3,
            '[x][y]': {
                'a': 2,
                'b': 4,
            }
        }, logService));
        const actual = Configuration.parse(configuration.toData(), logService);
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).userLocal, { value: 4, override: undefined, merged: 4, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).userLocal, { value: 4, override: undefined, merged: 4, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('b', {}, undefined).userLocal, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'y' }, undefined).userLocal, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('c', {}, undefined).userLocal, undefined);
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).userRemote, { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).userRemote, { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('b', {}, undefined).userRemote, { value: 2, override: undefined, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 4 }] });
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'y' }, undefined).userRemote, { value: 2, override: 4, merged: 4, overrides: [{ identifiers: ['x', 'y'], value: 4 }] });
        assert.deepStrictEqual(actual.inspect('c', {}, undefined).userRemote, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('a', {}, undefined).user, { value: 1, override: undefined, merged: 1, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('a', { overrideIdentifier: 'x' }, undefined).user, { value: 1, override: 2, merged: 2, overrides: [{ identifiers: ['x', 'y'], value: 2 }] });
        assert.deepStrictEqual(actual.inspect('b', {}, undefined).user, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('b', { overrideIdentifier: 'y' }, undefined).user, { value: 3, override: undefined, merged: 3, overrides: undefined });
        assert.deepStrictEqual(actual.inspect('c', {}, undefined).user, undefined);
    });
});
function toConfigurationModel(obj) {
    const parser = new ConfigurationModelParser('test', new NullLogService());
    parser.parse(JSON.stringify(obj));
    return parser.configurationModel;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlndXJhdGlvbk1vZGVscy50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vY29uZmlndXJhdGlvbk1vZGVscy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBQ2hHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDN0QsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRyxPQUFPLEVBQUUsYUFBYSxFQUFFLHdCQUF3QixFQUFFLGtCQUFrQixFQUFFLHdCQUF3QixFQUFFLFlBQVksRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzFKLE9BQU8sRUFBMEIsVUFBVSxFQUEwQyxNQUFNLHVDQUF1QyxDQUFDO0FBQ25JLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDaEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUU1RSxLQUFLLENBQUMsMEJBQTBCLEVBQUUsR0FBRyxFQUFFO0lBRXRDLHVDQUF1QyxFQUFFLENBQUM7SUFFMUMsVUFBVSxDQUFDLEdBQUcsRUFBRTtRQUNmLFFBQVEsQ0FBQyxFQUFFLENBQXlCLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQztZQUNuRixJQUFJLEVBQUUsOEJBQThCO1lB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QUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLElBQUksY0FBYyxFQUFFLENBQUMsQ0FBQztRQUU3SyxJQUFJLE1BQU0sR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3RDLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDNUQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDaEQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsNEJBQTRCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBRTVFLE1BQU0sR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2xDLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDNUQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDaEQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsNEJBQTRCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzdFLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLG1FQUFtRSxFQUFFLEdBQUcsRUFBRTtRQUM5RSxNQUFNLFVBQVUsR0FBRyxJQUFJLGtCQUFrQixDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLElBQUksY0FBYyxFQUFFLENBQUMsQ0FBQztRQUVyUCxNQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3hDLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNwRSxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUVoRCxNQUFNLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyw0QkFBNEIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ2xGLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGdFQUFnRSxFQUFFLEdBQUcsRUFBRTtRQUMzRSxNQUFNLFVBQVUsR0FBRyxJQUFJLGtCQUFrQixDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLElBQUksY0FBYyxFQUFFLENBQUMsQ0FBQztRQUN4TyxNQUFNLE1BQU0sR0FBRyxJQUFJLGtCQUFrQixDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLElBQUksY0FBYyxFQUFFLENBQUMsQ0FBQztRQUVqUCxNQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRXhDLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNwRSxNQUFNLENBQUMsZUFBZSxD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LEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksY0FBYyxFQUFFLENBQUMsQ0FBQztRQUMvRixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsV0FBVyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNsSixNQUFNLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQy9JLE1BQU0sQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBQ3BILE1BQU0sQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUN6SCxNQUFNLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztJQUNySSxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxvRUFBb0UsRUFBRSxHQUFHLEVBQUU7UUFDL0UsTUFBTSxPQUFPLEdBQUcsSUFBSSxrQkFBa0IsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUM1SCxHQUFHLEVBQUUsQ0FBQztZQUNOLEdBQUcsRUFBRSxDQUFDO1lBQ04sR0FBRyxFQUFFLENBQUM7WUFDTixRQUFRLEVBQUU7Z0JBQ1QsR0FBRyxFQUFFLENBQUM7Z0JBQ04sR0FBRyxFQUFFLENBQUM7YUFDTjtTQUNELEVBQUUsSUFBSSxjQUFjLEVBQUUsQ0FBQyxDQUFDO1FBQ3pCLE1BQU0sT0FBTyxHQUFHLElBQUksa0JBQWtCLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksY0FBYyxFQUFFLENBQUMsQ0FBQztRQUMvRixNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsV0FBVyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNsSixNQUFNLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQy9JLE1BQU0sQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsV0FBVyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNsSixNQUFNLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQy9JLE1BQU0sQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEtBQUss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RUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUMxRyxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQyxVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUMxSSxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsa0JBQWtCLEVBQUUsR0FBRyxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUMsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFDbkssTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRWpGLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsV0FBVyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNsSyxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsa0JBQWtCLEVBQUUsR0FBRyxFQUFFLEVBQUUsU0FBUyxD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QUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDeEwsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUMsU0FBUyxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZLLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxrQkFBa0IsRUFBRSxHQUFHLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQyxTQUFTLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDeEwsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUMsU0FBUyxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFFekksTUFBTSxD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QUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDekwsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUMsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3hLLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxrQkFBa0IsRUFBRSxHQUFHLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQyxVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDekwsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUMsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFFMUks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UyxDQUFDLENBQUM7UUFFaEYsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUMsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3hLLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxrQkFBa0IsRUFBRSxHQUFHLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQyxVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDekwsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUMsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3hLLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxrQkFBa0IsRUFBRSxHQUFHLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQyxVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDekwsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUMsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFFMUksTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ2xLLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxrQkFBa0IsRUFBRSxHQUFHLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbkwsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFDcEksTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLGtCQUFrQixFQUFFLEdBQUcsRUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBQzdKLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztJQUM1RSxDQUFDLENBQUMsQ0FBQztBQUdKLENBQUMsQ0FBQyxDQUFDO0FBRUgsU0FBUyxvQkFBb0IsQ0FBQyxHQUE0QjtJQUN6RCxNQUFNLE1BQU0sR0FBRyxJQUFJLHdCQUF3QixDQUFDLE1BQU0sRUFBRSxJQUFJLGNBQWMsRUFBRSxDQUFDLENBQUM7SUFDMUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDbEMsT0FBTyxNQUFNLENBQUMsa0JBQWtCLENBQUM7QUFDbEMsQ0FBQyJ9