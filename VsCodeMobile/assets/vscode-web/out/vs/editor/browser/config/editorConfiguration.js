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
import * as browser from '../../../base/browser/browser.js';
import * as arrays from '../../../base/common/arrays.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import * as objects from '../../../base/common/objects.js';
import * as platform from '../../../base/common/platform.js';
import { ElementSizeObserver } from './elementSizeObserver.js';
import { FontMeasurements } from './fontMeasurements.js';
import { migrateOptions } from './migrateOptions.js';
import { TabFocus } from './tabFocus.js';
import { ComputeOptionsMemory, ConfigurationChangedEvent, editorOptionsRegistry } from '../../common/config/editorOptions.js';
import { EditorZoom } from '../../common/config/editorZoom.js';
import { createBareFontInfoFromValidatedSettings } from '../../common/config/fontInfoFromSettings.js';
import { IAccessibilityService } from '../../../platform/accessibility/common/accessibility.js';
import { getWindow, getWindowById } from '../../../base/browser/dom.js';
import { PixelRatio } from '../../../base/browser/pixelRatio.js';
import { InputMode } from '../../common/inputMode.js';
let EditorConfiguration = class EditorConfiguration extends Disposable {
    constructor(isSimpleWidget, contextMenuId, options, container, _accessibilityService) {
        super();
        this._accessibilityService = _accessibilityService;
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this._onDidChangeFast = this._register(new Emitter());
        this.onDidChangeFast = this._onDidChangeFast.event;
        this._isDominatedByLongLines = false;
        this._viewLineCount = 1;
        this._lineNumbersDigitCount = 1;
        this._reservedHeight = 0;
        this._glyphMarginDecorationLaneCount = 1;
        this._computeOptionsMemory = new ComputeOptionsMemory();
        this.isSimpleWidget = isSimpleWidget;
        this.contextMenuId = contextMenuId;
        this._containerObserver = this._register(new ElementSizeObserver(container, options.dimension));
        this._targetWindowId = getWindow(container).vscodeWindowId;
        this._rawOptions = deepCloneAndMigrateOptions(options);
        this._validatedOptions = EditorOptionsUtil.validateOptions(this._rawOptions);
        this.options = this._computeOptions();
        if (this.options.get(19 /* EditorOption.automaticLayout */)) {
            this._containerObserver.startObserving();
        }
        this._register(EditorZoom.onDidChangeZoomLevel(() => this._recomputeOptions()));
        this._register(TabFocus.onDidChangeTabFocus(() => this._recomputeOptions()));
        this._register(this._containerObserver.onDidChange(() => this._recomputeOptions()));
        this._register(FontMeasurements.onDidChange(() => this._recomputeOptions()));
        this._register(PixelRatio.getInstance(getWindow(container)).onDidChange(() => this._recomputeOptions()));
        this._register(this._accessibilityService.onDidChangeScreenReaderOptimized(() => this._recomputeOptions()));
        this._register(InputMode.onDidChangeInputMode(() => this._recomputeOptions()));
    }
    _recomputeOptions() {
        const newOptions = this._computeOptions();
        const changeEvent = EditorOptionsUtil.checkEquals(this.options, newOptions);
        if (changeEvent === null) {
            // nothing changed!
            return;
        }
        this.options = newOptions;
        this._onDidChangeFast.fire(changeEvent);
        this._onDidChange.fire(changeEvent);
    }
    _computeOptions() {
        const partialEnv = this._readEnvConfiguration();
        const bareFontInfo = createBareFontInfoFromValidatedSettings(this._validatedOptions, partialEnv.pixelRatio, this.isSimpleWidget);
        const fontInfo = this._readFontInfo(bareFontInfo);
        const env = {
            memory: this._computeOptionsMemory,
            outerWidth: partialEnv.outerWidth,
            outerHeight: partialEnv.outerHeight - this._reservedHeight,
            fontInfo: fontInfo,
            extraEditorClassName: partialEnv.extraEditorClassName,
            isDominatedByLongLines: this._isDominatedByLongLines,
            viewLineCount: this._viewLineCount,
            lineNumbersDigitCount: this._lineNumbersDigitCount,
            emptySelectionClipboard: partialEnv.emptySelectionClipboard,
            pixelRatio: partialEnv.pixelRatio,
            tabFocusMode: this._validatedOptions.get(164 /* EditorOption.tabFocusMode */) || TabFocus.getTabFocusMode(),
            inputMode: InputMode.getInputMode(),
            accessibilitySupport: partialEnv.accessibilitySupport,
            glyphMarginDecorationLaneCount: this._glyphMarginDecorationLaneCount,
            editContextSupported: partialEnv.editContextSupported
        };
        return EditorOptionsUtil.computeOptions(this._validatedOptions, env);
    }
    _readEnvConfiguration() {
        return {
            extraEditorClassName: getExtraEditorClassName(),
            outerWidth: this._containerObserver.getWidth(),
            outerHeight: this._containerObserver.getHeight(),
            emptySelectionClipboard: browser.isWebKit || browser.isFirefox,
            pixelRatio: PixelRatio.getInstance(getWindowById(this._targetWindowId, true).window).value,
            // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
            editContextSupported: typeof globalThis.EditContext === 'function',
            accessibilitySupport: (this._accessibilityService.isScreenReaderOptimized()
                ? 2 /* AccessibilitySupport.Enabled */
                : this._accessibilityService.getAccessibilitySupport())
        };
    }
    _readFontInfo(bareFontInfo) {
        return FontMeasurements.readFontInfo(getWindowById(this._targetWindowId, true).window, bareFontInfo);
    }
    getRawOptions() {
        return this._rawOptions;
    }
    updateOptions(_newOptions) {
        const newOptions = deepCloneAndMigrateOptions(_newOptions);
        const didChange = EditorOptionsUtil.applyUpdate(this._rawOptions, newOptions);
        if (!didChange) {
            return;
        }
        this._validatedOptions = EditorOptionsUtil.validateOptions(this._rawOptions);
        this._recomputeOptions();
    }
    observeContainer(dimension) {
        this._containerObserver.observe(dimension);
    }
    setIsDominatedByLongLines(isDominatedByLongLines) {
        if (this._isDominatedByLongLines === isDominatedByLongLines) {
            return;
        }
        this._isDominatedByLongLines = isDominatedByLongLines;
        this._recomputeOptions();
    }
    setModelLineCount(modelLineCount) {
        const lineNumbersDigitCount = digitCount(modelLineCount);
        if (this._lineNumbersDigitCount === lineNumbersDigitCount) {
            return;
        }
        this._lineNumbersDigitCount = lineNumbersDigitCount;
        this._recomputeOptions();
    }
    setViewLineCount(viewLineCount) {
        if (this._viewLineCount === viewLineCount) {
            return;
        }
        this._viewLineCount = viewLineCount;
        this._recomputeOptions();
    }
    setReservedHeight(reservedHeight) {
        if (this._reservedHeight === reservedHeight) {
            return;
        }
        this._reservedHeight = reservedHeight;
        this._recomputeOptions();
    }
    setGlyphMarginDecorationLaneCount(decorationLaneCount) {
        if (this._glyphMarginDecorationLaneCount === decorationLaneCount) {
            return;
        }
        this._glyphMarginDecorationLaneCount = decorationLaneCount;
        this._recomputeOptions();
    }
};
EditorConfiguration = __decorate([
    __param(4, IAccessibilityService)
], EditorConfiguration);
export { EditorConfiguration };
function digitCount(n) {
    let r = 0;
    while (n) {
        n = Math.floor(n / 10);
        r++;
    }
    return r ? r : 1;
}
function getExtraEditorClassName() {
    let extra = '';
    if (browser.isSafari || browser.isWebkitWebView) {
        // See https://github.com/microsoft/vscode/issues/108822
        extra += 'no-minimap-shadow ';
        extra += 'enable-user-select ';
    }
    else {
        // Use user-select: none in all browsers except Safari and native macOS WebView
        extra += 'no-user-select ';
    }
    if (platform.isMacintosh) {
        extra += 'mac ';
    }
    return extra;
}
class ValidatedEditorOptions {
    constructor() {
        this._values = [];
    }
    _read(option) {
        return this._values[option];
    }
    get(id) {
        return this._values[id];
    }
    _write(option, value) {
        this._values[option] = value;
    }
}
export class ComputedEditorOptions {
    constructor() {
        this._values = [];
    }
    _read(id) {
        if (id >= this._values.length) {
            throw new Error('Cannot read uninitialized value');
        }
        return this._values[id];
    }
    get(id) {
        return this._read(id);
    }
    _write(id, value) {
        this._values[id] = value;
    }
}
class EditorOptionsUtil {
    static validateOptions(options) {
        const result = new ValidatedEditorOptions();
        for (const editorOption of editorOptionsRegistry) {
            const value = (editorOption.name === '_never_' ? undefined : options[editorOption.name]);
            result._write(editorOption.id, editorOption.validate(value));
        }
        return result;
    }
    static computeOptions(options, env) {
        const result = new ComputedEditorOptions();
        for (const editorOption of editorOptionsRegistry) {
            result._write(editorOption.id, editorOption.compute(env, result, options._read(editorOption.id)));
        }
        return result;
    }
    static _deepEquals(a, b) {
        if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) {
            return a === b;
        }
        if (Array.isArray(a) || Array.isArray(b)) {
            return (Array.isArray(a) && Array.isArray(b) ? arrays.equals(a, b) : false);
        }
        if (Object.keys(a).length !== Object.keys(b).length) {
            return false;
        }
        for (const key in a) {
            if (!EditorOptionsUtil._deepEquals(a[key], b[key])) {
                return false;
            }
        }
        return true;
    }
    static checkEquals(a, b) {
        const result = [];
        let somethingChanged = false;
        for (const editorOption of editorOptionsRegistry) {
            const changed = !EditorOptionsUtil._deepEquals(a._read(editorOption.id), b._read(editorOption.id));
            result[editorOption.id] = changed;
            if (changed) {
                somethingChanged = true;
            }
        }
        return (somethingChanged ? new ConfigurationChangedEvent(result) : null);
    }
    /**
     * Returns true if something changed.
     * Modifies `options`.
    */
    static applyUpdate(options, update) {
        let changed = false;
        for (const editorOption of editorOptionsRegistry) {
            if (update.hasOwnProperty(editorOption.name)) {
                const result = editorOption.applyUpdate(options[editorOption.name], update[editorOption.name]);
                options[editorOption.name] = result.newValue;
                changed = changed || result.didChange;
            }
        }
        return changed;
    }
}
function deepCloneAndMigrateOptions(_options) {
    const options = objects.deepClone(_options);
    migrateOptions(options);
    return options;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yQ29uZmlndXJhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci9jb25maWcvZWRpdG9yQ29uZmlndXJhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssT0FBTyxNQUFNLGtDQUFrQyxDQUFDO0FBQzVELE9BQU8sS0FBSyxNQUFNLE1BQU0sZ0NBQWdDLENBQUM7QUFDekQsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMvRCxPQUFPLEtBQUssT0FBTyxNQUFNLGlDQUFpQyxDQUFDO0FBQzNELE9BQU8sS0FBSyxRQUFRLE1BQU0sa0NBQWtDLENBQUM7QUFDN0QsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDL0QsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDekQsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQ3JELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDekMsT0FBTyxFQUFFLG9CQUFvQixFQUFFLHlCQUF5QixFQUFnQixxQkFBcUIsRUFBb0csTUFBTSxzQ0FBc0MsQ0FBQztBQUM5TyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFL0QsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFHdEcsT0FBTyxFQUF3QixxQkFBcUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ3RILE9BQU8sRUFBRSxTQUFTLEVBQUUsYUFBYSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDeEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFN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