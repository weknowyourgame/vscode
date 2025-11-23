/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { DeferredPromise } from '../../../base/common/async.js';
import { CancellationTokenSource } from '../../../base/common/cancellation.js';
import { Disposable, DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
export const IProgressService = createDecorator('progressService');
export var ProgressLocation;
(function (ProgressLocation) {
    ProgressLocation[ProgressLocation["Explorer"] = 1] = "Explorer";
    ProgressLocation[ProgressLocation["Scm"] = 3] = "Scm";
    ProgressLocation[ProgressLocation["Extensions"] = 5] = "Extensions";
    ProgressLocation[ProgressLocation["Window"] = 10] = "Window";
    ProgressLocation[ProgressLocation["Notification"] = 15] = "Notification";
    ProgressLocation[ProgressLocation["Dialog"] = 20] = "Dialog";
})(ProgressLocation || (ProgressLocation = {}));
export const emptyProgressRunner = Object.freeze({
    total() { },
    worked() { },
    done() { }
});
export class Progress {
    static { this.None = Object.freeze({ report() { } }); }
    get value() { return this._value; }
    constructor(callback) {
        this.callback = callback;
    }
    report(item) {
        this._value = item;
        this.callback(this._value);
    }
}
/**
 * RAII-style progress instance that allows imperative reporting and hides
 * once `dispose()` is called.
 */
let UnmanagedProgress = class UnmanagedProgress extends Disposable {
    constructor(options, progressService) {
        super();
        this.deferred = new DeferredPromise();
        progressService.withProgress(options, reporter => {
            this.reporter = reporter;
            if (this.lastStep) {
                reporter.report(this.lastStep);
            }
            return this.deferred.p;
        });
        this._register(toDisposable(() => this.deferred.complete()));
    }
    report(step) {
        if (this.reporter) {
            this.reporter.report(step);
        }
        else {
            this.lastStep = step;
        }
    }
};
UnmanagedProgress = __decorate([
    __param(1, IProgressService)
], UnmanagedProgress);
export { UnmanagedProgress };
export class LongRunningOperation extends Disposable {
    constructor(progressIndicator) {
        super();
        this.progressIndicator = progressIndicator;
        this.currentOperationId = 0;
        this.currentOperationDisposables = this._register(new DisposableStore());
        this.currentProgressTimeout = undefined;
    }
    start(progressDelay) {
        // Stop any previous operation
        this.stop();
        // Start new
        const newOperationId = ++this.currentOperationId;
        const newOperationToken = new CancellationTokenSource();
        this.currentProgressTimeout = setTimeout(() => {
            if (newOperationId === this.currentOperationId) {
                this.currentProgressRunner = this.progressIndicator.show(true);
            }
        }, progressDelay);
        this.currentOperationDisposables.add(toDisposable(() => clearTimeout(this.currentProgressTimeout)));
        this.currentOperationDisposables.add(toDisposable(() => newOperationToken.cancel()));
        this.currentOperationDisposables.add(toDisposable(() => this.currentProgressRunner ? this.currentProgressRunner.done() : undefined));
        return {
            id: newOperationId,
            token: newOperationToken.token,
            stop: () => this.doStop(newOperationId),
            isCurrent: () => this.currentOperationId === newOperationId
        };
    }
    stop() {
        this.doStop(this.currentOperationId);
    }
    doStop(operationId) {
        if (this.currentOperationId === operationId) {
            this.currentOperationDisposables.clear();
        }
    }
}
export const IEditorProgressService = createDecorator('editorProgressService');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZ3Jlc3MuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNoRSxPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRzlFLE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFHLGVBQWUsQ0FBbUIsaUJBQWlCLENBQUMsQ0FBQztBQStCckYsTUFBTSxDQUFOLElBQWtCLGdCQU9qQjtBQVBELFdBQWtCLGdCQUFnQjtJQUNqQywrREFBWSxDQUFBO0lBQ1oscURBQU8sQ0FBQTtJQUNQLG1FQUFjLENBQUE7SUFDZCw0REFBVyxDQUFBO0lBQ1gsd0VBQWlCLENBQUE7SUFDakIsNERBQVcsQ0FBQTtBQUNaLENBQUMsRUFQaUIsZ0JBQWdCLEtBQWhCLGdCQUFnQixRQU9qQztBQWlERCxNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFrQjtJQUNqRSxLQUFLLEtBQUssQ0FBQztJQUNYLE1BQU0sS0FBSyxDQUFDO0lBQ1osSUFBSSxLQUFLLENBQUM7Q0FDVixDQUFDLENBQUM7QUFNSCxNQUFNLE9BQU8sUUFBUTthQUVKLFNBQUksR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFxQixFQUFFLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBRzNFLElBQUksS0FBSyxLQUFvQixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxD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