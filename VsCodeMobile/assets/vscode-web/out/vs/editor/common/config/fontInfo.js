/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as platform from '../../../base/common/platform.js';
import { EditorZoom } from './editorZoom.js';
/**
 * Determined from empirical observations.
 * @internal
 */
export const GOLDEN_LINE_HEIGHT_RATIO = platform.isMacintosh ? 1.5 : 1.35;
/**
 * @internal
 */
export const MINIMUM_LINE_HEIGHT = 8;
export class BareFontInfo {
    /**
     * @internal
     */
    static _create(fontFamily, fontWeight, fontSize, fontFeatureSettings, fontVariationSettings, lineHeight, letterSpacing, pixelRatio, ignoreEditorZoom) {
        if (lineHeight === 0) {
            lineHeight = GOLDEN_LINE_HEIGHT_RATIO * fontSize;
        }
        else if (lineHeight < MINIMUM_LINE_HEIGHT) {
            // Values too small to be line heights in pixels are in ems.
            lineHeight = lineHeight * fontSize;
        }
        // Enforce integer, minimum constraints
        lineHeight = Math.round(lineHeight);
        if (lineHeight < MINIMUM_LINE_HEIGHT) {
            lineHeight = MINIMUM_LINE_HEIGHT;
        }
        const editorZoomLevelMultiplier = 1 + (ignoreEditorZoom ? 0 : EditorZoom.getZoomLevel() * 0.1);
        fontSize *= editorZoomLevelMultiplier;
        lineHeight *= editorZoomLevelMultiplier;
        if (fontVariationSettings === FONT_VARIATION_TRANSLATE) {
            if (fontWeight === 'normal' || fontWeight === 'bold') {
                fontVariationSettings = FONT_VARIATION_OFF;
            }
            else {
                const fontWeightAsNumber = parseInt(fontWeight, 10);
                fontVariationSettings = `'wght' ${fontWeightAsNumber}`;
                fontWeight = 'normal';
            }
        }
        return new BareFontInfo({
            pixelRatio: pixelRatio,
            fontFamily: fontFamily,
            fontWeight: fontWeight,
            fontSize: fontSize,
            fontFeatureSettings: fontFeatureSettings,
            fontVariationSettings,
            lineHeight: lineHeight,
            letterSpacing: letterSpacing
        });
    }
    /**
     * @internal
     */
    constructor(opts) {
        this._bareFontInfoBrand = undefined;
        this.pixelRatio = opts.pixelRatio;
        this.fontFamily = String(opts.fontFamily);
        this.fontWeight = String(opts.fontWeight);
        this.fontSize = opts.fontSize;
        this.fontFeatureSettings = opts.fontFeatureSettings;
        this.fontVariationSettings = opts.fontVariationSettings;
        this.lineHeight = opts.lineHeight | 0;
        this.letterSpacing = opts.letterSpacing;
    }
    /**
     * @internal
     */
    getId() {
        return `${this.pixelRatio}-${this.fontFamily}-${this.fontWeight}-${this.fontSize}-${this.fontFeatureSettings}-${this.fontVariationSettings}-${this.lineHeight}-${this.letterSpacing}`;
    }
    /**
     * @internal
     */
    getMassagedFontFamily() {
        const fallbackFontFamily = EDITOR_FONT_DEFAULTS.fontFamily;
        const fontFamily = BareFontInfo._wrapInQuotes(this.fontFamily);
        if (fallbackFontFamily && this.fontFamily !== fallbackFontFamily) {
            return `${fontFamily}, ${fallbackFontFamily}`;
        }
        return fontFamily;
    }
    static _wrapInQuotes(fontFamily) {
        if (/[,"']/.test(fontFamily)) {
            // Looks like the font family might be already escaped
            return fontFamily;
        }
        if (/[+ ]/.test(fontFamily)) {
            // Wrap a font family using + or <space> with quotes
            return `"${fontFamily}"`;
        }
        return fontFamily;
    }
}
// change this whenever `FontInfo` members are changed
export const SERIALIZED_FONT_INFO_VERSION = 2;
export class FontInfo extends BareFontInfo {
    /**
     * @internal
     */
    constructor(opts, isTrusted) {
        super(opts);
        this._editorStylingBrand = undefined;
        this.version = SERIALIZED_FONT_INFO_VERSION;
        this.isTrusted = isTrusted;
        this.isMonospace = opts.isMonospace;
        this.typicalHalfwidthCharacterWidth = opts.typicalHalfwidthCharacterWidth;
        this.typicalFullwidthCharacterWidth = opts.typicalFullwidthCharacterWidth;
        this.canUseHalfwidthRightwardsArrow = opts.canUseHalfwidthRightwardsArrow;
        this.spaceWidth = opts.spaceWidth;
        this.middotWidth = opts.middotWidth;
        this.wsmiddotWidth = opts.wsmiddotWidth;
        this.maxDigitWidth = opts.maxDigitWidth;
    }
    /**
     * @internal
     */
    equals(other) {
        return (this.fontFamily === other.fontFamily
            && this.fontWeight === other.fontWeight
            && this.fontSize === other.fontSize
            && this.fontFeatureSettings === other.fontFeatureSettings
            && this.fontVariationSettings === other.fontVariationSettings
            && this.lineHeight === other.lineHeight
            && this.letterSpacing === other.letterSpacing
            && this.typicalHalfwidthCharacterWidth === other.typicalHalfwidthCharacterWidth
            && this.typicalFullwidthCharacterWidth === other.typicalFullwidthCharacterWidth
            && this.canUseHalfwidthRightwardsArrow === other.canUseHalfwidthRightwardsArrow
            && this.spaceWidth === other.spaceWidth
            && this.middotWidth === other.middotWidth
            && this.wsmiddotWidth === other.wsmiddotWidth
            && this.maxDigitWidth === other.maxDigitWidth);
    }
}
/**
 * @internal
 */
export const FONT_VARIATION_OFF = 'normal';
/**
 * @internal
 */
export const FONT_VARIATION_TRANSLATE = 'translate';
/**
 * @internal
 */
export const DEFAULT_WINDOWS_FONT_FAMILY = 'Consolas, \'Courier New\', monospace';
/**
 * @internal
 */
export const DEFAULT_MAC_FONT_FAMILY = 'Menlo, Monaco, \'Courier New\', monospace';
/**
 * @internal
 */
export const DEFAULT_LINUX_FONT_FAMILY = '\'Droid Sans Mono\', \'monospace\', monospace';
/**
 * @internal
 */
export const EDITOR_FONT_DEFAULTS = {
    fontFamily: (platform.isMacintosh ? DEFAULT_MAC_FONT_FAMILY : (platform.isWindows ? DEFAULT_WINDOWS_FONT_FAMILY : DEFAULT_LINUX_FONT_FAMILY)),
    fontWeight: 'normal',
    fontSize: (platform.isMacintosh ? 12 : 14),
    lineHeight: 0,
    letterSpacing: 0,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9udEluZm8uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi9jb25maWcvZm9udEluZm8udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLFFBQVEsTUFBTSxrQ0FBa0MsQ0FBQztBQUU3RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFN0M7OztHQUdHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sd0JBQXdCLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFFMUU7O0dBRUc7QUFDSCxNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBRyxDQUFDLENBQUM7QUFTckMsTUFBTSxPQUFPLFlBQVk7SUFHeEI7O09BRUc7SUFDSSxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQWtCLEVBQUUsVUFBa0IsRUFBRSxRQUFnQixFQUFFLG1CQUEyQixFQUFFLHFCQUE2QixFQUFFLFVBQWtCLEVBQUUsYUFBcUIsRUFBRSxVQUFrQixFQUFFLGdCQUF5QjtRQUNuTyxJQUFJLFVBQVUsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUN0QixVQUFVLEdBQUcsd0JBQXdCLEdBQUcsUUFBUSxDQUFDO1FBQ2xELENBQUM7YUFBTSxJQUFJLFVBQVUsR0FBRyxtQkFBbUIsRUFBRSxDQUFDO1lBQzdDLDREQUE0RDtZQUM1RCxVQUFVLEdBQUcsVUFBVSxHQUFHLFFBQVEsQ0FBQztRQUNwQyxDQUFDO1FBRUQsdUNBQXVDO1FBQ3ZDLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3BDLElBQUksVUFBVSxHQUFHLG1CQUFtQixFQUFFLENBQUM7WUFDdEMsVUFBVSxHQUFHLG1CQUFtQixDQUFDO1FBQ2xDLENBQUM7UUFFRCxNQUFNLHlCQUF5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