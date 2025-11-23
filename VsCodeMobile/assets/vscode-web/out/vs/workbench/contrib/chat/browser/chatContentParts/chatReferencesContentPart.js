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
var CollapsibleListRenderer_1;
import * as dom from '../../../../../base/browser/dom.js';
import { coalesce } from '../../../../../base/common/arrays.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { matchesSomeScheme, Schemas } from '../../../../../base/common/network.js';
import { basename } from '../../../../../base/common/path.js';
import { basenameOrAuthority, isEqualAuthority } from '../../../../../base/common/resources.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../../nls.js';
import { getFlatContextMenuActions } from '../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { MenuWorkbenchToolBar } from '../../../../../platform/actions/browser/toolbar.js';
import { Action2, IMenuService, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { FileKind } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { isDark } from '../../../../../platform/theme/common/theme.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { fillEditorsDragData } from '../../../../browser/dnd.js';
import { ResourceLabels } from '../../../../browser/labels.js';
import { ResourceContextKey } from '../../../../common/contextkeys.js';
import { SETTINGS_AUTHORITY } from '../../../../services/preferences/common/preferences.js';
import { createFileIconThemableTreeContainerScope } from '../../../files/browser/views/explorerView.js';
import { ExplorerFolderContext } from '../../../files/common/files.js';
import { chatEditingWidgetFileStateContextKey } from '../../common/chatEditingService.js';
import { ChatResponseReferencePartStatusKind } from '../../common/chatService.js';
import { IChatWidgetService } from '../chat.js';
import { ChatCollapsibleContentPart } from './chatCollapsibleContentPart.js';
import { ResourcePool } from './chatCollections.js';
const $ = dom.$;
let ChatCollapsibleListContentPart = class ChatCollapsibleListContentPart extends ChatCollapsibleContentPart {
    constructor(data, labelOverride, context, contentReferencesListPool, openerService, menuService, instantiationService, contextMenuService) {
        super(labelOverride ?? (data.length > 1 ?
            localize('usedReferencesPlural', "Used {0} references", data.length) :
            localize('usedReferencesSingular', "Used {0} reference", 1)), context);
        this.data = data;
        this.contentReferencesListPool = contentReferencesListPool;
        this.openerService = openerService;
        this.menuService = menuService;
        this.instantiationService = instantiationService;
        this.contextMenuService = contextMenuService;
    }
    initContent() {
        const ref = this._register(this.contentReferencesListPool.get());
        const list = ref.object;
        this._register(list.onDidOpen((e) => {
            if (e.element && 'reference' in e.element && typeof e.element.reference === 'object') {
                const uriOrLocation = 'variableName' in e.element.reference ? e.element.reference.value : e.element.reference;
                const uri = URI.isUri(uriOrLocation) ? uriOrLocation :
                    uriOrLocation?.uri;
                if (uri) {
                    this.openerService.open(uri, {
                        fromUserGesture: true,
                        editorOptions: {
                            ...e.editorOptions,
                            ...{
                                selection: uriOrLocation && 'range' in uriOrLocation ? uriOrLocation.range : undefined
                            }
                        }
                    });
                }
            }
        }));
        this._register(list.onContextMenu(e => {
            dom.EventHelper.stop(e.browserEvent, true);
            const uri = e.element && getResourceForElement(e.element);
            if (!uri) {
                return;
            }
            this.contextMenuService.showContextMenu({
                getAnchor: () => e.anchor,
                getActions: () => {
                    const menu = this.menuService.getMenuActions(MenuId.ChatAttachmentsContext, list.contextKeyService, { shouldForwardArgs: true, arg: uri });
                    return getFlatContextMenuActions(menu);
                }
            });
        }));
        const resourceContextKey = this._register(this.instantiationService.createInstance(ResourceContextKey));
        this._register(list.onDidChangeFocus(e => {
            resourceContextKey.reset();
            const element = e.elements.length ? e.elements[0] : undefined;
            const uri = element && getResourceForElement(element);
            resourceContextKey.set(uri ?? null);
        }));
        const maxItemsShown = 6;
        const itemsShown = Math.min(this.data.length, maxItemsShown);
        const height = itemsShown * 22;
        list.layout(height);
        list.getHTMLElement().style.height = `${height}px`;
        list.splice(0, list.length, this.data);
        return list.getHTMLElement().parentElement;
    }
    hasSameContent(other, followingContent, element) {
        return other.kind === 'references' && other.references.length === this.data.length && (!!followingContent.length === this.hasFollowingContent);
    }
};
ChatCollapsibleListContentPart = __decorate([
    __param(4, IOpenerService),
    __param(5, IMenuService),
    __param(6, IInstantiationService),
    __param(7, IContextMenuService)
], ChatCollapsibleListContentPart);
export { ChatCollapsibleListContentPart };
let ChatUsedReferencesListContentPart = class ChatUsedReferencesListContentPart extends ChatCollapsibleListContentPart {
    constructor(data, labelOverride, context, contentReferencesListPool, options, openerService, menuService, instantiationService, contextMenuService) {
        super(data, labelOverride, context, contentReferencesListPool, openerService, menuService, instantiationService, contextMenuService);
        this.options = options;
        if (data.length === 0) {
            dom.hide(this.domNode);
        }
    }
    isExpanded() {
        const element = this.context.element;
        return element.usedReferencesExpanded ?? !!(this.options.expandedWhenEmptyResponse && element.response.value.length === 0);
    }
    setExpanded(value) {
        const element = this.context.element;
        element.usedReferencesExpanded = !this.isExpanded();
    }
};
ChatUsedReferencesListContentPart = __decorate([
    __param(5, IOpenerService),
    __param(6, IMenuService),
    __param(7, IInstantiationService),
    __param(8, IContextMenuService)
], ChatUsedReferencesListContentPart);
export { ChatUsedReferencesListContentPart };
let CollapsibleListPool = class CollapsibleListPool extends Disposable {
    get inUse() {
        return this._pool.inUse;
    }
    constructor(_onDidChangeVisibility, menuId, listOptions, instantiationService, themeService, labelService) {
        super();
        this._onDidChangeVisibility = _onDidChangeVisibility;
        this.menuId = menuId;
        this.listOptions = listOptions;
        this.instantiationService = instantiationService;
        this.themeService = themeService;
        this.labelService = labelService;
        this._pool = this._register(new ResourcePool(() => this.listFactory()));
    }
    listFactory() {
        const resourceLabels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this._onDidChangeVisibility }));
        const container = $('.chat-used-context-list');
        this._register(createFileIconThemableTreeContainerScope(container, this.themeService));
        const list = this.instantiationService.createInstance((WorkbenchList), 'ChatListRenderer', container, new CollapsibleListDelegate(), [this.instantiationService.createInstance(CollapsibleListRenderer, resourceLabels, this.menuId)], {
            ...this.listOptions,
            alwaysConsumeMouseWheel: false,
            accessibilityProvider: {
                getAriaLabel: (element) => {
                    if (element.kind === 'warning') {
                        return element.content.value;
                    }
                    const reference = element.reference;
                    if (typeof reference === 'string') {
                        return reference;
                    }
                    else if ('variableName' in reference) {
                        return reference.variableName;
                    }
                    else if (URI.isUri(reference)) {
                        return basename(reference.path);
                    }
                    else {
                        return basename(reference.uri.path);
                    }
                },
                getWidgetAriaLabel: () => localize('chatCollapsibleList', "Collapsible Chat References List")
            },
            dnd: {
                getDragURI: (element) => getResourceForElement(element)?.toString() ?? null,
                getDragLabel: (elements, originalEvent) => {
                    const uris = coalesce(elements.map(getResourceForElement));
                    if (!uris.length) {
                        return undefined;
                    }
                    else if (uris.length === 1) {
                        return this.labelService.getUriLabel(uris[0], { relative: true });
                    }
                    else {
                        return `${uris.length}`;
                    }
                },
                dispose: () => { },
                onDragOver: () => false,
                drop: () => { },
                onDragStart: (data, originalEvent) => {
                    try {
                        const elements = data.getData();
                        const uris = coalesce(elements.map(getResourceForElement));
                        this.instantiationService.invokeFunction(accessor => fillEditorsDragData(accessor, uris, originalEvent));
                    }
                    catch {
                        // noop
                    }
                },
            },
        });
        return list;
    }
    get() {
        const object = this._pool.get();
        let stale = false;
        return {
            object,
            isStale: () => stale,
            dispose: () => {
                stale = true;
                this._pool.release(object);
            }
        };
    }
};
CollapsibleListPool = __decorate([
    __param(3, IInstantiationService),
    __param(4, IThemeService),
    __param(5, ILabelService)
], CollapsibleListPool);
export { CollapsibleListPool };
class CollapsibleListDelegate {
    getHeight(element) {
        return 22;
    }
    getTemplateId(element) {
        return CollapsibleListRenderer.TEMPLATE_ID;
    }
}
let CollapsibleListRenderer = class CollapsibleListRenderer {
    static { CollapsibleListRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'chatCollapsibleListRenderer'; }
    constructor(labels, menuId, themeService, productService, instantiationService, contextKeyService) {
        this.labels = labels;
        this.menuId = menuId;
        this.themeService = themeService;
        this.productService = productService;
        this.instantiationService = instantiationService;
        this.contextKeyService = contextKeyService;
        this.templateId = CollapsibleListRenderer_1.TEMPLATE_ID;
    }
    renderTemplate(container) {
        const templateDisposables = new DisposableStore();
        const label = templateDisposables.add(this.labels.create(container, { supportHighlights: true, supportIcons: true }));
        const fileDiffsContainer = $('.working-set-line-counts');
        const addedSpan = dom.$('.working-set-lines-added');
        const removedSpan = dom.$('.working-set-lines-removed');
        fileDiffsContainer.appendChild(addedSpan);
        fileDiffsContainer.appendChild(removedSpan);
        label.element.appendChild(fileDiffsContainer);
        let toolbar;
        let actionBarContainer;
        let contextKeyService;
        if (this.menuId) {
            actionBarContainer = $('.chat-collapsible-list-action-bar');
            contextKeyService = templateDisposables.add(this.contextKeyService.createScoped(actionBarContainer));
            const scopedInstantiationService = templateDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
            toolbar = templateDisposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, actionBarContainer, this.menuId, { menuOptions: { shouldForwardArgs: true, arg: undefined } }));
            label.element.appendChild(actionBarContainer);
        }
        return { templateDisposables, label, toolbar, actionBarContainer, contextKeyService, fileDiffsContainer, addedSpan, removedSpan };
    }
    getReferenceIcon(data) {
        if (ThemeIcon.isThemeIcon(data.iconPath)) {
            return data.iconPath;
        }
        else {
            return isDark(this.themeService.getColorTheme().type) && data.iconPath?.dark
                ? data.iconPath?.dark
                : data.iconPath?.light;
        }
    }
    renderElement(data, index, templateData) {
        if (data.kind === 'warning') {
            templateData.label.setResource({ name: data.content.value }, { icon: Codicon.warning });
            return;
        }
        const reference = data.reference;
        const icon = this.getReferenceIcon(data);
        templateData.label.element.style.display = 'flex';
        let arg;
        if (typeof reference === 'object' && 'variableName' in reference) {
            if (reference.value) {
                const uri = URI.isUri(reference.value) ? reference.value : reference.value.uri;
                templateData.label.setResource({
                    resource: uri,
                    name: basenameOrAuthority(uri),
                    description: `#${reference.variableName}`,
                    range: 'range' in reference.value ? reference.value.range : undefined,
                }, { icon, title: data.options?.status?.description ?? data.title });
            }
            else if (reference.variableName.startsWith('kernelVariable')) {
                const variable = reference.variableName.split(':')[1];
                const asVariableName = `${variable}`;
                const label = `Kernel variable`;
                templateData.label.setLabel(label, asVariableName, { title: data.options?.status?.description });
            }
            else {
                // Nothing else is expected to fall into here
                templateData.label.setLabel('Unknown variable type');
            }
        }
        else if (typeof reference === 'string') {
            templateData.label.setLabel(reference, undefined, { iconPath: URI.isUri(icon) ? icon : undefined, title: data.options?.status?.description ?? data.title });
        }
        else {
            const uri = 'uri' in reference ? reference.uri : reference;
            arg = uri;
            const extraClasses = data.excluded ? ['excluded'] : [];
            if (uri.scheme === 'https' && isEqualAuthority(uri.authority, 'github.com') && uri.path.includes('/tree/')) {
                // Parse a nicer label for GitHub URIs that point at a particular commit + file
                templateData.label.setResource(getResourceLabelForGithubUri(uri), { icon: Codicon.github, title: data.title, strikethrough: data.excluded, extraClasses });
            }
            else if (uri.scheme === this.productService.urlProtocol && isEqualAuthority(uri.authority, SETTINGS_AUTHORITY)) {
                // a nicer label for settings URIs
                const settingId = uri.path.substring(1);
                templateData.label.setResource({ resource: uri, name: settingId }, { icon: Codicon.settingsGear, title: localize('setting.hover', "Open setting '{0}'", settingId), strikethrough: data.excluded, extraClasses });
            }
            else if (matchesSomeScheme(uri, Schemas.mailto, Schemas.http, Schemas.https)) {
                templateData.label.setResource({ resource: uri, name: uri.toString() }, { icon: icon ?? Codicon.globe, title: data.options?.status?.description ?? data.title ?? uri.toString(), strikethrough: data.excluded, extraClasses });
            }
            else {
                templateData.label.setFile(uri, {
                    fileKind: FileKind.FILE,
                    // Should not have this live-updating data on a historical reference
                    fileDecorations: undefined,
                    range: 'range' in reference ? reference.range : undefined,
                    title: data.options?.status?.description ?? data.title,
                    strikethrough: data.excluded,
                    extraClasses
                });
            }
        }
        for (const selector of ['.monaco-icon-suffix-container', '.monaco-icon-name-container']) {
            // eslint-disable-next-line no-restricted-syntax
            const element = templateData.label.element.querySelector(selector);
            if (element) {
                if (data.options?.status?.kind === ChatResponseReferencePartStatusKind.Omitted || data.options?.status?.kind === ChatResponseReferencePartStatusKind.Partial) {
                    element.classList.add('warning');
                }
                else {
                    element.classList.remove('warning');
                }
            }
        }
        if (data.state !== undefined) {
            if (templateData.actionBarContainer) {
                if (data.state === 0 /* ModifiedFileEntryState.Modified */ && !templateData.actionBarContainer.classList.contains('modified')) {
                    const diffMeta = data?.options?.diffMeta;
                    if (diffMeta) {
                        if (!templateData.fileDiffsContainer || !templateData.addedSpan || !templateData.removedSpan) {
                            return;
                        }
                        templateData.addedSpan.textContent = `+${diffMeta.added}`;
                        templateData.removedSpan.textContent = `-${diffMeta.removed}`;
                        templateData.fileDiffsContainer.setAttribute('aria-label', localize('chatEditingSession.fileCounts', '{0} lines added, {1} lines removed', diffMeta.added, diffMeta.removed));
                    }
                    // eslint-disable-next-line no-restricted-syntax
                    templateData.label.element.querySelector('.monaco-icon-name-container')?.classList.add('modified');
                }
                else if (data.state !== 0 /* ModifiedFileEntryState.Modified */) {
                    templateData.actionBarContainer.classList.remove('modified');
                    // eslint-disable-next-line no-restricted-syntax
                    templateData.label.element.querySelector('.monaco-icon-name-container')?.classList.remove('modified');
                }
            }
            if (templateData.toolbar) {
                templateData.toolbar.context = arg;
            }
            if (templateData.contextKeyService) {
                if (data.state !== undefined) {
                    chatEditingWidgetFileStateContextKey.bindTo(templateData.contextKeyService).set(data.state);
                }
            }
        }
    }
    disposeTemplate(templateData) {
        templateData.templateDisposables.dispose();
    }
};
CollapsibleListRenderer = CollapsibleListRenderer_1 = __decorate([
    __param(2, IThemeService),
    __param(3, IProductService),
    __param(4, IInstantiationService),
    __param(5, IContextKeyService)
], CollapsibleListRenderer);
function getResourceLabelForGithubUri(uri) {
    const repoPath = uri.path.split('/').slice(1, 3).join('/');
    const filePath = uri.path.split('/').slice(5);
    const fileName = filePath.at(-1);
    const range = getLineRangeFromGithubUri(uri);
    return {
        resource: uri,
        name: fileName ?? filePath.join('/'),
        description: [repoPath, ...filePath.slice(0, -1)].join('/'),
        range
    };
}
function getLineRangeFromGithubUri(uri) {
    if (!uri.fragment) {
        return undefined;
    }
    // Extract the line range from the fragment
    // Github line ranges are 1-based
    const match = uri.fragment.match(/\bL(\d+)(?:-L(\d+))?/);
    if (!match) {
        return undefined;
    }
    const startLine = parseInt(match[1]);
    if (isNaN(startLine)) {
        return undefined;
    }
    const endLine = match[2] ? parseInt(match[2]) : startLine;
    if (isNaN(endLine)) {
        return undefined;
    }
    return {
        startLineNumber: startLine,
        startColumn: 1,
        endLineNumber: endLine,
        endColumn: 1
    };
}
function getResourceForElement(element) {
    if (element.kind === 'warning') {
        return null;
    }
    const { reference } = element;
    if (typeof reference === 'string' || 'variableName' in reference) {
        return null;
    }
    else if (URI.isUri(reference)) {
        return reference;
    }
    else {
        return reference.uri;
    }
}
//#region Resource context menu
registerAction2(class AddToChatAction extends Action2 {
    static { this.id = 'workbench.action.chat.addToChatAction'; }
    constructor() {
        super({
            id: AddToChatAction.id,
            title: {
                ...localize2('addToChat', "Add File to Chat"),
            },
            f1: false,
            menu: [{
                    id: MenuId.ChatAttachmentsContext,
                    group: 'chat',
                    order: 1,
                    when: ContextKeyExpr.and(ResourceContextKey.IsFileSystemResource, ExplorerFolderContext.negate()),
                }]
        });
    }
    async run(accessor, resource) {
        const chatWidgetService = accessor.get(IChatWidgetService);
        if (!resource) {
            return;
        }
        const widget = chatWidgetService.lastFocusedWidget;
        if (widget) {
            widget.attachmentModel.addFile(resource);
        }
    }
});
registerAction2(class OpenChatReferenceLinkAction extends Action2 {
    static { this.id = 'workbench.action.chat.copyLink'; }
    constructor() {
        super({
            id: OpenChatReferenceLinkAction.id,
            title: {
                ...localize2('copyLink', "Copy Link"),
            },
            f1: false,
            menu: [{
                    id: MenuId.ChatAttachmentsContext,
                    group: 'chat',
                    order: 0,
                    when: ContextKeyExpr.or(ResourceContextKey.Scheme.isEqualTo(Schemas.http), ResourceContextKey.Scheme.isEqualTo(Schemas.https)),
                }]
        });
    }
    async run(accessor, resource) {
        await accessor.get(IClipboardService).writeResources([resource]);
    }
});
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFJlZmVyZW5jZXNDb250ZW50UGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy9jaGF0UmVmZXJlbmNlc0NvbnRlbnRQYXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9DQUFvQyxDQUFDO0FBRzFELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFHakUsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN0RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsT0FBTyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDbkYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFeEQsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM1RCxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxvRUFBb0UsQ0FBQztBQUMvRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbkgsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sOERBQThELENBQUM7QUFDakcsT0FBTyxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzdHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUscUJBQXFCLEVBQW9CLE1BQU0sK0RBQStELENBQUM7QUFDeEgsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFDdEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNwRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0saURBQWlELENBQUM7QUFDakYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzNGLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUN2RSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDckYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDakUsT0FBTyxFQUF1QyxjQUFjLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNwRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUM1RixPQUFPLEVBQUUsd0NBQXdDLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUN4RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUN2RSxPQUFPLEVBQUUsb0NBQW9DLEVBQTBCLE1BQU0sb0NBQW9DLENBQUM7QUFDbEgsT0FBTyxFQUFFLG1DQUFtQyxFQUE4QyxNQUFNLDZCQUE2QixDQUFDO0FBRTlILE9BQU8sRUFBZ0Isa0JBQWtCLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDOUQsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDN0UsT0FBTyxFQUF3QixZQUFZLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUcxRSxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBV1QsSUFBTSw4QkFBOEIsR0FBcEMsTUFBTSw4QkFBK0IsU0FBUSwwQkFBMEI7SUFFN0UsWUFDa0IsSUFBNkMsRUFDOUQsYUFBbUQsRUFDbkQsT0FBc0MsRUFDckIseUJBQThDLEVBQzlCLGFBQTZCLEVBQy9CLFdBQXlCLEVBQ2hCLG9CQUEyQyxFQUM3QyxrQkFBdUM7UUFFN0UsS0FBSyxDQUFDLGFBQWEsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDeEMsUUFBUSxDQUFDLHNCQUFzQixFQUFFLHFCQUFxQixFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ3RFLFFBQVEsQ0FBQyx3QkFBd0IsRUFBRSxvQkFBb0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBWHZELFNBQUksR0FBSixJQUFJLENBQXlDO1FBRzdDLDhCQUF5QixHQUF6Qix5QkFBeUIsQ0FBcUI7UUFDOUIsa0JBQWEsR0FBYixhQUFhLENBQWdCO1FBQy9CLGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBQ2hCLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBdUI7UUFDN0MsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFxQjtJQUs5RSxDQUFDO0lBRWtCLFdBQVc7UUFDN0IsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztRQUNqRSxNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO1FBRXhCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO1lBQ25DLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxXQUFXLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUN0RixNQUFNLGFBQWEsR0FBRyxjQUFjLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUM7Z0JBQzlHLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDO29CQUNyRCxhQUFhLEVBQUUsR0FBRyxDQUFDO2dCQUNwQixJQUFJLEdBQUcsRUFBRSxDQUFDO29CQUNULElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUN0QixHQUFHLEVBQ0g7d0JBQ0MsZUFBZSxFQUFFLElBQUk7d0JBQ3JCLGFBQWEsRUFBRTs0QkFDZCxHQUFHLENBQUMsQ0FBQyxhQUFhOzRCQUNsQixHQUFHO2dDQUNGLFNBQVMsRUFBRSxhQUFhLElBQUksT0FBTyxJQUFJLGFBQWEsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsU0FBUzs2QkFDdEY7eUJBQ0Q7cUJBQ0QsQ0FBQyxDQUFDO2dCQUNMLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNyQyxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBRTNDLE1BQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxPQUFPLElBQUkscUJBQXFCLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzFELElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDVixPQUFPO1lBQ1IsQ0FBQztZQUVELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLENBQUM7Z0JBQ3ZDLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTTtnQkFDekIsVUFBVSxFQUFFLEdBQUcsRUFBRTtvQkFDaEIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLHNCQUFzQixFQUFFLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztvQkFDM0ksT0FBTyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDeEMsQ0FBQzthQUNELENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7UUFDeEcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDeEMsa0JBQWtCLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDM0IsTUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUM5RCxNQUFNLEdBQUcsR0FBRyxPQUFPLElBQUkscUJBQXFCLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDdEQsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQztRQUNyQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosTUFBTSxhQUFhLEdBQUcsQ0FBQyxDQUFDO1FBQ3hCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDN0QsTUFBTSxNQUFNLEdBQUcsVUFBVSxHQUFHLEVBQUUsQ0FBQztRQUMvQixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3BCLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUM7UUFDbkQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdkMsT0FBTyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUMsYUFBYyxDQUFDO0lBQzdDLENBQUM7SUFFRCxjQUFjLENBQUMsS0FBMkIsRUFBRSxnQkFBd0MsRUFBRSxPQUFxQjtRQUMxRyxPQUFPLEtBQUssQ0FBQyxJQUFJLEtBQUssWUFBWSxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sS0FBSyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUNoSixDQUFDO0NBQ0QsQ0FBQTtBQWhGWSw4QkFBOEI7SUFPeEMsV0FBQSxjQUFjLENBQUE7SUFDZCxXQUFBLFlBQVksQ0FBQTtJQUNaLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxtQkFBbUIsQ0FBQTtHQVZULDhCQUE4QixDQWdGMUM7O0FBTU0sSUFBTSxpQ0FBaUMsR0FBdkMsTUFBTSxpQ0FBa0MsU0FBUSw4QkFBOEI7SUFDcEYsWUFDQyxJQUE2QyxFQUM3QyxhQUFtRCxFQUNuRCxPQUFzQyxFQUN0Qyx5QkFBOEMsRUFDN0IsT0FBdUMsRUFDeEMsYUFBNkIsRUFDL0IsV0FBeUIsRUFDaEIsb0JBQTJDLEVBQzdDLGtCQUF1QztRQUU1RCxLQUFLLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxvQkFBb0IsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBTnBILFlBQU8sR0FBUCxPQUFPLENBQWdDO1FBT3hELElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUN2QixHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN4QixDQUFDO0lBQ0YsQ0FBQztJQUVrQixVQUFVO1FBQzVCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBaUMsQ0FBQztRQUMvRCxPQUFPLE9BQU8sQ0FBQyxzQkFBc0IsSUFBSSxDQUFDLENBQUMsQ0FDMUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyx5QkFBeUIsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUM3RSxDQUFDO0lBQ0gsQ0FBQztJQUVrQixXQUFXLENBQUMsS0FBYztRQUM1QyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQWlDLENBQUM7UUFDL0QsT0FBTyxDQUFDLHNCQUFzQixHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3JELENBQUM7Q0FDRCxDQUFBO0FBN0JZLGlDQUFpQztJQU8zQyxXQUFBLGNBQWMsQ0FBQTtJQUNkLFdBQUEsWUFBWSxDQUFBO0lBQ1osV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLG1CQUFtQixDQUFBO0dBVlQsaUNBQWlDLENBNkI3Qzs7QUFFTSxJQUFNLG1CQUFtQixHQUF6QixNQUFNLG1CQUFvQixTQUFRLFVBQVU7SUFHbEQsSUFBVyxLQUFLO1FBQ2YsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztJQUN6QixDQUFDO0lBRUQsWUFDUyxzQkFBc0MsRUFDN0IsTUFBMEIsRUFDMUIsV0FBK0QsRUFDeEMsb0JBQTJDLEVBQ25ELFlBQTJCLEVBQzNCLFlBQTJCO1FBRTNELEtBQUssRUFBRSxDQUFDO1FBUEEsMkJBQXNCLEdBQXRCLHNCQUFzQixDQUFnQjtRQUM3QixXQUFNLEdBQU4sTUFBTSxDQUFvQjtRQUMxQixnQkFBVyxHQUFYLFdBQVcsQ0FBb0Q7UUFDeEMseUJBQW9CLEdBQXBCLG9CQUFvQixDQUF1QjtRQUNuRCxpQkFBWSxHQUFaLFlBQVksQ0FBZTtRQUMzQixpQkFBWSxHQUFaLFlBQVksQ0FBZTtRQUczRCxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxZQUFZLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBRU8sV0FBVztRQUNsQixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsY0FBYyxFQUFFLEVBQUUscUJBQXFCLEVBQUUsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRXhKLE1BQU0sU0FBUyxHQUFHLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxTQUFTLENBQUMsd0NBQXdDLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO1FBRXZGLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQ3BELENBQUEsYUFBdUMsQ0FBQSxFQUN2QyxrQkFBa0IsRUFDbEIsU0FBUyxFQUNULElBQUksdUJBQXVCLEVBQUUsRUFDN0IsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLHVCQUF1QixFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFDaEc7WUFDQyxHQUFHLElBQUksQ0FBQyxXQUFXO1lBQ25CLHVCQUF1QixFQUFFLEtBQUs7WUFDOUIscUJBQXFCLEVBQUU7Z0JBQ3RCLFlBQVksRUFBRSxDQUFDLE9BQWlDLEVBQUUsRUFBRTtvQkFDbkQsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRSxDQUFDO3dCQUNoQyxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO29CQUM5QixDQUFDO29CQUNELE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7b0JBQ3BDLElBQUksT0FBTyxTQUFTLEtBQUssUUFBUSxFQUFFLENBQUM7d0JBQ25DLE9BQU8sU0FBUyxDQUFDO29CQUNsQixDQUFDO3lCQUFNLElBQUksY0FBYyxJQUFJLFNBQVMsRUFBRSxDQUFDO3dCQUN4QyxPQUFPLFNBQVMsQ0FBQyxZQUFZLENBQUM7b0JBQy9CLENBQUM7eUJBQU0sSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7d0JBQ2pDLE9BQU8sUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDakMsQ0FBQzt5QkFBTSxDQUFDO3dCQUNQLE9BQU8sUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ3JDLENBQUM7Z0JBQ0YsQ0FBQztnQkFFRCxrQkFBa0IsRUFBRSxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMscUJBQXFCLEVBQUUsa0NBQWtDLENBQUM7YUFDN0Y7WUFDRCxHQUFHLEVBQUU7Z0JBQ0osVUFBVSxFQUFFLENBQUMsT0FBaUMsRUFBRSxFQUFFLENBQUMscUJBQXFCLENBQUMsT0FBTyxDQUFDLEVBQUUsUUFBUSxFQUFFLElBQUksSUFBSTtnQkFDckcsWUFBWSxFQUFFLENBQUMsUUFBUSxFQUFFLGFBQWEsRUFBRSxFQUFFO29CQUN6QyxNQUFNLElBQUksR0FBVSxRQUFRLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUM7b0JBQ2xFLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7d0JBQ2xCLE9BQU8sU0FBUyxDQUFDO29CQUNsQixDQUFDO3lCQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQzt3QkFDOUIsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztvQkFDbkUsQ0FBQzt5QkFBTSxDQUFDO3dCQUNQLE9BQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQ3pCLENBQUM7Z0JBQ0YsQ0FBQztnQkFDRCxPQUFPLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQztnQkFDbEIsVUFBVSxFQUFFLEdBQUcsRUFBRSxDQUFDLEtBQUs7Z0JBQ3ZCLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO2dCQUNmLFdBQVcsRUFBRSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUUsRUFBRTtvQkFDcEMsSUFBSSxDQUFDO3dCQUNKLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQWdDLENBQUM7d0JBQzlELE1BQU0sSUFBSSxHQUFVLFFBQVEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQzt3QkFDbEUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQztvQkFDMUcsQ0FBQztvQkFBQyxNQUFNLENBQUM7d0JBQ1IsT0FBTztvQkFDUixDQUFDO2dCQUNGLENBQUM7YUFDRDtTQUNELENBQUMsQ0FBQztRQUVKLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVELEdBQUc7UUFDRixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ2hDLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNsQixPQUFPO1lBQ04sTUFBTTtZQUNOLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLO1lBQ3BCLE9BQU8sRUFBRSxHQUFHLEVBQUU7Z0JBQ2IsS0FBSyxHQUFHLElBQUksQ0FBQztnQkFDYixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM1QixDQUFDO1NBQ0QsQ0FBQztJQUNILENBQUM7Q0FDRCxDQUFBO0FBL0ZZLG1CQUFtQjtJQVc3QixXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEsYUFBYSxDQUFBO0lBQ2IsV0FBQSxhQUFhLENBQUE7R0FiSCxtQkFBbUIsQ0ErRi9COztBQUVELE1BQU0sdUJBQXVCO0lBQzVCLFNBQVMsQ0FBQyxPQUFpQztRQUMxQyxPQUFPLEVBQUUsQ0FBQztJQUNYLENBQUM7SUFFRCxhQUFhLENBQUMsT0FBaUM7UUFDOUMsT0FBTyx1QkFBdUIsQ0FBQyxXQUFXLENBQUM7SUFDNUMsQ0FBQztDQUNEO0FBYUQsSUFBTSx1QkFBdUIsR0FBN0IsTUFBTSx1QkFBdUI7O2FBQ3JCLGdCQUFXLEdBQUcsNkJBQTZCLEFBQWhDLENBQWlDO0lBR25ELFlBQ1MsTUFBc0IsRUFDdEIsTUFBMEIsRUFDbkIsWUFBNEMsRUFDMUMsY0FBZ0QsRUFDMUMsb0JBQTRELEVBQy9ELGlCQUFzRDtRQUxsRSxXQUFNLEdBQU4sTUFBTSxDQUFnQjtRQUN0QixXQUFNLEdBQU4sTUFBTSxDQUFvQjtRQUNGLGlCQUFZLEdBQVosWUFBWSxDQUFlO1FBQ3pCLG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUN6Qix5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXVCO1FBQzlDLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBb0I7UUFSbEUsZUFBVSxHQUFXLHlCQUF1QixDQUFDLFdBQVcsQ0FBQztJQVM5RCxDQUFDO0lBRUwsY0FBYyxDQUFDLFNBQXNCO1FBQ3BDLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztRQUNsRCxNQUFNLEtBQUssR0FBRyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFdEgsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLENBQUMsMEJBQTBCLENBQUMsQ0FBQztRQUN6RCxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLDBCQUEwQixDQUFDLENBQUM7UUFDcEQsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO1FBQ3hELGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMxQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDNUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUU5QyxJQUFJLE9BQU8sQ0FBQztRQUNaLElBQUksa0JBQWtCLENBQUM7UUFDdkIsSUFBSSxpQkFBaUIsQ0FBQztRQUN0QixJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNqQixrQkFBa0IsR0FBRyxDQUFDLENBQUMsbUNBQW1DLENBQUMsQ0FBQztZQUM1RCxpQkFBaUIsR0FBRyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7WUFDckcsTUFBTSwwQkFBMEIsR0FBRyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxJQUFJLGlCQUFpQixDQUFDLENBQUMsa0JBQWtCLEVBQUUsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNsSyxPQUFPLEdBQUcsbUJBQW1CLENBQUMsR0FBRyxDQUFDLDBCQUEwQixDQUFDLGNBQWMsQ0FBQyxvQkFBb0IsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsV0FBVyxFQUFFLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNsTSxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQy9DLENBQUM7UUFFRCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLENBQUM7SUFDbkksQ0FBQztJQUdPLGdCQUFnQixDQUFDLElBQTJCO1FBQ25ELElBQUksU0FBUyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUMxQyxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDdEIsQ0FBQzthQUFNLENBQUM7WUFDUCxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGFBQWEsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSTtnQkFDM0UsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSTtnQkFDckIsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDO1FBQ3pCLENBQUM7SUFDRixDQUFDO0lBRUQsYUFBYSxDQUFDLElBQThCLEVBQUUsS0FBYSxFQUFFLFlBQXNDO1FBQ2xHLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUM3QixZQUFZLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ3hGLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUNqQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDekMsWUFBWSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFDbEQsSUFBSSxHQUFvQixDQUFDO1FBQ3pCLElBQUksT0FBTyxTQUFTLEtBQUssUUFBUSxJQUFJLGNBQWMsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUNsRSxJQUFJLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDckIsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDO2dCQUMvRSxZQUFZLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FDN0I7b0JBQ0MsUUFBUSxFQUFFLEdBQUc7b0JBQ2IsSUFBSSxFQUFFLG1CQUFtQixDQUFDLEdBQUcsQ0FBQztvQkFDOUIsV0FBVyxFQUFFLElBQUksU0FBUyxDQUFDLFlBQVksRUFBRTtvQkFDekMsS0FBSyxFQUFFLE9BQU8sSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsU0FBUztpQkFDckUsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsV0FBVyxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZFLENBQUM7aUJBQU0sSUFBSSxTQUFTLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUM7Z0JBQ2hFLE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN0RCxNQUFNLGNBQWMsR0FBRyxHQUFHLFFBQVEsRUFBRSxDQUFDO2dCQUNyQyxNQUFNLEtBQUssR0FBRyxpQkFBaUIsQ0FBQztnQkFDaEMsWUFBWSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLGNBQWMsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDO1lBQ2xHLENBQUM7aUJBQU0sQ0FBQztnQkFDUCw2Q0FBNkM7Z0JBQzdDLFlBQVksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLHVCQUF1QixDQUFDLENBQUM7WUFDdEQsQ0FBQztRQUNGLENBQUM7YUFBTSxJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzFDLFlBQVksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsRUFBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLFdBQVcsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUU3SixDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sR0FBRyxHQUFHLEtBQUssSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUMzRCxHQUFHLEdBQUcsR0FBRyxDQUFDO1lBQ1YsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ3ZELElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxPQUFPLElBQUksZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO2dCQUM1RywrRUFBK0U7Z0JBQy9FLFlBQVksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLDRCQUE0QixDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsYUFBYSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsWUFBWSxFQUFFLENBQUMsQ0FBQztZQUM1SixDQUFDO2lCQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsSUFBSSxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLGtCQUFrQixDQUFDLEVBQUUsQ0FBQztnQkFDbEgsa0NBQWtDO2dCQUNsQyxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDeEMsWUFBWSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsRUFBRSxRQUFRLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsWUFBWSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsZUFBZSxFQUFFLG9CQUFvQixFQUFFLFNBQVMsQ0FBQyxFQUFFLGFBQWEsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLFlBQVksRUFBRSxDQUFDLENBQUM7WUFDbk4sQ0FBQztpQkFBTSxJQUFJLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ2hGLFlBQVksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEVBQUUsUUFBUSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLFFBQVEsRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLFdBQVcsSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLEdBQUcsQ0FBQyxRQUFRLEVBQUUsRUFBRSxhQUFhLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDO1lBQ2hPLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxZQUFZLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUU7b0JBQy9CLFFBQVEsRUFBRSxRQUFRLENBQUMsSUFBSTtvQkFDdkIsb0VBQW9FO29CQUNwRSxlQUFlLEVBQUUsU0FBUztvQkFDMUIsS0FBSyxFQUFFLE9BQU8sSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVM7b0JBQ3pELEtBQUssRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxXQUFXLElBQUksSUFBSSxDQUFDLEtBQUs7b0JBQ3RELGFBQWEsRUFBRSxJQUFJLENBQUMsUUFBUTtvQkFDNUIsWUFBWTtpQkFDWixDQUFDLENBQUM7WUFDSixDQUFDO1FBQ0YsQ0FBQztRQUVELEtBQUssTUFBTSxRQUFRLElBQUksQ0FBQywrQkFBK0IsRUFBRSw2QkFBNkIsQ0FBQyxFQUFFLENBQUM7WUFDekYsZ0RBQWdEO1lBQ2hELE1BQU0sT0FBTyxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNuRSxJQUFJLE9BQU8sRUFBRSxDQUFDO2dCQUNiLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsSUFBSSxLQUFLLG1DQUFtQyxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxJQUFJLEtBQUssbUNBQW1DLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQzlKLE9BQU8sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNsQyxDQUFDO3FCQUFNLENBQUM7b0JBQ1AsT0FBTyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQ3JDLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUM5QixJQUFJLFlBQVksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO2dCQUNyQyxJQUFJLElBQUksQ0FBQyxLQUFLLDRDQUFvQyxJQUFJLENBQUMsWUFBWSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztvQkFDdkgsTUFBTSxRQUFRLEdBQUcsSUFBSSxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUM7b0JBQ3pDLElBQUksUUFBUSxFQUFFLENBQUM7d0JBQ2QsSUFBSSxDQUFDLFlBQVksQ0FBQyxrQkFBa0IsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUM7NEJBQzlGLE9BQU87d0JBQ1IsQ0FBQzt3QkFDRCxZQUFZLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQzt3QkFDMUQsWUFBWSxDQUFDLFdBQVcsQ0FBQyxXQUFXLEdBQUcsSUFBSSxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7d0JBQzlELFlBQVksQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsWUFBWSxFQUFFLFFBQVEsQ0FBQywrQkFBK0IsRUFBRSxvQ0FBb0MsRUFBRSxRQUFRLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUMvSyxDQUFDO29CQUNELGdEQUFnRDtvQkFDaEQsWUFBWSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLDZCQUE2QixDQUFDLEVBQUUsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDcEcsQ0FBQztxQkFBTSxJQUFJLElBQUksQ0FBQyxLQUFLLDRDQUFvQyxFQUFFLENBQUM7b0JBQzNELFlBQVksQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO29CQUM3RCxnREFBZ0Q7b0JBQ2hELFlBQVksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyw2QkFBNkIsQ0FBQyxFQUFFLFNBQVMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ3ZHLENBQUM7WUFDRixDQUFDO1lBQ0QsSUFBSSxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQzFCLFlBQVksQ0FBQyxPQUFPLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQztZQUNwQyxDQUFDO1lBQ0QsSUFBSSxZQUFZLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztnQkFDcEMsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLFNBQVMsRUFBRSxDQUFDO29CQUM5QixvQ0FBb0MsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLGlCQUFpQixDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDN0YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVELGVBQWUsQ0FBQyxZQUFzQztRQUNyRCxZQUFZLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDNUMsQ0FBQzs7QUF4SkksdUJBQXVCO0lBTzFCLFdBQUEsYUFBYSxDQUFBO0lBQ2IsV0FBQSxlQUFlLENBQUE7SUFDZixXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEsa0JBQWtCLENBQUE7R0FWZix1QkFBdUIsQ0F5SjVCO0FBRUQsU0FBUyw0QkFBNEIsQ0FBQyxHQUFRO0lBQzdDLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzNELE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM5QyxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDakMsTUFBTSxLQUFLLEdBQUcseUJBQXlCLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDN0MsT0FBTztRQUNOLFFBQVEsRUFBRSxHQUFHO1FBQ2IsSUFBSSxFQUFFLFFBQVEsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUNwQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLEVBQUUsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUMzRCxLQUFLO0tBQ0wsQ0FBQztBQUNILENBQUM7QUFFRCxTQUFTLHlCQUF5QixDQUFDLEdBQVE7SUFDMUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNuQixPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsMkNBQTJDO0lBQzNDLGlDQUFpQztJQUNqQyxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0lBQ3pELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNaLE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFRCxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDckMsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztRQUN0QixPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUMxRCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQ3BCLE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFRCxPQUFPO1FBQ04sZUFBZSxFQUFFLFNBQVM7UUFDMUIsV0FBVyxFQUFFLENBQUM7UUFDZCxhQUFhLEVBQUUsT0FBTztRQUN0QixTQUFTLEVBQUUsQ0FBQztLQUNaLENBQUM7QUFDSCxDQUFDO0FBRUQsU0FBUyxxQkFBcUIsQ0FBQyxPQUFpQztJQUMvRCxJQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDaEMsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBQ0QsTUFBTSxFQUFFLFNBQVMsRUFBRSxHQUFHLE9BQU8sQ0FBQztJQUM5QixJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVEsSUFBSSxjQUFjLElBQUksU0FBUyxFQUFFLENBQUM7UUFDbEUsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO1NBQU0sSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7UUFDakMsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztTQUFNLENBQUM7UUFDUCxPQUFPLFNBQVMsQ0FBQyxHQUFHLENBQUM7SUFDdEIsQ0FBQztBQUNGLENBQUM7QUFFRCwrQkFBK0I7QUFFL0IsZUFBZSxDQUFDLE1BQU0sZUFBZ0IsU0FBUSxPQUFPO2FBRXBDLE9BQUUsR0FBRyx1Q0FBdUMsQ0FBQztJQUU3RDtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSxlQUFlLENBQUMsRUFBRTtZQUN0QixLQUFLLEVBQUU7Z0JBQ04sR0FBRyxTQUFTLENBQUMsV0FBVyxFQUFFLGtCQUFrQixDQUFDO2FBQzdDO1lBQ0QsRUFBRSxFQUFFLEtBQUs7WUFDVCxJQUFJLEVBQUUsQ0FBQztvQkFDTixFQUFFLEVBQUUsTUFBTSxDQUFDLHNCQUFzQjtvQkFDakMsS0FBSyxFQUFFLE1BQU07b0JBQ2IsS0FBSyxFQUFFLENBQUM7b0JBQ1IsSUFBSSxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsb0JBQW9CLEVBQUUscUJBQXFCLENBQUMsTUFBTSxFQUFFLENBQUM7aUJBQ2pHLENBQUM7U0FDRixDQUFDLENBQUM7SUFDSixDQUFDO0lBRVEsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUEwQixFQUFFLFFBQWE7UUFDM0QsTUFBTSxpQkFBaUIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDM0QsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2YsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQyxpQkFBaUIsQ0FBQztRQUNuRCxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1osTUFBTSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDMUMsQ0FBQztJQUNGLENBQUM7Q0FDRCxDQUFDLENBQUM7QUFFSCxlQUFlLENBQUMsTUFBTSwyQkFBNEIsU0FBUSxPQUFPO2FBRWhELE9BQUUsR0FBRyxnQ0FBZ0MsQ0FBQztJQUV0RDtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSwyQkFBMkIsQ0FBQyxFQUFFO1lBQ2xDLEtBQUssRUFBRTtnQkFDTixHQUFHLFNBQVMsQ0FBQyxVQUFVLEVBQUUsV0FBVyxDQUFDO2FBQ3JDO1lBQ0QsRUFBRSxFQUFFLEtBQUs7WUFDVCxJQUFJLEVBQUUsQ0FBQztvQkFDTixFQUFFLEVBQUUsTUFBTSxDQUFDLHNCQUFzQjtvQkFDakMsS0FBSyxFQUFFLE1BQU07b0JBQ2IsS0FBSyxFQUFFLENBQUM7b0JBQ1IsSUFBSSxFQUFFLGNBQWMsQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsa0JBQWtCLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQzlILENBQUM7U0FDRixDQUFDLENBQUM7SUFDSixDQUFDO0lBRVEsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUEwQixFQUFFLFFBQWE7UUFDM0QsTUFBTSxRQUFRLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUNsRSxDQUFDO0NBQ0QsQ0FBQyxDQUFDO0FBRUgsWUFBWSJ9