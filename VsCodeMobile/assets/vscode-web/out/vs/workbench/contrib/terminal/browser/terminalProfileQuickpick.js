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
import { Codicon } from '../../../../base/common/codicons.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { getUriClasses, getColorClass, createColorStyleElement } from './terminalIcon.js';
import { configureTerminalProfileIcon } from './terminalIcons.js';
import * as nls from '../../../../nls.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { ITerminalProfileResolverService, ITerminalProfileService } from '../common/terminal.js';
import { getIconRegistry } from '../../../../platform/theme/common/iconRegistry.js';
import { basename } from '../../../../base/common/path.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { hasKey, isString } from '../../../../base/common/types.js';
let TerminalProfileQuickpick = class TerminalProfileQuickpick {
    constructor(_terminalProfileService, _terminalProfileResolverService, _configurationService, _quickInputService, _themeService, _notificationService) {
        this._terminalProfileService = _terminalProfileService;
        this._terminalProfileResolverService = _terminalProfileResolverService;
        this._configurationService = _configurationService;
        this._quickInputService = _quickInputService;
        this._themeService = _themeService;
        this._notificationService = _notificationService;
    }
    async showAndGetResult(type) {
        const platformKey = await this._terminalProfileService.getPlatformKey();
        const profilesKey = "terminal.integrated.profiles." /* TerminalSettingPrefix.Profiles */ + platformKey;
        const result = await this._createAndShow(type);
        const defaultProfileKey = `${"terminal.integrated.defaultProfile." /* TerminalSettingPrefix.DefaultProfile */}${platformKey}`;
        if (!result) {
            return;
        }
        if (type === 'setDefault') {
            if (hasKey(result.profile, { id: true })) {
                // extension contributed profile
                await this._configurationService.updateValue(defaultProfileKey, result.profile.title, 2 /* ConfigurationTarget.USER */);
                return {
                    config: {
                        extensionIdentifier: result.profile.extensionIdentifier,
                        id: result.profile.id,
                        title: result.profile.title,
                        options: {
                            color: result.profile.color,
                            icon: result.profile.icon
                        }
                    },
                    keyMods: result.keyMods
                };
            }
            // Add the profile to settings if necessary
            if (hasKey(result.profile, { profileName: true })) {
                const profilesConfig = await this._configurationService.getValue(profilesKey);
                if (typeof profilesConfig === 'object') {
                    const newProfile = {
                        path: result.profile.path
                    };
                    if (result.profile.args) {
                        newProfile.args = result.profile.args;
                    }
                    profilesConfig[result.profile.profileName] = this._createNewProfileConfig(result.profile);
                    await this._configurationService.updateValue(profilesKey, profilesConfig, 2 /* ConfigurationTarget.USER */);
                }
            }
            // Set the default profile
            await this._configurationService.updateValue(defaultProfileKey, result.profileName, 2 /* ConfigurationTarget.USER */);
        }
        else if (type === 'createInstance') {
            if (hasKey(result.profile, { id: true })) {
                return {
                    config: {
                        extensionIdentifier: result.profile.extensionIdentifier,
                        id: result.profile.id,
                        title: result.profile.title,
                        options: {
                            icon: result.profile.icon,
                            color: result.profile.color,
                        }
                    },
                    keyMods: result.keyMods
                };
            }
            else {
                return { config: result.profile, keyMods: result.keyMods };
            }
        }
        // for tests
        return hasKey(result.profile, { profileName: true }) ? result.profile.profileName : result.profile.title;
    }
    async _createAndShow(type) {
        const platformKey = await this._terminalProfileService.getPlatformKey();
        const profiles = this._terminalProfileService.availableProfiles;
        const profilesKey = "terminal.integrated.profiles." /* TerminalSettingPrefix.Profiles */ + platformKey;
        const defaultProfileName = this._terminalProfileService.getDefaultProfileName();
        let keyMods;
        const options = {
            placeHolder: type === 'createInstance' ? nls.localize('terminal.integrated.selectProfileToCreate', "Select the terminal profile to create") : nls.localize('terminal.integrated.chooseDefaultProfile', "Select your default terminal profile"),
            onDidTriggerItemButton: async (context) => {
                // Get the user's explicit permission to use a potentially unsafe path
                if (!await this._isProfileSafe(context.item.profile)) {
                    return;
                }
                if (hasKey(context.item.profile, { id: true })) {
                    return;
                }
                const configProfiles = this._configurationService.getValue("terminal.integrated.profiles." /* TerminalSettingPrefix.Profiles */ + platformKey);
                const existingProfiles = !!configProfiles ? Object.keys(configProfiles) : [];
                const name = await this._quickInputService.input({
                    prompt: nls.localize('enterTerminalProfileName', "Enter terminal profile name"),
                    value: context.item.profile.profileName,
                    validateInput: async (input) => {
                        if (existingProfiles.includes(input)) {
                            return nls.localize('terminalProfileAlreadyExists', "A terminal profile already exists with that name");
                        }
                        return undefined;
                    }
                });
                if (!name) {
                    return;
                }
                const newConfigValue = {
                    ...configProfiles,
                    [name]: this._createNewProfileConfig(context.item.profile)
                };
                await this._configurationService.updateValue(profilesKey, newConfigValue, 2 /* ConfigurationTarget.USER */);
            },
            onKeyMods: mods => keyMods = mods
        };
        // Build quick pick items
        const quickPickItems = [];
        const configProfiles = profiles.filter(e => !e.isAutoDetected);
        const autoDetectedProfiles = profiles.filter(e => e.isAutoDetected);
        if (configProfiles.length > 0) {
            quickPickItems.push({ type: 'separator', label: nls.localize('terminalProfiles', "profiles") });
            quickPickItems.push(...this._sortProfileQuickPickItems(configProfiles.map(e => this._createProfileQuickPickItem(e)), defaultProfileName));
        }
        quickPickItems.push({ type: 'separator', label: nls.localize('ICreateContributedTerminalProfileOptions', "contributed") });
        const contributedProfiles = [];
        for (const contributed of this._terminalProfileService.contributedProfiles) {
            let icon;
            if (isString(contributed.icon)) {
                if (contributed.icon.startsWith('$(')) {
                    icon = ThemeIcon.fromString(contributed.icon);
                }
                else {
                    icon = ThemeIcon.fromId(contributed.icon);
                }
            }
            if (!icon || !getIconRegistry().getIcon(icon.id)) {
                icon = this._terminalProfileResolverService.getDefaultIcon();
            }
            const uriClasses = getUriClasses(contributed, this._themeService.getColorTheme().type, true);
            const colorClass = getColorClass(contributed);
            const iconClasses = [];
            if (uriClasses) {
                iconClasses.push(...uriClasses);
            }
            if (colorClass) {
                iconClasses.push(colorClass);
            }
            contributedProfiles.push({
                label: `$(${icon.id}) ${contributed.title}`,
                profile: {
                    extensionIdentifier: contributed.extensionIdentifier,
                    title: contributed.title,
                    icon: contributed.icon,
                    id: contributed.id,
                    color: contributed.color
                },
                profileName: contributed.title,
                iconClasses
            });
        }
        if (contributedProfiles.length > 0) {
            quickPickItems.push(...this._sortProfileQuickPickItems(contributedProfiles, defaultProfileName));
        }
        if (autoDetectedProfiles.length > 0) {
            quickPickItems.push({ type: 'separator', label: nls.localize('terminalProfiles.detected', "detected") });
            quickPickItems.push(...this._sortProfileQuickPickItems(autoDetectedProfiles.map(e => this._createProfileQuickPickItem(e)), defaultProfileName));
        }
        const colorStyleDisposable = createColorStyleElement(this._themeService.getColorTheme());
        const result = await this._quickInputService.pick(quickPickItems, options);
        colorStyleDisposable.dispose();
        if (!result) {
            return undefined;
        }
        if (!await this._isProfileSafe(result.profile)) {
            return undefined;
        }
        if (keyMods) {
            result.keyMods = keyMods;
        }
        return result;
    }
    _createNewProfileConfig(profile) {
        const result = { path: profile.path };
        if (profile.args) {
            result.args = profile.args;
        }
        if (profile.env) {
            result.env = profile.env;
        }
        return result;
    }
    async _isProfileSafe(profile) {
        const isUnsafePath = hasKey(profile, { profileName: true }) && profile.isUnsafePath;
        const requiresUnsafePath = hasKey(profile, { profileName: true }) && profile.requiresUnsafePath;
        if (!isUnsafePath && !requiresUnsafePath) {
            return true;
        }
        // Get the user's explicit permission to use a potentially unsafe path
        return await new Promise(r => {
            const unsafePaths = [];
            if (isUnsafePath) {
                unsafePaths.push(profile.path);
            }
            if (requiresUnsafePath) {
                unsafePaths.push(requiresUnsafePath);
            }
            // Notify about unsafe path(s). At the time of writing, multiple unsafe paths isn't
            // possible so the message is optimized for a single path.
            const handle = this._notificationService.prompt(Severity.Warning, nls.localize('unsafePathWarning', 'This terminal profile uses a potentially unsafe path that can be modified by another user: {0}. Are you sure you want to use it?', `"${unsafePaths.join(',')}"`), [{
                    label: nls.localize('yes', 'Yes'),
                    run: () => r(true)
                }, {
                    label: nls.localize('cancel', 'Cancel'),
                    run: () => r(false)
                }]);
            handle.onDidClose(() => r(false));
        });
    }
    _createProfileQuickPickItem(profile) {
        const buttons = [{
                iconClass: ThemeIcon.asClassName(configureTerminalProfileIcon),
                tooltip: nls.localize('createQuickLaunchProfile', "Configure Terminal Profile")
            }];
        const icon = (profile.icon && ThemeIcon.isThemeIcon(profile.icon)) ? profile.icon : Codicon.terminal;
        const label = `$(${icon.id}) ${profile.profileName}`;
        const friendlyPath = profile.isFromPath ? basename(profile.path) : profile.path;
        const colorClass = getColorClass(profile);
        const iconClasses = [];
        if (colorClass) {
            iconClasses.push(colorClass);
        }
        if (profile.args) {
            if (isString(profile.args)) {
                return { label, description: `${profile.path} ${profile.args}`, profile, profileName: profile.profileName, buttons, iconClasses };
            }
            const argsString = profile.args.map(e => {
                if (e.includes(' ')) {
                    return `"${e.replace(/"/g, '\\"')}"`; // CodeQL [SM02383] js/incomplete-sanitization This is only used as a label on the UI so this isn't a problem
                }
                return e;
            }).join(' ');
            return { label, description: `${friendlyPath} ${argsString}`, profile, profileName: profile.profileName, buttons, iconClasses };
        }
        return { label, description: friendlyPath, profile, profileName: profile.profileName, buttons, iconClasses };
    }
    _sortProfileQuickPickItems(items, defaultProfileName) {
        return items.sort((a, b) => {
            if (b.profileName === defaultProfileName) {
                return 1;
            }
            if (a.profileName === defaultProfileName) {
                return -1;
            }
            return a.profileName.localeCompare(b.profileName);
        });
    }
};
TerminalProfileQuickpick = __decorate([
    __param(0, ITerminalProfileService),
    __param(1, ITerminalProfileResolverService),
    __param(2, IConfigurationService),
    __param(3, IQuickInputService),
    __param(4, IThemeService),
    __param(5, INotificationService)
], TerminalProfileQuickpick);
export { TerminalProfileQuickpick };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxQcm9maWxlUXVpY2twaWNrLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL2Jyb3dzZXIvdGVybWluYWxQcm9maWxlUXVpY2twaWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQXVCLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDeEgsT0FBTyxFQUFFLGtCQUFrQixFQUFrRixNQUFNLHNEQUFzRCxDQUFDO0FBRTFLLE9BQU8sRUFBRSxhQUFhLEVBQUUsYUFBYSxFQUFFLHVCQUF1QixFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDMUYsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDbEUsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSwrQkFBK0IsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBR2pHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNwRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDM0QsT0FBTyxFQUFFLG9CQUFvQixFQUFFLFFBQVEsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzFHLE9BQU8sRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFJN0QsSUFBTSx3QkFBd0IsR0FBOUIsTUFBTSx3QkFBd0I7SUFDcEMsWUFDMkMsdUJBQWdELEVB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