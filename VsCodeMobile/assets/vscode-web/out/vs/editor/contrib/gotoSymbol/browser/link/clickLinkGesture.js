/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import * as platform from '../../../../../base/common/platform.js';
function hasModifier(e, modifier) {
    return !!e[modifier];
}
/**
 * An event that encapsulates the various trigger modifiers logic needed for go to definition.
 */
export class ClickLinkMouseEvent {
    constructor(source, opts) {
        this.target = source.target;
        this.isLeftClick = source.event.leftButton;
        this.isMiddleClick = source.event.middleButton;
        this.isRightClick = source.event.rightButton;
        this.mouseMiddleClickAction = opts.mouseMiddleClickAction;
        this.hasTriggerModifier = hasModifier(source.event, opts.triggerModifier);
        if (this.isMiddleClick && opts.mouseMiddleClickAction === 'ctrlLeftClick') {
            // Redirect middle click to left click with modifier
            this.isMiddleClick = false;
            this.isLeftClick = true;
            this.hasTriggerModifier = true;
        }
        this.hasSideBySideModifier = hasModifier(source.event, opts.triggerSideBySideModifier);
        this.isNoneOrSingleMouseDown = (source.event.detail <= 1);
    }
}
/**
 * An event that encapsulates the various trigger modifiers logic needed for go to definition.
 */
