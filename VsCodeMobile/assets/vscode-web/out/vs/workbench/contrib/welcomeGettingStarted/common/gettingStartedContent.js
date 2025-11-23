/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import themePickerContent from './media/theme_picker.js';
import themePickerSmallContent from './media/theme_picker_small.js';
import notebookProfileContent from './media/notebookProfile.js';
import { localize } from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { NotebookSetting } from '../../notebook/common/notebookCommon.js';
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from '../../../../platform/accessibility/common/accessibility.js';
import product from '../../../../platform/product/common/product.js';
const defaultChat = {
    documentationUrl: product.defaultChatAgent?.documentationUrl ?? '',
    manageSettingsUrl: product.defaultChatAgent?.manageSettingsUrl ?? '',
    provider: product.defaultChatAgent?.provider ?? { default: { name: '' } },
    publicCodeMatchesUrl: product.defaultChatAgent?.publicCodeMatchesUrl ?? '',
    termsStatementUrl: product.defaultChatAgent?.termsStatementUrl ?? '',
    privacyStatementUrl: product.defaultChatAgent?.privacyStatementUrl ?? ''
};
export const copilotSettingsMessage = localize({ key: 'settings', comment: ['{Locked="["}', '{Locked="]({0})"}', '{Locked="]({1})"}'] }, "{0} Copilot may show [public code]({1}) suggestions and use your data to improve the product. You can change these [settings]({2}) anytime.", defaultChat.provider.default.name, defaultChat.publicCodeMatchesUrl, defaultChat.manageSettingsUrl);
class GettingStartedContentProviderRegistry {
    constructor() {
        this.providers = new Map();
    }
    registerProvider(moduleId, provider) {
        this.providers.set(moduleId, provider);
    }
    getProvider(moduleId) {
        return this.providers.get(moduleId);
    }
}
export const gettingStartedContentRegistry = new GettingStartedContentProviderRegistry();
export async function moduleToContent(resource) {
    if (!resource.query) {
        throw new Error('Getting Started: invalid resource');
    }
    const query = JSON.parse(resource.query);
    if (!query.moduleId) {
        throw new Error('Getting Started: invalid resource');
    }
    const provider = gettingStartedContentRegistry.getProvider(query.moduleId);
    if (!provider) {
        throw new Error(`Getting Started: no provider registered for ${query.moduleId}`);
    }
    return provider();
}
gettingStartedContentRegistry.registerProvider('vs/workbench/contrib/welcomeGettingStarted/common/media/theme_picker', themePickerContent);
gettingStartedContentRegistry.registerProvider('vs/workbench/contrib/welcomeGettingStarted/common/media/theme_picker_small', themePickerSmallContent);
gettingStartedContentRegistry.registerProvider('vs/workbench/contrib/welcomeGettingStarted/common/media/notebookProfile', notebookProfileContent);
// Register empty media for accessibility walkthrough
gettingStartedContentRegistry.registerProvider('vs/workbench/contrib/welcomeGettingStarted/common/media/empty', () => '');
const setupIcon = registerIcon('getting-started-setup', Codicon.zap, localize('getting-started-setup-icon', "Icon used for the setup category of welcome page"));
const beginnerIcon = registerIcon('getting-started-beginner', Codicon.lightbulb, localize('getting-started-beginner-icon', "Icon used for the beginner category of welcome page"));
export const startEntries = [
    {
        id: 'welcome.showNewFileEntries',
        title: localize('gettingStarted.newFile.title', "New File..."),
        description: localize('gettingStarted.newFile.description', "Open a new untitled text file, notebook, or custom editor."),
        icon: Codicon.newFile,
        content: {
            type: 'startEntry',
            command: 'command:welcome.showNewFileEntries',
        }
    },
    {
        id: 'topLevelOpenMac',
        title: localize('gettingStarted.openMac.title', "Open..."),
        description: localize('gettingStarted.openMac.description', "Open a file or folder to start working"),
        icon: Codicon.folderOpened,
        when: '!isWeb && isMac',
        content: {
            type: 'startEntry',
            command: 'command:workbench.action.files.openFileFolder',
        }
    },
    {
        id: 'topLevelOpenFile',
        title: localize('gettingStarted.openFile.title', "Open File..."),
        description: localize('gettingStarted.openFile.description', "Open a file to start working"),
        icon: Codicon.goToFile,
        when: 'isWeb || !isMac',
        content: {
            type: 'startEntry',
            command: 'command:workbench.action.files.openFile',
        }
    },
    {
        id: 'topLevelOpenFolder',
        title: localize('gettingStarted.openFolder.title', "Open Folder..."),
        description: localize('gettingStarted.openFolder.description', "Open a folder to start working"),
        icon: Codicon.folderOpened,
        when: '!isWeb && !isMac',
        content: {
            type: 'startEntry',
            command: 'command:workbench.action.files.openFolder',
        }
    },
    {
        id: 'topLevelOpenFolderWeb',
        title: localize('gettingStarted.openFolder.title', "Open Folder..."),
        description: localize('gettingStarted.openFolder.description', "Open a folder to start working"),
        icon: Codicon.folderOpened,
        when: '!openFolderWorkspaceSupport && workbenchState == \'workspace\'',
        content: {
            type: 'startEntry',
            command: 'command:workbench.action.files.openFolderViaWorkspace',
        }
    },
    {
        id: 'topLevelGitClone',
        title: localize('gettingStarted.topLevelGitClone.title', "Clone Git Repository..."),
        description: localize('gettingStarted.topLevelGitClone.description', "Clone a remote repository to a local folder"),
        when: 'config.git.enabled && !git.missing',
        icon: Codicon.sourceControl,
        content: {
            type: 'startEntry',
            command: 'command:git.clone',
        }
    },
    {
        id: 'topLevelGitOpen',
        title: localize('gettingStarted.topLevelGitOpen.title', "Open Repository..."),
        description: localize('gettingStarted.topLevelGitOpen.description', "Connect to a remote repository or pull request to browse, search, edit, and commit"),
        when: 'workspacePlatform == \'webworker\'',
        icon: Codicon.sourceControl,
        content: {
            type: 'startEntry',
            command: 'command:remoteHub.openRepository',
        }
    },
    {
        id: 'topLevelRemoteOpen',
        title: localize('gettingStarted.topLevelRemoteOpen.title', "Connect to..."),
        description: localize('gettingStarted.topLevelRemoteOpen.description', "Connect to remote development workspaces."),
        when: '!isWeb',
        icon: Codicon.remote,
        content: {
            type: 'startEntry',
            command: 'command:workbench.action.remote.showMenu',
        }
    },
    {
        id: 'topLevelOpenTunnel',
        title: localize('gettingStarted.topLevelOpenTunnel.title', "Open Tunnel..."),
        description: localize('gettingStarted.topLevelOpenTunnel.description', "Connect to a remote machine through a Tunnel"),
        when: 'isWeb && showRemoteStartEntryInWeb',
        icon: Codicon.remote,
        content: {
            type: 'startEntry',
            command: 'command:workbench.action.remote.showWebStartEntryActions',
        }
    },
    {
        id: 'topLevelNewWorkspaceChat',
        title: localize('gettingStarted.newWorkspaceChat.title', "Generate New Workspace..."),
        description: localize('gettingStarted.newWorkspaceChat.description', "Chat to create a new workspace"),
        icon: Codicon.chatSparkle,
        when: '!isWeb && !chatSetupHidden',
        content: {
            type: 'startEntry',
            command: 'command:welcome.newWorkspaceChat',
        }
    },
];
const Button = (title, href) => `[${title}](${href})`;
const CopilotStepTitle = localize('gettingStarted.copilotSetup.title', "Use AI features with Copilot for free");
const CopilotDescription = localize({ key: 'gettingStarted.copilotSetup.description', comment: ['{Locked="["}', '{Locked="]({0})"}'] }, "You can use [Copilot]({0}) to generate code across multiple files, fix errors, ask questions about your code, and much more using natural language.", defaultChat.documentationUrl ?? '');
const CopilotTermsString = localize({ key: 'gettingStarted.copilotSetup.terms', comment: ['{Locked="]({2})"}', '{Locked="]({3})"}'] }, "By continuing with {0} Copilot, you agree to {1}'s [Terms]({2}) and [Privacy Statement]({3})", defaultChat.provider.default.name, defaultChat.provider.default.name, defaultChat.termsStatementUrl, defaultChat.privacyStatementUrl);
const CopilotAnonymousButton = Button(localize('setupCopilotButton.setup', "Use AI Features"), `command:workbench.action.chat.triggerSetupAnonymousWithoutDialog`);
const CopilotSignedOutButton = Button(localize('setupCopilotButton.setup', "Use AI Features"), `command:workbench.action.chat.triggerSetup`);
const CopilotSignedInButton = Button(localize('setupCopilotButton.setup', "Use AI Features"), `command:workbench.action.chat.triggerSetup`);
const CopilotCompleteButton = Button(localize('setupCopilotButton.chatWithCopilot', "Start to Chat"), 'command:workbench.action.chat.open');
function createCopilotSetupStep(id, button, when, includeTerms) {
    const description = includeTerms ?
        `${CopilotDescription}\n${CopilotTermsString}\n${button}` :
        `${CopilotDescription}\n${button}`;
    return {
        id,
        title: CopilotStepTitle,
        description,
        when: `${when} && !chatSetupHidden`,
        media: {
            type: 'svg', altText: 'VS Code Copilot multi file edits', path: 'multi-file-edits.svg'
        },
    };
}
export const walkthroughs = [
    {
        id: 'Setup',
        title: localize('gettingStarted.setup.title', "Get started with VS Code"),
        description: localize('gettingStarted.setup.description', "Customize your editor, learn the basics, and start coding"),
        isFeatured: true,
        icon: setupIcon,
        when: '!isWeb',
        walkthroughPageTitle: localize('gettingStarted.setup.walkthroughPageTitle', 'Setup VS Code'),
        next: 'Beginner',
        content: {
            type: 'steps',
            steps: [
                createCopilotSetupStep('CopilotSetupAnonymous', CopilotAnonymousButton, 'chatAnonymous && !chatSetupInstalled', true),
                createCopilotSetupStep('CopilotSetupSignedOut', CopilotSignedOutButton, 'chatEntitlementSignedOut && !chatAnonymous', false),
                createCopilotSetupStep('CopilotSetupComplete', CopilotCompleteButton, 'chatSetupInstalled && !chatSetupDisabled && (chatAnonymous || chatPlanPro || chatPlanProPlus || chatPlanBusiness || chatPlanEnterprise || chatPlanFree)', false),
                createCopilotSetupStep('CopilotSetupSignedIn', CopilotSignedInButton, '!chatEntitlementSignedOut && (!chatSetupInstalled || chatSetupDisabled || chatPlanCanSignUp)', false),
                {
                    id: 'pickColorTheme',
                    title: localize('gettingStarted.pickColor.title', "Choose your theme"),
                    description: localize('gettingStarted.pickColor.description.interpolated', "The right theme helps you focus on your code, is easy on your eyes, and is simply more fun to use.\n{0}", Button(localize('titleID', "Browse Color Themes"), 'command:workbench.action.selectTheme')),
                    completionEvents: [
                        'onSettingChanged:workbench.colorTheme',
                        'onCommand:workbench.action.selectTheme'
                    ],
                    media: { type: 'markdown', path: 'theme_picker', }
                },
                {
                    id: 'videoTutorial',
                    title: localize('gettingStarted.videoTutorial.title', "Watch video tutorials"),
                    description: localize('gettingStarted.videoTutorial.description.interpolated', "Watch the first in a series of short & practical video tutorials for VS Code's key features.\n{0}", Button(localize('watch', "Watch Tutorial"), 'https://aka.ms/vscode-getting-started-video')),
                    media: { type: 'svg', altText: 'VS Code Settings', path: 'learn.svg' },
                }
            ]
        }
    },
    {
        id: 'SetupWeb',
        title: localize('gettingStarted.setupWeb.title', "Get Started with VS Code for the Web"),
        description: localize('gettingStarted.setupWeb.description', "Customize your editor, learn the basics, and start coding"),
        isFeatured: true,
        icon: setupIcon,
        when: 'isWeb',
        next: 'Beginner',
        walkthroughPageTitle: localize('gettingStarted.setupWeb.walkthroughPageTitle', 'Setup VS Code Web'),
        content: {
            type: 'steps',
            steps: [
                {
                    id: 'pickColorThemeWeb',
                    title: localize('gettingStarted.pickColor.title', "Choose your theme"),
                    description: localize('gettingStarted.pickColor.description.interpolated', "The right theme helps you focus on your code, is easy on your eyes, and is simply more fun to use.\n{0}", Button(localize('titleID', "Browse Color Themes"), 'command:workbench.action.selectTheme')),
                    completionEvents: [
                        'onSettingChanged:workbench.colorTheme',
                        'onCommand:workbench.action.selectTheme'
                    ],
                    media: { type: 'markdown', path: 'theme_picker', }
                },
                {
                    id: 'menuBarWeb',
                    title: localize('gettingStarted.menuBar.title', "Just the right amount of UI"),
                    description: localize('gettingStarted.menuBar.description.interpolated', "The full menu bar is available in the dropdown menu to make room for your code. Toggle its appearance for faster access. \n{0}", Button(localize('toggleMenuBar', "Toggle Menu Bar"), 'command:workbench.action.toggleMenuBar')),
                    when: 'isWeb',
                    media: {
                        type: 'svg', altText: 'Comparing menu dropdown with the visible menu bar.', path: 'menuBar.svg'
                    },
                },
                {
                    id: 'extensionsWebWeb',
                    title: localize('gettingStarted.extensions.title', "Code with extensions"),
                    description: localize('gettingStarted.extensionsWeb.description.interpolated', "Extensions are VS Code's power-ups. A growing number are becoming available in the web.\n{0}", Button(localize('browsePopularWeb', "Browse Popular Web Extensions"), 'command:workbench.extensions.action.showPopularExtensions')),
                    when: 'workspacePlatform == \'webworker\'',
                    media: {
                        type: 'svg', altText: 'VS Code extension marketplace with featured language extensions', path: 'extensions-web.svg'
                    },
                },
                {
                    id: 'findLanguageExtensionsWeb',
                    title: localize('gettingStarted.findLanguageExts.title', "Rich support for all your languages"),
                    description: localize('gettingStarted.findLanguageExts.description.interpolated', "Code smarter with syntax highlighting, inline suggestions, linting and debugging. While many languages are built-in, many more can be added as extensions.\n{0}", Button(localize('browseLangExts', "Browse Language Extensions"), 'command:workbench.extensions.action.showLanguageExtensions')),
                    when: 'workspacePlatform != \'webworker\'',
                    media: {
                        type: 'svg', altText: 'Language extensions', path: 'languages.svg'
                    },
                },
                {
                    id: 'settingsSyncWeb',
                    title: localize('gettingStarted.settingsSync.title', "Sync settings across devices"),
                    description: localize('gettingStarted.settingsSync.description.interpolated', "Keep your essential customizations backed up and updated across all your devices.\n{0}", Button(localize('enableSync', "Backup and Sync Settings"), 'command:workbench.userDataSync.actions.turnOn')),
                    when: 'syncStatus != uninitialized',
                    completionEvents: ['onEvent:sync-enabled'],
                    media: {
                        type: 'svg', altText: 'The "Turn on Sync" entry in the settings gear menu.', path: 'settingsSync.svg'
                    },
                },
                {
                    id: 'commandPaletteTaskWeb',
                    title: localize('gettingStarted.commandPalette.title', "Unlock productivity with the Command Palette "),
                    description: localize('gettingStarted.commandPalette.description.interpolated', "Run commands without reaching for your mouse to accomplish any task in VS Code.\n{0}", Button(localize('commandPalette', "Open Command Palette"), 'command:workbench.action.showCommands')),
                    media: { type: 'svg', altText: 'Command Palette overlay for searching and executing commands.', path: 'commandPalette.svg' },
                },
                {
                    id: 'pickAFolderTask-WebWeb',
                    title: localize('gettingStarted.setup.OpenFolder.title', "Open up your code"),
                    description: localize('gettingStarted.setup.OpenFolderWeb.description.interpolated', "You're all set to start coding. You can open a local project or a remote repository to get your files into VS Code.\n{0}\n{1}", Button(localize('openFolder', "Open Folder"), 'command:workbench.action.addRootFolder'), Button(localize('openRepository', "Open Repository"), 'command:remoteHub.openRepository')),
                    when: 'workspaceFolderCount == 0',
                    media: {
                        type: 'svg', altText: 'Explorer view showing buttons for opening folder and cloning repository.', path: 'openFolder.svg'
                    }
                },
                {
                    id: 'quickOpenWeb',
                    title: localize('gettingStarted.quickOpen.title', "Quickly navigate between your files"),
                    description: localize('gettingStarted.quickOpen.description.interpolated', "Navigate between files in an instant with one keystroke. Tip: Open multiple files by pressing the right arrow key.\n{0}", Button(localize('quickOpen', "Quick Open a File"), 'command:toSide:workbench.action.quickOpen')),
                    when: 'workspaceFolderCount != 0',
                    media: {
                        type: 'svg', altText: 'Go to file in quick search.', path: 'search.svg'
                    }
                }
            ]
        }
    },
    {
        id: 'SetupAccessibility',
        title: localize('gettingStarted.setupAccessibility.title', "Get Started with Accessibility Features"),
        description: localize('gettingStarted.setupAccessibility.description', "Learn the tools and shortcuts that make VS Code accessible. Note that some actions are not actionable from within the context of the walkthrough."),
        isFeatured: true,
        icon: setupIcon,
        when: CONTEXT_ACCESSIBILITY_MODE_ENABLED.key,
        next: 'Setup',
        walkthroughPageTitle: localize('gettingStarted.setupAccessibility.walkthroughPageTitle', 'Setup VS Code Accessibility'),
        content: {
            type: 'steps',
            steps: [
                {
                    id: 'accessibilityHelp',
                    title: localize('gettingStarted.accessibilityHelp.title', "Use the accessibility help dialog to learn about features"),
                    description: localize('gettingStarted.accessibilityHelp.description.interpolated', "The accessibility help dialog provides information about what to expect from a feature and the commands/keybindings to operate them.\n With focus in an editor, terminal, notebook, chat response, comment, or debug console, the relevant dialog can be opened with the Open Accessibility Help command.\n{0}", Button(localize('openAccessibilityHelp', "Open Accessibility Help"), 'command:editor.action.accessibilityHelp')),
                    media: {
                        type: 'markdown', path: 'empty'
                    }
                },
                {
                    id: 'accessibleView',
                    title: localize('gettingStarted.accessibleView.title', "Screen reader users can inspect content line by line, character by character in the accessible view."),
                    description: localize('gettingStarted.accessibleView.description.interpolated', "The accessible view is available for the terminal, hovers, notifications, comments, notebook output, chat responses, inline completions, and debug console output.\n With focus in any of those features, it can be opened with the Open Accessible View command.\n{0}", Button(localize('openAccessibleView', "Open Accessible View"), 'command:editor.action.accessibleView')),
                    media: {
                        type: 'markdown', path: 'empty'
                    }
                },
                {
                    id: 'verbositySettings',
                    title: localize('gettingStarted.verbositySettings.title', "Control the verbosity of aria labels"),
                    description: localize('gettingStarted.verbositySettings.description.interpolated', "Screen reader verbosity settings exist for features around the workbench so that once a user is familiar with a feature, they can avoid hearing hints about how to operate it. For example, features for which an accessibility help dialog exists will indicate how to open the dialog until the verbosity setting for that feature has been disabled.\n These and other accessibility settings can be configured by running the Open Accessibility Settings command.\n{0}", Button(localize('openVerbositySettings', "Open Accessibility Settings"), 'command:workbench.action.openAccessibilitySettings')),
                    media: {
                        type: 'markdown', path: 'empty'
                    }
                },
                {
                    id: 'commandPaletteTaskAccessibility',
                    title: localize('gettingStarted.commandPaletteAccessibility.title', "Unlock productivity with the Command Palette "),
                    description: localize('gettingStarted.commandPaletteAccessibility.description.interpolated', "Run commands without reaching for your mouse to accomplish any task in VS Code.\n{0}", Button(localize('commandPalette', "Open Command Palette"), 'command:workbench.action.showCommands')),
                    media: { type: 'markdown', path: 'empty' },
                },
                {
                    id: 'keybindingsAccessibility',
                    title: localize('gettingStarted.keyboardShortcuts.title', "Customize your keyboard shortcuts"),
                    description: localize('gettingStarted.keyboardShortcuts.description.interpolated', "Once you have discovered your favorite commands, create custom keyboard shortcuts for instant access.\n{0}", Button(localize('keyboardShortcuts', "Keyboard Shortcuts"), 'command:toSide:workbench.action.openGlobalKeybindings')),
                    media: {
                        type: 'markdown', path: 'empty',
                    }
                },
                {
                    id: 'accessibilitySignals',
                    title: localize('gettingStarted.accessibilitySignals.title', "Fine tune which accessibility signals you want to receive via audio or a braille device"),
                    description: localize('gettingStarted.accessibilitySignals.description.interpolated', "Accessibility sounds and announcements are played around the workbench for different events.\n These can be discovered and configured using the List Signal Sounds and List Signal Announcements commands.\n{0}\n{1}", Button(localize('listSignalSounds', "List Signal Sounds"), 'command:signals.sounds.help'), Button(localize('listSignalAnnouncements', "List Signal Announcements"), 'command:accessibility.announcement.help')),
                    media: {
                        type: 'markdown', path: 'empty'
                    }
                },
                {
                    id: 'hover',
                    title: localize('gettingStarted.hover.title', "Access the hover in the editor to get more information on a variable or symbol"),
                    description: localize('gettingStarted.hover.description.interpolated', "While focus is in the editor on a variable or symbol, a hover can be focused with the Show or Open Hover command.\n{0}", Button(localize('showOrFocusHover', "Show or Focus Hover"), 'command:editor.action.showHover')),
                    media: {
                        type: 'markdown', path: 'empty'
                    }
                },
                {
                    id: 'goToSymbol',
                    title: localize('gettingStarted.goToSymbol.title', "Navigate to symbols in a file"),
                    description: localize('gettingStarted.goToSymbol.description.interpolated', "The Go to Symbol command is useful for navigating between important landmarks in a document.\n{0}", Button(localize('openGoToSymbol', "Go to Symbol"), 'command:editor.action.goToSymbol')),
                    media: {
                        type: 'markdown', path: 'empty'
                    }
                },
                {
                    id: 'codeFolding',
                    title: localize('gettingStarted.codeFolding.title', "Use code folding to collapse blocks of code and focus on the code you're interested in."),
                    description: localize('gettingStarted.codeFolding.description.interpolated', "Fold or unfold a code section with the Toggle Fold command.\n{0}\n Fold or unfold recursively with the Toggle Fold Recursively Command\n{1}\n", Button(localize('toggleFold', "Toggle Fold"), 'command:editor.toggleFold'), Button(localize('toggleFoldRecursively', "Toggle Fold Recursively"), 'command:editor.toggleFoldRecursively')),
                    media: {
                        type: 'markdown', path: 'empty'
                    }
                },
                {
                    id: 'intellisense',
                    title: localize('gettingStarted.intellisense.title', "Use Intellisense to improve coding efficiency"),
                    description: localize('gettingStarted.intellisense.description.interpolated', "Intellisense suggestions can be opened with the Trigger Intellisense command.\n{0}\n Inline intellisense suggestions can be triggered with Trigger Inline Suggestion\n{1}\n Useful settings include editor.inlineCompletionsAccessibilityVerbose and editor.screenReaderAnnounceInlineSuggestion.", Button(localize('triggerIntellisense', "Trigger Intellisense"), 'command:editor.action.triggerSuggest'), Button(localize('triggerInlineSuggestion', 'Trigger Inline Suggestion'), 'command:editor.action.inlineSuggest.trigger')),
                    media: {
                        type: 'markdown', path: 'empty'
                    }
                },
                {
                    id: 'accessibilitySettings',
                    title: localize('gettingStarted.accessibilitySettings.title', "Configure accessibility settings"),
                    description: localize('gettingStarted.accessibilitySettings.description.interpolated', "Accessibility settings can be configured by running the Open Accessibility Settings command.\n{0}", Button(localize('openAccessibilitySettings', "Open Accessibility Settings"), 'command:workbench.action.openAccessibilitySettings')),
                    media: { type: 'markdown', path: 'empty' }
                },
                {
                    id: 'dictation',
                    title: localize('gettingStarted.dictation.title', "Use dictation to write code and text in the editor and terminal"),
                    description: localize('gettingStarted.dictation.description.interpolated', "Dictation allows you to write code and text using your voice. It can be activated with the Voice: Start Dictation in Editor command.\n{0}\n For dictation in the terminal, use the Voice: Start Dictation in Terminal and Voice: Stop Dictation in Terminal commands.\n{1}\n{2}", Button(localize('toggleDictation', "Voice: Start Dictation in Editor"), 'command:workbench.action.editorDictation.start'), Button(localize('terminalStartDictation', "Terminal: Start Dictation in Terminal"), 'command:workbench.action.terminal.startVoice'), Button(localize('terminalStopDictation', "Terminal: Stop Dictation in Terminal"), 'command:workbench.action.terminal.stopVoice')),
                    when: 'hasSpeechProvider',
                    media: { type: 'markdown', path: 'empty' }
                }
            ]
        }
    },
    {
        id: 'Beginner',
        isFeatured: false,
        title: localize('gettingStarted.beginner.title', "Learn the Fundamentals"),
        icon: beginnerIcon,
        description: localize('gettingStarted.beginner.description', "Get an overview of the most essential features"),
        walkthroughPageTitle: localize('gettingStarted.beginner.walkthroughPageTitle', 'Essential Features'),
        content: {
            type: 'steps',
            steps: [
                {
                    id: 'settingsAndSync',
                    title: localize('gettingStarted.settings.title', "Tune your settings"),
                    description: localize('gettingStarted.settingsAndSync.description.interpolated', "Customize every aspect of VS Code and [sync](command:workbench.userDataSync.actions.turnOn) customizations across devices.\n{0}", Button(localize('tweakSettings', "Open Settings"), 'command:toSide:workbench.action.openSettings')),
                    when: 'workspacePlatform != \'webworker\' && syncStatus != uninitialized',
                    completionEvents: ['onEvent:sync-enabled'],
                    media: {
                        type: 'svg', altText: 'VS Code Settings', path: 'settings.svg'
                    },
                },
                {
                    id: 'extensions',
                    title: localize('gettingStarted.extensions.title', "Code with extensions"),
                    description: localize('gettingStarted.extensions.description.interpolated', "Extensions are VS Code's power-ups. They range from handy productivity hacks, expanding out-of-the-box features, to adding completely new capabilities.\n{0}", Button(localize('browsePopular', "Browse Popular Extensions"), 'command:workbench.extensions.action.showPopularExtensions')),
                    when: 'workspacePlatform != \'webworker\'',
                    media: {
                        type: 'svg', altText: 'VS Code extension marketplace with featured language extensions', path: 'extensions.svg'
                    },
                },
                {
                    id: 'terminal',
                    title: localize('gettingStarted.terminal.title', "Built-in terminal"),
                    description: localize('gettingStarted.terminal.description.interpolated', "Quickly run shell commands and monitor build output, right next to your code.\n{0}", Button(localize('showTerminal', "Open Terminal"), 'command:workbench.action.terminal.toggleTerminal')),
                    when: 'workspacePlatform != \'webworker\' && remoteName != codespaces && !terminalIsOpen',
                    media: {
                        type: 'svg', altText: 'Integrated terminal running a few npm commands', path: 'terminal.svg'
                    },
                },
                {
                    id: 'debugging',
                    title: localize('gettingStarted.debug.title', "Watch your code in action"),
                    description: localize('gettingStarted.debug.description.interpolated', "Accelerate your edit, build, test, and debug loop by setting up a launch configuration.\n{0}", Button(localize('runProject', "Run your Project"), 'command:workbench.action.debug.selectandstart')),
                    when: 'workspacePlatform != \'webworker\' && workspaceFolderCount != 0',
                    media: {
                        type: 'svg', altText: 'Run and debug view.', path: 'debug.svg',
                    },
                },
                {
                    id: 'scmClone',
                    title: localize('gettingStarted.scm.title', "Track your code with Git"),
                    description: localize('gettingStarted.scmClone.description.interpolated', "Set up the built-in version control for your project to track your changes and collaborate with others.\n{0}", Button(localize('cloneRepo', "Clone Repository"), 'command:git.clone')),
                    when: 'config.git.enabled && !git.missing && workspaceFolderCount == 0',
                    media: {
                        type: 'svg', altText: 'Source Control view.', path: 'git.svg',
                    },
                },
                {
                    id: 'scmSetup',
                    title: localize('gettingStarted.scm.title', "Track your code with Git"),
                    description: localize('gettingStarted.scmSetup.description.interpolated', "Set up the built-in version control for your project to track your changes and collaborate with others.\n{0}", Button(localize('initRepo', "Initialize Git Repository"), 'command:git.init')),
                    when: 'config.git.enabled && !git.missing && workspaceFolderCount != 0 && gitOpenRepositoryCount == 0',
                    media: {
                        type: 'svg', altText: 'Source Control view.', path: 'git.svg',
                    },
                },
                {
                    id: 'scm',
                    title: localize('gettingStarted.scm.title', "Track your code with Git"),
                    description: localize('gettingStarted.scm.description.interpolated', "No more looking up Git commands! Git and GitHub workflows are seamlessly integrated.\n{0}", Button(localize('openSCM', "Open Source Control"), 'command:workbench.view.scm')),
                    when: 'config.git.enabled && !git.missing && workspaceFolderCount != 0 && gitOpenRepositoryCount != 0 && activeViewlet != \'workbench.view.scm\'',
                    media: {
                        type: 'svg', altText: 'Source Control view.', path: 'git.svg',
                    },
                },
                {
                    id: 'installGit',
                    title: localize('gettingStarted.installGit.title', "Install Git"),
                    description: localize({ key: 'gettingStarted.installGit.description.interpolated', comment: ['The placeholders are command link items should not be translated'] }, "Install Git to track changes in your projects.\n{0}\n{1}Reload window{2} after installation to complete Git setup.", Button(localize('installGit', "Install Git"), 'https://aka.ms/vscode-install-git'), '[', '](command:workbench.action.reloadWindow)'),
                    when: 'git.missing',
                    media: {
                        type: 'svg', altText: 'Install Git.', path: 'git.svg',
                    },
                    completionEvents: [
                        'onContext:git.state == initialized'
                    ]
                },
                {
                    id: 'tasks',
                    title: localize('gettingStarted.tasks.title', "Automate your project tasks"),
                    when: 'workspaceFolderCount != 0 && workspacePlatform != \'webworker\'',
                    description: localize('gettingStarted.tasks.description.interpolated', "Create tasks for your common workflows and enjoy the integrated experience of running scripts and automatically checking results.\n{0}", Button(localize('runTasks', "Run Auto-detected Tasks"), 'command:workbench.action.tasks.runTask')),
                    media: {
                        type: 'svg', altText: 'Task runner.', path: 'runTask.svg',
                    },
                },
                {
                    id: 'shortcuts',
                    title: localize('gettingStarted.shortcuts.title', "Customize your shortcuts"),
                    description: localize('gettingStarted.shortcuts.description.interpolated', "Once you have discovered your favorite commands, create custom keyboard shortcuts for instant access.\n{0}", Button(localize('keyboardShortcuts', "Keyboard Shortcuts"), 'command:toSide:workbench.action.openGlobalKeybindings')),
                    media: {
                        type: 'svg', altText: 'Interactive shortcuts.', path: 'shortcuts.svg',
                    }
                },
                {
                    id: 'workspaceTrust',
                    title: localize('gettingStarted.workspaceTrust.title', "Safely browse and edit code"),
                    description: localize('gettingStarted.workspaceTrust.description.interpolated', "{0} lets you decide whether your project folders should **allow or restrict** automatic code execution __(required for extensions, debugging, etc)__.\nOpening a file/folder will prompt to grant trust. You can always {1} later.", Button(localize('workspaceTrust', "Workspace Trust"), 'https://code.visualstudio.com/docs/editor/workspace-trust'), Button(localize('enableTrust', "enable trust"), 'command:toSide:workbench.trust.manage')),
                    when: 'workspacePlatform != \'webworker\' && !isWorkspaceTrusted && workspaceFolderCount == 0',
                    media: {
                        type: 'svg', altText: 'Workspace Trust editor in Restricted mode and a primary button for switching to Trusted mode.', path: 'workspaceTrust.svg'
                    },
                },
            ]
        }
    },
    {
        id: 'notebooks',
        title: localize('gettingStarted.notebook.title', "Customize Notebooks"),
        description: '',
        icon: setupIcon,
        isFeatured: false,
        when: `config.${NotebookSetting.openGettingStarted} && userHasOpenedNotebook`,
        walkthroughPageTitle: localize('gettingStarted.notebook.walkthroughPageTitle', 'Notebooks'),
        content: {
            type: 'steps',
            steps: [
                {
                    completionEvents: ['onCommand:notebook.setProfile'],
                    id: 'notebookProfile',
                    title: localize('gettingStarted.notebookProfile.title', "Select the layout for your notebooks"),
                    description: localize('gettingStarted.notebookProfile.description', "Get notebooks to feel just the way you prefer"),
                    when: 'userHasOpenedNotebook',
                    media: {
                        type: 'markdown', path: 'notebookProfile'
                    }
                },
            ]
        }
    }
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0dGluZ1N0YXJ0ZWRDb250ZW50LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3dlbGNvbWVHZXR0aW5nU3RhcnRlZC9jb21tb24vZ2V0dGluZ1N0YXJ0ZWRDb250ZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sa0JBQWtCLE1BQU0seUJBQXlCLENBQUM7QUFDekQsT0FBTyx1QkFBdUIsTUFBTSwrQkFBK0IsQ0FBQztBQUNwRSxPQUFPLHNCQUFzQixNQUFNLDRCQUE0QixDQUFDO0FBQ2hFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFOUQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsa0NBQWtDLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUVoSCxPQUFPLE9BQU8sTUFBTSxnREFBZ0QsQ0FBQztBQU1yRSxNQUFNLFdBQVcsR0FBRztJQUNuQixnQkFBZ0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsZ0JBQWdCLElBQUksRUFBRTtJQUNsRSxpQkFBaUIsRUFBRSxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsaUJBQWlCLElBQUksRUFBRTtJQUNwRSxRQUFRLEVBQUUsT0FBTyxDQUFDLGdCQUFnQixFQUFFLFFBQVEsSUFBSSxFQUFFLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRTtJQUN6RSxvQkFBb0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsb0JBQW9CLElBQUksRUFBRTtJQUMxRSxpQkFBaUIsRUFBRSxPQUFPLENBQUMsZ0JBQWdCLEVBQUUs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