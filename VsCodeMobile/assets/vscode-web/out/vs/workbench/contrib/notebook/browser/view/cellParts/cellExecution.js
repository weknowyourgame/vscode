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
import { disposableTimeout } from '../../../../../../base/common/async.js';
import { DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { clamp } from '../../../../../../base/common/numbers.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { CellContentPart } from '../cellPart.js';
import { CodeCellViewModel } from '../../viewModel/codeCellViewModel.js';
import { INotebookExecutionStateService } from '../../../common/notebookExecutionStateService.js';
import { executingStateIcon } from '../../notebookIcons.js';
import { renderLabelWithIcons } from '../../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { hasKey } from '../../../../../../base/common/types.js';
const UPDATE_EXECUTION_ORDER_GRACE_PERIOD = 200;
let CellExecutionPart = class CellExecutionPart extends CellContentPart {
    constructor(_notebookEditor, _executionOrderLabel, _notebookExecutionStateService) {
        super();
        this._notebookEditor = _notebookEditor;
        this._executionOrderLabel = _executionOrderLabel;
        this._notebookExecutionStateService = _notebookExecutionStateService;
        this.kernelDisposables = this._register(new DisposableStore());
        // Add class to the outer container for styling
        this._executionOrderLabel.classList.add('cell-execution-order');
        // Create nested div for content
        this._executionOrderContent = DOM.append(this._executionOrderLabel, DOM.$('div'));
        // Add a method to watch for cell execution state changes
        this._register(this._notebookExecutionStateService.onDidChangeExecution(e => {
            if (this.currentCell && hasKey(e, { affectsCell: true }) && e.affectsCell(this.currentCell.uri)) {
                this._updatePosition();
            }
        }));
        this._register(this._notebookEditor.onDidChangeActiveKernel(() => {
            if (this.currentCell) {
                this.kernelDisposables.clear();
                if (this._notebookEditor.activeKernel) {
                    this.kernelDisposables.add(this._notebookEditor.activeKernel.onDidChange(() => {
                        if (this.currentCell) {
                            this.updateExecutionOrder(this.currentCell.internalMetadata);
                        }
                    }));
                }
                this.updateExecutionOrder(this.currentCell.internalMetadata);
            }
        }));
        this._register(this._notebookEditor.onDidScroll(() => {
            this._updatePosition();
        }));
    }
    didRenderCell(element) {
        this.updateExecutionOrder(element.internalMetadata, true);
    }
    updateState(element, e) {
        if (e.internalMetadataChanged) {
            this.updateExecutionOrder(element.internalMetadata);
        }
    }
    updateExecutionOrder(internalMetadata, forceClear = false) {
        if (this._notebookEditor.activeKernel?.implementsExecutionOrder || (!this._notebookEditor.activeKernel && typeof internalMetadata.executionOrder === 'number')) {
            // If the executionOrder was just cleared, and the cell is executing, wait just a bit before clearing the view to avoid flashing
            if (typeof internalMetadata.executionOrder !== 'number' && !forceClear && !!this._notebookExecutionStateService.getCellExecution(this.currentCell.uri)) {
                const renderingCell = this.currentCell;
                disposableTimeout(() => {
                    if (this.currentCell === renderingCell) {
                        this.updateExecutionOrder(this.currentCell.internalMetadata, true);
                        this._updatePosition();
                    }
                }, UPDATE_EXECUTION_ORDER_GRACE_PERIOD, this.cellDisposables);
                return;
            }
            const executionOrderLabel = typeof internalMetadata.executionOrder === 'number' ?
                `[${internalMetadata.executionOrder}]` :
                '[ ]';
            this._executionOrderContent.innerText = executionOrderLabel;
            // Call _updatePosition to refresh sticky status
            this._updatePosition();
        }
        else {
            this._executionOrderContent.innerText = '';
        }
    }
    updateInternalLayoutNow(element) {
        this._updatePosition();
    }
    _updatePosition() {
        if (!this.currentCell) {
            return;
        }
        if (this.currentCell.isInputCollapsed) {
            DOM.hide(this._executionOrderLabel);
            return;
        }
        // Only show the execution order label when the cell is running
        const cellIsRunning = !!this._notebookExecutionStateService.getCellExecution(this.currentCell.uri);
        // Store sticky state before potentially removing the class
        const wasSticky = this._executionOrderLabel.classList.contains('sticky');
        if (!cellIsRunning) {
            // Keep showing the execution order label but remove sticky class
            this._executionOrderLabel.classList.remove('sticky');
            // If we were sticky and cell stopped running, restore the proper content
            if (wasSticky) {
                const executionOrder = this.currentCell.internalMetadata.executionOrder;
                const executionOrderLabel = typeof executionOrder === 'number' ?
                    `[${executionOrder}]` :
                    '[ ]';
                this._executionOrderContent.innerText = executionOrderLabel;
            }
        }
        DOM.show(this._executionOrderLabel);
        let top = this.currentCell.layoutInfo.editorHeight - 22 + this.currentCell.layoutInfo.statusBarHeight;
        if (this.currentCell instanceof CodeCellViewModel) {
            const elementTop = this._notebookEditor.getAbsoluteTopOfElement(this.currentCell);
            const editorBottom = elementTop + this.currentCell.layoutInfo.outputContainerOffset;
            const scrollBottom = this._notebookEditor.scrollBottom;
            const lineHeight = 22;
            const statusBarVisible = this.currentCell.layoutInfo.statusBarHeight > 0;
            // Sticky mode: cell is running and editor is not fully visible
            const offset = editorBottom - scrollBottom;
            top -= offset;
            top = clamp(top, lineHeight + 12, // line height + padding for single line
            this.currentCell.layoutInfo.editorHeight - lineHeight + this.currentCell.layoutInfo.statusBarHeight);
            if (scrollBottom <= editorBottom && cellIsRunning) {
                const isAlreadyIcon = this._executionOrderContent.classList.contains('sticky-spinner');
                // Add a class when it's in sticky mode for special styling
                if (!isAlreadyIcon) {
                    this._executionOrderLabel.classList.add('sticky-spinner');
                    // Only recreate the content if we're newly becoming sticky
                    DOM.clearNode(this._executionOrderContent);
                    const icon = ThemeIcon.modify(executingStateIcon, 'spin');
                    DOM.append(this._executionOrderContent, ...renderLabelWithIcons(`$(${icon.id})`));
                }
                // When already sticky, we don't need to recreate the content
            }
            else if (!statusBarVisible && cellIsRunning) {
                // Status bar is hidden but cell is running: show execution order label at the bottom of the editor area
                const wasStickyHere = this._executionOrderLabel.classList.contains('sticky');
                this._executionOrderLabel.classList.remove('sticky');
                top = this.currentCell.layoutInfo.editorHeight - lineHeight; // Place at the bottom of the editor
                // Only update content if we were previously sticky or content is not correct
                // eslint-disable-next-line no-restricted-syntax
                const iconIsPresent = this._executionOrderContent.querySelector('.codicon') !== null;
                if (wasStickyHere || iconIsPresent) {
                    const executionOrder = this.currentCell.internalMetadata.executionOrder;
                    const executionOrderLabel = typeof executionOrder === 'number' ?
                        `[${executionOrder}]` :
                        '[ ]';
                    this._executionOrderContent.innerText = executionOrderLabel;
                }
            }
            else {
                // Only update if the current state is sticky
                const currentlySticky = this._executionOrderLabel.classList.contains('sticky');
                this._executionOrderLabel.classList.remove('sticky');
                // When transitioning from sticky to non-sticky, restore the proper content
                if (currentlySticky) {
                    const executionOrder = this.currentCell.internalMetadata.executionOrder;
                    const executionOrderLabel = typeof executionOrder === 'number' ?
                        `[${executionOrder}]` :
                        '[ ]';
                    this._executionOrderContent.innerText = executionOrderLabel;
                }
            }
        }
        this._executionOrderLabel.style.top = `${top}px`;
    }
};
CellExecutionPart = __decorate([
    __param(2, INotebookExecutionStateService)
], CellExecutionPart);
export { CellExecutionPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2VsbEV4ZWN1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3ZpZXcvY2VsbFBhcnRzL2NlbGxFeGVjdXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSx1Q0FBdUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUMzRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDN0UsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUV2RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDakQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFekUsT0FBTyxFQUFFLDhCQUE4QixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDbEcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDNUQsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFFakcsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRWhFLE1BQU0sbUNBQW1DLEdBQUcsR0FBRyxDQUFDO0FBRXpDLElBQU0saUJBQWlCLEdBQXZCLE1BQU0saUJBQWtCLFNBQVEsZUFBZTtJQUlyRCxZQUNrQixlQUF3QyxFQUN4QyxvQkFBaUMsRUFDbEIsOEJBQStFO1FBRS9HLEtBQUssRUFBRSxDQUFDO1FBSlMsb0JBQWUsR0FBZixlQUFlLENBQXlCO1FBQ3hDLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBYTtRQUNE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