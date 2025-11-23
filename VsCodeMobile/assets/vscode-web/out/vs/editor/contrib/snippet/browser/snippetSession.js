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
var SnippetSession_1;
import { groupBy } from '../../../../base/common/arrays.js';
import { dispose } from '../../../../base/common/lifecycle.js';
import { getLeadingWhitespace } from '../../../../base/common/strings.js';
import './snippetSession.css';
import { EditOperation } from '../../../common/core/editOperation.js';
import { Range } from '../../../common/core/range.js';
import { Selection } from '../../../common/core/selection.js';
import { ILanguageConfigurationService } from '../../../common/languages/languageConfigurationRegistry.js';
import { ModelDecorationOptions } from '../../../common/model/textModel.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { Choice, Placeholder, SnippetParser, Text, TextmateSnippet } from './snippetParser.js';
import { ClipboardBasedVariableResolver, CommentBasedVariableResolver, CompositeSnippetVariableResolver, ModelBasedVariableResolver, RandomBasedVariableResolver, SelectionBasedVariableResolver, TimeBasedVariableResolver, WorkspaceBasedVariableResolver } from './snippetVariables.js';
import { EditSources } from '../../../common/textModelEditSource.js';
export class OneSnippet {
    static { this._decor = {
        active: ModelDecorationOptions.register({ description: 'snippet-placeholder-1', stickiness: 0 /* TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges */, className: 'snippet-placeholder' }),
        inactive: ModelDecorationOptions.register({ description: 'snippet-placeholder-2', stickiness: 1 /* TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges */, className: 'snippet-placeholder' }),
        activeFinal: ModelDecorationOptions.register({ description: 'snippet-placeholder-3', stickiness: 1 /* TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges */, className: 'finish-snippet-placeholder' }),
        inactiveFinal: ModelDecorationOptions.register({ description: 'snippet-placeholder-4', stickiness: 1 /* TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges */, className: 'finish-snippet-placeholder' }),
    }; }
    constructor(_editor, _snippet, _snippetLineLeadingWhitespace) {
        this._editor = _editor;
        this._snippet = _snippet;
        this._snippetLineLeadingWhitespace = _snippetLineLeadingWhitespace;
        this._offset = -1;
        this._nestingLevel = 1;
        this._placeholderGroups = groupBy(_snippet.placeholders, Placeholder.compareByIndex);
        this._placeholderGroupsIdx = -1;
    }
    initialize(textChange) {
        this._offset = textChange.newPosition;
    }
    dispose() {
        if (this._placeholderDecorations) {
            this._editor.removeDecorations([...this._placeholderDecorations.values()]);
        }
        this._placeholderGroups.length = 0;
    }
    _initDecorations() {
        if (this._offset === -1) {
            throw new Error(`Snippet not initialized!`);
        }
        if (this._placeholderDecorations) {
            // already initialized
            return;
        }
        this._placeholderDecorations = new Map();
        const model = this._editor.getModel();
        this._editor.changeDecorations(accessor => {
            // create a decoration for each placeholder
            for (const placeholder of this._snippet.placeholders) {
                const placeholderOffset = this._snippet.offset(placeholder);
                const placeholderLen = this._snippet.fullLen(placeholder);
                const range = Range.fromPositions(model.getPositionAt(this._offset + placeholderOffset), model.getPositionAt(this._offset + placeholderOffset + placeholderLen));
                const options = placeholder.isFinalTabstop ? OneSnippet._decor.inactiveFinal : OneSnippet._decor.inactive;
                const handle = accessor.addDecoration(range, options);
                this._placeholderDecorations.set(placeholder, handle);
            }
        });
    }
    move(fwd) {
        if (!this._editor.hasModel()) {
            return [];
        }
        this._initDecorations();
        // Transform placeholder text if necessary
        if (this._placeholderGroupsIdx >= 0) {
            const operations = [];
            for (const placeholder of this._placeholderGroups[this._placeholderGroupsIdx]) {
                // Check if the placeholder has a transformation
                if (placeholder.transform) {
                    const id = this._placeholderDecorations.get(placeholder);
                    const range = this._editor.getModel().getDecorationRange(id);
                    const currentValue = this._editor.getModel().getValueInRange(range);
                    const transformedValueLines = placeholder.transform.resolve(currentValue).split(/\r\n|\r|\n/);
                    // fix indentation for transformed lines
                    for (let i = 1; i < transformedValueLines.length; i++) {
                        transformedValueLines[i] = this._editor.getModel().normalizeIndentation(this._snippetLineLeadingWhitespace + transformedValueLines[i]);
                    }
                    operations.push(EditOperation.replace(range, transformedValueLines.join(this._editor.getModel().getEOL())));
                }
            }
            if (operations.length > 0) {
                this._editor.executeEdits('snippet.placeholderTransform', operations);
            }
        }
        let couldSkipThisPlaceholder = false;
        if (fwd === true && this._placeholderGroupsIdx < this._placeholderGroups.length - 1) {
            this._placeholderGroupsIdx += 1;
            couldSkipThisPlaceholder = true;
        }
        else if (fwd === false && this._placeholderGroupsIdx > 0) {
            this._placeholderGroupsIdx -= 1;
            couldSkipThisPlaceholder = true;
        }
        else {
            // the selection of the current placeholder might
            // not acurate any more -> simply restore it
        }
        const newSelections = this._editor.getModel().changeDecorations(accessor => {
            const activePlaceholders = new Set();
            // change stickiness to always grow when typing at its edges
            // because these decorations represent the currently active
            // tabstop.
            // Special case #1: reaching the final tabstop
            // Special case #2: placeholders enclosing active placeholders
            const selections = [];
            for (const placeholder of this._placeholderGroups[this._placeholderGroupsIdx]) {
                const id = this._placeholderDecorations.get(placeholder);
                const range = this._editor.getModel().getDecorationRange(id);
                selections.push(new Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn));
                // consider to skip this placeholder index when the decoration
                // range is empty but when the placeholder wasn't. that's a strong
                // hint that the placeholder has been deleted. (all placeholder must match this)
                couldSkipThisPlaceholder = couldSkipThisPlaceholder && this._hasPlaceholderBeenCollapsed(placeholder);
                accessor.changeDecorationOptions(id, placeholder.isFinalTabstop ? OneSnippet._decor.activeFinal : OneSnippet._decor.active);
                activePlaceholders.add(placeholder);
                for (const enclosingPlaceholder of this._snippet.enclosingPlaceholders(placeholder)) {
                    const id = this._placeholderDecorations.get(enclosingPlaceholder);
                    accessor.changeDecorationOptions(id, enclosingPlaceholder.isFinalTabstop ? OneSnippet._decor.activeFinal : OneSnippet._decor.active);
                    activePlaceholders.add(enclosingPlaceholder);
                }
            }
            // change stickness to never grow when typing at its edges
            // so that in-active tabstops never grow
            for (const [placeholder, id] of this._placeholderDecorations) {
                if (!activePlaceholders.has(placeholder)) {
                    accessor.changeDecorationOptions(id, placeholder.isFinalTabstop ? OneSnippet._decor.inactiveFinal : OneSnippet._decor.inactive);
                }
            }
            return selections;
        });
        return !couldSkipThisPlaceholder ? newSelections ?? [] : this.move(fwd);
    }
    _hasPlaceholderBeenCollapsed(placeholder) {
        // A placeholder is empty when it wasn't empty when authored but
        // when its tracking decoration is empty. This also applies to all
        // potential parent placeholders
        let marker = placeholder;
        while (marker) {
            if (marker instanceof Placeholder) {
                const id = this._placeholderDecorations.get(marker);
                const range = this._editor.getModel().getDecorationRange(id);
                if (range.isEmpty() && marker.toString().length > 0) {
                    return true;
                }
            }
            marker = marker.parent;
        }
        return false;
    }
    get isAtFirstPlaceholder() {
        return this._placeholderGroupsIdx <= 0 || this._placeholderGroups.length === 0;
    }
    get isAtLastPlaceholder() {
        return this._placeholderGroupsIdx === this._placeholderGroups.length - 1;
    }
    get hasPlaceholder() {
        return this._snippet.placeholders.length > 0;
    }
    /**
     * A snippet is trivial when it has no placeholder or only a final placeholder at
     * its very end
     */
    get isTrivialSnippet() {
        if (this._snippet.placeholders.length === 0) {
            return true;
        }
        if (this._snippet.placeholders.length === 1) {
            const [placeholder] = this._snippet.placeholders;
            if (placeholder.isFinalTabstop) {
                if (this._snippet.rightMostDescendant === placeholder) {
                    return true;
                }
            }
        }
        return false;
    }
    computePossibleSelections() {
        const result = new Map();
        for (const placeholdersWithEqualIndex of this._placeholderGroups) {
            let ranges;
            for (const placeholder of placeholdersWithEqualIndex) {
                if (placeholder.isFinalTabstop) {
                    // ignore those
                    break;
                }
                if (!ranges) {
                    ranges = [];
                    result.set(placeholder.index, ranges);
                }
                const id = this._placeholderDecorations.get(placeholder);
                const range = this._editor.getModel().getDecorationRange(id);
                if (!range) {
                    // one of the placeholder lost its decoration and
                    // therefore we bail out and pretend the placeholder
                    // (with its mirrors) doesn't exist anymore.
                    result.delete(placeholder.index);
                    break;
                }
                ranges.push(range);
            }
        }
        return result;
    }
    get activeChoice() {
        if (!this._placeholderDecorations) {
            return undefined;
        }
        const placeholder = this._placeholderGroups[this._placeholderGroupsIdx][0];
        if (!placeholder?.choice) {
            return undefined;
        }
        const id = this._placeholderDecorations.get(placeholder);
        if (!id) {
            return undefined;
        }
        const range = this._editor.getModel().getDecorationRange(id);
        if (!range) {
            return undefined;
        }
        return { range, choice: placeholder.choice };
    }
    get hasChoice() {
        let result = false;
        this._snippet.walk(marker => {
            result = marker instanceof Choice;
            return !result;
        });
        return result;
    }
    merge(others) {
        const model = this._editor.getModel();
        this._nestingLevel *= 10;
        this._editor.changeDecorations(accessor => {
            // For each active placeholder take one snippet and merge it
            // in that the placeholder (can be many for `$1foo$1foo`). Because
            // everything is sorted by editor selection we can simply remove
            // elements from the beginning of the array
            for (const placeholder of this._placeholderGroups[this._placeholderGroupsIdx]) {
                const nested = others.shift();
                console.assert(nested._offset !== -1);
                console.assert(!nested._placeholderDecorations);
                // Massage placeholder-indicies of the nested snippet to be
                // sorted right after the insertion point. This ensures we move
                // through the placeholders in the correct order
                const indexLastPlaceholder = nested._snippet.placeholderInfo.last.index;
                for (const nestedPlaceholder of nested._snippet.placeholderInfo.all) {
                    if (nestedPlaceholder.isFinalTabstop) {
                        nestedPlaceholder.index = placeholder.index + ((indexLastPlaceholder + 1) / this._nestingLevel);
                    }
                    else {
                        nestedPlaceholder.index = placeholder.index + (nestedPlaceholder.index / this._nestingLevel);
                    }
                }
                this._snippet.replace(placeholder, nested._snippet.children);
                // Remove the placeholder at which position are inserting
                // the snippet and also remove its decoration.
                const id = this._placeholderDecorations.get(placeholder);
                accessor.removeDecoration(id);
                this._placeholderDecorations.delete(placeholder);
                // For each *new* placeholder we create decoration to monitor
                // how and if it grows/shrinks.
                for (const placeholder of nested._snippet.placeholders) {
                    const placeholderOffset = nested._snippet.offset(placeholder);
                    const placeholderLen = nested._snippet.fullLen(placeholder);
                    const range = Range.fromPositions(model.getPositionAt(nested._offset + placeholderOffset), model.getPositionAt(nested._offset + placeholderOffset + placeholderLen));
                    const handle = accessor.addDecoration(range, OneSnippet._decor.inactive);
                    this._placeholderDecorations.set(placeholder, handle);
                }
            }
            // Last, re-create the placeholder groups by sorting placeholders by their index.
            this._placeholderGroups = groupBy(this._snippet.placeholders, Placeholder.compareByIndex);
        });
    }
    getEnclosingRange() {
        let result;
        const model = this._editor.getModel();
        for (const decorationId of this._placeholderDecorations.values()) {
            const placeholderRange = model.getDecorationRange(decorationId) ?? undefined;
            if (!result) {
                result = placeholderRange;
            }
            else {
                result = result.plusRange(placeholderRange);
            }
        }
        return result;
    }
}
const _defaultOptions = {
    overwriteBefore: 0,
    overwriteAfter: 0,
    adjustWhitespace: true,
    clipboardText: undefined,
    overtypingCapturer: undefined
};
let SnippetSession = SnippetSession_1 = class SnippetSession {
    static adjustWhitespace(model, position, adjustIndentation, snippet, filter) {
        const line = model.getLineContent(position.lineNumber);
        const lineLeadingWhitespace = getLeadingWhitespace(line, 0, position.column - 1);
        // the snippet as inserted
        let snippetTextString;
        snippet.walk(marker => {
            // all text elements that are not inside choice
            if (!(marker instanceof Text) || marker.parent instanceof Choice) {
                return true;
            }
            // check with filter (iff provided)
            if (filter && !filter.has(marker)) {
                return true;
            }
            const lines = marker.value.split(/\r\n|\r|\n/);
            if (adjustIndentation) {
                // adjust indentation of snippet test
                // -the snippet-start doesn't get extra-indented (lineLeadingWhitespace), only normalized
                // -all N+1 lines get extra-indented and normalized
                // -the text start get extra-indented and normalized when following a linebreak
                const offset = snippet.offset(marker);
                if (offset === 0) {
                    // snippet start
                    lines[0] = model.normalizeIndentation(lines[0]);
                }
                else {
                    // check if text start is after a linebreak
                    snippetTextString = snippetTextString ?? snippet.toString();
                    const prevChar = snippetTextString.charCodeAt(offset - 1);
                    if (prevChar === 10 /* CharCode.LineFeed */ || prevChar === 13 /* CharCode.CarriageReturn */) {
                        lines[0] = model.normalizeIndentation(lineLeadingWhitespace + lines[0]);
                    }
                }
                for (let i = 1; i < lines.length; i++) {
                    lines[i] = model.normalizeIndentation(lineLeadingWhitespace + lines[i]);
                }
            }
            const newValue = lines.join(model.getEOL());
            if (newValue !== marker.value) {
                marker.parent.replace(marker, [new Text(newValue)]);
                snippetTextString = undefined;
            }
            return true;
        });
        return lineLeadingWhitespace;
    }
    static adjustSelection(model, selection, overwriteBefore, overwriteAfter) {
        if (overwriteBefore !== 0 || overwriteAfter !== 0) {
            // overwrite[Before|After] is compute using the position, not the whole
            // selection. therefore we adjust the selection around that position
            const { positionLineNumber, positionColumn } = selection;
            const positionColumnBefore = positionColumn - overwriteBefore;
            const positionColumnAfter = positionColumn + overwriteAfter;
            const range = model.validateRange({
                startLineNumber: positionLineNumber,
                startColumn: positionColumnBefore,
                endLineNumber: positionLineNumber,
                endColumn: positionColumnAfter
            });
            selection = Selection.createWithDirection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn, selection.getDirection());
        }
        return selection;
    }
    static createEditsAndSnippetsFromSelections(editor, template, overwriteBefore, overwriteAfter, enforceFinalTabstop, adjustWhitespace, clipboardText, overtypingCapturer, languageConfigurationService) {
        const edits = [];
        const snippets = [];
        if (!editor.hasModel()) {
            return { edits, snippets };
        }
        const model = editor.getModel();
        const workspaceService = editor.invokeWithinContext(accessor => accessor.get(IWorkspaceContextService));
        const modelBasedVariableResolver = editor.invokeWithinContext(accessor => new ModelBasedVariableResolver(accessor.get(ILabelService), model));
        const readClipboardText = () => clipboardText;
        // know what text the overwrite[Before|After] extensions
        // of the primary cursor have selected because only when
        // secondary selections extend to the same text we can grow them
        const firstBeforeText = model.getValueInRange(SnippetSession_1.adjustSelection(model, editor.getSelection(), overwriteBefore, 0));
        const firstAfterText = model.getValueInRange(SnippetSession_1.adjustSelection(model, editor.getSelection(), 0, overwriteAfter));
        // remember the first non-whitespace column to decide if
        // `keepWhitespace` should be overruled for secondary selections
        const firstLineFirstNonWhitespace = model.getLineFirstNonWhitespaceColumn(editor.getSelection().positionLineNumber);
        // sort selections by their start position but remeber
        // the original index. that allows you to create correct
        // offset-based selection logic without changing the
        // primary selection
        const indexedSelections = editor.getSelections()
            .map((selection, idx) => ({ selection, idx }))
            .sort((a, b) => Range.compareRangesUsingStarts(a.selection, b.selection));
        for (const { selection, idx } of indexedSelections) {
            // extend selection with the `overwriteBefore` and `overwriteAfter` and then
            // compare if this matches the extensions of the primary selection
            let extensionBefore = SnippetSession_1.adjustSelection(model, selection, overwriteBefore, 0);
            let extensionAfter = SnippetSession_1.adjustSelection(model, selection, 0, overwriteAfter);
            if (firstBeforeText !== model.getValueInRange(extensionBefore)) {
                extensionBefore = selection;
            }
            if (firstAfterText !== model.getValueInRange(extensionAfter)) {
                extensionAfter = selection;
            }
            // merge the before and after selection into one
            const snippetSelection = selection
                .setStartPosition(extensionBefore.startLineNumber, extensionBefore.startColumn)
                .setEndPosition(extensionAfter.endLineNumber, extensionAfter.endColumn);
            const snippet = new SnippetParser().parse(template, true, enforceFinalTabstop);
            // adjust the template string to match the indentation and
            // whitespace rules of this insert location (can be different for each cursor)
            // happens when being asked for (default) or when this is a secondary
            // cursor and the leading whitespace is different
            const start = snippetSelection.getStartPosition();
            const snippetLineLeadingWhitespace = SnippetSession_1.adjustWhitespace(model, start, adjustWhitespace || (idx > 0 && firstLineFirstNonWhitespace !== model.getLineFirstNonWhitespaceColumn(selection.positionLineNumber)), snippet);
            snippet.resolveVariables(new CompositeSnippetVariableResolver([
                modelBasedVariableResolver,
                new ClipboardBasedVariableResolver(readClipboardText, idx, indexedSelections.length, editor.getOption(88 /* EditorOption.multiCursorPaste */) === 'spread'),
                new SelectionBasedVariableResolver(model, selection, idx, overtypingCapturer),
                new CommentBasedVariableResolver(model, selection, languageConfigurationService),
                new TimeBasedVariableResolver,
                new WorkspaceBasedVariableResolver(workspaceService),
                new RandomBasedVariableResolver,
            ]));
            // store snippets with the index of their originating selection.
            // that ensures the primary cursor stays primary despite not being
            // the one with lowest start position
            edits[idx] = EditOperation.replace(snippetSelection, snippet.toString());
            edits[idx].identifier = { major: idx, minor: 0 }; // mark the edit so only our undo edits will be used to generate end cursors
            edits[idx]._isTracked = true;
            snippets[idx] = new OneSnippet(editor, snippet, snippetLineLeadingWhitespace);
        }
        return { edits, snippets };
    }
    static createEditsAndSnippetsFromEdits(editor, snippetEdits, enforceFinalTabstop, adjustWhitespace, clipboardText, overtypingCapturer, languageConfigurationService) {
        if (!editor.hasModel() || snippetEdits.length === 0) {
            return { edits: [], snippets: [] };
        }
        const edits = [];
        const model = editor.getModel();
        const parser = new SnippetParser();
        const snippet = new TextmateSnippet();
        // snippet variables resolver
        const resolver = new CompositeSnippetVariableResolver([
            editor.invokeWithinContext(accessor => new ModelBasedVariableResolver(accessor.get(ILabelService), model)),
            new ClipboardBasedVariableResolver(() => clipboardText, 0, editor.getSelections().length, editor.getOption(88 /* EditorOption.multiCursorPaste */) === 'spread'),
            new SelectionBasedVariableResolver(model, editor.getSelection(), 0, overtypingCapturer),
            new CommentBasedVariableResolver(model, editor.getSelection(), languageConfigurationService),
            new TimeBasedVariableResolver,
            new WorkspaceBasedVariableResolver(editor.invokeWithinContext(accessor => accessor.get(IWorkspaceContextService))),
            new RandomBasedVariableResolver,
        ]);
        //
        snippetEdits = snippetEdits.sort((a, b) => Range.compareRangesUsingStarts(a.range, b.range));
        let offset = 0;
        for (let i = 0; i < snippetEdits.length; i++) {
            const { range, template, keepWhitespace } = snippetEdits[i];
            // gaps between snippet edits are appended as text nodes. this
            // ensures placeholder-offsets are later correct
            if (i > 0) {
                const lastRange = snippetEdits[i - 1].range;
                const textRange = Range.fromPositions(lastRange.getEndPosition(), range.getStartPosition());
                const textNode = new Text(model.getValueInRange(textRange));
                snippet.appendChild(textNode);
                offset += textNode.value.length;
            }
            const newNodes = parser.parseFragment(template, snippet);
            SnippetSession_1.adjustWhitespace(model, range.getStartPosition(), keepWhitespace !== undefined ? !keepWhitespace : adjustWhitespace, snippet, new Set(newNodes));
            snippet.resolveVariables(resolver);
            const snippetText = snippet.toString();
            const snippetFragmentText = snippetText.slice(offset);
            offset = snippetText.length;
            // make edit
            const edit = EditOperation.replace(range, snippetFragmentText);
            edit.identifier = { major: i, minor: 0 }; // mark the edit so only our undo edits will be used to generate end cursors
            edit._isTracked = true;
            edits.push(edit);
        }
        //
        parser.ensureFinalTabstop(snippet, enforceFinalTabstop, true);
        return {
            edits,
            snippets: [new OneSnippet(editor, snippet, '')]
        };
    }
    constructor(_editor, _template, _options = _defaultOptions, _languageConfigurationService) {
        this._editor = _editor;
        this._template = _template;
        this._options = _options;
        this._languageConfigurationService = _languageConfigurationService;
        this._templateMerges = [];
        this._snippets = [];
    }
    dispose() {
        dispose(this._snippets);
    }
    _logInfo() {
        return `template="${this._template}", merged_templates="${this._templateMerges.join(' -> ')}"`;
    }
    insert(editReason) {
        if (!this._editor.hasModel()) {
            return;
        }
        // make insert edit and start with first selections
        const { edits, snippets } = typeof this._template === 'string'
            ? SnippetSession_1.createEditsAndSnippetsFromSelections(this._editor, this._template, this._options.overwriteBefore, this._options.overwriteAfter, false, this._options.adjustWhitespace, this._options.clipboardText, this._options.overtypingCapturer, this._languageConfigurationService)
            : SnippetSession_1.createEditsAndSnippetsFromEdits(this._editor, this._template, false, this._options.adjustWhitespace, this._options.clipboardText, this._options.overtypingCapturer, this._languageConfigurationService);
        this._snippets = snippets;
        this._editor.executeEdits(editReason ?? EditSources.snippet(), edits, _undoEdits => {
            // Sometimes, the text buffer will remove automatic whitespace when doing any edits,
            // so we need to look only at the undo edits relevant for us.
            // Our edits have an identifier set so that's how we can distinguish them
            const undoEdits = _undoEdits.filter(edit => !!edit.identifier);
            for (let idx = 0; idx < snippets.length; idx++) {
                snippets[idx].initialize(undoEdits[idx].textChange);
            }
            if (this._snippets[0].hasPlaceholder) {
                return this._move(true);
            }
            else {
                return undoEdits
                    .map(edit => Selection.fromPositions(edit.range.getEndPosition()));
            }
        });
        this._editor.revealRange(this._editor.getSelections()[0]);
    }
    merge(template, options = _defaultOptions) {
        if (!this._editor.hasModel()) {
            return;
        }
        this._templateMerges.push([this._snippets[0]._nestingLevel, this._snippets[0]._placeholderGroupsIdx, template]);
        const { edits, snippets } = SnippetSession_1.createEditsAndSnippetsFromSelections(this._editor, template, options.overwriteBefore, options.overwriteAfter, true, options.adjustWhitespace, options.clipboardText, options.overtypingCapturer, this._languageConfigurationService);
        this._editor.executeEdits('snippet', edits, _undoEdits => {
            // Sometimes, the text buffer will remove automatic whitespace when doing any edits,
            // so we need to look only at the undo edits relevant for us.
            // Our edits have an identifier set so that's how we can distinguish them
            const undoEdits = _undoEdits.filter(edit => !!edit.identifier);
            for (let idx = 0; idx < snippets.length; idx++) {
                snippets[idx].initialize(undoEdits[idx].textChange);
            }
            // Trivial snippets have no placeholder or are just the final placeholder. That means they
            // are just text insertions and we don't need to merge the nested snippet into the existing
            // snippet
            const isTrivialSnippet = snippets[0].isTrivialSnippet;
            if (!isTrivialSnippet) {
                for (const snippet of this._snippets) {
                    snippet.merge(snippets);
                }
                console.assert(snippets.length === 0);
            }
            if (this._snippets[0].hasPlaceholder && !isTrivialSnippet) {
                return this._move(undefined);
            }
            else {
                return undoEdits.map(edit => Selection.fromPositions(edit.range.getEndPosition()));
            }
        });
    }
    next() {
        const newSelections = this._move(true);
        this._editor.setSelections(newSelections);
        this._editor.revealPositionInCenterIfOutsideViewport(newSelections[0].getPosition());
    }
    prev() {
        const newSelections = this._move(false);
        this._editor.setSelections(newSelections);
        this._editor.revealPositionInCenterIfOutsideViewport(newSelections[0].getPosition());
    }
    _move(fwd) {
        const selections = [];
        for (const snippet of this._snippets) {
            const oneSelection = snippet.move(fwd);
            selections.push(...oneSelection);
        }
        return selections;
    }
    get isAtFirstPlaceholder() {
        return this._snippets[0].isAtFirstPlaceholder;
    }
    get isAtLastPlaceholder() {
        return this._snippets[0].isAtLastPlaceholder;
    }
    get hasPlaceholder() {
        return this._snippets[0].hasPlaceholder;
    }
    get hasChoice() {
        return this._snippets[0].hasChoice;
    }
    get activeChoice() {
        return this._snippets[0].activeChoice;
    }
    isSelectionWithinPlaceholders() {
        if (!this.hasPlaceholder) {
            return false;
        }
        const selections = this._editor.getSelections();
        if (selections.length < this._snippets.length) {
            // this means we started snippet mode with N
            // selections and have M (N > M) selections.
            // So one snippet is without selection -> cancel
            return false;
        }
        const allPossibleSelections = new Map();
        for (const snippet of this._snippets) {
            const possibleSelections = snippet.computePossibleSelections();
            // for the first snippet find the placeholder (and its ranges)
            // that contain at least one selection. for all remaining snippets
            // the same placeholder (and their ranges) must be used.
            if (allPossibleSelections.size === 0) {
                for (const [index, ranges] of possibleSelections) {
                    ranges.sort(Range.compareRangesUsingStarts);
                    for (const selection of selections) {
                        if (ranges[0].containsRange(selection)) {
                            allPossibleSelections.set(index, []);
                            break;
                        }
                    }
                }
            }
            if (allPossibleSelections.size === 0) {
                // return false if we couldn't associate a selection to
                // this (the first) snippet
                return false;
            }
            // add selections from 'this' snippet so that we know all
            // selections for this placeholder
            allPossibleSelections.forEach((array, index) => {
                array.push(...possibleSelections.get(index));
            });
        }
        // sort selections (and later placeholder-ranges). then walk both
        // arrays and make sure the placeholder-ranges contain the corresponding
        // selection
        selections.sort(Range.compareRangesUsingStarts);
        for (const [index, ranges] of allPossibleSelections) {
            if (ranges.length !== selections.length) {
                allPossibleSelections.delete(index);
                continue;
            }
            ranges.sort(Range.compareRangesUsingStarts);
            for (let i = 0; i < ranges.length; i++) {
                if (!ranges[i].containsRange(selections[i])) {
                    allPossibleSelections.delete(index);
                    continue;
                }
            }
        }
        // from all possible selections we have deleted those
        // that don't match with the current selection. if we don't
        // have any left, we don't have a selection anymore
        return allPossibleSelections.size > 0;
    }
    getEnclosingRange() {
        let result;
        for (const snippet of this._snippets) {
            const snippetRange = snippet.getEnclosingRange();
            if (!result) {
                result = snippetRange;
            }
            else {
                result = result.plusRange(snippetRange);
            }
        }
        return result;
    }
};
SnippetSession = SnippetSession_1 = __decorate([
    __param(3, ILanguageConfigurationService)
], SnippetSession);
export { SnippetSession };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic25pcHBldFNlc3Npb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvc25pcHBldC9icm93c2VyL3NuaXBwZXRTZXNzaW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFNUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzFFLE9BQU8sc0JBQXNCLENBQUM7QUFHOUIsT0FBTyxFQUFFLGFBQWEsRUFBd0IsTUFBTSx1Q0FBdUMsQ0FBQztBQUU1RixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDdEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRTlELE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRTNHLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBRTVFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUM5RixPQUFPLEVBQUUsTUFBTSxFQUFVLFdBQVcsRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3ZHLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSw0QkFBNEIsRUFBRSxnQ0FBZ0MsRUFBRSwwQkFBMEIsRUFBRSwyQkFBMkIsRUFBRSw4QkFBOEIsRUFBRSx5QkFBeUIsRUFBRSw4QkFBOEIsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzNSLE9BQU8sRUFBRSxXQUFXLEVBQXVCLE1BQU0sd0NBQXdDLENBQUM7QUFFMUYsTUFBTSxPQUFPLFVBQVU7YUFRRSxXQUFNLEdBQUc7UUFDaEMsTUFBTSxFQUFFLHNCQUFzQixDQUFDLFFBQVEsQ0FBQyxFQUFFLFdBQVcsRUFBRSx1QkFBdUIsRUFBRSxVQUFVLDZEQUFxRCxFQUFFLFNBQVMsRUFBRSxxQkFBcUIsRUFBRSxDQUFDO1FBQ3BMLFFBQVEsRUFBRSxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsRUFBRSxXQUFXLEVBQUUsdUJBQXVCLEVBQUUsVUFBVSw0REFBb0QsRUFBRSxTQUFTLEVBQUUscUJBQXFCLEVBQUUsQ0FBQztRQUNyTCxXQUFXLEVBQUUsc0JBQXNCLENBQUMsUUFBUSxDQUFDLEVBQUUsV0FBVyxFQUFFLHVCQUF1QixFQUFFLFVBQVUsNERBQW9ELEVBQUUsU0FBUyxFQUFFLDRCQUE0QixFQUFFLENBQUM7UUFDL0wsYUFBYSxFQUFFLHNCQUFzQixDQUFDLFFBQVEsQ0FBQyxFQUFFLFdBQVcsRUFBRSx1QkFBdUIsRUFBRSxVQUFVLDREQUFvRCxFQUFFLFNBQVMsRUFBRSw0QkFBNEIsRUFBRSxDQUFDO0tBQ2pNLEFBTDZCLENBSzVCO0lBRUYsWUFDa0IsT0FBMEIsRUFDMUIsUUFBeUIsRUFDekIsNkJBQXFDO1FBRnJDLFlBQU8sR0FBUCxPQUFPLENBQW1CO1FBQzFCLGFBQVEsR0FBUixRQUFRLENBQWlCO1FBQ3pCLGtDQUE2QixHQUE3Qiw2QkFBNkIsQ0FBUTtRQWQvQyxZQUFPLEdBQVcsQ0FBQyxDQUFDLENBQUM7UUFFN0Isa0JBQWEsR0FBVyxDQUFDLENBQUM7UUFjekIsSUFBSSxDQUFDLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFLFdBQVcsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNyRixJQUFJLENBQUMscUJBQXFCLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUVELFVBQVUsQ0FBQyxVQUFzQjtRQUNoQyxJQUFJLENBQUMsT0FBTyxHQUFHLFVBQVUsQ0FBQyxXQUFXLENBQUM7SUFDdkMsQ0FBQztJQUVELE9BQU87UUFDTixJQUFJLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUUsQ0FBQztRQUNELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFTyxnQkFBZ0I7UUFFdkIsSUFBSSxJQUFJLENBQUMsT0FBTyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDekIsTUFBTSxJQUFJLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO1FBQzdDLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQ2xDLHNCQUFzQjtZQUN0QixPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLEdBQUcsRUFBdUIsQ0FBQztRQUM5RCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBRXRDLElBQUksQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDekMsMkNBQTJDO1lBQzNDLEtBQUssTUFBTSxXQUFXLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFDdEQsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDNUQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQzFELE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxhQUFhLENBQ2hDLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxpQkFBaUIsQ0FBQyxFQUNyRCxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxPQUFPLEdBQUcsaUJBQWlCLEdBQUcsY0FBYyxDQUFDLENBQ3RFLENBQUM7Z0JBQ0YsTUFBTSxPQUFPLEdBQUcsV0FBVyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO2dCQUMxRyxNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDdEQsSUFBSSxDQUFDLHVCQUF3QixDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDeEQsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELElBQUksQ0FBQyxHQUF3QjtRQUM1QixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDO1lBQzlCLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztRQUVELElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBRXhCLDBDQUEwQztRQUMxQyxJQUFJLElBQUksQ0FBQyxxQkFBcUIsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUNyQyxNQUFNLFVBQVUsR0FBMkIsRUFBRSxDQUFDO1lBRTlDLEtBQUssTUFBTSxXQUFXLElBQUksSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFLENBQUM7Z0JBQy9FLGdEQUFnRDtnQkFDaEQsSUFBSSxXQUFXLENBQUMsU0FBUyxFQUFFLENBQUM7b0JBQzNCLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyx1QkFBd0IsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFFLENBQUM7b0JBQzNELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUFFLENBQUM7b0JBQzlELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUNwRSxNQUFNLHFCQUFxQixHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztvQkFDOUYsd0NBQXdDO29CQUN4QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcscUJBQXFCLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7d0JBQ3ZELHFCQUFxQixDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLDZCQUE2QixHQUFHLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3hJLENBQUM7b0JBQ0QsVUFBVSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDN0csQ0FBQztZQUNGLENBQUM7WUFDRCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQzNCLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLDhCQUE4QixFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQ3ZFLENBQUM7UUFDRixDQUFDO1FBRUQsSUFBSSx3QkFBd0IsR0FBRyxLQUFLLENBQUM7UUFDckMsSUFBSSxHQUFHLEtBQUssSUFBSSxJQUFJLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3JGLElBQUksQ0FBQyxxQkFBcUIsSUFBSSxDQUFDLENBQUM7WUFDaEMsd0JBQXdCLEdBQUcsSUFBSSxDQUFDO1FBRWpDLENBQUM7YUFBTSxJQUFJLEdBQUcsS0FBSyxLQUFLLElBQUksSUFBSSxDQUFDLHFCQUFxQixHQUFHLENBQUMsRUFBRSxDQUFDO1lBQzVELElBQUksQ0FBQyxxQkFBcUIsSUFBSSxDQUFDLENBQUM7WUFDaEMsd0JBQXdCLEdBQUcsSUFBSSxDQUFDO1FBRWpDLENBQUM7YUFBTSxDQUFDO1lBQ1AsaURBQWlEO1lBQ2pELDRDQUE0QztRQUM3QyxDQUFDO1FBRUQsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUUxRSxNQUFNLGtCQUFrQixHQUFHLElBQUksR0FBRyxFQUFlLENBQUM7WUFFbEQsNERBQTREO1lBQzVELDJEQUEyRDtZQUMzRCxXQUFXO1lBQ1gsOENBQThDO1lBQzlDLDhEQUE4RDtZQUM5RCxNQUFNLFVBQVUsR0FBZ0IsRUFBRSxDQUFDO1lBQ25DLEtBQUssTUFBTSxXQUFXLElBQUksSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFLENBQUM7Z0JBQy9FLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyx1QkFBd0IsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFFLENBQUM7Z0JBQzNELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUFFLENBQUM7Z0JBQzlELFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLGVBQWUsRUFBRSxLQUFLLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBRS9HLDhEQUE4RDtnQkFDOUQsa0VBQWtFO2dCQUNsRSxnRkFBZ0Y7Z0JBQ2hGLHdCQUF3QixHQUFHLHdCQUF3QixJQUFJLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFFdEcsUUFBUSxDQUFDLHVCQUF1QixDQUFDLEVBQUUsRUFBRSxXQUFXLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDNUgsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUVwQyxLQUFLLE1BQU0sb0JBQW9CLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO29CQUNyRixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsdUJBQXdCLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFFLENBQUM7b0JBQ3BFLFFBQVEsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLEVBQUUsb0JBQW9CLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDckksa0JBQWtCLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLENBQUM7Z0JBQzlDLENBQUM7WUFDRixDQUFDO1lBRUQsMERBQTBEO1lBQzFELHdDQUF3QztZQUN4QyxLQUFLLE1BQU0sQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLHVCQUF3QixFQUFFLENBQUM7Z0JBQy9ELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQztvQkFDMUMsUUFBUSxDQUFDLHVCQUF1QixDQUFDLEVBQUUsRUFBRSxXQUFXLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDakksQ0FBQztZQUNGLENBQUM7WUFFRCxPQUFPLFVBQVUsQ0FBQztRQUNuQixDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsYUFBYSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBRU8sNEJBQTRCLENBQUMsV0FBd0I7UUFDNUQsZ0VBQWdFO1FBQ2hFLGtFQUFrRTtRQUNsRSxnQ0FBZ0M7UUFDaEMsSUFBSSxNQUFNLEdBQXVCLFdBQVcsQ0FBQztRQUM3QyxPQUFPLE1BQU0sRUFBRSxDQUFDO1lBQ2YsSUFBSSxNQUFNLFlBQVksV0FBVyxFQUFFLENBQUM7Z0JBQ25DLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyx1QkFBd0IsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFFLENBQUM7Z0JBQ3RELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUFFLENBQUM7Z0JBQzlELElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxJQUFJLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQ3JELE9BQU8sSUFBSSxDQUFDO2dCQUNiLENBQUM7WUFDRixDQUFDO1lBQ0QsTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDeEIsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVELElBQUksb0JBQW9CO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDLHFCQUFxQixJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQztJQUNoRixDQUFDO0lBRUQsSUFBSSxtQkFBbUI7UUFDdEIsT0FBTyxJQUFJLENBQUMscUJBQXFCLEtBQUssSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDMUUsQ0FBQztJQUVELElBQUksY0FBYztRQUNqQixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQUVEOzs7T0FHRztJQUNILElBQUksZ0JBQWdCO1FBQ25CLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzdDLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzdDLE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQztZQUNqRCxJQUFJLFdBQVcsQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFDaEMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLG1CQUFtQixLQUFLLFdBQVcsRUFBRSxDQUFDO29CQUN2RCxPQUFPLElBQUksQ0FBQztnQkFDYixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFRCx5QkFBeUI7UUFDeEIsTUFBTSxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQW1CLENBQUM7UUFDMUMsS0FBSyxNQUFNLDBCQUEwQixJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQ2xFLElBQUksTUFBMkIsQ0FBQztZQUVoQyxLQUFLLE1BQU0sV0FBVyxJQUFJLDBCQUEwQixFQUFFLENBQUM7Z0JBQ3RELElBQUksV0FBVyxDQUFDLGNBQWMsRUFBRSxDQUFDO29CQUNoQyxlQUFlO29CQUNmLE1BQU07Z0JBQ1AsQ0FBQztnQkFFRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQ2IsTUFBTSxHQUFHLEVBQUUsQ0FBQztvQkFDWixNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBQ3ZDLENBQUM7Z0JBRUQsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLHVCQUF3QixDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUUsQ0FBQztnQkFDM0QsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDN0QsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUNaLGlEQUFpRDtvQkFDakQsb0RBQW9EO29CQUNwRCw0Q0FBNEM7b0JBQzVDLE1BQU0sQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUNqQyxNQUFNO2dCQUNQLENBQUM7Z0JBRUQsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNwQixDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQUVELElBQUksWUFBWTtRQUNmLElBQUksQ0FBQyxJQUFJLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztZQUNuQyxPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBQ0QsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzNFLElBQUksQ0FBQyxXQUFXLEVBQUUsTUFBTSxFQUFFLENBQUM7WUFDMUIsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUNELE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDekQsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ1QsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUNELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDN0QsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1osT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUNELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUM5QyxDQUFDO0lBRUQsSUFBSSxTQUFTO1FBQ1osSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQzNCLE1BQU0sR0FBRyxNQUFNLFlBQVksTUFBTSxDQUFDO1lBQ2xDLE9BQU8sQ0FBQyxNQUFNLENBQUM7UUFDaEIsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFFRCxLQUFLLENBQUMsTUFBb0I7UUFFekIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUN0QyxJQUFJLENBQUMsYUFBYSxJQUFJLEVBQUUsQ0FBQztRQUV6QixJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBRXpDLDREQUE0RDtZQUM1RCxrRUFBa0U7WUFDbEUsZ0VBQWdFO1lBQ2hFLDJDQUEyQztZQUMzQyxLQUFLLE1BQU0sV0FBVyxJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsRUFBRSxDQUFDO2dCQUMvRSxNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUMsS0FBSyxFQUFHLENBQUM7Z0JBQy9CLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN0QyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLHVCQUF1QixDQUFDLENBQUM7Z0JBRWhELDJEQUEyRDtnQkFDM0QsK0RBQStEO2dCQUMvRCxnREFBZ0Q7Z0JBQ2hELE1BQU0sb0JBQW9CLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSyxDQUFDLEtBQUssQ0FBQztnQkFFekUsS0FBSyxNQUFNLGlCQUFpQixJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxDQUFDO29CQUNyRSxJQUFJLGlCQUFpQixDQUFDLGNBQWMsRUFBRSxDQUFDO3dCQUN0QyxpQkFBaUIsQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsb0JBQW9CLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO29CQUNqRyxDQUFDO3lCQUFNLENBQUM7d0JBQ1AsaUJBQWlCLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO29CQUM5RixDQUFDO2dCQUNGLENBQUM7Z0JBQ0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBRTdELHlEQUF5RDtnQkFDekQsOENBQThDO2dCQUM5QyxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsdUJBQXdCLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBRSxDQUFDO2dCQUMzRCxRQUFRLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQzlCLElBQUksQ0FBQyx1QkFBd0IsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBRWxELDZEQUE2RDtnQkFDN0QsK0JBQStCO2dCQUMvQixLQUFLLE1BQU0sV0FBVyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFLENBQUM7b0JBQ3hELE1BQU0saUJBQWlCLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUM7b0JBQzlELE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO29CQUM1RCxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsYUFBYSxDQUNoQyxLQUFLLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsaUJBQWlCLENBQUMsRUFDdkQsS0FBSyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsT0FBTyxHQUFHLGlCQUFpQixHQUFHLGNBQWMsQ0FBQyxDQUN4RSxDQUFDO29CQUNGLE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQ3pFLElBQUksQ0FBQyx1QkFBd0IsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUN4RCxDQUFDO1lBQ0YsQ0FBQztZQUVELGlGQUFpRjtZQUNqRixJQUFJLENBQUMsa0JBQWtCLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFLFdBQVcsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUMzRixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxpQkFBaUI7UUFDaEIsSUFBSSxNQUF5QixDQUFDO1FBQzlCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDdEMsS0FBSyxNQUFNLFlBQVksSUFBSSxJQUFJLENBQUMsdUJBQXdCLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztZQUNuRSxNQUFNLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsSUFBSSxTQUFTLENBQUM7WUFDN0UsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUNiLE1BQU0sR0FBRyxnQkFBZ0IsQ0FBQztZQUMzQixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsTUFBTSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsZ0JBQWlCLENBQUMsQ0FBQztZQUM5QyxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQzs7QUFXRixNQUFNLGVBQWUsR0FBaUM7SUFDckQsZUFBZSxFQUFFLENBQUM7SUFDbEIsY0FBYyxFQUFFLENBQUM7SUFDakIsZ0JBQWdCLEVBQUUsSUFBSTtJQUN0QixhQUFhLEVBQUUsU0FBUztJQUN4QixrQkFBa0IsRUFBRSxTQUFTO0NBQzdCLENBQUM7QUFRSyxJQUFNLGNBQWMsc0JBQXBCLE1BQU0sY0FBYztJQUUxQixNQUFNLENBQUMsZ0JBQWdCLENBQUMsS0FBaUIsRUFBRSxRQUFtQixFQUFFLGlCQUEwQixFQUFFLE9BQXdCLEVBQUUsTUFBb0I7UUFDekksTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDdkQsTUFBTSxxQkFBcUIsR0FBRyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFFakYsMEJBQTBCO1FBQzFCLElBQUksaUJBQXFDLENBQUM7UUFFMUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUNyQiwrQ0FBK0M7WUFDL0MsSUFBSSxDQUFDLENBQUMsTUFBTSxZQUFZLElBQUksQ0FBQyxJQUFJLE1BQU0sQ0FBQyxNQUFNLFlBQVksTUFBTSxFQUFFLENBQUM7Z0JBQ2xFLE9BQU8sSUFBSSxDQUFDO1lBQ2IsQ0FBQztZQUVELG1DQUFtQztZQUNuQyxJQUFJLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztnQkFDbkMsT0FBTyxJQUFJLENBQUM7WUFDYixDQUFDO1lBRUQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7WUFFL0MsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO2dCQUN2QixxQ0FBcUM7Z0JBQ3JDLHlGQUF5RjtnQkFDekYsbURBQW1EO2dCQUNuRCwrRUFBK0U7Z0JBQy9FLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ3RDLElBQUksTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO29CQUNsQixnQkFBZ0I7b0JBQ2hCLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRWpELENBQUM7cUJBQU0sQ0FBQztvQkFDUCwyQ0FBMkM7b0JBQzNDLGlCQUFpQixHQUFHLGlCQUFpQixJQUFJLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFDNUQsTUFBTSxRQUFRLEdBQUcsaUJBQWlCLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDMUQsSUFBSSxRQUFRLCtCQUFzQixJQUFJLFFBQVEscUNBQTRCLEVBQUUsQ0FBQzt3QkFDNUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxxQkFBcUIsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDekUsQ0FBQztnQkFDRixDQUFDO2dCQUNELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7b0JBQ3ZDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsb0JBQW9CLENBQUMscUJBQXFCLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pFLENBQUM7WUFDRixDQUFDO1lBRUQsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztZQUM1QyxJQUFJLFFBQVEsS0FBSyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQy9CLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDcEQsaUJBQWlCLEdBQUcsU0FBUyxDQUFDO1lBQy9CLENBQUM7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNiLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxxQkFBcUIsQ0FBQztJQUM5QixDQUFDO0lBRUQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxLQUFpQixFQUFFLFNBQW9CLEVBQUUsZUFBdUIsRUFBRSxjQUFzQjtRQUM5RyxJQUFJLGVBQWUsS0FBSyxDQUFDLElBQUksY0FBYyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ25ELHVFQUF1RTtZQUN2RSxvRUFBb0U7WUFDcEUsTUFBTSxFQUFFLGtCQUFrQixFQUFFLGNBQWMsRUFBRSxHQUFHLFNBQVMsQ0FBQztZQUN6RCxNQUFNLG9CQUFvQixHQUFHLGNBQWMsR0FBRyxlQUFlLENBQUM7WUFDOUQsTUFBTSxtQkFBbUIsR0FBRyxjQUFjLEdBQUcsY0FBYyxDQUFDO1lBRTVELE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxhQUFhLENBQUM7Z0JBQ2pDLGVBQWUsRUFBRSxrQkFBa0I7Z0JBQ25DLFdBQVcsRUFBRSxvQkFBb0I7Z0JBQ2pDLGFBQWEsRUFBRSxrQkFBa0I7Z0JBQ2pDLFNBQVMsRUFBRSxtQkFBbUI7YUFDOUIsQ0FBQyxDQUFDO1lBRUgsU0FBUyxHQUFHLFNBQVMsQ0FBQyxtQkFBbUIsQ0FDeEMsS0FBSyxDQUFDLGVBQWUsRUFBRSxLQUFLLENBQUMsV0FBVyxFQUN4QyxLQUFLLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxTQUFTLEVBQ3BDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FDeEIsQ0FBQztRQUNILENBQUM7UUFDRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsTUFBTSxDQUFDLG9DQUFvQyxDQUFDLE1BQXlCLEVBQUUsUUFBZ0IsRUFBRSxlQUF1QixFQUFFLGNBQXNCLEVBQUUsbUJBQTRCLEVBQUUsZ0JBQXlCLEVBQUUsYUFBaUMsRUFBRSxrQkFBa0QsRUFBRSw0QkFBMkQ7UUFDcFYsTUFBTSxLQUFLLEdBQXFDLEVBQUUsQ0FBQztRQUNuRCxNQUFNLFFBQVEsR0FBaUIsRUFBRSxDQUFDO1FBRWxDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQztZQUN4QixPQUFPLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxDQUFDO1FBQzVCLENBQUM7UUFDRCxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7UUFFaEMsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQztRQUN4RyxNQUFNLDBCQUEwQixHQUFHLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLElBQUksMEJBQTBCLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQzlJLE1BQU0saUJBQWlCLEdBQUcsR0FBRyxFQUFFLENBQUMsYUFBYSxDQUFDO1FBRTlDLHdEQUF3RDtRQUN4RCx3REFBd0Q7UUFDeEQsZ0VBQWdFO1FBQ2hFLE1BQU0sZUFBZSxHQUFHLEtBQUssQ0FBQyxlQUFlLENBQUMsZ0JBQWMsQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxZQUFZLEVBQUUsRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoSSxNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUMsZUFBZSxDQUFDLGdCQUFjLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7UUFFOUgsd0RBQXdEO1FBQ3hELGdFQUFnRTtRQUNoRSxNQUFNLDJCQUEyQixHQUFHLEtBQUssQ0FBQywrQkFBK0IsQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUVwSCxzREFBc0Q7UUFDdEQsd0RBQXdEO1FBQ3hELG9EQUFvRDtRQUNwRCxvQkFBb0I7UUFDcEIsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsYUFBYSxFQUFFO2FBQzlDLEdBQUcsQ0FBQyxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQzthQUM3QyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztRQUUzRSxLQUFLLE1BQU0sRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUVwRCw0RUFBNEU7WUFDNUUsa0VBQWtFO1lBQ2xFLElBQUksZUFBZSxHQUFHLGdCQUFjLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzNGLElBQUksY0FBYyxHQUFHLGdCQUFjLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1lBQ3pGLElBQUksZUFBZSxLQUFLLEtBQUssQ0FBQyxlQUFlLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQztnQkFDaEUsZUFBZSxHQUFHLFNBQVMsQ0FBQztZQUM3QixDQUFDO1lBQ0QsSUFBSSxjQUFjLEtBQUssS0FBSyxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO2dCQUM5RCxjQUFjLEdBQUcsU0FBUyxDQUFDO1lBQzVCLENBQUM7WUFFRCxnREFBZ0Q7WUFDaEQsTUFBTSxnQkFBZ0IsR0FBRyxTQUFTO2lCQUNoQyxnQkFBZ0IsQ0FBQyxlQUFlLENBQUMsZUFBZSxFQUFFLGVBQWUsQ0FBQyxXQUFXLENBQUM7aUJBQzlFLGNBQWMsQ0FBQyxjQUFjLENBQUMsYUFBYSxFQUFFLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUV6RSxNQUFNLE9BQU8sR0FBRyxJQUFJLGFBQWEsRUFBRSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLG1CQUFtQixDQUFDLENBQUM7WUFFL0UsMERBQTBEO1lBQzFELDhFQUE4RTtZQUM5RSxxRUFBcUU7WUFDckUsaURBQWlEO1lBQ2pELE1BQU0sS0FBSyxHQUFHLGdCQUFnQixDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDbEQsTUFBTSw0QkFBNEIsR0FBRyxnQkFBYyxDQUFDLGdCQUFnQixDQUNuRSxLQUFLLEVBQUUsS0FBSyxFQUNaLGdCQUFnQixJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSSwyQkFBMkIsS0FBSyxLQUFLLENBQUMsK0JBQStCLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLENBQUMsRUFDcEksT0FBTyxDQUNQLENBQUM7WUFFRixPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxnQ0FBZ0MsQ0FBQztnQkFDN0QsMEJBQTBCO2dCQUMxQixJQUFJLDhCQUE4QixDQUFDLGlCQUFpQixFQUFFLEdBQUcsRUFBRSxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLFNBQVMsd0NBQStCLEtBQUssUUFBUSxDQUFDO2dCQUNsSixJQUFJLDhCQUE4QixDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLGtCQUFrQixDQUFDO2dCQUM3RSxJQUFJLDRCQUE0QixDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsNEJBQTRCLENBQUM7Z0JBQ2hGLElBQUkseUJBQXlCO2dCQUM3QixJQUFJLDhCQUE4QixDQUFDLGdCQUFnQixDQUFDO2dCQUNwRCxJQUFJLDJCQUEyQjthQUMvQixDQUFDLENBQUMsQ0FBQztZQUVKLGdFQUFnRTtZQUNoRSxrRUFBa0U7WUFDbEUscUNBQXFDO1lBQ3JDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ3pFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxVQUFVLEdBQUcsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLDRFQUE0RTtZQUM5SCxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztZQUM3QixRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSw0QkFBNEIsQ0FBQyxDQUFDO1FBQy9FLENBQUM7UUFFRCxPQUFPLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxDQUFDO0lBQzVCLENBQUM7SUFFRCxNQUFNLENBQUMsK0JBQStCLENBQUMsTUFBeUIsRUFBRSxZQUE0QixFQUFFLG1CQUE0QixFQUFFLGdCQUF5QixFQUFFLGFBQWlDLEVBQUUsa0JBQWtELEVBQUUsNEJBQTJEO1FBRTFTLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNyRCxPQUFPLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLENBQUM7UUFDcEMsQ0FBQztRQUVELE1BQU0sS0FBSyxHQUFxQyxFQUFFLENBQUM7UUFDbkQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBRWhDLE1BQU0sTUFBTSxHQUFHLElBQUksYUFBYSxFQUFFLENBQUM7UUFDbkMsTUFBTSxPQUFPLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztRQUV0Qyw2QkFBNkI7UUFDN0IsTUFBTSxRQUFRLEdBQUcsSUFBSSxnQ0FBZ0MsQ0FBQztZQUNyRCxNQUFNLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxJQUFJLDBCQUEwQixDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDMUcsSUFBSSw4QkFBOEIsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxhQUFhLEVBQUUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLFNBQVMsd0NBQStCLEtBQUssUUFBUSxDQUFDO1lBQ3ZKLElBQUksOEJBQThCLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDLEVBQUUsa0JBQWtCLENBQUM7WUFDdkYsSUFBSSw0QkFBNEIsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLFlBQVksRUFBRSxFQUFFLDRCQUE0QixDQUFDO1lBQzVGLElBQUkseUJBQXlCO1lBQzdCLElBQUksOEJBQThCLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUM7WUFDbEgsSUFBSSwyQkFBMkI7U0FDL0IsQ0FBQyxDQUFDO1FBRUgsRUFBRTtRQUNGLFlBQVksR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDN0YsSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBQ2YsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUU5QyxNQUFNLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFNUQsOERBQThEO1lBQzlELGdEQUFnRDtZQUNoRCxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDWCxNQUFNLFNBQVMsR0FBRyxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztnQkFDNUMsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLEVBQUUsS0FBSyxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQztnQkFDNUYsTUFBTSxRQUFRLEdBQUcsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUM1RCxPQUFPLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUM5QixNQUFNLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7WUFDakMsQ0FBQztZQUVELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3pELGdCQUFjLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFLGNBQWMsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRSxPQUFPLEVBQUUsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUNoSyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUM7WUFFbkMsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3ZDLE1BQU0sbUJBQW1CLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN0RCxNQUFNLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQztZQUU1QixZQUFZO1lBQ1osTUFBTSxJQUFJLEdBQW1DLGFBQWEsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLG1CQUFtQixDQUFDLENBQUM7WUFDL0YsSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsNEVBQTRFO1lBQ3RILElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO1lBQ3ZCLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbEIsQ0FBQztRQUVELEVBQUU7UUFDRixNQUFNLENBQUMsa0JBQWtCLENBQUMsT0FBTyxFQUFFLG1CQUFtQixFQUFFLElBQUksQ0FBQyxDQUFDO1FBRTlELE9BQU87WUFDTixLQUFLO1lBQ0wsUUFBUSxFQUFFLENBQUMsSUFBSSxVQUFVLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztTQUMvQyxDQUFDO0lBQ0gsQ0FBQztJQUtELFlBQ2tCLE9BQTBCLEVBQzFCLFNBQWtDLEVBQ2xDLFdBQXlDLGVBQWUsRUFDMUMsNkJBQTZFO1FBSDNGLFlBQU8sR0FBUCxPQUFPLENBQW1CO1FBQzFCLGNBQVMsR0FBVCxTQUFTLENBQXlCO1FBQ2xDLGFBQVEsR0FBUixRQUFRLENBQWdEO1FBQ3pCLGtDQUE2QixHQUE3Qiw2QkFBNkIsQ0FBK0I7UUFQNUYsb0JBQWUsR0FBZ0QsRUFBRSxDQUFDO1FBQzNFLGNBQVMsR0FBaUIsRUFBRSxDQUFDO0lBT2pDLENBQUM7SUFFTCxPQUFPO1FBQ04sT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUN6QixDQUFDO0lBRUQsUUFBUTtRQUNQLE9BQU8sYUFBYSxJQUFJLENBQUMsU0FBUyx3QkFBd0IsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQztJQUNoRyxDQUFDO0lBRUQsTUFBTSxDQUFDLFVBQWdDO1FBQ3RDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUM7WUFDOUIsT0FBTztRQUNSLENBQUM7UUFFRCxtREFBbUQ7UUFDbkQsTUFBTSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsR0FBRyxPQUFPLElBQUksQ0FBQyxTQUFTLEtBQUssUUFBUTtZQUM3RCxDQUFDLENBQUMsZ0JBQWMsQ0FBQyxvQ0FBb0MsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsNkJBQTZCLENBQUM7WUFDMVIsQ0FBQyxDQUFDLGdCQUFjLENBQUMsK0JBQStCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLDZCQUE2QixDQUFDLENBQUM7UUFFMU4sSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7UUFFMUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsVUFBVSxJQUFJLFdBQVcsQ0FBQyxPQUFPLEVBQUUsRUFBRSxLQUFLLEVBQUUsVUFBVSxDQUFDLEVBQUU7WUFDbEYsb0ZBQW9GO1lBQ3BGLDZEQUE2RDtZQUM3RCx5RUFBeUU7WUFDekUsTUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDL0QsS0FBSyxJQUFJLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLFFBQVEsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQztnQkFDaEQsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDckQsQ0FBQztZQUVELElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFDdEMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3pCLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxPQUFPLFNBQVM7cUJBQ2QsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNyRSxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFnQixFQUFFLFVBQXdDLGVBQWU7UUFDOUUsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQztZQUM5QixPQUFPO1FBQ1IsQ0FBQztRQUNELElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxxQkFBcUIsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ2hILE1BQU0sRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLEdBQUcsZ0JBQWMsQ0FBQyxvQ0FBb0MsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsZUFBZSxFQUFFLE9BQU8sQ0FBQyxjQUFjLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxPQUFPLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsNkJBQTZCLENBQUMsQ0FBQztRQUVoUixJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyxFQUFFO1lBQ3hELG9GQUFvRjtZQUNwRiw2REFBNkQ7WUFDN0QseUVBQXlFO1lBQ3pFLE1BQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQy9ELEtBQUssSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUM7Z0JBQ2hELFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3JELENBQUM7WUFFRCwwRkFBMEY7WUFDMUYsMkZBQTJGO1lBQzNGLFVBQVU7WUFDVixNQUFNLGdCQUFnQixHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQztZQUN0RCxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDdkIsS0FBSyxNQUFNLE9BQU8sSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7b0JBQ3RDLE9BQU8sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3pCLENBQUM7Z0JBQ0QsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ3ZDLENBQUM7WUFFRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDM0QsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzlCLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxPQUFPLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3BGLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxJQUFJO1FBQ0gsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUMxQyxJQUFJLENBQUMsT0FBTyxDQUFDLHVDQUF1QyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQ3RGLENBQUM7SUFFRCxJQUFJO1FBQ0gsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN4QyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUMxQyxJQUFJLENBQUMsT0FBTyxDQUFDLHVDQUF1QyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQ3RGLENBQUM7SUFFTyxLQUFLLENBQUMsR0FBd0I7UUFDckMsTUFBTSxVQUFVLEdBQWdCLEVBQUUsQ0FBQztRQUNuQyxLQUFLLE1BQU0sT0FBTyxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUN0QyxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3ZDLFVBQVUsQ0FBQyxJQUFJLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQztRQUNsQyxDQUFDO1FBQ0QsT0FBTyxVQUFVLENBQUM7SUFDbkIsQ0FBQztJQUVELElBQUksb0JBQW9CO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQztJQUMvQyxDQUFDO0lBRUQsSUFBSSxtQkFBbUI7UUFDdEIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDO0lBQzlDLENBQUM7SUFFRCxJQUFJLGNBQWM7UUFDakIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQztJQUN6QyxDQUFDO0lBRUQsSUFBSSxTQUFTO1FBQ1osT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsSUFBSSxZQUFZO1FBQ2YsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQztJQUN2QyxDQUFDO0lBRUQsNkJBQTZCO1FBRTVCLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDMUIsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBRUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUNoRCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUMvQyw0Q0FBNEM7WUFDNUMsNENBQTRDO1lBQzVDLGdEQUFnRDtZQUNoRCxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxNQUFNLHFCQUFxQixHQUFHLElBQUksR0FBRyxFQUFtQixDQUFDO1FBQ3pELEtBQUssTUFBTSxPQUFPLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBRXRDLE1BQU0sa0JBQWtCLEdBQUcsT0FBTyxDQUFDLHlCQUF5QixFQUFFLENBQUM7WUFFL0QsOERBQThEO1lBQzlELGtFQUFrRTtZQUNsRSx3REFBd0Q7WUFDeEQsSUFBSSxxQkFBcUIsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ3RDLEtBQUssTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO29CQUNsRCxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO29CQUM1QyxLQUFLLE1BQU0sU0FBUyxJQUFJLFVBQVUsRUFBRSxDQUFDO3dCQUNwQyxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQzs0QkFDeEMscUJBQXFCLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQzs0QkFDckMsTUFBTTt3QkFDUCxDQUFDO29CQUNGLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7WUFFRCxJQUFJLHFCQUFxQixDQUFDLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDdEMsdURBQXVEO2dCQUN2RCwyQkFBMkI7Z0JBQzNCLE9BQU8sS0FBSyxDQUFDO1lBQ2QsQ0FBQztZQUVELHlEQUF5RDtZQUN6RCxrQ0FBa0M7WUFDbEMscUJBQXFCLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFFO2dCQUM5QyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBRSxDQUFDLENBQUM7WUFDL0MsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsaUVBQWlFO1FBQ2pFLHdFQUF3RTtRQUN4RSxZQUFZO1FBQ1osVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQztRQUVoRCxLQUFLLE1BQU0sQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLElBQUkscUJBQXFCLEVBQUUsQ0FBQztZQUNyRCxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUN6QyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3BDLFNBQVM7WUFDVixDQUFDO1lBRUQsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQztZQUU1QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUN4QyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO29CQUM3QyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ3BDLFNBQVM7Z0JBQ1YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQscURBQXFEO1FBQ3JELDJEQUEyRDtRQUMzRCxtREFBbUQ7UUFDbkQsT0FBTyxxQkFBcUIsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFFTSxpQkFBaUI7UUFDdkIsSUFBSSxNQUF5QixDQUFDO1FBQzlCLEtBQUssTUFBTSxPQUFPLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQ2pELElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDYixNQUFNLEdBQUcsWUFBWSxDQUFDO1lBQ3ZCLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxNQUFNLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxZQUFhLENBQUMsQ0FBQztZQUMxQyxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztDQUNELENBQUE7QUF2YlksY0FBYztJQTJPeEIsV0FBQSw2QkFBNkIsQ0FBQTtHQTNPbkIsY0FBYyxDQXViMUIifQ==