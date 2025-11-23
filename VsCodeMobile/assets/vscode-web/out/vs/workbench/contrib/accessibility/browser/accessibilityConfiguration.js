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
import { localize } from '../../../../nls.js';
import { Extensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { workbenchConfigurationNodeBase, Extensions as WorkbenchExtensions } from '../../../common/configuration.js';
import { AccessibilitySignal } from '../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { AccessibilityVoiceSettingId, ISpeechService, SPEECH_LANGUAGES } from '../../speech/common/speechService.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Event } from '../../../../base/common/event.js';
import { isDefined } from '../../../../base/common/types.js';
export const accessibilityHelpIsShown = new RawContextKey('accessibilityHelpIsShown', false, true);
export const accessibleViewIsShown = new RawContextKey('accessibleViewIsShown', false, true);
export const accessibleViewSupportsNavigation = new RawContextKey('accessibleViewSupportsNavigation', false, true);
export const accessibleViewVerbosityEnabled = new RawContextKey('accessibleViewVerbosityEnabled', false, true);
export const accessibleViewGoToSymbolSupported = new RawContextKey('accessibleViewGoToSymbolSupported', false, true);
export const accessibleViewOnLastLine = new RawContextKey('accessibleViewOnLastLine', false, true);
export const accessibleViewCurrentProviderId = new RawContextKey('accessibleViewCurrentProviderId', undefined, undefined);
export const accessibleViewInCodeBlock = new RawContextKey('accessibleViewInCodeBlock', undefined, undefined);
export const accessibleViewContainsCodeBlocks = new RawContextKey('accessibleViewContainsCodeBlocks', undefined, undefined);
export const accessibleViewHasUnassignedKeybindings = new RawContextKey('accessibleViewHasUnassignedKeybindings', undefined, undefined);
export const accessibleViewHasAssignedKeybindings = new RawContextKey('accessibleViewHasAssignedKeybindings', undefined, undefined);
/**
 * Miscellaneous settings tagged with accessibility and implemented in the accessibility contrib but
 * were better to live under workbench for discoverability.
 */
