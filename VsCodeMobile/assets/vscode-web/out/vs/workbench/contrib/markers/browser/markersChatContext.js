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
import { groupBy } from '../../../../base/common/arrays.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { extUri } from '../../../../base/common/resources.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { EditorResourceAccessor } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IChatContextPickService, picksWithPromiseFn } from '../../chat/browser/chatContextPickService.js';
import { IDiagnosticVariableEntryFilterData } from '../../chat/common/chatVariableEntries.js';
let MarkerChatContextPick = class MarkerChatContextPick {
    constructor(_markerService, _labelService, _editorService) {
        this._markerService = _markerService;
        this._labelService = _labelService;
        this._editorService = _editorService;
        this.type = 'pickerPick';
        this.label = localize('chatContext.diagnstic', 'Problems...');
        this.icon = Codicon.error;
        this.ordinal = -100;
    }
    isEnabled(widget) {
        return !!widget.attachmentCapabilities.supportsProblemAttachments;
    }
    asPicker() {
        return {
            placeholder: localize('chatContext.diagnstic.placeholder', 'Select a problem to attach'),
            picks: picksWithPromiseFn(async (query, token) => {
                return this.getPicksForQuery(query);
            })
        };
    }
    /**
     * @internal For testing purposes only
     */
    getPicksForQuery(query) {
        const markers = this._markerService.read({ severities: MarkerSeverity.Error | MarkerSeverity.Warning | MarkerSeverity.Info });
        const grouped = groupBy(markers, (a, b) => extUri.compare(a.resource, b.resource));
        // Get the active editor URI for prioritization
        const activeEditorUri = EditorResourceAccessor.getCanonicalUri(this._editorService.activeEditor);
        // Sort groups to prioritize active file
        const sortedGroups = grouped.sort((groupA, groupB) => {
            const resourceA = groupA[0].resource;
            const resourceB = groupB[0].resource;
            // If one group is from the active file, prioritize it
            if (activeEditorUri) {
                const isAActiveFile = extUri.isEqual(resourceA, activeEditorUri);
                const isBActiveFile = extUri.isEqual(resourceB, activeEditorUri);
                if (isAActiveFile && !isBActiveFile) {
                    return -1; // A comes first
                }
                if (!isAActiveFile && isBActiveFile) {
                    return 1; // B comes first
                }
            }
            // Otherwise, sort by resource URI as before
            return extUri.compare(resourceA, resourceB);
        });
        const severities = new Set();
        const items = [];
        let pickCount = 0;
        for (const group of sortedGroups) {
            const resource = group[0].resource;
            const isActiveFile = activeEditorUri && extUri.isEqual(resource, activeEditorUri);
            const fileLabel = this._labelService.getUriLabel(resource, { relative: true });
            const separatorLabel = isActiveFile ? `${fileLabel} (current file)` : fileLabel;
            items.push({ type: 'separator', label: separatorLabel });
            for (const marker of group) {
                pickCount++;
                severities.add(marker.severity);
                items.push({
                    label: marker.message,
                    description: localize('markers.panel.at.ln.col.number', "[Ln {0}, Col {1}]", '' + marker.startLineNumber, '' + marker.startColumn),
                    asAttachment() {
                        return IDiagnosticVariableEntryFilterData.toEntry(IDiagnosticVariableEntryFilterData.fromMarker(marker));
                    }
                });
            }
        }
        items.unshift({
            label: localize('markers.panel.allErrors', 'All Problems'),
            asAttachment() {
                return IDiagnosticVariableEntryFilterData.toEntry({
                    filterSeverity: MarkerSeverity.Info
                });
            },
        });
        return items;
    }
};
MarkerChatContextPick = __decorate([
    __param(0, IMarkerService),
    __param(1, ILabelService),
    __param(2, IEditorService)
], MarkerChatContextPick);
let MarkerChatContextContribution = class MarkerChatContextContribution extends Disposable {
    static { this.ID = 'workbench.contrib.chat.markerChatContextContribution'; }
    constructor(contextPickService, instantiationService) {
        super();
        this._store.add(contextPickService.registerChatContextItem(instantiationService.createInstance(MarkerChatContextPick)));
    }
};
MarkerChatContextContribution = __decorate([
    __param(0, IChatContextPickService),
    __param(1, IInstantiationService)
], MarkerChatContextContribution);
export { MarkerChatContextContribution };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFya2Vyc0NoYXRDb250ZXh0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL21hcmtlcnMvYnJvd3Nlci9tYXJrZXJzQ2hhdENvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRTVELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGNBQWMsRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUVoRyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUVuRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDbEYsT0FBTyxFQUFzRCx1QkFBdUIsRUFBc0Isa0JBQWtCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNuTCxPQUFPLEVBQUUsa0NBQWtDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUc5RixJQUFNLHFCQUFxQixHQUEzQixNQUFNLHFCQUFxQjtJQU8xQixZQUNpQixjQUErQyxFQUNoRCxhQUE2QyxFQUM1QyxjQUErQztRQUY5QixtQkFBYyxHQUFkLGNBQWMsQ0FBZ0I7UUFDL0Isa0JBQWEsR0FBYixhQUFhLENBQWU7UUFDM0IsbUJB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