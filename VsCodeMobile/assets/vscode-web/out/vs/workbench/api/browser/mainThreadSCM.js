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
import { Barrier } from '../../../base/common/async.js';
import { isUriComponents, URI } from '../../../base/common/uri.js';
import { Event, Emitter } from '../../../base/common/event.js';
import { observableValue, observableValueOpts, transaction } from '../../../base/common/observable.js';
import { DisposableStore, combinedDisposable, dispose, Disposable } from '../../../base/common/lifecycle.js';
import { ISCMService, ISCMViewService } from '../../contrib/scm/common/scm.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { IQuickDiffService } from '../../contrib/scm/common/quickDiff.js';
import { ResourceTree } from '../../../base/common/resourceTree.js';
import { IUriIdentityService } from '../../../platform/uriIdentity/common/uriIdentity.js';
import { IWorkspaceContextService } from '../../../platform/workspace/common/workspace.js';
import { basename } from '../../../base/common/resources.js';
import { ILanguageService } from '../../../editor/common/languages/language.js';
import { IModelService } from '../../../editor/common/services/model.js';
import { ITextModelService } from '../../../editor/common/services/resolverService.js';
import { Schemas } from '../../../base/common/network.js';
import { structuralEquals } from '../../../base/common/equals.js';
import { historyItemBaseRefColor, historyItemRefColor, historyItemRemoteRefColor } from '../../contrib/scm/browser/scmHistory.js';
function getIconFromIconDto(iconDto) {
    if (iconDto === undefined) {
        return undefined;
    }
    else if (ThemeIcon.isThemeIcon(iconDto)) {
        return iconDto;
    }
    else if (isUriComponents(iconDto)) {
        return URI.revive(iconDto);
    }
    else {
        const icon = iconDto;
        return { light: URI.revive(icon.light), dark: URI.revive(icon.dark) };
    }
}
function toISCMHistoryItem(historyItemDto) {
    const authorIcon = getIconFromIconDto(historyItemDto.authorIcon);
    const references = historyItemDto.references?.map(r => ({
        ...r, icon: getIconFromIconDto(r.icon)
    }));
    return { ...historyItemDto, authorIcon, references };
}
function toISCMHistoryItemRef(historyItemRefDto, color) {
    return historyItemRefDto ? { ...historyItemRefDto, icon: getIconFromIconDto(historyItemRefDto.icon), color: color } : undefined;
}
class SCMInputBoxContentProvider extends Disposable {
    constructor(textModelService, modelService, languageService) {
        super();
        this.modelService = modelService;
        this.languageService = languageService;
        this._register(textModelService.registerTextModelContentProvider(Schemas.vscodeSourceControl, this));
    }
    async provideTextContent(resource) {
        const existing = this.modelService.getModel(resource);
        if (existing) {
            return existing;
        }
        return this.modelService.createModel('', this.languageService.createById('scminput'), resource);
    }
}
class MainThreadSCMResourceGroup {
    get resourceTree() {
        if (!this._resourceTree) {
            const rootUri = this.provider.rootUri ?? URI.file('/');
            this._resourceTree = new ResourceTree(this, rootUri, this._uriIdentService.extUri);
            for (const resource of this.resources) {
                this._resourceTree.add(resource.sourceUri, resource);
            }
        }
        return this._resourceTree;
    }
    get hideWhenEmpty() { return !!this.features.hideWhenEmpty; }
    get contextValue() { return this.features.contextValue; }
    constructor(sourceControlHandle, handle, provider, features, label, id, multiDiffEditorEnableViewChanges, _uriIdentService) {
        this.sourceControlHandle = sourceControlHandle;
        this.handle = handle;
        this.provider = provider;
        this.features = features;
        this.label = label;
        this.id = id;
        this.multiDiffEditorEnableViewChanges = multiDiffEditorEnableViewChanges;
        this._uriIdentService = _uriIdentService;
        this.resources = [];
        this._onDidChange = new Emitter();
        this.onDidChange = this._onDidChange.event;
        this._onDidChangeResources = new Emitter();
        this.onDidChangeResources = this._onDidChangeResources.event;
    }
    toJSON() {
        return {
            $mid: 4 /* MarshalledId.ScmResourceGroup */,
            sourceControlHandle: this.sourceControlHandle,
            groupHandle: this.handle
        };
    }
    splice(start, deleteCount, toInsert) {
        this.resources.splice(start, deleteCount, ...toInsert);
        this._resourceTree = undefined;
        this._onDidChangeResources.fire();
    }
    $updateGroup(features) {
        this.features = { ...this.features, ...features };
        this._onDidChange.fire();
    }
    $updateGroupLabel(label) {
        this.label = label;
        this._onDidChange.fire();
    }
}
class MainThreadSCMResource {
    constructor(proxy, sourceControlHandle, groupHandle, handle, sourceUri, resourceGroup, decorations, contextValue, command, multiDiffEditorOriginalUri, multiDiffEditorModifiedUri) {
        this.proxy = proxy;
        this.sourceControlHandle = sourceControlHandle;
        this.groupHandle = groupHandle;
        this.handle = handle;
        this.sourceUri = sourceUri;
        this.resourceGroup = resourceGroup;
        this.decorations = decorations;
        this.contextValue = contextValue;
        this.command = command;
        this.multiDiffEditorOriginalUri = multiDiffEditorOriginalUri;
        this.multiDiffEditorModifiedUri = multiDiffEditorModifiedUri;
    }
    open(preserveFocus) {
        return this.proxy.$executeResourceCommand(this.sourceControlHandle, this.groupHandle, this.handle, preserveFocus);
    }
    toJSON() {
        return {
            $mid: 3 /* MarshalledId.ScmResource */,
            sourceControlHandle: this.sourceControlHandle,
            groupHandle: this.groupHandle,
            handle: this.handle
        };
    }
}
class MainThreadSCMArtifactProvider {
    constructor(proxy, handle) {
        this.proxy = proxy;
        this.handle = handle;
        this._onDidChangeArtifacts = new Emitter();
        this.onDidChangeArtifacts = this._onDidChangeArtifacts.event;
        this._disposables = new DisposableStore();
        this._disposables.add(this._onDidChangeArtifacts);
    }
    async provideArtifactGroups(token) {
        const artifactGroups = await this.proxy.$provideArtifactGroups(this.handle, token ?? CancellationToken.None);
        return artifactGroups?.map(group => ({ ...group, icon: getIconFromIconDto(group.icon) }));
    }
    async provideArtifacts(group, token) {
        const artifacts = await this.proxy.$provideArtifacts(this.handle, group, token ?? CancellationToken.None);
        return artifacts?.map(artifact => ({ ...artifact, icon: getIconFromIconDto(artifact.icon) }));
    }
    $onDidChangeArtifacts(groups) {
        this._onDidChangeArtifacts.fire(groups);
    }
    dispose() {
        this._disposables.dispose();
    }
}
class MainThreadSCMHistoryProvider {
    get historyItemRef() { return this._historyItemRef; }
    get historyItemRemoteRef() { return this._historyItemRemoteRef; }
    get historyItemBaseRef() { return this._historyItemBaseRef; }
    get historyItemRefChanges() { return this._historyItemRefChanges; }
    constructor(proxy, handle) {
        this.proxy = proxy;
        this.handle = handle;
        this._historyItemRef = observableValueOpts({
            owner: this,
            equalsFn: structuralEquals
        }, undefined);
        this._historyItemRemoteRef = observableValueOpts({
            owner: this,
            equalsFn: structuralEquals
        }, undefined);
        this._historyItemBaseRef = observableValueOpts({
            owner: this,
            equalsFn: structuralEquals
        }, undefined);
        this._historyItemRefChanges = observableValue(this, { added: [], modified: [], removed: [], silent: false });
    }
    async resolveHistoryItem(historyItemId, token) {
        const historyItem = await this.proxy.$resolveHistoryItem(this.handle, historyItemId, token ?? CancellationToken.None);
        return historyItem ? toISCMHistoryItem(historyItem) : undefined;
    }
    async resolveHistoryItemChatContext(historyItemId, token) {
        return this.proxy.$resolveHistoryItemChatContext(this.handle, historyItemId, token ?? CancellationToken.None);
    }
    async resolveHistoryItemChangeRangeChatContext(historyItemId, historyItemParentId, path, token) {
        return this.proxy.$resolveHistoryItemChangeRangeChatContext(this.handle, historyItemId, historyItemParentId, path, token ?? CancellationToken.None);
    }
    async resolveHistoryItemRefsCommonAncestor(historyItemRefs, token) {
        return this.proxy.$resolveHistoryItemRefsCommonAncestor(this.handle, historyItemRefs, token ?? CancellationToken.None);
    }
    async provideHistoryItemRefs(historyItemsRefs, token) {
        const historyItemRefs = await this.proxy.$provideHistoryItemRefs(this.handle, historyItemsRefs, token ?? CancellationToken.None);
        return historyItemRefs?.map(ref => ({ ...ref, icon: getIconFromIconDto(ref.icon) }));
    }
    async provideHistoryItems(options, token) {
        const historyItems = await this.proxy.$provideHistoryItems(this.handle, options, token ?? CancellationToken.None);
        return historyItems?.map(historyItem => toISCMHistoryItem(historyItem));
    }
    async provideHistoryItemChanges(historyItemId, historyItemParentId, token) {
        const changes = await this.proxy.$provideHistoryItemChanges(this.handle, historyItemId, historyItemParentId, token ?? CancellationToken.None);
        return changes?.map(change => ({
            uri: URI.revive(change.uri),
            originalUri: change.originalUri && URI.revive(change.originalUri),
            modifiedUri: change.modifiedUri && URI.revive(change.modifiedUri)
        }));
    }
    $onDidChangeCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef) {
        transaction(tx => {
            this._historyItemRef.set(toISCMHistoryItemRef(historyItemRef, historyItemRefColor), tx);
            this._historyItemRemoteRef.set(toISCMHistoryItemRef(historyItemRemoteRef, historyItemRemoteRefColor), tx);
            this._historyItemBaseRef.set(toISCMHistoryItemRef(historyItemBaseRef, historyItemBaseRefColor), tx);
        });
    }
    $onDidChangeHistoryItemRefs(historyItemRefs) {
        const added = historyItemRefs.added.map(ref => toISCMHistoryItemRef(ref));
        const modified = historyItemRefs.modified.map(ref => toISCMHistoryItemRef(ref));
        const removed = historyItemRefs.removed.map(ref => toISCMHistoryItemRef(ref));
        this._historyItemRefChanges.set({ added, modified, removed, silent: historyItemRefs.silent }, undefined);
    }
}
class MainThreadSCMProvider {
    get id() { return `scm${this._handle}`; }
    get parentId() {
        return this._parentHandle !== undefined
            ? `scm${this._parentHandle}`
            : undefined;
    }
    get providerId() { return this._providerId; }
    get handle() { return this._handle; }
    get label() { return this._label; }
    get rootUri() { return this._rootUri; }
    get iconPath() { return this._iconPath; }
    get inputBoxTextModel() { return this._inputBoxTextModel; }
    get contextValue() { return this._contextValue; }
    get acceptInputCommand() { return this.features.acceptInputCommand; }
    get count() { return this._count; }
    get statusBarCommands() { return this._statusBarCommands; }
    get name() { return this._name ?? this._label; }
    get commitTemplate() { return this._commitTemplate; }
    get actionButton() { return this._actionButton; }
    get artifactProvider() { return this._artifactProvider; }
    get historyProvider() { return this._historyProvider; }
    constructor(proxy, _handle, _parentHandle, _providerId, _label, _rootUri, _iconPath, _inputBoxTextModel, _quickDiffService, _uriIdentService, _workspaceContextService) {
        this.proxy = proxy;
        this._handle = _handle;
        this._parentHandle = _parentHandle;
        this._providerId = _providerId;
        this._label = _label;
        this._rootUri = _rootUri;
        this._iconPath = _iconPath;
        this._inputBoxTextModel = _inputBoxTextModel;
        this._quickDiffService = _quickDiffService;
        this._uriIdentService = _uriIdentService;
        this._workspaceContextService = _workspaceContextService;
        this.groups = [];
        this._onDidChangeResourceGroups = new Emitter();
        this.onDidChangeResourceGroups = this._onDidChangeResourceGroups.event;
        this._onDidChangeResources = new Emitter();
        this.onDidChangeResources = this._onDidChangeResources.event;
        this._groupsByHandle = Object.create(null);
        // get groups(): ISequence<ISCMResourceGroup> {
        // 	return {
        // 		elements: this._groups,
        // 		onDidSplice: this._onDidSplice.event
        // 	};
        // 	// return this._groups
        // 	// 	.filter(g => g.resources.elements.length > 0 || !g.features.hideWhenEmpty);
        // }
        this.features = {};
        this._contextValue = observableValue(this, undefined);
        this._count = observableValue(this, undefined);
        this._statusBarCommands = observableValue(this, undefined);
        this._commitTemplate = observableValue(this, '');
        this._actionButton = observableValue(this, undefined);
        this._artifactProvider = observableValue(this, undefined);
        this._historyProvider = observableValue(this, undefined);
        if (_rootUri) {
            const folder = this._workspaceContextService.getWorkspaceFolder(_rootUri);
            if (folder?.uri.toString() === _rootUri.toString()) {
                this._name = folder.name;
            }
            else if (_rootUri.path !== '/') {
                this._name = basename(_rootUri);
            }
        }
    }
    $updateSourceControl(features) {
        this.features = { ...this.features, ...features };
        if (typeof features.commitTemplate !== 'undefined') {
            this._commitTemplate.set(features.commitTemplate, undefined);
        }
        if (typeof features.actionButton !== 'undefined') {
            this._actionButton.set(features.actionButton ?? undefined, undefined);
        }
        if (typeof features.contextValue !== 'undefined') {
            this._contextValue.set(features.contextValue, undefined);
        }
        if (typeof features.count !== 'undefined') {
            this._count.set(features.count, undefined);
        }
        if (typeof features.statusBarCommands !== 'undefined') {
            this._statusBarCommands.set(features.statusBarCommands, undefined);
        }
        if (features.hasQuickDiffProvider && !this._quickDiff) {
            this._quickDiff = this._quickDiffService.addQuickDiffProvider({
                id: `${this._providerId}.quickDiffProvider`,
                label: features.quickDiffLabel ?? this.label,
                rootUri: this.rootUri,
                kind: 'primary',
                getOriginalResource: async (uri) => {
                    if (!this.features.hasQuickDiffProvider) {
                        return null;
                    }
                    const result = await this.proxy.$provideOriginalResource(this.handle, uri, CancellationToken.None);
                    return result && URI.revive(result);
                }
            });
        }
        else if (features.hasQuickDiffProvider === false && this._quickDiff) {
            this._quickDiff.dispose();
            this._quickDiff = undefined;
        }
        if (features.hasSecondaryQuickDiffProvider && !this._stagedQuickDiff) {
            this._stagedQuickDiff = this._quickDiffService.addQuickDiffProvider({
                id: `${this._providerId}.secondaryQuickDiffProvider`,
                label: features.secondaryQuickDiffLabel ?? this.label,
                rootUri: this.rootUri,
                kind: 'secondary',
                getOriginalResource: async (uri) => {
                    if (!this.features.hasSecondaryQuickDiffProvider) {
                        return null;
                    }
                    const result = await this.proxy.$provideSecondaryOriginalResource(this.handle, uri, CancellationToken.None);
                    return result && URI.revive(result);
                }
            });
        }
        else if (features.hasSecondaryQuickDiffProvider === false && this._stagedQuickDiff) {
            this._stagedQuickDiff.dispose();
            this._stagedQuickDiff = undefined;
        }
        if (features.hasArtifactProvider && !this.artifactProvider.get()) {
            const artifactProvider = new MainThreadSCMArtifactProvider(this.proxy, this.handle);
            this._artifactProvider.set(artifactProvider, undefined);
        }
        else if (features.hasArtifactProvider === false && this.artifactProvider.get()) {
            this._artifactProvider.set(undefined, undefined);
        }
        if (features.hasHistoryProvider && !this.historyProvider.get()) {
            const historyProvider = new MainThreadSCMHistoryProvider(this.proxy, this.handle);
            this._historyProvider.set(historyProvider, undefined);
        }
        else if (features.hasHistoryProvider === false && this.historyProvider.get()) {
            this._historyProvider.set(undefined, undefined);
        }
    }
    $registerGroups(_groups) {
        const groups = _groups.map(([handle, id, label, features, multiDiffEditorEnableViewChanges]) => {
            const group = new MainThreadSCMResourceGroup(this.handle, handle, this, features, label, id, multiDiffEditorEnableViewChanges, this._uriIdentService);
            this._groupsByHandle[handle] = group;
            return group;
        });
        this.groups.splice(this.groups.length, 0, ...groups);
        this._onDidChangeResourceGroups.fire();
    }
    $updateGroup(handle, features) {
        const group = this._groupsByHandle[handle];
        if (!group) {
            return;
        }
        group.$updateGroup(features);
    }
    $updateGroupLabel(handle, label) {
        const group = this._groupsByHandle[handle];
        if (!group) {
            return;
        }
        group.$updateGroupLabel(label);
    }
    $spliceGroupResourceStates(splices) {
        for (const [groupHandle, groupSlices] of splices) {
            const group = this._groupsByHandle[groupHandle];
            if (!group) {
                console.warn(`SCM group ${groupHandle} not found in provider ${this.label}`);
                continue;
            }
            // reverse the splices sequence in order to apply them correctly
            groupSlices.reverse();
            for (const [start, deleteCount, rawResources] of groupSlices) {
                const resources = rawResources.map(rawResource => {
                    const [handle, sourceUri, icons, tooltip, strikeThrough, faded, contextValue, command, multiDiffEditorOriginalUri, multiDiffEditorModifiedUri] = rawResource;
                    const [light, dark] = icons;
                    const icon = ThemeIcon.isThemeIcon(light) ? light : URI.revive(light);
                    const iconDark = (ThemeIcon.isThemeIcon(dark) ? dark : URI.revive(dark)) || icon;
                    const decorations = {
                        icon: icon,
                        iconDark: iconDark,
                        tooltip,
                        strikeThrough,
                        faded
                    };
                    return new MainThreadSCMResource(this.proxy, this.handle, groupHandle, handle, URI.revive(sourceUri), group, decorations, contextValue || undefined, command, URI.revive(multiDiffEditorOriginalUri), URI.revive(multiDiffEditorModifiedUri));
                });
                group.splice(start, deleteCount, resources);
            }
        }
        this._onDidChangeResources.fire();
    }
    $unregisterGroup(handle) {
        const group = this._groupsByHandle[handle];
        if (!group) {
            return;
        }
        delete this._groupsByHandle[handle];
        this.groups.splice(this.groups.indexOf(group), 1);
        this._onDidChangeResourceGroups.fire();
    }
    async getOriginalResource(uri) {
        if (!this.features.hasQuickDiffProvider) {
            return null;
        }
        const result = await this.proxy.$provideOriginalResource(this.handle, uri, CancellationToken.None);
        return result && URI.revive(result);
    }
    $onDidChangeHistoryProviderCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef) {
        const provider = this.historyProvider.get();
        if (!provider) {
            return;
        }
        provider.$onDidChangeCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef);
    }
    $onDidChangeHistoryProviderHistoryItemRefs(historyItemRefs) {
        const provider = this.historyProvider.get();
        if (!provider) {
            return;
        }
        provider.$onDidChangeHistoryItemRefs(historyItemRefs);
    }
    $onDidChangeArtifacts(groups) {
        const provider = this.artifactProvider.get();
        if (!provider) {
            return;
        }
        provider.$onDidChangeArtifacts(groups);
    }
    toJSON() {
        return {
            $mid: 5 /* MarshalledId.ScmProvider */,
            handle: this.handle
        };
    }
    dispose() {
        this._stagedQuickDiff?.dispose();
        this._quickDiff?.dispose();
    }
}
let MainThreadSCM = class MainThreadSCM {
    constructor(extHostContext, scmService, scmViewService, languageService, modelService, textModelService, quickDiffService, _uriIdentService, workspaceContextService) {
        this.scmService = scmService;
        this.scmViewService = scmViewService;
        this.languageService = languageService;
        this.modelService = modelService;
        this.textModelService = textModelService;
        this.quickDiffService = quickDiffService;
        this._uriIdentService = _uriIdentService;
        this.workspaceContextService = workspaceContextService;
        this._repositories = new Map();
        this._repositoryBarriers = new Map();
        this._repositoryDisposables = new Map();
        this._disposables = new DisposableStore();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostSCM);
        this._disposables.add(new SCMInputBoxContentProvider(this.textModelService, this.modelService, this.languageService));
    }
    dispose() {
        dispose(this._repositories.values());
        this._repositories.clear();
        dispose(this._repositoryDisposables.values());
        this._repositoryDisposables.clear();
        this._disposables.dispose();
    }
    async $registerSourceControl(handle, parentHandle, id, label, rootUri, iconPath, inputBoxDocumentUri) {
        this._repositoryBarriers.set(handle, new Barrier());
        const inputBoxTextModelRef = await this.textModelService.createModelReference(URI.revive(inputBoxDocumentUri));
        const provider = new MainThreadSCMProvider(this._proxy, handle, parentHandle, id, label, rootUri ? URI.revive(rootUri) : undefined, getIconFromIconDto(iconPath), inputBoxTextModelRef.object.textEditorModel, this.quickDiffService, this._uriIdentService, this.workspaceContextService);
        const repository = this.scmService.registerSCMProvider(provider);
        this._repositories.set(handle, repository);
        const disposable = combinedDisposable(inputBoxTextModelRef, Event.filter(this.scmViewService.onDidFocusRepository, r => r === repository)(_ => this._proxy.$setSelectedSourceControl(handle)), repository.input.onDidChange(({ value }) => this._proxy.$onInputBoxValueChange(handle, value)));
        this._repositoryDisposables.set(handle, disposable);
        if (this.scmViewService.focusedRepository === repository) {
            setTimeout(() => this._proxy.$setSelectedSourceControl(handle), 0);
        }
        if (repository.input.value) {
            setTimeout(() => this._proxy.$onInputBoxValueChange(handle, repository.input.value), 0);
        }
        this._repositoryBarriers.get(handle)?.open();
    }
    async $updateSourceControl(handle, features) {
        await this._repositoryBarriers.get(handle)?.wait();
        const repository = this._repositories.get(handle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$updateSourceControl(features);
    }
    async $unregisterSourceControl(handle) {
        await this._repositoryBarriers.get(handle)?.wait();
        const repository = this._repositories.get(handle);
        if (!repository) {
            return;
        }
        this._repositoryDisposables.get(handle).dispose();
        this._repositoryDisposables.delete(handle);
        repository.dispose();
        this._repositories.delete(handle);
    }
    async $registerGroups(sourceControlHandle, groups, splices) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$registerGroups(groups);
        provider.$spliceGroupResourceStates(splices);
    }
    async $updateGroup(sourceControlHandle, groupHandle, features) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$updateGroup(groupHandle, features);
    }
    async $updateGroupLabel(sourceControlHandle, groupHandle, label) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$updateGroupLabel(groupHandle, label);
    }
    async $spliceResourceStates(sourceControlHandle, splices) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$spliceGroupResourceStates(splices);
    }
    async $unregisterGroup(sourceControlHandle, handle) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$unregisterGroup(handle);
    }
    async $setInputBoxValue(sourceControlHandle, value) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        repository.input.setValue(value, false);
    }
    async $setInputBoxPlaceholder(sourceControlHandle, placeholder) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        repository.input.placeholder = placeholder;
    }
    async $setInputBoxEnablement(sourceControlHandle, enabled) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        repository.input.enabled = enabled;
    }
    async $setInputBoxVisibility(sourceControlHandle, visible) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        repository.input.visible = visible;
    }
    async $showValidationMessage(sourceControlHandle, message, type) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        repository.input.showValidationMessage(message, type);
    }
    async $setValidationProviderIsEnabled(sourceControlHandle, enabled) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        if (enabled) {
            repository.input.validateInput = async (value, pos) => {
                const result = await this._proxy.$validateInput(sourceControlHandle, value, pos);
                return result && { message: result[0], type: result[1] };
            };
        }
        else {
            repository.input.validateInput = async () => undefined;
        }
    }
    async $onDidChangeHistoryProviderCurrentHistoryItemRefs(sourceControlHandle, historyItemRef, historyItemRemoteRef, historyItemBaseRef) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$onDidChangeHistoryProviderCurrentHistoryItemRefs(historyItemRef, historyItemRemoteRef, historyItemBaseRef);
    }
    async $onDidChangeHistoryProviderHistoryItemRefs(sourceControlHandle, historyItemRefs) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$onDidChangeHistoryProviderHistoryItemRefs(historyItemRefs);
    }
    async $onDidChangeArtifacts(sourceControlHandle, groups) {
        await this._repositoryBarriers.get(sourceControlHandle)?.wait();
        const repository = this._repositories.get(sourceControlHandle);
        if (!repository) {
            return;
        }
        const provider = repository.provider;
        provider.$onDidChangeArtifacts(groups);
    }
};
MainThreadSCM = __decorate([
    extHostNamedCustomer(MainContext.MainThreadSCM),
    __param(1, ISCMService),
    __param(2, ISCMViewService),
    __param(3, ILanguageService),
    __param(4, IModelService),
    __param(5, ITextModelService),
    __param(6, IQuickDiffService),
    __param(7, IUriIdentityService),
    __param(8, IWorkspaceContextService)
], MainThreadSCM);
export { MainThreadSCM };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZFNDTS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZFNDTS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDeEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxHQUFHLEVBQWlCLE1BQU0sNkJBQTZCLENBQUM7QUFDbEYsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQWUsZUFBZSxFQUFFLG1CQUFtQixFQUFFLFdBQVcsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3BILE9BQU8sRUFBZSxlQUFlLEVBQUUsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzFILE9BQU8sRUFBRSxXQUFXLEVBQTRHLGVBQWUsRUFBbUQsTUFBTSxpQ0FBaUMsQ0FBQztBQUMxTyxPQUFPLEVBQUUsY0FBYyxFQUFxRyxXQUFXLEVBQTZFLE1BQU0sK0JBQStCLENBQUM7QUFFMVAsT0FBTyxFQUFFLG9CQUFvQixFQUFtQixNQUFNLHNEQUFzRCxDQUFDO0FBQzdHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRXpFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUU5RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUUxRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDcEUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0scURBQXFELENBQUM7QUFDMUYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0saURBQWlELENBQUM7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