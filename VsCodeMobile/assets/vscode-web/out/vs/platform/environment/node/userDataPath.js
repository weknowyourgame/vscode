/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { homedir } from 'os';
// This file used to be a pure JS file and was always
// importing `path` from node.js even though we ship
// our own version of the library and prefer to use
// that.
// However, resolution of user-data-path is critical
// and while our version of `path` is a copy of node.js
// one, you never know. As such, preserve the use of
// the built-in `path` lib for the time being.
// eslint-disable-next-line local/code-import-patterns
import { resolve, isAbsolute, join } from 'path';
const cwd = process.env['VSCODE_CWD'] || process.cwd();
/**
 * Returns the user data path to use with some rules:
 * - respect portable mode
 * - respect VSCODE_APPDATA environment variable
 * - respect --user-data-dir CLI argument
 */
export function getUserDataPath(cliArgs, productName) {
    const userDataPath = doGetUserDataPath(cliArgs, productName);
    const pathsToResolve = [userDataPath];
    // If the user-data-path is not absolute, make
    // sure to resolve it against the passed in
    // current working directory. We cannot use the
    // node.js `path.resolve()` logic because it will
    // not pick up our `VSCODE_CWD` environment variable
    // (https://github.com/microsoft/vscode/issues/120269)
    if (!isAbsolute(userDataPath)) {
        pathsToResolve.unshift(cwd);
    }
    return resolve(...pathsToResolve);
}
function doGetUserDataPath(cliArgs, productName) {
    // 0. Running out of sources has a fixed productName
    if (process.env['VSCODE_DEV']) {
        productName = 'code-oss-dev';
    }
    // 1. Support portable mode
    const portablePath = process.env['VSCODE_PORTABLE'];
    if (portablePath) {
        return join(portablePath, 'user-data');
    }
    // 2. Support global VSCODE_APPDATA environment variable
    let appDataPath = process.env['VSCODE_APPDATA'];
    if (appDataPath) {
        return join(appDataPath, productName);
    }
    // With Electron>=13 --user-data-dir switch will be propagated to
    // all processes https://github.com/electron/electron/blob/1897b14af36a02e9aa7e4d814159303441548251/shell/browser/electron_browser_client.cc#L546-L553
    // Check VSCODE_PORTABLE and VSCODE_APPDATA before this case to get correct values.
    // 3. Support explicit --user-data-dir
    const cliPath = cliArgs['user-data-dir'];
    if (cliPath) {
        return cliPath;
    }
    // 4. Otherwise check per platform
    switch (process.platform) {
        case 'win32':
            appDataPath = process.env['APPDATA'];
            if (!appDataPath) {
                const userProfile = process.env['USERPROFILE'];
                if (typeof userProfile !== 'string') {
                    throw new Error('Windows: Unexpected undefined %USERPROFILE% environment variable');
                }
                appDataPath = join(userProfile, 'AppData', 'Roaming');
            }
            break;
        case 'darwin':
            appDataPath = join(homedir(), 'Library', 'Application Support');
            break;
        case 'linux':
            appDataPath = process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config');
            break;
        default:
            throw new Error('Platform not supported');
    }
    return join(appDataPath, productName);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlckRhdGFQYXRoLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2Vudmlyb25tZW50L25vZGUvdXNlckRhdGFQYXRoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFHN0IscURBQXFEO0FBQ3JELG9EQUFvRDtBQUNwRCxtREFBbUQ7QUFDbkQsUUFBUTtBQUNSLG9EQUFvRDtBQUNwRCx1REFBdUQ7QUFDdkQsb0RBQW9EO0FBQ3BELDhDQUE4QztBQUM5QyxzREFBc0Q7QUFDdEQsT0FBTyxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBRWpELE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRXZEOzs7OztHQUtHO0FBQ0gsTUFBTSxVQUFVLGVBQWUsQ0FBQyxPQUF5QixFQUFFLFdBQW1CO0lBQzdFLE1BQU0sWUFBWSxHQUFHLGlCQUFpQixDQUFDLE9BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQztJQUM3RCxNQUFNLGNBQWMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBRXRDLDhDQUE4QztJQUM5QywyQ0FBMkM7SUFDM0MsK0NBQStDO0lBQy9DLGlEQUFpRDtJQUNqRCxvREFBb0Q7SUFDcEQsc0RBQXNEO0lBQ3RELElBQUksQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztRQUMvQixjQUFjLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFFRCxPQUFPLE9BQU8sQ0FBQyxHQUFHLGNBQWMsQ0FBQyxDQUFDO0FBQ25DLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLE9BQXlCLEVBQUUsV0FBbUI7SUFFeEUsb0RBQW9EO0lBQ3BELElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1FBQy9CLFdBQVcsR0FBRyxjQUFjLENBQUM7SUFDOUIsQ0FBQztJQUVELDJCQUEyQjtJQUMzQixNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEQsSUFBSSxZQUFZLEVBQUUsQ0FBQztRQUNsQixPQUFPLElBQUksQ0FBQyxZQUFZLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDeEMsQ0FBQztJQUVELHdEQUF3RDtJQUN4RCxJQUFJLFdBQVcsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUM7SUFDaEQsSUFBSSxXQUFXLEVBQUUsQ0FBQztRQUNqQixPQUFPLElBQUksQ0FBQyxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUVELGlFQUFpRTtJQUNqRSxzSkFBc0o7SUFDdEosbUZBQW1GO0lBQ25GLHNDQUFzQztJQUN0QyxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDekMsSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUNiLE9BQU8sT0FBTyxDQUFDO0lBQ2hCLENBQUM7SUFFRCxrQ0FBa0M7SUFDbEMsUUFBUSxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDMUIsS0FBSyxPQUFPO1lBQ1gsV0FBVyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDckMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO2dCQUNsQixNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUMvQyxJQUFJLE9BQU8sV0FBVyxLQUFLLFFBQVEsRUFBRSxDQUFDO29CQUNyQyxNQUFNLElBQUksS0FBSyxDQUFDLGtFQUFrRSxDQUFDLENBQUM7Z0JBQ3JGLENBQUM7Z0JBRUQsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ3ZELENBQUM7WUFDRCxNQUFNO1FBQ1AsS0FBSyxRQUFRO1lBQ1osV0FBVyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxTQUFTLEVBQUUscUJBQXFCLENBQUMsQ0FBQztZQUNoRSxNQUFNO1FBQ1AsS0FBSyxPQUFPO1lBQ1gsV0FBVyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDM0UsTUFBTTtRQUNQO1lBQ0MsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxPQUFPLElBQUksQ0FBQyxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDdkMsQ0FBQyJ9