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
import './nativeEditContext.css';
import { isFirefox } from '../../../../../base/browser/browser.js';
import { addDisposableListener, getActiveElement, getWindow, getWindowId } from '../../../../../base/browser/dom.js';
import { FastDomNode } from '../../../../../base/browser/fastDomNode.js';
import { StandardKeyboardEvent } from '../../../../../base/browser/keyboardEvent.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ClipboardEventUtils, getDataToCopy, InMemoryClipboardMetadataManager } from '../clipboardUtils.js';
import { AbstractEditContext } from '../editContext.js';
import { editContextAddDisposableListener, FocusTracker } from './nativeEditContextUtils.js';
import { ScreenReaderSupport } from './screenReaderSupport.js';
import { Range } from '../../../../common/core/range.js';
import { Selection } from '../../../../common/core/selection.js';
import { Position } from '../../../../common/core/position.js';
import { PositionOffsetTransformer } from '../../../../common/core/text/positionToOffset.js';
import { EditContext } from './editContextFactory.js';
import { NativeEditContextRegistry } from './nativeEditContextRegistry.js';
import { isHighSurrogate, isLowSurrogate } from '../../../../../base/common/strings.js';
import { IME } from '../../../../../base/common/ime.js';
import { OffsetRange } from '../../../../common/core/ranges/offsetRange.js';
import { ILogService, LogLevel } from '../../../../../platform/log/common/log.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { inputLatency } from '../../../../../base/browser/performance.js';
// Corresponds to classes in nativeEditContext.css
var CompositionClassName;
(function (CompositionClassName) {
    CompositionClassName["NONE"] = "edit-context-composition-none";
    CompositionClassName["SECONDARY"] = "edit-context-composition-secondary";
    CompositionClassName["PRIMARY"] = "edit-context-composition-primary";
})(CompositionClassName || (CompositionClassName = {}));
let NativeEditContext = class NativeEditContext extends AbstractEditContext {
    constructor(ownerID, context, overflowGuardContainer, _viewController, _visibleRangeProvider, instantiationService, logService) {
        super(context);
        this._viewController = _viewController;
        this._visibleRangeProvider = _visibleRangeProvider;
        this.logService = logService;
        this._previousEditContextSelection = new OffsetRange(0, 0);
        this._editContextPrimarySelection = new Selection(1, 1, 1, 1);
        this._decorations = [];
        this._primarySelection = new Selection(1, 1, 1, 1);
        this._targetWindowId = -1;
        this._scrollTop = 0;
        this._scrollLeft = 0;
        this._linesVisibleRanges = null;
        this.domNode = new FastDomNode(document.createElement('div'));
        this.domNode.setClassName(`native-edit-context`);
        this._imeTextArea = new FastDomNode(document.createElement('textarea'));
        this._imeTextArea.setClassName(`ime-text-area`);
        this._imeTextArea.setAttribute('readonly', 'true');
        this._imeTextArea.setAttribute('tabindex', '-1');
        this._imeTextArea.setAttribute('aria-hidden', 'true');
        this.domNode.setAttribute('autocorrect', 'off');
        this.domNode.setAttribute('autocapitalize', 'off');
        this.domNode.setAttribute('autocomplete', 'off');
        this.domNode.setAttribute('spellcheck', 'false');
        this._updateDomAttributes();
        overflowGuardContainer.appendChild(this.domNode);
        overflowGuardContainer.appendChild(this._imeTextArea);
        this._parent = overflowGuardContainer.domNode;
        this._focusTracker = this._register(new FocusTracker(logService, this.domNode.domNode, (newFocusValue) => {
            logService.trace('NativeEditContext#handleFocusChange : ', newFocusValue);
            this._screenReaderSupport.handleFocusChange(newFocusValue);
            this._context.viewModel.setHasFocus(newFocusValue);
        }));
        const window = getWindow(this.domNode.domNode);
        this._editContext = EditContext.create(window);
        this.setEditContextOnDomNode();
        this._screenReaderSupport = this._register(instantiationService.createInstance(ScreenReaderSupport, this.domNode, context, this._viewController));
        this._register(addDisposableListener(this.domNode.domNode, 'copy', (e) => {
            this.logService.trace('NativeEditContext#copy');
            this._ensureClipboardGetsEditorSelection(e);
        }));
        this._register(addDisposableListener(this.domNode.domNode, 'cut', (e) => {
            this.logService.trace('NativeEditContext#cut');
            // Pretend here we touched the text area, as the `cut` event will most likely
            // result in a `selectionchange` event which we want to ignore
            this._screenReaderSupport.onWillCut();
            this._ensureClipboardGetsEditorSelection(e);
            this.logService.trace('NativeEditContext#cut (before viewController.cut)');
            this._viewController.cut();
        }));
        this._register(addDisposableListener(this.domNode.domNode, 'selectionchange', () => {
            inputLatency.onSelectionChange();
        }));
        this._register(addDisposableListener(this.domNode.domNode, 'keyup', (e) => this._onKeyUp(e)));
        this._register(addDisposableListener(this.domNode.domNode, 'keydown', async (e) => this._onKeyDown(e)));
        this._register(addDisposableListener(this._imeTextArea.domNode, 'keyup', (e) => this._onKeyUp(e)));
        this._register(addDisposableListener(this._imeTextArea.domNode, 'keydown', async (e) => this._onKeyDown(e)));
        this._register(addDisposableListener(this.domNode.domNode, 'beforeinput', async (e) => {
            inputLatency.onBeforeInput();
            if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
                this._onType(this._viewController, { text: '\n', replacePrevCharCnt: 0, replaceNextCharCnt: 0, positionDelta: 0 });
            }
        }));
        this._register(addDisposableListener(this.domNode.domNode, 'paste', (e) => {
            this.logService.trace('NativeEditContext#paste');
            e.preventDefault();
            if (!e.clipboardData) {
                return;
            }
            let [text, metadata] = ClipboardEventUtils.getTextData(e.clipboardData);
            this.logService.trace('NativeEditContext#paste with id : ', metadata?.id, ' with text.length: ', text.length);
            if (!text) {
                return;
            }
            metadata = metadata || InMemoryClipboardMetadataManager.INSTANCE.get(text);
            let pasteOnNewLine = false;
            let multicursorText = null;
            let mode = null;
            if (metadata) {
                const options = this._context.configuration.options;
                const emptySelectionClipboard = options.get(45 /* EditorOption.emptySelectionClipboard */);
                pasteOnNewLine = emptySelectionClipboard && !!metadata.isFromEmptySelection;
                multicursorText = typeof metadata.multicursorText !== 'undefined' ? metadata.multicursorText : null;
                mode = metadata.mode;
            }
            this.logService.trace('NativeEditContext#paste (before viewController.paste)');
            this._viewController.paste(text, pasteOnNewLine, multicursorText, mode);
        }));
        // Edit context events
        this._register(editContextAddDisposableListener(this._editContext, 'textformatupdate', (e) => this._handleTextFormatUpdate(e)));
        this._register(editContextAddDisposableListener(this._editContext, 'characterboundsupdate', (e) => this._updateCharacterBounds(e)));
        let highSurrogateCharacter;
        this._register(editContextAddDisposableListener(this._editContext, 'textupdate', (e) => {
            inputLatency.onInput();
            const text = e.text;
            if (text.length === 1) {
                const charCode = text.charCodeAt(0);
                if (isHighSurrogate(charCode)) {
                    highSurrogateCharacter = text;
                    return;
                }
                if (isLowSurrogate(charCode) && highSurrogateCharacter) {
                    const textUpdateEvent = {
                        text: highSurrogateCharacter + text,
                        selectionEnd: e.selectionEnd,
                        selectionStart: e.selectionStart,
                        updateRangeStart: e.updateRangeStart - 1,
                        updateRangeEnd: e.updateRangeEnd - 1
                    };
                    highSurrogateCharacter = undefined;
                    this._emitTypeEvent(this._viewController, textUpdateEvent);
                    return;
                }
            }
            this._emitTypeEvent(this._viewController, e);
        }));
        this._register(editContextAddDisposableListener(this._editContext, 'compositionstart', (e) => {
            this._updateEditContext();
            // Utlimately fires onDidCompositionStart() on the editor to notify for example suggest model of composition state
            // Updates the composition state of the cursor controller which determines behavior of typing with interceptors
            this._viewController.compositionStart();
            // Emits ViewCompositionStartEvent which can be depended on by ViewEventHandlers
            this._context.viewModel.onCompositionStart();
        }));
        this._register(editContextAddDisposableListener(this._editContext, 'compositionend', (e) => {
            this._updateEditContext();
            // Utlimately fires compositionEnd() on the editor to notify for example suggest model of composition state
            // Updates the composition state of the cursor controller which determines behavior of typing with interceptors
            this._viewController.compositionEnd();
            // Emits ViewCompositionEndEvent which can be depended on by ViewEventHandlers
            this._context.viewModel.onCompositionEnd();
        }));
        let reenableTracking = false;
        this._register(IME.onDidChange(() => {
            if (IME.enabled && reenableTracking) {
                this._focusTracker.resume();
                this.domNode.focus();
                reenableTracking = false;
            }
            if (!IME.enabled && this.isFocused()) {
                this._focusTracker.pause();
                this._imeTextArea.focus();
                reenableTracking = true;
            }
        }));
        this._register(NativeEditContextRegistry.register(ownerID, this));
    }
    // --- Public methods ---
    dispose() {
        // Force blue the dom node so can write in pane with no native edit context after disposal
        this.domNode.domNode.editContext = undefined;
        this.domNode.domNode.blur();
        this.domNode.domNode.remove();
        this._imeTextArea.domNode.remove();
        super.dispose();
    }
    setAriaOptions(options) {
        this._screenReaderSupport.setAriaOptions(options);
    }
    /* Last rendered data needed for correct hit-testing and determining the mouse position.
     * Without this, the selection will blink as incorrect mouse position is calculated */
    getLastRenderData() {
        return this._primarySelection.getPosition();
    }
    prepareRender(ctx) {
        this._screenReaderSupport.prepareRender(ctx);
        this._updateSelectionAndControlBoundsData(ctx);
    }
    onDidRender() {
        this._updateSelectionAndControlBoundsAfterRender();
    }
    render(ctx) {
        this._screenReaderSupport.render(ctx);
    }
    onCursorStateChanged(e) {
        this._primarySelection = e.modelSelections[0] ?? new Selection(1, 1, 1, 1);
        this._screenReaderSupport.onCursorStateChanged(e);
        this._updateEditContext();
        return true;
    }
    onConfigurationChanged(e) {
        this._screenReaderSupport.onConfigurationChanged(e);
        this._updateDomAttributes();
        return true;
    }
    onDecorationsChanged(e) {
        // true for inline decorations that can end up relayouting text
        return true;
    }
    onFlushed(e) {
        return true;
    }
    onLinesChanged(e) {
        this._updateEditContextOnLineChange(e.fromLineNumber, e.fromLineNumber + e.count - 1);
        return true;
    }
    onLinesDeleted(e) {
        this._updateEditContextOnLineChange(e.fromLineNumber, e.toLineNumber);
        return true;
    }
    onLinesInserted(e) {
        this._updateEditContextOnLineChange(e.fromLineNumber, e.toLineNumber);
        return true;
    }
    _updateEditContextOnLineChange(fromLineNumber, toLineNumber) {
        if (this._editContextPrimarySelection.endLineNumber < fromLineNumber || this._editContextPrimarySelection.startLineNumber > toLineNumber) {
            return;
        }
        this._updateEditContext();
    }
    onScrollChanged(e) {
        this._scrollLeft = e.scrollLeft;
        this._scrollTop = e.scrollTop;
        return true;
    }
    onZonesChanged(e) {
        return true;
    }
    onWillPaste() {
        this.logService.trace('NativeEditContext#onWillPaste');
        this._onWillPaste();
    }
    _onWillPaste() {
        this._screenReaderSupport.onWillPaste();
    }
    onWillCopy() {
        this.logService.trace('NativeEditContext#onWillCopy');
        this.logService.trace('NativeEditContext#isFocused : ', this.domNode.domNode === getActiveElement());
    }
    writeScreenReaderContent() {
        this._screenReaderSupport.writeScreenReaderContent();
    }
    isFocused() {
        return this._focusTracker.isFocused;
    }
    focus() {
        this._focusTracker.focus();
        // If the editor is off DOM, focus cannot be really set, so let's double check that we have managed to set the focus
        this.refreshFocusState();
    }
    refreshFocusState() {
        this._focusTracker.refreshFocusState();
    }
    // TODO: added as a workaround fix for https://github.com/microsoft/vscode/issues/229825
    // When this issue will be fixed the following should be removed.
    setEditContextOnDomNode() {
        const targetWindow = getWindow(this.domNode.domNode);
        const targetWindowId = getWindowId(targetWindow);
        if (this._targetWindowId !== targetWindowId) {
            this.domNode.domNode.editContext = this._editContext;
            this._targetWindowId = targetWindowId;
        }
    }
    // --- Private methods ---
    _onKeyUp(e) {
        inputLatency.onKeyUp();
        this._viewController.emitKeyUp(new StandardKeyboardEvent(e));
    }
    _onKeyDown(e) {
        inputLatency.onKeyDown();
        const standardKeyboardEvent = new StandardKeyboardEvent(e);
        // When the IME is visible, the keys, like arrow-left and arrow-right, should be used to navigate in the IME, and should not be propagated further
        if (standardKeyboardEvent.keyCode === 114 /* KeyCode.KEY_IN_COMPOSITION */) {
            standardKeyboardEvent.stopPropagation();
        }
        this._viewController.emitKeyDown(standardKeyboardEvent);
    }
    _updateDomAttributes() {
        const options = this._context.configuration.options;
        this.domNode.domNode.setAttribute('tabindex', String(options.get(140 /* EditorOption.tabIndex */)));
    }
    _updateEditContext() {
        const editContextState = this._getNewEditContextState();
        if (!editContextState) {
            return;
        }
        this._editContext.updateText(0, Number.MAX_SAFE_INTEGER, editContextState.text ?? ' ');
        this._editContext.updateSelection(editContextState.selectionStartOffset, editContextState.selectionEndOffset);
        this._editContextPrimarySelection = editContextState.editContextPrimarySelection;
        this._previousEditContextSelection = new OffsetRange(editContextState.selectionStartOffset, editContextState.selectionEndOffset);
    }
    _emitTypeEvent(viewController, e) {
        if (!this._editContext) {
            return;
        }
        const selectionEndOffset = this._previousEditContextSelection.endExclusive;
        const selectionStartOffset = this._previousEditContextSelection.start;
        this._previousEditContextSelection = new OffsetRange(e.selectionStart, e.selectionEnd);
        let replaceNextCharCnt = 0;
        let replacePrevCharCnt = 0;
        if (e.updateRangeEnd > selectionEndOffset) {
            replaceNextCharCnt = e.updateRangeEnd - selectionEndOffset;
        }
        if (e.updateRangeStart < selectionStartOffset) {
            replacePrevCharCnt = selectionStartOffset - e.updateRangeStart;
        }
        let text = '';
        if (selectionStartOffset < e.updateRangeStart) {
            text += this._editContext.text.substring(selectionStartOffset, e.updateRangeStart);
        }
        text += e.text;
        if (selectionEndOffset > e.updateRangeEnd) {
            text += this._editContext.text.substring(e.updateRangeEnd, selectionEndOffset);
        }
        let positionDelta = 0;
        if (e.selectionStart === e.selectionEnd && selectionStartOffset === selectionEndOffset) {
            positionDelta = e.selectionStart - (e.updateRangeStart + e.text.length);
        }
        const typeInput = {
            text,
            replacePrevCharCnt,
            replaceNextCharCnt,
            positionDelta
        };
        this._onType(viewController, typeInput);
    }
    _onType(viewController, typeInput) {
        if (typeInput.replacePrevCharCnt || typeInput.replaceNextCharCnt || typeInput.positionDelta) {
            viewController.compositionType(typeInput.text, typeInput.replacePrevCharCnt, typeInput.replaceNextCharCnt, typeInput.positionDelta);
        }
        else {
            viewController.type(typeInput.text);
        }
    }
    _getNewEditContextState() {
        const editContextPrimarySelection = this._primarySelection;
        const model = this._context.viewModel.model;
        if (!model.isValidRange(editContextPrimarySelection)) {
            return;
        }
        const primarySelectionStartLine = editContextPrimarySelection.startLineNumber;
        const primarySelectionEndLine = editContextPrimarySelection.endLineNumber;
        const endColumnOfEndLineNumber = model.getLineMaxColumn(primarySelectionEndLine);
        const rangeOfText = new Range(primarySelectionStartLine, 1, primarySelectionEndLine, endColumnOfEndLineNumber);
        const text = model.getValueInRange(rangeOfText, 0 /* EndOfLinePreference.TextDefined */);
        const selectionStartOffset = editContextPrimarySelection.startColumn - 1;
        const selectionEndOffset = text.length + editContextPrimarySelection.endColumn - endColumnOfEndLineNumber;
        return {
            text,
            selectionStartOffset,
            selectionEndOffset,
            editContextPrimarySelection
        };
    }
    _editContextStartPosition() {
        return new Position(this._editContextPrimarySelection.startLineNumber, 1);
    }
    _handleTextFormatUpdate(e) {
        if (!this._editContext) {
            return;
        }
        const formats = e.getTextFormats();
        const editContextStartPosition = this._editContextStartPosition();
        const decorations = [];
        formats.forEach(f => {
            const textModel = this._context.viewModel.model;
            const offsetOfEditContextText = textModel.getOffsetAt(editContextStartPosition);
            const startPositionOfDecoration = textModel.getPositionAt(offsetOfEditContextText + f.rangeStart);
            const endPositionOfDecoration = textModel.getPositionAt(offsetOfEditContextText + f.rangeEnd);
            const decorationRange = Range.fromPositions(startPositionOfDecoration, endPositionOfDecoration);
            const thickness = f.underlineThickness.toLowerCase();
            let decorationClassName = CompositionClassName.NONE;
            switch (thickness) {
                case 'thin':
                    decorationClassName = CompositionClassName.SECONDARY;
                    break;
                case 'thick':
                    decorationClassName = CompositionClassName.PRIMARY;
                    break;
            }
            decorations.push({
                range: decorationRange,
                options: {
                    description: 'textFormatDecoration',
                    inlineClassName: decorationClassName,
                }
            });
        });
        this._decorations = this._context.viewModel.model.deltaDecorations(this._decorations, decorations);
    }
    _updateSelectionAndControlBoundsData(ctx) {
        const viewSelection = this._context.viewModel.coordinatesConverter.convertModelRangeToViewRange(this._primarySelection);
        if (this._primarySelection.isEmpty()) {
            const linesVisibleRanges = ctx.visibleRangeForPosition(viewSelection.getStartPosition());
            this._linesVisibleRanges = linesVisibleRanges;
        }
        else {
            this._linesVisibleRanges = null;
        }
    }
    _updateSelectionAndControlBoundsAfterRender() {
        const options = this._context.configuration.options;
        const contentLeft = options.get(165 /* EditorOption.layoutInfo */).contentLeft;
        const viewSelection = this._context.viewModel.coordinatesConverter.convertModelRangeToViewRange(this._primarySelection);
        const verticalOffsetStart = this._context.viewLayout.getVerticalOffsetForLineNumber(viewSelection.startLineNumber);
        const verticalOffsetEnd = this._context.viewLayout.getVerticalOffsetAfterLineNumber(viewSelection.endLineNumber);
        // Make sure this doesn't force an extra layout (i.e. don't call it before rendering finished)
        const parentBounds = this._parent.getBoundingClientRect();
        const top = parentBounds.top + verticalOffsetStart - this._scrollTop;
        const height = verticalOffsetEnd - verticalOffsetStart;
        let left = parentBounds.left + contentLeft - this._scrollLeft;
        let width;
        if (this._primarySelection.isEmpty()) {
            if (this._linesVisibleRanges) {
                left += this._linesVisibleRanges.left;
            }
            width = 0;
        }
        else {
            width = parentBounds.width - contentLeft;
        }
        const selectionBounds = new DOMRect(left, top, width, height);
        this._editContext.updateSelectionBounds(selectionBounds);
        this._editContext.updateControlBounds(selectionBounds);
    }
    _updateCharacterBounds(e) {
        const options = this._context.configuration.options;
        const typicalHalfWidthCharacterWidth = options.get(59 /* EditorOption.fontInfo */).typicalHalfwidthCharacterWidth;
        const contentLeft = options.get(165 /* EditorOption.layoutInfo */).contentLeft;
        const parentBounds = this._parent.getBoundingClientRect();
        const characterBounds = [];
        const offsetTransformer = new PositionOffsetTransformer(this._editContext.text);
        for (let offset = e.rangeStart; offset < e.rangeEnd; offset++) {
            const editContextStartPosition = offsetTransformer.getPosition(offset);
            const textStartLineOffsetWithinEditor = this._editContextPrimarySelection.startLineNumber - 1;
            const characterStartPosition = new Position(textStartLineOffsetWithinEditor + editContextStartPosition.lineNumber, editContextStartPosition.column);
            const characterEndPosition = characterStartPosition.delta(0, 1);
            const characterModelRange = Range.fromPositions(characterStartPosition, characterEndPosition);
            const characterViewRange = this._context.viewModel.coordinatesConverter.convertModelRangeToViewRange(characterModelRange);
            const characterLinesVisibleRanges = this._visibleRangeProvider.linesVisibleRangesForRange(characterViewRange, true) ?? [];
            const lineNumber = characterViewRange.startLineNumber;
            const characterVerticalOffset = this._context.viewLayout.getVerticalOffsetForLineNumber(lineNumber);
            const top = parentBounds.top + characterVerticalOffset - this._scrollTop;
            let left = 0;
            let width = typicalHalfWidthCharacterWidth;
            if (characterLinesVisibleRanges.length > 0) {
                for (const visibleRange of characterLinesVisibleRanges[0].ranges) {
                    left = visibleRange.left;
                    width = visibleRange.width;
                    break;
                }
            }
            const lineHeight = this._context.viewLayout.getLineHeightForLineNumber(lineNumber);
            characterBounds.push(new DOMRect(parentBounds.left + contentLeft + left - this._scrollLeft, top, width, lineHeight));
        }
        this._editContext.updateCharacterBounds(e.rangeStart, characterBounds);
    }
    _ensureClipboardGetsEditorSelection(e) {
        const options = this._context.configuration.options;
        const emptySelectionClipboard = options.get(45 /* EditorOption.emptySelectionClipboard */);
        const copyWithSyntaxHighlighting = options.get(31 /* EditorOption.copyWithSyntaxHighlighting */);
        const selections = this._context.viewModel.getCursorStates().map(cursorState => cursorState.modelState.selection);
        const dataToCopy = getDataToCopy(this._context.viewModel, selections, emptySelectionClipboard, copyWithSyntaxHighlighting);
        let id = undefined;
        if (this.logService.getLevel() === LogLevel.Trace) {
            id = generateUuid();
        }
        const storedMetadata = {
            version: 1,
            id,
            isFromEmptySelection: dataToCopy.isFromEmptySelection,
            multicursorText: dataToCopy.multicursorText,
            mode: dataToCopy.mode
        };
        InMemoryClipboardMetadataManager.INSTANCE.set(
        // When writing "LINE\r\n" to the clipboard and then pasting,
        // Firefox pastes "LINE\n", so let's work around this quirk
        (isFirefox ? dataToCopy.text.replace(/\r\n/g, '\n') : dataToCopy.text), storedMetadata);
        e.preventDefault();
        if (e.clipboardData) {
            ClipboardEventUtils.setTextData(e.clipboardData, dataToCopy.text, dataToCopy.html, storedMetadata);
        }
        this.logService.trace('NativeEditContext#_ensureClipboardGetsEditorSelectios with id : ', id, ' with text.length: ', dataToCopy.text.length);
    }
};
NativeEditContext = __decorate([
    __param(5, IInstantiationService),
    __param(6, ILogService)
], NativeEditContext);
export { NativeEditContext };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmF0aXZlRWRpdENvbnRleHQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvY29udHJvbGxlci9lZGl0Q29udGV4dC9uYXRpdmUvbmF0aXZlRWRpdENvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyx5QkFBeUIsQ0FBQztBQUNqQyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbkUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLGdCQUFnQixFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNySCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDekUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFFckYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFPdEcsT0FBTyxFQUFFLG1CQUFtQixFQUEyQixhQUFhLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUNySSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUN4RCxPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsWUFBWSxFQUFhLE1BQU0sNkJBQTZCLENBQUM7QUFDeEcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDL0QsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFL0QsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDN0YsT0FBTyxFQUFFLFdB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