/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { getWindowId, onDidUnregisterWindow } from './dom.js';
import { Emitter, Event } from '../common/event.js';
import { Disposable, markAsSingleton } from '../common/lifecycle.js';
/**
 * See https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio#monitoring_screen_resolution_or_zoom_level_changes
 */
class DevicePixelRatioMonitor extends Disposable {
    constructor(targetWindow) {
        super();
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._listener = () => this._handleChange(targetWindow, true);
        this._mediaQueryList = null;
        this._handleChange(targetWindow, false);
    }
    _handleChange(targetWindow, fireEvent) {
        this._mediaQueryList?.removeEventListener('change', this._listener);
        this._mediaQueryList = targetWindow.matchMedia(`(resolution: ${targetWindow.devicePixelRatio}dppx)`);
        this._mediaQueryList.addEventListener('change', this._listener);
        if (fireEvent) {
            this._onDidChange.fire();
        }
    }
}
class PixelRatioMonitorImpl extends Disposable {
    get value() {
        return this._value;
    }
    constructor(targetWindow) {
        super();
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._value = this._getPixelRatio(targetWindow);
        const dprMonitor = this._register(new DevicePixelRatioMonitor(targetWindow));
        this._register(dprMonitor.onDidChange(() => {
            this._value = this._getPixelRatio(targetWindow);
            this._onDidChange.fire(this._value);
        }));
    }
    _getPixelRatio(targetWindow) {
        const ctx = document.createElement('canvas').getContext('2d');
        const dpr = targetWindow.devicePixelRatio || 1;
        const bsr = ctx?.webkitBackingStorePixelRatio ||
            ctx?.mozBackingStorePixelRatio ||
            ctx?.msBackingStorePixelRatio ||
            ctx?.oBackingStorePixelRatio ||
            ctx?.backingStorePixelRatio || 1;
        return dpr / bsr;
    }
}
class PixelRatioMonitorFacade {
    constructor() {
        this.mapWindowIdToPixelRatioMonitor = new Map();
    }
    _getOrCreatePixelRatioMonitor(targetWindow) {
        const targetWindowId = getWindowId(targetWindow);
        let pixelRatioMonitor = this.mapWindowIdToPixelRatioMonitor.get(targetWindowId);
        if (!pixelRatioMonitor) {
            pixelRatioMonitor = markAsSingleton(new PixelRatioMonitorImpl(targetWindow));
            this.mapWindowIdToPixelRatioMonitor.set(targetWindowId, pixelRatioMonitor);
            markAsSingleton(Event.once(onDidUnregisterWindow)(({ vscodeWindowId }) => {
                if (vscodeWindowId === targetWindowId) {
                    pixelRatioMonitor?.dispose();
                    this.mapWindowIdToPixelRatioMonitor.delete(targetWindowId);
                }
            }));
        }
        return pixelRatioMonitor;
    }
    getInstance(targetWindow) {
        return this._getOrCreatePixelRatioMonitor(targetWindow);
    }
}
/**
 * Returns the pixel ratio.
 *
 * This is useful for rendering <canvas> elements at native screen resolution or for being used as
 * a cache key when storing font measurements. Fonts might render differently depending on resolution
 * and any measurements need to be discarded for example when a window is moved from a monitor to another.
 */
export const PixelRatio = new PixelRatioMonitorFacade();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGl4ZWxSYXRpby5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2Jyb3dzZXIvcGl4ZWxSYXRpby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQzlELE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDcEQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQVVyRTs7R0FFRztBQUNILE1BQU0sdUJBQXdCLFNBQVEsVUFBVTtJQVEvQyxZQUFZLFlBQW9CO1FBQy9CLEtBQUssRUFBRSxDQUFDO1FBUFEsaUJBQVksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUMzRCxnQkFBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDO1FBUTlDLElBQUksQ0FBQyxTQUFTLEdBQUcsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDOUQsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUM7UUFDNUIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxZQUFZLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVPLGFBQWEsQ0FBQyxZQUFvQixFQUFFLFNBQWtCO1FBQzdELElBQUksQ0FBQyxlQUFlLEVBQUUsbUJBQW1CLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUVwRSxJQUFJLENBQUMsZUFBZSxHQUFHLFlBQVksQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLFlBQVksQ0FBQyxnQkFBZ0IsT0FBTyxDQUFDLENBQUM7UUFDckcsSUFBSSxDQUFDLGVB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