export var AccessibilityWorkbenchSettingId;
(function (AccessibilityWorkbenchSettingId) {
    AccessibilityWorkbenchSettingId["DimUnfocusedEnabled"] = "accessibility.dimUnfocused.enabled";
    AccessibilityWorkbenchSettingId["DimUnfocusedOpacity"] = "accessibility.dimUnfocused.opacity";
    AccessibilityWorkbenchSettingId["HideAccessibleView"] = "accessibility.hideAccessibleView";
    AccessibilityWorkbenchSettingId["AccessibleViewCloseOnKeyPress"] = "accessibility.accessibleView.closeOnKeyPress";
    AccessibilityWorkbenchSettingId["VerboseChatProgressUpdates"] = "accessibility.verboseChatProgressUpdates";
})(AccessibilityWorkbenchSettingId || (AccessibilityWorkbenchSettingId = {}));
export var ViewDimUnfocusedOpacityProperties;
(function (ViewDimUnfocusedOpacityProperties) {
    ViewDimUnfocusedOpacityProperties[ViewDimUnfocusedOpacityProperties["Default"] = 0.75] = "Default";
    ViewDimUnfocusedOpacityProperties[ViewDimUnfocusedOpacityProperties["Minimum"] = 0.2] = "Minimum";
    ViewDimUnfocusedOpacityProperties[ViewDimUnfocusedOpacityProperties["Maximum"] = 1] = "Maximum";
})(ViewDimUnfocusedOpacityProperties || (ViewDimUnfocusedOpacityProperties = {}));
export var AccessibilityVerbositySettingId;
(function (AccessibilityVerbositySettingId) {
    AccessibilityVerbositySettingId["Terminal"] = "accessibility.verbosity.terminal";
    AccessibilityVerbositySettingId["DiffEditor"] = "accessibility.verbosity.diffEditor";
    AccessibilityVerbositySettingId["MergeEditor"] = "accessibility.verbosity.mergeEditor";
    AccessibilityVerbositySettingId["Chat"] = "accessibility.verbosity.panelChat";
    AccessibilityVerbositySettingId["InlineChat"] = "accessibility.verbosity.inlineChat";
    AccessibilityVerbositySettingId["TerminalInlineChat"] = "accessibility.verbosity.terminalChat";
    AccessibilityVerbositySettingId["TerminalChatOutput"] = "accessibility.verbosity.terminalChatOutput";
    AccessibilityVerbositySettingId["InlineCompletions"] = "accessibility.verbosity.inlineCompletions";
    AccessibilityVerbositySettingId["KeybindingsEditor"] = "accessibility.verbosity.keybindingsEditor";
    AccessibilityVerbositySettingId["Notebook"] = "accessibility.verbosity.notebook";
    AccessibilityVerbositySettingId["Editor"] = "accessibility.verbosity.editor";
    AccessibilityVerbositySettingId["Hover"] = "accessibility.verbosity.hover";
    AccessibilityVerbositySettingId["Notification"] = "accessibility.verbosity.notification";
    AccessibilityVerbositySettingId["EmptyEditorHint"] = "accessibility.verbosity.emptyEditorHint";
    AccessibilityVerbositySettingId["ReplEditor"] = "accessibility.verbosity.replEditor";
    AccessibilityVerbositySettingId["Comments"] = "accessibility.verbosity.comments";
    AccessibilityVerbositySettingId["DiffEditorActive"] = "accessibility.verbosity.diffEditorActive";
    AccessibilityVerbositySettingId["Debug"] = "accessibility.verbosity.debug";
    AccessibilityVerbositySettingId["Walkthrough"] = "accessibility.verbosity.walkthrough";
    AccessibilityVerbositySettingId["SourceControl"] = "accessibility.verbosity.sourceControl";
})(AccessibilityVerbositySettingId || (AccessibilityVerbositySettingId = {}));
const baseVerbosityProperty = {
    type: 'boolean',
    default: true,
    tags: ['accessibility']
};
export const accessibilityConfigurationNodeBase = Object.freeze({
    id: 'accessibility',
    title: localize('accessibilityConfigurationTitle', "Accessibility"),
    type: 'object'
});
export const soundFeatureBase = {
    'type': 'string',
    'enum': ['auto', 'on', 'off'],
    'default': 'auto',
    'enumDescriptions': [
        localize('sound.enabled.auto', "Enable sound when a screen reader is attached."),
        localize('sound.enabled.on', "Enable sound."),
        localize('sound.enabled.off', "Disable sound.")
    ],
    tags: ['accessibility'],
};
const signalFeatureBase = {
    'type': 'object',
    'tags': ['accessibility'],
    additionalProperties: false,
    default: {
        sound: 'auto',
        announcement: 'auto'
    }
};
export const announcementFeatureBase = {
    'type': 'string',
    'enum': ['auto', 'off'],
    'default': 'auto',
    'enumDescriptions': [
        localize('announcement.enabled.auto', "Enable announcement, will only play when in screen reader optimized mode."),
        localize('announcement.enabled.off', "Disable announcement.")
    ],
    tags: ['accessibility'],
};
const defaultNoAnnouncement = {
    'type': 'object',
    'tags': ['accessibility'],
    additionalProperties: false,
    'default': {
        'sound': 'auto',
    }
};
const configuration = {
    ...accessibilityConfigurationNodeBase,
    scope: 5 /* ConfigurationScope.RESOURCE */,
    properties: {
        ["accessibility.verbosity.terminal" /* AccessibilityVerbositySettingId.Terminal */]: {
            description: localize('verbosity.terminal.description', 'Provide information about how to access the terminal accessibility help menu when the terminal is focused.'),
            ...baseVerbosityProperty
        },
        ["accessibility.verbosity.diffEditor" /* AccessibilityVerbositySettingId.DiffEditor */]: {
            description: localize('verbosity.diffEditor.description', 'Provide information about how to navigate changes in the diff editor when it is focused.'),
            ...baseVerbosityProperty
        },
        ["accessibility.verbosity.panelChat" /* AccessibilityVerbositySettingId.Chat */]: {
            description: localize('verbosity.chat.description', 'Provide information about how to access the chat help menu when the chat input is focused.'),
            ...baseVerbosityProperty
        },
        ["accessibility.verbosity.inlineChat" /* AccessibilityVerbositySettingId.InlineChat */]: {
            description: localize('verbosity.interactiveEditor.description', 'Provide information about how to access the inline editor chat accessibility help menu and alert with hints that describe how to use the feature when the input is focused.'),
            ...baseVerbosityProperty
        },
        ["accessibility.verbosity.terminalChatOutput" /* AccessibilityVerbositySettingId.TerminalChatOutput */]: {
            description: localize('verbosity.terminalChatOutput.description', 'Provide information about how to open the chat terminal output in the Accessible View.'),
            ...baseVerbosityProperty
        },
        ["accessibility.verbosity.inlineCompletions" /* AccessibilityVerbositySettingId.InlineCompletions */]: {
            description: localize('verbosity.inlineCompletions.description', 'Provide information about how to access the inline completions hover and Accessible View.'),
            ...baseVerbosityProperty
        },
        ["accessibility.verbosity.keybindingsEditor" /* AccessibilityVerbositySettingId.KeybindingsEditor */]: {
            description: localize('verbosity.keybindingsEditor.description', 'Provide information about how to change a keybinding in the keybindings editor when a row is focused.'),
            ...baseVerbosityProperty
        },
        ["accessibility.verbosity.notebook" /* AccessibilityVerbositySettingId.Notebook */]: {
            description: localize('verbosity.notebook', 'Provide information about how to focus the cell container or inner editor when a notebook cell is focused.'),
            ...baseVerbosityProperty
        },
        ["accessibility.verbosity.hover" /* AccessibilityVerbositySettingId.Hover */]: {
            description: localize('verbosity.hover', 'Provide information about how to open the hover in an Accessible View.'),
            ...baseVerbosityProperty
        },
        ["accessibility.verbosity.notification" /* AccessibilityVerbositySettingId.Notification */]: {
            description: localize('verbosity.notification', 'Provide information about how to open the notification in an Accessible View.'),
            ...baseVerbosityProperty
        },
        ["accessibility.verbosity.emptyEditorHint" /* AccessibilityVerbositySettingId.EmptyEditorHint */]: {
            description: localize('verbosity.emptyEditorHint', 'Provide information about relevant actions in an empty text editor.'),
            ...baseVerbosityProperty
        },
        ["accessibility.verbosity.replEditor" /* AccessibilityVerbositySettingId.ReplEditor */]: {
            description: localize('verbosity.replEditor.description', 'Provide information about how to access the REPL editor accessibility help menu when the REPL editor is focused.'),
            ...baseVerbosityProperty
        },
        ["accessibility.verbosity.comments" /* AccessibilityVerbositySettingId.Comments */]: {
            description: localize('verbosity.comments', 'Provide information about actions that can be taken in the comment widget or in a file which contains comments.'),
            ...baseVerbosityProperty
        },
        ["accessibility.verbosity.diffEditorActive" /* AccessibilityVerbositySettingId.DiffEditorActive */]: {
            description: localize('verbosity.diffEditorActive', 'Indicate when a diff editor becomes the active editor.'),
            ...baseVerbosityProperty
        },
        ["accessibility.verbosity.debug" /* AccessibilityVerbositySettingId.Debug */]: {
            description: localize('verbosity.debug', 'Provide information about how to access the debug console accessibility help dialog when the debug console or run and debug viewlet is focused. Note that a reload of the window is required for this to take effect.'),
            ...baseVerbosityProperty
        },
        ["accessibility.verbosity.walkthrough" /* AccessibilityVerbositySettingId.Walkthrough */]: {
            description: localize('verbosity.walkthrough', 'Provide information about how to open the walkthrough in an Accessible View.'),
            ...baseVerbosityProperty
        },
        ["accessibility.accessibleView.closeOnKeyPress" /* AccessibilityWorkbenchSettingId.AccessibleViewCloseOnKeyPress */]: {
            markdownDescription: localize('terminal.integrated.accessibleView.closeOnKeyPress', "On keypress, close the Accessible View and focus the element from which it was invoked."),
            type: 'boolean',
            default: true
        },
        ["accessibility.verbosity.sourceControl" /* AccessibilityVerbositySettingId.SourceControl */]: {
            description: localize('verbosity.scm', 'Provide information about how to access the source control accessibility help menu when the input is focused.'),
            ...baseVerbosityProperty
        },
        'accessibility.signalOptions.volume': {
            'description': localize('accessibility.signalOptions.volume', "The volume of the sounds in percent (0-100)."),
            'type': 'number',
            'minimum': 0,
            'maximum': 100,
            'default': 70,
            'tags': ['accessibility']
        },
        'accessibility.signalOptions.debouncePositionChanges': {
            'description': localize('accessibility.signalOptions.debouncePositionChanges', "Whether or not position changes should be debounced"),
            'type': 'boolean',
            'default': false,
            'tags': ['accessibility']
        },
        'accessibility.signalOptions.experimental.delays.general': {
            'type': 'object',
            'description': 'Delays for all signals besides error and warning at position',
            'additionalProperties': false,
            'properties': {
                'announcement': {
                    'description': localize('accessibility.signalOptions.delays.general.announcement', "The delay in milliseconds before an announcement is made."),
                    'type': 'number',
                    'minimum': 0,
                    'default': 3000
                },
                'sound': {
                    'description': localize('accessibility.signalOptions.delays.general.sound', "The delay in milliseconds before a sound is played."),
                    'type': 'number',
                    'minimum': 0,
                    'default': 400
                }
            },
            'tags': ['accessibility']
        },
        'accessibility.signalOptions.experimental.delays.warningAtPosition': {
            'type': 'object',
            'additionalProperties': false,
            'properties': {
                'announcement': {
                    'description': localize('accessibility.signalOptions.delays.warningAtPosition.announcement', "The delay in milliseconds before an announcement is made when there's a warning at the position."),
                    'type': 'number',
                    'minimum': 0,
                    'default': 3000
                },
                'sound': {
                    'description': localize('accessibility.signalOptions.delays.warningAtPosition.sound', "The delay in milliseconds before a sound is played when there's a warning at the position."),
                    'type': 'number',
                    'minimum': 0,
                    'default': 1000
                }
            },
            'tags': ['accessibility']
        },
        'accessibility.signalOptions.experimental.delays.errorAtPosition': {
            'type': 'object',
            'additionalProperties': false,
            'properties': {
                'announcement': {
                    'description': localize('accessibility.signalOptions.delays.errorAtPosition.announcement', "The delay in milliseconds before an announcement is made when there's an error at the position."),
                    'type': 'number',
                    'minimum': 0,
                    'default': 3000
                },
                'sound': {
                    'description': localize('accessibility.signalOptions.delays.errorAtPosition.sound', "The delay in milliseconds before a sound is played when there's an error at the position."),
                    'type': 'number',
                    'minimum': 0,
                    'default': 1000
                }
            },
            'tags': ['accessibility']
        },
        'accessibility.signals.lineHasBreakpoint': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.lineHasBreakpoint', "Plays a signal - sound (audio cue) and/or announcement (alert) - when the active line has a breakpoint."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.lineHasBreakpoint.sound', "Plays a sound when the active line has a breakpoint."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.lineHasBreakpoint.announcement', "Announces when the active line has a breakpoint."),
                    ...announcementFeatureBase
                },
            },
        },
        'accessibility.signals.lineHasInlineSuggestion': {
            ...defaultNoAnnouncement,
            'description': localize('accessibility.signals.lineHasInlineSuggestion', "Plays a sound / audio cue when the active line has an inline suggestion."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.lineHasInlineSuggestion.sound', "Plays a sound when the active line has an inline suggestion."),
                    ...soundFeatureBase,
                    'default': 'off'
                }
            }
        },
        'accessibility.signals.nextEditSuggestion': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.nextEditSuggestion', "Plays a signal - sound / audio cue and/or announcement (alert) when there is a next edit suggestion."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.nextEditSuggestion.sound', "Plays a sound when there is a next edit suggestion."),
                    ...soundFeatureBase,
                },
                'announcement': {
                    'description': localize('accessibility.signals.nextEditSuggestion.announcement', "Announces when there is a next edit suggestion."),
                    ...announcementFeatureBase,
                },
            }
        },
        'accessibility.signals.lineHasError': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.lineHasError', "Plays a signal - sound (audio cue) and/or announcement (alert) - when the active line has an error."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.lineHasError.sound', "Plays a sound when the active line has an error."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.lineHasError.announcement', "Announces when the active line has an error."),
                    ...announcementFeatureBase,
                    default: 'off'
                },
            },
        },
        'accessibility.signals.lineHasFoldedArea': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.lineHasFoldedArea', "Plays a signal - sound (audio cue) and/or announcement (alert) - the active line has a folded area that can be unfolded."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.lineHasFoldedArea.sound', "Plays a sound when the active line has a folded area that can be unfolded."),
                    ...soundFeatureBase,
                    default: 'off'
                },
                'announcement': {
                    'description': localize('accessibility.signals.lineHasFoldedArea.announcement', "Announces when the active line has a folded area that can be unfolded."),
                    ...announcementFeatureBase
                },
            }
        },
        'accessibility.signals.lineHasWarning': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.lineHasWarning', "Plays a signal - sound (audio cue) and/or announcement (alert) - when the active line has a warning."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.lineHasWarning.sound', "Plays a sound when the active line has a warning."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.lineHasWarning.announcement', "Announces when the active line has a warning."),
                    ...announcementFeatureBase,
                    default: 'off'
                },
            },
        },
        'accessibility.signals.positionHasError': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.positionHasError', "Plays a signal - sound (audio cue) and/or announcement (alert) - when the active line has a warning."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.positionHasError.sound', "Plays a sound when the active line has a warning."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.positionHasError.announcement', "Announces when the active line has a warning."),
                    ...announcementFeatureBase,
                    default: 'on'
                },
            },
        },
        'accessibility.signals.positionHasWarning': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.positionHasWarning', "Plays a signal - sound (audio cue) and/or announcement (alert) - when the active line has a warning."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.positionHasWarning.sound', "Plays a sound when the active line has a warning."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.positionHasWarning.announcement', "Announces when the active line has a warning."),
                    ...announcementFeatureBase,
                    default: 'on'
                },
            },
        },
        'accessibility.signals.onDebugBreak': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.onDebugBreak', "Plays a signal - sound (audio cue) and/or announcement (alert) - when the debugger stopped on a breakpoint."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.onDebugBreak.sound', "Plays a sound when the debugger stopped on a breakpoint."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.onDebugBreak.announcement', "Announces when the debugger stopped on a breakpoint."),
                    ...announcementFeatureBase
                },
            }
        },
        'accessibility.signals.noInlayHints': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.noInlayHints', "Plays a signal - sound (audio cue) and/or announcement (alert) - when trying to read a line with inlay hints that has no inlay hints."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.noInlayHints.sound', "Plays a sound when trying to read a line with inlay hints that has no inlay hints."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.noInlayHints.announcement', "Announces when trying to read a line with inlay hints that has no inlay hints."),
                    ...announcementFeatureBase
                },
            }
        },
        'accessibility.signals.taskCompleted': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.taskCompleted', "Plays a signal - sound (audio cue) and/or announcement (alert) - when a task is completed."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.taskCompleted.sound', "Plays a sound when a task is completed."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.taskCompleted.announcement', "Announces when a task is completed."),
                    ...announcementFeatureBase
                },
            }
        },
        'accessibility.signals.taskFailed': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.taskFailed', "Plays a signal - sound (audio cue) and/or announcement (alert) - when a task fails (non-zero exit code)."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.taskFailed.sound', "Plays a sound when a task fails (non-zero exit code)."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.taskFailed.announcement', "Announces when a task fails (non-zero exit code)."),
                    ...announcementFeatureBase
                },
            }
        },
        'accessibility.signals.terminalCommandFailed': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.terminalCommandFailed', "Plays a signal - sound (audio cue) and/or announcement (alert) - when a terminal command fails (non-zero exit code) or when a command with such an exit code is navigated to in the accessible view."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.terminalCommandFailed.sound', "Plays a sound when a terminal command fails (non-zero exit code) or when a command with such an exit code is navigated to in the accessible view."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.terminalCommandFailed.announcement', "Announces when a terminal command fails (non-zero exit code) or when a command with such an exit code is navigated to in the accessible view."),
                    ...announcementFeatureBase
                },
            }
        },
        'accessibility.signals.terminalCommandSucceeded': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.terminalCommandSucceeded', "Plays a signal - sound (audio cue) and/or announcement (alert) - when a terminal command succeeds (zero exit code) or when a command with such an exit code is navigated to in the accessible view."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.terminalCommandSucceeded.sound', "Plays a sound when a terminal command succeeds (zero exit code) or when a command with such an exit code is navigated to in the accessible view."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.terminalCommandSucceeded.announcement', "Announces when a terminal command succeeds (zero exit code) or when a command with such an exit code is navigated to in the accessible view."),
                    ...announcementFeatureBase
                },
            }
        },
        'accessibility.signals.terminalQuickFix': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.terminalQuickFix', "Plays a signal - sound (audio cue) and/or announcement (alert) - when terminal Quick Fixes are available."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.terminalQuickFix.sound', "Plays a sound when terminal Quick Fixes are available."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.terminalQuickFix.announcement', "Announces when terminal Quick Fixes are available."),
                    ...announcementFeatureBase
                },
            }
        },
        'accessibility.signals.terminalBell': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.terminalBell', "Plays a signal - sound (audio cue) and/or announcement (alert) - when the terminal bell is ringing."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.terminalBell.sound', "Plays a sound when the terminal bell is ringing."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.terminalBell.announcement', "Announces when the terminal bell is ringing."),
                    ...announcementFeatureBase
                },
            }
        },
        'accessibility.signals.diffLineInserted': {
            ...defaultNoAnnouncement,
            'description': localize('accessibility.signals.diffLineInserted', "Plays a sound / audio cue when the focus moves to an inserted line in Accessible Diff Viewer mode or to the next/previous change."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.sound', "Plays a sound when the focus moves to an inserted line in Accessible Diff Viewer mode or to the next/previous change."),
                    ...soundFeatureBase
                }
            }
        },
        'accessibility.signals.diffLineModified': {
            ...defaultNoAnnouncement,
            'description': localize('accessibility.signals.diffLineModified', "Plays a sound / audio cue when the focus moves to an modified line in Accessible Diff Viewer mode or to the next/previous change."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.diffLineModified.sound', "Plays a sound when the focus moves to a modified line in Accessible Diff Viewer mode or to the next/previous change."),
                    ...soundFeatureBase
                }
            }
        },
        'accessibility.signals.diffLineDeleted': {
            ...defaultNoAnnouncement,
            'description': localize('accessibility.signals.diffLineDeleted', "Plays a sound / audio cue when the focus moves to an deleted line in Accessible Diff Viewer mode or to the next/previous change."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.diffLineDeleted.sound', "Plays a sound when the focus moves to an deleted line in Accessible Diff Viewer mode or to the next/previous change."),
                    ...soundFeatureBase
                }
            }
        },
        'accessibility.signals.chatEditModifiedFile': {
            ...defaultNoAnnouncement,
            'description': localize('accessibility.signals.chatEditModifiedFile', "Plays a sound / audio cue when revealing a file with changes from chat edits"),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.chatEditModifiedFile.sound', "Plays a sound when revealing a file with changes from chat edits"),
                    ...soundFeatureBase
                }
            }
        },
        'accessibility.signals.notebookCellCompleted': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.notebookCellCompleted', "Plays a signal - sound (audio cue) and/or announcement (alert) - when a notebook cell execution is successfully completed."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.notebookCellCompleted.sound', "Plays a sound when a notebook cell execution is successfully completed."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.notebookCellCompleted.announcement', "Announces when a notebook cell execution is successfully completed."),
                    ...announcementFeatureBase
                },
            }
        },
        'accessibility.signals.notebookCellFailed': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.notebookCellFailed', "Plays a signal - sound (audio cue) and/or announcement (alert) - when a notebook cell execution fails."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.notebookCellFailed.sound', "Plays a sound when a notebook cell execution fails."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.notebookCellFailed.announcement', "Announces when a notebook cell execution fails."),
                    ...announcementFeatureBase
                },
            }
        },
        'accessibility.signals.progress': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.progress', "Plays a signal - sound (audio cue) and/or announcement (alert) - on loop while progress is occurring."),
            'default': {
                'sound': 'auto',
                'announcement': 'off'
            },
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.progress.sound', "Plays a sound on loop while progress is occurring."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.progress.announcement', "Alerts on loop while progress is occurring."),
                    ...announcementFeatureBase
                },
            },
        },
        'accessibility.signals.chatRequestSent': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.chatRequestSent', "Plays a signal - sound (audio cue) and/or announcement (alert) - when a chat request is made."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.chatRequestSent.sound', "Plays a sound when a chat request is made."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.chatRequestSent.announcement', "Announces when a chat request is made."),
                    ...announcementFeatureBase
                },
            }
        },
        'accessibility.signals.chatResponseReceived': {
            ...defaultNoAnnouncement,
            'description': localize('accessibility.signals.chatResponseReceived', "Plays a sound / audio cue when the response has been received."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.chatResponseReceived.sound', "Plays a sound on when the response has been received."),
                    ...soundFeatureBase
                },
            }
        },
        'accessibility.signals.codeActionTriggered': {
            ...defaultNoAnnouncement,
            'description': localize('accessibility.signals.codeActionTriggered', "Plays a sound / audio cue - when a code action has been triggered."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.codeActionTriggered.sound', "Plays a sound when a code action has been triggered."),
                    ...soundFeatureBase
                }
            }
        },
        'accessibility.signals.codeActionApplied': {
            ...defaultNoAnnouncement,
            'description': localize('accessibility.signals.codeActionApplied', "Plays a sound / audio cue when the code action has been applied."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.codeActionApplied.sound', "Plays a sound when the code action has been applied."),
                    ...soundFeatureBase
                },
            }
        },
        'accessibility.signals.voiceRecordingStarted': {
            ...defaultNoAnnouncement,
            'description': localize('accessibility.signals.voiceRecordingStarted', "Plays a sound / audio cue when the voice recording has started."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.voiceRecordingStarted.sound', "Plays a sound when the voice recording has started."),
                    ...soundFeatureBase,
                },
            },
            'default': {
                'sound': 'on'
            }
        },
        'accessibility.signals.voiceRecordingStopped': {
            ...defaultNoAnnouncement,
            'description': localize('accessibility.signals.voiceRecordingStopped', "Plays a sound / audio cue when the voice recording has stopped."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.voiceRecordingStopped.sound', "Plays a sound when the voice recording has stopped."),
                    ...soundFeatureBase,
                    default: 'off'
                },
            }
        },
        'accessibility.signals.clear': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.clear', "Plays a signal - sound (audio cue) and/or announcement (alert) - when a feature is cleared (for example, the terminal, Debug Console, or Output channel)."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.clear.sound', "Plays a sound when a feature is cleared."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.clear.announcement', "Announces when a feature is cleared."),
                    ...announcementFeatureBase
                },
            },
        },
        'accessibility.signals.editsUndone': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.editsUndone', "Plays a signal - sound (audio cue) and/or announcement (alert) - when edits have been undone."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.editsUndone.sound', "Plays a sound when edits have been undone."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.editsUndone.announcement', "Announces when edits have been undone."),
                    ...announcementFeatureBase
                },
            },
        },
        'accessibility.signals.editsKept': {
            ...signalFeatureBase,
            'description': localize('accessibility.signals.editsKept', "Plays a signal - sound (audio cue) and/or announcement (alert) - when edits are kept."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.editsKept.sound', "Plays a sound when edits are kept."),
                    ...soundFeatureBase
                },
                'announcement': {
                    'description': localize('accessibility.signals.editsKept.announcement', "Announces when edits are kept."),
                    ...announcementFeatureBase
                },
            },
        },
        'accessibility.signals.save': {
            'type': 'object',
            'tags': ['accessibility'],
            additionalProperties: false,
            'markdownDescription': localize('accessibility.signals.save', "Plays a signal - sound (audio cue) and/or announcement (alert) - when a file is saved."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.save.sound', "Plays a sound when a file is saved."),
                    'type': 'string',
                    'enum': ['userGesture', 'always', 'never'],
                    'default': 'never',
                    'enumDescriptions': [
                        localize('accessibility.signals.save.sound.userGesture', "Plays the sound when a user explicitly saves a file."),
                        localize('accessibility.signals.save.sound.always', "Plays the sound whenever a file is saved, including auto save."),
                        localize('accessibility.signals.save.sound.never', "Never plays the sound.")
                    ],
                },
                'announcement': {
                    'description': localize('accessibility.signals.save.announcement', "Announces when a file is saved."),
                    'type': 'string',
                    'enum': ['userGesture', 'always', 'never'],
                    'default': 'never',
                    'enumDescriptions': [
                        localize('accessibility.signals.save.announcement.userGesture', "Announces when a user explicitly saves a file."),
                        localize('accessibility.signals.save.announcement.always', "Announces whenever a file is saved, including auto save."),
                        localize('accessibility.signals.save.announcement.never', "Never plays the announcement.")
                    ],
                },
            },
            default: {
                'sound': 'never',
                'announcement': 'never'
            }
        },
        'accessibility.signals.format': {
            'type': 'object',
            'tags': ['accessibility'],
            additionalProperties: false,
            'markdownDescription': localize('accessibility.signals.format', "Plays a signal - sound (audio cue) and/or announcement (alert) - when a file or notebook is formatted."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.format.sound', "Plays a sound when a file or notebook is formatted."),
                    'type': 'string',
                    'enum': ['userGesture', 'always', 'never'],
                    'default': 'never',
                    'enumDescriptions': [
                        localize('accessibility.signals.format.userGesture', "Plays the sound when a user explicitly formats a file."),
                        localize('accessibility.signals.format.always', "Plays the sound whenever a file is formatted, including if it is set to format on save, type, or, paste, or run of a cell."),
                        localize('accessibility.signals.format.never', "Never plays the sound.")
                    ],
                },
                'announcement': {
                    'description': localize('accessibility.signals.format.announcement', "Announces when a file or notebook is formatted."),
                    'type': 'string',
                    'enum': ['userGesture', 'always', 'never'],
                    'default': 'never',
                    'enumDescriptions': [
                        localize('accessibility.signals.format.announcement.userGesture', "Announces when a user explicitly formats a file."),
                        localize('accessibility.signals.format.announcement.always', "Announces whenever a file is formatted, including if it is set to format on save, type, or, paste, or run of a cell."),
                        localize('accessibility.signals.format.announcement.never', "Never announces.")
                    ],
                },
            },
            default: {
                'sound': 'never',
                'announcement': 'never'
            }
        },
        'accessibility.signals.chatUserActionRequired': {
            ...signalFeatureBase,
            'markdownDescription': localize('accessibility.signals.chatUserActionRequired', "Plays a signal - sound (audio cue) and/or announcement (alert) - when user action is required in the chat."),
            'properties': {
                'sound': {
                    'description': localize('accessibility.signals.chatUserActionRequired.sound', "Plays a sound when user action is required in the chat."),
                    'type': 'string',
                    'enum': ['auto', 'on', 'off'],
                    'enumDescriptions': [
                        localize('sound.enabled.autoWindow', "Enable sound when a screen reader is attached."),
                        localize('sound.enabled.on', "Enable sound."),
                        localize('sound.enabled.off', "Disable sound.")
                    ],
                },
                'announcement': {
                    'description': localize('accessibility.signals.chatUserActionRequired.announcement', "Announces when a user action is required in the chat - including information about the action and how to take it."),
                    ...announcementFeatureBase
                },
            },
            default: {
                'sound': 'auto',
                'announcement': 'auto'
            },
            tags: ['accessibility']
        },
        'accessibility.underlineLinks': {
            'type': 'boolean',
            'description': localize('accessibility.underlineLinks', "Controls whether links should be underlined in the workbench."),
            'default': false,
        },
        'accessibility.debugWatchVariableAnnouncements': {
            'type': 'boolean',
            'description': localize('accessibility.debugWatchVariableAnnouncements', "Controls whether variable changes should be announced in the debug watch view."),
            'default': true,
        },
        'accessibility.replEditor.readLastExecutionOutput': {
            'type': 'boolean',
            'description': localize('accessibility.replEditor.readLastExecutedOutput', "Controls whether the output from an execution in the native REPL will be announced."),
            'default': true,
        },
        'accessibility.replEditor.autoFocusReplExecution': {
            type: 'string',
            enum: ['none', 'input', 'lastExecution'],
            default: 'input',
            description: localize('replEditor.autoFocusAppendedCell', "Control whether focus should automatically be sent to the REPL when code is executed."),
        },
        'accessibility.windowTitleOptimized': {
            'type': 'boolean',
            'default': true,
            'markdownDescription': localize('accessibility.windowTitleOptimized', "Controls whether the {0} should be optimized for screen readers when in screen reader mode. When enabled, the window title will have {1} appended to the end.", '`#window.title#`', '`activeEditorState`')
        },
        'accessibility.openChatEditedFiles': {
            'type': 'boolean',
            'default': false,
            'markdownDescription': localize('accessibility.openChatEditedFiles', "Controls whether files should be opened when the chat agent has applied edits to them.")
        },
        'accessibility.verboseChatProgressUpdates': {
            'type': 'boolean',
            'default': true,
            'markdownDescription': localize('accessibility.verboseChatProgressUpdates', "Controls whether verbose progress announcements should be made when a chat request is in progress, including information like searched text for <search term> with X results, created file <file_name>, or read file <file path>.")
        }
    }
};
export function registerAccessibilityConfiguration() {
    const registry = Registry.as(Extensions.Configuration);
    registry.registerConfiguration(configuration);
    registry.registerConfiguration({
        ...workbenchConfigurationNodeBase,
        properties: {
            ["accessibility.dimUnfocused.enabled" /* AccessibilityWorkbenchSettingId.DimUnfocusedEnabled */]: {
                description: localize('dimUnfocusedEnabled', 'Whether to dim unfocused editors and terminals, which makes it more clear where typed input will go to. This works with the majority of editors with the notable exceptions of those that utilize iframes like notebooks and extension webview editors.'),
                type: 'boolean',
                default: false,
                tags: ['accessibility'],
                scope: 1 /* ConfigurationScope.APPLICATION */,
            },
            ["accessibility.dimUnfocused.opacity" /* AccessibilityWorkbenchSettingId.DimUnfocusedOpacity */]: {
                markdownDescription: localize('dimUnfocusedOpacity', 'The opacity fraction (0.2 to 1.0) to use for unfocused editors and terminals. This will only take effect when {0} is enabled.', `\`#${"accessibility.dimUnfocused.enabled" /* AccessibilityWorkbenchSettingId.DimUnfocusedEnabled */}#\``),
                type: 'number',
                minimum: 0.2 /* ViewDimUnfocusedOpacityProperties.Minimum */,
                maximum: 1 /* ViewDimUnfocusedOpacityProperties.Maximum */,
                default: 0.75 /* ViewDimUnfocusedOpacityProperties.Default */,
                tags: ['accessibility'],
                scope: 1 /* ConfigurationScope.APPLICATION */,
            },
            ["accessibility.hideAccessibleView" /* AccessibilityWorkbenchSettingId.HideAccessibleView */]: {
                description: localize('accessibility.hideAccessibleView', "Controls whether the Accessible View is hidden."),
                type: 'boolean',
                default: false,
                tags: ['accessibility']
            },
            ["accessibility.verboseChatProgressUpdates" /* AccessibilityWorkbenchSettingId.VerboseChatProgressUpdates */]: {
                'type': 'boolean',
                'default': true,
                'markdownDescription': localize('accessibility.verboseChatProgressUpdates', "Controls whether verbose progress announcements should be made when a chat request is in progress, including information like searched text for <search term> with X results, created file <file_name>, or read file <file path>.")
            }
        }
    });
}
export { AccessibilityVoiceSettingId };
export const SpeechTimeoutDefault = 0;
let DynamicSpeechAccessibilityConfiguration = class DynamicSpeechAccessibilityConfiguration extends Disposable {
    static { this.ID = 'workbench.contrib.dynamicSpeechAccessibilityConfiguration'; }
    constructor(speechService) {
        super();
        this.speechService = speechService;
        this._register(Event.runAndSubscribe(speechService.onDidChangeHasSpeechProvider, () => this.updateConfiguration()));
    }
    updateConfiguration() {
        if (!this.speechService.hasSpeechProvider) {
            return; // these settings require a speech provider
        }
        const languages = this.getLanguages();
        const languagesSorted = Object.keys(languages).sort((langA, langB) => {
            return languages[langA].name.localeCompare(languages[langB].name);
        });
        const registry = Registry.as(Extensions.Configuration);
        registry.registerConfiguration({
            ...accessibilityConfigurationNodeBase,
            properties: {
                ["accessibility.voice.speechTimeout" /* AccessibilityVoiceSettingId.SpeechTimeout */]: {
                    'markdownDescription': localize('voice.speechTimeout', "The duration in milliseconds that voice speech recognition remains active after you stop speaking. For example in a chat session, the transcribed text is submitted automatically after the timeout is met. Set to `0` to disable this feature."),
                    'type': 'number',
                    'default': SpeechTimeoutDefault,
                    'minimum': 0,
                    'tags': ['accessibility']
                },
                ["accessibility.voice.ignoreCodeBlocks" /* AccessibilityVoiceSettingId.IgnoreCodeBlocks */]: {
                    'markdownDescription': localize('voice.ignoreCodeBlocks', "Whether to ignore code snippets in text-to-speech synthesis."),
                    'type': 'boolean',
                    'default': false,
                    'tags': ['accessibility']
                },
                ["accessibility.voice.speechLanguage" /* AccessibilityVoiceSettingId.SpeechLanguage */]: {
                    'markdownDescription': localize('voice.speechLanguage', "The language that text-to-speech and speech-to-text should use. Select `auto` to use the configured display language if possible. Note that not all display languages maybe supported by speech recognition and synthesizers."),
                    'type': 'string',
                    'enum': languagesSorted,
                    'default': 'auto',
                    'tags': ['accessibility'],
                    'enumDescriptions': languagesSorted.map(key => languages[key].name),
                    'enumItemLabels': languagesSorted.map(key => languages[key].name)
                },
                ["accessibility.voice.autoSynthesize" /* AccessibilityVoiceSettingId.AutoSynthesize */]: {
                    'type': 'string',
                    'enum': ['on', 'off'],
                    'enumDescriptions': [
                        localize('accessibility.voice.autoSynthesize.on', "Enable the feature. When a screen reader is enabled, note that this will disable aria updates."),
                        localize('accessibility.voice.autoSynthesize.off', "Disable the feature."),
                    ],
                    'markdownDescription': localize('autoSynthesize', "Whether a textual response should automatically be read out aloud when speech was used as input. For example in a chat session, a response is automatically synthesized when voice was used as chat request."),
                    'default': 'off',
                    'tags': ['accessibility']
                }
            }
        });
    }
    getLanguages() {
        return {
            ['auto']: {
                name: localize('speechLanguage.auto', "Auto (Use Display Language)")
            },
            ...SPEECH_LANGUAGES
        };
    }
};
DynamicSpeechAccessibilityConfiguration = __decorate([
    __param(0, ISpeechService)
], DynamicSpeechAccessibilityConfiguration);
export { DynamicSpeechAccessibilityConfiguration };
Registry.as(WorkbenchExtensions.ConfigurationMigration)
    .registerConfigurationMigrations([{
        key: 'audioCues.volume',
        migrateFn: (value, accessor) => {
            return [
                ['accessibility.signalOptions.volume', { value }],
                ['audioCues.volume', { value: undefined }]
            ];
        }
    }]);
