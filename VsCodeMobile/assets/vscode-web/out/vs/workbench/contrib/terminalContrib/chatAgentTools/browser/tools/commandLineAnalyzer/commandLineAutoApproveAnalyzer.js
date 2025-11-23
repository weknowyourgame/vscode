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
import { asArray } from '../../../../../../../base/common/arrays.js';
import { createCommandUri, MarkdownString } from '../../../../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../../../nls.js';
import { IConfigurationService } from '../../../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../../../platform/instantiation/common/instantiation.js';
import { ITerminalChatService } from '../../../../../terminal/browser/terminal.js';
import { IStorageService } from '../../../../../../../platform/storage/common/storage.js';
import { ChatConfiguration } from '../../../../../chat/common/constants.js';
import { CommandLineAutoApprover } from '../../commandLineAutoApprover.js';
import { dedupeRules, generateAutoApproveActions, isPowerShell } from '../../runInTerminalHelpers.js';
const promptInjectionWarningCommandsLower = [
    'curl',
    'wget',
];
const promptInjectionWarningCommandsLowerPwshOnly = [
    'invoke-restmethod',
    'invoke-webrequest',
    'irm',
    'iwr',
];
let CommandLineAutoApproveAnalyzer = class CommandLineAutoApproveAnalyzer extends Disposable {
    constructor(_treeSitterCommandParser, _telemetry, _log, _configurationService, instantiationService, _storageService, _terminalChatService) {
        super();
        this._treeSitterCommandParser = _treeSitterCommandParser;
        this._telemetry = _telemetry;
        this._log = _log;
        this._configurationService = _configurationService;
        this._storageService = _storageService;
        this._terminalChatService = _terminalChatService;
        this._commandLineAutoApprover = this._register(instantiationService.createInstance(CommandLineAutoApprover));
    }
    async analyze(options) {
        if (options.chatSessionId && this._terminalChatService.hasChatSessionAutoApproval(options.chatSessionId)) {
            this._log('Session has auto approval enabled, auto approving command');
            const disableUri = createCommandUri("workbench.action.terminal.chat.disableSessionAutoApproval" /* TerminalChatCommandId.DisableSessionAutoApproval */, options.chatSessionId);
            const mdTrustSettings = {
                isTrusted: {
                    enabledCommands: ["workbench.action.terminal.chat.disableSessionAutoApproval" /* TerminalChatCommandId.DisableSessionAutoApproval */]
                }
            };
            return {
                isAutoApproved: true,
                isAutoApproveAllowed: true,
                disclaimers: [],
                autoApproveInfo: new MarkdownString(`${localize('autoApprove.session', 'Auto approved for this session')} ([${localize('autoApprove.session.disable', 'Disable')}](${disableUri.toString()}))`, mdTrustSettings),
            };
        }
        let subCommands;
        try {
            subCommands = await this._treeSitterCommandParser.extractSubCommands(options.treeSitterLanguage, options.commandLine);
            this._log(`Parsed sub-commands via ${options.treeSitterLanguage} grammar`, subCommands);
        }
        catch (e) {
            console.error(e);
            this._log(`Failed to parse sub-commands via ${options.treeSitterLanguage} grammar`);
        }
        let isAutoApproved = false;
        let autoApproveInfo;
        let customActions;
        if (!subCommands) {
            return {
                isAutoApproveAllowed: false,
                disclaimers: [],
            };
        }
        const subCommandResults = subCommands.map(e => this._commandLineAutoApprover.isCommandAutoApproved(e, options.shell, options.os));
        const commandLineResult = this._commandLineAutoApprover.isCommandLineAutoApproved(options.commandLine);
        const autoApproveReasons = [
            ...subCommandResults.map(e => e.reason),
            commandLineResult.reason,
        ];
        let isDenied = false;
        let autoApproveReason;
        let autoApproveDefault;
        const deniedSubCommandResult = subCommandResults.find(e => e.result === 'denied');
        if (deniedSubCommandResult) {
            this._log('Sub-command DENIED auto approval');
            isDenied = true;
            autoApproveDefault = deniedSubCommandResult.rule?.isDefaultRule;
            autoApproveReason = 'subCommand';
        }
        else if (commandLineResult.result === 'denied') {
            this._log('Command line DENIED auto approval');
            isDenied = true;
            autoApproveDefault = commandLineResult.rule?.isDefaultRule;
            autoApproveReason = 'commandLine';
        }
        else {
            if (subCommandResults.every(e => e.result === 'approved')) {
                this._log('All sub-commands auto-approved');
                autoApproveReason = 'subCommand';
                isAutoApproved = true;
                autoApproveDefault = subCommandResults.every(e => e.rule?.isDefaultRule);
            }
            else {
                this._log('All sub-commands NOT auto-approved');
                if (commandLineResult.result === 'approved') {
                    this._log('Command line auto-approved');
                    autoApproveReason = 'commandLine';
                    isAutoApproved = true;
                    autoApproveDefault = commandLineResult.rule?.isDefaultRule;
                }
                else {
                    this._log('Command line NOT auto-approved');
                }
            }
        }
        // Log detailed auto approval reasoning
        for (const reason of autoApproveReasons) {
            this._log(`- ${reason}`);
        }
        // Apply auto approval or force it off depending on enablement/opt-in state
        const isAutoApproveEnabled = this._configurationService.getValue("chat.tools.terminal.enableAutoApprove" /* TerminalChatAgentToolsSettingId.EnableAutoApprove */) === true;
        const isAutoApproveWarningAccepted = this._storageService.getBoolean("chat.tools.terminal.autoApprove.warningAccepted" /* TerminalToolConfirmationStorageKeys.TerminalAutoApproveWarningAccepted */, -1 /* StorageScope.APPLICATION */, false);
        if (isAutoApproveEnabled && isAutoApproved) {
            autoApproveInfo = this._createAutoApproveInfo(isAutoApproved, isDenied, autoApproveReason, subCommandResults, commandLineResult);
        }
        else {
            isAutoApproved = false;
        }
        // Send telemetry about auto approval process
        this._telemetry.logPrepare({
            terminalToolSessionId: options.terminalToolSessionId,
            subCommands,
            autoApproveAllowed: !isAutoApproveEnabled ? 'off' : isAutoApproveWarningAccepted ? 'allowed' : 'needsOptIn',
            autoApproveResult: isAutoApproved ? 'approved' : isDenied ? 'denied' : 'manual',
            autoApproveReason,
            autoApproveDefault
        });
        // Prompt injection warning for common commands that return content from the web
        const disclaimers = [];
        const subCommandsLowerFirstWordOnly = subCommands.map(command => command.split(' ')[0].toLowerCase());
        if (!isAutoApproved && (subCommandsLowerFirstWordOnly.some(command => promptInjectionWarningCommandsLower.includes(command)) ||
            (isPowerShell(options.shell, options.os) && subCommandsLowerFirstWordOnly.some(command => promptInjectionWarningCommandsLowerPwshOnly.includes(command))))) {
            disclaimers.push(localize('runInTerminal.promptInjectionDisclaimer', 'Web content may contain malicious code or attempt prompt injection attacks.'));
        }
        if (!isAutoApproved && isAutoApproveEnabled) {
            customActions = generateAutoApproveActions(options.commandLine, subCommands, { subCommandResults, commandLineResult });
        }
        return {
            isAutoApproved,
            // This is not based on isDenied because we want the user to be able to configure it
            isAutoApproveAllowed: true,
            disclaimers,
            autoApproveInfo,
            customActions,
        };
    }
    _createAutoApproveInfo(isAutoApproved, isDenied, autoApproveReason, subCommandResults, commandLineResult) {
        const formatRuleLinks = (result) => {
            return asArray(result).map(e => {
                const settingsUri = createCommandUri("workbench.action.terminal.chat.openTerminalSettingsLink" /* TerminalChatCommandId.OpenTerminalSettingsLink */, e.rule.sourceTarget);
                return `[\`${e.rule.sourceText}\`](${settingsUri.toString()} "${localize('ruleTooltip', 'View rule in settings')}")`;
            }).join(', ');
        };
        const mdTrustSettings = {
            isTrusted: {
                enabledCommands: ["workbench.action.terminal.chat.openTerminalSettingsLink" /* TerminalChatCommandId.OpenTerminalSettingsLink */]
            }
        };
        const config = this._configurationService.inspect(ChatConfiguration.GlobalAutoApprove);
        const isGlobalAutoApproved = config?.value ?? config.defaultValue;
        if (isGlobalAutoApproved) {
            const settingsUri = createCommandUri("workbench.action.terminal.chat.openTerminalSettingsLink" /* TerminalChatCommandId.OpenTerminalSettingsLink */, 'global');
            return new MarkdownString(`${localize('autoApprove.global', 'Auto approved by setting {0}', `[\`${ChatConfiguration.GlobalAutoApprove}\`](${settingsUri.toString()} "${localize('ruleTooltip.global', 'View settings')}")`)}`, mdTrustSettings);
        }
        if (isAutoApproved) {
            switch (autoApproveReason) {
                case 'commandLine': {
                    if (commandLineResult.rule) {
                        return new MarkdownString(localize('autoApprove.rule', 'Auto approved by rule {0}', formatRuleLinks(commandLineResult)), mdTrustSettings);
                    }
                    break;
                }
                case 'subCommand': {
                    const uniqueRules = dedupeRules(subCommandResults);
                    if (uniqueRules.length === 1) {
                        return new MarkdownString(localize('autoApprove.rule', 'Auto approved by rule {0}', formatRuleLinks(uniqueRules)), mdTrustSettings);
                    }
                    else if (uniqueRules.length > 1) {
                        return new MarkdownString(localize('autoApprove.rules', 'Auto approved by rules {0}', formatRuleLinks(uniqueRules)), mdTrustSettings);
                    }
                    break;
                }
            }
        }
        else if (isDenied) {
            switch (autoApproveReason) {
                case 'commandLine': {
                    if (commandLineResult.rule) {
                        return new MarkdownString(localize('autoApproveDenied.rule', 'Auto approval denied by rule {0}', formatRuleLinks(commandLineResult)), mdTrustSettings);
                    }
                    break;
                }
                case 'subCommand': {
                    const uniqueRules = dedupeRules(subCommandResults.filter(e => e.result === 'denied'));
                    if (uniqueRules.length === 1) {
                        return new MarkdownString(localize('autoApproveDenied.rule', 'Auto approval denied by rule {0}', formatRuleLinks(uniqueRules)));
                    }
                    else if (uniqueRules.length > 1) {
                        return new MarkdownString(localize('autoApproveDenied.rules', 'Auto approval denied by rules {0}', formatRuleLinks(uniqueRules)));
                    }
                    break;
                }
            }
        }
        return undefined;
    }
};
CommandLineAutoApproveAnalyzer = __decorate([
    __param(3, IConfigurationService),
    __param(4, IInstantiationService),
    __param(5, IStorageService),
    __param(6, ITerminalChatService)
], CommandLineAutoApproveAnalyzer);
export { CommandLineAutoApproveAnalyzer };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWFuZExpbmVBdXRvQXBwcm92ZUFuYWx5emVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9jaGF0QWdlbnRUb29scy9icm93c2VyL3Rvb2xzL2NvbW1hbmRMaW5lQW5hbHl6ZXIvY29tbWFuZExpbmVBdXRvQXBwcm92ZUFuYWx5emVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUF3QixNQUFNLGlEQUFpRCxDQUFDO0FBQ3pILE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUUzRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0scUVBQXFFLENBQUM7QUFDNUcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0scUVBQXFFLENBQUM7QUFDNUcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDbkYsT0FBTyxFQUFFLGVBQWUsRUFBZ0IsTUFBTSx5REFBeUQsQ0FBQztBQUV4RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUc1RSxPQUFPLEVBQUUsdUJBQXVCLEVBQTZGLE1BQU0sa0NBQWtDLENBQUM7QUFDdEssT0FBTyxFQUFFLFdBQVcsRUFBRSwwQkFBMEIsRUFBRSxZQUFZLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQU10RyxNQUFNLG1DQUFtQyxHQUFHO0lBQzNDLE1BQU07SUFDTixNQUFNO0NBQ04sQ0FBQztBQUNGLE1BQU0sMkNBQTJDLEdBQUc7SUFDbkQsbUJBQW1CO0lBQ25CLG1C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