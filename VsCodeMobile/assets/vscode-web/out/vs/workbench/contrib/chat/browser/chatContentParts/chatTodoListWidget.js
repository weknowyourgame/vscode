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
import * as dom from '../../../../../base/browser/dom.js';
import { Button } from '../../../../../base/browser/ui/button/button.js';
import { IconLabel } from '../../../../../base/browser/ui/iconLabel/iconLabel.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { IChatTodoListService } from '../../common/chatTodoListService.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { TodoListToolDescriptionFieldSettingId } from '../../common/tools/manageTodoListTool.js';
import { isEqual } from '../../../../../base/common/resources.js';
class TodoListDelegate {
    getHeight(element) {
        return 22;
    }
    getTemplateId(element) {
        return TodoListRenderer.TEMPLATE_ID;
    }
}
class TodoListRenderer {
    static { this.TEMPLATE_ID = 'todoListRenderer'; }
    constructor(configurationService) {
        this.configurationService = configurationService;
        this.templateId = TodoListRenderer.TEMPLATE_ID;
    }
    renderTemplate(container) {
        const templateDisposables = new DisposableStore();
        const todoElement = dom.append(container, dom.$('li.todo-item'));
        todoElement.setAttribute('role', 'listitem');
        const statusIcon = dom.append(todoElement, dom.$('.todo-status-icon.codicon'));
        statusIcon.setAttribute('aria-hidden', 'true');
        const todoContent = dom.append(todoElement, dom.$('.todo-content'));
        const iconLabel = templateDisposables.add(new IconLabel(todoContent, { supportIcons: false }));
        return { templateDisposables, todoElement, statusIcon, iconLabel };
    }
    renderElement(todo, index, templateData) {
        const { todoElement, statusIcon, iconLabel } = templateData;
        // Update status icon
        statusIcon.className = `todo-status-icon codicon ${this.getStatusIconClass(todo.status)}`;
        statusIcon.style.color = this.getStatusIconColor(todo.status);
        // Update title with tooltip if description exists and description field is enabled
        const includeDescription = this.configurationService.getValue(TodoListToolDescriptionFieldSettingId) !== false;
        const title = includeDescription && todo.description && todo.description.trim() ? todo.description : undefined;
        iconLabel.setLabel(todo.title, undefined, { title });
        // Update aria-label
        const statusText = this.getStatusText(todo.status);
        const ariaLabel = includeDescription && todo.description && todo.description.trim()
            ? localize('chat.todoList.itemWithDescription', '{0}, {1}, {2}', todo.title, statusText, todo.description)
            : localize('chat.todoList.item', '{0}, {1}', todo.title, statusText);
        todoElement.setAttribute('aria-label', ariaLabel);
    }
    disposeTemplate(templateData) {
        templateData.templateDisposables.dispose();
    }
    getStatusText(status) {
        switch (status) {
            case 'completed':
                return localize('chat.todoList.status.completed', 'completed');
            case 'in-progress':
                return localize('chat.todoList.status.inProgress', 'in progress');
            case 'not-started':
            default:
                return localize('chat.todoList.status.notStarted', 'not started');
        }
    }
    getStatusIconClass(status) {
        switch (status) {
            case 'completed':
                return 'codicon-pass';
            case 'in-progress':
                return 'codicon-record';
            case 'not-started':
            default:
                return 'codicon-circle-outline';
        }
    }
    getStatusIconColor(status) {
        switch (status) {
            case 'completed':
                return 'var(--vscode-charts-green)';
            case 'in-progress':
                return 'var(--vscode-charts-blue)';
            case 'not-started':
            default:
                return 'var(--vscode-foreground)';
        }
    }
}
let ChatTodoListWidget = class ChatTodoListWidget extends Disposable {
    constructor(chatTodoListService, configurationService, instantiationService, contextKeyService) {
        super();
        this.chatTodoListService = chatTodoListService;
        this.configurationService = configurationService;
        this.instantiationService = instantiationService;
        this.contextKeyService = contextKeyService;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this._isExpanded = false;
        this._userManuallyExpanded = false;
        this.domNode = this.createChatTodoWidget();
        // Listen to context key changes to update clear button state when request state changes
        this._register(this.contextKeyService.onDidChangeContext(e => {
            if (e.affectsSome(new Set([ChatContextKeys.requestInProgress.key]))) {
                this.updateClearButtonState();
            }
        }));
    }
    get height() {
        return this.domNode.style.display === 'none' ? 0 : this.domNode.offsetHeight;
    }
    hideWidget() {
        this.domNode.style.display = 'none';
        this._onDidChangeHeight.fire();
    }
    createChatTodoWidget() {
        const container = dom.$('.chat-todo-list-widget');
        container.style.display = 'none';
        const expandoContainer = dom.$('.todo-list-expand');
        this.expandoButton = this._register(new Button(expandoContainer, {
            supportIcons: true
        }));
        this.expandoButton.element.setAttribute('aria-expanded', String(this._isExpanded));
        this.expandoButton.element.setAttribute('aria-controls', 'todo-list-container');
        // Create title section to group icon and title
        const titleSection = dom.$('.todo-list-title-section');
        this.expandIcon = dom.$('.expand-icon.codicon');
        this.expandIcon.classList.add(this._isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right');
        this.expandIcon.setAttribute('aria-hidden', 'true');
        this.titleElement = dom.$('.todo-list-title');
        this.titleElement.id = 'todo-list-title';
        this.titleElement.textContent = localize('chat.todoList.title', 'Todos');
        // Add clear button container to the expand element
        this.clearButtonContainer = dom.$('.todo-clear-button-container');
        this.createClearButton();
        titleSection.appendChild(this.expandIcon);
        titleSection.appendChild(this.titleElement);
        this.expandoButton.element.appendChild(titleSection);
        this.expandoButton.element.appendChild(this.clearButtonContainer);
        this.todoListContainer = dom.$('.todo-list-container');
        this.todoListContainer.style.display = this._isExpanded ? 'block' : 'none';
        this.todoListContainer.id = 'todo-list-container';
        this.todoListContainer.setAttribute('role', 'list');
        this.todoListContainer.setAttribute('aria-labelledby', 'todo-list-title');
        container.appendChild(expandoContainer);
        container.appendChild(this.todoListContainer);
        this._register(this.expandoButton.onDidClick(() => {
            this.toggleExpanded();
        }));
        return container;
    }
    createClearButton() {
        this.clearButton = new Button(this.clearButtonContainer, {
            supportIcons: true,
        });
        this.clearButton.element.tabIndex = 0;
        this.clearButton.icon = Codicon.clearAll;
        this._register(this.clearButton);
        this._register(this.clearButton.onDidClick(() => {
            this.clearAllTodos();
        }));
    }
    render(sessionResource) {
        if (!sessionResource) {
            this.hideWidget();
            return;
        }
        if (!isEqual(this._currentSessionResource, sessionResource)) {
            this._userManuallyExpanded = false;
            this._currentSessionResource = sessionResource;
            this.hideWidget();
        }
        this.updateTodoDisplay();
    }
    clear(sessionResource, force = false) {
        if (!sessionResource || this.domNode.style.display === 'none') {
            return;
        }
        const currentTodos = this.chatTodoListService.getTodos(sessionResource);
        const shouldClear = force || (currentTodos.length > 0 && !currentTodos.some(todo => todo.status !== 'completed'));
        if (shouldClear) {
            this.clearAllTodos();
        }
    }
    updateTodoDisplay() {
        if (!this._currentSessionResource) {
            return;
        }
        const todoList = this.chatTodoListService.getTodos(this._currentSessionResource);
        const shouldShow = todoList.length > 2;
        if (!shouldShow) {
            this.domNode.classList.remove('has-todos');
            return;
        }
        this.domNode.classList.add('has-todos');
        this.renderTodoList(todoList);
        this.domNode.style.display = 'block';
        this._onDidChangeHeight.fire();
    }
    renderTodoList(todoList) {
        this.updateTitleElement(this.titleElement, todoList);
        const allIncomplete = todoList.every(todo => todo.status === 'not-started');
        if (allIncomplete) {
            this._userManuallyExpanded = false;
        }
        // Create or update the WorkbenchList
        if (!this._todoList) {
            this._todoList = this._register(this.instantiationService.createInstance((WorkbenchList), 'ChatTodoListRenderer', this.todoListContainer, new TodoListDelegate(), [new TodoListRenderer(this.configurationService)], {
                alwaysConsumeMouseWheel: false,
                accessibilityProvider: {
                    getAriaLabel: (todo) => {
                        const statusText = this.getStatusText(todo.status);
                        const includeDescription = this.configurationService.getValue(TodoListToolDescriptionFieldSettingId) !== false;
                        return includeDescription && todo.description && todo.description.trim()
                            ? localize('chat.todoList.itemWithDescription', '{0}, {1}, {2}', todo.title, statusText, todo.description)
                            : localize('chat.todoList.item', '{0}, {1}', todo.title, statusText);
                    },
                    getWidgetAriaLabel: () => localize('chatTodoList', 'Chat Todo List')
                }
            }));
        }
        // Update list contents
        const maxItemsShown = 6;
        const itemsShown = Math.min(todoList.length, maxItemsShown);
        const height = itemsShown * 22;
        this._todoList.layout(height);
        this._todoList.getHTMLElement().style.height = `${height}px`;
        this._todoList.splice(0, this._todoList.length, todoList);
        const hasInProgressTask = todoList.some(todo => todo.status === 'in-progress');
        const hasCompletedTask = todoList.some(todo => todo.status === 'completed');
        // Update clear button state based on request progress
        this.updateClearButtonState();
        // Only auto-collapse if there are in-progress or completed tasks AND user hasn't manually expanded
        if ((hasInProgressTask || hasCompletedTask) && this._isExpanded && !this._userManuallyExpanded) {
            this._isExpanded = false;
            this.expandoButton.element.setAttribute('aria-expanded', 'false');
            this.todoListContainer.style.display = 'none';
            this.expandIcon.classList.remove('codicon-chevron-down');
            this.expandIcon.classList.add('codicon-chevron-right');
            this.updateTitleElement(this.titleElement, todoList);
            this._onDidChangeHeight.fire();
        }
    }
    toggleExpanded() {
        this._isExpanded = !this._isExpanded;
        this._userManuallyExpanded = true;
        this.expandIcon.classList.toggle('codicon-chevron-down', this._isExpanded);
        this.expandIcon.classList.toggle('codicon-chevron-right', !this._isExpanded);
        this.todoListContainer.style.display = this._isExpanded ? 'block' : 'none';
        if (this._currentSessionResource) {
            const todoList = this.chatTodoListService.getTodos(this._currentSessionResource);
            this.updateTitleElement(this.titleElement, todoList);
        }
        this._onDidChangeHeight.fire();
    }
    clearAllTodos() {
        if (!this._currentSessionResource) {
            return;
        }
        this.chatTodoListService.setTodos(this._currentSessionResource, []);
        this.hideWidget();
    }
    updateClearButtonState() {
        if (!this._currentSessionResource) {
            return;
        }
        const todoList = this.chatTodoListService.getTodos(this._currentSessionResource);
        const hasInProgressTask = todoList.some(todo => todo.status === 'in-progress');
        const isRequestInProgress = ChatContextKeys.requestInProgress.getValue(this.contextKeyService) ?? false;
        const shouldDisable = isRequestInProgress && hasInProgressTask;
        this.clearButton.enabled = !shouldDisable;
        // Update tooltip based on state
        if (shouldDisable) {
            this.clearButton.setTitle(localize('chat.todoList.clearButton.disabled', 'Cannot clear todos while a task is in progress'));
        }
        else {
            this.clearButton.setTitle(localize('chat.todoList.clearButton', 'Clear all todos'));
        }
    }
    updateTitleElement(titleElement, todoList) {
        titleElement.textContent = '';
        const completedCount = todoList.filter(todo => todo.status === 'completed').length;
        const totalCount = todoList.length;
        const inProgressTodos = todoList.filter(todo => todo.status === 'in-progress');
        const firstInProgressTodo = inProgressTodos.length > 0 ? inProgressTodos[0] : undefined;
        const notStartedTodos = todoList.filter(todo => todo.status === 'not-started');
        const firstNotStartedTodo = notStartedTodos.length > 0 ? notStartedTodos[0] : undefined;
        const currentTaskNumber = inProgressTodos.length > 0 ? completedCount + 1 : Math.max(1, completedCount);
        const expandButtonLabel = this._isExpanded
            ? localize('chat.todoList.collapseButton', 'Collapse Todos')
            : localize('chat.todoList.expandButton', 'Expand Todos');
        this.expandoButton.element.setAttribute('aria-label', expandButtonLabel);
        this.expandoButton.element.setAttribute('aria-expanded', this._isExpanded ? 'true' : 'false');
        if (this._isExpanded) {
            const titleText = dom.$('span');
            titleText.textContent = totalCount > 0 ?
                localize('chat.todoList.titleWithCount', 'Todos ({0}/{1})', currentTaskNumber, totalCount) :
                localize('chat.todoList.title', 'Todos');
            titleElement.appendChild(titleText);
        }
        else {
            // Show first in-progress todo, or if none, the first not-started todo
            const todoToShow = firstInProgressTodo || firstNotStartedTodo;
            if (todoToShow) {
                const icon = dom.$('.codicon');
                if (todoToShow === firstInProgressTodo) {
                    icon.classList.add('codicon-record');
                    icon.style.color = 'var(--vscode-charts-blue)';
                }
                else {
                    icon.classList.add('codicon-circle-outline');
                    icon.style.color = 'var(--vscode-foreground)';
                }
                icon.style.marginRight = '4px';
                icon.style.verticalAlign = 'middle';
                titleElement.appendChild(icon);
                const todoText = dom.$('span');
                todoText.textContent = localize('chat.todoList.currentTask', '{0} ({1}/{2})', todoToShow.title, currentTaskNumber, totalCount);
                todoText.style.verticalAlign = 'middle';
                todoText.style.overflow = 'hidden';
                todoText.style.textOverflow = 'ellipsis';
                todoText.style.whiteSpace = 'nowrap';
                todoText.style.minWidth = '0';
                titleElement.appendChild(todoText);
            }
            // Show "Done" when all tasks are completed
            else if (completedCount > 0 && completedCount === totalCount) {
                const doneText = dom.$('span');
                doneText.textContent = localize('chat.todoList.titleWithCount', 'Todos ({0}/{1})', totalCount, totalCount);
                doneText.style.verticalAlign = 'middle';
                titleElement.appendChild(doneText);
            }
        }
    }
    getStatusText(status) {
        switch (status) {
            case 'completed':
                return localize('chat.todoList.status.completed', 'completed');
            case 'in-progress':
                return localize('chat.todoList.status.inProgress', 'in progress');
            case 'not-started':
            default:
                return localize('chat.todoList.status.notStarted', 'not started');
        }
    }
};
ChatTodoListWidget = __decorate([
    __param(0, IChatTodoListService),
    __param(1, IConfigurationService),
    __param(2, IInstantiationService),
    __param(3, IContextKeyService)
], ChatTodoListWidget);
export { ChatTodoListWidget };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvZG9MaXN0V2lkZ2V0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGVudFBhcnRzL2NoYXRUb2RvTGlzdFdpZGdldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9DQUFvQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUN6RSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFFbEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxxQ0FBcUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM3RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDcEYsT0FBTyxFQUFFLG9CQUFvQixFQUFhLE1BQU0scUNBQXFDLENBQUM7QUFDdEYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxxQ0FBcUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRWpHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUVsRSxNQUFNLGdCQUFn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