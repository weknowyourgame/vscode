/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../../base/common/lifecycle.js';
import { autorunWithStore, derived, observableFromEvent } from '../../../../../../../base/common/observable.js';
import { observableCodeEditor } from '../../../../../../browser/observableCodeEditor.js';
import { rangeIsSingleLine } from '../../../../../../browser/widget/diffEditor/components/diffEditorViewZones/diffEditorViewZones.js';
import { OffsetRange } from '../../../../../../common/core/ranges/offsetRange.js';
import { Range } from '../../../../../../common/core/range.js';
import { InjectedTextCursorStops } from '../../../../../../common/model.js';
import { ModelDecorationOptions } from '../../../../../../common/model/textModel.js';
import { classNames } from '../utils/utils.js';
export class OriginalEditorInlineDiffView extends Disposable {
    static supportsInlineDiffRendering(mapping) {
        return allowsTrueInlineDiffRendering(mapping);
    }
    constructor(_originalEditor, _state, _modifiedTextModel) {
        super();
        this._originalEditor = _originalEditor;
        this._state = _state;
        this._modifiedTextModel = _modifiedTextModel;
        this._onDidClick = this._register(new Emitter());
        this.onDidClick = this._onDidClick.event;
        this.isHovered = observableCodeEditor(this._originalEditor).isTargetHovered(p => p.target.type === 6 /* MouseTargetType.CONTENT_TEXT */ &&
            p.target.detail.injectedText?.options.attachedData instanceof InlineEditAttachedData &&
            p.target.detail.injectedText.options.attachedData.owner === this, this._store);
        this._tokenizationFinished = modelTokenizationFinished(this._modifiedTextModel);
        this._decorations = derived(this, reader => {
            const diff = this._state.read(reader);
            if (!diff) {
                return undefined;
            }
            const modified = diff.modifiedText;
            const showInline = diff.mode === 'insertionInline';
            const hasOneInnerChange = diff.diff.length === 1 && diff.diff[0].innerChanges?.length === 1;
            const showEmptyDecorations = true;
            const originalDecorations = [];
            const modifiedDecorations = [];
            const diffLineAddDecorationBackground = ModelDecorationOptions.register({
                className: 'inlineCompletions-line-insert',
                description: 'line-insert',
                isWholeLine: true,
                marginClassName: 'gutter-insert',
            });
            const diffLineDeleteDecorationBackground = ModelDecorationOptions.register({
                className: 'inlineCompletions-line-delete',
                description: 'line-delete',
                isWholeLine: true,
                marginClassName: 'gutter-delete',
            });
            const diffWholeLineDeleteDecoration = ModelDecorationOptions.register({
                className: 'inlineCompletions-char-delete',
                description: 'char-delete',
                isWholeLine: false,
                zIndex: 1, // be on top of diff background decoration
            });
            const diffWholeLineAddDecoration = ModelDecorationOptions.register({
                className: 'inlineCompletions-char-insert',
                description: 'char-insert',
                isWholeLine: true,
            });
            const diffAddDecoration = ModelDecorationOptions.register({
                className: 'inlineCompletions-char-insert',
                description: 'char-insert',
                shouldFillLineOnLineBreak: true,
            });
            const diffAddDecorationEmpty = ModelDecorationOptions.register({
                className: 'inlineCompletions-char-insert diff-range-empty',
                description: 'char-insert diff-range-empty',
            });
            const NESOriginalBackground = ModelDecorationOptions.register({
                className: 'inlineCompletions-original-lines',
                description: 'inlineCompletions-original-lines',
                isWholeLine: false,
                shouldFillLineOnLineBreak: true,
            });
            const showFullLineDecorations = diff.mode !== 'sideBySide' && diff.mode !== 'deletion' && diff.mode !== 'insertionInline' && diff.mode !== 'lineReplacement';
            const hideEmptyInnerDecorations = diff.mode === 'lineReplacement';
            for (const m of diff.diff) {
                if (showFullLineDecorations) {
                    if (!m.original.isEmpty) {
                        originalDecorations.push({
                            range: m.original.toInclusiveRange(),
                            options: diffLineDeleteDecorationBackground,
                        });
                    }
                    if (!m.modified.isEmpty) {
                        modifiedDecorations.push({
                            range: m.modified.toInclusiveRange(),
                            options: diffLineAddDecorationBackground,
                        });
                    }
                }
                if (m.modified.isEmpty || m.original.isEmpty) {
                    if (!m.original.isEmpty) {
                        originalDecorations.push({ range: m.original.toInclusiveRange(), options: diffWholeLineDeleteDecoration });
                    }
                    if (!m.modified.isEmpty) {
                        modifiedDecorations.push({ range: m.modified.toInclusiveRange(), options: diffWholeLineAddDecoration });
                    }
                }
                else {
                    const useInlineDiff = showInline && allowsTrueInlineDiffRendering(m);
                    for (const i of m.innerChanges || []) {
                        // Don't show empty markers outside the line range
                        if (m.original.contains(i.originalRange.startLineNumber) && !(hideEmptyInnerDecorations && i.originalRange.isEmpty())) {
                            const replacedText = this._originalEditor.getModel()?.getValueInRange(i.originalRange, 1 /* EndOfLinePreference.LF */);
                            originalDecorations.push({
                                range: i.originalRange,
                                options: {
                                    description: 'char-delete',
                                    shouldFillLineOnLineBreak: false,
                                    className: classNames('inlineCompletions-char-delete', i.originalRange.isSingleLine() && diff.mode === 'insertionInline' && 'single-line-inline', i.originalRange.isEmpty() && 'empty', ((i.originalRange.isEmpty() && hasOneInnerChange || diff.mode === 'deletion' && replacedText === '\n') && showEmptyDecorations && !useInlineDiff) && 'diff-range-empty'),
                                    inlineClassName: useInlineDiff ? classNames('strike-through', 'inlineCompletions') : null,
                                    zIndex: 1
                                }
                            });
                        }
                        if (m.modified.contains(i.modifiedRange.startLineNumber)) {
                            modifiedDecorations.push({
                                range: i.modifiedRange,
                                options: (i.modifiedRange.isEmpty() && showEmptyDecorations && !useInlineDiff && hasOneInnerChange)
                                    ? diffAddDecorationEmpty
                                    : diffAddDecoration
                            });
                        }
                        if (useInlineDiff) {
                            const insertedText = modified.getValueOfRange(i.modifiedRange);
                            // when the injected text becomes long, the editor will split it into multiple spans
                            // to be able to get the border around the start and end of the text, we need to split it into multiple segments
                            const textSegments = insertedText.length > 3 ?
                                [
                                    { text: insertedText.slice(0, 1), extraClasses: ['start'], offsetRange: new OffsetRange(i.modifiedRange.startColumn - 1, i.modifiedRange.startColumn) },
                                    { text: insertedText.slice(1, -1), extraClasses: [], offsetRange: new OffsetRange(i.modifiedRange.startColumn, i.modifiedRange.endColumn - 2) },
                                    { text: insertedText.slice(-1), extraClasses: ['end'], offsetRange: new OffsetRange(i.modifiedRange.endColumn - 2, i.modifiedRange.endColumn - 1) }
                                ] :
                                [
                                    { text: insertedText, extraClasses: ['start', 'end'], offsetRange: new OffsetRange(i.modifiedRange.startColumn - 1, i.modifiedRange.endColumn) }
                                ];
                            // Tokenization
                            this._tokenizationFinished.read(reader); // reconsider when tokenization is finished
                            const lineTokens = this._modifiedTextModel.tokenization.getLineTokens(i.modifiedRange.startLineNumber);
                            for (const { text, extraClasses, offsetRange } of textSegments) {
                                originalDecorations.push({
                                    range: Range.fromPositions(i.originalRange.getEndPosition()),
                                    options: {
                                        description: 'inserted-text',
                                        before: {
                                            tokens: lineTokens.getTokensInRange(offsetRange),
                                            content: text,
                                            inlineClassName: classNames('inlineCompletions-char-insert', i.modifiedRange.isSingleLine() && diff.mode === 'insertionInline' && 'single-line-inline', ...extraClasses // include extraClasses for additional styling if provided
                                            ),
                                            cursorStops: InjectedTextCursorStops.None,
                                            attachedData: new InlineEditAttachedData(this),
                                        },
                                        zIndex: 2,
                                        showIfCollapsed: true,
                                    }
                                });
                            }
                        }
                    }
                }
            }
            if (diff.isInDiffEditor) {
                for (const m of diff.diff) {
                    if (!m.original.isEmpty) {
                        originalDecorations.push({
                            range: m.original.toExclusiveRange(),
                            options: NESOriginalBackground,
                        });
                    }
                }
            }
            return { originalDecorations, modifiedDecorations };
        });
        this._register(observableCodeEditor(this._originalEditor).setDecorations(this._decorations.map(d => d?.originalDecorations ?? [])));
        const modifiedCodeEditor = this._state.map(s => s?.modifiedCodeEditor);
        this._register(autorunWithStore((reader, store) => {
            const e = modifiedCodeEditor.read(reader);
            if (e) {
                store.add(observableCodeEditor(e).setDecorations(this._decorations.map(d => d?.modifiedDecorations ?? [])));
            }
        }));
        this._register(this._originalEditor.onMouseUp(e => {
            if (e.target.type !== 6 /* MouseTargetType.CONTENT_TEXT */) {
                return;
            }
            const a = e.target.detail.injectedText?.options.attachedData;
            if (a instanceof InlineEditAttachedData && a.owner === this) {
                this._onDidClick.fire(e.event);
            }
        }));
    }
}
class InlineEditAttachedData {
    constructor(owner) {
        this.owner = owner;
    }
}
function allowsTrueInlineDiffRendering(mapping) {
    if (!mapping.innerChanges) {
        return false;
    }
    return mapping.innerChanges.every(c => (rangeIsSingleLine(c.modifiedRange) && rangeIsSingleLine(c.originalRange)));
}
let i = 0;
function modelTokenizationFinished(model) {
    return observableFromEvent(model.onDidChangeTokens, () => i++);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZ2luYWxFZGl0b3JJbmxpbmVEaWZmVmlldy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvaW5saW5lRWRpdHNWaWV3cy9vcmlnaW5hbEVkaXRvcklubGluZURpZmZWaWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE9BQU8sRUFBZSxtQkFBbUIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBRTdILE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1HQUFtRyxDQUFDO0FBQ3RJLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNsRixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFHL0QsT0FBTyxFQUE4Qyx1QkFBdUIsRUFBYyxNQUFNLG1DQUFtQyxDQUFDO0FBQ3BJLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRXJGLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQVcvQyxNQUFNLE9BQU8sNEJBQTZCLFNBQVEsVUFBVTtJQUNwRCxNQUFNLENBQUMsMkJBQTJCLENBQUMsT0FBaUM7UUFDMUUsT0FBTyw2QkFBNkIsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBU0QsWUFDa0IsZUFBNEIsRUFDNUIsTUFBbUUsRUFDbkUsa0JBQThCO1FBRS9DLEtBQUssRUFBRSxD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