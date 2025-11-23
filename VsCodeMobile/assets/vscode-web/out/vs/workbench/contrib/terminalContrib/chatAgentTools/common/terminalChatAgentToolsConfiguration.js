/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../../nls.js';
import product from '../../../../../platform/product/common/product.js';
import { terminalProfileBaseProperties } from '../../../../../platform/terminal/common/terminalPlatformConfiguration.js';
import { PolicyCategory } from '../../../../../base/common/policy.js';
export var TerminalChatAgentToolsSettingId;
(function (TerminalChatAgentToolsSettingId) {
    TerminalChatAgentToolsSettingId["EnableAutoApprove"] = "chat.tools.terminal.enableAutoApprove";
    TerminalChatAgentToolsSettingId["AutoApprove"] = "chat.tools.terminal.autoApprove";
    TerminalChatAgentToolsSettingId["IgnoreDefaultAutoApproveRules"] = "chat.tools.terminal.ignoreDefaultAutoApproveRules";
    TerminalChatAgentToolsSettingId["BlockDetectedFileWrites"] = "chat.tools.terminal.blockDetectedFileWrites";
    TerminalChatAgentToolsSettingId["ShellIntegrationTimeout"] = "chat.tools.terminal.shellIntegrationTimeout";
    TerminalChatAgentToolsSettingId["AutoReplyToPrompts"] = "chat.tools.terminal.autoReplyToPrompts";
    TerminalChatAgentToolsSettingId["OutputLocation"] = "chat.tools.terminal.outputLocation";
    TerminalChatAgentToolsSettingId["TerminalProfileLinux"] = "chat.tools.terminal.terminalProfile.linux";
    TerminalChatAgentToolsSettingId["TerminalProfileMacOs"] = "chat.tools.terminal.terminalProfile.osx";
    TerminalChatAgentToolsSettingId["TerminalProfileWindows"] = "chat.tools.terminal.terminalProfile.windows";
    TerminalChatAgentToolsSettingId["DeprecatedAutoApproveCompatible"] = "chat.agent.terminal.autoApprove";
    TerminalChatAgentToolsSettingId["DeprecatedAutoApprove1"] = "chat.agent.terminal.allowList";
    TerminalChatAgentToolsSettingId["DeprecatedAutoApprove2"] = "chat.agent.terminal.denyList";
    TerminalChatAgentToolsSettingId["DeprecatedAutoApprove3"] = "github.copilot.chat.agent.terminal.allowList";
    TerminalChatAgentToolsSettingId["DeprecatedAutoApprove4"] = "github.copilot.chat.agent.terminal.denyList";
})(TerminalChatAgentToolsSettingId || (TerminalChatAgentToolsSettingId = {}));
const autoApproveBoolean = {
    type: 'boolean',
    enum: [
        true,
        false,
    ],
    enumDescriptions: [
        localize('autoApprove.true', "Automatically approve the pattern."),
        localize('autoApprove.false', "Require explicit approval for the pattern."),
    ],
    description: localize('autoApprove.key', "The start of a command to match against. A regular expression can be provided by wrapping the string in `/` characters."),
};
const terminalChatAgentProfileSchema = {
    type: 'object',
    required: ['path'],
    properties: {
        path: {
            description: localize('terminalChatAgentProfile.path', "A path to a shell executable."),
            type: 'string',
        },
        ...terminalProfileBaseProperties,
    }
};
export const terminalChatAgentToolsConfiguration = {
    ["chat.tools.terminal.enableAutoApprove" /* TerminalChatAgentToolsSettingId.EnableAutoApprove */]: {
        description: localize('autoApproveMode.description', "Controls whether to allow auto approval in the run in terminal tool."),
        type: 'boolean',
        default: true,
        policy: {
            name: 'ChatToolsTerminalEnableAutoApprove',
            category: PolicyCategory.IntegratedTerminal,
            minimumVersion: '1.104',
            localization: {
                description: {
                    key: 'autoApproveMode.description',
                    value: localize('autoApproveMode.description', "Controls whether to allow auto approval in the run in terminal tool."),
                }
            }
        }
    },
    ["chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */]: {
        markdownDescription: [
            localize('autoApprove.description.intro', "A list of commands or regular expressions that control whether the run in terminal tool commands require explicit approval. These will be matched against the start of a command. A regular expression can be provided by wrapping the string in {0} characters followed by optional flags such as {1} for case-insensitivity.", '`/`', '`i`'),
            localize('autoApprove.description.values', "Set to {0} to automatically approve commands, {1} to always require explicit approval or {2} to unset the value.", '`true`', '`false`', '`null`'),
            localize('autoApprove.description.subCommands', "Note that these commands and regular expressions are evaluated for every _sub-command_ within the full _command line_, so {0} for example will need both {1} and {2} to match a {3} entry and must not match a {4} entry in order to auto approve. Inline commands such as {5} (process substitution) should also be detected.", '`foo && bar`', '`foo`', '`bar`', '`true`', '`false`', '`<(foo)`'),
            localize('autoApprove.description.commandLine', "An object can be used to match against the full command line instead of matching sub-commands and inline commands, for example {0}. In order to be auto approved _both_ the sub-command and command line must not be explicitly denied, then _either_ all sub-commands or command line needs to be approved.", '`{ approve: false, matchCommandLine: true }`'),
            localize('autoApprove.defaults', "Note that there's a default set of rules to allow and also deny commands. Consider setting {0} to {1} to ignore all default rules to ensure there are no conflicts with your own rules. Do this at your own risk, the default denial rules are designed to protect you against running dangerous commands.", `\`#${"chat.tools.terminal.ignoreDefaultAutoApproveRules" /* TerminalChatAgentToolsSettingId.IgnoreDefaultAutoApproveRules */}#\``, '`true`'),
            [
                localize('autoApprove.description.examples.title', 'Examples:'),
                `|${localize('autoApprove.description.examples.value', "Value")}|${localize('autoApprove.description.examples.description', "Description")}|`,
                '|---|---|',
                '| `\"mkdir\": true` | ' + localize('autoApprove.description.examples.mkdir', "Allow all commands starting with {0}", '`mkdir`'),
                '| `\"npm run build\": true` | ' + localize('autoApprove.description.examples.npmRunBuild', "Allow all commands starting with {0}", '`npm run build`'),
                '| `\"bin/test.sh\": true` | ' + localize('autoApprove.description.examples.binTest', "Allow all commands that match the path {0} ({1}, {2}, etc.)", '`bin/test.sh`', '`bin\\test.sh`', '`./bin/test.sh`'),
                '| `\"/^git (status\\|show\\\\b.*)$/\": true` | ' + localize('autoApprove.description.examples.regexGit', "Allow {0} and all commands starting with {1}", '`git status`', '`git show`'),
                '| `\"/^Get-ChildItem\\\\b/i\": true` | ' + localize('autoApprove.description.examples.regexCase', "will allow {0} commands regardless of casing", '`Get-ChildItem`'),
                '| `\"/.*/\": true` | ' + localize('autoApprove.description.examples.regexAll', "Allow all commands (denied commands still require approval)"),
                '| `\"rm\": false` | ' + localize('autoApprove.description.examples.rm', "Require explicit approval for all commands starting with {0}", '`rm`'),
                '| `\"/\\\\.ps1/i\": { approve: false, matchCommandLine: true }` | ' + localize('autoApprove.description.examples.ps1', "Require explicit approval for any _command line_ that contains {0} regardless of casing", '`".ps1"`'),
                '| `\"rm\": null` | ' + localize('autoApprove.description.examples.rmUnset', "Unset the default {0} value for {1}", '`false`', '`rm`'),
            ].join('\n'),
        ].join('\n\n'),
        type: 'object',
        additionalProperties: {
            anyOf: [
                autoApproveBoolean,
                {
                    type: 'object',
                    properties: {
                        approve: autoApproveBoolean,
                        matchCommandLine: {
                            type: 'boolean',
                            enum: [
                                true,
                                false,
                            ],
                            enumDescriptions: [
                                localize('autoApprove.matchCommandLine.true', "Match against the full command line, eg. `foo && bar`."),
                                localize('autoApprove.matchCommandLine.false', "Match against sub-commands and inline commands, eg. `foo && bar` will need both `foo` and `bar` to match."),
                            ],
                            description: localize('autoApprove.matchCommandLine', "Whether to match against the full command line, as opposed to splitting by sub-commands and inline commands."),
                        }
                    },
                    required: ['approve']
                },
                {
                    type: 'null',
                    description: localize('autoApprove.null', "Ignore the pattern, this is useful for unsetting the same pattern set at a higher scope."),
                },
            ]
        },
        default: {
            // This is the default set of terminal auto approve commands. Note that these are best
            // effort and do not aim to provide exhaustive coverage to prevent dangerous commands
            // from executing as that is simply not feasible. Workspace trust and warnings of
            // possible prompt injection are _the_ thing protecting the user in agent mode, once
            // that trust boundary has been breached all bets are off as trusting a workspace that
            // contains anything malicious has already compromised the machine.
            //
            // Instead, the focus here is to unblock the user from approving clearly safe commands
            // frequently and cover common edge cases that could arise from the user auto-approving
            // commands.
            //
            // Take for example `find` which looks innocuous and most users are likely to auto
            // approve future calls when offered. However, the `-exec` argument can run anything. So
            // instead of leaving this decision up to the user we provide relatively safe defaults
            // and block common edge cases. So offering these default rules, despite their flaws, is
            // likely to protect the user more in general than leaving everything up to them (plus
            // make agent mode more convenient).
            // #region Safe commands
            //
            // Generally safe and common readonly commands
            cd: true,
            echo: true,
            ls: true,
            pwd: true,
            cat: true,
            head: true,
            tail: true,
            findstr: true,
            wc: true,
            tr: true,
            cut: true,
            cmp: true,
            which: true,
            basename: true,
            dirname: true,
            realpath: true,
            readlink: true,
            stat: true,
            file: true,
            du: true,
            df: true,
            sleep: true,
            nl: true,
            // grep
            // - Variable
            // - `-f`: Read patterns from file, this is an acceptable risk since you can do similar
            //   with cat
            // - `-P`: PCRE risks include denial of service (memory exhaustion, catastrophic
            //   backtracking) which could lock up the terminal. Older PCRE versions allow code
            //   execution via this flag but this has been patched with CVEs.
            // - Variable injection is possible, but requires setting a variable which would need
            //   manual approval.
            grep: true,
            // #endregion
            // #region Safe sub-commands
            //
            // Safe and common sub-commands
            'git status': true,
            'git log': true,
            'git show': true,
            'git diff': true,
            // git grep
            // - `--open-files-in-pager`: This is the configured pager, so no risk of code execution
            // - See notes on `grep`
            'git grep': true,
            // git branch
            // - `-d`, `-D`, `--delete`: Prevent branch deletion
            // - `-m`, `-M`: Prevent branch renaming
            // - `--force`: Generally dangerous
            'git branch': true,
            '/^git branch\\b.*-(d|D|m|M|-delete|-force)\\b/': false,
            // #endregion
            // #region PowerShell
            'Get-ChildItem': true,
            'Get-Content': true,
            'Get-Date': true,
            'Get-Random': true,
            'Get-Location': true,
            'Write-Host': true,
            'Write-Output': true,
            'Split-Path': true,
            'Join-Path': true,
            'Start-Sleep': true,
            'Where-Object': true,
            // Blanket approval of safe verbs
            '/^Select-[a-z0-9]/i': true,
            '/^Measure-[a-z0-9]/i': true,
            '/^Compare-[a-z0-9]/i': true,
            '/^Format-[a-z0-9]/i': true,
            '/^Sort-[a-z0-9]/i': true,
            // #endregion
            // #region Safe + disabled args
            //
            // Commands that are generally allowed with special cases we block. Note that shell
            // expansion is handled by the inline command detection when parsing sub-commands.
            // column
            // - `-c`: We block excessive columns that could lead to memory exhaustion.
            column: true,
            '/^column\\b.*-c\\s+[0-9]{4,}/': false,
            // date
            // -s|--set: Sets the system clock
            date: true,
            '/^date\\b.*(-s|--set)\\b/': false,
            // find
            // - `-delete`: Deletes files or directories.
            // - `-exec`/`-execdir`: Execute on results.
            // - `-fprint`/`fprintf`/`fls`: Writes files.
            // - `-ok`/`-okdir`: Like exec but with a confirmation.
            find: true,
            '/^find\\b.*-(delete|exec|execdir|fprint|fprintf|fls|ok|okdir)\\b/': false,
            // sort
            // - `-o`: Output redirection can write files (`sort -o /etc/something file`) which are
            //   blocked currently
            // - `-S`: Memory exhaustion is possible (`sort -S 100G file`), we allow possible denial
            //   of service.
            sort: true,
            '/^sort\\b.*-(o|S)\\b/': false,
            // tree
            // - `-o`: Output redirection can write files (`tree -o /etc/something file`) which are
            //   blocked currently
            tree: true,
            '/^tree\\b.*-o\\b/': false,
            // #endregion
            // #region Dangerous commands
            //
            // There are countless dangerous commands available on the command line, the defaults
            // here include common ones that the user is likely to want to explicitly approve first.
            // This is not intended to be a catch all as the user needs to opt-in to auto-approve
            // commands, it provides some additional safety when the commands get approved by overly
            // broad user/workspace rules.
            // Deleting files
            rm: false,
            rmdir: false,
            del: false,
            'Remove-Item': false,
            ri: false,
            rd: false,
            erase: false,
            dd: false,
            // Managing/killing processes, dangerous thing to do generally
            kill: false,
            ps: false,
            top: false,
            'Stop-Process': false,
            spps: false,
            taskkill: false,
            'taskkill.exe': false,
            // Web requests, prompt injection concerns
            curl: false,
            wget: false,
            'Invoke-RestMethod': false,
            'Invoke-WebRequest': false,
            'irm': false,
            'iwr': false,
            // File permissions and ownership, messing with these can cause hard to diagnose issues
            chmod: false,
            chown: false,
            'Set-ItemProperty': false,
            'sp': false,
            'Set-Acl': false,
            // General eval/command execution, can lead to anything else running
            jq: false,
            xargs: false,
            eval: false,
            'Invoke-Expression': false,
            iex: false,
            // #endregion
        },
    },
    ["chat.tools.terminal.ignoreDefaultAutoApproveRules" /* TerminalChatAgentToolsSettingId.IgnoreDefaultAutoApproveRules */]: {
        type: 'boolean',
        default: false,
        tags: ['experimental'],
        markdownDescription: localize('ignoreDefaultAutoApproveRules.description', "Whether to ignore the built-in default auto-approve rules used by the run in terminal tool as defined in {0}. When this setting is enabled, the run in terminal tool will ignore any rule that comes from the default set but still follow rules defined in the user, remote and workspace settings. Use this setting at your own risk; the default auto-approve rules are designed to protect you against running dangerous commands.", `\`#${"chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */}#\``),
    },
    ["chat.tools.terminal.blockDetectedFileWrites" /* TerminalChatAgentToolsSettingId.BlockDetectedFileWrites */]: {
        type: 'string',
        enum: ['never', 'outsideWorkspace', 'all'],
        enumDescriptions: [
            localize('blockFileWrites.never', "Allow all detected file writes."),
            localize('blockFileWrites.outsideWorkspace', "Block file writes detected outside the workspace. This depends on the shell integration feature working correctly to determine the current working directory of the terminal."),
            localize('blockFileWrites.all', "Block all detected file writes."),
        ],
        default: 'outsideWorkspace',
        tags: ['experimental'],
        markdownDescription: localize('blockFileWrites.description', "Controls whether detected file write operations are blocked in the run in terminal tool. When detected, this will require explicit approval regardless of whether the command would normally be auto approved. Note that this cannot detect all possible methods of writing files, this is what is currently detected:\n\n- File redirection (detected via the bash or PowerShell tree sitter grammar)"),
    },
    ["chat.tools.terminal.shellIntegrationTimeout" /* TerminalChatAgentToolsSettingId.ShellIntegrationTimeout */]: {
        markdownDescription: localize('shellIntegrationTimeout.description', "Configures the duration in milliseconds to wait for shell integration to be detected when the run in terminal tool launches a new terminal. Set to `0` to wait the minimum time, the default value `-1` means the wait time is variable based on the value of {0} and whether it's a remote window. A large value can be useful if your shell starts very slowly and a low value if you're intentionally not using shell integration.", `\`#${"terminal.integrated.shellIntegration.enabled" /* TerminalSettingId.ShellIntegrationEnabled */}#\``),
        type: 'integer',
        minimum: -1,
        maximum: 60000,
        default: -1,
        markdownDeprecationMessage: localize('shellIntegrationTimeout.deprecated', 'Use {0} instead', `\`#${"terminal.integrated.shellIntegration.timeout" /* TerminalSettingId.ShellIntegrationTimeout */}#\``)
    },
    ["chat.tools.terminal.terminalProfile.linux" /* TerminalChatAgentToolsSettingId.TerminalProfileLinux */]: {
        restricted: true,
        markdownDescription: localize('terminalChatAgentProfile.linux', "The terminal profile to use on Linux for chat agent's run in terminal tool."),
        type: ['object', 'null'],
        default: null,
        'anyOf': [
            { type: 'null' },
            terminalChatAgentProfileSchema
        ],
        defaultSnippets: [
            {
                body: {
                    path: '${1}'
                }
            }
        ]
    },
    ["chat.tools.terminal.terminalProfile.osx" /* TerminalChatAgentToolsSettingId.TerminalProfileMacOs */]: {
        restricted: true,
        markdownDescription: localize('terminalChatAgentProfile.osx', "The terminal profile to use on macOS for chat agent's run in terminal tool."),
        type: ['object', 'null'],
        default: null,
        'anyOf': [
            { type: 'null' },
            terminalChatAgentProfileSchema
        ],
        defaultSnippets: [
            {
                body: {
                    path: '${1}'
                }
            }
        ]
    },
    ["chat.tools.terminal.terminalProfile.windows" /* TerminalChatAgentToolsSettingId.TerminalProfileWindows */]: {
        restricted: true,
        markdownDescription: localize('terminalChatAgentProfile.windows', "The terminal profile to use on Windows for chat agent's run in terminal tool."),
        type: ['object', 'null'],
        default: null,
        'anyOf': [
            { type: 'null' },
            terminalChatAgentProfileSchema
        ],
        defaultSnippets: [
            {
                body: {
                    path: '${1}'
                }
            }
        ]
    },
    ["chat.tools.terminal.autoReplyToPrompts" /* TerminalChatAgentToolsSettingId.AutoReplyToPrompts */]: {
        type: 'boolean',
        default: false,
        tags: ['experimental'],
        markdownDescription: localize('autoReplyToPrompts.key', "Whether to automatically respond to prompts in the terminal such as `Confirm? y/n`. This is an experimental feature and may not work in all scenarios."),
    },
    ["chat.tools.terminal.outputLocation" /* TerminalChatAgentToolsSettingId.OutputLocation */]: {
        markdownDescription: localize('outputLocation.description', "Where to show the output from the run in terminal tool session."),
        type: 'string',
        enum: ['terminal', 'none'],
        enumDescriptions: [
            localize('outputLocation.terminal', "Reveal the terminal when running the command."),
            localize('outputLocation.none', "Do not reveal the terminal automatically."),
        ],
        default: product.quality !== 'stable' ? 'none' : 'terminal',
        tags: ['experimental'],
        experiment: {
            mode: 'auto'
        }
    }
};
for (const id of [
    "chat.agent.terminal.allowList" /* TerminalChatAgentToolsSettingId.DeprecatedAutoApprove1 */,
    "chat.agent.terminal.denyList" /* TerminalChatAgentToolsSettingId.DeprecatedAutoApprove2 */,
    "github.copilot.chat.agent.terminal.allowList" /* TerminalChatAgentToolsSettingId.DeprecatedAutoApprove3 */,
    "github.copilot.chat.agent.terminal.denyList" /* TerminalChatAgentToolsSettingId.DeprecatedAutoApprove4 */,
    "chat.agent.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.DeprecatedAutoApproveCompatible */,
]) {
    terminalChatAgentToolsConfiguration[id] = {
        deprecated: true,
        markdownDeprecationMessage: localize('autoApprove.deprecated', 'Use {0} instead', `\`#${"chat.tools.terminal.autoApprove" /* TerminalChatAgentToolsSettingId.AutoApprove */}#\``)
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDaGF0QWdlbnRUb29sc0NvbmZpZ3VyYXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL2NvbW1vbi90ZXJtaW5hbENoYXRBZ2VudFRvb2xzQ29uZmlndXJhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUloRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFHakQsT0FBTyxPQUFPLE1BQU0sbURBQW1ELENBQUM7QUFDeEUsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sMEVBQTBFLENBQUM7QUFDekgsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRXRFLE1BQU0sQ0FBTixJQUFrQiwrQkFrQmpCO0FBbEJELFdBQWtCLCtCQUErQjtJQUNoRCw4RkFBMkQsQ0FBQTtJQUMzRCxrRkFBK0MsQ0FBQTtJQUMvQyxzSEFBbUYsQ0FBQTtJQUNuRiwwR0FBdUUsQ0FBQTtJQUN2RSwwR0FBdUUsQ0FBQTtJQUN2RSxnR0FBNkQsQ0FBQTtJQUM3RCx3RkFBcUQsQ0FBQTtJQUVyRCxxR0FBa0UsQ0FBQTtJQUNsRSxtR0FBZ0UsQ0FBQTtJQUNoRSx5R0FBc0UsQ0FBQTtJQUV0RSxzR0FBbUUsQ0FBQTtJQUNuRSwyRkFBd0QsQ0FBQTtJQUN4RCwwRkFBdUQsQ0FBQTtJQUN2RCwwR0FBdUUsQ0FBQTtJQUN2RSx5R0FBc0UsQ0FBQTtBQUN2RSxDQUFDLEVBbEJpQiwrQkFBK0IsS0FBL0IsK0JBQStCLFFBa0JoRDtBQVFELE1BQU0sa0JBQWtCLEdBQWdCO0lBQ3ZDLElBQUksRUFBRSxTQUFTO0lBQ2YsSUFBSSxFQUFFO1FBQ0wsSUFBSTtRQUNKLEtBQUs7S0FDTDtJQUNELGdCQUFnQixFQUFFO1FBQ2pCLFFBQVEsQ0FB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