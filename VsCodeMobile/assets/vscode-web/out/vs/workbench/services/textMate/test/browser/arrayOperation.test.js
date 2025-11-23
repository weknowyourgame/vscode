/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { MonotonousIndexTransformer } from '../../browser/indexTransformer.js';
import { LengthEdit, LengthReplacement } from '../../../../../editor/common/core/edits/lengthEdit.js';
suite('array operation', () => {
    function seq(start, end) {
        const result = [];
        for (let i = start; i < end; i++) {
            result.push(i);
        }
        return result;
    }
    test('simple', () => {
        const edit = LengthEdit.create([
            LengthReplacement.create(4, 7, 2),
            LengthReplacement.create(8, 8, 2),
            LengthReplacement.create(9, 11, 0),
        ]);
        const arr = seq(0, 15).map(x => `item${x}`);
        const newArr = edit.applyArray(arr, undefined);
        assert.deepStrictEqual(newArr, [
            'item0',
            'item1',
            'item2',
            'item3',
            undefined,
            undefined,
            'item7',
            undefined,
            undefined,
            'item8',
            'item11',
            'item12',
            'item13',
            'item14',
        ]);
        const transformer = new MonotonousIndexTransformer(edit);
        assert.deepStrictEqual(seq(0, 15).map((x) => {
            const t = transformer.transform(x);
            let r = `arr[${x}]: ${arr[x]} -> `;
            if (t !== undefined) {
                r += `newArr[${t}]: ${newArr[t]}`;
            }
            else {
                r += 'undefined';
            }
            return r;
        }), [
            'arr[0]: item0 -> newArr[0]: item0',
            'arr[1]: item1 -> newArr[1]: item1',
            'arr[2]: item2 -> newArr[2]: item2',
            'arr[3]: item3 -> newArr[3]: item3',
            'arr[4]: item4 -> undefined',
            'arr[5]: item5 -> undefined',
            'arr[6]: item6 -> undefined',
            'arr[7]: item7 -> newArr[6]: item7',
            'arr[8]: item8 -> newArr[9]: item8',
            'arr[9]: item9 -> undefined',
            'arr[10]: item10 -> undefined',
            'arr[11]: item11 -> newArr[10]: item11',
            'arr[12]: item12 -> newArr[11]: item12',
            'arr[13]: item13 -> newArr[12]: item13',
            'arr[14]: item14 -> newArr[13]: item14',
        ]);
    });
    ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJyYXlPcGVyYXRpb24udGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvdGV4dE1hdGUvdGVzdC9icm93c2VyL2FycmF5T3BlcmF0aW9uLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUV0RyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsR0FBRyxFQUFFO0lBQzdCLFNBQVMsR0FBRyxDQUFDLEtBQWEsRUFBRSxHQUFXO1FBQ3RDLE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztRQUM1QixLQUFLLElBQUksQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDbEMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoQixDQUFDO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBRUQsSUFBSSxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUU7UUFDbkIsTUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQztZQUM5QixpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDakMsaUJBQWlCLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ2pDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztTQUNsQyxDQUFDLENBQUM7UUFFSCxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM1QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUMvQyxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRTtZQUM5QixPQUFPO1lBQ1AsT0FBTztZQUNQLE9BQU87WUFDUCxPQUFPO1lBQ1AsU0FBUztZQUNULFNBQVM7WUFDVCxPQUFPO1lBQ1AsU0FBUztZQUNULFNBQVM7WUFDVCxPQUFPO1lBQ1AsUUFBUTtZQUNSLFFBQVE7WUFDUixRQUFRO1lBQ1IsUUFBUTtTQUNSLENBQUMsQ0FBQztRQUVILE1BQU0sV0FBVyxHQUFHLElBQUksMEJBQTBCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDekQsTUFBTSxDQUFDLGVBQWUsQ0FDckIsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtZQUNwQixNQUFNLENBQUMsR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25DLElBQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO1lBQ25DLElBQUksQ0FBQyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUNyQixDQUFDLElBQUksVUFBVSxDQUFDLE1BQU0sTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDbkMsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLENBQUMsSUFBSSxXQUFXLENBQUM7WUFDbEIsQ0FBQztZQUNELE9BQU8sQ0FBQyxDQUFDO1FBQ1YsQ0FBQyxDQUFDLEVBQ0Y7WUFDQyxtQ0FBbUM7WUFDbkMsbUNBQW1DO1lBQ25DLG1DQUFtQztZQUNuQyxtQ0FBbUM7WUFDbkMsNEJBQTRCO1lBQzVCLDRCQUE0QjtZQUM1Qiw0QkFBNEI7WUFDNUIsbUNBQW1DO1lBQ25DLG1DQUFtQztZQUNuQyw0QkFBNEI7WUFDNUIsOEJBQThCO1lBQzlCLHVDQUF1QztZQUN2Qyx1Q0FBdUM7WUFDdkMsdUNBQXVDO1lBQ3ZDLHVDQUF1QztTQUN2QyxDQUNELENBQUM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILHVDQUF1QyxFQUFFLENBQUM7QUFDM0MsQ0FBQyxDQUFDLENBQUMifQ==