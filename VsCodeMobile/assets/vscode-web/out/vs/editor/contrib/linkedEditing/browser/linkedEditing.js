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
var LinkedEditingContribution_1;
import * as arrays from '../../../../base/common/arrays.js';
import { Delayer, first } from '../../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Color } from '../../../../base/common/color.js';
import { isCancellationError, onUnexpectedError, onUnexpectedExternalError } from '../../../../base/common/errors.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import * as strings from '../../../../base/common/strings.js';
import { URI } from '../../../../base/common/uri.js';
import { EditorAction, EditorCommand, registerEditorAction, registerEditorCommand, registerEditorContribution, registerModelAndPositionCommand } from '../../../browser/editorExtensions.js';
import { ICodeEditorService } from '../../../browser/services/codeEditorService.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import { EditorContextKeys } from '../../../common/editorContextKeys.js';
import { ModelDecorationOptions } from '../../../common/model/textModel.js';
import { ILanguageConfigurationService } from '../../../common/languages/languageConfigurationRegistry.js';
import * as nls from '../../../../nls.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { ILanguageFeaturesService } from '../../../common/services/languageFeatures.js';
import { registerColor } from '../../../../platform/theme/common/colorRegistry.js';
import { ILanguageFeatureDebounceService } from '../../../common/services/languageFeatureDebounce.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';
import './linkedEditing.css';
export const CONTEXT_ONTYPE_RENAME_INPUT_VISIBLE = new RawContextKey('LinkedEditingInputVisible', false);
const DECORATION_CLASS_NAME = 'linked-editing-decoration';
let LinkedEditingContribution = class LinkedEditingContribution extends Disposable {
    static { LinkedEditingContribution_1 = this; }
    static { this.ID = 'editor.contrib.linkedEditing'; }
    static { this.DECORATION = ModelDecorationOptions.register({
        description: 'linked-editing',
        stickiness: 0 /* TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges */,
        className: DECORATION_CLASS_NAME
    }); }
    static get(editor) {
        return editor.getContribution(LinkedEditingContribution_1.ID);
    }
    constructor(editor, contextKeyService, languageFeaturesService, languageConfigurationService, languageFeatureDebounceService) {
        super();
        this.languageConfigurationService = languageConfigurationService;
        this._syncRangesToken = 0;
        this._localToDispose = this._register(new DisposableStore());
        this._editor = editor;
        this._providers = languageFeaturesService.linkedEditingRangeProvider;
        this._enabled = false;
        this._visibleContextKey = CONTEXT_ONTYPE_RENAME_INPUT_VISIBLE.bindTo(contextKeyService);
        this._debounceInformation = languageFeatureDebounceService.for(this._providers, 'Linked Editing', { max: 200 });
        this._currentDecorations = this._editor.createDecorationsCollection();
        this._languageWordPattern = null;
        this._currentWordPattern = null;
        this._ignoreChangeEvent = false;
        this._localToDispose = this._register(new DisposableStore());
        this._rangeUpdateTriggerPromise = null;
        this._rangeSyncTriggerPromise = null;
        this._currentRequestCts = null;
        this._currentRequestPosition = null;
        this._currentRequestModelVersion = null;
        this._register(this._editor.onDidChangeModel(() => this.reinitialize(true)));
        this._register(this._editor.onDidChangeConfiguration(e => {
            if (e.hasChanged(78 /* EditorOption.linkedEditing */) || e.hasChanged(106 /* EditorOption.renameOnType */)) {
                this.reinitialize(false);
            }
        }));
        this._register(this._providers.onDidChange(() => this.reinitialize(false)));
        this._register(this._editor.onDidChangeModelLanguage(() => this.reinitialize(true)));
        this.reinitialize(true);
    }
    reinitialize(forceRefresh) {
        const model = this._editor.getModel();
        const isEnabled = model !== null && (this._editor.getOption(78 /* EditorOption.linkedEditing */) || this._editor.getOption(106 /* EditorOption.renameOnType */)) && this._providers.has(model);
        if (isEnabled === this._enabled && !forceRefresh) {
            return;
        }
        this._enabled = isEnabled;
        this.clearRanges();
        this._localToDispose.clear();
        if (!isEnabled || model === null) {
            return;
        }
        this._localToDispose.add(Event.runAndSubscribe(model.onDidChangeLanguageConfiguration, () => {
            this._languageWordPattern = this.languageConfigurationService.getLanguageConfiguration(model.getLanguageId()).getWordDefinition();
        }));
        const rangeUpdateScheduler = new Delayer(this._debounceInformation.get(model));
        const triggerRangeUpdate = () => {
            this._rangeUpdateTriggerPromise = rangeUpdateScheduler.trigger(() => this.updateRanges(), this._debounceDuration ?? this._debounceInformation.get(model));
        };
        const rangeSyncScheduler = new Delayer(0);
        const triggerRangeSync = (token) => {
            this._rangeSyncTriggerPromise = rangeSyncScheduler.trigger(() => this._syncRanges(token));
        };
        this._localToDispose.add(this._editor.onDidChangeCursorPosition(() => {
            triggerRangeUpdate();
        }));
        this._localToDispose.add(this._editor.onDidChangeModelContent((e) => {
            if (!this._ignoreChangeEvent) {
                if (this._currentDecorations.length > 0) {
                    const referenceRange = this._currentDecorations.getRange(0);
                    if (referenceRange && e.changes.every(c => referenceRange.intersectRanges(c.range))) {
                        triggerRangeSync(this._syncRangesToken);
                        return;
                    }
                }
            }
            triggerRangeUpdate();
        }));
        this._localToDispose.add({
            dispose: () => {
                rangeUpdateScheduler.dispose();
                rangeSyncScheduler.dispose();
            }
        });
        this.updateRanges();
    }
    _syncRanges(token) {
        // delayed invocation, make sure we're still on
        if (!this._editor.hasModel() || token !== this._syncRangesToken || this._currentDecorations.length === 0) {
            // nothing to do
            return;
        }
        const model = this._editor.getModel();
        const referenceRange = this._currentDecorations.getRange(0);
        if (!referenceRange || referenceRange.startLineNumber !== referenceRange.endLineNumber) {
            return this.clearRanges();
        }
        const referenceValue = model.getValueInRange(referenceRange);
        if (this._currentWordPattern) {
            const match = referenceValue.match(this._currentWordPattern);
            const matchLength = match ? match[0].length : 0;
            if (matchLength !== referenceValue.length) {
                return this.clearRanges();
            }
        }
        const edits = [];
        for (let i = 1, len = this._currentDecorations.length; i < len; i++) {
            const mirrorRange = this._currentDecorations.getRange(i);
            if (!mirrorRange) {
                continue;
            }
            if (mirrorRange.startLineNumber !== mirrorRange.endLineNumber) {
                edits.push({
                    range: mirrorRange,
                    text: referenceValue
                });
            }
            else {
                let oldValue = model.getValueInRange(mirrorRange);
                let newValue = referenceValue;
                let rangeStartColumn = mirrorRange.startColumn;
                let rangeEndColumn = mirrorRange.endColumn;
                const commonPrefixLength = strings.commonPrefixLength(oldValue, newValue);
                rangeStartColumn += commonPrefixLength;
                oldValue = oldValue.substr(commonPrefixLength);
                newValue = newValue.substr(commonPrefixLength);
                const commonSuffixLength = strings.commonSuffixLength(oldValue, newValue);
                rangeEndColumn -= commonSuffixLength;
                oldValue = oldValue.substr(0, oldValue.length - commonSuffixLength);
                newValue = newValue.substr(0, newValue.length - commonSuffixLength);
                if (rangeStartColumn !== rangeEndColumn || newValue.length !== 0) {
                    edits.push({
                        range: new Range(mirrorRange.startLineNumber, rangeStartColumn, mirrorRange.endLineNumber, rangeEndColumn),
                        text: newValue
                    });
                }
            }
        }
        if (edits.length === 0) {
            return;
        }
        try {
            this._editor.popUndoStop();
            this._ignoreChangeEvent = true;
            const prevEditOperationType = this._editor._getViewModel().getPrevEditOperationType();
            this._editor.executeEdits('linkedEditing', edits);
            this._editor._getViewModel().setPrevEditOperationType(prevEditOperationType);
        }
        finally {
            this._ignoreChangeEvent = false;
        }
    }
    dispose() {
        this.clearRanges();
        super.dispose();
    }
    clearRanges() {
        this._visibleContextKey.set(false);
        this._currentDecorations.clear();
        if (this._currentRequestCts) {
            this._currentRequestCts.cancel();
            this._currentRequestCts = null;
            this._currentRequestPosition = null;
        }
    }
    get currentUpdateTriggerPromise() {
        return this._rangeUpdateTriggerPromise || Promise.resolve();
    }
    get currentSyncTriggerPromise() {
        return this._rangeSyncTriggerPromise || Promise.resolve();
    }
    async updateRanges(force = false) {
        if (!this._editor.hasModel()) {
            this.clearRanges();
            return;
        }
        const position = this._editor.getPosition();
        if (!this._enabled && !force || this._editor.getSelections().length > 1) {
            // disabled or multicursor
            this.clearRanges();
            return;
        }
        const model = this._editor.getModel();
        const modelVersionId = model.getVersionId();
        if (this._currentRequestPosition && this._currentRequestModelVersion === modelVersionId) {
            if (position.equals(this._currentRequestPosition)) {
                return; // same position
            }
            if (this._currentDecorations.length > 0) {
                const range = this._currentDecorations.getRange(0);
                if (range && range.containsPosition(position)) {
                    return; // just moving inside the existing primary range
                }
            }
        }
        if (!this._currentRequestPosition?.equals(position)) {
            // Get the current range of the first decoration (reference range)
            const currentRange = this._currentDecorations.getRange(0);
            // If there is no current range or the current range does not contain the new position, clear the ranges
            if (!currentRange?.containsPosition(position)) {
                // Clear existing decorations while we compute new ones
                this.clearRanges();
            }
        }
        this._currentRequestPosition = position;
        this._currentRequestModelVersion = modelVersionId;
        const currentRequestCts = this._currentRequestCts = new CancellationTokenSource();
        try {
            const sw = new StopWatch(false);
            const response = await getLinkedEditingRanges(this._providers, model, position, currentRequestCts.token);
            this._debounceInformation.update(model, sw.elapsed());
            if (currentRequestCts !== this._currentRequestCts) {
                return;
            }
            this._currentRequestCts = null;
            if (modelVersionId !== model.getVersionId()) {
                return;
            }
            let ranges = [];
            if (response?.ranges) {
                ranges = response.ranges;
            }
            this._currentWordPattern = response?.wordPattern || this._languageWordPattern;
            let foundReferenceRange = false;
            for (let i = 0, len = ranges.length; i < len; i++) {
                if (Range.containsPosition(ranges[i], position)) {
                    foundReferenceRange = true;
                    if (i !== 0) {
                        const referenceRange = ranges[i];
                        ranges.splice(i, 1);
                        ranges.unshift(referenceRange);
                    }
                    break;
                }
            }
            if (!foundReferenceRange) {
                // Cannot do linked editing if the ranges are not where the cursor is...
                this.clearRanges();
                return;
            }
            const decorations = ranges.map(range => ({ range: range, options: LinkedEditingContribution_1.DECORATION }));
            this._visibleContextKey.set(true);
            this._currentDecorations.set(decorations);
            this._syncRangesToken++; // cancel any pending syncRanges call
        }
        catch (err) {
            if (!isCancellationError(err)) {
                onUnexpectedError(err);
            }
            if (this._currentRequestCts === currentRequestCts || !this._currentRequestCts) {
                // stop if we are still the latest request
                this.clearRanges();
            }
        }
    }
    // for testing
    setDebounceDuration(timeInMS) {
        this._debounceDuration = timeInMS;
    }
};
LinkedEditingContribution = LinkedEditingContribution_1 = __decorate([
    __param(1, IContextKeyService),
    __param(2, ILanguageFeaturesService),
    __param(3, ILanguageConfigurationService),
    __param(4, ILanguageFeatureDebounceService)
], LinkedEditingContribution);
export { LinkedEditingContribution };
export class LinkedEditingAction extends EditorAction {
    constructor() {
        super({
            id: 'editor.action.linkedEditing',
            label: nls.localize2('linkedEditing.label', "Start Linked Editing"),
            precondition: ContextKeyExpr.and(EditorContextKeys.writable, EditorContextKeys.hasRenameProvider),
            kbOpts: {
                kbExpr: EditorContextKeys.editorTextFocus,
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 60 /* KeyCode.F2 */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
    runCommand(accessor, args) {
        const editorService = accessor.get(ICodeEditorService);
        const [uri, pos] = Array.isArray(args) && args || [undefined, undefined];
        if (URI.isUri(uri) && Position.isIPosition(pos)) {
            return editorService.openCodeEditor({ resource: uri }, editorService.getActiveCodeEditor()).then(editor => {
                if (!editor) {
                    return;
                }
                editor.setPosition(pos);
                editor.invokeWithinContext(accessor => {
                    this.reportTelemetry(accessor, editor);
                    return this.run(accessor, editor);
                });
            }, onUnexpectedError);
        }
        return super.runCommand(accessor, args);
    }
    run(_accessor, editor) {
        const controller = LinkedEditingContribution.get(editor);
        if (controller) {
            return Promise.resolve(controller.updateRanges(true));
        }
        return Promise.resolve();
    }
}
const LinkedEditingCommand = EditorCommand.bindToContribution(LinkedEditingContribution.get);
registerEditorCommand(new LinkedEditingCommand({
    id: 'cancelLinkedEditingInput',
    precondition: CONTEXT_ONTYPE_RENAME_INPUT_VISIBLE,
    handler: x => x.clearRanges(),
    kbOpts: {
        kbExpr: EditorContextKeys.editorTextFocus,
        weight: 100 /* KeybindingWeight.EditorContrib */ + 99,
        primary: 9 /* KeyCode.Escape */,
        secondary: [1024 /* KeyMod.Shift */ | 9 /* KeyCode.Escape */]
    }
}));
function getLinkedEditingRanges(providers, model, position, token) {
    const orderedByScore = providers.ordered(model);
    // in order of score ask the linked editing range provider
    // until someone response with a good result
    // (good = not null)
    return first(orderedByScore.map(provider => async () => {
        try {
            return await provider.provideLinkedEditingRanges(model, position, token);
        }
        catch (e) {
            onUnexpectedExternalError(e);
            return undefined;
        }
    }), result => !!result && arrays.isNonEmptyArray(result?.ranges));
}
export const editorLinkedEditingBackground = registerColor('editor.linkedEditingBackground', { dark: Color.fromHex('#f00').transparent(0.3), light: Color.fromHex('#f00').transparent(0.3), hcDark: Color.fromHex('#f00').transparent(0.3), hcLight: Color.white }, nls.localize('editorLinkedEditingBackground', 'Background color when the editor auto renames on type.'));
registerModelAndPositionCommand('_executeLinkedEditingProvider', (_accessor, model, position) => {
    const { linkedEditingRangeProvider } = _accessor.get(ILanguageFeaturesService);
    return getLinkedEditingRanges(linkedEditingRangeProvider, model, position, CancellationToken.None);
});
registerEditorContribution(LinkedEditingContribution.ID, LinkedEditingContribution, 1 /* EditorContributionInstantiation.AfterFirstRender */);
registerEditorAction(LinkedEditingAction);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlua2VkRWRpdGluZy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9saW5rZWRFZGl0aW5nL2Jyb3dzZXIvbGlua2VkRWRpdGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLE1BQU0sTUFBTSxtQ0FBbUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsaUJBQWlCLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN0SCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFekQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRixPQUFPLEtBQUssT0FBTyxNQUFNLG9DQUFvQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVyRCxPQUFPLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBbUMsb0JBQW9CLEVBQUUscUJBQXFCLEVBQUUsMEJBQTBCLEVBQUUsK0JBQStCLEVBQW9CLE1BQU0sc0NBQXNDLENBQUM7QUFDaFAsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFFcEYsT0FBTyxFQUFhLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBVSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUU5RCxPQUFPLEVBQUUsaUJBQWlCLEVB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