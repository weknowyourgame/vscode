import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { InlineChatController } from '../browser/inlineChatController.js';
import { AbstractInline1ChatAction, setHoldForSpeech } from '../browser/inlineChatActions.js';
import { disposableTimeout } from '../../../../base/common/async.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { StartVoiceChatAction, StopListeningAction, VOICE_KEY_HOLD_THRESHOLD } from '../../chat/electron-browser/actions/voiceChatActions.js';
import { CTX_INLINE_CHAT_VISIBLE } from '../common/inlineChat.js';
import { HasSpeechProvider, ISpeechService } from '../../speech/common/speechService.js';
import { localize2 } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { EditorAction2 } from '../../../../editor/browser/editorExtensions.js';
export class HoldToSpeak extends EditorAction2 {
    constructor() {
        super({
            id: 'inlineChat.holdForSpeech',
            category: AbstractInline1ChatAction.category,
            precondition: ContextKeyExpr.and(HasSpeechProvider, CTX_INLINE_CHAT_VISIBLE),
            title: localize2('holdForSpeech', "Hold for Speech"),
            keybinding: {
                when: EditorContextKeys.textInputFocus,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 39 /* KeyCode.KeyI */,
            },
        });
    }
    runEditorCommand(accessor, editor, ..._args) {
        const ctrl = InlineChatController.get(editor);
        if (ctrl) {
            holdForSpeech(accessor, ctrl, this);
        }
    }
}
function holdForSpeech(accessor, ctrl, action) {
    const configService = accessor.get(IConfigurationService);
    const speechService = accessor.get(ISpeechService);
    const keybindingService = accessor.get(IKeybindingService);
    const commandService = accessor.get(ICommandService);
    // enabled or possible?
    if (!configService.getValue("inlineChat.holdToSpeech" /* InlineChatConfigKeys.HoldToSpeech */ || !speechService.hasSpeechProvider)) {
        return;
    }
    const holdMode = keybindingService.enableKeybindingHoldMode(action.desc.id);
    if (!holdMode) {
        return;
    }
    let listening = false;
    const handle = disposableTimeout(() => {
        // start VOICE input
        commandService.executeCommand(StartVoiceChatAction.ID, { voice: { disableTimeout: true } });
        listening = true;
    }, VOICE_KEY_HOLD_THRESHOLD);
    holdMode.finally(() => {
        if (listening) {
            commandService.executeCommand(StopListeningAction.ID).finally(() => {
                ctrl.widget.chatWidget.acceptInput();
            });
        }
        handle.dispose();
    });
}
// make this accessible to the chat actions from the browser layer
setHoldForSpeech(holdForSpeech);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ2hhdEFjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvaW5saW5lQ2hhdC9lbGVjdHJvbi1icm93c2VyL2lubGluZUNoYXRBY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQU1BLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUd0RixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMxRSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUM5RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNuRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDbkYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLG9CQUFvQixFQUFFLG1CQUFtQixFQUFFLHdCQUF3QixFQUFFLE1BQU0seURBQXlELENBQUM7QUFFOUksT0FBTyxFQUFFLHVCQUF1QixFQUF3QixNQUFNLHlCQUF5QixDQUFDO0FBQ3hGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxjQUFjLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN6RixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFL0MsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBRS9FLE1BQU0sT0FBTyxXQUFZLFNBQVEsYUFBYTtJQUU3QztRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSwwQkFBMEI7WUFDOUIs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