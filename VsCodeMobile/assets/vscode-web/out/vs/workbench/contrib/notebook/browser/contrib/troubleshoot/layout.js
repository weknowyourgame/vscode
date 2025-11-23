/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable, DisposableStore, dispose, toDisposable } from '../../../../../../base/common/lifecycle.js';
import { localize2 } from '../../../../../../nls.js';
import { Categories } from '../../../../../../platform/action/common/actionCommonCategories.js';
import { Action2, registerAction2 } from '../../../../../../platform/actions/common/actions.js';
import { getNotebookEditorFromEditorPane } from '../../notebookBrowser.js';
import { registerNotebookContribution } from '../../notebookEditorExtensions.js';
import { INotebookService } from '../../../common/notebookService.js';
import { IEditorService } from '../../../../../services/editor/common/editorService.js';
import { n } from '../../../../../../base/browser/dom.js';
export class TroubleshootController extends Disposable {
    static { this.id = 'workbench.notebook.troubleshoot'; }
    constructor(_notebookEditor) {
        super();
        this._notebookEditor = _notebookEditor;
        this._localStore = this._register(new DisposableStore());
        this._cellDisposables = [];
        this._enabled = false;
        this._cellStatusItems = [];
        this._register(this._notebookEditor.onDidChangeModel(() => {
            this._update();
        }));
        this._update();
    }
    toggle() {
        this._enabled = !this._enabled;
        this._update();
    }
    _update() {
        this._localStore.clear();
        this._cellDisposables.forEach(d => d.dispose());
        this._cellDisposables = [];
        this._removeNotebookOverlay();
        if (!this._notebookEditor.hasModel()) {
            return;
        }
        if (this._enabled) {
            this._updateListener();
            this._createNotebookOverlay();
            this._createCellOverlays();
        }
    }
    _log(cell, e) {
        if (this._enabled) {
            const oldHeight = this._notebookEditor.getViewHeight(cell);
            console.log(`cell#${cell.handle}`, e, `${oldHeight} -> ${cell.layoutInfo.totalHeight}`);
        }
    }
    _createCellOverlays() {
        if (!this._notebookEditor.hasModel()) {
            return;
        }
        for (let i = 0; i < this._notebookEditor.getLength(); i++) {
            const cell = this._notebookEditor.cellAt(i);
            this._createCellOverlay(cell, i);
        }
        // Add listener for new cells
        this._localStore.add(this._notebookEditor.onDidChangeViewCells(e => {
            const addedCells = e.splices.reduce((acc, [, , newCells]) => [...acc, ...newCells], []);
            for (let i = 0; i < addedCells.length; i++) {
                const cellIndex = this._notebookEditor.getCellIndex(addedCells[i]);
                if (cellIndex !== undefined) {
                    this._createCellOverlay(addedCells[i], cellIndex);
                }
            }
        }));
    }
    _createNotebookOverlay() {
        if (!this._notebookEditor.hasModel()) {
            return;
        }
        const listViewTop = this._notebookEditor.getLayoutInfo().listViewOffsetTop;
        const scrollTop = this._notebookEditor.scrollTop;
        const overlay = n.div({
            style: {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: '1000'
            }
        }, [
            // Top line
            n.div({
                style: {
                    position: 'absolute',
                    top: `${listViewTop}px`,
                    left: '0',
                    width: '100%',
                    height: '2px',
                    backgroundColor: 'rgba(0, 0, 255, 0.7)'
                }
            }),
            // Text label for the notebook overlay
            n.div({
                style: {
                    position: 'absolute',
                    top: `${listViewTop}px`,
                    left: '10px',
                    backgroundColor: 'rgba(0, 0, 255, 0.7)',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: '1001'
                }
            }, [`ScrollTop: ${scrollTop}px`])
        ]).keepUpdated(this._store);
        this._notebookOverlayDomNode = overlay.element;
        if (this._notebookOverlayDomNode) {
            this._notebookEditor.getDomNode().appendChild(this._notebookOverlayDomNode);
        }
        this._localStore.add(this._notebookEditor.onDidScroll(() => {
            const scrollTop = this._notebookEditor.scrollTop;
            const listViewTop = this._notebookEditor.getLayoutInfo().listViewOffsetTop;
            if (this._notebookOverlayDomNode) {
                // Update label
                // eslint-disable-next-line no-restricted-syntax
                const labelElement = this._notebookOverlayDomNode.querySelector('div:nth-child(2)');
                if (labelElement) {
                    labelElement.textContent = `ScrollTop: ${scrollTop}px`;
                    labelElement.style.top = `${listViewTop}px`;
                }
                // Update top line
                // eslint-disable-next-line no-restricted-syntax
                const topLineElement = this._notebookOverlayDomNode.querySelector('div:first-child');
                if (topLineElement) {
                    topLineElement.style.top = `${listViewTop}px`;
                }
            }
        }));
    }
    _createCellOverlay(cell, index) {
        const overlayContainer = document.createElement('div');
        overlayContainer.style.position = 'absolute';
        overlayContainer.style.top = '0';
        overlayContainer.style.left = '0';
        overlayContainer.style.width = '100%';
        overlayContainer.style.height = '100%';
        overlayContainer.style.pointerEvents = 'none';
        overlayContainer.style.zIndex = '1000';
        const topLine = document.createElement('div');
        topLine.style.position = 'absolute';
        topLine.style.top = '0';
        topLine.style.left = '0';
        topLine.style.width = '100%';
        topLine.style.height = '2px';
        topLine.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        overlayContainer.appendChild(topLine);
        const getLayoutInfo = () => {
            const eol = cell.textBuffer.getEOL() === '\n' ? 'LF' : 'CRLF';
            let scrollTop = '';
            if (cell.layoutInfo.layoutState > 0) {
                scrollTop = `| AbsoluteTopOfElement: ${this._notebookEditor.getAbsoluteTopOfElement(cell)}px`;
            }
            return `cell #${index} (handle: ${cell.handle}) ${scrollTop} | EOL: ${eol}`;
        };
        const label = document.createElement('div');
        label.textContent = getLayoutInfo();
        label.style.position = 'absolute';
        label.style.top = '0px';
        label.style.right = '10px';
        label.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
        label.style.color = 'white';
        label.style.fontSize = '11px';
        label.style.fontWeight = 'bold';
        label.style.padding = '2px 6px';
        label.style.borderRadius = '3px';
        label.style.whiteSpace = 'nowrap';
        label.style.pointerEvents = 'none';
        label.style.zIndex = '1001';
        overlayContainer.appendChild(label);
        let overlayId = undefined;
        this._notebookEditor.changeCellOverlays((accessor) => {
            overlayId = accessor.addOverlay({
                cell,
                domNode: overlayContainer
            });
        });
        if (overlayId) {
            // Update overlay when layout changes
            const updateLayout = () => {
                // Update label text
                label.textContent = getLayoutInfo();
                // Refresh the overlay position
                if (overlayId) {
                    this._notebookEditor.changeCellOverlays((accessor) => {
                        accessor.layoutOverlay(overlayId);
                    });
                }
            };
            const disposables = this._cellDisposables[index];
            disposables.add(cell.onDidChangeLayout((e) => {
                updateLayout();
            }));
            disposables.add(cell.textBuffer.onDidChangeContent(() => {
                updateLayout();
            }));
            if (cell.textModel) {
                disposables.add(cell.textModel.onDidChangeContent(() => {
                    updateLayout();
                }));
            }
            disposables.add(this._notebookEditor.onDidChangeLayout(() => {
                updateLayout();
            }));
            disposables.add(toDisposable(() => {
                this._notebookEditor.changeCellOverlays((accessor) => {
                    if (overlayId) {
                        accessor.removeOverlay(overlayId);
                    }
                });
            }));
        }
    }
    _removeNotebookOverlay() {
        if (this._notebookOverlayDomNode) {
            this._notebookOverlayDomNode.remove();
            this._notebookOverlayDomNode = undefined;
        }
    }
    _updateListener() {
        if (!this._notebookEditor.hasModel()) {
            return;
        }
        for (let i = 0; i < this._notebookEditor.getLength(); i++) {
            const cell = this._notebookEditor.cellAt(i);
            const disposableStore = new DisposableStore();
            this._cellDisposables.push(disposableStore);
            disposableStore.add(cell.onDidChangeLayout(e => {
                this._log(cell, e);
            }));
        }
        this._localStore.add(this._notebookEditor.onDidChangeViewCells(e => {
            [...e.splices].reverse().forEach(splice => {
                const [start, deleted, newCells] = splice;
                const deletedCells = this._cellDisposables.splice(start, deleted, ...newCells.map(cell => {
                    const disposableStore = new DisposableStore();
                    disposableStore.add(cell.onDidChangeLayout(e => {
                        this._log(cell, e);
                    }));
                    return disposableStore;
                }));
                dispose(deletedCells);
            });
            // Add the overlays
            const addedCells = e.splices.reduce((acc, [, , newCells]) => [...acc, ...newCells], []);
            for (let i = 0; i < addedCells.length; i++) {
                const cellIndex = this._notebookEditor.getCellIndex(addedCells[i]);
                if (cellIndex !== undefined) {
                    this._createCellOverlay(addedCells[i], cellIndex);
                }
            }
        }));
        const vm = this._notebookEditor.getViewModel();
        let items = [];
        if (this._enabled) {
            items = this._getItemsForCells();
        }
        this._cellStatusItems = vm.deltaCellStatusBarItems(this._cellStatusItems, items);
    }
    _getItemsForCells() {
        const items = [];
        for (let i = 0; i < this._notebookEditor.getLength(); i++) {
            items.push({
                handle: i,
                items: [
                    {
                        text: `index: ${i}`,
                        alignment: 1 /* CellStatusbarAlignment.Left */,
                        priority: Number.MAX_SAFE_INTEGER
                    }
                ]
            });
        }
        return items;
    }
    dispose() {
        dispose(this._cellDisposables);
        this._removeNotebookOverlay();
        this._localStore.clear();
        super.dispose();
    }
}
registerNotebookContribution(TroubleshootController.id, TroubleshootController);
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'notebook.toggleLayoutTroubleshoot',
            title: localize2('workbench.notebook.toggleLayoutTroubleshoot', "Toggle Notebook Layout Troubleshoot"),
            category: Categories.Developer,
            f1: true
        });
    }
    async run(accessor) {
        const editorService = accessor.get(IEditorService);
        const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
        if (!editor) {
            return;
        }
        const controller = editor.getContribution(TroubleshootController.id);
        controller?.toggle();
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'notebook.inspectLayout',
            title: localize2('workbench.notebook.inspectLayout', "Inspect Notebook Layout"),
            category: Categories.Developer,
            f1: true
        });
    }
    async run(accessor) {
        const editorService = accessor.get(IEditorService);
        const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
        if (!editor || !editor.hasModel()) {
            return;
        }
        for (let i = 0; i < editor.getLength(); i++) {
            const cell = editor.cellAt(i);
            console.log(`cell#${cell.handle}`, cell.layoutInfo);
        }
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'notebook.clearNotebookEdtitorTypeCache',
            title: localize2('workbench.notebook.clearNotebookEdtitorTypeCache', "Clear Notebook Editor Type Cache"),
            category: Categories.Developer,
            f1: true
        });
    }
    async run(accessor) {
        const notebookService = accessor.get(INotebookService);
        notebookService.clearEditorCache();
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5b3V0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL25vdGVib29rL2Jyb3dzZXIvY29udHJpYi90cm91Ymxlc2hvb3QvbGF5b3V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNoSCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDckQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG9FQUFvRSxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFaEcsT0FBTyxFQUFFLCtCQUErQixFQUFrRyxNQUFNLDBCQUEwQixDQUFDO0FBQzNLLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBR2pGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUN4RixPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFMUQsTUFBTSxPQUFPLHNCQUF1QixTQUFRLFVBQVU7YUFDOUMsT0FBRSxHQUFXLGlDQUFpQyxBQUE1QyxDQUE2QztJQVF0RCxZQUE2QixlQUFnQztRQUM1RCxLQUFLLEVBQUUsQ0FBQztRQURvQixvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUFONUMsZ0JBQVcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksZUFBZSxFQUFFLENBQUMsQ0FBQztRQUM3RCxxQkFBZ0IsR0FBc0IsRUFBRSxDQUFDO1FBQ3pDLGFBQVEsR0FBWSxLQUFLLENBQUM7UUFDMUIscUJBQWdCLEdB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