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
var ExtensionsListView_1;
import { localize } from '../../../../nls.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { Event, Emitter } from '../../../../base/common/event.js';
import { isCancellationError, getErrorMessage, CancellationError } from '../../../../base/common/errors.js';
import { PagedModel, DelayedPagedModel } from '../../../../base/common/paging.js';
import { ExtensionGalleryError } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { IExtensionManagementServerService, IWorkbenchExtensionManagementService, IWorkbenchExtensionEnablementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionRecommendationsService } from '../../../services/extensionRecommendations/common/extensionRecommendations.js';
import { areSameExtensions, getExtensionDependencies } from '../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { append, $ } from '../../../../base/browser/dom.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ExtensionResultsListFocused, IExtensionsWorkbenchService } from '../common/extensions.js';
import { Query } from '../common/extensionQuery.js';
import { IExtensionService, toExtension } from '../../../services/extensions/common/extensions.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { CountBadge } from '../../../../base/browser/ui/countBadge/countBadge.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { ViewPane, ViewPaneShowActions } from '../../../browser/parts/views/viewPane.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { coalesce, distinct, range } from '../../../../base/common/arrays.js';
import { alert } from '../../../../base/browser/ui/aria/aria.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { ActionRunner } from '../../../../base/common/actions.js';
import { ExtensionIdentifier, ExtensionIdentifierMap, isLanguagePackExtension } from '../../../../platform/extensions/common/extensions.js';
import { createCancelablePromise, ThrottledDelayer } from '../../../../base/common/async.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { SeverityIcon } from '../../../../base/browser/ui/severityIcon/severityIcon.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IExtensionManifestPropertiesService } from '../../../services/extensions/common/extensionManifestPropertiesService.js';
import { isVirtualWorkspace } from '../../../../platform/workspace/common/virtualWorkspace.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { isOfflineError } from '../../../../base/parts/request/common/request.js';
import { defaultCountBadgeStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions, IExtensionFeaturesManagementService } from '../../../services/extensionManagement/common/extensionFeatures.js';
import { isString } from '../../../../base/common/types.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { ExtensionsList } from './extensionsViewer.js';
export const NONE_CATEGORY = 'none';
class ExtensionsViewState extends Disposable {
    constructor() {
        super(...arguments);
        this._onFocus = this._register(new Emitter());
        this.onFocus = this._onFocus.event;
        this._onBlur = this._register(new Emitter());
        this.onBlur = this._onBlur.event;
        this.currentlyFocusedItems = [];
        this.filters = {};
    }
    onFocusChange(extensions) {
        this.currentlyFocusedItems.forEach(extension => this._onBlur.fire(extension));
        this.currentlyFocusedItems = extensions;
        this.currentlyFocusedItems.forEach(extension => this._onFocus.fire(extension));
    }
}
var LocalSortBy;
(function (LocalSortBy) {
    LocalSortBy["UpdateDate"] = "UpdateDate";
})(LocalSortBy || (LocalSortBy = {}));
function isLocalSortBy(value) {
    switch (value) {
        case "UpdateDate" /* LocalSortBy.UpdateDate */: return true;
    }
}
export class AbstractExtensionsListView extends ViewPane {
}
let ExtensionsListView = class ExtensionsListView extends AbstractExtensionsListView {
    static { ExtensionsListView_1 = this; }
    static { this.RECENT_UPDATE_DURATION = 7 * 24 * 60 * 60 * 1000; } // 7 days
    constructor(options, viewletViewOptions, notificationService, keybindingService, contextMenuService, instantiationService, themeService, extensionService, extensionsWorkbenchService, extensionRecommendationsService, telemetryService, hoverService, configurationService, contextService, extensionManagementServerService, extensionManifestPropertiesService, extensionManagementService, workspaceService, productService, contextKeyService, viewDescriptorService, openerService, storageService, workspaceTrustManagementService, extensionEnablementService, extensionFeaturesManagementService, uriIdentityService, logService) {
        super({
            ...viewletViewOptions,
            showActions: ViewPaneShowActions.Always,
            maximumBodySize: options.flexibleHeight ? (storageService.getNumber(`${viewletViewOptions.id}.size`, 0 /* StorageScope.PROFILE */, 0) ? undefined : 0) : undefined
        }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this.options = options;
        this.notificationService = notificationService;
        this.extensionService = extensionService;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.extensionRecommendationsService = extensionRecommendationsService;
        this.telemetryService = telemetryService;
        this.contextService = contextService;
        this.extensionManagementServerService = extensionManagementServerService;
        this.extensionManifestPropertiesService = extensionManifestPropertiesService;
        this.extensionManagementService = extensionManagementService;
        this.workspaceService = workspaceService;
        this.productService = productService;
        this.storageService = storageService;
        this.workspaceTrustManagementService = workspaceTrustManagementService;
        this.extensionEnablementService = extensionEnablementService;
        this.extensionFeaturesManagementService = extensionFeaturesManagementService;
        this.uriIdentityService = uriIdentityService;
        this.logService = logService;
        this.list = null;
        this.queryRequest = null;
        this.contextMenuActionRunner = this._register(new ActionRunner());
        if (this.options.onDidChangeTitle) {
            this._register(this.options.onDidChangeTitle(title => this.updateTitle(title)));
        }
        this._register(this.contextMenuActionRunner.onDidRun(({ error }) => error && this.notificationService.error(error)));
        this.registerActions();
    }
    registerActions() { }
    renderHeader(container) {
        container.classList.add('extension-view-header');
        super.renderHeader(container);
        if (!this.options.hideBadge) {
            this.badge = this._register(new CountBadge(append(container, $('.count-badge-wrapper')), {}, defaultCountBadgeStyles));
        }
    }
    renderBody(container) {
        super.renderBody(container);
        const messageContainer = append(container, $('.message-container'));
        const messageSeverityIcon = append(messageContainer, $(''));
        const messageBox = append(messageContainer, $('.message'));
        const extensionsList = append(container, $('.extensions-list'));
        this.extensionsViewState = this._register(new ExtensionsViewState());
        this.list = this._register(this.instantiationService.createInstance(ExtensionsList, extensionsList, this.id, {}, this.extensionsViewState)).list;
        ExtensionResultsListFocused.bindTo(this.list.contextKeyService);
        this._register(this.list.onDidChangeFocus(e => this.extensionsViewState?.onFocusChange(coalesce(e.elements)), this));
        this.bodyTemplate = {
            extensionsList,
            messageBox,
            messageContainer,
            messageSeverityIcon
        };
        if (this.queryResult) {
            this.setModel(this.queryResult.model);
        }
    }
    layoutBody(height, width) {
        super.layoutBody(height, width);
        if (this.bodyTemplate) {
            this.bodyTemplate.extensionsList.style.height = height + 'px';
        }
        this.list?.layout(height, width);
    }
    async show(query, refresh) {
        if (this.queryRequest) {
            if (!refresh && this.queryRequest.query === query) {
                return this.queryRequest.request;
            }
            this.queryRequest.request.cancel();
            this.queryRequest = null;
        }
        if (this.queryResult) {
            this.queryResult.disposables.dispose();
            this.queryResult = undefined;
            if (this.extensionsViewState) {
                this.extensionsViewState.filters = {};
            }
        }
        const parsedQuery = Query.parse(query);
        const options = {
            sortOrder: 0 /* SortOrder.Default */
        };
        switch (parsedQuery.sortBy) {
            case 'installs':
                options.sortBy = "InstallCount" /* GallerySortBy.InstallCount */;
                break;
            case 'rating':
                options.sortBy = "WeightedRating" /* GallerySortBy.WeightedRating */;
                break;
            case 'name':
                options.sortBy = "Title" /* GallerySortBy.Title */;
                break;
            case 'publishedDate':
                options.sortBy = "PublishedDate" /* GallerySortBy.PublishedDate */;
                break;
            case 'updateDate':
                options.sortBy = "UpdateDate" /* LocalSortBy.UpdateDate */;
                break;
        }
        const request = createCancelablePromise(async (token) => {
            try {
                this.queryResult = await this.query(parsedQuery, options, token);
                const model = this.queryResult.model;
                this.setModel(model, this.queryResult.message);
                if (this.queryResult.onDidChangeModel) {
                    this.queryResult.disposables.add(this.queryResult.onDidChangeModel(model => {
                        if (this.queryResult) {
                            this.queryResult.model = model;
                            this.updateModel(model);
                        }
                    }));
                }
                return model;
            }
            catch (e) {
                const model = new PagedModel([]);
                if (!isCancellationError(e)) {
                    this.logService.error(e);
                    this.setModel(model, this.getMessage(e));
                }
                return this.list ? this.list.model : model;
            }
        });
        request.finally(() => this.queryRequest = null);
        this.queryRequest = { query, request };
        return request;
    }
    count() {
        return this.queryResult?.model.length ?? 0;
    }
    showEmptyModel() {
        const emptyModel = new PagedModel([]);
        this.setModel(emptyModel);
        return Promise.resolve(emptyModel);
    }
    async query(query, options, token) {
        const idRegex = /@id:(([a-z0-9A-Z][a-z0-9\-A-Z]*)\.([a-z0-9A-Z][a-z0-9\-A-Z]*))/g;
        const ids = [];
        let idMatch;
        while ((idMatch = idRegex.exec(query.value)) !== null) {
            const name = idMatch[1];
            ids.push(name);
        }
        if (ids.length) {
            const model = await this.queryByIds(ids, options, token);
            return { model, disposables: new DisposableStore() };
        }
        if (ExtensionsListView_1.isLocalExtensionsQuery(query.value, query.sortBy)) {
            return this.queryLocal(query, options);
        }
        if (ExtensionsListView_1.isSearchPopularQuery(query.value)) {
            query.value = query.value.replace('@popular', '');
            options.sortBy = !options.sortBy ? "InstallCount" /* GallerySortBy.InstallCount */ : options.sortBy;
        }
        else if (ExtensionsListView_1.isSearchRecentlyPublishedQuery(query.value)) {
            query.value = query.value.replace('@recentlyPublished', '');
            options.sortBy = !options.sortBy ? "PublishedDate" /* GallerySortBy.PublishedDate */ : options.sortBy;
        }
        const galleryQueryOptions = { ...options, sortBy: isLocalSortBy(options.sortBy) ? undefined : options.sortBy };
        return this.queryGallery(query, galleryQueryOptions, token);
    }
    async queryByIds(ids, options, token) {
        const idsSet = ids.reduce((result, id) => { result.add(id.toLowerCase()); return result; }, new Set());
        const result = (await this.extensionsWorkbenchService.queryLocal(this.options.server))
            .filter(e => idsSet.has(e.identifier.id.toLowerCase()));
        const galleryIds = result.length ? ids.filter(id => result.every(r => !areSameExtensions(r.identifier, { id }))) : ids;
        if (galleryIds.length) {
            const galleryResult = await this.extensionsWorkbenchService.getExtensions(galleryIds.map(id => ({ id })), { source: 'queryById' }, token);
            result.push(...galleryResult);
        }
        return new PagedModel(result);
    }
    async queryLocal(query, options) {
        const local = await this.extensionsWorkbenchService.queryLocal(this.options.server);
        let { extensions, canIncludeInstalledExtensions, description } = await this.filterLocal(local, this.extensionService.extensions, query, options);
        const disposables = new DisposableStore();
        const onDidChangeModel = disposables.add(new Emitter());
        if (canIncludeInstalledExtensions) {
            let isDisposed = false;
            disposables.add(toDisposable(() => isDisposed = true));
            disposables.add(Event.debounce(Event.any(Event.filter(this.extensionsWorkbenchService.onChange, e => e?.state === 1 /* ExtensionState.Installed */), this.extensionService.onDidChangeExtensions), () => undefined)(async () => {
                const local = this.options.server ? this.extensionsWorkbenchService.installed.filter(e => e.server === this.options.server) : this.extensionsWorkbenchService.local;
                const { extensions: newExtensions } = await this.filterLocal(local, this.extensionService.extensions, query, options);
                if (!isDisposed) {
                    const mergedExtensions = this.mergeAddedExtensions(extensions, newExtensions);
                    if (mergedExtensions) {
                        extensions = mergedExtensions;
                        onDidChangeModel.fire(new PagedModel(extensions));
                    }
                }
            }));
        }
        return {
            model: new PagedModel(extensions),
            message: description ? { text: description, severity: Severity.Info } : undefined,
            onDidChangeModel: onDidChangeModel.event,
            disposables
        };
    }
    async filterLocal(local, runningExtensions, query, options) {
        const value = query.value;
        let extensions = [];
        let description;
        const includeBuiltin = /@builtin/i.test(value);
        const canIncludeInstalledExtensions = !includeBuiltin;
        if (/@installed/i.test(value)) {
            extensions = this.filterInstalledExtensions(local, runningExtensions, query, options);
        }
        else if (/@outdated/i.test(value)) {
            extensions = this.filterOutdatedExtensions(local, query, options);
        }
        else if (/@disabled/i.test(value)) {
            extensions = this.filterDisabledExtensions(local, runningExtensions, query, options, includeBuiltin);
        }
        else if (/@enabled/i.test(value)) {
            extensions = this.filterEnabledExtensions(local, runningExtensions, query, options, includeBuiltin);
        }
        else if (/@workspaceUnsupported/i.test(value)) {
            extensions = this.filterWorkspaceUnsupportedExtensions(local, query, options);
        }
        else if (/@deprecated/i.test(query.value)) {
            extensions = await this.filterDeprecatedExtensions(local, query, options);
        }
        else if (/@recentlyUpdated/i.test(query.value)) {
            extensions = this.filterRecentlyUpdatedExtensions(local, query, options);
        }
        else if (/@feature:/i.test(query.value)) {
            const result = this.filterExtensionsByFeature(local, query);
            if (result) {
                extensions = result.extensions;
                description = result.description;
            }
        }
        else if (includeBuiltin) {
            extensions = this.filterBuiltinExtensions(local, query, options);
        }
        return { extensions, canIncludeInstalledExtensions, description };
    }
    filterBuiltinExtensions(local, query, options) {
        let { value, includedCategories, excludedCategories } = this.parseCategories(query.value);
        value = value.replaceAll(/@builtin/gi, '').replaceAll(/@sort:(\w+)(-\w*)?/g, '').trim().toLowerCase();
        const result = local
            .filter(e => e.isBuiltin && (e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1)
            && this.filterExtensionByCategory(e, includedCategories, excludedCategories));
        return this.sortExtensions(result, options);
    }
    filterExtensionByCategory(e, includedCategories, excludedCategories) {
        if (!includedCategories.length && !excludedCategories.length) {
            return true;
        }
        if (e.categories.length) {
            if (excludedCategories.length && e.categories.some(category => excludedCategories.includes(category.toLowerCase()))) {
                return false;
            }
            return e.categories.some(category => includedCategories.includes(category.toLowerCase()));
        }
        else {
            return includedCategories.includes(NONE_CATEGORY);
        }
    }
    parseCategories(value) {
        const includedCategories = [];
        const excludedCategories = [];
        value = value.replace(/\bcategory:("([^"]*)"|([^"]\S*))(\s+|\b|$)/g, (_, quotedCategory, category) => {
            const entry = (category || quotedCategory || '').toLowerCase();
            if (entry.startsWith('-')) {
                if (excludedCategories.indexOf(entry) === -1) {
                    excludedCategories.push(entry);
                }
            }
            else {
                if (includedCategories.indexOf(entry) === -1) {
                    includedCategories.push(entry);
                }
            }
            return '';
        });
        return { value, includedCategories, excludedCategories };
    }
    filterInstalledExtensions(local, runningExtensions, query, options) {
        let { value, includedCategories, excludedCategories } = this.parseCategories(query.value);
        value = value.replace(/@installed/g, '').replace(/@sort:(\w+)(-\w*)?/g, '').trim().toLowerCase();
        const matchingText = (e) => (e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1 || e.description.toLowerCase().indexOf(value) > -1)
            && this.filterExtensionByCategory(e, includedCategories, excludedCategories);
        let result;
        if (options.sortBy !== undefined) {
            result = local.filter(e => !e.isBuiltin && matchingText(e));
            result = this.sortExtensions(result, options);
        }
        else {
            result = local.filter(e => (!e.isBuiltin || e.outdated || e.runtimeState !== undefined) && matchingText(e));
            const runningExtensionsById = runningExtensions.reduce((result, e) => { result.set(e.identifier.value, e); return result; }, new ExtensionIdentifierMap());
            const defaultSort = (e1, e2) => {
                const running1 = runningExtensionsById.get(e1.identifier.id);
                const isE1Running = !!running1 && this.extensionManagementServerService.getExtensionManagementServer(toExtension(running1)) === e1.server;
                const running2 = runningExtensionsById.get(e2.identifier.id);
                const isE2Running = running2 && this.extensionManagementServerService.getExtensionManagementServer(toExtension(running2)) === e2.server;
                if ((isE1Running && isE2Running)) {
                    return e1.displayName.localeCompare(e2.displayName);
                }
                const isE1LanguagePackExtension = e1.local && isLanguagePackExtension(e1.local.manifest);
                const isE2LanguagePackExtension = e2.local && isLanguagePackExtension(e2.local.manifest);
                if (!isE1Running && !isE2Running) {
                    if (isE1LanguagePackExtension) {
                        return -1;
                    }
                    if (isE2LanguagePackExtension) {
                        return 1;
                    }
                    return e1.displayName.localeCompare(e2.displayName);
                }
                if ((isE1Running && isE2LanguagePackExtension) || (isE2Running && isE1LanguagePackExtension)) {
                    return e1.displayName.localeCompare(e2.displayName);
                }
                return isE1Running ? -1 : 1;
            };
            const incompatible = [];
            const deprecated = [];
            const outdated = [];
            const actionRequired = [];
            const noActionRequired = [];
            for (const e of result) {
                if (e.enablementState === 6 /* EnablementState.DisabledByInvalidExtension */) {
                    incompatible.push(e);
                }
                else if (e.deprecationInfo) {
                    deprecated.push(e);
                }
                else if (e.outdated && this.extensionEnablementService.isEnabledEnablementState(e.enablementState)) {
                    outdated.push(e);
                }
                else if (e.runtimeState) {
                    actionRequired.push(e);
                }
                else {
                    noActionRequired.push(e);
                }
            }
            result = [
                ...incompatible.sort(defaultSort),
                ...deprecated.sort(defaultSort),
                ...outdated.sort(defaultSort),
                ...actionRequired.sort(defaultSort),
                ...noActionRequired.sort(defaultSort)
            ];
        }
        return result;
    }
    filterOutdatedExtensions(local, query, options) {
        let { value, includedCategories, excludedCategories } = this.parseCategories(query.value);
        value = value.replace(/@outdated/g, '').replace(/@sort:(\w+)(-\w*)?/g, '').trim().toLowerCase();
        const result = local
            .sort((e1, e2) => e1.displayName.localeCompare(e2.displayName))
            .filter(extension => extension.outdated
            && (extension.name.toLowerCase().indexOf(value) > -1 || extension.displayName.toLowerCase().indexOf(value) > -1)
            && this.filterExtensionByCategory(extension, includedCategories, excludedCategories));
        return this.sortExtensions(result, options);
    }
    filterDisabledExtensions(local, runningExtensions, query, options, includeBuiltin) {
        let { value, includedCategories, excludedCategories } = this.parseCategories(query.value);
        value = value.replaceAll(/@disabled|@builtin/gi, '').replaceAll(/@sort:(\w+)(-\w*)?/g, '').trim().toLowerCase();
        if (includeBuiltin) {
            local = local.filter(e => e.isBuiltin);
        }
        const result = local
            .sort((e1, e2) => e1.displayName.localeCompare(e2.displayName))
            .filter(e => runningExtensions.every(r => !areSameExtensions({ id: r.identifier.value, uuid: r.uuid }, e.identifier))
            && (e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1)
            && this.filterExtensionByCategory(e, includedCategories, excludedCategories));
        return this.sortExtensions(result, options);
    }
    filterEnabledExtensions(local, runningExtensions, query, options, includeBuiltin) {
        let { value, includedCategories, excludedCategories } = this.parseCategories(query.value);
        value = value ? value.replaceAll(/@enabled|@builtin/gi, '').replaceAll(/@sort:(\w+)(-\w*)?/g, '').trim().toLowerCase() : '';
        local = local.filter(e => e.isBuiltin === includeBuiltin);
        const result = local
            .sort((e1, e2) => e1.displayName.localeCompare(e2.displayName))
            .filter(e => runningExtensions.some(r => areSameExtensions({ id: r.identifier.value, uuid: r.uuid }, e.identifier))
            && (e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1)
            && this.filterExtensionByCategory(e, includedCategories, excludedCategories));
        return this.sortExtensions(result, options);
    }
    filterWorkspaceUnsupportedExtensions(local, query, options) {
        // shows local extensions which are restricted or disabled in the current workspace because of the extension's capability
        const queryString = query.value; // @sortby is already filtered out
        const match = queryString.match(/^\s*@workspaceUnsupported(?::(untrusted|virtual)(Partial)?)?(?:\s+([^\s]*))?/i);
        if (!match) {
            return [];
        }
        const type = match[1]?.toLowerCase();
        const partial = !!match[2];
        const nameFilter = match[3]?.toLowerCase();
        if (nameFilter) {
            local = local.filter(extension => extension.name.toLowerCase().indexOf(nameFilter) > -1 || extension.displayName.toLowerCase().indexOf(nameFilter) > -1);
        }
        const hasVirtualSupportType = (extension, supportType) => {
            return extension.local && this.extensionManifestPropertiesService.getExtensionVirtualWorkspaceSupportType(extension.local.manifest) === supportType;
        };
        const hasRestrictedSupportType = (extension, supportType) => {
            if (!extension.local) {
                return false;
            }
            const enablementState = this.extensionEnablementService.getEnablementState(extension.local);
            if (enablementState !== 12 /* EnablementState.EnabledGlobally */ && enablementState !== 13 /* EnablementState.EnabledWorkspace */ &&
                enablementState !== 0 /* EnablementState.DisabledByTrustRequirement */ && enablementState !== 8 /* EnablementState.DisabledByExtensionDependency */) {
                return false;
            }
            if (this.extensionManifestPropertiesService.getExtensionUntrustedWorkspaceSupportType(extension.local.manifest) === supportType) {
                return true;
            }
            if (supportType === false) {
                const dependencies = getExtensionDependencies(local.map(ext => ext.local), extension.local);
                return dependencies.some(ext => this.extensionManifestPropertiesService.getExtensionUntrustedWorkspaceSupportType(ext.manifest) === supportType);
            }
            return false;
        };
        const inVirtualWorkspace = isVirtualWorkspace(this.workspaceService.getWorkspace());
        const inRestrictedWorkspace = !this.workspaceTrustManagementService.isWorkspaceTrusted();
        if (type === 'virtual') {
            // show limited and disabled extensions unless disabled because of a untrusted workspace
            local = local.filter(extension => inVirtualWorkspace && hasVirtualSupportType(extension, partial ? 'limited' : false) && !(inRestrictedWorkspace && hasRestrictedSupportType(extension, false)));
        }
        else if (type === 'untrusted') {
            // show limited and disabled extensions unless disabled because of a virtual workspace
            local = local.filter(extension => hasRestrictedSupportType(extension, partial ? 'limited' : false) && !(inVirtualWorkspace && hasVirtualSupportType(extension, false)));
        }
        else {
            // show extensions that are restricted or disabled in the current workspace
            local = local.filter(extension => inVirtualWorkspace && !hasVirtualSupportType(extension, true) || inRestrictedWorkspace && !hasRestrictedSupportType(extension, true));
        }
        return this.sortExtensions(local, options);
    }
    async filterDeprecatedExtensions(local, query, options) {
        const value = query.value.replace(/@deprecated/g, '').replace(/@sort:(\w+)(-\w*)?/g, '').trim().toLowerCase();
        const extensionsControlManifest = await this.extensionManagementService.getExtensionsControlManifest();
        const deprecatedExtensionIds = Object.keys(extensionsControlManifest.deprecated);
        local = local.filter(e => deprecatedExtensionIds.includes(e.identifier.id) && (!value || e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1));
        return this.sortExtensions(local, options);
    }
    filterRecentlyUpdatedExtensions(local, query, options) {
        let { value, includedCategories, excludedCategories } = this.parseCategories(query.value);
        const currentTime = Date.now();
        local = local.filter(e => !e.isBuiltin && !e.outdated && e.local?.updated && e.local?.installedTimestamp !== undefined && currentTime - e.local.installedTimestamp < ExtensionsListView_1.RECENT_UPDATE_DURATION);
        value = value.replace(/@recentlyUpdated/g, '').replace(/@sort:(\w+)(-\w*)?/g, '').trim().toLowerCase();
        const result = local.filter(e => (e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1)
            && this.filterExtensionByCategory(e, includedCategories, excludedCategories));
        options.sortBy = options.sortBy ?? "UpdateDate" /* LocalSortBy.UpdateDate */;
        return this.sortExtensions(result, options);
    }
    filterExtensionsByFeature(local, query) {
        const value = query.value.replace(/@feature:/g, '').trim();
        const featureId = value.split(' ')[0];
        const feature = Registry.as(Extensions.ExtensionFeaturesRegistry).getExtensionFeature(featureId);
        if (!feature) {
            return undefined;
        }
        if (this.extensionsViewState) {
            this.extensionsViewState.filters.featureId = featureId;
        }
        const renderer = feature.renderer ? this.instantiationService.createInstance(feature.renderer) : undefined;
        try {
            const result = [];
            for (const e of local) {
                if (!e.local) {
                    continue;
                }
                const accessData = this.extensionFeaturesManagementService.getAccessData(new ExtensionIdentifier(e.identifier.id), featureId);
                const shouldRender = renderer?.shouldRender(e.local.manifest);
                if (accessData || shouldRender) {
                    result.push([e, accessData?.accessTimes.length ?? 0]);
                }
            }
            return {
                extensions: result.sort(([, a], [, b]) => b - a).map(([e]) => e),
                description: localize('showingExtensionsForFeature', "Extensions using {0} in the last 30 days", feature.label)
            };
        }
        finally {
            renderer?.dispose();
        }
    }
    mergeAddedExtensions(extensions, newExtensions) {
        const oldExtensions = [...extensions];
        const findPreviousExtensionIndex = (from) => {
            let index = -1;
            const previousExtensionInNew = newExtensions[from];
            if (previousExtensionInNew) {
                index = oldExtensions.findIndex(e => areSameExtensions(e.identifier, previousExtensionInNew.identifier));
                if (index === -1) {
                    return findPreviousExtensionIndex(from - 1);
                }
            }
            return index;
        };
        let hasChanged = false;
        for (let index = 0; index < newExtensions.length; index++) {
            const extension = newExtensions[index];
            if (extensions.every(r => !areSameExtensions(r.identifier, extension.identifier))) {
                hasChanged = true;
                extensions.splice(findPreviousExtensionIndex(index - 1) + 1, 0, extension);
            }
        }
        return hasChanged ? extensions : undefined;
    }
    async queryGallery(query, options, token) {
        const hasUserDefinedSortOrder = options.sortBy !== undefined;
        if (!hasUserDefinedSortOrder && !query.value.trim()) {
            options.sortBy = "InstallCount" /* GallerySortBy.InstallCount */;
        }
        if (this.isRecommendationsQuery(query)) {
            const model = await this.queryRecommendations(query, options, token);
            return { model, disposables: new DisposableStore() };
        }
        const text = query.value;
        if (!text) {
            options.source = 'viewlet';
            const pager = await this.extensionsWorkbenchService.queryGallery(options, token);
            return { model: new PagedModel(pager), disposables: new DisposableStore() };
        }
        if (/\bext:([^\s]+)\b/g.test(text)) {
            options.text = text;
            options.source = 'file-extension-tags';
            const pager = await this.extensionsWorkbenchService.queryGallery(options, token);
            return { model: new PagedModel(pager), disposables: new DisposableStore() };
        }
        options.text = text.substring(0, 350);
        options.source = 'searchText';
        if (hasUserDefinedSortOrder || /\b(category|tag):([^\s]+)\b/gi.test(text) || /\bfeatured(\s+|\b|$)/gi.test(text)) {
            const pager = await this.extensionsWorkbenchService.queryGallery(options, token);
            return { model: new PagedModel(pager), disposables: new DisposableStore() };
        }
        try {
            const [pager, preferredExtensions] = await Promise.all([
                this.extensionsWorkbenchService.queryGallery(options, token),
                this.getPreferredExtensions(options.text.toLowerCase(), token).catch(() => [])
            ]);
            const model = preferredExtensions.length ? new PreferredExtensionsPagedModel(preferredExtensions, pager) : new PagedModel(pager);
            return { model, disposables: new DisposableStore() };
        }
        catch (error) {
            if (isCancellationError(error)) {
                throw error;
            }
            if (!(error instanceof ExtensionGalleryError)) {
                throw error;
            }
            const searchText = options.text.toLowerCase();
            const localExtensions = this.extensionsWorkbenchService.local.filter(e => !e.isBuiltin && (e.name.toLowerCase().indexOf(searchText) > -1 || e.displayName.toLowerCase().indexOf(searchText) > -1 || e.description.toLowerCase().indexOf(searchText) > -1));
            if (localExtensions.length) {
                const message = this.getMessage(error);
                return { model: new PagedModel(localExtensions), disposables: new DisposableStore(), message: { text: localize('showing local extensions only', "{0} Showing local extensions.", message.text), severity: message.severity } };
            }
            throw error;
        }
    }
    async getPreferredExtensions(searchText, token) {
        const preferredExtensions = this.extensionsWorkbenchService.local.filter(e => !e.isBuiltin && (e.name.toLowerCase().indexOf(searchText) > -1 || e.displayName.toLowerCase().indexOf(searchText) > -1 || e.description.toLowerCase().indexOf(searchText) > -1));
        const preferredExtensionUUIDs = new Set();
        if (preferredExtensions.length) {
            // Update gallery data for preferred extensions if they are not yet fetched
            const extesionsToFetch = [];
            for (const extension of preferredExtensions) {
                if (extension.identifier.uuid) {
                    preferredExtensionUUIDs.add(extension.identifier.uuid);
                }
                if (!extension.gallery && extension.identifier.uuid) {
                    extesionsToFetch.push(extension.identifier);
                }
            }
            if (extesionsToFetch.length) {
                this.extensionsWorkbenchService.getExtensions(extesionsToFetch, CancellationToken.None).catch(e => null /*ignore error*/);
            }
        }
        const preferredResults = [];
        try {
            const manifest = await this.extensionManagementService.getExtensionsControlManifest();
            if (Array.isArray(manifest.search)) {
                for (const s of manifest.search) {
                    if (s.query && s.query.toLowerCase() === searchText && Array.isArray(s.preferredResults)) {
                        preferredResults.push(...s.preferredResults);
                        break;
                    }
                }
            }
            if (preferredResults.length) {
                const result = await this.extensionsWorkbenchService.getExtensions(preferredResults.map(id => ({ id })), token);
                for (const extension of result) {
                    if (extension.identifier.uuid && !preferredExtensionUUIDs.has(extension.identifier.uuid)) {
                        preferredExtensions.push(extension);
                    }
                }
            }
        }
        catch (e) {
            this.logService.warn('Failed to get preferred results from the extensions control manifest.', e);
        }
        return preferredExtensions;
    }
    sortExtensions(extensions, options) {
        switch (options.sortBy) {
            case "InstallCount" /* GallerySortBy.InstallCount */:
                extensions = extensions.sort((e1, e2) => typeof e2.installCount === 'number' && typeof e1.installCount === 'number' ? e2.installCount - e1.installCount : NaN);
                break;
            case "UpdateDate" /* LocalSortBy.UpdateDate */:
                extensions = extensions.sort((e1, e2) => typeof e2.local?.installedTimestamp === 'number' && typeof e1.local?.installedTimestamp === 'number' ? e2.local.installedTimestamp - e1.local.installedTimestamp :
                    typeof e2.local?.installedTimestamp === 'number' ? 1 :
                        typeof e1.local?.installedTimestamp === 'number' ? -1 : NaN);
                break;
            case "AverageRating" /* GallerySortBy.AverageRating */:
            case "WeightedRating" /* GallerySortBy.WeightedRating */:
                extensions = extensions.sort((e1, e2) => typeof e2.rating === 'number' && typeof e1.rating === 'number' ? e2.rating - e1.rating : NaN);
                break;
            default:
                extensions = extensions.sort((e1, e2) => e1.displayName.localeCompare(e2.displayName));
                break;
        }
        if (options.sortOrder === 2 /* SortOrder.Descending */) {
            extensions = extensions.reverse();
        }
        return extensions;
    }
    isRecommendationsQuery(query) {
        return ExtensionsListView_1.isWorkspaceRecommendedExtensionsQuery(query.value)
            || ExtensionsListView_1.isKeymapsRecommendedExtensionsQuery(query.value)
            || ExtensionsListView_1.isLanguageRecommendedExtensionsQuery(query.value)
            || ExtensionsListView_1.isExeRecommendedExtensionsQuery(query.value)
            || ExtensionsListView_1.isRemoteRecommendedExtensionsQuery(query.value)
            || /@recommended:all/i.test(query.value)
            || ExtensionsListView_1.isSearchRecommendedExtensionsQuery(query.value)
            || ExtensionsListView_1.isRecommendedExtensionsQuery(query.value);
    }
    async queryRecommendations(query, options, token) {
        // Workspace recommendations
        if (ExtensionsListView_1.isWorkspaceRecommendedExtensionsQuery(query.value)) {
            return this.getWorkspaceRecommendationsModel(query, options, token);
        }
        // Keymap recommendations
        if (ExtensionsListView_1.isKeymapsRecommendedExtensionsQuery(query.value)) {
            return this.getKeymapRecommendationsModel(query, options, token);
        }
        // Language recommendations
        if (ExtensionsListView_1.isLanguageRecommendedExtensionsQuery(query.value)) {
            return this.getLanguageRecommendationsModel(query, options, token);
        }
        // Exe recommendations
        if (ExtensionsListView_1.isExeRecommendedExtensionsQuery(query.value)) {
            return this.getExeRecommendationsModel(query, options, token);
        }
        // Remote recommendations
        if (ExtensionsListView_1.isRemoteRecommendedExtensionsQuery(query.value)) {
            return this.getRemoteRecommendationsModel(query, options, token);
        }
        // All recommendations
        if (/@recommended:all/i.test(query.value)) {
            return this.getAllRecommendationsModel(options, token);
        }
        // Search recommendations
        if (ExtensionsListView_1.isSearchRecommendedExtensionsQuery(query.value) ||
            (ExtensionsListView_1.isRecommendedExtensionsQuery(query.value) && options.sortBy !== undefined)) {
            return this.searchRecommendations(query, options, token);
        }
        // Other recommendations
        if (ExtensionsListView_1.isRecommendedExtensionsQuery(query.value)) {
            return this.getOtherRecommendationsModel(query, options, token);
        }
        return new PagedModel([]);
    }
    async getInstallableRecommendations(recommendations, options, token) {
        const result = [];
        if (recommendations.length) {
            const galleryExtensions = [];
            const resourceExtensions = [];
            for (const recommendation of recommendations) {
                if (typeof recommendation === 'string') {
                    galleryExtensions.push(recommendation);
                }
                else {
                    resourceExtensions.push(recommendation);
                }
            }
            if (galleryExtensions.length) {
                try {
                    const extensions = await this.extensionsWorkbenchService.getExtensions(galleryExtensions.map(id => ({ id })), { source: options.source }, token);
                    for (const extension of extensions) {
                        if (extension.gallery && !extension.deprecationInfo
                            && await this.extensionManagementService.canInstall(extension.gallery) === true) {
                            result.push(extension);
                        }
                    }
                }
                catch (error) {
                    if (!resourceExtensions.length || !this.isOfflineError(error)) {
                        throw error;
                    }
                }
            }
            if (resourceExtensions.length) {
                const extensions = await this.extensionsWorkbenchService.getResourceExtensions(resourceExtensions, true);
                for (const extension of extensions) {
                    if (await this.extensionsWorkbenchService.canInstall(extension) === true) {
                        result.push(extension);
                    }
                }
            }
        }
        return result;
    }
    async getWorkspaceRecommendations() {
        const recommendations = await this.extensionRecommendationsService.getWorkspaceRecommendations();
        const { important } = await this.extensionRecommendationsService.getConfigBasedRecommendations();
        for (const configBasedRecommendation of important) {
            if (!recommendations.find(extensionId => extensionId === configBasedRecommendation)) {
                recommendations.push(configBasedRecommendation);
            }
        }
        return recommendations;
    }
    async getWorkspaceRecommendationsModel(query, options, token) {
        const recommendations = await this.getWorkspaceRecommendations();
        const installableRecommendations = (await this.getInstallableRecommendations(recommendations, { ...options, source: 'recommendations-workspace' }, token));
        return new PagedModel(installableRecommendations);
    }
    async getKeymapRecommendationsModel(query, options, token) {
        const value = query.value.replace(/@recommended:keymaps/g, '').trim().toLowerCase();
        const recommendations = this.extensionRecommendationsService.getKeymapRecommendations();
        const installableRecommendations = (await this.getInstallableRecommendations(recommendations, { ...options, source: 'recommendations-keymaps' }, token))
            .filter(extension => extension.identifier.id.toLowerCase().indexOf(value) > -1);
        return new PagedModel(installableRecommendations);
    }
    async getLanguageRecommendationsModel(query, options, token) {
        const value = query.value.replace(/@recommended:languages/g, '').trim().toLowerCase();
        const recommendations = this.extensionRecommendationsService.getLanguageRecommendations();
        const installableRecommendations = (await this.getInstallableRecommendations(recommendations, { ...options, source: 'recommendations-languages' }, token))
            .filter(extension => extension.identifier.id.toLowerCase().indexOf(value) > -1);
        return new PagedModel(installableRecommendations);
    }
    async getRemoteRecommendationsModel(query, options, token) {
        const value = query.value.replace(/@recommended:remotes/g, '').trim().toLowerCase();
        const recommendations = this.extensionRecommendationsService.getRemoteRecommendations();
        const installableRecommendations = (await this.getInstallableRecommendations(recommendations, { ...options, source: 'recommendations-remotes' }, token))
            .filter(extension => extension.identifier.id.toLowerCase().indexOf(value) > -1);
        return new PagedModel(installableRecommendations);
    }
    async getExeRecommendationsModel(query, options, token) {
        const exe = query.value.replace(/@exe:/g, '').trim().toLowerCase();
        const { important, others } = await this.extensionRecommendationsService.getExeBasedRecommendations(exe.startsWith('"') ? exe.substring(1, exe.length - 1) : exe);
        const installableRecommendations = await this.getInstallableRecommendations([...important, ...others], { ...options, source: 'recommendations-exe' }, token);
        return new PagedModel(installableRecommendations);
    }
    async getOtherRecommendationsModel(query, options, token) {
        const otherRecommendations = await this.getOtherRecommendations();
        const installableRecommendations = await this.getInstallableRecommendations(otherRecommendations, { ...options, source: 'recommendations-other', sortBy: undefined }, token);
        const result = coalesce(otherRecommendations.map(id => installableRecommendations.find(i => areSameExtensions(i.identifier, { id }))));
        return new PagedModel(result);
    }
    async getOtherRecommendations() {
        const local = (await this.extensionsWorkbenchService.queryLocal(this.options.server))
            .map(e => e.identifier.id.toLowerCase());
        const workspaceRecommendations = (await this.getWorkspaceRecommendations())
            .map(extensionId => isString(extensionId) ? extensionId.toLowerCase() : extensionId);
        return distinct((await Promise.all([
            // Order is important
            this.extensionRecommendationsService.getImportantRecommendations(),
            this.extensionRecommendationsService.getFileBasedRecommendations(),
            this.extensionRecommendationsService.getOtherRecommendations()
        ])).flat().filter(extensionId => !local.includes(extensionId.toLowerCase()) && !workspaceRecommendations.includes(extensionId.toLowerCase())), extensionId => extensionId.toLowerCase());
    }
    // Get All types of recommendations, trimmed to show a max of 8 at any given time
    async getAllRecommendationsModel(options, token) {
        const localExtensions = await this.extensionsWorkbenchService.queryLocal(this.options.server);
        const localExtensionIds = localExtensions.map(e => e.identifier.id.toLowerCase());
        const allRecommendations = distinct((await Promise.all([
            // Order is important
            this.getWorkspaceRecommendations(),
            this.extensionRecommendationsService.getImportantRecommendations(),
            this.extensionRecommendationsService.getFileBasedRecommendations(),
            this.extensionRecommendationsService.getOtherRecommendations()
        ])).flat().filter(extensionId => {
            if (isString(extensionId)) {
                return !localExtensionIds.includes(extensionId.toLowerCase());
            }
            return !localExtensions.some(localExtension => localExtension.local && this.uriIdentityService.extUri.isEqual(localExtension.local.location, extensionId));
        }));
        const installableRecommendations = await this.getInstallableRecommendations(allRecommendations, { ...options, source: 'recommendations-all', sortBy: undefined }, token);
        const result = [];
        for (let i = 0; i < installableRecommendations.length && result.length < 8; i++) {
            const recommendation = allRecommendations[i];
            if (isString(recommendation)) {
                const extension = installableRecommendations.find(extension => areSameExtensions(extension.identifier, { id: recommendation }));
                if (extension) {
                    result.push(extension);
                }
            }
            else {
                const extension = installableRecommendations.find(extension => extension.resourceExtension && this.uriIdentityService.extUri.isEqual(extension.resourceExtension.location, recommendation));
                if (extension) {
                    result.push(extension);
                }
            }
        }
        return new PagedModel(result);
    }
    async searchRecommendations(query, options, token) {
        const value = query.value.replace(/@recommended/g, '').trim().toLowerCase();
        const recommendations = distinct([...await this.getWorkspaceRecommendations(), ...await this.getOtherRecommendations()]);
        const installableRecommendations = (await this.getInstallableRecommendations(recommendations, { ...options, source: 'recommendations', sortBy: undefined }, token))
            .filter(extension => extension.identifier.id.toLowerCase().indexOf(value) > -1);
        return new PagedModel(this.sortExtensions(installableRecommendations, options));
    }
    setModel(model, message, donotResetScrollTop) {
        if (this.list) {
            this.list.model = new DelayedPagedModel(model);
            this.updateBody(message);
            if (!donotResetScrollTop) {
                this.list.scrollTop = 0;
            }
        }
        if (this.badge) {
            this.badge.setCount(this.count());
        }
    }
    updateModel(model) {
        if (this.list) {
            this.list.model = new DelayedPagedModel(model);
            this.updateBody();
        }
        if (this.badge) {
            this.badge.setCount(this.count());
        }
    }
    updateBody(message) {
        if (this.bodyTemplate) {
            const count = this.count();
            this.bodyTemplate.extensionsList.classList.toggle('hidden', count === 0);
            this.bodyTemplate.messageContainer.classList.toggle('hidden', !message && count > 0);
            if (this.isBodyVisible()) {
                if (message) {
                    this.bodyTemplate.messageSeverityIcon.className = SeverityIcon.className(message.severity);
                    this.bodyTemplate.messageBox.textContent = message.text;
                }
                else if (this.count() === 0) {
                    this.bodyTemplate.messageSeverityIcon.className = '';
                    this.bodyTemplate.messageBox.textContent = localize('no extensions found', "No extensions found.");
                }
                if (this.bodyTemplate.messageBox.textContent) {
                    alert(this.bodyTemplate.messageBox.textContent);
                }
            }
        }
        this.updateSize();
    }
    getMessage(error) {
        if (this.isOfflineError(error)) {
            return { text: localize('offline error', "Unable to search the Marketplace when offline, please check your network connection."), severity: Severity.Warning };
        }
        else {
            return { text: localize('error', "Error while fetching extensions. {0}", getErrorMessage(error)), severity: Severity.Error };
        }
    }
    isOfflineError(error) {
        if (error instanceof ExtensionGalleryError) {
            return error.code === "Offline" /* ExtensionGalleryErrorCode.Offline */;
        }
        return isOfflineError(error);
    }
    updateSize() {
        if (this.options.flexibleHeight) {
            this.maximumBodySize = this.list?.model.length ? Number.POSITIVE_INFINITY : 0;
            this.storageService.store(`${this.id}.size`, this.list?.model.length || 0, 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        }
    }
    dispose() {
        super.dispose();
        if (this.queryRequest) {
            this.queryRequest.request.cancel();
            this.queryRequest = null;
        }
        if (this.queryResult) {
            this.queryResult.disposables.dispose();
            this.queryResult = undefined;
        }
        this.list = null;
    }
    static isLocalExtensionsQuery(query, sortBy) {
        return this.isInstalledExtensionsQuery(query)
            || this.isSearchInstalledExtensionsQuery(query)
            || this.isOutdatedExtensionsQuery(query)
            || this.isEnabledExtensionsQuery(query)
            || this.isDisabledExtensionsQuery(query)
            || this.isBuiltInExtensionsQuery(query)
            || this.isSearchBuiltInExtensionsQuery(query)
            || this.isBuiltInGroupExtensionsQuery(query)
            || this.isSearchDeprecatedExtensionsQuery(query)
            || this.isSearchWorkspaceUnsupportedExtensionsQuery(query)
            || this.isSearchRecentlyUpdatedQuery(query)
            || this.isSearchExtensionUpdatesQuery(query)
            || this.isSortInstalledExtensionsQuery(query, sortBy)
            || this.isFeatureExtensionsQuery(query);
    }
    static isSearchBuiltInExtensionsQuery(query) {
        return /@builtin\s.+|.+\s@builtin/i.test(query);
    }
    static isBuiltInExtensionsQuery(query) {
        return /^@builtin$/i.test(query.trim());
    }
    static isBuiltInGroupExtensionsQuery(query) {
        return /^@builtin:.+$/i.test(query.trim());
    }
    static isSearchWorkspaceUnsupportedExtensionsQuery(query) {
        return /^\s*@workspaceUnsupported(:(untrusted|virtual)(Partial)?)?(\s|$)/i.test(query);
    }
    static isInstalledExtensionsQuery(query) {
        return /@installed$/i.test(query);
    }
    static isSearchInstalledExtensionsQuery(query) {
        return /@installed\s./i.test(query) || this.isFeatureExtensionsQuery(query);
    }
    static isOutdatedExtensionsQuery(query) {
        return /@outdated/i.test(query);
    }
    static isEnabledExtensionsQuery(query) {
        return /@enabled/i.test(query) && !/@builtin/i.test(query);
    }
    static isDisabledExtensionsQuery(query) {
        return /@disabled/i.test(query) && !/@builtin/i.test(query);
    }
    static isSearchDeprecatedExtensionsQuery(query) {
        return /@deprecated\s?.*/i.test(query);
    }
    static isRecommendedExtensionsQuery(query) {
        return /^@recommended$/i.test(query.trim());
    }
    static isSearchRecommendedExtensionsQuery(query) {
        return /@recommended\s.+/i.test(query);
    }
    static isWorkspaceRecommendedExtensionsQuery(query) {
        return /@recommended:workspace/i.test(query);
    }
    static isExeRecommendedExtensionsQuery(query) {
        return /@exe:.+/i.test(query);
    }
    static isRemoteRecommendedExtensionsQuery(query) {
        return /@recommended:remotes/i.test(query);
    }
    static isKeymapsRecommendedExtensionsQuery(query) {
        return /@recommended:keymaps/i.test(query);
    }
    static isLanguageRecommendedExtensionsQuery(query) {
        return /@recommended:languages/i.test(query);
    }
    static isSortInstalledExtensionsQuery(query, sortBy) {
        return (sortBy !== undefined && sortBy !== '' && query === '') || (!sortBy && /^@sort:\S*$/i.test(query));
    }
    static isSearchPopularQuery(query) {
        return /@popular/i.test(query);
    }
    static isSearchRecentlyPublishedQuery(query) {
        return /@recentlyPublished/i.test(query);
    }
    static isSearchRecentlyUpdatedQuery(query) {
        return /@recentlyUpdated/i.test(query);
    }
    static isSearchExtensionUpdatesQuery(query) {
        return /@updates/i.test(query);
    }
    static isSortUpdateDateQuery(query) {
        return /@sort:updateDate/i.test(query);
    }
    static isFeatureExtensionsQuery(query) {
        return /@feature:/i.test(query);
    }
    focus() {
        super.focus();
        if (!this.list) {
            return;
        }
        if (!(this.list.getFocus().length || this.list.getSelection().length)) {
            this.list.focusNext();
        }
        this.list.domFocus();
    }
};
ExtensionsListView = ExtensionsListView_1 = __decorate([
    __param(2, INotificationService),
    __param(3, IKeybindingService),
    __param(4, IContextMenuService),
    __param(5, IInstantiationService),
    __param(6, IThemeService),
    __param(7, IExtensionService),
    __param(8, IExtensionsWorkbenchService),
    __param(9, IExtensionRecommendationsService),
    __param(10, ITelemetryService),
    __param(11, IHoverService),
    __param(12, IConfigurationService),
    __param(13, IWorkspaceContextService),
    __param(14, IExtensionManagementServerService),
    __param(15, IExtensionManifestPropertiesService),
    __param(16, IWorkbenchExtensionManagementService),
    __param(17, IWorkspaceContextService),
    __param(18, IProductService),
    __param(19, IContextKeyService),
    __param(20, IViewDescriptorService),
    __param(21, IOpenerService),
    __param(22, IStorageService),
    __param(23, IWorkspaceTrustManagementService),
    __param(24, IWorkbenchExtensionEnablementService),
    __param(25, IExtensionFeaturesManagementService),
    __param(26, IUriIdentityService),
    __param(27, ILogService)
], ExtensionsListView);
export { ExtensionsListView };
export class DefaultPopularExtensionsView extends ExtensionsListView {
    async show() {
        const query = this.extensionManagementServerService.webExtensionManagementServer && !this.extensionManagementServerService.localExtensionManagementServer && !this.extensionManagementServerService.remoteExtensionManagementServer ? '@web' : '';
        return super.show(query);
    }
}
export class ServerInstalledExtensionsView extends ExtensionsListView {
    async show(query) {
        query = query ? query : '@installed';
        if (!ExtensionsListView.isLocalExtensionsQuery(query) || ExtensionsListView.isSortInstalledExtensionsQuery(query)) {
            query = query += ' @installed';
        }
        return super.show(query.trim());
    }
}
export class EnabledExtensionsView extends ExtensionsListView {
    async show(query) {
        query = query || '@enabled';
        return ExtensionsListView.isEnabledExtensionsQuery(query) ? super.show(query) :
            ExtensionsListView.isSortInstalledExtensionsQuery(query) ? super.show('@enabled ' + query) : this.showEmptyModel();
    }
}
export class DisabledExtensionsView extends ExtensionsListView {
    async show(query) {
        query = query || '@disabled';
        return ExtensionsListView.isDisabledExtensionsQuery(query) ? super.show(query) :
            ExtensionsListView.isSortInstalledExtensionsQuery(query) ? super.show('@disabled ' + query) : this.showEmptyModel();
    }
}
export class OutdatedExtensionsView extends ExtensionsListView {
    async show(query) {
        query = query ? query : '@outdated';
        if (ExtensionsListView.isSearchExtensionUpdatesQuery(query)) {
            query = query.replace('@updates', '@outdated');
        }
        return super.show(query.trim());
    }
    updateSize() {
        super.updateSize();
        this.setExpanded(this.count() > 0);
    }
}
export class RecentlyUpdatedExtensionsView extends ExtensionsListView {
    async show(query) {
        query = query ? query : '@recentlyUpdated';
        if (ExtensionsListView.isSearchExtensionUpdatesQuery(query)) {
            query = query.replace('@updates', '@recentlyUpdated');
        }
        return super.show(query.trim());
    }
}
let StaticQueryExtensionsView = class StaticQueryExtensionsView extends ExtensionsListView {
    constructor(options, viewletViewOptions, notificationService, keybindingService, contextMenuService, instantiationService, themeService, extensionService, extensionsWorkbenchService, extensionRecommendationsService, telemetryService, hoverService, configurationService, contextService, extensionManagementServerService, extensionManifestPropertiesService, extensionManagementService, workspaceService, productService, contextKeyService, viewDescriptorService, openerService, storageService, workspaceTrustManagementService, extensionEnablementService, extensionFeaturesManagementService, uriIdentityService, logService) {
        super(options, viewletViewOptions, notificationService, keybindingService, contextMenuService, instantiationService, themeService, extensionService, extensionsWorkbenchService, extensionRecommendationsService, telemetryService, hoverService, configurationService, contextService, extensionManagementServerService, extensionManifestPropertiesService, extensionManagementService, workspaceService, productService, contextKeyService, viewDescriptorService, openerService, storageService, workspaceTrustManagementService, extensionEnablementService, extensionFeaturesManagementService, uriIdentityService, logService);
        this.options = options;
    }
    show() {
        return super.show(this.options.query);
    }
};
StaticQueryExtensionsView = __decorate([
    __param(2, INotificationService),
    __param(3, IKeybindingService),
    __param(4, IContextMenuService),
    __param(5, IInstantiationService),
    __param(6, IThemeService),
    __param(7, IExtensionService),
    __param(8, IExtensionsWorkbenchService),
    __param(9, IExtensionRecommendationsService),
    __param(10, ITelemetryService),
    __param(11, IHoverService),
    __param(12, IConfigurationService),
    __param(13, IWorkspaceContextService),
    __param(14, IExtensionManagementServerService),
    __param(15, IExtensionManifestPropertiesService),
    __param(16, IWorkbenchExtensionManagementService),
    __param(17, IWorkspaceContextService),
    __param(18, IProductService),
    __param(19, IContextKeyService),
    __param(20, IViewDescriptorService),
    __param(21, IOpenerService),
    __param(22, IStorageService),
    __param(23, IWorkspaceTrustManagementService),
    __param(24, IWorkbenchExtensionEnablementService),
    __param(25, IExtensionFeaturesManagementService),
    __param(26, IUriIdentityService),
    __param(27, ILogService)
], StaticQueryExtensionsView);
export { StaticQueryExtensionsView };
function toSpecificWorkspaceUnsupportedQuery(query, qualifier) {
    if (!query) {
        return '@workspaceUnsupported:' + qualifier;
    }
    const match = query.match(new RegExp(`@workspaceUnsupported(:${qualifier})?(\\s|$)`, 'i'));
    if (match) {
        if (!match[1]) {
            return query.replace(/@workspaceUnsupported/gi, '@workspaceUnsupported:' + qualifier);
        }
        return query;
    }
    return undefined;
}
export class UntrustedWorkspaceUnsupportedExtensionsView extends ExtensionsListView {
    async show(query) {
        const updatedQuery = toSpecificWorkspaceUnsupportedQuery(query, 'untrusted');
        return updatedQuery ? super.show(updatedQuery) : this.showEmptyModel();
    }
}
export class UntrustedWorkspacePartiallySupportedExtensionsView extends ExtensionsListView {
    async show(query) {
        const updatedQuery = toSpecificWorkspaceUnsupportedQuery(query, 'untrustedPartial');
        return updatedQuery ? super.show(updatedQuery) : this.showEmptyModel();
    }
}
export class VirtualWorkspaceUnsupportedExtensionsView extends ExtensionsListView {
    async show(query) {
        const updatedQuery = toSpecificWorkspaceUnsupportedQuery(query, 'virtual');
        return updatedQuery ? super.show(updatedQuery) : this.showEmptyModel();
    }
}
export class VirtualWorkspacePartiallySupportedExtensionsView extends ExtensionsListView {
    async show(query) {
        const updatedQuery = toSpecificWorkspaceUnsupportedQuery(query, 'virtualPartial');
        return updatedQuery ? super.show(updatedQuery) : this.showEmptyModel();
    }
}
export class DeprecatedExtensionsView extends ExtensionsListView {
    async show(query) {
        return ExtensionsListView.isSearchDeprecatedExtensionsQuery(query) ? super.show(query) : this.showEmptyModel();
    }
}
export class SearchMarketplaceExtensionsView extends ExtensionsListView {
    constructor() {
        super(...arguments);
        this.reportSearchFinishedDelayer = this._register(new ThrottledDelayer(2000));
        this.searchWaitPromise = Promise.resolve();
    }
    async show(query) {
        const queryPromise = super.show(query);
        this.reportSearchFinishedDelayer.trigger(() => this.reportSearchFinished());
        this.searchWaitPromise = queryPromise.then(null, null);
        return queryPromise;
    }
    async reportSearchFinished() {
        await this.searchWaitPromise;
        this.telemetryService.publicLog2('extensionsView:MarketplaceSearchFinished');
    }
}
export class DefaultRecommendedExtensionsView extends ExtensionsListView {
    constructor() {
        super(...arguments);
        this.recommendedExtensionsQuery = '@recommended:all';
    }
    renderBody(container) {
        super.renderBody(container);
        this._register(this.extensionRecommendationsService.onDidChangeRecommendations(() => {
            this.show('');
        }));
    }
    async show(query) {
        if (query && query.trim() !== this.recommendedExtensionsQuery) {
            return this.showEmptyModel();
        }
        const model = await super.show(this.recommendedExtensionsQuery);
        if (!this.extensionsWorkbenchService.local.some(e => !e.isBuiltin)) {
            // This is part of popular extensions view. Collapse if no installed extensions.
            this.setExpanded(model.length > 0);
        }
        return model;
    }
}
export class RecommendedExtensionsView extends ExtensionsListView {
    constructor() {
        super(...arguments);
        this.recommendedExtensionsQuery = '@recommended';
    }
    renderBody(container) {
        super.renderBody(container);
        this._register(this.extensionRecommendationsService.onDidChangeRecommendations(() => {
            this.show('');
        }));
    }
    async show(query) {
        return (query && query.trim() !== this.recommendedExtensionsQuery) ? this.showEmptyModel() : super.show(this.recommendedExtensionsQuery);
    }
}
export class WorkspaceRecommendedExtensionsView extends ExtensionsListView {
    constructor() {
        super(...arguments);
        this.recommendedExtensionsQuery = '@recommended:workspace';
    }
    renderBody(container) {
        super.renderBody(container);
        this._register(this.extensionRecommendationsService.onDidChangeRecommendations(() => this.show(this.recommendedExtensionsQuery)));
        this._register(this.contextService.onDidChangeWorkbenchState(() => this.show(this.recommendedExtensionsQuery)));
    }
    async show(query) {
        const shouldShowEmptyView = query && query.trim() !== '@recommended' && query.trim() !== '@recommended:workspace';
        const model = await (shouldShowEmptyView ? this.showEmptyModel() : super.show(this.recommendedExtensionsQuery));
        this.setExpanded(model.length > 0);
        return model;
    }
    async getInstallableWorkspaceRecommendations() {
        const installed = (await this.extensionsWorkbenchService.queryLocal())
            .filter(l => l.enablementState !== 1 /* EnablementState.DisabledByExtensionKind */); // Filter extensions disabled by kind
        const recommendations = (await this.getWorkspaceRecommendations())
            .filter(recommendation => installed.every(local => isString(recommendation) ? !areSameExtensions({ id: recommendation }, local.identifier) : !this.uriIdentityService.extUri.isEqual(recommendation, local.local?.location)));
        return this.getInstallableRecommendations(recommendations, { source: 'install-all-workspace-recommendations' }, CancellationToken.None);
    }
    async installWorkspaceRecommendations() {
        const installableRecommendations = await this.getInstallableWorkspaceRecommendations();
        if (installableRecommendations.length) {
            const galleryExtensions = [];
            const resourceExtensions = [];
            for (const recommendation of installableRecommendations) {
                if (recommendation.gallery) {
                    galleryExtensions.push({ extension: recommendation.gallery, options: {} });
                }
                else {
                    resourceExtensions.push(recommendation);
                }
            }
            await Promise.all([
                this.extensionManagementService.installGalleryExtensions(galleryExtensions),
                ...resourceExtensions.map(extension => this.extensionsWorkbenchService.install(extension))
            ]);
        }
        else {
            this.notificationService.notify({
                severity: Severity.Info,
                message: localize('no local extensions', "There are no extensions to install.")
            });
        }
    }
}
export class PreferredExtensionsPagedModel {
    get onDidIncrementLength() {
        return Event.None;
    }
    constructor(preferredExtensions, pager) {
        this.preferredExtensions = preferredExtensions;
        this.pager = pager;
        this.resolved = new Map();
        this.preferredGalleryExtensions = new Set();
        this.resolvedGalleryExtensionsFromQuery = [];
        for (let i = 0; i < this.preferredExtensions.length; i++) {
            this.resolved.set(i, this.preferredExtensions[i]);
        }
        for (const e of preferredExtensions) {
            if (e.identifier.uuid) {
                this.preferredGalleryExtensions.add(e.identifier.uuid);
            }
        }
        // expected that all preferred gallery extensions will be part of the query results
        this.length = (preferredExtensions.length - this.preferredGalleryExtensions.size) + this.pager.total;
        const totalPages = Math.ceil(this.pager.total / this.pager.pageSize);
        this.populateResolvedExtensions(0, this.pager.firstPage);
        this.pages = range(totalPages - 1).map(() => ({
            promise: null,
            cts: null,
            promiseIndexes: new Set(),
        }));
    }
    isResolved(index) {
        return this.resolved.has(index);
    }
    get(index) {
        return this.resolved.get(index);
    }
    async resolve(index, cancellationToken) {
        if (cancellationToken.isCancellationRequested) {
            throw new CancellationError();
        }
        if (this.isResolved(index)) {
            return this.get(index);
        }
        const indexInPagedModel = index - this.preferredExtensions.length + this.resolvedGalleryExtensionsFromQuery.length;
        const pageIndex = Math.floor(indexInPagedModel / this.pager.pageSize);
        const page = this.pages[pageIndex];
        if (!page.promise) {
            page.cts = new CancellationTokenSource();
            page.promise = this.pager.getPage(pageIndex, page.cts.token)
                .then(extensions => this.populateResolvedExtensions(pageIndex, extensions))
                .catch(e => { page.promise = null; throw e; })
                .finally(() => page.cts = null);
        }
        const listener = cancellationToken.onCancellationRequested(() => {
            if (!page.cts) {
                return;
            }
            page.promiseIndexes.delete(index);
            if (page.promiseIndexes.size === 0) {
                page.cts.cancel();
            }
        });
        page.promiseIndexes.add(index);
        try {
            await page.promise;
        }
        finally {
            listener.dispose();
        }
        return this.get(index);
    }
    populateResolvedExtensions(pageIndex, extensions) {
        let adjustIndexOfNextPagesBy = 0;
        const pageStartIndex = pageIndex * this.pager.pageSize;
        for (let i = 0; i < extensions.length; i++) {
            const e = extensions[i];
            if (e.gallery?.identifier.uuid && this.preferredGalleryExtensions.has(e.gallery.identifier.uuid)) {
                this.resolvedGalleryExtensionsFromQuery.push(e);
                adjustIndexOfNextPagesBy++;
            }
            else {
                this.resolved.set(this.preferredExtensions.length - this.resolvedGalleryExtensionsFromQuery.length + pageStartIndex + i, e);
            }
        }
        // If this page has preferred gallery extensions, then adjust the index of the next pages
        // by the number of preferred gallery extensions found in this page. Because these preferred extensions
        // are already in the resolved list and since we did not add them now, we need to adjust the indices of the next pages.
        // Skip first page as the preferred extensions are always in the first page
        if (pageIndex !== 0 && adjustIndexOfNextPagesBy) {
            const nextPageStartIndex = (pageIndex + 1) * this.pager.pageSize;
            const indices = [...this.resolved.keys()].sort();
            for (const index of indices) {
                if (index >= nextPageStartIndex) {
                    const e = this.resolved.get(index);
                    if (e) {
                        this.resolved.delete(index);
                        this.resolved.set(index - adjustIndexOfNextPagesBy, e);
                    }
                }
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uc1ZpZXdzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2V4dGVuc2lvbnMvYnJvd3Nlci9leHRlbnNpb25zVmlld3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM1RyxPQUFPLEVBQUUsVUFBVSxFQUFlLGlCQUFpQixFQUFVLE1BQU0sbUNBQW1DLENBQUM7QUFDdkcsT0FBTyxFQUE4SCxxQkFBcUIsRUFBRSxNQUFNLHdFQUF3RSxDQUFDO0FBQzNPLE9BQU8sRUFBOEIsaUNBQWlDLEVBQW1CLG9DQUFvQyxFQUFFLG9DQUFvQyxFQUFFLE1BQU0scUVBQXFFLENBQUM7QUFDalAsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFDakksT0FBTyxFQUFFLGlCQUFpQixFQUFFLHdCQUF3QixFQUFFLE1BQU0sNEVBQTRFLENBQUM7QUFDekksT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDOUYsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNu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