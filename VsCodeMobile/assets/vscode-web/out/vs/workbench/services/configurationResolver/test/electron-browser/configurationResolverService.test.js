/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { stub } from 'sinon';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { normalize } from '../../../../../base/common/path.js';
import * as platform from '../../../../../base/common/platform.js';
import { isLinux, isMacintosh, isWindows } from '../../../../../base/common/platform.js';
import { isObject } from '../../../../../base/common/types.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Selection } from '../../../../../editor/common/core/selection.js';
import { EditorType } from '../../../../../editor/common/editorCommon.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { testWorkspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { TestEditorService, TestQuickInputService } from '../../../../test/browser/workbenchTestServices.js';
import { TestContextService, TestExtensionService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { BaseConfigurationResolverService } from '../../browser/baseConfigurationResolverService.js';
import { ConfigurationResolverExpression } from '../../common/configurationResolverExpression.js';
const mockLineNumber = 10;
class TestEditorServiceWithActiveEditor extends TestEditorService {
    get activeTextEditorControl() {
        return {
            getEditorType() {
                return EditorType.ICodeEditor;
            },
            getSelection() {
                return new Selection(mockLineNumber, 1, mockLineNumber, 10);
            }
        };
    }
    get activeEditor() {
        return {
            get resource() {
                return URI.parse('file:///VSCode/workspaceLocation/file');
            }
        };
    }
}
class TestConfigurationResolverService extends BaseConfigurationResolverService {
}
const nullContext = {
    getAppRoot: () => undefined,
    getExecPath: () => undefined
};
suite('Configuration Resolver Service', () => {
    let configurationResolverService;
    const envVariables = { key1: 'Value for key1', key2: 'Value for key2' };
    // let environmentService: MockWorkbenchEnvironmentService;
    let mockCommandService;
    let editorService;
    let containingWorkspace;
    let workspace;
    let quickInputService;
    let labelService;
    let pathService;
    let extensionService;
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    setup(() => {
        mockCommandService = new MockCommandService();
        editorService = disposables.add(new TestEditorServiceWithActiveEditor());
        quickInputService = new TestQuickInputService();
        // environmentService = new MockWorkbenchEnvironmentService(envVariables);
        labelService = new MockLabelService();
        pathService = new MockPathService();
        extensionService = new TestExtensionService();
        containingWorkspace = testWorkspace(URI.parse('file:///VSCode/workspaceLocation'));
        workspace = containingWorkspace.folders[0];
        configurationResolverService = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), editorService, new MockInputsConfigurationService(), mockCommandService, new TestContextService(containingWorkspace), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
    });
    teardown(() => {
        configurationResolverService = null;
    });
    test('substitute one', async () => {
        if (platform.isWindows) {
            assert.strictEqual(await configurationResolverService.resolveAsync(workspace, 'abc ${workspaceFolder} xyz'), 'abc \\VSCode\\workspaceLocation xyz');
        }
        else {
            assert.strictEqual(await configurationResolverService.resolveAsync(workspace, 'abc ${workspaceFolder} xyz'), 'abc /VSCode/workspaceLocation xyz');
        }
    });
    test('does not preserve platform config even when not matched', async () => {
        const obj = {
            program: 'osx.sh',
            windows: {
                program: 'windows.exe'
            },
            linux: {
                program: 'linux.sh'
            }
        };
        const config = await configurationResolverService.resolveAsync(workspace, obj);
        const expected = isWindows ? 'windows.exe' : isMacintosh ? 'osx.sh' : isLinux ? 'linux.sh' : undefined;
        assert.strictEqual(config.windows, undefined);
        assert.strictEqual(config.osx, undefined);
        assert.strictEqual(config.linux, undefined);
        assert.strictEqual(config.program, expected);
    });
    test('apples platform specific config', async () => {
        const expected = isWindows ? 'windows.exe' : isMacintosh ? 'osx.sh' : isLinux ? 'linux.sh' : undefined;
        const obj = {
            windows: {
                program: 'windows.exe'
            },
            osx: {
                program: 'osx.sh'
            },
            linux: {
                program: 'linux.sh'
            }
        };
        const originalObj = JSON.stringify(obj);
        const config = await configurationResolverService.resolveAsync(workspace, obj);
        assert.strictEqual(config.program, expected);
        assert.strictEqual(config.windows, undefined);
        assert.strictEqual(config.osx, undefined);
        assert.strictEqual(config.linux, undefined);
        assert.strictEqual(JSON.stringify(obj), originalObj); // did not mutate original
    });
    test('workspace folder with argument', async () => {
        if (platform.isWindows) {
            assert.strictEqual(await configurationResolverService.resolveAsync(workspace, 'abc ${workspaceFolder:workspaceLocation} xyz'), 'abc \\VSCode\\workspaceLocation xyz');
        }
        else {
            assert.strictEqual(await configurationResolverService.resolveAsync(workspace, 'abc ${workspaceFolder:workspaceLocation} xyz'), 'abc /VSCode/workspaceLocation xyz');
        }
    });
    test('workspace folder with invalid argument', async () => {
        await assert.rejects(async () => await configurationResolverService.resolveAsync(workspace, 'abc ${workspaceFolder:invalidLocation} xyz'));
    });
    test('workspace folder with undefined workspace folder', async () => {
        await assert.rejects(async () => await configurationResolverService.resolveAsync(undefined, 'abc ${workspaceFolder} xyz'));
    });
    test('workspace folder with argument and undefined workspace folder', async () => {
        if (platform.isWindows) {
            assert.strictEqual(await configurationResolverService.resolveAsync(undefined, 'abc ${workspaceFolder:workspaceLocation} xyz'), 'abc \\VSCode\\workspaceLocation xyz');
        }
        else {
            assert.strictEqual(await configurationResolverService.resolveAsync(undefined, 'abc ${workspaceFolder:workspaceLocation} xyz'), 'abc /VSCode/workspaceLocation xyz');
        }
    });
    test('workspace folder with invalid argument and undefined workspace folder', () => {
        assert.rejects(async () => await configurationResolverService.resolveAsync(undefined, 'abc ${workspaceFolder:invalidLocation} xyz'));
    });
    test('workspace root folder name', async () => {
        assert.strictEqual(await configurationResolverService.resolveAsync(workspace, 'abc ${workspaceRootFolderName} xyz'), 'abc workspaceLocation xyz');
    });
    test('current selected line number', async () => {
        assert.strictEqual(await configurationResolverService.resolveAsync(workspace, 'abc ${lineNumber} xyz'), `abc ${mockLineNumber} xyz`);
    });
    test('relative file', async () => {
        assert.strictEqual(await configurationResolverService.resolveAsync(workspace, 'abc ${relativeFile} xyz'), 'abc file xyz');
    });
    test('relative file with argument', async () => {
        assert.strictEqual(await configurationResolverService.resolveAsync(workspace, 'abc ${relativeFile:workspaceLocation} xyz'), 'abc file xyz');
    });
    test('relative file with invalid argument', () => {
        assert.rejects(async () => await configurationResolverService.resolveAsync(workspace, 'abc ${relativeFile:invalidLocation} xyz'));
    });
    test('relative file with undefined workspace folder', async () => {
        if (platform.isWindows) {
            assert.strictEqual(await configurationResolverService.resolveAsync(undefined, 'abc ${relativeFile} xyz'), 'abc \\VSCode\\workspaceLocation\\file xyz');
        }
        else {
            assert.strictEqual(await configurationResolverService.resolveAsync(undefined, 'abc ${relativeFile} xyz'), 'abc /VSCode/workspaceLocation/file xyz');
        }
    });
    test('relative file with argument and undefined workspace folder', async () => {
        assert.strictEqual(await configurationResolverService.resolveAsync(undefined, 'abc ${relativeFile:workspaceLocation} xyz'), 'abc file xyz');
    });
    test('relative file with invalid argument and undefined workspace folder', () => {
        assert.rejects(async () => await configurationResolverService.resolveAsync(undefined, 'abc ${relativeFile:invalidLocation} xyz'));
    });
    test('substitute many', async () => {
        if (platform.isWindows) {
            assert.strictEqual(await configurationResolverService.resolveAsync(workspace, '${workspaceFolder} - ${workspaceFolder}'), '\\VSCode\\workspaceLocation - \\VSCode\\workspaceLocation');
        }
        else {
            assert.strictEqual(await configurationResolverService.resolveAsync(workspace, '${workspaceFolder} - ${workspaceFolder}'), '/VSCode/workspaceLocation - /VSCode/workspaceLocation');
        }
    });
    test('substitute one env variable', async () => {
        if (platform.isWindows) {
            assert.strictEqual(await configurationResolverService.resolveAsync(workspace, 'abc ${workspaceFolder} ${env:key1} xyz'), 'abc \\VSCode\\workspaceLocation Value for key1 xyz');
        }
        else {
            assert.strictEqual(await configurationResolverService.resolveAsync(workspace, 'abc ${workspaceFolder} ${env:key1} xyz'), 'abc /VSCode/workspaceLocation Value for key1 xyz');
        }
    });
    test('substitute many env variable', async () => {
        if (platform.isWindows) {
            assert.strictEqual(await configurationResolverService.resolveAsync(workspace, '${workspaceFolder} - ${workspaceFolder} ${env:key1} - ${env:key2}'), '\\VSCode\\workspaceLocation - \\VSCode\\workspaceLocation Value for key1 - Value for key2');
        }
        else {
            assert.strictEqual(await configurationResolverService.resolveAsync(workspace, '${workspaceFolder} - ${workspaceFolder} ${env:key1} - ${env:key2}'), '/VSCode/workspaceLocation - /VSCode/workspaceLocation Value for key1 - Value for key2');
        }
    });
    test('disallows nested keys (#77289)', async () => {
        assert.strictEqual(await configurationResolverService.resolveAsync(workspace, '${env:key1} ${env:key1${env:key2}}'), 'Value for key1 ');
    });
    test('supports extensionDir', async () => {
        const getExtension = stub(extensionService, 'getExtension');
        getExtension.withArgs('publisher.extId').returns(Promise.resolve({ extensionLocation: URI.file('/some/path') }));
        assert.strictEqual(await configurationResolverService.resolveAsync(workspace, '${extensionInstallFolder:publisher.extId}'), URI.file('/some/path').fsPath);
    });
    // test('substitute keys and values in object', () => {
    // 	const myObject = {
    // 		'${workspaceRootFolderName}': '${lineNumber}',
    // 		'hey ${env:key1} ': '${workspaceRootFolderName}'
    // 	};
    // 	assert.deepStrictEqual(configurationResolverService!.resolveAsync(workspace, myObject), {
    // 		'workspaceLocation': `${editorService.mockLineNumber}`,
    // 		'hey Value for key1 ': 'workspaceLocation'
    // 	});
    // });
    test('substitute one env variable using platform case sensitivity', async () => {
        if (platform.isWindows) {
            assert.strictEqual(await configurationResolverService.resolveAsync(workspace, '${env:key1} - ${env:Key1}'), 'Value for key1 - Value for key1');
        }
        else {
            assert.strictEqual(await configurationResolverService.resolveAsync(workspace, '${env:key1} - ${env:Key1}'), 'Value for key1 - ');
        }
    });
    test('substitute one configuration variable', async () => {
        const configurationService = new TestConfigurationService({
            editor: {
                fontFamily: 'foo'
            },
            terminal: {
                integrated: {
                    fontFamily: 'bar'
                }
            }
        });
        const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
        assert.strictEqual(await service.resolveAsync(workspace, 'abc ${config:editor.fontFamily} xyz'), 'abc foo xyz');
    });
    test('inlines an array (#245718)', async () => {
        const configurationService = new TestConfigurationService({
            editor: {
                fontFamily: ['foo', 'bar']
            },
        });
        const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
        assert.strictEqual(await service.resolveAsync(workspace, 'abc ${config:editor.fontFamily} xyz'), 'abc foo,bar xyz');
    });
    test('substitute configuration variable with undefined workspace folder', async () => {
        const configurationService = new TestConfigurationService({
            editor: {
                fontFamily: 'foo'
            }
        });
        const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
        assert.strictEqual(await service.resolveAsync(undefined, 'abc ${config:editor.fontFamily} xyz'), 'abc foo xyz');
    });
    test('substitute many configuration variables', async () => {
        const configurationService = new TestConfigurationService({
            editor: {
                fontFamily: 'foo'
            },
            terminal: {
                integrated: {
                    fontFamily: 'bar'
                }
            }
        });
        const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
        assert.strictEqual(await service.resolveAsync(workspace, 'abc ${config:editor.fontFamily} ${config:terminal.integrated.fontFamily} xyz'), 'abc foo bar xyz');
    });
    test('substitute one env variable and a configuration variable', async () => {
        const configurationService = new TestConfigurationService({
            editor: {
                fontFamily: 'foo'
            },
            terminal: {
                integrated: {
                    fontFamily: 'bar'
                }
            }
        });
        const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
        if (platform.isWindows) {
            assert.strictEqual(await service.resolveAsync(workspace, 'abc ${config:editor.fontFamily} ${workspaceFolder} ${env:key1} xyz'), 'abc foo \\VSCode\\workspaceLocation Value for key1 xyz');
        }
        else {
            assert.strictEqual(await service.resolveAsync(workspace, 'abc ${config:editor.fontFamily} ${workspaceFolder} ${env:key1} xyz'), 'abc foo /VSCode/workspaceLocation Value for key1 xyz');
        }
    });
    test('recursively resolve variables', async () => {
        const configurationService = new TestConfigurationService({
            key1: 'key1=${config:key2}',
            key2: 'key2=${config:key3}',
            key3: 'we did it!',
        });
        const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
        assert.strictEqual(await service.resolveAsync(workspace, '${config:key1}'), 'key1=key2=we did it!');
    });
    test('substitute many env variable and a configuration variable', async () => {
        const configurationService = new TestConfigurationService({
            editor: {
                fontFamily: 'foo'
            },
            terminal: {
                integrated: {
                    fontFamily: 'bar'
                }
            }
        });
        const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
        if (platform.isWindows) {
            assert.strictEqual(await service.resolveAsync(workspace, '${config:editor.fontFamily} ${config:terminal.integrated.fontFamily} ${workspaceFolder} - ${workspaceFolder} ${env:key1} - ${env:key2}'), 'foo bar \\VSCode\\workspaceLocation - \\VSCode\\workspaceLocation Value for key1 - Value for key2');
        }
        else {
            assert.strictEqual(await service.resolveAsync(workspace, '${config:editor.fontFamily} ${config:terminal.integrated.fontFamily} ${workspaceFolder} - ${workspaceFolder} ${env:key1} - ${env:key2}'), 'foo bar /VSCode/workspaceLocation - /VSCode/workspaceLocation Value for key1 - Value for key2');
        }
    });
    test('mixed types of configuration variables', async () => {
        const configurationService = new TestConfigurationService({
            editor: {
                fontFamily: 'foo',
                lineNumbers: 123,
                insertSpaces: false
            },
            terminal: {
                integrated: {
                    fontFamily: 'bar'
                }
            },
            json: {
                schemas: [
                    {
                        fileMatch: [
                            '/myfile',
                            '/myOtherfile'
                        ],
                        url: 'schemaURL'
                    }
                ]
            }
        });
        const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
        assert.strictEqual(await service.resolveAsync(workspace, 'abc ${config:editor.fontFamily} ${config:editor.lineNumbers} ${config:editor.insertSpaces} xyz'), 'abc foo 123 false xyz');
    });
    test('uses original variable as fallback', async () => {
        const configurationService = new TestConfigurationService({
            editor: {}
        });
        const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
        assert.strictEqual(await service.resolveAsync(workspace, 'abc ${unknownVariable} xyz'), 'abc ${unknownVariable} xyz');
        assert.strictEqual(await service.resolveAsync(workspace, 'abc ${env:unknownVariable} xyz'), 'abc  xyz');
    });
    test('configuration variables with invalid accessor', () => {
        const configurationService = new TestConfigurationService({
            editor: {
                fontFamily: 'foo'
            }
        });
        const service = new TestConfigurationResolverService(nullContext, Promise.resolve(envVariables), disposables.add(new TestEditorServiceWithActiveEditor()), configurationService, mockCommandService, new TestContextService(), quickInputService, labelService, pathService, extensionService, disposables.add(new TestStorageService()));
        assert.rejects(async () => await service.resolveAsync(workspace, 'abc ${env} xyz'));
        assert.rejects(async () => await service.resolveAsync(workspace, 'abc ${env:} xyz'));
        assert.rejects(async () => await service.resolveAsync(workspace, 'abc ${config} xyz'));
        assert.rejects(async () => await service.resolveAsync(workspace, 'abc ${config:} xyz'));
        assert.rejects(async () => await service.resolveAsync(workspace, 'abc ${config:editor} xyz'));
        assert.rejects(async () => await service.resolveAsync(workspace, 'abc ${config:editor..fontFamily} xyz'));
        assert.rejects(async () => await service.resolveAsync(workspace, 'abc ${config:editor.none.none2} xyz'));
    });
    test('a single command variable', () => {
        const configuration = {
            'name': 'Attach to Process',
            'type': 'node',
            'request': 'attach',
            'processId': '${command:command1}',
            'port': 5858,
            'sourceMaps': false,
            'outDir': null
        };
        return configurationResolverService.resolveWithInteractionReplace(undefined, configuration).then(result => {
            assert.deepStrictEqual({ ...result }, {
                'name': 'Attach to Process',
                'type': 'node',
                'request': 'attach',
                'processId': 'command1-result',
                'port': 5858,
                'sourceMaps': false,
                'outDir': null
            });
            assert.strictEqual(1, mockCommandService.callCount);
        });
    });
    test('an old style command variable', () => {
        const configuration = {
            'name': 'Attach to Process',
            'type': 'node',
            'request': 'attach',
            'processId': '${command:commandVariable1}',
            'port': 5858,
            'sourceMaps': false,
            'outDir': null
        };
        const commandVariables = Object.create(null);
        commandVariables['commandVariable1'] = 'command1';
        return configurationResolverService.resolveWithInteractionReplace(undefined, configuration, undefined, commandVariables).then(result => {
            assert.deepStrictEqual({ ...result }, {
                'name': 'Attach to Process',
                'type': 'node',
                'request': 'attach',
                'processId': 'command1-result',
                'port': 5858,
                'sourceMaps': false,
                'outDir': null
            });
            assert.strictEqual(1, mockCommandService.callCount);
        });
    });
    test('multiple new and old-style command variables', () => {
        const configuration = {
            'name': 'Attach to Process',
            'type': 'node',
            'request': 'attach',
            'processId': '${command:commandVariable1}',
            'pid': '${command:command2}',
            'sourceMaps': false,
            'outDir': 'src/${command:command2}',
            'env': {
                'processId': '__${command:command2}__',
            }
        };
        const commandVariables = Object.create(null);
        commandVariables['commandVariable1'] = 'command1';
        return configurationResolverService.resolveWithInteractionReplace(undefined, configuration, undefined, commandVariables).then(result => {
            const expected = {
                'name': 'Attach to Process',
                'type': 'node',
                'request': 'attach',
                'processId': 'command1-result',
                'pid': 'command2-result',
                'sourceMaps': false,
                'outDir': 'src/command2-result',
                'env': {
                    'processId': '__command2-result__',
                }
            };
            assert.deepStrictEqual(Object.keys(result), Object.keys(expected));
            Object.keys(result).forEach(property => {
                const expectedProperty = expected[property];
                if (isObject(result[property])) {
                    assert.deepStrictEqual({ ...result[property] }, expectedProperty);
                }
                else {
                    assert.deepStrictEqual(result[property], expectedProperty);
                }
            });
            assert.strictEqual(2, mockCommandService.callCount);
        });
    });
    test('a command variable that relies on resolved env vars', () => {
        const configuration = {
            'name': 'Attach to Process',
            'type': 'node',
            'request': 'attach',
            'processId': '${command:commandVariable1}',
            'value': '${env:key1}'
        };
        const commandVariables = Object.create(null);
        commandVariables['commandVariable1'] = 'command1';
        return configurationResolverService.resolveWithInteractionReplace(undefined, configuration, undefined, commandVariables).then(result => {
            assert.deepStrictEqual({ ...result }, {
                'name': 'Attach to Process',
                'type': 'node',
                'request': 'attach',
                'processId': 'Value for key1',
                'value': 'Value for key1'
            });
            assert.strictEqual(1, mockCommandService.callCount);
        });
    });
    test('a single prompt input variable', () => {
        const configuration = {
            'name': 'Attach to Process',
            'type': 'node',
            'request': 'attach',
            'processId': '${input:input1}',
            'port': 5858,
            'sourceMaps': false,
            'outDir': null
        };
        return configurationResolverService.resolveWithInteractionReplace(workspace, configuration, 'tasks').then(result => {
            assert.deepStrictEqual({ ...result }, {
                'name': 'Attach to Process',
                'type': 'node',
                'request': 'attach',
                'processId': 'resolvedEnterinput1',
                'port': 5858,
                'sourceMaps': false,
                'outDir': null
            });
            assert.strictEqual(0, mockCommandService.callCount);
        });
    });
    test('a single pick input variable', () => {
        const configuration = {
            'name': 'Attach to Process',
            'type': 'node',
            'request': 'attach',
            'processId': '${input:input2}',
            'port': 5858,
            'sourceMaps': false,
            'outDir': null
        };
        return configurationResolverService.resolveWithInteractionReplace(workspace, configuration, 'tasks').then(result => {
            assert.deepStrictEqual({ ...result }, {
                'name': 'Attach to Process',
                'type': 'node',
                'request': 'attach',
                'processId': 'selectedPick',
                'port': 5858,
                'sourceMaps': false,
                'outDir': null
            });
            assert.strictEqual(0, mockCommandService.callCount);
        });
    });
    test('a single command input variable', () => {
        const configuration = {
            'name': 'Attach to Process',
            'type': 'node',
            'request': 'attach',
            'processId': '${input:input4}',
            'port': 5858,
            'sourceMaps': false,
            'outDir': null
        };
        return configurationResolverService.resolveWithInteractionReplace(workspace, configuration, 'tasks').then(result => {
            assert.deepStrictEqual({ ...result }, {
                'name': 'Attach to Process',
                'type': 'node',
                'request': 'attach',
                'processId': 'arg for command',
                'port': 5858,
                'sourceMaps': false,
                'outDir': null
            });
            assert.strictEqual(1, mockCommandService.callCount);
        });
    });
    test('several input variables and command', () => {
        const configuration = {
            'name': '${input:input3}',
            'type': '${command:command1}',
            'request': '${input:input1}',
            'processId': '${input:input2}',
            'command': '${input:input4}',
            'port': 5858,
            'sourceMaps': false,
            'outDir': null
        };
        return configurationResolverService.resolveWithInteractionReplace(workspace, configuration, 'tasks').then(result => {
            assert.deepStrictEqual({ ...result }, {
                'name': 'resolvedEnterinput3',
                'type': 'command1-result',
                'request': 'resolvedEnterinput1',
                'processId': 'selectedPick',
                'command': 'arg for command',
                'port': 5858,
                'sourceMaps': false,
                'outDir': null
            });
            assert.strictEqual(2, mockCommandService.callCount);
        });
    });
    test('input variable with undefined workspace folder', () => {
        const configuration = {
            'name': 'Attach to Process',
            'type': 'node',
            'request': 'attach',
            'processId': '${input:input1}',
            'port': 5858,
            'sourceMaps': false,
            'outDir': null
        };
        return configurationResolverService.resolveWithInteractionReplace(undefined, configuration, 'tasks').then(result => {
            assert.deepStrictEqual({ ...result }, {
                'name': 'Attach to Process',
                'type': 'node',
                'request': 'attach',
                'processId': 'resolvedEnterinput1',
                'port': 5858,
                'sourceMaps': false,
                'outDir': null
            });
            assert.strictEqual(0, mockCommandService.callCount);
        });
    });
    test('contributed variable', () => {
        const buildTask = 'npm: compile';
        const variable = 'defaultBuildTask';
        const configuration = {
            'name': '${' + variable + '}',
        };
        configurationResolverService.contributeVariable(variable, async () => { return buildTask; });
        return configurationResolverService.resolveWithInteractionReplace(workspace, configuration).then(result => {
            assert.deepStrictEqual({ ...result }, {
                'name': `${buildTask}`
            });
        });
    });
    test('resolveWithEnvironment', async () => {
        const env = {
            'VAR_1': 'VAL_1',
            'VAR_2': 'VAL_2'
        };
        const configuration = 'echo ${env:VAR_1}${env:VAR_2}';
        const resolvedResult = await configurationResolverService.resolveWithEnvironment({ ...env }, undefined, configuration);
        assert.deepStrictEqual(resolvedResult, 'echo VAL_1VAL_2');
    });
    test('substitution in object key', async () => {
        const configuration = {
            'name': 'Test',
            'mappings': {
                'pos1': 'value1',
                '${workspaceFolder}/test1': '${workspaceFolder}/test2',
                'pos3': 'value3'
            }
        };
        return configurationResolverService.resolveWithInteractionReplace(workspace, configuration, 'tasks').then(result => {
            if (platform.isWindows) {
                assert.deepStrictEqual({ ...result }, {
                    'name': 'Test',
                    'mappings': {
                        'pos1': 'value1',
                        '\\VSCode\\workspaceLocation/test1': '\\VSCode\\workspaceLocation/test2',
                        'pos3': 'value3'
                    }
                });
            }
            else {
                assert.deepStrictEqual({ ...result }, {
                    'name': 'Test',
                    'mappings': {
                        'pos1': 'value1',
                        '/VSCode/workspaceLocation/test1': '/VSCode/workspaceLocation/test2',
                        'pos3': 'value3'
                    }
                });
            }
            assert.strictEqual(0, mockCommandService.callCount);
        });
    });
});
class MockCommandService {
    constructor() {
        this.callCount = 0;
        this.onWillExecuteCommand = () => Disposable.None;
        this.onDidExecuteCommand = () => Disposable.None;
    }
    executeCommand(commandId, ...args) {
        this.callCount++;
        let result = `${commandId}-result`;
        if (args.length >= 1) {
            if (args[0] && args[0].value) {
                result = args[0].value;
            }
        }
        return Promise.resolve(result);
    }
}
class MockLabelService {
    constructor() {
        this.onDidChangeFormatters = new Emitter().event;
    }
    getUriLabel(resource, options) {
        return normalize(resource.fsPath);
    }
    getUriBasenameLabel(resource) {
        throw new Error('Method not implemented.');
    }
    getWorkspaceLabel(workspace, options) {
        throw new Error('Method not implemented.');
    }
    getHostLabel(scheme, authority) {
        throw new Error('Method not implemented.');
    }
    getHostTooltip() {
        throw new Error('Method not implemented.');
    }
    getSeparator(scheme, authority) {
        throw new Error('Method not implemented.');
    }
    registerFormatter(formatter) {
        throw new Error('Method not implemented.');
    }
    registerCachedFormatter(formatter) {
        throw new Error('Method not implemented.');
    }
}
class MockPathService {
    constructor() {
        this.defaultUriScheme = Schemas.file;
    }
    get path() {
        throw new Error('Property not implemented');
    }
    fileURI(path) {
        throw new Error('Method not implemented.');
    }
    userHome(options) {
        const uri = URI.file('c:\\users\\username');
        return options?.preferLocal ? uri : Promise.resolve(uri);
    }
    hasValidBasename(resource, arg2, name) {
        throw new Error('Method not implemented.');
    }
}
class MockInputsConfigurationService extends TestConfigurationService {
    getValue(arg1, arg2) {
        let configuration;
        if (arg1 === 'tasks') {
            configuration = {
                inputs: [
                    {
                        id: 'input1',
                        type: 'promptString',
                        description: 'Enterinput1',
                        default: 'default input1'
                    },
                    {
                        id: 'input2',
                        type: 'pickString',
                        description: 'Enterinput1',
                        default: 'option2',
                        options: ['option1', 'option2', 'option3']
                    },
                    {
                        id: 'input3',
                        type: 'promptString',
                        description: 'Enterinput3',
                        default: 'default input3',
                        provide: true,
                        password: true
                    },
                    {
                        id: 'input4',
                        type: 'command',
                        command: 'command1',
                        args: {
                            value: 'arg for command'
                        }
                    }
                ]
            };
        }
        return configuration;
    }
    inspect(key, overrides) {
        return {
            value: undefined,
            defaultValue: undefined,
            userValue: undefined,
            overrideIdentifiers: []
        };
    }
}
suite('ConfigurationResolverExpression', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('parse empty object', () => {
        const expr = ConfigurationResolverExpression.parse({});
        assert.strictEqual(Array.from(expr.unresolved()).length, 0);
        assert.deepStrictEqual(expr.toObject(), {});
    });
    test('parse simple string', () => {
        const expr = ConfigurationResolverExpression.parse({ value: '${env:HOME}' });
        const unresolved = Array.from(expr.unresolved());
        assert.strictEqual(unresolved.length, 1);
        assert.strictEqual(unresolved[0].name, 'env');
        assert.strictEqual(unresolved[0].arg, 'HOME');
    });
    test('parse string with argument and colon', () => {
        const expr = ConfigurationResolverExpression.parse({ value: '${config:path:to:value}' });
        const unresolved = Array.from(expr.unresolved());
        assert.strictEqual(unresolved.length, 1);
        assert.strictEqual(unresolved[0].name, 'config');
        assert.strictEqual(unresolved[0].arg, 'path:to:value');
    });
    test('parse object with nested variables', () => {
        const expr = ConfigurationResolverExpression.parse({
            name: '${env:USERNAME}',
            path: '${env:HOME}/folder',
            settings: {
                value: '${config:path}'
            },
            array: ['${env:TERM}', { key: '${env:KEY}' }]
        });
        const unresolved = Array.from(expr.unresolved());
        assert.strictEqual(unresolved.length, 5);
        assert.deepStrictEqual(unresolved.map(r => r.name).sort(), ['config', 'env', 'env', 'env', 'env']);
    });
    test('resolve and get result', () => {
        const expr = ConfigurationResolverExpression.parse({
            name: '${env:USERNAME}',
            path: '${env:HOME}/folder'
        });
        expr.resolve({ inner: 'env:USERNAME', id: '${env:USERNAME}', name: 'env', arg: 'USERNAME' }, 'testuser');
        expr.resolve({ inner: 'env:HOME', id: '${env:HOME}', name: 'env', arg: 'HOME' }, '/home/testuser');
        assert.deepStrictEqual(expr.toObject(), {
            name: 'testuser',
            path: '/home/testuser/folder'
        });
    });
    test('keeps unresolved variables', () => {
        const expr = ConfigurationResolverExpression.parse({
            name: '${env:USERNAME}'
        });
        assert.deepStrictEqual(expr.toObject(), {
            name: '${env:USERNAME}'
        });
    });
    test('deduplicates identical variables', () => {
        const expr = ConfigurationResolverExpression.parse({
            first: '${env:HOME}',
            second: '${env:HOME}'
        });
        const unresolved = Array.from(expr.unresolved());
        assert.strictEqual(unresolved.length, 1);
        assert.strictEqual(unresolved[0].name, 'env');
        assert.strictEqual(unresolved[0].arg, 'HOME');
        expr.resolve(unresolved[0], '/home/user');
        assert.deepStrictEqual(expr.toObject(), {
            first: '/home/user',
            second: '/home/user'
        });
    });
    test('handles root string value', () => {
        const expr = ConfigurationResolverExpression.parse('abc ${env:HOME} xyz');
        const unresolved = Array.from(expr.unresolved());
        assert.strictEqual(unresolved.length, 1);
        assert.strictEqual(unresolved[0].name, 'env');
        assert.strictEqual(unresolved[0].arg, 'HOME');
        expr.resolve(unresolved[0], '/home/user');
        assert.strictEqual(expr.toObject(), 'abc /home/user xyz');
    });
    test('handles root string value with multiple variables', () => {
        const expr = ConfigurationResolverExpression.parse('${env:HOME}/folder${env:SHELL}');
        const unresolved = Array.from(expr.unresolved());
        assert.strictEqual(unresolved.length, 2);
        expr.resolve({ id: '${env:HOME}', inner: 'env:HOME', name: 'env', arg: 'HOME' }, '/home/user');
        expr.resolve({ id: '${env:SHELL}', inner: 'env:SHELL', name: 'env', arg: 'SHELL' }, '/bin/bash');
        assert.strictEqual(expr.toObject(), '/home/user/folder/bin/bash');
    });
    test('handles root string with escaped variables', () => {
        const expr = ConfigurationResolverExpression.parse('abc ${env:HOME${env:USER}} xyz');
        const unresolved = Array.from(expr.unresolved());
        assert.strictEqual(unresolved.length, 1);
        assert.strictEqual(unresolved[0].name, 'env');
        assert.strictEqual(unresolved[0].arg, 'HOME${env:USER}');
    });
    test('resolves nested values', () => {
        const expr = ConfigurationResolverExpression.parse({
            name: '${env:REDIRECTED}',
            'key that is ${env:REDIRECTED}': 'cool!',
        });
        for (const r of expr.unresolved()) {
            if (r.arg === 'REDIRECTED') {
                expr.resolve(r, 'username: ${env:USERNAME}');
            }
            else if (r.arg === 'USERNAME') {
                expr.resolve(r, 'testuser');
            }
        }
        assert.deepStrictEqual(expr.toObject(), {
            name: 'username: testuser',
            'key that is username: testuser': 'cool!'
        });
    });
    test('resolves nested values 2 (#245798)', () => {
        const expr = ConfigurationResolverExpression.parse({
            env: {
                SITE: '${input:site}',
                TLD: '${input:tld}',
                HOST: '${input:host}',
            },
        });
        for (const r of expr.unresolved()) {
            if (r.arg === 'site') {
                expr.resolve(r, 'example');
            }
            else if (r.arg === 'tld') {
                expr.resolve(r, 'com');
            }
            else if (r.arg === 'host') {
                expr.resolve(r, 'local.${input:site}.${input:tld}');
            }
        }
        assert.deepStrictEqual(expr.toObject(), {
            env: {
                SITE: 'example',
                TLD: 'com',
                HOST: 'local.example.com'
            }
        });
    });
    test('out-of-order key resolution (#248550)', () => {
        const expr = ConfigurationResolverExpression.parse({
            '${input:key}': '${input:value}',
        });
        for (const r of expr.unresolved()) {
            if (r.arg === 'key') {
                expr.resolve(r, 'the-key');
            }
        }
        for (const r of expr.unresolved()) {
            if (r.arg === 'value') {
                expr.resolve(r, 'the-value');
            }
        }
        assert.deepStrictEqual(expr.toObject(), {
            'the-key': 'the-value'
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZS50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9jb25maWd1cmF0aW9uUmVzb2x2ZXIvdGVzdC9lbGVjdHJvbi1icm93c2VyL2NvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLE9BQU8sQ0FBQztBQUM3QixPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0scUNBQXFDLENBQUM7QUFDckUsT0FBTyxFQUFFLFVBQVUsRUFBZSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEVBQVMsU0FBUyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDdEUsT0FBTyxLQUFLLFFBQVEsTUFBTSx3Q0FBd0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN6RixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDL0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMzRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFHMUUsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFJekgsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBQy9GLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQzdHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxvQkFBb0IsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBR2hJLE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBRXJHLE9BQU8sRUFBRSwrQkFBK0IsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBRWxHLE1BQU0sY0FBYyxHQUFHLEVBQUUsQ0FBQztBQUMxQixNQUFNLGlDQUFrQyxTQUFRLGlCQUFpQjtJQUNoRSxJQUFhLHVCQUF1QjtRQUNuQyxPQUFPO1lBQ04sYUFBYTtnQkFDWixPQUFPLFVBQVUsQ0FBQyxXQUFXLENBQUM7WUFDL0IsQ0FBQztZQUNELFlBQVk7Z0JBQ1gsT0FBTyxJQUFJLFNBQVMsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxFQUFFLGNBQWMsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUM3RCxDQUFDO1NBQ0QsQ0FBQztJQUNILENBQUM7SUFDRCxJQUFhLFlBQVk7UUFDeEIsT0FBTztZQUNOLElBQUksUUFBUTtnQkFDWCxPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsdUNBQXVDLENBQUMsQ0FBQztZQUMzRCxDQUFDO1NBQ0QsQ0FBQztJQUNILENBQUM7Q0FDRDtBQUVELE1BQU0sZ0NBQWlDLFNBQVEsZ0NBQWdDO0NBRTlFO0FBRUQsTUFBTSxXQUFXLEdBQUc7SUFDbkIsVUFBVSxFQUFFLEdBQUcsRUFBRSxDQUFDLFNBQVM7SUFDM0IsV0FBVyxFQUFFLEdBQUcsRUFBRSxDQUFDLFNBQVM7Q0FDNUIsQ0FBQztBQUVGLEtBQUssQ0FBQyxnQ0FBZ0MsRUFBRSxHQUFHLEVBQUU7SUFDNUMsSUFBSSw0QkFBa0UsQ0FBQztJQUN2RSxNQUFNLFlBQVksR0FBOEIsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLENBQUM7SUFDbkcsMkRBQTJEO0lBQzNELElBQUksa0JBQXNDLENBQUM7SUFDM0MsSUFBSSxhQUFnRCxDQUFDO0lBQ3JELElBQUksbUJBQThCLENBQUM7SUFDbkMsSUFBSSxTQUEyQixDQUFDO0lBQ2hDLElBQUksaUJBQXdDLENBQUM7SUFDN0MsSUFBSSxZQUE4QixDQUFDO0lBQ25DLElBQUksV0FBNEIsQ0FBQztJQUNqQyxJQUFJLGdCQUFtQyxDQUFDO0lBRXhDLE1BQU0sV0FBVyxHQUFHLHVDQUF1QyxFQUFFLENBQUM7SUFFOUQsS0FBSyxDQUFDLEdBQUcsRUFBRTtRQUNWLGtCQUFrQixHQUFHLElBQUksa0JBQWtCLEVBQUUsQ0FBQztRQUM5QyxhQUFhLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLGlDQUFpQyxFQUFFLENBQUMsQ0FBQztRQUN6RSxpQkFBaUIsR0FBRyxJQUFJLHFCQUFxQixFQUFFLENBQUM7UUFDaEQsMEVBQTBFO1FBQzFFLFlBQVksR0FBRyxJQUFJLGdCQUFnQixFQUFFLENBQUM7UUFDdEMsV0FBVyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFDcEMsZ0JBQWdCLEdBQUcsSUFBSSxvQkFBb0IsRUFBRSxDQUFDO1FBQzlDLG1CQUFtQixHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLGtDQUFrQyxDQUFDLENBQUMsQ0FBQztRQUNuRixTQUFTLEdBQUcsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzNDLDRCQUE0QixHQUFHLElBQUksZ0NBQWdDLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEVBQUUsYUFBYSxFQUFFLElBQUksOEJBQThCLEVBQUUsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLGtCQUFrQixDQUFDLG1CQUFtQixDQUFDLEVBQUUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksa0JBQWtCLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDbFYsQ0FBQyxDQUFDLENBQUM7SUFFSCxRQUFRLENBQUMsR0FBRyxFQUFFO1FBQ2IsNEJBQTRCLEdBQUcsSUFBSSxDQUFDO0lBQ3JDLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGdCQUFnQixFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ2pDLElBQUksUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3hCLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSw0QkFBNkIsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLDRCQUE0QixDQUFDLEVBQUUscUNBQXFDLENBQUMsQ0FBQztRQUN0SixDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSw0QkFBNkIsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLDRCQUE0QixDQUFDLEVBQUUsbUNBQW1DLENBQUMsQ0FBQztRQUNwSixDQUFDO0lBQ0YsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMseURBQXlELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDMUUsTUFBTSxHQUFHLEdBQUc7WUFDWCxPQUFPLEVBQUUsUUFBUTtZQUNqQixPQUFPLEVBQUU7Z0JBQ1IsT0FBTyxFQUFFLGFBQWE7YUFDdEI7WUFDRCxLQUFLLEVBQUU7Z0JBQ04sT0FBTyxFQUFFLFVBQVU7YUFDbkI7U0FDRCxDQUFDO1FBQ0YsTUFBTSxNQUFNLEdBQVEsTUFBTSw0QkFBNkIsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRXJGLE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUV2RyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDOUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQzFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM1QyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDOUMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsaUNBQWlDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDbEQsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ3ZHLE1BQU0sR0FBRyxHQUFHO1lBQ1gsT0FBTyxFQUFFO2dCQUNSLE9BQU8sRUFBRSxhQUFhO2FBQ3RCO1lBQ0QsR0FBRyxFQUFFO2dCQUNKLE9BQU8sRUFBRSxRQUFRO2FBQ2pCO1lBQ0QsS0FBSyxFQUFFO2dCQUNOLE9BQU8sRUFBRSxVQUFVO2FBQ25CO1NBQ0QsQ0FBQztRQUNGLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDeEMsTUFBTSxNQUFNLEdBQVEsTUFBTSw0QkFBNkIsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRXJGLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUM3QyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDOUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQzFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM1QyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQywwQkFBMEI7SUFDakYsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsZ0NBQWdDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDakQsSUFBSSxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDeEIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLDRCQUE2QixDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsOENBQThDLENBQUMsRUFBRSxxQ0FBcUMsQ0FBQyxDQUFDO1FBQ3hLLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLDRCQUE2QixDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsOENBQThDLENBQUMsRUFBRSxtQ0FBbUMsQ0FBQyxDQUFDO1FBQ3RLLENBQUM7SUFDRixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyx3Q0FBd0MsRUFBRSxLQUFLLElBQUksRUFBRTtRQUN6RCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQyxNQUFNLDRCQUE2QixDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsNENBQTRDLENBQUMsQ0FBQyxDQUFDO0lBQzdJLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGtEQUFrRCxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ25FLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDLE1BQU0sNEJBQTZCLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSw0QkFBNEIsQ0FBQyxDQUFDLENBQUM7SUFDN0gsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsK0RBQStELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDaEYsSUFBSSxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDeEIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLDRCQUE2QixDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsOENBQThDLENBQUMsRUFBRSxxQ0FBcUMsQ0FBQyxDQUFDO1FBQ3hLLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLDRCQUE2QixDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsOENBQThDLENBQUMsRUFBRSxtQ0FBbUMsQ0FBQyxDQUFDO1FBQ3RLLENBQUM7SUFDRixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyx1RUFBdUUsRUFBRSxHQUFHLEVBQUU7UUFDbEYsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDLE1BQU0sNEJBQTZCLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSw0Q0FBNEMsQ0FBQyxDQUFDLENBQUM7SUFDdkksQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsNEJBQTRCLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDN0MsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLDRCQUE2QixDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsb0NBQW9DLENBQUMsRUFBRSwyQkFBMkIsQ0FBQyxDQUFDO0lBQ3BKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDhCQUE4QixFQUFFLEtBQUssSUFBSSxFQUFFO1FBQy9DLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSw0QkFBNkIsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLHVCQUF1QixDQUFDLEVBQUUsT0FBTyxjQUFjLE1BQU0sQ0FBQyxDQUFDO0lBQ3ZJLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGVBQWUsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNoQyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sNEJBQTZCLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSx5QkFBeUIsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBQzVILENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDZCQUE2QixFQUFFLEtBQUssSUFBSSxFQUFFO1FBQzlDLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSw0QkFBNkIsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLDJDQUEyQyxDQUFDLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDOUksQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMscUNBQXFDLEVBQUUsR0FBRyxFQUFFO1FBQ2hELE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQyxNQUFNLDRCQUE2QixDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUseUNBQXlDLENBQUMsQ0FBQyxDQUFDO0lBQ3BJLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLCtDQUErQyxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ2hFLElBQUksUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3hCLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSw0QkFBNkIsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLHlCQUF5QixDQUFDLEVBQUUsMkNBQTJDLENBQUMsQ0FBQztRQUN6SixDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSw0QkFBNkIsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLHlCQUF5QixDQUFDLEVBQUUsd0NBQXdDLENBQUMsQ0FBQztRQUN0SixDQUFDO0lBQ0YsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsNERBQTRELEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDN0UsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLDRCQUE2QixDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsMkNBQTJDLENBQUMsRUFBRSxjQUFjLENBQUMsQ0FBQztJQUM5SSxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxvRUFBb0UsRUFBRSxHQUFHLEVBQUU7UUFDL0UsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDLE1BQU0sNEJBQTZCLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSx5Q0FBeUMsQ0FBQyxDQUFDLENBQUM7SUFDcEksQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsaUJBQWlCLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDbEMsSUFBSSxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDeEIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLDRCQUE2QixDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUseUNBQXlDLENBQUMsRUFBRSwyREFBMkQsQ0FBQyxDQUFDO1FBQ3pMLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLDRCQUE2QixDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUseUNBQXlDLENBQUMsRUFBRSx1REFBdUQsQ0FBQyxDQUFDO1FBQ3JMLENBQUM7SUFDRixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw2QkFBNkIsRUFBRSxLQUFLLElBQUksRUFBRTtRQUM5QyxJQUFJLFFBQVEsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUN4QixNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sNEJBQTZCLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSx3Q0FBd0MsQ0FBQyxFQUFFLG9EQUFvRCxDQUFDLENBQUM7UUFDakwsQ0FBQzthQUFNLENBQUM7WUFDUCxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sNEJBQTZCLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSx3Q0FBd0MsQ0FBQyxFQUFFLGtEQUFrRCxDQUFDLENBQUM7UUFDL0ssQ0FBQztJQUNGLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDhCQUE4QixFQUFFLEtBQUssSUFBSSxFQUFFO1FBQy9DLElBQUksUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3hCLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSw0QkFBNkIsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLG1FQUFtRSxDQUFDLEVBQUUsMkZBQTJGLENBQUMsQ0FBQztRQUNuUCxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSw0QkFBNkIsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLG1FQUFtRSxDQUFDLEVBQUUsdUZBQXVGLENBQUMsQ0FBQztRQUMvTyxDQUFDO0lBQ0YsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsZ0NBQWdDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDakQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLDRCQUE2QixDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsb0NBQW9DLENBQUMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0lBQzFJLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHVCQUF1QixFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3hDLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUM1RCxZQUFZLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUEyQixDQUFDLENBQUMsQ0FBQztRQUUxSSxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sNEJBQTZCLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSwyQ0FBMkMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDN0osQ0FBQyxDQUFDLENBQUM7SUFFSCx1REFBdUQ7SUFDdkQsc0JBQXNCO0lBQ3RCLG1EQUFtRDtJQUNuRCxxREFBcUQ7SUFDckQsTUFBTTtJQUNOLDZGQUE2RjtJQUM3Riw0REFBNEQ7SUFDNUQsK0NBQStDO0lBQy9DLE9BQU87SUFDUCxNQUFNO0lBR04sSUFBSSxDQUFDLDZEQUE2RCxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQzlFLElBQUksUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3hCLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSw0QkFBNkIsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLDJCQUEyQixDQUFDLEVBQUUsaUNBQWlDLENBQUMsQ0FBQztRQUNqSixDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSw0QkFBNkIsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLDJCQUEyQixDQUFDLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUNuSSxDQUFDO0lBQ0YsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsdUNBQXVDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDeEQsTUFBTSxvQkFBb0IsR0FBMEIsSUFBSSx3QkFBd0IsQ0FBQztZQUNoRixNQUFNLEVBQUU7Z0JBQ1AsVUFBVSxFQUFFLEtBQUs7YUFDakI7WUFDRCxRQUFRLEVBQUU7Z0JBQ1QsVUFBVSxFQUFFO29CQUNYLFVBQVUsRUFBRSxLQUFLO2lCQUNqQjthQUNEO1NBQ0QsQ0FBQyxDQUFDO1FBRUgsTUFBTSxPQUFPLEdBQUcsSUFBSSxnQ0FBZ0MsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsRUFBRSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksaUNBQWlDLEVBQUUsQ0FBQyxFQUFFLG9CQUFvQixFQUFFLGtCQUFrQixFQUFFLElBQUksa0JBQWtCLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLGdCQUFnQixFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxrQkFBa0IsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxVSxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sT0FBTyxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUscUNBQXFDLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUNqSCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw0QkFBNEIsRUFBRSxLQUFLLElBQUksRUFBRTtRQUM3QyxNQUFNLG9CQUFvQixHQUEwQixJQUFJLHdCQUF3QixDQUFDO1lBQ2hGLE1BQU0sRUFBRTtnQkFDUCxVQUFVLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDO2FBQzFCO1NBQ0QsQ0FBQyxDQUFDO1FBRUgsTUFBTSxPQUFPLEdBQUcsSUFBSSxnQ0FBZ0MsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsRUFBRSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksaUNBQWlDLEVBQUUsQ0FBQyxFQUFFLG9CQUFvQixFQUFFLGtCQUFrQixFQUFFLElBQUksa0JBQWtCLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLGdCQUFnQixFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxrQkFBa0IsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxVSxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sT0FBTyxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUscUNBQXFDLENBQUMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3JILENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLG1FQUFtRSxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ3BGLE1BQU0sb0JBQW9CLEdBQTBCLElBQUksd0JBQXdCLENBQUM7WUFDaEYsTUFBTSxFQUFFO2dCQUNQLFVBQVUsRUFBRSxLQUFLO2FBQ2pCO1NBQ0QsQ0FBQyxDQUFDO1FBRUgsTUFBTSxPQUFPLEdBQUcsSUFBSSxnQ0FBZ0MsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsRUFBRSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksaUNBQWlDLEVBQUUsQ0FBQyxFQUFFLG9CQUFvQixFQUFFLGtCQUFrQixFQUFFLElBQUksa0JBQWtCLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLGdCQUFnQixFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxrQkFBa0IsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxVSxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sT0FBTyxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUscUNBQXFDLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUNqSCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyx5Q0FBeUMsRUFBRSxLQUFLLElBQUksRUFBRTtRQUMxRCxNQUFNLG9CQUFvQixHQUFHLElBQUksd0JBQXdCLENBQUM7WUFDekQsTUFBTSxFQUFFO2dCQUNQLFVBQVUsRUFBRSxLQUFLO2FBQ2pCO1lBQ0QsUUFBUSxFQUFFO2dCQUNULFVBQVUsRUFBRTtvQkFDWCxVQUFVLEVBQUUsS0FBSztpQkFDakI7YUFDRDtTQUNELENBQUMsQ0FBQztRQUVILE1BQU0sT0FBTyxHQUFHLElBQUksZ0NBQWdDLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEVBQUUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLGlDQUFpQyxFQUFFLENBQUMsRUFBRSxvQkFBb0IsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLGtCQUFrQixFQUFFLEVBQUUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksa0JBQWtCLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMVUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLDhFQUE4RSxDQUFDLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztJQUM5SixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQywwREFBMEQsRUFBRSxLQUFLLElBQUksRUFBRTtRQUMzRSxNQUFNLG9CQUFvQixHQUFHLElBQUksd0JBQXdCLENBQUM7WUFDekQsTUFBTSxFQUFFO2dCQUNQLFVBQVUsRUFBRSxLQUFLO2FBQ2pCO1lBQ0QsUUFBUSxFQUFFO2dCQUNULFVBQVUsRUFBRTtvQkFDWCxVQUFVLEVBQUUsS0FBSztpQkFDakI7YUFDRDtTQUNELENBQUMsQ0FBQztRQUVILE1BQU0sT0FBTyxHQUFHLElBQUksZ0NBQWdDLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEVBQUUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLGlDQUFpQyxFQUFFLENBQUMsRUFBRSxvQkFBb0IsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLGtCQUFrQixFQUFFLEVBQUUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksa0JBQWtCLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMVUsSUFBSSxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDeEIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLG9FQUFvRSxDQUFDLEVBQUUsd0RBQXdELENBQUMsQ0FBQztRQUMzTCxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxPQUFPLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSxvRUFBb0UsQ0FBQyxFQUFFLHNEQUFzRCxDQUFDLENBQUM7UUFDekwsQ0FBQztJQUNGLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLCtCQUErQixFQUFFLEtBQUssSUFBSSxFQUFFO1FBQ2hELE1BQU0sb0JBQW9CLEdBQUcsSUFBSSx3QkFBd0IsQ0FBQztZQUN6RCxJQUFJLEVBQUUscUJBQXFCO1lBQzNCLElBQUksRUFBRSxxQkFBcUI7WUFDM0IsSUFBSSxFQUFFLFlBQVk7U0FDbEIsQ0FBQyxDQUFDO1FBRUgsTUFBTSxPQUFPLEdBQUcsSUFBSSxnQ0FBZ0MsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsRUFBRSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksaUNBQWlDLEVBQUUsQ0FBQyxFQUFFLG9CQUFvQixFQUFFLGtCQUFrQixFQUFFLElBQUksa0JBQWtCLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLGdCQUFnQixFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxrQkFBa0IsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxVSxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sT0FBTyxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsZ0JBQWdCLENBQUMsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO0lBQ3JHLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDJEQUEyRCxFQUFFLEtBQUssSUFBSSxFQUFFO1FBQzVFLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSx3QkFBd0IsQ0FBQztZQUN6RCxNQUFNLEVBQUU7Z0JBQ1AsVUFBVSxFQUFFLEtBQUs7YUFDakI7WUFDRCxRQUFRLEVBQUU7Z0JBQ1QsVUFBVSxFQUFFO29CQUNYLFVBQVUsRUFBRSxLQUFLO2lCQUNqQjthQUNEO1NBQ0QsQ0FBQyxDQUFDO1FBRUgsTUFBTSxPQUFPLEdBQUcsSUFBSSxnQ0FBZ0MsQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsRUFBRSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksaUNBQWlDLEVBQUUsQ0FBQyxFQUFFLG9CQUFvQixFQUFFLGtCQUFrQixFQUFFLElBQUksa0JBQWtCLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLGdCQUFnQixFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxrQkFBa0IsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxVSxJQUFJLFFBQVEsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUN4QixNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sT0FBTyxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsd0lBQXdJLENBQUMsRUFBRSxtR0FBbUcsQ0FBQyxDQUFDO1FBQzFTLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLHdJQUF3SSxDQUFDLEVBQUUsK0ZBQStGLENBQUMsQ0FBQztRQUN0UyxDQUFDO0lBQ0YsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsd0NBQXdDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDekQsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLHdCQUF3QixDQUFDO1lBQ3pELE1BQU0sRUFBRTtnQkFDUCxVQUFVLEVBQUUsS0FBSztnQkFDakIsV0FBVyxFQUFFLEdBQUc7Z0JBQ2hCLFlBQVksRUFBRSxLQUFLO2FBQ25CO1lBQ0QsUUFBUSxFQUFFO2dCQUNULFVBQVUsRUFBRTtvQkFDWCxVQUFVLEVBQUUsS0FBSztpQkFDakI7YUFDRDtZQUNELElBQUksRUFBRTtnQkFDTCxPQUFPLEVBQUU7b0JBQ1I7d0JBQ0MsU0FBUyxFQUFFOzRCQUNWLFNBQVM7NEJBQ1QsY0FBYzt5QkFDZDt3QkFDRCxHQUFHLEVBQUUsV0FBVztxQkFDaEI7aUJBQ0Q7YUFDRDtTQUNELENBQUMsQ0FBQztRQUVILE1BQU0sT0FBTyxHQUFHLElBQUksZ0NBQWdDLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEVBQUUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLGlDQUFpQyxFQUFFLENBQUMsRUFBRSxvQkFBb0IsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLGtCQUFrQixFQUFFLEVBQUUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksa0JBQWtCLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMVUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLGdHQUFnRyxDQUFDLEVBQUUsdUJBQXVCLENBQUMsQ0FBQztJQUN0TCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxvQ0FBb0MsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNyRCxNQUFNLG9CQUFvQixHQUFHLElBQUksd0JBQXdCLENBQUM7WUFDekQsTUFBTSxFQUFFLEVBQUU7U0FDVixDQUFDLENBQUM7UUFFSCxNQUFNLE9BQU8sR0FBRyxJQUFJLGdDQUFnQyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxpQ0FBaUMsRUFBRSxDQUFDLEVBQUUsb0JBQW9CLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxrQkFBa0IsRUFBRSxFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsZ0JBQWdCLEVBQUUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLGtCQUFrQixFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzFVLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxPQUFPLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSw0QkFBNEIsQ0FBQyxFQUFFLDRCQUE0QixDQUFDLENBQUM7UUFDdEgsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLGdDQUFnQyxDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDekcsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsK0NBQStDLEVBQUUsR0FBRyxFQUFFO1FBQzFELE1BQU0sb0JBQW9CLEdBQUcsSUFBSSx3QkFBd0IsQ0FBQztZQUN6RCxNQUFNLEVBQUU7Z0JBQ1AsVUFBVSxFQUFFLEtBQUs7YUFDakI7U0FDRCxDQUFDLENBQUM7UUFFSCxNQUFNLE9BQU8sR0FBRyxJQUFJLGdDQUFnQyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxpQ0FBaUMsRUFBRSxDQUFDLEVBQUUsb0JBQW9CLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxrQkFBa0IsRUFBRSxFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsZ0JBQWdCLEVBQUUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLGtCQUFrQixFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRTFVLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLGdCQUFnQixDQUFDLENBQUMsQ0FBQztRQUNwRixNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUMsTUFBTSxPQUFPLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7UUFDckYsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDLE1BQU0sT0FBTyxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO1FBQ3ZGLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUMsQ0FBQztRQUN4RixNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUMsTUFBTSxPQUFPLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSwwQkFBMEIsQ0FBQyxDQUFDLENBQUM7UUFDOUYsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDLE1BQU0sT0FBTyxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsc0NBQXNDLENBQUMsQ0FBQyxDQUFDO1FBQzFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQyxNQUFNLE9BQU8sQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLHFDQUFxQyxDQUFDLENBQUMsQ0FBQztJQUMxRyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQywyQkFBMkIsRUFBRSxHQUFHLEVBQUU7UUFFdEMsTUFBTSxhQUFhLEdBQUc7WUFDckIsTUFBTSxFQUFFLG1CQUFtQjtZQUMzQixNQUFNLEVBQUUsTUFBTTtZQUNkLFNBQVMsRUFBRSxRQUFRO1lBQ25CLFdBQVcsRUFBRSxxQkFBcUI7WUFDbEMsTUFBTSxFQUFFLElBQUk7WUFDWixZQUFZLEVBQUUsS0FBSztZQUNuQixRQUFRLEVBQUUsSUFBSTtTQUNkLENBQUM7UUFFRixPQUFPLDRCQUE2QixDQUFDLDZCQUE2QixDQUFDLFNBQVMsRUFBRSxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDMUcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxFQUFFLEdBQUcsTUFBTSxFQUFFLEVBQUU7Z0JBQ3JDLE1BQU0sRUFBRSxtQkFBbUI7Z0JBQzNCLE1BQU0sRUFBRSxNQUFNO2dCQUNkLFNBQVMsRUFBRSxRQUFRO2dCQUNuQixXQUFXLEVBQUUsaUJBQWlCO2dCQUM5QixNQUFNLEVBQUUsSUFBSTtnQkFDWixZQUFZLEVBQUUsS0FBSztnQkFDbkIsUUFBUSxFQUFFLElBQUk7YUFDZCxDQUFDLENBQUM7WUFFSCxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNyRCxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLCtCQUErQixFQUFFLEdBQUcsRUFBRTtRQUMxQyxNQUFNLGFBQWEsR0FBRztZQUNyQixNQUFNLEVBQUUsbUJBQW1CO1lBQzNCLE1BQU0sRUFBRSxNQUFNO1lBQ2QsU0FBUyxFQUFFLFFBQVE7WUFDbkIsV0FBVyxFQUFFLDZCQUE2QjtZQUMxQyxNQUFNLEVBQUUsSUFBSTtZQUNaLFlBQVksRUFBRSxLQUFLO1lBQ25CLFFBQVEsRUFBRSxJQUFJO1NBQ2QsQ0FBQztRQUNGLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QyxnQkFBZ0IsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLFVBQVUsQ0FBQztRQUVsRCxPQUFPLDRCQUE2QixDQUFDLDZCQUE2QixDQUFDLFNBQVMsRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3ZJLE1BQU0sQ0FBQyxlQUFlLENBQUMsRUFBRSxHQUFHLE1BQU0sRUFBRSxFQUFFO2dCQUNyQyxNQUFNLEVBQUUsbUJBQW1CO2dCQUMzQixNQUFNLEVBQUUsTUFBTTtnQkFDZCxTQUFTLEVBQUUsUUFBUTtnQkFDbkIsV0FBVyxFQUFFLGlCQUFpQjtnQkFDOUIsTUFBTSxFQUFFLElBQUk7Z0JBQ1osWUFBWSxFQUFFLEtBQUs7Z0JBQ25CLFFBQVEsRUFBRSxJQUFJO2FBQ2QsQ0FBQyxDQUFDO1lBRUgsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsa0JBQWtCLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDckQsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw4Q0FBOEMsRUFBRSxHQUFHLEVBQUU7UUFFekQsTUFBTSxhQUFhLEdBQUc7WUFDckIsTUFBTSxFQUFFLG1CQUFtQjtZQUMzQixNQUFNLEVBQUUsTUFBTTtZQUNkLFNBQVMsRUFBRSxRQUFRO1lBQ25CLFdBQVcsRUFBRSw2QkFBNkI7WUFDMUMsS0FBSyxFQUFFLHFCQUFxQjtZQUM1QixZQUFZLEVBQUUsS0FBSztZQUNuQixRQUFRLEVBQUUseUJBQXlCO1lBQ25DLEtBQUssRUFBRTtnQkFDTixXQUFXLEVBQUUseUJBQXlCO2FBQ3RDO1NBQ0QsQ0FBQztRQUNGLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QyxnQkFBZ0IsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLFVBQVUsQ0FBQztRQUVsRCxPQUFPLDRCQUE2QixDQUFDLDZCQUE2QixDQUFDLFNBQVMsRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3ZJLE1BQU0sUUFBUSxHQUFHO2dCQUNoQixNQUFNLEVBQUUsbUJBQW1CO2dCQUMzQixNQUFNLEVBQUUsTUFBTTtnQkFDZCxTQUFTLEVBQUUsUUFBUTtnQkFDbkIsV0FBVyxFQUFFLGlCQUFpQjtnQkFDOUIsS0FBSyxFQUFFLGlCQUFpQjtnQkFDeEIsWUFBWSxFQUFFLEtBQUs7Z0JBQ25CLFFBQVEsRUFBRSxxQkFBcUI7Z0JBQy9CLEtBQUssRUFBRTtvQkFDTixXQUFXLEVBQUUscUJBQXFCO2lCQUNsQzthQUNELENBQUM7WUFFRixNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBQ25FLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUN0QyxNQUFNLGdCQUFnQixHQUFJLFFBQW9DLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3pFLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQ2hDLE1BQU0sQ0FBQyxlQUFlLENBQUMsRUFBRSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLGdCQUFnQixDQUFDLENBQUM7Z0JBQ25FLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO2dCQUM1RCxDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUM7WUFDSCxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNyRCxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHFEQUFxRCxFQUFFLEdBQUcsRUFBRTtRQUVoRSxNQUFNLGFBQWEsR0FBRztZQUNyQixNQUFNLEVBQUUsbUJBQW1CO1lBQzNCLE1BQU0sRUFBRSxNQUFNO1lBQ2QsU0FBUyxFQUFFLFFBQVE7WUFDbkIsV0FBVyxFQUFFLDZCQUE2QjtZQUMxQyxPQUFPLEVBQUUsYUFBYTtTQUN0QixDQUFDO1FBQ0YsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzdDLGdCQUFnQixDQUFDLGtCQUFrQixDQUFDLEdBQUcsVUFBVSxDQUFDO1FBRWxELE9BQU8sNEJBQTZCLENBQUMsNkJBQTZCLENBQUMsU0FBUyxFQUFFLGFBQWEsRUFBRSxTQUFTLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFFdkksTUFBTSxDQUFDLGVBQWUsQ0FBQyxFQUFFLEdBQUcsTUFBTSxFQUFFLEVBQUU7Z0JBQ3JDLE1BQU0sRUFBRSxtQkFBbUI7Z0JBQzNCLE1BQU0sRUFBRSxNQUFNO2dCQUNkLFNBQVMsRUFBRSxRQUFRO2dCQUNuQixXQUFXLEVBQUUsZ0JBQWdCO2dCQUM3QixPQUFPLEVBQUUsZ0JBQWdCO2FBQ3pCLENBQUMsQ0FBQztZQUVILE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxFQUFFLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3JELENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsZ0NBQWdDLEVBQUUsR0FBRyxFQUFFO1FBRTNDLE1BQU0sYUFBYSxHQUFHO1lBQ3JCLE1BQU0sRUFBRSxtQkFBbUI7WUFDM0IsTUFBTSxFQUFFLE1BQU07WUFDZCxTQUFTLEVBQUUsUUFBUTtZQUNuQixXQUFXLEVBQUUsaUJBQWlCO1lBQzlCLE1BQU0sRUFBRSxJQUFJO1lBQ1osWUFBWSxFQUFFLEtBQUs7WUFDbkIsUUFBUSxFQUFFLElBQUk7U0FDZCxDQUFDO1FBRUYsT0FBTyw0QkFBNkIsQ0FBQyw2QkFBNkIsQ0FBQyxTQUFTLEVBQUUsYUFBYSxFQUFFLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUVuSCxNQUFNLENBQUMsZUFBZSxDQUFDLEVBQUUsR0FBRyxNQUFNLEVBQUUsRUFBRTtnQkFDckMsTUFBTSxFQUFFLG1CQUFtQjtnQkFDM0IsTUFBTSxFQUFFLE1BQU07Z0JBQ2QsU0FBUyxFQUFFLFFBQVE7Z0JBQ25CLFdBQVcsRUFBRSxxQkFBcUI7Z0JBQ2xDLE1BQU0sRUFBRSxJQUFJO2dCQUNaLFlBQVksRUFBRSxLQUFLO2dCQUNuQixRQUFRLEVBQUUsSUFBSTthQUNkLENBQUMsQ0FBQztZQUVILE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxFQUFFLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3JELENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsOEJBQThCLEVBQUUsR0FBRyxFQUFFO1FBRXpDLE1BQU0sYUFBYSxHQUFHO1lBQ3JCLE1BQU0sRUFBRSxtQkFBbUI7WUFDM0IsTUFBTSxFQUFFLE1BQU07WUFDZCxTQUFTLEVBQUUsUUFBUTtZQUNuQixXQUFXLEVBQUUsaUJBQWlCO1lBQzlCLE1BQU0sRUFBRSxJQUFJO1lBQ1osWUFBWSxFQUFFLEtBQUs7WUFDbkIsUUFBUSxFQUFFLElBQUk7U0FDZCxDQUFDO1FBRUYsT0FBTyw0QkFBNkIsQ0FBQyw2QkFBNkIsQ0FBQyxTQUFTLEVBQUUsYUFBYSxFQUFFLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUVuSCxNQUFNLENBQUMsZUFBZSxDQUFDLEVBQUUsR0FBRyxNQUFNLEVBQUUsRUFBRTtnQkFDckMsTUFBTSxFQUFFLG1CQUFtQjtnQkFDM0IsTUFBTSxFQUFFLE1BQU07Z0JBQ2QsU0FBUyxFQUFFLFFBQVE7Z0JBQ25CLFdBQVcsRUFBRSxjQUFjO2dCQUMzQixNQUFNLEVBQUUsSUFBSTtnQkFDWixZQUFZLEVBQUUsS0FBSztnQkFDbkIsUUFBUSxFQUFFLElBQUk7YUFDZCxDQUFDLENBQUM7WUFFSCxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNyRCxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGlDQUFpQyxFQUFFLEdBQUcsRUFBRTtRQUU1QyxNQUFNLGFBQWEsR0FBRztZQUNyQixNQUFNLEVBQUUsbUJBQW1CO1lBQzNCLE1BQU0sRUFBRSxNQUFNO1lBQ2QsU0FBUyxFQUFFLFFBQVE7WUFDbkIsV0FBVyxFQUFFLGlCQUFpQjtZQUM5QixNQUFNLEVBQUUsSUFBSTtZQUNaLFlBQVksRUFBRSxLQUFLO1lBQ25CLFFBQVEsRUFBRSxJQUFJO1NBQ2QsQ0FBQztRQUVGLE9BQU8sNEJBQTZCLENBQUMsNkJBQTZCLENBQUMsU0FBUyxFQUFFLGFBQWEsRUFBRSxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFFbkgsTUFBTSxDQUFDLGVBQWUsQ0FBQyxFQUFFLEdBQUcsTUFBTSxFQUFFLEVBQUU7Z0JBQ3JDLE1BQU0sRUFBRSxtQkFBbUI7Z0JBQzNCLE1BQU0sRUFBRSxNQUFNO2dCQUNkLFNBQVMsRUFBRSxRQUFRO2dCQUNuQixXQUFXLEVBQUUsaUJBQWlCO2dCQUM5QixNQUFNLEVBQUUsSUFBSTtnQkFDWixZQUFZLEVBQUUsS0FBSztnQkFDbkIsUUFBUSxFQUFFLElBQUk7YUFDZCxDQUFDLENBQUM7WUFFSCxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNyRCxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHFDQUFxQyxFQUFFLEdBQUcsRUFBRTtRQUVoRCxNQUFNLGFBQWEsR0FBRztZQUNyQixNQUFNLEVBQUUsaUJBQWlCO1lBQ3pCLE1BQU0sRUFBRSxxQkFBcUI7WUFDN0IsU0FBUyxFQUFFLGlCQUFpQjtZQUM1QixXQUFXLEVBQUUsaUJBQWlCO1lBQzlCLFNBQVMsRUFBRSxpQkFBaUI7WUFDNUIsTUFBTSxFQUFFLElBQUk7WUFDWixZQUFZLEVBQUUsS0FBSztZQUNuQixRQUFRLEVBQUUsSUFBSTtTQUNkLENBQUM7UUFFRixPQUFPLDRCQUE2QixDQUFDLDZCQUE2QixDQUFDLFNBQVMsRUFBRSxhQUFhLEVBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBRW5ILE1BQU0sQ0FBQyxlQUFlLENBQUMsRUFBRSxHQUFHLE1BQU0sRUFBRSxFQUFFO2dCQUNyQyxNQUFNLEVBQUUscUJBQXFCO2dCQUM3QixNQUFNLEVBQUUsaUJBQWlCO2dCQUN6QixTQUFTLEVBQUUscUJBQXFCO2dCQUNoQyxXQUFXLEVBQUUsY0FBYztnQkFDM0IsU0FBUyxFQUFFLGlCQUFpQjtnQkFDNUIsTUFBTSxFQUFFLElBQUk7Z0JBQ1osWUFBWSxFQUFFLEtBQUs7Z0JBQ25CLFFBQVEsRUFBRSxJQUFJO2FBQ2QsQ0FBQyxDQUFDO1lBRUgsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsa0JBQWtCLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDckQsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxnREFBZ0QsRUFBRSxHQUFHLEVBQUU7UUFFM0QsTUFBTSxhQUFhLEdBQUc7WUFDckIsTUFBTSxFQUFFLG1CQUFtQjtZQUMzQixNQUFNLEVBQUUsTUFBTTtZQUNkLFNBQVMsRUFBRSxRQUFRO1lBQ25CLFdBQVcsRUFBRSxpQkFBaUI7WUFDOUIsTUFBTSxFQUFFLElBQUk7WUFDWixZQUFZLEVBQUUsS0FBSztZQUNuQixRQUFRLEVBQUUsSUFBSTtTQUNkLENBQUM7UUFFRixPQUFPLDRCQUE2QixDQUFDLDZCQUE2QixDQUFDLFNBQVMsRUFBRSxhQUFhLEVBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBRW5ILE1BQU0sQ0FBQyxlQUFlLENBQUMsRUFBRSxHQUFHLE1BQU0sRUFBRSxFQUFFO2dCQUNyQyxNQUFNLEVBQUUsbUJBQW1CO2dCQUMzQixNQUFNLEVBQUUsTUFBTTtnQkFDZCxTQUFTLEVBQUUsUUFBUTtnQkFDbkIsV0FBVyxFQUFFLHFCQUFxQjtnQkFDbEMsTUFBTSxFQUFFLElBQUk7Z0JBQ1osWUFBWSxFQUFFLEtBQUs7Z0JBQ25CLFFBQVEsRUFBRSxJQUFJO2FBQ2QsQ0FBQyxDQUFDO1lBRUgsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsa0JBQWtCLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDckQsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxzQkFBc0IsRUFBRSxHQUFHLEVBQUU7UUFDakMsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDO1FBQ2pDLE1BQU0sUUFBUSxHQUFHLGtCQUFrQixDQUFDO1FBQ3BDLE1BQU0sYUFBYSxHQUFHO1lBQ3JCLE1BQU0sRUFBRSxJQUFJLEdBQUcsUUFBUSxHQUFHLEdBQUc7U0FDN0IsQ0FBQztRQUNGLDRCQUE2QixDQUFDLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxLQUFLLElBQUksRUFBRSxHQUFHLE9BQU8sU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDOUYsT0FBTyw0QkFBNkIsQ0FBQyw2QkFBNkIsQ0FBQyxTQUFTLEVBQUUsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQzFHLE1BQU0sQ0FBQyxlQUFlLENBQUMsRUFBRSxHQUFHLE1BQU0sRUFBRSxFQUFFO2dCQUNyQyxNQUFNLEVBQUUsR0FBRyxTQUFTLEVBQUU7YUFDdEIsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyx3QkFBd0IsRUFBRSxLQUFLLElBQUksRUFBRTtRQUN6QyxNQUFNLEdBQUcsR0FBRztZQUNYLE9BQU8sRUFBRSxPQUFPO1lBQ2hCLE9BQU8sRUFBRSxPQUFPO1NBQ2hCLENBQUM7UUFDRixNQUFNLGFBQWEsR0FBRywrQkFBK0IsQ0FBQztRQUN0RCxNQUFNLGNBQWMsR0FBRyxNQUFNLDRCQUE2QixDQUFDLHNCQUFzQixDQUFDLEVBQUUsR0FBRyxHQUFHLEVBQUUsRUFBRSxTQUFTLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDeEgsTUFBTSxDQUFDLGVBQWUsQ0FBQyxjQUFjLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztJQUMzRCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw0QkFBNEIsRUFBRSxLQUFLLElBQUksRUFBRTtRQUU3QyxNQUFNLGFBQWEsR0FBRztZQUNyQixNQUFNLEVBQUUsTUFBTTtZQUNkLFVBQVUsRUFBRTtnQkFDWCxNQUFNLEVBQUUsUUFBUTtnQkFDaEIsMEJBQTBCLEVBQUUsMEJBQTBCO2dCQUN0RCxNQUFNLEVBQUUsUUFBUTthQUNoQjtTQUNELENBQUM7UUFFRixPQUFPLDRCQUE2QixDQUFDLDZCQUE2QixDQUFDLFNBQVMsRUFBRSxhQUFhLEVBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBRW5ILElBQUksUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUN4QixNQUFNLENBQUMsZUFBZSxDQUFDLEVBQUUsR0FBRyxNQUFNLEVBQUUsRUFBRTtvQkFDckMsTUFBTSxFQUFFLE1BQU07b0JBQ2QsVUFBVSxFQUFFO3dCQUNYLE1BQU0sRUFBRSxRQUFRO3dCQUNoQixtQ0FBbUMsRUFBRSxtQ0FBbUM7d0JBQ3hFLE1BQU0sRUFBRSxRQUFRO3FCQUNoQjtpQkFDRCxDQUFDLENBQUM7WUFDSixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsTUFBTSxDQUFDLGVBQWUsQ0FBQyxFQUFFLEdBQUcsTUFBTSxFQUFFLEVBQUU7b0JBQ3JDLE1BQU0sRUFBRSxNQUFNO29CQUNkLFVBQVUsRUFBRTt3QkFDWCxNQUFNLEVBQUUsUUFBUTt3QkFDaEIsaUNBQWlDLEVBQUUsaUNBQWlDO3dCQUNwRSxNQUFNLEVBQUUsUUFBUTtxQkFDaEI7aUJBQ0QsQ0FBQyxDQUFDO1lBQ0osQ0FBQztZQUVELE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxFQUFFLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3JELENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQztBQUdILE1BQU0sa0JBQWtCO0lBQXhCO1FBR1EsY0FBUyxHQUFHLENBQUMsQ0FBQztRQUVyQix5QkFBb0IsR0FBRyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO1FBQzdDLHdCQUFtQixHQUFHLEdBQUcsRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUM7SUFhN0MsQ0FBQztJQVpPLGNBQWMsQ0FBQyxTQUFpQixFQUFFLEdBQUcsSUFBVztRQUN0RCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFFakIsSUFBSSxNQUFNLEdBQUcsR0FBRyxTQUFTLFNBQVMsQ0FBQztRQUNuQyxJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDdEIsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUM5QixNQUFNLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUN4QixDQUFDO1FBQ0YsQ0FBQztRQUVELE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNoQyxDQUFDO0NBQ0Q7QUFFRCxNQUFNLGdCQUFnQjtJQUF0QjtRQTBCVSwwQkFBcUIsR0FBaUMsSUFBSSxPQUFPLEVBQXlCLENBQUMsS0FBSyxDQUFDO0lBQzNHLENBQUM7SUF6QkEsV0FBVyxDQUFDLFFBQWEsRUFBRSxPQUE0RTtRQUN0RyxPQUFPLFNBQVMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUNELG1CQUFtQixDQUFDLFFBQWE7UUFDaEMsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxpQkFBaUIsQ0FBQyxTQUFrRCxFQUFFLE9BQWdDO1FBQ3JHLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ0QsWUFBWSxDQUFDLE1BQWMsRUFBRSxTQUFrQjtRQUM5QyxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNNLGNBQWM7UUFDcEIsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxZQUFZLENBQUMsTUFBYyxFQUFFLFNBQWtCO1FBQzlDLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ0QsaUJBQWlCLENBQUMsU0FBaUM7UUFDbEQsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCx1QkFBdUIsQ0FBQyxTQUFpQztRQUN4RCxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUVEO0FBRUQsTUFBTSxlQUFlO0lBQXJCO1FBS0MscUJBQWdCLEdBQVcsT0FBTyxDQUFDLElBQUksQ0FBQztJQWdCekMsQ0FBQztJQW5CQSxJQUFJLElBQUk7UUFDUCxNQUFNLElBQUksS0FBSyxDQUFDLDBCQUEwQixDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUVELE9BQU8sQ0FBQyxJQUFZO1FBQ25CLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBR0QsUUFBUSxDQUFDLE9BQWtDO1FBQzFDLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUM1QyxPQUFPLE9BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBR0QsZ0JBQWdCLENBQUMsUUFBYSxFQUFFLElBQXdDLEVBQUUsSUFBYTtRQUN0RixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUVEO0FBRUQsTUFBTSw4QkFBK0IsU0FBUSx3QkFBd0I7SUFDcEQsUUFBUSxDQUFDLElBQVUsRUFBRSxJQUFVO1FBQzlDLElBQUksYUFBYSxDQUFDO1FBQ2xCLElBQUksSUFBSSxLQUFLLE9BQU8sRUFBRSxDQUFDO1lBQ3RCLGFBQWEsR0FBRztnQkFDZixNQUFNLEVBQUU7b0JBQ1A7d0JBQ0MsRUFBRSxFQUFFLFFBQVE7d0JBQ1osSUFBSSxFQUFFLGNBQWM7d0JBQ3BCLFdBQVcsRUFBRSxhQUFhO3dCQUMxQixPQUFPLEVBQUUsZ0JBQWdCO3FCQUN6QjtvQkFDRDt3QkFDQyxFQUFFLEVBQUUsUUFBUTt3QkFDWixJQUFJLEVBQUUsWUFBWTt3QkFDbEIsV0FBVyxFQUFFLGFBQWE7d0JBQzFCLE9BQU8sRUFBRSxTQUFTO3dCQUNsQixPQUFPLEVBQUUsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQztxQkFDMUM7b0JBQ0Q7d0JBQ0MsRUFBRSxFQUFFLFFBQVE7d0JBQ1osSUFBSSxFQUFFLGNBQWM7d0JBQ3BCLFdBQVcsRUFBRSxhQUFhO3dCQUMxQixPQUFPLEVBQUUsZ0JBQWdCO3dCQUN6QixPQUFPLEVBQUUsSUFBSTt3QkFDYixRQUFRLEVBQUUsSUFBSTtxQkFDZDtvQkFDRDt3QkFDQyxFQUFFLEVBQUUsUUFBUTt3QkFDWixJQUFJLEVBQUUsU0FBUzt3QkFDZixPQUFPLEVBQUUsVUFBVTt3QkFDbkIsSUFBSSxFQUFFOzRCQUNMLEtBQUssRUFBRSxpQkFBaUI7eUJBQ3hCO3FCQUNEO2lCQUNEO2FBQ0QsQ0FBQztRQUNILENBQUM7UUFDRCxPQUFPLGFBQWEsQ0FBQztJQUN0QixDQUFDO0lBRWUsT0FBTyxDQUFJLEdBQVcsRUFBRSxTQUFtQztRQUMxRSxPQUFPO1lBQ04sS0FBSyxFQUFFLFNBQVM7WUFDaEIsWUFBWSxFQUFFLFNBQVM7WUFDdkIsU0FBUyxFQUFFLFNBQVM7WUFDcEIsbUJBQW1CLEVBQUUsRUFBRTtTQUN2QixDQUFDO0lBQ0gsQ0FBQztDQUNEO0FBRUQsS0FBSyxDQUFDLGlDQUFpQyxFQUFFLEdBQUcsRUFBRTtJQUM3Qyx1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxHQUFHLEVBQUU7UUFDL0IsTUFBTSxJQUFJLEdBQUcsK0JBQStCLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDN0MsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMscUJBQXFCLEVBQUUsR0FBRyxFQUFFO1FBQ2hDLE1BQU0sSUFBSSxHQUFHLCtCQUErQixDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsQ0FBQyxDQUFDO1FBQzdFLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDakQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3pDLE1BQU0sQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUM5QyxNQUFNLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDL0MsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsc0NBQXNDLEVBQUUsR0FBRyxFQUFFO1FBQ2pELE1BQU0sSUFBSSxHQUFHLCtCQUErQixDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssRUFBRSx5QkFBeUIsRUFBRSxDQUFDLENBQUM7UUFDekYsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztRQUNqRCxNQUFNLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDekMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ2pELE1BQU0sQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxlQUFlLENBQUMsQ0FBQztJQUN4RCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxvQ0FBb0MsRUFBRSxHQUFHLEVBQUU7UUFDL0MsTUFBTSxJQUFJLEdBQUcsK0JBQStCLENBQUMsS0FBSyxDQUFDO1lBQ2xELElBQUksRUFBRSxpQkFBaUI7WUFDdkIsSUFBSSxFQUFFLG9CQUFvQjtZQUMxQixRQUFRLEVBQUU7Z0JBQ1QsS0FBSyxFQUFFLGdCQUFnQjthQUN2QjtZQUNELEtBQUssRUFBRSxDQUFDLGFBQWEsRUFBRSxFQUFFLEdBQUcsRUFBRSxZQUFZLEVBQUUsQ0FBQztTQUM3QyxDQUFDLENBQUM7UUFFSCxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQ2pELE1BQU0sQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN6QyxNQUFNLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUNwRyxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyx3QkFBd0IsRUFBRSxHQUFHLEVBQUU7UUFDbkMsTUFBTSxJQUFJLEdBQUcsK0JBQStCLENBQUMsS0FBSyxDQUFDO1lBQ2xELElBQUksRUFBRSxpQkFBaUI7WUFDdkIsSUFBSSxFQUFFLG9CQUFvQjtTQUMxQixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsS0FBSyxFQUFFLGNBQWMsRUFBRSxFQUFFLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsVUFBVSxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDekcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBRW5HLE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFO1lBQ3ZDLElBQUksRUFBRSxVQUFVO1lBQ2hCLElBQUksRUFBRSx1QkFBdUI7U0FDN0IsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsNEJBQTRCLEVBQUUsR0FBRyxFQUFFO1FBQ3ZDLE1BQU0sSUFBSSxHQUFHLCtCQUErQixDQUFDLEtBQUssQ0FBQztZQUNsRCxJQUFJLEVBQUUsaUJBQWlCO1NBQ3ZCLENBQUMsQ0FBQztRQUVILE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFO1lBQ3ZDLElBQUksRUFBRSxpQkFBaUI7U0FDdkIsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsa0NBQWtDLEVBQUUsR0FBRyxFQUFFO1FBQzdDLE1BQU0sSUFBSSxHQUFHLCtCQUErQixDQUFDLEtBQUssQ0FBQztZQUNsRCxLQUFLLEVBQUUsYUFBYTtZQUNwQixNQUFNLEVBQUUsYUFBYTtTQUNyQixDQUFDLENBQUM7UUFFSCxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQ2pELE1BQU0sQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN6QyxNQUFNLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDOUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRTlDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxZQUFZO1lBQ25CLE1BQU0sRUFBRSxZQUFZO1NBQ3BCLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDJCQUEyQixFQUFFLEdBQUcsRUFBRTtRQUN0QyxNQUFNLElBQUksR0FBRywrQkFBK0IsQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUMxRSxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQ2pELE1BQU0sQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN6QyxNQUFNLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDOUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRTlDLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFLG9CQUFvQixDQUFDLENBQUM7SUFDM0QsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsbURBQW1ELEVBQUUsR0FBRyxFQUFFO1FBQzlELE1BQU0sSUFBSSxHQUFHLCtCQUErQixDQUFDLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO1FBQ3JGLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDakQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRXpDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDL0YsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRSxjQUFjLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUUsRUFBRSxXQUFXLENBQUMsQ0FBQztRQUNqRyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsRUFBRSw0QkFBNEIsQ0FBQyxDQUFDO0lBQ25FLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDRDQUE0QyxFQUFFLEdBQUcsRUFBRTtRQUN2RCxNQUFNLElBQUksR0FBRywrQkFBK0IsQ0FBQyxLQUFLLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztRQUNyRixNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQ2pELE1BQU0sQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN6QyxNQUFNLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDOUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLGlCQUFpQixDQUFDLENBQUM7SUFDMUQsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsd0JBQXdCLEVBQUUsR0FBRyxFQUFFO1FBQ25DLE1BQU0sSUFBSSxHQUFHLCtCQUErQixDQUFDLEtBQUssQ0FBQztZQUNsRCxJQUFJLEVBQUUsbUJBQW1CO1lBQ3pCLCtCQUErQixFQUFFLE9BQU87U0FDeEMsQ0FBQyxDQUFDO1FBRUgsS0FBSyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQztZQUNuQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssWUFBWSxFQUFFLENBQUM7Z0JBQzVCLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLDJCQUEyQixDQUFDLENBQUM7WUFDOUMsQ0FBQztpQkFBTSxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssVUFBVSxFQUFFLENBQUM7Z0JBQ2pDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQzdCLENBQUM7UUFDRixDQUFDO1FBRUQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUU7WUFDdkMsSUFBSSxFQUFFLG9CQUFvQjtZQUMxQixnQ0FBZ0MsRUFBRSxPQUFPO1NBQ3pDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLG9DQUFvQyxFQUFFLEdBQUcsRUFBRTtRQUMvQyxNQUFNLElBQUksR0FBRywrQkFBK0IsQ0FBQyxLQUFLLENBQUM7WUFDbEQsR0FBRyxFQUFFO2dCQUNKLElBQUksRUFBRSxlQUFlO2dCQUNyQixHQUFHLEVBQUUsY0FBYztnQkFDbkIsSUFBSSxFQUFFLGVBQWU7YUFDckI7U0FDRCxDQUFDLENBQUM7UUFFSCxLQUFLLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBQ25DLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxNQUFNLEVBQUUsQ0FBQztnQkFDdEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDNUIsQ0FBQztpQkFBTSxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssS0FBSyxFQUFFLENBQUM7Z0JBQzVCLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3hCLENBQUM7aUJBQU0sSUFBSSxDQUFDLENBQUMsR0FBRyxLQUFLLE1BQU0sRUFBRSxDQUFDO2dCQUM3QixJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxrQ0FBa0MsQ0FBQyxDQUFDO1lBQ3JELENBQUM7UUFDRixDQUFDO1FBRUQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUU7WUFDdkMsR0FBRyxFQUFFO2dCQUNKLElBQUksRUFBRSxTQUFTO2dCQUNmLEdBQUcsRUFBRSxLQUFLO2dCQUNWLElBQUksRUFBRSxtQkFBbUI7YUFDekI7U0FDRCxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyx1Q0FBdUMsRUFBRSxHQUFHLEVBQUU7UUFDbEQsTUFBTSxJQUFJLEdBQUcsK0JBQStCLENBQUMsS0FBSyxDQUFDO1lBQ2xELGNBQWMsRUFBRSxnQkFBZ0I7U0FDaEMsQ0FBQyxDQUFDO1FBRUgsS0FBSyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQztZQUNuQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssS0FBSyxFQUFFLENBQUM7Z0JBQ3JCLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzVCLENBQUM7UUFDRixDQUFDO1FBQ0QsS0FBSyxNQUFNLENBQUMsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQztZQUNuQyxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssT0FBTyxFQUFFLENBQUM7Z0JBQ3ZCLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1lBQzlCLENBQUM7UUFDRixDQUFDO1FBRUQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUU7WUFDdkMsU0FBUyxFQUFFLFdBQVc7U0FDdEIsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9