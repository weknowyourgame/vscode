/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { NotificationAccessibilityProvider } from '../../browser/parts/notifications/notificationsList.js';
import { NotificationViewItem } from '../../common/notifications.js';
import { Severity, NotificationsFilter } from '../../../platform/notification/common/notification.js';
import { TestConfigurationService } from '../../../platform/configuration/test/common/testConfigurationService.js';
import { MockKeybindingService } from '../../../platform/keybinding/test/common/mockKeybindingService.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
suite('NotificationsList AccessibilityProvider', () => {
    const noFilter = { global: NotificationsFilter.OFF, sources: new Map() };
    let configurationService;
    let keybindingService;
    let accessibilityProvider;
    const createdNotifications = [];
    setup(() => {
        configurationService = new TestConfigurationService();
        keybindingService = new MockKeybindingService();
        accessibilityProvider = new NotificationAccessibilityProvider({}, keybindingService, configurationService);
    });
    teardown(() => {
        // Close all created notifications to prevent disposable leaks
        for (const notification of createdNotifications) {
            notification.close();
        }
        createdNotifications.length = 0;
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('getAriaLabel includes severity prefix for Error notifications', () => {
        const notification = NotificationViewItem.create({ severity: Severity.Error, message: 'Something went wrong' }, noFilter);
        createdNotifications.push(notification);
        const ariaLabel = accessibilityProvider.getAriaLabel(notification);
        assert.ok(ariaLabel.startsWith('Error: '), `Expected aria label to start with "Error: ", but got: ${ariaLabel}`);
        assert.ok(ariaLabel.includes('Something went wrong'), 'Expected aria label to include original message');
        assert.ok(ariaLabel.includes('notification'), 'Expected aria label to include "notification"');
    });
    test('getAriaLabel includes severity prefix for Warning notifications', () => {
        const notification = NotificationViewItem.create({ severity: Severity.Warning, message: 'This is a warning' }, noFilter);
        createdNotifications.push(notification);
        const ariaLabel = accessibilityProvider.getAriaLabel(notification);
        assert.ok(ariaLabel.startsWith('Warning: '), `Expected aria label to start with "Warning: ", but got: ${ariaLabel}`);
        assert.ok(ariaLabel.includes('This is a warning'), 'Expected aria label to include original message');
        assert.ok(ariaLabel.includes('notification'), 'Expected aria label to include "notification"');
    });
    test('getAriaLabel includes severity prefix for Info notifications', () => {
        const notification = NotificationViewItem.create({ severity: Severity.Info, message: 'Information message' }, noFilter);
        createdNotifications.push(notification);
        const ariaLabel = accessibilityProvider.getAriaLabel(notification);
        assert.ok(ariaLabel.startsWith('Info: '), `Expected aria label to start with "Info: ", but got: ${ariaLabel}`);
        assert.ok(ariaLabel.includes('Information message'), 'Expected aria label to include original message');
        assert.ok(ariaLabel.includes('notification'), 'Expected aria label to include "notification"');
    });
    test('getAriaLabel includes source when present', () => {
        const notification = NotificationViewItem.create({
            severity: Severity.Error,
            message: 'Error with source',
            source: 'TestExtension'
        }, noFilter);
        createdNotifications.push(notification);
        const ariaLabel = accessibilityProvider.getAriaLabel(notification);
        assert.ok(ariaLabel.startsWith('Error: '), 'Expected aria label to start with severity prefix');
        assert.ok(ariaLabel.includes('Error with source'), 'Expected aria label to include original message');
        assert.ok(ariaLabel.includes('source: TestExtension'), 'Expected aria label to include source information');
        assert.ok(ariaLabel.includes('notification'), 'Expected aria label to include "notification"');
    });
    test('severity prefix consistency', () => {
        // Test that the severity prefixes are consistent with the ARIA alerts
        const errorNotification = NotificationViewItem.create({ severity: Severity.Error, message: 'Error message' }, noFilter);
        const warningNotification = NotificationViewItem.create({ severity: Severity.Warning, message: 'Warning message' }, noFilter);
        const infoNotification = NotificationViewItem.create({ severity: Severity.Info, message: 'Info message' }, noFilter);
        createdNotifications.push(errorNotification, warningNotification, infoNotification);
        const errorLabel = accessibilityProvider.getAriaLabel(errorNotification);
        const warningLabel = accessibilityProvider.getAriaLabel(warningNotification);
        const infoLabel = accessibilityProvider.getAriaLabel(infoNotification);
        // Check that each severity type gets the correct prefix
        assert.ok(errorLabel.includes('Error: Error message'), 'Error notifications should have Error prefix');
        assert.ok(warningLabel.includes('Warning: Warning message'), 'Warning notifications should have Warning prefix');
        assert.ok(infoLabel.includes('Info: Info message'), 'Info notifications should have Info prefix');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90aWZpY2F0aW9uc0xpc3QudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvdGVzdC9icm93c2VyL25vdGlmaWNhdGlvbnNMaXN0LnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxpQ0FBaUMsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzNHLE9BQU8sRUFBRSxvQkFBb0IsRUFBK0MsTUFBTSwrQkFBK0IsQ0FBQztBQUNsSCxPQUFPLEVBQUUsUUFBUSxFQUFFLG1CQUFtQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFHdEcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0seUVBQXlFLENBQUM7QUFDbkgsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFDMUcsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFFN0YsS0FBSyxDQUFDLHlDQUF5QyxFQUFFLEdBQUcsRUFBRTtJQUVyRCxNQUFNLFFBQVEsR0FBeUIsRUFBRSxNQUFNLEVBQUUsbUJBQW1CLENBQUMsR0FBRyxFQUFFLE9BQU8sRUFBRSxJQUFJLEdBQUcsRUFBRSxFQUFFLENBQUM7SUFDL0YsSUFBSSxvQkFBMkMsQ0FBQztJQUNoRCxJQUFJLGlCQUFxQyxDQUFDO0lBQzFDLElBQUkscUJBQXdELENBQUM7SUFDN0QsTUFBTSxvQkFBb0IsR0FBNEIsRUFBRSxDQUFDO0lBRXpELEtBQUssQ0FBQyxHQUFHLEVBQUU7UUFDVixvQkFBb0IsR0FBRyxJQUFJLHdCQUF3QixFQUFFLENBQUM7UUFDdEQsaUJBQWlCLEdBQUcsSUFBSSxxQkFBcUIsRUFBRSxDQUFDO1FBQ2hELHFCQUFxQixHQUFHLElBQUksaUNBQWlDLENBQUMsRUFBRSxFQUFFLGlCQUFp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