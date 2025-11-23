/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { Registry } from '../../registry/common/platform.js';
export var TerminalSettingPrefix;
(function (TerminalSettingPrefix) {
    TerminalSettingPrefix["AutomationProfile"] = "terminal.integrated.automationProfile.";
    TerminalSettingPrefix["DefaultProfile"] = "terminal.integrated.defaultProfile.";
    TerminalSettingPrefix["Profiles"] = "terminal.integrated.profiles.";
})(TerminalSettingPrefix || (TerminalSettingPrefix = {}));
export var TerminalSettingId;
(function (TerminalSettingId) {
    TerminalSettingId["SendKeybindingsToShell"] = "terminal.integrated.sendKeybindingsToShell";
    TerminalSettingId["AutomationProfileLinux"] = "terminal.integrated.automationProfile.linux";
    TerminalSettingId["AutomationProfileMacOs"] = "terminal.integrated.automationProfile.osx";
    TerminalSettingId["AutomationProfileWindows"] = "terminal.integrated.automationProfile.windows";
    TerminalSettingId["ProfilesWindows"] = "terminal.integrated.profiles.windows";
    TerminalSettingId["ProfilesMacOs"] = "terminal.integrated.profiles.osx";
    TerminalSettingId["ProfilesLinux"] = "terminal.integrated.profiles.linux";
    TerminalSettingId["DefaultProfileLinux"] = "terminal.integrated.defaultProfile.linux";
    TerminalSettingId["DefaultProfileMacOs"] = "terminal.integrated.defaultProfile.osx";
    TerminalSettingId["DefaultProfileWindows"] = "terminal.integrated.defaultProfile.windows";
    TerminalSettingId["UseWslProfiles"] = "terminal.integrated.useWslProfiles";
    TerminalSettingId["TabsDefaultColor"] = "terminal.integrated.tabs.defaultColor";
    TerminalSettingId["TabsDefaultIcon"] = "terminal.integrated.tabs.defaultIcon";
    TerminalSettingId["TabsEnabled"] = "terminal.integrated.tabs.enabled";
    TerminalSettingId["TabsEnableAnimation"] = "terminal.integrated.tabs.enableAnimation";
    TerminalSettingId["TabsHideCondition"] = "terminal.integrated.tabs.hideCondition";
    TerminalSettingId["TabsShowActiveTerminal"] = "terminal.integrated.tabs.showActiveTerminal";
    TerminalSettingId["TabsShowActions"] = "terminal.integrated.tabs.showActions";
    TerminalSettingId["TabsLocation"] = "terminal.integrated.tabs.location";
    TerminalSettingId["TabsFocusMode"] = "terminal.integrated.tabs.focusMode";
    TerminalSettingId["MacOptionIsMeta"] = "terminal.integrated.macOptionIsMeta";
    TerminalSettingId["MacOptionClickForcesSelection"] = "terminal.integrated.macOptionClickForcesSelection";
    TerminalSettingId["AltClickMovesCursor"] = "terminal.integrated.altClickMovesCursor";
    TerminalSettingId["CopyOnSelection"] = "terminal.integrated.copyOnSelection";
    TerminalSettingId["EnableMultiLinePasteWarning"] = "terminal.integrated.enableMultiLinePasteWarning";
    TerminalSettingId["DrawBoldTextInBrightColors"] = "terminal.integrated.drawBoldTextInBrightColors";
    TerminalSettingId["FontFamily"] = "terminal.integrated.fontFamily";
    TerminalSettingId["FontSize"] = "terminal.integrated.fontSize";
    TerminalSettingId["LetterSpacing"] = "terminal.integrated.letterSpacing";
    TerminalSettingId["LineHeight"] = "terminal.integrated.lineHeight";
    TerminalSettingId["MinimumContrastRatio"] = "terminal.integrated.minimumContrastRatio";
    TerminalSettingId["TabStopWidth"] = "terminal.integrated.tabStopWidth";
    TerminalSettingId["FastScrollSensitivity"] = "terminal.integrated.fastScrollSensitivity";
    TerminalSettingId["MouseWheelScrollSensitivity"] = "terminal.integrated.mouseWheelScrollSensitivity";
    TerminalSettingId["BellDuration"] = "terminal.integrated.bellDuration";
    TerminalSettingId["FontWeight"] = "terminal.integrated.fontWeight";
    TerminalSettingId["FontWeightBold"] = "terminal.integrated.fontWeightBold";
    TerminalSettingId["CursorBlinking"] = "terminal.integrated.cursorBlinking";
    TerminalSettingId["CursorStyle"] = "terminal.integrated.cursorStyle";
    TerminalSettingId["CursorStyleInactive"] = "terminal.integrated.cursorStyleInactive";
    TerminalSettingId["CursorWidth"] = "terminal.integrated.cursorWidth";
    TerminalSettingId["Scrollback"] = "terminal.integrated.scrollback";
    TerminalSettingId["DetectLocale"] = "terminal.integrated.detectLocale";
    TerminalSettingId["DefaultLocation"] = "terminal.integrated.defaultLocation";
    TerminalSettingId["GpuAcceleration"] = "terminal.integrated.gpuAcceleration";
    TerminalSettingId["TerminalTitleSeparator"] = "terminal.integrated.tabs.separator";
    TerminalSettingId["TerminalTitle"] = "terminal.integrated.tabs.title";
    TerminalSettingId["TerminalDescription"] = "terminal.integrated.tabs.description";
    TerminalSettingId["RightClickBehavior"] = "terminal.integrated.rightClickBehavior";
    TerminalSettingId["MiddleClickBehavior"] = "terminal.integrated.middleClickBehavior";
    TerminalSettingId["Cwd"] = "terminal.integrated.cwd";
    TerminalSettingId["ConfirmOnExit"] = "terminal.integrated.confirmOnExit";
    TerminalSettingId["ConfirmOnKill"] = "terminal.integrated.confirmOnKill";
    TerminalSettingId["EnableBell"] = "terminal.integrated.enableBell";
    TerminalSettingId["EnableVisualBell"] = "terminal.integrated.enableVisualBell";
    TerminalSettingId["CommandsToSkipShell"] = "terminal.integrated.commandsToSkipShell";
    TerminalSettingId["AllowChords"] = "terminal.integrated.allowChords";
    TerminalSettingId["AllowMnemonics"] = "terminal.integrated.allowMnemonics";
    TerminalSettingId["TabFocusMode"] = "terminal.integrated.tabFocusMode";
    TerminalSettingId["EnvMacOs"] = "terminal.integrated.env.osx";
    TerminalSettingId["EnvLinux"] = "terminal.integrated.env.linux";
    TerminalSettingId["EnvWindows"] = "terminal.integrated.env.windows";
    TerminalSettingId["EnvironmentChangesRelaunch"] = "terminal.integrated.environmentChangesRelaunch";
    TerminalSettingId["ShowExitAlert"] = "terminal.integrated.showExitAlert";
    TerminalSettingId["SplitCwd"] = "terminal.integrated.splitCwd";
    TerminalSettingId["WindowsEnableConpty"] = "terminal.integrated.windowsEnableConpty";
    TerminalSettingId["WindowsUseConptyDll"] = "terminal.integrated.windowsUseConptyDll";
    TerminalSettingId["WordSeparators"] = "terminal.integrated.wordSeparators";
    TerminalSettingId["EnableFileLinks"] = "terminal.integrated.enableFileLinks";
    TerminalSettingId["AllowedLinkSchemes"] = "terminal.integrated.allowedLinkSchemes";
    TerminalSettingId["UnicodeVersion"] = "terminal.integrated.unicodeVersion";
    TerminalSettingId["EnablePersistentSessions"] = "terminal.integrated.enablePersistentSessions";
    TerminalSettingId["PersistentSessionReviveProcess"] = "terminal.integrated.persistentSessionReviveProcess";
    TerminalSettingId["HideOnStartup"] = "terminal.integrated.hideOnStartup";
    TerminalSettingId["HideOnLastClosed"] = "terminal.integrated.hideOnLastClosed";
    TerminalSettingId["CustomGlyphs"] = "terminal.integrated.customGlyphs";
    TerminalSettingId["RescaleOverlappingGlyphs"] = "terminal.integrated.rescaleOverlappingGlyphs";
    TerminalSettingId["PersistentSessionScrollback"] = "terminal.integrated.persistentSessionScrollback";
    TerminalSettingId["InheritEnv"] = "terminal.integrated.inheritEnv";
    TerminalSettingId["ShowLinkHover"] = "terminal.integrated.showLinkHover";
    TerminalSettingId["IgnoreProcessNames"] = "terminal.integrated.ignoreProcessNames";
    TerminalSettingId["ShellIntegrationEnabled"] = "terminal.integrated.shellIntegration.enabled";
    TerminalSettingId["ShellIntegrationShowWelcome"] = "terminal.integrated.shellIntegration.showWelcome";
    TerminalSettingId["ShellIntegrationDecorationsEnabled"] = "terminal.integrated.shellIntegration.decorationsEnabled";
    TerminalSettingId["ShellIntegrationTimeout"] = "terminal.integrated.shellIntegration.timeout";
    TerminalSettingId["ShellIntegrationQuickFixEnabled"] = "terminal.integrated.shellIntegration.quickFixEnabled";
    TerminalSettingId["ShellIntegrationEnvironmentReporting"] = "terminal.integrated.shellIntegration.environmentReporting";
    TerminalSettingId["EnableImages"] = "terminal.integrated.enableImages";
    TerminalSettingId["SmoothScrolling"] = "terminal.integrated.smoothScrolling";
    TerminalSettingId["IgnoreBracketedPasteMode"] = "terminal.integrated.ignoreBracketedPasteMode";
    TerminalSettingId["FocusAfterRun"] = "terminal.integrated.focusAfterRun";
    TerminalSettingId["FontLigaturesEnabled"] = "terminal.integrated.fontLigatures.enabled";
    TerminalSettingId["FontLigaturesFeatureSettings"] = "terminal.integrated.fontLigatures.featureSettings";
    TerminalSettingId["FontLigaturesFallbackLigatures"] = "terminal.integrated.fontLigatures.fallbackLigatures";
    // Developer/debug settings
    /** Simulated latency applied to all calls made to the pty host */
    TerminalSettingId["DeveloperPtyHostLatency"] = "terminal.integrated.developer.ptyHost.latency";
    /** Simulated startup delay of the pty host process */
    TerminalSettingId["DeveloperPtyHostStartupDelay"] = "terminal.integrated.developer.ptyHost.startupDelay";
    /** Shows the textarea element */
    TerminalSettingId["DevMode"] = "terminal.integrated.developer.devMode";
})(TerminalSettingId || (TerminalSettingId = {}));
export var PosixShellType;
(function (PosixShellType) {
    PosixShellType["Bash"] = "bash";
    PosixShellType["Fish"] = "fish";
    PosixShellType["Sh"] = "sh";
    PosixShellType["Csh"] = "csh";
    PosixShellType["Ksh"] = "ksh";
    PosixShellType["Zsh"] = "zsh";
})(PosixShellType || (PosixShellType = {}));
export var WindowsShellType;
(function (WindowsShellType) {
    WindowsShellType["CommandPrompt"] = "cmd";
    WindowsShellType["Wsl"] = "wsl";
    WindowsShellType["GitBash"] = "gitbash";
})(WindowsShellType || (WindowsShellType = {}));
export var GeneralShellType;
(function (GeneralShellType) {
    GeneralShellType["PowerShell"] = "pwsh";
    GeneralShellType["Python"] = "python";
    GeneralShellType["Julia"] = "julia";
    GeneralShellType["NuShell"] = "nu";
    GeneralShellType["Node"] = "node";
})(GeneralShellType || (GeneralShellType = {}));
export var TitleEventSource;
(function (TitleEventSource) {
    /** From the API or the rename command that overrides any other type */
    TitleEventSource[TitleEventSource["Api"] = 0] = "Api";
    /** From the process name property*/
    TitleEventSource[TitleEventSource["Process"] = 1] = "Process";
    /** From the VT sequence */
    TitleEventSource[TitleEventSource["Sequence"] = 2] = "Sequence";
    /** Config changed */
    TitleEventSource[TitleEventSource["Config"] = 3] = "Config";
})(TitleEventSource || (TitleEventSource = {}));
export var TerminalIpcChannels;
(function (TerminalIpcChannels) {
    /**
     * Communicates between the renderer process and shared process.
     */
    TerminalIpcChannels["LocalPty"] = "localPty";
    /**
     * Communicates between the shared process and the pty host process.
     */
    TerminalIpcChannels["PtyHost"] = "ptyHost";
    /**
     * Communicates between the renderer process and the pty host process.
     */
    TerminalIpcChannels["PtyHostWindow"] = "ptyHostWindow";
    /**
     * Deals with logging from the pty host process.
     */
    TerminalIpcChannels["Logger"] = "logger";
    /**
     * Enables the detection of unresponsive pty hosts.
     */
    TerminalIpcChannels["Heartbeat"] = "heartbeat";
})(TerminalIpcChannels || (TerminalIpcChannels = {}));
export var ProcessPropertyType;
(function (ProcessPropertyType) {
    ProcessPropertyType["Cwd"] = "cwd";
    ProcessPropertyType["InitialCwd"] = "initialCwd";
    ProcessPropertyType["FixedDimensions"] = "fixedDimensions";
    ProcessPropertyType["Title"] = "title";
    ProcessPropertyType["ShellType"] = "shellType";
    ProcessPropertyType["HasChildProcesses"] = "hasChildProcesses";
    ProcessPropertyType["ResolvedShellLaunchConfig"] = "resolvedShellLaunchConfig";
    ProcessPropertyType["OverrideDimensions"] = "overrideDimensions";
    ProcessPropertyType["FailedShellIntegrationActivation"] = "failedShellIntegrationActivation";
    ProcessPropertyType["UsedShellIntegrationInjection"] = "usedShellIntegrationInjection";
    ProcessPropertyType["ShellIntegrationInjectionFailureReason"] = "shellIntegrationInjectionFailureReason";
})(ProcessPropertyType || (ProcessPropertyType = {}));
export const IPtyService = createDecorator('ptyService');
export var HeartbeatConstants;
(function (HeartbeatConstants) {
    /**
     * The duration between heartbeats
     */
    HeartbeatConstants[HeartbeatConstants["BeatInterval"] = 5000] = "BeatInterval";
    /**
     * The duration of the first heartbeat while the pty host is starting up. This is much larger
     * than the regular BeatInterval to accommodate slow machines, we still want to warn about the
     * pty host's unresponsiveness eventually though.
     */
    HeartbeatConstants[HeartbeatConstants["ConnectingBeatInterval"] = 20000] = "ConnectingBeatInterval";
    /**
     * Defines a multiplier for BeatInterval for how long to wait before starting the second wait
     * timer.
     */
    HeartbeatConstants[HeartbeatConstants["FirstWaitMultiplier"] = 1.2] = "FirstWaitMultiplier";
    /**
     * Defines a multiplier for BeatInterval for how long to wait before telling the user about
     * non-responsiveness. The second timer is to avoid informing the user incorrectly when waking
     * the computer up from sleep
     */
    HeartbeatConstants[HeartbeatConstants["SecondWaitMultiplier"] = 1] = "SecondWaitMultiplier";
    /**
     * How long to wait before telling the user about non-responsiveness when they try to create a
     * process. This short circuits the standard wait timeouts to tell the user sooner and only
     * create process is handled to avoid additional perf overhead.
     */
    HeartbeatConstants[HeartbeatConstants["CreateProcessTimeout"] = 5000] = "CreateProcessTimeout";
})(HeartbeatConstants || (HeartbeatConstants = {}));
export var TerminalLocation;
(function (TerminalLocation) {
    TerminalLocation[TerminalLocation["Panel"] = 1] = "Panel";
    TerminalLocation[TerminalLocation["Editor"] = 2] = "Editor";
})(TerminalLocation || (TerminalLocation = {}));
export var TerminalLocationConfigValue;
(function (TerminalLocationConfigValue) {
    TerminalLocationConfigValue["TerminalView"] = "view";
    TerminalLocationConfigValue["Editor"] = "editor";
})(TerminalLocationConfigValue || (TerminalLocationConfigValue = {}));
export var LocalReconnectConstants;
(function (LocalReconnectConstants) {
    /**
     * If there is no reconnection within this time-frame, consider the connection permanently closed...
    */
    LocalReconnectConstants[LocalReconnectConstants["GraceTime"] = 60000] = "GraceTime";
    /**
     * Maximal grace time between the first and the last reconnection...
    */
    LocalReconnectConstants[LocalReconnectConstants["ShortGraceTime"] = 6000] = "ShortGraceTime";
})(LocalReconnectConstants || (LocalReconnectConstants = {}));
export var FlowControlConstants;
(function (FlowControlConstants) {
    /**
     * The number of _unacknowledged_ chars to have been sent before the pty is paused in order for
     * the client to catch up.
     */
    FlowControlConstants[FlowControlConstants["HighWatermarkChars"] = 100000] = "HighWatermarkChars";
    /**
     * After flow control pauses the pty for the client the catch up, this is the number of
     * _unacknowledged_ chars to have been caught up to on the client before resuming the pty again.
     * This is used to attempt to prevent pauses in the flowing data; ideally while the pty is
     * paused the number of unacknowledged chars would always be greater than 0 or the client will
     * appear to stutter. In reality this balance is hard to accomplish though so heavy commands
     * will likely pause as latency grows, not flooding the connection is the important thing as
     * it's shared with other core functionality.
     */
    FlowControlConstants[FlowControlConstants["LowWatermarkChars"] = 5000] = "LowWatermarkChars";
    /**
     * The number characters that are accumulated on the client side before sending an ack event.
     * This must be less than or equal to LowWatermarkChars or the terminal max never unpause.
     */
    FlowControlConstants[FlowControlConstants["CharCountAckSize"] = 5000] = "CharCountAckSize";
})(FlowControlConstants || (FlowControlConstants = {}));
export var ProfileSource;
(function (ProfileSource) {
    ProfileSource["GitBash"] = "Git Bash";
    ProfileSource["Pwsh"] = "PowerShell";
})(ProfileSource || (ProfileSource = {}));
export var ShellIntegrationStatus;
(function (ShellIntegrationStatus) {
    /** No shell integration sequences have been encountered. */
    ShellIntegrationStatus[ShellIntegrationStatus["Off"] = 0] = "Off";
    /** Final term shell integration sequences have been encountered. */
    ShellIntegrationStatus[ShellIntegrationStatus["FinalTerm"] = 1] = "FinalTerm";
    /** VS Code shell integration sequences have been encountered. Supercedes FinalTerm. */
    ShellIntegrationStatus[ShellIntegrationStatus["VSCode"] = 2] = "VSCode";
})(ShellIntegrationStatus || (ShellIntegrationStatus = {}));
export var ShellIntegrationInjectionFailureReason;
(function (ShellIntegrationInjectionFailureReason) {
    /**
     * The setting is disabled.
     */
    ShellIntegrationInjectionFailureReason["InjectionSettingDisabled"] = "injectionSettingDisabled";
    /**
     * There is no executable (so there's no way to determine how to inject).
     */
    ShellIntegrationInjectionFailureReason["NoExecutable"] = "noExecutable";
    /**
     * It's a feature terminal (tasks, debug), unless it's explicitly being forced.
     */
    ShellIntegrationInjectionFailureReason["FeatureTerminal"] = "featureTerminal";
    /**
     * The ignoreShellIntegration flag is passed (eg. relaunching without shell integration).
     */
    ShellIntegrationInjectionFailureReason["IgnoreShellIntegrationFlag"] = "ignoreShellIntegrationFlag";
    /**
     * Shell integration doesn't work with winpty.
     */
    ShellIntegrationInjectionFailureReason["Winpty"] = "winpty";
    /**
     * We're conservative whether we inject when we don't recognize the arguments used for the
     * shell as we would prefer launching one without shell integration than breaking their profile.
     */
    ShellIntegrationInjectionFailureReason["UnsupportedArgs"] = "unsupportedArgs";
    /**
     * The shell doesn't have built-in shell integration. Note that this doesn't mean the shell
     * won't have shell integration in the end.
     */
    ShellIntegrationInjectionFailureReason["UnsupportedShell"] = "unsupportedShell";
    /**
     * For zsh, we failed to set the sticky bit on the shell integration script folder.
     */
    ShellIntegrationInjectionFailureReason["FailedToSetStickyBit"] = "failedToSetStickyBit";
    /**
     * For zsh, we failed to create a temp directory for the shell integration script.
     */
    ShellIntegrationInjectionFailureReason["FailedToCreateTmpDir"] = "failedToCreateTmpDir";
})(ShellIntegrationInjectionFailureReason || (ShellIntegrationInjectionFailureReason = {}));
export var TerminalExitReason;
(function (TerminalExitReason) {
    TerminalExitReason[TerminalExitReason["Unknown"] = 0] = "Unknown";
    TerminalExitReason[TerminalExitReason["Shutdown"] = 1] = "Shutdown";
    TerminalExitReason[TerminalExitReason["Process"] = 2] = "Process";
    TerminalExitReason[TerminalExitReason["User"] = 3] = "User";
    TerminalExitReason[TerminalExitReason["Extension"] = 4] = "Extension";
})(TerminalExitReason || (TerminalExitReason = {}));
export const TerminalExtensions = {
    Backend: 'workbench.contributions.terminal.processBackend'
};
class TerminalBackendRegistry {
    constructor() {
        this._backends = new Map();
    }
    get backends() { return this._backends; }
    registerTerminalBackend(backend) {
        const key = this._sanitizeRemoteAuthority(backend.remoteAuthority);
        if (this._backends.has(key)) {
            throw new Error(`A terminal backend with remote authority '${key}' was already registered.`);
        }
        this._backends.set(key, backend);
    }
    getTerminalBackend(remoteAuthority) {
        return this._backends.get(this._sanitizeRemoteAuthority(remoteAuthority));
    }
    _sanitizeRemoteAuthority(remoteAuthority) {
        // Normalize the key to lowercase as the authority is case-insensitive
        return remoteAuthority?.toLowerCase() ?? '';
    }
}
Registry.add(TerminalExtensions.Backend, new TerminalBackendRegistry());
export const ILocalPtyService = createDecorator('localPtyService');
export const ITerminalLogService = createDecorator('terminalLogService');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBS2hHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQU05RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFPN0QsTUFBTSxDQUFOLElBQWtCLHFCQUlqQjtBQUpELFdBQWtCLHFCQUFxQjtJQUN0QyxxRkFBNEQsQ0FBQTtJQUM1RCwrRUFBc0QsQ0FBQTtJQUN0RCxtRUFBMEMsQ0FBQTtBQUMzQyxDQUFDLEVBSmlCLHFCQUFxQixLQUFyQixxQkFBcUIsUUFJdEM7QUFFRCxNQUFNLENBQU4sSUFBa0IsaUJBd0dqQjtBQXhHRCxXQUFrQixpQkFBaUI7SUFDbEMsMEZBQXFFLENBQUE7SUFDckUsMkZBQXNFLENBQUE7SUFDdEUseUZBQW9FLENBQUE7SUFDcEUsK0ZBQTBFLENBQUE7SUFDMUUsNkVBQXdELENBQUE7SUFDeEQsdUVBQWtELENBQUE7SUFDbEQseUVBQW9ELENBQUE7SUFDcEQscUZBQWdFLENBQUE7SUFDaEUsbUZBQThELENBQUE7SUFDOUQseUZBQW9FLENBQUE7SUFDcEUsMEVBQXFELENBQUE7SUFDckQsK0VBQTBELENBQUE7SUFDMUQsNkVBQXdELENBQUE7SUFDeEQscUVBQWdELENBQUE7SUFDaEQscUZBQWdFLENBQUE7SUFDaEUsaUZBQTRELENBQUE7SUFDNUQsMkZBQXNFLENBQUE7SUFDdEUsNkVBQXdELENBQUE7SUFDeEQsdUVBQWtELENBQUE7SUFDbEQseUVBQW9ELENBQUE7SUFDcEQsNEVBQXVELENBQUE7SUFDdkQsd0dBQW1GLENBQUE7SUFDbkYsb0ZBQStELENBQUE7SUFDL0QsNEVBQXVELENBQUE7SUFDdkQsb0dBQStFLENBQUE7SUFDL0Usa0dBQTZFLENBQUE7SUFDN0Usa0VBQTZDLENBQUE7SUFDN0MsOERBQXlDLENBQUE7SUFDekMsd0VBQW1ELENBQUE7SUFDbkQsa0VBQTZDLENBQUE7SUFDN0Msc0ZBQWlFLENBQUE7SUFDakUsc0VBQWlELENBQUE7SUFDakQsd0ZBQW1FLENBQUE7SUFDbkUsb0dBQStFLENBQUE7SUFDL0Usc0VBQWlELENBQUE7SUFDakQsa0VBQTZDLENBQUE7SUFDN0MsMEVBQXFELENBQUE7SUFDckQsMEVBQXFELENBQUE7SUFDckQsb0VBQStDLENBQUE7SUFDL0Msb0ZBQStELENBQUE7SUFDL0Qsb0VBQStDLENBQUE7SUFDL0Msa0VBQTZDLENBQUE7SUFDN0Msc0VBQWlELENBQUE7SUFDakQsNEVBQXVELENBQUE7SUFDdkQsNEVBQXVELENBQUE7SUFDdkQsa0ZBQTZELENBQUE7SUFDN0QscUVBQWdELENBQUE7SUFDaEQsaUZBQTRELENBQUE7SUFDNUQsa0ZBQTZELENBQUE7SUFDN0Qsb0ZBQStELENBQUE7SUFDL0Qsb0RBQStCLENBQUE7SUFDL0Isd0VBQW1ELENBQUE7SUFDbkQsd0VBQW1ELENBQUE7SUFDbkQsa0VBQTZDLENBQUE7SUFDN0MsOEVBQXlELENBQUE7SUFDekQsb0ZBQStELENBQUE7SUFDL0Qsb0VBQStDLENBQUE7SUFDL0MsMEVBQXFELENBQUE7SUFDckQsc0VBQWlELENBQUE7SUFDakQsNkRBQXdDLENBQUE7SUFDeEMsK0RBQTBDLENBQUE7SUFDMUMsbUVBQThDLENBQUE7SUFDOUMsa0dBQTZFLENBQUE7SUFDN0Usd0VBQW1ELENBQUE7SUFDbkQsOERBQXlDLENBQUE7SUFDekMsb0ZBQStELENBQUE7SUFDL0Qsb0ZBQStELENBQUE7SUFDL0QsMEVBQXFELENBQUE7SUFDckQsNEVBQXVELENBQUE7SUFDdkQsa0ZBQTZELENBQUE7SUFDN0QsMEVBQXFELENBQUE7SUFDckQsOEZBQXlFLENBQUE7SUFDekUsMEdBQXFGLENBQUE7SUFDckYsd0VBQW1ELENBQUE7SUFDbkQsOEVBQXlELENBQUE7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