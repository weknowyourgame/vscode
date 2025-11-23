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
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ISCMViewService, ISCMService } from '../common/scm.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { SCMMenus } from './menus.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { debounce } from '../../../../base/common/decorators.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { compareFileNames, comparePaths } from '../../../../base/common/comparers.js';
import { basename } from '../../../../base/common/resources.js';
import { binarySearch } from '../../../../base/common/arrays.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { autorun, derived, derivedObservableWithCache, derivedOpts, latestChangedValue, observableFromEventOpts, observableValue, runOnChange } from '../../../../base/common/observable.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { EditorResourceAccessor } from '../../../common/editor.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { observableConfigValue } from '../../../../platform/observable/common/platformObservableUtils.js';
import { getSCMRepositoryIcon } from './util.js';
function getProviderStorageKey(provider) {
    return `${provider.providerId}:${provider.label}${provider.rootUri ? `:${provider.rootUri.toString()}` : ''}`;
}
function getRepositoryName(workspaceContextService, repository) {
    if (!repository.provider.rootUri) {
        return repository.provider.label;
    }
    const folder = workspaceContextService.getWorkspaceFolder(repository.provider.rootUri);
    return folder?.uri.toString() === repository.provider.rootUri.toString() ? folder.name : basename(repository.provider.rootUri);
}
export const RepositoryContextKeys = {
    RepositorySortKey: new RawContextKey('scmRepositorySortKey', "discoveryTime" /* ISCMRepositorySortKey.DiscoveryTime */),
    RepositorySelectionMode: new RawContextKey('scmRepositorySelectionMode', "single" /* ISCMRepositorySelectionMode.Single */),
};
let RepositoryPicker = class RepositoryPicker {
    constructor(_placeHolder, _autoQuickItemDescription, _quickInputService, _scmViewService) {
        this._placeHolder = _placeHolder;
        this._autoQuickItemDescription = _autoQuickItemDescription;
        this._quickInputService = _quickInputService;
        this._scmViewService = _scmViewService;
        this._autoQuickPickItem = {
            label: localize('auto', "Auto"),
            description: this._autoQuickItemDescription,
            repository: 'auto'
        };
    }
    async pickRepository() {
        const picks = [
            this._autoQuickPickItem,
            { type: 'separator' }
        ];
        const activeRepository = this._scmViewService.activeRepository.get();
        const repository = activeRepository?.repository;
        const pinned = activeRepository?.pinned === true;
        picks.push(...this._scmViewService.repositories.map(r => {
            const icon = getSCMRepositoryIcon(activeRepository, r);
            return {
                label: r.provider.name,
                description: r.provider.rootUri?.fsPath,
                iconClass: ThemeIcon.asClassName(icon),
                repository: r
            };
        }));
        const activeItem = pinned
            ? picks.find(p => p.type !== 'separator' && p.repository === repository)
            : this._autoQuickPickItem;
        return this._quickInputService.pick(picks, { placeHolder: this._placeHolder, activeItem });
    }
};
RepositoryPicker = __decorate([
    __param(2, IQuickInputService),
    __param(3, ISCMViewService)
], RepositoryPicker);
export { RepositoryPicker };
let SCMViewService = class SCMViewService {
    get repositories() {
        return this._repositories.map(r => r.repository);
    }
    get visibleRepositories() {
        // In order to match the legacy behaviour, when the repositories are sorted by discovery time,
        // the visible repositories are sorted by the selection index instead of the discovery time.
        if (this._repositoriesSortKey === "discoveryTime" /* ISCMRepositorySortKey.DiscoveryTime */) {
            return this._repositories.filter(r => r.selectionIndex !== -1)
                .sort((r1, r2) => r1.selectionIndex - r2.selectionIndex)
                .map(r => r.repository);
        }
        return this._repositories
            .filter(r => r.selectionIndex !== -1)
            .map(r => r.repository);
    }
    set visibleRepositories(visibleRepositories) {
        const set = new Set(visibleRepositories);
        const added = new Set();
        const removed = new Set();
        for (const repositoryView of this._repositories) {
            // Selected -> !Selected
            if (!set.has(repositoryView.repository) && repositoryView.selectionIndex !== -1) {
                repositoryView.selectionIndex = -1;
                removed.add(repositoryView.repository);
            }
            // Selected | !Selected -> Selected
            if (set.has(repositoryView.repository)) {
                if (repositoryView.selectionIndex === -1) {
                    added.add(repositoryView.repository);
                }
                repositoryView.selectionIndex = visibleRepositories.indexOf(repositoryView.repository);
            }
        }
        if (added.size === 0 && removed.size === 0) {
            return;
        }
        this._onDidSetVisibleRepositories.fire({ added, removed });
        // Update focus if the focused repository is not visible anymore
        if (this._repositories.find(r => r.focused && r.selectionIndex === -1)) {
            this.focus(this._repositories.find(r => r.selectionIndex !== -1)?.repository);
        }
    }
    get focusedRepository() {
        return this._repositories.find(r => r.focused)?.repository;
    }
    constructor(scmService, contextKeyService, editorService, extensionService, instantiationService, configurationService, storageService, workspaceContextService) {
        this.scmService = scmService;
        this.editorService = editorService;
        this.configurationService = configurationService;
        this.storageService = storageService;
        this.workspaceContextService = workspaceContextService;
        this.didFinishLoading = false;
        this.didSelectRepository = false;
        this.disposables = new DisposableStore();
        this._repositories = [];
        this._onDidChangeRepositories = new Emitter();
        this.onDidChangeRepositories = this._onDidChangeRepositories.event;
        this._onDidSetVisibleRepositories = new Emitter();
        this.onDidChangeVisibleRepositories = Event.any(this._onDidSetVisibleRepositories.event, Event.debounce(this._onDidChangeRepositories.event, (last, e) => {
            if (!last) {
                return e;
            }
            const added = new Set(last.added);
            const removed = new Set(last.removed);
            for (const repository of e.added) {
                if (!removed.delete(repository)) {
                    added.add(repository);
                }
            }
            for (const repository of e.removed) {
                if (!added.delete(repository)) {
                    removed.add(repository);
                }
            }
            return { added, removed };
        }, 0, undefined, undefined, undefined, this.disposables));
        this._onDidFocusRepository = new Emitter();
        this.onDidFocusRepository = this._onDidFocusRepository.event;
        this.menus = instantiationService.createInstance(SCMMenus);
        const explorerEnabledConfig = observableConfigValue('scm.repositories.explorer', false, this.configurationService);
        this.graphShowIncomingChangesConfig = observableConfigValue('scm.graph.showIncomingChanges', true, this.configurationService);
        this.graphShowOutgoingChangesConfig = observableConfigValue('scm.graph.showOutgoingChanges', true, this.configurationService);
        this.selectionModeConfig = observableConfigValue('scm.repositories.selectionMode', "multiple" /* ISCMRepositorySelectionMode.Multiple */, this.configurationService);
        this.explorerEnabledConfig = derived(reader => {
            return explorerEnabledConfig.read(reader) === true && this.selectionModeConfig.read(reader) === "single" /* ISCMRepositorySelectionMode.Single */;
        });
        try {
            this.previousState = JSON.parse(storageService.get('scm:view:visibleRepositories', 1 /* StorageScope.WORKSPACE */, ''));
            // If previously there were multiple visible repositories but the
            // view mode is `single`, only restore the first visible repository.
            if (this.previousState && this.previousState.visible.length > 1 && this.selectionModeConfig.get() === "single" /* ISCMRepositorySelectionMode.Single */) {
                this.previousState = {
                    ...this.previousState,
                    visible: [this.previousState.visible[0]]
                };
            }
        }
        catch {
            // noop
        }
        this._focusedRepositoryObs = observableFromEventOpts({
            owner: this,
            equalsFn: () => false
        }, this.onDidFocusRepository, () => this.focusedRepository);
        this._activeEditorObs = observableFromEventOpts({
            owner: this,
            equalsFn: () => false
        }, this.editorService.onDidActiveEditorChange, () => this.editorService.activeEditor);
        this._activeEditorRepositoryObs = derivedObservableWithCache(this, (reader, lastValue) => {
            const activeEditor = this._activeEditorObs.read(reader);
            const activeResource = EditorResourceAccessor.getOriginalUri(activeEditor);
            if (!activeResource) {
                return lastValue;
            }
            const repository = this.scmService.getRepository(activeResource);
            if (!repository) {
                return lastValue;
            }
            return Object.create(repository);
        });
        this._activeRepositoryPinnedObs = observableValue(this, undefined);
        this._activeRepositoryObs = latestChangedValue(this, [this._activeEditorRepositoryObs, this._focusedRepositoryObs]);
        this.activeRepository = derivedOpts({
            owner: this,
            equalsFn: (r1, r2) => r1?.repository.id === r2?.repository.id && r1?.pinned === r2?.pinned
        }, reader => {
            const activeRepository = this._activeRepositoryObs.read(reader);
            const activeRepositoryPinned = this._activeRepositoryPinnedObs.read(reader);
            const repository = activeRepositoryPinned ?? activeRepository;
            const pinned = !!activeRepositoryPinned;
            return repository ? { repository, pinned } : undefined;
        });
        this.disposables.add(runOnChange(this.selectionModeConfig, selectionMode => {
            if (selectionMode === "single" /* ISCMRepositorySelectionMode.Single */ && this.visibleRepositories.length > 1) {
                const repository = this.visibleRepositories[0];
                this.visibleRepositories = [repository];
            }
            else if (selectionMode === "multiple" /* ISCMRepositorySelectionMode.Multiple */ && this.repositories.length > 1) {
                this.visibleRepositories = this.repositories;
            }
        }));
        this._repositoriesSortKey = this.previousState?.sortKey ?? this.getViewSortOrder();
        this._sortKeyContextKey = RepositoryContextKeys.RepositorySortKey.bindTo(contextKeyService);
        this._sortKeyContextKey.set(this._repositoriesSortKey);
        this._selectionModelContextKey = RepositoryContextKeys.RepositorySelectionMode.bindTo(contextKeyService);
        this.disposables.add(autorun(reader => {
            const selectionMode = this.selectionModeConfig.read(reader);
            this._selectionModelContextKey.set(selectionMode);
        }));
        scmService.onDidAddRepository(this.onDidAddRepository, this, this.disposables);
        scmService.onDidRemoveRepository(this.onDidRemoveRepository, this, this.disposables);
        for (const repository of scmService.repositories) {
            this.onDidAddRepository(repository);
        }
        storageService.onWillSaveState(this.onWillSaveState, this, this.disposables);
        // Maintain repository selection when the extension host restarts.
        // Extension host is restarted after installing an extension update
        // or during a profile switch.
        extensionService.onWillStop(() => {
            this.onWillSaveState();
            this.didFinishLoading = false;
        }, this, this.disposables);
    }
    onDidAddRepository(repository) {
        if (!this.didFinishLoading) {
            this.eventuallyFinishLoading();
        }
        const repositoryView = {
            repository, discoveryTime: Date.now(), focused: false, selectionIndex: -1
        };
        let removed = Iterable.empty();
        if (this.previousState && !this.didFinishLoading) {
            const index = this.previousState.all.indexOf(getProviderStorageKey(repository.provider));
            if (index === -1) {
                // This repository is not part of the previous state which means that it
                // was either manually closed in the previous session, or the repository
                // was added after the previous session. In this case, we should select
                // all of the repositories.
                const added = [];
                this.insertRepositoryView(this._repositories, repositoryView);
                if (this.selectionModeConfig.get() === "multiple" /* ISCMRepositorySelectionMode.Multiple */ || !this._repositories.find(r => r.selectionIndex !== -1)) {
                    // Multiple selection mode or single selection mode (select first repository)
                    this._repositories.forEach((repositoryView, index) => {
                        if (repositoryView.selectionIndex === -1) {
                            added.push(repositoryView.repository);
                        }
                        repositoryView.selectionIndex = index;
                    });
                    this._onDidChangeRepositories.fire({ added, removed: Iterable.empty() });
                }
                this.didSelectRepository = false;
                return;
            }
            if (this.previousState.visible.indexOf(index) === -1) {
                // Explicit selection started
                if (this.didSelectRepository) {
                    this.insertRepositoryView(this._repositories, repositoryView);
                    this._onDidChangeRepositories.fire({ added: Iterable.empty(), removed: Iterable.empty() });
                    return;
                }
            }
            else {
                // First visible repository
                if (!this.didSelectRepository) {
                    removed = [...this.visibleRepositories];
                    this._repositories.forEach(r => {
                        r.focused = false;
                        r.selectionIndex = -1;
                    });
                    this.didSelectRepository = true;
                }
            }
        }
        if (this.selectionModeConfig.get() === "multiple" /* ISCMRepositorySelectionMode.Multiple */ || !this._repositories.find(r => r.selectionIndex !== -1)) {
            // Multiple selection mode or single selection mode (select first repository)
            const maxSelectionIndex = this.getMaxSelectionIndex();
            this.insertRepositoryView(this._repositories, { ...repositoryView, selectionIndex: maxSelectionIndex + 1 });
            this._onDidChangeRepositories.fire({ added: [repositoryView.repository], removed });
        }
        else {
            // Single selection mode (add subsequent repository)
            this.insertRepositoryView(this._repositories, repositoryView);
            this._onDidChangeRepositories.fire({ added: Iterable.empty(), removed });
        }
        // Focus repository if nothing is focused
        if (!this._repositories.find(r => r.focused)) {
            this.focus(repository);
        }
    }
    onDidRemoveRepository(repository) {
        if (!this.didFinishLoading) {
            this.eventuallyFinishLoading();
        }
        const repositoriesIndex = this._repositories.findIndex(r => r.repository === repository);
        if (repositoriesIndex === -1) {
            return;
        }
        let added = Iterable.empty();
        const removed = this._repositories.splice(repositoriesIndex, 1);
        if (this._repositories.length > 0 && this.visibleRepositories.length === 0) {
            this._repositories[0].selectionIndex = 0;
            added = [this._repositories[0].repository];
        }
        this._onDidChangeRepositories.fire({ added, removed: removed.map(r => r.repository) });
        // Check if the focused repository was removed
        if (removed.length === 1 && removed[0].focused && this.visibleRepositories.length > 0) {
            this.focus(this.visibleRepositories[0]);
        }
        // Check if the last repository was removed
        if (removed.length === 1 && this._repositories.length === 0) {
            this._onDidFocusRepository.fire(undefined);
        }
        // Check if the pinned repository was removed
        if (removed.length === 1 && removed[0].repository === this._activeRepositoryPinnedObs.get()) {
            this._activeRepositoryPinnedObs.set(undefined, undefined);
        }
    }
    isVisible(repository) {
        return this._repositories.find(r => r.repository === repository)?.selectionIndex !== -1;
    }
    toggleVisibility(repository, visible) {
        if (typeof visible === 'undefined') {
            visible = !this.isVisible(repository);
        }
        else if (this.isVisible(repository) === visible) {
            return;
        }
        if (visible) {
            if (this.selectionModeConfig.get() === "single" /* ISCMRepositorySelectionMode.Single */) {
                this.visibleRepositories = [repository];
            }
            else if (this.selectionModeConfig.get() === "multiple" /* ISCMRepositorySelectionMode.Multiple */) {
                this.visibleRepositories = [...this.visibleRepositories, repository];
            }
        }
        else {
            const index = this.visibleRepositories.indexOf(repository);
            if (index > -1) {
                this.visibleRepositories = [
                    ...this.visibleRepositories.slice(0, index),
                    ...this.visibleRepositories.slice(index + 1)
                ];
            }
        }
    }
    toggleSortKey(sortKey) {
        this._repositoriesSortKey = sortKey;
        this._sortKeyContextKey.set(this._repositoriesSortKey);
        this._repositories.sort(this.compareRepositories.bind(this));
        this._onDidChangeRepositories.fire({ added: Iterable.empty(), removed: Iterable.empty() });
    }
    toggleSelectionMode(selectionMode) {
        this.configurationService.updateValue('scm.repositories.selectionMode', selectionMode);
    }
    focus(repository) {
        if (repository && !this.isVisible(repository)) {
            return;
        }
        this._repositories.forEach(r => r.focused = r.repository === repository);
        if (this._repositories.find(r => r.focused)) {
            this._onDidFocusRepository.fire(repository);
        }
    }
    pinActiveRepository(repository) {
        this._activeRepositoryPinnedObs.set(repository, undefined);
    }
    compareRepositories(op1, op2) {
        // Sort by discovery time
        if (this._repositoriesSortKey === "discoveryTime" /* ISCMRepositorySortKey.DiscoveryTime */) {
            return op1.discoveryTime - op2.discoveryTime;
        }
        // Sort by path
        if (this._repositoriesSortKey === 'path' && op1.repository.provider.rootUri && op2.repository.provider.rootUri) {
            return comparePaths(op1.repository.provider.rootUri.fsPath, op2.repository.provider.rootUri.fsPath);
        }
        // Sort by name, path
        const name1 = getRepositoryName(this.workspaceContextService, op1.repository);
        const name2 = getRepositoryName(this.workspaceContextService, op2.repository);
        const nameComparison = compareFileNames(name1, name2);
        if (nameComparison === 0 && op1.repository.provider.rootUri && op2.repository.provider.rootUri) {
            return comparePaths(op1.repository.provider.rootUri.fsPath, op2.repository.provider.rootUri.fsPath);
        }
        return nameComparison;
    }
    getMaxSelectionIndex() {
        return this._repositories.length === 0 ? -1 :
            Math.max(...this._repositories.map(r => r.selectionIndex));
    }
    getViewSortOrder() {
        const sortOder = this.configurationService.getValue('scm.repositories.sortOrder');
        switch (sortOder) {
            case 'discovery time':
                return "discoveryTime" /* ISCMRepositorySortKey.DiscoveryTime */;
            case 'name':
                return "name" /* ISCMRepositorySortKey.Name */;
            case 'path':
                return "path" /* ISCMRepositorySortKey.Path */;
            default:
                return "discoveryTime" /* ISCMRepositorySortKey.DiscoveryTime */;
        }
    }
    insertRepositoryView(repositories, repositoryView) {
        const index = binarySearch(repositories, repositoryView, this.compareRepositories.bind(this));
        repositories.splice(index < 0 ? ~index : index, 0, repositoryView);
    }
    onWillSaveState() {
        if (!this.didFinishLoading) { // don't remember state, if the workbench didn't really finish loading
            return;
        }
        const all = this.repositories.map(r => getProviderStorageKey(r.provider));
        const visible = this.visibleRepositories.map(r => all.indexOf(getProviderStorageKey(r.provider)));
        this.previousState = { all, visible, sortKey: this._repositoriesSortKey };
        this.storageService.store('scm:view:visibleRepositories', JSON.stringify(this.previousState), 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
    }
    eventuallyFinishLoading() {
        this.finishLoading();
    }
    finishLoading() {
        if (this.didFinishLoading) {
            return;
        }
        this.didFinishLoading = true;
    }
    dispose() {
        this.disposables.dispose();
        this._onDidChangeRepositories.dispose();
        this._onDidSetVisibleRepositories.dispose();
    }
};
__decorate([
    debounce(5000)
], SCMViewService.prototype, "eventuallyFinishLoading", null);
SCMViewService = __decorate([
    __param(0, ISCMService),
    __param(1, IContextKeyService),
    __param(2, IEditorService),
    __param(3, IExtensionService),
    __param(4, IInstantiationService),
    __param(5, IConfigurationService),
    __param(6, IStorageService),
    __param(7, IWorkspaceContextService)
], SCMViewService);
export { SCMViewService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NtVmlld1NlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvc2NtL2Jyb3dzZXIvc2NtVmlld1NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGVBQWUsRUFBa0IsV0FBVyxFQUFxSCxNQUFNLGtCQUFrQixDQUFDO0FBQ25NLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ3RDLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sZ0RBQWdELENBQUM7QUFDOUcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN0RixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBZSxrQkFBa0IsRUFBRSxhQUFhLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN0SCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUN0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