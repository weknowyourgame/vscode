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
var XtermTerminal_1;
import * as dom from '../../../../../base/browser/dom.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { ITerminalLogService } from '../../../../../platform/terminal/common/terminal.js';
import { ITerminalConfigurationService } from '../terminal.js';
import { LogLevel } from '../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { MarkNavigationAddon } from './markNavigationAddon.js';
import { localize } from '../../../../../nls.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { PANEL_BACKGROUND } from '../../../../common/theme.js';
import { TERMINAL_FOREGROUND_COLOR, TERMINAL_BACKGROUND_COLOR, TERMINAL_CURSOR_FOREGROUND_COLOR, TERMINAL_CURSOR_BACKGROUND_COLOR, ansiColorIdentifiers, TERMINAL_SELECTION_BACKGROUND_COLOR, TERMINAL_FIND_MATCH_BACKGROUND_COLOR, TERMINAL_FIND_MATCH_HIGHLIGHT_BACKGROUND_COLOR, TERMINAL_FIND_MATCH_BORDER_COLOR, TERMINAL_OVERVIEW_RULER_FIND_MATCH_FOREGROUND_COLOR, TERMINAL_FIND_MATCH_HIGHLIGHT_BORDER_COLOR, TERMINAL_OVERVIEW_RULER_CURSOR_FOREGROUND_COLOR, TERMINAL_SELECTION_FOREGROUND_COLOR, TERMINAL_INACTIVE_SELECTION_BACKGROUND_COLOR, TERMINAL_OVERVIEW_RULER_BORDER_COLOR } from '../../common/terminalColorRegistry.js';
import { ShellIntegrationAddon } from '../../../../../platform/terminal/common/xterm/shellIntegrationAddon.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { DecorationAddon } from './decorationAddon.js';
import { Emitter } from '../../../../../base/common/event.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { TerminalContextKeys } from '../../common/terminalContextKey.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { debounce } from '../../../../../base/common/decorators.js';
import { MouseWheelClassifier } from '../../../../../base/browser/ui/scrollbar/scrollableElement.js';
import { StandardWheelEvent } from '../../../../../base/browser/mouseEvent.js';
import { ILayoutService } from '../../../../../platform/layout/browser/layoutService.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { scrollbarSliderActiveBackground, scrollbarSliderBackground, scrollbarSliderHoverBackground } from '../../../../../platform/theme/common/colorRegistry.js';
import { XtermAddonImporter } from './xtermAddonImporter.js';
import { equals } from '../../../../../base/common/objects.js';
import { assert } from '../../../../../base/common/assert.js';
var RenderConstants;
(function (RenderConstants) {
    RenderConstants[RenderConstants["SmoothScrollDuration"] = 125] = "SmoothScrollDuration";
})(RenderConstants || (RenderConstants = {}));
function getFullBufferLineAsString(lineIndex, buffer) {
    let line = buffer.getLine(lineIndex);
    if (!line) {
        return { lineData: undefined, lineIndex };
    }
    let lineData = line.translateToString(true);
    while (lineIndex > 0 && line.isWrapped) {
        line = buffer.getLine(--lineIndex);
        if (!line) {
            break;
        }
        lineData = line.translateToString(false) + lineData;
    }
    return { lineData, lineIndex };
}
/**
 * Wraps the xterm object with additional functionality. Interaction with the backing process is out
 * of the scope of this class.
 */
