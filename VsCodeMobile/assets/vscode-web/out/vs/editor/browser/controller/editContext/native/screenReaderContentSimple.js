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
import { addDisposableListener, getActiveWindow } from '../../../../../base/browser/dom.js';
import { IAccessibilityService } from '../../../../../platform/accessibility/common/accessibility.js';
import { Selection } from '../../../../common/core/selection.js';
import { SimplePagedScreenReaderStrategy } from '../screenReaderUtils.js';
import { PositionOffsetTransformer } from '../../../../common/core/text/positionToOffset.js';
import { Disposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { IME } from '../../../../../base/common/ime.js';
let SimpleScreenReaderContent = class SimpleScreenReaderContent extends Disposable {
    constructor(_domNode, _context, _viewController, _accessibilityService) {
        super();
        this._domNode = _domNode;
        this._context = _context;
        this._viewController = _viewController;
        this._accessibilityService = _accessibilityService;
        this._selectionChangeListener = this._register(new MutableDisposable());
        this._accessibilityPageSize = 1;
        this._ignoreSelectionChangeTime = 0;
        this._strategy = new SimplePagedScreenReaderStrategy();
        this.onConfigurationChanged(this._context.configuration.options);
    }
    updateScreenReaderContent(primarySelection) {
        const domNode = this._domNode.domNode;
        const focusedElement = getActiveWindow().document.activeElement;
        if (!focusedElement || focusedElement !== domNode) {
            return;
        }
        const isScreenReaderOptimized = this._accessibilityService.isScreenReaderOptimized();
        if (isScreenReaderOptimized) {
            this._state = this._getScreenReaderContentState(primarySelection);
            if (domNode.textContent !== this._state.value) {
                this._setIgnoreSelectionChangeTime('setValue');
                domNode.textContent = this._state.value;
            }
            const selection = getActiveWindow().document.getSelection();
            if (!selection) {
                return;
            }
            const data = this._getScreenReaderRange(this._state.selectionStart, this._state.selectionEnd);
            if (!data) {
                return;
            }
            this._setIgnoreSelectionChangeTime('setRange');
            selection.setBaseAndExtent(data.anchorNode, data.anchorOffset, data.focusNode, data.focusOffset);
        }
        else {
            this._state = undefined;
            this._setIgnoreSelectionChangeTime('setValue');
            this._domNode.domNode.textContent = '';
        }
    }
    updateScrollTop(primarySelection) {
        if (!this._state) {
            return;
        }
        const viewLayout = this._context.viewModel.viewLayout;
        const stateStartLineNumber = this._state.startPositionWithinEditor.lineNumber;
        const verticalOffsetOfStateStartLineNumber = viewLayout.getVerticalOffsetForLineNumber(stateStartLineNumber);
        const verticalOffsetOfPositionLineNumber = viewLayout.getVerticalOffsetForLineNumber(primarySelection.positionLineNumber);
        this._domNode.domNode.scrollTop = verticalOffsetOfPositionLineNumber - verticalOffsetOfStateStartLineNumber;
    }
    onFocusChange(newFocusValue) {
        if (newFocusValue) {
            this._selectionChangeListener.value = this._setSelectionChangeListener();
        }
        else {
            this._selectionChangeListener.value = undefined;
        }
    }
    onConfigurationChanged(options) {
        this._accessibilityPageSize = options.get(3 /* EditorOption.accessibilityPageSize */);
    }
    onWillCut() {
        this._setIgnoreSelectionChangeTime('onCut');
    }
    onWillPaste() {
        this._setIgnoreSelectionChangeTime('onWillPaste');
    }
    // --- private methods
    _setIgnoreSelectionChangeTime(reason) {
        this._ignoreSelectionChangeTime = Date.now();
    }
    _setSelectionChangeListener() {
        // See https://github.com/microsoft/vscode/issues/27216 and https://github.com/microsoft/vscode/issues/98256
        // When using a Braille display or NVDA for example, it is possible for users to reposition the
        // system caret. This is reflected in Chrome as a `selectionchange` event and needs to be reflected within the editor.
        // `selectionchange` events often come multiple times for a single logical change
        // so throttle multiple `selectionchange` events that burst in a short period of time.
        let previousSelectionChangeEventTime = 0;
        return addDisposableListener(this._domNode.domNode.ownerDocument, 'selectionchange', () => {
            const isScreenReaderOptimized = this._accessibilityService.isScreenReaderOptimized();
            if (!this._state || !isScreenReaderOptimized || !IME.enabled) {
                return;
            }
            const activeElement = getActiveWindow().document.activeElement;
            const isFocused = activeElement === this._domNode.domNode;
            if (!isFocused) {
                return;
            }
            const selection = getActiveWindow().document.getSelection();
            if (!selection) {
                return;
            }
            const rangeCount = selection.rangeCount;
            if (rangeCount === 0) {
                return;
            }
            const range = selection.getRangeAt(0);
            const now = Date.now();
            const delta1 = now - previousSelectionChangeEventTime;
            previousSelectionChangeEventTime = now;
            if (delta1 < 5) {
                // received another `selectionchange` event within 5ms of the previous `selectionchange` event
                // => ignore it
                return;
            }
            const delta2 = now - this._ignoreSelectionChangeTime;
            this._ignoreSelectionChangeTime = 0;
            if (delta2 < 100) {
                // received a `selectionchange` event within 100ms since we touched the hidden div
                // => ignore it, since we caused it
                return;
            }
            this._viewController.setSelection(this._getEditorSelectionFromDomRange(this._context, this._state, selection.direction, range));
        });
    }
    _getScreenReaderContentState(primarySelection) {
        const state = this._strategy.fromEditorSelection(this._context.viewModel, primarySelection, this._accessibilityPageSize, this._accessibilityService.getAccessibilitySupport() === 0 /* AccessibilitySupport.Unknown */);
        const endPosition = this._context.viewModel.model.getPositionAt(Infinity);
        let value = state.value;
        if (endPosition.column === 1 && primarySelection.getEndPosition().equals(endPosition)) {
            value += '\n';
        }
        state.value = value;
        return state;
    }
    _getScreenReaderRange(selectionOffsetStart, selectionOffsetEnd) {
        const textContent = this._domNode.domNode.firstChild;
        if (!textContent) {
            return;
        }
        const range = new globalThis.Range();
        range.setStart(textContent, selectionOffsetStart);
        range.setEnd(textContent, selectionOffsetEnd);
        return {
            anchorNode: textContent,
            anchorOffset: selectionOffsetStart,
            focusNode: textContent,
            focusOffset: selectionOffsetEnd
        };
    }
    _getEditorSelectionFromDomRange(context, state, direction, range) {
        const viewModel = context.viewModel;
        const model = viewModel.model;
        const coordinatesConverter = viewModel.coordinatesConverter;
        const modelScreenReaderContentStartPositionWithinEditor = coordinatesConverter.convertViewPositionToModelPosition(state.startPositionWithinEditor);
        const offsetOfStartOfScreenReaderContent = model.getOffsetAt(modelScreenReaderContentStartPositionWithinEditor);
        let offsetOfSelectionStart = range.startOffset + offsetOfStartOfScreenReaderContent;
        let offsetOfSelectionEnd = range.endOffset + offsetOfStartOfScreenReaderContent;
        const modelUsesCRLF = model.getEndOfLineSequence() === 1 /* EndOfLineSequence.CRLF */;
        if (modelUsesCRLF) {
            const screenReaderContentText = state.value;
            const offsetTransformer = new PositionOffsetTransformer(screenReaderContentText);
            const positionOfStartWithinText = offsetTransformer.getPosition(range.startOffset);
            const positionOfEndWithinText = offsetTransformer.getPosition(range.endOffset);
            offsetOfSelectionStart += positionOfStartWithinText.lineNumber - 1;
            offsetOfSelectionEnd += positionOfEndWithinText.lineNumber - 1;
        }
        const positionOfSelectionStart = model.getPositionAt(offsetOfSelectionStart);
        const positionOfSelectionEnd = model.getPositionAt(offsetOfSelectionEnd);
        const selectionStart = direction === 'forward' ? positionOfSelectionStart : positionOfSelectionEnd;
        const selectionEnd = direction === 'forward' ? positionOfSelectionEnd : positionOfSelectionStart;
        return Selection.fromPositions(selectionStart, selectionEnd);
    }
};
SimpleScreenReaderContent = __decorate([
    __param(3, IAccessibilityService)
], SimpleScreenReaderContent);
export { SimpleScreenReaderContent };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyZWVuUmVhZGVyQ29udGVudFNpbXBsZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci9jb250cm9sbGVyL2VkaXRDb250ZXh0L25hdGl2ZS9zY3JlZW5SZWFkZXJDb250ZW50U2ltcGxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxlQUFlLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUU1RixPQUFPLEVBQXdCLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFJNUgsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSwrQkFBK0IsRUFBbUMsTUFBTSx5QkFBeUIsQ0FBQztBQUMzRyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM3RixPQUFPLEVBQUUsVUFBVSxFQUFlLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckcsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBSWpELElBQU0seUJBQXlCLEdBQS9CLE1BQU0seUJBQTBCLFNBQVEsVUFBVTtJQVV4RCxZQUNrQixRQUFrQyxFQUNsQyxRQUFxQixFQUNyQixlQUErQixFQUN6QixxQkFBNkQ7UUFFcEYsS0FBSyxFQUFFLENBQUM7UUFMUyxhQUFRLEdBQVIsUUFBUSxDQUEwQjtRQUNsQyxhQUFRLEdBQVIsUUFBUSxDQUFhO1FBQ3JCLG9CQUFlLEdBQWYsZUFBZSxDQUFnQjtRQUNSLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBdUI7UUFacEUsNkJBQXdCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGlCQUFpQixFQUFFLENBQUMsQ0FBQztRQUU1RSwyQkFBc0IsR0FBVyxDQUFDLENBQUM7UUFDbkMs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