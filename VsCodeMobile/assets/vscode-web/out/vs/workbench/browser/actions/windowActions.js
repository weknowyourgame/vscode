/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize, localize2 } from '../../../nls.js';
import { IDialogService } from '../../../platform/dialogs/common/dialogs.js';
import { MenuRegistry, MenuId, Action2, registerAction2 } from '../../../platform/actions/common/actions.js';
import { KeyChord } from '../../../base/common/keyCodes.js';
import { IsMainWindowFullscreenContext } from '../../common/contextkeys.js';
import { IsMacNativeContext, IsDevelopmentContext, IsWebContext, IsIOSContext } from '../../../platform/contextkey/common/contextkeys.js';
import { Categories } from '../../../platform/action/common/actionCommonCategories.js';
import { KeybindingsRegistry } from '../../../platform/keybinding/common/keybindingsRegistry.js';
import { IQuickInputService } from '../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService, isWorkspaceIdentifier, isSingleFolderWorkspaceIdentifier } from '../../../platform/workspace/common/workspace.js';
import { ILabelService } from '../../../platform/label/common/label.js';
import { IKeybindingService } from '../../../platform/keybinding/common/keybinding.js';
import { IModelService } from '../../../editor/common/services/model.js';
import { ILanguageService } from '../../../editor/common/languages/language.js';
import { isRecentFolder, isRecentWorkspace, IWorkspacesService } from '../../../platform/workspaces/common/workspaces.js';
import { getIconClasses } from '../../../editor/common/services/getIconClasses.js';
import { FileKind } from '../../../platform/files/common/files.js';
import { splitRecentLabel } from '../../../base/common/labels.js';
import { isMacintosh, isWeb, isWindows } from '../../../base/common/platform.js';
import { ContextKeyExpr } from '../../../platform/contextkey/common/contextkey.js';
import { inQuickPickContext, getQuickNavigateHandler } from '../quickaccess.js';
import { IHostService } from '../../services/host/browser/host.js';
import { ResourceMap } from '../../../base/common/map.js';
import { Codicon } from '../../../base/common/codicons.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { CommandsRegistry } from '../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { isFolderBackupInfo, isWorkspaceBackupInfo } from '../../../platform/backup/common/backup.js';
import { getActiveElement, getActiveWindow, isHTMLElement } from '../../../base/browser/dom.js';
export const inRecentFilesPickerContextKey = 'inRecentFilesPicker';
class BaseOpenRecentAction extends Action2 {
    constructor() {
        super(...arguments);
        this.removeFromRecentlyOpened = {
            iconClass: ThemeIcon.asClassName(Codicon.removeClose),
            tooltip: localize('remove', "Remove from Recently Opened")
        };
        this.dirtyRecentlyOpenedFolder = {
            iconClass: 'dirty-workspace ' + ThemeIcon.asClassName(Codicon.closeDirty),
            tooltip: localize('dirtyRecentlyOpenedFolder', "Folder With Unsaved Files"),
            alwaysVisible: true
        };
        this.dirtyRecentlyOpenedWorkspace = {
            ...this.dirtyRecentlyOpenedFolder,
            tooltip: localize('dirtyRecentlyOpenedWorkspace', "Workspace With Unsaved Files"),
        };
        this.windowOpenedRecentlyOpenedFolder = {
            iconClass: 'opened-workspace ' + ThemeIcon.asClassName(Codicon.window),
            tooltip: localize('openedRecentlyOpenedFolder', "Folder Opened in a Window"),
            alwaysVisible: true
        };
        this.windowOpenedRecentlyOpenedWorkspace = {
            ...this.windowOpenedRecentlyOpenedFolder,
            tooltip: localize('openedRecentlyOpenedWorkspace', "Workspace Opened in a Window"),
        };
        this.activeWindowOpenedRecentlyOpenedFolder = {
            iconClass: 'opened-workspace ' + ThemeIcon.asClassName(Codicon.windowActive),
            tooltip: localize('activeOpenedRecentlyOpenedFolder', "Folder Opened in Active Window"),
            alwaysVisible: true
        };
        this.activeWindowOpenedRecentlyOpenedWorkspace = {
            ...this.activeWindowOpenedRecentlyOpenedFolder,
            tooltip: localize('activeOpenedRecentlyOpenedWorkspace', "Workspace Opened in Active Window"),
        };
    }
    async run(accessor) {
        const workspacesService = accessor.get(IWorkspacesService);
        const quickInputService = accessor.get(IQuickInputService);
        const contextService = accessor.get(IWorkspaceContextService);
        const labelService = accessor.get(ILabelService);
        const keybindingService = accessor.get(IKeybindingService);
        const modelService = accessor.get(IModelService);
        const languageService = accessor.get(ILanguageService);
        const hostService = accessor.get(IHostService);
        const dialogService = accessor.get(IDialogService);
        const [mainWindows, recentlyOpened, dirtyWorkspacesAndFolders] = await Promise.all([
            hostService.getWindows({ includeAuxiliaryWindows: false }),
            workspacesService.getRecentlyOpened(),
            workspacesService.getDirtyWorkspaces()
        ]);
        let hasWorkspaces = false;
        // Identify all folders and workspaces with unsaved files
        const dirtyFolders = new ResourceMap();
        const dirtyWorkspaces = new ResourceMap();
        for (const dirtyWorkspace of dirtyWorkspacesAndFolders) {
            if (isFolderBackupInfo(dirtyWorkspace)) {
                dirtyFolders.set(dirtyWorkspace.folderUri, true);
            }
            else {
                dirtyWorkspaces.set(dirtyWorkspace.workspace.configPath, dirtyWorkspace.workspace);
                hasWorkspaces = true;
            }
        }
        // Identify all folders and workspaces opened in main windows
        const activeWindowId = getActiveWindow().vscodeWindowId;
        const openedInWindows = new ResourceMap();
        for (const window of mainWindows) {
            const isActive = window.id === activeWindowId;
            if (isSingleFolderWorkspaceIdentifier(window.workspace)) {
                openedInWindows.set(window.workspace.uri, { isActive });
            }
            else if (isWorkspaceIdentifier(window.workspace)) {
                openedInWindows.set(window.workspace.configPath, { isActive });
            }
        }
        // Identify all recently opened folders and workspaces
        const recentFolders = new ResourceMap();
        const recentWorkspaces = new ResourceMap();
        for (const recent of recentlyOpened.workspaces) {
            if (isRecentFolder(recent)) {
                recentFolders.set(recent.folderUri, true);
            }
            else {
                recentWorkspaces.set(recent.workspace.configPath, recent.workspace);
                hasWorkspaces = true;
            }
        }
        // Fill in all known recently opened workspaces
        const workspacePicks = [];
        for (const recent of recentlyOpened.workspaces) {
            const isDirty = isRecentFolder(recent) ? dirtyFolders.has(recent.folderUri) : dirtyWorkspaces.has(recent.workspace.configPath);
            const windowState = isRecentFolder(recent) ? openedInWindows.get(recent.folderUri) : openedInWindows.get(recent.workspace.configPath);
            workspacePicks.push(this.toQuickPick(modelService, languageService, labelService, recent, { isDirty, windowState }));
        }
        // Fill any backup workspace that is not yet shown at the end
        for (const dirtyWorkspaceOrFolder of dirtyWorkspacesAndFolders) {
            if (isFolderBackupInfo(dirtyWorkspaceOrFolder) && !recentFolders.has(dirtyWorkspaceOrFolder.folderUri)) {
                workspacePicks.push(this.toQuickPick(modelService, languageService, labelService, dirtyWorkspaceOrFolder, { isDirty: true, windowState: undefined }));
            }
            else if (isWorkspaceBackupInfo(dirtyWorkspaceOrFolder) && !recentWorkspaces.has(dirtyWorkspaceOrFolder.workspace.configPath)) {
                workspacePicks.push(this.toQuickPick(modelService, languageService, labelService, dirtyWorkspaceOrFolder, { isDirty: true, windowState: undefined }));
            }
        }
        const filePicks = recentlyOpened.files.map(p => this.toQuickPick(modelService, languageService, labelService, p, { isDirty: false, windowState: undefined }));
        // focus second entry if the first recent workspace is the current workspace
        const firstEntry = recentlyOpened.workspaces[0];
        const autoFocusSecondEntry = firstEntry && contextService.isCurrentWorkspace(isRecentWorkspace(firstEntry) ? firstEntry.workspace : firstEntry.folderUri);
        let keyMods;
        const workspaceSeparator = { type: 'separator', label: hasWorkspaces ? localize('workspacesAndFolders', "folders & workspaces") : localize('folders', "folders") };
        const fileSeparator = { type: 'separator', label: localize('files', "files") };
        const picks = [workspaceSeparator, ...workspacePicks, fileSeparator, ...filePicks];
        const pick = await quickInputService.pick(picks, {
            contextKey: inRecentFilesPickerContextKey,
            activeItem: [...workspacePicks, ...filePicks][autoFocusSecondEntry ? 1 : 0],
            placeHolder: isMacintosh ? localize('openRecentPlaceholderMac', "Select to open (hold Cmd-key to force new window or Option-key for same window)") : localize('openRecentPlaceholder', "Select to open (hold Ctrl-key to force new window or Alt-key for same window)"),
            matchOnDescription: true,
            sortByLabel: false,
            onKeyMods: mods => keyMods = mods,
            quickNavigate: this.isQuickNavigate() ? { keybindings: keybindingService.lookupKeybindings(this.desc.id) } : undefined,
            hideInput: this.isQuickNavigate(),
            onDidTriggerItemButton: async (context) => {
                // Remove
                if (context.button === this.removeFromRecentlyOpened || context.button === this.windowOpenedRecentlyOpenedFolder || context.button === this.windowOpenedRecentlyOpenedWorkspace) {
                    await workspacesService.removeRecentlyOpened([context.item.resource]);
                    context.removeItem();
                }
                // Dirty Folder/Workspace
                else if (context.button === this.dirtyRecentlyOpenedFolder || context.button === this.dirtyRecentlyOpenedWorkspace) {
                    const isDirtyWorkspace = context.button === this.dirtyRecentlyOpenedWorkspace;
                    const { confirmed } = await dialogService.confirm({
                        title: isDirtyWorkspace ? localize('dirtyWorkspace', "Workspace with Unsaved Files") : localize('dirtyFolder', "Folder with Unsaved Files"),
                        message: isDirtyWorkspace ? localize('dirtyWorkspaceConfirm', "Do you want to open the workspace to review the unsaved files?") : localize('dirtyFolderConfirm', "Do you want to open the folder to review the unsaved files?"),
                        detail: isDirtyWorkspace ? localize('dirtyWorkspaceConfirmDetail', "Workspaces with unsaved files cannot be removed until all unsaved files have been saved or reverted.") : localize('dirtyFolderConfirmDetail', "Folders with unsaved files cannot be removed until all unsaved files have been saved or reverted.")
                    });
                    if (confirmed) {
                        hostService.openWindow([context.item.openable], {
                            remoteAuthority: context.item.remoteAuthority || null // local window if remoteAuthority is not set or can not be deducted from the openable
                        });
                        quickInputService.cancel();
                    }
                }
            }
        });
        if (pick) {
            return hostService.openWindow([pick.openable], {
                forceNewWindow: keyMods?.ctrlCmd,
                forceReuseWindow: keyMods?.alt,
                remoteAuthority: pick.remoteAuthority || null // local window if remoteAuthority is not set or can not be deducted from the openable
            });
        }
    }
    toQuickPick(modelService, languageService, labelService, recent, kind) {
        let openable;
        let iconClasses;
        let fullLabel;
        let resource;
        let isWorkspace = false;
        // Folder
        if (isRecentFolder(recent)) {
            resource = recent.folderUri;
            iconClasses = getIconClasses(modelService, languageService, resource, FileKind.FOLDER);
            openable = { folderUri: resource };
            fullLabel = recent.label || labelService.getWorkspaceLabel(resource, { verbose: 2 /* Verbosity.LONG */ });
        }
        // Workspace
        else if (isRecentWorkspace(recent)) {
            resource = recent.workspace.configPath;
            iconClasses = getIconClasses(modelService, languageService, resource, FileKind.ROOT_FOLDER);
            openable = { workspaceUri: resource };
            fullLabel = recent.label || labelService.getWorkspaceLabel(recent.workspace, { verbose: 2 /* Verbosity.LONG */ });
            isWorkspace = true;
        }
        // File
        else {
            resource = recent.fileUri;
            iconClasses = getIconClasses(modelService, languageService, resource, FileKind.FILE);
            openable = { fileUri: resource };
            fullLabel = recent.label || labelService.getUriLabel(resource, { appendWorkspaceSuffix: true });
        }
        const { name, parentPath } = splitRecentLabel(fullLabel);
        const buttons = [];
        if (kind.isDirty) {
            buttons.push(isWorkspace ? this.dirtyRecentlyOpenedWorkspace : this.dirtyRecentlyOpenedFolder);
        }
        else if (kind.windowState) {
            if (kind.windowState.isActive) {
                buttons.push(isWorkspace ? this.activeWindowOpenedRecentlyOpenedWorkspace : this.activeWindowOpenedRecentlyOpenedFolder);
            }
            else {
                buttons.push(isWorkspace ? this.windowOpenedRecentlyOpenedWorkspace : this.windowOpenedRecentlyOpenedFolder);
            }
        }
        else {
            buttons.push(this.removeFromRecentlyOpened);
        }
        return {
            iconClasses,
            label: name,
            ariaLabel: kind.isDirty ? isWorkspace ? localize('recentDirtyWorkspaceAriaLabel', "{0}, workspace with unsaved changes", name) : localize('recentDirtyFolderAriaLabel', "{0}, folder with unsaved changes", name) : name,
            description: parentPath,
            buttons,
            openable,
            resource,
            remoteAuthority: recent.remoteAuthority
        };
    }
}
export class OpenRecentAction extends BaseOpenRecentAction {
    static { this.ID = 'workbench.action.openRecent'; }
    constructor() {
        super({
            id: OpenRecentAction.ID,
            title: {
                ...localize2('openRecent', "Open Recent..."),
                mnemonicTitle: localize({ key: 'miMore', comment: ['&& denotes a mnemonic'] }, "&&More..."),
            },
            category: Categories.File,
            f1: true,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 48 /* KeyCode.KeyR */,
                mac: { primary: 256 /* KeyMod.WinCtrl */ | 48 /* KeyCode.KeyR */ }
            },
            menu: {
                id: MenuId.MenubarRecentMenu,
                group: 'y_more',
                order: 1
            }
        });
    }
    isQuickNavigate() {
        return false;
    }
}
class QuickPickRecentAction extends BaseOpenRecentAction {
    constructor() {
        super({
            id: 'workbench.action.quickOpenRecent',
            title: localize2('quickOpenRecent', 'Quick Open Recent...'),
            category: Categories.File,
            f1: false // hide quick pickers from command palette to not confuse with the other entry that shows a input field
        });
    }
    isQuickNavigate() {
        return true;
    }
}
class ToggleFullScreenAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.toggleFullScreen',
            title: {
                ...localize2('toggleFullScreen', "Toggle Full Screen"),
                mnemonicTitle: localize({ key: 'miToggleFullScreen', comment: ['&& denotes a mnemonic'] }, "&&Full Screen"),
            },
            category: Categories.View,
            f1: true,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 69 /* KeyCode.F11 */,
                mac: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 256 /* KeyMod.WinCtrl */ | 36 /* KeyCode.KeyF */
                }
            },
            precondition: IsIOSContext.toNegated(),
            toggled: IsMainWindowFullscreenContext,
            menu: [{
                    id: MenuId.MenubarAppearanceMenu,
                    group: '1_toggle_view',
                    order: 1
                }]
        });
    }
    run(accessor) {
        const hostService = accessor.get(IHostService);
        return hostService.toggleFullScreen(getActiveWindow());
    }
}
export class ReloadWindowAction extends Action2 {
    static { this.ID = 'workbench.action.reloadWindow'; }
    constructor() {
        super({
            id: ReloadWindowAction.ID,
            title: localize2('reloadWindow', 'Reload Window'),
            category: Categories.Developer,
            f1: true,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 50,
                when: IsDevelopmentContext,
                primary: 2048 /* KeyMod.CtrlCmd */ | 48 /* KeyCode.KeyR */
            }
        });
    }
    async run(accessor) {
        const hostService = accessor.get(IHostService);
        return hostService.reload();
    }
}
class ShowAboutDialogAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.showAboutDialog',
            title: {
                ...localize2('about', "About"),
                mnemonicTitle: localize({ key: 'miAbout', comment: ['&& denotes a mnemonic'] }, "&&About"),
            },
            category: Categories.Help,
            f1: true,
            menu: {
                id: MenuId.MenubarHelpMenu,
                group: 'z_about',
                order: 1,
                when: IsMacNativeContext.toNegated()
            }
        });
    }
    run(accessor) {
        const dialogService = accessor.get(IDialogService);
        return dialogService.about();
    }
}
class NewWindowAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.newWindow',
            title: {
                ...localize2('newWindow', "New Window"),
                mnemonicTitle: localize({ key: 'miNewWindow', comment: ['&& denotes a mnemonic'] }, "New &&Window"),
            },
            f1: true,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: isWeb ? (isWindows ? KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 1024 /* KeyMod.Shift */ | 44 /* KeyCode.KeyN */) : 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 1024 /* KeyMod.Shift */ | 44 /* KeyCode.KeyN */) : 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 44 /* KeyCode.KeyN */,
                secondary: isWeb ? [2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 44 /* KeyCode.KeyN */] : undefined
            },
            menu: {
                id: MenuId.MenubarFileMenu,
                group: '1_new',
                order: 3
            }
        });
    }
    run(accessor) {
        const hostService = accessor.get(IHostService);
        return hostService.openWindow({ remoteAuthority: null });
    }
}
class BlurAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.blur',
            title: localize2('blur', 'Remove keyboard focus from focused element')
        });
    }
    run() {
        const activeElement = getActiveElement();
        if (isHTMLElement(activeElement)) {
            activeElement.blur();
        }
    }
}
// --- Actions Registration
registerAction2(NewWindowAction);
registerAction2(ToggleFullScreenAction);
registerAction2(QuickPickRecentAction);
registerAction2(OpenRecentAction);
registerAction2(ReloadWindowAction);
registerAction2(ShowAboutDialogAction);
registerAction2(BlurAction);
// --- Commands/Keybindings Registration
const recentFilesPickerContext = ContextKeyExpr.and(inQuickPickContext, ContextKeyExpr.has(inRecentFilesPickerContextKey));
const quickPickNavigateNextInRecentFilesPickerId = 'workbench.action.quickOpenNavigateNextInRecentFilesPicker';
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: quickPickNavigateNextInRecentFilesPickerId,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 50,
    handler: getQuickNavigateHandler(quickPickNavigateNextInRecentFilesPickerId, true),
    when: recentFilesPickerContext,
    primary: 2048 /* KeyMod.CtrlCmd */ | 48 /* KeyCode.KeyR */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 48 /* KeyCode.KeyR */ }
});
const quickPickNavigatePreviousInRecentFilesPicker = 'workbench.action.quickOpenNavigatePreviousInRecentFilesPicker';
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: quickPickNavigatePreviousInRecentFilesPicker,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 50,
    handler: getQuickNavigateHandler(quickPickNavigatePreviousInRecentFilesPicker, false),
    when: recentFilesPickerContext,
    primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 48 /* KeyCode.KeyR */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 1024 /* KeyMod.Shift */ | 48 /* KeyCode.KeyR */ }
});
CommandsRegistry.registerCommand('workbench.action.toggleConfirmBeforeClose', accessor => {
    const configurationService = accessor.get(IConfigurationService);
    const setting = configurationService.inspect('window.confirmBeforeClose').userValue;
    return configurationService.updateValue('window.confirmBeforeClose', setting === 'never' ? 'keyboardOnly' : 'never');
});
// --- Menu Registration
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
    group: 'z_ConfirmClose',
    command: {
        id: 'workbench.action.toggleConfirmBeforeClose',
        title: localize('miConfirmClose', "Confirm Before Close"),
        toggled: ContextKeyExpr.notEquals('config.window.confirmBeforeClose', 'never')
    },
    order: 1,
    when: IsWebContext
});
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
    title: localize({ key: 'miOpenRecent', comment: ['&& denotes a mnemonic'] }, "Open &&Recent"),
    submenu: MenuId.MenubarRecentMenu,
    group: '2_open',
    order: 4
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2luZG93QWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYnJvd3Nlci9hY3Rpb25zL3dpbmRvd0FjdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUV0RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDN0UsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzdHLE9BQU8sRUFBRSxRQUFRLEVBQW1CLE1BQU0sa0NBQWtDLENBQUM7QUFDN0UsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDNUUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLG9CQUFvQixFQUFFLFlBQVksRUFBRSxZQUFZLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUMxSSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDdkYsT0FBTyxFQUFFLG1CQUFtQixFQUFvQixNQUFNLDREQUE0RCxDQUFDO0FBQ25ILE9BQU8sRUFBcUIsa0JBQWtCLEVBQWlELE1BQU0sbURBQW1ELENBQUM7QUFDekosT0FBTyxFQUFFLHdCQUF3QixFQUF3QixxQkFBcUIsRUFBRSxpQ0FBaUMsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQzNLLE9BQU8sRUFBRSxhQUFhLEVBQWEsTUFBTSx5Q0FBeUMsQ0FBQztBQUNuRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUN2RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDekUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sOENBQThDLENBQUM7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