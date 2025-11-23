/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DeferredPromise, isThenable } from '../../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { autorun, observableValue } from '../../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { isObject } from '../../../../../base/common/types.js';
import { URI } from '../../../../../base/common/uri.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { EditorContextKeys } from '../../../../../editor/common/editorContextKeys.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { AbstractGotoSymbolQuickAccessProvider } from '../../../../../editor/contrib/quickAccess/browser/gotoSymbolQuickAccess.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IListService } from '../../../../../platform/list/browser/listService.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { resolveCommandsContext } from '../../../../browser/parts/editor/editorCommandsContext.js';
import { ResourceContextKey } from '../../../../common/contextkeys.js';
import { EditorResourceAccessor, isEditorCommandsContext, SideBySideEditor } from '../../../../common/editor.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { ExplorerFolderContext } from '../../../files/common/files.js';
import { CTX_INLINE_CHAT_V2_ENABLED } from '../../../inlineChat/common/inlineChat.js';
import { AnythingQuickAccessProvider } from '../../../search/browser/anythingQuickAccess.js';
import { isSearchTreeFileMatch, isSearchTreeMatch } from '../../../search/browser/searchTreeModel/searchTreeCommon.js';
import { SymbolsQuickAccessProvider } from '../../../search/browser/symbolsQuickAccess.js';
import { SearchContext } from '../../../search/common/constants.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { ChatAgentLocation, isSupportedChatFileScheme } from '../../common/constants.js';
import { IChatWidgetService, IQuickChatService } from '../chat.js';
import { IChatContextPickService, isChatContextPickerPickItem } from '../chatContextPickService.js';
import { isQuickChat } from '../chatWidget.js';
import { resizeImage } from '../imageUtils.js';
import { registerPromptActions } from '../promptSyntax/promptFileActions.js';
import { CHAT_CATEGORY } from './chatActions.js';
export function registerChatContextActions() {
    registerAction2(AttachContextAction);
    registerAction2(AttachFileToChatAction);
    registerAction2(AttachFolderToChatAction);
    registerAction2(AttachSelectionToChatAction);
    registerAction2(AttachSearchResultAction);
    registerPromptActions();
}
async function withChatView(accessor) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const lastFocusedWidget = chatWidgetService.lastFocusedWidget;
    if (!lastFocusedWidget || lastFocusedWidget.location === ChatAgentLocation.Chat) {
        return chatWidgetService.revealWidget(); // only show chat view if we either have no chat view or its located in view container
    }
    return lastFocusedWidget;
}
class AttachResourceAction extends Action2 {
    async run(accessor, ...args) {
        const instaService = accessor.get(IInstantiationService);
        const widget = await instaService.invokeFunction(withChatView);
        if (!widget) {
            return;
        }
        return instaService.invokeFunction(this.runWithWidget.bind(this), widget, ...args);
    }
    _getResources(accessor, ...args) {
        const editorService = accessor.get(IEditorService);
        const contexts = isEditorCommandsContext(args[1]) ? this._getEditorResources(accessor, args) : Array.isArray(args[1]) ? args[1] : [args[0]];
        const files = [];
        for (const context of contexts) {
            let uri;
            if (URI.isUri(context)) {
                uri = context;
            }
            else if (isSearchTreeFileMatch(context)) {
                uri = context.resource;
            }
            else if (isSearchTreeMatch(context)) {
                uri = context.parent().resource;
            }
            else if (!context && editorService.activeTextEditorControl) {
                uri = EditorResourceAccessor.getCanonicalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
            }
            if (uri && [Schemas.file, Schemas.vscodeRemote, Schemas.untitled].includes(uri.scheme)) {
                files.push(uri);
            }
        }
        return files;
    }
    _getEditorResources(accessor, ...args) {
        const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
        return resolvedContext.groupedEditors
            .flatMap(groupedEditor => groupedEditor.editors)
            .map(editor => EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY }))
            .filter(uri => uri !== undefined);
    }
}
class AttachFileToChatAction extends AttachResourceAction {
    static { this.ID = 'workbench.action.chat.attachFile'; }
    constructor() {
        super({
            id: AttachFileToChatAction.ID,
            title: localize2('workbench.action.chat.attachFile.label', "Add File to Chat"),
            category: CHAT_CATEGORY,
            precondition: ChatContextKeys.enabled,
            f1: true,
            menu: [{
                    id: MenuId.SearchContext,
                    group: 'z_chat',
                    order: 1,
                    when: ContextKeyExpr.and(ChatContextKeys.enabled, SearchContext.FileMatchOrMatchFocusKey, SearchContext.SearchResultHeaderFocused.negate()),
                }, {
                    id: MenuId.ExplorerContext,
                    group: '5_chat',
                    order: 1,
                    when: ContextKeyExpr.and(ChatContextKeys.enabled, ExplorerFolderContext.negate(), ContextKeyExpr.or(ResourceContextKey.Scheme.isEqualTo(Schemas.file), ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeRemote))),
                }, {
                    id: MenuId.EditorTitleContext,
                    group: '2_chat',
                    order: 1,
                    when: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.or(ResourceContextKey.Scheme.isEqualTo(Schemas.file), ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeRemote))),
                }, {
                    id: MenuId.EditorContext,
                    group: '1_chat',
                    order: 2,
                    when: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.or(ResourceContextKey.Scheme.isEqualTo(Schemas.file), ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeRemote), ResourceContextKey.Scheme.isEqualTo(Schemas.untitled), ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeUserData)))
                }]
        });
    }
    async runWithWidget(accessor, widget, ...args) {
        const files = this._getResources(accessor, ...args);
        if (!files.length) {
            return;
        }
        if (widget) {
            widget.focusInput();
            for (const file of files) {
                widget.attachmentModel.addFile(file);
            }
        }
    }
}
class AttachFolderToChatAction extends AttachResourceAction {
    static { this.ID = 'workbench.action.chat.attachFolder'; }
    constructor() {
        super({
            id: AttachFolderToChatAction.ID,
            title: localize2('workbench.action.chat.attachFolder.label', "Add Folder to Chat"),
            category: CHAT_CATEGORY,
            f1: false,
            menu: {
                id: MenuId.ExplorerContext,
                group: '5_chat',
                order: 1,
                when: ContextKeyExpr.and(ChatContextKeys.enabled, ExplorerFolderContext, ContextKeyExpr.or(ResourceContextKey.Scheme.isEqualTo(Schemas.file), ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeRemote)))
            }
        });
    }
    async runWithWidget(accessor, widget, ...args) {
        const folders = this._getResources(accessor, ...args);
        if (!folders.length) {
            return;
        }
        if (widget) {
            widget.focusInput();
            for (const folder of folders) {
                widget.attachmentModel.addFolder(folder);
            }
        }
    }
}
class AttachSelectionToChatAction extends Action2 {
    static { this.ID = 'workbench.action.chat.attachSelection'; }
    constructor() {
        super({
            id: AttachSelectionToChatAction.ID,
            title: localize2('workbench.action.chat.attachSelection.label', "Add Selection to Chat"),
            category: CHAT_CATEGORY,
            f1: true,
            precondition: ChatContextKeys.enabled,
            menu: {
                id: MenuId.EditorContext,
                group: '1_chat',
                order: 1,
                when: ContextKeyExpr.and(ChatContextKeys.enabled, EditorContextKeys.hasNonEmptySelection, ContextKeyExpr.or(ResourceContextKey.Scheme.isEqualTo(Schemas.file), ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeRemote), ResourceContextKey.Scheme.isEqualTo(Schemas.untitled), ResourceContextKey.Scheme.isEqualTo(Schemas.vscodeUserData)))
            }
        });
    }
    async run(accessor, ...args) {
        const editorService = accessor.get(IEditorService);
        const widget = await accessor.get(IInstantiationService).invokeFunction(withChatView);
        if (!widget) {
            return;
        }
        const [_, matches] = args;
        // If we have search matches, it means this is coming from the search widget
        if (matches && matches.length > 0) {
            const uris = new Map();
            for (const match of matches) {
                if (isSearchTreeFileMatch(match)) {
                    uris.set(match.resource, undefined);
                }
                else {
                    const context = { uri: match._parent.resource, range: match._range };
                    const range = uris.get(context.uri);
                    if (!range ||
                        range.startLineNumber !== context.range.startLineNumber && range.endLineNumber !== context.range.endLineNumber) {
                        uris.set(context.uri, context.range);
                        widget.attachmentModel.addFile(context.uri, context.range);
                    }
                }
            }
            // Add the root files for all of the ones that didn't have a match
            for (const uri of uris) {
                const [resource, range] = uri;
                if (!range) {
                    widget.attachmentModel.addFile(resource);
                }
            }
        }
        else {
            const activeEditor = editorService.activeTextEditorControl;
            const activeUri = EditorResourceAccessor.getCanonicalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
            if (activeEditor && activeUri && [Schemas.file, Schemas.vscodeRemote, Schemas.untitled].includes(activeUri.scheme)) {
                const selection = activeEditor.getSelection();
                if (selection) {
                    widget.focusInput();
                    const range = selection.isEmpty() ? new Range(selection.startLineNumber, 1, selection.startLineNumber + 1, 1) : selection;
                    widget.attachmentModel.addFile(activeUri, range);
                }
            }
        }
    }
}
export class AttachSearchResultAction extends Action2 {
    static { this.Name = 'searchResults'; }
    constructor() {
        super({
            id: 'workbench.action.chat.insertSearchResults',
            title: localize2('chat.insertSearchResults', 'Add Search Results to Chat'),
            category: CHAT_CATEGORY,
            f1: false,
            menu: [{
                    id: MenuId.SearchContext,
                    group: 'z_chat',
                    order: 3,
                    when: ContextKeyExpr.and(ChatContextKeys.enabled, SearchContext.SearchResultHeaderFocused),
                }]
        });
    }
    async run(accessor) {
        const logService = accessor.get(ILogService);
        const widget = await accessor.get(IInstantiationService).invokeFunction(withChatView);
        if (!widget) {
            logService.trace('InsertSearchResultAction: no chat view available');
            return;
        }
        const editor = widget.inputEditor;
        const originalRange = editor.getSelection() ?? editor.getModel()?.getFullModelRange().collapseToEnd();
        if (!originalRange) {
            logService.trace('InsertSearchResultAction: no selection');
            return;
        }
        let insertText = `#${AttachSearchResultAction.Name}`;
        const varRange = new Range(originalRange.startLineNumber, originalRange.startColumn, originalRange.endLineNumber, originalRange.startLineNumber + insertText.length);
        // check character before the start of the range. If it's not a space, add a space
        const model = editor.getModel();
        if (model && model.getValueInRange(new Range(originalRange.startLineNumber, originalRange.startColumn - 1, originalRange.startLineNumber, originalRange.startColumn)) !== ' ') {
            insertText = ' ' + insertText;
        }
        const success = editor.executeEdits('chatInsertSearch', [{ range: varRange, text: insertText + ' ' }]);
        if (!success) {
            logService.trace(`InsertSearchResultAction: failed to insert "${insertText}"`);
            return;
        }
    }
}
function isIContextPickItemItem(obj) {
    return (isObject(obj)
        && typeof obj.kind === 'string'
        && obj.kind === 'contextPick');
}
function isIGotoSymbolQuickPickItem(obj) {
    return (isObject(obj)
        && typeof obj.symbolName === 'string'
        && !!obj.uri
        && !!obj.range);
}
function isIQuickPickItemWithResource(obj) {
    return (isObject(obj)
        && URI.isUri(obj.resource));
}
export class AttachContextAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.chat.attachContext',
            title: localize2('workbench.action.chat.attachContext.label.2', "Add Context..."),
            icon: Codicon.attach,
            category: CHAT_CATEGORY,
            keybinding: {
                when: ContextKeyExpr.and(ChatContextKeys.inChatInput, ChatContextKeys.location.isEqualTo(ChatAgentLocation.Chat)),
                primary: 2048 /* KeyMod.CtrlCmd */ | 90 /* KeyCode.Slash */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            },
            menu: {
                when: ContextKeyExpr.and(ContextKeyExpr.or(ChatContextKeys.location.isEqualTo(ChatAgentLocation.Chat), ContextKeyExpr.and(ChatContextKeys.location.isEqualTo(ChatAgentLocation.EditorInline), CTX_INLINE_CHAT_V2_ENABLED)), ContextKeyExpr.or(ChatContextKeys.lockedToCodingAgent.negate(), ChatContextKeys.agentSupportsAttachments)),
                id: MenuId.ChatInputAttachmentToolbar,
                group: 'navigation',
                order: 3
            },
        });
    }
    async run(accessor, ...args) {
        const instantiationService = accessor.get(IInstantiationService);
        const widgetService = accessor.get(IChatWidgetService);
        const contextKeyService = accessor.get(IContextKeyService);
        const keybindingService = accessor.get(IKeybindingService);
        const contextPickService = accessor.get(IChatContextPickService);
        const context = args[0];
        const widget = context?.widget ?? widgetService.lastFocusedWidget;
        if (!widget) {
            return;
        }
        const quickPickItems = [];
        for (const item of contextPickService.items) {
            if (item.isEnabled && !await item.isEnabled(widget)) {
                continue;
            }
            quickPickItems.push({
                kind: 'contextPick',
                item,
                label: item.label,
                iconClass: ThemeIcon.asClassName(item.icon),
                keybinding: item.commandId ? keybindingService.lookupKeybinding(item.commandId, contextKeyService) : undefined,
            });
        }
        instantiationService.invokeFunction(this._show.bind(this), widget, quickPickItems, context?.placeholder);
    }
    _show(accessor, widget, additionPicks, placeholder) {
        const quickInputService = accessor.get(IQuickInputService);
        const quickChatService = accessor.get(IQuickChatService);
        const instantiationService = accessor.get(IInstantiationService);
        const commandService = accessor.get(ICommandService);
        const providerOptions = {
            filter: (pick) => {
                if (isIQuickPickItemWithResource(pick) && pick.resource) {
                    return instantiationService.invokeFunction(accessor => isSupportedChatFileScheme(accessor, pick.resource.scheme));
                }
                return true;
            },
            additionPicks,
            handleAccept: async (item, isBackgroundAccept) => {
                if (isIContextPickItemItem(item)) {
                    let isDone = true;
                    if (item.item.type === 'valuePick') {
                        this._handleContextPick(item.item, widget);
                    }
                    else if (item.item.type === 'pickerPick') {
                        isDone = await this._handleContextPickerItem(quickInputService, commandService, item.item, widget);
                    }
                    if (!isDone) {
                        // restart picker when sub-picker didn't return anything
                        instantiationService.invokeFunction(this._show.bind(this), widget, additionPicks, placeholder);
                        return;
                    }
                }
                else {
                    instantiationService.invokeFunction(this._handleQPPick.bind(this), widget, isBackgroundAccept, item);
                }
                if (isQuickChat(widget)) {
                    quickChatService.open();
                }
            }
        };
        quickInputService.quickAccess.show('', {
            enabledProviderPrefixes: [
                AnythingQuickAccessProvider.PREFIX,
                SymbolsQuickAccessProvider.PREFIX,
                AbstractGotoSymbolQuickAccessProvider.PREFIX
            ],
            placeholder: placeholder ?? localize('chatContext.attach.placeholder', 'Search attachments'),
            providerOptions,
        });
    }
    async _handleQPPick(accessor, widget, isInBackground, pick) {
        const fileService = accessor.get(IFileService);
        const textModelService = accessor.get(ITextModelService);
        const toAttach = [];
        if (isIQuickPickItemWithResource(pick) && pick.resource) {
            if (/\.(png|jpg|jpeg|bmp|gif|tiff)$/i.test(pick.resource.path)) {
                // checks if the file is an image
                if (URI.isUri(pick.resource)) {
                    // read the image and attach a new file context.
                    const readFile = await fileService.readFile(pick.resource);
                    const resizedImage = await resizeImage(readFile.value.buffer);
                    toAttach.push({
                        id: pick.resource.toString(),
                        name: pick.label,
                        fullName: pick.label,
                        value: resizedImage,
                        kind: 'image',
                        references: [{ reference: pick.resource, kind: 'reference' }]
                    });
                }
            }
            else {
                let omittedState = 0 /* OmittedState.NotOmitted */;
                try {
                    const createdModel = await textModelService.createModelReference(pick.resource);
                    createdModel.dispose();
                }
                catch {
                    omittedState = 2 /* OmittedState.Full */;
                }
                toAttach.push({
                    kind: 'file',
                    id: pick.resource.toString(),
                    value: pick.resource,
                    name: pick.label,
                    omittedState
                });
            }
        }
        else if (isIGotoSymbolQuickPickItem(pick) && pick.uri && pick.range) {
            toAttach.push({
                kind: 'generic',
                id: JSON.stringify({ uri: pick.uri, range: pick.range.decoration }),
                value: { uri: pick.uri, range: pick.range.decoration },
                fullName: pick.label,
                name: pick.symbolName,
            });
        }
        widget.attachmentModel.addContext(...toAttach);
        if (!isInBackground) {
            // Set focus back into the input once the user is done attaching items
            // so that the user can start typing their message
            widget.focusInput();
        }
    }
    async _handleContextPick(item, widget) {
        const value = await item.asAttachment(widget);
        if (Array.isArray(value)) {
            widget.attachmentModel.addContext(...value);
        }
        else if (value) {
            widget.attachmentModel.addContext(value);
        }
    }
    async _handleContextPickerItem(quickInputService, commandService, item, widget) {
        const pickerConfig = item.asPicker(widget);
        const store = new DisposableStore();
        const goBackItem = {
            label: localize('goBack', 'Go back ↩'),
            alwaysShow: true
        };
        const configureItem = pickerConfig.configure ? {
            label: pickerConfig.configure.label,
            commandId: pickerConfig.configure.commandId,
            alwaysShow: true
        } : undefined;
        const extraPicks = [{ type: 'separator' }];
        if (configureItem) {
            extraPicks.push(configureItem);
        }
        extraPicks.push(goBackItem);
        const qp = store.add(quickInputService.createQuickPick({ useSeparators: true }));
        const cts = new CancellationTokenSource();
        store.add(qp.onDidHide(() => cts.cancel()));
        store.add(toDisposable(() => cts.dispose(true)));
        qp.placeholder = pickerConfig.placeholder;
        qp.matchOnDescription = true;
        qp.matchOnDetail = true;
        // qp.ignoreFocusOut = true;
        qp.canAcceptInBackground = true;
        qp.busy = true;
        qp.show();
        if (isThenable(pickerConfig.picks)) {
            const items = await (pickerConfig.picks.then(value => {
                return [].concat(value, extraPicks);
            }));
            qp.items = items;
            qp.busy = false;
        }
        else {
            const query = observableValue('attachContext.query', qp.value);
            store.add(qp.onDidChangeValue(() => query.set(qp.value, undefined)));
            const picksObservable = pickerConfig.picks(query, cts.token);
            store.add(autorun(reader => {
                const { busy, picks } = picksObservable.read(reader);
                qp.items = [].concat(picks, extraPicks);
                qp.busy = busy;
            }));
        }
        if (cts.token.isCancellationRequested) {
            pickerConfig.dispose?.();
            return true; // picker got hidden already
        }
        const defer = new DeferredPromise();
        const addPromises = [];
        store.add(qp.onDidAccept(async (e) => {
            const noop = 'noop';
            const [selected] = qp.selectedItems;
            if (isChatContextPickerPickItem(selected)) {
                const attachment = selected.asAttachment();
                if (!attachment || attachment === noop) {
                    return;
                }
                if (isThenable(attachment)) {
                    addPromises.push(attachment.then(v => {
                        if (v !== noop) {
                            widget.attachmentModel.addContext(v);
                        }
                    }));
                }
                else {
                    widget.attachmentModel.addContext(attachment);
                }
            }
            if (selected === goBackItem) {
                if (pickerConfig.goBack?.()) {
                    // Custom goBack handled the navigation, stay in the picker
                    return; // Don't complete, keep picker open
                }
                // Default behavior: go back to main picker
                defer.complete(false);
            }
            if (selected === configureItem) {
                defer.complete(true);
                commandService.executeCommand(configureItem.commandId);
            }
            if (!e.inBackground) {
                defer.complete(true);
            }
        }));
        store.add(qp.onDidHide(() => {
            defer.complete(true);
            pickerConfig.dispose?.();
        }));
        try {
            const result = await defer.p;
            qp.busy = true; // if still visible
            await Promise.all(addPromises);
            return result;
        }
        finally {
            store.dispose();
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdENvbnRleHRBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9hY3Rpb25zL2NoYXRDb250ZXh0QWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLFVBQVUsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUVqRSxPQUFPLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDL0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRXhELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUN0RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUM3RixPQUFPLEVBQUUscUNBQXFDLEVBQTRCLE1BQU0sNEVBQTRFLENBQUM7QUFDN0osT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxlQUFlLEVB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