/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from '../../nls.js';
import { isFirefox } from '../../base/browser/browser.js';
import * as types from '../../base/common/types.js';
import { status } from '../../base/browser/ui/aria/aria.js';
import { Command, EditorCommand, registerEditorCommand, UndoCommand, RedoCommand, SelectAllCommand } from './editorExtensions.js';
import { ICodeEditorService } from './services/codeEditorService.js';
import { ColumnSelection } from '../common/cursor/cursorColumnSelection.js';
import { CursorState } from '../common/cursorCommon.js';
import { DeleteOperations } from '../common/cursor/cursorDeleteOperations.js';
import { CursorMove as CursorMove_, CursorMoveCommands } from '../common/cursor/cursorMoveCommands.js';
import { TypeOperations } from '../common/cursor/cursorTypeOperations.js';
import { Position } from '../common/core/position.js';
import { Range } from '../common/core/range.js';
import { EditorContextKeys } from '../common/editorContextKeys.js';
import { ContextKeyExpr } from '../../platform/contextkey/common/contextkey.js';
import { KeybindingsRegistry } from '../../platform/keybinding/common/keybindingsRegistry.js';
import { getActiveElement, isEditableElement } from '../../base/browser/dom.js';
import { EnterOperation } from '../common/cursor/cursorTypeEditOperations.js';
const CORE_WEIGHT = 0 /* KeybindingWeight.EditorCore */;
export class CoreEditorCommand extends EditorCommand {
    runEditorCommand(accessor, editor, args) {
        const viewModel = editor._getViewModel();
        if (!viewModel) {
            // the editor has no view => has no cursors
            return;
        }
        this.runCoreEditorCommand(viewModel, args || {});
    }
}
export var EditorScroll_;
(function (EditorScroll_) {
    const isEditorScrollArgs = function (arg) {
        if (!types.isObject(arg)) {
            return false;
        }
        const scrollArg = arg;
        if (!types.isString(scrollArg.to)) {
            return false;
        }
        if (!types.isUndefined(scrollArg.by) && !types.isString(scrollArg.by)) {
            return false;
        }
        if (!types.isUndefined(scrollArg.value) && !types.isNumber(scrollArg.value)) {
            return false;
        }
        if (!types.isUndefined(scrollArg.revealCursor) && !types.isBoolean(scrollArg.revealCursor)) {
            return false;
        }
        return true;
    };
    EditorScroll_.metadata = {
        description: 'Scroll editor in the given direction',
        args: [
            {
                name: 'Editor scroll argument object',
                description: `Property-value pairs that can be passed through this argument:
					* 'to': A mandatory direction value.
						\`\`\`
						'up', 'down'
						\`\`\`
					* 'by': Unit to move. Default is computed based on 'to' value.
						\`\`\`
						'line', 'wrappedLine', 'page', 'halfPage', 'editor'
						\`\`\`
					* 'value': Number of units to move. Default is '1'.
					* 'revealCursor': If 'true' reveals the cursor if it is outside view port.
				`,
                constraint: isEditorScrollArgs,
                schema: {
                    'type': 'object',
                    'required': ['to'],
                    'properties': {
                        'to': {
                            'type': 'string',
                            'enum': ['up', 'down']
                        },
                        'by': {
                            'type': 'string',
                            'enum': ['line', 'wrappedLine', 'page', 'halfPage', 'editor']
                        },
                        'value': {
                            'type': 'number',
                            'default': 1
                        },
                        'revealCursor': {
                            'type': 'boolean',
                        }
                    }
                }
            }
        ]
    };
    /**
     * Directions in the view for editor scroll command.
     */
    EditorScroll_.RawDirection = {
        Up: 'up',
        Right: 'right',
        Down: 'down',
        Left: 'left'
    };
    /**
     * Units for editor scroll 'by' argument
     */
    EditorScroll_.RawUnit = {
        Line: 'line',
        WrappedLine: 'wrappedLine',
        Page: 'page',
        HalfPage: 'halfPage',
        Editor: 'editor',
        Column: 'column'
    };
    function parse(args) {
        let direction;
        switch (args.to) {
            case EditorScroll_.RawDirection.Up:
                direction = 1 /* Direction.Up */;
                break;
            case EditorScroll_.RawDirection.Right:
                direction = 2 /* Direction.Right */;
                break;
            case EditorScroll_.RawDirection.Down:
                direction = 3 /* Direction.Down */;
                break;
            case EditorScroll_.RawDirection.Left:
                direction = 4 /* Direction.Left */;
                break;
            default:
                // Illegal arguments
                return null;
        }
        let unit;
        switch (args.by) {
            case EditorScroll_.RawUnit.Line:
                unit = 1 /* Unit.Line */;
                break;
            case EditorScroll_.RawUnit.WrappedLine:
                unit = 2 /* Unit.WrappedLine */;
                break;
            case EditorScroll_.RawUnit.Page:
                unit = 3 /* Unit.Page */;
                break;
            case EditorScroll_.RawUnit.HalfPage:
                unit = 4 /* Unit.HalfPage */;
                break;
            case EditorScroll_.RawUnit.Editor:
                unit = 5 /* Unit.Editor */;
                break;
            case EditorScroll_.RawUnit.Column:
                unit = 6 /* Unit.Column */;
                break;
            default:
                unit = 2 /* Unit.WrappedLine */;
        }
        const value = Math.floor(args.value || 1);
        const revealCursor = !!args.revealCursor;
        return {
            direction: direction,
            unit: unit,
            value: value,
            revealCursor: revealCursor,
            select: (!!args.select)
        };
    }
    EditorScroll_.parse = parse;
    let Direction;
    (function (Direction) {
        Direction[Direction["Up"] = 1] = "Up";
        Direction[Direction["Right"] = 2] = "Right";
        Direction[Direction["Down"] = 3] = "Down";
        Direction[Direction["Left"] = 4] = "Left";
    })(Direction = EditorScroll_.Direction || (EditorScroll_.Direction = {}));
    let Unit;
    (function (Unit) {
        Unit[Unit["Line"] = 1] = "Line";
        Unit[Unit["WrappedLine"] = 2] = "WrappedLine";
        Unit[Unit["Page"] = 3] = "Page";
        Unit[Unit["HalfPage"] = 4] = "HalfPage";
        Unit[Unit["Editor"] = 5] = "Editor";
        Unit[Unit["Column"] = 6] = "Column";
    })(Unit = EditorScroll_.Unit || (EditorScroll_.Unit = {}));
})(EditorScroll_ || (EditorScroll_ = {}));
export var RevealLine_;
(function (RevealLine_) {
    const isRevealLineArgs = function (arg) {
        if (!types.isObject(arg)) {
            return false;
        }
        const reveaLineArg = arg;
        if (!types.isNumber(reveaLineArg.lineNumber) && !types.isString(reveaLineArg.lineNumber)) {
            return false;
        }
        if (!types.isUndefined(reveaLineArg.at) && !types.isString(reveaLineArg.at)) {
            return false;
        }
        return true;
    };
    RevealLine_.metadata = {
        description: 'Reveal the given line at the given logical position',
        args: [
            {
                name: 'Reveal line argument object',
                description: `Property-value pairs that can be passed through this argument:
					* 'lineNumber': A mandatory line number value.
					* 'at': Logical position at which line has to be revealed.
						\`\`\`
						'top', 'center', 'bottom'
						\`\`\`
				`,
                constraint: isRevealLineArgs,
                schema: {
                    'type': 'object',
                    'required': ['lineNumber'],
                    'properties': {
                        'lineNumber': {
                            'type': ['number', 'string'],
                        },
                        'at': {
                            'type': 'string',
                            'enum': ['top', 'center', 'bottom']
                        }
                    }
                }
            }
        ]
    };
    /**
     * Values for reveal line 'at' argument
     */
    RevealLine_.RawAtArgument = {
        Top: 'top',
        Center: 'center',
        Bottom: 'bottom'
    };
})(RevealLine_ || (RevealLine_ = {}));
class EditorOrNativeTextInputCommand {
    constructor(target) {
        // 1. handle case when focus is in editor.
        target.addImplementation(10000, 'code-editor', (accessor, args) => {
            // Only if editor text focus (i.e. not if editor has widget focus).
            const focusedEditor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
            if (focusedEditor && focusedEditor.hasTextFocus()) {
                return this._runEditorCommand(accessor, focusedEditor, args);
            }
            return false;
        });
        // 2. handle case when focus is in some other `input` / `textarea`.
        target.addImplementation(1000, 'generic-dom-input-textarea', (accessor, args) => {
            // Only if focused on an element that allows for entering text
            const activeElement = getActiveElement();
            if (activeElement && isEditableElement(activeElement)) {
                this.runDOMCommand(activeElement);
                return true;
            }
            return false;
        });
        // 3. (default) handle case when focus is somewhere else.
        target.addImplementation(0, 'generic-dom', (accessor, args) => {
            // Redirecting to active editor
            const activeEditor = accessor.get(ICodeEditorService).getActiveCodeEditor();
            if (activeEditor) {
                activeEditor.focus();
                return this._runEditorCommand(accessor, activeEditor, args);
            }
            return false;
        });
    }
    _runEditorCommand(accessor, editor, args) {
        const result = this.runEditorCommand(accessor, editor, args);
        if (result) {
            return result;
        }
        return true;
    }
}
export var NavigationCommandRevealType;
(function (NavigationCommandRevealType) {
    /**
     * Do regular revealing.
     */
    NavigationCommandRevealType[NavigationCommandRevealType["Regular"] = 0] = "Regular";
    /**
     * Do only minimal revealing.
     */
    NavigationCommandRevealType[NavigationCommandRevealType["Minimal"] = 1] = "Minimal";
    /**
     * Do not reveal the position.
     */
    NavigationCommandRevealType[NavigationCommandRevealType["None"] = 2] = "None";
})(NavigationCommandRevealType || (NavigationCommandRevealType = {}));
export var CoreNavigationCommands;
(function (CoreNavigationCommands) {
    class BaseMoveToCommand extends CoreEditorCommand {
        constructor(opts) {
            super(opts);
            this._inSelectionMode = opts.inSelectionMode;
        }
        runCoreEditorCommand(viewModel, args) {
            if (!args.position) {
                return;
            }
            viewModel.model.pushStackElement();
            const cursorStateChanged = viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, [
                CursorMoveCommands.moveTo(viewModel, viewModel.getPrimaryCursorState(), this._inSelectionMode, args.position, args.viewPosition)
            ]);
            if (cursorStateChanged && args.revealType !== 2 /* NavigationCommandRevealType.None */) {
                viewModel.revealAllCursors(args.source, true, true);
            }
        }
    }
    CoreNavigationCommands.MoveTo = registerEditorCommand(new BaseMoveToCommand({
        id: '_moveTo',
        inSelectionMode: false,
        precondition: undefined
    }));
    CoreNavigationCommands.MoveToSelect = registerEditorCommand(new BaseMoveToCommand({
        id: '_moveToSelect',
        inSelectionMode: true,
        precondition: undefined
    }));
    class ColumnSelectCommand extends CoreEditorCommand {
        runCoreEditorCommand(viewModel, args) {
            viewModel.model.pushStackElement();
            const result = this._getColumnSelectResult(viewModel, viewModel.getPrimaryCursorState(), viewModel.getCursorColumnSelectData(), args);
            if (result === null) {
                // invalid arguments
                return;
            }
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, result.viewStates.map((viewState) => CursorState.fromViewState(viewState)));
            viewModel.setCursorColumnSelectData({
                isReal: true,
                fromViewLineNumber: result.fromLineNumber,
                fromViewVisualColumn: result.fromVisualColumn,
                toViewLineNumber: result.toLineNumber,
                toViewVisualColumn: result.toVisualColumn
            });
            if (result.reversed) {
                viewModel.revealTopMostCursor(args.source);
            }
            else {
                viewModel.revealBottomMostCursor(args.source);
            }
        }
    }
    CoreNavigationCommands.ColumnSelect = registerEditorCommand(new class extends ColumnSelectCommand {
        constructor() {
            super({
                id: 'columnSelect',
                precondition: undefined
            });
        }
        _getColumnSelectResult(viewModel, primary, prevColumnSelectData, args) {
            if (typeof args.position === 'undefined' || typeof args.viewPosition === 'undefined' || typeof args.mouseColumn === 'undefined') {
                return null;
            }
            // validate `args`
            const validatedPosition = viewModel.model.validatePosition(args.position);
            const validatedViewPosition = viewModel.coordinatesConverter.validateViewPosition(new Position(args.viewPosition.lineNumber, args.viewPosition.column), validatedPosition);
            const fromViewLineNumber = args.doColumnSelect ? prevColumnSelectData.fromViewLineNumber : validatedViewPosition.lineNumber;
            const fromViewVisualColumn = args.doColumnSelect ? prevColumnSelectData.fromViewVisualColumn : args.mouseColumn - 1;
            return ColumnSelection.columnSelect(viewModel.cursorConfig, viewModel, fromViewLineNumber, fromViewVisualColumn, validatedViewPosition.lineNumber, args.mouseColumn - 1);
        }
    });
    CoreNavigationCommands.CursorColumnSelectLeft = registerEditorCommand(new class extends ColumnSelectCommand {
        constructor() {
            super({
                id: 'cursorColumnSelectLeft',
                precondition: undefined,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: EditorContextKeys.textInputFocus,
                    primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 512 /* KeyMod.Alt */ | 15 /* KeyCode.LeftArrow */,
                    linux: { primary: 0 }
                }
            });
        }
        _getColumnSelectResult(viewModel, primary, prevColumnSelectData, args) {
            return ColumnSelection.columnSelectLeft(viewModel.cursorConfig, viewModel, prevColumnSelectData);
        }
    });
    CoreNavigationCommands.CursorColumnSelectRight = registerEditorCommand(new class extends ColumnSelectCommand {
        constructor() {
            super({
                id: 'cursorColumnSelectRight',
                precondition: undefined,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: EditorContextKeys.textInputFocus,
                    primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 512 /* KeyMod.Alt */ | 17 /* KeyCode.RightArrow */,
                    linux: { primary: 0 }
                }
            });
        }
        _getColumnSelectResult(viewModel, primary, prevColumnSelectData, args) {
            return ColumnSelection.columnSelectRight(viewModel.cursorConfig, viewModel, prevColumnSelectData);
        }
    });
    class ColumnSelectUpCommand extends ColumnSelectCommand {
        constructor(opts) {
            super(opts);
            this._isPaged = opts.isPaged;
        }
        _getColumnSelectResult(viewModel, primary, prevColumnSelectData, args) {
            return ColumnSelection.columnSelectUp(viewModel.cursorConfig, viewModel, prevColumnSelectData, this._isPaged);
        }
    }
    CoreNavigationCommands.CursorColumnSelectUp = registerEditorCommand(new ColumnSelectUpCommand({
        isPaged: false,
        id: 'cursorColumnSelectUp',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 512 /* KeyMod.Alt */ | 16 /* KeyCode.UpArrow */,
            linux: { primary: 0 }
        }
    }));
    CoreNavigationCommands.CursorColumnSelectPageUp = registerEditorCommand(new ColumnSelectUpCommand({
        isPaged: true,
        id: 'cursorColumnSelectPageUp',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 512 /* KeyMod.Alt */ | 11 /* KeyCode.PageUp */,
            linux: { primary: 0 }
        }
    }));
    class ColumnSelectDownCommand extends ColumnSelectCommand {
        constructor(opts) {
            super(opts);
            this._isPaged = opts.isPaged;
        }
        _getColumnSelectResult(viewModel, primary, prevColumnSelectData, args) {
            return ColumnSelection.columnSelectDown(viewModel.cursorConfig, viewModel, prevColumnSelectData, this._isPaged);
        }
    }
    CoreNavigationCommands.CursorColumnSelectDown = registerEditorCommand(new ColumnSelectDownCommand({
        isPaged: false,
        id: 'cursorColumnSelectDown',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 512 /* KeyMod.Alt */ | 18 /* KeyCode.DownArrow */,
            linux: { primary: 0 }
        }
    }));
    CoreNavigationCommands.CursorColumnSelectPageDown = registerEditorCommand(new ColumnSelectDownCommand({
        isPaged: true,
        id: 'cursorColumnSelectPageDown',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 512 /* KeyMod.Alt */ | 12 /* KeyCode.PageDown */,
            linux: { primary: 0 }
        }
    }));
    class CursorMoveImpl extends CoreEditorCommand {
        constructor() {
            super({
                id: 'cursorMove',
                precondition: undefined,
                metadata: CursorMove_.metadata
            });
        }
        runCoreEditorCommand(viewModel, args) {
            const parsed = CursorMove_.parse(args);
            if (!parsed) {
                // illegal arguments
                return;
            }
            this._runCursorMove(viewModel, args.source, parsed);
        }
        _runCursorMove(viewModel, source, args) {
            // If noHistory is true, use PROGRAMMATIC source to prevent adding to navigation history
            const effectiveSource = args.noHistory ? "api" /* TextEditorSelectionSource.PROGRAMMATIC */ : source;
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(effectiveSource, 3 /* CursorChangeReason.Explicit */, CursorMoveImpl._move(viewModel, viewModel.getCursorStates(), args));
            viewModel.revealAllCursors(effectiveSource, true);
        }
        static _move(viewModel, cursors, args) {
            const inSelectionMode = args.select;
            const value = args.value;
            switch (args.direction) {
                case 0 /* CursorMove_.Direction.Left */:
                case 1 /* CursorMove_.Direction.Right */:
                case 2 /* CursorMove_.Direction.Up */:
                case 3 /* CursorMove_.Direction.Down */:
                case 4 /* CursorMove_.Direction.PrevBlankLine */:
                case 5 /* CursorMove_.Direction.NextBlankLine */:
                case 6 /* CursorMove_.Direction.WrappedLineStart */:
                case 7 /* CursorMove_.Direction.WrappedLineFirstNonWhitespaceCharacter */:
                case 8 /* CursorMove_.Direction.WrappedLineColumnCenter */:
                case 9 /* CursorMove_.Direction.WrappedLineEnd */:
                case 10 /* CursorMove_.Direction.WrappedLineLastNonWhitespaceCharacter */:
                    return CursorMoveCommands.simpleMove(viewModel, cursors, args.direction, inSelectionMode, value, args.unit);
                case 11 /* CursorMove_.Direction.ViewPortTop */:
                case 13 /* CursorMove_.Direction.ViewPortBottom */:
                case 12 /* CursorMove_.Direction.ViewPortCenter */:
                case 14 /* CursorMove_.Direction.ViewPortIfOutside */:
                    return CursorMoveCommands.viewportMove(viewModel, cursors, args.direction, inSelectionMode, value);
                default:
                    return null;
            }
        }
    }
    CoreNavigationCommands.CursorMoveImpl = CursorMoveImpl;
    CoreNavigationCommands.CursorMove = registerEditorCommand(new CursorMoveImpl());
    let Constants;
    (function (Constants) {
        Constants[Constants["PAGE_SIZE_MARKER"] = -1] = "PAGE_SIZE_MARKER";
    })(Constants || (Constants = {}));
    class CursorMoveBasedCommand extends CoreEditorCommand {
        constructor(opts) {
            super(opts);
            this._staticArgs = opts.args;
        }
        runCoreEditorCommand(viewModel, dynamicArgs) {
            let args = this._staticArgs;
            if (this._staticArgs.value === -1 /* Constants.PAGE_SIZE_MARKER */) {
                // -1 is a marker for page size
                args = {
                    direction: this._staticArgs.direction,
                    unit: this._staticArgs.unit,
                    select: this._staticArgs.select,
                    value: dynamicArgs.pageSize || viewModel.cursorConfig.pageSize
                };
            }
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(dynamicArgs.source, 3 /* CursorChangeReason.Explicit */, CursorMoveCommands.simpleMove(viewModel, viewModel.getCursorStates(), args.direction, args.select, args.value, args.unit));
            viewModel.revealAllCursors(dynamicArgs.source, true);
        }
    }
    CoreNavigationCommands.CursorLeft = registerEditorCommand(new CursorMoveBasedCommand({
        args: {
            direction: 0 /* CursorMove_.Direction.Left */,
            unit: 0 /* CursorMove_.Unit.None */,
            select: false,
            value: 1
        },
        id: 'cursorLeft',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 15 /* KeyCode.LeftArrow */,
            mac: { primary: 15 /* KeyCode.LeftArrow */, secondary: [256 /* KeyMod.WinCtrl */ | 32 /* KeyCode.KeyB */] }
        }
    }));
    CoreNavigationCommands.CursorLeftSelect = registerEditorCommand(new CursorMoveBasedCommand({
        args: {
            direction: 0 /* CursorMove_.Direction.Left */,
            unit: 0 /* CursorMove_.Unit.None */,
            select: true,
            value: 1
        },
        id: 'cursorLeftSelect',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 1024 /* KeyMod.Shift */ | 15 /* KeyCode.LeftArrow */
        }
    }));
    CoreNavigationCommands.CursorRight = registerEditorCommand(new CursorMoveBasedCommand({
        args: {
            direction: 1 /* CursorMove_.Direction.Right */,
            unit: 0 /* CursorMove_.Unit.None */,
            select: false,
            value: 1
        },
        id: 'cursorRight',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 17 /* KeyCode.RightArrow */,
            mac: { primary: 17 /* KeyCode.RightArrow */, secondary: [256 /* KeyMod.WinCtrl */ | 36 /* KeyCode.KeyF */] }
        }
    }));
    CoreNavigationCommands.CursorRightSelect = registerEditorCommand(new CursorMoveBasedCommand({
        args: {
            direction: 1 /* CursorMove_.Direction.Right */,
            unit: 0 /* CursorMove_.Unit.None */,
            select: true,
            value: 1
        },
        id: 'cursorRightSelect',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 1024 /* KeyMod.Shift */ | 17 /* KeyCode.RightArrow */
        }
    }));
    CoreNavigationCommands.CursorUp = registerEditorCommand(new CursorMoveBasedCommand({
        args: {
            direction: 2 /* CursorMove_.Direction.Up */,
            unit: 2 /* CursorMove_.Unit.WrappedLine */,
            select: false,
            value: 1
        },
        id: 'cursorUp',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 16 /* KeyCode.UpArrow */,
            mac: { primary: 16 /* KeyCode.UpArrow */, secondary: [256 /* KeyMod.WinCtrl */ | 46 /* KeyCode.KeyP */] }
        }
    }));
    CoreNavigationCommands.CursorUpSelect = registerEditorCommand(new CursorMoveBasedCommand({
        args: {
            direction: 2 /* CursorMove_.Direction.Up */,
            unit: 2 /* CursorMove_.Unit.WrappedLine */,
            select: true,
            value: 1
        },
        id: 'cursorUpSelect',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 1024 /* KeyMod.Shift */ | 16 /* KeyCode.UpArrow */,
            secondary: [2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 16 /* KeyCode.UpArrow */],
            mac: { primary: 1024 /* KeyMod.Shift */ | 16 /* KeyCode.UpArrow */ },
            linux: { primary: 1024 /* KeyMod.Shift */ | 16 /* KeyCode.UpArrow */ }
        }
    }));
    CoreNavigationCommands.CursorPageUp = registerEditorCommand(new CursorMoveBasedCommand({
        args: {
            direction: 2 /* CursorMove_.Direction.Up */,
            unit: 2 /* CursorMove_.Unit.WrappedLine */,
            select: false,
            value: -1 /* Constants.PAGE_SIZE_MARKER */
        },
        id: 'cursorPageUp',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 11 /* KeyCode.PageUp */
        }
    }));
    CoreNavigationCommands.CursorPageUpSelect = registerEditorCommand(new CursorMoveBasedCommand({
        args: {
            direction: 2 /* CursorMove_.Direction.Up */,
            unit: 2 /* CursorMove_.Unit.WrappedLine */,
            select: true,
            value: -1 /* Constants.PAGE_SIZE_MARKER */
        },
        id: 'cursorPageUpSelect',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 1024 /* KeyMod.Shift */ | 11 /* KeyCode.PageUp */
        }
    }));
    CoreNavigationCommands.CursorDown = registerEditorCommand(new CursorMoveBasedCommand({
        args: {
            direction: 3 /* CursorMove_.Direction.Down */,
            unit: 2 /* CursorMove_.Unit.WrappedLine */,
            select: false,
            value: 1
        },
        id: 'cursorDown',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 18 /* KeyCode.DownArrow */,
            mac: { primary: 18 /* KeyCode.DownArrow */, secondary: [256 /* KeyMod.WinCtrl */ | 44 /* KeyCode.KeyN */] }
        }
    }));
    CoreNavigationCommands.CursorDownSelect = registerEditorCommand(new CursorMoveBasedCommand({
        args: {
            direction: 3 /* CursorMove_.Direction.Down */,
            unit: 2 /* CursorMove_.Unit.WrappedLine */,
            select: true,
            value: 1
        },
        id: 'cursorDownSelect',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 1024 /* KeyMod.Shift */ | 18 /* KeyCode.DownArrow */,
            secondary: [2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 18 /* KeyCode.DownArrow */],
            mac: { primary: 1024 /* KeyMod.Shift */ | 18 /* KeyCode.DownArrow */ },
            linux: { primary: 1024 /* KeyMod.Shift */ | 18 /* KeyCode.DownArrow */ }
        }
    }));
    CoreNavigationCommands.CursorPageDown = registerEditorCommand(new CursorMoveBasedCommand({
        args: {
            direction: 3 /* CursorMove_.Direction.Down */,
            unit: 2 /* CursorMove_.Unit.WrappedLine */,
            select: false,
            value: -1 /* Constants.PAGE_SIZE_MARKER */
        },
        id: 'cursorPageDown',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 12 /* KeyCode.PageDown */
        }
    }));
    CoreNavigationCommands.CursorPageDownSelect = registerEditorCommand(new CursorMoveBasedCommand({
        args: {
            direction: 3 /* CursorMove_.Direction.Down */,
            unit: 2 /* CursorMove_.Unit.WrappedLine */,
            select: true,
            value: -1 /* Constants.PAGE_SIZE_MARKER */
        },
        id: 'cursorPageDownSelect',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 1024 /* KeyMod.Shift */ | 12 /* KeyCode.PageDown */
        }
    }));
    CoreNavigationCommands.CreateCursor = registerEditorCommand(new class extends CoreEditorCommand {
        constructor() {
            super({
                id: 'createCursor',
                precondition: undefined
            });
        }
        runCoreEditorCommand(viewModel, args) {
            if (!args.position) {
                return;
            }
            let newState;
            if (args.wholeLine) {
                newState = CursorMoveCommands.line(viewModel, viewModel.getPrimaryCursorState(), false, args.position, args.viewPosition);
            }
            else {
                newState = CursorMoveCommands.moveTo(viewModel, viewModel.getPrimaryCursorState(), false, args.position, args.viewPosition);
            }
            const states = viewModel.getCursorStates();
            // Check if we should remove a cursor (sort of like a toggle)
            if (states.length > 1) {
                const newModelPosition = (newState.modelState ? newState.modelState.position : null);
                const newViewPosition = (newState.viewState ? newState.viewState.position : null);
                for (let i = 0, len = states.length; i < len; i++) {
                    const state = states[i];
                    if (newModelPosition && !state.modelState.selection.containsPosition(newModelPosition)) {
                        continue;
                    }
                    if (newViewPosition && !state.viewState.selection.containsPosition(newViewPosition)) {
                        continue;
                    }
                    // => Remove the cursor
                    states.splice(i, 1);
                    viewModel.model.pushStackElement();
                    viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, states);
                    return;
                }
            }
            // => Add the new cursor
            states.push(newState);
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, states);
        }
    });
    CoreNavigationCommands.LastCursorMoveToSelect = registerEditorCommand(new class extends CoreEditorCommand {
        constructor() {
            super({
                id: '_lastCursorMoveToSelect',
                precondition: undefined
            });
        }
        runCoreEditorCommand(viewModel, args) {
            if (!args.position) {
                return;
            }
            const lastAddedCursorIndex = viewModel.getLastAddedCursorIndex();
            const states = viewModel.getCursorStates();
            const newStates = states.slice(0);
            newStates[lastAddedCursorIndex] = CursorMoveCommands.moveTo(viewModel, states[lastAddedCursorIndex], true, args.position, args.viewPosition);
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, newStates);
        }
    });
    class HomeCommand extends CoreEditorCommand {
        constructor(opts) {
            super(opts);
            this._inSelectionMode = opts.inSelectionMode;
        }
        runCoreEditorCommand(viewModel, args) {
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, CursorMoveCommands.moveToBeginningOfLine(viewModel, viewModel.getCursorStates(), this._inSelectionMode));
            viewModel.revealAllCursors(args.source, true);
        }
    }
    CoreNavigationCommands.CursorHome = registerEditorCommand(new HomeCommand({
        inSelectionMode: false,
        id: 'cursorHome',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 14 /* KeyCode.Home */,
            mac: { primary: 14 /* KeyCode.Home */, secondary: [2048 /* KeyMod.CtrlCmd */ | 15 /* KeyCode.LeftArrow */] }
        }
    }));
    CoreNavigationCommands.CursorHomeSelect = registerEditorCommand(new HomeCommand({
        inSelectionMode: true,
        id: 'cursorHomeSelect',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 1024 /* KeyMod.Shift */ | 14 /* KeyCode.Home */,
            mac: { primary: 1024 /* KeyMod.Shift */ | 14 /* KeyCode.Home */, secondary: [2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 15 /* KeyCode.LeftArrow */] }
        }
    }));
    class LineStartCommand extends CoreEditorCommand {
        constructor(opts) {
            super(opts);
            this._inSelectionMode = opts.inSelectionMode;
        }
        runCoreEditorCommand(viewModel, args) {
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, this._exec(viewModel.getCursorStates()));
            viewModel.revealAllCursors(args.source, true);
        }
        _exec(cursors) {
            const result = [];
            for (let i = 0, len = cursors.length; i < len; i++) {
                const cursor = cursors[i];
                const lineNumber = cursor.modelState.position.lineNumber;
                result[i] = CursorState.fromModelState(cursor.modelState.move(this._inSelectionMode, lineNumber, 1, 0));
            }
            return result;
        }
    }
    CoreNavigationCommands.CursorLineStart = registerEditorCommand(new LineStartCommand({
        inSelectionMode: false,
        id: 'cursorLineStart',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 0,
            mac: { primary: 256 /* KeyMod.WinCtrl */ | 31 /* KeyCode.KeyA */ }
        }
    }));
    CoreNavigationCommands.CursorLineStartSelect = registerEditorCommand(new LineStartCommand({
        inSelectionMode: true,
        id: 'cursorLineStartSelect',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 0,
            mac: { primary: 256 /* KeyMod.WinCtrl */ | 1024 /* KeyMod.Shift */ | 31 /* KeyCode.KeyA */ }
        }
    }));
    class EndCommand extends CoreEditorCommand {
        constructor(opts) {
            super(opts);
            this._inSelectionMode = opts.inSelectionMode;
        }
        runCoreEditorCommand(viewModel, args) {
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, CursorMoveCommands.moveToEndOfLine(viewModel, viewModel.getCursorStates(), this._inSelectionMode, args.sticky || false));
            viewModel.revealAllCursors(args.source, true);
        }
    }
    CoreNavigationCommands.CursorEnd = registerEditorCommand(new EndCommand({
        inSelectionMode: false,
        id: 'cursorEnd',
        precondition: undefined,
        kbOpts: {
            args: { sticky: false },
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 13 /* KeyCode.End */,
            mac: { primary: 13 /* KeyCode.End */, secondary: [2048 /* KeyMod.CtrlCmd */ | 17 /* KeyCode.RightArrow */] }
        },
        metadata: {
            description: `Go to End`,
            args: [{
                    name: 'args',
                    schema: {
                        type: 'object',
                        properties: {
                            'sticky': {
                                description: nls.localize('stickydesc', "Stick to the end even when going to longer lines"),
                                type: 'boolean',
                                default: false
                            }
                        }
                    }
                }]
        }
    }));
    CoreNavigationCommands.CursorEndSelect = registerEditorCommand(new EndCommand({
        inSelectionMode: true,
        id: 'cursorEndSelect',
        precondition: undefined,
        kbOpts: {
            args: { sticky: false },
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 1024 /* KeyMod.Shift */ | 13 /* KeyCode.End */,
            mac: { primary: 1024 /* KeyMod.Shift */ | 13 /* KeyCode.End */, secondary: [2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 17 /* KeyCode.RightArrow */] }
        },
        metadata: {
            description: `Select to End`,
            args: [{
                    name: 'args',
                    schema: {
                        type: 'object',
                        properties: {
                            'sticky': {
                                description: nls.localize('stickydesc', "Stick to the end even when going to longer lines"),
                                type: 'boolean',
                                default: false
                            }
                        }
                    }
                }]
        }
    }));
    class LineEndCommand extends CoreEditorCommand {
        constructor(opts) {
            super(opts);
            this._inSelectionMode = opts.inSelectionMode;
        }
        runCoreEditorCommand(viewModel, args) {
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, this._exec(viewModel, viewModel.getCursorStates()));
            viewModel.revealAllCursors(args.source, true);
        }
        _exec(viewModel, cursors) {
            const result = [];
            for (let i = 0, len = cursors.length; i < len; i++) {
                const cursor = cursors[i];
                const lineNumber = cursor.modelState.position.lineNumber;
                const maxColumn = viewModel.model.getLineMaxColumn(lineNumber);
                result[i] = CursorState.fromModelState(cursor.modelState.move(this._inSelectionMode, lineNumber, maxColumn, 0));
            }
            return result;
        }
    }
    CoreNavigationCommands.CursorLineEnd = registerEditorCommand(new LineEndCommand({
        inSelectionMode: false,
        id: 'cursorLineEnd',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 0,
            mac: { primary: 256 /* KeyMod.WinCtrl */ | 35 /* KeyCode.KeyE */ }
        }
    }));
    CoreNavigationCommands.CursorLineEndSelect = registerEditorCommand(new LineEndCommand({
        inSelectionMode: true,
        id: 'cursorLineEndSelect',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 0,
            mac: { primary: 256 /* KeyMod.WinCtrl */ | 1024 /* KeyMod.Shift */ | 35 /* KeyCode.KeyE */ }
        }
    }));
    class TopCommand extends CoreEditorCommand {
        constructor(opts) {
            super(opts);
            this._inSelectionMode = opts.inSelectionMode;
        }
        runCoreEditorCommand(viewModel, args) {
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, CursorMoveCommands.moveToBeginningOfBuffer(viewModel, viewModel.getCursorStates(), this._inSelectionMode));
            viewModel.revealAllCursors(args.source, true);
        }
    }
    CoreNavigationCommands.CursorTop = registerEditorCommand(new TopCommand({
        inSelectionMode: false,
        id: 'cursorTop',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 2048 /* KeyMod.CtrlCmd */ | 14 /* KeyCode.Home */,
            mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */ }
        }
    }));
    CoreNavigationCommands.CursorTopSelect = registerEditorCommand(new TopCommand({
        inSelectionMode: true,
        id: 'cursorTopSelect',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 14 /* KeyCode.Home */,
            mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 16 /* KeyCode.UpArrow */ }
        }
    }));
    class BottomCommand extends CoreEditorCommand {
        constructor(opts) {
            super(opts);
            this._inSelectionMode = opts.inSelectionMode;
        }
        runCoreEditorCommand(viewModel, args) {
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, CursorMoveCommands.moveToEndOfBuffer(viewModel, viewModel.getCursorStates(), this._inSelectionMode));
            viewModel.revealAllCursors(args.source, true);
        }
    }
    CoreNavigationCommands.CursorBottom = registerEditorCommand(new BottomCommand({
        inSelectionMode: false,
        id: 'cursorBottom',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 2048 /* KeyMod.CtrlCmd */ | 13 /* KeyCode.End */,
            mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */ }
        }
    }));
    CoreNavigationCommands.CursorBottomSelect = registerEditorCommand(new BottomCommand({
        inSelectionMode: true,
        id: 'cursorBottomSelect',
        precondition: undefined,
        kbOpts: {
            weight: CORE_WEIGHT,
            kbExpr: EditorContextKeys.textInputFocus,
            primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 13 /* KeyCode.End */,
            mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 18 /* KeyCode.DownArrow */ }
        }
    }));
    class EditorScrollImpl extends CoreEditorCommand {
        constructor() {
            super({
                id: 'editorScroll',
                precondition: undefined,
                metadata: EditorScroll_.metadata
            });
        }
        determineScrollMethod(args) {
            const horizontalUnits = [6 /* EditorScroll_.Unit.Column */];
            const verticalUnits = [
                1 /* EditorScroll_.Unit.Line */,
                2 /* EditorScroll_.Unit.WrappedLine */,
                3 /* EditorScroll_.Unit.Page */,
                4 /* EditorScroll_.Unit.HalfPage */,
                5 /* EditorScroll_.Unit.Editor */
            ];
            const horizontalDirections = [4 /* EditorScroll_.Direction.Left */, 2 /* EditorScroll_.Direction.Right */];
            const verticalDirections = [1 /* EditorScroll_.Direction.Up */, 3 /* EditorScroll_.Direction.Down */];
            if (horizontalUnits.includes(args.unit) && horizontalDirections.includes(args.direction)) {
                return this._runHorizontalEditorScroll.bind(this);
            }
            if (verticalUnits.includes(args.unit) && verticalDirections.includes(args.direction)) {
                return this._runVerticalEditorScroll.bind(this);
            }
            return null;
        }
        runCoreEditorCommand(viewModel, args) {
            const parsed = EditorScroll_.parse(args);
            if (!parsed) {
                // illegal arguments
                return;
            }
            const runEditorScroll = this.determineScrollMethod(parsed);
            if (!runEditorScroll) {
                // Incompatible unit and direction
                return;
            }
            runEditorScroll(viewModel, args.source, parsed);
        }
        _runVerticalEditorScroll(viewModel, source, args) {
            const desiredScrollTop = this._computeDesiredScrollTop(viewModel, args);
            if (args.revealCursor) {
                // must ensure cursor is in new visible range
                const desiredVisibleViewRange = viewModel.getCompletelyVisibleViewRangeAtScrollTop(desiredScrollTop);
                viewModel.setCursorStates(source, 3 /* CursorChangeReason.Explicit */, [
                    CursorMoveCommands.findPositionInViewportIfOutside(viewModel, viewModel.getPrimaryCursorState(), desiredVisibleViewRange, args.select)
                ]);
            }
            viewModel.viewLayout.setScrollPosition({ scrollTop: desiredScrollTop }, 0 /* ScrollType.Smooth */);
        }
        _computeDesiredScrollTop(viewModel, args) {
            if (args.unit === 1 /* EditorScroll_.Unit.Line */) {
                // scrolling by model lines
                const futureViewport = viewModel.viewLayout.getFutureViewport();
                const visibleViewRange = viewModel.getCompletelyVisibleViewRangeAtScrollTop(futureViewport.top);
                const visibleModelRange = viewModel.coordinatesConverter.convertViewRangeToModelRange(visibleViewRange);
                let desiredTopModelLineNumber;
                if (args.direction === 1 /* EditorScroll_.Direction.Up */) {
                    // must go x model lines up
                    desiredTopModelLineNumber = Math.max(1, visibleModelRange.startLineNumber - args.value);
                }
                else {
                    // must go x model lines down
                    desiredTopModelLineNumber = Math.min(viewModel.model.getLineCount(), visibleModelRange.startLineNumber + args.value);
                }
                const viewPosition = viewModel.coordinatesConverter.convertModelPositionToViewPosition(new Position(desiredTopModelLineNumber, 1));
                return viewModel.viewLayout.getVerticalOffsetForLineNumber(viewPosition.lineNumber);
            }
            if (args.unit === 5 /* EditorScroll_.Unit.Editor */) {
                let desiredTopModelLineNumber = 0;
                if (args.direction === 3 /* EditorScroll_.Direction.Down */) {
                    desiredTopModelLineNumber = viewModel.model.getLineCount() - viewModel.cursorConfig.pageSize;
                }
                return viewModel.viewLayout.getVerticalOffsetForLineNumber(desiredTopModelLineNumber);
            }
            let noOfLines;
            if (args.unit === 3 /* EditorScroll_.Unit.Page */) {
                noOfLines = viewModel.cursorConfig.pageSize * args.value;
            }
            else if (args.unit === 4 /* EditorScroll_.Unit.HalfPage */) {
                noOfLines = Math.round(viewModel.cursorConfig.pageSize / 2) * args.value;
            }
            else {
                noOfLines = args.value;
            }
            const deltaLines = (args.direction === 1 /* EditorScroll_.Direction.Up */ ? -1 : 1) * noOfLines;
            return viewModel.viewLayout.getCurrentScrollTop() + deltaLines * viewModel.cursorConfig.lineHeight;
        }
        _runHorizontalEditorScroll(viewModel, source, args) {
            const desiredScrollLeft = this._computeDesiredScrollLeft(viewModel, args);
            viewModel.viewLayout.setScrollPosition({ scrollLeft: desiredScrollLeft }, 0 /* ScrollType.Smooth */);
        }
        _computeDesiredScrollLeft(viewModel, args) {
            const deltaColumns = (args.direction === 4 /* EditorScroll_.Direction.Left */ ? -1 : 1) * args.value;
            return viewModel.viewLayout.getCurrentScrollLeft() + deltaColumns * viewModel.cursorConfig.typicalHalfwidthCharacterWidth;
        }
    }
    CoreNavigationCommands.EditorScrollImpl = EditorScrollImpl;
    CoreNavigationCommands.EditorScroll = registerEditorCommand(new EditorScrollImpl());
    CoreNavigationCommands.ScrollLineUp = registerEditorCommand(new class extends CoreEditorCommand {
        constructor() {
            super({
                id: 'scrollLineUp',
                precondition: undefined,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: EditorContextKeys.textInputFocus,
                    primary: 2048 /* KeyMod.CtrlCmd */ | 16 /* KeyCode.UpArrow */,
                    mac: { primary: 256 /* KeyMod.WinCtrl */ | 11 /* KeyCode.PageUp */ }
                }
            });
        }
        runCoreEditorCommand(viewModel, args) {
            CoreNavigationCommands.EditorScroll.runCoreEditorCommand(viewModel, {
                to: EditorScroll_.RawDirection.Up,
                by: EditorScroll_.RawUnit.WrappedLine,
                value: 1,
                revealCursor: false,
                select: false,
                source: args.source
            });
        }
    });
    CoreNavigationCommands.ScrollPageUp = registerEditorCommand(new class extends CoreEditorCommand {
        constructor() {
            super({
                id: 'scrollPageUp',
                precondition: undefined,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: EditorContextKeys.textInputFocus,
                    primary: 2048 /* KeyMod.CtrlCmd */ | 11 /* KeyCode.PageUp */,
                    win: { primary: 512 /* KeyMod.Alt */ | 11 /* KeyCode.PageUp */ },
                    linux: { primary: 512 /* KeyMod.Alt */ | 11 /* KeyCode.PageUp */ }
                }
            });
        }
        runCoreEditorCommand(viewModel, args) {
            CoreNavigationCommands.EditorScroll.runCoreEditorCommand(viewModel, {
                to: EditorScroll_.RawDirection.Up,
                by: EditorScroll_.RawUnit.Page,
                value: 1,
                revealCursor: false,
                select: false,
                source: args.source
            });
        }
    });
    CoreNavigationCommands.ScrollEditorTop = registerEditorCommand(new class extends CoreEditorCommand {
        constructor() {
            super({
                id: 'scrollEditorTop',
                precondition: undefined,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: EditorContextKeys.textInputFocus,
                }
            });
        }
        runCoreEditorCommand(viewModel, args) {
            CoreNavigationCommands.EditorScroll.runCoreEditorCommand(viewModel, {
                to: EditorScroll_.RawDirection.Up,
                by: EditorScroll_.RawUnit.Editor,
                value: 1,
                revealCursor: false,
                select: false,
                source: args.source
            });
        }
    });
    CoreNavigationCommands.ScrollLineDown = registerEditorCommand(new class extends CoreEditorCommand {
        constructor() {
            super({
                id: 'scrollLineDown',
                precondition: undefined,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: EditorContextKeys.textInputFocus,
                    primary: 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */,
                    mac: { primary: 256 /* KeyMod.WinCtrl */ | 12 /* KeyCode.PageDown */ }
                }
            });
        }
        runCoreEditorCommand(viewModel, args) {
            CoreNavigationCommands.EditorScroll.runCoreEditorCommand(viewModel, {
                to: EditorScroll_.RawDirection.Down,
                by: EditorScroll_.RawUnit.WrappedLine,
                value: 1,
                revealCursor: false,
                select: false,
                source: args.source
            });
        }
    });
    CoreNavigationCommands.ScrollPageDown = registerEditorCommand(new class extends CoreEditorCommand {
        constructor() {
            super({
                id: 'scrollPageDown',
                precondition: undefined,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: EditorContextKeys.textInputFocus,
                    primary: 2048 /* KeyMod.CtrlCmd */ | 12 /* KeyCode.PageDown */,
                    win: { primary: 512 /* KeyMod.Alt */ | 12 /* KeyCode.PageDown */ },
                    linux: { primary: 512 /* KeyMod.Alt */ | 12 /* KeyCode.PageDown */ }
                }
            });
        }
        runCoreEditorCommand(viewModel, args) {
            CoreNavigationCommands.EditorScroll.runCoreEditorCommand(viewModel, {
                to: EditorScroll_.RawDirection.Down,
                by: EditorScroll_.RawUnit.Page,
                value: 1,
                revealCursor: false,
                select: false,
                source: args.source
            });
        }
    });
    CoreNavigationCommands.ScrollEditorBottom = registerEditorCommand(new class extends CoreEditorCommand {
        constructor() {
            super({
                id: 'scrollEditorBottom',
                precondition: undefined,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: EditorContextKeys.textInputFocus,
                }
            });
        }
        runCoreEditorCommand(viewModel, args) {
            CoreNavigationCommands.EditorScroll.runCoreEditorCommand(viewModel, {
                to: EditorScroll_.RawDirection.Down,
                by: EditorScroll_.RawUnit.Editor,
                value: 1,
                revealCursor: false,
                select: false,
                source: args.source
            });
        }
    });
    CoreNavigationCommands.ScrollLeft = registerEditorCommand(new class extends CoreEditorCommand {
        constructor() {
            super({
                id: 'scrollLeft',
                precondition: undefined,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: EditorContextKeys.textInputFocus,
                }
            });
        }
        runCoreEditorCommand(viewModel, args) {
            CoreNavigationCommands.EditorScroll.runCoreEditorCommand(viewModel, {
                to: EditorScroll_.RawDirection.Left,
                by: EditorScroll_.RawUnit.Column,
                value: 2,
                revealCursor: false,
                select: false,
                source: args.source
            });
        }
    });
    CoreNavigationCommands.ScrollRight = registerEditorCommand(new class extends CoreEditorCommand {
        constructor() {
            super({
                id: 'scrollRight',
                precondition: undefined,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: EditorContextKeys.textInputFocus,
                }
            });
        }
        runCoreEditorCommand(viewModel, args) {
            CoreNavigationCommands.EditorScroll.runCoreEditorCommand(viewModel, {
                to: EditorScroll_.RawDirection.Right,
                by: EditorScroll_.RawUnit.Column,
                value: 2,
                revealCursor: false,
                select: false,
                source: args.source
            });
        }
    });
    class WordCommand extends CoreEditorCommand {
        constructor(opts) {
            super(opts);
            this._inSelectionMode = opts.inSelectionMode;
        }
        runCoreEditorCommand(viewModel, args) {
            if (!args.position) {
                return;
            }
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, [
                CursorMoveCommands.word(viewModel, viewModel.getPrimaryCursorState(), this._inSelectionMode, args.position)
            ]);
            if (args.revealType !== 2 /* NavigationCommandRevealType.None */) {
                viewModel.revealAllCursors(args.source, true, true);
            }
        }
    }
    CoreNavigationCommands.WordSelect = registerEditorCommand(new WordCommand({
        inSelectionMode: false,
        id: '_wordSelect',
        precondition: undefined
    }));
    CoreNavigationCommands.WordSelectDrag = registerEditorCommand(new WordCommand({
        inSelectionMode: true,
        id: '_wordSelectDrag',
        precondition: undefined
    }));
    CoreNavigationCommands.LastCursorWordSelect = registerEditorCommand(new class extends CoreEditorCommand {
        constructor() {
            super({
                id: 'lastCursorWordSelect',
                precondition: undefined
            });
        }
        runCoreEditorCommand(viewModel, args) {
            if (!args.position) {
                return;
            }
            const lastAddedCursorIndex = viewModel.getLastAddedCursorIndex();
            const states = viewModel.getCursorStates();
            const newStates = states.slice(0);
            const lastAddedState = states[lastAddedCursorIndex];
            newStates[lastAddedCursorIndex] = CursorMoveCommands.word(viewModel, lastAddedState, lastAddedState.modelState.hasSelection(), args.position);
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, newStates);
        }
    });
    class LineCommand extends CoreEditorCommand {
        constructor(opts) {
            super(opts);
            this._inSelectionMode = opts.inSelectionMode;
        }
        runCoreEditorCommand(viewModel, args) {
            if (!args.position) {
                return;
            }
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, [
                CursorMoveCommands.line(viewModel, viewModel.getPrimaryCursorState(), this._inSelectionMode, args.position, args.viewPosition)
            ]);
            if (args.revealType !== 2 /* NavigationCommandRevealType.None */) {
                viewModel.revealAllCursors(args.source, false, true);
            }
        }
    }
    CoreNavigationCommands.LineSelect = registerEditorCommand(new LineCommand({
        inSelectionMode: false,
        id: '_lineSelect',
        precondition: undefined
    }));
    CoreNavigationCommands.LineSelectDrag = registerEditorCommand(new LineCommand({
        inSelectionMode: true,
        id: '_lineSelectDrag',
        precondition: undefined
    }));
    class LastCursorLineCommand extends CoreEditorCommand {
        constructor(opts) {
            super(opts);
            this._inSelectionMode = opts.inSelectionMode;
        }
        runCoreEditorCommand(viewModel, args) {
            if (!args.position) {
                return;
            }
            const lastAddedCursorIndex = viewModel.getLastAddedCursorIndex();
            const states = viewModel.getCursorStates();
            const newStates = states.slice(0);
            newStates[lastAddedCursorIndex] = CursorMoveCommands.line(viewModel, states[lastAddedCursorIndex], this._inSelectionMode, args.position, args.viewPosition);
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, newStates);
        }
    }
    CoreNavigationCommands.LastCursorLineSelect = registerEditorCommand(new LastCursorLineCommand({
        inSelectionMode: false,
        id: 'lastCursorLineSelect',
        precondition: undefined
    }));
    CoreNavigationCommands.LastCursorLineSelectDrag = registerEditorCommand(new LastCursorLineCommand({
        inSelectionMode: true,
        id: 'lastCursorLineSelectDrag',
        precondition: undefined
    }));
    CoreNavigationCommands.CancelSelection = registerEditorCommand(new class extends CoreEditorCommand {
        constructor() {
            super({
                id: 'cancelSelection',
                precondition: EditorContextKeys.hasNonEmptySelection,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: EditorContextKeys.textInputFocus,
                    primary: 9 /* KeyCode.Escape */,
                    secondary: [1024 /* KeyMod.Shift */ | 9 /* KeyCode.Escape */]
                }
            });
        }
        runCoreEditorCommand(viewModel, args) {
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, [
                CursorMoveCommands.cancelSelection(viewModel, viewModel.getPrimaryCursorState())
            ]);
            viewModel.revealAllCursors(args.source, true);
        }
    });
    CoreNavigationCommands.RemoveSecondaryCursors = registerEditorCommand(new class extends CoreEditorCommand {
        constructor() {
            super({
                id: 'removeSecondaryCursors',
                precondition: EditorContextKeys.hasMultipleSelections,
                kbOpts: {
                    weight: CORE_WEIGHT + 1,
                    kbExpr: EditorContextKeys.textInputFocus,
                    primary: 9 /* KeyCode.Escape */,
                    secondary: [1024 /* KeyMod.Shift */ | 9 /* KeyCode.Escape */]
                }
            });
        }
        runCoreEditorCommand(viewModel, args) {
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, [
                viewModel.getPrimaryCursorState()
            ]);
            viewModel.revealAllCursors(args.source, true);
            status(nls.localize('removedCursor', "Removed secondary cursors"));
        }
    });
    CoreNavigationCommands.RevealLine = registerEditorCommand(new class extends CoreEditorCommand {
        constructor() {
            super({
                id: 'revealLine',
                precondition: undefined,
                metadata: RevealLine_.metadata
            });
        }
        runCoreEditorCommand(viewModel, args) {
            const revealLineArg = args;
            const lineNumberArg = revealLineArg.lineNumber || 0;
            let lineNumber = typeof lineNumberArg === 'number' ? (lineNumberArg + 1) : (parseInt(lineNumberArg) + 1);
            if (lineNumber < 1) {
                lineNumber = 1;
            }
            const lineCount = viewModel.model.getLineCount();
            if (lineNumber > lineCount) {
                lineNumber = lineCount;
            }
            const range = new Range(lineNumber, 1, lineNumber, viewModel.model.getLineMaxColumn(lineNumber));
            let revealAt = 0 /* VerticalRevealType.Simple */;
            if (revealLineArg.at) {
                switch (revealLineArg.at) {
                    case RevealLine_.RawAtArgument.Top:
                        revealAt = 3 /* VerticalRevealType.Top */;
                        break;
                    case RevealLine_.RawAtArgument.Center:
                        revealAt = 1 /* VerticalRevealType.Center */;
                        break;
                    case RevealLine_.RawAtArgument.Bottom:
                        revealAt = 4 /* VerticalRevealType.Bottom */;
                        break;
                    default:
                        break;
                }
            }
            const viewRange = viewModel.coordinatesConverter.convertModelRangeToViewRange(range);
            viewModel.revealRange(args.source, false, viewRange, revealAt, 0 /* ScrollType.Smooth */);
        }
    });
    CoreNavigationCommands.SelectAll = new class extends EditorOrNativeTextInputCommand {
        constructor() {
            super(SelectAllCommand);
        }
        runDOMCommand(activeElement) {
            if (isFirefox) {
                activeElement.focus();
                activeElement.select();
            }
            activeElement.ownerDocument.execCommand('selectAll');
        }
        runEditorCommand(accessor, editor, args) {
            const viewModel = editor._getViewModel();
            if (!viewModel) {
                // the editor has no view => has no cursors
                return;
            }
            this.runCoreEditorCommand(viewModel, args);
        }
        runCoreEditorCommand(viewModel, args) {
            viewModel.model.pushStackElement();
            viewModel.setCursorStates('keyboard', 3 /* CursorChangeReason.Explicit */, [
                CursorMoveCommands.selectAll(viewModel, viewModel.getPrimaryCursorState())
            ]);
        }
    }();
    CoreNavigationCommands.SetSelection = registerEditorCommand(new class extends CoreEditorCommand {
        constructor() {
            super({
                id: 'setSelection',
                precondition: undefined
            });
        }
        runCoreEditorCommand(viewModel, args) {
            if (!args.selection) {
                return;
            }
            viewModel.model.pushStackElement();
            viewModel.setCursorStates(args.source, 3 /* CursorChangeReason.Explicit */, [
                CursorState.fromModelSelection(args.selection)
            ]);
        }
    });
})(CoreNavigationCommands || (CoreNavigationCommands = {}));
const columnSelectionCondition = ContextKeyExpr.and(EditorContextKeys.textInputFocus, EditorContextKeys.columnSelection);
function registerColumnSelection(id, keybinding) {
    KeybindingsRegistry.registerKeybindingRule({
        id: id,
        primary: keybinding,
        when: columnSelectionCondition,
        weight: CORE_WEIGHT + 1
    });
}
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectLeft.id, 1024 /* KeyMod.Shift */ | 15 /* KeyCode.LeftArrow */);
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectRight.id, 1024 /* KeyMod.Shift */ | 17 /* KeyCode.RightArrow */);
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectUp.id, 1024 /* KeyMod.Shift */ | 16 /* KeyCode.UpArrow */);
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectPageUp.id, 1024 /* KeyMod.Shift */ | 11 /* KeyCode.PageUp */);
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectDown.id, 1024 /* KeyMod.Shift */ | 18 /* KeyCode.DownArrow */);
registerColumnSelection(CoreNavigationCommands.CursorColumnSelectPageDown.id, 1024 /* KeyMod.Shift */ | 12 /* KeyCode.PageDown */);
function registerCommand(command) {
    command.register();
    return command;
}
export var CoreEditingCommands;
(function (CoreEditingCommands) {
    class CoreEditingCommand extends EditorCommand {
        runEditorCommand(accessor, editor, args) {
            const viewModel = editor._getViewModel();
            if (!viewModel) {
                // the editor has no view => has no cursors
                return;
            }
            this.runCoreEditingCommand(editor, viewModel, args || {});
        }
    }
    CoreEditingCommands.CoreEditingCommand = CoreEditingCommand;
    CoreEditingCommands.LineBreakInsert = registerEditorCommand(new class extends CoreEditingCommand {
        constructor() {
            super({
                id: 'lineBreakInsert',
                precondition: EditorContextKeys.writable,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: EditorContextKeys.textInputFocus,
                    primary: 0,
                    mac: { primary: 256 /* KeyMod.WinCtrl */ | 45 /* KeyCode.KeyO */ }
                }
            });
        }
        runCoreEditingCommand(editor, viewModel, args) {
            editor.pushUndoStop();
            editor.executeCommands(this.id, EnterOperation.lineBreakInsert(viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map(s => s.modelState.selection)));
        }
    });
    CoreEditingCommands.Outdent = registerEditorCommand(new class extends CoreEditingCommand {
        constructor() {
            super({
                id: 'outdent',
                precondition: EditorContextKeys.writable,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: ContextKeyExpr.and(EditorContextKeys.editorTextFocus, EditorContextKeys.tabDoesNotMoveFocus),
                    primary: 1024 /* KeyMod.Shift */ | 2 /* KeyCode.Tab */
                }
            });
        }
        runCoreEditingCommand(editor, viewModel, args) {
            editor.pushUndoStop();
            editor.executeCommands(this.id, TypeOperations.outdent(viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map(s => s.modelState.selection)));
            editor.pushUndoStop();
        }
    });
    CoreEditingCommands.Tab = registerEditorCommand(new class extends CoreEditingCommand {
        constructor() {
            super({
                id: 'tab',
                precondition: EditorContextKeys.writable,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: ContextKeyExpr.and(EditorContextKeys.editorTextFocus, EditorContextKeys.tabDoesNotMoveFocus),
                    primary: 2 /* KeyCode.Tab */
                }
            });
        }
        runCoreEditingCommand(editor, viewModel, args) {
            editor.pushUndoStop();
            editor.executeCommands(this.id, TypeOperations.tab(viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map(s => s.modelState.selection)));
            editor.pushUndoStop();
        }
    });
    CoreEditingCommands.DeleteLeft = registerEditorCommand(new class extends CoreEditingCommand {
        constructor() {
            super({
                id: 'deleteLeft',
                precondition: undefined,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: EditorContextKeys.textInputFocus,
                    primary: 1 /* KeyCode.Backspace */,
                    secondary: [1024 /* KeyMod.Shift */ | 1 /* KeyCode.Backspace */],
                    mac: { primary: 1 /* KeyCode.Backspace */, secondary: [1024 /* KeyMod.Shift */ | 1 /* KeyCode.Backspace */, 256 /* KeyMod.WinCtrl */ | 38 /* KeyCode.KeyH */, 256 /* KeyMod.WinCtrl */ | 1 /* KeyCode.Backspace */] }
                }
            });
        }
        runCoreEditingCommand(editor, viewModel, args) {
            const [shouldPushStackElementBefore, commands] = DeleteOperations.deleteLeft(viewModel.getPrevEditOperationType(), viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map(s => s.modelState.selection), viewModel.getCursorAutoClosedCharacters());
            if (shouldPushStackElementBefore) {
                editor.pushUndoStop();
            }
            editor.executeCommands(this.id, commands);
            viewModel.setPrevEditOperationType(2 /* EditOperationType.DeletingLeft */);
        }
    });
    CoreEditingCommands.DeleteRight = registerEditorCommand(new class extends CoreEditingCommand {
        constructor() {
            super({
                id: 'deleteRight',
                precondition: undefined,
                kbOpts: {
                    weight: CORE_WEIGHT,
                    kbExpr: EditorContextKeys.textInputFocus,
                    primary: 20 /* KeyCode.Delete */,
                    mac: { primary: 20 /* KeyCode.Delete */, secondary: [256 /* KeyMod.WinCtrl */ | 34 /* KeyCode.KeyD */, 256 /* KeyMod.WinCtrl */ | 20 /* KeyCode.Delete */] }
                }
            });
        }
        runCoreEditingCommand(editor, viewModel, args) {
            const [shouldPushStackElementBefore, commands] = DeleteOperations.deleteRight(viewModel.getPrevEditOperationType(), viewModel.cursorConfig, viewModel.model, viewModel.getCursorStates().map(s => s.modelState.selection));
            if (shouldPushStackElementBefore) {
                editor.pushUndoStop();
            }
            editor.executeCommands(this.id, commands);
            viewModel.setPrevEditOperationType(3 /* EditOperationType.DeletingRight */);
        }
    });
    CoreEditingCommands.Undo = new class extends EditorOrNativeTextInputCommand {
        constructor() {
            super(UndoCommand);
        }
        runDOMCommand(activeElement) {
            activeElement.ownerDocument.execCommand('undo');
        }
        runEditorCommand(accessor, editor, args) {
            if (!editor.hasModel() || editor.getOption(104 /* EditorOption.readOnly */) === true) {
                return;
            }
            return editor.getModel().undo();
        }
    }();
    CoreEditingCommands.Redo = new class extends EditorOrNativeTextInputCommand {
        constructor() {
            super(RedoCommand);
        }
        runDOMCommand(activeElement) {
            activeElement.ownerDocument.execCommand('redo');
        }
        runEditorCommand(accessor, editor, args) {
            if (!editor.hasModel() || editor.getOption(104 /* EditorOption.readOnly */) === true) {
                return;
            }
            return editor.getModel().redo();
        }
    }();
})(CoreEditingCommands || (CoreEditingCommands = {}));
/**
 * A command that will invoke a command on the focused editor.
 */
