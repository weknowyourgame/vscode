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
var MarkupCellRenderer_1, CodeCellRenderer_1;
import { PixelRatio } from '../../../../../../base/browser/pixelRatio.js';
import * as DOM from '../../../../../../base/browser/dom.js';
import { FastDomNode } from '../../../../../../base/browser/fastDomNode.js';
import { Disposable, DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { CodeEditorWidget } from '../../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { createBareFontInfoFromRawSettings } from '../../../../../../editor/common/config/fontInfoFromSettings.js';
import { EditorContextKeys } from '../../../../../../editor/common/editorContextKeys.js';
import { PLAINTEXT_LANGUAGE_ID } from '../../../../../../editor/common/languages/modesRegistry.js';
import { localize } from '../../../../../../nls.js';
import { IMenuService } from '../../../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { IKeybindingService } from '../../../../../../platform/keybinding/common/keybinding.js';
import { INotificationService } from '../../../../../../platform/notification/common/notification.js';
import { CellPartsCollection } from '../cellPart.js';
import { CellChatPart } from '../cellParts/chat/cellChatPart.js';
import { CellComments } from '../cellParts/cellComments.js';
import { CellContextKeyPart } from '../cellParts/cellContextKeys.js';
import { CellDecorations } from '../cellParts/cellDecorations.js';
import { CellDragAndDropPart } from '../cellParts/cellDnd.js';
import { CodeCellDragImageRenderer } from '../cellParts/cellDragRenderer.js';
import { CellEditorOptions } from '../cellParts/cellEditorOptions.js';
import { CellExecutionPart } from '../cellParts/cellExecution.js';
import { CellFocusPart } from '../cellParts/cellFocus.js';
import { CellFocusIndicator } from '../cellParts/cellFocusIndicator.js';
import { CellProgressBar } from '../cellParts/cellProgressBar.js';
import { CellEditorStatusBar } from '../cellParts/cellStatusPart.js';
import { BetweenCellToolbar, CellTitleToolbarPart } from '../cellParts/cellToolbars.js';
import { CodeCell } from '../cellParts/codeCell.js';
import { RunToolbar } from '../cellParts/codeCellRunToolbar.js';
import { CollapsedCellInput } from '../cellParts/collapsedCellInput.js';
import { CollapsedCellOutput } from '../cellParts/collapsedCellOutput.js';
import { FoldedCellHint } from '../cellParts/foldedCellHint.js';
import { MarkupCell } from '../cellParts/markupCell.js';
import { CellKind } from '../../../common/notebookCommon.js';
import { INotebookExecutionStateService } from '../../../common/notebookExecutionStateService.js';
const $ = DOM.$;
let NotebookCellListDelegate = class NotebookCellListDelegate extends Disposable {
    constructor(targetWindow, configurationService) {
        super();
        this.configurationService = configurationService;
        const editorOptions = this.configurationService.getValue('editor');
        this.lineHeight = createBareFontInfoFromRawSettings(editorOptions, PixelRatio.getInstance(targetWindow).value).lineHeight;
    }
    getHeight(element) {
        return element.getHeight(this.lineHeight);
    }
    getDynamicHeight(element) {
        return element.getDynamicHeight();
    }
    getTemplateId(element) {
        if (element.cellKind === CellKind.Markup) {
            return MarkupCellRenderer.TEMPLATE_ID;
        }
        else {
            return CodeCellRenderer.TEMPLATE_ID;
        }
    }
};
NotebookCellListDelegate = __decorate([
    __param(1, IConfigurationService)
], NotebookCellListDelegate);
export { NotebookCellListDelegate };
class AbstractCellRenderer extends Disposable {
    constructor(instantiationService, notebookEditor, contextMenuService, menuService, configurationService, keybindingService, notificationService, contextKeyServiceProvider, language, dndController) {
        super();
        this.instantiationService = instantiationService;
        this.notebookEditor = notebookEditor;
        this.contextMenuService = contextMenuService;
        this.menuService = menuService;
        this.keybindingService = keybindingService;
        this.notificationService = notificationService;
        this.contextKeyServiceProvider = contextKeyServiceProvider;
        this.dndController = dndController;
        this.editorOptions = this._register(new CellEditorOptions(this.notebookEditor.getBaseCellEditorOptions(language), this.notebookEditor.notebookOptions, configurationService));
    }
    dispose() {
        super.dispose();
        this.dndController = undefined;
    }
}
let MarkupCellRenderer = class MarkupCellRenderer extends AbstractCellRenderer {
    static { MarkupCellRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'markdown_cell'; }
    constructor(notebookEditor, dndController, renderedEditors, contextKeyServiceProvider, configurationService, instantiationService, contextMenuService, menuService, keybindingService, notificationService, notebookExecutionStateService) {
        super(instantiationService, notebookEditor, contextMenuService, menuService, configurationService, keybindingService, notificationService, contextKeyServiceProvider, 'markdown', dndController);
        this.renderedEditors = renderedEditors;
        this._notebookExecutionStateService = notebookExecutionStateService;
    }
    get templateId() {
        return MarkupCellRenderer_1.TEMPLATE_ID;
    }
    renderTemplate(rootContainer) {
        rootContainer.classList.add('markdown-cell-row');
        const container = DOM.append(rootContainer, DOM.$('.cell-inner-container'));
        const templateDisposables = new DisposableStore();
        const contextKeyService = templateDisposables.add(this.contextKeyServiceProvider(container));
        const decorationContainer = DOM.append(rootContainer, $('.cell-decoration'));
        const titleToolbarContainer = DOM.append(container, $('.cell-title-toolbar'));
        const focusIndicatorTop = new FastDomNode(DOM.append(container, $('.cell-focus-indicator.cell-focus-indicator-top')));
        const focusIndicatorLeft = new FastDomNode(DOM.append(container, DOM.$('.cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-left')));
        const foldingIndicator = DOM.append(focusIndicatorLeft.domNode, DOM.$('.notebook-folding-indicator'));
        const focusIndicatorRight = new FastDomNode(DOM.append(container, DOM.$('.cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-right')));
        const codeInnerContent = DOM.append(container, $('.cell.code'));
        const editorPart = DOM.append(codeInnerContent, $('.cell-editor-part'));
        const cellChatPart = DOM.append(editorPart, $('.cell-chat-part'));
        const cellInputCollapsedContainer = DOM.append(codeInnerContent, $('.input-collapse-container'));
        cellInputCollapsedContainer.style.display = 'none';
        const editorContainer = DOM.append(editorPart, $('.cell-editor-container'));
        editorPart.style.display = 'none';
        const cellCommentPartContainer = DOM.append(container, $('.cell-comment-container'));
        const innerContent = DOM.append(container, $('.cell.markdown'));
        const bottomCellContainer = DOM.append(container, $('.cell-bottom-toolbar-container'));
        const scopedInstaService = templateDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
        const rootClassDelegate = {
            toggle: (className, force) => container.classList.toggle(className, force)
        };
        const titleToolbar = templateDisposables.add(scopedInstaService.createInstance(CellTitleToolbarPart, titleToolbarContainer, rootClassDelegate, this.notebookEditor.creationOptions.menuIds.cellTitleToolbar, this.notebookEditor.creationOptions.menuIds.cellDeleteToolbar, this.notebookEditor));
        const focusIndicatorBottom = new FastDomNode(DOM.append(container, $('.cell-focus-indicator.cell-focus-indicator-bottom')));
        const cellParts = new CellPartsCollection(DOM.getWindow(rootContainer), [
            templateDisposables.add(scopedInstaService.createInstance(CellChatPart, this.notebookEditor, cellChatPart)),
            templateDisposables.add(scopedInstaService.createInstance(CellEditorStatusBar, this.notebookEditor, container, editorPart, undefined)),
            templateDisposables.add(new CellFocusIndicator(this.notebookEditor, titleToolbar, focusIndicatorTop, focusIndicatorLeft, focusIndicatorRight, focusIndicatorBottom)),
            templateDisposables.add(new FoldedCellHint(this.notebookEditor, DOM.append(container, $('.notebook-folded-hint')), this._notebookExecutionStateService)),
            templateDisposables.add(new CellDecorations(this.notebookEditor, rootContainer, decorationContainer)),
            templateDisposables.add(scopedInstaService.createInstance(CellComments, this.notebookEditor, cellCommentPartContainer)),
            templateDisposables.add(new CollapsedCellInput(this.notebookEditor, cellInputCollapsedContainer)),
            templateDisposables.add(new CellFocusPart(container, undefined, this.notebookEditor)),
            templateDisposables.add(new CellDragAndDropPart(container)),
            templateDisposables.add(scopedInstaService.createInstance(CellContextKeyPart, this.notebookEditor)),
        ], [
            titleToolbar,
            templateDisposables.add(scopedInstaService.createInstance(BetweenCellToolbar, this.notebookEditor, titleToolbarContainer, bottomCellContainer))
        ]);
        templateDisposables.add(cellParts);
        const templateData = {
            rootContainer,
            cellInputCollapsedContainer,
            instantiationService: scopedInstaService,
            container,
            cellContainer: innerContent,
            editorPart,
            editorContainer,
            foldingIndicator,
            templateDisposables,
            elementDisposables: templateDisposables.add(new DisposableStore()),
            cellParts,
            toJSON: () => { return {}; }
        };
        return templateData;
    }
    renderElement(element, index, templateData, details) {
        if (!this.notebookEditor.hasModel()) {
            throw new Error('The notebook editor is not attached with view model yet.');
        }
        templateData.currentRenderedCell = element;
        templateData.currentEditor = undefined;
        templateData.editorPart.style.display = 'none';
        templateData.cellContainer.innerText = '';
        if (details?.height === undefined) {
            return;
        }
        templateData.elementDisposables.add(templateData.instantiationService.createInstance(MarkupCell, this.notebookEditor, element, templateData, this.renderedEditors));
    }
    disposeTemplate(templateData) {
        templateData.templateDisposables.dispose();
    }
    disposeElement(_element, _index, templateData) {
        templateData.elementDisposables.clear();
    }
};
MarkupCellRenderer = MarkupCellRenderer_1 = __decorate([
    __param(4, IConfigurationService),
    __param(5, IInstantiationService),
    __param(6, IContextMenuService),
    __param(7, IMenuService),
    __param(8, IKeybindingService),
    __param(9, INotificationService),
    __param(10, INotebookExecutionStateService)
], MarkupCellRenderer);
export { MarkupCellRenderer };
let CodeCellRenderer = class CodeCellRenderer extends AbstractCellRenderer {
    static { CodeCellRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'code_cell'; }
    constructor(notebookEditor, renderedEditors, editorPool, dndController, contextKeyServiceProvider, configurationService, contextMenuService, menuService, instantiationService, keybindingService, notificationService) {
        super(instantiationService, notebookEditor, contextMenuService, menuService, configurationService, keybindingService, notificationService, contextKeyServiceProvider, PLAINTEXT_LANGUAGE_ID, dndController);
        this.renderedEditors = renderedEditors;
        this.editorPool = editorPool;
    }
    get templateId() {
        return CodeCellRenderer_1.TEMPLATE_ID;
    }
    renderTemplate(rootContainer) {
        rootContainer.classList.add('code-cell-row');
        const container = DOM.append(rootContainer, DOM.$('.cell-inner-container'));
        const templateDisposables = new DisposableStore();
        const contextKeyService = templateDisposables.add(this.contextKeyServiceProvider(container));
        const decorationContainer = DOM.append(rootContainer, $('.cell-decoration'));
        const focusIndicatorTop = new FastDomNode(DOM.append(container, $('.cell-focus-indicator.cell-focus-indicator-top')));
        const titleToolbarContainer = DOM.append(container, $('.cell-title-toolbar'));
        // This is also the drag handle
        const focusIndicatorLeft = new FastDomNode(DOM.append(container, DOM.$('.cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-left')));
        const cellChatPart = DOM.append(container, $('.cell-chat-part'));
        const cellContainer = DOM.append(container, $('.cell.code'));
        const runButtonContainer = DOM.append(cellContainer, $('.run-button-container'));
        const cellInputCollapsedContainer = DOM.append(cellContainer, $('.input-collapse-container'));
        cellInputCollapsedContainer.style.display = 'none';
        const executionOrderLabel = DOM.append(focusIndicatorLeft.domNode, $('div.execution-count-label'));
        executionOrderLabel.title = localize('cellExecutionOrderCountLabel', 'Execution Order');
        const editorPart = DOM.append(cellContainer, $('.cell-editor-part'));
        const editorContainer = DOM.append(editorPart, $('.cell-editor-container'));
        const cellCommentPartContainer = DOM.append(container, $('.cell-comment-container'));
        // create a special context key service that set the inCompositeEditor-contextkey
        const editorContextKeyService = templateDisposables.add(this.contextKeyServiceProvider(editorPart));
        const editorInstaService = templateDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, editorContextKeyService])));
        EditorContextKeys.inCompositeEditor.bindTo(editorContextKeyService).set(true);
        const editor = editorInstaService.createInstance(CodeEditorWidget, editorContainer, {
            ...this.editorOptions.getDefaultValue(),
            allowVariableLineHeights: false,
            dimension: {
                width: 0,
                height: 0
            },
            scrollbar: {
                vertical: 'hidden',
                horizontal: 'auto',
                handleMouseWheel: false,
                useShadows: false,
            },
        }, {
            contributions: this.notebookEditor.creationOptions.cellEditorContributions
        });
        templateDisposables.add(editor);
        const outputContainer = new FastDomNode(DOM.append(container, $('.output')));
        const cellOutputCollapsedContainer = DOM.append(outputContainer.domNode, $('.output-collapse-container'));
        const outputShowMoreContainer = new FastDomNode(DOM.append(container, $('.output-show-more-container')));
        const focusIndicatorRight = new FastDomNode(DOM.append(container, DOM.$('.cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-right')));
        const focusSinkElement = DOM.append(container, $('.cell-editor-focus-sink'));
        focusSinkElement.setAttribute('tabindex', '0');
        const bottomCellToolbarContainer = DOM.append(container, $('.cell-bottom-toolbar-container'));
        const focusIndicatorBottom = new FastDomNode(DOM.append(container, $('.cell-focus-indicator.cell-focus-indicator-bottom')));
        const scopedInstaService = templateDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
        const rootClassDelegate = {
            toggle: (className, force) => container.classList.toggle(className, force)
        };
        const titleToolbar = templateDisposables.add(scopedInstaService.createInstance(CellTitleToolbarPart, titleToolbarContainer, rootClassDelegate, this.notebookEditor.creationOptions.menuIds.cellTitleToolbar, this.notebookEditor.creationOptions.menuIds.cellDeleteToolbar, this.notebookEditor));
        const focusIndicatorPart = templateDisposables.add(new CellFocusIndicator(this.notebookEditor, titleToolbar, focusIndicatorTop, focusIndicatorLeft, focusIndicatorRight, focusIndicatorBottom));
        const contentParts = [
            focusIndicatorPart,
            templateDisposables.add(scopedInstaService.createInstance(CellChatPart, this.notebookEditor, cellChatPart)),
            templateDisposables.add(scopedInstaService.createInstance(CellEditorStatusBar, this.notebookEditor, container, editorPart, editor)),
            templateDisposables.add(scopedInstaService.createInstance(CellProgressBar, editorPart, cellInputCollapsedContainer)),
            templateDisposables.add(new CellDecorations(this.notebookEditor, rootContainer, decorationContainer)),
            templateDisposables.add(scopedInstaService.createInstance(CellComments, this.notebookEditor, cellCommentPartContainer)),
            templateDisposables.add(scopedInstaService.createInstance(CellExecutionPart, this.notebookEditor, executionOrderLabel)),
            templateDisposables.add(scopedInstaService.createInstance(CollapsedCellOutput, this.notebookEditor, cellOutputCollapsedContainer)),
            templateDisposables.add(new CollapsedCellInput(this.notebookEditor, cellInputCollapsedContainer)),
            templateDisposables.add(new CellFocusPart(container, focusSinkElement, this.notebookEditor)),
            templateDisposables.add(new CellDragAndDropPart(container)),
            templateDisposables.add(scopedInstaService.createInstance(CellContextKeyPart, this.notebookEditor)),
        ];
        const { cellExecutePrimary, cellExecuteToolbar } = this.notebookEditor.creationOptions.menuIds;
        if (cellExecutePrimary && cellExecuteToolbar) {
            contentParts.push(templateDisposables.add(scopedInstaService.createInstance(RunToolbar, this.notebookEditor, contextKeyService, container, runButtonContainer, cellExecutePrimary, cellExecuteToolbar)));
        }
        const cellParts = new CellPartsCollection(DOM.getWindow(rootContainer), contentParts, [
            titleToolbar,
            templateDisposables.add(scopedInstaService.createInstance(BetweenCellToolbar, this.notebookEditor, titleToolbarContainer, bottomCellToolbarContainer))
        ]);
        templateDisposables.add(cellParts);
        const templateData = {
            rootContainer,
            editorPart,
            cellInputCollapsedContainer,
            cellOutputCollapsedContainer,
            instantiationService: scopedInstaService,
            container,
            cellContainer,
            focusSinkElement,
            outputContainer,
            outputShowMoreContainer,
            editor,
            templateDisposables,
            elementDisposables: templateDisposables.add(new DisposableStore()),
            cellParts,
            toJSON: () => { return {}; }
        };
        // focusIndicatorLeft covers the left margin area
        // code/outputFocusIndicator need to be registered as drag handlers so their click handlers don't take over
        const dragHandles = [focusIndicatorLeft.domNode, focusIndicatorPart.codeFocusIndicator.domNode, focusIndicatorPart.outputFocusIndicator.domNode];
        this.dndController?.registerDragHandle(templateData, rootContainer, dragHandles, () => new CodeCellDragImageRenderer().getDragImage(templateData, templateData.editor, 'code'));
        return templateData;
    }
    renderElement(element, index, templateData, details) {
        if (!this.notebookEditor.hasModel()) {
            throw new Error('The notebook editor is not attached with view model yet.');
        }
        templateData.currentRenderedCell = element;
        if (details?.height === undefined) {
            return;
        }
        templateData.outputContainer.domNode.innerText = '';
        templateData.outputContainer.domNode.appendChild(templateData.cellOutputCollapsedContainer);
        templateData.elementDisposables.add(templateData.instantiationService.createInstance(CodeCell, this.notebookEditor, element, templateData, this.editorPool));
        this.renderedEditors.set(element, templateData.editor);
    }
    disposeTemplate(templateData) {
        templateData.templateDisposables.dispose();
    }
    disposeElement(element, index, templateData) {
        templateData.elementDisposables.clear();
        this.renderedEditors.delete(element);
    }
};
CodeCellRenderer = CodeCellRenderer_1 = __decorate([
    __param(5, IConfigurationService),
    __param(6, IContextMenuService),
    __param(7, IMenuService),
    __param(8, IInstantiationService),
    __param(9, IKeybindingService),
    __param(10, INotificationService)
], CodeCellRenderer);
export { CodeCellRenderer };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2VsbFJlbmRlcmVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL25vdGVib29rL2Jyb3dzZXIvdmlldy9yZW5kZXJlcnMvY2VsbFJlbmRlcmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDMUUsT0FBTyxLQUFLLEdBQUcsTUFBTSx1Q0FBdUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFFNUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUV6RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx3RUFBd0UsQ0FBQztBQUUxRyxPQUFPLEVBQUUsaUNBQWlDLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUNuSCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN6RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDcEQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxrQkFBa0IsRUFBNEIsTUFBTSw0REFBNEQsQ0FBQztBQUMxSCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUNwRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUN6RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzRUFBc0UsQ0FBQztBQUN6RyxPQUFPLEVBQUUs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