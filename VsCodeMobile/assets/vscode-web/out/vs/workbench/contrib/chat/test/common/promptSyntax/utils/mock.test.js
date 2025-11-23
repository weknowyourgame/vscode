/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { mockObject, mockService } from './mock.js';
import { typeCheck } from '../../../../../../../base/common/types.js';
import { randomBoolean } from '../../../../../../../base/test/common/testUtils.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
suite('mockService', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('mockObject', () => {
        test('overrides properties and functions', () => {
            const mock = mockObject({
                bar: 'oh hi!',
                baz: 42,
                anotherMethod(arg) {
                    return isNaN(arg);
                },
            });
            typeCheck(mock);
            assert.strictEqual(mock.bar, 'oh hi!', 'bar should be overriden');
            assert.strictEqual(mock.baz, 42, 'baz should be overriden');
            assert(!(mock.anotherMethod(490274)), 'Must execute overriden method correctly 1.');
            assert(mock.anotherMethod(NaN), 'Must execute overriden method correctly 2.');
            assert.throws(() => {
                // property is not overriden so must throw
                // eslint-disable-next-line local/code-no-unused-expressions
                mock.foo;
            });
            assert.throws(() => {
                // function is not overriden so must throw
                mock.someMethod(randomBoolean());
            });
        });
        test('immutability of the overrides object', () => {
            const overrides = {
                baz: 4,
            };
            const mock = mockObject(overrides);
            typeCheck(mock);
            assert.strictEqual(mock.baz, 4, 'baz should be overridden');
            // overrides object must be immutable
            assert.throws(() => {
                overrides.foo = 'test';
            });
            assert.throws(() => {
                overrides.someMethod = (arg) => {
                    return `${arg}__${arg}`;
                };
            });
        });
    });
    suite('mockService', () => {
        test('overrides properties and functions', () => {
            const mock = mockService({
                id: 'ciao!',
                counter: 74,
                testMethod2(arg) {
                    return !isNaN(arg);
                },
            });
            typeCheck(mock);
            assert.strictEqual(mock.id, 'ciao!', 'id should be overridden');
            assert.strictEqual(mock.counter, 74, 'counter should be overridden');
            assert(mock.testMethod2(74368), 'Must execute overridden method correctly 1.');
            assert(!(mock.testMethod2(NaN)), 'Must execute overridden method correctly 2.');
            assert.throws(() => {
                // property is not overridden so must throw
                // eslint-disable-next-line local/code-no-unused-expressions
                mock.prop1;
            });
            assert.throws(() => {
                // function is not overridden so must throw
                mock.method1(randomBoolean());
            });
        });
        test('immutability of the overrides object', () => {
            const overrides = {
                baz: false,
            };
            const mock = mockService(overrides);
            typeCheck(mock);
            assert.strictEqual(mock.baz, false, 'baz should be overridden');
            // overrides object must be immutable
            assert.throws(() => {
                overrides.foo = 'test';
            });
            assert.throws(() => {
                overrides.someMethod = (arg) => {
                    return `${arg}__${arg}`;
                };
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9jay50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvdGVzdC9jb21tb24vcHJvbXB0U3ludGF4L3V0aWxzL21vY2sudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDcEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUNuRixPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUV6RyxLQUFLLENBQUMsYUFBYSxFQUFFLEdBQUcsRUFBRTtJQUN6Qix1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLEtBQUssQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFO1FBQ3hCLElBQUksQ0FBQyxvQ0FBb0MsRUFBRSxHQUFHLEVBQUU7WUFTL0MsTUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFjO2dCQUNwQyxHQUFHLEVBQUUsUUFBUTtnQkFDYixHQUFHLEVBQUUsRUFBRTtnQkFDUCxhQUFhLENBQUMsR0FBVztvQkFDeEIsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ25CLENBQUM7YUFDRCxDQUFDLENBQUM7WUFFSCxTQUFTLENBQWMsSUFBSSxDQUFDLENBQUM7WUFFN0IsTUFBTSxDQUFDLFdBQVcsQ0FDakIsSUFBSSxDQUFDLEdBQUcsRUFDUixRQUFRLEVBQ1IseUJBQXlCLENBQ3pCLENBQUM7WUFFRixNQUFNLENBQUMsV0FBVyxDQUNqQixJQUFJLENBQUMsR0FBRyxFQUNSLEVBQUUsRUFDRix5QkFBeUIsQ0FDekIsQ0FBQztZQUVGLE1BQU0sQ0FD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