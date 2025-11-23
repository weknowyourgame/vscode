/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CoreNavigationCommands } from '../coreCommands.js';
import { Position } from '../../common/core/position.js';
import * as platform from '../../../base/common/platform.js';
export class ViewController {
    constructor(configuration, viewModel, userInputEvents, commandDelegate) {
        this.configuration = configuration;
        this.viewModel = viewModel;
        this.userInputEvents = userInputEvents;
        this.commandDelegate = commandDelegate;
    }
    paste(text, pasteOnNewLine, multicursorText, mode) {
        this.commandDelegate.paste(text, pasteOnNewLine, multicursorText, mode);
    }
    type(text) {
        this.commandDelegate.type(text);
    }
    compositionType(text, replacePrevCharCnt, replaceNextCharCnt, positionDelta) {
        this.commandDelegate.compositionType(text, replacePrevCharCnt, replaceNextCharCnt, positionDelta);
    }
    compositionStart() {
        this.commandDelegate.startComposition();
    }
    compositionEnd() {
        this.commandDelegate.endComposition();
    }
    cut() {
        this.commandDelegate.cut();
    }
    setSelection(modelSelection) {
        CoreNavigationCommands.SetSelection.runCoreEditorCommand(this.viewModel, {
            source: 'keyboard',
            selection: modelSelection
        });
    }
    _validateViewColumn(viewPosition) {
        const minColumn = this.viewModel.getLineMinColumn(viewPosition.lineNumber);
        if (viewPosition.column < minColumn) {
            return new Position(viewPosition.lineNumber, minColumn);
        }
        return viewPosition;
    }
    _hasMulticursorModifier(data) {
        switch (this.configuration.options.get(86 /* EditorOption.multiCursorModifier */)) {
            case 'altKey':
                return data.altKey;
            case 'ctrlKey':
                return data.ctrlKey;
            case 'metaKey':
                return data.metaKey;
            default:
                return false;
        }
    }
    _hasNonMulticursorModifier(data) {
        switch (this.configuration.options.get(86 /* EditorOption.multiCursorModifier */)) {
            case 'altKey':
                return data.ctrlKey || data.metaKey;
            case 'ctrlKey':
                return data.altKey || data.metaKey;
            case 'metaKey':
                return data.ctrlKey || data.altKey;
            default:
                return false;
        }
    }
    dispatchMouse(data) {
        const options = this.configuration.options;
        const selectionClipboardIsOn = (platform.isLinux && options.get(121 /* EditorOption.selectionClipboard */));
        const columnSelection = options.get(28 /* EditorOption.columnSelection */);
        const scrollOnMiddleClick = options.get(171 /* EditorOption.scrollOnMiddleClick */);
        if (data.middleButton && !selectionClipboardIsOn) {
            if (scrollOnMiddleClick) {
                // nothing to do here, handled in the contribution
            }
            else {
                this._columnSelect(data.position, data.mouseColumn, data.inSelectionMode);
            }
        }
        else if (data.startedOnLineNumbers) {
            // If the dragging started on the gutter, then have operations work on the entire line
            if (this._hasMulticursorModifier(data)) {
                if (data.inSelectionMode) {
                    this._lastCursorLineSelect(data.position, data.revealType);
                }
                else {
                    this._createCursor(data.position, true);
                }
            }
            else {
                if (data.inSelectionMode) {
                    this._lineSelectDrag(data.position, data.revealType);
                }
                else {
                    this._lineSelect(data.position, data.revealType);
                }
            }
        }
        else if (data.mouseDownCount >= 4) {
            this._selectAll();
        }
        else if (data.mouseDownCount === 3) {
            if (this._hasMulticursorModifier(data)) {
                if (data.inSelectionMode) {
                    this._lastCursorLineSelectDrag(data.position, data.revealType);
                }
                else {
                    this._lastCursorLineSelect(data.position, data.revealType);
                }
            }
            else {
                if (data.inSelectionMode) {
                    this._lineSelectDrag(data.position, data.revealType);
                }
                else {
                    this._lineSelect(data.position, data.revealType);
                }
            }
        }
        else if (data.mouseDownCount === 2) {
            if (!data.onInjectedText) {
                if (this._hasMulticursorModifier(data)) {
                    this._lastCursorWordSelect(data.position, data.revealType);
                }
                else {
                    if (data.inSelectionMode) {
                        this._wordSelectDrag(data.position, data.revealType);
                    }
                    else {
                        this._wordSelect(data.position, data.revealType);
                    }
                }
            }
        }
        else {
            if (this._hasMulticursorModifier(data)) {
                if (!this._hasNonMulticursorModifier(data)) {
                    if (data.shiftKey) {
                        this._columnSelect(data.position, data.mouseColumn, true);
                    }
                    else {
                        // Do multi-cursor operations only when purely alt is pressed
                        if (data.inSelectionMode) {
                            this._lastCursorMoveToSelect(data.position, data.revealType);
                        }
                        else {
                            this._createCursor(data.position, false);
                        }
                    }
                }
            }
            else {
                if (data.inSelectionMode) {
                    if (data.altKey) {
                        this._columnSelect(data.position, data.mouseColumn, true);
                    }
                    else {
                        if (columnSelection) {
                            this._columnSelect(data.position, data.mouseColumn, true);
                        }
                        else {
                            this._moveToSelect(data.position, data.revealType);
                        }
                    }
                }
                else {
                    this.moveTo(data.position, data.revealType);
                }
            }
        }
    }
    _usualArgs(viewPosition, revealType) {
        viewPosition = this._validateViewColumn(viewPosition);
        return {
            source: 'mouse',
            position: this._convertViewToModelPosition(viewPosition),
            viewPosition,
            revealType
        };
    }
    moveTo(viewPosition, revealType) {
        CoreNavigationCommands.MoveTo.runCoreEditorCommand(this.viewModel, this._usualArgs(viewPosition, revealType));
    }
    _moveToSelect(viewPosition, revealType) {
        CoreNavigationCommands.MoveToSelect.runCoreEditorCommand(this.viewModel, this._usualArgs(viewPosition, revealType));
    }
    _columnSelect(viewPosition, mouseColumn, doColumnSelect) {
        viewPosition = this._validateViewColumn(viewPosition);
        CoreNavigationCommands.ColumnSelect.runCoreEditorCommand(this.viewModel, {
            source: 'mouse',
            position: this._convertViewToModelPosition(viewPosition),
            viewPosition: viewPosition,
            mouseColumn: mouseColumn,
            doColumnSelect: doColumnSelect
        });
    }
    _createCursor(viewPosition, wholeLine) {
        viewPosition = this._validateViewColumn(viewPosition);
        CoreNavigationCommands.CreateCursor.runCoreEditorCommand(this.viewModel, {
            source: 'mouse',
            position: this._convertViewToModelPosition(viewPosition),
            viewPosition: viewPosition,
            wholeLine: wholeLine
        });
    }
    _lastCursorMoveToSelect(viewPosition, revealType) {
        CoreNavigationCommands.LastCursorMoveToSelect.runCoreEditorCommand(this.viewModel, this._usualArgs(viewPosition, revealType));
    }
    _wordSelect(viewPosition, revealType) {
        CoreNavigationCommands.WordSelect.runCoreEditorCommand(this.viewModel, this._usualArgs(viewPosition, revealType));
    }
    _wordSelectDrag(viewPosition, revealType) {
        CoreNavigationCommands.WordSelectDrag.runCoreEditorCommand(this.viewModel, this._usualArgs(viewPosition, revealType));
    }
    _lastCursorWordSelect(viewPosition, revealType) {
        CoreNavigationCommands.LastCursorWordSelect.runCoreEditorCommand(this.viewModel, this._usualArgs(viewPosition, revealType));
    }
    _lineSelect(viewPosition, revealType) {
        CoreNavigationCommands.LineSelect.runCoreEditorCommand(this.viewModel, this._usualArgs(viewPosition, revealType));
    }
    _lineSelectDrag(viewPosition, revealType) {
        CoreNavigationCommands.LineSelectDrag.runCoreEditorCommand(this.viewModel, this._usualArgs(viewPosition, revealType));
    }
    _lastCursorLineSelect(viewPosition, revealType) {
        CoreNavigationCommands.LastCursorLineSelect.runCoreEditorCommand(this.viewModel, this._usualArgs(viewPosition, revealType));
    }
    _lastCursorLineSelectDrag(viewPosition, revealType) {
        CoreNavigationCommands.LastCursorLineSelectDrag.runCoreEditorCommand(this.viewModel, this._usualArgs(viewPosition, revealType));
    }
    _selectAll() {
        CoreNavigationCommands.SelectAll.runCoreEditorCommand(this.viewModel, { source: 'mouse' });
    }
    // ----------------------
    _convertViewToModelPosition(viewPosition) {
        return this.viewModel.coordinatesConverter.convertViewPositionToModelPosition(viewPosition);
    }
    emitKeyDown(e) {
        this.userInputEvents.emitKeyDown(e);
    }
    emitKeyUp(e) {
        this.userInputEvents.emitKeyUp(e);
    }
    emitContextMenu(e) {
        this.userInputEvents.emitContextMenu(e);
    }
    emitMouseMove(e) {
        this.userInputEvents.emitMouseMove(e);
    }
    emitMouseLeave(e) {
        this.userInputEvents.emitMouseLeave(e);
    }
    emitMouseUp(e) {
        this.userInputEvents.emitMouseUp(e);
    }
    emitMouseDown(e) {
        this.userInputEvents.emitMouseDown(e);
    }
    emitMouseDrag(e) {
        this.userInputEvents.emitMouseDrag(e);
    }
    emitMouseDrop(e) {
        this.userInputEvents.emitMouseDrop(e);
    }
    emitMouseDropCanceled() {
        this.userInputEvents.emitMouseDropCanceled();
    }
    emitMouseWheel(e) {
        this.userInputEvents.emitMouseWheel(e);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld0NvbnRyb2xsZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvdmlldy92aWV3Q29udHJvbGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsc0JBQXNCLEVBQStCLE1BQU0sb0JBQW9CLENBQUM7QUFHekYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBTXpELE9BQU8sS0FBSyxRQUFRLE1BQU0sa0NBQWtDLENBQUM7QUFnQzdELE1BQU0sT0FBTyxjQUFjO0lBTzFCLFlBQ0MsYUFBbUMsRUFDbkMsU0FBcUIsRUFDckIsZUFBb0MsRUFDcEMsZUFBaUM7UUFFakMsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDbkMsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDM0IsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7UUFDdkMsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7SUFDeEMsQ0FBQztJQUVNLEtBQUssQ0FBQyxJQUFZLEVBQUUsY0FBdUIsRUFBRSxlQUFnQyxFQUFFLElBQW1CO1FBQ3hHLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3pFLENBQUM7SUFFTSxJQUFJLENBQUMsSUFBWTtRQUN2QixJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRU0sZUFBZSxDQUFDLElBQVksRUFBRSxrQkFBMEIsRUFBRSxrQkFBMEIsRUFBRSxhQUFxQjtRQUNqSCxJQUFJLENBQUMsZUFBZSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsa0JBQWtCLEVBQUUsYUFBYSxDQUFDLENB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