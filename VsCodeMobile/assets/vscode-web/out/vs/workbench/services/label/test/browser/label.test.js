/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as resources from '../../../../../base/common/resources.js';
import assert from 'assert';
import { TestEnvironmentService, TestLifecycleService, TestPathService, TestRemoteAgentService } from '../../../../test/browser/workbenchTestServices.js';
import { URI } from '../../../../../base/common/uri.js';
import { LabelService } from '../../common/labelService.js';
import { TestContextService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { WorkspaceFolder } from '../../../../../platform/workspace/common/workspace.js';
import { TestWorkspace, Workspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { isWindows } from '../../../../../base/common/platform.js';
import { Memento } from '../../../../common/memento.js';
import { sep } from '../../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
suite('URI Label', () => {
    let labelService;
    let storageService;
    setup(() => {
        storageService = new TestStorageService();
        labelService = new LabelService(TestEnvironmentService, new TestContextService(), new TestPathService(URI.file('/foobar')), new TestRemoteAgentService(), storageService, new TestLifecycleService());
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('custom scheme', function () {
        labelService.registerFormatter({
            scheme: 'vscode',
            formatting: {
                label: 'LABEL/${path}/${authority}/END',
                separator: '/',
                tildify: true,
                normalizeDriveLetter: true
            }
        });
        const uri1 = URI.parse('vscode://microsoft.com/1/2/3/4/5');
        assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'LABEL//1/2/3/4/5/microsoft.com/END');
        assert.strictEqual(labelService.getUriBasenameLabel(uri1), 'END');
    });
    test('file scheme', function () {
        labelService.registerFormatter({
            scheme: 'file',
            formatting: {
                label: '${path}',
                separator: sep,
                tildify: !isWindows,
                normalizeDriveLetter: isWindows
            }
        });
        const uri1 = TestWorkspace.folders[0].uri.with({ path: TestWorkspace.folders[0].uri.path.concat('/a/b/c/d') });
        assert.strictEqual(labelService.getUriLabel(uri1, { relative: true }), isWindows ? 'a\\b\\c\\d' : 'a/b/c/d');
        assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), isWindows ? 'C:\\testWorkspace\\a\\b\\c\\d' : '/testWorkspace/a/b/c/d');
        assert.strictEqual(labelService.getUriBasenameLabel(uri1), 'd');
        const uri2 = URI.file('c:\\1/2/3');
        assert.strictEqual(labelService.getUriLabel(uri2, { relative: false }), isWindows ? 'C:\\1\\2\\3' : '/c:\\1/2/3');
        assert.strictEqual(labelService.getUriBasenameLabel(uri2), '3');
    });
    test('separator', function () {
        labelService.registerFormatter({
            scheme: 'vscode',
            formatting: {
                label: 'LABEL\\${path}\\${authority}\\END',
                separator: '\\',
                tildify: true,
                normalizeDriveLetter: true
            }
        });
        const uri1 = URI.parse('vscode://microsoft.com/1/2/3/4/5');
        assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'LABEL\\\\1\\2\\3\\4\\5\\microsoft.com\\END');
        assert.strictEqual(labelService.getUriBasenameLabel(uri1), 'END');
    });
    test('custom authority', function () {
        labelService.registerFormatter({
            scheme: 'vscode',
            authority: 'micro*',
            formatting: {
                label: 'LABEL/${path}/${authority}/END',
                separator: '/'
            }
        });
        const uri1 = URI.parse('vscode://microsoft.com/1/2/3/4/5');
        assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'LABEL//1/2/3/4/5/microsoft.com/END');
        assert.strictEqual(labelService.getUriBasenameLabel(uri1), 'END');
    });
    test('mulitple authority', function () {
        labelService.registerFormatter({
            scheme: 'vscode',
            authority: 'not_matching_but_long',
            formatting: {
                label: 'first',
                separator: '/'
            }
        });
        labelService.registerFormatter({
            scheme: 'vscode',
            authority: 'microsof*',
            formatting: {
                label: 'second',
                separator: '/'
            }
        });
        labelService.registerFormatter({
            scheme: 'vscode',
            authority: 'mi*',
            formatting: {
                label: 'third',
                separator: '/'
            }
        });
        // Make sure the most specific authority is picked
        const uri1 = URI.parse('vscode://microsoft.com/1/2/3/4/5');
        assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'second');
        assert.strictEqual(labelService.getUriBasenameLabel(uri1), 'second');
    });
    test('custom query', function () {
        labelService.registerFormatter({
            scheme: 'vscode',
            formatting: {
                label: 'LABEL${query.prefix}: ${query.path}/END',
                separator: '/',
                tildify: true,
                normalizeDriveLetter: true
            }
        });
        const uri1 = URI.parse(`vscode://microsoft.com/1/2/3/4/5?${encodeURIComponent(JSON.stringify({ prefix: 'prefix', path: 'path' }))}`);
        assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'LABELprefix: path/END');
    });
    test('custom query without value', function () {
        labelService.registerFormatter({
            scheme: 'vscode',
            formatting: {
                label: 'LABEL${query.prefix}: ${query.path}/END',
                separator: '/',
                tildify: true,
                normalizeDriveLetter: true
            }
        });
        const uri1 = URI.parse(`vscode://microsoft.com/1/2/3/4/5?${encodeURIComponent(JSON.stringify({ path: 'path' }))}`);
        assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'LABEL: path/END');
    });
    test('custom query without query json', function () {
        labelService.registerFormatter({
            scheme: 'vscode',
            formatting: {
                label: 'LABEL${query.prefix}: ${query.path}/END',
                separator: '/',
                tildify: true,
                normalizeDriveLetter: true
            }
        });
        const uri1 = URI.parse('vscode://microsoft.com/1/2/3/4/5?path=foo');
        assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'LABEL: /END');
    });
    test('custom query without query', function () {
        labelService.registerFormatter({
            scheme: 'vscode',
            formatting: {
                label: 'LABEL${query.prefix}: ${query.path}/END',
                separator: '/',
                tildify: true,
                normalizeDriveLetter: true
            }
        });
        const uri1 = URI.parse('vscode://microsoft.com/1/2/3/4/5');
        assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), 'LABEL: /END');
    });
    test('label caching', () => {
        const m = new Memento('cachedResourceLabelFormatters2', storageService).getMemento(0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        const makeFormatter = (scheme) => ({ formatting: { label: `\${path} (${scheme})`, separator: '/' }, scheme });
        assert.deepStrictEqual(m, {});
        // registers a new formatter:
        labelService.registerCachedFormatter(makeFormatter('a'));
        assert.deepStrictEqual(m, { formatters: [makeFormatter('a')] });
        // registers a 2nd formatter:
        labelService.registerCachedFormatter(makeFormatter('b'));
        assert.deepStrictEqual(m, { formatters: [makeFormatter('b'), makeFormatter('a')] });
        // promotes a formatter on re-register:
        labelService.registerCachedFormatter(makeFormatter('a'));
        assert.deepStrictEqual(m, { formatters: [makeFormatter('a'), makeFormatter('b')] });
        // no-ops if already in first place:
        labelService.registerCachedFormatter(makeFormatter('a'));
        assert.deepStrictEqual(m, { formatters: [makeFormatter('a'), makeFormatter('b')] });
        // limits the cache:
        for (let i = 0; i < 100; i++) {
            labelService.registerCachedFormatter(makeFormatter(`i${i}`));
        }
        const expected = [];
        for (let i = 50; i < 100; i++) {
            expected.unshift(makeFormatter(`i${i}`));
        }
        assert.deepStrictEqual(m, { formatters: expected });
        delete m.formatters;
    });
});
suite('multi-root workspace', () => {
    let labelService;
    const disposables = new DisposableStore();
    setup(() => {
        const sources = URI.file('folder1/src');
        const tests = URI.file('folder1/test');
        const other = URI.file('folder2');
        labelService = disposables.add(new LabelService(TestEnvironmentService, new TestContextService(new Workspace('test-workspace', [
            new WorkspaceFolder({ uri: sources, index: 0, name: 'Sources' }),
            new WorkspaceFolder({ uri: tests, index: 1, name: 'Tests' }),
            new WorkspaceFolder({ uri: other, index: 2, name: resources.basename(other) }),
        ])), new TestPathService(), new TestRemoteAgentService(), disposables.add(new TestStorageService()), disposables.add(new TestLifecycleService())));
    });
    teardown(() => {
        disposables.clear();
    });
    test('labels of files in multiroot workspaces are the foldername followed by offset from the folder', () => {
        labelService.registerFormatter({
            scheme: 'file',
            formatting: {
                label: '${authority}${path}',
                separator: '/',
                tildify: false,
                normalizeDriveLetter: false,
                authorityPrefix: '//',
                workspaceSuffix: ''
            }
        });
        const tests = {
            'folder1/src/file': 'Sources • file',
            'folder1/src/folder/file': 'Sources • folder/file',
            'folder1/src': 'Sources',
            'folder1/other': '/folder1/other',
            'folder2/other': 'folder2 • other',
        };
        Object.entries(tests).forEach(([path, label]) => {
            const generated = labelService.getUriLabel(URI.file(path), { relative: true });
            assert.strictEqual(generated, label);
        });
    });
    test('labels with context after path', () => {
        labelService.registerFormatter({
            scheme: 'file',
            formatting: {
                label: '${path} (${scheme})',
                separator: '/',
            }
        });
        const tests = {
            'folder1/src/file': 'Sources • file (file)',
            'folder1/src/folder/file': 'Sources • folder/file (file)',
            'folder1/src': 'Sources',
            'folder1/other': '/folder1/other (file)',
            'folder2/other': 'folder2 • other (file)',
        };
        Object.entries(tests).forEach(([path, label]) => {
            const generated = labelService.getUriLabel(URI.file(path), { relative: true });
            assert.strictEqual(generated, label, path);
        });
    });
    test('stripPathStartingSeparator', () => {
        labelService.registerFormatter({
            scheme: 'file',
            formatting: {
                label: '${path}',
                separator: '/',
                stripPathStartingSeparator: true
            }
        });
        const tests = {
            'folder1/src/file': 'Sources • file',
            'other/blah': 'other/blah',
        };
        Object.entries(tests).forEach(([path, label]) => {
            const generated = labelService.getUriLabel(URI.file(path), { relative: true });
            assert.strictEqual(generated, label, path);
        });
    });
    test('relative label without formatter', () => {
        const rootFolder = URI.parse('myscheme://myauthority/');
        labelService = disposables.add(new LabelService(TestEnvironmentService, new TestContextService(new Workspace('test-workspace', [
            new WorkspaceFolder({ uri: rootFolder, index: 0, name: 'FSProotFolder' }),
        ])), new TestPathService(undefined, rootFolder.scheme), new TestRemoteAgentService(), disposables.add(new TestStorageService()), disposables.add(new TestLifecycleService())));
        const generated = labelService.getUriLabel(URI.parse('myscheme://myauthority/some/folder/test.txt'), { relative: true });
        if (isWindows) {
            assert.strictEqual(generated, 'some\\folder\\test.txt');
        }
        else {
            assert.strictEqual(generated, 'some/folder/test.txt');
        }
    });
    ensureNoDisposablesAreLeakedInTestSuite();
});
suite('workspace at FSP root', () => {
    let labelService;
    setup(() => {
        const rootFolder = URI.parse('myscheme://myauthority/');
        labelService = new LabelService(TestEnvironmentService, new TestContextService(new Workspace('test-workspace', [
            new WorkspaceFolder({ uri: rootFolder, index: 0, name: 'FSProotFolder' }),
        ])), new TestPathService(), new TestRemoteAgentService(), new TestStorageService(), new TestLifecycleService());
        labelService.registerFormatter({
            scheme: 'myscheme',
            formatting: {
                label: '${scheme}://${authority}${path}',
                separator: '/',
                tildify: false,
                normalizeDriveLetter: false,
                workspaceSuffix: '',
                authorityPrefix: '',
                stripPathStartingSeparator: false
            }
        });
    });
    test('non-relative label', () => {
        const tests = {
            'myscheme://myauthority/myFile1.txt': 'myscheme://myauthority/myFile1.txt',
            'myscheme://myauthority/folder/myFile2.txt': 'myscheme://myauthority/folder/myFile2.txt',
        };
        Object.entries(tests).forEach(([uriString, label]) => {
            const generated = labelService.getUriLabel(URI.parse(uriString), { relative: false });
            assert.strictEqual(generated, label);
        });
    });
    test('relative label', () => {
        const tests = {
            'myscheme://myauthority/myFile1.txt': 'myFile1.txt',
            'myscheme://myauthority/folder/myFile2.txt': 'folder/myFile2.txt',
        };
        Object.entries(tests).forEach(([uriString, label]) => {
            const generated = labelService.getUriLabel(URI.parse(uriString), { relative: true });
            assert.strictEqual(generated, label);
        });
    });
    test('relative label with explicit path separator', () => {
        let generated = labelService.getUriLabel(URI.parse('myscheme://myauthority/some/folder/test.txt'), { relative: true, separator: '/' });
        assert.strictEqual(generated, 'some/folder/test.txt');
        generated = labelService.getUriLabel(URI.parse('myscheme://myauthority/some/folder/test.txt'), { relative: true, separator: '\\' });
        assert.strictEqual(generated, 'some\\folder\\test.txt');
    });
    ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFiZWwudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvbGFiZWwvdGVzdC9icm93c2VyL2xhYmVsLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLFNBQVMsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLHNCQUFzQixFQUFFLG9CQUFvQixFQUFFLGVBQWUsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQzFKLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDNUQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLGtCQUFrQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDMUcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLE1BQU0sZ0VBQWdFLENBQUM7QUFDMUcsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRW5FLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUV4RCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDekQsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRTFFLEtBQUssQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFO0lBQ3ZCLElBQUksWUFBMEIsQ0FBQztJQUMvQixJQUFJLGNBQWtDLENBQUM7SUFFdkMsS0FBSyxDQUFDLEdBQUcsRUFBRTtR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