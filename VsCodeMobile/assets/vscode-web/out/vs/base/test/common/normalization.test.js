/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { tryNormalizeToBase } from '../../common/normalization.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from './utils.js';
suite('Normalization', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('tryNormalizeToBase', function () {
        assert.strictEqual(tryNormalizeToBase('joào'), 'joao');
        assert.strictEqual(tryNormalizeToBase('joáo'), 'joao');
        assert.strictEqual(tryNormalizeToBase('joâo'), 'joao');
        assert.strictEqual(tryNormalizeToBase('joäo'), 'joao');
        // assert.strictEqual(strings.tryNormalizeToBase('joæo'), 'joao'); // not an accent
        assert.strictEqual(tryNormalizeToBase('joão'), 'joao');
        assert.strictEqual(tryNormalizeToBase('joåo'), 'joao');
        assert.strictEqual(tryNormalizeToBase('joåo'), 'joao');
        assert.strictEqual(tryNormalizeToBase('joāo'), 'joao');
        assert.strictEqual(tryNormalizeToBase('fôo'), 'foo');
        assert.strictEqual(tryNormalizeToBase('föo'), 'foo');
        assert.strictEqual(tryNormalizeToBase('fòo'), 'foo');
        assert.strictEqual(tryNormalizeToBase('fóo'), 'foo');
        // assert.strictEqual(strings.tryNormalizeToBase('fœo'), 'foo');
        // assert.strictEqual(strings.tryNormalizeToBase('føo'), 'foo');
        assert.strictEqual(tryNormalizeToBase('fōo'), 'foo');
        assert.strictEqual(tryNormalizeToBase('fõo'), 'foo');
        assert.strictEqual(tryNormalizeToBase('andrè'), 'andre');
        assert.strictEqual(tryNormalizeToBase('andré'), 'andre');
        assert.strictEqual(tryNormalizeToBase('andrê'), 'andre');
        assert.strictEqual(tryNormalizeToBase('andrë'), 'andre');
        assert.strictEqual(tryNormalizeToBase('andrē'), 'andre');
        assert.strictEqual(tryNormalizeToBase('andrė'), 'andre');
        assert.strictEqual(tryNormalizeToBase('andrę'), 'andre');
        assert.strictEqual(tryNormalizeToBase('hvîc'), 'hvic');
        assert.strictEqual(tryNormalizeToBase('hvïc'), 'hvic');
        assert.strictEqual(tryNormalizeToBase('hvíc'), 'hvic');
        assert.strictEqual(tryNormalizeToBase('hvīc'), 'hvic');
        assert.strictEqual(tryNormalizeToBase('hvįc'), 'hvic');
        assert.strictEqual(tryNormalizeToBase('hvìc'), 'hvic');
        assert.strictEqual(tryNormalizeToBase('ûdo'), 'udo');
        assert.strictEqual(tryNormalizeToBase('üdo'), 'udo');
        assert.strictEqual(tryNormalizeToBase('ùdo'), 'udo');
        assert.strictEqual(tryNormalizeToBase('údo'), 'udo');
        assert.strictEqual(tryNormalizeToBase('ūdo'), 'udo');
        assert.strictEqual(tryNormalizeToBase('heÿ'), 'hey');
        // assert.strictEqual(strings.tryNormalizeToBase('gruß'), 'grus');
        assert.strictEqual(tryNormalizeToBase('gruś'), 'grus');
        assert.strictEqual(tryNormalizeToBase('gruš'), 'grus');
        assert.strictEqual(tryNormalizeToBase('çool'), 'cool');
        assert.strictEqual(tryNormalizeToBase('ćool'), 'cool');
        assert.strictEqual(tryNormalizeToBase('čool'), 'cool');
        assert.strictEqual(tryNormalizeToBase('ñice'), 'nice');
        assert.strictEqual(tryNormalizeToBase('ńice'), 'nice');
        // Different cases
        assert.strictEqual(tryNormalizeToBase('CAFÉ'), 'cafe');
        assert.strictEqual(tryNormalizeToBase('Café'), 'cafe');
        assert.strictEqual(tryNormalizeToBase('café'), 'cafe');
        assert.strictEqual(tryNormalizeToBase('JOÃO'), 'joao');
        assert.strictEqual(tryNormalizeToBase('João'), 'joao');
        // Mixed cases with accents
        assert.strictEqual(tryNormalizeToBase('CaFé'), 'cafe');
        assert.strictEqual(tryNormalizeToBase('JoÃo'), 'joao');
        assert.strictEqual(tryNormalizeToBase('AnDrÉ'), 'andre');
        // Precomposed accents
        assert.strictEqual(tryNormalizeToBase('\u00E9'), 'e');
        assert.strictEqual(tryNormalizeToBase('\u00E0'), 'a');
        assert.strictEqual(tryNormalizeToBase('caf\u00E9'), 'cafe');
        // Base + combining accents - lower only
        assert.strictEqual(tryNormalizeToBase('\u0065\u0301'), '\u0065\u0301');
        assert.strictEqual(tryNormalizeToBase('Ã\u0061\u0300'), 'ã\u0061\u0300');
        assert.strictEqual(tryNormalizeToBase('CaF\u0065\u0301'), 'caf\u0065\u0301');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsaXphdGlvbi50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvdGVzdC9jb21tb24vbm9ybWFsaXphdGlvbi50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNuRSxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFckUsS0FBSyxDQUFDLGVBQWUsRUFBRSxHQUFHLEVBQUU7SUFDM0IsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxJQUFJLENBQUMsb0JBQW9CLEVBQUU7UUFDMUIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN2RCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDdkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN2RCxtRkFBbUY7UUFDbkYsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN2RCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDdkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUV2RCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3JELE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDckQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNyRCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3JELGdFQUFnRTtRQUNoRSxnRUFBZ0U7UUFDaEUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNyRCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXJELE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDekQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN6RCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3pELE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDekQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN6RCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3pELE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFekQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN2RCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDdkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN2RCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFdkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNyRCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3JELE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDckQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNyRCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXJELE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFckQsa0VBQWtFO1FBQ2xFLE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDdkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUV2RCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDdkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUV2RCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFdkQsa0JBQWtCO1FBQ2xCLE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDdkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN2RCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDdkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUV2RCwyQkFBMkI7UUFDM0IsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN2RCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFekQsc0JBQXNCO1FBQ3RCLE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDdEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUN0RCxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRTVELHdDQUF3QztRQUN4QyxNQUFNLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ3ZFLE1BQU0sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsZUFBZSxDQUFDLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDekUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLGlCQUFpQixDQUFDLENBQUM7SUFDOUUsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9