class EditorHandlerCommand extends Command {
    constructor(id, handlerId, metadata) {
        super({
            id: id,
            precondition: undefined,
            metadata
        });
        this._handlerId = handlerId;
    }
    runCommand(accessor, args) {
        const editor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
        if (!editor) {
            return;
        }
        editor.trigger('keyboard', this._handlerId, args);
    }
}
function registerOverwritableCommand(handlerId, metadata) {
    registerCommand(new EditorHandlerCommand('default:' + handlerId, handlerId));
    registerCommand(new EditorHandlerCommand(handlerId, handlerId, metadata));
}
registerOverwritableCommand("type" /* Handler.Type */, {
    description: `Type`,
    args: [{
            name: 'args',
            schema: {
                'type': 'object',
                'required': ['text'],
                'properties': {
                    'text': {
                        'type': 'string'
                    }
                },
            }
        }]
});
registerOverwritableCommand("replacePreviousChar" /* Handler.ReplacePreviousChar */);
registerOverwritableCommand("compositionType" /* Handler.CompositionType */);
registerOverwritableCommand("compositionStart" /* Handler.CompositionStart */);
registerOverwritableCommand("compositionEnd" /* Handler.CompositionEnd */);
registerOverwritableCommand("paste" /* Handler.Paste */);
registerOverwritableCommand("cut" /* Handler.Cut */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29yZUNvbW1hbmRzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9icm93c2VyL2NvcmVDb21tYW5kcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLGNBQWMsQ0FBQztBQUNwQyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFMUQsT0FBTyxLQUFLLEtBQUssTUFBTSw0QkFBNEIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFFNUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQW1CLHFCQUFxQixFQUFnQixXQUFXLEVBQUUsV0FBVyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakssT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDckUsT0FBTyxFQUFFLGVBQWUsRUFBdUIsTUFBTSwyQ0FBMkMsQ0FBQztBQUNqRyxPQUFPLEVBQUUsV0FBVyxFQUE0RCxNQUFNLDJCQUEyQixDQUFDO0FBQ2xILE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBRTlFLE9BQU8sRUFBRSxVQUFVLElBQUksV0FBVyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDdkcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQzFFLE9BQU8sRUFBYSxRQUFRLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNqRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFFaEQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFHbkUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBRWhGLE9BQU8s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