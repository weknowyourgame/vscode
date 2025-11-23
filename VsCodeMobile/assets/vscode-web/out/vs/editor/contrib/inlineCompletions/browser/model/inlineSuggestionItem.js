/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BugIndicatingError } from '../../../../../base/common/errors.js';
import { matchesSubString } from '../../../../../base/common/filters.js';
import { observableSignal, observableValue } from '../../../../../base/common/observable.js';
import { commonPrefixLength, commonSuffixLength, splitLines } from '../../../../../base/common/strings.js';
import { applyEditsToRanges, StringEdit, StringReplacement } from '../../../../common/core/edits/stringEdit.js';
import { TextEdit, TextReplacement } from '../../../../common/core/edits/textEdit.js';
import { Range } from '../../../../common/core/range.js';
import { OffsetRange } from '../../../../common/core/ranges/offsetRange.js';
import { StringText } from '../../../../common/core/text/abstractText.js';
import { getPositionOffsetTransformerFromTextModel } from '../../../../common/core/text/getPositionOffsetTransformerFromTextModel.js';
import { TextLength } from '../../../../common/core/text/textLength.js';
import { linesDiffComputers } from '../../../../common/diff/linesDiffComputers.js';
import { InlineCompletionTriggerKind } from '../../../../common/languages.js';
import { TextModelText } from '../../../../common/model/textModelText.js';
import { singleTextRemoveCommonPrefix } from './singleTextEditHelpers.js';
export var InlineSuggestionItem;
(function (InlineSuggestionItem) {
    function create(data, textModel) {
        if (!data.isInlineEdit && !data.uri) {
            return InlineCompletionItem.create(data, textModel);
        }
        else {
            return InlineEditItem.create(data, textModel);
        }
    }
    InlineSuggestionItem.create = create;
})(InlineSuggestionItem || (InlineSuggestionItem = {}));
class InlineSuggestionItemBase {
    constructor(_data, identity, hint) {
        this._data = _data;
        this.identity = identity;
        this.hint = hint;
    }
    /**
     * A reference to the original inline completion list this inline completion has been constructed from.
     * Used for event data to ensure referential equality.
    */
    get source() { return this._data.source; }
    get isFromExplicitRequest() { return this._data.context.triggerKind === InlineCompletionTriggerKind.Explicit; }
    get forwardStable() { return this.source.inlineSuggestions.enableForwardStability ?? false; }
    get editRange() { return this.getSingleTextEdit().range; }
    get targetRange() { return this.hint?.range ?? this.editRange; }
    get insertText() { return this.getSingleTextEdit().text; }
    get semanticId() { return this.hash; }
    get action() { return this._sourceInlineCompletion.gutterMenuLinkAction; }
    get command() { return this._sourceInlineCompletion.command; }
    get warning() { return this._sourceInlineCompletion.warning; }
    get showInlineEditMenu() { return !!this._sourceInlineCompletion.showInlineEditMenu; }
    get hash() {
        return JSON.stringify([
            this.getSingleTextEdit().text,
            this.getSingleTextEdit().range.getStartPosition().toString()
        ]);
    }
    /** @deprecated */
    get shownCommand() { return this._sourceInlineCompletion.shownCommand; }
    get requestUuid() { return this._data.context.requestUuid; }
    get partialAccepts() { return this._data.partialAccepts; }
    /**
     * A reference to the original inline completion this inline completion has been constructed from.
     * Used for event data to ensure referential equality.
    */
    get _sourceInlineCompletion() { return this._data.sourceInlineCompletion; }
    addRef() {
        this.identity.addRef();
        this.source.addRef();
    }
    removeRef() {
        this.identity.removeRef();
        this.source.removeRef();
    }
    reportInlineEditShown(commandService, viewKind, viewData) {
        this._data.reportInlineEditShown(commandService, this.insertText, viewKind, viewData);
    }
    reportPartialAccept(acceptedCharacters, info, partialAcceptance) {
        this._data.reportPartialAccept(acceptedCharacters, info, partialAcceptance);
    }
    reportEndOfLife(reason) {
        this._data.reportEndOfLife(reason);
    }
    setEndOfLifeReason(reason) {
        this._data.setEndOfLifeReason(reason);
    }
    setIsPreceeded(item) {
        this._data.setIsPreceeded(item.partialAccepts);
    }
    setNotShownReasonIfNotSet(reason) {
        this._data.setNotShownReason(reason);
    }
    /**
     * Avoid using this method. Instead introduce getters for the needed properties.
    */
    getSourceCompletion() {
        return this._sourceInlineCompletion;
    }
}
export class InlineSuggestionIdentity {
    constructor() {
        this._onDispose = observableSignal(this);
        this.onDispose = this._onDispose;
        this._jumpedTo = observableValue(this, false);
        this._refCount = 1;
        this.id = 'InlineCompletionIdentity' + InlineSuggestionIdentity.idCounter++;
    }
    static { this.idCounter = 0; }
    get jumpedTo() {
        return this._jumpedTo;
    }
    addRef() {
        this._refCount++;
    }
    removeRef() {
        this._refCount--;
        if (this._refCount === 0) {
            this._onDispose.trigger(undefined);
        }
    }
    setJumpTo(tx) {
        this._jumpedTo.set(true, tx);
    }
}
export class InlineSuggestHint {
    static create(displayLocation) {
        return new InlineSuggestHint(Range.lift(displayLocation.range), displayLocation.content, displayLocation.style);
    }
    constructor(range, content, style) {
        this.range = range;
        this.content = content;
        this.style = style;
    }
    withEdit(edit, positionOffsetTransformer) {
        const offsetRange = new OffsetRange(positionOffsetTransformer.getOffset(this.range.getStartPosition()), positionOffsetTransformer.getOffset(this.range.getEndPosition()));
        const newOffsetRange = applyEditsToRanges([offsetRange], edit)[0];
        if (!newOffsetRange) {
            return undefined;
        }
        const newRange = positionOffsetTransformer.getRange(newOffsetRange);
        return new InlineSuggestHint(newRange, this.content, this.style);
    }
}
export class InlineCompletionItem extends InlineSuggestionItemBase {
    static create(data, textModel) {
        const identity = new InlineSuggestionIdentity();
        const transformer = getPositionOffsetTransformerFromTextModel(textModel);
        const insertText = data.insertText.replace(/\r\n|\r|\n/g, textModel.getEOL());
        const edit = reshapeInlineCompletion(new StringReplacement(transformer.getOffsetRange(data.range), insertText), textModel);
        const trimmedEdit = edit.removeCommonSuffixAndPrefix(textModel.getValue());
        const textEdit = transformer.getTextReplacement(edit);
        const displayLocation = data.hint ? InlineSuggestHint.create(data.hint) : undefined;
        return new InlineCompletionItem(edit, trimmedEdit, textEdit, textEdit.range, data.snippetInfo, data.additionalTextEdits, data, identity, displayLocation);
    }
    constructor(_edit, _trimmedEdit, _textEdit, _originalRange, snippetInfo, additionalTextEdits, data, identity, displayLocation) {
        super(data, identity, displayLocation);
        this._edit = _edit;
        this._trimmedEdit = _trimmedEdit;
        this._textEdit = _textEdit;
        this._originalRange = _originalRange;
        this.snippetInfo = snippetInfo;
        this.additionalTextEdits = additionalTextEdits;
        this.isInlineEdit = false;
    }
    get hash() {
        return JSON.stringify(this._trimmedEdit.toJson());
    }
    getSingleTextEdit() { return this._textEdit; }
    withIdentity(identity) {
        return new InlineCompletionItem(this._edit, this._trimmedEdit, this._textEdit, this._originalRange, this.snippetInfo, this.additionalTextEdits, this._data, identity, this.hint);
    }
    withEdit(textModelEdit, textModel) {
        const newEditRange = applyEditsToRanges([this._edit.replaceRange], textModelEdit);
        if (newEditRange.length === 0) {
            return undefined;
        }
        const newEdit = new StringReplacement(newEditRange[0], this._textEdit.text);
        const positionOffsetTransformer = getPositionOffsetTransformerFromTextModel(textModel);
        const newTextEdit = positionOffsetTransformer.getTextReplacement(newEdit);
        let newDisplayLocation = this.hint;
        if (newDisplayLocation) {
            newDisplayLocation = newDisplayLocation.withEdit(textModelEdit, positionOffsetTransformer);
            if (!newDisplayLocation) {
                return undefined;
            }
        }
        const trimmedEdit = newEdit.removeCommonSuffixAndPrefix(textModel.getValue());
        return new InlineCompletionItem(newEdit, trimmedEdit, newTextEdit, this._originalRange, this.snippetInfo, this.additionalTextEdits, this._data, this.identity, newDisplayLocation);
    }
    canBeReused(model, position) {
        // TODO@hediet I believe this can be simplified to `return true;`, as applying an edit should kick out this suggestion.
        const updatedRange = this._textEdit.range;
        const result = !!updatedRange
            && updatedRange.containsPosition(position)
            && this.isVisible(model, position)
            && TextLength.ofRange(updatedRange).isGreaterThanOrEqualTo(TextLength.ofRange(this._originalRange));
        return result;
    }
    isVisible(model, cursorPosition) {
        const singleTextEdit = this.getSingleTextEdit();
        return inlineCompletionIsVisible(singleTextEdit, this._originalRange, model, cursorPosition);
    }
}
export function inlineCompletionIsVisible(singleTextEdit, originalRange, model, cursorPosition) {
    const minimizedReplacement = singleTextRemoveCommonPrefix(singleTextEdit, model);
    const editRange = singleTextEdit.range;
    if (!editRange
        || (originalRange && !originalRange.getStartPosition().equals(editRange.getStartPosition()))
        || cursorPosition.lineNumber !== minimizedReplacement.range.startLineNumber
        || minimizedReplacement.isEmpty // if the completion is empty after removing the common prefix of the completion and the model, the completion item would not be visible
    ) {
        return false;
    }
    // We might consider comparing by .toLowerText, but this requires GhostTextReplacement
    const originalValue = model.getValueInRange(minimizedReplacement.range, 1 /* EndOfLinePreference.LF */);
    const filterText = minimizedReplacement.text;
    const cursorPosIndex = Math.max(0, cursorPosition.column - minimizedReplacement.range.startColumn);
    let filterTextBefore = filterText.substring(0, cursorPosIndex);
    let filterTextAfter = filterText.substring(cursorPosIndex);
    let originalValueBefore = originalValue.substring(0, cursorPosIndex);
    let originalValueAfter = originalValue.substring(cursorPosIndex);
    const originalValueIndent = model.getLineIndentColumn(minimizedReplacement.range.startLineNumber);
    if (minimizedReplacement.range.startColumn <= originalValueIndent) {
        // Remove indentation
        originalValueBefore = originalValueBefore.trimStart();
        if (originalValueBefore.length === 0) {
            originalValueAfter = originalValueAfter.trimStart();
        }
        filterTextBefore = filterTextBefore.trimStart();
        if (filterTextBefore.length === 0) {
            filterTextAfter = filterTextAfter.trimStart();
        }
    }
    return filterTextBefore.startsWith(originalValueBefore)
        && !!matchesSubString(originalValueAfter, filterTextAfter);
}
export class InlineEditItem extends InlineSuggestionItemBase {
    static create(data, textModel) {
        const offsetEdit = getStringEdit(textModel, data.range, data.insertText); // TODO compute async
        const text = new TextModelText(textModel);
        const textEdit = TextEdit.fromStringEdit(offsetEdit, text);
        const singleTextEdit = offsetEdit.isEmpty() ? new TextReplacement(new Range(1, 1, 1, 1), '') : textEdit.toReplacement(text); // FIXME: .toReplacement() can throw because offsetEdit is empty because we get an empty diff in getStringEdit after diffing
        const identity = new InlineSuggestionIdentity();
        const edits = offsetEdit.replacements.map(edit => {
            const replacedRange = Range.fromPositions(textModel.getPositionAt(edit.replaceRange.start), textModel.getPositionAt(edit.replaceRange.endExclusive));
            const replacedText = textModel.getValueInRange(replacedRange);
            return SingleUpdatedNextEdit.create(edit, replacedText);
        });
        const hint = data.hint ? InlineSuggestHint.create(data.hint) : undefined;
        return new InlineEditItem(offsetEdit, singleTextEdit, data.uri, data, identity, edits, hint, false, textModel.getVersionId());
    }
    constructor(_edit, // TODO@hediet remove, compute & cache from _edits
    _textEdit, uri, data, identity, _edits, hint, _lastChangePartOfInlineEdit = false, _inlineEditModelVersion) {
        super(data, identity, hint);
        this._edit = _edit;
        this._textEdit = _textEdit;
        this.uri = uri;
        this._edits = _edits;
        this._lastChangePartOfInlineEdit = _lastChangePartOfInlineEdit;
        this._inlineEditModelVersion = _inlineEditModelVersion;
        this.snippetInfo = undefined;
        this.additionalTextEdits = [];
        this.isInlineEdit = true;
    }
    get updatedEditModelVersion() { return this._inlineEditModelVersion; }
    get updatedEdit() { return this._edit; }
    getSingleTextEdit() {
        return this._textEdit;
    }
    withIdentity(identity) {
        return new InlineEditItem(this._edit, this._textEdit, this.uri, this._data, identity, this._edits, this.hint, this._lastChangePartOfInlineEdit, this._inlineEditModelVersion);
    }
    canBeReused(model, position) {
        // TODO@hediet I believe this can be simplified to `return true;`, as applying an edit should kick out this suggestion.
        return this._lastChangePartOfInlineEdit && this.updatedEditModelVersion === model.getVersionId();
    }
    withEdit(textModelChanges, textModel) {
        const edit = this._applyTextModelChanges(textModelChanges, this._edits, textModel);
        return edit;
    }
    _applyTextModelChanges(textModelChanges, edits, textModel) {
        edits = edits.map(innerEdit => innerEdit.applyTextModelChanges(textModelChanges));
        if (edits.some(edit => edit.edit === undefined)) {
            return undefined; // change is invalid, so we will have to drop the completion
        }
        const newTextModelVersion = textModel.getVersionId();
        let inlineEditModelVersion = this._inlineEditModelVersion;
        const lastChangePartOfInlineEdit = edits.some(edit => edit.lastChangeUpdatedEdit);
        if (lastChangePartOfInlineEdit) {
            inlineEditModelVersion = newTextModelVersion ?? -1;
        }
        if (newTextModelVersion === null || inlineEditModelVersion + 20 < newTextModelVersion) {
            return undefined; // the completion has been ignored for a while, remove it
        }
        edits = edits.filter(innerEdit => !innerEdit.edit.isEmpty);
        if (edits.length === 0) {
            return undefined; // the completion has been typed by the user
        }
        const newEdit = new StringEdit(edits.map(edit => edit.edit));
        const positionOffsetTransformer = getPositionOffsetTransformerFromTextModel(textModel);
        const newTextEdit = positionOffsetTransformer.getTextEdit(newEdit).toReplacement(new TextModelText(textModel));
        let newDisplayLocation = this.hint;
        if (newDisplayLocation) {
            newDisplayLocation = newDisplayLocation.withEdit(textModelChanges, positionOffsetTransformer);
            if (!newDisplayLocation) {
                return undefined;
            }
        }
        return new InlineEditItem(newEdit, newTextEdit, this.uri, this._data, this.identity, edits, newDisplayLocation, lastChangePartOfInlineEdit, inlineEditModelVersion);
    }
}
function getStringEdit(textModel, editRange, replaceText) {
    const eol = textModel.getEOL();
    const editOriginalText = textModel.getValueInRange(editRange);
    const editReplaceText = replaceText.replace(/\r\n|\r|\n/g, eol);
    const diffAlgorithm = linesDiffComputers.getDefault();
    const lineDiffs = diffAlgorithm.computeDiff(splitLines(editOriginalText), splitLines(editReplaceText), {
        ignoreTrimWhitespace: false,
        computeMoves: false,
        extendToSubwords: true,
        maxComputationTimeMs: 500,
    });
    const innerChanges = lineDiffs.changes.flatMap(c => c.innerChanges ?? []);
    function addRangeToPos(pos, range) {
        const start = TextLength.fromPosition(range.getStartPosition());
        return TextLength.ofRange(range).createRange(start.addToPosition(pos));
    }
    const modifiedText = new StringText(editReplaceText);
    const offsetEdit = new StringEdit(innerChanges.map(c => {
        const rangeInModel = addRangeToPos(editRange.getStartPosition(), c.originalRange);
        const originalRange = getPositionOffsetTransformerFromTextModel(textModel).getOffsetRange(rangeInModel);
        const replaceText = modifiedText.getValueOfRange(c.modifiedRange);
        const edit = new StringReplacement(originalRange, replaceText);
        const originalText = textModel.getValueInRange(rangeInModel);
        return reshapeInlineEdit(edit, originalText, innerChanges.length, textModel);
    }));
    return offsetEdit;
}
class SingleUpdatedNextEdit {
    static create(edit, replacedText) {
        const prefixLength = commonPrefixLength(edit.newText, replacedText);
        const suffixLength = commonSuffixLength(edit.newText, replacedText);
        const trimmedNewText = edit.newText.substring(prefixLength, edit.newText.length - suffixLength);
        return new SingleUpdatedNextEdit(edit, trimmedNewText, prefixLength, suffixLength);
    }
    get edit() { return this._edit; }
    get lastChangeUpdatedEdit() { return this._lastChangeUpdatedEdit; }
    constructor(_edit, _trimmedNewText, _prefixLength, _suffixLength, _lastChangeUpdatedEdit = false) {
        this._edit = _edit;
        this._trimmedNewText = _trimmedNewText;
        this._prefixLength = _prefixLength;
        this._suffixLength = _suffixLength;
        this._lastChangeUpdatedEdit = _lastChangeUpdatedEdit;
    }
    applyTextModelChanges(textModelChanges) {
        const c = this._clone();
        c._applyTextModelChanges(textModelChanges);
        return c;
    }
    _clone() {
        return new SingleUpdatedNextEdit(this._edit, this._trimmedNewText, this._prefixLength, this._suffixLength, this._lastChangeUpdatedEdit);
    }
    _applyTextModelChanges(textModelChanges) {
        this._lastChangeUpdatedEdit = false; // TODO @benibenj make immutable
        if (!this._edit) {
            throw new BugIndicatingError('UpdatedInnerEdits: No edit to apply changes to');
        }
        const result = this._applyChanges(this._edit, textModelChanges);
        if (!result) {
            this._edit = undefined;
            return;
        }
        this._edit = result.edit;
        this._lastChangeUpdatedEdit = result.editHasChanged;
    }
    _applyChanges(edit, textModelChanges) {
        let editStart = edit.replaceRange.start;
        let editEnd = edit.replaceRange.endExclusive;
        let editReplaceText = edit.newText;
        let editHasChanged = false;
        const shouldPreserveEditShape = this._prefixLength > 0 || this._suffixLength > 0;
        for (let i = textModelChanges.replacements.length - 1; i >= 0; i--) {
            const change = textModelChanges.replacements[i];
            // INSERTIONS (only support inserting at start of edit)
            const isInsertion = change.newText.length > 0 && change.replaceRange.isEmpty;
            if (isInsertion && !shouldPreserveEditShape && change.replaceRange.start === editStart && editReplaceText.startsWith(change.newText)) {
                editStart += change.newText.length;
                editReplaceText = editReplaceText.substring(change.newText.length);
                editEnd = Math.max(editStart, editEnd);
                editHasChanged = true;
                continue;
            }
            if (isInsertion && shouldPreserveEditShape && change.replaceRange.start === editStart + this._prefixLength && this._trimmedNewText.startsWith(change.newText)) {
                editEnd += change.newText.length;
                editHasChanged = true;
                this._prefixLength += change.newText.length;
                this._trimmedNewText = this._trimmedNewText.substring(change.newText.length);
                continue;
            }
            // DELETIONS
            const isDeletion = change.newText.length === 0 && change.replaceRange.length > 0;
            if (isDeletion && change.replaceRange.start >= editStart + this._prefixLength && change.replaceRange.endExclusive <= editEnd - this._suffixLength) {
                // user deleted text IN-BETWEEN the deletion range
                editEnd -= change.replaceRange.length;
                editHasChanged = true;
                continue;
            }
            // user did exactly the edit
            if (change.equals(edit)) {
                editHasChanged = true;
                editStart = change.replaceRange.endExclusive;
                editReplaceText = '';
                continue;
            }
            // MOVE EDIT
            if (change.replaceRange.start > editEnd) {
                // the change happens after the completion range
                continue;
            }
            if (change.replaceRange.endExclusive < editStart) {
                // the change happens before the completion range
                editStart += change.newText.length - change.replaceRange.length;
                editEnd += change.newText.length - change.replaceRange.length;
                continue;
            }
            // The change intersects the completion, so we will have to drop the completion
            return undefined;
        }
        // the resulting edit is a noop as the original and new text are the same
        if (this._trimmedNewText.length === 0 && editStart + this._prefixLength === editEnd - this._suffixLength) {
            return { edit: new StringReplacement(new OffsetRange(editStart + this._prefixLength, editStart + this._prefixLength), ''), editHasChanged: true };
        }
        return { edit: new StringReplacement(new OffsetRange(editStart, editEnd), editReplaceText), editHasChanged };
    }
}
function reshapeInlineCompletion(edit, textModel) {
    // If the insertion is a multi line insertion starting on the next line
    // Move it forwards so that the multi line insertion starts on the current line
    const eol = textModel.getEOL();
    if (edit.replaceRange.isEmpty && edit.newText.includes(eol)) {
        edit = reshapeMultiLineInsertion(edit, textModel);
    }
    return edit;
}
function reshapeInlineEdit(edit, originalText, totalInnerEdits, textModel) {
    // TODO: EOL are not properly trimmed by the diffAlgorithm #12680
    const eol = textModel.getEOL();
    if (edit.newText.endsWith(eol) && originalText.endsWith(eol)) {
        edit = new StringReplacement(edit.replaceRange.deltaEnd(-eol.length), edit.newText.slice(0, -eol.length));
    }
    // INSERTION
    // If the insertion ends with a new line and is inserted at the start of a line which has text,
    // we move the insertion to the end of the previous line if possible
    if (totalInnerEdits === 1 && edit.replaceRange.isEmpty && edit.newText.includes(eol)) {
        const startPosition = textModel.getPositionAt(edit.replaceRange.start);
        const hasTextOnInsertionLine = textModel.getLineLength(startPosition.lineNumber) !== 0;
        if (hasTextOnInsertionLine) {
            edit = reshapeMultiLineInsertion(edit, textModel);
        }
    }
    // The diff algorithm extended a simple edit to the entire word
    // shrink it back to a simple edit if it is deletion/insertion only
    if (totalInnerEdits === 1) {
        const prefixLength = commonPrefixLength(originalText, edit.newText);
        const suffixLength = commonSuffixLength(originalText.slice(prefixLength), edit.newText.slice(prefixLength));
        // reshape it back to an insertion
        if (prefixLength + suffixLength === originalText.length) {
            return new StringReplacement(edit.replaceRange.deltaStart(prefixLength).deltaEnd(-suffixLength), edit.newText.substring(prefixLength, edit.newText.length - suffixLength));
        }
        // reshape it back to a deletion
        if (prefixLength + suffixLength === edit.newText.length) {
            return new StringReplacement(edit.replaceRange.deltaStart(prefixLength).deltaEnd(-suffixLength), '');
        }
    }
    return edit;
}
function reshapeMultiLineInsertion(edit, textModel) {
    if (!edit.replaceRange.isEmpty) {
        throw new BugIndicatingError('Unexpected original range');
    }
    if (edit.replaceRange.start === 0) {
        return edit;
    }
    const eol = textModel.getEOL();
    const startPosition = textModel.getPositionAt(edit.replaceRange.start);
    const startColumn = startPosition.column;
    const startLineNumber = startPosition.lineNumber;
    // If the insertion ends with a new line and is inserted at the start of a line which has text,
    // we move the insertion to the end of the previous line if possible
    if (startColumn === 1 && startLineNumber > 1 && edit.newText.endsWith(eol) && !edit.newText.startsWith(eol)) {
        return new StringReplacement(edit.replaceRange.delta(-1), eol + edit.newText.slice(0, -eol.length));
    }
    return edit;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lU3VnZ2VzdGlvbkl0ZW0uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvYnJvd3Nlci9tb2RlbC9pbmxpbmVTdWdnZXN0aW9uSXRlbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMxRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUN6RSxPQUFPLEVBQTZCLGdCQUFnQixFQUFFLGVBQWUsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3hILE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxrQkFBa0IsRUFBRSxVQUFVLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUkzRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDaEgsT0FBTyxFQUFFLFFBQVEsRUFBRSxlQUFlLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUV0RixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekQsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUMxRSxPQUFPLEVBQUUseUNBQXlDLEVBQUUsTUFBTSwyRUFBMkUsQ0FBQztBQUV0SSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDeEUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDbkYsT0FBTyxFQUF5RiwyQkFBMkIsRUFBb0UsTUFBTSxpQ0FBaUMsQ0FBQztBQUV2TyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMkNBQTJDLENB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