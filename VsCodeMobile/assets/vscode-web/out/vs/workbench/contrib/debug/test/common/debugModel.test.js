/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { mockObject, upcastDeepPartial, upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { DebugModel, ExceptionBreakpoint, FunctionBreakpoint } from '../../common/debugModel.js';
import { MockDebugStorage } from './mockDebug.js';
import { runWithFakedTimers } from '../../../../../base/test/common/timeTravelScheduler.js';
suite('DebugModel', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('FunctionBreakpoint', () => {
        test('Id is saved', () => {
            const fbp = new FunctionBreakpoint({ name: 'function', enabled: true, hitCondition: 'hit condition', condition: 'condition', logMessage: 'log message' });
            const strigified = JSON.stringify(fbp);
            const parsed = JSON.parse(strigified);
            assert.equal(parsed.id, fbp.getId());
        });
    });
    suite('ExceptionBreakpoint', () => {
        test('Restored matches new', () => {
            const ebp = new ExceptionBreakpoint({
                conditionDescription: 'condition description',
                description: 'description',
                filter: 'condition',
                label: 'label',
                supportsCondition: true,
                enabled: true,
            }, 'id');
            const strigified = JSON.stringify(ebp);
            const parsed = JSON.parse(strigified);
            const newEbp = new ExceptionBreakpoint(parsed);
            assert.ok(ebp.matches(newEbp));
        });
    });
    suite('DebugModel', () => {
        test('refreshTopOfCallstack resolves all returned promises when called multiple times', async () => {
            return runWithFakedTimers({}, async () => {
                const topFrameDeferred = new DeferredPromise();
                const wholeStackDeferred = new DeferredPromise();
                const fakeThread = mockObject()({
                    session: upcastDeepPartial({ capabilities: { supportsDelayedStackTraceLoading: true } }),
                    getCallStack: () => [],
                    getStaleCallStack: () => [],
                });
                fakeThread.fetchCallStack.callsFake((levels) => {
                    return levels === 1 ? topFrameDeferred.p : wholeStackDeferred.p;
                });
                fakeThread.getId.returns(1);
                const disposable = new DisposableStore();
                const storage = disposable.add(new TestStorageService());
                const model = new DebugModel(disposable.add(new MockDebugStorage(storage)), upcastPartial({ isDirty: (e) => false }), undefined, new NullLogService());
                disposable.add(model);
                let top1Resolved = false;
                let whole1Resolved = false;
                let top2Resolved = false;
                let whole2Resolved = false;
                // eslint-disable-next-line local/code-no-any-casts
                const result1 = model.refreshTopOfCallstack(fakeThread);
                result1.topCallStack.then(() => top1Resolved = true);
                result1.wholeCallStack.then(() => whole1Resolved = true);
                // eslint-disable-next-line local/code-no-any-casts
                const result2 = model.refreshTopOfCallstack(fakeThread);
                result2.topCallStack.then(() => top2Resolved = true);
                result2.wholeCallStack.then(() => whole2Resolved = true);
                assert.ok(!top1Resolved);
                assert.ok(!whole1Resolved);
                assert.ok(!top2Resolved);
                assert.ok(!whole2Resolved);
                await topFrameDeferred.complete();
                await result1.topCallStack;
                await result2.topCallStack;
                assert.ok(!whole1Resolved);
                assert.ok(!whole2Resolved);
                await wholeStackDeferred.complete();
                await result1.wholeCallStack;
                await result2.wholeCallStack;
                disposable.dispose();
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWdNb2RlbC50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2RlYnVnL3Rlc3QvY29tbW9uL2RlYnVnTW9kZWwudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLGFBQWEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUUzRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUV0RixPQUFPLEVBQUUsVUFBVSxFQUFFLG1CQUFtQixFQUFFLGtCQUFrQixFQUFVLE1BQU0sNEJBQTRCLENBQUM7QUFDekcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDbEQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFFNUYsS0FBSyxDQUFDLFlBQVksRUFBRSxHQUFHLEVBQUU7SUFDeEIsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxLQUFLLENBQUMsb0JBQW9CLEVBQUUsR0FBRyxFQUFFO1FBQ2hDLElBQUksQ0FBQyxhQUFhLEVBQUUsR0FBRyxFQUFFO1lBQ3hCLE1BQU0sR0FBRyxHQUFHLElBQUksa0JBQWtCLENBQUMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLGVBQWUs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