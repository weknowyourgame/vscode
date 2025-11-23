/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable no-restricted-syntax */
import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ChatTodoListWidget } from '../../browser/chatContentParts/chatTodoListWidget.js';
import { IChatTodoListService } from '../../common/chatTodoListService.js';
import { mainWindow } from '../../../../../base/browser/window.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { URI } from '../../../../../base/common/uri.js';
const testSessionUri = URI.parse('chat-session://test/session1');
suite('ChatTodoListWidget Accessibility', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let widget;
    const sampleTodos = [
        { id: 1, title: 'First task', status: 'not-started' },
        { id: 2, title: 'Second task', status: 'in-progress', description: 'This is a task description' },
        { id: 3, title: 'Third task', status: 'completed' }
    ];
    setup(() => {
        // Mock the todo list service
        const mockTodoListService = {
            _serviceBrand: undefined,
            onDidUpdateTodos: Event.None,
            getTodos: (sessionResource) => sampleTodos,
            setTodos: (sessionResource, todos) => { }
        };
        // Mock the configuration service
        const mockConfigurationService = new TestConfigurationService({ 'chat.todoListTool.descriptionField': true });
        const instantiationService = workbenchInstantiationService(undefined, store);
        instantiationService.stub(IChatTodoListService, mockTodoListService);
        instantiationService.stub(IConfigurationService, mockConfigurationService);
        widget = store.add(instantiationService.createInstance(ChatTodoListWidget));
        mainWindow.document.body.appendChild(widget.domNode);
    });
    teardown(() => {
        if (widget.domNode.parentNode) {
            widget.domNode.parentNode.removeChild(widget.domNode);
        }
    });
    test('creates proper semantic list structure', () => {
        widget.render(testSessionUri);
        const todoListContainer = widget.domNode.querySelector('.todo-list-container');
        assert.ok(todoListContainer, 'Should have todo list container');
        assert.strictEqual(todoListContainer?.getAttribute('aria-labelledby'), 'todo-list-title');
        assert.strictEqual(todoListContainer?.getAttribute('role'), 'list');
        const titleElement = widget.domNode.querySelector('#todo-list-title');
        assert.ok(titleElement, 'Should have title element with ID todo-list-title');
        // When collapsed, title shows progress and current task without "Todos" prefix
        assert.ok(titleElement?.textContent, 'Title should have content');
        // The todo list container itself acts as the list (no nested ul element)
        const todoItems = todoListContainer?.querySelectorAll('li.todo-item');
        assert.ok(todoItems && todoItems.length > 0, 'Should have todo items in the list container');
    });
    test('todo items have proper accessibility attributes', () => {
        widget.render(testSessionUri);
        const todoItems = widget.domNode.querySelectorAll('.todo-item');
        assert.strictEqual(todoItems.length, 3, 'Should have 3 todo items');
        // Check first item (not-started)
        const firstItem = todoItems[0];
        assert.strictEqual(firstItem.getAttribute('role'), 'listitem');
        assert.ok(firstItem.getAttribute('aria-label')?.includes('First task'));
        assert.ok(firstItem.getAttribute('aria-label')?.includes('not started'));
        // Check second item (in-progress with description)
        const secondItem = todoItems[1];
        assert.ok(secondItem.getAttribute('aria-label')?.includes('Second task'));
        assert.ok(secondItem.getAttribute('aria-label')?.includes('in progress'));
        assert.ok(secondItem.getAttribute('aria-label')?.includes('This is a task description'));
        // Check third item (completed)
        const thirdItem = todoItems[2];
        assert.ok(thirdItem.getAttribute('aria-label')?.includes('Third task'));
        assert.ok(thirdItem.getAttribute('aria-label')?.includes('completed'));
    });
    test('status icons are hidden from screen readers', () => {
        widget.render(testSessionUri);
        const statusIcons = widget.domNode.querySelectorAll('.todo-status-icon');
        statusIcons.forEach(icon => {
            assert.strictEqual(icon.getAttribute('aria-hidden'), 'true', 'Status icons should be hidden from screen readers');
        });
    });
    test('expand button has proper accessibility attributes', () => {
        widget.render(testSessionUri);
        // The expandoButton is now a Monaco Button, so we need to check its element
        const expandoContainer = widget.domNode.querySelector('.todo-list-expand');
        assert.ok(expandoContainer, 'Should have expando container');
        const expandoButton = expandoContainer?.querySelector('.monaco-button');
        assert.ok(expandoButton, 'Should have Monaco button');
        assert.strictEqual(expandoButton?.getAttribute('aria-expanded'), 'false'); // Should be collapsed due to in-progress task
        assert.strictEqual(expandoButton?.getAttribute('aria-controls'), 'todo-list-container');
        // The title element should have progress information
        const titleElement = expandoButton?.querySelector('.todo-list-title');
        assert.ok(titleElement, 'Should have title element');
        const titleText = titleElement?.textContent;
        // When collapsed, title shows progress and current task: " (2/3) - Second task"
        // Progress is 2/3 because: 1 completed + 1 in-progress (current) = task 2 of 3
        assert.ok(titleText?.includes('(2/3)'), `Title should show progress format, but got: "${titleText}"`);
        assert.ok(titleText?.includes('Second task'), `Title should show current task when collapsed, but got: "${titleText}"`);
    });
    test('todo items have complete aria-label with status information', () => {
        widget.render(testSessionUri);
        const todoItems = widget.domNode.querySelectorAll('.todo-item');
        assert.strictEqual(todoItems.length, 3, 'Should have 3 todo items');
        // Check first item (not-started) - aria-label should include title and status
        const firstItem = todoItems[0];
        const firstAriaLabel = firstItem.getAttribute('aria-label');
        assert.ok(firstAriaLabel?.includes('First task'), 'First item aria-label should include title');
        assert.ok(firstAriaLabel?.includes('not started'), 'First item aria-label should include status');
        // Check second item (in-progress with description) - aria-label should include title, status, and description
        const secondItem = todoItems[1];
        const secondAriaLabel = secondItem.getAttribute('aria-label');
        assert.ok(secondAriaLabel?.includes('Second task'), 'Second item aria-label should include title');
        assert.ok(secondAriaLabel?.includes('in progress'), 'Second item aria-label should include status');
        assert.ok(secondAriaLabel?.includes('This is a task description'), 'Second item aria-label should include description');
        // Check third item (completed) - aria-label should include title and status
        const thirdItem = todoItems[2];
        const thirdAriaLabel = thirdItem.getAttribute('aria-label');
        assert.ok(thirdAriaLabel?.includes('Third task'), 'Third item aria-label should include title');
        assert.ok(thirdAriaLabel?.includes('completed'), 'Third item aria-label should include status');
    });
    test('widget displays properly when no todos exist', () => {
        // Create a new mock service with empty todos
        const emptyTodoListService = {
            _serviceBrand: undefined,
            onDidUpdateTodos: Event.None,
            getTodos: (sessionResource) => [],
            setTodos: (sessionResource, todos) => { }
        };
        const emptyConfigurationService = new TestConfigurationService({ 'chat.todoListTool.descriptionField': true });
        const instantiationService = workbenchInstantiationService(undefined, store);
        instantiationService.stub(IChatTodoListService, emptyTodoListService);
        instantiationService.stub(IConfigurationService, emptyConfigurationService);
        const emptyWidget = store.add(instantiationService.createInstance(ChatTodoListWidget));
        mainWindow.document.body.appendChild(emptyWidget.domNode);
        emptyWidget.render(testSessionUri);
        // Widget should be hidden when no todos
        assert.strictEqual(emptyWidget.domNode.style.display, 'none', 'Widget should be hidden when no todos');
    });
    test('clear button has proper accessibility', () => {
        widget.render(testSessionUri);
        const clearButton = widget.domNode.querySelector('.todo-clear-button-container .monaco-button');
        assert.ok(clearButton, 'Should have clear button');
        assert.strictEqual(clearButton?.getAttribute('tabindex'), '0', 'Clear button should be focusable');
    });
    test('title element displays progress correctly and is accessible', () => {
        widget.render(testSessionUri);
        const titleElement = widget.domNode.querySelector('#todo-list-title');
        assert.ok(titleElement, 'Should have title element with ID');
        // Title should show progress format: " (2/3)" since one todo is completed and one is in-progress
        // When collapsed, it also shows the current task: " (2/3) - Second task"
        // Progress is 2/3 because: 1 completed + 1 in-progress (current) = task 2 of 3
        const titleText = titleElement?.textContent;
        assert.ok(titleText?.includes('(2/3)'), `Title should show progress format, but got: "${titleText}"`);
        assert.ok(titleText?.includes('Second task'), `Title should show current task when collapsed, but got: "${titleText}"`);
        // Verify aria-labelledby connection works
        const todoListContainer = widget.domNode.querySelector('.todo-list-container');
        assert.strictEqual(todoListContainer?.getAttribute('aria-labelledby'), 'todo-list-title');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvZG9MaXN0V2lkZ2V0LnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2Jyb3dzZXIvY2hhdFRvZG9MaXN0V2lkZ2V0LnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcseUNBQXlDO0FBRXpDLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDNUQsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFhLG9CQUFvQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDdEYsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLCtFQUErRSxDQUFDO0FBQ3pILE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUV4RCxNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUM7QUFFakUsS0FBSyxDQUFDLGtDQUFrQyxFQUFFLEdBQUcsRUFBRTtJQUM5QyxNQUFNLEtBQUssR0FBRyx1Q0FBdUMsRUFBRSxDQUFDO0lBRXhELElBQUksTUFBMEIsQ0FBQztJQUUvQixNQUFNLFdBQVcsR0FBZ0I7UUFDaEMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLGFBQWEs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