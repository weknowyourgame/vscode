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
var MarkerSeverityColumnRenderer_1, MarkerCodeColumnRenderer_1, MarkerFileColumnRenderer_1;
import { localize } from '../../../../nls.js';
import * as DOM from '../../../../base/browser/dom.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchTable } from '../../../../platform/list/browser/listService.js';
import { HighlightedLabel } from '../../../../base/browser/ui/highlightedlabel/highlightedLabel.js';
import { compareMarkersByUri, Marker, MarkerTableItem } from './markersModel.js';
import { MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { SeverityIcon } from '../../../../base/browser/ui/severityIcon/severityIcon.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { FilterOptions } from './markersFilterOptions.js';
import { Link } from '../../../../platform/opener/browser/link.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { QuickFixAction, QuickFixActionViewItem } from './markersViewActions.js';
import { DomEmitter } from '../../../../base/browser/event.js';
import Messages from './messages.js';
import { isUndefinedOrNull } from '../../../../base/common/types.js';
import { Range } from '../../../../editor/common/core/range.js';
import { unsupportedSchemas } from '../../../../platform/markers/common/markerService.js';
import Severity from '../../../../base/common/severity.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
const $ = DOM.$;
let MarkerSeverityColumnRenderer = class MarkerSeverityColumnRenderer {
    static { MarkerSeverityColumnRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'severity'; }
    constructor(markersViewModel, instantiationService) {
        this.markersViewModel = markersViewModel;
        this.instantiationService = instantiationService;
        this.templateId = MarkerSeverityColumnRenderer_1.TEMPLATE_ID;
    }
    renderTemplate(container) {
        const severityColumn = DOM.append(container, $('.severity'));
        const icon = DOM.append(severityColumn, $(''));
        const actionBarColumn = DOM.append(container, $('.actions'));
        const actionBar = new ActionBar(actionBarColumn, {
            actionViewItemProvider: (action, options) => action.id === QuickFixAction.ID ? this.instantiationService.createInstance(QuickFixActionViewItem, action, options) : undefined
        });
        return { actionBar, icon };
    }
    renderElement(element, index, templateData) {
        const toggleQuickFix = (enabled) => {
            if (!isUndefinedOrNull(enabled)) {
                const container = DOM.findParentWithClass(templateData.icon, 'monaco-table-td');
                container.classList.toggle('quickFix', enabled);
            }
        };
        templateData.icon.title = MarkerSeverity.toString(element.marker.severity);
        templateData.icon.className = `marker-icon ${Severity.toString(MarkerSeverity.toSeverity(element.marker.severity))} codicon ${SeverityIcon.className(MarkerSeverity.toSeverity(element.marker.severity))}`;
        templateData.actionBar.clear();
        const viewModel = this.markersViewModel.getViewModel(element);
        if (viewModel) {
            const quickFixAction = viewModel.quickFixAction;
            templateData.actionBar.push([quickFixAction], { icon: true, label: false });
            toggleQuickFix(viewModel.quickFixAction.enabled);
            quickFixAction.onDidChange(({ enabled }) => toggleQuickFix(enabled));
            quickFixAction.onShowQuickFixes(() => {
                const quickFixActionViewItem = templateData.actionBar.viewItems[0];
                if (quickFixActionViewItem) {
                    quickFixActionViewItem.showQuickFixes();
                }
            });
        }
    }
    disposeTemplate(templateData) { }
};
MarkerSeverityColumnRenderer = MarkerSeverityColumnRenderer_1 = __decorate([
    __param(1, IInstantiationService)
], MarkerSeverityColumnRenderer);
let MarkerCodeColumnRenderer = class MarkerCodeColumnRenderer {
    static { MarkerCodeColumnRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'code'; }
    constructor(hoverService, openerService) {
        this.hoverService = hoverService;
        this.openerService = openerService;
        this.templateId = MarkerCodeColumnRenderer_1.TEMPLATE_ID;
    }
    renderTemplate(container) {
        const templateDisposable = new DisposableStore();
        const codeColumn = DOM.append(container, $('.code'));
        const sourceLabel = templateDisposable.add(new HighlightedLabel(codeColumn));
        sourceLabel.element.classList.add('source-label');
        const codeLabel = templateDisposable.add(new HighlightedLabel(codeColumn));
        codeLabel.element.classList.add('code-label');
        const codeLink = templateDisposable.add(new Link(codeColumn, { href: '', label: '' }, {}, this.hoverService, this.openerService));
        return { codeColumn, sourceLabel, codeLabel, codeLink, templateDisposable };
    }
    renderElement(element, index, templateData) {
        templateData.codeColumn.classList.remove('code-label');
        templateData.codeColumn.classList.remove('code-link');
        if (element.marker.source && element.marker.code) {
            if (typeof element.marker.code === 'string') {
                templateData.codeColumn.classList.add('code-label');
                templateData.codeColumn.title = `${element.marker.source} (${element.marker.code})`;
                templateData.sourceLabel.set(element.marker.source, element.sourceMatches);
                templateData.codeLabel.set(element.marker.code, element.codeMatches);
            }
            else {
                templateData.codeColumn.classList.add('code-link');
                templateData.codeColumn.title = `${element.marker.source} (${element.marker.code.value})`;
                templateData.sourceLabel.set(element.marker.source, element.sourceMatches);
                const codeLinkLabel = templateData.templateDisposable.add(new HighlightedLabel($('.code-link-label')));
                codeLinkLabel.set(element.marker.code.value, element.codeMatches);
                templateData.codeLink.link = {
                    href: element.marker.code.target.toString(true),
                    title: element.marker.code.target.toString(true),
                    label: codeLinkLabel.element,
                };
            }
        }
        else {
            templateData.codeColumn.title = '';
            templateData.sourceLabel.set('-');
        }
    }
    disposeTemplate(templateData) {
        templateData.templateDisposable.dispose();
    }
};
MarkerCodeColumnRenderer = MarkerCodeColumnRenderer_1 = __decorate([
    __param(0, IHoverService),
    __param(1, IOpenerService)
], MarkerCodeColumnRenderer);
class MarkerMessageColumnRenderer {
    constructor() {
        this.templateId = MarkerMessageColumnRenderer.TEMPLATE_ID;
    }
    static { this.TEMPLATE_ID = 'message'; }
    renderTemplate(container) {
        const columnElement = DOM.append(container, $('.message'));
        const highlightedLabel = new HighlightedLabel(columnElement);
        return { columnElement, highlightedLabel };
    }
    renderElement(element, index, templateData) {
        templateData.columnElement.title = element.marker.message;
        templateData.highlightedLabel.set(element.marker.message, element.messageMatches);
    }
    disposeTemplate(templateData) {
        templateData.highlightedLabel.dispose();
    }
}
let MarkerFileColumnRenderer = class MarkerFileColumnRenderer {
    static { MarkerFileColumnRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'file'; }
    constructor(labelService) {
        this.labelService = labelService;
        this.templateId = MarkerFileColumnRenderer_1.TEMPLATE_ID;
    }
    renderTemplate(container) {
        const columnElement = DOM.append(container, $('.file'));
        const fileLabel = new HighlightedLabel(columnElement);
        fileLabel.element.classList.add('file-label');
        const positionLabel = new HighlightedLabel(columnElement);
        positionLabel.element.classList.add('file-position');
        return { columnElement, fileLabel, positionLabel };
    }
    renderElement(element, index, templateData) {
        const positionLabel = Messages.MARKERS_PANEL_AT_LINE_COL_NUMBER(element.marker.startLineNumber, element.marker.startColumn);
        templateData.columnElement.title = `${this.labelService.getUriLabel(element.marker.resource, { relative: false })} ${positionLabel}`;
        templateData.fileLabel.set(this.labelService.getUriLabel(element.marker.resource, { relative: true }), element.fileMatches);
        templateData.positionLabel.set(positionLabel, undefined);
    }
    disposeTemplate(templateData) {
        templateData.fileLabel.dispose();
        templateData.positionLabel.dispose();
    }
};
MarkerFileColumnRenderer = MarkerFileColumnRenderer_1 = __decorate([
    __param(0, ILabelService)
], MarkerFileColumnRenderer);
class MarkerSourceColumnRenderer {
    constructor() {
        this.templateId = MarkerSourceColumnRenderer.TEMPLATE_ID;
    }
    static { this.TEMPLATE_ID = 'source'; }
    renderTemplate(container) {
        const columnElement = DOM.append(container, $('.source'));
        const highlightedLabel = new HighlightedLabel(columnElement);
        return { columnElement, highlightedLabel };
    }
    renderElement(element, index, templateData) {
        templateData.columnElement.title = element.marker.source ?? '';
        templateData.highlightedLabel.set(element.marker.source ?? '', element.sourceMatches);
    }
    disposeTemplate(templateData) {
        templateData.highlightedLabel.dispose();
    }
}
class MarkersTableVirtualDelegate {
    constructor() {
        this.headerRowHeight = MarkersTableVirtualDelegate.HEADER_ROW_HEIGHT;
    }
    static { this.HEADER_ROW_HEIGHT = 24; }
    static { this.ROW_HEIGHT = 24; }
    getHeight(item) {
        return MarkersTableVirtualDelegate.ROW_HEIGHT;
    }
}
let MarkersTable = class MarkersTable extends Disposable {
    constructor(container, markersViewModel, resourceMarkers, filterOptions, options, instantiationService, labelService) {
        super();
        this.container = container;
        this.markersViewModel = markersViewModel;
        this.resourceMarkers = resourceMarkers;
        this.filterOptions = filterOptions;
        this.instantiationService = instantiationService;
        this.labelService = labelService;
        this._itemCount = 0;
        this.table = this.instantiationService.createInstance(WorkbenchTable, 'Markers', this.container, new MarkersTableVirtualDelegate(), [
            {
                label: '',
                tooltip: '',
                weight: 0,
                minimumWidth: 36,
                maximumWidth: 36,
                templateId: MarkerSeverityColumnRenderer.TEMPLATE_ID,
                project(row) { return row; }
            },
            {
                label: localize('codeColumnLabel', "Code"),
                tooltip: '',
                weight: 1,
                minimumWidth: 100,
                maximumWidth: 300,
                templateId: MarkerCodeColumnRenderer.TEMPLATE_ID,
                project(row) { return row; }
            },
            {
                label: localize('messageColumnLabel', "Message"),
                tooltip: '',
                weight: 4,
                templateId: MarkerMessageColumnRenderer.TEMPLATE_ID,
                project(row) { return row; }
            },
            {
                label: localize('fileColumnLabel', "File"),
                tooltip: '',
                weight: 2,
                templateId: MarkerFileColumnRenderer.TEMPLATE_ID,
                project(row) { return row; }
            },
            {
                label: localize('sourceColumnLabel', "Source"),
                tooltip: '',
                weight: 1,
                minimumWidth: 100,
                maximumWidth: 300,
                templateId: MarkerSourceColumnRenderer.TEMPLATE_ID,
                project(row) { return row; }
            }
        ], [
            this.instantiationService.createInstance(MarkerSeverityColumnRenderer, this.markersViewModel),
            this.instantiationService.createInstance(MarkerCodeColumnRenderer),
            this.instantiationService.createInstance(MarkerMessageColumnRenderer),
            this.instantiationService.createInstance(MarkerFileColumnRenderer),
            this.instantiationService.createInstance(MarkerSourceColumnRenderer),
        ], options);
        // eslint-disable-next-line no-restricted-syntax
        const list = this.table.domNode.querySelector('.monaco-list-rows');
        // mouseover/mouseleave event handlers
        const onRowHover = Event.chain(this._register(new DomEmitter(list, 'mouseover')).event, $ => $.map(e => DOM.findParentWithClass(e.target, 'monaco-list-row', 'monaco-list-rows'))
            // eslint-disable-next-line local/code-no-any-casts
            .filter(((e) => !!e))
            .map(e => parseInt(e.getAttribute('data-index'))));
        const onListLeave = Event.map(this._register(new DomEmitter(list, 'mouseleave')).event, () => -1);
        const onRowHoverOrLeave = Event.latch(Event.any(onRowHover, onListLeave));
        const onRowPermanentHover = Event.debounce(onRowHoverOrLeave, (_, e) => e, 500);
        this._register(onRowPermanentHover(e => {
            if (e !== -1 && this.table.row(e)) {
                this.markersViewModel.onMarkerMouseHover(this.table.row(e));
            }
        }));
    }
    get contextKeyService() {
        return this.table.contextKeyService;
    }
    get onContextMenu() {
        return this.table.onContextMenu;
    }
    get onDidOpen() {
        return this.table.onDidOpen;
    }
    get onDidChangeFocus() {
        return this.table.onDidChangeFocus;
    }
    get onDidChangeSelection() {
        return this.table.onDidChangeSelection;
    }
    collapseMarkers() { }
    domFocus() {
        this.table.domFocus();
    }
    filterMarkers(resourceMarkers, filterOptions) {
        this.filterOptions = filterOptions;
        this.reset(resourceMarkers);
    }
    getFocus() {
        const focus = this.table.getFocus();
        return focus.length > 0 ? [...focus.map(f => this.table.row(f))] : [];
    }
    getHTMLElement() {
        return this.table.getHTMLElement();
    }
    getRelativeTop(marker) {
        return marker ? this.table.getRelativeTop(this.table.indexOf(marker)) : null;
    }
    getSelection() {
        const selection = this.table.getSelection();
        return selection.length > 0 ? [...selection.map(i => this.table.row(i))] : [];
    }
    getVisibleItemCount() {
        return this._itemCount;
    }
    isVisible() {
        return !this.container.classList.contains('hidden');
    }
    layout(height, width) {
        this.container.style.height = `${height}px`;
        this.table.layout(height, width);
    }
    reset(resourceMarkers) {
        this.resourceMarkers = resourceMarkers;
        const items = [];
        for (const resourceMarker of this.resourceMarkers) {
            for (const marker of resourceMarker.markers) {
                if (unsupportedSchemas.has(marker.resource.scheme)) {
                    continue;
                }
                // Exclude pattern
                if (this.filterOptions.excludesMatcher.matches(marker.resource)) {
                    continue;
                }
                // Include pattern
                if (this.filterOptions.includesMatcher.matches(marker.resource)) {
                    items.push(new MarkerTableItem(marker));
                    continue;
                }
                // Severity filter
                const matchesSeverity = this.filterOptions.showErrors && MarkerSeverity.Error === marker.marker.severity ||
                    this.filterOptions.showWarnings && MarkerSeverity.Warning === marker.marker.severity ||
                    this.filterOptions.showInfos && MarkerSeverity.Info === marker.marker.severity;
                if (!matchesSeverity) {
                    continue;
                }
                // Text filter
                if (this.filterOptions.textFilter.text) {
                    const sourceMatches = marker.marker.source ? FilterOptions._filter(this.filterOptions.textFilter.text, marker.marker.source) ?? undefined : undefined;
                    const codeMatches = marker.marker.code ? FilterOptions._filter(this.filterOptions.textFilter.text, typeof marker.marker.code === 'string' ? marker.marker.code : marker.marker.code.value) ?? undefined : undefined;
                    const messageMatches = FilterOptions._messageFilter(this.filterOptions.textFilter.text, marker.marker.message) ?? undefined;
                    const fileMatches = FilterOptions._messageFilter(this.filterOptions.textFilter.text, this.labelService.getUriLabel(marker.resource, { relative: true })) ?? undefined;
                    const matched = sourceMatches || codeMatches || messageMatches || fileMatches;
                    if ((matched && !this.filterOptions.textFilter.negate) || (!matched && this.filterOptions.textFilter.negate)) {
                        items.push(new MarkerTableItem(marker, sourceMatches, codeMatches, messageMatches, fileMatches));
                    }
                    continue;
                }
                items.push(new MarkerTableItem(marker));
            }
        }
        this._itemCount = items.length;
        this.table.splice(0, Number.POSITIVE_INFINITY, items.sort((a, b) => {
            let result = MarkerSeverity.compare(a.marker.severity, b.marker.severity);
            if (result === 0) {
                result = compareMarkersByUri(a.marker, b.marker);
            }
            if (result === 0) {
                result = Range.compareRangesUsingStarts(a.marker, b.marker);
            }
            return result;
        }));
    }
    revealMarkers(activeResource, focus, lastSelectedRelativeTop) {
        if (activeResource) {
            const activeResourceIndex = this.resourceMarkers.indexOf(activeResource);
            if (activeResourceIndex !== -1) {
                if (this.hasSelectedMarkerFor(activeResource)) {
                    const tableSelection = this.table.getSelection();
                    this.table.reveal(tableSelection[0], lastSelectedRelativeTop);
                    if (focus) {
                        this.table.setFocus(tableSelection);
                    }
                }
                else {
                    this.table.reveal(activeResourceIndex, 0);
                    if (focus) {
                        this.table.setFocus([activeResourceIndex]);
                        this.table.setSelection([activeResourceIndex]);
                    }
                }
            }
        }
        else if (focus) {
            this.table.setSelection([]);
            this.table.focusFirst();
        }
    }
    setAriaLabel(label) {
        this.table.domNode.ariaLabel = label;
    }
    setMarkerSelection(selection, focus) {
        if (this.isVisible()) {
            if (selection && selection.length > 0) {
                this.table.setSelection(selection.map(m => this.findMarkerIndex(m)));
                if (focus && focus.length > 0) {
                    this.table.setFocus(focus.map(f => this.findMarkerIndex(f)));
                }
                else {
                    this.table.setFocus([this.findMarkerIndex(selection[0])]);
                }
                this.table.reveal(this.findMarkerIndex(selection[0]));
            }
            else if (this.getSelection().length === 0 && this.getVisibleItemCount() > 0) {
                this.table.setSelection([0]);
                this.table.setFocus([0]);
                this.table.reveal(0);
            }
        }
    }
    toggleVisibility(hide) {
        this.container.classList.toggle('hidden', hide);
    }
    update(resourceMarkers) {
        for (const resourceMarker of resourceMarkers) {
            const index = this.resourceMarkers.indexOf(resourceMarker);
            this.resourceMarkers.splice(index, 1, resourceMarker);
        }
        this.reset(this.resourceMarkers);
    }
    updateMarker(marker) {
        this.table.rerender();
    }
    findMarkerIndex(marker) {
        for (let index = 0; index < this.table.length; index++) {
            if (this.table.row(index).marker === marker.marker) {
                return index;
            }
        }
        return -1;
    }
    hasSelectedMarkerFor(resource) {
        const selectedElement = this.getSelection();
        if (selectedElement && selectedElement.length > 0) {
            if (selectedElement[0] instanceof Marker) {
                if (resource.has(selectedElement[0].marker.resource)) {
                    return true;
                }
            }
        }
        return false;
    }
};
MarkersTable = __decorate([
    __param(5, IInstantiationService),
    __param(6, ILabelService)
], MarkersTable);
export { MarkersTable };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFya2Vyc1RhYmxlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL21hcmtlcnMvYnJvd3Nlci9tYXJrZXJzVGFibGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUV6RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBc0MsY0FBYyxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDdEgsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDcEcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQW1CLE1BQU0sbUJBQW1CLENBQUM7QUFDbEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUN4RixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDL0UsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUMxRCxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDbkUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBRzlFLE9BQU8sRUFBRSxjQUFjLEVB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