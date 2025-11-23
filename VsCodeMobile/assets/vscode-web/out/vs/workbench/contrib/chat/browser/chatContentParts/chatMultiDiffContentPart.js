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
import { ActionBar } from '../../../../../base/browser/ui/actionbar/actionbar.js';
import { ButtonWithIcon } from '../../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize } from '../../../../../nls.js';
import { IMenuService, MenuId } from '../../../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { FileKind } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { ResourceLabels } from '../../../../browser/labels.js';
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from '../../../../services/editor/common/editorService.js';
import { createFileIconThemableTreeContainerScope } from '../../../files/browser/views/explorerView.js';
import { MultiDiffEditorInput } from '../../../multiDiffEditor/browser/multiDiffEditorInput.js';
import { MultiDiffEditorItem } from '../../../multiDiffEditor/browser/multiDiffSourceResolverService.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { ChatEditorInput } from '../chatEditorInput.js';
const $ = dom.$;
const ELEMENT_HEIGHT = 22;
const MAX_ITEMS_SHOWN = 6;
let ChatMultiDiffContentPart = class ChatMultiDiffContentPart extends Disposable {
    constructor(content, _element, instantiationService, editorService, themeService, menuService, contextKeyService) {
        super();
        this.content = content;
        this.instantiationService = instantiationService;
        this.editorService = editorService;
        this.themeService = themeService;
        this.menuService = menuService;
        this.contextKeyService = contextKeyService;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this.isCollapsed = false;
        this.readOnly = content.readOnly ?? false;
        const headerDomNode = $('.checkpoint-file-changes-summary-header');
        this.domNode = $('.checkpoint-file-changes-summary', undefined, headerDomNode);
        this.domNode.tabIndex = 0;
        this._register(this.renderHeader(headerDomNode));
        this._register(this.renderFilesList(this.domNode));
    }
    renderHeader(container) {
        const fileCount = this.content.multiDiffData.resources.length;
        const viewListButtonContainer = container.appendChild($('.chat-file-changes-label'));
        const viewListButton = new ButtonWithIcon(viewListButtonContainer, {});
        viewListButton.label = fileCount === 1
            ? localize('chatMultiDiff.oneFile', 'Changed 1 file')
            : localize('chatMultiDiff.manyFiles', 'Changed {0} files', fileCount);
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
        if (!this.readOnly) {
            disposables.add(this.renderViewAllFileChangesButton(viewListButton.element));
        }
        disposables.add(this.renderContributedButtons(viewListButton.element));
        return toDisposable(() => disposables.dispose());
    }
    renderViewAllFileChangesButton(container) {
        const button = container.appendChild($('.chat-view-changes-icon'));
        button.classList.add(...ThemeIcon.asClassNameArray(Codicon.diffMultiple));
        button.title = localize('chatMultiDiff.openAllChanges', 'Open Changes');
        return dom.addDisposableListener(button, 'click', (e) => {
            const source = URI.parse(`multi-diff-editor:${new Date().getMilliseconds().toString() + Math.random().toString()}`);
            const input = this.instantiationService.createInstance(MultiDiffEditorInput, source, this.content.multiDiffData.title || 'Multi-Diff', this.content.multiDiffData.resources.map(resource => new MultiDiffEditorItem(resource.originalUri, resource.modifiedUri, resource.goToFileUri)), false);
            const sideBySide = e.altKey;
            this.editorService.openEditor(input, sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
            dom.EventHelper.stop(e, true);
        });
    }
    renderContributedButtons(container) {
        const buttonsContainer = container.appendChild($('.chat-multidiff-contributed-buttons'));
        const disposables = new DisposableStore();
        const actionBar = disposables.add(new ActionBar(buttonsContainer, {
            orientation: 0 /* ActionsOrientation.HORIZONTAL */
        }));
        const setupActionBar = () => {
            actionBar.clear();
            let marshalledUri = undefined;
            let contextKeyService = this.contextKeyService;
            if (this.editorService.activeEditor instanceof ChatEditorInput) {
                contextKeyService = this.contextKeyService.createOverlay([
                    [ChatContextKeys.sessionType.key, this.editorService.activeEditor.getSessionType()]
                ]);
                marshalledUri = {
                    ...this.editorService.activeEditor.resource,
                    $mid: 1 /* MarshalledId.Uri */
                };
            }
            const actions = this.menuService.getMenuActions(MenuId.ChatMultiDiffContext, contextKeyService, { arg: marshalledUri, shouldForwardArgs: true });
            const allActions = actions.flatMap(([, actions]) => actions);
            if (allActions.length > 0) {
                actionBar.push(allActions, { icon: true, label: false });
            }
        };
        setupActionBar();
        return disposables;
    }
    renderFilesList(container) {
        const store = new DisposableStore();
        const listContainer = container.appendChild($('.chat-summary-list'));
        store.add(createFileIconThemableTreeContainerScope(listContainer, this.themeService));
        const resourceLabels = store.add(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: Event.None }));
        this.list = store.add(this.instantiationService.createInstance((WorkbenchList), 'ChatMultiDiffList', listContainer, new ChatMultiDiffListDelegate(), [this.instantiationService.createInstance(ChatMultiDiffListRenderer, resourceLabels)], {
            identityProvider: {
                getId: (element) => element.uri.toString()
            },
            setRowLineHeight: true,
            horizontalScrolling: false,
            supportDynamicHeights: false,
            mouseSupport: !this.readOnly,
            alwaysConsumeMouseWheel: false,
            accessibilityProvider: {
                getAriaLabel: (element) => element.uri.path,
                getWidgetAriaLabel: () => localize('chatMultiDiffList', "File Changes")
            }
        }));
        const items = [];
        for (const resource of this.content.multiDiffData.resources) {
            const uri = resource.modifiedUri || resource.originalUri || resource.goToFileUri;
            if (!uri) {
                continue;
            }
            const item = { uri };
            if (resource.originalUri && resource.modifiedUri) {
                item.diff = {
                    originalURI: resource.originalUri,
                    modifiedURI: resource.modifiedUri,
                    isFinal: true,
                    quitEarly: false,
                    identical: false,
                    added: resource.added || 0,
                    removed: resource.removed || 0
                };
            }
            items.push(item);
        }
        this.list.splice(0, this.list.length, items);
        const height = Math.min(items.length, MAX_ITEMS_SHOWN) * ELEMENT_HEIGHT;
        this.list.layout(height);
        listContainer.style.height = `${height}px`;
        if (!this.readOnly) {
            store.add(this.list.onDidOpen((e) => {
                if (!e.element) {
                    return;
                }
                if (e.element.diff) {
                    this.editorService.openEditor({
                        original: { resource: e.element.diff.originalURI },
                        modified: { resource: e.element.diff.modifiedURI },
                        options: { preserveFocus: true }
                    });
                }
                else {
                    this.editorService.openEditor({
                        resource: e.element.uri,
                        options: { preserveFocus: true }
                    });
                }
            }));
        }
        return store;
    }
    hasSameContent(other) {
        return other.kind === 'multiDiffData' &&
            other.multiDiffData?.resources?.length === this.content.multiDiffData.resources.length;
    }
    addDisposable(disposable) {
        this._register(disposable);
    }
};
ChatMultiDiffContentPart = __decorate([
    __param(2, IInstantiationService),
    __param(3, IEditorService),
    __param(4, IThemeService),
    __param(5, IMenuService),
    __param(6, IContextKeyService)
], ChatMultiDiffContentPart);
export { ChatMultiDiffContentPart };
class ChatMultiDiffListDelegate {
    getHeight() {
        return 22;
    }
    getTemplateId() {
        return 'chatMultiDiffItem';
    }
}
class ChatMultiDiffListRenderer {
    static { this.TEMPLATE_ID = 'chatMultiDiffItem'; }
    static { this.CHANGES_SUMMARY_CLASS_NAME = 'insertions-and-deletions'; }
    constructor(labels) {
        this.labels = labels;
        this.templateId = ChatMultiDiffListRenderer.TEMPLATE_ID;
    }
    renderTemplate(container) {
        const label = this.labels.create(container, { supportHighlights: true, supportIcons: true });
        return {
            label,
            dispose: () => label.dispose()
        };
    }
    renderElement(element, _index, templateData) {
        templateData.label.setFile(element.uri, {
            fileKind: FileKind.FILE,
            title: element.uri.path
        });
        const labelElement = templateData.label.element;
        // eslint-disable-next-line no-restricted-syntax
        labelElement.querySelector(`.${ChatMultiDiffListRenderer.CHANGES_SUMMARY_CLASS_NAME}`)?.remove();
        if (element.diff?.added || element.diff?.removed) {
            const changesSummary = labelElement.appendChild($(`.${ChatMultiDiffListRenderer.CHANGES_SUMMARY_CLASS_NAME}`));
            const addedElement = changesSummary.appendChild($('.insertions'));
            addedElement.textContent = `+${element.diff.added}`;
            const removedElement = changesSummary.appendChild($('.deletions'));
            removedElement.textContent = `-${element.diff.removed}`;
            changesSummary.setAttribute('aria-label', localize('chatEditingSession.fileCounts', '{0} lines added, {1} lines removed', element.diff.added, element.diff.removed));
        }
    }
    disposeTemplate(templateData) {
        templateData.dispose();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE11bHRpRGlmZkNvbnRlbnRQYXJ0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGVudFBhcnRzL2NoYXRNdWx0aURpZmZDb250ZW50UGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9DQUFvQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxTQUFTLEVBQXNCLE1BQU0sdURBQXVELENBQUM7QUFDdEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBRWpGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRWpILE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDekYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDN0YsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNwRixPQUFPLEVBQUUsYUFBYSxF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