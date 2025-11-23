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
import './media/panel.css';
import * as nls from '../../../../nls.js';
import * as dom from '../../../../base/browser/dom.js';
import { basename } from '../../../../base/common/resources.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { CommentNode, ResourceWithCommentThreads } from '../common/commentModel.js';
import { ICommentService } from './commentService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ResourceLabels } from '../../../browser/labels.js';
import { CommentsList, COMMENTS_VIEW_TITLE, Filter } from './commentsTreeViewer.js';
import { FilterViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { CommentsViewFilterFocusContextKey } from './comments.js';
import { CommentsFilters } from './commentsViewActions.js';
import { Memento } from '../../../common/memento.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { FilterOptions } from './commentsFilterOptions.js';
import { CommentThreadApplicability, CommentThreadState } from '../../../../editor/common/languages.js';
import { revealCommentThread } from './commentsController.js';
import { registerNavigableContainer } from '../../../browser/actions/widgetNavigationCommands.js';
import { CommentsModel, threadHasMeaningfulComments } from './commentsModel.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { AccessibleViewAction } from '../../accessibility/browser/accessibleViewActions.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
export const CONTEXT_KEY_HAS_COMMENTS = new RawContextKey('commentsView.hasComments', false);
export const CONTEXT_KEY_SOME_COMMENTS_EXPANDED = new RawContextKey('commentsView.someCommentsExpanded', false);
export const CONTEXT_KEY_COMMENT_FOCUSED = new RawContextKey('commentsView.commentFocused', false);
const VIEW_STORAGE_ID = 'commentsViewState';
function createResourceCommentsIterator(model) {
    const result = [];
    for (const m of model.resourceCommentThreads) {
        const children = [];
        for (const r of m.commentThreads) {
            if (threadHasMeaningfulComments(r.thread)) {
                children.push({ element: r });
            }
        }
        if (children.length > 0) {
            result.push({ element: m, children });
        }
    }
    return result;
}
let CommentsPanel = class CommentsPanel extends FilterViewPane {
    get focusedCommentNode() {
        const focused = this.tree?.getFocus();
        if (focused?.length === 1 && focused[0] instanceof CommentNode) {
            return focused[0];
        }
        return undefined;
    }
    get focusedCommentInfo() {
        if (!this.focusedCommentNode) {
            return;
        }
        return this.getScreenReaderInfoForNode(this.focusedCommentNode);
    }
    focusNextNode() {
        if (!this.tree) {
            return;
        }
        const focused = this.tree.getFocus()?.[0];
        if (!focused) {
            return;
        }
        let next = this.tree.navigate(focused).next();
        while (next && !(next instanceof CommentNode)) {
            next = this.tree.navigate(next).next();
        }
        if (!next) {
            return;
        }
        this.tree.setFocus([next]);
    }
    focusPreviousNode() {
        if (!this.tree) {
            return;
        }
        const focused = this.tree.getFocus()?.[0];
        if (!focused) {
            return;
        }
        let previous = this.tree.navigate(focused).previous();
        while (previous && !(previous instanceof CommentNode)) {
            previous = this.tree.navigate(previous).previous();
        }
        if (!previous) {
            return;
        }
        this.tree.setFocus([previous]);
    }
    constructor(options, instantiationService, viewDescriptorService, editorService, configurationService, contextKeyService, contextMenuService, keybindingService, openerService, themeService, commentService, hoverService, uriIdentityService, storageService, pathService) {
        const stateMemento = new Memento(VIEW_STORAGE_ID, storageService);
        const viewState = stateMemento.getMemento(1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        super({
            ...options,
            filterOptions: {
                placeholder: nls.localize('comments.filter.placeholder', "Filter (e.g. text, author)"),
                ariaLabel: nls.localize('comments.filter.ariaLabel', "Filter comments"),
                history: viewState.filterHistory || [],
                text: viewState.filter || '',
                focusContextKey: CommentsViewFilterFocusContextKey.key
            }
        }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this.editorService = editorService;
        this.commentService = commentService;
        this.uriIdentityService = uriIdentityService;
        this.pathService = pathService;
        this.totalComments = 0;
        this.currentHeight = 0;
        this.currentWidth = 0;
        this.cachedFilterStats = undefined;
        this.onDidChangeVisibility = this.onDidChangeBodyVisibility;
        this.hasCommentsContextKey = CONTEXT_KEY_HAS_COMMENTS.bindTo(contextKeyService);
        this.someCommentsExpandedContextKey = CONTEXT_KEY_SOME_COMMENTS_EXPANDED.bindTo(contextKeyService);
        this.commentsFocusedContextKey = CONTEXT_KEY_COMMENT_FOCUSED.bindTo(contextKeyService);
        this.stateMemento = stateMemento;
        this.viewState = viewState;
        this.filters = this._register(new CommentsFilters({
            showResolved: this.viewState.showResolved !== false,
            showUnresolved: this.viewState.showUnresolved !== false,
            sortBy: this.viewState.sortBy ?? "resourceAscending" /* CommentsSortOrder.ResourceAscending */,
        }, this.contextKeyService));
        this.filter = new Filter(new FilterOptions(this.filterWidget.getFilterText(), this.filters.showResolved, this.filters.showUnresolved));
        this._register(this.filters.onDidChange((event) => {
            if (event.showResolved || event.showUnresolved) {
                this.updateFilter();
            }
            if (event.sortBy) {
                this.refresh();
            }
        }));
        this._register(this.filterWidget.onDidChangeFilterText(() => this.updateFilter()));
    }
    saveState() {
        this.viewState.filter = this.filterWidget.getFilterText();
        this.viewState.filterHistory = this.filterWidget.getHistory();
        this.viewState.showResolved = this.filters.showResolved;
        this.viewState.showUnresolved = this.filters.showUnresolved;
        this.viewState.sortBy = this.filters.sortBy;
        this.stateMemento.saveMemento();
        super.saveState();
    }
    render() {
        super.render();
        this._register(registerNavigableContainer({
            name: 'commentsView',
            focusNotifiers: [this, this.filterWidget],
            focusNextWidget: () => {
                if (this.filterWidget.hasFocus()) {
                    this.focus();
                }
            },
            focusPreviousWidget: () => {
                if (!this.filterWidget.hasFocus()) {
                    this.focusFilter();
                }
            }
        }));
    }
    focusFilter() {
        this.filterWidget.focus();
    }
    clearFilterText() {
        this.filterWidget.setFilterText('');
    }
    getFilterStats() {
        if (!this.cachedFilterStats) {
            this.cachedFilterStats = {
                total: this.totalComments,
                filtered: this.tree?.getVisibleItemCount() ?? 0
            };
        }
        return this.cachedFilterStats;
    }
    updateFilter() {
        this.filter.options = new FilterOptions(this.filterWidget.getFilterText(), this.filters.showResolved, this.filters.showUnresolved);
        this.tree?.filterComments();
        this.cachedFilterStats = undefined;
        const { total, filtered } = this.getFilterStats();
        this.filterWidget.updateBadge(total === filtered || total === 0 ? undefined : nls.localize('showing filtered results', "Showing {0} of {1}", filtered, total));
        this.filterWidget.checkMoreFilters(!this.filters.showResolved || !this.filters.showUnresolved);
    }
    renderBody(container) {
        super.renderBody(container);
        container.classList.add('comments-panel');
        const domContainer = dom.append(container, dom.$('.comments-panel-container'));
        this.treeContainer = dom.append(domContainer, dom.$('.tree-container'));
        this.treeContainer.classList.add('file-icon-themable-tree', 'show-file-icons');
        this.cachedFilterStats = undefined;
        this.createTree();
        this.createMessageBox(domContainer);
        this._register(this.commentService.onDidSetAllCommentThreads(this.onAllCommentsChanged, this));
        this._register(this.commentService.onDidUpdateCommentThreads(this.onCommentsUpdated, this));
        this._register(this.commentService.onDidDeleteDataProvider(this.onDataProviderDeleted, this));
        this._register(this.onDidChangeBodyVisibility(visible => {
            if (visible) {
                this.refresh();
            }
        }));
        this.renderComments();
    }
    focus() {
        super.focus();
        const element = this.tree?.getHTMLElement();
        if (element && dom.isActiveElement(element)) {
            return;
        }
        if (!this.commentService.commentsModel.hasCommentThreads() && this.messageBoxContainer) {
            this.messageBoxContainer.focus();
        }
        else if (this.tree) {
            this.tree.domFocus();
        }
    }
    renderComments() {
        this.treeContainer.classList.toggle('hidden', !this.commentService.commentsModel.hasCommentThreads());
        this.renderMessage();
        this.tree?.setChildren(null, createResourceCommentsIterator(this.commentService.commentsModel));
    }
    collapseAll() {
        if (this.tree) {
            this.tree.collapseAll();
            this.tree.setSelection([]);
            this.tree.setFocus([]);
            this.tree.domFocus();
            this.tree.focusFirst();
        }
    }
    expandAll() {
        if (this.tree) {
            this.tree.expandAll();
            this.tree.setSelection([]);
            this.tree.setFocus([]);
            this.tree.domFocus();
            this.tree.focusFirst();
        }
    }
    get hasRendered() {
        return !!this.tree;
    }
    layoutBodyContent(height = this.currentHeight, width = this.currentWidth) {
        if (this.messageBoxContainer) {
            this.messageBoxContainer.style.height = `${height}px`;
        }
        this.tree?.layout(height, width);
        this.currentHeight = height;
        this.currentWidth = width;
    }
    createMessageBox(parent) {
        this.messageBoxContainer = dom.append(parent, dom.$('.message-box-container'));
        this.messageBoxContainer.setAttribute('tabIndex', '0');
    }
    renderMessage() {
        this.messageBoxContainer.textContent = this.commentService.commentsModel.getMessage();
        this.messageBoxContainer.classList.toggle('hidden', this.commentService.commentsModel.hasCommentThreads());
    }
    makeCommentLocationLabel(file, range) {
        const fileLabel = basename(file);
        if (!range) {
            return nls.localize('fileCommentLabel', "in {0}", fileLabel);
        }
        if (range.startLineNumber === range.endLineNumber) {
            return nls.localize('oneLineCommentLabel', "at line {0} column {1} in {2}", range.startLineNumber, range.startColumn, fileLabel);
        }
        else {
            return nls.localize('multiLineCommentLabel', "from line {0} to line {1} in {2}", range.startLineNumber, range.endLineNumber, fileLabel);
        }
    }
    makeScreenReaderLabelInfo(element, forAriaLabel) {
        const userName = element.comment.userName;
        const locationLabel = this.makeCommentLocationLabel(element.resource, element.range);
        const replyCountLabel = this.getReplyCountAsString(element, forAriaLabel);
        const bodyLabel = (typeof element.comment.body === 'string') ? element.comment.body : element.comment.body.value;
        return { userName, locationLabel, replyCountLabel, bodyLabel };
    }
    getScreenReaderInfoForNode(element, forAriaLabel) {
        let accessibleViewHint = '';
        if (forAriaLabel && this.configurationService.getValue("accessibility.verbosity.comments" /* AccessibilityVerbositySettingId.Comments */)) {
            const kbLabel = this.keybindingService.lookupKeybinding(AccessibleViewAction.id)?.getAriaLabel();
            accessibleViewHint = kbLabel ? nls.localize('accessibleViewHint', "\nInspect this in the accessible view ({0}).", kbLabel) : nls.localize('acessibleViewHintNoKbOpen', "\nInspect this in the accessible view via the command Open Accessible View which is currently not triggerable via keybinding.");
        }
        const replies = this.getRepliesAsString(element, forAriaLabel);
        const editor = this.editorService.findEditors(element.resource);
        const codeEditor = this.editorService.activeEditorPane?.getControl();
        let relevantLines;
        if (element.range && editor?.length && isCodeEditor(codeEditor)) {
            relevantLines = codeEditor.getModel()?.getValueInRange(element.range);
            if (relevantLines) {
                relevantLines = '\nCorresponding code: \n' + relevantLines;
            }
        }
        if (!relevantLines) {
            relevantLines = '';
        }
        const labelInfo = this.makeScreenReaderLabelInfo(element, forAriaLabel);
        if (element.threadRelevance === CommentThreadApplicability.Outdated) {
            return nls.localize('resourceWithCommentLabelOutdated', "Outdated from {0}: {1}\n{2}\n{3}\n{4}", labelInfo.userName, labelInfo.bodyLabel, labelInfo.locationLabel, labelInfo.replyCountLabel, relevantLines) + replies + accessibleViewHint;
        }
        else {
            return nls.localize('resourceWithCommentLabel', "{0}: {1}\n{2}\n{3}\n{4}", labelInfo.userName, labelInfo.bodyLabel, labelInfo.locationLabel, labelInfo.replyCountLabel, relevantLines) + replies + accessibleViewHint;
        }
    }
    getRepliesAsString(node, forAriaLabel) {
        if (!node.replies.length || forAriaLabel) {
            return '';
        }
        return '\n' + node.replies.map(reply => nls.localize('resourceWithRepliesLabel', "{0} {1}", reply.comment.userName, (typeof reply.comment.body === 'string') ? reply.comment.body : reply.comment.body.value)).join('\n');
    }
    getReplyCountAsString(node, forAriaLabel) {
        return node.replies.length && !forAriaLabel ? nls.localize('replyCount', " {0} replies,", node.replies.length) : '';
    }
    createTree() {
        this.treeLabels = this._register(this.instantiationService.createInstance(ResourceLabels, this));
        this.tree = this._register(this.instantiationService.createInstance(CommentsList, this.treeLabels, this.treeContainer, {
            overrideStyles: this.getLocationBasedColors().listOverrideStyles,
            selectionNavigation: true,
            filter: this.filter,
            sorter: {
                compare: (a, b) => {
                    if (a instanceof CommentsModel || b instanceof CommentsModel) {
                        return 0;
                    }
                    if (this.filters.sortBy === "updatedAtDescending" /* CommentsSortOrder.UpdatedAtDescending */) {
                        return a.lastUpdatedAt > b.lastUpdatedAt ? -1 : 1;
                    }
                    else if (this.filters.sortBy === "resourceAscending" /* CommentsSortOrder.ResourceAscending */) {
                        if (a instanceof ResourceWithCommentThreads && b instanceof ResourceWithCommentThreads) {
                            const workspaceScheme = this.pathService.defaultUriScheme;
                            if ((a.resource.scheme !== b.resource.scheme) && (a.resource.scheme === workspaceScheme || b.resource.scheme === workspaceScheme)) {
                                // Workspace scheme should always come first
                                return b.resource.scheme === workspaceScheme ? 1 : -1;
                            }
                            return a.resource.toString() > b.resource.toString() ? 1 : -1;
                        }
                        else if (a instanceof CommentNode && b instanceof CommentNode && a.thread.range && b.thread.range) {
                            return a.thread.range?.startLineNumber > b.thread.range?.startLineNumber ? 1 : -1;
                        }
                    }
                    return 0;
                },
            },
            keyboardNavigationLabelProvider: {
                getKeyboardNavigationLabel: (item) => {
                    return undefined;
                }
            },
            accessibilityProvider: {
                getAriaLabel: (element) => {
                    if (element instanceof CommentsModel) {
                        return nls.localize('rootCommentsLabel', "Comments for current workspace");
                    }
                    if (element instanceof ResourceWithCommentThreads) {
                        return nls.localize('resourceWithCommentThreadsLabel', "Comments in {0}, full path {1}", basename(element.resource), element.resource.fsPath);
                    }
                    if (element instanceof CommentNode) {
                        return this.getScreenReaderInfoForNode(element, true);
                    }
                    return '';
                },
                getWidgetAriaLabel() {
                    return COMMENTS_VIEW_TITLE.value;
                }
            }
        }));
        this._register(this.tree.onDidOpen(e => {
            this.openFile(e.element, e.editorOptions.pinned, e.editorOptions.preserveFocus, e.sideBySide);
        }));
        this._register(this.tree.onDidChangeModel(() => {
            this.updateSomeCommentsExpanded();
        }));
        this._register(this.tree.onDidChangeCollapseState(() => {
            this.updateSomeCommentsExpanded();
        }));
        this._register(this.tree.onDidFocus(() => this.commentsFocusedContextKey.set(true)));
        this._register(this.tree.onDidBlur(() => this.commentsFocusedContextKey.set(false)));
    }
    openFile(element, pinned, preserveFocus, sideBySide) {
        if (!element) {
            return;
        }
        if (!(element instanceof ResourceWithCommentThreads || element instanceof CommentNode)) {
            return;
        }
        const threadToReveal = element instanceof ResourceWithCommentThreads ? element.commentThreads[0].thread : element.thread;
        const commentToReveal = element instanceof ResourceWithCommentThreads ? element.commentThreads[0].comment : undefined;
        return revealCommentThread(this.commentService, this.editorService, this.uriIdentityService, threadToReveal, commentToReveal, false, pinned, preserveFocus, sideBySide);
    }
    async refresh() {
        if (!this.tree) {
            return;
        }
        if (this.isVisible()) {
            this.hasCommentsContextKey.set(this.commentService.commentsModel.hasCommentThreads());
            this.cachedFilterStats = undefined;
            this.renderComments();
            if (this.tree.getSelection().length === 0 && this.commentService.commentsModel.hasCommentThreads()) {
                const firstComment = this.commentService.commentsModel.resourceCommentThreads[0].commentThreads[0];
                if (firstComment) {
                    this.tree.setFocus([firstComment]);
                    this.tree.setSelection([firstComment]);
                }
            }
        }
    }
    onAllCommentsChanged(e) {
        this.cachedFilterStats = undefined;
        this.totalComments += e.commentThreads.length;
        let unresolved = 0;
        for (const thread of e.commentThreads) {
            if (thread.state === CommentThreadState.Unresolved) {
                unresolved++;
            }
        }
        this.refresh();
    }
    onCommentsUpdated(e) {
        this.cachedFilterStats = undefined;
        this.totalComments += e.added.length;
        this.totalComments -= e.removed.length;
        let unresolved = 0;
        for (const resource of this.commentService.commentsModel.resourceCommentThreads) {
            for (const thread of resource.commentThreads) {
                if (thread.threadState === CommentThreadState.Unresolved) {
                    unresolved++;
                }
            }
        }
        this.refresh();
    }
    onDataProviderDeleted(owner) {
        this.cachedFilterStats = undefined;
        this.totalComments = 0;
        this.refresh();
    }
    updateSomeCommentsExpanded() {
        this.someCommentsExpandedContextKey.set(this.isSomeCommentsExpanded());
    }
    areAllCommentsExpanded() {
        if (!this.tree) {
            return false;
        }
        const navigator = this.tree.navigate();
        while (navigator.next()) {
            if (this.tree.isCollapsed(navigator.current())) {
                return false;
            }
        }
        return true;
    }
    isSomeCommentsExpanded() {
        if (!this.tree) {
            return false;
        }
        const navigator = this.tree.navigate();
        while (navigator.next()) {
            if (!this.tree.isCollapsed(navigator.current())) {
                return true;
            }
        }
        return false;
    }
};
CommentsPanel = __decorate([
    __param(1, IInstantiationService),
    __param(2, IViewDescriptorService),
    __param(3, IEditorService),
    __param(4, IConfigurationService),
    __param(5, IContextKeyService),
    __param(6, IContextMenuService),
    __param(7, IKeybindingService),
    __param(8, IOpenerService),
    __param(9, IThemeService),
    __param(10, ICommentService),
    __param(11, IHoverService),
    __param(12, IUriIdentityService),
    __param(13, IStorageService),
    __param(14, IPathService)
], CommentsPanel);
export { CommentsPanel };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWVudHNWaWV3LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NvbW1lbnRzL2Jyb3dzZXIvY29tbWVudHNWaWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sbUJBQW1CLENBQUM7QUFDM0IsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUMxQyxPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFFLFdBQVcsRUFBOEIsMEJBQTBCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUNoSCxPQUFPLEVBQUUsZUFBZSxFQUFpQyxNQUFNLHFCQUFxQixDQUFDO0FBQ3JGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNsRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDNUQsT0FBTyxFQUFFLFlBQVksRUFBRSxtQkFBbUIsRUFBRSxNQUFNLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUNwRixPQUFPLEVBQW9CLGNBQWMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQzVGLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ2xFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBZSxrQkFBa0IsRUFBRSxhQUFhLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN0SCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFB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