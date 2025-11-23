/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { mapArrayOrNot } from '../../../../base/common/arrays.js';
import { timeout } from '../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { revive } from '../../../../base/common/marshalling.js';
import { joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../platform/log/common/log.js';
import { MainContext } from '../../common/extHost.protocol.js';
import { Range } from '../../common/extHostTypes.js';
import { URITransformerService } from '../../common/extHostUriTransformerService.js';
import { NativeExtHostSearch } from '../../node/extHostSearch.js';
import { TestRPCProtocol } from '../common/testRPCProtocol.js';
import { resultIsMatch } from '../../../services/search/common/search.js';
import { NativeTextSearchManager } from '../../../services/search/node/textSearchManager.js';
let rpcProtocol;
let extHostSearch;
let mockMainThreadSearch;
class MockMainThreadSearch {
    constructor() {
        this.results = [];
        this.keywords = [];
    }
    $registerFileSearchProvider(handle, scheme) {
        this.lastHandle = handle;
    }
    $registerTextSearchProvider(handle, scheme) {
        this.lastHandle = handle;
    }
    $registerAITextSearchProvider(handle, scheme) {
        this.lastHandle = handle;
    }
    $unregisterProvider(handle) {
    }
    $handleFileMatch(handle, session, data) {
        this.results.push(...data);
    }
    $handleTextMatch(handle, session, data) {
        this.results.push(...data);
    }
    $handleKeywordResult(handle, session, data) {
        this.keywords.push(data);
    }
    $handleTelemetry(eventName, data) {
    }
    dispose() {
    }
}
let mockPFS;
function extensionResultIsMatch(data) {
    return !!data.preview;
}
suite('ExtHostSearch', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    async function registerTestTextSearchProvider(provider, scheme = 'file') {
        disposables.add(extHostSearch.registerTextSearchProviderOld(scheme, provider));
        await rpcProtocol.sync();
    }
    async function registerTestFileSearchProvider(provider, scheme = 'file') {
        disposables.add(extHostSearch.registerFileSearchProviderOld(scheme, provider));
        await rpcProtocol.sync();
    }
    async function runFileSearch(query, cancel = false) {
        let stats;
        try {
            const cancellation = new CancellationTokenSource();
            const p = extHostSearch.$provideFileSearchResults(mockMainThreadSearch.lastHandle, 0, query, cancellation.token);
            if (cancel) {
                await timeout(0);
                cancellation.cancel();
            }
            stats = await p;
        }
        catch (err) {
            if (!isCancellationError(err)) {
                await rpcProtocol.sync();
                throw err;
            }
        }
        await rpcProtocol.sync();
        return {
            results: mockMainThreadSearch.results.map(r => URI.revive(r)),
            stats: stats
        };
    }
    async function runTextSearch(query) {
        let stats;
        try {
            const cancellation = new CancellationTokenSource();
            const p = extHostSearch.$provideTextSearchResults(mockMainThreadSearch.lastHandle, 0, query, cancellation.token);
            stats = await p;
        }
        catch (err) {
            if (!isCancellationError(err)) {
                await rpcProtocol.sync();
                throw err;
            }
        }
        await rpcProtocol.sync();
        const results = revive(mockMainThreadSearch.results);
        return { results, stats: stats };
    }
    setup(() => {
        rpcProtocol = new TestRPCProtocol();
        mockMainThreadSearch = new MockMainThreadSearch();
        const logService = new NullLogService();
        rpcProtocol.set(MainContext.MainThreadSearch, mockMainThreadSearch);
        mockPFS = {};
        extHostSearch = disposables.add(new class extends NativeExtHostSearch {
            constructor() {
                super(rpcProtocol, new class extends mock() {
                    constructor() {
                        super(...arguments);
                        this.remote = { isRemote: false, authority: undefined, connectionData: null };
                    }
                }, new URITransformerService(null), new class extends mock() {
                    async getConfigProvider() {
                        return {
                            onDidChangeConfiguration(_listener) { },
                            getConfiguration() {
                                return {
                                    get() { },
                                    has() {
                                        return false;
                                    },
                                    inspect() {
                                        return undefined;
                                    },
                                    async update() { }
                                };
                            },
                        };
                    }
                }, logService);
                // eslint-disable-next-line local/code-no-any-casts
                this._pfs = mockPFS;
            }
            createTextSearchManager(query, provider) {
                return new NativeTextSearchManager(query, provider, this._pfs);
            }
        });
    });
    teardown(() => {
        return rpcProtocol.sync();
    });
    const rootFolderA = URI.file('/foo/bar1');
    const rootFolderB = URI.file('/foo/bar2');
    const fancyScheme = 'fancy';
    const fancySchemeFolderA = URI.from({ scheme: fancyScheme, path: '/project/folder1' });
    suite('File:', () => {
        function getSimpleQuery(filePattern = '') {
            return {
                type: 1 /* QueryType.File */,
                filePattern,
                folderQueries: [
                    { folder: rootFolderA }
                ]
            };
        }
        function compareURIs(actual, expected) {
            const sortAndStringify = (arr) => arr.sort().map(u => u.toString());
            assert.deepStrictEqual(sortAndStringify(actual), sortAndStringify(expected));
        }
        test('no results', async () => {
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    return Promise.resolve(null);
                }
            });
            const { results, stats } = await runFileSearch(getSimpleQuery());
            assert(!stats.limitHit);
            assert(!results.length);
        });
        test('simple results', async () => {
            const reportedResults = [
                joinPath(rootFolderA, 'file1.ts'),
                joinPath(rootFolderA, 'file2.ts'),
                joinPath(rootFolderA, 'subfolder/file3.ts')
            ];
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    return Promise.resolve(reportedResults);
                }
            });
            const { results, stats } = await runFileSearch(getSimpleQuery());
            assert(!stats.limitHit);
            assert.strictEqual(results.length, 3);
            compareURIs(results, reportedResults);
        });
        test('Search canceled', async () => {
            let cancelRequested = false;
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    return new Promise((resolve, reject) => {
                        function onCancel() {
                            cancelRequested = true;
                            resolve([joinPath(options.folder, 'file1.ts')]); // or reject or nothing?
                        }
                        if (token.isCancellationRequested) {
                            onCancel();
                        }
                        else {
                            disposables.add(token.onCancellationRequested(() => onCancel()));
                        }
                    });
                }
            });
            const { results } = await runFileSearch(getSimpleQuery(), true);
            assert(cancelRequested);
            assert(!results.length);
        });
        test('session cancellation should work', async () => {
            let numSessionCancelled = 0;
            const disposables = [];
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    disposables.push(options.session?.onCancellationRequested(() => {
                        numSessionCancelled++;
                    }));
                    return Promise.resolve([]);
                }
            });
            await runFileSearch({ ...getSimpleQuery(), cacheKey: '1' }, true);
            await runFileSearch({ ...getSimpleQuery(), cacheKey: '2' }, true);
            extHostSearch.$clearCache('1');
            assert.strictEqual(numSessionCancelled, 1);
            disposables.forEach(d => d?.dispose());
        });
        test('provider returns null', async () => {
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    return null;
                }
            });
            try {
                await runFileSearch(getSimpleQuery());
                assert(false, 'Expected to fail');
            }
            catch {
                // Expected to throw
            }
        });
        test('all provider calls get global include/excludes', async () => {
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    assert(options.excludes.length === 2 && options.includes.length === 2, 'Missing global include/excludes');
                    return Promise.resolve(null);
                }
            });
            const query = {
                type: 1 /* QueryType.File */,
                filePattern: '',
                includePattern: {
                    'foo': true,
                    'bar': true
                },
                excludePattern: {
                    'something': true,
                    'else': true
                },
                folderQueries: [
                    { folder: rootFolderA },
                    { folder: rootFolderB }
                ]
            };
            await runFileSearch(query);
        });
        test('global/local include/excludes combined', async () => {
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    if (options.folder.toString() === rootFolderA.toString()) {
                        assert.deepStrictEqual(options.includes.sort(), ['*.ts', 'foo']);
                        assert.deepStrictEqual(options.excludes.sort(), ['*.js', 'bar']);
                    }
                    else {
                        assert.deepStrictEqual(options.includes.sort(), ['*.ts']);
                        assert.deepStrictEqual(options.excludes.sort(), ['*.js']);
                    }
                    return Promise.resolve(null);
                }
            });
            const query = {
                type: 1 /* QueryType.File */,
                filePattern: '',
                includePattern: {
                    '*.ts': true
                },
                excludePattern: {
                    '*.js': true
                },
                folderQueries: [
                    {
                        folder: rootFolderA,
                        includePattern: {
                            'foo': true
                        },
                        excludePattern: [{
                                pattern: {
                                    'bar': true
                                }
                            }]
                    },
                    { folder: rootFolderB }
                ]
            };
            await runFileSearch(query);
        });
        test('include/excludes resolved correctly', async () => {
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    assert.deepStrictEqual(options.includes.sort(), ['*.jsx', '*.ts']);
                    assert.deepStrictEqual(options.excludes.sort(), []);
                    return Promise.resolve(null);
                }
            });
            const query = {
                type: 1 /* QueryType.File */,
                filePattern: '',
                includePattern: {
                    '*.ts': true,
                    '*.jsx': false
                },
                excludePattern: {
                    '*.js': true,
                    '*.tsx': false
                },
                folderQueries: [
                    {
                        folder: rootFolderA,
                        includePattern: {
                            '*.jsx': true
                        },
                        excludePattern: [{
                                pattern: {
                                    '*.js': false
                                }
                            }]
                    }
                ]
            };
            await runFileSearch(query);
        });
        test('basic sibling exclude clause', async () => {
            const reportedResults = [
                'file1.ts',
                'file1.js',
            ];
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    return Promise.resolve(reportedResults
                        .map(relativePath => joinPath(options.folder, relativePath)));
                }
            });
            const query = {
                type: 1 /* QueryType.File */,
                filePattern: '',
                excludePattern: {
                    '*.js': {
                        when: '$(basename).ts'
                    }
                },
                folderQueries: [
                    { folder: rootFolderA }
                ]
            };
            const { results } = await runFileSearch(query);
            compareURIs(results, [
                joinPath(rootFolderA, 'file1.ts')
            ]);
        });
        // https://github.com/microsoft/vscode-remotehub/issues/255
        test('include, sibling exclude, and subfolder', async () => {
            const reportedResults = [
                'foo/file1.ts',
                'foo/file1.js',
            ];
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    return Promise.resolve(reportedResults
                        .map(relativePath => joinPath(options.folder, relativePath)));
                }
            });
            const query = {
                type: 1 /* QueryType.File */,
                filePattern: '',
                includePattern: { '**/*.ts': true },
                excludePattern: {
                    '*.js': {
                        when: '$(basename).ts'
                    }
                },
                folderQueries: [
                    { folder: rootFolderA }
                ]
            };
            const { results } = await runFileSearch(query);
            compareURIs(results, [
                joinPath(rootFolderA, 'foo/file1.ts')
            ]);
        });
        test('multiroot sibling exclude clause', async () => {
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    let reportedResults;
                    if (options.folder.fsPath === rootFolderA.fsPath) {
                        reportedResults = [
                            'folder/fileA.scss',
                            'folder/fileA.css',
                            'folder/file2.css'
                        ].map(relativePath => joinPath(rootFolderA, relativePath));
                    }
                    else {
                        reportedResults = [
                            'fileB.ts',
                            'fileB.js',
                            'file3.js'
                        ].map(relativePath => joinPath(rootFolderB, relativePath));
                    }
                    return Promise.resolve(reportedResults);
                }
            });
            const query = {
                type: 1 /* QueryType.File */,
                filePattern: '',
                excludePattern: {
                    '*.js': {
                        when: '$(basename).ts'
                    },
                    '*.css': true
                },
                folderQueries: [
                    {
                        folder: rootFolderA,
                        excludePattern: [{
                                pattern: {
                                    'folder/*.css': {
                                        when: '$(basename).scss'
                                    }
                                }
                            }]
                    },
                    {
                        folder: rootFolderB,
                        excludePattern: [{
                                pattern: {
                                    '*.js': false
                                }
                            }]
                    }
                ]
            };
            const { results } = await runFileSearch(query);
            compareURIs(results, [
                joinPath(rootFolderA, 'folder/fileA.scss'),
                joinPath(rootFolderA, 'folder/file2.css'),
                joinPath(rootFolderB, 'fileB.ts'),
                joinPath(rootFolderB, 'fileB.js'),
                joinPath(rootFolderB, 'file3.js'),
            ]);
        });
        test('max results = 1', async () => {
            const reportedResults = [
                joinPath(rootFolderA, 'file1.ts'),
                joinPath(rootFolderA, 'file2.ts'),
                joinPath(rootFolderA, 'file3.ts'),
            ];
            let wasCanceled = false;
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    disposables.add(token.onCancellationRequested(() => wasCanceled = true));
                    return Promise.resolve(reportedResults);
                }
            });
            const query = {
                type: 1 /* QueryType.File */,
                filePattern: '',
                maxResults: 1,
                folderQueries: [
                    {
                        folder: rootFolderA
                    }
                ]
            };
            const { results, stats } = await runFileSearch(query);
            assert(stats.limitHit, 'Expected to return limitHit');
            assert.strictEqual(results.length, 1);
            compareURIs(results, reportedResults.slice(0, 1));
            assert(wasCanceled, 'Expected to be canceled when hitting limit');
        });
        test('max results = 2', async () => {
            const reportedResults = [
                joinPath(rootFolderA, 'file1.ts'),
                joinPath(rootFolderA, 'file2.ts'),
                joinPath(rootFolderA, 'file3.ts'),
            ];
            let wasCanceled = false;
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    disposables.add(token.onCancellationRequested(() => wasCanceled = true));
                    return Promise.resolve(reportedResults);
                }
            });
            const query = {
                type: 1 /* QueryType.File */,
                filePattern: '',
                maxResults: 2,
                folderQueries: [
                    {
                        folder: rootFolderA
                    }
                ]
            };
            const { results, stats } = await runFileSearch(query);
            assert(stats.limitHit, 'Expected to return limitHit');
            assert.strictEqual(results.length, 2);
            compareURIs(results, reportedResults.slice(0, 2));
            assert(wasCanceled, 'Expected to be canceled when hitting limit');
        });
        test('provider returns maxResults exactly', async () => {
            const reportedResults = [
                joinPath(rootFolderA, 'file1.ts'),
                joinPath(rootFolderA, 'file2.ts'),
            ];
            let wasCanceled = false;
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    disposables.add(token.onCancellationRequested(() => wasCanceled = true));
                    return Promise.resolve(reportedResults);
                }
            });
            const query = {
                type: 1 /* QueryType.File */,
                filePattern: '',
                maxResults: 2,
                folderQueries: [
                    {
                        folder: rootFolderA
                    }
                ]
            };
            const { results, stats } = await runFileSearch(query);
            assert(!stats.limitHit, 'Expected not to return limitHit');
            assert.strictEqual(results.length, 2);
            compareURIs(results, reportedResults);
            assert(!wasCanceled, 'Expected not to be canceled when just reaching limit');
        });
        test('multiroot max results', async () => {
            let cancels = 0;
            await registerTestFileSearchProvider({
                async provideFileSearchResults(query, options, token) {
                    disposables.add(token.onCancellationRequested(() => cancels++));
                    // Provice results async so it has a chance to invoke every provider
                    await new Promise(r => process.nextTick(r));
                    return [
                        'file1.ts',
                        'file2.ts',
                        'file3.ts',
                    ].map(relativePath => joinPath(options.folder, relativePath));
                }
            });
            const query = {
                type: 1 /* QueryType.File */,
                filePattern: '',
                maxResults: 2,
                folderQueries: [
                    {
                        folder: rootFolderA
                    },
                    {
                        folder: rootFolderB
                    }
                ]
            };
            const { results } = await runFileSearch(query);
            assert.strictEqual(results.length, 2); // Don't care which 2 we got
            assert.strictEqual(cancels, 2, 'Expected all invocations to be canceled when hitting limit');
        });
        test('works with non-file schemes', async () => {
            const reportedResults = [
                joinPath(fancySchemeFolderA, 'file1.ts'),
                joinPath(fancySchemeFolderA, 'file2.ts'),
                joinPath(fancySchemeFolderA, 'subfolder/file3.ts'),
            ];
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    return Promise.resolve(reportedResults);
                }
            }, fancyScheme);
            const query = {
                type: 1 /* QueryType.File */,
                filePattern: '',
                folderQueries: [
                    {
                        folder: fancySchemeFolderA
                    }
                ]
            };
            const { results } = await runFileSearch(query);
            compareURIs(results, reportedResults);
        });
        test('if onlyFileScheme is set, do not call custom schemes', async () => {
            let fancySchemeCalled = false;
            await registerTestFileSearchProvider({
                provideFileSearchResults(query, options, token) {
                    fancySchemeCalled = true;
                    return Promise.resolve([]);
                }
            }, fancyScheme);
            const query = {
                type: 1 /* QueryType.File */,
                filePattern: '',
                folderQueries: []
            };
            await runFileSearch(query);
            assert(!fancySchemeCalled);
        });
    });
    suite('Text:', () => {
        function makePreview(text) {
            return {
                matches: [new Range(0, 0, 0, text.length)],
                text
            };
        }
        function makeTextResult(baseFolder, relativePath) {
            return {
                preview: makePreview('foo'),
                ranges: [new Range(0, 0, 0, 3)],
                uri: joinPath(baseFolder, relativePath)
            };
        }
        function getSimpleQuery(queryText) {
            return {
                type: 2 /* QueryType.Text */,
                contentPattern: getPattern(queryText),
                folderQueries: [
                    { folder: rootFolderA }
                ]
            };
        }
        function getPattern(queryText) {
            return {
                pattern: queryText
            };
        }
        function assertResults(actual, expected) {
            const actualTextSearchResults = [];
            for (const fileMatch of actual) {
                // Make relative
                for (const lineResult of fileMatch.results) {
                    if (resultIsMatch(lineResult)) {
                        actualTextSearchResults.push({
                            preview: {
                                text: lineResult.previewText,
                                matches: mapArrayOrNot(lineResult.rangeLocations.map(r => r.preview), m => new Range(m.startLineNumber, m.startColumn, m.endLineNumber, m.endColumn))
                            },
                            ranges: mapArrayOrNot(lineResult.rangeLocations.map(r => r.source), r => new Range(r.startLineNumber, r.startColumn, r.endLineNumber, r.endColumn)),
                            uri: fileMatch.resource
                        });
                    }
                    else {
                        actualTextSearchResults.push({
                            text: lineResult.text,
                            lineNumber: lineResult.lineNumber,
                            uri: fileMatch.resource
                        });
                    }
                }
            }
            const rangeToString = (r) => `(${r.start.line}, ${r.start.character}), (${r.end.line}, ${r.end.character})`;
            const makeComparable = (results) => results
                .sort((a, b) => {
                const compareKeyA = a.uri.toString() + ': ' + (extensionResultIsMatch(a) ? a.preview.text : a.text);
                const compareKeyB = b.uri.toString() + ': ' + (extensionResultIsMatch(b) ? b.preview.text : b.text);
                return compareKeyB.localeCompare(compareKeyA);
            })
                .map(r => extensionResultIsMatch(r) ? {
                uri: r.uri.toString(),
                range: mapArrayOrNot(r.ranges, rangeToString),
                preview: {
                    text: r.preview.text,
                    match: null // Don't care about this right now
                }
            } : {
                uri: r.uri.toString(),
                text: r.text,
                lineNumber: r.lineNumber
            });
            return assert.deepStrictEqual(makeComparable(actualTextSearchResults), makeComparable(expected));
        }
        test('no results', async () => {
            await registerTestTextSearchProvider({
                provideTextSearchResults(query, options, progress, token) {
                    return Promise.resolve(null);
                }
            });
            const { results, stats } = await runTextSearch(getSimpleQuery('foo'));
            assert(!stats.limitHit);
            assert(!results.length);
        });
        test('basic results', async () => {
            const providedResults = [
                makeTextResult(rootFolderA, 'file1.ts'),
                makeTextResult(rootFolderA, 'file2.ts')
            ];
            await registerTestTextSearchProvider({
                provideTextSearchResults(query, options, progress, token) {
                    providedResults.forEach(r => progress.report(r));
                    return Promise.resolve(null);
                }
            });
            const { results, stats } = await runTextSearch(getSimpleQuery('foo'));
            assert(!stats.limitHit);
            assertResults(results, providedResults);
        });
        test('all provider calls get global include/excludes', async () => {
            await registerTestTextSearchProvider({
                provideTextSearchResults(query, options, progress, token) {
                    assert.strictEqual(options.includes.length, 1);
                    assert.strictEqual(options.excludes.length, 1);
                    return Promise.resolve(null);
                }
            });
            const query = {
                type: 2 /* QueryType.Text */,
                contentPattern: getPattern('foo'),
                includePattern: {
                    '*.ts': true
                },
                excludePattern: {
                    '*.js': true
                },
                folderQueries: [
                    { folder: rootFolderA },
                    { folder: rootFolderB }
                ]
            };
            await runTextSearch(query);
        });
        test('global/local include/excludes combined', async () => {
            await registerTestTextSearchProvider({
                provideTextSearchResults(query, options, progress, token) {
                    if (options.folder.toString() === rootFolderA.toString()) {
                        assert.deepStrictEqual(options.includes.sort(), ['*.ts', 'foo']);
                        assert.deepStrictEqual(options.excludes.sort(), ['*.js', 'bar']);
                    }
                    else {
                        assert.deepStrictEqual(options.includes.sort(), ['*.ts']);
                        assert.deepStrictEqual(options.excludes.sort(), ['*.js']);
                    }
                    return Promise.resolve(null);
                }
            });
            const query = {
                type: 2 /* QueryType.Text */,
                contentPattern: getPattern('foo'),
                includePattern: {
                    '*.ts': true
                },
                excludePattern: {
                    '*.js': true
                },
                folderQueries: [
                    {
                        folder: rootFolderA,
                        includePattern: {
                            'foo': true
                        },
                        excludePattern: [{
                                pattern: {
                                    'bar': true
                                }
                            }]
                    },
                    { folder: rootFolderB }
                ]
            };
            await runTextSearch(query);
        });
        test('include/excludes resolved correctly', async () => {
            await registerTestTextSearchProvider({
                provideTextSearchResults(query, options, progress, token) {
                    assert.deepStrictEqual(options.includes.sort(), ['*.jsx', '*.ts']);
                    assert.deepStrictEqual(options.excludes.sort(), []);
                    return Promise.resolve(null);
                }
            });
            const query = {
                type: 2 /* QueryType.Text */,
                contentPattern: getPattern('foo'),
                includePattern: {
                    '*.ts': true,
                    '*.jsx': false
                },
                excludePattern: {
                    '*.js': true,
                    '*.tsx': false
                },
                folderQueries: [
                    {
                        folder: rootFolderA,
                        includePattern: {
                            '*.jsx': true
                        },
                        excludePattern: [{
                                pattern: {
                                    '*.js': false
                                }
                            }]
                    }
                ]
            };
            await runTextSearch(query);
        });
        test('provider fail', async () => {
            await registerTestTextSearchProvider({
                provideTextSearchResults(query, options, progress, token) {
                    throw new Error('Provider fail');
                }
            });
            try {
                await runTextSearch(getSimpleQuery('foo'));
                assert(false, 'Expected to fail');
            }
            catch {
                // expected to fail
            }
        });
        test('basic sibling clause', async () => {
            // eslint-disable-next-line local/code-no-any-casts
            mockPFS.Promises = {
                readdir: (_path) => {
                    if (_path === rootFolderA.fsPath) {
                        return Promise.resolve([
                            'file1.js',
                            'file1.ts'
                        ]);
                    }
                    else {
                        return Promise.reject(new Error('Wrong path'));
                    }
                }
            };
            const providedResults = [
                makeTextResult(rootFolderA, 'file1.js'),
                makeTextResult(rootFolderA, 'file1.ts')
            ];
            await registerTestTextSearchProvider({
                provideTextSearchResults(query, options, progress, token) {
                    providedResults.forEach(r => progress.report(r));
                    return Promise.resolve(null);
                }
            });
            const query = {
                type: 2 /* QueryType.Text */,
                contentPattern: getPattern('foo'),
                excludePattern: {
                    '*.js': {
                        when: '$(basename).ts'
                    }
                },
                folderQueries: [
                    { folder: rootFolderA }
                ]
            };
            const { results } = await runTextSearch(query);
            assertResults(results, providedResults.slice(1));
        });
        test('multiroot sibling clause', async () => {
            // eslint-disable-next-line local/code-no-any-casts
            mockPFS.Promises = {
                readdir: (_path) => {
                    if (_path === joinPath(rootFolderA, 'folder').fsPath) {
                        return Promise.resolve([
                            'fileA.scss',
                            'fileA.css',
                            'file2.css'
                        ]);
                    }
                    else if (_path === rootFolderB.fsPath) {
                        return Promise.resolve([
                            'fileB.ts',
                            'fileB.js',
                            'file3.js'
                        ]);
                    }
                    else {
                        return Promise.reject(new Error('Wrong path'));
                    }
                }
            };
            await registerTestTextSearchProvider({
                provideTextSearchResults(query, options, progress, token) {
                    let reportedResults;
                    if (options.folder.fsPath === rootFolderA.fsPath) {
                        reportedResults = [
                            makeTextResult(rootFolderA, 'folder/fileA.scss'),
                            makeTextResult(rootFolderA, 'folder/fileA.css'),
                            makeTextResult(rootFolderA, 'folder/file2.css')
                        ];
                    }
                    else {
                        reportedResults = [
                            makeTextResult(rootFolderB, 'fileB.ts'),
                            makeTextResult(rootFolderB, 'fileB.js'),
                            makeTextResult(rootFolderB, 'file3.js')
                        ];
                    }
                    reportedResults.forEach(r => progress.report(r));
                    return Promise.resolve(null);
                }
            });
            const query = {
                type: 2 /* QueryType.Text */,
                contentPattern: getPattern('foo'),
                excludePattern: {
                    '*.js': {
                        when: '$(basename).ts'
                    },
                    '*.css': true
                },
                folderQueries: [
                    {
                        folder: rootFolderA,
                        excludePattern: [{
                                pattern: {
                                    'folder/*.css': {
                                        when: '$(basename).scss'
                                    }
                                }
                            }]
                    },
                    {
                        folder: rootFolderB,
                        excludePattern: [{
                                pattern: {
                                    '*.js': false
                                }
                            }]
                    }
                ]
            };
            const { results } = await runTextSearch(query);
            assertResults(results, [
                makeTextResult(rootFolderA, 'folder/fileA.scss'),
                makeTextResult(rootFolderA, 'folder/file2.css'),
                makeTextResult(rootFolderB, 'fileB.ts'),
                makeTextResult(rootFolderB, 'fileB.js'),
                makeTextResult(rootFolderB, 'file3.js')
            ]);
        });
        test('include pattern applied', async () => {
            const providedResults = [
                makeTextResult(rootFolderA, 'file1.js'),
                makeTextResult(rootFolderA, 'file1.ts')
            ];
            await registerTestTextSearchProvider({
                provideTextSearchResults(query, options, progress, token) {
                    providedResults.forEach(r => progress.report(r));
                    return Promise.resolve(null);
                }
            });
            const query = {
                type: 2 /* QueryType.Text */,
                contentPattern: getPattern('foo'),
                includePattern: {
                    '*.ts': true
                },
                folderQueries: [
                    { folder: rootFolderA }
                ]
            };
            const { results } = await runTextSearch(query);
            assertResults(results, providedResults.slice(1));
        });
        test('max results = 1', async () => {
            const providedResults = [
                makeTextResult(rootFolderA, 'file1.ts'),
                makeTextResult(rootFolderA, 'file2.ts')
            ];
            let wasCanceled = false;
            await registerTestTextSearchProvider({
                provideTextSearchResults(query, options, progress, token) {
                    disposables.add(token.onCancellationRequested(() => wasCanceled = true));
                    providedResults.forEach(r => progress.report(r));
                    return Promise.resolve(null);
                }
            });
            const query = {
                type: 2 /* QueryType.Text */,
                contentPattern: getPattern('foo'),
                maxResults: 1,
                folderQueries: [
                    { folder: rootFolderA }
                ]
            };
            const { results, stats } = await runTextSearch(query);
            assert(stats.limitHit, 'Expected to return limitHit');
            assertResults(results, providedResults.slice(0, 1));
            assert(wasCanceled, 'Expected to be canceled');
        });
        test('max results = 2', async () => {
            const providedResults = [
                makeTextResult(rootFolderA, 'file1.ts'),
                makeTextResult(rootFolderA, 'file2.ts'),
                makeTextResult(rootFolderA, 'file3.ts')
            ];
            let wasCanceled = false;
            await registerTestTextSearchProvider({
                provideTextSearchResults(query, options, progress, token) {
                    disposables.add(token.onCancellationRequested(() => wasCanceled = true));
                    providedResults.forEach(r => progress.report(r));
                    return Promise.resolve(null);
                }
            });
            const query = {
                type: 2 /* QueryType.Text */,
                contentPattern: getPattern('foo'),
                maxResults: 2,
                folderQueries: [
                    { folder: rootFolderA }
                ]
            };
            const { results, stats } = await runTextSearch(query);
            assert(stats.limitHit, 'Expected to return limitHit');
            assertResults(results, providedResults.slice(0, 2));
            assert(wasCanceled, 'Expected to be canceled');
        });
        test('provider returns maxResults exactly', async () => {
            const providedResults = [
                makeTextResult(rootFolderA, 'file1.ts'),
                makeTextResult(rootFolderA, 'file2.ts')
            ];
            let wasCanceled = false;
            await registerTestTextSearchProvider({
                provideTextSearchResults(query, options, progress, token) {
                    disposables.add(token.onCancellationRequested(() => wasCanceled = true));
                    providedResults.forEach(r => progress.report(r));
                    return Promise.resolve(null);
                }
            });
            const query = {
                type: 2 /* QueryType.Text */,
                contentPattern: getPattern('foo'),
                maxResults: 2,
                folderQueries: [
                    { folder: rootFolderA }
                ]
            };
            const { results, stats } = await runTextSearch(query);
            assert(!stats.limitHit, 'Expected not to return limitHit');
            assertResults(results, providedResults);
            assert(!wasCanceled, 'Expected not to be canceled');
        });
        test('provider returns early with limitHit', async () => {
            const providedResults = [
                makeTextResult(rootFolderA, 'file1.ts'),
                makeTextResult(rootFolderA, 'file2.ts'),
                makeTextResult(rootFolderA, 'file3.ts')
            ];
            await registerTestTextSearchProvider({
                provideTextSearchResults(query, options, progress, token) {
                    providedResults.forEach(r => progress.report(r));
                    return Promise.resolve({ limitHit: true });
                }
            });
            const query = {
                type: 2 /* QueryType.Text */,
                contentPattern: getPattern('foo'),
                maxResults: 1000,
                folderQueries: [
                    { folder: rootFolderA }
                ]
            };
            const { results, stats } = await runTextSearch(query);
            assert(stats.limitHit, 'Expected to return limitHit');
            assertResults(results, providedResults);
        });
        test('multiroot max results', async () => {
            let cancels = 0;
            await registerTestTextSearchProvider({
                async provideTextSearchResults(query, options, progress, token) {
                    disposables.add(token.onCancellationRequested(() => cancels++));
                    await new Promise(r => process.nextTick(r));
                    [
                        'file1.ts',
                        'file2.ts',
                        'file3.ts',
                    ].forEach(f => progress.report(makeTextResult(options.folder, f)));
                    return null;
                }
            });
            const query = {
                type: 2 /* QueryType.Text */,
                contentPattern: getPattern('foo'),
                maxResults: 2,
                folderQueries: [
                    { folder: rootFolderA },
                    { folder: rootFolderB }
                ]
            };
            const { results } = await runTextSearch(query);
            assert.strictEqual(results.length, 2);
            assert.strictEqual(cancels, 2);
        });
        test('works with non-file schemes', async () => {
            const providedResults = [
                makeTextResult(fancySchemeFolderA, 'file1.ts'),
                makeTextResult(fancySchemeFolderA, 'file2.ts'),
                makeTextResult(fancySchemeFolderA, 'file3.ts')
            ];
            await registerTestTextSearchProvider({
                provideTextSearchResults(query, options, progress, token) {
                    providedResults.forEach(r => progress.report(r));
                    return Promise.resolve(null);
                }
            }, fancyScheme);
            const query = {
                type: 2 /* QueryType.Text */,
                contentPattern: getPattern('foo'),
                folderQueries: [
                    { folder: fancySchemeFolderA }
                ]
            };
            const { results } = await runTextSearch(query);
            assertResults(results, providedResults);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdFNlYXJjaC50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvdGVzdC9ub2RlL2V4dEhvc3RTZWFyY2gudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNsRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxHQUFHLEVBQWlCLE1BQU0sZ0NBQWdDLENBQUM7QUFFcEUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzVELE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsV0FBVyxFQUF5QixNQUFNLGtDQUFrQyxDQUFDO0FBR3RGLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUNyRCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNyRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNsRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDL0QsT0FBTyxFQUFtSCxhQUFh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