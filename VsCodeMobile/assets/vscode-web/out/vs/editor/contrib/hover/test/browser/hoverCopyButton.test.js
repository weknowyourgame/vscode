/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable no-restricted-syntax */
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { HoverCopyButton } from '../../browser/hoverCopyButton.js';
import { TestClipboardService } from '../../../../../platform/clipboard/test/common/testClipboardService.js';
import { NullHoverService } from '../../../../../platform/hover/test/browser/nullHoverService.js';
import { mainWindow } from '../../../../../base/browser/window.js';
suite('Hover Copy Button', () => {
    const disposables = new DisposableStore();
    let clipboardService;
    let hoverService;
    let container;
    setup(() => {
        clipboardService = new TestClipboardService();
        hoverService = NullHoverService;
        container = mainWindow.document.createElement('div');
        mainWindow.document.body.appendChild(container);
    });
    teardown(() => {
        disposables.clear();
        if (container.parentElement) {
            container.parentElement.removeChild(container);
        }
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('should create button element in container', () => {
        disposables.add(new HoverCopyButton(container, () => 'test content', clipboardService, hoverService));
        const buttonElement = container.querySelector('.hover-copy-button');
        assert.ok(buttonElement, 'Button element should be created');
        assert.strictEqual(buttonElement?.getAttribute('role'), 'button');
        assert.strictEqual(buttonElement?.getAttribute('tabindex'), '0');
        assert.strictEqual(buttonElement?.getAttribute('aria-label'), 'Copy');
    });
    test('should add hover-row-with-copy class to container', () => {
        assert.ok(!container.classList.contains('hover-row-with-copy'), 'Container should not have class before button creation');
        disposables.add(new HoverCopyButton(container, () => 'test content', clipboardService, hoverService));
        assert.ok(container.classList.contains('hover-row-with-copy'), 'Container should have hover-row-with-copy class after button creation');
    });
    test('should have copy icon', () => {
        disposables.add(new HoverCopyButton(container, () => 'test content', clipboardService, hoverService));
        const icon = container.querySelector('.codicon-copy');
        assert.ok(icon, 'Copy icon should be present');
    });
    test('should copy content on click', async () => {
        const testContent = 'test content to copy';
        disposables.add(new HoverCopyButton(container, () => testContent, clipboardService, hoverService));
        const buttonElement = container.querySelector('.hover-copy-button');
        assert.ok(buttonElement);
        buttonElement.click();
        const copiedText = await clipboardService.readText();
        assert.strictEqual(copiedText, testContent, 'Content should be copied to clipboard');
    });
    test('should copy content on Enter key', async () => {
        const testContent = 'test content for enter key';
        disposables.add(new HoverCopyButton(container, () => testContent, clipboardService, hoverService));
        const buttonElement = container.querySelector('.hover-copy-button');
        assert.ok(buttonElement);
        // Simulate Enter key press - need to override keyCode for StandardKeyboardEvent
        const keyEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            bubbles: true
        });
        Object.defineProperty(keyEvent, 'keyCode', { get: () => 13 }); // Enter keyCode
        buttonElement.dispatchEvent(keyEvent);
        const copiedText = await clipboardService.readText();
        assert.strictEqual(copiedText, testContent, 'Content should be copied on Enter key');
    });
    test('should copy content on Space key', async () => {
        const testContent = 'test content for space key';
        disposables.add(new HoverCopyButton(container, () => testContent, clipboardService, hoverService));
        const buttonElement = container.querySelector('.hover-copy-button');
        assert.ok(buttonElement);
        // Simulate Space key press - need to override keyCode for StandardKeyboardEvent
        const keyEvent = new KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            bubbles: true
        });
        Object.defineProperty(keyEvent, 'keyCode', { get: () => 32 }); // Space keyCode
        buttonElement.dispatchEvent(keyEvent);
        const copiedText = await clipboardService.readText();
        assert.strictEqual(copiedText, testContent, 'Content should be copied on Space key');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG92ZXJDb3B5QnV0dG9uLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaG92ZXIvdGVzdC9icm93c2VyL2hvdmVyQ29weUJ1dHRvbi50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLHlDQUF5QztBQUV6QyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx1RUFBdUUsQ0FBQztBQUU3RyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUNsRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFbkUsS0FBSyxDQUFDLG1CQUFtQixFQUFFLEdBQUcsRUFBRTtJQUMvQixNQUFNLFdBQVcsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO0lBQzFDLElBQUksZ0JBQXNDLENBQUM7SUFDM0MsSUFBSSxZQUEyQixDQUFDO0lBQ2hDLElBQUksU0FBc0IsQ0FBQztJQUUzQixLQUFLLENBQUMsR0FBRyxFQUFFO1FBQ1YsZ0JBQWdCLEdBQUcsSUFBSSxvQkFBb0IsRUFBRSxDQUFDO1FBQzlDLFlBQVksR0FBRyxnQkFBZ0IsQ0FBQztRQUNoQyxTQUFTLEdBQUcsVUFBVSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDckQsVUFBVSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ2pELENBQUMsQ0FBQyxDQUFDO0lBRUgs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