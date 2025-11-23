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
import { equals as arraysEqual } from '../../../../base/common/arrays.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { Memento } from '../../../common/memento.js';
import { CHAT_PROVIDER_ID } from './chatParticipantContribTypes.js';
import { ChatAgentLocation, ChatModeKind } from './constants.js';
export const IChatWidgetHistoryService = createDecorator('IChatWidgetHistoryService');
export const ChatInputHistoryMaxEntries = 40;
let ChatWidgetHistoryService = class ChatWidgetHistoryService extends Disposable {
    constructor(storageService) {
        super();
        this._onDidChangeHistory = this._register(new Emitter());
        this.changed = false;
        this.onDidChangeHistory = this._onDidChangeHistory.event;
        this.memento = new Memento('interactive-session', storageService);
        const loadedState = this.memento.getMemento(1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        this.viewState = loadedState;
        this._register(storageService.onWillSaveState(() => {
            if (this.changed) {
                this.memento.saveMemento();
                this.changed = false;
            }
        }));
    }
    getHistory(location) {
        const key = this.getKey(location);
        const history = this.viewState.history?.[key] ?? [];
        return history.map(entry => this.migrateHistoryEntry(entry));
    }
    migrateHistoryEntry(entry) {
        // If it's already in the new format (has 'inputText' property), return as-is
        if (entry.inputText !== undefined) {
            return entry;
        }
        // Otherwise, it's an old IChatHistoryEntry with 'text' and 'state' properties
        const oldEntry = entry;
        const oldState = oldEntry.state ?? {};
        // Migrate chatMode to the new mode structure
        let modeId;
        let modeKind;
        if (oldState.chatMode) {
            if (typeof oldState.chatMode === 'string') {
                modeId = oldState.chatMode;
                modeKind = Object.values(ChatModeKind).includes(oldState.chatMode)
                    ? oldState.chatMode
                    : undefined;
            }
            else if (typeof oldState.chatMode === 'object' && oldState.chatMode !== null) {
                // Old format: { id: string }
                const oldMode = oldState.chatMode;
                modeId = oldMode.id ?? ChatModeKind.Ask;
                modeKind = oldMode.id && Object.values(ChatModeKind).includes(oldMode.id)
                    ? oldMode.id
                    : undefined;
            }
            else {
                modeId = ChatModeKind.Ask;
                modeKind = ChatModeKind.Ask;
            }
        }
        else {
            modeId = ChatModeKind.Ask;
            modeKind = ChatModeKind.Ask;
        }
        return {
            inputText: oldEntry.text ?? '',
            attachments: oldState.chatContextAttachments ?? [],
            mode: {
                id: modeId,
                kind: modeKind
            },
            contrib: oldEntry.state || {},
            selectedModel: undefined,
            selections: []
        };
    }
    getKey(location) {
        // Preserve history for panel by continuing to use the same old provider id. Use the location as a key for other chat locations.
        return location === ChatAgentLocation.Chat ? CHAT_PROVIDER_ID : location;
    }
    append(location, history) {
        this.viewState.history ??= {};
        const key = this.getKey(location);
        this.viewState.history[key] = this.getHistory(location).concat(history).slice(-ChatInputHistoryMaxEntries);
        this.changed = true;
        this._onDidChangeHistory.fire({ kind: 'append', entry: history });
    }
    clearHistory() {
        this.viewState.history = {};
        this.changed = true;
        this._onDidChangeHistory.fire({ kind: 'clear' });
    }
};
ChatWidgetHistoryService = __decorate([
    __param(0, IStorageService)
], ChatWidgetHistoryService);
export { ChatWidgetHistoryService };
let ChatHistoryNavigator = class ChatHistoryNavigator extends Disposable {
    get values() {
        return this.chatWidgetHistoryService.getHistory(this.location);
    }
    constructor(location, chatWidgetHistoryService) {
        super();
        this.location = location;
        this.chatWidgetHistoryService = chatWidgetHistoryService;
        this._overlay = [];
        this._history = this.chatWidgetHistoryService.getHistory(this.location);
        this._currentIndex = this._history.length;
        this._register(this.chatWidgetHistoryService.onDidChangeHistory(e => {
            if (e.kind === 'append') {
                const prevLength = this._history.length;
                this._history = this.chatWidgetHistoryService.getHistory(this.location);
                const newLength = this._history.length;
                // If this append operation adjusted all history entries back, move our index back too
                // if we weren't pointing to the end of the history.
                if (prevLength === newLength) {
                    this._overlay.shift();
                    if (this._currentIndex < this._history.length) {
                        this._currentIndex = Math.max(this._currentIndex - 1, 0);
                    }
                }
                else if (this._currentIndex === prevLength) {
                    this._currentIndex = newLength;
                }
            }
            else if (e.kind === 'clear') {
                this._history = [];
                this._currentIndex = 0;
                this._overlay = [];
            }
        }));
    }
    isAtEnd() {
        return this._currentIndex === Math.max(this._history.length, this._overlay.length);
    }
    isAtStart() {
        return this._currentIndex === 0;
    }
    /**
     * Replaces a history entry at the current index in this view of the history.
     * Allows editing of old history entries while preventing accidental navigation
     * from losing the edits.
     */
    overlay(entry) {
        this._overlay[this._currentIndex] = entry;
    }
    resetCursor() {
        this._currentIndex = this._history.length;
    }
    previous() {
        this._currentIndex = Math.max(this._currentIndex - 1, 0);
        return this.current();
    }
    next() {
        this._currentIndex = Math.min(this._currentIndex + 1, this._history.length);
        return this.current();
    }
    current() {
        return this._overlay[this._currentIndex] ?? this._history[this._currentIndex];
    }
    /**
     * Appends a new entry to the navigator. Resets the state back to the end
     * and clears any overlayed entries.
     */
    append(entry) {
        this._overlay = [];
        this._currentIndex = this._history.length;
        if (!entriesEqual(this._history.at(-1), entry)) {
            this.chatWidgetHistoryService.append(this.location, entry);
        }
    }
};
ChatHistoryNavigator = __decorate([
    __param(1, IChatWidgetHistoryService)
], ChatHistoryNavigator);
export { ChatHistoryNavigator };
function entriesEqual(a, b) {
    if (!a || !b) {
        return false;
    }
    if (a.inputText !== b.inputText) {
        return false;
    }
    if (!arraysEqual(a.attachments, b.attachments, (x, y) => x.id === y.id)) {
        return false;
    }
    return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFdpZGdldEhpc3RvcnlTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL2NoYXRXaWRnZXRIaXN0b3J5U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsTUFBTSxJQUFJLFdBQVcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sZ0RBQWdELENBQUM7QUFDOUcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBRXJELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRXBFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQW1CakUsTUFBTSxDQUFDLE1BQU0seUJBQXlCLEdBQUcsZUFBZSxDQUE0QiwyQkFBMkIsQ0FBQyxDQUFDO0FBaUJqSCxNQUFNLENBQUMsTUFBTSwwQkFBMEIsR0FBRyxFQUFFLENBQUM7QUFFdEMsSUFBTSx3QkFBd0IsR0FBOUIsTUFBTSx3QkFBeUIsU0FBUSxVQUFVO0lBVXZELFlBQ2tCLGNBQStCO1FBRWhELEtBQUssRUFBRSxDQUFDO1FBUFEsd0JBQW1CLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBcUIsQ0FBQyxDQUFDO1FBQ2hGLFlBQU8sR0FBRyxLQUFLLENBQUM7UUFDZix1QkFBa0IsR0FBRyxJQUFJLENBQUMsbUJBQW1C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