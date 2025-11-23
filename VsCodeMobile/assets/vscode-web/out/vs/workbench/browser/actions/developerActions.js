/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import './media/actions.css';
import { localize, localize2 } from '../../../nls.js';
import { IKeybindingService } from '../../../platform/keybinding/common/keybinding.js';
import { DomEmitter } from '../../../base/browser/event.js';
import { Color } from '../../../base/common/color.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { toDisposable, dispose, DisposableStore, setDisposableTracker, DisposableTracker } from '../../../base/common/lifecycle.js';
import { getDomNodePagePosition, append, $, getActiveDocument, onDidRegisterWindow, getWindows } from '../../../base/browser/dom.js';
import { createCSSRule, createStyleSheet } from '../../../base/browser/domStylesheets.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../platform/contextkey/common/contextkey.js';
import { StandardKeyboardEvent } from '../../../base/browser/keyboardEvent.js';
import { RunOnceScheduler } from '../../../base/common/async.js';
import { ILayoutService } from '../../../platform/layout/browser/layoutService.js';
import { Registry } from '../../../platform/registry/common/platform.js';
import { registerAction2, Action2, MenuRegistry } from '../../../platform/actions/common/actions.js';
import { IStorageService } from '../../../platform/storage/common/storage.js';
import { clamp } from '../../../base/common/numbers.js';
import { Extensions as ConfigurationExtensions } from '../../../platform/configuration/common/configurationRegistry.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { IWorkingCopyService } from '../../services/workingCopy/common/workingCopyService.js';
import { Categories } from '../../../platform/action/common/actionCommonCategories.js';
import { IWorkingCopyBackupService } from '../../services/workingCopy/common/workingCopyBackup.js';
import { IDialogService } from '../../../platform/dialogs/common/dialogs.js';
import { IOutputService } from '../../services/output/common/output.js';
import { windowLogId } from '../../services/log/common/logConstants.js';
import { ByteSize } from '../../../platform/files/common/files.js';
import { IQuickInputService } from '../../../platform/quickinput/common/quickInput.js';
import { IUserDataProfileService } from '../../services/userDataProfile/common/userDataProfile.js';
import { IEditorService } from '../../services/editor/common/editorService.js';
import product from '../../../platform/product/common/product.js';
import { CommandsRegistry } from '../../../platform/commands/common/commands.js';
import { IEnvironmentService } from '../../../platform/environment/common/environment.js';
import { IProductService } from '../../../platform/product/common/productService.js';
import { IDefaultAccountService } from '../../services/accounts/common/defaultAccount.js';
import { IAuthenticationService } from '../../services/authentication/common/authentication.js';
import { IAuthenticationAccessService } from '../../services/authentication/browser/authenticationAccessService.js';
import { IPolicyService } from '../../../platform/policy/common/policy.js';
class InspectContextKeysAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.inspectContextKeys',
            title: localize2('inspect context keys', 'Inspect Context Keys'),
            category: Categories.Developer,
            f1: true
        });
    }
    run(accessor) {
        const contextKeyService = accessor.get(IContextKeyService);
        const disposables = new DisposableStore();
        const stylesheet = createStyleSheet(undefined, undefined, disposables);
        createCSSRule('*', 'cursor: crosshair !important;', stylesheet);
        const hoverFeedback = document.createElement('div');
        const activeDocument = getActiveDocument();
        activeDocument.body.appendChild(hoverFeedback);
        disposables.add(toDisposable(() => hoverFeedback.remove()));
        hoverFeedback.style.position = 'absolute';
        hoverFeedback.style.pointerEvents = 'none';
        hoverFeedback.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
        hoverFeedback.style.zIndex = '1000';
        const onMouseMove = disposables.add(new DomEmitter(activeDocument, 'mousemove', true));
        disposables.add(onMouseMove.event(e => {
            const target = e.target;
            const position = getDomNodePagePosition(target);
            hoverFeedback.style.top = `${position.top}px`;
            hoverFeedback.style.left = `${position.left}px`;
            hoverFeedback.style.width = `${position.width}px`;
            hoverFeedback.style.height = `${position.height}px`;
        }));
        const onMouseDown = disposables.add(new DomEmitter(activeDocument, 'mousedown', true));
        Event.once(onMouseDown.event)(e => { e.preventDefault(); e.stopPropagation(); }, null, disposables);
        const onMouseUp = disposables.add(new DomEmitter(activeDocument, 'mouseup', true));
        Event.once(onMouseUp.event)(e => {
            e.preventDefault();
            e.stopPropagation();
            const context = contextKeyService.getContext(e.target);
            console.log(context.collectAllValues());
            dispose(disposables);
        }, null, disposables);
    }
}
class ToggleScreencastModeAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.toggleScreencastMode',
            title: localize2('toggle screencast mode', 'Toggle Screencast Mode'),
            category: Categories.Developer,
            f1: true
        });
    }
    run(accessor) {
        if (ToggleScreencastModeAction.disposable) {
            ToggleScreencastModeAction.disposable.dispose();
            ToggleScreencastModeAction.disposable = undefined;
            return;
        }
        const layoutService = accessor.get(ILayoutService);
        const configurationService = accessor.get(IConfigurationService);
        const keybindingService = accessor.get(IKeybindingService);
        const disposables = new DisposableStore();
        const container = layoutService.activeContainer;
        const mouseMarker = append(container, $('.screencast-mouse'));
        disposables.add(toDisposable(() => mouseMarker.remove()));
        const keyboardMarker = append(container, $('.screencast-keyboard'));
        disposables.add(toDisposable(() => keyboardMarker.remove()));
        const onMouseDown = disposables.add(new Emitter());
        const onMouseUp = disposables.add(new Emitter());
        const onMouseMove = disposables.add(new Emitter());
        function registerContainerListeners(container, disposables) {
            disposables.add(disposables.add(new DomEmitter(container, 'mousedown', true)).event(e => onMouseDown.fire(e)));
            disposables.add(disposables.add(new DomEmitter(container, 'mouseup', true)).event(e => onMouseUp.fire(e)));
            disposables.add(disposables.add(new DomEmitter(container, 'mousemove', true)).event(e => onMouseMove.fire(e)));
        }
        for (const { window, disposables } of getWindows()) {
            registerContainerListeners(layoutService.getContainer(window), disposables);
        }
        disposables.add(onDidRegisterWindow(({ window, disposables }) => registerContainerListeners(layoutService.getContainer(window), disposables)));
        disposables.add(layoutService.onDidChangeActiveContainer(() => {
            layoutService.activeContainer.appendChild(mouseMarker);
            layoutService.activeContainer.appendChild(keyboardMarker);
        }));
        const updateMouseIndicatorColor = () => {
            mouseMarker.style.borderColor = Color.fromHex(configurationService.getValue('screencastMode.mouseIndicatorColor')).toString();
        };
        let mouseIndicatorSize;
        const updateMouseIndicatorSize = () => {
            mouseIndicatorSize = clamp(configurationService.getValue('screencastMode.mouseIndicatorSize') || 20, 20, 100);
            mouseMarker.style.height = `${mouseIndicatorSize}px`;
            mouseMarker.style.width = `${mouseIndicatorSize}px`;
        };
        updateMouseIndicatorColor();
        updateMouseIndicatorSize();
        disposables.add(onMouseDown.event(e => {
            mouseMarker.style.top = `${e.clientY - mouseIndicatorSize / 2}px`;
            mouseMarker.style.left = `${e.clientX - mouseIndicatorSize / 2}px`;
            mouseMarker.style.display = 'block';
            mouseMarker.style.transform = `scale(${1})`;
            mouseMarker.style.transition = 'transform 0.1s';
            const mouseMoveListener = onMouseMove.event(e => {
                mouseMarker.style.top = `${e.clientY - mouseIndicatorSize / 2}px`;
                mouseMarker.style.left = `${e.clientX - mouseIndicatorSize / 2}px`;
                mouseMarker.style.transform = `scale(${.8})`;
            });
            Event.once(onMouseUp.event)(() => {
                mouseMarker.style.display = 'none';
                mouseMoveListener.dispose();
            });
        }));
        const updateKeyboardFontSize = () => {
            keyboardMarker.style.fontSize = `${clamp(configurationService.getValue('screencastMode.fontSize') || 56, 20, 100)}px`;
        };
        const updateKeyboardMarker = () => {
            keyboardMarker.style.bottom = `${clamp(configurationService.getValue('screencastMode.verticalOffset') || 0, 0, 90)}%`;
        };
        let keyboardMarkerTimeout;
        const updateKeyboardMarkerTimeout = () => {
            keyboardMarkerTimeout = clamp(configurationService.getValue('screencastMode.keyboardOverlayTimeout') || 800, 500, 5000);
        };
        updateKeyboardFontSize();
        updateKeyboardMarker();
        updateKeyboardMarkerTimeout();
        disposables.add(configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('screencastMode.verticalOffset')) {
                updateKeyboardMarker();
            }
            if (e.affectsConfiguration('screencastMode.fontSize')) {
                updateKeyboardFontSize();
            }
            if (e.affectsConfiguration('screencastMode.keyboardOverlayTimeout')) {
                updateKeyboardMarkerTimeout();
            }
            if (e.affectsConfiguration('screencastMode.mouseIndicatorColor')) {
                updateMouseIndicatorColor();
            }
            if (e.affectsConfiguration('screencastMode.mouseIndicatorSize')) {
                updateMouseIndicatorSize();
            }
        }));
        const onKeyDown = disposables.add(new Emitter());
        const onCompositionStart = disposables.add(new Emitter());
        const onCompositionUpdate = disposables.add(new Emitter());
        const onCompositionEnd = disposables.add(new Emitter());
        function registerWindowListeners(window, disposables) {
            disposables.add(disposables.add(new DomEmitter(window, 'keydown', true)).event(e => onKeyDown.fire(e)));
            disposables.add(disposables.add(new DomEmitter(window, 'compositionstart', true)).event(e => onCompositionStart.fire(e)));
            disposables.add(disposables.add(new DomEmitter(window, 'compositionupdate', true)).event(e => onCompositionUpdate.fire(e)));
            disposables.add(disposables.add(new DomEmitter(window, 'compositionend', true)).event(e => onCompositionEnd.fire(e)));
        }
        for (const { window, disposables } of getWindows()) {
            registerWindowListeners(window, disposables);
        }
        disposables.add(onDidRegisterWindow(({ window, disposables }) => registerWindowListeners(window, disposables)));
        let length = 0;
        let composing = undefined;
        let imeBackSpace = false;
        const clearKeyboardScheduler = new RunOnceScheduler(() => {
            keyboardMarker.textContent = '';
            composing = undefined;
            length = 0;
        }, keyboardMarkerTimeout);
        disposables.add(onCompositionStart.event(e => {
            imeBackSpace = true;
        }));
        disposables.add(onCompositionUpdate.event(e => {
            if (e.data && imeBackSpace) {
                if (length > 20) {
                    keyboardMarker.innerText = '';
                    length = 0;
                }
                composing = composing ?? append(keyboardMarker, $('span.key'));
                composing.textContent = e.data;
            }
            else if (imeBackSpace) {
                keyboardMarker.innerText = '';
                append(keyboardMarker, $('span.key', {}, `Backspace`));
            }
            clearKeyboardScheduler.schedule();
        }));
        disposables.add(onCompositionEnd.event(e => {
            composing = undefined;
            length++;
        }));
        disposables.add(onKeyDown.event(e => {
            if (e.key === 'Process' || /[\uac00-\ud787\u3131-\u314e\u314f-\u3163\u3041-\u3094\u30a1-\u30f4\u30fc\u3005\u3006\u3024\u4e00-\u9fa5]/u.test(e.key)) {
                if (e.code === 'Backspace') {
                    imeBackSpace = true;
                }
                else if (!e.code.includes('Key')) {
                    composing = undefined;
                    imeBackSpace = false;
                }
                else {
                    imeBackSpace = true;
                }
                clearKeyboardScheduler.schedule();
                return;
            }
            if (e.isComposing) {
                return;
            }
            const options = configurationService.getValue('screencastMode.keyboardOptions');
            const event = new StandardKeyboardEvent(e);
            const shortcut = keybindingService.softDispatch(event, event.target);
            // Hide the single arrow key pressed
            if (shortcut.kind === 2 /* ResultKind.KbFound */ && shortcut.commandId && !(options.showSingleEditorCursorMoves ?? true) && (['cursorLeft', 'cursorRight', 'cursorUp', 'cursorDown'].includes(shortcut.commandId))) {
                return;
            }
            if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey
                || length > 20
                || event.keyCode === 1 /* KeyCode.Backspace */ || event.keyCode === 9 /* KeyCode.Escape */
                || event.keyCode === 16 /* KeyCode.UpArrow */ || event.keyCode === 18 /* KeyCode.DownArrow */
                || event.keyCode === 15 /* KeyCode.LeftArrow */ || event.keyCode === 17 /* KeyCode.RightArrow */) {
                keyboardMarker.innerText = '';
                length = 0;
            }
            const keybinding = keybindingService.resolveKeyboardEvent(event);
            const commandDetails = (this._isKbFound(shortcut) && shortcut.commandId) ? this.getCommandDetails(shortcut.commandId) : undefined;
            let commandAndGroupLabel = commandDetails?.title;
            let keyLabel = keybinding.getLabel();
            if (commandDetails) {
                if ((options.showCommandGroups ?? false) && commandDetails.category) {
                    commandAndGroupLabel = `${commandDetails.category}: ${commandAndGroupLabel} `;
                }
                if (this._isKbFound(shortcut) && shortcut.commandId) {
                    const keybindings = keybindingService.lookupKeybindings(shortcut.commandId)
                        .filter(k => k.getLabel()?.endsWith(keyLabel ?? ''));
                    if (keybindings.length > 0) {
                        keyLabel = keybindings[keybindings.length - 1].getLabel();
                    }
                }
            }
            if ((options.showCommands ?? true) && commandAndGroupLabel) {
                append(keyboardMarker, $('span.title', {}, `${commandAndGroupLabel} `));
            }
            if ((options.showKeys ?? true) || ((options.showKeybindings ?? true) && this._isKbFound(shortcut))) {
                // Fix label for arrow keys
                keyLabel = keyLabel?.replace('UpArrow', '↑')
                    ?.replace('DownArrow', '↓')
                    ?.replace('LeftArrow', '←')
                    ?.replace('RightArrow', '→');
                append(keyboardMarker, $('span.key', {}, keyLabel ?? ''));
            }
            length++;
            clearKeyboardScheduler.schedule();
        }));
        ToggleScreencastModeAction.disposable = disposables;
    }
    _isKbFound(resolutionResult) {
        return resolutionResult.kind === 2 /* ResultKind.KbFound */;
    }
    getCommandDetails(commandId) {
        const fromMenuRegistry = MenuRegistry.getCommand(commandId);
        if (fromMenuRegistry) {
            return {
                title: typeof fromMenuRegistry.title === 'string' ? fromMenuRegistry.title : fromMenuRegistry.title.value,
                category: fromMenuRegistry.category ? (typeof fromMenuRegistry.category === 'string' ? fromMenuRegistry.category : fromMenuRegistry.category.value) : undefined
            };
        }
        const fromCommandsRegistry = CommandsRegistry.getCommand(commandId);
        if (fromCommandsRegistry?.metadata?.description) {
            return { title: typeof fromCommandsRegistry.metadata.description === 'string' ? fromCommandsRegistry.metadata.description : fromCommandsRegistry.metadata.description.value };
        }
        return undefined;
    }
}
class LogStorageAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.logStorage',
            title: localize2({ key: 'logStorage', comment: ['A developer only action to log the contents of the storage for the current window.'] }, "Log Storage Database Contents"),
            category: Categories.Developer,
            f1: true
        });
    }
    run(accessor) {
        const storageService = accessor.get(IStorageService);
        const dialogService = accessor.get(IDialogService);
        storageService.log();
        dialogService.info(localize('storageLogDialogMessage', "The storage database contents have been logged to the developer tools."), localize('storageLogDialogDetails', "Open developer tools from the menu and select the Console tab."));
    }
}
class LogWorkingCopiesAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.logWorkingCopies',
            title: localize2({ key: 'logWorkingCopies', comment: ['A developer only action to log the working copies that exist.'] }, "Log Working Copies"),
            category: Categories.Developer,
            f1: true
        });
    }
    async run(accessor) {
        const workingCopyService = accessor.get(IWorkingCopyService);
        const workingCopyBackupService = accessor.get(IWorkingCopyBackupService);
        const logService = accessor.get(ILogService);
        const outputService = accessor.get(IOutputService);
        const backups = await workingCopyBackupService.getBackups();
        const msg = [
            ``,
            `[Working Copies]`,
            ...(workingCopyService.workingCopies.length > 0) ?
                workingCopyService.workingCopies.map(workingCopy => `${workingCopy.isDirty() ? '● ' : ''}${workingCopy.resource.toString(true)} (typeId: ${workingCopy.typeId || '<no typeId>'})`) :
                ['<none>'],
            ``,
            `[Backups]`,
            ...(backups.length > 0) ?
                backups.map(backup => `${backup.resource.toString(true)} (typeId: ${backup.typeId || '<no typeId>'})`) :
                ['<none>'],
        ];
        logService.info(msg.join('\n'));
        outputService.showChannel(windowLogId, true);
    }
}
class RemoveLargeStorageEntriesAction extends Action2 {
    static { this.SIZE_THRESHOLD = 1024 * 16; } // 16kb
    constructor() {
        super({
            id: 'workbench.action.removeLargeStorageDatabaseEntries',
            title: localize2('removeLargeStorageDatabaseEntries', 'Remove Large Storage Database Entries...'),
            category: Categories.Developer,
            f1: true
        });
    }
    async run(accessor) {
        const storageService = accessor.get(IStorageService);
        const quickInputService = accessor.get(IQuickInputService);
        const userDataProfileService = accessor.get(IUserDataProfileService);
        const dialogService = accessor.get(IDialogService);
        const environmentService = accessor.get(IEnvironmentService);
        const items = [];
        for (const scope of [-1 /* StorageScope.APPLICATION */, 0 /* StorageScope.PROFILE */, 1 /* StorageScope.WORKSPACE */]) {
            if (scope === 0 /* StorageScope.PROFILE */ && userDataProfileService.currentProfile.isDefault) {
                continue; // avoid duplicates
            }
            for (const target of [1 /* StorageTarget.MACHINE */, 0 /* StorageTarget.USER */]) {
                for (const key of storageService.keys(scope, target)) {
                    const value = storageService.get(key, scope);
                    if (value && (!environmentService.isBuilt /* show all keys in dev */ || value.length > RemoveLargeStorageEntriesAction.SIZE_THRESHOLD)) {
                        items.push({
                            key,
                            scope,
                            target,
                            size: value.length,
                            label: key,
                            description: ByteSize.formatSize(value.length),
                            detail: localize('largeStorageItemDetail', "Scope: {0}, Target: {1}", scope === -1 /* StorageScope.APPLICATION */ ? localize('global', "Global") : scope === 0 /* StorageScope.PROFILE */ ? localize('profile', "Profile") : localize('workspace', "Workspace"), target === 1 /* StorageTarget.MACHINE */ ? localize('machine', "Machine") : localize('user', "User")),
                        });
                    }
                }
            }
        }
        items.sort((itemA, itemB) => itemB.size - itemA.size);
        const selectedItems = await new Promise(resolve => {
            const disposables = new DisposableStore();
            const picker = disposables.add(quickInputService.createQuickPick());
            picker.items = items;
            picker.canSelectMany = true;
            picker.ok = false;
            picker.customButton = true;
            picker.hideCheckAll = true;
            picker.customLabel = localize('removeLargeStorageEntriesPickerButton', "Remove");
            picker.placeholder = localize('removeLargeStorageEntriesPickerPlaceholder', "Select large entries to remove from storage");
            if (items.length === 0) {
                picker.description = localize('removeLargeStorageEntriesPickerDescriptionNoEntries', "There are no large storage entries to remove.");
            }
            picker.show();
            disposables.add(picker.onDidCustom(() => {
                resolve(picker.selectedItems);
                picker.hide();
            }));
            disposables.add(picker.onDidHide(() => disposables.dispose()));
        });
        if (selectedItems.length === 0) {
            return;
        }
        const { confirmed } = await dialogService.confirm({
            type: 'warning',
            message: localize('removeLargeStorageEntriesConfirmRemove', "Do you want to remove the selected storage entries from the database?"),
            detail: localize('removeLargeStorageEntriesConfirmRemoveDetail', "{0}\n\nThis action is irreversible and may result in data loss!", selectedItems.map(item => item.label).join('\n')),
            primaryButton: localize({ key: 'removeLargeStorageEntriesButtonLabel', comment: ['&& denotes a mnemonic'] }, "&&Remove")
        });
        if (!confirmed) {
            return;
        }
        const scopesToOptimize = new Set();
        for (const item of selectedItems) {
            storageService.remove(item.key, item.scope);
            scopesToOptimize.add(item.scope);
        }
        for (const scope of scopesToOptimize) {
            await storageService.optimize(scope);
        }
    }
}
let tracker = undefined;
let trackedDisposables = new Set();
const DisposablesSnapshotStateContext = new RawContextKey('dirtyWorkingCopies', 'stopped');
class StartTrackDisposables extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.startTrackDisposables',
            title: localize2('startTrackDisposables', 'Start Tracking Disposables'),
            category: Categories.Developer,
            f1: true,
            precondition: ContextKeyExpr.and(DisposablesSnapshotStateContext.isEqualTo('pending').negate(), DisposablesSnapshotStateContext.isEqualTo('started').negate())
        });
    }
    run(accessor) {
        const disposablesSnapshotStateContext = DisposablesSnapshotStateContext.bindTo(accessor.get(IContextKeyService));
        disposablesSnapshotStateContext.set('started');
        trackedDisposables.clear();
        tracker = new DisposableTracker();
        setDisposableTracker(tracker);
    }
}
class SnapshotTrackedDisposables extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.snapshotTrackedDisposables',
            title: localize2('snapshotTrackedDisposables', 'Snapshot Tracked Disposables'),
            category: Categories.Developer,
            f1: true,
            precondition: DisposablesSnapshotStateContext.isEqualTo('started')
        });
    }
    run(accessor) {
        const disposablesSnapshotStateContext = DisposablesSnapshotStateContext.bindTo(accessor.get(IContextKeyService));
        disposablesSnapshotStateContext.set('pending');
        trackedDisposables = new Set(tracker?.computeLeakingDisposables(1000)?.leaks.map(disposable => disposable.value));
    }
}
class StopTrackDisposables extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.stopTrackDisposables',
            title: localize2('stopTrackDisposables', 'Stop Tracking Disposables'),
            category: Categories.Developer,
            f1: true,
            precondition: DisposablesSnapshotStateContext.isEqualTo('pending')
        });
    }
    run(accessor) {
        const editorService = accessor.get(IEditorService);
        const disposablesSnapshotStateContext = DisposablesSnapshotStateContext.bindTo(accessor.get(IContextKeyService));
        disposablesSnapshotStateContext.set('stopped');
        if (tracker) {
            const disposableLeaks = new Set();
            for (const disposable of new Set(tracker.computeLeakingDisposables(1000)?.leaks) ?? []) {
                if (trackedDisposables.has(disposable.value)) {
                    disposableLeaks.add(disposable);
                }
            }
            const leaks = tracker.computeLeakingDisposables(1000, Array.from(disposableLeaks));
            if (leaks) {
                editorService.openEditor({ resource: undefined, contents: leaks.details });
            }
        }
        setDisposableTracker(null);
        tracker = undefined;
        trackedDisposables.clear();
    }
}
class PolicyDiagnosticsAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.showPolicyDiagnostics',
            title: localize2('policyDiagnostics', 'Policy Diagnostics'),
            category: Categories.Developer,
            f1: true
        });
    }
    async run(accessor) {
        const editorService = accessor.get(IEditorService);
        const configurationService = accessor.get(IConfigurationService);
        const productService = accessor.get(IProductService);
        const defaultAccountService = accessor.get(IDefaultAccountService);
        const authenticationService = accessor.get(IAuthenticationService);
        const authenticationAccessService = accessor.get(IAuthenticationAccessService);
        const policyService = accessor.get(IPolicyService);
        const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
        let content = '# VS Code Policy Diagnostics\n\n';
        content += '*WARNING: This file may contain sensitive information.*\n\n';
        content += '## System Information\n\n';
        content += '| Property | Value |\n';
        content += '|----------|-------|\n';
        content += `| Generated | ${new Date().toISOString()} |\n`;
        content += `| Product | ${productService.nameLong} ${productService.version} |\n`;
        content += `| Commit | ${productService.commit || 'n/a'} |\n\n`;
        // Account information
        content += '## Account Information\n\n';
        try {
            const account = await defaultAccountService.getDefaultAccount();
            const sensitiveKeys = ['sessionId', 'analytics_tracking_id'];
            if (account) {
                // Try to get username/display info from the authentication session
                let username = 'Unknown';
                let accountLabel = 'Unknown';
                try {
                    const providerIds = authenticationService.getProviderIds();
                    for (const providerId of providerIds) {
                        const sessions = await authenticationService.getSessions(providerId);
                        const matchingSession = sessions.find(session => session.id === account.sessionId);
                        if (matchingSession) {
                            username = matchingSession.account.id;
                            accountLabel = matchingSession.account.label;
                            break;
                        }
                    }
                }
                catch (error) {
                    // Fallback to just session info
                }
                content += '### Default Account Summary\n\n';
                content += `**Account ID/Username**: ${username}\n\n`;
                content += `**Account Label**: ${accountLabel}\n\n`;
                content += '### Detailed Account Properties\n\n';
                content += '| Property | Value |\n';
                content += '|----------|-------|\n';
                // Iterate through all properties of the account object
                for (const [key, value] of Object.entries(account)) {
                    if (value !== undefined && value !== null) {
                        let displayValue;
                        // Mask sensitive information
                        if (sensitiveKeys.includes(key)) {
                            displayValue = '***';
                        }
                        else if (typeof value === 'object') {
                            displayValue = JSON.stringify(value);
                        }
                        else {
                            displayValue = String(value);
                        }
                        content += `| ${key} | ${displayValue} |\n`;
                    }
                }
                content += '\n';
            }
            else {
                content += '*No default account configured*\n\n';
            }
        }
        catch (error) {
            content += `*Error retrieving account information: ${error}*\n\n`;
        }
        content += '## Policy-Controlled Settings\n\n';
        const policyConfigurations = configurationRegistry.getPolicyConfigurations();
        const configurationProperties = configurationRegistry.getConfigurationProperties();
        const excludedProperties = configurationRegistry.getExcludedConfigurationProperties();
        if (policyConfigurations.size > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const appliedPolicy = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const notAppliedPolicy = [];
            for (const [policyName, settingKey] of policyConfigurations) {
                const property = configurationProperties[settingKey] ?? excludedProperties[settingKey];
                if (property) {
                    const inspectValue = configurationService.inspect(settingKey);
                    const settingInfo = {
                        name: policyName,
                        key: settingKey,
                        property,
                        inspection: inspectValue
                    };
                    if (inspectValue.policyValue !== undefined) {
                        appliedPolicy.push(settingInfo);
                    }
                    else {
                        notAppliedPolicy.push(settingInfo);
                    }
                }
            }
            // Try to detect where the policy came from
            const policySourceMemo = new Map();
            const getPolicySource = (policyName) => {
                if (policySourceMemo.has(policyName)) {
                    return policySourceMemo.get(policyName);
                }
                try {
                    const policyServiceConstructorName = policyService.constructor.name;
                    if (policyServiceConstructorName === 'MultiplexPolicyService') {
                        // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
                        const multiplexService = policyService;
                        if (multiplexService.policyServices) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const componentServices = multiplexService.policyServices;
                            for (const service of componentServices) {
                                if (service.getPolicyValue && service.getPolicyValue(policyName) !== undefined) {
                                    policySourceMemo.set(policyName, service.constructor.name);
                                    return service.constructor.name;
                                }
                            }
                        }
                    }
                    return '';
                }
                catch {
                    return 'Unknown';
                }
            };
            content += '### Applied Policy\n\n';
            appliedPolicy.sort((a, b) => getPolicySource(a.name).localeCompare(getPolicySource(b.name)) || a.name.localeCompare(b.name));
            if (appliedPolicy.length > 0) {
                content += '| Setting Key | Policy Name | Policy Source | Default Value | Current Value | Policy Value |\n';
                content += '|-------------|-------------|---------------|---------------|---------------|-------------|\n';
                for (const setting of appliedPolicy) {
                    const defaultValue = JSON.stringify(setting.property.default);
                    const currentValue = JSON.stringify(setting.inspection.value);
                    const policyValue = JSON.stringify(setting.inspection.policyValue);
                    const policySource = getPolicySource(setting.name);
                    content += `| ${setting.key} | ${setting.name} | ${policySource} | \`${defaultValue}\` | \`${currentValue}\` | \`${policyValue}\` |\n`;
                }
                content += '\n';
            }
            else {
                content += '*No settings are currently controlled by policies*\n\n';
            }
            content += '###  Non-applied Policy\n\n';
            if (notAppliedPolicy.length > 0) {
                content += '| Setting Key | Policy Name  \n';
                content += '|-------------|-------------|\n';
                for (const setting of notAppliedPolicy) {
                    content += `| ${setting.key} | ${setting.name}|\n`;
                }
                content += '\n';
            }
            else {
                content += '*All policy-controllable settings are currently being enforced*\n\n';
            }
        }
        else {
            content += '*No policy-controlled settings found*\n\n';
        }
        // Authentication diagnostics
        content += '## Authentication Information\n\n';
        try {
            const providerIds = authenticationService.getProviderIds();
            if (providerIds.length > 0) {
                content += '### Authentication Providers\n\n';
                content += '| Provider ID | Sessions | Accounts |\n';
                content += '|-------------|----------|----------|\n';
                for (const providerId of providerIds) {
                    try {
                        const sessions = await authenticationService.getSessions(providerId);
                        const accounts = sessions.map(session => session.account);
                        const uniqueAccounts = Array.from(new Set(accounts.map(account => account.label)));
                        content += `| ${providerId} | ${sessions.length} | ${uniqueAccounts.join(', ') || 'None'} |\n`;
                    }
                    catch (error) {
                        content += `| ${providerId} | Error | ${error} |\n`;
                    }
                }
                content += '\n';
                // Detailed session information
                content += '### Detailed Session Information\n\n';
                for (const providerId of providerIds) {
                    try {
                        const sessions = await authenticationService.getSessions(providerId);
                        if (sessions.length > 0) {
                            content += `#### ${providerId}\n\n`;
                            content += '| Account | Scopes | Extensions with Access |\n';
                            content += '|---------|--------|------------------------|\n';
                            for (const session of sessions) {
                                const accountName = session.account.label;
                                const scopes = session.scopes.join(', ') || 'Default';
                                // Get extensions with access to this account
                                try {
                                    const allowedExtensions = authenticationAccessService.readAllowedExtensions(providerId, accountName);
                                    const extensionNames = allowedExtensions
                                        .filter(ext => ext.allowed !== false)
                                        .map(ext => `${ext.name}${ext.trusted ? ' (trusted)' : ''}`)
                                        .join(', ') || 'None';
                                    content += `| ${accountName} | ${scopes} | ${extensionNames} |\n`;
                                }
                                catch (error) {
                                    content += `| ${accountName} | ${scopes} | Error: ${error} |\n`;
                                }
                            }
                            content += '\n';
                        }
                    }
                    catch (error) {
                        content += `#### ${providerId}\n*Error retrieving sessions: ${error}*\n\n`;
                    }
                }
            }
            else {
                content += '*No authentication providers found*\n\n';
            }
        }
        catch (error) {
            content += `*Error retrieving authentication information: ${error}*\n\n`;
        }
        await editorService.openEditor({
            resource: undefined,
            contents: content,
            languageId: 'markdown',
            options: { pinned: true, }
        });
    }
}
// --- Actions Registration
registerAction2(InspectContextKeysAction);
registerAction2(ToggleScreencastModeAction);
registerAction2(LogStorageAction);
registerAction2(LogWorkingCopiesAction);
registerAction2(RemoveLargeStorageEntriesAction);
registerAction2(PolicyDiagnosticsAction);
if (!product.commit) {
    registerAction2(StartTrackDisposables);
    registerAction2(SnapshotTrackedDisposables);
    registerAction2(StopTrackDisposables);
}
// --- Configuration
// Screen Cast Mode
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
    id: 'screencastMode',
    order: 9,
    title: localize('screencastModeConfigurationTitle', "Screencast Mode"),
    type: 'object',
    properties: {
        'screencastMode.verticalOffset': {
            type: 'number',
            default: 20,
            minimum: 0,
            maximum: 90,
            description: localize('screencastMode.location.verticalPosition', "Controls the vertical offset of the screencast mode overlay from the bottom as a percentage of the workbench height.")
        },
        'screencastMode.fontSize': {
            type: 'number',
            default: 56,
            minimum: 20,
            maximum: 100,
            description: localize('screencastMode.fontSize', "Controls the font size (in pixels) of the screencast mode keyboard.")
        },
        'screencastMode.keyboardOptions': {
            type: 'object',
            description: localize('screencastMode.keyboardOptions.description', "Options for customizing the keyboard overlay in screencast mode."),
            properties: {
                'showKeys': {
                    type: 'boolean',
                    default: true,
                    description: localize('screencastMode.keyboardOptions.showKeys', "Show raw keys.")
                },
                'showKeybindings': {
                    type: 'boolean',
                    default: true,
                    description: localize('screencastMode.keyboardOptions.showKeybindings', "Show keyboard shortcuts.")
                },
                'showCommands': {
                    type: 'boolean',
                    default: true,
                    description: localize('screencastMode.keyboardOptions.showCommands', "Show command names.")
                },
                'showCommandGroups': {
                    type: 'boolean',
                    default: false,
                    description: localize('screencastMode.keyboardOptions.showCommandGroups', "Show command group names, when commands are also shown.")
                },
                'showSingleEditorCursorMoves': {
                    type: 'boolean',
                    default: true,
                    description: localize('screencastMode.keyboardOptions.showSingleEditorCursorMoves', "Show single editor cursor move commands.")
                }
            },
            default: {
                'showKeys': true,
                'showKeybindings': true,
                'showCommands': true,
                'showCommandGroups': false,
                'showSingleEditorCursorMoves': true
            },
            additionalProperties: false
        },
        'screencastMode.keyboardOverlayTimeout': {
            type: 'number',
            default: 800,
            minimum: 500,
            maximum: 5000,
            description: localize('screencastMode.keyboardOverlayTimeout', "Controls how long (in milliseconds) the keyboard overlay is shown in screencast mode.")
        },
        'screencastMode.mouseIndicatorColor': {
            type: 'string',
            format: 'color-hex',
            default: '#FF0000',
            description: localize('screencastMode.mouseIndicatorColor', "Controls the color in hex (#RGB, #RGBA, #RRGGBB or #RRGGBBAA) of the mouse indicator in screencast mode.")
        },
        'screencastMode.mouseIndicatorSize': {
            type: 'number',
            default: 20,
            minimum: 20,
            maximum: 100,
            description: localize('screencastMode.mouseIndicatorSize', "Controls the size (in pixels) of the mouse indicator in screencast mode.")
        },
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2ZWxvcGVyQWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYnJvd3Nlci9hY3Rpb25zL2RldmVsb3BlckFjdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxxQkFBcUIsQ0FBQztBQUU3QixPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3RELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUM1RCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDdEQsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQWUsWUFBWSxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsb0JBQW9CLEVBQUUsaUJBQWlCLEVBQWtCLE1BQU0sbUNBQW1DLENBQUM7QUFDakssT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsbUJBQW1CLEVBQUUsVUFBVSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDckksT0FBTyxFQUFFLGFBQWEsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzFGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFFdEgsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDL0UsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDakUsT0FB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