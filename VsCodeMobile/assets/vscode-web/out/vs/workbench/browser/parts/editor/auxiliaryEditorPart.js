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
var AuxiliaryEditorPart_1, AuxiliaryEditorPartImpl_1;
import { onDidChangeFullscreen } from '../../../../base/browser/browser.js';
import { $, getActiveWindow, hide, show } from '../../../../base/browser/dom.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { DisposableStore, markAsSingleton, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { isNative } from '../../../../base/common/platform.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { hasCustomTitlebar } from '../../../../platform/window/common/window.js';
import { EditorPart } from './editorPart.js';
import { WindowTitle } from '../titlebar/windowTitle.js';
import { IAuxiliaryWindowService } from '../../../services/auxiliaryWindow/browser/auxiliaryWindowService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IWorkbenchLayoutService, shouldShowCustomTitleBar } from '../../../services/layout/browser/layoutService.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { IStatusbarService } from '../../../services/statusbar/browser/statusbar.js';
import { ITitleService } from '../../../services/title/browser/titleService.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { localize, localize2 } from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { IsAuxiliaryWindowContext, IsAuxiliaryWindowFocusedContext, IsCompactTitleBarContext } from '../../../common/contextkeys.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
const compactWindowEmitter = markAsSingleton(new Emitter());
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.toggleCompactAuxiliaryWindow',
            title: localize2('toggleCompactAuxiliaryWindow', "Toggle Window Compact Mode"),
            category: Categories.View,
            f1: true,
            precondition: IsAuxiliaryWindowFocusedContext
        });
    }
    async run() {
        compactWindowEmitter.fire({ windowId: getActiveWindow().vscodeWindowId, compact: 'toggle' });
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.enableCompactAuxiliaryWindow',
            title: localize('enableCompactAuxiliaryWindow', "Turn On Compact Mode"),
            icon: Codicon.screenFull,
            menu: {
                id: MenuId.LayoutControlMenu,
                when: ContextKeyExpr.and(IsCompactTitleBarContext.toNegated(), IsAuxiliaryWindowContext),
                order: 0
            }
        });
    }
    async run() {
        compactWindowEmitter.fire({ windowId: getActiveWindow().vscodeWindowId, compact: true });
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.disableCompactAuxiliaryWindow',
            title: localize('disableCompactAuxiliaryWindow', "Turn Off Compact Mode"),
            icon: Codicon.screenNormal,
            menu: {
                id: MenuId.LayoutControlMenu,
                when: ContextKeyExpr.and(IsCompactTitleBarContext, IsAuxiliaryWindowContext),
                order: 0
            }
        });
    }
    async run() {
        compactWindowEmitter.fire({ windowId: getActiveWindow().vscodeWindowId, compact: false });
    }
});
let AuxiliaryEditorPart = class AuxiliaryEditorPart {
    static { AuxiliaryEditorPart_1 = this; }
    static { this.STATUS_BAR_VISIBILITY = 'workbench.statusBar.visible'; }
    constructor(editorPartsView, instantiationService, auxiliaryWindowService, lifecycleService, configurationService, statusbarService, titleService, editorService, layoutService) {
        this.editorPartsView = editorPartsView;
        this.instantiationService = instantiationService;
        this.auxiliaryWindowService = auxiliaryWindowService;
        this.lifecycleService = lifecycleService;
        this.configurationService = configurationService;
        this.statusbarService = statusbarService;
        this.titleService = titleService;
        this.editorService = editorService;
        this.layoutService = layoutService;
    }
    async create(label, options) {
        const that = this;
        const disposables = new DisposableStore();
        let compact = Boolean(options?.compact);
        function computeEditorPartHeightOffset() {
            let editorPartHeightOffset = 0;
            if (statusbarVisible) {
                editorPartHeightOffset += statusbarPart.height;
            }
            if (titlebarPart && titlebarVisible) {
                editorPartHeightOffset += titlebarPart.height;
            }
            return editorPartHeightOffset;
        }
        function updateStatusbarVisibility(fromEvent) {
            if (statusbarVisible) {
                show(statusbarPart.container);
            }
            else {
                hide(statusbarPart.container);
            }
            if (fromEvent) {
                auxiliaryWindow.layout();
            }
        }
        function updateTitlebarVisibility(fromEvent) {
            if (!titlebarPart) {
                return;
            }
            if (titlebarVisible) {
                show(titlebarPart.container);
            }
            else {
                hide(titlebarPart.container);
            }
            if (fromEvent) {
                auxiliaryWindow.layout();
            }
        }
        function updateCompact(newCompact) {
            if (newCompact === compact) {
                return;
            }
            compact = newCompact;
            auxiliaryWindow.updateOptions({ compact });
            titlebarPart?.updateOptions({ compact });
            editorPart.updateOptions({ compact });
            const oldStatusbarVisible = statusbarVisible;
            statusbarVisible = !compact && that.configurationService.getValue(AuxiliaryEditorPart_1.STATUS_BAR_VISIBILITY) !== false;
            if (oldStatusbarVisible !== statusbarVisible) {
                updateStatusbarVisibility(true);
            }
        }
        // Auxiliary Window
        const auxiliaryWindow = disposables.add(await this.auxiliaryWindowService.open(options));
        // Editor Part
        const editorPartContainer = $('.part.editor', { role: 'main' });
        editorPartContainer.style.position = 'relative';
        auxiliaryWindow.container.appendChild(editorPartContainer);
        const editorPart = disposables.add(this.instantiationService.createInstance(AuxiliaryEditorPartImpl, auxiliaryWindow.window.vscodeWindowId, this.editorPartsView, options?.state, label));
        editorPart.updateOptions({ compact });
        disposables.add(this.editorPartsView.registerPart(editorPart));
        editorPart.create(editorPartContainer);
        const scopedEditorPartInstantiationService = disposables.add(editorPart.scopedInstantiationService.createChild(new ServiceCollection([IEditorService, this.editorService.createScoped(editorPart, disposables)])));
        // Titlebar
        let titlebarPart = undefined;
        let titlebarVisible = false;
        const useCustomTitle = isNative && hasCustomTitlebar(this.configurationService); // custom title in aux windows only enabled in native
        if (useCustomTitle) {
            titlebarPart = disposables.add(this.titleService.createAuxiliaryTitlebarPart(auxiliaryWindow.container, editorPart, scopedEditorPartInstantiationService));
            titlebarPart.updateOptions({ compact });
            titlebarVisible = shouldShowCustomTitleBar(this.configurationService, auxiliaryWindow.window, undefined);
            const handleTitleBarVisibilityEvent = () => {
                const oldTitlebarPartVisible = titlebarVisible;
                titlebarVisible = shouldShowCustomTitleBar(this.configurationService, auxiliaryWindow.window, undefined);
                if (oldTitlebarPartVisible !== titlebarVisible) {
                    updateTitlebarVisibility(true);
                }
            };
            disposables.add(titlebarPart.onDidChange(() => auxiliaryWindow.layout()));
            disposables.add(this.layoutService.onDidChangePartVisibility(() => handleTitleBarVisibilityEvent()));
            disposables.add(onDidChangeFullscreen(windowId => {
                if (windowId !== auxiliaryWindow.window.vscodeWindowId) {
                    return; // ignore all but our window
                }
                handleTitleBarVisibilityEvent();
            }));
            updateTitlebarVisibility(false);
        }
        else {
            disposables.add(scopedEditorPartInstantiationService.createInstance(WindowTitle, auxiliaryWindow.window));
        }
        // Statusbar
        const statusbarPart = disposables.add(this.statusbarService.createAuxiliaryStatusbarPart(auxiliaryWindow.container, scopedEditorPartInstantiationService));
        let statusbarVisible = !compact && this.configurationService.getValue(AuxiliaryEditorPart_1.STATUS_BAR_VISIBILITY) !== false;
        disposables.add(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(AuxiliaryEditorPart_1.STATUS_BAR_VISIBILITY)) {
                statusbarVisible = !compact && this.configurationService.getValue(AuxiliaryEditorPart_1.STATUS_BAR_VISIBILITY) !== false;
                updateStatusbarVisibility(true);
            }
        }));
        updateStatusbarVisibility(false);
        // Lifecycle
        const editorCloseListener = disposables.add(Event.once(editorPart.onWillClose)(() => auxiliaryWindow.window.close()));
        disposables.add(Event.once(auxiliaryWindow.onUnload)(() => {
            if (disposables.isDisposed) {
                return; // the close happened as part of an earlier dispose call
            }
            editorCloseListener.dispose();
            editorPart.close();
            disposables.dispose();
        }));
        disposables.add(Event.once(this.lifecycleService.onDidShutdown)(() => disposables.dispose()));
        disposables.add(auxiliaryWindow.onBeforeUnload(event => {
            for (const group of editorPart.groups) {
                for (const editor of group.editors) {
                    // Closing an auxiliary window with opened editors
                    // will move the editors to the main window. As such,
                    // we need to validate that we can move and otherwise
                    // prevent the window from closing.
                    const canMoveVeto = editor.canMove(group.id, this.editorPartsView.mainPart.activeGroup.id);
                    if (typeof canMoveVeto === 'string') {
                        group.openEditor(editor);
                        event.veto(canMoveVeto);
                        break;
                    }
                }
            }
        }));
        // Layout: specifically `onWillLayout` to have a chance
        // to build the aux editor part before other components
        // have a chance to react.
        disposables.add(auxiliaryWindow.onWillLayout(dimension => {
            const titlebarPartHeight = titlebarPart?.height ?? 0;
            titlebarPart?.layout(dimension.width, titlebarPartHeight, 0, 0);
            const editorPartHeight = dimension.height - computeEditorPartHeightOffset();
            editorPart.layout(dimension.width, editorPartHeight, titlebarPartHeight, 0);
            statusbarPart.layout(dimension.width, statusbarPart.height, dimension.height - statusbarPart.height, 0);
        }));
        auxiliaryWindow.layout();
        // Compact mode
        disposables.add(compactWindowEmitter.event(e => {
            if (e.windowId === auxiliaryWindow.window.vscodeWindowId) {
                let newCompact;
                if (typeof e.compact === 'boolean') {
                    newCompact = e.compact;
                }
                else {
                    newCompact = !compact;
                }
                updateCompact(newCompact);
            }
        }));
        disposables.add(editorPart.onDidAddGroup(() => {
            updateCompact(false); // leave compact mode when a group is added
        }));
        disposables.add(editorPart.activeGroup.onDidActiveEditorChange(() => {
            if (editorPart.activeGroup.count > 1) {
                updateCompact(false); // leave compact mode when more than 1 editor is active
            }
        }));
        // Have a scoped instantiation service that is scoped to the auxiliary window
        const scopedInstantiationService = disposables.add(scopedEditorPartInstantiationService.createChild(new ServiceCollection([IStatusbarService, this.statusbarService.createScoped(statusbarPart, disposables)])));
        return {
            part: editorPart,
            instantiationService: scopedInstantiationService,
            disposables
        };
    }
};
AuxiliaryEditorPart = AuxiliaryEditorPart_1 = __decorate([
    __param(1, IInstantiationService),
    __param(2, IAuxiliaryWindowService),
    __param(3, ILifecycleService),
    __param(4, IConfigurationService),
    __param(5, IStatusbarService),
    __param(6, ITitleService),
    __param(7, IEditorService),
    __param(8, IWorkbenchLayoutService)
], AuxiliaryEditorPart);
export { AuxiliaryEditorPart };
let AuxiliaryEditorPartImpl = class AuxiliaryEditorPartImpl extends EditorPart {
    static { AuxiliaryEditorPartImpl_1 = this; }
    static { this.COUNTER = 1; }
    constructor(windowId, editorPartsView, state, groupsLabel, instantiationService, themeService, configurationService, storageService, layoutService, hostService, contextKeyService) {
        const id = AuxiliaryEditorPartImpl_1.COUNTER++;
        super(editorPartsView, `workbench.parts.auxiliaryEditor.${id}`, groupsLabel, windowId, instantiationService, themeService, configurationService, storageService, layoutService, hostService, contextKeyService);
        this.state = state;
        this._onWillClose = this._register(new Emitter());
        this.onWillClose = this._onWillClose.event;
        this.optionsDisposable = this._register(new MutableDisposable());
        this.isCompact = false;
    }
    updateOptions(options) {
        this.isCompact = options.compact;
        if (options.compact) {
            if (!this.optionsDisposable.value) {
                this.optionsDisposable.value = this.enforcePartOptions({
                    showTabs: 'none',
                    closeEmptyGroups: true
                });
            }
        }
        else {
            this.optionsDisposable.clear();
        }
    }
    addGroup(location, direction, groupToCopy) {
        if (this.isCompact) {
            // When in compact mode, we prefer to open groups in the main part
            // as compact mode is typically meant for showing just 1 editor.
            location = this.editorPartsView.mainPart.activeGroup;
        }
        return super.addGroup(location, direction, groupToCopy);
    }
    removeGroup(group, preserveFocus) {
        // Close aux window when last group removed
        const groupView = this.assertGroupView(group);
        if (this.count === 1 && this.activeGroup === groupView) {
            this.doRemoveLastGroup(preserveFocus);
        }
        // Otherwise delegate to parent implementation
        else {
            super.removeGroup(group, preserveFocus);
        }
    }
    doRemoveLastGroup(preserveFocus) {
        const restoreFocus = !preserveFocus && this.shouldRestoreFocus(this.container);
        // Activate next group
        const mostRecentlyActiveGroups = this.editorPartsView.getGroups(1 /* GroupsOrder.MOST_RECENTLY_ACTIVE */);
        const nextActiveGroup = mostRecentlyActiveGroups[1]; // [0] will be the current group we are about to dispose
        if (nextActiveGroup) {
            nextActiveGroup.groupsView.activateGroup(nextActiveGroup);
            if (restoreFocus) {
                nextActiveGroup.focus();
            }
        }
        this.doClose(false /* do not merge any confirming editors to main part */);
    }
    loadState() {
        return this.state;
    }
    saveState() {
        return; // disabled, auxiliary editor part state is tracked outside
    }
    close() {
        return this.doClose(true /* merge all confirming editors to main part */);
    }
    doClose(mergeConfirmingEditorsToMainPart) {
        let result = true;
        if (mergeConfirmingEditorsToMainPart) {
            // First close all editors that are non-confirming
            for (const group of this.groups) {
                group.closeAllEditors({ excludeConfirming: true });
            }
            // Then merge remaining to main part
            result = this.mergeGroupsToMainPart();
        }
        this._onWillClose.fire();
        return result;
    }
    mergeGroupsToMainPart() {
        if (!this.groups.some(group => group.count > 0)) {
            return true; // skip if we have no editors opened
        }
        // Find the most recent group that is not locked
        let targetGroup = undefined;
        for (const group of this.editorPartsView.mainPart.getGroups(1 /* GroupsOrder.MOST_RECENTLY_ACTIVE */)) {
            if (!group.isLocked) {
                targetGroup = group;
                break;
            }
        }
        if (!targetGroup) {
            targetGroup = this.editorPartsView.mainPart.addGroup(this.editorPartsView.mainPart.activeGroup, this.partOptions.openSideBySideDirection === 'right' ? 3 /* GroupDirection.RIGHT */ : 1 /* GroupDirection.DOWN */);
        }
        const result = this.mergeAllGroups(targetGroup, {
            // Try to reduce the impact of closing the auxiliary window
            // as much as possible by not changing existing editors
            // in the main window.
            preserveExistingIndex: true
        });
        targetGroup.focus();
        return result;
    }
};
AuxiliaryEditorPartImpl = AuxiliaryEditorPartImpl_1 = __decorate([
    __param(4, IInstantiationService),
    __param(5, IThemeService),
    __param(6, IConfigurationService),
    __param(7, IStorageService),
    __param(8, IWorkbenchLayoutService),
    __param(9, IHostService),
    __param(10, IContextKeyService)
], AuxiliaryEditorPartImpl);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV4aWxpYXJ5RWRpdG9yUGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvYXV4aWxpYXJ5RWRpdG9yUGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDNUUsT0FBTyxFQUFFLENBQUMsRUFBRSxlQUFlLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMzRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDL0QsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzFHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBQ25HLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNqRixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFFakYsT0FBTyxFQUFFLFVBQVUsRUFBc0IsTUFBTSxpQkFBaUIsQ0FBQztBQUVqRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFD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