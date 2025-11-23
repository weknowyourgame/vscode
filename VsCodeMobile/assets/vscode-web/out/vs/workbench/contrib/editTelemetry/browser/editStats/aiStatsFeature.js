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
import { sumBy } from '../../../../../base/common/arrays.js';
import { TaskQueue, timeout } from '../../../../../base/common/async.js';
import { Lazy } from '../../../../../base/common/lazy.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun, derived, mapObservableArrayCached, observableValue, runOnChange } from '../../../../../base/common/observable.js';
import { AnnotatedStringEdit } from '../../../../../editor/common/core/edits/stringEdit.js';
import { isAiEdit, isUserEdit } from '../../../../../editor/common/textModelEditSource.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { AiStatsStatusBar } from './aiStatsStatusBar.js';
let AiStatsFeature = class AiStatsFeature extends Disposable {
    constructor(annotatedDocuments, _storageService, _instantiationService) {
        super();
        this._storageService = _storageService;
        this._instantiationService = _instantiationService;
        this._dataVersion = observableValue(this, 0);
        this.aiRate = this._dataVersion.map(() => {
            const val = this._data.getValue();
            if (!val) {
                return 0;
            }
            const r = average(val.sessions, session => {
                const sum = session.typedCharacters + session.aiCharacters;
                if (sum === 0) {
                    return 0;
                }
                return session.aiCharacters / sum;
            });
            return r;
        });
        this.sessionCount = derived(this, r => {
            this._dataVersion.read(r);
            const val = this._data.getValue();
            if (!val) {
                return 0;
            }
            return val.sessions.length;
        });
        this.acceptedInlineSuggestionsToday = derived(this, r => {
            this._dataVersion.read(r);
            const val = this._data.getValue();
            if (!val) {
                return 0;
            }
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const sessionsToday = val.sessions.filter(s => s.startTime > startOfToday.getTime());
            return sumBy(sessionsToday, s => s.acceptedInlineSuggestions ?? 0);
        });
        const storedValue = getStoredValue(this._storageService, 'aiStats', 1 /* StorageScope.WORKSPACE */, 0 /* StorageTarget.USER */);
        this._data = rateLimitWrite(storedValue, 1 / 60, this._store);
        this.aiRate.recomputeInitiallyAndOnChange(this._store);
        this._register(autorun(reader => {
            reader.store.add(this._instantiationService.createInstance(AiStatsStatusBar.hot.read(reader), this));
        }));
        const lastRequestIds = [];
        const obs = mapObservableArrayCached(this, annotatedDocuments.documents, (doc, store) => {
            store.add(runOnChange(doc.documentWithAnnotations.value, (_val, _prev, edit) => {
                const e = AnnotatedStringEdit.compose(edit.map(e => e.edit));
                const curSession = new Lazy(() => this._getDataAndSession());
                for (const r of e.replacements) {
                    if (isAiEdit(r.data.editSource)) {
                        curSession.value.currentSession.aiCharacters += r.newText.length;
                    }
                    else if (isUserEdit(r.data.editSource)) {
                        curSession.value.currentSession.typedCharacters += r.newText.length;
                    }
                }
                if (e.replacements.length > 0) {
                    const sessionToUpdate = curSession.value.currentSession;
                    const s = e.replacements[0].data.editSource;
                    if (s.metadata.source === 'inlineCompletionAccept') {
                        if (sessionToUpdate.acceptedInlineSuggestions === undefined) {
                            sessionToUpdate.acceptedInlineSuggestions = 0;
                        }
                        sessionToUpdate.acceptedInlineSuggestions += 1;
                    }
                    if (s.metadata.source === 'Chat.applyEdits' && s.metadata.$$requestId !== undefined) {
                        const didSeeRequestId = lastRequestIds.includes(s.metadata.$$requestId);
                        if (!didSeeRequestId) {
                            lastRequestIds.push(s.metadata.$$requestId);
                            if (lastRequestIds.length > 10) {
                                lastRequestIds.shift();
                            }
                            if (sessionToUpdate.chatEditCount === undefined) {
                                sessionToUpdate.chatEditCount = 0;
                            }
                            sessionToUpdate.chatEditCount += 1;
                        }
                    }
                }
                if (curSession.hasValue) {
                    this._data.writeValue(curSession.value.data);
                    this._dataVersion.set(this._dataVersion.get() + 1, undefined);
                }
            }));
        });
        obs.recomputeInitiallyAndOnChange(this._store);
    }
    _getDataAndSession() {
        const state = this._data.getValue() ?? { sessions: [] };
        const sessionLengthMs = 5 * 60 * 1000; // 5 minutes
        let lastSession = state.sessions.at(-1);
        const nowTime = Date.now();
        if (!lastSession || nowTime - lastSession.startTime > sessionLengthMs) {
            state.sessions.push({
                startTime: nowTime,
                typedCharacters: 0,
                aiCharacters: 0,
                acceptedInlineSuggestions: 0,
                chatEditCount: 0,
            });
            lastSession = state.sessions.at(-1);
            const dayMs = 24 * 60 * 60 * 1000; // 24h
            // Clean up old sessions, keep only the last 24h worth of sessions
            while (state.sessions.length > dayMs / sessionLengthMs) {
                state.sessions.shift();
            }
        }
        return { data: state, currentSession: lastSession };
    }
};
AiStatsFeature = __decorate([
    __param(1, IStorageService),
    __param(2, IInstantiationService)
], AiStatsFeature);
export { AiStatsFeature };
function average(arr, selector) {
    if (arr.length === 0) {
        return 0;
    }
    const s = sumBy(arr, selector);
    return s / arr.length;
}
function rateLimitWrite(targetValue, maxWritesPerSecond, store) {
    const queue = new TaskQueue();
    let _value = undefined;
    let valueVersion = 0;
    let savedVersion = 0;
    store.add(toDisposable(() => {
        if (valueVersion !== savedVersion) {
            targetValue.writeValue(_value);
            savedVersion = valueVersion;
        }
    }));
    return {
        writeValue(value) {
            valueVersion++;
            const v = valueVersion;
            _value = value;
            queue.clearPending();
            queue.schedule(async () => {
                targetValue.writeValue(value);
                savedVersion = v;
                await timeout(5000);
            });
        },
        getValue() {
            if (valueVersion > 0) {
                return _value;
            }
            return targetValue.getValue();
        }
    };
}
function getStoredValue(service, key, scope, target) {
    let lastValue = undefined;
    let hasLastValue = false;
    return {
        writeValue(value) {
            if (value === undefined) {
                service.remove(key, scope);
            }
            else {
                service.store(key, JSON.stringify(value), scope, target);
            }
            lastValue = value;
        },
        getValue() {
            if (hasLastValue) {
                return lastValue;
            }
            const strVal = service.get(key, scope);
            lastValue = strVal === undefined ? undefined : JSON.parse(strVal);
            hasLastValue = true;
            return lastValue;
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWlTdGF0c0ZlYXR1cmUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZWRpdFRlbGVtZXRyeS9icm93c2VyL2VkaXRTdGF0cy9haVN0YXRzRmVhdHVyZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDN0QsT0FBTyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxFQUFFLFVBQVUsRUFBbUIsWUFBWSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDcEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsZUFBZSxFQUFFLFdBQVcsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3BJLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQzVGLE9BQU8sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDM0YsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxtREFBbUQsQ0FBQztBQUVqSCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUVsRCxJQUFNLGNBQWMsR0FBcEIsTUFBTSxjQUFlLFNBQVEsVUFBVTtJQUk3QyxZQUNDLGtCQUFzQyxFQUNyQixlQUFpRCxFQUMzQyxxQkFBNkQ7UUFFcEYsS0FBSyxFQUFFLENBQUM7UUFIMEIsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBQzFCLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBdUI7UUFMcEUs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