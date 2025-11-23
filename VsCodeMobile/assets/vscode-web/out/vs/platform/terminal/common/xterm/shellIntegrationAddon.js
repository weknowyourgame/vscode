/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable, dispose, toDisposable } from '../../../../base/common/lifecycle.js';
import { TerminalCapabilityStore } from '../capabilities/terminalCapabilityStore.js';
import { CommandDetectionCapability } from '../capabilities/commandDetectionCapability.js';
import { CwdDetectionCapability } from '../capabilities/cwdDetectionCapability.js';
import { PartialCommandDetectionCapability } from '../capabilities/partialCommandDetectionCapability.js';
import { Emitter } from '../../../../base/common/event.js';
import { BufferMarkCapability } from '../capabilities/bufferMarkCapability.js';
import { URI } from '../../../../base/common/uri.js';
import { sanitizeCwd } from '../terminalEnvironment.js';
import { removeAnsiEscapeCodesFromPrompt } from '../../../../base/common/strings.js';
import { ShellEnvDetectionCapability } from '../capabilities/shellEnvDetectionCapability.js';
import { PromptTypeDetectionCapability } from '../capabilities/promptTypeDetectionCapability.js';
/**
 * Shell integration is a feature that enhances the terminal's understanding of what's happening
 * in the shell by injecting special sequences into the shell's prompt using the "Set Text
 * Parameters" sequence (`OSC Ps ; Pt ST`).
 *
 * Definitions:
 * - OSC: `\x1b]`
 * - Ps:  A single (usually optional) numeric parameter, composed of one or more digits.
 * - Pt:  A text parameter composed of printable characters.
 * - ST: `\x7`
 *
 * This is inspired by a feature of the same name in the FinalTerm, iTerm2 and kitty terminals.
 */
/**
 * The identifier for the first numeric parameter (`Ps`) for OSC commands used by shell integration.
 */
export var ShellIntegrationOscPs;
(function (ShellIntegrationOscPs) {
    /**
     * Sequences pioneered by FinalTerm.
     */
    ShellIntegrationOscPs[ShellIntegrationOscPs["FinalTerm"] = 133] = "FinalTerm";
    /**
     * Sequences pioneered by VS Code. The number is derived from the least significant digit of
     * "VSC" when encoded in hex ("VSC" = 0x56, 0x53, 0x43).
     */
    ShellIntegrationOscPs[ShellIntegrationOscPs["VSCode"] = 633] = "VSCode";
    /**
     * Sequences pioneered by iTerm.
     */
    ShellIntegrationOscPs[ShellIntegrationOscPs["ITerm"] = 1337] = "ITerm";
    ShellIntegrationOscPs[ShellIntegrationOscPs["SetCwd"] = 7] = "SetCwd";
    ShellIntegrationOscPs[ShellIntegrationOscPs["SetWindowsFriendlyCwd"] = 9] = "SetWindowsFriendlyCwd";
})(ShellIntegrationOscPs || (ShellIntegrationOscPs = {}));
/**
 * Sequences pioneered by FinalTerm.
 */
var FinalTermOscPt;
(function (FinalTermOscPt) {
    /**
     * The start of the prompt, this is expected to always appear at the start of a line.
     *
     * Format: `OSC 133 ; A ST`
     */
    FinalTermOscPt["PromptStart"] = "A";
    /**
     * The start of a command, ie. where the user inputs their command.
     *
     * Format: `OSC 133 ; B ST`
     */
    FinalTermOscPt["CommandStart"] = "B";
    /**
     * Sent just before the command output begins.
     *
     * Format: `OSC 133 ; C ST`
     */
    FinalTermOscPt["CommandExecuted"] = "C";
    /**
     * Sent just after a command has finished. The exit code is optional, when not specified it
     * means no command was run (ie. enter on empty prompt or ctrl+c).
     *
     * Format: `OSC 133 ; D [; <ExitCode>] ST`
     */
    FinalTermOscPt["CommandFinished"] = "D";
})(FinalTermOscPt || (FinalTermOscPt = {}));
/**
 * VS Code-specific shell integration sequences. Some of these are based on more common alternatives
 * like those pioneered in {@link FinalTermOscPt FinalTerm}. The decision to move to entirely custom
 * sequences was to try to improve reliability and prevent the possibility of applications confusing
 * the terminal. If multiple shell integration scripts run, VS Code will prioritize the VS
 * Code-specific ones.
 *
 * It's recommended that authors of shell integration scripts use the common sequences (`133`)
 * when building general purpose scripts and the VS Code-specific (`633`) when targeting only VS
 * Code or when there are no other alternatives (eg. {@link CommandLine `633 ; E`}). These sequences
 * support mix-and-matching.
 */
