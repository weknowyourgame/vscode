/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { equals } from '../../base/common/objects.js';
/**
 * Vertical Lane in the overview ruler of the editor.
 */
export var OverviewRulerLane;
(function (OverviewRulerLane) {
    OverviewRulerLane[OverviewRulerLane["Left"] = 1] = "Left";
    OverviewRulerLane[OverviewRulerLane["Center"] = 2] = "Center";
    OverviewRulerLane[OverviewRulerLane["Right"] = 4] = "Right";
    OverviewRulerLane[OverviewRulerLane["Full"] = 7] = "Full";
})(OverviewRulerLane || (OverviewRulerLane = {}));
/**
 * Vertical Lane in the glyph margin of the editor.
 */
export var GlyphMarginLane;
(function (GlyphMarginLane) {
    GlyphMarginLane[GlyphMarginLane["Left"] = 1] = "Left";
    GlyphMarginLane[GlyphMarginLane["Center"] = 2] = "Center";
    GlyphMarginLane[GlyphMarginLane["Right"] = 3] = "Right";
})(GlyphMarginLane || (GlyphMarginLane = {}));
/**
 * Position in the minimap to render the decoration.
 */
export var MinimapPosition;
(function (MinimapPosition) {
    MinimapPosition[MinimapPosition["Inline"] = 1] = "Inline";
    MinimapPosition[MinimapPosition["Gutter"] = 2] = "Gutter";
})(MinimapPosition || (MinimapPosition = {}));
/**
 * Section header style.
 */
export var MinimapSectionHeaderStyle;
(function (MinimapSectionHeaderStyle) {
    MinimapSectionHeaderStyle[MinimapSectionHeaderStyle["Normal"] = 1] = "Normal";
    MinimapSectionHeaderStyle[MinimapSectionHeaderStyle["Underlined"] = 2] = "Underlined";
})(MinimapSectionHeaderStyle || (MinimapSectionHeaderStyle = {}));
/**
 * Text Direction for a decoration.
 */
export var TextDirection;
(function (TextDirection) {
    TextDirection[TextDirection["LTR"] = 0] = "LTR";
    TextDirection[TextDirection["RTL"] = 1] = "RTL";
})(TextDirection || (TextDirection = {}));
export var InjectedTextCursorStops;
(function (InjectedTextCursorStops) {
    InjectedTextCursorStops[InjectedTextCursorStops["Both"] = 0] = "Both";
    InjectedTextCursorStops[InjectedTextCursorStops["Right"] = 1] = "Right";
    InjectedTextCursorStops[InjectedTextCursorStops["Left"] = 2] = "Left";
    InjectedTextCursorStops[InjectedTextCursorStops["None"] = 3] = "None";
})(InjectedTextCursorStops || (InjectedTextCursorStops = {}));
/**
 * End of line character preference.
 */
export var EndOfLinePreference;
(function (EndOfLinePreference) {
    /**
     * Use the end of line character identified in the text buffer.
     */
    EndOfLinePreference[EndOfLinePreference["TextDefined"] = 0] = "TextDefined";
    /**
     * Use line feed (\n) as the end of line character.
     */
    EndOfLinePreference[EndOfLinePreference["LF"] = 1] = "LF";
    /**
     * Use carriage return and line feed (\r\n) as the end of line character.
     */
    EndOfLinePreference[EndOfLinePreference["CRLF"] = 2] = "CRLF";
})(EndOfLinePreference || (EndOfLinePreference = {}));
/**
 * The default end of line to use when instantiating models.
 */
export var DefaultEndOfLine;
(function (DefaultEndOfLine) {
    /**
     * Use line feed (\n) as the end of line character.
     */
    DefaultEndOfLine[DefaultEndOfLine["LF"] = 1] = "LF";
    /**
     * Use carriage return and line feed (\r\n) as the end of line character.
     */
    DefaultEndOfLine[DefaultEndOfLine["CRLF"] = 2] = "CRLF";
})(DefaultEndOfLine || (DefaultEndOfLine = {}));
/**
 * End of line character preference.
 */
