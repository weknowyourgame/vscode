/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import './overlayWidgets.css';
import { createFastDomNode } from '../../../../base/browser/fastDomNode.js';
import { PartFingerprints, ViewPart } from '../../view/viewPart.js';
import * as dom from '../../../../base/browser/dom.js';
/*
 * This view part for rendering the overlay widgets, which are
 * floating widgets positioned based on the editor's viewport,
 * such as the find widget.
 */
export class ViewOverlayWidgets extends ViewPart {
    constructor(context, viewDomNode) {
        super(context);
        this._viewDomNode = viewDomNode;
        const options = this._context.configuration.options;
        const layoutInfo = options.get(165 /* EditorOption.layoutInfo */);
        this._widgets = {};
        this._verticalScrollbarWidth = layoutInfo.verticalScrollbarWidth;
        this._minimapWidth = layoutInfo.minimap.minimapWidth;
        this._horizontalScrollbarHeight = layoutInfo.horizontalScrollbarHeight;
        this._editorHeight = layoutInfo.height;
        this._editorWidth = layoutInfo.width;
        this._viewDomNodeRect = { top: 0, left: 0, width: 0, height: 0 };
        this._domNode = createFastDomNode(document.createElement('div'));
        PartFingerprints.write(this._domNode, 4 /* PartFingerprint.OverlayWidgets */);
        this._domNode.setClassName('overlayWidgets');
        this.overflowingOverlayWidgetsDomNode = createFastDomNode(document.createElement('div'));
        PartFingerprints.write(this.overflowingOverlayWidgetsDomNode, 5 /* PartFingerprint.OverflowingOverlayWidgets */);
        this.overflowingOverlayWidgetsDomNode.setClassName('overflowingOverlayWidgets');
    }
    dispose() {
        super.dispose();
        this._widgets = {};
    }
    getDomNode() {
        return this._domNode;
    }
    // ---- begin view event handlers
    onConfigurationChanged(e) {
        const options = this._context.configuration.options;
        const layoutInfo = options.get(165 /* EditorOption.layoutInfo */);
        this._verticalScrollbarWidth = layoutInfo.verticalScrollbarWidth;
        this._minimapWidth = layoutInfo.minimap.minimapWidth;
        this._horizontalScrollbarHeight = layoutInfo.horizontalScrollbarHeight;
        this._editorHeight = layoutInfo.height;
        this._editorWidth = layoutInfo.width;
        return true;
    }
    // ---- end view event handlers
    _widgetCanOverflow(widget) {
        const options = this._context.configuration.options;
        const allowOverflow = options.get(4 /* EditorOption.allowOverflow */);
        return (widget.allowEditorOverflow || false) && allowOverflow;
    }
    addWidget(widget) {
        const domNode = createFastDomNode(widget.getDomNode());
        this._widgets[widget.getId()] = {
            widget: widget,
            preference: null,
            domNode: domNode
        };
        // This is sync because a widget wants to be in the dom
        domNode.setPosition('absolute');
        domNode.setAttribute('widgetId', widget.getId());
        if (this._widgetCanOverflow(widget)) {
            this.overflowingOverlayWidgetsDomNode.appendChild(domNode);
        }
        else {
            this._domNode.appendChild(domNode);
        }
        this.setShouldRender();
        this._updateMaxMinWidth();
    }
    setWidgetPosition(widget, position) {
        const widgetData = this._widgets[widget.getId()];
        const preference = position ? position.preference : null;
        const stack = position?.stackOrdinal;
        if (widgetData.preference === preference && widgetData.stack === stack) {
            this._updateMaxMinWidth();
            return false;
        }
        widgetData.preference = preference;
        widgetData.stack = stack;
        this.setShouldRender();
        this._updateMaxMinWidth();
        return true;
    }
    removeWidget(widget) {
        const widgetId = widget.getId();
        if (this._widgets.hasOwnProperty(widgetId)) {
            const widgetData = this._widgets[widgetId];
            const domNode = widgetData.domNode.domNode;
            delete this._widgets[widgetId];
            domNode.remove();
            this.setShouldRender();
            this._updateMaxMinWidth();
        }
    }
    _updateMaxMinWidth() {
        let maxMinWidth = 0;
        const keys = Object.keys(this._widgets);
        for (let i = 0, len = keys.length; i < len; i++) {
            const widgetId = keys[i];
            const widget = this._widgets[widgetId];
            const widgetMinWidthInPx = widget.widget.getMinContentWidthInPx?.();
            if (typeof widgetMinWidthInPx !== 'undefined') {
                maxMinWidth = Math.max(maxMinWidth, widgetMinWidthInPx);
            }
        }
        this._context.viewLayout.setOverlayWidgetsMinWidth(maxMinWidth);
    }
    _renderWidget(widgetData, stackCoordinates) {
        const domNode = widgetData.domNode;
        if (widgetData.preference === null) {
            domNode.setTop('');
            return;
        }
        const maxRight = (2 * this._verticalScrollbarWidth) + this._minimapWidth;
        if (widgetData.preference === 0 /* OverlayWidgetPositionPreference.TOP_RIGHT_CORNER */ || widgetData.preference === 1 /* OverlayWidgetPositionPreference.BOTTOM_RIGHT_CORNER */) {
            if (widgetData.preference === 1 /* OverlayWidgetPositionPreference.BOTTOM_RIGHT_CORNER */) {
                const widgetHeight = domNode.domNode.clientHeight;
                domNode.setTop((this._editorHeight - widgetHeight - 2 * this._horizontalScrollbarHeight));
            }
            else {
                domNode.setTop(0);
            }
            if (widgetData.stack !== undefined) {
                domNode.setTop(stackCoordinates[widgetData.preference]);
                stackCoordinates[widgetData.preference] += domNode.domNode.clientWidth;
            }
            else {
                domNode.setRight(maxRight);
            }
        }
        else if (widgetData.preference === 2 /* OverlayWidgetPositionPreference.TOP_CENTER */) {
            domNode.domNode.style.right = '50%';
            if (widgetData.stack !== undefined) {
                domNode.setTop(stackCoordinates[2 /* OverlayWidgetPositionPreference.TOP_CENTER */]);
                stackCoordinates[2 /* OverlayWidgetPositionPreference.TOP_CENTER */] += domNode.domNode.clientHeight;
            }
            else {
                domNode.setTop(0);
            }
        }
        else {
            const { top, left } = widgetData.preference;
            const fixedOverflowWidgets = this._context.configuration.options.get(51 /* EditorOption.fixedOverflowWidgets */);
            if (fixedOverflowWidgets && this._widgetCanOverflow(widgetData.widget)) {
                // top, left are computed relative to the editor and we need them relative to the page
                const editorBoundingBox = this._viewDomNodeRect;
                domNode.setTop(top + editorBoundingBox.top);
                domNode.setLeft(left + editorBoundingBox.left);
                domNode.setPosition('fixed');
            }
            else {
                domNode.setTop(top);
                domNode.setLeft(left);
                domNode.setPosition('absolute');
            }
        }
    }
    prepareRender(ctx) {
        this._viewDomNodeRect = dom.getDomNodePagePosition(this._viewDomNode.domNode);
    }
    render(ctx) {
        this._domNode.setWidth(this._editorWidth);
        const keys = Object.keys(this._widgets);
        const stackCoordinates = Array.from({ length: 2 /* OverlayWidgetPositionPreference.TOP_CENTER */ + 1 }, () => 0);
        keys.sort((a, b) => (this._widgets[a].stack || 0) - (this._widgets[b].stack || 0));
        for (let i = 0, len = keys.length; i < len; i++) {
            const widgetId = keys[i];
            this._renderWidget(this._widgets[widgetId], stackCoordinates);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3ZlcmxheVdpZGdldHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvdmlld1BhcnRzL292ZXJsYXlXaWRnZXRzL292ZXJsYXlXaWRnZXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sc0JBQXNCLENBQUM7QUFDOUIsT0FBTyxFQUFlLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFFekYsT0FBTyxFQUFtQixnQkFBZ0IsRUFBRSxRQUFRLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUtyRixPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBY3ZEOzs7O0dBSUc7QUFDSCxNQUFNLE9BQU8sa0JBQW1CLFNBQVEsUUFBUTtJQWEvQyxZQUFZLE9BQW9CLEVBQUUsV0FBcUM7UUFDdEUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2YsSUFBSSxDQUFDLFlBQVksR0FBRyxXQUFXLENBQUM7UUFFaEMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDO1FBQ3BELE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLG1DQUF5QixDQUFDO1FBRXhELElBQUksQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDO1FBQ25CLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxVQUFVLENBQUMsc0JBQXNCLENBQUM7UUFDakUsSUFBSSxDQUFDLGFBQWEsR0FBRyxVQUFVLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQztRQUNyRCxJQUFJLENBQUMsMEJBQTBCLEdBQUcsVUFBVSxDQUFDLHlCQUF5QixDQUFDO1FBQ3ZFLElBQUksQ0FBQyxhQUFhLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQztRQUN2QyxJQUFJLENBQUMsWUFBWSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUM7UUFDckMsSUFBSSxDQUFDLGdCQUFnQixHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDO1FBRWpFLElBQUksQ0FBQyxRQUFRLEdBQUcsaUJBQWlCLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ2pFLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSx5Q0FBaUMsQ0FBQztRQUN0RSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRTdDLElBQUksQ0FBQyxnQ0FBZ0MsR0FBRyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDekYsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxnQ0FBZ0Msb0RBQTRDLENBQUM7UUFDekcsSUFBSSxDQUFDLGdDQUFnQyxDQUFDLFlBQVksQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0lBQ2pGLENBQUM7SUFFZSxPQUFPO1FBQ3RCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNoQixJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztJQUNwQixDQUFDO0lBRU0sVUFBVTtRQUNoQixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUM7SUFDdEIsQ0FBQztJQUVELGlDQUFpQztJQUVqQixzQkFBc0IsQ0FBQyxDQUEyQztRQUNqRixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUM7UUFDcEQsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLEdBQUcsbUNBQXlCLENBQUM7UUFFeEQsSUFBSSxDQUFDLHVCQUF1QixHQUFHLFVBQVUsQ0FBQyxzQkFBc0IsQ0FBQztRQUNqRSxJQUFJLENBQUMsYUFBYSxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDO1FBQ3JELElBQUksQ0FBQywwQkFBMEIsR0FBRyxVQUFVLENBQUMseUJBQXlCLENBQUM7UUFDdkUsSUFBSSxDQUFDLGFBQWEsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxZQUFZLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQztRQUNyQyxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCwrQkFBK0I7SUFFdkIsa0JBQWtCLENBQUMsTUFBc0I7UUFDaEQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDO1FBQ3BELE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxHQUFHLG9DQUE0QixDQUFDO1FBQzlELE9BQU8sQ0FBQyxNQUFNLENBQUMsbUJBQW1CLElBQUksS0FBSyxDQUFDLElBQUksYUFBYSxDQUFDO0lBQy9ELENBQUM7SUFFTSxTQUFTLENBQUMsTUFBc0I7UUFDdEMsTUFBTSxPQUFPLEdBQUcsaUJBQWlCLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFFdkQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRztZQUMvQixNQUFNLEVBQUUsTUFBTTtZQUNkLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLE9BQU8sRUFBRSxPQUFPO1NBQ2hCLENBQUM7UUFFRix1REFBdUQ7UUFDdkQsT0FBTyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoQyxPQUFPLENBQUMsWUFBWSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUVqRCxJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQ3JDLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDNUQsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwQyxDQUFDO1FBRUQsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0lBQzNCLENBQUM7SUFFTSxpQkFBaUIsQ0FBQyxNQUFzQixFQUFFLFFBQXVDO1FBQ3ZGLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDakQsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDekQsTUFBTSxLQUFLLEdBQUcsUUFBUSxFQUFFLFlBQVksQ0FBQztRQUNyQyxJQUFJLFVBQVUsQ0FBQyxVQUFVLEtBQUssVUFBVSxJQUFJLFVBQVUsQ0FBQyxLQUFLLEtBQUssS0FBSyxFQUFFLENBQUM7WUFDeEUsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDMUIsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBRUQsVUFBVSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7UUFDbkMsVUFBVSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDekIsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBRTFCLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVNLFlBQVksQ0FBQyxNQUFzQjtRQUN6QyxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDaEMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQzVDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDM0MsTUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7WUFDM0MsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBRS9CLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNqQixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDdkIsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDM0IsQ0FBQztJQUNGLENBQUM7SUFFTyxrQkFBa0I7UUFDekIsSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3hDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNqRCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDekIsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN2QyxNQUFNLGtCQUFrQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsc0JBQXNCLEVBQUUsRUFBRSxDQUFDO1lBQ3BFLElBQUksT0FBTyxrQkFBa0IsS0FBSyxXQUFXLEVBQUUsQ0FBQztnQkFDL0MsV0FBVyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDekQsQ0FBQztRQUNGLENBQUM7UUFDRCxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyx5QkFBeUIsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRU8sYUFBYSxDQUFDLFVBQXVCLEVBQUUsZ0JBQTBCO1FBQ3hFLE1BQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUM7UUFFbkMsSUFBSSxVQUFVLENBQUMsVUFBVSxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3BDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDbkIsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLFFBQVEsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO1FBQ3pFLElBQUksVUFBVSxDQUFDLFVBQVUsNkRBQXFELElBQUksVUFBVSxDQUFDLFVBQVUsZ0VBQXdELEVBQUUsQ0FBQztZQUNqSyxJQUFJLFVBQVUsQ0FBQyxVQUFVLGdFQUF3RCxFQUFFLENBQUM7Z0JBQ25GLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDO2dCQUNsRCxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsR0FBRyxZQUFZLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUM7WUFDM0YsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbkIsQ0FBQztZQUVELElBQUksVUFBVSxDQUFDLEtBQUssS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDcEMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztnQkFDeEQsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDO1lBQ3hFLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxPQUFPLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzVCLENBQUM7UUFDRixDQUFDO2FBQU0sSUFBSSxVQUFVLENBQUMsVUFBVSx1REFBK0MsRUFBRSxDQUFDO1lBQ2pGLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7WUFDcEMsSUFBSSxVQUFVLENBQUMsS0FBSyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUNwQyxPQUFPLENBQUMsTUFBTSxDQUFDLGdCQUFnQixvREFBNEMsQ0FBQyxDQUFDO2dCQUM3RSxnQkFBZ0Isb0RBQTRDLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUM7WUFDOUYsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbkIsQ0FBQztRQUNGLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDO1lBQzVDLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLEdBQUcsNENBQW1DLENBQUM7WUFDeEcsSUFBSSxvQkFBb0IsSUFBSSxJQUFJLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7Z0JBQ3hFLHNGQUFzRjtnQkFDdEYsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ2hELE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUM1QyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDL0MsT0FBTyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUU5QixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDcEIsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDdEIsT0FBTyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNqQyxDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFTSxhQUFhLENBQUMsR0FBcUI7UUFDekMsSUFBSSxDQUFDLGdCQUFnQixHQUFHLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQy9FLENBQUM7SUFFTSxNQUFNLENBQUMsR0FBK0I7UUFDNUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRTFDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3hDLE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxxREFBNkMsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRW5GLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNqRCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDekIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDL0QsQ0FBQztJQUNGLENBQUM7Q0FDRCJ9