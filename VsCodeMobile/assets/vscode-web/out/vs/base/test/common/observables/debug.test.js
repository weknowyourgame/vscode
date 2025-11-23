/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { observableValue, derived, autorun } from '../../../common/observable.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../utils.js';
// eslint-disable-next-line local/code-no-deep-import-of-internal
import { debugGetObservableGraph } from '../../../common/observableInternal/logging/debugGetDependencyGraph.js';
suite('debug', () => {
    const ds = ensureNoDisposablesAreLeakedInTestSuite();
    test('debugGetDependencyGraph', () => {
        const myObservable1 = observableValue('myObservable1', 0);
        const myObservable2 = observableValue('myObservable2', 0);
        const myComputed1 = derived(reader => {
            /** @description myComputed1 */
            const value1 = myObservable1.read(reader);
            const value2 = myObservable2.read(reader);
            const sum = value1 + value2;
            return sum;
        });
        const myComputed2 = derived(reader => {
            /** @description myComputed2 */
            const value1 = myComputed1.read(reader);
            const value2 = myObservable1.read(reader);
            const value3 = myObservable2.read(reader);
            const sum = value1 + value2 + value3;
            return sum;
        });
        const myComputed3 = derived(reader => {
            /** @description myComputed3 */
            const value1 = myComputed2.read(reader);
            const value2 = myObservable1.read(reader);
            const value3 = myObservable2.read(reader);
            const sum = value1 + value2 + value3;
            return sum;
        });
        ds.add(autorun(reader => {
            /** @description myAutorun */
            myComputed3.read(reader);
        }));
        let idx = 0;
        assert.deepStrictEqual(debugGetObservableGraph(myComputed3, { type: 'dependencies', debugNamePostProcessor: name => `name${++idx}` }), '* derived name1:\n  value: 0\n  state: upToDate\n  dependencies:\n\t\t* derived name2:\n\t\t  value: 0\n\t\t  state: upToDate\n\t\t  dependencies:\n\t\t\t\t* derived name3:\n\t\t\t\t  value: 0\n\t\t\t\t  state: upToDate\n\t\t\t\t  dependencies:\n\t\t\t\t\t\t* observableValue name4:\n\t\t\t\t\t\t  value: 0\n\t\t\t\t\t\t  state: upToDate\n\t\t\t\t\t\t* observableValue name5:\n\t\t\t\t\t\t  value: 0\n\t\t\t\t\t\t  state: upToDate\n\t\t\t\t* observableValue name6 (already listed)\n\t\t\t\t* observableValue name7 (already listed)\n\t\t* observableValue name8 (already listed)\n\t\t* observableValue name9 (already listed)');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWcudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL3Rlc3QvY29tbW9uL29ic2VydmFibGVzL2RlYnVnLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ2xGLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUN0RSxpRUFBaUU7QUFDakUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sdUVBQXVFLENBQUM7QUFFaEgsS0FBSyxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUU7SUFDbkIsTUFBTSxFQUFFLEdBQUcsdUNBQXVDLEVBQUUsQ0FBQztJQUVyRCxJQUFJLENBQUMseUJBQXlCLEVBQUUsR0FBRyxFQUFFO1FBQ3BDLE1BQU0sYUFBYSxHQUFHLGVBQWUsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUQsTUFBTSxhQUFhLEdBQUcsZUFBZSxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUUxRCxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDcEMsK0JBQStCO1lBQy9CLE1BQU0sTUFBTSxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDMUMsTUFBTSxNQUFNLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMxQyxNQUFNLEdBQUcsR0FBRyxNQUFNLEdBQUcsTUFBTSxDQUFDO1lBQzVCLE9BQU8sR0FBRyxDQUFDO1FBQ1osQ0FBQyxDQUFDLENBQUM7UUFFSCxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDcEMsK0JBQStCO1lBQy9CLE1BQU0sTUFBTSxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDeEMsTUFBTSxNQUFNLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMxQyxNQUFNLE1BQU0sR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzFDLE1BQU0sR0FBRyxHQUFHLE1BQU0sR0FBRyxNQUFNLEdBQUcsTUFBTSxDQUFDO1lBQ3JDLE9BQU8sR0FBRyxDQUFDO1FBQ1osQ0FBQyxDQUFDLENBQUM7UUFFSCxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDcEMsK0JBQStCO1lBQy9CLE1BQU0sTUFBTSxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDeEMsTUFBTSxNQUFNLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMxQyxNQUFNLE1BQU0sR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzFDLE1BQU0sR0FBRyxHQUFHLE1BQU0sR0FBRyxNQUFNLEdBQUcsTUFBTSxDQUFDO1lBQ3JDLE9BQU8sR0FBRyxDQUFDO1FBQ1osQ0FBQyxDQUFDLENBQUM7UUFFSCxFQUFFLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUN2Qiw2QkFBNkI7WUFDN0IsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMxQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBR0osSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDO1FBQ1osTUFBTSxDQUFDLGVBQWUsQ0FDckIsdUJBQXVCLENBQUMsV0FBVyxFQUFFLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxzQkFBc0IsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQzlHLGduQkFBZ25CLENBQ2huQixDQUFDO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9