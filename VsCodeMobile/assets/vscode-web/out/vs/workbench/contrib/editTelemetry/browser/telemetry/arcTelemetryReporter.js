var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { TimeoutTimer } from '../../../../../base/common/async.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { runOnChange } from '../../../../../base/common/observable.js';
import { BaseStringEdit } from '../../../../../editor/common/core/edits/stringEdit.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { ArcTracker } from '../../common/arcTracker.js';
let ArcTelemetryReporter = class ArcTelemetryReporter extends Disposable {
    constructor(_timesMs, _documentValueBeforeTrackedEdit, _document, 
    // _markedEdits -> document.value
    _gitRepo, _trackedEdit, _sendTelemetryEvent, _onBeforeDispose, _telemetryService) {
        super();
        this._timesMs = _timesMs;
        this._documentValueBeforeTrackedEdit = _documentValueBeforeTrackedEdit;
        this._document = _document;
        this._gitRepo = _gitRepo;
        this._trackedEdit = _trackedEdit;
        this._sendTelemetryEvent = _sendTelemetryEvent;
        this._onBeforeDispose = _onBeforeDispose;
        this._telemetryService = _telemetryService;
        this._arcTracker = new ArcTracker(this._documentValueBeforeTrackedEdit, this._trackedEdit);
        this._store.add(toDisposable(() => {
            this._onBeforeDispose();
        }));
        this._store.add(runOnChange(this._document.value, (_val, _prevVal, changes) => {
            const edit = BaseStringEdit.composeOrUndefined(changes.map(c => c.edit));
            if (edit) {
                this._arcTracker.handleEdits(edit);
            }
        }));
        this._initialLineCounts = this._arcTracker.getLineCountInfo();
        this._initialBranchName = this._gitRepo.get()?.headBranchNameObs.get();
        for (let i = 0; i < this._timesMs.length; i++) {
            const timeMs = this._timesMs[i];
            if (timeMs <= 0) {
                this._report(timeMs);
            }
            else {
                this._reportAfter(timeMs, i === this._timesMs.length - 1 ? () => {
                    this.dispose();
                } : undefined);
            }
        }
    }
    _reportAfter(timeoutMs, cb) {
        const timer = new TimeoutTimer(() => {
            this._report(timeoutMs);
            timer.dispose();
            if (cb) {
                cb();
            }
        }, timeoutMs);
        this._store.add(timer);
    }
    _report(timeMs) {
        const currentBranch = this._gitRepo.get()?.headBranchNameObs.get();
        const didBranchChange = currentBranch !== this._initialBranchName;
        const currentLineCounts = this._arcTracker.getLineCountInfo();
        this._sendTelemetryEvent({
            telemetryService: this._telemetryService,
            timeDelayMs: timeMs,
            didBranchChange,
            arc: this._arcTracker.getAcceptedRestrainedCharactersCount(),
            originalCharCount: this._arcTracker.getOriginalCharacterCount(),
            currentLineCount: currentLineCounts.insertedLineCounts,
            currentDeletedLineCount: currentLineCounts.deletedLineCounts,
            originalLineCount: this._initialLineCounts.insertedLineCounts,
            originalDeletedLineCount: this._initialLineCounts.deletedLineCounts,
        });
    }
};
ArcTelemetryReporter = __decorate([
    __param(7, ITelemetryService)
], ArcTelemetryReporter);
export { ArcTelemetryReporter };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJjVGVsZW1ldHJ5UmVwb3J0ZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZWRpdFRlbGVtZXRyeS9icm93c2VyL3RlbGVtZXRyeS9hcmNUZWxlbWV0cnlSZXBvcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQTs7O2dHQUdnRztBQUNoRyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDbkUsT0FBTyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNuRixPQUFPLEVBQXNDLFdBQVcsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQzNHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUV2RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFHakQsSUFBTSxvQkFBb0IsR0FBMUIsTUFBTSxvQkFBcUIsU0FBUSxVQUFVO0lBTW5ELFlBQ2tCLFFBQWtCLEVBQ2xCLCtCQUEyQyxFQUMzQyxTQUFpRjtJQUNsRyxpQ0FBaUM7SUFDaEIsUUFBaUQsRUFDakQsWUFBNEIsRUFDNUIsbUJBQTRELEVBQzVELGdCQUE0QixFQUNULGlCQUFvQztRQUV4RSxLQUFLLEVBQUUsQ0FBQztRQVZTLGFBQVEsR0FBUixRQUFRLENBQVU7UUFDbEIsb0NBQStCLEdBQS9CLCtCQUErQixDQUFZO1FBQzNDLGNBQVMsR0FBVCxTQUFTLENBQXdFO1FBRWpGLGFBQVEsR0FBUixRQUFRLENBQXlDO1FBQ2pELGlCQUFZLEdBQVosWUFBWSxDQUFnQjtRQUM1Qix3QkFBbUIsR0FBbkIsbUJBQW1CLENBQXlDO1FBQzVELHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBWTtRQUNULHNCQUFpQixH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