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
import * as arrays from '../../../../base/common/arrays.js';
import * as objects from '../../../../base/common/objects.js';
import { AutoOpenBarrier } from '../../../../base/common/async.js';
import { throttle } from '../../../../base/common/decorators.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { isMacintosh, isWeb, isWindows, OS } from '../../../../base/common/platform.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { registerTerminalDefaultProfileConfiguration } from '../../../../platform/terminal/common/terminalPlatformConfiguration.js';
import { terminalIconsEqual, terminalProfileArgsMatch } from '../../../../platform/terminal/common/terminalProfiles.js';
import { ITerminalInstanceService } from './terminal.js';
import { refreshTerminalActions } from './terminalActions.js';
import { TerminalContextKeys } from '../common/terminalContextKey.js';
import { ITerminalContributionService } from '../common/terminalExtensionPoints.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { hasKey, isString } from '../../../../base/common/types.js';
/*
 * Links TerminalService with TerminalProfileResolverService
 * and keeps the available terminal profiles updated
 */
let TerminalProfileService = class TerminalProfileService extends Disposable {
    get onDidChangeAvailableProfiles() { return this._onDidChangeAvailableProfiles.event; }
    get profilesReady() { return this._profilesReadyPromise; }
    get availableProfiles() {
        if (!this._platformConfigJustRefreshed) {
            this.refreshAvailableProfiles();
        }
        return this._availableProfiles || [];
    }
    get contributedProfiles() {
        const userConfiguredProfileNames = this._availableProfiles?.map(p => p.profileName) || [];
        // Allow a user defined profile to override an extension contributed profile with the same name
        return this._contributedProfiles?.filter(p => !userConfiguredProfileNames.includes(p.title)) || [];
    }
    constructor(_contextKeyService, _configurationService, _terminalContributionService, _extensionService, _remoteAgentService, _environmentService, _terminalInstanceService) {
        super();
        this._contextKeyService = _contextKeyService;
        this._configurationService = _configurationService;
        this._terminalContributionService = _terminalContributionService;
        this._extensionService = _extensionService;
        this._remoteAgentService = _remoteAgentService;
        this._environmentService = _environmentService;
        this._terminalInstanceService = _terminalInstanceService;
        this._contributedProfiles = [];
        this._platformConfigJustRefreshed = false;
        this._refreshTerminalActionsDisposable = this._register(new MutableDisposable());
        this._profileProviders = new Map();
        this._onDidChangeAvailableProfiles = this._register(new Emitter());
        // in web, we don't want to show the dropdown unless there's a web extension
        // that contributes a profile
        this._register(this._extensionService.onDidChangeExtensions(() => this.refreshAvailableProfiles()));
        this._webExtensionContributedProfileContextKey = TerminalContextKeys.webExtensionContributedProfile.bindTo(this._contextKeyService);
        this._updateWebContextKey();
        this._profilesReadyPromise = this._remoteAgentService.getEnvironment()
            .then(() => {
            // Wait up to 20 seconds for profiles to be ready so it's assured that we know the actual
            // default terminal before launching the first terminal. This isn't expected to ever take
            // this long.
            this._profilesReadyBarrier = new AutoOpenBarrier(20000);
            return this._profilesReadyBarrier.wait().then(() => { });
        });
        this.refreshAvailableProfiles();
        this._setupConfigListener();
    }
    async _setupConfigListener() {
        const platformKey = await this.getPlatformKey();
        this._register(this._configurationService.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration("terminal.integrated.automationProfile." /* TerminalSettingPrefix.AutomationProfile */ + platformKey) ||
                e.affectsConfiguration("terminal.integrated.defaultProfile." /* TerminalSettingPrefix.DefaultProfile */ + platformKey) ||
                e.affectsConfiguration("terminal.integrated.profiles." /* TerminalSettingPrefix.Profiles */ + platformKey) ||
                e.affectsConfiguration("terminal.integrated.useWslProfiles" /* TerminalSettingId.UseWslProfiles */)) {
                if (e.source !== 7 /* ConfigurationTarget.DEFAULT */) {
                    // when _refreshPlatformConfig is called within refreshAvailableProfiles
                    // on did change configuration is fired. this can lead to an infinite recursion
                    this.refreshAvailableProfiles();
                    this._platformConfigJustRefreshed = false;
                }
                else {
                    this._platformConfigJustRefreshed = true;
                }
            }
        }));
    }
    getDefaultProfileName() {
        return this._defaultProfileName;
    }
    getDefaultProfile(os) {
        let defaultProfileName;
        if (os) {
            defaultProfileName = this._configurationService.getValue(`${"terminal.integrated.defaultProfile." /* TerminalSettingPrefix.DefaultProfile */}${this._getOsKey(os)}`);
            if (!defaultProfileName || !isString(defaultProfileName)) {
                return undefined;
            }
        }
        else {
            defaultProfileName = this._defaultProfileName;
        }
        if (!defaultProfileName) {
            return undefined;
        }
        // IMPORTANT: Only allow the default profile name to find non-auto detected profiles as
        // to avoid unsafe path profiles being picked up.
        return this.availableProfiles.find(e => e.profileName === defaultProfileName && !e.isAutoDetected);
    }
    _getOsKey(os) {
        switch (os) {
            case 3 /* OperatingSystem.Linux */: return 'linux';
            case 2 /* OperatingSystem.Macintosh */: return 'osx';
            case 1 /* OperatingSystem.Windows */: return 'windows';
        }
    }
    refreshAvailableProfiles() {
        this._refreshAvailableProfilesNow();
    }
    async _refreshAvailableProfilesNow() {
        // Profiles
        const profiles = await this._detectProfiles(true);
        const profilesChanged = !arrays.equals(profiles, this._availableProfiles, profilesEqual);
        // Contributed profiles
        const contributedProfilesChanged = await this._updateContributedProfiles();
        // Automation profiles
        const platform = await this.getPlatformKey();
        const automationProfile = this._configurationService.getValue(`${"terminal.integrated.automationProfile." /* TerminalSettingPrefix.AutomationProfile */}${platform}`);
        const automationProfileChanged = !objects.equals(automationProfile, this._automationProfile);
        // Update
        if (profilesChanged || contributedProfilesChanged || automationProfileChanged) {
            this._availableProfiles = profiles;
            this._automationProfile = automationProfile;
            this._onDidChangeAvailableProfiles.fire(this._availableProfiles);
            this._profilesReadyBarrier.open();
            this._updateWebContextKey();
            await this._refreshPlatformConfig(this._availableProfiles);
        }
    }
    async _updateContributedProfiles() {
        const platformKey = await this.getPlatformKey();
        const excludedContributedProfiles = [];
        const configProfiles = this._configurationService.getValue("terminal.integrated.profiles." /* TerminalSettingPrefix.Profiles */ + platformKey);
        for (const [profileName, value] of Object.entries(configProfiles)) {
            if (value === null) {
                excludedContributedProfiles.push(profileName);
            }
        }
        const filteredContributedProfiles = Array.from(this._terminalContributionService.terminalProfiles.filter(p => !excludedContributedProfiles.includes(p.title)));
        const contributedProfilesChanged = !arrays.equals(filteredContributedProfiles, this._contributedProfiles, contributedProfilesEqual);
        this._contributedProfiles = filteredContributedProfiles;
        return contributedProfilesChanged;
    }
    getContributedProfileProvider(extensionIdentifier, id) {
        const extMap = this._profileProviders.get(extensionIdentifier);
        return extMap?.get(id);
    }
    async _detectProfiles(includeDetectedProfiles) {
        const primaryBackend = await this._terminalInstanceService.getBackend(this._environmentService.remoteAuthority);
        if (!primaryBackend) {
            return this._availableProfiles || [];
        }
        const platform = await this.getPlatformKey();
        this._defaultProfileName = this._configurationService.getValue(`${"terminal.integrated.defaultProfile." /* TerminalSettingPrefix.DefaultProfile */}${platform}`) ?? undefined;
        return primaryBackend.getProfiles(this._configurationService.getValue(`${"terminal.integrated.profiles." /* TerminalSettingPrefix.Profiles */}${platform}`), this._defaultProfileName, includeDetectedProfiles);
    }
    _updateWebContextKey() {
        this._webExtensionContributedProfileContextKey.set(isWeb && this._contributedProfiles.length > 0);
    }
    async _refreshPlatformConfig(profiles) {
        const env = await this._remoteAgentService.getEnvironment();
        registerTerminalDefaultProfileConfiguration({ os: env?.os || OS, profiles }, this._contributedProfiles);
        this._refreshTerminalActionsDisposable.value = refreshTerminalActions(profiles);
    }
    async getPlatformKey() {
        const env = await this._remoteAgentService.getEnvironment();
        if (env) {
            return env.os === 1 /* OperatingSystem.Windows */ ? 'windows' : (env.os === 2 /* OperatingSystem.Macintosh */ ? 'osx' : 'linux');
        }
        return isWindows ? 'windows' : (isMacintosh ? 'osx' : 'linux');
    }
    registerTerminalProfileProvider(extensionIdentifier, id, profileProvider) {
        let extMap = this._profileProviders.get(extensionIdentifier);
        if (!extMap) {
            extMap = new Map();
            this._profileProviders.set(extensionIdentifier, extMap);
        }
        extMap.set(id, profileProvider);
        return toDisposable(() => this._profileProviders.delete(id));
    }
    async registerContributedProfile(args) {
        const platformKey = await this.getPlatformKey();
        const profilesConfig = await this._configurationService.getValue(`${"terminal.integrated.profiles." /* TerminalSettingPrefix.Profiles */}${platformKey}`);
        if (typeof profilesConfig === 'object') {
            const newProfile = {
                extensionIdentifier: args.extensionIdentifier,
                icon: args.options.icon,
                id: args.id,
                title: args.title,
                color: args.options.color
            };
            profilesConfig[args.title] = newProfile;
        }
        await this._configurationService.updateValue(`${"terminal.integrated.profiles." /* TerminalSettingPrefix.Profiles */}${platformKey}`, profilesConfig, 2 /* ConfigurationTarget.USER */);
        return;
    }
    async getContributedDefaultProfile(shellLaunchConfig) {
        // prevents recursion with the MainThreadTerminalService call to create terminal
        // and defers to the provided launch config when an executable is provided
        if (shellLaunchConfig && !shellLaunchConfig.extHostTerminalId && !hasKey(shellLaunchConfig, { executable: true })) {
            const key = await this.getPlatformKey();
            const defaultProfileName = this._configurationService.getValue(`${"terminal.integrated.defaultProfile." /* TerminalSettingPrefix.DefaultProfile */}${key}`);
            const contributedDefaultProfile = this.contributedProfiles.find(p => p.title === defaultProfileName);
            return contributedDefaultProfile;
        }
        return undefined;
    }
};
__decorate([
    throttle(2000)
], TerminalProfileService.prototype, "refreshAvailableProfiles", null);
TerminalProfileService = __decorate([
    __param(0, IContextKeyService),
    __param(1, IConfigurationService),
    __param(2, ITerminalContributionService),
    __param(3, IExtensionService),
    __param(4, IRemoteAgentService),
    __param(5, IWorkbenchEnvironmentService),
    __param(6, ITerminalInstanceService)
], TerminalProfileService);
export { TerminalProfileService };
function profilesEqual(one, other) {
    return one.profileName === other.profileName &&
        terminalProfileArgsMatch(one.args, other.args) &&
        one.color === other.color &&
        terminalIconsEqual(one.icon, other.icon) &&
        one.isAutoDetected === other.isAutoDetected &&
        one.isDefault === other.isDefault &&
        one.overrideName === other.overrideName &&
        one.path === other.path;
}
function contributedProfilesEqual(one, other) {
    return one.extensionIdentifier === other.extensionIdentifier &&
        one.color === other.color &&
        one.icon === other.icon &&
        one.id === other.id &&
        one.title === other.title;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxQcm9maWxlU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsUHJvZmlsZVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLE1BQU0sTUFBTSxtQ0FBbUMsQ0FBQztBQUM1RCxPQUFPLEtBQUssT0FBTyxNQUFNLG9DQUFvQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDakUsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxVQUFVLEVBQWUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDaEgsT0FBTyxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFtQixFQUFFLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN6RyxPQUFPLEVBQXVCLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDeEgsT0FBTyxFQUFlLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFdkcsT0FBTyxFQUFFLDJDQUEyQyxFQUFFLE1BQU0sdUVBQXVFLENBQUM7QUFDcEksT0FBTyxFQUFFLGtCQUFrQixFQUFFLHdCQUF3QixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDeEgsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3pELE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBRTlELE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3RFLE9BQU8s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