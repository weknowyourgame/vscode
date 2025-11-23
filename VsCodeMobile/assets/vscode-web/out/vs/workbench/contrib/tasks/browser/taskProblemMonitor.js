/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { MarkerSeverity } from '../../../../platform/markers/common/markers.js';
export class TaskProblemMonitor extends Disposable {
    constructor() {
        super();
        this.terminalMarkerMap = new Map();
        this.terminalDisposables = new Map();
    }
    addTerminal(terminal, problemMatcher) {
        this.terminalMarkerMap.set(terminal.instanceId, {
            resources: new Map(),
            markers: new Map()
        });
        const store = new DisposableStore();
        this.terminalDisposables.set(terminal.instanceId, store);
        store.add(terminal.onDisposed(() => {
            this.terminalMarkerMap.delete(terminal.instanceId);
            this.terminalDisposables.get(terminal.instanceId)?.dispose();
            this.terminalDisposables.delete(terminal.instanceId);
        }));
        store.add(problemMatcher.onDidFindErrors((markers) => {
            const markerData = this.terminalMarkerMap.get(terminal.instanceId);
            if (markerData) {
                // Clear existing markers for a new set, otherwise older compilation
                // issues will be included
                markerData.markers.clear();
                markerData.resources.clear();
                for (const marker of markers) {
                    if (marker.severity === MarkerSeverity.Error) {
                        markerData.resources.set(marker.resource.toString(), marker.resource);
                        const markersForOwner = markerData.markers.get(marker.owner);
                        let markerMap = markersForOwner;
                        if (!markerMap) {
                            markerMap = new Map();
                            markerData.markers.set(marker.owner, markerMap);
                        }
                        markerMap.set(marker.resource.toString(), marker);
                        this.terminalMarkerMap.set(terminal.instanceId, markerData);
                    }
                }
            }
        }));
        store.add(problemMatcher.onDidRequestInvalidateLastMarker(() => {
            const markerData = this.terminalMarkerMap.get(terminal.instanceId);
            markerData?.markers.clear();
            markerData?.resources.clear();
            this.terminalMarkerMap.set(terminal.instanceId, {
                resources: new Map(),
                markers: new Map()
            });
        }));
    }
    /**
     * Gets the task problems for a specific terminal instance
     * @param instanceId The terminal instance ID
     * @returns Map of problem matchers to their resources and marker data, or undefined if no problems found
     */
    getTaskProblems(instanceId) {
        const markerData = this.terminalMarkerMap.get(instanceId);
        if (!markerData) {
            return undefined;
        }
        else if (markerData.markers.size === 0) {
            return new Map();
        }
        const result = new Map();
        for (const [owner, markersMap] of markerData.markers) {
            const resources = [];
            const markers = [];
            for (const [resource, marker] of markersMap) {
                resources.push(markerData.resources.get(resource));
                markers.push(marker);
            }
            result.set(owner, { resources, markers });
        }
        return result;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFza1Byb2JsZW1Nb25pdG9yLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rhc2tzL2Jyb3dzZXIvdGFza1Byb2JsZW1Nb25pdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFJbkYsT0FBTyxFQUFlLGNBQWMsRUFBMEIsTUFBTSxnREFBZ0QsQ0FBQztBQU9ySCxNQUFNLE9BQU8sa0JBQW1CLFNBQVEsVUFBVTtJQUtqRDtRQUNDLEtBQUssRUFBRSxDQUFDO1FBSlEsc0JBQWlCLEdBQXFDLElBQUksR0FBRyxFQUFFLENBQUM7UUFDaEUsd0JBQW1CLEdBQWlDLElBQUksR0FBRyxFQUFFLENBQUM7SUFJL0UsQ0FBQztJQUVELFdBQVcsQ0FBQyxRQUEyQixFQUFFLGNBQXdDO1FBQ2hGLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRTtZQUMvQyxTQUFTLEVBQUUsSUFBSSxHQUFHLEVBQWU7WUFDakMsT0FBTyxFQUFFLElBQUksR0FBRyxFQUFvQztTQUNwRCxDQUFDLENBQUM7UUFFSCxNQUFNLEtBQUssR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQ3BDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV6RCxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFO1lBQ2xDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ25ELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FB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