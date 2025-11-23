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
import * as DOM from '../../../../../../base/browser/dom.js';
import * as domSanitize from '../../../../../../base/browser/domSanitize.js';
import { renderIcon } from '../../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { disposableTimeout, raceCancellation } from '../../../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from '../../../../../../base/common/lifecycle.js';
import { CodeEditorWidget } from '../../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { EditorContextKeys } from '../../../../../../editor/common/editorContextKeys.js';
import { ILanguageService } from '../../../../../../editor/common/languages/language.js';
import { tokenizeToStringSync } from '../../../../../../editor/common/languages/textToHtmlTokenizer.js';
import { localize } from '../../../../../../nls.js';
import { IAccessibilityService } from '../../../../../../platform/accessibility/common/accessibility.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { IKeybindingService } from '../../../../../../platform/keybinding/common/keybinding.js';
import { CellEditState, CellFocusMode, EXPAND_CELL_INPUT_COMMAND_ID } from '../../notebookBrowser.js';
import { collapsedIcon, expandedIcon } from '../../notebookIcons.js';
import { CellEditorOptions } from './cellEditorOptions.js';
import { collapsedCellTTPolicy } from '../notebookRenderingCommon.js';
import { WordHighlighterContribution } from '../../../../../../editor/contrib/wordHighlighter/browser/wordHighlighter.js';
let MarkupCell = class MarkupCell extends Disposable {
    constructor(notebookEditor, viewCell, templateData, renderedEditors, accessibilityService, contextKeyService, instantiationService, languageService, configurationService, keybindingService) {
        super();
        this.notebookEditor = notebookEditor;
        this.viewCell = viewCell;
        this.templateData = templateData;
        this.renderedEditors = renderedEditors;
        this.accessibilityService = accessibilityService;
        this.contextKeyService = contextKeyService;
        this.instantiationService = instantiationService;
        this.languageService = languageService;
        this.configurationService = configurationService;
        this.keybindingService = keybindingService;
        this.editor = null;
        this.localDisposables = this._register(new DisposableStore());
        this.focusSwitchDisposable = this._register(new MutableDisposable());
        this.editorDisposables = this._register(new DisposableStore());
        this._isDisposed = false;
        this.constructDOM();
        this.editorPart = templateData.editorPart;
        this.cellEditorOptions = this._register(new CellEditorOptions(this.notebookEditor.getBaseCellEditorOptions(viewCell.language), this.notebookEditor.notebookOptions, this.configurationService));
        this.cellEditorOptions.setLineNumbers(this.viewCell.lineNumbers);
        this.editorOptions = this.cellEditorOptions.getValue(this.viewCell.internalMetadata, this.viewCell.uri);
        this._register(toDisposable(() => renderedEditors.delete(this.viewCell)));
        this.registerListeners();
        // update for init state
        this.templateData.cellParts.scheduleRenderCell(this.viewCell);
        this._register(toDisposable(() => {
            this.templateData.cellParts.unrenderCell(this.viewCell);
        }));
        this._register(this.accessibilityService.onDidChangeScreenReaderOptimized(() => {
            this.viewUpdate();
        }));
        this.updateForHover();
        this.updateForFocusModeChange();
        this.foldingState = viewCell.foldingState;
        this.layoutFoldingIndicator();
        this.updateFoldingIconShowClass();
        // the markdown preview's height might already be updated after the renderer calls `element.getHeight()`
        if (this.viewCell.layoutInfo.totalHeight > 0) {
            this.relayoutCell();
        }
        this.viewUpdate();
        this.layoutCellParts();
        this._register(this.viewCell.onDidChangeLayout(() => {
            this.layoutCellParts();
        }));
    }
    layoutCellParts() {
        this.templateData.cellParts.updateInternalLayoutNow(this.viewCell);
    }
    constructDOM() {
        // Create an element that is only used to announce markup cell content to screen readers
        const id = `aria-markup-cell-${this.viewCell.id}`;
        this.markdownAccessibilityContainer = this.templateData.cellContainer;
        this.markdownAccessibilityContainer.id = id;
        // Hide the element from non-screen readers
        this.markdownAccessibilityContainer.style.height = '1px';
        this.markdownAccessibilityContainer.style.overflow = 'hidden';
        this.markdownAccessibilityContainer.style.position = 'absolute';
        this.markdownAccessibilityContainer.style.top = '100000px';
        this.markdownAccessibilityContainer.style.left = '10000px';
        this.markdownAccessibilityContainer.ariaHidden = 'false';
        this.templateData.rootContainer.setAttribute('aria-describedby', id);
        this.templateData.container.classList.toggle('webview-backed-markdown-cell', true);
    }
    registerListeners() {
        this._register(this.viewCell.onDidChangeState(e => {
            this.templateData.cellParts.updateState(this.viewCell, e);
        }));
        this._register(this.viewCell.model.onDidChangeMetadata(() => {
            this.viewUpdate();
        }));
        this._register(this.viewCell.onDidChangeState((e) => {
            if (e.editStateChanged || e.contentChanged) {
                this.viewUpdate();
            }
            if (e.focusModeChanged) {
                this.updateForFocusModeChange();
            }
            if (e.foldingStateChanged) {
                const foldingState = this.viewCell.foldingState;
                if (foldingState !== this.foldingState) {
                    this.foldingState = foldingState;
                    this.layoutFoldingIndicator();
                }
            }
            if (e.cellIsHoveredChanged) {
                this.updateForHover();
            }
            if (e.inputCollapsedChanged) {
                this.updateCollapsedState();
                this.viewUpdate();
            }
            if (e.cellLineNumberChanged) {
                this.cellEditorOptions.setLineNumbers(this.viewCell.lineNumbers);
            }
        }));
        this._register(this.notebookEditor.notebookOptions.onDidChangeOptions(e => {
            if (e.showFoldingControls) {
                this.updateFoldingIconShowClass();
            }
        }));
        this._register(this.viewCell.onDidChangeLayout((e) => {
            const layoutInfo = this.editor?.getLayoutInfo();
            if (e.outerWidth && this.viewCell.getEditState() === CellEditState.Editing && layoutInfo && layoutInfo.width !== this.viewCell.layoutInfo.editorWidth) {
                this.onCellEditorWidthChange();
            }
        }));
        this._register(this.cellEditorOptions.onDidChange(() => this.updateMarkupCellOptions()));
    }
    updateMarkupCellOptions() {
        this.updateEditorOptions(this.cellEditorOptions.getUpdatedValue(this.viewCell.internalMetadata, this.viewCell.uri));
        if (this.editor) {
            this.editor.updateOptions(this.cellEditorOptions.getUpdatedValue(this.viewCell.internalMetadata, this.viewCell.uri));
            const cts = new CancellationTokenSource();
            this._register({ dispose() { cts.dispose(true); } });
            raceCancellation(this.viewCell.resolveTextModel(), cts.token).then(model => {
                if (this._isDisposed) {
                    return;
                }
                if (model) {
                    model.updateOptions({
                        indentSize: this.cellEditorOptions.indentSize,
                        tabSize: this.cellEditorOptions.tabSize,
                        insertSpaces: this.cellEditorOptions.insertSpaces,
                    });
                }
            });
        }
    }
    updateCollapsedState() {
        if (this.viewCell.isInputCollapsed) {
            this.notebookEditor.hideMarkupPreviews([this.viewCell]);
        }
        else {
            this.notebookEditor.unhideMarkupPreviews([this.viewCell]);
        }
    }
    updateForHover() {
        this.templateData.container.classList.toggle('markdown-cell-hover', this.viewCell.cellIsHovered);
    }
    updateForFocusModeChange() {
        if (this.viewCell.focusMode === CellFocusMode.Editor) {
            this.focusEditorIfNeeded();
        }
        this.templateData.container.classList.toggle('cell-editor-focus', this.viewCell.focusMode === CellFocusMode.Editor);
    }
    dispose() {
        this._isDisposed = true;
        // move focus back to the cell list otherwise the focus goes to body
        if (this.notebookEditor.getActiveCell() === this.viewCell && this.viewCell.focusMode === CellFocusMode.Editor && (this.notebookEditor.hasEditorFocus() || this.notebookEditor.getDomNode().ownerDocument.activeElement === this.notebookEditor.getDomNode().ownerDocument.body)) {
            this.notebookEditor.focusContainer();
        }
        this.viewCell.detachTextEditor();
        super.dispose();
    }
    updateFoldingIconShowClass() {
        const showFoldingIcon = this.notebookEditor.notebookOptions.getDisplayOptions().showFoldingControls;
        this.templateData.foldingIndicator.classList.remove('mouseover', 'always');
        this.templateData.foldingIndicator.classList.add(showFoldingIcon);
    }
    viewUpdate() {
        if (this.viewCell.isInputCollapsed) {
            this.viewUpdateCollapsed();
        }
        else if (this.viewCell.getEditState() === CellEditState.Editing) {
            this.viewUpdateEditing();
        }
        else {
            this.viewUpdatePreview();
        }
    }
    viewUpdateCollapsed() {
        DOM.show(this.templateData.cellInputCollapsedContainer);
        DOM.hide(this.editorPart);
        this.templateData.cellInputCollapsedContainer.innerText = '';
        const markdownIcon = DOM.append(this.templateData.cellInputCollapsedContainer, DOM.$('span'));
        markdownIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.markdown));
        const element = DOM.$('div');
        element.classList.add('cell-collapse-preview');
        const richEditorText = this.getRichText(this.viewCell.textBuffer, this.viewCell.language);
        element.innerText = richEditorText;
        element.innerHTML = (collapsedCellTTPolicy?.createHTML(richEditorText) ?? richEditorText);
        this.templateData.cellInputCollapsedContainer.appendChild(element);
        const expandIcon = DOM.append(element, DOM.$('span.expandInputIcon'));
        expandIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.more));
        const keybinding = this.keybindingService.lookupKeybinding(EXPAND_CELL_INPUT_COMMAND_ID);
        if (keybinding) {
            element.title = localize('cellExpandInputButtonLabelWithDoubleClick', "Double-click to expand cell input ({0})", keybinding.getLabel());
            expandIcon.title = localize('cellExpandInputButtonLabel', "Expand Cell Input ({0})", keybinding.getLabel());
        }
        this.markdownAccessibilityContainer.ariaHidden = 'true';
        this.templateData.container.classList.toggle('input-collapsed', true);
        this.viewCell.renderedMarkdownHeight = 0;
        this.viewCell.layoutChange({});
    }
    getRichText(buffer, language) {
        return tokenizeToStringSync(this.languageService, buffer.getLineContent(1), language);
    }
    viewUpdateEditing() {
        // switch to editing mode
        let editorHeight;
        DOM.show(this.editorPart);
        this.markdownAccessibilityContainer.ariaHidden = 'true';
        DOM.hide(this.templateData.cellInputCollapsedContainer);
        this.notebookEditor.hideMarkupPreviews([this.viewCell]);
        this.templateData.container.classList.toggle('input-collapsed', false);
        this.templateData.container.classList.toggle('markdown-cell-edit-mode', true);
        if (this.editor && this.editor.hasModel()) {
            editorHeight = this.editor.getContentHeight();
            // not first time, we don't need to create editor
            this.viewCell.attachTextEditor(this.editor);
            this.focusEditorIfNeeded();
            this.bindEditorListeners(this.editor);
            this.editor.layout({
                width: this.viewCell.layoutInfo.editorWidth,
                height: editorHeight
            });
        }
        else {
            this.editorDisposables.clear();
            const width = this.notebookEditor.notebookOptions.computeMarkdownCellEditorWidth(this.notebookEditor.getLayoutInfo().width);
            const lineNum = this.viewCell.lineCount;
            const lineHeight = this.viewCell.layoutInfo.fontInfo?.lineHeight || 17;
            const editorPadding = this.notebookEditor.notebookOptions.computeEditorPadding(this.viewCell.internalMetadata, this.viewCell.uri);
            editorHeight = Math.max(lineNum, 1) * lineHeight + editorPadding.top + editorPadding.bottom;
            this.templateData.editorContainer.innerText = '';
            // create a special context key service that set the inCompositeEditor-contextkey
            const editorContextKeyService = this.contextKeyService.createScoped(this.templateData.editorPart);
            EditorContextKeys.inCompositeEditor.bindTo(editorContextKeyService).set(true);
            const editorInstaService = this.editorDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, editorContextKeyService])));
            this.editorDisposables.add(editorContextKeyService);
            this.editor = this.editorDisposables.add(editorInstaService.createInstance(CodeEditorWidget, this.templateData.editorContainer, {
                ...this.editorOptions,
                dimension: {
                    width: width,
                    height: editorHeight
                },
                allowVariableLineHeights: false,
                // overflowWidgetsDomNode: this.notebookEditor.getOverflowContainerDomNode()
            }, {
                contributions: this.notebookEditor.creationOptions.cellEditorContributions
            }));
            this.templateData.currentEditor = this.editor;
            this.editorDisposables.add(this.editor.onDidBlurEditorWidget(() => {
                if (this.editor) {
                    WordHighlighterContribution.get(this.editor)?.stopHighlighting();
                }
            }));
            this.editorDisposables.add(this.editor.onDidFocusEditorWidget(() => {
                if (this.editor) {
                    WordHighlighterContribution.get(this.editor)?.restoreViewState(true);
                }
            }));
            const cts = new CancellationTokenSource();
            this.editorDisposables.add({ dispose() { cts.dispose(true); } });
            raceCancellation(this.viewCell.resolveTextModel(), cts.token).then(model => {
                if (!model) {
                    return;
                }
                this.editor.setModel(model);
                model.updateOptions({
                    indentSize: this.cellEditorOptions.indentSize,
                    tabSize: this.cellEditorOptions.tabSize,
                    insertSpaces: this.cellEditorOptions.insertSpaces,
                });
                const realContentHeight = this.editor.getContentHeight();
                if (realContentHeight !== editorHeight) {
                    this.editor.layout({
                        width: width,
                        height: realContentHeight
                    });
                    editorHeight = realContentHeight;
                }
                this.viewCell.attachTextEditor(this.editor);
                if (this.viewCell.getEditState() === CellEditState.Editing) {
                    this.focusEditorIfNeeded();
                }
                this.bindEditorListeners(this.editor);
                this.viewCell.editorHeight = editorHeight;
            });
        }
        this.viewCell.editorHeight = editorHeight;
        this.focusEditorIfNeeded();
        this.renderedEditors.set(this.viewCell, this.editor);
    }
    viewUpdatePreview() {
        this.viewCell.detachTextEditor();
        DOM.hide(this.editorPart);
        DOM.hide(this.templateData.cellInputCollapsedContainer);
        this.markdownAccessibilityContainer.ariaHidden = 'false';
        this.templateData.container.classList.toggle('input-collapsed', false);
        this.templateData.container.classList.toggle('markdown-cell-edit-mode', false);
        this.renderedEditors.delete(this.viewCell);
        this.markdownAccessibilityContainer.innerText = '';
        if (this.viewCell.renderedHtml) {
            if (this.accessibilityService.isScreenReaderOptimized()) {
                domSanitize.safeSetInnerHtml(this.markdownAccessibilityContainer, this.viewCell.renderedHtml);
            }
            else {
                DOM.clearNode(this.markdownAccessibilityContainer);
            }
        }
        this.notebookEditor.createMarkupPreview(this.viewCell);
    }
    focusEditorIfNeeded() {
        if (this.viewCell.focusMode === CellFocusMode.Editor &&
            (this.notebookEditor.hasEditorFocus() || this.notebookEditor.getDomNode().ownerDocument.activeElement === this.notebookEditor.getDomNode().ownerDocument.body)) { // Don't steal focus from other workbench parts, but if body has focus, we can take it
            if (!this.editor) {
                return;
            }
            this.editor.focus();
            const primarySelection = this.editor.getSelection();
            if (!primarySelection) {
                return;
            }
            this.notebookEditor.revealRangeInViewAsync(this.viewCell, primarySelection);
        }
    }
    layoutEditor(dimension) {
        this.editor?.layout(dimension);
    }
    onCellEditorWidthChange() {
        const realContentHeight = this.editor.getContentHeight();
        this.layoutEditor({
            width: this.viewCell.layoutInfo.editorWidth,
            height: realContentHeight
        });
        // LET the content size observer to handle it
        // this.viewCell.editorHeight = realContentHeight;
        // this.relayoutCell();
    }
    relayoutCell() {
        this.notebookEditor.layoutNotebookCell(this.viewCell, this.viewCell.layoutInfo.totalHeight);
        this.layoutFoldingIndicator();
    }
    updateEditorOptions(newValue) {
        this.editorOptions = newValue;
        this.editor?.updateOptions(this.editorOptions);
    }
    layoutFoldingIndicator() {
        switch (this.foldingState) {
            case 0 /* CellFoldingState.None */:
                this.templateData.foldingIndicator.style.display = 'none';
                this.templateData.foldingIndicator.innerText = '';
                break;
            case 2 /* CellFoldingState.Collapsed */:
                this.templateData.foldingIndicator.style.display = '';
                DOM.reset(this.templateData.foldingIndicator, renderIcon(collapsedIcon));
                break;
            case 1 /* CellFoldingState.Expanded */:
                this.templateData.foldingIndicator.style.display = '';
                DOM.reset(this.templateData.foldingIndicator, renderIcon(expandedIcon));
                break;
            default:
                break;
        }
    }
    bindEditorListeners(editor) {
        this.localDisposables.clear();
        this.focusSwitchDisposable.clear();
        this.localDisposables.add(editor.onDidContentSizeChange(e => {
            if (e.contentHeightChanged) {
                this.onCellEditorHeightChange(editor, e.contentHeight);
            }
        }));
        this.localDisposables.add(editor.onDidChangeCursorSelection((e) => {
            if (e.source === 'restoreState') {
                // do not reveal the cell into view if this selection change was caused by restoring editors...
                return;
            }
            const selections = editor.getSelections();
            if (selections?.length) {
                const contentHeight = editor.getContentHeight();
                const layoutContentHeight = this.viewCell.layoutInfo.editorHeight;
                if (contentHeight !== layoutContentHeight) {
                    this.onCellEditorHeightChange(editor, contentHeight);
                }
                const lastSelection = selections[selections.length - 1];
                this.notebookEditor.revealRangeInViewAsync(this.viewCell, lastSelection);
            }
        }));
        const updateFocusMode = () => this.viewCell.focusMode = editor.hasWidgetFocus() ? CellFocusMode.Editor : CellFocusMode.Container;
        this.localDisposables.add(editor.onDidFocusEditorWidget(() => {
            updateFocusMode();
        }));
        this.localDisposables.add(editor.onDidBlurEditorWidget(() => {
            // this is for a special case:
            // users click the status bar empty space, which we will then focus the editor
            // so we don't want to update the focus state too eagerly
            if (this.templateData.container.ownerDocument.activeElement?.contains(this.templateData.container)) {
                this.focusSwitchDisposable.value = disposableTimeout(() => updateFocusMode(), 300);
            }
            else {
                updateFocusMode();
            }
        }));
        updateFocusMode();
    }
    onCellEditorHeightChange(editor, newHeight) {
        const viewLayout = editor.getLayoutInfo();
        this.viewCell.editorHeight = newHeight;
        editor.layout({
            width: viewLayout.width,
            height: newHeight
        });
    }
};
MarkupCell = __decorate([
    __param(4, IAccessibilityService),
    __param(5, IContextKeyService),
    __param(6, IInstantiationService),
    __param(7, ILanguageService),
    __param(8, IConfigurationService),
    __param(9, IKeybindingService)
], MarkupCell);
export { MarkupCell };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFya3VwQ2VsbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXcvY2VsbFBhcnRzL21hcmt1cENlbGwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSx1Q0FBdUMsQ0FBQztBQUM3RCxPQUFPLEtBQUssV0FBVyxNQUFNLCtDQUErQyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUN2RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUM3RixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUN4RixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBRTFILE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHdFQUF3RSxDQUFDO0FBRTFHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBRXhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNwRCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUN6RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrRUFBa0Us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