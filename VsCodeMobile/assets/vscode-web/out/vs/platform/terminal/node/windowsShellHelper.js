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
import { timeout } from '../../../base/common/async.js';
import { debounce } from '../../../base/common/decorators.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { isWindows, platform } from '../../../base/common/platform.js';
const SHELL_EXECUTABLES = [
    'cmd.exe',
    'powershell.exe',
    'pwsh.exe',
    'bash.exe',
    'git-cmd.exe',
    'wsl.exe',
    'ubuntu.exe',
    'ubuntu1804.exe',
    'kali.exe',
    'debian.exe',
    'opensuse-42.exe',
    'sles-12.exe',
    'julia.exe',
    'nu.exe',
    'node.exe',
];
const SHELL_EXECUTABLE_REGEXES = [
    /^python(\d(\.\d{0,2})?)?\.exe$/,
];
let windowsProcessTree;
export class WindowsShellHelper extends Disposable {
    get shellType() { return this._shellType; }
    get shellTitle() { return this._shellTitle; }
    get onShellNameChanged() { return this._onShellNameChanged.event; }
    get onShellTypeChanged() { return this._onShellTypeChanged.event; }
    constructor(_rootProcessId) {
        super();
        this._rootProcessId = _rootProcessId;
        this._shellTitle = '';
        this._onShellNameChanged = new Emitter();
        this._onShellTypeChanged = new Emitter();
        if (!isWindows) {
            throw new Error(`WindowsShellHelper cannot be instantiated on ${platform}`);
        }
        this._startMonitoringShell();
    }
    async _startMonitoringShell() {
        if (this._store.isDisposed) {
            return;
        }
        this.checkShell();
    }
    async checkShell() {
        if (isWindows) {
            // Wait to give the shell some time to actually launch a process, this
            // could lead to a race condition but it would be recovered from when
            // data stops and should cover the majority of cases
            await timeout(300);
            this.getShellName().then(title => {
                const type = this.getShellType(title);
                if (type !== this._shellType) {
                    this._onShellTypeChanged.fire(type);
                    this._onShellNameChanged.fire(title);
                    this._shellType = type;
                    this._shellTitle = title;
                }
            });
        }
    }
    traverseTree(tree) {
        if (!tree) {
            return '';
        }
        if (SHELL_EXECUTABLES.indexOf(tree.name) === -1) {
            return tree.name;
        }
        for (const regex of SHELL_EXECUTABLE_REGEXES) {
            if (tree.name.match(regex)) {
                return tree.name;
            }
        }
        if (!tree.children || tree.children.length === 0) {
            return tree.name;
        }
        let favouriteChild = 0;
        for (; favouriteChild < tree.children.length; favouriteChild++) {
            const child = tree.children[favouriteChild];
            if (!child.children || child.children.length === 0) {
                break;
            }
            if (child.children[0].name !== 'conhost.exe') {
                break;
            }
        }
        if (favouriteChild >= tree.children.length) {
            return tree.name;
        }
        return this.traverseTree(tree.children[favouriteChild]);
    }
    /**
     * Returns the innermost shell executable running in the terminal
     */
    async getShellName() {
        if (this._store.isDisposed) {
            return Promise.resolve('');
        }
        // Prevent multiple requests at once, instead return current request
        if (this._currentRequest) {
            return this._currentRequest;
        }
        if (!windowsProcessTree) {
            windowsProcessTree = await import('@vscode/windows-process-tree');
        }
        this._currentRequest = new Promise(resolve => {
            windowsProcessTree.getProcessTree(this._rootProcessId, tree => {
                const name = this.traverseTree(tree);
                this._currentRequest = undefined;
                resolve(name);
            });
        });
        return this._currentRequest;
    }
    getShellType(executable) {
        switch (executable.toLowerCase()) {
            case 'cmd.exe':
                return "cmd" /* WindowsShellType.CommandPrompt */;
            case 'powershell.exe':
            case 'pwsh.exe':
                return "pwsh" /* GeneralShellType.PowerShell */;
            case 'bash.exe':
            case 'git-cmd.exe':
                return "gitbash" /* WindowsShellType.GitBash */;
            case 'julia.exe':
                return "julia" /* GeneralShellType.Julia */;
            case 'node.exe':
                return "node" /* GeneralShellType.Node */;
            case 'nu.exe':
                return "nu" /* GeneralShellType.NuShell */;
            case 'wsl.exe':
            case 'ubuntu.exe':
            case 'ubuntu1804.exe':
            case 'kali.exe':
            case 'debian.exe':
            case 'opensuse-42.exe':
            case 'sles-12.exe':
                return "wsl" /* WindowsShellType.Wsl */;
            default:
                if (executable.match(/python(\d(\.\d{0,2})?)?\.exe/)) {
                    return "python" /* GeneralShellType.Python */;
                }
                return undefined;
        }
    }
}
__decorate([
    debounce(500)
], WindowsShellHelper.prototype, "checkShell", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2luZG93c1NoZWxsSGVscGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3Rlcm1pbmFsL25vZGUvd2luZG93c1NoZWxsSGVscGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN4RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDOUQsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBV3ZFLE1BQU0saUJBQWlCLEdBQUc7SUFDekIsU0FBUztJQUNULGdCQUFnQjtJQUNoQixVQUFVO0lBQ1YsVUFBVTtJQUNWLGFBQWE7SUFDYixTQUFTO0lBQ1QsWUFBWTtJQUNaLGdCQUFnQjtJQUNoQixVQUFVO0lBQ1YsWUFBWTtJQUNaLGlCQUFpQjtJQUNqQixhQUFhO0lBQ2IsV0FBVztJQUNYLFFBQVE7SUFDUixVQUFVO0NBQ1YsQ0FBQztBQUVGLE1BQU0sd0JBQXdCLEdBQUc7SUFDaEMsZ0NBQWdDO0NBQ2hDLENBQUM7QUFFRixJQUFJLGtCQUFpRCxDQUFDO0FBRXRELE1BQU0sT0FBTyxrQkFBbUIsU0FBUSxVQUFVO0lBR2pELElBQUksU0FBUyxLQUFvQyxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBRTFFLElBQUksVUFBVSxLQUFhLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFFckQsSUFBSSxrQkFBa0IsS0FBb0IsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJ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