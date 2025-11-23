/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { NullTelemetryService } from '../../../../../platform/telemetry/common/telemetryUtils.js';
import { TestId } from '../../common/testId.js';
import { TestProfileService } from '../../common/testProfileService.js';
import { HydratedTestResult, LiveTestResult, TaskRawOutput, resultItemParents } from '../../common/testResult.js';
import { TestResultService } from '../../common/testResultService.js';
import { InMemoryResultStorage } from '../../common/testResultStorage.js';
import { makeEmptyCounts } from '../../common/testingStates.js';
import { getInitializedMainTestCollection, testStubs } from './testStubs.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
suite('Workbench - Test Results Service', () => {
    const getLabelsIn = (it) => [...it].map(t => t.item.label).sort();
    const getChangeSummary = () => [...changed]
        .map(c => ({ reason: c.reason, label: c.item.item.label }));
    let r;
    let changed = new Set();
    let tests;
    const defaultOpts = (testIds) => ({
        group: 2 /* TestRunProfileBitset.Run */,
        targets: [{
                profileId: 0,
                controllerId: 'ctrlId',
                testIds,
            }]
    });
    let insertCounter = 0;
    class TestLiveTestResult extends LiveTestResult {
        constructor(id, persist, request) {
            super(id, persist, request, insertCounter++, NullTelemetryService);
            ds.add(this);
        }
        setAllToStatePublic(state, taskId, when) {
            this.setAllToState(state, taskId, when);
        }
    }
    const ds = ensureNoDisposablesAreLeakedInTestSuite();
    setup(async () => {
        changed = new Set();
        r = ds.add(new TestLiveTestResult('foo', true, defaultOpts(['id-a'])));
        ds.add(r.onChange(e => changed.add(e)));
        r.addTask({ id: 't', name: 'n', running: true, ctrlId: 'ctrl' });
        tests = ds.add(testStubs.nested());
        const cts = ds.add(new CancellationTokenSource());
        const ok = await Promise.race([
            Promise.resolve(tests.expand(tests.root.id, Infinity)).then(() => true),
            timeout(1000, cts.token).then(() => false),
        ]);
        cts.cancel();
        // todo@connor4312: debug for tests #137853:
        if (!ok) {
            throw new Error('timed out while expanding, diff: ' + JSON.stringify(tests.collectDiff()));
        }
        r.addTestChainToRun('ctrlId', [
            tests.root.toTestItem(),
            tests.root.children.get('id-a').toTestItem(),
            tests.root.children.get('id-a').children.get('id-aa').toTestItem(),
        ]);
        r.addTestChainToRun('ctrlId', [
            tests.root.children.get('id-a').toTestItem(),
            tests.root.children.get('id-a').children.get('id-ab').toTestItem(),
        ]);
    });
    // ensureNoDisposablesAreLeakedInTestSuite(); todo@connor4312
    suite('LiveTestResult', () => {
        test('is empty if no tests are yet present', async () => {
            assert.deepStrictEqual(getLabelsIn(new TestLiveTestResult('foo', false, defaultOpts(['id-a'])).tests), []);
        });
        test('initially queues nothing', () => {
            assert.deepStrictEqual(getChangeSummary(), []);
        });
        test('initializes with the subtree of requested tests', () => {
            assert.deepStrictEqual(getLabelsIn(r.tests), ['a', 'aa', 'ab', 'root']);
        });
        test('initializes with valid counts', () => {
            const c = makeEmptyCounts();
            c[0 /* TestResultState.Unset */] = 4;
            assert.deepStrictEqual(r.counts, c);
        });
        test('setAllToState', () => {
            changed.clear();
            r.setAllToStatePublic(1 /* TestResultState.Queued */, 't', (_, t) => t.item.label !== 'root');
            const c = makeEmptyCounts();
            c[0 /* TestResultState.Unset */] = 1;
            c[1 /* TestResultState.Queued */] = 3;
            assert.deepStrictEqual(r.counts, c);
            r.setAllToStatePublic(4 /* TestResultState.Failed */, 't', (_, t) => t.item.label !== 'root');
            const c2 = makeEmptyCounts();
            c2[0 /* TestResultState.Unset */] = 1;
            c2[4 /* TestResultState.Failed */] = 3;
            assert.deepStrictEqual(r.counts, c2);
            assert.deepStrictEqual(r.getStateById(new TestId(['ctrlId', 'id-a']).toString())?.ownComputedState, 4 /* TestResultState.Failed */);
            assert.deepStrictEqual(r.getStateById(new TestId(['ctrlId', 'id-a']).toString())?.tasks[0].state, 4 /* TestResultState.Failed */);
            assert.deepStrictEqual(getChangeSummary(), [
                { label: 'a', reason: 1 /* TestResultItemChangeReason.OwnStateChange */ },
                { label: 'root', reason: 0 /* TestResultItemChangeReason.ComputedStateChange */ },
                { label: 'aa', reason: 1 /* TestResultItemChangeReason.OwnStateChange */ },
                { label: 'ab', reason: 1 /* TestResultItemChangeReason.OwnStateChange */ },
                { label: 'a', reason: 1 /* TestResultItemChangeReason.OwnStateChange */ },
                { label: 'root', reason: 0 /* TestResultItemChangeReason.ComputedStateChange */ },
                { label: 'aa', reason: 1 /* TestResultItemChangeReason.OwnStateChange */ },
                { label: 'ab', reason: 1 /* TestResultItemChangeReason.OwnStateChange */ },
            ]);
        });
        test('updateState', () => {
            changed.clear();
            const testId = new TestId(['ctrlId', 'id-a', 'id-aa']).toString();
            r.updateState(testId, 't', 2 /* TestResultState.Running */);
            const c = makeEmptyCounts();
            c[2 /* TestResultState.Running */] = 1;
            c[0 /* TestResultState.Unset */] = 3;
            assert.deepStrictEqual(r.counts, c);
            assert.deepStrictEqual(r.getStateById(testId)?.ownComputedState, 2 /* TestResultState.Running */);
            // update computed state:
            assert.deepStrictEqual(r.getStateById(tests.root.id)?.computedState, 2 /* TestResultState.Running */);
            assert.deepStrictEqual(getChangeSummary(), [
                { label: 'aa', reason: 1 /* TestResultItemChangeReason.OwnStateChange */ },
                { label: 'a', reason: 0 /* TestResultItemChangeReason.ComputedStateChange */ },
                { label: 'root', reason: 0 /* TestResultItemChangeReason.ComputedStateChange */ },
            ]);
            r.updateState(testId, 't', 3 /* TestResultState.Passed */);
            assert.deepStrictEqual(r.getStateById(testId)?.ownComputedState, 3 /* TestResultState.Passed */);
            r.updateState(testId, 't', 6 /* TestResultState.Errored */);
            assert.deepStrictEqual(r.getStateById(testId)?.ownComputedState, 6 /* TestResultState.Errored */);
            r.updateState(testId, 't', 3 /* TestResultState.Passed */);
            assert.deepStrictEqual(r.getStateById(testId)?.ownComputedState, 6 /* TestResultState.Errored */);
        });
        test('ignores outside run', () => {
            changed.clear();
            r.updateState(new TestId(['ctrlId', 'id-b']).toString(), 't', 2 /* TestResultState.Running */);
            const c = makeEmptyCounts();
            c[0 /* TestResultState.Unset */] = 4;
            assert.deepStrictEqual(r.counts, c);
            assert.deepStrictEqual(r.getStateById(new TestId(['ctrlId', 'id-b']).toString()), undefined);
        });
        test('markComplete', () => {
            r.setAllToStatePublic(1 /* TestResultState.Queued */, 't', () => true);
            r.updateState(new TestId(['ctrlId', 'id-a', 'id-aa']).toString(), 't', 3 /* TestResultState.Passed */);
            changed.clear();
            r.markComplete();
            const c = makeEmptyCounts();
            c[5 /* TestResultState.Skipped */] = 3;
            c[3 /* TestResultState.Passed */] = 1;
            assert.deepStrictEqual(r.counts, c);
            assert.deepStrictEqual(r.getStateById(tests.root.id)?.ownComputedState, 5 /* TestResultState.Skipped */);
            assert.deepStrictEqual(r.getStateById(new TestId(['ctrlId', 'id-a', 'id-aa']).toString())?.ownComputedState, 3 /* TestResultState.Passed */);
        });
    });
    suite('service', () => {
        let storage;
        let results;
        class TestTestResultService extends TestResultService {
            constructor() {
                super(...arguments);
                this.persistScheduler = upcastPartial({ schedule: () => this.persistImmediately() });
            }
        }
        setup(() => {
            storage = ds.add(new InMemoryResultStorage({
                asCanonicalUri(uri) {
                    return uri;
                },
            }, ds.add(new TestStorageService()), new NullLogService()));
            results = ds.add(new TestTestResultService(new MockContextKeyService(), storage, ds.add(new TestProfileService(new MockContextKeyService(), ds.add(new TestStorageService()))), NullTelemetryService));
        });
        test('pushes new result', () => {
            results.push(r);
            assert.deepStrictEqual(results.results, [r]);
        });
        test('serializes and re-hydrates', async () => {
            results.push(r);
            r.updateState(new TestId(['ctrlId', 'id-a', 'id-aa']).toString(), 't', 3 /* TestResultState.Passed */, 42);
            r.markComplete();
            await timeout(10); // allow persistImmediately async to happen
            results = ds.add(new TestResultService(new MockContextKeyService(), storage, ds.add(new TestProfileService(new MockContextKeyService(), ds.add(new TestStorageService()))), NullTelemetryService));
            assert.strictEqual(0, results.results.length);
            await timeout(10); // allow load promise to resolve
            assert.strictEqual(1, results.results.length);
            const [rehydrated, actual] = results.getStateById(tests.root.id);
            const expected = { ...r.getStateById(tests.root.id) };
            expected.item.uri = actual.item.uri;
            expected.item.children = undefined;
            expected.retired = true;
            delete expected.children;
            assert.deepStrictEqual(actual, { ...expected });
            assert.deepStrictEqual(rehydrated.counts, r.counts);
            assert.strictEqual(typeof rehydrated.completedAt, 'number');
        });
        test('clears results but keeps ongoing tests', async () => {
            results.push(r);
            r.markComplete();
            const r2 = results.push(new LiveTestResult('', false, defaultOpts([]), insertCounter++, NullTelemetryService));
            results.clear();
            assert.deepStrictEqual(results.results, [r2]);
        });
        test('keeps ongoing tests on top, restored order when done', async () => {
            results.push(r);
            const r2 = results.push(new LiveTestResult('', false, defaultOpts([]), insertCounter++, NullTelemetryService));
            assert.deepStrictEqual(results.results, [r2, r]);
            r2.markComplete();
            assert.deepStrictEqual(results.results, [r, r2]);
            r.markComplete();
            assert.deepStrictEqual(results.results, [r2, r]);
        });
        const makeHydrated = async (completedAt = 42, state = 3 /* TestResultState.Passed */) => new HydratedTestResult({
            asCanonicalUri(uri) {
                return uri;
            },
        }, {
            completedAt,
            id: 'some-id',
            tasks: [{ id: 't', name: undefined, ctrlId: 'ctrl', hasCoverage: false }],
            name: 'hello world',
            request: defaultOpts([]),
            items: [{
                    ...(await getInitializedMainTestCollection()).getNodeById(new TestId(['ctrlId', 'id-a']).toString()),
                    tasks: [{ state, duration: 0, messages: [] }],
                    computedState: state,
                    ownComputedState: state,
                }]
        });
        test('pushes hydrated results', async () => {
            results.push(r);
            const hydrated = await makeHydrated();
            results.push(hydrated);
            assert.deepStrictEqual(results.results, [r, hydrated]);
        });
        test('inserts in correct order', async () => {
            results.push(r);
            const hydrated1 = await makeHydrated();
            results.push(hydrated1);
            assert.deepStrictEqual(results.results, [r, hydrated1]);
        });
        test('inserts in correct order 2', async () => {
            results.push(r);
            const hydrated1 = await makeHydrated();
            results.push(hydrated1);
            const hydrated2 = await makeHydrated(30);
            results.push(hydrated2);
            assert.deepStrictEqual(results.results, [r, hydrated1, hydrated2]);
        });
    });
    test('resultItemParents', function () {
        assert.deepStrictEqual([...resultItemParents(r, r.getStateById(new TestId(['ctrlId', 'id-a', 'id-aa']).toString()))], [
            r.getStateById(new TestId(['ctrlId', 'id-a', 'id-aa']).toString()),
            r.getStateById(new TestId(['ctrlId', 'id-a']).toString()),
            r.getStateById(new TestId(['ctrlId']).toString()),
        ]);
        assert.deepStrictEqual([...resultItemParents(r, r.getStateById(tests.root.id))], [
            r.getStateById(tests.root.id),
        ]);
    });
    suite('output controller', () => {
        test('reads live output ranges', async () => {
            const ctrl = new TaskRawOutput();
            ctrl.append(VSBuffer.fromString('12345'));
            ctrl.append(VSBuffer.fromString('67890'));
            ctrl.append(VSBuffer.fromString('12345'));
            ctrl.append(VSBuffer.fromString('67890'));
            assert.deepStrictEqual(ctrl.getRange(0, 5), VSBuffer.fromString('12345'));
            assert.deepStrictEqual(ctrl.getRange(5, 5), VSBuffer.fromString('67890'));
            assert.deepStrictEqual(ctrl.getRange(7, 6), VSBuffer.fromString('890123'));
            assert.deepStrictEqual(ctrl.getRange(15, 5), VSBuffer.fromString('67890'));
            assert.deepStrictEqual(ctrl.getRange(15, 10), VSBuffer.fromString('67890'));
        });
        test('corrects offsets for marked ranges', async () => {
            const ctrl = new TaskRawOutput();
            const a1 = ctrl.append(VSBuffer.fromString('12345'), 1);
            const a2 = ctrl.append(VSBuffer.fromString('67890'), 1234);
            const a3 = ctrl.append(VSBuffer.fromString('with new line\r\n'), 4);
            assert.deepStrictEqual(ctrl.getRange(a1.offset, a1.length), VSBuffer.fromString('\x1b]633;SetMark;Id=s1;Hidden\x0712345\x1b]633;SetMark;Id=e1;Hidden\x07'));
            assert.deepStrictEqual(ctrl.getRange(a2.offset, a2.length), VSBuffer.fromString('\x1b]633;SetMark;Id=s1234;Hidden\x0767890\x1b]633;SetMark;Id=e1234;Hidden\x07'));
            assert.deepStrictEqual(ctrl.getRange(a3.offset, a3.length), VSBuffer.fromString('\x1b]633;SetMark;Id=s4;Hidden\x07with new line\x1b]633;SetMark;Id=e4;Hidden\x07\r\n'));
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdFJlc3VsdFNlcnZpY2UudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL3Rlc3QvY29tbW9uL3Rlc3RSZXN1bHRTZXJ2aWNlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBb0IsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDaEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3JGLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHlFQUF5RSxDQUFDO0FBQ2hILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUVsRyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDaEQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDeEUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLGNBQWMsRUFBRSxhQUFhLEVBQW9ELGlCQUFpQixFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDcEssT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdEUsT0FBTyxFQUFzQixxQkFBcUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRTlGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNoRSxPQUFPLEVBQXNCLGdDQUFnQyxFQUFFLFNBQVMsRUFBRSxNQUFNLGdC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LEVBQUU7WUFDM0MsTUFBTSxJQUFJLEdBQUcsSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUVqQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUMxQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUMxQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUMxQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUUxQyxNQUFNLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUMxRSxNQUFNLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUMxRSxNQUFNLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUMzRSxNQUFNLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUMzRSxNQUFNLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUM3RSxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxvQ0FBb0MsRUFBRSxLQUFLLElBQUksRUFBRTtZQUNyRCxNQUFNLElBQUksR0FBRyxJQUFJLGFBQWEsRUFBRSxDQUFDO1lBRWpDLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN4RCxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDM0QsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLG1CQUFtQixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFFcEUsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFLFFBQVEsQ0FBQyxVQUFVLENBQUMseUVBQXlFLENBQUMsQ0FBQyxDQUFDO1lBQzVKLE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLCtFQUErRSxDQUFDLENBQUMsQ0FBQztZQUNsSyxNQUFNLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsUUFBUSxDQUFDLFVBQVUsQ0FBQyxxRkFBcUYsQ0FBQyxDQUFDLENBQUM7UUFDekssQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIn0=