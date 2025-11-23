/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize, localize2 } from '../../../../nls.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { Action2 } from '../../../../platform/actions/common/actions.js';
import { AccessibilitySignal, AcknowledgeDocCommentsToken, IAccessibilitySignalService } from '../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
export class ShowSignalSoundHelp extends Action2 {
    static { this.ID = 'signals.sounds.help'; }
    constructor() {
        super({
            id: ShowSignalSoundHelp.ID,
            title: localize2('signals.sound.help', "Help: List Signal Sounds"),
            f1: true,
            metadata: {
                description: localize('accessibility.sound.help.description', "List all accessibility sounds, noises, or audio cues and configure their settings")
            }
        });
    }
    async run(accessor) {
        const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
        const quickInputService = accessor.get(IQuickInputService);
        const configurationService = accessor.get(IConfigurationService);
        const accessibilityService = accessor.get(IAccessibilityService);
        const preferencesService = accessor.get(IPreferencesService);
        const userGestureSignals = [AccessibilitySignal.save, AccessibilitySignal.format];
        const items = AccessibilitySignal.allAccessibilitySignals.map((signal, idx) => ({
            label: userGestureSignals.includes(signal) ? `${signal.name} (${configurationService.getValue(signal.settingsKey + '.sound')})` : signal.name,
            signal,
            buttons: userGestureSignals.includes(signal) ? [{
                    iconClass: ThemeIcon.asClassName(Codicon.settingsGear),
                    tooltip: localize('sounds.help.settings', 'Configure Sound'),
                    alwaysVisible: true
                }] : []
        })).sort((a, b) => a.label.localeCompare(b.label));
        const disposables = new DisposableStore();
        const qp = disposables.add(quickInputService.createQuickPick());
        qp.items = items;
        qp.selectedItems = items.filter(i => accessibilitySignalService.isSoundEnabled(i.signal) || userGestureSignals.includes(i.signal) && configurationService.getValue(i.signal.settingsKey + '.sound') !== 'never');
        disposables.add(qp.onDidAccept(() => {
            const enabledSounds = qp.selectedItems.map(i => i.signal);
            // eslint-disable-next-line local/code-no-any-casts
            const disabledSounds = qp.items.map(i => i.signal).filter(i => !enabledSounds.includes(i));
            for (const signal of enabledSounds) {
                let { sound, announcement } = configurationService.getValue(signal.settingsKey);
                sound = userGestureSignals.includes(signal) ? 'userGesture' : accessibilityService.isScreenReaderOptimized() ? 'auto' : 'on';
                if (announcement) {
                    configurationService.updateValue(signal.settingsKey, { sound, announcement });
                }
                else {
                    configurationService.updateValue(signal.settingsKey, { sound });
                }
            }
            for (const signal of disabledSounds) {
                const announcement = configurationService.getValue(signal.settingsKey + '.announcement');
                const sound = getDisabledSettingValue(userGestureSignals.includes(signal), accessibilityService.isScreenReaderOptimized());
                const value = announcement ? { sound, announcement } : { sound };
                configurationService.updateValue(signal.settingsKey, value);
            }
            qp.hide();
        }));
        disposables.add(qp.onDidTriggerItemButton(e => {
            preferencesService.openUserSettings({ jsonEditor: true, revealSetting: { key: e.item.signal.settingsKey, edit: true } });
        }));
        disposables.add(qp.onDidChangeActive(() => {
            accessibilitySignalService.playSound(qp.activeItems[0].signal.sound.getSound(true), true, AcknowledgeDocCommentsToken);
        }));
        disposables.add(qp.onDidHide(() => disposables.dispose()));
        qp.placeholder = localize('sounds.help.placeholder', 'Select a sound to play and configure');
        qp.canSelectMany = true;
        await qp.show();
    }
}
function getDisabledSettingValue(isUserGestureSignal, isScreenReaderOptimized) {
    return isScreenReaderOptimized ? (isUserGestureSignal ? 'never' : 'off') : (isUserGestureSignal ? 'never' : 'auto');
}
export class ShowAccessibilityAnnouncementHelp extends Action2 {
    static { this.ID = 'accessibility.announcement.help'; }
    constructor() {
        super({
            id: ShowAccessibilityAnnouncementHelp.ID,
            title: localize2('accessibility.announcement.help', "Help: List Signal Announcements"),
            f1: true,
            metadata: {
                description: localize('accessibility.announcement.help.description', "List all accessibility announcements, alerts, braille messages, and configure their settings")
            }
        });
    }
    async run(accessor) {
        const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
        const quickInputService = accessor.get(IQuickInputService);
        const configurationService = accessor.get(IConfigurationService);
        const accessibilityService = accessor.get(IAccessibilityService);
        const preferencesService = accessor.get(IPreferencesService);
        const userGestureSignals = [AccessibilitySignal.save, AccessibilitySignal.format];
        const items = AccessibilitySignal.allAccessibilitySignals.filter(c => !!c.legacyAnnouncementSettingsKey).map((signal, idx) => ({
            label: userGestureSignals.includes(signal) ? `${signal.name} (${configurationService.getValue(signal.settingsKey + '.announcement')})` : signal.name,
            signal,
            buttons: userGestureSignals.includes(signal) ? [{
                    iconClass: ThemeIcon.asClassName(Codicon.settingsGear),
                    tooltip: localize('announcement.help.settings', 'Configure Announcement'),
                    alwaysVisible: true,
                }] : []
        })).sort((a, b) => a.label.localeCompare(b.label));
        const disposables = new DisposableStore();
        const qp = disposables.add(quickInputService.createQuickPick());
        qp.items = items;
        qp.selectedItems = items.filter(i => accessibilitySignalService.isAnnouncementEnabled(i.signal) || userGestureSignals.includes(i.signal) && configurationService.getValue(i.signal.settingsKey + '.announcement') !== 'never');
        const screenReaderOptimized = accessibilityService.isScreenReaderOptimized();
        disposables.add(qp.onDidAccept(() => {
            if (!screenReaderOptimized) {
                // announcements are off by default when screen reader is not active
                qp.hide();
                return;
            }
            const enabledAnnouncements = qp.selectedItems.map(i => i.signal);
            const disabledAnnouncements = AccessibilitySignal.allAccessibilitySignals.filter(cue => !!cue.legacyAnnouncementSettingsKey && !enabledAnnouncements.includes(cue));
            for (const signal of enabledAnnouncements) {
                let { sound, announcement } = configurationService.getValue(signal.settingsKey);
                announcement = userGestureSignals.includes(signal) ? 'userGesture' : signal.announcementMessage && accessibilityService.isScreenReaderOptimized() ? 'auto' : undefined;
                configurationService.updateValue(signal.settingsKey, { sound, announcement });
            }
            for (const signal of disabledAnnouncements) {
                const announcement = getDisabledSettingValue(userGestureSignals.includes(signal), true);
                const sound = configurationService.getValue(signal.settingsKey + '.sound');
                const value = announcement ? { sound, announcement } : { sound };
                configurationService.updateValue(signal.settingsKey, value);
            }
            qp.hide();
        }));
        disposables.add(qp.onDidTriggerItemButton(e => {
            preferencesService.openUserSettings({ jsonEditor: true, revealSetting: { key: e.item.signal.settingsKey, edit: true } });
        }));
        disposables.add(qp.onDidHide(() => disposables.dispose()));
        qp.placeholder = screenReaderOptimized ? localize('announcement.help.placeholder', 'Select an announcement to configure') : localize('announcement.help.placeholder.disabled', 'Screen reader is not active, announcements are disabled by default.');
        qp.canSelectMany = true;
        await qp.show();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWFuZHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvYWNjZXNzaWJpbGl0eVNpZ25hbHMvYnJvd3Nlci9jb21tYW5kcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSwyQkFBMkIsRUFBRSwyQkFBMkIsRUFBRSxNQUFNLGdGQUFnRixDQUFDO0FBQy9LLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRW5HLE9BQU8sRUFBRSxrQkFBa0IsRUFBa0IsTUFBTSxzREFBc0QsQ0FBQztBQUMxRyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFdkUsTUFBTSxPQUFPLG1CQUFvQixTQUFRLE9BQU87YUFDL0IsT0FBRSxHQUFHLHFCQUFxQixDQUFDO0lBRTNDO1FBQ0MsS0FBSyxDQUFDO1lBQ0wsRUFBRSxFQUFFLG1CQUFtQixDQUFDLEVBQUU7WUFDMUIsS0FBSyxFQUFFLFNBQVMsQ0FBQyxvQkFBb0IsRUFBRSwwQkFBMEIsQ0FBQztZQUNsRSxFQUFFLEVBQUUsSUFBSTtZQUNSLFFBQVEsRUFBRTtnQkFDVCxXQUFXLEVBQUUsUUFBUSxDQUFDLHNDQUFzQyxFQUFFLG1GQUFtRixDQUFDO2FBQ2xKO1NBQ0QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVRLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBMEI7UUFDNUMsTUFBTSwwQkFBMEIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFDN0UsTUFBTSxpQkFBaUIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDM0QsTUFBTSxvQkFBb0IsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDakUsTUFBTSxvQkFBb0IsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDakUsTUFBTSxrQkFBa0IsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDN0QsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNsRixNQUFNLEtBQUssR0FBeUQsbUJBQW1CLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNySSxLQUFLLEVBQUUsa0JBQWtCLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLEtBQUssb0JBQW9CLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUk7WUFDN0ksTUFBTTtZQUNOLE9BQU8sRUFBRSxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQy9DLFNBQVMsRUFBRSxTQUFTLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUM7b0JBQ3RELE9BQU8sRUFBRSxRQUFRLENBQUMsc0JBQXNCLEVBQUUsaUJBQWlCLENBQUM7b0JBQzVELGFBQWEsRUFBRSxJQUFJO2lCQUNuQixDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7U0FDUCxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUNuRCxNQUFNLFdBQVcsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQzFDLE1BQU0sRUFBRSxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsZUFBZSxFQUFvRCxDQUFDLENBQUM7UUFDbEgsRUFBRSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDakIsRUFBRSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsMEJBQTBCLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFdBQVcsR0FBRyxRQUFRLENBQUMsS0FBSyxPQUFPLENBQUMsQ0FBQztRQUNqTixXQUFXLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFO1lBQ25DLE1BQU0sYUFBYSxHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzFELG1EQUFtRDtZQUNuRCxNQUFNLGNBQWMsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFFLENBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNwRyxLQUFLLE1BQU0sTUFBTSxJQUFJLGFBQWEsRUFBRSxDQUFDO2dCQUNwQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFlBQVksRUFBRSxHQUFHLG9CQUFvQixDQUFDLFFBQVEsQ0FBMkMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUMxSCxLQUFLLEdBQUcsa0JBQWtCLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLHVCQUF1QixFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO2dCQUM3SCxJQUFJLFlBQVksRUFBRSxDQUFDO29CQUNsQixvQkFBb0IsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDO2dCQUMvRSxDQUFDO3FCQUFNLENBQUM7b0JBQ1Asb0JBQW9CLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO2dCQUNqRSxDQUFDO1lBQ0YsQ0FBQztZQUVELEtBQUssTUFBTSxNQUFNLElBQUksY0FBYyxFQUFFLENBQUM7Z0JBQ3JDLE1BQU0sWUFBWSxHQUFHLG9CQUFvQixDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsV0FBVyxHQUFHLGVBQWUsQ0FBQyxDQUFDO2dCQUN6RixNQUFNLEtBQUssR0FBRyx1QkFBdUIsQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsb0JBQW9CLENBQUMsdUJBQXVCLEVBQUUsQ0FBQyxDQUFDO2dCQUMzSCxNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDO2dCQUNqRSxvQkFBb0IsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUM3RCxDQUFDO1lBQ0QsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ1gsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNKLFdBQVcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQzdDLGtCQUFrQixDQUFDLGdCQUFnQixDQUFDLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDMUgsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNKLFdBQVcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsRUFBRTtZQUN6QywwQkFBMEIsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsMkJBQTJCLENBQUMsQ0FBQztRQUN4SCxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0osV0FBVyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDM0QsRUFBRSxDQUFDLFdBQVcsR0FBRyxRQUFRLENBQUMseUJBQXlCLEVBQUUsc0NBQXNDLENBQUMsQ0FBQztRQUM3RixFQUFFLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztRQUN4QixNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNqQixDQUFDOztBQUdGLFNBQVMsdUJBQXVCLENBQUMsbUJBQTRCLEVBQUUsdUJBQWdDO0lBQzlGLE9BQU8sdUJBQXVCLENBQUMsQ0FBQyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDckgsQ0FBQztBQUVELE1BQU0sT0FBTyxpQ0FBa0MsU0FBUSxPQUFPO2FBQzdDLE9BQUUsR0FBRyxpQ0FBaUMsQ0FBQztJQUV2RDtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSxpQ0FBaUMsQ0FBQyxFQUFFO1lBQ3hDLEtBQUssRUFBRSxTQUFTLENBQUMsaUNBQWlDLEVBQUUsaUNBQWlDLENBQUM7WUFDdEYsRUFBRSxFQUFFLElBQUk7WUFDUixRQUFRLEVBQUU7Z0JBQ1QsV0FBVyxFQUFFLFFBQVEsQ0FBQyw2Q0FBNkMsRUFBRSw4RkFBOEYsQ0FBQzthQUNwSztTQUNELENBQUMsQ0FBQztJQUNKLENBQUM7SUFFUSxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQTBCO1FBQzVDLE1BQU0sMEJBQTBCLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO1FBQzdFLE1BQU0saUJBQWlCLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQzNELE1BQU0sb0JBQW9CLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBQ2pFLE1BQU0sb0JBQW9CLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBQ2pFLE1BQU0sa0JBQWtCLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQzdELE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEYsTUFBTSxLQUFLLEdBQXlELG1CQUFtQixDQUFDLHVCQUF1QixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsNkJBQTZCLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3BMLEtBQUssRUFBRSxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLElBQUksS0FBSyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLFdBQVcsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSTtZQUNwSixNQUFNO1lBQ04sT0FBTyxFQUFFLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDL0MsU0FBUyxFQUFFLFNBQVMsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQztvQkFDdEQsT0FBTyxFQUFFLFFBQVEsQ0FBQyw0QkFBNEIsRUFBRSx3QkFBd0IsQ0FBQztvQkFDekUsYUFBYSxFQUFFLElBQUk7aUJBQ25CLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtTQUNQLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ25ELE1BQU0sV0FBVyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFDMUMsTUFBTSxFQUFFLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLEVBQW9ELENBQUMsQ0FBQztRQUNsSCxFQUFFLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNqQixFQUFFLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksa0JBQWtCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsZUFBZSxDQUFDLEtBQUssT0FBTyxDQUFDLENBQUM7UUFDL04sTUFBTSxxQkFBcUIsR0FBRyxvQkFBb0IsQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1FBQzdFLFdBQVcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUU7WUFDbkMsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7Z0JBQzVCLG9FQUFvRTtnQkFDcEUsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNWLE9BQU87WUFDUixDQUFDO1lBQ0QsTUFBTSxvQkFBb0IsR0FBRyxFQUFFLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNqRSxNQUFNLHFCQUFxQixHQUFHLG1CQUFtQixDQUFDLHVCQUF1QixDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsNkJBQTZCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNwSyxLQUFLLE1BQU0sTUFBTSxJQUFJLG9CQUFvQixFQUFFLENBQUM7Z0JBQzNDLElBQUksRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLEdBQUcsb0JBQW9CLENBQUMsUUFBUSxDQUEyQyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQzFILFlBQVksR0FBRyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLG1CQUFtQixJQUFJLG9CQUFvQixDQUFDLHVCQUF1QixFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO2dCQUN2SyxvQkFBb0IsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDO1lBQy9FLENBQUM7WUFFRCxLQUFLLE1BQU0sTUFBTSxJQUFJLHFCQUFxQixFQUFFLENBQUM7Z0JBQzVDLE1BQU0sWUFBWSxHQUFHLHVCQUF1QixDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDeEYsTUFBTSxLQUFLLEdBQUcsb0JBQW9CLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEdBQUcsUUFBUSxDQUFDLENBQUM7Z0JBQzNFLE1BQU0sS0FBSyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUM7Z0JBQ2pFLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzdELENBQUM7WUFDRCxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDWCxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0osV0FBVyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDN0Msa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMxSCxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0osV0FBVyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDM0QsRUFBRSxDQUFDLFdBQVcsR0FBRyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLCtCQUErQixFQUFFLHFDQUFxQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyx3Q0FBd0MsRUFBRSxxRUFBcUUsQ0FBQyxDQUFDO1FBQ3RQLEVBQUUsQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDO1FBQ3hCLE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2pCLENBQUMifQ==