Registry.as(WorkbenchExtensions.ConfigurationMigration)
    .registerConfigurationMigrations([{
        key: 'audioCues.debouncePositionChanges',
        migrateFn: (value) => {
            return [
                ['accessibility.signalOptions.debouncePositionChanges', { value }],
                ['audioCues.debouncePositionChanges', { value: undefined }]
            ];
        }
    }]);
Registry.as(WorkbenchExtensions.ConfigurationMigration)
    .registerConfigurationMigrations([{
        key: 'accessibility.signalOptions',
        migrateFn: (value, accessor) => {
            const delayGeneral = getDelaysFromConfig(accessor, 'general');
            const delayError = getDelaysFromConfig(accessor, 'errorAtPosition');
            const delayWarning = getDelaysFromConfig(accessor, 'warningAtPosition');
            const volume = getVolumeFromConfig(accessor);
            const debouncePositionChanges = getDebouncePositionChangesFromConfig(accessor);
            const result = [];
            if (!!volume) {
                result.push(['accessibility.signalOptions.volume', { value: volume }]);
            }
            if (!!delayGeneral) {
                result.push(['accessibility.signalOptions.experimental.delays.general', { value: delayGeneral }]);
            }
            if (!!delayError) {
                result.push(['accessibility.signalOptions.experimental.delays.errorAtPosition', { value: delayError }]);
            }
            if (!!delayWarning) {
                result.push(['accessibility.signalOptions.experimental.delays.warningAtPosition', { value: delayWarning }]);
            }
            if (!!debouncePositionChanges) {
                result.push(['accessibility.signalOptions.debouncePositionChanges', { value: debouncePositionChanges }]);
            }
            result.push(['accessibility.signalOptions', { value: undefined }]);
            return result;
        }
    }]);