export var EndOfLineSequence;
(function (EndOfLineSequence) {
    /**
     * Use line feed (\n) as the end of line character.
     */
    EndOfLineSequence[EndOfLineSequence["LF"] = 0] = "LF";
    /**
     * Use carriage return and line feed (\r\n) as the end of line character.
     */
    EndOfLineSequence[EndOfLineSequence["CRLF"] = 1] = "CRLF";
})(EndOfLineSequence || (EndOfLineSequence = {}));
export class TextModelResolvedOptions {
    get originalIndentSize() {
        return this._indentSizeIsTabSize ? 'tabSize' : this.indentSize;
    }
    /**
     * @internal
     */
    constructor(src) {
        this._textModelResolvedOptionsBrand = undefined;
        this.tabSize = Math.max(1, src.tabSize | 0);
        if (src.indentSize === 'tabSize') {
            this.indentSize = this.tabSize;
            this._indentSizeIsTabSize = true;
        }
        else {
            this.indentSize = Math.max(1, src.indentSize | 0);
            this._indentSizeIsTabSize = false;
        }
        this.insertSpaces = Boolean(src.insertSpaces);
        this.defaultEOL = src.defaultEOL | 0;
        this.trimAutoWhitespace = Boolean(src.trimAutoWhitespace);
        this.bracketPairColorizationOptions = src.bracketPairColorizationOptions;
    }
    /**
     * @internal
     */
    equals(other) {
        return (this.tabSize === other.tabSize
            && this._indentSizeIsTabSize === other._indentSizeIsTabSize
            && this.indentSize === other.indentSize
            && this.insertSpaces === other.insertSpaces
            && this.defaultEOL === other.defaultEOL
            && this.trimAutoWhitespace === other.trimAutoWhitespace
            && equals(this.bracketPairColorizationOptions, other.bracketPairColorizationOptions));
    }
    /**
     * @internal
     */
    createChangeEvent(newOpts) {
        return {
            tabSize: this.tabSize !== newOpts.tabSize,
            indentSize: this.indentSize !== newOpts.indentSize,
            insertSpaces: this.insertSpaces !== newOpts.insertSpaces,
            trimAutoWhitespace: this.trimAutoWhitespace !== newOpts.trimAutoWhitespace,
        };
    }
}
export class FindMatch {
    /**
     * @internal
     */
    constructor(range, matches) {
        this._findMatchBrand = undefined;
        this.range = range;
        this.matches = matches;
    }
}
/**
 * Describes the behavior of decorations when typing/editing near their edges.
 * Note: Please do not edit the values, as they very carefully match `DecorationRangeBehavior`
 */
export var TrackedRangeStickiness;
(function (TrackedRangeStickiness) {
    TrackedRangeStickiness[TrackedRangeStickiness["AlwaysGrowsWhenTypingAtEdges"] = 0] = "AlwaysGrowsWhenTypingAtEdges";
    TrackedRangeStickiness[TrackedRangeStickiness["NeverGrowsWhenTypingAtEdges"] = 1] = "NeverGrowsWhenTypingAtEdges";
    TrackedRangeStickiness[TrackedRangeStickiness["GrowsOnlyWhenTypingBefore"] = 2] = "GrowsOnlyWhenTypingBefore";
    TrackedRangeStickiness[TrackedRangeStickiness["GrowsOnlyWhenTypingAfter"] = 3] = "GrowsOnlyWhenTypingAfter";
})(TrackedRangeStickiness || (TrackedRangeStickiness = {}));
/**
 * @internal
 */
export function isITextSnapshot(obj) {
    return (!!obj && typeof obj.read === 'function');
}
/**
 * @internal
 */
export function isITextModel(obj) {
    return Boolean(obj && obj.uri);
}
export var PositionAffinity;
(function (PositionAffinity) {
    /**
     * Prefers the left most position.
    */
    PositionAffinity[PositionAffinity["Left"] = 0] = "Left";
    /**
     * Prefers the right most position.
    */
    PositionAffinity[PositionAffinity["Right"] = 1] = "Right";
    /**
     * No preference.
    */
    PositionAffinity[PositionAffinity["None"] = 2] = "None";
    /**
     * If the given position is on injected text, prefers the position left of it.
    */
    PositionAffinity[PositionAffinity["LeftOfInjectedText"] = 3] = "LeftOfInjectedText";
    /**
     * If the given position is on injected text, prefers the position right of it.
    */
    PositionAffinity[PositionAffinity["RightOfInjectedText"] = 4] = "RightOfInjectedText";
})(PositionAffinity || (PositionAffinity = {}));
/**
 * @internal
 */
