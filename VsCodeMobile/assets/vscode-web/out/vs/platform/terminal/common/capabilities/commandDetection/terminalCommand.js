/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { generateUuid } from '../../../../../base/common/uuid.js';
import { isString } from '../../../../../base/common/types.js';
export class TerminalCommand {
    get command() { return this._properties.command; }
    get commandLineConfidence() { return this._properties.commandLineConfidence; }
    get isTrusted() { return this._properties.isTrusted; }
    get timestamp() { return this._properties.timestamp; }
    get duration() { return this._properties.duration; }
    get promptStartMarker() { return this._properties.promptStartMarker; }
    get marker() { return this._properties.marker; }
    get endMarker() { return this._properties.endMarker; }
    set endMarker(value) { this._properties.endMarker = value; }
    get executedMarker() { return this._properties.executedMarker; }
    get aliases() { return this._properties.aliases; }
    get wasReplayed() { return this._properties.wasReplayed; }
    get cwd() { return this._properties.cwd; }
    get exitCode() { return this._properties.exitCode; }
    get commandStartLineContent() { return this._properties.commandStartLineContent; }
    get markProperties() { return this._properties.markProperties; }
    get executedX() { return this._properties.executedX; }
    get startX() { return this._properties.startX; }
    get id() { return this._properties.id; }
    constructor(_xterm, _properties) {
        this._xterm = _xterm;
        this._properties = _properties;
    }
    static deserialize(xterm, serialized, isCommandStorageDisabled) {
        const buffer = xterm.buffer.normal;
        const marker = serialized.startLine !== undefined ? xterm.registerMarker(serialized.startLine - (buffer.baseY + buffer.cursorY)) : undefined;
        // Check for invalid command
        if (!marker) {
            return undefined;
        }
        const promptStartMarker = serialized.promptStartLine !== undefined ? xterm.registerMarker(serialized.promptStartLine - (buffer.baseY + buffer.cursorY)) : undefined;
        // Valid full command
        const endMarker = serialized.endLine !== undefined ? xterm.registerMarker(serialized.endLine - (buffer.baseY + buffer.cursorY)) : undefined;
        const executedMarker = serialized.executedLine !== undefined ? xterm.registerMarker(serialized.executedLine - (buffer.baseY + buffer.cursorY)) : undefined;
        const newCommand = new TerminalCommand(xterm, {
            command: isCommandStorageDisabled ? '' : serialized.command,
            commandLineConfidence: serialized.commandLineConfidence ?? 'low',
            isTrusted: serialized.isTrusted,
            id: serialized.id,
            promptStartMarker,
            marker,
            startX: serialized.startX,
            endMarker,
            executedMarker,
            executedX: serialized.executedX,
            timestamp: serialized.timestamp,
            duration: serialized.duration,
            cwd: serialized.cwd,
            commandStartLineContent: serialized.commandStartLineContent,
            exitCode: serialized.exitCode,
            markProperties: serialized.markProperties,
            aliases: undefined,
            wasReplayed: true
        });
        return newCommand;
    }
    serialize(isCommandStorageDisabled) {
        return {
            promptStartLine: this.promptStartMarker?.line,
            startLine: this.marker?.line,
            startX: undefined,
            endLine: this.endMarker?.line,
            executedLine: this.executedMarker?.line,
            executedX: this.executedX,
            command: isCommandStorageDisabled ? '' : this.command,
            commandLineConfidence: isCommandStorageDisabled ? 'low' : this.commandLineConfidence,
            isTrusted: this.isTrusted,
            cwd: this.cwd,
            exitCode: this.exitCode,
            commandStartLineContent: this.commandStartLineContent,
            timestamp: this.timestamp,
            duration: this.duration,
            markProperties: this.markProperties,
            id: this.id,
        };
    }
    extractCommandLine() {
        return extractCommandLine(this._xterm.buffer.active, this._xterm.cols, this.marker, this.startX, this.executedMarker, this.executedX);
    }
    getOutput() {
        if (!this.executedMarker || !this.endMarker) {
            return undefined;
        }
        const startLine = this.executedMarker.line;
        const endLine = this.endMarker.line;
        if (startLine === endLine) {
            return undefined;
        }
        let output = '';
        let line;
        for (let i = startLine; i < endLine; i++) {
            line = this._xterm.buffer.active.getLine(i);
            if (!line) {
                continue;
            }
            output += line.translateToString(!line.isWrapped) + (line.isWrapped ? '' : '\n');
        }
        return output === '' ? undefined : output;
    }
    getOutputMatch(outputMatcher) {
        // TODO: Add back this check? this._ptyHeuristics.value instanceof WindowsPtyHeuristics && (executedMarker?.line === endMarker?.line) ? this._currentCommand.commandStartMarker : executedMarker
        if (!this.executedMarker || !this.endMarker) {
            return undefined;
        }
        const endLine = this.endMarker.line;
        if (endLine === -1) {
            return undefined;
        }
        const buffer = this._xterm.buffer.active;
        const startLine = Math.max(this.executedMarker.line, 0);
        const matcher = outputMatcher.lineMatcher;
        const linesToCheck = isString(matcher) ? 1 : outputMatcher.length || countNewLines(matcher);
        const lines = [];
        let match;
        if (outputMatcher.anchor === 'bottom') {
            for (let i = endLine - (outputMatcher.offset || 0); i >= startLine; i--) {
                let wrappedLineStart = i;
                const wrappedLineEnd = i;
                while (wrappedLineStart >= startLine && buffer.getLine(wrappedLineStart)?.isWrapped) {
                    wrappedLineStart--;
                }
                i = wrappedLineStart;
                lines.unshift(getXtermLineContent(buffer, wrappedLineStart, wrappedLineEnd, this._xterm.cols));
                if (!match) {
                    match = lines[0].match(matcher);
                }
                if (lines.length >= linesToCheck) {
                    break;
                }
            }
        }
        else {
            for (let i = startLine + (outputMatcher.offset || 0); i < endLine; i++) {
                const wrappedLineStart = i;
                let wrappedLineEnd = i;
                while (wrappedLineEnd + 1 < endLine && buffer.getLine(wrappedLineEnd + 1)?.isWrapped) {
                    wrappedLineEnd++;
                }
                i = wrappedLineEnd;
                lines.push(getXtermLineContent(buffer, wrappedLineStart, wrappedLineEnd, this._xterm.cols));
                if (!match) {
                    match = lines[lines.length - 1].match(matcher);
                }
                if (lines.length >= linesToCheck) {
                    break;
                }
            }
        }
        return match ? { regexMatch: match, outputLines: lines } : undefined;
    }
    hasOutput() {
        return (!this.executedMarker?.isDisposed &&
            !this.endMarker?.isDisposed &&
            !!(this.executedMarker &&
                this.endMarker &&
                this.executedMarker.line < this.endMarker.line));
    }
    getPromptRowCount() {
        return getPromptRowCount(this, this._xterm.buffer.active);
    }
    getCommandRowCount() {
        return getCommandRowCount(this);
    }
}
export class PartialTerminalCommand {
    constructor(_xterm, id) {
        this._xterm = _xterm;
        this.id = id ?? generateUuid();
    }
    serialize(cwd) {
        if (!this.commandStartMarker) {
            return undefined;
        }
        return {
            promptStartLine: this.promptStartMarker?.line,
            startLine: this.commandStartMarker.line,
            startX: this.commandStartX,
            endLine: undefined,
            executedLine: undefined,
            executedX: undefined,
            command: '',
            commandLineConfidence: 'low',
            isTrusted: true,
            cwd,
            exitCode: undefined,
            commandStartLineContent: undefined,
            timestamp: 0,
            duration: 0,
            markProperties: undefined,
            id: this.id
        };
    }
    promoteToFullCommand(cwd, exitCode, ignoreCommandLine, markProperties) {
        // When the command finishes and executed never fires the placeholder selector should be used.
        if (exitCode === undefined && this.command === undefined) {
            this.command = '';
        }
        if ((this.command !== undefined && !this.command.startsWith('\\')) || ignoreCommandLine) {
            return new TerminalCommand(this._xterm, {
                command: ignoreCommandLine ? '' : (this.command || ''),
                commandLineConfidence: ignoreCommandLine ? 'low' : (this.commandLineConfidence || 'low'),
                isTrusted: !!this.isTrusted,
                id: this.id,
                promptStartMarker: this.promptStartMarker,
                marker: this.commandStartMarker,
                startX: this.commandStartX,
                endMarker: this.commandFinishedMarker,
                executedMarker: this.commandExecutedMarker,
                executedX: this.commandExecutedX,
                timestamp: Date.now(),
                duration: this.commandDuration || 0,
                cwd,
                exitCode,
                commandStartLineContent: this.commandStartLineContent,
                markProperties
            });
        }
        return undefined;
    }
    markExecutedTime() {
        if (this.commandExecutedTimestamp === undefined) {
            this.commandExecutedTimestamp = Date.now();
        }
    }
    markFinishedTime() {
        if (this.commandDuration === undefined && this.commandExecutedTimestamp !== undefined) {
            this.commandDuration = Date.now() - this.commandExecutedTimestamp;
        }
    }
    extractCommandLine() {
        return extractCommandLine(this._xterm.buffer.active, this._xterm.cols, this.commandStartMarker, this.commandStartX, this.commandExecutedMarker, this.commandExecutedX);
    }
    getPromptRowCount() {
        return getPromptRowCount(this, this._xterm.buffer.active);
    }
    getCommandRowCount() {
        return getCommandRowCount(this);
    }
}
function extractCommandLine(buffer, cols, commandStartMarker, commandStartX, commandExecutedMarker, commandExecutedX) {
    if (!commandStartMarker || !commandExecutedMarker || commandStartX === undefined || commandExecutedX === undefined) {
        return '';
    }
    let content = '';
    for (let i = commandStartMarker.line; i <= commandExecutedMarker.line; i++) {
        const line = buffer.getLine(i);
        if (line) {
            content += line.translateToString(true, i === commandStartMarker.line ? commandStartX : 0, i === commandExecutedMarker.line ? commandExecutedX : cols);
        }
    }
    return content;
}
function getXtermLineContent(buffer, lineStart, lineEnd, cols) {
    // Cap the maximum number of lines generated to prevent potential performance problems. This is
    // more of a sanity check as the wrapped line should already be trimmed down at this point.
    const maxLineLength = Math.max(2048 / cols * 2);
    lineEnd = Math.min(lineEnd, lineStart + maxLineLength);
    let content = '';
    for (let i = lineStart; i <= lineEnd; i++) {
        // Make sure only 0 to cols are considered as resizing when windows mode is enabled will
        // retain buffer data outside of the terminal width as reflow is disabled.
        const line = buffer.getLine(i);
        if (line) {
            content += line.translateToString(true, 0, cols);
        }
    }
    return content;
}
function countNewLines(regex) {
    if (!regex.multiline) {
        return 1;
    }
    const source = regex.source;
    let count = 1;
    let i = source.indexOf('\\n');
    while (i !== -1) {
        count++;
        i = source.indexOf('\\n', i + 1);
    }
    return count;
}
function getPromptRowCount(command, buffer) {
    const marker = isFullTerminalCommand(command) ? command.marker : command.commandStartMarker;
    if (!marker || !command.promptStartMarker) {
        return 1;
    }
    let promptRowCount = 1;
    let promptStartLine = command.promptStartMarker.line;
    // Trim any leading whitespace-only lines to retain vertical space
    while (promptStartLine < marker.line && (buffer.getLine(promptStartLine)?.translateToString(true) ?? '').length === 0) {
        promptStartLine++;
    }
    promptRowCount = marker.line - promptStartLine + 1;
    return promptRowCount;
}
function getCommandRowCount(command) {
    const marker = isFullTerminalCommand(command) ? command.marker : command.commandStartMarker;
    const executedMarker = isFullTerminalCommand(command) ? command.executedMarker : command.commandExecutedMarker;
    if (!marker || !executedMarker) {
        return 1;
    }
    const commandExecutedLine = Math.max(executedMarker.line, marker.line);
    let commandRowCount = commandExecutedLine - marker.line + 1;
    // Trim the last line if the cursor X is in the left-most cell
    const executedX = isFullTerminalCommand(command) ? command.executedX : command.commandExecutedX;
    if (executedX === 0) {
        commandRowCount--;
    }
    return commandRowCount;
}
export function isFullTerminalCommand(command) {
    return !!command.hasOutput;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDb21tYW5kLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9jYXBhYmlsaXRpZXMvY29tbWFuZERldGVjdGlvbi90ZXJtaW5hbENvbW1hbmQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFLaEcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQXdCL0QsTUFBTSxPQUFPLGVBQWU7SUFFM0IsSUFBSSxPQUFPLEtBQUssT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDbEQsSUFBSSxxQkFBcUIsS0FBSyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDO0lBQzlFLElBQUksU0FBUyxLQUFLLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQ3RELElBQUksU0FBUyxLQUFLLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQ3RELElBQUksUUFBUSxLQUFLLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQ3BELElBQUksaUJBQWlCLEtBQUssT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQztJQUN0RSxJQUFJLE1BQU0sS0FBSyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUNoRCxJQUFJLFNBQVMsS0FBSyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztJQUN0RCxJQUFJLFNBQVMsQ0FBQyxLQUEwQixJQUFJLElBQUksQ0FB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