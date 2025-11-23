/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Position } from '../core/position.js';
import { Range } from '../core/range.js';
import { filterFontDecorations, filterValidationDecorations } from '../config/editorOptions.js';
import { isModelDecorationVisible, ViewModelDecoration } from './viewModelDecoration.js';
import { InlineDecoration } from './inlineDecorations.js';
export class ViewModelDecorations {
    constructor(editorId, model, configuration, linesCollection, coordinatesConverter) {
        this.editorId = editorId;
        this.model = model;
        this.configuration = configuration;
        this._linesCollection = linesCollection;
        this._coordinatesConverter = coordinatesConverter;
        this._decorationsCache = Object.create(null);
        this._cachedModelDecorationsResolver = null;
        this._cachedModelDecorationsResolverViewRange = null;
    }
    _clearCachedModelDecorationsResolver() {
        this._cachedModelDecorationsResolver = null;
        this._cachedModelDecorationsResolverViewRange = null;
    }
    dispose() {
        this._decorationsCache = Object.create(null);
        this._clearCachedModelDecorationsResolver();
    }
    reset() {
        this._decorationsCache = Object.create(null);
        this._clearCachedModelDecorationsResolver();
    }
    onModelDecorationsChanged() {
        this._decorationsCache = Object.create(null);
        this._clearCachedModelDecorationsResolver();
    }
    onLineMappingChanged() {
        this._decorationsCache = Object.create(null);
        this._clearCachedModelDecorationsResolver();
    }
    _getOrCreateViewModelDecoration(modelDecoration) {
        const id = modelDecoration.id;
        let r = this._decorationsCache[id];
        if (!r) {
            const modelRange = modelDecoration.range;
            const options = modelDecoration.options;
            let viewRange;
            if (options.isWholeLine) {
                const start = this._coordinatesConverter.convertModelPositionToViewPosition(new Position(modelRange.startLineNumber, 1), 0 /* PositionAffinity.Left */, false, true);
                const end = this._coordinatesConverter.convertModelPositionToViewPosition(new Position(modelRange.endLineNumber, this.model.getLineMaxColumn(modelRange.endLineNumber)), 1 /* PositionAffinity.Right */);
                viewRange = new Range(start.lineNumber, start.column, end.lineNumber, end.column);
            }
            else {
                // For backwards compatibility reasons, we want injected text before any decoration.
                // Thus, move decorations to the right.
                viewRange = this._coordinatesConverter.convertModelRangeToViewRange(modelRange, 1 /* PositionAffinity.Right */);
            }
            r = new ViewModelDecoration(viewRange, options);
            this._decorationsCache[id] = r;
        }
        return r;
    }
    getMinimapDecorationsInRange(range) {
        return this._getDecorationsInRange(range, true, false).decorations;
    }
    getDecorationsViewportData(viewRange) {
        let cacheIsValid = (this._cachedModelDecorationsResolver !== null);
        cacheIsValid = cacheIsValid && (viewRange.equalsRange(this._cachedModelDecorationsResolverViewRange));
        if (!cacheIsValid) {
            this._cachedModelDecorationsResolver = this._getDecorationsInRange(viewRange, false, false);
            this._cachedModelDecorationsResolverViewRange = viewRange;
        }
        return this._cachedModelDecorationsResolver;
    }
    getDecorationsOnLine(lineNumber, onlyMinimapDecorations = false, onlyMarginDecorations = false) {
        const range = new Range(lineNumber, this._linesCollection.getViewLineMinColumn(lineNumber), lineNumber, this._linesCollection.getViewLineMaxColumn(lineNumber));
        return this._getDecorationsInRange(range, onlyMinimapDecorations, onlyMarginDecorations);
    }
    _getDecorationsInRange(viewRange, onlyMinimapDecorations, onlyMarginDecorations) {
        const modelDecorations = this._linesCollection.getDecorationsInRange(viewRange, this.editorId, filterValidationDecorations(this.configuration.options), filterFontDecorations(this.configuration.options), onlyMinimapDecorations, onlyMarginDecorations);
        const startLineNumber = viewRange.startLineNumber;
        const endLineNumber = viewRange.endLineNumber;
        const decorationsInViewport = [];
        let decorationsInViewportLen = 0;
        const inlineDecorations = [];
        for (let j = startLineNumber; j <= endLineNumber; j++) {
            inlineDecorations[j - startLineNumber] = [];
        }
        let hasVariableFonts = false;
        for (let i = 0, len = modelDecorations.length; i < len; i++) {
            const modelDecoration = modelDecorations[i];
            const decorationOptions = modelDecoration.options;
            if (!isModelDecorationVisible(this.model, modelDecoration)) {
                continue;
            }
            const viewModelDecoration = this._getOrCreateViewModelDecoration(modelDecoration);
            const viewRange = viewModelDecoration.range;
            decorationsInViewport[decorationsInViewportLen++] = viewModelDecoration;
            if (decorationOptions.inlineClassName) {
                const inlineDecoration = new InlineDecoration(viewRange, decorationOptions.inlineClassName, decorationOptions.inlineClassNameAffectsLetterSpacing ? 3 /* InlineDecorationType.RegularAffectingLetterSpacing */ : 0 /* InlineDecorationType.Regular */);
                const intersectedStartLineNumber = Math.max(startLineNumber, viewRange.startLineNumber);
                const intersectedEndLineNumber = Math.min(endLineNumber, viewRange.endLineNumber);
                for (let j = intersectedStartLineNumber; j <= intersectedEndLineNumber; j++) {
                    inlineDecorations[j - startLineNumber].push(inlineDecoration);
                }
            }
            if (decorationOptions.beforeContentClassName) {
                if (startLineNumber <= viewRange.startLineNumber && viewRange.startLineNumber <= endLineNumber) {
                    const inlineDecoration = new InlineDecoration(new Range(viewRange.startLineNumber, viewRange.startColumn, viewRange.startLineNumber, viewRange.startColumn), decorationOptions.beforeContentClassName, 1 /* InlineDecorationType.Before */);
                    inlineDecorations[viewRange.startLineNumber - startLineNumber].push(inlineDecoration);
                }
            }
            if (decorationOptions.afterContentClassName) {
                if (startLineNumber <= viewRange.endLineNumber && viewRange.endLineNumber <= endLineNumber) {
                    const inlineDecoration = new InlineDecoration(new Range(viewRange.endLineNumber, viewRange.endColumn, viewRange.endLineNumber, viewRange.endColumn), decorationOptions.afterContentClassName, 2 /* InlineDecorationType.After */);
                    inlineDecorations[viewRange.endLineNumber - startLineNumber].push(inlineDecoration);
                }
            }
            if (decorationOptions.affectsFont) {
                hasVariableFonts = true;
            }
        }
        return {
            decorations: decorationsInViewport,
            inlineDecorations: inlineDecorations,
            hasVariableFonts
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld01vZGVsRGVjb3JhdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi92aWV3TW9kZWwvdmlld01vZGVsRGVjb3JhdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQy9DLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUl6QyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUNoRyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUN6RixPQUFPLEVBQUUsZ0JBQWdCLEVBQXdCLE1BQU0sd0JBQXdCLENBQUM7QUFxQmhGLE1BQU0sT0FBTyxvQkFBb0I7SUFhaEMsWUFBWSxRQUFnQixFQUFFLEtBQWlCLEVBQUUsYUFBbUMsRUFBRSxlQUFnQyxFQUFFLG9CQUEyQztRQUNsSyxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNuQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsZUFBZSxDQUFDO1FBQ3hDLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxvQkFBb0IsQ0FBQztRQUNsRCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QyxJQUFJLENBQUMsK0JBQStCLEdBQUcsSUFBSSxDQUFDO1FBQzVDLElBQUksQ0FBQyx3Q0FBd0MsR0FBRyxJQUFJLENBQUM7SUFDdEQsQ0FBQztJQUVPLG9DQUFvQztRQUMzQyxJQUFJLENBQUMsK0JBQStCLEdB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