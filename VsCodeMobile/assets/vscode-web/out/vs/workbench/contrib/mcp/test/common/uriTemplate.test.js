/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { UriTemplate } from '../../common/uriTemplate.js';
import * as assert from 'assert';
suite('UriTemplate', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    /**
     * Helper function to test template parsing and component extraction
     */
    function testParsing(template, expectedComponents) {
        const templ = UriTemplate.parse(template);
        assert.deepStrictEqual(templ.components.filter(c => typeof c === 'object'), expectedComponents);
        return templ;
    }
    /**
     * Helper function to test template resolution
     */
    function testResolution(template, variables, expected) {
        const templ = UriTemplate.parse(template);
        const result = templ.resolve(variables);
        assert.strictEqual(result, expected);
    }
    test('simple replacement', () => {
        const templ = UriTemplate.parse('http://example.com/{var}');
        assert.deepStrictEqual(templ.components, ['http://example.com/', {
                expression: '{var}',
                operator: '',
                variables: [{ explodable: false, name: 'var', optional: false, prefixLength: undefined, repeatable: false }]
            }, '']);
        const result = templ.resolve({ var: 'value' });
        assert.strictEqual(result, 'http://example.com/value');
    });
    test('parsing components correctly', () => {
        // Simple component
        testParsing('http://example.com/{var}', [{
                expression: '{var}',
                operator: '',
                variables: [{ explodable: false, name: 'var', optional: false, prefixLength: undefined, repeatable: false }]
            }]);
        // Component with operator
        testParsing('http://example.com/{+path}', [{
                expression: '{+path}',
                operator: '+',
                variables: [{ explodable: false, name: 'path', optional: false, prefixLength: undefined, repeatable: false }]
            }]);
        // Component with multiple variables
        testParsing('http://example.com/{x,y}', [{
                expression: '{x,y}',
                operator: '',
                variables: [
                    { explodable: false, name: 'x', optional: false, prefixLength: undefined, repeatable: false },
                    { explodable: false, name: 'y', optional: false, prefixLength: undefined, repeatable: false }
                ]
            }]);
        // Component with value modifiers
        testParsing('http://example.com/{var:3}', [{
                expression: '{var:3}',
                operator: '',
                variables: [{ explodable: false, name: 'var', optional: false, prefixLength: 3, repeatable: false }]
            }]);
        testParsing('http://example.com/{list*}', [{
                expression: '{list*}',
                operator: '',
                variables: [{ explodable: true, name: 'list', optional: false, prefixLength: undefined, repeatable: true }]
            }]);
        // Multiple components
        testParsing('http://example.com/{x}/path/{y}', [
            {
                expression: '{x}',
                operator: '',
                variables: [{ explodable: false, name: 'x', optional: false, prefixLength: undefined, repeatable: false }]
            },
            {
                expression: '{y}',
                operator: '',
                variables: [{ explodable: false, name: 'y', optional: false, prefixLength: undefined, repeatable: false }]
            }
        ]);
    });
    test('Level 1 - Simple string expansion', () => {
        // Test cases from RFC 6570 Section 1.2
        const variables = {
            var: 'value',
            hello: 'Hello World!'
        };
        testResolution('{var}', variables, 'value');
        testResolution('{hello}', variables, 'Hello%20World%21');
    });
    test('Level 2 - Reserved expansion', () => {
        // Test cases from RFC 6570 Section 1.2
        const variables = {
            var: 'value',
            hello: 'Hello World!',
            path: '/foo/bar'
        };
        testResolution('{+var}', variables, 'value');
        testResolution('{+hello}', variables, 'Hello%20World!');
        testResolution('{+path}/here', variables, '/foo/bar/here');
        testResolution('here?ref={+path}', variables, 'here?ref=/foo/bar');
    });
    test('Level 2 - Fragment expansion', () => {
        // Test cases from RFC 6570 Section 1.2
        const variables = {
            var: 'value',
            hello: 'Hello World!'
        };
        testResolution('X{#var}', variables, 'X#value');
        testResolution('X{#hello}', variables, 'X#Hello%20World!');
    });
    test('Level 3 - String expansion with multiple variables', () => {
        // Test cases from RFC 6570 Section 1.2
        const variables = {
            var: 'value',
            hello: 'Hello World!',
            empty: '',
            path: '/foo/bar',
            x: '1024',
            y: '768'
        };
        testResolution('map?{x,y}', variables, 'map?1024,768');
        testResolution('{x,hello,y}', variables, '1024,Hello%20World%21,768');
    });
    test('Level 3 - Reserved expansion with multiple variables', () => {
        // Test cases from RFC 6570 Section 1.2
        const variables = {
            var: 'value',
            hello: 'Hello World!',
            path: '/foo/bar',
            x: '1024',
            y: '768'
        };
        testResolution('{+x,hello,y}', variables, '1024,Hello%20World!,768');
        testResolution('{+path,x}/here', variables, '/foo/bar,1024/here');
    });
    test('Level 3 - Fragment expansion with multiple variables', () => {
        // Test cases from RFC 6570 Section 1.2
        const variables = {
            var: 'value',
            hello: 'Hello World!',
            path: '/foo/bar',
            x: '1024',
            y: '768'
        };
        testResolution('{#x,hello,y}', variables, '#1024,Hello%20World!,768');
        testResolution('{#path,x}/here', variables, '#/foo/bar,1024/here');
    });
    test('Level 3 - Label expansion with dot-prefix', () => {
        // Test cases from RFC 6570 Section 1.2
        const variables = {
            var: 'value',
            x: '1024',
            y: '768'
        };
        testResolution('X{.var}', variables, 'X.value');
        testResolution('X{.x,y}', variables, 'X.1024.768');
    });
    test('Level 3 - Path segments expansion', () => {
        // Test cases from RFC 6570 Section 1.2
        const variables = {
            var: 'value',
            x: '1024'
        };
        testResolution('{/var}', variables, '/value');
        testResolution('{/var,x}/here', variables, '/value/1024/here');
    });
    test('Level 3 - Path-style parameter expansion', () => {
        // Test cases from RFC 6570 Section 1.2
        const variables = {
            x: '1024',
            y: '768',
            empty: ''
        };
        testResolution('{;x,y}', variables, ';x=1024;y=768');
        testResolution('{;x,y,empty}', variables, ';x=1024;y=768;empty');
    });
    test('Level 3 - Form-style query expansion', () => {
        // Test cases from RFC 6570 Section 1.2
        const variables = {
            x: '1024',
            y: '768',
            empty: ''
        };
        testResolution('{?x,y}', variables, '?x=1024&y=768');
        testResolution('{?x,y,empty}', variables, '?x=1024&y=768&empty=');
    });
    test('Level 3 - Form-style query continuation', () => {
        // Test cases from RFC 6570 Section 1.2
        const variables = {
            x: '1024',
            y: '768',
            empty: ''
        };
        testResolution('?fixed=yes{&x}', variables, '?fixed=yes&x=1024');
        testResolution('{&x,y,empty}', variables, '&x=1024&y=768&empty=');
    });
    test('Level 4 - String expansion with value modifiers', () => {
        // Test cases from RFC 6570 Section 1.2
        const variables = {
            var: 'value',
            hello: 'Hello World!',
            path: '/foo/bar',
            list: ['red', 'green', 'blue'],
            keys: {
                semi: ';',
                dot: '.',
                comma: ','
            }
        };
        testResolution('{var:3}', variables, 'val');
        testResolution('{var:30}', variables, 'value');
        testResolution('{list}', variables, 'red,green,blue');
        testResolution('{list*}', variables, 'red,green,blue');
    });
    test('Level 4 - Reserved expansion with value modifiers', () => {
        // Test cases related to Level 4 features
        const variables = {
            var: 'value',
            hello: 'Hello World!',
            path: '/foo/bar',
            list: ['red', 'green', 'blue'],
            keys: {
                semi: ';',
                dot: '.',
                comma: ','
            }
        };
        testResolution('{+path:6}/here', variables, '/foo/b/here');
        testResolution('{+list}', variables, 'red,green,blue');
        testResolution('{+list*}', variables, 'red,green,blue');
        testResolution('{+keys}', variables, 'semi,;,dot,.,comma,,');
        testResolution('{+keys*}', variables, 'semi=;,dot=.,comma=,');
    });
    test('Level 4 - Fragment expansion with value modifiers', () => {
        // Test cases related to Level 4 features
        const variables = {
            var: 'value',
            hello: 'Hello World!',
            path: '/foo/bar',
            list: ['red', 'green', 'blue'],
            keys: {
                semi: ';',
                dot: '.',
                comma: ','
            }
        };
        testResolution('{#path:6}/here', variables, '#/foo/b/here');
        testResolution('{#list}', variables, '#red,green,blue');
        testResolution('{#list*}', variables, '#red,green,blue');
        testResolution('{#keys}', variables, '#semi,;,dot,.,comma,,');
        testResolution('{#keys*}', variables, '#semi=;,dot=.,comma=,');
    });
    test('Level 4 - Label expansion with value modifiers', () => {
        // Test cases related to Level 4 features
        const variables = {
            var: 'value',
            list: ['red', 'green', 'blue'],
            keys: {
                semi: ';',
                dot: '.',
                comma: ','
            }
        };
        testResolution('X{.var:3}', variables, 'X.val');
        testResolution('X{.list}', variables, 'X.red,green,blue');
        testResolution('X{.list*}', variables, 'X.red.green.blue');
        testResolution('X{.keys}', variables, 'X.semi,;,dot,.,comma,,');
        testResolution('X{.keys*}', variables, 'X.semi=;.dot=..comma=,');
    });
    test('Level 4 - Path expansion with value modifiers', () => {
        // Test cases related to Level 4 features
        const variables = {
            var: 'value',
            list: ['red', 'green', 'blue'],
            path: '/foo/bar',
            keys: {
                semi: ';',
                dot: '.',
                comma: ','
            }
        };
        testResolution('{/var:1,var}', variables, '/v/value');
        testResolution('{/list}', variables, '/red,green,blue');
        testResolution('{/list*}', variables, '/red/green/blue');
        testResolution('{/list*,path:4}', variables, '/red/green/blue/%2Ffoo');
        testResolution('{/keys}', variables, '/semi,;,dot,.,comma,,');
        testResolution('{/keys*}', variables, '/semi=%3B/dot=./comma=%2C');
    });
    test('Level 4 - Path-style parameters with value modifiers', () => {
        // Test cases related to Level 4 features
        const variables = {
            var: 'value',
            list: ['red', 'green', 'blue'],
            keys: {
                semi: ';',
                dot: '.',
                comma: ','
            }
        };
        testResolution('{;hello:5}', { hello: 'Hello World!' }, ';hello=Hello');
        testResolution('{;list}', variables, ';list=red,green,blue');
        testResolution('{;list*}', variables, ';list=red;list=green;list=blue');
        testResolution('{;keys}', variables, ';keys=semi,;,dot,.,comma,,');
        testResolution('{;keys*}', variables, ';semi=;;dot=.;comma=,');
    });
    test('Level 4 - Form-style query with value modifiers', () => {
        // Test cases related to Level 4 features
        const variables = {
            var: 'value',
            list: ['red', 'green', 'blue'],
            keys: {
                semi: ';',
                dot: '.',
                comma: ','
            }
        };
        testResolution('{?var:3}', variables, '?var=val');
        testResolution('{?list}', variables, '?list=red,green,blue');
        testResolution('{?list*}', variables, '?list=red&list=green&list=blue');
        testResolution('{?keys}', variables, '?keys=semi,;,dot,.,comma,,');
        testResolution('{?keys*}', variables, '?semi=;&dot=.&comma=,');
    });
    test('Level 4 - Form-style query continuation with value modifiers', () => {
        // Test cases related to Level 4 features
        const variables = {
            var: 'value',
            list: ['red', 'green', 'blue'],
            keys: {
                semi: ';',
                dot: '.',
                comma: ','
            }
        };
        testResolution('?fixed=yes{&var:3}', variables, '?fixed=yes&var=val');
        testResolution('?fixed=yes{&list}', variables, '?fixed=yes&list=red,green,blue');
        testResolution('?fixed=yes{&list*}', variables, '?fixed=yes&list=red&list=green&list=blue');
        testResolution('?fixed=yes{&keys}', variables, '?fixed=yes&keys=semi,;,dot,.,comma,,');
        testResolution('?fixed=yes{&keys*}', variables, '?fixed=yes&semi=;&dot=.&comma=,');
    });
    test('handling undefined or null values', () => {
        // Test handling of undefined/null values for different operators
        const variables = {
            defined: 'value',
            undef: undefined,
            null: null,
            empty: ''
        };
        // Simple string expansion
        testResolution('{defined,undef,null,empty}', variables, 'value,');
        // Reserved expansion
        testResolution('{+defined,undef,null,empty}', variables, 'value,');
        // Fragment expansion
        testResolution('{#defined,undef,null,empty}', variables, '#value,');
        // Label expansion
        testResolution('X{.defined,undef,null,empty}', variables, 'X.value');
        // Path segments
        testResolution('{/defined,undef,null}', variables, '/value');
        // Path-style parameters
        testResolution('{;defined,empty}', variables, ';defined=value;empty');
        // Form-style query
        testResolution('{?defined,undef,null,empty}', variables, '?defined=value&undef=&null=&empty=');
        // Form-style query continuation
        testResolution('{&defined,undef,null,empty}', variables, '&defined=value&undef=&null=&empty=');
    });
    test('complex templates', () => {
        // Test more complex template combinations
        const variables = {
            domain: 'example.com',
            user: 'fred',
            path: ['path', 'to', 'resource'],
            query: 'search',
            page: 5,
            lang: 'en',
            sessionId: '123abc',
            filters: ['color:blue', 'shape:square'],
            coordinates: { lat: '37.7', lon: '-122.4' }
        };
        // RESTful URL pattern
        testResolution('https://{domain}/api/v1/users/{user}{/path*}{?query,page,lang}', variables, 'https://example.com/api/v1/users/fred/path/to/resource?query=search&page=5&lang=en');
        // Complex query parameters
        testResolution('https://{domain}/search{?query,filters,coordinates*}', variables, 'https://example.com/search?query=search&filters=color:blue,shape:square&lat=37.7&lon=-122.4');
        // Multiple expression types
        testResolution('https://{domain}/users/{user}/profile{.lang}{?sessionId}{#path}', variables, 'https://example.com/users/fred/profile.en?sessionId=123abc#path,to,resource');
    });
    test('literals and escaping', () => {
        // Test literal segments and escaping
        testParsing('http://example.com/literal', []);
        testParsing('http://example.com/{var}literal{var2}', [
            {
                expression: '{var}',
                operator: '',
                variables: [{ explodable: false, name: 'var', optional: false, prefixLength: undefined, repeatable: false }]
            },
            {
                expression: '{var2}',
                operator: '',
                variables: [{ explodable: false, name: 'var2', optional: false, prefixLength: undefined, repeatable: false }]
            }
        ]);
        // Test that escaped braces are treated as literals
        // Note: The current implementation might not handle this case
        testResolution('http://example.com/{{var}}', { var: 'value' }, 'http://example.com/{var}');
    });
    test('edge cases', () => {
        // Empty template
        testResolution('', {}, '');
        // Template with only literals
        testResolution('http://example.com/path', {}, 'http://example.com/path');
        // No variables provided for resolution
        testResolution('{var}', {}, '');
        // Multiple sequential expressions
        testResolution('{a}{b}{c}', { a: '1', b: '2', c: '3' }, '123');
        // Expressions with special characters in variable names
        testResolution('{_hidden.var-name$}', { '_hidden.var-name$': 'value' }, 'value');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXJpVGVtcGxhdGUudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvdGVzdC9jb21tb24vdXJpVGVtcGxhdGUudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDMUQsT0FBTyxLQUFLLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFFakMsS0FBSyxDQUFDLGFBQWEsRUFBRSxHQUFHLEVBQUU7SUFDekIsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQzs7T0FFRztJQUNILFNBQVMsV0FBVyxDQUFDLFFBQWdCLEVBQUUsa0JBQTZCO1FBQ25FLE1BQU0sS0FBSyxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDMUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLFFBQVEsQ0FBQyxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDaEcsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTLGNBQWMsQ0FBQyxRQUFnQixFQUFFLFNBQThCLEVBQUUsUUFBZ0I7UUFDekYsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMxQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3hDLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFFRCxJQUFJLENBQUMsb0JBQW9CLEVBQUUs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