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
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { Memento } from '../../../common/memento.js';
import { chatSessionResourceToId } from './chatUri.js';
export const IChatTodoListService = createDecorator('chatTodoListService');
let ChatTodoListStorage = class ChatTodoListStorage {
    constructor(storageService) {
        this.memento = new Memento('chat-todo-list', storageService);
    }
    getSessionData(sessionResource) {
        const storage = this.memento.getMemento(1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        return storage[this.toKey(sessionResource)] || [];
    }
    setSessionData(sessionResource, todoList) {
        const storage = this.memento.getMemento(1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        storage[this.toKey(sessionResource)] = todoList;
        this.memento.saveMemento();
    }
    getTodoList(sessionResource) {
        return this.getSessionData(sessionResource);
    }
    setTodoList(sessionResource, todoList) {
        this.setSessionData(sessionResource, todoList);
    }
    toKey(sessionResource) {
        return chatSessionResourceToId(sessionResource);
    }
};
ChatTodoListStorage = __decorate([
    __param(0, IStorageService)
], ChatTodoListStorage);
export { ChatTodoListStorage };
let ChatTodoListService = class ChatTodoListService extends Disposable {
    constructor(storageService) {
        super();
        this._onDidUpdateTodos = this._register(new Emitter());
        this.onDidUpdateTodos = this._onDidUpdateTodos.event;
        this.todoListStorage = new ChatTodoListStorage(storageService);
    }
    getTodos(sessionResource) {
        return this.todoListStorage.getTodoList(sessionResource);
    }
    setTodos(sessionResource, todos) {
        this.todoListStorage.setTodoList(sessionResource, todos);
        this._onDidUpdateTodos.fire(sessionResource);
    }
};
ChatTodoListService = __decorate([
    __param(0, IStorageService)
], ChatTodoListService);
export { ChatTodoListService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvZG9MaXN0U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0VG9kb0xpc3RTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFbEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sZ0RBQWdELENBQUM7QUFDOUcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ3JELE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQWN2RCxNQUFNLENBQUMsTUFBTSxvQkFBb0IsR0FBRyxlQUFlLENBQXVCLHFCQUFxQixDQUFDLENBQUM7QUFTMUYsSUFBTSxtQkFBbUIsR0FBekIsTUFBTSxtQkFBbUI7SUFHL0IsWUFBNkIsY0FBK0I7UUFDM0QsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxjQUFjLENBQUMsQ0FBQztJQUM5RCxDQUFDO0lBRU8sY0FBYyxDQUFDLGVBQW9CO1FBQzFDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSwrREFBK0MsQ0FBQztRQUN2RixPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ25ELENBQUM7SUFFTyxjQUFjLENBQUMsZUFBb0IsRUFBRSxRQUFxQjtRQUNqRSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsK0RBQStDLENBQUM7UUFDdkYsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUM7UUFDaEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUM1QixDQUFDO0lBRUQsV0FBVyxDQUFDLGVBQW9CO1FBQy9CLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUM3QyxDQUFDO0lBRUQsV0FBVyxDQUFDLGVBQW9CLEVBQUUsUUFBcUI7UUFDdEQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxlQUFlLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVPLEtBQUssQ0FBQyxlQUFvQjtRQUNqQyxPQUFPLHVCQUF1QixDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ2pELENBQUM7Q0FDRCxDQUFBO0FBN0JZLG1CQUFtQjtJQUdsQixXQUFBLGVBQWUsQ0FBQTtHQUhoQixtQkFBbUIsQ0E2Qi9COztBQUVNLElBQU0sbUJBQW1CLEdBQXpCLE1BQU0sbUJBQW9CLFNBQVEsVUFBVTtJQVFsRCxZQUE2QixjQUErQjtRQUMzRCxLQUFLLEVBQUUsQ0FBQztRQU5RLHNCQUFpQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQU8sQ0FBQyxDQUFDO1FBQy9ELHFCQUFnQixHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUM7UUFNeEQsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLG1CQUFtQixDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ2hFLENBQUM7SUFFRCxRQUFRLENBQUMsZUFBb0I7UUFDNUIsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRUQsUUFBUSxDQUFDLGVBQW9CLEVBQUUsS0FBa0I7UUFDaEQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsZUFBZSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3pELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDOUMsQ0FBQztDQUNELENBQUE7QUFyQlksbUJBQW1CO0lBUWxCLFdBQUEsZUFBZSxDQUFBO0dBUmhCLG1CQUFtQixDQXFCL0IifQ==