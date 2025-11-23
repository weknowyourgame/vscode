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
import * as dom from '../../../../../base/browser/dom.js';
import { $ } from '../../../../../base/browser/dom.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IChatService } from '../../common/chatService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { ButtonWithIcon } from '../../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { URI } from '../../../../../base/common/uri.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { ResourcePool } from './chatCollections.js';
import { ResourceLabels } from '../../../../browser/labels.js';
import { FileKind } from '../../../../../platform/files/common/files.js';
import { createFileIconThemableTreeContainerScope } from '../../../files/browser/views/explorerView.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { autorun, derived } from '../../../../../base/common/observable.js';
import { MultiDiffEditorInput } from '../../../multiDiffEditor/browser/multiDiffEditorInput.js';
import { MultiDiffEditorItem } from '../../../multiDiffEditor/browser/multiDiffSourceResolverService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { Emitter } from '../../../../../base/common/event.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { localize2 } from '../../../../../nls.js';
import { LocalChatSessionUri } from '../../common/chatUri.js';
let ChatCheckpointFileChangesSummaryContentPart = class ChatCheckpointFileChangesSummaryContentPart extends Disposable {
    constructor(content, context, hoverService, chatService, editorService, editorGroupsService, instantiationService) {
        super();
        this.hoverService = hoverService;
        this.chatService = chatService;
        this.editorService = editorService;
        this.editorGroupsService = editorGroupsService;
        this.instantiationService = instantiationService;
        this.ELEMENT_HEIGHT = 22;
        this.MAX_ITEMS_SHOWN = 6;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this.diffsBetweenRequests = new Map();
        this.isCollapsed = true;
        this.fileChanges = content.fileChanges;
        this.fileChangesDiffsObservable = this.computeFileChangesDiffs(context, content.fileChanges);
        const headerDomNode = $('.checkpoint-file-changes-summary-header');
        this.domNode = $('.checkpoint-file-changes-summary', undefined, headerDomNode);
        this.domNode.tabIndex = 0;
        this._register(this.renderHeader(headerDomNode));
        this._register(this.renderFilesList(this.domNode));
    }
    changeID(change) {
        return `${change.sessionId}-${change.requestId}-${change.reference.path}`;
    }
    computeFileChangesDiffs(context, changes) {
        return derived((r) => {
            const fileChangesDiffs = new Map();
            const firstRequestId = changes[0].requestId;
            const lastRequestId = changes[changes.length - 1].requestId;
            for (const change of changes) {
                const sessionId = change.sessionId;
                const session = this.chatService.getSession(LocalChatSessionUri.forSession(sessionId));
                if (!session || !session.editingSession) {
                    continue;
                }
                const diff = this.getCachedEntryDiffBetweenRequests(session.editingSession, change.reference, firstRequestId, lastRequestId)?.read(r);
                if (!diff) {
                    continue;
                }
                fileChangesDiffs.set(this.changeID(change), diff);
            }
            return fileChangesDiffs;
        });
    }
    getCachedEntryDiffBetweenRequests(editSession, uri, startRequestId, stopRequestId) {
        const key = `${uri}\0${startRequestId}\0${stopRequestId}`;
        let observable = this.diffsBetweenRequests.get(key);
        if (!observable) {
            observable = editSession.getEntryDiffBetweenRequests(uri, startRequestId, stopRequestId);
            this.diffsBetweenRequests.set(key, observable);
        }
        return observable;
    }
    renderHeader(container) {
        const viewListButtonContainer = container.appendChild($('.chat-file-changes-label'));
        const viewListButton = new ButtonWithIcon(viewListButtonContainer, {});
        viewListButton.label = this.fileChanges.length === 1 ? `Changed 1 file` : `Changed ${this.fileChanges.length} files`;
        const setExpansionState = () => {
            viewListButton.icon = this.isCollapsed ? Codicon.chevronRight : Codicon.chevronDown;
            this.domNode.classList.toggle('chat-file-changes-collapsed', this.isCollapsed);
            this._onDidChangeHeight.fire();
        };
        setExpansionState();
        const disposables = new DisposableStore();
        disposables.add(viewListButton);
        disposables.add(viewListButton.onDidClick(() => {
            this.isCollapsed = !this.isCollapsed;
            setExpansionState();
        }));
        disposables.add(this.renderViewAllFileChangesButton(viewListButton.element));
        return toDisposable(() => disposables.dispose());
    }
    renderViewAllFileChangesButton(container) {
        const button = container.appendChild($('.chat-view-changes-icon'));
        this.hoverService.setupDelayedHover(button, () => ({
            content: localize2('chat.viewFileChangesSummary', 'View All File Changes')
        }));
        button.classList.add(...ThemeIcon.asClassNameArray(Codicon.diffMultiple));
        button.setAttribute('role', 'button');
        button.tabIndex = 0;
        return dom.addDisposableListener(button, 'click', (e) => {
            const resources = [];
            for (const fileChange of this.fileChanges) {
                const diffEntry = this.fileChangesDiffsObservable.get().get(this.changeID(fileChange));
                if (diffEntry) {
                    resources.push({
                        originalUri: diffEntry.originalURI,
                        modifiedUri: diffEntry.modifiedURI
                    });
                }
                else {
                    resources.push({
                        originalUri: fileChange.reference
                    });
                }
            }
            const source = URI.parse(`multi-diff-editor:${new Date().getMilliseconds().toString() + Math.random().toString()}`);
            const input = this.instantiationService.createInstance(MultiDiffEditorInput, source, 'Checkpoint File Changes', resources.map(resource => {
                return new MultiDiffEditorItem(resource.originalUri, resource.modifiedUri, undefined);
            }), false);
            this.editorGroupsService.activeGroup.openEditor(input);
            dom.EventHelper.stop(e, true);
        });
    }
    renderFilesList(container) {
        const store = new DisposableStore();
        this.list = store.add(this.instantiationService.createInstance(CollapsibleChangesSummaryListPool)).get();
        const listNode = this.list.getHTMLElement();
        const itemsShown = Math.min(this.fileChanges.length, this.MAX_ITEMS_SHOWN);
        const height = itemsShown * this.ELEMENT_HEIGHT;
        this.list.layout(height);
        listNode.style.height = height + 'px';
        this.updateList(this.fileChanges, this.fileChangesDiffsObservable.get());
        container.appendChild(listNode.parentElement);
        store.add(this.list.onDidOpen((item) => {
            const element = item.element;
            if (!element) {
                return;
            }
            const diff = this.fileChangesDiffsObservable.get().get(this.changeID(element));
            if (diff) {
                const input = {
                    original: { resource: diff.originalURI },
                    modified: { resource: diff.modifiedURI },
                    options: { preserveFocus: true }
                };
                this.editorService.openEditor(input);
            }
            else {
                this.editorService.openEditor({ resource: element.reference, options: { preserveFocus: true } });
            }
        }));
        store.add(this.list.onContextMenu(e => {
            dom.EventHelper.stop(e.browserEvent, true);
        }));
        store.add(autorun((r) => {
            this.updateList(this.fileChanges, this.fileChangesDiffsObservable.read(r));
        }));
        return store;
    }
    updateList(fileChanges, fileChangesDiffs) {
        this.list.splice(0, this.list.length, this.computeFileChangeSummaryItems(fileChanges, fileChangesDiffs));
    }
    computeFileChangeSummaryItems(fileChanges, fileChangesDiffs) {
        const items = [];
        for (const fileChange of fileChanges) {
            const diffEntry = fileChangesDiffs.get(this.changeID(fileChange));
            if (diffEntry) {
                const additionalLabels = [];
                if (diffEntry) {
                    additionalLabels.push({
                        description: ` +${diffEntry.added} `,
                        className: 'insertions',
                    });
                    additionalLabels.push({
                        description: ` -${diffEntry.removed} `,
                        className: 'deletions',
                    });
                }
                const item = {
                    ...fileChange,
                    additionalLabels
                };
                items.push(item);
            }
            else {
                items.push(fileChange);
            }
        }
        return items;
    }
    hasSameContent(other, followingContent, element) {
        return other.kind === 'changesSummary' && other.fileChanges.length === this.fileChanges.length;
    }
    addDisposable(disposable) {
        this._register(disposable);
    }
};
ChatCheckpointFileChangesSummaryContentPart = __decorate([
    __param(2, IHoverService),
    __param(3, IChatService),
    __param(4, IEditorService),
    __param(5, IEditorGroupsService),
    __param(6, IInstantiationService)
], ChatCheckpointFileChangesSummaryContentPart);
export { ChatCheckpointFileChangesSummaryContentPart };
let CollapsibleChangesSummaryListPool = class CollapsibleChangesSummaryListPool extends Disposable {
    constructor(instantiationService, themeService) {
        super();
        this.instantiationService = instantiationService;
        this.themeService = themeService;
        this._resourcePool = this._register(new ResourcePool(() => this.listFactory()));
    }
    listFactory() {
        const container = $('.chat-summary-list');
        const store = new DisposableStore();
        store.add(createFileIconThemableTreeContainerScope(container, this.themeService));
        const resourceLabels = store.add(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: () => Disposable.None }));
        const list = store.add(this.instantiationService.createInstance((WorkbenchList), 'ChatListRenderer', container, new CollapsibleChangesSummaryListDelegate(), [this.instantiationService.createInstance(CollapsibleChangesSummaryListRenderer, resourceLabels)], {
            alwaysConsumeMouseWheel: false
        }));
        return {
            list: list,
            dispose: () => {
                store.dispose();
            }
        };
    }
    get() {
        return this._resourcePool.get().list;
    }
};
CollapsibleChangesSummaryListPool = __decorate([
    __param(0, IInstantiationService),
    __param(1, IThemeService)
], CollapsibleChangesSummaryListPool);
class CollapsibleChangesSummaryListDelegate {
    getHeight(element) {
        return 22;
    }
    getTemplateId(element) {
        return CollapsibleChangesSummaryListRenderer.TEMPLATE_ID;
    }
}
class CollapsibleChangesSummaryListRenderer {
    static { this.TEMPLATE_ID = 'collapsibleChangesSummaryListRenderer'; }
    static { this.CHANGES_SUMMARY_CLASS_NAME = 'insertions-and-deletions'; }
    constructor(labels) {
        this.labels = labels;
        this.templateId = CollapsibleChangesSummaryListRenderer.TEMPLATE_ID;
    }
    renderTemplate(container) {
        const label = this.labels.create(container, { supportHighlights: true, supportIcons: true });
        return { label, dispose: () => label.dispose() };
    }
    renderElement(data, index, templateData) {
        const label = templateData.label;
        label.setFile(data.reference, {
            fileKind: FileKind.FILE,
            title: data.reference.path
        });
        const labelElement = label.element;
        // eslint-disable-next-line no-restricted-syntax
        labelElement.querySelector(`.${CollapsibleChangesSummaryListRenderer.CHANGES_SUMMARY_CLASS_NAME}`)?.remove();
        if (!data.additionalLabels) {
            return;
        }
        const changesSummary = labelElement.appendChild($(`.${CollapsibleChangesSummaryListRenderer.CHANGES_SUMMARY_CLASS_NAME}`));
        for (const additionalLabel of data.additionalLabels) {
            const element = changesSummary.appendChild($(`.${additionalLabel.className}`));
            element.textContent = additionalLabel.description;
        }
    }
    disposeTemplate(templateData) {
        templateData.dispose();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdENoYW5nZXNTdW1tYXJ5UGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy9jaGF0Q2hhbmdlc1N1bW1hcnlQYXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBSWpILE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBa0QsWUFBWSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDM0csT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBRXJGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNwRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0saURBQWlELENBQUM7QUFDakYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ3BELE9BQU8sRUFBa0IsY0FBYyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFL0UsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSx3Q0FBd0MsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FB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