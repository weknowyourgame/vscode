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
import { reverseOrder, compareBy, numberComparator, sumBy } from '../../../../../base/common/arrays.js';
import { IntervalTimer, TimeoutTimer } from '../../../../../base/common/async.js';
import { toDisposable, Disposable } from '../../../../../base/common/lifecycle.js';
import { mapObservableArrayCached, derived, observableSignal, runOnChange, autorun } from '../../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { CreateSuggestionIdForChatOrInlineChatCaller, EditTelemetryReportEditArcForChatOrInlineChatSender, EditTelemetryReportInlineEditArcSender } from './arcTelemetrySender.js';
import { createDocWithJustReason } from '../helpers/documentWithAnnotatedEdits.js';
import { DocumentEditSourceTracker } from './editTracker.js';
import { sumByCategory } from '../helpers/utils.js';
import { ScmAdapter } from './scmAdapter.js';
import { IRandomService } from '../randomService.js';
let EditSourceTrackingImpl = class EditSourceTrackingImpl extends Disposable {
    constructor(_statsEnabled, _annotatedDocuments, _instantiationService) {
        super();
        this._statsEnabled = _statsEnabled;
        this._annotatedDocuments = _annotatedDocuments;
        this._instantiationService = _instantiationService;
        const scmBridge = this._instantiationService.createInstance(ScmAdapter);
        this._states = mapObservableArrayCached(this, this._annotatedDocuments.documents, (doc, store) => {
            return [doc.document, store.add(this._instantiationService.createInstance(TrackedDocumentInfo, doc, scmBridge, this._statsEnabled))];
        });
        this.docsState = this._states.map((entries) => new Map(entries));
        this.docsState.recomputeInitiallyAndOnChange(this._store);
    }
};
EditSourceTrackingImpl = __decorate([
    __param(2, IInstantiationService)
], EditSourceTrackingImpl);
export { EditSourceTrackingImpl };
let TrackedDocumentInfo = class TrackedDocumentInfo extends Disposable {
    constructor(_doc, _scm, _statsEnabled, _instantiationService, _telemetryService, _randomService) {
        super();
        this._doc = _doc;
        this._scm = _scm;
        this._statsEnabled = _statsEnabled;
        this._instantiationService = _instantiationService;
        this._telemetryService = _telemetryService;
        this._randomService = _randomService;
        this._repo = derived(this, reader => this._scm.getRepo(_doc.document.uri, reader));
        const docWithJustReason = createDocWithJustReason(_doc.documentWithAnnotations, this._store);
        const longtermResetSignal = observableSignal('resetSignal');
        let longtermReason = 'closed';
        this.longtermTracker = derived((reader) => {
            if (!this._statsEnabled.read(reader)) {
                return undefined;
            }
            longtermResetSignal.read(reader);
            const t = reader.store.add(new DocumentEditSourceTracker(docWithJustReason, undefined));
            reader.store.add(toDisposable(() => {
                // send long term document telemetry
                if (!t.isEmpty()) {
                    this.sendTelemetry('longterm', longtermReason, t);
                }
                t.dispose();
            }));
            return t;
        }).recomputeInitiallyAndOnChange(this._store);
        this._store.add(new IntervalTimer()).cancelAndSet(() => {
            // Reset after 10 hours
            longtermReason = '10hours';
            longtermResetSignal.trigger(undefined);
            longtermReason = 'closed';
        }, 10 * 60 * 60 * 1000);
        // Reset on branch change or commit
        this._store.add(autorun(reader => {
            const repo = this._repo.read(reader);
            if (repo) {
                reader.store.add(runOnChange(repo.headCommitHashObs, () => {
                    longtermReason = 'hashChange';
                    longtermResetSignal.trigger(undefined);
                    longtermReason = 'closed';
                }));
                reader.store.add(runOnChange(repo.headBranchNameObs, () => {
                    longtermReason = 'branchChange';
                    longtermResetSignal.trigger(undefined);
                    longtermReason = 'closed';
                }));
            }
        }));
        this._store.add(this._instantiationService.createInstance(EditTelemetryReportInlineEditArcSender, _doc.documentWithAnnotations, this._repo));
        this._store.add(this._instantiationService.createInstance(EditTelemetryReportEditArcForChatOrInlineChatSender, _doc.documentWithAnnotations, this._repo));
        this._store.add(this._instantiationService.createInstance(CreateSuggestionIdForChatOrInlineChatCaller, _doc.documentWithAnnotations));
        const resetSignal = observableSignal('resetSignal');
        this.windowedTracker = derived((reader) => {
            if (!this._statsEnabled.read(reader)) {
                return undefined;
            }
            if (!this._doc.isVisible.read(reader)) {
                return undefined;
            }
            resetSignal.read(reader);
            reader.store.add(new TimeoutTimer(() => {
                // Reset after 5 minutes
                resetSignal.trigger(undefined);
            }, 5 * 60 * 1000));
            const t = reader.store.add(new DocumentEditSourceTracker(docWithJustReason, undefined));
            reader.store.add(toDisposable(async () => {
                // send long term document telemetry
                this.sendTelemetry('5minWindow', 'time', t);
                t.dispose();
            }));
            return t;
        }).recomputeInitiallyAndOnChange(this._store);
    }
    async sendTelemetry(mode, trigger, t) {
        const ranges = t.getTrackedRanges();
        const keys = t.getAllKeys();
        if (keys.length === 0) {
            return;
        }
        const data = this.getTelemetryData(ranges);
        const statsUuid = this._randomService.generateUuid();
        const sums = sumByCategory(ranges, r => r.range.length, r => r.sourceKey);
        const entries = Object.entries(sums).filter(([key, value]) => value !== undefined);
        entries.sort(reverseOrder(compareBy(([key, value]) => value, numberComparator)));
        entries.length = mode === 'longterm' ? 30 : 10;
        for (const key of keys) {
            if (!sums[key]) {
                sums[key] = 0;
            }
        }
        for (const [key, value] of Object.entries(sums)) {
            if (value === undefined) {
                continue;
            }
            const repr = t.getRepresentative(key);
            const deltaModifiedCount = t.getTotalInsertedCharactersCount(key);
            this._telemetryService.publicLog2('editTelemetry.editSources.details', {
                mode,
                sourceKey: key,
                sourceKeyCleaned: repr.toKey(1, { $extensionId: false, $extensionVersion: false, $modelId: false }),
                extensionId: repr.props.$extensionId,
                extensionVersion: repr.props.$extensionVersion,
                modelId: repr.props.$modelId,
                trigger,
                languageId: this._doc.document.languageId.get(),
                statsUuid: statsUuid,
                modifiedCount: value,
                deltaModifiedCount: deltaModifiedCount,
                totalModifiedCount: data.totalModifiedCharactersInFinalState,
            });
        }
        const isTrackedByGit = await data.isTrackedByGit;
        this._telemetryService.publicLog2('editTelemetry.editSources.stats', {
            mode,
            languageId: this._doc.document.languageId.get(),
            statsUuid: statsUuid,
            nesModifiedCount: data.nesModifiedCount,
            inlineCompletionsCopilotModifiedCount: data.inlineCompletionsCopilotModifiedCount,
            inlineCompletionsNESModifiedCount: data.inlineCompletionsNESModifiedCount,
            otherAIModifiedCount: data.otherAIModifiedCount,
            unknownModifiedCount: data.unknownModifiedCount,
            userModifiedCount: data.userModifiedCount,
            ideModifiedCount: data.ideModifiedCount,
            totalModifiedCharacters: data.totalModifiedCharactersInFinalState,
            externalModifiedCount: data.externalModifiedCount,
            isTrackedByGit: isTrackedByGit ? 1 : 0,
        });
    }
    getTelemetryData(ranges) {
        const getEditCategory = (source) => {
            if (source.category === 'ai' && source.kind === 'nes') {
                return 'nes';
            }
            if (source.category === 'ai' && source.kind === 'completion' && source.extensionId === 'github.copilot') {
                return 'inlineCompletionsCopilot';
            }
            if (source.category === 'ai' && source.kind === 'completion' && source.extensionId === 'github.copilot-chat' && source.providerId === 'completions') {
                return 'inlineCompletionsCopilot';
            }
            if (source.category === 'ai' && source.kind === 'completion' && source.extensionId === 'github.copilot-chat' && source.providerId === 'nes') {
                return 'inlineCompletionsNES';
            }
            if (source.category === 'ai' && source.kind === 'completion') {
                return 'inlineCompletionsOther';
            }
            if (source.category === 'ai') {
                return 'otherAI';
            }
            if (source.category === 'user') {
                return 'user';
            }
            if (source.category === 'ide') {
                return 'ide';
            }
            if (source.category === 'external') {
                return 'external';
            }
            if (source.category === 'unknown') {
                return 'unknown';
            }
            return 'unknown';
        };
        const sums = sumByCategory(ranges, r => r.range.length, r => getEditCategory(r.source));
        const totalModifiedCharactersInFinalState = sumBy(ranges, r => r.range.length);
        return {
            nesModifiedCount: sums.nes ?? 0,
            inlineCompletionsCopilotModifiedCount: sums.inlineCompletionsCopilot ?? 0,
            inlineCompletionsNESModifiedCount: sums.inlineCompletionsNES ?? 0,
            otherAIModifiedCount: sums.otherAI ?? 0,
            userModifiedCount: sums.user ?? 0,
            ideModifiedCount: sums.ide ?? 0,
            unknownModifiedCount: sums.unknown ?? 0,
            externalModifiedCount: sums.external ?? 0,
            totalModifiedCharactersInFinalState,
            languageId: this._doc.document.languageId.get(),
            isTrackedByGit: this._repo.get()?.isIgnored(this._doc.document.uri),
        };
    }
};
TrackedDocumentInfo = __decorate([
    __param(3, IInstantiationService),
    __param(4, ITelemetryService),
    __param(5, IRandomService)
], TrackedDocumentInfo);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdFNvdXJjZVRyYWNraW5nSW1wbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9lZGl0VGVsZW1ldHJ5L2Jyb3dzZXIvdGVsZW1ldHJ5L2VkaXRTb3VyY2VUcmFja2luZ0ltcGwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDeEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNsRixPQUFPLEVBQUUsWUFBWSxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ25GLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxPQUFPLEVBQWUsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2xKLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBRTFGLE9BQU8sRUFBRSwyQ0FBMkMsRUFBRSxtREFBbUQsRUFBRSxzQ0FBc0MsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ25MLE9BQU8sRUFBRSx1QkFBdUIsRUFBYyxNQUFNLDBDQUEwQyxDQUFDO0FBQy9GLE9BQU8sRUFBRSx5QkFBeUIsRUFBZSxNQUFNLGtCQUFrQixDQUFDO0FBQzFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsVUFBVSxFQUFrQixNQUFNLGlCQUFpQixDQUFDO0FBQzdELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUU5QyxJQUFNLHNCQUFzQixH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