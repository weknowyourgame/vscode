/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../../nls.js';
import { Extensions as ConfigurationExtensions } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import product from '../../../../../platform/product/common/product.js';
export var TerminalSuggestSettingId;
(function (TerminalSuggestSettingId) {
    TerminalSuggestSettingId["Enabled"] = "terminal.integrated.suggest.enabled";
    TerminalSuggestSettingId["QuickSuggestions"] = "terminal.integrated.suggest.quickSuggestions";
    TerminalSuggestSettingId["SuggestOnTriggerCharacters"] = "terminal.integrated.suggest.suggestOnTriggerCharacters";
    TerminalSuggestSettingId["RunOnEnter"] = "terminal.integrated.suggest.runOnEnter";
    TerminalSuggestSettingId["WindowsExecutableExtensions"] = "terminal.integrated.suggest.windowsExecutableExtensions";
    TerminalSuggestSettingId["Providers"] = "terminal.integrated.suggest.providers";
    TerminalSuggestSettingId["ShowStatusBar"] = "terminal.integrated.suggest.showStatusBar";
    TerminalSuggestSettingId["CdPath"] = "terminal.integrated.suggest.cdPath";
    TerminalSuggestSettingId["InlineSuggestion"] = "terminal.integrated.suggest.inlineSuggestion";
    TerminalSuggestSettingId["UpArrowNavigatesHistory"] = "terminal.integrated.suggest.upArrowNavigatesHistory";
    TerminalSuggestSettingId["SelectionMode"] = "terminal.integrated.suggest.selectionMode";
    TerminalSuggestSettingId["InsertTrailingSpace"] = "terminal.integrated.suggest.insertTrailingSpace";
})(TerminalSuggestSettingId || (TerminalSuggestSettingId = {}));
export const windowsDefaultExecutableExtensions = [
    'exe', // Executable file
    'bat', // Batch file
    'cmd', // Command script
    'com', // Command file
    'msi', // Windows Installer package
    'ps1', // PowerShell script
    'vbs', // VBScript file
    'js', // JScript file
    'jar', // Java Archive (requires Java runtime)
    'py', // Python script (requires Python interpreter)
    'rb', // Ruby script (requires Ruby interpreter)
    'pl', // Perl script (requires Perl interpreter)
    'sh', // Shell script (via WSL or third-party tools)
];
export const terminalSuggestConfigSection = 'terminal.integrated.suggest';
export const terminalSuggestConfiguration = {
    ["terminal.integrated.suggest.enabled" /* TerminalSuggestSettingId.Enabled */]: {
        restricted: true,
        markdownDescription: localize('suggest.enabled', "Enables terminal intellisense suggestions (preview) for supported shells ({0}) when {1} is set to {2}.", 'PowerShell v7+, zsh, bash, fish', `\`#${"terminal.integrated.shellIntegration.enabled" /* TerminalSettingId.ShellIntegrationEnabled */}#\``, '`true`'),
        type: 'boolean',
        default: product.quality !== 'stable',
        experiment: {
            mode: 'auto',
        },
    },
    ["terminal.integrated.suggest.providers" /* TerminalSuggestSettingId.Providers */]: {
        restricted: true,
        markdownDescription: localize('suggest.providers', "Providers are enabled by default. Omit them by setting the id of the provider to `false`."),
        type: 'object',
        properties: {},
    },
    ["terminal.integrated.suggest.quickSuggestions" /* TerminalSuggestSettingId.QuickSuggestions */]: {
        restricted: true,
        markdownDescription: localize('suggest.quickSuggestions', "Controls whether suggestions should automatically show up while typing. Also be aware of the {0}-setting which controls if suggestions are triggered by special characters.", `\`#${"terminal.integrated.suggest.suggestOnTriggerCharacters" /* TerminalSuggestSettingId.SuggestOnTriggerCharacters */}#\``),
        type: 'object',
        properties: {
            commands: {
                description: localize('suggest.quickSuggestions.commands', 'Enable quick suggestions for commands, the first word in a command line input.'),
                type: 'string',
                enum: ['off', 'on'],
            },
            arguments: {
                description: localize('suggest.quickSuggestions.arguments', 'Enable quick suggestions for arguments, anything after the first word in a command line input.'),
                type: 'string',
                enum: ['off', 'on'],
            },
            unknown: {
                description: localize('suggest.quickSuggestions.unknown', 'Enable quick suggestions when it\'s unclear what the best suggestion is, if this is on files and folders will be suggested as a fallback.'),
                type: 'string',
                enum: ['off', 'on'],
            },
        },
        default: {
            commands: 'on',
            arguments: 'on',
            unknown: 'off',
        },
    },
    ["terminal.integrated.suggest.suggestOnTriggerCharacters" /* TerminalSuggestSettingId.SuggestOnTriggerCharacters */]: {
        restricted: true,
        markdownDescription: localize('suggest.suggestOnTriggerCharacters', "Controls whether suggestions should automatically show up when typing trigger characters."),
        type: 'boolean',
        default: true,
    },
    ["terminal.integrated.suggest.runOnEnter" /* TerminalSuggestSettingId.RunOnEnter */]: {
        restricted: true,
        markdownDescription: localize('suggest.runOnEnter', "Controls whether suggestions should run immediately when `Enter` (not `Tab`) is used to accept the result."),
        enum: ['never', 'exactMatch', 'exactMatchIgnoreExtension', 'always'],
        markdownEnumDescriptions: [
            localize('runOnEnter.never', "Never run on `Enter`."),
            localize('runOnEnter.exactMatch', "Run on `Enter` when the suggestion is typed in its entirety."),
            localize('runOnEnter.exactMatchIgnoreExtension', "Run on `Enter` when the suggestion is typed in its entirety or when a file is typed without its extension included."),
            localize('runOnEnter.always', "Always run on `Enter`.")
        ],
        default: 'never',
    },
    ["terminal.integrated.suggest.selectionMode" /* TerminalSuggestSettingId.SelectionMode */]: {
        markdownDescription: localize('terminal.integrated.selectionMode', "Controls how suggestion selection works in the integrated terminal."),
        type: 'string',
        enum: ['partial', 'always', 'never'],
        markdownEnumDescriptions: [
            localize('terminal.integrated.selectionMode.partial', "Partially select a suggestion when automatically triggering IntelliSense. `Tab` can be used to accept the first suggestion, only after navigating the suggestions via `Down` will `Enter` also accept the active suggestion."),
            localize('terminal.integrated.selectionMode.always', "Always select a suggestion when automatically triggering IntelliSense. `Enter` or `Tab` can be used to accept the first suggestion."),
            localize('terminal.integrated.selectionMode.never', "Never select a suggestion when automatically triggering IntelliSense. The list must be navigated via `Down` before `Enter` or `Tab` can be used to accept the active suggestion."),
        ],
        default: 'partial',
    },
    ["terminal.integrated.suggest.windowsExecutableExtensions" /* TerminalSuggestSettingId.WindowsExecutableExtensions */]: {
        restricted: true,
        markdownDescription: localize("terminalWindowsExecutableSuggestionSetting", "A set of windows command executable extensions that will be included as suggestions in the terminal.\n\nMany executables are included by default, listed below:\n\n{0}.\n\nTo exclude an extension, set it to `false`\n\n. To include one not in the list, add it and set it to `true`.", windowsDefaultExecutableExtensions.sort().map(extension => `- ${extension}`).join('\n')),
        type: 'object',
        default: {},
    },
    ["terminal.integrated.suggest.showStatusBar" /* TerminalSuggestSettingId.ShowStatusBar */]: {
        restricted: true,
        markdownDescription: localize('suggest.showStatusBar', "Controls whether the terminal suggestions status bar should be shown."),
        type: 'boolean',
        default: true,
    },
    ["terminal.integrated.suggest.cdPath" /* TerminalSuggestSettingId.CdPath */]: {
        restricted: true,
        markdownDescription: localize('suggest.cdPath', "Controls whether to enable $CDPATH support which exposes children of the folders in the $CDPATH variable regardless of the current working directory. $CDPATH is expected to be semi colon-separated on Windows and colon-separated on other platforms."),
        type: 'string',
        enum: ['off', 'relative', 'absolute'],
        markdownEnumDescriptions: [
            localize('suggest.cdPath.off', "Disable the feature."),
            localize('suggest.cdPath.relative', "Enable the feature and use relative paths."),
            localize('suggest.cdPath.absolute', "Enable the feature and use absolute paths. This is useful when the shell doesn't natively support `$CDPATH`."),
        ],
        default: 'absolute',
    },
    ["terminal.integrated.suggest.inlineSuggestion" /* TerminalSuggestSettingId.InlineSuggestion */]: {
        restricted: true,
        markdownDescription: localize('suggest.inlineSuggestion', "Controls whether the shell's inline suggestion should be detected and how it is scored."),
        type: 'string',
        enum: ['off', 'alwaysOnTopExceptExactMatch', 'alwaysOnTop'],
        markdownEnumDescriptions: [
            localize('suggest.inlineSuggestion.off', "Disable the feature."),
            localize('suggest.inlineSuggestion.alwaysOnTopExceptExactMatch', "Enable the feature and sort the inline suggestion without forcing it to be on top. This means that exact matches will be will be above the inline suggestion."),
            localize('suggest.inlineSuggestion.alwaysOnTop', "Enable the feature and always put the inline suggestion on top."),
        ],
        default: 'alwaysOnTop',
    },
    ["terminal.integrated.suggest.upArrowNavigatesHistory" /* TerminalSuggestSettingId.UpArrowNavigatesHistory */]: {
        restricted: true,
        markdownDescription: localize('suggest.upArrowNavigatesHistory', "Determines whether the up arrow key navigates the command history when focus is on the first suggestion and navigation has not yet occurred. When set to false, the up arrow will move focus to the last suggestion instead."),
        type: 'boolean',
        default: true,
    },
    ["terminal.integrated.suggest.insertTrailingSpace" /* TerminalSuggestSettingId.InsertTrailingSpace */]: {
        restricted: true,
        markdownDescription: localize('suggest.insertTrailingSpace', "Controls whether a space is automatically inserted after accepting a suggestion and re-trigger suggestions. Folders and symbolic link folders will never have a trailing space added."),
        type: 'boolean',
        default: false,
    },
};
let terminalSuggestProvidersConfiguration;
export function registerTerminalSuggestProvidersConfiguration(providers) {
    const oldProvidersConfiguration = terminalSuggestProvidersConfiguration;
    providers ??= new Map();
    if (!providers.has('lsp')) {
        providers.set('lsp', {
            id: 'lsp',
            description: localize('suggest.provider.lsp.description', 'Show suggestions from language servers.')
        });
    }
    const providersProperties = {};
    for (const id of Array.from(providers.keys()).sort()) {
        providersProperties[id] = {
            type: 'boolean',
            default: true,
            description: providers.get(id)?.description ??
                localize('suggest.provider.title', "Show suggestions from {0}.", id)
        };
    }
    const defaultValue = {};
    for (const key in providersProperties) {
        defaultValue[key] = providersProperties[key].default;
    }
    terminalSuggestProvidersConfiguration = {
        id: 'terminalSuggestProviders',
        order: 100,
        title: localize('terminalSuggestProvidersConfigurationTitle', "Terminal Suggest Providers"),
        type: 'object',
        properties: {
            ["terminal.integrated.suggest.providers" /* TerminalSuggestSettingId.Providers */]: {
                restricted: true,
                markdownDescription: localize('suggest.providersEnabledByDefault', "Controls which suggestions automatically show up while typing. Suggestion providers are enabled by default."),
                type: 'object',
                properties: providersProperties,
                default: defaultValue,
                tags: ['preview'],
                additionalProperties: false
            }
        }
    };
    const registry = Registry.as(ConfigurationExtensions.Configuration);
    registry.updateConfigurations({
        add: [terminalSuggestProvidersConfiguration],
        remove: oldProvidersConfiguration ? [oldProvidersConfiguration] : []
    });
}
registerTerminalSuggestProvidersConfiguration();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxTdWdnZXN0Q29uZmlndXJhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvc3VnZ2VzdC9jb21tb24vdGVybWluYWxTdWdnZXN0Q29uZmlndXJhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFvRCxVQUFVLElBQUksdUJBQXVCLEVBQTBCLE1BQU0sdUVBQXVFLENBQUM7QUFDeE0sT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQy9FLE9BQU8sT0FBTyxNQUFNLG1EQUFtRCxDQUFDO0FBR3hFLE1BQU0sQ0FBTixJQUFrQix3QkFhakI7QUFiRCxXQUFrQix3QkFBd0I7SUFDekMsMkVBQStDLENBQUE7SUFDL0MsNkZBQWlFLENBQUE7SUFDakUsaUhBQXFGLENBQUE7SUFDckYsaUZBQXFELENBQUE7SUFDckQsbUhBQXVGLENBQUE7SUFDdkYsK0VBQW1ELENBQUE7SUFDbkQsdUZBQTJELENBQUE7SUFDM0QseUVBQTZDLENBQUE7SUFDN0MsNkZBQWlFLENBQUE7SUFDakUsMkdBQStFLENBQUE7SUFDL0UsdUZBQTJELENBQUE7SUFDM0QsbUdBQXVFLENBQUE7QUFDeEUsQ0FBQyxFQWJpQix3QkFBd0IsS0FBeEIsd0JBQXdCLFFBYXpDO0FBRUQsTUFBTSxDQUFDLE1BQU0sa0NBQWtDLEdBQWE7SUFDM0QsS0FBSyxFQUFJLGtCQUFrQjtJQUMzQixLQUFLLEVBQUksYUFBYTtJQUN0QixLQUFLLEVBQUksaUJBQWlCO0lBQzFCLEtBQUssRUFBSSxlQUFlO0lBRXhCLEtBQUssRUFBSSw0QkFBNEI7SUFFckMsS0FBSyxFQUFJLG9CQUFvQjtJQUU3QixLQUFLLEVBQUks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