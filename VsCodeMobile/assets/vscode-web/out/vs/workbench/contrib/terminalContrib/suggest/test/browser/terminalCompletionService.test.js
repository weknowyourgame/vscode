/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { URI } from '../../../../../../base/common/uri.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { TerminalCompletionService } from '../../browser/terminalCompletionService.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import assert, { fail } from 'assert';
import { isWindows } from '../../../../../../base/common/platform.js';
import { createFileStat } from '../../../../../test/common/workbenchTestServices.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { TerminalCapabilityStore } from '../../../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js';
import { ShellEnvDetectionCapability } from '../../../../../../platform/terminal/common/capabilities/shellEnvDetectionCapability.js';
import { TerminalCompletionItemKind } from '../../browser/terminalCompletionItem.js';
import { count } from '../../../../../../base/common/strings.js';
import { ITerminalLogService } from '../../../../../../platform/terminal/common/terminal.js';
import { gitBashToWindowsPath, windowsToGitBashPath } from '../../browser/terminalGitBashHelpers.js';
import { NullLogService } from '../../../../../../platform/log/common/log.js';
import { TestPathService, workbenchInstantiationService } from '../../../../../test/browser/workbenchTestServices.js';
const pathSeparator = isWindows ? '\\' : '/';
/**
 * Assert the set of completions exist exactly, including their order.
 */
function assertCompletions(actual, expected, expectedConfig, pathSep) {
    const sep = pathSep ?? pathSeparator;
    assert.deepStrictEqual(actual?.map(e => ({
        label: e.label,
        detail: e.detail ?? '',
        kind: e.kind ?? TerminalCompletionItemKind.Folder,
        replacementRange: e.replacementRange,
    })), expected.map(e => ({
        label: e.label.replaceAll('/', sep),
        detail: e.detail ? e.detail.replaceAll('/', sep) : '',
        kind: e.kind ?? TerminalCompletionItemKind.Folder,
        replacementRange: expectedConfig.replacementRange,
    })));
}
/**
 * Assert a set of completions exist within the actual set.
 */
