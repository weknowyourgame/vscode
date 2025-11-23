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
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { autorun, observableFromEvent } from '../../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { canLog, ILoggerService, LogLevel } from '../../../../../platform/log/common/log.js';
import { CodeEditorWidget } from '../../../../browser/widget/codeEditor/codeEditorWidget.js';
import { StructuredLogger } from '../structuredLogger.js';
let TextModelChangeRecorder = class TextModelChangeRecorder extends Disposable {
    constructor(_editor, _instantiationService, _loggerService) {
        super();
        this._editor = _editor;
        this._instantiationService = _instantiationService;
        this._loggerService = _loggerService;
        this._structuredLogger = this._register(this._instantiationService.createInstance(StructuredLogger.cast(), 'editor.inlineSuggest.logChangeReason.commandId'));
        const logger = this._loggerService?.createLogger('textModelChanges', { hidden: false, name: 'Text Model Changes Reason' });
        const loggingLevel = observableFromEvent(this, logger.onDidChangeLogLevel, () => logger.getLevel());
        this._register(autorun(reader => {
            if (!canLog(loggingLevel.read(reader), LogLevel.Trace)) {
                return;
            }
            reader.store.add(this._editor.onDidChangeModelContent((e) => {
                if (this._editor.getModel()?.uri.scheme === 'output') {
                    return;
                }
                logger.trace('onDidChangeModelContent: ' + e.detailedReasons.map(r => r.toKey(Number.MAX_VALUE)).join(', '));
            }));
        }));
        this._register(autorun(reader => {
            if (!(this._editor instanceof CodeEditorWidget)) {
                return;
            }
            if (!this._structuredLogger.isEnabled.read(reader)) {
                return;
            }
            reader.store.add(this._editor.onDidChangeModelContent(e => {
                const tm = this._editor.getModel();
                if (!tm) {
                    return;
                }
                const reason = e.detailedReasons[0];
                const data = {
                    ...reason.metadata,
                    sourceId: 'TextModel.setChangeReason',
                    source: reason.metadata.source,
                    time: Date.now(),
                    modelUri: tm.uri,
                    modelVersion: tm.getVersionId(),
                };
                setTimeout(() => {
                    // To ensure that this reaches the extension host after the content change event.
                    // (Without the setTimeout, I observed this command being called before the content change event arrived)
                    this._structuredLogger.log(data);
                }, 0);
            }));
        }));
    }
};
TextModelChangeRecorder = __decorate([
    __param(1, IInstantiationService),
    __param(2, ILoggerService)
], TextModelChangeRecorder);
export { TextModelChangeRecorder };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhbmdlUmVjb3JkZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvYnJvd3Nlci9tb2RlbC9jaGFuZ2VSZWNvcmRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckUsT0FBTyxFQUFFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxNQUFNLEVBQUUsY0FBYyxFQUFFLFFBQVEsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBRTdGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQzdGLE9BQU8sRUFBZ0UsZ0JBQWdCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQVNqSCxJQUFNLHVCQUF1QixHQUE3QixNQUFNLHVCQUF3QixTQUFRLFVBQVU7SUFHdEQsWUFDa0IsT0FBb0IsRUFDRyxxQkFBNEMsRUFDbkQsY0FBOEI7UUFFL0QsS0FBSyxFQUFFLENBQUM7UUFKUyxZQUFPLEdBQVAsT0FBTyxDQUFhO1FBQ0csMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtRQUNuRCxtQkFBYyxHQUFkLGNBQWMsQ0FBZ0I7UUFJL0QsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQWlFLEVBQ3ZLLGdEQUFnRCxDQUNoRCxDQUFDLENBQUM7UUFFSCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsY0FBYyxFQUFFLFlBQVksQ0FBQyxrQkFBa0IsRUFBRSxF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