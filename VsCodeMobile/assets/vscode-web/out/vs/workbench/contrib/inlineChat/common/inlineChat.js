/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../nls.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { Extensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { diffInserted, diffRemoved, editorWidgetBackground, editorWidgetBorder, editorWidgetForeground, focusBorder, inputBackground, inputPlaceholderForeground, registerColor, transparent, widgetShadow } from '../../../../platform/theme/common/colorRegistry.js';
import { NOTEBOOK_IS_ACTIVE_EDITOR } from '../../notebook/common/notebookContextKeys.js';
// settings
export var InlineChatConfigKeys;
(function (InlineChatConfigKeys) {
    InlineChatConfigKeys["FinishOnType"] = "inlineChat.finishOnType";
    InlineChatConfigKeys["StartWithOverlayWidget"] = "inlineChat.startWithOverlayWidget";
    InlineChatConfigKeys["HoldToSpeech"] = "inlineChat.holdToSpeech";
    InlineChatConfigKeys["AccessibleDiffView"] = "inlineChat.accessibleDiffView";
    /** @deprecated do not read on client */
    InlineChatConfigKeys["EnableV2"] = "inlineChat.enableV2";
    InlineChatConfigKeys["notebookAgent"] = "inlineChat.notebookAgent";
})(InlineChatConfigKeys || (InlineChatConfigKeys = {}));
Registry.as(Extensions.Configuration).registerConfiguration({
    id: 'editor',
    properties: {
        ["inlineChat.finishOnType" /* InlineChatConfigKeys.FinishOnType */]: {
            description: localize('finishOnType', "Whether to finish an inline chat session when typing outside of changed regions."),
            default: false,
            type: 'boolean'
        },
        ["inlineChat.holdToSpeech" /* InlineChatConfigKeys.HoldToSpeech */]: {
            description: localize('holdToSpeech', "Whether holding the inline chat keybinding will automatically enable speech recognition."),
            default: true,
            type: 'boolean'
        },
        ["inlineChat.accessibleDiffView" /* InlineChatConfigKeys.AccessibleDiffView */]: {
            description: localize('accessibleDiffView', "Whether the inline chat also renders an accessible diff viewer for its changes."),
            default: 'auto',
            type: 'string',
            enum: ['auto', 'on', 'off'],
            markdownEnumDescriptions: [
                localize('accessibleDiffView.auto', "The accessible diff viewer is based on screen reader mode being enabled."),
                localize('accessibleDiffView.on', "The accessible diff viewer is always enabled."),
                localize('accessibleDiffView.off', "The accessible diff viewer is never enabled."),
            ],
        },
        ["inlineChat.enableV2" /* InlineChatConfigKeys.EnableV2 */]: {
            description: localize('enableV2', "Whether to use the next version of inline chat."),
            default: false,
            type: 'boolean',
            tags: ['preview'],
            experiment: {
                mode: 'auto'
            }
        },
        ["inlineChat.notebookAgent" /* InlineChatConfigKeys.notebookAgent */]: {
            markdownDescription: localize('notebookAgent', "Enable agent-like behavior for inline chat widget in notebooks."),
            default: false,
            type: 'boolean',
            tags: ['experimental'],
            experiment: {
                mode: 'startup'
            }
        }
    }
});
export const INLINE_CHAT_ID = 'interactiveEditor';
export const INTERACTIVE_EDITOR_ACCESSIBILITY_HELP_ID = 'interactiveEditorAccessiblityHelp';
// --- CONTEXT
export var InlineChatResponseType;
(function (InlineChatResponseType) {
    InlineChatResponseType["None"] = "none";
    InlineChatResponseType["Messages"] = "messages";
    InlineChatResponseType["MessagesAndEdits"] = "messagesAndEdits";
})(InlineChatResponseType || (InlineChatResponseType = {}));
export const CTX_INLINE_CHAT_POSSIBLE = new RawContextKey('inlineChatPossible', false, localize('inlineChatHasPossible', "Whether a provider for inline chat exists and whether an editor for inline chat is open"));
/** @deprecated */
const CTX_INLINE_CHAT_HAS_AGENT = new RawContextKey('inlineChatHasProvider', false, localize('inlineChatHasProvider', "Whether a provider for interactive editors exists"));
export const CTX_INLINE_CHAT_HAS_AGENT2 = new RawContextKey('inlineChatHasEditsAgent', false, localize('inlineChatHasEditsAgent', "Whether an agent for inline for interactive editors exists"));
export const CTX_INLINE_CHAT_HAS_NOTEBOOK_INLINE = new RawContextKey('inlineChatHasNotebookInline', false, localize('inlineChatHasNotebookInline', "Whether an agent for notebook cells exists"));
export const CTX_INLINE_CHAT_HAS_NOTEBOOK_AGENT = new RawContextKey('inlineChatHasNotebookAgent', false, localize('inlineChatHasNotebookAgent', "Whether an agent for notebook cells exists"));
export const CTX_INLINE_CHAT_VISIBLE = new RawContextKey('inlineChatVisible', false, localize('inlineChatVisible', "Whether the interactive editor input is visible"));
export const CTX_INLINE_CHAT_FOCUSED = new RawContextKey('inlineChatFocused', false, localize('inlineChatFocused', "Whether the interactive editor input is focused"));
export const CTX_INLINE_CHAT_EDITING = new RawContextKey('inlineChatEditing', true, localize('inlineChatEditing', "Whether the user is currently editing or generating code in the inline chat"));
export const CTX_INLINE_CHAT_RESPONSE_FOCUSED = new RawContextKey('inlineChatResponseFocused', false, localize('inlineChatResponseFocused', "Whether the interactive widget's response is focused"));
export const CTX_INLINE_CHAT_EMPTY = new RawContextKey('inlineChatEmpty', false, localize('inlineChatEmpty', "Whether the interactive editor input is empty"));
export const CTX_INLINE_CHAT_INNER_CURSOR_FIRST = new RawContextKey('inlineChatInnerCursorFirst', false, localize('inlineChatInnerCursorFirst', "Whether the cursor of the iteractive editor input is on the first line"));
export const CTX_INLINE_CHAT_INNER_CURSOR_LAST = new RawContextKey('inlineChatInnerCursorLast', false, localize('inlineChatInnerCursorLast', "Whether the cursor of the iteractive editor input is on the last line"));
export const CTX_INLINE_CHAT_OUTER_CURSOR_POSITION = new RawContextKey('inlineChatOuterCursorPosition', '', localize('inlineChatOuterCursorPosition', "Whether the cursor of the outer editor is above or below the interactive editor input"));
export const CTX_INLINE_CHAT_HAS_STASHED_SESSION = new RawContextKey('inlineChatHasStashedSession', false, localize('inlineChatHasStashedSession', "Whether interactive editor has kept a session for quick restore"));
export const CTX_INLINE_CHAT_CHANGE_HAS_DIFF = new RawContextKey('inlineChatChangeHasDiff', false, localize('inlineChatChangeHasDiff', "Whether the current change supports showing a diff"));
export const CTX_INLINE_CHAT_CHANGE_SHOWS_DIFF = new RawContextKey('inlineChatChangeShowsDiff', false, localize('inlineChatChangeShowsDiff', "Whether the current change showing a diff"));
export const CTX_INLINE_CHAT_REQUEST_IN_PROGRESS = new RawContextKey('inlineChatRequestInProgress', false, localize('inlineChatRequestInProgress', "Whether an inline chat request is currently in progress"));
export const CTX_INLINE_CHAT_RESPONSE_TYPE = new RawContextKey('inlineChatResponseType', "none" /* InlineChatResponseType.None */, localize('inlineChatResponseTypes', "What type was the responses have been receieved, nothing yet, just messages, or messaged and local edits"));
export const CTX_INLINE_CHAT_V1_ENABLED = ContextKeyExpr.or(ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR.negate(), CTX_INLINE_CHAT_HAS_AGENT), ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, CTX_INLINE_CHAT_HAS_NOTEBOOK_INLINE));
export const CTX_INLINE_CHAT_V2_ENABLED = ContextKeyExpr.or(ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR.negate(), CTX_INLINE_CHAT_HAS_AGENT2), ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, CTX_INLINE_CHAT_HAS_NOTEBOOK_AGENT));
// --- (selected) action identifier
export const ACTION_START = 'inlineChat.start';
export const ACTION_ACCEPT_CHANGES = 'inlineChat.acceptChanges';
export const ACTION_DISCARD_CHANGES = 'inlineChat.discardHunkChange';
export const ACTION_REGENERATE_RESPONSE = 'inlineChat.regenerate';
export const ACTION_VIEW_IN_CHAT = 'inlineChat.viewInChat';
export const ACTION_TOGGLE_DIFF = 'inlineChat.toggleDiff';
export const ACTION_REPORT_ISSUE = 'inlineChat.reportIssue';
// --- menus
export const MENU_INLINE_CHAT_WIDGET_STATUS = MenuId.for('inlineChatWidget.status');
export const MENU_INLINE_CHAT_WIDGET_SECONDARY = MenuId.for('inlineChatWidget.secondary');
export const MENU_INLINE_CHAT_ZONE = MenuId.for('inlineChatWidget.changesZone');
export const MENU_INLINE_CHAT_SIDE = MenuId.for('inlineChatWidget.side');
// --- colors
export const inlineChatForeground = registerColor('inlineChat.foreground', editorWidgetForeground, localize('inlineChat.foreground', "Foreground color of the interactive editor widget"));
export const inlineChatBackground = registerColor('inlineChat.background', editorWidgetBackground, localize('inlineChat.background', "Background color of the interactive editor widget"));
export const inlineChatBorder = registerColor('inlineChat.border', editorWidgetBorder, localize('inlineChat.border', "Border color of the interactive editor widget"));
export const inlineChatShadow = registerColor('inlineChat.shadow', widgetShadow, localize('inlineChat.shadow', "Shadow color of the interactive editor widget"));
export const inlineChatInputBorder = registerColor('inlineChatInput.border', editorWidgetBorder, localize('inlineChatInput.border', "Border color of the interactive editor input"));
export const inlineChatInputFocusBorder = registerColor('inlineChatInput.focusBorder', focusBorder, localize('inlineChatInput.focusBorder', "Border color of the interactive editor input when focused"));
export const inlineChatInputPlaceholderForeground = registerColor('inlineChatInput.placeholderForeground', inputPlaceholderForeground, localize('inlineChatInput.placeholderForeground', "Foreground color of the interactive editor input placeholder"));
export const inlineChatInputBackground = registerColor('inlineChatInput.background', inputBackground, localize('inlineChatInput.background', "Background color of the interactive editor input"));
export const inlineChatDiffInserted = registerColor('inlineChatDiff.inserted', transparent(diffInserted, .5), localize('inlineChatDiff.inserted', "Background color of inserted text in the interactive editor input"));
export const overviewRulerInlineChatDiffInserted = registerColor('editorOverviewRuler.inlineChatInserted', { dark: transparent(diffInserted, 0.6), light: transparent(diffInserted, 0.8), hcDark: transparent(diffInserted, 0.6), hcLight: transparent(diffInserted, 0.8) }, localize('editorOverviewRuler.inlineChatInserted', 'Overview ruler marker color for inline chat inserted content.'));
export const minimapInlineChatDiffInserted = registerColor('editorMinimap.inlineChatInserted', { dark: transparent(diffInserted, 0.6), light: transparent(diffInserted, 0.8), hcDark: transparent(diffInserted, 0.6), hcLight: transparent(diffInserted, 0.8) }, localize('editorMinimap.inlineChatInserted', 'Minimap marker color for inline chat inserted content.'));
export const inlineChatDiffRemoved = registerColor('inlineChatDiff.removed', transparent(diffRemoved, .5), localize('inlineChatDiff.removed', "Background color of removed text in the interactive editor input"));
export const overviewRulerInlineChatDiffRemoved = registerColor('editorOverviewRuler.inlineChatRemoved', { dark: transparent(diffRemoved, 0.6), light: transparent(diffRemoved, 0.8), hcDark: transparent(diffRemoved, 0.6), hcLight: transparent(diffRemoved, 0.8) }, localize('editorOverviewRuler.inlineChatRemoved', 'Overview ruler marker color for inline chat removed content.'));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ2hhdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDaGF0L2NvbW1vbi9pbmxpbmVDaGF0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDeEUsT0FBTyxFQUFFLFVBQVUsRUFBMEIsTUFBTSxvRUFBb0UsQ0FBQztBQUN4SCxPQUFPLEVBQUUsY0FBYyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsWUFBWSxFQUFFLFdBQVcsRUFBRSxzQkFBc0IsRUFBRSxrQkFBa0IsRUFBRSxzQkFBc0IsRUFBRSxXQUFXLEVBQUUsZUFBZSxFQUFFLDBCQUEwQixFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDdlEsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFFekYsV0FBVztBQUVYLE1BQU0sQ0FBTixJQUFrQixvQkFRakI7QUFSRCxXQUFrQixvQkFBb0I7SUFDckMsZ0VBQXdDLENBQUE7SUFDeEMsb0ZBQTRELENBQUE7SUFDNUQsZ0VBQXdDLENBQUE7SUFDeEMsNEVBQW9ELENBQUE7SUFDcEQsd0NBQXdDO0lBQ3hDLHdEQUFnQyxDQUFBO0lBQ2hDLGtFQUEwQyxDQUFBO0FBQzNDLENBQUMsRUFSaUIsb0JBQW9CLEtBQXBCLG9CQUFvQixRQVFyQztBQUVELFFBQVEsQ0FBQyxFQUFFLENBQXlCLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQztJQUNuRixF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