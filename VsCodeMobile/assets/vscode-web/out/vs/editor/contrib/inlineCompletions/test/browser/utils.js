/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { timeout } from '../../../../../base/common/async.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { CoreEditingCommands, CoreNavigationCommands } from '../../../../browser/coreCommands.js';
import { withAsyncTestCodeEditor } from '../../../../test/browser/testCodeEditor.js';
import { autorun, derived } from '../../../../../base/common/observable.js';
import { runWithFakedTimers } from '../../../../../base/test/common/timeTravelScheduler.js';
import { IAccessibilitySignalService } from '../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { ILanguageFeaturesService } from '../../../../common/services/languageFeatures.js';
import { LanguageFeaturesService } from '../../../../common/services/languageFeaturesService.js';
import { InlineCompletionsController } from '../../browser/controller/inlineCompletionsController.js';
import { Range } from '../../../../common/core/range.js';
import { TextEdit } from '../../../../common/core/edits/textEdit.js';
import { BugIndicatingError } from '../../../../../base/common/errors.js';
import { PositionOffsetTransformer } from '../../../../common/core/text/positionToOffset.js';
import { InlineSuggestionsView } from '../../browser/view/inlineSuggestionsView.js';
export class MockInlineCompletionsProvider {
    constructor(enableForwardStability = false) {
        this.enableForwardStability = enableForwardStability;
        this.returnValue = [];
        this.delayMs = 0;
        this.callHistory = new Array();
        this.calledTwiceIn50Ms = false;
        this.lastTimeMs = undefined;
    }
    setReturnValue(value, delayMs = 0) {
        this.returnValue = value ? [value] : [];
        this.delayMs = delayMs;
    }
    setReturnValues(values, delayMs = 0) {
        this.returnValue = values;
        this.delayMs = delayMs;
    }
    getAndClearCallHistory() {
        const history = [...this.callHistory];
        this.callHistory = [];
        return history;
    }
    assertNotCalledTwiceWithin50ms() {
        if (this.calledTwiceIn50Ms) {
            throw new Error('provideInlineCompletions has been called at least twice within 50ms. This should not happen.');
        }
    }
    async provideInlineCompletions(model, position, context, token) {
        const currentTimeMs = new Date().getTime();
        if (this.lastTimeMs && currentTimeMs - this.lastTimeMs < 50) {
            this.calledTwiceIn50Ms = true;
        }
        this.lastTimeMs = currentTimeMs;
        this.callHistory.push({
            position: position.toString(),
            triggerKind: context.triggerKind,
            text: model.getValue()
        });
        const result = new Array();
        for (const v of this.returnValue) {
            const x = { ...v };
            if (!x.range) {
                x.range = model.getFullModelRange();
            }
            result.push(x);
        }
        if (this.delayMs > 0) {
            await timeout(this.delayMs);
        }
        return { items: result, enableForwardStability: this.enableForwardStability };
    }
    disposeInlineCompletions() { }
    handleItemDidShow() { }
}
export class MockSearchReplaceCompletionsProvider {
    constructor() {
        this._map = new Map();
    }
    add(search, replace) {
        this._map.set(search, replace);
    }
    async provideInlineCompletions(model, position, context, token) {
        const text = model.getValue();
        for (const [search, replace] of this._map) {
            const idx = text.indexOf(search);
            // replace idx...idx+text.length with replace
            if (idx !== -1) {
                const range = Range.fromPositions(model.getPositionAt(idx), model.getPositionAt(idx + search.length));
                return {
                    items: [
                        { range, insertText: replace, isInlineEdit: true }
                    ]
                };
            }
        }
        return { items: [] };
    }
    disposeInlineCompletions() { }
    handleItemDidShow() { }
}
export class InlineEditContext extends Disposable {
    constructor(model, editor) {
        super();
        this.editor = editor;
        this.prettyViewStates = new Array();
        const edit = derived(reader => {
            const state = model.state.read(reader);
            return state ? new TextEdit(state.edits) : undefined;
        });
        this._register(autorun(reader => {
            /** @description update */
            const e = edit.read(reader);
            let view;
            if (e) {
                view = e.toString(this.editor.getValue());
            }
            else {
                view = undefined;
            }
            this.prettyViewStates.push(view);
        }));
    }
    getAndClearViewStates() {
        const arr = [...this.prettyViewStates];
        this.prettyViewStates.length = 0;
        return arr;
    }
}
export class GhostTextContext extends Disposable {
    get currentPrettyViewState() {
        return this._currentPrettyViewState;
    }
    constructor(model, editor) {
        super();
        this.editor = editor;
        this.prettyViewStates = new Array();
        this._register(autorun(reader => {
            /** @description update */
            const ghostText = model.primaryGhostText.read(reader);
            let view;
            if (ghostText) {
                view = ghostText.render(this.editor.getValue(), true);
            }
            else {
                view = this.editor.getValue();
            }
            if (this._currentPrettyViewState !== view) {
                this.prettyViewStates.push(view);
            }
            this._currentPrettyViewState = view;
        }));
    }
    getAndClearViewStates() {
        const arr = [...this.prettyViewStates];
        this.prettyViewStates.length = 0;
        return arr;
    }
    keyboardType(text) {
        this.editor.trigger('keyboard', 'type', { text });
    }
    cursorUp() {
        this.editor.runCommand(CoreNavigationCommands.CursorUp, null);
    }
    cursorRight() {
        this.editor.runCommand(CoreNavigationCommands.CursorRight, null);
    }
    cursorLeft() {
        this.editor.runCommand(CoreNavigationCommands.CursorLeft, null);
    }
    cursorDown() {
        this.editor.runCommand(CoreNavigationCommands.CursorDown, null);
    }
    cursorLineEnd() {
        this.editor.runCommand(CoreNavigationCommands.CursorLineEnd, null);
    }
    leftDelete() {
        this.editor.runCommand(CoreEditingCommands.DeleteLeft, null);
    }
}
export async function withAsyncTestCodeEditorAndInlineCompletionsModel(text, options, callback) {
    return await runWithFakedTimers({
        useFakeTimers: options.fakeClock,
    }, async () => {
        const disposableStore = new DisposableStore();
        try {
            if (options.provider) {
                const languageFeaturesService = new LanguageFeaturesService();
                if (!options.serviceCollection) {
                    options.serviceCollection = new ServiceCollection();
                }
                options.serviceCollection.set(ILanguageFeaturesService, languageFeaturesService);
                // eslint-disable-next-line local/code-no-any-casts
                options.serviceCollection.set(IAccessibilitySignalService, {
                    playSignal: async () => { },
                    isSoundEnabled(signal) { return false; },
                });
                const d = languageFeaturesService.inlineCompletionsProvider.register({ pattern: '**' }, options.provider);
                disposableStore.add(d);
            }
            let result;
            await withAsyncTestCodeEditor(text, options, async (editor, editorViewModel, instantiationService) => {
                instantiationService.stubInstance(InlineSuggestionsView, {
                    shouldShowHoverAtViewZone: () => false,
                    dispose: () => { },
                });
                const controller = instantiationService.createInstance(InlineCompletionsController, editor);
                const model = controller.model.get();
                const context = new GhostTextContext(model, editor);
                try {
                    result = await callback({ editor, editorViewModel, model, context, store: disposableStore });
                }
                finally {
                    context.dispose();
                    model.dispose();
                    controller.dispose();
                }
            });
            if (options.provider instanceof MockInlineCompletionsProvider) {
                options.provider.assertNotCalledTwiceWithin50ms();
            }
            return result;
        }
        finally {
            disposableStore.dispose();
        }
    });
}
export class AnnotatedString {
    constructor(src, annotations = ['↓']) {
        const markers = findMarkers(src, annotations);
        this.value = markers.textWithoutMarkers;
        this.markers = markers.results;
    }
    getMarkerOffset(markerIdx = 0) {
        if (markerIdx >= this.markers.length) {
            throw new BugIndicatingError(`Marker index ${markerIdx} out of bounds`);
        }
        return this.markers[markerIdx].idx;
    }
}
function findMarkers(text, markers) {
    const results = [];
    let textWithoutMarkers = '';
    markers.sort((a, b) => b.length - a.length);
    let pos = 0;
    for (let i = 0; i < text.length;) {
        let foundMarker = false;
        for (const marker of markers) {
            if (text.startsWith(marker, i)) {
                results.push({ mark: marker, idx: pos });
                i += marker.length;
                foundMarker = true;
                break;
            }
        }
        if (!foundMarker) {
            textWithoutMarkers += text[i];
            pos++;
            i++;
        }
    }
    return { results, textWithoutMarkers };
}
export class AnnotatedText extends AnnotatedString {
    constructor() {
        super(...arguments);
        this._transformer = new PositionOffsetTransformer(this.value);
    }
    getMarkerPosition(markerIdx = 0) {
        return this._transformer.getPosition(this.getMarkerOffset(markerIdx));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvdGVzdC9icm93c2VyL3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUU5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBSWxHLE9BQU8sRUFBdUQsdUJBQXVCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUUxSSxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzVGLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLG1GQUFtRixDQUFDO0FBQ2hJLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1FQUFtRSxDQUFDO0FBQ3RHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQzNGLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBRWpHLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDckUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDMUUsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDN0YsT0FBTyxFQUFF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