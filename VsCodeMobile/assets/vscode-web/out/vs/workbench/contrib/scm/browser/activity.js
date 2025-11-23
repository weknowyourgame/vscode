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
import { localize } from '../../../../nls.js';
import { basename } from '../../../../base/common/resources.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { VIEW_PANE_ID, ISCMService, ISCMViewService } from '../common/scm.js';
import { IActivityService, NumberBadge } from '../../../services/activity/common/activity.js';
import { IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IStatusbarService } from '../../../services/statusbar/browser/statusbar.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { EditorResourceAccessor } from '../../../common/editor.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { ITitleService } from '../../../services/title/browser/titleService.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { getRepositoryResourceCount, getSCMRepositoryIcon, getStatusBarCommandGenericName } from './util.js';
import { autorun, derived, observableFromEvent } from '../../../../base/common/observable.js';
import { observableConfigValue } from '../../../../platform/observable/common/platformObservableUtils.js';
const ActiveRepositoryContextKeys = {
    ActiveRepositoryName: new RawContextKey('scmActiveRepositoryName', ''),
    ActiveRepositoryBranchName: new RawContextKey('scmActiveRepositoryBranchName', ''),
};
let SCMActiveRepositoryController = class SCMActiveRepositoryController extends Disposable {
    constructor(activityService, configurationService, contextKeyService, scmService, scmViewService, statusbarService, titleService) {
        super();
        this.activityService = activityService;
        this.configurationService = configurationService;
        this.contextKeyService = contextKeyService;
        this.scmService = scmService;
        this.scmViewService = scmViewService;
        this.statusbarService = statusbarService;
        this.titleService = titleService;
        this._activeRepositoryNameContextKey = ActiveRepositoryContextKeys.ActiveRepositoryName.bindTo(this.contextKeyService);
        this._activeRepositoryBranchNameContextKey = ActiveRepositoryContextKeys.ActiveRepositoryBranchName.bindTo(this.contextKeyService);
        this.titleService.registerVariables([
            { name: 'activeRepositoryName', contextKey: ActiveRepositoryContextKeys.ActiveRepositoryName.key },
            { name: 'activeRepositoryBranchName', contextKey: ActiveRepositoryContextKeys.ActiveRepositoryBranchName.key, }
        ]);
        this._countBadgeConfig = observableConfigValue('scm.countBadge', 'all', this.configurationService);
        this._repositories = observableFromEvent(this, Event.any(this.scmService.onDidAddRepository, this.scmService.onDidRemoveRepository), () => this.scmService.repositories);
        this._activeRepositoryHistoryItemRefName = derived(reader => {
            const activeRepository = this.scmViewService.activeRepository.read(reader);
            const historyProvider = activeRepository?.repository.provider.historyProvider.read(reader);
            const historyItemRef = historyProvider?.historyItemRef.read(reader);
            return historyItemRef?.name;
        });
        this._countBadgeRepositories = derived(this, reader => {
            switch (this._countBadgeConfig.read(reader)) {
                case 'all': {
                    const repositories = this._repositories.read(reader);
                    return [...Iterable.map(repositories, r => ({ provider: r.provider, resourceCount: this._getRepositoryResourceCount(r) }))];
                }
                case 'focused': {
                    const activeRepository = this.scmViewService.activeRepository.read(reader);
                    return activeRepository ? [{ provider: activeRepository.repository.provider, resourceCount: this._getRepositoryResourceCount(activeRepository.repository) }] : [];
                }
                case 'off':
                    return [];
                default:
                    throw new Error('Invalid countBadge setting');
            }
        });
        this._countBadge = derived(this, reader => {
            let total = 0;
            for (const repository of this._countBadgeRepositories.read(reader)) {
                const count = repository.provider.count?.read(reader);
                const resourceCount = repository.resourceCount.read(reader);
                total = total + (count ?? resourceCount);
            }
            return total;
        });
        this._register(autorun(reader => {
            const countBadge = this._countBadge.read(reader);
            this._updateActivityCountBadge(countBadge, reader.store);
        }));
        this._register(autorun(reader => {
            const activeRepository = this.scmViewService.activeRepository.read(reader);
            const commands = activeRepository?.repository.provider.statusBarCommands.read(reader);
            this._updateStatusBar(activeRepository, commands ?? [], reader.store);
        }));
        this._register(autorun(reader => {
            const activeRepository = this.scmViewService.activeRepository.read(reader);
            const historyItemRefName = this._activeRepositoryHistoryItemRefName.read(reader);
            this._updateActiveRepositoryContextKeys(activeRepository?.repository.provider.name, historyItemRefName);
        }));
    }
    _getRepositoryResourceCount(repository) {
        return observableFromEvent(this, repository.provider.onDidChangeResources, () => /** @description repositoryResourceCount */ getRepositoryResourceCount(repository.provider));
    }
    _updateActivityCountBadge(count, store) {
        if (count === 0) {
            return;
        }
        const badge = new NumberBadge(count, num => localize('scmPendingChangesBadge', '{0} pending changes', num));
        store.add(this.activityService.showViewActivity(VIEW_PANE_ID, { badge }));
    }
    _updateStatusBar(activeRepository, commands, store) {
        if (!activeRepository) {
            return;
        }
        const label = activeRepository.repository.provider.rootUri
            ? `${basename(activeRepository.repository.provider.rootUri)} (${activeRepository.repository.provider.label})`
            : activeRepository.repository.provider.label;
        for (let index = 0; index < commands.length; index++) {
            const command = commands[index];
            const tooltip = `${label}${command.tooltip ? ` - ${command.tooltip}` : ''}`;
            const genericCommandName = getStatusBarCommandGenericName(command);
            const statusbarEntry = {
                name: localize('status.scm', "Source Control") + (genericCommandName ? ` ${genericCommandName}` : ''),
                text: command.title,
                ariaLabel: tooltip,
                tooltip,
                command: command.id ? command : undefined
            };
            store.add(index === 0 ?
                this.statusbarService.addEntry(statusbarEntry, `status.scm.${index}`, 0 /* MainThreadStatusBarAlignment.LEFT */, 10000) :
                this.statusbarService.addEntry(statusbarEntry, `status.scm.${index}`, 0 /* MainThreadStatusBarAlignment.LEFT */, { location: { id: `status.scm.${index - 1}`, priority: 10000 }, alignment: 1 /* MainThreadStatusBarAlignment.RIGHT */, compact: true }));
        }
        // Source control provider status bar entry
        if (this.scmService.repositoryCount > 1) {
            const icon = getSCMRepositoryIcon(activeRepository, activeRepository.repository);
            const repositoryStatusbarEntry = {
                name: localize('status.scm.provider', "Source Control Provider"),
                text: `$(${icon.id}) ${activeRepository.repository.provider.name}`,
                ariaLabel: label,
                tooltip: label,
                command: 'scm.setActiveProvider'
            };
            store.add(this.statusbarService.addEntry(repositoryStatusbarEntry, 'status.scm.provider', 0 /* MainThreadStatusBarAlignment.LEFT */, { location: { id: `status.scm.0`, priority: 10000 }, alignment: 0 /* MainThreadStatusBarAlignment.LEFT */, compact: true }));
        }
    }
    _updateActiveRepositoryContextKeys(repositoryName, branchName) {
        this._activeRepositoryNameContextKey.set(repositoryName ?? '');
        this._activeRepositoryBranchNameContextKey.set(branchName ?? '');
    }
};
SCMActiveRepositoryController = __decorate([
    __param(0, IActivityService),
    __param(1, IConfigurationService),
    __param(2, IContextKeyService),
    __param(3, ISCMService),
    __param(4, ISCMViewService),
    __param(5, IStatusbarService),
    __param(6, ITitleService)
], SCMActiveRepositoryController);
export { SCMActiveRepositoryController };
let SCMActiveResourceContextKeyController = class SCMActiveResourceContextKeyController extends Disposable {
    constructor(editorGroupsService, scmService, uriIdentityService) {
        super();
        this.scmService = scmService;
        this.uriIdentityService = uriIdentityService;
        this._onDidRepositoryChange = new Emitter();
        const activeResourceHasChangesContextKey = new RawContextKey('scmActiveResourceHasChanges', false, localize('scmActiveResourceHasChanges', "Whether the active resource has changes"));
        const activeResourceRepositoryContextKey = new RawContextKey('scmActiveResourceRepository', undefined, localize('scmActiveResourceRepository', "The active resource's repository"));
        this._repositories = observableFromEvent(this, Event.any(this.scmService.onDidAddRepository, this.scmService.onDidRemoveRepository), () => this.scmService.repositories);
        this._register(autorun((reader) => {
            for (const repository of this._repositories.read(reader)) {
                reader.store.add(Event.runAndSubscribe(repository.provider.onDidChangeResources, () => {
                    this._onDidRepositoryChange.fire();
                }));
            }
        }));
        // Create context key providers which will update the context keys based on each groups active editor
        const hasChangesContextKeyProvider = {
            contextKey: activeResourceHasChangesContextKey,
            getGroupContextKeyValue: (group) => this._getEditorHasChanges(group.activeEditor),
            onDidChange: this._onDidRepositoryChange.event
        };
        const repositoryContextKeyProvider = {
            contextKey: activeResourceRepositoryContextKey,
            getGroupContextKeyValue: (group) => this._getEditorRepositoryId(group.activeEditor),
            onDidChange: this._onDidRepositoryChange.event
        };
        this._store.add(editorGroupsService.registerContextKeyProvider(hasChangesContextKeyProvider));
        this._store.add(editorGroupsService.registerContextKeyProvider(repositoryContextKeyProvider));
    }
    _getEditorHasChanges(activeEditor) {
        const activeResource = EditorResourceAccessor.getOriginalUri(activeEditor);
        if (!activeResource) {
            return false;
        }
        const activeResourceRepository = this.scmService.getRepository(activeResource);
        for (const resourceGroup of activeResourceRepository?.provider.groups ?? []) {
            if (resourceGroup.resources
                .some(scmResource => this.uriIdentityService.extUri.isEqual(activeResource, scmResource.sourceUri))) {
                return true;
            }
        }
        return false;
    }
    _getEditorRepositoryId(activeEditor) {
        const activeResource = EditorResourceAccessor.getOriginalUri(activeEditor);
        if (!activeResource) {
            return undefined;
        }
        const activeResourceRepository = this.scmService.getRepository(activeResource);
        return activeResourceRepository?.id;
    }
    dispose() {
        this._onDidRepositoryChange.dispose();
        super.dispose();
    }
};
SCMActiveResourceContextKeyController = __decorate([
    __param(0, IEditorGroupsService),
    __param(1, ISCMService),
    __param(2, IUriIdentityService)
], SCMActiveResourceContextKeyController);
export { SCMActiveResourceContextKeyController };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWN0aXZpdHkuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvc2NtL2Jyb3dzZXIvYWN0aXZpdHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsVUFBVSxFQUFtQixNQUFNLHNDQUFzQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQWtCLGVBQWUsRUFBZ0IsTUFBTSxrQkFBa0IsQ0FBQztBQUM1RyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFFOUYsT0FBTyxFQUFlLGtCQUFrQixFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3RILE9BQU8sRUFBbUIsaUJBQWlCLEVBQXNELE1BQU0sa0RBQWtELENBQUM7QUFDMUosT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDbkUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDN0YsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUNoRixPQUFPLEVBQWtDLG9CQUFvQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFFOUgsT0FBTyxFQUFFLDBCQUEwQixFQUFFLG9CQUFvQixFQUFFLDhC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