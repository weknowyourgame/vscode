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
var ViewGpuContext_1;
import * as nls from '../../../nls.js';
import { addDisposableListener, getActiveWindow } from '../../../base/browser/dom.js';
import { createFastDomNode } from '../../../base/browser/fastDomNode.js';
import { BugIndicatingError } from '../../../base/common/errors.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { observableValue, runOnChange } from '../../../base/common/observable.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { TextureAtlas } from './atlas/textureAtlas.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { INotificationService, Severity } from '../../../platform/notification/common/notification.js';
import { GPULifecycle } from './gpuDisposable.js';
import { ensureNonNullable, observeDevicePixelDimensions } from './gpuUtils.js';
import { RectangleRenderer } from './rectangleRenderer.js';
import { DecorationCssRuleExtractor } from './css/decorationCssRuleExtractor.js';
import { Event } from '../../../base/common/event.js';
import { DecorationStyleCache } from './css/decorationStyleCache.js';
let ViewGpuContext = class ViewGpuContext extends Disposable {
    static { ViewGpuContext_1 = this; }
    static { this._decorationCssRuleExtractor = new DecorationCssRuleExtractor(); }
    static get decorationCssRuleExtractor() {
        return ViewGpuContext_1._decorationCssRuleExtractor;
    }
    static { this._decorationStyleCache = new DecorationStyleCache(); }
    static get decorationStyleCache() {
        return ViewGpuContext_1._decorationStyleCache;
    }
    /**
     * The shared texture atlas to use across all views.
     *
     * @throws if called before the GPU device is resolved
     */
    static get atlas() {
        if (!ViewGpuContext_1._atlas) {
            throw new BugIndicatingError('Cannot call ViewGpuContext.textureAtlas before device is resolved');
        }
        return ViewGpuContext_1._atlas;
    }
    /**
     * The shared texture atlas to use across all views. This is a convenience alias for
     * {@link ViewGpuContext.atlas}.
     *
     * @throws if called before the GPU device is resolved
     */
    get atlas() {
        return ViewGpuContext_1.atlas;
    }
    constructor(context, _instantiationService, _notificationService, configurationService) {
        super();
        this._instantiationService = _instantiationService;
        this._notificationService = _notificationService;
        this.configurationService = configurationService;
        /**
         * The hard cap for line columns rendered by the GPU renderer.
         */
        this.maxGpuCols = 2000;
        this.canvas = createFastDomNode(document.createElement('canvas'));
        this.canvas.setClassName('editorCanvas');
        // Adjust the canvas size to avoid drawing under the scroll bar
        this._register(Event.runAndSubscribe(configurationService.onDidChangeConfiguration, e => {
            if (!e || e.affectsConfiguration('editor.scrollbar.verticalScrollbarSize')) {
                const verticalScrollbarSize = configurationService.getValue('editor').scrollbar?.verticalScrollbarSize ?? 14;
                this.canvas.domNode.style.boxSizing = 'border-box';
                this.canvas.domNode.style.paddingRight = `${verticalScrollbarSize}px`;
            }
        }));
        this.ctx = ensureNonNullable(this.canvas.domNode.getContext('webgpu'));
        // Request the GPU device, we only want to do this a single time per window as it's async
        // and can delay the initial render.
        if (!ViewGpuContext_1.device) {
            ViewGpuContext_1.device = GPULifecycle.requestDevice((message) => {
                const choices = [{
                        label: nls.localize('editor.dom.render', "Use DOM-based rendering"),
                        run: () => this.configurationService.updateValue('editor.experimentalGpuAcceleration', 'off'),
                    }];
                this._notificationService.prompt(Severity.Warning, message, choices);
            }).then(ref => {
                ViewGpuContext_1.deviceSync = ref.object;
                if (!ViewGpuContext_1._atlas) {
                    ViewGpuContext_1._atlas = this._instantiationService.createInstance(TextureAtlas, ref.object.limits.maxTextureDimension2D, undefined, ViewGpuContext_1.decorationStyleCache);
                }
                return ref.object;
            });
        }
        const dprObs = observableValue(this, getActiveWindow().devicePixelRatio);
        this._register(addDisposableListener(getActiveWindow(), 'resize', () => {
            dprObs.set(getActiveWindow().devicePixelRatio, undefined);
        }));
        this.devicePixelRatio = dprObs;
        this._register(runOnChange(this.devicePixelRatio, () => ViewGpuContext_1.atlas?.clear()));
        const canvasDevicePixelDimensions = observableValue(this, { width: this.canvas.domNode.width, height: this.canvas.domNode.height });
        this._register(observeDevicePixelDimensions(this.canvas.domNode, getActiveWindow(), (width, height) => {
            this.canvas.domNode.width = width;
            this.canvas.domNode.height = height;
            canvasDevicePixelDimensions.set({ width, height }, undefined);
        }));
        this.canvasDevicePixelDimensions = canvasDevicePixelDimensions;
        const contentLeft = observableValue(this, 0);
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            contentLeft.set(context.configuration.options.get(165 /* EditorOption.layoutInfo */).contentLeft, undefined);
        }));
        this.contentLeft = contentLeft;
        this.rectangleRenderer = this._instantiationService.createInstance(RectangleRenderer, context, this.contentLeft, this.devicePixelRatio, this.canvas.domNode, this.ctx, ViewGpuContext_1.device);
    }
    /**
     * This method determines which lines can be and are allowed to be rendered using the GPU
     * renderer. Eventually this should trend all lines, except maybe exceptional cases like
     * decorations that use class names.
     */
    canRender(options, viewportData, lineNumber) {
        const data = viewportData.getViewLineRenderingData(lineNumber);
        // Check if the line has simple attributes that aren't supported
        if (data.containsRTL ||
            data.maxColumn > this.maxGpuCols) {
            return false;
        }
        // Check if all inline decorations are supported
        if (data.inlineDecorations.length > 0) {
            let supported = true;
            for (const decoration of data.inlineDecorations) {
                if (decoration.type !== 0 /* InlineDecorationType.Regular */) {
                    supported = false;
                    break;
                }
                const styleRules = ViewGpuContext_1._decorationCssRuleExtractor.getStyleRules(this.canvas.domNode, decoration.inlineClassName);
                supported &&= styleRules.every(rule => {
                    // Pseudo classes aren't supported currently
                    if (rule.selectorText.includes(':')) {
                        return false;
                    }
                    for (const r of rule.style) {
                        if (!supportsCssRule(r, rule.style)) {
                            return false;
                        }
                    }
                    return true;
                });
                if (!supported) {
                    break;
                }
            }
            return supported;
        }
        return true;
    }
    /**
     * Like {@link canRender} but returns detailed information about why the line cannot be rendered.
     */
    canRenderDetailed(options, viewportData, lineNumber) {
        const data = viewportData.getViewLineRenderingData(lineNumber);
        const reasons = [];
        if (data.containsRTL) {
            reasons.push('containsRTL');
        }
        if (data.maxColumn > this.maxGpuCols) {
            reasons.push('maxColumn > maxGpuCols');
        }
        if (data.inlineDecorations.length > 0) {
            let supported = true;
            const problemTypes = [];
            const problemSelectors = [];
            const problemRules = [];
            for (const decoration of data.inlineDecorations) {
                if (decoration.type !== 0 /* InlineDecorationType.Regular */) {
                    problemTypes.push(decoration.type);
                    supported = false;
                    continue;
                }
                const styleRules = ViewGpuContext_1._decorationCssRuleExtractor.getStyleRules(this.canvas.domNode, decoration.inlineClassName);
                supported &&= styleRules.every(rule => {
                    // Pseudo classes aren't supported currently
                    if (rule.selectorText.includes(':')) {
                        problemSelectors.push(rule.selectorText);
                        return false;
                    }
                    for (const r of rule.style) {
                        if (!supportsCssRule(r, rule.style)) {
                            // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
                            problemRules.push(`${r}: ${rule.style[r]}`);
                            return false;
                        }
                    }
                    return true;
                });
                if (!supported) {
                    continue;
                }
            }
            if (problemTypes.length > 0) {
                reasons.push(`inlineDecorations with unsupported types (${problemTypes.map(e => `\`${e}\``).join(', ')})`);
            }
            if (problemRules.length > 0) {
                reasons.push(`inlineDecorations with unsupported CSS rules (${problemRules.map(e => `\`${e}\``).join(', ')})`);
            }
            if (problemSelectors.length > 0) {
                reasons.push(`inlineDecorations with unsupported CSS selectors (${problemSelectors.map(e => `\`${e}\``).join(', ')})`);
            }
        }
        return reasons;
    }
};
ViewGpuContext = ViewGpuContext_1 = __decorate([
    __param(1, IInstantiationService),
    __param(2, INotificationService),
    __param(3, IConfigurationService)
], ViewGpuContext);
export { ViewGpuContext };
/**
 * A list of supported decoration CSS rules that can be used in the GPU renderer.
 */
const gpuSupportedDecorationCssRules = [
    'color',
    'font-weight',
    'opacity',
];
function supportsCssRule(rule, style) {
    if (!gpuSupportedDecorationCssRules.includes(rule)) {
        return false;
    }
    // Check for values that aren't supported
    switch (rule) {
        default: return true;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld0dwdUNvbnRleHQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvZ3B1L3ZpZXdHcHVDb250ZXh0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLGlCQUFpQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxlQUFlLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUN0RixPQUFPLEVBQUUsaUJBQWlCLEVBQW9CLE1BQU0sc0NBQXNDLENBQUM7QUFDM0YsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRy9ELE9BQU8sRUFBRSxlQUFlLEVBQUUsV0FBVyxFQUFvQixNQUFNLG9DQUFvQyxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN2RCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUNoRyxPQUFPLEVBQUUsb0JBQW9CLEVBQWlCLFFBQVEsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3RILE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUNsRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDaEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFFM0QsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDakYsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBRXRELE9BQU8s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