function assertPartialCompletionsExist(actual, expectedPartial, expectedConfig) {
    if (!actual) {
        fail();
    }
    const expectedMapped = expectedPartial.map(e => ({
        label: e.label.replaceAll('/', pathSeparator),
        detail: e.detail ? e.detail.replaceAll('/', pathSeparator) : '',
        kind: e.kind ?? TerminalCompletionItemKind.Folder,
        replacementRange: expectedConfig.replacementRange,
    }));
    for (const expectedItem of expectedMapped) {
        assert.deepStrictEqual(actual.map(e => ({
            label: e.label,
            detail: e.detail ?? '',
            kind: e.kind ?? TerminalCompletionItemKind.Folder,
            replacementRange: e.replacementRange,
        })).find(e => e.detail === expectedItem.detail), expectedItem);
    }
}
const testEnv = {
    HOME: '/home/user',
    USERPROFILE: '/home/user'
};
let homeDir = isWindows ? testEnv['USERPROFILE'] : testEnv['HOME'];
if (!homeDir.endsWith('/')) {
    homeDir += '/';
}
const standardTildeItem = Object.freeze({ label: '~', detail: homeDir });
suite('TerminalCompletionService', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let configurationService;
    let capabilities;
    let validResources;
    let childResources;
    let terminalCompletionService;
    const provider = 'testProvider';
    setup(() => {
        instantiationService = workbenchInstantiationService({
            pathService: () => new TestPathService(URI.file(homeDir ?? '/')),
        }, store);
        configurationService = new TestConfigurationService();
        instantiationService.stub(ITerminalLogService, new NullLogService());
        instantiationService.stub(IConfigurationService, configurationService);
        instantiationService.stub(IFileService, {
            async stat(resource) {
                if (!validResources.map(e => e.path).includes(resource.path)) {
                    throw new Error('Doesn\'t exist');
                }
                return createFileStat(resource);
            },
            async resolve(resource, options) {
                const children = childResources.filter(child => {
                    const childFsPath = child.resource.path.replace(/\/$/, '');
                    const parentFsPath = resource.path.replace(/\/$/, '');
                    return (childFsPath.startsWith(parentFsPath) &&
                        count(childFsPath, '/') === count(parentFsPath, '/') + 1);
                });
                return createFileStat(resource, undefined, undefined, undefined, undefined, children);
            },
            async realpath(resource) {
                if (resource.path.includes('symlink-file')) {
                    return resource.with({ path: '/target/actual-file.txt' });
                }
                else if (resource.path.includes('symlink-folder')) {
                    return resource.with({ path: '/target/actual-folder' });
                }
                return undefined;
            }
        });
        terminalCompletionService = store.add(instantiationService.createInstance(TerminalCompletionService));
        terminalCompletionService.processEnv = testEnv;
        validResources = [];
        childResources = [];
        capabilities = store.add(new TerminalCapabilityStore());
    });
    suite('resolveResources should return undefined', () => {
        test('if neither showFiles nor showFolders are true', async () => {
            const resourceOptions = {
                cwd: URI.parse('file:///test'),
                pathSeparator
            };
            validResources = [URI.parse('file:///test')];
            const result = await terminalCompletionService.resolveResources(resourceOptions, 'cd ', 3, provider, capabilities);
            assert(!result);
        });
    });
    suite('resolveResources should return folder completions', () => {
        setup(() => {
            validResources = [URI.parse('file:///test')];
            childResources = [
                { resource: URI.parse('file:///test/folder1/'), isDirectory: true, isFile: false },
                { resource: URI.parse('file:///test/file1.txt'), isDirectory: false, isFile: true },
            ];
        });
        test('| should return root-level completions', async () => {
            const resourceOptions = {
                cwd: URI.parse('file:///test'),
                showDirectories: true,
                pathSeparator
            };
            const result = await terminalCompletionService.resolveResources(resourceOptions, '', 1, provider, capabilities);
            assertCompletions(result, [
                { label: '.', detail: '/test/' },
                { label: './folder1/', detail: '/test/folder1/' },
                { label: '../', detail: '/' },
                standardTildeItem,
            ], { replacementRange: [1, 1] });
        });
        test('./| should return folder completions', async () => {
            const resourceOptions = {
                cwd: URI.parse('file:///test'),
                showDirectories: true,
                pathSeparator
            };
            const result = await terminalCompletionService.resolveResources(resourceOptions, './', 3, provider, capabilities);
            assertCompletions(result, [
                { label: './', detail: '/test/' },
                { label: './folder1/', detail: '/test/folder1/' },
                { label: './../', detail: '/' },
            ], { replacementRange: [1, 3] });
        });
        test('cd ./| should return folder completions', async () => {
            const resourceOptions = {
                cwd: URI.parse('file:///test'),
                showDirectories: true,
                pathSeparator
            };
            const result = await terminalCompletionService.resolveResources(resourceOptions, 'cd ./', 5, provider, capabilities);
            assertCompletions(result, [
                { label: './', detail: '/test/' },
                { label: './folder1/', detail: '/test/folder1/' },
                { label: './../', detail: '/' },
            ], { replacementRange: [3, 5] });
        });
        test('cd ./f| should return folder completions', async () => {
            const resourceOptions = {
                cwd: URI.parse('file:///test'),
                showDirectories: true,
                pathSeparator
            };
            const result = await terminalCompletionService.resolveResources(resourceOptions, 'cd ./f', 6, provider, capabilities);
            assertCompletions(result, [
                { label: './', detail: '/test/' },
                { label: './folder1/', detail: '/test/folder1/' },
                { label: './../', detail: '/' },
            ], { replacementRange: [3, 6] });
        });
    });
    suite('resolveResources should handle file and folder completion requests correctly', () => {
        setup(() => {
            validResources = [URI.parse('file:///test')];
            childResources = [
                { resource: URI.parse('file:///test/.hiddenFile'), isFile: true },
                { resource: URI.parse('file:///test/.hiddenFolder/'), isDirectory: true },
                { resource: URI.parse('file:///test/folder1/'), isDirectory: true },
                { resource: URI.parse('file:///test/file1.txt'), isFile: true },
            ];
        });
        test('./| should handle hidden files and folders', async () => {
            const resourceOptions = {
                cwd: URI.parse('file:///test'),
                showDirectories: true,
                showFiles: true,
                pathSeparator
            };
            const result = await terminalCompletionService.resolveResources(resourceOptions, './', 2, provider, capabilities);
            assertCompletions(result, [
                { label: './', detail: '/test/' },
                { label: './.hiddenFile', detail: '/test/.hiddenFile', kind: TerminalCompletionItemKind.File },
                { label: './.hiddenFolder/', detail: '/test/.hiddenFolder/' },
                { label: './folder1/', detail: '/test/folder1/' },
                { label: './file1.txt', detail: '/test/file1.txt', kind: TerminalCompletionItemKind.File },
                { label: './../', detail: '/' },
            ], { replacementRange: [0, 2] });
        });
        test('./h| should handle hidden files and folders', async () => {
            const resourceOptions = {
                cwd: URI.parse('file:///test'),
                showDirectories: true,
                showFiles: true,
                pathSeparator
            };
            const result = await terminalCompletionService.resolveResources(resourceOptions, './h', 3, provider, capabilities);
            assertCompletions(result, [
                { label: './', detail: '/test/' },
                { label: './.hiddenFile', detail: '/test/.hiddenFile', kind: TerminalCompletionItemKind.File },
                { label: './.hiddenFolder/', detail: '/test/.hiddenFolder/' },
                { label: './folder1/', detail: '/test/folder1/' },
                { label: './file1.txt', detail: '/test/file1.txt', kind: TerminalCompletionItemKind.File },
                { label: './../', detail: '/' },
            ], { replacementRange: [0, 3] });
        });
    });
    suite('~ -> $HOME', () => {
        let resourceOptions;
        let shellEnvDetection;
        setup(() => {
            shellEnvDetection = store.add(new ShellEnvDetectionCapability());
            shellEnvDetection.setEnvironment({
                HOME: '/home',
                USERPROFILE: '/home'
            }, true);
            capabilities.add(5 /* TerminalCapability.ShellEnvDetection */, shellEnvDetection);
            resourceOptions = {
                cwd: URI.parse('file:///test/folder1'), // Updated to reflect home directory
                showFiles: true,
                showDirectories: true,
                pathSeparator
            };
            validResources = [
                URI.parse('file:///test'),
                URI.parse('file:///test/folder1'),
                URI.parse('file:///home'),
                URI.parse('file:///home/vscode'),
                URI.parse('file:///home/vscode/foo'),
                URI.parse('file:///home/vscode/bar.txt'),
            ];
            childResources = [
                { resource: URI.parse('file:///home/vscode'), isDirectory: true },
                { resource: URI.parse('file:///home/vscode/foo'), isDirectory: true },
                { resource: URI.parse('file:///home/vscode/bar.txt'), isFile: true },
            ];
        });
        test('~| should return completion for ~', async () => {
            assertPartialCompletionsExist(await terminalCompletionService.resolveResources(resourceOptions, '~', 1, provider, capabilities), [
                { label: '~', detail: '/home/' },
            ], { replacementRange: [0, 1] });
        });
        test('~/| should return folder completions relative to $HOME', async () => {
            assertCompletions(await terminalCompletionService.resolveResources(resourceOptions, '~/', 2, provider, capabilities), [
                { label: '~/', detail: '/home/' },
                { label: '~/vscode/', detail: '/home/vscode/' },
            ], { replacementRange: [0, 2] });
        });
        test('~/vscode/| should return folder completions relative to $HOME/vscode', async () => {
            assertCompletions(await terminalCompletionService.resolveResources(resourceOptions, '~/vscode/', 9, provider, capabilities), [
                { label: '~/vscode/', detail: '/home/vscode/' },
                { label: '~/vscode/foo/', detail: '/home/vscode/foo/' },
                { label: '~/vscode/bar.txt', detail: '/home/vscode/bar.txt', kind: TerminalCompletionItemKind.File },
            ], { replacementRange: [0, 9] });
        });
    });
    suite('resolveResources edge cases and advanced scenarios', () => {
        setup(() => {
            validResources = [];
            childResources = [];
        });
        if (isWindows) {
            test('C:/Foo/| absolute paths on Windows', async () => {
                const resourceOptions = {
                    cwd: URI.parse('file:///C:'),
                    showDirectories: true,
                    pathSeparator
                };
                validResources = [URI.parse('file:///C:/Foo')];
                childResources = [
                    { resource: URI.parse('file:///C:/Foo/Bar'), isDirectory: true, isFile: false },
                    { resource: URI.parse('file:///C:/Foo/Baz.txt'), isDirectory: false, isFile: true }
                ];
                const result = await terminalCompletionService.resolveResources(resourceOptions, 'C:/Foo/', 7, provider, capabilities);
                assertCompletions(result, [
                    { label: 'C:/Foo/', detail: 'C:/Foo/' },
                    { label: 'C:/Foo/Bar/', detail: 'C:/Foo/Bar/' },
                ], { replacementRange: [0, 7] });
            });
            test('c:/foo/| case insensitivity on Windows', async () => {
                const resourceOptions = {
                    cwd: URI.parse('file:///c:'),
                    showDirectories: true,
                    pathSeparator
                };
                validResources = [URI.parse('file:///c:/foo')];
                childResources = [
                    { resource: URI.parse('file:///c:/foo/Bar'), isDirectory: true, isFile: false }
                ];
                const result = await terminalCompletionService.resolveResources(resourceOptions, 'c:/foo/', 7, provider, capabilities);
                assertCompletions(result, [
                    // Note that the detail is normalizes drive letters to capital case intentionally
                    { label: 'c:/foo/', detail: 'C:/foo/' },
                    { label: 'c:/foo/Bar/', detail: 'C:/foo/Bar/' },
                ], { replacementRange: [0, 7] });
            });
        }
        else {
            test('/foo/| absolute paths NOT on Windows', async () => {
                const resourceOptions = {
                    cwd: URI.parse('file:///'),
                    showDirectories: true,
                    pathSeparator
                };
                validResources = [URI.parse('file:///foo')];
                childResources = [
                    { resource: URI.parse('file:///foo/Bar'), isDirectory: true, isFile: false },
                    { resource: URI.parse('file:///foo/Baz.txt'), isDirectory: false, isFile: true }
                ];
                const result = await terminalCompletionService.resolveResources(resourceOptions, '/foo/', 5, provider, capabilities);
                assertCompletions(result, [
                    { label: '/foo/', detail: '/foo/' },
                    { label: '/foo/Bar/', detail: '/foo/Bar/' },
                ], { replacementRange: [0, 5] });
            });
        }
        if (isWindows) {
            test('.\\folder | Case insensitivity should resolve correctly on Windows', async () => {
                const resourceOptions = {
                    cwd: URI.parse('file:///C:/test'),
                    showDirectories: true,
                    pathSeparator: '\\'
                };
                validResources = [URI.parse('file:///C:/test')];
                childResources = [
                    { resource: URI.parse('file:///C:/test/FolderA/'), isDirectory: true },
                    { resource: URI.parse('file:///C:/test/anotherFolder/'), isDirectory: true }
                ];
                const result = await terminalCompletionService.resolveResources(resourceOptions, '.\\folder', 8, provider, capabilities);
                assertCompletions(result, [
                    { label: '.\\', detail: 'C:\\test\\' },
                    { label: '.\\FolderA\\', detail: 'C:\\test\\FolderA\\' },
                    { label: '.\\anotherFolder\\', detail: 'C:\\test\\anotherFolder\\' },
                    { label: '.\\..\\', detail: 'C:\\' },
                ], { replacementRange: [0, 8] });
            });
        }
        else {
            test('./folder | Case sensitivity should resolve correctly on Mac/Unix', async () => {
                const resourceOptions = {
                    cwd: URI.parse('file:///test'),
                    showDirectories: true,
                    pathSeparator: '/'
                };
                validResources = [URI.parse('file:///test')];
                childResources = [
                    { resource: URI.parse('file:///test/FolderA/'), isDirectory: true },
                    { resource: URI.parse('file:///test/foldera/'), isDirectory: true }
                ];
                const result = await terminalCompletionService.resolveResources(resourceOptions, './folder', 8, provider, capabilities);
                assertCompletions(result, [
                    { label: './', detail: '/test/' },
                    { label: './FolderA/', detail: '/test/FolderA/' },
                    { label: './foldera/', detail: '/test/foldera/' },
                    { label: './../', detail: '/' }
                ], { replacementRange: [0, 8] });
            });
        }
        test('| Empty input should resolve to current directory', async () => {
            const resourceOptions = {
                cwd: URI.parse('file:///test'),
                showDirectories: true,
                pathSeparator
            };
            validResources = [URI.parse('file:///test')];
            childResources = [
                { resource: URI.parse('file:///test/folder1/'), isDirectory: true },
                { resource: URI.parse('file:///test/folder2/'), isDirectory: true }
            ];
            const result = await terminalCompletionService.resolveResources(resourceOptions, '', 0, provider, capabilities);
            assertCompletions(result, [
                { label: '.', detail: '/test/' },
                { label: './folder1/', detail: '/test/folder1/' },
                { label: './folder2/', detail: '/test/folder2/' },
                { label: '../', detail: '/' },
                standardTildeItem,
            ], { replacementRange: [0, 0] });
        });
        test('should ignore environment variable setting prefixes', async () => {
            const resourceOptions = {
                cwd: URI.parse('file:///test'),
                showDirectories: true,
                pathSeparator
            };
            validResources = [URI.parse('file:///test')];
            childResources = [
                { resource: URI.parse('file:///test/folder1/'), isDirectory: true },
                { resource: URI.parse('file:///test/folder2/'), isDirectory: true }
            ];
            const result = await terminalCompletionService.resolveResources(resourceOptions, 'FOO=./', 2, provider, capabilities);
            // Must not include FOO= prefix in completions
            assertCompletions(result, [
                { label: '.', detail: '/test/' },
                { label: './folder1/', detail: '/test/folder1/' },
                { label: './folder2/', detail: '/test/folder2/' },
                { label: '../', detail: '/' },
                standardTildeItem,
            ], { replacementRange: [0, 2] });
        });
        test('./| should handle large directories with many results gracefully', async () => {
            const resourceOptions = {
                cwd: URI.parse('file:///test'),
                showDirectories: true,
                pathSeparator
            };
            validResources = [URI.parse('file:///test')];
            childResources = Array.from({ length: 1000 }, (_, i) => ({
                resource: URI.parse(`file:///test/folder${i}/`),
                isDirectory: true
            }));
            const result = await terminalCompletionService.resolveResources(resourceOptions, './', 2, provider, capabilities);
            assert(result);
            // includes the 1000 folders + ./ and ./../
            assert.strictEqual(result?.length, 1002);
            assert.strictEqual(result[0].label, `.${pathSeparator}`);
            assert.strictEqual(result.at(-1)?.label, `.${pathSeparator}..${pathSeparator}`);
        });
        test('./folder| should include current folder with trailing / is missing', async () => {
            const resourceOptions = {
                cwd: URI.parse('file:///test'),
                showDirectories: true,
                pathSeparator
            };
            validResources = [URI.parse('file:///test')];
            childResources = [
                { resource: URI.parse('file:///test/folder1/'), isDirectory: true },
                { resource: URI.parse('file:///test/folder2/'), isDirectory: true }
            ];
            const result = await terminalCompletionService.resolveResources(resourceOptions, './folder1', 10, provider, capabilities);
            assertCompletions(result, [
                { label: './', detail: '/test/' },
                { label: './folder1/', detail: '/test/folder1/' },
                { label: './folder2/', detail: '/test/folder2/' },
                { label: './../', detail: '/' }
            ], { replacementRange: [1, 10] });
        });
        test('test/| should normalize current and parent folders', async () => {
            const resourceOptions = {
                cwd: URI.parse('file:///test'),
                showDirectories: true,
                pathSeparator
            };
            validResources = [
                URI.parse('file:///test'),
                URI.parse('file:///test/folder1'),
                URI.parse('file:///test/folder2')
            ];
            childResources = [
                { resource: URI.parse('file:///test/folder1/'), isDirectory: true },
                { resource: URI.parse('file:///test/folder2/'), isDirectory: true }
            ];
            const result = await terminalCompletionService.resolveResources(resourceOptions, 'test/', 5, provider, capabilities);
            assertCompletions(result, [
                { label: './test/', detail: '/test/' },
                { label: './test/folder1/', detail: '/test/folder1/' },
                { label: './test/folder2/', detail: '/test/folder2/' },
                { label: './test/../', detail: '/' }
            ], { replacementRange: [0, 5] });
        });
    });
    suite('cdpath', () => {
        let shellEnvDetection;
        setup(() => {
            validResources = [URI.parse('file:///test')];
            childResources = [
                { resource: URI.parse('file:///cdpath_value/folder1/'), isDirectory: true },
                { resource: URI.parse('file:///cdpath_value/file1.txt'), isFile: true },
            ];
            shellEnvDetection = store.add(new ShellEnvDetectionCapability());
            shellEnvDetection.setEnvironment({ CDPATH: '/cdpath_value' }, true);
            capabilities.add(5 /* TerminalCapability.ShellEnvDetection */, shellEnvDetection);
        });
        test('cd | should show paths from $CDPATH (relative)', async () => {
            configurationService.setUserConfiguration('terminal.integrated.suggest.cdPath', 'relative');
            const resourceOptions = {
                cwd: URI.parse('file:///test'),
                showDirectories: true,
                showFiles: true,
                pathSeparator
            };
            const result = await terminalCompletionService.resolveResources(resourceOptions, 'cd ', 3, provider, capabilities);
            assertPartialCompletionsExist(result, [
                { label: 'folder1', detail: 'CDPATH /cdpath_value/folder1/' },
            ], { replacementRange: [3, 3] });
        });
        test('cd | should show paths from $CDPATH (absolute)', async () => {
            configurationService.setUserConfiguration('terminal.integrated.suggest.cdPath', 'absolute');
            const resourceOptions = {
                cwd: URI.parse('file:///test'),
                showDirectories: true,
                showFiles: true,
                pathSeparator
            };
            const result = await terminalCompletionService.resolveResources(resourceOptions, 'cd ', 3, provider, capabilities);
            assertPartialCompletionsExist(result, [
                { label: '/cdpath_value/folder1/', detail: 'CDPATH' },
            ], { replacementRange: [3, 3] });
        });
        test('cd | should support pulling from multiple paths in $CDPATH', async () => {
            configurationService.setUserConfiguration('terminal.integrated.suggest.cdPath', 'relative');
            const pathPrefix = isWindows ? 'c:\\' : '/';
            const delimeter = isWindows ? ';' : ':';
            const separator = isWindows ? '\\' : '/';
            shellEnvDetection.setEnvironment({ CDPATH: `${pathPrefix}cdpath1_value${delimeter}${pathPrefix}cdpath2_value${separator}inner_dir` }, true);
            const uriPathPrefix = isWindows ? 'file:///c:/' : 'file:///';
            validResources = [
                URI.parse(`${uriPathPrefix}test`),
                URI.parse(`${uriPathPrefix}cdpath1_value`),
                URI.parse(`${uriPathPrefix}cdpath2_value`),
                URI.parse(`${uriPathPrefix}cdpath2_value/inner_dir`)
            ];
            childResources = [
                { resource: URI.parse(`${uriPathPrefix}cdpath1_value/folder1/`), isDirectory: true },
                { resource: URI.parse(`${uriPathPrefix}cdpath1_value/folder2/`), isDirectory: true },
                { resource: URI.parse(`${uriPathPrefix}cdpath1_value/file1.txt`), isFile: true },
                { resource: URI.parse(`${uriPathPrefix}cdpath2_value/inner_dir/folder1/`), isDirectory: true },
                { resource: URI.parse(`${uriPathPrefix}cdpath2_value/inner_dir/folder2/`), isDirectory: true },
                { resource: URI.parse(`${uriPathPrefix}cdpath2_value/inner_dir/file1.txt`), isFile: true },
            ];
            const resourceOptions = {
                cwd: URI.parse(`${uriPathPrefix}test`),
                showDirectories: true,
                showFiles: true,
                pathSeparator
            };
            const result = await terminalCompletionService.resolveResources(resourceOptions, 'cd ', 3, provider, capabilities);
            const finalPrefix = isWindows ? 'C:\\' : '/';
            assertPartialCompletionsExist(result, [
                { label: 'folder1', detail: `CDPATH ${finalPrefix}cdpath1_value/folder1/` },
                { label: 'folder2', detail: `CDPATH ${finalPrefix}cdpath1_value/folder2/` },
                { label: 'folder1', detail: `CDPATH ${finalPrefix}cdpath2_value/inner_dir/folder1/` },
                { label: 'folder2', detail: `CDPATH ${finalPrefix}cdpath2_value/inner_dir/folder2/` },
            ], { replacementRange: [3, 3] });
        });
    });
    if (isWindows) {
        suite('gitbash', () => {
            test('should convert Git Bash absolute path to Windows absolute path', () => {
                assert.strictEqual(gitBashToWindowsPath('/'), 'C:\\');
                assert.strictEqual(gitBashToWindowsPath('/c/'), 'C:\\');
                assert.strictEqual(gitBashToWindowsPath('/c/Users/foo'), 'C:\\Users\\foo');
                assert.strictEqual(gitBashToWindowsPath('/d/bar'), 'D:\\bar');
            });
            test('should convert Windows absolute path to Git Bash absolute path', () => {
                assert.strictEqual(windowsToGitBashPath('C:\\'), '/c/');
                assert.strictEqual(windowsToGitBashPath('C:\\Users\\foo'), '/c/Users/foo');
                assert.strictEqual(windowsToGitBashPath('D:\\bar'), '/d/bar');
                assert.strictEqual(windowsToGitBashPath('E:\\some\\path'), '/e/some/path');
            });
            test('resolveResources with c:/ style absolute path for Git Bash', async () => {
                const resourceOptions = {
                    cwd: URI.file('C:\\Users\\foo'),
                    showDirectories: true,
                    showFiles: true,
                    pathSeparator: '/'
                };
                validResources = [
                    URI.file('C:\\Users\\foo'),
                    URI.file('C:\\Users\\foo\\bar'),
                    URI.file('C:\\Users\\foo\\baz.txt')
                ];
                childResources = [
                    { resource: URI.file('C:\\Users\\foo\\bar'), isDirectory: true, isFile: false },
                    { resource: URI.file('C:\\Users\\foo\\baz.txt'), isFile: true }
                ];
                const result = await terminalCompletionService.resolveResources(resourceOptions, 'C:/Users/foo/', 13, provider, capabilities, "gitbash" /* WindowsShellType.GitBash */);
                assertCompletions(result, [
                    { label: 'C:/Users/foo/', detail: 'C:\\Users\\foo\\' },
                    { label: 'C:/Users/foo/bar/', detail: 'C:\\Users\\foo\\bar\\' },
                    { label: 'C:/Users/foo/baz.txt', detail: 'C:\\Users\\foo\\baz.txt', kind: TerminalCompletionItemKind.File },
                ], { replacementRange: [0, 13] }, '/');
            });
            test('resolveResources with cwd as Windows path (relative)', async () => {
                const resourceOptions = {
                    cwd: URI.file('C:\\Users\\foo'),
                    showDirectories: true,
                    showFiles: true,
                    pathSeparator: '/'
                };
                validResources = [
                    URI.file('C:\\Users\\foo'),
                    URI.file('C:\\Users\\foo\\bar'),
                    URI.file('C:\\Users\\foo\\baz.txt')
                ];
                childResources = [
                    { resource: URI.file('C:\\Users\\foo\\bar'), isDirectory: true },
                    { resource: URI.file('C:\\Users\\foo\\baz.txt'), isFile: true }
                ];
                const result = await terminalCompletionService.resolveResources(resourceOptions, './', 2, provider, capabilities, "gitbash" /* WindowsShellType.GitBash */);
                assertCompletions(result, [
                    { label: './', detail: 'C:\\Users\\foo\\' },
                    { label: './bar/', detail: 'C:\\Users\\foo\\bar\\' },
                    { label: './baz.txt', detail: 'C:\\Users\\foo\\baz.txt', kind: TerminalCompletionItemKind.File },
                    { label: './../', detail: 'C:\\Users\\' }
                ], { replacementRange: [0, 2] }, '/');
            });
            test('resolveResources with cwd as Windows path (absolute)', async () => {
                const resourceOptions = {
                    cwd: URI.file('C:\\Users\\foo'),
                    showDirectories: true,
                    showFiles: true,
                    pathSeparator: '/'
                };
                validResources = [
                    URI.file('C:\\Users\\foo'),
                    URI.file('C:\\Users\\foo\\bar'),
                    URI.file('C:\\Users\\foo\\baz.txt')
                ];
                childResources = [
                    { resource: URI.file('C:\\Users\\foo\\bar'), isDirectory: true },
                    { resource: URI.file('C:\\Users\\foo\\baz.txt'), isFile: true }
                ];
                const result = await terminalCompletionService.resolveResources(resourceOptions, '/c/Users/foo/', 13, provider, capabilities, "gitbash" /* WindowsShellType.GitBash */);
                assertCompletions(result, [
                    { label: '/c/Users/foo/', detail: 'C:\\Users\\foo\\' },
                    { label: '/c/Users/foo/bar/', detail: 'C:\\Users\\foo\\bar\\' },
                    { label: '/c/Users/foo/baz.txt', detail: 'C:\\Users\\foo\\baz.txt', kind: TerminalCompletionItemKind.File },
                ], { replacementRange: [0, 13] }, '/');
            });
        });
    }
    if (!isWindows) {
        suite('symlink support', () => {
            test('should include symlink target information in completions', async () => {
                const resourceOptions = {
                    cwd: URI.parse('file:///test'),
                    pathSeparator,
                    showFiles: true,
                    showDirectories: true
                };
                validResources = [URI.parse('file:///test')];
                // Create mock children including a symbolic link
                childResources = [
                    { resource: URI.parse('file:///test/regular-file.txt'), isFile: true },
                    { resource: URI.parse('file:///test/symlink-file'), isFile: true, isSymbolicLink: true },
                    { resource: URI.parse('file:///test/symlink-folder'), isDirectory: true, isSymbolicLink: true },
                    { resource: URI.parse('file:///test/regular-folder'), isDirectory: true },
                ];
                const result = await terminalCompletionService.resolveResources(resourceOptions, 'ls ', 3, provider, capabilities);
                // Find the symlink completion
                const symlinkFileCompletion = result?.find(c => c.label === './symlink-file');
                const symlinkFolderCompletion = result?.find(c => c.label === './symlink-folder/');
                assert.strictEqual(symlinkFileCompletion?.detail, '/test/symlink-file -> /target/actual-file.txt', 'Symlink file detail should match target');
                assert.strictEqual(symlinkFolderCompletion?.detail, '/test/symlink-folder -> /target/actual-folder', 'Symlink folder detail should match target');
            });
        });
    }
    suite('completion label escaping', () => {
        test('| should escape special characters in file/folder names for POSIX shells', async () => {
            const resourceOptions = {
                cwd: URI.parse('file:///test'),
                showDirectories: true,
                showFiles: true,
                pathSeparator
            };
            validResources = [URI.parse('file:///test')];
            childResources = [
                { resource: URI.parse('file:///test/[folder1]/'), isDirectory: true },
                { resource: URI.parse('file:///test/folder 2/'), isDirectory: true },
                { resource: URI.parse('file:///test/!special$chars&/'), isDirectory: true },
                { resource: URI.parse('file:///test/!special$chars2&'), isFile: true }
            ];
            const result = await terminalCompletionService.resolveResources(resourceOptions, '', 0, provider, capabilities);
            assertCompletions(result, [
                { label: '.', detail: '/test/' },
                { label: './[folder1]/', detail: '/test/\[folder1]\/' },
                { label: './folder\ 2/', detail: '/test/folder\ 2/' },
                { label: './\!special\$chars\&/', detail: '/test/\!special\$chars\&/' },
                { label: './\!special\$chars2\&', detail: '/test/\!special\$chars2\&', kind: TerminalCompletionItemKind.File },
                { label: '../', detail: '/' },
                standardTildeItem,
            ], { replacementRange: [0, 0] });
        });
    });
    suite('Provider Configuration', () => {
        // Test class that extends TerminalCompletionService to access protected methods
        class TestTerminalCompletionService extends TerminalCompletionService {
            getEnabledProviders(providers) {
                return super._getEnabledProviders(providers);
            }
        }
        let testTerminalCompletionService;
        setup(() => {
            testTerminalCompletionService = store.add(instantiationService.createInstance(TestTerminalCompletionService));
        });
        // Mock provider for testing
        function createMockProvider(id) {
            return {
                id,
                provideCompletions: async () => [{
                        label: `completion-from-${id}`,
                        kind: TerminalCompletionItemKind.Method,
                        replacementRange: [0, 0],
                        provider: id
                    }]
            };
        }
        test('should enable providers by default when no configuration exists', () => {
            const defaultProvider = createMockProvider('terminal-suggest');
            const newProvider = createMockProvider('new-extension-provider');
            const providers = [defaultProvider, newProvider];
            // Set empty configuration (no provider keys)
            configurationService.setUserConfiguration("terminal.integrated.suggest.providers" /* TerminalSuggestSettingId.Providers */, {});
            const result = testTerminalCompletionService.getEnabledProviders(providers);
            // Both providers should be enabled since they're not explicitly disabled
            assert.strictEqual(result.length, 2, 'Should enable both providers by default');
            assert.ok(result.includes(defaultProvider), 'Should include default provider');
            assert.ok(result.includes(newProvider), 'Should include new provider');
        });
        test('should disable providers when explicitly set to false', () => {
            const provider1 = createMockProvider('provider1');
            const provider2 = createMockProvider('provider2');
            const providers = [provider1, provider2];
            // Disable provider1, leave provider2 unconfigured
            configurationService.setUserConfiguration("terminal.integrated.suggest.providers" /* TerminalSuggestSettingId.Providers */, {
                'provider1': false
            });
            const result = testTerminalCompletionService.getEnabledProviders(providers);
            // Only provider2 should be enabled
            assert.strictEqual(result.length, 1, 'Should enable only one provider');
            assert.ok(result.includes(provider2), 'Should include unconfigured provider');
            assert.ok(!result.includes(provider1), 'Should not include disabled provider');
        });
        test('should enable providers when explicitly set to true', () => {
            const provider1 = createMockProvider('provider1');
            const provider2 = createMockProvider('provider2');
            const providers = [provider1, provider2];
            // Explicitly enable provider1, leave provider2 unconfigured
            configurationService.setUserConfiguration("terminal.integrated.suggest.providers" /* TerminalSuggestSettingId.Providers */, {
                'provider1': true
            });
            const result = testTerminalCompletionService.getEnabledProviders(providers);
            // Both providers should be enabled
            assert.strictEqual(result.length, 2, 'Should enable both providers');
            assert.ok(result.includes(provider1), 'Should include explicitly enabled provider');
            assert.ok(result.includes(provider2), 'Should include unconfigured provider');
        });
        test('should handle mixed configuration correctly', () => {
            const provider1 = createMockProvider('provider1');
            const provider2 = createMockProvider('provider2');
            const provider3 = createMockProvider('provider3');
            const providers = [provider1, provider2, provider3];
            // Mixed configuration: enable provider1, disable provider2, leave provider3 unconfigured
            configurationService.setUserConfiguration("terminal.integrated.suggest.providers" /* TerminalSuggestSettingId.Providers */, {
                'provider1': true,
                'provider2': false
            });
            const result = testTerminalCompletionService.getEnabledProviders(providers);
            // provider1 and provider3 should be enabled, provider2 should be disabled
            assert.strictEqual(result.length, 2, 'Should enable two providers');
            assert.ok(result.includes(provider1), 'Should include explicitly enabled provider');
            assert.ok(result.includes(provider3), 'Should include unconfigured provider');
            assert.ok(!result.includes(provider2), 'Should not include disabled provider');
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDb21wbGV0aW9uU2VydmljZS50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9zdWdnZXN0L3Rlc3QvYnJvd3Nlci90ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxZQUFZLEVBQXNELE1BQU0sa0RBQWtELENBQUM7QUFDcEksT0FBTyxFQUFFLHlCQUF5QixFQUF1RSxNQUFNLDRDQUE0QyxDQUFDO0FBQzVKLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RHLE9BQU8sTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ3RDLE9BQU8sRUFBRSxTQUFTLEVBQTRCLE1BQU0sMkNBQTJDLENBQUM7QUFFaEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3JGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGtGQUFrRixDQUFDO0FBQzVILE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3pHLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLG9GQUFvRixDQUFDO0FBQzdILE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLHdGQUF3RixDQUFDO0FBRXJJLE9BQU8sRUFBdUIsMEJBQTBCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMxRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDakUsT0FBTyxFQUFFLG1CQUFtQixFQUFvQixNQUFNLHdEQUF3RCxDQUFDO0FBQy9HLE9BQU8sRUFBRSxvQkFBb0Is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