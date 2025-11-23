/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { AbstractProgressScope, ScopedProgressIndicator } from '../../browser/progressIndicator.js';
import { ProgressBar } from '../../../../../base/browser/ui/progressbar/progressbar.js';
class TestProgressBar extends ProgressBar {
    constructor() {
        super(...arguments);
        this.fTotal = 0;
        this.fWorked = 0;
        this.fInfinite = false;
        this.fDone = false;
    }
    infinite() {
        this.fDone = null;
        this.fInfinite = true;
        return this;
    }
    total(total) {
        this.fDone = null;
        this.fTotal = total;
        return this;
    }
    hasTotal() {
        return !!this.fTotal;
    }
    worked(worked) {
        this.fDone = null;
        if (this.fWorked) {
            this.fWorked += worked;
        }
        else {
            this.fWorked = worked;
        }
        return this;
    }
    done() {
        this.fDone = true;
        this.fInfinite = null;
        this.fWorked = null;
        this.fTotal = null;
        return this;
    }
    stop() {
        return this.done();
    }
    show() { }
    hide() { }
}
suite('Progress Indicator', () => {
    const disposables = new DisposableStore();
    teardown(() => {
        disposables.clear();
    });
    test('ScopedProgressIndicator', async () => {
        const testProgressBar = disposables.add(new TestProgressBar(document.createElement('div')));
        const progressScope = disposables.add(new class extends AbstractProgressScope {
            constructor() { super('test.scopeId', true); }
            testOnScopeOpened(scopeId) { super.onScopeOpened(scopeId); }
            testOnScopeClosed(scopeId) { super.onScopeClosed(scopeId); }
        }());
        const testObject = disposables.add(new ScopedProgressIndicator(testProgressBar, progressScope));
        // Active: Show (Infinite)
        let fn = testObject.show(true);
        assert.strictEqual(true, testProgressBar.fInfinite);
        fn.done();
        assert.strictEqual(true, testProgressBar.fDone);
        // Active: Show (Total / Worked)
        fn = testObject.show(100);
        assert.strictEqual(false, !!testProgressBar.fInfinite);
        assert.strictEqual(100, testProgressBar.fTotal);
        fn.worked(20);
        assert.strictEqual(20, testProgressBar.fWorked);
        fn.total(80);
        assert.strictEqual(80, testProgressBar.fTotal);
        fn.done();
        assert.strictEqual(true, testProgressBar.fDone);
        // Inactive: Show (Infinite)
        progressScope.testOnScopeClosed('test.scopeId');
        testObject.show(true);
        assert.strictEqual(false, !!testProgressBar.fInfinite);
        progressScope.testOnScopeOpened('test.scopeId');
        assert.strictEqual(true, testProgressBar.fInfinite);
        // Inactive: Show (Total / Worked)
        progressScope.testOnScopeClosed('test.scopeId');
        fn = testObject.show(100);
        fn.total(80);
        fn.worked(20);
        assert.strictEqual(false, !!testProgressBar.fTotal);
        progressScope.testOnScopeOpened('test.scopeId');
        assert.strictEqual(20, testProgressBar.fWorked);
        assert.strictEqual(80, testProgressBar.fTotal);
        // Acive: Show While
        let p = Promise.resolve(null);
        await testObject.showWhile(p);
        assert.strictEqual(true, testProgressBar.fDone);
        progressScope.testOnScopeClosed('test.scopeId');
        p = Promise.resolve(null);
        await testObject.showWhile(p);
        assert.strictEqual(true, testProgressBar.fDone);
        progressScope.testOnScopeOpened('test.scopeId');
        assert.strictEqual(true, testProgressBar.fDone);
    });
    ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZ3Jlc3NJbmRpY2F0b3IudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvcHJvZ3Jlc3MvdGVzdC9icm93c2VyL3Byb2dyZXNzSW5kaWNhdG9yLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNwRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFFeEYsTUFBTSxlQUFnQixTQUFRLFdBQVc7SUFBekM7O1FBQ0MsV0FBTSxHQUFXLENBQUMsQ0FBQztRQUNuQixZQUFPLEdBQVcsQ0FBQyxDQUFDO1FBQ3BCLGNBQVMsR0FBWSxLQUFLLENBQUM7UUFDM0IsVUFBSyxHQUFZLEtBQUssQ0FBQztJQWlEeEIsQ0FBQztJQS9DUyxRQUFRO1FBQ2hCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1FBRXRCLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVRLEtBQUssQ0FBQyxLQUFhO1FBQzNCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDO1FBRXBCLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVRLFFBQVE7UUFDaEIsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUN0QixDQUFDO0lBRVEsTUFBTSxDQUFDLE1B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