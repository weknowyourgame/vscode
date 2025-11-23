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
import { renderMarkdown } from '../../../../../../base/browser/markdownRenderer.js';
import { Action } from '../../../../../../base/common/actions.js';
import { Disposable, DisposableStore } from '../../../../../../base/common/lifecycle.js';
import * as nls from '../../../../../../nls.js';
import { getActionBarActions } from '../../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { WorkbenchToolBar } from '../../../../../../platform/actions/browser/toolbar.js';
import { IMenuService, MenuId } from '../../../../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IOpenerService } from '../../../../../../platform/opener/common/opener.js';
import { IQuickInputService } from '../../../../../../platform/quickinput/common/quickInput.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { IExtensionsWorkbenchService } from '../../../../extensions/common/extensions.js';
import { JUPYTER_EXTENSION_ID } from '../../notebookBrowser.js';
import { mimetypeIcon } from '../../notebookIcons.js';
import { CellContentPart } from '../cellPart.js';
import { CellUri, NotebookCellExecutionState, RENDERER_NOT_AVAILABLE } from '../../../common/notebookCommon.js';
import { isTextStreamMime } from '../../../../../../base/common/mime.js';
import { INotebookExecutionStateService } from '../../../common/notebookExecutionStateService.js';
import { INotebookService } from '../../../common/notebookService.js';
import { COPY_OUTPUT_COMMAND_ID } from '../../controller/cellOutputActions.js';
import { autorun, observableValue } from '../../../../../../base/common/observable.js';
import { NOTEBOOK_CELL_HAS_HIDDEN_OUTPUTS, NOTEBOOK_CELL_IS_FIRST_OUTPUT, NOTEBOOK_CELL_OUTPUT_MIMETYPE } from '../../../common/notebookContextKeys.js';
import { TEXT_BASED_MIMETYPES } from '../../viewModel/cellOutputTextHelper.js';
// DOM structure
//
//  #output
//  |
//  |  #output-inner-container
//  |                        |  #cell-output-toolbar
//  |                        |  #output-element
//  |                        |  #output-element
//  |                        |  #output-element
//  |  #output-inner-container
//  |                        |  #cell-output-toolbar
//  |                        |  #output-element
//  |  #output-inner-container
//  |                        |  #cell-output-toolbar
//  |                        |  #output-element
let CellOutputElement = class CellOutputElement extends Disposable {
    constructor(notebookEditor, viewCell, cellOutputContainer, outputContainer, output, notebookService, quickInputService, parentContextKeyService, menuService, extensionsWorkbenchService, instantiationService) {
        super();
        this.notebookEditor = notebookEditor;
        this.viewCell = viewCell;
        this.cellOutputContainer = cellOutputContainer;
        this.outputContainer = outputContainer;
        this.output = output;
        this.notebookService = notebookService;
        this.quickInputService = quickInputService;
        this.menuService = menuService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.instantiationService = instantiationService;
        this.toolbarDisposables = this._register(new DisposableStore());
        this.toolbarAttached = false;
        this._outputHeightTimer = null;
        this.contextKeyService = parentContextKeyService;
        this._register(this.output.model.onDidChangeData(() => {
            this.rerender();
        }));
        this._register(this.output.onDidResetRenderer(() => {
            this.rerender();
        }));
    }
    detach() {
        this.renderedOutputContainer?.remove();
        let count = 0;
        if (this.innerContainer) {
            for (let i = 0; i < this.innerContainer.childNodes.length; i++) {
                if (this.innerContainer.childNodes[i].className === 'rendered-output') {
                    count++;
                }
                if (count > 1) {
                    break;
                }
            }
            if (count === 0) {
                this.innerContainer.remove();
            }
        }
        this.notebookEditor.removeInset(this.output);
    }
    updateDOMTop(top) {
        if (this.innerContainer) {
            this.innerContainer.style.top = `${top}px`;
        }
    }
    rerender() {
        if (this.notebookEditor.hasModel() &&
            this.innerContainer &&
            this.renderResult &&
            this.renderResult.type === 1 /* RenderOutputType.Extension */) {
            // Output rendered by extension renderer got an update
            const [mimeTypes, pick] = this.output.resolveMimeTypes(this.notebookEditor.textModel, this.notebookEditor.activeKernel?.preloadProvides);
            const pickedMimeType = mimeTypes[pick];
            if (pickedMimeType.mimeType === this.renderResult.mimeType && pickedMimeType.rendererId === this.renderResult.renderer.id) {
                // Same mimetype, same renderer, call the extension renderer to update
                const index = this.viewCell.outputsViewModels.indexOf(this.output);
                this.notebookEditor.updateOutput(this.viewCell, this.renderResult, this.viewCell.getOutputOffset(index));
                return;
            }
        }
        if (!this.innerContainer) {
            // init rendering didn't happen
            const currOutputIndex = this.cellOutputContainer.renderedOutputEntries.findIndex(entry => entry.element === this);
            const previousSibling = currOutputIndex > 0 && !!(this.cellOutputContainer.renderedOutputEntries[currOutputIndex - 1].element.innerContainer?.parentElement)
                ? this.cellOutputContainer.renderedOutputEntries[currOutputIndex - 1].element.innerContainer
                : undefined;
            this.render(previousSibling);
        }
        else {
            // Another mimetype or renderer is picked, we need to clear the current output and re-render
            const nextElement = this.innerContainer.nextElementSibling;
            this.toolbarDisposables.clear();
            const element = this.innerContainer;
            if (element) {
                element.remove();
                this.notebookEditor.removeInset(this.output);
            }
            this.render(nextElement);
        }
        this._relayoutCell();
    }
    // insert after previousSibling
    _generateInnerOutputContainer(previousSibling, pickedMimeTypeRenderer) {
        this.innerContainer = DOM.$('.output-inner-container');
        if (previousSibling && previousSibling.nextElementSibling) {
            this.outputContainer.domNode.insertBefore(this.innerContainer, previousSibling.nextElementSibling);
        }
        else {
            this.outputContainer.domNode.appendChild(this.innerContainer);
        }
        this.innerContainer.setAttribute('output-mime-type', pickedMimeTypeRenderer.mimeType);
        return this.innerContainer;
    }
    render(previousSibling) {
        const index = this.viewCell.outputsViewModels.indexOf(this.output);
        if (this.viewCell.isOutputCollapsed || !this.notebookEditor.hasModel()) {
            this.cellOutputContainer.flagAsStale();
            return undefined;
        }
        const notebookUri = CellUri.parse(this.viewCell.uri)?.notebook;
        if (!notebookUri) {
            return undefined;
        }
        const notebookTextModel = this.notebookEditor.textModel;
        const [mimeTypes, pick] = this.output.resolveMimeTypes(notebookTextModel, this.notebookEditor.activeKernel?.preloadProvides);
        const currentMimeType = mimeTypes[pick];
        if (!mimeTypes.find(mimeType => mimeType.isTrusted) || mimeTypes.length === 0) {
            this.viewCell.updateOutputHeight(index, 0, 'CellOutputElement#noMimeType');
            return undefined;
        }
        const selectedPresentation = mimeTypes[pick];
        let renderer = this.notebookService.getRendererInfo(selectedPresentation.rendererId);
        if (!renderer && selectedPresentation.mimeType.indexOf('text/') > -1) {
            renderer = this.notebookService.getRendererInfo('vscode.builtin-renderer');
        }
        const innerContainer = this._generateInnerOutputContainer(previousSibling, selectedPresentation);
        if (index === 0 || this.output.visible.get()) {
            this._attachToolbar(innerContainer, notebookTextModel, this.notebookEditor.activeKernel, index, currentMimeType, mimeTypes);
        }
        else {
            this._register(autorun((reader) => {
                const visible = reader.readObservable(this.output.visible);
                if (visible && !this.toolbarAttached) {
                    this._attachToolbar(innerContainer, notebookTextModel, this.notebookEditor.activeKernel, index, currentMimeType, mimeTypes);
                }
                else if (!visible) {
                    this.toolbarDisposables.clear();
                }
                this.cellOutputContainer.checkForHiddenOutputs();
            }));
            this.cellOutputContainer.hasHiddenOutputs.set(true, undefined);
        }
        this.renderedOutputContainer = DOM.append(innerContainer, DOM.$('.rendered-output'));
        this.renderResult = renderer
            ? { type: 1 /* RenderOutputType.Extension */, renderer, source: this.output, mimeType: selectedPresentation.mimeType }
            : this._renderMissingRenderer(this.output, selectedPresentation.mimeType);
        this.output.pickedMimeType = selectedPresentation;
        if (!this.renderResult) {
            this.viewCell.updateOutputHeight(index, 0, 'CellOutputElement#renderResultUndefined');
            return undefined;
        }
        this.notebookEditor.createOutput(this.viewCell, this.renderResult, this.viewCell.getOutputOffset(index), false);
        innerContainer.classList.add('background');
        return { initRenderIsSynchronous: false };
    }
    _renderMissingRenderer(viewModel, preferredMimeType) {
        if (!viewModel.model.outputs.length) {
            return this._renderMessage(viewModel, nls.localize('empty', "Cell has no output"));
        }
        if (!preferredMimeType) {
            const mimeTypes = viewModel.model.outputs.map(op => op.mime);
            const mimeTypesMessage = mimeTypes.join(', ');
            return this._renderMessage(viewModel, nls.localize('noRenderer.2', "No renderer could be found for output. It has the following mimetypes: {0}", mimeTypesMessage));
        }
        return this._renderSearchForMimetype(viewModel, preferredMimeType);
    }
    _renderSearchForMimetype(viewModel, mimeType) {
        const query = `@tag:notebookRenderer ${mimeType}`;
        const p = DOM.$('p', undefined, `No renderer could be found for mimetype "${mimeType}", but one might be available on the Marketplace.`);
        const a = DOM.$('a', { href: `command:workbench.extensions.search?%22${query}%22`, class: 'monaco-button monaco-text-button', tabindex: 0, role: 'button', style: 'padding: 8px; text-decoration: none; color: rgb(255, 255, 255); background-color: rgb(14, 99, 156); max-width: 200px;' }, `Search Marketplace`);
        return {
            type: 0 /* RenderOutputType.Html */,
            source: viewModel,
            htmlContent: p.outerHTML + a.outerHTML
        };
    }
    _renderMessage(viewModel, message) {
        const el = DOM.$('p', undefined, message);
        return { type: 0 /* RenderOutputType.Html */, source: viewModel, htmlContent: el.outerHTML };
    }
    shouldEnableCopy(mimeTypes) {
        if (!mimeTypes.find(mimeType => TEXT_BASED_MIMETYPES.indexOf(mimeType.mimeType) || mimeType.mimeType.startsWith('image/'))) {
            return false;
        }
        if (isTextStreamMime(mimeTypes[0].mimeType)) {
            const cellViewModel = this.output.cellViewModel;
            const index = cellViewModel.outputsViewModels.indexOf(this.output);
            if (index > 0) {
                const previousOutput = cellViewModel.model.outputs[index - 1];
                // if the previous output was also a stream, the copy command will be in that output instead
                return !isTextStreamMime(previousOutput.outputs[0].mime);
            }
        }
        return true;
    }
    async _attachToolbar(outputItemDiv, notebookTextModel, kernel, index, currentMimeType, mimeTypes) {
        const hasMultipleMimeTypes = mimeTypes.filter(mimeType => mimeType.isTrusted).length > 1;
        const isCopyEnabled = this.shouldEnableCopy(mimeTypes);
        if (index > 0 && !hasMultipleMimeTypes && !isCopyEnabled) {
            // nothing to put in the toolbar
            return;
        }
        if (!this.notebookEditor.hasModel()) {
            return;
        }
        outputItemDiv.style.position = 'relative';
        const mimeTypePicker = DOM.$('.cell-output-toolbar');
        outputItemDiv.appendChild(mimeTypePicker);
        const toolbar = this.toolbarDisposables.add(this.instantiationService.createInstance(WorkbenchToolBar, mimeTypePicker, {
            renderDropdownAsChildElement: false
        }));
        toolbar.context = {
            ui: true,
            cell: this.output.cellViewModel,
            outputViewModel: this.output,
            notebookEditor: this.notebookEditor,
            $mid: 13 /* MarshalledId.NotebookCellActionContext */
        };
        // TODO: This could probably be a real registered action, but it has to talk to this output element
        const pickAction = this.toolbarDisposables.add(new Action('notebook.output.pickMimetype', nls.localize('pickMimeType', "Change Presentation"), ThemeIcon.asClassName(mimetypeIcon), undefined, async (_context) => this._pickActiveMimeTypeRenderer(outputItemDiv, notebookTextModel, kernel, this.output)));
        const menuContextKeyService = this.toolbarDisposables.add(this.contextKeyService.createScoped(outputItemDiv));
        const hasHiddenOutputs = NOTEBOOK_CELL_HAS_HIDDEN_OUTPUTS.bindTo(menuContextKeyService);
        const isFirstCellOutput = NOTEBOOK_CELL_IS_FIRST_OUTPUT.bindTo(menuContextKeyService);
        const cellOutputMimetype = NOTEBOOK_CELL_OUTPUT_MIMETYPE.bindTo(menuContextKeyService);
        isFirstCellOutput.set(index === 0);
        cellOutputMimetype.set(currentMimeType.mimeType);
        this.toolbarDisposables.add(autorun((r) => { hasHiddenOutputs.set(this.cellOutputContainer.hasHiddenOutputs.read(r)); }));
        const menu = this.toolbarDisposables.add(this.menuService.createMenu(MenuId.NotebookOutputToolbar, menuContextKeyService));
        const updateMenuToolbar = () => {
            let { secondary } = getActionBarActions(menu.getActions({ shouldForwardArgs: true }), () => false);
            if (!isCopyEnabled) {
                secondary = secondary.filter((action) => action.id !== COPY_OUTPUT_COMMAND_ID);
            }
            if (hasMultipleMimeTypes) {
                secondary = [pickAction, ...secondary];
            }
            toolbar.setActions([], secondary);
        };
        updateMenuToolbar();
        this.toolbarDisposables.add(menu.onDidChange(updateMenuToolbar));
    }
    async _pickActiveMimeTypeRenderer(outputItemDiv, notebookTextModel, kernel, viewModel) {
        const [mimeTypes, currIndex] = viewModel.resolveMimeTypes(notebookTextModel, kernel?.preloadProvides);
        const items = [];
        const unsupportedItems = [];
        mimeTypes.forEach((mimeType, index) => {
            if (mimeType.isTrusted) {
                const arr = mimeType.rendererId === RENDERER_NOT_AVAILABLE ?
                    unsupportedItems :
                    items;
                arr.push({
                    label: mimeType.mimeType,
                    id: mimeType.mimeType,
                    index: index,
                    picked: index === currIndex,
                    detail: this._generateRendererInfo(mimeType.rendererId),
                    description: index === currIndex ? nls.localize('curruentActiveMimeType', "Currently Active") : undefined
                });
            }
        });
        if (unsupportedItems.some(m => JUPYTER_RENDERER_MIMETYPES.includes(m.id))) {
            unsupportedItems.push({
                label: nls.localize('installJupyterPrompt', "Install additional renderers from the marketplace"),
                id: 'installRenderers',
                index: mimeTypes.length
            });
        }
        const disposables = new DisposableStore();
        const picker = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
        picker.items = [
            ...items,
            { type: 'separator' },
            ...unsupportedItems
        ];
        picker.activeItems = items.filter(item => !!item.picked);
        picker.placeholder = items.length !== mimeTypes.length
            ? nls.localize('promptChooseMimeTypeInSecure.placeHolder', "Select mimetype to render for current output")
            : nls.localize('promptChooseMimeType.placeHolder', "Select mimetype to render for current output");
        const pick = await new Promise(resolve => {
            disposables.add(picker.onDidAccept(() => {
                resolve(picker.selectedItems.length === 1 ? picker.selectedItems[0] : undefined);
                disposables.dispose();
            }));
            picker.show();
        });
        if (pick === undefined || pick.index === currIndex) {
            return;
        }
        if (pick.id === 'installRenderers') {
            this._showJupyterExtension();
            return;
        }
        // user chooses another mimetype
        const nextElement = outputItemDiv.nextElementSibling;
        this.toolbarDisposables.clear();
        const element = this.innerContainer;
        if (element) {
            element.remove();
            this.notebookEditor.removeInset(viewModel);
        }
        viewModel.pickedMimeType = mimeTypes[pick.index];
        this.viewCell.updateOutputMinHeight(this.viewCell.layoutInfo.outputTotalHeight);
        const { mimeType, rendererId } = mimeTypes[pick.index];
        this.notebookService.updateMimePreferredRenderer(notebookTextModel.viewType, mimeType, rendererId, mimeTypes.map(m => m.mimeType));
        this.render(nextElement);
        this._validateFinalOutputHeight(false);
        this._relayoutCell();
    }
    async _showJupyterExtension() {
        await this.extensionsWorkbenchService.openSearch(`@id:${JUPYTER_EXTENSION_ID}`);
    }
    _generateRendererInfo(renderId) {
        const renderInfo = this.notebookService.getRendererInfo(renderId);
        if (renderInfo) {
            const displayName = renderInfo.displayName !== '' ? renderInfo.displayName : renderInfo.id;
            return `${displayName} (${renderInfo.extensionId.value})`;
        }
        return nls.localize('unavailableRenderInfo', "renderer not available");
    }
    _validateFinalOutputHeight(synchronous) {
        if (this._outputHeightTimer !== null) {
            clearTimeout(this._outputHeightTimer);
        }
        if (synchronous) {
            this.viewCell.unlockOutputHeight();
        }
        else {
            this._outputHeightTimer = setTimeout(() => {
                this.viewCell.unlockOutputHeight();
            }, 1000);
        }
    }
    _relayoutCell() {
        this.notebookEditor.layoutNotebookCell(this.viewCell, this.viewCell.layoutInfo.totalHeight);
    }
    dispose() {
        if (this._outputHeightTimer) {
            this.viewCell.unlockOutputHeight();
            clearTimeout(this._outputHeightTimer);
        }
        super.dispose();
    }
};
CellOutputElement = __decorate([
    __param(5, INotebookService),
    __param(6, IQuickInputService),
    __param(7, IContextKeyService),
    __param(8, IMenuService),
    __param(9, IExtensionsWorkbenchService),
    __param(10, IInstantiationService)
], CellOutputElement);
class OutputEntryViewHandler {
    constructor(model, element) {
        this.model = model;
        this.element = element;
    }
}
var CellOutputUpdateContext;
(function (CellOutputUpdateContext) {
    CellOutputUpdateContext[CellOutputUpdateContext["Execution"] = 1] = "Execution";
    CellOutputUpdateContext[CellOutputUpdateContext["Other"] = 2] = "Other";
})(CellOutputUpdateContext || (CellOutputUpdateContext = {}));
let CellOutputContainer = class CellOutputContainer extends CellContentPart {
    checkForHiddenOutputs() {
        if (this._outputEntries.find(entry => { return !entry.model.visible.get(); })) {
            this.hasHiddenOutputs.set(true, undefined);
        }
        else {
            this.hasHiddenOutputs.set(false, undefined);
        }
    }
    get renderedOutputEntries() {
        return this._outputEntries;
    }
    constructor(notebookEditor, viewCell, templateData, options, openerService, _notebookExecutionStateService, instantiationService) {
        super();
        this.notebookEditor = notebookEditor;
        this.viewCell = viewCell;
        this.templateData = templateData;
        this.options = options;
        this.openerService = openerService;
        this._notebookExecutionStateService = _notebookExecutionStateService;
        this.instantiationService = instantiationService;
        this._outputEntries = [];
        this._hasStaleOutputs = false;
        this.hasHiddenOutputs = observableValue('hasHiddenOutputs', false);
        this._outputHeightTimer = null;
        this._register(viewCell.onDidStartExecution(() => {
            viewCell.updateOutputMinHeight(viewCell.layoutInfo.outputTotalHeight);
        }));
        this._register(viewCell.onDidStopExecution(() => {
            this._validateFinalOutputHeight(false);
        }));
        this._register(viewCell.onDidChangeOutputs(splice => {
            const executionState = this._notebookExecutionStateService.getCellExecution(viewCell.uri);
            const context = executionState ? 1 /* CellOutputUpdateContext.Execution */ : 2 /* CellOutputUpdateContext.Other */;
            this._updateOutputs(splice, context);
        }));
        this._register(viewCell.onDidChangeLayout(() => {
            this.updateInternalLayoutNow(viewCell);
        }));
    }
    updateInternalLayoutNow(viewCell) {
        this.templateData.outputContainer.setTop(viewCell.layoutInfo.outputContainerOffset);
        this.templateData.outputShowMoreContainer.setTop(viewCell.layoutInfo.outputShowMoreContainerOffset);
        this._outputEntries.forEach(entry => {
            const index = this.viewCell.outputsViewModels.indexOf(entry.model);
            if (index >= 0) {
                const top = this.viewCell.getOutputOffsetInContainer(index);
                entry.element.updateDOMTop(top);
            }
        });
    }
    render() {
        try {
            this._doRender();
        }
        finally {
            // TODO@rebornix, this is probably not necessary at all as cell layout change would send the update request.
            this._relayoutCell();
        }
    }
    /**
     * Notify that an output may have been swapped out without the model getting rendered.
     */
    flagAsStale() {
        this._hasStaleOutputs = true;
    }
    _doRender() {
        if (this.viewCell.outputsViewModels.length > 0) {
            if (this.viewCell.layoutInfo.outputTotalHeight !== 0) {
                this.viewCell.updateOutputMinHeight(this.viewCell.layoutInfo.outputTotalHeight);
            }
            DOM.show(this.templateData.outputContainer.domNode);
            for (let index = 0; index < Math.min(this.options.limit, this.viewCell.outputsViewModels.length); index++) {
                const currOutput = this.viewCell.outputsViewModels[index];
                const entry = this.instantiationService.createInstance(CellOutputElement, this.notebookEditor, this.viewCell, this, this.templateData.outputContainer, currOutput);
                this._outputEntries.push(new OutputEntryViewHandler(currOutput, entry));
                entry.render(undefined);
            }
            if (this.viewCell.outputsViewModels.length > this.options.limit) {
                DOM.show(this.templateData.outputShowMoreContainer.domNode);
                this.viewCell.updateOutputShowMoreContainerHeight(46);
            }
            this._validateFinalOutputHeight(false);
        }
        else {
            // noop
            DOM.hide(this.templateData.outputContainer.domNode);
        }
        this.templateData.outputShowMoreContainer.domNode.innerText = '';
        if (this.viewCell.outputsViewModels.length > this.options.limit) {
            this.templateData.outputShowMoreContainer.domNode.appendChild(this._generateShowMoreElement(this.templateData.templateDisposables));
        }
        else {
            DOM.hide(this.templateData.outputShowMoreContainer.domNode);
            this.viewCell.updateOutputShowMoreContainerHeight(0);
        }
    }
    viewUpdateShowOutputs(initRendering) {
        if (this._hasStaleOutputs) {
            this._hasStaleOutputs = false;
            this._outputEntries.forEach(entry => {
                entry.element.rerender();
            });
        }
        for (let index = 0; index < this._outputEntries.length; index++) {
            const viewHandler = this._outputEntries[index];
            const outputEntry = viewHandler.element;
            if (outputEntry.renderResult) {
                this.notebookEditor.createOutput(this.viewCell, outputEntry.renderResult, this.viewCell.getOutputOffset(index), false);
            }
            else {
                outputEntry.render(undefined);
            }
        }
        this._relayoutCell();
    }
    viewUpdateHideOuputs() {
        for (let index = 0; index < this._outputEntries.length; index++) {
            this.notebookEditor.hideInset(this._outputEntries[index].model);
        }
    }
    _validateFinalOutputHeight(synchronous) {
        if (this._outputHeightTimer !== null) {
            clearTimeout(this._outputHeightTimer);
        }
        const executionState = this._notebookExecutionStateService.getCellExecution(this.viewCell.uri);
        if (synchronous) {
            this.viewCell.unlockOutputHeight();
        }
        else if (executionState?.state !== NotebookCellExecutionState.Executing) {
            this._outputHeightTimer = setTimeout(() => {
                this.viewCell.unlockOutputHeight();
            }, 200);
        }
    }
    _updateOutputs(splice, context = 2 /* CellOutputUpdateContext.Other */) {
        const previousOutputHeight = this.viewCell.layoutInfo.outputTotalHeight;
        // for cell output update, we make sure the cell does not shrink before the new outputs are rendered.
        this.viewCell.updateOutputMinHeight(previousOutputHeight);
        if (this.viewCell.outputsViewModels.length) {
            DOM.show(this.templateData.outputContainer.domNode);
        }
        else {
            DOM.hide(this.templateData.outputContainer.domNode);
        }
        this.viewCell.spliceOutputHeights(splice.start, splice.deleteCount, splice.newOutputs.map(_ => 0));
        this._renderNow(splice, context);
    }
    _renderNow(splice, context) {
        if (splice.start >= this.options.limit) {
            // splice items out of limit
            return;
        }
        const firstGroupEntries = this._outputEntries.slice(0, splice.start);
        const deletedEntries = this._outputEntries.slice(splice.start, splice.start + splice.deleteCount);
        const secondGroupEntries = this._outputEntries.slice(splice.start + splice.deleteCount);
        let newlyInserted = this.viewCell.outputsViewModels.slice(splice.start, splice.start + splice.newOutputs.length);
        // [...firstGroup, ...deletedEntries, ...secondGroupEntries]  [...restInModel]
        // [...firstGroup, ...newlyInserted, ...secondGroupEntries, restInModel]
        if (firstGroupEntries.length + newlyInserted.length + secondGroupEntries.length > this.options.limit) {
            // exceeds limit again
            if (firstGroupEntries.length + newlyInserted.length > this.options.limit) {
                [...deletedEntries, ...secondGroupEntries].forEach(entry => {
                    entry.element.detach();
                    entry.element.dispose();
                });
                newlyInserted = newlyInserted.slice(0, this.options.limit - firstGroupEntries.length);
                const newlyInsertedEntries = newlyInserted.map(insert => {
                    return new OutputEntryViewHandler(insert, this.instantiationService.createInstance(CellOutputElement, this.notebookEditor, this.viewCell, this, this.templateData.outputContainer, insert));
                });
                this._outputEntries = [...firstGroupEntries, ...newlyInsertedEntries];
                // render newly inserted outputs
                for (let i = firstGroupEntries.length; i < this._outputEntries.length; i++) {
                    this._outputEntries[i].element.render(undefined);
                }
            }
            else {
                // part of secondGroupEntries are pushed out of view
                // now we have to be creative as secondGroupEntries might not use dedicated containers
                const elementsPushedOutOfView = secondGroupEntries.slice(this.options.limit - firstGroupEntries.length - newlyInserted.length);
                [...deletedEntries, ...elementsPushedOutOfView].forEach(entry => {
                    entry.element.detach();
                    entry.element.dispose();
                });
                // exclusive
                const reRenderRightBoundary = firstGroupEntries.length + newlyInserted.length;
                const newlyInsertedEntries = newlyInserted.map(insert => {
                    return new OutputEntryViewHandler(insert, this.instantiationService.createInstance(CellOutputElement, this.notebookEditor, this.viewCell, this, this.templateData.outputContainer, insert));
                });
                this._outputEntries = [...firstGroupEntries, ...newlyInsertedEntries, ...secondGroupEntries.slice(0, this.options.limit - firstGroupEntries.length - newlyInserted.length)];
                for (let i = firstGroupEntries.length; i < reRenderRightBoundary; i++) {
                    const previousSibling = i - 1 >= 0 && this._outputEntries[i - 1] && !!(this._outputEntries[i - 1].element.innerContainer?.parentElement) ? this._outputEntries[i - 1].element.innerContainer : undefined;
                    this._outputEntries[i].element.render(previousSibling);
                }
            }
        }
        else {
            // after splice, it doesn't exceed
            deletedEntries.forEach(entry => {
                entry.element.detach();
                entry.element.dispose();
            });
            const reRenderRightBoundary = firstGroupEntries.length + newlyInserted.length;
            const newlyInsertedEntries = newlyInserted.map(insert => {
                return new OutputEntryViewHandler(insert, this.instantiationService.createInstance(CellOutputElement, this.notebookEditor, this.viewCell, this, this.templateData.outputContainer, insert));
            });
            let outputsNewlyAvailable = [];
            if (firstGroupEntries.length + newlyInsertedEntries.length + secondGroupEntries.length < this.viewCell.outputsViewModels.length) {
                const last = Math.min(this.options.limit, this.viewCell.outputsViewModels.length);
                outputsNewlyAvailable = this.viewCell.outputsViewModels.slice(firstGroupEntries.length + newlyInsertedEntries.length + secondGroupEntries.length, last).map(output => {
                    return new OutputEntryViewHandler(output, this.instantiationService.createInstance(CellOutputElement, this.notebookEditor, this.viewCell, this, this.templateData.outputContainer, output));
                });
            }
            this._outputEntries = [...firstGroupEntries, ...newlyInsertedEntries, ...secondGroupEntries, ...outputsNewlyAvailable];
            for (let i = firstGroupEntries.length; i < reRenderRightBoundary; i++) {
                const previousSibling = i - 1 >= 0 && this._outputEntries[i - 1] && !!(this._outputEntries[i - 1].element.innerContainer?.parentElement) ? this._outputEntries[i - 1].element.innerContainer : undefined;
                this._outputEntries[i].element.render(previousSibling);
            }
            for (let i = 0; i < outputsNewlyAvailable.length; i++) {
                this._outputEntries[firstGroupEntries.length + newlyInserted.length + secondGroupEntries.length + i].element.render(undefined);
            }
        }
        if (this.viewCell.outputsViewModels.length > this.options.limit) {
            DOM.show(this.templateData.outputShowMoreContainer.domNode);
            if (!this.templateData.outputShowMoreContainer.domNode.hasChildNodes()) {
                this.templateData.outputShowMoreContainer.domNode.appendChild(this._generateShowMoreElement(this.templateData.templateDisposables));
            }
            this.viewCell.updateOutputShowMoreContainerHeight(46);
        }
        else {
            DOM.hide(this.templateData.outputShowMoreContainer.domNode);
        }
        this._relayoutCell();
        // if it's clearing all outputs, or outputs are all rendered synchronously
        // shrink immediately as the final output height will be zero.
        // if it's rerun, then the output clearing might be temporary, so we don't shrink immediately
        this._validateFinalOutputHeight(context === 2 /* CellOutputUpdateContext.Other */ && this.viewCell.outputsViewModels.length === 0);
    }
    _generateShowMoreElement(disposables) {
        const md = {
            value: `There are more than ${this.options.limit} outputs, [show more (open the raw output data in a text editor) ...](command:workbench.action.openLargeOutput)`,
            isTrusted: true,
            supportThemeIcons: true
        };
        const rendered = disposables.add(renderMarkdown(md, {
            actionHandler: (content) => {
                if (content === 'command:workbench.action.openLargeOutput') {
                    this.openerService.open(CellUri.generateCellOutputUriWithId(this.notebookEditor.textModel.uri));
                }
            },
        }));
        rendered.element.classList.add('output-show-more');
        return rendered.element;
    }
    _relayoutCell() {
        this.notebookEditor.layoutNotebookCell(this.viewCell, this.viewCell.layoutInfo.totalHeight);
    }
    dispose() {
        this.viewCell.updateOutputMinHeight(0);
        if (this._outputHeightTimer) {
            clearTimeout(this._outputHeightTimer);
        }
        this._outputEntries.forEach(entry => {
            entry.element.dispose();
        });
        super.dispose();
    }
};
CellOutputContainer = __decorate([
    __param(4, IOpenerService),
    __param(5, INotebookExecutionStateService),
    __param(6, IInstantiationService)
], CellOutputContainer);
export { CellOutputContainer };
const JUPYTER_RENDERER_MIMETYPES = [
    'application/geo+json',
    'application/vdom.v1+json',
    'application/vnd.dataresource+json',
    'application/vnd.plotly.v1+json',
    'application/vnd.vega.v2+json',
    'application/vnd.vega.v3+json',
    'application/vnd.vega.v4+json',
    'application/vnd.vega.v5+json',
    'application/vnd.vegalite.v1+json',
    'application/vnd.vegalite.v2+json',
    'application/vnd.vegalite.v3+json',
    'application/vnd.vegalite.v4+json',
    'application/x-nteract-model-debug+json',
    'image/svg+xml',
    'text/latex',
    'text/vnd.plotly.v1+html',
    'application/vnd.jupyter.widget-view+json',
    'application/vnd.code.notebook.error'
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2VsbE91dHB1dC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXcvY2VsbFBhcnRzL2NlbGxPdXRwdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSx1Q0FBdUMsQ0FBQztBQUU3RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDcEYsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRWxFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFekYsT0FBTyxLQUFLLEdBQUcsTUFBTSwwQkFBMEIsQ0FBQztBQUNoRCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx1RUFBdUUsQ0FBQztBQUM1RyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN6RixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzVGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUNwRixPQUFPLEVBQUUsa0JBQWtCLEVBQWtCLE1BQU0sNERBQTRELENBQUM7QUFDaEgsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzFGLE9BQU8sRUFBcUYsb0JBQW9CLEVBQW9CLE1BQU0sMEJBQTBCLENBQUM7QUFDckssT0FBTyxFQUFFLFlB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