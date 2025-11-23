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
import { KeyChord } from '../../../../base/common/keyCodes.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { isBoolean, isObject, isString } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { registerEditorContribution } from '../../../../editor/browser/editorExtensions.js';
import { Context as SuggestContext } from '../../../../editor/contrib/suggest/browser/suggest.js';
import * as nls from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { InputFocusedContext, IsMacNativeContext } from '../../../../platform/contextkey/common/contextkeys.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingsRegistry } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IListService } from '../../../../platform/list/browser/listService.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { PICK_WORKSPACE_FOLDER_COMMAND_ID } from '../../../browser/actions/workspaceCommands.js';
import { EditorPaneDescriptor } from '../../../browser/editor.js';
import { resolveCommandsContext } from '../../../browser/parts/editor/editorCommandsContext.js';
import { RemoteNameContext, ResourceContextKey, WorkbenchStateContext } from '../../../common/contextkeys.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { EditorExtensions } from '../../../common/editor.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { KeybindingsEditorInput } from '../../../services/preferences/browser/keybindingsEditorInput.js';
import { DEFINE_KEYBINDING_EDITOR_CONTRIB_ID, IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { PreferencesEditorInput, SettingsEditor2Input } from '../../../services/preferences/common/preferencesEditorInput.js';
import { SettingsEditorModel } from '../../../services/preferences/common/preferencesModels.js';
import { CURRENT_PROFILE_CONTEXT, IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { ExplorerFolderContext, ExplorerRootContext } from '../../files/common/files.js';
import { CONTEXT_AI_SETTING_RESULTS_AVAILABLE, CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDINGS_SEARCH_FOCUS, CONTEXT_KEYBINDING_FOCUS, CONTEXT_SETTINGS_EDITOR, CONTEXT_SETTINGS_JSON_EDITOR, CONTEXT_SETTINGS_ROW_FOCUS, CONTEXT_SETTINGS_SEARCH_FOCUS, CONTEXT_TOC_ROW_FOCUS, CONTEXT_WHEN_FOCUS, KEYBINDINGS_EDITOR_COMMAND_ACCEPT_WHEN, KEYBINDINGS_EDITOR_COMMAND_ADD, KEYBINDINGS_EDITOR_COMMAND_CLEAR_SEARCH_HISTORY, KEYBINDINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS, KEYBINDINGS_EDITOR_COMMAND_COPY, KEYBINDINGS_EDITOR_COMMAND_COPY_COMMAND, KEYBINDINGS_EDITOR_COMMAND_COPY_COMMAND_TITLE, KEYBINDINGS_EDITOR_COMMAND_DEFINE, KEYBINDINGS_EDITOR_COMMAND_DEFINE_WHEN, KEYBINDINGS_EDITOR_COMMAND_FOCUS_KEYBINDINGS, KEYBINDINGS_EDITOR_COMMAND_RECORD_SEARCH_KEYS, KEYBINDINGS_EDITOR_COMMAND_REJECT_WHEN, KEYBINDINGS_EDITOR_COMMAND_REMOVE, KEYBINDINGS_EDITOR_COMMAND_RESET, KEYBINDINGS_EDITOR_COMMAND_SEARCH, KEYBINDINGS_EDITOR_COMMAND_SHOW_SIMILAR, KEYBINDINGS_EDITOR_COMMAND_SORTBY_PRECEDENCE, KEYBINDINGS_EDITOR_SHOW_DEFAULT_KEYBINDINGS, KEYBINDINGS_EDITOR_SHOW_EXTENSION_KEYBINDINGS, KEYBINDINGS_EDITOR_SHOW_USER_KEYBINDINGS, REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG, SETTINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS, SETTINGS_EDITOR_COMMAND_SHOW_CONTEXT_MENU, SETTINGS_EDITOR_COMMAND_TOGGLE_AI_SEARCH } from '../common/preferences.js';
import { PreferencesContribution } from '../common/preferencesContribution.js';
import { KeybindingsEditor } from './keybindingsEditor.js';
import { ConfigureLanguageBasedSettingsAction } from './preferencesActions.js';
import { PreferencesEditor } from './preferencesEditor.js';
import { preferencesOpenSettingsIcon } from './preferencesIcons.js';
import { UserSettingsRenderer, WorkspaceSettingsRenderer } from './preferencesRenderers.js';
import { SettingsEditor2 } from './settingsEditor2.js';
const SETTINGS_EDITOR_COMMAND_SEARCH = 'settings.action.search';
const SETTINGS_EDITOR_COMMAND_FOCUS_FILE = 'settings.action.focusSettingsFile';
const SETTINGS_EDITOR_COMMAND_FOCUS_SETTINGS_FROM_SEARCH = 'settings.action.focusSettingsFromSearch';
const SETTINGS_EDITOR_COMMAND_FOCUS_SETTINGS_LIST = 'settings.action.focusSettingsList';
const SETTINGS_EDITOR_COMMAND_FOCUS_TOC = 'settings.action.focusTOC';
const SETTINGS_EDITOR_COMMAND_FOCUS_CONTROL = 'settings.action.focusSettingControl';
const SETTINGS_EDITOR_COMMAND_FOCUS_UP = 'settings.action.focusLevelUp';
const SETTINGS_EDITOR_COMMAND_SWITCH_TO_JSON = 'settings.switchToJSON';
const SETTINGS_EDITOR_COMMAND_FILTER_ONLINE = 'settings.filterByOnline';
const SETTINGS_EDITOR_COMMAND_FILTER_UNTRUSTED = 'settings.filterUntrusted';
const SETTINGS_COMMAND_OPEN_SETTINGS = 'workbench.action.openSettings';
const SETTINGS_COMMAND_FILTER_TELEMETRY = 'settings.filterByTelemetry';
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(SettingsEditor2, SettingsEditor2.ID, nls.localize('settingsEditor2', "Settings Editor 2")), [
    new SyncDescriptor(SettingsEditor2Input)
]);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(PreferencesEditor, PreferencesEditor.ID, nls.localize('preferencesEditor', "Preferences Editor")), [
    new SyncDescriptor(PreferencesEditorInput)
]);
class PreferencesEditorInputSerializer {
    canSerialize(editorInput) {
        return true;
    }
    serialize(editorInput) {
        return '';
    }
    deserialize(instantiationService) {
        return instantiationService.createInstance(PreferencesEditorInput);
    }
}
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(KeybindingsEditor, KeybindingsEditor.ID, nls.localize('keybindingsEditor', "Keybindings Editor")), [
    new SyncDescriptor(KeybindingsEditorInput)
]);
class KeybindingsEditorInputSerializer {
    canSerialize(editorInput) {
        return true;
    }
    serialize(editorInput) {
        return '';
    }
    deserialize(instantiationService) {
        return instantiationService.createInstance(KeybindingsEditorInput);
    }
}
class SettingsEditor2InputSerializer {
    canSerialize(editorInput) {
        return true;
    }
    serialize(input) {
        return '';
    }
    deserialize(instantiationService) {
        return instantiationService.createInstance(SettingsEditor2Input);
    }
}
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(PreferencesEditorInput.ID, PreferencesEditorInputSerializer);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(KeybindingsEditorInput.ID, KeybindingsEditorInputSerializer);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(SettingsEditor2Input.ID, SettingsEditor2InputSerializer);
const OPEN_USER_SETTINGS_UI_TITLE = nls.localize2('openSettings2', "Open Settings (UI)");
const OPEN_USER_SETTINGS_JSON_TITLE = nls.localize2('openUserSettingsJson', "Open User Settings (JSON)");
const OPEN_APPLICATION_SETTINGS_JSON_TITLE = nls.localize2('openApplicationSettingsJson', "Open Application Settings (JSON)");
const category = Categories.Preferences;
function sanitizeBoolean(arg) {
    return isBoolean(arg) ? arg : undefined;
}
function sanitizeString(arg) {
    return isString(arg) ? arg : undefined;
}
function sanitizeOpenSettingsArgs(args) {
    if (!isObject(args)) {
        args = {};
    }
    let sanitizedObject = {
        focusSearch: sanitizeBoolean(args?.focusSearch),
        openToSide: sanitizeBoolean(args?.openToSide),
        query: sanitizeString(args?.query)
    };
    if (isString(args?.revealSetting?.key)) {
        sanitizedObject = {
            ...sanitizedObject,
            revealSetting: {
                key: args.revealSetting.key,
                edit: sanitizeBoolean(args.revealSetting?.edit)
            }
        };
    }
    return sanitizedObject;
}
let PreferencesActionsContribution = class PreferencesActionsContribution extends Disposable {
    static { this.ID = 'workbench.contrib.preferencesActions'; }
    constructor(environmentService, userDataProfileService, preferencesService, workspaceContextService, labelService, extensionService, userDataProfilesService) {
        super();
        this.environmentService = environmentService;
        this.userDataProfileService = userDataProfileService;
        this.preferencesService = preferencesService;
        this.workspaceContextService = workspaceContextService;
        this.labelService = labelService;
        this.extensionService = extensionService;
        this.userDataProfilesService = userDataProfilesService;
        this.registerSettingsActions();
        this.registerKeybindingsActions();
        this.updatePreferencesEditorMenuItem();
        this._register(workspaceContextService.onDidChangeWorkbenchState(() => this.updatePreferencesEditorMenuItem()));
        this._register(workspaceContextService.onDidChangeWorkspaceFolders(() => this.updatePreferencesEditorMenuItemForWorkspaceFolders()));
    }
    registerSettingsActions() {
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: SETTINGS_COMMAND_OPEN_SETTINGS,
                    title: {
                        ...nls.localize2('settings', "Settings"),
                        mnemonicTitle: nls.localize({ key: 'miOpenSettings', comment: ['&& denotes a mnemonic'] }, "&&Settings"),
                    },
                    keybinding: {
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                        when: null,
                        primary: 2048 /* KeyMod.CtrlCmd */ | 87 /* KeyCode.Comma */,
                    },
                    menu: [{
                            id: MenuId.GlobalActivity,
                            group: '2_configuration',
                            order: 2
                        }, {
                            id: MenuId.MenubarPreferencesMenu,
                            group: '2_configuration',
                            order: 2
                        }],
                });
            }
            run(accessor, args) {
                // args takes a string for backcompat
                const opts = typeof args === 'string' ? { query: args } : sanitizeOpenSettingsArgs(args);
                return accessor.get(IPreferencesService).openSettings(opts);
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.openSettings2',
                    title: nls.localize2('openSettings2', "Open Settings (UI)"),
                    category,
                    f1: true,
                });
            }
            run(accessor, args) {
                args = sanitizeOpenSettingsArgs(args);
                return accessor.get(IPreferencesService).openSettings({ jsonEditor: false, ...args });
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.openSettingsJson',
                    title: OPEN_USER_SETTINGS_JSON_TITLE,
                    metadata: {
                        description: nls.localize2('workbench.action.openSettingsJson.description', "Opens the JSON file containing the current user profile settings")
                    },
                    category,
                    f1: true,
                });
            }
            run(accessor, args) {
                args = sanitizeOpenSettingsArgs(args);
                return accessor.get(IPreferencesService).openSettings({ jsonEditor: true, ...args });
            }
        }));
        const that = this;
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.openApplicationSettingsJson',
                    title: OPEN_APPLICATION_SETTINGS_JSON_TITLE,
                    category,
                    menu: {
                        id: MenuId.CommandPalette,
                        when: ContextKeyExpr.notEquals(CURRENT_PROFILE_CONTEXT.key, that.userDataProfilesService.defaultProfile.id)
                    }
                });
            }
            run(accessor, args) {
                args = sanitizeOpenSettingsArgs(args);
                return accessor.get(IPreferencesService).openApplicationSettings({ jsonEditor: true, ...args });
            }
        }));
        // Opens the User tab of the Settings editor
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.openGlobalSettings',
                    title: nls.localize2('openGlobalSettings', "Open User Settings"),
                    category,
                    f1: true,
                });
            }
            run(accessor, args) {
                args = sanitizeOpenSettingsArgs(args);
                return accessor.get(IPreferencesService).openUserSettings(args);
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.openRawDefaultSettings',
                    title: nls.localize2('openRawDefaultSettings', "Open Default Settings (JSON)"),
                    category,
                    f1: true,
                });
            }
            run(accessor) {
                return accessor.get(IPreferencesService).openRawDefaultSettings();
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: ConfigureLanguageBasedSettingsAction.ID,
                    title: ConfigureLanguageBasedSettingsAction.LABEL,
                    category,
                    f1: true,
                });
            }
            run(accessor) {
                return accessor.get(IInstantiationService).createInstance(ConfigureLanguageBasedSettingsAction, ConfigureLanguageBasedSettingsAction.ID, ConfigureLanguageBasedSettingsAction.LABEL.value).run();
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.openWorkspaceSettings',
                    title: nls.localize2('openWorkspaceSettings', "Open Workspace Settings"),
                    category,
                    menu: {
                        id: MenuId.CommandPalette,
                        when: WorkbenchStateContext.notEqualsTo('empty')
                    }
                });
            }
            run(accessor, args) {
                // Match the behaviour of workbench.action.openSettings
                args = typeof args === 'string' ? { query: args } : sanitizeOpenSettingsArgs(args);
                return accessor.get(IPreferencesService).openWorkspaceSettings(args);
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.openAccessibilitySettings',
                    title: nls.localize2('openAccessibilitySettings', "Open Accessibility Settings"),
                    category,
                    menu: {
                        id: MenuId.CommandPalette,
                        when: WorkbenchStateContext.notEqualsTo('empty')
                    }
                });
            }
            async run(accessor) {
                await accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: '@tag:accessibility' });
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.openWorkspaceSettingsFile',
                    title: nls.localize2('openWorkspaceSettingsFile', "Open Workspace Settings (JSON)"),
                    category,
                    menu: {
                        id: MenuId.CommandPalette,
                        when: WorkbenchStateContext.notEqualsTo('empty')
                    }
                });
            }
            run(accessor, args) {
                args = sanitizeOpenSettingsArgs(args);
                return accessor.get(IPreferencesService).openWorkspaceSettings({ jsonEditor: true, ...args });
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.openFolderSettings',
                    title: nls.localize2('openFolderSettings', "Open Folder Settings"),
                    category,
                    menu: {
                        id: MenuId.CommandPalette,
                        when: WorkbenchStateContext.isEqualTo('workspace')
                    }
                });
            }
            async run(accessor, args) {
                const commandService = accessor.get(ICommandService);
                const preferencesService = accessor.get(IPreferencesService);
                const workspaceFolder = await commandService.executeCommand(PICK_WORKSPACE_FOLDER_COMMAND_ID);
                if (workspaceFolder) {
                    args = sanitizeOpenSettingsArgs(args);
                    await preferencesService.openFolderSettings({ folderUri: workspaceFolder.uri, ...args });
                }
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.openFolderSettingsFile',
                    title: nls.localize2('openFolderSettingsFile', "Open Folder Settings (JSON)"),
                    category,
                    menu: {
                        id: MenuId.CommandPalette,
                        when: WorkbenchStateContext.isEqualTo('workspace')
                    }
                });
            }
            async run(accessor, args) {
                const commandService = accessor.get(ICommandService);
                const preferencesService = accessor.get(IPreferencesService);
                const workspaceFolder = await commandService.executeCommand(PICK_WORKSPACE_FOLDER_COMMAND_ID);
                if (workspaceFolder) {
                    args = sanitizeOpenSettingsArgs(args);
                    await preferencesService.openFolderSettings({ folderUri: workspaceFolder.uri, jsonEditor: true, ...args });
                }
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: '_workbench.action.openFolderSettings',
                    title: nls.localize('openFolderSettings', "Open Folder Settings"),
                    category,
                    menu: {
                        id: MenuId.ExplorerContext,
                        group: '2_workspace',
                        order: 20,
                        when: ContextKeyExpr.and(ExplorerRootContext, ExplorerFolderContext)
                    }
                });
            }
            async run(accessor, resource) {
                if (URI.isUri(resource)) {
                    await accessor.get(IPreferencesService).openFolderSettings({ folderUri: resource });
                }
                else {
                    const commandService = accessor.get(ICommandService);
                    const preferencesService = accessor.get(IPreferencesService);
                    const workspaceFolder = await commandService.executeCommand(PICK_WORKSPACE_FOLDER_COMMAND_ID);
                    if (workspaceFolder) {
                        await preferencesService.openFolderSettings({ folderUri: workspaceFolder.uri });
                    }
                }
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: SETTINGS_EDITOR_COMMAND_FILTER_ONLINE,
                    title: nls.localize({ key: 'miOpenOnlineSettings', comment: ['&& denotes a mnemonic'] }, "&&Online Services Settings"),
                    menu: {
                        id: MenuId.MenubarPreferencesMenu,
                        group: '3_settings',
                        order: 1,
                    }
                });
            }
            run(accessor) {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof SettingsEditor2) {
                    editorPane.focusSearch(`@tag:usesOnlineServices`);
                }
                else {
                    accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: '@tag:usesOnlineServices' });
                }
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: SETTINGS_EDITOR_COMMAND_TOGGLE_AI_SEARCH,
                    precondition: CONTEXT_SETTINGS_EDITOR,
                    keybinding: {
                        primary: 2048 /* KeyMod.CtrlCmd */ | 39 /* KeyCode.KeyI */,
                        weight: 100 /* KeybindingWeight.EditorContrib */,
                        when: CONTEXT_AI_SETTING_RESULTS_AVAILABLE
                    },
                    category,
                    f1: true,
                    title: nls.localize2('settings.toggleAiSearch', "Toggle AI Settings Search")
                });
            }
            run(accessor) {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof SettingsEditor2) {
                    editorPane.toggleAiSearch();
                }
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: SETTINGS_EDITOR_COMMAND_FILTER_UNTRUSTED,
                    title: nls.localize2('filterUntrusted', "Show untrusted workspace settings"),
                });
            }
            run(accessor) {
                accessor.get(IPreferencesService).openWorkspaceSettings({ jsonEditor: false, query: `@tag:${REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG}` });
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: SETTINGS_COMMAND_FILTER_TELEMETRY,
                    title: nls.localize({ key: 'miOpenTelemetrySettings', comment: ['&& denotes a mnemonic'] }, "&&Telemetry Settings")
                });
            }
            run(accessor) {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof SettingsEditor2) {
                    editorPane.focusSearch(`@tag:telemetry`);
                }
                else {
                    accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: '@tag:telemetry' });
                }
            }
        }));
        this.registerSettingsEditorActions();
        this.extensionService.whenInstalledExtensionsRegistered()
            .then(() => {
            const remoteAuthority = this.environmentService.remoteAuthority;
            const hostLabel = this.labelService.getHostLabel(Schemas.vscodeRemote, remoteAuthority) || remoteAuthority;
            this._register(registerAction2(class extends Action2 {
                constructor() {
                    super({
                        id: 'workbench.action.openRemoteSettings',
                        title: nls.localize2('openRemoteSettings', "Open Remote Settings ({0})", hostLabel),
                        category,
                        menu: {
                            id: MenuId.CommandPalette,
                            when: RemoteNameContext.notEqualsTo('')
                        }
                    });
                }
                run(accessor, args) {
                    args = sanitizeOpenSettingsArgs(args);
                    return accessor.get(IPreferencesService).openRemoteSettings(args);
                }
            }));
            this._register(registerAction2(class extends Action2 {
                constructor() {
                    super({
                        id: 'workbench.action.openRemoteSettingsFile',
                        title: nls.localize2('openRemoteSettingsJSON', "Open Remote Settings (JSON) ({0})", hostLabel),
                        category,
                        menu: {
                            id: MenuId.CommandPalette,
                            when: RemoteNameContext.notEqualsTo('')
                        }
                    });
                }
                run(accessor, args) {
                    args = sanitizeOpenSettingsArgs(args);
                    return accessor.get(IPreferencesService).openRemoteSettings({ jsonEditor: true, ...args });
                }
            }));
        });
    }
    registerSettingsEditorActions() {
        function getPreferencesEditor(accessor) {
            const activeEditorPane = accessor.get(IEditorService).activeEditorPane;
            if (activeEditorPane instanceof SettingsEditor2) {
                return activeEditorPane;
            }
            return null;
        }
        function settingsEditorFocusSearch(accessor) {
            const preferencesEditor = getPreferencesEditor(accessor);
            preferencesEditor?.focusSearch();
        }
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: SETTINGS_EDITOR_COMMAND_SEARCH,
                    precondition: CONTEXT_SETTINGS_EDITOR,
                    keybinding: {
                        primary: 2048 /* KeyMod.CtrlCmd */ | 36 /* KeyCode.KeyF */,
                        weight: 100 /* KeybindingWeight.EditorContrib */,
                        when: null
                    },
                    category,
                    f1: true,
                    title: nls.localize2('settings.focusSearch', "Focus Settings Search")
                });
            }
            run(accessor) { settingsEditorFocusSearch(accessor); }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: SETTINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS,
                    precondition: CONTEXT_SETTINGS_EDITOR,
                    keybinding: {
                        primary: 9 /* KeyCode.Escape */,
                        weight: 100 /* KeybindingWeight.EditorContrib */,
                        when: CONTEXT_SETTINGS_SEARCH_FOCUS
                    },
                    category,
                    f1: true,
                    title: nls.localize2('settings.clearResults', "Clear Settings Search Results")
                });
            }
            run(accessor) {
                const preferencesEditor = getPreferencesEditor(accessor);
                preferencesEditor?.clearSearchResults();
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: SETTINGS_EDITOR_COMMAND_FOCUS_FILE,
                    precondition: ContextKeyExpr.and(CONTEXT_SETTINGS_SEARCH_FOCUS, SuggestContext.Visible.toNegated()),
                    keybinding: {
                        primary: 18 /* KeyCode.DownArrow */,
                        weight: 100 /* KeybindingWeight.EditorContrib */,
                        when: null
                    },
                    title: nls.localize('settings.focusFile', "Focus settings file")
                });
            }
            run(accessor) {
                const preferencesEditor = getPreferencesEditor(accessor);
                preferencesEditor?.focusSettings();
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: SETTINGS_EDITOR_COMMAND_FOCUS_SETTINGS_FROM_SEARCH,
                    precondition: ContextKeyExpr.and(CONTEXT_SETTINGS_SEARCH_FOCUS, SuggestContext.Visible.toNegated()),
                    keybinding: {
                        primary: 18 /* KeyCode.DownArrow */,
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                        when: null
                    },
                    title: nls.localize('settings.focusFile', "Focus settings file")
                });
            }
            run(accessor) {
                const preferencesEditor = getPreferencesEditor(accessor);
                preferencesEditor?.focusSettings();
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: SETTINGS_EDITOR_COMMAND_FOCUS_SETTINGS_LIST,
                    precondition: ContextKeyExpr.and(CONTEXT_SETTINGS_EDITOR, CONTEXT_TOC_ROW_FOCUS),
                    keybinding: {
                        primary: 3 /* KeyCode.Enter */,
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                        when: null
                    },
                    title: nls.localize('settings.focusSettingsList', "Focus settings list")
                });
            }
            run(accessor) {
                const preferencesEditor = getPreferencesEditor(accessor);
                if (preferencesEditor instanceof SettingsEditor2) {
                    preferencesEditor.focusSettings();
                }
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: SETTINGS_EDITOR_COMMAND_FOCUS_TOC,
                    precondition: CONTEXT_SETTINGS_EDITOR,
                    f1: true,
                    keybinding: [
                        {
                            primary: 15 /* KeyCode.LeftArrow */,
                            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                            when: CONTEXT_SETTINGS_ROW_FOCUS
                        }
                    ],
                    category,
                    title: nls.localize2('settings.focusSettingsTOC', "Focus Settings Table of Contents")
                });
            }
            run(accessor) {
                const preferencesEditor = getPreferencesEditor(accessor);
                if (!(preferencesEditor instanceof SettingsEditor2)) {
                    return;
                }
                preferencesEditor.focusTOC();
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: SETTINGS_EDITOR_COMMAND_FOCUS_CONTROL,
                    precondition: ContextKeyExpr.and(CONTEXT_SETTINGS_EDITOR, CONTEXT_SETTINGS_ROW_FOCUS),
                    keybinding: {
                        primary: 3 /* KeyCode.Enter */,
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                    },
                    title: nls.localize('settings.focusSettingControl', "Focus Setting Control")
                });
            }
            run(accessor) {
                const preferencesEditor = getPreferencesEditor(accessor);
                if (!(preferencesEditor instanceof SettingsEditor2)) {
                    return;
                }
                const activeElement = preferencesEditor.getContainer()?.ownerDocument.activeElement;
                if (activeElement?.classList.contains('monaco-list')) {
                    preferencesEditor.focusSettings(true);
                }
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: SETTINGS_EDITOR_COMMAND_SHOW_CONTEXT_MENU,
                    precondition: CONTEXT_SETTINGS_EDITOR,
                    keybinding: {
                        primary: 1024 /* KeyMod.Shift */ | 67 /* KeyCode.F9 */,
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                        when: null
                    },
                    f1: true,
                    category,
                    title: nls.localize2('settings.showContextMenu', "Show Setting Context Menu")
                });
            }
            run(accessor) {
                const preferencesEditor = getPreferencesEditor(accessor);
                if (preferencesEditor instanceof SettingsEditor2) {
                    preferencesEditor.showContextMenu();
                }
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: SETTINGS_EDITOR_COMMAND_FOCUS_UP,
                    precondition: ContextKeyExpr.and(CONTEXT_SETTINGS_EDITOR, CONTEXT_SETTINGS_SEARCH_FOCUS.toNegated(), CONTEXT_SETTINGS_JSON_EDITOR.toNegated()),
                    keybinding: {
                        primary: 9 /* KeyCode.Escape */,
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                        when: null
                    },
                    f1: true,
                    category,
                    title: nls.localize2('settings.focusLevelUp', "Move Focus Up One Level")
                });
            }
            run(accessor) {
                const preferencesEditor = getPreferencesEditor(accessor);
                if (!(preferencesEditor instanceof SettingsEditor2)) {
                    return;
                }
                if (preferencesEditor.currentFocusContext === 3 /* SettingsFocusContext.SettingControl */) {
                    preferencesEditor.focusSettings();
                }
                else if (preferencesEditor.currentFocusContext === 2 /* SettingsFocusContext.SettingTree */) {
                    preferencesEditor.focusTOC();
                }
                else if (preferencesEditor.currentFocusContext === 1 /* SettingsFocusContext.TableOfContents */) {
                    preferencesEditor.focusSearch();
                }
            }
        }));
    }
    registerKeybindingsActions() {
        const that = this;
        const category = nls.localize2('preferences', "Preferences");
        const id = 'workbench.action.openGlobalKeybindings';
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id,
                    title: nls.localize2('openGlobalKeybindings', "Open Keyboard Shortcuts"),
                    shortTitle: nls.localize('keyboardShortcuts', "Keyboard Shortcuts"),
                    category,
                    icon: preferencesOpenSettingsIcon,
                    keybinding: {
                        when: null,
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                        primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 2048 /* KeyMod.CtrlCmd */ | 49 /* KeyCode.KeyS */)
                    },
                    menu: [
                        { id: MenuId.CommandPalette },
                        {
                            id: MenuId.EditorTitle,
                            when: ResourceContextKey.Resource.isEqualTo(that.userDataProfileService.currentProfile.keybindingsResource.toString()),
                            group: 'navigation',
                            order: 1,
                        },
                        {
                            id: MenuId.GlobalActivity,
                            group: '2_configuration',
                            order: 4
                        }
                    ]
                });
            }
            run(accessor, ...args) {
                const query = typeof args[0] === 'string' ? args[0] : undefined;
                const groupId = getEditorGroupFromArguments(accessor, args)?.id;
                return accessor.get(IPreferencesService).openGlobalKeybindingSettings(false, { query, groupId });
            }
        }));
        this._register(MenuRegistry.appendMenuItem(MenuId.MenubarPreferencesMenu, {
            command: {
                id,
                title: nls.localize('keyboardShortcuts', "Keyboard Shortcuts"),
            },
            group: '2_configuration',
            order: 4
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.openDefaultKeybindingsFile',
                    title: nls.localize2('openDefaultKeybindingsFile', "Open Default Keyboard Shortcuts (JSON)"),
                    category,
                    menu: { id: MenuId.CommandPalette }
                });
            }
            run(accessor) {
                return accessor.get(IPreferencesService).openDefaultKeybindingsFile();
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.openGlobalKeybindingsFile',
                    title: nls.localize2('openGlobalKeybindingsFile', "Open Keyboard Shortcuts (JSON)"),
                    category,
                    icon: preferencesOpenSettingsIcon,
                    menu: [
                        { id: MenuId.CommandPalette },
                        {
                            id: MenuId.EditorTitle,
                            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR),
                            group: 'navigation',
                        }
                    ]
                });
            }
            run(accessor, ...args) {
                const groupId = getEditorGroupFromArguments(accessor, args)?.id;
                return accessor.get(IPreferencesService).openGlobalKeybindingSettings(true, { groupId });
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: KEYBINDINGS_EDITOR_SHOW_DEFAULT_KEYBINDINGS,
                    title: nls.localize2('showDefaultKeybindings', "Show System Keybindings"),
                    menu: [
                        {
                            id: MenuId.EditorTitle,
                            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR),
                            group: '1_keyboard_preferences_actions'
                        }
                    ]
                });
            }
            run(accessor, ...args) {
                const group = getEditorGroupFromArguments(accessor, args);
                const editorPane = group?.activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.search('@source:system');
                }
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: KEYBINDINGS_EDITOR_SHOW_EXTENSION_KEYBINDINGS,
                    title: nls.localize2('showExtensionKeybindings', "Show Extension Keybindings"),
                    menu: [
                        {
                            id: MenuId.EditorTitle,
                            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR),
                            group: '1_keyboard_preferences_actions'
                        }
                    ]
                });
            }
            run(accessor, ...args) {
                const group = getEditorGroupFromArguments(accessor, args);
                const editorPane = group?.activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.search('@source:extension');
                }
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: KEYBINDINGS_EDITOR_SHOW_USER_KEYBINDINGS,
                    title: nls.localize2('showUserKeybindings', "Show User Keybindings"),
                    menu: [
                        {
                            id: MenuId.EditorTitle,
                            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR),
                            group: '1_keyboard_preferences_actions'
                        }
                    ]
                });
            }
            run(accessor, ...args) {
                const group = getEditorGroupFromArguments(accessor, args);
                const editorPane = group?.activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.search('@source:user');
                }
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: KEYBINDINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS,
                    title: nls.localize('clear', "Clear Search Results"),
                    keybinding: {
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                        when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDINGS_SEARCH_FOCUS),
                        primary: 9 /* KeyCode.Escape */,
                    }
                });
            }
            run(accessor) {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.clearSearchResults();
                }
            }
        }));
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: KEYBINDINGS_EDITOR_COMMAND_CLEAR_SEARCH_HISTORY,
                    title: nls.localize('clearHistory', "Clear Keyboard Shortcuts Search History"),
                    category,
                    menu: [
                        {
                            id: MenuId.CommandPalette,
                            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR),
                        }
                    ]
                });
            }
            run(accessor) {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.clearKeyboardShortcutSearchHistory();
                }
            }
        }));
        this.registerKeybindingEditorActions();
    }
    registerKeybindingEditorActions() {
        const that = this;
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: KEYBINDINGS_EDITOR_COMMAND_DEFINE,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS, CONTEXT_WHEN_FOCUS.toNegated()),
            primary: 3 /* KeyCode.Enter */,
            handler: (accessor, args) => {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.defineKeybinding(editorPane.activeKeybindingEntry, false);
                }
            }
        });
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: KEYBINDINGS_EDITOR_COMMAND_ADD,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS),
            primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 2048 /* KeyMod.CtrlCmd */ | 31 /* KeyCode.KeyA */),
            handler: (accessor, args) => {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.defineKeybinding(editorPane.activeKeybindingEntry, true);
                }
            }
        });
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: KEYBINDINGS_EDITOR_COMMAND_DEFINE_WHEN,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS),
            primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 2048 /* KeyMod.CtrlCmd */ | 35 /* KeyCode.KeyE */),
            handler: (accessor, args) => {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor && editorPane.activeKeybindingEntry.keybindingItem.keybinding) {
                    editorPane.defineWhenExpression(editorPane.activeKeybindingEntry);
                }
            }
        });
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: KEYBINDINGS_EDITOR_COMMAND_REMOVE,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS, InputFocusedContext.toNegated()),
            primary: 20 /* KeyCode.Delete */,
            mac: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 1 /* KeyCode.Backspace */
            },
            handler: (accessor, args) => {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.removeKeybinding(editorPane.activeKeybindingEntry);
                }
            }
        });
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: KEYBINDINGS_EDITOR_COMMAND_RESET,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS),
            primary: 0,
            handler: (accessor, args) => {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.resetKeybinding(editorPane.activeKeybindingEntry);
                }
            }
        });
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: KEYBINDINGS_EDITOR_COMMAND_SEARCH,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR),
            primary: 2048 /* KeyMod.CtrlCmd */ | 36 /* KeyCode.KeyF */,
            handler: (accessor, args) => {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.focusSearch();
                }
            }
        });
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: KEYBINDINGS_EDITOR_COMMAND_RECORD_SEARCH_KEYS,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDINGS_SEARCH_FOCUS),
            primary: 512 /* KeyMod.Alt */ | 41 /* KeyCode.KeyK */,
            mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 41 /* KeyCode.KeyK */ },
            handler: (accessor, args) => {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.recordSearchKeys();
                }
            }
        });
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: KEYBINDINGS_EDITOR_COMMAND_SORTBY_PRECEDENCE,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR),
            primary: 512 /* KeyMod.Alt */ | 46 /* KeyCode.KeyP */,
            mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 46 /* KeyCode.KeyP */ },
            handler: (accessor, args) => {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.toggleSortByPrecedence();
                }
            }
        });
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: KEYBINDINGS_EDITOR_COMMAND_SHOW_SIMILAR,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS),
            primary: 0,
            handler: (accessor, args) => {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.showSimilarKeybindings(editorPane.activeKeybindingEntry);
                }
            }
        });
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: KEYBINDINGS_EDITOR_COMMAND_COPY,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS, CONTEXT_WHEN_FOCUS.negate()),
            primary: 2048 /* KeyMod.CtrlCmd */ | 33 /* KeyCode.KeyC */,
            handler: async (accessor, args) => {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    await editorPane.copyKeybinding(editorPane.activeKeybindingEntry);
                }
            }
        });
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: KEYBINDINGS_EDITOR_COMMAND_COPY_COMMAND,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS),
            primary: 0,
            handler: async (accessor, args) => {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    await editorPane.copyKeybindingCommand(editorPane.activeKeybindingEntry);
                }
            }
        });
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: KEYBINDINGS_EDITOR_COMMAND_COPY_COMMAND_TITLE,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS),
            primary: 0,
            handler: async (accessor, args) => {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    await editorPane.copyKeybindingCommandTitle(editorPane.activeKeybindingEntry);
                }
            }
        });
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: KEYBINDINGS_EDITOR_COMMAND_FOCUS_KEYBINDINGS,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDINGS_SEARCH_FOCUS),
            primary: 2048 /* KeyMod.CtrlCmd */ | 18 /* KeyCode.DownArrow */,
            handler: (accessor, args) => {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.focusKeybindings();
                }
            }
        });
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: KEYBINDINGS_EDITOR_COMMAND_REJECT_WHEN,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_WHEN_FOCUS, SuggestContext.Visible.toNegated()),
            primary: 9 /* KeyCode.Escape */,
            handler: async (accessor, args) => {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.rejectWhenExpression(editorPane.activeKeybindingEntry);
                }
            }
        });
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: KEYBINDINGS_EDITOR_COMMAND_ACCEPT_WHEN,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_WHEN_FOCUS, SuggestContext.Visible.toNegated()),
            primary: 3 /* KeyCode.Enter */,
            handler: async (accessor, args) => {
                const editorPane = accessor.get(IEditorService).activeEditorPane;
                if (editorPane instanceof KeybindingsEditor) {
                    editorPane.acceptWhenExpression(editorPane.activeKeybindingEntry);
                }
            }
        });
        const profileScopedActionDisposables = this._register(new DisposableStore());
        const registerProfileScopedActions = () => {
            profileScopedActionDisposables.clear();
            profileScopedActionDisposables.add(registerAction2(class DefineKeybindingAction extends Action2 {
                constructor() {
                    const when = ResourceContextKey.Resource.isEqualTo(that.userDataProfileService.currentProfile.keybindingsResource.toString());
                    super({
                        id: 'editor.action.defineKeybinding',
                        title: nls.localize2('defineKeybinding.start', "Define Keybinding"),
                        f1: true,
                        precondition: when,
                        keybinding: {
                            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                            when,
                            primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */)
                        },
                        menu: {
                            id: MenuId.EditorContent,
                            when,
                        }
                    });
                }
                async run(accessor) {
                    const codeEditor = accessor.get(IEditorService).activeTextEditorControl;
                    if (isCodeEditor(codeEditor)) {
                        codeEditor.getContribution(DEFINE_KEYBINDING_EDITOR_CONTRIB_ID)?.showDefineKeybindingWidget();
                    }
                }
            }));
        };
        registerProfileScopedActions();
        this._register(this.userDataProfileService.onDidChangeCurrentProfile(() => registerProfileScopedActions()));
    }
    updatePreferencesEditorMenuItem() {
        const commandId = '_workbench.openWorkspaceSettingsEditor';
        if (this.workspaceContextService.getWorkbenchState() === 3 /* WorkbenchState.WORKSPACE */ && !CommandsRegistry.getCommand(commandId)) {
            CommandsRegistry.registerCommand(commandId, () => this.preferencesService.openWorkspaceSettings({ jsonEditor: false }));
            MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
                command: {
                    id: commandId,
                    title: OPEN_USER_SETTINGS_UI_TITLE,
                    icon: preferencesOpenSettingsIcon
                },
                when: ContextKeyExpr.and(ResourceContextKey.Resource.isEqualTo(this.preferencesService.workspaceSettingsResource.toString()), WorkbenchStateContext.isEqualTo('workspace'), ContextKeyExpr.not('isInDiffEditor')),
                group: 'navigation',
                order: 1
            });
        }
        this.updatePreferencesEditorMenuItemForWorkspaceFolders();
    }
    updatePreferencesEditorMenuItemForWorkspaceFolders() {
        for (const folder of this.workspaceContextService.getWorkspace().folders) {
            const commandId = `_workbench.openFolderSettings.${folder.uri.toString()}`;
            if (!CommandsRegistry.getCommand(commandId)) {
                CommandsRegistry.registerCommand(commandId, (accessor, ...args) => {
                    const groupId = getEditorGroupFromArguments(accessor, args)?.id;
                    if (this.workspaceContextService.getWorkbenchState() === 2 /* WorkbenchState.FOLDER */) {
                        return this.preferencesService.openWorkspaceSettings({ jsonEditor: false, groupId });
                    }
                    else {
                        return this.preferencesService.openFolderSettings({ folderUri: folder.uri, jsonEditor: false, groupId });
                    }
                });
                MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
                    command: {
                        id: commandId,
                        title: OPEN_USER_SETTINGS_UI_TITLE,
                        icon: preferencesOpenSettingsIcon
                    },
                    when: ContextKeyExpr.and(ResourceContextKey.Resource.isEqualTo(this.preferencesService.getFolderSettingsResource(folder.uri).toString()), ContextKeyExpr.not('isInDiffEditor')),
                    group: 'navigation',
                    order: 1
                });
            }
        }
    }
};
PreferencesActionsContribution = __decorate([
    __param(0, IWorkbenchEnvironmentService),
    __param(1, IUserDataProfileService),
    __param(2, IPreferencesService),
    __param(3, IWorkspaceContextService),
    __param(4, ILabelService),
    __param(5, IExtensionService),
    __param(6, IUserDataProfilesService)
], PreferencesActionsContribution);
let SettingsEditorTitleContribution = class SettingsEditorTitleContribution extends Disposable {
    static { this.ID = 'workbench.contrib.settingsEditorTitleBarActions'; }
    constructor(userDataProfileService, userDataProfilesService) {
        super();
        this.userDataProfileService = userDataProfileService;
        this.userDataProfilesService = userDataProfilesService;
        this.registerSettingsEditorTitleActions();
    }
    registerSettingsEditorTitleActions() {
        const registerOpenUserSettingsEditorFromJsonActionDisposables = this._register(new MutableDisposable());
        const registerOpenUserSettingsEditorFromJsonAction = () => {
            const openUserSettingsEditorWhen = ContextKeyExpr.and(CONTEXT_SETTINGS_EDITOR.toNegated(), ContextKeyExpr.or(ResourceContextKey.Resource.isEqualTo(this.userDataProfileService.currentProfile.settingsResource.toString()), ResourceContextKey.Resource.isEqualTo(this.userDataProfilesService.defaultProfile.settingsResource.toString())), ContextKeyExpr.not('isInDiffEditor'));
            registerOpenUserSettingsEditorFromJsonActionDisposables.clear();
            registerOpenUserSettingsEditorFromJsonActionDisposables.value = registerAction2(class extends Action2 {
                constructor() {
                    super({
                        id: '_workbench.openUserSettingsEditor',
                        title: OPEN_USER_SETTINGS_UI_TITLE,
                        icon: preferencesOpenSettingsIcon,
                        menu: [{
                                id: MenuId.EditorTitle,
                                when: openUserSettingsEditorWhen,
                                group: 'navigation',
                                order: 1
                            }]
                    });
                }
                run(accessor, ...args) {
                    const sanitizedArgs = sanitizeOpenSettingsArgs(args[0]);
                    const groupId = getEditorGroupFromArguments(accessor, args)?.id;
                    return accessor.get(IPreferencesService).openUserSettings({ jsonEditor: false, ...sanitizedArgs, groupId });
                }
            });
        };
        registerOpenUserSettingsEditorFromJsonAction();
        this._register(this.userDataProfileService.onDidChangeCurrentProfile(() => {
            // Force the action to check the context again.
            registerOpenUserSettingsEditorFromJsonAction();
        }));
        const openSettingsJsonWhen = ContextKeyExpr.and(CONTEXT_SETTINGS_JSON_EDITOR.toNegated(), CONTEXT_SETTINGS_EDITOR);
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: SETTINGS_EDITOR_COMMAND_SWITCH_TO_JSON,
                    title: nls.localize2('openSettingsJson', "Open Settings (JSON)"),
                    icon: preferencesOpenSettingsIcon,
                    menu: [{
                            id: MenuId.EditorTitle,
                            when: openSettingsJsonWhen,
                            group: 'navigation',
                            order: 1
                        }]
                });
            }
            run(accessor, ...args) {
                const group = getEditorGroupFromArguments(accessor, args);
                const editorPane = group?.activeEditorPane;
                if (editorPane instanceof SettingsEditor2) {
                    return editorPane.switchToSettingsFile();
                }
                return null;
            }
        }));
    }
};
SettingsEditorTitleContribution = __decorate([
    __param(0, IUserDataProfileService),
    __param(1, IUserDataProfilesService)
], SettingsEditorTitleContribution);
let SettingsEditorContribution = class SettingsEditorContribution extends Disposable {
    static { this.ID = 'editor.contrib.settings'; }
    constructor(editor, instantiationService, preferencesService, workspaceContextService) {
        super();
        this.editor = editor;
        this.instantiationService = instantiationService;
        this.preferencesService = preferencesService;
        this.workspaceContextService = workspaceContextService;
        this.disposables = this._register(new DisposableStore());
        this._createPreferencesRenderer();
        this._register(this.editor.onDidChangeModel(e => this._createPreferencesRenderer()));
        this._register(this.workspaceContextService.onDidChangeWorkbenchState(() => this._createPreferencesRenderer()));
    }
    async _createPreferencesRenderer() {
        this.disposables.clear();
        this.currentRenderer = undefined;
        const model = this.editor.getModel();
        if (model && /\.(json|code-workspace)$/.test(model.uri.path)) {
            // Fast check: the preferences renderer can only appear
            // in settings files or workspace files
            const settingsModel = await this.preferencesService.createPreferencesEditorModel(model.uri);
            if (settingsModel instanceof SettingsEditorModel && this.editor.getModel()) {
                this.disposables.add(settingsModel);
                switch (settingsModel.configurationTarget) {
                    case 5 /* ConfigurationTarget.WORKSPACE */:
                        this.currentRenderer = this.disposables.add(this.instantiationService.createInstance(WorkspaceSettingsRenderer, this.editor, settingsModel));
                        break;
                    default:
                        this.currentRenderer = this.disposables.add(this.instantiationService.createInstance(UserSettingsRenderer, this.editor, settingsModel));
                        break;
                }
            }
            this.currentRenderer?.render();
        }
    }
};
SettingsEditorContribution = __decorate([
    __param(1, IInstantiationService),
    __param(2, IPreferencesService),
    __param(3, IWorkspaceContextService)
], SettingsEditorContribution);
function getEditorGroupFromArguments(accessor, args) {
    const context = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
    return context.groupedEditors[0]?.group;
}
registerWorkbenchContribution2(PreferencesActionsContribution.ID, PreferencesActionsContribution, 1 /* WorkbenchPhase.BlockStartup */);
registerWorkbenchContribution2(PreferencesContribution.ID, PreferencesContribution, 1 /* WorkbenchPhase.BlockStartup */);
registerWorkbenchContribution2(SettingsEditorTitleContribution.ID, SettingsEditorTitleContribution, 3 /* WorkbenchPhase.AfterRestored */);
registerEditorContribution(SettingsEditorContribution.ID, SettingsEditorContribution, 1 /* EditorContributionInstantiation.AfterFirstRender */);
// Preferences menu
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
    title: nls.localize({ key: 'miPreferences', comment: ['&& denotes a mnemonic'] }, "&&Preferences"),
    submenu: MenuId.MenubarPreferencesMenu,
    group: '5_autosave',
    order: 2,
    when: IsMacNativeContext.toNegated() // on macOS native the preferences menu is separate under the application menu
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmVyZW5jZXMuY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3ByZWZlcmVuY2VzL2Jyb3dzZXIvcHJlZmVyZW5jZXMuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQW1CLE1BQU0scUNBQXFDLENBQUM7QUFDaEYsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN0RyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDakYsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBZSxZQUFZLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUN4RixPQUFPLEVBQW1DLDBCQUEwQixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDN0gsT0FBTyxFQUFFLE9BQU8sSUFBSSxjQUFjLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNsRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9CQUFvQixDQUFDO0FBQzFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUMxRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEgsT0FBTyxFQUFFLGdCQUFnQixFQUFFLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBRXJHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN0RixPQUFPLEVBQUUsbUJBQW1C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