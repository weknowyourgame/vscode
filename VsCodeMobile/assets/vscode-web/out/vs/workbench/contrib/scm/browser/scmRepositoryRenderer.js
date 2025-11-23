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
var RepositoryRenderer_1;
import './media/scm.css';
import { DisposableStore, combinedDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, observableSignalFromEvent } from '../../../../base/common/observable.js';
import { append, $ } from '../../../../base/browser/dom.js';
import { ISCMViewService } from '../common/scm.js';
import { CountBadge } from '../../../../base/browser/ui/countBadge/countBadge.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ActionRunner } from '../../../../base/common/actions.js';
import { connectPrimaryMenu, getRepositoryResourceCount, isSCMRepository, StatusBarAction } from './util.js';
import { defaultCountBadgeStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { WorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { IMenuService, MenuId, MenuItemAction } from '../../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IconLabel } from '../../../../base/browser/ui/iconLabel/iconLabel.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { shorten } from '../../../../base/common/labels.js';
import { dirname } from '../../../../base/common/resources.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { Codicon } from '../../../../base/common/codicons.js';
export class RepositoryActionRunner extends ActionRunner {
    constructor(getSelectedRepositories) {
        super();
        this.getSelectedRepositories = getSelectedRepositories;
    }
    async runAction(action, context) {
        if (!(action instanceof MenuItemAction)) {
            return super.runAction(action, context);
        }
        const actionContext = [context];
        // If the selection contains the repository, add the
        // other selected repositories to the action context
        const selection = this.getSelectedRepositories().map(r => r.provider);
        if (selection.some(s => s === context)) {
            actionContext.push(...selection.filter(s => s !== context));
        }
        await action.run(...actionContext);
    }
}
let RepositoryRenderer = class RepositoryRenderer {
    static { RepositoryRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'repository'; }
    get templateId() { return RepositoryRenderer_1.TEMPLATE_ID; }
    constructor(toolbarMenuId, actionViewItemProvider, commandService, contextKeyService, contextMenuService, keybindingService, labelService, menuService, scmViewService, telemetryService, uriIdentityService) {
        this.toolbarMenuId = toolbarMenuId;
        this.actionViewItemProvider = actionViewItemProvider;
        this.commandService = commandService;
        this.contextKeyService = contextKeyService;
        this.contextMenuService = contextMenuService;
        this.keybindingService = keybindingService;
        this.labelService = labelService;
        this.menuService = menuService;
        this.scmViewService = scmViewService;
        this.telemetryService = telemetryService;
        this.uriIdentityService = uriIdentityService;
        this.onDidChangeVisibleRepositoriesSignal = observableSignalFromEvent(this, this.scmViewService.onDidChangeVisibleRepositories);
    }
    renderTemplate(container) {
        const provider = append(container, $('.scm-provider'));
        const icon = append(provider, $('.icon'));
        const label = new IconLabel(provider, { supportIcons: false });
        const actions = append(provider, $('.actions'));
        const toolBar = new WorkbenchToolBar(actions, { actionViewItemProvider: this.actionViewItemProvider, resetMenu: this.toolbarMenuId, responsiveBehavior: { enabled: true, minItems: 2 } }, this.menuService, this.contextKeyService, this.contextMenuService, this.keybindingService, this.commandService, this.telemetryService);
        const countContainer = append(provider, $('.count'));
        const count = new CountBadge(countContainer, {}, defaultCountBadgeStyles);
        const visibilityDisposable = toolBar.onDidChangeDropdownVisibility(e => provider.classList.toggle('active', e));
        const templateDisposable = combinedDisposable(label, visibilityDisposable, toolBar);
        return { icon, label, countContainer, count, toolBar, elementDisposables: new DisposableStore(), templateDisposable };
    }
    renderElement(arg, index, templateData) {
        const repository = isSCMRepository(arg) ? arg : arg.element;
        templateData.elementDisposables.add(autorun(reader => {
            this.onDidChangeVisibleRepositoriesSignal.read(reader);
            const isVisible = this.scmViewService.isVisible(repository);
            const icon = ThemeIcon.isThemeIcon(repository.provider.iconPath)
                ? repository.provider.iconPath
                : Codicon.repo;
            // Only show the selected icon if there are multiple repositories in the workspace
            const showSelectedIcon = icon.id === Codicon.repo.id && isVisible && this.scmViewService.repositories.length > 1;
            templateData.icon.className = showSelectedIcon
                ? `icon ${ThemeIcon.asClassName(Codicon.repoSelected)}`
                : `icon ${ThemeIcon.asClassName(icon)}`;
        }));
        // Use the description to disambiguate repositories with the same name and have
        // a `rootUri`. Use the `provider.rootUri` for disambiguation. If they have the
        // same path, we will use the provider label to disambiguate.
        let description = undefined;
        if (repository.provider.rootUri) {
            const repositoriesWithRootUri = this.scmViewService.repositories
                .filter(r => r.provider.rootUri !== undefined &&
                this.uriIdentityService.extUri.isEqual(r.provider.rootUri, repository.provider.rootUri));
            const repositoriesWithSameName = this.scmViewService.repositories
                .filter(r => r.provider.rootUri !== undefined &&
                r.provider.name === repository.provider.name);
            if (repositoriesWithRootUri.length > 1) {
                description = repository.provider.label;
            }
            else if (repositoriesWithSameName.length > 1) {
                const repositoryIndex = repositoriesWithSameName.findIndex(r => r === repository);
                const shortDescription = shorten(repositoriesWithSameName
                    .map(r => this.labelService.getUriLabel(dirname(r.provider.rootUri), { relative: true })));
                description = shortDescription[repositoryIndex];
            }
        }
        let label;
        if (this.scmViewService.explorerEnabledConfig.get() === false) {
            label = repository.provider.name;
        }
        else {
            const parentRepository = this.scmViewService.repositories
                .find(r => r.provider.id === repository.provider.parentId);
            label = parentRepository
                ? `${parentRepository.provider.name} / ${repository.provider.name}`
                : repository.provider.name;
        }
        const title = repository.provider.rootUri
            ? `${repository.provider.label}: ${this.labelService.getUriLabel(repository.provider.rootUri)}`
            : repository.provider.label;
        templateData.label.setLabel(label, description, { title });
        let statusPrimaryActions = [];
        let menuPrimaryActions = [];
        let menuSecondaryActions = [];
        const updateToolbar = () => {
            templateData.toolBar.setActions([...statusPrimaryActions, ...menuPrimaryActions], menuSecondaryActions);
        };
        templateData.elementDisposables.add(autorun(reader => {
            const commands = repository.provider.statusBarCommands.read(reader) ?? [];
            statusPrimaryActions = commands.map(c => reader.store.add(new StatusBarAction(c, this.commandService)));
            updateToolbar();
        }));
        templateData.elementDisposables.add(autorun(reader => {
            const count = repository.provider.count.read(reader) ?? getRepositoryResourceCount(repository.provider);
            templateData.countContainer.setAttribute('data-count', String(count));
            templateData.count.setCount(count);
        }));
        templateData.elementDisposables.add(autorun(reader => {
            repository.provider.contextValue.read(reader);
            const repositoryMenus = this.scmViewService.menus.getRepositoryMenus(repository.provider);
            const menu = this.toolbarMenuId === MenuId.SCMTitle
                ? repositoryMenus.titleMenu.menu
                : repositoryMenus.getRepositoryMenu(repository);
            reader.store.add(connectPrimaryMenu(menu, (primary, secondary) => {
                menuPrimaryActions = primary;
                menuSecondaryActions = secondary;
                updateToolbar();
            }, this.toolbarMenuId === MenuId.SCMTitle ? 'navigation' : 'inline'));
        }));
        templateData.toolBar.context = repository.provider;
    }
    renderCompressedElements() {
        throw new Error('Should never happen since node is incompressible');
    }
    disposeElement(group, index, template) {
        template.elementDisposables.clear();
    }
    disposeTemplate(templateData) {
        templateData.elementDisposables.dispose();
        templateData.templateDisposable.dispose();
        templateData.count.dispose();
    }
};
RepositoryRenderer = RepositoryRenderer_1 = __decorate([
    __param(2, ICommandService),
    __param(3, IContextKeyService),
    __param(4, IContextMenuService),
    __param(5, IKeybindingService),
    __param(6, ILabelService),
    __param(7, IMenuService),
    __param(8, ISCMViewService),
    __param(9, ITelemetryService),
    __param(10, IUriIdentityService)
], RepositoryRenderer);
export { RepositoryRenderer };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NtUmVwb3NpdG9yeVJlbmRlcmVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3NjbS9icm93c2VyL3NjbVJlcG9zaXRvcnlSZW5kZXJlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxpQkFBaUIsQ0FBQztBQUN6QixPQUFPLEVBQWUsZUFBZSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDeEcsT0FBTyxFQUFFLE9BQU8sRUFBZSx5QkFBeUIsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3hHLE9BQU8sRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDNUQsT0FBTyxFQUFnQyxlQUFlLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUNqRixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDbEYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDOUYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxZQUFZLEVBQVcsTUFBTSxvQ0FBb0MsQ0FBQztBQUMzRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsMEJBQTBCLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQU03RyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUM5RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUNuRixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFP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