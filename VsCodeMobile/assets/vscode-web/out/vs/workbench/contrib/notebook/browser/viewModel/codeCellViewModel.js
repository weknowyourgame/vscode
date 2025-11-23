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
import { Emitter, PauseableEmitter } from '../../../../../base/common/event.js';
import { dispose } from '../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../base/common/observable.js';
import * as UUID from '../../../../../base/common/uuid.js';
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { PrefixSumComputer } from '../../../../../editor/common/model/prefixSumComputer.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IUndoRedoService } from '../../../../../platform/undoRedo/common/undoRedo.js';
import { CellEditState, CellLayoutState } from '../notebookBrowser.js';
import { CellOutputViewModel } from './cellOutputViewModel.js';
import { CellKind } from '../../common/notebookCommon.js';
import { INotebookService } from '../../common/notebookService.js';
import { BaseCellViewModel } from './baseCellViewModel.js';
import { IInlineChatSessionService } from '../../../inlineChat/browser/inlineChatSessionService.js';
export const outputDisplayLimit = 500;
let CodeCellViewModel = class CodeCellViewModel extends BaseCellViewModel {
    set editorHeight(height) {
        if (this._editorHeight === height) {
            return;
        }
        this._editorHeight = height;
        this.layoutChange({ editorHeight: true }, 'CodeCellViewModel#editorHeight');
    }
    get editorHeight() {
        throw new Error('editorHeight is write-only');
    }
    set chatHeight(height) {
        if (this._chatHeight === height) {
            return;
        }
        this._chatHeight = height;
        this.layoutChange({ chatHeight: true }, 'CodeCellViewModel#chatHeight');
    }
    get chatHeight() {
        return this._chatHeight;
    }
    get outputIsHovered() {
        return this._hoveringOutput;
    }
    set outputIsHovered(v) {
        this._hoveringOutput = v;
        this._onDidChangeState.fire({ outputIsHoveredChanged: true });
    }
    get outputIsFocused() {
        return this._focusOnOutput;
    }
    set outputIsFocused(v) {
        this._focusOnOutput = v;
        this._onDidChangeState.fire({ outputIsFocusedChanged: true });
    }
    get inputInOutputIsFocused() {
        return this._focusInputInOutput;
    }
    set inputInOutputIsFocused(v) {
        this._focusInputInOutput = v;
    }
    get outputMinHeight() {
        return this._outputMinHeight;
    }
    /**
     * The minimum height of the output region. It's only set to non-zero temporarily when replacing an output with a new one.
     * It's reset to 0 when the new output is rendered, or in one second.
     */
    set outputMinHeight(newMin) {
        this._outputMinHeight = newMin;
    }
    get layoutInfo() {
        return this._layoutInfo;
    }
    get outputsViewModels() {
        return this._outputViewModels;
    }
    constructor(viewType, model, initialNotebookLayoutInfo, viewContext, configurationService, _notebookService, modelService, undoRedoService, codeEditorService, inlineChatSessionService) {
        super(viewType, model, UUID.generateUuid(), viewContext, configurationService, modelService, undoRedoService, codeEditorService, inlineChatSessionService);
        this.viewContext = viewContext;
        this._notebookService = _notebookService;
        this.cellKind = CellKind.Code;
        this._onLayoutInfoRead = this._register(new Emitter());
        this.onLayoutInfoRead = this._onLayoutInfoRead.event;
        this._onDidStartExecution = this._register(new Emitter());
        this.onDidStartExecution = this._onDidStartExecution.event;
        this._onDidStopExecution = this._register(new Emitter());
        this.onDidStopExecution = this._onDidStopExecution.event;
        this._onDidChangeOutputs = this._register(new Emitter());
        this.onDidChangeOutputs = this._onDidChangeOutputs.event;
        this._onDidRemoveOutputs = this._register(new Emitter());
        this.onDidRemoveOutputs = this._onDidRemoveOutputs.event;
        this._outputCollection = [];
        this._outputsTop = null;
        this._pauseableEmitter = this._register(new PauseableEmitter());
        this.onDidChangeLayout = this._pauseableEmitter.event;
        this._editorHeight = 0;
        this._chatHeight = 0;
        this._hoveringOutput = false;
        this._focusOnOutput = false;
        this._focusInputInOutput = false;
        this._outputMinHeight = 0;
        this.executionErrorDiagnostic = observableValue('excecutionError', undefined);
        this._hasFindResult = this._register(new Emitter());
        this.hasFindResult = this._hasFindResult.event;
        this._outputViewModels = this.model.outputs.map(output => new CellOutputViewModel(this, output, this._notebookService));
        this._register(this.model.onDidChangeOutputs((splice) => {
            const removedOutputs = [];
            let outputLayoutChange = false;
            for (let i = splice.start; i < splice.start + splice.deleteCount; i++) {
                if (this._outputCollection[i] !== undefined && this._outputCollection[i] !== 0) {
                    outputLayoutChange = true;
                }
            }
            this._outputCollection.splice(splice.start, splice.deleteCount, ...splice.newOutputs.map(() => 0));
            removedOutputs.push(...this._outputViewModels.splice(splice.start, splice.deleteCount, ...splice.newOutputs.map(output => new CellOutputViewModel(this, output, this._notebookService))));
            this._outputsTop = null;
            this._onDidChangeOutputs.fire(splice);
            this._onDidRemoveOutputs.fire(removedOutputs);
            if (outputLayoutChange) {
                this.layoutChange({ outputHeight: true }, 'CodeCellViewModel#model.onDidChangeOutputs');
            }
            if (!this._outputCollection.length) {
                this.executionErrorDiagnostic.set(undefined, undefined);
            }
            dispose(removedOutputs);
        }));
        this._outputCollection = new Array(this.model.outputs.length);
        const layoutConfiguration = this.viewContext.notebookOptions.getLayoutConfiguration();
        this._layoutInfo = {
            fontInfo: initialNotebookLayoutInfo?.fontInfo || null,
            editorHeight: 0,
            editorWidth: initialNotebookLayoutInfo
                ? this.viewContext.notebookOptions.computeCodeCellEditorWidth(initialNotebookLayoutInfo.width)
                : 0,
            chatHeight: 0,
            statusBarHeight: 0,
            commentOffset: 0,
            commentHeight: 0,
            outputContainerOffset: 0,
            outputTotalHeight: 0,
            outputShowMoreContainerHeight: 0,
            outputShowMoreContainerOffset: 0,
            totalHeight: this.computeTotalHeight(17, 0, 0, 0),
            codeIndicatorHeight: 0,
            outputIndicatorHeight: 0,
            bottomToolbarOffset: 0,
            layoutState: CellLayoutState.Uninitialized,
            estimatedHasHorizontalScrolling: false,
            outlineWidth: 1,
            topMargin: layoutConfiguration.cellTopMargin,
            bottomMargin: layoutConfiguration.cellBottomMargin,
        };
    }
    updateExecutionState(e) {
        if (e.changed) {
            this.executionErrorDiagnostic.set(undefined, undefined);
            this._onDidStartExecution.fire(e);
        }
        else {
            this._onDidStopExecution.fire(e);
        }
    }
    updateOptions(e) {
        super.updateOptions(e);
        if (e.cellStatusBarVisibility || e.insertToolbarPosition || e.cellToolbarLocation) {
            this.layoutChange({});
        }
    }
    pauseLayout() {
        this._pauseableEmitter.pause();
    }
    resumeLayout() {
        this._pauseableEmitter.resume();
    }
    layoutChange(state, source) {
        // recompute
        this._ensureOutputsTop();
        const notebookLayoutConfiguration = this.viewContext.notebookOptions.getLayoutConfiguration();
        const bottomToolbarDimensions = this.viewContext.notebookOptions.computeBottomToolbarDimensions(this.viewType);
        const outputShowMoreContainerHeight = state.outputShowMoreContainerHeight ? state.outputShowMoreContainerHeight : this._layoutInfo.outputShowMoreContainerHeight;
        const outputTotalHeight = Math.max(this._outputMinHeight, this.isOutputCollapsed ? notebookLayoutConfiguration.collapsedIndicatorHeight : this._outputsTop.getTotalSum());
        const commentHeight = state.commentHeight ? this._commentHeight : this._layoutInfo.commentHeight;
        const originalLayout = this.layoutInfo;
        if (!this.isInputCollapsed) {
            let newState;
            let editorHeight;
            let totalHeight;
            let hasHorizontalScrolling = false;
            const chatHeight = state.chatHeight ? this._chatHeight : this._layoutInfo.chatHeight;
            if (!state.editorHeight && this._layoutInfo.layoutState === CellLayoutState.FromCache && !state.outputHeight) {
                // No new editorHeight info - keep cached totalHeight and estimate editorHeight
                const estimate = this.estimateEditorHeight(state.font?.lineHeight ?? this._layoutInfo.fontInfo?.lineHeight);
                editorHeight = estimate.editorHeight;
                hasHorizontalScrolling = estimate.hasHorizontalScrolling;
                totalHeight = this._layoutInfo.totalHeight;
                newState = CellLayoutState.FromCache;
            }
            else if (state.editorHeight || this._layoutInfo.layoutState === CellLayoutState.Measured) {
                // Editor has been measured
                editorHeight = this._editorHeight;
                totalHeight = this.computeTotalHeight(this._editorHeight, outputTotalHeight, outputShowMoreContainerHeight, chatHeight);
                newState = CellLayoutState.Measured;
                hasHorizontalScrolling = this._layoutInfo.estimatedHasHorizontalScrolling;
            }
            else {
                const estimate = this.estimateEditorHeight(state.font?.lineHeight ?? this._layoutInfo.fontInfo?.lineHeight);
                editorHeight = estimate.editorHeight;
                hasHorizontalScrolling = estimate.hasHorizontalScrolling;
                totalHeight = this.computeTotalHeight(editorHeight, outputTotalHeight, outputShowMoreContainerHeight, chatHeight);
                newState = CellLayoutState.Estimated;
            }
            const statusBarHeight = this.viewContext.notebookOptions.computeEditorStatusbarHeight(this.internalMetadata, this.uri);
            const codeIndicatorHeight = editorHeight + statusBarHeight;
            const outputIndicatorHeight = outputTotalHeight + outputShowMoreContainerHeight;
            const outputContainerOffset = notebookLayoutConfiguration.editorToolbarHeight
                + notebookLayoutConfiguration.cellTopMargin // CELL_TOP_MARGIN
                + chatHeight
                + editorHeight
                + statusBarHeight;
            const outputShowMoreContainerOffset = totalHeight
                - bottomToolbarDimensions.bottomToolbarGap
                - bottomToolbarDimensions.bottomToolbarHeight / 2
                - outputShowMoreContainerHeight;
            const bottomToolbarOffset = this.viewContext.notebookOptions.computeBottomToolbarOffset(totalHeight, this.viewType);
            const editorWidth = state.outerWidth !== undefined
                ? this.viewContext.notebookOptions.computeCodeCellEditorWidth(state.outerWidth)
                : this._layoutInfo?.editorWidth;
            this._layoutInfo = {
                fontInfo: state.font ?? this._layoutInfo.fontInfo ?? null,
                chatHeight,
                editorHeight,
                editorWidth,
                statusBarHeight,
                outputContainerOffset,
                outputTotalHeight,
                outputShowMoreContainerHeight,
                outputShowMoreContainerOffset,
                commentOffset: outputContainerOffset + outputTotalHeight,
                commentHeight,
                totalHeight,
                codeIndicatorHeight,
                outputIndicatorHeight,
                bottomToolbarOffset,
                layoutState: newState,
                estimatedHasHorizontalScrolling: hasHorizontalScrolling,
                topMargin: notebookLayoutConfiguration.cellTopMargin,
                bottomMargin: notebookLayoutConfiguration.cellBottomMargin,
                outlineWidth: 1
            };
        }
        else {
            const codeIndicatorHeight = notebookLayoutConfiguration.collapsedIndicatorHeight;
            const outputIndicatorHeight = outputTotalHeight + outputShowMoreContainerHeight;
            const chatHeight = state.chatHeight ? this._chatHeight : this._layoutInfo.chatHeight;
            const outputContainerOffset = notebookLayoutConfiguration.cellTopMargin + notebookLayoutConfiguration.collapsedIndicatorHeight;
            const totalHeight = notebookLayoutConfiguration.cellTopMargin
                + notebookLayoutConfiguration.collapsedIndicatorHeight
                + notebookLayoutConfiguration.cellBottomMargin //CELL_BOTTOM_MARGIN
                + bottomToolbarDimensions.bottomToolbarGap //BOTTOM_CELL_TOOLBAR_GAP
                + chatHeight
                + commentHeight
                + outputTotalHeight + outputShowMoreContainerHeight;
            const outputShowMoreContainerOffset = totalHeight
                - bottomToolbarDimensions.bottomToolbarGap
                - bottomToolbarDimensions.bottomToolbarHeight / 2
                - outputShowMoreContainerHeight;
            const bottomToolbarOffset = this.viewContext.notebookOptions.computeBottomToolbarOffset(totalHeight, this.viewType);
            const editorWidth = state.outerWidth !== undefined
                ? this.viewContext.notebookOptions.computeCodeCellEditorWidth(state.outerWidth)
                : this._layoutInfo?.editorWidth;
            this._layoutInfo = {
                fontInfo: state.font ?? this._layoutInfo.fontInfo ?? null,
                editorHeight: this._layoutInfo.editorHeight,
                editorWidth,
                chatHeight: chatHeight,
                statusBarHeight: 0,
                outputContainerOffset,
                outputTotalHeight,
                outputShowMoreContainerHeight,
                outputShowMoreContainerOffset,
                commentOffset: outputContainerOffset + outputTotalHeight,
                commentHeight,
                totalHeight,
                codeIndicatorHeight,
                outputIndicatorHeight,
                bottomToolbarOffset,
                layoutState: this._layoutInfo.layoutState,
                estimatedHasHorizontalScrolling: false,
                outlineWidth: 1,
                topMargin: notebookLayoutConfiguration.cellTopMargin,
                bottomMargin: notebookLayoutConfiguration.cellBottomMargin,
            };
        }
        this._fireOnDidChangeLayout({
            ...state,
            totalHeight: this.layoutInfo.totalHeight !== originalLayout.totalHeight,
            source,
        });
    }
    _fireOnDidChangeLayout(state) {
        this._pauseableEmitter.fire(state);
    }
    restoreEditorViewState(editorViewStates, totalHeight) {
        super.restoreEditorViewState(editorViewStates);
        if (totalHeight !== undefined && this._layoutInfo.layoutState !== CellLayoutState.Measured) {
            this._layoutInfo = {
                ...this._layoutInfo,
                totalHeight: totalHeight,
                layoutState: CellLayoutState.FromCache,
            };
        }
    }
    getDynamicHeight() {
        this._onLayoutInfoRead.fire();
        return this._layoutInfo.totalHeight;
    }
    getHeight(lineHeight) {
        if (this._layoutInfo.layoutState === CellLayoutState.Uninitialized) {
            const estimate = this.estimateEditorHeight(lineHeight);
            return this.computeTotalHeight(estimate.editorHeight, 0, 0, 0);
        }
        else {
            return this._layoutInfo.totalHeight;
        }
    }
    estimateEditorHeight(lineHeight = 20) {
        let hasHorizontalScrolling = false;
        const cellEditorOptions = this.viewContext.getBaseCellEditorOptions(this.language);
        if (this.layoutInfo.fontInfo && cellEditorOptions.value.wordWrap === 'off') {
            for (let i = 0; i < this.lineCount; i++) {
                const max = this.textBuffer.getLineLastNonWhitespaceColumn(i + 1);
                const estimatedWidth = max * (this.layoutInfo.fontInfo.typicalHalfwidthCharacterWidth + this.layoutInfo.fontInfo.letterSpacing);
                if (estimatedWidth > this.layoutInfo.editorWidth) {
                    hasHorizontalScrolling = true;
                    break;
                }
            }
        }
        const verticalScrollbarHeight = hasHorizontalScrolling ? 12 : 0; // take zoom level into account
        const editorPadding = this.viewContext.notebookOptions.computeEditorPadding(this.internalMetadata, this.uri);
        const editorHeight = this.lineCount * lineHeight
            + editorPadding.top
            + editorPadding.bottom // EDITOR_BOTTOM_PADDING
            + verticalScrollbarHeight;
        return {
            editorHeight,
            hasHorizontalScrolling
        };
    }
    computeTotalHeight(editorHeight, outputsTotalHeight, outputShowMoreContainerHeight, chatHeight) {
        const layoutConfiguration = this.viewContext.notebookOptions.getLayoutConfiguration();
        const { bottomToolbarGap } = this.viewContext.notebookOptions.computeBottomToolbarDimensions(this.viewType);
        return layoutConfiguration.editorToolbarHeight
            + layoutConfiguration.cellTopMargin
            + chatHeight
            + editorHeight
            + this.viewContext.notebookOptions.computeEditorStatusbarHeight(this.internalMetadata, this.uri)
            + this._commentHeight
            + outputsTotalHeight
            + outputShowMoreContainerHeight
            + bottomToolbarGap
            + layoutConfiguration.cellBottomMargin;
    }
    onDidChangeTextModelContent() {
        if (this.getEditState() !== CellEditState.Editing) {
            this.updateEditState(CellEditState.Editing, 'onDidChangeTextModelContent');
            this._onDidChangeState.fire({ contentChanged: true });
        }
    }
    onDeselect() {
        this.updateEditState(CellEditState.Preview, 'onDeselect');
    }
    updateOutputShowMoreContainerHeight(height) {
        this.layoutChange({ outputShowMoreContainerHeight: height }, 'CodeCellViewModel#updateOutputShowMoreContainerHeight');
    }
    updateOutputMinHeight(height) {
        this.outputMinHeight = height;
    }
    unlockOutputHeight() {
        this.outputMinHeight = 0;
        this.layoutChange({ outputHeight: true });
    }
    updateOutputHeight(index, height, source) {
        if (index >= this._outputCollection.length) {
            throw new Error('Output index out of range!');
        }
        this._ensureOutputsTop();
        try {
            if (index === 0 || height > 0) {
                this._outputViewModels[index].setVisible(true);
            }
            else if (height === 0) {
                this._outputViewModels[index].setVisible(false);
            }
        }
        catch (e) {
            const errorMessage = `Failed to update output height for cell ${this.handle}, output ${index}. `
                + `this.outputCollection.length: ${this._outputCollection.length}, this._outputViewModels.length: ${this._outputViewModels.length}`;
            throw new Error(`${errorMessage}.\n Error: ${e.message}`);
        }
        if (this._outputViewModels[index].visible.get() && height < 28) {
            height = 28;
        }
        this._outputCollection[index] = height;
        if (this._outputsTop.setValue(index, height)) {
            this.layoutChange({ outputHeight: true }, source);
        }
    }
    getOutputOffsetInContainer(index) {
        this._ensureOutputsTop();
        if (index >= this._outputCollection.length) {
            throw new Error('Output index out of range!');
        }
        return this._outputsTop.getPrefixSum(index - 1);
    }
    getOutputOffset(index) {
        return this.layoutInfo.outputContainerOffset + this.getOutputOffsetInContainer(index);
    }
    spliceOutputHeights(start, deleteCnt, heights) {
        this._ensureOutputsTop();
        this._outputsTop.removeValues(start, deleteCnt);
        if (heights.length) {
            const values = new Uint32Array(heights.length);
            for (let i = 0; i < heights.length; i++) {
                values[i] = heights[i];
            }
            this._outputsTop.insertValues(start, values);
        }
        this.layoutChange({ outputHeight: true }, 'CodeCellViewModel#spliceOutputs');
    }
    _ensureOutputsTop() {
        if (!this._outputsTop) {
            const values = new Uint32Array(this._outputCollection.length);
            for (let i = 0; i < this._outputCollection.length; i++) {
                values[i] = this._outputCollection[i];
            }
            this._outputsTop = new PrefixSumComputer(values);
        }
    }
    startFind(value, options) {
        const matches = super.cellStartFind(value, options);
        if (matches === null) {
            return null;
        }
        return {
            cell: this,
            contentMatches: matches
        };
    }
    dispose() {
        super.dispose();
        this._outputCollection = [];
        this._outputsTop = null;
        dispose(this._outputViewModels);
    }
};
CodeCellViewModel = __decorate([
    __param(4, IConfigurationService),
    __param(5, INotebookService),
    __param(6, ITextModelService),
    __param(7, IUndoRedoService),
    __param(8, ICodeEditorService),
    __param(9, IInlineChatSessionService)
], CodeCellViewModel);
export { CodeCellViewModel };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZUNlbGxWaWV3TW9kZWwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svYnJvd3Nlci92aWV3TW9kZWwvY29kZUNlbGxWaWV3TW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBUyxnQkFBZ0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDM0UsT0FBTyxLQUFLLElBQUksTUFBTSxvQ0FBb0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUVqRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM1RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUM3RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN2RixPQUFPLEVBQUUsYUFBYSxFQUFpQixlQUFlLEVBQXVGLE1BQU0sdUJBQXVCLENBQUM7QUFHM0ssT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFHL0QsT0FBTyxFQUFFLFFBQVEsRUFBbUQsTUFBTSxnQ0FBZ0MsQ0FBQztBQUUzRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUMzRCxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSx5REFBeUQsQ0FB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