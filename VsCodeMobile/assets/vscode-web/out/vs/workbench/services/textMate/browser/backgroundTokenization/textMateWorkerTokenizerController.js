/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { importAMDNodeModule } from '../../../../../amdX.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { autorun, keepObserved } from '../../../../../base/common/observable.js';
import { LineRange } from '../../../../../editor/common/core/ranges/lineRange.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { TokenizationStateStore } from '../../../../../editor/common/model/textModelTokens.js';
import { ContiguousMultilineTokensBuilder } from '../../../../../editor/common/tokens/contiguousMultilineTokensBuilder.js';
import { observableConfigValue } from '../../../../../platform/observable/common/platformObservableUtils.js';
import { MonotonousIndexTransformer } from '../indexTransformer.js';
import { linesLengthEditFromModelContentChange } from '../../../../../editor/common/model/textModelStringEdit.js';
export class TextMateWorkerTokenizerController extends Disposable {
    static { this._id = 0; }
    constructor(_model, _worker, _languageIdCodec, _backgroundTokenizationStore, _configurationService, _maxTokenizationLineLength) {
        super();
        this._model = _model;
        this._worker = _worker;
        this._languageIdCodec = _languageIdCodec;
        this._backgroundTokenizationStore = _backgroundTokenizationStore;
        this._configurationService = _configurationService;
        this._maxTokenizationLineLength = _maxTokenizationLineLength;
        this.controllerId = TextMateWorkerTokenizerController._id++;
        this._pendingChanges = [];
        this._states = new TokenizationStateStore();
        this._loggingEnabled = observableConfigValue('editor.experimental.asyncTokenizationLogging', false, this._configurationService);
        this._register(keepObserved(this._loggingEnabled));
        this._register(this._model.onDidChangeContent((e) => {
            if (this._shouldLog) {
                console.log('model change', {
                    fileName: this._model.uri.fsPath.split('\\').pop(),
                    changes: changesToString(e.changes),
                });
            }
            this._worker.$acceptModelChanged(this.controllerId, e);
            this._pendingChanges.push(e);
        }));
        this._register(this._model.onDidChangeLanguage((e) => {
            const languageId = this._model.getLanguageId();
            const encodedLanguageId = this._languageIdCodec.encodeLanguageId(languageId);
            this._worker.$acceptModelLanguageChanged(this.controllerId, languageId, encodedLanguageId);
        }));
        const languageId = this._model.getLanguageId();
        const encodedLanguageId = this._languageIdCodec.encodeLanguageId(languageId);
        this._worker.$acceptNewModel({
            uri: this._model.uri,
            versionId: this._model.getVersionId(),
            lines: this._model.getLinesContent(),
            EOL: this._model.getEOL(),
            languageId,
            encodedLanguageId,
            maxTokenizationLineLength: this._maxTokenizationLineLength.get(),
            controllerId: this.controllerId,
        });
        this._register(autorun(reader => {
            /** @description update maxTokenizationLineLength */
            const maxTokenizationLineLength = this._maxTokenizationLineLength.read(reader);
            this._worker.$acceptMaxTokenizationLineLength(this.controllerId, maxTokenizationLineLength);
        }));
    }
    dispose() {
        super.dispose();
        this._worker.$acceptRemovedModel(this.controllerId);
    }
    requestTokens(startLineNumber, endLineNumberExclusive) {
        this._worker.$retokenize(this.controllerId, startLineNumber, endLineNumberExclusive);
    }
    /**
     * This method is called from the worker through the worker host.
     */
    async setTokensAndStates(controllerId, versionId, rawTokens, stateDeltas) {
        if (this.controllerId !== controllerId) {
            // This event is for an outdated controller (the worker didn't receive the delete/create messages yet), ignore the event.
            return;
        }
        // _states state, change{k}, ..., change{versionId}, state delta base & rawTokens, change{j}, ..., change{m}, current renderer state
        //                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^                                ^^^^^^^^^^^^^^^^^^^^^^^^^
        //                | past changes                                                   | future states
        let tokens = ContiguousMultilineTokensBuilder.deserialize(new Uint8Array(rawTokens));
        if (this._shouldLog) {
            console.log('received background tokenization result', {
                fileName: this._model.uri.fsPath.split('\\').pop(),
                updatedTokenLines: tokens.map((t) => t.getLineRange()).join(' & '),
                updatedStateLines: stateDeltas.map((s) => new LineRange(s.startLineNumber, s.startLineNumber + s.stateDeltas.length).toString()).join(' & '),
            });
        }
        if (this._shouldLog) {
            const changes = this._pendingChanges.filter(c => c.versionId <= versionId).map(c => c.changes).map(c => changesToString(c)).join(' then ');
            console.log('Applying changes to local states', changes);
        }
        // Apply past changes to _states
        while (this._pendingChanges.length > 0 &&
            this._pendingChanges[0].versionId <= versionId) {
            const change = this._pendingChanges.shift();
            this._states.acceptChanges(change.changes);
        }
        if (this._pendingChanges.length > 0) {
            if (this._shouldLog) {
                const changes = this._pendingChanges.map(c => c.changes).map(c => changesToString(c)).join(' then ');
                console.log('Considering non-processed changes', changes);
            }
            const curToFutureTransformerTokens = MonotonousIndexTransformer.fromMany(this._pendingChanges.map((c) => linesLengthEditFromModelContentChange(c.changes)));
            // Filter tokens in lines that got changed in the future to prevent flickering
            // These tokens are recomputed anyway.
            const b = new ContiguousMultilineTokensBuilder();
            for (const t of tokens) {
                for (let i = t.startLineNumber; i <= t.endLineNumber; i++) {
                    const result = curToFutureTransformerTokens.transform(i - 1);
                    // If result is undefined, the current line got touched by an edit.
                    // The webworker will send us new tokens for all the new/touched lines after it received the edits.
                    if (result !== undefined) {
                        b.add(i, t.getLineTokens(i));
                    }
                }
            }
            tokens = b.finalize();
            // Apply future changes to tokens
            for (const change of this._pendingChanges) {
                for (const innerChanges of change.changes) {
                    for (let j = 0; j < tokens.length; j++) {
                        tokens[j].applyEdit(innerChanges.range, innerChanges.text);
                    }
                }
            }
        }
        const curToFutureTransformerStates = MonotonousIndexTransformer.fromMany(this._pendingChanges.map((c) => linesLengthEditFromModelContentChange(c.changes)));
        if (!this._applyStateStackDiffFn || !this._initialState) {
            const { applyStateStackDiff, INITIAL } = await importAMDNodeModule('vscode-textmate', 'release/main.js');
            this._applyStateStackDiffFn = applyStateStackDiff;
            this._initialState = INITIAL;
        }
        // Apply state deltas to _states and _backgroundTokenizationStore
        for (const d of stateDeltas) {
            let prevState = d.startLineNumber <= 1 ? this._initialState : this._states.getEndState(d.startLineNumber - 1);
            for (let i = 0; i < d.stateDeltas.length; i++) {
                const delta = d.stateDeltas[i];
                let state;
                if (delta) {
                    state = this._applyStateStackDiffFn(prevState, delta);
                    this._states.setEndState(d.startLineNumber + i, state);
                }
                else {
                    state = this._states.getEndState(d.startLineNumber + i);
                }
                const offset = curToFutureTransformerStates.transform(d.startLineNumber + i - 1);
                if (offset !== undefined) {
                    // Only set the state if there is no future change in this line,
                    // as this might make consumers believe that the state/tokens are accurate
                    this._backgroundTokenizationStore.setEndState(offset + 1, state);
                }
                if (d.startLineNumber + i >= this._model.getLineCount() - 1) {
                    this._backgroundTokenizationStore.backgroundTokenizationFinished();
                }
                prevState = state;
            }
        }
        // First set states, then tokens, so that events fired from set tokens don't read invalid states
        this._backgroundTokenizationStore.setTokens(tokens);
    }
    get _shouldLog() { return this._loggingEnabled.get(); }
}
function changesToString(changes) {
    return changes.map(c => Range.lift(c.range).toString() + ' => ' + c.text).join(' & ');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dE1hdGVXb3JrZXJUb2tlbml6ZXJDb250cm9sbGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy90ZXh0TWF0ZS9icm93c2VyL2JhY2tncm91bmRUb2tlbml6YXRpb24vdGV4dE1hdGVXb3JrZXJUb2tlbml6ZXJDb250cm9sbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQzdELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLEVBQWUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRTlGLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNsRixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFHbkUsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFHL0YsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLE1BQU0seUVBQXlFLENBQUM7QUFFM0gsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sc0VBQXNFLENBQUM7QUFDN0csT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFHcEUsT0FBTyxFQUFFLHFDQUFxQyxFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFFbEgsTUFBTSxPQUFPLGlDQUFrQyxTQUFRLFVBQVU7YUFDakQsUUFBRyxHQUFHLENBQUMsQ0FBQztJQWdCdkIsWUFDa0IsTUFBa0IsRUFDbEIsT0FBNEMsRUFDNUMsZ0JBQWtDLEVBQ2xDLDRCQUEwRCxFQUMxRCxxQkFBNEMsRUFDNUMsMEJBQStDO1FBRWhFLEtBQUssRUFBRSxDQUFDO1FBUFMsV0FBTSxHQUFOLE1BQU0sQ0FBWTtRQUNs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