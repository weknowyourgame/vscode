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
import { Disposable, toDisposable, DisposableStore, DisposableMap } from '../../../../base/common/lifecycle.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { FocusedViewContext, getVisbileViewContextKey } from '../../../common/contextkeys.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { Event, Emitter } from '../../../../base/common/event.js';
import { isString } from '../../../../base/common/types.js';
import { MenuId, registerAction2, Action2, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { localize, localize2 } from '../../../../nls.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IExtensionService } from '../../extensions/common/extensions.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { PaneCompositeDescriptor, Extensions as PaneCompositeExtensions, PaneComposite } from '../../../browser/panecomposite.js';
import { IWorkbenchLayoutService } from '../../layout/browser/layoutService.js';
import { URI } from '../../../../base/common/uri.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { IEditorGroupsService } from '../../editor/common/editorGroupsService.js';
import { FilterViewPaneContainer } from '../../../browser/parts/views/viewsViewlet.js';
import { IPaneCompositePartService } from '../../panecomposite/browser/panecomposite.js';
import { IEditorService } from '../../editor/common/editorService.js';
import { IViewsService } from '../common/viewsService.js';
let ViewsService = class ViewsService extends Disposable {
    constructor(viewDescriptorService, paneCompositeService, contextKeyService, layoutService, editorService) {
        super();
        this.viewDescriptorService = viewDescriptorService;
        this.paneCompositeService = paneCompositeService;
        this.contextKeyService = contextKeyService;
        this.layoutService = layoutService;
        this.editorService = editorService;
        this._onDidChangeViewVisibility = this._register(new Emitter());
        this.onDidChangeViewVisibility = this._onDidChangeViewVisibility.event;
        this._onDidChangeViewContainerVisibility = this._register(new Emitter());
        this.onDidChangeViewContainerVisibility = this._onDidChangeViewContainerVisibility.event;
        this._onDidChangeFocusedView = this._register(new Emitter());
        this.onDidChangeFocusedView = this._onDidChangeFocusedView.event;
        this.viewContainerDisposables = this._register(new DisposableMap());
        this.viewDisposable = new Map();
        this.enabledViewContainersContextKeys = new Map();
        this.visibleViewContextKeys = new Map();
        this.viewPaneContainers = new Map();
        this._register(toDisposable(() => {
            this.viewDisposable.forEach(disposable => disposable.dispose());
            this.viewDisposable.clear();
        }));
        this.viewDescriptorService.viewContainers.forEach(viewContainer => this.onDidRegisterViewContainer(viewContainer, this.viewDescriptorService.getViewContainerLocation(viewContainer)));
        this._register(this.viewDescriptorService.onDidChangeViewContainers(({ added, removed }) => this.onDidChangeContainers(added, removed)));
        this._register(this.viewDescriptorService.onDidChangeContainerLocation(({ viewContainer, from, to }) => this.onDidChangeContainerLocation(viewContainer, from, to)));
        // View Container Visibility
        this._register(this.paneCompositeService.onDidPaneCompositeOpen(e => this._onDidChangeViewContainerVisibility.fire({ id: e.composite.getId(), visible: true, location: e.viewContainerLocation })));
        this._register(this.paneCompositeService.onDidPaneCompositeClose(e => this._onDidChangeViewContainerVisibility.fire({ id: e.composite.getId(), visible: false, location: e.viewContainerLocation })));
        this.focusedViewContextKey = FocusedViewContext.bindTo(contextKeyService);
    }
    onViewsAdded(added) {
        for (const view of added) {
            this.onViewsVisibilityChanged(view, view.isBodyVisible());
        }
    }
    onViewsVisibilityChanged(view, visible) {
        this.getOrCreateActiveViewContextKey(view).set(visible);
        this._onDidChangeViewVisibility.fire({ id: view.id, visible: visible });
    }
    onViewsRemoved(removed) {
        for (const view of removed) {
            this.onViewsVisibilityChanged(view, false);
        }
    }
    getOrCreateActiveViewContextKey(view) {
        const visibleContextKeyId = getVisbileViewContextKey(view.id);
        let contextKey = this.visibleViewContextKeys.get(visibleContextKeyId);
        if (!contextKey) {
            contextKey = new RawContextKey(visibleContextKeyId, false).bindTo(this.contextKeyService);
            this.visibleViewContextKeys.set(visibleContextKeyId, contextKey);
        }
        return contextKey;
    }
    onDidChangeContainers(added, removed) {
        for (const { container, location } of removed) {
            this.onDidDeregisterViewContainer(container, location);
        }
        for (const { container, location } of added) {
            this.onDidRegisterViewContainer(container, location);
        }
    }
    onDidRegisterViewContainer(viewContainer, viewContainerLocation) {
        this.registerPaneComposite(viewContainer, viewContainerLocation);
        const disposables = new DisposableStore();
        const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
        this.onViewDescriptorsAdded(viewContainerModel.allViewDescriptors, viewContainer);
        disposables.add(viewContainerModel.onDidChangeAllViewDescriptors(({ added, removed }) => {
            this.onViewDescriptorsAdded(added, viewContainer);
            this.onViewDescriptorsRemoved(removed);
        }));
        this.updateViewContainerEnablementContextKey(viewContainer);
        disposables.add(viewContainerModel.onDidChangeActiveViewDescriptors(() => this.updateViewContainerEnablementContextKey(viewContainer)));
        disposables.add(this.registerOpenViewContainerAction(viewContainer));
        this.viewContainerDisposables.set(viewContainer.id, disposables);
    }
    onDidDeregisterViewContainer(viewContainer, viewContainerLocation) {
        this.deregisterPaneComposite(viewContainer, viewContainerLocation);
        this.viewContainerDisposables.deleteAndDispose(viewContainer.id);
    }
    onDidChangeContainerLocation(viewContainer, from, to) {
        this.deregisterPaneComposite(viewContainer, from);
        this.registerPaneComposite(viewContainer, to);
        // Open view container if part is visible and there is only one view container in location
        if (this.layoutService.isVisible(getPartByLocation(to)) &&
            this.viewDescriptorService.getViewContainersByLocation(to).filter(vc => this.isViewContainerActive(vc.id)).length === 1) {
            this.openViewContainer(viewContainer.id);
        }
    }
    onViewDescriptorsAdded(views, container) {
        const location = this.viewDescriptorService.getViewContainerLocation(container);
        if (location === null) {
            return;
        }
        for (const viewDescriptor of views) {
            const disposables = new DisposableStore();
            disposables.add(this.registerOpenViewAction(viewDescriptor));
            disposables.add(this.registerFocusViewAction(viewDescriptor, container.title));
            disposables.add(this.registerResetViewLocationAction(viewDescriptor));
            this.viewDisposable.set(viewDescriptor, disposables);
        }
    }
    onViewDescriptorsRemoved(views) {
        for (const view of views) {
            const disposable = this.viewDisposable.get(view);
            if (disposable) {
                disposable.dispose();
                this.viewDisposable.delete(view);
            }
        }
    }
    updateViewContainerEnablementContextKey(viewContainer) {
        let contextKey = this.enabledViewContainersContextKeys.get(viewContainer.id);
        if (!contextKey) {
            contextKey = this.contextKeyService.createKey(getEnabledViewContainerContextKey(viewContainer.id), false);
            this.enabledViewContainersContextKeys.set(viewContainer.id, contextKey);
        }
        contextKey.set(!(viewContainer.hideIfEmpty && this.viewDescriptorService.getViewContainerModel(viewContainer).activeViewDescriptors.length === 0));
    }
    async openComposite(compositeId, location, focus) {
        return this.paneCompositeService.openPaneComposite(compositeId, location, focus);
    }
    getComposite(compositeId, location) {
        return this.paneCompositeService.getPaneComposite(compositeId, location);
    }
    // One view container can be visible at a time in a location
    isViewContainerVisible(id) {
        const viewContainer = this.viewDescriptorService.getViewContainerById(id);
        if (!viewContainer) {
            return false;
        }
        const viewContainerLocation = this.viewDescriptorService.getViewContainerLocation(viewContainer);
        if (viewContainerLocation === null) {
            return false;
        }
        return this.paneCompositeService.getActivePaneComposite(viewContainerLocation)?.getId() === id;
    }
    // Multiple view containers can be active/inactive at a time in a location
    isViewContainerActive(id) {
        const viewContainer = this.viewDescriptorService.getViewContainerById(id);
        if (!viewContainer) {
            return false;
        }
        if (!viewContainer.hideIfEmpty) {
            return true;
        }
        return this.viewDescriptorService.getViewContainerModel(viewContainer).activeViewDescriptors.length > 0;
    }
    getVisibleViewContainer(location) {
        const viewContainerId = this.paneCompositeService.getActivePaneComposite(location)?.getId();
        return viewContainerId ? this.viewDescriptorService.getViewContainerById(viewContainerId) : null;
    }
    getActiveViewPaneContainerWithId(viewContainerId) {
        const viewContainer = this.viewDescriptorService.getViewContainerById(viewContainerId);
        return viewContainer ? this.getActiveViewPaneContainer(viewContainer) : null;
    }
    async openViewContainer(id, focus) {
        const viewContainer = this.viewDescriptorService.getViewContainerById(id);
        if (viewContainer) {
            const viewContainerLocation = this.viewDescriptorService.getViewContainerLocation(viewContainer);
            if (viewContainerLocation !== null) {
                const paneComposite = await this.paneCompositeService.openPaneComposite(id, viewContainerLocation, focus);
                return paneComposite || null;
            }
        }
        return null;
    }
    async closeViewContainer(id) {
        const viewContainer = this.viewDescriptorService.getViewContainerById(id);
        if (viewContainer) {
            const viewContainerLocation = this.viewDescriptorService.getViewContainerLocation(viewContainer);
            const isActive = viewContainerLocation !== null && this.paneCompositeService.getActivePaneComposite(viewContainerLocation);
            if (viewContainerLocation !== null) {
                return isActive ? this.layoutService.setPartHidden(true, getPartByLocation(viewContainerLocation)) : undefined;
            }
        }
    }
    isViewVisible(id) {
        const activeView = this.getActiveViewWithId(id);
        return activeView?.isBodyVisible() || false;
    }
    getActiveViewWithId(id) {
        const viewContainer = this.viewDescriptorService.getViewContainerByViewId(id);
        if (viewContainer) {
            const activeViewPaneContainer = this.getActiveViewPaneContainer(viewContainer);
            if (activeViewPaneContainer) {
                return activeViewPaneContainer.getView(id);
            }
        }
        return null;
    }
    getViewWithId(id) {
        const viewContainer = this.viewDescriptorService.getViewContainerByViewId(id);
        if (viewContainer) {
            const viewPaneContainer = this.viewPaneContainers.get(viewContainer.id);
            if (viewPaneContainer) {
                return viewPaneContainer.getView(id);
            }
        }
        return null;
    }
    getFocusedView() {
        const viewId = this.contextKeyService.getContextKeyValue(FocusedViewContext.key) ?? '';
        return this.viewDescriptorService.getViewDescriptorById(viewId.toString());
    }
    getFocusedViewName() {
        const textEditorFocused = this.editorService.activeTextEditorControl?.hasTextFocus() ? localize('editor', "Text Editor") : undefined;
        return this.getFocusedView()?.name?.value ?? textEditorFocused ?? '';
    }
    async openView(id, focus) {
        const viewContainer = this.viewDescriptorService.getViewContainerByViewId(id);
        if (!viewContainer) {
            return null;
        }
        if (!this.viewDescriptorService.getViewContainerModel(viewContainer).activeViewDescriptors.some(viewDescriptor => viewDescriptor.id === id)) {
            return null;
        }
        const location = this.viewDescriptorService.getViewContainerLocation(viewContainer);
        const compositeDescriptor = this.getComposite(viewContainer.id, location);
        if (compositeDescriptor) {
            const paneComposite = await this.openComposite(compositeDescriptor.id, location);
            if (paneComposite?.openView) {
                return paneComposite.openView(id, focus) || null;
            }
            else if (focus) {
                paneComposite?.focus();
            }
        }
        return null;
    }
    closeView(id) {
        const viewContainer = this.viewDescriptorService.getViewContainerByViewId(id);
        if (viewContainer) {
            const activeViewPaneContainer = this.getActiveViewPaneContainer(viewContainer);
            if (activeViewPaneContainer) {
                const view = activeViewPaneContainer.getView(id);
                if (view) {
                    if (activeViewPaneContainer.views.length === 1) {
                        const location = this.viewDescriptorService.getViewContainerLocation(viewContainer);
                        if (location === 0 /* ViewContainerLocation.Sidebar */) {
                            this.layoutService.setPartHidden(true, "workbench.parts.sidebar" /* Parts.SIDEBAR_PART */);
                        }
                        else if (location === 1 /* ViewContainerLocation.Panel */ || location === 2 /* ViewContainerLocation.AuxiliaryBar */) {
                            this.paneCompositeService.hideActivePaneComposite(location);
                        }
                        // The blur event doesn't fire on WebKit when the focused element is hidden,
                        // so the context key needs to be forced here too otherwise a view may still
                        // think it's showing, breaking toggle commands.
                        if (this.focusedViewContextKey.get() === id) {
                            this.focusedViewContextKey.reset();
                        }
                    }
                    else {
                        view.setExpanded(false);
                    }
                }
            }
        }
    }
    getActiveViewPaneContainer(viewContainer) {
        const location = this.viewDescriptorService.getViewContainerLocation(viewContainer);
        if (location === null) {
            return null;
        }
        const activePaneComposite = this.paneCompositeService.getActivePaneComposite(location);
        if (activePaneComposite?.getId() === viewContainer.id) {
            return activePaneComposite.getViewPaneContainer() || null;
        }
        return null;
    }
    getViewProgressIndicator(viewId) {
        const viewContainer = this.viewDescriptorService.getViewContainerByViewId(viewId);
        if (!viewContainer) {
            return undefined;
        }
        const viewPaneContainer = this.viewPaneContainers.get(viewContainer.id);
        if (!viewPaneContainer) {
            return undefined;
        }
        const view = viewPaneContainer.getView(viewId);
        if (!view) {
            return undefined;
        }
        if (viewPaneContainer.isViewMergedWithContainer()) {
            return this.getViewContainerProgressIndicator(viewContainer);
        }
        return view.getProgressIndicator();
    }
    getViewContainerProgressIndicator(viewContainer) {
        const viewContainerLocation = this.viewDescriptorService.getViewContainerLocation(viewContainer);
        if (viewContainerLocation === null) {
            return undefined;
        }
        return this.paneCompositeService.getProgressIndicator(viewContainer.id, viewContainerLocation);
    }
    registerOpenViewContainerAction(viewContainer) {
        const disposables = new DisposableStore();
        if (viewContainer.openCommandActionDescriptor) {
            const { id, mnemonicTitle, keybindings, order } = viewContainer.openCommandActionDescriptor ?? { id: viewContainer.id };
            const title = viewContainer.openCommandActionDescriptor.title ?? viewContainer.title;
            const that = this;
            disposables.add(registerAction2(class OpenViewContainerAction extends Action2 {
                constructor() {
                    super({
                        id,
                        get title() {
                            const viewContainerLocation = that.viewDescriptorService.getViewContainerLocation(viewContainer);
                            const localizedTitle = typeof title === 'string' ? title : title.value;
                            const originalTitle = typeof title === 'string' ? title : title.original;
                            if (viewContainerLocation === 0 /* ViewContainerLocation.Sidebar */) {
                                return { value: localize('show view', "Show {0}", localizedTitle), original: `Show ${originalTitle}` };
                            }
                            else {
                                return { value: localize('toggle view', "Toggle {0}", localizedTitle), original: `Toggle ${originalTitle}` };
                            }
                        },
                        category: Categories.View,
                        precondition: ContextKeyExpr.has(getEnabledViewContainerContextKey(viewContainer.id)),
                        keybinding: keybindings ? { ...keybindings, weight: 200 /* KeybindingWeight.WorkbenchContrib */ } : undefined,
                        f1: true
                    });
                }
                async run(serviceAccessor) {
                    const editorGroupService = serviceAccessor.get(IEditorGroupsService);
                    const viewDescriptorService = serviceAccessor.get(IViewDescriptorService);
                    const layoutService = serviceAccessor.get(IWorkbenchLayoutService);
                    const viewsService = serviceAccessor.get(IViewsService);
                    const viewContainerLocation = viewDescriptorService.getViewContainerLocation(viewContainer);
                    switch (viewContainerLocation) {
                        case 2 /* ViewContainerLocation.AuxiliaryBar */:
                        case 0 /* ViewContainerLocation.Sidebar */: {
                            const part = viewContainerLocation === 0 /* ViewContainerLocation.Sidebar */ ? "workbench.parts.sidebar" /* Parts.SIDEBAR_PART */ : "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */;
                            if (!viewsService.isViewContainerVisible(viewContainer.id) || !layoutService.hasFocus(part)) {
                                await viewsService.openViewContainer(viewContainer.id, true);
                            }
                            else {
                                editorGroupService.activeGroup.focus();
                            }
                            break;
                        }
                        case 1 /* ViewContainerLocation.Panel */:
                            if (!viewsService.isViewContainerVisible(viewContainer.id) || !layoutService.hasFocus("workbench.parts.panel" /* Parts.PANEL_PART */)) {
                                await viewsService.openViewContainer(viewContainer.id, true);
                            }
                            else {
                                viewsService.closeViewContainer(viewContainer.id);
                            }
                            break;
                    }
                }
            }));
            if (mnemonicTitle) {
                const defaultLocation = this.viewDescriptorService.getDefaultViewContainerLocation(viewContainer);
                disposables.add(MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
                    command: {
                        id,
                        title: mnemonicTitle,
                    },
                    group: defaultLocation === 0 /* ViewContainerLocation.Sidebar */ ? '3_sidebar' : defaultLocation === 2 /* ViewContainerLocation.AuxiliaryBar */ ? '4_auxbar' : '5_panel',
                    when: ContextKeyExpr.has(getEnabledViewContainerContextKey(viewContainer.id)),
                    order: order ?? Number.MAX_VALUE
                }));
            }
        }
        return disposables;
    }
    registerOpenViewAction(viewDescriptor) {
        const disposables = new DisposableStore();
        const title = viewDescriptor.openCommandActionDescriptor?.title ?? viewDescriptor.name;
        const commandId = viewDescriptor.openCommandActionDescriptor?.id ?? `${viewDescriptor.id}.open`;
        const that = this;
        disposables.add(registerAction2(class OpenViewAction extends Action2 {
            constructor() {
                super({
                    id: commandId,
                    get title() {
                        const viewContainerLocation = that.viewDescriptorService.getViewLocationById(viewDescriptor.id);
                        const localizedTitle = typeof title === 'string' ? title : title.value;
                        const originalTitle = typeof title === 'string' ? title : title.original;
                        if (viewContainerLocation === 0 /* ViewContainerLocation.Sidebar */) {
                            return { value: localize('show view', "Show {0}", localizedTitle), original: `Show ${originalTitle}` };
                        }
                        else {
                            return { value: localize('toggle view', "Toggle {0}", localizedTitle), original: `Toggle ${originalTitle}` };
                        }
                    },
                    category: Categories.View,
                    precondition: ContextKeyExpr.has(`${viewDescriptor.id}.active`),
                    keybinding: viewDescriptor.openCommandActionDescriptor?.keybindings ? { ...viewDescriptor.openCommandActionDescriptor.keybindings, weight: 200 /* KeybindingWeight.WorkbenchContrib */ } : undefined,
                    f1: viewDescriptor.openCommandActionDescriptor ? true : undefined,
                    metadata: {
                        description: localize('open view', "Opens view {0}", viewDescriptor.name.value),
                        args: [
                            {
                                name: 'options',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        'preserveFocus': {
                                            type: 'boolean',
                                            default: false,
                                            description: localize('preserveFocus', "Whether to preserve the existing focus when opening the view.")
                                        }
                                    },
                                }
                            }
                        ]
                    }
                });
            }
            async run(serviceAccessor, options) {
                const editorGroupService = serviceAccessor.get(IEditorGroupsService);
                const viewDescriptorService = serviceAccessor.get(IViewDescriptorService);
                const layoutService = serviceAccessor.get(IWorkbenchLayoutService);
                const viewsService = serviceAccessor.get(IViewsService);
                const contextKeyService = serviceAccessor.get(IContextKeyService);
                const focusedViewId = FocusedViewContext.getValue(contextKeyService);
                if (focusedViewId === viewDescriptor.id && !options?.preserveFocus) {
                    const viewLocation = viewDescriptorService.getViewLocationById(viewDescriptor.id);
                    if (viewDescriptorService.getViewLocationById(viewDescriptor.id) === 0 /* ViewContainerLocation.Sidebar */) {
                        // focus the editor if the view is focused and in the side bar
                        editorGroupService.activeGroup.focus();
                    }
                    else if (viewLocation !== null) {
                        // otherwise hide the part where the view lives if focused
                        layoutService.setPartHidden(true, getPartByLocation(viewLocation));
                    }
                }
                else {
                    await viewsService.openView(viewDescriptor.id, !options?.preserveFocus);
                }
            }
        }));
        if (viewDescriptor.openCommandActionDescriptor?.mnemonicTitle) {
            const defaultViewContainer = this.viewDescriptorService.getDefaultContainerById(viewDescriptor.id);
            if (defaultViewContainer) {
                const defaultLocation = this.viewDescriptorService.getDefaultViewContainerLocation(defaultViewContainer);
                disposables.add(MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
                    command: {
                        id: commandId,
                        title: viewDescriptor.openCommandActionDescriptor.mnemonicTitle,
                    },
                    group: defaultLocation === 0 /* ViewContainerLocation.Sidebar */ ? '3_sidebar' : defaultLocation === 2 /* ViewContainerLocation.AuxiliaryBar */ ? '4_auxbar' : '5_panel',
                    when: ContextKeyExpr.has(`${viewDescriptor.id}.active`),
                    order: viewDescriptor.openCommandActionDescriptor.order ?? Number.MAX_VALUE
                }));
            }
        }
        return disposables;
    }
    registerFocusViewAction(viewDescriptor, category) {
        return registerAction2(class FocusViewAction extends Action2 {
            constructor() {
                const title = localize2({ key: 'focus view', comment: ['{0} indicates the name of the view to be focused.'] }, "Focus on {0} View", viewDescriptor.name.value);
                super({
                    id: viewDescriptor.focusCommand ? viewDescriptor.focusCommand.id : `${viewDescriptor.id}.focus`,
                    title,
                    category,
                    menu: [{
                            id: MenuId.CommandPalette,
                            when: viewDescriptor.when,
                        }],
                    keybinding: {
                        when: ContextKeyExpr.has(`${viewDescriptor.id}.active`),
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                        primary: viewDescriptor.focusCommand?.keybindings?.primary,
                        secondary: viewDescriptor.focusCommand?.keybindings?.secondary,
                        linux: viewDescriptor.focusCommand?.keybindings?.linux,
                        mac: viewDescriptor.focusCommand?.keybindings?.mac,
                        win: viewDescriptor.focusCommand?.keybindings?.win
                    },
                    metadata: {
                        description: title.value,
                        args: [
                            {
                                name: 'focusOptions',
                                description: 'Focus Options',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        'preserveFocus': {
                                            type: 'boolean',
                                            default: false
                                        }
                                    },
                                }
                            }
                        ]
                    }
                });
            }
            run(accessor, options) {
                accessor.get(IViewsService).openView(viewDescriptor.id, !options?.preserveFocus);
            }
        });
    }
    registerResetViewLocationAction(viewDescriptor) {
        return registerAction2(class ResetViewLocationAction extends Action2 {
            constructor() {
                super({
                    id: `${viewDescriptor.id}.resetViewLocation`,
                    title: localize2('resetViewLocation', "Reset Location"),
                    menu: [{
                            id: MenuId.ViewTitleContext,
                            when: ContextKeyExpr.or(ContextKeyExpr.and(ContextKeyExpr.equals('view', viewDescriptor.id), ContextKeyExpr.equals(`${viewDescriptor.id}.defaultViewLocation`, false))),
                            group: '1_hide',
                            order: 2
                        }],
                });
            }
            run(accessor) {
                const viewDescriptorService = accessor.get(IViewDescriptorService);
                const defaultContainer = viewDescriptorService.getDefaultContainerById(viewDescriptor.id);
                const containerModel = viewDescriptorService.getViewContainerModel(defaultContainer);
                // The default container is hidden so we should try to reset its location first
                if (defaultContainer.hideIfEmpty && containerModel.visibleViewDescriptors.length === 0) {
                    const defaultLocation = viewDescriptorService.getDefaultViewContainerLocation(defaultContainer);
                    viewDescriptorService.moveViewContainerToLocation(defaultContainer, defaultLocation, undefined, this.desc.id);
                }
                viewDescriptorService.moveViewsToContainer([viewDescriptor], defaultContainer, undefined, this.desc.id);
                accessor.get(IViewsService).openView(viewDescriptor.id, true);
            }
        });
    }
    registerPaneComposite(viewContainer, viewContainerLocation) {
        const that = this;
        let PaneContainer = class PaneContainer extends PaneComposite {
            constructor(telemetryService, contextService, storageService, instantiationService, themeService, contextMenuService, extensionService) {
                super(viewContainer.id, telemetryService, storageService, instantiationService, themeService, contextMenuService, extensionService, contextService);
            }
            createViewPaneContainer(element) {
                const viewPaneContainerDisposables = this._register(new DisposableStore());
                // Use composite's instantiation service to get the editor progress service for any editors instantiated within the composite
                const viewPaneContainer = that.createViewPaneContainer(element, viewContainer, viewContainerLocation, viewPaneContainerDisposables, this.instantiationService);
                // Only updateTitleArea for non-filter views: microsoft/vscode-remote-release#3676
                if (!(viewPaneContainer instanceof FilterViewPaneContainer)) {
                    viewPaneContainerDisposables.add(Event.any(viewPaneContainer.onDidAddViews, viewPaneContainer.onDidRemoveViews, viewPaneContainer.onTitleAreaUpdate)(() => {
                        // Update title area since there is no better way to update secondary actions
                        this.updateTitleArea();
                    }));
                }
                return viewPaneContainer;
            }
        };
        PaneContainer = __decorate([
            __param(0, ITelemetryService),
            __param(1, IWorkspaceContextService),
            __param(2, IStorageService),
            __param(3, IInstantiationService),
            __param(4, IThemeService),
            __param(5, IContextMenuService),
            __param(6, IExtensionService)
        ], PaneContainer);
        Registry.as(getPaneCompositeExtension(viewContainerLocation)).registerPaneComposite(PaneCompositeDescriptor.create(PaneContainer, viewContainer.id, typeof viewContainer.title === 'string' ? viewContainer.title : viewContainer.title.value, isString(viewContainer.icon) ? viewContainer.icon : undefined, viewContainer.order, viewContainer.requestedIndex, viewContainer.icon instanceof URI ? viewContainer.icon : undefined));
    }
    deregisterPaneComposite(viewContainer, viewContainerLocation) {
        Registry.as(getPaneCompositeExtension(viewContainerLocation)).deregisterPaneComposite(viewContainer.id);
    }
    createViewPaneContainer(element, viewContainer, viewContainerLocation, disposables, instantiationService) {
        const viewPaneContainer = instantiationService.createInstance(viewContainer.ctorDescriptor.ctor, ...(viewContainer.ctorDescriptor.staticArguments || []));
        this.viewPaneContainers.set(viewPaneContainer.getId(), viewPaneContainer);
        disposables.add(toDisposable(() => this.viewPaneContainers.delete(viewPaneContainer.getId())));
        disposables.add(viewPaneContainer.onDidAddViews(views => this.onViewsAdded(views)));
        disposables.add(viewPaneContainer.onDidChangeViewVisibility(view => this.onViewsVisibilityChanged(view, view.isBodyVisible())));
        disposables.add(viewPaneContainer.onDidRemoveViews(views => this.onViewsRemoved(views)));
        disposables.add(viewPaneContainer.onDidFocusView(view => {
            if (this.focusedViewContextKey.get() !== view.id) {
                this.focusedViewContextKey.set(view.id);
                this._onDidChangeFocusedView.fire();
            }
        }));
        disposables.add(viewPaneContainer.onDidBlurView(view => {
            if (this.focusedViewContextKey.get() === view.id) {
                this.focusedViewContextKey.reset();
                this._onDidChangeFocusedView.fire();
            }
        }));
        return viewPaneContainer;
    }
};
ViewsService = __decorate([
    __param(0, IViewDescriptorService),
    __param(1, IPaneCompositePartService),
    __param(2, IContextKeyService),
    __param(3, IWorkbenchLayoutService),
    __param(4, IEditorService)
], ViewsService);
export { ViewsService };
function getEnabledViewContainerContextKey(viewContainerId) { return `viewContainer.${viewContainerId}.enabled`; }
function getPaneCompositeExtension(viewContainerLocation) {
    switch (viewContainerLocation) {
        case 2 /* ViewContainerLocation.AuxiliaryBar */:
            return PaneCompositeExtensions.Auxiliary;
        case 1 /* ViewContainerLocation.Panel */:
            return PaneCompositeExtensions.Panels;
        case 0 /* ViewContainerLocation.Sidebar */:
        default:
            return PaneCompositeExtensions.Viewlets;
    }
}
export function getPartByLocation(viewContainerLocation) {
    switch (viewContainerLocation) {
        case 2 /* ViewContainerLocation.AuxiliaryBar */:
            return "workbench.parts.auxiliarybar" /* Parts.AUXILIARYBAR_PART */;
        case 1 /* ViewContainerLocation.Panel */:
            return "workbench.parts.panel" /* Parts.PANEL_PART */;
        case 0 /* ViewContainerLocation.Sidebar */:
        default:
            return "workbench.parts.sidebar" /* Parts.SIDEBAR_PART */;
    }
}
registerSingleton(IViewsService, ViewsService, 0 /* InstantiationType.Eager */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld3NTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy92aWV3cy9icm93c2VyL3ZpZXdzU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFlLFlBQVksRUFBRSxlQUFlLEVBQUUsYUFBYSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDN0gsT0FBTyxFQUFFLHNCQUFzQixFQUFvRixNQUFNLDBCQUEwQixDQUFDO0FBQ3BKLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzlGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDakYsT0FBTyxFQUFFLGNBQWMsRUFBZSxrQkFBa0IsRUFBRSxhQUFhLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN0SSxPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM1RCxPQUFPLEVBQUUsTUFBTSxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEgsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUV6RCxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFFL0csT0FBTyxFQUFvQixxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRXJILE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxh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