export class ClickLinkKeyboardEvent {
    constructor(source, opts) {
        this.keyCodeIsTriggerKey = (source.keyCode === opts.triggerKey);
        this.keyCodeIsSideBySideKey = (source.keyCode === opts.triggerSideBySideKey);
        this.hasTriggerModifier = hasModifier(source, opts.triggerModifier);
    }
}
export class ClickLinkOptions {
    constructor(triggerKey, triggerModifier, triggerSideBySideKey, triggerSideBySideModifier, mouseMiddleClickAction) {
        this.mouseMiddleClickAction = mouseMiddleClickAction;
        this.triggerKey = triggerKey;
        this.triggerModifier = triggerModifier;
        this.triggerSideBySideKey = triggerSideBySideKey;
        this.triggerSideBySideModifier = triggerSideBySideModifier;
    }
    equals(other) {
        return (this.triggerKey === other.triggerKey
            && this.triggerModifier === other.triggerModifier
            && this.triggerSideBySideKey === other.triggerSideBySideKey
            && this.triggerSideBySideModifier === other.triggerSideBySideModifier
            && this.mouseMiddleClickAction === other.mouseMiddleClickAction);
    }
}
function createOptions(multiCursorModifier, mouseMiddleClickAction) {
    if (multiCursorModifier === 'altKey') {
        if (platform.isMacintosh) {
            return new ClickLinkOptions(57 /* KeyCode.Meta */, 'metaKey', 6 /* KeyCode.Alt */, 'altKey', mouseMiddleClickAction);
        }
        return new ClickLinkOptions(5 /* KeyCode.Ctrl */, 'ctrlKey', 6 /* KeyCode.Alt */, 'altKey', mouseMiddleClickAction);
    }
    if (platform.isMacintosh) {
        return new ClickLinkOptions(6 /* KeyCode.Alt */, 'altKey', 57 /* KeyCode.Meta */, 'metaKey', mouseMiddleClickAction);
    }
    return new ClickLinkOptions(6 /* KeyCode.Alt */, 'altKey', 5 /* KeyCode.Ctrl */, 'ctrlKey', mouseMiddleClickAction);
}
export class ClickLinkGesture extends Disposable {
    constructor(editor, opts) {
        super();
        this._onMouseMoveOrRelevantKeyDown = this._register(new Emitter());
        this.onMouseMoveOrRelevantKeyDown = this._onMouseMoveOrRelevantKeyDown.event;
        this._onExecute = this._register(new Emitter());
        this.onExecute = this._onExecute.event;
        this._onCancel = this._register(new Emitter());
        this.onCancel = this._onCancel.event;
        this._editor = editor;
        this._extractLineNumberFromMouseEvent = opts?.extractLineNumberFromMouseEvent ?? ((e) => e.target.position ? e.target.position.lineNumber : 0);
        this._opts = createOptions(this._editor.getOption(86 /* EditorOption.multiCursorModifier */), this._editor.getOption(87 /* EditorOption.mouseMiddleClickAction */));
        this._lastMouseMoveEvent = null;
        this._hasTriggerKeyOnMouseDown = false;
        this._lineNumberOnMouseDown = 0;
        this._register(this._editor.onDidChangeConfiguration((e) => {
            if (e.hasChanged(86 /* EditorOption.multiCursorModifier */) || e.hasChanged(87 /* EditorOption.mouseMiddleClickAction */)) {
                const newOpts = createOptions(this._editor.getOption(86 /* EditorOption.multiCursorModifier */), this._editor.getOption(87 /* EditorOption.mouseMiddleClickAction */));
                if (this._opts.equals(newOpts)) {
                    return;
                }
                this._opts = newOpts;
                this._lastMouseMoveEvent = null;
                this._hasTriggerKeyOnMouseDown = false;
                this._lineNumberOnMouseDown = 0;
                this._onCancel.fire();
            }
        }));
        this._register(this._editor.onMouseMove((e) => this._onEditorMouseMove(new ClickLinkMouseEvent(e, this._opts))));
        this._register(this._editor.onMouseDown((e) => this._onEditorMouseDown(new ClickLinkMouseEvent(e, this._opts))));
        this._register(this._editor.onMouseUp((e) => this._onEditorMouseUp(new ClickLinkMouseEvent(e, this._opts))));
        this._register(this._editor.onKeyDown((e) => this._onEditorKeyDown(new ClickLinkKeyboardEvent(e, this._opts))));
        this._register(this._editor.onKeyUp((e) => this._onEditorKeyUp(new ClickLinkKeyboardEvent(e, this._opts))));
        this._register(this._editor.onMouseDrag(() => this._resetHandler()));
        this._register(this._editor.onDidChangeCursorSelection((e) => this._onDidChangeCursorSelection(e)));
        this._register(this._editor.onDidChangeModel((e) => this._resetHandler()));
        this._register(this._editor.onDidChangeModelContent(() => this._resetHandler()));
        this._register(this._editor.onDidScrollChange((e) => {
            if (e.scrollTopChanged || e.scrollLeftChanged) {
                this._resetHandler();
            }
        }));
    }
    _onDidChangeCursorSelection(e) {
        if (e.selection && e.selection.startColumn !== e.selection.endColumn) {
            this._resetHandler(); // immediately stop this feature if the user starts to select (https://github.com/microsoft/vscode/issues/7827)
        }
    }
    _onEditorMouseMove(mouseEvent) {
        this._lastMouseMoveEvent = mouseEvent;
        this._onMouseMoveOrRelevantKeyDown.fire([mouseEvent, null]);
    }
    _onEditorMouseDown(mouseEvent) {
        // We need to record if we had the trigger key on mouse down because someone might select something in the editor
        // holding the mouse down and then while mouse is down start to press Ctrl/Cmd to start a copy operation and then
        // release the mouse button without wanting to do the navigation.
        // With this flag we prevent goto definition if the mouse was down before the trigger key was pressed.
        this._hasTriggerKeyOnMouseDown = mouseEvent.hasTriggerModifier;
        this._lineNumberOnMouseDown = this._extractLineNumberFromMouseEvent(mouseEvent);
    }
    _onEditorMouseUp(mouseEvent) {
        const currentLineNumber = this._extractLineNumberFromMouseEvent(mouseEvent);
        const lineNumbersCorrect = !!this._lineNumberOnMouseDown && this._lineNumberOnMouseDown === currentLineNumber;
        if (lineNumbersCorrect && (this._hasTriggerKeyOnMouseDown || (mouseEvent.isMiddleClick && mouseEvent.mouseMiddleClickAction === 'openLink'))) {
            this._onExecute.fire(mouseEvent);
        }
    }
    _onEditorKeyDown(e) {
        if (this._lastMouseMoveEvent
            && (e.keyCodeIsTriggerKey // User just pressed Ctrl/Cmd (normal goto definition)
                || (e.keyCodeIsSideBySideKey && e.hasTriggerModifier) // User pressed Ctrl/Cmd+Alt (goto definition to the side)
            )) {
            this._onMouseMoveOrRelevantKeyDown.fire([this._lastMouseMoveEvent, e]);
        }
        else if (e.hasTriggerModifier) {
            this._onCancel.fire(); // remove decorations if user holds another key with ctrl/cmd to prevent accident goto declaration
        }
    }
    _onEditorKeyUp(e) {
        if (e.keyCodeIsTriggerKey) {
            this._onCancel.fire();
        }
    }
    _resetHandler() {
        this._lastMouseMoveEvent = null;
        this._hasTriggerKeyOnMouseDown = false;
        this._onCancel.fire();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpY2tMaW5rR2VzdHVyZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9nb3RvU3ltYm9sL2Jyb3dzZXIvbGluay9jbGlja0xpbmtHZXN0dXJlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxxQ0FBcUMsQ0FBQztBQUVyRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckUsT0FBTyxLQUFLLFFBQVEsTUFBTSx3Q0FBd0MsQ0FBQztBQUtuRSxTQUFTLFdBQVcsQ0FBQyxDQUE2RSxFQUFFLFFBQXVEO0lBQzFKLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUN0QixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLE9BQU8sbUJBQW1CO0lBWS9CLFlBQVksTUFBeUIsRUFBRSxJQUFzQjtRQUM1RCxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDNUIsSUFBSSxDQUFDLFdBQVcsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQztRQUMzQyxJQUFJLENBQUMsYUFBYSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDO1FBQy9DLElBQUksQ0FBQyxZQUFZLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUM7UUFDN0MsSUFBSSxDQUFDLHNCQUFzQixHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQztRQUMxRCxJQUFJLENBQUMsa0JBQWtCLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRTFFLElBQUksSUFBSSxDQUFDLGFBQWEsSUFBSSxJQUFJLENBQUMsc0JBQXNCLEtBQUssZUFBZSxFQUFFLENBQUM7WUFD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