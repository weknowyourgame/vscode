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
var TerminalSuggestContribution_1, TerminalSuggestProvidersConfigurationManager_1;
import * as dom from '../../../../../base/browser/dom.js';
import { Event } from '../../../../../base/common/event.js';
import { DisposableStore, MutableDisposable, toDisposable, Disposable, DisposableMap } from '../../../../../base/common/lifecycle.js';
import { isWindows } from '../../../../../base/common/platform.js';
import { localize2 } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { TerminalLocation } from '../../../../../platform/terminal/common/terminal.js';
import { registerActiveInstanceAction, registerTerminalAction } from '../../../terminal/browser/terminalActions.js';
import { registerTerminalContribution } from '../../../terminal/browser/terminalExtensions.js';
import { TerminalContextKeys } from '../../../terminal/common/terminalContextKey.js';
import { terminalSuggestConfigSection, registerTerminalSuggestProvidersConfiguration } from '../common/terminalSuggestConfiguration.js';
import { ITerminalCompletionService, TerminalCompletionService } from './terminalCompletionService.js';
import { ITerminalContributionService } from '../../../terminal/common/terminalExtensionPoints.js';
import { registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { SuggestAddon } from './terminalSuggestAddon.js';
import { TerminalClipboardContribution } from '../../clipboard/browser/terminal.clipboard.contribution.js';
import { SimpleSuggestContext } from '../../../../services/suggest/browser/simpleSuggestWidget.js';
import { SuggestDetailsClassName } from '../../../../services/suggest/browser/simpleSuggestWidgetDetails.js';
import { EditorContextKeys } from '../../../../../editor/common/editorContextKeys.js';
import { MenuId } from '../../../../../platform/actions/common/actions.js';
import { IPreferencesService } from '../../../../services/preferences/common/preferences.js';
import './terminalSymbolIcons.js';
import { LspCompletionProviderAddon } from './lspCompletionProviderAddon.js';
import { createTerminalLanguageVirtualUri, LspTerminalModelContentProvider } from './lspTerminalModelContentProvider.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { ILanguageFeaturesService } from '../../../../../editor/common/services/languageFeatures.js';
import { getTerminalLspSupportedLanguageObj } from './lspTerminalUtil.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
registerSingleton(ITerminalCompletionService, TerminalCompletionService, 1 /* InstantiationType.Delayed */);
// #region Terminal Contributions
let TerminalSuggestContribution = class TerminalSuggestContribution extends DisposableStore {
    static { TerminalSuggestContribution_1 = this; }
    static { this.ID = 'terminal.suggest'; }
    static get(instance) {
        return instance.getContribution(TerminalSuggestContribution_1.ID);
    }
    get addon() { return this._addon.value; }
    get lspAddons() { return Array.from(this._lspAddons.values()); }
    constructor(_ctx, _contextKeyService, _configurationService, _instantiationService, _terminalCompletionService, _textModelService, _languageFeaturesService) {
        super();
        this._ctx = _ctx;
        this._contextKeyService = _contextKeyService;
        this._configurationService = _configurationService;
        this._instantiationService = _instantiationService;
        this._terminalCompletionService = _terminalCompletionService;
        this._textModelService = _textModelService;
        this._languageFeaturesService = _languageFeaturesService;
        this._addon = new MutableDisposable();
        this._lspAddons = this.add(new DisposableMap());
        this._lspModelProvider = new MutableDisposable();
        this.add(toDisposable(() => {
            this._addon?.dispose();
            this._lspModelProvider?.value?.dispose();
            this._lspModelProvider?.dispose();
        }));
        this._terminalSuggestWidgetVisibleContextKey = TerminalContextKeys.suggestWidgetVisible.bindTo(this._contextKeyService);
        this.add(this._configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("terminal.integrated.suggest.enabled" /* TerminalSuggestSettingId.Enabled */)) {
                const completionsEnabled = this._configurationService.getValue(terminalSuggestConfigSection).enabled;
                if (!completionsEnabled) {
                    this._addon.clear();
                    this._lspAddons.clearAndDisposeAll();
                }
                const xtermRaw = this._ctx.instance.xterm?.raw;
                if (!!xtermRaw && completionsEnabled) {
                    this._loadAddons(xtermRaw);
                }
            }
        }));
        // Initialize the dynamic providers configuration manager
        TerminalSuggestProvidersConfigurationManager.initialize(this._instantiationService);
        // Listen for terminal location changes to update the suggest widget container
        this.add(this._ctx.instance.onDidChangeTarget((target) => {
            this._updateContainerForTarget(target);
        }));
    }
    xtermOpen(xterm) {
        const config = this._configurationService.getValue(terminalSuggestConfigSection);
        const enabled = config.enabled;
        if (!enabled) {
            return;
        }
        this._loadAddons(xterm.raw);
        this.add(Event.runAndSubscribe(this._ctx.instance.onDidChangeShellType, async () => {
            this._refreshAddons();
            this._lspModelProvider.value?.shellTypeChanged(this._ctx.instance.shellType);
        }));
    }
    async _loadLspCompletionAddon(xterm) {
        let lspTerminalObj = undefined;
        if (!this._ctx.instance.shellType || !(lspTerminalObj = getTerminalLspSupportedLanguageObj(this._ctx.instance.shellType))) {
            this._lspAddons.clearAndDisposeAll();
            return;
        }
        const virtualTerminalDocumentUri = createTerminalLanguageVirtualUri(this._ctx.instance.instanceId, lspTerminalObj.extension);
        // Load and register the LSP completion providers (one per language server)
        this._lspModelProvider.value = this._instantiationService.createInstance(LspTerminalModelContentProvider, this._ctx.instance.capabilities, this._ctx.instance.instanceId, virtualTerminalDocumentUri, this._ctx.instance.shellType);
        this.add(this._lspModelProvider.value);
        const textVirtualModel = await this._textModelService.createModelReference(virtualTerminalDocumentUri);
        this.add(textVirtualModel);
        const virtualProviders = this._languageFeaturesService.completionProvider.all(textVirtualModel.object.textEditorModel);
        const filteredProviders = virtualProviders.filter(p => p._debugDisplayName !== 'wordbasedCompletions');
        // Iterate through all available providers
        for (const provider of filteredProviders) {
            const lspCompletionProviderAddon = this._instantiationService.createInstance(LspCompletionProviderAddon, provider, textVirtualModel, this._lspModelProvider.value);
            this._lspAddons.set(provider._debugDisplayName, lspCompletionProviderAddon);
            xterm.loadAddon(lspCompletionProviderAddon);
            this.add(this._terminalCompletionService.registerTerminalCompletionProvider('lsp', lspCompletionProviderAddon.id, lspCompletionProviderAddon, ...(lspCompletionProviderAddon.triggerCharacters ?? [])));
        }
    }
    _loadAddons(xterm) {
        // Don't re-create the addon
        if (this._addon.value) {
            return;
        }
        const addon = this._addon.value = this._instantiationService.createInstance(SuggestAddon, this._ctx.instance.sessionId, this._ctx.instance.shellType, this._ctx.instance.capabilities, this._terminalSuggestWidgetVisibleContextKey);
        xterm.loadAddon(addon);
        this._loadLspCompletionAddon(xterm);
        let container = null;
        if (this._ctx.instance.target === TerminalLocation.Editor) {
            container = xterm.element;
        }
        else {
            container = dom.findParentWithClass(xterm.element, 'panel');
            if (!container) {
                // Fallback for sidebar or unknown location
                container = xterm.element;
            }
        }
        addon.setContainerWithOverflow(container);
        // eslint-disable-next-line no-restricted-syntax
        addon.setScreen(xterm.element.querySelector('.xterm-screen'));
        this.add(dom.addDisposableListener(this._ctx.instance.domElement, dom.EventType.FOCUS_OUT, (e) => {
            const focusedElement = e.relatedTarget;
            if (focusedElement?.classList.contains(SuggestDetailsClassName)) {
                // Don't hide the suggest widget if the focus is moving to the details
                return;
            }
            addon.hideSuggestWidget(true);
        }));
        this.add(addon.onAcceptedCompletion(async (text) => {
            this._ctx.instance.focus();
            this._ctx.instance.sendText(text, false);
        }));
        const clipboardContrib = TerminalClipboardContribution.get(this._ctx.instance);
        this.add(clipboardContrib.onWillPaste(() => addon.isPasting = true));
        this.add(clipboardContrib.onDidPaste(() => {
            // Delay this slightly as synchronizing the prompt input is debounced
            setTimeout(() => addon.isPasting = false, 100);
        }));
        if (!isWindows) {
            let barrier;
            this.add(addon.onDidReceiveCompletions(() => {
                barrier?.open();
                barrier = undefined;
            }));
        }
    }
    _refreshAddons() {
        const addon = this._addon.value;
        if (!addon) {
            return;
        }
        addon.shellType = this._ctx.instance.shellType;
        if (!this._ctx.instance.xterm?.raw) {
            return;
        }
        // Relies on shell type being set
        this._loadLspCompletionAddon(this._ctx.instance.xterm.raw);
    }
    _updateContainerForTarget(target) {
        const addon = this._addon.value;
        if (!addon || !this._ctx.instance.xterm?.raw) {
            return;
        }
        const xtermElement = this._ctx.instance.xterm.raw.element;
        if (!xtermElement) {
            return;
        }
        // Update the container based on the new target location
        if (target === TerminalLocation.Editor) {
            addon.setContainerWithOverflow(xtermElement);
        }
        else {
            const panelContainer = dom.findParentWithClass(xtermElement, 'panel');
            if (panelContainer) {
                addon.setContainerWithOverflow(panelContainer);
            }
        }
    }
};
TerminalSuggestContribution = TerminalSuggestContribution_1 = __decorate([
    __param(1, IContextKeyService),
    __param(2, IConfigurationService),
    __param(3, IInstantiationService),
    __param(4, ITerminalCompletionService),
    __param(5, ITextModelService),
    __param(6, ILanguageFeaturesService)
], TerminalSuggestContribution);
registerTerminalContribution(TerminalSuggestContribution.ID, TerminalSuggestContribution);
// #endregion
// #region Actions
registerTerminalAction({
    id: "workbench.action.terminal.configureSuggestSettings" /* TerminalSuggestCommandId.ConfigureSettings */,
    title: localize2('workbench.action.terminal.configureSuggestSettings', 'Configure'),
    f1: false,
    precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
    keybinding: {
        primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 87 /* KeyCode.Comma */,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */
    },
    menu: {
        id: MenuId.MenubarTerminalSuggestStatusMenu,
        group: 'right',
        order: 1
    },
    run: (c, accessor) => accessor.get(IPreferencesService).openSettings({ query: terminalSuggestConfigSection })
});
registerTerminalAction({
    id: "workbench.action.terminal.suggestLearnMore" /* TerminalSuggestCommandId.LearnMore */,
    title: localize2('workbench.action.terminal.learnMore', 'Learn More'),
    f1: false,
    precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
    menu: {
        id: MenuId.MenubarTerminalSuggestStatusMenu,
        group: 'center',
        order: 1
    },
    keybinding: {
        primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 42 /* KeyCode.KeyL */,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
        when: TerminalContextKeys.suggestWidgetVisible
    },
    run: (c, accessor) => {
        (accessor.get(IOpenerService)).open('https://aka.ms/vscode-terminal-intellisense');
    }
});
registerActiveInstanceAction({
    id: "workbench.action.terminal.triggerSuggest" /* TerminalSuggestCommandId.TriggerSuggest */,
    title: localize2('workbench.action.terminal.triggerSuggest', 'Trigger Suggest'),
    f1: false,
    keybinding: {
        primary: 2048 /* KeyMod.CtrlCmd */ | 10 /* KeyCode.Space */,
        mac: { primary: 256 /* KeyMod.WinCtrl */ | 10 /* KeyCode.Space */ },
        weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
        when: ContextKeyExpr.and(TerminalContextKeys.focus, TerminalContextKeys.suggestWidgetVisible.negate(), ContextKeyExpr.equals(`config.${"terminal.integrated.suggest.enabled" /* TerminalSuggestSettingId.Enabled */}`, true))
    },
    run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.requestCompletions(true)
});
registerActiveInstanceAction({
    id: "workbench.action.terminal.resetSuggestWidgetSize" /* TerminalSuggestCommandId.ResetWidgetSize */,
    title: localize2('workbench.action.terminal.resetSuggestWidgetSize', 'Reset Suggest Widget Size'),
    run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.resetWidgetSize()
});
registerActiveInstanceAction({
    id: "workbench.action.terminal.selectPrevSuggestion" /* TerminalSuggestCommandId.SelectPrevSuggestion */,
    title: localize2('workbench.action.terminal.selectPrevSuggestion', 'Select the Previous Suggestion'),
    f1: false,
    precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
    keybinding: {
        // Up is bound to other workbench keybindings that this needs to beat
        primary: 16 /* KeyCode.UpArrow */,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
        when: ContextKeyExpr.or(SimpleSuggestContext.HasNavigated, ContextKeyExpr.equals(`config.${"terminal.integrated.suggest.upArrowNavigatesHistory" /* TerminalSuggestSettingId.UpArrowNavigatesHistory */}`, false))
    },
    run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectPreviousSuggestion()
});
registerActiveInstanceAction({
    id: "workbench.action.terminal.selectPrevPageSuggestion" /* TerminalSuggestCommandId.SelectPrevPageSuggestion */,
    title: localize2('workbench.action.terminal.selectPrevPageSuggestion', 'Select the Previous Page Suggestion'),
    f1: false,
    precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
    keybinding: {
        // Up is bound to other workbench keybindings that this needs to beat
        primary: 11 /* KeyCode.PageUp */,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1
    },
    run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectPreviousPageSuggestion()
});
registerActiveInstanceAction({
    id: "workbench.action.terminal.selectNextSuggestion" /* TerminalSuggestCommandId.SelectNextSuggestion */,
    title: localize2('workbench.action.terminal.selectNextSuggestion', 'Select the Next Suggestion'),
    f1: false,
    precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
    keybinding: {
        // Down is bound to other workbench keybindings that this needs to beat
        primary: 18 /* KeyCode.DownArrow */,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1
    },
    run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectNextSuggestion()
});
registerActiveInstanceAction({
    id: 'terminalSuggestToggleExplainMode',
    title: localize2('workbench.action.terminal.suggestToggleExplainMode', 'Suggest Toggle Explain Modes'),
    f1: false,
    precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
    keybinding: {
        // Down is bound to other workbench keybindings that this needs to beat
        weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
        primary: 2048 /* KeyMod.CtrlCmd */ | 90 /* KeyCode.Slash */,
    },
    run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.toggleExplainMode()
});
registerActiveInstanceAction({
    id: "workbench.action.terminal.suggestToggleDetailsFocus" /* TerminalSuggestCommandId.ToggleDetailsFocus */,
    title: localize2('workbench.action.terminal.suggestToggleDetailsFocus', 'Suggest Toggle Suggestion Focus'),
    f1: false,
    // HACK: This does not work with a precondition of `TerminalContextKeys.suggestWidgetVisible`, so make sure to not override the editor's keybinding
    precondition: EditorContextKeys.textInputFocus.negate(),
    keybinding: {
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 10 /* KeyCode.Space */,
        mac: { primary: 256 /* KeyMod.WinCtrl */ | 512 /* KeyMod.Alt */ | 10 /* KeyCode.Space */ }
    },
    run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.toggleSuggestionFocus()
});
registerActiveInstanceAction({
    id: "workbench.action.terminal.suggestToggleDetails" /* TerminalSuggestCommandId.ToggleDetails */,
    title: localize2('workbench.action.terminal.suggestToggleDetails', 'Suggest Toggle Details'),
    f1: false,
    precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.isOpen, TerminalContextKeys.focus, TerminalContextKeys.suggestWidgetVisible, SimpleSuggestContext.HasFocusedSuggestion),
    keybinding: {
        // HACK: Force weight to be higher than that to start terminal chat
        weight: 400 /* KeybindingWeight.ExternalExtension */ + 2,
        primary: 2048 /* KeyMod.CtrlCmd */ | 10 /* KeyCode.Space */,
        secondary: [2048 /* KeyMod.CtrlCmd */ | 39 /* KeyCode.KeyI */],
        mac: { primary: 256 /* KeyMod.WinCtrl */ | 10 /* KeyCode.Space */, secondary: [2048 /* KeyMod.CtrlCmd */ | 39 /* KeyCode.KeyI */] }
    },
    run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.toggleSuggestionDetails()
});
registerActiveInstanceAction({
    id: "workbench.action.terminal.selectNextPageSuggestion" /* TerminalSuggestCommandId.SelectNextPageSuggestion */,
    title: localize2('workbench.action.terminal.selectNextPageSuggestion', 'Select the Next Page Suggestion'),
    f1: false,
    precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
    keybinding: {
        // Down is bound to other workbench keybindings that this needs to beat
        primary: 12 /* KeyCode.PageDown */,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1
    },
    run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.selectNextPageSuggestion()
});
registerActiveInstanceAction({
    id: "workbench.action.terminal.acceptSelectedSuggestion" /* TerminalSuggestCommandId.AcceptSelectedSuggestion */,
    title: localize2('workbench.action.terminal.acceptSelectedSuggestion', 'Insert'),
    f1: false,
    precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
    keybinding: [{
            primary: 2 /* KeyCode.Tab */,
            // Tab is bound to other workbench keybindings that this needs to beat
            weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 2,
            when: ContextKeyExpr.and(SimpleSuggestContext.HasFocusedSuggestion)
        },
        {
            primary: 3 /* KeyCode.Enter */,
            when: ContextKeyExpr.and(SimpleSuggestContext.HasFocusedSuggestion, ContextKeyExpr.or(ContextKeyExpr.notEquals(`config.${"terminal.integrated.suggest.selectionMode" /* TerminalSuggestSettingId.SelectionMode */}`, 'partial'), ContextKeyExpr.or(SimpleSuggestContext.FirstSuggestionFocused.toNegated(), SimpleSuggestContext.HasNavigated))),
            weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1
        }],
    menu: {
        id: MenuId.MenubarTerminalSuggestStatusMenu,
        order: 1,
        group: 'left'
    },
    run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.acceptSelectedSuggestion()
});
registerActiveInstanceAction({
    id: "workbench.action.terminal.acceptSelectedSuggestionEnter" /* TerminalSuggestCommandId.AcceptSelectedSuggestionEnter */,
    title: localize2('workbench.action.terminal.acceptSelectedSuggestionEnter', 'Accept Selected Suggestion (Enter)'),
    f1: false,
    precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
    keybinding: {
        primary: 3 /* KeyCode.Enter */,
        // Enter is bound to other workbench keybindings that this needs to beat
        weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
        when: ContextKeyExpr.notEquals(`config.${"terminal.integrated.suggest.runOnEnter" /* TerminalSuggestSettingId.RunOnEnter */}`, 'never'),
    },
    run: async (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.acceptSelectedSuggestion(undefined, true)
});
registerActiveInstanceAction({
    id: "workbench.action.terminal.hideSuggestWidget" /* TerminalSuggestCommandId.HideSuggestWidget */,
    title: localize2('workbench.action.terminal.hideSuggestWidget', 'Hide Suggest Widget'),
    f1: false,
    precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
    keybinding: {
        primary: 9 /* KeyCode.Escape */,
        // Escape is bound to other workbench keybindings that this needs to beat
        weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1
    },
    run: (activeInstance) => TerminalSuggestContribution.get(activeInstance)?.addon?.hideSuggestWidget(true)
});
registerActiveInstanceAction({
    id: "workbench.action.terminal.hideSuggestWidgetAndNavigateHistory" /* TerminalSuggestCommandId.HideSuggestWidgetAndNavigateHistory */,
    title: localize2('workbench.action.terminal.hideSuggestWidgetAndNavigateHistory', 'Hide Suggest Widget and Navigate History'),
    f1: false,
    precondition: ContextKeyExpr.and(ContextKeyExpr.or(TerminalContextKeys.processSupported, TerminalContextKeys.terminalHasBeenCreated), TerminalContextKeys.focus, TerminalContextKeys.isOpen, TerminalContextKeys.suggestWidgetVisible),
    keybinding: {
        primary: 16 /* KeyCode.UpArrow */,
        when: ContextKeyExpr.and(SimpleSuggestContext.HasNavigated.negate(), ContextKeyExpr.equals(`config.${"terminal.integrated.suggest.upArrowNavigatesHistory" /* TerminalSuggestSettingId.UpArrowNavigatesHistory */}`, true)),
        weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 2
    },
    run: (activeInstance) => {
        TerminalSuggestContribution.get(activeInstance)?.addon?.hideSuggestWidget(true);
        activeInstance.sendText('\u001b[A', false); // Up arrow
    }
});
// #endregion
// #region Dynamic Providers Configuration
let TerminalSuggestProvidersConfigurationManager = class TerminalSuggestProvidersConfigurationManager extends Disposable {
    static { TerminalSuggestProvidersConfigurationManager_1 = this; }
    static initialize(instantiationService) {
        if (!this._instance) {
            this._instance = instantiationService.createInstance(TerminalSuggestProvidersConfigurationManager_1);
        }
    }
    constructor(_terminalCompletionService, _terminalContributionService) {
        super();
        this._terminalCompletionService = _terminalCompletionService;
        this._terminalContributionService = _terminalContributionService;
        this._register(this._terminalCompletionService.onDidChangeProviders(() => {
            this._updateConfiguration();
        }));
        this._register(this._terminalContributionService.onDidChangeTerminalCompletionProviders(() => {
            this._updateConfiguration();
        }));
        // Initial configuration
        this._updateConfiguration();
    }
    _updateConfiguration() {
        // Add statically declared providers from package.json contributions
        const providers = new Map();
        this._terminalContributionService.terminalCompletionProviders.forEach(o => providers.set(o.extensionIdentifier, { ...o, id: o.extensionIdentifier }));
        // Add dynamically registered providers (that aren't already declared statically)
        for (const { id } of this._terminalCompletionService.providers) {
            if (id && !providers.has(id)) {
                providers.set(id, { id });
            }
        }
        registerTerminalSuggestProvidersConfiguration(providers);
    }
};
TerminalSuggestProvidersConfigurationManager = TerminalSuggestProvidersConfigurationManager_1 = __decorate([
    __param(0, ITerminalCompletionService),
    __param(1, ITerminalContributionService)
], TerminalSuggestProvidersConfigurationManager);
// #endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWwuc3VnZ2VzdC5jb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL3N1Z2dlc3QvYnJvd3Nlci90ZXJtaW5hbC5zdWdnZXN0LmNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQ0FBb0MsQ0FBQztBQUUxRCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFNUQsT0FBTyxFQUFFLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3RJLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDbEQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGNBQWMsRUFBZSxrQkFBa0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzFILE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBRXRHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBRXZGLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3BILE9BQU8sRUFBRSw0QkFBNEIsRUFBcUMsTUFBTSxpREFBaUQsQ0FBQztBQUNsSSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUVyRixPQUFPLEVBQUUsNEJBQTRCLEVBQWdFLDZDQUE2QyxFQUFxQyxNQUFNLDJDQUEyQyxDQUFDO0FB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