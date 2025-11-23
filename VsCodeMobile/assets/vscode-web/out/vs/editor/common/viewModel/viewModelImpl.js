/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ArrayQueue } from '../../../base/common/arrays.js';
import { RunOnceScheduler } from '../../../base/common/async.js';
import { Color } from '../../../base/common/color.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import * as platform from '../../../base/common/platform.js';
import * as strings from '../../../base/common/strings.js';
import { filterValidationDecorations, filterFontDecorations } from '../config/editorOptions.js';
import { EDITOR_FONT_DEFAULTS } from '../config/fontInfo.js';
import { CursorsController } from '../cursor/cursor.js';
import { CursorConfiguration } from '../cursorCommon.js';
import { Position } from '../core/position.js';
import { Range } from '../core/range.js';
import { TextDirection } from '../model.js';
import * as textModelEvents from '../textModelEvents.js';
import { TokenizationRegistry } from '../languages.js';
import { PLAINTEXT_LANGUAGE_ID } from '../languages/modesRegistry.js';
import { tokenizeLineToHTML } from '../languages/textToHtmlTokenizer.js';
import * as viewEvents from '../viewEvents.js';
import { ViewLayout } from '../viewLayout/viewLayout.js';
import { MinimapTokensColorTracker } from './minimapTokensColorTracker.js';
import { MinimapLinesRenderingData, OverviewRulerDecorationsGroup, ViewLineRenderingData } from '../viewModel.js';
import { ViewModelDecorations } from './viewModelDecorations.js';
import { FocusChangedEvent, HiddenAreasChangedEvent, ModelContentChangedEvent, ModelDecorationsChangedEvent, ModelFontChangedEvent, ModelLanguageChangedEvent, ModelLanguageConfigurationChangedEvent, ModelLineHeightChangedEvent, ModelOptionsChangedEvent, ModelTokensChangedEvent, ReadOnlyEditAttemptEvent, ScrollChangedEvent, ViewModelEventDispatcher, ViewZonesChangedEvent, WidgetFocusChangedEvent } from '../viewModelEventDispatcher.js';
import { ViewModelLinesFromModelAsIs, ViewModelLinesFromProjectedModel } from './viewModelLines.js';
import { GlyphMarginLanesModel } from './glyphLanesModel.js';
const USE_IDENTITY_LINES_COLLECTION = true;
export class ViewModel extends Disposable {
    constructor(editorId, configuration, model, domLineBreaksComputerFactory, monospaceLineBreaksComputerFactory, scheduleAtNextAnimationFrame, languageConfigurationService, _themeService, _attachedView, _transactionalTarget) {
        super();
        this.languageConfigurationService = languageConfigurationService;
        this._themeService = _themeService;
        this._attachedView = _attachedView;
        this._transactionalTarget = _transactionalTarget;
        this.hiddenAreasModel = new HiddenAreasModel();
        this.previousHiddenAreas = [];
        this._editorId = editorId;
        this._configuration = configuration;
        this.model = model;
        this._eventDispatcher = new ViewModelEventDispatcher();
        this.onEvent = this._eventDispatcher.onEvent;
        this.cursorConfig = new CursorConfiguration(this.model.getLanguageId(), this.model.getOptions(), this._configuration, this.languageConfigurationService);
        this._updateConfigurationViewLineCount = this._register(new RunOnceScheduler(() => this._updateConfigurationViewLineCountNow(), 0));
        this._hasFocus = false;
        this._viewportStart = ViewportStart.create(this.model);
        this.glyphLanes = new GlyphMarginLanesModel(0);
        if (USE_IDENTITY_LINES_COLLECTION && this.model.isTooLargeForTokenization()) {
            this._lines = new ViewModelLinesFromModelAsIs(this.model);
        }
        else {
            const options = this._configuration.options;
            const fontInfo = options.get(59 /* EditorOption.fontInfo */);
            const wrappingStrategy = options.get(156 /* EditorOption.wrappingStrategy */);
            const wrappingInfo = options.get(166 /* EditorOption.wrappingInfo */);
            const wrappingIndent = options.get(155 /* EditorOption.wrappingIndent */);
            const wordBreak = options.get(146 /* EditorOption.wordBreak */);
            const wrapOnEscapedLineFeeds = options.get(160 /* EditorOption.wrapOnEscapedLineFeeds */);
            this._lines = new ViewModelLinesFromProjectedModel(this._editorId, this.model, domLineBreaksComputerFactory, monospaceLineBreaksComputerFactory, fontInfo, this.model.getOptions().tabSize, wrappingStrategy, wrappingInfo.wrappingColumn, wrappingIndent, wordBreak, wrapOnEscapedLineFeeds);
        }
        this.coordinatesConverter = this._lines.createCoordinatesConverter();
        this._cursor = this._register(new CursorsController(model, this, this.coordinatesConverter, this.cursorConfig));
        this.viewLayout = this._register(new ViewLayout(this._configuration, this.getLineCount(), this._getCustomLineHeights(), scheduleAtNextAnimationFrame));
        this._register(this.viewLayout.onDidScroll((e) => {
            if (e.scrollTopChanged) {
                this._handleVisibleLinesChanged();
            }
            if (e.scrollTopChanged) {
                this._viewportStart.invalidate();
            }
            this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewScrollChangedEvent(e));
            this._eventDispatcher.emitOutgoingEvent(new ScrollChangedEvent(e.oldScrollWidth, e.oldScrollLeft, e.oldScrollHeight, e.oldScrollTop, e.scrollWidth, e.scrollLeft, e.scrollHeight, e.scrollTop));
        }));
        this._register(this.viewLayout.onDidContentSizeChange((e) => {
            this._eventDispatcher.emitOutgoingEvent(e);
        }));
        this._decorations = new ViewModelDecorations(this._editorId, this.model, this._configuration, this._lines, this.coordinatesConverter);
        this._registerModelEvents();
        this._register(this._configuration.onDidChangeFast((e) => {
            try {
                const eventsCollector = this._eventDispatcher.beginEmitViewEvents();
                this._onConfigurationChanged(eventsCollector, e);
            }
            finally {
                this._eventDispatcher.endEmitViewEvents();
            }
        }));
        this._register(MinimapTokensColorTracker.getInstance().onDidChange(() => {
            this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewTokensColorsChangedEvent());
        }));
        this._register(this._themeService.onDidColorThemeChange((theme) => {
            this._invalidateDecorationsColorCache();
            this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewThemeChangedEvent(theme));
        }));
        this._updateConfigurationViewLineCountNow();
    }
    dispose() {
        // First remove listeners, as disposing the lines might end up sending
        // model decoration changed events ... and we no longer care about them ...
        super.dispose();
        this._decorations.dispose();
        this._lines.dispose();
        this._viewportStart.dispose();
        this._eventDispatcher.dispose();
    }
    createLineBreaksComputer() {
        return this._lines.createLineBreaksComputer();
    }
    addViewEventHandler(eventHandler) {
        this._eventDispatcher.addViewEventHandler(eventHandler);
    }
    removeViewEventHandler(eventHandler) {
        this._eventDispatcher.removeViewEventHandler(eventHandler);
    }
    _getCustomLineHeights() {
        const allowVariableLineHeights = this._configuration.options.get(5 /* EditorOption.allowVariableLineHeights */);
        if (!allowVariableLineHeights) {
            return [];
        }
        const decorations = this.model.getCustomLineHeightsDecorations(this._editorId);
        return decorations.map((d) => {
            const lineNumber = d.range.startLineNumber;
            const viewRange = this.coordinatesConverter.convertModelRangeToViewRange(new Range(lineNumber, 1, lineNumber, this.model.getLineMaxColumn(lineNumber)));
            return {
                decorationId: d.id,
                startLineNumber: viewRange.startLineNumber,
                endLineNumber: viewRange.endLineNumber,
                lineHeight: d.options.lineHeight || 0
            };
        });
    }
    _updateConfigurationViewLineCountNow() {
        this._configuration.setViewLineCount(this._lines.getViewLineCount());
    }
    getModelVisibleRanges() {
        const linesViewportData = this.viewLayout.getLinesViewportData();
        const viewVisibleRange = new Range(linesViewportData.startLineNumber, this.getLineMinColumn(linesViewportData.startLineNumber), linesViewportData.endLineNumber, this.getLineMaxColumn(linesViewportData.endLineNumber));
        const modelVisibleRanges = this._toModelVisibleRanges(viewVisibleRange);
        return modelVisibleRanges;
    }
    visibleLinesStabilized() {
        const modelVisibleRanges = this.getModelVisibleRanges();
        this._attachedView.setVisibleLines(modelVisibleRanges, true);
    }
    _handleVisibleLinesChanged() {
        const modelVisibleRanges = this.getModelVisibleRanges();
        this._attachedView.setVisibleLines(modelVisibleRanges, false);
    }
    setHasFocus(hasFocus) {
        this._hasFocus = hasFocus;
        this._cursor.setHasFocus(hasFocus);
        this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewFocusChangedEvent(hasFocus));
        this._eventDispatcher.emitOutgoingEvent(new FocusChangedEvent(!hasFocus, hasFocus));
    }
    setHasWidgetFocus(hasWidgetFocus) {
        this._eventDispatcher.emitOutgoingEvent(new WidgetFocusChangedEvent(!hasWidgetFocus, hasWidgetFocus));
    }
    onCompositionStart() {
        this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewCompositionStartEvent());
    }
    onCompositionEnd() {
        this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewCompositionEndEvent());
    }
    _captureStableViewport() {
        // We might need to restore the current start view range, so save it (if available)
        // But only if the scroll position is not at the top of the file
        if (this._viewportStart.isValid && this.viewLayout.getCurrentScrollTop() > 0) {
            const previousViewportStartViewPosition = new Position(this._viewportStart.viewLineNumber, this.getLineMinColumn(this._viewportStart.viewLineNumber));
            const previousViewportStartModelPosition = this.coordinatesConverter.convertViewPositionToModelPosition(previousViewportStartViewPosition);
            return new StableViewport(previousViewportStartModelPosition, this._viewportStart.startLineDelta);
        }
        return new StableViewport(null, 0);
    }
    _onConfigurationChanged(eventsCollector, e) {
        const stableViewport = this._captureStableViewport();
        const options = this._configuration.options;
        const fontInfo = options.get(59 /* EditorOption.fontInfo */);
        const wrappingStrategy = options.get(156 /* EditorOption.wrappingStrategy */);
        const wrappingInfo = options.get(166 /* EditorOption.wrappingInfo */);
        const wrappingIndent = options.get(155 /* EditorOption.wrappingIndent */);
        const wordBreak = options.get(146 /* EditorOption.wordBreak */);
        if (this._lines.setWrappingSettings(fontInfo, wrappingStrategy, wrappingInfo.wrappingColumn, wrappingIndent, wordBreak)) {
            eventsCollector.emitViewEvent(new viewEvents.ViewFlushedEvent());
            eventsCollector.emitViewEvent(new viewEvents.ViewLineMappingChangedEvent());
            eventsCollector.emitViewEvent(new viewEvents.ViewDecorationsChangedEvent(null));
            this._cursor.onLineMappingChanged(eventsCollector);
            this._decorations.onLineMappingChanged();
            this.viewLayout.onFlushed(this.getLineCount(), this._getCustomLineHeights());
            this._updateConfigurationViewLineCount.schedule();
        }
        if (e.hasChanged(104 /* EditorOption.readOnly */)) {
            // Must read again all decorations due to readOnly filtering
            this._decorations.reset();
            eventsCollector.emitViewEvent(new viewEvents.ViewDecorationsChangedEvent(null));
        }
        if (e.hasChanged(112 /* EditorOption.renderValidationDecorations */)) {
            this._decorations.reset();
            eventsCollector.emitViewEvent(new viewEvents.ViewDecorationsChangedEvent(null));
        }
        eventsCollector.emitViewEvent(new viewEvents.ViewConfigurationChangedEvent(e));
        this.viewLayout.onConfigurationChanged(e);
        stableViewport.recoverViewportStart(this.coordinatesConverter, this.viewLayout);
        if (CursorConfiguration.shouldRecreate(e)) {
            this.cursorConfig = new CursorConfiguration(this.model.getLanguageId(), this.model.getOptions(), this._configuration, this.languageConfigurationService);
            this._cursor.updateConfiguration(this.cursorConfig);
        }
    }
    _registerModelEvents() {
        this._register(this.model.onDidChangeContentOrInjectedText((e) => {
            try {
                const eventsCollector = this._eventDispatcher.beginEmitViewEvents();
                let hadOtherModelChange = false;
                let hadModelLineChangeThatChangedLineMapping = false;
                const changes = (e instanceof textModelEvents.InternalModelContentChangeEvent ? e.rawContentChangedEvent.changes : e.changes);
                const versionId = (e instanceof textModelEvents.InternalModelContentChangeEvent ? e.rawContentChangedEvent.versionId : null);
                // Do a first pass to compute line mappings, and a second pass to actually interpret them
                const lineBreaksComputer = this._lines.createLineBreaksComputer();
                for (const change of changes) {
                    switch (change.changeType) {
                        case 4 /* textModelEvents.RawContentChangedType.LinesInserted */: {
                            for (let lineIdx = 0; lineIdx < change.detail.length; lineIdx++) {
                                const line = change.detail[lineIdx];
                                let injectedText = change.injectedTexts[lineIdx];
                                if (injectedText) {
                                    injectedText = injectedText.filter(element => (!element.ownerId || element.ownerId === this._editorId));
                                }
                                lineBreaksComputer.addRequest(line, injectedText, null);
                            }
                            break;
                        }
                        case 2 /* textModelEvents.RawContentChangedType.LineChanged */: {
                            let injectedText = null;
                            if (change.injectedText) {
                                injectedText = change.injectedText.filter(element => (!element.ownerId || element.ownerId === this._editorId));
                            }
                            lineBreaksComputer.addRequest(change.detail, injectedText, null);
                            break;
                        }
                    }
                }
                const lineBreaks = lineBreaksComputer.finalize();
                const lineBreakQueue = new ArrayQueue(lineBreaks);
                for (const change of changes) {
                    switch (change.changeType) {
                        case 1 /* textModelEvents.RawContentChangedType.Flush */: {
                            this._lines.onModelFlushed();
                            eventsCollector.emitViewEvent(new viewEvents.ViewFlushedEvent());
                            this._decorations.reset();
                            this.viewLayout.onFlushed(this.getLineCount(), this._getCustomLineHeights());
                            hadOtherModelChange = true;
                            break;
                        }
                        case 3 /* textModelEvents.RawContentChangedType.LinesDeleted */: {
                            const linesDeletedEvent = this._lines.onModelLinesDeleted(versionId, change.fromLineNumber, change.toLineNumber);
                            if (linesDeletedEvent !== null) {
                                eventsCollector.emitViewEvent(linesDeletedEvent);
                                this.viewLayout.onLinesDeleted(linesDeletedEvent.fromLineNumber, linesDeletedEvent.toLineNumber);
                            }
                            hadOtherModelChange = true;
                            break;
                        }
                        case 4 /* textModelEvents.RawContentChangedType.LinesInserted */: {
                            const insertedLineBreaks = lineBreakQueue.takeCount(change.detail.length);
                            const linesInsertedEvent = this._lines.onModelLinesInserted(versionId, change.fromLineNumber, change.toLineNumber, insertedLineBreaks);
                            if (linesInsertedEvent !== null) {
                                eventsCollector.emitViewEvent(linesInsertedEvent);
                                this.viewLayout.onLinesInserted(linesInsertedEvent.fromLineNumber, linesInsertedEvent.toLineNumber);
                            }
                            hadOtherModelChange = true;
                            break;
                        }
                        case 2 /* textModelEvents.RawContentChangedType.LineChanged */: {
                            const changedLineBreakData = lineBreakQueue.dequeue();
                            const [lineMappingChanged, linesChangedEvent, linesInsertedEvent, linesDeletedEvent] = this._lines.onModelLineChanged(versionId, change.lineNumber, changedLineBreakData);
                            hadModelLineChangeThatChangedLineMapping = lineMappingChanged;
                            if (linesChangedEvent) {
                                eventsCollector.emitViewEvent(linesChangedEvent);
                            }
                            if (linesInsertedEvent) {
                                eventsCollector.emitViewEvent(linesInsertedEvent);
                                this.viewLayout.onLinesInserted(linesInsertedEvent.fromLineNumber, linesInsertedEvent.toLineNumber);
                            }
                            if (linesDeletedEvent) {
                                eventsCollector.emitViewEvent(linesDeletedEvent);
                                this.viewLayout.onLinesDeleted(linesDeletedEvent.fromLineNumber, linesDeletedEvent.toLineNumber);
                            }
                            break;
                        }
                        case 5 /* textModelEvents.RawContentChangedType.EOLChanged */: {
                            // Nothing to do. The new version will be accepted below
                            break;
                        }
                    }
                }
                if (versionId !== null) {
                    this._lines.acceptVersionId(versionId);
                }
                this.viewLayout.onHeightMaybeChanged();
                if (!hadOtherModelChange && hadModelLineChangeThatChangedLineMapping) {
                    eventsCollector.emitViewEvent(new viewEvents.ViewLineMappingChangedEvent());
                    eventsCollector.emitViewEvent(new viewEvents.ViewDecorationsChangedEvent(null));
                    this._cursor.onLineMappingChanged(eventsCollector);
                    this._decorations.onLineMappingChanged();
                }
            }
            finally {
                this._eventDispatcher.endEmitViewEvents();
            }
            // Update the configuration and reset the centered view line
            const viewportStartWasValid = this._viewportStart.isValid;
            this._viewportStart.invalidate();
            this._configuration.setModelLineCount(this.model.getLineCount());
            this._updateConfigurationViewLineCountNow();
            // Recover viewport
            if (!this._hasFocus && this.model.getAttachedEditorCount() >= 2 && viewportStartWasValid) {
                const modelRange = this.model._getTrackedRange(this._viewportStart.modelTrackedRange);
                if (modelRange) {
                    const viewPosition = this.coordinatesConverter.convertModelPositionToViewPosition(modelRange.getStartPosition());
                    const viewPositionTop = this.viewLayout.getVerticalOffsetForLineNumber(viewPosition.lineNumber);
                    this.viewLayout.setScrollPosition({ scrollTop: viewPositionTop + this._viewportStart.startLineDelta }, 1 /* ScrollType.Immediate */);
                }
            }
            try {
                const eventsCollector = this._eventDispatcher.beginEmitViewEvents();
                if (e instanceof textModelEvents.InternalModelContentChangeEvent) {
                    eventsCollector.emitOutgoingEvent(new ModelContentChangedEvent(e.contentChangedEvent));
                }
                this._cursor.onModelContentChanged(eventsCollector, e);
            }
            finally {
                this._eventDispatcher.endEmitViewEvents();
            }
            this._handleVisibleLinesChanged();
        }));
        const allowVariableLineHeights = this._configuration.options.get(5 /* EditorOption.allowVariableLineHeights */);
        if (allowVariableLineHeights) {
            this._register(this.model.onDidChangeLineHeight((e) => {
                const filteredChanges = e.changes.filter((change) => change.ownerId === this._editorId || change.ownerId === 0);
                this.viewLayout.changeSpecialLineHeights((accessor) => {
                    for (const change of filteredChanges) {
                        const { decorationId, lineNumber, lineHeight } = change;
                        const viewRange = this.coordinatesConverter.convertModelRangeToViewRange(new Range(lineNumber, 1, lineNumber, this.model.getLineMaxColumn(lineNumber)));
                        if (lineHeight !== null) {
                            accessor.insertOrChangeCustomLineHeight(decorationId, viewRange.startLineNumber, viewRange.endLineNumber, lineHeight);
                        }
                        else {
                            accessor.removeCustomLineHeight(decorationId);
                        }
                    }
                });
                // recreate the model event using the filtered changes
                if (filteredChanges.length > 0) {
                    const filteredEvent = new textModelEvents.ModelLineHeightChangedEvent(filteredChanges);
                    this._eventDispatcher.emitOutgoingEvent(new ModelLineHeightChangedEvent(filteredEvent));
                }
            }));
        }
        const allowVariableFonts = this._configuration.options.get(172 /* EditorOption.effectiveAllowVariableFonts */);
        if (allowVariableFonts) {
            this._register(this.model.onDidChangeFont((e) => {
                const filteredChanges = e.changes.filter((change) => change.ownerId === this._editorId || change.ownerId === 0);
                // recreate the model event using the filtered changes
                if (filteredChanges.length > 0) {
                    const filteredEvent = new textModelEvents.ModelFontChangedEvent(filteredChanges);
                    this._eventDispatcher.emitOutgoingEvent(new ModelFontChangedEvent(filteredEvent));
                }
            }));
        }
        this._register(this.model.onDidChangeTokens((e) => {
            const viewRanges = [];
            for (let j = 0, lenJ = e.ranges.length; j < lenJ; j++) {
                const modelRange = e.ranges[j];
                const viewStartLineNumber = this.coordinatesConverter.convertModelPositionToViewPosition(new Position(modelRange.fromLineNumber, 1)).lineNumber;
                const viewEndLineNumber = this.coordinatesConverter.convertModelPositionToViewPosition(new Position(modelRange.toLineNumber, this.model.getLineMaxColumn(modelRange.toLineNumber))).lineNumber;
                viewRanges[j] = {
                    fromLineNumber: viewStartLineNumber,
                    toLineNumber: viewEndLineNumber
                };
            }
            this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewTokensChangedEvent(viewRanges));
            this._eventDispatcher.emitOutgoingEvent(new ModelTokensChangedEvent(e));
        }));
        this._register(this.model.onDidChangeLanguageConfiguration((e) => {
            this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewLanguageConfigurationEvent());
            this.cursorConfig = new CursorConfiguration(this.model.getLanguageId(), this.model.getOptions(), this._configuration, this.languageConfigurationService);
            this._cursor.updateConfiguration(this.cursorConfig);
            this._eventDispatcher.emitOutgoingEvent(new ModelLanguageConfigurationChangedEvent(e));
        }));
        this._register(this.model.onDidChangeLanguage((e) => {
            this.cursorConfig = new CursorConfiguration(this.model.getLanguageId(), this.model.getOptions(), this._configuration, this.languageConfigurationService);
            this._cursor.updateConfiguration(this.cursorConfig);
            this._eventDispatcher.emitOutgoingEvent(new ModelLanguageChangedEvent(e));
        }));
        this._register(this.model.onDidChangeOptions((e) => {
            // A tab size change causes a line mapping changed event => all view parts will repaint OK, no further event needed here
            if (this._lines.setTabSize(this.model.getOptions().tabSize)) {
                try {
                    const eventsCollector = this._eventDispatcher.beginEmitViewEvents();
                    eventsCollector.emitViewEvent(new viewEvents.ViewFlushedEvent());
                    eventsCollector.emitViewEvent(new viewEvents.ViewLineMappingChangedEvent());
                    eventsCollector.emitViewEvent(new viewEvents.ViewDecorationsChangedEvent(null));
                    this._cursor.onLineMappingChanged(eventsCollector);
                    this._decorations.onLineMappingChanged();
                    this.viewLayout.onFlushed(this.getLineCount(), this._getCustomLineHeights());
                }
                finally {
                    this._eventDispatcher.endEmitViewEvents();
                }
                this._updateConfigurationViewLineCount.schedule();
            }
            this.cursorConfig = new CursorConfiguration(this.model.getLanguageId(), this.model.getOptions(), this._configuration, this.languageConfigurationService);
            this._cursor.updateConfiguration(this.cursorConfig);
            this._eventDispatcher.emitOutgoingEvent(new ModelOptionsChangedEvent(e));
        }));
        this._register(this.model.onDidChangeDecorations((e) => {
            this._decorations.onModelDecorationsChanged();
            this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewDecorationsChangedEvent(e));
            this._eventDispatcher.emitOutgoingEvent(new ModelDecorationsChangedEvent(e));
        }));
    }
    getFontSizeAtPosition(position) {
        const allowVariableFonts = this._configuration.options.get(172 /* EditorOption.effectiveAllowVariableFonts */);
        if (!allowVariableFonts) {
            return null;
        }
        const fontDecorations = this.model.getFontDecorationsInRange(Range.fromPositions(position), this._editorId);
        let fontSize = this._configuration.options.get(59 /* EditorOption.fontInfo */).fontSize + 'px';
        for (const fontDecoration of fontDecorations) {
            if (fontDecoration.options.fontSize) {
                fontSize = fontDecoration.options.fontSize;
                break;
            }
        }
        return fontSize;
    }
    /**
     * @param forceUpdate If true, the hidden areas will be updated even if the new ranges are the same as the previous ranges.
     * This is because the model might have changed, which resets the hidden areas, but not the last cached value.
     * This needs a better fix in the future.
    */
    setHiddenAreas(ranges, source, forceUpdate) {
        this.hiddenAreasModel.setHiddenAreas(source, ranges);
        const mergedRanges = this.hiddenAreasModel.getMergedRanges();
        if (mergedRanges === this.previousHiddenAreas && !forceUpdate) {
            return;
        }
        this.previousHiddenAreas = mergedRanges;
        const stableViewport = this._captureStableViewport();
        let lineMappingChanged = false;
        try {
            const eventsCollector = this._eventDispatcher.beginEmitViewEvents();
            lineMappingChanged = this._lines.setHiddenAreas(mergedRanges);
            if (lineMappingChanged) {
                eventsCollector.emitViewEvent(new viewEvents.ViewFlushedEvent());
                eventsCollector.emitViewEvent(new viewEvents.ViewLineMappingChangedEvent());
                eventsCollector.emitViewEvent(new viewEvents.ViewDecorationsChangedEvent(null));
                this._cursor.onLineMappingChanged(eventsCollector);
                this._decorations.onLineMappingChanged();
                this.viewLayout.onFlushed(this.getLineCount(), this._getCustomLineHeights());
                this.viewLayout.onHeightMaybeChanged();
            }
            const firstModelLineInViewPort = stableViewport.viewportStartModelPosition?.lineNumber;
            const firstModelLineIsHidden = firstModelLineInViewPort && mergedRanges.some(range => range.startLineNumber <= firstModelLineInViewPort && firstModelLineInViewPort <= range.endLineNumber);
            if (!firstModelLineIsHidden) {
                stableViewport.recoverViewportStart(this.coordinatesConverter, this.viewLayout);
            }
        }
        finally {
            this._eventDispatcher.endEmitViewEvents();
        }
        this._updateConfigurationViewLineCount.schedule();
        if (lineMappingChanged) {
            this._eventDispatcher.emitOutgoingEvent(new HiddenAreasChangedEvent());
        }
    }
    getVisibleRangesPlusViewportAboveBelow() {
        const layoutInfo = this._configuration.options.get(165 /* EditorOption.layoutInfo */);
        const lineHeight = this._configuration.options.get(75 /* EditorOption.lineHeight */);
        const linesAround = Math.max(20, Math.round(layoutInfo.height / lineHeight));
        const partialData = this.viewLayout.getLinesViewportData();
        const startViewLineNumber = Math.max(1, partialData.completelyVisibleStartLineNumber - linesAround);
        const endViewLineNumber = Math.min(this.getLineCount(), partialData.completelyVisibleEndLineNumber + linesAround);
        return this._toModelVisibleRanges(new Range(startViewLineNumber, this.getLineMinColumn(startViewLineNumber), endViewLineNumber, this.getLineMaxColumn(endViewLineNumber)));
    }
    getVisibleRanges() {
        const visibleViewRange = this.getCompletelyVisibleViewRange();
        return this._toModelVisibleRanges(visibleViewRange);
    }
    getHiddenAreas() {
        return this._lines.getHiddenAreas();
    }
    _toModelVisibleRanges(visibleViewRange) {
        const visibleRange = this.coordinatesConverter.convertViewRangeToModelRange(visibleViewRange);
        const hiddenAreas = this._lines.getHiddenAreas();
        if (hiddenAreas.length === 0) {
            return [visibleRange];
        }
        const result = [];
        let resultLen = 0;
        let startLineNumber = visibleRange.startLineNumber;
        let startColumn = visibleRange.startColumn;
        const endLineNumber = visibleRange.endLineNumber;
        const endColumn = visibleRange.endColumn;
        for (let i = 0, len = hiddenAreas.length; i < len; i++) {
            const hiddenStartLineNumber = hiddenAreas[i].startLineNumber;
            const hiddenEndLineNumber = hiddenAreas[i].endLineNumber;
            if (hiddenEndLineNumber < startLineNumber) {
                continue;
            }
            if (hiddenStartLineNumber > endLineNumber) {
                continue;
            }
            if (startLineNumber < hiddenStartLineNumber) {
                result[resultLen++] = new Range(startLineNumber, startColumn, hiddenStartLineNumber - 1, this.model.getLineMaxColumn(hiddenStartLineNumber - 1));
            }
            startLineNumber = hiddenEndLineNumber + 1;
            startColumn = 1;
        }
        if (startLineNumber < endLineNumber || (startLineNumber === endLineNumber && startColumn < endColumn)) {
            result[resultLen++] = new Range(startLineNumber, startColumn, endLineNumber, endColumn);
        }
        return result;
    }
    getCompletelyVisibleViewRange() {
        const partialData = this.viewLayout.getLinesViewportData();
        const startViewLineNumber = partialData.completelyVisibleStartLineNumber;
        const endViewLineNumber = partialData.completelyVisibleEndLineNumber;
        return new Range(startViewLineNumber, this.getLineMinColumn(startViewLineNumber), endViewLineNumber, this.getLineMaxColumn(endViewLineNumber));
    }
    getCompletelyVisibleViewRangeAtScrollTop(scrollTop) {
        const partialData = this.viewLayout.getLinesViewportDataAtScrollTop(scrollTop);
        const startViewLineNumber = partialData.completelyVisibleStartLineNumber;
        const endViewLineNumber = partialData.completelyVisibleEndLineNumber;
        return new Range(startViewLineNumber, this.getLineMinColumn(startViewLineNumber), endViewLineNumber, this.getLineMaxColumn(endViewLineNumber));
    }
    saveState() {
        const compatViewState = this.viewLayout.saveState();
        const scrollTop = compatViewState.scrollTop;
        const firstViewLineNumber = this.viewLayout.getLineNumberAtVerticalOffset(scrollTop);
        const firstPosition = this.coordinatesConverter.convertViewPositionToModelPosition(new Position(firstViewLineNumber, this.getLineMinColumn(firstViewLineNumber)));
        const firstPositionDeltaTop = this.viewLayout.getVerticalOffsetForLineNumber(firstViewLineNumber) - scrollTop;
        return {
            scrollLeft: compatViewState.scrollLeft,
            firstPosition: firstPosition,
            firstPositionDeltaTop: firstPositionDeltaTop
        };
    }
    reduceRestoreState(state) {
        if (typeof state.firstPosition === 'undefined') {
            // This is a view state serialized by an older version
            return this._reduceRestoreStateCompatibility(state);
        }
        const modelPosition = this.model.validatePosition(state.firstPosition);
        const viewPosition = this.coordinatesConverter.convertModelPositionToViewPosition(modelPosition);
        const scrollTop = this.viewLayout.getVerticalOffsetForLineNumber(viewPosition.lineNumber) - state.firstPositionDeltaTop;
        return {
            scrollLeft: state.scrollLeft,
            scrollTop: scrollTop
        };
    }
    _reduceRestoreStateCompatibility(state) {
        return {
            scrollLeft: state.scrollLeft,
            scrollTop: state.scrollTopWithoutViewZones
        };
    }
    getTabSize() {
        return this.model.getOptions().tabSize;
    }
    getLineCount() {
        return this._lines.getViewLineCount();
    }
    /**
     * Gives a hint that a lot of requests are about to come in for these line numbers.
     */
    setViewport(startLineNumber, endLineNumber, centeredLineNumber) {
        this._viewportStart.update(this, startLineNumber);
    }
    getActiveIndentGuide(lineNumber, minLineNumber, maxLineNumber) {
        return this._lines.getActiveIndentGuide(lineNumber, minLineNumber, maxLineNumber);
    }
    getLinesIndentGuides(startLineNumber, endLineNumber) {
        return this._lines.getViewLinesIndentGuides(startLineNumber, endLineNumber);
    }
    getBracketGuidesInRangeByLine(startLineNumber, endLineNumber, activePosition, options) {
        return this._lines.getViewLinesBracketGuides(startLineNumber, endLineNumber, activePosition, options);
    }
    getLineContent(lineNumber) {
        return this._lines.getViewLineContent(lineNumber);
    }
    getLineLength(lineNumber) {
        return this._lines.getViewLineLength(lineNumber);
    }
    getLineMinColumn(lineNumber) {
        return this._lines.getViewLineMinColumn(lineNumber);
    }
    getLineMaxColumn(lineNumber) {
        return this._lines.getViewLineMaxColumn(lineNumber);
    }
    getLineFirstNonWhitespaceColumn(lineNumber) {
        const result = strings.firstNonWhitespaceIndex(this.getLineContent(lineNumber));
        if (result === -1) {
            return 0;
        }
        return result + 1;
    }
    getLineLastNonWhitespaceColumn(lineNumber) {
        const result = strings.lastNonWhitespaceIndex(this.getLineContent(lineNumber));
        if (result === -1) {
            return 0;
        }
        return result + 2;
    }
    getMinimapDecorationsInRange(range) {
        return this._decorations.getMinimapDecorationsInRange(range);
    }
    getDecorationsInViewport(visibleRange) {
        return this._decorations.getDecorationsViewportData(visibleRange).decorations;
    }
    getInjectedTextAt(viewPosition) {
        return this._lines.getInjectedTextAt(viewPosition);
    }
    _getTextDirection(lineNumber, decorations) {
        let rtlCount = 0;
        for (const decoration of decorations) {
            const range = decoration.range;
            if (range.startLineNumber > lineNumber || range.endLineNumber < lineNumber) {
                continue;
            }
            const textDirection = decoration.options.textDirection;
            if (textDirection === TextDirection.RTL) {
                rtlCount++;
            }
            else if (textDirection === TextDirection.LTR) {
                rtlCount--;
            }
        }
        return rtlCount > 0 ? TextDirection.RTL : TextDirection.LTR;
    }
    getTextDirection(lineNumber) {
        const decorationsCollection = this._decorations.getDecorationsOnLine(lineNumber);
        return this._getTextDirection(lineNumber, decorationsCollection.decorations);
    }
    getViewportViewLineRenderingData(visibleRange, lineNumber) {
        const viewportDecorationsCollection = this._decorations.getDecorationsViewportData(visibleRange);
        const inlineDecorations = viewportDecorationsCollection.inlineDecorations[lineNumber - visibleRange.startLineNumber];
        return this._getViewLineRenderingData(lineNumber, inlineDecorations, viewportDecorationsCollection.hasVariableFonts, viewportDecorationsCollection.decorations);
    }
    getViewLineRenderingData(lineNumber) {
        const decorationsCollection = this._decorations.getDecorationsOnLine(lineNumber);
        return this._getViewLineRenderingData(lineNumber, decorationsCollection.inlineDecorations[0], decorationsCollection.hasVariableFonts, decorationsCollection.decorations);
    }
    _getViewLineRenderingData(lineNumber, inlineDecorations, hasVariableFonts, decorations) {
        const mightContainRTL = this.model.mightContainRTL();
        const mightContainNonBasicASCII = this.model.mightContainNonBasicASCII();
        const tabSize = this.getTabSize();
        const lineData = this._lines.getViewLineData(lineNumber);
        if (lineData.inlineDecorations) {
            inlineDecorations = [
                ...inlineDecorations,
                ...lineData.inlineDecorations.map(d => d.toInlineDecoration(lineNumber))
            ];
        }
        return new ViewLineRenderingData(lineData.minColumn, lineData.maxColumn, lineData.content, lineData.continuesWithWrappedLine, mightContainRTL, mightContainNonBasicASCII, lineData.tokens, inlineDecorations, tabSize, lineData.startVisibleColumn, this._getTextDirection(lineNumber, decorations), hasVariableFonts);
    }
    getViewLineData(lineNumber) {
        return this._lines.getViewLineData(lineNumber);
    }
    getMinimapLinesRenderingData(startLineNumber, endLineNumber, needed) {
        const result = this._lines.getViewLinesData(startLineNumber, endLineNumber, needed);
        return new MinimapLinesRenderingData(this.getTabSize(), result);
    }
    getAllOverviewRulerDecorations(theme) {
        const decorations = this.model.getOverviewRulerDecorations(this._editorId, filterValidationDecorations(this._configuration.options), filterFontDecorations(this._configuration.options));
        const result = new OverviewRulerDecorations();
        for (const decoration of decorations) {
            const decorationOptions = decoration.options;
            const opts = decorationOptions.overviewRuler;
            if (!opts) {
                continue;
            }
            const lane = opts.position;
            if (lane === 0) {
                continue;
            }
            const color = opts.getColor(theme.value);
            const viewStartLineNumber = this.coordinatesConverter.getViewLineNumberOfModelPosition(decoration.range.startLineNumber, decoration.range.startColumn);
            const viewEndLineNumber = this.coordinatesConverter.getViewLineNumberOfModelPosition(decoration.range.endLineNumber, decoration.range.endColumn);
            result.accept(color, decorationOptions.zIndex, viewStartLineNumber, viewEndLineNumber, lane);
        }
        return result.asArray;
    }
    _invalidateDecorationsColorCache() {
        const decorations = this.model.getOverviewRulerDecorations();
        for (const decoration of decorations) {
            const opts1 = decoration.options.overviewRuler;
            opts1?.invalidateCachedColor();
            const opts2 = decoration.options.minimap;
            opts2?.invalidateCachedColor();
        }
    }
    getValueInRange(range, eol) {
        const modelRange = this.coordinatesConverter.convertViewRangeToModelRange(range);
        return this.model.getValueInRange(modelRange, eol);
    }
    getValueLengthInRange(range, eol) {
        const modelRange = this.coordinatesConverter.convertViewRangeToModelRange(range);
        return this.model.getValueLengthInRange(modelRange, eol);
    }
    modifyPosition(position, offset) {
        const modelPosition = this.coordinatesConverter.convertViewPositionToModelPosition(position);
        const resultModelPosition = this.model.modifyPosition(modelPosition, offset);
        return this.coordinatesConverter.convertModelPositionToViewPosition(resultModelPosition);
    }
    deduceModelPositionRelativeToViewPosition(viewAnchorPosition, deltaOffset, lineFeedCnt) {
        const modelAnchor = this.coordinatesConverter.convertViewPositionToModelPosition(viewAnchorPosition);
        if (this.model.getEOL().length === 2) {
            // This model uses CRLF, so the delta must take that into account
            if (deltaOffset < 0) {
                deltaOffset -= lineFeedCnt;
            }
            else {
                deltaOffset += lineFeedCnt;
            }
        }
        const modelAnchorOffset = this.model.getOffsetAt(modelAnchor);
        const resultOffset = modelAnchorOffset + deltaOffset;
        return this.model.getPositionAt(resultOffset);
    }
    getPlainTextToCopy(modelRanges, emptySelectionClipboard, forceCRLF) {
        const newLineCharacter = forceCRLF ? '\r\n' : this.model.getEOL();
        modelRanges = modelRanges.slice(0);
        modelRanges.sort(Range.compareRangesUsingStarts);
        let hasEmptyRange = false;
        let hasNonEmptyRange = false;
        for (const range of modelRanges) {
            if (range.isEmpty()) {
                hasEmptyRange = true;
            }
            else {
                hasNonEmptyRange = true;
            }
        }
        if (!hasNonEmptyRange) {
            // all ranges are empty
            if (!emptySelectionClipboard) {
                return '';
            }
            const modelLineNumbers = modelRanges.map((r) => r.startLineNumber);
            let result = '';
            for (let i = 0; i < modelLineNumbers.length; i++) {
                if (i > 0 && modelLineNumbers[i - 1] === modelLineNumbers[i]) {
                    continue;
                }
                result += this.model.getLineContent(modelLineNumbers[i]) + newLineCharacter;
            }
            return result;
        }
        if (hasEmptyRange && emptySelectionClipboard) {
            // mixed empty selections and non-empty selections
            const result = [];
            let prevModelLineNumber = 0;
            for (const modelRange of modelRanges) {
                const modelLineNumber = modelRange.startLineNumber;
                if (modelRange.isEmpty()) {
                    if (modelLineNumber !== prevModelLineNumber) {
                        result.push(this.model.getLineContent(modelLineNumber));
                    }
                }
                else {
                    result.push(this.model.getValueInRange(modelRange, forceCRLF ? 2 /* EndOfLinePreference.CRLF */ : 0 /* EndOfLinePreference.TextDefined */));
                }
                prevModelLineNumber = modelLineNumber;
            }
            return result.length === 1 ? result[0] : result;
        }
        const result = [];
        for (const modelRange of modelRanges) {
            if (!modelRange.isEmpty()) {
                result.push(this.model.getValueInRange(modelRange, forceCRLF ? 2 /* EndOfLinePreference.CRLF */ : 0 /* EndOfLinePreference.TextDefined */));
            }
        }
        return result.length === 1 ? result[0] : result;
    }
    getRichTextToCopy(modelRanges, emptySelectionClipboard) {
        const languageId = this.model.getLanguageId();
        if (languageId === PLAINTEXT_LANGUAGE_ID) {
            return null;
        }
        if (modelRanges.length !== 1) {
            // no multiple selection support at this time
            return null;
        }
        let range = modelRanges[0];
        if (range.isEmpty()) {
            if (!emptySelectionClipboard) {
                // nothing to copy
                return null;
            }
            const lineNumber = range.startLineNumber;
            range = new Range(lineNumber, this.model.getLineMinColumn(lineNumber), lineNumber, this.model.getLineMaxColumn(lineNumber));
        }
        const fontInfo = this._configuration.options.get(59 /* EditorOption.fontInfo */);
        const colorMap = this._getColorMap();
        const hasBadChars = (/[:;\\\/<>]/.test(fontInfo.fontFamily));
        const useDefaultFontFamily = (hasBadChars || fontInfo.fontFamily === EDITOR_FONT_DEFAULTS.fontFamily);
        let fontFamily;
        if (useDefaultFontFamily) {
            fontFamily = EDITOR_FONT_DEFAULTS.fontFamily;
        }
        else {
            fontFamily = fontInfo.fontFamily;
            fontFamily = fontFamily.replace(/"/g, '\'');
            const hasQuotesOrIsList = /[,']/.test(fontFamily);
            if (!hasQuotesOrIsList) {
                const needsQuotes = /[+ ]/.test(fontFamily);
                if (needsQuotes) {
                    fontFamily = `'${fontFamily}'`;
                }
            }
            fontFamily = `${fontFamily}, ${EDITOR_FONT_DEFAULTS.fontFamily}`;
        }
        return {
            mode: languageId,
            html: (`<div style="`
                + `color: ${colorMap[1 /* ColorId.DefaultForeground */]};`
                + `background-color: ${colorMap[2 /* ColorId.DefaultBackground */]};`
                + `font-family: ${fontFamily};`
                + `font-weight: ${fontInfo.fontWeight};`
                + `font-size: ${fontInfo.fontSize}px;`
                + `line-height: ${fontInfo.lineHeight}px;`
                + `white-space: pre;`
                + `">`
                + this._getHTMLToCopy(range, colorMap)
                + '</div>')
        };
    }
    _getHTMLToCopy(modelRange, colorMap) {
        const startLineNumber = modelRange.startLineNumber;
        const startColumn = modelRange.startColumn;
        const endLineNumber = modelRange.endLineNumber;
        const endColumn = modelRange.endColumn;
        const tabSize = this.getTabSize();
        let result = '';
        for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
            const lineTokens = this.model.tokenization.getLineTokens(lineNumber);
            const lineContent = lineTokens.getLineContent();
            const startOffset = (lineNumber === startLineNumber ? startColumn - 1 : 0);
            const endOffset = (lineNumber === endLineNumber ? endColumn - 1 : lineContent.length);
            if (lineContent === '') {
                result += '<br>';
            }
            else {
                result += tokenizeLineToHTML(lineContent, lineTokens.inflate(), colorMap, startOffset, endOffset, tabSize, platform.isWindows);
            }
        }
        return result;
    }
    _getColorMap() {
        const colorMap = TokenizationRegistry.getColorMap();
        const result = ['#000000'];
        if (colorMap) {
            for (let i = 1, len = colorMap.length; i < len; i++) {
                result[i] = Color.Format.CSS.formatHex(colorMap[i]);
            }
        }
        return result;
    }
    //#region cursor operations
    getPrimaryCursorState() {
        return this._cursor.getPrimaryCursorState();
    }
    getLastAddedCursorIndex() {
        return this._cursor.getLastAddedCursorIndex();
    }
    getCursorStates() {
        return this._cursor.getCursorStates();
    }
    setCursorStates(source, reason, states) {
        return this._withViewEventsCollector(eventsCollector => this._cursor.setStates(eventsCollector, source, reason, states));
    }
    getCursorColumnSelectData() {
        return this._cursor.getCursorColumnSelectData();
    }
    getCursorAutoClosedCharacters() {
        return this._cursor.getAutoClosedCharacters();
    }
    setCursorColumnSelectData(columnSelectData) {
        this._cursor.setCursorColumnSelectData(columnSelectData);
    }
    getPrevEditOperationType() {
        return this._cursor.getPrevEditOperationType();
    }
    setPrevEditOperationType(type) {
        this._cursor.setPrevEditOperationType(type);
    }
    getSelection() {
        return this._cursor.getSelection();
    }
    getSelections() {
        return this._cursor.getSelections();
    }
    getPosition() {
        return this._cursor.getPrimaryCursorState().modelState.position;
    }
    setSelections(source, selections, reason = 0 /* CursorChangeReason.NotSet */) {
        this._withViewEventsCollector(eventsCollector => this._cursor.setSelections(eventsCollector, source, selections, reason));
    }
    saveCursorState() {
        return this._cursor.saveState();
    }
    restoreCursorState(states) {
        this._withViewEventsCollector(eventsCollector => this._cursor.restoreState(eventsCollector, states));
    }
    _executeCursorEdit(callback) {
        if (this._cursor.context.cursorConfig.readOnly) {
            // we cannot edit when read only...
            this._eventDispatcher.emitOutgoingEvent(new ReadOnlyEditAttemptEvent());
            return;
        }
        this._withViewEventsCollector(callback);
    }
    executeEdits(source, edits, cursorStateComputer, reason) {
        this._executeCursorEdit(eventsCollector => this._cursor.executeEdits(eventsCollector, source, edits, cursorStateComputer, reason));
    }
    startComposition() {
        this._executeCursorEdit(eventsCollector => this._cursor.startComposition(eventsCollector));
    }
    endComposition(source) {
        this._executeCursorEdit(eventsCollector => this._cursor.endComposition(eventsCollector, source));
    }
    type(text, source) {
        this._executeCursorEdit(eventsCollector => this._cursor.type(eventsCollector, text, source));
    }
    compositionType(text, replacePrevCharCnt, replaceNextCharCnt, positionDelta, source) {
        this._executeCursorEdit(eventsCollector => this._cursor.compositionType(eventsCollector, text, replacePrevCharCnt, replaceNextCharCnt, positionDelta, source));
    }
    paste(text, pasteOnNewLine, multicursorText, source) {
        this._executeCursorEdit(eventsCollector => this._cursor.paste(eventsCollector, text, pasteOnNewLine, multicursorText, source));
    }
    cut(source) {
        this._executeCursorEdit(eventsCollector => this._cursor.cut(eventsCollector, source));
    }
    executeCommand(command, source) {
        this._executeCursorEdit(eventsCollector => this._cursor.executeCommand(eventsCollector, command, source));
    }
    executeCommands(commands, source) {
        this._executeCursorEdit(eventsCollector => this._cursor.executeCommands(eventsCollector, commands, source));
    }
    revealAllCursors(source, revealHorizontal, minimalReveal = false) {
        this._withViewEventsCollector(eventsCollector => this._cursor.revealAll(eventsCollector, source, minimalReveal, 0 /* viewEvents.VerticalRevealType.Simple */, revealHorizontal, 0 /* ScrollType.Smooth */));
    }
    revealPrimaryCursor(source, revealHorizontal, minimalReveal = false) {
        this._withViewEventsCollector(eventsCollector => this._cursor.revealPrimary(eventsCollector, source, minimalReveal, 0 /* viewEvents.VerticalRevealType.Simple */, revealHorizontal, 0 /* ScrollType.Smooth */));
    }
    revealTopMostCursor(source) {
        const viewPosition = this._cursor.getTopMostViewPosition();
        const viewRange = new Range(viewPosition.lineNumber, viewPosition.column, viewPosition.lineNumber, viewPosition.column);
        this._withViewEventsCollector(eventsCollector => eventsCollector.emitViewEvent(new viewEvents.ViewRevealRangeRequestEvent(source, false, viewRange, null, 0 /* viewEvents.VerticalRevealType.Simple */, true, 0 /* ScrollType.Smooth */)));
    }
    revealBottomMostCursor(source) {
        const viewPosition = this._cursor.getBottomMostViewPosition();
        const viewRange = new Range(viewPosition.lineNumber, viewPosition.column, viewPosition.lineNumber, viewPosition.column);
        this._withViewEventsCollector(eventsCollector => eventsCollector.emitViewEvent(new viewEvents.ViewRevealRangeRequestEvent(source, false, viewRange, null, 0 /* viewEvents.VerticalRevealType.Simple */, true, 0 /* ScrollType.Smooth */)));
    }
    revealRange(source, revealHorizontal, viewRange, verticalType, scrollType) {
        this._withViewEventsCollector(eventsCollector => eventsCollector.emitViewEvent(new viewEvents.ViewRevealRangeRequestEvent(source, false, viewRange, null, verticalType, revealHorizontal, scrollType)));
    }
    //#endregion
    //#region viewLayout
    changeWhitespace(callback) {
        const hadAChange = this.viewLayout.changeWhitespace(callback);
        if (hadAChange) {
            this._eventDispatcher.emitSingleViewEvent(new viewEvents.ViewZonesChangedEvent());
            this._eventDispatcher.emitOutgoingEvent(new ViewZonesChangedEvent());
        }
    }
    //#endregion
    _withViewEventsCollector(callback) {
        return this._transactionalTarget.batchChanges(() => {
            try {
                const eventsCollector = this._eventDispatcher.beginEmitViewEvents();
                return callback(eventsCollector);
            }
            finally {
                this._eventDispatcher.endEmitViewEvents();
            }
        });
    }
    batchEvents(callback) {
        this._withViewEventsCollector(() => { callback(); });
    }
    normalizePosition(position, affinity) {
        return this._lines.normalizePosition(position, affinity);
    }
    /**
     * Gets the column at which indentation stops at a given line.
     * @internal
    */
    getLineIndentColumn(lineNumber) {
        return this._lines.getLineIndentColumn(lineNumber);
    }
}
class ViewportStart {
    static create(model) {
        const viewportStartLineTrackedRange = model._setTrackedRange(null, new Range(1, 1, 1, 1), 1 /* TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges */);
        return new ViewportStart(model, 1, false, viewportStartLineTrackedRange, 0);
    }
    get viewLineNumber() {
        return this._viewLineNumber;
    }
    get isValid() {
        return this._isValid;
    }
    get modelTrackedRange() {
        return this._modelTrackedRange;
    }
    get startLineDelta() {
        return this._startLineDelta;
    }
    constructor(_model, _viewLineNumber, _isValid, _modelTrackedRange, _startLineDelta) {
        this._model = _model;
        this._viewLineNumber = _viewLineNumber;
        this._isValid = _isValid;
        this._modelTrackedRange = _modelTrackedRange;
        this._startLineDelta = _startLineDelta;
    }
    dispose() {
        this._model._setTrackedRange(this._modelTrackedRange, null, 1 /* TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges */);
    }
    update(viewModel, startLineNumber) {
        const position = viewModel.coordinatesConverter.convertViewPositionToModelPosition(new Position(startLineNumber, viewModel.getLineMinColumn(startLineNumber)));
        const viewportStartLineTrackedRange = viewModel.model._setTrackedRange(this._modelTrackedRange, new Range(position.lineNumber, position.column, position.lineNumber, position.column), 1 /* TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges */);
        const viewportStartLineTop = viewModel.viewLayout.getVerticalOffsetForLineNumber(startLineNumber);
        const scrollTop = viewModel.viewLayout.getCurrentScrollTop();
        this._viewLineNumber = startLineNumber;
        this._isValid = true;
        this._modelTrackedRange = viewportStartLineTrackedRange;
        this._startLineDelta = scrollTop - viewportStartLineTop;
    }
    invalidate() {
        this._isValid = false;
    }
}
class OverviewRulerDecorations {
    constructor() {
        this._asMap = Object.create(null);
        this.asArray = [];
    }
    accept(color, zIndex, startLineNumber, endLineNumber, lane) {
        const prevGroup = this._asMap[color];
        if (prevGroup) {
            const prevData = prevGroup.data;
            const prevLane = prevData[prevData.length - 3];
            const prevEndLineNumber = prevData[prevData.length - 1];
            if (prevLane === lane && prevEndLineNumber + 1 >= startLineNumber) {
                // merge into prev
                if (endLineNumber > prevEndLineNumber) {
                    prevData[prevData.length - 1] = endLineNumber;
                }
                return;
            }
            // push
            prevData.push(lane, startLineNumber, endLineNumber);
        }
        else {
            const group = new OverviewRulerDecorationsGroup(color, zIndex, [lane, startLineNumber, endLineNumber]);
            this._asMap[color] = group;
            this.asArray.push(group);
        }
    }
}
class HiddenAreasModel {
    constructor() {
        this.hiddenAreas = new Map();
        this.shouldRecompute = false;
        this.ranges = [];
    }
    setHiddenAreas(source, ranges) {
        const existing = this.hiddenAreas.get(source);
        if (existing && rangeArraysEqual(existing, ranges)) {
            return;
        }
        this.hiddenAreas.set(source, ranges);
        this.shouldRecompute = true;
    }
    /**
     * The returned array is immutable.
    */
    getMergedRanges() {
        if (!this.shouldRecompute) {
            return this.ranges;
        }
        this.shouldRecompute = false;
        const newRanges = Array.from(this.hiddenAreas.values()).reduce((r, hiddenAreas) => mergeLineRangeArray(r, hiddenAreas), []);
        if (rangeArraysEqual(this.ranges, newRanges)) {
            return this.ranges;
        }
        this.ranges = newRanges;
        return this.ranges;
    }
}
function mergeLineRangeArray(arr1, arr2) {
    const result = [];
    let i = 0;
    let j = 0;
    while (i < arr1.length && j < arr2.length) {
        const item1 = arr1[i];
        const item2 = arr2[j];
        if (item1.endLineNumber < item2.startLineNumber - 1) {
            result.push(arr1[i++]);
        }
        else if (item2.endLineNumber < item1.startLineNumber - 1) {
            result.push(arr2[j++]);
        }
        else {
            const startLineNumber = Math.min(item1.startLineNumber, item2.startLineNumber);
            const endLineNumber = Math.max(item1.endLineNumber, item2.endLineNumber);
            result.push(new Range(startLineNumber, 1, endLineNumber, 1));
            i++;
            j++;
        }
    }
    while (i < arr1.length) {
        result.push(arr1[i++]);
    }
    while (j < arr2.length) {
        result.push(arr2[j++]);
    }
    return result;
}
function rangeArraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) {
        return false;
    }
    for (let i = 0; i < arr1.length; i++) {
        if (!arr1[i].equalsRange(arr2[i])) {
            return false;
        }
    }
    return true;
}
/**
 * Maintain a stable viewport by trying to keep the first line in the viewport constant.
 */
