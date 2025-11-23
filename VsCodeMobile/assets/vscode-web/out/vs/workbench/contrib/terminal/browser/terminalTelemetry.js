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
import { getWindowById } from '../../../../base/browser/dom.js';
import { isAuxiliaryWindow } from '../../../../base/browser/window.js';
import { timeout } from '../../../../base/common/async.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { basename } from '../../../../base/common/path.js';
import { isString } from '../../../../base/common/types.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { TelemetryTrustedValue } from '../../../../platform/telemetry/common/telemetryUtils.js';
import { TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { ITerminalEditorService, ITerminalService } from './terminal.js';
let TerminalTelemetryContribution = class TerminalTelemetryContribution extends Disposable {
    static { this.ID = 'terminalTelemetry'; }
    constructor(lifecycleService, terminalService, terminalEditorService, _telemetryService) {
        super();
        this._telemetryService = _telemetryService;
        this._register(terminalService.onDidCreateInstance(async (instance) => {
            const store = new DisposableStore();
            this._store.add(store);
            await Promise.race([
                // Wait for process ready so the shell launch config is fully resolved, then
                // allow another 10 seconds for the shell integration to be fully initialized
                instance.processReady.then(() => {
                    return timeout(10000);
                }),
                // If the terminal is disposed, it's ready to report on immediately
                Event.toPromise(instance.onDisposed, store),
                // If the app is shutting down, flush
                Event.toPromise(lifecycleService.onWillShutdown, store),
            ]);
            // Determine window status, this is done some time after the process is ready and could
            // reflect the terminal being moved.
            let isInAuxWindow = false;
            try {
                const input = terminalEditorService.getInputFromResource(instance.resource);
                const windowId = input.group?.windowId;
                isInAuxWindow = !!(windowId && isAuxiliaryWindow(getWindowById(windowId, true).window));
            }
            catch {
            }
            this._logCreateInstance(instance, isInAuxWindow);
            this._store.delete(store);
        }));
    }
    _logCreateInstance(instance, isInAuxWindow) {
        const slc = instance.shellLaunchConfig;
        const commandDetection = instance.capabilities.get(2 /* TerminalCapability.CommandDetection */);
        this._telemetryService.publicLog2('terminal/createInstance', {
            location: (instance.target === TerminalLocation.Panel
                ? 'view'
                : instance.target === TerminalLocation.Editor
                    ? (isInAuxWindow ? 'editor-auxwindow' : 'editor')
                    : 'unknown'),
            shellType: new TelemetryTrustedValue(getSanitizedShellType(slc)),
            promptType: new TelemetryTrustedValue(instance.capabilities.get(6 /* TerminalCapability.PromptTypeDetection */)?.promptType),
            isCustomPtyImplementation: !!slc.customPtyImplementation,
            isExtensionOwnedTerminal: !!slc.isExtensionOwnedTerminal,
            isLoginShell: (isString(slc.args) ? slc.args.split(' ') : slc.args)?.some(arg => arg === '-l' || arg === '--login') ?? false,
            isReconnect: !!slc.attachPersistentProcess,
            hasRemoteAuthority: instance.hasRemoteAuthority,
            shellIntegrationQuality: commandDetection?.hasRichCommandDetection ? 2 : commandDetection ? 1 : 0,
            shellIntegrationInjected: instance.usedShellIntegrationInjection,
            shellIntegrationInjectionFailureReason: instance.shellIntegrationInjectionFailureReason,
            terminalSessionId: instance.sessionId,
        });
    }
};
TerminalTelemetryContribution = __decorate([
    __param(0, ILifecycleService),
    __param(1, ITerminalService),
    __param(2, ITerminalEditorService),
    __param(3, ITelemetryService)
], TerminalTelemetryContribution);
export { TerminalTelemetryContribution };
// #region Shell Type
var AllowedShellType;
(function (AllowedShellType) {
    AllowedShellType["Unknown"] = "unknown";
    // Windows only
    AllowedShellType["CommandPrompt"] = "cmd";
    AllowedShellType["Cygwin"] = "cygwin-bash";
    AllowedShellType["GitBash"] = "git-bash";
    AllowedShellType["Msys2"] = "msys2-bash";
    AllowedShellType["WindowsPowerShell"] = "windows-powershell";
    AllowedShellType["Wsl"] = "wsl";
    // Common Unix shells
    AllowedShellType["Bash"] = "bash";
    AllowedShellType["Fish"] = "fish";
    AllowedShellType["Pwsh"] = "pwsh";
    AllowedShellType["PwshPreview"] = "pwsh-preview";
    AllowedShellType["Sh"] = "sh";
    AllowedShellType["Ssh"] = "ssh";
    AllowedShellType["Tmux"] = "tmux";
    AllowedShellType["Zsh"] = "zsh";
    // More shells
    AllowedShellType["Amm"] = "amm";
    AllowedShellType["Ash"] = "ash";
    AllowedShellType["Csh"] = "csh";
    AllowedShellType["Dash"] = "dash";
    AllowedShellType["Elvish"] = "elvish";
    AllowedShellType["Ion"] = "ion";
    AllowedShellType["Ksh"] = "ksh";
    AllowedShellType["Mksh"] = "mksh";
    AllowedShellType["Msh"] = "msh";
    AllowedShellType["NuShell"] = "nu";
    AllowedShellType["Plan9Shell"] = "rc";
    AllowedShellType["SchemeShell"] = "scsh";
    AllowedShellType["Tcsh"] = "tcsh";
    AllowedShellType["Termux"] = "termux";
    AllowedShellType["Xonsh"] = "xonsh";
    // Lanugage REPLs
    // These are expected to be very low since they are not typically the default shell
    AllowedShellType["Clojure"] = "clj";
    AllowedShellType["CommonLispSbcl"] = "sbcl";
    AllowedShellType["Crystal"] = "crystal";
    AllowedShellType["Deno"] = "deno";
    AllowedShellType["Elixir"] = "iex";
    AllowedShellType["Erlang"] = "erl";
    AllowedShellType["FSharp"] = "fsi";
    AllowedShellType["Go"] = "go";
    AllowedShellType["HaskellGhci"] = "ghci";
    AllowedShellType["Java"] = "jshell";
    AllowedShellType["Julia"] = "julia";
    AllowedShellType["Lua"] = "lua";
    AllowedShellType["Node"] = "node";
    AllowedShellType["Ocaml"] = "ocaml";
    AllowedShellType["Perl"] = "perl";
    AllowedShellType["Php"] = "php";
    AllowedShellType["PrologSwipl"] = "swipl";
    AllowedShellType["Python"] = "python";
    AllowedShellType["R"] = "R";
    AllowedShellType["RubyIrb"] = "irb";
    AllowedShellType["Scala"] = "scala";
    AllowedShellType["SchemeRacket"] = "racket";
    AllowedShellType["SmalltalkGnu"] = "gst";
    AllowedShellType["SmalltalkPharo"] = "pharo";
    AllowedShellType["Tcl"] = "tclsh";
    AllowedShellType["TsNode"] = "ts-node";
})(AllowedShellType || (AllowedShellType = {}));
// Types that match the executable name directly
const shellTypeExecutableAllowList = new Set([
    "cmd" /* AllowedShellType.CommandPrompt */,
    "wsl" /* AllowedShellType.Wsl */,
    "bash" /* AllowedShellType.Bash */,
    "fish" /* AllowedShellType.Fish */,
    "pwsh" /* AllowedShellType.Pwsh */,
    "sh" /* AllowedShellType.Sh */,
    "ssh" /* AllowedShellType.Ssh */,
    "tmux" /* AllowedShellType.Tmux */,
    "zsh" /* AllowedShellType.Zsh */,
    "amm" /* AllowedShellType.Amm */,
    "ash" /* AllowedShellType.Ash */,
    "csh" /* AllowedShellType.Csh */,
    "dash" /* AllowedShellType.Dash */,
    "elvish" /* AllowedShellType.Elvish */,
    "ion" /* AllowedShellType.Ion */,
    "ksh" /* AllowedShellType.Ksh */,
    "mksh" /* AllowedShellType.Mksh */,
    "msh" /* AllowedShellType.Msh */,
    "nu" /* AllowedShellType.NuShell */,
    "rc" /* AllowedShellType.Plan9Shell */,
    "scsh" /* AllowedShellType.SchemeShell */,
    "tcsh" /* AllowedShellType.Tcsh */,
    "termux" /* AllowedShellType.Termux */,
    "xonsh" /* AllowedShellType.Xonsh */,
    "clj" /* AllowedShellType.Clojure */,
    "sbcl" /* AllowedShellType.CommonLispSbcl */,
    "crystal" /* AllowedShellType.Crystal */,
    "deno" /* AllowedShellType.Deno */,
    "iex" /* AllowedShellType.Elixir */,
    "erl" /* AllowedShellType.Erlang */,
    "fsi" /* AllowedShellType.FSharp */,
    "go" /* AllowedShellType.Go */,
    "ghci" /* AllowedShellType.HaskellGhci */,
    "jshell" /* AllowedShellType.Java */,
    "julia" /* AllowedShellType.Julia */,
    "lua" /* AllowedShellType.Lua */,
    "node" /* AllowedShellType.Node */,
    "ocaml" /* AllowedShellType.Ocaml */,
    "perl" /* AllowedShellType.Perl */,
    "php" /* AllowedShellType.Php */,
    "swipl" /* AllowedShellType.PrologSwipl */,
    "python" /* AllowedShellType.Python */,
    "R" /* AllowedShellType.R */,
    "irb" /* AllowedShellType.RubyIrb */,
    "scala" /* AllowedShellType.Scala */,
    "racket" /* AllowedShellType.SchemeRacket */,
    "gst" /* AllowedShellType.SmalltalkGnu */,
    "pharo" /* AllowedShellType.SmalltalkPharo */,
    "tclsh" /* AllowedShellType.Tcl */,
    "ts-node" /* AllowedShellType.TsNode */,
]);
// Dynamic executables that map to a single type
const shellTypeExecutableRegexAllowList = [
    { regex: /^(?:pwsh|powershell)-preview$/i, type: "pwsh-preview" /* AllowedShellType.PwshPreview */ },
    { regex: /^python(?:\d+(?:\.\d+)?)?$/i, type: "python" /* AllowedShellType.Python */ },
];
// Path-based look ups
const shellTypePathRegexAllowList = [
    // Cygwin uses bash.exe, so look up based on the path
    { regex: /\\Cygwin(?:64)?\\.+\\bash\.exe$/i, type: "cygwin-bash" /* AllowedShellType.Cygwin */ },
    // Git bash uses bash.exe, so look up based on the path
    { regex: /\\Git\\.+\\bash\.exe$/i, type: "git-bash" /* AllowedShellType.GitBash */ },
    // Msys2 uses bash.exe, so look up based on the path
    { regex: /\\msys(?:32|64)\\.+\\(?:bash|msys2)\.exe$/i, type: "msys2-bash" /* AllowedShellType.Msys2 */ },
    // WindowsPowerShell should always be installed on this path, we cannot just look at the
    // executable name since powershell is the CLI on other platforms sometimes (eg. snap package)
    { regex: /\\WindowsPowerShell\\v1.0\\powershell.exe$/i, type: "windows-powershell" /* AllowedShellType.WindowsPowerShell */ },
    // WSL executables will represent some other shell in the end, but it's difficult to determine
    // when we log
    { regex: /\\Windows\\(?:System32|SysWOW64|Sysnative)\\(?:bash|wsl)\.exe$/i, type: "wsl" /* AllowedShellType.Wsl */ },
];
function getSanitizedShellType(slc) {
    if (!slc.executable) {
        return "unknown" /* AllowedShellType.Unknown */;
    }
    const executableFile = basename(slc.executable);
    const executableFileWithoutExt = executableFile.replace(/\.[^\.]+$/, '');
    for (const entry of shellTypePathRegexAllowList) {
        if (entry.regex.test(slc.executable)) {
            return entry.type;
        }
    }
    for (const entry of shellTypeExecutableRegexAllowList) {
        if (entry.regex.test(executableFileWithoutExt)) {
            return entry.type;
        }
    }
    if ((shellTypeExecutableAllowList).has(executableFileWithoutExt)) {
        return executableFileWithoutExt;
    }
    return "unknown" /* AllowedShellType.Unknown */;
}
// #endregion Shell Type
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxUZWxlbWV0cnkuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbFRlbGVtZXRyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDaEUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDdkUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMzRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDNUQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDdkYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFFaEcsT0FBTyxFQUFFLGdCQUFnQixFQUF3RSxNQUFNLGtEQUFrRCxDQUFDO0FBRTFKLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxnQkFBZ0IsRUFBMEIsTUFBTSxlQUFlLENBQUM7QUFFMUYsSUFBTSw2QkFBNkIsR0FBbkMsTUFBTSw2QkFBOEIsU0FBUSxVQUFVO2FBQ3JELE9BQUUsR0FBRyxtQkFBbUIsQUFBdEIsQ0FBdUI7SUFFaEMsWUFDb0IsZ0JBQW1DLEVBQ3BDLGVBQWlDLEVBQzNCLHFCQUE2QyxFQUNqQyxpQkFBb0M7UUFF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