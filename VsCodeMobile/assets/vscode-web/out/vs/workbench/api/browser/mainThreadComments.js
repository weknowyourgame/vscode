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
import { Emitter } from '../../../base/common/event.js';
import { Disposable, DisposableMap, DisposableStore, MutableDisposable } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { Range } from '../../../editor/common/core/range.js';
import * as languages from '../../../editor/common/languages.js';
import { Registry } from '../../../platform/registry/common/platform.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { ICommentService } from '../../contrib/comments/browser/commentService.js';
import { CommentsPanel } from '../../contrib/comments/browser/commentsView.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { COMMENTS_VIEW_ID, COMMENTS_VIEW_STORAGE_ID, COMMENTS_VIEW_TITLE } from '../../contrib/comments/browser/commentsTreeViewer.js';
import { Extensions as ViewExtensions, IViewDescriptorService } from '../../common/views.js';
import { SyncDescriptor } from '../../../platform/instantiation/common/descriptors.js';
import { ViewPaneContainer } from '../../browser/parts/views/viewPaneContainer.js';
import { Codicon } from '../../../base/common/codicons.js';
import { registerIcon } from '../../../platform/theme/common/iconRegistry.js';
import { localize } from '../../../nls.js';
import { Schemas } from '../../../base/common/network.js';
import { IViewsService } from '../../services/views/common/viewsService.js';
import { revealCommentThread } from '../../contrib/comments/browser/commentsController.js';
import { IEditorService } from '../../services/editor/common/editorService.js';
import { IUriIdentityService } from '../../../platform/uriIdentity/common/uriIdentity.js';
export class MainThreadCommentThread {
    get input() {
        return this._input;
    }
    set input(value) {
        this._input = value;
        this._onDidChangeInput.fire(value);
    }
    get onDidChangeInput() { return this._onDidChangeInput.event; }
    get label() {
        return this._label;
    }
    set label(label) {
        this._label = label;
        this._onDidChangeLabel.fire(this._label);
    }
    get contextValue() {
        return this._contextValue;
    }
    set contextValue(context) {
        this._contextValue = context;
    }
    get comments() {
        return this._comments;
    }
    set comments(newComments) {
        this._comments = newComments;
        this._onDidChangeComments.fire(this._comments);
    }
    get onDidChangeComments() { return this._onDidChangeComments.event; }
    set range(range) {
        this._range = range;
    }
    get range() {
        return this._range;
    }
    get onDidChangeCanReply() { return this._onDidChangeCanReply.event; }
    set canReply(state) {
        this._canReply = state;
        this._onDidChangeCanReply.fire(!!this._canReply);
    }
    get canReply() {
        return this._canReply;
    }
    get collapsibleState() {
        return this._collapsibleState;
    }
    set collapsibleState(newState) {
        if (this.initialCollapsibleState === undefined) {
            this.initialCollapsibleState = newState;
        }
        if (newState !== this._collapsibleState) {
            this._collapsibleState = newState;
            this._onDidChangeCollapsibleState.fire(this._collapsibleState);
        }
    }
    get initialCollapsibleState() {
        return this._initialCollapsibleState;
    }
    set initialCollapsibleState(initialCollapsibleState) {
        this._initialCollapsibleState = initialCollapsibleState;
        this._onDidChangeInitialCollapsibleState.fire(initialCollapsibleState);
    }
    get isDisposed() {
        return this._isDisposed;
    }
    isDocumentCommentThread() {
        return this._range === undefined || Range.isIRange(this._range);
    }
    get state() {
        return this._state;
    }
    set state(newState) {
        this._state = newState;
        this._onDidChangeState.fire(this._state);
    }
    get applicability() {
        return this._applicability;
    }
    set applicability(value) {
        this._applicability = value;
        this._onDidChangeApplicability.fire(value);
    }
    get isTemplate() {
        return this._isTemplate;
    }
    constructor(commentThreadHandle, controllerHandle, extensionId, threadId, resource, _range, comments, _canReply, _isTemplate, editorId) {
        this.commentThreadHandle = commentThreadHandle;
        this.controllerHandle = controllerHandle;
        this.extensionId = extensionId;
        this.threadId = threadId;
        this.resource = resource;
        this._range = _range;
        this._canReply = _canReply;
        this._isTemplate = _isTemplate;
        this.editorId = editorId;
        this._onDidChangeInput = new Emitter();
        this._onDidChangeLabel = new Emitter();
        this.onDidChangeLabel = this._onDidChangeLabel.event;
        this._onDidChangeComments = new Emitter();
        this._onDidChangeCanReply = new Emitter();
        this._collapsibleState = languages.CommentThreadCollapsibleState.Collapsed;
        this._onDidChangeCollapsibleState = new Emitter();
        this.onDidChangeCollapsibleState = this._onDidChangeCollapsibleState.event;
        this._onDidChangeInitialCollapsibleState = new Emitter();
        this.onDidChangeInitialCollapsibleState = this._onDidChangeInitialCollapsibleState.event;
        this._onDidChangeApplicability = new Emitter();
        this.onDidChangeApplicability = this._onDidChangeApplicability.event;
        this._onDidChangeState = new Emitter();
        this.onDidChangeState = this._onDidChangeState.event;
        this._isDisposed = false;
        if (_isTemplate) {
            this.comments = [];
        }
        else if (comments) {
            this._comments = comments;
        }
    }
    batchUpdate(changes) {
        const modified = (value) => Object.prototype.hasOwnProperty.call(changes, value);
        if (modified('range')) {
            this._range = changes.range;
        }
        if (modified('label')) {
            this._label = changes.label;
        }
        if (modified('contextValue')) {
            this._contextValue = changes.contextValue === null ? undefined : changes.contextValue;
        }
        if (modified('comments')) {
            this.comments = changes.comments;
        }
        if (modified('collapseState')) {
            this.collapsibleState = changes.collapseState;
        }
        if (modified('canReply')) {
            this.canReply = changes.canReply;
        }
        if (modified('state')) {
            this.state = changes.state;
        }
        if (modified('applicability')) {
            this.applicability = changes.applicability;
        }
        if (modified('isTemplate')) {
            this._isTemplate = changes.isTemplate;
        }
    }
    hasComments() {
        return !!this.comments && this.comments.length > 0;
    }
    dispose() {
        this._isDisposed = true;
        this._onDidChangeCollapsibleState.dispose();
        this._onDidChangeComments.dispose();
        this._onDidChangeInput.dispose();
        this._onDidChangeLabel.dispose();
        this._onDidChangeState.dispose();
    }
    toJSON() {
        return {
            $mid: 7 /* MarshalledId.CommentThread */,
            commentControlHandle: this.controllerHandle,
            commentThreadHandle: this.commentThreadHandle,
        };
    }
}
class CommentThreadWithDisposable {
    constructor(thread) {
        this.thread = thread;
        this.disposableStore = new DisposableStore();
    }
    dispose() {
        this.disposableStore.dispose();
    }
}
export class MainThreadCommentController extends Disposable {
    get handle() {
        return this._handle;
    }
    get id() {
        return this._id;
    }
    get contextValue() {
        return this._id;
    }
    get proxy() {
        return this._proxy;
    }
    get label() {
        return this._label;
    }
    get reactions() {
        return this._reactions;
    }
    set reactions(reactions) {
        this._reactions = reactions;
    }
    get options() {
        return this._features.options;
    }
    get features() {
        return this._features;
    }
    get owner() {
        return this._id;
    }
    constructor(_proxy, _commentService, _handle, _uniqueId, _id, _label, _features) {
        super();
        this._proxy = _proxy;
        this._commentService = _commentService;
        this._handle = _handle;
        this._uniqueId = _uniqueId;
        this._id = _id;
        this._label = _label;
        this._features = _features;
        this._threads = this._register(new DisposableMap());
    }
    get activeComment() {
        return this._activeComment;
    }
    async setActiveCommentAndThread(commentInfo) {
        this._activeComment = commentInfo;
        return this._proxy.$setActiveComment(this._handle, commentInfo ? { commentThreadHandle: commentInfo.thread.commentThreadHandle, uniqueIdInThread: commentInfo.comment?.uniqueIdInThread } : undefined);
    }
    updateFeatures(features) {
        this._features = features;
    }
    createCommentThread(extensionId, commentThreadHandle, threadId, resource, range, comments, isTemplate, editorId) {
        const thread = new MainThreadCommentThread(commentThreadHandle, this.handle, extensionId, threadId, URI.revive(resource).toString(), range, comments, true, isTemplate, editorId);
        const threadWithDisposable = new CommentThreadWithDisposable(thread);
        this._threads.set(commentThreadHandle, threadWithDisposable);
        threadWithDisposable.disposableStore.add(thread.onDidChangeCollapsibleState(() => {
            this.proxy.$updateCommentThread(this.handle, thread.commentThreadHandle, { collapseState: thread.collapsibleState });
        }));
        if (thread.isDocumentCommentThread()) {
            this._commentService.updateComments(this._uniqueId, {
                added: [thread],
                removed: [],
                changed: [],
                pending: []
            });
        }
        else {
            this._commentService.updateNotebookComments(this._uniqueId, {
                added: [thread],
                removed: [],
                changed: [],
                pending: []
            });
        }
        return thread;
    }
    updateCommentThread(commentThreadHandle, threadId, resource, changes) {
        const thread = this.getKnownThread(commentThreadHandle);
        thread.batchUpdate(changes);
        if (thread.isDocumentCommentThread()) {
            this._commentService.updateComments(this._uniqueId, {
                added: [],
                removed: [],
                changed: [thread],
                pending: []
            });
        }
        else {
            this._commentService.updateNotebookComments(this._uniqueId, {
                added: [],
                removed: [],
                changed: [thread],
                pending: []
            });
        }
    }
    deleteCommentThread(commentThreadHandle) {
        const thread = this.getKnownThread(commentThreadHandle);
        this._threads.deleteAndDispose(commentThreadHandle);
        thread.dispose();
        if (thread.isDocumentCommentThread()) {
            this._commentService.updateComments(this._uniqueId, {
                added: [],
                removed: [thread],
                changed: [],
                pending: []
            });
        }
        else {
            this._commentService.updateNotebookComments(this._uniqueId, {
                added: [],
                removed: [thread],
                changed: [],
                pending: []
            });
        }
    }
    deleteCommentThreadMain(commentThreadId) {
        for (const { thread } of this._threads.values()) {
            if (thread.threadId === commentThreadId) {
                this._proxy.$deleteCommentThread(this._handle, thread.commentThreadHandle);
            }
        }
    }
    updateInput(input) {
        const thread = this.activeEditingCommentThread;
        if (thread && thread.input) {
            const commentInput = thread.input;
            commentInput.value = input;
            thread.input = commentInput;
        }
    }
    updateCommentingRanges(resourceHints) {
        this._commentService.updateCommentingRanges(this._uniqueId, resourceHints);
    }
    getKnownThread(commentThreadHandle) {
        const thread = this._threads.get(commentThreadHandle);
        if (!thread) {
            throw new Error('unknown thread');
        }
        return thread.thread;
    }
    async getDocumentComments(resource, token) {
        if (resource.scheme === Schemas.vscodeNotebookCell) {
            return {
                uniqueOwner: this._uniqueId,
                label: this.label,
                threads: [],
                commentingRanges: {
                    resource: resource,
                    ranges: [],
                    fileComments: false
                }
            };
        }
        const ret = [];
        for (const thread of [...this._threads.keys()]) {
            const commentThread = this._threads.get(thread);
            if (commentThread.thread.resource === resource.toString()) {
                if (commentThread.thread.isDocumentCommentThread()) {
                    ret.push(commentThread.thread);
                }
            }
        }
        const commentingRanges = await this._proxy.$provideCommentingRanges(this.handle, resource, token);
        return {
            uniqueOwner: this._uniqueId,
            label: this.label,
            threads: ret,
            commentingRanges: {
                resource: resource,
                ranges: commentingRanges?.ranges || [],
                fileComments: !!commentingRanges?.fileComments
            }
        };
    }
    async getNotebookComments(resource, token) {
        if (resource.scheme !== Schemas.vscodeNotebookCell) {
            return {
                uniqueOwner: this._uniqueId,
                label: this.label,
                threads: []
            };
        }
        const ret = [];
        for (const thread of [...this._threads.keys()]) {
            const commentThread = this._threads.get(thread);
            if (commentThread.thread.resource === resource.toString()) {
                if (!commentThread.thread.isDocumentCommentThread()) {
                    ret.push(commentThread.thread);
                }
            }
        }
        return {
            uniqueOwner: this._uniqueId,
            label: this.label,
            threads: ret
        };
    }
    async toggleReaction(uri, thread, comment, reaction, token) {
        return this._proxy.$toggleReaction(this._handle, thread.commentThreadHandle, uri, comment, reaction);
    }
    getAllComments() {
        const ret = [];
        for (const thread of [...this._threads.keys()]) {
            ret.push(this._threads.get(thread).thread);
        }
        return ret;
    }
    createCommentThreadTemplate(resource, range, editorId) {
        return this._proxy.$createCommentThreadTemplate(this.handle, resource, range, editorId);
    }
    async updateCommentThreadTemplate(threadHandle, range) {
        await this._proxy.$updateCommentThreadTemplate(this.handle, threadHandle, range);
    }
    toJSON() {
        return {
            $mid: 6 /* MarshalledId.CommentController */,
            handle: this.handle
        };
    }
}
const commentsViewIcon = registerIcon('comments-view-icon', Codicon.commentDiscussion, localize('commentsViewIcon', 'View icon of the comments view.'));
let MainThreadComments = class MainThreadComments extends Disposable {
    constructor(extHostContext, _commentService, _viewsService, _viewDescriptorService, _uriIdentityService, _editorService) {
        super();
        this._commentService = _commentService;
        this._viewsService = _viewsService;
        this._viewDescriptorService = _viewDescriptorService;
        this._uriIdentityService = _uriIdentityService;
        this._editorService = _editorService;
        this._handlers = new Map();
        this._commentControllers = new Map();
        this._activeEditingCommentThreadDisposables = this._register(new DisposableStore());
        this._openViewListener = this._register(new MutableDisposable());
        this._onChangeContainerListener = this._register(new MutableDisposable());
        this._onChangeContainerLocationListener = this._register(new MutableDisposable());
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostComments);
        this._commentService.unregisterCommentController();
        this._register(this._commentService.onDidChangeActiveEditingCommentThread(async (thread) => {
            const handle = thread.controllerHandle;
            const controller = this._commentControllers.get(handle);
            if (!controller) {
                return;
            }
            this._activeEditingCommentThreadDisposables.clear();
            this._activeEditingCommentThread = thread;
            controller.activeEditingCommentThread = this._activeEditingCommentThread;
        }));
    }
    $registerCommentController(handle, id, label, extensionId) {
        const providerId = `${id}-${extensionId}`;
        this._handlers.set(handle, providerId);
        const provider = new MainThreadCommentController(this._proxy, this._commentService, handle, providerId, id, label, {});
        this._commentService.registerCommentController(providerId, provider);
        this._commentControllers.set(handle, provider);
        this._register(this._commentService.onResourceHasCommentingRanges(e => {
            this.registerView();
        }));
        this._register(this._commentService.onDidUpdateCommentThreads(e => {
            this.registerView();
        }));
        this._commentService.setWorkspaceComments(String(handle), []);
    }
    $unregisterCommentController(handle) {
        const providerId = this._handlers.get(handle);
        this._handlers.delete(handle);
        this._commentControllers.get(handle)?.dispose();
        this._commentControllers.delete(handle);
        if (typeof providerId !== 'string') {
            return;
            // throw new Error('unknown handler');
        }
        else {
            this._commentService.unregisterCommentController(providerId);
        }
    }
    $updateCommentControllerFeatures(handle, features) {
        const provider = this._commentControllers.get(handle);
        if (!provider) {
            return undefined;
        }
        provider.updateFeatures(features);
    }
    $createCommentThread(handle, commentThreadHandle, threadId, resource, range, comments, extensionId, isTemplate, editorId) {
        const provider = this._commentControllers.get(handle);
        if (!provider) {
            return undefined;
        }
        return provider.createCommentThread(extensionId.value, commentThreadHandle, threadId, resource, range, comments, isTemplate, editorId);
    }
    $updateCommentThread(handle, commentThreadHandle, threadId, resource, changes) {
        const provider = this._commentControllers.get(handle);
        if (!provider) {
            return undefined;
        }
        return provider.updateCommentThread(commentThreadHandle, threadId, resource, changes);
    }
    $deleteCommentThread(handle, commentThreadHandle) {
        const provider = this._commentControllers.get(handle);
        if (!provider) {
            return;
        }
        return provider.deleteCommentThread(commentThreadHandle);
    }
    $updateCommentingRanges(handle, resourceHints) {
        const provider = this._commentControllers.get(handle);
        if (!provider) {
            return;
        }
        provider.updateCommentingRanges(resourceHints);
    }
    async $revealCommentThread(handle, commentThreadHandle, commentUniqueIdInThread, options) {
        const provider = this._commentControllers.get(handle);
        if (!provider) {
            return Promise.resolve();
        }
        const thread = provider.getAllComments().find(thread => thread.commentThreadHandle === commentThreadHandle);
        if (!thread || !thread.isDocumentCommentThread()) {
            return Promise.resolve();
        }
        const comment = thread.comments?.find(comment => comment.uniqueIdInThread === commentUniqueIdInThread);
        revealCommentThread(this._commentService, this._editorService, this._uriIdentityService, thread, comment, options.focusReply, undefined, options.preserveFocus);
    }
    async $hideCommentThread(handle, commentThreadHandle) {
        const provider = this._commentControllers.get(handle);
        if (!provider) {
            return Promise.resolve();
        }
        const thread = provider.getAllComments().find(thread => thread.commentThreadHandle === commentThreadHandle);
        if (!thread || !thread.isDocumentCommentThread()) {
            return Promise.resolve();
        }
        thread.collapsibleState = languages.CommentThreadCollapsibleState.Collapsed;
    }
    registerView() {
        const commentsPanelAlreadyConstructed = !!this._viewDescriptorService.getViewDescriptorById(COMMENTS_VIEW_ID);
        if (!commentsPanelAlreadyConstructed) {
            const VIEW_CONTAINER = Registry.as(ViewExtensions.ViewContainersRegistry).registerViewContainer({
                id: COMMENTS_VIEW_ID,
                title: COMMENTS_VIEW_TITLE,
                ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [COMMENTS_VIEW_ID, { mergeViewWithContainerWhenSingleView: true }]),
                storageId: COMMENTS_VIEW_STORAGE_ID,
                hideIfEmpty: true,
                icon: commentsViewIcon,
                order: 10,
            }, 1 /* ViewContainerLocation.Panel */);
            Registry.as(ViewExtensions.ViewsRegistry).registerViews([{
                    id: COMMENTS_VIEW_ID,
                    name: COMMENTS_VIEW_TITLE,
                    canToggleVisibility: false,
                    ctorDescriptor: new SyncDescriptor(CommentsPanel),
                    canMoveView: true,
                    containerIcon: commentsViewIcon,
                    focusCommand: {
                        id: 'workbench.action.focusCommentsPanel'
                    }
                }], VIEW_CONTAINER);
        }
        this.registerViewListeners(commentsPanelAlreadyConstructed);
    }
    setComments() {
        [...this._commentControllers.keys()].forEach(handle => {
            const threads = this._commentControllers.get(handle).getAllComments();
            if (threads.length) {
                const providerId = this.getHandler(handle);
                this._commentService.setWorkspaceComments(providerId, threads);
            }
        });
    }
    registerViewOpenedListener() {
        if (!this._openViewListener.value) {
            this._openViewListener.value = this._viewsService.onDidChangeViewVisibility(e => {
                if (e.id === COMMENTS_VIEW_ID && e.visible) {
                    this.setComments();
                    if (this._openViewListener) {
                        this._openViewListener.dispose();
                    }
                }
            });
        }
    }
    /**
     * If the comments view has never been opened, the constructor for it has not yet run so it has
     * no listeners for comment threads being set or updated. Listen for the view opening for the
     * first time and send it comments then.
     */
    registerViewListeners(commentsPanelAlreadyConstructed) {
        if (!commentsPanelAlreadyConstructed) {
            this.registerViewOpenedListener();
        }
        if (!this._onChangeContainerListener.value) {
            this._onChangeContainerListener.value = this._viewDescriptorService.onDidChangeContainer(e => {
                if (e.views.find(view => view.id === COMMENTS_VIEW_ID)) {
                    this.setComments();
                    this.registerViewOpenedListener();
                }
            });
        }
        if (!this._onChangeContainerLocationListener.value) {
            this._onChangeContainerLocationListener.value = this._viewDescriptorService.onDidChangeContainerLocation(e => {
                const commentsContainer = this._viewDescriptorService.getViewContainerByViewId(COMMENTS_VIEW_ID);
                if (e.viewContainer.id === commentsContainer?.id) {
                    this.setComments();
                    this.registerViewOpenedListener();
                }
            });
        }
    }
    getHandler(handle) {
        if (!this._handlers.has(handle)) {
            throw new Error('Unknown handler');
        }
        return this._handlers.get(handle);
    }
};
MainThreadComments = __decorate([
    extHostNamedCustomer(MainContext.MainThreadComments),
    __param(1, ICommentService),
    __param(2, IViewsService),
    __param(3, IViewDescriptorService),
    __param(4, IUriIdentityService),
    __param(5, IEditorService)
], MainThreadComments);
export { MainThreadComments };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZENvbW1lbnRzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvYnJvd3Nlci9tYWluVGhyZWFkQ29tbWVudHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBZSxpQkFBaUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQy9ILE9BQU8sRUFBRSxHQUFHLEVBQWlCLE1BQU0sNkJBQTZCLENBQUM7QUFDakUsT0FBTyxFQUFVLEtBQUssRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3JFLE9BQU8sS0FBSyxTQUFTLE1BQU0scUNBQXFDLENBQUM7QUFFakUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxvQkFBb0IsRUFBbUIsTUFBTSxzREFBc0QsQ0FBQztBQUM3RyxPQUFPLEVBQXNCLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMvRSxPQUFPLEVBQWlELGNBQWMsRUFBRSxXQUFXLEVBQWlELE1BQU0sK0JBQStCLENBQUM7QUFDMUssT0FBTyxFQUFFLGdCQUFnQixFQUFFLHdCQUF3QixFQUFFLG1CQUFtQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdkksT0FBTyxFQUEwQyxVQUFVLElBQUksY0FBYyxFQUF5QyxzQkFBc0IsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzVLLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN2RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNu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