Registry.as(WorkbenchExtensions.ConfigurationMigration)
    .registerConfigurationMigrations([{
        key: 'accessibility.signals.sounds.volume',
        migrateFn: (value) => {
            return [
                ['accessibility.signalOptions.volume', { value }],
                ['accessibility.signals.sounds.volume', { value: undefined }]
            ];
        }
    }]);
Registry.as(WorkbenchExtensions.ConfigurationMigration)
    .registerConfigurationMigrations([{
        key: 'accessibility.signals.debouncePositionChanges',
        migrateFn: (value) => {
            return [
                ['accessibility.signalOptions.debouncePositionChanges', { value }],
                ['accessibility.signals.debouncePositionChanges', { value: undefined }]
            ];
        }
    }]);
function getDelaysFromConfig(accessor, type) {
    return accessor(`accessibility.signalOptions.experimental.delays.${type}`) || accessor('accessibility.signalOptions')?.['experimental.delays']?.[`${type}`] || accessor('accessibility.signalOptions')?.['delays']?.[`${type}`];
}
function getVolumeFromConfig(accessor) {
    return accessor('accessibility.signalOptions.volume') || accessor('accessibility.signalOptions')?.volume || accessor('accessibility.signals.sounds.volume') || accessor('audioCues.volume');
}
function getDebouncePositionChangesFromConfig(accessor) {
    return accessor('accessibility.signalOptions.debouncePositionChanges') || accessor('accessibility.signalOptions')?.debouncePositionChanges || accessor('accessibility.signals.debouncePositionChanges') || accessor('audioCues.debouncePositionChanges');
}
Registry.as(WorkbenchExtensions.ConfigurationMigration)
    .registerConfigurationMigrations([{
        key: "accessibility.voice.autoSynthesize" /* AccessibilityVoiceSettingId.AutoSynthesize */,
        migrateFn: (value) => {
            let newValue;
            if (value === true) {
                newValue = 'on';
            }
            else if (value === false) {
                newValue = 'off';
            }
            else {
                return [];
            }
            return [
                ["accessibility.voice.autoSynthesize" /* AccessibilityVoiceSettingId.AutoSynthesize */, { value: newValue }],
            ];
        }
    }]);
