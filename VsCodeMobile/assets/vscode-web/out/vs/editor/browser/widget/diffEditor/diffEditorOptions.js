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
import { derived, derivedConstOnceDefined, observableFromEvent, observableValue } from '../../../../base/common/observable.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { diffEditorDefaultOptions } from '../../../common/config/diffEditor.js';
import { clampedFloat, clampedInt, boolean as validateBooleanOption, stringSet as validateStringSetOption } from '../../../common/config/editorOptions.js';
import { allowsTrueInlineDiffRendering } from './components/diffEditorViewZones/diffEditorViewZones.js';
let DiffEditorOptions = class DiffEditorOptions {
    get editorOptions() { return this._options; }
    constructor(options, _accessibilityService) {
        this._accessibilityService = _accessibilityService;
        this._diffEditorWidth = observableValue(this, 0);
        this._screenReaderMode = observableFromEvent(this, this._accessibilityService.onDidChangeScreenReaderOptimized, () => this._accessibilityService.isScreenReaderOptimized());
        this.couldShowInlineViewBecauseOfSize = derived(this, reader => this._options.read(reader).renderSideBySide && this._diffEditorWidth.read(reader) <= this._options.read(reader).renderSideBySideInlineBreakpoint);
        this.renderOverviewRuler = derived(this, reader => this._options.read(reader).renderOverviewRuler);
        this.renderSideBySide = derived(this, reader => {
            if (this.compactMode.read(reader)) {
                if (this.shouldRenderInlineViewInSmartMode.read(reader)) {
                    return false;
                }
            }
            return this._options.read(reader).renderSideBySide
                && !(this._options.read(reader).useInlineViewWhenSpaceIsLimited && this.couldShowInlineViewBecauseOfSize.read(reader) && !this._screenReaderMode.read(reader));
        });
        this.readOnly = derived(this, reader => this._options.read(reader).readOnly);
        this.shouldRenderOldRevertArrows = derived(this, reader => {
            if (!this._options.read(reader).renderMarginRevertIcon) {
                return false;
            }
            if (!this.renderSideBySide.read(reader)) {
                return false;
            }
            if (this.readOnly.read(reader)) {
                return false;
            }
            if (this.shouldRenderGutterMenu.read(reader)) {
                return false;
            }
            return true;
        });
        this.shouldRenderGutterMenu = derived(this, reader => this._options.read(reader).renderGutterMenu);
        this.renderIndicators = derived(this, reader => this._options.read(reader).renderIndicators);
        this.enableSplitViewResizing = derived(this, reader => this._options.read(reader).enableSplitViewResizing);
        this.splitViewDefaultRatio = derived(this, reader => this._options.read(reader).splitViewDefaultRatio);
        this.ignoreTrimWhitespace = derived(this, reader => this._options.read(reader).ignoreTrimWhitespace);
        this.maxComputationTimeMs = derived(this, reader => this._options.read(reader).maxComputationTime);
        this.showMoves = derived(this, reader => this._options.read(reader).experimental.showMoves && this.renderSideBySide.read(reader));
        this.isInEmbeddedEditor = derived(this, reader => this._options.read(reader).isInEmbeddedEditor);
        this.diffWordWrap = derived(this, reader => this._options.read(reader).diffWordWrap);
        this.originalEditable = derived(this, reader => this._options.read(reader).originalEditable);
        this.diffCodeLens = derived(this, reader => this._options.read(reader).diffCodeLens);
        this.accessibilityVerbose = derived(this, reader => this._options.read(reader).accessibilityVerbose);
        this.diffAlgorithm = derived(this, reader => this._options.read(reader).diffAlgorithm);
        this.showEmptyDecorations = derived(this, reader => this._options.read(reader).experimental.showEmptyDecorations);
        this.onlyShowAccessibleDiffViewer = derived(this, reader => this._options.read(reader).onlyShowAccessibleDiffViewer);
        this.compactMode = derived(this, reader => this._options.read(reader).compactMode);
        this.trueInlineDiffRenderingEnabled = derived(this, reader => this._options.read(reader).experimental.useTrueInlineView);
        this.useTrueInlineDiffRendering = derived(this, reader => !this.renderSideBySide.read(reader) && this.trueInlineDiffRenderingEnabled.read(reader));
        this.hideUnchangedRegions = derived(this, reader => this._options.read(reader).hideUnchangedRegions.enabled);
        this.hideUnchangedRegionsRevealLineCount = derived(this, reader => this._options.read(reader).hideUnchangedRegions.revealLineCount);
        this.hideUnchangedRegionsContextLineCount = derived(this, reader => this._options.read(reader).hideUnchangedRegions.contextLineCount);
        this.hideUnchangedRegionsMinimumLineCount = derived(this, reader => this._options.read(reader).hideUnchangedRegions.minimumLineCount);
        this._model = observableValue(this, undefined);
        this.shouldRenderInlineViewInSmartMode = this._model
            .map(this, model => derivedConstOnceDefined(this, reader => {
            const diffs = model?.diff.read(reader);
            return diffs ? isSimpleDiff(diffs, this.trueInlineDiffRenderingEnabled.read(reader)) : undefined;
        }))
            .flatten()
            .map(this, v => !!v);
        this.inlineViewHideOriginalLineNumbers = this.compactMode;
        const optionsCopy = { ...options, ...validateDiffEditorOptions(options, diffEditorDefaultOptions) };
        this._options = observableValue(this, optionsCopy);
    }
    updateOptions(changedOptions) {
        const newDiffEditorOptions = validateDiffEditorOptions(changedOptions, this._options.get());
        const newOptions = { ...this._options.get(), ...changedOptions, ...newDiffEditorOptions };
        this._options.set(newOptions, undefined, { changedOptions: changedOptions });
    }
    setWidth(width) {
        this._diffEditorWidth.set(width, undefined);
    }
    setModel(model) {
        this._model.set(model, undefined);
    }
};
DiffEditorOptions = __decorate([
    __param(1, IAccessibilityService)
], DiffEditorOptions);
export { DiffEditorOptions };
function isSimpleDiff(diff, supportsTrueDiffRendering) {
    return diff.mappings.every(m => isInsertion(m.lineRangeMapping) || isDeletion(m.lineRangeMapping) || (supportsTrueDiffRendering && allowsTrueInlineDiffRendering(m.lineRangeMapping)));
}
function isInsertion(mapping) {
    return mapping.original.length === 0;
}
function isDeletion(mapping) {
    return mapping.modified.length === 0;
}
function validateDiffEditorOptions(options, defaults) {
    return {
        enableSplitViewResizing: validateBooleanOption(options.enableSplitViewResizing, defaults.enableSplitViewResizing),
        splitViewDefaultRatio: clampedFloat(options.splitViewDefaultRatio, 0.5, 0.1, 0.9),
        renderSideBySide: validateBooleanOption(options.renderSideBySide, defaults.renderSideBySide),
        renderMarginRevertIcon: validateBooleanOption(options.renderMarginRevertIcon, defaults.renderMarginRevertIcon),
        maxComputationTime: clampedInt(options.maxComputationTime, defaults.maxComputationTime, 0, 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */),
        maxFileSize: clampedInt(options.maxFileSize, defaults.maxFileSize, 0, 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */),
        ignoreTrimWhitespace: validateBooleanOption(options.ignoreTrimWhitespace, defaults.ignoreTrimWhitespace),
        renderIndicators: validateBooleanOption(options.renderIndicators, defaults.renderIndicators),
        originalEditable: validateBooleanOption(options.originalEditable, defaults.originalEditable),
        diffCodeLens: validateBooleanOption(options.diffCodeLens, defaults.diffCodeLens),
        renderOverviewRuler: validateBooleanOption(options.renderOverviewRuler, defaults.renderOverviewRuler),
        diffWordWrap: validateStringSetOption(options.diffWordWrap, defaults.diffWordWrap, ['off', 'on', 'inherit']),
        diffAlgorithm: validateStringSetOption(options.diffAlgorithm, defaults.diffAlgorithm, ['legacy', 'advanced'], { 'smart': 'legacy', 'experimental': 'advanced' }),
        accessibilityVerbose: validateBooleanOption(options.accessibilityVerbose, defaults.accessibilityVerbose),
        experimental: {
            showMoves: validateBooleanOption(options.experimental?.showMoves, defaults.experimental.showMoves),
            showEmptyDecorations: validateBooleanOption(options.experimental?.showEmptyDecorations, defaults.experimental.showEmptyDecorations),
            useTrueInlineView: validateBooleanOption(options.experimental?.useTrueInlineView, defaults.experimental.useTrueInlineView),
        },
        hideUnchangedRegions: {
            // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
            enabled: validateBooleanOption(options.hideUnchangedRegions?.enabled ?? options.experimental?.collapseUnchangedRegions, defaults.hideUnchangedRegions.enabled),
            contextLineCount: clampedInt(options.hideUnchangedRegions?.contextLineCount, defaults.hideUnchangedRegions.contextLineCount, 0, 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */),
            minimumLineCount: clampedInt(options.hideUnchangedRegions?.minimumLineCount, defaults.hideUnchangedRegions.minimumLineCount, 0, 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */),
            revealLineCount: clampedInt(options.hideUnchangedRegions?.revealLineCount, defaults.hideUnchangedRegions.revealLineCount, 0, 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */),
        },
        isInEmbeddedEditor: validateBooleanOption(options.isInEmbeddedEditor, defaults.isInEmbeddedEditor),
        onlyShowAccessibleDiffViewer: validateBooleanOption(options.onlyShowAccessibleDiffViewer, defaults.onlyShowAccessibleDiffViewer),
        renderSideBySideInlineBreakpoint: clampedInt(options.renderSideBySideInlineBreakpoint, defaults.renderSideBySideInlineBreakpoint, 0, 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */),
        useInlineViewWhenSpaceIsLimited: validateBooleanOption(options.useInlineViewWhenSpaceIsLimited, defaults.useInlineViewWhenSpaceIsLimited),
        renderGutterMenu: validateBooleanOption(options.renderGutterMenu, defaults.renderGutterMenu),
        compactMode: validateBooleanOption(options.compactMode, defaults.compactMode),
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlmZkVkaXRvck9wdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3IvZGlmZkVkaXRvck9wdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUEyRCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsbUJBQW1CLEVBQUUsZUFBZSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFeEwsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDaEYsT0FBTyxFQUEwRixZQUFZLEVBQUUsVUFBVSxFQUFFLE9BQU8sSUFBSSxxQkFBcUIsRUFBRSxTQUFTLElBQUksdUJBQXVCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUVuUCxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUdqRyxJQUFNLGlCQUFpQixHQUF2QixNQUFNLGlCQUFpQjtJQUc3QixJQUFXLGFBQWEsS0FBZ0YsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQU0vSCxZQUNDLE9BQXFDLEVBQ0cscUJBQTRDO1FBQTVDLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBdUI7UUFFcEYsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGVBQWUsQ0FBUyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDekQsSUFBSSxDQUFDLGlCQUFpQixHQUFHLG1CQUFtQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsZ0NBQWdDLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLHVCQUF1QixFQUFFLENBQUMsQ0FBQztRQUM1SyxJQUFJLENBQUMsZ0NBQWdD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