/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { deepStrictEqual, strictEqual, ok } from 'assert';
import { parse } from '../../common/yaml.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from './utils.js';
function assertValidParse(input, expected, expectedErrors, options) {
    const errors = [];
    const text = input.join('\n');
    const actual1 = parse(text, errors, options);
    deepStrictEqual(actual1, expected);
    deepStrictEqual(errors, expectedErrors);
}
function pos(line, character) {
    return { line, character };
}
suite('YAML Parser', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('scalars', () => {
        test('numbers', () => {
            assertValidParse(['1'], { type: 'number', start: pos(0, 0), end: pos(0, 1), value: 1 }, []);
            assertValidParse(['1.234'], { type: 'number', start: pos(0, 0), end: pos(0, 5), value: 1.234 }, []);
            assertValidParse(['-42'], { type: 'number', start: pos(0, 0), end: pos(0, 3), value: -42 }, []);
        });
        test('boolean', () => {
            assertValidParse(['true'], { type: 'boolean', start: pos(0, 0), end: pos(0, 4), value: true }, []);
            assertValidParse(['false'], { type: 'boolean', start: pos(0, 0), end: pos(0, 5), value: false }, []);
        });
        test('null', () => {
            assertValidParse(['null'], { type: 'null', start: pos(0, 0), end: pos(0, 4), value: null }, []);
            assertValidParse(['~'], { type: 'null', start: pos(0, 0), end: pos(0, 1), value: null }, []);
        });
        test('string', () => {
            assertValidParse(['A Developer'], { type: 'string', start: pos(0, 0), end: pos(0, 11), value: 'A Developer' }, []);
            assertValidParse(['\'A Developer\''], { type: 'string', start: pos(0, 0), end: pos(0, 13), value: 'A Developer' }, []);
            assertValidParse(['"A Developer"'], { type: 'string', start: pos(0, 0), end: pos(0, 13), value: 'A Developer' }, []);
            assertValidParse(['*.js,*.ts'], { type: 'string', start: pos(0, 0), end: pos(0, 9), value: '*.js,*.ts' }, []);
        });
    });
    suite('objects', () => {
        test('simple properties', () => {
            assertValidParse(['name: John Doe'], {
                type: 'object', start: pos(0, 0), end: pos(0, 14), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 4), value: 'name' },
                        value: { type: 'string', start: pos(0, 6), end: pos(0, 14), value: 'John Doe' }
                    }
                ]
            }, []);
            assertValidParse(['age: 30'], {
                type: 'object', start: pos(0, 0), end: pos(0, 7), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 3), value: 'age' },
                        value: { type: 'number', start: pos(0, 5), end: pos(0, 7), value: 30 }
                    }
                ]
            }, []);
            assertValidParse(['active: true'], {
                type: 'object', start: pos(0, 0), end: pos(0, 12), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 6), value: 'active' },
                        value: { type: 'boolean', start: pos(0, 8), end: pos(0, 12), value: true }
                    }
                ]
            }, []);
            assertValidParse(['value: null'], {
                type: 'object', start: pos(0, 0), end: pos(0, 11), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 5), value: 'value' },
                        value: { type: 'null', start: pos(0, 7), end: pos(0, 11), value: null }
                    }
                ]
            }, []);
        });
        test('value on next line', () => {
            assertValidParse([
                'name:',
                '  John Doe',
                'colors:',
                '  [ Red, Green, Blue ]',
            ], {
                type: 'object', start: pos(0, 0), end: pos(3, 22), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 4), value: 'name' },
                        value: { type: 'string', start: pos(1, 2), end: pos(1, 10), value: 'John Doe' }
                    },
                    {
                        key: { type: 'string', start: pos(2, 0), end: pos(2, 6), value: 'colors' },
                        value: {
                            type: 'array', start: pos(3, 2), end: pos(3, 22), items: [
                                { type: 'string', start: pos(3, 4), end: pos(3, 7), value: 'Red' },
                                { type: 'string', start: pos(3, 9), end: pos(3, 14), value: 'Green' },
                                { type: 'string', start: pos(3, 16), end: pos(3, 20), value: 'Blue' }
                            ]
                        }
                    }
                ]
            }, []);
        });
        test('multiple properties', () => {
            assertValidParse([
                'name: John Doe',
                'age: 30'
            ], {
                type: 'object', start: pos(0, 0), end: pos(1, 7), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 4), value: 'name' },
                        value: { type: 'string', start: pos(0, 6), end: pos(0, 14), value: 'John Doe' }
                    },
                    {
                        key: { type: 'string', start: pos(1, 0), end: pos(1, 3), value: 'age' },
                        value: { type: 'number', start: pos(1, 5), end: pos(1, 7), value: 30 }
                    }
                ]
            }, []);
        });
        test('nested object', () => {
            assertValidParse([
                'person:',
                '  name: John Doe',
                '  age: 30'
            ], {
                type: 'object', start: pos(0, 0), end: pos(2, 9), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 6), value: 'person' },
                        value: {
                            type: 'object', start: pos(1, 2), end: pos(2, 9), properties: [
                                {
                                    key: { type: 'string', start: pos(1, 2), end: pos(1, 6), value: 'name' },
                                    value: { type: 'string', start: pos(1, 8), end: pos(1, 16), value: 'John Doe' }
                                },
                                {
                                    key: { type: 'string', start: pos(2, 2), end: pos(2, 5), value: 'age' },
                                    value: { type: 'number', start: pos(2, 7), end: pos(2, 9), value: 30 }
                                }
                            ]
                        }
                    }
                ]
            }, []);
        });
        test('nested objects with address', () => {
            assertValidParse([
                'person:',
                '  name: John Doe',
                '  age: 30',
                '  address:',
                '    street: 123 Main St',
                '    city: Example City'
            ], {
                type: 'object', start: pos(0, 0), end: pos(5, 22), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 6), value: 'person' },
                        value: {
                            type: 'object', start: pos(1, 2), end: pos(5, 22),
                            properties: [
                                {
                                    key: { type: 'string', start: pos(1, 2), end: pos(1, 6), value: 'name' },
                                    value: { type: 'string', start: pos(1, 8), end: pos(1, 16), value: 'John Doe' }
                                },
                                {
                                    key: { type: 'string', start: pos(2, 2), end: pos(2, 5), value: 'age' },
                                    value: { type: 'number', start: pos(2, 7), end: pos(2, 9), value: 30 }
                                },
                                {
                                    key: { type: 'string', start: pos(3, 2), end: pos(3, 9), value: 'address' },
                                    value: {
                                        type: 'object', start: pos(4, 4), end: pos(5, 22), properties: [
                                            {
                                                key: { type: 'string', start: pos(4, 4), end: pos(4, 10), value: 'street' },
                                                value: { type: 'string', start: pos(4, 12), end: pos(4, 23), value: '123 Main St' }
                                            },
                                            {
                                                key: { type: 'string', start: pos(5, 4), end: pos(5, 8), value: 'city' },
                                                value: { type: 'string', start: pos(5, 10), end: pos(5, 22), value: 'Example City' }
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                ]
            }, []);
        });
        test('properties without space after colon', () => {
            assertValidParse(['name:John'], {
                type: 'object', start: pos(0, 0), end: pos(0, 9), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 4), value: 'name' },
                        value: { type: 'string', start: pos(0, 5), end: pos(0, 9), value: 'John' }
                    }
                ]
            }, []);
            // Test mixed: some properties with space, some without
            assertValidParse([
                'config:',
                '  database:',
                '    host:localhost',
                '    port: 5432',
                '    credentials:',
                '      username:admin',
                '      password: secret123'
            ], {
                type: 'object', start: pos(0, 0), end: pos(6, 25), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 6), value: 'config' },
                        value: {
                            type: 'object', start: pos(1, 2), end: pos(6, 25), properties: [
                                {
                                    key: { type: 'string', start: pos(1, 2), end: pos(1, 10), value: 'database' },
                                    value: {
                                        type: 'object', start: pos(2, 4), end: pos(6, 25), properties: [
                                            {
                                                key: { type: 'string', start: pos(2, 4), end: pos(2, 8), value: 'host' },
                                                value: { type: 'string', start: pos(2, 9), end: pos(2, 18), value: 'localhost' }
                                            },
                                            {
                                                key: { type: 'string', start: pos(3, 4), end: pos(3, 8), value: 'port' },
                                                value: { type: 'number', start: pos(3, 10), end: pos(3, 14), value: 5432 }
                                            },
                                            {
                                                key: { type: 'string', start: pos(4, 4), end: pos(4, 15), value: 'credentials' },
                                                value: {
                                                    type: 'object', start: pos(5, 6), end: pos(6, 25), properties: [
                                                        {
                                                            key: { type: 'string', start: pos(5, 6), end: pos(5, 14), value: 'username' },
                                                            value: { type: 'string', start: pos(5, 15), end: pos(5, 20), value: 'admin' }
                                                        },
                                                        {
                                                            key: { type: 'string', start: pos(6, 6), end: pos(6, 14), value: 'password' },
                                                            value: { type: 'string', start: pos(6, 16), end: pos(6, 25), value: 'secret123' }
                                                        }
                                                    ]
                                                }
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                ]
            }, []);
        });
        test('inline objects', () => {
            assertValidParse(['{name: John, age: 30}'], {
                type: 'object', start: pos(0, 0), end: pos(0, 21), properties: [
                    {
                        key: { type: 'string', start: pos(0, 1), end: pos(0, 5), value: 'name' },
                        value: { type: 'string', start: pos(0, 7), end: pos(0, 11), value: 'John' }
                    },
                    {
                        key: { type: 'string', start: pos(0, 13), end: pos(0, 16), value: 'age' },
                        value: { type: 'number', start: pos(0, 18), end: pos(0, 20), value: 30 }
                    }
                ]
            }, []);
            // Test with different data types
            assertValidParse(['{active: true, score: 85.5, role: null}'], {
                type: 'object', start: pos(0, 0), end: pos(0, 39), properties: [
                    {
                        key: { type: 'string', start: pos(0, 1), end: pos(0, 7), value: 'active' },
                        value: { type: 'boolean', start: pos(0, 9), end: pos(0, 13), value: true }
                    },
                    {
                        key: { type: 'string', start: pos(0, 15), end: pos(0, 20), value: 'score' },
                        value: { type: 'number', start: pos(0, 22), end: pos(0, 26), value: 85.5 }
                    },
                    {
                        key: { type: 'string', start: pos(0, 28), end: pos(0, 32), value: 'role' },
                        value: { type: 'null', start: pos(0, 34), end: pos(0, 38), value: null }
                    }
                ]
            }, []);
            // Test empty inline object
            assertValidParse(['{}'], {
                type: 'object', start: pos(0, 0), end: pos(0, 2), properties: []
            }, []);
            // Test inline object with quoted keys and values
            assertValidParse(['{"name": "John Doe", "age": 30}'], {
                type: 'object', start: pos(0, 0), end: pos(0, 31), properties: [
                    {
                        key: { type: 'string', start: pos(0, 1), end: pos(0, 7), value: 'name' },
                        value: { type: 'string', start: pos(0, 9), end: pos(0, 19), value: 'John Doe' }
                    },
                    {
                        key: { type: 'string', start: pos(0, 21), end: pos(0, 26), value: 'age' },
                        value: { type: 'number', start: pos(0, 28), end: pos(0, 30), value: 30 }
                    }
                ]
            }, []);
            // Test inline object without spaces
            assertValidParse(['{name:John,age:30}'], {
                type: 'object', start: pos(0, 0), end: pos(0, 18), properties: [
                    {
                        key: { type: 'string', start: pos(0, 1), end: pos(0, 5), value: 'name' },
                        value: { type: 'string', start: pos(0, 6), end: pos(0, 10), value: 'John' }
                    },
                    {
                        key: { type: 'string', start: pos(0, 11), end: pos(0, 14), value: 'age' },
                        value: { type: 'number', start: pos(0, 15), end: pos(0, 17), value: 30 }
                    }
                ]
            }, []);
            // Test multi-line inline object with internal comment line between properties
            assertValidParse(['{a:1, # comment about b', ' b:2, c:3}'], {
                type: 'object', start: pos(0, 0), end: pos(1, 10), properties: [
                    {
                        key: { type: 'string', start: pos(0, 1), end: pos(0, 2), value: 'a' },
                        value: { type: 'number', start: pos(0, 3), end: pos(0, 4), value: 1 }
                    },
                    {
                        key: { type: 'string', start: pos(1, 1), end: pos(1, 2), value: 'b' },
                        value: { type: 'number', start: pos(1, 3), end: pos(1, 4), value: 2 }
                    },
                    {
                        key: { type: 'string', start: pos(1, 6), end: pos(1, 7), value: 'c' },
                        value: { type: 'number', start: pos(1, 8), end: pos(1, 9), value: 3 }
                    }
                ]
            }, []);
        });
        test('special characters in values', () => {
            // Test values with special characters
            assertValidParse([`key: value with \t special chars`], {
                type: 'object', start: pos(0, 0), end: pos(0, 31), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 3), value: 'key' },
                        value: { type: 'string', start: pos(0, 5), end: pos(0, 31), value: `value with \t special chars` }
                    }
                ]
            }, []);
        });
        test('various whitespace types', () => {
            // Test different types of whitespace
            assertValidParse([`key:\t \t \t value`], {
                type: 'object', start: pos(0, 0), end: pos(0, 15), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 3), value: 'key' },
                        value: { type: 'string', start: pos(0, 10), end: pos(0, 15), value: 'value' }
                    }
                ]
            }, []);
        });
    });
    suite('arrays', () => {
        test('arrays', () => {
            assertValidParse([
                '- Boston Red Sox',
                '- Detroit Tigers',
                '- New York Yankees'
            ], {
                type: 'array', start: pos(0, 0), end: pos(2, 18), items: [
                    { type: 'string', start: pos(0, 2), end: pos(0, 16), value: 'Boston Red Sox' },
                    { type: 'string', start: pos(1, 2), end: pos(1, 16), value: 'Detroit Tigers' },
                    { type: 'string', start: pos(2, 2), end: pos(2, 18), value: 'New York Yankees' }
                ]
            }, []);
        });
        test('inline arrays', () => {
            assertValidParse(['[Apple, Banana, Cherry]'], {
                type: 'array', start: pos(0, 0), end: pos(0, 23), items: [
                    { type: 'string', start: pos(0, 1), end: pos(0, 6), value: 'Apple' },
                    { type: 'string', start: pos(0, 8), end: pos(0, 14), value: 'Banana' },
                    { type: 'string', start: pos(0, 16), end: pos(0, 22), value: 'Cherry' }
                ]
            }, []);
        });
        test('inline array with internal comment line', () => {
            assertValidParse(['[one # comment about two', ',two, three]'], {
                type: 'array', start: pos(0, 0), end: pos(1, 12), items: [
                    { type: 'string', start: pos(0, 1), end: pos(0, 4), value: 'one' },
                    { type: 'string', start: pos(1, 1), end: pos(1, 4), value: 'two' },
                    { type: 'string', start: pos(1, 6), end: pos(1, 11), value: 'three' }
                ]
            }, []);
        });
        test('multi-line inline arrays', () => {
            assertValidParse([
                '[',
                '    geen, ',
                '    yello, red]'
            ], {
                type: 'array', start: pos(0, 0), end: pos(2, 15), items: [
                    { type: 'string', start: pos(1, 4), end: pos(1, 8), value: 'geen' },
                    { type: 'string', start: pos(2, 4), end: pos(2, 9), value: 'yello' },
                    { type: 'string', start: pos(2, 11), end: pos(2, 14), value: 'red' }
                ]
            }, []);
        });
        test('arrays of arrays', () => {
            assertValidParse([
                '-',
                '  - Apple',
                '  - Banana',
                '  - Cherry'
            ], {
                type: 'array', start: pos(0, 0), end: pos(3, 10), items: [
                    {
                        type: 'array', start: pos(1, 2), end: pos(3, 10), items: [
                            { type: 'string', start: pos(1, 4), end: pos(1, 9), value: 'Apple' },
                            { type: 'string', start: pos(2, 4), end: pos(2, 10), value: 'Banana' },
                            { type: 'string', start: pos(3, 4), end: pos(3, 10), value: 'Cherry' }
                        ]
                    }
                ]
            }, []);
        });
        test('inline arrays of inline arrays', () => {
            assertValidParse([
                '[',
                '  [ee], [ff, gg]',
                ']',
            ], {
                type: 'array', start: pos(0, 0), end: pos(2, 1), items: [
                    {
                        type: 'array', start: pos(1, 2), end: pos(1, 6), items: [
                            { type: 'string', start: pos(1, 3), end: pos(1, 5), value: 'ee' },
                        ],
                    },
                    {
                        type: 'array', start: pos(1, 8), end: pos(1, 16), items: [
                            { type: 'string', start: pos(1, 9), end: pos(1, 11), value: 'ff' },
                            { type: 'string', start: pos(1, 13), end: pos(1, 15), value: 'gg' },
                        ],
                    }
                ]
            }, []);
        });
        test('object with array containing single object', () => {
            assertValidParse([
                'items:',
                '- name: John',
                '  age: 30'
            ], {
                type: 'object', start: pos(0, 0), end: pos(2, 9), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 5), value: 'items' },
                        value: {
                            type: 'array', start: pos(1, 0), end: pos(2, 9), items: [
                                {
                                    type: 'object', start: pos(1, 2), end: pos(2, 9), properties: [
                                        {
                                            key: { type: 'string', start: pos(1, 2), end: pos(1, 6), value: 'name' },
                                            value: { type: 'string', start: pos(1, 8), end: pos(1, 12), value: 'John' }
                                        },
                                        {
                                            key: { type: 'string', start: pos(2, 2), end: pos(2, 5), value: 'age' },
                                            value: { type: 'number', start: pos(2, 7), end: pos(2, 9), value: 30 }
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                ]
            }, []);
        });
        test('arrays of objects', () => {
            assertValidParse([
                '-',
                '  name: one',
                '- name: two',
                '-',
                '  name: three'
            ], {
                type: 'array', start: pos(0, 0), end: pos(4, 13), items: [
                    {
                        type: 'object', start: pos(1, 2), end: pos(1, 11), properties: [
                            {
                                key: { type: 'string', start: pos(1, 2), end: pos(1, 6), value: 'name' },
                                value: { type: 'string', start: pos(1, 8), end: pos(1, 11), value: 'one' }
                            }
                        ]
                    },
                    {
                        type: 'object', start: pos(2, 2), end: pos(2, 11), properties: [
                            {
                                key: { type: 'string', start: pos(2, 2), end: pos(2, 6), value: 'name' },
                                value: { type: 'string', start: pos(2, 8), end: pos(2, 11), value: 'two' }
                            }
                        ]
                    },
                    {
                        type: 'object', start: pos(4, 2), end: pos(4, 13), properties: [
                            {
                                key: { type: 'string', start: pos(4, 2), end: pos(4, 6), value: 'name' },
                                value: { type: 'string', start: pos(4, 8), end: pos(4, 13), value: 'three' }
                            }
                        ]
                    }
                ]
            }, []);
        });
    });
    suite('complex structures', () => {
        test('array of objects', () => {
            assertValidParse([
                'products:',
                '  - name: Laptop',
                '    price: 999.99',
                '    in_stock: true',
                '  - name: Mouse',
                '    price: 25.50',
                '    in_stock: false'
            ], {
                type: 'object', start: pos(0, 0), end: pos(6, 19), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 8), value: 'products' },
                        value: {
                            type: 'array', start: pos(1, 2), end: pos(6, 19), items: [
                                {
                                    type: 'object', start: pos(1, 4), end: pos(3, 18), properties: [
                                        {
                                            key: { type: 'string', start: pos(1, 4), end: pos(1, 8), value: 'name' },
                                            value: { type: 'string', start: pos(1, 10), end: pos(1, 16), value: 'Laptop' }
                                        },
                                        {
                                            key: { type: 'string', start: pos(2, 4), end: pos(2, 9), value: 'price' },
                                            value: { type: 'number', start: pos(2, 11), end: pos(2, 17), value: 999.99 }
                                        },
                                        {
                                            key: { type: 'string', start: pos(3, 4), end: pos(3, 12), value: 'in_stock' },
                                            value: { type: 'boolean', start: pos(3, 14), end: pos(3, 18), value: true }
                                        }
                                    ]
                                },
                                {
                                    type: 'object', start: pos(4, 4), end: pos(6, 19), properties: [
                                        {
                                            key: { type: 'string', start: pos(4, 4), end: pos(4, 8), value: 'name' },
                                            value: { type: 'string', start: pos(4, 10), end: pos(4, 15), value: 'Mouse' }
                                        },
                                        {
                                            key: { type: 'string', start: pos(5, 4), end: pos(5, 9), value: 'price' },
                                            value: { type: 'number', start: pos(5, 11), end: pos(5, 16), value: 25.50 }
                                        },
                                        {
                                            key: { type: 'string', start: pos(6, 4), end: pos(6, 12), value: 'in_stock' },
                                            value: { type: 'boolean', start: pos(6, 14), end: pos(6, 19), value: false }
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                ]
            }, []);
        });
        test('inline array mixed primitives', () => {
            assertValidParse(['vals: [1, true, null, "str"]'], {
                type: 'object', start: pos(0, 0), end: pos(0, 28), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 4), value: 'vals' },
                        value: {
                            type: 'array', start: pos(0, 6), end: pos(0, 28), items: [
                                { type: 'number', start: pos(0, 7), end: pos(0, 8), value: 1 },
                                { type: 'boolean', start: pos(0, 10), end: pos(0, 14), value: true },
                                { type: 'null', start: pos(0, 16), end: pos(0, 20), value: null },
                                { type: 'string', start: pos(0, 22), end: pos(0, 27), value: 'str' }
                            ]
                        }
                    }
                ]
            }, []);
        });
        test('mixed inline structures', () => {
            assertValidParse(['config: {env: "prod", settings: [true, 42], debug: false}'], {
                type: 'object', start: pos(0, 0), end: pos(0, 57), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 6), value: 'config' },
                        value: {
                            type: 'object', start: pos(0, 8), end: pos(0, 57), properties: [
                                {
                                    key: { type: 'string', start: pos(0, 9), end: pos(0, 12), value: 'env' },
                                    value: { type: 'string', start: pos(0, 14), end: pos(0, 20), value: 'prod' }
                                },
                                {
                                    key: { type: 'string', start: pos(0, 22), end: pos(0, 30), value: 'settings' },
                                    value: {
                                        type: 'array', start: pos(0, 32), end: pos(0, 42), items: [
                                            { type: 'boolean', start: pos(0, 33), end: pos(0, 37), value: true },
                                            { type: 'number', start: pos(0, 39), end: pos(0, 41), value: 42 }
                                        ]
                                    }
                                },
                                {
                                    key: { type: 'string', start: pos(0, 44), end: pos(0, 49), value: 'debug' },
                                    value: { type: 'boolean', start: pos(0, 51), end: pos(0, 56), value: false }
                                }
                            ]
                        }
                    }
                ]
            }, []);
        });
        test('with comments', () => {
            assertValidParse([
                `# This is a comment`,
                'name: John Doe  # inline comment',
                'age: 30'
            ], {
                type: 'object', start: pos(1, 0), end: pos(2, 7), properties: [
                    {
                        key: { type: 'string', start: pos(1, 0), end: pos(1, 4), value: 'name' },
                        value: { type: 'string', start: pos(1, 6), end: pos(1, 14), value: 'John Doe' }
                    },
                    {
                        key: { type: 'string', start: pos(2, 0), end: pos(2, 3), value: 'age' },
                        value: { type: 'number', start: pos(2, 5), end: pos(2, 7), value: 30 }
                    }
                ]
            }, []);
        });
    });
    suite('edge cases and error handling', () => {
        // Edge cases
        test('duplicate keys error', () => {
            assertValidParse([
                'key: 1',
                'key: 2'
            ], {
                type: 'object', start: pos(0, 0), end: pos(1, 6), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 3), value: 'key' },
                        value: { type: 'number', start: pos(0, 5), end: pos(0, 6), value: 1 }
                    },
                    {
                        key: { type: 'string', start: pos(1, 0), end: pos(1, 3), value: 'key' },
                        value: { type: 'number', start: pos(1, 5), end: pos(1, 6), value: 2 }
                    }
                ]
            }, [
                {
                    message: 'Duplicate key \'key\'',
                    code: 'duplicateKey',
                    start: pos(1, 0),
                    end: pos(1, 3)
                }
            ]);
        });
        test('duplicate keys allowed with option', () => {
            assertValidParse([
                'key: 1',
                'key: 2'
            ], {
                type: 'object', start: pos(0, 0), end: pos(1, 6), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 3), value: 'key' },
                        value: { type: 'number', start: pos(0, 5), end: pos(0, 6), value: 1 }
                    },
                    {
                        key: { type: 'string', start: pos(1, 0), end: pos(1, 3), value: 'key' },
                        value: { type: 'number', start: pos(1, 5), end: pos(1, 6), value: 2 }
                    }
                ]
            }, [], { allowDuplicateKeys: true });
        });
        test('unexpected indentation error with recovery', () => {
            // Parser reports error but still captures the over-indented property.
            assertValidParse([
                'key: 1',
                '    stray: value'
            ], {
                type: 'object', start: pos(0, 0), end: pos(1, 16), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 3), value: 'key' },
                        value: { type: 'number', start: pos(0, 5), end: pos(0, 6), value: 1 }
                    },
                    {
                        key: { type: 'string', start: pos(1, 4), end: pos(1, 9), value: 'stray' },
                        value: { type: 'string', start: pos(1, 11), end: pos(1, 16), value: 'value' }
                    }
                ]
            }, [
                {
                    message: 'Unexpected indentation',
                    code: 'indentation',
                    start: pos(1, 0),
                    end: pos(1, 16)
                }
            ]);
        });
        test('empty values and inline empty array', () => {
            assertValidParse([
                'empty:',
                'array: []'
            ], {
                type: 'object', start: pos(0, 0), end: pos(1, 9), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 5), value: 'empty' },
                        value: { type: 'string', start: pos(0, 6), end: pos(0, 6), value: '' }
                    },
                    {
                        key: { type: 'string', start: pos(1, 0), end: pos(1, 5), value: 'array' },
                        value: { type: 'array', start: pos(1, 7), end: pos(1, 9), items: [] }
                    }
                ]
            }, []);
        });
        test('nested empty objects', () => {
            // Parser should create nodes for both parent and child, with child having empty string value.
            assertValidParse([
                'parent:',
                '  child:'
            ], {
                type: 'object', start: pos(0, 0), end: pos(1, 8), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 6), value: 'parent' },
                        value: {
                            type: 'object', start: pos(1, 2), end: pos(1, 8), properties: [
                                {
                                    key: { type: 'string', start: pos(1, 2), end: pos(1, 7), value: 'child' },
                                    value: { type: 'string', start: pos(1, 8), end: pos(1, 8), value: '' }
                                }
                            ]
                        }
                    }
                ]
            }, []);
        });
        test('empty object with only colons', () => {
            // Test object with empty values
            assertValidParse(['key1:', 'key2:', 'key3:'], {
                type: 'object', start: pos(0, 0), end: pos(2, 5), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 4), value: 'key1' },
                        value: { type: 'string', start: pos(0, 5), end: pos(0, 5), value: '' }
                    },
                    {
                        key: { type: 'string', start: pos(1, 0), end: pos(1, 4), value: 'key2' },
                        value: { type: 'string', start: pos(1, 5), end: pos(1, 5), value: '' }
                    },
                    {
                        key: { type: 'string', start: pos(2, 0), end: pos(2, 4), value: 'key3' },
                        value: { type: 'string', start: pos(2, 5), end: pos(2, 5), value: '' }
                    }
                ]
            }, []);
        });
        test('large input performance', () => {
            // Test that large inputs are handled efficiently
            const input = Array.from({ length: 1000 }, (_, i) => `key${i}: value${i}`);
            const expectedProperties = Array.from({ length: 1000 }, (_, i) => ({
                key: { type: 'string', start: pos(i, 0), end: pos(i, `key${i}`.length), value: `key${i}` },
                value: { type: 'string', start: pos(i, `key${i}: `.length), end: pos(i, `key${i}: value${i}`.length), value: `value${i}` }
            }));
            const start = Date.now();
            assertValidParse(input, {
                type: 'object',
                start: pos(0, 0),
                end: pos(999, 'key999: value999'.length),
                properties: expectedProperties
            }, []);
            const duration = Date.now() - start;
            ok(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
        });
        test('deeply nested structure performance', () => {
            // Test that deeply nested structures are handled efficiently
            const lines = [];
            for (let i = 0; i < 50; i++) {
                const indent = '  '.repeat(i);
                lines.push(`${indent}level${i}:`);
            }
            lines.push('  '.repeat(50) + 'deepValue: reached');
            const start = Date.now();
            const errors = [];
            const result = parse(lines.join('\n'), errors);
            const duration = Date.now() - start;
            ok(result);
            strictEqual(result.type, 'object');
            strictEqual(errors.length, 0);
            ok(duration < 100, `Parsing took ${duration}ms, expected < 100ms`);
        });
        test('malformed array with position issues', () => {
            // Test malformed arrays that might cause position advancement issues
            assertValidParse([
                'key: [',
                '',
                '',
                '',
                ''
            ], {
                type: 'object', start: pos(0, 0), end: pos(5, 0), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 3), value: 'key' },
                        value: { type: 'array', start: pos(0, 5), end: pos(5, 0), items: [] }
                    }
                ]
            }, []);
        });
        test('self-referential like structure', () => {
            // Test structures that might appear self-referential
            assertValidParse([
                'a:',
                '  b:',
                '    a:',
                '      b:',
                '        value: test'
            ], {
                type: 'object', start: pos(0, 0), end: pos(4, 19), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 1), value: 'a' },
                        value: {
                            type: 'object', start: pos(1, 2), end: pos(4, 19), properties: [
                                {
                                    key: { type: 'string', start: pos(1, 2), end: pos(1, 3), value: 'b' },
                                    value: {
                                        type: 'object', start: pos(2, 4), end: pos(4, 19), properties: [
                                            {
                                                key: { type: 'string', start: pos(2, 4), end: pos(2, 5), value: 'a' },
                                                value: {
                                                    type: 'object', start: pos(3, 6), end: pos(4, 19), properties: [
                                                        {
                                                            key: { type: 'string', start: pos(3, 6), end: pos(3, 7), value: 'b' },
                                                            value: {
                                                                type: 'object', start: pos(4, 8), end: pos(4, 19), properties: [
                                                                    {
                                                                        key: { type: 'string', start: pos(4, 8), end: pos(4, 13), value: 'value' },
                                                                        value: { type: 'string', start: pos(4, 15), end: pos(4, 19), value: 'test' }
                                                                    }
                                                                ]
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                ]
            }, []);
        });
        test('array with empty lines', () => {
            // Test arrays spanning multiple lines with empty lines
            assertValidParse(['arr: [', '', 'item1,', '', 'item2', '', ']'], {
                type: 'object', start: pos(0, 0), end: pos(6, 1), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 3), value: 'arr' },
                        value: {
                            type: 'array', start: pos(0, 5), end: pos(6, 1), items: [
                                { type: 'string', start: pos(2, 0), end: pos(2, 5), value: 'item1' },
                                { type: 'string', start: pos(4, 0), end: pos(4, 5), value: 'item2' }
                            ]
                        }
                    }
                ]
            }, []);
        });
        test('whitespace advancement robustness', () => {
            // Test that whitespace advancement works correctly
            assertValidParse([`key:      value`], {
                type: 'object', start: pos(0, 0), end: pos(0, 15), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 3), value: 'key' },
                        value: { type: 'string', start: pos(0, 10), end: pos(0, 15), value: 'value' }
                    }
                ]
            }, []);
        });
        test('missing end quote in string values', () => {
            // Test unclosed double quote - parser treats it as bare string with quote included
            assertValidParse(['name: "John'], {
                type: 'object', start: pos(0, 0), end: pos(0, 11), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 4), value: 'name' },
                        value: { type: 'string', start: pos(0, 6), end: pos(0, 11), value: 'John' }
                    }
                ]
            }, []);
            // Test unclosed single quote - parser treats it as bare string with quote included
            assertValidParse(['description: \'Hello world'], {
                type: 'object', start: pos(0, 0), end: pos(0, 25), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 11), value: 'description' },
                        value: { type: 'string', start: pos(0, 13), end: pos(0, 25), value: 'Hello world' }
                    }
                ]
            }, []);
            // Test unclosed quote in multi-line context
            assertValidParse([
                'data: "incomplete',
                'next: value'
            ], {
                type: 'object', start: pos(0, 0), end: pos(1, 11), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 4), value: 'data' },
                        value: { type: 'string', start: pos(0, 6), end: pos(0, 17), value: 'incomplete' }
                    },
                    {
                        key: { type: 'string', start: pos(1, 0), end: pos(1, 4), value: 'next' },
                        value: { type: 'string', start: pos(1, 6), end: pos(1, 11), value: 'value' }
                    }
                ]
            }, []);
            // Test properly quoted strings for comparison
            assertValidParse(['name: "John"'], {
                type: 'object', start: pos(0, 0), end: pos(0, 12), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 4), value: 'name' },
                        value: { type: 'string', start: pos(0, 6), end: pos(0, 12), value: 'John' }
                    }
                ]
            }, []);
        });
        test('comment in inline array #269078', () => {
            // Test malformed array with comment-like content - should not cause endless loop
            assertValidParse([
                'mode: agent',
                'tools: [#r'
            ], {
                type: 'object', start: pos(0, 0), end: pos(2, 0), properties: [
                    {
                        key: { type: 'string', start: pos(0, 0), end: pos(0, 4), value: 'mode' },
                        value: { type: 'string', start: pos(0, 6), end: pos(0, 11), value: 'agent' }
                    },
                    {
                        key: { type: 'string', start: pos(1, 0), end: pos(1, 5), value: 'tools' },
                        value: { type: 'array', start: pos(1, 7), end: pos(2, 0), items: [] }
                    }
                ]
            }, []);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieWFtbC50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvdGVzdC9jb21tb24veWFtbC50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBQ2hHLE9BQU8sRUFBRSxlQUFlLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUMxRCxPQUFPLEVBQUUsS0FBSyxFQUFvRCxNQUFNLHNCQUFzQixDQUFDO0FBQy9GLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUdyRSxTQUFTLGdCQUFnQixDQUFDLEtBQWUsRUFBRSxRQUFrQixFQUFFLGNBQWdDLEVBQUUsT0FBc0I7SUFDdEgsTUFBTSxNQUFNLEdBQXFCLEVBQUUsQ0FBQztJQUNwQyxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzlCLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzdDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDbkMsZUFBZSxDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUMsQ0FBQztBQUN6QyxDQUFDO0FBRUQsU0FBUyxHQUFHLENBQUMsSUFBWSxFQUFFLFNBQWlCO0lBQzNDLE9BQU8sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLENBQUM7QUFDNUIsQ0FBQztBQUVELEtBQUssQ0FBQyxhQUFhLEVBQUUsR0FBRyxFQUFFO0lBRXpCLHVDQUF1QyxFQUFFLENBQUM7SUFFMUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUU7UUFFckIsSUFBSSxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUU7WUFDcEIsZ0JBQWdCLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzVGLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNwRyxnQkFBZ0IsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNqRyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxTQUFTLEVBQUUsR0FBRyxFQUFFO1lBQ3BCLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNuRyxnQkFBZ0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFD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QUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRTtvQkFDOUQ7d0JBQ0MsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFO3dCQUMxRSxLQUFLLEVBQUU7NEJBQ04sSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUM7NEJBQ2pELFVBQVUsRUFBRTtnQ0FDWDtvQ0FDQyxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUU7b0NBQ3hFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRTtpQ0FDL0U7Z0NBQ0Q7b0NBQ0MsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFO29DQUN2RSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFH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QUNEO2dCQUNDLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFO29CQUM5RDt3QkFDQyxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUU7d0JBQzFFLEtBQUssRUFBRTs0QkFDTixJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRTtnQ0FDOUQ7b0NBQ0MsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFO29DQUM3RSxLQUFLLEVBQUU7d0NBQ04sSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUU7NENBQzlEO2dEQUNDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRTtnREFDeEUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFOzZDQUNoRjs0Q0FDRDtnREFDQyxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUU7Z0RBQ3hFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTs2Q0FDMUU7NENBQ0Q7Z0RBQ0MsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsYUFBYSxFQUFFO2dEQUNoRixLQUFLLEVBQUU7b0RBQ04sSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUU7d0RBQzlEOzREQUNDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVB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QUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsVUFBVSxFQUFFO29CQUM3RDt3QkFDQyxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUU7d0JBQ3pFLEtBQUssRUFBRTs0QkFDTixJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRTtnQ0FDdkQ7b0NBQ0MsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxVQUFVLEVBQUU7d0NBQzdEOzRDQUNDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRTs0Q0FDeEUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFO3lDQUMzRTt3Q0FDRDs0Q0FDQyxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUU7NENBQ3ZFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRTt5Q0FDdEU7cUNBQ0Q7aUNBQ0Q7NkJBQ0Q7eUJBQ0Q7cUJBQ0Q7aUJBQ0Q7YUFDRCxFQUNELEVBQUUsQ0FDRixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsbUJBQW1CLEVBQUUsR0FBRyxFQUFFO1lBQzlCLGdCQUFnQixDQUNmO2dCQUNDLEdBQUc7Z0JBQ0gsYUFBYTtnQkFDYixhQUFhO2dCQUNiLEdBQUc7Z0JBQ0gsZUFBZTthQUNmLEVBQ0Q7Z0JBQ0MsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUU7b0JBQ3hEO3dCQUNDLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFOzRCQUM5RDtnQ0FDQyxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUU7Z0NBQ3hFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRTs2QkFDMUU7eUJBQ0Q7cUJBQ0Q7b0JBQ0Q7d0JBQ0MsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUU7NEJBQzlEO2dDQUNDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRTtnQ0FDeEUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFOzZCQUMxRTt5QkFDRDtxQkFDRDtvQkFDRDt3QkFDQyxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRTs0QkFDOUQ7Z0NBQ0MsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFO2dDQUN4RSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUU7NkJBQzVFO3lCQUNEO3FCQUNEO2lCQUNEO2FBQ0QsRUFDRCxFQUFFLENBQ0YsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxLQUFLLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxFQUFFO1FBRWhDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxHQUFHLEVBQUU7WUFDN0IsZ0JBQWdCLENBQ2Y7Z0JBQ0MsV0FBVztnQkFDWCxrQkFBa0I7Z0JBQ2xCLG1CQUFtQjtnQkFDbkIsb0JBQW9CO2dCQUNwQixpQkFBaUI7Z0JBQ2pCLGtCQUFrQjtnQkFDbEIscUJBQXFCO2FBQ3JCLEVBQ0Q7Z0JBQ0MsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUU7b0JBQzlEO3dCQUNDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRTt3QkFDNUUsS0FBSyxFQUFFOzRCQUNOLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFO2dDQUN4RDtvQ0FDQyxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRTt3Q0FDOUQ7NENBQ0MsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFOzRDQUN4RSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUU7eUNBQzlFO3dDQUNEOzRDQUNDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRTs0Q0FDekUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFO3lDQUM1RTt3Q0FDRDs0Q0FDQyxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUU7NENBQzdFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTt5Q0FDM0U7cUNBQ0Q7aUNBQ0Q7Z0NBQ0Q7b0NBQ0MsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUU7d0NBQzlEOzRDQUNDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRTs0Q0FDeEUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFO3lDQUM3RTt3Q0FDRDs0Q0FDQyxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUU7NENBQ3pFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUs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QUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUU7d0JBQzFFLEtBQUssRUFBRTs0QkFDTixJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRTtnQ0FDOUQ7b0NBQ0MsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFO29DQUN4RSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUU7aUNBQzVFO2dDQUNEO29DQUNDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRTtvQ0FDOUUsS0FBSyxFQUFFO3dDQUNOLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxF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RSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUU7Z0NBQzlEO29DQUNDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRTtvQ0FDckUsS0FBSyxFQUFFO3dDQUNOLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFOzRDQUM5RDtnREFDQyxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUU7Z0RBQ3JFLEtBQUssRUFBRTtvREFDTixJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRTt3REFDOUQ7NERBQ0MsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFOzREQUNyRSxLQUFLLEVBQUU7Z0VBQ04sSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUU7b0VBQzlEO3dFQUNDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRTt3RUFDMUUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFO3FFQUM1RTtpRUFDRDs2REFDRDt5REFDRDtxREFDRDtpREFDRDs2Q0FDRDt5Q0FDRDtxQ0FDRDtpQ0FDRDs2QkFDRDt5QkFDRDtxQkFDRDtpQkFDRDthQUNELEVBQ0QsRUFBRSxDQUNGLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyx3QkFBd0IsRUFBRSxHQUFHLEVBQUU7WUFDbkMsdURBQXVEO1lBQ3ZELGdCQUFnQixDQUNmLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLEVBQzlDO2dCQUNDLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsVUFBVSxFQUFFO29CQUM3RDt3QkFDQyxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUU7d0JBQ3ZFLEtBQUssRUFBRTs0QkFDTixJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRTtnQ0FDdkQsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUU7Z0NBQ3BFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFOzZCQUNwRTt5QkFDRDtxQkFDRDtpQkFDRDthQUNELEVBQ0QsRUFBRSxDQUNGLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxtQ0FBbUMsRUFBRSxHQUFHLEVBQUU7WUFDOUMsbURBQW1EO1lBQ25ELGdCQUFnQixDQUNmLENBQUMsaUJBQWlCLENBQUMsRUFDbkI7Z0JBQ0MsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUU7b0JBQzlEO3dCQUNDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRTt3QkFDdkUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFO3FCQUM3RTtpQkFDRDthQUNELEVBQ0QsRUFBRSxDQUNGLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUdILElBQUksQ0FBQyxvQ0FBb0MsRUFBRSxHQUFHLEVBQUU7WUFDL0MsbUZBQW1GO1lBQ25GLGdCQUFnQixDQUNmLENBQUMsYUFBYSxDQUFDLEVBQ2Y7Z0JBQ0MsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUU7b0JBQzlEO3dCQUNDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRTt3QkFDeEUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFO3FCQUMzRTtpQkFDRDthQUNELEVBQ0QsRUFBRSxDQUNGLENBQUM7WUFFRixtRkFBbUY7WUFDbkYsZ0JBQWdCLENBQ2YsQ0FBQyw0QkFBNEIsQ0FBQyxFQUM5QjtnQkFDQyxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRTtvQkFDOUQ7d0JBQ0MsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsYUFBYSxFQUFFO3dCQUNoRixLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUU7cUJBQ25GO2lCQUNEO2FBQ0QsRUFDRCxFQUFFLENBQ0YsQ0FBQztZQUVGLDRDQUE0QztZQUM1QyxnQkFBZ0IsQ0FDZjtnQkFDQyxtQkFBbUI7Z0JBQ25CLGFBQWE7YUFDYixFQUNEO2dCQUNDLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFO29CQUM5RDt3QkFDQyxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUU7d0JBQ3hFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLFlBQVksRUFBRTtxQkFDakY7b0JBQ0Q7d0JBQ0MsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFO3dCQUN4RSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUU7cUJBQzVFO2lCQUNEO2FBQ0QsRUFDRCxFQUFFLENBQ0YsQ0FBQztZQUVGLDhDQUE4QztZQUM5QyxnQkFBZ0IsQ0FDZixDQUFDLGNBQWMsQ0FBQyxFQUNoQjtnQkFDQyxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRTtvQkFDOUQ7d0JBQ0MsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFO3dCQUN4RSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUU7cUJBQzNFO2lCQUNEO2FBQ0QsRUFDRCxFQUFFLENBQ0YsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGlDQUFpQyxFQUFFLEdBQUcsRUFBRTtZQUM1QyxpRkFBaUY7WUFDakYsZ0JBQWdCLENBQ2Y7Z0JBQ0MsYUFBYTtnQkFDYixZQUFZO2FBQ1osRUFDRDtnQkFDQyxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLFVBQVUsRUFBRTtvQkFDN0Q7d0JBQ0MsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFO3dCQUN4RSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUU7cUJBQzVFO29CQUNEO3dCQUNDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRTt3QkFDekUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFO3FCQUNyRTtpQkFDRDthQUNELEVBQ0QsRUFBRSxDQUNGLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUdKLENBQUMsQ0FBQyxDQUFDO0FBRUosQ0FBQyxDQUFDLENBQUMifQ==