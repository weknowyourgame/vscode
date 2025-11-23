/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { computeDefaultDocumentColors } from '../../../common/languages/defaultDocumentColorsComputer.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
suite('Default Document Colors Computer', () => {
    class TestDocumentModel {
        constructor(content) {
            this.content = content;
        }
        getValue() {
            return this.content;
        }
        positionAt(offset) {
            const lines = this.content.substring(0, offset).split('\n');
            return {
                lineNumber: lines.length,
                column: lines[lines.length - 1].length + 1
            };
        }
        findMatches(regex) {
            return [...this.content.matchAll(regex)];
        }
    }
    ensureNoDisposablesAreLeakedInTestSuite();
    test('Hex colors in strings should be detected', () => {
        // Test case from issue: hex color inside string is not detected
        const model = new TestDocumentModel(`const color = '#ff0000';`);
        const colors = computeDefaultDocumentColors(model);
        assert.strictEqual(colors.length, 1, 'Should detect one hex color');
        assert.strictEqual(colors[0].color.red, 1, 'Red component should be 1 (255/255)');
        assert.strictEqual(colors[0].color.green, 0, 'Green component should be 0');
        assert.strictEqual(colors[0].color.blue, 0, 'Blue component should be 0');
        assert.strictEqual(colors[0].color.alpha, 1, 'Alpha should be 1');
    });
    test('Hex colors in double quotes should be detected', () => {
        const model = new TestDocumentModel('const color = "#00ff00";');
        const colors = computeDefaultDocumentColors(model);
        assert.strictEqual(colors.length, 1, 'Should detect one hex color');
        assert.strictEqual(colors[0].color.red, 0, 'Red component should be 0');
        assert.strictEqual(colors[0].color.green, 1, 'Green component should be 1 (255/255)');
        assert.strictEqual(colors[0].color.blue, 0, 'Blue component should be 0');
    });
    test('Multiple hex colors in array should be detected', () => {
        const model = new TestDocumentModel(`const colors = ['#ff0000', '#00ff00', '#0000ff'];`);
        const colors = computeDefaultDocumentColors(model);
        assert.strictEqual(colors.length, 3, 'Should detect three hex colors');
        // First color: red
        assert.strictEqual(colors[0].color.red, 1, 'First color red component should be 1');
        assert.strictEqual(colors[0].color.green, 0, 'First color green component should be 0');
        assert.strictEqual(colors[0].color.blue, 0, 'First color blue component should be 0');
        // Second color: green
        assert.strictEqual(colors[1].color.red, 0, 'Second color red component should be 0');
        assert.strictEqual(colors[1].color.green, 1, 'Second color green component should be 1');
        assert.strictEqual(colors[1].color.blue, 0, 'Second color blue component should be 0');
        // Third color: blue
        assert.strictEqual(colors[2].color.red, 0, 'Third color red component should be 0');
        assert.strictEqual(colors[2].color.green, 0, 'Third color green component should be 0');
        assert.strictEqual(colors[2].color.blue, 1, 'Third color blue component should be 1');
    });
    test('Existing functionality should still work', () => {
        // Test cases that were already working
        const testCases = [
            { content: `const color = ' #ff0000';`, name: 'hex with space before' },
            { content: '#ff0000', name: 'hex at start of line' },
            { content: '  #ff0000', name: 'hex with whitespace before' }
        ];
        testCases.forEach(testCase => {
            const model = new TestDocumentModel(testCase.content);
            const colors = computeDefaultDocumentColors(model);
            assert.strictEqual(colors.length, 1, `Should still detect ${testCase.name}`);
        });
    });
    test('8-digit hex colors should also work', () => {
        const model = new TestDocumentModel(`const color = '#ff0000ff';`);
        const colors = computeDefaultDocumentColors(model);
        assert.strictEqual(colors.length, 1, 'Should detect one 8-digit hex color');
        assert.strictEqual(colors[0].color.red, 1, 'Red component should be 1');
        assert.strictEqual(colors[0].color.green, 0, 'Green component should be 0');
        assert.strictEqual(colors[0].color.blue, 0, 'Blue component should be 0');
        assert.strictEqual(colors[0].color.alpha, 1, 'Alpha should be 1 (ff/255)');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmYXVsdERvY3VtZW50Q29sb3JzQ29tcHV0ZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvdGVzdC9jb21tb24vbGFuZ3VhZ2VzL2RlZmF1bHREb2N1bWVudENvbG9yc0NvbXB1dGVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFDaEcsT0FBTyxLQUFLLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDakMsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDMUcsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFaEcsS0FBSyxDQUFDLGtDQUFrQyxFQUFFLEdBQUcsRUFBRTtJQUU5QyxNQUFNLGlCQUFpQjtRQUN0QixZQUFvQixPQUFlO1lBQWYsWUFBTyxHQUFQLE9BQU8sQ0FBUTtRQUFJLENBQUM7UUFFeEMsUUFBUTtZQUNQLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUNyQixDQUFDO1FBRUQsVUFBVSxDQUFDLE1BQWM7WUFDeEIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM1RCxPQUFPO2dCQUNOLFVBQVUsRUFBRSxLQUFLLENBQUMsTUFBTTtnQkFDeEIsTUFBTSxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDO2FBQzFDLENBQUM7UUFDSCxDQUFDO1FBRUQsV0FBVyxDQUFDLEtBQWE7WUFDeEIsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUMxQyxDQUFDO0tBQ0Q7SUFFRCx1Q0FBdUMsRUFBRSxD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