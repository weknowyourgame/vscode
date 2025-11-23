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
var AbstractChatEditingModifiedFileEntry_1;
import { RunOnceScheduler } from '../../../../../base/common/async.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, DisposableMap, MutableDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { clamp } from '../../../../../base/common/numbers.js';
import { autorun, derived, observableValue, observableValueOpts, transaction } from '../../../../../base/common/observable.js';
import { EditDeltaInfo } from '../../../../../editor/common/textModelEditSource.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { observableConfigValue } from '../../../../../platform/observable/common/platformObservableUtils.js';
import { editorBackground, registerColor, transparent } from '../../../../../platform/theme/common/colorRegistry.js';
import { IUndoRedoService } from '../../../../../platform/undoRedo/common/undoRedo.js';
import { IFilesConfigurationService } from '../../../../services/filesConfiguration/common/filesConfigurationService.js';
import { IAiEditTelemetryService } from '../../../editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js';
import { IChatService } from '../../common/chatService.js';
class AutoAcceptControl {
    constructor(total, remaining, cancel) {
        this.total = total;
        this.remaining = remaining;
        this.cancel = cancel;
    }
}
export const pendingRewriteMinimap = registerColor('minimap.chatEditHighlight', transparent(editorBackground, 0.6), localize('editorSelectionBackground', "Color of pending edit regions in the minimap"));
let AbstractChatEditingModifiedFileEntry = class AbstractChatEditingModifiedFileEntry extends Disposable {
    static { AbstractChatEditingModifiedFileEntry_1 = this; }
    static { this.scheme = 'modified-file-entry'; }
    static { this.lastEntryId = 0; }
    get telemetryInfo() {
        return this._telemetryInfo;
    }
    get lastModifyingRequestId() {
        return this._telemetryInfo.requestId;
    }
    constructor(modifiedURI, _telemetryInfo, kind, configService, _fileConfigService, _chatService, _fileService, _undoRedoService, _instantiationService, _aiEditTelemetryService) {
        super();
        this.modifiedURI = modifiedURI;
        this._telemetryInfo = _telemetryInfo;
        this._fileConfigService = _fileConfigService;
        this._chatService = _chatService;
        this._fileService = _fileService;
        this._undoRedoService = _undoRedoService;
        this._instantiationService = _instantiationService;
        this._aiEditTelemetryService = _aiEditTelemetryService;
        this.entryId = `${AbstractChatEditingModifiedFileEntry_1.scheme}::${++AbstractChatEditingModifiedFileEntry_1.lastEntryId}`;
        this._onDidDelete = this._register(new Emitter());
        this.onDidDelete = this._onDidDelete.event;
        this._stateObs = observableValue(this, 0 /* ModifiedFileEntryState.Modified */);
        this.state = this._stateObs;
        this._waitsForLastEdits = observableValue(this, false);
        this.waitsForLastEdits = this._waitsForLastEdits;
        this._isCurrentlyBeingModifiedByObs = observableValue(this, undefined);
        this.isCurrentlyBeingModifiedBy = this._isCurrentlyBeingModifiedByObs;
        /**
         * Flag to track if we're currently in an external edit operation.
         * When true, file system changes should be treated as agent edits, not user edits.
         */
        this._isExternalEditInProgress = false;
        this._lastModifyingResponseObs = observableValueOpts({ equalsFn: (a, b) => a?.requestId === b?.requestId }, undefined);
        this.lastModifyingResponse = this._lastModifyingResponseObs;
        this._lastModifyingResponseInProgressObs = this._lastModifyingResponseObs.map((value, r) => {
            return value?.isInProgress.read(r) ?? false;
        });
        this._rewriteRatioObs = observableValue(this, 0);
        this.rewriteRatio = this._rewriteRatioObs;
        this._reviewModeTempObs = observableValue(this, undefined);
        this._autoAcceptCtrl = observableValue(this, undefined);
        this.autoAcceptController = this._autoAcceptCtrl;
        this._refCounter = 1;
        this._userEditScheduler = this._register(new RunOnceScheduler(() => this._notifySessionAction('userModified'), 1000));
        this._editorIntegrations = this._register(new DisposableMap());
        if (kind === 0 /* ChatEditKind.Created */) {
            this.createdInRequestId = this._telemetryInfo.requestId;
        }
        if (this.modifiedURI.scheme !== Schemas.untitled && this.modifiedURI.scheme !== Schemas.vscodeNotebookCell) {
            this._register(this._fileService.watch(this.modifiedURI));
            this._register(this._fileService.onDidFilesChange(e => {
                if (e.affects(this.modifiedURI) && kind === 0 /* ChatEditKind.Created */ && e.gotDeleted()) {
                    this._onDidDelete.fire();
                }
            }));
        }
        // review mode depends on setting and temporary override
        const autoAcceptRaw = observableConfigValue('chat.editing.autoAcceptDelay', 0, configService);
        this._autoAcceptTimeout = derived(r => {
            const value = autoAcceptRaw.read(r);
            return clamp(value, 0, 100);
        });
        this.reviewMode = derived(r => {
            const configuredValue = this._autoAcceptTimeout.read(r);
            const tempValue = this._reviewModeTempObs.read(r);
            return tempValue ?? configuredValue === 0;
        });
        this._store.add(toDisposable(() => this._lastModifyingResponseObs.set(undefined, undefined)));
        const autoSaveOff = this._store.add(new MutableDisposable());
        this._store.add(autorun(r => {
            if (this._waitsForLastEdits.read(r)) {
                autoSaveOff.value = _fileConfigService.disableAutoSave(this.modifiedURI);
            }
            else {
                autoSaveOff.clear();
            }
        }));
        this._store.add(autorun(r => {
            const inProgress = this._lastModifyingResponseInProgressObs.read(r);
            if (inProgress === false && !this.reviewMode.read(r)) {
                // AUTO accept mode (when request is done)
                const acceptTimeout = this._autoAcceptTimeout.read(undefined) * 1000;
                const future = Date.now() + acceptTimeout;
                const update = () => {
                    const reviewMode = this.reviewMode.read(undefined);
                    if (reviewMode) {
                        // switched back to review mode
                        this._autoAcceptCtrl.set(undefined, undefined);
                        return;
                    }
                    const remain = Math.round(future - Date.now());
                    if (remain <= 0) {
                        this.accept();
                    }
                    else {
                        const handle = setTimeout(update, 100);
                        this._autoAcceptCtrl.set(new AutoAcceptControl(acceptTimeout, remain, () => {
                            clearTimeout(handle);
                            this._autoAcceptCtrl.set(undefined, undefined);
                        }), undefined);
                    }
                };
                update();
            }
        }));
    }
    dispose() {
        if (--this._refCounter === 0) {
            super.dispose();
        }
    }
    acquire() {
        this._refCounter++;
        return this;
    }
    enableReviewModeUntilSettled() {
        if (this.state.get() !== 0 /* ModifiedFileEntryState.Modified */) {
            // nothing to do
            return;
        }
        this._reviewModeTempObs.set(true, undefined);
        const cleanup = autorun(r => {
            // reset config when settled
            const resetConfig = this.state.read(r) !== 0 /* ModifiedFileEntryState.Modified */;
            if (resetConfig) {
                this._store.delete(cleanup);
                this._reviewModeTempObs.set(undefined, undefined);
            }
        });
        this._store.add(cleanup);
    }
    updateTelemetryInfo(telemetryInfo) {
        this._telemetryInfo = telemetryInfo;
    }
    async accept() {
        const callback = await this.acceptDeferred();
        if (callback) {
            transaction(callback);
        }
    }
    /** Accepts and returns a function used to transition the state. This MUST be called by the consumer. */
    async acceptDeferred() {
        if (this._stateObs.get() !== 0 /* ModifiedFileEntryState.Modified */) {
            // already accepted or rejected
            return;
        }
        await this._doAccept();
        return (tx) => {
            this._stateObs.set(1 /* ModifiedFileEntryState.Accepted */, tx);
            this._autoAcceptCtrl.set(undefined, tx);
            this._notifySessionAction('accepted');
        };
    }
    async reject() {
        const callback = await this.rejectDeferred();
        if (callback) {
            transaction(callback);
        }
    }
    /** Rejects and returns a function used to transition the state. This MUST be called by the consumer. */
    async rejectDeferred() {
        if (this._stateObs.get() !== 0 /* ModifiedFileEntryState.Modified */) {
            // already accepted or rejected
            return undefined;
        }
        this._notifySessionAction('rejected');
        await this._doReject();
        return (tx) => {
            this._stateObs.set(2 /* ModifiedFileEntryState.Rejected */, tx);
            this._autoAcceptCtrl.set(undefined, tx);
        };
    }
    _notifySessionAction(outcome) {
        this._notifyAction({ kind: 'chatEditingSessionAction', uri: this.modifiedURI, hasRemainingEdits: false, outcome });
    }
    _notifyAction(action) {
        if (action.kind === 'chatEditingHunkAction') {
            this._aiEditTelemetryService.handleCodeAccepted({
                suggestionId: undefined, // TODO@hediet try to figure this out
                acceptanceMethod: 'accept',
                presentation: 'highlightedEdit',
                modelId: this._telemetryInfo.modelId,
                modeId: this._telemetryInfo.modeId,
                applyCodeBlockSuggestionId: this._telemetryInfo.applyCodeBlockSuggestionId,
                editDeltaInfo: new EditDeltaInfo(action.linesAdded, action.linesRemoved, -1, -1),
                feature: this._telemetryInfo.feature,
                languageId: action.languageId,
                source: undefined,
            });
        }
        this._chatService.notifyUserAction({
            action,
            agentId: this._telemetryInfo.agentId,
            modelId: this._telemetryInfo.modelId,
            modeId: this._telemetryInfo.modeId,
            command: this._telemetryInfo.command,
            sessionResource: this._telemetryInfo.sessionResource,
            requestId: this._telemetryInfo.requestId,
            result: this._telemetryInfo.result
        });
    }
    getEditorIntegration(pane) {
        let value = this._editorIntegrations.get(pane);
        if (!value) {
            value = this._createEditorIntegration(pane);
            this._editorIntegrations.set(pane, value);
        }
        return value;
    }
    acceptStreamingEditsStart(responseModel, undoStopId, tx) {
        this._resetEditsState(tx);
        this._isCurrentlyBeingModifiedByObs.set({ responseModel, undoStopId }, tx);
        this._lastModifyingResponseObs.set(responseModel, tx);
        this._autoAcceptCtrl.get()?.cancel();
        const undoRedoElement = this._createUndoRedoElement(responseModel);
        if (undoRedoElement) {
            this._undoRedoService.pushElement(undoRedoElement);
        }
    }
    async acceptStreamingEditsEnd() {
        this._resetEditsState(undefined);
        if (await this._areOriginalAndModifiedIdentical()) {
            // ACCEPT if identical
            await this.accept();
        }
    }
    _resetEditsState(tx) {
        this._isCurrentlyBeingModifiedByObs.set(undefined, tx);
        this._rewriteRatioObs.set(0, tx);
        this._waitsForLastEdits.set(false, tx);
    }
    /**
     * Marks the start of an external edit operation.
     * File system changes will be treated as agent edits until stopExternalEdit is called.
     */
    startExternalEdit() {
        this._isExternalEditInProgress = true;
    }
    /**
     * Marks the end of an external edit operation.
     */
    stopExternalEdit() {
        this._isExternalEditInProgress = false;
    }
};
AbstractChatEditingModifiedFileEntry = AbstractChatEditingModifiedFileEntry_1 = __decorate([
    __param(3, IConfigurationService),
    __param(4, IFilesConfigurationService),
    __param(5, IChatService),
    __param(6, IFileService),
    __param(7, IUndoRedoService),
    __param(8, IInstantiationService),
    __param(9, IAiEditTelemetryService)
], AbstractChatEditingModifiedFileEntry);
export { AbstractChatEditingModifiedFileEntry };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdNb2RpZmllZEZpbGVFbnRyeS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdNb2RpZmllZEZpbGVFbnRyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDdkUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JILE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDOUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQTZCLGVBQWUsRUFBRSxtQkFBbUIsRUFBRSxXQUFXLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUcxSixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDcEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUM3RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxzRUFBc0UsQ0FBQztBQUM3RyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3JILE9BQU8sRUFBb0IsZ0JBQWdCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUV6RyxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSw2RUFBNkUsQ0FBQztBQUN6SCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxvRkFBb0YsQ0FBQztBQUk3SCxPQUFPLEVBQWtCLFlBQVksRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBRTNFLE1BQU0saUJBQWlCO0lBQ3RCLFlBQ1UsS0FBYSxFQUNiLFNBQWlCLEVBQ2pCLE1BQWtCO1FBRmxCLFVBQUssR0FBTCxLQUFLLENBQVE7UUFDYixjQUFTLEdBQVQsU0FBUyxDQUFRO1FBQ2pCLFdBQU0sR0FBTixNQUFNLENBQVk7SUFDeEIsQ0FBQztDQUNMO0FBRUQsTUFBTSxDQUFDLE1BQU0scUJBQXFCLEdBQUcsYUFBYSxDQUFDLDJCQUEyQixFQUM3RSxXQUFXLENBQUMsZ0JBQWdCLEVBQUUsR0FBRyxDQUFDLEVBQ2xDLFFBQVEsQ0FBQywyQkFBMkIsRUFBRSw4Q0FBOEMsQ0FBQyxDQUFDLENBQUM7QUFHakYsSUFBZSxvQ0FBb0MsR0FBbkQsTUFBZSxvQ0FBcUMsU0FBUSxVQUFVOzthQUU1RCxXQUFNLEdBQUcscUJBQXFCLEFBQXhCLENBQXlCO2FBRWhDLGdCQUFXLEdBQUcsQ0FBQyxBQUFKLENBQUs7SUF3Qy9CLElBQUksYUFBYTtRQUNoQixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUM7SUFDNUIsQ0FBQztJQUlELElBQUksc0JBQXNCO1FBQ3pCLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUM7SUFDdEMsQ0FBQztJQVFELFlBQ1UsV0FBZ0IsRUFDZixjQUEyQyxFQUNyRCxJQUFrQixFQUNLLGFBQW9DLEVBQy9CLGtCQUF3RCxFQUN0RSxZQUE2QyxFQUM3QyxZQUE2QyxFQUN6QyxnQkFBbUQsRUFDOUMscUJBQStELEVBQzdELHVCQUFpRTtRQUUxRixLQUFLLEVBQUUsQ0FBQztRQVhDLGdCQUFXLEdBQVgsV0FBVyxDQUFLO1FBQ2YsbUJBQWMsR0FBZCxjQUFjLENBQTZCO1FBR2YsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUE0QjtRQUNuRCxpQkFBWSxHQUFaLFlBQVksQ0FBYztRQUMxQixpQkFBWSxHQUFaLFlBQVksQ0FBYztRQUN4QixxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQWtCO1FBQzNCLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBdUI7UUFDNUMsNEJBQXVCLEdBQXZCLHVCQUF1QixDQUF5QjtRQWhFbEYsWUFBTyxHQUFHLEdBQUcsc0NBQW9DLENBQUMsTUFBTSxLQUFLLEVBQUUsc0NBQW9DLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFeEcsaUJBQVksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUM3RCxnQkFBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDO1FBRTVCLGNBQVMsR0FBRyxlQUFlLENBQXlCLElBQUksMENBQWtDLENBQUM7UUFDckcsVUFBSyxHQUF3QyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBRWxELHVCQUFrQixHQUFHLGVBQWUsQ0FBVSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDckUsc0JBQWlCLEdBQXlCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztRQUV4RCxtQ0FBOEIsR0FBRyxlQUFlLENBQW9GLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztRQUMvSiwrQkFBMEIsR0FBbUcsSUFBSSxDQUFDLDhCQUE4QixDQUFDO1FBRTFLOzs7V0FHRztRQUNPLDhCQUF5QixHQUFHLEtBQUssQ0FBQztRQUV6Qiw4QkFBeUIsR0FBRyxtQkFBbUIsQ0FBaUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsU0FBUyxLQUFLLENBQUMsRUFBRSxTQUFTLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUM1SiwwQkFBcUIsR0FBZ0QsSUFBSSxDQUFDLHlCQUF5QixDQUFDO1FBRTFGLHdDQUFtQyxHQUFHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDeEcsT0FBTyxLQUFLLEVBQUUsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUM7UUFDN0MsQ0FBQyxDQUFDLENBQUM7UUFFZ0IscUJBQWdCLEdBQUcsZUFBZSxDQUFTLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM5RCxpQkFBWSxHQUF3QixJQUFJLENBQUMsZ0JBQWdCLENBQUM7UUFFbEQsdUJBQWtCLEdBQUcsZUFBZSxDQUFtQixJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFHeEUsb0JBQWUsR0FBRyxlQUFlLENBQWdDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztRQUMxRix5QkFBb0IsR0FBK0MsSUFBSSxDQUFDLGVBQWUsQ0FBQztRQWN6RixnQkFBVyxHQUFXLENBQUMsQ0FBQztRQUliLHVCQUFrQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQWlObkgsd0JBQW1CLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGFBQWEsRUFBb0QsQ0FBQyxDQUFDO1FBak01SCxJQUFJLElBQUksaUNBQXlCLEVBQUUsQ0FBQztZQUNuQyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUM7UUFDekQsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEtBQUssT0FBTyxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sS0FBSyxPQUFPLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUM1RyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBQzFELElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDckQsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxJQUFJLGlDQUF5QixJQUFJLENBQUMsQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO29CQUNwRixJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUMxQixDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCx3REFBd0Q7UUFDeEQsTUFBTSxhQUFhLEdBQUcscUJBQXFCLENBQUMsOEJBQThCLEVBQUUsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQzlGLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDckMsTUFBTSxLQUFLLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNwQyxPQUFPLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzdCLENBQUMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDN0IsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN4RCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2xELE9BQU8sU0FBUyxJQUFJLGVBQWUsS0FBSyxDQUFDLENBQUM7UUFDM0MsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTlGLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBQzdELElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUMzQixJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDckMsV0FBVyxDQUFDLEtBQUssR0FBRyxrQkFBa0IsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzFFLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDckIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDM0IsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLG1DQUFtQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNwRSxJQUFJLFVBQVUsS0FBSyxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUN0RCwwQ0FBMEM7Z0JBRTFDLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsSUFBSSxDQUFDO2dCQUNyRSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsYUFBYSxDQUFDO2dCQUMxQyxNQUFNLE1BQU0sR0FBRyxHQUFHLEVBQUU7b0JBRW5CLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUNuRCxJQUFJLFVBQVUsRUFBRSxDQUFDO3dCQUNoQiwrQkFBK0I7d0JBQy9CLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQzt3QkFDL0MsT0FBTztvQkFDUixDQUFDO29CQUVELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO29CQUMvQyxJQUFJLE1BQU0sSUFBSSxDQUFDLEVBQUUsQ0FBQzt3QkFDakIsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO29CQUNmLENBQUM7eUJBQU0sQ0FBQzt3QkFDUCxNQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDO3dCQUN2QyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxJQUFJLGlCQUFpQixDQUFDLGFBQWEsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFOzRCQUMxRSxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7NEJBQ3JCLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQzt3QkFDaEQsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7b0JBQ2hCLENBQUM7Z0JBQ0YsQ0FBQyxDQUFDO2dCQUNGLE1BQU0sRUFBRSxDQUFDO1lBQ1YsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRVEsT0FBTztRQUNmLElBQUksRUFBRSxJQUFJLENBQUMsV0FBVyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzlCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNqQixDQUFDO0lBQ0YsQ0FBQztJQUlELE9BQU87UUFDTixJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDbkIsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRUQsNEJBQTRCO1FBRTNCLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsNENBQW9DLEVBQUUsQ0FBQztZQUMxRCxnQkFBZ0I7WUFDaEIsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztRQUU3QyxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDM0IsNEJBQTRCO1lBQzVCLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyw0Q0FBb0MsQ0FBQztZQUMzRSxJQUFJLFdBQVcsRUFBRSxDQUFDO2dCQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDNUIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDbkQsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDMUIsQ0FBQztJQUVELG1CQUFtQixDQUFDLGFBQTBDO1FBQzdELElBQUksQ0FBQyxjQUFjLEdBQUcsYUFBYSxDQUFDO0lBQ3JDLENBQUM7SUFFRCxLQUFLLENBQUMsTUFBTTtRQUNYLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQzdDLElBQUksUUFBUSxFQUFFLENBQUM7WUFDZCxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDdkIsQ0FBQztJQUNGLENBQUM7SUFFRCx3R0FBd0c7SUFDeEcsS0FBSyxDQUFDLGNBQWM7UUFDbkIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSw0Q0FBb0MsRUFBRSxDQUFDO1lBQzlELCtCQUErQjtZQUMvQixPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBRXZCLE9BQU8sQ0FBQyxFQUFnQixFQUFFLEVBQUU7WUFDM0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLDBDQUFrQyxFQUFFLENBQUMsQ0FBQztZQUN4RCxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDeEMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3ZDLENBQUMsQ0FBQztJQUNILENBQUM7SUFJRCxLQUFLLENBQUMsTUFBTTtRQUNYLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQzdDLElBQUksUUFBUSxFQUFFLENBQUM7WUFDZCxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDdkIsQ0FBQztJQUNGLENBQUM7SUFFRCx3R0FBd0c7SUFDeEcsS0FBSyxDQUFDLGNBQWM7UUFDbkIsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSw0Q0FBb0MsRUFBRSxDQUFDO1lBQzlELCtCQUErQjtZQUMvQixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3RDLE1BQU0sSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBRXZCLE9BQU8sQ0FBQyxFQUFnQixFQUFFLEVBQUU7WUFDM0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLDBDQUFrQyxFQUFFLENBQUMsQ0FBQztZQUN4RCxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDekMsQ0FBQyxDQUFDO0lBQ0gsQ0FBQztJQUlTLG9CQUFvQixDQUFDLE9BQWlEO1FBQy9FLElBQUksQ0FBQyxhQUFhLENBQUMsRUFBRSxJQUFJLEVBQUUsMEJBQTBCLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUUsaUJBQWlCLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDcEgsQ0FBQztJQUVTLGFBQWEsQ0FBQyxNQUFzQjtRQUM3QyxJQUFJLE1BQU0sQ0FBQyxJQUFJLEtBQUssdUJBQXVCLEVBQUUsQ0FBQztZQUM3QyxJQUFJLENBQUMsdUJBQXVCLENBQUMsa0JBQWtCLENBQUM7Z0JBQy9DLFlBQVksRUFBRSxTQUFTLEVBQUUscUNBQXFDO2dCQUM5RCxnQkFBZ0IsRUFBRSxRQUFRO2dCQUMxQixZQUFZLEVBQUUsaUJBQWlCO2dCQUMvQixPQUFPLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPO2dCQUNwQyxNQUFNLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNO2dCQUNsQywwQkFBMEIsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLDBCQUEwQjtnQkFDMUUsYUFBYSxFQUFFLElBQUksYUFBYSxDQUMvQixNQUFNLENBQUMsVUFBVSxFQUNqQixNQUFNLENBQUMsWUFBWSxFQUNuQixDQUFDLENBQUMsRUFDRixDQUFDLENBQUMsQ0FDRjtnQkFDRCxPQUFPLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPO2dCQUNwQyxVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVU7Z0JBQzdCLE1BQU0sRUFBRSxTQUFTO2FBQ2pCLENBQUMsQ0FBQztRQUNKLENBQUM7UUFFRCxJQUFJLENBQUMsWUFBWSxDQUFDLGdCQUFnQixDQUFDO1lBQ2xDLE1BQU07WUFDTixPQUFPLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPO1lBQ3BDLE9BQU8sRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU87WUFDcEMsTUFBTSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTTtZQUNsQyxPQUFPLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPO1lBQ3BDLGVBQWUsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLGVBQWU7WUFDcEQsU0FBUyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUztZQUN4QyxNQUFNLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNO1NBQ2xDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFJRCxvQkFBb0IsQ0FBQyxJQUFpQjtRQUNyQyxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNaLEtBQUssR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDNUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQVlELHlCQUF5QixDQUFDLGFBQWlDLEVBQUUsVUFBOEIsRUFBRSxFQUE0QjtRQUN4SCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDMUIsSUFBSSxDQUFDLDhCQUE4QixDQUFDLEdBQUcsQ0FBQyxFQUFFLGFBQWEsRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMzRSxJQUFJLENBQUMseUJBQXlCLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUN0RCxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDO1FBRXJDLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNuRSxJQUFJLGVBQWUsRUFBRSxDQUFDO1lBQ3JCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDcEQsQ0FBQztJQUNGLENBQUM7SUFNRCxLQUFLLENBQUMsdUJBQXVCO1FBQzVCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUVqQyxJQUFJLE1BQU0sSUFBSSxDQUFDLGdDQUFnQyxFQUFFLEVBQUUsQ0FBQztZQUNuRCxzQkFBc0I7WUFDdEIsTUFBTSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDckIsQ0FBQztJQUNGLENBQUM7SUFJUyxnQkFBZ0IsQ0FBQyxFQUE0QjtRQUN0RCxJQUFJLENBQUMsOEJBQThCLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUN2RCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNqQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN4QyxDQUFDO0lBd0JEOzs7T0FHRztJQUNILGlCQUFpQjtRQUNoQixJQUFJLENBQUMseUJBQXlCLEdBQUcsSUFBSSxDQUFDO0lBQ3ZDLENBQUM7SUFFRDs7T0FFRztJQUNILGdCQUFnQjtRQUNmLElBQUksQ0FBQyx5QkFBeUIsR0FBRyxLQUFLLENBQUM7SUFDeEMsQ0FBQzs7QUFwV29CLG9DQUFvQztJQWdFdkQsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLDBCQUEwQixDQUFBO0lBQzFCLFdBQUEsWUFBWSxDQUFBO0lBQ1osV0FBQSxZQUFZLENBQUE7SUFDWixXQUFBLGdCQUFnQixDQUFBO0lBQ2hCLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSx1QkFBdUIsQ0FBQTtHQXRFSixvQ0FBb0MsQ0ErV3pEIn0=