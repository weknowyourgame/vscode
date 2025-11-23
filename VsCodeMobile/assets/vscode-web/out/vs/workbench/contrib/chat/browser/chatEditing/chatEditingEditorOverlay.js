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
import '../media/chatEditingEditorOverlay.css';
import { combinedDisposable, Disposable, DisposableMap, DisposableStore, MutableDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun, derived, derivedOpts, observableFromEvent, observableFromEventOpts, observableSignalFromEvent, observableValue, transaction } from '../../../../../base/common/observable.js';
import { MenuWorkbenchToolBar } from '../../../../../platform/actions/browser/toolbar.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IChatEditingService } from '../../common/chatEditingService.js';
import { MenuId } from '../../../../../platform/actions/common/actions.js';
import { ActionViewItem } from '../../../../../base/browser/ui/actionbar/actionViewItems.js';
import { $, addDisposableGenericMouseMoveListener, append } from '../../../../../base/browser/dom.js';
import { assertType } from '../../../../../base/common/types.js';
import { localize } from '../../../../../nls.js';
import { AcceptAction, navigationBearingFakeActionId, RejectAction } from './chatEditingEditorActions.js';
import { IChatService } from '../../common/chatService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { EditorGroupView } from '../../../../browser/parts/editor/editorGroupView.js';
import { Event } from '../../../../../base/common/event.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { EditorResourceAccessor, SideBySideEditor } from '../../../../common/editor.js';
import { IInlineChatSessionService } from '../../../inlineChat/browser/inlineChatSessionService.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { ObservableEditorSession } from './chatEditingEditorContextKeys.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { renderIcon } from '../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import * as arrays from '../../../../../base/common/arrays.js';
import { renderAsPlaintext } from '../../../../../base/browser/markdownRenderer.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
let ChatEditorOverlayWidget = class ChatEditorOverlayWidget extends Disposable {
    constructor(_editor, _chatService, _keybindingService, _instaService) {
        super();
        this._editor = _editor;
        this._chatService = _chatService;
        this._keybindingService = _keybindingService;
        this._instaService = _instaService;
        this._showStore = this._store.add(new DisposableStore());
        this._session = observableValue(this, undefined);
        this._entry = observableValue(this, undefined);
        this._navigationBearings = observableValue(this, { changeCount: -1, activeIdx: -1, entriesCount: -1 });
        this._domNode = document.createElement('div');
        this._domNode.classList.add('chat-editor-overlay-widget');
        this._isBusy = derived(r => {
            const entry = this._entry.read(r);
            const session = this._session.read(r);
            return entry?.waitsForLastEdits.read(r) ?? !session?.isGlobalEditingSession; // aka inline chat
        });
        const requestMessage = derived(r => {
            const session = this._session.read(r);
            const chatModel = session?.chatSessionResource && this._chatService.getSession(session?.chatSessionResource);
            if (!session || !chatModel) {
                return undefined;
            }
            const response = this._entry.read(r)?.lastModifyingResponse.read(r);
            if (!response) {
                return { message: localize('working', "Working...") };
            }
            const lastPart = observableFromEventOpts({ equalsFn: arrays.equals }, response.onDidChange, () => response.response.value)
                .read(r)
                .filter(part => part.kind === 'progressMessage' || part.kind === 'toolInvocation')
                .at(-1);
            if (lastPart?.kind === 'toolInvocation') {
                return { message: lastPart.invocationMessage };
            }
            else if (lastPart?.kind === 'progressMessage') {
                return { message: lastPart.content };
            }
            else {
                return { message: localize('working', "Working...") };
            }
        });
        const progressNode = document.createElement('div');
        progressNode.classList.add('chat-editor-overlay-progress');
        append(progressNode, renderIcon(ThemeIcon.modify(Codicon.loading, 'spin')));
        const textProgress = append(progressNode, $('span.progress-message'));
        this._domNode.appendChild(progressNode);
        this._store.add(autorun(r => {
            const value = requestMessage.read(r);
            const busy = this._isBusy.read(r);
            this._domNode.classList.toggle('busy', busy);
            if (!busy || !value || this._session.read(r)?.isGlobalEditingSession) {
                textProgress.innerText = '';
            }
            else if (value) {
                textProgress.innerText = renderAsPlaintext(value.message);
            }
        }));
        this._toolbarNode = document.createElement('div');
        this._toolbarNode.classList.add('chat-editor-overlay-toolbar');
    }
    dispose() {
        this.hide();
        super.dispose();
    }
    getDomNode() {
        return this._domNode;
    }
    show(session, entry, indicies) {
        this._showStore.clear();
        transaction(tx => {
            this._session.set(session, tx);
            this._entry.set(entry, tx);
        });
        this._showStore.add(autorun(r => {
            const entryIndex = indicies.entryIndex.read(r);
            const changeIndex = indicies.changeIndex.read(r);
            const entries = session.entries.read(r);
            let activeIdx = entryIndex !== undefined && changeIndex !== undefined
                ? changeIndex
                : -1;
            let totalChangesCount = 0;
            for (let i = 0; i < entries.length; i++) {
                const changesCount = entries[i].changesCount.read(r);
                totalChangesCount += changesCount;
                if (entryIndex !== undefined && i < entryIndex) {
                    activeIdx += changesCount;
                }
            }
            this._navigationBearings.set({ changeCount: totalChangesCount, activeIdx, entriesCount: entries.length }, undefined);
        }));
        this._domNode.appendChild(this._toolbarNode);
        this._showStore.add(toDisposable(() => this._toolbarNode.remove()));
        this._showStore.add(this._instaService.createInstance(MenuWorkbenchToolBar, this._toolbarNode, MenuId.ChatEditingEditorContent, {
            telemetrySource: 'chatEditor.overlayToolbar',
            hiddenItemStrategy: 0 /* HiddenItemStrategy.Ignore */,
            toolbarOptions: {
                primaryGroup: () => true,
                useSeparatorsInPrimaryActions: true
            },
            menuOptions: { renderShortTitle: true },
            actionViewItemProvider: (action, options) => {
                const that = this;
                if (action.id === navigationBearingFakeActionId) {
                    return new class extends ActionViewItem {
                        constructor() {
                            super(undefined, action, { ...options, icon: false, label: true, keybindingNotRenderedWithLabel: true });
                        }
                        render(container) {
                            super.render(container);
                            container.classList.add('label-item');
                            this._store.add(autorun(r => {
                                assertType(this.label);
                                const { changeCount, activeIdx } = that._navigationBearings.read(r);
                                if (changeCount > 0) {
                                    const n = activeIdx === -1 ? '1' : `${activeIdx + 1}`;
                                    this.label.innerText = localize('nOfM', "{0} of {1}", n, changeCount);
                                }
                                else {
                                    // allow-any-unicode-next-line
                                    this.label.innerText = localize('0Of0', "—");
                                }
                                this.updateTooltip();
                            }));
                        }
                        getTooltip() {
                            const { changeCount, entriesCount } = that._navigationBearings.get();
                            if (changeCount === -1 || entriesCount === -1) {
                                return undefined;
                            }
                            let result;
                            if (changeCount === 1 && entriesCount === 1) {
                                result = localize('tooltip_11', "1 change in 1 file");
                            }
                            else if (changeCount === 1) {
                                result = localize('tooltip_1n', "1 change in {0} files", entriesCount);
                            }
                            else if (entriesCount === 1) {
                                result = localize('tooltip_n1', "{0} changes in 1 file", changeCount);
                            }
                            else {
                                result = localize('tooltip_nm', "{0} changes in {1} files", changeCount, entriesCount);
                            }
                            if (!that._isBusy.get()) {
                                return result;
                            }
                            return localize('tooltip_busy', "{0} - Working...", result);
                        }
                    };
                }
                if (action.id === AcceptAction.ID || action.id === RejectAction.ID) {
                    return new class extends ActionViewItem {
                        constructor() {
                            super(undefined, action, { ...options, icon: false, label: true, keybindingNotRenderedWithLabel: true });
                            this._reveal = this._store.add(new MutableDisposable());
                        }
                        render(container) {
                            super.render(container);
                            if (action.id === AcceptAction.ID) {
                                const listener = this._store.add(new MutableDisposable());
                                this._store.add(autorun(r => {
                                    assertType(this.label);
                                    assertType(this.element);
                                    const ctrl = that._entry.read(r)?.autoAcceptController.read(r);
                                    if (ctrl) {
                                        const r = -100 * (ctrl.remaining / ctrl.total);
                                        this.element.style.setProperty('--vscode-action-item-auto-timeout', `${r}%`);
                                        this.element.classList.toggle('auto', true);
                                        listener.value = addDisposableGenericMouseMoveListener(this.element, () => ctrl.cancel());
                                    }
                                    else {
                                        this.element.classList.toggle('auto', false);
                                        listener.clear();
                                    }
                                }));
                            }
                        }
                        set actionRunner(actionRunner) {
                            super.actionRunner = actionRunner;
                            this._reveal.value = actionRunner.onWillRun(_e => {
                                that._editor.focus();
                            });
                        }
                        get actionRunner() {
                            return super.actionRunner;
                        }
                        getTooltip() {
                            const value = super.getTooltip();
                            if (!value) {
                                return value;
                            }
                            const kb = that._keybindingService.lookupKeybinding(this.action.id);
                            if (!kb) {
                                return value;
                            }
                            return localize('tooltip', "{0} ({1})", value, kb.getLabel());
                        }
                    };
                }
                return undefined;
            }
        }));
    }
    hide() {
        transaction(tx => {
            this._session.set(undefined, tx);
            this._entry.set(undefined, tx);
            this._navigationBearings.set({ changeCount: -1, activeIdx: -1, entriesCount: -1 }, tx);
        });
        this._showStore.clear();
    }
};
ChatEditorOverlayWidget = __decorate([
    __param(1, IChatService),
    __param(2, IKeybindingService),
    __param(3, IInstantiationService)
], ChatEditorOverlayWidget);
let ChatEditingOverlayController = class ChatEditingOverlayController {
    constructor(container, group, instaService, chatService, chatEditingService, inlineChatService) {
        this._store = new DisposableStore();
        this._domNode = document.createElement('div');
        this._domNode.classList.add('chat-editing-editor-overlay');
        this._domNode.style.position = 'absolute';
        this._domNode.style.bottom = `24px`;
        this._domNode.style.right = `24px`;
        this._domNode.style.zIndex = `100`;
        const widget = instaService.createInstance(ChatEditorOverlayWidget, group);
        this._domNode.appendChild(widget.getDomNode());
        this._store.add(toDisposable(() => this._domNode.remove()));
        this._store.add(widget);
        const show = () => {
            if (!container.contains(this._domNode)) {
                container.appendChild(this._domNode);
            }
        };
        const hide = () => {
            if (container.contains(this._domNode)) {
                widget.hide();
                this._domNode.remove();
            }
        };
        const activeEditorSignal = observableSignalFromEvent(this, Event.any(group.onDidActiveEditorChange, group.onDidModelChange));
        const activeUriObs = derivedOpts({ equalsFn: isEqual }, r => {
            activeEditorSignal.read(r); // signal
            const editor = group.activeEditorPane;
            const uri = EditorResourceAccessor.getOriginalUri(editor?.input, { supportSideBySide: SideBySideEditor.PRIMARY });
            return uri;
        });
        const sessionAndEntry = derived(r => {
            activeEditorSignal.read(r); // signal to ensure activeEditor and activeEditorPane don't go out of sync
            const uri = activeUriObs.read(r);
            if (!uri) {
                return undefined;
            }
            return new ObservableEditorSession(uri, chatEditingService, inlineChatService).value.read(r);
        });
        const isInProgress = derived(r => {
            const session = sessionAndEntry.read(r)?.session;
            if (!session) {
                return false;
            }
            const chatModel = chatService.getSession(session.chatSessionResource);
            return chatModel.requestInProgress.read(r);
        });
        this._store.add(autorun(r => {
            const data = sessionAndEntry.read(r);
            if (!data) {
                hide();
                return;
            }
            const { session, entry } = data;
            if (!session.isGlobalEditingSession) {
                // inline chat - no chat overlay unless hideOnRequest is on
                hide();
                return;
            }
            if (entry?.state.read(r) === 0 /* ModifiedFileEntryState.Modified */ // any entry changing
                || (!session.isGlobalEditingSession && isInProgress.read(r)) // inline chat request
            ) {
                // any session with changes
                const editorPane = group.activeEditorPane;
                assertType(editorPane);
                const changeIndex = derived(r => entry
                    ? entry.getEditorIntegration(editorPane).currentIndex.read(r)
                    : 0);
                const entryIndex = derived(r => entry
                    ? session.entries.read(r).indexOf(entry)
                    : 0);
                widget.show(session, entry, { entryIndex, changeIndex });
                show();
            }
            else {
                // nothing
                hide();
            }
        }));
    }
    dispose() {
        this._store.dispose();
    }
};
ChatEditingOverlayController = __decorate([
    __param(2, IInstantiationService),
    __param(3, IChatService),
    __param(4, IChatEditingService),
    __param(5, IInlineChatSessionService)
], ChatEditingOverlayController);
let ChatEditingEditorOverlay = class ChatEditingEditorOverlay {
    static { this.ID = 'chat.edits.editorOverlay'; }
    constructor(editorGroupsService, instantiationService) {
        this._store = new DisposableStore();
        const editorGroups = observableFromEvent(this, Event.any(editorGroupsService.onDidAddGroup, editorGroupsService.onDidRemoveGroup), () => editorGroupsService.groups);
        const overlayWidgets = new DisposableMap();
        this._store.add(autorun(r => {
            const toDelete = new Set(overlayWidgets.keys());
            const groups = editorGroups.read(r);
            for (const group of groups) {
                if (!(group instanceof EditorGroupView)) {
                    // TODO@jrieken better with https://github.com/microsoft/vscode/tree/ben/layout-group-container
                    continue;
                }
                toDelete.delete(group); // we keep the widget for this group!
                if (!overlayWidgets.has(group)) {
                    const scopedInstaService = instantiationService.createChild(new ServiceCollection([IContextKeyService, group.scopedContextKeyService]));
                    const container = group.element;
                    const ctrl = scopedInstaService.createInstance(ChatEditingOverlayController, container, group);
                    overlayWidgets.set(group, combinedDisposable(ctrl, scopedInstaService));
                }
            }
            for (const group of toDelete) {
                overlayWidgets.deleteAndDispose(group);
            }
        }));
    }
    dispose() {
        this._store.dispose();
    }
};
ChatEditingEditorOverlay = __decorate([
    __param(0, IEditorGroupsService),
    __param(1, IInstantiationService)
], ChatEditingEditorOverlay);
export { ChatEditingEditorOverlay };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdFZGl0b3JPdmVybGF5LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0RWRpdGluZy9jaGF0RWRpdGluZ0VkaXRvck92ZXJsYXkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyx1Q0FBdUMsQ0FBQztBQUMvQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDMUosT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFlLG1CQUFtQixFQUFFLHVCQUF1QixFQUFFLHlCQUF5QixFQUFFLGVBQWUsRUFBRSxXQUFXLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUM3TSxPQUFPLEVBQXNCLG9CQUFvQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDOUcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLG1CQUFtQixFQUFtRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzFJLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUMzRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFFN0YsT0FBTyxFQUFFLENBQUMsRUFBRSxxQ0FBcUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN0RyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDakUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxZQUFZLEVBQUUsNkJBQTZCLEVBQUUsWUFBWSxFQUFFLE1BQU0sK0JB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