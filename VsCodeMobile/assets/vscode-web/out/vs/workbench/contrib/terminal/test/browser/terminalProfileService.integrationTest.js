/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { deepStrictEqual } from 'assert';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter } from '../../../../../base/common/event.js';
import { isLinux, isWindows } from '../../../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { TestThemeService } from '../../../../../platform/theme/test/common/testThemeService.js';
import { ITerminalInstanceService } from '../../browser/terminal.js';
import { TerminalProfileQuickpick } from '../../browser/terminalProfileQuickpick.js';
import { TerminalProfileService } from '../../browser/terminalProfileService.js';
import { ITerminalProfileService } from '../../common/terminal.js';
import { ITerminalContributionService } from '../../common/terminalExtensionPoints.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { IRemoteAgentService } from '../../../../services/remote/common/remoteAgentService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { TestExtensionService } from '../../../../test/common/workbenchTestServices.js';
class TestTerminalProfileService extends TerminalProfileService {
    refreshAvailableProfiles() {
        this.hasRefreshedProfiles = this._refreshAvailableProfilesNow();
    }
    refreshAndAwaitAvailableProfiles() {
        this.refreshAvailableProfiles();
        if (!this.hasRefreshedProfiles) {
            throw new Error('has not refreshed profiles yet');
        }
        return this.hasRefreshedProfiles;
    }
}
class MockTerminalProfileService {
    constructor() {
        this.availableProfiles = [];
        this.contributedProfiles = [];
    }
    async getPlatformKey() {
        return 'linux';
    }
    getDefaultProfileName() {
        return this._defaultProfileName;
    }
    setProfiles(profiles, contributed) {
        this.availableProfiles = profiles;
        this.contributedProfiles = contributed;
    }
    setDefaultProfileName(name) {
        this._defaultProfileName = name;
    }
}
class MockQuickInputService {
    constructor() {
        this._pick = powershellPick;
    }
    async pick(picks, options, token) {
        Promise.resolve(picks);
        return this._pick;
    }
    setPick(pick) {
        this._pick = pick;
    }
}
class TestTerminalProfileQuickpick extends TerminalProfileQuickpick {
}
class TestTerminalExtensionService extends TestExtensionService {
    constructor() {
        super(...arguments);
        this._onDidChangeExtensions = new Emitter();
    }
}
class TestTerminalContributionService {
    constructor() {
        this.terminalProfiles = [];
        this.terminalCompletionProviders = [];
        this._onDidChangeTerminalCompletionProviders = new Emitter();
        this.onDidChangeTerminalCompletionProviders = this._onDidChangeTerminalCompletionProviders.event;
    }
    setProfiles(profiles) {
        this.terminalProfiles = profiles;
    }
}
class TestTerminalInstanceService {
    constructor() {
        this._profiles = new Map();
        this._hasReturnedNone = true;
    }
    async getBackend(remoteAuthority) {
        return {
            getProfiles: async () => {
                if (this._hasReturnedNone) {
                    return this._profiles.get(remoteAuthority ?? '') || [];
                }
                else {
                    this._hasReturnedNone = true;
                    return [];
                }
            }
        };
    }
    setProfiles(remoteAuthority, profiles) {
        this._profiles.set(remoteAuthority ?? '', profiles);
    }
    setReturnNone() {
        this._hasReturnedNone = false;
    }
}
class TestRemoteAgentService {
    setEnvironment(os) {
        this._os = os;
    }
    async getEnvironment() {
        return { os: this._os };
    }
}
const defaultTerminalConfig = { profiles: { windows: {}, linux: {}, osx: {} } };
let powershellProfile = {
    profileName: 'PowerShell',
    path: 'C:\\Powershell.exe',
    isDefault: true,
    icon: Codicon.terminalPowershell
};
let jsdebugProfile = {
    extensionIdentifier: 'ms-vscode.js-debug-nightly',
    icon: 'debug',
    id: 'extension.js-debug.debugTerminal',
    title: 'JavaScript Debug Terminal'
};
const powershellPick = { label: 'Powershell', profile: powershellProfile, profileName: powershellProfile.profileName };
const jsdebugPick = { label: 'Javascript Debug Terminal', profile: jsdebugProfile, profileName: jsdebugProfile.title };
suite('TerminalProfileService', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let configurationService;
    let terminalInstanceService;
    let terminalProfileService;
    let remoteAgentService;
    let extensionService;
    let instantiationService;
    setup(async () => {
        configurationService = new TestConfigurationService({
            files: {},
            terminal: {
                integrated: defaultTerminalConfig
            }
        });
        instantiationService = workbenchInstantiationService({
            configurationService: () => configurationService
        }, store);
        remoteAgentService = new TestRemoteAgentService();
        terminalInstanceService = new TestTerminalInstanceService();
        extensionService = new TestTerminalExtensionService();
        const themeService = new TestThemeService();
        const terminalContributionService = new TestTerminalContributionService();
        instantiationService.stub(IExtensionService, extensionService);
        instantiationService.stub(IConfigurationService, configurationService);
        instantiationService.stub(IRemoteAgentService, remoteAgentService);
        instantiationService.stub(ITerminalContributionService, terminalContributionService);
        instantiationService.stub(ITerminalInstanceService, terminalInstanceService);
        instantiationService.stub(IWorkbenchEnvironmentService, { remoteAuthority: undefined });
        instantiationService.stub(IThemeService, themeService);
        terminalProfileService = store.add(instantiationService.createInstance(TestTerminalProfileService));
        //reset as these properties are changed in each test
        powershellProfile = {
            profileName: 'PowerShell',
            path: 'C:\\Powershell.exe',
            isDefault: true,
            icon: Codicon.terminalPowershell
        };
        jsdebugProfile = {
            extensionIdentifier: 'ms-vscode.js-debug-nightly',
            icon: 'debug',
            id: 'extension.js-debug.debugTerminal',
            title: 'JavaScript Debug Terminal'
        };
        terminalInstanceService.setProfiles(undefined, [powershellProfile]);
        terminalInstanceService.setProfiles('fakeremote', []);
        terminalContributionService.setProfiles([jsdebugProfile]);
        if (isWindows) {
            remoteAgentService.setEnvironment(1 /* OperatingSystem.Windows */);
        }
        else if (isLinux) {
            remoteAgentService.setEnvironment(3 /* OperatingSystem.Linux */);
        }
        else {
            remoteAgentService.setEnvironment(2 /* OperatingSystem.Macintosh */);
        }
        configurationService.setUserConfiguration('terminal', { integrated: defaultTerminalConfig });
    });
    suite('Contributed Profiles', () => {
        test('should filter out contributed profiles set to null (Linux)', async () => {
            remoteAgentService.setEnvironment(3 /* OperatingSystem.Linux */);
            await configurationService.setUserConfiguration('terminal', {
                integrated: {
                    profiles: {
                        linux: {
                            'JavaScript Debug Terminal': null
                        }
                    }
                }
            });
            configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: () => true, source: 2 /* ConfigurationTarget.USER */ });
            await terminalProfileService.refreshAndAwaitAvailableProfiles();
            deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
            deepStrictEqual(terminalProfileService.contributedProfiles, []);
        });
        test('should filter out contributed profiles set to null (Windows)', async () => {
            remoteAgentService.setEnvironment(1 /* OperatingSystem.Windows */);
            await configurationService.setUserConfiguration('terminal', {
                integrated: {
                    profiles: {
                        windows: {
                            'JavaScript Debug Terminal': null
                        }
                    }
                }
            });
            configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: () => true, source: 2 /* ConfigurationTarget.USER */ });
            await terminalProfileService.refreshAndAwaitAvailableProfiles();
            deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
            deepStrictEqual(terminalProfileService.contributedProfiles, []);
        });
        test('should filter out contributed profiles set to null (macOS)', async () => {
            remoteAgentService.setEnvironment(2 /* OperatingSystem.Macintosh */);
            await configurationService.setUserConfiguration('terminal', {
                integrated: {
                    profiles: {
                        osx: {
                            'JavaScript Debug Terminal': null
                        }
                    }
                }
            });
            configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: () => true, source: 2 /* ConfigurationTarget.USER */ });
            await terminalProfileService.refreshAndAwaitAvailableProfiles();
            deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
            deepStrictEqual(terminalProfileService.contributedProfiles, []);
        });
        test('should include contributed profiles', async () => {
            await terminalProfileService.refreshAndAwaitAvailableProfiles();
            deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
            deepStrictEqual(terminalProfileService.contributedProfiles, [jsdebugProfile]);
        });
    });
    test('should get profiles from remoteTerminalService when there is a remote authority', async () => {
        instantiationService.stub(IWorkbenchEnvironmentService, { remoteAuthority: 'fakeremote' });
        terminalProfileService = store.add(instantiationService.createInstance(TestTerminalProfileService));
        await terminalProfileService.hasRefreshedProfiles;
        deepStrictEqual(terminalProfileService.availableProfiles, []);
        deepStrictEqual(terminalProfileService.contributedProfiles, [jsdebugProfile]);
        terminalInstanceService.setProfiles('fakeremote', [powershellProfile]);
        await terminalProfileService.refreshAndAwaitAvailableProfiles();
        deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
        deepStrictEqual(terminalProfileService.contributedProfiles, [jsdebugProfile]);
    });
    test('should fire onDidChangeAvailableProfiles only when available profiles have changed via user config', async () => {
        powershellProfile.icon = Codicon.lightBulb;
        let calls = [];
        store.add(terminalProfileService.onDidChangeAvailableProfiles(e => calls.push(e)));
        await configurationService.setUserConfiguration('terminal', {
            integrated: {
                profiles: {
                    windows: powershellProfile,
                    linux: powershellProfile,
                    osx: powershellProfile
                }
            }
        });
        await terminalProfileService.hasRefreshedProfiles;
        deepStrictEqual(calls, [
            [powershellProfile]
        ]);
        deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
        deepStrictEqual(terminalProfileService.contributedProfiles, [jsdebugProfile]);
        calls = [];
        await terminalProfileService.refreshAndAwaitAvailableProfiles();
        deepStrictEqual(calls, []);
    });
    test('should fire onDidChangeAvailableProfiles when available or contributed profiles have changed via remote/localTerminalService', async () => {
        powershellProfile.isDefault = false;
        terminalInstanceService.setProfiles(undefined, [powershellProfile]);
        const calls = [];
        store.add(terminalProfileService.onDidChangeAvailableProfiles(e => calls.push(e)));
        await terminalProfileService.hasRefreshedProfiles;
        deepStrictEqual(calls, [
            [powershellProfile]
        ]);
        deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
        deepStrictEqual(terminalProfileService.contributedProfiles, [jsdebugProfile]);
    });
    test('should call refreshAvailableProfiles _onDidChangeExtensions', async () => {
        extensionService._onDidChangeExtensions.fire();
        const calls = [];
        store.add(terminalProfileService.onDidChangeAvailableProfiles(e => calls.push(e)));
        await terminalProfileService.hasRefreshedProfiles;
        deepStrictEqual(calls, [
            [powershellProfile]
        ]);
        deepStrictEqual(terminalProfileService.availableProfiles, [powershellProfile]);
        deepStrictEqual(terminalProfileService.contributedProfiles, [jsdebugProfile]);
    });
    suite('Profiles Quickpick', () => {
        let quickInputService;
        let mockTerminalProfileService;
        let terminalProfileQuickpick;
        setup(async () => {
            quickInputService = new MockQuickInputService();
            mockTerminalProfileService = new MockTerminalProfileService();
            instantiationService.stub(IQuickInputService, quickInputService);
            instantiationService.stub(ITerminalProfileService, mockTerminalProfileService);
            terminalProfileQuickpick = instantiationService.createInstance(TestTerminalProfileQuickpick);
        });
        test('setDefault', async () => {
            powershellProfile.isDefault = false;
            mockTerminalProfileService.setProfiles([powershellProfile], [jsdebugProfile]);
            mockTerminalProfileService.setDefaultProfileName(jsdebugProfile.title);
            const result = await terminalProfileQuickpick.showAndGetResult('setDefault');
            deepStrictEqual(result, powershellProfile.profileName);
        });
        test('setDefault to contributed', async () => {
            mockTerminalProfileService.setDefaultProfileName(powershellProfile.profileName);
            quickInputService.setPick(jsdebugPick);
            const result = await terminalProfileQuickpick.showAndGetResult('setDefault');
            const expected = {
                config: {
                    extensionIdentifier: jsdebugProfile.extensionIdentifier,
                    id: jsdebugProfile.id,
                    options: { color: undefined, icon: 'debug' },
                    title: jsdebugProfile.title,
                },
                keyMods: undefined
            };
            deepStrictEqual(result, expected);
        });
        test('createInstance', async () => {
            mockTerminalProfileService.setDefaultProfileName(powershellProfile.profileName);
            const pick = { ...powershellPick, keyMods: { alt: true, ctrlCmd: false } };
            quickInputService.setPick(pick);
            const result = await terminalProfileQuickpick.showAndGetResult('createInstance');
            deepStrictEqual(result, { config: powershellProfile, keyMods: { alt: true, ctrlCmd: false } });
        });
        test('createInstance with contributed', async () => {
            const pick = { ...jsdebugPick, keyMods: { alt: true, ctrlCmd: false } };
            quickInputService.setPick(pick);
            const result = await terminalProfileQuickpick.showAndGetResult('createInstance');
            const expected = {
                config: {
                    extensionIdentifier: jsdebugProfile.extensionIdentifier,
                    id: jsdebugProfile.id,
                    options: { color: undefined, icon: 'debug' },
                    title: jsdebugProfile.title,
                },
                keyMods: { alt: true, ctrlCmd: false }
            };
            deepStrictEqual(result, expected);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxQcm9maWxlU2VydmljZS5pbnRlZ3JhdGlvblRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWwvdGVzdC9icm93c2VyL3Rlcm1pbmFsUHJvZmlsZVNlcnZpY2UuaW50ZWdyYXRpb25UZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFFekMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBbUIsTUFBTSx3Q0FBd0MsQ0FBQztBQUM3RixPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRyxPQUFPLEVBQXVCLHFCQUFxQixFQUFrQyxNQUFNLCtEQUErRCxDQUFDO0FBQzNKLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLCtFQUErRSxDQUFDO0FBRXpILE9BQU8sRUFBZ0Isa0JBQWtCLEVBQXdCLE1BQU0seURBQXlELENBQUM7QUFHakksT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ3JFLE9BQU8sRUFBeUIsd0JBQXdCLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUM1RyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNqRixPQUFPLEVBQTBCLHVCQUF1QixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDM0YsT0FBTyxFQUFFLDRC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