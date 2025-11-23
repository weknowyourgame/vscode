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
var SuggestController_1;
import { alert } from '../../../../base/browser/ui/aria/aria.js';
import { isNonEmptyArray } from '../../../../base/common/arrays.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { onUnexpectedError, onUnexpectedExternalError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { KeyCodeChord } from '../../../../base/common/keybindings.js';
import { DisposableStore, dispose, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import * as platform from '../../../../base/common/platform.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';
import { assertType, isObject } from '../../../../base/common/types.js';
import { StableEditorScrollState } from '../../../browser/stableEditorScroll.js';
import { EditorAction, EditorCommand, registerEditorAction, registerEditorCommand, registerEditorContribution } from '../../../browser/editorExtensions.js';
import { EditOperation } from '../../../common/core/editOperation.js';
import { Position } from '../../../common/core/position.js';
import { Range } from '../../../common/core/range.js';
import { EditorContextKeys } from '../../../common/editorContextKeys.js';
import { ProviderId } from '../../../common/languages.js';
import { SnippetController2 } from '../../snippet/browser/snippetController2.js';
import { SnippetParser } from '../../snippet/browser/snippetParser.js';
import { ISuggestMemoryService } from './suggestMemory.js';
import { WordContextKey } from './wordContextKey.js';
import * as nls from '../../../../nls.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Context as SuggestContext, suggestWidgetStatusbarMenu } from './suggest.js';
import { SuggestAlternatives } from './suggestAlternatives.js';
import { CommitCharacterController } from './suggestCommitCharacters.js';
import { SuggestModel } from './suggestModel.js';
import { OvertypingCapturer } from './suggestOvertypingCapturer.js';
import { SuggestWidget } from './suggestWidget.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { basename, extname } from '../../../../base/common/resources.js';
import { hash } from '../../../../base/common/hash.js';
import { WindowIdleValue, getWindow } from '../../../../base/browser/dom.js';
import { ModelDecorationOptions } from '../../../common/model/textModel.js';
import { EditSources } from '../../../common/textModelEditSource.js';
// sticky suggest widget which doesn't disappear on focus out and such
const _sticky = false;
class LineSuffix {
    constructor(_model, _position) {
        this._model = _model;
        this._position = _position;
        this._decorationOptions = ModelDecorationOptions.register({
            description: 'suggest-line-suffix',
            stickiness: 1 /* TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges */
        });
        // spy on what's happening right of the cursor. two cases:
        // 1. end of line -> check that it's still end of line
        // 2. mid of line -> add a marker and compute the delta
        const maxColumn = _model.getLineMaxColumn(_position.lineNumber);
        if (maxColumn !== _position.column) {
            const offset = _model.getOffsetAt(_position);
            const end = _model.getPositionAt(offset + 1);
            _model.changeDecorations(accessor => {
                if (this._marker) {
                    accessor.removeDecoration(this._marker);
                }
                this._marker = accessor.addDecoration(Range.fromPositions(_position, end), this._decorationOptions);
            });
        }
    }
    dispose() {
        if (this._marker && !this._model.isDisposed()) {
            this._model.changeDecorations(accessor => {
                accessor.removeDecoration(this._marker);
                this._marker = undefined;
            });
        }
    }
    delta(position) {
        if (this._model.isDisposed() || this._position.lineNumber !== position.lineNumber) {
            // bail out early if things seems fishy
            return 0;
        }
        // read the marker (in case suggest was triggered at line end) or compare
        // the cursor to the line end.
        if (this._marker) {
            const range = this._model.getDecorationRange(this._marker);
            const end = this._model.getOffsetAt(range.getStartPosition());
            return end - this._model.getOffsetAt(position);
        }
        else {
            return this._model.getLineMaxColumn(position.lineNumber) - position.column;
        }
    }
}
var InsertFlags;
(function (InsertFlags) {
    InsertFlags[InsertFlags["None"] = 0] = "None";
    InsertFlags[InsertFlags["NoBeforeUndoStop"] = 1] = "NoBeforeUndoStop";
    InsertFlags[InsertFlags["NoAfterUndoStop"] = 2] = "NoAfterUndoStop";
    InsertFlags[InsertFlags["KeepAlternativeSuggestions"] = 4] = "KeepAlternativeSuggestions";
    InsertFlags[InsertFlags["AlternativeOverwriteConfig"] = 8] = "AlternativeOverwriteConfig";
})(InsertFlags || (InsertFlags = {}));
let SuggestController = class SuggestController {
    static { SuggestController_1 = this; }
    static { this.ID = 'editor.contrib.suggestController'; }
    static get(editor) {
        return editor.getContribution(SuggestController_1.ID);
    }
    get onWillInsertSuggestItem() { return this._onWillInsertSuggestItem.event; }
    constructor(editor, _memoryService, _commandService, _contextKeyService, _instantiationService, _logService, _telemetryService) {
        this._memoryService = _memoryService;
        this._commandService = _commandService;
        this._contextKeyService = _contextKeyService;
        this._instantiationService = _instantiationService;
        this._logService = _logService;
        this._telemetryService = _telemetryService;
        this._lineSuffix = new MutableDisposable();
        this._toDispose = new DisposableStore();
        this._selectors = new PriorityRegistry(s => s.priority);
        this._onWillInsertSuggestItem = new Emitter();
        this._wantsForceRenderingAbove = false;
        this.editor = editor;
        this.model = _instantiationService.createInstance(SuggestModel, this.editor);
        // default selector
        this._selectors.register({
            priority: 0,
            select: (model, pos, items) => this._memoryService.select(model, pos, items)
        });
        // context key: update insert/replace mode
        const ctxInsertMode = SuggestContext.InsertMode.bindTo(_contextKeyService);
        ctxInsertMode.set(editor.getOption(134 /* EditorOption.suggest */).insertMode);
        this._toDispose.add(this.model.onDidTrigger(() => ctxInsertMode.set(editor.getOption(134 /* EditorOption.suggest */).insertMode)));
        this.widget = this._toDispose.add(new WindowIdleValue(getWindow(editor.getDomNode()), () => {
            const widget = this._instantiationService.createInstance(SuggestWidget, this.editor);
            this._toDispose.add(widget);
            this._toDispose.add(widget.onDidSelect(item => this._insertSuggestion(item, 0 /* InsertFlags.None */), this));
            // Wire up logic to accept a suggestion on certain characters
            const commitCharacterController = new CommitCharacterController(this.editor, widget, this.model, item => this._insertSuggestion(item, 2 /* InsertFlags.NoAfterUndoStop */));
            this._toDispose.add(commitCharacterController);
            // Wire up makes text edit context key
            const ctxMakesTextEdit = SuggestContext.MakesTextEdit.bindTo(this._contextKeyService);
            const ctxHasInsertAndReplace = SuggestContext.HasInsertAndReplaceRange.bindTo(this._contextKeyService);
            const ctxCanResolve = SuggestContext.CanResolve.bindTo(this._contextKeyService);
            this._toDispose.add(toDisposable(() => {
                ctxMakesTextEdit.reset();
                ctxHasInsertAndReplace.reset();
                ctxCanResolve.reset();
            }));
            this._toDispose.add(widget.onDidFocus(({ item }) => {
                // (ctx: makesTextEdit)
                const position = this.editor.getPosition();
                const startColumn = item.editStart.column;
                const endColumn = position.column;
                let value = true;
                if (this.editor.getOption(1 /* EditorOption.acceptSuggestionOnEnter */) === 'smart'
                    && this.model.state === 2 /* State.Auto */
                    && !item.completion.additionalTextEdits
                    && !(item.completion.insertTextRules & 4 /* CompletionItemInsertTextRule.InsertAsSnippet */)
                    && endColumn - startColumn === item.completion.insertText.length) {
                    const oldText = this.editor.getModel().getValueInRange({
                        startLineNumber: position.lineNumber,
                        startColumn,
                        endLineNumber: position.lineNumber,
                        endColumn
                    });
                    value = oldText !== item.completion.insertText;
                }
                ctxMakesTextEdit.set(value);
                // (ctx: hasInsertAndReplaceRange)
                ctxHasInsertAndReplace.set(!Position.equals(item.editInsertEnd, item.editReplaceEnd));
                // (ctx: canResolve)
                ctxCanResolve.set(Boolean(item.provider.resolveCompletionItem) || Boolean(item.completion.documentation) || item.completion.detail !== item.completion.label);
            }));
            this._toDispose.add(widget.onDetailsKeyDown(e => {
                // cmd + c on macOS, ctrl + c on Win / Linux
                if (e.toKeyCodeChord().equals(new KeyCodeChord(true, false, false, false, 33 /* KeyCode.KeyC */)) ||
                    (platform.isMacintosh && e.toKeyCodeChord().equals(new KeyCodeChord(false, false, false, true, 33 /* KeyCode.KeyC */)))) {
                    e.stopPropagation();
                    return;
                }
                if (!e.toKeyCodeChord().isModifierKey()) {
                    this.editor.focus();
                }
            }));
            if (this._wantsForceRenderingAbove) {
                widget.forceRenderingAbove();
            }
            return widget;
        }));
        // Wire up text overtyping capture
        this._overtypingCapturer = this._toDispose.add(new WindowIdleValue(getWindow(editor.getDomNode()), () => {
            return this._toDispose.add(new OvertypingCapturer(this.editor, this.model));
        }));
        this._alternatives = this._toDispose.add(new WindowIdleValue(getWindow(editor.getDomNode()), () => {
            return this._toDispose.add(new SuggestAlternatives(this.editor, this._contextKeyService));
        }));
        this._toDispose.add(_instantiationService.createInstance(WordContextKey, editor));
        this._toDispose.add(this.model.onDidTrigger(e => {
            this.widget.value.showTriggered(e.auto, e.shy ? 250 : 50);
            this._lineSuffix.value = new LineSuffix(this.editor.getModel(), e.position);
        }));
        this._toDispose.add(this.model.onDidSuggest(e => {
            if (e.triggerOptions.shy) {
                return;
            }
            let index = -1;
            for (const selector of this._selectors.itemsOrderedByPriorityDesc) {
                index = selector.select(this.editor.getModel(), this.editor.getPosition(), e.completionModel.items);
                if (index !== -1) {
                    break;
                }
            }
            if (index === -1) {
                index = 0;
            }
            if (this.model.state === 0 /* State.Idle */) {
                // selecting an item can "pump" out selection/cursor change events
                // which can cancel suggest halfway through this function. therefore
                // we need to check again and bail if the session has been canceled
                return;
            }
            let noFocus = false;
            if (e.triggerOptions.auto) {
                // don't "focus" item when configured to do
                const options = this.editor.getOption(134 /* EditorOption.suggest */);
                if (options.selectionMode === 'never' || options.selectionMode === 'always') {
                    // simple: always or never
                    noFocus = options.selectionMode === 'never';
                }
                else if (options.selectionMode === 'whenTriggerCharacter') {
                    // on with trigger character
                    noFocus = e.triggerOptions.triggerKind !== 1 /* CompletionTriggerKind.TriggerCharacter */;
                }
                else if (options.selectionMode === 'whenQuickSuggestion') {
                    // without trigger character or when refiltering
                    noFocus = e.triggerOptions.triggerKind === 1 /* CompletionTriggerKind.TriggerCharacter */ && !e.triggerOptions.refilter;
                }
            }
            this.widget.value.showSuggestions(e.completionModel, index, e.isFrozen, e.triggerOptions.auto, noFocus);
        }));
        this._toDispose.add(this.model.onDidCancel(e => {
            if (!e.retrigger) {
                this.widget.value.hideWidget();
            }
        }));
        this._toDispose.add(this.editor.onDidBlurEditorWidget(() => {
            if (!_sticky) {
                this.model.cancel();
                this.model.clear();
            }
        }));
        // Manage the acceptSuggestionsOnEnter context key
        const acceptSuggestionsOnEnter = SuggestContext.AcceptSuggestionsOnEnter.bindTo(_contextKeyService);
        const updateFromConfig = () => {
            const acceptSuggestionOnEnter = this.editor.getOption(1 /* EditorOption.acceptSuggestionOnEnter */);
            acceptSuggestionsOnEnter.set(acceptSuggestionOnEnter === 'on' || acceptSuggestionOnEnter === 'smart');
        };
        this._toDispose.add(this.editor.onDidChangeConfiguration(() => updateFromConfig()));
        updateFromConfig();
    }
    dispose() {
        this._alternatives.dispose();
        this._toDispose.dispose();
        this.widget.dispose();
        this.model.dispose();
        this._lineSuffix.dispose();
        this._onWillInsertSuggestItem.dispose();
    }
    _insertSuggestion(event, flags) {
        if (!event || !event.item) {
            this._alternatives.value.reset();
            this.model.cancel();
            this.model.clear();
            return;
        }
        if (!this.editor.hasModel()) {
            return;
        }
        const snippetController = SnippetController2.get(this.editor);
        if (!snippetController) {
            return;
        }
        this._onWillInsertSuggestItem.fire({ item: event.item });
        const model = this.editor.getModel();
        const modelVersionNow = model.getAlternativeVersionId();
        const { item } = event;
        //
        const tasks = [];
        const cts = new CancellationTokenSource();
        // pushing undo stops *before* additional text edits and
        // *after* the main edit
        if (!(flags & 1 /* InsertFlags.NoBeforeUndoStop */)) {
            this.editor.pushUndoStop();
        }
        // compute overwrite[Before|After] deltas BEFORE applying extra edits
        const info = this.getOverwriteInfo(item, Boolean(flags & 8 /* InsertFlags.AlternativeOverwriteConfig */));
        // keep item in memory
        this._memoryService.memorize(model, this.editor.getPosition(), item);
        const isResolved = item.isResolved;
        // telemetry data points: duration of command execution, info about async additional edits (-1=n/a, -2=none, 1=success, 0=failed)
        let _commandExectionDuration = -1;
        let _additionalEditsAppliedAsync = -1;
        if (Array.isArray(item.completion.additionalTextEdits)) {
            // cancel -> stops all listening and closes widget
            this.model.cancel();
            // sync additional edits
            const scrollState = StableEditorScrollState.capture(this.editor);
            this.editor.executeEdits('suggestController.additionalTextEdits.sync', item.completion.additionalTextEdits.map(edit => {
                let range = Range.lift(edit.range);
                if (range.startLineNumber === item.position.lineNumber && range.startColumn > item.position.column) {
                    // shift additional edit when it is "after" the completion insertion position
                    const columnDelta = this.editor.getPosition().column - item.position.column;
                    const startColumnDelta = columnDelta;
                    const endColumnDelta = Range.spansMultipleLines(range) ? 0 : columnDelta;
                    range = new Range(range.startLineNumber, range.startColumn + startColumnDelta, range.endLineNumber, range.endColumn + endColumnDelta);
                }
                return EditOperation.replaceMove(range, edit.text);
            }));
            scrollState.restoreRelativeVerticalPositionOfCursor(this.editor);
        }
        else if (!isResolved) {
            // async additional edits
            const sw = new StopWatch();
            let position;
            const docListener = model.onDidChangeContent(e => {
                if (e.isFlush) {
                    cts.cancel();
                    docListener.dispose();
                    return;
                }
                for (const change of e.changes) {
                    const thisPosition = Range.getEndPosition(change.range);
                    if (!position || Position.isBefore(thisPosition, position)) {
                        position = thisPosition;
                    }
                }
            });
            const oldFlags = flags;
            flags |= 2 /* InsertFlags.NoAfterUndoStop */;
            let didType = false;
            const typeListener = this.editor.onWillType(() => {
                typeListener.dispose();
                didType = true;
                if (!(oldFlags & 2 /* InsertFlags.NoAfterUndoStop */)) {
                    this.editor.pushUndoStop();
                }
            });
            tasks.push(item.resolve(cts.token).then(() => {
                if (!item.completion.additionalTextEdits || cts.token.isCancellationRequested) {
                    return undefined;
                }
                if (position && item.completion.additionalTextEdits.some(edit => Position.isBefore(position, Range.getStartPosition(edit.range)))) {
                    return false;
                }
                if (didType) {
                    this.editor.pushUndoStop();
                }
                const scrollState = StableEditorScrollState.capture(this.editor);
                this.editor.executeEdits('suggestController.additionalTextEdits.async', item.completion.additionalTextEdits.map(edit => EditOperation.replaceMove(Range.lift(edit.range), edit.text)));
                scrollState.restoreRelativeVerticalPositionOfCursor(this.editor);
                if (didType || !(oldFlags & 2 /* InsertFlags.NoAfterUndoStop */)) {
                    this.editor.pushUndoStop();
                }
                return true;
            }).then(applied => {
                this._logService.trace('[suggest] async resolving of edits DONE (ms, applied?)', sw.elapsed(), applied);
                _additionalEditsAppliedAsync = applied === true ? 1 : applied === false ? 0 : -2;
            }).finally(() => {
                docListener.dispose();
                typeListener.dispose();
            }));
        }
        let { insertText } = item.completion;
        if (!(item.completion.insertTextRules & 4 /* CompletionItemInsertTextRule.InsertAsSnippet */)) {
            insertText = SnippetParser.escape(insertText);
        }
        // cancel -> stops all listening and closes widget
        this.model.cancel();
        snippetController.insert(insertText, {
            overwriteBefore: info.overwriteBefore,
            overwriteAfter: info.overwriteAfter,
            undoStopBefore: false,
            undoStopAfter: false,
            adjustWhitespace: !(item.completion.insertTextRules & 1 /* CompletionItemInsertTextRule.KeepWhitespace */),
            clipboardText: event.model.clipboardText,
            overtypingCapturer: this._overtypingCapturer.value,
            reason: EditSources.suggest({ providerId: ProviderId.fromExtensionId(item.extensionId?.value) }),
        });
        if (!(flags & 2 /* InsertFlags.NoAfterUndoStop */)) {
            this.editor.pushUndoStop();
        }
        if (item.completion.command) {
            if (item.completion.command.id === TriggerSuggestAction.id) {
                // retigger
                this.model.trigger({ auto: true, retrigger: true });
            }
            else {
                // exec command, done
                const sw = new StopWatch();
                tasks.push(this._commandService.executeCommand(item.completion.command.id, ...(item.completion.command.arguments ? [...item.completion.command.arguments] : [])).catch(e => {
                    if (item.completion.extensionId) {
                        onUnexpectedExternalError(e);
                    }
                    else {
                        onUnexpectedError(e);
                    }
                }).finally(() => {
                    _commandExectionDuration = sw.elapsed();
                }));
            }
        }
        if (flags & 4 /* InsertFlags.KeepAlternativeSuggestions */) {
            this._alternatives.value.set(event, next => {
                // cancel resolving of additional edits
                cts.cancel();
                // this is not so pretty. when inserting the 'next'
                // suggestion we undo until we are at the state at
                // which we were before inserting the previous suggestion...
                while (model.canUndo()) {
                    if (modelVersionNow !== model.getAlternativeVersionId()) {
                        model.undo();
                    }
                    this._insertSuggestion(next, 1 /* InsertFlags.NoBeforeUndoStop */ | 2 /* InsertFlags.NoAfterUndoStop */ | (flags & 8 /* InsertFlags.AlternativeOverwriteConfig */ ? 8 /* InsertFlags.AlternativeOverwriteConfig */ : 0));
                    break;
                }
            });
        }
        this._alertCompletionItem(item);
        // clear only now - after all tasks are done
        Promise.all(tasks).finally(() => {
            this._reportSuggestionAcceptedTelemetry(item, model, isResolved, _commandExectionDuration, _additionalEditsAppliedAsync, event.index, event.model.items);
            this.model.clear();
            cts.dispose();
        });
    }
    _reportSuggestionAcceptedTelemetry(item, model, itemResolved, commandExectionDuration, additionalEditsAppliedAsync, index, completionItems) {
        if (Math.random() > 0.0001) { // 0.01%
            return;
        }
        const labelMap = new Map();
        for (let i = 0; i < Math.min(30, completionItems.length); i++) {
            const label = completionItems[i].textLabel;
            if (labelMap.has(label)) {
                labelMap.get(label).push(i);
            }
            else {
                labelMap.set(label, [i]);
            }
        }
        const firstIndexArray = labelMap.get(item.textLabel);
        const hasDuplicates = firstIndexArray && firstIndexArray.length > 1;
        const firstIndex = hasDuplicates ? firstIndexArray[0] : -1;
        this._telemetryService.publicLog2('suggest.acceptedSuggestion', {
            extensionId: item.extensionId?.value ?? 'unknown',
            providerId: item.provider._debugDisplayName ?? 'unknown',
            kind: item.completion.kind,
            basenameHash: hash(basename(model.uri)).toString(16),
            languageId: model.getLanguageId(),
            fileExtension: extname(model.uri),
            resolveInfo: !item.provider.resolveCompletionItem ? -1 : itemResolved ? 1 : 0,
            resolveDuration: item.resolveDuration,
            commandDuration: commandExectionDuration,
            additionalEditsAsync: additionalEditsAppliedAsync,
            index,
            firstIndex,
        });
    }
    getOverwriteInfo(item, toggleMode) {
        assertType(this.editor.hasModel());
        let replace = this.editor.getOption(134 /* EditorOption.suggest */).insertMode === 'replace';
        if (toggleMode) {
            replace = !replace;
        }
        const overwriteBefore = item.position.column - item.editStart.column;
        const overwriteAfter = (replace ? item.editReplaceEnd.column : item.editInsertEnd.column) - item.position.column;
        const columnDelta = this.editor.getPosition().column - item.position.column;
        const suffixDelta = this._lineSuffix.value ? this._lineSuffix.value.delta(this.editor.getPosition()) : 0;
        return {
            overwriteBefore: overwriteBefore + columnDelta,
            overwriteAfter: overwriteAfter + suffixDelta
        };
    }
    _alertCompletionItem(item) {
        if (isNonEmptyArray(item.completion.additionalTextEdits)) {
            const msg = nls.localize('aria.alert.snippet', "Accepting '{0}' made {1} additional edits", item.textLabel, item.completion.additionalTextEdits.length);
            alert(msg);
        }
    }
    triggerSuggest(onlyFrom, auto, noFilter) {
        if (this.editor.hasModel()) {
            this.model.trigger({
                auto: auto ?? false,
                completionOptions: { providerFilter: onlyFrom, kindFilter: noFilter ? new Set() : undefined }
            });
            this.editor.revealPosition(this.editor.getPosition(), 0 /* ScrollType.Smooth */);
            this.editor.focus();
        }
    }
    triggerSuggestAndAcceptBest(arg) {
        if (!this.editor.hasModel()) {
            return;
        }
        const positionNow = this.editor.getPosition();
        const fallback = () => {
            if (positionNow.equals(this.editor.getPosition())) {
                this._commandService.executeCommand(arg.fallback);
            }
        };
        const makesTextEdit = (item) => {
            if (item.completion.insertTextRules & 4 /* CompletionItemInsertTextRule.InsertAsSnippet */ || item.completion.additionalTextEdits) {
                // snippet, other editor -> makes edit
                return true;
            }
            const position = this.editor.getPosition();
            const startColumn = item.editStart.column;
            const endColumn = position.column;
            if (endColumn - startColumn !== item.completion.insertText.length) {
                // unequal lengths -> makes edit
                return true;
            }
            const textNow = this.editor.getModel().getValueInRange({
                startLineNumber: position.lineNumber,
                startColumn,
                endLineNumber: position.lineNumber,
                endColumn
            });
            // unequal text -> makes edit
            return textNow !== item.completion.insertText;
        };
        Event.once(this.model.onDidTrigger)(_ => {
            // wait for trigger because only then the cancel-event is trustworthy
            const listener = [];
            Event.any(this.model.onDidTrigger, this.model.onDidCancel)(() => {
                // retrigger or cancel -> try to type default text
                dispose(listener);
                fallback();
            }, undefined, listener);
            this.model.onDidSuggest(({ completionModel }) => {
                dispose(listener);
                if (completionModel.items.length === 0) {
                    fallback();
                    return;
                }
                const index = this._memoryService.select(this.editor.getModel(), this.editor.getPosition(), completionModel.items);
                const item = completionModel.items[index];
                if (!makesTextEdit(item)) {
                    fallback();
                    return;
                }
                this.editor.pushUndoStop();
                this._insertSuggestion({ index, item, model: completionModel }, 4 /* InsertFlags.KeepAlternativeSuggestions */ | 1 /* InsertFlags.NoBeforeUndoStop */ | 2 /* InsertFlags.NoAfterUndoStop */);
            }, undefined, listener);
        });
        this.model.trigger({ auto: false, shy: true });
        this.editor.revealPosition(positionNow, 0 /* ScrollType.Smooth */);
        this.editor.focus();
    }
    acceptSelectedSuggestion(keepAlternativeSuggestions, alternativeOverwriteConfig) {
        const item = this.widget.value.getFocusedItem();
        let flags = 0;
        if (keepAlternativeSuggestions) {
            flags |= 4 /* InsertFlags.KeepAlternativeSuggestions */;
        }
        if (alternativeOverwriteConfig) {
            flags |= 8 /* InsertFlags.AlternativeOverwriteConfig */;
        }
        this._insertSuggestion(item, flags);
    }
    acceptNextSuggestion() {
        this._alternatives.value.next();
    }
    acceptPrevSuggestion() {
        this._alternatives.value.prev();
    }
    cancelSuggestWidget() {
        this.model.cancel();
        this.model.clear();
        this.widget.value.hideWidget();
    }
    focusSuggestion() {
        this.widget.value.focusSelected();
    }
    selectNextSuggestion() {
        this.widget.value.selectNext();
    }
    selectNextPageSuggestion() {
        this.widget.value.selectNextPage();
    }
    selectLastSuggestion() {
        this.widget.value.selectLast();
    }
    selectPrevSuggestion() {
        this.widget.value.selectPrevious();
    }
    selectPrevPageSuggestion() {
        this.widget.value.selectPreviousPage();
    }
    selectFirstSuggestion() {
        this.widget.value.selectFirst();
    }
    toggleSuggestionDetails() {
        this.widget.value.toggleDetails();
    }
    toggleExplainMode() {
        this.widget.value.toggleExplainMode();
    }
    toggleSuggestionFocus() {
        this.widget.value.toggleDetailsFocus();
    }
    resetWidgetSize() {
        this.widget.value.resetPersistedSize();
    }
    forceRenderingAbove() {
        if (this.widget.isInitialized) {
            this.widget.value.forceRenderingAbove();
        }
        else {
            // Defer this until the widget is created
            this._wantsForceRenderingAbove = true;
        }
    }
    stopForceRenderingAbove() {
        if (this.widget.isInitialized) {
            this.widget.value.stopForceRenderingAbove();
        }
        else {
            this._wantsForceRenderingAbove = false;
        }
    }
    registerSelector(selector) {
        return this._selectors.register(selector);
    }
};
SuggestController = SuggestController_1 = __decorate([
    __param(1, ISuggestMemoryService),
    __param(2, ICommandService),
    __param(3, IContextKeyService),
    __param(4, IInstantiationService),
    __param(5, ILogService),
    __param(6, ITelemetryService)
], SuggestController);
export { SuggestController };
class PriorityRegistry {
    constructor(prioritySelector) {
        this.prioritySelector = prioritySelector;
        this._items = new Array();
    }
    register(value) {
        if (this._items.indexOf(value) !== -1) {
            throw new Error('Value is already registered');
        }
        this._items.push(value);
        this._items.sort((s1, s2) => this.prioritySelector(s2) - this.prioritySelector(s1));
        return {
            dispose: () => {
                const idx = this._items.indexOf(value);
                if (idx >= 0) {
                    this._items.splice(idx, 1);
                }
            }
        };
    }
    get itemsOrderedByPriorityDesc() {
        return this._items;
    }
}
export class TriggerSuggestAction extends EditorAction {
    static { this.id = 'editor.action.triggerSuggest'; }
    constructor() {
        super({
            id: TriggerSuggestAction.id,
            label: nls.localize2('suggest.trigger.label', "Trigger Suggest"),
            precondition: ContextKeyExpr.and(EditorContextKeys.writable, EditorContextKeys.hasCompletionItemProvider, SuggestContext.Visible.toNegated()),
            kbOpts: {
                kbExpr: EditorContextKeys.textInputFocus,
                primary: 2048 /* KeyMod.CtrlCmd */ | 10 /* KeyCode.Space */,
                secondary: [2048 /* KeyMod.CtrlCmd */ | 39 /* KeyCode.KeyI */],
                mac: { primary: 256 /* KeyMod.WinCtrl */ | 10 /* KeyCode.Space */, secondary: [512 /* KeyMod.Alt */ | 9 /* KeyCode.Escape */, 2048 /* KeyMod.CtrlCmd */ | 39 /* KeyCode.KeyI */] },
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
    run(_accessor, editor, args) {
        const controller = SuggestController.get(editor);
        if (!controller) {
            return;
        }
        let auto;
        if (args && typeof args === 'object') {
            if (args.auto === true) {
                auto = true;
            }
        }
        controller.triggerSuggest(undefined, auto, undefined);
    }
}
registerEditorContribution(SuggestController.ID, SuggestController, 2 /* EditorContributionInstantiation.BeforeFirstInteraction */);
registerEditorAction(TriggerSuggestAction);
const weight = 100 /* KeybindingWeight.EditorContrib */ + 90;
const SuggestCommand = EditorCommand.bindToContribution(SuggestController.get);
registerEditorCommand(new SuggestCommand({
    id: 'acceptSelectedSuggestion',
    precondition: ContextKeyExpr.and(SuggestContext.Visible, SuggestContext.HasFocusedSuggestion),
    handler(x) {
        x.acceptSelectedSuggestion(true, false);
    },
    kbOpts: [{
            // normal tab
            primary: 2 /* KeyCode.Tab */,
            kbExpr: ContextKeyExpr.and(SuggestContext.Visible, EditorContextKeys.textInputFocus),
            weight,
        }, {
            // accept on enter has special rules
            primary: 3 /* KeyCode.Enter */,
            kbExpr: ContextKeyExpr.and(SuggestContext.Visible, EditorContextKeys.textInputFocus, SuggestContext.AcceptSuggestionsOnEnter, SuggestContext.MakesTextEdit),
            weight,
        }],
    menuOpts: [{
            menuId: suggestWidgetStatusbarMenu,
            title: nls.localize('accept.insert', "Insert"),
            group: 'left',
            order: 1,
            when: SuggestContext.HasInsertAndReplaceRange.toNegated()
        }, {
            menuId: suggestWidgetStatusbarMenu,
            title: nls.localize('accept.insert', "Insert"),
            group: 'left',
            order: 1,
            when: ContextKeyExpr.and(SuggestContext.HasInsertAndReplaceRange, SuggestContext.InsertMode.isEqualTo('insert'))
        }, {
            menuId: suggestWidgetStatusbarMenu,
            title: nls.localize('accept.replace', "Replace"),
            group: 'left',
            order: 1,
            when: ContextKeyExpr.and(SuggestContext.HasInsertAndReplaceRange, SuggestContext.InsertMode.isEqualTo('replace'))
        }]
}));
registerEditorCommand(new SuggestCommand({
    id: 'acceptAlternativeSelectedSuggestion',
    precondition: ContextKeyExpr.and(SuggestContext.Visible, EditorContextKeys.textInputFocus, SuggestContext.HasFocusedSuggestion),
    kbOpts: {
        weight: weight,
        kbExpr: EditorContextKeys.textInputFocus,
        primary: 1024 /* KeyMod.Shift */ | 3 /* KeyCode.Enter */,
        secondary: [1024 /* KeyMod.Shift */ | 2 /* KeyCode.Tab */],
    },
    handler(x) {
        x.acceptSelectedSuggestion(false, true);
    },
    menuOpts: [{
            menuId: suggestWidgetStatusbarMenu,
            group: 'left',
            order: 2,
            when: ContextKeyExpr.and(SuggestContext.HasInsertAndReplaceRange, SuggestContext.InsertMode.isEqualTo('insert')),
            title: nls.localize('accept.replace', "Replace")
        }, {
            menuId: suggestWidgetStatusbarMenu,
            group: 'left',
            order: 2,
            when: ContextKeyExpr.and(SuggestContext.HasInsertAndReplaceRange, SuggestContext.InsertMode.isEqualTo('replace')),
            title: nls.localize('accept.insert', "Insert")
        }]
}));
// continue to support the old command
CommandsRegistry.registerCommandAlias('acceptSelectedSuggestionOnEnter', 'acceptSelectedSuggestion');
registerEditorCommand(new SuggestCommand({
    id: 'hideSuggestWidget',
    precondition: SuggestContext.Visible,
    handler: x => x.cancelSuggestWidget(),
    kbOpts: {
        weight: weight,
        kbExpr: EditorContextKeys.textInputFocus,
        primary: 9 /* KeyCode.Escape */,
        secondary: [1024 /* KeyMod.Shift */ | 9 /* KeyCode.Escape */]
    }
}));
registerEditorCommand(new SuggestCommand({
    id: 'selectNextSuggestion',
    precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
    handler: c => c.selectNextSuggestion(),
    kbOpts: {
        weight: weight,
        kbExpr: EditorContextKeys.textInputFocus,
        primary: 18 /* KeyCode.DownArrow */,
        secondary: [2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */],
        mac: { primary: 18 /* KeyCode.DownArrow */, secondary: [2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */, 256 /* KeyMod.WinCtrl */ | 44 /* KeyCode.KeyN */] }
    }
}));
registerEditorCommand(new SuggestCommand({
    id: 'selectNextPageSuggestion',
    precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
    handler: c => c.selectNextPageSuggestion(),
    kbOpts: {
        weight: weight,
        kbExpr: EditorContextKeys.textInputFocus,
        primary: 12 /* KeyCode.PageDown */,
        secondary: [2048 /* KeyMod.CtrlCmd */ | 12 /* KeyCode.PageDown */]
    }
}));
registerEditorCommand(new SuggestCommand({
    id: 'selectLastSuggestion',
    precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
    handler: c => c.selectLastSuggestion()
}));
registerEditorCommand(new SuggestCommand({
    id: 'selectPrevSuggestion',
    precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
    handler: c => c.selectPrevSuggestion(),
    kbOpts: {
        weight: weight,
        kbExpr: EditorContextKeys.textInputFocus,
        primary: 16 /* KeyCode.UpArrow */,
        secondary: [2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */],
        mac: { primary: 16 /* KeyCode.UpArrow */, secondary: [2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */, 256 /* KeyMod.WinCtrl */ | 46 /* KeyCode.KeyP */] }
    }
}));
registerEditorCommand(new SuggestCommand({
    id: 'selectPrevPageSuggestion',
    precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
    handler: c => c.selectPrevPageSuggestion(),
    kbOpts: {
        weight: weight,
        kbExpr: EditorContextKeys.textInputFocus,
        primary: 11 /* KeyCode.PageUp */,
        secondary: [2048 /* KeyMod.CtrlCmd */ | 11 /* KeyCode.PageUp */]
    }
}));
registerEditorCommand(new SuggestCommand({
    id: 'selectFirstSuggestion',
    precondition: ContextKeyExpr.and(SuggestContext.Visible, ContextKeyExpr.or(SuggestContext.MultipleSuggestions, SuggestContext.HasFocusedSuggestion.negate())),
    handler: c => c.selectFirstSuggestion()
}));
registerEditorCommand(new SuggestCommand({
    id: 'focusSuggestion',
    precondition: ContextKeyExpr.and(SuggestContext.Visible, SuggestContext.HasFocusedSuggestion.negate()),
    handler: x => x.focusSuggestion(),
    kbOpts: {
        weight: weight,
        kbExpr: EditorContextKeys.textInputFocus,
        primary: 2048 /* KeyMod.CtrlCmd */ | 10 /* KeyCode.Space */,
        secondary: [2048 /* KeyMod.CtrlCmd */ | 39 /* KeyCode.KeyI */],
        mac: { primary: 256 /* KeyMod.WinCtrl */ | 10 /* KeyCode.Space */, secondary: [2048 /* KeyMod.CtrlCmd */ | 39 /* KeyCode.KeyI */] }
    },
}));
registerEditorCommand(new SuggestCommand({
    id: 'focusAndAcceptSuggestion',
    precondition: ContextKeyExpr.and(SuggestContext.Visible, SuggestContext.HasFocusedSuggestion.negate()),
    handler: c => {
        c.focusSuggestion();
        c.acceptSelectedSuggestion(true, false);
    }
}));
registerEditorCommand(new SuggestCommand({
    id: 'toggleSuggestionDetails',
    precondition: ContextKeyExpr.and(SuggestContext.Visible, SuggestContext.HasFocusedSuggestion),
    handler: x => x.toggleSuggestionDetails(),
    kbOpts: {
        weight: weight,
        kbExpr: EditorContextKeys.textInputFocus,
        primary: 2048 /* KeyMod.CtrlCmd */ | 10 /* KeyCode.Space */,
        secondary: [2048 /* KeyMod.CtrlCmd */ | 39 /* KeyCode.KeyI */],
        mac: { primary: 256 /* KeyMod.WinCtrl */ | 10 /* KeyCode.Space */, secondary: [2048 /* KeyMod.CtrlCmd */ | 39 /* KeyCode.KeyI */] }
    },
    menuOpts: [{
            menuId: suggestWidgetStatusbarMenu,
            group: 'right',
            order: 1,
            when: ContextKeyExpr.and(SuggestContext.DetailsVisible, SuggestContext.CanResolve),
            title: nls.localize('detail.more', "Show Less")
        }, {
            menuId: suggestWidgetStatusbarMenu,
            group: 'right',
            order: 1,
            when: ContextKeyExpr.and(SuggestContext.DetailsVisible.toNegated(), SuggestContext.CanResolve),
            title: nls.localize('detail.less', "Show More")
        }]
}));
registerEditorCommand(new SuggestCommand({
    id: 'toggleExplainMode',
    precondition: SuggestContext.Visible,
    handler: x => x.toggleExplainMode(),
    kbOpts: {
        weight: 100 /* KeybindingWeight.EditorContrib */,
        primary: 2048 /* KeyMod.CtrlCmd */ | 90 /* KeyCode.Slash */,
    }
}));
registerEditorCommand(new SuggestCommand({
    id: 'toggleSuggestionFocus',
    precondition: SuggestContext.Visible,
    handler: x => x.toggleSuggestionFocus(),
    kbOpts: {
        weight: weight,
        kbExpr: EditorContextKeys.textInputFocus,
        primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 10 /* KeyCode.Space */,
        mac: { primary: 256 /* KeyMod.WinCtrl */ | 512 /* KeyMod.Alt */ | 10 /* KeyCode.Space */ }
    }
}));
//#region tab completions
registerEditorCommand(new SuggestCommand({
    id: 'insertBestCompletion',
    precondition: ContextKeyExpr.and(EditorContextKeys.textInputFocus, ContextKeyExpr.equals('config.editor.tabCompletion', 'on'), WordContextKey.AtEnd, SuggestContext.Visible.toNegated(), SuggestAlternatives.OtherSuggestions.toNegated(), SnippetController2.InSnippetMode.toNegated()),
    handler: (x, arg) => {
        x.triggerSuggestAndAcceptBest(isObject(arg) ? { fallback: 'tab', ...arg } : { fallback: 'tab' });
    },
    kbOpts: {
        weight,
        primary: 2 /* KeyCode.Tab */
    }
}));
registerEditorCommand(new SuggestCommand({
    id: 'insertNextSuggestion',
    precondition: ContextKeyExpr.and(EditorContextKeys.textInputFocus, ContextKeyExpr.equals('config.editor.tabCompletion', 'on'), SuggestAlternatives.OtherSuggestions, SuggestContext.Visible.toNegated(), SnippetController2.InSnippetMode.toNegated()),
    handler: x => x.acceptNextSuggestion(),
    kbOpts: {
        weight: weight,
        kbExpr: EditorContextKeys.textInputFocus,
        primary: 2 /* KeyCode.Tab */
    }
}));
registerEditorCommand(new SuggestCommand({
    id: 'insertPrevSuggestion',
    precondition: ContextKeyExpr.and(EditorContextKeys.textInputFocus, ContextKeyExpr.equals('config.editor.tabCompletion', 'on'), SuggestAlternatives.OtherSuggestions, SuggestContext.Visible.toNegated(), SnippetController2.InSnippetMode.toNegated()),
    handler: x => x.acceptPrevSuggestion(),
    kbOpts: {
        weight: weight,
        kbExpr: EditorContextKeys.textInputFocus,
        primary: 1024 /* KeyMod.Shift */ | 2 /* KeyCode.Tab */
    }
}));
registerEditorAction(class extends EditorAction {
    constructor() {
        super({
            id: 'editor.action.resetSuggestSize',
            label: nls.localize2('suggest.reset.label', "Reset Suggest Widget Size"),
            precondition: undefined
        });
    }
    run(_accessor, editor) {
        SuggestController.get(editor)?.resetWidgetSize();
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3VnZ2VzdENvbnRyb2xsZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvc3VnZ2VzdC9icm93c2VyL3N1Z2dlc3RDb250cm9sbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDakUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSx5QkFBeUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFbEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFlLGlCQUFpQixFQUFFLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzlILE9BQU8sS0FBSyxRQUFRLE1BQU0scUNBQXFDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDeEUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFakYsT0FBTyxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQW1DLG9CQUFvQixFQUFFLHFCQUFxQixFQUFFLDBCQUEwQixFQUFvQixNQUFNLHNDQUFzQyxDQUFDO0FBRS9NLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUN0RSxPQUFPLEVBQWEsUUFBUSxF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