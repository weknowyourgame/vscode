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
var AbstractRuntimeExtensionsEditor_1;
import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { renderLabelWithIcons } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Action, Separator } from '../../../../base/common/actions.js';
import { isNonEmptyArray } from '../../../../base/common/arrays.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { fromNow } from '../../../../base/common/date.js';
import { dispose } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import * as nls from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { getContextMenuActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { Action2, IMenuService, MenuId } from '../../../../platform/actions/common/actions.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { ExtensionIdentifierMap } from '../../../../platform/extensions/common/extensions.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { editorBackground } from '../../../../platform/theme/common/colorRegistry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { Extensions, IExtensionFeaturesManagementService } from '../../../services/extensionManagement/common/extensionFeatures.js';
import { LocalWebWorkerRunningLocation } from '../../../services/extensions/common/extensionRunningLocation.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IExtensionsWorkbenchService } from '../common/extensions.js';
import { RuntimeExtensionsInput } from '../common/runtimeExtensionsInput.js';
import { errorIcon, warningIcon } from './extensionsIcons.js';
import { ExtensionIconWidget } from './extensionsWidgets.js';
import './media/runtimeExtensionsEditor.css';
let AbstractRuntimeExtensionsEditor = class AbstractRuntimeExtensionsEditor extends EditorPane {
    static { AbstractRuntimeExtensionsEditor_1 = this; }
    static { this.ID = 'workbench.editor.runtimeExtensions'; }
    constructor(group, telemetryService, themeService, contextKeyService, _extensionsWorkbenchService, _extensionService, _notificationService, _contextMenuService, _instantiationService, storageService, _labelService, _environmentService, _clipboardService, _extensionFeaturesManagementService, _hoverService, _menuService) {
        super(AbstractRuntimeExtensionsEditor_1.ID, group, telemetryService, themeService, storageService);
        this.contextKeyService = contextKeyService;
        this._extensionsWorkbenchService = _extensionsWorkbenchService;
        this._extensionService = _extensionService;
        this._notificationService = _notificationService;
        this._contextMenuService = _contextMenuService;
        this._instantiationService = _instantiationService;
        this._labelService = _labelService;
        this._environmentService = _environmentService;
        this._clipboardService = _clipboardService;
        this._extensionFeaturesManagementService = _extensionFeaturesManagementService;
        this._hoverService = _hoverService;
        this._menuService = _menuService;
        this._list = null;
        this._elements = null;
        this._updateSoon = this._register(new RunOnceScheduler(() => this._updateExtensions(), 200));
        this._register(this._extensionService.onDidChangeExtensionsStatus(() => this._updateSoon.schedule()));
        this._register(this._extensionFeaturesManagementService.onDidChangeAccessData(() => this._updateSoon.schedule()));
        this._updateExtensions();
    }
    async _updateExtensions() {
        this._elements = await this._resolveExtensions();
        this._list?.splice(0, this._list.length, this._elements);
    }
    async _resolveExtensions() {
        // We only deal with extensions with source code!
        await this._extensionService.whenInstalledExtensionsRegistered();
        const extensionsDescriptions = this._extensionService.extensions.filter((extension) => {
            return Boolean(extension.main) || Boolean(extension.browser);
        });
        const marketplaceMap = new ExtensionIdentifierMap();
        const marketPlaceExtensions = await this._extensionsWorkbenchService.queryLocal();
        for (const extension of marketPlaceExtensions) {
            marketplaceMap.set(extension.identifier.id, extension);
        }
        const statusMap = this._extensionService.getExtensionsStatus();
        // group profile segments by extension
        const segments = new ExtensionIdentifierMap();
        const profileInfo = this._getProfileInfo();
        if (profileInfo) {
            let currentStartTime = profileInfo.startTime;
            for (let i = 0, len = profileInfo.deltas.length; i < len; i++) {
                const id = profileInfo.ids[i];
                const delta = profileInfo.deltas[i];
                let extensionSegments = segments.get(id);
                if (!extensionSegments) {
                    extensionSegments = [];
                    segments.set(id, extensionSegments);
                }
                extensionSegments.push(currentStartTime);
                currentStartTime = currentStartTime + delta;
                extensionSegments.push(currentStartTime);
            }
        }
        let result = [];
        for (let i = 0, len = extensionsDescriptions.length; i < len; i++) {
            const extensionDescription = extensionsDescriptions[i];
            let extProfileInfo = null;
            if (profileInfo) {
                const extensionSegments = segments.get(extensionDescription.identifier) || [];
                let extensionTotalTime = 0;
                for (let j = 0, lenJ = extensionSegments.length / 2; j < lenJ; j++) {
                    const startTime = extensionSegments[2 * j];
                    const endTime = extensionSegments[2 * j + 1];
                    extensionTotalTime += (endTime - startTime);
                }
                extProfileInfo = {
                    segments: extensionSegments,
                    totalTime: extensionTotalTime
                };
            }
            result[i] = {
                originalIndex: i,
                description: extensionDescription,
                marketplaceInfo: marketplaceMap.get(extensionDescription.identifier),
                status: statusMap[extensionDescription.identifier.value],
                profileInfo: extProfileInfo || undefined,
                unresponsiveProfile: this._getUnresponsiveProfile(extensionDescription.identifier)
            };
        }
        result = result.filter(element => element.status.activationStarted);
        // bubble up extensions that have caused slowness
        const isUnresponsive = (extension) => extension.unresponsiveProfile === profileInfo;
        const profileTime = (extension) => extension.profileInfo?.totalTime ?? 0;
        const activationTime = (extension) => (extension.status.activationTimes?.codeLoadingTime ?? 0) +
            (extension.status.activationTimes?.activateCallTime ?? 0);
        result = result.sort((a, b) => {
            if (isUnresponsive(a) || isUnresponsive(b)) {
                return +isUnresponsive(b) - +isUnresponsive(a);
            }
            else if (profileTime(a) || profileTime(b)) {
                return profileTime(b) - profileTime(a);
            }
            else if (activationTime(a) || activationTime(b)) {
                return activationTime(b) - activationTime(a);
            }
            return a.originalIndex - b.originalIndex;
        });
        return result;
    }
    createEditor(parent) {
        parent.classList.add('runtime-extensions-editor');
        const TEMPLATE_ID = 'runtimeExtensionElementTemplate';
        const delegate = new class {
            getHeight(element) {
                return 70;
            }
            getTemplateId(element) {
                return TEMPLATE_ID;
            }
        };
        const renderer = {
            templateId: TEMPLATE_ID,
            renderTemplate: (root) => {
                const element = append(root, $('.extension'));
                const iconContainer = append(element, $('.icon-container'));
                const extensionIconWidget = this._instantiationService.createInstance(ExtensionIconWidget, iconContainer);
                const desc = append(element, $('div.desc'));
                const headerContainer = append(desc, $('.header-container'));
                const header = append(headerContainer, $('.header'));
                const name = append(header, $('div.name'));
                const version = append(header, $('span.version'));
                const msgContainer = append(desc, $('div.msg'));
                const actionbar = new ActionBar(desc);
                const listener = actionbar.onDidRun(({ error }) => error && this._notificationService.error(error));
                const timeContainer = append(element, $('.time'));
                const activationTime = append(timeContainer, $('div.activation-time'));
                const profileTime = append(timeContainer, $('div.profile-time'));
                const disposables = [extensionIconWidget, actionbar, listener];
                return {
                    root,
                    element,
                    name,
                    version,
                    actionbar,
                    activationTime,
                    profileTime,
                    msgContainer,
                    set extension(extension) {
                        extensionIconWidget.extension = extension || null;
                    },
                    disposables,
                    elementDisposables: [],
                };
            },
            renderElement: (element, index, data) => {
                data.elementDisposables = dispose(data.elementDisposables);
                data.extension = element.marketplaceInfo;
                data.root.classList.toggle('odd', index % 2 === 1);
                data.name.textContent = (element.marketplaceInfo?.displayName || element.description.identifier.value).substr(0, 50);
                data.version.textContent = element.description.version;
                const activationTimes = element.status.activationTimes;
                if (activationTimes) {
                    const syncTime = activationTimes.codeLoadingTime + activationTimes.activateCallTime;
                    data.activationTime.textContent = activationTimes.activationReason.startup ? `Startup Activation: ${syncTime}ms` : `Activation: ${syncTime}ms`;
                }
                else {
                    data.activationTime.textContent = `Activating...`;
                }
                data.actionbar.clear();
                const slowExtensionAction = this._createSlowExtensionAction(element);
                if (slowExtensionAction) {
                    data.actionbar.push(slowExtensionAction, { icon: false, label: true });
                }
                if (isNonEmptyArray(element.status.runtimeErrors)) {
                    const reportExtensionIssueAction = this._createReportExtensionIssueAction(element);
                    if (reportExtensionIssueAction) {
                        data.actionbar.push(reportExtensionIssueAction, { icon: false, label: true });
                    }
                }
                let title;
                if (activationTimes) {
                    const activationId = activationTimes.activationReason.extensionId.value;
                    const activationEvent = activationTimes.activationReason.activationEvent;
                    if (activationEvent === '*') {
                        title = nls.localize({
                            key: 'starActivation',
                            comment: [
                                '{0} will be an extension identifier'
                            ]
                        }, "Activated by {0} on start-up", activationId);
                    }
                    else if (/^workspaceContains:/.test(activationEvent)) {
                        const fileNameOrGlob = activationEvent.substr('workspaceContains:'.length);
                        if (fileNameOrGlob.indexOf('*') >= 0 || fileNameOrGlob.indexOf('?') >= 0) {
                            title = nls.localize({
                                key: 'workspaceContainsGlobActivation',
                                comment: [
                                    '{0} will be a glob pattern',
                                    '{1} will be an extension identifier'
                                ]
                            }, "Activated by {1} because a file matching {0} exists in your workspace", fileNameOrGlob, activationId);
                        }
                        else {
                            title = nls.localize({
                                key: 'workspaceContainsFileActivation',
                                comment: [
                                    '{0} will be a file name',
                                    '{1} will be an extension identifier'
                                ]
                            }, "Activated by {1} because file {0} exists in your workspace", fileNameOrGlob, activationId);
                        }
                    }
                    else if (/^workspaceContainsTimeout:/.test(activationEvent)) {
                        const glob = activationEvent.substr('workspaceContainsTimeout:'.length);
                        title = nls.localize({
                            key: 'workspaceContainsTimeout',
                            comment: [
                                '{0} will be a glob pattern',
                                '{1} will be an extension identifier'
                            ]
                        }, "Activated by {1} because searching for {0} took too long", glob, activationId);
                    }
                    else if (activationEvent === 'onStartupFinished') {
                        title = nls.localize({
                            key: 'startupFinishedActivation',
                            comment: [
                                'This refers to an extension. {0} will be an activation event.'
                            ]
                        }, "Activated by {0} after start-up finished", activationId);
                    }
                    else if (/^onLanguage:/.test(activationEvent)) {
                        const language = activationEvent.substr('onLanguage:'.length);
                        title = nls.localize('languageActivation', "Activated by {1} because you opened a {0} file", language, activationId);
                    }
                    else {
                        title = nls.localize({
                            key: 'workspaceGenericActivation',
                            comment: [
                                '{0} will be an activation event, like e.g. \'language:typescript\', \'debug\', etc.',
                                '{1} will be an extension identifier'
                            ]
                        }, "Activated by {1} on {0}", activationEvent, activationId);
                    }
                }
                else {
                    title = nls.localize('extensionActivating', "Extension is activating...");
                }
                data.elementDisposables.push(this._hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), data.activationTime, title));
                clearNode(data.msgContainer);
                if (this._getUnresponsiveProfile(element.description.identifier)) {
                    const el = $('span', undefined, ...renderLabelWithIcons(` $(alert) Unresponsive`));
                    const extensionHostFreezTitle = nls.localize('unresponsive.title', "Extension has caused the extension host to freeze.");
                    data.elementDisposables.push(this._hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), el, extensionHostFreezTitle));
                    data.msgContainer.appendChild(el);
                }
                if (isNonEmptyArray(element.status.runtimeErrors)) {
                    const el = $('span', undefined, ...renderLabelWithIcons(`$(bug) ${nls.localize('errors', "{0} uncaught errors", element.status.runtimeErrors.length)}`));
                    data.msgContainer.appendChild(el);
                }
                if (element.status.messages && element.status.messages.length > 0) {
                    const el = $('span', undefined, ...renderLabelWithIcons(`$(alert) ${element.status.messages[0].message}`));
                    data.msgContainer.appendChild(el);
                }
                let extraLabel = null;
                if (element.status.runningLocation && element.status.runningLocation.equals(new LocalWebWorkerRunningLocation(0))) {
                    extraLabel = `$(globe) web worker`;
                }
                else if (element.description.extensionLocation.scheme === Schemas.vscodeRemote) {
                    const hostLabel = this._labelService.getHostLabel(Schemas.vscodeRemote, this._environmentService.remoteAuthority);
                    if (hostLabel) {
                        extraLabel = `$(remote) ${hostLabel}`;
                    }
                    else {
                        extraLabel = `$(remote) ${element.description.extensionLocation.authority}`;
                    }
                }
                else if (element.status.runningLocation && element.status.runningLocation.affinity > 0) {
                    extraLabel = element.status.runningLocation instanceof LocalWebWorkerRunningLocation
                        ? `$(globe) web worker ${element.status.runningLocation.affinity + 1}`
                        : `$(server-process) local process ${element.status.runningLocation.affinity + 1}`;
                }
                if (extraLabel) {
                    const el = $('span', undefined, ...renderLabelWithIcons(extraLabel));
                    data.msgContainer.appendChild(el);
                }
                const features = Registry.as(Extensions.ExtensionFeaturesRegistry).getExtensionFeatures();
                for (const feature of features) {
                    const accessData = this._extensionFeaturesManagementService.getAccessData(element.description.identifier, feature.id);
                    if (accessData) {
                        const status = accessData?.current?.status;
                        if (status) {
                            data.msgContainer.appendChild($('span', undefined, `${feature.label}: `));
                            data.msgContainer.appendChild($('span', undefined, ...renderLabelWithIcons(`$(${status.severity === Severity.Error ? errorIcon.id : warningIcon.id}) ${status.message}`)));
                        }
                        if (accessData?.accessTimes.length > 0) {
                            const element = $('span', undefined, `${nls.localize('requests count', "{0} Usage: {1} Requests", feature.label, accessData.accessTimes.length)}${accessData.current ? nls.localize('session requests count', ", {0} Requests (Session)", accessData.current.accessTimes.length) : ''}`);
                            if (accessData.current) {
                                const title = nls.localize('requests count title', "Last request was {0}.", fromNow(accessData.current.lastAccessed, true, true));
                                data.elementDisposables.push(this._hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), element, title));
                            }
                            data.msgContainer.appendChild(element);
                        }
                    }
                }
                if (element.profileInfo) {
                    data.profileTime.textContent = `Profile: ${(element.profileInfo.totalTime / 1000).toFixed(2)}ms`;
                }
                else {
                    data.profileTime.textContent = '';
                }
            },
            disposeTemplate: (data) => {
                data.disposables = dispose(data.disposables);
            }
        };
        this._list = this._instantiationService.createInstance((WorkbenchList), 'RuntimeExtensions', parent, delegate, [renderer], {
            multipleSelectionSupport: false,
            setRowLineHeight: false,
            horizontalScrolling: false,
            overrideStyles: {
                listBackground: editorBackground
            },
            accessibilityProvider: new class {
                getWidgetAriaLabel() {
                    return nls.localize('runtimeExtensions', "Runtime Extensions");
                }
                getAriaLabel(element) {
                    return element.description.name;
                }
            }
        });
        this._list.splice(0, this._list.length, this._elements || undefined);
        this._register(this._list.onContextMenu((e) => {
            if (!e.element) {
                return;
            }
            const actions = [];
            actions.push(new Action('runtimeExtensionsEditor.action.copyId', nls.localize('copy id', "Copy id ({0})", e.element.description.identifier.value), undefined, true, () => {
                this._clipboardService.writeText(e.element.description.identifier.value);
            }));
            const reportExtensionIssueAction = this._createReportExtensionIssueAction(e.element);
            if (reportExtensionIssueAction) {
                actions.push(reportExtensionIssueAction);
            }
            actions.push(new Separator());
            if (e.element.marketplaceInfo) {
                actions.push(new Action('runtimeExtensionsEditor.action.disableWorkspace', nls.localize('disable workspace', "Disable (Workspace)"), undefined, true, () => this._extensionsWorkbenchService.setEnablement(e.element.marketplaceInfo, 11 /* EnablementState.DisabledWorkspace */)));
                actions.push(new Action('runtimeExtensionsEditor.action.disable', nls.localize('disable', "Disable"), undefined, true, () => this._extensionsWorkbenchService.setEnablement(e.element.marketplaceInfo, 10 /* EnablementState.DisabledGlobally */)));
            }
            actions.push(new Separator());
            const menuActions = this._menuService.getMenuActions(MenuId.ExtensionEditorContextMenu, this.contextKeyService);
            actions.push(...getContextMenuActions(menuActions).secondary);
            this._contextMenuService.showContextMenu({
                getAnchor: () => e.anchor,
                getActions: () => actions
            });
        }));
    }
    layout(dimension) {
        this._list?.layout(dimension.height);
    }
};
AbstractRuntimeExtensionsEditor = AbstractRuntimeExtensionsEditor_1 = __decorate([
    __param(1, ITelemetryService),
    __param(2, IThemeService),
    __param(3, IContextKeyService),
    __param(4, IExtensionsWorkbenchService),
    __param(5, IExtensionService),
    __param(6, INotificationService),
    __param(7, IContextMenuService),
    __param(8, IInstantiationService),
    __param(9, IStorageService),
    __param(10, ILabelService),
    __param(11, IWorkbenchEnvironmentService),
    __param(12, IClipboardService),
    __param(13, IExtensionFeaturesManagementService),
    __param(14, IHoverService),
    __param(15, IMenuService)
], AbstractRuntimeExtensionsEditor);
export { AbstractRuntimeExtensionsEditor };
export class ShowRuntimeExtensionsAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.showRuntimeExtensions',
            title: nls.localize2('showRuntimeExtensions', "Show Running Extensions"),
            category: Categories.Developer,
            f1: true,
            menu: {
                id: MenuId.ViewContainerTitle,
                when: ContextKeyExpr.equals('viewContainer', 'workbench.view.extensions'),
                group: '2_enablement',
                order: 3
            }
        });
    }
    async run(accessor) {
        await accessor.get(IEditorService).openEditor(RuntimeExtensionsInput.instance, { pinned: true });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJzdHJhY3RSdW50aW1lRXh0ZW5zaW9uc0VkaXRvci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvYWJzdHJhY3RSdW50aW1lRXh0ZW5zaW9uc0VkaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLENBQUMsRUFBYSxNQUFNLEVBQUUsU0FBUyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDbEYsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQy9FLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBRzNGLE9BQU8sRUFBRSxNQUFNLEVBQVcsU0FBUyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDaEYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMxRCxPQUFPLEVBQWUsT0FBTyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDNUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGlFQUFpRSxDQUFDO0FBQ3hHLE9BQU8sRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQy9G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