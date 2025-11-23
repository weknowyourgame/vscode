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
import { isSafari } from '../../../../base/browser/browser.js';
import { BrowserFeatures } from '../../../../base/browser/canIUse.js';
import * as dom from '../../../../base/browser/dom.js';
import { StandardMouseEvent } from '../../../../base/browser/mouseEvent.js';
import { Separator, SubmenuAction, toAction } from '../../../../base/common/actions.js';
import { distinct } from '../../../../base/common/arrays.js';
import { RunOnceScheduler, timeout } from '../../../../base/common/async.js';
import { memoize } from '../../../../base/common/decorators.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { dispose, disposeIfDisposable } from '../../../../base/common/lifecycle.js';
import * as env from '../../../../base/common/platform.js';
import severity from '../../../../base/common/severity.js';
import { noBreakWhitespace } from '../../../../base/common/strings.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { Range } from '../../../../editor/common/core/range.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { GlyphMarginLane, OverviewRulerLane } from '../../../../editor/common/model.js';
import * as nls from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { registerColor } from '../../../../platform/theme/common/colorRegistry.js';
import { registerThemingParticipant, themeColorFromId } from '../../../../platform/theme/common/themeService.js';
import { GutterActionsRegistry } from '../../codeEditor/browser/editorLineNumberMenu.js';
import { getBreakpointMessageAndIcon } from './breakpointsView.js';
import { BreakpointWidget } from './breakpointWidget.js';
import * as icons from './debugIcons.js';
import { BREAKPOINT_EDITOR_CONTRIBUTION_ID, CONTEXT_BREAKPOINT_WIDGET_VISIBLE, DebuggerString, IDebugService } from '../common/debug.js';
const $ = dom.$;
const breakpointHelperDecoration = {
    description: 'breakpoint-helper-decoration',
    glyphMarginClassName: ThemeIcon.asClassName(icons.debugBreakpointHint),
    glyphMargin: { position: GlyphMarginLane.Right },
    glyphMarginHoverMessage: new MarkdownString().appendText(nls.localize('breakpointHelper', "Click to add a breakpoint")),
    stickiness: 1 /* TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges */
};
export function createBreakpointDecorations(accessor, model, breakpoints, state, breakpointsActivated, showBreakpointsInOverviewRuler) {
    const result = [];
    breakpoints.forEach((breakpoint) => {
        if (breakpoint.lineNumber > model.getLineCount()) {
            return;
        }
        const hasOtherBreakpointsOnLine = breakpoints.some(bp => bp !== breakpoint && bp.lineNumber === breakpoint.lineNumber);
        const column = model.getLineFirstNonWhitespaceColumn(breakpoint.lineNumber);
        const range = model.validateRange(breakpoint.column ? new Range(breakpoint.lineNumber, breakpoint.column, breakpoint.lineNumber, breakpoint.column + 1)
            : new Range(breakpoint.lineNumber, column, breakpoint.lineNumber, column + 1) // Decoration has to have a width #20688
        );
        result.push({
            options: getBreakpointDecorationOptions(accessor, model, breakpoint, state, breakpointsActivated, showBreakpointsInOverviewRuler, hasOtherBreakpointsOnLine),
            range
        });
    });
    return result;
}
function getBreakpointDecorationOptions(accessor, model, breakpoint, state, breakpointsActivated, showBreakpointsInOverviewRuler, hasOtherBreakpointsOnLine) {
    const debugService = accessor.get(IDebugService);
    const languageService = accessor.get(ILanguageService);
    const labelService = accessor.get(ILabelService);
    const { icon, message, showAdapterUnverifiedMessage } = getBreakpointMessageAndIcon(state, breakpointsActivated, breakpoint, labelService, debugService.getModel());
    let glyphMarginHoverMessage;
    let unverifiedMessage;
    if (showAdapterUnverifiedMessage) {
        let langId;
        unverifiedMessage = debugService.getModel().getSessions().map(s => {
            const dbg = debugService.getAdapterManager().getDebugger(s.configuration.type);
            const message = dbg?.strings?.[DebuggerString.UnverifiedBreakpoints];
            if (message) {
                if (!langId) {
                    // Lazily compute this, only if needed for some debug adapter
                    langId = languageService.guessLanguageIdByFilepathOrFirstLine(breakpoint.uri) ?? undefined;
                }
                return langId && dbg.interestedInLanguage(langId) ? message : undefined;
            }
            return undefined;
        })
            .find(messages => !!messages);
    }
    if (message) {
        glyphMarginHoverMessage = new MarkdownString(undefined, { isTrusted: true, supportThemeIcons: true });
        if (breakpoint.condition || breakpoint.hitCondition) {
            const languageId = model.getLanguageId();
            glyphMarginHoverMessage.appendCodeblock(languageId, message);
            if (unverifiedMessage) {
                glyphMarginHoverMessage.appendMarkdown('$(warning) ' + unverifiedMessage);
            }
        }
        else {
            glyphMarginHoverMessage.appendText(message);
            if (unverifiedMessage) {
                glyphMarginHoverMessage.appendMarkdown('\n\n$(warning) ' + unverifiedMessage);
            }
        }
    }
    else if (unverifiedMessage) {
        glyphMarginHoverMessage = new MarkdownString(undefined, { isTrusted: true, supportThemeIcons: true }).appendMarkdown(unverifiedMessage);
    }
    let overviewRulerDecoration = null;
    if (showBreakpointsInOverviewRuler) {
        overviewRulerDecoration = {
            color: themeColorFromId(debugIconBreakpointForeground),
            position: OverviewRulerLane.Left
        };
    }
    const renderInline = breakpoint.column && (hasOtherBreakpointsOnLine || breakpoint.column > model.getLineFirstNonWhitespaceColumn(breakpoint.lineNumber));
    return {
        description: 'breakpoint-decoration',
        glyphMargin: { position: GlyphMarginLane.Right },
        glyphMarginClassName: ThemeIcon.asClassName(icon),
        glyphMarginHoverMessage,
        stickiness: 1 /* TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges */,
        before: renderInline ? {
            content: noBreakWhitespace,
            inlineClassName: `debug-breakpoint-placeholder`,
            inlineClassNameAffectsLetterSpacing: true
        } : undefined,
        overviewRuler: overviewRulerDecoration,
        zIndex: 9999
    };
}
async function requestBreakpointCandidateLocations(model, lineNumbers, session) {
    if (!session.capabilities.supportsBreakpointLocationsRequest) {
        return [];
    }
    return await Promise.all(distinct(lineNumbers, l => l).map(async (lineNumber) => {
        try {
            return { lineNumber, positions: await session.breakpointsLocations(model.uri, lineNumber) };
        }
        catch {
            return { lineNumber, positions: [] };
        }
    }));
}
function createCandidateDecorations(model, breakpointDecorations, lineBreakpoints) {
    const result = [];
    for (const { positions, lineNumber } of lineBreakpoints) {
        if (positions.length === 0) {
            continue;
        }
        // Do not render candidates if there is only one, since it is already covered by the line breakpoint
        const firstColumn = model.getLineFirstNonWhitespaceColumn(lineNumber);
        const lastColumn = model.getLineLastNonWhitespaceColumn(lineNumber);
        positions.forEach(p => {
            const range = new Range(p.lineNumber, p.column, p.lineNumber, p.column + 1);
            if ((p.column <= firstColumn && !breakpointDecorations.some(bp => bp.range.startColumn > firstColumn && bp.range.startLineNumber === p.lineNumber)) || p.column > lastColumn) {
                // Do not render candidates on the start of the line if there's no other breakpoint on the line.
                return;
            }
            const breakpointAtPosition = breakpointDecorations.find(bpd => bpd.range.equalsRange(range));
            if (breakpointAtPosition && breakpointAtPosition.inlineWidget) {
                // Space already occupied, do not render candidate.
                return;
            }
            result.push({
                range,
                options: {
                    description: 'breakpoint-placeholder-decoration',
                    stickiness: 1 /* TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges */,
                    before: breakpointAtPosition ? undefined : {
                        content: noBreakWhitespace,
                        inlineClassName: `debug-breakpoint-placeholder`,
                        inlineClassNameAffectsLetterSpacing: true
                    },
                },
                breakpoint: breakpointAtPosition ? breakpointAtPosition.breakpoint : undefined
            });
        });
    }
    return result;
}
let BreakpointEditorContribution = class BreakpointEditorContribution {
    constructor(editor, debugService, contextMenuService, instantiationService, contextKeyService, dialogService, configurationService, labelService) {
        this.editor = editor;
        this.debugService = debugService;
        this.contextMenuService = contextMenuService;
        this.instantiationService = instantiationService;
        this.dialogService = dialogService;
        this.configurationService = configurationService;
        this.labelService = labelService;
        this.breakpointHintDecoration = null;
        this.toDispose = [];
        this.ignoreDecorationsChangedEvent = false;
        this.ignoreBreakpointsChangeEvent = false;
        this.breakpointDecorations = [];
        this.candidateDecorations = [];
        this.breakpointWidgetVisible = CONTEXT_BREAKPOINT_WIDGET_VISIBLE.bindTo(contextKeyService);
        this.setDecorationsScheduler = new RunOnceScheduler(() => this.setDecorations(), 30);
        this.setDecorationsScheduler.schedule();
        this.registerListeners();
    }
    /**
     * Returns context menu actions at the line number if breakpoints can be
     * set. This is used by the {@link TestingDecorations} to allow breakpoint
     * setting on lines where breakpoint "run" actions are present.
     */
    getContextMenuActionsAtPosition(lineNumber, model) {
        if (!this.debugService.getAdapterManager().hasEnabledDebuggers()) {
            return [];
        }
        if (!this.debugService.canSetBreakpointsIn(model)) {
            return [];
        }
        const breakpoints = this.debugService.getModel().getBreakpoints({ lineNumber, uri: model.uri });
        return this.getContextMenuActions(breakpoints, model.uri, lineNumber);
    }
    registerListeners() {
        this.toDispose.push(this.editor.onMouseDown(async (e) => {
            if (!this.debugService.getAdapterManager().hasEnabledDebuggers()) {
                return;
            }
            const model = this.editor.getModel();
            if (!e.target.position
                || !model
                || e.target.type !== 2 /* MouseTargetType.GUTTER_GLYPH_MARGIN */
                || e.target.detail.isAfterLines
                || !this.marginFreeFromNonDebugDecorations(e.target.position.lineNumber)
                    // don't return early if there's a breakpoint
                    && !e.target.element?.className.includes('breakpoint')) {
                return;
            }
            const canSetBreakpoints = this.debugService.canSetBreakpointsIn(model);
            const lineNumber = e.target.position.lineNumber;
            const uri = model.uri;
            if (e.event.rightButton || (env.isMacintosh && e.event.leftButton && e.event.ctrlKey)) {
                // handled by editor gutter context menu
                return;
            }
            else {
                const breakpoints = this.debugService.getModel().getBreakpoints({ uri, lineNumber });
                if (breakpoints.length) {
                    const isShiftPressed = e.event.shiftKey;
                    const enabled = breakpoints.some(bp => bp.enabled);
                    if (isShiftPressed) {
                        breakpoints.forEach(bp => this.debugService.enableOrDisableBreakpoints(!enabled, bp));
                    }
                    else if (!env.isLinux && breakpoints.some(bp => !!bp.condition || !!bp.logMessage || !!bp.hitCondition || !!bp.triggeredBy)) {
                        // Show the dialog if there is a potential condition to be accidently lost.
                        // Do not show dialog on linux due to electron issue freezing the mouse #50026
                        const logPoint = breakpoints.every(bp => !!bp.logMessage);
                        const breakpointType = logPoint ? nls.localize('logPoint', "Logpoint") : nls.localize('breakpoint', "Breakpoint");
                        const disabledBreakpointDialogMessage = nls.localize('breakpointHasConditionDisabled', "This {0} has a {1} that will get lost on remove. Consider enabling the {0} instead.", breakpointType.toLowerCase(), logPoint ? nls.localize('message', "message") : nls.localize('condition', "condition"));
                        const enabledBreakpointDialogMessage = nls.localize('breakpointHasConditionEnabled', "This {0} has a {1} that will get lost on remove. Consider disabling the {0} instead.", breakpointType.toLowerCase(), logPoint ? nls.localize('message', "message") : nls.localize('condition', "condition"));
                        await this.dialogService.prompt({
                            type: severity.Info,
                            message: enabled ? enabledBreakpointDialogMessage : disabledBreakpointDialogMessage,
                            buttons: [
                                {
                                    label: nls.localize({ key: 'removeLogPoint', comment: ['&& denotes a mnemonic'] }, "&&Remove {0}", breakpointType),
                                    run: () => breakpoints.forEach(bp => this.debugService.removeBreakpoints(bp.getId()))
                                },
                                {
                                    label: nls.localize('disableLogPoint', "{0} {1}", enabled ? nls.localize({ key: 'disable', comment: ['&& denotes a mnemonic'] }, "&&Disable") : nls.localize({ key: 'enable', comment: ['&& denotes a mnemonic'] }, "&&Enable"), breakpointType),
                                    run: () => breakpoints.forEach(bp => this.debugService.enableOrDisableBreakpoints(!enabled, bp))
                                }
                            ],
                            cancelButton: true
                        });
                    }
                    else {
                        if (!enabled) {
                            breakpoints.forEach(bp => this.debugService.enableOrDisableBreakpoints(!enabled, bp));
                        }
                        else {
                            breakpoints.forEach(bp => this.debugService.removeBreakpoints(bp.getId()));
                        }
                    }
                }
                else if (canSetBreakpoints) {
                    if (e.event.middleButton) {
                        const action = this.configurationService.getValue('debug').gutterMiddleClickAction;
                        if (action !== 'none') {
                            let context;
                            switch (action) {
                                case 'logpoint':
                                    context = 2 /* BreakpointWidgetContext.LOG_MESSAGE */;
                                    break;
                                case 'conditionalBreakpoint':
                                    context = 0 /* BreakpointWidgetContext.CONDITION */;
                                    break;
                                case 'triggeredBreakpoint':
                                    context = 3 /* BreakpointWidgetContext.TRIGGER_POINT */;
                            }
                            this.showBreakpointWidget(lineNumber, undefined, context);
                        }
                    }
                    else {
                        this.debugService.addBreakpoints(uri, [{ lineNumber }]);
                    }
                }
            }
        }));
        if (!(BrowserFeatures.pointerEvents && isSafari)) {
            /**
             * We disable the hover feature for Safari on iOS as
             * 1. Browser hover events are handled specially by the system (it treats first click as hover if there is `:hover` css registered). Below hover behavior will confuse users with inconsistent expeirence.
             * 2. When users click on line numbers, the breakpoint hint displays immediately, however it doesn't create the breakpoint unless users click on the left gutter. On a touch screen, it's hard to click on that small area.
             */
            this.toDispose.push(this.editor.onMouseMove((e) => {
                if (!this.debugService.getAdapterManager().hasEnabledDebuggers()) {
                    return;
                }
                let showBreakpointHintAtLineNumber = -1;
                const model = this.editor.getModel();
                if (model && e.target.position && (e.target.type === 2 /* MouseTargetType.GUTTER_GLYPH_MARGIN */ || e.target.type === 3 /* MouseTargetType.GUTTER_LINE_NUMBERS */) && this.debugService.canSetBreakpointsIn(model) &&
                    this.marginFreeFromNonDebugDecorations(e.target.position.lineNumber)) {
                    const data = e.target.detail;
                    if (!data.isAfterLines) {
                        showBreakpointHintAtLineNumber = e.target.position.lineNumber;
                    }
                }
                this.ensureBreakpointHintDecoration(showBreakpointHintAtLineNumber);
            }));
            this.toDispose.push(this.editor.onMouseLeave(() => {
                this.ensureBreakpointHintDecoration(-1);
            }));
        }
        this.toDispose.push(this.editor.onDidChangeModel(async () => {
            this.closeBreakpointWidget();
            await this.setDecorations();
        }));
        this.toDispose.push(this.debugService.getModel().onDidChangeBreakpoints(() => {
            if (!this.ignoreBreakpointsChangeEvent && !this.setDecorationsScheduler.isScheduled()) {
                this.setDecorationsScheduler.schedule();
            }
        }));
        this.toDispose.push(this.debugService.onDidChangeState(() => {
            // We need to update breakpoint decorations when state changes since the top stack frame and breakpoint decoration might change
            if (!this.setDecorationsScheduler.isScheduled()) {
                this.setDecorationsScheduler.schedule();
            }
        }));
        this.toDispose.push(this.editor.onDidChangeModelDecorations(() => this.onModelDecorationsChanged()));
        this.toDispose.push(this.configurationService.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('debug.showBreakpointsInOverviewRuler') || e.affectsConfiguration('debug.showInlineBreakpointCandidates')) {
                await this.setDecorations();
            }
        }));
    }
    getContextMenuActions(breakpoints, uri, lineNumber, column) {
        const actions = [];
        if (breakpoints.length === 1) {
            const breakpointType = breakpoints[0].logMessage ? nls.localize('logPoint', "Logpoint") : nls.localize('breakpoint', "Breakpoint");
            actions.push(toAction({
                id: 'debug.removeBreakpoint', label: nls.localize('removeBreakpoint', "Remove {0}", breakpointType), enabled: true, run: async () => {
                    await this.debugService.removeBreakpoints(breakpoints[0].getId());
                }
            }));
            actions.push(toAction({
                id: 'workbench.debug.action.editBreakpointAction',
                label: nls.localize('editBreakpoint', "Edit {0}...", breakpointType),
                enabled: true,
                run: () => Promise.resolve(this.showBreakpointWidget(breakpoints[0].lineNumber, breakpoints[0].column))
            }));
            actions.push(toAction({
                id: `workbench.debug.viewlet.action.toggleBreakpoint`,
                label: breakpoints[0].enabled ? nls.localize('disableBreakpoint', "Disable {0}", breakpointType) : nls.localize('enableBreakpoint', "Enable {0}", breakpointType),
                enabled: true,
                run: () => this.debugService.enableOrDisableBreakpoints(!breakpoints[0].enabled, breakpoints[0])
            }));
        }
        else if (breakpoints.length > 1) {
            const sorted = breakpoints.slice().sort((first, second) => (first.column && second.column) ? first.column - second.column : 1);
            actions.push(new SubmenuAction('debug.removeBreakpoints', nls.localize('removeBreakpoints', "Remove Breakpoints"), sorted.map(bp => toAction({
                id: 'removeInlineBreakpoint',
                label: bp.column ? nls.localize('removeInlineBreakpointOnColumn', "Remove Inline Breakpoint on Column {0}", bp.column) : nls.localize('removeLineBreakpoint', "Remove Line Breakpoint"),
                enabled: true,
                run: () => this.debugService.removeBreakpoints(bp.getId())
            }))));
            actions.push(new SubmenuAction('debug.editBreakpoints', nls.localize('editBreakpoints', "Edit Breakpoints"), sorted.map(bp => toAction({
                id: 'editBreakpoint',
                label: bp.column ? nls.localize('editInlineBreakpointOnColumn', "Edit Inline Breakpoint on Column {0}", bp.column) : nls.localize('editLineBreakpoint', "Edit Line Breakpoint"),
                enabled: true,
                run: () => Promise.resolve(this.showBreakpointWidget(bp.lineNumber, bp.column))
            }))));
            actions.push(new SubmenuAction('debug.enableDisableBreakpoints', nls.localize('enableDisableBreakpoints', "Enable/Disable Breakpoints"), sorted.map(bp => toAction({
                id: bp.enabled ? 'disableColumnBreakpoint' : 'enableColumnBreakpoint',
                label: bp.enabled ? (bp.column ? nls.localize('disableInlineColumnBreakpoint', "Disable Inline Breakpoint on Column {0}", bp.column) : nls.localize('disableBreakpointOnLine', "Disable Line Breakpoint"))
                    : (bp.column ? nls.localize('enableBreakpoints', "Enable Inline Breakpoint on Column {0}", bp.column) : nls.localize('enableBreakpointOnLine', "Enable Line Breakpoint")),
                enabled: true,
                run: () => this.debugService.enableOrDisableBreakpoints(!bp.enabled, bp)
            }))));
        }
        else {
            actions.push(toAction({
                id: 'addBreakpoint',
                label: nls.localize('addBreakpoint', "Add Breakpoint"),
                enabled: true,
                run: () => this.debugService.addBreakpoints(uri, [{ lineNumber, column }])
            }));
            actions.push(toAction({
                id: 'addConditionalBreakpoint',
                label: nls.localize('addConditionalBreakpoint', "Add Conditional Breakpoint..."),
                enabled: true,
                run: () => Promise.resolve(this.showBreakpointWidget(lineNumber, column, 0 /* BreakpointWidgetContext.CONDITION */))
            }));
            actions.push(toAction({
                id: 'addLogPoint',
                label: nls.localize('addLogPoint', "Add Logpoint..."),
                enabled: true,
                run: () => Promise.resolve(this.showBreakpointWidget(lineNumber, column, 2 /* BreakpointWidgetContext.LOG_MESSAGE */))
            }));
            actions.push(toAction({
                id: 'addTriggeredBreakpoint',
                label: nls.localize('addTriggeredBreakpoint', "Add Triggered Breakpoint..."),
                enabled: true,
                run: () => Promise.resolve(this.showBreakpointWidget(lineNumber, column, 3 /* BreakpointWidgetContext.TRIGGER_POINT */))
            }));
        }
        if (this.debugService.state === 2 /* State.Stopped */) {
            actions.push(new Separator());
            actions.push(toAction({
                id: 'runToLine',
                label: nls.localize('runToLine', "Run to Line"),
                enabled: true,
                run: () => this.debugService.runTo(uri, lineNumber).catch(onUnexpectedError)
            }));
        }
        return actions;
    }
    marginFreeFromNonDebugDecorations(line) {
        const decorations = this.editor.getLineDecorations(line);
        if (decorations) {
            for (const { options } of decorations) {
                const clz = options.glyphMarginClassName;
                if (!clz) {
                    continue;
                }
                const hasSomeActionableCodicon = !(clz.includes('codicon-') || clz.startsWith('coverage-deco-')) || clz.includes('codicon-testing-') || clz.includes('codicon-merge-') || clz.includes('codicon-arrow-') || clz.includes('codicon-loading') || clz.includes('codicon-fold') || clz.includes('codicon-gutter-lightbulb') || clz.includes('codicon-lightbulb-sparkle');
                if (hasSomeActionableCodicon) {
                    return false;
                }
            }
        }
        return true;
    }
    ensureBreakpointHintDecoration(showBreakpointHintAtLineNumber) {
        this.editor.changeDecorations((accessor) => {
            if (this.breakpointHintDecoration) {
                accessor.removeDecoration(this.breakpointHintDecoration);
                this.breakpointHintDecoration = null;
            }
            if (showBreakpointHintAtLineNumber !== -1) {
                this.breakpointHintDecoration = accessor.addDecoration({
                    startLineNumber: showBreakpointHintAtLineNumber,
                    startColumn: 1,
                    endLineNumber: showBreakpointHintAtLineNumber,
                    endColumn: 1
                }, breakpointHelperDecoration);
            }
        });
    }
    async setDecorations() {
        if (!this.editor.hasModel()) {
            return;
        }
        const setCandidateDecorations = (changeAccessor, desiredCandidatePositions) => {
            const desiredCandidateDecorations = createCandidateDecorations(model, this.breakpointDecorations, desiredCandidatePositions);
            const candidateDecorationIds = changeAccessor.deltaDecorations(this.candidateDecorations.map(c => c.decorationId), desiredCandidateDecorations);
            this.candidateDecorations.forEach(candidate => {
                candidate.inlineWidget.dispose();
            });
            this.candidateDecorations = candidateDecorationIds.map((decorationId, index) => {
                const candidate = desiredCandidateDecorations[index];
                // Candidate decoration has a breakpoint attached when a breakpoint is already at that location and we did not yet set a decoration there
                // In practice this happens for the first breakpoint that was set on a line
                // We could have also rendered this first decoration as part of desiredBreakpointDecorations however at that moment we have no location information
                const icon = candidate.breakpoint ? getBreakpointMessageAndIcon(this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), candidate.breakpoint, this.labelService, this.debugService.getModel()).icon : icons.breakpoint.disabled;
                const contextMenuActions = () => this.getContextMenuActions(candidate.breakpoint ? [candidate.breakpoint] : [], activeCodeEditor.getModel().uri, candidate.range.startLineNumber, candidate.range.startColumn);
                const inlineWidget = new InlineBreakpointWidget(activeCodeEditor, decorationId, ThemeIcon.asClassName(icon), candidate.breakpoint, this.debugService, this.contextMenuService, contextMenuActions);
                return {
                    decorationId,
                    inlineWidget
                };
            });
        };
        const activeCodeEditor = this.editor;
        const model = activeCodeEditor.getModel();
        const breakpoints = this.debugService.getModel().getBreakpoints({ uri: model.uri });
        const debugSettings = this.configurationService.getValue('debug');
        const desiredBreakpointDecorations = this.instantiationService.invokeFunction(accessor => createBreakpointDecorations(accessor, model, breakpoints, this.debugService.state, this.debugService.getModel().areBreakpointsActivated(), debugSettings.showBreakpointsInOverviewRuler));
        // try to set breakpoint location candidates in the same changeDecorations()
        // call to avoid flickering, if the DA responds reasonably quickly.
        const session = this.debugService.getViewModel().focusedSession;
        const desiredCandidatePositions = debugSettings.showInlineBreakpointCandidates && session ? requestBreakpointCandidateLocations(this.editor.getModel(), desiredBreakpointDecorations.map(bp => bp.range.startLineNumber), session) : Promise.resolve([]);
        const desiredCandidatePositionsRaced = await Promise.race([desiredCandidatePositions, timeout(500).then(() => undefined)]);
        if (desiredCandidatePositionsRaced === undefined) { // the timeout resolved first
            desiredCandidatePositions.then(v => activeCodeEditor.changeDecorations(d => setCandidateDecorations(d, v)));
        }
        try {
            this.ignoreDecorationsChangedEvent = true;
            // Set breakpoint decorations
            activeCodeEditor.changeDecorations((changeAccessor) => {
                const decorationIds = changeAccessor.deltaDecorations(this.breakpointDecorations.map(bpd => bpd.decorationId), desiredBreakpointDecorations);
                this.breakpointDecorations.forEach(bpd => {
                    bpd.inlineWidget?.dispose();
                });
                this.breakpointDecorations = decorationIds.map((decorationId, index) => {
                    let inlineWidget = undefined;
                    const breakpoint = breakpoints[index];
                    if (desiredBreakpointDecorations[index].options.before) {
                        const contextMenuActions = () => this.getContextMenuActions([breakpoint], activeCodeEditor.getModel().uri, breakpoint.lineNumber, breakpoint.column);
                        inlineWidget = new InlineBreakpointWidget(activeCodeEditor, decorationId, desiredBreakpointDecorations[index].options.glyphMarginClassName, breakpoint, this.debugService, this.contextMenuService, contextMenuActions);
                    }
                    return {
                        decorationId,
                        breakpoint,
                        range: desiredBreakpointDecorations[index].range,
                        inlineWidget
                    };
                });
                if (desiredCandidatePositionsRaced) {
                    setCandidateDecorations(changeAccessor, desiredCandidatePositionsRaced);
                }
            });
        }
        finally {
            this.ignoreDecorationsChangedEvent = false;
        }
        for (const d of this.breakpointDecorations) {
            if (d.inlineWidget) {
                this.editor.layoutContentWidget(d.inlineWidget);
            }
        }
    }
    async onModelDecorationsChanged() {
        if (this.breakpointDecorations.length === 0 || this.ignoreDecorationsChangedEvent || !this.editor.hasModel()) {
            // I have no decorations
            return;
        }
        let somethingChanged = false;
        const model = this.editor.getModel();
        this.breakpointDecorations.forEach(breakpointDecoration => {
            if (somethingChanged) {
                return;
            }
            const newBreakpointRange = model.getDecorationRange(breakpointDecoration.decorationId);
            if (newBreakpointRange && (!breakpointDecoration.range.equalsRange(newBreakpointRange))) {
                somethingChanged = true;
                breakpointDecoration.range = newBreakpointRange;
            }
        });
        if (!somethingChanged) {
            // nothing to do, my decorations did not change.
            return;
        }
        const data = new Map();
        for (let i = 0, len = this.breakpointDecorations.length; i < len; i++) {
            const breakpointDecoration = this.breakpointDecorations[i];
            const decorationRange = model.getDecorationRange(breakpointDecoration.decorationId);
            // check if the line got deleted.
            if (decorationRange) {
                // since we know it is collapsed, it cannot grow to multiple lines
                if (breakpointDecoration.breakpoint) {
                    data.set(breakpointDecoration.breakpoint.getId(), {
                        lineNumber: decorationRange.startLineNumber,
                        column: breakpointDecoration.breakpoint.column ? decorationRange.startColumn : undefined,
                    });
                }
            }
        }
        try {
            this.ignoreBreakpointsChangeEvent = true;
            await this.debugService.updateBreakpoints(model.uri, data, true);
        }
        finally {
            this.ignoreBreakpointsChangeEvent = false;
        }
    }
    // breakpoint widget
    showBreakpointWidget(lineNumber, column, context) {
        this.breakpointWidget?.dispose();
        this.breakpointWidget = this.instantiationService.createInstance(BreakpointWidget, this.editor, lineNumber, column, context);
        this.breakpointWidget.show({ lineNumber, column: 1 });
        this.breakpointWidgetVisible.set(true);
    }
    closeBreakpointWidget() {
        if (this.breakpointWidget) {
            this.breakpointWidget.dispose();
            this.breakpointWidget = undefined;
            this.breakpointWidgetVisible.reset();
            this.editor.focus();
        }
    }
    dispose() {
        this.breakpointWidget?.dispose();
        this.setDecorationsScheduler.dispose();
        this.editor.removeDecorations(this.breakpointDecorations.map(bpd => bpd.decorationId));
        dispose(this.toDispose);
    }
};
BreakpointEditorContribution = __decorate([
    __param(1, IDebugService),
    __param(2, IContextMenuService),
    __param(3, IInstantiationService),
    __param(4, IContextKeyService),
    __param(5, IDialogService),
    __param(6, IConfigurationService),
    __param(7, ILabelService)
], BreakpointEditorContribution);
export { BreakpointEditorContribution };
GutterActionsRegistry.registerGutterActionsGenerator(({ lineNumber, editor, accessor }, result) => {
    const model = editor.getModel();
    const debugService = accessor.get(IDebugService);
    if (!model || !debugService.getAdapterManager().hasEnabledDebuggers() || !debugService.canSetBreakpointsIn(model)) {
        return;
    }
    const breakpointEditorContribution = editor.getContribution(BREAKPOINT_EDITOR_CONTRIBUTION_ID);
    if (!breakpointEditorContribution) {
        return;
    }
    const actions = breakpointEditorContribution.getContextMenuActionsAtPosition(lineNumber, model);
    for (const action of actions) {
        result.push(action, '2_debug');
    }
});
class InlineBreakpointWidget {
    constructor(editor, decorationId, cssClass, breakpoint, debugService, contextMenuService, getContextMenuActions) {
        this.editor = editor;
        this.decorationId = decorationId;
        this.breakpoint = breakpoint;
        this.debugService = debugService;
        this.contextMenuService = contextMenuService;
        this.getContextMenuActions = getContextMenuActions;
        // editor.IContentWidget.allowEditorOverflow
        this.allowEditorOverflow = false;
        this.suppressMouseDown = true;
        this.toDispose = [];
        this.range = this.editor.getModel().getDecorationRange(decorationId);
        this.toDispose.push(this.editor.onDidChangeModelDecorations(() => {
            const model = this.editor.getModel();
            const range = model.getDecorationRange(this.decorationId);
            if (this.range && !this.range.equalsRange(range)) {
                this.range = range;
                this.editor.layoutContentWidget(this);
                this.updateSize();
            }
        }));
        this.create(cssClass);
        this.editor.addContentWidget(this);
        this.editor.layoutContentWidget(this);
    }
    create(cssClass) {
        this.domNode = $('.inline-breakpoint-widget');
        if (cssClass) {
            this.domNode.classList.add(...cssClass.split(' '));
        }
        this.toDispose.push(dom.addDisposableListener(this.domNode, dom.EventType.CLICK, async (e) => {
            switch (this.breakpoint?.enabled) {
                case undefined:
                    await this.debugService.addBreakpoints(this.editor.getModel().uri, [{ lineNumber: this.range.startLineNumber, column: this.range.startColumn }]);
                    break;
                case true:
                    await this.debugService.removeBreakpoints(this.breakpoint.getId());
                    break;
                case false:
                    this.debugService.enableOrDisableBreakpoints(true, this.breakpoint);
                    break;
            }
        }));
        this.toDispose.push(dom.addDisposableListener(this.domNode, dom.EventType.CONTEXT_MENU, e => {
            const event = new StandardMouseEvent(dom.getWindow(this.domNode), e);
            const actions = this.getContextMenuActions();
            this.contextMenuService.showContextMenu({
                getAnchor: () => event,
                getActions: () => actions,
                getActionsContext: () => this.breakpoint,
                onHide: () => disposeIfDisposable(actions)
            });
        }));
        this.updateSize();
        this.toDispose.push(this.editor.onDidChangeConfiguration(c => {
            if (c.hasChanged(61 /* EditorOption.fontSize */) || c.hasChanged(75 /* EditorOption.lineHeight */)) {
                this.updateSize();
            }
        }));
    }
    updateSize() {
        const lineHeight = this.range ? this.editor.getLineHeightForPosition(this.range.getStartPosition()) : this.editor.getOption(75 /* EditorOption.lineHeight */);
        this.domNode.style.height = `${lineHeight}px`;
        this.domNode.style.width = `${Math.ceil(0.8 * lineHeight)}px`;
        this.domNode.style.marginLeft = `4px`;
    }
    getId() {
        return generateUuid();
    }
    getDomNode() {
        return this.domNode;
    }
    getPosition() {
        if (!this.range) {
            return null;
        }
        // Workaround: since the content widget can not be placed before the first column we need to force the left position
        this.domNode.classList.toggle('line-start', this.range.startColumn === 1);
        return {
            position: { lineNumber: this.range.startLineNumber, column: this.range.startColumn - 1 },
            preference: [0 /* ContentWidgetPositionPreference.EXACT */]
        };
    }
    dispose() {
        this.editor.removeContentWidget(this);
        dispose(this.toDispose);
    }
}
__decorate([
    memoize
], InlineBreakpointWidget.prototype, "getId", null);
registerThemingParticipant((theme, collector) => {
    const scope = '.monaco-editor .glyph-margin-widgets, .monaco-workbench .debug-breakpoints, .monaco-workbench .disassembly-view, .monaco-editor .contentWidgets';
    const debugIconBreakpointColor = theme.getColor(debugIconBreakpointForeground);
    if (debugIconBreakpointColor) {
        collector.addRule(`${scope} {
			${icons.allBreakpoints.map(b => `${ThemeIcon.asCSSSelector(b.regular)}`).join(',\n		')},
			${ThemeIcon.asCSSSelector(icons.debugBreakpointUnsupported)},
			${ThemeIcon.asCSSSelector(icons.debugBreakpointHint)}:not([class*='codicon-debug-breakpoint']):not([class*='codicon-debug-stackframe']),
			${ThemeIcon.asCSSSelector(icons.breakpoint.regular)}${ThemeIcon.asCSSSelector(icons.debugStackframeFocused)}::after,
			${ThemeIcon.asCSSSelector(icons.breakpoint.regular)}${ThemeIcon.asCSSSelector(icons.debugStackframe)}::after {
				color: ${debugIconBreakpointColor} !important;
			}
		}`);
        collector.addRule(`${scope} {
			${ThemeIcon.asCSSSelector(icons.breakpoint.pending)} {
				color: ${debugIconBreakpointColor} !important;
				font-size: 12px !important;
			}
		}`);
    }
    const debugIconBreakpointDisabledColor = theme.getColor(debugIconBreakpointDisabledForeground);
    if (debugIconBreakpointDisabledColor) {
        collector.addRule(`${scope} {
			${icons.allBreakpoints.map(b => ThemeIcon.asCSSSelector(b.disabled)).join(',\n		')} {
				color: ${debugIconBreakpointDisabledColor};
			}
		}`);
    }
    const debugIconBreakpointUnverifiedColor = theme.getColor(debugIconBreakpointUnverifiedForeground);
    if (debugIconBreakpointUnverifiedColor) {
        collector.addRule(`${scope} {
			${icons.allBreakpoints.map(b => ThemeIcon.asCSSSelector(b.unverified)).join(',\n		')} {
				color: ${debugIconBreakpointUnverifiedColor};
			}
		}`);
    }
    const debugIconBreakpointCurrentStackframeForegroundColor = theme.getColor(debugIconBreakpointCurrentStackframeForeground);
    if (debugIconBreakpointCurrentStackframeForegroundColor) {
        collector.addRule(`
		.monaco-editor .debug-top-stack-frame-column {
			color: ${debugIconBreakpointCurrentStackframeForegroundColor} !important;
		}
		${scope} {
			${ThemeIcon.asCSSSelector(icons.debugStackframe)} {
				color: ${debugIconBreakpointCurrentStackframeForegroundColor} !important;
			}
		}
		`);
    }
    const debugIconBreakpointStackframeFocusedColor = theme.getColor(debugIconBreakpointStackframeForeground);
    if (debugIconBreakpointStackframeFocusedColor) {
        collector.addRule(`${scope} {
			${ThemeIcon.asCSSSelector(icons.debugStackframeFocused)} {
				color: ${debugIconBreakpointStackframeFocusedColor} !important;
			}
		}`);
    }
});
export const debugIconBreakpointForeground = registerColor('debugIcon.breakpointForeground', '#E51400', nls.localize('debugIcon.breakpointForeground', 'Icon color for breakpoints.'));
const debugIconBreakpointDisabledForeground = registerColor('debugIcon.breakpointDisabledForeground', '#848484', nls.localize('debugIcon.breakpointDisabledForeground', 'Icon color for disabled breakpoints.'));
const debugIconBreakpointUnverifiedForeground = registerColor('debugIcon.breakpointUnverifiedForeground', '#848484', nls.localize('debugIcon.breakpointUnverifiedForeground', 'Icon color for unverified breakpoints.'));
const debugIconBreakpointCurrentStackframeForeground = registerColor('debugIcon.breakpointCurrentStackframeForeground', { dark: '#FFCC00', light: '#BE8700', hcDark: '#FFCC00', hcLight: '#BE8700' }, nls.localize('debugIcon.breakpointCurrentStackframeForeground', 'Icon color for the current breakpoint stack frame.'));
const debugIconBreakpointStackframeForeground = registerColor('debugIcon.breakpointStackframeForeground', '#89D185', nls.localize('debugIcon.breakpointStackframeForeground', 'Icon color for all breakpoint stack frames.'));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJlYWtwb2ludEVkaXRvckNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2JyZWFrcG9pbnRFZGl0b3JDb250cmlidXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN0RSxPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQzVFLE9BQU8sRUFBVyxTQUFTLEVBQUUsYUFBYSxFQUFFLFFBQVEsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDN0UsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixFQUFlLE1BQU0sc0NBQXNDLENBQUM7QUFDakcsT0FBTyxLQUFLLEdBQUcsTUFBTSxxQ0FBcUMsQ0FBQztBQUMzRCxPQUFPLFFBQVEsTUFBTSxxQ0FBcUMsQ0FBQztBQUMzRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN2RSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0NBQXNDLENB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