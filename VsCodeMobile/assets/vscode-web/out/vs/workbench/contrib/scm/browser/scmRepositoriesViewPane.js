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
var ArtifactGroupRenderer_1, ArtifactRenderer_1;
import './media/scm.css';
import { localize } from '../../../../nls.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { append, $ } from '../../../../base/browser/dom.js';
import { WorkbenchCompressibleAsyncDataTree } from '../../../../platform/list/browser/listService.js';
import { ISCMService, ISCMViewService } from '../common/scm.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { combinedDisposable, Disposable, DisposableMap, DisposableStore } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { RepositoryActionRunner, RepositoryRenderer } from './scmRepositoryRenderer.js';
import { collectContextMenuActions, connectPrimaryMenu, getActionViewItemProvider, isSCMArtifactGroupTreeElement, isSCMArtifactNode, isSCMArtifactTreeElement, isSCMRepository } from './util.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { IMenuService, MenuId } from '../../../../platform/actions/common/actions.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { observableConfigValue } from '../../../../platform/observable/common/platformObservableUtils.js';
import { autorun, observableSignalFromEvent, runOnChange } from '../../../../base/common/observable.js';
import { Sequencer, Throttler } from '../../../../base/common/async.js';
import { IconLabel } from '../../../../base/browser/ui/iconLabel/iconLabel.js';
import { SCMViewService } from './scmViewService.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { WorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ResourceTree } from '../../../../base/common/resourceTree.js';
import { URI } from '../../../../base/common/uri.js';
import { basename } from '../../../../base/common/resources.js';
import { Codicon } from '../../../../base/common/codicons.js';
class ListDelegate {
    getHeight() {
        return 22;
    }
    getTemplateId(element) {
        if (isSCMRepository(element)) {
            return RepositoryRenderer.TEMPLATE_ID;
        }
        else if (isSCMArtifactGroupTreeElement(element)) {
            return ArtifactGroupRenderer.TEMPLATE_ID;
        }
        else if (isSCMArtifactTreeElement(element) || isSCMArtifactNode(element)) {
            return ArtifactRenderer.TEMPLATE_ID;
        }
        else {
            throw new Error('Invalid tree element');
        }
    }
}
let ArtifactGroupRenderer = class ArtifactGroupRenderer {
    static { ArtifactGroupRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'artifactGroup'; }
    get templateId() { return ArtifactGroupRenderer_1.TEMPLATE_ID; }
    constructor(_contextMenuService, _contextKeyService, _keybindingService, _menuService, _commandService, _scmViewService, _telemetryService) {
        this._contextMenuService = _contextMenuService;
        this._contextKeyService = _contextKeyService;
        this._keybindingService = _keybindingService;
        this._menuService = _menuService;
        this._commandService = _commandService;
        this._scmViewService = _scmViewService;
        this._telemetryService = _telemetryService;
    }
    renderTemplate(container) {
        const element = append(container, $('.scm-artifact-group'));
        const icon = append(element, $('.icon'));
        const label = new IconLabel(element, { supportIcons: false });
        const actionsContainer = append(element, $('.actions'));
        const actionBar = new WorkbenchToolBar(actionsContainer, undefined, this._menuService, this._contextKeyService, this._contextMenuService, this._keybindingService, this._commandService, this._telemetryService);
        return { icon, label, actionBar, elementDisposables: new DisposableStore(), templateDisposable: combinedDisposable(label, actionBar) };
    }
    renderElement(node, index, templateData) {
        const provider = node.element.repository.provider;
        const artifactGroup = node.element.artifactGroup;
        templateData.icon.className = ThemeIcon.isThemeIcon(artifactGroup.icon)
            ? `icon ${ThemeIcon.asClassName(artifactGroup.icon)}`
            : '';
        templateData.label.setLabel(artifactGroup.name);
        const repositoryMenus = this._scmViewService.menus.getRepositoryMenus(provider);
        templateData.elementDisposables.add(connectPrimaryMenu(repositoryMenus.getArtifactGroupMenu(artifactGroup), primary => {
            templateData.actionBar.setActions(primary);
        }, 'inline', provider));
        templateData.actionBar.context = artifactGroup;
    }
    renderCompressedElements(node, index, templateData, details) {
        throw new Error('Should never happen since node is incompressible');
    }
    disposeElement(element, index, templateData, details) {
        templateData.elementDisposables.clear();
    }
    disposeTemplate(templateData) {
        templateData.elementDisposables.dispose();
        templateData.templateDisposable.dispose();
    }
};
ArtifactGroupRenderer = ArtifactGroupRenderer_1 = __decorate([
    __param(0, IContextMenuService),
    __param(1, IContextKeyService),
    __param(2, IKeybindingService),
    __param(3, IMenuService),
    __param(4, ICommandService),
    __param(5, ISCMViewService),
    __param(6, ITelemetryService)
], ArtifactGroupRenderer);
let ArtifactRenderer = class ArtifactRenderer {
    static { ArtifactRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'artifact'; }
    get templateId() { return ArtifactRenderer_1.TEMPLATE_ID; }
    constructor(_contextMenuService, _contextKeyService, _keybindingService, _menuService, _commandService, _scmViewService, _telemetryService) {
        this._contextMenuService = _contextMenuService;
        this._contextKeyService = _contextKeyService;
        this._keybindingService = _keybindingService;
        this._menuService = _menuService;
        this._commandService = _commandService;
        this._scmViewService = _scmViewService;
        this._telemetryService = _telemetryService;
    }
    renderTemplate(container) {
        const element = append(container, $('.scm-artifact'));
        const icon = append(element, $('.icon'));
        const label = new IconLabel(element, { supportIcons: false });
        const actionsContainer = append(element, $('.actions'));
        const actionBar = new WorkbenchToolBar(actionsContainer, undefined, this._menuService, this._contextKeyService, this._contextMenuService, this._keybindingService, this._commandService, this._telemetryService);
        return { icon, label, actionBar, elementDisposables: new DisposableStore(), templateDisposable: combinedDisposable(label, actionBar) };
    }
    renderElement(nodeOrElement, index, templateData) {
        const artifactOrFolder = nodeOrElement.element;
        // Label
        if (isSCMArtifactTreeElement(artifactOrFolder)) {
            // Artifact
            const artifact = artifactOrFolder.artifact;
            const artifactIcon = artifact.icon ?? artifactOrFolder.group.icon;
            templateData.icon.className = ThemeIcon.isThemeIcon(artifactIcon)
                ? `icon ${ThemeIcon.asClassName(artifactIcon)}`
                : '';
            const artifactLabel = artifact.name.split('/').pop() ?? artifact.name;
            templateData.label.setLabel(artifactLabel, artifact.description);
        }
        else if (isSCMArtifactNode(artifactOrFolder)) {
            // Folder
            templateData.icon.className = `icon ${ThemeIcon.asClassName(Codicon.folder)}`;
            templateData.label.setLabel(basename(artifactOrFolder.uri));
        }
        // Actions
        this._renderActionBar(artifactOrFolder, templateData);
    }
    renderCompressedElements(node, index, templateData, details) {
        const compressed = node.element;
        const artifactOrFolder = compressed.elements[compressed.elements.length - 1];
        // Label
        if (isSCMArtifactTreeElement(artifactOrFolder)) {
            // Artifact
            const artifact = artifactOrFolder.artifact;
            const artifactIcon = artifact.icon ?? artifactOrFolder.group.icon;
            templateData.icon.className = ThemeIcon.isThemeIcon(artifactIcon)
                ? `icon ${ThemeIcon.asClassName(artifactIcon)}`
                : '';
            templateData.label.setLabel(artifact.name, artifact.description);
        }
        else if (isSCMArtifactNode(artifactOrFolder)) {
            // Folder
            templateData.icon.className = `icon ${ThemeIcon.asClassName(Codicon.folder)}`;
            templateData.label.setLabel(artifactOrFolder.uri.fsPath.substring(1));
        }
        // Actions
        this._renderActionBar(artifactOrFolder, templateData);
    }
    _renderActionBar(artifactOrFolder, templateData) {
        if (isSCMArtifactTreeElement(artifactOrFolder)) {
            const artifact = artifactOrFolder.artifact;
            const provider = artifactOrFolder.repository.provider;
            const repositoryMenus = this._scmViewService.menus.getRepositoryMenus(provider);
            templateData.elementDisposables.add(connectPrimaryMenu(repositoryMenus.getArtifactMenu(artifactOrFolder.group, artifact), primary => {
                templateData.actionBar.setActions(primary);
            }, 'inline', provider));
            templateData.actionBar.context = artifact;
        }
        else if (ResourceTree.isResourceNode(artifactOrFolder)) {
            templateData.actionBar.setActions([]);
            templateData.actionBar.context = undefined;
        }
    }
    disposeElement(element, index, templateData, details) {
        templateData.elementDisposables.clear();
    }
    disposeTemplate(templateData) {
        templateData.elementDisposables.dispose();
        templateData.templateDisposable.dispose();
    }
};
ArtifactRenderer = ArtifactRenderer_1 = __decorate([
    __param(0, IContextMenuService),
    __param(1, IContextKeyService),
    __param(2, IKeybindingService),
    __param(3, IMenuService),
    __param(4, ICommandService),
    __param(5, ISCMViewService),
    __param(6, ITelemetryService)
], ArtifactRenderer);
let RepositoryTreeDataSource = class RepositoryTreeDataSource extends Disposable {
    constructor(scmViewService) {
        super();
        this.scmViewService = scmViewService;
    }
    async getChildren(inputOrElement) {
        if (this.scmViewService.explorerEnabledConfig.get() === false) {
            const parentId = isSCMRepository(inputOrElement)
                ? inputOrElement.provider.id
                : undefined;
            const repositories = this.scmViewService.repositories
                .filter(r => r.provider.parentId === parentId);
            return repositories;
        }
        // Explorer mode
        if (inputOrElement instanceof SCMViewService) {
            // Get all top level repositories
            const repositories = this.scmViewService.repositories
                .filter(r => r.provider.parentId === undefined);
            // Check whether there are any child repositories
            if (repositories.length !== this.scmViewService.repositories.length) {
                for (const repository of repositories) {
                    const childRepositories = this.scmViewService.repositories
                        .filter(r => r.provider.parentId === repository.provider.id);
                    if (childRepositories.length === 0) {
                        continue;
                    }
                    // Insert child repositories right after the parent
                    const repositoryIndex = repositories.indexOf(repository);
                    repositories.splice(repositoryIndex + 1, 0, ...childRepositories);
                }
            }
            return repositories;
        }
        else if (isSCMRepository(inputOrElement)) {
            const artifactGroups = await inputOrElement.provider.artifactProvider.get()?.provideArtifactGroups() ?? [];
            return artifactGroups.map(group => ({
                repository: inputOrElement,
                artifactGroup: group,
                type: 'artifactGroup'
            }));
        }
        else if (isSCMArtifactGroupTreeElement(inputOrElement)) {
            const repository = inputOrElement.repository;
            const artifacts = await repository.provider.artifactProvider.get()?.provideArtifacts(inputOrElement.artifactGroup.id) ?? [];
            // Create resource tree for artifacts
            const artifactsTree = new ResourceTree(inputOrElement);
            for (const artifact of artifacts) {
                artifactsTree.add(URI.from({
                    scheme: 'scm-artifact', path: artifact.name
                }), {
                    repository,
                    group: inputOrElement.artifactGroup,
                    artifact,
                    type: 'artifact'
                });
            }
            return Iterable.map(artifactsTree.root.children, node => node.element ?? node);
        }
        else if (isSCMArtifactNode(inputOrElement)) {
            return Iterable.map(inputOrElement.children, node => node.element && node.childrenCount === 0 ? node.element : node);
        }
        else if (isSCMArtifactTreeElement(inputOrElement)) { }
        return [];
    }
    hasChildren(inputOrElement) {
        if (this.scmViewService.explorerEnabledConfig.get() === false) {
            const parentId = isSCMRepository(inputOrElement)
                ? inputOrElement.provider.id
                : undefined;
            const repositories = this.scmViewService.repositories
                .filter(r => r.provider.parentId === parentId);
            return repositories.length > 0;
        }
        // Explorer mode
        if (inputOrElement instanceof SCMViewService) {
            return this.scmViewService.repositories.length > 0;
        }
        else if (isSCMRepository(inputOrElement)) {
            return true;
        }
        else if (isSCMArtifactGroupTreeElement(inputOrElement)) {
            return true;
        }
        else if (isSCMArtifactTreeElement(inputOrElement)) {
            return false;
        }
        else if (isSCMArtifactNode(inputOrElement)) {
            return inputOrElement.childrenCount > 0;
        }
        else {
            return false;
        }
    }
};
RepositoryTreeDataSource = __decorate([
    __param(0, ISCMViewService)
], RepositoryTreeDataSource);
class RepositoryTreeIdentityProvider {
    getId(element) {
        if (isSCMRepository(element)) {
            return `repo:${element.provider.id}`;
        }
        else if (isSCMArtifactGroupTreeElement(element)) {
            return `artifactGroup:${element.repository.provider.id}/${element.artifactGroup.id}`;
        }
        else if (isSCMArtifactTreeElement(element)) {
            return `artifact:${element.repository.provider.id}/${element.group.id}/${element.artifact.id}`;
        }
        else if (isSCMArtifactNode(element)) {
            return `artifactFolder:${element.context.repository.provider.id}/${element.context.artifactGroup.id}/${element.uri.fsPath}`;
        }
        else {
            throw new Error('Invalid tree element');
        }
    }
}
class RepositoriesTreeCompressionDelegate {
    isIncompressible(element) {
        if (ResourceTree.isResourceNode(element)) {
            return element.childrenCount > 1;
        }
        else {
            return true;
        }
    }
}
let SCMRepositoriesViewPane = class SCMRepositoriesViewPane extends ViewPane {
    constructor(options, scmService, scmViewService, keybindingService, contextMenuService, instantiationService, viewDescriptorService, contextKeyService, configurationService, openerService, themeService, hoverService) {
        super({ ...options, titleMenuId: MenuId.SCMSourceControlTitle }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this.scmService = scmService;
        this.scmViewService = scmViewService;
        this.treeOperationSequencer = new Sequencer();
        this.updateChildrenThrottler = new Throttler();
        this.visibilityDisposables = new DisposableStore();
        this.repositoryDisposables = new DisposableMap();
        this.visibleCountObs = observableConfigValue('scm.repositories.visible', 10, this.configurationService);
        this.providerCountBadgeObs = observableConfigValue('scm.providerCountBadge', 'hidden', this.configurationService);
        this._register(this.updateChildrenThrottler);
    }
    renderBody(container) {
        super.renderBody(container);
        const treeContainer = append(container, $('.scm-view.scm-repositories-view'));
        // scm.providerCountBadge setting
        this._register(autorun(reader => {
            const providerCountBadge = this.providerCountBadgeObs.read(reader);
            treeContainer.classList.toggle('hide-provider-counts', providerCountBadge === 'hidden');
            treeContainer.classList.toggle('auto-provider-counts', providerCountBadge === 'auto');
        }));
        this.createTree(treeContainer);
        this.onDidChangeBodyVisibility(async (visible) => {
            if (!visible) {
                this.visibilityDisposables.clear();
                return;
            }
            this.treeOperationSequencer.queue(async () => {
                // Initial rendering
                await this.tree.setInput(this.scmViewService);
                // scm.repositories.visible setting
                this.visibilityDisposables.add(autorun(reader => {
                    const visibleCount = this.visibleCountObs.read(reader);
                    this.updateBodySize(this.tree.contentHeight, visibleCount);
                }));
                // scm.repositories.explorer setting
                this.visibilityDisposables.add(runOnChange(this.scmViewService.explorerEnabledConfig, async () => {
                    await this.updateChildren();
                    this.updateBodySize(this.tree.contentHeight);
                    // If we only have one repository, expand it
                    if (this.scmViewService.repositories.length === 1) {
                        await this.treeOperationSequencer.queue(() => this.tree.expand(this.scmViewService.repositories[0]));
                    }
                }));
                // Update tree selection
                const onDidChangeVisibleRepositoriesSignal = observableSignalFromEvent(this, this.scmViewService.onDidChangeVisibleRepositories);
                this.visibilityDisposables.add(autorun(async (reader) => {
                    onDidChangeVisibleRepositoriesSignal.read(reader);
                    await this.treeOperationSequencer.queue(() => this.updateTreeSelection());
                }));
                // Add/Remove event handlers
                this.scmService.onDidAddRepository(this.onDidAddRepository, this, this.visibilityDisposables);
                this.scmService.onDidRemoveRepository(this.onDidRemoveRepository, this, this.visibilityDisposables);
                for (const repository of this.scmService.repositories) {
                    this.onDidAddRepository(repository);
                }
            });
        }, this, this._store);
    }
    layoutBody(height, width) {
        super.layoutBody(height, width);
        this.tree.layout(height, width);
    }
    focus() {
        super.focus();
        this.tree.domFocus();
    }
    createTree(container) {
        this.treeIdentityProvider = new RepositoryTreeIdentityProvider();
        this.treeDataSource = this.instantiationService.createInstance(RepositoryTreeDataSource);
        this._register(this.treeDataSource);
        this.tree = this.instantiationService.createInstance(WorkbenchCompressibleAsyncDataTree, 'SCM Repositories', container, new ListDelegate(), new RepositoriesTreeCompressionDelegate(), [
            this.instantiationService.createInstance(RepositoryRenderer, MenuId.SCMSourceControlInline, getActionViewItemProvider(this.instantiationService)),
            this.instantiationService.createInstance(ArtifactGroupRenderer),
            this.instantiationService.createInstance(ArtifactRenderer)
        ], this.treeDataSource, {
            identityProvider: this.treeIdentityProvider,
            horizontalScrolling: false,
            collapseByDefault: (e) => {
                if (this.scmViewService.explorerEnabledConfig.get() === false) {
                    if (isSCMRepository(e) && e.provider.parentId === undefined) {
                        return false;
                    }
                    return true;
                }
                // Explorer mode
                if (isSCMArtifactNode(e)) {
                    // Only expand artifact folders as they are compressed by default
                    return !(e.childrenCount === 1 && Iterable.first(e.children)?.element === undefined);
                }
                else {
                    return true;
                }
            },
            compressionEnabled: true,
            overrideStyles: this.getLocationBasedColors().listOverrideStyles,
            multipleSelectionSupport: this.scmViewService.selectionModeConfig.get() === 'multiple',
            expandOnDoubleClick: true,
            expandOnlyOnTwistieClick: true,
            accessibilityProvider: {
                getAriaLabel(element) {
                    if (isSCMRepository(element)) {
                        return element.provider.label;
                    }
                    else if (isSCMArtifactGroupTreeElement(element)) {
                        return element.artifactGroup.name;
                    }
                    else if (isSCMArtifactTreeElement(element)) {
                        return element.artifact.name;
                    }
                    else {
                        return '';
                    }
                },
                getWidgetAriaLabel() {
                    return localize('scm', "Source Control Repositories");
                }
            }
        });
        this._register(this.tree);
        this._register(autorun(reader => {
            const selectionMode = this.scmViewService.selectionModeConfig.read(reader);
            this.tree.updateOptions({ multipleSelectionSupport: selectionMode === 'multiple' });
        }));
        this._register(this.tree.onDidChangeSelection(this.onTreeSelectionChange, this));
        this._register(this.tree.onDidChangeFocus(this.onTreeDidChangeFocus, this));
        this._register(this.tree.onDidFocus(this.onDidTreeFocus, this));
        this._register(this.tree.onContextMenu(this.onTreeContextMenu, this));
        this._register(this.tree.onDidChangeContentHeight(this.onTreeContentHeightChange, this));
    }
    async onDidAddRepository(repository) {
        const disposables = new DisposableStore();
        // Artifact group changed
        disposables.add(autorun(async (reader) => {
            const explorerEnabled = this.scmViewService.explorerEnabledConfig.read(reader);
            const artifactsProvider = repository.provider.artifactProvider.read(reader);
            if (!explorerEnabled || !artifactsProvider) {
                return;
            }
            reader.store.add(artifactsProvider.onDidChangeArtifacts(async (groups) => {
                await this.updateRepository(repository);
            }));
        }));
        // HistoryItemRef changed
        disposables.add(autorun(async (reader) => {
            const historyProvider = repository.provider.historyProvider.read(reader);
            if (!historyProvider) {
                return;
            }
            reader.store.add(runOnChange(historyProvider.historyItemRef, async () => {
                await this.updateRepository(repository);
            }));
        }));
        await this.updateRepository(repository);
        this.repositoryDisposables.set(repository, disposables);
    }
    async onDidRemoveRepository(repository) {
        await this.updateRepository(repository);
        this.repositoryDisposables.deleteAndDispose(repository);
    }
    onTreeContextMenu(e) {
        if (!e.element) {
            return;
        }
        if (isSCMRepository(e.element)) {
            // Repository
            const provider = e.element.provider;
            const menus = this.scmViewService.menus.getRepositoryMenus(provider);
            const menu = menus.getRepositoryContextMenu(e.element);
            const actions = collectContextMenuActions(menu);
            const disposables = new DisposableStore();
            const actionRunner = new RepositoryActionRunner(() => {
                return this.getTreeSelection();
            });
            disposables.add(actionRunner);
            disposables.add(actionRunner.onWillRun(() => this.tree.domFocus()));
            this.contextMenuService.showContextMenu({
                actionRunner,
                getAnchor: () => e.anchor,
                getActions: () => actions,
                getActionsContext: () => provider,
                onHide: () => disposables.dispose()
            });
        }
        else if (isSCMArtifactTreeElement(e.element)) {
            // Artifact
            const provider = e.element.repository.provider;
            const artifact = e.element.artifact;
            const menus = this.scmViewService.menus.getRepositoryMenus(provider);
            const menu = menus.getArtifactMenu(e.element.group, artifact);
            const actions = collectContextMenuActions(menu, provider);
            this.contextMenuService.showContextMenu({
                getAnchor: () => e.anchor,
                getActions: () => actions,
                getActionsContext: () => artifact
            });
        }
    }
    onTreeSelectionChange(e) {
        if (e.browserEvent && e.elements.length > 0) {
            const scrollTop = this.tree.scrollTop;
            if (e.elements.every(e => isSCMRepository(e))) {
                this.scmViewService.visibleRepositories = e.elements;
            }
            else if (e.elements.every(e => isSCMArtifactGroupTreeElement(e) || isSCMArtifactTreeElement(e))) {
                this.scmViewService.visibleRepositories = e.elements.map(e => e.repository);
            }
            this.tree.scrollTop = scrollTop;
        }
    }
    onTreeDidChangeFocus(e) {
        if (e.browserEvent && e.elements.length > 0) {
            if (isSCMRepository(e.elements[0])) {
                this.scmViewService.focus(e.elements[0]);
            }
        }
    }
    onDidTreeFocus() {
        const focused = this.tree.getFocus();
        if (focused.length > 0) {
            if (isSCMRepository(focused[0])) {
                this.scmViewService.focus(focused[0]);
            }
            else if (isSCMArtifactGroupTreeElement(focused[0]) || isSCMArtifactTreeElement(focused[0])) {
                this.scmViewService.focus(focused[0].repository);
            }
        }
    }
    onTreeContentHeightChange(height) {
        this.updateBodySize(height);
        // Refresh the selection
        this.treeOperationSequencer.queue(() => this.updateTreeSelection());
    }
    async updateChildren(element) {
        return this.updateChildrenThrottler.queue(() => this.treeOperationSequencer.queue(async () => {
            if (element && this.tree.hasNode(element)) {
                await this.tree.updateChildren(element, true);
            }
            else {
                await this.tree.updateChildren(undefined, true);
            }
        }));
    }
    async expand(element) {
        await this.treeOperationSequencer.queue(() => this.tree.expand(element, true));
    }
    async updateRepository(repository) {
        if (this.scmViewService.explorerEnabledConfig.get() === false) {
            if (repository.provider.parentId === undefined) {
                await this.updateChildren();
                return;
            }
            await this.updateParentRepository(repository);
        }
        // Explorer mode
        await this.updateChildren();
    }
    async updateParentRepository(repository) {
        const parentRepository = this.scmViewService.repositories
            .find(r => r.provider.id === repository.provider.parentId);
        if (!parentRepository) {
            return;
        }
        await this.updateChildren(parentRepository);
        await this.expand(parentRepository);
    }
    updateBodySize(contentHeight, visibleCount) {
        if (this.orientation === 1 /* Orientation.HORIZONTAL */) {
            return;
        }
        if (this.scmViewService.explorerEnabledConfig.get() === false) {
            visibleCount = visibleCount ?? this.visibleCountObs.get();
            const empty = this.scmViewService.repositories.length === 0;
            const size = Math.min(contentHeight / 22, visibleCount) * 22;
            this.minimumBodySize = visibleCount === 0 ? 22 : size;
            this.maximumBodySize = visibleCount === 0 ? Number.POSITIVE_INFINITY : empty ? Number.POSITIVE_INFINITY : size;
        }
        else {
            this.minimumBodySize = 120;
            this.maximumBodySize = Number.POSITIVE_INFINITY;
        }
    }
    async updateTreeSelection() {
        const oldSelection = this.getTreeSelection();
        const oldSet = new Set(oldSelection);
        const set = new Set(this.scmViewService.visibleRepositories);
        const added = new Set(Iterable.filter(set, r => !oldSet.has(r)));
        const removed = new Set(Iterable.filter(oldSet, r => !set.has(r)));
        if (added.size === 0 && removed.size === 0) {
            return;
        }
        const selection = oldSelection.filter(repo => !removed.has(repo));
        for (const repo of this.scmViewService.repositories) {
            if (added.has(repo)) {
                selection.push(repo);
            }
        }
        const visibleSelection = selection
            .filter(s => this.tree.hasNode(s));
        this.tree.setSelection(visibleSelection);
        if (visibleSelection.length > 0 && !this.tree.getFocus().includes(visibleSelection[0])) {
            this.tree.setAnchor(visibleSelection[0]);
            this.tree.setFocus([visibleSelection[0]]);
        }
    }
    getTreeSelection() {
        return this.tree.getSelection()
            .map(e => {
            if (isSCMRepository(e)) {
                return e;
            }
            else if (isSCMArtifactGroupTreeElement(e) || isSCMArtifactTreeElement(e)) {
                return e.repository;
            }
            else if (isSCMArtifactNode(e)) {
                return e.context.repository;
            }
            else {
                throw new Error('Invalid tree element');
            }
        });
    }
    dispose() {
        this.visibilityDisposables.dispose();
        super.dispose();
    }
};
SCMRepositoriesViewPane = __decorate([
    __param(1, ISCMService),
    __param(2, ISCMViewService),
    __param(3, IKeybindingService),
    __param(4, IContextMenuService),
    __param(5, IInstantiationService),
    __param(6, IViewDescriptorService),
    __param(7, IContextKeyService),
    __param(8, IConfigurationService),
    __param(9, IOpenerService),
    __param(10, IThemeService),
    __param(11, IHoverService)
], SCMRepositoriesViewPane);
export { SCMRepositoriesViewPane };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NtUmVwb3NpdG9yaWVzVmlld1BhbmUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvc2NtL2Jyb3dzZXIvc2NtUmVwb3NpdG9yaWVzVmlld1BhbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8saUJBQWlCLENBQUM7QUFDekIsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxRQUFRLEVBQW9CLE1BQU0sMENBQTBDLENBQUM7QUFDdEYsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUc1RCxPQUFPLEVBQUUsa0NBQWtDLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUN0RyxPQUFPLEVBQWtCLFdBQVcsRUFBRSxlQUFlLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUNoRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM5RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFlLE1BQU0sc0NBQXNDLENBQUM7QUFDbkksT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDbEUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDhD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