export var ModelConstants;
(function (ModelConstants) {
    ModelConstants[ModelConstants["FIRST_LINE_DETECTION_LENGTH_LIMIT"] = 1000] = "FIRST_LINE_DETECTION_LENGTH_LIMIT";
})(ModelConstants || (ModelConstants = {}));
/**
 * @internal
 */
export class ValidAnnotatedEditOperation {
    constructor(identifier, range, text, forceMoveMarkers, isAutoWhitespaceEdit, _isTracked) {
        this.identifier = identifier;
        this.range = range;
        this.text = text;
        this.forceMoveMarkers = forceMoveMarkers;
        this.isAutoWhitespaceEdit = isAutoWhitespaceEdit;
        this._isTracked = _isTracked;
    }
}
/**
 * @internal
 */
export class SearchData {
    constructor(regex, wordSeparators, simpleSearch) {
        this.regex = regex;
        this.wordSeparators = wordSeparators;
        this.simpleSearch = simpleSearch;
    }
}
/**
 * @internal
 */
export class ApplyEditsResult {
    constructor(reverseEdits, changes, trimAutoWhitespaceLineNumbers) {
        this.reverseEdits = reverseEdits;
        this.changes = changes;
        this.trimAutoWhitespaceLineNumbers = trimAutoWhitespaceLineNumbers;
    }
}
/**
 * @internal
 */
export function shouldSynchronizeModel(model) {
    return (!model.isTooLargeForSyncing() && !model.isForSimpleWidget);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kZWwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi9tb2RlbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUtoRyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUF1QnREOztHQUVHO0FBQ0gsTUFBTSxDQUFOLElBQVksaUJBS1g7QUFMRCxXQUFZLGlCQUFpQjtJQUM1Qix5REFBUSxDQUFBO0lBQ1IsNkRBQVUsQ0FBQTtJQUNWLDJEQUFTLENBQUE7SUFDVCx5REFBUSxDQUFBO0FBQ1QsQ0FBQyxFQUxXLGlCQUFpQixLQUFqQixpQkFBaUIsUUFLNUI7QUFFRDs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFZLGVBSVg7QUFKRCxXQUFZLGVBQWU7SUFDMUIscURBQVEsQ0FBQTtJQUNSLHlEQUFVLENBQUE7SUFDVix1REFBUyxDQUFBO0FBQ1YsQ0FBQyxFQUpXLGVBQWUsS0FBZixlQUFlLFFBSTFCO0FBMEJEOztHQUVHO0FBQ0gsTUFBTSxDQUFOLElBQWtCLGVBR2pCO0FBSEQsV0FBa0IsZUFBZTtJQUNoQyx5REFBVSxDQUFBO0lBQ1YseURBQVUsQ0FBQTtBQUNYLENBQUMsRUFIaUIsZUFBZSxLQUFmLGVBQWUsUUFHaEM7QUFFRDs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFrQix5QkFHakI7QUFIRCxXQUFrQix5QkFBeUI7SUFDMUMsNkVBQVUsQ0FBQTtJQUNWLHFGQUFjLENBQUE7QUFDZixDQUFDLEVBSGlCLHlCQUF5QixLQUF6Qix5QkFBeUIsUUFHMUM7QUFtT0Q7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBWSxhQUlYO0FBSkQsV0FBWSxhQUFhO0lBQ3hCLCtDQUFPLENBQUE7SUFFUCwrQ0FBTyxDQUFBO0FBQ1IsQ0FBQyxFQUpXLGFBQWEsS0FBYixhQUFhLFFBSXhCO0FBdUNELE1BQU0sQ0FBTixJQUFZLHVCQUtY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