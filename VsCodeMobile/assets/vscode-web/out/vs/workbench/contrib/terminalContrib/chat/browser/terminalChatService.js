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
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, DisposableMap, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ITerminalService } from '../../../terminal/browser/terminal.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IChatService } from '../../../chat/common/chatService.js';
import { TerminalChatContextKeys } from './terminalChat.js';
import { LocalChatSessionUri } from '../../../chat/common/chatUri.js';
import { isNumber, isString } from '../../../../../base/common/types.js';
var StorageKeys;
(function (StorageKeys) {
    StorageKeys["ToolSessionMappings"] = "terminalChat.toolSessionMappings";
    StorageKeys["CommandIdMappings"] = "terminalChat.commandIdMappings";
})(StorageKeys || (StorageKeys = {}));
/**
 * Used to manage chat tool invocations and the underlying terminal instances they create/use.
 */
let TerminalChatService = class TerminalChatService extends Disposable {
    constructor(_logService, _terminalService, _storageService, _contextKeyService, _chatService) {
        super();
        this._logService = _logService;
        this._terminalService = _terminalService;
        this._storageService = _storageService;
        this._contextKeyService = _contextKeyService;
        this._chatService = _chatService;
        this._terminalInstancesByToolSessionId = new Map();
        this._toolSessionIdByTerminalInstance = new Map();
        this._chatSessionIdByTerminalInstance = new Map();
        this._terminalInstanceListenersByToolSessionId = this._register(new DisposableMap());
        this._chatSessionListenersByTerminalInstance = this._register(new DisposableMap());
        this._onDidRegisterTerminalInstanceForToolSession = new Emitter();
        this.onDidRegisterTerminalInstanceWithToolSession = this._onDidRegisterTerminalInstanceForToolSession.event;
        this._activeProgressParts = new Set();
        /**
         * Pending mappings restored from storage that have not yet been matched to a live terminal
         * instance (we match by persistentProcessId when it becomes available after reconnection).
         * toolSessionId -> persistentProcessId
         */
        this._pendingRestoredMappings = new Map();
        /**
         * Tracks chat session IDs that have auto approval enabled for all commands. This is a temporary
         * approval that lasts only for the duration of the session.
         */
        this._sessionAutoApprovalEnabled = new Set();
        this._hasToolTerminalContext = TerminalChatContextKeys.hasChatTerminals.bindTo(this._contextKeyService);
        this._hasHiddenToolTerminalContext = TerminalChatContextKeys.hasHiddenChatTerminals.bindTo(this._contextKeyService);
        this._restoreFromStorage();
    }
    registerTerminalInstanceWithToolSession(terminalToolSessionId, instance) {
        if (!terminalToolSessionId) {
            this._logService.warn('Attempted to register a terminal instance with an undefined tool session ID');
            return;
        }
        this._terminalInstancesByToolSessionId.set(terminalToolSessionId, instance);
        this._toolSessionIdByTerminalInstance.set(instance, terminalToolSessionId);
        this._onDidRegisterTerminalInstanceForToolSession.fire(instance);
        this._terminalInstanceListenersByToolSessionId.set(terminalToolSessionId, instance.onDisposed(() => {
            this._terminalInstancesByToolSessionId.delete(terminalToolSessionId);
            this._toolSessionIdByTerminalInstance.delete(instance);
            this._terminalInstanceListenersByToolSessionId.deleteAndDispose(terminalToolSessionId);
            this._persistToStorage();
            this._updateHasToolTerminalContextKeys();
        }));
        this._register(this._chatService.onDidDisposeSession(e => {
            if (LocalChatSessionUri.parseLocalSessionId(e.sessionResource) === terminalToolSessionId) {
                this._terminalInstancesByToolSessionId.delete(terminalToolSessionId);
                this._toolSessionIdByTerminalInstance.delete(instance);
                this._terminalInstanceListenersByToolSessionId.deleteAndDispose(terminalToolSessionId);
                // Clean up session auto approval state
                const sessionId = LocalChatSessionUri.parseLocalSessionId(e.sessionResource);
                if (sessionId) {
                    this._sessionAutoApprovalEnabled.delete(sessionId);
                }
                this._persistToStorage();
                this._updateHasToolTerminalContextKeys();
            }
        }));
        // Update context keys when terminal instances change (including when terminals are created, disposed, revealed, or hidden)
        this._register(this._terminalService.onDidChangeInstances(() => this._updateHasToolTerminalContextKeys()));
        if (isNumber(instance.shellLaunchConfig?.attachPersistentProcess?.id) || isNumber(instance.persistentProcessId)) {
            this._persistToStorage();
        }
        this._updateHasToolTerminalContextKeys();
    }
    async getTerminalInstanceByToolSessionId(terminalToolSessionId) {
        await this._terminalService.whenConnected;
        if (!terminalToolSessionId) {
            return undefined;
        }
        if (this._pendingRestoredMappings.has(terminalToolSessionId)) {
            const instance = this._terminalService.instances.find(i => i.shellLaunchConfig.attachPersistentProcess?.id === this._pendingRestoredMappings.get(terminalToolSessionId));
            if (instance) {
                this._tryAdoptRestoredMapping(instance);
                return instance;
            }
        }
        return this._terminalInstancesByToolSessionId.get(terminalToolSessionId);
    }
    getToolSessionTerminalInstances(hiddenOnly) {
        if (hiddenOnly) {
            const foregroundInstances = new Set(this._terminalService.foregroundInstances.map(i => i.instanceId));
            const uniqueInstances = new Set(this._terminalInstancesByToolSessionId.values());
            return Array.from(uniqueInstances).filter(i => !foregroundInstances.has(i.instanceId));
        }
        // Ensure unique instances in case multiple tool sessions map to the same terminal
        return Array.from(new Set(this._terminalInstancesByToolSessionId.values()));
    }
    getToolSessionIdForInstance(instance) {
        return this._toolSessionIdByTerminalInstance.get(instance);
    }
    registerTerminalInstanceWithChatSession(chatSessionId, instance) {
        // If already registered with the same session ID, skip to avoid duplicate listeners
        if (this._chatSessionIdByTerminalInstance.get(instance) === chatSessionId) {
            return;
        }
        // Clean up previous listener if the instance was registered with a different session
        this._chatSessionListenersByTerminalInstance.deleteAndDispose(instance);
        this._chatSessionIdByTerminalInstance.set(instance, chatSessionId);
        // Clean up when the instance is disposed
        const disposable = instance.onDisposed(() => {
            this._chatSessionIdByTerminalInstance.delete(instance);
            this._chatSessionListenersByTerminalInstance.deleteAndDispose(instance);
        });
        this._chatSessionListenersByTerminalInstance.set(instance, disposable);
    }
    getChatSessionIdForInstance(instance) {
        return this._chatSessionIdByTerminalInstance.get(instance);
    }
    isBackgroundTerminal(terminalToolSessionId) {
        if (!terminalToolSessionId) {
            return false;
        }
        const instance = this._terminalInstancesByToolSessionId.get(terminalToolSessionId);
        if (!instance) {
            return false;
        }
        return this._terminalService.instances.includes(instance) && !this._terminalService.foregroundInstances.includes(instance);
    }
    registerProgressPart(part) {
        this._activeProgressParts.add(part);
        if (this._isAfter(part, this._mostRecentProgressPart)) {
            this._mostRecentProgressPart = part;
        }
        return toDisposable(() => {
            this._activeProgressParts.delete(part);
            if (this._focusedProgressPart === part) {
                this._focusedProgressPart = undefined;
            }
            if (this._mostRecentProgressPart === part) {
                this._mostRecentProgressPart = this._getLastActiveProgressPart();
            }
        });
    }
    setFocusedProgressPart(part) {
        this._focusedProgressPart = part;
    }
    clearFocusedProgressPart(part) {
        if (this._focusedProgressPart === part) {
            this._focusedProgressPart = undefined;
        }
    }
    getFocusedProgressPart() {
        return this._focusedProgressPart;
    }
    getMostRecentProgressPart() {
        return this._mostRecentProgressPart;
    }
    _getLastActiveProgressPart() {
        let latest;
        for (const part of this._activeProgressParts) {
            if (this._isAfter(part, latest)) {
                latest = part;
            }
        }
        return latest;
    }
    _isAfter(candidate, current) {
        if (!current) {
            return true;
        }
        if (candidate.elementIndex === current.elementIndex) {
            return candidate.contentIndex >= current.contentIndex;
        }
        return candidate.elementIndex > current.elementIndex;
    }
    _restoreFromStorage() {
        try {
            const raw = this._storageService.get("terminalChat.toolSessionMappings" /* StorageKeys.ToolSessionMappings */, 1 /* StorageScope.WORKSPACE */);
            if (!raw) {
                return;
            }
            const parsed = JSON.parse(raw);
            for (const [toolSessionId, persistentProcessId] of parsed) {
                if (isString(toolSessionId) && isNumber(persistentProcessId)) {
                    this._pendingRestoredMappings.set(toolSessionId, persistentProcessId);
                }
            }
        }
        catch (err) {
            this._logService.warn('Failed to restore terminal chat tool session mappings', err);
        }
    }
    _tryAdoptRestoredMapping(instance) {
        if (this._pendingRestoredMappings.size === 0) {
            return;
        }
        for (const [toolSessionId, persistentProcessId] of this._pendingRestoredMappings) {
            if (persistentProcessId === instance.shellLaunchConfig.attachPersistentProcess?.id) {
                this._terminalInstancesByToolSessionId.set(toolSessionId, instance);
                this._toolSessionIdByTerminalInstance.set(instance, toolSessionId);
                this._onDidRegisterTerminalInstanceForToolSession.fire(instance);
                this._terminalInstanceListenersByToolSessionId.set(toolSessionId, instance.onDisposed(() => {
                    this._terminalInstancesByToolSessionId.delete(toolSessionId);
                    this._toolSessionIdByTerminalInstance.delete(instance);
                    this._terminalInstanceListenersByToolSessionId.deleteAndDispose(toolSessionId);
                    this._persistToStorage();
                }));
                this._pendingRestoredMappings.delete(toolSessionId);
                this._persistToStorage();
                break;
            }
        }
    }
    _persistToStorage() {
        this._updateHasToolTerminalContextKeys();
        try {
            const entries = [];
            for (const [toolSessionId, instance] of this._terminalInstancesByToolSessionId.entries()) {
                if (isNumber(instance.persistentProcessId) && instance.shouldPersist) {
                    entries.push([toolSessionId, instance.persistentProcessId]);
                }
            }
            if (entries.length > 0) {
                this._storageService.store("terminalChat.toolSessionMappings" /* StorageKeys.ToolSessionMappings */, JSON.stringify(entries), 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
            }
            else {
                this._storageService.remove("terminalChat.toolSessionMappings" /* StorageKeys.ToolSessionMappings */, 1 /* StorageScope.WORKSPACE */);
            }
        }
        catch (err) {
            this._logService.warn('Failed to persist terminal chat tool session mappings', err);
        }
    }
    _updateHasToolTerminalContextKeys() {
        const toolCount = this._terminalInstancesByToolSessionId.size;
        this._hasToolTerminalContext.set(toolCount > 0);
        const hiddenTerminalCount = this.getToolSessionTerminalInstances(true).length;
        this._hasHiddenToolTerminalContext.set(hiddenTerminalCount > 0);
    }
    setChatSessionAutoApproval(chatSessionId, enabled) {
        if (enabled) {
            this._sessionAutoApprovalEnabled.add(chatSessionId);
        }
        else {
            this._sessionAutoApprovalEnabled.delete(chatSessionId);
        }
    }
    hasChatSessionAutoApproval(chatSessionId) {
        return this._sessionAutoApprovalEnabled.has(chatSessionId);
    }
};
TerminalChatService = __decorate([
    __param(0, ILogService),
    __param(1, ITerminalService),
    __param(2, IStorageService),
    __param(3, IContextKeyService),
    __param(4, IChatService)
], TerminalChatService);
export { TerminalChatService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDaGF0U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvY2hhdC9icm93c2VyL3Rlcm1pbmFsQ2hhdFNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLHFDQUFxQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFlLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQy9HLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUN4RSxPQUFPLEVBQTBFLGdCQUFnQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDakosT0FBTyxFQUFlLGtCQUFrQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDMUcsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxtREFBbUQsQ0FBQztBQUNqSCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDbkUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDNUQsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUV6RSxJQUFXLFdBR1Y7QUFIRCxXQUFXLFdBQVc7SUFDckIsdUVBQXdELENBQUE7SUFDeEQsbUVBQW9ELENBQUE7QUFDckQsQ0FBQyxFQUhVLFdBQVcsS0FBWCxXQUFXLFFBR3JCO0FBR0Q7O0dBRUc7QUFDSSxJQUFNLG1CQUFtQixHQUF6QixNQUFNLG1CQUFvQixTQUFRLFVBQVU7SUE4QmxELFlBQ2MsV0FBeUMsRUFDcEMsZ0JBQW1ELEVBQ3BELGVBQWlELEVB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