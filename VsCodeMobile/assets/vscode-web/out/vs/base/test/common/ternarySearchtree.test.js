/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { shuffle } from '../../common/arrays.js';
import { randomPath } from '../../common/extpath.js';
import { StopWatch } from '../../common/stopwatch.js';
import { ConfigKeysIterator, PathIterator, StringIterator, TernarySearchTree, UriIterator } from '../../common/ternarySearchTree.js';
import { URI } from '../../common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from './utils.js';
suite('Ternary Search Tree', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('PathIterator', () => {
        const iter = new PathIterator();
        iter.reset('file:///usr/bin/file.txt');
        assert.strictEqual(iter.value(), 'file:');
        assert.strictEqual(iter.hasNext(), true);
        assert.strictEqual(iter.cmp('file:'), 0);
        assert.ok(iter.cmp('a') < 0);
        assert.ok(iter.cmp('aile:') < 0);
        assert.ok(iter.cmp('z') > 0);
        assert.ok(iter.cmp('zile:') > 0);
        iter.next();
        assert.strictEqual(iter.value(), 'usr');
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        assert.strictEqual(iter.value(), 'bin');
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        assert.strictEqual(iter.value(), 'file.txt');
        assert.strictEqual(iter.hasNext(), false);
        iter.next();
        assert.strictEqual(iter.value(), '');
        assert.strictEqual(iter.hasNext(), false);
        iter.next();
        assert.strictEqual(iter.value(), '');
        assert.strictEqual(iter.hasNext(), false);
        //
        iter.reset('/foo/bar/');
        assert.strictEqual(iter.value(), 'foo');
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        assert.strictEqual(iter.value(), 'bar');
        assert.strictEqual(iter.hasNext(), false);
    });
    test('URIIterator', function () {
        const iter = new UriIterator(() => false, () => false);
        iter.reset(URI.parse('file:///usr/bin/file.txt'));
        assert.strictEqual(iter.value(), 'file');
        // assert.strictEqual(iter.cmp('FILE'), 0);
        assert.strictEqual(iter.cmp('file'), 0);
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        assert.strictEqual(iter.value(), 'usr');
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        assert.strictEqual(iter.value(), 'bin');
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        assert.strictEqual(iter.value(), 'file.txt');
        assert.strictEqual(iter.hasNext(), false);
        iter.reset(URI.parse('file://share/usr/bin/file.txt?foo'));
        // scheme
        assert.strictEqual(iter.value(), 'file');
        // assert.strictEqual(iter.cmp('FILE'), 0);
        assert.strictEqual(iter.cmp('file'), 0);
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        // authority
        assert.strictEqual(iter.value(), 'share');
        assert.strictEqual(iter.cmp('SHARe'), 0);
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        // path
        assert.strictEqual(iter.value(), 'usr');
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        // path
        assert.strictEqual(iter.value(), 'bin');
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        // path
        assert.strictEqual(iter.value(), 'file.txt');
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        // query
        assert.strictEqual(iter.value(), 'foo');
        assert.strictEqual(iter.cmp('z') > 0, true);
        assert.strictEqual(iter.cmp('a') < 0, true);
        assert.strictEqual(iter.hasNext(), false);
    });
    test('URIIterator - ignore query/fragment', function () {
        const iter = new UriIterator(() => false, () => true);
        iter.reset(URI.parse('file:///usr/bin/file.txt'));
        assert.strictEqual(iter.value(), 'file');
        // assert.strictEqual(iter.cmp('FILE'), 0);
        assert.strictEqual(iter.cmp('file'), 0);
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        assert.strictEqual(iter.value(), 'usr');
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        assert.strictEqual(iter.value(), 'bin');
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        assert.strictEqual(iter.value(), 'file.txt');
        assert.strictEqual(iter.hasNext(), false);
        iter.reset(URI.parse('file://share/usr/bin/file.txt?foo'));
        // scheme
        assert.strictEqual(iter.value(), 'file');
        // assert.strictEqual(iter.cmp('FILE'), 0);
        assert.strictEqual(iter.cmp('file'), 0);
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        // authority
        assert.strictEqual(iter.value(), 'share');
        assert.strictEqual(iter.cmp('SHARe'), 0);
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        // path
        assert.strictEqual(iter.value(), 'usr');
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        // path
        assert.strictEqual(iter.value(), 'bin');
        assert.strictEqual(iter.hasNext(), true);
        iter.next();
        // path
        assert.strictEqual(iter.value(), 'file.txt');
        assert.strictEqual(iter.hasNext(), false);
    });
    function assertTstDfs(trie, ...elements) {
        assert.ok(trie._isBalanced(), 'TST is not balanced');
        let i = 0;
        for (const [key, value] of trie) {
            const expected = elements[i++];
            assert.ok(expected);
            assert.strictEqual(key, expected[0]);
            assert.strictEqual(value, expected[1]);
        }
        assert.strictEqual(i, elements.length);
        const map = new Map();
        for (const [key, value] of elements) {
            map.set(key, value);
        }
        map.forEach((value, key) => {
            assert.strictEqual(trie.get(key), value);
        });
        // forEach
        let forEachCount = 0;
        trie.forEach((element, key) => {
            assert.strictEqual(element, map.get(key));
            forEachCount++;
        });
        assert.strictEqual(map.size, forEachCount);
        // iterator
        let iterCount = 0;
        for (const [key, value] of trie) {
            assert.strictEqual(value, map.get(key));
            iterCount++;
        }
        assert.strictEqual(map.size, iterCount);
    }
    test('TernarySearchTree - set', function () {
        let trie = TernarySearchTree.forStrings();
        trie.set('foobar', 1);
        trie.set('foobaz', 2);
        assertTstDfs(trie, ['foobar', 1], ['foobaz', 2]); // longer
        trie = TernarySearchTree.forStrings();
        trie.set('foobar', 1);
        trie.set('fooba', 2);
        assertTstDfs(trie, ['fooba', 2], ['foobar', 1]); // shorter
        trie = TernarySearchTree.forStrings();
        trie.set('foo', 1);
        trie.set('foo', 2);
        assertTstDfs(trie, ['foo', 2]);
        trie = TernarySearchTree.forStrings();
        trie.set('foo', 1);
        trie.set('foobar', 2);
        trie.set('bar', 3);
        trie.set('foob', 4);
        trie.set('bazz', 5);
        assertTstDfs(trie, ['bar', 3], ['bazz', 5], ['foo', 1], ['foob', 4], ['foobar', 2]);
    });
    test('TernarySearchTree - set w/ undefined', function () {
        const trie = TernarySearchTree.forStrings();
        trie.set('foobar', undefined);
        trie.set('foobaz', 2);
        assert.strictEqual(trie.get('foobar'), undefined);
        assert.strictEqual(trie.get('foobaz'), 2);
        assert.strictEqual(trie.get('NOT HERE'), undefined);
        assert.ok(trie.has('foobaz'));
        assert.ok(trie.has('foobar'));
        assert.ok(!trie.has('NOT HERE'));
        assertTstDfs(trie, ['foobar', undefined], ['foobaz', 2]); // should check for undefined value
        const oldValue = trie.set('foobar', 3);
        assert.strictEqual(oldValue, undefined);
        assert.strictEqual(trie.get('foobar'), 3);
    });
    test('TernarySearchTree - findLongestMatch', function () {
        const trie = TernarySearchTree.forStrings();
        trie.set('foo', 1);
        trie.set('foobar', 2);
        trie.set('foobaz', 3);
        assertTstDfs(trie, ['foo', 1], ['foobar', 2], ['foobaz', 3]);
        assert.strictEqual(trie.findSubstr('f'), undefined);
        assert.strictEqual(trie.findSubstr('z'), undefined);
        assert.strictEqual(trie.findSubstr('foo'), 1);
        assert.strictEqual(trie.findSubstr('fooö'), 1);
        assert.strictEqual(trie.findSubstr('fooba'), 1);
        assert.strictEqual(trie.findSubstr('foobarr'), 2);
        assert.strictEqual(trie.findSubstr('foobazrr'), 3);
    });
    test('TernarySearchTree - basics', function () {
        const trie = new TernarySearchTree(new StringIterator());
        trie.set('foo', 1);
        trie.set('bar', 2);
        trie.set('foobar', 3);
        assertTstDfs(trie, ['bar', 2], ['foo', 1], ['foobar', 3]);
        assert.strictEqual(trie.get('foo'), 1);
        assert.strictEqual(trie.get('bar'), 2);
        assert.strictEqual(trie.get('foobar'), 3);
        assert.strictEqual(trie.get('foobaz'), undefined);
        assert.strictEqual(trie.get('foobarr'), undefined);
        assert.strictEqual(trie.findSubstr('fo'), undefined);
        assert.strictEqual(trie.findSubstr('foo'), 1);
        assert.strictEqual(trie.findSubstr('foooo'), 1);
        trie.delete('foobar');
        trie.delete('bar');
        assert.strictEqual(trie.get('foobar'), undefined);
        assert.strictEqual(trie.get('bar'), undefined);
        trie.set('foobar', 17);
        trie.set('barr', 18);
        assert.strictEqual(trie.get('foobar'), 17);
        assert.strictEqual(trie.get('barr'), 18);
        assert.strictEqual(trie.get('bar'), undefined);
    });
    test('TernarySearchTree - delete & cleanup', function () {
        // normal delete
        let trie = new TernarySearchTree(new StringIterator());
        trie.set('foo', 1);
        trie.set('foobar', 2);
        trie.set('bar', 3);
        assertTstDfs(trie, ['bar', 3], ['foo', 1], ['foobar', 2]);
        trie.delete('foo');
        assertTstDfs(trie, ['bar', 3], ['foobar', 2]);
        trie.delete('foobar');
        assertTstDfs(trie, ['bar', 3]);
        // superstr-delete
        trie = new TernarySearchTree(new StringIterator());
        trie.set('foo', 1);
        trie.set('foobar', 2);
        trie.set('bar', 3);
        trie.set('foobarbaz', 4);
        trie.deleteSuperstr('foo');
        assertTstDfs(trie, ['bar', 3], ['foo', 1]);
        trie = new TernarySearchTree(new StringIterator());
        trie.set('foo', 1);
        trie.set('foobar', 2);
        trie.set('bar', 3);
        trie.set('foobarbaz', 4);
        trie.deleteSuperstr('fo');
        assertTstDfs(trie, ['bar', 3]);
        // trie = new TernarySearchTree<string, number>(new StringIterator());
        // trie.set('foo', 1);
        // trie.set('foobar', 2);
        // trie.set('bar', 3);
        // trie.deleteSuperStr('f');
        // assertTernarySearchTree(trie, ['bar', 3]);
    });
    test('TernarySearchTree (PathSegments) - basics', function () {
        const trie = new TernarySearchTree(new PathIterator());
        trie.set('/user/foo/bar', 1);
        trie.set('/user/foo', 2);
        trie.set('/user/foo/flip/flop', 3);
        assert.strictEqual(trie.get('/user/foo/bar'), 1);
        assert.strictEqual(trie.get('/user/foo'), 2);
        assert.strictEqual(trie.get('/user//foo'), 2);
        assert.strictEqual(trie.get('/user\\foo'), 2);
        assert.strictEqual(trie.get('/user/foo/flip/flop'), 3);
        assert.strictEqual(trie.findSubstr('/user/bar'), undefined);
        assert.strictEqual(trie.findSubstr('/user/foo'), 2);
        assert.strictEqual(trie.findSubstr('\\user\\foo'), 2);
        assert.strictEqual(trie.findSubstr('/user//foo'), 2);
        assert.strictEqual(trie.findSubstr('/user/foo/ba'), 2);
        assert.strictEqual(trie.findSubstr('/user/foo/far/boo'), 2);
        assert.strictEqual(trie.findSubstr('/user/foo/bar'), 1);
        assert.strictEqual(trie.findSubstr('/user/foo/bar/far/boo'), 1);
    });
    test('TernarySearchTree - (AVL) set', function () {
        {
            // rotate left
            const trie = new TernarySearchTree(new PathIterator());
            trie.set('/fileA', 1);
            trie.set('/fileB', 2);
            trie.set('/fileC', 3);
            assertTstDfs(trie, ['/fileA', 1], ['/fileB', 2], ['/fileC', 3]);
        }
        {
            // rotate left (inside middle)
            const trie = new TernarySearchTree(new PathIterator());
            trie.set('/foo/fileA', 1);
            trie.set('/foo/fileB', 2);
            trie.set('/foo/fileC', 3);
            assertTstDfs(trie, ['/foo/fileA', 1], ['/foo/fileB', 2], ['/foo/fileC', 3]);
        }
        {
            // rotate right
            const trie = new TernarySearchTree(new PathIterator());
            trie.set('/fileC', 3);
            trie.set('/fileB', 2);
            trie.set('/fileA', 1);
            assertTstDfs(trie, ['/fileA', 1], ['/fileB', 2], ['/fileC', 3]);
        }
        {
            // rotate right (inside middle)
            const trie = new TernarySearchTree(new PathIterator());
            trie.set('/mid/fileC', 3);
            trie.set('/mid/fileB', 2);
            trie.set('/mid/fileA', 1);
            assertTstDfs(trie, ['/mid/fileA', 1], ['/mid/fileB', 2], ['/mid/fileC', 3]);
        }
        {
            // rotate right, left
            const trie = new TernarySearchTree(new PathIterator());
            trie.set('/fileD', 7);
            trie.set('/fileB', 2);
            trie.set('/fileG', 42);
            trie.set('/fileF', 24);
            trie.set('/fileZ', 73);
            trie.set('/fileE', 15);
            assertTstDfs(trie, ['/fileB', 2], ['/fileD', 7], ['/fileE', 15], ['/fileF', 24], ['/fileG', 42], ['/fileZ', 73]);
        }
        {
            // rotate left, right
            const trie = new TernarySearchTree(new PathIterator());
            trie.set('/fileJ', 42);
            trie.set('/fileZ', 73);
            trie.set('/fileE', 15);
            trie.set('/fileB', 2);
            trie.set('/fileF', 7);
            trie.set('/fileG', 1);
            assertTstDfs(trie, ['/fileB', 2], ['/fileE', 15], ['/fileF', 7], ['/fileG', 1], ['/fileJ', 42], ['/fileZ', 73]);
        }
    });
    test('TernarySearchTree - (BST) delete', function () {
        const trie = new TernarySearchTree(new StringIterator());
        // delete root
        trie.set('d', 1);
        assertTstDfs(trie, ['d', 1]);
        trie.delete('d');
        assertTstDfs(trie);
        // delete node with two element
        trie.clear();
        trie.set('d', 1);
        trie.set('b', 1);
        trie.set('f', 1);
        assertTstDfs(trie, ['b', 1], ['d', 1], ['f', 1]);
        trie.delete('d');
        assertTstDfs(trie, ['b', 1], ['f', 1]);
        // single child node
        trie.clear();
        trie.set('d', 1);
        trie.set('b', 1);
        trie.set('f', 1);
        trie.set('e', 1);
        assertTstDfs(trie, ['b', 1], ['d', 1], ['e', 1], ['f', 1]);
        trie.delete('f');
        assertTstDfs(trie, ['b', 1], ['d', 1], ['e', 1]);
    });
    test('TernarySearchTree - (AVL) delete', function () {
        const trie = new TernarySearchTree(new StringIterator());
        trie.clear();
        trie.set('d', 1);
        trie.set('b', 1);
        trie.set('f', 1);
        trie.set('e', 1);
        trie.set('z', 1);
        assertTstDfs(trie, ['b', 1], ['d', 1], ['e', 1], ['f', 1], ['z', 1]);
        // right, right
        trie.delete('b');
        assertTstDfs(trie, ['d', 1], ['e', 1], ['f', 1], ['z', 1]);
        trie.clear();
        trie.set('d', 1);
        trie.set('c', 1);
        trie.set('f', 1);
        trie.set('a', 1);
        trie.set('b', 1);
        assertTstDfs(trie, ['a', 1], ['b', 1], ['c', 1], ['d', 1], ['f', 1]);
        // left, left
        trie.delete('f');
        assertTstDfs(trie, ['a', 1], ['b', 1], ['c', 1], ['d', 1]);
        // mid
        trie.clear();
        trie.set('a', 1);
        trie.set('ad', 1);
        trie.set('ab', 1);
        trie.set('af', 1);
        trie.set('ae', 1);
        trie.set('az', 1);
        assertTstDfs(trie, ['a', 1], ['ab', 1], ['ad', 1], ['ae', 1], ['af', 1], ['az', 1]);
        trie.delete('ab');
        assertTstDfs(trie, ['a', 1], ['ad', 1], ['ae', 1], ['af', 1], ['az', 1]);
        trie.delete('a');
        assertTstDfs(trie, ['ad', 1], ['ae', 1], ['af', 1], ['az', 1]);
    });
    test('TernarySearchTree: Cannot read property \'1\' of undefined #138284', function () {
        const keys = [
            URI.parse('fake-fs:/C'),
            URI.parse('fake-fs:/A'),
            URI.parse('fake-fs:/D'),
            URI.parse('fake-fs:/B'),
        ];
        const tst = TernarySearchTree.forUris();
        for (const item of keys) {
            tst.set(item, true);
        }
        assert.ok(tst._isBalanced());
        tst.delete(keys[0]);
        assert.ok(tst._isBalanced());
    });
    test('TernarySearchTree: Cannot read property \'1\' of undefined #138284 (simple)', function () {
        const keys = ['C', 'A', 'D', 'B',];
        const tst = TernarySearchTree.forStrings();
        for (const item of keys) {
            tst.set(item, true);
        }
        assertTstDfs(tst, ['A', true], ['B', true], ['C', true], ['D', true]);
        tst.delete(keys[0]);
        assertTstDfs(tst, ['A', true], ['B', true], ['D', true]);
        {
            const tst = TernarySearchTree.forStrings();
            tst.set('C', true);
            tst.set('A', true);
            tst.set('B', true);
            assertTstDfs(tst, ['A', true], ['B', true], ['C', true]);
        }
    });
    test('TernarySearchTree: Cannot read property \'1\' of undefined #138284 (random)', function () {
        for (let round = 10; round >= 0; round--) {
            const keys = [];
            for (let i = 0; i < 100; i++) {
                keys.push(URI.from({ scheme: 'fake-fs', path: randomPath(undefined, undefined, 10) }));
            }
            const tst = TernarySearchTree.forUris();
            try {
                for (const item of keys) {
                    tst.set(item, true);
                    assert.ok(tst._isBalanced(), `SET${item}|${keys.map(String).join()}`);
                }
                for (const item of keys) {
                    tst.delete(item);
                    assert.ok(tst._isBalanced(), `DEL${item}|${keys.map(String).join()}`);
                }
            }
            catch (err) {
                assert.ok(false, `FAILED with keys: ${keys.map(String).join()}`);
            }
        }
    });
    test('https://github.com/microsoft/vscode/issues/227147', function () {
        const raw = `fake-fs:CAOnRvUuxO,fake-fs:1qcbfq54rg,fake-fs:UtDstYUQ56,fake-fs:d5ktqDysll,fake-fs:w5NSAKA4Ch,fake-fs:QcIIIY6WHX,fake-fs:WCedQu9Ogd,fake-fs:cKUC5LunBr,fake-fs:XrIIYjI3HB,fake-fs:xgTkoneFzF,fake-fs:QYkCVx2nYC,fake-fs:ePrIDEKEpJ,fake-fs:nrOPYCW81a,fake-fs:MQbkFLcDsA,fake-fs:wXG8YiOrBI,fake-fs:4tHTWi240D,fake-fs:5uQWjgZGGJ,fake-fs:famP6pZXyx,fake-fs:aB9sUhwP1J,fake-fs:DlS0CssyhG,fake-fs:9vK2k3rL2V,fake-fs:iqWeu7zF6t,fake-fs:8vC6bQX2WH,fake-fs:nFILXMQTRg,fake-fs:miiV72aajE,fake-fs:9VRbqvaw0q,fake-fs:WnEHS1arfZ,fake-fs:Fco75PJ5pM,fake-fs:6CsEpoZ7VW,fake-fs:B2PrCtDpWu,fake-fs:y8Hi94Oekg,fake-fs:wyEjPNa5lo,fake-fs:zw1Ljv0erc,fake-fs:y4KWPUOMx0,fake-fs:1basrPTlTp,fake-fs:5iErr4YM34,fake-fs:Q2TQaujh8Q,fake-fs:QxcYzNNxZw,fake-fs:3QUDHjU55a,fake-fs:23ymf9ggMV,fake-fs:qQhuKFdy29,fake-fs:JuwmxA33oJ,fake-fs:NQeUyfMNUo,fake-fs:2Vo3eR1jxM,fake-fs:NzUXQidwel,fake-fs:aESYKGPxIx,fake-fs:mxLdeJartN,fake-fs:PhSd2xLwVe,fake-fs:9nmWjUUMRz,fake-fs:Wc6a4RsGhn,fake-fs:5a0AlFHALQ,fake-fs:Q93jnNZBxJ,fake-fs:4CuVkbfPSG,fake-fs:mdFlJ7WQva,fake-fs:fgVsaRm1KG,fake-fs:P7UXWiRJYj,fake-fs:q6nz5Q9BEW,fake-fs:1UZmGkvNTn,fake-fs:AKY8cnUQFl,fake-fs:RezYuPU7FD,fake-fs:5zaYc72Bit,fake-fs:yh8FTxFfQq,fake-fs:ayNPgEuc2q,fake-fs:EdOb27cRhF,fake-fs:h4c2uNyI4l,fake-fs:BhzOLNL4JO,fake-fs:HVPTdAMWpS,fake-fs:7K7IlacaZe,fake-fs:iUKJonC5eq,fake-fs:Y9E3NX3eJD,fake-fs:66h80uK32I,fake-fs:gFXpry1Y09,fake-fs:qOqvvXPcu4,fake-fs:UbbLn2NFSJ,fake-fs:TzJ07HsAGz,fake-fs:nQngmvgx4m,fake-fs:6bZQCR8epb,fake-fs:xb3SJKX1bi,fake-fs:GF3DPK4zDj,fake-fs:HmxgAqEegt,fake-fs:yT2OAMQYal,fake-fs:MiVX4VYXHk,fake-fs:QMbsUbjJTI,fake-fs:KzAbDNsmPc,fake-fs:m6CGOwOcdT,fake-fs:0cyHx9zsA3,fake-fs:SIwjWfFLSY,fake-fs:uZSDXCEqLY,fake-fs:HuoTL3nK7k,fake-fs:oyoejYE0CI,fake-fs:56WLhiCxbz,fake-fs:SqYOi0z5sM,fake-fs:LZq3ei28Ez,fake-fs:pTc4pCtwk8,fake-fs:AAJSFf0RHS,fake-fs:up6EHkEbO9,fake-fs:GB1Pesdnxd,fake-fs:Oyvq4Z96S4,fake-fs:rYXrhklgf6,fake-fs:g1HdUkQziH`;
        const keys = raw.split(',').map(value => URI.parse(value, true));
        const tst = TernarySearchTree.forUris();
        for (const item of keys) {
            tst.set(item, true);
            assert.ok(tst._isBalanced(), `SET${item}|${keys.map(String).join()}`);
        }
        const lengthNow = Array.from(tst).length;
        assert.strictEqual(lengthNow, keys.length);
        const keys2 = keys.slice(0);
        for (const [index, item] of keys.entries()) {
            tst.delete(item);
            assert.ok(tst._isBalanced(), `DEL${item}|${keys.map(String).join()}`);
            const idx = keys2.indexOf(item);
            assert.ok(idx >= 0);
            keys2.splice(idx, 1);
            const actualKeys = Array.from(tst).map(value => value[0]);
            assert.strictEqual(actualKeys.length, keys2.length, `FAILED with ${index} -> ${item.toString()}\nWANTED:${keys2.map(String).sort().join()}\nACTUAL:${actualKeys.map(String).sort().join()}`);
        }
        assert.strictEqual(Array.from(tst).length, 0);
    });
    test('TernarySearchTree: Cannot read properties of undefined (reading \'length\'): #161618 (simple)', function () {
        const raw = 'config.debug.toolBarLocation,floating,config.editor.renderControlCharacters,true,config.editor.renderWhitespace,selection,config.files.autoSave,off,config.git.enabled,true,config.notebook.globalToolbar,true,config.terminal.integrated.tabs.enabled,true,config.terminal.integrated.tabs.showActions,singleTerminalOrNarrow,config.terminal.integrated.tabs.showActiveTerminal,singleTerminalOrNarrow,config.workbench.activityBar.visible,true,config.workbench.experimental.settingsProfiles.enabled,true,config.workbench.layoutControl.type,both,config.workbench.sideBar.location,left,config.workbench.statusBar.visible,true';
        const array = raw.split(',');
        const tuples = [];
        for (let i = 0; i < array.length; i += 2) {
            tuples.push([array[i], array[i + 1]]);
        }
        const map = TernarySearchTree.forConfigKeys();
        map.fill(tuples);
        assert.strictEqual([...map].join(), raw);
        assert.ok(map.has('config.editor.renderWhitespace'));
        const len = [...map].length;
        map.delete('config.editor.renderWhitespace');
        assert.ok(map._isBalanced());
        assert.strictEqual([...map].length, len - 1);
    });
    test('TernarySearchTree: Cannot read properties of undefined (reading \'length\'): #161618 (random)', function () {
        const raw = 'config.debug.toolBarLocation,floating,config.editor.renderControlCharacters,true,config.editor.renderWhitespace,selection,config.files.autoSave,off,config.git.enabled,true,config.notebook.globalToolbar,true,config.terminal.integrated.tabs.enabled,true,config.terminal.integrated.tabs.showActions,singleTerminalOrNarrow,config.terminal.integrated.tabs.showActiveTerminal,singleTerminalOrNarrow,config.workbench.activityBar.visible,true,config.workbench.experimental.settingsProfiles.enabled,true,config.workbench.layoutControl.type,both,config.workbench.sideBar.location,left,config.workbench.statusBar.visible,true';
        const array = raw.split(',');
        const tuples = [];
        for (let i = 0; i < array.length; i += 2) {
            tuples.push([array[i], array[i + 1]]);
        }
        for (let round = 100; round >= 0; round--) {
            shuffle(tuples);
            const map = TernarySearchTree.forConfigKeys();
            map.fill(tuples);
            assert.strictEqual([...map].join(), raw);
            assert.ok(map.has('config.editor.renderWhitespace'));
            const len = [...map].length;
            map.delete('config.editor.renderWhitespace');
            assert.ok(map._isBalanced());
            assert.strictEqual([...map].length, len - 1);
        }
    });
    test('TernarySearchTree (PathSegments) - lookup', function () {
        const map = new TernarySearchTree(new PathIterator());
        map.set('/user/foo/bar', 1);
        map.set('/user/foo', 2);
        map.set('/user/foo/flip/flop', 3);
        assert.strictEqual(map.get('/foo'), undefined);
        assert.strictEqual(map.get('/user'), undefined);
        assert.strictEqual(map.get('/user/foo'), 2);
        assert.strictEqual(map.get('/user/foo/bar'), 1);
        assert.strictEqual(map.get('/user/foo/bar/boo'), undefined);
    });
    test('TernarySearchTree (PathSegments) - superstr', function () {
        const map = new TernarySearchTree(new PathIterator());
        map.set('/user/foo/bar', 1);
        map.set('/user/foo', 2);
        map.set('/user/foo/flip/flop', 3);
        map.set('/usr/foo', 4);
        let item;
        let iter = map.findSuperstr('/user');
        item = iter.next();
        assert.strictEqual(item.value[1], 2);
        assert.strictEqual(item.done, false);
        item = iter.next();
        assert.strictEqual(item.value[1], 1);
        assert.strictEqual(item.done, false);
        item = iter.next();
        assert.strictEqual(item.value[1], 3);
        assert.strictEqual(item.done, false);
        item = iter.next();
        assert.strictEqual(item.value, undefined);
        assert.strictEqual(item.done, true);
        iter = map.findSuperstr('/usr');
        item = iter.next();
        assert.strictEqual(item.value[1], 4);
        assert.strictEqual(item.done, false);
        item = iter.next();
        assert.strictEqual(item.value, undefined);
        assert.strictEqual(item.done, true);
        assert.strictEqual(map.findSuperstr('/not'), undefined);
        assert.strictEqual(map.findSuperstr('/us'), undefined);
        assert.strictEqual(map.findSuperstr('/usrr'), undefined);
        assert.strictEqual(map.findSuperstr('/userr'), undefined);
    });
    test('TernarySearchTree (PathSegments) - delete_superstr', function () {
        const map = new TernarySearchTree(new PathIterator());
        map.set('/user/foo/bar', 1);
        map.set('/user/foo', 2);
        map.set('/user/foo/flip/flop', 3);
        map.set('/usr/foo', 4);
        assertTstDfs(map, ['/user/foo', 2], ['/user/foo/bar', 1], ['/user/foo/flip/flop', 3], ['/usr/foo', 4]);
        // not a segment
        map.deleteSuperstr('/user/fo');
        assertTstDfs(map, ['/user/foo', 2], ['/user/foo/bar', 1], ['/user/foo/flip/flop', 3], ['/usr/foo', 4]);
        // delete a segment
        map.set('/user/foo/bar', 1);
        map.set('/user/foo', 2);
        map.set('/user/foo/flip/flop', 3);
        map.set('/usr/foo', 4);
        map.deleteSuperstr('/user/foo');
        assertTstDfs(map, ['/user/foo', 2], ['/usr/foo', 4]);
    });
    test('TernarySearchTree (URI) - basics', function () {
        const trie = new TernarySearchTree(new UriIterator(() => false, () => false));
        trie.set(URI.file('/user/foo/bar'), 1);
        trie.set(URI.file('/user/foo'), 2);
        trie.set(URI.file('/user/foo/flip/flop'), 3);
        assert.strictEqual(trie.get(URI.file('/user/foo/bar')), 1);
        assert.strictEqual(trie.get(URI.file('/user/foo')), 2);
        assert.strictEqual(trie.get(URI.file('/user/foo/flip/flop')), 3);
        assert.strictEqual(trie.findSubstr(URI.file('/user/bar')), undefined);
        assert.strictEqual(trie.findSubstr(URI.file('/user/foo')), 2);
        assert.strictEqual(trie.findSubstr(URI.file('/user/foo/ba')), 2);
        assert.strictEqual(trie.findSubstr(URI.file('/user/foo/far/boo')), 2);
        assert.strictEqual(trie.findSubstr(URI.file('/user/foo/bar')), 1);
        assert.strictEqual(trie.findSubstr(URI.file('/user/foo/bar/far/boo')), 1);
    });
    test('TernarySearchTree (URI) - query parameters', function () {
        const trie = new TernarySearchTree(new UriIterator(() => false, () => true));
        const root = URI.parse('memfs:/?param=1');
        trie.set(root, 1);
        assert.strictEqual(trie.get(URI.parse('memfs:/?param=1')), 1);
        assert.strictEqual(trie.findSubstr(URI.parse('memfs:/?param=1')), 1);
        assert.strictEqual(trie.findSubstr(URI.parse('memfs:/aaa?param=1')), 1);
    });
    test('TernarySearchTree (URI) - lookup', function () {
        const map = new TernarySearchTree(new UriIterator(() => false, () => false));
        map.set(URI.parse('http://foo.bar/user/foo/bar'), 1);
        map.set(URI.parse('http://foo.bar/user/foo?query'), 2);
        map.set(URI.parse('http://foo.bar/user/foo?QUERY'), 3);
        map.set(URI.parse('http://foo.bar/user/foo/flip/flop'), 3);
        assert.strictEqual(map.get(URI.parse('http://foo.bar/foo')), undefined);
        assert.strictEqual(map.get(URI.parse('http://foo.bar/user')), undefined);
        assert.strictEqual(map.get(URI.parse('http://foo.bar/user/foo/bar')), 1);
        assert.strictEqual(map.get(URI.parse('http://foo.bar/user/foo?query')), 2);
        assert.strictEqual(map.get(URI.parse('http://foo.bar/user/foo?Query')), undefined);
        assert.strictEqual(map.get(URI.parse('http://foo.bar/user/foo?QUERY')), 3);
        assert.strictEqual(map.get(URI.parse('http://foo.bar/user/foo/bar/boo')), undefined);
    });
    test('TernarySearchTree (URI) - lookup, casing', function () {
        const map = new TernarySearchTree(new UriIterator(uri => /^https?$/.test(uri.scheme), () => false));
        map.set(URI.parse('http://foo.bar/user/foo/bar'), 1);
        assert.strictEqual(map.get(URI.parse('http://foo.bar/USER/foo/bar')), 1);
        map.set(URI.parse('foo://foo.bar/user/foo/bar'), 1);
        assert.strictEqual(map.get(URI.parse('foo://foo.bar/USER/foo/bar')), undefined);
    });
    test('TernarySearchTree (URI) - superstr', function () {
        const map = new TernarySearchTree(new UriIterator(() => false, () => false));
        map.set(URI.file('/user/foo/bar'), 1);
        map.set(URI.file('/user/foo'), 2);
        map.set(URI.file('/user/foo/flip/flop'), 3);
        map.set(URI.file('/usr/foo'), 4);
        let item;
        let iter = map.findSuperstr(URI.file('/user'));
        item = iter.next();
        assert.strictEqual(item.value[1], 2);
        assert.strictEqual(item.done, false);
        item = iter.next();
        assert.strictEqual(item.value[1], 1);
        assert.strictEqual(item.done, false);
        item = iter.next();
        assert.strictEqual(item.value[1], 3);
        assert.strictEqual(item.done, false);
        item = iter.next();
        assert.strictEqual(item.value, undefined);
        assert.strictEqual(item.done, true);
        iter = map.findSuperstr(URI.file('/usr'));
        item = iter.next();
        assert.strictEqual(item.value[1], 4);
        assert.strictEqual(item.done, false);
        item = iter.next();
        assert.strictEqual(item.value, undefined);
        assert.strictEqual(item.done, true);
        iter = map.findSuperstr(URI.file('/'));
        item = iter.next();
        assert.strictEqual(item.value[1], 2);
        assert.strictEqual(item.done, false);
        item = iter.next();
        assert.strictEqual(item.value[1], 1);
        assert.strictEqual(item.done, false);
        item = iter.next();
        assert.strictEqual(item.value[1], 3);
        assert.strictEqual(item.done, false);
        item = iter.next();
        assert.strictEqual(item.value[1], 4);
        assert.strictEqual(item.done, false);
        item = iter.next();
        assert.strictEqual(item.value, undefined);
        assert.strictEqual(item.done, true);
        assert.strictEqual(map.findSuperstr(URI.file('/not')), undefined);
        assert.strictEqual(map.findSuperstr(URI.file('/us')), undefined);
        assert.strictEqual(map.findSuperstr(URI.file('/usrr')), undefined);
        assert.strictEqual(map.findSuperstr(URI.file('/userr')), undefined);
    });
    test('TernarySearchTree (ConfigKeySegments) - basics', function () {
        const trie = new TernarySearchTree(new ConfigKeysIterator());
        trie.set('config.foo.bar', 1);
        trie.set('config.foo', 2);
        trie.set('config.foo.flip.flop', 3);
        assert.strictEqual(trie.get('config.foo.bar'), 1);
        assert.strictEqual(trie.get('config.foo'), 2);
        assert.strictEqual(trie.get('config.foo.flip.flop'), 3);
        assert.strictEqual(trie.findSubstr('config.bar'), undefined);
        assert.strictEqual(trie.findSubstr('config.foo'), 2);
        assert.strictEqual(trie.findSubstr('config.foo.ba'), 2);
        assert.strictEqual(trie.findSubstr('config.foo.far.boo'), 2);
        assert.strictEqual(trie.findSubstr('config.foo.bar'), 1);
        assert.strictEqual(trie.findSubstr('config.foo.bar.far.boo'), 1);
    });
    test('TernarySearchTree (ConfigKeySegments) - lookup', function () {
        const map = new TernarySearchTree(new ConfigKeysIterator());
        map.set('config.foo.bar', 1);
        map.set('config.foo', 2);
        map.set('config.foo.flip.flop', 3);
        assert.strictEqual(map.get('foo'), undefined);
        assert.strictEqual(map.get('config'), undefined);
        assert.strictEqual(map.get('config.foo'), 2);
        assert.strictEqual(map.get('config.foo.bar'), 1);
        assert.strictEqual(map.get('config.foo.bar.boo'), undefined);
    });
    test('TernarySearchTree (ConfigKeySegments) - superstr', function () {
        const map = new TernarySearchTree(new ConfigKeysIterator());
        map.set('config.foo.bar', 1);
        map.set('config.foo', 2);
        map.set('config.foo.flip.flop', 3);
        map.set('boo', 4);
        let item;
        const iter = map.findSuperstr('config');
        item = iter.next();
        assert.strictEqual(item.value[1], 2);
        assert.strictEqual(item.done, false);
        item = iter.next();
        assert.strictEqual(item.value[1], 1);
        assert.strictEqual(item.done, false);
        item = iter.next();
        assert.strictEqual(item.value[1], 3);
        assert.strictEqual(item.done, false);
        item = iter.next();
        assert.strictEqual(item.value, undefined);
        assert.strictEqual(item.done, true);
        assert.strictEqual(map.findSuperstr('foo'), undefined);
        assert.strictEqual(map.findSuperstr('config.foo.no'), undefined);
        assert.strictEqual(map.findSuperstr('config.foop'), undefined);
    });
    test('TernarySearchTree (ConfigKeySegments) - delete_superstr', function () {
        const map = new TernarySearchTree(new ConfigKeysIterator());
        map.set('config.foo.bar', 1);
        map.set('config.foo', 2);
        map.set('config.foo.flip.flop', 3);
        map.set('boo', 4);
        assertTstDfs(map, ['boo', 4], ['config.foo', 2], ['config.foo.bar', 1], ['config.foo.flip.flop', 3]);
        // not a segment
        map.deleteSuperstr('config.fo');
        assertTstDfs(map, ['boo', 4], ['config.foo', 2], ['config.foo.bar', 1], ['config.foo.flip.flop', 3]);
        // delete a segment
        map.set('config.foo.bar', 1);
        map.set('config.foo', 2);
        map.set('config.foo.flip.flop', 3);
        map.set('config.boo', 4);
        map.deleteSuperstr('config.foo');
        assertTstDfs(map, ['boo', 4], ['config.foo', 2]);
    });
    test('TST, fill', function () {
        const tst = TernarySearchTree.forStrings();
        const keys = ['foo', 'bar', 'bang', 'bazz'];
        Object.freeze(keys);
        tst.fill(true, keys);
        for (const key of keys) {
            assert.ok(tst.get(key), key);
        }
    });
});
suite.skip('TST, perf', function () {
    function createRandomUris(n) {
        const uris = [];
        function randomWord() {
            let result = '';
            const length = 4 + Math.floor(Math.random() * 4);
            for (let i = 0; i < length; i++) {
                result += (Math.random() * 26 + 65).toString(36);
            }
            return result;
        }
        // generate 10000 random words
        const words = [];
        for (let i = 0; i < 10000; i++) {
            words.push(randomWord());
        }
        for (let i = 0; i < n; i++) {
            let len = 4 + Math.floor(Math.random() * 4);
            const segments = [];
            for (; len >= 0; len--) {
                segments.push(words[Math.floor(Math.random() * words.length)]);
            }
            uris.push(URI.from({ scheme: 'file', path: segments.join('/') }));
        }
        return uris;
    }
    let tree;
    let sampleUris = [];
    let candidates = [];
    suiteSetup(() => {
        const len = 50_000;
        sampleUris = createRandomUris(len);
        candidates = [...sampleUris.slice(0, len / 2), ...createRandomUris(len / 2)];
        shuffle(candidates);
    });
    setup(() => {
        tree = TernarySearchTree.forUris();
        for (const uri of sampleUris) {
            tree.set(uri, true);
        }
    });
    const _profile = false;
    function perfTest(name, callback) {
        test(name, function () {
            if (_profile) {
                console.profile(name);
            }
            const sw = new StopWatch();
            callback();
            console.log(name, sw.elapsed());
            if (_profile) {
                console.profileEnd();
            }
        });
    }
    perfTest('TST, clear', function () {
        tree.clear();
    });
    perfTest('TST, insert', function () {
        const insertTree = TernarySearchTree.forUris();
        for (const uri of sampleUris) {
            insertTree.set(uri, true);
        }
    });
    perfTest('TST, lookup', function () {
        let match = 0;
        for (const candidate of candidates) {
            if (tree.has(candidate)) {
                match += 1;
            }
        }
        assert.strictEqual(match, sampleUris.length / 2);
    });
    perfTest('TST, substr', function () {
        let match = 0;
        for (const candidate of candidates) {
            if (tree.findSubstr(candidate)) {
                match += 1;
            }
        }
        assert.strictEqual(match, sampleUris.length / 2);
    });
    perfTest('TST, superstr', function () {
        for (const candidate of candidates) {
            tree.findSuperstr(candidate);
        }
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybmFyeVNlYXJjaHRyZWUudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL3Rlc3QvY29tbW9uL3Rlcm5hcnlTZWFyY2h0cmVlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUNqRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDckQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ3RELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxZQUFZLEVBQUUsY0FBYyxFQUFFLGlCQUFpQixFQUFFLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3JJLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUMxQyxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFckUsS0FBSyxDQUFDLHFCQUFxQixFQUFFLEdBQUcsRUFBRTtJQUVqQyx1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLElBQUksQ0FBQyxjQUFjLEVBQUUsR0FBRyxFQUFFO1FBQ3pCLE1BQU0sSUFBSSxHQUFHLElBQUksWUFBWSxFQUFFLENBQUM7UUFDaEMsSUFBSSxDQUFDLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO1FBRXZDLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3pDLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN6QyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDN0IsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2pDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUM3QixNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFFakMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ1osTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFekMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ1osTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFekMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ1osTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDN0MsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFMUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ1osTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDckMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDMUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ1osTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDckMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFMUMsRUFBRTtRQUNGLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDeEIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFekMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ1osTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDM0MsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsYUFBYSxFQUFFO1FBQ25CLE1BQU0sSUFBSSxHQUFHLElBQUksV0FBVyxDQUFDLEdBQUcsRUFBRSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN2RCxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDO1FBRWxELE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3pDLDJDQUEyQztRQUMzQyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDeEMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDekMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBRVosTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDekMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBRVosTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDekMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBRVosTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDN0MsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFHMUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxDQUFDLENBQUMsQ0FBQztRQUUzRCxTQUFTO1FBQ1QsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDekMsMkNBQTJDO1FBQzNDLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN4QyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN6QyxJQUFJLENBQUMs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QUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFcEIsWUFBWSxDQUFDLElBQUksRUFDaEIsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQ1YsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQ1gsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQ1YsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQ1gsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQ2IsQ0FBQztJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHNDQUFzQyxFQUFFO1FBRTVDLE1BQU0sSUFBSSxHQUFHLGlCQUFpQixDQUFDLFVBQVUsRUFBTyxDQUFDO1FBQ2pELElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQzlCLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRXRCLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUNsRCxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRXBELE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQzlCLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQzlCLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFFakMs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Q0FBQyxDQUFDO1lBQ3RCLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZCLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNsSCxDQUFDO1FBRUQsQ0FBQztZQUNBLHFCQUFxQjtZQUNyQixNQUFNLElBQUksR0FBRyxJQUFJLGlCQUFpQixDQUFpQixJQUFJLFlBQVksRUFBRSxDQUFDLENBQUM7WUFDdkUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDdkIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDdkIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDdkIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDdEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDdEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDdEIsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxF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Q0FBQyxDQUFDO1FBQ2pCLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ2pCLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVyRSxlQUFlO1FBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNqQixZQUFZLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFM0QsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDakIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDakIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDakIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDakIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDakIsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMs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QUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUVyQyxJQUFJLEdBQUcsSUFBSyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3BCLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNyQyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDckMsSUFBSSxHQUFHLElBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNwQixNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDckMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3JDLElBQUksR0FBRyxJQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDcEIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNyQyxJQUFJLEdBQUcsSUFBSyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3BCLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztRQUMxQyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFcEMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDaEMsSUFBSSxHQUFHLElBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNwQixNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDckMs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QUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNuQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUU3QyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzNELE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDdkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRWpFLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDdEUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM5RCxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ2pFLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN0RSxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLENB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O1FBQ3JDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDbkIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQzFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUVwQyxJQUFJLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFFLENBQUM7UUFDM0MsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNuQixNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDckMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXJDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDbkIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQzFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUVwQyxJQUFJLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFFLENBQUM7UUFDeEMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNuQixNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDckMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3JDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDbkIsTUFBTSxDQUFDLFdBQVcsQ0FB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