var VSCodeOscPt;
(function (VSCodeOscPt) {
    /**
     * The start of the prompt, this is expected to always appear at the start of a line.
     *
     * Format: `OSC 633 ; A ST`
     *
     * Based on {@link FinalTermOscPt.PromptStart}.
     */
    VSCodeOscPt["PromptStart"] = "A";
    /**
     * The start of a command, ie. where the user inputs their command.
     *
     * Format: `OSC 633 ; B ST`
     *
     * Based on  {@link FinalTermOscPt.CommandStart}.
     */
    VSCodeOscPt["CommandStart"] = "B";
    /**
     * Sent just before the command output begins.
     *
     * Format: `OSC 633 ; C ST`
     *
     * Based on {@link FinalTermOscPt.CommandExecuted}.
     */
    VSCodeOscPt["CommandExecuted"] = "C";
    /**
     * Sent just after a command has finished. This should generally be used on the new line
     * following the end of a command's output, just before {@link PromptStart}. The exit code is
     * optional, when not specified it means no command was run (ie. enter on empty prompt or
     * ctrl+c).
     *
     * Format: `OSC 633 ; D [; <ExitCode>] ST`
     *
     * Based on {@link FinalTermOscPt.CommandFinished}.
     */
    VSCodeOscPt["CommandFinished"] = "D";
    /**
     * Explicitly set the command line. This helps workaround performance and reliability problems
     * with parsing out the command, such as conpty not guaranteeing the position of the sequence or
     * the shell not guaranteeing that the entire command is even visible. Ideally this is called
     * immediately before {@link CommandExecuted}, immediately before {@link CommandFinished} will
     * also work but that means terminal will only know the accurate command line when the command is
     * finished.
     *
     * The command line can escape ascii characters using the `\xAB` format, where AB are the
     * hexadecimal representation of the character code (case insensitive), and escape the `\`
     * character using `\\`. It's required to escape semi-colon (`0x3b`) and characters 0x20 and
     * below, this is particularly important for new line and semi-colon.
     *
     * Some examples:
     *
     * ```
     * "\"  -> "\\"
     * "\n" -> "\x0a"
     * ";"  -> "\x3b"
     * ```
     *
     * An optional nonce can be provided which is may be required by the terminal in order enable
     * some features. This helps ensure no malicious command injection has occurred.
     *
     * Format: `OSC 633 ; E [; <CommandLine> [; <Nonce>]] ST`
     */
    VSCodeOscPt["CommandLine"] = "E";
    /**
     * Similar to prompt start but for line continuations.
     *
     * WARNING: This sequence is unfinalized, DO NOT use this in your shell integration script.
     */
    VSCodeOscPt["ContinuationStart"] = "F";
    /**
     * Similar to command start but for line continuations.
     *
     * WARNING: This sequence is unfinalized, DO NOT use this in your shell integration script.
     */
    VSCodeOscPt["ContinuationEnd"] = "G";
    /**
     * The start of the right prompt.
     *
     * WARNING: This sequence is unfinalized, DO NOT use this in your shell integration script.
     */
    VSCodeOscPt["RightPromptStart"] = "H";
    /**
     * The end of the right prompt.
     *
     * WARNING: This sequence is unfinalized, DO NOT use this in your shell integration script.
     */
    VSCodeOscPt["RightPromptEnd"] = "I";
    /**
     * Set the value of an arbitrary property, only known properties will be handled by VS Code.
     *
     * Format: `OSC 633 ; P ; <Property>=<Value> ST`
     *
     * Known properties:
     *
     * - `Cwd` - Reports the current working directory to the terminal.
     * - `IsWindows` - Reports whether the shell is using a Windows backend like winpty or conpty.
     *   This may be used to enable additional heuristics as the positioning of the shell
     *   integration sequences are not guaranteed to be correct. Valid values: `True`, `False`.
     * - `ContinuationPrompt` - Reports the continuation prompt that is printed at the start of
     *   multi-line inputs.
     * - `HasRichCommandDetection` - Reports whether the shell has rich command line detection,
     *   meaning that sequences A, B, C, D and E are exactly where they're meant to be. In
     *   particular, {@link CommandLine} must happen immediately before {@link CommandExecuted} so
     *   VS Code knows the command line when the execution begins.
     *
     * WARNING: Any other properties may be changed and are not guaranteed to work in the future.
     */
    VSCodeOscPt["Property"] = "P";
    /**
     * Sets a mark/point-of-interest in the buffer.
     *
     * Format: `OSC 633 ; SetMark [; Id=<string>] [; Hidden]`
     *
     * `Id` - The identifier of the mark that can be used to reference it
     * `Hidden` - When set, the mark will be available to reference internally but will not visible
     *
     * WARNING: This sequence is unfinalized, DO NOT use this in your shell integration script.
     */
    VSCodeOscPt["SetMark"] = "SetMark";
    /**
     * Sends the shell's complete environment in JSON format.
     *
     * Format: `OSC 633 ; EnvJson ; <Environment> ; <Nonce>`
     *
     * - `Environment` - A stringified JSON object containing the shell's complete environment. The
     *    variables and values use the same encoding rules as the {@link CommandLine} sequence.
     * - `Nonce` - An _mandatory_ nonce can be provided which may be required by the terminal in order
     *   to enable some features. This helps ensure no malicious command injection has occurred.
     *
     * WARNING: This sequence is unfinalized, DO NOT use this in your shell integration script.
     */
    VSCodeOscPt["EnvJson"] = "EnvJson";
    /**
     * Delete a single environment variable from cached environment.
     *
     * Format: `OSC 633 ; EnvSingleDelete ; <EnvironmentKey> ; <EnvironmentValue> [; <Nonce>]`
     *
     * - `Nonce` - An optional nonce can be provided which may be required by the terminal in order
     *   to enable some features. This helps ensure no malicious command injection has occurred.
     *
     * WARNING: This sequence is unfinalized, DO NOT use this in your shell integration script.
     */
    VSCodeOscPt["EnvSingleDelete"] = "EnvSingleDelete";
    /**
     * The start of the collecting user's environment variables individually.
     *
     * Format: `OSC 633 ; EnvSingleStart ; <Clear> [; <Nonce>]`
     *
     * - `Clear` - An _mandatory_ flag indicating any cached environment variables will be cleared.
     * - `Nonce` - An optional nonce can be provided which may be required by the terminal in order
     *   to enable some features. This helps ensure no malicious command injection has occurred.
     *
     * WARNING: This sequence is unfinalized, DO NOT use this in your shell integration script.
     */
    VSCodeOscPt["EnvSingleStart"] = "EnvSingleStart";
    /**
     * Sets an entry of single environment variable to transactional pending map of environment variables.
     *
     * Format: `OSC 633 ; EnvSingleEntry ; <EnvironmentKey> ; <EnvironmentValue> [; <Nonce>]`
     *
     * - `Nonce` - An optional nonce can be provided which may be required by the terminal in order
     *   to enable some features. This helps ensure no malicious command injection has occurred.
     *
     * WARNING: This sequence is unfinalized, DO NOT use this in your shell integration script.
     */
    VSCodeOscPt["EnvSingleEntry"] = "EnvSingleEntry";
    /**
     * The end of the collecting user's environment variables individually.
     * Clears any pending environment variables and fires an event that contains user's environment.
     *
     * Format: `OSC 633 ; EnvSingleEnd [; <Nonce>]`
     *
     * - `Nonce` - An optional nonce can be provided which may be required by the terminal in order
     *   to enable some features. This helps ensure no malicious command injection has occurred.
     *
     * WARNING: This sequence is unfinalized, DO NOT use this in your shell integration script.
     */
    VSCodeOscPt["EnvSingleEnd"] = "EnvSingleEnd";
})(VSCodeOscPt || (VSCodeOscPt = {}));
/**
 * ITerm sequences
 */
