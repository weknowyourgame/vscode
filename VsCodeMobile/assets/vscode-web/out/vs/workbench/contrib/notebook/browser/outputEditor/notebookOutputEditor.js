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
var NotebookOutputEditor_1;
import * as DOM from '../../../../../base/browser/dom.js';
import * as nls from '../../../../../nls.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { URI } from '../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { EditorPane } from '../../../../browser/parts/editor/editorPane.js';
import { registerWorkbenchContribution2 } from '../../../../common/contributions.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../../services/editor/common/editorResolverService.js';
import { CellUri, NOTEBOOK_OUTPUT_EDITOR_ID } from '../../common/notebookCommon.js';
import { INotebookService } from '../../common/notebookService.js';
import { getDefaultNotebookCreationOptions } from '../notebookEditorWidget.js';
import { NotebookOptions } from '../notebookOptions.js';
import { BackLayerWebView } from '../view/renderers/backLayerWebView.js';
import { NotebookOutputEditorInput } from './notebookOutputEditorInput.js';
import { createBareFontInfoFromRawSettings } from '../../../../../editor/common/config/fontInfoFromSettings.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { FontMeasurements } from '../../../../../editor/browser/config/fontMeasurements.js';
import { PixelRatio } from '../../../../../base/browser/pixelRatio.js';
import { NotebookViewModel } from '../viewModel/notebookViewModelImpl.js';
import { NotebookEventDispatcher } from '../viewModel/eventDispatcher.js';
import { ViewContext } from '../viewModel/viewContext.js';
export class NoopCellEditorOptions extends Disposable {
    static { this.fixedEditorOptions = {
        scrollBeyondLastLine: false,
        scrollbar: {
            verticalScrollbarSize: 14,
            horizontal: 'auto',
            useShadows: true,
            verticalHasArrows: false,
            horizontalHasArrows: false,
            alwaysConsumeMouseWheel: false
        },
        renderLineHighlightOnlyWhenFocus: true,
        overviewRulerLanes: 0,
        lineDecorationsWidth: 0,
        folding: true,
        fixedOverflowWidgets: true,
        minimap: { enabled: false },
        renderValidationDecorations: 'on',
        lineNumbersMinChars: 3
    }; }
    get value() {
        return this._value;
    }
    constructor() {
        super();
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._value = Object.freeze({
            ...NoopCellEditorOptions.fixedEditorOptions,
            padding: { top: 12, bottom: 12 },
            readOnly: true
        });
    }
}
let NotebookOutputEditor = class NotebookOutputEditor extends EditorPane {
    static { NotebookOutputEditor_1 = this; }
    static { this.ID = NOTEBOOK_OUTPUT_EDITOR_ID; }
    get isDisposed() {
        return this._isDisposed;
    }
    constructor(group, instantiationService, themeService, telemetryService, storageService, configurationService, notebookService) {
        super(NotebookOutputEditor_1.ID, group, telemetryService, themeService, storageService);
        this.instantiationService = instantiationService;
        this.configurationService = configurationService;
        this.notebookService = notebookService;
        this.creationOptions = getDefaultNotebookCreationOptions();
        this._outputWebview = null;
        this._isDisposed = false;
        this._notebookOptions = this.instantiationService.createInstance(NotebookOptions, this.window, false, undefined);
        this._register(this._notebookOptions);
    }
    createEditor(parent) {
        this._rootElement = DOM.append(parent, DOM.$('.notebook-output-editor'));
    }
    get fontInfo() {
        if (!this._fontInfo) {
            this._fontInfo = this.createFontInfo();
        }
        return this._fontInfo;
    }
    createFontInfo() {
        const editorOptions = this.configurationService.getValue('editor');
        return FontMeasurements.readFontInfo(this.window, createBareFontInfoFromRawSettings(editorOptions, PixelRatio.getInstance(this.window).value));
    }
    async _createOriginalWebview(id, viewType, resource) {
        this._outputWebview?.dispose();
        this._outputWebview = this.instantiationService.createInstance(BackLayerWebView, this, id, viewType, resource, {
            ...this._notebookOptions.computeDiffWebviewOptions(),
            fontFamily: this._generateFontFamily()
        }, undefined);
        // attach the webview container to the DOM tree first
        DOM.append(this._rootElement, this._outputWebview.element);
        this._outputWebview.createWebview(this.window);
        this._outputWebview.element.style.width = `calc(100% - 16px)`;
        this._outputWebview.element.style.left = `16px`;
    }
    _generateFontFamily() {
        return this.fontInfo.fontFamily ?? `"SF Mono", Monaco, Menlo, Consolas, "Ubuntu Mono", "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace`;
    }
    getTitle() {
        if (this.input) {
            return this.input.getName();
        }
        return nls.localize('notebookOutputEditor', "Notebook Output Editor");
    }
    async setInput(input, options, context, token) {
        await super.setInput(input, options, context, token);
        const model = await input.resolve();
        if (!model) {
            throw new Error('Invalid notebook output editor input');
        }
        const resolvedNotebookEditorModel = model.resolvedNotebookEditorModel;
        await this._createOriginalWebview(generateUuid(), resolvedNotebookEditorModel.viewType, URI.from({ scheme: Schemas.vscodeNotebookCellOutput, path: '', query: 'openIn=notebookOutputEditor' }));
        const notebookTextModel = resolvedNotebookEditorModel.notebook;
        const eventDispatcher = this._register(new NotebookEventDispatcher());
        const editorOptions = this._register(new NoopCellEditorOptions());
        const viewContext = new ViewContext(this._notebookOptions, eventDispatcher, _language => editorOptions);
        this._notebookViewModel = this.instantiationService.createInstance(NotebookViewModel, notebookTextModel.viewType, notebookTextModel, viewContext, null, { isReadOnly: true });
        const cellViewModel = this._notebookViewModel.getCellByHandle(model.cell.handle);
        if (!cellViewModel) {
            throw new Error('Invalid NotebookOutputEditorInput, no matching cell view model');
        }
        const cellOutputViewModel = cellViewModel.outputsViewModels.find(outputViewModel => outputViewModel.model.outputId === model.outputId);
        if (!cellOutputViewModel) {
            throw new Error('Invalid NotebookOutputEditorInput, no matching cell output view model');
        }
        let result = undefined;
        const [mimeTypes, pick] = cellOutputViewModel.resolveMimeTypes(notebookTextModel, undefined);
        const pickedMimeTypeRenderer = cellOutputViewModel.pickedMimeType || mimeTypes[pick];
        if (mimeTypes.length !== 0) {
            const renderer = this.notebookService.getRendererInfo(pickedMimeTypeRenderer.rendererId);
            result = renderer
                ? { type: 1 /* RenderOutputType.Extension */, renderer, source: cellOutputViewModel, mimeType: pickedMimeTypeRenderer.mimeType }
                : this._renderMissingRenderer(cellOutputViewModel, pickedMimeTypeRenderer.mimeType);
        }
        if (!result) {
            throw new Error('No InsetRenderInfo for output');
        }
        const cellInfo = {
            cellId: cellViewModel.id,
            cellHandle: model.cell.handle,
            cellUri: model.cell.uri,
        };
        this._outputWebview?.createOutput(cellInfo, result, 0, 0);
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
    _renderMessage(viewModel, message) {
        const el = DOM.$('p', undefined, message);
        return { type: 0 /* RenderOutputType.Html */, source: viewModel, htmlContent: el.outerHTML };
    }
    _renderSearchForMimetype(viewModel, mimeType) {
        const query = `@tag:notebookRenderer ${mimeType}`;
        const p = DOM.$('p', undefined, `No renderer could be found for mimetype "${mimeType}", but one might be available on the Marketplace.`);
        const a = DOM.$('a', { href: `command:workbench.extensions.search?%22${query}%22`, class: 'monaco-button monaco-text-button', tabindex: 0, role: 'button', style: 'padding: 8px; text-decoration: none; color: rgb(255, 255, 255); background-color: rgb(14, 99, 156); max-width: 200px;' }, `Search Marketplace`);
        return {
            type: 0 /* RenderOutputType.Html */,
            source: viewModel,
            htmlContent: p.outerHTML + a.outerHTML,
        };
    }
    scheduleOutputHeightAck(cellInfo, outputId, height) {
        DOM.scheduleAtNextAnimationFrame(this.window, () => {
            this._outputWebview?.ackHeight([{ cellId: cellInfo.cellId, outputId, height }]);
        }, 10);
    }
    async focusNotebookCell(cell, focus) {
    }
    async focusNextNotebookCell(cell, focus) {
    }
    toggleNotebookCellSelection(cell) {
        throw new Error('Not implemented.');
    }
    getCellById(cellId) {
        throw new Error('Not implemented');
    }
    getCellByInfo(cellInfo) {
        return this._notebookViewModel?.getCellByHandle(cellInfo.cellHandle);
    }
    layout(dimension, position) {
    }
    setScrollTop(scrollTop) {
    }
    triggerScroll(event) {
    }
    getOutputRenderer() {
    }
    updateOutputHeight(cellInfo, output, height, isInit, source) {
    }
    updateMarkupCellHeight(cellId, height, isInit) {
    }
    setMarkupCellEditState(cellId, editState) {
    }
    didResizeOutput(cellId) {
    }
    didStartDragMarkupCell(cellId, event) {
    }
    didDragMarkupCell(cellId, event) {
    }
    didDropMarkupCell(cellId, event) {
    }
    didEndDragMarkupCell(cellId) {
    }
    updatePerformanceMetadata(cellId, executionId, duration, rendererId) {
    }
    didFocusOutputInputChange(inputFocused) {
    }
    dispose() {
        this._isDisposed = true;
        super.dispose();
    }
};
NotebookOutputEditor = NotebookOutputEditor_1 = __decorate([
    __param(1, IInstantiationService),
    __param(2, IThemeService),
    __param(3, ITelemetryService),
    __param(4, IStorageService),
    __param(5, IConfigurationService),
    __param(6, INotebookService)
], NotebookOutputEditor);
export { NotebookOutputEditor };
let NotebookOutputEditorContribution = class NotebookOutputEditorContribution {
    static { this.ID = 'workbench.contribution.notebookOutputEditorContribution'; }
    constructor(editorResolverService, instantiationService, uriIdentityService) {
        this.instantiationService = instantiationService;
        this.uriIdentityService = uriIdentityService;
        editorResolverService.registerEditor(`${Schemas.vscodeNotebookCellOutput}:/**`, {
            id: 'notebookOutputEditor',
            label: 'Notebook Output Editor',
            priority: RegisteredEditorPriority.default
        }, {
            canSupportResource: (resource) => {
                if (resource.scheme === Schemas.vscodeNotebookCellOutput) {
                    const params = new URLSearchParams(resource.query);
                    return params.get('openIn') === 'notebookOutputEditor';
                }
                return false;
            }
        }, {
            createEditorInput: async ({ resource, options }) => {
                const outputUriData = CellUri.parseCellOutputUri(resource);
                if (!outputUriData || !outputUriData.notebook || outputUriData.cellIndex === undefined || outputUriData.outputIndex === undefined || !outputUriData.outputId) {
                    throw new Error('Invalid output uri for notebook output editor');
                }
                const notebookUri = this.uriIdentityService.asCanonicalUri(outputUriData.notebook);
                const cellIndex = outputUriData.cellIndex;
                const outputId = outputUriData.outputId;
                const outputIndex = outputUriData.outputIndex;
                const editorInput = this.instantiationService.createInstance(NotebookOutputEditorInput, notebookUri, cellIndex, outputId, outputIndex);
                return {
                    editor: editorInput,
                    options: options
                };
            }
        });
    }
};
NotebookOutputEditorContribution = __decorate([
    __param(0, IEditorResolverService),
    __param(1, IInstantiationService),
    __param(2, IUriIdentityService)
], NotebookOutputEditorContribution);
export { NotebookOutputEditorContribution };
registerWorkbenchContribution2(NotebookOutputEditorContribution.ID, NotebookOutputEditorContribution, 2 /* WorkbenchPhase.BlockRestore */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tPdXRwdXRFZGl0b3IuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svYnJvd3Nlci9vdXRwdXRFZGl0b3Ivbm90ZWJvb2tPdXRwdXRFZGl0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxLQUFLLEdBQUcsTUFBTSx1QkFBdUIsQ0FBQztBQUU3QyxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0scUNBQXFDLENBQUM7QUFDckUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBRWxFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNwRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDckYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQzVFLE9BQU8sRUFBMEIsOEJBQThCLEVBQWtCLE1BQU0scUNBQXFDLENBQUM7QUFHN0gsT0FBTyxFQUFFLHNCQUFzQixFQUFFLHdCQUF3QixFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDL0gsT0FBTyxF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