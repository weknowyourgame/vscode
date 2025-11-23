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
// allow-any-unicode-comment-file
import { localize } from '../../../../../../nls.js';
import * as DOM from '../../../../../../base/browser/dom.js';
import { raceCancellation } from '../../../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { Event } from '../../../../../../base/common/event.js';
import { Disposable, toDisposable } from '../../../../../../base/common/lifecycle.js';
import { clamp } from '../../../../../../base/common/numbers.js';
import * as strings from '../../../../../../base/common/strings.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { ILanguageService } from '../../../../../../editor/common/languages/language.js';
import { tokenizeToStringSync } from '../../../../../../editor/common/languages/textToHtmlTokenizer.js';
import { CodeActionController } from '../../../../../../editor/contrib/codeAction/browser/codeActionController.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../../platform/keybinding/common/keybinding.js';
import { INotebookExecutionStateService } from '../../../common/notebookExecutionStateService.js';
import { CellFocusMode, EXPAND_CELL_INPUT_COMMAND_ID } from '../../notebookBrowser.js';
import { outputDisplayLimit } from '../../viewModel/codeCellViewModel.js';
import { collapsedCellTTPolicy } from '../notebookRenderingCommon.js';
import { CellEditorOptions } from './cellEditorOptions.js';
import { CellOutputContainer } from './cellOutput.js';
import { CollapsedCodeCellExecutionIcon } from './codeCellExecutionIcon.js';
import { INotebookLoggingService } from '../../../common/notebookLoggingService.js';
let CodeCell = class CodeCell extends Disposable {
    constructor(notebookEditor, viewCell, templateData, editorPool, instantiationService, keybindingService, languageService, configurationService, notebookExecutionStateService, notebookLogService) {
        super();
        this.notebookEditor = notebookEditor;
        this.viewCell = viewCell;
        this.templateData = templateData;
        this.editorPool = editorPool;
        this.instantiationService = instantiationService;
        this.keybindingService = keybindingService;
        this.languageService = languageService;
        this.configurationService = configurationService;
        this._isDisposed = false;
        this._useNewApproachForEditorLayout = true;
        const cellIndex = this.notebookEditor.getCellIndex(this.viewCell);
        const debugPrefix = `[Cell ${cellIndex}]`;
        const debug = this._debug = (output) => {
            notebookLogService.debug('CellLayout', `${debugPrefix} ${output}`);
        };
        this._cellEditorOptions = this._register(new CellEditorOptions(this.notebookEditor.getBaseCellEditorOptions(viewCell.language), this.notebookEditor.notebookOptions, this.configurationService));
        this._outputContainerRenderer = this.instantiationService.createInstance(CellOutputContainer, notebookEditor, viewCell, templateData, { limit: outputDisplayLimit });
        this.cellParts = this._register(templateData.cellParts.concatContentPart([this._cellEditorOptions, this._outputContainerRenderer], DOM.getWindow(notebookEditor.getDomNode())));
        const initialEditorDimension = { height: this.calculateInitEditorHeight(), width: this.viewCell.layoutInfo.editorWidth };
        this._cellLayout = new CodeCellLayout(this._useNewApproachForEditorLayout, notebookEditor, viewCell, templateData, { debug }, initialEditorDimension);
        this.initializeEditor(initialEditorDimension);
        this._renderedInputCollapseState = false; // editor is always expanded initially
        this.registerNotebookEditorListeners();
        this.registerViewCellLayoutChange();
        this.registerCellEditorEventListeners();
        this.registerMouseListener();
        this._register(Event.any(this.viewCell.onDidStartExecution, this.viewCell.onDidStopExecution)((e) => {
            this.cellParts.updateForExecutionState(this.viewCell, e);
        }));
        this._register(this.viewCell.onDidChangeState(e => {
            this.cellParts.updateState(this.viewCell, e);
            if (e.outputIsHoveredChanged) {
                this.updateForOutputHover();
            }
            if (e.outputIsFocusedChanged) {
                this.updateForOutputFocus();
            }
            if (e.metadataChanged || e.internalMetadataChanged) {
                this.updateEditorOptions();
            }
            if (e.inputCollapsedChanged || e.outputCollapsedChanged) {
                this.viewCell.pauseLayout();
                const updated = this.updateForCollapseState();
                this.viewCell.resumeLayout();
                if (updated) {
                    this.relayoutCell();
                }
            }
            if (e.focusModeChanged) {
                this.updateEditorForFocusModeChange(true);
            }
        }));
        this.updateEditorOptions();
        this.updateEditorForFocusModeChange(false);
        this.updateForOutputHover();
        this.updateForOutputFocus();
        this.cellParts.scheduleRenderCell(this.viewCell);
        this._register(toDisposable(() => {
            this.cellParts.unrenderCell(this.viewCell);
        }));
        // Render Outputs
        this.viewCell.editorHeight = initialEditorDimension.height;
        this._outputContainerRenderer.render();
        this._renderedOutputCollapseState = false; // the output is always rendered initially
        // Need to do this after the intial renderOutput
        this.initialViewUpdateExpanded();
        this._register(this.viewCell.onLayoutInfoRead(() => {
            this.cellParts.prepareLayout();
        }));
        const executionItemElement = DOM.append(this.templateData.cellInputCollapsedContainer, DOM.$('.collapsed-execution-icon'));
        this._register(toDisposable(() => {
            executionItemElement.remove();
        }));
        this._collapsedExecutionIcon = this._register(this.instantiationService.createInstance(CollapsedCodeCellExecutionIcon, this.notebookEditor, this.viewCell, executionItemElement));
        this.updateForCollapseState();
        this._register(Event.runAndSubscribe(viewCell.onDidChangeOutputs, this.updateForOutputs.bind(this)));
        this._register(Event.runAndSubscribe(viewCell.onDidChangeLayout, this.updateForLayout.bind(this)));
        this._cellEditorOptions.setLineNumbers(this.viewCell.lineNumbers);
        templateData.editor.updateOptions(this._cellEditorOptions.getUpdatedValue(this.viewCell.internalMetadata, this.viewCell.uri));
    }
    updateCodeCellOptions(templateData) {
        templateData.editor.updateOptions(this._cellEditorOptions.getUpdatedValue(this.viewCell.internalMetadata, this.viewCell.uri));
        const cts = new CancellationTokenSource();
        this._register({ dispose() { cts.dispose(true); } });
        raceCancellation(this.viewCell.resolveTextModel(), cts.token).then(model => {
            if (this._isDisposed) {
                return;
            }
            if (model) {
                model.updateOptions({
                    indentSize: this._cellEditorOptions.indentSize,
                    tabSize: this._cellEditorOptions.tabSize,
                    insertSpaces: this._cellEditorOptions.insertSpaces,
                });
            }
        });
    }
    updateForLayout() {
        this._pendingLayout?.dispose();
        this._pendingLayout = DOM.modify(DOM.getWindow(this.notebookEditor.getDomNode()), () => {
            this.cellParts.updateInternalLayoutNow(this.viewCell);
        });
    }
    updateForOutputHover() {
        this.templateData.container.classList.toggle('cell-output-hover', this.viewCell.outputIsHovered);
    }
    updateForOutputFocus() {
        this.templateData.container.classList.toggle('cell-output-focus', this.viewCell.outputIsFocused);
    }
    calculateInitEditorHeight() {
        const lineNum = this.viewCell.lineCount;
        const lineHeight = this.viewCell.layoutInfo.fontInfo?.lineHeight || 17;
        const editorPadding = this.notebookEditor.notebookOptions.computeEditorPadding(this.viewCell.internalMetadata, this.viewCell.uri);
        const editorHeight = this.viewCell.layoutInfo.editorHeight === 0
            ? lineNum * lineHeight + editorPadding.top + editorPadding.bottom
            : this.viewCell.layoutInfo.editorHeight;
        return editorHeight;
    }
    initializeEditor(dimension) {
        this._debug(`Initialize Editor ${dimension.height} x ${dimension.width}, Scroll Top = ${this.notebookEditor.scrollTop}`);
        this._cellLayout.layoutEditor('init');
        this.layoutEditor(dimension);
        const cts = new CancellationTokenSource();
        this._register({ dispose() { cts.dispose(true); } });
        raceCancellation(this.viewCell.resolveTextModel(), cts.token).then(model => {
            if (this._isDisposed || model?.isDisposed()) {
                return;
            }
            if (model && this.templateData.editor) {
                this._reigsterModelListeners(model);
                // set model can trigger view update, which can lead to dispose of this cell
                this.templateData.editor.setModel(model);
                if (this._isDisposed) {
                    return;
                }
                model.updateOptions({
                    indentSize: this._cellEditorOptions.indentSize,
                    tabSize: this._cellEditorOptions.tabSize,
                    insertSpaces: this._cellEditorOptions.insertSpaces,
                });
                this.viewCell.attachTextEditor(this.templateData.editor, this.viewCell.layoutInfo.estimatedHasHorizontalScrolling);
                const focusEditorIfNeeded = () => {
                    if (this.notebookEditor.getActiveCell() === this.viewCell &&
                        this.viewCell.focusMode === CellFocusMode.Editor &&
                        (this.notebookEditor.hasEditorFocus() || this.notebookEditor.getDomNode().ownerDocument.activeElement === this.notebookEditor.getDomNode().ownerDocument.body)) // Don't steal focus from other workbench parts, but if body has focus, we can take it
                     {
                        this.templateData.editor.focus();
                    }
                };
                focusEditorIfNeeded();
                const realContentHeight = this.templateData.editor.getContentHeight();
                if (realContentHeight !== dimension.height) {
                    this.onCellEditorHeightChange('onDidResolveTextModel');
                }
                if (this._isDisposed) {
                    return;
                }
                focusEditorIfNeeded();
            }
            this._register(this._cellEditorOptions.onDidChange(() => this.updateCodeCellOptions(this.templateData)));
        });
    }
    updateForOutputs() {
        DOM.setVisibility(this.viewCell.outputsViewModels.length > 0, this.templateData.focusSinkElement);
    }
    updateEditorOptions() {
        const editor = this.templateData.editor;
        if (!editor) {
            return;
        }
        const isReadonly = this.notebookEditor.isReadOnly;
        const padding = this.notebookEditor.notebookOptions.computeEditorPadding(this.viewCell.internalMetadata, this.viewCell.uri);
        const options = editor.getOptions();
        if (options.get(104 /* EditorOption.readOnly */) !== isReadonly || options.get(96 /* EditorOption.padding */) !== padding) {
            editor.updateOptions({
                readOnly: this.notebookEditor.isReadOnly, padding: this.notebookEditor.notebookOptions.computeEditorPadding(this.viewCell.internalMetadata, this.viewCell.uri)
            });
        }
    }
    registerNotebookEditorListeners() {
        this._register(this.notebookEditor.onDidScroll(() => {
            this.adjustEditorPosition();
            this._cellLayout.layoutEditor('nbDidScroll');
        }));
        this._register(this.notebookEditor.onDidChangeLayout(() => {
            this.adjustEditorPosition();
            this.onCellWidthChange('nbLayoutChange');
        }));
    }
    adjustEditorPosition() {
        if (this._useNewApproachForEditorLayout) {
            return;
        }
        const extraOffset = -6 /** distance to the top of the cell editor, which is 6px under the focus indicator */ - 1 /** border */;
        const min = 0;
        const scrollTop = this.notebookEditor.scrollTop;
        const elementTop = this.notebookEditor.getAbsoluteTopOfElement(this.viewCell);
        const diff = scrollTop - elementTop + extraOffset;
        const notebookEditorLayout = this.notebookEditor.getLayoutInfo();
        // we should stop adjusting the top when users are viewing the bottom of the cell editor
        const editorMaxHeight = notebookEditorLayout.height
            - notebookEditorLayout.stickyHeight
            - 26 /** notebook toolbar */;
        const maxTop = this.viewCell.layoutInfo.editorHeight
            // + this.viewCell.layoutInfo.statusBarHeight
            - editorMaxHeight;
        const top = maxTop > 20 ?
            clamp(min, diff, maxTop) :
            min;
        this.templateData.editorPart.style.top = `${top}px`;
        // scroll the editor with top
        this.templateData.editor.setScrollTop(top);
    }
    registerViewCellLayoutChange() {
        this._register(this.viewCell.onDidChangeLayout((e) => {
            if (e.outerWidth !== undefined) {
                const layoutInfo = this.templateData.editor.getLayoutInfo();
                if (layoutInfo.width !== this.viewCell.layoutInfo.editorWidth) {
                    this.onCellWidthChange('viewCellLayoutChange');
                    this.adjustEditorPosition();
                }
            }
        }));
    }
    registerCellEditorEventListeners() {
        this._register(this.templateData.editor.onDidContentSizeChange((e) => {
            if (e.contentHeightChanged) {
                if (this.viewCell.layoutInfo.editorHeight !== e.contentHeight) {
                    this.onCellEditorHeightChange(`onDidContentSizeChange`);
                    this.adjustEditorPosition();
                }
            }
        }));
        if (this._useNewApproachForEditorLayout) {
            this._register(this.templateData.editor.onDidScrollChange(e => {
                if (this._cellLayout.editorVisibility === 'Invisible' || !this.templateData.editor.hasTextFocus()) {
                    return;
                }
                if (this._cellLayout._lastChangedEditorScrolltop === e.scrollTop || this._cellLayout.isUpdatingLayout) {
                    return;
                }
                const scrollTop = this.notebookEditor.scrollTop;
                const diff = e.scrollTop - (this._cellLayout._lastChangedEditorScrolltop ?? 0);
                if (this._cellLayout.editorVisibility === 'Full (Small Viewport)' && typeof this._cellLayout._lastChangedEditorScrolltop === 'number') {
                    this._debug(`Scroll Change (1) = ${e.scrollTop} changed by ${diff} (notebook scrollTop: ${scrollTop}, setEditorScrollTop: ${e.scrollTop})`);
                    // this.templateData.editor.setScrollTop(e.scrollTop);
                }
                else if (this._cellLayout.editorVisibility === 'Bottom Clipped' && typeof this._cellLayout._lastChangedEditorScrolltop === 'number') {
                    this._debug(`Scroll Change (2) = ${e.scrollTop} changed by ${diff} (notebook scrollTop: ${scrollTop}, setNotebookScrollTop: ${scrollTop + e.scrollTop})`);
                    this.notebookEditor.setScrollTop(scrollTop + e.scrollTop);
                }
                else if (this._cellLayout.editorVisibility === 'Top Clipped' && typeof this._cellLayout._lastChangedEditorScrolltop === 'number') {
                    const newScrollTop = scrollTop + diff - 1;
                    this._debug(`Scroll Change (3) = ${e.scrollTop} changed by ${diff} (notebook scrollTop: ${scrollTop}, setNotebookScrollTop?: ${newScrollTop})`);
                    if (scrollTop !== newScrollTop) {
                        this.notebookEditor.setScrollTop(newScrollTop);
                    }
                }
                else {
                    this._debug(`Scroll Change (4) = ${e.scrollTop} changed by ${diff} (notebook scrollTop: ${scrollTop})`);
                    this._cellLayout._lastChangedEditorScrolltop = undefined;
                }
            }));
        }
        this._register(this.templateData.editor.onDidChangeCursorSelection((e) => {
            if (
            // do not reveal the cell into view if this selection change was caused by restoring editors
            e.source === 'restoreState' || e.oldModelVersionId === 0
                // nor if the text editor is not actually focused (e.g. inline chat is focused and modifying the cell content)
                || !this.templateData.editor.hasTextFocus()) {
                return;
            }
            const selections = this.templateData.editor.getSelections();
            if (selections?.length) {
                const contentHeight = this.templateData.editor.getContentHeight();
                const layoutContentHeight = this.viewCell.layoutInfo.editorHeight;
                if (contentHeight !== layoutContentHeight) {
                    if (!this._useNewApproachForEditorLayout) {
                        this._debug(`onDidChangeCursorSelection`);
                        this.onCellEditorHeightChange('onDidChangeCursorSelection');
                    }
                    if (this._isDisposed) {
                        return;
                    }
                }
                const lastSelection = selections[selections.length - 1];
                this.notebookEditor.revealRangeInViewAsync(this.viewCell, lastSelection);
            }
        }));
        this._register(this.templateData.editor.onDidBlurEditorWidget(() => {
            CodeActionController.get(this.templateData.editor)?.hideLightBulbWidget();
        }));
    }
    _reigsterModelListeners(model) {
        this._register(model.onDidChangeTokens(() => {
            if (this.viewCell.isInputCollapsed && this._inputCollapseElement) {
                // flush the collapsed input with the latest tokens
                const content = this._getRichTextFromLineTokens(model);
                this._inputCollapseElement.innerHTML = (collapsedCellTTPolicy?.createHTML(content) ?? content);
                this._attachInputExpandButton(this._inputCollapseElement);
            }
        }));
    }
    registerMouseListener() {
        this._register(this.templateData.editor.onMouseDown(e => {
            // prevent default on right mouse click, otherwise it will trigger unexpected focus changes
            // the catch is, it means we don't allow customization of right button mouse down handlers other than the built in ones.
            if (e.event.rightButton) {
                e.event.preventDefault();
            }
        }));
    }
    shouldPreserveEditor() {
        // The DOM focus needs to be adjusted:
        // when a cell editor should be focused
        // the document active element is inside the notebook editor or the document body (cell editor being disposed previously)
        return this.notebookEditor.getActiveCell() === this.viewCell
            && this.viewCell.focusMode === CellFocusMode.Editor
            && (this.notebookEditor.hasEditorFocus() || this.notebookEditor.getDomNode().ownerDocument.activeElement === this.notebookEditor.getDomNode().ownerDocument.body);
    }
    updateEditorForFocusModeChange(sync) {
        if (this.shouldPreserveEditor()) {
            if (sync) {
                this.templateData.editor.focus();
            }
            else {
                this._register(DOM.runAtThisOrScheduleAtNextAnimationFrame(DOM.getWindow(this.templateData.container), () => {
                    this.templateData.editor.focus();
                }));
            }
        }
        this.templateData.container.classList.toggle('cell-editor-focus', this.viewCell.focusMode === CellFocusMode.Editor);
        this.templateData.container.classList.toggle('cell-output-focus', this.viewCell.focusMode === CellFocusMode.Output);
    }
    updateForCollapseState() {
        if (this.viewCell.isOutputCollapsed === this._renderedOutputCollapseState &&
            this.viewCell.isInputCollapsed === this._renderedInputCollapseState) {
            return false;
        }
        this.viewCell.layoutChange({ editorHeight: true });
        if (this.viewCell.isInputCollapsed) {
            this._collapseInput();
        }
        else {
            this._showInput();
        }
        if (this.viewCell.isOutputCollapsed) {
            this._collapseOutput();
        }
        else {
            this._showOutput(false);
        }
        this.relayoutCell();
        this._renderedOutputCollapseState = this.viewCell.isOutputCollapsed;
        this._renderedInputCollapseState = this.viewCell.isInputCollapsed;
        return true;
    }
    _collapseInput() {
        // hide the editor and execution label, keep the run button
        DOM.hide(this.templateData.editorPart);
        this.templateData.container.classList.toggle('input-collapsed', true);
        // remove input preview
        this._removeInputCollapsePreview();
        this._collapsedExecutionIcon.setVisibility(true);
        // update preview
        const richEditorText = this.templateData.editor.hasModel() ? this._getRichTextFromLineTokens(this.templateData.editor.getModel()) : this._getRichText(this.viewCell.textBuffer, this.viewCell.language);
        const element = DOM.$('div.cell-collapse-preview');
        element.innerHTML = (collapsedCellTTPolicy?.createHTML(richEditorText) ?? richEditorText);
        this._inputCollapseElement = element;
        this.templateData.cellInputCollapsedContainer.appendChild(element);
        this._attachInputExpandButton(element);
        DOM.show(this.templateData.cellInputCollapsedContainer);
    }
    _attachInputExpandButton(element) {
        const expandIcon = DOM.$('span.expandInputIcon');
        const keybinding = this.keybindingService.lookupKeybinding(EXPAND_CELL_INPUT_COMMAND_ID);
        if (keybinding) {
            element.title = localize('cellExpandInputButtonLabelWithDoubleClick', "Double-click to expand cell input ({0})", keybinding.getLabel());
            expandIcon.title = localize('cellExpandInputButtonLabel', "Expand Cell Input ({0})", keybinding.getLabel());
        }
        expandIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.more));
        element.appendChild(expandIcon);
    }
    _showInput() {
        this._collapsedExecutionIcon.setVisibility(false);
        DOM.show(this.templateData.editorPart);
        DOM.hide(this.templateData.cellInputCollapsedContainer);
    }
    _getRichText(buffer, language) {
        return tokenizeToStringSync(this.languageService, buffer.getLineContent(1), language);
    }
    _getRichTextFromLineTokens(model) {
        let result = `<div class="monaco-tokenized-source">`;
        const firstLineTokens = model.tokenization.getLineTokens(1);
        const viewLineTokens = firstLineTokens.inflate();
        const line = model.getLineContent(1);
        let startOffset = 0;
        for (let j = 0, lenJ = viewLineTokens.getCount(); j < lenJ; j++) {
            const type = viewLineTokens.getClassName(j);
            const endIndex = viewLineTokens.getEndOffset(j);
            result += `<span class="${type}">${strings.escape(line.substring(startOffset, endIndex))}</span>`;
            startOffset = endIndex;
        }
        result += `</div>`;
        return result;
    }
    _removeInputCollapsePreview() {
        const children = this.templateData.cellInputCollapsedContainer.children;
        const elements = [];
        for (let i = 0; i < children.length; i++) {
            if (children[i].classList.contains('cell-collapse-preview')) {
                elements.push(children[i]);
            }
        }
        elements.forEach(element => {
            element.remove();
        });
    }
    _updateOutputInnerContainer(hide) {
        const children = this.templateData.outputContainer.domNode.children;
        for (let i = 0; i < children.length; i++) {
            if (children[i].classList.contains('output-inner-container')) {
                DOM.setVisibility(!hide, children[i]);
            }
        }
    }
    _collapseOutput() {
        this.templateData.container.classList.toggle('output-collapsed', true);
        DOM.show(this.templateData.cellOutputCollapsedContainer);
        this._updateOutputInnerContainer(true);
        this._outputContainerRenderer.viewUpdateHideOuputs();
    }
    _showOutput(initRendering) {
        this.templateData.container.classList.toggle('output-collapsed', false);
        DOM.hide(this.templateData.cellOutputCollapsedContainer);
        this._updateOutputInnerContainer(false);
        this._outputContainerRenderer.viewUpdateShowOutputs(initRendering);
    }
    initialViewUpdateExpanded() {
        this.templateData.container.classList.toggle('input-collapsed', false);
        DOM.show(this.templateData.editorPart);
        DOM.hide(this.templateData.cellInputCollapsedContainer);
        this.templateData.container.classList.toggle('output-collapsed', false);
        this._showOutput(true);
    }
    layoutEditor(dimension) {
        if (this._useNewApproachForEditorLayout) {
            return;
        }
        const editorLayout = this.notebookEditor.getLayoutInfo();
        const maxHeight = Math.min(editorLayout.height
            - editorLayout.stickyHeight
            - 26 /** notebook toolbar */, dimension.height);
        this._debug(`Layout Editor: Width = ${dimension.width}, Height = ${maxHeight} (Requested: ${dimension.height}, Editor Layout Height: ${editorLayout.height}, Sticky: ${editorLayout.stickyHeight})`);
        this.templateData.editor.layout({
            width: dimension.width,
            height: maxHeight
        }, true);
    }
    onCellWidthChange(dbgReasonForChange) {
        this._debug(`Cell Editor Width Change, ${dbgReasonForChange}, Content Height = ${this.templateData.editor.getContentHeight()}`);
        const height = this.templateData.editor.getContentHeight();
        if (this.templateData.editor.hasModel()) {
            this._debug(`**** Updating Cell Editor Height (1), ContentHeight: ${height}, CodeCellLayoutInfo.EditorWidth ${this.viewCell.layoutInfo.editorWidth}, EditorLayoutInfo ${this.templateData.editor.getLayoutInfo().height} ****`);
            this.viewCell.editorHeight = height;
            this.relayoutCell();
            this.layoutEditor({
                width: this.viewCell.layoutInfo.editorWidth,
                height
            });
        }
        else {
            this._debug(`Cell Editor Width Change without model, return (1), ContentHeight: ${height}, CodeCellLayoutInfo.EditorWidth ${this.viewCell.layoutInfo.editorWidth}, EditorLayoutInfo ${this.templateData.editor.getLayoutInfo().height}`);
        }
        this._cellLayout.layoutEditor(dbgReasonForChange);
    }
    onCellEditorHeightChange(dbgReasonForChange) {
        const height = this.templateData.editor.getContentHeight();
        if (!this.templateData.editor.hasModel()) {
            this._debug(`Cell Editor Height Change without model, return (2), ContentHeight: ${height}, CodeCellLayoutInfo.EditorWidth ${this.viewCell.layoutInfo.editorWidth}, EditorLayoutInfo ${this.templateData.editor.getLayoutInfo()}`);
        }
        this._debug(`Cell Editor Height Change (${dbgReasonForChange}): ${height}`);
        this._debug(`**** Updating Cell Editor Height (2), ContentHeight: ${height}, CodeCellLayoutInfo.EditorWidth ${this.viewCell.layoutInfo.editorWidth}, EditorLayoutInfo ${this.templateData.editor.getLayoutInfo().height} ****`);
        const viewLayout = this.templateData.editor.getLayoutInfo();
        this.viewCell.editorHeight = height;
        this.relayoutCell();
        this.layoutEditor({
            width: viewLayout.width,
            height
        });
        this._cellLayout.layoutEditor(dbgReasonForChange);
    }
    relayoutCell() {
        this.notebookEditor.layoutNotebookCell(this.viewCell, this.viewCell.layoutInfo.totalHeight);
    }
    dispose() {
        this._isDisposed = true;
        // move focus back to the cell list otherwise the focus goes to body
        if (this.shouldPreserveEditor()) {
            // now the focus is on the monaco editor for the cell but detached from the rows.
            this.editorPool.preserveFocusedEditor(this.viewCell);
        }
        this.viewCell.detachTextEditor();
        this._removeInputCollapsePreview();
        this._outputContainerRenderer.dispose();
        this._pendingLayout?.dispose();
        super.dispose();
    }
};
CodeCell = __decorate([
    __param(4, IInstantiationService),
    __param(5, IKeybindingService),
    __param(6, ILanguageService),
    __param(7, IConfigurationService),
    __param(8, INotebookExecutionStateService),
    __param(9, INotebookLoggingService)
], CodeCell);
export { CodeCell };
export class CodeCellLayout {
    get editorVisibility() {
        return this._editorVisibility;
    }
    get isUpdatingLayout() {
        return this._isUpdatingLayout;
    }
    constructor(_enabled, notebookEditor, viewCell, templateData, _logService, _initialEditorDimension) {
        this._enabled = _enabled;
        this.notebookEditor = notebookEditor;
        this.viewCell = viewCell;
        this.templateData = templateData;
        this._logService = _logService;
        this._initialEditorDimension = _initialEditorDimension;
        this._initialized = false;
    }
    /**
     * Dynamically lays out the code cell's Monaco editor to simulate a "sticky" run/exec area while
     * constraining the visible editor height to the notebook viewport. It adjusts two things:
     *  - The absolute `top` offset of the editor part inside the cell (so the run / execution order
     *    area remains visible for a limited vertical travel band ~45px).
     *  - The editor's layout height plus the editor's internal scroll position (`editorScrollTop`) to
     *    crop content when the cell is partially visible (top or bottom clipped) or when content is
     *    taller than the viewport.
     *
     * ---------------------------------------------------------------------------
     * SECTION 1. OVERALL NOTEBOOK VIEW (EACH CELL HAS AN 18px GAP ABOVE IT)
     * Legend:
     *   GAP (between cells & before first cell) ............. 18px
     *   CELL PADDING (top & bottom inside cell) ............. 6px
     *   STATUS BAR HEIGHT (typical) ......................... 22px
     *   LINE HEIGHT (logic clamp) ........................... 21px
     *   BORDER/OUTLINE HEIGHT (visual conceal adjustment) ... 1px
     *   EDITOR_HEIGHT (example visible editor) .............. 200px (capped by viewport)
     *   EDITOR_CONTENT_HEIGHT (example full content) ........ 380px (e.g. 50 lines)
     *   extraOffset = -(CELL_PADDING + BORDER_HEIGHT) ....... -7
     *
     *   (The list ensures the editor's laid out height never exceeds viewport height.)
     *
     *   ┌────────────────────────────── Notebook Viewport (scrolling container) ────────────────────────────┐
     *   │ (scrollTop)                                                                                       │
     *   │                                                                                                   │
     *   │  18px GAP (top spacing before first cell)                                                         │
     *   │  ▼                                                                                                │
     *   │  ┌──────── Cell A Outer Container ────────────────────────────────────────────────────────────┐   │
     *   │  │ ▲ 6px top padding                                                                          │   │
     *   │  │ │                                                                                          │   │
     *   │  │ │  ┌─ Execution Order / Run Column (~45px vertical travel band)─┐  ┌─ Editor Part ───────┐ │   │
     *   │  │ │  │ (Run button, execution # label)                            │  │ Visible Lines ...   │ │   │
     *   │  │ │  │                                                            │  │                     │ │   │
     *   │  │ │  │                                                            │  │ EDITOR_HEIGHT=200px │ │   │
     *   │  │ │  │                                                            │  │ (Content=380px)     │ │   │
     *   │  │ │  └────────────────────────────────────────────────────────────┘  └─────────────────────┘ │   │
     *   │  │ │                                                                                          │   │
     *   │  │ │  ┌─ Status Bar (22px) ─────────────────────────────────────────────────────────────────┐ │   │
     *   │  │ │  │ language | indent | selection info | kernel/status bits ...                         │ │   │
     *   │  │ │  └─────────────────────────────────────────────────────────────────────────────────────┘ │   │
     *   │  │ │                                                                                          │   │
     *   │  │ ▼ 6px bottom padding                                                                       │   │
     *   │  └────────────────────────────────────────────────────────────────────────────────────────────┘   │
     *   │  18px GAP                                                                                         │
     *   │  ┌──────── Cell B Outer Container ────────────────────────────────────────────────────────────┐   │
     *   │  │ (same structure as Cell A)                                                                 │   │
     *   │  └────────────────────────────────────────────────────────────────────────────────────────────┘   │
     *   │                                                                                                   │
     *   │ (scrollBottom)                                                                                    │
     *   └───────────────────────────────────────────────────────────────────────────────────────────────────┘
     *
     * SECTION 2. SINGLE CELL STRUCTURE (VERTICAL LAYERS)
     *
     *   Inter-Cell GAP (18px)
     *   ┌─────────────────────────────── Cell Wrapper (<li>) ──────────────────────────────┐
     *   │ ┌──────────────────────────── .cell-inner-container ───────────────────────────┐ │
     *   │ │ 6px top padding                                                              │ │
     *   │ │                                                                              │ │
     *   │ │ ┌─ Left Gutter (Run / Exec / Focus Border) ─┬──────── Editor Part ─────────┐ │ │
     *   │ │ │  Sticky vertical travel (~45px allowance) │  (Monaco surface)            │ │ │
     *   │ │ │                                         │  Visible height 200px          │ │ │
     *   │ │ │                                         │  Content height 380px          │ │ │
     *   │ │ └─────────────────────────────────────────┴────────────────────────────────┘ │ │
     *   │ │                                                                              │ │
     *   │ │ ┌─ Status Bar (22px) ──────────────────────────────────────────────────────┐ │ │
     *   │ │ │ language | indent | selection | kernel | state                           │ │ │
     *   │ │ └──────────────────────────────────────────────────────────────────────────┘ │ │
     *   │ │ 6px bottom padding                                                           │ │
     *   │ └──────────────────────────────────────────────────────────────────────────────┘ │
     *   │ (Outputs region begins at outputContainerOffset below input area)                │
     *   └──────────────────────────────────────────────────────────────────────────────────┘
     */
    layoutEditor(reason) {
        if (!this._enabled) {
            return;
        }
        const element = this.templateData.editorPart;
        if (this.viewCell.isInputCollapsed) {
            element.style.top = '';
            return;
        }
        const LINE_HEIGHT = this.notebookEditor.getLayoutInfo().fontInfo.lineHeight; // 21;
        const CELL_TOP_MARGIN = this.viewCell.layoutInfo.topMargin;
        const CELL_OUTLINE_WIDTH = this.viewCell.layoutInfo.outlineWidth; // 1 extra px for border (we don't want to be able to see the cell border when scrolling up);
        const STATUSBAR_HEIGHT = this.viewCell.layoutInfo.statusBarHeight;
        const editor = this.templateData.editor;
        const editorLayout = this.templateData.editor.getLayoutInfo();
        // If we've already initialized once, we should use the viewCell layout info for editor width.
        // E.g. when resizing VS Code window or notebook editor (horizontal space changes).
        const editorWidth = this._initialized && (reason === 'nbLayoutChange' || reason === 'viewCellLayoutChange') ? this.viewCell.layoutInfo.editorWidth : editorLayout.width;
        const editorHeight = this.viewCell.layoutInfo.editorHeight;
        const scrollTop = this.notebookEditor.scrollTop;
        const elementTop = this.notebookEditor.getAbsoluteTopOfElement(this.viewCell);
        const elementBottom = this.notebookEditor.getAbsoluteBottomOfElement(this.viewCell);
        const elementHeight = this.notebookEditor.getHeightOfElement(this.viewCell);
        const gotContentHeight = editor.getContentHeight();
        const editorContentHeight = Math.max((gotContentHeight === -1 ? editor.getLayoutInfo().height : gotContentHeight), gotContentHeight === -1 ? this._initialEditorDimension.height : gotContentHeight); // || this.calculatedEditorHeight || 0;
        const editorBottom = elementTop + this.viewCell.layoutInfo.outputContainerOffset;
        const scrollBottom = this.notebookEditor.scrollBottom;
        // When loading, scrollBottom -scrollTop === 0;
        const viewportHeight = scrollBottom - scrollTop === 0 ? this.notebookEditor.getLayoutInfo().height : scrollBottom - scrollTop;
        const outputContainerOffset = this.viewCell.layoutInfo.outputContainerOffset;
        const scrollDirection = typeof this._previousScrollBottom === 'number' ? (scrollBottom < this._previousScrollBottom ? 'up' : 'down') : 'down';
        this._previousScrollBottom = scrollBottom;
        let top = Math.max(0, scrollTop - elementTop - CELL_TOP_MARGIN - CELL_OUTLINE_WIDTH);
        const possibleEditorHeight = editorHeight - top;
        if (possibleEditorHeight < LINE_HEIGHT) {
            top = top - (LINE_HEIGHT - possibleEditorHeight) - CELL_OUTLINE_WIDTH;
        }
        let height = editorContentHeight;
        let editorScrollTop = 0;
        if (scrollTop <= (elementTop + CELL_TOP_MARGIN)) {
            const minimumEditorHeight = LINE_HEIGHT + this.notebookEditor.notebookOptions.getLayoutConfiguration().editorTopPadding;
            if (scrollBottom >= editorBottom) {
                height = clamp(editorContentHeight, minimumEditorHeight, editorContentHeight);
                this._editorVisibility = 'Full';
            }
            else {
                height = clamp(scrollBottom - (elementTop + CELL_TOP_MARGIN) - STATUSBAR_HEIGHT, minimumEditorHeight, editorContentHeight) + (2 * CELL_OUTLINE_WIDTH); // We don't want bottom border to be visible.;
                this._editorVisibility = 'Bottom Clipped';
                editorScrollTop = 0;
            }
        }
        else {
            if (viewportHeight <= editorContentHeight && scrollBottom <= editorBottom) {
                const minimumEditorHeight = LINE_HEIGHT + this.notebookEditor.notebookOptions.getLayoutConfiguration().editorTopPadding;
                height = clamp(viewportHeight - STATUSBAR_HEIGHT, minimumEditorHeight, editorContentHeight - STATUSBAR_HEIGHT) + (2 * CELL_OUTLINE_WIDTH); // We don't want bottom border to be visible.
                this._editorVisibility = 'Full (Small Viewport)';
                editorScrollTop = top;
            }
            else {
                const minimumEditorHeight = LINE_HEIGHT;
                height = clamp(editorContentHeight - (scrollTop - (elementTop + CELL_TOP_MARGIN)), minimumEditorHeight, editorContentHeight);
                // Check if the cell is visible.
                if (scrollTop > editorBottom) {
                    this._editorVisibility = 'Invisible';
                }
                else {
                    this._editorVisibility = 'Top Clipped';
                }
                editorScrollTop = editorContentHeight - height;
            }
        }
        this._logService.debug(`${reason} (${this._editorVisibility})`);
        this._logService.debug(`=> Editor Top = ${top}px (editHeight = ${editorHeight}, editContentHeight: ${editorContentHeight})`);
        this._logService.debug(`=> eleTop = ${elementTop}, eleBottom = ${elementBottom}, eleHeight = ${elementHeight}`);
        this._logService.debug(`=> scrollTop = ${scrollTop}, top = ${top}`);
        this._logService.debug(`=> cellTopMargin = ${CELL_TOP_MARGIN}, cellBottomMargin = ${this.viewCell.layoutInfo.topMargin}, cellOutline = ${CELL_OUTLINE_WIDTH}`);
        this._logService.debug(`=> scrollBottom: ${scrollBottom}, editBottom: ${editorBottom}, viewport: ${viewportHeight}, scroll: ${scrollDirection}, contOffset: ${outputContainerOffset})`);
        this._logService.debug(`=> Editor Height = ${height}px, Width: ${editorWidth}px, Initial Width: ${this._initialEditorDimension.width}, EditorScrollTop = ${editorScrollTop}px, StatusbarHeight = ${STATUSBAR_HEIGHT}, lineHeight = ${this.notebookEditor.getLayoutInfo().fontInfo.lineHeight}`);
        try {
            this._isUpdatingLayout = true;
            element.style.top = `${top}px`;
            editor.layout({
                width: this._initialized ? editorWidth : this._initialEditorDimension.width,
                height
            }, true);
            if (editorScrollTop >= 0) {
                this._lastChangedEditorScrolltop = editorScrollTop;
                editor.setScrollTop(editorScrollTop);
            }
        }
        finally {
            this._initialized = true;
            this._isUpdatingLayout = false;
            this._logService.debug('Updated Editor Layout');
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZUNlbGwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svYnJvd3Nlci92aWV3L2NlbGxQYXJ0cy9jb2RlQ2VsbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxpQ0FBaUM7QUFFakMsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3BELE9BQU8sS0FBSyxHQUFHLE1BQU0sdUNBQXVDLENBQUM7QUFDN0QsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDMUUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDeEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFlLFlBQVksRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNqRSxPQUFPLEtBQUssT0FBTyxNQUFNLDBDQUEwQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUd2RSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUV4RyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw2RUFBNkUsQ0FBQztBQUNuSCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUN6RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUN6RyxPQUFPLEVBQUUsa0JBQWtC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