var ITermOscPt;
(function (ITermOscPt) {
    /**
     * Sets a mark/point-of-interest in the buffer.
     *
     * Format: `OSC 1337 ; SetMark`
     */
    ITermOscPt["SetMark"] = "SetMark";
    /**
     * Reports current working directory (CWD).
     *
     * Format: `OSC 1337 ; CurrentDir=<Cwd> ST`
     */
    ITermOscPt["CurrentDir"] = "CurrentDir";
})(ITermOscPt || (ITermOscPt = {}));
/**
 * The shell integration addon extends xterm by reading shell integration sequences and creating
 * capabilities and passing along relevant sequences to the capabilities. This is meant to
 * encapsulate all handling/parsing of sequences so the capabilities don't need to.
 */
export class ShellIntegrationAddon extends Disposable {
    get seenSequences() { return this._seenSequences; }
    get status() { return this._status; }
    constructor(_nonce, _disableTelemetry, _onDidExecuteText, _telemetryService, _logService) {
        super();
        this._nonce = _nonce;
        this._disableTelemetry = _disableTelemetry;
        this._onDidExecuteText = _onDidExecuteText;
        this._telemetryService = _telemetryService;
        this._logService = _logService;
        this.capabilities = this._register(new TerminalCapabilityStore());
        this._hasUpdatedTelemetry = false;
        this._commonProtocolDisposables = [];
        this._seenSequences = new Set();
        this._status = 0 /* ShellIntegrationStatus.Off */;
        this._onDidChangeStatus = new Emitter();
        this.onDidChangeStatus = this._onDidChangeStatus.event;
        this._onDidChangeSeenSequences = new Emitter();
        this.onDidChangeSeenSequences = this._onDidChangeSeenSequences.event;
        this._register(toDisposable(() => {
            this._clearActivationTimeout();
            this._disposeCommonProtocol();
        }));
    }
    _disposeCommonProtocol() {
        dispose(this._commonProtocolDisposables);
        this._commonProtocolDisposables.length = 0;
    }
    activate(xterm) {
        this._terminal = xterm;
        this.capabilities.add(3 /* TerminalCapability.PartialCommandDetection */, this._register(new PartialCommandDetectionCapability(this._terminal, this._onDidExecuteText)));
        this._register(xterm.parser.registerOscHandler(633 /* ShellIntegrationOscPs.VSCode */, data => this._handleVSCodeSequence(data)));
        this._register(xterm.parser.registerOscHandler(1337 /* ShellIntegrationOscPs.ITerm */, data => this._doHandleITermSequence(data)));
        this._commonProtocolDisposables.push(xterm.parser.registerOscHandler(133 /* ShellIntegrationOscPs.FinalTerm */, data => this._handleFinalTermSequence(data)));
        this._register(xterm.parser.registerOscHandler(7 /* ShellIntegrationOscPs.SetCwd */, data => this._doHandleSetCwd(data)));
        this._register(xterm.parser.registerOscHandler(9 /* ShellIntegrationOscPs.SetWindowsFriendlyCwd */, data => this._doHandleSetWindowsFriendlyCwd(data)));
        this._ensureCapabilitiesOrAddFailureTelemetry();
    }
    getMarkerId(terminal, vscodeMarkerId) {
        this._createOrGetBufferMarkDetection(terminal).getMark(vscodeMarkerId);
    }
    setNextCommandId(command, commandId) {
        if (this._terminal) {
            this._createOrGetCommandDetection(this._terminal).setNextCommandId(command, commandId);
        }
    }
    _markSequenceSeen(sequence) {
        if (!this._seenSequences.has(sequence)) {
            this._seenSequences.add(sequence);
            this._onDidChangeSeenSequences.fire(this._seenSequences);
        }
    }
    _handleFinalTermSequence(data) {
        const didHandle = this._doHandleFinalTermSequence(data);
        if (this._status === 0 /* ShellIntegrationStatus.Off */) {
            this._status = 1 /* ShellIntegrationStatus.FinalTerm */;
            this._onDidChangeStatus.fire(this._status);
        }
        return didHandle;
    }
    _doHandleFinalTermSequence(data) {
        if (!this._terminal) {
            return false;
        }
        // Pass the sequence along to the capability
        // It was considered to disable the common protocol in order to not confuse the VS Code
        // shell integration if both happen for some reason. This doesn't work for powerlevel10k
        // when instant prompt is enabled though. If this does end up being a problem we could pass
        // a type flag through the capability calls
        const [command, ...args] = data.split(';');
        this._markSequenceSeen(command);
        switch (command) {
            case "A" /* FinalTermOscPt.PromptStart */:
                this._createOrGetCommandDetection(this._terminal).handlePromptStart();
                return true;
            case "B" /* FinalTermOscPt.CommandStart */:
                // Ignore the command line for these sequences as it's unreliable for example in powerlevel10k
                this._createOrGetCommandDetection(this._terminal).handleCommandStart({ ignoreCommandLine: true });
                return true;
            case "C" /* FinalTermOscPt.CommandExecuted */:
                this._createOrGetCommandDetection(this._terminal).handleCommandExecuted();
                return true;
            case "D" /* FinalTermOscPt.CommandFinished */: {
                const exitCode = args.length === 1 ? parseInt(args[0]) : undefined;
                this._createOrGetCommandDetection(this._terminal).handleCommandFinished(exitCode);
                return true;
            }
        }
        return false;
    }
    _handleVSCodeSequence(data) {
        const didHandle = this._doHandleVSCodeSequence(data);
        if (!this._hasUpdatedTelemetry && didHandle) {
            this._telemetryService?.publicLog2('terminal/shellIntegrationActivationSucceeded');
            this._hasUpdatedTelemetry = true;
            this._clearActivationTimeout();
        }
        if (this._status !== 2 /* ShellIntegrationStatus.VSCode */) {
            this._status = 2 /* ShellIntegrationStatus.VSCode */;
            this._onDidChangeStatus.fire(this._status);
        }
        return didHandle;
    }
    async _ensureCapabilitiesOrAddFailureTelemetry() {
        if (!this._telemetryService || this._disableTelemetry) {
            return;
        }
        this._activationTimeout = setTimeout(() => {
            if (!this.capabilities.get(2 /* TerminalCapability.CommandDetection */) && !this.capabilities.get(0 /* TerminalCapability.CwdDetection */)) {
                this._telemetryService?.publicLog2('terminal/shellIntegrationActivationTimeout');
                this._logService.warn('Shell integration failed to add capabilities within 10 seconds');
            }
            this._hasUpdatedTelemetry = true;
        }, 10000);
    }
    _clearActivationTimeout() {
        if (this._activationTimeout !== undefined) {
            clearTimeout(this._activationTimeout);
            this._activationTimeout = undefined;
        }
    }
    _doHandleVSCodeSequence(data) {
        if (!this._terminal) {
            return false;
        }
        // Pass the sequence along to the capability
        const argsIndex = data.indexOf(';');
        const command = argsIndex === -1 ? data : data.substring(0, argsIndex);
        this._markSequenceSeen(command);
        // Cast to strict checked index access
        const args = argsIndex === -1 ? [] : data.substring(argsIndex + 1).split(';');
        switch (command) {
            case "A" /* VSCodeOscPt.PromptStart */:
                this._createOrGetCommandDetection(this._terminal).handlePromptStart();
                return true;
            case "B" /* VSCodeOscPt.CommandStart */:
                this._createOrGetCommandDetection(this._terminal).handleCommandStart();
                return true;
            case "C" /* VSCodeOscPt.CommandExecuted */:
                this._createOrGetCommandDetection(this._terminal).handleCommandExecuted();
                return true;
            case "D" /* VSCodeOscPt.CommandFinished */: {
                const arg0 = args[0];
                const exitCode = arg0 !== undefined ? parseInt(arg0) : undefined;
                this._createOrGetCommandDetection(this._terminal).handleCommandFinished(exitCode);
                return true;
            }
            case "E" /* VSCodeOscPt.CommandLine */: {
                const arg0 = args[0];
                const arg1 = args[1];
                let commandLine;
                if (arg0 !== undefined) {
                    commandLine = deserializeVSCodeOscMessage(arg0);
                }
                else {
                    commandLine = '';
                }
                this._createOrGetCommandDetection(this._terminal).setCommandLine(commandLine, arg1 === this._nonce);
                return true;
            }
            case "F" /* VSCodeOscPt.ContinuationStart */: {
                this._createOrGetCommandDetection(this._terminal).handleContinuationStart();
                return true;
            }
            case "G" /* VSCodeOscPt.ContinuationEnd */: {
                this._createOrGetCommandDetection(this._terminal).handleContinuationEnd();
                return true;
            }
            case "EnvJson" /* VSCodeOscPt.EnvJson */: {
                const arg0 = args[0];
                const arg1 = args[1];
                if (arg0 !== undefined) {
                    try {
                        const env = JSON.parse(deserializeVSCodeOscMessage(arg0));
                        this._createOrGetShellEnvDetection().setEnvironment(env, arg1 === this._nonce);
                    }
                    catch (e) {
                        this._logService.warn('Failed to parse environment from shell integration sequence', arg0);
                    }
                }
                return true;
            }
            case "EnvSingleStart" /* VSCodeOscPt.EnvSingleStart */: {
                this._createOrGetShellEnvDetection().startEnvironmentSingleVar(args[0] === '1', args[1] === this._nonce);
                return true;
            }
            case "EnvSingleDelete" /* VSCodeOscPt.EnvSingleDelete */: {
                const arg0 = args[0];
                const arg1 = args[1];
                const arg2 = args[2];
                if (arg0 !== undefined && arg1 !== undefined) {
                    const env = deserializeVSCodeOscMessage(arg1);
                    this._createOrGetShellEnvDetection().deleteEnvironmentSingleVar(arg0, env, arg2 === this._nonce);
                }
                return true;
            }
            case "EnvSingleEntry" /* VSCodeOscPt.EnvSingleEntry */: {
                const arg0 = args[0];
                const arg1 = args[1];
                const arg2 = args[2];
                if (arg0 !== undefined && arg1 !== undefined) {
                    const env = deserializeVSCodeOscMessage(arg1);
                    this._createOrGetShellEnvDetection().setEnvironmentSingleVar(arg0, env, arg2 === this._nonce);
                }
                return true;
            }
            case "EnvSingleEnd" /* VSCodeOscPt.EnvSingleEnd */: {
                this._createOrGetShellEnvDetection().endEnvironmentSingleVar(args[0] === this._nonce);
                return true;
            }
            case "H" /* VSCodeOscPt.RightPromptStart */: {
                this._createOrGetCommandDetection(this._terminal).handleRightPromptStart();
                return true;
            }
            case "I" /* VSCodeOscPt.RightPromptEnd */: {
                this._createOrGetCommandDetection(this._terminal).handleRightPromptEnd();
                return true;
            }
            case "P" /* VSCodeOscPt.Property */: {
                const arg0 = args[0];
                const deserialized = arg0 !== undefined ? deserializeVSCodeOscMessage(arg0) : '';
                const { key, value } = parseKeyValueAssignment(deserialized);
                if (value === undefined) {
                    return true;
                }
                switch (key) {
                    case 'ContinuationPrompt': {
                        this._updateContinuationPrompt(removeAnsiEscapeCodesFromPrompt(value));
                        return true;
                    }
                    case 'Cwd': {
                        this._updateCwd(value);
                        return true;
                    }
                    case 'IsWindows': {
                        this._createOrGetCommandDetection(this._terminal).setIsWindowsPty(value === 'True' ? true : false);
                        return true;
                    }
                    case 'HasRichCommandDetection': {
                        this._createOrGetCommandDetection(this._terminal).setHasRichCommandDetection(value === 'True' ? true : false);
                        return true;
                    }
                    case 'Prompt': {
                        // Remove escape sequences from the user's prompt
                        const sanitizedValue = value.replace(/\x1b\[[0-9;]*m/g, '');
                        this._updatePromptTerminator(sanitizedValue);
                        return true;
                    }
                    case 'PromptType': {
                        this._createOrGetPromptTypeDetection().setPromptType(value);
                        return true;
                    }
                    case 'Task': {
                        this._createOrGetBufferMarkDetection(this._terminal);
                        this.capabilities.get(2 /* TerminalCapability.CommandDetection */)?.setIsCommandStorageDisabled();
                        return true;
                    }
                }
            }
            case "SetMark" /* VSCodeOscPt.SetMark */: {
                this._createOrGetBufferMarkDetection(this._terminal).addMark(parseMarkSequence(args));
                return true;
            }
        }
        // Unrecognized sequence
        return false;
    }
    _updateContinuationPrompt(value) {
        if (!this._terminal) {
            return;
        }
        this._createOrGetCommandDetection(this._terminal).setContinuationPrompt(value);
    }
    _updatePromptTerminator(prompt) {
        if (!this._terminal) {
            return;
        }
        const lastPromptLine = prompt.substring(prompt.lastIndexOf('\n') + 1);
        const lastPromptLineTrimmed = lastPromptLine.trim();
        const promptTerminator = (lastPromptLineTrimmed.length === 1
            // The prompt line contains a single character, treat the full line as the
            // terminator for example "\u2b9e "
            ? lastPromptLine
            : lastPromptLine.substring(lastPromptLine.lastIndexOf(' ')));
        if (promptTerminator) {
            this._createOrGetCommandDetection(this._terminal).setPromptTerminator(promptTerminator, lastPromptLine);
        }
    }
    _updateCwd(value) {
        value = sanitizeCwd(value);
        this._createOrGetCwdDetection().updateCwd(value);
        const commandDetection = this.capabilities.get(2 /* TerminalCapability.CommandDetection */);
        commandDetection?.setCwd(value);
    }
    _doHandleITermSequence(data) {
        if (!this._terminal) {
            return false;
        }
        const [command] = data.split(';');
        this._markSequenceSeen(`${1337 /* ShellIntegrationOscPs.ITerm */};${command}`);
        switch (command) {
            case "SetMark" /* ITermOscPt.SetMark */: {
                this._createOrGetBufferMarkDetection(this._terminal).addMark();
            }
            default: {
                // Checking for known `<key>=<value>` pairs.
                // Note that unlike `VSCodeOscPt.Property`, iTerm2 does not interpret backslash or hex-escape sequences.
                // See: https://github.com/gnachman/iTerm2/blob/bb0882332cec5196e4de4a4225978d746e935279/sources/VT100Terminal.m#L2089-L2105
                const { key, value } = parseKeyValueAssignment(command);
                if (value === undefined) {
                    // No '=' was found, so it's not a property assignment.
                    return true;
                }
                switch (key) {
                    case "CurrentDir" /* ITermOscPt.CurrentDir */:
                        // Encountered: `OSC 1337 ; CurrentDir=<Cwd> ST`
                        this._updateCwd(value);
                        return true;
                }
            }
        }
        // Unrecognized sequence
        return false;
    }
    _doHandleSetWindowsFriendlyCwd(data) {
        if (!this._terminal) {
            return false;
        }
        const [command, ...args] = data.split(';');
        this._markSequenceSeen(`${9 /* ShellIntegrationOscPs.SetWindowsFriendlyCwd */};${command}`);
        switch (command) {
            case '9':
                // Encountered `OSC 9 ; 9 ; <cwd> ST`
                if (args.length) {
                    this._updateCwd(args[0]);
                }
                return true;
        }
        // Unrecognized sequence
        return false;
    }
    /**
     * Handles the sequence: `OSC 7 ; scheme://cwd ST`
     */
    _doHandleSetCwd(data) {
        if (!this._terminal) {
            return false;
        }
        const [command] = data.split(';');
        this._markSequenceSeen(`${7 /* ShellIntegrationOscPs.SetCwd */};${command}`);
        if (command.match(/^file:\/\/.*\//)) {
            const uri = URI.parse(command);
            if (uri.path && uri.path.length > 0) {
                this._updateCwd(uri.path);
                return true;
            }
        }
        // Unrecognized sequence
        return false;
    }
    serialize() {
        if (!this._terminal || !this.capabilities.has(2 /* TerminalCapability.CommandDetection */)) {
            return {
                isWindowsPty: false,
                hasRichCommandDetection: false,
                commands: [],
                promptInputModel: undefined,
            };
        }
        const result = this._createOrGetCommandDetection(this._terminal).serialize();
        return result;
    }
    deserialize(serialized) {
        if (!this._terminal) {
            throw new Error('Cannot restore commands before addon is activated');
        }
        const commandDetection = this._createOrGetCommandDetection(this._terminal);
        commandDetection.deserialize(serialized);
        if (commandDetection.cwd) {
            // Cwd gets set when the command is deserialized, so we need to update it here
            this._updateCwd(commandDetection.cwd);
        }
    }
    _createOrGetCwdDetection() {
        let cwdDetection = this.capabilities.get(0 /* TerminalCapability.CwdDetection */);
        if (!cwdDetection) {
            cwdDetection = this._register(new CwdDetectionCapability());
            this.capabilities.add(0 /* TerminalCapability.CwdDetection */, cwdDetection);
        }
        return cwdDetection;
    }
    _createOrGetCommandDetection(terminal) {
        let commandDetection = this.capabilities.get(2 /* TerminalCapability.CommandDetection */);
        if (!commandDetection) {
            commandDetection = this._register(new CommandDetectionCapability(terminal, this._logService));
            this.capabilities.add(2 /* TerminalCapability.CommandDetection */, commandDetection);
        }
        return commandDetection;
    }
    _createOrGetBufferMarkDetection(terminal) {
        let bufferMarkDetection = this.capabilities.get(4 /* TerminalCapability.BufferMarkDetection */);
        if (!bufferMarkDetection) {
            bufferMarkDetection = this._register(new BufferMarkCapability(terminal));
            this.capabilities.add(4 /* TerminalCapability.BufferMarkDetection */, bufferMarkDetection);
        }
        return bufferMarkDetection;
    }
    _createOrGetShellEnvDetection() {
        let shellEnvDetection = this.capabilities.get(5 /* TerminalCapability.ShellEnvDetection */);
        if (!shellEnvDetection) {
            shellEnvDetection = this._register(new ShellEnvDetectionCapability());
            this.capabilities.add(5 /* TerminalCapability.ShellEnvDetection */, shellEnvDetection);
        }
        return shellEnvDetection;
    }
    _createOrGetPromptTypeDetection() {
        let promptTypeDetection = this.capabilities.get(6 /* TerminalCapability.PromptTypeDetection */);
        if (!promptTypeDetection) {
            promptTypeDetection = this._register(new PromptTypeDetectionCapability());
            this.capabilities.add(6 /* TerminalCapability.PromptTypeDetection */, promptTypeDetection);
        }
        return promptTypeDetection;
    }
}
export function deserializeVSCodeOscMessage(message) {
    return message.replaceAll(
    // Backslash ('\') followed by an escape operator: either another '\', or 'x' and two hex chars.
    /\\(\\|x([0-9a-f]{2}))/gi, 
    // If it's a hex value, parse it to a character.
    // Otherwise the operator is '\', which we return literally, now unescaped.
    (_match, op, hex) => hex ? String.fromCharCode(parseInt(hex, 16)) : op);
}
export function serializeVSCodeOscMessage(message) {
    return message.replace(
    // Match backslash ('\'), semicolon (';'), or characters 0x20 and below
    /[\\;\x00-\x20]/g, (char) => {
        // Escape backslash as '\\'
        if (char === '\\') {
            return '\\\\';
        }
        // Escape other characters as '\xAB' where AB is the hex representation
        const charCode = char.charCodeAt(0);
        return `\\x${charCode.toString(16).padStart(2, '0')}`;
    });
}
export function parseKeyValueAssignment(message) {
    const separatorIndex = message.indexOf('=');
    if (separatorIndex === -1) {
        return { key: message, value: undefined }; // No '=' was found.
    }
    return {
        key: message.substring(0, separatorIndex),
        value: message.substring(1 + separatorIndex)
    };
}
export function parseMarkSequence(sequence) {
    let id = undefined;
    let hidden = false;
    for (const property of sequence) {
        // Sanity check, this shouldn't happen in practice
        if (property === undefined) {
            continue;
        }
        if (property === 'Hidden') {
            hidden = true;
        }
        if (property.startsWith('Id=')) {
            id = property.substring(3);
        }
    }
    return { id, hidden };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hlbGxJbnRlZ3JhdGlvbkFkZG9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi94dGVybS9zaGVsbEludGVncmF0aW9uQWRkb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQWUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdEcsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDckYsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDM0YsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFFbkYsT0FBTyxFQUFFLGlDQUFpQyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFHekcsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRS9FLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDeEQsT0FBTyxFQUFFLCtCQUErQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDckYsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDN0YsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFHakc7Ozs7Ozs7Ozs7OztHQVlHO0FBRUg7O0dBRUc7QUFDSCxNQUFNLENBQU4sSUFBa0IscUJBZ0JqQjtBQWhCRCxXQUFrQixxQkFBcUI7SUFDdEM7O09BRUc7SUFDSCw2RUFBZSxDQUFBO0lBQ2Y7OztPQUdHO0lBQ0gsdUVBQVksQ0FBQTtJQUNaOztP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