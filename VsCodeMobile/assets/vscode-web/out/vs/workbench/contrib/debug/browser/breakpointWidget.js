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
import * as dom from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import * as lifecycle from '../../../../base/common/lifecycle.js';
import { URI as uri } from '../../../../base/common/uri.js';
import { EditorCommand, registerEditorCommand } from '../../../../editor/browser/editorExtensions.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { CodeEditorWidget } from '../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { Position } from '../../../../editor/common/core/position.js';
import { Range } from '../../../../editor/common/core/range.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { PLAINTEXT_LANGUAGE_ID } from '../../../../editor/common/languages/modesRegistry.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { CompletionOptions, provideSuggestionItems } from '../../../../editor/contrib/suggest/browser/suggest.js';
import { ZoneWidget } from '../../../../editor/contrib/zoneWidget/browser/zoneWidget.js';
import * as nls from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService, createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { defaultButtonStyles, defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { editorForeground } from '../../../../platform/theme/common/colorRegistry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { hasNativeContextMenu } from '../../../../platform/window/common/window.js';
import { getSimpleCodeEditorWidgetOptions, getSimpleEditorOptions } from '../../codeEditor/browser/simpleEditorOptions.js';
import { BREAKPOINT_EDITOR_CONTRIBUTION_ID, CONTEXT_BREAKPOINT_WIDGET_VISIBLE, CONTEXT_IN_BREAKPOINT_WIDGET, DEBUG_SCHEME, IDebugService } from '../common/debug.js';
import './media/breakpointWidget.css';
const $ = dom.$;
const IPrivateBreakpointWidgetService = createDecorator('privateBreakpointWidgetService');
const DECORATION_KEY = 'breakpointwidgetdecoration';
function isPositionInCurlyBracketBlock(input) {
    const model = input.getModel();
    const bracketPairs = model.bracketPairs.getBracketPairsInRange(Range.fromPositions(input.getPosition()));
    return bracketPairs.some(p => p.openingBracketInfo.bracketText === '{');
}
function createDecorations(theme, placeHolder) {
    const transparentForeground = theme.getColor(editorForeground)?.transparent(0.4);
    return [{
            range: {
                startLineNumber: 0,
                endLineNumber: 0,
                startColumn: 0,
                endColumn: 1
            },
            renderOptions: {
                after: {
                    contentText: placeHolder,
                    color: transparentForeground ? transparentForeground.toString() : undefined
                }
            }
        }];
}
let BreakpointWidget = class BreakpointWidget extends ZoneWidget {
    constructor(editor, lineNumber, column, context, contextViewService, debugService, themeService, instantiationService, modelService, codeEditorService, _configurationService, languageFeaturesService, keybindingService, labelService, textModelService, hoverService) {
        super(editor, { showFrame: true, showArrow: false, frameWidth: 1, isAccessible: true });
        this.lineNumber = lineNumber;
        this.column = column;
        this.contextViewService = contextViewService;
        this.debugService = debugService;
        this.themeService = themeService;
        this.instantiationService = instantiationService;
        this.modelService = modelService;
        this.codeEditorService = codeEditorService;
        this._configurationService = _configurationService;
        this.languageFeaturesService = languageFeaturesService;
        this.keybindingService = keybindingService;
        this.labelService = labelService;
        this.textModelService = textModelService;
        this.hoverService = hoverService;
        this.conditionInput = '';
        this.hitCountInput = '';
        this.logMessageInput = '';
        this.store = new lifecycle.DisposableStore();
        const model = this.editor.getModel();
        if (model) {
            const uri = model.uri;
            const breakpoints = this.debugService.getModel().getBreakpoints({ lineNumber: this.lineNumber, column: this.column, uri });
            this.breakpoint = breakpoints.length ? breakpoints[0] : undefined;
        }
        if (context === undefined) {
            if (this.breakpoint && !this.breakpoint.condition && !this.breakpoint.hitCondition && this.breakpoint.logMessage) {
                this.context = 2 /* Context.LOG_MESSAGE */;
            }
            else if (this.breakpoint && !this.breakpoint.condition && this.breakpoint.hitCondition) {
                this.context = 1 /* Context.HIT_COUNT */;
            }
            else if (this.breakpoint && this.breakpoint.triggeredBy) {
                this.context = 3 /* Context.TRIGGER_POINT */;
            }
            else {
                this.context = 0 /* Context.CONDITION */;
            }
        }
        else {
            this.context = context;
        }
        this.store.add(this.debugService.getModel().onDidChangeBreakpoints(e => {
            if (this.breakpoint && e && e.removed && e.removed.indexOf(this.breakpoint) >= 0) {
                this.dispose();
            }
        }));
        this.codeEditorService.registerDecorationType('breakpoint-widget', DECORATION_KEY, {});
        this.create();
    }
    get placeholder() {
        const acceptString = this.keybindingService.lookupKeybinding(AcceptBreakpointWidgetInputAction.ID)?.getLabel() || 'Enter';
        const closeString = this.keybindingService.lookupKeybinding(CloseBreakpointWidgetCommand.ID)?.getLabel() || 'Escape';
        switch (this.context) {
            case 2 /* Context.LOG_MESSAGE */:
                return nls.localize('breakpointWidgetLogMessagePlaceholder', "Message to log when breakpoint is hit. Expressions within {} are interpolated. '{0}' to accept, '{1}' to cancel.", acceptString, closeString);
            case 1 /* Context.HIT_COUNT */:
                return nls.localize('breakpointWidgetHitCountPlaceholder', "Break when hit count condition is met. '{0}' to accept, '{1}' to cancel.", acceptString, closeString);
            default:
                return nls.localize('breakpointWidgetExpressionPlaceholder', "Break when expression evaluates to true. '{0}' to accept, '{1}' to cancel.", acceptString, closeString);
        }
    }
    getInputValue(breakpoint) {
        switch (this.context) {
            case 2 /* Context.LOG_MESSAGE */:
                return breakpoint && breakpoint.logMessage ? breakpoint.logMessage : this.logMessageInput;
            case 1 /* Context.HIT_COUNT */:
                return breakpoint && breakpoint.hitCondition ? breakpoint.hitCondition : this.hitCountInput;
            default:
                return breakpoint && breakpoint.condition ? breakpoint.condition : this.conditionInput;
        }
    }
    rememberInput() {
        if (this.context !== 3 /* Context.TRIGGER_POINT */) {
            const value = this.input.getModel().getValue();
            switch (this.context) {
                case 2 /* Context.LOG_MESSAGE */:
                    this.logMessageInput = value;
                    break;
                case 1 /* Context.HIT_COUNT */:
                    this.hitCountInput = value;
                    break;
                default:
                    this.conditionInput = value;
            }
        }
    }
    setInputMode() {
        if (this.editor.hasModel()) {
            // Use plaintext language for log messages, otherwise respect underlying editor language #125619
            const languageId = this.context === 2 /* Context.LOG_MESSAGE */ ? PLAINTEXT_LANGUAGE_ID : this.editor.getModel().getLanguageId();
            this.input.getModel().setLanguage(languageId);
        }
    }
    show(rangeOrPos) {
        const lineNum = this.input.getModel().getLineCount();
        super.show(rangeOrPos, lineNum + 1);
    }
    fitHeightToContent() {
        const lineNum = this.input.getModel().getLineCount();
        this._relayout(lineNum + 1);
    }
    _fillContainer(container) {
        this.setCssClass('breakpoint-widget');
        const selectBox = this.store.add(new SelectBox([
            { text: nls.localize('expression', "Expression") },
            { text: nls.localize('hitCount', "Hit Count") },
            { text: nls.localize('logMessage', "Log Message") },
            { text: nls.localize('triggeredBy', "Wait for Breakpoint") },
        ], this.context, this.contextViewService, defaultSelectBoxStyles, { ariaLabel: nls.localize('breakpointType', 'Breakpoint Type'), useCustomDrawn: !hasNativeContextMenu(this._configurationService) }));
        this.selectContainer = $('.breakpoint-select-container');
        selectBox.render(dom.append(container, this.selectContainer));
        this.store.add(selectBox.onDidSelect(e => {
            this.rememberInput();
            this.context = e.index;
            this.updateContextInput();
        }));
        this.createModesInput(container);
        this.inputContainer = $('.inputContainer');
        this.store.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), this.inputContainer, this.placeholder));
        this.createBreakpointInput(dom.append(container, this.inputContainer));
        this.input.getModel().setValue(this.getInputValue(this.breakpoint));
        this.store.add(this.input.getModel().onDidChangeContent(() => {
            this.fitHeightToContent();
        }));
        this.input.setPosition({ lineNumber: 1, column: this.input.getModel().getLineMaxColumn(1) });
        this.createTriggerBreakpointInput(container);
        this.updateContextInput();
        // Due to an electron bug we have to do the timeout, otherwise we do not get focus
        setTimeout(() => this.focusInput(), 150);
    }
    createModesInput(container) {
        const modes = this.debugService.getModel().getBreakpointModes('source');
        if (modes.length <= 1) {
            return;
        }
        const sb = this.selectModeBox = new SelectBox([
            { text: nls.localize('bpMode', 'Mode'), isDisabled: true },
            ...modes.map(mode => ({ text: mode.label, description: mode.description })),
        ], modes.findIndex(m => m.mode === this.breakpoint?.mode) + 1, this.contextViewService, defaultSelectBoxStyles, { useCustomDrawn: !hasNativeContextMenu(this._configurationService) });
        this.store.add(sb);
        this.store.add(sb.onDidSelect(e => {
            this.modeInput = modes[e.index - 1];
        }));
        const modeWrapper = $('.select-mode-container');
        const selectionWrapper = $('.select-box-container');
        dom.append(modeWrapper, selectionWrapper);
        sb.render(selectionWrapper);
        dom.append(container, modeWrapper);
    }
    createTriggerBreakpointInput(container) {
        const breakpoints = this.debugService.getModel().getBreakpoints().filter(bp => bp !== this.breakpoint && !bp.logMessage);
        const breakpointOptions = [
            { text: nls.localize('noTriggerByBreakpoint', 'None'), isDisabled: true },
            ...breakpoints.map(bp => ({
                text: `${this.labelService.getUriLabel(bp.uri, { relative: true })}: ${bp.lineNumber}`,
                description: nls.localize('triggerByLoading', 'Loading...')
            })),
        ];
        const index = breakpoints.findIndex((bp) => this.breakpoint?.triggeredBy === bp.getId());
        for (const [i, bp] of breakpoints.entries()) {
            this.textModelService.createModelReference(bp.uri).then(ref => {
                try {
                    breakpointOptions[i + 1].description = ref.object.textEditorModel.getLineContent(bp.lineNumber).trim();
                }
                finally {
                    ref.dispose();
                }
            }).catch(() => {
                breakpointOptions[i + 1].description = nls.localize('noBpSource', 'Could not load source.');
            });
        }
        const selectBreakpointBox = this.selectBreakpointBox = this.store.add(new SelectBox(breakpointOptions, index + 1, this.contextViewService, defaultSelectBoxStyles, { ariaLabel: nls.localize('selectBreakpoint', 'Select breakpoint'), useCustomDrawn: !hasNativeContextMenu(this._configurationService) }));
        this.store.add(selectBreakpointBox.onDidSelect(e => {
            if (e.index === 0) {
                this.triggeredByBreakpointInput = undefined;
            }
            else {
                this.triggeredByBreakpointInput = breakpoints[e.index - 1];
            }
        }));
        this.selectBreakpointContainer = $('.select-breakpoint-container');
        this.store.add(dom.addDisposableListener(this.selectBreakpointContainer, dom.EventType.KEY_DOWN, e => {
            const event = new StandardKeyboardEvent(e);
            if (event.equals(9 /* KeyCode.Escape */)) {
                this.close(false);
            }
        }));
        const selectionWrapper = $('.select-box-container');
        dom.append(this.selectBreakpointContainer, selectionWrapper);
        selectBreakpointBox.render(selectionWrapper);
        dom.append(container, this.selectBreakpointContainer);
        const closeButton = new Button(this.selectBreakpointContainer, defaultButtonStyles);
        closeButton.label = nls.localize('ok', "OK");
        this.store.add(closeButton.onDidClick(() => this.close(true)));
        this.store.add(closeButton);
    }
    updateContextInput() {
        if (this.context === 3 /* Context.TRIGGER_POINT */) {
            this.inputContainer.hidden = true;
            this.selectBreakpointContainer.hidden = false;
        }
        else {
            this.inputContainer.hidden = false;
            this.selectBreakpointContainer.hidden = true;
            this.setInputMode();
            const value = this.getInputValue(this.breakpoint);
            this.input.getModel().setValue(value);
            this.focusInput();
        }
    }
    _doLayout(heightInPixel, widthInPixel) {
        this.heightInPx = heightInPixel;
        this.input.layout({ height: heightInPixel, width: widthInPixel - 113 });
        this.centerInputVertically();
    }
    _onWidth(widthInPixel) {
        if (typeof this.heightInPx === 'number') {
            this._doLayout(this.heightInPx, widthInPixel);
        }
    }
    createBreakpointInput(container) {
        const scopedInstatiationService = this.instantiationService.createChild(new ServiceCollection([IPrivateBreakpointWidgetService, this]));
        this.store.add(scopedInstatiationService);
        const options = this.createEditorOptions();
        const codeEditorWidgetOptions = getSimpleCodeEditorWidgetOptions();
        this.input = scopedInstatiationService.createInstance(CodeEditorWidget, container, options, codeEditorWidgetOptions);
        CONTEXT_IN_BREAKPOINT_WIDGET.bindTo(this.input.contextKeyService).set(true);
        const model = this.modelService.createModel('', null, uri.parse(`${DEBUG_SCHEME}:${this.editor.getId()}:breakpointinput`), true);
        if (this.editor.hasModel()) {
            model.setLanguage(this.editor.getModel().getLanguageId());
        }
        this.input.setModel(model);
        this.setInputMode();
        this.store.add(model);
        const setDecorations = () => {
            const value = this.input.getModel().getValue();
            const decorations = !!value ? [] : createDecorations(this.themeService.getColorTheme(), this.placeholder);
            this.input.setDecorationsByType('breakpoint-widget', DECORATION_KEY, decorations);
        };
        this.store.add(this.input.getModel().onDidChangeContent(() => setDecorations()));
        this.store.add(this.themeService.onDidColorThemeChange(() => setDecorations()));
        this.store.add(this.languageFeaturesService.completionProvider.register({ scheme: DEBUG_SCHEME, hasAccessToAllModels: true }, {
            _debugDisplayName: 'breakpointWidget',
            provideCompletionItems: (model, position, _context, token) => {
                let suggestionsPromise;
                const underlyingModel = this.editor.getModel();
                if (underlyingModel && (this.context === 0 /* Context.CONDITION */ || (this.context === 2 /* Context.LOG_MESSAGE */ && isPositionInCurlyBracketBlock(this.input)))) {
                    suggestionsPromise = provideSuggestionItems(this.languageFeaturesService.completionProvider, underlyingModel, new Position(this.lineNumber, 1), new CompletionOptions(undefined, new Set().add(28 /* CompletionItemKind.Snippet */)), _context, token).then(suggestions => {
                        let overwriteBefore = 0;
                        if (this.context === 0 /* Context.CONDITION */) {
                            overwriteBefore = position.column - 1;
                        }
                        else {
                            // Inside the currly brackets, need to count how many useful characters are behind the position so they would all be taken into account
                            const value = this.input.getModel().getValue();
                            while ((position.column - 2 - overwriteBefore >= 0) && value[position.column - 2 - overwriteBefore] !== '{' && value[position.column - 2 - overwriteBefore] !== ' ') {
                                overwriteBefore++;
                            }
                        }
                        return {
                            suggestions: suggestions.items.map(s => {
                                s.completion.range = Range.fromPositions(position.delta(0, -overwriteBefore), position);
                                return s.completion;
                            })
                        };
                    });
                }
                else {
                    suggestionsPromise = Promise.resolve({ suggestions: [] });
                }
                return suggestionsPromise;
            }
        }));
        this.store.add(this._configurationService.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('editor.fontSize') || e.affectsConfiguration('editor.lineHeight')) {
                this.input.updateOptions(this.createEditorOptions());
                this.centerInputVertically();
            }
        }));
    }
    createEditorOptions() {
        const editorConfig = this._configurationService.getValue('editor');
        const options = getSimpleEditorOptions(this._configurationService);
        options.fontSize = editorConfig.fontSize;
        options.fontFamily = editorConfig.fontFamily;
        options.lineHeight = editorConfig.lineHeight;
        options.fontLigatures = editorConfig.fontLigatures;
        options.ariaLabel = this.placeholder;
        return options;
    }
    centerInputVertically() {
        if (this.container && typeof this.heightInPx === 'number') {
            const lineHeight = this.input.getOption(75 /* EditorOption.lineHeight */);
            const lineNum = this.input.getModel().getLineCount();
            const newTopMargin = (this.heightInPx - lineNum * lineHeight) / 2;
            this.inputContainer.style.marginTop = newTopMargin + 'px';
        }
    }
    close(success) {
        if (success) {
            // if there is already a breakpoint on this location - remove it.
            let condition = undefined;
            let hitCondition = undefined;
            let logMessage = undefined;
            let triggeredBy = undefined;
            let mode = undefined;
            let modeLabel = undefined;
            this.rememberInput();
            if (this.conditionInput || this.context === 0 /* Context.CONDITION */) {
                condition = this.conditionInput;
            }
            if (this.hitCountInput || this.context === 1 /* Context.HIT_COUNT */) {
                hitCondition = this.hitCountInput;
            }
            if (this.logMessageInput || this.context === 2 /* Context.LOG_MESSAGE */) {
                logMessage = this.logMessageInput;
            }
            if (this.selectModeBox) {
                mode = this.modeInput?.mode;
                modeLabel = this.modeInput?.label;
            }
            if (this.context === 3 /* Context.TRIGGER_POINT */) {
                // currently, trigger points don't support additional conditions:
                condition = undefined;
                hitCondition = undefined;
                logMessage = undefined;
                triggeredBy = this.triggeredByBreakpointInput?.getId();
            }
            if (this.breakpoint) {
                const data = new Map();
                data.set(this.breakpoint.getId(), {
                    condition,
                    hitCondition,
                    logMessage,
                    triggeredBy,
                    mode,
                    modeLabel,
                });
                this.debugService.updateBreakpoints(this.breakpoint.originalUri, data, false).then(undefined, onUnexpectedError);
            }
            else {
                const model = this.editor.getModel();
                if (model) {
                    this.debugService.addBreakpoints(model.uri, [{
                            lineNumber: this.lineNumber,
                            column: this.column,
                            enabled: true,
                            condition,
                            hitCondition,
                            logMessage,
                            triggeredBy,
                            mode,
                            modeLabel,
                        }]);
                }
            }
        }
        this.dispose();
    }
    focusInput() {
        if (this.context === 3 /* Context.TRIGGER_POINT */) {
            this.selectBreakpointBox.focus();
        }
        else {
            this.input.focus();
        }
    }
    dispose() {
        super.dispose();
        this.input.dispose();
        lifecycle.dispose(this.store);
        setTimeout(() => this.editor.focus(), 0);
    }
};
BreakpointWidget = __decorate([
    __param(4, IContextViewService),
    __param(5, IDebugService),
    __param(6, IThemeService),
    __param(7, IInstantiationService),
    __param(8, IModelService),
    __param(9, ICodeEditorService),
    __param(10, IConfigurationService),
    __param(11, ILanguageFeaturesService),
    __param(12, IKeybindingService),
    __param(13, ILabelService),
    __param(14, ITextModelService),
    __param(15, IHoverService)
], BreakpointWidget);
export { BreakpointWidget };
class AcceptBreakpointWidgetInputAction extends EditorCommand {
    static { this.ID = 'breakpointWidget.action.acceptInput'; }
    constructor() {
        super({
            id: AcceptBreakpointWidgetInputAction.ID,
            precondition: CONTEXT_BREAKPOINT_WIDGET_VISIBLE,
            kbOpts: {
                kbExpr: CONTEXT_IN_BREAKPOINT_WIDGET,
                primary: 3 /* KeyCode.Enter */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
    runEditorCommand(accessor, editor) {
        accessor.get(IPrivateBreakpointWidgetService).close(true);
    }
}
class CloseBreakpointWidgetCommand extends EditorCommand {
    static { this.ID = 'closeBreakpointWidget'; }
    constructor() {
        super({
            id: CloseBreakpointWidgetCommand.ID,
            precondition: CONTEXT_BREAKPOINT_WIDGET_VISIBLE,
            kbOpts: {
                kbExpr: EditorContextKeys.textInputFocus,
                primary: 9 /* KeyCode.Escape */,
                secondary: [1024 /* KeyMod.Shift */ | 9 /* KeyCode.Escape */],
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
    runEditorCommand(accessor, editor, args) {
        const debugContribution = editor.getContribution(BREAKPOINT_EDITOR_CONTRIBUTION_ID);
        if (debugContribution) {
            // if focus is in outer editor we need to use the debug contribution to close
            return debugContribution.closeBreakpointWidget();
        }
        accessor.get(IPrivateBreakpointWidgetService).close(false);
    }
}
registerEditorCommand(new AcceptBreakpointWidgetInputAction());
registerEditorCommand(new CloseBreakpointWidgetCommand());
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJlYWtwb2ludFdpZGdldC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2JyZWFrcG9pbnRXaWRnZXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUNsRixPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDdEUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDcEcsT0FBTyxFQUFxQixTQUFTLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUVsRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUV0RSxPQUFPLEtBQUssU0FBUyxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxHQUFHLElBQUksR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFNUQsT0FBTyxFQUFFLGFBQWEsRUFBb0IscUJBQXFCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUN4SCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUM5RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUVwRyxPQUFPLEVBQWEsUUFBUSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDakYsT0FBTyxFQUFVLEtBQUssRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRXhFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBRW5GLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBRTdGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNsSCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDekYsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM5RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDNUUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ3BILE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBQ25HLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBRTFGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNsSCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN0RixPQUFPLEVBQWUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDL0YsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDcEYsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLHNCQUFzQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDM0gsT0FBTyxFQUFFLGlDQUFpQyxFQUFFLGlDQUFpQyxFQUFFLDRCQUE0QixFQUFzQyxZQUFZLEVBQXFFLGFBQWEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzVRLE9BQU8sOEJBQThCLENBQUM7QUFFdEMsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNoQixNQUFNLCtCQUErQixHQUFHLGVBQWUsQ0FBa0MsZ0NBQWdDLENBQUMsQ0FBQztBQUszSCxNQUFNLGNBQWMsR0FBRyw0QkFBNEIsQ0FBQztBQUVwRCxTQUFTLDZCQUE2QixDQUFDLEtBQXdCO0lBQzlELE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUMvQixNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsWUFBWSxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN6RyxPQUFPLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsV0FBVyxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ3pFLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLEtBQWtCLEVBQUUsV0FBbUI7SUFDakUsTUFBTSxxQkFBcUIsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2pGLE9BQU8sQ0FBQztZQUNQLEtBQUssRUFBRTtnQkFDTixlQUFlLEVBQUUsQ0FBQztnQkFDbEIsYUFBYSxFQUFFLENBQUM7Z0JBQ2hCLFdBQVcsRUFBRSxDQUFDO2dCQUNkLFNBQVMsRUFBRSxDQUFDO2FBQ1o7WUFDRCxhQUFhLEVBQUU7Z0JBQ2QsS0FBSyxFQUFFO29CQUNOLFdBQVcsRUFBRSxXQUFXO29CQUN4QixLQUFLLEVBQUUscUJBQXFCLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTO2lCQUMzRTthQUNEO1NBQ0QsQ0FBQyxDQUFDO0FBQ0osQ0FBQztBQUVNLElBQU0sZ0JBQWdCLEdBQXRCLE1BQU0sZ0JBQWlCLFNBQVEsVUFBVTtJQW1CL0MsWUFBWSxNQUFtQixFQUFVLFVBQWtCLEVBQVUsTUFBMEIsRUFBRSxPQUE0QixFQUN2RyxrQkFBd0QsRUFDOUQsWUFBNEMsRUFDNUMsWUFBNEMsRUFDcEMsb0JBQTRELEVBQ3BFLFlBQTRDLEVBQ3ZDLGlCQUFzRCxFQUNuRCxxQkFBNkQsRUFDMUQsdUJBQWtFLEVBQ3hFLGlCQUFzRCxFQUMzRCxZQUE0QyxFQUN4QyxnQkFBb0QsRUFDeEQsWUFBNEM7UUFFM0QsS0FBSyxDQUFDLE1BQU0sRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBZGhELGVBQVUsR0FBVixVQUFVLENBQVE7UUFBVSxXQUFNLEdBQU4sTUFBTSxDQUFvQjtRQUN4RCx1QkFBa0IsR0FBbEIsa0JBQWtCLENBQXFCO1FBQzdDLGlCQUFZLEdBQVosWUFBWSxDQUFlO1FBQzNCLGlCQUFZLEdBQVosWUFBWSxDQUFlO1FBQ25CLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBdUI7UUFDbkQsaUJBQVksR0FBWixZQUFZLENBQWU7UUFDdEIsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFvQjtRQUNsQywwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO1FBQ3pDLDRCQUF1QixHQUF2Qix1QkFBdUIsQ0FBMEI7UUFDdkQsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFvQjtRQUMxQyxpQkFBWSxHQUFaLFlBQVksQ0FBZTtRQUN2QixxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQW1CO1FBQ3ZDLGlCQUFZLEdBQVosWUFBWSxDQUFlO1FBckJwRCxtQkFBYyxHQUFHLEVBQUUsQ0FBQztRQUNwQixrQkFBYSxHQUFHLEVBQUUsQ0FBQztRQUNuQixvQkFBZSxHQUFHLEVBQUUsQ0FBQztRQXVCNUIsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLFNBQVMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUM3QyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3JDLElBQUksS0FBSyxFQUFFLENBQUM7WUFDWCxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDO1lBQ3RCLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUMsY0FBYyxDQUFDLEVBQUUsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztZQUMzSCxJQUFJLENBQUMsVUFBVSxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ25FLENBQUM7UUFFRCxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUMzQixJQUFJLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsWUFBWSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQ2xILElBQUksQ0FBQyxPQUFPLDhCQUFzQixDQUFDO1lBQ3BDLENBQUM7aUJBQU0sSUFBSSxJQUFJLENBQUMsVUFBVSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFDMUYsSUFBSSxDQUFDLE9BQU8sNEJBQW9CLENBQUM7WUFDbEMsQ0FBQztpQkFBTSxJQUFJLElBQUksQ0FBQyxVQUFVLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDM0QsSUFBSSxDQUFDLE9BQU8sZ0NBQXdCLENBQUM7WUFDdEMsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLElBQUksQ0FBQyxPQUFPLDRCQUFvQixDQUFDO1lBQ2xDLENBQUM7UUFDRixDQUFDO2FBQU0sQ0FBQztZQUNQLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3hCLENBQUM7UUFFRCxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ3RFLElBQUksSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ2xGLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNoQixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNKLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxzQkFBc0IsQ0FBQyxtQkFBbUIsRUFBRSxjQUFjLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFdkYsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO0lBQ2YsQ0FBQztJQUVELElBQVksV0FBVztRQUN0QixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsZ0JBQWdCLENBQUMsaUNBQWlDLENBQUMsRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLElBQUksT0FBTyxDQUFDO1FBQzFILE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsQ0FBQyw0QkFBNEIsQ0FBQyxFQUFFLENBQUMsRUFBRSxRQUFRLEVBQUUsSUFBSSxRQUFRLENBQUM7UUFDckgsUUFBUSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdEI7Z0JBQ0MsT0FBTyxHQUFHLENBQUMsUUFBUSxDQUFDLHVDQUF1QyxFQUFFLGtIQUFrSCxFQUFFLFlBQVksRUFBRSxXQUFXLENBQUMsQ0FBQztZQUM3TTtnQkFDQyxPQUFPLEdBQUcsQ0FBQyxRQUFRLENBQUMscUNBQXFDLEVBQUUsMEVBQTBFLEVBQUUsWUFBWSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1lBQ25LO2dCQUNDLE9BQU8sR0FBRyxDQUFDLFFBQVEsQ0FBQyx1Q0FBdUMsRUFBRSw0RUFBNEUsRUFBRSxZQUFZLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDeEssQ0FBQztJQUNGLENBQUM7SUFFTyxhQUFhLENBQUMsVUFBbUM7UUFDeEQsUUFBUSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdEI7Z0JBQ0MsT0FBTyxVQUFVLElBQUksVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQztZQUMzRjtnQkFDQyxPQUFPLFVBQVUsSUFBSSxVQUFVLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO1lBQzdGO2dCQUNDLE9BQU8sVUFBVSxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7UUFDekYsQ0FBQztJQUNGLENBQUM7SUFFTyxhQUFhO1FBQ3BCLElBQUksSUFBSSxDQUFDLE9BQU8sa0NBQTBCLEVBQUUsQ0FBQztZQUM1QyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQy9DLFFBQVEsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUN0QjtvQkFDQyxJQUFJLENBQUMsZUFBZSxHQUFHLEtBQUssQ0FBQztvQkFDN0IsTUFBTTtnQkFDUDtvQkFDQyxJQUFJLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQztvQkFDM0IsTUFBTTtnQkFDUDtvQkFDQyxJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQztZQUM5QixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFTyxZQUFZO1FBQ25CLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDO1lBQzVCLGdHQUFnRztZQUNoRyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsT0FBTyxnQ0FBd0IsQ0FBQyxDQUFDLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDekgsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDL0MsQ0FBQztJQUNGLENBQUM7SUFFUSxJQUFJLENBQUMsVUFBOEI7UUFDM0MsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNyRCxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxPQUFPLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVELGtCQUFrQjtRQUNqQixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3JELElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFFUyxjQUFjLENBQUMsU0FBc0I7UUFDOUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3RDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksU0FBUyxDQUFDO1lBQzlDLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFLFlBQVksQ0FBQyxFQUFFO1lBQ2xELEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLFdBQVcsQ0FBQyxFQUFFO1lBQy9DLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxFQUFFO1lBQ25ELEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFLHFCQUFxQixDQUFDLEVBQUU7U0FDOUIsRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxzQkFBc0IsRUFBRSxFQUFFLFNBQVMsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLGdCQUFnQixFQUFFLGlCQUFpQixDQUFDLEVBQUUsY0FBYyxFQUFFLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDdE8sSUFBSSxDQUFDLGVBQWUsR0FBRyxDQUFDLENBQUMsOEJBQThCLENBQUMsQ0FBQztRQUN6RCxTQUFTLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO1FBQzlELElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDeEMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3JCLElBQUksQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUN2QixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUMzQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRWpDLElBQUksQ0FBQyxjQUFjLEdBQUcsQ0FBQyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDM0MsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyx1QkFBdUIsQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBQzdILElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztRQUV2RSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1FBQ3BFLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFFO1lBQzVELElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBQzNCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDSixJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRTdGLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUU3QyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUMxQixrRkFBa0Y7UUFDbEYsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRU8sZ0JBQWdCLENBQUMsU0FBc0I7UUFDOUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN4RSxJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDdkIsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksU0FBUyxDQUM1QztZQUNDLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUU7WUFDMUQsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztTQUMzRSxFQUNELEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUMxRCxJQUFJLENBQUMsa0JBQWtCLEVBQ3ZCLHNCQUFzQixFQUN0QixFQUFFLGNBQWMsRUFBRSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFLENBQ3JFLENBQUM7UUFDRixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNuQixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ2pDLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDckMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLE1BQU0sV0FBVyxHQUFHLENBQUMsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBQ2hELE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLENBQUM7UUFDcEQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUMxQyxFQUFFLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDNUIsR0FBRyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVPLDRCQUE0QixDQUFDLFNBQXNCO1FBQzFELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUMsY0FBYyxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDekgsTUFBTSxpQkFBaUIsR0FBd0I7WUFDOUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsRUFBRSxNQUFNLENBQUMsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFO1lBQ3pFLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ3pCLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLENBQUMsVUFBVSxFQUFFO2dCQUN0RixXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSxZQUFZLENBQUM7YUFDM0QsQ0FBQyxDQUFDO1NBQ0gsQ0FBQztRQUVGLE1BQU0sS0FBSyxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsV0FBVyxLQUFLLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQ3pGLEtBQUssTUFBTSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxXQUFXLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQztZQUM3QyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDN0QsSUFBSSxDQUFDO29CQUNKLGlCQUFpQixDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxXQUFXLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDeEcsQ0FBQzt3QkFBUyxDQUFDO29CQUNWLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDZixDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRTtnQkFDYixpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsV0FBVyxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFLHdCQUF3QixDQUFDLENBQUM7WUFDN0YsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsaUJBQWlCLEVBQUUsS0FBSyxHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsc0JBQXNCLEVBQUUsRUFBRSxTQUFTLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSxtQkFBbUIsQ0FBQyxFQUFFLGNBQWMsRUFBRSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzdTLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNsRCxJQUFJLENBQUMsQ0FBQyxLQUFLLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ25CLElBQUksQ0FBQywwQkFBMEIsR0FBRyxTQUFTLENBQUM7WUFDN0MsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLElBQUksQ0FBQywwQkFBMEIsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztZQUM1RCxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNKLElBQUksQ0FBQyx5QkFBeUIsR0FBRyxDQUFDLENBQUMsOEJBQThCLENBQUMsQ0FBQztRQUNuRSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLHlCQUF5QixFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxFQUFFO1lBQ3BHLE1BQU0sS0FBSyxHQUFHLElBQUkscUJBQXFCLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0MsSUFBSSxLQUFLLENBQUMsTUFBTSx3QkFBZ0IsRUFBRSxDQUFDO2dCQUNsQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25CLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUNwRCxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQzdELG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRTdDLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1FBRXRELE1BQU0sV0FBVyxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3BGLFdBQVcsQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDN0MsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvRCxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUM3QixDQUFDO0lBRU8sa0JBQWtCO1FBQ3pCLElBQUksSUFBSSxDQUFDLE9BQU8sa0NBQTBCLEVBQUUsQ0FBQztZQUM1QyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7WUFDbEMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7UUFDL0MsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7WUFDbkMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7WUFDN0MsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ3BCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ2xELElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3RDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNuQixDQUFDO0lBQ0YsQ0FBQztJQUVrQixTQUFTLENBQUMsYUFBcUIsRUFBRSxZQUFvQjtRQUN2RSxJQUFJLENBQUMsVUFBVSxHQUFHLGFBQWEsQ0FBQztRQUNoQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLFlBQVksR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQ3hFLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO0lBQzlCLENBQUM7SUFFa0IsUUFBUSxDQUFDLFlBQW9CO1FBQy9DLElBQUksT0FBTyxJQUFJLENBQUMsVUFBVSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ3pDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUMvQyxDQUFDO0lBQ0YsQ0FBQztJQUVPLHFCQUFxQixDQUFDLFNBQXNCO1FBQ25ELE1BQU0seUJBQXlCLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxJQUFJLGlCQUFpQixDQUM1RixDQUFDLCtCQUErQixFQUFFLElBQUksQ0FBQyxDQUN2QyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1FBRTFDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBQzNDLE1BQU0sdUJBQXVCLEdBQUcsZ0NBQWdDLEVBQUUsQ0FBQztRQUNuRSxJQUFJLENBQUMsS0FBSyxHQUFzQix5QkFBeUIsQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO1FBRXhJLDRCQUE0QixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzVFLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLFlBQVksSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxrQkFBa0IsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2pJLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDO1lBQzVCLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDO1FBQzNELENBQUM7UUFDRCxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMzQixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDcEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdEIsTUFBTSxjQUFjLEdBQUcsR0FBRyxFQUFFO1lBQzNCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDL0MsTUFBTSxXQUFXLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGFBQWEsRUFBRSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUMxRyxJQUFJLENBQUMsS0FBSyxDQUFDLG9CQUFvQixDQUFDLG1CQUFtQixFQUFFLGNBQWMsRUFBRSxXQUFXLENBQUMsQ0FBQztRQUNuRixDQUFDLENBQUM7UUFDRixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsRUFBRSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNqRixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsRUFBRSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUVoRixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxvQkFBb0IsRUFBRSxJQUFJLEVBQUUsRUFBRTtZQUM3SCxpQkFBaUIsRUFBRSxrQkFBa0I7WUFDckMsc0JBQXNCLEVBQUUsQ0FBQyxLQUFpQixFQUFFLFFBQWtCLEVBQUUsUUFBMkIsRUFBRSxLQUF3QixFQUEyQixFQUFFO2dCQUNqSixJQUFJLGtCQUEyQyxDQUFDO2dCQUNoRCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUMvQyxJQUFJLGVBQWUsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLDhCQUFzQixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sZ0NBQXdCLElBQUksNkJBQTZCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO29CQUNwSixrQkFBa0IsR0FBRyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsa0JBQWtCLEVBQUUsZUFBZSxFQUFFLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDLEVBQUUsSUFBSSxpQkFBaUIsQ0FBQyxTQUFTLEVBQUUsSUFBSSxHQUFHLEVBQXNCLENBQUMsR0FBRyxxQ0FBNEIsQ0FBQyxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUU7d0JBRXBSLElBQUksZUFBZSxHQUFHLENBQUMsQ0FBQzt3QkFDeEIsSUFBSSxJQUFJLENBQUMsT0FBTyw4QkFBc0IsRUFBRSxDQUFDOzRCQUN4QyxlQUFlLEdBQUcsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7d0JBQ3ZDLENBQUM7NkJBQU0sQ0FBQzs0QkFDUCx1SUFBdUk7NEJBQ3ZJLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUM7NEJBQy9DLE9BQU8sQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsR0FBRyxlQUFlLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxHQUFHLGVBQWUsQ0FBQyxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLEdBQUcsZUFBZSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUM7Z0NBQ3JLLGVBQWUsRUFBRSxDQUFDOzRCQUNuQixDQUFDO3dCQUNGLENBQUM7d0JBRUQsT0FBTzs0QkFDTixXQUFXLEVBQUUsV0FBVyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0NBQ3RDLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztnQ0FDeEYsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDOzRCQUNyQixDQUFDLENBQUM7eUJBQ0YsQ0FBQztvQkFDSCxDQUFDLENBQUMsQ0FBQztnQkFDSixDQUFDO3FCQUFNLENBQUM7b0JBQ1Asa0JBQWtCLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUMzRCxDQUFDO2dCQUVELE9BQU8sa0JBQWtCLENBQUM7WUFDM0IsQ0FBQztTQUNELENBQUMsQ0FBQyxDQUFDO1FBRUosSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7WUFDeEUsSUFBSSxDQUFDLENBQUMsb0JBQW9CLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsb0JBQW9CLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDO2dCQUM5RixJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDO2dCQUNyRCxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUM5QixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyxtQkFBbUI7UUFDMUIsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBaUIsUUFBUSxDQUFDLENBQUM7UUFDbkYsTUFBTSxPQUFPLEdBQUcsc0JBQXNCLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDbkUsT0FBTyxDQUFDLFFBQVEsR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDO1FBQ3pDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsWUFBWSxDQUFDLFVBQVUsQ0FBQztRQUM3QyxPQUFPLENBQUMsVUFBVSxHQUFHLFlBQVksQ0FBQyxVQUFVLENBQUM7UUFDN0MsT0FBTyxDQUFDLGFBQWEsR0FBRyxZQUFZLENBQUMsYUFBYSxDQUFDO1FBQ25ELE9BQU8sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUNyQyxPQUFPLE9BQU8sQ0FBQztJQUNoQixDQUFDO0lBRU8scUJBQXFCO1FBQzVCLElBQUksSUFBSSxDQUFDLFNBQVMsSUFBSSxPQUFPLElBQUksQ0FBQyxVQUFVLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDM0QsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLGtDQUF5QixDQUFDO1lBQ2pFLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDckQsTUFBTSxZQUFZLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLE9BQU8sR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDbEUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLFlBQVksR0FBRyxJQUFJLENBQUM7UUFDM0QsQ0FBQztJQUNGLENBQUM7SUFFRCxLQUFLLENBQUMsT0FBZ0I7UUFDckIsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNiLGlFQUFpRTtZQUVqRSxJQUFJLFNBQVMsR0FBdUIsU0FBUyxDQUFDO1lBQzlDLElBQUksWUFBWSxHQUF1QixTQUFTLENBQUM7WUFDakQsSUFBSSxVQUFVLEdBQXVCLFNBQVMsQ0FBQztZQUMvQyxJQUFJLFdBQVcsR0FBdUIsU0FBUyxDQUFDO1lBQ2hELElBQUksSUFBSSxHQUF1QixTQUFTLENBQUM7WUFDekMsSUFBSSxTQUFTLEdBQXVCLFNBQVMsQ0FBQztZQUU5QyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFFckIsSUFBSSxJQUFJLENBQUMsY0FBYyxJQUFJLElBQUksQ0FBQyxPQUFPLDhCQUFzQixFQUFFLENBQUM7Z0JBQy9ELFNBQVMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDO1lBQ2pDLENBQUM7WUFDRCxJQUFJLElBQUksQ0FBQyxhQUFhLElBQUksSUFBSSxDQUFDLE9BQU8sOEJBQXNCLEVBQUUsQ0FBQztnQkFDOUQsWUFBWSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUM7WUFDbkMsQ0FBQztZQUNELElBQUksSUFBSSxDQUFDLGVBQWUsSUFBSSxJQUFJLENBQUMsT0FBTyxnQ0FBd0IsRUFBRSxDQUFDO2dCQUNsRSxVQUFVLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQztZQUNuQyxDQUFDO1lBQ0QsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7Z0JBQ3hCLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQztnQkFDNUIsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDO1lBQ25DLENBQUM7WUFDRCxJQUFJLElBQUksQ0FBQyxPQUFPLGtDQUEwQixFQUFFLENBQUM7Z0JBQzVDLGlFQUFpRTtnQkFDakUsU0FBUyxHQUFHLFNBQVMsQ0FBQztnQkFDdEIsWUFBWSxHQUFHLFNBQVMsQ0FBQztnQkFDekIsVUFBVSxHQUFHLFNBQVMsQ0FBQztnQkFDdkIsV0FBVyxHQUFHLElBQUksQ0FBQywwQkFBMEIsRUFBRSxLQUFLLEVBQUUsQ0FBQztZQUN4RCxDQUFDO1lBRUQsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQ3JCLE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxFQUFpQyxDQUFDO2dCQUN0RCxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLEVBQUU7b0JBQ2pDLFNBQVM7b0JBQ1QsWUFBWTtvQkFDWixVQUFVO29CQUNWLFdBQVc7b0JBQ1gsSUFBSTtvQkFDSixTQUFTO2lCQUNULENBQUMsQ0FBQztnQkFDSCxJQUFJLENBQUMsWUFBWSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFDbEgsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ3JDLElBQUksS0FBSyxFQUFFLENBQUM7b0JBQ1gsSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDOzRCQUM1QyxVQUFVLEVBQUUsSUFBSSxDQUFDLFVBQVU7NEJBQzNCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTs0QkFDbkIsT0FBTyxFQUFFLElBQUk7NEJBQ2IsU0FBUzs0QkFDVCxZQUFZOzRCQUNaLFVBQVU7NEJBQ1YsV0FBVzs0QkFDWCxJQUFJOzRCQUNKLFNBQVM7eUJBQ1QsQ0FBQyxDQUFDLENBQUM7Z0JBQ0wsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2hCLENBQUM7SUFFTyxVQUFVO1FBQ2pCLElBQUksSUFBSSxDQUFDLE9BQU8sa0NBQTBCLEVBQUUsQ0FBQztZQUM1QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDbEMsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ3BCLENBQUM7SUFDRixDQUFDO0lBRVEsT0FBTztRQUNmLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNoQixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3JCLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzlCLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzFDLENBQUM7Q0FDRCxDQUFBO0FBamJZLGdCQUFnQjtJQW9CMUIsV0FBQSxtQkFBbUIsQ0FBQTtJQUNuQixXQUFBLGFBQWEsQ0FBQTtJQUNiLFdBQUEsYUFBYSxDQUFBO0lBQ2IsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLGFBQWEsQ0FBQTtJQUNiLFdBQUEsa0JBQWtCLENBQUE7SUFDbEIsWUFBQSxxQkFBcUIsQ0FBQTtJQUNyQixZQUFBLHdCQUF3QixDQUFBO0lBQ3hCLFlBQUEsa0JBQWtCLENBQUE7SUFDbEIsWUFBQSxhQUFhLENBQUE7SUFDYixZQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFlBQUEsYUFBYSxDQUFBO0dBL0JILGdCQUFnQixDQWliNUI7O0FBRUQsTUFBTSxpQ0FBa0MsU0FBUSxhQUFhO2FBQ3JELE9BQUUsR0FBRyxxQ0FBcUMsQ0FBQztJQUNsRDtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSxpQ0FBaUMsQ0FBQyxFQUFFO1lBQ3hDLFlBQVksRUFBRSxpQ0FBaUM7WUFDL0MsTUFBTSxFQUFFO2dCQUNQLE1BQU0sRUFBRSw0QkFBNEI7Z0JBQ3BDLE9BQU8sdUJBQWU7Z0JBQ3RCLE1BQU0sMENBQWdDO2FBQ3RDO1NBQ0QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELGdCQUFnQixDQUFDLFFBQTBCLEVBQUUsTUFBbUI7UUFDL0QsUUFBUSxDQUFDLEdBQUcsQ0FBQywrQkFBK0IsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMzRCxDQUFDOztBQUdGLE1BQU0sNEJBQTZCLFNBQVEsYUFBYTthQUNoRCxPQUFFLEdBQUcsdUJBQXVCLENBQUM7SUFDcEM7UUFDQyxLQUFLLENBQUM7WUFDTCxFQUFFLEVBQUUsNEJBQTRCLENBQUMsRUFBRTtZQUNuQyxZQUFZLEVBQUUsaUNBQWlDO1lBQy9DLE1BQU0sRUFBRTtnQkFDUCxNQUFNLEVBQUUsaUJBQWlCLENBQUMsY0FBYztnQkFDeEMsT0FBTyx3QkFBZ0I7Z0JBQ3ZCLFNBQVMsRUFBRSxDQUFDLGdEQUE2QixDQUFDO2dCQUMxQyxNQUFNLDBDQUFnQzthQUN0QztTQUNELENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxnQkFBZ0IsQ0FBQyxRQUEwQixFQUFFLE1BQW1CLEVBQUUsSUFBYTtRQUM5RSxNQUFNLGlCQUFpQixHQUFHLE1BQU0sQ0FBQyxlQUFlLENBQWdDLGlDQUFpQyxDQUFDLENBQUM7UUFDbkgsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO1lBQ3ZCLDZFQUE2RTtZQUM3RSxPQUFPLGlCQUFpQixDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDbEQsQ0FBQztRQUVELFFBQVEsQ0FBQyxHQUFHLENBQUMsK0JBQStCLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDNUQsQ0FBQzs7QUFHRixxQkFBcUIsQ0FBQyxJQUFJLGlDQUFpQyxFQUFFLENBQUMsQ0FBQztBQUMvRCxxQkFBcUIsQ0FBQyxJQUFJLDRCQUE0QixFQUFFLENBQUMsQ0FBQyJ9