class StableViewport {
    constructor(viewportStartModelPosition, startLineDelta) {
        this.viewportStartModelPosition = viewportStartModelPosition;
        this.startLineDelta = startLineDelta;
    }
    recoverViewportStart(coordinatesConverter, viewLayout) {
        if (!this.viewportStartModelPosition) {
            return;
        }
        const viewPosition = coordinatesConverter.convertModelPositionToViewPosition(this.viewportStartModelPosition);
        const viewPositionTop = viewLayout.getVerticalOffsetForLineNumber(viewPosition.lineNumber);
        viewLayout.setScrollPosition({ scrollTop: viewPositionTop + this.startLineDelta }, 1 /* ScrollType.Immediate */);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld01vZGVsSW1wbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL3ZpZXdNb2RlbC92aWV3TW9kZWxJbXBsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUM1RCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNqRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFdEQsT0FBTyxFQUFFLFVBQVUsRUFBZSxNQUFNLG1DQUFtQyxDQUFDO0FBQzVFLE9BQU8sS0FBSyxRQUFRLE1BQU0sa0NBQWtDLENBQUM7QUFDN0QsT0FBTyxLQUFLLE9BQU8sTUFBTSxpQ0FBaUMsQ0FBQztBQUMzRCxPQUFPLEVBQTJDLDJCQUEyQixFQUFFLHFCQUFxQixFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDekksT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDN0QsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDeEQsT0FBTyxFQUFFLG1CQUFtQixFQUF5RSxNQUFNLG9CQUFvQixDQUFDO0FBRWhJLE9BQU8sRUFBYSxRQUFRLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUMxRCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFJekMsT0FBTyxFQUFrSixhQUFhLEVBQTBCLE1BQU0sYUFBYSxDQUFDO0FBR3BOLE9BQU8sS0FBSyxlQUFlLE1BQU0sdUJBQXVCLENBQUM7QUFDekQsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFHdkQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDdEUsT0FBTyxFQUFFLGtC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