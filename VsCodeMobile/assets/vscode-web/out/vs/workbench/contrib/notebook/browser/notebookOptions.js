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
import { PixelRatio } from '../../../../base/browser/pixelRatio.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../base/common/observable.js';
import { isObject } from '../../../../base/common/types.js';
import { FontMeasurements } from '../../../../editor/browser/config/fontMeasurements.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { createBareFontInfoFromRawSettings } from '../../../../editor/common/config/fontInfoFromSettings.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { NotebookSetting } from '../common/notebookCommon.js';
import { INotebookExecutionStateService } from '../common/notebookExecutionStateService.js';
const SCROLLABLE_ELEMENT_PADDING_TOP = 18;
export const OutputInnerContainerTopPadding = 4;
const defaultConfigConstants = Object.freeze({
    codeCellLeftMargin: 28,
    cellRunGutter: 32,
    markdownCellTopMargin: 8,
    markdownCellBottomMargin: 8,
    markdownCellLeftMargin: 0,
    markdownCellGutter: 32,
    focusIndicatorLeftMargin: 4
});
const compactConfigConstants = Object.freeze({
    codeCellLeftMargin: 8,
    cellRunGutter: 36,
    markdownCellTopMargin: 6,
    markdownCellBottomMargin: 6,
    markdownCellLeftMargin: 8,
    markdownCellGutter: 36,
    focusIndicatorLeftMargin: 4
});
let NotebookOptions = class NotebookOptions extends Disposable {
    constructor(targetWindow, isReadonly, overrides, configurationService, notebookExecutionStateService, codeEditorService) {
        super();
        this.targetWindow = targetWindow;
        this.isReadonly = isReadonly;
        this.overrides = overrides;
        this.configurationService = configurationService;
        this.notebookExecutionStateService = notebookExecutionStateService;
        this.codeEditorService = codeEditorService;
        this._onDidChangeOptions = this._register(new Emitter());
        this.onDidChangeOptions = this._onDidChangeOptions.event;
        this._editorTopPadding = 12;
        this.previousModelToCompare = observableValue('previousModelToCompare', undefined);
        const showCellStatusBar = this.configurationService.getValue(NotebookSetting.showCellStatusBar);
        const globalToolbar = overrides?.globalToolbar ?? this.configurationService.getValue(NotebookSetting.globalToolbar) ?? true;
        const stickyScrollEnabled = overrides?.stickyScrollEnabled ?? this.configurationService.getValue(NotebookSetting.stickyScrollEnabled) ?? false;
        const stickyScrollMode = this._computeStickyScrollModeOption();
        const consolidatedOutputButton = this.configurationService.getValue(NotebookSetting.consolidatedOutputButton) ?? true;
        const consolidatedRunButton = this.configurationService.getValue(NotebookSetting.consolidatedRunButton) ?? false;
        const dragAndDropEnabled = overrides?.dragAndDropEnabled ?? this.configurationService.getValue(NotebookSetting.dragAndDropEnabled) ?? true;
        const cellToolbarLocation = this.configurationService.getValue(NotebookSetting.cellToolbarLocation) ?? { 'default': 'right' };
        const cellToolbarInteraction = overrides?.cellToolbarInteraction ?? this.configurationService.getValue(NotebookSetting.cellToolbarVisibility);
        const compactView = this.configurationService.getValue(NotebookSetting.compactView) ?? true;
        const focusIndicator = this._computeFocusIndicatorOption();
        const insertToolbarPosition = this._computeInsertToolbarPositionOption(this.isReadonly);
        const insertToolbarAlignment = this._computeInsertToolbarAlignmentOption();
        const showFoldingControls = this._computeShowFoldingControlsOption();
        // const { bottomToolbarGap, bottomToolbarHeight } = this._computeBottomToolbarDimensions(compactView, insertToolbarPosition, insertToolbarAlignment);
        const fontSize = this.configurationService.getValue('editor.fontSize');
        const markupFontSize = this.configurationService.getValue(NotebookSetting.markupFontSize);
        const markdownLineHeight = this.configurationService.getValue(NotebookSetting.markdownLineHeight);
        let editorOptionsCustomizations = this.configurationService.getValue(NotebookSetting.cellEditorOptionsCustomizations) ?? {};
        editorOptionsCustomizations = isObject(editorOptionsCustomizations) ? editorOptionsCustomizations : {};
        const interactiveWindowCollapseCodeCells = this.configurationService.getValue(NotebookSetting.interactiveWindowCollapseCodeCells);
        // TOOD @rebornix remove after a few iterations of deprecated setting
        let outputLineHeightSettingValue;
        const deprecatedOutputLineHeightSetting = this.configurationService.getValue(NotebookSetting.outputLineHeightDeprecated);
        if (deprecatedOutputLineHeightSetting !== undefined) {
            this._migrateDeprecatedSetting(NotebookSetting.outputLineHeightDeprecated, NotebookSetting.outputLineHeight);
            outputLineHeightSettingValue = deprecatedOutputLineHeightSetting;
        }
        else {
            outputLineHeightSettingValue = this.configurationService.getValue(NotebookSetting.outputLineHeight);
        }
        let outputFontSize;
        const deprecatedOutputFontSizeSetting = this.configurationService.getValue(NotebookSetting.outputFontSizeDeprecated);
        if (deprecatedOutputFontSizeSetting !== undefined) {
            this._migrateDeprecatedSetting(NotebookSetting.outputFontSizeDeprecated, NotebookSetting.outputFontSize);
            outputFontSize = deprecatedOutputFontSizeSetting;
        }
        else {
            outputFontSize = this.configurationService.getValue(NotebookSetting.outputFontSize) || fontSize;
        }
        let outputFontFamily;
        const deprecatedOutputFontFamilySetting = this.configurationService.getValue(NotebookSetting.outputFontFamilyDeprecated);
        if (deprecatedOutputFontFamilySetting !== undefined) {
            this._migrateDeprecatedSetting(NotebookSetting.outputFontFamilyDeprecated, NotebookSetting.outputFontFamily);
            outputFontFamily = deprecatedOutputFontFamilySetting;
        }
        else {
            outputFontFamily = this.configurationService.getValue(NotebookSetting.outputFontFamily);
        }
        let outputScrolling;
        const deprecatedOutputScrollingSetting = this.configurationService.getValue(NotebookSetting.outputScrollingDeprecated);
        if (deprecatedOutputScrollingSetting !== undefined) {
            this._migrateDeprecatedSetting(NotebookSetting.outputScrollingDeprecated, NotebookSetting.outputScrolling);
            outputScrolling = deprecatedOutputScrollingSetting;
        }
        else {
            outputScrolling = this.configurationService.getValue(NotebookSetting.outputScrolling);
        }
        const outputLineHeight = this._computeOutputLineHeight(outputLineHeightSettingValue, outputFontSize);
        const outputWordWrap = this.configurationService.getValue(NotebookSetting.outputWordWrap);
        const outputLineLimit = this.configurationService.getValue(NotebookSetting.textOutputLineLimit) ?? 30;
        const linkifyFilePaths = this.configurationService.getValue(NotebookSetting.LinkifyOutputFilePaths) ?? true;
        const minimalErrors = this.configurationService.getValue(NotebookSetting.minimalErrorRendering);
        const markupFontFamily = this.configurationService.getValue(NotebookSetting.markupFontFamily);
        const editorTopPadding = this._computeEditorTopPadding();
        this._layoutConfiguration = {
            ...(compactView ? compactConfigConstants : defaultConfigConstants),
            cellTopMargin: 6,
            cellBottomMargin: 6,
            cellRightMargin: 16,
            cellStatusBarHeight: 22,
            cellOutputPadding: 8,
            markdownPreviewPadding: 8,
            // bottomToolbarHeight: bottomToolbarHeight,
            // bottomToolbarGap: bottomToolbarGap,
            editorToolbarHeight: 0,
            editorTopPadding: editorTopPadding,
            editorBottomPadding: 4,
            editorBottomPaddingWithoutStatusBar: 12,
            collapsedIndicatorHeight: 28,
            showCellStatusBar,
            globalToolbar,
            stickyScrollEnabled,
            stickyScrollMode,
            consolidatedOutputButton,
            consolidatedRunButton,
            dragAndDropEnabled,
            cellToolbarLocation,
            cellToolbarInteraction,
            compactView,
            focusIndicator,
            insertToolbarPosition,
            insertToolbarAlignment,
            showFoldingControls,
            fontSize,
            outputFontSize,
            outputFontFamily,
            outputLineHeight,
            markupFontSize,
            markdownLineHeight,
            editorOptionsCustomizations,
            focusIndicatorGap: 3,
            interactiveWindowCollapseCodeCells,
            markdownFoldHintHeight: 22,
            outputScrolling: outputScrolling,
            outputWordWrap: outputWordWrap,
            outputLineLimit: outputLineLimit,
            outputLinkifyFilePaths: linkifyFilePaths,
            outputMinimalError: minimalErrors,
            markupFontFamily,
            disableRulers: overrides?.disableRulers,
        };
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            this._updateConfiguration(e);
        }));
    }
    updateOptions(isReadonly) {
        if (this.isReadonly !== isReadonly) {
            this.isReadonly = isReadonly;
            this._updateConfiguration({
                affectsConfiguration(configuration) {
                    return configuration === NotebookSetting.insertToolbarLocation;
                },
                source: 7 /* ConfigurationTarget.DEFAULT */,
                affectedKeys: new Set([NotebookSetting.insertToolbarLocation]),
                change: { keys: [NotebookSetting.insertToolbarLocation], overrides: [] },
            });
        }
    }
    _computeEditorTopPadding() {
        let decorationTriggeredAdjustment = false;
        const updateEditorTopPadding = (top) => {
            this._editorTopPadding = top;
            const configuration = Object.assign({}, this._layoutConfiguration);
            configuration.editorTopPadding = this._editorTopPadding;
            this._layoutConfiguration = configuration;
            this._onDidChangeOptions.fire({ editorTopPadding: true });
        };
        const decorationCheckSet = new Set();
        const onDidAddDecorationType = (e) => {
            if (decorationTriggeredAdjustment) {
                return;
            }
            if (decorationCheckSet.has(e)) {
                return;
            }
            try {
                const options = this.codeEditorService.resolveDecorationOptions(e, true);
                if (options.afterContentClassName || options.beforeContentClassName) {
                    const cssRules = this.codeEditorService.resolveDecorationCSSRules(e);
                    if (cssRules !== null) {
                        for (let i = 0; i < cssRules.length; i++) {
                            // The following ways to index into the list are equivalent
                            if ((cssRules[i].selectorText.endsWith('::after') || cssRules[i].selectorText.endsWith('::after'))
                                && cssRules[i].cssText.indexOf('top:') > -1) {
                                // there is a `::before` or `::after` text decoration whose position is above or below current line
                                // we at least make sure that the editor top padding is at least one line
                                const editorOptions = this.configurationService.getValue('editor');
                                updateEditorTopPadding(createBareFontInfoFromRawSettings(editorOptions, PixelRatio.getInstance(this.targetWindow).value).lineHeight + 2);
                                decorationTriggeredAdjustment = true;
                                break;
                            }
                        }
                    }
                }
                decorationCheckSet.add(e);
            }
            catch (_ex) {
                // do not throw and break notebook
            }
        };
        this._register(this.codeEditorService.onDecorationTypeRegistered(onDidAddDecorationType));
        this.codeEditorService.listDecorationTypes().forEach(onDidAddDecorationType);
        return this._editorTopPadding;
    }
    _migrateDeprecatedSetting(deprecatedKey, key) {
        const deprecatedSetting = this.configurationService.inspect(deprecatedKey);
        if (deprecatedSetting.application !== undefined) {
            this.configurationService.updateValue(deprecatedKey, undefined, 1 /* ConfigurationTarget.APPLICATION */);
            this.configurationService.updateValue(key, deprecatedSetting.application.value, 1 /* ConfigurationTarget.APPLICATION */);
        }
        if (deprecatedSetting.user !== undefined) {
            this.configurationService.updateValue(deprecatedKey, undefined, 2 /* ConfigurationTarget.USER */);
            this.configurationService.updateValue(key, deprecatedSetting.user.value, 2 /* ConfigurationTarget.USER */);
        }
        if (deprecatedSetting.userLocal !== undefined) {
            this.configurationService.updateValue(deprecatedKey, undefined, 3 /* ConfigurationTarget.USER_LOCAL */);
            this.configurationService.updateValue(key, deprecatedSetting.userLocal.value, 3 /* ConfigurationTarget.USER_LOCAL */);
        }
        if (deprecatedSetting.userRemote !== undefined) {
            this.configurationService.updateValue(deprecatedKey, undefined, 4 /* ConfigurationTarget.USER_REMOTE */);
            this.configurationService.updateValue(key, deprecatedSetting.userRemote.value, 4 /* ConfigurationTarget.USER_REMOTE */);
        }
        if (deprecatedSetting.workspace !== undefined) {
            this.configurationService.updateValue(deprecatedKey, undefined, 5 /* ConfigurationTarget.WORKSPACE */);
            this.configurationService.updateValue(key, deprecatedSetting.workspace.value, 5 /* ConfigurationTarget.WORKSPACE */);
        }
        if (deprecatedSetting.workspaceFolder !== undefined) {
            this.configurationService.updateValue(deprecatedKey, undefined, 6 /* ConfigurationTarget.WORKSPACE_FOLDER */);
            this.configurationService.updateValue(key, deprecatedSetting.workspaceFolder.value, 6 /* ConfigurationTarget.WORKSPACE_FOLDER */);
        }
    }
    _computeOutputLineHeight(lineHeight, outputFontSize) {
        const minimumLineHeight = 9;
        if (lineHeight === 0) {
            // use editor line height
            const editorOptions = this.configurationService.getValue('editor');
            const fontInfo = FontMeasurements.readFontInfo(this.targetWindow, createBareFontInfoFromRawSettings(editorOptions, PixelRatio.getInstance(this.targetWindow).value));
            lineHeight = fontInfo.lineHeight;
        }
        else if (lineHeight < minimumLineHeight) {
            // Values too small to be line heights in pixels are in ems.
            let fontSize = outputFontSize;
            if (fontSize === 0) {
                fontSize = this.configurationService.getValue('editor.fontSize');
            }
            lineHeight = lineHeight * fontSize;
        }
        // Enforce integer, minimum constraints
        lineHeight = Math.round(lineHeight);
        if (lineHeight < minimumLineHeight) {
            lineHeight = minimumLineHeight;
        }
        return lineHeight;
    }
    _updateConfiguration(e) {
        const cellStatusBarVisibility = e.affectsConfiguration(NotebookSetting.showCellStatusBar);
        const cellToolbarLocation = e.affectsConfiguration(NotebookSetting.cellToolbarLocation);
        const cellToolbarInteraction = e.affectsConfiguration(NotebookSetting.cellToolbarVisibility);
        const compactView = e.affectsConfiguration(NotebookSetting.compactView);
        const focusIndicator = e.affectsConfiguration(NotebookSetting.focusIndicator);
        const insertToolbarPosition = e.affectsConfiguration(NotebookSetting.insertToolbarLocation);
        const insertToolbarAlignment = e.affectsConfiguration(NotebookSetting.experimentalInsertToolbarAlignment);
        const globalToolbar = e.affectsConfiguration(NotebookSetting.globalToolbar);
        const stickyScrollEnabled = e.affectsConfiguration(NotebookSetting.stickyScrollEnabled);
        const stickyScrollMode = e.affectsConfiguration(NotebookSetting.stickyScrollMode);
        const consolidatedOutputButton = e.affectsConfiguration(NotebookSetting.consolidatedOutputButton);
        const consolidatedRunButton = e.affectsConfiguration(NotebookSetting.consolidatedRunButton);
        const showFoldingControls = e.affectsConfiguration(NotebookSetting.showFoldingControls);
        const dragAndDropEnabled = e.affectsConfiguration(NotebookSetting.dragAndDropEnabled);
        const fontSize = e.affectsConfiguration('editor.fontSize');
        const outputFontSize = e.affectsConfiguration(NotebookSetting.outputFontSize);
        const markupFontSize = e.affectsConfiguration(NotebookSetting.markupFontSize);
        const markdownLineHeight = e.affectsConfiguration(NotebookSetting.markdownLineHeight);
        const fontFamily = e.affectsConfiguration('editor.fontFamily');
        const outputFontFamily = e.affectsConfiguration(NotebookSetting.outputFontFamily);
        const editorOptionsCustomizations = e.affectsConfiguration(NotebookSetting.cellEditorOptionsCustomizations);
        const interactiveWindowCollapseCodeCells = e.affectsConfiguration(NotebookSetting.interactiveWindowCollapseCodeCells);
        const outputLineHeight = e.affectsConfiguration(NotebookSetting.outputLineHeight);
        const outputScrolling = e.affectsConfiguration(NotebookSetting.outputScrolling);
        const outputWordWrap = e.affectsConfiguration(NotebookSetting.outputWordWrap);
        const outputLinkifyFilePaths = e.affectsConfiguration(NotebookSetting.LinkifyOutputFilePaths);
        const minimalError = e.affectsConfiguration(NotebookSetting.minimalErrorRendering);
        const markupFontFamily = e.affectsConfiguration(NotebookSetting.markupFontFamily);
        if (!cellStatusBarVisibility
            && !cellToolbarLocation
            && !cellToolbarInteraction
            && !compactView
            && !focusIndicator
            && !insertToolbarPosition
            && !insertToolbarAlignment
            && !globalToolbar
            && !stickyScrollEnabled
            && !stickyScrollMode
            && !consolidatedOutputButton
            && !consolidatedRunButton
            && !showFoldingControls
            && !dragAndDropEnabled
            && !fontSize
            && !outputFontSize
            && !markupFontSize
            && !markdownLineHeight
            && !fontFamily
            && !outputFontFamily
            && !editorOptionsCustomizations
            && !interactiveWindowCollapseCodeCells
            && !outputLineHeight
            && !outputScrolling
            && !outputWordWrap
            && !outputLinkifyFilePaths
            && !minimalError
            && !markupFontFamily) {
            return;
        }
        let configuration = Object.assign({}, this._layoutConfiguration);
        if (cellStatusBarVisibility) {
            configuration.showCellStatusBar = this.configurationService.getValue(NotebookSetting.showCellStatusBar);
        }
        if (cellToolbarLocation) {
            configuration.cellToolbarLocation = this.configurationService.getValue(NotebookSetting.cellToolbarLocation) ?? { 'default': 'right' };
        }
        if (cellToolbarInteraction && !this.overrides?.cellToolbarInteraction) {
            configuration.cellToolbarInteraction = this.configurationService.getValue(NotebookSetting.cellToolbarVisibility);
        }
        if (focusIndicator) {
            configuration.focusIndicator = this._computeFocusIndicatorOption();
        }
        if (compactView) {
            const compactViewValue = this.configurationService.getValue(NotebookSetting.compactView) ?? true;
            configuration = Object.assign(configuration, {
                ...(compactViewValue ? compactConfigConstants : defaultConfigConstants),
            });
            configuration.compactView = compactViewValue;
        }
        if (insertToolbarAlignment) {
            configuration.insertToolbarAlignment = this._computeInsertToolbarAlignmentOption();
        }
        if (insertToolbarPosition) {
            configuration.insertToolbarPosition = this._computeInsertToolbarPositionOption(this.isReadonly);
        }
        if (globalToolbar && this.overrides?.globalToolbar === undefined) {
            configuration.globalToolbar = this.configurationService.getValue(NotebookSetting.globalToolbar) ?? true;
        }
        if (stickyScrollEnabled && this.overrides?.stickyScrollEnabled === undefined) {
            configuration.stickyScrollEnabled = this.configurationService.getValue(NotebookSetting.stickyScrollEnabled) ?? false;
        }
        if (stickyScrollMode) {
            configuration.stickyScrollMode = this.configurationService.getValue(NotebookSetting.stickyScrollMode) ?? 'flat';
        }
        if (consolidatedOutputButton) {
            configuration.consolidatedOutputButton = this.configurationService.getValue(NotebookSetting.consolidatedOutputButton) ?? true;
        }
        if (consolidatedRunButton) {
            configuration.consolidatedRunButton = this.configurationService.getValue(NotebookSetting.consolidatedRunButton) ?? true;
        }
        if (showFoldingControls) {
            configuration.showFoldingControls = this._computeShowFoldingControlsOption();
        }
        if (dragAndDropEnabled) {
            configuration.dragAndDropEnabled = this.configurationService.getValue(NotebookSetting.dragAndDropEnabled) ?? true;
        }
        if (fontSize) {
            configuration.fontSize = this.configurationService.getValue('editor.fontSize');
        }
        if (outputFontSize || fontSize) {
            configuration.outputFontSize = this.configurationService.getValue(NotebookSetting.outputFontSize) || configuration.fontSize;
        }
        if (markupFontSize) {
            configuration.markupFontSize = this.configurationService.getValue(NotebookSetting.markupFontSize);
        }
        if (markdownLineHeight) {
            configuration.markdownLineHeight = this.configurationService.getValue(NotebookSetting.markdownLineHeight);
        }
        if (outputFontFamily) {
            configuration.outputFontFamily = this.configurationService.getValue(NotebookSetting.outputFontFamily);
        }
        if (editorOptionsCustomizations) {
            configuration.editorOptionsCustomizations = this.configurationService.getValue(NotebookSetting.cellEditorOptionsCustomizations);
        }
        if (interactiveWindowCollapseCodeCells) {
            configuration.interactiveWindowCollapseCodeCells = this.configurationService.getValue(NotebookSetting.interactiveWindowCollapseCodeCells);
        }
        if (outputLineHeight || fontSize || outputFontSize) {
            const lineHeight = this.configurationService.getValue(NotebookSetting.outputLineHeight);
            configuration.outputLineHeight = this._computeOutputLineHeight(lineHeight, configuration.outputFontSize);
        }
        if (outputWordWrap) {
            configuration.outputWordWrap = this.configurationService.getValue(NotebookSetting.outputWordWrap);
        }
        if (outputScrolling) {
            configuration.outputScrolling = this.configurationService.getValue(NotebookSetting.outputScrolling);
        }
        if (outputLinkifyFilePaths) {
            configuration.outputLinkifyFilePaths = this.configurationService.getValue(NotebookSetting.LinkifyOutputFilePaths);
        }
        if (minimalError) {
            configuration.outputMinimalError = this.configurationService.getValue(NotebookSetting.minimalErrorRendering);
        }
        if (markupFontFamily) {
            configuration.markupFontFamily = this.configurationService.getValue(NotebookSetting.markupFontFamily);
        }
        this._layoutConfiguration = Object.freeze(configuration);
        // trigger event
        this._onDidChangeOptions.fire({
            cellStatusBarVisibility,
            cellToolbarLocation,
            cellToolbarInteraction,
            compactView,
            focusIndicator,
            insertToolbarPosition,
            insertToolbarAlignment,
            globalToolbar,
            stickyScrollEnabled,
            stickyScrollMode,
            showFoldingControls,
            consolidatedOutputButton,
            consolidatedRunButton,
            dragAndDropEnabled,
            fontSize,
            outputFontSize,
            markupFontSize,
            markdownLineHeight,
            fontFamily,
            outputFontFamily,
            editorOptionsCustomizations,
            interactiveWindowCollapseCodeCells,
            outputLineHeight,
            outputScrolling,
            outputWordWrap,
            outputLinkifyFilePaths,
            minimalError,
            markupFontFamily
        });
    }
    _computeInsertToolbarPositionOption(isReadOnly) {
        return isReadOnly ? 'hidden' : this.configurationService.getValue(NotebookSetting.insertToolbarLocation) ?? 'both';
    }
    _computeInsertToolbarAlignmentOption() {
        return this.configurationService.getValue(NotebookSetting.experimentalInsertToolbarAlignment) ?? 'center';
    }
    _computeShowFoldingControlsOption() {
        return this.configurationService.getValue(NotebookSetting.showFoldingControls) ?? 'mouseover';
    }
    _computeFocusIndicatorOption() {
        return this.configurationService.getValue(NotebookSetting.focusIndicator) ?? 'gutter';
    }
    _computeStickyScrollModeOption() {
        return this.configurationService.getValue(NotebookSetting.stickyScrollMode) ?? 'flat';
    }
    getCellCollapseDefault() {
        return this._layoutConfiguration.interactiveWindowCollapseCodeCells === 'never' ?
            {
                codeCell: {
                    inputCollapsed: false
                }
            } : {
            codeCell: {
                inputCollapsed: true
            }
        };
    }
    getLayoutConfiguration() {
        return this._layoutConfiguration;
    }
    getDisplayOptions() {
        return this._layoutConfiguration;
    }
    getCellEditorContainerLeftMargin() {
        const { codeCellLeftMargin, cellRunGutter } = this._layoutConfiguration;
        return codeCellLeftMargin + cellRunGutter;
    }
    computeCollapsedMarkdownCellHeight(viewType) {
        const { bottomToolbarGap } = this.computeBottomToolbarDimensions(viewType);
        return this._layoutConfiguration.markdownCellTopMargin
            + this._layoutConfiguration.collapsedIndicatorHeight
            + bottomToolbarGap
            + this._layoutConfiguration.markdownCellBottomMargin;
    }
    computeBottomToolbarOffset(totalHeight, viewType) {
        const { bottomToolbarGap, bottomToolbarHeight } = this.computeBottomToolbarDimensions(viewType);
        return totalHeight
            - bottomToolbarGap
            - bottomToolbarHeight / 2;
    }
    computeCodeCellEditorWidth(outerWidth) {
        return outerWidth - (this._layoutConfiguration.codeCellLeftMargin
            + this._layoutConfiguration.cellRunGutter
            + this._layoutConfiguration.cellRightMargin);
    }
    computeMarkdownCellEditorWidth(outerWidth) {
        return outerWidth
            - this._layoutConfiguration.markdownCellGutter
            - this._layoutConfiguration.markdownCellLeftMargin
            - this._layoutConfiguration.cellRightMargin;
    }
    computeStatusBarHeight() {
        return this._layoutConfiguration.cellStatusBarHeight;
    }
    _computeBottomToolbarDimensions(compactView, insertToolbarPosition, insertToolbarAlignment, cellToolbar) {
        if (insertToolbarAlignment === 'left' || cellToolbar !== 'hidden') {
            return {
                bottomToolbarGap: 18,
                bottomToolbarHeight: 18
            };
        }
        if (insertToolbarPosition === 'betweenCells' || insertToolbarPosition === 'both') {
            return compactView ? {
                bottomToolbarGap: 12,
                bottomToolbarHeight: 20
            } : {
                bottomToolbarGap: 20,
                bottomToolbarHeight: 20
            };
        }
        else {
            return {
                bottomToolbarGap: 0,
                bottomToolbarHeight: 0
            };
        }
    }
    computeBottomToolbarDimensions(viewType) {
        const configuration = this._layoutConfiguration;
        const cellToolbarPosition = this.computeCellToolbarLocation(viewType);
        const { bottomToolbarGap, bottomToolbarHeight } = this._computeBottomToolbarDimensions(configuration.compactView, configuration.insertToolbarPosition, configuration.insertToolbarAlignment, cellToolbarPosition);
        return {
            bottomToolbarGap,
            bottomToolbarHeight
        };
    }
    computeCellToolbarLocation(viewType) {
        const cellToolbarLocation = this._layoutConfiguration.cellToolbarLocation;
        if (typeof cellToolbarLocation === 'string') {
            if (cellToolbarLocation === 'left' || cellToolbarLocation === 'right' || cellToolbarLocation === 'hidden') {
                return cellToolbarLocation;
            }
        }
        else {
            if (viewType) {
                const notebookSpecificSetting = cellToolbarLocation[viewType] ?? cellToolbarLocation['default'];
                let cellToolbarLocationForCurrentView = 'right';
                switch (notebookSpecificSetting) {
                    case 'left':
                        cellToolbarLocationForCurrentView = 'left';
                        break;
                    case 'right':
                        cellToolbarLocationForCurrentView = 'right';
                        break;
                    case 'hidden':
                        cellToolbarLocationForCurrentView = 'hidden';
                        break;
                    default:
                        cellToolbarLocationForCurrentView = 'right';
                        break;
                }
                return cellToolbarLocationForCurrentView;
            }
        }
        return 'right';
    }
    computeTopInsertToolbarHeight(viewType) {
        if (this._layoutConfiguration.insertToolbarPosition === 'betweenCells' || this._layoutConfiguration.insertToolbarPosition === 'both') {
            return SCROLLABLE_ELEMENT_PADDING_TOP;
        }
        const cellToolbarLocation = this.computeCellToolbarLocation(viewType);
        if (cellToolbarLocation === 'left' || cellToolbarLocation === 'right') {
            return SCROLLABLE_ELEMENT_PADDING_TOP;
        }
        return 0;
    }
    computeEditorPadding(internalMetadata, cellUri) {
        return {
            top: this._editorTopPadding,
            bottom: this.statusBarIsVisible(internalMetadata, cellUri)
                ? this._layoutConfiguration.editorBottomPadding
                : this._layoutConfiguration.editorBottomPaddingWithoutStatusBar
        };
    }
    computeEditorStatusbarHeight(internalMetadata, cellUri) {
        return this.statusBarIsVisible(internalMetadata, cellUri) ? this.computeStatusBarHeight() : 0;
    }
    statusBarIsVisible(internalMetadata, cellUri) {
        const exe = this.notebookExecutionStateService.getCellExecution(cellUri);
        if (this._layoutConfiguration.showCellStatusBar === 'visible') {
            return true;
        }
        else if (this._layoutConfiguration.showCellStatusBar === 'visibleAfterExecute') {
            return typeof internalMetadata.lastRunSuccess === 'boolean' || exe !== undefined;
        }
        else {
            return false;
        }
    }
    computeWebviewOptions() {
        return {
            outputNodePadding: this._layoutConfiguration.cellOutputPadding,
            outputNodeLeftPadding: this._layoutConfiguration.cellOutputPadding,
            previewNodePadding: this._layoutConfiguration.markdownPreviewPadding,
            markdownLeftMargin: this._layoutConfiguration.markdownCellGutter + this._layoutConfiguration.markdownCellLeftMargin,
            leftMargin: this._layoutConfiguration.codeCellLeftMargin,
            rightMargin: this._layoutConfiguration.cellRightMargin,
            runGutter: this._layoutConfiguration.cellRunGutter,
            dragAndDropEnabled: this._layoutConfiguration.dragAndDropEnabled,
            fontSize: this._layoutConfiguration.fontSize,
            outputFontSize: this._layoutConfiguration.outputFontSize,
            outputFontFamily: this._layoutConfiguration.outputFontFamily,
            markupFontSize: this._layoutConfiguration.markupFontSize,
            markdownLineHeight: this._layoutConfiguration.markdownLineHeight,
            outputLineHeight: this._layoutConfiguration.outputLineHeight,
            outputScrolling: this._layoutConfiguration.outputScrolling,
            outputWordWrap: this._layoutConfiguration.outputWordWrap,
            outputLineLimit: this._layoutConfiguration.outputLineLimit,
            outputLinkifyFilePaths: this._layoutConfiguration.outputLinkifyFilePaths,
            minimalError: this._layoutConfiguration.outputMinimalError,
            markupFontFamily: this._layoutConfiguration.markupFontFamily
        };
    }
    computeDiffWebviewOptions() {
        return {
            outputNodePadding: this._layoutConfiguration.cellOutputPadding,
            outputNodeLeftPadding: 0,
            previewNodePadding: this._layoutConfiguration.markdownPreviewPadding,
            markdownLeftMargin: 0,
            leftMargin: 32,
            rightMargin: 0,
            runGutter: 0,
            dragAndDropEnabled: false,
            fontSize: this._layoutConfiguration.fontSize,
            outputFontSize: this._layoutConfiguration.outputFontSize,
            outputFontFamily: this._layoutConfiguration.outputFontFamily,
            markupFontSize: this._layoutConfiguration.markupFontSize,
            markdownLineHeight: this._layoutConfiguration.markdownLineHeight,
            outputLineHeight: this._layoutConfiguration.outputLineHeight,
            outputScrolling: this._layoutConfiguration.outputScrolling,
            outputWordWrap: this._layoutConfiguration.outputWordWrap,
            outputLineLimit: this._layoutConfiguration.outputLineLimit,
            outputLinkifyFilePaths: false,
            minimalError: false,
            markupFontFamily: this._layoutConfiguration.markupFontFamily
        };
    }
    computeIndicatorPosition(totalHeight, foldHintHeight, viewType) {
        const { bottomToolbarGap } = this.computeBottomToolbarDimensions(viewType);
        return {
            bottomIndicatorTop: totalHeight - bottomToolbarGap - this._layoutConfiguration.cellBottomMargin - foldHintHeight,
            verticalIndicatorHeight: totalHeight - bottomToolbarGap - foldHintHeight
        };
    }
};
NotebookOptions = __decorate([
    __param(3, IConfigurationService),
    __param(4, INotebookExecutionStateService),
    __param(5, ICodeEditorService)
], NotebookOptions);
export { NotebookOptions };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tPcHRpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL25vdGVib29rL2Jyb3dzZXIvbm90ZWJvb2tPcHRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUVwRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDM0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFNUQsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDekYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFFOUYsT0FBTyxFQUFFLGlDQUFpQyxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDN0csT0FBTyxFQUFrRCxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRW5KLE9BQU8sRUFBdUcsZUFBZSxFQUF5QixNQUFNLDZCQUE2QixDQUFDO0FBQzFMLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBRTVGLE1BQU0sOEJBQThCLEdBQUcsRUFBRSxDQUFDO0FBRTFDLE1BQU0sQ0FBQyxNQUFNLDhCQUE4QixHQUFHLENBQUMsQ0FBQztBQThGaEQsTUFBTSxzQkFBc0IsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQzVDLGtCQUFrQixFQUFFLEVBQUU7SUFDdEIsYUFBYSxFQUFFLEVBQUU7SUFDakIscUJBQXFCLEVBQUUsQ0FBQztJQUN4Qix3QkFBd0IsRUFBRSxDQUFD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