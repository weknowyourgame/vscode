/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { deepStrictEqual } from 'assert';
import { Schemas } from '../../../../../../base/common/network.js';
import { URI } from '../../../../../../base/common/uri.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { FileService } from '../../../../../../platform/files/common/fileService.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../../../../platform/log/common/log.js';
import { IQuickInputService } from '../../../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService } from '../../../../../../platform/workspace/common/workspace.js';
import { CommandDetectionCapability } from '../../../../../../platform/terminal/common/capabilities/commandDetectionCapability.js';
import { TerminalLocalFileLinkOpener, TerminalLocalFolderInWorkspaceLinkOpener, TerminalSearchLinkOpener } from '../../browser/terminalLinkOpeners.js';
import { TerminalCapabilityStore } from '../../../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js';
import { IEditorService } from '../../../../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../../../../services/environment/common/environmentService.js';
import { TestContextService } from '../../../../../test/common/workbenchTestServices.js';
import { ISearchService } from '../../../../../services/search/common/search.js';
import { SearchService } from '../../../../../services/search/common/searchService.js';
import { ITerminalLogService } from '../../../../../../platform/terminal/common/terminal.js';
import { importAMDNodeModule } from '../../../../../../amdX.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { TerminalCommand } from '../../../../../../platform/terminal/common/capabilities/commandDetection/terminalCommand.js';
import { generateUuid } from '../../../../../../base/common/uuid.js';
class TestCommandDetectionCapability extends CommandDetectionCapability {
    setCommands(commands) {
        this._commands = commands;
    }
}
class TestFileService extends FileService {
    constructor() {
        super(...arguments);
        this._files = '*';
    }
    async stat(resource) {
        if (this._files === '*' || this._files.some(e => e.toString() === resource.toString())) {
            return { isFile: true, isDirectory: false, isSymbolicLink: false };
        }
        throw new Error('ENOENT');
    }
    setFiles(files) {
        this._files = files;
    }
}
class TestSearchService extends SearchService {
    async fileSearch(query) {
        return this._searchResult;
    }
    setSearchResult(result) {
        this._searchResult = result;
    }
}
class TestTerminalSearchLinkOpener extends TerminalSearchLinkOpener {
    setFileQueryBuilder(value) {
        this._fileQueryBuilder = value;
    }
}
suite('Workbench - TerminalLinkOpeners', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let fileService;
    let searchService;
    let activationResult;
    let xterm;
    setup(async () => {
        instantiationService = store.add(new TestInstantiationService());
        fileService = store.add(new TestFileService(new NullLogService()));
        searchService = store.add(new TestSearchService(null, null, null, null, null, null, null));
        instantiationService.set(IFileService, fileService);
        instantiationService.set(ILogService, new NullLogService());
        instantiationService.set(ISearchService, searchService);
        instantiationService.set(IWorkspaceContextService, new TestContextService());
        instantiationService.stub(ITerminalLogService, new NullLogService());
        instantiationService.stub(IWorkbenchEnvironmentService, {
            remoteAuthority: undefined
        });
        // Allow intercepting link activations
        activationResult = undefined;
        instantiationService.stub(IQuickInputService, {
            quickAccess: {
                show(link) {
                    activationResult = { link, source: 'search' };
                }
            }
        });
        instantiationService.stub(IEditorService, {
            async openEditor(editor) {
                activationResult = {
                    source: 'editor',
                    link: editor.resource?.toString()
                };
                // Only assert on selection if it's not the default value
                if (editor.options?.selection && (editor.options.selection.startColumn !== 1 || editor.options.selection.startLineNumber !== 1)) {
                    activationResult.selection = editor.options.selection;
                }
            }
        });
        const TerminalCtor = (await importAMDNodeModule('@xterm/xterm', 'lib/xterm.js')).Terminal;
        xterm = store.add(new TerminalCtor({ allowProposedApi: true }));
    });
    suite('TerminalSearchLinkOpener', () => {
        let opener;
        let capabilities;
        let commandDetection;
        let localFileOpener;
        setup(() => {
            capabilities = store.add(new TerminalCapabilityStore());
            commandDetection = store.add(instantiationService.createInstance(TestCommandDetectionCapability, xterm));
            capabilities.add(2 /* TerminalCapability.CommandDetection */, commandDetection);
        });
        test('should open single exact match against cwd when searching if it exists when command detection cwd is available', async () => {
            localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
            const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
            opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, '/initial/cwd', localFileOpener, localFolderOpener, () => 3 /* OperatingSystem.Linux */);
            // Set a fake detected command starting as line 0 to establish the cwd
            commandDetection.setCommands([new TerminalCommand(xterm, {
                    command: '',
                    commandLineConfidence: 'low',
                    exitCode: 0,
                    commandStartLineContent: '',
                    markProperties: {},
                    isTrusted: true,
                    cwd: '/initial/cwd',
                    timestamp: 0,
                    duration: 0,
                    executedX: undefined,
                    startX: undefined,
                    // eslint-disable-next-line local/code-no-any-casts
                    marker: {
                        line: 0
                    },
                    id: generateUuid()
                })]);
            fileService.setFiles([
                URI.from({ scheme: Schemas.file, path: '/initial/cwd/foo/bar.txt' }),
                URI.from({ scheme: Schemas.file, path: '/initial/cwd/foo2/bar.txt' })
            ]);
            await opener.open({
                text: 'foo/bar.txt',
                bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                type: "Search" /* TerminalBuiltinLinkType.Search */
            });
            deepStrictEqual(activationResult, {
                link: 'file:///initial/cwd/foo/bar.txt',
                source: 'editor'
            });
        });
        test('should open single exact match against cwd for paths containing a separator when searching if it exists, even when command detection isn\'t available', async () => {
            localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
            const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
            opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, '/initial/cwd', localFileOpener, localFolderOpener, () => 3 /* OperatingSystem.Linux */);
            fileService.setFiles([
                URI.from({ scheme: Schemas.file, path: '/initial/cwd/foo/bar.txt' }),
                URI.from({ scheme: Schemas.file, path: '/initial/cwd/foo2/bar.txt' })
            ]);
            await opener.open({
                text: 'foo/bar.txt',
                bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                type: "Search" /* TerminalBuiltinLinkType.Search */
            });
            deepStrictEqual(activationResult, {
                link: 'file:///initial/cwd/foo/bar.txt',
                source: 'editor'
            });
        });
        test('should open single exact match against any folder for paths not containing a separator when there is a single search result, even when command detection isn\'t available', async () => {
            localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
            const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
            opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, '/initial/cwd', localFileOpener, localFolderOpener, () => 3 /* OperatingSystem.Linux */);
            capabilities.remove(2 /* TerminalCapability.CommandDetection */);
            opener.setFileQueryBuilder({ file: () => null });
            fileService.setFiles([
                URI.from({ scheme: Schemas.file, path: '/initial/cwd/foo/bar.txt' }),
                URI.from({ scheme: Schemas.file, path: '/initial/cwd/foo2/baz.txt' })
            ]);
            searchService.setSearchResult({
                messages: [],
                results: [
                    { resource: URI.from({ scheme: Schemas.file, path: '/initial/cwd/foo/bar.txt' }) }
                ]
            });
            await opener.open({
                text: 'bar.txt',
                bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                type: "Search" /* TerminalBuiltinLinkType.Search */
            });
            deepStrictEqual(activationResult, {
                link: 'file:///initial/cwd/foo/bar.txt',
                source: 'editor'
            });
        });
        test('should open single exact match against any folder for paths not containing a separator when there are multiple search results, even when command detection isn\'t available', async () => {
            localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
            const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
            opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, '/initial/cwd', localFileOpener, localFolderOpener, () => 3 /* OperatingSystem.Linux */);
            capabilities.remove(2 /* TerminalCapability.CommandDetection */);
            opener.setFileQueryBuilder({ file: () => null });
            fileService.setFiles([
                URI.from({ scheme: Schemas.file, path: '/initial/cwd/foo/bar.txt' }),
                URI.from({ scheme: Schemas.file, path: '/initial/cwd/foo/bar.test.txt' }),
                URI.from({ scheme: Schemas.file, path: '/initial/cwd/foo2/bar.test.txt' })
            ]);
            searchService.setSearchResult({
                messages: [],
                results: [
                    { resource: URI.from({ scheme: Schemas.file, path: '/initial/cwd/foo/bar.txt' }) },
                    { resource: URI.from({ scheme: Schemas.file, path: '/initial/cwd/foo/bar.test.txt' }) },
                    { resource: URI.from({ scheme: Schemas.file, path: '/initial/cwd/foo2/bar.test.txt' }) }
                ]
            });
            await opener.open({
                text: 'bar.txt',
                bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                type: "Search" /* TerminalBuiltinLinkType.Search */
            });
            deepStrictEqual(activationResult, {
                link: 'file:///initial/cwd/foo/bar.txt',
                source: 'editor'
            });
        });
        test('should not open single exact match for paths not containing a when command detection isn\'t available', async () => {
            localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
            const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
            opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, '/initial/cwd', localFileOpener, localFolderOpener, () => 3 /* OperatingSystem.Linux */);
            fileService.setFiles([
                URI.from({ scheme: Schemas.file, path: '/initial/cwd/foo/bar.txt' }),
                URI.from({ scheme: Schemas.file, path: '/initial/cwd/foo2/bar.txt' })
            ]);
            await opener.open({
                text: 'bar.txt',
                bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                type: "Search" /* TerminalBuiltinLinkType.Search */
            });
            deepStrictEqual(activationResult, {
                link: 'bar.txt',
                source: 'search'
            });
        });
        suite('macOS/Linux', () => {
            setup(() => {
                localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
                const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
                opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, '', localFileOpener, localFolderOpener, () => 3 /* OperatingSystem.Linux */);
            });
            test('should apply the cwd to the link only when the file exists and cwdDetection is enabled', async () => {
                const cwd = '/Users/home/folder';
                const absoluteFile = '/Users/home/folder/file.txt';
                fileService.setFiles([
                    URI.from({ scheme: Schemas.file, path: absoluteFile }),
                    URI.from({ scheme: Schemas.file, path: '/Users/home/folder/other/file.txt' })
                ]);
                // Set a fake detected command starting as line 0 to establish the cwd
                commandDetection.setCommands([new TerminalCommand(xterm, {
                        command: '',
                        commandLineConfidence: 'low',
                        isTrusted: true,
                        cwd,
                        timestamp: 0,
                        duration: 0,
                        executedX: undefined,
                        startX: undefined,
                        // eslint-disable-next-line local/code-no-any-casts
                        marker: {
                            line: 0
                        },
                        exitCode: 0,
                        commandStartLineContent: '',
                        markProperties: {},
                        id: generateUuid()
                    })]);
                await opener.open({
                    text: 'file.txt',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///Users/home/folder/file.txt',
                    source: 'editor'
                });
                // Clear detected commands and ensure the same request results in a search since there are 2 matches
                commandDetection.setCommands([]);
                opener.setFileQueryBuilder({ file: () => null });
                searchService.setSearchResult({
                    messages: [],
                    results: [
                        { resource: URI.from({ scheme: Schemas.file, path: 'file:///Users/home/folder/file.txt' }) },
                        { resource: URI.from({ scheme: Schemas.file, path: 'file:///Users/home/folder/other/file.txt' }) }
                    ]
                });
                await opener.open({
                    text: 'file.txt',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file.txt',
                    source: 'search'
                });
            });
            test('should extract column and/or line numbers from links in a workspace containing spaces', async () => {
                localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
                const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
                opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, '/space folder', localFileOpener, localFolderOpener, () => 3 /* OperatingSystem.Linux */);
                fileService.setFiles([
                    URI.from({ scheme: Schemas.file, path: '/space folder/foo/bar.txt' })
                ]);
                await opener.open({
                    text: './foo/bar.txt:10:5',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///space%20folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 5,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: './foo/bar.txt:10',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///space%20folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 1,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
            });
            test('should extract column and/or line numbers from links and remove trailing periods', async () => {
                localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
                const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
                opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, '/folder', localFileOpener, localFolderOpener, () => 3 /* OperatingSystem.Linux */);
                fileService.setFiles([
                    URI.from({ scheme: Schemas.file, path: '/folder/foo/bar.txt' })
                ]);
                await opener.open({
                    text: './foo/bar.txt.',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///folder/foo/bar.txt',
                    source: 'editor',
                });
                await opener.open({
                    text: './foo/bar.txt:10:5.',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 5,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: './foo/bar.txt:10.',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 1,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
            });
            test('should extract column and/or line numbers from links and remove grepped lines', async () => {
                localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
                const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
                opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, '/folder', localFileOpener, localFolderOpener, () => 3 /* OperatingSystem.Linux */);
                fileService.setFiles([
                    URI.from({ scheme: Schemas.file, path: '/folder/foo/bar.txt' })
                ]);
                await opener.open({
                    text: './foo/bar.txt:10:5:import { ILoveVSCode } from \'./foo/bar.ts\';',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 5,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: './foo/bar.txt:10:import { ILoveVSCode } from \'./foo/bar.ts\';',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 1,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
            });
            // Test for https://github.com/microsoft/vscode/pull/200919#discussion_r1428124196
            test('should extract column and/or line numbers from links and remove grepped lines incl singular spaces', async () => {
                localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
                const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
                opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, '/folder', localFileOpener, localFolderOpener, () => 3 /* OperatingSystem.Linux */);
                fileService.setFiles([
                    URI.from({ scheme: Schemas.file, path: '/folder/foo/bar.txt' })
                ]);
                await opener.open({
                    text: './foo/bar.txt:10:5: ',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 5,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: './foo/bar.txt:10: ',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 1,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
            });
            test('should extract line numbers from links and remove ruby stack traces', async () => {
                localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
                const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
                opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, '/folder', localFileOpener, localFolderOpener, () => 3 /* OperatingSystem.Linux */);
                fileService.setFiles([
                    URI.from({ scheme: Schemas.file, path: '/folder/foo/bar.rb' })
                ]);
                await opener.open({
                    text: './foo/bar.rb:30:in `<main>`',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///folder/foo/bar.rb',
                    source: 'editor',
                    selection: {
                        startColumn: 1,
                        startLineNumber: 30,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
            });
        });
        suite('Windows', () => {
            setup(() => {
                localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
                const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
                opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, '', localFileOpener, localFolderOpener, () => 1 /* OperatingSystem.Windows */);
            });
            test('should apply the cwd to the link only when the file exists and cwdDetection is enabled', async () => {
                localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
                const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
                opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, 'c:\\Users', localFileOpener, localFolderOpener, () => 1 /* OperatingSystem.Windows */);
                const cwd = 'c:\\Users\\home\\folder';
                const absoluteFile = 'c:\\Users\\home\\folder\\file.txt';
                fileService.setFiles([
                    URI.file('/c:/Users/home/folder/file.txt')
                ]);
                // Set a fake detected command starting as line 0 to establish the cwd
                commandDetection.setCommands([new TerminalCommand(xterm, {
                        exitCode: 0,
                        commandStartLineContent: '',
                        markProperties: {},
                        command: '',
                        commandLineConfidence: 'low',
                        isTrusted: true,
                        cwd,
                        executedX: undefined,
                        startX: undefined,
                        timestamp: 0,
                        duration: 0,
                        // eslint-disable-next-line local/code-no-any-casts
                        marker: {
                            line: 0
                        },
                        id: generateUuid()
                    })]);
                await opener.open({
                    text: 'file.txt',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/Users/home/folder/file.txt',
                    source: 'editor'
                });
                // Clear detected commands and ensure the same request results in a search
                commandDetection.setCommands([]);
                opener.setFileQueryBuilder({ file: () => null });
                searchService.setSearchResult({
                    messages: [],
                    results: [
                        { resource: URI.file(absoluteFile) },
                        { resource: URI.file('/c:/Users/home/folder/other/file.txt') }
                    ]
                });
                await opener.open({
                    text: 'file.txt',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file.txt',
                    source: 'search'
                });
            });
            test('should extract column and/or line numbers from links in a workspace containing spaces', async () => {
                localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
                const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
                opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, 'c:/space folder', localFileOpener, localFolderOpener, () => 1 /* OperatingSystem.Windows */);
                fileService.setFiles([
                    URI.from({ scheme: Schemas.file, path: 'c:/space folder/foo/bar.txt' })
                ]);
                await opener.open({
                    text: './foo/bar.txt:10:5',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/space%20folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 5,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: './foo/bar.txt:10',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/space%20folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 1,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: '.\\foo\\bar.txt:10:5',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/space%20folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 5,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: '.\\foo\\bar.txt:10',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/space%20folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 1,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
            });
            test('should extract column and/or line numbers from links and remove trailing periods', async () => {
                localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
                const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
                opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, 'c:/folder', localFileOpener, localFolderOpener, () => 1 /* OperatingSystem.Windows */);
                fileService.setFiles([
                    URI.from({ scheme: Schemas.file, path: 'c:/folder/foo/bar.txt' })
                ]);
                await opener.open({
                    text: './foo/bar.txt.',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.txt',
                    source: 'editor',
                });
                await opener.open({
                    text: './foo/bar.txt:10:5.',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 5,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: './foo/bar.txt:10.',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 1,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: '.\\foo\\bar.txt.',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.txt',
                    source: 'editor',
                });
                await opener.open({
                    text: '.\\foo\\bar.txt:2:5.',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 5,
                        startLineNumber: 2,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: '.\\foo\\bar.txt:2.',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 1,
                        startLineNumber: 2,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
            });
            test('should extract column and/or line numbers from links and remove grepped lines', async () => {
                localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
                const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
                opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, 'c:/folder', localFileOpener, localFolderOpener, () => 1 /* OperatingSystem.Windows */);
                fileService.setFiles([
                    URI.from({ scheme: Schemas.file, path: 'c:/folder/foo/bar.txt' })
                ]);
                await opener.open({
                    text: './foo/bar.txt:10:5:import { ILoveVSCode } from \'./foo/bar.ts\';',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 5,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: './foo/bar.txt:10:import { ILoveVSCode } from \'./foo/bar.ts\';',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 1,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: '.\\foo\\bar.txt:10:5:import { ILoveVSCode } from \'./foo/bar.ts\';',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 5,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: '.\\foo\\bar.txt:10:import { ILoveVSCode } from \'./foo/bar.ts\';',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 1,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
            });
            // Test for https://github.com/microsoft/vscode/pull/200919#discussion_r1428124196
            test('should extract column and/or line numbers from links and remove grepped lines incl singular spaces', async () => {
                localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
                const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
                opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, 'c:/folder', localFileOpener, localFolderOpener, () => 1 /* OperatingSystem.Windows */);
                fileService.setFiles([
                    URI.from({ scheme: Schemas.file, path: 'c:/folder/foo/bar.txt' })
                ]);
                await opener.open({
                    text: './foo/bar.txt:10:5: ',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 5,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: './foo/bar.txt:10: ',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 1,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: '.\\foo\\bar.txt:10:5: ',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 5,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: '.\\foo\\bar.txt:10: ',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.txt',
                    source: 'editor',
                    selection: {
                        startColumn: 1,
                        startLineNumber: 10,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
            });
            test('should extract line numbers from links and remove ruby stack traces', async () => {
                localFileOpener = instantiationService.createInstance(TerminalLocalFileLinkOpener);
                const localFolderOpener = instantiationService.createInstance(TerminalLocalFolderInWorkspaceLinkOpener);
                opener = instantiationService.createInstance(TestTerminalSearchLinkOpener, capabilities, 'c:/folder', localFileOpener, localFolderOpener, () => 1 /* OperatingSystem.Windows */);
                fileService.setFiles([
                    URI.from({ scheme: Schemas.file, path: 'c:/folder/foo/bar.rb' })
                ]);
                await opener.open({
                    text: './foo/bar.rb:30:in `<main>`',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.rb',
                    source: 'editor',
                    selection: {
                        startColumn: 1, // Since Ruby doesn't appear to put columns in stack traces, this should be 1
                        startLineNumber: 30,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
                await opener.open({
                    text: '.\\foo\\bar.rb:30:in `<main>`',
                    bufferRange: { start: { x: 1, y: 1 }, end: { x: 8, y: 1 } },
                    type: "Search" /* TerminalBuiltinLinkType.Search */
                });
                deepStrictEqual(activationResult, {
                    link: 'file:///c%3A/folder/foo/bar.rb',
                    source: 'editor',
                    selection: {
                        startColumn: 1, // Since Ruby doesn't appear to put columns in stack traces, this should be 1
                        startLineNumber: 30,
                        endColumn: undefined,
                        endLineNumber: undefined
                    },
                });
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxMaW5rT3BlbmVycy50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9saW5rcy90ZXN0L2Jyb3dzZXIvdGVybWluYWxMaW5rT3BlbmVycy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDekMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRW5FLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUUzRCxPQUFPLEVBQUUsWUFBWSxFQUFnQyxNQUFNLGtEQUFrRCxDQUFDO0FBQzlHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUNyRixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxrRkFBa0YsQ0FBQztBQUM1SCxPQUFPLEVBQUUsV0FBVyxFQUFFLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzNGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQ3BHLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLHVGQUF1RixDQUFDO0FBRW5JLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSx3Q0FBd0MsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRXZKLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLG9GQUFvRixDQUFDO0FBQzdILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUN4RixPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUNoSCxPQUFPLEVBQUUsa0JB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