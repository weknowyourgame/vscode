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
var HistoryItemRenderer_1, HistoryItemChangeRenderer_1, HistoryItemLoadMoreRenderer_1;
import './media/scm.css';
import { $, append, h, reset } from '../../../../base/browser/dom.js';
import { IconLabel } from '../../../../base/browser/ui/iconLabel/iconLabel.js';
import { createMatches } from '../../../../base/common/filters.js';
import { combinedDisposable, Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, derived, observableValue, waitForState, constObservable, latestChangedValue, observableFromEvent, runOnChange, observableSignal } from '../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService, WorkbenchHoverDelegate } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { WorkbenchCompressibleAsyncDataTree } from '../../../../platform/list/browser/listService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { asCssVariable, foreground } from '../../../../platform/theme/common/colorRegistry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ViewAction, ViewPane, ViewPaneShowActions } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { renderSCMHistoryItemGraph, toISCMHistoryItemViewModelArray, SWIMLANE_WIDTH, renderSCMHistoryGraphPlaceholder, historyItemHoverLabelForeground, historyItemHoverDefaultLabelBackground, getHistoryItemIndex, toHistoryItemHoverContent } from './scmHistory.js';
import { getHistoryItemEditorTitle, getProviderKey, isSCMHistoryItemChangeNode, isSCMHistoryItemChangeViewModelTreeElement, isSCMHistoryItemLoadMoreTreeElement, isSCMHistoryItemViewModelTreeElement, isSCMRepository } from './util.js';
import { SCMIncomingHistoryItemId, SCMOutgoingHistoryItemId } from '../common/history.js';
import { HISTORY_VIEW_PANE_ID, ISCMService, ISCMViewService } from '../common/scm.js';
import { stripIcons } from '../../../../base/common/iconLabels.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { Action2, IMenuService, isIMenuItem, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { Sequencer, Throttler } from '../../../../base/common/async.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ActionRunner } from '../../../../base/common/actions.js';
import { delta, groupBy } from '../../../../base/common/arrays.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { ContextKeys } from './scmViewPane.js';
import { ActionViewItem } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { Event } from '../../../../base/common/event.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { clamp } from '../../../../base/common/numbers.js';
import { observableConfigValue } from '../../../../platform/observable/common/platformObservableUtils.js';
import { compare } from '../../../../base/common/strings.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { groupBy as groupBy2 } from '../../../../base/common/collections.js';
import { getActionBarActions, getFlatContextMenuActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { ResourceLabels } from '../../../browser/labels.js';
import { FileKind } from '../../../../platform/files/common/files.js';
import { WorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { basename } from '../../../../base/common/path.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ScmHistoryItemResolver } from '../../multiDiffEditor/browser/scmMultiDiffSourceResolver.js';
import { ResourceTree } from '../../../../base/common/resourceTree.js';
import { URI } from '../../../../base/common/uri.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { CodeDataTransfers } from '../../../../platform/dnd/browser/dnd.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { isMarkdownString } from '../../../../base/common/htmlContent.js';
const PICK_REPOSITORY_ACTION_ID = 'workbench.scm.action.graph.pickRepository';
const PICK_HISTORY_ITEM_REFS_ACTION_ID = 'workbench.scm.action.graph.pickHistoryItemRefs';
class SCMRepositoryActionViewItem extends ActionViewItem {
    constructor(_repository, action, options) {
        super(null, action, { ...options, icon: false, label: true });
        this._repository = _repository;
    }
    updateLabel() {
        if (this.options.label && this.label) {
            this.label.classList.add('scm-graph-repository-picker');
            const icon = $('.icon');
            const iconClassNameArray = ThemeIcon.isThemeIcon(this._repository.provider.iconPath)
                ? ThemeIcon.asClassNameArray(this._repository.provider.iconPath)
                : ThemeIcon.asClassNameArray(Codicon.repo);
            icon.classList.add(...iconClassNameArray);
            const name = $('.name');
            name.textContent = this._repository.provider.name;
            reset(this.label, icon, name);
        }
    }
    getTooltip() {
        return this._repository.provider.name;
    }
}
class SCMHistoryItemRefsActionViewItem extends ActionViewItem {
    constructor(_repository, _historyItemsFilter, action, options) {
        super(null, action, { ...options, icon: false, label: true });
        this._repository = _repository;
        this._historyItemsFilter = _historyItemsFilter;
    }
    updateLabel() {
        if (this.options.label && this.label) {
            this.label.classList.add('scm-graph-history-item-picker');
            const icon = $('.icon');
            icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.gitBranch));
            const name = $('.name');
            if (this._historyItemsFilter === 'all') {
                name.textContent = localize('all', "All");
            }
            else if (this._historyItemsFilter === 'auto') {
                name.textContent = localize('auto', "Auto");
            }
            else if (this._historyItemsFilter.length === 1) {
                name.textContent = this._historyItemsFilter[0].name;
            }
            else {
                name.textContent = localize('items', "{0} Items", this._historyItemsFilter.length);
            }
            reset(this.label, icon, name);
        }
    }
    getTooltip() {
        if (this._historyItemsFilter === 'all') {
            return localize('allHistoryItemRefs', "All history item references");
        }
        else if (this._historyItemsFilter === 'auto') {
            const historyProvider = this._repository.provider.historyProvider.get();
            return [
                historyProvider?.historyItemRef.get()?.name,
                historyProvider?.historyItemRemoteRef.get()?.name,
                historyProvider?.historyItemBaseRef.get()?.name
            ].filter(ref => !!ref).join(', ');
        }
        else if (this._historyItemsFilter.length === 1) {
            return this._historyItemsFilter[0].name;
        }
        else {
            return this._historyItemsFilter.map(ref => ref.name).join(', ');
        }
    }
}
registerAction2(class extends ViewAction {
    constructor() {
        super({
            id: PICK_REPOSITORY_ACTION_ID,
            title: localize('repositoryPicker', "Repository Picker"),
            viewId: HISTORY_VIEW_PANE_ID,
            f1: false,
            menu: {
                id: MenuId.SCMHistoryTitle,
                when: ContextKeyExpr.and(ContextKeyExpr.has('scm.providerCount'), ContextKeyExpr.greater('scm.providerCount', 1), ContextKeyExpr.equals('config.scm.repositories.selectionMode', 'multiple')),
                group: 'navigation',
                order: 0
            }
        });
    }
    async runInView(_, view) {
        view.pickRepository();
    }
});
registerAction2(class extends ViewAction {
    constructor() {
        super({
            id: PICK_HISTORY_ITEM_REFS_ACTION_ID,
            title: localize('referencePicker', "History Item Reference Picker"),
            icon: Codicon.gitBranch,
            viewId: HISTORY_VIEW_PANE_ID,
            precondition: ContextKeys.SCMHistoryItemCount.notEqualsTo(0),
            f1: false,
            menu: {
                id: MenuId.SCMHistoryTitle,
                group: 'navigation',
                order: 1
            }
        });
    }
    async runInView(_, view) {
        view.pickHistoryItemRef();
    }
});
registerAction2(class extends ViewAction {
    constructor() {
        super({
            id: 'workbench.scm.action.graph.revealCurrentHistoryItem',
            title: localize('goToCurrentHistoryItem', "Go to Current History Item"),
            icon: Codicon.target,
            viewId: HISTORY_VIEW_PANE_ID,
            precondition: ContextKeyExpr.and(ContextKeys.SCMHistoryItemCount.notEqualsTo(0), ContextKeys.SCMCurrentHistoryItemRefInFilter.isEqualTo(true)),
            f1: false,
            menu: {
                id: MenuId.SCMHistoryTitle,
                group: 'navigation',
                order: 2
            }
        });
    }
    async runInView(_, view) {
        view.revealCurrentHistoryItem();
    }
});
registerAction2(class extends ViewAction {
    constructor() {
        super({
            id: 'workbench.scm.action.graph.refresh',
            title: localize('refreshGraph', "Refresh"),
            viewId: HISTORY_VIEW_PANE_ID,
            f1: false,
            icon: Codicon.refresh,
            menu: {
                id: MenuId.SCMHistoryTitle,
                group: 'navigation',
                order: 1000
            }
        });
    }
    async runInView(_, view) {
        view.refresh();
    }
});
registerAction2(class extends ViewAction {
    constructor() {
        super({
            id: 'workbench.scm.action.graph.setListViewMode',
            title: localize('setListViewMode', "View as List"),
            viewId: HISTORY_VIEW_PANE_ID,
            toggled: ContextKeys.SCMHistoryViewMode.isEqualTo("list" /* ViewMode.List */),
            menu: { id: MenuId.SCMHistoryTitle, group: '9_viewmode', order: 1 },
            f1: false
        });
    }
    async runInView(_, view) {
        view.setViewMode("list" /* ViewMode.List */);
    }
});
registerAction2(class extends ViewAction {
    constructor() {
        super({
            id: 'workbench.scm.action.graph.setTreeViewMode',
            title: localize('setTreeViewMode', "View as Tree"),
            viewId: HISTORY_VIEW_PANE_ID,
            toggled: ContextKeys.SCMHistoryViewMode.isEqualTo("tree" /* ViewMode.Tree */),
            menu: { id: MenuId.SCMHistoryTitle, group: '9_viewmode', order: 2 },
            f1: false
        });
    }
    async runInView(_, view) {
        view.setViewMode("tree" /* ViewMode.Tree */);
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'workbench.scm.action.graph.viewChanges',
            title: localize('openChanges', "Open Changes"),
            icon: Codicon.diffMultiple,
            f1: false,
            menu: [
                {
                    id: MenuId.SCMHistoryItemContext,
                    when: ContextKeyExpr.equals('config.multiDiffEditor.experimental.enabled', true),
                    group: 'inline',
                    order: 1
                },
                {
                    id: MenuId.SCMHistoryItemContext,
                    when: ContextKeyExpr.equals('config.multiDiffEditor.experimental.enabled', true),
                    group: '0_view',
                    order: 1
                }
            ]
        });
    }
    async run(accessor, provider, ...historyItems) {
        const commandService = accessor.get(ICommandService);
        const historyProvider = provider.historyProvider.get();
        const historyItemRef = historyProvider?.historyItemRef.get();
        const historyItemRemoteRef = historyProvider?.historyItemRemoteRef.get();
        if (!provider || !historyProvider || !historyItemRef || historyItems.length === 0) {
            return;
        }
        const historyItem = historyItems[0];
        let title, historyItemId, historyItemParentId;
        if (historyItemRemoteRef && (historyItem.id === SCMIncomingHistoryItemId || historyItem.id === SCMOutgoingHistoryItemId)) {
            // Incoming/Outgoing changes history item
            const mergeBase = await historyProvider.resolveHistoryItemRefsCommonAncestor([
                historyItemRef.name,
                historyItemRemoteRef.name
            ]);
            if (mergeBase && historyItem.id === SCMIncomingHistoryItemId) {
                // Incoming changes history item
                title = `${historyItem.subject} - ${historyItemRef.name} \u2194 ${historyItemRemoteRef.name}`;
                historyItemId = historyItemRemoteRef.id;
                historyItemParentId = mergeBase;
            }
            else if (mergeBase && historyItem.id === SCMOutgoingHistoryItemId) {
                // Outgoing changes history item
                title = `${historyItem.subject} - ${historyItemRemoteRef.name} \u2194 ${historyItemRef.name}`;
                historyItemId = historyItemRef.id;
                historyItemParentId = mergeBase;
            }
        }
        else {
            title = getHistoryItemEditorTitle(historyItem);
            historyItemId = historyItem.id;
            if (historyItem.parentIds.length > 0) {
                // History item right above the incoming changes history item
                if (historyItem.parentIds[0] === SCMIncomingHistoryItemId && historyItemRemoteRef) {
                    historyItemParentId = await historyProvider.resolveHistoryItemRefsCommonAncestor([
                        historyItemRef.name,
                        historyItemRemoteRef.name
                    ]);
                }
                else {
                    historyItemParentId = historyItem.parentIds[0];
                }
            }
        }
        if (!title || !historyItemId || !historyItemParentId) {
            return;
        }
        const multiDiffSourceUri = ScmHistoryItemResolver.getMultiDiffSourceUri(provider, historyItemId, historyItemParentId, '');
        commandService.executeCommand('_workbench.openMultiDiffEditor', { title, multiDiffSourceUri });
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'workbench.scm.action.graph.openFile',
            title: localize('openFile', "Open File"),
            icon: Codicon.goToFile,
            f1: false,
            menu: [
                {
                    id: MenuId.SCMHistoryItemChangeContext,
                    group: 'inline',
                    order: 1
                },
                {
                    id: MenuId.SCMHistoryItemChangeContext,
                    group: '0_view',
                    order: 1
                }
            ]
        });
    }
    async run(accessor, historyItem, historyItemChange) {
        const editorService = accessor.get(IEditorService);
        if (!historyItem || !historyItemChange.modifiedUri) {
            return;
        }
        let version;
        if (historyItem.id === SCMIncomingHistoryItemId) {
            version = localize('incomingChanges', "Incoming Changes");
        }
        else if (historyItem.id === SCMOutgoingHistoryItemId) {
            version = localize('outgoingChanges', "Outgoing Changes");
        }
        else {
            version = historyItem.displayId ?? historyItem.id;
        }
        const name = basename(historyItemChange.modifiedUri.fsPath);
        await editorService.openEditor({ resource: historyItemChange.modifiedUri, label: `${name} (${version})` });
    }
});
class ListDelegate {
    getHeight() {
        return 22;
    }
    getTemplateId(element) {
        if (isSCMHistoryItemViewModelTreeElement(element)) {
            return HistoryItemRenderer.TEMPLATE_ID;
        }
        else if (isSCMHistoryItemChangeViewModelTreeElement(element) || isSCMHistoryItemChangeNode(element)) {
            return HistoryItemChangeRenderer.TEMPLATE_ID;
        }
        else if (isSCMHistoryItemLoadMoreTreeElement(element)) {
            return HistoryItemLoadMoreRenderer.TEMPLATE_ID;
        }
        else {
            throw new Error('Unknown element');
        }
    }
}
let HistoryItemRenderer = class HistoryItemRenderer {
    static { HistoryItemRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'history-item'; }
    get templateId() { return HistoryItemRenderer_1.TEMPLATE_ID; }
    constructor(hoverDelegate, _commandService, _configurationService, _contextKeyService, _contextMenuService, _hoverService, _keybindingService, _markdownRendererService, _menuService, _telemetryService) {
        this.hoverDelegate = hoverDelegate;
        this._commandService = _commandService;
        this._configurationService = _configurationService;
        this._contextKeyService = _contextKeyService;
        this._contextMenuService = _contextMenuService;
        this._hoverService = _hoverService;
        this._keybindingService = _keybindingService;
        this._markdownRendererService = _markdownRendererService;
        this._menuService = _menuService;
        this._telemetryService = _telemetryService;
        this._badgesConfig = observableConfigValue('scm.graph.badges', 'filter', this._configurationService);
    }
    renderTemplate(container) {
        const element = append(container, $('.history-item'));
        const graphContainer = append(element, $('.graph-container'));
        const iconLabel = new IconLabel(element, {
            supportIcons: true, supportHighlights: true, supportDescriptionHighlights: true
        });
        const labelContainer = append(element, $('.label-container'));
        const actionsContainer = append(element, $('.actions'));
        const actionBar = new WorkbenchToolBar(actionsContainer, undefined, this._menuService, this._contextKeyService, this._contextMenuService, this._keybindingService, this._commandService, this._telemetryService);
        return { element, graphContainer, label: iconLabel, labelContainer, actionBar, elementDisposables: new DisposableStore(), disposables: combinedDisposable(iconLabel, actionBar) };
    }
    renderElement(node, index, templateData) {
        const provider = node.element.repository.provider;
        const historyItemViewModel = node.element.historyItemViewModel;
        const historyItem = historyItemViewModel.historyItem;
        const { content, disposables } = this.toHistoryItemHoverContent(historyItem);
        const historyItemHover = this._hoverService.setupManagedHover(this.hoverDelegate, templateData.element, content);
        templateData.elementDisposables.add(historyItemHover);
        templateData.elementDisposables.add(disposables);
        templateData.graphContainer.textContent = '';
        templateData.graphContainer.classList.toggle('current', historyItemViewModel.kind === 'HEAD');
        templateData.graphContainer.classList.toggle('incoming-changes', historyItemViewModel.kind === 'incoming-changes');
        templateData.graphContainer.classList.toggle('outgoing-changes', historyItemViewModel.kind === 'outgoing-changes');
        templateData.graphContainer.appendChild(renderSCMHistoryItemGraph(historyItemViewModel));
        const historyItemRef = provider.historyProvider.get()?.historyItemRef?.get();
        const extraClasses = historyItemRef?.revision === historyItem.id ? ['history-item-current'] : [];
        const [matches, descriptionMatches] = this._processMatches(historyItemViewModel, node.filterData);
        templateData.label.setLabel(historyItem.subject, historyItem.author, { matches, descriptionMatches, extraClasses });
        this._renderBadges(historyItem, templateData);
        const actions = this._menuService.getMenuActions(MenuId.SCMHistoryItemContext, this._contextKeyService, { arg: provider, shouldForwardArgs: true });
        templateData.actionBar.context = historyItem;
        templateData.actionBar.setActions(getActionBarActions(actions, 'inline').primary);
    }
    renderCompressedElements(node, index, templateData) {
        throw new Error('Should never happen since node is incompressible');
    }
    _renderBadges(historyItem, templateData) {
        templateData.elementDisposables.add(autorun(reader => {
            const labelConfig = this._badgesConfig.read(reader);
            templateData.labelContainer.replaceChildren();
            const references = historyItem.references ?
                historyItem.references.slice(0) : [];
            // If the first reference is colored, we render it
            // separately since we have to show the description
            // for the first colored reference.
            if (references.length > 0 && references[0].color) {
                this._renderBadge([references[0]], true, templateData);
                // Remove the rendered reference from the collection
                references.splice(0, 1);
            }
            // Group history item references by color
            const historyItemRefsByColor = groupBy2(references, ref => ref.color ? ref.color : '');
            for (const [key, historyItemRefs] of Object.entries(historyItemRefsByColor)) {
                // If needed skip badges without a color
                if (key === '' && labelConfig !== 'all') {
                    continue;
                }
                if (!historyItemRefs) {
                    continue;
                }
                // Group history item references by icon
                const historyItemRefByIconId = groupBy2(historyItemRefs, ref => ThemeIcon.isThemeIcon(ref.icon) ? ref.icon.id : '');
                for (const [key, historyItemRefs] of Object.entries(historyItemRefByIconId)) {
                    // Skip badges without an icon
                    if (key === '' || !historyItemRefs) {
                        continue;
                    }
                    this._renderBadge(historyItemRefs, false, templateData);
                }
            }
        }));
    }
    _renderBadge(historyItemRefs, showDescription, templateData) {
        if (historyItemRefs.length === 0 || !ThemeIcon.isThemeIcon(historyItemRefs[0].icon)) {
            return;
        }
        const elements = h('div.label', {
            style: {
                color: historyItemRefs[0].color ? asCssVariable(historyItemHoverLabelForeground) : asCssVariable(foreground),
                backgroundColor: historyItemRefs[0].color ? asCssVariable(historyItemRefs[0].color) : asCssVariable(historyItemHoverDefaultLabelBackground)
            }
        }, [
            h('div.count@count', {
                style: {
                    display: historyItemRefs.length > 1 ? '' : 'none'
                }
            }),
            h('div.icon@icon'),
            h('div.description@description', {
                style: {
                    display: showDescription ? '' : 'none'
                }
            })
        ]);
        elements.count.textContent = historyItemRefs.length > 1 ? historyItemRefs.length.toString() : '';
        elements.icon.classList.add(...ThemeIcon.asClassNameArray(historyItemRefs[0].icon));
        elements.description.textContent = showDescription ? historyItemRefs[0].name : '';
        append(templateData.labelContainer, elements.root);
    }
    toHistoryItemHoverContent(historyItem) {
        // Depracte when we removed the usage of `this._hoverService.setupManagedHover`
        const { content, disposables } = toHistoryItemHoverContent(this._markdownRendererService, historyItem, true);
        if (isMarkdownString(content)) {
            return {
                content: {
                    markdown: content,
                    markdownNotSupportedFallback: historyItem.message
                },
                disposables
            };
        }
        return { content, disposables };
    }
    _processMatches(historyItemViewModel, filterData) {
        if (!filterData) {
            return [undefined, undefined];
        }
        return [
            historyItemViewModel.historyItem.message === filterData.label ? createMatches(filterData.score) : undefined,
            historyItemViewModel.historyItem.author === filterData.label ? createMatches(filterData.score) : undefined
        ];
    }
    disposeElement(element, index, templateData) {
        templateData.elementDisposables.clear();
    }
    disposeTemplate(templateData) {
        templateData.elementDisposables.dispose();
        templateData.disposables.dispose();
    }
};
HistoryItemRenderer = HistoryItemRenderer_1 = __decorate([
    __param(1, ICommandService),
    __param(2, IConfigurationService),
    __param(3, IContextKeyService),
    __param(4, IContextMenuService),
    __param(5, IHoverService),
    __param(6, IKeybindingService),
    __param(7, IMarkdownRendererService),
    __param(8, IMenuService),
    __param(9, ITelemetryService)
], HistoryItemRenderer);
let HistoryItemChangeRenderer = class HistoryItemChangeRenderer {
    static { HistoryItemChangeRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'history-item-change'; }
    get templateId() { return HistoryItemChangeRenderer_1.TEMPLATE_ID; }
    constructor(viewMode, resourceLabels, _commandService, _contextKeyService, _contextMenuService, _keybindingService, _labelService, _menuService, _telemetryService) {
        this.viewMode = viewMode;
        this.resourceLabels = resourceLabels;
        this._commandService = _commandService;
        this._contextKeyService = _contextKeyService;
        this._contextMenuService = _contextMenuService;
        this._keybindingService = _keybindingService;
        this._labelService = _labelService;
        this._menuService = _menuService;
        this._telemetryService = _telemetryService;
    }
    renderTemplate(container) {
        const rowElement = container.parentElement;
        const element = append(container, $('.history-item-change'));
        const graphPlaceholder = append(element, $('.graph-placeholder'));
        const labelContainer = append(element, $('.label-container'));
        const resourceLabel = this.resourceLabels.create(labelContainer, {
            supportDescriptionHighlights: true, supportHighlights: true
        });
        const disposables = new DisposableStore();
        const actionsContainer = append(resourceLabel.element, $('.actions'));
        const actionBar = new WorkbenchToolBar(actionsContainer, undefined, this._menuService, this._contextKeyService, this._contextMenuService, this._keybindingService, this._commandService, this._telemetryService);
        disposables.add(actionBar);
        return { rowElement, element, graphPlaceholder, resourceLabel, actionBar, disposables };
    }
    renderElement(elementOrNode, index, templateData, details) {
        const historyItemViewModel = isSCMHistoryItemChangeViewModelTreeElement(elementOrNode.element) ? elementOrNode.element.historyItemViewModel : elementOrNode.element.context.historyItemViewModel;
        const historyItemChange = isSCMHistoryItemChangeViewModelTreeElement(elementOrNode.element) ? elementOrNode.element.historyItemChange : elementOrNode.element;
        const graphColumns = isSCMHistoryItemChangeViewModelTreeElement(elementOrNode.element) ? elementOrNode.element.graphColumns : elementOrNode.element.context.historyItemViewModel.outputSwimlanes;
        this._renderGraphPlaceholder(templateData, historyItemViewModel, graphColumns);
        const hidePath = this.viewMode() === "tree" /* ViewMode.Tree */;
        const fileKind = isSCMHistoryItemChangeViewModelTreeElement(elementOrNode.element) ? FileKind.FILE : FileKind.FOLDER;
        templateData.resourceLabel.setFile(historyItemChange.uri, { fileDecorations: { colors: false, badges: true }, fileKind, hidePath });
        if (fileKind === FileKind.FILE) {
            const actions = this._menuService.getMenuActions(MenuId.SCMHistoryItemChangeContext, this._contextKeyService, { arg: historyItemViewModel.historyItem, shouldForwardArgs: true });
            templateData.actionBar.context = historyItemChange;
            templateData.actionBar.setActions(getActionBarActions(actions, 'inline').primary);
        }
        else {
            templateData.actionBar.context = undefined;
            templateData.actionBar.setActions([]);
        }
    }
    renderCompressedElements(node, index, templateData, details) {
        const compressed = node.element;
        const historyItemViewModel = compressed.elements[0].context.historyItemViewModel;
        const graphColumns = compressed.elements[0].context.historyItemViewModel.outputSwimlanes;
        this._renderGraphPlaceholder(templateData, historyItemViewModel, graphColumns);
        const label = compressed.elements.map(e => e.name);
        const folder = compressed.elements[compressed.elements.length - 1];
        templateData.resourceLabel.setResource({ resource: folder.uri, name: label }, {
            fileDecorations: { colors: false, badges: true },
            fileKind: FileKind.FOLDER,
            separator: this._labelService.getSeparator(folder.uri.scheme)
        });
        templateData.actionBar.context = undefined;
        templateData.actionBar.setActions([]);
    }
    _renderGraphPlaceholder(templateData, historyItemViewModel, graphColumns) {
        const graphPlaceholderSvgWidth = SWIMLANE_WIDTH * (graphColumns.length + 1);
        const marginLeft = graphPlaceholderSvgWidth - 16 /* .monaco-tl-indent left */;
        templateData.rowElement.style.marginLeft = `${marginLeft}px`;
        templateData.graphPlaceholder.textContent = '';
        templateData.graphPlaceholder.style.left = `${-1 * marginLeft}px`;
        templateData.graphPlaceholder.style.width = `${graphPlaceholderSvgWidth}px`;
        templateData.graphPlaceholder.appendChild(renderSCMHistoryGraphPlaceholder(graphColumns, getHistoryItemIndex(historyItemViewModel)));
    }
    disposeTemplate(templateData) {
        templateData.disposables.dispose();
    }
};
HistoryItemChangeRenderer = HistoryItemChangeRenderer_1 = __decorate([
    __param(2, ICommandService),
    __param(3, IContextKeyService),
    __param(4, IContextMenuService),
    __param(5, IKeybindingService),
    __param(6, ILabelService),
    __param(7, IMenuService),
    __param(8, ITelemetryService)
], HistoryItemChangeRenderer);
let HistoryItemLoadMoreRenderer = class HistoryItemLoadMoreRenderer {
    static { HistoryItemLoadMoreRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'historyItemLoadMore'; }
    get templateId() { return HistoryItemLoadMoreRenderer_1.TEMPLATE_ID; }
    constructor(_isLoadingMore, _loadMoreCallback, _configurationService) {
        this._isLoadingMore = _isLoadingMore;
        this._loadMoreCallback = _loadMoreCallback;
        this._configurationService = _configurationService;
    }
    renderTemplate(container) {
        const element = append(container, $('.history-item-load-more'));
        const graphPlaceholder = append(element, $('.graph-placeholder'));
        const historyItemPlaceholderContainer = append(element, $('.history-item-placeholder'));
        const historyItemPlaceholderLabel = new IconLabel(historyItemPlaceholderContainer, { supportIcons: true });
        return { element, graphPlaceholder, historyItemPlaceholderContainer, historyItemPlaceholderLabel, elementDisposables: new DisposableStore(), disposables: historyItemPlaceholderLabel };
    }
    renderElement(element, index, templateData) {
        templateData.graphPlaceholder.textContent = '';
        templateData.graphPlaceholder.style.width = `${SWIMLANE_WIDTH * (element.element.graphColumns.length + 1)}px`;
        templateData.graphPlaceholder.appendChild(renderSCMHistoryGraphPlaceholder(element.element.graphColumns));
        const pageOnScroll = this._configurationService.getValue('scm.graph.pageOnScroll') === true;
        templateData.historyItemPlaceholderContainer.classList.toggle('shimmer', pageOnScroll);
        if (pageOnScroll) {
            templateData.historyItemPlaceholderLabel.setLabel('');
            this._loadMoreCallback();
        }
        else {
            templateData.elementDisposables.add(autorun(reader => {
                const isLoadingMore = this._isLoadingMore.read(reader);
                const icon = `$(${isLoadingMore ? 'loading~spin' : 'fold-down'})`;
                templateData.historyItemPlaceholderLabel.setLabel(localize('loadMore', "{0} Load More...", icon));
            }));
        }
    }
    renderCompressedElements(node, index, templateData) {
        throw new Error('Should never happen since node is incompressible');
    }
    disposeElement(element, index, templateData) {
        templateData.elementDisposables.clear();
    }
    disposeTemplate(templateData) {
        templateData.elementDisposables.dispose();
        templateData.disposables.dispose();
    }
};
HistoryItemLoadMoreRenderer = HistoryItemLoadMoreRenderer_1 = __decorate([
    __param(2, IConfigurationService)
], HistoryItemLoadMoreRenderer);
let HistoryItemHoverDelegate = class HistoryItemHoverDelegate extends WorkbenchHoverDelegate {
    constructor(_viewContainerLocation, layoutService, configurationService, hoverService) {
        super(_viewContainerLocation === 1 /* ViewContainerLocation.Panel */ ? 'mouse' : 'element', {
            instantHover: _viewContainerLocation !== 1 /* ViewContainerLocation.Panel */
        }, () => this.getHoverOptions(), configurationService, hoverService);
        this._viewContainerLocation = _viewContainerLocation;
        this.layoutService = layoutService;
    }
    getHoverOptions() {
        const sideBarPosition = this.layoutService.getSideBarPosition();
        let hoverPosition;
        if (this._viewContainerLocation === 0 /* ViewContainerLocation.Sidebar */) {
            hoverPosition = sideBarPosition === 0 /* Position.LEFT */ ? 1 /* HoverPosition.RIGHT */ : 0 /* HoverPosition.LEFT */;
        }
        else if (this._viewContainerLocation === 2 /* ViewContainerLocation.AuxiliaryBar */) {
            hoverPosition = sideBarPosition === 0 /* Position.LEFT */ ? 0 /* HoverPosition.LEFT */ : 1 /* HoverPosition.RIGHT */;
        }
        else {
            hoverPosition = 1 /* HoverPosition.RIGHT */;
        }
        return { additionalClasses: ['history-item-hover'], position: { hoverPosition, forcePosition: true } };
    }
};
HistoryItemHoverDelegate = __decorate([
    __param(1, IWorkbenchLayoutService),
    __param(2, IConfigurationService),
    __param(3, IHoverService)
], HistoryItemHoverDelegate);
let SCMHistoryViewPaneActionRunner = class SCMHistoryViewPaneActionRunner extends ActionRunner {
    constructor(_progressService) {
        super();
        this._progressService = _progressService;
    }
    runAction(action, context) {
        return this._progressService.withProgress({ location: HISTORY_VIEW_PANE_ID }, async () => await super.runAction(action, context));
    }
};
SCMHistoryViewPaneActionRunner = __decorate([
    __param(0, IProgressService)
], SCMHistoryViewPaneActionRunner);
class SCMHistoryTreeAccessibilityProvider {
    getWidgetAriaLabel() {
        return localize('scm history', "Source Control History");
    }
    getAriaLabel(element) {
        if (isSCMRepository(element)) {
            return `${element.provider.name} ${element.provider.label}`;
        }
        else if (isSCMHistoryItemViewModelTreeElement(element)) {
            const historyItem = element.historyItemViewModel.historyItem;
            return `${stripIcons(historyItem.message).trim()}${historyItem.author ? `, ${historyItem.author}` : ''}`;
        }
        else {
            return '';
        }
    }
}
class SCMHistoryTreeIdentityProvider {
    getId(element) {
        if (isSCMRepository(element)) {
            const provider = element.provider;
            return `repo:${provider.id}`;
        }
        else if (isSCMHistoryItemViewModelTreeElement(element)) {
            const provider = element.repository.provider;
            const historyItem = element.historyItemViewModel.historyItem;
            return `historyItem:${provider.id}/${historyItem.id}/${historyItem.parentIds.join(',')}`;
        }
        else if (isSCMHistoryItemChangeViewModelTreeElement(element)) {
            const provider = element.repository.provider;
            const historyItem = element.historyItemViewModel.historyItem;
            return `historyItemChange:${provider.id}/${historyItem.id}/${historyItem.parentIds.join(',')}/${element.historyItemChange.uri.fsPath}`;
        }
        else if (isSCMHistoryItemChangeNode(element)) {
            const provider = element.context.repository.provider;
            const historyItem = element.context.historyItemViewModel.historyItem;
            return `historyItemChangeFolder:${provider.id}/${historyItem.id}/${historyItem.parentIds.join(',')}/${element.uri.fsPath}`;
        }
        else if (isSCMHistoryItemLoadMoreTreeElement(element)) {
            const provider = element.repository.provider;
            return `historyItemLoadMore:${provider.id}`;
        }
        else {
            throw new Error('Invalid tree element');
        }
    }
}
class SCMHistoryTreeKeyboardNavigationLabelProvider {
    getKeyboardNavigationLabel(element) {
        if (isSCMRepository(element)) {
            return undefined;
        }
        else if (isSCMHistoryItemViewModelTreeElement(element)) {
            // For a history item we want to match both the message and
            // the author. A match in the message takes precedence over
            // a match in the author.
            return [element.historyItemViewModel.historyItem.message, element.historyItemViewModel.historyItem.author];
        }
        else if (isSCMHistoryItemLoadMoreTreeElement(element)) {
            // We don't want to match the load more element
            return '';
        }
        else {
            throw new Error('Invalid tree element');
        }
    }
    getCompressedNodeKeyboardNavigationLabel(elements) {
        const folders = elements;
        return folders.map(e => e.name).join('/');
    }
}
class SCMHistoryTreeCompressionDelegate {
    isIncompressible(element) {
        if (ResourceTree.isResourceNode(element)) {
            return element.childrenCount === 0 || !element.parent || !element.parent.parent;
        }
        return true;
    }
}
class SCMHistoryTreeDataSource extends Disposable {
    constructor(viewMode) {
        super();
        this.viewMode = viewMode;
    }
    async getChildren(inputOrElement) {
        const children = [];
        if (inputOrElement instanceof SCMHistoryViewModel) {
            // History items
            const historyItems = await inputOrElement.getHistoryItems();
            children.push(...historyItems);
            // Load More element
            const repository = inputOrElement.repository.get();
            const lastHistoryItem = historyItems.at(-1);
            if (repository && lastHistoryItem && lastHistoryItem.historyItemViewModel.outputSwimlanes.length > 0) {
                children.push({
                    repository,
                    graphColumns: lastHistoryItem.historyItemViewModel.outputSwimlanes,
                    type: 'historyItemLoadMore'
                });
            }
        }
        else if (isSCMHistoryItemViewModelTreeElement(inputOrElement)) {
            // History item changes
            const historyProvider = inputOrElement.repository.provider.historyProvider.get();
            const historyItemViewModel = inputOrElement.historyItemViewModel;
            const historyItem = historyItemViewModel.historyItem;
            let historyItemId, historyItemParentId;
            if (historyItemViewModel.kind === 'incoming-changes' ||
                historyItemViewModel.kind === 'outgoing-changes') {
                // Incoming/Outgoing changes history item
                const historyItemRef = historyProvider?.historyItemRef.get();
                const historyItemRemoteRef = historyProvider?.historyItemRemoteRef.get();
                if (!historyProvider || !historyItemRef || !historyItemRemoteRef) {
                    return [];
                }
                historyItemId = historyItemViewModel.kind === 'incoming-changes'
                    ? historyItemRemoteRef.id
                    : historyItemRef.id;
                historyItemParentId = await historyProvider.resolveHistoryItemRefsCommonAncestor([
                    historyItemRef.name,
                    historyItemRemoteRef.name
                ]);
            }
            else {
                // History item
                historyItemId = historyItem.id;
                if (historyItem.parentIds.length > 0) {
                    // History item right above the incoming changes history item
                    if (historyItem.parentIds[0] === SCMIncomingHistoryItemId) {
                        const historyItemRef = historyProvider?.historyItemRef.get();
                        const historyItemRemoteRef = historyProvider?.historyItemRemoteRef.get();
                        if (!historyProvider || !historyItemRef || !historyItemRemoteRef) {
                            return [];
                        }
                        historyItemParentId = await historyProvider.resolveHistoryItemRefsCommonAncestor([
                            historyItemRef.name,
                            historyItemRemoteRef.name
                        ]);
                    }
                    else {
                        historyItemParentId = historyItem.parentIds[0];
                    }
                }
            }
            const historyItemChanges = await historyProvider?.provideHistoryItemChanges(historyItemId, historyItemParentId) ?? [];
            if (this.viewMode() === "list" /* ViewMode.List */) {
                // List
                children.push(...historyItemChanges.map(change => ({
                    repository: inputOrElement.repository,
                    historyItemViewModel: inputOrElement.historyItemViewModel,
                    historyItemChange: change,
                    graphColumns: inputOrElement.historyItemViewModel.outputSwimlanes,
                    type: 'historyItemChangeViewModel'
                })));
            }
            else if (this.viewMode() === "tree" /* ViewMode.Tree */) {
                // Tree
                const rootUri = inputOrElement.repository.provider.rootUri ?? URI.file('/');
                const historyItemChangesTree = new ResourceTree(inputOrElement, rootUri);
                for (const change of historyItemChanges) {
                    historyItemChangesTree.add(change.uri, {
                        repository: inputOrElement.repository,
                        historyItemViewModel: inputOrElement.historyItemViewModel,
                        historyItemChange: change,
                        graphColumns: inputOrElement.historyItemViewModel.outputSwimlanes,
                        type: 'historyItemChangeViewModel'
                    });
                }
                for (const node of historyItemChangesTree.root.children) {
                    children.push(node.element ?? node);
                }
            }
        }
        else if (ResourceTree.isResourceNode(inputOrElement) && isSCMHistoryItemChangeNode(inputOrElement)) {
            // Tree
            for (const node of inputOrElement.children) {
                children.push(node.element && node.childrenCount === 0 ? node.element : node);
            }
        }
        return children;
    }
    hasChildren(inputOrElement) {
        return inputOrElement instanceof SCMHistoryViewModel ||
            isSCMHistoryItemViewModelTreeElement(inputOrElement) ||
            (isSCMHistoryItemChangeNode(inputOrElement) && inputOrElement.childrenCount > 0);
    }
}
class SCMHistoryTreeDragAndDrop {
    getDragURI(element) {
        const uri = this._getTreeElementUri(element);
        return uri ? uri.toString() : null;
    }
    onDragStart(data, originalEvent) {
        if (!originalEvent.dataTransfer) {
            return;
        }
        const historyItems = this._getDragAndDropData(data);
        if (historyItems.length === 0) {
            return;
        }
        originalEvent.dataTransfer.setData(CodeDataTransfers.SCM_HISTORY_ITEM, JSON.stringify(historyItems));
    }
    getDragLabel(elements, originalEvent) {
        if (elements.length === 1) {
            const element = elements[0];
            return this._getTreeElementLabel(element);
        }
        return String(elements.length);
    }
    onDragOver(data, targetElement, targetIndex, targetSector, originalEvent) {
        return false;
    }
    drop(data, targetElement, targetIndex, targetSector, originalEvent) { }
    _getDragAndDropData(data) {
        const historyItems = [];
        for (const element of [...data.context ?? [], ...data.elements]) {
            if (!isSCMHistoryItemViewModelTreeElement(element)) {
                continue;
            }
            const provider = element.repository.provider;
            const historyItem = element.historyItemViewModel.historyItem;
            const attachmentName = `$(${Codicon.repo.id})\u00A0${provider.name}\u00A0$(${Codicon.gitCommit.id})\u00A0${historyItem.displayId ?? historyItem.id}`;
            const historyItemParentId = historyItem.parentIds.length > 0 ? historyItem.parentIds[0] : undefined;
            historyItems.push({
                name: attachmentName,
                resource: ScmHistoryItemResolver.getMultiDiffSourceUri(provider, historyItem.id, historyItemParentId, historyItem.displayId),
                historyItem: historyItem
            });
        }
        return historyItems;
    }
    _getTreeElementLabel(element) {
        if (isSCMHistoryItemViewModelTreeElement(element)) {
            const historyItem = element.historyItemViewModel.historyItem;
            return historyItem.displayId ?? historyItem.id;
        }
        return undefined;
    }
    _getTreeElementUri(element) {
        if (isSCMHistoryItemViewModelTreeElement(element)) {
            const provider = element.repository.provider;
            const historyItem = element.historyItemViewModel.historyItem;
            const historyItemParentId = historyItem.parentIds.length > 0 ? historyItem.parentIds[0] : undefined;
            return ScmHistoryItemResolver.getMultiDiffSourceUri(provider, historyItem.id, historyItemParentId, historyItem.displayId);
        }
        return undefined;
    }
    dispose() { }
}
let SCMHistoryViewModel = class SCMHistoryViewModel extends Disposable {
    constructor(_configurationService, _contextKeyService, _extensionService, _scmService, _scmViewService, _storageService) {
        super();
        this._configurationService = _configurationService;
        this._contextKeyService = _contextKeyService;
        this._extensionService = _extensionService;
        this._scmService = _scmService;
        this._scmViewService = _scmViewService;
        this._storageService = _storageService;
        this._selectedRepository = observableValue(this, 'auto');
        this.onDidChangeHistoryItemsFilter = observableSignal(this);
        this.isViewModelEmpty = observableValue(this, false);
        this._repositoryState = new Map();
        this._repositoryFilterState = new Map();
        this._repositoryFilterState = this._loadHistoryItemsFilterState();
        this.viewMode = observableValue(this, this._getViewMode());
        this._extensionService.onWillStop(this._saveHistoryItemsFilterState, this, this._store);
        this._storageService.onWillSaveState(this._saveHistoryItemsFilterState, this, this._store);
        this._scmHistoryItemCountCtx = ContextKeys.SCMHistoryItemCount.bindTo(this._contextKeyService);
        this._scmHistoryViewModeCtx = ContextKeys.SCMHistoryViewMode.bindTo(this._contextKeyService);
        this._scmHistoryViewModeCtx.set(this.viewMode.get());
        const firstRepository = this._scmService.repositoryCount > 0
            ? constObservable(Iterable.first(this._scmService.repositories))
            : observableFromEvent(this, Event.once(this._scmService.onDidAddRepository), repository => repository);
        const graphRepository = derived(reader => {
            const selectedRepository = this._selectedRepository.read(reader);
            if (selectedRepository !== 'auto') {
                return selectedRepository;
            }
            return this._scmViewService.activeRepository.read(reader)?.repository;
        });
        this.repository = latestChangedValue(this, [firstRepository, graphRepository]);
        const closedRepository = observableFromEvent(this, this._scmService.onDidRemoveRepository, repository => repository);
        // Closed repository cleanup
        this._register(autorun(reader => {
            const repository = closedRepository.read(reader);
            if (!repository) {
                return;
            }
            if (this.repository.read(undefined) === repository) {
                this._selectedRepository.set(Iterable.first(this._scmService.repositories) ?? 'auto', undefined);
            }
            this._repositoryState.delete(repository);
        }));
    }
    clearRepositoryState() {
        const repository = this.repository.get();
        if (!repository) {
            return;
        }
        this._repositoryState.delete(repository);
    }
    getHistoryItemsFilter() {
        const repository = this.repository.get();
        if (!repository) {
            return;
        }
        const filterState = this._repositoryFilterState.get(getProviderKey(repository.provider)) ?? 'auto';
        if (filterState === 'all' || filterState === 'auto') {
            return filterState;
        }
        const repositoryState = this._repositoryState.get(repository);
        return repositoryState?.historyItemsFilter;
    }
    getCurrentHistoryItemTreeElement() {
        const repository = this.repository.get();
        if (!repository) {
            return undefined;
        }
        const state = this._repositoryState.get(repository);
        if (!state) {
            return undefined;
        }
        const historyProvider = repository?.provider.historyProvider.get();
        const historyItemRef = historyProvider?.historyItemRef.get();
        return state.viewModels
            .find(viewModel => viewModel.historyItemViewModel.historyItem.id === historyItemRef?.revision);
    }
    loadMore(cursor) {
        const repository = this.repository.get();
        if (!repository) {
            return;
        }
        const state = this._repositoryState.get(repository);
        if (!state) {
            return;
        }
        this._repositoryState.set(repository, { ...state, loadMore: cursor ?? true });
    }
    async getHistoryItems() {
        const repository = this.repository.get();
        const historyProvider = repository?.provider.historyProvider.get();
        const historyItemRef = historyProvider?.historyItemRef.get();
        const historyItemRemoteRef = historyProvider?.historyItemRemoteRef.get();
        if (!repository || !historyProvider) {
            this._scmHistoryItemCountCtx.set(0);
            this.isViewModelEmpty.set(true, undefined);
            return [];
        }
        let state = this._repositoryState.get(repository);
        if (!state || state.loadMore !== false) {
            const historyItems = state?.viewModels
                .filter(vm => vm.historyItemViewModel.kind !== 'incoming-changes' &&
                vm.historyItemViewModel.kind !== 'outgoing-changes')
                .map(vm => vm.historyItemViewModel.historyItem) ?? [];
            const historyItemRefs = state?.historyItemsFilter ??
                await this._resolveHistoryItemFilter(repository, historyProvider);
            const limit = clamp(this._configurationService.getValue('scm.graph.pageSize'), 1, 1000);
            const historyItemRefIds = historyItemRefs.map(ref => ref.revision ?? ref.id);
            do {
                // Fetch the next page of history items
                historyItems.push(...(await historyProvider.provideHistoryItems({
                    historyItemRefs: historyItemRefIds, limit, skip: historyItems.length
                }) ?? []));
            } while (typeof state?.loadMore === 'string' && !historyItems.find(item => item.id === state?.loadMore));
            // Compute the merge base
            const mergeBase = historyItemRef && historyItemRemoteRef && state?.mergeBase === undefined
                ? await historyProvider.resolveHistoryItemRefsCommonAncestor([
                    historyItemRef.name,
                    historyItemRemoteRef.name
                ])
                : state?.mergeBase;
            // Create the color map
            const colorMap = this._getGraphColorMap(historyItemRefs);
            // Only show incoming changes node if the remote history item reference is part of the graph
            const addIncomingChangesNode = this._scmViewService.graphShowIncomingChangesConfig.get()
                && historyItemRefs.some(ref => ref.id === historyItemRemoteRef?.id);
            // Only show outgoing changes node if the history item reference is part of the graph
            const addOutgoingChangesNode = this._scmViewService.graphShowOutgoingChangesConfig.get()
                && historyItemRefs.some(ref => ref.id === historyItemRef?.id);
            const viewModels = toISCMHistoryItemViewModelArray(historyItems, colorMap, historyProvider.historyItemRef.get(), historyProvider.historyItemRemoteRef.get(), historyProvider.historyItemBaseRef.get(), addIncomingChangesNode, addOutgoingChangesNode, mergeBase)
                .map(historyItemViewModel => ({
                repository,
                historyItemViewModel,
                type: 'historyItemViewModel'
            }));
            state = { historyItemsFilter: historyItemRefs, viewModels, mergeBase, loadMore: false };
            this._repositoryState.set(repository, state);
            this._scmHistoryItemCountCtx.set(viewModels.length);
            this.isViewModelEmpty.set(viewModels.length === 0, undefined);
        }
        return state.viewModels;
    }
    setRepository(repository) {
        this._selectedRepository.set(repository, undefined);
    }
    setHistoryItemsFilter(filter) {
        const repository = this.repository.get();
        if (!repository) {
            return;
        }
        if (filter !== 'auto') {
            this._repositoryFilterState.set(getProviderKey(repository.provider), filter);
        }
        else {
            this._repositoryFilterState.delete(getProviderKey(repository.provider));
        }
        this._saveHistoryItemsFilterState();
        this.onDidChangeHistoryItemsFilter.trigger(undefined);
    }
    setViewMode(viewMode) {
        if (viewMode === this.viewMode.get()) {
            return;
        }
        this.viewMode.set(viewMode, undefined);
        this._scmHistoryViewModeCtx.set(viewMode);
        this._storageService.store('scm.graphView.viewMode', viewMode, 1 /* StorageScope.WORKSPACE */, 0 /* StorageTarget.USER */);
    }
    _getViewMode() {
        let mode = this._configurationService.getValue('scm.defaultViewMode') === 'list' ? "list" /* ViewMode.List */ : "tree" /* ViewMode.Tree */;
        const storageMode = this._storageService.get('scm.graphView.viewMode', 1 /* StorageScope.WORKSPACE */);
        if (typeof storageMode === 'string') {
            mode = storageMode;
        }
        return mode;
    }
    _getGraphColorMap(historyItemRefs) {
        const repository = this.repository.get();
        const historyProvider = repository?.provider.historyProvider.get();
        const historyItemRef = historyProvider?.historyItemRef.get();
        const historyItemRemoteRef = historyProvider?.historyItemRemoteRef.get();
        const historyItemBaseRef = historyProvider?.historyItemBaseRef.get();
        const colorMap = new Map();
        if (historyItemRef) {
            colorMap.set(historyItemRef.id, historyItemRef.color);
            if (historyItemRemoteRef) {
                colorMap.set(historyItemRemoteRef.id, historyItemRemoteRef.color);
            }
            if (historyItemBaseRef) {
                colorMap.set(historyItemBaseRef.id, historyItemBaseRef.color);
            }
        }
        // Add the remaining history item references to the color map
        // if not already present. These history item references will
        // be colored using the color of the history item to which they
        // point to.
        for (const ref of historyItemRefs) {
            if (!colorMap.has(ref.id)) {
                colorMap.set(ref.id, undefined);
            }
        }
        return colorMap;
    }
    async _resolveHistoryItemFilter(repository, historyProvider) {
        const historyItemRefs = [];
        const historyItemsFilter = this._repositoryFilterState.get(getProviderKey(repository.provider)) ?? 'auto';
        switch (historyItemsFilter) {
            case 'all':
                historyItemRefs.push(...(await historyProvider.provideHistoryItemRefs() ?? []));
                break;
            case 'auto':
                historyItemRefs.push(...[
                    historyProvider.historyItemRef.get(),
                    historyProvider.historyItemRemoteRef.get(),
                    historyProvider.historyItemBaseRef.get(),
                ].filter(ref => !!ref));
                break;
            default: {
                // Get the latest revisions for the history items references in the filer
                const refs = (await historyProvider.provideHistoryItemRefs(historyItemsFilter) ?? [])
                    .filter(ref => historyItemsFilter.some(filter => filter === ref.id));
                if (refs.length === 0) {
                    // Reset the filter
                    historyItemRefs.push(...[
                        historyProvider.historyItemRef.get(),
                        historyProvider.historyItemRemoteRef.get(),
                        historyProvider.historyItemBaseRef.get(),
                    ].filter(ref => !!ref));
                    this._repositoryFilterState.delete(getProviderKey(repository.provider));
                }
                else {
                    // Update filter
                    historyItemRefs.push(...refs);
                    this._repositoryFilterState.set(getProviderKey(repository.provider), refs.map(ref => ref.id));
                }
                this._saveHistoryItemsFilterState();
                break;
            }
        }
        return historyItemRefs;
    }
    _loadHistoryItemsFilterState() {
        try {
            const filterData = this._storageService.get('scm.graphView.referencesFilter', 1 /* StorageScope.WORKSPACE */);
            if (filterData) {
                return new Map(JSON.parse(filterData));
            }
        }
        catch { }
        return new Map();
    }
    _saveHistoryItemsFilterState() {
        const filter = Array.from(this._repositoryFilterState.entries());
        this._storageService.store('scm.graphView.referencesFilter', JSON.stringify(filter), 1 /* StorageScope.WORKSPACE */, 0 /* StorageTarget.USER */);
    }
    dispose() {
        this._repositoryState.clear();
        super.dispose();
    }
};
SCMHistoryViewModel = __decorate([
    __param(0, IConfigurationService),
    __param(1, IContextKeyService),
    __param(2, IExtensionService),
    __param(3, ISCMService),
    __param(4, ISCMViewService),
    __param(5, IStorageService)
], SCMHistoryViewModel);
let RepositoryPicker = class RepositoryPicker {
    constructor(_quickInputService, _scmViewService) {
        this._quickInputService = _quickInputService;
        this._scmViewService = _scmViewService;
        this._autoQuickPickItem = {
            label: localize('auto', "Auto"),
            description: localize('activeRepository', "Show the source control graph for the active repository"),
            repository: 'auto'
        };
    }
    async pickRepository() {
        const picks = [
            this._autoQuickPickItem,
            { type: 'separator' }
        ];
        picks.push(...this._scmViewService.repositories.map(r => ({
            label: r.provider.name,
            description: r.provider.rootUri?.fsPath,
            iconClass: ThemeIcon.isThemeIcon(r.provider.iconPath)
                ? ThemeIcon.asClassName(r.provider.iconPath)
                : ThemeIcon.asClassName(Codicon.repo),
            repository: r
        })));
        return this._quickInputService.pick(picks, {
            placeHolder: localize('scmGraphRepository', "Select the repository to view, type to filter all repositories")
        });
    }
};
RepositoryPicker = __decorate([
    __param(0, IQuickInputService),
    __param(1, ISCMViewService)
], RepositoryPicker);
let HistoryItemRefPicker = class HistoryItemRefPicker extends Disposable {
    constructor(_historyProvider, _historyItemsFilter, _quickInputService) {
        super();
        this._historyProvider = _historyProvider;
        this._historyItemsFilter = _historyItemsFilter;
        this._quickInputService = _quickInputService;
        this._allQuickPickItem = {
            id: 'all',
            label: localize('all', "All"),
            description: localize('allHistoryItemRefs', "All history item references"),
            historyItemRef: 'all'
        };
        this._autoQuickPickItem = {
            id: 'auto',
            label: localize('auto', "Auto"),
            description: localize('currentHistoryItemRef', "Current history item reference(s)"),
            historyItemRef: 'auto'
        };
    }
    async pickHistoryItemRef() {
        const quickPick = this._quickInputService.createQuickPick({ useSeparators: true });
        this._store.add(quickPick);
        quickPick.placeholder = localize('scmGraphHistoryItemRef', "Select one/more history item references to view, type to filter");
        quickPick.canSelectMany = true;
        quickPick.hideCheckAll = true;
        quickPick.busy = true;
        quickPick.show();
        const items = await this._createQuickPickItems();
        // Set initial selection
        let selectedItems = [];
        if (this._historyItemsFilter === 'all') {
            selectedItems.push(this._allQuickPickItem);
        }
        else if (this._historyItemsFilter === 'auto') {
            selectedItems.push(this._autoQuickPickItem);
        }
        else {
            let index = 0;
            while (index < items.length) {
                if (items[index].type === 'separator') {
                    index++;
                    continue;
                }
                if (this._historyItemsFilter.some(ref => ref.id === items[index].id)) {
                    const item = items.splice(index, 1);
                    selectedItems.push(...item);
                }
                else {
                    index++;
                }
            }
            // Insert the selected items after `All` and `Auto`
            items.splice(2, 0, { type: 'separator' }, ...selectedItems);
        }
        quickPick.items = items;
        quickPick.selectedItems = selectedItems;
        quickPick.busy = false;
        return new Promise(resolve => {
            this._store.add(quickPick.onDidChangeSelection(items => {
                const { added } = delta(selectedItems, items, (a, b) => compare(a.id ?? '', b.id ?? ''));
                if (added.length > 0) {
                    if (added[0].historyItemRef === 'all' || added[0].historyItemRef === 'auto') {
                        quickPick.selectedItems = [added[0]];
                    }
                    else {
                        // Remove 'all' and 'auto' items if present
                        quickPick.selectedItems = [...quickPick.selectedItems
                                .filter(i => i.historyItemRef !== 'all' && i.historyItemRef !== 'auto')];
                    }
                }
                selectedItems = [...quickPick.selectedItems];
            }));
            this._store.add(quickPick.onDidAccept(() => {
                if (selectedItems.length === 0) {
                    resolve(undefined);
                }
                else if (selectedItems.length === 1 && selectedItems[0].historyItemRef === 'all') {
                    resolve('all');
                }
                else if (selectedItems.length === 1 && selectedItems[0].historyItemRef === 'auto') {
                    resolve('auto');
                }
                else {
                    resolve(selectedItems.map(item => item.historyItemRef.id));
                }
                quickPick.hide();
            }));
            this._store.add(quickPick.onDidHide(() => {
                resolve(undefined);
                this.dispose();
            }));
        });
    }
    async _createQuickPickItems() {
        const picks = [
            this._allQuickPickItem, this._autoQuickPickItem
        ];
        const historyItemRefs = await this._historyProvider.provideHistoryItemRefs() ?? [];
        const historyItemRefsByCategory = groupBy(historyItemRefs, (a, b) => compare(a.category ?? '', b.category ?? ''));
        for (const refs of historyItemRefsByCategory) {
            if (refs.length === 0) {
                continue;
            }
            picks.push({ type: 'separator', label: refs[0].category });
            picks.push(...refs.map(ref => {
                return {
                    id: ref.id,
                    label: ref.name,
                    description: ref.description,
                    iconClass: ThemeIcon.isThemeIcon(ref.icon) ?
                        ThemeIcon.asClassName(ref.icon) : undefined,
                    historyItemRef: ref
                };
            }));
        }
        return picks;
    }
};
HistoryItemRefPicker = __decorate([
    __param(2, IQuickInputService)
], HistoryItemRefPicker);
let SCMHistoryViewPane = class SCMHistoryViewPane extends ViewPane {
    constructor(options, _editorService, _instantiationService, _menuService, _progressService, _scmViewService, configurationService, contextMenuService, keybindingService, instantiationService, viewDescriptorService, contextKeyService, openerService, themeService, hoverService) {
        super({
            ...options,
            titleMenuId: MenuId.SCMHistoryTitle,
            showActions: ViewPaneShowActions.WhenExpanded
        }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this._editorService = _editorService;
        this._instantiationService = _instantiationService;
        this._menuService = _menuService;
        this._progressService = _progressService;
        this._scmViewService = _scmViewService;
        this._repositoryIsLoadingMore = observableValue(this, false);
        this._repositoryOutdated = observableValue(this, false);
        this._visibilityDisposables = new DisposableStore();
        this._treeOperationSequencer = new Sequencer();
        this._treeLoadMoreSequencer = new Sequencer();
        this._refreshThrottler = new Throttler();
        this._updateChildrenThrottler = new Throttler();
        this._contextMenuDisposables = new MutableDisposable();
        this._scmProviderCtx = ContextKeys.SCMProvider.bindTo(this.scopedContextKeyService);
        this._scmCurrentHistoryItemRefHasRemote = ContextKeys.SCMCurrentHistoryItemRefHasRemote.bindTo(this.scopedContextKeyService);
        this._scmCurrentHistoryItemRefHasBase = ContextKeys.SCMCurrentHistoryItemRefHasBase.bindTo(this.scopedContextKeyService);
        this._scmCurrentHistoryItemRefInFilter = ContextKeys.SCMCurrentHistoryItemRefInFilter.bindTo(this.scopedContextKeyService);
        this._actionRunner = this.instantiationService.createInstance(SCMHistoryViewPaneActionRunner);
        this._register(this._actionRunner);
        this._register(this._refreshThrottler);
        this._register(this._updateChildrenThrottler);
    }
    renderHeaderTitle(container) {
        super.renderHeaderTitle(container, this.title);
        const element = h('div.scm-graph-view-badge-container', [
            h('div.scm-graph-view-badge.monaco-count-badge.long@badge')
        ]);
        element.badge.textContent = 'Outdated';
        container.appendChild(element.root);
        this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), element.root, {
            markdown: {
                value: localize('scmGraphViewOutdated', "Please refresh the graph using the refresh action ($(refresh))."),
                supportThemeIcons: true
            },
            markdownNotSupportedFallback: undefined
        }));
        this._register(autorun(reader => {
            const outdated = this._repositoryOutdated.read(reader);
            element.root.style.display = outdated ? '' : 'none';
        }));
    }
    renderBody(container) {
        super.renderBody(container);
        this._treeContainer = append(container, $('.scm-view.scm-history-view.show-file-icons'));
        this._treeContainer.classList.add('file-icon-themable-tree');
        this._createTree(this._treeContainer);
        this.onDidChangeBodyVisibility(async (visible) => {
            if (!visible) {
                this._visibilityDisposables.clear();
                return;
            }
            // Create view model
            this._treeViewModel = this.instantiationService.createInstance(SCMHistoryViewModel);
            this._visibilityDisposables.add(this._treeViewModel);
            // Wait for first repository to be initialized
            const firstRepositoryInitialized = derived(this, reader => {
                const repository = this._treeViewModel.repository.read(reader);
                const historyProvider = repository?.provider.historyProvider.read(reader);
                const historyItemRef = historyProvider?.historyItemRef.read(reader);
                return historyItemRef !== undefined ? true : undefined;
            });
            await waitForState(firstRepositoryInitialized);
            // Initial rendering
            await this._progressService.withProgress({ location: this.id }, async () => {
                await this._treeOperationSequencer.queue(async () => {
                    await this._tree.setInput(this._treeViewModel);
                    this._tree.scrollTop = 0;
                });
            });
            this._visibilityDisposables.add(autorun(reader => {
                this._treeViewModel.isViewModelEmpty.read(reader);
                this._onDidChangeViewWelcomeState.fire();
            }));
            // Settings change
            this._visibilityDisposables.add(runOnChange(this._scmViewService.graphShowIncomingChangesConfig, async () => {
                await this.refresh();
            }));
            this._visibilityDisposables.add(runOnChange(this._scmViewService.graphShowOutgoingChangesConfig, async () => {
                await this.refresh();
            }));
            // Repository change
            let isFirstRun = true;
            this._visibilityDisposables.add(autorun(reader => {
                const repository = this._treeViewModel.repository.read(reader);
                const historyProvider = repository?.provider.historyProvider.read(reader);
                if (!repository || !historyProvider) {
                    return;
                }
                // HistoryItemId changed (checkout)
                const historyItemRefId = derived(reader => {
                    return historyProvider.historyItemRef.read(reader)?.id;
                });
                reader.store.add(runOnChange(historyItemRefId, async (historyItemRefIdValue) => {
                    await this.refresh();
                    // Update context key (needs to be done after the refresh call)
                    this._scmCurrentHistoryItemRefInFilter.set(this._isCurrentHistoryItemInFilter(historyItemRefIdValue));
                }));
                // HistoryItemRefs changed
                reader.store.add(runOnChange(historyProvider.historyItemRefChanges, changes => {
                    if (changes.silent) {
                        // The history item reference changes occurred in the background (ex: Auto Fetch)
                        // If tree is scrolled to the top, we can safely refresh the tree, otherwise we
                        // will show a visual cue that the view is outdated.
                        if (this._tree.scrollTop === 0) {
                            this.refresh();
                            return;
                        }
                        // Show the "Outdated" badge on the view
                        this._repositoryOutdated.set(true, undefined);
                        return;
                    }
                    this.refresh();
                }));
                // HistoryItemRefs filter changed
                reader.store.add(runOnChange(this._treeViewModel.onDidChangeHistoryItemsFilter, async () => {
                    await this.refresh();
                    // Update context key (needs to be done after the refresh call)
                    this._scmCurrentHistoryItemRefInFilter.set(this._isCurrentHistoryItemInFilter(historyItemRefId.read(undefined)));
                }));
                // HistoryItemRemoteRef changed
                reader.store.add(autorun(reader => {
                    this._scmCurrentHistoryItemRefHasRemote.set(!!historyProvider.historyItemRemoteRef.read(reader));
                }));
                // HistoryItemBaseRef changed
                reader.store.add(autorun(reader => {
                    this._scmCurrentHistoryItemRefHasBase.set(!!historyProvider.historyItemBaseRef.read(reader));
                }));
                // ViewMode changed
                reader.store.add(runOnChange(this._treeViewModel.viewMode, async () => {
                    await this._updateChildren();
                }));
                // Update context
                this._scmProviderCtx.set(repository.provider.providerId);
                this._scmCurrentHistoryItemRefInFilter.set(this._isCurrentHistoryItemInFilter(historyItemRefId.read(undefined)));
                // We skip refreshing the graph on the first execution of the autorun
                // since the graph for the first repository is rendered when the tree
                // input is set.
                if (!isFirstRun) {
                    this.refresh();
                }
                isFirstRun = false;
            }));
            // FileIconTheme & viewMode change
            const fileIconThemeObs = observableFromEvent(this.themeService.onDidFileIconThemeChange, () => this.themeService.getFileIconTheme());
            this._visibilityDisposables.add(autorun(reader => {
                const fileIconTheme = fileIconThemeObs.read(reader);
                const viewMode = this._treeViewModel.viewMode.read(reader);
                this._updateIndentStyles(fileIconTheme, viewMode);
            }));
        }, this, this._store);
    }
    layoutBody(height, width) {
        super.layoutBody(height, width);
        this._tree.layout(height, width);
    }
    getActionRunner() {
        return this._actionRunner;
    }
    getActionsContext() {
        return this._treeViewModel?.repository.get()?.provider;
    }
    createActionViewItem(action, options) {
        if (action.id === PICK_REPOSITORY_ACTION_ID) {
            const repository = this._treeViewModel?.repository.get();
            if (repository) {
                return new SCMRepositoryActionViewItem(repository, action, options);
            }
        }
        else if (action.id === PICK_HISTORY_ITEM_REFS_ACTION_ID) {
            const repository = this._treeViewModel?.repository.get();
            const historyItemsFilter = this._treeViewModel?.getHistoryItemsFilter();
            if (repository && historyItemsFilter) {
                return new SCMHistoryItemRefsActionViewItem(repository, historyItemsFilter, action, options);
            }
        }
        return super.createActionViewItem(action, options);
    }
    focus() {
        super.focus();
        const fakeKeyboardEvent = new KeyboardEvent('keydown');
        this._tree.focusFirst(fakeKeyboardEvent);
        this._tree.domFocus();
    }
    shouldShowWelcome() {
        return this._treeViewModel?.isViewModelEmpty.get() === true;
    }
    async refresh() {
        return this._refreshThrottler.queue(token => this._refresh(token));
    }
    async _refresh(token) {
        if (token.isCancellationRequested) {
            return;
        }
        this._treeViewModel.clearRepositoryState();
        await this._updateChildren();
        if (token.isCancellationRequested) {
            return;
        }
        this.updateActions();
        this._repositoryOutdated.set(false, undefined);
        this._tree.scrollTop = 0;
    }
    async pickRepository() {
        const picker = this._instantiationService.createInstance(RepositoryPicker);
        const result = await picker.pickRepository();
        if (result) {
            this._treeViewModel.setRepository(result.repository);
        }
    }
    async pickHistoryItemRef() {
        const repository = this._treeViewModel.repository.get();
        const historyProvider = repository?.provider.historyProvider.get();
        const historyItemsFilter = this._treeViewModel.getHistoryItemsFilter();
        if (!historyProvider || !historyItemsFilter) {
            return;
        }
        const picker = this._instantiationService.createInstance(HistoryItemRefPicker, historyProvider, historyItemsFilter);
        const result = await picker.pickHistoryItemRef();
        if (result) {
            this._treeViewModel.setHistoryItemsFilter(result);
        }
    }
    async revealCurrentHistoryItem() {
        const repository = this._treeViewModel.repository.get();
        const historyProvider = repository?.provider.historyProvider.get();
        const historyItemRef = historyProvider?.historyItemRef.get();
        if (!repository || !historyItemRef?.id || !historyItemRef?.revision) {
            return;
        }
        if (!this._isCurrentHistoryItemInFilter(historyItemRef.id)) {
            return;
        }
        const revealTreeNode = () => {
            const historyItemTreeElement = this._treeViewModel.getCurrentHistoryItemTreeElement();
            if (historyItemTreeElement && this._tree.hasNode(historyItemTreeElement)) {
                this._tree.reveal(historyItemTreeElement, 0.5);
                this._tree.setSelection([historyItemTreeElement]);
                this._tree.setFocus([historyItemTreeElement]);
                return true;
            }
            return false;
        };
        if (revealTreeNode()) {
            return;
        }
        // Fetch current history item
        await this._loadMore(historyItemRef.revision);
        // Reveal node
        revealTreeNode();
    }
    setViewMode(viewMode) {
        this._treeViewModel.setViewMode(viewMode);
    }
    _createTree(container) {
        this._treeIdentityProvider = new SCMHistoryTreeIdentityProvider();
        const historyItemHoverDelegate = this.instantiationService.createInstance(HistoryItemHoverDelegate, this.viewDescriptorService.getViewLocationById(this.id));
        this._register(historyItemHoverDelegate);
        const resourceLabels = this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility });
        this._register(resourceLabels);
        this._treeDataSource = this.instantiationService.createInstance(SCMHistoryTreeDataSource, () => this._treeViewModel.viewMode.get());
        this._register(this._treeDataSource);
        const compressionEnabled = observableConfigValue('scm.compactFolders', true, this.configurationService);
        this._tree = this.instantiationService.createInstance(WorkbenchCompressibleAsyncDataTree, 'SCM History Tree', container, new ListDelegate(), new SCMHistoryTreeCompressionDelegate(), [
            this.instantiationService.createInstance(HistoryItemRenderer, historyItemHoverDelegate),
            this.instantiationService.createInstance(HistoryItemChangeRenderer, () => this._treeViewModel.viewMode.get(), resourceLabels),
            this.instantiationService.createInstance(HistoryItemLoadMoreRenderer, this._repositoryIsLoadingMore, () => this._loadMore()),
        ], this._treeDataSource, {
            accessibilityProvider: new SCMHistoryTreeAccessibilityProvider(),
            identityProvider: this._treeIdentityProvider,
            collapseByDefault: (e) => !isSCMHistoryItemChangeNode(e),
            compressionEnabled: compressionEnabled.get(),
            dnd: new SCMHistoryTreeDragAndDrop(),
            keyboardNavigationLabelProvider: new SCMHistoryTreeKeyboardNavigationLabelProvider(),
            horizontalScrolling: false,
            multipleSelectionSupport: false,
            twistieAdditionalCssClass: (e) => {
                return isSCMHistoryItemViewModelTreeElement(e) || isSCMHistoryItemLoadMoreTreeElement(e)
                    ? 'force-no-twistie'
                    : undefined;
            }
        });
        this._register(this._tree);
        this._tree.onDidOpen(this._onDidOpen, this, this._store);
        this._tree.onContextMenu(this._onContextMenu, this, this._store);
    }
    _isCurrentHistoryItemInFilter(historyItemRefId) {
        if (!historyItemRefId) {
            return false;
        }
        const historyItemFilter = this._treeViewModel.getHistoryItemsFilter();
        if (historyItemFilter === 'all' || historyItemFilter === 'auto') {
            return true;
        }
        return Array.isArray(historyItemFilter) && !!historyItemFilter.find(ref => ref.id === historyItemRefId);
    }
    async _onDidOpen(e) {
        if (!e.element) {
            return;
        }
        else if (isSCMHistoryItemChangeViewModelTreeElement(e.element)) {
            const historyItemChange = e.element.historyItemChange;
            const historyItem = e.element.historyItemViewModel.historyItem;
            const historyItemDisplayId = historyItem.id === SCMIncomingHistoryItemId
                ? localize('incomingChanges', "Incoming Changes")
                : historyItem.id === SCMOutgoingHistoryItemId
                    ? localize('outgoingChanges', "Outgoing Changes")
                    : historyItem.displayId ?? historyItem.id;
            const historyItemParentId = historyItem.parentIds.length > 0 ? historyItem.parentIds[0] : undefined;
            const historyItemParentDisplayId = historyItemParentId && historyItem.displayId
                ? historyItemParentId.substring(0, historyItem.displayId.length)
                : historyItemParentId;
            if (historyItemChange.originalUri && historyItemChange.modifiedUri) {
                // Diff Editor
                const originalUriTitle = `${basename(historyItemChange.originalUri.fsPath)} (${historyItemParentDisplayId})`;
                const modifiedUriTitle = `${basename(historyItemChange.modifiedUri.fsPath)} (${historyItemDisplayId})`;
                const title = `${originalUriTitle} \u2194 ${modifiedUriTitle}`;
                await this._editorService.openEditor({
                    label: title,
                    original: { resource: historyItemChange.originalUri },
                    modified: { resource: historyItemChange.modifiedUri },
                    options: e.editorOptions
                });
            }
            else if (historyItemChange.modifiedUri) {
                await this._editorService.openEditor({
                    label: `${basename(historyItemChange.modifiedUri.fsPath)} (${historyItemDisplayId})`,
                    resource: historyItemChange.modifiedUri,
                    options: e.editorOptions
                });
            }
            else if (historyItemChange.originalUri) {
                // Editor (Deleted)
                await this._editorService.openEditor({
                    label: `${basename(historyItemChange.originalUri.fsPath)} (${historyItemParentDisplayId})`,
                    resource: historyItemChange.originalUri,
                    options: e.editorOptions
                });
            }
        }
        else if (isSCMHistoryItemLoadMoreTreeElement(e.element)) {
            const pageOnScroll = this.configurationService.getValue('scm.graph.pageOnScroll') === true;
            if (!pageOnScroll) {
                this._loadMore();
                this._tree.setSelection([]);
            }
        }
    }
    _onContextMenu(e) {
        const element = e.element;
        if (isSCMHistoryItemViewModelTreeElement(element)) {
            // HistoryItem
            if (element.historyItemViewModel.kind === 'incoming-changes' || element.historyItemViewModel.kind === 'outgoing-changes') {
                // Incoming/Outgoing changes node does not support any context menu actions
                return;
            }
            this._contextMenuDisposables.value = new DisposableStore();
            const historyProvider = element.repository.provider.historyProvider.get();
            const historyItemRef = historyProvider?.historyItemRef.get();
            const historyItem = element.historyItemViewModel.historyItem;
            const historyItemRefMenuItems = MenuRegistry.getMenuItems(MenuId.SCMHistoryItemRefContext).filter(item => isIMenuItem(item));
            // If there are any history item references we have to add a submenu item for each orignal action,
            // and a menu item for each history item ref that matches the `when` clause of the original action.
            if (historyItemRefMenuItems.length > 0 && element.historyItemViewModel.historyItem.references?.length) {
                const historyItemRefActions = new Map();
                for (const ref of element.historyItemViewModel.historyItem.references) {
                    const contextKeyService = this.scopedContextKeyService.createOverlay([
                        ['scmHistoryItemRef', ref.id]
                    ]);
                    const menuActions = this._menuService.getMenuActions(MenuId.SCMHistoryItemRefContext, contextKeyService);
                    for (const action of menuActions.flatMap(a => a[1])) {
                        if (!historyItemRefActions.has(action.id)) {
                            historyItemRefActions.set(action.id, []);
                        }
                        historyItemRefActions.get(action.id).push(ref);
                    }
                }
                // Register submenu, menu items
                for (const historyItemRefMenuItem of historyItemRefMenuItems) {
                    const actionId = historyItemRefMenuItem.command.id;
                    if (!historyItemRefActions.has(actionId)) {
                        continue;
                    }
                    // Register the submenu for the original action
                    this._contextMenuDisposables.value.add(MenuRegistry.appendMenuItem(MenuId.SCMHistoryItemContext, {
                        title: historyItemRefMenuItem.command.title,
                        submenu: MenuId.for(actionId),
                        group: historyItemRefMenuItem?.group,
                        order: historyItemRefMenuItem?.order
                    }));
                    // Register the action for the history item ref
                    for (const historyItemRef of historyItemRefActions.get(actionId) ?? []) {
                        this._contextMenuDisposables.value.add(registerAction2(class extends Action2 {
                            constructor() {
                                super({
                                    id: `${actionId}.${historyItemRef.id}`,
                                    title: historyItemRef.name,
                                    menu: {
                                        id: MenuId.for(actionId),
                                        group: historyItemRef.category
                                    }
                                });
                            }
                            run(accessor, ...args) {
                                const commandService = accessor.get(ICommandService);
                                commandService.executeCommand(actionId, ...args, historyItemRef.id);
                            }
                        }));
                    }
                }
            }
            const contextKeyService = this.scopedContextKeyService.createOverlay([
                ['scmHistoryItemHasCurrentHistoryItemRef', historyItem.references?.find(ref => ref.id === historyItemRef?.id) !== undefined]
            ]);
            const menuActions = this._menuService.getMenuActions(MenuId.SCMHistoryItemContext, contextKeyService, {
                arg: element.repository.provider,
                shouldForwardArgs: true
            }).filter(group => group[0] !== 'inline');
            this.contextMenuService.showContextMenu({
                contextKeyService: this.scopedContextKeyService,
                getAnchor: () => e.anchor,
                getActions: () => getFlatContextMenuActions(menuActions),
                getActionsContext: () => element.historyItemViewModel.historyItem
            });
        }
        else if (isSCMHistoryItemChangeViewModelTreeElement(element)) {
            // HistoryItemChange
            const menuActions = this._menuService.getMenuActions(MenuId.SCMHistoryItemChangeContext, this.scopedContextKeyService, {
                arg: element.historyItemViewModel.historyItem,
                shouldForwardArgs: true
            }).filter(group => group[0] !== 'inline');
            this.contextMenuService.showContextMenu({
                contextKeyService: this.scopedContextKeyService,
                getAnchor: () => e.anchor,
                getActions: () => getFlatContextMenuActions(menuActions),
                getActionsContext: () => element.historyItemChange
            });
        }
    }
    async _loadMore(cursor) {
        return this._treeLoadMoreSequencer.queue(async () => {
            if (this._repositoryIsLoadingMore.get()) {
                return;
            }
            this._repositoryIsLoadingMore.set(true, undefined);
            this._treeViewModel.loadMore(cursor);
            await this._updateChildren();
            this._repositoryIsLoadingMore.set(false, undefined);
        });
    }
    _updateChildren() {
        return this._updateChildrenThrottler.queue(() => this._treeOperationSequencer.queue(async () => {
            await this._progressService.withProgress({ location: this.id, delay: 100 }, async () => {
                await this._tree.updateChildren(undefined, undefined, undefined, {
                // diffIdentityProvider: this._treeIdentityProvider
                });
            });
        }));
    }
    _updateIndentStyles(theme, viewMode) {
        this._treeContainer.classList.toggle('list-view-mode', viewMode === "list" /* ViewMode.List */);
        this._treeContainer.classList.toggle('tree-view-mode', viewMode === "tree" /* ViewMode.Tree */);
        this._treeContainer.classList.toggle('align-icons-and-twisties', (viewMode === "list" /* ViewMode.List */ && theme.hasFileIcons) || (theme.hasFileIcons && !theme.hasFolderIcons));
        this._treeContainer.classList.toggle('hide-arrows', viewMode === "tree" /* ViewMode.Tree */ && theme.hidesExplorerArrows === true);
    }
    dispose() {
        this._contextMenuDisposables.dispose();
        this._visibilityDisposables.dispose();
        super.dispose();
    }
};
SCMHistoryViewPane = __decorate([
    __param(1, IEditorService),
    __param(2, IInstantiationService),
    __param(3, IMenuService),
    __param(4, IProgressService),
    __param(5, ISCMViewService),
    __param(6, IConfigurationService),
    __param(7, IContextMenuService),
    __param(8, IKeybindingService),
    __param(9, IInstantiationService),
    __param(10, IViewDescriptorService),
    __param(11, IContextKeyService),
    __param(12, IOpenerService),
    __param(13, IThemeService),
    __param(14, IHoverService)
], SCMHistoryViewPane);
export { SCMHistoryViewPane };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NtSGlzdG9yeVZpZXdQYW5lLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3NjbS9icm93c2VyL3NjbUhpc3RvcnlWaWV3UGFuZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxpQkFBaUIsQ0FBQztBQUN6QixPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFHdEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBSS9FLE9BQU8sRUFBRSxhQUFhLEVBQXNCLE1BQU0sb0NBQW9DLENBQUM7QUFDdkYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN2SSxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBZSxlQUFlLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxrQkFBa0IsRUFBRSxtQkFBbUIsRUFBRSxXQUFXLEVBQUUsZ0JBQWdCLEVBQXVCLE1BQU0sdUNBQXVDLENBQUM7QUFDbk8sT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsY0FBYyxFQUFlLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdkgsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDOUYsT0FBTyxFQUFFLGFBQWEsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxxQkFBcUIsRUFBb0IsTUFBTSw0REFBNEQsQ0FBQztBQUNySCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFPLEVBQWMsa0NBQWtDLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNsSCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDOUUsT0FBTyxFQUFFLGFBQWEsRUFBbUIsVUFBVSxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDaEgsT0FBTyxFQUFrQixhQUFhLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNsRyxPQUFPLEVBQW9CLFVBQVUsRUFBRSxRQUFRLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN2SCxPQUFPLEVBQUUsc0JBQXNCLEVBQXlCLE1BQU0sMEJBQTBCLENBQUM7QUFDekYsT0FBTyxFQUFFLHlCQUF5QixFQUFFLCtCQUErQixFQUFFLGNBQWMsRUFBRSxnQ0FBZ0MsRUFBRSwrQkFBK0IsRUFBRSxzQ0FBc0MsRUFBRSxtQkFBbUIsRUFBRSx5QkFBeUIsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3hRLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxjQUFjLEVBQUUsMEJBQTBCLEVBQUUsMENBQTBDLEVBQUUsbUNBQW1DLEVBQUUsb0NBQW9DLEVBQUUsZUFBZSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQzFPLE9BQU8sRUFBd1Asd0JBQXdCLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUNoVixPQUFPLEVBQUUsb0JBQW9CLEVBQWdDLFdBQVcsRUFBRSxlQUFlLEVBQVksTUFBTSxrQkFBa0IsQ0FBQztBQUU5SCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDbkUsT0FBTyxFQUFFLHVCQUF1QixFQUFZLE1BQU0sbURBQW1ELENBQUM7QUFFdEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDM0ksT0FBTyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDbkYsT0FBTyxFQUFFLFlBQVksRUFBMEIsTUFBTSxvQ0FBb0MsQ0FBQztBQUMxRixPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNwRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFHL0MsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxrQkFBa0IsRUFBdUMsTUFBTSxzREFBc0QsQ0FBQztBQUMvSCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUMxRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDcEcsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxnREFBZ0QsQ0FBQztBQUM5RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUN0RixPQUFPLEVBQUUsT0FBTyxJQUFJLFFBQVEsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSx5QkFBeUIsRUFBRSxNQUFNLGlFQUFpRSxDQUFDO0FBQ2pJLE9BQU8sRUFBa0IsY0FBYyxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDNUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMzRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDbEYsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDckcsT0FBTyxFQUFpQixZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN0RixPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFJckQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBRzNFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRzVFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRTFFLE1BQU0seUJBQXlCLEdBQUcsMkNBQTJDLENBQUM7QUFDOUUsTUFBTSxnQ0FBZ0MsR0FBRyxnREFBZ0QsQ0FBQztBQUkxRixNQUFNLDJCQUE0QixTQUFRLGNBQWM7SUFDdkQsWUFBNkIsV0FBMkIsRUFBRSxNQUFlLEVBQUUsT0FBNEM7UUFDdEgsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsRUFBRSxHQUFHLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBRGxDLGdCQUFXLEdBQVgsV0FBVyxDQUFnQjtJQUV4RCxDQUFDO0lBRWtCLFdBQVc7UUFDN0IsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDdEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLDZCQUE2QixDQUFDLENBQUM7WUFFeEQsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3hCLE1BQU0sa0JBQWtCLEdBQUcsU0FBUyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUM7Z0JBQ25GLENBQUMsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDO2dCQUNoRSxDQUFDLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM1QyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLGtCQUFrQixDQUFDLENBQUM7WUFFMUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3hCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDO1lBR2xELEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUMvQixDQUFDO0lBQ0YsQ0FBQztJQUVrQixVQUFVO1FBQzVCLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDO0lBQ3ZDLENBQUM7Q0FDRDtBQUVELE1BQU0sZ0NBQWlDLFNBQVEsY0FBYztJQUM1RCxZQUNrQixXQUEyQixFQUMzQixtQkFBMEQsRUFDM0UsTUFBZSxFQUNmLE9BQTRDO1FBRTVDLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEVBQUUsR0FBRyxPQUFPLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUw3QyxnQkFBVyxHQUFYLFdBQVcsQ0FBZ0I7UUFDM0Isd0JBQW1CLEdBQW5CLG1CQUFtQixDQUF1QztJQUs1RSxDQUFDO0lBRWtCLFdBQVc7UUFDN0IsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDdEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLCtCQUErQixDQUFDLENBQUM7WUFFMUQsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3hCLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsU0FBUyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBRXJFLE1BQU0sSUFBSSxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN4QixJQUFJLElBQUksQ0FBQyxtQkFBbUIsS0FBSyxLQUFLLEVBQUUsQ0FBQztnQkFDeEMsSUFBSSxDQUFDLFdBQVcsR0FBRyxRQUFRLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzNDLENBQUM7aUJBQU0sSUFBSSxJQUFJLENBQUMsbUJBQW1CLEtBQUssTUFBTSxFQUFFLENBQUM7Z0JBQ2hELElBQUksQ0FBQyxXQUFXLEdBQUcsUUFBUSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztZQUM3QyxDQUFDO2lCQUFNLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDbEQsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ3JELENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLENBQUMsV0FBVyxHQUFHLFFBQVEsQ0FBQyxPQUFPLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNwRixDQUFDO1lBRUQsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQy9CLENBQUM7SUFDRixDQUFDO0lBRWtCLFVBQVU7UUFDNUIsSUFBSSxJQUFJLENBQUMsbUJBQW1CLEtBQUssS0FBSyxFQUFFLENBQUM7WUFDeEMsT0FBTyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsNkJBQTZCLENBQUMsQ0FBQztRQUN0RSxDQUFDO2FBQU0sSUFBSSxJQUFJLENBQUMsbUJBQW1CLEtBQUssTUFBTSxFQUFFLENBQUM7WUFDaEQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBRXhFLE9BQU87Z0JBQ04sZUFBZSxFQUFFLGNBQWMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxJQUFJO2dCQUMzQyxlQUFlLEVBQUUsb0JBQW9CLENBQUMsR0FBRyxFQUFFLEVBQUUsSUFBSTtnQkFDakQsZUFBZSxFQUFFLGtCQUFrQixDQUFDLEdBQUcsRUFBRSxFQUFFLElBQUk7YUFDL0MsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ25DLENBQUM7YUFBTSxJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDbEQsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ3pDLENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNqRSxDQUFDO0lBQ0YsQ0FBQztDQUNEO0FBRUQsZUFBZSxDQUFDLEtBQU0sU0FBUSxVQUE4QjtJQUMzRDtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSx5QkFBeUI7WUFDN0IsS0FBSyxFQUFFLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSxtQkFBbUIsQ0FBQztZQUN4RCxNQUFNLEVBQUUsb0JBQW9CO1lBQzVCLEVBQUUsRUFBRSxLQUFLO1lBQ1QsSUFBSSxFQUFFO2dCQUNMLEVBQUUsRUFBRSxNQUFNLENBQUMsZUFBZTtnQkFDMUIsSUFBSSxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQ3ZCLGNBQWMsQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUMsRUFDdkMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLENBQUMsRUFDOUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyx1Q0FBdUMsRUFBRSxVQUFVLENBQUMsQ0FBQztnQkFDNUUsS0FBSyxFQUFFLFlBQVk7Z0JBQ25CLEtBQUssRUFBRSxDQUFDO2FBQ1I7U0FDRCxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFtQixFQUFFLElBQXdCO1FBQzVELElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztJQUN2QixDQUFDO0NBQ0QsQ0FBQyxDQUFDO0FBRUgsZUFBZSxDQUFDLEtBQU0sU0FBUSxVQUE4QjtJQUMzRDtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSxnQ0FBZ0M7WUFDcEMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRSwrQkFBK0IsQ0FBQztZQUNuRSxJQUFJLEVBQUUsT0FBTyxDQUFDLFNBQVM7WUFDdkIsTUFBTSxFQUFFLG9CQUFvQjtZQUM1QixZQUFZLEVBQUUsV0FBVyxDQUFDLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFDNUQsRUFBRSxFQUFFLEtBQUs7WUFDVCxJQUFJLEVBQUU7Z0JBQ0wsRUFBRSxFQUFFLE1BQU0sQ0FBQyxlQUFlO2dCQUMxQixLQUFLLEVBQUUsWUFBWTtnQkFDbkIsS0FBSyxFQUFFLENBQUM7YUFDUjtTQUNELENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxLQUFLLENBQUMsU0FBUyxDQUFDLENBQW1CLEVBQUUsSUFBd0I7UUFDNUQsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7SUFDM0IsQ0FBQztDQUNELENBQUMsQ0FBQztBQUVILGVBQWUsQ0FBQyxLQUFNLFNBQVEsVUFBOEI7SUFDM0Q7UUFDQyxLQUFLLENBQUM7WUFDTCxFQUFFLEVBQUUscURBQXFEO1lBQ3pELEtBQUssRUFBRSxRQUFRLENBQUMsd0JBQXdCLEVBQUUsNEJBQTRCLENBQUM7WUFDdkUsSUFBSSxFQUFFLE9BQU8sQ0FBQyxNQUFNO1lBQ3BCLE1BQU0sRUFBRSxvQkFBb0I7WUFDNUIsWUFBWSxFQUFFLGNBQWMsQ0FBQyxHQUFHLENBQy9CLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLEVBQzlDLFdBQVcsQ0FBQyxnQ0FBZ0MsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDOUQsRUFBRSxFQUFFLEtBQUs7WUFDVCxJQUFJLEVBQUU7Z0JBQ0wsRUFBRSxFQUFFLE1BQU0sQ0FBQyxlQUFlO2dCQUMxQixLQUFLLEVBQUUsWUFBWTtnQkFDbkIsS0FBSyxFQUFFLENBQUM7YUFDUjtTQUNELENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxLQUFLLENBQUMsU0FBUyxDQUFDLENBQW1CLEVBQUUsSUFBd0I7UUFDNUQsSUFBSSxDQUFDLHdCQUF3QixFQUFFLENBQUM7SUFDakMsQ0FBQztDQUNELENBQUMsQ0FBQztBQUVILGVBQWUsQ0FBQyxLQUFNLFNBQVEsVUFBOEI7SUFDM0Q7UUFDQyxLQUFLLENBQUM7WUFDTCxFQUFFLEVBQUUsb0NBQW9DO1lBQ3hDLEtBQUssRUFBRSxRQUFRLENBQUMsY0FBYyxFQUFFLFNBQVMsQ0FBQztZQUMxQyxNQUFNLEVBQUUsb0JBQW9CO1lBQzVCLEVBQUUsRUFBRSxLQUFLO1lBQ1QsSUFBSSxFQUFFLE9BQU8sQ0FBQyxPQUFPO1lBQ3JCLElBQUksRUFBRTtnQkFDTCxFQUFFLEVBQUUsTUFBTSxDQUFDLGVBQWU7Z0JBQzFCLEtBQUssRUFBRSxZQUFZO2dCQUNuQixLQUFLLEVBQUUsSUFBSTthQUNYO1NBQ0QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBbUIsRUFBRSxJQUF3QjtRQUM1RCxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDaEIsQ0FBQztDQUNELENBQUMsQ0FBQztBQUVILGVBQWUsQ0FBQyxLQUFNLFNBQVEsVUFBOEI7SUFDM0Q7UUFDQyxLQUFLLENBQUM7WUFDTCxFQUFFLEVBQUUsNENBQTRDO1lBQ2hELEtBQUssRUFBRSxRQUFRLENBQUMsaUJBQWlCLEVBQUUsY0FBYyxDQUFDO1lBQ2xELE1BQU0sRUFBRSxvQkFBb0I7WUFDNUIsT0FBTyxFQUFFLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLDRCQUFlO1lBQ2hFLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsZUFBZSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRTtZQUNuRSxFQUFFLEVBQUUsS0FBSztTQUNULENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxLQUFLLENBQUMsU0FBUyxDQUFDLENBQW1CLEVBQUUsSUFBd0I7UUFDNUQsSUFBSSxDQUFDLFdBQVcsNEJBQWUsQ0FBQztJQUNqQyxDQUFDO0NBQ0QsQ0FBQyxDQUFDO0FBRUgsZUFBZSxDQUFDLEtBQU0sU0FBUSxVQUE4QjtJQUMzRDtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSw0Q0FBNEM7WUFDaEQsS0FBSyxFQUFFLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRSxjQUFjLENBQUM7WUFDbEQsTUFBTSxFQUFFLG9CQUFvQjtZQUM1QixPQUFPLEVBQUUsV0FBVyxDQUFDLGtCQUFrQixDQUFDLFNBQVMsNEJBQWU7WUFDaEUsSUFBSSxFQUFFLEVBQUUsRUFBRSxFQUFFLE1BQU0sQ0FBQyxlQUFlLEVBQUUsS0FBSyxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFO1lBQ25FLEVBQUUsRUFBRSxLQUFLO1NBQ1QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBbUIsRUFBRSxJQUF3QjtRQUM1RCxJQUFJLENBQUMsV0FBVyw0QkFBZSxDQUFDO0lBQ2pDLENBQUM7Q0FDRCxDQUFDLENBQUM7QUFFSCxlQUFlLENBQUMsS0FBTSxTQUFRLE9BQU87SUFDcEM7UUFDQyxLQUFLLENBQUM7WUFDTCxFQUFFLEVBQUUsd0NBQXdDO1lBQzVDLEtBQUssRUFBRSxRQUFRLENBQUMsYUFBYSxFQUFFLGNBQWMsQ0FBQztZQUM5QyxJQUFJLEVBQUUsT0FBTyxDQUFDLFlBQVk7WUFDMUIsRUFBRSxFQUFFLEtBQUs7WUFDVCxJQUFJLEVBQUU7Z0JBQ0w7b0JBQ0MsRUFBRSxFQUFFLE1BQU0sQ0FBQyxxQkFBcUI7b0JBQ2hDLElBQUksRUFBRSxjQUFjLENBQUMsTUFBTSxDQUFDLDZDQUE2QyxFQUFFLElBQUksQ0FBQztvQkFDaEYsS0FBSyxFQUFFLFFBQVE7b0JBQ2YsS0FBSyxFQUFFLENBQUM7aUJBQ1I7Z0JBQ0Q7b0JBQ0MsRUFBRSxFQUFFLE1BQU0sQ0FBQyxxQkFBcUI7b0JBQ2hDLElBQUksRUFBRSxjQUFjLENBQUMsTUFBTSxDQUFDLDZDQUE2QyxFQUFFLElBQUksQ0FBQztvQkFDaEYsS0FBSyxFQUFFLFFBQVE7b0JBQ2YsS0FBSyxFQUFFLENBQUM7aUJBQ1I7YUFDRDtTQUNELENBQUMsQ0FBQztJQUNKLENBQUM7SUFFUSxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQTBCLEVBQUUsUUFBc0IsRUFBRSxHQUFHLFlBQStCO1FBQ3hHLE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDckQsTUFBTSxlQUFlLEdBQUcsUUFBUSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUN2RCxNQUFNLGNBQWMsR0FBRyxlQUFlLEVBQUUsY0FBYyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQzdELE1BQU0sb0JBQW9CLEdBQUcsZUFBZSxFQUFFLG9CQUFvQixDQUFDLEdBQUcsRUFBRSxDQUFDO1FBRXpFLElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxlQUFlLElBQUksQ0FBQyxjQUFjLElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNuRixPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sV0FBVyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwQyxJQUFJLEtBQXlCLEVBQUUsYUFBaUMsRUFBRSxtQkFBdUMsQ0FBQztRQUUxRyxJQUFJLG9CQUFvQixJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsS0FBSyx3QkFBd0IsSUFBSSxXQUFXLENBQUMsRUFBRSxLQUFLLHdCQUF3QixDQUFDLEVBQUUsQ0FBQztZQUMxSCx5Q0FBeUM7WUFDekMsTUFBTSxTQUFTLEdBQUcsTUFBTSxlQUFlLENBQUMsb0NBQW9DLENBQUM7Z0JBQzVFLGNBQWMsQ0FBQyxJQUFJO2dCQUNuQixvQkFBb0IsQ0FBQyxJQUFJO2FBQ3pCLENBQUMsQ0FBQztZQUVILElBQUksU0FBUyxJQUFJLFdBQVcsQ0FBQyxFQUFFLEtBQUssd0JBQXdCLEVBQUUsQ0FBQztnQkFDOUQsZ0NBQWdDO2dCQUNoQyxLQUFLLEdBQUcsR0FBRyxXQUFXLENBQUMsT0FBTyxNQUFNLGNBQWMsQ0FBQyxJQUFJLFdBQVcsb0JBQW9CLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQzlGLGFBQWEsR0FBRyxvQkFBb0IsQ0FBQyxFQUFFLENBQUM7Z0JBQ3hDLG1CQUFtQixHQUFHLFNBQVMsQ0FBQztZQUNqQyxDQUFDO2lCQUFNLElBQUksU0FBUyxJQUFJLFdBQVcsQ0FBQyxFQUFFLEtBQUssd0JBQXdCLEVBQUUsQ0FBQztnQkFDckUsZ0NBQWdDO2dCQUNoQyxLQUFLLEdBQUcsR0FBRyxXQUFXLENBQUMsT0FBTyxNQUFNLG9CQUFvQixDQUFDLElBQUksV0FBVyxjQUFjLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQzlGLGFBQWEsR0FBRyxjQUFjLENBQUMsRUFBRSxDQUFDO2dCQUNsQyxtQkFBbUIsR0FBRyxTQUFTLENBQUM7WUFDakMsQ0FBQztRQUNGLENBQUM7YUFBTSxDQUFDO1lBQ1AsS0FBSyxHQUFHLHlCQUF5QixDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQy9DLGFBQWEsR0FBRyxXQUFXLENBQUMsRUFBRSxDQUFDO1lBRS9CLElBQUksV0FBVyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ3RDLDZEQUE2RDtnQkFDN0QsSUFBSSxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLHdCQUF3QixJQUFJLG9CQUFvQixFQUFFLENBQUM7b0JBQ25GLG1CQUFtQixHQUFHLE1BQU0sZUFBZSxDQUFDLG9DQUFvQyxDQUFDO3dCQUNoRixjQUFjLENBQUMsSUFBSTt3QkFDbkIsb0JBQW9CLENBQUMsSUFBSTtxQkFDekIsQ0FBQyxDQUFDO2dCQUNKLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxtQkFBbUIsR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNoRCxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztZQUN0RCxPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sa0JBQWtCLEdBQUcsc0JBQXNCLENBQUMscUJBQXFCLENBQUMsUUFBUSxFQUFFLGFBQWEsRUFBRSxtQkFBbUIsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMxSCxjQUFjLENBQUMsY0FBYyxDQUFDLGdDQUFnQyxFQUFFLEVBQUUsS0FBSyxFQUFFLGtCQUFrQixFQUFFLENBQUMsQ0FBQztJQUNoRyxDQUFDO0NBQ0QsQ0FBQyxDQUFDO0FBRUgsZUFBZSxDQUFDLEtBQU0sU0FBUSxPQUFPO0lBQ3BDO1FBQ0MsS0FBSyxDQUFDO1lBQ0wsRUFBRSxFQUFFLHFDQUFxQztZQUN6QyxLQUFLLEVBQUUsUUFBUSxDQUFDLFVBQVUsRUFBRSxXQUFXLENBQUM7WUFDeEMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxRQUFRO1lBQ3RCLEVBQUUsRUFBRSxLQUFLO1lBQ1QsSUFBSSxFQUFFO2dCQUNMO29CQUNDLEVBQUUsRUFBRSxNQUFNLENBQUMsMkJBQTJCO29CQUN0QyxLQUFLLEVBQUUsUUFBUTtvQkFDZixLQUFLLEVBQUUsQ0FBQztpQkFDUjtnQkFDRDtvQkFDQyxFQUFFLEVBQUUsTUFBTSxDQUFDLDJCQUEyQjtvQkFDdEMsS0FBSyxFQUFFLFFBQVE7b0JBQ2YsS0FBSyxFQUFFLENBQUM7aUJBQ1I7YUFDRDtTQUNELENBQUMsQ0FBQztJQUNKLENBQUM7SUFFUSxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQTBCLEVBQUUsV0FBNEIsRUFBRSxpQkFBd0M7UUFDcEgsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUVuRCxJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsaUJBQWlCLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDcEQsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLE9BQWUsQ0FBQztRQUNwQixJQUFJLFdBQVcsQ0FBQyxFQUFFLEtBQUssd0JBQXdCLEVBQUUsQ0FBQztZQUNqRCxPQUFPLEdBQUcsUUFBUSxDQUFDLGlCQUFpQixFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDM0QsQ0FBQzthQUFNLElBQUksV0FBVyxDQUFDLEVBQUUsS0FBSyx3QkFBd0IsRUFBRSxDQUFDO1lBQ3hELE9BQU8sR0FBRyxRQUFRLENBQUMsaUJBQWlCLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUMzRCxDQUFDO2FBQU0sQ0FBQztZQUNQLE9BQU8sR0FBRyxXQUFXLENBQUMsU0FBUyxJQUFJLFdBQVcsQ0FBQyxFQUFFLENBQUM7UUFDbkQsQ0FBQztRQUVELE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDNUQsTUFBTSxhQUFhLENBQUMsVUFBVSxDQUFDLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixDQUFDLFdBQVcsRUFBRSxLQUFLLEVBQUUsR0FBRyxJQUFJLEtBQUssT0FBTyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQzVHLENBQUM7Q0FDRCxDQUFDLENBQUM7QUFFSCxNQUFNLFlBQVk7SUFFakIsU0FBUztRQUNSLE9BQU8sRUFBRSxDQUFDO0lBQ1gsQ0FBQztJQUVELGFBQWEsQ0FBQyxPQUFvQjtRQUNqQyxJQUFJLG9DQUFvQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDbkQsT0FBTyxtQkFBbUIsQ0FBQyxXQUFXLENBQUM7UUFDeEMsQ0FBQzthQUFNLElBQUksMENBQTBDLENBQUMsT0FBTyxDQUFDLElBQUksMEJBQTBCLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUN2RyxPQUFPLHlCQUF5QixDQUFDLFdBQVcsQ0FBQztRQUM5QyxDQUFDO2FBQU0sSUFBSSxtQ0FBbUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ3pELE9BQU8sMkJBQTJCLENBQUMsV0FBVyxDQUFDO1FBQ2hELENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3BDLENBQUM7SUFDRixDQUFDO0NBQ0Q7QUFZRCxJQUFNLG1CQUFtQixHQUF6QixNQUFNLG1CQUFtQjs7YUFFUixnQkFBVyxHQUFHLGNBQWMsQUFBakIsQ0FBa0I7SUFDN0MsSUFBSSxVQUFVLEtBQWEsT0FBTyxxQkFBbUIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO0lBSXBFLFlBQ2tCLGFBQTZCLEVBQ1osZUFBZ0MsRUFDMUIscUJBQTRDLEVBQy9DLGtCQUFzQyxFQUNyQyxtQkFBd0MsRUFDOUMsYUFBNEIsRUFDdkIsa0JBQXNDLEVBQ2hDLHdCQUFrRCxFQUM5RCxZQUEwQixFQUNyQixpQkFBb0M7UUFUdkQsa0JBQWEsR0FBYixhQUFhLENBQWdCO1FBQ1osb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBQzFCLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBdUI7UUFDL0MsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFvQjtRQUNyQyx3QkFBbUIsR0FBbkIsbUJBQW1CLENBQXFCO1FBQzlDLGtCQUFhLEdBQWIsYUFBYSxDQUFlO1FBQ3ZCLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBb0I7UUFDaEMsNkJBQXdCLEdBQXhCLHdCQUF3QixDQUEwQjtRQUM5RCxpQkFBWSxHQUFaLFlBQVksQ0FBYztRQUNyQixzQkFBaUIsR0FBakIsaUJBQWlCLENBQW1CO1FBRXhFLElBQUksQ0FBQyxhQUFhLEdBQUcscUJBQXFCLENBQW1CLGtCQUFrQixFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztJQUN4SCxDQUFDO0lBRUQsY0FBYyxDQUFDLFNBQXNCO1FBQ3BDLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7UUFDdEQsTUFBTSxjQUFjLEdBQUcsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBQzlELE1BQU0sU0FBUyxHQUFHLElBQUksU0FBUyxDQUFDLE9BQU8sRUFBRTtZQUN4QyxZQUFZLEVBQUUsSUFBSSxFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBRSw0QkFBNEIsRUFBRSxJQUFJO1NBQy9FLENBQUMsQ0FBQztRQUVILE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztRQUU5RCxNQUFNLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDeEQsTUFBTSxTQUFTLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBRWpOLE9BQU8sRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFFLFNBQVMsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLGVBQWUsRUFBRSxFQUFFLFdBQVcsRUFBRSxrQkFBa0IsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLEVBQUUsQ0FBQztJQUNuTCxDQUFDO0lBRUQsYUFBYSxDQUFDLElBQW9FLEVBQUUsS0FBYSxFQUFFLFlBQWlDO1FBQ25JLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQztRQUNsRCxNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUM7UUFDL0QsTUFBTSxXQUFXLEdBQUcsb0JBQW9CLENBQUMsV0FBVyxDQUFDO1FBRXJELE1BQU0sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLEdBQUcsSUFBSSxDQUFDLHlCQUF5QixDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQzdFLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDakgsWUFBWSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3RELFlBQVksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFakQsWUFBWSxDQUFDLGNBQWMsQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO1FBQzdDLFlBQVksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxDQUFDO1FBQzlGLFlBQVksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRSxvQkFBb0IsQ0FBQyxJQUFJLEtBQUssa0JBQWtCLENBQUMsQ0FBQztRQUNuSCxZQUFZLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsa0JBQWtCLEVBQUUsb0JBQW9CLENBQUMsSUFBSSxLQUFLLGtCQUFrQixDQUFDLENBQUM7UUFDbkgsWUFBWSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMseUJBQXlCLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO1FBRXpGLE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFLEVBQUUsY0FBYyxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBQzdFLE1BQU0sWUFBWSxHQUFHLGNBQWMsRUFBRSxRQUFRLEtBQUssV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDakcsTUFBTSxDQUFDLE9BQU8sRUFBRSxrQkFBa0IsQ0FBQyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2xHLFlBQVksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxFQUFFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDO1FBRXBILElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBRTlDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsY0FBYyxDQUMvQyxNQUFNLENBQUMscUJBQXFCLEVBQzVCLElBQUksQ0FBQyxrQkFBa0IsRUFDdkIsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDN0MsWUFBWSxDQUFDLFNBQVMsQ0FBQyxPQUFPLEdBQUcsV0FBVyxDQUFDO1FBQzdDLFlBQVksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNuRixDQUFDO0lBRUQsd0JBQXdCLENBQUMsSUFBeUYsRUFBRSxLQUFhLEVBQUUsWUFBaUM7UUFDbkssTUFBTSxJQUFJLEtBQUssQ0FBQyxrREFBa0QsQ0FBQyxDQUFDO0lBQ3JFLENBQUM7SUFFTyxhQUFhLENBQUMsV0FBNEIsRUFBRSxZQUFpQztRQUNwRixZQUFZLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUNwRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUVwRCxZQUFZLENBQUMsY0FBYyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBRTlDLE1BQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDMUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUV0QyxrREFBa0Q7WUFDbEQsbURBQW1EO1lBQ25ELG1DQUFtQztZQUNuQyxJQUFJLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDbEQsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQztnQkFFdkQsb0RBQW9EO2dCQUNwRCxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN6QixDQUFDO1lBRUQseUNBQXlDO1lBQ3pDLE1BQU0sc0JBQXNCLEdBQUcsUUFBUSxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBRXZGLEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxlQUFlLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLHNCQUFzQixDQUFDLEVBQUUsQ0FBQztnQkFDN0Usd0NBQXdDO2dCQUN4QyxJQUFJLEdBQUcsS0FBSyxFQUFFLElBQUksV0FBVyxLQUFLLEtBQUssRUFBRSxDQUFDO29CQUN6QyxTQUFTO2dCQUNWLENBQUM7Z0JBRUQsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO29CQUN0QixTQUFTO2dCQUNWLENBQUM7Z0JBRUQsd0NBQXdDO2dCQUN4QyxNQUFNLHNCQUFzQixHQUFHLFFBQVEsQ0FBQyxlQUFlLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUNwSCxLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsZUFBZSxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFLENBQUM7b0JBQzdFLDhCQUE4QjtvQkFDOUIsSUFBSSxHQUFHLEtBQUssRUFBRSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7d0JBQ3BDLFNBQVM7b0JBQ1YsQ0FBQztvQkFFRCxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsRUFBRSxLQUFLLEVBQUUsWUFBWSxDQUFDLENBQUM7Z0JBQ3pELENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyxZQUFZLENBQUMsZUFBcUMsRUFBRSxlQUF3QixFQUFFLFlBQWlDO1FBQ3RILElBQUksZUFBZSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3JGLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxRQUFRLEdBQUcsQ0FBQyxDQUFDLFdBQVcsRUFBRTtZQUMvQixLQUFLLEVBQUU7Z0JBQ04sS0FBSyxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQywrQkFBK0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDO2dCQUM1RyxlQUFlLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLHNDQUFzQyxDQUFDO2FBQzNJO1NBQ0QsRUFBRTtZQUNGLENBQUMsQ0FBQyxpQkFBaUIsRUFBRTtnQkFDcEIsS0FBSyxFQUFFO29CQUNOLE9BQU8sRUFBRSxlQUFlLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNO2lCQUNqRDthQUNELENBQUM7WUFDRixDQUFDLENBQUMsZUFBZSxDQUFDO1lBQ2xCLENBQUMsQ0FBQyw2QkFBNkIsRUFBRTtnQkFDaEMsS0FBSyxFQUFFO29CQUNOLE9BQU8sRUFBRSxlQUFlLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTTtpQkFDdEM7YUFDRCxDQUFDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsUUFBUSxDQUFDLEtBQUssQ0FBQyxXQUFXLEdBQUcsZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNqRyxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDcEYsUUFBUSxDQUFDLFdBQVcsQ0FBQyxXQUFXLEdBQUcsZUFBZSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFFbEYsTUFBTSxDQUFDLFlBQVksQ0FBQyxjQUFjLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFFTyx5QkFBeUIsQ0FBQyxXQUE0QjtRQUM3RCwrRUFBK0U7UUFDL0UsTUFBTSxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsR0FBRyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsd0JBQXdCLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRTdHLElBQUksZ0JBQWdCLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUMvQixPQUFPO2dCQUNOLE9BQU8sRUFBRTtvQkFDUixRQUFRLEVBQUUsT0FBTztvQkFDakIsNEJBQTRCLEVBQUUsV0FBVyxDQUFDLE9BQU87aUJBQ2pEO2dCQUNELFdBQVc7YUFDWCxDQUFDO1FBQ0gsQ0FBQztRQUVELE9BQU8sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLENBQUM7SUFDakMsQ0FBQztJQUVPLGVBQWUsQ0FBQyxvQkFBOEMsRUFBRSxVQUF1QztRQUM5RyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDakIsT0FBTyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUMvQixDQUFDO1FBRUQsT0FBTztZQUNOLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxPQUFPLEtBQUssVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztZQUMzRyxvQkFBb0IsQ0FBQyxXQUFXLENBQUMsTUFBTSxLQUFLLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7U0FDMUcsQ0FBQztJQUNILENBQUM7SUFFRCxjQUFjLENBQUMsT0FBdUUsRUFBRSxLQUFhLEVBQUUsWUFBaUM7UUFDdkksWUFBWSxDQUFDLGtCQUFrQixDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3pDLENBQUM7SUFFRCxlQUFlLENBQUMsWUFBaUM7UUFDaEQsWUFBWSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQzFDLFlBQVksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDcEMsQ0FBQzs7QUF4TEksbUJBQW1CO0lBU3RCLFdBQUEsZUFBZSxDQUFBO0lBQ2YsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFdBQUEsbUJBQW1CLENBQUE7SUFDbkIsV0FBQSxhQUFhLENBQUE7SUFDYixXQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFdBQUEsd0JBQXdCLENBQUE7SUFDeEIsV0FBQSxZQUFZLENBQUE7SUFDWixXQUFBLGlCQUFpQixDQUFBO0dBakJkLG1CQUFtQixDQXlMeEI7QUFXRCxJQUFNLHlCQUF5QixHQUEvQixNQUFNLHlCQUF5Qjs7YUFDZCxnQkFBVyxHQUFHLHFCQUFxQixBQUF4QixDQUF5QjtJQUNwRCxJQUFJLFVBQVUsS0FBYSxPQUFPLDJCQUF5QixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFFMUUsWUFDa0IsUUFBd0IsRUFDeEIsY0FBOEIsRUFDYixlQUFnQyxFQUM3QixrQkFBc0MsRUFDckMsbUJBQXdDLEVBQ3pDLGtCQUFzQyxFQUMzQyxhQUE0QixFQUM3QixZQUEwQixFQUNyQixpQkFBb0M7UUFSdkQsYUFBUSxHQUFSLFFBQVEsQ0FBZ0I7UUFDeEIsbUJBQWMsR0FBZCxjQUFjLENBQWdCO1FBQ2Isb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBQzdCLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBb0I7UUFDckMsd0JBQW1CLEdBQW5CLG1CQUFtQixDQUFxQjtRQUN6Qyx1QkFBa0IsR0FBbEIsa0JBQWtCLENBQW9CO1FBQzNDLGtCQUFhLEdBQWIsYUFBYSxDQUFlO1FBQzdCLGlCQUFZLEdBQVosWUFBWSxDQUFjO1FBQ3JCLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBbUI7SUFDckUsQ0FBQztJQUVMLGNBQWMsQ0FBQyxTQUFzQjtRQUNwQyxNQUFNLFVBQVUsR0FBRyxTQUFTLENBQUMsYUFBNkIsQ0FBQztRQUMzRCxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUM7UUFDN0QsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7UUFFbEUsTUFBTSxjQUFjLEdBQUcsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBQzlELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRTtZQUNoRSw0QkFBNEIsRUFBRSxJQUFJLEVBQUUsaUJBQWlCLEVBQUUsSUFBSTtTQUMzRCxDQUFDLENBQUM7UUFFSCxNQUFNLFdBQVcsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQzFDLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDdEUsTUFBTSxTQUFTLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxnQkFBZ0IsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ2pOLFdBQVcsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFM0IsT0FBTyxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsQ0FBQztJQUN6RixDQUFDO0lBRUQsYUFBYSxDQUFDLGFBQXNLLEVBQUUsS0FBYSxFQUFFLFlBQXVDLEVBQUUsT0FBK0M7UUFDNVIsTUFBTSxvQkFBb0IsR0FBRywwQ0FBMEMsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLG9CQUFvQixDQUFDO1FBQ2pNLE1BQU0saUJBQWlCLEdBQUcsMENBQTBDLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDO1FBQzlKLE1BQU0sWUFBWSxHQUFHLDBDQUEwQyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLG9CQUFvQixDQUFDLGVBQWUsQ0FBQztRQUVqTSxJQUFJLENBQUMsdUJBQXVCLENBQUMsWUFBWSxFQUFFLG9CQUFvQixFQUFFLFlBQVksQ0FBQyxDQUFDO1FBRS9FLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsK0JBQWtCLENBQUM7UUFDbkQsTUFBTSxRQUFRLEdBQUcsMENBQTBDLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO1FBQ3JILFlBQVksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxFQUFFLGVBQWUsRUFBRSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBRXBJLElBQUksUUFBUSxLQUFLLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNoQyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FDL0MsTUFBTSxDQUFDLDJCQUEyQixFQUNsQyxJQUFJLENBQUMsa0JBQWtCLEVBQ3ZCLEVBQUUsR0FBRyxFQUFFLG9CQUFvQixDQUFDLFdBQVcsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBRXJFLFlBQVksQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHLGlCQUFpQixDQUFDO1lBQ25ELFlBQVksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNuRixDQUFDO2FBQU0sQ0FBQztZQUNQLFlBQVksQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHLFNBQVMsQ0FBQztZQUMzQyxZQUFZLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUN2QyxDQUFDO0lBQ0YsQ0FBQztJQUVELHdCQUF3QixDQUFDLElBQWtMLEVBQUUsS0FBYSxFQUFFLFlBQXVDLEVBQUUsT0FBK0M7UUFDblQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE9BQTJILENBQUM7UUFDcEosTUFBTSxvQkFBb0IsR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQztRQUNqRixNQUFNLFlBQVksR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxlQUFlLENBQUM7UUFFekYsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFlBQVksRUFBRSxvQkFBb0IsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUUvRSxNQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRCxNQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ25FLFlBQVksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxFQUFFO1lBQzdFLGVBQWUsRUFBRSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRTtZQUNoRCxRQUFRLEVBQUUsUUFBUSxDQUFDLE1BQU07WUFDekIsU0FBUyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDO1NBQzdELENBQUMsQ0FBQztRQUVILFlBQVksQ0FBQyxTQUFTLENBQUMsT0FBTyxHQUFHLFNBQVMsQ0FBQztRQUMzQyxZQUFZLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUN2QyxDQUFDO0lBRU8sdUJBQXVCLENBQUMsWUFBdUMsRUFBRSxvQkFBOEMsRUFBRSxZQUF3QztRQUNoSyxNQUFNLHdCQUF3QixHQUFHLGNBQWMsR0FBRyxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDNUUsTUFBTSxVQUFVLEdBQUcsd0JBQXdCLEdBQUcsRUFBRSxDQUFDLDRCQUE0QixDQUFDO1FBQzlFLFlBQVksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxHQUFHLFVBQVUsSUFBSSxDQUFDO1FBRTdELFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO1FBQy9DLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsVUFBVSxJQUFJLENBQUM7UUFDbEUsWUFBWSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyx3QkFBd0IsSUFBSSxDQUFDO1FBQzVFLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsZ0NBQWdDLENBQUMsWUFBWSxFQUFFLG1CQUFtQixDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RJLENBQUM7SUFFRCxlQUFlLENBQUMsWUFBdUM7UUFDdEQsWUFBWSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNwQyxDQUFDOztBQTNGSSx5QkFBeUI7SUFPNUIsV0FBQSxlQUFlLENBQUE7SUFDZixXQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFdBQUEsbUJBQW1CLENBQUE7SUFDbkIsV0FBQSxrQkFBa0IsQ0FBQTtJQUNsQixXQUFBLGFBQWEsQ0FBQTtJQUNiLFdBQUEsWUFBWSxDQUFBO0lBQ1osV0FBQSxpQkFBaUIsQ0FBQTtHQWJkLHlCQUF5QixDQTRGOUI7QUFXRCxJQUFNLDJCQUEyQixHQUFqQyxNQUFNLDJCQUEyQjs7YUFFaEIsZ0JBQVcsR0FBRyxxQkFBcUIsQUFBeEIsQ0FBeUI7SUFDcEQsSUFBSSxVQUFVLEtBQWEsT0FBTyw2QkFBMkIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO0lBRTVFLFlBQ2tCLGNBQW9DLEVBQ3BDLGlCQUE2QixFQUNOLHFCQUE0QztRQUZuRSxtQkFBYyxHQUFkLGNBQWMsQ0FBc0I7UUFDcEMsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFZO1FBQ04sMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtJQUNqRixDQUFDO0lBRUwsY0FBYyxDQUFDLFNBQXNCO1FBQ3BDLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLHlCQUF5QixDQUFDLENBQUMsQ0FBQztRQUNoRSxNQUFNLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztRQUNsRSxNQUFNLCtCQUErQixHQUFHLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQztRQUN4RixNQUFNLDJCQUEyQixHQUFHLElBQUksU0FBUyxDQUFDLCtCQUErQixFQUFFLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFFM0csT0FBTyxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSwrQkFBK0IsRUFBRSwyQkFBMkIsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLGVBQWUsRUFBRSxFQUFFLFdBQVcsRUFBRSwyQkFBMkIsRUFBRSxDQUFDO0lBQ3pMLENBQUM7SUFFRCxhQUFhLENBQUMsT0FBMkQsRUFBRSxLQUFhLEVBQUUsWUFBOEI7UUFDdkgsWUFBWSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsR0FBRyxFQUFFLENBQUM7UUFDL0MsWUFBWSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxjQUFjLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUM5RyxZQUFZLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLGdDQUFnQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztRQUUxRyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxDQUFVLHdCQUF3QixDQUFDLEtBQUssSUFBSSxDQUFDO1FBQ3JHLFlBQVksQ0FBQywrQkFBK0IsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUV2RixJQUFJLFlBQVksRUFBRSxDQUFDO1lBQ2xCLFlBQVksQ0FBQywyQkFBMkIsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDdEQsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDMUIsQ0FBQzthQUFNLENBQUM7WUFDUCxZQUFZLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDcEQsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ3ZELE1BQU0sSUFBSSxHQUFHLEtBQUssYUFBYSxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLFdBQVcsR0FBRyxDQUFDO2dCQUVsRSxZQUFZLENBQUMsMkJBQTJCLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNuRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztJQUNGLENBQUM7SUFFRCx3QkFBd0IsQ0FBQyxJQUE2RSxFQUFFLEtBQWEsRUFBRSxZQUE4QjtRQUNwSixNQUFNLElBQUksS0FBSyxDQUFDLGtEQUFrRCxDQUFDLENBQUM7SUFDckUsQ0FBQztJQUVELGNBQWMsQ0FBQyxPQUEyRCxFQUFFLEtBQWEsRUFBRSxZQUE4QjtRQUN4SCxZQUFZLENBQUMsa0JBQWtCLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDekMsQ0FBQztJQUVELGVBQWUsQ0FBQyxZQUE4QjtRQUM3QyxZQUFZLENBQUMsa0JBQWtCLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDMUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNwQyxDQUFDOztBQXBESSwyQkFBMkI7SUFROUIsV0FBQSxxQkFBcUIsQ0FBQTtHQVJsQiwyQkFBMkIsQ0FxRGhDO0FBRUQsSUFBTSx3QkFBd0IsR0FBOUIsTUFBTSx3QkFBeUIsU0FBUSxzQkFBc0I7SUFDNUQsWUFDa0Isc0JBQW9ELEVBQzNCLGFBQXNDLEVBQ3pELG9CQUEyQyxFQUNuRCxZQUEyQjtRQUcxQyxLQUFLLENBQUMsc0JBQXNCLHdDQUFnQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBRTtZQUNuRixZQUFZLEVBQUUsc0JBQXNCLHdDQUFnQztTQUNwRSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsRUFBRSxvQkFBb0IsRUFBRSxZQUFZLENBQUMsQ0FBQztRQVJwRCwyQkFBc0IsR0FBdEIsc0JBQXNCLENBQThCO1FBQzNCLGtCQUFhLEdBQWIsYUFBYSxDQUF5QjtJQVFqRixDQUFDO0lBRU8sZUFBZTtRQUN0QixNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFFaEUsSUFBSSxhQUE0QixDQUFDO1FBQ2pDLElBQUksSUFBSSxDQUFDLHNCQUFzQiwwQ0FBa0MsRUFBRSxDQUFDO1lBQ25FLGFBQWEsR0FBRyxlQUFlLDBCQUFrQixDQUFDLENBQUMsNkJBQXFCLENBQUMsMkJBQW1CLENBQUM7UUFDOUYsQ0FBQzthQUFNLElBQUksSUFBSSxDQUFDLHNCQUFzQiwrQ0FBdUMsRUFBRSxDQUFDO1lBQy9FLGFBQWEsR0FBRyxlQUFlLDBCQUFrQixDQUFDLENBQUMsNEJBQW9CLENBQUMsNEJBQW9CLENBQUM7UUFDOUYsQ0FBQzthQUFNLENBQUM7WUFDUCxhQUFhLDhCQUFzQixDQUFDO1FBQ3JDLENBQUM7UUFFRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLGFBQWEsRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQztJQUN4RyxDQUFDO0NBQ0QsQ0FBQTtBQTNCSyx3QkFBd0I7SUFHM0IsV0FBQSx1QkFBdUIsQ0FBQTtJQUN2QixXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEsYUFBYSxDQUFBO0dBTFYsd0JBQXdCLENBMkI3QjtBQUVELElBQU0sOEJBQThCLEdBQXBDLE1BQU0sOEJBQStCLFNBQVEsWUFBWTtJQUN4RCxZQUErQyxnQkFBa0M7UUFDaEYsS0FBSyxFQUFFLENBQUM7UUFEc0MscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFrQjtJQUVqRixDQUFDO0lBRWtCLFNBQVMsQ0FBQyxNQUFlLEVBQUUsT0FBaUI7UUFDOUQsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLEVBQUUsUUFBUSxFQUFFLG9CQUFvQixFQUFFLEVBQzNFLEtBQUssSUFBSSxFQUFFLENBQUMsTUFBTSxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ3RELENBQUM7Q0FDRCxDQUFBO0FBVEssOEJBQThCO0lBQ3RCLFdBQUEsZ0JBQWdCLENBQUE7R0FEeEIsOEJBQThCLENBU25DO0FBRUQsTUFBTSxtQ0FBbUM7SUFFeEMsa0JBQWtCO1FBQ2pCLE9BQU8sUUFBUSxDQUFDLGFBQWEsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFRCxZQUFZLENBQUMsT0FBb0I7UUFDaEMsSUFBSSxlQUFlLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUM5QixPQUFPLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM3RCxDQUFDO2FBQU0sSUFBSSxvQ0FBb0MsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQzFELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLENBQUM7WUFDN0QsT0FBTyxHQUFHLFVBQVUsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQzFHLENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxFQUFFLENBQUM7UUFDWCxDQUFDO0lBQ0YsQ0FBQztDQUNEO0FBRUQsTUFBTSw4QkFBOEI7SUFFbkMsS0FBSyxDQUFDLE9BQW9CO1FBQ3pCLElBQUksZUFBZSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDOUIsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQztZQUNsQyxPQUFPLFFBQVEsUUFBUSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQzlCLENBQUM7YUFBTSxJQUFJLG9DQUFvQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDMUQsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUM7WUFDN0MsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixDQUFDLFdBQVcsQ0FBQztZQUM3RCxPQUFPLGVBQWUsUUFBUSxDQUFDLEVBQUUsSUFBSSxXQUFXLENBQUMsRUFBRSxJQUFJLFdBQVcsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDMUYsQ0FBQzthQUFNLElBQUksMENBQTBDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNoRSxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQztZQUM3QyxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsb0JBQW9CLENBQUMsV0FBVyxDQUFDO1lBQzdELE9BQU8scUJBQXFCLFFBQVEsQ0FBQyxFQUFFLElBQUksV0FBVyxDQUFDLEVBQUUsSUFBSSxXQUFXLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3hJLENBQUM7YUFBTSxJQUFJLDBCQUEwQixDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDaEQsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDO1lBQ3JELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsV0FBVyxDQUFDO1lBQ3JFLE9BQU8sMkJBQTJCLFFBQVEsQ0FBQyxFQUFFLElBQUksV0FBVyxDQUFDLEVBQUUsSUFBSSxXQUFXLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQzVILENBQUM7YUFBTSxJQUFJLG1DQUFtQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDekQsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUM7WUFDN0MsT0FBTyx1QkFBdUIsUUFBUSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQzdDLENBQUM7YUFBTSxDQUFDO1lBQ1AsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3pDLENBQUM7SUFDRixDQUFDO0NBQ0Q7QUFFRCxNQUFNLDZDQUE2QztJQUNsRCwwQkFBMEIsQ0FBQyxPQUFvQjtRQUM5QyxJQUFJLGVBQWUsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQzlCLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7YUFBTSxJQUFJLG9DQUFvQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDMUQsMkRBQTJEO1lBQzNELDJEQUEyRDtZQUMzRCx5QkFBeUI7WUFDekIsT0FBTyxDQUFDLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDNUcsQ0FBQzthQUFNLElBQUksbUNBQW1DLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUN6RCwrQ0FBK0M7WUFDL0MsT0FBTyxFQUFFLENBQUM7UUFDWCxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQztRQUN6QyxDQUFDO0lBQ0YsQ0FBQztJQUVELHdDQUF3QyxDQUFDLFFBQXVCO1FBQy9ELE1BQU0sT0FBTyxHQUFHLFFBQXlHLENBQUM7UUFDMUgsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMzQyxDQUFDO0NBQ0Q7QUFFRCxNQUFNLGlDQUFpQztJQUV0QyxnQkFBZ0IsQ0FBQyxPQUFvQjtRQUNwQyxJQUFJLFlBQVksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUMxQyxPQUFPLE9BQU8sQ0FBQyxhQUFhLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQ2pGLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7Q0FDRDtBQUVELE1BQU0sd0JBQXlCLFNBQVEsVUFBVTtJQUNoRCxZQUE2QixRQUF3QjtRQUNwRCxLQUFLLEVBQUUsQ0FBQztRQURvQixhQUFRLEdBQVIsUUFBUSxDQUFnQjtJQUVyRCxDQUFDO0lBRUQsS0FBSyxDQUFDLFdBQVcsQ0FBQyxjQUFpRDtRQUNsRSxNQUFNLFFBQVEsR0FBa0IsRUFBRSxDQUFDO1FBRW5DLElBQUksY0FBYyxZQUFZLG1CQUFtQixFQUFFLENBQUM7WUFDbkQsZ0JBQWdCO1lBQ2hCLE1BQU0sWUFBWSxHQUFHLE1BQU0sY0FBYyxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQzVELFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQztZQUUvQixvQkFBb0I7WUFDcEIsTUFBTSxVQUFVLEdBQUcsY0FBYyxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNuRCxNQUFNLGVBQWUsR0FBRyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsSUFBSSxVQUFVLElBQUksZUFBZSxJQUFJLGVBQWUsQ0FBQyxvQkFBb0IsQ0FBQyxlQUFlLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUN0RyxRQUFRLENBQUMsSUFBSSxDQUFDO29CQUNiLFVBQVU7b0JBQ1YsWUFBWSxFQUFFLGVBQWUsQ0FBQyxvQkFBb0IsQ0FBQyxlQUFlO29CQUNsRSxJQUFJLEVBQUUscUJBQXFCO2lCQUNpQixDQUFDLENBQUM7WUFDaEQsQ0FBQztRQUNGLENBQUM7YUFBTSxJQUFJLG9DQUFvQyxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUM7WUFDakUsdUJBQXVCO1lBQ3ZCLE1BQU0sZUFBZSxHQUFHLGNBQWMsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNqRixNQUFNLG9CQUFvQixHQUFHLGNBQWMsQ0FBQyxvQkFBb0IsQ0FBQztZQUNqRSxNQUFNLFdBQVcsR0FBRyxvQkFBb0IsQ0FBQyxXQUFXLENBQUM7WUFFckQsSUFBSSxhQUFxQixFQUFFLG1CQUF1QyxDQUFDO1lBRW5FLElBQ0Msb0JBQW9CLENBQUMsSUFBSSxLQUFLLGtCQUFrQjtnQkFDaEQsb0JBQW9CLENBQUMsSUFBSSxLQUFLLGtCQUFrQixFQUMvQyxDQUFDO2dCQUNGLHlDQUF5QztnQkFDekMsTUFBTSxjQUFjLEdBQUcsZUFBZSxFQUFFLGNBQWMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDN0QsTUFBTSxvQkFBb0IsR0FBRyxlQUFlLEVBQUUsb0JBQW9CLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBRXpFLElBQUksQ0FBQyxlQUFlLElBQUksQ0FBQyxjQUFjLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO29CQUNsRSxPQUFPLEVBQUUsQ0FBQztnQkFDWCxDQUFDO2dCQUVELGFBQWEsR0FBRyxvQkFBb0IsQ0FBQyxJQUFJLEtBQUssa0JBQWtCO29CQUMvRCxDQUFDLENBQUMsb0JBQW9CLENBQUMsRUFBRTtvQkFDekIsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUM7Z0JBRXJCLG1CQUFtQixHQUFHLE1BQU0sZUFBZSxDQUFDLG9DQUFvQyxDQUFDO29CQUNoRixjQUFjLENBQUMsSUFBSTtvQkFDbkIsb0JBQW9CLENBQUMsSUFBSTtpQkFBQyxDQUFDLENBQUM7WUFDOUIsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLGVBQWU7Z0JBQ2YsYUFBYSxHQUFHLFdBQVcsQ0FBQyxFQUFFLENBQUM7Z0JBRS9CLElBQUksV0FBVyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQ3RDLDZEQUE2RDtvQkFDN0QsSUFBSSxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLHdCQUF3QixFQUFFLENBQUM7d0JBQzNELE1BQU0sY0FBYyxHQUFHLGVBQWUsRUFBRSxjQUFjLENBQUMsR0FBRyxFQUFFLENBQUM7d0JBQzdELE1BQU0sb0JBQW9CLEdBQUcsZUFBZSxFQUFFLG9CQUFvQixDQUFDLEdBQUcsRUFBRSxDQUFDO3dCQUV6RSxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUMsY0FBYyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQzs0QkFDbEUsT0FBTyxFQUFFLENBQUM7d0JBQ1gsQ0FBQzt3QkFFRCxtQkFBbUIsR0FBRyxNQUFNLGVBQWUsQ0FBQyxvQ0FBb0MsQ0FBQzs0QkFDaEYsY0FBYyxDQUFDLElBQUk7NEJBQ25CLG9CQUFvQixDQUFDLElBQUk7eUJBQUMsQ0FBQyxDQUFDO29CQUM5QixDQUFDO3lCQUFNLENBQUM7d0JBQ1AsbUJBQW1CLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDaEQsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztZQUVELE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxlQUFlLEVBQUUseUJBQXlCLENBQUMsYUFBYSxFQUFFLG1CQUFtQixDQUFDLElBQUksRUFBRSxDQUFDO1lBRXRILElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSwrQkFBa0IsRUFBRSxDQUFDO2dCQUN2QyxPQUFPO2dCQUNQLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO29CQUNsRCxVQUFVLEVBQUUsY0FBYyxDQUFDLFVBQVU7b0JBQ3JDLG9CQUFvQixFQUFFLGNBQWMsQ0FBQyxvQkFBb0I7b0JBQ3pELGlCQUFpQixFQUFFLE1BQU07b0JBQ3pCLFlBQVksRUFBRSxjQUFjLENBQUMsb0JBQW9CLENBQUMsZUFBZTtvQkFDakUsSUFBSSxFQUFFLDRCQUE0QjtpQkFDa0IsQ0FBQSxDQUFDLENBQUMsQ0FBQztZQUN6RCxDQUFDO2lCQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSwrQkFBa0IsRUFBRSxDQUFDO2dCQUM5QyxPQUFPO2dCQUNQLE1BQU0sT0FBTyxHQUFHLGNBQWMsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLE9BQU8sSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUM1RSxNQUFNLHNCQUFzQixHQUFHLElBQUksWUFBWSxDQUErRSxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ3ZKLEtBQUssTUFBTSxNQUFNLElBQUksa0JBQWtCLEVBQUUsQ0FBQztvQkFDekMsc0JBQXNCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUU7d0JBQ3RDLFVBQVUsRUFBRSxjQUFjLENBQUMsVUFBVTt3QkFDckMsb0JBQW9CLEVBQUUsY0FBYyxDQUFDLG9CQUFvQjt3QkFDekQsaUJBQWlCLEVBQUUsTUFBTTt3QkFDekIsWUFBWSxFQUFFLGNBQWMsQ0FBQyxvQkFBb0IsQ0FBQyxlQUFlO3dCQUNqRSxJQUFJLEVBQUUsNEJBQTRCO3FCQUNsQyxDQUFDLENBQUM7Z0JBQ0osQ0FBQztnQkFDRCxLQUFLLE1BQU0sSUFBSSxJQUFJLHNCQUFzQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFDekQsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxDQUFDO2dCQUNyQyxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7YUFBTSxJQUFJLFlBQVksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLElBQUksMEJBQTBCLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQztZQUN0RyxPQUFPO1lBQ1AsS0FBSyxNQUFNLElBQUksSUFBSSxjQUFjLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQzVDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsYUFBYSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDL0UsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLFFBQVEsQ0FBQztJQUNqQixDQUFDO0lBRUQsV0FBVyxDQUFDLGNBQWlEO1FBQzVELE9BQU8sY0FBYyxZQUFZLG1CQUFtQjtZQUNuRCxvQ0FBb0MsQ0FBQyxjQUFjLENBQUM7WUFDcEQsQ0FBQywwQkFBMEIsQ0FBQyxjQUFjLENBQUMsSUFBSSxjQUFjLENBQUMsYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ25GLENBQUM7Q0FDRDtBQUVELE1BQU0seUJBQXlCO0lBQzlCLFVBQVUsQ0FBQyxPQUFvQjtRQUM5QixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDN0MsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0lBQ3BDLENBQUM7SUFFRCxXQUFXLENBQUMsSUFBc0IsRUFBRSxhQUF3QjtRQUMzRCxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ2pDLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQTJELENBQUMsQ0FBQztRQUMzRyxJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDL0IsT0FBTztRQUNSLENBQUM7UUFFRCxhQUFhLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFDdEcsQ0FBQztJQUVELFlBQVksQ0FBQyxRQUF1QixFQUFFLGFBQXdCO1FBQzdELElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUMzQixNQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUIsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUVELE9BQU8sTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRUQsVUFBVSxDQUFDLElBQXNCLEVBQUUsYUFBc0MsRUFBRSxXQUErQixFQUFFLFlBQThDLEVBQUUsYUFBd0I7UUFDbkwsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0lBRUQsSUFBSSxDQUFDLElBQXNCLEVBQUUsYUFBc0MsRUFBRSxXQUErQixFQUFFLFlBQThDLEVBQUUsYUFBd0IsSUFBVSxDQUFDO0lBRWpMLG1CQUFtQixDQUFDLElBQXlEO1FBQ3BGLE1BQU0sWUFBWSxHQUFpQyxFQUFFLENBQUM7UUFDdEQsS0FBSyxNQUFNLE9BQU8sSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sSUFBSSxFQUFFLEVBQUUsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUNqRSxJQUFJLENBQUMsb0NBQW9DLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztnQkFDcEQsU0FBUztZQUNWLENBQUM7WUFFRCxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQztZQUM3QyxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsb0JBQW9CLENBQUMsV0FBVyxDQUFDO1lBQzdELE1BQU0sY0FBYyxHQUFHLEtBQUssT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLFVBQVUsUUFBUSxDQUFDLElBQUksV0FBVyxPQUFPLENBQUMsU0FBUyxDQUFDLEVBQUUsVUFBVSxXQUFXLENBQUMsU0FBUyxJQUFJLFdBQVcsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNySixNQUFNLG1CQUFtQixHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBRXBHLFlBQVksQ0FBQyxJQUFJLENBQUM7Z0JBQ2pCLElBQUksRUFBRSxjQUFjO2dCQUNwQixRQUFRLEVBQUUsc0JBQXNCLENBQUMscUJBQXFCLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxFQUFFLEVBQUUsbUJBQW1CLEVBQUUsV0FBVyxDQUFDLFNBQVMsQ0FBQztnQkFDNUgsV0FBVyxFQUFFLFdBQVc7YUFDeEIsQ0FBQyxDQUFDO1FBQ0osQ0FBQztRQUVELE9BQU8sWUFBWSxDQUFDO0lBQ3JCLENBQUM7SUFFTyxvQkFBb0IsQ0FBQyxPQUFvQjtRQUNoRCxJQUFJLG9DQUFvQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDbkQsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixDQUFDLFdBQVcsQ0FBQztZQUM3RCxPQUFPLFdBQVcsQ0FBQyxTQUFTLElBQUksV0FBVyxDQUFDLEVBQUUsQ0FBQztRQUNoRCxDQUFDO1FBRUQsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVPLGtCQUFrQixDQUFDLE9BQW9CO1FBQzlDLElBQUksb0NBQW9DLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNuRCxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQztZQUM3QyxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsb0JBQW9CLENBQUMsV0FBVyxDQUFDO1lBQzdELE1BQU0sbUJBQW1CLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFFcEcsT0FBTyxzQkFBc0IsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLEVBQUUsRUFBRSxtQkFBbUIsRUFBRSxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDM0gsQ0FBQztRQUVELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFRCxPQUFPLEtBQVcsQ0FBQztDQUNuQjtBQVdELElBQU0sbUJBQW1CLEdBQXpCLE1BQU0sbUJBQW9CLFNBQVEsVUFBVTtJQW1CM0MsWUFDd0IscUJBQTZELEVBQ2hFLGtCQUF1RCxFQUN4RCxpQkFBcUQsRUFDM0QsV0FBeUMsRUFDckMsZUFBaUQsRUFDakQsZUFBaUQ7UUFFbEUsS0FBSyxFQUFFLENBQUM7UUFQZ0MsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtRQUMvQyx1QkFBa0IsR0FBbEIsa0JBQWtCLENBQW9CO1FBQ3ZDLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBbUI7UUFDMUMsZ0JBQVcsR0FBWCxXQUFXLENBQWE7UUFDcEIsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBQ2hDLG9CQUFlLEdBQWYsZUFBZSxDQUFpQjtRQWpCbEQsd0JBQW1CLEdBQUcsZUFBZSxDQUEwQixJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFckYsa0NBQTZCLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkQscUJBQWdCLEdBQUcsZUFBZSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QyxxQkFBZ0IsR0FBRyxJQUFJLEdBQUcsRUFBbUMsQ0FBQztRQUM5RCwyQkFBc0IsR0FBRyxJQUFJLEdBQUcsRUFBaUMsQ0FBQztRQWVsRixJQUFJLENBQUMsc0JBQXNCLEdBQUcsSUFBSSxDQUFDLDRCQUE0QixFQUFFLENBQUM7UUFDbEUsSUFBSSxDQUFDLFFBQVEsR0FBRyxlQUFlLENBQVcsSUFBSSxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO1FBRXJFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLDRCQUE0QixFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDeEYsSUFBSSxDQUFDLGVBQWUsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLDRCQUE0QixFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFM0YsSUFBSSxDQUFDLHVCQUF1QixHQUFHLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDL0YsSUFBSSxDQUFDLHNCQUFzQixHQUFHLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDN0YsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFFckQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxlQUFlLEdBQUcsQ0FBQztZQUMzRCxDQUFDLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUNoRSxDQUFDLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUN6QixLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsRUFDL0MsVUFBVSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUU1QixNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDeEMsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ2pFLElBQUksa0JBQWtCLEtBQUssTUFBTSxFQUFFLENBQUM7Z0JBQ25DLE9BQU8sa0JBQWtCLENBQUM7WUFDM0IsQ0FBQztZQUVELE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsVUFBVSxDQUFDO1FBQ3ZFLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLFVBQVUsR0FBRyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxlQUFlLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQztRQUUvRSxNQUFNLGdCQUFnQixHQUFHLG1CQUFtQixDQUFDLElBQUksRUFDaEQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxxQkFBcUIsRUFDdEMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUUzQiw0QkFBNEI7UUFDNUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDL0IsTUFBTSxVQUFVLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ2pELElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDakIsT0FBTztZQUNSLENBQUM7WUFFRCxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLFVBQVUsRUFBRSxDQUFDO2dCQUNwRCxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsSUFBSSxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDbEcsQ0FBQztZQUVELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDMUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxvQkFBb0I7UUFDbkIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUN6QyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDakIsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFRCxxQkFBcUI7UUFDcEIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUN6QyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDakIsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsc0JBQXNCLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUM7UUFDbkcsSUFBSSxXQUFXLEtBQUssS0FBSyxJQUFJLFdBQVcsS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUNyRCxPQUFPLFdBQVcsQ0FBQztRQUNwQixDQUFDO1FBRUQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUM5RCxPQUFPLGVBQWUsRUFBRSxrQkFBa0IsQ0FBQztJQUM1QyxDQUFDO0lBRUQsZ0NBQWdDO1FBQy9CLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDekMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2pCLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3BELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNaLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxNQUFNLGVBQWUsR0FBRyxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNuRSxNQUFNLGNBQWMsR0FBRyxlQUFlLEVBQUUsY0FBYyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBRTdELE9BQU8sS0FBSyxDQUFDLFVBQVU7YUFDckIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxFQUFFLEtBQUssY0FBYyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2pHLENBQUM7SUFFRCxRQUFRLENBQUMsTUFBZTtRQUN2QixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ3pDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNqQixPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDcEQsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1osT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxFQUFFLEdBQUcsS0FBSyxFQUFFLFFBQVEsRUFBRSxNQUFNLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQztJQUMvRSxDQUFDO0lBRUQsS0FBSyxDQUFDLGVBQWU7UUFDcEIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUN6QyxNQUFNLGVBQWUsR0FBRyxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNuRSxNQUFNLGNBQWMsR0FBRyxlQUFlLEVBQUUsY0FBYyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQzdELE1BQU0sb0JBQW9CLEdBQUcsZUFBZSxFQUFFLG9CQUFvQixDQUFDLEdBQUcsRUFBRSxDQUFDO1FBRXpFLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUNyQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzNDLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztRQUVELElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFbEQsSUFBSSxDQUFDLEtBQUssSUFBSSxLQUFLLENBQUMsUUFBUSxLQUFLLEtBQUssRUFBRSxDQUFDO1lBQ3hDLE1BQU0sWUFBWSxHQUFHLEtBQUssRUFBRSxVQUFVO2lCQUNwQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FDWixFQUFFLENBQUMsb0JBQW9CLENBQUMsSUFBSSxLQUFLLGtCQUFrQjtnQkFDbkQsRUFBRSxDQUFDLG9CQUFvQixDQUFDLElBQUksS0FBSyxrQkFBa0IsQ0FBQztpQkFDcEQsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUV2RCxNQUFNLGVBQWUsR0FBRyxLQUFLLEVBQUUsa0JBQWtCO2dCQUNoRCxNQUFNLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxVQUFVLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFFbkUsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQVMsb0JBQW9CLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDaEcsTUFBTSxpQkFBaUIsR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLFFBQVEsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7WUFFN0UsR0FBRyxDQUFDO2dCQUNILHVDQUF1QztnQkFDdkMsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxlQUFlLENBQUMsbUJBQW1CLENBQUM7b0JBQy9ELGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFlBQVksQ0FBQyxNQUFNO2lCQUNwRSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNaLENBQUMsUUFBUSxPQUFPLEtBQUssRUFBRSxRQUFRLEtBQUssUUFBUSxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssS0FBSyxFQUFFLFFBQVEsQ0FBQyxFQUFFO1lBRXpHLHlCQUF5QjtZQUN6QixNQUFNLFNBQVMsR0FBRyxjQUFjLElBQUksb0JBQW9CLElBQUksS0FBSyxFQUFFLFNBQVMsS0FBSyxTQUFTO2dCQUN6RixDQUFDLENBQUMsTUFBTSxlQUFlLENBQUMsb0NBQW9DLENBQUM7b0JBQzVELGNBQWMsQ0FBQyxJQUFJO29CQUNuQixvQkFBb0IsQ0FBQyxJQUFJO2lCQUFDLENBQUM7Z0JBQzVCLENBQUMsQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDO1lBRXBCLHVCQUF1QjtZQUN2QixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsZUFBZSxDQUFDLENBQUM7WUFFekQsNEZBQTRGO1lBQzVGLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyw4QkFBOEIsQ0FBQyxHQUFHLEVBQUU7bUJBQ3BGLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxLQUFLLG9CQUFvQixFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBRXJFLHFGQUFxRjtZQUNyRixNQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsOEJBQThCLENBQUMsR0FBRyxFQUFFO21CQUNwRixlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsS0FBSyxjQUFjLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFFL0QsTUFBTSxVQUFVLEdBQUcsK0JBQStCLENBQ2pELFlBQVksRUFDWixRQUFRLEVBQ1IsZUFBZSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsRUFDcEMsZUFBZSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsRUFBRSxFQUMxQyxlQUFlLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFFLEVBQ3hDLHNCQUFzQixFQUN0QixzQkFBc0IsRUFDdEIsU0FBUyxDQUFDO2lCQUNULEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDN0IsVUFBVTtnQkFDVixvQkFBb0I7Z0JBQ3BCLElBQUksRUFBRSxzQkFBc0I7YUFDNUIsQ0FBOEMsQ0FBQyxDQUFDO1lBRWxELEtBQUssR0FBRyxFQUFFLGtCQUFrQixFQUFFLGVBQWUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsQ0FBQztZQUN4RixJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUU3QyxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNwRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFFRCxPQUFPLEtBQUssQ0FBQyxVQUFVLENBQUM7SUFDekIsQ0FBQztJQUVELGFBQWEsQ0FBQyxVQUFtQztRQUNoRCxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUNyRCxDQUFDO0lBRUQscUJBQXFCLENBQUMsTUFBNkI7UUFDbEQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUN6QyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDakIsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLE1BQU0sS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUN2QixJQUFJLENBQUMsc0JBQXNCLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDOUUsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsc0JBQXNCLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUN6RSxDQUFDO1FBQ0QsSUFBSSxDQUFDLDRCQUE0QixFQUFFLENBQUM7UUFFcEMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBRUQsV0FBVyxDQUFDLFFBQWtCO1FBQzdCLElBQUksUUFBUSxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztZQUN0QyxPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMsc0JBQXNCLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzFDLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLHdCQUF3QixFQUFFLFFBQVEsNkRBQTZDLENBQUM7SUFDNUcsQ0FBQztJQUVPLFlBQVk7UUFDbkIsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBa0IscUJBQXFCLENBQUMsS0FBSyxNQUFNLENBQUMsQ0FBQyw0QkFBZSxDQUFDLDJCQUFjLENBQUM7UUFDbEksTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsd0JBQXdCLGlDQUFxQyxDQUFDO1FBQzNHLElBQUksT0FBTyxXQUFXLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDckMsSUFBSSxHQUFHLFdBQVcsQ0FBQztRQUNwQixDQUFDO1FBRUQsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRU8saUJBQWlCLENBQUMsZUFBcUM7UUFDOUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUN6QyxNQUFNLGVBQWUsR0FBRyxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNuRSxNQUFNLGNBQWMsR0FBRyxlQUFlLEVBQUUsY0FBYyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQzdELE1BQU0sb0JBQW9CLEdBQUcsZUFBZSxFQUFFLG9CQUFvQixDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ3pFLE1BQU0sa0JBQWtCLEdBQUcsZUFBZSxFQUFFLGtCQUFrQixDQUFDLEdBQUcsRUFBRSxDQUFDO1FBRXJFLE1BQU0sUUFBUSxHQUFHLElBQUksR0FBRyxFQUF1QyxDQUFDO1FBRWhFLElBQUksY0FBYyxFQUFFLENBQUM7WUFDcEIsUUFBUSxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsRUFBRSxFQUFFLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUV0RCxJQUFJLG9CQUFvQixFQUFFLENBQUM7Z0JBQzFCLFFBQVEsQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsRUFBRSxFQUFFLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25FLENBQUM7WUFDRCxJQUFJLGtCQUFrQixFQUFFLENBQUM7Z0JBQ3hCLFFBQVEsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsRUFBRSxFQUFFLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQy9ELENBQUM7UUFDRixDQUFDO1FBRUQsNkRBQTZEO1FBQzdELDZEQUE2RDtRQUM3RCwrREFBK0Q7UUFDL0QsWUFBWTtRQUNaLEtBQUssTUFBTSxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7WUFDbkMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7Z0JBQzNCLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUNqQyxDQUFDO1FBQ0YsQ0FBQztRQUVELE9BQU8sUUFBUSxDQUFDO0lBQ2pCLENBQUM7SUFFTyxLQUFLLENBQUMseUJBQXlCLENBQUMsVUFBMEIsRUFBRSxlQUFvQztRQUN2RyxNQUFNLGVBQWUsR0FBeUIsRUFBRSxDQUFDO1FBQ2pELE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDO1FBRTFHLFFBQVEsa0JBQWtCLEVBQUUsQ0FBQztZQUM1QixLQUFLLEtBQUs7Z0JBQ1QsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxlQUFlLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNoRixNQUFNO1lBQ1AsS0FBSyxNQUFNO2dCQUNWLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRztvQkFDdkIsZUFBZSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUU7b0JBQ3BDLGVBQWUsQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLEVBQUU7b0JBQzFDLGVBQWUsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUU7aUJBQ3hDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hCLE1BQU07WUFDUCxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUNULHlFQUF5RTtnQkFDekUsTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLGVBQWUsQ0FBQyxzQkFBc0IsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQztxQkFDbkYsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxLQUFLLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUV0RSxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ3ZCLG1CQUFtQjtvQkFDbkIsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHO3dCQUN2QixlQUFlLENBQUMsY0FBYyxDQUFDLEdBQUcsRUFBRTt3QkFDcEMsZUFBZSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsRUFBRTt3QkFDMUMsZUFBZSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsRUFBRTtxQkFDeEMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDeEIsSUFBSSxDQUFDLHNCQUFzQixDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pFLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxnQkFBZ0I7b0JBQ2hCLGVBQWUsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztvQkFDOUIsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDL0YsQ0FBQztnQkFFRCxJQUFJLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztnQkFFcEMsTUFBTTtZQUNQLENBQUM7UUFDRixDQUFDO1FBRUQsT0FBTyxlQUFlLENBQUM7SUFDeEIsQ0FBQztJQUVPLDRCQUE0QjtRQUNuQyxJQUFJLENBQUM7WUFDSixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxnQ0FBZ0MsaUNBQXlCLENBQUM7WUFDdEcsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDaEIsT0FBTyxJQUFJLEdBQUcsQ0FBZ0MsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQ3ZFLENBQUM7UUFDRixDQUFDO1FBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUVYLE9BQU8sSUFBSSxHQUFHLEVBQWlDLENBQUM7SUFDakQsQ0FBQztJQUVPLDRCQUE0QjtRQUNuQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ2pFLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLGdDQUFnQyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLDZEQUE2QyxDQUFDO0lBQ2xJLENBQUM7SUFFUSxPQUFPO1FBQ2YsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzlCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNqQixDQUFDO0NBQ0QsQ0FBQTtBQXhWSyxtQkFBbUI7SUFvQnRCLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxrQkFBa0IsQ0FBQTtJQUNsQixXQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFdBQUEsV0FBVyxDQUFBO0lBQ1gsV0FBQSxlQUFlLENBQUE7SUFDZixXQUFBLGVBQWUsQ0FBQTtHQXpCWixtQkFBbUIsQ0F3VnhCO0FBSUQsSUFBTSxnQkFBZ0IsR0FBdEIsTUFBTSxnQkFBZ0I7SUFPckIsWUFDcUIsa0JBQXVELEVBQzFELGVBQWlEO1FBRDdCLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBb0I7UUFDekMsb0JBQWUsR0FBZixlQUFlLENBQWlCO1FBUmxELHVCQUFrQixHQUE0QjtZQUM5RCxLQUFLLEVBQUUsUUFBUSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUM7WUFDL0IsV0FBVyxFQUFFLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSx5REFBeUQsQ0FBQztZQUNwRyxVQUFVLEVBQUUsTUFBTTtTQUNsQixDQUFDO0lBS0UsQ0FBQztJQUVMLEtBQUssQ0FBQyxjQUFjO1FBQ25CLE1BQU0sS0FBSyxHQUFzRDtZQUNoRSxJQUFJLENBQUMsa0JBQWtCO1lBQ3ZCLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRTtTQUFDLENBQUM7UUFFeEIsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDekQsS0FBSyxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSTtZQUN0QixXQUFXLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsTUFBTTtZQUN2QyxTQUFTLEVBQUUsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQztnQkFDcEQsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUM7Z0JBQzVDLENBQUMsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7WUFDdEMsVUFBVSxFQUFFLENBQUM7U0FDYixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUwsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRTtZQUMxQyxXQUFXLEVBQUUsUUFBUSxDQUFDLG9CQUFvQixFQUFFLGdFQUFnRSxDQUFDO1NBQzdHLENBQUMsQ0FBQztJQUNKLENBQUM7Q0FDRCxDQUFBO0FBOUJLLGdCQUFnQjtJQVFuQixXQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFdBQUEsZUFBZSxDQUFBO0dBVFosZ0JBQWdCLENBOEJyQjtBQUlELElBQU0sb0JBQW9CLEdBQTFCLE1BQU0sb0JBQXFCLFNBQVEsVUFBVTtJQWU1QyxZQUNrQixnQkFBcUMsRUFDckMsbUJBQTBELEVBQ3ZELGtCQUF1RDtRQUUzRSxLQUFLLEVBQUUsQ0FBQztRQUpTLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBcUI7UUFDckMsd0JBQW1CLEdBQW5CLG1CQUFtQixDQUF1QztRQUN0Qyx1QkFBa0IsR0FBbEIsa0JBQWtCLENBQW9CO1FBakIzRCxzQkFBaUIsR0FBZ0M7WUFDakUsRUFBRSxFQUFFLEtBQUs7WUFDVCxLQUFLLEVBQUUsUUFBUSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUM7WUFDN0IsV0FBVyxFQUFFLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSw2QkFBNkIsQ0FBQztZQUMxRSxjQUFjLEVBQUUsS0FBSztTQUNyQixDQUFDO1FBRWUsdUJBQWtCLEdBQWdDO1lBQ2xFLEVBQUUsRUFBRSxNQUFNO1lBQ1YsS0FBSyxFQUFFLFFBQVEsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDO1lBQy9CLFdBQVcsRUFBRSxRQUFRLENBQUMsdUJBQXVCLEVBQUUsbUNBQW1DLENBQUM7WUFDbkYsY0FBYyxFQUFFLE1BQU07U0FDdEIsQ0FBQztJQVFGLENBQUM7SUFFRCxLQUFLLENBQUMsa0JBQWtCO1FBQ3ZCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLENBQThCLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDaEgsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFM0IsU0FBUyxDQUFDLFdBQVcsR0FBRyxRQUFRLENBQUMsd0JBQXdCLEVBQUUsaUVBQWlFLENBQUMsQ0FBQztRQUM5SCxTQUFTLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztRQUMvQixTQUFTLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQztRQUM5QixTQUFTLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUN0QixTQUFTLENBQUMsSUFBSSxFQUFFLENBQUM7UUFFakIsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUVqRCx3QkFBd0I7UUFDeEIsSUFBSSxhQUFhLEdBQWtDLEVBQUUsQ0FBQztRQUN0RCxJQUFJLElBQUksQ0FBQyxtQkFBbUIsS0FBSyxLQUFLLEVBQUUsQ0FBQztZQUN4QyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQzVDLENBQUM7YUFBTSxJQUFJLElBQUksQ0FBQyxtQkFBbUIsS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUNoRCxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQzdDLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO1lBQ2QsT0FBTyxLQUFLLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUM3QixJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEtBQUssV0FBVyxFQUFFLENBQUM7b0JBQ3ZDLEtBQUssRUFBRSxDQUFDO29CQUNSLFNBQVM7Z0JBQ1YsQ0FBQztnQkFFRCxJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxLQUFLLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO29CQUN0RSxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQWtDLENBQUM7b0JBQ3JFLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztnQkFDN0IsQ0FBQztxQkFBTSxDQUFDO29CQUNQLEtBQUssRUFBRSxDQUFDO2dCQUNULENBQUM7WUFDRixDQUFDO1lBRUQsbURBQW1EO1lBQ25ELEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsRUFBRSxHQUFHLGFBQWEsQ0FBQyxDQUFDO1FBQzdELENBQUM7UUFFRCxTQUFTLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUN4QixTQUFTLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUN4QyxTQUFTLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQztRQUV2QixPQUFPLElBQUksT0FBTyxDQUFvQyxPQUFPLENBQUMsRUFBRTtZQUMvRCxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQ3RELE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxLQUFLLENBQUMsYUFBYSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pGLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztvQkFDdEIsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLEtBQUssSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLE1BQU0sRUFBRSxDQUFDO3dCQUM3RSxTQUFTLENBQUMsYUFBYSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3RDLENBQUM7eUJBQU0sQ0FBQzt3QkFDUCwyQ0FBMkM7d0JBQzNDLFNBQVMsQ0FBQyxhQUFhLEdBQUcsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxhQUFhO2lDQUNuRCxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLEtBQUssSUFBSSxDQUFDLENBQUMsY0FBYyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUM7b0JBQzNFLENBQUM7Z0JBQ0YsQ0FBQztnQkFFRCxhQUFhLEdBQUcsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUM5QyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRUosSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUU7Z0JBQzFDLElBQUksYUFBYSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztvQkFDaEMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNwQixDQUFDO3FCQUFNLElBQUksYUFBYSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsS0FBSyxLQUFLLEVBQUUsQ0FBQztvQkFDcEYsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNoQixDQUFDO3FCQUFNLElBQUksYUFBYSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsS0FBSyxNQUFNLEVBQUUsQ0FBQztvQkFDckYsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNqQixDQUFDO3FCQUFNLENBQUM7b0JBQ1AsT0FBTyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBRSxJQUFJLENBQUMsY0FBcUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNwRixDQUFDO2dCQUVELFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNsQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRUosSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUU7Z0JBQ3hDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDbkIsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2hCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFTyxLQUFLLENBQUMscUJBQXFCO1FBQ2xDLE1BQU0sS0FBSyxHQUEwRDtZQUNwRSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGtCQUFrQjtTQUMvQyxDQUFDO1FBRUYsTUFBTSxlQUFlLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxFQUFFLENBQUM7UUFDbkYsTUFBTSx5QkFBeUIsR0FBRyxPQUFPLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxRQUFRLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUVsSCxLQUFLLE1BQU0sSUFBSSxJQUFJLHlCQUF5QixFQUFFLENBQUM7WUFDOUMsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUN2QixTQUFTO1lBQ1YsQ0FBQztZQUVELEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUUzRCxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFDNUIsT0FBTztvQkFDTixFQUFFLEVBQUUsR0FBRyxDQUFDLEVBQUU7b0JBQ1YsS0FBSyxFQUFFLEdBQUcsQ0FBQyxJQUFJO29CQUNmLFdBQVcsRUFBRSxHQUFHLENBQUMsV0FBVztvQkFDNUIsU0FBUyxFQUFFLFNBQVMsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7d0JBQzNDLFNBQVMsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO29CQUM1QyxjQUFjLEVBQUUsR0FBRztpQkFDbkIsQ0FBQztZQUNILENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0NBQ0QsQ0FBQTtBQW5JSyxvQkFBb0I7SUFrQnZCLFdBQUEsa0JBQWtCLENBQUE7R0FsQmYsb0JBQW9CLENBbUl6QjtBQUVNLElBQU0sa0JBQWtCLEdBQXhCLE1BQU0sa0JBQW1CLFNBQVEsUUFBUTtJQTBCL0MsWUFDQyxPQUF5QixFQUNULGNBQStDLEVBQ3hDLHFCQUE2RCxFQUN0RSxZQUEyQyxFQUN2QyxnQkFBbUQsRUFDcEQsZUFBaUQsRUFDM0Msb0JBQTJDLEVBQzdDLGtCQUF1QyxFQUN4QyxpQkFBcUMsRUFDbEMsb0JBQTJDLEVBQzFDLHFCQUE2QyxFQUNqRCxpQkFBcUMsRUFDekMsYUFBNkIsRUFDOUIsWUFBMkIsRUFDM0IsWUFBMkI7UUFFMUMsS0FBSyxDQUFDO1lBQ0wsR0FBRyxPQUFPO1lBQ1YsV0FBVyxFQUFFLE1BQU0sQ0FBQyxlQUFlO1lBQ25DLFdBQVcsRUFBRSxtQkFBbUIsQ0FBQyxZQUFZO1NBQzdDLEVBQUUsaUJBQWlCLEVBQUUsa0JBQWtCLEVBQUUsb0JBQW9CLEVBQUUsaUJBQWlCLEVBQUUscUJBQXFCLEVBQUUsb0JBQW9CLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxZQUFZLENBQUMsQ0FBQztRQW5CMUksbUJBQWMsR0FBZCxjQUFjLENBQWdCO1FBQ3ZCLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBdUI7UUFDckQsaUJBQVksR0FBWixZQUFZLENBQWM7UUFDdEIscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFrQjtRQUNuQyxvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUF4QmxELDZCQUF3QixHQUFHLGVBQWUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEQsd0JBQW1CLEdBQUcsZUFBZSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUduRCwyQkFBc0IsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBRS9DLDRCQUF1QixHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7UUFDMUMsMkJBQXNCLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQztRQUN6QyxzQkFBaUIsR0FBRyxJQUFJLFNBQVMsRUFBRSxDQUFDO1FBQ3BDLDZCQUF3QixHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7UUFPM0MsNEJBQXVCLEdBQUcsSUFBSSxpQkFBaUIsRUFBbUIsQ0FBQztRQXlCbkYsSUFBSSxDQUFDLGVBQWUsR0FBRyxXQUFXLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUNwRixJQUFJLENBQUMsa0NBQWtDLEdBQUcsV0FBVyxDQUFDLGlDQUFpQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUM3SCxJQUFJLENBQUMsZ0NBQWdDLEdBQUcsV0FBVyxDQUFDLCtCQUErQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUN6SCxJQUFJLENBQUMsaUNBQWlDLEdBQUcsV0FBVyxDQUFDLGdDQUFnQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUUzSCxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsOEJBQThCLENBQUMsQ0FBQztRQUM5RixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUVuQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUVrQixpQkFBaUIsQ0FBQyxTQUFzQjtRQUMxRCxLQUFLLENBQUMsaUJBQWlCLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUUvQyxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsb0NBQW9DLEVBQUU7WUFDdkQsQ0FBQyxDQUFDLHdEQUF3RCxDQUFDO1NBQzNELENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxLQUFLLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztRQUN2QyxTQUFTLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVwQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsaUJBQWlCLENBQUMsdUJBQXVCLENBQUMsT0FBTyxDQUFDLEVBQUUsT0FBTyxDQUFDLElBQUksRUFBRTtZQUNsRyxRQUFRLEVBQUU7Z0JBQ1QsS0FBSyxFQUFFLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSxpRUFBaUUsQ0FBQztnQkFDMUcsaUJBQWlCLEVBQUUsSUFBSTthQUN2QjtZQUNELDRCQUE0QixFQUFFLFNBQVM7U0FDdkMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUMvQixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3ZELE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO1FBQ3JELENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRWtCLFVBQVUsQ0FBQyxTQUFzQjtRQUNuRCxLQUFLLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRTVCLElBQUksQ0FBQyxjQUFjLEdBQUcsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsNENBQTRDLENBQUMsQ0FBQyxDQUFDO1FBQ3pGLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1FBRTdELElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBRXRDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxLQUFLLEVBQUMsT0FBTyxFQUFDLEVBQUU7WUFDOUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNkLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDcEMsT0FBTztZQUNSLENBQUM7WUFFRCxvQkFBb0I7WUFDcEIsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFDcEYsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7WUFFckQsOENBQThDO1lBQzlDLE1BQU0sMEJBQTBCLEdBQUcsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRTtnQkFDekQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUMvRCxNQUFNLGVBQWUsR0FBRyxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzFFLE1BQU0sY0FBYyxHQUFHLGVBQWUsRUFBRSxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUVwRSxPQUFPLGNBQWMsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQ3hELENBQUMsQ0FBQyxDQUFDO1lBQ0gsTUFBTSxZQUFZLENBQUMsMEJBQTBCLENBQUMsQ0FBQztZQUUvQyxvQkFBb0I7WUFDcEIsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxLQUFLLElBQUksRUFBRTtnQkFDMUUsTUFBTSxJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLEtBQUssSUFBSSxFQUFFO29CQUNuRCxNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztvQkFDL0MsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO2dCQUMxQixDQUFDLENBQUMsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ2hELElBQUksQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNsRCxJQUFJLENBQUMsNEJBQTRCLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDMUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUVKLGtCQUFrQjtZQUNsQixJQUFJLENBQUMsc0JBQXNCLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLDhCQUE4QixFQUFFLEtBQUssSUFBSSxFQUFFO2dCQUMzRyxNQUFNLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN0QixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ0osSUFBSSxDQUFDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyw4QkFBOEIsRUFBRSxLQUFLLElBQUksRUFBRTtnQkFDM0csTUFBTSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUVKLG9CQUFvQjtZQUNwQixJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUM7WUFDdEIsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ2hELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDL0QsTUFBTSxlQUFlLEdBQUcsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUMxRSxJQUFJLENBQUMsVUFBVSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7b0JBQ3JDLE9BQU87Z0JBQ1IsQ0FBQztnQkFFRCxtQ0FBbUM7Z0JBQ25DLE1BQU0sZ0JBQWdCLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO29CQUN6QyxPQUFPLGVBQWUsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDeEQsQ0FBQyxDQUFDLENBQUM7Z0JBQ0gsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLGdCQUFnQixFQUFFLEtBQUssRUFBQyxxQkFBcUIsRUFBQyxFQUFFO29CQUM1RSxNQUFNLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFFckIsK0RBQStEO29CQUMvRCxJQUFJLENBQUMsaUNBQWlDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUM7Z0JBQ3ZHLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRUosMEJBQTBCO2dCQUMxQixNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLHFCQUFxQixFQUFFLE9BQU8sQ0FBQyxFQUFFO29CQUM3RSxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQzt3QkFDcEIsaUZBQWlGO3dCQUNqRiwrRUFBK0U7d0JBQy9FLG9EQUFvRDt3QkFDcEQsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsS0FBSyxDQUFDLEVBQUUsQ0FBQzs0QkFDaEMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDOzRCQUNmLE9BQU87d0JBQ1IsQ0FBQzt3QkFFRCx3Q0FBd0M7d0JBQ3hDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO3dCQUM5QyxPQUFPO29CQUNSLENBQUM7b0JBRUQsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNoQixDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUVKLGlDQUFpQztnQkFDakMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsNkJBQTZCLEVBQUUsS0FBSyxJQUFJLEVBQUU7b0JBQzFGLE1BQU0sSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUVyQiwrREFBK0Q7b0JBQy9ELElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2xILENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRUosK0JBQStCO2dCQUMvQixNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7b0JBQ2pDLElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFDbEcsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFFSiw2QkFBNkI7Z0JBQzdCLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtvQkFDakMsSUFBSSxDQUFDLGdDQUFnQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUM5RixDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUVKLG1CQUFtQjtnQkFDbkIsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLEtBQUssSUFBSSxFQUFFO29CQUNyRSxNQUFNLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDOUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFFSixpQkFBaUI7Z0JBQ2pCLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQ3pELElBQUksQ0FBQyxpQ0FBaUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRWpILHFFQUFxRTtnQkFDckUscUVBQXFFO2dCQUNyRSxnQkFBZ0I7Z0JBQ2hCLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztvQkFDakIsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNoQixDQUFDO2dCQUNELFVBQVUsR0FBRyxLQUFLLENBQUM7WUFDcEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUVKLGtDQUFrQztZQUNsQyxNQUFNLGdCQUFnQixHQUFHLG1CQUFtQixDQUMzQyxJQUFJLENBQUMsWUFBWSxDQUFDLHdCQUF3QixFQUMxQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQztZQUU3QyxJQUFJLENBQUMsc0JBQXNCLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDaEQsTUFBTSxhQUFhLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNwRCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBRTNELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxhQUFhLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDbkQsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3ZCLENBQUM7SUFFa0IsVUFBVSxDQUFDLE1BQWMsRUFBRSxLQUFhO1FBQzFELEtBQUssQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2hDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRVEsZUFBZTtRQUN2QixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUM7SUFDM0IsQ0FBQztJQUVRLGlCQUFpQjtRQUN6QixPQUFPLElBQUksQ0FBQyxjQUFjLEVBQUUsVUFBVSxDQUFDLEdBQUcsRUFBRSxFQUFFLFFBQVEsQ0FBQztJQUN4RCxDQUFDO0lBRVEsb0JBQW9CLENBQUMsTUFBZSxFQUFFLE9BQTRDO1FBQzFGLElBQUksTUFBTSxDQUFDLEVBQUUsS0FBSyx5QkFBeUIsRUFBRSxDQUFDO1lBQzdDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ3pELElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQ2hCLE9BQU8sSUFBSSwyQkFBMkIsQ0FBQyxVQUFVLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3JFLENBQUM7UUFDRixDQUFDO2FBQU0sSUFBSSxNQUFNLENBQUMsRUFBRSxLQUFLLGdDQUFnQyxFQUFFLENBQUM7WUFDM0QsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDekQsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsY0FBYyxFQUFFLHFCQUFxQixFQUFFLENBQUM7WUFDeEUsSUFBSSxVQUFVLElBQUksa0JBQWtCLEVBQUUsQ0FBQztnQkFDdEMsT0FBTyxJQUFJLGdDQUFnQyxDQUFDLFVBQVUsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDOUYsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVRLEtBQUs7UUFDYixLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFZCxNQUFNLGlCQUFpQixHQUFHLElBQUksYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3ZELElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDekMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUN2QixDQUFDO0lBRVEsaUJBQWlCO1FBQ3pCLE9BQU8sSUFBSSxDQUFDLGNBQWMsRUFBRSxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsS0FBSyxJQUFJLENBQUM7SUFDN0QsQ0FBQztJQUVELEtBQUssQ0FBQyxPQUFPO1FBQ1osT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFFTyxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQXdCO1FBQzlDLElBQUksS0FBSyxDQUFDLHVCQUF1QixFQUFFLENBQUM7WUFDbkMsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLENBQUMsY0FBYyxDQUFDLG9CQUFvQixFQUFFLENBQUM7UUFDM0MsTUFBTSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7UUFFN0IsSUFBSSxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztZQUNuQyxPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUNyQixJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztRQUMvQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7SUFDMUIsQ0FBQztJQUVELEtBQUssQ0FBQyxjQUFjO1FBQ25CLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUMzRSxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUU3QyxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1osSUFBSSxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3RELENBQUM7SUFDRixDQUFDO0lBRUQsS0FBSyxDQUFDLGtCQUFrQjtRQUN2QixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUN4RCxNQUFNLGVBQWUsR0FBRyxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNuRSxNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUV2RSxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUM3QyxPQUFPO1FBQ1IsQ0FBQztRQUVELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLENBQUMsb0JBQW9CLEVBQUUsZUFBZSxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDcEgsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUVqRCxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1osSUFBSSxDQUFDLGNBQWMsQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0YsQ0FBQztJQUVELEtBQUssQ0FBQyx3QkFBd0I7UUFDN0IsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDeEQsTUFBTSxlQUFlLEdBQUcsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDbkUsTUFBTSxjQUFjLEdBQUcsZUFBZSxFQUFFLGNBQWMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUM3RCxJQUFJLENBQUMsVUFBVSxJQUFJLENBQUMsY0FBYyxFQUFFLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxRQUFRLEVBQUUsQ0FBQztZQUNyRSxPQUFPO1FBQ1IsQ0FBQztRQUVELElBQUksQ0FBQyxJQUFJLENBQUMsNkJBQTZCLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7WUFDNUQsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLGNBQWMsR0FBRyxHQUFZLEVBQUU7WUFDcEMsTUFBTSxzQkFBc0IsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLGdDQUFnQyxFQUFFLENBQUM7WUFFdEYsSUFBSSxzQkFBc0IsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFLENBQUM7Z0JBQzFFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLHNCQUFzQixFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUUvQyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQztnQkFDbEQsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUM7Z0JBQzlDLE9BQU8sSUFBSSxDQUFDO1lBQ2IsQ0FBQztZQUVELE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQyxDQUFDO1FBRUYsSUFBSSxjQUFjLEVBQUUsRUFBRSxDQUFDO1lBQ3RCLE9BQU87UUFDUixDQUFDO1FBRUQsNkJBQTZCO1FBQzdCLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFOUMsY0FBYztRQUNkLGNBQWMsRUFBRSxDQUFDO0lBQ2xCLENBQUM7SUFFRCxXQUFXLENBQUMsUUFBa0I7UUFDN0IsSUFBSSxDQUFDLGNBQWMsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUVPLFdBQVcsQ0FBQyxTQUFzQjtRQUN6QyxJQUFJLENBQUMscUJBQXFCLEdBQUcsSUFBSSw4QkFBOEIsRUFBRSxDQUFDO1FBRWxFLE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyx3QkFBd0IsRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDN0osSUFBSSxDQUFDLFNBQVMsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBRXpDLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsY0FBYyxFQUFFLEVBQUUscUJBQXFCLEVBQUUsSUFBSSxDQUFDLHlCQUF5QixFQUFFLENBQUMsQ0FBQztRQUMzSSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBRS9CLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyx3QkFBd0IsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQ3BJLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRXJDLE1BQU0sa0JBQWtCLEdBQUcscUJBQXFCLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBRXhHLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FDcEQsa0NBQWtDLEVBQ2xDLGtCQUFrQixFQUNsQixTQUFTLEVBQ1QsSUFBSSxZQUFZLEVBQUUsRUFDbEIsSUFBSSxpQ0FBaUMsRUFBRSxFQUN2QztZQUNDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsbUJBQW1CLEVBQUUsd0JBQXdCLENBQUM7WUFDdkYsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyx5QkFBeUIsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsRUFBRSxjQUFjLENBQUM7WUFDN0gsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGNBQWMsQ0FBQywyQkFBMkIsRUFBRSxJQUFJLENBQUMsd0JBQXdCLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1NBQzVILEVBQ0QsSUFBSSxDQUFDLGVBQWUsRUFDcEI7WUFDQyxxQkFBcUIsRUFBRSxJQUFJLG1DQUFtQyxFQUFFO1lBQ2hFLGdCQUFnQixFQUFFLElBQUksQ0FBQyxxQkFBcUI7WUFDNUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFVLEVBQUUsRUFBRSxDQUFDLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDO1lBQ2pFLGtCQUFrQixFQUFFLGtCQUFrQixDQUFDLEdBQUcsRUFBRTtZQUM1QyxHQUFHLEVBQUUsSUFBSSx5QkFBeUIsRUFBRTtZQUNwQywrQkFBK0IsRUFBRSxJQUFJLDZDQUE2QyxFQUFFO1lBQ3BGLG1CQUFtQixFQUFFLEtBQUs7WUFDMUIsd0JBQXdCLEVBQUUsS0FBSztZQUMvQix5QkFBeUIsRUFBRSxDQUFDLENBQVUsRUFBRSxFQUFFO2dCQUN6QyxPQUFPLG9DQUFvQyxDQUFDLENBQUMsQ0FBQyxJQUFJLG1DQUFtQyxDQUFDLENBQUMsQ0FBQztvQkFDdkYsQ0FBQyxDQUFDLGtCQUFrQjtvQkFDcEIsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUNkLENBQUM7U0FDRCxDQUNtRixDQUFDO1FBQ3RGLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTNCLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN6RCxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDbEUsQ0FBQztJQUVPLDZCQUE2QixDQUFDLGdCQUFvQztRQUN6RSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUN2QixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUN0RSxJQUFJLGlCQUFpQixLQUFLLEtBQUssSUFBSSxpQkFBaUIsS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUNqRSxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFFRCxPQUFPLEtBQUssQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsS0FBSyxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ3pHLENBQUM7SUFFTyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQXNDO1FBQzlELElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDaEIsT0FBTztRQUNSLENBQUM7YUFBTSxJQUFJLDBDQUEwQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2xFLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztZQUN0RCxNQUFNLFdBQVcsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLG9CQUFvQixDQUFDLFdBQVcsQ0FBQztZQUMvRCxNQUFNLG9CQUFvQixHQUFHLFdBQVcsQ0FBQyxFQUFFLEtBQUssd0JBQXdCO2dCQUN2RSxDQUFDLENBQUMsUUFBUSxDQUFDLGlCQUFpQixFQUFFLGtCQUFrQixDQUFDO2dCQUNqRCxDQUFDLENBQUMsV0FBVyxDQUFDLEVBQUUsS0FBSyx3QkFBd0I7b0JBQzVDLENBQUMsQ0FBQyxRQUFRLENBQUMsaUJBQWlCLEVBQUUsa0JBQWtCLENBQUM7b0JBQ2pELENBQUMsQ0FBQyxXQUFXLENBQUMsU0FBUyxJQUFJLFdBQVcsQ0FBQyxFQUFFLENBQUM7WUFFNUMsTUFBTSxtQkFBbUIsR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUNwRyxNQUFNLDBCQUEwQixHQUFHLG1CQUFtQixJQUFJLFdBQVcsQ0FBQyxTQUFTO2dCQUM5RSxDQUFDLENBQUMsbUJBQW1CLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxXQUFXLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztnQkFDaEUsQ0FBQyxDQUFDLG1CQUFtQixDQUFDO1lBRXZCLElBQUksaUJBQWlCLENBQUMsV0FBVyxJQUFJLGlCQUFpQixDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUNwRSxjQUFjO2dCQUNkLE1BQU0sZ0JBQWdCLEdBQUcsR0FBRyxRQUFRLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxLQUFLLDBCQUEwQixHQUFHLENBQUM7Z0JBQzdHLE1BQU0sZ0JBQWdCLEdBQUcsR0FBRyxRQUFRLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxLQUFLLG9CQUFvQixHQUFHLENBQUM7Z0JBRXZHLE1BQU0sS0FBSyxHQUFHLEdBQUcsZ0JBQWdCLFdBQVcsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDL0QsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQztvQkFDcEMsS0FBSyxFQUFFLEtBQUs7b0JBQ1osUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixDQUFDLFdBQVcsRUFBRTtvQkFDckQsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixDQUFDLFdBQVcsRUFBRTtvQkFDckQsT0FBTyxFQUFFLENBQUMsQ0FBQyxhQUFhO2lCQUN4QixDQUFDLENBQUM7WUFDSixDQUFDO2lCQUFNLElBQUksaUJBQWlCLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQzFDLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUM7b0JBQ3BDLEtBQUssRUFBRSxHQUFHLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEtBQUssb0JBQW9CLEdBQUc7b0JBQ3BGLFFBQVEsRUFBRSxpQkFBaUIsQ0FBQyxXQUFXO29CQUN2QyxPQUFPLEVBQUUsQ0FBQyxDQUFDLGFBQWE7aUJBQ3hCLENBQUMsQ0FBQztZQUNKLENBQUM7aUJBQU0sSUFBSSxpQkFBaUIsQ0FBQyxXQUFXLEVBQUUsQ0FBQztnQkFDMUMsbUJBQW1CO2dCQUNuQixNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDO29CQUNwQyxLQUFLLEVBQUUsR0FBRyxRQUFRLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxLQUFLLDBCQUEwQixHQUFHO29CQUMxRixRQUFRLEVBQUUsaUJBQWlCLENBQUMsV0FBVztvQkFDdkMsT0FBTyxFQUFFLENBQUMsQ0FBQyxhQUFhO2lCQUN4QixDQUFDLENBQUM7WUFDSixDQUFDO1FBQ0YsQ0FBQzthQUFNLElBQUksbUNBQW1DLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDM0QsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBVSx3QkFBd0IsQ0FBQyxLQUFLLElBQUksQ0FBQztZQUNwRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQ25CLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDakIsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDN0IsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRU8sY0FBYyxDQUFDLENBQTRDO1FBQ2xFLE1BQU0sT0FBTyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUM7UUFFMUIsSUFBSSxvQ0FBb0MsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ25ELGNBQWM7WUFDZCxJQUFJLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLEtBQUssa0JBQWtCLElBQUksT0FBTyxDQUFDLG9CQUFvQixDQUFDLElBQUksS0FBSyxrQkFBa0IsRUFBRSxDQUFDO2dCQUMxSCwyRUFBMkU7Z0JBQzNFLE9BQU87WUFDUixDQUFDO1lBRUQsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1lBRTNELE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUMxRSxNQUFNLGNBQWMsR0FBRyxlQUFlLEVBQUUsY0FBYyxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQzdELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLENBQUM7WUFFN0QsTUFBTSx1QkFBdUIsR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBRTdILGtHQUFrRztZQUNsRyxtR0FBbUc7WUFDbkcsSUFBSSx1QkFBdUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLENBQUMsVUFBVSxFQUFFLE1BQU0sRUFBRSxDQUFDO2dCQUN2RyxNQUFNLHFCQUFxQixHQUFHLElBQUksR0FBRyxFQUFnQyxDQUFDO2dCQUV0RSxLQUFLLE1BQU0sR0FBRyxJQUFJLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxXQUFXLENBQUMsVUFBVSxFQUFFLENBQUM7b0JBQ3ZFLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGFBQWEsQ0FBQzt3QkFDcEUsQ0FBQyxtQkFBbUIsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDO3FCQUM3QixDQUFDLENBQUM7b0JBRUgsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQ25ELE1BQU0sQ0FBQyx3QkFBd0IsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO29CQUVyRCxLQUFLLE1BQU0sTUFBTSxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO3dCQUNyRCxJQUFJLENBQUMscUJBQXFCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDOzRCQUMzQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQzt3QkFDMUMsQ0FBQzt3QkFFRCxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDakQsQ0FBQztnQkFDRixDQUFDO2dCQUVELCtCQUErQjtnQkFDL0IsS0FBSyxNQUFNLHNCQUFzQixJQUFJLHVCQUF1QixFQUFFLENBQUM7b0JBQzlELE1BQU0sUUFBUSxHQUFHLHNCQUFzQixDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7b0JBRW5ELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQzt3QkFDMUMsU0FBUztvQkFDVixDQUFDO29CQUVELCtDQUErQztvQkFDL0MsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMscUJBQXFCLEVBQUU7d0JBQ2hHLEtBQUssRUFBRSxzQkFBc0IsQ0FBQyxPQUFPLENBQUMsS0FBSzt3QkFDM0MsT0FBTyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO3dCQUM3QixLQUFLLEVBQUUsc0JBQXNCLEVBQUUsS0FBSzt3QkFDcEMsS0FBSyxFQUFFLHNCQUFzQixFQUFFLEtBQUs7cUJBQ3BDLENBQUMsQ0FBQyxDQUFDO29CQUVKLCtDQUErQztvQkFDL0MsS0FBSyxNQUFNLGNBQWMsSUFBSSxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7d0JBQ3hFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxLQUFNLFNBQVEsT0FBTzs0QkFDM0U7Z0NBQ0MsS0FBSyxDQUFDO29DQUNMLEVBQUUsRUFBRSxHQUFHLFFBQVEsSUFBSSxjQUFjLENBQUMsRUFBRSxFQUFFO29DQUN0QyxLQUFLLEVBQUUsY0FBYyxDQUFDLElBQUk7b0NBQzFCLElBQUksRUFBRTt3Q0FDTCxFQUFFLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUM7d0NBQ3hCLEtBQUssRUFBRSxjQUFjLENBQUMsUUFBUTtxQ0FDOUI7aUNBQ0QsQ0FBQyxDQUFDOzRCQUNKLENBQUM7NEJBQ1EsR0FBRyxDQUFDLFFBQTBCLEVBQUUsR0FBRyxJQUFlO2dDQUMxRCxNQUFNLGNBQWMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dDQUNyRCxjQUFjLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxHQUFHLElBQUksRUFBRSxjQUFjLENBQUMsRUFBRSxDQUFDLENBQUM7NEJBQ3JFLENBQUM7eUJBQ0QsQ0FBQyxDQUFDLENBQUM7b0JBQ0wsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztZQUVELE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGFBQWEsQ0FBQztnQkFDcEUsQ0FBQyx3Q0FBd0MsRUFBRSxXQUFXLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEtBQUssY0FBYyxFQUFFLEVBQUUsQ0FBQyxLQUFLLFNBQVMsQ0FBQzthQUM1SCxDQUFDLENBQUM7WUFFSCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FDbkQsTUFBTSxDQUFDLHFCQUFxQixFQUM1QixpQkFBaUIsRUFBRTtnQkFDbkIsR0FBRyxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUTtnQkFDaEMsaUJBQWlCLEVBQUUsSUFBSTthQUN2QixDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLFFBQVEsQ0FBQyxDQUFDO1lBRTFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLENBQUM7Z0JBQ3ZDLGlCQUFpQixFQUFFLElBQUksQ0FBQyx1QkFBdUI7Z0JBQy9DLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTTtnQkFDekIsVUFBVSxFQUFFLEdBQUcsRUFBRSxDQUFDLHlCQUF5QixDQUFDLFdBQVcsQ0FBQztnQkFDeEQsaUJBQWlCLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLG9CQUFvQixDQUFDLFdBQVc7YUFDakUsQ0FBQyxDQUFDO1FBQ0osQ0FBQzthQUFNLElBQUksMENBQTBDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNoRSxvQkFBb0I7WUFDcEIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQ25ELE1BQU0sQ0FBQywyQkFBMkIsRUFDbEMsSUFBSSxDQUFDLHVCQUF1QixFQUFFO2dCQUM5QixHQUFHLEVBQUUsT0FBTyxDQUFDLG9CQUFvQixDQUFDLFdBQVc7Z0JBQzdDLGlCQUFpQixFQUFFLElBQUk7YUFDdkIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxRQUFRLENBQUMsQ0FBQztZQUUxQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsZUFBZSxDQUFDO2dCQUN2QyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsdUJBQXVCO2dCQUMvQyxTQUFTLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU07Z0JBQ3pCLFVBQVUsRUFBRSxHQUFHLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxXQUFXLENBQUM7Z0JBQ3hELGlCQUFpQixFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUI7YUFDbEQsQ0FBQyxDQUFDO1FBQ0osQ0FBQztJQUNGLENBQUM7SUFFTyxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQWU7UUFDdEMsT0FBTyxJQUFJLENBQUMsc0JBQXNCLENBQUMsS0FBSyxDQUFDLEtBQUssSUFBSSxFQUFFO1lBQ25ELElBQUksSUFBSSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7Z0JBQ3pDLE9BQU87WUFDUixDQUFDO1lBRUQsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDbkQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7WUFFckMsTUFBTSxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDN0IsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDckQsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRU8sZUFBZTtRQUN0QixPQUFPLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxLQUFLLENBQ3pDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQ3ZDLEtBQUssSUFBSSxFQUFFO1lBQ1YsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxFQUN6RSxLQUFLLElBQUksRUFBRTtnQkFDVixNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFO2dCQUNoRSxtREFBbUQ7aUJBQ25ELENBQUMsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFTyxtQkFBbUIsQ0FBQyxLQUFxQixFQUFFLFFBQWtCO1FBQ3BFLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRSxRQUFRLCtCQUFrQixDQUFDLENBQUM7UUFDbkYsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGdCQUFnQixFQUFFLFFBQVEsK0JBQWtCLENBQUMsQ0FBQztRQUNuRixJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsMEJBQTBCLEVBQUUsQ0FBQyxRQUFRLCtCQUFrQixJQUFJLEtBQUssQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztRQUN0SyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsYUFBYSxFQUFFLFFBQVEsK0JBQWtCLElBQUksS0FBSyxDQUFDLG1CQUFtQixLQUFLLElBQUksQ0FBQyxDQUFDO0lBQ3ZILENBQUM7SUFFUSxPQUFPO1FBQ2YsSUFBSSxDQUFDLHVCQUF1QixDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN0QyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDakIsQ0FBQztDQUNELENBQUE7QUExbUJZLGtCQUFrQjtJQTRCNUIsV0FBQSxjQUFjLENBQUE7SUFDZCxXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEsWUFBWSxDQUFBO0lBQ1osV0FBQSxnQkFBZ0IsQ0FBQTtJQUNoQixXQUFBLGVBQWUsQ0FBQTtJQUNmLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxtQkFBbUIsQ0FBQTtJQUNuQixXQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFdBQUEscUJBQXFCLENBQUE7SUFDckIsWUFBQSxzQkFBc0IsQ0FBQTtJQUN0QixZQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFlBQUEsY0FBYyxDQUFBO0lBQ2QsWUFBQSxhQUFhLENBQUE7SUFDYixZQUFBLGFBQWEsQ0FBQTtHQXpDSCxrQkFBa0IsQ0EwbUI5QiJ9