Registry.as(WorkbenchExtensions.ConfigurationMigration)
    .registerConfigurationMigrations([{
        key: 'accessibility.signals.chatResponsePending',
        migrateFn: (value, accessor) => {
            return [
                ['accessibility.signals.progress', { value }],
                ['accessibility.signals.chatResponsePending', { value: undefined }],
            ];
        }
    }]);
Registry.as(WorkbenchExtensions.ConfigurationMigration)
    .registerConfigurationMigrations(AccessibilitySignal.allAccessibilitySignals.map(item => item.legacySoundSettingsKey ? ({
    key: item.legacySoundSettingsKey,
    migrateFn: (sound, accessor) => {
        const configurationKeyValuePairs = [];
        const legacyAnnouncementSettingsKey = item.legacyAnnouncementSettingsKey;
        let announcement;
        if (legacyAnnouncementSettingsKey) {
            announcement = accessor(legacyAnnouncementSettingsKey) ?? undefined;
            if (announcement !== undefined && typeof announcement !== 'string') {
                announcement = announcement ? 'auto' : 'off';
            }
        }
        configurationKeyValuePairs.push([`${item.legacySoundSettingsKey}`, { value: undefined }]);
        configurationKeyValuePairs.push([`${item.settingsKey}`, { value: announcement !== undefined ? { announcement, sound } : { sound } }]);
        return configurationKeyValuePairs;
    }
}) : undefined).filter(isDefined));
Registry.as(WorkbenchExtensions.ConfigurationMigration)
    .registerConfigurationMigrations(AccessibilitySignal.allAccessibilitySignals.filter(i => !!i.legacyAnnouncementSettingsKey && !!i.legacySoundSettingsKey).map(item => ({
    key: item.legacyAnnouncementSettingsKey,
    migrateFn: (announcement, accessor) => {
        const configurationKeyValuePairs = [];
        const sound = accessor(item.settingsKey)?.sound || accessor(item.legacySoundSettingsKey);
        if (announcement !== undefined && typeof announcement !== 'string') {
            announcement = announcement ? 'auto' : 'off';
        }
        configurationKeyValuePairs.push([`${item.settingsKey}`, { value: announcement !== undefined ? { announcement, sound } : { sound } }]);
        configurationKeyValuePairs.push([`${item.legacyAnnouncementSettingsKey}`, { value: undefined }]);
        configurationKeyValuePairs.push([`${item.legacySoundSettingsKey}`, { value: undefined }]);
        return configurationKeyValuePairs;
    }
})));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvYWNjZXNzaWJpbGl0eS9icm93c2VyL2FjY2Vzc2liaWxpdHlDb25maWd1cmF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQXNCLFVBQVUsRUFBNEUsTUFBTSxvRUFBb0UsQ0FBQztBQUM5TCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDNUUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3JGLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxVQUFVLElBQUksbUJBQW1CLEVBQXVGLE1BQU0sa0NBQWtDLENBQUM7QUFDMU0sT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sZ0ZBQWdGLENBQUM7QUFDckgsT0FBTyxFQUFFLDJCQUEyQixFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3JILE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUVsRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRTdELE1BQU0sQ0FBQyxNQUFNLHdCQUF3QixHQUFHLElBQUksYUFBYSxDQUFVLDBCQUEwQixFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztBQUM1RyxNQUFNLENBQUMsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLGFBQWEsQ0FBVSx1QkFBdUIsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDdEcsTUFBTSxDQUFD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QUssQ0FBQztRQUM5QyxDQUFDO1FBQ0QsMEJBQTBCLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsWUFBWSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDdEksMEJBQTBCLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsNkJBQTZCLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDakcsMEJBQTBCLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUYsT0FBTywwQkFBMEIsQ0FBQztJQUNuQyxDQUFDO0NBQ0QsQ0FBQyxDQUFDLENBQUMsQ0FBQyJ9