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
import './media/chatStatus.css';
import { safeIntl } from '../../../../base/common/date.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { language } from '../../../../base/common/platform.js';
import { localize } from '../../../../nls.js';
import { IStatusbarService, ShowTooltipCommand } from '../../../services/statusbar/browser/statusbar.js';
import { $, addDisposableListener, append, clearNode, disposableWindowInterval, EventHelper, EventType, getWindow } from '../../../../base/browser/dom.js';
import { ChatEntitlement, IChatEntitlementService, isProUser } from '../../../services/chat/common/chatEntitlementService.js';
import { defaultButtonStyles, defaultCheckboxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { Checkbox } from '../../../../base/browser/ui/toggle/toggle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { contrastBorder, inputValidationErrorBorder, inputValidationInfoBorder, inputValidationWarningBorder, registerColor, transparent } from '../../../../platform/theme/common/colorRegistry.js';
import { IHoverService, nativeHoverDelegate } from '../../../../platform/hover/browser/hover.js';
import { Color } from '../../../../base/common/color.js';
import { Gesture, EventType as TouchEventType } from '../../../../base/browser/touch.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import product from '../../../../platform/product/common/product.js';
import { isObject } from '../../../../base/common/types.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { renderLabelWithIcons } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { toAction } from '../../../../base/common/actions.js';
import { parseLinkedText } from '../../../../base/common/linkedText.js';
import { Link } from '../../../../platform/opener/browser/link.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IChatStatusItemService } from './chatStatusItemService.js';
import { ITextResourceConfigurationService } from '../../../../editor/common/services/textResourceConfiguration.js';
import { EditorResourceAccessor, SideBySideEditor } from '../../../common/editor.js';
import { getCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { URI } from '../../../../base/common/uri.js';
import { IInlineCompletionsService } from '../../../../editor/browser/services/inlineCompletionsService.js';
import { IChatSessionsService } from '../common/chatSessionsService.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { LEGACY_AGENT_SESSIONS_VIEW_ID } from '../common/constants.js';
import { AGENT_SESSIONS_VIEW_ID } from './agentSessions/agentSessions.js';
const gaugeForeground = registerColor('gauge.foreground', {
    dark: inputValidationInfoBorder,
    light: inputValidationInfoBorder,
    hcDark: contrastBorder,
    hcLight: contrastBorder
}, localize('gaugeForeground', "Gauge foreground color."));
registerColor('gauge.background', {
    dark: transparent(gaugeForeground, 0.3),
    light: transparent(gaugeForeground, 0.3),
    hcDark: Color.white,
    hcLight: Color.white
}, localize('gaugeBackground', "Gauge background color."));
registerColor('gauge.border', {
    dark: null,
    light: null,
    hcDark: contrastBorder,
    hcLight: contrastBorder
}, localize('gaugeBorder', "Gauge border color."));
const gaugeWarningForeground = registerColor('gauge.warningForeground', {
    dark: inputValidationWarningBorder,
    light: inputValidationWarningBorder,
    hcDark: contrastBorder,
    hcLight: contrastBorder
}, localize('gaugeWarningForeground', "Gauge warning foreground color."));
registerColor('gauge.warningBackground', {
    dark: transparent(gaugeWarningForeground, 0.3),
    light: transparent(gaugeWarningForeground, 0.3),
    hcDark: Color.white,
    hcLight: Color.white
}, localize('gaugeWarningBackground', "Gauge warning background color."));
const gaugeErrorForeground = registerColor('gauge.errorForeground', {
    dark: inputValidationErrorBorder,
    light: inputValidationErrorBorder,
    hcDark: contrastBorder,
    hcLight: contrastBorder
}, localize('gaugeErrorForeground', "Gauge error foreground color."));
registerColor('gauge.errorBackground', {
    dark: transparent(gaugeErrorForeground, 0.3),
    light: transparent(gaugeErrorForeground, 0.3),
    hcDark: Color.white,
    hcLight: Color.white
}, localize('gaugeErrorBackground', "Gauge error background color."));
//#endregion
const defaultChat = {
    completionsEnablementSetting: product.defaultChatAgent?.completionsEnablementSetting ?? '',
    nextEditSuggestionsSetting: product.defaultChatAgent?.nextEditSuggestionsSetting ?? '',
    manageSettingsUrl: product.defaultChatAgent?.manageSettingsUrl ?? '',
    manageOverageUrl: product.defaultChatAgent?.manageOverageUrl ?? '',
    provider: product.defaultChatAgent?.provider ?? { default: { id: '', name: '' }, enterprise: { id: '', name: '' }, apple: { id: '', name: '' }, google: { id: '', name: '' } },
    termsStatementUrl: product.defaultChatAgent?.termsStatementUrl ?? '',
    privacyStatementUrl: product.defaultChatAgent?.privacyStatementUrl ?? ''
};
let ChatStatusBarEntry = class ChatStatusBarEntry extends Disposable {
    static { this.ID = 'workbench.contrib.chatStatusBarEntry'; }
    constructor(chatEntitlementService, instantiationService, statusbarService, editorService, configurationService, completionsService, chatSessionsService) {
        super();
        this.chatEntitlementService = chatEntitlementService;
        this.instantiationService = instantiationService;
        this.statusbarService = statusbarService;
        this.editorService = editorService;
        this.configurationService = configurationService;
        this.completionsService = completionsService;
        this.chatSessionsService = chatSessionsService;
        this.entry = undefined;
        this.dashboard = new Lazy(() => this.instantiationService.createInstance(ChatStatusDashboard));
        this.activeCodeEditorListener = this._register(new MutableDisposable());
        this.update();
        this.registerListeners();
    }
    update() {
        const sentiment = this.chatEntitlementService.sentiment;
        if (!sentiment.hidden) {
            const props = this.getEntryProps();
            if (this.entry) {
                this.entry.update(props);
            }
            else {
                this.entry = this.statusbarService.addEntry(props, 'chat.statusBarEntry', 1 /* StatusbarAlignment.RIGHT */, { location: { id: 'status.editor.mode', priority: 100.1 }, alignment: 1 /* StatusbarAlignment.RIGHT */ });
            }
        }
        else {
            this.entry?.dispose();
            this.entry = undefined;
        }
    }
    registerListeners() {
        this._register(this.chatEntitlementService.onDidChangeQuotaExceeded(() => this.update()));
        this._register(this.chatEntitlementService.onDidChangeSentiment(() => this.update()));
        this._register(this.chatEntitlementService.onDidChangeEntitlement(() => this.update()));
        this._register(this.completionsService.onDidChangeIsSnoozing(() => this.update()));
        this._register(this.chatSessionsService.onDidChangeInProgress(() => this.update()));
        this._register(this.editorService.onDidActiveEditorChange(() => this.onDidActiveEditorChange()));
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(defaultChat.completionsEnablementSetting)) {
                this.update();
            }
        }));
    }
    onDidActiveEditorChange() {
        this.update();
        this.activeCodeEditorListener.clear();
        // Listen to language changes in the active code editor
        const activeCodeEditor = getCodeEditor(this.editorService.activeTextEditorControl);
        if (activeCodeEditor) {
            this.activeCodeEditorListener.value = activeCodeEditor.onDidChangeModelLanguage(() => {
                this.update();
            });
        }
    }
    getEntryProps() {
        let text = '$(copilot)';
        let ariaLabel = localize('chatStatusAria', "Copilot status");
        let kind;
        if (isNewUser(this.chatEntitlementService)) {
            const entitlement = this.chatEntitlementService.entitlement;
            // Finish Setup
            if (this.chatEntitlementService.sentiment.later || // user skipped setup
                entitlement === ChatEntitlement.Available || // user is entitled
                isProUser(entitlement) || // user is already pro
                entitlement === ChatEntitlement.Free // user is already free
            ) {
                const finishSetup = localize('finishSetup', "Finish Setup");
                text = `$(copilot) ${finishSetup}`;
                ariaLabel = finishSetup;
                kind = 'prominent';
            }
        }
        else {
            const chatQuotaExceeded = this.chatEntitlementService.quotas.chat?.percentRemaining === 0;
            const completionsQuotaExceeded = this.chatEntitlementService.quotas.completions?.percentRemaining === 0;
            const chatSessionsInProgressCount = this.chatSessionsService.getInProgress().reduce((total, item) => total + item.count, 0);
            // Disabled
            if (this.chatEntitlementService.sentiment.disabled || this.chatEntitlementService.sentiment.untrusted) {
                text = '$(copilot-unavailable)';
                ariaLabel = localize('copilotDisabledStatus', "Copilot disabled");
            }
            // Sessions in progress
            else if (chatSessionsInProgressCount > 0) {
                text = '$(copilot-in-progress)';
                if (chatSessionsInProgressCount > 1) {
                    ariaLabel = localize('chatSessionsInProgressStatus', "{0} agent sessions in progress", chatSessionsInProgressCount);
                }
                else {
                    ariaLabel = localize('chatSessionInProgressStatus', "1 agent session in progress");
                }
            }
            // Signed out
            else if (this.chatEntitlementService.entitlement === ChatEntitlement.Unknown) {
                const signedOutWarning = localize('notSignedIn', "Signed out");
                text = `${this.chatEntitlementService.anonymous ? '$(copilot)' : '$(copilot-not-connected)'} ${signedOutWarning}`;
                ariaLabel = signedOutWarning;
                kind = 'prominent';
            }
            // Free Quota Exceeded
            else if (this.chatEntitlementService.entitlement === ChatEntitlement.Free && (chatQuotaExceeded || completionsQuotaExceeded)) {
                let quotaWarning;
                if (chatQuotaExceeded && !completionsQuotaExceeded) {
                    quotaWarning = localize('chatQuotaExceededStatus', "Chat quota reached");
                }
                else if (completionsQuotaExceeded && !chatQuotaExceeded) {
                    quotaWarning = localize('completionsQuotaExceededStatus', "Inline suggestions quota reached");
                }
                else {
                    quotaWarning = localize('chatAndCompletionsQuotaExceededStatus', "Quota reached");
                }
                text = `$(copilot-warning) ${quotaWarning}`;
                ariaLabel = quotaWarning;
                kind = 'prominent';
            }
            // Completions Disabled
            else if (this.editorService.activeTextEditorLanguageId && !isCompletionsEnabled(this.configurationService, this.editorService.activeTextEditorLanguageId)) {
                text = '$(copilot-unavailable)';
                ariaLabel = localize('completionsDisabledStatus', "Inline suggestions disabled");
            }
            // Completions Snoozed
            else if (this.completionsService.isSnoozing()) {
                text = '$(copilot-snooze)';
                ariaLabel = localize('completionsSnoozedStatus', "Inline suggestions snoozed");
            }
        }
        const baseResult = {
            name: localize('chatStatus', "Copilot Status"),
            text,
            ariaLabel,
            command: ShowTooltipCommand,
            showInAllWindows: true,
            kind,
            tooltip: { element: (token) => this.dashboard.value.show(token) }
        };
        return baseResult;
    }
    dispose() {
        super.dispose();
        this.entry?.dispose();
        this.entry = undefined;
    }
};
ChatStatusBarEntry = __decorate([
    __param(0, IChatEntitlementService),
    __param(1, IInstantiationService),
    __param(2, IStatusbarService),
    __param(3, IEditorService),
    __param(4, IConfigurationService),
    __param(5, IInlineCompletionsService),
    __param(6, IChatSessionsService)
], ChatStatusBarEntry);
export { ChatStatusBarEntry };
function isNewUser(chatEntitlementService) {
    return !chatEntitlementService.sentiment.installed || // chat not installed
        chatEntitlementService.entitlement === ChatEntitlement.Available; // not yet signed up to chat
}
function canUseChat(chatEntitlementService) {
    if (!chatEntitlementService.sentiment.installed || chatEntitlementService.sentiment.disabled || chatEntitlementService.sentiment.untrusted) {
        return false; // chat not installed or not enabled
    }
    if (chatEntitlementService.entitlement === ChatEntitlement.Unknown || chatEntitlementService.entitlement === ChatEntitlement.Available) {
        return chatEntitlementService.anonymous; // signed out or not-yet-signed-up users can only use Chat if anonymous access is allowed
    }
    if (chatEntitlementService.entitlement === ChatEntitlement.Free && chatEntitlementService.quotas.chat?.percentRemaining === 0 && chatEntitlementService.quotas.completions?.percentRemaining === 0) {
        return false; // free user with no quota left
    }
    return true;
}
function isCompletionsEnabled(configurationService, modeId = '*') {
    const result = configurationService.getValue(defaultChat.completionsEnablementSetting);
    if (!isObject(result)) {
        return false;
    }
    if (typeof result[modeId] !== 'undefined') {
        return Boolean(result[modeId]); // go with setting if explicitly defined
    }
    return Boolean(result['*']); // fallback to global setting otherwise
}
let ChatStatusDashboard = class ChatStatusDashboard extends Disposable {
    constructor(chatEntitlementService, chatStatusItemService, commandService, configurationService, editorService, hoverService, languageService, openerService, telemetryService, textResourceConfigurationService, inlineCompletionsService, chatSessionsService, markdownRendererService) {
        super();
        this.chatEntitlementService = chatEntitlementService;
        this.chatStatusItemService = chatStatusItemService;
        this.commandService = commandService;
        this.configurationService = configurationService;
        this.editorService = editorService;
        this.hoverService = hoverService;
        this.languageService = languageService;
        this.openerService = openerService;
        this.telemetryService = telemetryService;
        this.textResourceConfigurationService = textResourceConfigurationService;
        this.inlineCompletionsService = inlineCompletionsService;
        this.chatSessionsService = chatSessionsService;
        this.markdownRendererService = markdownRendererService;
        this.element = $('div.chat-status-bar-entry-tooltip');
        this.dateFormatter = safeIntl.DateTimeFormat(language, { year: 'numeric', month: 'long', day: 'numeric' });
        this.dateTimeFormatter = safeIntl.DateTimeFormat(language, { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' });
        this.quotaPercentageFormatter = safeIntl.NumberFormat(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 0 });
        this.quotaOverageFormatter = safeIntl.NumberFormat(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
        this.entryDisposables = this._register(new MutableDisposable());
    }
    show(token) {
        clearNode(this.element);
        const disposables = this.entryDisposables.value = new DisposableStore();
        disposables.add(token.onCancellationRequested(() => disposables.dispose()));
        let needsSeparator = false;
        const addSeparator = (label, action) => {
            if (needsSeparator) {
                this.element.appendChild($('hr'));
            }
            if (label || action) {
                this.renderHeader(this.element, disposables, label ?? '', action);
            }
            needsSeparator = true;
        };
        // Quota Indicator
        const { chat: chatQuota, completions: completionsQuota, premiumChat: premiumChatQuota, resetDate, resetDateHasTime } = this.chatEntitlementService.quotas;
        if (chatQuota || completionsQuota || premiumChatQuota) {
            addSeparator(localize('usageTitle', "Copilot Usage"), toAction({
                id: 'workbench.action.manageCopilot',
                label: localize('quotaLabel', "Manage Chat"),
                tooltip: localize('quotaTooltip', "Manage Chat"),
                class: ThemeIcon.asClassName(Codicon.settings),
                run: () => this.runCommandAndClose(() => this.openerService.open(URI.parse(defaultChat.manageSettingsUrl))),
            }));
            const completionsQuotaIndicator = completionsQuota && (completionsQuota.total > 0 || completionsQuota.unlimited) ? this.createQuotaIndicator(this.element, disposables, completionsQuota, localize('completionsLabel', "Inline Suggestions"), false) : undefined;
            const chatQuotaIndicator = chatQuota && (chatQuota.total > 0 || chatQuota.unlimited) ? this.createQuotaIndicator(this.element, disposables, chatQuota, localize('chatsLabel', "Chat messages"), false) : undefined;
            const premiumChatQuotaIndicator = premiumChatQuota && (premiumChatQuota.total > 0 || premiumChatQuota.unlimited) ? this.createQuotaIndicator(this.element, disposables, premiumChatQuota, localize('premiumChatsLabel', "Premium requests"), true) : undefined;
            if (resetDate) {
                this.element.appendChild($('div.description', undefined, localize('limitQuota', "Allowance resets {0}.", resetDateHasTime ? this.dateTimeFormatter.value.format(new Date(resetDate)) : this.dateFormatter.value.format(new Date(resetDate)))));
            }
            if (this.chatEntitlementService.entitlement === ChatEntitlement.Free && (Number(chatQuota?.percentRemaining) <= 25 || Number(completionsQuota?.percentRemaining) <= 25)) {
                const upgradeProButton = disposables.add(new Button(this.element, { ...defaultButtonStyles, hoverDelegate: nativeHoverDelegate, secondary: canUseChat(this.chatEntitlementService) /* use secondary color when chat can still be used */ }));
                upgradeProButton.label = localize('upgradeToCopilotPro', "Upgrade to GitHub Copilot Pro");
                disposables.add(upgradeProButton.onDidClick(() => this.runCommandAndClose('workbench.action.chat.upgradePlan')));
            }
            (async () => {
                await this.chatEntitlementService.update(token);
                if (token.isCancellationRequested) {
                    return;
                }
                const { chat: chatQuota, completions: completionsQuota, premiumChat: premiumChatQuota } = this.chatEntitlementService.quotas;
                if (completionsQuota) {
                    completionsQuotaIndicator?.(completionsQuota);
                }
                if (chatQuota) {
                    chatQuotaIndicator?.(chatQuota);
                }
                if (premiumChatQuota) {
                    premiumChatQuotaIndicator?.(premiumChatQuota);
                }
            })();
        }
        // Anonymous Indicator
        else if (this.chatEntitlementService.anonymous && this.chatEntitlementService.sentiment.installed) {
            addSeparator(localize('anonymousTitle', "Copilot Usage"));
            this.createQuotaIndicator(this.element, disposables, localize('quotaLimited', "Limited"), localize('completionsLabel', "Inline Suggestions"), false);
            this.createQuotaIndicator(this.element, disposables, localize('quotaLimited', "Limited"), localize('chatsLabel', "Chat messages"), false);
        }
        // Chat sessions
        {
            let chatSessionsElement;
            const updateStatus = () => {
                const inProgress = this.chatSessionsService.getInProgress();
                if (inProgress.some(item => item.count > 0)) {
                    addSeparator(localize('chatAgentSessionsTitle', "Agent Sessions"), toAction({
                        id: 'workbench.view.chat.status.sessions',
                        label: localize('viewChatSessionsLabel', "View Agent Sessions"),
                        tooltip: localize('viewChatSessionsTooltip', "View Agent Sessions"),
                        class: ThemeIcon.asClassName(Codicon.eye),
                        run: () => {
                            // TODO@bpasero remove this check once settled
                            if (this.configurationService.getValue('chat.agentSessionsViewLocation') === 'single-view') {
                                this.runCommandAndClose(AGENT_SESSIONS_VIEW_ID);
                            }
                            else {
                                this.runCommandAndClose(LEGACY_AGENT_SESSIONS_VIEW_ID);
                            }
                        }
                    }));
                    for (const { displayName, count } of inProgress) {
                        if (count > 0) {
                            const text = localize('inProgressChatSession', "$(loading~spin) {0} in progress", displayName);
                            chatSessionsElement = this.element.appendChild($('div.description'));
                            const parts = renderLabelWithIcons(text);
                            chatSessionsElement.append(...parts);
                        }
                    }
                }
                else {
                    chatSessionsElement?.remove();
                }
            };
            updateStatus();
            disposables.add(this.chatSessionsService.onDidChangeInProgress(updateStatus));
        }
        // Contributions
        {
            for (const item of this.chatStatusItemService.getEntries()) {
                addSeparator();
                const itemDisposables = disposables.add(new MutableDisposable());
                let rendered = this.renderContributedChatStatusItem(item);
                itemDisposables.value = rendered.disposables;
                this.element.appendChild(rendered.element);
                disposables.add(this.chatStatusItemService.onDidChange(e => {
                    if (e.entry.id === item.id) {
                        const previousElement = rendered.element;
                        rendered = this.renderContributedChatStatusItem(e.entry);
                        itemDisposables.value = rendered.disposables;
                        previousElement.replaceWith(rendered.element);
                    }
                }));
            }
        }
        // Settings
        {
            const chatSentiment = this.chatEntitlementService.sentiment;
            addSeparator(localize('inlineSuggestions', "Inline Suggestions"), chatSentiment.installed && !chatSentiment.disabled && !chatSentiment.untrusted ? toAction({
                id: 'workbench.action.openChatSettings',
                label: localize('settingsLabel', "Settings"),
                tooltip: localize('settingsTooltip', "Open Settings"),
                class: ThemeIcon.asClassName(Codicon.settingsGear),
                run: () => this.runCommandAndClose(() => this.commandService.executeCommand('workbench.action.openSettings', { query: `@id:${defaultChat.completionsEnablementSetting} @id:${defaultChat.nextEditSuggestionsSetting}` })),
            }) : undefined);
            this.createSettings(this.element, disposables);
        }
        // Completions Snooze
        if (canUseChat(this.chatEntitlementService)) {
            const snooze = append(this.element, $('div.snooze-completions'));
            this.createCompletionsSnooze(snooze, localize('settings.snooze', "Snooze"), disposables);
        }
        // New to Chat / Signed out
        {
            const newUser = isNewUser(this.chatEntitlementService);
            const anonymousUser = this.chatEntitlementService.anonymous;
            const disabled = this.chatEntitlementService.sentiment.disabled || this.chatEntitlementService.sentiment.untrusted;
            const signedOut = this.chatEntitlementService.entitlement === ChatEntitlement.Unknown;
            if (newUser || signedOut || disabled) {
                addSeparator();
                let descriptionText;
                let descriptionClass = '.description';
                if (newUser && anonymousUser) {
                    descriptionText = new MarkdownString(localize({ key: 'activeDescriptionAnonymous', comment: ['{Locked="]({2})"}', '{Locked="]({3})"}'] }, "By continuing with {0} Copilot, you agree to {1}'s [Terms]({2}) and [Privacy Statement]({3})", defaultChat.provider.default.name, defaultChat.provider.default.name, defaultChat.termsStatementUrl, defaultChat.privacyStatementUrl), { isTrusted: true });
                    descriptionClass = `${descriptionClass}.terms`;
                }
                else if (newUser) {
                    descriptionText = localize('activateDescription', "Set up Copilot to use AI features.");
                }
                else if (anonymousUser) {
                    descriptionText = localize('enableMoreDescription', "Sign in to enable more Copilot AI features.");
                }
                else if (disabled) {
                    descriptionText = localize('enableDescription', "Enable Copilot to use AI features.");
                }
                else {
                    descriptionText = localize('signInDescription', "Sign in to use Copilot AI features.");
                }
                let buttonLabel;
                if (newUser) {
                    buttonLabel = localize('enableAIFeatures', "Use AI Features");
                }
                else if (anonymousUser) {
                    buttonLabel = localize('enableMoreAIFeatures', "Enable more AI Features");
                }
                else if (disabled) {
                    buttonLabel = localize('enableCopilotButton', "Enable AI Features");
                }
                else {
                    buttonLabel = localize('signInToUseAIFeatures', "Sign in to use AI Features");
                }
                let commandId;
                if (newUser && anonymousUser) {
                    commandId = 'workbench.action.chat.triggerSetupAnonymousWithoutDialog';
                }
                else {
                    commandId = 'workbench.action.chat.triggerSetup';
                }
                if (typeof descriptionText === 'string') {
                    this.element.appendChild($(`div${descriptionClass}`, undefined, descriptionText));
                }
                else {
                    this.element.appendChild($(`div${descriptionClass}`, undefined, disposables.add(this.markdownRendererService.render(descriptionText)).element));
                }
                const button = disposables.add(new Button(this.element, { ...defaultButtonStyles, hoverDelegate: nativeHoverDelegate }));
                button.label = buttonLabel;
                disposables.add(button.onDidClick(() => this.runCommandAndClose(commandId)));
            }
        }
        return this.element;
    }
    renderHeader(container, disposables, label, action) {
        const header = container.appendChild($('div.header', undefined, label ?? ''));
        if (action) {
            const toolbar = disposables.add(new ActionBar(header, { hoverDelegate: nativeHoverDelegate }));
            toolbar.push([action], { icon: true, label: false });
        }
    }
    renderContributedChatStatusItem(item) {
        const disposables = new DisposableStore();
        const itemElement = $('div.contribution');
        const headerLabel = typeof item.label === 'string' ? item.label : item.label.label;
        const headerLink = typeof item.label === 'string' ? undefined : item.label.link;
        this.renderHeader(itemElement, disposables, headerLabel, headerLink ? toAction({
            id: 'workbench.action.openChatStatusItemLink',
            label: localize('learnMore', "Learn More"),
            tooltip: localize('learnMore', "Learn More"),
            class: ThemeIcon.asClassName(Codicon.linkExternal),
            run: () => this.runCommandAndClose(() => this.openerService.open(URI.parse(headerLink))),
        }) : undefined);
        const itemBody = itemElement.appendChild($('div.body'));
        const description = itemBody.appendChild($('span.description'));
        this.renderTextPlus(description, item.description, disposables);
        if (item.detail) {
            const detail = itemBody.appendChild($('div.detail-item'));
            this.renderTextPlus(detail, item.detail, disposables);
        }
        return { element: itemElement, disposables };
    }
    renderTextPlus(target, text, store) {
        for (const node of parseLinkedText(text).nodes) {
            if (typeof node === 'string') {
                const parts = renderLabelWithIcons(node);
                target.append(...parts);
            }
            else {
                store.add(new Link(target, node, undefined, this.hoverService, this.openerService));
            }
        }
    }
    runCommandAndClose(commandOrFn, ...args) {
        if (typeof commandOrFn === 'function') {
            commandOrFn(...args);
        }
        else {
            this.telemetryService.publicLog2('workbenchActionExecuted', { id: commandOrFn, from: 'chat-status' });
            this.commandService.executeCommand(commandOrFn, ...args);
        }
        this.hoverService.hideHover(true);
    }
    createQuotaIndicator(container, disposables, quota, label, supportsOverage) {
        const quotaValue = $('span.quota-value');
        const quotaBit = $('div.quota-bit');
        const overageLabel = $('span.overage-label');
        const quotaIndicator = container.appendChild($('div.quota-indicator', undefined, $('div.quota-label', undefined, $('span', undefined, label), quotaValue), $('div.quota-bar', undefined, quotaBit), $('div.description', undefined, overageLabel)));
        if (supportsOverage && (this.chatEntitlementService.entitlement === ChatEntitlement.Pro || this.chatEntitlementService.entitlement === ChatEntitlement.ProPlus)) {
            const manageOverageButton = disposables.add(new Button(quotaIndicator, { ...defaultButtonStyles, secondary: true, hoverDelegate: nativeHoverDelegate }));
            manageOverageButton.label = localize('enableAdditionalUsage', "Manage paid premium requests");
            disposables.add(manageOverageButton.onDidClick(() => this.runCommandAndClose(() => this.openerService.open(URI.parse(defaultChat.manageOverageUrl)))));
        }
        const update = (quota) => {
            quotaIndicator.classList.remove('error');
            quotaIndicator.classList.remove('warning');
            let usedPercentage;
            if (typeof quota === 'string' || quota.unlimited) {
                usedPercentage = 0;
            }
            else {
                usedPercentage = Math.max(0, 100 - quota.percentRemaining);
            }
            if (typeof quota === 'string') {
                quotaValue.textContent = quota;
            }
            else if (quota.unlimited) {
                quotaValue.textContent = localize('quotaUnlimited', "Included");
            }
            else if (quota.overageCount) {
                quotaValue.textContent = localize('quotaDisplayWithOverage', "+{0} requests", this.quotaOverageFormatter.value.format(quota.overageCount));
            }
            else {
                quotaValue.textContent = localize('quotaDisplay', "{0}%", this.quotaPercentageFormatter.value.format(usedPercentage));
            }
            quotaBit.style.width = `${usedPercentage}%`;
            if (usedPercentage >= 90) {
                quotaIndicator.classList.add('error');
            }
            else if (usedPercentage >= 75) {
                quotaIndicator.classList.add('warning');
            }
            if (supportsOverage) {
                if (typeof quota !== 'string' && quota?.overageEnabled) {
                    overageLabel.textContent = localize('additionalUsageEnabled', "Additional paid premium requests enabled.");
                }
                else {
                    overageLabel.textContent = localize('additionalUsageDisabled', "Additional paid premium requests disabled.");
                }
            }
            else {
                overageLabel.textContent = '';
            }
        };
        update(quota);
        return update;
    }
    createSettings(container, disposables) {
        const modeId = this.editorService.activeTextEditorLanguageId;
        const settings = container.appendChild($('div.settings'));
        // --- Inline Suggestions
        {
            const globalSetting = append(settings, $('div.setting'));
            this.createInlineSuggestionsSetting(globalSetting, localize('settings.codeCompletions.allFiles', "All files"), '*', disposables);
            if (modeId) {
                const languageSetting = append(settings, $('div.setting'));
                this.createInlineSuggestionsSetting(languageSetting, localize('settings.codeCompletions.language', "{0}", this.languageService.getLanguageName(modeId) ?? modeId), modeId, disposables);
            }
        }
        // --- Next edit suggestions
        {
            const setting = append(settings, $('div.setting'));
            this.createNextEditSuggestionsSetting(setting, localize('settings.nextEditSuggestions', "Next edit suggestions"), this.getCompletionsSettingAccessor(modeId), disposables);
        }
        return settings;
    }
    createSetting(container, settingIdsToReEvaluate, label, accessor, disposables) {
        const checkbox = disposables.add(new Checkbox(label, Boolean(accessor.readSetting()), { ...defaultCheckboxStyles }));
        container.appendChild(checkbox.domNode);
        const settingLabel = append(container, $('span.setting-label', undefined, label));
        disposables.add(Gesture.addTarget(settingLabel));
        [EventType.CLICK, TouchEventType.Tap].forEach(eventType => {
            disposables.add(addDisposableListener(settingLabel, eventType, e => {
                if (checkbox?.enabled) {
                    EventHelper.stop(e, true);
                    checkbox.checked = !checkbox.checked;
                    accessor.writeSetting(checkbox.checked);
                    checkbox.focus();
                }
            }));
        });
        disposables.add(checkbox.onChange(() => {
            accessor.writeSetting(checkbox.checked);
        }));
        disposables.add(this.configurationService.onDidChangeConfiguration(e => {
            if (settingIdsToReEvaluate.some(id => e.affectsConfiguration(id))) {
                checkbox.checked = Boolean(accessor.readSetting());
            }
        }));
        if (!canUseChat(this.chatEntitlementService)) {
            container.classList.add('disabled');
            checkbox.disable();
            checkbox.checked = false;
        }
        return checkbox;
    }
    createInlineSuggestionsSetting(container, label, modeId, disposables) {
        this.createSetting(container, [defaultChat.completionsEnablementSetting], label, this.getCompletionsSettingAccessor(modeId), disposables);
    }
    getCompletionsSettingAccessor(modeId = '*') {
        const settingId = defaultChat.completionsEnablementSetting;
        return {
            readSetting: () => isCompletionsEnabled(this.configurationService, modeId),
            writeSetting: (value) => {
                this.telemetryService.publicLog2('chatStatus.settingChanged', {
                    settingIdentifier: settingId,
                    settingMode: modeId,
                    settingEnablement: value ? 'enabled' : 'disabled'
                });
                let result = this.configurationService.getValue(settingId);
                if (!isObject(result)) {
                    result = Object.create(null);
                }
                return this.configurationService.updateValue(settingId, { ...result, [modeId]: value });
            }
        };
    }
    createNextEditSuggestionsSetting(container, label, completionsSettingAccessor, disposables) {
        const nesSettingId = defaultChat.nextEditSuggestionsSetting;
        const completionsSettingId = defaultChat.completionsEnablementSetting;
        const resource = EditorResourceAccessor.getOriginalUri(this.editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
        const checkbox = this.createSetting(container, [nesSettingId, completionsSettingId], label, {
            readSetting: () => completionsSettingAccessor.readSetting() && this.textResourceConfigurationService.getValue(resource, nesSettingId),
            writeSetting: (value) => {
                this.telemetryService.publicLog2('chatStatus.settingChanged', {
                    settingIdentifier: nesSettingId,
                    settingEnablement: value ? 'enabled' : 'disabled'
                });
                return this.textResourceConfigurationService.updateValue(resource, nesSettingId, value);
            }
        }, disposables);
        // enablement of NES depends on completions setting
        // so we have to update our checkbox state accordingly
        if (!completionsSettingAccessor.readSetting()) {
            container.classList.add('disabled');
            checkbox.disable();
        }
        disposables.add(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(completionsSettingId)) {
                if (completionsSettingAccessor.readSetting() && canUseChat(this.chatEntitlementService)) {
                    checkbox.enable();
                    container.classList.remove('disabled');
                }
                else {
                    checkbox.disable();
                    container.classList.add('disabled');
                }
            }
        }));
    }
    createCompletionsSnooze(container, label, disposables) {
        const isEnabled = () => {
            const completionsEnabled = isCompletionsEnabled(this.configurationService);
            const completionsEnabledActiveLanguage = isCompletionsEnabled(this.configurationService, this.editorService.activeTextEditorLanguageId);
            return completionsEnabled || completionsEnabledActiveLanguage;
        };
        const button = disposables.add(new Button(container, { disabled: !isEnabled(), ...defaultButtonStyles, hoverDelegate: nativeHoverDelegate, secondary: true }));
        const timerDisplay = container.appendChild($('span.snooze-label'));
        const actionBar = container.appendChild($('div.snooze-action-bar'));
        const toolbar = disposables.add(new ActionBar(actionBar, { hoverDelegate: nativeHoverDelegate }));
        const cancelAction = toAction({
            id: 'workbench.action.cancelSnoozeStatusBarLink',
            label: localize('cancelSnooze', "Cancel Snooze"),
            run: () => this.inlineCompletionsService.cancelSnooze(),
            class: ThemeIcon.asClassName(Codicon.stopCircle)
        });
        const update = (isEnabled) => {
            container.classList.toggle('disabled', !isEnabled);
            toolbar.clear();
            const timeLeftMs = this.inlineCompletionsService.snoozeTimeLeft;
            if (!isEnabled || timeLeftMs <= 0) {
                timerDisplay.textContent = localize('completions.snooze5minutesTitle', "Hide suggestions for 5 min");
                timerDisplay.title = '';
                button.label = label;
                button.setTitle(localize('completions.snooze5minutes', "Hide inline suggestions for 5 min"));
                return true;
            }
            const timeLeftSeconds = Math.ceil(timeLeftMs / 1000);
            const minutes = Math.floor(timeLeftSeconds / 60);
            const seconds = timeLeftSeconds % 60;
            timerDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds} ${localize('completions.remainingTime', "remaining")}`;
            timerDisplay.title = localize('completions.snoozeTimeDescription', "Inline suggestions are hidden for the remaining duration");
            button.label = localize('completions.plus5min', "+5 min");
            button.setTitle(localize('completions.snoozeAdditional5minutes', "Snooze additional 5 min"));
            toolbar.push([cancelAction], { icon: true, label: false });
            return false;
        };
        // Update every second if there's time remaining
        const timerDisposables = disposables.add(new DisposableStore());
        function updateIntervalTimer() {
            timerDisposables.clear();
            const enabled = isEnabled();
            if (update(enabled)) {
                return;
            }
            timerDisposables.add(disposableWindowInterval(getWindow(container), () => update(enabled), 1_000));
        }
        updateIntervalTimer();
        disposables.add(button.onDidClick(() => {
            this.inlineCompletionsService.snooze();
            update(isEnabled());
        }));
        disposables.add(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(defaultChat.completionsEnablementSetting)) {
                button.enabled = isEnabled();
            }
            updateIntervalTimer();
        }));
        disposables.add(this.inlineCompletionsService.onDidChangeIsSnoozing(e => {
            updateIntervalTimer();
        }));
    }
};
ChatStatusDashboard = __decorate([
    __param(0, IChatEntitlementService),
    __param(1, IChatStatusItemService),
    __param(2, ICommandService),
    __param(3, IConfigurationService),
    __param(4, IEditorService),
    __param(5, IHoverService),
    __param(6, ILanguageService),
    __param(7, IOpenerService),
    __param(8, ITelemetryService),
    __param(9, ITextResourceConfigurationService),
    __param(10, IInlineCompletionsService),
    __param(11, IChatSessionsService),
    __param(12, IMarkdownRendererService)
], ChatStatusDashboard);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFN0YXR1cy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFN0YXR1cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLHdCQUF3QixDQUFDO0FBQ2hDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMzRCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFOUMsT0FBTyxFQUE0QyxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBMEMsTUFBTSxrREFBa0QsQ0FBQztBQUMzTCxPQUFPLEVBQUUsQ0FBQyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsd0JBQXdCLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMzSixPQUFPLEVBQUUsZUFBZSxFQUEwQix1QkFBdUIsRUFBa0IsU0FBUyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFFdEssT0FBTyxFQUFFLG1CQUFtQixFQUFFLHFCQUFxQixFQUFFLE1BQU0scURBQXFELENBQUM7QUFDakgsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNuRixPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLGNB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