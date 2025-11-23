/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createFastDomNode } from '../../../../../base/browser/fastDomNode.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
export class NotebookCellOverlays extends Disposable {
    constructor(listView) {
        super();
        this.listView = listView;
        this._lastOverlayId = 0;
        this._overlays = Object.create(null);
        this.domNode = createFastDomNode(document.createElement('div'));
        this.domNode.setClassName('cell-overlays');
        this.domNode.setPosition('absolute');
        this.domNode.setAttribute('role', 'presentation');
        this.domNode.setAttribute('aria-hidden', 'true');
        this.domNode.setWidth('100%');
        this.listView.containerDomNode.appendChild(this.domNode.domNode);
    }
    changeCellOverlays(callback) {
        let overlaysHaveChanged = false;
        const changeAccessor = {
            addOverlay: (overlay) => {
                overlaysHaveChanged = true;
                return this._addOverlay(overlay);
            },
            removeOverlay: (id) => {
                overlaysHaveChanged = true;
                this._removeOverlay(id);
            },
            layoutOverlay: (id) => {
                overlaysHaveChanged = true;
                this._layoutOverlay(id);
            }
        };
        callback(changeAccessor);
        return overlaysHaveChanged;
    }
    onCellsChanged(e) {
        this.layout();
    }
    onHiddenRangesChange() {
        this.layout();
    }
    layout() {
        for (const id in this._overlays) {
            this._layoutOverlay(id);
        }
    }
    _addOverlay(overlay) {
        const overlayId = `${++this._lastOverlayId}`;
        const overlayWidget = {
            overlayId,
            overlay,
            domNode: createFastDomNode(overlay.domNode)
        };
        this._overlays[overlayId] = overlayWidget;
        overlayWidget.domNode.setClassName('cell-overlay');
        overlayWidget.domNode.setPosition('absolute');
        this.domNode.appendChild(overlayWidget.domNode);
        return overlayId;
    }
    _removeOverlay(id) {
        const overlay = this._overlays[id];
        if (overlay) {
            // overlay.overlay.dispose();
            try {
                this.domNode.removeChild(overlay.domNode);
            }
            catch {
                // no op
            }
            delete this._overlays[id];
        }
    }
    _layoutOverlay(id) {
        const overlay = this._overlays[id];
        if (!overlay) {
            return;
        }
        const isInHiddenRanges = this._isInHiddenRanges(overlay);
        if (isInHiddenRanges) {
            overlay.domNode.setDisplay('none');
            return;
        }
        overlay.domNode.setDisplay('block');
        const index = this.listView.indexOf(overlay.overlay.cell);
        if (index === -1) {
            // should not happen
            return;
        }
        const top = this.listView.elementTop(index);
        overlay.domNode.setTop(top);
    }
    _isInHiddenRanges(zone) {
        const index = this.listView.indexOf(zone.overlay.cell);
        if (index === -1) {
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tDZWxsT3ZlcmxheXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svYnJvd3Nlci92aWV3UGFydHMvbm90ZWJvb2tDZWxsT3ZlcmxheXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFlLE1BQU0sNENBQTRDLENBQUM7QUFDNUYsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBV3JFLE1BQU0sT0FBTyxvQkFBcUIsU0FBUSxVQUFVO0lBS25ELFlBQ2tCLFFBQTZDO1FBRTlELEtBQUssRUFBRSxDQUFDO1FBRlMsYUFBUSxHQUFSLFFBQVEsQ0FBcUM7UUFMdkQsbUJBQWMsR0FBRyxDQUFDLENBQUM7UUFFbkIsY0FBUyxHQUFrRCxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBTXRGLElBQUksQ0FBQyxPQUFPLEdBQUcsaUJBQWlCLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ2hFLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQzNDLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUMsQ0FBQztRQUNsRCxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxhQUFhLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFOUIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FB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