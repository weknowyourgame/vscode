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
var ChatEditorInput_1;
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { isEqual } from '../../../../base/common/resources.js';
import { truncate } from '../../../../base/common/strings.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import * as nls from '../../../../nls.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IChatService } from '../common/chatService.js';
import { IChatSessionsService, localChatSessionType } from '../common/chatSessionsService.js';
import { LocalChatSessionUri } from '../common/chatUri.js';
import { ChatAgentLocation, ChatEditorTitleMaxLength } from '../common/constants.js';
const ChatEditorIcon = registerIcon('chat-editor-label-icon', Codicon.chatSparkle, nls.localize('chatEditorLabelIcon', 'Icon of the chat editor label.'));
let ChatEditorInput = class ChatEditorInput extends EditorInput {
    static { ChatEditorInput_1 = this; }
    /** Maps input name strings to sets of active editor counts */
    static { this.countsInUseMap = new Map(); }
    static { this.TypeID = 'workbench.input.chatSession'; }
    static { this.EditorID = 'workbench.editor.chatSession'; }
    /**
     * Get the uri of the session this editor input is associated with.
     *
     * This should be preferred over using `resource` directly, as it handles cases where a chat editor becomes a session
     */
    get sessionResource() { return this._sessionResource; }
    get model() {
        return this.modelRef.value?.object;
    }
    static getNewEditorUri() {
        return ChatEditorUri.getNewEditorUri();
    }
    static getNextCount(inputName) {
        let count = 0;
        while (ChatEditorInput_1.countsInUseMap.get(inputName)?.has(count)) {
            count++;
        }
        return count;
    }
    constructor(resource, options, chatService, dialogService, chatSessionsService) {
        super();
        this.resource = resource;
        this.options = options;
        this.chatService = chatService;
        this.dialogService = dialogService;
        this.chatSessionsService = chatSessionsService;
        this.hasCustomTitle = false;
        this.didTransferOutEditingSession = false;
        this.modelRef = this._register(new MutableDisposable());
        this.closeHandler = this;
        if (resource.scheme === Schemas.vscodeChatEditor) {
            const parsed = ChatEditorUri.parse(resource);
            if (!parsed || typeof parsed !== 'number') {
                throw new Error('Invalid chat URI');
            }
        }
        else if (resource.scheme === Schemas.vscodeLocalChatSession) {
            const localSessionId = LocalChatSessionUri.parseLocalSessionId(resource);
            if (!localSessionId) {
                throw new Error('Invalid local chat session URI');
            }
            this._sessionResource = resource;
        }
        else {
            this._sessionResource = resource;
        }
        // Check if we already have a custom title for this session
        const hasExistingCustomTitle = this._sessionResource && (this.chatService.getSession(this._sessionResource)?.title ||
            this.chatService.getPersistedSessionTitle(this._sessionResource)?.trim());
        this.hasCustomTitle = Boolean(hasExistingCustomTitle);
        // Input counts are unique to the displayed fallback title
        this.inputName = options.title?.fallback ?? '';
        if (!ChatEditorInput_1.countsInUseMap.has(this.inputName)) {
            ChatEditorInput_1.countsInUseMap.set(this.inputName, new Set());
        }
        // Only allocate a count if we don't already have a custom title
        if (!this.hasCustomTitle) {
            this.inputCount = ChatEditorInput_1.getNextCount(this.inputName);
            ChatEditorInput_1.countsInUseMap.get(this.inputName)?.add(this.inputCount);
            this._register(toDisposable(() => {
                // Only remove if we haven't already removed it due to custom title
                if (!this.hasCustomTitle) {
                    ChatEditorInput_1.countsInUseMap.get(this.inputName)?.delete(this.inputCount);
                    if (ChatEditorInput_1.countsInUseMap.get(this.inputName)?.size === 0) {
                        ChatEditorInput_1.countsInUseMap.delete(this.inputName);
                    }
                }
            }));
        }
        else {
            this.inputCount = 0; // Not used when we have a custom title
        }
    }
    showConfirm() {
        return this.model?.editingSession ? shouldShowClearEditingSessionConfirmation(this.model.editingSession) : false;
    }
    transferOutEditingSession() {
        this.didTransferOutEditingSession = true;
        return this.model?.editingSession;
    }
    async confirm(editors) {
        if (!this.model?.editingSession || this.didTransferOutEditingSession) {
            return 0 /* ConfirmResult.SAVE */;
        }
        const titleOverride = nls.localize('chatEditorConfirmTitle', "Close Chat Editor");
        const messageOverride = nls.localize('chat.startEditing.confirmation.pending.message.default', "Closing the chat editor will end your current edit session.");
        const result = await showClearEditingSessionConfirmation(this.model.editingSession, this.dialogService, { titleOverride, messageOverride });
        return result ? 0 /* ConfirmResult.SAVE */ : 2 /* ConfirmResult.CANCEL */;
    }
    get editorId() {
        return ChatEditorInput_1.EditorID;
    }
    get capabilities() {
        return super.capabilities | 8 /* EditorInputCapabilities.Singleton */ | 128 /* EditorInputCapabilities.CanDropIntoEditor */;
    }
    matches(otherInput) {
        if (!(otherInput instanceof ChatEditorInput_1)) {
            return false;
        }
        return isEqual(this.sessionResource, otherInput.sessionResource);
    }
    get typeId() {
        return ChatEditorInput_1.TypeID;
    }
    getName() {
        // If we have a resolved model, use its title
        if (this.model?.title) {
            // Only truncate if the default title is being used (don't truncate custom titles)
            return this.model.hasCustomTitle ? this.model.title : truncate(this.model.title, ChatEditorTitleMaxLength);
        }
        // If we have a sessionId but no resolved model, try to get the title from persisted sessions
        if (this._sessionResource) {
            // First try the active session registry
            const existingSession = this.chatService.getSession(this._sessionResource);
            if (existingSession?.title) {
                return existingSession.title;
            }
            // If not in active registry, try persisted session data
            const persistedTitle = this.chatService.getPersistedSessionTitle(this._sessionResource);
            if (persistedTitle && persistedTitle.trim()) { // Only use non-empty persisted titles
                return persistedTitle;
            }
        }
        // If a preferred title was provided in options, use it
        if (this.options.title?.preferred) {
            return this.options.title.preferred;
        }
        // Fall back to default naming pattern
        const inputCountSuffix = (this.inputCount > 0 ? ` ${this.inputCount + 1}` : '');
        const defaultName = this.options.title?.fallback ?? nls.localize('chatEditorName', "Chat");
        return defaultName + inputCountSuffix;
    }
    getTitle(verbosity) {
        const name = this.getName();
        if (verbosity === 2 /* Verbosity.LONG */) { // Verbosity LONG is used for tooltips
            const sessionTypeDisplayName = this.getSessionTypeDisplayName();
            if (sessionTypeDisplayName) {
                return `${name} | ${sessionTypeDisplayName}`;
            }
        }
        return name;
    }
    getSessionTypeDisplayName() {
        const sessionType = this.getSessionType();
        if (sessionType === localChatSessionType) {
            return;
        }
        const contributions = this.chatSessionsService.getAllChatSessionContributions();
        const contribution = contributions.find(c => c.type === sessionType);
        return contribution?.displayName;
    }
    getIcon() {
        const resolvedIcon = this.resolveIcon();
        if (resolvedIcon) {
            this.cachedIcon = resolvedIcon;
            return resolvedIcon;
        }
        // Fall back to default icon
        return ChatEditorIcon;
    }
    resolveIcon() {
        // TODO@osortega,@rebornix double check: Chat Session Item icon is reserved for chat session list and deprecated for chat session status. thus here we use session type icon. We may want to show status for the Editor Title.
        const sessionType = this.getSessionType();
        if (sessionType !== localChatSessionType) {
            const typeIcon = this.chatSessionsService.getIconForSessionType(sessionType);
            if (typeIcon) {
                return typeIcon;
            }
        }
        return undefined;
    }
    /**
     * Returns chat session type from a URI, or {@linkcode localChatSessionType} if not specified or cannot be determined.
     */
    getSessionType() {
        if (this.resource.scheme === Schemas.vscodeChatEditor || this.resource.scheme === Schemas.vscodeLocalChatSession) {
            return localChatSessionType;
        }
        return this.resource.scheme;
    }
    async resolve() {
        const searchParams = new URLSearchParams(this.resource.query);
        const chatSessionType = searchParams.get('chatSessionType');
        const inputType = chatSessionType ?? this.resource.authority;
        if (this._sessionResource) {
            this.modelRef.value = await this.chatService.loadSessionForResource(this._sessionResource, ChatAgentLocation.Chat, CancellationToken.None);
            // For local session only, if we find no existing session, create a new one
            if (!this.model && LocalChatSessionUri.parseLocalSessionId(this._sessionResource)) {
                this.modelRef.value = this.chatService.startSession(ChatAgentLocation.Chat, CancellationToken.None, { canUseTools: true });
            }
        }
        else if (!this.options.target) {
            this.modelRef.value = this.chatService.startSession(ChatAgentLocation.Chat, CancellationToken.None, { canUseTools: !inputType });
        }
        else if (this.options.target.data) {
            this.modelRef.value = this.chatService.loadSessionFromContent(this.options.target.data);
        }
        if (!this.model || this.isDisposed()) {
            return null;
        }
        this._sessionResource = this.model.sessionResource;
        this._register(this.model.onDidChange((e) => {
            // When a custom title is set, we no longer need the numeric count
            if (e && e.kind === 'setCustomTitle' && !this.hasCustomTitle) {
                this.hasCustomTitle = true;
                ChatEditorInput_1.countsInUseMap.get(this.inputName)?.delete(this.inputCount);
                if (ChatEditorInput_1.countsInUseMap.get(this.inputName)?.size === 0) {
                    ChatEditorInput_1.countsInUseMap.delete(this.inputName);
                }
            }
            // Invalidate icon cache when label changes
            this.cachedIcon = undefined;
            this._onDidChangeLabel.fire();
        }));
        // Check if icon has changed after model resolution
        const newIcon = this.resolveIcon();
        if (newIcon && (!this.cachedIcon || !this.iconsEqual(this.cachedIcon, newIcon))) {
            this.cachedIcon = newIcon;
        }
        this._onDidChangeLabel.fire();
        return this._register(new ChatEditorModel(this.model));
    }
    iconsEqual(a, b) {
        if (ThemeIcon.isThemeIcon(a) && ThemeIcon.isThemeIcon(b)) {
            return a.id === b.id;
        }
        if (a instanceof URI && b instanceof URI) {
            return a.toString() === b.toString();
        }
        return false;
    }
};
ChatEditorInput = ChatEditorInput_1 = __decorate([
    __param(2, IChatService),
    __param(3, IDialogService),
    __param(4, IChatSessionsService)
], ChatEditorInput);
export { ChatEditorInput };
export class ChatEditorModel extends Disposable {
    constructor(model) {
        super();
        this.model = model;
        this._onWillDispose = this._register(new Emitter());
        this.onWillDispose = this._onWillDispose.event;
        this._isResolved = false;
    }
    async resolve() {
        this._isResolved = true;
    }
    isResolved() {
        return this._isResolved;
    }
    isDisposed() {
        return this._store.isDisposed;
    }
}
var ChatEditorUri;
(function (ChatEditorUri) {
    const scheme = Schemas.vscodeChatEditor;
    function getNewEditorUri() {
        const handle = Math.floor(Math.random() * 1e9);
        return URI.from({ scheme, path: `chat-${handle}` });
    }
    ChatEditorUri.getNewEditorUri = getNewEditorUri;
    function parse(resource) {
        if (resource.scheme !== scheme) {
            return undefined;
        }
        const match = resource.path.match(/chat-(\d+)/);
        const handleStr = match?.[1];
        if (typeof handleStr !== 'string') {
            return undefined;
        }
        const handle = parseInt(handleStr);
        if (isNaN(handle)) {
            return undefined;
        }
        return handle;
    }
    ChatEditorUri.parse = parse;
})(ChatEditorUri || (ChatEditorUri = {}));
export class ChatEditorInputSerializer {
    canSerialize(input) {
        return input instanceof ChatEditorInput && !!input.sessionResource;
    }
    serialize(input) {
        if (!this.canSerialize(input)) {
            return undefined;
        }
        const obj = {
            options: input.options,
            sessionResource: input.sessionResource,
            resource: input.resource,
        };
        return JSON.stringify(obj);
    }
    deserialize(instantiationService, serializedEditor) {
        try {
            // Old inputs have a session id for local session
            const parsed = JSON.parse(serializedEditor);
            // First if we have a modern session resource, use that
            if (parsed.sessionResource) {
                const sessionResource = URI.revive(parsed.sessionResource);
                return instantiationService.createInstance(ChatEditorInput, sessionResource, parsed.options);
            }
            // Otherwise check to see if we're a chat editor with a local session id
            let resource = URI.revive(parsed.resource);
            if (resource.scheme === Schemas.vscodeChatEditor && parsed.sessionId) {
                resource = LocalChatSessionUri.forSession(parsed.sessionId);
            }
            return instantiationService.createInstance(ChatEditorInput, resource, parsed.options);
        }
        catch (err) {
            return undefined;
        }
    }
}
export async function showClearEditingSessionConfirmation(editingSession, dialogService, options) {
    const defaultPhrase = nls.localize('chat.startEditing.confirmation.pending.message.default1', "Starting a new chat will end your current edit session.");
    const defaultTitle = nls.localize('chat.startEditing.confirmation.title', "Start new chat?");
    const phrase = options?.messageOverride ?? defaultPhrase;
    const title = options?.titleOverride ?? defaultTitle;
    const currentEdits = editingSession.entries.get();
    const undecidedEdits = currentEdits.filter((edit) => edit.state.get() === 0 /* ModifiedFileEntryState.Modified */);
    const { result } = await dialogService.prompt({
        title,
        message: phrase + ' ' + nls.localize('chat.startEditing.confirmation.pending.message.2', "Do you want to keep pending edits to {0} files?", undecidedEdits.length),
        type: 'info',
        cancelButton: true,
        buttons: [
            {
                label: nls.localize('chat.startEditing.confirmation.acceptEdits', "Keep & Continue"),
                run: async () => {
                    await editingSession.accept();
                    return true;
                }
            },
            {
                label: nls.localize('chat.startEditing.confirmation.discardEdits', "Undo & Continue"),
                run: async () => {
                    await editingSession.reject();
                    return true;
                }
            }
        ],
    });
    return Boolean(result);
}
export function shouldShowClearEditingSessionConfirmation(editingSession) {
    const currentEdits = editingSession.entries.get();
    const currentEditCount = currentEdits.length;
    if (currentEditCount) {
        const undecidedEdits = currentEdits.filter((edit) => edit.state.get() === 0 /* ModifiedFileEntryState.Modified */);
        return !!undecidedEdits.length;
    }
    return false;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRvcklucHV0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0RWRpdG9ySW5wdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDM0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFpQixjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUUvRixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFFakYsT0FBTyxFQUFFLFdBQVcsRUFBdUIsTUFBTSx1Q0FBdUMsQ0FBQztBQUd6RixPQUFPLEVBQXVCLFlBQVksRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzdFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzlGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQzNELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBSXJGLE1BQU0sY0FBYyxHQUFHLFlBQVksQ0FBQyx3QkFBd0IsRUFBRSxPQUFPLENBQUMsV0FBVyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMscUJBQXFCLEVBQUUsZ0NBQWdDLENBQUMsQ0FBQyxDQUFDO0FBRW5KLElBQU0sZUFBZSxHQUFyQixNQUFNLGVBQWdCLFNBQVEsV0FBVzs7SUFDL0MsOERBQThEO2FBQzlDLG1CQUFjLEdBQUcsSUFBSSxHQUFHLEVBQXVCLEFBQWpDLENBQWtDO2FBRWhELFdBQU0sR0FBVyw2QkFBNkIsQUFBeEMsQ0FBeUM7YUFDL0MsYUFBUSxHQUFXLDhCQUE4QixBQUF6QyxDQUEwQztJQU9sRTs7OztPQUlHO0lBQ0gsSUFBVyxlQUFlLEtBQXNCLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQztJQVEvRSxJQUFZLEtBQUs7UUFDaEIsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUM7SUFDcEMsQ0FBQztJQUVELE1BQU0sQ0FBQyxlQUFlO1FBQ3JCLE9BQU8sYUFBYSxDQUFDLGVBQWUsRUFBRSxDQUFDO0lBQ3hDLENBQUM7SUFFTyxNQUFNLENBQUMsWUFBWSxDQUFDLFNBQWlCO1FBQzVDLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztRQUNkLE9BQU8saUJBQWUsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ2xFLEtBQUssRUFBRSxDQUFDO1FBQ1QsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVELFlBQ1UsUUFBYSxFQUNiLE9BQTJCLEVBQ3RCLFdBQTBDLEVBQ3hDLGFBQThDLEVBQ3hDLG1CQUEwRDtRQUVoRixLQUFLLEVBQUUsQ0FBQztRQU5DLGFBQVEsR0FBUixRQUFRLENBQUs7UUFDYixZQUFPLEdBQVAsT0FBTyxDQUFvQjtRQUNMLGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBQ3ZCLGtCQUFhLEdBQWIsYUFBYSxDQUFnQjtRQUN2Qix3QkFBbUIsR0FBbkIsbUJBQW1CLENBQXNCO1FBNUJ6RSxtQkFBYyxHQUFZLEtBQUssQ0FBQztRQUNoQyxpQ0FBNEIsR0FBRyxLQUFLLENBQUM7UUFHNUIsYUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxpQkFBaUIsRUFBdUIsQ0FBQyxDQUFDO1FBMkVoRixpQkFBWSxHQUFHLElBQUksQ0FBQztRQS9DNUIsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ2xELE1BQU0sTUFBTSxHQUFHLGFBQWEsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLE1BQU0sSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUUsQ0FBQztnQkFDM0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1lBQ3JDLENBQUM7UUFDRixDQUFDO2FBQU0sSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLE9BQU8sQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1lBQy9ELE1BQU0sY0FBYyxHQUFHLG1CQUFtQixDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3pFLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFDckIsTUFBTSxJQUFJLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO1lBQ25ELENBQUM7WUFDRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsUUFBUSxDQUFDO1FBQ2xDLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLGdCQUFnQixHQUFHLFFBQVEsQ0FBQztRQUNsQyxDQUFDO1FBRUQsMkRBQTJEO1FBQzNELE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixJQUFJLENBQ3ZELElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLEtBQUs7WUFDekQsSUFBSSxDQUFDLFdBQVcsQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FDeEUsQ0FBQztRQUVGLElBQUksQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFFdEQsMERBQTBEO1FBQzFELElBQUksQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDLEtBQUssRUFBRSxRQUFRLElBQUksRUFBRSxDQUFDO1FBQy9DLElBQUksQ0FBQyxpQkFBZSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7WUFDekQsaUJBQWUsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFFRCxnRUFBZ0U7UUFDaEUsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUMxQixJQUFJLENBQUMsVUFBVSxHQUFHLGlCQUFlLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUMvRCxpQkFBZSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDekUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFO2dCQUNoQyxtRUFBbUU7Z0JBQ25FLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7b0JBQzFCLGlCQUFlLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDNUUsSUFBSSxpQkFBZSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQzt3QkFDcEUsaUJBQWUsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDdkQsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQyx1Q0FBdUM7UUFDN0QsQ0FBQztJQUNGLENBQUM7SUFJRCxXQUFXO1FBQ1YsT0FBTyxJQUFJLENBQUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMseUNBQXlDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0lBQ2xILENBQUM7SUFFRCx5QkFBeUI7UUFDeEIsSUFBSSxDQUFDLDRCQUE0QixHQUFHLElBQUksQ0FBQztRQUN6QyxPQUFPLElBQUksQ0FBQyxLQUFLLEVBQUUsY0FBYyxDQUFDO0lBQ25DLENBQUM7SUFFRCxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQXlDO1FBQ3RELElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLGNBQWMsSUFBSSxJQUFJLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztZQUN0RSxrQ0FBMEI7UUFDM0IsQ0FBQztRQUVELE1BQU0sYUFBYSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsd0JBQXdCLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUNsRixNQUFNLGVBQWUsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLHdEQUF3RCxFQUFFLDZEQUE2RCxDQUFDLENBQUM7UUFDOUosTUFBTSxNQUFNLEdBQUcsTUFBTSxtQ0FBbUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxDQUFDLENBQUM7UUFDNUksT0FBTyxNQUFNLENBQUMsQ0FBQyw0QkFBb0IsQ0FBQyw2QkFBcUIsQ0FBQztJQUMzRCxDQUFDO0lBRUQsSUFBYSxRQUFRO1FBQ3BCLE9BQU8saUJBQWUsQ0FBQyxRQUFRLENBQUM7SUFDakMsQ0FBQztJQUVELElBQWEsWUFBWTtRQUN4QixPQUFPLEtBQUssQ0FBQyxZQUFZLDRDQUFvQyxzREFBNEMsQ0FBQztJQUMzRyxDQUFDO0lBRVEsT0FBTyxDQUFDLFVBQTZDO1FBQzdELElBQUksQ0FBQyxDQUFDLFVBQVUsWUFBWSxpQkFBZSxDQUFDLEVBQUUsQ0FBQztZQUM5QyxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLFVBQVUsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUNsRSxDQUFDO0lBRUQsSUFBYSxNQUFNO1FBQ2xCLE9BQU8saUJBQWUsQ0FBQyxNQUFNLENBQUM7SUFDL0IsQ0FBQztJQUVRLE9BQU87UUFDZiw2Q0FBNkM7UUFDN0MsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxDQUFDO1lBQ3ZCLGtGQUFrRjtZQUNsRixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLHdCQUF3QixDQUFDLENBQUM7UUFDNUcsQ0FBQztRQUVELDZGQUE2RjtRQUM3RixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQzNCLHdDQUF3QztZQUN4QyxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUMzRSxJQUFJLGVBQWUsRUFBRSxLQUFLLEVBQUUsQ0FBQztnQkFDNUIsT0FBTyxlQUFlLENBQUMsS0FBSyxDQUFDO1lBQzlCLENBQUM7WUFFRCx3REFBd0Q7WUFDeEQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUN4RixJQUFJLGNBQWMsSUFBSSxjQUFjLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLHNDQUFzQztnQkFDcEYsT0FBTyxjQUFjLENBQUM7WUFDdkIsQ0FBQztRQUNGLENBQUM7UUFFRCx1REFBdUQ7UUFDdkQsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQztZQUNuQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQztRQUNyQyxDQUFDO1FBRUQsc0NBQXNDO1FBQ3RDLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsVUFBVSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNoRixNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxRQUFRLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUMzRixPQUFPLFdBQVcsR0FBRyxnQkFBZ0IsQ0FBQztJQUN2QyxDQUFDO0lBRVEsUUFBUSxDQUFDLFNBQXFCO1FBQ3RDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUM1QixJQUFJLFNBQVMsMkJBQW1CLEVBQUUsQ0FBQyxDQUFDLHNDQUFzQztZQUN6RSxNQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO1lBQ2hFLElBQUksc0JBQXNCLEVBQUUsQ0FBQztnQkFDNUIsT0FBTyxHQUFHLElBQUksTUFBTSxzQkFBc0IsRUFBRSxDQUFDO1lBQzlDLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRU8seUJBQXlCO1FBQ2hDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUMxQyxJQUFJLFdBQVcsS0FBSyxvQkFBb0IsRUFBRSxDQUFDO1lBQzFDLE9BQU87UUFDUixDQUFDO1FBQ0QsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLDhCQUE4QixFQUFFLENBQUM7UUFDaEYsTUFBTSxZQUFZLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssV0FBVyxDQUFDLENBQUM7UUFDckUsT0FBTyxZQUFZLEVBQUUsV0FBVyxDQUFDO0lBQ2xDLENBQUM7SUFFUSxPQUFPO1FBQ2YsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ3hDLElBQUksWUFBWSxFQUFFLENBQUM7WUFDbEIsSUFBSSxDQUFDLFVBQVUsR0FBRyxZQUFZLENBQUM7WUFDL0IsT0FBTyxZQUFZLENBQUM7UUFDckIsQ0FBQztRQUVELDRCQUE0QjtRQUM1QixPQUFPLGNBQWMsQ0FBQztJQUN2QixDQUFDO0lBRU8sV0FBVztRQUNsQiw4TkFBOE47UUFDOU4sTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQzFDLElBQUksV0FBVyxLQUFLLG9CQUFvQixFQUFFLENBQUM7WUFDMUMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLHFCQUFxQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzdFLElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQ2QsT0FBTyxRQUFRLENBQUM7WUFDakIsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQ7O09BRUc7SUFDSSxjQUFjO1FBQ3BCLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEtBQUssT0FBTyxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxLQUFLLE9BQU8sQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1lBQ2xILE9BQU8sb0JBQW9CLENBQUM7UUFDN0IsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7SUFDN0IsQ0FBQztJQUVRLEtBQUssQ0FBQyxPQUFPO1FBQ3JCLE1BQU0sWUFBWSxHQUFHLElBQUksZUFBZSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDOUQsTUFBTSxlQUFlLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQzVELE1BQU0sU0FBUyxHQUFHLGVBQWUsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQztRQUU3RCxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQzNCLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBRTNJLDJFQUEyRTtZQUMzRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxtQkFBbUIsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDO2dCQUNuRixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxFQUFFLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7WUFDNUgsQ0FBQztRQUNGLENBQUM7YUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNqQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxFQUFFLEVBQUUsV0FBVyxFQUFFLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUNsSSxDQUFDO2FBQU0sSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNyQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3pGLENBQUM7UUFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQztZQUN0QyxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFFRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUM7UUFFbkQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO1lBQzNDLGtFQUFrRTtZQUNsRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLGdCQUFnQixJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUM5RCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQztnQkFDM0IsaUJBQWUsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUM1RSxJQUFJLGlCQUFlLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDO29CQUNwRSxpQkFBZSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUN2RCxDQUFDO1lBQ0YsQ0FBQztZQUNELDJDQUEyQztZQUMzQyxJQUFJLENBQUMsVUFBVSxHQUFHLFNBQVMsQ0FBQztZQUM1QixJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDL0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLG1EQUFtRDtRQUNuRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDbkMsSUFBSSxPQUFPLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ2pGLElBQUksQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDO1FBQzNCLENBQUM7UUFFRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLENBQUM7UUFFOUIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksZUFBZSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFFTyxVQUFVLENBQUMsQ0FBa0IsRUFBRSxDQUFrQjtRQUN4RCxJQUFJLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQzFELE9BQU8sQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ3RCLENBQUM7UUFDRCxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxZQUFZLEdBQUcsRUFBRSxDQUFDO1lBQzFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUN0QyxDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDOztBQTlSVyxlQUFlO0lBNkN6QixXQUFBLFlBQVksQ0FBQTtJQUNaLFdBQUEsY0FBYyxDQUFBO0lBQ2QsV0FBQSxvQkFBb0IsQ0FBQTtHQS9DVixlQUFlLENBK1IzQjs7QUFFRCxNQUFNLE9BQU8sZUFBZ0IsU0FBUSxVQUFVO0lBTTlDLFlBQ1UsS0FBaUI7UUFDdkIsS0FBSyxFQUFFLENBQUM7UUFERixVQUFLLEdBQUwsS0FBSyxDQUFZO1FBTm5CLG1CQUFjLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFDcEQsa0JBQWEsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQztRQUUzQyxnQkFBVyxHQUFHLEtBQUssQ0FBQztJQUlmLENBQUM7SUFFZCxLQUFLLENBQUMsT0FBTztRQUNaLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO0lBQ3pCLENBQUM7SUFFRCxVQUFVO1FBQ1QsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQ3pCLENBQUM7SUFFRCxVQUFVO1FBQ1QsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQztJQUMvQixDQUFDO0NBQ0Q7QUFHRCxJQUFVLGFBQWEsQ0EyQnRCO0FBM0JELFdBQVUsYUFBYTtJQUV0QixNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsZ0JBQWdCLENBQUM7SUFFeEMsU0FBZ0IsZUFBZTtRQUM5QixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQztRQUMvQyxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFFBQVEsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFIZSw2QkFBZSxrQkFHOUIsQ0FBQTtJQUVELFNBQWdCLEtBQUssQ0FBQyxRQUFhO1FBQ2xDLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUNoQyxPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsTUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDaEQsTUFBTSxTQUFTLEdBQUcsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0IsSUFBSSxPQUFPLFNBQVMsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUNuQyxPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ25DLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDbkIsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQWpCZSxtQkFBSyxRQWlCcEIsQ0FBQTtBQUNGLENBQUMsRUEzQlMsYUFBYSxLQUFiLGFBQWEsUUEyQnRCO0FBUUQsTUFBTSxPQUFPLHlCQUF5QjtJQUNyQyxZQUFZLENBQUMsS0FBa0I7UUFDOUIsT0FBTyxLQUFLLFlBQVksZUFBZSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDO0lBQ3BFLENBQUM7SUFFRCxTQUFTLENBQUMsS0FBa0I7UUFDM0IsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUMvQixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsTUFBTSxHQUFHLEdBQStCO1lBQ3ZDLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTztZQUN0QixlQUFlLEVBQUUsS0FBSyxDQUFDLGVBQWU7WUFDdEMsUUFBUSxFQUFFLEtBQUssQ0FBQyxRQUFRO1NBRXhCLENBQUM7UUFDRixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQUVELFdBQVcsQ0FBQyxvQkFBMkMsRUFBRSxnQkFBd0I7UUFDaEYsSUFBSSxDQUFDO1lBQ0osaURBQWlEO1lBQ2pELE1BQU0sTUFBTSxHQUE0RSxJQUFJLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFFckgsdURBQXVEO1lBQ3ZELElBQUksTUFBTSxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUM1QixNQUFNLGVBQWUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQztnQkFDM0QsT0FBTyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsZUFBZSxFQUFFLGVBQWUsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDOUYsQ0FBQztZQUVELHdFQUF3RTtZQUN4RSxJQUFJLFFBQVEsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMzQyxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssT0FBTyxDQUFDLGdCQUFnQixJQUFJLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDdEUsUUFBUSxHQUFHLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDN0QsQ0FBQztZQUVELE9BQU8sb0JBQW9CLENBQUMsY0FBYyxDQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZGLENBQUM7UUFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1lBQ2QsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztJQUNGLENBQUM7Q0FDRDtBQUVELE1BQU0sQ0FBQyxLQUFLLFVBQVUsbUNBQW1DLENBQUMsY0FBbUMsRUFBRSxhQUE2QixFQUFFLE9BQWlEO0lBQzlLLE1BQU0sYUFBYSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMseURBQXlELEVBQUUseURBQXlELENBQUMsQ0FBQztJQUN6SixNQUFNLFlBQVksR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLHNDQUFzQyxFQUFFLGlCQUFpQixDQUFDLENBQUM7SUFDN0YsTUFBTSxNQUFNLEdBQUcsT0FBTyxFQUFFLGVBQWUsSUFBSSxhQUFhLENBQUM7SUFDekQsTUFBTSxLQUFLLEdBQUcsT0FBTyxFQUFFLGFBQWEsSUFBSSxZQUFZLENBQUM7SUFFckQsTUFBTSxZQUFZLEdBQUcsY0FBYyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUNsRCxNQUFNLGNBQWMsR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSw0Q0FBb0MsQ0FBQyxDQUFDO0lBRTNHLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxNQUFNLGFBQWEsQ0FBQyxNQUFNLENBQUM7UUFDN0MsS0FBSztRQUNMLE9BQU8sRUFBRSxNQUFNLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsa0RBQWtELEVBQUUsaURBQWlELEVBQUUsY0FBYyxDQUFDLE1BQU0sQ0FBQztRQUNsSyxJQUFJLEVBQUUsTUFBTTtRQUNaLFlBQVksRUFBRSxJQUFJO1FBQ2xCLE9BQU8sRUFBRTtZQUNSO2dCQUNDLEtBQUssRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLDRDQUE0QyxFQUFFLGlCQUFpQixDQUFDO2dCQUNwRixHQUFHLEVBQUUsS0FBSyxJQUFJLEVBQUU7b0JBQ2YsTUFBTSxjQUFjLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQzlCLE9BQU8sSUFBSSxDQUFDO2dCQUNiLENBQUM7YUFDRDtZQUNEO2dCQUNDLEtBQUssRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLDZDQUE2QyxFQUFFLGlCQUFpQixDQUFDO2dCQUNyRixHQUFHLEVBQUUsS0FBSyxJQUFJLEVBQUU7b0JBQ2YsTUFBTSxjQUFjLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQzlCLE9BQU8sSUFBSSxDQUFDO2dCQUNiLENBQUM7YUFDRDtTQUNEO0tBQ0QsQ0FBQyxDQUFDO0lBRUgsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDeEIsQ0FBQztBQUVELE1BQU0sVUFBVSx5Q0FBeUMsQ0FBQyxjQUFtQztJQUM1RixNQUFNLFlBQVksR0FBRyxjQUFjLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ2xELE1BQU0sZ0JBQWdCLEdBQUcsWUFBWSxDQUFDLE1BQU0sQ0FBQztJQUU3QyxJQUFJLGdCQUFnQixFQUFFLENBQUM7UUFDdEIsTUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsNENBQW9DLENBQUMsQ0FBQztRQUMzRyxPQUFPLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDO0lBQ2hDLENBQUM7SUFFRCxPQUFPLEtBQUssQ0FBQztBQUNkLENBQUMifQ==