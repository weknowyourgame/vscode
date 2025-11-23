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
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { ToolDataSource } from '../languageModelToolsService.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IChatTodoListService } from '../chatTodoListService.js';
import { localize } from '../../../../../nls.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { chatSessionResourceToId, LocalChatSessionUri } from '../chatUri.js';
export const TodoListToolWriteOnlySettingId = 'chat.todoListTool.writeOnly';
export const TodoListToolDescriptionFieldSettingId = 'chat.todoListTool.descriptionField';
export const ManageTodoListToolToolId = 'manage_todo_list';
export function createManageTodoListToolData(writeOnly, includeDescription = true) {
    const baseProperties = {
        todoList: {
            type: 'array',
            description: writeOnly
                ? 'Complete array of all todo items. Must include ALL items - both existing and new.'
                : 'Complete array of all todo items (required for write operation, ignored for read). Must include ALL items - both existing and new.',
            items: {
                type: 'object',
                properties: {
                    id: {
                        type: 'number',
                        description: 'Unique identifier for the todo. Use sequential numbers starting from 1.'
                    },
                    title: {
                        type: 'string',
                        description: 'Concise action-oriented todo label (3-7 words). Displayed in UI.'
                    },
                    ...(includeDescription && {
                        description: {
                            type: 'string',
                            description: 'Detailed context, requirements, or implementation notes. Include file paths, specific methods, or acceptance criteria.'
                        }
                    }),
                    status: {
                        type: 'string',
                        enum: ['not-started', 'in-progress', 'completed'],
                        description: 'not-started: Not begun | in-progress: Currently working (max 1) | completed: Fully finished with no blockers'
                    },
                },
                required: includeDescription ? ['id', 'title', 'description', 'status'] : ['id', 'title', 'status']
            }
        }
    };
    // Only require the full todoList when operating in write-only mode.
    // In read/write mode, the write path validates todoList at runtime, so it's not schema-required.
    const requiredFields = writeOnly ? ['todoList'] : [];
    if (!writeOnly) {
        baseProperties.operation = {
            type: 'string',
            enum: ['write', 'read'],
            description: 'write: Replace entire todo list with new content. read: Retrieve current todo list. ALWAYS provide complete list when writing - partial updates not supported.'
        };
        requiredFields.unshift('operation');
    }
    return {
        id: ManageTodoListToolToolId,
        toolReferenceName: 'todo',
        legacyToolReferenceFullNames: ['todos'],
        canBeReferencedInPrompt: true,
        icon: ThemeIcon.fromId(Codicon.checklist.id),
        displayName: localize('tool.manageTodoList.displayName', 'Manage and track todo items for task planning'),
        userDescription: localize('tool.manageTodoList.userDescription', 'Manage and track todo items for task planning'),
        modelDescription: 'Manage a structured todo list to track progress and plan tasks throughout your coding session. Use this tool VERY frequently to ensure task visibility and proper planning.\n\nWhen to use this tool:\n- Complex multi-step work requiring planning and tracking\n- When user provides multiple tasks or requests (numbered/comma-separated)\n- After receiving new instructions that require multiple steps\n- BEFORE starting work on any todo (mark as in-progress)\n- IMMEDIATELY after completing each todo (mark completed individually)\n- When breaking down larger tasks into smaller actionable steps\n- To give users visibility into your progress and planning\n\nWhen NOT to use:\n- Single, trivial tasks that can be completed in one step\n- Purely conversational/informational requests\n- When just reading files or performing simple searches\n\nCRITICAL workflow:\n1. Plan tasks by writing todo list with specific, actionable items\n2. Mark ONE todo as in-progress before starting work\n3. Complete the work for that specific todo\n4. Mark that todo as completed IMMEDIATELY\n5. Move to next todo and repeat\n\nTodo states:\n- not-started: Todo not yet begun\n- in-progress: Currently working (limit ONE at a time)\n- completed: Finished successfully\n\nIMPORTANT: Mark todos completed as soon as they are done. Do not batch completions.',
        source: ToolDataSource.Internal,
        inputSchema: {
            type: 'object',
            properties: baseProperties,
            required: requiredFields
        }
    };
}
export const ManageTodoListToolData = createManageTodoListToolData(false);
let ManageTodoListTool = class ManageTodoListTool extends Disposable {
    constructor(writeOnly, includeDescription, chatTodoListService, logService, telemetryService) {
        super();
        this.writeOnly = writeOnly;
        this.includeDescription = includeDescription;
        this.chatTodoListService = chatTodoListService;
        this.logService = logService;
        this.telemetryService = telemetryService;
    }
    async invoke(invocation, _countTokens, _progress, _token) {
        const args = invocation.parameters;
        // For: #263001 Use default sessionId
        const DEFAULT_TODO_SESSION_ID = 'default';
        const chatSessionId = invocation.context?.sessionId ?? args.chatSessionId ?? DEFAULT_TODO_SESSION_ID;
        this.logService.debug(`ManageTodoListTool: Invoking with options ${JSON.stringify(args)}`);
        try {
            // Determine operation: in writeOnly mode, always write; otherwise use args.operation
            const operation = this.writeOnly ? 'write' : args.operation;
            if (!operation) {
                return {
                    content: [{
                            kind: 'text',
                            value: 'Error: operation parameter is required'
                        }]
                };
            }
            if (operation === 'read') {
                return this.handleReadOperation(LocalChatSessionUri.forSession(chatSessionId));
            }
            else if (operation === 'write') {
                return this.handleWriteOperation(args, LocalChatSessionUri.forSession(chatSessionId));
            }
            else {
                return {
                    content: [{
                            kind: 'text',
                            value: 'Error: Unknown operation'
                        }]
                };
            }
        }
        catch (error) {
            const errorMessage = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            return {
                content: [{
                        kind: 'text',
                        value: errorMessage
                    }]
            };
        }
    }
    async prepareToolInvocation(context, _token) {
        const args = context.parameters;
        // For: #263001 Use default sessionId
        const DEFAULT_TODO_SESSION_ID = 'default';
        const chatSessionId = context.chatSessionId ?? args.chatSessionId ?? DEFAULT_TODO_SESSION_ID;
        const currentTodoItems = this.chatTodoListService.getTodos(LocalChatSessionUri.forSession(chatSessionId));
        let message;
        const operation = this.writeOnly ? 'write' : args.operation;
        switch (operation) {
            case 'write': {
                if (args.todoList) {
                    message = this.generatePastTenseMessage(currentTodoItems, args.todoList);
                }
                break;
            }
            case 'read': {
                message = localize('todo.readOperation', "Read todo list");
                break;
            }
            default:
                break;
        }
        const items = args.todoList ?? currentTodoItems;
        const todoList = items.map(todo => ({
            id: todo.id.toString(),
            title: todo.title,
            description: todo.description || '',
            status: todo.status
        }));
        return {
            pastTenseMessage: new MarkdownString(message ?? localize('todo.updatedList', "Updated todo list")),
            toolSpecificData: {
                kind: 'todoList',
                sessionId: chatSessionId,
                todoList: todoList
            }
        };
    }
    generatePastTenseMessage(currentTodos, newTodos) {
        // If no current todos, this is creating new ones
        if (currentTodos.length === 0) {
            return newTodos.length === 1
                ? localize('todo.created.single', "Created 1 todo")
                : localize('todo.created.multiple', "Created {0} todos", newTodos.length);
        }
        // Create map for easier comparison
        const currentTodoMap = new Map(currentTodos.map(todo => [todo.id, todo]));
        // Check for newly started todos (marked as in-progress) - highest priority
        const startedTodos = newTodos.filter(newTodo => {
            const currentTodo = currentTodoMap.get(newTodo.id);
            return currentTodo && currentTodo.status !== 'in-progress' && newTodo.status === 'in-progress';
        });
        if (startedTodos.length > 0) {
            const startedTodo = startedTodos[0]; // Should only be one in-progress at a time
            const totalTodos = newTodos.length;
            const currentPosition = newTodos.findIndex(todo => todo.id === startedTodo.id) + 1;
            return localize('todo.starting', "Starting: *{0}* ({1}/{2})", startedTodo.title, currentPosition, totalTodos);
        }
        // Check for newly completed todos
        const completedTodos = newTodos.filter(newTodo => {
            const currentTodo = currentTodoMap.get(newTodo.id);
            return currentTodo && currentTodo.status !== 'completed' && newTodo.status === 'completed';
        });
        if (completedTodos.length > 0) {
            const completedTodo = completedTodos[0]; // Get the first completed todo for the message
            const totalTodos = newTodos.length;
            const currentPosition = newTodos.findIndex(todo => todo.id === completedTodo.id) + 1;
            return localize('todo.completed', "Completed: *{0}* ({1}/{2})", completedTodo.title, currentPosition, totalTodos);
        }
        // Check for new todos added
        const addedTodos = newTodos.filter(newTodo => !currentTodoMap.has(newTodo.id));
        if (addedTodos.length > 0) {
            return addedTodos.length === 1
                ? localize('todo.added.single', "Added 1 todo")
                : localize('todo.added.multiple', "Added {0} todos", addedTodos.length);
        }
        // Default message for other updates
        return localize('todo.updated', "Updated todo list");
    }
    handleRead(todoItems, sessionResource) {
        if (todoItems.length === 0) {
            return 'No todo list found.';
        }
        const markdownTaskList = this.formatTodoListAsMarkdownTaskList(todoItems);
        return `# Todo List\n\n${markdownTaskList}`;
    }
    handleReadOperation(chatSessionResource) {
        const todoItems = this.chatTodoListService.getTodos(chatSessionResource);
        const readResult = this.handleRead(todoItems, chatSessionResource);
        const statusCounts = this.calculateStatusCounts(todoItems);
        this.telemetryService.publicLog2('todoListToolInvoked', {
            operation: 'read',
            notStartedCount: statusCounts.notStartedCount,
            inProgressCount: statusCounts.inProgressCount,
            completedCount: statusCounts.completedCount,
            chatSessionId: chatSessionResourceToId(chatSessionResource)
        });
        return {
            content: [{
                    kind: 'text',
                    value: readResult
                }]
        };
    }
    handleWriteOperation(args, chatSessionResource) {
        if (!args.todoList) {
            return {
                content: [{
                        kind: 'text',
                        value: 'Error: todoList is required for write operation'
                    }]
            };
        }
        const todoList = args.todoList.map((parsedTodo) => ({
            id: parsedTodo.id,
            title: parsedTodo.title,
            description: parsedTodo.description || '',
            status: parsedTodo.status
        }));
        const existingTodos = this.chatTodoListService.getTodos(chatSessionResource);
        const changes = this.calculateTodoChanges(existingTodos, todoList);
        this.chatTodoListService.setTodos(chatSessionResource, todoList);
        const statusCounts = this.calculateStatusCounts(todoList);
        // Build warnings
        const warnings = [];
        if (todoList.length < 3) {
            warnings.push('Warning: Small todo list (<3 items). This task might not need a todo list.');
        }
        else if (todoList.length > 10) {
            warnings.push('Warning: Large todo list (>10 items). Consider keeping the list focused and actionable.');
        }
        if (changes > 3) {
            warnings.push('Warning: Did you mean to update so many todos at the same time? Consider working on them one by one.');
        }
        this.telemetryService.publicLog2('todoListToolInvoked', {
            operation: 'write',
            notStartedCount: statusCounts.notStartedCount,
            inProgressCount: statusCounts.inProgressCount,
            completedCount: statusCounts.completedCount,
            chatSessionId: chatSessionResourceToId(chatSessionResource)
        });
        return {
            content: [{
                    kind: 'text',
                    value: `Successfully wrote todo list${warnings.length ? '\n\n' + warnings.join('\n') : ''}`
                }],
            toolMetadata: {
                warnings: warnings
            }
        };
    }
    calculateStatusCounts(todos) {
        const notStartedCount = todos.filter(todo => todo.status === 'not-started').length;
        const inProgressCount = todos.filter(todo => todo.status === 'in-progress').length;
        const completedCount = todos.filter(todo => todo.status === 'completed').length;
        return { notStartedCount, inProgressCount, completedCount };
    }
    formatTodoListAsMarkdownTaskList(todoList) {
        if (todoList.length === 0) {
            return '';
        }
        return todoList.map(todo => {
            let checkbox;
            switch (todo.status) {
                case 'completed':
                    checkbox = '[x]';
                    break;
                case 'in-progress':
                    checkbox = '[-]';
                    break;
                case 'not-started':
                default:
                    checkbox = '[ ]';
                    break;
            }
            const lines = [`- ${checkbox} ${todo.title}`];
            if (this.includeDescription && todo.description && todo.description.trim()) {
                lines.push(`  - ${todo.description.trim()}`);
            }
            return lines.join('\n');
        }).join('\n');
    }
    calculateTodoChanges(oldList, newList) {
        // Assume arrays are equivalent in order; compare index-by-index
        let modified = 0;
        const minLen = Math.min(oldList.length, newList.length);
        for (let i = 0; i < minLen; i++) {
            const o = oldList[i];
            const n = newList[i];
            if (o.title !== n.title || (o.description ?? '') !== (n.description ?? '') || o.status !== n.status) {
                modified++;
            }
        }
        const added = Math.max(0, newList.length - oldList.length);
        const removed = Math.max(0, oldList.length - newList.length);
        const totalChanges = added + removed + modified;
        return totalChanges;
    }
};
ManageTodoListTool = __decorate([
    __param(2, IChatTodoListService),
    __param(3, ILogService),
    __param(4, ITelemetryService)
], ManageTodoListTool);
export { ManageTodoListTool };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlVG9kb0xpc3RUb29sLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Rvb2xzL21hbmFnZVRvZG9MaXN0VG9vbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBS04sY0FBYyxFQUdkLE1BQU0saUNBQWlDLENBQUM7QUFDekMsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQzFGLE9BQU8sRUFBYSxvQkFBb0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzVFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFFM0UsT0FBTyxFQUFFLHVCQUF1QixFQUFFLG1CQUFtQixFQUFFLE1BQU0sZUFBZSxDQUFDO0FBRTdFLE1BQU0sQ0FBQyxNQUFNLDhCQUE4QixHQUFHLDZCQUE2QixDQUFDO0FBQzVFLE1BQU0sQ0FBQyxNQUFNLHFDQUFxQyxHQUFHLG9DQUFvQyxDQUFDO0FBRTFGLE1BQU0sQ0FBQyxNQUFNLHdCQUF3QixHQUFHLGtCQUFrQixDQUFDO0FBRTNELE1BQU0sVUFBVSw0QkFBNEIsQ0FBQyxTQUFrQixFQUFFLHFCQUE4QixJQUFJO0lBQ2xHLE1BQU0sY0FBYyxHQUFRO1FBQzNCLFFBQVEsRUFBRTtZQUNULElBQUksRUFBRSxPQUFP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