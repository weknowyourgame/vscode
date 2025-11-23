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
import { disposableTimeout } from '../../../../../base/common/async.js';
import { Color, RGBA } from '../../../../../base/common/color.js';
import { debounce } from '../../../../../base/common/decorators.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { escapeRegExpCharacters } from '../../../../../base/common/strings.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { TERMINAL_CONFIG_SECTION } from '../../../terminal/common/terminal.js';
import { DEFAULT_LOCAL_ECHO_EXCLUDE } from '../common/terminalTypeAheadConfiguration.js';
import { isNumber } from '../../../../../base/common/types.js';
var VT;
(function (VT) {
    VT["Esc"] = "\u001B";
    VT["Csi"] = "\u001B[";
    VT["ShowCursor"] = "\u001B[?25h";
    VT["HideCursor"] = "\u001B[?25l";
    VT["DeleteChar"] = "\u001B[X";
    VT["DeleteRestOfLine"] = "\u001B[K";
})(VT || (VT = {}));
const CSI_STYLE_RE = /^\x1b\[[0-9;]*m/;
const CSI_MOVE_RE = /^\x1b\[?([0-9]*)(;[35])?O?([DC])/;
const NOT_WORD_RE = /[^a-z0-9]/i;
var StatsConstants;
(function (StatsConstants) {
    StatsConstants[StatsConstants["StatsBufferSize"] = 24] = "StatsBufferSize";
    StatsConstants[StatsConstants["StatsSendTelemetryEvery"] = 300000] = "StatsSendTelemetryEvery";
    StatsConstants[StatsConstants["StatsMinSamplesToTurnOn"] = 5] = "StatsMinSamplesToTurnOn";
    StatsConstants[StatsConstants["StatsMinAccuracyToTurnOn"] = 0.3] = "StatsMinAccuracyToTurnOn";
    StatsConstants[StatsConstants["StatsToggleOffThreshold"] = 0.5] = "StatsToggleOffThreshold";
})(StatsConstants || (StatsConstants = {}));
/**
 * Codes that should be omitted from sending to the prediction engine and instead omitted directly:
 * - Hide cursor (DECTCEM): We wrap the local echo sequence in hide and show
 *   CSI ? 2 5 l
 * - Show cursor (DECTCEM): We wrap the local echo sequence in hide and show
 *   CSI ? 2 5 h
 * - Device Status Report (DSR): These sequence fire report events from xterm which could cause
 *   double reporting and potentially a stack overflow (#119472)
 *   CSI Ps n
 *   CSI ? Ps n
 */
const PREDICTION_OMIT_RE = /^(\x1b\[(\??25[hl]|\??[0-9;]+n))+/;
const core = (terminal) => {
    return terminal._core;
};
const flushOutput = (terminal) => {
    // TODO: Flushing output is not possible anymore without async
};
var CursorMoveDirection;
(function (CursorMoveDirection) {
    CursorMoveDirection["Back"] = "D";
    CursorMoveDirection["Forwards"] = "C";
})(CursorMoveDirection || (CursorMoveDirection = {}));
class Cursor {
    get x() {
        return this._x;
    }
    get y() {
        return this._y;
    }
    get baseY() {
        return this._baseY;
    }
    get coordinate() {
        return { x: this._x, y: this._y, baseY: this._baseY };
    }
    constructor(rows, cols, _buffer) {
        this.rows = rows;
        this.cols = cols;
        this._buffer = _buffer;
        this._x = 0;
        this._y = 1;
        this._baseY = 1;
        this._x = _buffer.cursorX;
        this._y = _buffer.cursorY;
        this._baseY = _buffer.baseY;
    }
    getLine() {
        return this._buffer.getLine(this._y + this._baseY);
    }
    getCell(loadInto) {
        return this.getLine()?.getCell(this._x, loadInto);
    }
    moveTo(coordinate) {
        this._x = coordinate.x;
        this._y = (coordinate.y + coordinate.baseY) - this._baseY;
        return this.moveInstruction();
    }
    clone() {
        const c = new Cursor(this.rows, this.cols, this._buffer);
        c.moveTo(this);
        return c;
    }
    move(x, y) {
        this._x = x;
        this._y = y;
        return this.moveInstruction();
    }
    shift(x = 0, y = 0) {
        this._x += x;
        this._y += y;
        return this.moveInstruction();
    }
    moveInstruction() {
        if (this._y >= this.rows) {
            this._baseY += this._y - (this.rows - 1);
            this._y = this.rows - 1;
        }
        else if (this._y < 0) {
            this._baseY -= this._y;
            this._y = 0;
        }
        return `${"\u001B[" /* VT.Csi */}${this._y + 1};${this._x + 1}H`;
    }
}
const moveToWordBoundary = (b, cursor, direction) => {
    let ateLeadingWhitespace = false;
    if (direction < 0) {
        cursor.shift(-1);
    }
    let cell;
    while (cursor.x >= 0) {
        cell = cursor.getCell(cell);
        if (!cell?.getCode()) {
            return;
        }
        const chars = cell.getChars();
        if (NOT_WORD_RE.test(chars)) {
            if (ateLeadingWhitespace) {
                break;
            }
        }
        else {
            ateLeadingWhitespace = true;
        }
        cursor.shift(direction);
    }
    if (direction < 0) {
        cursor.shift(1); // we want to place the cursor after the whitespace starting the word
    }
};
var MatchResult;
(function (MatchResult) {
    /** matched successfully */
    MatchResult[MatchResult["Success"] = 0] = "Success";
    /** failed to match */
    MatchResult[MatchResult["Failure"] = 1] = "Failure";
    /** buffer data, it might match in the future one more data comes in */
    MatchResult[MatchResult["Buffer"] = 2] = "Buffer";
})(MatchResult || (MatchResult = {}));
class StringReader {
    get remaining() {
        return this._input.length - this.index;
    }
    get eof() {
        return this.index === this._input.length;
    }
    get rest() {
        return this._input.slice(this.index);
    }
    constructor(_input) {
        this._input = _input;
        this.index = 0;
    }
    /**
     * Advances the reader and returns the character if it matches.
     */
    eatChar(char) {
        if (this._input[this.index] !== char) {
            return;
        }
        this.index++;
        return char;
    }
    /**
     * Advances the reader and returns the string if it matches.
     */
    eatStr(substr) {
        if (this._input.slice(this.index, substr.length) !== substr) {
            return;
        }
        this.index += substr.length;
        return substr;
    }
    /**
     * Matches and eats the substring character-by-character. If EOF is reached
     * before the substring is consumed, it will buffer. Index is not moved
     * if it's not a match.
     */
    eatGradually(substr) {
        const prevIndex = this.index;
        for (let i = 0; i < substr.length; i++) {
            if (i > 0 && this.eof) {
                return 2 /* MatchResult.Buffer */;
            }
            if (!this.eatChar(substr[i])) {
                this.index = prevIndex;
                return 1 /* MatchResult.Failure */;
            }
        }
        return 0 /* MatchResult.Success */;
    }
    /**
     * Advances the reader and returns the regex if it matches.
     */
    eatRe(re) {
        const match = re.exec(this._input.slice(this.index));
        if (!match) {
            return;
        }
        this.index += match[0].length;
        return match;
    }
    /**
     * Advances the reader and returns the character if the code matches.
     */
    eatCharCode(min = 0, max = min + 1) {
        const code = this._input.charCodeAt(this.index);
        if (code < min || code >= max) {
            return undefined;
        }
        this.index++;
        return code;
    }
}
/**
 * Preidction which never tests true. Will always discard predictions made
 * after it.
 */
class HardBoundary {
    constructor() {
        this.clearAfterTimeout = false;
    }
    apply() {
        return '';
    }
    rollback() {
        return '';
    }
    rollForwards() {
        return '';
    }
    matches() {
        return 1 /* MatchResult.Failure */;
    }
}
/**
 * Wraps another prediction. Does not apply the prediction, but will pass
 * through its `matches` request.
 */
class TentativeBoundary {
    constructor(inner) {
        this.inner = inner;
    }
    apply(buffer, cursor) {
        this._appliedCursor = cursor.clone();
        this.inner.apply(buffer, this._appliedCursor);
        return '';
    }
    rollback(cursor) {
        this.inner.rollback(cursor.clone());
        return '';
    }
    rollForwards(cursor, withInput) {
        if (this._appliedCursor) {
            cursor.moveTo(this._appliedCursor);
        }
        return withInput;
    }
    matches(input) {
        return this.inner.matches(input);
    }
}
const isTenativeCharacterPrediction = (p) => p instanceof TentativeBoundary && p.inner instanceof CharacterPrediction;
/**
 * Prediction for a single alphanumeric character.
 */
class CharacterPrediction {
    constructor(_style, _char) {
        this._style = _style;
        this._char = _char;
        this.affectsStyle = true;
    }
    apply(_, cursor) {
        const cell = cursor.getCell();
        this.appliedAt = cell
            ? { pos: cursor.coordinate, oldAttributes: attributesToSeq(cell), oldChar: cell.getChars() }
            : { pos: cursor.coordinate, oldAttributes: '', oldChar: '' };
        cursor.shift(1);
        return this._style.apply + this._char + this._style.undo;
    }
    rollback(cursor) {
        if (!this.appliedAt) {
            return ''; // not applied
        }
        const { oldAttributes, oldChar, pos } = this.appliedAt;
        const r = cursor.moveTo(pos) + (oldChar ? `${oldAttributes}${oldChar}${cursor.moveTo(pos)}` : "\u001B[X" /* VT.DeleteChar */);
        return r;
    }
    rollForwards(cursor, input) {
        if (!this.appliedAt) {
            return ''; // not applied
        }
        return cursor.clone().moveTo(this.appliedAt.pos) + input;
    }
    matches(input, lookBehind) {
        const startIndex = input.index;
        // remove any styling CSI before checking the char
        while (input.eatRe(CSI_STYLE_RE)) { }
        if (input.eof) {
            return 2 /* MatchResult.Buffer */;
        }
        if (input.eatChar(this._char)) {
            return 0 /* MatchResult.Success */;
        }
        if (lookBehind instanceof CharacterPrediction) {
            // see #112842
            const sillyZshOutcome = input.eatGradually(`\b${lookBehind._char}${this._char}`);
            if (sillyZshOutcome !== 1 /* MatchResult.Failure */) {
                return sillyZshOutcome;
            }
        }
        input.index = startIndex;
        return 1 /* MatchResult.Failure */;
    }
}
class BackspacePrediction {
    constructor(_terminal) {
        this._terminal = _terminal;
    }
    apply(_, cursor) {
        // at eol if everything to the right is whitespace (zsh will emit a "clear line" code in this case)
        // todo: can be optimized if `getTrimmedLength` is exposed from xterm
        const isLastChar = !cursor.getLine()?.translateToString(undefined, cursor.x).trim();
        const pos = cursor.coordinate;
        const move = cursor.shift(-1);
        const cell = cursor.getCell();
        this._appliedAt = cell
            ? { isLastChar, pos, oldAttributes: attributesToSeq(cell), oldChar: cell.getChars() }
            : { isLastChar, pos, oldAttributes: '', oldChar: '' };
        return move + "\u001B[X" /* VT.DeleteChar */;
    }
    rollback(cursor) {
        if (!this._appliedAt) {
            return ''; // not applied
        }
        const { oldAttributes, oldChar, pos } = this._appliedAt;
        if (!oldChar) {
            return cursor.moveTo(pos) + "\u001B[X" /* VT.DeleteChar */;
        }
        return oldAttributes + oldChar + cursor.moveTo(pos) + attributesToSeq(core(this._terminal)._inputHandler._curAttrData);
    }
    rollForwards() {
        return '';
    }
    matches(input) {
        if (this._appliedAt?.isLastChar) {
            const r1 = input.eatGradually(`\b${"\u001B[" /* VT.Csi */}K`);
            if (r1 !== 1 /* MatchResult.Failure */) {
                return r1;
            }
            const r2 = input.eatGradually(`\b \b`);
            if (r2 !== 1 /* MatchResult.Failure */) {
                return r2;
            }
        }
        return 1 /* MatchResult.Failure */;
    }
}
class NewlinePrediction {
    apply(_, cursor) {
        this._prevPosition = cursor.coordinate;
        cursor.move(0, cursor.y + 1);
        return '\r\n';
    }
    rollback(cursor) {
        return this._prevPosition ? cursor.moveTo(this._prevPosition) : '';
    }
    rollForwards() {
        return ''; // does not need to rewrite
    }
    matches(input) {
        return input.eatGradually('\r\n');
    }
}
/**
 * Prediction when the cursor reaches the end of the line. Similar to newline
 * prediction, but shells handle it slightly differently.
 */
class LinewrapPrediction extends NewlinePrediction {
    apply(_, cursor) {
        this._prevPosition = cursor.coordinate;
        cursor.move(0, cursor.y + 1);
        return ' \r';
    }
    matches(input) {
        // bash and zshell add a space which wraps in the terminal, then a CR
        const r = input.eatGradually(' \r');
        if (r !== 1 /* MatchResult.Failure */) {
            // zshell additionally adds a clear line after wrapping to be safe -- eat it
            const r2 = input.eatGradually("\u001B[K" /* VT.DeleteRestOfLine */);
            return r2 === 2 /* MatchResult.Buffer */ ? 2 /* MatchResult.Buffer */ : r;
        }
        return input.eatGradually('\r\n');
    }
}
class CursorMovePrediction {
    constructor(_direction, _moveByWords, _amount) {
        this._direction = _direction;
        this._moveByWords = _moveByWords;
        this._amount = _amount;
    }
    apply(buffer, cursor) {
        const prevPosition = cursor.x;
        const currentCell = cursor.getCell();
        const prevAttrs = currentCell ? attributesToSeq(currentCell) : '';
        const { _amount: amount, _direction: direction, _moveByWords: moveByWords } = this;
        const delta = direction === "D" /* CursorMoveDirection.Back */ ? -1 : 1;
        const target = cursor.clone();
        if (moveByWords) {
            for (let i = 0; i < amount; i++) {
                moveToWordBoundary(buffer, target, delta);
            }
        }
        else {
            target.shift(delta * amount);
        }
        this._applied = {
            amount: Math.abs(cursor.x - target.x),
            prevPosition,
            prevAttrs,
            rollForward: cursor.moveTo(target),
        };
        return this._applied.rollForward;
    }
    rollback(cursor) {
        if (!this._applied) {
            return '';
        }
        return cursor.move(this._applied.prevPosition, cursor.y) + this._applied.prevAttrs;
    }
    rollForwards() {
        return ''; // does not need to rewrite
    }
    matches(input) {
        if (!this._applied) {
            return 1 /* MatchResult.Failure */;
        }
        const direction = this._direction;
        const { amount, rollForward } = this._applied;
        // arg can be omitted to move one character. We don't eatGradually() here
        // or below moves that don't go as far as the cursor would be buffered
        // indefinitely
        if (input.eatStr(`${"\u001B[" /* VT.Csi */}${direction}`.repeat(amount))) {
            return 0 /* MatchResult.Success */;
        }
        // \b is the equivalent to moving one character back
        if (direction === "D" /* CursorMoveDirection.Back */) {
            if (input.eatStr(`\b`.repeat(amount))) {
                return 0 /* MatchResult.Success */;
            }
        }
        // check if the cursor position is set absolutely
        if (rollForward) {
            const r = input.eatGradually(rollForward);
            if (r !== 1 /* MatchResult.Failure */) {
                return r;
            }
        }
        // check for a relative move in the direction
        return input.eatGradually(`${"\u001B[" /* VT.Csi */}${amount}${direction}`);
    }
}
export class PredictionStats extends Disposable {
    /**
     * Gets the percent (0-1) of predictions that were accurate.
     */
    get accuracy() {
        let correctCount = 0;
        for (const [, correct] of this._stats) {
            if (correct) {
                correctCount++;
            }
        }
        return correctCount / (this._stats.length || 1);
    }
    /**
     * Gets the number of recorded stats.
     */
    get sampleSize() {
        return this._stats.length;
    }
    /**
     * Gets latency stats of successful predictions.
     */
    get latency() {
        const latencies = this._stats.filter(([, correct]) => correct).map(([s]) => s).sort();
        return {
            count: latencies.length,
            min: latencies[0],
            median: latencies[Math.floor(latencies.length / 2)],
            max: latencies[latencies.length - 1],
        };
    }
    /**
     * Gets the maximum observed latency.
     */
    get maxLatency() {
        let max = -Infinity;
        for (const [latency, correct] of this._stats) {
            if (correct) {
                max = Math.max(latency, max);
            }
        }
        return max;
    }
    constructor(timeline) {
        super();
        this._stats = [];
        this._index = 0;
        this._addedAtTime = new WeakMap();
        this._changeEmitter = new Emitter();
        this.onChange = this._changeEmitter.event;
        this._register(timeline.onPredictionAdded(p => this._addedAtTime.set(p, Date.now())));
        this._register(timeline.onPredictionSucceeded(this._pushStat.bind(this, true)));
        this._register(timeline.onPredictionFailed(this._pushStat.bind(this, false)));
    }
    _pushStat(correct, prediction) {
        const started = this._addedAtTime.get(prediction);
        this._stats[this._index] = [Date.now() - started, correct];
        this._index = (this._index + 1) % 24 /* StatsConstants.StatsBufferSize */;
        this._changeEmitter.fire();
    }
}
export class PredictionTimeline {
    get _currentGenerationPredictions() {
        return this._expected.filter(({ gen }) => gen === this._expected[0].gen).map(({ p }) => p);
    }
    get isShowingPredictions() {
        return this._showPredictions;
    }
    get length() {
        return this._expected.length;
    }
    constructor(terminal, _style) {
        this.terminal = terminal;
        this._style = _style;
        /**
         * Expected queue of events. Only predictions for the lowest are
         * written into the terminal.
         */
        this._expected = [];
        /**
         * Current prediction generation.
         */
        this._currentGen = 0;
        /**
         * Whether predictions are echoed to the terminal. If false, predictions
         * will still be computed internally for latency metrics, but input will
         * never be adjusted.
         */
        this._showPredictions = false;
        this._addedEmitter = new Emitter();
        this.onPredictionAdded = this._addedEmitter.event;
        this._failedEmitter = new Emitter();
        this.onPredictionFailed = this._failedEmitter.event;
        this._succeededEmitter = new Emitter();
        this.onPredictionSucceeded = this._succeededEmitter.event;
    }
    setShowPredictions(show) {
        if (show === this._showPredictions) {
            return;
        }
        // console.log('set predictions:', show);
        this._showPredictions = show;
        const buffer = this._getActiveBuffer();
        if (!buffer) {
            return;
        }
        const toApply = this._currentGenerationPredictions;
        if (show) {
            this.clearCursor();
            this._style.expectIncomingStyle(toApply.reduce((count, p) => p.affectsStyle ? count + 1 : count, 0));
            this.terminal.write(toApply.map(p => p.apply(buffer, this.physicalCursor(buffer))).join(''));
        }
        else {
            this.terminal.write(toApply.reverse().map(p => p.rollback(this.physicalCursor(buffer))).join(''));
        }
    }
    /**
     * Undoes any predictions written and resets expectations.
     */
    undoAllPredictions() {
        const buffer = this._getActiveBuffer();
        if (this._showPredictions && buffer) {
            this.terminal.write(this._currentGenerationPredictions.reverse()
                .map(p => p.rollback(this.physicalCursor(buffer))).join(''));
        }
        this._expected = [];
    }
    /**
     * Should be called when input is incoming to the temrinal.
     */
    beforeServerInput(input) {
        const originalInput = input;
        if (this._inputBuffer) {
            input = this._inputBuffer + input;
            this._inputBuffer = undefined;
        }
        if (!this._expected.length) {
            this._clearPredictionState();
            return input;
        }
        const buffer = this._getActiveBuffer();
        if (!buffer) {
            this._clearPredictionState();
            return input;
        }
        let output = '';
        const reader = new StringReader(input);
        const startingGen = this._expected[0].gen;
        const emitPredictionOmitted = () => {
            const omit = reader.eatRe(PREDICTION_OMIT_RE);
            if (omit) {
                output += omit[0];
            }
        };
        ReadLoop: while (this._expected.length && reader.remaining > 0) {
            emitPredictionOmitted();
            const { p: prediction, gen } = this._expected[0];
            const cursor = this.physicalCursor(buffer);
            const beforeTestReaderIndex = reader.index;
            switch (prediction.matches(reader, this._lookBehind)) {
                case 0 /* MatchResult.Success */: {
                    // if the input character matches what the next prediction expected, undo
                    // the prediction and write the real character out.
                    const eaten = input.slice(beforeTestReaderIndex, reader.index);
                    if (gen === startingGen) {
                        output += prediction.rollForwards?.(cursor, eaten);
                    }
                    else {
                        prediction.apply(buffer, this.physicalCursor(buffer)); // move cursor for additional apply
                        output += eaten;
                    }
                    this._succeededEmitter.fire(prediction);
                    this._lookBehind = prediction;
                    this._expected.shift();
                    break;
                }
                case 2 /* MatchResult.Buffer */:
                    // on a buffer, store the remaining data and completely read data
                    // to be output as normal.
                    this._inputBuffer = input.slice(beforeTestReaderIndex);
                    reader.index = input.length;
                    break ReadLoop;
                case 1 /* MatchResult.Failure */: {
                    // on a failure, roll back all remaining items in this generation
                    // and clear predictions, since they are no longer valid
                    const rollback = this._expected.filter(p => p.gen === startingGen).reverse();
                    output += rollback.map(({ p }) => p.rollback(this.physicalCursor(buffer))).join('');
                    if (rollback.some(r => r.p.affectsStyle)) {
                        // reading the current style should generally be safe, since predictions
                        // always restore the style if they modify it.
                        output += attributesToSeq(core(this.terminal)._inputHandler._curAttrData);
                    }
                    this._clearPredictionState();
                    this._failedEmitter.fire(prediction);
                    break ReadLoop;
                }
            }
        }
        emitPredictionOmitted();
        // Extra data (like the result of running a command) should cause us to
        // reset the cursor
        if (!reader.eof) {
            output += reader.rest;
            this._clearPredictionState();
        }
        // If we passed a generation boundary, apply the current generation's predictions
        if (this._expected.length && startingGen !== this._expected[0].gen) {
            for (const { p, gen } of this._expected) {
                if (gen !== this._expected[0].gen) {
                    break;
                }
                if (p.affectsStyle) {
                    this._style.expectIncomingStyle();
                }
                output += p.apply(buffer, this.physicalCursor(buffer));
            }
        }
        if (!this._showPredictions) {
            return originalInput;
        }
        if (output.length === 0 || output === input) {
            return output;
        }
        if (this._physicalCursor) {
            output += this._physicalCursor.moveInstruction();
        }
        // prevent cursor flickering while typing
        output = "\u001B[?25l" /* VT.HideCursor */ + output + "\u001B[?25h" /* VT.ShowCursor */;
        return output;
    }
    /**
     * Clears any expected predictions and stored state. Should be called when
     * the pty gives us something we don't recognize.
     */
    _clearPredictionState() {
        this._expected = [];
        this.clearCursor();
        this._lookBehind = undefined;
    }
    /**
     * Appends a typeahead prediction.
     */
    addPrediction(buffer, prediction) {
        this._expected.push({ gen: this._currentGen, p: prediction });
        this._addedEmitter.fire(prediction);
        if (this._currentGen !== this._expected[0].gen) {
            prediction.apply(buffer, this.tentativeCursor(buffer));
            return false;
        }
        const text = prediction.apply(buffer, this.physicalCursor(buffer));
        this._tenativeCursor = undefined; // next read will get or clone the physical cursor
        if (this._showPredictions && text) {
            if (prediction.affectsStyle) {
                this._style.expectIncomingStyle();
            }
            // console.log('predict:', JSON.stringify(text));
            this.terminal.write(text);
        }
        return true;
    }
    addBoundary(buffer, prediction) {
        let applied = false;
        if (buffer && prediction) {
            // We apply the prediction so that it's matched against, but wrapped
            // in a tentativeboundary so that it doesn't affect the physical cursor.
            // Then we apply it specifically to the tentative cursor.
            applied = this.addPrediction(buffer, new TentativeBoundary(prediction));
            prediction.apply(buffer, this.tentativeCursor(buffer));
        }
        this._currentGen++;
        return applied;
    }
    /**
     * Peeks the last prediction written.
     */
    peekEnd() {
        return this._expected[this._expected.length - 1]?.p;
    }
    /**
     * Peeks the first pending prediction.
     */
    peekStart() {
        return this._expected[0]?.p;
    }
    /**
     * Current position of the cursor in the terminal.
     */
    physicalCursor(buffer) {
        if (!this._physicalCursor) {
            if (this._showPredictions) {
                flushOutput(this.terminal);
            }
            this._physicalCursor = new Cursor(this.terminal.rows, this.terminal.cols, buffer);
        }
        return this._physicalCursor;
    }
    /**
     * Cursor position if all predictions and boundaries that have been inserted
     * so far turn out to be successfully predicted.
     */
    tentativeCursor(buffer) {
        if (!this._tenativeCursor) {
            this._tenativeCursor = this.physicalCursor(buffer).clone();
        }
        return this._tenativeCursor;
    }
    clearCursor() {
        this._physicalCursor = undefined;
        this._tenativeCursor = undefined;
    }
    _getActiveBuffer() {
        const buffer = this.terminal.buffer.active;
        return buffer.type === 'normal' ? buffer : undefined;
    }
}
/**
 * Gets the escape sequence args to restore state/appearance in the cell.
 */
const attributesToArgs = (cell) => {
    if (cell.isAttributeDefault()) {
        return [0];
    }
    const args = [];
    if (cell.isBold()) {
        args.push(1);
    }
    if (cell.isDim()) {
        args.push(2);
    }
    if (cell.isItalic()) {
        args.push(3);
    }
    if (cell.isUnderline()) {
        args.push(4);
    }
    if (cell.isBlink()) {
        args.push(5);
    }
    if (cell.isInverse()) {
        args.push(7);
    }
    if (cell.isInvisible()) {
        args.push(8);
    }
    if (cell.isFgRGB()) {
        args.push(38, 2, cell.getFgColor() >>> 24, (cell.getFgColor() >>> 16) & 0xFF, cell.getFgColor() & 0xFF);
    }
    if (cell.isFgPalette()) {
        args.push(38, 5, cell.getFgColor());
    }
    if (cell.isFgDefault()) {
        args.push(39);
    }
    if (cell.isBgRGB()) {
        args.push(48, 2, cell.getBgColor() >>> 24, (cell.getBgColor() >>> 16) & 0xFF, cell.getBgColor() & 0xFF);
    }
    if (cell.isBgPalette()) {
        args.push(48, 5, cell.getBgColor());
    }
    if (cell.isBgDefault()) {
        args.push(49);
    }
    return args;
};
/**
 * Gets the escape sequence to restore state/appearance in the cell.
 */
const attributesToSeq = (cell) => `${"\u001B[" /* VT.Csi */}${attributesToArgs(cell).join(';')}m`;
const arrayHasPrefixAt = (a, ai, b) => {
    if (a.length - ai > b.length) {
        return false;
    }
    for (let bi = 0; bi < b.length; bi++, ai++) {
        if (b[ai] !== a[ai]) {
            return false;
        }
    }
    return true;
};
/**
 * @see https://github.com/xtermjs/xterm.js/blob/065eb13a9d3145bea687239680ec9696d9112b8e/src/common/InputHandler.ts#L2127
 */
const getColorWidth = (params, pos) => {
    const accu = [0, 0, -1, 0, 0, 0];
    let cSpace = 0;
    let advance = 0;
    do {
        const v = params[pos + advance];
        accu[advance + cSpace] = isNumber(v) ? v : v[0];
        if (!isNumber(v)) {
            let i = 0;
            do {
                if (accu[1] === 5) {
                    cSpace = 1;
                }
                accu[advance + i + 1 + cSpace] = v[i];
            } while (++i < v.length && i + advance + 1 + cSpace < accu.length);
            break;
        }
        // exit early if can decide color mode with semicolons
        if ((accu[1] === 5 && advance + cSpace >= 2)
            || (accu[1] === 2 && advance + cSpace >= 5)) {
            break;
        }
        // offset colorSpace slot for semicolon mode
        if (accu[1]) {
            cSpace = 1;
        }
    } while (++advance + pos < params.length && advance + cSpace < accu.length);
    return advance;
};
class TypeAheadStyle {
    static _compileArgs(args) {
        return `${"\u001B[" /* VT.Csi */}${args.join(';')}m`;
    }
    constructor(value, _terminal) {
        this._terminal = _terminal;
        /**
         * Number of typeahead style arguments we expect to read. If this is 0 and
         * we see a style coming in, we know that the PTY actually wanted to update.
         */
        this._expectedIncomingStyles = 0;
        this.onUpdate(value);
    }
    /**
     * Signals that a style was written to the terminal and we should watch
     * for it coming in.
     */
    expectIncomingStyle(n = 1) {
        this._expectedIncomingStyles += n * 2;
    }
    /**
     * Starts tracking for CSI changes in the terminal.
     */
    startTracking() {
        this._expectedIncomingStyles = 0;
        this._onDidWriteSGR(attributesToArgs(core(this._terminal)._inputHandler._curAttrData));
        this._csiHandler = this._terminal.parser.registerCsiHandler({ final: 'm' }, args => {
            this._onDidWriteSGR(args);
            return false;
        });
    }
    /**
     * Stops tracking terminal CSI changes.
     */
    debounceStopTracking() {
        this._stopTracking();
    }
    /**
     * @inheritdoc
     */
    dispose() {
        this._stopTracking();
    }
    _stopTracking() {
        this._csiHandler?.dispose();
        this._csiHandler = undefined;
    }
    _onDidWriteSGR(args) {
        const originalUndo = this._undoArgs;
        for (let i = 0; i < args.length;) {
            const px = args[i];
            const p = isNumber(px) ? px : px[0];
            if (this._expectedIncomingStyles) {
                if (arrayHasPrefixAt(args, i, this._undoArgs)) {
                    this._expectedIncomingStyles--;
                    i += this._undoArgs.length;
                    continue;
                }
                if (arrayHasPrefixAt(args, i, this._applyArgs)) {
                    this._expectedIncomingStyles--;
                    i += this._applyArgs.length;
                    continue;
                }
            }
            const width = p === 38 || p === 48 || p === 58 ? getColorWidth(args, i) : 1;
            switch (this._applyArgs[0]) {
                case 1:
                    if (p === 2) {
                        this._undoArgs = [22, 2];
                    }
                    else if (p === 22 || p === 0) {
                        this._undoArgs = [22];
                    }
                    break;
                case 2:
                    if (p === 1) {
                        this._undoArgs = [22, 1];
                    }
                    else if (p === 22 || p === 0) {
                        this._undoArgs = [22];
                    }
                    break;
                case 38:
                    if (p === 0 || p === 39 || p === 100) {
                        this._undoArgs = [39];
                    }
                    else if ((p >= 30 && p <= 38) || (p >= 90 && p <= 97)) {
                        this._undoArgs = args.slice(i, i + width);
                    }
                    break;
                default:
                    if (p === this._applyArgs[0]) {
                        this._undoArgs = this._applyArgs;
                    }
                    else if (p === 0) {
                        this._undoArgs = this._originalUndoArgs;
                    }
                // no-op
            }
            i += width;
        }
        if (originalUndo !== this._undoArgs) {
            this.undo = TypeAheadStyle._compileArgs(this._undoArgs);
        }
    }
    /**
     * Updates the current typeahead style.
     */
    onUpdate(style) {
        const { applyArgs, undoArgs } = this._getArgs(style);
        this._applyArgs = applyArgs;
        this._undoArgs = this._originalUndoArgs = undoArgs;
        this.apply = TypeAheadStyle._compileArgs(this._applyArgs);
        this.undo = TypeAheadStyle._compileArgs(this._undoArgs);
    }
    _getArgs(style) {
        switch (style) {
            case 'bold':
                return { applyArgs: [1], undoArgs: [22] };
            case 'dim':
                return { applyArgs: [2], undoArgs: [22] };
            case 'italic':
                return { applyArgs: [3], undoArgs: [23] };
            case 'underlined':
                return { applyArgs: [4], undoArgs: [24] };
            case 'inverted':
                return { applyArgs: [7], undoArgs: [27] };
            default: {
                let color;
                try {
                    color = Color.fromHex(style);
                }
                catch {
                    color = new Color(new RGBA(255, 0, 0, 1));
                }
                const { r, g, b } = color.rgba;
                return { applyArgs: [38, 2, r, g, b], undoArgs: [39] };
            }
        }
    }
}
__decorate([
    debounce(2000)
], TypeAheadStyle.prototype, "debounceStopTracking", null);
const compileExcludeRegexp = (programs = DEFAULT_LOCAL_ECHO_EXCLUDE) => new RegExp(`\\b(${programs.map(escapeRegExpCharacters).join('|')})\\b`, 'i');
export var CharPredictState;
(function (CharPredictState) {
    /** No characters typed on this line yet */
    CharPredictState[CharPredictState["Unknown"] = 0] = "Unknown";
    /** Has a pending character prediction */
    CharPredictState[CharPredictState["HasPendingChar"] = 1] = "HasPendingChar";
    /** Character validated on this line */
    CharPredictState[CharPredictState["Validated"] = 2] = "Validated";
})(CharPredictState || (CharPredictState = {}));
let TypeAheadAddon = class TypeAheadAddon extends Disposable {
    constructor(_processManager, _configurationService, _telemetryService) {
        super();
        this._processManager = _processManager;
        this._configurationService = _configurationService;
        this._telemetryService = _telemetryService;
        this._terminalTitle = '';
        this._typeaheadThreshold = this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoLatencyThreshold;
        this._excludeProgramRe = compileExcludeRegexp(this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoExcludePrograms);
        this._register(toDisposable(() => this._clearPredictionDebounce?.dispose()));
    }
    activate(terminal) {
        const style = this._typeaheadStyle = this._register(new TypeAheadStyle(this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoStyle, terminal));
        const timeline = this._timeline = new PredictionTimeline(terminal, this._typeaheadStyle);
        const stats = this.stats = this._register(new PredictionStats(this._timeline));
        timeline.setShowPredictions(this._typeaheadThreshold === 0);
        this._register(terminal.onData(e => this._onUserData(e)));
        this._register(terminal.onTitleChange(title => {
            this._terminalTitle = title;
            this._reevaluatePredictorState(stats, timeline);
        }));
        this._register(terminal.onResize(() => {
            timeline.setShowPredictions(false);
            timeline.clearCursor();
            this._reevaluatePredictorState(stats, timeline);
        }));
        this._register(this._configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(TERMINAL_CONFIG_SECTION)) {
                style.onUpdate(this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoStyle);
                this._typeaheadThreshold = this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoLatencyThreshold;
                this._excludeProgramRe = compileExcludeRegexp(this._configurationService.getValue(TERMINAL_CONFIG_SECTION).localEchoExcludePrograms);
                this._reevaluatePredictorState(stats, timeline);
            }
        }));
        this._register(this._timeline.onPredictionSucceeded(p => {
            if (this._lastRow?.charState === 1 /* CharPredictState.HasPendingChar */ && isTenativeCharacterPrediction(p) && p.inner.appliedAt) {
                if (p.inner.appliedAt.pos.y + p.inner.appliedAt.pos.baseY === this._lastRow.y) {
                    this._lastRow.charState = 2 /* CharPredictState.Validated */;
                }
            }
        }));
        this._register(this._processManager.onBeforeProcessData(e => this._onBeforeProcessData(e)));
        let nextStatsSend;
        this._register(stats.onChange(() => {
            if (!nextStatsSend) {
                nextStatsSend = setTimeout(() => {
                    this._sendLatencyStats(stats);
                    nextStatsSend = undefined;
                }, 300000 /* StatsConstants.StatsSendTelemetryEvery */);
            }
            if (timeline.length === 0) {
                style.debounceStopTracking();
            }
            this._reevaluatePredictorState(stats, timeline);
        }));
    }
    reset() {
        this._lastRow = undefined;
    }
    _deferClearingPredictions() {
        if (!this.stats || !this._timeline) {
            return;
        }
        this._clearPredictionDebounce?.dispose();
        if (this._timeline.length === 0 || this._timeline.peekStart()?.clearAfterTimeout === false) {
            this._clearPredictionDebounce = undefined;
            return;
        }
        this._clearPredictionDebounce = disposableTimeout(() => {
            this._timeline?.undoAllPredictions();
            if (this._lastRow?.charState === 1 /* CharPredictState.HasPendingChar */) {
                this._lastRow.charState = 0 /* CharPredictState.Unknown */;
            }
        }, Math.max(500, this.stats.maxLatency * 3 / 2), this._store);
    }
    /**
     * Note on debounce:
     *
     * We want to toggle the state only when the user has a pause in their
     * typing. Otherwise, we could turn this on when the PTY sent data but the
     * terminal cursor is not updated, causes issues.
     */
    _reevaluatePredictorState(stats, timeline) {
        this._reevaluatePredictorStateNow(stats, timeline);
    }
    _reevaluatePredictorStateNow(stats, timeline) {
        if (this._excludeProgramRe.test(this._terminalTitle)) {
            timeline.setShowPredictions(false);
        }
        else if (this._typeaheadThreshold < 0) {
            timeline.setShowPredictions(false);
        }
        else if (this._typeaheadThreshold === 0) {
            timeline.setShowPredictions(true);
        }
        else if (stats.sampleSize > 5 /* StatsConstants.StatsMinSamplesToTurnOn */ && stats.accuracy > 0.3 /* StatsConstants.StatsMinAccuracyToTurnOn */) {
            const latency = stats.latency.median;
            if (latency >= this._typeaheadThreshold) {
                timeline.setShowPredictions(true);
            }
            else if (latency < this._typeaheadThreshold / 0.5 /* StatsConstants.StatsToggleOffThreshold */) {
                timeline.setShowPredictions(false);
            }
        }
    }
    _sendLatencyStats(stats) {
        /* __GDPR__
            "terminalLatencyStats" : {
                "owner": "Tyriar",
                "min" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true },
                "max" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true },
                "median" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true },
                "count" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true },
                "predictionAccuracy" : { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true }
            }
         */
        this._telemetryService.publicLog('terminalLatencyStats', {
            ...stats.latency,
            predictionAccuracy: stats.accuracy,
        });
    }
    _onUserData(data) {
        if (this._timeline?.terminal.buffer.active.type !== 'normal') {
            return;
        }
        // console.log('user data:', JSON.stringify(data));
        const terminal = this._timeline.terminal;
        const buffer = terminal.buffer.active;
        // Detect programs like git log/less that use the normal buffer but don't
        // take input by deafult (fixes #109541)
        if (buffer.cursorX === 1 && buffer.cursorY === terminal.rows - 1) {
            if (buffer.getLine(buffer.cursorY + buffer.baseY)?.getCell(0)?.getChars() === ':') {
                return;
            }
        }
        // the following code guards the terminal prompt to avoid being able to
        // arrow or backspace-into the prompt. Record the lowest X value at which
        // the user gave input, and mark all additions before that as tentative.
        const actualY = buffer.baseY + buffer.cursorY;
        if (actualY !== this._lastRow?.y) {
            this._lastRow = { y: actualY, startingX: buffer.cursorX, endingX: buffer.cursorX, charState: 0 /* CharPredictState.Unknown */ };
        }
        else {
            this._lastRow.startingX = Math.min(this._lastRow.startingX, buffer.cursorX);
            this._lastRow.endingX = Math.max(this._lastRow.endingX, this._timeline.physicalCursor(buffer).x);
        }
        const addLeftNavigating = (p) => this._timeline.tentativeCursor(buffer).x <= this._lastRow.startingX
            ? this._timeline.addBoundary(buffer, p)
            : this._timeline.addPrediction(buffer, p);
        const addRightNavigating = (p) => this._timeline.tentativeCursor(buffer).x >= this._lastRow.endingX - 1
            ? this._timeline.addBoundary(buffer, p)
            : this._timeline.addPrediction(buffer, p);
        /** @see https://github.com/xtermjs/xterm.js/blob/1913e9512c048e3cf56bb5f5df51bfff6899c184/src/common/input/Keyboard.ts */
        const reader = new StringReader(data);
        while (reader.remaining > 0) {
            if (reader.eatCharCode(127)) { // backspace
                const previous = this._timeline.peekEnd();
                if (previous && previous instanceof CharacterPrediction) {
                    this._timeline.addBoundary();
                }
                // backspace must be able to read the previously-written character in
                // the event that it needs to undo it
                if (this._timeline.isShowingPredictions) {
                    flushOutput(this._timeline.terminal);
                }
                if (this._timeline.tentativeCursor(buffer).x <= this._lastRow.startingX) {
                    this._timeline.addBoundary(buffer, new BackspacePrediction(this._timeline.terminal));
                }
                else {
                    // Backspace decrements our ability to go right.
                    this._lastRow.endingX--;
                    this._timeline.addPrediction(buffer, new BackspacePrediction(this._timeline.terminal));
                }
                continue;
            }
            if (reader.eatCharCode(32, 126)) { // alphanum
                const char = data[reader.index - 1];
                const prediction = new CharacterPrediction(this._typeaheadStyle, char);
                if (this._lastRow.charState === 0 /* CharPredictState.Unknown */) {
                    this._timeline.addBoundary(buffer, prediction);
                    this._lastRow.charState = 1 /* CharPredictState.HasPendingChar */;
                }
                else {
                    this._timeline.addPrediction(buffer, prediction);
                }
                if (this._timeline.tentativeCursor(buffer).x >= terminal.cols) {
                    this._timeline.addBoundary(buffer, new LinewrapPrediction());
                }
                continue;
            }
            const cursorMv = reader.eatRe(CSI_MOVE_RE);
            if (cursorMv) {
                const direction = cursorMv[3];
                const p = new CursorMovePrediction(direction, !!cursorMv[2], Number(cursorMv[1]) || 1);
                if (direction === "D" /* CursorMoveDirection.Back */) {
                    addLeftNavigating(p);
                }
                else {
                    addRightNavigating(p);
                }
                continue;
            }
            if (reader.eatStr(`${"\u001B" /* VT.Esc */}f`)) {
                addRightNavigating(new CursorMovePrediction("C" /* CursorMoveDirection.Forwards */, true, 1));
                continue;
            }
            if (reader.eatStr(`${"\u001B" /* VT.Esc */}b`)) {
                addLeftNavigating(new CursorMovePrediction("D" /* CursorMoveDirection.Back */, true, 1));
                continue;
            }
            if (reader.eatChar('\r') && buffer.cursorY < terminal.rows - 1) {
                this._timeline.addPrediction(buffer, new NewlinePrediction());
                continue;
            }
            // something else
            this._timeline.addBoundary(buffer, new HardBoundary());
            break;
        }
        if (this._timeline.length === 1) {
            this._deferClearingPredictions();
            this._typeaheadStyle.startTracking();
        }
    }
    _onBeforeProcessData(event) {
        if (!this._timeline) {
            return;
        }
        // console.log('incoming data:', JSON.stringify(event.data));
        event.data = this._timeline.beforeServerInput(event.data);
        // console.log('emitted data:', JSON.stringify(event.data));
        this._deferClearingPredictions();
    }
};
__decorate([
    debounce(100)
], TypeAheadAddon.prototype, "_reevaluatePredictorState", null);
TypeAheadAddon = __decorate([
    __param(1, IConfigurationService),
    __param(2, ITelemetryService)
], TypeAheadAddon);
export { TypeAheadAddon };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxUeXBlQWhlYWRBZGRvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvdHlwZUFoZWFkL2Jyb3dzZXIvdGVybWluYWxUeXBlQWhlYWRBZGRvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNuRixPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUMvRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUUxRixPQUFPLEVBQW9ELHVCQUF1QixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFakksT0FBTyxFQUFFLDBCQUEwQixFQUF3QyxNQUFNLDZDQUE2QyxDQUFDO0FBQy9ILE9BQU8sRUFBRSxRQUFRLEVBQXFCLE1BQU0scUNBQXFDLENBQUM7QUFFbEYsSUFBVyxFQU9WO0FBUEQsV0FBVyxFQUFFO0lBQ1osb0JBQVksQ0FBQTtJQUNaLHFCQUFhLENBQUE7SUFDYixnQ0FBd0IsQ0FBQTtJQUN4QixnQ0FBd0IsQ0FBQTtJQUN4Qiw2QkFBcUIsQ0FBQTtJQUNyQixtQ0FBMkIsQ0FBQTtBQUM1QixDQUFDLEVBUFUsRUFBRSxL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QUUsRUFBRSxDQUFDO1FBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEtBQUssRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUFDLENBQUM7SUFDaEksSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQztRQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztJQUFDLENBQUM7SUFDaEUsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQztRQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFBQyxDQUFDO0lBRTFDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUM7UUFBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsS0FBSyxFQUFFLENBQUMsR0FBRyxJQUFJLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQUMsQ0FBQztJQUNoSSxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO1FBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0lBQUMsQ0FBQztJQUNoRSxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO1FBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUFDLENBQUM7SUFFMUMsT0FBTyxJQUFJLENBQUM7QUFDYixDQUFDLENBQUM7QUFFRjs7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