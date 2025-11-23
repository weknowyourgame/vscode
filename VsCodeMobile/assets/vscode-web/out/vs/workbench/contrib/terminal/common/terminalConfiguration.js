/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../base/common/codicons.js';
import { isMacintosh, isWindows } from '../../../../base/common/platform.js';
import { isString } from '../../../../base/common/types.js';
import { localize } from '../../../../nls.js';
import { Extensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import product from '../../../../platform/product/common/product.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { terminalColorSchema, terminalIconSchema } from '../../../../platform/terminal/common/terminalPlatformConfiguration.js';
import { Extensions as WorkbenchExtensions } from '../../../common/configuration.js';
import { terminalContribConfiguration } from '../terminalContribExports.js';
import { DEFAULT_COMMANDS_TO_SKIP_SHELL, DEFAULT_LETTER_SPACING, DEFAULT_LINE_HEIGHT, MAXIMUM_FONT_WEIGHT, MINIMUM_FONT_WEIGHT, SUGGESTIONS_FONT_WEIGHT } from './terminal.js';
const terminalDescriptors = '\n- ' + [
    '`\${cwd}`: ' + localize("cwd", "the terminal's current working directory."),
    '`\${cwdFolder}`: ' + localize('cwdFolder', "the terminal's current working directory, displayed for multi-root workspaces or in a single root workspace when the value differs from the initial working directory. On Windows, this will only be displayed when shell integration is enabled."),
    '`\${workspaceFolder}`: ' + localize('workspaceFolder', "the workspace in which the terminal was launched."),
    '`\${workspaceFolderName}`: ' + localize('workspaceFolderName', "the `name` of the workspace in which the terminal was launched."),
    '`\${local}`: ' + localize('local', "indicates a local terminal in a remote workspace."),
    '`\${process}`: ' + localize('process', "the name of the terminal process."),
    '`\${progress}`: ' + localize('progress', "the progress state as reported by the `OSC 9;4` sequence."),
    '`\${separator}`: ' + localize('separator', "a conditional separator {0} that only shows when it's surrounded by variables with values or static text.", '(` - `)'),
    '`\${sequence}`: ' + localize('sequence', "the name provided to the terminal by the process."),
    '`\${task}`: ' + localize('task', "indicates this terminal is associated with a task."),
    '`\${shellType}`: ' + localize('shellType', "the detected shell type."),
    '`\${shellCommand}`: ' + localize('shellCommand', "the command being executed according to shell integration. This also requires high confidence in the detected command line, which may not work in some prompt frameworks."),
    '`\${shellPromptInput}`: ' + localize('shellPromptInput', "the shell's full prompt input according to shell integration."),
].join('\n- '); // intentionally concatenated to not produce a string that is too long for translations
let terminalTitle = localize('terminalTitle', "Controls the terminal title. Variables are substituted based on the context:");
terminalTitle += terminalDescriptors;
let terminalDescription = localize('terminalDescription', "Controls the terminal description, which appears to the right of the title. Variables are substituted based on the context:");
terminalDescription += terminalDescriptors;
export const defaultTerminalFontSize = isMacintosh ? 12 : 14;
const terminalConfiguration = {
    ["terminal.integrated.sendKeybindingsToShell" /* TerminalSettingId.SendKeybindingsToShell */]: {
        markdownDescription: localize('terminal.integrated.sendKeybindingsToShell', "Dispatches most keybindings to the terminal instead of the workbench, overriding {0}, which can be used alternatively for fine tuning.", '`#terminal.integrated.commandsToSkipShell#`'),
        type: 'boolean',
        default: false
    },
    ["terminal.integrated.tabs.defaultColor" /* TerminalSettingId.TabsDefaultColor */]: {
        description: localize('terminal.integrated.tabs.defaultColor', "A theme color ID to associate with terminal icons by default."),
        ...terminalColorSchema,
        scope: 5 /* ConfigurationScope.RESOURCE */
    },
    ["terminal.integrated.tabs.defaultIcon" /* TerminalSettingId.TabsDefaultIcon */]: {
        description: localize('terminal.integrated.tabs.defaultIcon', "A codicon ID to associate with terminal icons by default."),
        ...terminalIconSchema,
        default: Codicon.terminal.id,
        scope: 5 /* ConfigurationScope.RESOURCE */
    },
    ["terminal.integrated.tabs.enabled" /* TerminalSettingId.TabsEnabled */]: {
        description: localize('terminal.integrated.tabs.enabled', 'Controls whether terminal tabs display as a list to the side of the terminal. When this is disabled a dropdown will display instead.'),
        type: 'boolean',
        default: true,
    },
    ["terminal.integrated.tabs.enableAnimation" /* TerminalSettingId.TabsEnableAnimation */]: {
        description: localize('terminal.integrated.tabs.enableAnimation', 'Controls whether terminal tab statuses support animation (eg. in progress tasks).'),
        type: 'boolean',
        default: true,
    },
    ["terminal.integrated.tabs.hideCondition" /* TerminalSettingId.TabsHideCondition */]: {
        description: localize('terminal.integrated.tabs.hideCondition', 'Controls whether the terminal tabs view will hide under certain conditions.'),
        type: 'string',
        enum: ['never', 'singleTerminal', 'singleGroup'],
        enumDescriptions: [
            localize('terminal.integrated.tabs.hideCondition.never', "Never hide the terminal tabs view"),
            localize('terminal.integrated.tabs.hideCondition.singleTerminal', "Hide the terminal tabs view when there is only a single terminal opened"),
            localize('terminal.integrated.tabs.hideCondition.singleGroup', "Hide the terminal tabs view when there is only a single terminal group opened"),
        ],
        default: 'singleTerminal',
    },
    ["terminal.integrated.tabs.showActiveTerminal" /* TerminalSettingId.TabsShowActiveTerminal */]: {
        description: localize('terminal.integrated.tabs.showActiveTerminal', 'Shows the active terminal information in the view. This is particularly useful when the title within the tabs aren\'t visible.'),
        type: 'string',
        enum: ['always', 'singleTerminal', 'singleTerminalOrNarrow', 'never'],
        enumDescriptions: [
            localize('terminal.integrated.tabs.showActiveTerminal.always', "Always show the active terminal"),
            localize('terminal.integrated.tabs.showActiveTerminal.singleTerminal', "Show the active terminal when it is the only terminal opened"),
            localize('terminal.integrated.tabs.showActiveTerminal.singleTerminalOrNarrow', "Show the active terminal when it is the only terminal opened or when the tabs view is in its narrow textless state"),
            localize('terminal.integrated.tabs.showActiveTerminal.never', "Never show the active terminal"),
        ],
        default: 'singleTerminalOrNarrow',
    },
    ["terminal.integrated.tabs.showActions" /* TerminalSettingId.TabsShowActions */]: {
        description: localize('terminal.integrated.tabs.showActions', 'Controls whether terminal split and kill buttons are displays next to the new terminal button.'),
        type: 'string',
        enum: ['always', 'singleTerminal', 'singleTerminalOrNarrow', 'never'],
        enumDescriptions: [
            localize('terminal.integrated.tabs.showActions.always', "Always show the actions"),
            localize('terminal.integrated.tabs.showActions.singleTerminal', "Show the actions when it is the only terminal opened"),
            localize('terminal.integrated.tabs.showActions.singleTerminalOrNarrow', "Show the actions when it is the only terminal opened or when the tabs view is in its narrow textless state"),
            localize('terminal.integrated.tabs.showActions.never', "Never show the actions"),
        ],
        default: 'singleTerminalOrNarrow',
    },
    ["terminal.integrated.tabs.location" /* TerminalSettingId.TabsLocation */]: {
        type: 'string',
        enum: ['left', 'right'],
        enumDescriptions: [
            localize('terminal.integrated.tabs.location.left', "Show the terminal tabs view to the left of the terminal"),
            localize('terminal.integrated.tabs.location.right', "Show the terminal tabs view to the right of the terminal")
        ],
        default: 'right',
        description: localize('terminal.integrated.tabs.location', "Controls the location of the terminal tabs, either to the left or right of the actual terminal(s).")
    },
    ["terminal.integrated.defaultLocation" /* TerminalSettingId.DefaultLocation */]: {
        type: 'string',
        enum: ["editor" /* TerminalLocationConfigValue.Editor */, "view" /* TerminalLocationConfigValue.TerminalView */],
        enumDescriptions: [
            localize('terminal.integrated.defaultLocation.editor', "Create terminals in the editor"),
            localize('terminal.integrated.defaultLocation.view', "Create terminals in the terminal view")
        ],
        default: 'view',
        description: localize('terminal.integrated.defaultLocation', "Controls where newly created terminals will appear.")
    },
    ["terminal.integrated.tabs.focusMode" /* TerminalSettingId.TabsFocusMode */]: {
        type: 'string',
        enum: ['singleClick', 'doubleClick'],
        enumDescriptions: [
            localize('terminal.integrated.tabs.focusMode.singleClick', "Focus the terminal when clicking a terminal tab"),
            localize('terminal.integrated.tabs.focusMode.doubleClick', "Focus the terminal when double-clicking a terminal tab")
        ],
        default: 'doubleClick',
        description: localize('terminal.integrated.tabs.focusMode', "Controls whether focusing the terminal of a tab happens on double or single click.")
    },
    ["terminal.integrated.macOptionIsMeta" /* TerminalSettingId.MacOptionIsMeta */]: {
        description: localize('terminal.integrated.macOptionIsMeta', "Controls whether to treat the option key as the meta key in the terminal on macOS."),
        type: 'boolean',
        default: false
    },
    ["terminal.integrated.macOptionClickForcesSelection" /* TerminalSettingId.MacOptionClickForcesSelection */]: {
        description: localize('terminal.integrated.macOptionClickForcesSelection', "Controls whether to force selection when using Option+click on macOS. This will force a regular (line) selection and disallow the use of column selection mode. This enables copying and pasting using the regular terminal selection, for example, when mouse mode is enabled in tmux."),
        type: 'boolean',
        default: false
    },
    ["terminal.integrated.altClickMovesCursor" /* TerminalSettingId.AltClickMovesCursor */]: {
        markdownDescription: localize('terminal.integrated.altClickMovesCursor', "If enabled, alt/option + click will reposition the prompt cursor to underneath the mouse when {0} is set to {1} (the default value). This may not work reliably depending on your shell.", '`#editor.multiCursorModifier#`', '`\'alt\'`'),
        type: 'boolean',
        default: true
    },
    ["terminal.integrated.copyOnSelection" /* TerminalSettingId.CopyOnSelection */]: {
        description: localize('terminal.integrated.copyOnSelection', "Controls whether text selected in the terminal will be copied to the clipboard."),
        type: 'boolean',
        default: false
    },
    ["terminal.integrated.enableMultiLinePasteWarning" /* TerminalSettingId.EnableMultiLinePasteWarning */]: {
        markdownDescription: localize('terminal.integrated.enableMultiLinePasteWarning', "Controls whether to show a warning dialog when pasting multiple lines into the terminal."),
        type: 'string',
        enum: ['auto', 'always', 'never'],
        markdownEnumDescriptions: [
            localize('terminal.integrated.enableMultiLinePasteWarning.auto', "Enable the warning but do not show it when:\n\n- Bracketed paste mode is enabled (the shell supports multi-line paste natively)\n- The paste is handled by the shell's readline (in the case of pwsh)"),
            localize('terminal.integrated.enableMultiLinePasteWarning.always', "Always show the warning if the text contains a new line."),
            localize('terminal.integrated.enableMultiLinePasteWarning.never', "Never show the warning.")
        ],
        default: 'auto'
    },
    ["terminal.integrated.drawBoldTextInBrightColors" /* TerminalSettingId.DrawBoldTextInBrightColors */]: {
        description: localize('terminal.integrated.drawBoldTextInBrightColors', "Controls whether bold text in the terminal will always use the \"bright\" ANSI color variant."),
        type: 'boolean',
        default: true
    },
    ["terminal.integrated.fontFamily" /* TerminalSettingId.FontFamily */]: {
        markdownDescription: localize('terminal.integrated.fontFamily', "Controls the font family of the terminal. Defaults to {0}'s value.", '`#editor.fontFamily#`'),
        type: 'string',
    },
    ["terminal.integrated.fontLigatures.enabled" /* TerminalSettingId.FontLigaturesEnabled */]: {
        markdownDescription: localize('terminal.integrated.fontLigatures.enabled', "Controls whether font ligatures are enabled in the terminal. Ligatures will only work if the configured {0} supports them.", `\`#${"terminal.integrated.fontFamily" /* TerminalSettingId.FontFamily */}#\``),
        type: 'boolean',
        default: false
    },
    ["terminal.integrated.fontLigatures.featureSettings" /* TerminalSettingId.FontLigaturesFeatureSettings */]: {
        markdownDescription: localize('terminal.integrated.fontLigatures.featureSettings', "Controls what font feature settings are used when ligatures are enabled, in the format of the `font-feature-settings` CSS property. Some examples which may be valid depending on the font:") + '\n\n- ' + [
            `\`"calt" off, "ss03"\``,
            `\`"liga" on\``,
            `\`"calt" off, "dlig" on\``
        ].join('\n- '),
        type: 'string',
        default: '"calt" on'
    },
    ["terminal.integrated.fontLigatures.fallbackLigatures" /* TerminalSettingId.FontLigaturesFallbackLigatures */]: {
        markdownDescription: localize('terminal.integrated.fontLigatures.fallbackLigatures', "When {0} is enabled and the particular {1} cannot be parsed, this is the set of character sequences that will always be drawn together. This allows the use of a fixed set of ligatures even when the font isn't supported.", `\`#${"terminal.integrated.gpuAcceleration" /* TerminalSettingId.GpuAcceleration */}#\``, `\`#${"terminal.integrated.fontFamily" /* TerminalSettingId.FontFamily */}#\``),
        type: 'array',
        items: [{ type: 'string' }],
        default: [
            '<--', '<---', '<<-', '<-', '->', '->>', '-->', '--->',
            '<==', '<===', '<<=', '<=', '=>', '=>>', '==>', '===>', '>=', '>>=',
            '<->', '<-->', '<--->', '<---->', '<=>', '<==>', '<===>', '<====>', '::', ':::',
            '<~~', '</', '</>', '/>', '~~>', '==', '!=', '/=', '~=', '<>', '===', '!==', '!===',
            '<:', ':=', '*=', '*+', '<*', '<*>', '*>', '<|', '<|>', '|>', '+*', '=*', '=:', ':>',
            '/*', '*/', '+++', '<!--', '<!---'
        ]
    },
    ["terminal.integrated.fontSize" /* TerminalSettingId.FontSize */]: {
        description: localize('terminal.integrated.fontSize', "Controls the font size in pixels of the terminal."),
        type: 'number',
        default: defaultTerminalFontSize,
        minimum: 6,
        maximum: 100
    },
    ["terminal.integrated.letterSpacing" /* TerminalSettingId.LetterSpacing */]: {
        description: localize('terminal.integrated.letterSpacing', "Controls the letter spacing of the terminal. This is an integer value which represents the number of additional pixels to add between characters."),
        type: 'number',
        default: DEFAULT_LETTER_SPACING
    },
    ["terminal.integrated.lineHeight" /* TerminalSettingId.LineHeight */]: {
        description: localize('terminal.integrated.lineHeight', "Controls the line height of the terminal. This number is multiplied by the terminal font size to get the actual line-height in pixels."),
        type: 'number',
        default: DEFAULT_LINE_HEIGHT
    },
    ["terminal.integrated.minimumContrastRatio" /* TerminalSettingId.MinimumContrastRatio */]: {
        markdownDescription: localize('terminal.integrated.minimumContrastRatio', "When set, the foreground color of each cell will change to try meet the contrast ratio specified. Note that this will not apply to `powerline` characters per #146406. Example values:\n\n- 1: Do nothing and use the standard theme colors.\n- 4.5: [WCAG AA compliance (minimum)](https://www.w3.org/TR/UNDERSTANDING-WCAG20/visual-audio-contrast-contrast.html) (default).\n- 7: [WCAG AAA compliance (enhanced)](https://www.w3.org/TR/UNDERSTANDING-WCAG20/visual-audio-contrast7.html).\n- 21: White on black or black on white."),
        type: 'number',
        default: 4.5,
        tags: ['accessibility']
    },
    ["terminal.integrated.tabStopWidth" /* TerminalSettingId.TabStopWidth */]: {
        markdownDescription: localize('terminal.integrated.tabStopWidth', "The number of cells in a tab stop."),
        type: 'number',
        minimum: 1,
        default: 8
    },
    ["terminal.integrated.fastScrollSensitivity" /* TerminalSettingId.FastScrollSensitivity */]: {
        markdownDescription: localize('terminal.integrated.fastScrollSensitivity', "Scrolling speed multiplier when pressing `Alt`."),
        type: 'number',
        default: 5
    },
    ["terminal.integrated.mouseWheelScrollSensitivity" /* TerminalSettingId.MouseWheelScrollSensitivity */]: {
        markdownDescription: localize('terminal.integrated.mouseWheelScrollSensitivity', "A multiplier to be used on the `deltaY` of mouse wheel scroll events."),
        type: 'number',
        default: 1
    },
    ["terminal.integrated.bellDuration" /* TerminalSettingId.BellDuration */]: {
        markdownDescription: localize('terminal.integrated.bellDuration', "The number of milliseconds to show the bell within a terminal tab when triggered."),
        type: 'number',
        default: 1000
    },
    ["terminal.integrated.fontWeight" /* TerminalSettingId.FontWeight */]: {
        'anyOf': [
            {
                type: 'number',
                minimum: MINIMUM_FONT_WEIGHT,
                maximum: MAXIMUM_FONT_WEIGHT,
                errorMessage: localize('terminal.integrated.fontWeightError', "Only \"normal\" and \"bold\" keywords or numbers between 1 and 1000 are allowed.")
            },
            {
                type: 'string',
                pattern: '^(normal|bold|1000|[1-9][0-9]{0,2})$'
            },
            {
                enum: SUGGESTIONS_FONT_WEIGHT,
            }
        ],
        description: localize('terminal.integrated.fontWeight', "The font weight to use within the terminal for non-bold text. Accepts \"normal\" and \"bold\" keywords or numbers between 1 and 1000."),
        default: 'normal'
    },
    ["terminal.integrated.fontWeightBold" /* TerminalSettingId.FontWeightBold */]: {
        'anyOf': [
            {
                type: 'number',
                minimum: MINIMUM_FONT_WEIGHT,
                maximum: MAXIMUM_FONT_WEIGHT,
                errorMessage: localize('terminal.integrated.fontWeightError', "Only \"normal\" and \"bold\" keywords or numbers between 1 and 1000 are allowed.")
            },
            {
                type: 'string',
                pattern: '^(normal|bold|1000|[1-9][0-9]{0,2})$'
            },
            {
                enum: SUGGESTIONS_FONT_WEIGHT,
            }
        ],
        description: localize('terminal.integrated.fontWeightBold', "The font weight to use within the terminal for bold text. Accepts \"normal\" and \"bold\" keywords or numbers between 1 and 1000."),
        default: 'bold'
    },
    ["terminal.integrated.cursorBlinking" /* TerminalSettingId.CursorBlinking */]: {
        description: localize('terminal.integrated.cursorBlinking', "Controls whether the terminal cursor blinks."),
        type: 'boolean',
        default: false
    },
    ["terminal.integrated.cursorStyle" /* TerminalSettingId.CursorStyle */]: {
        description: localize('terminal.integrated.cursorStyle', "Controls the style of terminal cursor when the terminal is focused."),
        enum: ['block', 'line', 'underline'],
        default: 'block'
    },
    ["terminal.integrated.cursorStyleInactive" /* TerminalSettingId.CursorStyleInactive */]: {
        description: localize('terminal.integrated.cursorStyleInactive', "Controls the style of terminal cursor when the terminal is not focused."),
        enum: ['outline', 'block', 'line', 'underline', 'none'],
        default: 'outline'
    },
    ["terminal.integrated.cursorWidth" /* TerminalSettingId.CursorWidth */]: {
        markdownDescription: localize('terminal.integrated.cursorWidth', "Controls the width of the cursor when {0} is set to {1}.", '`#terminal.integrated.cursorStyle#`', '`line`'),
        type: 'number',
        default: 1
    },
    ["terminal.integrated.scrollback" /* TerminalSettingId.Scrollback */]: {
        description: localize('terminal.integrated.scrollback', "Controls the maximum number of lines the terminal keeps in its buffer. We pre-allocate memory based on this value in order to ensure a smooth experience. As such, as the value increases, so will the amount of memory."),
        type: 'number',
        default: 1000
    },
    ["terminal.integrated.detectLocale" /* TerminalSettingId.DetectLocale */]: {
        markdownDescription: localize('terminal.integrated.detectLocale', "Controls whether to detect and set the `$LANG` environment variable to a UTF-8 compliant option since VS Code's terminal only supports UTF-8 encoded data coming from the shell."),
        type: 'string',
        enum: ['auto', 'off', 'on'],
        markdownEnumDescriptions: [
            localize('terminal.integrated.detectLocale.auto', "Set the `$LANG` environment variable if the existing variable does not exist or it does not end in `'.UTF-8'`."),
            localize('terminal.integrated.detectLocale.off', "Do not set the `$LANG` environment variable."),
            localize('terminal.integrated.detectLocale.on', "Always set the `$LANG` environment variable.")
        ],
        default: 'auto'
    },
    ["terminal.integrated.gpuAcceleration" /* TerminalSettingId.GpuAcceleration */]: {
        type: 'string',
        enum: ['auto', 'on', 'off'],
        markdownEnumDescriptions: [
            localize('terminal.integrated.gpuAcceleration.auto', "Let VS Code detect which renderer will give the best experience."),
            localize('terminal.integrated.gpuAcceleration.on', "Enable GPU acceleration within the terminal."),
            localize('terminal.integrated.gpuAcceleration.off', "Disable GPU acceleration within the terminal. The terminal will render much slower when GPU acceleration is off but it should reliably work on all systems."),
        ],
        default: 'auto',
        description: localize('terminal.integrated.gpuAcceleration', "Controls whether the terminal will leverage the GPU to do its rendering.")
    },
    ["terminal.integrated.tabs.separator" /* TerminalSettingId.TerminalTitleSeparator */]: {
        'type': 'string',
        'default': ' - ',
        'markdownDescription': localize("terminal.integrated.tabs.separator", "Separator used by {0} and {1}.", `\`#${"terminal.integrated.tabs.title" /* TerminalSettingId.TerminalTitle */}#\``, `\`#${"terminal.integrated.tabs.description" /* TerminalSettingId.TerminalDescription */}#\``)
    },
    ["terminal.integrated.tabs.title" /* TerminalSettingId.TerminalTitle */]: {
        'type': 'string',
        'default': '${process}',
        'markdownDescription': terminalTitle
    },
    ["terminal.integrated.tabs.description" /* TerminalSettingId.TerminalDescription */]: {
        'type': 'string',
        'default': '${task}${separator}${local}${separator}${cwdFolder}',
        'markdownDescription': terminalDescription
    },
    ["terminal.integrated.rightClickBehavior" /* TerminalSettingId.RightClickBehavior */]: {
        type: 'string',
        enum: ['default', 'copyPaste', 'paste', 'selectWord', 'nothing'],
        enumDescriptions: [
            localize('terminal.integrated.rightClickBehavior.default', "Show the context menu."),
            localize('terminal.integrated.rightClickBehavior.copyPaste', "Copy when there is a selection, otherwise paste."),
            localize('terminal.integrated.rightClickBehavior.paste', "Paste on right click."),
            localize('terminal.integrated.rightClickBehavior.selectWord', "Select the word under the cursor and show the context menu."),
            localize('terminal.integrated.rightClickBehavior.nothing', "Do nothing and pass event to terminal.")
        ],
        default: isMacintosh ? 'selectWord' : isWindows ? 'copyPaste' : 'default',
        description: localize('terminal.integrated.rightClickBehavior', "Controls how terminal reacts to right click.")
    },
    ["terminal.integrated.middleClickBehavior" /* TerminalSettingId.MiddleClickBehavior */]: {
        type: 'string',
        enum: ['default', 'paste'],
        enumDescriptions: [
            localize('terminal.integrated.middleClickBehavior.default', "The platform default to focus the terminal. On Linux this will also paste the selection."),
            localize('terminal.integrated.middleClickBehavior.paste', "Paste on middle click."),
        ],
        default: 'default',
        description: localize('terminal.integrated.middleClickBehavior', "Controls how terminal reacts to middle click.")
    },
    ["terminal.integrated.cwd" /* TerminalSettingId.Cwd */]: {
        restricted: true,
        description: localize('terminal.integrated.cwd', "An explicit start path where the terminal will be launched, this is used as the current working directory (cwd) for the shell process. This may be particularly useful in workspace settings if the root directory is not a convenient cwd."),
        type: 'string',
        default: undefined,
        scope: 5 /* ConfigurationScope.RESOURCE */
    },
    ["terminal.integrated.confirmOnExit" /* TerminalSettingId.ConfirmOnExit */]: {
        description: localize('terminal.integrated.confirmOnExit', "Controls whether to confirm when the window closes if there are active terminal sessions. Background terminals like those launched by some extensions will not trigger the confirmation."),
        type: 'string',
        enum: ['never', 'always', 'hasChildProcesses'],
        enumDescriptions: [
            localize('terminal.integrated.confirmOnExit.never', "Never confirm."),
            localize('terminal.integrated.confirmOnExit.always', "Always confirm if there are terminals."),
            localize('terminal.integrated.confirmOnExit.hasChildProcesses', "Confirm if there are any terminals that have child processes."),
        ],
        default: 'never'
    },
    ["terminal.integrated.confirmOnKill" /* TerminalSettingId.ConfirmOnKill */]: {
        description: localize('terminal.integrated.confirmOnKill', "Controls whether to confirm killing terminals when they have child processes. When set to editor, terminals in the editor area will be marked as changed when they have child processes. Note that child process detection may not work well for shells like Git Bash which don't run their processes as child processes of the shell. Background terminals like those launched by some extensions will not trigger the confirmation."),
        type: 'string',
        enum: ['never', 'editor', 'panel', 'always'],
        enumDescriptions: [
            localize('terminal.integrated.confirmOnKill.never', "Never confirm."),
            localize('terminal.integrated.confirmOnKill.editor', "Confirm if the terminal is in the editor."),
            localize('terminal.integrated.confirmOnKill.panel', "Confirm if the terminal is in the panel."),
            localize('terminal.integrated.confirmOnKill.always', "Confirm if the terminal is either in the editor or panel."),
        ],
        default: 'editor'
    },
    ["terminal.integrated.enableBell" /* TerminalSettingId.EnableBell */]: {
        markdownDeprecationMessage: localize('terminal.integrated.enableBell', "This is now deprecated. Instead use the `terminal.integrated.enableVisualBell` and `accessibility.signals.terminalBell` settings."),
        type: 'boolean',
        default: false
    },
    ["terminal.integrated.enableVisualBell" /* TerminalSettingId.EnableVisualBell */]: {
        description: localize('terminal.integrated.enableVisualBell', "Controls whether the visual terminal bell is enabled. This shows up next to the terminal's name."),
        type: 'boolean',
        default: false
    },
    ["terminal.integrated.commandsToSkipShell" /* TerminalSettingId.CommandsToSkipShell */]: {
        markdownDescription: localize('terminal.integrated.commandsToSkipShell', "A set of command IDs whose keybindings will not be sent to the shell but instead always be handled by VS Code. This allows keybindings that would normally be consumed by the shell to act instead the same as when the terminal is not focused, for example `Ctrl+P` to launch Quick Open.\n\n&nbsp;\n\nMany commands are skipped by default. To override a default and pass that command's keybinding to the shell instead, add the command prefixed with the `-` character. For example add `-workbench.action.quickOpen` to allow `Ctrl+P` to reach the shell.\n\n&nbsp;\n\nThe following list of default skipped commands is truncated when viewed in Settings Editor. To see the full list, {1} and search for the first command from the list below.\n\n&nbsp;\n\nDefault Skipped Commands:\n\n{0}", DEFAULT_COMMANDS_TO_SKIP_SHELL.sort().map(command => `- ${command}`).join('\n'), `[${localize('openDefaultSettingsJson', "open the default settings JSON")}](command:workbench.action.openRawDefaultSettings '${localize('openDefaultSettingsJson.capitalized', "Open Default Settings (JSON)")}')`),
        type: 'array',
        items: {
            type: 'string'
        },
        default: []
    },
    ["terminal.integrated.allowChords" /* TerminalSettingId.AllowChords */]: {
        markdownDescription: localize('terminal.integrated.allowChords', "Whether or not to allow chord keybindings in the terminal. Note that when this is true and the keystroke results in a chord it will bypass {0}, setting this to false is particularly useful when you want ctrl+k to go to your shell (not VS Code).", '`#terminal.integrated.commandsToSkipShell#`'),
        type: 'boolean',
        default: true
    },
    ["terminal.integrated.allowMnemonics" /* TerminalSettingId.AllowMnemonics */]: {
        markdownDescription: localize('terminal.integrated.allowMnemonics', "Whether to allow menubar mnemonics (for example Alt+F) to trigger the open of the menubar. Note that this will cause all alt keystrokes to skip the shell when true. This does nothing on macOS."),
        type: 'boolean',
        default: false
    },
    ["terminal.integrated.env.osx" /* TerminalSettingId.EnvMacOs */]: {
        restricted: true,
        markdownDescription: localize('terminal.integrated.env.osx', "Object with environment variables that will be added to the VS Code process to be used by the terminal on macOS. Set to `null` to delete the environment variable."),
        type: 'object',
        additionalProperties: {
            type: ['string', 'null']
        },
        default: {}
    },
    ["terminal.integrated.env.linux" /* TerminalSettingId.EnvLinux */]: {
        restricted: true,
        markdownDescription: localize('terminal.integrated.env.linux', "Object with environment variables that will be added to the VS Code process to be used by the terminal on Linux. Set to `null` to delete the environment variable."),
        type: 'object',
        additionalProperties: {
            type: ['string', 'null']
        },
        default: {}
    },
    ["terminal.integrated.env.windows" /* TerminalSettingId.EnvWindows */]: {
        restricted: true,
        markdownDescription: localize('terminal.integrated.env.windows', "Object with environment variables that will be added to the VS Code process to be used by the terminal on Windows. Set to `null` to delete the environment variable."),
        type: 'object',
        additionalProperties: {
            type: ['string', 'null']
        },
        default: {}
    },
    ["terminal.integrated.environmentChangesRelaunch" /* TerminalSettingId.EnvironmentChangesRelaunch */]: {
        markdownDescription: localize('terminal.integrated.environmentChangesRelaunch', "Whether to relaunch terminals automatically if extensions want to contribute to their environment and have not been interacted with yet."),
        type: 'boolean',
        default: true
    },
    ["terminal.integrated.showExitAlert" /* TerminalSettingId.ShowExitAlert */]: {
        description: localize('terminal.integrated.showExitAlert', "Controls whether to show the alert \"The terminal process terminated with exit code\" when exit code is non-zero."),
        type: 'boolean',
        default: true
    },
    ["terminal.integrated.windowsUseConptyDll" /* TerminalSettingId.WindowsUseConptyDll */]: {
        markdownDescription: localize('terminal.integrated.windowsUseConptyDll', "Whether to use the experimental conpty.dll (v1.22.250204002) shipped with VS Code, instead of the one bundled with Windows."),
        type: 'boolean',
        tags: ['preview'],
        default: false
    },
    ["terminal.integrated.splitCwd" /* TerminalSettingId.SplitCwd */]: {
        description: localize('terminal.integrated.splitCwd', "Controls the working directory a split terminal starts with."),
        type: 'string',
        enum: ['workspaceRoot', 'initial', 'inherited'],
        enumDescriptions: [
            localize('terminal.integrated.splitCwd.workspaceRoot', "A new split terminal will use the workspace root as the working directory. In a multi-root workspace a choice for which root folder to use is offered."),
            localize('terminal.integrated.splitCwd.initial', "A new split terminal will use the working directory that the parent terminal started with."),
            localize('terminal.integrated.splitCwd.inherited', "On macOS and Linux, a new split terminal will use the working directory of the parent terminal. On Windows, this behaves the same as initial."),
        ],
        default: 'inherited'
    },
    ["terminal.integrated.windowsEnableConpty" /* TerminalSettingId.WindowsEnableConpty */]: {
        description: localize('terminal.integrated.windowsEnableConpty', "Whether to use ConPTY for Windows terminal process communication (requires Windows 10 build number 18309+). Winpty will be used if this is false."),
        type: 'boolean',
        default: true
    },
    ["terminal.integrated.wordSeparators" /* TerminalSettingId.WordSeparators */]: {
        markdownDescription: localize('terminal.integrated.wordSeparators', "A string containing all characters to be considered word separators when double-clicking to select word and in the fallback 'word' link detection. Since this is used for link detection, including characters such as `:` that are used when detecting links will cause the line and column part of links like `file:10:5` to be ignored."),
        type: 'string',
        // allow-any-unicode-next-line
        default: ' ()[]{}\',"`─‘’“”|'
    },
    ["terminal.integrated.enableFileLinks" /* TerminalSettingId.EnableFileLinks */]: {
        description: localize('terminal.integrated.enableFileLinks', "Whether to enable file links in terminals. Links can be slow when working on a network drive in particular because each file link is verified against the file system. Changing this will take effect only in new terminals."),
        type: 'string',
        enum: ['off', 'on', 'notRemote'],
        enumDescriptions: [
            localize('enableFileLinks.off', "Always off."),
            localize('enableFileLinks.on', "Always on."),
            localize('enableFileLinks.notRemote', "Enable only when not in a remote workspace.")
        ],
        default: 'on'
    },
    ["terminal.integrated.allowedLinkSchemes" /* TerminalSettingId.AllowedLinkSchemes */]: {
        description: localize('terminal.integrated.allowedLinkSchemes', "An array of strings containing the URI schemes that the terminal is allowed to open links for. By default, only a small subset of possible schemes are allowed for security reasons."),
        type: 'array',
        items: {
            type: 'string'
        },
        default: [
            'file',
            'http',
            'https',
            'mailto',
            'vscode',
            'vscode-insiders',
        ]
    },
    ["terminal.integrated.unicodeVersion" /* TerminalSettingId.UnicodeVersion */]: {
        type: 'string',
        enum: ['6', '11'],
        enumDescriptions: [
            localize('terminal.integrated.unicodeVersion.six', "Version 6 of Unicode. This is an older version which should work better on older systems."),
            localize('terminal.integrated.unicodeVersion.eleven', "Version 11 of Unicode. This version provides better support on modern systems that use modern versions of Unicode.")
        ],
        default: '11',
        description: localize('terminal.integrated.unicodeVersion', "Controls what version of Unicode to use when evaluating the width of characters in the terminal. If you experience emoji or other wide characters not taking up the right amount of space or backspace either deleting too much or too little then you may want to try tweaking this setting.")
    },
    ["terminal.integrated.enablePersistentSessions" /* TerminalSettingId.EnablePersistentSessions */]: {
        description: localize('terminal.integrated.enablePersistentSessions', "Persist terminal sessions/history for the workspace across window reloads."),
        type: 'boolean',
        default: true
    },
    ["terminal.integrated.persistentSessionReviveProcess" /* TerminalSettingId.PersistentSessionReviveProcess */]: {
        markdownDescription: localize('terminal.integrated.persistentSessionReviveProcess', "When the terminal process must be shut down (for example on window or application close), this determines when the previous terminal session contents/history should be restored and processes be recreated when the workspace is next opened.\n\nCaveats:\n\n- Restoring of the process current working directory depends on whether it is supported by the shell.\n- Time to persist the session during shutdown is limited, so it may be aborted when using high-latency remote connections."),
        type: 'string',
        enum: ['onExit', 'onExitAndWindowClose', 'never'],
        markdownEnumDescriptions: [
            localize('terminal.integrated.persistentSessionReviveProcess.onExit', "Revive the processes after the last window is closed on Windows/Linux or when the `workbench.action.quit` command is triggered (command palette, keybinding, menu)."),
            localize('terminal.integrated.persistentSessionReviveProcess.onExitAndWindowClose', "Revive the processes after the last window is closed on Windows/Linux or when the `workbench.action.quit` command is triggered (command palette, keybinding, menu), or when the window is closed."),
            localize('terminal.integrated.persistentSessionReviveProcess.never', "Never restore the terminal buffers or recreate the process.")
        ],
        default: 'onExit'
    },
    ["terminal.integrated.hideOnStartup" /* TerminalSettingId.HideOnStartup */]: {
        description: localize('terminal.integrated.hideOnStartup', "Whether to hide the terminal view on startup, avoiding creating a terminal when there are no persistent sessions."),
        type: 'string',
        enum: ['never', 'whenEmpty', 'always'],
        markdownEnumDescriptions: [
            localize('hideOnStartup.never', "Never hide the terminal view on startup."),
            localize('hideOnStartup.whenEmpty', "Only hide the terminal when there are no persistent sessions restored."),
            localize('hideOnStartup.always', "Always hide the terminal, even when there are persistent sessions restored.")
        ],
        default: 'never'
    },
    ["terminal.integrated.hideOnLastClosed" /* TerminalSettingId.HideOnLastClosed */]: {
        description: localize('terminal.integrated.hideOnLastClosed', "Whether to hide the terminal view when the last terminal is closed. This will only happen when the terminal is the only visible view in the view container."),
        type: 'boolean',
        default: true
    },
    ["terminal.integrated.customGlyphs" /* TerminalSettingId.CustomGlyphs */]: {
        markdownDescription: localize('terminal.integrated.customGlyphs', "Whether to draw custom glyphs for block element and box drawing characters instead of using the font, which typically yields better rendering with continuous lines. Note that this doesn't work when {0} is disabled.", `\`#${"terminal.integrated.gpuAcceleration" /* TerminalSettingId.GpuAcceleration */}#\``),
        type: 'boolean',
        default: true
    },
    ["terminal.integrated.rescaleOverlappingGlyphs" /* TerminalSettingId.RescaleOverlappingGlyphs */]: {
        markdownDescription: localize('terminal.integrated.rescaleOverlappingGlyphs', "Whether to rescale glyphs horizontally that are a single cell wide but have glyphs that would overlap following cell(s). This typically happens for ambiguous width characters (eg. the roman numeral characters U+2160+) which aren't featured in monospace fonts. Emoji glyphs are never rescaled."),
        type: 'boolean',
        default: true
    },
    ["terminal.integrated.shellIntegration.enabled" /* TerminalSettingId.ShellIntegrationEnabled */]: {
        restricted: true,
        markdownDescription: localize('terminal.integrated.shellIntegration.enabled', "Determines whether or not shell integration is auto-injected to support features like enhanced command tracking and current working directory detection. \n\nShell integration works by injecting the shell with a startup script. The script gives VS Code insight into what is happening within the terminal.\n\nSupported shells:\n\n- Linux/macOS: bash, fish, pwsh, zsh\n - Windows: pwsh, git bash\n\nThis setting applies only when terminals are created, so you will need to restart your terminals for it to take effect.\n\n Note that the script injection may not work if you have custom arguments defined in the terminal profile, have enabled {1}, have a [complex bash `PROMPT_COMMAND`](https://code.visualstudio.com/docs/editor/integrated-terminal#_complex-bash-promptcommand), or other unsupported setup. To disable decorations, see {0}", '`#terminal.integrated.shellIntegration.decorationsEnabled#`', '`#editor.accessibilitySupport#`'),
        type: 'boolean',
        default: true
    },
    ["terminal.integrated.shellIntegration.decorationsEnabled" /* TerminalSettingId.ShellIntegrationDecorationsEnabled */]: {
        restricted: true,
        markdownDescription: localize('terminal.integrated.shellIntegration.decorationsEnabled', "When shell integration is enabled, adds a decoration for each command."),
        type: 'string',
        enum: ['both', 'gutter', 'overviewRuler', 'never'],
        enumDescriptions: [
            localize('terminal.integrated.shellIntegration.decorationsEnabled.both', "Show decorations in the gutter (left) and overview ruler (right)"),
            localize('terminal.integrated.shellIntegration.decorationsEnabled.gutter', "Show gutter decorations to the left of the terminal"),
            localize('terminal.integrated.shellIntegration.decorationsEnabled.overviewRuler', "Show overview ruler decorations to the right of the terminal"),
            localize('terminal.integrated.shellIntegration.decorationsEnabled.never', "Do not show decorations"),
        ],
        default: 'both'
    },
    ["terminal.integrated.shellIntegration.timeout" /* TerminalSettingId.ShellIntegrationTimeout */]: {
        restricted: true,
        markdownDescription: localize('terminal.integrated.shellIntegration.timeout', "Configures the duration in milliseconds to wait for shell integration after launch before declaring it's not there. Set to {0} to wait the minimum time (500ms), the default value {1} means the wait time is variable based on whether shell integration injection is enabled and whether it's a remote window. Consider setting this to a small value if you intentionally disabled shell integration, or a large value if your shell starts very slowly.", '`0`', '`-1`'),
        type: 'integer',
        minimum: -1,
        maximum: 60000,
        default: -1
    },
    ["terminal.integrated.shellIntegration.quickFixEnabled" /* TerminalSettingId.ShellIntegrationQuickFixEnabled */]: {
        restricted: true,
        markdownDescription: localize('terminal.integrated.shellIntegration.quickFixEnabled', "When shell integration is enabled, enables quick fixes for terminal commands that appear as a lightbulb or sparkle icon to the left of the prompt."),
        type: 'boolean',
        default: true
    },
    ["terminal.integrated.shellIntegration.environmentReporting" /* TerminalSettingId.ShellIntegrationEnvironmentReporting */]: {
        markdownDescription: localize('terminal.integrated.shellIntegration.environmentReporting', "Controls whether to report the shell environment, enabling its use in features such as {0}. This may cause a slowdown when printing your shell's prompt.", `\`#${"terminal.integrated.suggest.enabled" /* TerminalContribSettingId.SuggestEnabled */}#\``),
        type: 'boolean',
        default: product.quality !== 'stable'
    },
    ["terminal.integrated.smoothScrolling" /* TerminalSettingId.SmoothScrolling */]: {
        markdownDescription: localize('terminal.integrated.smoothScrolling', "Controls whether the terminal will scroll using an animation."),
        type: 'boolean',
        default: false
    },
    ["terminal.integrated.ignoreBracketedPasteMode" /* TerminalSettingId.IgnoreBracketedPasteMode */]: {
        markdownDescription: localize('terminal.integrated.ignoreBracketedPasteMode', "Controls whether the terminal will ignore bracketed paste mode even if the terminal was put into the mode, omitting the {0} and {1} sequences when pasting. This is useful when the shell is not respecting the mode which can happen in sub-shells for example.", '`\\x1b[200~`', '`\\x1b[201~`'),
        type: 'boolean',
        default: false
    },
    ["terminal.integrated.enableImages" /* TerminalSettingId.EnableImages */]: {
        restricted: true,
        markdownDescription: localize('terminal.integrated.enableImages', "Enables image support in the terminal, this will only work when {0} is enabled. Both sixel and iTerm's inline image protocol are supported on Linux and macOS. This will only work on Windows for versions of ConPTY >= v2 which is shipped with Windows itself, see also {1}. Images will currently not be restored between window reloads/reconnects.", `\`#${"terminal.integrated.gpuAcceleration" /* TerminalSettingId.GpuAcceleration */}#\``, `\`#${"terminal.integrated.windowsUseConptyDll" /* TerminalSettingId.WindowsUseConptyDll */}#\``),
        type: 'boolean',
        default: false
    },
    ["terminal.integrated.focusAfterRun" /* TerminalSettingId.FocusAfterRun */]: {
        markdownDescription: localize('terminal.integrated.focusAfterRun', "Controls whether the terminal, accessible buffer, or neither will be focused after `Terminal: Run Selected Text In Active Terminal` has been run."),
        enum: ['terminal', 'accessible-buffer', 'none'],
        default: 'none',
        tags: ['accessibility'],
        markdownEnumDescriptions: [
            localize('terminal.integrated.focusAfterRun.terminal', "Always focus the terminal."),
            localize('terminal.integrated.focusAfterRun.accessible-buffer', "Always focus the accessible buffer."),
            localize('terminal.integrated.focusAfterRun.none', "Do nothing."),
        ]
    },
    ["terminal.integrated.developer.ptyHost.latency" /* TerminalSettingId.DeveloperPtyHostLatency */]: {
        description: localize('terminal.integrated.developer.ptyHost.latency', "Simulated latency in milliseconds applied to all calls made to the pty host. This is useful for testing terminal behavior under high latency conditions."),
        type: 'number',
        minimum: 0,
        default: 0,
        tags: ['advanced']
    },
    ["terminal.integrated.developer.ptyHost.startupDelay" /* TerminalSettingId.DeveloperPtyHostStartupDelay */]: {
        description: localize('terminal.integrated.developer.ptyHost.startupDelay', "Simulated startup delay in milliseconds for the pty host process. This is useful for testing terminal initialization under slow startup conditions."),
        type: 'number',
        minimum: 0,
        default: 0,
        tags: ['advanced']
    },
    ["terminal.integrated.developer.devMode" /* TerminalSettingId.DevMode */]: {
        description: localize('terminal.integrated.developer.devMode', "Enable developer mode for the terminal. This shows additional debug information and visualizations for shell integration sequences."),
        type: 'boolean',
        default: false,
        tags: ['advanced']
    },
    ...terminalContribConfiguration,
};
export async function registerTerminalConfiguration(getFontSnippets) {
    const configurationRegistry = Registry.as(Extensions.Configuration);
    configurationRegistry.registerConfiguration({
        id: 'terminal',
        order: 100,
        title: localize('terminalIntegratedConfigurationTitle', "Integrated Terminal"),
        type: 'object',
        properties: terminalConfiguration,
    });
    terminalConfiguration["terminal.integrated.fontFamily" /* TerminalSettingId.FontFamily */].defaultSnippets = await getFontSnippets();
}
Registry.as(WorkbenchExtensions.ConfigurationMigration)
    .registerConfigurationMigrations([{
        key: "terminal.integrated.enableBell" /* TerminalSettingId.EnableBell */,
        migrateFn: (enableBell, accessor) => {
            const configurationKeyValuePairs = [];
            let announcement = accessor('accessibility.signals.terminalBell')?.announcement ?? accessor('accessibility.alert.terminalBell');
            if (announcement !== undefined && !isString(announcement)) {
                announcement = announcement ? 'auto' : 'off';
            }
            configurationKeyValuePairs.push(['accessibility.signals.terminalBell', { value: { sound: enableBell ? 'on' : 'off', announcement } }]);
            configurationKeyValuePairs.push(["terminal.integrated.enableBell" /* TerminalSettingId.EnableBell */, { value: undefined }]);
            configurationKeyValuePairs.push(["terminal.integrated.enableVisualBell" /* TerminalSettingId.EnableVisualBell */, { value: enableBell }]);
            return configurationKeyValuePairs;
        }
    }]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDb25maWd1cmF0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbENvbmZpZ3VyYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRzlELE9BQU8sRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDN0UsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQXNCLFVBQVUsRUFBNkQsTUFBTSxvRUFBb0UsQ0FBQztBQUMvSyxPQUFPLE9BQU8sTUFBTSxnREFBZ0QsQ0FBQztBQUNyRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFFNUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLGtCQUFrQixFQUFFLE1BQU0sdUVBQXVFLENBQUM7QUFDaEksT0FBTyxFQUErRCxVQUFVLElBQUksbUJBQW1CLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsSixPQUFPLEVBQUUsNEJBQTRCLEVBQTRCLE1BQU0sOEJBQThCLENBQUM7QUFDdEcsT0FBTyxFQUFFLDhCQUE4QixFQUFFLHNCQUFzQixFQUFFLG1CQUFtQixFQUFFLG1CQUFtQixFQUFFLG1CQUFtQixFQUFFLHVCQUF1QixFQUFFLE1BQU0sZUFBZSxDQUFDO0FBRS9LLE1BQU0sbUJBQW1CLEdBQUcsTUFBTSxHQUFHO0lBQ3BDLGFBQWEsR0FBRyxRQUFRLENBQUMsS0FBSyxFQUFFLDJDQUEyQyxDQUFDO0lBQzVFLG1CQUFtQixHQUFHLFFBQVEsQ0FBQyxXQUFXLEVBQUUsbVBBQW1QLENB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