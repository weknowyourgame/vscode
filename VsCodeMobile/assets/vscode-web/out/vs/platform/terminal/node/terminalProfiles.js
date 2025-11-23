/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'fs';
import * as cp from 'child_process';
import { Codicon } from '../../../base/common/codicons.js';
import { basename, delimiter, normalize, dirname, resolve } from '../../../base/common/path.js';
import { isLinux, isWindows } from '../../../base/common/platform.js';
import { findExecutable } from '../../../base/node/processes.js';
import { hasKey, isObject, isString } from '../../../base/common/types.js';
import * as pfs from '../../../base/node/pfs.js';
import { enumeratePowerShellInstallations } from '../../../base/node/powershell.js';
import { getWindowsBuildNumber } from './terminalEnvironment.js';
var Constants;
(function (Constants) {
    Constants["UnixShellsPath"] = "/etc/shells";
})(Constants || (Constants = {}));
let profileSources;
let logIfWslNotInstalled = true;
export function detectAvailableProfiles(profiles, defaultProfile, includeDetectedProfiles, configurationService, shellEnv = process.env, fsProvider, logService, variableResolver, testPwshSourcePaths) {
    fsProvider = fsProvider || {
        existsFile: pfs.SymlinkSupport.existsFile,
        readFile: fs.promises.readFile
    };
    if (isWindows) {
        return detectAvailableWindowsProfiles(includeDetectedProfiles, fsProvider, shellEnv, logService, configurationService.getValue("terminal.integrated.useWslProfiles" /* TerminalSettingId.UseWslProfiles */) !== false, profiles && isObject(profiles) ? { ...profiles } : configurationService.getValue("terminal.integrated.profiles.windows" /* TerminalSettingId.ProfilesWindows */), isString(defaultProfile) ? defaultProfile : configurationService.getValue("terminal.integrated.defaultProfile.windows" /* TerminalSettingId.DefaultProfileWindows */), testPwshSourcePaths, variableResolver);
    }
    return detectAvailableUnixProfiles(fsProvider, logService, includeDetectedProfiles, profiles && isObject(profiles) ? { ...profiles } : configurationService.getValue(isLinux ? "terminal.integrated.profiles.linux" /* TerminalSettingId.ProfilesLinux */ : "terminal.integrated.profiles.osx" /* TerminalSettingId.ProfilesMacOs */), isString(defaultProfile) ? defaultProfile : configurationService.getValue(isLinux ? "terminal.integrated.defaultProfile.linux" /* TerminalSettingId.DefaultProfileLinux */ : "terminal.integrated.defaultProfile.osx" /* TerminalSettingId.DefaultProfileMacOs */), testPwshSourcePaths, variableResolver, shellEnv);
}
async function detectAvailableWindowsProfiles(includeDetectedProfiles, fsProvider, shellEnv, logService, useWslProfiles, configProfiles, defaultProfileName, testPwshSourcePaths, variableResolver) {
    // Determine the correct System32 path. We want to point to Sysnative
    // when the 32-bit version of VS Code is running on a 64-bit machine.
    // The reason for this is because PowerShell's important PSReadline
    // module doesn't work if this is not the case. See #27915.
    const is32ProcessOn64Windows = process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432');
    const system32Path = `${process.env['windir']}\\${is32ProcessOn64Windows ? 'Sysnative' : 'System32'}`;
    // WSL 2 released in the May 2020 Update, this is where the `-d` flag was added that we depend
    // upon
    const allowWslDiscovery = getWindowsBuildNumber() >= 19041;
    await initializeWindowsProfiles(testPwshSourcePaths);
    const detectedProfiles = new Map();
    // Add auto detected profiles
    if (includeDetectedProfiles) {
        detectedProfiles.set('PowerShell', {
            source: "PowerShell" /* ProfileSource.Pwsh */,
            icon: Codicon.terminalPowershell,
            isAutoDetected: true
        });
        detectedProfiles.set('Windows PowerShell', {
            path: `${system32Path}\\WindowsPowerShell\\v1.0\\powershell.exe`,
            icon: Codicon.terminalPowershell,
            isAutoDetected: true
        });
        detectedProfiles.set('Git Bash', {
            source: "Git Bash" /* ProfileSource.GitBash */,
            icon: Codicon.terminalGitBash,
            isAutoDetected: true
        });
        detectedProfiles.set('Command Prompt', {
            path: `${system32Path}\\cmd.exe`,
            icon: Codicon.terminalCmd,
            isAutoDetected: true
        });
        detectedProfiles.set('Cygwin', {
            path: [
                { path: `${process.env['HOMEDRIVE']}\\cygwin64\\bin\\bash.exe`, isUnsafe: true },
                { path: `${process.env['HOMEDRIVE']}\\cygwin\\bin\\bash.exe`, isUnsafe: true }
            ],
            args: ['--login'],
            isAutoDetected: true
        });
        detectedProfiles.set('bash (MSYS2)', {
            path: [
                { path: `${process.env['HOMEDRIVE']}\\msys64\\usr\\bin\\bash.exe`, isUnsafe: true },
            ],
            args: ['--login', '-i'],
            // CHERE_INVOKING retains current working directory
            env: { CHERE_INVOKING: '1' },
            icon: Codicon.terminalBash,
            isAutoDetected: true
        });
        const cmderPath = `${process.env['CMDER_ROOT'] || `${process.env['HOMEDRIVE']}\\cmder`}\\vendor\\bin\\vscode_init.cmd`;
        detectedProfiles.set('Cmder', {
            path: `${system32Path}\\cmd.exe`,
            args: ['/K', cmderPath],
            // The path is safe if it was derived from CMDER_ROOT
            requiresPath: process.env['CMDER_ROOT'] ? cmderPath : { path: cmderPath, isUnsafe: true },
            isAutoDetected: true
        });
    }
    applyConfigProfilesToMap(configProfiles, detectedProfiles);
    const resultProfiles = await transformToTerminalProfiles(detectedProfiles.entries(), defaultProfileName, fsProvider, shellEnv, logService, variableResolver);
    if (includeDetectedProfiles && useWslProfiles && allowWslDiscovery) {
        try {
            const result = await getWslProfiles(`${system32Path}\\wsl.exe`, defaultProfileName);
            for (const wslProfile of result) {
                if (!configProfiles || !Object.prototype.hasOwnProperty.call(configProfiles, wslProfile.profileName)) {
                    resultProfiles.push(wslProfile);
                }
            }
        }
        catch (e) {
            if (logIfWslNotInstalled) {
                logService?.trace('WSL is not installed, so could not detect WSL profiles');
                logIfWslNotInstalled = false;
            }
        }
    }
    return resultProfiles;
}
async function transformToTerminalProfiles(entries, defaultProfileName, fsProvider, shellEnv = process.env, logService, variableResolver) {
    const promises = [];
    for (const [profileName, profile] of entries) {
        promises.push(getValidatedProfile(profileName, profile, defaultProfileName, fsProvider, shellEnv, logService, variableResolver));
    }
    return (await Promise.all(promises)).filter(e => !!e);
}
async function getValidatedProfile(profileName, profile, defaultProfileName, fsProvider, shellEnv = process.env, logService, variableResolver) {
    if (profile === null) {
        return undefined;
    }
    let originalPaths;
    let args;
    let icon = undefined;
    // use calculated values if path is not specified
    if (hasKey(profile, { source: true })) {
        const source = profileSources?.get(profile.source);
        if (!source) {
            return undefined;
        }
        originalPaths = source.paths;
        // if there are configured args, override the default ones
        args = profile.args || source.args;
        if (profile.icon) {
            icon = validateIcon(profile.icon);
        }
        else if (source.icon) {
            icon = source.icon;
        }
    }
    else {
        originalPaths = Array.isArray(profile.path) ? profile.path : [profile.path];
        args = isWindows ? profile.args : Array.isArray(profile.args) ? profile.args : undefined;
        icon = validateIcon(profile.icon);
    }
    let paths;
    if (variableResolver) {
        // Convert to string[] for resolve
        const mapped = originalPaths.map(e => isString(e) ? e : e.path);
        const resolved = await variableResolver(mapped);
        // Convert resolved back to (T | string)[]
        paths = new Array(originalPaths.length);
        for (let i = 0; i < originalPaths.length; i++) {
            if (isString(originalPaths[i])) {
                paths[i] = resolved[i];
            }
            else {
                paths[i] = {
                    path: resolved[i],
                    isUnsafe: true
                };
            }
        }
    }
    else {
        paths = originalPaths.slice();
    }
    let requiresUnsafePath;
    if (profile.requiresPath) {
        // Validate requiresPath exists
        let actualRequiredPath;
        if (isString(profile.requiresPath)) {
            actualRequiredPath = profile.requiresPath;
        }
        else {
            actualRequiredPath = profile.requiresPath.path;
            if (profile.requiresPath.isUnsafe) {
                requiresUnsafePath = actualRequiredPath;
            }
        }
        const result = await fsProvider.existsFile(actualRequiredPath);
        if (!result) {
            return;
        }
    }
    const validatedProfile = await validateProfilePaths(profileName, defaultProfileName, paths, fsProvider, shellEnv, args, profile.env, profile.overrideName, profile.isAutoDetected, requiresUnsafePath);
    if (!validatedProfile) {
        logService?.debug('Terminal profile not validated', profileName, originalPaths);
        return undefined;
    }
    validatedProfile.isAutoDetected = profile.isAutoDetected;
    validatedProfile.icon = icon;
    validatedProfile.color = profile.color;
    return validatedProfile;
}
function validateIcon(icon) {
    if (isString(icon)) {
        return { id: icon };
    }
    return icon;
}
async function initializeWindowsProfiles(testPwshSourcePaths) {
    if (profileSources && !testPwshSourcePaths) {
        return;
    }
    const [gitBashPaths, pwshPaths] = await Promise.all([getGitBashPaths(), testPwshSourcePaths || getPowershellPaths()]);
    profileSources = new Map();
    profileSources.set("Git Bash" /* ProfileSource.GitBash */, {
        profileName: 'Git Bash',
        paths: gitBashPaths,
        args: ['--login', '-i']
    });
    profileSources.set("PowerShell" /* ProfileSource.Pwsh */, {
        profileName: 'PowerShell',
        paths: pwshPaths,
        icon: Codicon.terminalPowershell
    });
}
async function getGitBashPaths() {
    const gitDirs = new Set();
    // Look for git.exe on the PATH and use that if found. git.exe is located at
    // `<installdir>/cmd/git.exe`. This is not an unsafe location because the git executable is
    // located on the PATH which is only controlled by the user/admin.
    const gitExePath = await findExecutable('git.exe');
    if (gitExePath) {
        const gitExeDir = dirname(gitExePath);
        gitDirs.add(resolve(gitExeDir, '../..'));
    }
    function addTruthy(set, value) {
        if (value) {
            set.add(value);
        }
    }
    // Add common git install locations
    addTruthy(gitDirs, process.env['ProgramW6432']);
    addTruthy(gitDirs, process.env['ProgramFiles']);
    addTruthy(gitDirs, process.env['ProgramFiles(X86)']);
    addTruthy(gitDirs, `${process.env['LocalAppData']}\\Program`);
    const gitBashPaths = [];
    for (const gitDir of gitDirs) {
        gitBashPaths.push(`${gitDir}\\Git\\bin\\bash.exe`, `${gitDir}\\Git\\usr\\bin\\bash.exe`, `${gitDir}\\usr\\bin\\bash.exe` // using Git for Windows SDK
        );
    }
    // Add special installs that don't follow the standard directory structure
    gitBashPaths.push(`${process.env['UserProfile']}\\scoop\\apps\\git\\current\\bin\\bash.exe`);
    gitBashPaths.push(`${process.env['UserProfile']}\\scoop\\apps\\git-with-openssh\\current\\bin\\bash.exe`);
    return gitBashPaths;
}
async function getPowershellPaths() {
    const paths = [];
    // Add all of the different kinds of PowerShells
    for await (const pwshExe of enumeratePowerShellInstallations()) {
        paths.push(pwshExe.exePath);
    }
    return paths;
}
async function getWslProfiles(wslPath, defaultProfileName) {
    const profiles = [];
    const distroOutput = await new Promise((resolve, reject) => {
        // wsl.exe output is encoded in utf16le (ie. A -> 0x4100) by default, force it in case the
        // user changed https://github.com/microsoft/vscode/issues/276253
        cp.exec('wsl.exe -l -q', { encoding: 'utf16le', env: { ...process.env, WSL_UTF8: '0' }, timeout: 1000 }, (err, stdout) => {
            if (err) {
                return reject('Problem occurred when getting wsl distros');
            }
            resolve(stdout);
        });
    });
    if (!distroOutput) {
        return [];
    }
    const regex = new RegExp(/[\r?\n]/);
    const distroNames = distroOutput.split(regex).filter(t => t.trim().length > 0 && t !== '');
    for (const distroName of distroNames) {
        // Skip empty lines
        if (distroName === '') {
            continue;
        }
        // docker-desktop and docker-desktop-data are treated as implementation details of
        // Docker Desktop for Windows and therefore not exposed
        if (distroName.startsWith('docker-desktop')) {
            continue;
        }
        // Create the profile, adding the icon depending on the distro
        const profileName = `${distroName} (WSL)`;
        const profile = {
            profileName,
            path: wslPath,
            args: [`-d`, `${distroName}`],
            isDefault: profileName === defaultProfileName,
            icon: getWslIcon(distroName),
            isAutoDetected: false
        };
        // Add the profile
        profiles.push(profile);
    }
    return profiles;
}
function getWslIcon(distroName) {
    if (distroName.includes('Ubuntu')) {
        return Codicon.terminalUbuntu;
    }
    else if (distroName.includes('Debian')) {
        return Codicon.terminalDebian;
    }
    else {
        return Codicon.terminalLinux;
    }
}
async function detectAvailableUnixProfiles(fsProvider, logService, includeDetectedProfiles, configProfiles, defaultProfileName, testPaths, variableResolver, shellEnv) {
    const detectedProfiles = new Map();
    // Add non-quick launch profiles
    if (includeDetectedProfiles && await fsProvider.existsFile("/etc/shells" /* Constants.UnixShellsPath */)) {
        const contents = (await fsProvider.readFile("/etc/shells" /* Constants.UnixShellsPath */)).toString();
        const profiles = ((testPaths || contents.split('\n'))
            .map(e => {
            const index = e.indexOf('#');
            return index === -1 ? e : e.substring(0, index);
        })
            .filter(e => e.trim().length > 0));
        const counts = new Map();
        for (const profile of profiles) {
            let profileName = basename(profile);
            let count = counts.get(profileName) || 0;
            count++;
            if (count > 1) {
                profileName = `${profileName} (${count})`;
            }
            counts.set(profileName, count);
            detectedProfiles.set(profileName, { path: profile, isAutoDetected: true });
        }
    }
    applyConfigProfilesToMap(configProfiles, detectedProfiles);
    return await transformToTerminalProfiles(detectedProfiles.entries(), defaultProfileName, fsProvider, shellEnv, logService, variableResolver);
}
function applyConfigProfilesToMap(configProfiles, profilesMap) {
    if (!configProfiles) {
        return;
    }
    for (const [profileName, value] of Object.entries(configProfiles)) {
        if (value === null || !isObject(value) || (!hasKey(value, { path: true }) && !hasKey(value, { source: true }))) {
            profilesMap.delete(profileName);
        }
        else {
            value.icon = value.icon || profilesMap.get(profileName)?.icon;
            profilesMap.set(profileName, value);
        }
    }
}
async function validateProfilePaths(profileName, defaultProfileName, potentialPaths, fsProvider, shellEnv, args, env, overrideName, isAutoDetected, requiresUnsafePath) {
    if (potentialPaths.length === 0) {
        return Promise.resolve(undefined);
    }
    const path = potentialPaths.shift();
    if (path === '') {
        return validateProfilePaths(profileName, defaultProfileName, potentialPaths, fsProvider, shellEnv, args, env, overrideName, isAutoDetected);
    }
    const isUnsafePath = !isString(path) && path.isUnsafe;
    const actualPath = isString(path) ? path : path.path;
    const profile = {
        profileName,
        path: actualPath,
        args,
        env,
        overrideName,
        isAutoDetected,
        isDefault: profileName === defaultProfileName,
        isUnsafePath,
        requiresUnsafePath
    };
    // For non-absolute paths, check if it's available on $PATH
    if (basename(actualPath) === actualPath) {
        // The executable isn't an absolute path, try find it on the PATH
        const envPaths = shellEnv.PATH ? shellEnv.PATH.split(delimiter) : undefined;
        const executable = await findExecutable(actualPath, undefined, envPaths, undefined, fsProvider.existsFile);
        if (!executable) {
            return validateProfilePaths(profileName, defaultProfileName, potentialPaths, fsProvider, shellEnv, args);
        }
        profile.path = executable;
        profile.isFromPath = true;
        return profile;
    }
    const result = await fsProvider.existsFile(normalize(actualPath));
    if (result) {
        return profile;
    }
    return validateProfilePaths(profileName, defaultProfileName, potentialPaths, fsProvider, shellEnv, args, env, overrideName, isAutoDetected);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxQcm9maWxlcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS90ZXJtaW5hbC9ub2RlL3Rlcm1pbmFsUHJvZmlsZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDekIsT0FBTyxLQUFLLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDcEMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN0RSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDakUsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFM0UsT0FBTyxLQUFLLEdBQUcsTUFBTSwyQkFBMkIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUlwRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUdqRSxJQUFXLFNBRVY7QUFGRCxXQUFXLFNBQVM7SUFDbkIsMkNBQThCLENBQUE7QUFDL0IsQ0FBQyxFQUZVLFNBQVMsS0FBVCxTQUFTLFFBRW5CO0FBRUQsSUFBSSxjQUFrRSxDQUFDO0FBQ3ZFLElBQUksb0JBQW9CLEdBQVksSUFBSSxDQUFDO0FBRXpDLE1BQU0sVUFBVSx1QkFBdUIsQ0FDdEMsUUFBaUIsRUFDakIsY0FBdUIsRUFDdkIsdUJBQWdDLEVBQ2hDLG9CQUEyQyxFQUMzQyxXQUErQixPQUFP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