let XtermTerminal = class XtermTerminal extends Disposable {
    static { XtermTerminal_1 = this; }
    static { this._suggestedRendererType = undefined; }
    get lastInputEvent() { return this._lastInputEvent; }
    get progressState() { return this._progressState; }
    get findResult() { return this._lastFindResult; }
    get isStdinDisabled() { return !!this.raw.options.disableStdin; }
    get isGpuAccelerated() { return !!this._webglAddon; }
    get markTracker() { return this._markNavigationAddon; }
    get shellIntegration() { return this._shellIntegrationAddon; }
    get decorationAddon() { return this._decorationAddon; }
    get textureAtlas() {
        const canvas = this._webglAddon?.textureAtlas;
        if (!canvas) {
            return undefined;
        }
        return createImageBitmap(canvas);
    }
    get isFocused() {
        if (!this.raw.element) {
            return false;
        }
        return dom.isAncestorOfActiveElement(this.raw.element);
    }
    /**
     * @param xtermCtor The xterm.js constructor, this is passed in so it can be fetched lazily
     * outside of this class such that {@link raw} is not nullable.
     */
    constructor(resource, xtermCtor, options, _onDidExecuteText, _configurationService, _instantiationService, _logService, _notificationService, _themeService, _telemetryService, _terminalConfigurationService, _clipboardService, contextKeyService, _accessibilitySignalService, layoutService) {
        super();
        this._onDidExecuteText = _onDidExecuteText;
        this._configurationService = _configurationService;
        this._instantiationService = _instantiationService;
        this._logService = _logService;
        this._notificationService = _notificationService;
        this._themeService = _themeService;
        this._telemetryService = _telemetryService;
        this._terminalConfigurationService = _terminalConfigurationService;
        this._clipboardService = _clipboardService;
        this._accessibilitySignalService = _accessibilitySignalService;
        this._isPhysicalMouseWheel = MouseWheelClassifier.INSTANCE.isPhysicalMouseWheel();
        this._progressState = { state: 0, value: 0 };
        this._ligaturesAddon = this._register(new MutableDisposable());
        this._attachedDisposables = this._register(new DisposableStore());
        this._onDidRequestRunCommand = this._register(new Emitter());
        this.onDidRequestRunCommand = this._onDidRequestRunCommand.event;
        this._onDidRequestCopyAsHtml = this._register(new Emitter());
        this.onDidRequestCopyAsHtml = this._onDidRequestCopyAsHtml.event;
        this._onDidRequestRefreshDimensions = this._register(new Emitter());
        this.onDidRequestRefreshDimensions = this._onDidRequestRefreshDimensions.event;
        this._onDidChangeFindResults = this._register(new Emitter());
        this.onDidChangeFindResults = this._onDidChangeFindResults.event;
        this._onDidChangeSelection = this._register(new Emitter());
        this.onDidChangeSelection = this._onDidChangeSelection.event;
        this._onDidChangeFocus = this._register(new Emitter());
        this.onDidChangeFocus = this._onDidChangeFocus.event;
        this._onDidDispose = this._register(new Emitter());
        this.onDidDispose = this._onDidDispose.event;
        this._onDidChangeProgress = this._register(new Emitter());
        this.onDidChangeProgress = this._onDidChangeProgress.event;
        this._xtermAddonLoader = options.xtermAddonImporter ?? new XtermAddonImporter();
        this._xtermColorProvider = options.xtermColorProvider;
        this._capabilities = options.capabilities;
        const font = this._terminalConfigurationService.getFont(dom.getActiveWindow(), undefined, true);
        const config = this._terminalConfigurationService.config;
        const editorOptions = this._configurationService.getValue('editor');
        this.raw = this._register(new xtermCtor({
            allowProposedApi: true,
            cols: options.cols,
            rows: options.rows,
            documentOverride: layoutService.mainContainer.ownerDocument,
            altClickMovesCursor: config.altClickMovesCursor && editorOptions.multiCursorModifier === 'alt',
            scrollback: config.scrollback,
            theme: this.getXtermTheme(),
            drawBoldTextInBrightColors: config.drawBoldTextInBrightColors,
            fontFamily: font.fontFamily,
            fontWeight: config.fontWeight,
            fontWeightBold: config.fontWeightBold,
            fontSize: font.fontSize,
            letterSpacing: font.letterSpacing,
            lineHeight: font.lineHeight,
            logLevel: vscodeToXtermLogLevel(this._logService.getLevel()),
            logger: this._logService,
            minimumContrastRatio: config.minimumContrastRatio,
            tabStopWidth: config.tabStopWidth,
            cursorBlink: config.cursorBlinking,
            cursorStyle: vscodeToXtermCursorStyle(config.cursorStyle),
            cursorInactiveStyle: vscodeToXtermCursorStyle(config.cursorStyleInactive),
            cursorWidth: config.cursorWidth,
            macOptionIsMeta: config.macOptionIsMeta,
            macOptionClickForcesSelection: config.macOptionClickForcesSelection,
            rightClickSelectsWord: config.rightClickBehavior === 'selectWord',
            fastScrollModifier: 'alt',
            fastScrollSensitivity: config.fastScrollSensitivity,
            scrollSensitivity: config.mouseWheelScrollSensitivity,
            scrollOnEraseInDisplay: true,
            wordSeparator: config.wordSeparators,
            overviewRuler: options.disableOverviewRuler ? { width: 0 } : {
                width: 14,
                showTopBorder: true,
            },
            ignoreBracketedPasteMode: config.ignoreBracketedPasteMode,
            rescaleOverlappingGlyphs: config.rescaleOverlappingGlyphs,
            windowOptions: {
                getWinSizePixels: true,
                getCellSizePixels: true,
                getWinSizeChars: true,
            },
        }));
        this._updateSmoothScrolling();
        this._core = this.raw._core;
        this._register(this._configurationService.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration("terminal.integrated.gpuAcceleration" /* TerminalSettingId.GpuAcceleration */)) {
                XtermTerminal_1._suggestedRendererType = undefined;
            }
            if (e.affectsConfiguration('terminal.integrated') || e.affectsConfiguration('editor.fastScrollSensitivity') || e.affectsConfiguration('editor.mouseWheelScrollSensitivity') || e.affectsConfiguration('editor.multiCursorModifier')) {
                this.updateConfig();
            }
            if (e.affectsConfiguration("terminal.integrated.unicodeVersion" /* TerminalSettingId.UnicodeVersion */)) {
                this._updateUnicodeVersion();
            }
            if (e.affectsConfiguration("terminal.integrated.shellIntegration.decorationsEnabled" /* TerminalSettingId.ShellIntegrationDecorationsEnabled */)) {
                this._updateTheme();
            }
        }));
        this._register(this._themeService.onDidColorThemeChange(theme => this._updateTheme(theme)));
        this._register(this._logService.onDidChangeLogLevel(e => this.raw.options.logLevel = vscodeToXtermLogLevel(e)));
        // Refire events
        this._register(this.raw.onSelectionChange(() => {
            this._onDidChangeSelection.fire();
            if (this.isFocused) {
                this._anyFocusedTerminalHasSelection.set(this.raw.hasSelection());
            }
        }));
        this._register(this.raw.onData(e => this._lastInputEvent = e));
        // Load addons
        this._updateUnicodeVersion();
        this._markNavigationAddon = this._instantiationService.createInstance(MarkNavigationAddon, options.capabilities);
        this.raw.loadAddon(this._markNavigationAddon);
        this._decorationAddon = this._instantiationService.createInstance(DecorationAddon, resource, this._capabilities);
        this._register(this._decorationAddon.onDidRequestRunCommand(e => this._onDidRequestRunCommand.fire(e)));
        this._register(this._decorationAddon.onDidRequestCopyAsHtml(e => this._onDidRequestCopyAsHtml.fire(e)));
        this.raw.loadAddon(this._decorationAddon);
        this._shellIntegrationAddon = new ShellIntegrationAddon(options.shellIntegrationNonce ?? '', options.disableShellIntegrationReporting, this._onDidExecuteText, this._telemetryService, this._logService);
        this.raw.loadAddon(this._shellIntegrationAddon);
        this._xtermAddonLoader.importAddon('clipboard').then(ClipboardAddon => {
            if (this._store.isDisposed) {
                return;
            }
            this._clipboardAddon = this._instantiationService.createInstance(ClipboardAddon, undefined, {
                async readText(type) {
                    return _clipboardService.readText(type === 'p' ? 'selection' : 'clipboard');
                },
                async writeText(type, text) {
                    return _clipboardService.writeText(text, type === 'p' ? 'selection' : 'clipboard');
                }
            });
            this.raw.loadAddon(this._clipboardAddon);
        });
        this._xtermAddonLoader.importAddon('progress').then(ProgressAddon => {
            if (this._store.isDisposed) {
                return;
            }
            const progressAddon = this._instantiationService.createInstance(ProgressAddon);
            this.raw.loadAddon(progressAddon);
            const updateProgress = () => {
                if (!equals(this._progressState, progressAddon.progress)) {
                    this._progressState = progressAddon.progress;
                    this._onDidChangeProgress.fire(this._progressState);
                }
            };
            this._register(progressAddon.onChange(() => updateProgress()));
            updateProgress();
            const commandDetection = this._capabilities.get(2 /* TerminalCapability.CommandDetection */);
            if (commandDetection) {
                this._register(commandDetection.onCommandFinished(() => progressAddon.progress = { state: 0, value: 0 }));
            }
            else {
                const disposable = this._capabilities.onDidAddCapability(e => {
                    if (e.id === 2 /* TerminalCapability.CommandDetection */) {
                        this._register(e.capability.onCommandFinished(() => progressAddon.progress = { state: 0, value: 0 }));
                        this._store.delete(disposable);
                    }
                });
                this._store.add(disposable);
            }
        });
        this._anyTerminalFocusContextKey = TerminalContextKeys.focusInAny.bindTo(contextKeyService);
        this._anyFocusedTerminalHasSelection = TerminalContextKeys.textSelectedInFocused.bindTo(contextKeyService);
    }
    *getBufferReverseIterator() {
        for (let i = this.raw.buffer.active.length - 1; i >= 0; i--) {
            const { lineData, lineIndex } = getFullBufferLineAsString(i, this.raw.buffer.active);
            if (lineData) {
                i = lineIndex;
                yield lineData;
            }
        }
    }
    getContentsAsText(startMarker, endMarker) {
        const lines = [];
        const buffer = this.raw.buffer.active;
        if (startMarker?.line === -1) {
            throw new Error('Cannot get contents of a disposed startMarker');
        }
        if (endMarker?.line === -1) {
            throw new Error('Cannot get contents of a disposed endMarker');
        }
        const startLine = startMarker?.line ?? 0;
        const endLine = endMarker?.line ?? buffer.length - 1;
        for (let y = startLine; y <= endLine; y++) {
            lines.push(buffer.getLine(y)?.translateToString(true) ?? '');
        }
        return lines.join('\n');
    }
    async getContentsAsHtml() {
        if (!this._serializeAddon) {
            const Addon = await this._xtermAddonLoader.importAddon('serialize');
            this._serializeAddon = new Addon();
            this.raw.loadAddon(this._serializeAddon);
        }
        return this._serializeAddon.serializeAsHTML();
    }
    async getCommandOutputAsHtml(command, maxLines) {
        if (!this._serializeAddon) {
            const Addon = await this._xtermAddonLoader.importAddon('serialize');
            this._serializeAddon = new Addon();
            this.raw.loadAddon(this._serializeAddon);
        }
        let startLine;
        let startCol;
        if (command.executedMarker && command.executedMarker.line >= 0) {
            startLine = command.executedMarker.line;
            startCol = Math.max(command.executedX ?? 0, 0);
        }
        else {
            startLine = command.marker?.line !== undefined ? command.marker.line + 1 : 1;
            startCol = Math.max(command.startX ?? 0, 0);
        }
        let endLine = command.endMarker?.line !== undefined ? command.endMarker.line - 1 : this.raw.buffer.active.length - 1;
        if (endLine < startLine) {
            return { text: '', truncated: false };
        }
        // Trim empty lines from the end
        let emptyLinesFromEnd = 0;
        for (let i = endLine; i >= startLine; i--) {
            const line = this.raw.buffer.active.getLine(i);
            if (line && line.translateToString(true).trim() === '') {
                emptyLinesFromEnd++;
            }
            else {
                break;
            }
        }
        endLine = endLine - emptyLinesFromEnd;
        // Trim empty lines from the start
        let emptyLinesFromStart = 0;
        for (let i = startLine; i <= endLine; i++) {
            const line = this.raw.buffer.active.getLine(i);
            if (line && line.translateToString(true, i === startLine ? startCol : undefined).trim() === '') {
                if (i === startLine) {
                    startCol = 0;
                }
                emptyLinesFromStart++;
            }
            else {
                break;
            }
        }
        startLine = startLine + emptyLinesFromStart;
        if (maxLines && endLine - startLine > maxLines) {
            startLine = endLine - maxLines;
            startCol = 0;
        }
        const bufferLine = this.raw.buffer.active.getLine(startLine);
        if (bufferLine) {
            startCol = Math.min(startCol, bufferLine.length);
        }
        const range = { startLine, endLine, startCol };
        const result = this._serializeAddon.serializeAsHTML({ range });
        return { text: result, truncated: (endLine - startLine) >= maxLines };
    }
    async getSelectionAsHtml(command) {
        if (!this._serializeAddon) {
            const Addon = await this._xtermAddonLoader.importAddon('serialize');
            this._serializeAddon = new Addon();
            this.raw.loadAddon(this._serializeAddon);
        }
        if (command) {
            const length = command.getOutput()?.length;
            const row = command.marker?.line;
            if (!length || !row) {
                throw new Error(`No row ${row} or output length ${length} for command ${command}`);
            }
            this.raw.select(0, row + 1, length - Math.floor(length / this.raw.cols));
        }
        const result = this._serializeAddon.serializeAsHTML({ onlySelection: true });
        if (command) {
            this.raw.clearSelection();
        }
        return result;
    }
    attachToElement(container, partialOptions) {
        const options = { enableGpu: true, ...partialOptions };
        if (!this._attached) {
            this.raw.open(container);
        }
        // TODO: Move before open so the DOM renderer doesn't initialize
        if (options.enableGpu) {
            if (this._shouldLoadWebgl()) {
                this._enableWebglRenderer();
            }
        }
        if (!this.raw.element || !this.raw.textarea) {
            throw new Error('xterm elements not set after open');
        }
        const ad = this._attachedDisposables;
        ad.clear();
        ad.add(dom.addDisposableListener(this.raw.textarea, 'focus', () => this._setFocused(true)));
        ad.add(dom.addDisposableListener(this.raw.textarea, 'blur', () => this._setFocused(false)));
        ad.add(dom.addDisposableListener(this.raw.textarea, 'focusout', () => this._setFocused(false)));
        // Track wheel events in mouse wheel classifier and update smoothScrolling when it changes
        // as it must be disabled when a trackpad is used
        ad.add(dom.addDisposableListener(this.raw.element, dom.EventType.MOUSE_WHEEL, (e) => {
            const classifier = MouseWheelClassifier.INSTANCE;
            classifier.acceptStandardWheelEvent(new StandardWheelEvent(e));
            const value = classifier.isPhysicalMouseWheel();
            if (value !== this._isPhysicalMouseWheel) {
                this._isPhysicalMouseWheel = value;
                this._updateSmoothScrolling();
            }
        }, { passive: true }));
        this._refreshLigaturesAddon();
        this._attached = { container, options };
        // Screen must be created at this point as xterm.open is called
        // eslint-disable-next-line no-restricted-syntax
        return this._attached?.container.querySelector('.xterm-screen');
    }
    _setFocused(isFocused) {
        this._onDidChangeFocus.fire(isFocused);
        this._anyTerminalFocusContextKey.set(isFocused);
        this._anyFocusedTerminalHasSelection.set(isFocused && this.raw.hasSelection());
    }
    write(data, callback) {
        this.raw.write(data, callback);
    }
    resize(columns, rows) {
        this._logService.debug('resizing', columns, rows);
        this.raw.resize(columns, rows);
    }
    updateConfig() {
        const config = this._terminalConfigurationService.config;
        this.raw.options.altClickMovesCursor = config.altClickMovesCursor;
        this._setCursorBlink(config.cursorBlinking);
        this._setCursorStyle(config.cursorStyle);
        this._setCursorStyleInactive(config.cursorStyleInactive);
        this._setCursorWidth(config.cursorWidth);
        this.raw.options.scrollback = config.scrollback;
        this.raw.options.drawBoldTextInBrightColors = config.drawBoldTextInBrightColors;
        this.raw.options.minimumContrastRatio = config.minimumContrastRatio;
        this.raw.options.tabStopWidth = config.tabStopWidth;
        this.raw.options.fastScrollSensitivity = config.fastScrollSensitivity;
        this.raw.options.scrollSensitivity = config.mouseWheelScrollSensitivity;
        this.raw.options.macOptionIsMeta = config.macOptionIsMeta;
        const editorOptions = this._configurationService.getValue('editor');
        this.raw.options.altClickMovesCursor = config.altClickMovesCursor && editorOptions.multiCursorModifier === 'alt';
        this.raw.options.macOptionClickForcesSelection = config.macOptionClickForcesSelection;
        this.raw.options.rightClickSelectsWord = config.rightClickBehavior === 'selectWord';
        this.raw.options.wordSeparator = config.wordSeparators;
        this.raw.options.customGlyphs = config.customGlyphs;
        this.raw.options.ignoreBracketedPasteMode = config.ignoreBracketedPasteMode;
        this.raw.options.rescaleOverlappingGlyphs = config.rescaleOverlappingGlyphs;
        this._updateSmoothScrolling();
        if (this._attached) {
            if (this._attached.options.enableGpu) {
                if (this._shouldLoadWebgl()) {
                    this._enableWebglRenderer();
                }
                else {
                    this._disposeOfWebglRenderer();
                }
            }
            this._refreshLigaturesAddon();
        }
    }
    _updateSmoothScrolling() {
        this.raw.options.smoothScrollDuration = this._terminalConfigurationService.config.smoothScrolling && this._isPhysicalMouseWheel ? 125 /* RenderConstants.SmoothScrollDuration */ : 0;
    }
    _shouldLoadWebgl() {
        return (this._terminalConfigurationService.config.gpuAcceleration === 'auto' && XtermTerminal_1._suggestedRendererType === undefined) || this._terminalConfigurationService.config.gpuAcceleration === 'on';
    }
    forceRedraw() {
        this.raw.clearTextureAtlas();
    }
    clearDecorations() {
        this._decorationAddon?.clearDecorations();
    }
    forceRefresh() {
        this._core.viewport?._innerRefresh();
    }
    async findNext(term, searchOptions) {
        this._updateFindColors(searchOptions);
        return (await this._getSearchAddon()).findNext(term, searchOptions);
    }
    async findPrevious(term, searchOptions) {
        this._updateFindColors(searchOptions);
        return (await this._getSearchAddon()).findPrevious(term, searchOptions);
    }
    _updateFindColors(searchOptions) {
        const theme = this._themeService.getColorTheme();
        // Theme color names align with monaco/vscode whereas xterm.js has some different naming.
        // The mapping is as follows:
        // - findMatch -> activeMatch
        // - findMatchHighlight -> match
        const terminalBackground = theme.getColor(TERMINAL_BACKGROUND_COLOR) || theme.getColor(PANEL_BACKGROUND);
        const findMatchBackground = theme.getColor(TERMINAL_FIND_MATCH_BACKGROUND_COLOR);
        const findMatchBorder = theme.getColor(TERMINAL_FIND_MATCH_BORDER_COLOR);
        const findMatchOverviewRuler = theme.getColor(TERMINAL_OVERVIEW_RULER_CURSOR_FOREGROUND_COLOR);
        const findMatchHighlightBackground = theme.getColor(TERMINAL_FIND_MATCH_HIGHLIGHT_BACKGROUND_COLOR);
        const findMatchHighlightBorder = theme.getColor(TERMINAL_FIND_MATCH_HIGHLIGHT_BORDER_COLOR);
        const findMatchHighlightOverviewRuler = theme.getColor(TERMINAL_OVERVIEW_RULER_FIND_MATCH_FOREGROUND_COLOR);
        searchOptions.decorations = {
            activeMatchBackground: findMatchBackground?.toString(),
            activeMatchBorder: findMatchBorder?.toString() || 'transparent',
            activeMatchColorOverviewRuler: findMatchOverviewRuler?.toString() || 'transparent',
            // decoration bgs don't support the alpha channel so blend it with the regular bg
            matchBackground: terminalBackground ? findMatchHighlightBackground?.blend(terminalBackground).toString() : undefined,
            matchBorder: findMatchHighlightBorder?.toString() || 'transparent',
            matchOverviewRuler: findMatchHighlightOverviewRuler?.toString() || 'transparent'
        };
    }
    _getSearchAddon() {
        if (!this._searchAddonPromise) {
            this._searchAddonPromise = this._xtermAddonLoader.importAddon('search').then((AddonCtor) => {
                if (this._store.isDisposed) {
                    return Promise.reject('Could not create search addon, terminal is disposed');
                }
                this._searchAddon = new AddonCtor({ highlightLimit: 20000 /* XtermTerminalConstants.SearchHighlightLimit */ });
                this.raw.loadAddon(this._searchAddon);
                this._searchAddon.onDidChangeResults((results) => {
                    this._lastFindResult = results;
                    this._onDidChangeFindResults.fire(results);
                });
                return this._searchAddon;
            });
        }
        return this._searchAddonPromise;
    }
    clearSearchDecorations() {
        this._searchAddon?.clearDecorations();
    }
    clearActiveSearchDecoration() {
        this._searchAddon?.clearActiveDecoration();
    }
    getFont() {
        return this._terminalConfigurationService.getFont(dom.getWindow(this.raw.element), this._core);
    }
    getLongestViewportWrappedLineLength() {
        let maxLineLength = 0;
        for (let i = this.raw.buffer.active.length - 1; i >= this.raw.buffer.active.viewportY; i--) {
            const lineInfo = this._getWrappedLineCount(i, this.raw.buffer.active);
            maxLineLength = Math.max(maxLineLength, ((lineInfo.lineCount * this.raw.cols) - lineInfo.endSpaces) || 0);
            i = lineInfo.currentIndex;
        }
        return maxLineLength;
    }
    _getWrappedLineCount(index, buffer) {
        let line = buffer.getLine(index);
        if (!line) {
            throw new Error('Could not get line');
        }
        let currentIndex = index;
        let endSpaces = 0;
        // line.length may exceed cols as it doesn't necessarily trim the backing array on resize
        for (let i = Math.min(line.length, this.raw.cols) - 1; i >= 0; i--) {
            if (!line?.getCell(i)?.getChars()) {
                endSpaces++;
            }
            else {
                break;
            }
        }
        while (line?.isWrapped && currentIndex > 0) {
            currentIndex--;
            line = buffer.getLine(currentIndex);
        }
        return { lineCount: index - currentIndex + 1, currentIndex, endSpaces };
    }
    scrollDownLine() {
        this.raw.scrollLines(1);
    }
    scrollDownPage() {
        this.raw.scrollPages(1);
    }
    scrollToBottom() {
        this.raw.scrollToBottom();
    }
    scrollUpLine() {
        this.raw.scrollLines(-1);
    }
    scrollUpPage() {
        this.raw.scrollPages(-1);
    }
    scrollToTop() {
        this.raw.scrollToTop();
    }
    scrollToLine(line, position = 0 /* ScrollPosition.Top */) {
        this.markTracker.scrollToLine(line, position);
    }
    clearBuffer() {
        this.raw.clear();
        // xterm.js does not clear the first prompt, so trigger these to simulate
        // the prompt being written
        this._capabilities.get(2 /* TerminalCapability.CommandDetection */)?.handlePromptStart();
        this._capabilities.get(2 /* TerminalCapability.CommandDetection */)?.handleCommandStart();
        this._accessibilitySignalService.playSignal(AccessibilitySignal.clear);
    }
    hasSelection() {
        return this.raw.hasSelection();
    }
    clearSelection() {
        this.raw.clearSelection();
    }
    selectMarkedRange(fromMarkerId, toMarkerId, scrollIntoView = false) {
        const detectionCapability = this.shellIntegration.capabilities.get(4 /* TerminalCapability.BufferMarkDetection */);
        if (!detectionCapability) {
            return;
        }
        const start = detectionCapability.getMark(fromMarkerId);
        const end = detectionCapability.getMark(toMarkerId);
        if (start === undefined || end === undefined) {
            return;
        }
        this.raw.selectLines(start.line, end.line);
        if (scrollIntoView) {
            this.raw.scrollToLine(start.line);
        }
    }
    selectAll() {
        this.raw.focus();
        this.raw.selectAll();
    }
    focus() {
        this.raw.focus();
    }
    async copySelection(asHtml, command) {
        if (this.hasSelection() || (asHtml && command)) {
            if (asHtml) {
                const textAsHtml = await this.getSelectionAsHtml(command);
                function listener(e) {
                    if (e.clipboardData) {
                        if (!e.clipboardData.types.includes('text/plain')) {
                            e.clipboardData.setData('text/plain', command?.getOutput() ?? '');
                        }
                        e.clipboardData.setData('text/html', textAsHtml);
                    }
                    e.preventDefault();
                }
                const doc = dom.getDocument(this.raw.element);
                doc.addEventListener('copy', listener);
                doc.execCommand('copy');
                doc.removeEventListener('copy', listener);
            }
            else {
                await this._clipboardService.writeText(this.raw.getSelection());
            }
        }
        else {
            this._notificationService.warn(localize('terminal.integrated.copySelection.noSelection', 'The terminal has no selection to copy'));
        }
    }
    _setCursorBlink(blink) {
        if (this.raw.options.cursorBlink !== blink) {
            this.raw.options.cursorBlink = blink;
            this.raw.refresh(0, this.raw.rows - 1);
        }
    }
    _setCursorStyle(style) {
        const mapped = vscodeToXtermCursorStyle(style);
        if (this.raw.options.cursorStyle !== mapped) {
            this.raw.options.cursorStyle = mapped;
        }
    }
    _setCursorStyleInactive(style) {
        const mapped = vscodeToXtermCursorStyle(style);
        if (this.raw.options.cursorInactiveStyle !== mapped) {
            this.raw.options.cursorInactiveStyle = mapped;
        }
    }
    _setCursorWidth(width) {
        if (this.raw.options.cursorWidth !== width) {
            this.raw.options.cursorWidth = width;
        }
    }
    async _enableWebglRenderer() {
        if (!this.raw.element || this._webglAddon) {
            return;
        }
        const Addon = await this._xtermAddonLoader.importAddon('webgl');
        this._webglAddon = new Addon();
        try {
            this.raw.loadAddon(this._webglAddon);
            this._logService.trace('Webgl was loaded');
            this._webglAddon.onContextLoss(() => {
                this._logService.info(`Webgl lost context, disposing of webgl renderer`);
                this._disposeOfWebglRenderer();
            });
            this._refreshImageAddon();
            // WebGL renderer cell dimensions differ from the DOM renderer, make sure the terminal
            // gets resized after the webgl addon is loaded
            this._onDidRequestRefreshDimensions.fire();
            // Uncomment to add the texture atlas to the DOM
            // setTimeout(() => {
            // 	if (this._webglAddon?.textureAtlas) {
            // 		document.body.appendChild(this._webglAddon?.textureAtlas);
            // 	}
            // }, 5000);
        }
        catch (e) {
            this._logService.warn(`Webgl could not be loaded. Falling back to the DOM renderer`, e);
            XtermTerminal_1._suggestedRendererType = 'dom';
            this._disposeOfWebglRenderer();
        }
    }
    async _refreshLigaturesAddon() {
        if (!this.raw.element) {
            return;
        }
        const ligaturesConfig = this._terminalConfigurationService.config.fontLigatures;
        let shouldRecreateWebglRenderer = false;
        if (ligaturesConfig?.enabled) {
            if (this._ligaturesAddon.value && !equals(ligaturesConfig, this._ligaturesAddonConfig)) {
                this._ligaturesAddon.clear();
            }
            if (!this._ligaturesAddon.value) {
                const LigaturesAddon = await this._xtermAddonLoader.importAddon('ligatures');
                if (this._store.isDisposed) {
                    return;
                }
                this._ligaturesAddon.value = this._instantiationService.createInstance(LigaturesAddon, {
                    fontFeatureSettings: ligaturesConfig.featureSettings,
                    fallbackLigatures: ligaturesConfig.fallbackLigatures,
                });
                this.raw.loadAddon(this._ligaturesAddon.value);
                shouldRecreateWebglRenderer = true;
            }
        }
        else {
            if (!this._ligaturesAddon.value) {
                return;
            }
            this._ligaturesAddon.clear();
            shouldRecreateWebglRenderer = true;
        }
        if (shouldRecreateWebglRenderer && this._webglAddon) {
            // Re-create the webgl addon when ligatures state changes to so the texture atlas picks up
            // styles from the DOM.
            this._disposeOfWebglRenderer();
            await this._enableWebglRenderer();
        }
    }
    async _refreshImageAddon() {
        // Only allow the image addon when webgl is being used to avoid possible GPU issues
        if (this._terminalConfigurationService.config.enableImages && this._webglAddon) {
            if (!this._imageAddon) {
                const AddonCtor = await this._xtermAddonLoader.importAddon('image');
                this._imageAddon = new AddonCtor();
                this.raw.loadAddon(this._imageAddon);
            }
        }
        else {
            try {
                this._imageAddon?.dispose();
            }
            catch {
                // ignore
            }
            this._imageAddon = undefined;
        }
    }
    _disposeOfWebglRenderer() {
        try {
            this._webglAddon?.dispose();
        }
        catch {
            // ignore
        }
        this._webglAddon = undefined;
        this._refreshImageAddon();
        // WebGL renderer cell dimensions differ from the DOM renderer, make sure the terminal
        // gets resized after the webgl addon is disposed
        this._onDidRequestRefreshDimensions.fire();
    }
    async getRangeAsVT(startMarker, endMarker, skipLastLine) {
        if (!this._serializeAddon) {
            const Addon = await this._xtermAddonLoader.importAddon('serialize');
            this._serializeAddon = new Addon();
            this.raw.loadAddon(this._serializeAddon);
        }
        assert(startMarker.line !== -1);
        let end = endMarker?.line ?? this.raw.buffer.active.length - 1;
        if (skipLastLine) {
            end = end - 1;
        }
        return this._serializeAddon.serialize({
            range: {
                start: startMarker.line,
                end: end
            }
        });
    }
    getXtermTheme(theme) {
        if (!theme) {
            theme = this._themeService.getColorTheme();
        }
        const config = this._terminalConfigurationService.config;
        const hideOverviewRuler = ['never', 'gutter'].includes(config.shellIntegration?.decorationsEnabled ?? '');
        const foregroundColor = theme.getColor(TERMINAL_FOREGROUND_COLOR);
        const backgroundColor = this._xtermColorProvider.getBackgroundColor(theme);
        const cursorColor = theme.getColor(TERMINAL_CURSOR_FOREGROUND_COLOR) || foregroundColor;
        const cursorAccentColor = theme.getColor(TERMINAL_CURSOR_BACKGROUND_COLOR) || backgroundColor;
        const selectionBackgroundColor = theme.getColor(TERMINAL_SELECTION_BACKGROUND_COLOR);
        const selectionInactiveBackgroundColor = theme.getColor(TERMINAL_INACTIVE_SELECTION_BACKGROUND_COLOR);
        const selectionForegroundColor = theme.getColor(TERMINAL_SELECTION_FOREGROUND_COLOR) || undefined;
        return {
            background: backgroundColor?.toString(),
            foreground: foregroundColor?.toString(),
            cursor: cursorColor?.toString(),
            cursorAccent: cursorAccentColor?.toString(),
            selectionBackground: selectionBackgroundColor?.toString(),
            selectionInactiveBackground: selectionInactiveBackgroundColor?.toString(),
            selectionForeground: selectionForegroundColor?.toString(),
            overviewRulerBorder: hideOverviewRuler ? '#0000' : theme.getColor(TERMINAL_OVERVIEW_RULER_BORDER_COLOR)?.toString(),
            scrollbarSliderActiveBackground: theme.getColor(scrollbarSliderActiveBackground)?.toString(),
            scrollbarSliderBackground: theme.getColor(scrollbarSliderBackground)?.toString(),
            scrollbarSliderHoverBackground: theme.getColor(scrollbarSliderHoverBackground)?.toString(),
            black: theme.getColor(ansiColorIdentifiers[0])?.toString(),
            red: theme.getColor(ansiColorIdentifiers[1])?.toString(),
            green: theme.getColor(ansiColorIdentifiers[2])?.toString(),
            yellow: theme.getColor(ansiColorIdentifiers[3])?.toString(),
            blue: theme.getColor(ansiColorIdentifiers[4])?.toString(),
            magenta: theme.getColor(ansiColorIdentifiers[5])?.toString(),
            cyan: theme.getColor(ansiColorIdentifiers[6])?.toString(),
            white: theme.getColor(ansiColorIdentifiers[7])?.toString(),
            brightBlack: theme.getColor(ansiColorIdentifiers[8])?.toString(),
            brightRed: theme.getColor(ansiColorIdentifiers[9])?.toString(),
            brightGreen: theme.getColor(ansiColorIdentifiers[10])?.toString(),
            brightYellow: theme.getColor(ansiColorIdentifiers[11])?.toString(),
            brightBlue: theme.getColor(ansiColorIdentifiers[12])?.toString(),
            brightMagenta: theme.getColor(ansiColorIdentifiers[13])?.toString(),
            brightCyan: theme.getColor(ansiColorIdentifiers[14])?.toString(),
            brightWhite: theme.getColor(ansiColorIdentifiers[15])?.toString()
        };
    }
    _updateTheme(theme) {
        this.raw.options.theme = this.getXtermTheme(theme);
    }
    refresh() {
        this._updateTheme();
        this._decorationAddon.refreshLayouts();
    }
    async _updateUnicodeVersion() {
        if (!this._unicode11Addon && this._terminalConfigurationService.config.unicodeVersion === '11') {
            const Addon = await this._xtermAddonLoader.importAddon('unicode11');
            this._unicode11Addon = new Addon();
            this.raw.loadAddon(this._unicode11Addon);
        }
        if (this.raw.unicode.activeVersion !== this._terminalConfigurationService.config.unicodeVersion) {
            this.raw.unicode.activeVersion = this._terminalConfigurationService.config.unicodeVersion;
        }
    }
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _writeText(data) {
        this.raw.write(data);
    }
    dispose() {
        this._anyTerminalFocusContextKey.reset();
        this._anyFocusedTerminalHasSelection.reset();
        this._onDidDispose.fire();
        super.dispose();
    }
};
__decorate([
    debounce(100)
], XtermTerminal.prototype, "_refreshLigaturesAddon", null);
__decorate([
    debounce(100)
], XtermTerminal.prototype, "_refreshImageAddon", null);
XtermTerminal = XtermTerminal_1 = __decorate([
    __param(4, IConfigurationService),
    __param(5, IInstantiationService),
    __param(6, ITerminalLogService),
    __param(7, INotificationService),
    __param(8, IThemeService),
    __param(9, ITelemetryService),
    __param(10, ITerminalConfigurationService),
    __param(11, IClipboardService),
    __param(12, IContextKeyService),
    __param(13, IAccessibilitySignalService),
    __param(14, ILayoutService)
], XtermTerminal);
export { XtermTerminal };
export function getXtermScaledDimensions(w, font, width, height) {
    if (!font.charWidth || !font.charHeight) {
        return null;
    }
    // Because xterm.js converts from CSS pixels to actual pixels through
    // the use of canvas, window.devicePixelRatio needs to be used here in
    // order to be precise. font.charWidth/charHeight alone as insufficient
    // when window.devicePixelRatio changes.
    const scaledWidthAvailable = width * w.devicePixelRatio;
    const scaledCharWidth = font.charWidth * w.devicePixelRatio + font.letterSpacing;
    const cols = Math.max(Math.floor(scaledWidthAvailable / scaledCharWidth), 1);
    const scaledHeightAvailable = height * w.devicePixelRatio;
    const scaledCharHeight = Math.ceil(font.charHeight * w.devicePixelRatio);
    const scaledLineHeight = Math.floor(scaledCharHeight * font.lineHeight);
    const rows = Math.max(Math.floor(scaledHeightAvailable / scaledLineHeight), 1);
    return { rows, cols };
}
function vscodeToXtermLogLevel(logLevel) {
    switch (logLevel) {
        case LogLevel.Trace: return 'trace';
        case LogLevel.Debug: return 'debug';
        case LogLevel.Info: return 'info';
        case LogLevel.Warning: return 'warn';
        case LogLevel.Error: return 'error';
        default: return 'off';
    }
}
function vscodeToXtermCursorStyle(style) {
    // 'line' is used instead of bar in VS Code to be consistent with editor.cursorStyle
    if (style === 'line') {
        return 'bar';
    }
    return style;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHRlcm1UZXJtaW5hbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3h0ZXJtL3h0ZXJtVGVybWluYWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBVWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFFMUQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUV6RyxPQUFPLEVBQXFCLG1CQUFtQixFQUE0QyxNQUFNLHFEQUFxRCxDQUFDO0FBRXZKLE9BQU8sRUFBMkosNkJBQTZCLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUN4TixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDckUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDbkcsT0FBTyxFQUFFLG1CQUFtQixFQUFrQixNQUFNLDBCQUEwQixDQUFDO0FBQy9FLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQWUsYUFBYSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDbEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDL0QsT0FBTyxFQUFFLHlCQUF5QixFQUFFLHlCQUF5QixFQUFFLGdDQUFnQyxFQUFFLGdDQUFnQyxFQUFFLG9CQUFvQixFQUFFLG1DQUFtQyxFQUFFLG9DQUFvQyxFQUFFLDhDQUE4QyxFQUFFLGdDQUFnQyxFQUFFLG1EQUFtRCxFQUFFLDBDQUEwQyxFQUFFLCtDQUErQyxFQUFFLG1DQUFtQyxFQUFFLDRDQUE0QyxFQUFFLG9D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QUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFO1lBQzFELEdBQUcsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFO1lBQ3hELEtBQUssRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFO1lBQzFELE1BQU0sRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFO1lBQzNELElBQUksRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFO1lBQ3pELE9BQU8sRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFO1lBQzVELElBQUksRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFO1lBQ3pELEtBQUssRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFO1lBQzFELFdBQVcsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFO1lBQ2hFLFNBQVMsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFO1lBQzlELFdBQVcsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFO1lBQ2pFLFlBQVksRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxDQUFDLEVB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