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
import { toLocalISOString } from '../../../base/common/date.js';
import { memoize } from '../../../base/common/decorators.js';
import { FileAccess, Schemas } from '../../../base/common/network.js';
import { dirname, join, normalize, resolve } from '../../../base/common/path.js';
import { env } from '../../../base/common/process.js';
import { joinPath } from '../../../base/common/resources.js';
import { URI } from '../../../base/common/uri.js';
export const EXTENSION_IDENTIFIER_WITH_LOG_REGEX = /^([^.]+\..+)[:=](.+)$/;
export class AbstractNativeEnvironmentService {
    get appRoot() { return dirname(FileAccess.asFileUri('').fsPath); }
    get userHome() { return URI.file(this.paths.homeDir); }
    get userDataPath() { return this.paths.userDataDir; }
    get appSettingsHome() { return URI.file(join(this.userDataPath, 'User')); }
    get tmpDir() { return URI.file(this.paths.tmpDir); }
    get cacheHome() { return URI.file(this.userDataPath); }
    get stateResource() { return joinPath(this.appSettingsHome, 'globalStorage', 'storage.json'); }
    get userRoamingDataHome() { return this.appSettingsHome.with({ scheme: Schemas.vscodeUserData }); }
    get userDataSyncHome() { return joinPath(this.appSettingsHome, 'sync'); }
    get logsHome() {
        if (!this.args.logsPath) {
            const key = toLocalISOString(new Date()).replace(/-|:|\.\d+Z$/g, '');
            this.args.logsPath = join(this.userDataPath, 'logs', key);
        }
        return URI.file(this.args.logsPath);
    }
    get sync() { return this.args.sync; }
    get workspaceStorageHome() { return joinPath(this.appSettingsHome, 'workspaceStorage'); }
    get localHistoryHome() { return joinPath(this.appSettingsHome, 'History'); }
    get keyboardLayoutResource() { return joinPath(this.userRoamingDataHome, 'keyboardLayout.json'); }
    get argvResource() {
        const vscodePortable = env['VSCODE_PORTABLE'];
        if (vscodePortable) {
            return URI.file(join(vscodePortable, 'argv.json'));
        }
        return joinPath(this.userHome, this.productService.dataFolderName, 'argv.json');
    }
    get isExtensionDevelopment() { return !!this.args.extensionDevelopmentPath; }
    get untitledWorkspacesHome() { return URI.file(join(this.userDataPath, 'Workspaces')); }
    get builtinExtensionsPath() {
        const cliBuiltinExtensionsDir = this.args['builtin-extensions-dir'];
        if (cliBuiltinExtensionsDir) {
            return resolve(cliBuiltinExtensionsDir);
        }
        return normalize(join(FileAccess.asFileUri('').fsPath, '..', 'extensions'));
    }
    get extensionsDownloadLocation() {
        const cliExtensionsDownloadDir = this.args['extensions-download-dir'];
        if (cliExtensionsDownloadDir) {
            return URI.file(resolve(cliExtensionsDownloadDir));
        }
        return URI.file(join(this.userDataPath, 'CachedExtensionVSIXs'));
    }
    get extensionsPath() {
        const cliExtensionsDir = this.args['extensions-dir'];
        if (cliExtensionsDir) {
            return resolve(cliExtensionsDir);
        }
        const vscodeExtensions = env['VSCODE_EXTENSIONS'];
        if (vscodeExtensions) {
            return vscodeExtensions;
        }
        const vscodePortable = env['VSCODE_PORTABLE'];
        if (vscodePortable) {
            return join(vscodePortable, 'extensions');
        }
        return joinPath(this.userHome, this.productService.dataFolderName, 'extensions').fsPath;
    }
    get extensionDevelopmentLocationURI() {
        const extensionDevelopmentPaths = this.args.extensionDevelopmentPath;
        if (Array.isArray(extensionDevelopmentPaths)) {
            return extensionDevelopmentPaths.map(extensionDevelopmentPath => {
                if (/^[^:/?#]+?:\/\//.test(extensionDevelopmentPath)) {
                    return URI.parse(extensionDevelopmentPath);
                }
                return URI.file(normalize(extensionDevelopmentPath));
            });
        }
        return undefined;
    }
    get extensionDevelopmentKind() {
        return this.args.extensionDevelopmentKind?.map(kind => kind === 'ui' || kind === 'workspace' || kind === 'web' ? kind : 'workspace');
    }
    get extensionTestsLocationURI() {
        const extensionTestsPath = this.args.extensionTestsPath;
        if (extensionTestsPath) {
            if (/^[^:/?#]+?:\/\//.test(extensionTestsPath)) {
                return URI.parse(extensionTestsPath);
            }
            return URI.file(normalize(extensionTestsPath));
        }
        return undefined;
    }
    get disableExtensions() {
        if (this.args['disable-extensions']) {
            return true;
        }
        const disableExtensions = this.args['disable-extension'];
        if (disableExtensions) {
            if (typeof disableExtensions === 'string') {
                return [disableExtensions];
            }
            if (Array.isArray(disableExtensions) && disableExtensions.length > 0) {
                return disableExtensions;
            }
        }
        return false;
    }
    get debugExtensionHost() { return parseExtensionHostDebugPort(this.args, this.isBuilt); }
    get debugRenderer() { return !!this.args.debugRenderer; }
    get isBuilt() { return !env['VSCODE_DEV']; }
    get verbose() { return !!this.args.verbose; }
    get logLevel() { return this.args.log?.find(entry => !EXTENSION_IDENTIFIER_WITH_LOG_REGEX.test(entry)); }
    get extensionLogLevel() {
        const result = [];
        for (const entry of this.args.log || []) {
            const matches = EXTENSION_IDENTIFIER_WITH_LOG_REGEX.exec(entry);
            if (matches?.[1] && matches[2]) {
                result.push([matches[1], matches[2]]);
            }
        }
        return result.length ? result : undefined;
    }
    get serviceMachineIdResource() { return joinPath(URI.file(this.userDataPath), 'machineid'); }
    get crashReporterId() { return this.args['crash-reporter-id']; }
    get crashReporterDirectory() { return this.args['crash-reporter-directory']; }
    get disableTelemetry() { return !!this.args['disable-telemetry']; }
    get disableExperiments() { return !!this.args['disable-experiments']; }
    get disableWorkspaceTrust() { return !!this.args['disable-workspace-trust']; }
    get useInMemorySecretStorage() { return !!this.args['use-inmemory-secretstorage']; }
    get policyFile() {
        if (this.args['__enable-file-policy']) {
            const vscodePortable = env['VSCODE_PORTABLE'];
            if (vscodePortable) {
                return URI.file(join(vscodePortable, 'policy.json'));
            }
            return joinPath(this.userHome, this.productService.dataFolderName, 'policy.json');
        }
        return undefined;
    }
    get editSessionId() { return this.args['editSessionId']; }
    get exportPolicyData() {
        return this.args['export-policy-data'];
    }
    get continueOn() {
        return this.args['continueOn'];
    }
    set continueOn(value) {
        this.args['continueOn'] = value;
    }
    get args() { return this._args; }
    constructor(_args, paths, productService) {
        this._args = _args;
        this.paths = paths;
        this.productService = productService;
    }
}
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "appRoot", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "userHome", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "userDataPath", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "appSettingsHome", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "tmpDir", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "cacheHome", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "stateResource", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "userRoamingDataHome", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "userDataSyncHome", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "sync", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "workspaceStorageHome", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "localHistoryHome", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "keyboardLayoutResource", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "argvResource", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "isExtensionDevelopment", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "untitledWorkspacesHome", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "builtinExtensionsPath", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "extensionsPath", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "extensionDevelopmentLocationURI", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "extensionDevelopmentKind", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "extensionTestsLocationURI", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "debugExtensionHost", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "logLevel", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "extensionLogLevel", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "serviceMachineIdResource", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "disableTelemetry", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "disableExperiments", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "disableWorkspaceTrust", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "useInMemorySecretStorage", null);
__decorate([
    memoize
], AbstractNativeEnvironmentService.prototype, "policyFile", null);
export function parseExtensionHostDebugPort(args, isBuilt) {
    return parseDebugParams(args['inspect-extensions'], args['inspect-brk-extensions'], 5870, isBuilt, args.debugId, args.extensionEnvironment);
}
export function parseDebugParams(debugArg, debugBrkArg, defaultBuildPort, isBuilt, debugId, environmentString) {
    const portStr = debugBrkArg || debugArg;
    const port = Number(portStr) || (!isBuilt ? defaultBuildPort : null);
    const brk = port ? Boolean(!!debugBrkArg) : false;
    let env;
    if (environmentString) {
        try {
            env = JSON.parse(environmentString);
        }
        catch {
            // ignore
        }
    }
    return { port, break: brk, debugId, env };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnRTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDaEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ2pGLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN0RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDN0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBS2xELE1BQU0sQ0FBQyxNQUFNLG1DQUFtQyxHQUFHLHVCQUF1QixDQUFDO0FBeUIzRSxNQUFNLE9BQWdCLGdDQUFnQztJQUtyRCxJQUFJLE9BQU8sS0FBYSxPQUFPLE9BQU8sQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUcxRSxJQUFJLFFBQVEsS0FBVSxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFHNUQsSUFBSSxZQUFZLEtBQWEsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFHN0QsSUFBSSxlQUFlLEtBQVUsT0FBTyxHQUFHLENB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