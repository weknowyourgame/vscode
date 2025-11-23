/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { deepStrictEqual, ok, strictEqual } from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { detectLinks, detectLinkSuffixes, getLinkSuffix, removeLinkQueryString, removeLinkSuffix } from '../../browser/terminalLinkParsing.js';
const operatingSystems = [
    3 /* OperatingSystem.Linux */,
    2 /* OperatingSystem.Macintosh */,
    1 /* OperatingSystem.Windows */
];
const osTestPath = {
    [3 /* OperatingSystem.Linux */]: '/test/path/linux',
    [2 /* OperatingSystem.Macintosh */]: '/test/path/macintosh',
    [1 /* OperatingSystem.Windows */]: 'C:\\test\\path\\windows'
};
const osLabel = {
    [3 /* OperatingSystem.Linux */]: '[Linux]',
    [2 /* OperatingSystem.Macintosh */]: '[macOS]',
    [1 /* OperatingSystem.Windows */]: '[Windows]'
};
const testRow = 339;
const testCol = 12;
const testRowEnd = 341;
const testColEnd = 789;
const testLinks = [
    // Simple
    { link: 'foo', prefix: undefined, suffix: undefined, hasRow: false, hasCol: false },
    { link: 'foo:339', prefix: undefined, suffix: ':339', hasRow: true, hasCol: false },
    { link: 'foo:339:12', prefix: undefined, suffix: ':339:12', hasRow: true, hasCol: true },
    { link: 'foo:339:12-789', prefix: undefined, suffix: ':339:12-789', hasRow: true, hasCol: true, hasRowEnd: false, hasColEnd: true },
    { link: 'foo:339.12', prefix: undefined, suffix: ':339.12', hasRow: true, hasCol: true },
    { link: 'foo:339.12-789', prefix: undefined, suffix: ':339.12-789', hasRow: true, hasCol: true, hasRowEnd: false, hasColEnd: true },
    { link: 'foo:339.12-341.789', prefix: undefined, suffix: ':339.12-341.789', hasRow: true, hasCol: true, hasRowEnd: true, hasColEnd: true },
    { link: 'foo#339', prefix: undefined, suffix: '#339', hasRow: true, hasCol: false },
    { link: 'foo#339:12', prefix: undefined, suffix: '#339:12', hasRow: true, hasCol: true },
    { link: 'foo#339:12-789', prefix: undefined, suffix: '#339:12-789', hasRow: true, hasCol: true, hasRowEnd: false, hasColEnd: true },
    { link: 'foo#339.12', prefix: undefined, suffix: '#339.12', hasRow: true, hasCol: true },
    { link: 'foo#339.12-789', prefix: undefined, suffix: '#339.12-789', hasRow: true, hasCol: true, hasRowEnd: false, hasColEnd: true },
    { link: 'foo#339.12-341.789', prefix: undefined, suffix: '#339.12-341.789', hasRow: true, hasCol: true, hasRowEnd: true, hasColEnd: true },
    { link: 'foo 339', prefix: undefined, suffix: ' 339', hasRow: true, hasCol: false },
    { link: 'foo 339:12', prefix: undefined, suffix: ' 339:12', hasRow: true, hasCol: true },
    { link: 'foo 339:12-789', prefix: undefined, suffix: ' 339:12-789', hasRow: true, hasCol: true, hasRowEnd: false, hasColEnd: true },
    { link: 'foo 339.12', prefix: undefined, suffix: ' 339.12', hasRow: true, hasCol: true },
    { link: 'foo 339.12-789', prefix: undefined, suffix: ' 339.12-789', hasRow: true, hasCol: true, hasRowEnd: false, hasColEnd: true },
    { link: 'foo 339.12-341.789', prefix: undefined, suffix: ' 339.12-341.789', hasRow: true, hasCol: true, hasRowEnd: true, hasColEnd: true },
    { link: 'foo, 339', prefix: undefined, suffix: ', 339', hasRow: true, hasCol: false },
    // Double quotes
    { link: '"foo",339', prefix: '"', suffix: '",339', hasRow: true, hasCol: false },
    { link: '"foo",339:12', prefix: '"', suffix: '",339:12', hasRow: true, hasCol: true },
    { link: '"foo",339.12', prefix: '"', suffix: '",339.12', hasRow: true, hasCol: true },
    { link: '"foo", line 339', prefix: '"', suffix: '", line 339', hasRow: true, hasCol: false },
    { link: '"foo", line 339, col 12', prefix: '"', suffix: '", line 339, col 12', hasRow: true, hasCol: true },
    { link: '"foo", line 339, column 12', prefix: '"', suffix: '", line 339, column 12', hasRow: true, hasCol: true },
    { link: '"foo":line 339', prefix: '"', suffix: '":line 339', hasRow: true, hasCol: false },
    { link: '"foo":line 339, col 12', prefix: '"', suffix: '":line 339, col 12', hasRow: true, hasCol: true },
    { link: '"foo":line 339, column 12', prefix: '"', suffix: '":line 339, column 12', hasRow: true, hasCol: true },
    { link: '"foo": line 339', prefix: '"', suffix: '": line 339', hasRow: true, hasCol: false },
    { link: '"foo": line 339, col 12', prefix: '"', suffix: '": line 339, col 12', hasRow: true, hasCol: true },
    { link: '"foo": line 339, column 12', prefix: '"', suffix: '": line 339, column 12', hasRow: true, hasCol: true },
    { link: '"foo" on line 339', prefix: '"', suffix: '" on line 339', hasRow: true, hasCol: false },
    { link: '"foo" on line 339, col 12', prefix: '"', suffix: '" on line 339, col 12', hasRow: true, hasCol: true },
    { link: '"foo" on line 339, column 12', prefix: '"', suffix: '" on line 339, column 12', hasRow: true, hasCol: true },
    { link: '"foo" line 339', prefix: '"', suffix: '" line 339', hasRow: true, hasCol: false },
    { link: '"foo" line 339 column 12', prefix: '"', suffix: '" line 339 column 12', hasRow: true, hasCol: true },
    // Single quotes
    { link: '\'foo\',339', prefix: '\'', suffix: '\',339', hasRow: true, hasCol: false },
    { link: '\'foo\',339:12', prefix: '\'', suffix: '\',339:12', hasRow: true, hasCol: true },
    { link: '\'foo\',339.12', prefix: '\'', suffix: '\',339.12', hasRow: true, hasCol: true },
    { link: '\'foo\', line 339', prefix: '\'', suffix: '\', line 339', hasRow: true, hasCol: false },
    { link: '\'foo\', line 339, col 12', prefix: '\'', suffix: '\', line 339, col 12', hasRow: true, hasCol: true },
    { link: '\'foo\', line 339, column 12', prefix: '\'', suffix: '\', line 339, column 12', hasRow: true, hasCol: true },
    { link: '\'foo\':line 339', prefix: '\'', suffix: '\':line 339', hasRow: true, hasCol: false },
    { link: '\'foo\':line 339, col 12', prefix: '\'', suffix: '\':line 339, col 12', hasRow: true, hasCol: true },
    { link: '\'foo\':line 339, column 12', prefix: '\'', suffix: '\':line 339, column 12', hasRow: true, hasCol: true },
    { link: '\'foo\': line 339', prefix: '\'', suffix: '\': line 339', hasRow: true, hasCol: false },
    { link: '\'foo\': line 339, col 12', prefix: '\'', suffix: '\': line 339, col 12', hasRow: true, hasCol: true },
    { link: '\'foo\': line 339, column 12', prefix: '\'', suffix: '\': line 339, column 12', hasRow: true, hasCol: true },
    { link: '\'foo\' on line 339', prefix: '\'', suffix: '\' on line 339', hasRow: true, hasCol: false },
    { link: '\'foo\' on line 339, col 12', prefix: '\'', suffix: '\' on line 339, col 12', hasRow: true, hasCol: true },
    { link: '\'foo\' on line 339, column 12', prefix: '\'', suffix: '\' on line 339, column 12', hasRow: true, hasCol: true },
    { link: '\'foo\' line 339', prefix: '\'', suffix: '\' line 339', hasRow: true, hasCol: false },
    { link: '\'foo\' line 339 column 12', prefix: '\'', suffix: '\' line 339 column 12', hasRow: true, hasCol: true },
    // No quotes
    { link: 'foo, line 339', prefix: undefined, suffix: ', line 339', hasRow: true, hasCol: false },
    { link: 'foo, line 339, col 12', prefix: undefined, suffix: ', line 339, col 12', hasRow: true, hasCol: true },
    { link: 'foo, line 339, column 12', prefix: undefined, suffix: ', line 339, column 12', hasRow: true, hasCol: true },
    { link: 'foo:line 339', prefix: undefined, suffix: ':line 339', hasRow: true, hasCol: false },
    { link: 'foo:line 339, col 12', prefix: undefined, suffix: ':line 339, col 12', hasRow: true, hasCol: true },
    { link: 'foo:line 339, column 12', prefix: undefined, suffix: ':line 339, column 12', hasRow: true, hasCol: true },
    { link: 'foo: line 339', prefix: undefined, suffix: ': line 339', hasRow: true, hasCol: false },
    { link: 'foo: line 339, col 12', prefix: undefined, suffix: ': line 339, col 12', hasRow: true, hasCol: true },
    { link: 'foo: line 339, column 12', prefix: undefined, suffix: ': line 339, column 12', hasRow: true, hasCol: true },
    { link: 'foo on line 339', prefix: undefined, suffix: ' on line 339', hasRow: true, hasCol: false },
    { link: 'foo on line 339, col 12', prefix: undefined, suffix: ' on line 339, col 12', hasRow: true, hasCol: true },
    { link: 'foo on line 339, column 12', prefix: undefined, suffix: ' on line 339, column 12', hasRow: true, hasCol: true },
    { link: 'foo line 339', prefix: undefined, suffix: ' line 339', hasRow: true, hasCol: false },
    { link: 'foo line 339 column 12', prefix: undefined, suffix: ' line 339 column 12', hasRow: true, hasCol: true },
    // Parentheses
    { link: 'foo(339)', prefix: undefined, suffix: '(339)', hasRow: true, hasCol: false },
    { link: 'foo(339,12)', prefix: undefined, suffix: '(339,12)', hasRow: true, hasCol: true },
    { link: 'foo(339, 12)', prefix: undefined, suffix: '(339, 12)', hasRow: true, hasCol: true },
    { link: 'foo (339)', prefix: undefined, suffix: ' (339)', hasRow: true, hasCol: false },
    { link: 'foo (339,12)', prefix: undefined, suffix: ' (339,12)', hasRow: true, hasCol: true },
    { link: 'foo (339, 12)', prefix: undefined, suffix: ' (339, 12)', hasRow: true, hasCol: true },
    { link: 'foo: (339)', prefix: undefined, suffix: ': (339)', hasRow: true, hasCol: false },
    { link: 'foo: (339,12)', prefix: undefined, suffix: ': (339,12)', hasRow: true, hasCol: true },
    { link: 'foo: (339, 12)', prefix: undefined, suffix: ': (339, 12)', hasRow: true, hasCol: true },
    { link: 'foo(339:12)', prefix: undefined, suffix: '(339:12)', hasRow: true, hasCol: true },
    { link: 'foo (339:12)', prefix: undefined, suffix: ' (339:12)', hasRow: true, hasCol: true },
    // Square brackets
    { link: 'foo[339]', prefix: undefined, suffix: '[339]', hasRow: true, hasCol: false },
    { link: 'foo[339,12]', prefix: undefined, suffix: '[339,12]', hasRow: true, hasCol: true },
    { link: 'foo[339, 12]', prefix: undefined, suffix: '[339, 12]', hasRow: true, hasCol: true },
    { link: 'foo [339]', prefix: undefined, suffix: ' [339]', hasRow: true, hasCol: false },
    { link: 'foo [339,12]', prefix: undefined, suffix: ' [339,12]', hasRow: true, hasCol: true },
    { link: 'foo [339, 12]', prefix: undefined, suffix: ' [339, 12]', hasRow: true, hasCol: true },
    { link: 'foo: [339]', prefix: undefined, suffix: ': [339]', hasRow: true, hasCol: false },
    { link: 'foo: [339,12]', prefix: undefined, suffix: ': [339,12]', hasRow: true, hasCol: true },
    { link: 'foo: [339, 12]', prefix: undefined, suffix: ': [339, 12]', hasRow: true, hasCol: true },
    { link: 'foo[339:12]', prefix: undefined, suffix: '[339:12]', hasRow: true, hasCol: true },
    { link: 'foo [339:12]', prefix: undefined, suffix: ' [339:12]', hasRow: true, hasCol: true },
    // OCaml-style
    { link: '"foo", line 339, character 12', prefix: '"', suffix: '", line 339, character 12', hasRow: true, hasCol: true },
    { link: '"foo", line 339, characters 12-789', prefix: '"', suffix: '", line 339, characters 12-789', hasRow: true, hasCol: true, hasColEnd: true },
    { link: '"foo", lines 339-341', prefix: '"', suffix: '", lines 339-341', hasRow: true, hasCol: false, hasRowEnd: true },
    { link: '"foo", lines 339-341, characters 12-789', prefix: '"', suffix: '", lines 339-341, characters 12-789', hasRow: true, hasCol: true, hasRowEnd: true, hasColEnd: true },
    // Non-breaking space
    { link: 'foo\u00A0339:12', prefix: undefined, suffix: '\u00A0339:12', hasRow: true, hasCol: true },
    { link: '"foo" on line 339,\u00A0column 12', prefix: '"', suffix: '" on line 339,\u00A0column 12', hasRow: true, hasCol: true },
    { link: '\'foo\' on line\u00A0339, column 12', prefix: '\'', suffix: '\' on line\u00A0339, column 12', hasRow: true, hasCol: true },
    { link: 'foo (339,\u00A012)', prefix: undefined, suffix: ' (339,\u00A012)', hasRow: true, hasCol: true },
    { link: 'foo\u00A0[339, 12]', prefix: undefined, suffix: '\u00A0[339, 12]', hasRow: true, hasCol: true },
];
const testLinksWithSuffix = testLinks.filter(e => !!e.suffix);
suite('TerminalLinkParsing', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('removeLinkSuffix', () => {
        for (const testLink of testLinks) {
            test('`' + testLink.link + '`', () => {
                deepStrictEqual(removeLinkSuffix(testLink.link), testLink.suffix === undefined ? testLink.link : testLink.link.replace(testLink.suffix, ''));
            });
        }
    });
    suite('getLinkSuffix', () => {
        for (const testLink of testLinks) {
            test('`' + testLink.link + '`', () => {
                deepStrictEqual(getLinkSuffix(testLink.link), testLink.suffix === undefined ? null : {
                    row: testLink.hasRow ? testRow : undefined,
                    col: testLink.hasCol ? testCol : undefined,
                    rowEnd: testLink.hasRowEnd ? testRowEnd : undefined,
                    colEnd: testLink.hasColEnd ? testColEnd : undefined,
                    suffix: {
                        index: testLink.link.length - testLink.suffix.length,
                        text: testLink.suffix
                    }
                });
            });
        }
    });
    suite('detectLinkSuffixes', () => {
        for (const testLink of testLinks) {
            test('`' + testLink.link + '`', () => {
                deepStrictEqual(detectLinkSuffixes(testLink.link), testLink.suffix === undefined ? [] : [{
                        row: testLink.hasRow ? testRow : undefined,
                        col: testLink.hasCol ? testCol : undefined,
                        rowEnd: testLink.hasRowEnd ? testRowEnd : undefined,
                        colEnd: testLink.hasColEnd ? testColEnd : undefined,
                        suffix: {
                            index: testLink.link.length - testLink.suffix.length,
                            text: testLink.suffix
                        }
                    }]);
            });
        }
        test('foo(1, 2) bar[3, 4] baz on line 5', () => {
            deepStrictEqual(detectLinkSuffixes('foo(1, 2) bar[3, 4] baz on line 5'), [
                {
                    col: 2,
                    row: 1,
                    rowEnd: undefined,
                    colEnd: undefined,
                    suffix: {
                        index: 3,
                        text: '(1, 2)'
                    }
                },
                {
                    col: 4,
                    row: 3,
                    rowEnd: undefined,
                    colEnd: undefined,
                    suffix: {
                        index: 13,
                        text: '[3, 4]'
                    }
                },
                {
                    col: undefined,
                    row: 5,
                    rowEnd: undefined,
                    colEnd: undefined,
                    suffix: {
                        index: 23,
                        text: ' on line 5'
                    }
                }
            ]);
        });
    });
    suite('removeLinkQueryString', () => {
        test('should remove any query string from the link', () => {
            strictEqual(removeLinkQueryString('?a=b'), '');
            strictEqual(removeLinkQueryString('foo?a=b'), 'foo');
            strictEqual(removeLinkQueryString('./foo?a=b'), './foo');
            strictEqual(removeLinkQueryString('/foo/bar?a=b'), '/foo/bar');
            strictEqual(removeLinkQueryString('foo?a=b?'), 'foo');
            strictEqual(removeLinkQueryString('foo?a=b&c=d'), 'foo');
        });
        test('should respect ? in UNC paths', () => {
            strictEqual(removeLinkQueryString('\\\\?\\foo?a=b'), '\\\\?\\foo');
        });
    });
    suite('detectLinks', () => {
        test('foo(1, 2) bar[3, 4] "baz" on line 5', () => {
            deepStrictEqual(detectLinks('foo(1, 2) bar[3, 4] "baz" on line 5', 3 /* OperatingSystem.Linux */), [
                {
                    path: {
                        index: 0,
                        text: 'foo'
                    },
                    prefix: undefined,
                    suffix: {
                        col: 2,
                        row: 1,
                        rowEnd: undefined,
                        colEnd: undefined,
                        suffix: {
                            index: 3,
                            text: '(1, 2)'
                        }
                    }
                },
                {
                    path: {
                        index: 10,
                        text: 'bar'
                    },
                    prefix: undefined,
                    suffix: {
                        col: 4,
                        row: 3,
                        rowEnd: undefined,
                        colEnd: undefined,
                        suffix: {
                            index: 13,
                            text: '[3, 4]'
                        }
                    }
                },
                {
                    path: {
                        index: 21,
                        text: 'baz'
                    },
                    prefix: {
                        index: 20,
                        text: '"'
                    },
                    suffix: {
                        col: undefined,
                        row: 5,
                        rowEnd: undefined,
                        colEnd: undefined,
                        suffix: {
                            index: 24,
                            text: '" on line 5'
                        }
                    }
                }
            ]);
        });
        test('should detect multiple links when opening brackets are in the text', () => {
            deepStrictEqual(detectLinks('notlink[foo:45]', 3 /* OperatingSystem.Linux */), [
                {
                    path: {
                        index: 0,
                        text: 'notlink[foo'
                    },
                    prefix: undefined,
                    suffix: {
                        col: undefined,
                        row: 45,
                        rowEnd: undefined,
                        colEnd: undefined,
                        suffix: {
                            index: 11,
                            text: ':45'
                        }
                    }
                },
                {
                    path: {
                        index: 8,
                        text: 'foo'
                    },
                    prefix: undefined,
                    suffix: {
                        col: undefined,
                        row: 45,
                        rowEnd: undefined,
                        colEnd: undefined,
                        suffix: {
                            index: 11,
                            text: ':45'
                        }
                    }
                },
            ]);
        });
        test('should extract the link prefix', () => {
            deepStrictEqual(detectLinks('"foo", line 5, col 6', 3 /* OperatingSystem.Linux */), [
                {
                    path: {
                        index: 1,
                        text: 'foo'
                    },
                    prefix: {
                        index: 0,
                        text: '"',
                    },
                    suffix: {
                        row: 5,
                        col: 6,
                        rowEnd: undefined,
                        colEnd: undefined,
                        suffix: {
                            index: 4,
                            text: '", line 5, col 6'
                        }
                    }
                },
            ]);
        });
        test('should be smart about determining the link prefix when multiple prefix characters exist', () => {
            deepStrictEqual(detectLinks('echo \'"foo", line 5, col 6\'', 3 /* OperatingSystem.Linux */), [
                {
                    path: {
                        index: 7,
                        text: 'foo'
                    },
                    prefix: {
                        index: 6,
                        text: '"',
                    },
                    suffix: {
                        row: 5,
                        col: 6,
                        rowEnd: undefined,
                        colEnd: undefined,
                        suffix: {
                            index: 10,
                            text: '", line 5, col 6'
                        }
                    }
                },
            ], 'The outer single quotes should be excluded from the link prefix and suffix');
        });
        test('should detect both suffix and non-suffix links on a single line', () => {
            deepStrictEqual(detectLinks('PS C:\\Github\\microsoft\\vscode> echo \'"foo", line 5, col 6\'', 1 /* OperatingSystem.Windows */), [
                {
                    path: {
                        index: 3,
                        text: 'C:\\Github\\microsoft\\vscode'
                    },
                    prefix: undefined,
                    suffix: undefined
                },
                {
                    path: {
                        index: 38,
                        text: 'foo'
                    },
                    prefix: {
                        index: 37,
                        text: '"',
                    },
                    suffix: {
                        row: 5,
                        col: 6,
                        rowEnd: undefined,
                        colEnd: undefined,
                        suffix: {
                            index: 41,
                            text: '", line 5, col 6'
                        }
                    }
                }
            ]);
        });
        suite('"|"', () => {
            test('should exclude pipe characters from link paths', () => {
                deepStrictEqual(detectLinks('|C:\\Github\\microsoft\\vscode|', 1 /* OperatingSystem.Windows */), [
                    {
                        path: {
                            index: 1,
                            text: 'C:\\Github\\microsoft\\vscode'
                        },
                        prefix: undefined,
                        suffix: undefined
                    }
                ]);
            });
            test('should exclude pipe characters from link paths with suffixes', () => {
                deepStrictEqual(detectLinks('|C:\\Github\\microsoft\\vscode:400|', 1 /* OperatingSystem.Windows */), [
                    {
                        path: {
                            index: 1,
                            text: 'C:\\Github\\microsoft\\vscode'
                        },
                        prefix: undefined,
                        suffix: {
                            col: undefined,
                            row: 400,
                            rowEnd: undefined,
                            colEnd: undefined,
                            suffix: {
                                index: 27,
                                text: ':400'
                            }
                        }
                    }
                ]);
            });
        });
        suite('"<>"', () => {
            for (const os of operatingSystems) {
                test(`should exclude bracket characters from link paths ${osLabel[os]}`, () => {
                    deepStrictEqual(detectLinks(`<${osTestPath[os]}<`, os), [
                        {
                            path: {
                                index: 1,
                                text: osTestPath[os]
                            },
                            prefix: undefined,
                            suffix: undefined
                        }
                    ]);
                    deepStrictEqual(detectLinks(`>${osTestPath[os]}>`, os), [
                        {
                            path: {
                                index: 1,
                                text: osTestPath[os]
                            },
                            prefix: undefined,
                            suffix: undefined
                        }
                    ]);
                });
                test(`should exclude bracket characters from link paths with suffixes ${osLabel[os]}`, () => {
                    deepStrictEqual(detectLinks(`<${osTestPath[os]}:400<`, os), [
                        {
                            path: {
                                index: 1,
                                text: osTestPath[os]
                            },
                            prefix: undefined,
                            suffix: {
                                col: undefined,
                                row: 400,
                                rowEnd: undefined,
                                colEnd: undefined,
                                suffix: {
                                    index: 1 + osTestPath[os].length,
                                    text: ':400'
                                }
                            }
                        }
                    ]);
                    deepStrictEqual(detectLinks(`>${osTestPath[os]}:400>`, os), [
                        {
                            path: {
                                index: 1,
                                text: osTestPath[os]
                            },
                            prefix: undefined,
                            suffix: {
                                col: undefined,
                                row: 400,
                                rowEnd: undefined,
                                colEnd: undefined,
                                suffix: {
                                    index: 1 + osTestPath[os].length,
                                    text: ':400'
                                }
                            }
                        }
                    ]);
                });
            }
        });
        suite('query strings', () => {
            for (const os of operatingSystems) {
                test(`should exclude query strings from link paths ${osLabel[os]}`, () => {
                    deepStrictEqual(detectLinks(`${osTestPath[os]}?a=b`, os), [
                        {
                            path: {
                                index: 0,
                                text: osTestPath[os]
                            },
                            prefix: undefined,
                            suffix: undefined
                        }
                    ]);
                    deepStrictEqual(detectLinks(`${osTestPath[os]}?a=b&c=d`, os), [
                        {
                            path: {
                                index: 0,
                                text: osTestPath[os]
                            },
                            prefix: undefined,
                            suffix: undefined
                        }
                    ]);
                });
                test('should not detect links starting with ? within query strings that contain posix-style paths (#204195)', () => {
                    // ? appended to the cwd will exist since it's just the cwd
                    strictEqual(detectLinks(`http://foo.com/?bar=/a/b&baz=c`, os).some(e => e.path.text.startsWith('?')), false);
                });
                test('should not detect links starting with ? within query strings that contain Windows-style paths (#204195)', () => {
                    // ? appended to the cwd will exist since it's just the cwd
                    strictEqual(detectLinks(`http://foo.com/?bar=a:\\b&baz=c`, os).some(e => e.path.text.startsWith('?')), false);
                });
            }
        });
        suite('should detect file names in git diffs', () => {
            test('--- a/foo/bar', () => {
                deepStrictEqual(detectLinks('--- a/foo/bar', 3 /* OperatingSystem.Linux */), [
                    {
                        path: {
                            index: 6,
                            text: 'foo/bar'
                        },
                        prefix: undefined,
                        suffix: undefined
                    }
                ]);
            });
            test('+++ b/foo/bar', () => {
                deepStrictEqual(detectLinks('+++ b/foo/bar', 3 /* OperatingSystem.Linux */), [
                    {
                        path: {
                            index: 6,
                            text: 'foo/bar'
                        },
                        prefix: undefined,
                        suffix: undefined
                    }
                ]);
            });
            test('diff --git a/foo/bar b/foo/baz', () => {
                deepStrictEqual(detectLinks('diff --git a/foo/bar b/foo/baz', 3 /* OperatingSystem.Linux */), [
                    {
                        path: {
                            index: 13,
                            text: 'foo/bar'
                        },
                        prefix: undefined,
                        suffix: undefined
                    },
                    {
                        path: {
                            index: 23,
                            text: 'foo/baz'
                        },
                        prefix: undefined,
                        suffix: undefined
                    }
                ]);
            });
        });
        suite('should detect 3 suffix links on a single line', () => {
            for (let i = 0; i < testLinksWithSuffix.length - 2; i++) {
                const link1 = testLinksWithSuffix[i];
                const link2 = testLinksWithSuffix[i + 1];
                const link3 = testLinksWithSuffix[i + 2];
                const line = ` ${link1.link} ${link2.link} ${link3.link} `;
                test('`' + line.replaceAll('\u00A0', '<nbsp>') + '`', () => {
                    strictEqual(detectLinks(line, 3 /* OperatingSystem.Linux */).length, 3);
                    ok(link1.suffix);
                    ok(link2.suffix);
                    ok(link3.suffix);
                    const detectedLink1 = {
                        prefix: link1.prefix ? {
                            index: 1,
                            text: link1.prefix
                        } : undefined,
                        path: {
                            index: 1 + (link1.prefix?.length ?? 0),
                            text: link1.link.replace(link1.suffix, '').replace(link1.prefix || '', '')
                        },
                        suffix: {
                            row: link1.hasRow ? testRow : undefined,
                            col: link1.hasCol ? testCol : undefined,
                            rowEnd: link1.hasRowEnd ? testRowEnd : undefined,
                            colEnd: link1.hasColEnd ? testColEnd : undefined,
                            suffix: {
                                index: 1 + (link1.link.length - link1.suffix.length),
                                text: link1.suffix
                            }
                        }
                    };
                    const detectedLink2 = {
                        prefix: link2.prefix ? {
                            index: (detectedLink1.prefix?.index ?? detectedLink1.path.index) + link1.link.length + 1,
                            text: link2.prefix
                        } : undefined,
                        path: {
                            index: (detectedLink1.prefix?.index ?? detectedLink1.path.index) + link1.link.length + 1 + (link2.prefix ?? '').length,
                            text: link2.link.replace(link2.suffix, '').replace(link2.prefix ?? '', '')
                        },
                        suffix: {
                            row: link2.hasRow ? testRow : undefined,
                            col: link2.hasCol ? testCol : undefined,
                            rowEnd: link2.hasRowEnd ? testRowEnd : undefined,
                            colEnd: link2.hasColEnd ? testColEnd : undefined,
                            suffix: {
                                index: (detectedLink1.prefix?.index ?? detectedLink1.path.index) + link1.link.length + 1 + (link2.link.length - link2.suffix.length),
                                text: link2.suffix
                            }
                        }
                    };
                    const detectedLink3 = {
                        prefix: link3.prefix ? {
                            index: (detectedLink2.prefix?.index ?? detectedLink2.path.index) + link2.link.length + 1,
                            text: link3.prefix
                        } : undefined,
                        path: {
                            index: (detectedLink2.prefix?.index ?? detectedLink2.path.index) + link2.link.length + 1 + (link3.prefix ?? '').length,
                            text: link3.link.replace(link3.suffix, '').replace(link3.prefix ?? '', '')
                        },
                        suffix: {
                            row: link3.hasRow ? testRow : undefined,
                            col: link3.hasCol ? testCol : undefined,
                            rowEnd: link3.hasRowEnd ? testRowEnd : undefined,
                            colEnd: link3.hasColEnd ? testColEnd : undefined,
                            suffix: {
                                index: (detectedLink2.prefix?.index ?? detectedLink2.path.index) + link2.link.length + 1 + (link3.link.length - link3.suffix.length),
                                text: link3.suffix
                            }
                        }
                    };
                    deepStrictEqual(detectLinks(line, 3 /* OperatingSystem.Linux */), [detectedLink1, detectedLink2, detectedLink3]);
                });
            }
        });
        suite('should ignore links with suffixes when the path itself is the empty string', () => {
            deepStrictEqual(detectLinks('""",1', 3 /* OperatingSystem.Linux */), []);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxMaW5rUGFyc2luZy50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9saW5rcy90ZXN0L2Jyb3dzZXIvdGVybWluYWxMaW5rUGFyc2luZy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxlQUFlLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUUxRCxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN0RyxPQUFPLEVBQUUsV0FBVyxFQUFFLGtCQUFrQixFQUFFLGFBQWEsRUFBZSxxQkFBcUIsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBYTVKLE1BQU0sZ0JBQWdCLEdBQW1DOzs7O0NBSXhELENBQUM7QUFDRixNQUFNLFVBQVUsR0FBZ0Q7SUFDL0QsK0JBQXVCLEVBQUUsa0JBQWtCO0lBQzNDLG1DQUEyQixFQUFFLHNCQUFzQjtJQUNuRCxpQ0FBeUIsRUFBRSx5QkFBeUI7Q0FDcEQsQ0FBQztBQUNGLE1BQU0sT0FBTyxHQUFnRDtJQUM1RCwrQkFBdUIsRUFBRSxTQUFTO0lBQ2xDLG1DQUEyQixFQUFFLFNBQVM7SUFDdEMsaUNBQXlCLEVBQUUsV0FBVztDQUN0QyxDQUFDO0FBRUYsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDO0FBQ3BCLE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQztBQUNuQixNQUFNLFVBQVUsR0FBRyxHQUFHLENBQUM7QUFDdkIsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDO0FBQ3ZCLE1BQU0sU0FBUyxHQUFnQjtJQUM5QixTQUFTO0lBQ1QsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUU7SUFDbkYsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUU7SUFDbkYsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUU7SUFDeEYsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUU7SUFDbkksRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUU7SUFDeEYsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUU7SUFDbkksRUFBRSxJQUFJLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRTtJQUMxSSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRTtJQUNuRixFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtJQUN4RixFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRTtJQUNuSSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtJQUN4RixFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRTtJQUNuSSxFQUFFLElBQUksRUFBRSxvQkFBb0IsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFO0lBQzFJLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFO0lBQ25GLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxT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QUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRTtJQUNyRixFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtJQUMxRixFQUFFLElBQUksRUFBRSxjQUFjLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtJQUM1RixFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRTtJQUN2RixFQUFFLElBQUksRUFBRSxjQUFjLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtJQUM1RixFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtJQUM5RixFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRTtJQUN6RixFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtJQUM5RixFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFO0lBQ2hHLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFO0lBQzFGLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFO0lBRTVGLGtCQUFrQjtJQUNsQixFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRTtJQUNyRixFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtJQUMxRixFQUFFLElBQUksRUFBRSxjQUFjLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtJQUM1RixFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRTtJQUN2RixFQUFFLElBQUksRUFBRSxjQUFjLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtJQUM1RixFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsWUFBWSxF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