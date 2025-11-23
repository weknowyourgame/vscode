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
import { localize } from '../../../../../../nls.js';
import { Emitter } from '../../../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../../../base/common/map.js';
import { EditorConfiguration } from '../../../../../../editor/browser/config/editorConfiguration.js';
import { CoreEditingCommands } from '../../../../../../editor/browser/coreCommands.js';
import { RedoCommand, UndoCommand } from '../../../../../../editor/browser/editorExtensions.js';
import { CodeEditorWidget } from '../../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { cursorBlinkingStyleFromString, cursorStyleFromString, TextEditorCursorStyle } from '../../../../../../editor/common/config/editorOptions.js';
import { Position } from '../../../../../../editor/common/core/position.js';
import { Selection } from '../../../../../../editor/common/core/selection.js';
import { USUAL_WORD_SEPARATORS } from '../../../../../../editor/common/core/wordHelper.js';
import { CommandExecutor, CursorsController } from '../../../../../../editor/common/cursor/cursor.js';
import { DeleteOperations } from '../../../../../../editor/common/cursor/cursorDeleteOperations.js';
import { CursorConfiguration } from '../../../../../../editor/common/cursorCommon.js';
import { ILanguageConfigurationService } from '../../../../../../editor/common/languages/languageConfigurationRegistry.js';
import { indentOfLine } from '../../../../../../editor/common/model/textModel.js';
import { ITextModelService } from '../../../../../../editor/common/services/resolverService.js';
import { ViewModelEventsCollector } from '../../../../../../editor/common/viewModelEventDispatcher.js';
import { IAccessibilityService } from '../../../../../../platform/accessibility/common/accessibility.js';
import { MenuId, registerAction2 } from '../../../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IUndoRedoService } from '../../../../../../platform/undoRedo/common/undoRedo.js';
import { registerWorkbenchContribution2 } from '../../../../../common/contributions.js';
import { IEditorService } from '../../../../../services/editor/common/editorService.js';
import { KEYBINDING_CONTEXT_NOTEBOOK_FIND_WIDGET_FOCUSED, NOTEBOOK_CELL_EDITOR_FOCUSED, NOTEBOOK_IS_ACTIVE_EDITOR } from '../../../common/notebookContextKeys.js';
import { NotebookAction } from '../../controller/coreActions.js';
import { getNotebookEditorFromEditorPane } from '../../notebookBrowser.js';
import { registerNotebookContribution } from '../../notebookEditorExtensions.js';
import { CellEditorOptions } from '../../view/cellParts/cellEditorOptions.js';
import { NotebookFindContrib } from '../find/notebookFindWidget.js';
import { NotebookCellTextModel } from '../../../common/model/notebookCellTextModel.js';
const NOTEBOOK_ADD_FIND_MATCH_TO_SELECTION_ID = 'notebook.addFindMatchToSelection';
const NOTEBOOK_SELECT_ALL_FIND_MATCHES_ID = 'notebook.selectAllFindMatches';
export var NotebookMultiCursorState;
(function (NotebookMultiCursorState) {
    NotebookMultiCursorState[NotebookMultiCursorState["Idle"] = 0] = "Idle";
    NotebookMultiCursorState[NotebookMultiCursorState["Selecting"] = 1] = "Selecting";
    NotebookMultiCursorState[NotebookMultiCursorState["Editing"] = 2] = "Editing";
})(NotebookMultiCursorState || (NotebookMultiCursorState = {}));
export const NOTEBOOK_MULTI_CURSOR_CONTEXT = {
    IsNotebookMultiCursor: new RawContextKey('isNotebookMultiSelect', false),
    NotebookMultiSelectCursorState: new RawContextKey('notebookMultiSelectCursorState', NotebookMultiCursorState.Idle),
};
let NotebookMultiCursorController = class NotebookMultiCursorController extends Disposable {
    static { this.id = 'notebook.multiCursorController'; }
    getState() {
        return this.state;
    }
    constructor(notebookEditor, contextKeyService, textModelService, languageConfigurationService, accessibilityService, configurationService, undoRedoService) {
        super();
        this.notebookEditor = notebookEditor;
        this.contextKeyService = contextKeyService;
        this.textModelService = textModelService;
        this.languageConfigurationService = languageConfigurationService;
        this.accessibilityService = accessibilityService;
        this.configurationService = configurationService;
        this.undoRedoService = undoRedoService;
        this.word = '';
        this.trackedCells = [];
        this.totalMatchesCount = 0;
        this._onDidChangeAnchorCell = this._register(new Emitter());
        this.onDidChangeAnchorCell = this._onDidChangeAnchorCell.event;
        this.anchorDisposables = this._register(new DisposableStore());
        this.cursorsDisposables = this._register(new DisposableStore());
        this.cursorsControllers = new ResourceMap();
        this.state = NotebookMultiCursorState.Idle;
        this._nbIsMultiSelectSession = NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor.bindTo(this.contextKeyService);
        this._nbMultiSelectState = NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.bindTo(this.contextKeyService);
        this.anchorCell = this.notebookEditor.activeCellAndCodeEditor;
        // anchor cell will catch and relay all type, cut, paste events to the cursors controllers
        // need to create new controllers when the anchor cell changes, then update their listeners
        // ** cursor controllers need to happen first, because anchor listeners relay to them
        this._register(this.onDidChangeAnchorCell(async () => {
            await this.syncCursorsControllers();
            this.syncAnchorListeners();
        }));
    }
    syncAnchorListeners() {
        this.anchorDisposables.clear();
        if (!this.anchorCell) {
            throw new Error('Anchor cell is undefined');
        }
        // typing
        this.anchorDisposables.add(this.anchorCell[1].onWillType((input) => {
            const collector = new ViewModelEventsCollector();
            this.trackedCells.forEach(cell => {
                const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
                if (!controller) {
                    // should not happen
                    return;
                }
                if (cell.cellViewModel.handle !== this.anchorCell?.[0].handle) { // don't relay to active cell, already has a controller for typing
                    controller.type(collector, input, 'keyboard');
                }
            });
        }));
        this.anchorDisposables.add(this.anchorCell[1].onDidType(() => {
            this.state = NotebookMultiCursorState.Editing; // typing will continue to work as normal across ranges, just preps for another cmd+d
            this._nbMultiSelectState.set(NotebookMultiCursorState.Editing);
            const anchorController = this.cursorsControllers.get(this.anchorCell[0].uri);
            if (!anchorController) {
                return;
            }
            const activeSelections = this.notebookEditor.activeCodeEditor?.getSelections();
            if (!activeSelections) {
                return;
            }
            // need to keep anchor cursor controller in sync manually (for delete usage), since we don't relay type event to it
            anchorController.setSelections(new ViewModelEventsCollector(), 'keyboard', activeSelections, 3 /* CursorChangeReason.Explicit */);
            this.trackedCells.forEach(cell => {
                const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
                if (!controller) {
                    return;
                }
                // this is used upon exiting the multicursor session to set the selections back to the correct cursor state
                cell.initialSelection = controller.getSelection();
                // clear tracked selection data as it is invalid once typing begins
                cell.matchSelections = [];
            });
            this.updateLazyDecorations();
        }));
        // arrow key navigation
        this.anchorDisposables.add(this.anchorCell[1].onDidChangeCursorSelection((e) => {
            if (e.source === 'mouse') {
                this.resetToIdleState();
                return;
            }
            // ignore this event if it was caused by a typing event or a delete (NotSet and RecoverFromMarkers respectively)
            if (!e.oldSelections || e.reason === 0 /* CursorChangeReason.NotSet */ || e.reason === 2 /* CursorChangeReason.RecoverFromMarkers */) {
                return;
            }
            const translation = {
                deltaStartCol: e.selection.startColumn - e.oldSelections[0].startColumn,
                deltaStartLine: e.selection.startLineNumber - e.oldSelections[0].startLineNumber,
                deltaEndCol: e.selection.endColumn - e.oldSelections[0].endColumn,
                deltaEndLine: e.selection.endLineNumber - e.oldSelections[0].endLineNumber,
            };
            const translationDir = e.selection.getDirection();
            this.trackedCells.forEach(cell => {
                const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
                if (!controller) {
                    return;
                }
                const newSelections = controller.getSelections().map(selection => {
                    const newStartCol = selection.startColumn + translation.deltaStartCol;
                    const newStartLine = selection.startLineNumber + translation.deltaStartLine;
                    const newEndCol = selection.endColumn + translation.deltaEndCol;
                    const newEndLine = selection.endLineNumber + translation.deltaEndLine;
                    return Selection.createWithDirection(newStartLine, newStartCol, newEndLine, newEndCol, translationDir);
                });
                controller.setSelections(new ViewModelEventsCollector(), e.source, newSelections, 3 /* CursorChangeReason.Explicit */);
            });
            this.updateLazyDecorations();
        }));
        // core actions
        this.anchorDisposables.add(this.anchorCell[1].onWillTriggerEditorOperationEvent((e) => {
            this.handleEditorOperationEvent(e);
        }));
        // exit mode
        this.anchorDisposables.add(this.anchorCell[1].onDidBlurEditorWidget(() => {
            if (this.state === NotebookMultiCursorState.Selecting || this.state === NotebookMultiCursorState.Editing) {
                this.resetToIdleState();
            }
        }));
    }
    async syncCursorsControllers() {
        this.cursorsDisposables.clear(); // TODO: dial this back for perf and just update the relevant controllers
        await Promise.all(this.trackedCells.map(async (cell) => {
            const controller = await this.createCursorController(cell);
            if (!controller) {
                return;
            }
            this.cursorsControllers.set(cell.cellViewModel.uri, controller);
            const selections = cell.matchSelections;
            controller.setSelections(new ViewModelEventsCollector(), undefined, selections, 3 /* CursorChangeReason.Explicit */);
        }));
        this.updateLazyDecorations();
    }
    async createCursorController(cell) {
        const textModelRef = await this.textModelService.createModelReference(cell.cellViewModel.uri);
        const textModel = textModelRef.object.textEditorModel;
        if (!textModel) {
            return undefined;
        }
        const cursorSimpleModel = this.constructCursorSimpleModel(cell.cellViewModel);
        const converter = this.constructCoordinatesConverter();
        const editorConfig = cell.editorConfig;
        const controller = this.cursorsDisposables.add(new CursorsController(textModel, cursorSimpleModel, converter, new CursorConfiguration(textModel.getLanguageId(), textModel.getOptions(), editorConfig, this.languageConfigurationService)));
        controller.setSelections(new ViewModelEventsCollector(), undefined, cell.matchSelections, 3 /* CursorChangeReason.Explicit */);
        return controller;
    }
    constructCoordinatesConverter() {
        return {
            convertViewPositionToModelPosition(viewPosition) {
                return viewPosition;
            },
            convertViewRangeToModelRange(viewRange) {
                return viewRange;
            },
            validateViewPosition(viewPosition, expectedModelPosition) {
                return viewPosition;
            },
            validateViewRange(viewRange, expectedModelRange) {
                return viewRange;
            },
            convertModelPositionToViewPosition(modelPosition, affinity, allowZeroLineNumber, belowHiddenRanges) {
                return modelPosition;
            },
            convertModelRangeToViewRange(modelRange, affinity) {
                return modelRange;
            },
            modelPositionIsVisible(modelPosition) {
                return true;
            },
            getModelLineViewLineCount(modelLineNumber) {
                return 1;
            },
            getViewLineNumberOfModelPosition(modelLineNumber, modelColumn) {
                return modelLineNumber;
            }
        };
    }
    constructCursorSimpleModel(cell) {
        return {
            getLineCount() {
                return cell.textBuffer.getLineCount();
            },
            getLineContent(lineNumber) {
                return cell.textBuffer.getLineContent(lineNumber);
            },
            getLineMinColumn(lineNumber) {
                return cell.textBuffer.getLineMinColumn(lineNumber);
            },
            getLineMaxColumn(lineNumber) {
                return cell.textBuffer.getLineMaxColumn(lineNumber);
            },
            getLineFirstNonWhitespaceColumn(lineNumber) {
                return cell.textBuffer.getLineFirstNonWhitespaceColumn(lineNumber);
            },
            getLineLastNonWhitespaceColumn(lineNumber) {
                return cell.textBuffer.getLineLastNonWhitespaceColumn(lineNumber);
            },
            normalizePosition(position, affinity) {
                return position;
            },
            getLineIndentColumn(lineNumber) {
                return indentOfLine(cell.textBuffer.getLineContent(lineNumber)) + 1;
            }
        };
    }
    handleEditorOperationEvent(e) {
        this.trackedCells.forEach(cell => {
            if (cell.cellViewModel.handle === this.anchorCell?.[0].handle) {
                return;
            }
            const eventsCollector = new ViewModelEventsCollector();
            const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
            if (!controller) {
                return;
            }
            this.executeEditorOperation(controller, eventsCollector, e);
        });
    }
    executeEditorOperation(controller, eventsCollector, e) {
        switch (e.handlerId) {
            case "compositionStart" /* Handler.CompositionStart */:
                controller.startComposition(eventsCollector);
                break;
            case "compositionEnd" /* Handler.CompositionEnd */:
                controller.endComposition(eventsCollector, e.source);
                break;
            case "replacePreviousChar" /* Handler.ReplacePreviousChar */: {
                const args = e.payload;
                controller.compositionType(eventsCollector, args.text || '', args.replaceCharCnt || 0, 0, 0, e.source);
                break;
            }
            case "compositionType" /* Handler.CompositionType */: {
                const args = e.payload;
                controller.compositionType(eventsCollector, args.text || '', args.replacePrevCharCnt || 0, args.replaceNextCharCnt || 0, args.positionDelta || 0, e.source);
                break;
            }
            case "paste" /* Handler.Paste */: {
                const args = e.payload;
                controller.paste(eventsCollector, args.text || '', args.pasteOnNewLine || false, args.multicursorText || null, e.source);
                break;
            }
            case "cut" /* Handler.Cut */:
                controller.cut(eventsCollector, e.source);
                break;
        }
    }
    updateViewModelSelections() {
        for (const cell of this.trackedCells) {
            const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
            if (!controller) {
                // should not happen
                return;
            }
            cell.cellViewModel.setSelections(controller.getSelections());
        }
    }
    updateFinalUndoRedo() {
        const anchorCellModel = this.anchorCell?.[1].getModel();
        if (!anchorCellModel) {
            // should not happen
            return;
        }
        const newElementsMap = new ResourceMap();
        const resources = [];
        this.trackedCells.forEach(trackedMatch => {
            const undoRedoState = trackedMatch.undoRedoHistory;
            if (!undoRedoState) {
                return;
            }
            resources.push(trackedMatch.cellViewModel.uri);
            const currentPastElements = this.undoRedoService.getElements(trackedMatch.cellViewModel.uri).past.slice();
            const oldPastElements = trackedMatch.undoRedoHistory.past.slice();
            const newElements = currentPastElements.slice(oldPastElements.length);
            if (newElements.length === 0) {
                return;
            }
            newElementsMap.set(trackedMatch.cellViewModel.uri, newElements);
            this.undoRedoService.removeElements(trackedMatch.cellViewModel.uri);
            oldPastElements.forEach(element => {
                this.undoRedoService.pushElement(element);
            });
        });
        this.undoRedoService.pushElement({
            type: 1 /* UndoRedoElementType.Workspace */,
            resources: resources,
            label: 'Multi Cursor Edit',
            code: 'multiCursorEdit',
            confirmBeforeUndo: false,
            undo: async () => {
                newElementsMap.forEach(async (value) => {
                    value.reverse().forEach(async (element) => {
                        await element.undo();
                    });
                });
            },
            redo: async () => {
                newElementsMap.forEach(async (value) => {
                    value.forEach(async (element) => {
                        await element.redo();
                    });
                });
            }
        });
    }
    resetToIdleState() {
        this.state = NotebookMultiCursorState.Idle;
        this._nbMultiSelectState.set(NotebookMultiCursorState.Idle);
        this._nbIsMultiSelectSession.set(false);
        this.updateFinalUndoRedo();
        this.trackedCells.forEach(cell => {
            this.clearDecorations(cell);
            cell.cellViewModel.setSelections([cell.initialSelection]); // correct cursor placement upon exiting cmd-d session
        });
        this.anchorDisposables.clear();
        this.anchorCell = undefined;
        this.cursorsDisposables.clear();
        this.cursorsControllers.clear();
        this.trackedCells = [];
        this.totalMatchesCount = 0;
        this.startPosition = undefined;
        this.word = '';
    }
    async findAndTrackNextSelection(focusedCell) {
        if (this.state === NotebookMultiCursorState.Idle) { // move cursor to end of the symbol + track it, transition to selecting state
            const textModel = focusedCell.textModel;
            if (!textModel) {
                return;
            }
            const inputSelection = focusedCell.getSelections()[0];
            const word = this.getWord(inputSelection, textModel);
            if (!word) {
                return;
            }
            this.word = word.word;
            // Record the total number of matches at the beginning of the selection process for performance
            const notebookTextModel = this.notebookEditor.textModel;
            if (notebookTextModel) {
                const allMatches = notebookTextModel.findMatches(this.word, false, true, USUAL_WORD_SEPARATORS);
                this.totalMatchesCount = allMatches.reduce((sum, cellMatch) => sum + cellMatch.matches.length, 0);
            }
            const index = this.notebookEditor.getCellIndex(focusedCell);
            if (index === undefined) {
                return;
            }
            this.startPosition = {
                cellIndex: index,
                position: new Position(inputSelection.startLineNumber, word.startColumn),
            };
            const newSelection = new Selection(inputSelection.startLineNumber, word.startColumn, inputSelection.startLineNumber, word.endColumn);
            focusedCell.setSelections([newSelection]);
            this.anchorCell = this.notebookEditor.activeCellAndCodeEditor;
            if (!this.anchorCell || this.anchorCell[0].handle !== focusedCell.handle) {
                throw new Error('Active cell is not the same as the cell passed as context');
            }
            if (!(this.anchorCell[1] instanceof CodeEditorWidget)) {
                throw new Error('Active cell is not an instance of CodeEditorWidget');
            }
            await this.updateTrackedCell(focusedCell, [newSelection]);
            this._nbIsMultiSelectSession.set(true);
            this.state = NotebookMultiCursorState.Selecting;
            this._nbMultiSelectState.set(NotebookMultiCursorState.Selecting);
            this._onDidChangeAnchorCell.fire();
        }
        else if (this.state === NotebookMultiCursorState.Selecting) { // use the word we stored from idle state transition to find next match, track it
            const notebookTextModel = this.notebookEditor.textModel;
            if (!notebookTextModel) {
                return; // should not happen
            }
            const index = this.notebookEditor.getCellIndex(focusedCell);
            if (index === undefined) {
                return; // should not happen
            }
            if (!this.startPosition) {
                return; // should not happen
            }
            // Check if all matches are already covered by selections to avoid infinite looping
            const totalSelections = this.trackedCells.reduce((sum, trackedCell) => sum + trackedCell.matchSelections.length, 0);
            if (totalSelections >= this.totalMatchesCount) {
                // All matches are already selected, make this a no-op like in regular editors
                return;
            }
            const findResult = notebookTextModel.findNextMatch(this.word, { cellIndex: index, position: focusedCell.getSelections()[focusedCell.getSelections().length - 1].getEndPosition() }, false, true, USUAL_WORD_SEPARATORS, this.startPosition);
            if (!findResult) {
                return;
            }
            const findResultCellViewModel = this.notebookEditor.getCellByHandle(findResult.cell.handle);
            if (!findResultCellViewModel) {
                return;
            }
            if (findResult.cell.handle === focusedCell.handle) { // match is in the same cell, find tracked entry, update and set selections in viewmodel and cursorController
                const selections = [...focusedCell.getSelections(), Selection.fromRange(findResult.match.range, 0 /* SelectionDirection.LTR */)];
                const trackedCell = await this.updateTrackedCell(focusedCell, selections);
                findResultCellViewModel.setSelections(trackedCell.matchSelections);
            }
            else if (findResult.cell.handle !== focusedCell.handle) { // result is in a different cell, move focus there and apply selection, then update anchor
                await this.notebookEditor.revealRangeInViewAsync(findResultCellViewModel, findResult.match.range);
                await this.notebookEditor.focusNotebookCell(findResultCellViewModel, 'editor');
                const trackedCell = await this.updateTrackedCell(findResultCellViewModel, [Selection.fromRange(findResult.match.range, 0 /* SelectionDirection.LTR */)]);
                findResultCellViewModel.setSelections(trackedCell.matchSelections);
                this.anchorCell = this.notebookEditor.activeCellAndCodeEditor;
                if (!this.anchorCell || !(this.anchorCell[1] instanceof CodeEditorWidget)) {
                    throw new Error('Active cell is not an instance of CodeEditorWidget');
                }
                this._onDidChangeAnchorCell.fire();
                // we set the decorations manually for the cell we have just departed, since it blurs
                // we can find the match with the handle that the find and track request originated
                this.initializeMultiSelectDecorations(this.trackedCells.find(trackedCell => trackedCell.cellViewModel.handle === focusedCell.handle));
            }
        }
    }
    async selectAllMatches(focusedCell, matches) {
        const notebookTextModel = this.notebookEditor.textModel;
        if (!notebookTextModel) {
            return; // should not happen
        }
        if (matches) {
            await this.handleFindWidgetSelectAllMatches(matches);
        }
        else {
            await this.handleCellEditorSelectAllMatches(notebookTextModel, focusedCell);
        }
        await this.syncCursorsControllers();
        this.syncAnchorListeners();
        this.updateLazyDecorations();
    }
    async handleFindWidgetSelectAllMatches(matches) {
        // TODO: support selecting state maybe. UX could get confusing since selecting state could be hit via ctrl+d which would have different filters (case sensetive + whole word)
        if (this.state !== NotebookMultiCursorState.Idle) {
            return;
        }
        if (!matches.length) {
            return;
        }
        await this.notebookEditor.focusNotebookCell(matches[0].cell, 'editor');
        this.anchorCell = this.notebookEditor.activeCellAndCodeEditor;
        this.trackedCells = [];
        for (const match of matches) {
            this.updateTrackedCell(match.cell, match.contentMatches.map(match => Selection.fromRange(match.range, 0 /* SelectionDirection.LTR */)));
            if (this.anchorCell && match.cell.handle === this.anchorCell[0].handle) {
                // only explicitly set the focused cell's selections, the rest are handled by cursor controllers + decorations
                match.cell.setSelections(match.contentMatches.map(match => Selection.fromRange(match.range, 0 /* SelectionDirection.LTR */)));
            }
        }
        this._nbIsMultiSelectSession.set(true);
        this.state = NotebookMultiCursorState.Selecting;
        this._nbMultiSelectState.set(NotebookMultiCursorState.Selecting);
    }
    async handleCellEditorSelectAllMatches(notebookTextModel, focusedCell) {
        // can be triggered mid multiselect session, or from idle state
        if (this.state === NotebookMultiCursorState.Idle) {
            // get word from current selection + rest of notebook objects
            const textModel = focusedCell.textModel;
            if (!textModel) {
                return;
            }
            const inputSelection = focusedCell.getSelections()[0];
            const word = this.getWord(inputSelection, textModel);
            if (!word) {
                return;
            }
            this.word = word.word;
            const index = this.notebookEditor.getCellIndex(focusedCell);
            if (index === undefined) {
                return;
            }
            this.startPosition = {
                cellIndex: index,
                position: new Position(inputSelection.startLineNumber, word.startColumn),
            };
            this.anchorCell = this.notebookEditor.activeCellAndCodeEditor;
            if (!this.anchorCell || this.anchorCell[0].handle !== focusedCell.handle) {
                throw new Error('Active cell is not the same as the cell passed as context');
            }
            if (!(this.anchorCell[1] instanceof CodeEditorWidget)) {
                throw new Error('Active cell is not an instance of CodeEditorWidget');
            }
            // get all matches in the notebook
            const findResults = notebookTextModel.findMatches(this.word, false, true, USUAL_WORD_SEPARATORS);
            // create the tracked matches for every result, needed for cursor controllers
            this.trackedCells = [];
            for (const res of findResults) {
                await this.updateTrackedCell(res.cell, res.matches.map(match => Selection.fromRange(match.range, 0 /* SelectionDirection.LTR */)));
                if (res.cell.handle === focusedCell.handle) {
                    const cellViewModel = this.notebookEditor.getCellByHandle(res.cell.handle);
                    if (cellViewModel) {
                        cellViewModel.setSelections(res.matches.map(match => Selection.fromRange(match.range, 0 /* SelectionDirection.LTR */)));
                    }
                }
            }
            this._nbIsMultiSelectSession.set(true);
            this.state = NotebookMultiCursorState.Selecting;
            this._nbMultiSelectState.set(NotebookMultiCursorState.Selecting);
        }
        else if (this.state === NotebookMultiCursorState.Selecting) {
            // we will already have a word + some number of tracked matches, need to update them with the rest given findAllMatches result
            const findResults = notebookTextModel.findMatches(this.word, false, true, USUAL_WORD_SEPARATORS);
            // update existing tracked matches with new selections and create new tracked matches for cells that aren't tracked yet
            for (const res of findResults) {
                await this.updateTrackedCell(res.cell, res.matches.map(match => Selection.fromRange(match.range, 0 /* SelectionDirection.LTR */)));
            }
        }
    }
    async updateTrackedCell(cell, selections) {
        const cellViewModel = cell instanceof NotebookCellTextModel ? this.notebookEditor.getCellByHandle(cell.handle) : cell;
        if (!cellViewModel) {
            throw new Error('Cell not found');
        }
        let trackedMatch = this.trackedCells.find(trackedCell => trackedCell.cellViewModel.handle === cellViewModel.handle);
        if (trackedMatch) {
            this.clearDecorations(trackedMatch); // need this to avoid leaking decorations -- TODO: just optimize the lazy decorations fn
            trackedMatch.matchSelections = selections;
        }
        else {
            const initialSelection = cellViewModel.getSelections()[0];
            const textModel = await cellViewModel.resolveTextModel();
            textModel.pushStackElement();
            const editorConfig = this.constructCellEditorOptions(cellViewModel);
            const rawEditorOptions = editorConfig.getRawOptions();
            const cursorConfig = {
                cursorStyle: cursorStyleFromString(rawEditorOptions.cursorStyle),
                cursorBlinking: cursorBlinkingStyleFromString(rawEditorOptions.cursorBlinking),
                cursorSmoothCaretAnimation: rawEditorOptions.cursorSmoothCaretAnimation
            };
            trackedMatch = {
                cellViewModel: cellViewModel,
                initialSelection: initialSelection,
                matchSelections: selections,
                editorConfig: editorConfig,
                cursorConfig: cursorConfig,
                decorationIds: [],
                undoRedoHistory: this.undoRedoService.getElements(cellViewModel.uri)
            };
            this.trackedCells.push(trackedMatch);
        }
        return trackedMatch;
    }
    async deleteLeft() {
        this.trackedCells.forEach(cell => {
            const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
            if (!controller) {
                // should not happen
                return;
            }
            const [, commands] = DeleteOperations.deleteLeft(controller.getPrevEditOperationType(), controller.context.cursorConfig, controller.context.model, controller.getSelections(), controller.getAutoClosedCharacters());
            const delSelections = CommandExecutor.executeCommands(controller.context.model, controller.getSelections(), commands);
            if (!delSelections) {
                return;
            }
            controller.setSelections(new ViewModelEventsCollector(), undefined, delSelections, 3 /* CursorChangeReason.Explicit */);
        });
        this.updateLazyDecorations();
    }
    async deleteRight() {
        this.trackedCells.forEach(cell => {
            const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
            if (!controller) {
                // should not happen
                return;
            }
            const [, commands] = DeleteOperations.deleteRight(controller.getPrevEditOperationType(), controller.context.cursorConfig, controller.context.model, controller.getSelections());
            if (cell.cellViewModel.handle !== this.anchorCell?.[0].handle) {
                const delSelections = CommandExecutor.executeCommands(controller.context.model, controller.getSelections(), commands);
                if (!delSelections) {
                    return;
                }
                controller.setSelections(new ViewModelEventsCollector(), undefined, delSelections, 3 /* CursorChangeReason.Explicit */);
            }
            else {
                // get the selections from the viewmodel since we run the command manually (for cursor decoration reasons)
                controller.setSelections(new ViewModelEventsCollector(), undefined, cell.cellViewModel.getSelections(), 3 /* CursorChangeReason.Explicit */);
            }
        });
        this.updateLazyDecorations();
    }
    async undo() {
        const models = [];
        for (const cell of this.trackedCells) {
            const model = await cell.cellViewModel.resolveTextModel();
            if (model) {
                models.push(model);
            }
        }
        await Promise.all(models.map(model => model.undo()));
        this.updateViewModelSelections();
        this.updateLazyDecorations();
    }
    async redo() {
        const models = [];
        for (const cell of this.trackedCells) {
            const model = await cell.cellViewModel.resolveTextModel();
            if (model) {
                models.push(model);
            }
        }
        await Promise.all(models.map(model => model.redo()));
        this.updateViewModelSelections();
        this.updateLazyDecorations();
    }
    constructCellEditorOptions(cell) {
        const cellEditorOptions = new CellEditorOptions(this.notebookEditor.getBaseCellEditorOptions(cell.language), this.notebookEditor.notebookOptions, this.configurationService);
        const options = cellEditorOptions.getUpdatedValue(cell.internalMetadata, cell.uri);
        cellEditorOptions.dispose();
        return new EditorConfiguration(false, MenuId.EditorContent, options, null, this.accessibilityService);
    }
    /**
     * Updates the multicursor selection decorations for a specific matched cell
     *
     * @param cell -- match object containing the viewmodel + selections
     */
    initializeMultiSelectDecorations(cell) {
        if (!cell) {
            return;
        }
        const decorations = [];
        cell.matchSelections.forEach(selection => {
            // mock cursor at the end of the selection
            decorations.push({
                range: Selection.fromPositions(selection.getEndPosition()),
                options: {
                    description: '',
                    className: this.getClassName(cell.cursorConfig, true),
                }
            });
        });
        cell.decorationIds = cell.cellViewModel.deltaModelDecorations(cell.decorationIds, decorations);
    }
    updateLazyDecorations() {
        this.trackedCells.forEach(cell => {
            if (cell.cellViewModel.handle === this.anchorCell?.[0].handle) {
                return;
            }
            const controller = this.cursorsControllers.get(cell.cellViewModel.uri);
            if (!controller) {
                // should not happen
                return;
            }
            const selections = controller.getSelections();
            const newDecorations = [];
            selections?.map(selection => {
                const isEmpty = selection.isEmpty();
                if (!isEmpty) {
                    // selection decoration (shift+arrow, etc)
                    newDecorations.push({
                        range: selection,
                        options: {
                            description: '',
                            className: this.getClassName(cell.cursorConfig, false),
                        }
                    });
                }
                // mock cursor at the end of the selection
                newDecorations.push({
                    range: Selection.fromPositions(selection.getPosition()),
                    options: {
                        description: '',
                        zIndex: 10000,
                        className: this.getClassName(cell.cursorConfig, true),
                    }
                });
            });
            cell.decorationIds = cell.cellViewModel.deltaModelDecorations(cell.decorationIds, newDecorations);
        });
    }
    clearDecorations(cell) {
        cell.decorationIds = cell.cellViewModel.deltaModelDecorations(cell.decorationIds, []);
    }
    getWord(selection, model) {
        const lineNumber = selection.startLineNumber;
        const startColumn = selection.startColumn;
        if (model.isDisposed()) {
            return null;
        }
        return model.getWordAtPosition({
            lineNumber: lineNumber,
            column: startColumn
        });
    }
    getClassName(cursorConfig, isCursor) {
        let result = isCursor ? '.nb-multicursor-cursor' : '.nb-multicursor-selection';
        if (isCursor) {
            // handle base style
            switch (cursorConfig.cursorStyle) {
                case TextEditorCursorStyle.Line:
                    break; // default style, no additional class needed (handled by base css style)
                case TextEditorCursorStyle.Block:
                    result += '.nb-cursor-block-style';
                    break;
                case TextEditorCursorStyle.Underline:
                    result += '.nb-cursor-underline-style';
                    break;
                case TextEditorCursorStyle.LineThin:
                    result += '.nb-cursor-line-thin-style';
                    break;
                case TextEditorCursorStyle.BlockOutline:
                    result += '.nb-cursor-block-outline-style';
                    break;
                case TextEditorCursorStyle.UnderlineThin:
                    result += '.nb-cursor-underline-thin-style';
                    break;
                default:
                    break;
            }
            // handle animation style
            switch (cursorConfig.cursorBlinking) {
                case 1 /* TextEditorCursorBlinkingStyle.Blink */:
                    result += '.nb-blink';
                    break;
                case 2 /* TextEditorCursorBlinkingStyle.Smooth */:
                    result += '.nb-smooth';
                    break;
                case 3 /* TextEditorCursorBlinkingStyle.Phase */:
                    result += '.nb-phase';
                    break;
                case 4 /* TextEditorCursorBlinkingStyle.Expand */:
                    result += '.nb-expand';
                    break;
                case 5 /* TextEditorCursorBlinkingStyle.Solid */:
                    result += '.nb-solid';
                    break;
                default:
                    result += '.nb-solid';
                    break;
            }
            // handle caret animation style
            if (cursorConfig.cursorSmoothCaretAnimation === 'on' || cursorConfig.cursorSmoothCaretAnimation === 'explicit') {
                result += '.nb-smooth-caret-animation';
            }
        }
        return result;
    }
    dispose() {
        super.dispose();
        this.anchorDisposables.dispose();
        this.cursorsDisposables.dispose();
        this.trackedCells.forEach(cell => {
            this.clearDecorations(cell);
        });
        this.trackedCells = [];
    }
};
NotebookMultiCursorController = __decorate([
    __param(1, IContextKeyService),
    __param(2, ITextModelService),
    __param(3, ILanguageConfigurationService),
    __param(4, IAccessibilityService),
    __param(5, IConfigurationService),
    __param(6, IUndoRedoService)
], NotebookMultiCursorController);
export { NotebookMultiCursorController };
class NotebookSelectAllFindMatches extends NotebookAction {
    constructor() {
        super({
            id: NOTEBOOK_SELECT_ALL_FIND_MATCHES_ID,
            title: localize('selectAllFindMatches', "Select All Occurrences of Find Match"),
            precondition: ContextKeyExpr.and(ContextKeyExpr.equals('config.notebook.multiCursor.enabled', true)),
            keybinding: {
                when: ContextKeyExpr.or(ContextKeyExpr.and(ContextKeyExpr.equals('config.notebook.multiCursor.enabled', true), NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_CELL_EDITOR_FOCUSED), ContextKeyExpr.and(ContextKeyExpr.equals('config.notebook.multiCursor.enabled', true), KEYBINDING_CONTEXT_NOTEBOOK_FIND_WIDGET_FOCUSED)),
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 42 /* KeyCode.KeyL */,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */
            }
        });
    }
    async runWithContext(accessor, context) {
        const editorService = accessor.get(IEditorService);
        const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
        if (!editor) {
            return;
        }
        if (!context.cell) {
            return;
        }
        const cursorController = editor.getContribution(NotebookMultiCursorController.id);
        const findController = editor.getContribution(NotebookFindContrib.id);
        if (findController.widget.isFocused) {
            const findModel = findController.widget.findModel;
            cursorController.selectAllMatches(context.cell, findModel.findMatches);
        }
        else {
            cursorController.selectAllMatches(context.cell);
        }
    }
}
class NotebookAddMatchToMultiSelectionAction extends NotebookAction {
    constructor() {
        super({
            id: NOTEBOOK_ADD_FIND_MATCH_TO_SELECTION_ID,
            title: localize('addFindMatchToSelection', "Add Selection to Next Find Match"),
            precondition: ContextKeyExpr.and(ContextKeyExpr.equals('config.notebook.multiCursor.enabled', true), NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_CELL_EDITOR_FOCUSED),
            keybinding: {
                when: ContextKeyExpr.and(ContextKeyExpr.equals('config.notebook.multiCursor.enabled', true), NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_CELL_EDITOR_FOCUSED),
                primary: 2048 /* KeyMod.CtrlCmd */ | 34 /* KeyCode.KeyD */,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */
            }
        });
    }
    async runWithContext(accessor, context) {
        const editorService = accessor.get(IEditorService);
        const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
        if (!editor) {
            return;
        }
        if (!context.cell) {
            return;
        }
        const controller = editor.getContribution(NotebookMultiCursorController.id);
        controller.findAndTrackNextSelection(context.cell);
    }
}
class NotebookExitMultiSelectionAction extends NotebookAction {
    constructor() {
        super({
            id: 'noteMultiCursor.exit',
            title: localize('exitMultiSelection', "Exit Multi Cursor Mode"),
            precondition: ContextKeyExpr.and(ContextKeyExpr.equals('config.notebook.multiCursor.enabled', true), NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor),
            keybinding: {
                when: ContextKeyExpr.and(ContextKeyExpr.equals('config.notebook.multiCursor.enabled', true), NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor),
                primary: 9 /* KeyCode.Escape */,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */
            }
        });
    }
    async runWithContext(accessor, context) {
        const editorService = accessor.get(IEditorService);
        const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
        if (!editor) {
            return;
        }
        const controller = editor.getContribution(NotebookMultiCursorController.id);
        controller.resetToIdleState();
    }
}
class NotebookDeleteLeftMultiSelectionAction extends NotebookAction {
    constructor() {
        super({
            id: 'noteMultiCursor.deleteLeft',
            title: localize('deleteLeftMultiSelection', "Delete Left"),
            precondition: ContextKeyExpr.and(ContextKeyExpr.equals('config.notebook.multiCursor.enabled', true), NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor, ContextKeyExpr.or(NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(NotebookMultiCursorState.Selecting), NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(NotebookMultiCursorState.Editing))),
            keybinding: {
                when: ContextKeyExpr.and(ContextKeyExpr.equals('config.notebook.multiCursor.enabled', true), NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor, ContextKeyExpr.or(NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(NotebookMultiCursorState.Selecting), NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(NotebookMultiCursorState.Editing))),
                primary: 1 /* KeyCode.Backspace */,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */
            }
        });
    }
    async runWithContext(accessor, context) {
        const editorService = accessor.get(IEditorService);
        const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
        if (!editor) {
            return;
        }
        const controller = editor.getContribution(NotebookMultiCursorController.id);
        controller.deleteLeft();
    }
}
class NotebookDeleteRightMultiSelectionAction extends NotebookAction {
    constructor() {
        super({
            id: 'noteMultiCursor.deleteRight',
            title: localize('deleteRightMultiSelection', "Delete Right"),
            precondition: ContextKeyExpr.and(ContextKeyExpr.equals('config.notebook.multiCursor.enabled', true), NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor, ContextKeyExpr.or(NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(NotebookMultiCursorState.Selecting), NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(NotebookMultiCursorState.Editing))),
            keybinding: {
                when: ContextKeyExpr.and(ContextKeyExpr.equals('config.notebook.multiCursor.enabled', true), NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor, ContextKeyExpr.or(NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(NotebookMultiCursorState.Selecting), NOTEBOOK_MULTI_CURSOR_CONTEXT.NotebookMultiSelectCursorState.isEqualTo(NotebookMultiCursorState.Editing))),
                primary: 20 /* KeyCode.Delete */,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */
            }
        });
    }
    async runWithContext(accessor, context) {
        const editorService = accessor.get(IEditorService);
        const nbEditor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
        if (!nbEditor) {
            return;
        }
        const cellEditor = nbEditor.activeCodeEditor;
        if (!cellEditor) {
            return;
        }
        // need to run the command manually since we are overriding the command, this ensures proper cursor animation behavior
        CoreEditingCommands.DeleteRight.runEditorCommand(accessor, cellEditor, null);
        const controller = nbEditor.getContribution(NotebookMultiCursorController.id);
        controller.deleteRight();
    }
}
let NotebookMultiCursorUndoRedoContribution = class NotebookMultiCursorUndoRedoContribution extends Disposable {
    static { this.ID = 'workbench.contrib.notebook.multiCursorUndoRedo'; }
    constructor(_editorService, configurationService) {
        super();
        this._editorService = _editorService;
        this.configurationService = configurationService;
        if (!this.configurationService.getValue('notebook.multiCursor.enabled')) {
            return;
        }
        const PRIORITY = 10005;
        this._register(UndoCommand.addImplementation(PRIORITY, 'notebook-multicursor-undo-redo', () => {
            const editor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
            if (!editor) {
                return false;
            }
            if (!editor.hasModel()) {
                return false;
            }
            const controller = editor.getContribution(NotebookMultiCursorController.id);
            return controller.undo();
        }, ContextKeyExpr.and(ContextKeyExpr.equals('config.notebook.multiCursor.enabled', true), NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor)));
        this._register(RedoCommand.addImplementation(PRIORITY, 'notebook-multicursor-undo-redo', () => {
            const editor = getNotebookEditorFromEditorPane(this._editorService.activeEditorPane);
            if (!editor) {
                return false;
            }
            if (!editor.hasModel()) {
                return false;
            }
            const controller = editor.getContribution(NotebookMultiCursorController.id);
            return controller.redo();
        }, ContextKeyExpr.and(ContextKeyExpr.equals('config.notebook.multiCursor.enabled', true), NOTEBOOK_IS_ACTIVE_EDITOR, NOTEBOOK_MULTI_CURSOR_CONTEXT.IsNotebookMultiCursor)));
    }
};
NotebookMultiCursorUndoRedoContribution = __decorate([
    __param(0, IEditorService),
    __param(1, IConfigurationService)
], NotebookMultiCursorUndoRedoContribution);
registerNotebookContribution(NotebookMultiCursorController.id, NotebookMultiCursorController);
registerWorkbenchContribution2(NotebookMultiCursorUndoRedoContribution.ID, NotebookMultiCursorUndoRedoContribution, 2 /* WorkbenchPhase.BlockRestore */);
registerAction2(NotebookSelectAllFindMatches);
registerAction2(NotebookAddMatchToMultiSelectionAction);
registerAction2(NotebookExitMultiSelectionAction);
registerAction2(NotebookDeleteLeftMultiSelectionAction);
registerAction2(NotebookDeleteRightMultiSelectionAction);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tNdWx0aWN1cnNvci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIvbXVsdGljdXJzb3Ivbm90ZWJvb2tNdWx0aWN1cnNvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDcEQsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLHdDQUF3QyxDQUFDO0FBRXhFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDekYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRW5FLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBRXZGLE9BQU8sRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDaEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sd0VBQXdFLENBQUM7QUFFMUcsT0FBTyxFQUFFLDZCQUE2QixFQUFFLHFCQUFxQixFQUFpQyxxQkFBcUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3JMLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUU1RSxPQUFPLEVBQUUsU0FBUyxFQUFzQixNQUFNLG1EQUFtRCxDQUFDO0FBQ2xHLE9BQU8sRUFBbUIscUJBQXFCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUM1RyxPQUFPLEVBQUUsZUFBZSxFQUFFLGlCQUFpQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDdEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0VBQWtF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