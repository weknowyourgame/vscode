/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { derivedHandleChanges } from '../../../../base/common/observable.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { observableCodeEditor } from '../../../browser/observableCodeEditor.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import { withTestCodeEditor } from '../testCodeEditor.js';
suite('CodeEditorWidget', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    function withTestFixture(cb) {
        withEditorSetupTestFixture(undefined, cb);
    }
    function withEditorSetupTestFixture(preSetupCallback, cb) {
        withTestCodeEditor('hello world', {}, (editor, viewModel) => {
            const disposables = new DisposableStore();
            preSetupCallback?.(editor, disposables);
            const obsEditor = observableCodeEditor(editor);
            const log = new Log();
            const derived = derivedHandleChanges({
                changeTracker: {
                    createChangeSummary: () => undefined,
                    handleChange: (context) => {
                        const obsName = observableName(context.changedObservable, obsEditor);
                        log.log(`handle change: ${obsName} ${formatChange(context.change)}`);
                        return true;
                    },
                },
            }, (reader) => {
                const versionId = obsEditor.versionId.read(reader);
                const selection = obsEditor.selections.read(reader)?.map((s) => s.toString()).join(', ');
                obsEditor.onDidType.read(reader);
                const str = `running derived: selection: ${selection}, value: ${versionId}`;
                log.log(str);
                return str;
            });
            derived.recomputeInitiallyAndOnChange(disposables);
            assert.deepStrictEqual(log.getAndClearEntries(), [
                'running derived: selection: [1,1 -> 1,1], value: 1',
            ]);
            cb({ editor, viewModel, log, derived });
            disposables.dispose();
        });
    }
    test('setPosition', () => withTestFixture(({ editor, log }) => {
        editor.setPosition(new Position(1, 2));
        assert.deepStrictEqual(log.getAndClearEntries(), ([
            'handle change: editor.selections {"selection":"[1,2 -> 1,2]","modelVersionId":1,"oldSelections":["[1,1 -> 1,1]"],"oldModelVersionId":1,"source":"api","reason":0}',
            'running derived: selection: [1,2 -> 1,2], value: 1'
        ]));
    }));
    test('keyboard.type', () => withTestFixture(({ editor, log }) => {
        editor.trigger('keyboard', 'type', { text: 'abc' });
        assert.deepStrictEqual(log.getAndClearEntries(), ([
            'handle change: editor.onDidType "abc"',
            'handle change: editor.versionId {"changes":[{"range":"[1,1 -> 1,1]","rangeLength":0,"text":"a","rangeOffset":0}],"eol":"\\n","versionId":2,"detailedReasons":[{"metadata":{"source":"cursor","kind":"type","detailedSource":"keyboard"}}],"detailedReasonsChangeLengths":[1]}',
            'handle change: editor.versionId {"changes":[{"range":"[1,2 -> 1,2]","rangeLength":0,"text":"b","rangeOffset":1}],"eol":"\\n","versionId":3,"detailedReasons":[{"metadata":{"source":"cursor","kind":"type","detailedSource":"keyboard"}}],"detailedReasonsChangeLengths":[1]}',
            'handle change: editor.versionId {"changes":[{"range":"[1,3 -> 1,3]","rangeLength":0,"text":"c","rangeOffset":2}],"eol":"\\n","versionId":4,"detailedReasons":[{"metadata":{"source":"cursor","kind":"type","detailedSource":"keyboard"}}],"detailedReasonsChangeLengths":[1]}',
            'handle change: editor.selections {"selection":"[1,4 -> 1,4]","modelVersionId":4,"oldSelections":["[1,1 -> 1,1]"],"oldModelVersionId":1,"source":"keyboard","reason":0}',
            'running derived: selection: [1,4 -> 1,4], value: 4'
        ]));
    }));
    test('keyboard.type and set position', () => withTestFixture(({ editor, log }) => {
        editor.trigger('keyboard', 'type', { text: 'abc' });
        assert.deepStrictEqual(log.getAndClearEntries(), ([
            'handle change: editor.onDidType "abc"',
            'handle change: editor.versionId {"changes":[{"range":"[1,1 -> 1,1]","rangeLength":0,"text":"a","rangeOffset":0}],"eol":"\\n","versionId":2,"detailedReasons":[{"metadata":{"source":"cursor","kind":"type","detailedSource":"keyboard"}}],"detailedReasonsChangeLengths":[1]}',
            'handle change: editor.versionId {"changes":[{"range":"[1,2 -> 1,2]","rangeLength":0,"text":"b","rangeOffset":1}],"eol":"\\n","versionId":3,"detailedReasons":[{"metadata":{"source":"cursor","kind":"type","detailedSource":"keyboard"}}],"detailedReasonsChangeLengths":[1]}',
            'handle change: editor.versionId {"changes":[{"range":"[1,3 -> 1,3]","rangeLength":0,"text":"c","rangeOffset":2}],"eol":"\\n","versionId":4,"detailedReasons":[{"metadata":{"source":"cursor","kind":"type","detailedSource":"keyboard"}}],"detailedReasonsChangeLengths":[1]}',
            'handle change: editor.selections {"selection":"[1,4 -> 1,4]","modelVersionId":4,"oldSelections":["[1,1 -> 1,1]"],"oldModelVersionId":1,"source":"keyboard","reason":0}',
            'running derived: selection: [1,4 -> 1,4], value: 4'
        ]));
        editor.setPosition(new Position(1, 5), 'test');
        assert.deepStrictEqual(log.getAndClearEntries(), ([
            'handle change: editor.selections {"selection":"[1,5 -> 1,5]","modelVersionId":4,"oldSelections":["[1,4 -> 1,4]"],"oldModelVersionId":4,"source":"test","reason":0}',
            'running derived: selection: [1,5 -> 1,5], value: 4'
        ]));
    }));
    test('listener interaction (unforced)', () => {
        let derived;
        let log;
        withEditorSetupTestFixture((editor, disposables) => {
            disposables.add(editor.onDidChangeModelContent(() => {
                log.log('>>> before get');
                derived.get();
                log.log('<<< after get');
            }));
        }, (args) => {
            const editor = args.editor;
            derived = args.derived;
            log = args.log;
            editor.trigger('keyboard', 'type', { text: 'a' });
            assert.deepStrictEqual(log.getAndClearEntries(), ([
                '>>> before get',
                '<<< after get',
                'handle change: editor.onDidType "a"',
                'handle change: editor.versionId {"changes":[{"range":"[1,1 -> 1,1]","rangeLength":0,"text":"a","rangeOffset":0}],"eol":"\\n","versionId":2,"detailedReasons":[{"metadata":{"source":"cursor","kind":"type","detailedSource":"keyboard"}}],"detailedReasonsChangeLengths":[1]}',
                'handle change: editor.selections {"selection":"[1,2 -> 1,2]","modelVersionId":2,"oldSelections":["[1,1 -> 1,1]"],"oldModelVersionId":1,"source":"keyboard","reason":0}',
                'running derived: selection: [1,2 -> 1,2], value: 2'
            ]));
        });
    });
    test('listener interaction ()', () => {
        let derived;
        let log;
        withEditorSetupTestFixture((editor, disposables) => {
            disposables.add(editor.onDidChangeModelContent(() => {
                log.log('>>> before forceUpdate');
                observableCodeEditor(editor).forceUpdate();
                log.log('>>> before get');
                derived.get();
                log.log('<<< after get');
            }));
        }, (args) => {
            const editor = args.editor;
            derived = args.derived;
            log = args.log;
            editor.trigger('keyboard', 'type', { text: 'a' });
            assert.deepStrictEqual(log.getAndClearEntries(), ([
                '>>> before forceUpdate',
                '>>> before get',
                'handle change: editor.versionId undefined',
                'running derived: selection: [1,2 -> 1,2], value: 2',
                '<<< after get',
                'handle change: editor.onDidType "a"',
                'handle change: editor.versionId {"changes":[{"range":"[1,1 -> 1,1]","rangeLength":0,"text":"a","rangeOffset":0}],"eol":"\\n","versionId":2,"detailedReasons":[{"metadata":{"source":"cursor","kind":"type","detailedSource":"keyboard"}}],"detailedReasonsChangeLengths":[1]}',
                'handle change: editor.selections {"selection":"[1,2 -> 1,2]","modelVersionId":2,"oldSelections":["[1,1 -> 1,1]"],"oldModelVersionId":1,"source":"keyboard","reason":0}',
                'running derived: selection: [1,2 -> 1,2], value: 2'
            ]));
        });
    });
});
class Log {
    constructor() {
        this.entries = [];
    }
    log(message) {
        this.entries.push(message);
    }
    getAndClearEntries() {
        const entries = [...this.entries];
        this.entries.length = 0;
        return entries;
    }
}
function formatChange(change) {
    return JSON.stringify(change, (key, value) => {
        if (value instanceof Range) {
            return value.toString();
        }
        if (value === false ||
            (Array.isArray(value) && value.length === 0)) {
            return undefined;
        }
        return value;
    });
}
function observableName(obs, obsEditor) {
    switch (obs) {
        case obsEditor.selections:
            return 'editor.selections';
        case obsEditor.versionId:
            return 'editor.versionId';
        case obsEditor.onDidType:
            return 'editor.onDidType';
        default:
            return 'unknown';
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JzZXJ2YWJsZUNvZGVFZGl0b3IudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvdGVzdC9icm93c2VyL3dpZGdldC9vYnNlcnZhYmxlQ29kZUVkaXRvci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQ2pDLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN2RSxPQUFPLEVBQWUsb0JBQW9CLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUMxRixPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUVoRyxPQUFPLEVBQXdCLG9CQUFvQixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDdEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUV0RCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUUxRCxLQUFLLENBQUMsa0JBQWtCLEVBQUUsR0FBRyxFQUFFO0lBQzlCLHVDQUF1QyxFQUFFLENBQUM7SUFFMUMsU0FBUyxlQUFlLENBQ3ZCLEVBQXlHO1FBRXpHLDBCQUEwQixDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBRUQsU0FBUywwQkFBMEIsQ0FDbEMsZ0JBRVksRUFDWixFQUF5RztRQUV6RyxrQkFBa0IsQ0FBQyxhQUFhLEVBQUUsRUFBRSxFQUFFLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxFQUFFO1lBQzNELE1BQU0sV0FBVyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7WUFDMUMsZ0JBQWdCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFDeEMs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