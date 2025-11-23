/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { derived } from '../../../../../../../base/common/observable.js';
export function setVisualization(data, visualization) {
    // eslint-disable-next-line local/code-no-any-casts
    data['$$visualization'] = visualization;
}
export function debugLogRects(rects, elem) {
    if (Array.isArray(rects)) {
        const record = {};
        rects.forEach((rect, index) => {
            record[index.toString()] = rect;
        });
        rects = record;
    }
    setVisualization(rects, new ManyRectVisualizer(rects, elem));
    return rects;
}
export function debugLogRect(rect, elem, name) {
    setVisualization(rect, new HtmlRectVisualizer(rect, elem, name));
    return rect;
}
export function debugLogHorizontalOffsetRange(rect, elem, name) {
    setVisualization(rect, new HtmlHorizontalOffsetRangeVisualizer(rect, elem, name, 0, 'above'));
    return rect;
}
export function debugLogHorizontalOffsetRanges(rects, elem) {
    if (Array.isArray(rects)) {
        const record = {};
        rects.forEach((rect, index) => {
            record[index.toString()] = rect;
        });
        rects = record;
    }
    setVisualization(rects, new ManyHorizontalOffsetRangeVisualizer(rects, elem));
    return rects;
}
class ManyRectVisualizer {
    constructor(_rects, _elem) {
        this._rects = _rects;
        this._elem = _elem;
    }
    visualize() {
        const d = [];
        for (const key in this._rects) {
            const v = new HtmlRectVisualizer(this._rects[key], this._elem, key);
            d.push(v.visualize());
        }
        return {
            dispose: () => {
                d.forEach(d => d.dispose());
            }
        };
    }
}
class ManyHorizontalOffsetRangeVisualizer {
    constructor(_rects, _elem) {
        this._rects = _rects;
        this._elem = _elem;
    }
    visualize() {
        const d = [];
        const keys = Object.keys(this._rects);
        keys.forEach((key, index) => {
            // Stagger labels: odd indices go above, even indices go below
            const labelPosition = index % 2 === 0 ? 'above' : 'below';
            const v = new HtmlHorizontalOffsetRangeVisualizer(this._rects[key], this._elem, key, index * 12, labelPosition);
            d.push(v.visualize());
        });
        return {
            dispose: () => {
                d.forEach(d => d.dispose());
            }
        };
    }
}
class HtmlHorizontalOffsetRangeVisualizer {
    constructor(_rect, _elem, _name, _verticalOffset = 0, _labelPosition = 'above') {
        this._rect = _rect;
        this._elem = _elem;
        this._name = _name;
        this._verticalOffset = _verticalOffset;
        this._labelPosition = _labelPosition;
    }
    visualize() {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '100000';
        // Create horizontal line
        const horizontalLine = document.createElement('div');
        horizontalLine.style.position = 'absolute';
        horizontalLine.style.height = '2px';
        horizontalLine.style.backgroundColor = 'green';
        horizontalLine.style.top = '50%';
        horizontalLine.style.transform = 'translateY(-50%)';
        // Create start vertical bar
        const startBar = document.createElement('div');
        startBar.style.position = 'absolute';
        startBar.style.width = '2px';
        startBar.style.height = '8px';
        startBar.style.backgroundColor = 'green';
        startBar.style.left = '0';
        startBar.style.top = '50%';
        startBar.style.transform = 'translateY(-50%)';
        // Create end vertical bar
        const endBar = document.createElement('div');
        endBar.style.position = 'absolute';
        endBar.style.width = '2px';
        endBar.style.height = '8px';
        endBar.style.backgroundColor = 'green';
        endBar.style.right = '0';
        endBar.style.top = '50%';
        endBar.style.transform = 'translateY(-50%)';
        // Create label
        const label = document.createElement('div');
        label.textContent = this._name;
        label.style.position = 'absolute';
        // Position label above or below the line to avoid overlaps
        if (this._labelPosition === 'above') {
            label.style.bottom = '12px';
        }
        else {
            label.style.top = '12px';
        }
        label.style.left = '2px'; // Slight offset from start
        label.style.color = 'green';
        label.style.fontSize = '10px';
        label.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        label.style.padding = '1px 3px';
        label.style.border = '1px solid green';
        label.style.borderRadius = '2px';
        label.style.whiteSpace = 'nowrap';
        label.style.boxShadow = '0 1px 2px rgba(0,0,0,0.15)';
        label.style.fontFamily = 'monospace';
        container.appendChild(horizontalLine);
        container.appendChild(startBar);
        container.appendChild(endBar);
        container.appendChild(label);
        const updatePosition = () => {
            const elemRect = this._elem.getBoundingClientRect();
            const centerY = this._rect.top + (this._rect.height / 2) + this._verticalOffset;
            const left = elemRect.left + this._rect.left;
            const width = this._rect.width;
            container.style.left = left + 'px';
            container.style.top = (elemRect.top + centerY) + 'px';
            container.style.width = width + 'px';
            container.style.height = '8px';
            horizontalLine.style.width = width + 'px';
        };
        // This is for debugging only
        // eslint-disable-next-line no-restricted-syntax
        document.body.appendChild(container);
        updatePosition();
        const observer = new ResizeObserver(updatePosition);
        observer.observe(this._elem);
        return {
            dispose: () => {
                observer.disconnect();
                container.remove();
            }
        };
    }
}
class HtmlRectVisualizer {
    constructor(_rect, _elem, _name) {
        this._rect = _rect;
        this._elem = _elem;
        this._name = _name;
    }
    visualize() {
        const div = document.createElement('div');
        div.style.position = 'fixed';
        div.style.border = '1px solid red';
        div.style.boxSizing = 'border-box';
        div.style.pointerEvents = 'none';
        div.style.zIndex = '100000';
        const label = document.createElement('div');
        label.textContent = this._name;
        label.style.position = 'absolute';
        label.style.top = '-20px';
        label.style.left = '0';
        label.style.color = 'red';
        label.style.fontSize = '12px';
        label.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        div.appendChild(label);
        const updatePosition = () => {
            const elemRect = this._elem.getBoundingClientRect();
            console.log(elemRect);
            div.style.left = (elemRect.left + this._rect.left) + 'px';
            div.style.top = (elemRect.top + this._rect.top) + 'px';
            div.style.width = this._rect.width + 'px';
            div.style.height = this._rect.height + 'px';
        };
        // This is for debugging only
        // eslint-disable-next-line no-restricted-syntax
        document.body.appendChild(div);
        updatePosition();
        const observer = new ResizeObserver(updatePosition);
        observer.observe(this._elem);
        return {
            dispose: () => {
                observer.disconnect();
                div.remove();
            }
        };
    }
}
export function debugView(value, reader) {
    if (typeof value === 'object' && value && '$$visualization' in value) {
        const vis = value['$$visualization'];
        debugReadDisposable(vis.visualize(), reader);
    }
}
function debugReadDisposable(d, reader) {
    derived({ name: 'debugReadDisposable' }, (_reader) => {
        _reader.store.add(d);
        return undefined;
    }).read(reader);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWdWaXN1YWxpemF0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvdmlldy9pbmxpbmVFZGl0cy9pbmxpbmVFZGl0c1ZpZXdzL2RlYnVnVmlzdWFsaXphdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQVcsT0FBTyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFPbEYsTUFBTSxVQUFVLGdCQUFnQixDQUFDLElBQVksRUFBRSxhQUFtQztJQUNqRixtREFBbUQ7SUFDbEQsSUFBWSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsYUFBYSxDQUFDO0FBQ2xELENBQUM7QUFFRCxNQUFNLFVBQVUsYUFBYSxDQUFDLEtBQW9DLEVBQUUsSUFBaUI7SUFDcEYsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDMUIsTUFBTSxNQUFNLEdBQXlCLEVBQUUsQ0FBQztRQUN4QyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQzdCLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUM7UUFDakMsQ0FBQyxDQUFDLENBQUM7UUFDSCxLQUFLLEdBQUcsTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRCxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsSUFBSSxrQkFBa0IsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM3RCxPQUFPLEtBQUssQ0FBQztBQUNkLENBQUM7QUFFRCxNQUFNLFVBQVUsWUFBWSxDQUFDLElBQVUsRUFBRSxJQUFpQixFQUFFLElBQVk7SUFDdkUsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLElBQUksa0JBQWtCLENBQUMsSUFBSSxFQUFF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