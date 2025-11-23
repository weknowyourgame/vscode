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
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { escapeRegExpCharacters, regExpLeadsToEndlessLoop } from '../../../../../base/common/strings.js';
import { isObject } from '../../../../../base/common/types.js';
import { structuralEquals } from '../../../../../base/common/equals.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { isPowerShell } from './runInTerminalHelpers.js';
const neverMatchRegex = /(?!.*)/;
const transientEnvVarRegex = /^[A-Z_][A-Z0-9_]*=/i;
let CommandLineAutoApprover = class CommandLineAutoApprover extends Disposable {
    constructor(_configurationService) {
        super();
        this._configurationService = _configurationService;
        this._denyListRules = [];
        this._allowListRules = [];
        this._allowListCommandLineRules = [];
        this._denyListCommandLineRules = [];
        this.updateConfiguration();
        this._register(this._configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */) ||
                e.affectsConfiguration("chat.tools.terminal.ignoreDefaultAutoApproveRules" /* TerminalChatAgentToolsSettingId.IgnoreDefaultAutoApproveRules */) ||
                e.affectsConfiguration("chat.agent.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.DeprecatedAutoApproveCompatible */)) {
                this.updateConfiguration();
            }
        }));
    }
    updateConfiguration() {
        let configValue = this._configurationService.getValue("chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */);
        const configInspectValue = this._configurationService.inspect("chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */);
        const deprecatedValue = this._configurationService.getValue("chat.agent.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.DeprecatedAutoApproveCompatible */);
        if (deprecatedValue && typeof deprecatedValue === 'object' && configValue && typeof configValue === 'object') {
            configValue = {
                ...configValue,
                ...deprecatedValue
            };
        }
        const { denyListRules, allowListRules, allowListCommandLineRules, denyListCommandLineRules } = this._mapAutoApproveConfigToRules(configValue, configInspectValue);
        this._allowListRules = allowListRules;
        this._denyListRules = denyListRules;
        this._allowListCommandLineRules = allowListCommandLineRules;
        this._denyListCommandLineRules = denyListCommandLineRules;
    }
    isCommandAutoApproved(command, shell, os) {
        // Check if the command has a transient environment variable assignment prefix which we
        // always deny for now as it can easily lead to execute other commands
        if (transientEnvVarRegex.test(command)) {
            return {
                result: 'denied',
                reason: `Command '${command}' is denied because it contains transient environment variables`
            };
        }
        // Check the deny list to see if this command requires explicit approval
        for (const rule of this._denyListRules) {
            if (this._commandMatchesRule(rule, command, shell, os)) {
                return {
                    result: 'denied',
                    rule,
                    reason: `Command '${command}' is denied by deny list rule: ${rule.sourceText}`
                };
            }
        }
        // Check the allow list to see if the command is allowed to run without explicit approval
        for (const rule of this._allowListRules) {
            if (this._commandMatchesRule(rule, command, shell, os)) {
                return {
                    result: 'approved',
                    rule,
                    reason: `Command '${command}' is approved by allow list rule: ${rule.sourceText}`
                };
            }
        }
        // TODO: LLM-based auto-approval https://github.com/microsoft/vscode/issues/253267
        // Fallback is always to require approval
        return {
            result: 'noMatch',
            reason: `Command '${command}' has no matching auto approve entries`
        };
    }
    isCommandLineAutoApproved(commandLine) {
        // Check the deny list first to see if this command line requires explicit approval
        for (const rule of this._denyListCommandLineRules) {
            if (rule.regex.test(commandLine)) {
                return {
                    result: 'denied',
                    rule,
                    reason: `Command line '${commandLine}' is denied by deny list rule: ${rule.sourceText}`
                };
            }
        }
        // Check if the full command line matches any of the allow list command line regexes
        for (const rule of this._allowListCommandLineRules) {
            if (rule.regex.test(commandLine)) {
                return {
                    result: 'approved',
                    rule,
                    reason: `Command line '${commandLine}' is approved by allow list rule: ${rule.sourceText}`
                };
            }
        }
        return {
            result: 'noMatch',
            reason: `Command line '${commandLine}' has no matching auto approve entries`
        };
    }
    _commandMatchesRule(rule, command, shell, os) {
        const isPwsh = isPowerShell(shell, os);
        // PowerShell is case insensitive regardless of platform
        if ((isPwsh ? rule.regexCaseInsensitive : rule.regex).test(command)) {
            return true;
        }
        else if (isPwsh && command.startsWith('(')) {
            // Allow ignoring of the leading ( for PowerShell commands as it's a command pattern to
            // operate on the output of a command. For example `(Get-Content README.md) ...`
            if (rule.regexCaseInsensitive.test(command.slice(1))) {
                return true;
            }
        }
        return false;
    }
    _mapAutoApproveConfigToRules(config, configInspectValue) {
        if (!config || typeof config !== 'object') {
            return {
                denyListRules: [],
                allowListRules: [],
                allowListCommandLineRules: [],
                denyListCommandLineRules: []
            };
        }
        const denyListRules = [];
        const allowListRules = [];
        const allowListCommandLineRules = [];
        const denyListCommandLineRules = [];
        const ignoreDefaults = this._configurationService.getValue("chat.tools.terminal.ignoreDefaultAutoApproveRules" /* TerminalChatAgentToolsSettingId.IgnoreDefaultAutoApproveRules */) === true;
        for (const [key, value] of Object.entries(config)) {
            const defaultValue = configInspectValue?.default?.value;
            const isDefaultRule = !!(isObject(defaultValue) &&
                Object.prototype.hasOwnProperty.call(defaultValue, key) &&
                structuralEquals(defaultValue[key], value));
            function checkTarget(inspectValue) {
                return (isObject(inspectValue) &&
                    Object.prototype.hasOwnProperty.call(inspectValue, key) &&
                    structuralEquals(inspectValue[key], value));
            }
            const sourceTarget = (checkTarget(configInspectValue.workspaceFolder) ? 6 /* ConfigurationTarget.WORKSPACE_FOLDER */
                : checkTarget(configInspectValue.workspaceValue) ? 5 /* ConfigurationTarget.WORKSPACE */
                    : checkTarget(configInspectValue.userRemoteValue) ? 4 /* ConfigurationTarget.USER_REMOTE */
                        : checkTarget(configInspectValue.userLocalValue) ? 3 /* ConfigurationTarget.USER_LOCAL */
                            : checkTarget(configInspectValue.userValue) ? 2 /* ConfigurationTarget.USER */
                                : checkTarget(configInspectValue.applicationValue) ? 1 /* ConfigurationTarget.APPLICATION */
                                    : 7 /* ConfigurationTarget.DEFAULT */);
            // If default rules are disabled, ignore entries that come from the default config
            if (ignoreDefaults && isDefaultRule && sourceTarget === 7 /* ConfigurationTarget.DEFAULT */) {
                continue;
            }
            if (typeof value === 'boolean') {
                const { regex, regexCaseInsensitive } = this._convertAutoApproveEntryToRegex(key);
                // IMPORTANT: Only true and false are used, null entries need to be ignored
                if (value === true) {
                    allowListRules.push({ regex, regexCaseInsensitive, sourceText: key, sourceTarget, isDefaultRule });
                }
                else if (value === false) {
                    denyListRules.push({ regex, regexCaseInsensitive, sourceText: key, sourceTarget, isDefaultRule });
                }
            }
            else if (typeof value === 'object' && value !== null) {
                // Handle object format like { approve: true/false, matchCommandLine: true/false }
                const objectValue = value;
                if (typeof objectValue.approve === 'boolean') {
                    const { regex, regexCaseInsensitive } = this._convertAutoApproveEntryToRegex(key);
                    if (objectValue.approve === true) {
                        if (objectValue.matchCommandLine === true) {
                            allowListCommandLineRules.push({ regex, regexCaseInsensitive, sourceText: key, sourceTarget, isDefaultRule });
                        }
                        else {
                            allowListRules.push({ regex, regexCaseInsensitive, sourceText: key, sourceTarget, isDefaultRule });
                        }
                    }
                    else if (objectValue.approve === false) {
                        if (objectValue.matchCommandLine === true) {
                            denyListCommandLineRules.push({ regex, regexCaseInsensitive, sourceText: key, sourceTarget, isDefaultRule });
                        }
                        else {
                            denyListRules.push({ regex, regexCaseInsensitive, sourceText: key, sourceTarget, isDefaultRule });
                        }
                    }
                }
            }
        }
        return {
            denyListRules,
            allowListRules,
            allowListCommandLineRules,
            denyListCommandLineRules
        };
    }
    _convertAutoApproveEntryToRegex(value) {
        const regex = this._doConvertAutoApproveEntryToRegex(value);
        if (regex.flags.includes('i')) {
            return { regex, regexCaseInsensitive: regex };
        }
        return { regex, regexCaseInsensitive: new RegExp(regex.source, regex.flags + 'i') };
    }
    _doConvertAutoApproveEntryToRegex(value) {
        // If it's wrapped in `/`, it's in regex format and should be converted directly
        // Support all standard JavaScript regex flags: d, g, i, m, s, u, v, y
        const regexMatch = value.match(/^\/(?<pattern>.+)\/(?<flags>[dgimsuvy]*)$/);
        const regexPattern = regexMatch?.groups?.pattern;
        if (regexPattern) {
            let flags = regexMatch.groups?.flags;
            // Remove global flag as it changes how the regex state works which we need to handle
            // internally
            if (flags) {
                flags = flags.replaceAll('g', '');
            }
            // Allow .* as users expect this would match everything
            if (regexPattern === '.*') {
                return new RegExp(regexPattern);
            }
            try {
                const regex = new RegExp(regexPattern, flags || undefined);
                if (regExpLeadsToEndlessLoop(regex)) {
                    return neverMatchRegex;
                }
                return regex;
            }
            catch (error) {
                return neverMatchRegex;
            }
        }
        // The empty string should be ignored, rather than approve everything
        if (value === '') {
            return neverMatchRegex;
        }
        let sanitizedValue;
        // Match both path separators it if looks like a path
        if (value.includes('/') || value.includes('\\')) {
            // Replace path separators with placeholders first, apply standard sanitization, then
            // apply special path handling
            let pattern = value.replace(/[/\\]/g, '%%PATH_SEP%%');
            pattern = escapeRegExpCharacters(pattern);
            pattern = pattern.replace(/%%PATH_SEP%%*/g, '[/\\\\]');
            sanitizedValue = `^(?:\\.[/\\\\])?${pattern}`;
        }
        // Escape regex special characters for non-path strings
        else {
            sanitizedValue = escapeRegExpCharacters(value);
        }
        // Regular strings should match the start of the command line and be a word boundary
        return new RegExp(`^${sanitizedValue}\\b`);
    }
};
CommandLineAutoApprover = __decorate([
    __param(0, IConfigurationService)
], CommandLineAutoApprover);
export { CommandLineAutoApprover };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWFuZExpbmVBdXRvQXBwcm92ZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL2Jyb3dzZXIvY29tbWFuZExpbmVBdXRvQXBwcm92ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRXJFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN4RSxPQUFPLEVBQXVCLHFCQUFxQixFQUE0QixNQUFNLCtEQUErRCxDQUFDO0FBRXJKLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQWtCekQsTUFBTSxlQUFlLEdBQUcsUUFBUSxDQUFDO0FBQ2pDLE1BQU0sb0JBQW9CLEdBQUcscUJBQXFCLENBQUM7QUFFNUMsSUFBTSx1QkFBdUIsR0FBN0IsTUFBTSx1QkFBd0IsU0FBUSxVQUFVO0lBTXRELFlBQ3dCLHFCQUE2RDtRQUVwRixLQUFLLEVBQUUsQ0FBQztRQUZnQywwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO1FBTjdFLG1CQUFjLEdBQXVCLEVBQUUsQ0FBQztRQUN4QyxvQkFBZSxHQUF1QixFQUFFLENBQUM7UUFDekMsK0JBQTBCLEdBQXVCLEVBQUUsQ0FBQztRQUNwRCw4QkFBeUIsR0FBdUIsRUFBRSxDQUFDO1FBTTFELElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBQzNCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ3RFLElBQ0MsQ0FBQyxDQUFDLG9CQUFvQixxRkFBNkM7Z0JBQ25FLENBQUMsQ0FBQyxvQkFBb0IseUhBQStEO2dCQUNyRixDQUFDLENBQUMsb0JBQW9CLHlHQUFpRSxFQUN0RixDQUFDO2dCQUNGLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1lBQzVCLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELG1CQUFtQjtRQUNsQixJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxxRkFBNkMsQ0FBQztRQUNuRyxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLHFGQUE2QyxDQUFDO1FBQzNHLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLHlHQUFpRSxDQUFDO1FBQzdILElBQUksZUFBZSxJQUFJLE9BQU8sZUFBZSxLQUFLLFFBQVEsSUFBSSxXQUFXLElBQUksT0FBTyxXQUFXLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDOUcsV0FBVyxHQUFHO2dCQUNiLEdBQUcsV0FBVztnQkFDZCxHQUFHLGVBQWU7YUFDbEIsQ0FBQztRQUNILENBQUM7UUFFRCxNQUFNLEVBQ0wsYUFBYSxFQUNiLGNBQWMsRUFDZCx5QkFBeUIsRUFDekIsd0JBQXdCLEVBQ3hCLEdBQUcsSUFBSSxDQUFDLDRCQUE0QixDQUFDLFdBQVcsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3ZFLElBQUksQ0FBQyxlQUFlLEdBQUcsY0FBYyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxjQUFjLEdBQUcsYUFBYSxDQUFDO1FBQ3BDLElBQUksQ0FBQywwQkFBMEIsR0FBRyx5QkFBeUIsQ0FBQztRQUM1RCxJQUFJLENBQUMseUJBQXlCLEdBQUcsd0JBQXdCLENBQUM7SUFDM0QsQ0FBQztJQUVELHFCQUFxQixDQUFDLE9BQWUsRUFBRSxLQUFhLEVBQUUsRUFBbUI7UUFDeEUsdUZBQXVGO1FBQ3ZGLHNFQUFzRTtRQUN0RSxJQUFJLG9CQUFvQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ3hDLE9BQU87Z0JBQ04sTUFBTSxFQUFFLFFBQVE7Z0JBQ2hCLE1BQU0sRUFBRSxZQUFZLE9BQU8saUVBQWlFO2FBQzVGLENBQUM7UUFDSCxDQUFDO1FBRUQsd0VBQXdFO1FBQ3hFLEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3hDLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUM7Z0JBQ3hELE9BQU87b0JBQ04sTUFBTSxFQUFFLFFBQVE7b0JBQ2hCLElBQUk7b0JBQ0osTUFBTSxFQUFFLFlBQVksT0FBTyxrQ0FBa0MsSUFBSSxDQUFDLFVBQVUsRUFBRTtpQkFDOUUsQ0FBQztZQUNILENBQUM7UUFDRixDQUFDO1FBRUQseUZBQXlGO1FBQ3pGLEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ3pDLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUM7Z0JBQ3hELE9BQU87b0JBQ04sTUFBTSxFQUFFLFVBQVU7b0JBQ2xCLElBQUk7b0JBQ0osTUFBTSxFQUFFLFlBQVksT0FBTyxxQ0FBcUMsSUFBSSxDQUFDLFVBQVUsRUFBRTtpQkFDakYsQ0FBQztZQUNILENBQUM7UUFDRixDQUFDO1FBRUQsa0ZBQWtGO1FBRWxGLHlDQUF5QztRQUN6QyxPQUFPO1lBQ04sTUFBTSxFQUFFLFNBQVM7WUFDakIsTUFBTSxFQUFFLFlBQVksT0FBTyx3Q0FBd0M7U0FDbkUsQ0FBQztJQUNILENBQUM7SUFFRCx5QkFBeUIsQ0FBQyxXQUFtQjtRQUM1QyxtRkFBbUY7UUFDbkYsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztZQUNuRCxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xDLE9BQU87b0JBQ04sTUFBTSxFQUFFLFFBQVE7b0JBQ2hCLElBQUk7b0JBQ0osTUFBTSxFQUFFLGlCQUFpQixXQUFXLGtDQUFrQyxJQUFJLENBQUMsVUFBVSxFQUFFO2lCQUN2RixDQUFDO1lBQ0gsQ0FBQztRQUNGLENBQUM7UUFFRCxvRkFBb0Y7UUFDcEYsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztZQUNwRCxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xDLE9BQU87b0JBQ04sTUFBTSxFQUFFLFVBQVU7b0JBQ2xCLElBQUk7b0JBQ0osTUFBTSxFQUFFLGlCQUFpQixXQUFXLHFDQUFxQyxJQUFJLENBQUMsVUFBVSxFQUFFO2lCQUMxRixDQUFDO1lBQ0gsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPO1lBQ04sTUFBTSxFQUFFLFNBQVM7WUFDakIsTUFBTSxFQUFFLGlCQUFpQixXQUFXLHdDQUF3QztTQUM1RSxDQUFDO0lBQ0gsQ0FBQztJQUVPLG1CQUFtQixDQUFDLElBQXNCLEVBQUUsT0FBZSxFQUFFLEtBQWEsRUFBRSxFQUFtQjtRQUN0RyxNQUFNLE1BQU0sR0FBRyxZQUFZLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRXZDLHdEQUF3RDtRQUN4RCxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNyRSxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7YUFBTSxJQUFJLE1BQU0sSUFBSSxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDOUMsdUZBQXVGO1lBQ3ZGLGdGQUFnRjtZQUNoRixJQUFJLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3RELE9BQU8sSUFBSSxDQUFDO1lBQ2IsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFTyw0QkFBNEIsQ0FBQyxNQUFlLEVBQUUsa0JBQTBEO1FBTS9HLElBQUksQ0FBQyxNQUFNLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDM0MsT0FBTztnQkFDTixhQUFhLEVBQUUsRUFBRTtnQkFDakIsY0FBYyxFQUFFLEVBQUU7Z0JBQ2xCLHlCQUF5QixFQUFFLEVBQUU7Z0JBQzdCLHdCQUF3QixFQUFFLEVBQUU7YUFDNUIsQ0FBQztRQUNILENBQUM7UUFFRCxNQUFNLGFBQWEsR0FBdUIsRUFBRSxDQUFDO1FBQzdDLE1BQU0sY0FBYyxHQUF1QixFQUFFLENBQUM7UUFDOUMsTUFBTSx5QkFBeUIsR0FBdUIsRUFBRSxDQUFDO1FBQ3pELE1BQU0sd0JBQXdCLEdBQXVCLEVBQUUsQ0FBQztRQUV4RCxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSx5SEFBK0QsS0FBSyxJQUFJLENBQUM7UUFFbkksS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUNuRCxNQUFNLFlBQVksR0FBRyxrQkFBa0IsRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDO1lBQ3hELE1BQU0sYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUN2QixRQUFRLENBQUMsWUFBWSxDQUFDO2dCQUN0QixNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLEdBQUcsQ0FBQztnQkFDdkQsZ0JBQWdCLENBQUUsWUFBd0MsQ0FBQyxHQUFHLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FDdkUsQ0FBQztZQUNGLFNBQVMsV0FBVyxDQUFDLFlBQTJDO2dCQUMvRCxPQUFPLENBQ04sUUFBUSxDQUFDLFlBQVksQ0FBQztvQkFDdEIsTUFBTSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxHQUFHLENBQUM7b0JBQ3ZELGdCQUFnQixDQUFFLFlBQXdDLENBQUMsR0FBRyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQ3ZFLENBQUM7WUFDSCxDQUFDO1lBQ0QsTUFBTSxZQUFZLEdBQUcsQ0FDcEIsV0FBVyxDQUFDLGtCQUFrQixDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hELENBQUMsQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztvQkFDakQsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO3dCQUNsRCxDQUFDLENBQUMsV0FBVyxDQUFDLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7NEJBQ2pELENBQUMsQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztnQ0FDNUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7b0NBQ25ELENBQUMsb0NBQTRCLENBQ25DLENBQUM7WUFFRixrRkFBa0Y7WUFDbEYsSUFBSSxjQUFjLElBQUksYUFBYSxJQUFJLFlBQVksd0NBQWdDLEVBQUUsQ0FBQztnQkFDckYsU0FBUztZQUNWLENBQUM7WUFFRCxJQUFJLE9BQU8sS0FBSyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUNoQyxNQUFNLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFLEdBQUcsSUFBSSxDQUFDLCtCQUErQixDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNsRiwyRUFBMkU7Z0JBQzNFLElBQUksS0FBSyxLQUFLLElBQUksRUFBRSxDQUFDO29CQUNwQixjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxDQUFDLENBQUM7Z0JBQ3BHLENBQUM7cUJBQU0sSUFBSSxLQUFLLEtBQUssS0FBSyxFQUFFLENBQUM7b0JBQzVCLGFBQWEsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsb0JBQW9CLEVBQUUsVUFBVSxFQUFFLEdBQUcsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLENBQUMsQ0FBQztnQkFDbkcsQ0FBQztZQUNGLENBQUM7aUJBQU0sSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksS0FBSyxLQUFLLElBQUksRUFBRSxDQUFDO2dCQUN4RCxrRkFBa0Y7Z0JBQ2xGLE1BQU0sV0FBVyxHQUFHLEtBQTBELENBQUM7Z0JBQy9FLElBQUksT0FBTyxXQUFXLENBQUMsT0FBTyxLQUFLLFNBQVMsRUFBRSxDQUFDO29CQUM5QyxNQUFNLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFLEdBQUcsSUFBSSxDQUFDLCtCQUErQixDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUNsRixJQUFJLFdBQVcsQ0FBQyxPQUFPLEtBQUssSUFBSSxFQUFFLENBQUM7d0JBQ2xDLElBQUksV0FBVyxDQUFDLGdCQUFnQixLQUFLLElBQUksRUFBRSxDQUFDOzRCQUMzQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsb0JBQW9CLEVBQUUsVUFBVSxFQUFFLEdBQUcsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLENBQUMsQ0FBQzt3QkFDL0csQ0FBQzs2QkFBTSxDQUFDOzRCQUNQLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsb0JBQW9CLEVBQUUsVUFBVSxFQUFFLEdBQUcsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLENBQUMsQ0FBQzt3QkFDcEcsQ0FBQztvQkFDRixDQUFDO3lCQUFNLElBQUksV0FBVyxDQUFDLE9BQU8sS0FBSyxLQUFLLEVBQUUsQ0FBQzt3QkFDMUMsSUFBSSxXQUFXLENBQUMsZ0JBQWdCLEtBQUssSUFBSSxFQUFFLENBQUM7NEJBQzNDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxvQkFBb0IsRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsQ0FBQyxDQUFDO3dCQUM5RyxDQUFDOzZCQUFNLENBQUM7NEJBQ1AsYUFBYSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxvQkFBb0IsRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsQ0FBQyxDQUFDO3dCQUNuRyxDQUFDO29CQUNGLENBQUM7Z0JBQ0YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQsT0FBTztZQUNOLGFBQWE7WUFDYixjQUFjO1lBQ2QseUJBQXlCO1lBQ3pCLHdCQUF3QjtTQUN4QixDQUFDO0lBQ0gsQ0FBQztJQUVPLCtCQUErQixDQUFDLEtBQWE7UUFDcEQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzVELElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUMvQixPQUFPLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFLEtBQUssRUFBRSxDQUFDO1FBQy9DLENBQUM7UUFDRCxPQUFPLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDO0lBQ3JGLENBQUM7SUFFTyxpQ0FBaUMsQ0FBQyxLQUFhO1FBQ3RELGdGQUFnRjtRQUNoRixzRUFBc0U7UUFDdEUsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO1FBQzVFLE1BQU0sWUFBWSxHQUFHLFVBQVUsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDO1FBQ2pELElBQUksWUFBWSxFQUFFLENBQUM7WUFDbEIsSUFBSSxLQUFLLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUM7WUFDckMscUZBQXFGO1lBQ3JGLGFBQWE7WUFDYixJQUFJLEtBQUssRUFBRSxDQUFDO2dCQUNYLEtBQUssR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNuQyxDQUFDO1lBRUQsdURBQXVEO1lBQ3ZELElBQUksWUFBWSxLQUFLLElBQUksRUFBRSxDQUFDO2dCQUMzQixPQUFPLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBRWpDLENBQUM7WUFFRCxJQUFJLENBQUM7Z0JBQ0osTUFBTSxLQUFLLEdBQUcsSUFBSSxNQUFNLENBQUMsWUFBWSxFQUFFLEtBQUssSUFBSSxTQUFTLENBQUMsQ0FBQztnQkFDM0QsSUFBSSx3QkFBd0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO29CQUNyQyxPQUFPLGVBQWUsQ0FBQztnQkFDeEIsQ0FBQztnQkFFRCxPQUFPLEtBQUssQ0FBQztZQUNkLENBQUM7WUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO2dCQUNoQixPQUFPLGVBQWUsQ0FBQztZQUN4QixDQUFDO1FBQ0YsQ0FBQztRQUVELHFFQUFxRTtRQUNyRSxJQUFJLEtBQUssS0FBSyxFQUFFLEVBQUUsQ0FBQztZQUNsQixPQUFPLGVBQWUsQ0FBQztRQUN4QixDQUFDO1FBRUQsSUFBSSxjQUFzQixDQUFDO1FBRTNCLHFEQUFxRDtRQUNyRCxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ2pELHFGQUFxRjtZQUNyRiw4QkFBOEI7WUFDOUIsSUFBSSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDdEQsT0FBTyxHQUFHLHNCQUFzQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzFDLE9BQU8sR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLGdCQUFnQixFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ3ZELGNBQWMsR0FBRyxtQkFBbUIsT0FBTyxFQUFFLENBQUM7UUFDL0MsQ0FBQztRQUVELHVEQUF1RDthQUNsRCxDQUFDO1lBQ0wsY0FBYyxHQUFHLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2hELENBQUM7UUFFRCxvRkFBb0Y7UUFDcEYsT0FBTyxJQUFJLE1BQU0sQ0FBQyxJQUFJLGNBQWMsS0FBSyxDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUNELENBQUE7QUEzUlksdUJBQXVCO0lBT2pDLFdBQUEscUJBQXFCLENBQUE7R0FQWCx1QkFBdUIsQ0EyUm5DIn0=