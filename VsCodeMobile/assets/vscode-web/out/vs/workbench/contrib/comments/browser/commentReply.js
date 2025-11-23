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
import * as dom from '../../../../base/browser/dom.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { MOUSE_CURSOR_TEXT_CSS_CLASS_NAME } from '../../../../base/browser/ui/mouseCursor/mouseCursor.js';
import { Disposable, dispose } from '../../../../base/common/lifecycle.js';
import { FileAccess, Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import * as nls from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { CommentFormActions } from './commentFormActions.js';
import { ICommentService } from './commentService.js';
import { CommentContextKeys } from '../common/commentContextKeys.js';
import { MIN_EDITOR_HEIGHT, SimpleCommentEditor, calculateEditorHeight } from './simpleCommentEditor.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { Position } from '../../../../editor/common/core/position.js';
let INMEM_MODEL_ID = 0;
export const COMMENTEDITOR_DECORATION_KEY = 'commenteditordecoration';
let CommentReply = class CommentReply extends Disposable {
    constructor(owner, container, _parentEditor, _commentThread, _scopedInstatiationService, _contextKeyService, _commentMenus, _commentOptions, _pendingComment, _parentThread, focus, _actionRunDelegate, commentService, configurationService, keybindingService, contextMenuService, hoverService, textModelService) {
        super();
        this.owner = owner;
        this._parentEditor = _parentEditor;
        this._commentThread = _commentThread;
        this._scopedInstatiationService = _scopedInstatiationService;
        this._contextKeyService = _contextKeyService;
        this._commentMenus = _commentMenus;
        this._commentOptions = _commentOptions;
        this._pendingComment = _pendingComment;
        this._parentThread = _parentThread;
        this._actionRunDelegate = _actionRunDelegate;
        this.commentService = commentService;
        this.keybindingService = keybindingService;
        this.contextMenuService = contextMenuService;
        this.hoverService = hoverService;
        this.textModelService = textModelService;
        this._commentThreadDisposables = [];
        this._editorHeight = MIN_EDITOR_HEIGHT;
        this._container = dom.append(container, dom.$('.comment-form-container'));
        this._form = dom.append(this._container, dom.$('.comment-form'));
        this.commentEditor = this._register(this._scopedInstatiationService.createInstance(SimpleCommentEditor, this._form, SimpleCommentEditor.getEditorOptions(configurationService), _contextKeyService, this._parentThread));
        this.commentEditorIsEmpty = CommentContextKeys.commentIsEmpty.bindTo(this._contextKeyService);
        this.commentEditorIsEmpty.set(!this._pendingComment);
        this.initialize(focus);
    }
    async initialize(focus) {
        this.avatar = dom.append(this._form, dom.$('.avatar-container'));
        this.updateAuthorInfo();
        const hasExistingComments = this._commentThread.comments && this._commentThread.comments.length > 0;
        const modeId = generateUuid() + '-' + (hasExistingComments ? this._commentThread.threadId : ++INMEM_MODEL_ID);
        const params = JSON.stringify({
            extensionId: this._commentThread.extensionId,
            commentThreadId: this._commentThread.threadId
        });
        let resource = URI.from({
            scheme: Schemas.commentsInput,
            path: `/${this._commentThread.extensionId}/commentinput-${modeId}.md?${params}` // TODO. Remove params once extensions adopt authority.
        });
        const commentController = this.commentService.getCommentController(this.owner);
        if (commentController) {
            resource = resource.with({ authority: commentController.id });
        }
        const model = await this.textModelService.createModelReference(resource);
        model.object.textEditorModel.setValue(this._pendingComment?.body || '');
        this._register(model);
        this.commentEditor.setModel(model.object.textEditorModel);
        if (this._pendingComment) {
            this.commentEditor.setPosition(this._pendingComment.cursor);
        }
        this.calculateEditorHeight();
        this._register(model.object.textEditorModel.onDidChangeContent(() => {
            this.setCommentEditorDecorations();
            this.commentEditorIsEmpty?.set(!this.commentEditor.getValue());
            if (this.calculateEditorHeight()) {
                this.commentEditor.layout({ height: this._editorHeight, width: this.commentEditor.getLayoutInfo().width });
                this.commentEditor.render(true);
            }
        }));
        this.createTextModelListener(this.commentEditor, this._form);
        this.setCommentEditorDecorations();
        // Only add the additional step of clicking a reply button to expand the textarea when there are existing comments
        if (this._pendingComment) {
            this.expandReplyArea();
        }
        else if (hasExistingComments) {
            this.createReplyButton(this.commentEditor, this._form);
        }
        else if (this._commentThread.comments && this._commentThread.comments.length === 0) {
            this.expandReplyArea(focus);
        }
        this._error = dom.append(this._container, dom.$('.validation-error.hidden'));
        const formActions = dom.append(this._container, dom.$('.form-actions'));
        this._formActions = dom.append(formActions, dom.$('.other-actions'));
        this.createCommentWidgetFormActions(this._formActions, model.object.textEditorModel);
        this._editorActions = dom.append(formActions, dom.$('.editor-actions'));
        this.createCommentWidgetEditorActions(this._editorActions, model.object.textEditorModel);
    }
    calculateEditorHeight() {
        const newEditorHeight = calculateEditorHeight(this._parentEditor, this.commentEditor, this._editorHeight);
        if (newEditorHeight !== this._editorHeight) {
            this._editorHeight = newEditorHeight;
            return true;
        }
        return false;
    }
    updateCommentThread(commentThread) {
        const isReplying = this.commentEditor.hasTextFocus();
        const oldAndNewBothEmpty = !this._commentThread.comments?.length && !commentThread.comments?.length;
        if (!this._reviewThreadReplyButton) {
            this.createReplyButton(this.commentEditor, this._form);
        }
        if (this._commentThread.comments && this._commentThread.comments.length === 0 && !oldAndNewBothEmpty) {
            this.expandReplyArea();
        }
        if (isReplying) {
            this.commentEditor.focus();
        }
    }
    getPendingComment() {
        const model = this.commentEditor.getModel();
        if (model && model.getValueLength() > 0) { // checking length is cheap
            return { body: model.getValue(), cursor: this.commentEditor.getPosition() ?? new Position(1, 1) };
        }
        return undefined;
    }
    setPendingComment(pending) {
        this._pendingComment = pending;
        this.expandReplyArea();
        this.commentEditor.setValue(pending.body);
        this.commentEditor.setPosition(pending.cursor);
    }
    layout(widthInPixel) {
        this.commentEditor.layout({ height: this._editorHeight, width: widthInPixel - 54 /* margin 20px * 10 + scrollbar 14px*/ });
    }
    focusIfNeeded() {
        if (!this._commentThread.comments || !this._commentThread.comments.length) {
            this.commentEditor.focus();
        }
        else if ((this.commentEditor.getModel()?.getValueLength() ?? 0) > 0) {
            this.expandReplyArea();
        }
    }
    focusCommentEditor() {
        this.commentEditor.focus();
    }
    expandReplyAreaAndFocusCommentEditor() {
        this.expandReplyArea();
        this.commentEditor.focus();
    }
    isCommentEditorFocused() {
        return this.commentEditor.hasWidgetFocus();
    }
    updateAuthorInfo() {
        this.avatar.textContent = '';
        if (typeof this._commentThread.canReply !== 'boolean' && this._commentThread.canReply.iconPath) {
            this.avatar.style.display = 'block';
            const img = dom.append(this.avatar, dom.$('img.avatar'));
            img.src = FileAccess.uriToBrowserUri(URI.revive(this._commentThread.canReply.iconPath)).toString(true);
        }
        else {
            this.avatar.style.display = 'none';
        }
    }
    updateCanReply() {
        this.updateAuthorInfo();
        if (!this._commentThread.canReply) {
            this._container.style.display = 'none';
        }
        else {
            this._container.style.display = 'block';
        }
    }
    async submitComment() {
        await this._commentFormActions?.triggerDefaultAction();
        this._pendingComment = undefined;
    }
    setCommentEditorDecorations() {
        const hasExistingComments = this._commentThread.comments && this._commentThread.comments.length > 0;
        const placeholder = hasExistingComments
            ? (this._commentOptions?.placeHolder || nls.localize('reply', "Reply..."))
            : (this._commentOptions?.placeHolder || nls.localize('newComment', "Type a new comment"));
        this.commentEditor.updateOptions({ placeholder });
    }
    createTextModelListener(commentEditor, commentForm) {
        this._commentThreadDisposables.push(commentEditor.onDidFocusEditorWidget(() => {
            this._commentThread.input = {
                uri: commentEditor.getModel().uri,
                value: commentEditor.getValue()
            };
            this.commentService.setActiveEditingCommentThread(this._commentThread);
            this.commentService.setActiveCommentAndThread(this.owner, { thread: this._commentThread });
        }));
        this._commentThreadDisposables.push(commentEditor.getModel().onDidChangeContent(() => {
            const modelContent = commentEditor.getValue();
            if (this._commentThread.input && this._commentThread.input.uri === commentEditor.getModel().uri && this._commentThread.input.value !== modelContent) {
                const newInput = this._commentThread.input;
                newInput.value = modelContent;
                this._commentThread.input = newInput;
            }
            this.commentService.setActiveEditingCommentThread(this._commentThread);
        }));
        this._commentThreadDisposables.push(this._commentThread.onDidChangeInput(input => {
            const thread = this._commentThread;
            const model = commentEditor.getModel();
            if (thread.input && model && (thread.input.uri !== model.uri)) {
                return;
            }
            if (!input) {
                return;
            }
            if (commentEditor.getValue() !== input.value) {
                commentEditor.setValue(input.value);
                if (input.value === '') {
                    this._pendingComment = { body: '', cursor: new Position(1, 1) };
                    commentForm.classList.remove('expand');
                    commentEditor.getDomNode().style.outline = '';
                    this._error.textContent = '';
                    this._error.classList.add('hidden');
                }
            }
        }));
    }
    /**
     * Command based actions.
     */
    createCommentWidgetFormActions(container, model) {
        const menu = this._commentMenus.getCommentThreadActions(this._contextKeyService);
        this._register(menu);
        this._register(menu.onDidChange(() => {
            this._commentFormActions.setActions(menu);
        }));
        this._commentFormActions = new CommentFormActions(this.keybindingService, this._contextKeyService, this.contextMenuService, container, async (action) => {
            await this._actionRunDelegate?.();
            await action.run({
                thread: this._commentThread,
                text: this.commentEditor.getValue(),
                $mid: 9 /* MarshalledId.CommentThreadReply */
            });
            this.hideReplyArea();
        });
        this._register(this._commentFormActions);
        this._commentFormActions.setActions(menu);
    }
    createCommentWidgetEditorActions(container, model) {
        const editorMenu = this._commentMenus.getCommentEditorActions(this._contextKeyService);
        this._register(editorMenu);
        this._register(editorMenu.onDidChange(() => {
            this._commentEditorActions.setActions(editorMenu, true);
        }));
        this._commentEditorActions = new CommentFormActions(this.keybindingService, this._contextKeyService, this.contextMenuService, container, async (action) => {
            this._actionRunDelegate?.();
            action.run({
                thread: this._commentThread,
                text: this.commentEditor.getValue(),
                $mid: 9 /* MarshalledId.CommentThreadReply */
            });
            this.focusCommentEditor();
        });
        this._register(this._commentEditorActions);
        this._commentEditorActions.setActions(editorMenu, true);
    }
    get isReplyExpanded() {
        return this._container.classList.contains('expand');
    }
    expandReplyArea(focus = true) {
        if (!this.isReplyExpanded) {
            this._container.classList.add('expand');
            if (focus) {
                this.commentEditor.focus();
            }
            this.commentEditor.layout();
        }
    }
    clearAndExpandReplyArea() {
        if (!this.isReplyExpanded) {
            this.commentEditor.setValue('');
            this.expandReplyArea();
        }
    }
    hideReplyArea() {
        const domNode = this.commentEditor.getDomNode();
        if (domNode) {
            domNode.style.outline = '';
        }
        this.commentEditor.setValue('');
        this._pendingComment = { body: '', cursor: new Position(1, 1) };
        this._container.classList.remove('expand');
        this._error.textContent = '';
        this._error.classList.add('hidden');
    }
    createReplyButton(commentEditor, commentForm) {
        this._reviewThreadReplyButton = dom.append(commentForm, dom.$(`button.review-thread-reply-button.${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`));
        this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), this._reviewThreadReplyButton, this._commentOptions?.prompt || nls.localize('reply', "Reply...")));
        this._reviewThreadReplyButton.textContent = this._commentOptions?.prompt || nls.localize('reply', "Reply...");
        // bind click/escape actions for reviewThreadReplyButton and textArea
        this._register(dom.addDisposableListener(this._reviewThreadReplyButton, 'click', _ => this.clearAndExpandReplyArea()));
        this._register(dom.addDisposableListener(this._reviewThreadReplyButton, 'focus', _ => this.clearAndExpandReplyArea()));
        this._register(commentEditor.onDidBlurEditorWidget(() => {
            if (commentEditor.getModel().getValueLength() === 0 && commentForm.classList.contains('expand')) {
                commentForm.classList.remove('expand');
            }
        }));
    }
    dispose() {
        super.dispose();
        dispose(this._commentThreadDisposables);
    }
};
CommentReply = __decorate([
    __param(12, ICommentService),
    __param(13, IConfigurationService),
    __param(14, IKeybindingService),
    __param(15, IContextMenuService),
    __param(16, IHoverService),
    __param(17, ITextModelService)
], CommentReply);
export { CommentReply };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWVudFJlcGx5LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NvbW1lbnRzL2Jyb3dzZXIvY29tbWVudFJlcGx5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDcEcsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFFMUcsT0FBTyxFQUFFLFVBQVUsRUFBZSxPQUFPLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUV4RixPQUFPLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFLL0QsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDMUYsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUduRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUU3RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDdEQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFHckUsT0FBTyxFQUFvQixpQkFBaUIsRUFBRSxtQkFBbUIsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQzNI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