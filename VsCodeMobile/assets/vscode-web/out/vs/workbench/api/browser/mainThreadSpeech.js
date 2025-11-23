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
import { raceCancellation } from '../../../base/common/async.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { ISpeechService, TextToSpeechStatus } from '../../contrib/speech/common/speechService.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
let MainThreadSpeech = class MainThreadSpeech {
    constructor(extHostContext, speechService, logService) {
        this.speechService = speechService;
        this.logService = logService;
        this.providerRegistrations = new Map();
        this.speechToTextSessions = new Map();
        this.textToSpeechSessions = new Map();
        this.keywordRecognitionSessions = new Map();
        this.proxy = extHostContext.getProxy(ExtHostContext.ExtHostSpeech);
    }
    $registerProvider(handle, identifier, metadata) {
        this.logService.trace('[Speech] extension registered provider', metadata.extension.value);
        const registration = this.speechService.registerSpeechProvider(identifier, {
            metadata,
            createSpeechToTextSession: (token, options) => {
                if (token.isCancellationRequested) {
                    return {
                        onDidChange: Event.None
                    };
                }
                const disposables = new DisposableStore();
                const session = Math.random();
                this.proxy.$createSpeechToTextSession(handle, session, options?.language);
                const onDidChange = disposables.add(new Emitter());
                this.speechToTextSessions.set(session, { onDidChange });
                disposables.add(token.onCancellationRequested(() => {
                    this.proxy.$cancelSpeechToTextSession(session);
                    this.speechToTextSessions.delete(session);
                    disposables.dispose();
                }));
                return {
                    onDidChange: onDidChange.event
                };
            },
            createTextToSpeechSession: (token, options) => {
                if (token.isCancellationRequested) {
                    return {
                        onDidChange: Event.None,
                        synthesize: async () => { }
                    };
                }
                const disposables = new DisposableStore();
                const session = Math.random();
                this.proxy.$createTextToSpeechSession(handle, session, options?.language);
                const onDidChange = disposables.add(new Emitter());
                this.textToSpeechSessions.set(session, { onDidChange });
                disposables.add(token.onCancellationRequested(() => {
                    this.proxy.$cancelTextToSpeechSession(session);
                    this.textToSpeechSessions.delete(session);
                    disposables.dispose();
                }));
                return {
                    onDidChange: onDidChange.event,
                    synthesize: async (text) => {
                        await this.proxy.$synthesizeSpeech(session, text);
                        const disposable = new DisposableStore();
                        try {
                            await raceCancellation(Event.toPromise(Event.filter(onDidChange.event, e => e.status === TextToSpeechStatus.Stopped, disposable), disposable), token);
                        }
                        finally {
                            disposable.dispose();
                        }
                    }
                };
            },
            createKeywordRecognitionSession: token => {
                if (token.isCancellationRequested) {
                    return {
                        onDidChange: Event.None
                    };
                }
                const disposables = new DisposableStore();
                const session = Math.random();
                this.proxy.$createKeywordRecognitionSession(handle, session);
                const onDidChange = disposables.add(new Emitter());
                this.keywordRecognitionSessions.set(session, { onDidChange });
                disposables.add(token.onCancellationRequested(() => {
                    this.proxy.$cancelKeywordRecognitionSession(session);
                    this.keywordRecognitionSessions.delete(session);
                    disposables.dispose();
                }));
                return {
                    onDidChange: onDidChange.event
                };
            }
        });
        this.providerRegistrations.set(handle, {
            dispose: () => {
                registration.dispose();
            }
        });
    }
    $unregisterProvider(handle) {
        const registration = this.providerRegistrations.get(handle);
        if (registration) {
            registration.dispose();
            this.providerRegistrations.delete(handle);
        }
    }
    $emitSpeechToTextEvent(session, event) {
        const providerSession = this.speechToTextSessions.get(session);
        providerSession?.onDidChange.fire(event);
    }
    $emitTextToSpeechEvent(session, event) {
        const providerSession = this.textToSpeechSessions.get(session);
        providerSession?.onDidChange.fire(event);
    }
    $emitKeywordRecognitionEvent(session, event) {
        const providerSession = this.keywordRecognitionSessions.get(session);
        providerSession?.onDidChange.fire(event);
    }
    dispose() {
        this.providerRegistrations.forEach(disposable => disposable.dispose());
        this.providerRegistrations.clear();
        this.speechToTextSessions.forEach(session => session.onDidChange.dispose());
        this.speechToTextSessions.clear();
        this.textToSpeechSessions.forEach(session => session.onDidChange.dispose());
        this.textToSpeechSessions.clear();
        this.keywordRecognitionSessions.forEach(session => session.onDidChange.dispose());
        this.keywordRecognitionSessions.clear();
    }
};
MainThreadSpeech = __decorate([
    extHostNamedCustomer(MainContext.MainThreadSpeech),
    __param(1, ISpeechService),
    __param(2, ILogService)
], MainThreadSpeech);
export { MainThreadSpeech };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZFNwZWVjaC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZFNwZWVjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxlQUFlLEVBQWUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNqRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGNBQWMsRUFBc0IsV0FBVyxFQUF5QixNQUFNLCtCQUErQixDQUFDO0FBQ3ZILE9BQU8sRUFBcUQsY0FBYyxFQUEwQyxrQkFBa0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzdMLE9BQU8sRUFBbUIsb0JBQW9CLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQWV0RyxJQUFNLGdCQUFnQixHQUF0QixNQUFNLGdCQUFnQjtJQVU1QixZQUNDLGNBQStCLEVBQ2YsYUFBOEMsRUFDakQsVUFBd0M7UUFEcEIsa0JBQWEsR0FBYixhQUFhLENBQWdCO1FBQ2hDLGVBQVUsR0FBVixVQUFVLENBQWE7UUFUckMsMEJBQXFCLEdBQUcsSUFBSSxHQUFHLEVBQXVCLENBQUM7UUFFdkQseUJBQW9CLEdBQUcsSUFBSSxHQUFHLEVBQStCLENBQUM7UUFDOUQseUJBQW9CLEdBQUcsSUFBSSxHQUFHLEVBQStCLENBQUM7UUFDOUQsK0JBQTBCLEdBQUcsSUFBSSxHQUFHLEVBQXFDLENBQUM7UUFPMUYsSUFBSSxDQUFDLEtBQUssR0FBRyxjQUFjLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNwRSxD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