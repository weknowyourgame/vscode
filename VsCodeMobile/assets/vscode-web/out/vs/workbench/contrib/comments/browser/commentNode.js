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
import * as nls from '../../../../nls.js';
import * as dom from '../../../../base/browser/dom.js';
import * as languages from '../../../../editor/common/languages.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { Action, Separator, ActionRunner } from '../../../../base/common/actions.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ICommentService } from './commentService.js';
import { MIN_EDITOR_HEIGHT, SimpleCommentEditor, calculateEditorHeight } from './simpleCommentEditor.js';
import { Emitter } from '../../../../base/common/event.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { ToolBar } from '../../../../base/browser/ui/toolbar/toolbar.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { ToggleReactionsAction, ReactionAction, ReactionActionViewItem } from './reactionsAction.js';
import { MenuItemAction, SubmenuItemAction, MenuId } from '../../../../platform/actions/common/actions.js';
import { MenuEntryActionViewItem, SubmenuEntryActionViewItem } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { CommentFormActions } from './commentFormActions.js';
import { MOUSE_CURSOR_TEXT_CSS_CLASS_NAME } from '../../../../base/browser/ui/mouseCursor/mouseCursor.js';
import { ActionViewItem } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { DropdownMenuActionViewItem } from '../../../../base/browser/ui/dropdown/dropdownActionViewItem.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { TimestampWidget } from './timestamp.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Scrollable } from '../../../../base/common/scrollable.js';
import { SmoothScrollableElement } from '../../../../base/browser/ui/scrollbar/scrollableElement.js';
import { DomEmitter } from '../../../../base/browser/event.js';
import { CommentContextKeys } from '../common/commentContextKeys.js';
import { FileAccess, Schemas } from '../../../../base/common/network.js';
import { COMMENTS_SECTION } from '../common/commentsConfiguration.js';
import { StandardMouseEvent } from '../../../../base/browser/mouseEvent.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { Position } from '../../../../editor/common/core/position.js';
class CommentsActionRunner extends ActionRunner {
    async runAction(action, context) {
        await action.run(...context);
    }
}
let CommentNode = class CommentNode extends Disposable {
    get domNode() {
        return this._domNode;
    }
    constructor(parentEditor, commentThread, comment, pendingEdit, owner, resource, parentThread, markdownRendererOptions, instantiationService, commentService, notificationService, contextMenuService, contextKeyService, configurationService, hoverService, keybindingService, textModelService, markdownRendererService) {
        super();
        this.parentEditor = parentEditor;
        this.commentThread = commentThread;
        this.comment = comment;
        this.pendingEdit = pendingEdit;
        this.owner = owner;
        this.resource = resource;
        this.parentThread = parentThread;
        this.markdownRendererOptions = markdownRendererOptions;
        this.instantiationService = instantiationService;
        this.commentService = commentService;
        this.notificationService = notificationService;
        this.contextMenuService = contextMenuService;
        this.configurationService = configurationService;
        this.hoverService = hoverService;
        this.keybindingService = keybindingService;
        this.textModelService = textModelService;
        this.markdownRendererService = markdownRendererService;
        this._md = this._register(new MutableDisposable());
        this._editAction = null;
        this._commentEditContainer = null;
        this._reactionsActionBar = this._register(new MutableDisposable());
        this._reactionActions = this._register(new DisposableStore());
        this._commentEditor = null;
        this._commentEditorModel = null;
        this._editorHeight = MIN_EDITOR_HEIGHT;
        this._actionRunner = this._register(new CommentsActionRunner());
        this.toolbar = this._register(new MutableDisposable());
        this._commentFormActions = null;
        this._commentEditorActions = null;
        this._onDidClick = new Emitter();
        this.isEditing = false;
        this._editModeDisposables = this._register(new DisposableStore());
        this._domNode = dom.$('div.review-comment');
        this._contextKeyService = this._register(contextKeyService.createScoped(this._domNode));
        this._commentContextValue = CommentContextKeys.commentContext.bindTo(this._contextKeyService);
        if (this.comment.contextValue) {
            this._commentContextValue.set(this.comment.contextValue);
        }
        this._commentMenus = this.commentService.getCommentMenus(this.owner);
        this._domNode.tabIndex = -1;
        this._avatar = dom.append(this._domNode, dom.$('div.avatar-container'));
        this.updateCommentUserIcon(this.comment.userIconPath);
        this._commentDetailsContainer = dom.append(this._domNode, dom.$('.review-comment-contents'));
        this.createHeader(this._commentDetailsContainer);
        this._body = document.createElement(`div`);
        this._body.classList.add('comment-body', MOUSE_CURSOR_TEXT_CSS_CLASS_NAME);
        if (configurationService.getValue(COMMENTS_SECTION)?.maxHeight !== false) {
            this._body.classList.add('comment-body-max-height');
        }
        this.createScroll(this._commentDetailsContainer, this._body);
        this.updateCommentBody(this.comment.body);
        this.createReactionsContainer(this._commentDetailsContainer);
        this._domNode.setAttribute('aria-label', `${comment.userName}, ${this.commentBodyValue}`);
        this._domNode.setAttribute('role', 'treeitem');
        this._clearTimeout = null;
        this._register(dom.addDisposableListener(this._domNode, dom.EventType.CLICK, () => this.isEditing || this._onDidClick.fire(this)));
        this._register(dom.addDisposableListener(this._domNode, dom.EventType.CONTEXT_MENU, e => {
            return this.onContextMenu(e);
        }));
        if (pendingEdit) {
            this.switchToEditMode();
        }
        this.activeCommentListeners();
    }
    activeCommentListeners() {
        this._register(dom.addDisposableListener(this._domNode, dom.EventType.FOCUS_IN, () => {
            this.commentService.setActiveCommentAndThread(this.owner, { thread: this.commentThread, comment: this.comment });
        }, true));
    }
    createScroll(container, body) {
        this._scrollable = this._register(new Scrollable({
            forceIntegerValues: true,
            smoothScrollDuration: 125,
            scheduleAtNextAnimationFrame: cb => dom.scheduleAtNextAnimationFrame(dom.getWindow(container), cb)
        }));
        this._scrollableElement = this._register(new SmoothScrollableElement(body, {
            horizontal: 3 /* ScrollbarVisibility.Visible */,
            vertical: 3 /* ScrollbarVisibility.Visible */
        }, this._scrollable));
        this._register(this._scrollableElement.onScroll(e => {
            if (e.scrollLeftChanged) {
                body.scrollLeft = e.scrollLeft;
            }
            if (e.scrollTopChanged) {
                body.scrollTop = e.scrollTop;
            }
        }));
        const onDidScrollViewContainer = this._register(new DomEmitter(body, 'scroll')).event;
        this._register(onDidScrollViewContainer(_ => {
            const position = this._scrollableElement.getScrollPosition();
            const scrollLeft = Math.abs(body.scrollLeft - position.scrollLeft) <= 1 ? undefined : body.scrollLeft;
            const scrollTop = Math.abs(body.scrollTop - position.scrollTop) <= 1 ? undefined : body.scrollTop;
            if (scrollLeft !== undefined || scrollTop !== undefined) {
                this._scrollableElement.setScrollPosition({ scrollLeft, scrollTop });
            }
        }));
        container.appendChild(this._scrollableElement.getDomNode());
    }
    updateCommentBody(body) {
        this._body.innerText = '';
        this._md.clear();
        this._plainText = undefined;
        if (typeof body === 'string') {
            this._plainText = dom.append(this._body, dom.$('.comment-body-plainstring'));
            this._plainText.innerText = body;
        }
        else {
            this._md.value = this.markdownRendererService.render(body, this.markdownRendererOptions);
            this._body.appendChild(this._md.value.element);
        }
    }
    updateCommentUserIcon(userIconPath) {
        this._avatar.textContent = '';
        if (userIconPath) {
            const img = dom.append(this._avatar, dom.$('img.avatar'));
            img.src = FileAccess.uriToBrowserUri(URI.revive(userIconPath)).toString(true);
            img.onerror = _ => img.remove();
        }
    }
    get onDidClick() {
        return this._onDidClick.event;
    }
    createTimestamp(container) {
        this._timestamp = dom.append(container, dom.$('span.timestamp-container'));
        this.updateTimestamp(this.comment.timestamp);
    }
    updateTimestamp(raw) {
        if (!this._timestamp) {
            return;
        }
        const timestamp = raw !== undefined ? new Date(raw) : undefined;
        if (!timestamp) {
            this._timestampWidget?.dispose();
        }
        else {
            if (!this._timestampWidget) {
                this._timestampWidget = new TimestampWidget(this.configurationService, this.hoverService, this._timestamp, timestamp);
                this._register(this._timestampWidget);
            }
            else {
                this._timestampWidget.setTimestamp(timestamp);
            }
        }
    }
    createHeader(commentDetailsContainer) {
        const header = dom.append(commentDetailsContainer, dom.$(`div.comment-title.${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`));
        const infoContainer = dom.append(header, dom.$('comment-header-info'));
        const author = dom.append(infoContainer, dom.$('strong.author'));
        author.innerText = this.comment.userName;
        this.createTimestamp(infoContainer);
        this._isPendingLabel = dom.append(infoContainer, dom.$('span.isPending'));
        if (this.comment.label) {
            this._isPendingLabel.innerText = this.comment.label;
        }
        else {
            this._isPendingLabel.innerText = '';
        }
        this._actionsToolbarContainer = dom.append(header, dom.$('.comment-actions'));
        this.createActionsToolbar();
    }
    getToolbarActions(menu) {
        const contributedActions = menu.getActions({ shouldForwardArgs: true });
        const primary = [];
        const secondary = [];
        const result = { primary, secondary };
        fillInActions(contributedActions, result, false, g => /^inline/.test(g));
        return result;
    }
    get commentNodeContext() {
        return [{
                thread: this.commentThread,
                commentUniqueId: this.comment.uniqueIdInThread,
                $mid: 10 /* MarshalledId.CommentNode */
            },
            {
                commentControlHandle: this.commentThread.controllerHandle,
                commentThreadHandle: this.commentThread.commentThreadHandle,
                $mid: 7 /* MarshalledId.CommentThread */
            }];
    }
    createToolbar() {
        this.toolbar.value = new ToolBar(this._actionsToolbarContainer, this.contextMenuService, {
            actionViewItemProvider: (action, options) => {
                if (action.id === ToggleReactionsAction.ID) {
                    return new DropdownMenuActionViewItem(action, action.menuActions, this.contextMenuService, {
                        ...options,
                        actionViewItemProvider: (action, options) => this.actionViewItemProvider(action, options),
                        classNames: ['toolbar-toggle-pickReactions', ...ThemeIcon.asClassNameArray(Codicon.reactions)],
                        anchorAlignmentProvider: () => 1 /* AnchorAlignment.RIGHT */
                    });
                }
                return this.actionViewItemProvider(action, options);
            },
            orientation: 0 /* ActionsOrientation.HORIZONTAL */
        });
        this.toolbar.value.context = this.commentNodeContext;
        this.toolbar.value.actionRunner = this._actionRunner;
    }
    createActionsToolbar() {
        const actions = [];
        const menu = this._commentMenus.getCommentTitleActions(this.comment, this._contextKeyService);
        this._register(menu);
        this._register(menu.onDidChange(e => {
            const { primary, secondary } = this.getToolbarActions(menu);
            if (!this.toolbar && (primary.length || secondary.length)) {
                this.createToolbar();
            }
            this.toolbar.value.setActions(primary, secondary);
        }));
        const { primary, secondary } = this.getToolbarActions(menu);
        actions.push(...primary);
        if (actions.length || secondary.length) {
            this.createToolbar();
            this.toolbar.value.setActions(actions, secondary);
        }
    }
    actionViewItemProvider(action, options) {
        if (action.id === ToggleReactionsAction.ID) {
            options = { label: false, icon: true };
        }
        else {
            options = { label: false, icon: true };
        }
        if (action.id === ReactionAction.ID) {
            const item = new ReactionActionViewItem(action);
            return item;
        }
        else if (action instanceof MenuItemAction) {
            return this.instantiationService.createInstance(MenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate });
        }
        else if (action instanceof SubmenuItemAction) {
            return this.instantiationService.createInstance(SubmenuEntryActionViewItem, action, options);
        }
        else {
            const item = new ActionViewItem({}, action, options);
            return item;
        }
    }
    async submitComment() {
        if (this._commentEditor && this._commentFormActions) {
            await this._commentFormActions.triggerDefaultAction();
            this.pendingEdit = undefined;
        }
    }
    createReactionPicker(reactionGroup) {
        const toggleReactionAction = this._reactionActions.add(new ToggleReactionsAction(() => {
            toggleReactionActionViewItem?.show();
        }, nls.localize('commentToggleReaction', "Toggle Reaction")));
        let reactionMenuActions = [];
        if (reactionGroup && reactionGroup.length) {
            reactionMenuActions = reactionGroup.map((reaction) => {
                return this._reactionActions.add(new Action(`reaction.command.${reaction.label}`, `${reaction.label}`, '', true, async () => {
                    try {
                        await this.commentService.toggleReaction(this.owner, this.resource, this.commentThread, this.comment, reaction);
                    }
                    catch (e) {
                        const error = e.message
                            ? nls.localize('commentToggleReactionError', "Toggling the comment reaction failed: {0}.", e.message)
                            : nls.localize('commentToggleReactionDefaultError', "Toggling the comment reaction failed");
                        this.notificationService.error(error);
                    }
                }));
            });
        }
        toggleReactionAction.menuActions = reactionMenuActions;
        const toggleReactionActionViewItem = this._reactionActions.add(new DropdownMenuActionViewItem(toggleReactionAction, toggleReactionAction.menuActions, this.contextMenuService, {
            actionViewItemProvider: (action, options) => {
                if (action.id === ToggleReactionsAction.ID) {
                    return toggleReactionActionViewItem;
                }
                return this.actionViewItemProvider(action, options);
            },
            classNames: 'toolbar-toggle-pickReactions',
            anchorAlignmentProvider: () => 1 /* AnchorAlignment.RIGHT */
        }));
        return toggleReactionAction;
    }
    createReactionsContainer(commentDetailsContainer) {
        this._reactionActionsContainer?.remove();
        this._reactionsActionBar.clear();
        this._reactionActions.clear();
        this._reactionActionsContainer = dom.append(commentDetailsContainer, dom.$('div.comment-reactions'));
        this._reactionsActionBar.value = new ActionBar(this._reactionActionsContainer, {
            actionViewItemProvider: (action, options) => {
                if (action.id === ToggleReactionsAction.ID) {
                    return new DropdownMenuActionViewItem(action, action.menuActions, this.contextMenuService, {
                        actionViewItemProvider: (action, options) => this.actionViewItemProvider(action, options),
                        classNames: ['toolbar-toggle-pickReactions', ...ThemeIcon.asClassNameArray(Codicon.reactions)],
                        anchorAlignmentProvider: () => 1 /* AnchorAlignment.RIGHT */
                    });
                }
                return this.actionViewItemProvider(action, options);
            }
        });
        const hasReactionHandler = this.commentService.hasReactionHandler(this.owner);
        this.comment.commentReactions?.filter(reaction => !!reaction.count).map(reaction => {
            const action = this._reactionActions.add(new ReactionAction(`reaction.${reaction.label}`, `${reaction.label}`, reaction.hasReacted && (reaction.canEdit || hasReactionHandler) ? 'active' : '', (reaction.canEdit || hasReactionHandler), async () => {
                try {
                    await this.commentService.toggleReaction(this.owner, this.resource, this.commentThread, this.comment, reaction);
                }
                catch (e) {
                    let error;
                    if (reaction.hasReacted) {
                        error = e.message
                            ? nls.localize('commentDeleteReactionError', "Deleting the comment reaction failed: {0}.", e.message)
                            : nls.localize('commentDeleteReactionDefaultError', "Deleting the comment reaction failed");
                    }
                    else {
                        error = e.message
                            ? nls.localize('commentAddReactionError', "Deleting the comment reaction failed: {0}.", e.message)
                            : nls.localize('commentAddReactionDefaultError', "Deleting the comment reaction failed");
                    }
                    this.notificationService.error(error);
                }
            }, reaction.reactors, reaction.iconPath, reaction.count));
            this._reactionsActionBar.value?.push(action, { label: true, icon: true });
        });
        if (hasReactionHandler) {
            const toggleReactionAction = this.createReactionPicker(this.comment.commentReactions || []);
            this._reactionsActionBar.value?.push(toggleReactionAction, { label: false, icon: true });
        }
    }
    get commentBodyValue() {
        return (typeof this.comment.body === 'string') ? this.comment.body : this.comment.body.value;
    }
    async createCommentEditor(editContainer) {
        this._editModeDisposables.clear();
        const container = dom.append(editContainer, dom.$('.edit-textarea'));
        this._commentEditor = this.instantiationService.createInstance(SimpleCommentEditor, container, SimpleCommentEditor.getEditorOptions(this.configurationService), this._contextKeyService, this.parentThread);
        this._editModeDisposables.add(this._commentEditor);
        const resource = URI.from({
            scheme: Schemas.commentsInput,
            path: `/commentinput-${this.comment.uniqueIdInThread}-${Date.now()}.md`
        });
        const modelRef = await this.textModelService.createModelReference(resource);
        this._commentEditorModel = modelRef;
        this._editModeDisposables.add(this._commentEditorModel);
        this._commentEditor.setModel(this._commentEditorModel.object.textEditorModel);
        this._commentEditor.setValue(this.pendingEdit?.body ?? this.commentBodyValue);
        if (this.pendingEdit) {
            this._commentEditor.setPosition(this.pendingEdit.cursor);
        }
        else {
            const lastLine = this._commentEditorModel.object.textEditorModel.getLineCount();
            const lastColumn = this._commentEditorModel.object.textEditorModel.getLineLength(lastLine) + 1;
            this._commentEditor.setPosition(new Position(lastLine, lastColumn));
        }
        this.pendingEdit = undefined;
        this._commentEditor.layout({ width: container.clientWidth - 14, height: this._editorHeight });
        this._commentEditor.focus();
        dom.scheduleAtNextAnimationFrame(dom.getWindow(editContainer), () => {
            this._commentEditor.layout({ width: container.clientWidth - 14, height: this._editorHeight });
            this._commentEditor.focus();
        });
        const commentThread = this.commentThread;
        commentThread.input = {
            uri: this._commentEditor.getModel().uri,
            value: this.commentBodyValue
        };
        this.commentService.setActiveEditingCommentThread(commentThread);
        this.commentService.setActiveCommentAndThread(this.owner, { thread: commentThread, comment: this.comment });
        this._editModeDisposables.add(this._commentEditor.onDidFocusEditorWidget(() => {
            commentThread.input = {
                uri: this._commentEditor.getModel().uri,
                value: this.commentBodyValue
            };
            this.commentService.setActiveEditingCommentThread(commentThread);
            this.commentService.setActiveCommentAndThread(this.owner, { thread: commentThread, comment: this.comment });
        }));
        this._editModeDisposables.add(this._commentEditor.onDidChangeModelContent(e => {
            if (commentThread.input && this._commentEditor && this._commentEditor.getModel().uri === commentThread.input.uri) {
                const newVal = this._commentEditor.getValue();
                if (newVal !== commentThread.input.value) {
                    const input = commentThread.input;
                    input.value = newVal;
                    commentThread.input = input;
                    this.commentService.setActiveEditingCommentThread(commentThread);
                    this.commentService.setActiveCommentAndThread(this.owner, { thread: commentThread, comment: this.comment });
                }
            }
        }));
        this.calculateEditorHeight();
        this._editModeDisposables.add((this._commentEditorModel.object.textEditorModel.onDidChangeContent(() => {
            if (this._commentEditor && this.calculateEditorHeight()) {
                this._commentEditor.layout({ height: this._editorHeight, width: this._commentEditor.getLayoutInfo().width });
                this._commentEditor.render(true);
            }
        })));
    }
    calculateEditorHeight() {
        if (this._commentEditor) {
            const newEditorHeight = calculateEditorHeight(this.parentEditor, this._commentEditor, this._editorHeight);
            if (newEditorHeight !== this._editorHeight) {
                this._editorHeight = newEditorHeight;
                return true;
            }
        }
        return false;
    }
    getPendingEdit() {
        const model = this._commentEditor?.getModel();
        if (this._commentEditor && model && model.getValueLength() > 0) {
            return { body: model.getValue(), cursor: this._commentEditor.getPosition() };
        }
        return undefined;
    }
    removeCommentEditor() {
        this.isEditing = false;
        if (this._editAction) {
            this._editAction.enabled = true;
        }
        this._body.classList.remove('hidden');
        this._editModeDisposables.clear();
        this._commentEditor = null;
        this._commentEditContainer.remove();
    }
    layout(widthInPixel) {
        const editorWidth = widthInPixel !== undefined ? widthInPixel - 72 /* - margin and scrollbar*/ : (this._commentEditor?.getLayoutInfo().width ?? 0);
        this._commentEditor?.layout({ width: editorWidth, height: this._editorHeight });
        const scrollWidth = this._body.scrollWidth;
        const width = dom.getContentWidth(this._body);
        const scrollHeight = this._body.scrollHeight;
        const height = dom.getContentHeight(this._body) + 4;
        this._scrollableElement.setScrollDimensions({ width, scrollWidth, height, scrollHeight });
    }
    async switchToEditMode() {
        if (this.isEditing) {
            return;
        }
        this.isEditing = true;
        this._body.classList.add('hidden');
        this._commentEditContainer = dom.append(this._commentDetailsContainer, dom.$('.edit-container'));
        await this.createCommentEditor(this._commentEditContainer);
        const formActions = dom.append(this._commentEditContainer, dom.$('.form-actions'));
        const otherActions = dom.append(formActions, dom.$('.other-actions'));
        this.createCommentWidgetFormActions(otherActions);
        const editorActions = dom.append(formActions, dom.$('.editor-actions'));
        this.createCommentWidgetEditorActions(editorActions);
    }
    createCommentWidgetFormActions(container) {
        const menus = this.commentService.getCommentMenus(this.owner);
        const menu = menus.getCommentActions(this.comment, this._contextKeyService);
        this._editModeDisposables.add(menu);
        this._editModeDisposables.add(menu.onDidChange(() => {
            this._commentFormActions?.setActions(menu);
        }));
        this._commentFormActions = new CommentFormActions(this.keybindingService, this._contextKeyService, this.contextMenuService, container, (action) => {
            const text = this._commentEditor.getValue();
            action.run({
                thread: this.commentThread,
                commentUniqueId: this.comment.uniqueIdInThread,
                text: text,
                $mid: 11 /* MarshalledId.CommentThreadNode */
            });
            this.removeCommentEditor();
        });
        this._editModeDisposables.add(this._commentFormActions);
        this._commentFormActions.setActions(menu);
    }
    createCommentWidgetEditorActions(container) {
        const menus = this.commentService.getCommentMenus(this.owner);
        const menu = menus.getCommentEditorActions(this._contextKeyService);
        this._editModeDisposables.add(menu);
        this._editModeDisposables.add(menu.onDidChange(() => {
            this._commentEditorActions?.setActions(menu, true);
        }));
        this._commentEditorActions = new CommentFormActions(this.keybindingService, this._contextKeyService, this.contextMenuService, container, (action) => {
            const text = this._commentEditor.getValue();
            action.run({
                thread: this.commentThread,
                commentUniqueId: this.comment.uniqueIdInThread,
                text: text,
                $mid: 11 /* MarshalledId.CommentThreadNode */
            });
            this._commentEditor?.focus();
        });
        this._editModeDisposables.add(this._commentEditorActions);
        this._commentEditorActions.setActions(menu, true);
    }
    setFocus(focused, visible = false) {
        if (focused) {
            this._domNode.focus();
            this._actionsToolbarContainer.classList.add('tabfocused');
            this._domNode.tabIndex = 0;
            if (this.comment.mode === languages.CommentMode.Editing) {
                this._commentEditor?.focus();
            }
        }
        else {
            if (this._actionsToolbarContainer.classList.contains('tabfocused') && !this._actionsToolbarContainer.classList.contains('mouseover')) {
                this._domNode.tabIndex = -1;
            }
            this._actionsToolbarContainer.classList.remove('tabfocused');
        }
    }
    async update(newComment) {
        if (newComment.body !== this.comment.body) {
            this.updateCommentBody(newComment.body);
        }
        if (this.comment.userIconPath && newComment.userIconPath && (URI.from(this.comment.userIconPath).toString() !== URI.from(newComment.userIconPath).toString())) {
            this.updateCommentUserIcon(newComment.userIconPath);
        }
        const isChangingMode = newComment.mode !== undefined && newComment.mode !== this.comment.mode;
        this.comment = newComment;
        if (isChangingMode) {
            if (newComment.mode === languages.CommentMode.Editing) {
                await this.switchToEditMode();
            }
            else {
                this.removeCommentEditor();
            }
        }
        if (newComment.label) {
            this._isPendingLabel.innerText = newComment.label;
        }
        else {
            this._isPendingLabel.innerText = '';
        }
        // update comment reactions
        this.createReactionsContainer(this._commentDetailsContainer);
        if (this.comment.contextValue) {
            this._commentContextValue.set(this.comment.contextValue);
        }
        else {
            this._commentContextValue.reset();
        }
        if (this.comment.timestamp) {
            this.updateTimestamp(this.comment.timestamp);
        }
    }
    onContextMenu(e) {
        const event = new StandardMouseEvent(dom.getWindow(this._domNode), e);
        this.contextMenuService.showContextMenu({
            getAnchor: () => event,
            menuId: MenuId.CommentThreadCommentContext,
            menuActionOptions: { shouldForwardArgs: true },
            contextKeyService: this._contextKeyService,
            actionRunner: this._actionRunner,
            getActionsContext: () => {
                return this.commentNodeContext;
            },
        });
    }
    focus() {
        this.domNode.focus();
        if (!this._clearTimeout) {
            this.domNode.classList.add('focus');
            this._clearTimeout = setTimeout(() => {
                this.domNode.classList.remove('focus');
            }, 3000);
        }
    }
    dispose() {
        super.dispose();
    }
};
CommentNode = __decorate([
    __param(8, IInstantiationService),
    __param(9, ICommentService),
    __param(10, INotificationService),
    __param(11, IContextMenuService),
    __param(12, IContextKeyService),
    __param(13, IConfigurationService),
    __param(14, IHoverService),
    __param(15, IKeybindingService),
    __param(16, ITextModelService),
    __param(17, IMarkdownRendererService)
], CommentNode);
export { CommentNode };
function fillInActions(groups, target, useAlternativeActions, isPrimaryGroup = group => group === 'navigation') {
    for (const tuple of groups) {
        let [group, actions] = tuple;
        if (useAlternativeActions) {
            actions = actions.map(a => (a instanceof MenuItemAction) && !!a.alt ? a.alt : a);
        }
        if (isPrimaryGroup(group)) {
            const to = Array.isArray(target) ? target : target.primary;
            to.unshift(...actions);
        }
        else {
            const to = Array.isArray(target) ? target : target.secondary;
            if (to.length > 0) {
                to.push(new Separator());
            }
            to.push(...actions);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWVudE5vZGUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY29tbWVudHMvYnJvd3Nlci9jb21tZW50Tm9kZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9CQUFvQixDQUFDO0FBQzFDLE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxLQUFLLFNBQVMsTUFBTSx3Q0FBd0MsQ0FBQztBQUNwRSxPQUFPLEVBQXNCLFNBQVMsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxNQUFNLEVBQVcsU0FBUyxFQUFFLFlBQVksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzlGLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFjLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEgsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNwRSxPQUFPLEVBQWlDLHdCQUF3QixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFFcEksT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQ3RELE9BQU8sRUFBb0IsaUJBQWlCLEVBQUUsbUJBQW1CLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMzSCxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHlEQUF5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