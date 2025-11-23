/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { StringText } from '../../../../../editor/common/core/text/abstractText.js';
import { ArcTracker } from '../../common/arcTracker.js';
import { FileAccess } from '../../../../../base/common/network.js';
import { readFileSync } from 'fs';
import { join, resolve } from '../../../../../base/common/path.js';
import { StringEdit, StringReplacement } from '../../../../../editor/common/core/edits/stringEdit.js';
import { OffsetRange } from '../../../../../editor/common/core/ranges/offsetRange.js';
import { ensureDependenciesAreSet } from '../../../../../editor/common/core/text/positionToOffset.js';
suite('ArcTracker', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    ensureDependenciesAreSet();
    const fixturesOutDir = FileAccess.asFileUri('vs/workbench/contrib/editTelemetry/test/node/data').fsPath;
    const fixturesSrcDir = resolve(fixturesOutDir).replaceAll('\\', '/').replace('/out/vs/workbench/', '/src/vs/workbench/');
    function getData(name) {
        const path = join(fixturesSrcDir, name + '.edits.w.json');
        const src = readFileSync(path, 'utf8');
        return JSON.parse(src);
    }
    test('issue-264048', () => {
        const stats = runTestWithData(getData('issue-264048'));
        assert.deepStrictEqual(stats, ([
            {
                arc: 8,
                deletedLineCounts: 1,
                insertedLineCounts: 1
            },
            {
                arc: 8,
                deletedLineCounts: 0,
                insertedLineCounts: 1
            },
            {
                arc: 8,
                deletedLineCounts: 0,
                insertedLineCounts: 1
            }
        ]));
    });
    test('line-insert', () => {
        const stats = runTestWithData(getData('line-insert'));
        assert.deepStrictEqual(stats, ([
            {
                arc: 7,
                deletedLineCounts: 0,
                insertedLineCounts: 1
            },
            {
                arc: 5,
                deletedLineCounts: 0,
                insertedLineCounts: 1
            }
        ]));
    });
    test('line-modification', () => {
        const stats = runTestWithData(getData('line-modification'));
        assert.deepStrictEqual(stats, ([
            {
                arc: 6,
                deletedLineCounts: 1,
                insertedLineCounts: 1
            },
            {
                arc: 6,
                deletedLineCounts: 1,
                insertedLineCounts: 1
            },
            {
                arc: 0,
                deletedLineCounts: 0,
                insertedLineCounts: 0
            }
        ]));
    });
    test('multiline-insert', () => {
        const stats = runTestWithData(getData('multiline-insert'));
        assert.deepStrictEqual(stats, ([
            {
                arc: 24,
                deletedLineCounts: 0,
                insertedLineCounts: 3
            },
            {
                arc: 23,
                deletedLineCounts: 0,
                insertedLineCounts: 2
            }
        ]));
    });
});
function createStringEditFromJson(editData) {
    const replacements = editData.replacements.map(replacement => new StringReplacement(OffsetRange.ofStartAndLength(replacement.start, replacement.endEx - replacement.start), replacement.text));
    return new StringEdit(replacements);
}
function runTestWithData(data) {
    const edits = data.edits.map(editData => createStringEditFromJson(editData));
    const t = new ArcTracker(new StringText(data.initialText), edits[0]);
    const stats = [];
    stats.push(t.getValues());
    let lastLineNumbers = t.getLineCountInfo().insertedLineCounts;
    let lastArc = t.getAcceptedRestrainedCharactersCount();
    for (let i = 1; i < edits.length; i++) {
        t.handleEdits(edits[i]);
        stats.push(t.getValues());
        const newLineNumbers = t.getLineCountInfo().insertedLineCounts;
        assert.ok(newLineNumbers <= lastLineNumbers, `Line numbers must not increase. Last: ${lastLineNumbers}, new: ${newLineNumbers}`);
        lastLineNumbers = newLineNumbers;
        const newArc = t.getAcceptedRestrainedCharactersCount();
        assert.ok(newArc <= lastArc, `ARC must not increase. Last: ${lastArc}, new: ${newArc}`);
        lastArc = newArc;
    }
    return stats;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJjVHJhY2tlci50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2VkaXRUZWxlbWV0cnkvdGVzdC9ub2RlL2FyY1RyYWNrZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUN4RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDbkUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLElBQUksQ0FBQztBQUNsQyxPQUFPLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN0RyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDdEYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFFdEcsS0FBSyxDQUFDLFlBQVksRUFBRSxHQUFHLEVBQUU7SUFDeEIsdUNBQXVDLEVBQUUsQ0FBQztJQUMxQyx3QkFBd0IsRUFBRSxDQUFDO0lBRTNCLE1BQU0sY0FBYyxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsbURBQW1ELENBQUMsQ0FBQyxNQUFNLENBQUM7SUFDeEcsTUFBTSxjQUFjLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLG9CQUFvQixFQUFFLG9C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