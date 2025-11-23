/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Separator } from '../../../../../base/common/actions.js';
import { coalesce } from '../../../../../base/common/arrays.js';
import { posix as pathPosix, win32 as pathWin32 } from '../../../../../base/common/path.js';
import { escapeRegExpCharacters, removeAnsiEscapeCodes } from '../../../../../base/common/strings.js';
import { localize } from '../../../../../nls.js';
export function isPowerShell(envShell, os) {
    if (os === 1 /* OperatingSystem.Windows */) {
        return /^(?:powershell|pwsh)(?:-preview)?$/i.test(pathWin32.basename(envShell).replace(/\.exe$/i, ''));
    }
    return /^(?:powershell|pwsh)(?:-preview)?$/.test(pathPosix.basename(envShell));
}
export function isWindowsPowerShell(envShell) {
    return envShell.endsWith('System32\\WindowsPowerShell\\v1.0\\powershell.exe');
}
export function isZsh(envShell, os) {
    if (os === 1 /* OperatingSystem.Windows */) {
        return /^zsh(?:\.exe)?$/i.test(pathWin32.basename(envShell));
    }
    return /^zsh$/.test(pathPosix.basename(envShell));
}
export function isFish(envShell, os) {
    if (os === 1 /* OperatingSystem.Windows */) {
        return /^fish(?:\.exe)?$/i.test(pathWin32.basename(envShell));
    }
    return /^fish$/.test(pathPosix.basename(envShell));
}
// Maximum output length to prevent context overflow
const MAX_OUTPUT_LENGTH = 60000; // ~60KB limit to keep context manageable
const TRUNCATION_MESSAGE = '\n\n[... MIDDLE OF OUTPUT TRUNCATED ...]\n\n';
export function sanitizeTerminalOutput(output) {
    let sanitized = removeAnsiEscapeCodes(output)
        // Trim trailing \r\n characters
        .trimEnd();
    // Truncate if output is too long to prevent context overflow
    if (sanitized.length > MAX_OUTPUT_LENGTH) {
        const truncationMessageLength = TRUNCATION_MESSAGE.length;
        const availableLength = MAX_OUTPUT_LENGTH - truncationMessageLength;
        const startLength = Math.floor(availableLength * 0.4); // Keep 40% from start
        const endLength = availableLength - startLength; // Keep 60% from end
        const startPortion = sanitized.substring(0, startLength);
        const endPortion = sanitized.substring(sanitized.length - endLength);
        sanitized = startPortion + TRUNCATION_MESSAGE + endPortion;
    }
    return sanitized;
}
export function generateAutoApproveActions(commandLine, subCommands, autoApproveResult) {
    const actions = [];
    // We shouldn't offer configuring rules for commands that are explicitly denied since it
    // wouldn't get auto approved with a new rule
    const canCreateAutoApproval = (autoApproveResult.subCommandResults.every(e => e.result !== 'denied') &&
        autoApproveResult.commandLineResult.result !== 'denied');
    if (canCreateAutoApproval) {
        const unapprovedSubCommands = subCommands.filter((_, index) => {
            return autoApproveResult.subCommandResults[index].result !== 'approved';
        });
        // Some commands should not be recommended as they are too permissive generally. This only
        // applies to sub-commands, we still want to offer approving of the exact the command line
        // however as it's very specific.
        const neverAutoApproveCommands = new Set([
            // Shell interpreters
            'bash', 'sh', 'zsh', 'fish', 'ksh', 'csh', 'tcsh', 'dash',
            'pwsh', 'powershell', 'powershell.exe', 'cmd', 'cmd.exe',
            // Script interpreters
            'python', 'python3', 'node', 'ruby', 'perl', 'php', 'lua',
            // Direct execution commands
            'eval', 'exec', 'source', 'sudo', 'su', 'doas',
            // Network tools that can download and execute code
            'curl', 'wget', 'invoke-restmethod', 'invoke-webrequest', 'irm', 'iwr',
        ]);
        // Commands where we want to suggest the sub-command (eg. `foo bar` instead of `foo`)
        const commandsWithSubcommands = new Set(['git', 'npm', 'yarn', 'docker', 'kubectl', 'cargo', 'dotnet', 'mvn', 'gradle']);
        // Commands where we want to suggest the sub-command of a sub-command (eg. `foo bar baz`
        // instead of `foo`)
        const commandsWithSubSubCommands = new Set(['npm run', 'yarn run']);
        // For each unapproved sub-command (within the overall command line), decide whether to
        // suggest new rules for the command, a sub-command, a sub-command of a sub-command or to
        // not suggest at all.
        const subCommandsToSuggest = Array.from(new Set(coalesce(unapprovedSubCommands.map(command => {
            const parts = command.trim().split(/\s+/);
            const baseCommand = parts[0].toLowerCase();
            const baseSubCommand = parts.length > 1 ? `${parts[0]} ${parts[1]}`.toLowerCase() : '';
            // Security check: Never suggest auto-approval for dangerous interpreter commands
            if (neverAutoApproveCommands.has(baseCommand)) {
                return undefined;
            }
            if (commandsWithSubSubCommands.has(baseSubCommand)) {
                if (parts.length >= 3 && !parts[2].startsWith('-')) {
                    return `${parts[0]} ${parts[1]} ${parts[2]}`;
                }
                return undefined;
            }
            else if (commandsWithSubcommands.has(baseCommand)) {
                if (parts.length >= 2 && !parts[1].startsWith('-')) {
                    return `${parts[0]} ${parts[1]}`;
                }
                return undefined;
            }
            else {
                return parts[0];
            }
        }))));
        if (subCommandsToSuggest.length > 0) {
            let subCommandLabel;
            if (subCommandsToSuggest.length === 1) {
                subCommandLabel = localize('autoApprove.baseCommandSingle', 'Always Allow Command: {0}', subCommandsToSuggest[0]);
            }
            else {
                const commandSeparated = subCommandsToSuggest.join(', ');
                subCommandLabel = localize('autoApprove.baseCommand', 'Always Allow Commands: {0}', commandSeparated);
            }
            actions.push({
                label: subCommandLabel,
                data: {
                    type: 'newRule',
                    rule: subCommandsToSuggest.map(key => ({
                        key,
                        value: true
                    }))
                }
            });
        }
        // Allow exact command line, don't do this if it's just the first sub-command's first
        // word or if it's an exact match for special sub-commands
        const firstSubcommandFirstWord = unapprovedSubCommands.length > 0 ? unapprovedSubCommands[0].split(' ')[0] : '';
        if (firstSubcommandFirstWord !== commandLine &&
            !commandsWithSubcommands.has(commandLine) &&
            !commandsWithSubSubCommands.has(commandLine)) {
            actions.push({
                label: localize('autoApprove.exactCommand', 'Always Allow Exact Command Line'),
                data: {
                    type: 'newRule',
                    rule: {
                        key: `/^${escapeRegExpCharacters(commandLine)}$/`,
                        value: {
                            approve: true,
                            matchCommandLine: true
                        }
                    }
                }
            });
        }
    }
    if (actions.length > 0) {
        actions.push(new Separator());
    }
    // Allow all commands for this session
    actions.push({
        label: localize('allowSession', 'Allow All Commands in this Session'),
        tooltip: localize('allowSessionTooltip', 'Allow this tool to run in this session without confirmation.'),
        data: {
            type: 'sessionApproval'
        }
    });
    actions.push(new Separator());
    // Always show configure option
    actions.push({
        label: localize('autoApprove.configure', 'Configure Auto Approve...'),
        data: {
            type: 'configure'
        }
    });
    return actions;
}
export function dedupeRules(rules) {
    return rules.filter((result, index, array) => {
        return result.rule && array.findIndex(r => r.rule && r.rule.sourceText === result.rule.sourceText) === index;
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnVuSW5UZXJtaW5hbEhlbHBlcnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL2Jyb3dzZXIvcnVuSW5UZXJtaW5hbEhlbHBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsS0FBSyxJQUFJLFNBQVMsRUFBRSxLQUFLLElBQUksU0FBUyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFFNUYsT0FBTyxFQUFFLHNCQUFzQixFQUFFLHFCQUFxQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDdEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBS2pELE1BQU0sVUFBVSxZQUFZLENBQUMsUUFBZ0IsRUFBRSxFQUFtQjtJQUNqRSxJQUFJLEVBQUUsb0NBQTRCLEVBQUUsQ0FBQztRQUNwQyxPQUFPLHFDQUFxQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUV4RyxDQUFDO0lBQ0QsT0FBTyxvQ0FBb0MsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ2hGLENBQUM7QUFFRCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsUUFBZ0I7SUFDbkQsT0FBTyxRQUFRLENBQUMsUUFBUSxDQUFDLG1EQUFtRCxDQUFDLENBQUM7QUFDL0UsQ0FBQztBQUVELE1BQU0sVUFBVSxLQUFLLENBQUMsUUFBZ0IsRUFBRSxFQUFtQjtJ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