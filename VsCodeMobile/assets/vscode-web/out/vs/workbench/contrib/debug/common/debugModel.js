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
import { distinct } from '../../../../base/common/arrays.js';
import { findLastIdx } from '../../../../base/common/arraysFind.js';
import { DeferredPromise, RunOnceScheduler } from '../../../../base/common/async.js';
import { VSBuffer, decodeBase64, encodeBase64 } from '../../../../base/common/buffer.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Emitter, trackSetChanges } from '../../../../base/common/event.js';
import { stringHash } from '../../../../base/common/hash.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { mixin } from '../../../../base/common/objects.js';
import { autorun } from '../../../../base/common/observable.js';
import * as resources from '../../../../base/common/resources.js';
import { isString, isUndefinedOrNull } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { Range } from '../../../../editor/common/core/range.js';
import * as nls from '../../../../nls.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { DEBUG_MEMORY_SCHEME, isFrameDeemphasized } from './debug.js';
import { UNKNOWN_SOURCE_LABEL, getUriFromSource } from './debugSource.js';
import { DisassemblyViewInput } from './disassemblyViewInput.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
export class ExpressionContainer {
    static { this.allValues = new Map(); }
    // Use chunks to support variable paging #9537
    static { this.BASE_CHUNK_SIZE = 100; }
    constructor(session, threadId, _reference, id, namedVariables = 0, indexedVariables = 0, memoryReference = undefined, startOfVariables = 0, presentationHint = undefined, valueLocationReference = undefined) {
        this.session = session;
        this.threadId = threadId;
        this._reference = _reference;
        this.id = id;
        this.namedVariables = namedVariables;
        this.indexedVariables = indexedVariables;
        this.memoryReference = memoryReference;
        this.startOfVariables = startOfVariables;
        this.presentationHint = presentationHint;
        this.valueLocationReference = valueLocationReference;
        this.valueChanged = false;
        this._value = '';
    }
    get reference() {
        return this._reference;
    }
    set reference(value) {
        this._reference = value;
        this.children = undefined; // invalidate children cache
    }
    async evaluateLazy() {
        if (typeof this.reference === 'undefined') {
            return;
        }
        const response = await this.session.variables(this.reference, this.threadId, undefined, undefined, undefined);
        if (!response || !response.body || !response.body.variables || response.body.variables.length !== 1) {
            return;
        }
        const dummyVar = response.body.variables[0];
        this.reference = dummyVar.variablesReference;
        this._value = dummyVar.value;
        this.namedVariables = dummyVar.namedVariables;
        this.indexedVariables = dummyVar.indexedVariables;
        this.memoryReference = dummyVar.memoryReference;
        this.presentationHint = dummyVar.presentationHint;
        this.valueLocationReference = dummyVar.valueLocationReference;
        // Also call overridden method to adopt subclass props
        this.adoptLazyResponse(dummyVar);
    }
    adoptLazyResponse(response) {
    }
    getChildren() {
        if (!this.children) {
            this.children = this.doGetChildren();
        }
        return this.children;
    }
    async doGetChildren() {
        if (!this.hasChildren) {
            return [];
        }
        if (!this.getChildrenInChunks) {
            return this.fetchVariables(undefined, undefined, undefined);
        }
        // Check if object has named variables, fetch them independent from indexed variables #9670
        const children = this.namedVariables ? await this.fetchVariables(undefined, undefined, 'named') : [];
        // Use a dynamic chunk size based on the number of elements #9774
        let chunkSize = ExpressionContainer.BASE_CHUNK_SIZE;
        while (!!this.indexedVariables && this.indexedVariables > chunkSize * ExpressionContainer.BASE_CHUNK_SIZE) {
            chunkSize *= ExpressionContainer.BASE_CHUNK_SIZE;
        }
        if (!!this.indexedVariables && this.indexedVariables > chunkSize) {
            // There are a lot of children, create fake intermediate values that represent chunks #9537
            const numberOfChunks = Math.ceil(this.indexedVariables / chunkSize);
            for (let i = 0; i < numberOfChunks; i++) {
                const start = (this.startOfVariables || 0) + i * chunkSize;
                const count = Math.min(chunkSize, this.indexedVariables - i * chunkSize);
                children.push(new Variable(this.session, this.threadId, this, this.reference, `[${start}..${start + count - 1}]`, '', '', undefined, count, undefined, { kind: 'virtual' }, undefined, undefined, true, start));
            }
            return children;
        }
        const variables = await this.fetchVariables(this.startOfVariables, this.indexedVariables, 'indexed');
        return children.concat(variables);
    }
    getId() {
        return this.id;
    }
    getSession() {
        return this.session;
    }
    get value() {
        return this._value;
    }
    get hasChildren() {
        // only variables with reference > 0 have children.
        return !!this.reference && this.reference > 0 && !this.presentationHint?.lazy;
    }
    async fetchVariables(start, count, filter) {
        try {
            const response = await this.session.variables(this.reference || 0, this.threadId, filter, start, count);
            if (!response || !response.body || !response.body.variables) {
                return [];
            }
            const nameCount = new Map();
            const vars = response.body.variables.filter(v => !!v).map((v) => {
                if (isString(v.value) && isString(v.name) && typeof v.variablesReference === 'number') {
                    const count = nameCount.get(v.name) || 0;
                    const idDuplicationIndex = count > 0 ? count.toString() : '';
                    nameCount.set(v.name, count + 1);
                    return new Variable(this.session, this.threadId, this, v.variablesReference, v.name, v.evaluateName, v.value, v.namedVariables, v.indexedVariables, v.memoryReference, v.presentationHint, v.type, v.__vscodeVariableMenuContext, true, 0, idDuplicationIndex, v.declarationLocationReference, v.valueLocationReference);
                }
                return new Variable(this.session, this.threadId, this, 0, '', undefined, nls.localize('invalidVariableAttributes', "Invalid variable attributes"), 0, 0, undefined, { kind: 'virtual' }, undefined, undefined, false);
            });
            if (this.session.autoExpandLazyVariables) {
                await Promise.all(vars.map(v => v.presentationHint?.lazy && v.evaluateLazy()));
            }
            return vars;
        }
        catch (e) {
            return [new Variable(this.session, this.threadId, this, 0, '', undefined, e.message, 0, 0, undefined, { kind: 'virtual' }, undefined, undefined, false)];
        }
    }
    // The adapter explicitly sents the children count of an expression only if there are lots of children which should be chunked.
    get getChildrenInChunks() {
        return !!this.indexedVariables;
    }
    set value(value) {
        this._value = value;
        this.valueChanged = !!ExpressionContainer.allValues.get(this.getId()) &&
            ExpressionContainer.allValues.get(this.getId()) !== Expression.DEFAULT_VALUE && ExpressionContainer.allValues.get(this.getId()) !== value;
        ExpressionContainer.allValues.set(this.getId(), value);
    }
    toString() {
        return this.value;
    }
    async evaluateExpression(expression, session, stackFrame, context, keepLazyVars = false, location) {
        if (!session || (!stackFrame && context !== 'repl')) {
            this.value = context === 'repl' ? nls.localize('startDebugFirst', "Please start a debug session to evaluate expressions") : Expression.DEFAULT_VALUE;
            this.reference = 0;
            return false;
        }
        this.session = session;
        try {
            const response = await session.evaluate(expression, stackFrame ? stackFrame.frameId : undefined, context, location);
            if (response && response.body) {
                this.value = response.body.result || '';
                this.reference = response.body.variablesReference;
                this.namedVariables = response.body.namedVariables;
                this.indexedVariables = response.body.indexedVariables;
                this.memoryReference = response.body.memoryReference;
                this.type = response.body.type || this.type;
                this.presentationHint = response.body.presentationHint;
                this.valueLocationReference = response.body.valueLocationReference;
                if (!keepLazyVars && response.body.presentationHint?.lazy) {
                    await this.evaluateLazy();
                }
                return true;
            }
            return false;
        }
        catch (e) {
            this.value = e.message || '';
            this.reference = 0;
            this.memoryReference = undefined;
            return false;
        }
    }
}
function handleSetResponse(expression, response) {
    if (response && response.body) {
        expression.value = response.body.value || '';
        expression.type = response.body.type || expression.type;
        expression.reference = response.body.variablesReference;
        expression.namedVariables = response.body.namedVariables;
        expression.indexedVariables = response.body.indexedVariables;
        // todo @weinand: the set responses contain most properties, but not memory references. Should they?
    }
}
export class VisualizedExpression {
    evaluateLazy() {
        return Promise.resolve();
    }
    getChildren() {
        return this.visualizer.getVisualizedChildren(this.session, this.treeId, this.treeItem.id);
    }
    getId() {
        return this.id;
    }
    get name() {
        return this.treeItem.label;
    }
    get value() {
        return this.treeItem.description || '';
    }
    get hasChildren() {
        return this.treeItem.collapsibleState !== 0 /* DebugTreeItemCollapsibleState.None */;
    }
    constructor(session, visualizer, treeId, treeItem, original) {
        this.session = session;
        this.visualizer = visualizer;
        this.treeId = treeId;
        this.treeItem = treeItem;
        this.original = original;
        this.id = generateUuid();
    }
    getSession() {
        return this.session;
    }
    /** Edits the value, sets the {@link errorMessage} and returns false if unsuccessful */
    async edit(newValue) {
        try {
            await this.visualizer.editTreeItem(this.treeId, this.treeItem, newValue);
            return true;
        }
        catch (e) {
            this.errorMessage = e.message;
            return false;
        }
    }
}
export class Expression extends ExpressionContainer {
    static { this.DEFAULT_VALUE = nls.localize('notAvailable', "not available"); }
    constructor(name, id = generateUuid()) {
        super(undefined, undefined, 0, id);
        this.name = name;
        this._onDidChangeValue = new Emitter();
        this.onDidChangeValue = this._onDidChangeValue.event;
        this.available = false;
        // name is not set if the expression is just being added
        // in that case do not set default value to prevent flashing #14499
        if (name) {
            this.value = Expression.DEFAULT_VALUE;
        }
    }
    async evaluate(session, stackFrame, context, keepLazyVars, location) {
        const hadDefaultValue = this.value === Expression.DEFAULT_VALUE;
        this.available = await this.evaluateExpression(this.name, session, stackFrame, context, keepLazyVars, location);
        if (hadDefaultValue || this.valueChanged) {
            this._onDidChangeValue.fire(this);
        }
    }
    toString() {
        return `${this.name}\n${this.value}`;
    }
    toJSON() {
        return {
            sessionId: this.getSession()?.getId(),
            variable: this.toDebugProtocolObject(),
        };
    }
    toDebugProtocolObject() {
        return {
            name: this.name,
            variablesReference: this.reference || 0,
            memoryReference: this.memoryReference,
            value: this.value,
            type: this.type,
            evaluateName: this.name
        };
    }
    async setExpression(value, stackFrame) {
        if (!this.session) {
            return;
        }
        const response = await this.session.setExpression(stackFrame.frameId, this.name, value);
        handleSetResponse(this, response);
    }
}
export class Variable extends ExpressionContainer {
    constructor(session, threadId, parent, reference, name, evaluateName, value, namedVariables, indexedVariables, memoryReference, presentationHint, type = undefined, variableMenuContext = undefined, available = true, startOfVariables = 0, idDuplicationIndex = '', declarationLocationReference = undefined, valueLocationReference = undefined) {
        super(session, threadId, reference, `variable:${parent.getId()}:${name}:${idDuplicationIndex}`, namedVariables, indexedVariables, memoryReference, startOfVariables, presentationHint, valueLocationReference);
        this.parent = parent;
        this.name = name;
        this.evaluateName = evaluateName;
        this.variableMenuContext = variableMenuContext;
        this.available = available;
        this.declarationLocationReference = declarationLocationReference;
        this.value = value || '';
        this.type = type;
    }
    getThreadId() {
        return this.threadId;
    }
    async setVariable(value, stackFrame) {
        if (!this.session) {
            return;
        }
        try {
            // Send out a setExpression for debug extensions that do not support set variables https://github.com/microsoft/vscode/issues/124679#issuecomment-869844437
            if (this.session.capabilities.supportsSetExpression && !this.session.capabilities.supportsSetVariable && this.evaluateName) {
                return this.setExpression(value, stackFrame);
            }
            const response = await this.session.setVariable(this.parent.reference, this.name, value);
            handleSetResponse(this, response);
        }
        catch (err) {
            this.errorMessage = err.message;
        }
    }
    async setExpression(value, stackFrame) {
        if (!this.session || !this.evaluateName) {
            return;
        }
        const response = await this.session.setExpression(stackFrame.frameId, this.evaluateName, value);
        handleSetResponse(this, response);
    }
    toString() {
        return this.name ? `${this.name}: ${this.value}` : this.value;
    }
    toJSON() {
        return {
            sessionId: this.getSession()?.getId(),
            container: this.parent instanceof Expression
                ? { expression: this.parent.name }
                : this.parent.toDebugProtocolObject(),
            variable: this.toDebugProtocolObject()
        };
    }
    adoptLazyResponse(response) {
        this.evaluateName = response.evaluateName;
    }
    toDebugProtocolObject() {
        return {
            name: this.name,
            variablesReference: this.reference || 0,
            memoryReference: this.memoryReference,
            value: this.value,
            type: this.type,
            evaluateName: this.evaluateName
        };
    }
}
export class Scope extends ExpressionContainer {
    constructor(stackFrame, id, name, reference, expensive, namedVariables, indexedVariables, range) {
        super(stackFrame.thread.session, stackFrame.thread.threadId, reference, `scope:${name}:${id}`, namedVariables, indexedVariables);
        this.stackFrame = stackFrame;
        this.name = name;
        this.expensive = expensive;
        this.range = range;
    }
    toString() {
        return this.name;
    }
    toDebugProtocolObject() {
        return {
            name: this.name,
            variablesReference: this.reference || 0,
            expensive: this.expensive
        };
    }
}
export class ErrorScope extends Scope {
    constructor(stackFrame, index, message) {
        super(stackFrame, index, message, 0, false);
    }
    toString() {
        return this.name;
    }
}
export class StackFrame {
    constructor(thread, frameId, source, name, presentationHint, range, index, canRestart, instructionPointerReference) {
        this.thread = thread;
        this.frameId = frameId;
        this.source = source;
        this.name = name;
        this.presentationHint = presentationHint;
        this.range = range;
        this.index = index;
        this.canRestart = canRestart;
        this.instructionPointerReference = instructionPointerReference;
    }
    getId() {
        return `stackframe:${this.thread.getId()}:${this.index}:${this.source.name}`;
    }
    getScopes() {
        if (!this.scopes) {
            this.scopes = this.thread.session.scopes(this.frameId, this.thread.threadId).then(response => {
                if (!response || !response.body || !response.body.scopes) {
                    return [];
                }
                const usedIds = new Set();
                return response.body.scopes.map(rs => {
                    // form the id based on the name and location so that it's the
                    // same across multiple pauses to retain expansion state
                    let id = 0;
                    do {
                        id = stringHash(`${rs.name}:${rs.line}:${rs.column}`, id);
                    } while (usedIds.has(id));
                    usedIds.add(id);
                    return new Scope(this, id, rs.name, rs.variablesReference, rs.expensive, rs.namedVariables, rs.indexedVariables, rs.line && rs.column && rs.endLine && rs.endColumn ? new Range(rs.line, rs.column, rs.endLine, rs.endColumn) : undefined);
                });
            }, err => [new ErrorScope(this, 0, err.message)]);
        }
        return this.scopes;
    }
    async getMostSpecificScopes(range) {
        const scopes = await this.getScopes();
        const nonExpensiveScopes = scopes.filter(s => !s.expensive);
        const haveRangeInfo = nonExpensiveScopes.some(s => !!s.range);
        if (!haveRangeInfo) {
            return nonExpensiveScopes;
        }
        const scopesContainingRange = nonExpensiveScopes.filter(scope => scope.range && Range.containsRange(scope.range, range))
            .sort((first, second) => (first.range.endLineNumber - first.range.startLineNumber) - (second.range.endLineNumber - second.range.startLineNumber));
        return scopesContainingRange.length ? scopesContainingRange : nonExpensiveScopes;
    }
    restart() {
        return this.thread.session.restartFrame(this.frameId, this.thread.threadId);
    }
    forgetScopes() {
        this.scopes = undefined;
    }
    toString() {
        const lineNumberToString = typeof this.range.startLineNumber === 'number' ? `:${this.range.startLineNumber}` : '';
        const sourceToString = `${this.source.inMemory ? this.source.name : this.source.uri.fsPath}${lineNumberToString}`;
        return sourceToString === UNKNOWN_SOURCE_LABEL ? this.name : `${this.name} (${sourceToString})`;
    }
    async openInEditor(editorService, preserveFocus, sideBySide, pinned) {
        const threadStopReason = this.thread.stoppedDetails?.reason;
        if (this.instructionPointerReference &&
            ((threadStopReason === 'instruction breakpoint' && !preserveFocus) ||
                (threadStopReason === 'step' && this.thread.lastSteppingGranularity === 'instruction' && !preserveFocus) ||
                editorService.activeEditor instanceof DisassemblyViewInput)) {
            return editorService.openEditor(DisassemblyViewInput.instance, { pinned: true, revealIfOpened: true, preserveFocus });
        }
        if (this.source.available) {
            return this.source.openInEditor(editorService, this.range, preserveFocus, sideBySide, pinned);
        }
        return undefined;
    }
    equals(other) {
        return (this.name === other.name) && (other.thread === this.thread) && (this.frameId === other.frameId) && (other.source === this.source) && (Range.equalsRange(this.range, other.range));
    }
}
const KEEP_SUBTLE_FRAME_AT_TOP_REASONS = ['breakpoint', 'step', 'function breakpoint'];
export class Thread {
    constructor(session, name, threadId) {
        this.session = session;
        this.name = name;
        this.threadId = threadId;
        this.callStackCancellationTokens = [];
        this.reachedEndOfCallStack = false;
        this.callStack = [];
        this.staleCallStack = [];
        this.stopped = false;
    }
    getId() {
        return `thread:${this.session.getId()}:${this.threadId}`;
    }
    clearCallStack() {
        if (this.callStack.length) {
            this.staleCallStack = this.callStack;
        }
        this.callStack = [];
        this.callStackCancellationTokens.forEach(c => c.dispose(true));
        this.callStackCancellationTokens = [];
    }
    getCallStack() {
        return this.callStack;
    }
    getStaleCallStack() {
        return this.staleCallStack;
    }
    getTopStackFrame() {
        const callStack = this.getCallStack();
        const stopReason = this.stoppedDetails?.reason;
        // Allow stack frame without source and with instructionReferencePointer as top stack frame when using disassembly view.
        const firstAvailableStackFrame = callStack.find(sf => !!(((stopReason === 'instruction breakpoint' || (stopReason === 'step' && this.lastSteppingGranularity === 'instruction')) && sf.instructionPointerReference) ||
            (sf.source && sf.source.available && (KEEP_SUBTLE_FRAME_AT_TOP_REASONS.includes(stopReason) || !isFrameDeemphasized(sf)))));
        return firstAvailableStackFrame;
    }
    get stateLabel() {
        if (this.stoppedDetails) {
            return this.stoppedDetails.description ||
                (this.stoppedDetails.reason ? nls.localize({ key: 'pausedOn', comment: ['indicates reason for program being paused'] }, "Paused on {0}", this.stoppedDetails.reason) : nls.localize('paused', "Paused"));
        }
        return nls.localize({ key: 'running', comment: ['indicates state'] }, "Running");
    }
    /**
     * Queries the debug adapter for the callstack and returns a promise
     * which completes once the call stack has been retrieved.
     * If the thread is not stopped, it returns a promise to an empty array.
     * Only fetches the first stack frame for performance reasons. Calling this method consecutive times
     * gets the remainder of the call stack.
     */
    async fetchCallStack(levels = 20) {
        if (this.stopped) {
            const start = this.callStack.length;
            const callStack = await this.getCallStackImpl(start, levels);
            this.reachedEndOfCallStack = callStack.length < levels;
            if (start < this.callStack.length) {
                // Set the stack frames for exact position we requested. To make sure no concurrent requests create duplicate stack frames #30660
                this.callStack.splice(start, this.callStack.length - start);
            }
            this.callStack = this.callStack.concat(callStack || []);
            if (typeof this.stoppedDetails?.totalFrames === 'number' && this.stoppedDetails.totalFrames === this.callStack.length) {
                this.reachedEndOfCallStack = true;
            }
        }
    }
    async getCallStackImpl(startFrame, levels) {
        try {
            const tokenSource = new CancellationTokenSource();
            this.callStackCancellationTokens.push(tokenSource);
            const response = await this.session.stackTrace(this.threadId, startFrame, levels, tokenSource.token);
            if (!response || !response.body || tokenSource.token.isCancellationRequested) {
                return [];
            }
            if (this.stoppedDetails) {
                this.stoppedDetails.totalFrames = response.body.totalFrames;
            }
            return response.body.stackFrames.map((rsf, index) => {
                const source = this.session.getSource(rsf.source);
                return new StackFrame(this, rsf.id, source, rsf.name, rsf.presentationHint, new Range(rsf.line, rsf.column, rsf.endLine || rsf.line, rsf.endColumn || rsf.column), startFrame + index, typeof rsf.canRestart === 'boolean' ? rsf.canRestart : true, rsf.instructionPointerReference);
            });
        }
        catch (err) {
            if (this.stoppedDetails) {
                this.stoppedDetails.framesErrorMessage = err.message;
            }
            return [];
        }
    }
    /**
     * Returns exception info promise if the exception was thrown, otherwise undefined
     */
    get exceptionInfo() {
        if (this.stoppedDetails && this.stoppedDetails.reason === 'exception') {
            if (this.session.capabilities.supportsExceptionInfoRequest) {
                return this.session.exceptionInfo(this.threadId);
            }
            return Promise.resolve({
                description: this.stoppedDetails.text,
                breakMode: null
            });
        }
        return Promise.resolve(undefined);
    }
    next(granularity) {
        return this.session.next(this.threadId, granularity);
    }
    stepIn(granularity) {
        return this.session.stepIn(this.threadId, undefined, granularity);
    }
    stepOut(granularity) {
        return this.session.stepOut(this.threadId, granularity);
    }
    stepBack(granularity) {
        return this.session.stepBack(this.threadId, granularity);
    }
    continue() {
        return this.session.continue(this.threadId);
    }
    pause() {
        return this.session.pause(this.threadId);
    }
    terminate() {
        return this.session.terminateThreads([this.threadId]);
    }
    reverseContinue() {
        return this.session.reverseContinue(this.threadId);
    }
}
/**
 * Gets a URI to a memory in the given session ID.
 */
export const getUriForDebugMemory = (sessionId, memoryReference, range, displayName = 'memory') => {
    return URI.from({
        scheme: DEBUG_MEMORY_SCHEME,
        authority: sessionId,
        path: '/' + encodeURIComponent(memoryReference) + `/${encodeURIComponent(displayName)}.bin`,
        query: range ? `?range=${range.fromOffset}:${range.toOffset}` : undefined,
    });
};
export class MemoryRegion extends Disposable {
    constructor(memoryReference, session) {
        super();
        this.memoryReference = memoryReference;
        this.session = session;
        this.invalidateEmitter = this._register(new Emitter());
        /** @inheritdoc */
        this.onDidInvalidate = this.invalidateEmitter.event;
        this.writable = !!this.session.capabilities.supportsWriteMemoryRequest;
        this._register(session.onDidInvalidateMemory(e => {
            if (e.body.memoryReference === memoryReference) {
                this.invalidate(e.body.offset, e.body.count - e.body.offset);
            }
        }));
    }
    async read(fromOffset, toOffset) {
        const length = toOffset - fromOffset;
        const offset = fromOffset;
        const result = await this.session.readMemory(this.memoryReference, offset, length);
        if (result === undefined || !result.body?.data) {
            return [{ type: 1 /* MemoryRangeType.Unreadable */, offset, length }];
        }
        let data;
        try {
            data = decodeBase64(result.body.data);
        }
        catch {
            return [{ type: 2 /* MemoryRangeType.Error */, offset, length, error: 'Invalid base64 data from debug adapter' }];
        }
        const unreadable = result.body.unreadableBytes || 0;
        const dataLength = length - unreadable;
        if (data.byteLength < dataLength) {
            const pad = VSBuffer.alloc(dataLength - data.byteLength);
            pad.buffer.fill(0);
            data = VSBuffer.concat([data, pad], dataLength);
        }
        else if (data.byteLength > dataLength) {
            data = data.slice(0, dataLength);
        }
        if (!unreadable) {
            return [{ type: 0 /* MemoryRangeType.Valid */, offset, length, data }];
        }
        return [
            { type: 0 /* MemoryRangeType.Valid */, offset, length: dataLength, data },
            { type: 1 /* MemoryRangeType.Unreadable */, offset: offset + dataLength, length: unreadable },
        ];
    }
    async write(offset, data) {
        const result = await this.session.writeMemory(this.memoryReference, offset, encodeBase64(data), true);
        const written = result?.body?.bytesWritten ?? data.byteLength;
        this.invalidate(offset, offset + written);
        return written;
    }
    dispose() {
        super.dispose();
    }
    invalidate(fromOffset, toOffset) {
        this.invalidateEmitter.fire({ fromOffset, toOffset });
    }
}
export class Enablement {
    constructor(enabled, id) {
        this.enabled = enabled;
        this.id = id;
    }
    getId() {
        return this.id;
    }
}
function toBreakpointSessionData(data, capabilities) {
    return mixin({
        supportsConditionalBreakpoints: !!capabilities.supportsConditionalBreakpoints,
        supportsHitConditionalBreakpoints: !!capabilities.supportsHitConditionalBreakpoints,
        supportsLogPoints: !!capabilities.supportsLogPoints,
        supportsFunctionBreakpoints: !!capabilities.supportsFunctionBreakpoints,
        supportsDataBreakpoints: !!capabilities.supportsDataBreakpoints,
        supportsInstructionBreakpoints: !!capabilities.supportsInstructionBreakpoints
    }, data);
}
export class BaseBreakpoint extends Enablement {
    constructor(id, opts) {
        super(opts.enabled ?? true, id);
        this.sessionData = new Map();
        this.condition = opts.condition;
        this.hitCondition = opts.hitCondition;
        this.logMessage = opts.logMessage;
        this.mode = opts.mode;
        this.modeLabel = opts.modeLabel;
    }
    setSessionData(sessionId, data) {
        if (!data) {
            this.sessionData.delete(sessionId);
        }
        else {
            data.sessionId = sessionId;
            this.sessionData.set(sessionId, data);
        }
        const allData = Array.from(this.sessionData.values());
        const verifiedData = distinct(allData.filter(d => d.verified), d => `${d.line}:${d.column}`);
        if (verifiedData.length) {
            // In case multiple session verified the breakpoint and they provide different data show the intial data that the user set (corner case)
            this.data = verifiedData.length === 1 ? verifiedData[0] : undefined;
        }
        else {
            // No session verified the breakpoint
            this.data = allData.length ? allData[0] : undefined;
        }
    }
    get message() {
        if (!this.data) {
            return undefined;
        }
        return this.data.message;
    }
    get verified() {
        return this.data ? this.data.verified : true;
    }
    get sessionsThatVerified() {
        const sessionIds = [];
        for (const [sessionId, data] of this.sessionData) {
            if (data.verified) {
                sessionIds.push(sessionId);
            }
        }
        return sessionIds;
    }
    getIdFromAdapter(sessionId) {
        const data = this.sessionData.get(sessionId);
        return data ? data.id : undefined;
    }
    getDebugProtocolBreakpoint(sessionId) {
        const data = this.sessionData.get(sessionId);
        if (data) {
            const bp = {
                id: data.id,
                verified: data.verified,
                message: data.message,
                source: data.source,
                line: data.line,
                column: data.column,
                endLine: data.endLine,
                endColumn: data.endColumn,
                instructionReference: data.instructionReference,
                offset: data.offset
            };
            return bp;
        }
        return undefined;
    }
    toJSON() {
        return {
            id: this.getId(),
            enabled: this.enabled,
            condition: this.condition,
            hitCondition: this.hitCondition,
            logMessage: this.logMessage,
            mode: this.mode,
            modeLabel: this.modeLabel,
        };
    }
}
export class Breakpoint extends BaseBreakpoint {
    constructor(opts, textFileService, uriIdentityService, logService, id = generateUuid()) {
        super(id, opts);
        this.textFileService = textFileService;
        this.uriIdentityService = uriIdentityService;
        this.logService = logService;
        this._uri = opts.uri;
        this._lineNumber = opts.lineNumber;
        this._column = opts.column;
        this._adapterData = opts.adapterData;
        this.triggeredBy = opts.triggeredBy;
    }
    toDAP() {
        return {
            line: this.sessionAgnosticData.lineNumber,
            column: this.sessionAgnosticData.column,
            condition: this.condition,
            hitCondition: this.hitCondition,
            logMessage: this.logMessage,
            mode: this.mode
        };
    }
    get originalUri() {
        return this._uri;
    }
    get lineNumber() {
        return this.verified && this.data && typeof this.data.line === 'number' ? this.data.line : this._lineNumber;
    }
    get verified() {
        if (this.data) {
            return this.data.verified && !this.textFileService.isDirty(this._uri);
        }
        return true;
    }
    get pending() {
        if (this.data) {
            return false;
        }
        return this.triggeredBy !== undefined;
    }
    get uri() {
        return this.verified && this.data && this.data.source ? getUriFromSource(this.data.source, this.data.source.path, this.data.sessionId, this.uriIdentityService, this.logService) : this._uri;
    }
    get column() {
        return this.verified && this.data && typeof this.data.column === 'number' ? this.data.column : this._column;
    }
    get message() {
        if (this.textFileService.isDirty(this.uri)) {
            return nls.localize('breakpointDirtydHover', "Unverified breakpoint. File is modified, please restart debug session.");
        }
        return super.message;
    }
    get adapterData() {
        return this.data && this.data.source && this.data.source.adapterData ? this.data.source.adapterData : this._adapterData;
    }
    get endLineNumber() {
        return this.verified && this.data ? this.data.endLine : undefined;
    }
    get endColumn() {
        return this.verified && this.data ? this.data.endColumn : undefined;
    }
    get sessionAgnosticData() {
        return {
            lineNumber: this._lineNumber,
            column: this._column
        };
    }
    get supported() {
        if (!this.data) {
            return true;
        }
        if (this.logMessage && !this.data.supportsLogPoints) {
            return false;
        }
        if (this.condition && !this.data.supportsConditionalBreakpoints) {
            return false;
        }
        if (this.hitCondition && !this.data.supportsHitConditionalBreakpoints) {
            return false;
        }
        return true;
    }
    setSessionData(sessionId, data) {
        super.setSessionData(sessionId, data);
        if (!this._adapterData) {
            this._adapterData = this.adapterData;
        }
    }
    toJSON() {
        return {
            ...super.toJSON(),
            uri: this._uri,
            lineNumber: this._lineNumber,
            column: this._column,
            adapterData: this.adapterData,
            triggeredBy: this.triggeredBy,
        };
    }
    toString() {
        return `${resources.basenameOrAuthority(this.uri)} ${this.lineNumber}`;
    }
    setSessionDidTrigger(sessionId, didTrigger = true) {
        if (didTrigger) {
            this.sessionsDidTrigger ??= new Set();
            this.sessionsDidTrigger.add(sessionId);
        }
        else {
            this.sessionsDidTrigger?.delete(sessionId);
        }
    }
    getSessionDidTrigger(sessionId) {
        return !!this.sessionsDidTrigger?.has(sessionId);
    }
    update(data) {
        if (data.hasOwnProperty('lineNumber') && !isUndefinedOrNull(data.lineNumber)) {
            this._lineNumber = data.lineNumber;
        }
        if (data.hasOwnProperty('column')) {
            this._column = data.column;
        }
        if (data.hasOwnProperty('condition')) {
            this.condition = data.condition;
        }
        if (data.hasOwnProperty('hitCondition')) {
            this.hitCondition = data.hitCondition;
        }
        if (data.hasOwnProperty('logMessage')) {
            this.logMessage = data.logMessage;
        }
        if (data.hasOwnProperty('mode')) {
            this.mode = data.mode;
            this.modeLabel = data.modeLabel;
        }
        if (data.hasOwnProperty('triggeredBy')) {
            this.triggeredBy = data.triggeredBy;
            this.sessionsDidTrigger = undefined;
        }
    }
}
export class FunctionBreakpoint extends BaseBreakpoint {
    constructor(opts, id = generateUuid()) {
        super(id, opts);
        this.name = opts.name;
    }
    toDAP() {
        return {
            name: this.name,
            condition: this.condition,
            hitCondition: this.hitCondition,
        };
    }
    toJSON() {
        return {
            ...super.toJSON(),
            name: this.name,
        };
    }
    get supported() {
        if (!this.data) {
            return true;
        }
        return this.data.supportsFunctionBreakpoints;
    }
    toString() {
        return this.name;
    }
}
export class DataBreakpoint extends BaseBreakpoint {
    constructor(opts, id = generateUuid()) {
        super(id, opts);
        this.sessionDataIdForAddr = new WeakMap();
        this.description = opts.description;
        if ('dataId' in opts) { //  back compat with old saved variables in 1.87
            opts.src = { type: 0 /* DataBreakpointSetType.Variable */, dataId: opts.dataId };
        }
        this.src = opts.src;
        this.canPersist = opts.canPersist;
        this.accessTypes = opts.accessTypes;
        this.accessType = opts.accessType;
        if (opts.initialSessionData) {
            this.sessionDataIdForAddr.set(opts.initialSessionData.session, opts.initialSessionData.dataId);
        }
    }
    async toDAP(session) {
        let dataId;
        if (this.src.type === 0 /* DataBreakpointSetType.Variable */) {
            dataId = this.src.dataId;
        }
        else {
            let sessionDataId = this.sessionDataIdForAddr.get(session);
            if (!sessionDataId) {
                sessionDataId = (await session.dataBytesBreakpointInfo(this.src.address, this.src.bytes))?.dataId;
                if (!sessionDataId) {
                    return undefined;
                }
                this.sessionDataIdForAddr.set(session, sessionDataId);
            }
            dataId = sessionDataId;
        }
        return {
            dataId,
            accessType: this.accessType,
            condition: this.condition,
            hitCondition: this.hitCondition,
        };
    }
    toJSON() {
        return {
            ...super.toJSON(),
            description: this.description,
            src: this.src,
            accessTypes: this.accessTypes,
            accessType: this.accessType,
            canPersist: this.canPersist,
        };
    }
    get supported() {
        if (!this.data) {
            return true;
        }
        return this.data.supportsDataBreakpoints;
    }
    toString() {
        return this.description;
    }
}
export class ExceptionBreakpoint extends BaseBreakpoint {
    constructor(opts, id = generateUuid()) {
        super(id, opts);
        this.supportedSessions = new Set();
        this.fallback = false;
        this.filter = opts.filter;
        this.label = opts.label;
        this.supportsCondition = opts.supportsCondition;
        this.description = opts.description;
        this.conditionDescription = opts.conditionDescription;
        this.fallback = opts.fallback || false;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            filter: this.filter,
            label: this.label,
            enabled: this.enabled,
            supportsCondition: this.supportsCondition,
            conditionDescription: this.conditionDescription,
            condition: this.condition,
            fallback: this.fallback,
            description: this.description,
        };
    }
    setSupportedSession(sessionId, supported) {
        if (supported) {
            this.supportedSessions.add(sessionId);
        }
        else {
            this.supportedSessions.delete(sessionId);
        }
    }
    /**
     * Used to specify which breakpoints to show when no session is specified.
     * Useful when no session is active and we want to show the exception breakpoints from the last session.
     */
    setFallback(isFallback) {
        this.fallback = isFallback;
    }
    get supported() {
        return true;
    }
    /**
     * Checks if the breakpoint is applicable for the specified session.
     * If sessionId is undefined, returns true if this breakpoint is a fallback breakpoint.
     */
    isSupportedSession(sessionId) {
        return sessionId ? this.supportedSessions.has(sessionId) : this.fallback;
    }
    matches(filter) {
        return this.filter === filter.filter
            && this.label === filter.label
            && this.supportsCondition === !!filter.supportsCondition
            && this.conditionDescription === filter.conditionDescription
            && this.description === filter.description;
    }
    toString() {
        return this.label;
    }
}
export class InstructionBreakpoint extends BaseBreakpoint {
    constructor(opts, id = generateUuid()) {
        super(id, opts);
        this.instructionReference = opts.instructionReference;
        this.offset = opts.offset;
        this.canPersist = opts.canPersist;
        this.address = opts.address;
    }
    toDAP() {
        return {
            instructionReference: this.instructionReference,
            condition: this.condition,
            hitCondition: this.hitCondition,
            mode: this.mode,
            offset: this.offset,
        };
    }
    toJSON() {
        return {
            ...super.toJSON(),
            instructionReference: this.instructionReference,
            offset: this.offset,
            canPersist: this.canPersist,
            address: this.address,
        };
    }
    get supported() {
        if (!this.data) {
            return true;
        }
        return this.data.supportsInstructionBreakpoints;
    }
    toString() {
        return this.instructionReference;
    }
}
export class ThreadAndSessionIds {
    constructor(sessionId, threadId) {
        this.sessionId = sessionId;
        this.threadId = threadId;
    }
    getId() {
        return `${this.sessionId}:${this.threadId}`;
    }
}
let DebugModel = class DebugModel extends Disposable {
    constructor(debugStorage, textFileService, uriIdentityService, logService) {
        super();
        this.textFileService = textFileService;
        this.uriIdentityService = uriIdentityService;
        this.logService = logService;
        this.schedulers = new Map();
        this.breakpointsActivated = true;
        this._onDidChangeBreakpoints = this._register(new Emitter());
        this._onDidChangeCallStack = this._register(new Emitter());
        this._onDidChangeWatchExpressions = this._register(new Emitter());
        this._onDidChangeWatchExpressionValue = this._register(new Emitter());
        this._breakpointModes = new Map();
        this._register(autorun(reader => {
            this.breakpoints = debugStorage.breakpoints.read(reader);
            this.functionBreakpoints = debugStorage.functionBreakpoints.read(reader);
            this.exceptionBreakpoints = debugStorage.exceptionBreakpoints.read(reader);
            this.dataBreakpoints = debugStorage.dataBreakpoints.read(reader);
            this._onDidChangeBreakpoints.fire(undefined);
        }));
        this._register(autorun(reader => {
            this.watchExpressions = debugStorage.watchExpressions.read(reader);
            this._onDidChangeWatchExpressions.fire(undefined);
        }));
        this._register(trackSetChanges(() => new Set(this.watchExpressions), this.onDidChangeWatchExpressions, (we) => we.onDidChangeValue((e) => this._onDidChangeWatchExpressionValue.fire(e))));
        this.instructionBreakpoints = [];
        this.sessions = [];
    }
    getId() {
        return 'root';
    }
    getSession(sessionId, includeInactive = false) {
        if (sessionId) {
            return this.getSessions(includeInactive).find(s => s.getId() === sessionId);
        }
        return undefined;
    }
    getSessions(includeInactive = false) {
        // By default do not return inactive sessions.
        // However we are still holding onto inactive sessions due to repl and debug service session revival (eh scenario)
        return this.sessions.filter(s => includeInactive || s.state !== 0 /* State.Inactive */);
    }
    addSession(session) {
        this.sessions = this.sessions.filter(s => {
            if (s.getId() === session.getId()) {
                // Make sure to de-dupe if a session is re-initialized. In case of EH debugging we are adding a session again after an attach.
                return false;
            }
            if (s.state === 0 /* State.Inactive */ && s.configuration.name === session.configuration.name) {
                // Make sure to remove all inactive sessions that are using the same configuration as the new session
                s.dispose();
                return false;
            }
            return true;
        });
        let i = 1;
        while (this.sessions.some(s => s.getLabel() === session.getLabel())) {
            session.setName(`${session.configuration.name} ${++i}`);
        }
        let index = -1;
        if (session.parentSession) {
            // Make sure that child sessions are placed after the parent session
            index = findLastIdx(this.sessions, s => s.parentSession === session.parentSession || s === session.parentSession);
        }
        if (index >= 0) {
            this.sessions.splice(index + 1, 0, session);
        }
        else {
            this.sessions.push(session);
        }
        this._onDidChangeCallStack.fire(undefined);
    }
    get onDidChangeBreakpoints() {
        return this._onDidChangeBreakpoints.event;
    }
    get onDidChangeCallStack() {
        return this._onDidChangeCallStack.event;
    }
    get onDidChangeWatchExpressions() {
        return this._onDidChangeWatchExpressions.event;
    }
    get onDidChangeWatchExpressionValue() {
        return this._onDidChangeWatchExpressionValue.event;
    }
    rawUpdate(data) {
        const session = this.sessions.find(p => p.getId() === data.sessionId);
        if (session) {
            session.rawUpdate(data);
            this._onDidChangeCallStack.fire(undefined);
        }
    }
    clearThreads(id, removeThreads, reference = undefined) {
        const session = this.sessions.find(p => p.getId() === id);
        this.schedulers.forEach(entry => {
            entry.scheduler.dispose();
            entry.completeDeferred.complete();
        });
        this.schedulers.clear();
        if (session) {
            session.clearThreads(removeThreads, reference);
            this._onDidChangeCallStack.fire(undefined);
        }
    }
    /**
     * Update the call stack and notify the call stack view that changes have occurred.
     */
    async fetchCallstack(thread, levels) {
        if (thread.reachedEndOfCallStack) {
            return;
        }
        const totalFrames = thread.stoppedDetails?.totalFrames;
        const remainingFrames = (typeof totalFrames === 'number') ? (totalFrames - thread.getCallStack().length) : undefined;
        if (!levels || (remainingFrames && levels > remainingFrames)) {
            levels = remainingFrames;
        }
        if (levels && levels > 0) {
            await thread.fetchCallStack(levels);
            this._onDidChangeCallStack.fire();
        }
        return;
    }
    refreshTopOfCallstack(thread, fetchFullStack = true) {
        if (thread.session.capabilities.supportsDelayedStackTraceLoading) {
            // For improved performance load the first stack frame and then load the rest async.
            let topCallStack = Promise.resolve();
            const wholeCallStack = new Promise((c, e) => {
                topCallStack = thread.fetchCallStack(1).then(() => {
                    if (!fetchFullStack) {
                        c();
                        this._onDidChangeCallStack.fire();
                        return;
                    }
                    if (!this.schedulers.has(thread.getId())) {
                        const deferred = new DeferredPromise();
                        this.schedulers.set(thread.getId(), {
                            completeDeferred: deferred,
                            scheduler: new RunOnceScheduler(() => {
                                thread.fetchCallStack(19).then(() => {
                                    const stale = thread.getStaleCallStack();
                                    const current = thread.getCallStack();
                                    let bottomOfCallStackChanged = stale.length !== current.length;
                                    for (let i = 1; i < stale.length && !bottomOfCallStackChanged; i++) {
                                        bottomOfCallStackChanged = !stale[i].equals(current[i]);
                                    }
                                    if (bottomOfCallStackChanged) {
                                        this._onDidChangeCallStack.fire();
                                    }
                                }).finally(() => {
                                    deferred.complete();
                                    this.schedulers.delete(thread.getId());
                                });
                            }, 420)
                        });
                    }
                    const entry = this.schedulers.get(thread.getId());
                    entry.scheduler.schedule();
                    entry.completeDeferred.p.then(c, e);
                    this._onDidChangeCallStack.fire();
                });
            });
            return { topCallStack, wholeCallStack };
        }
        const wholeCallStack = thread.fetchCallStack();
        return { wholeCallStack, topCallStack: wholeCallStack };
    }
    getBreakpoints(filter) {
        if (filter) {
            const uriStr = filter.uri?.toString();
            const originalUriStr = filter.originalUri?.toString();
            return this.breakpoints.filter(bp => {
                if (uriStr && bp.uri.toString() !== uriStr) {
                    return false;
                }
                if (originalUriStr && bp.originalUri.toString() !== originalUriStr) {
                    return false;
                }
                if (filter.lineNumber && bp.lineNumber !== filter.lineNumber) {
                    return false;
                }
                if (filter.column && bp.column !== filter.column) {
                    return false;
                }
                if (filter.enabledOnly && (!this.breakpointsActivated || !bp.enabled)) {
                    return false;
                }
                if (filter.triggeredOnly && bp.triggeredBy === undefined) {
                    return false;
                }
                return true;
            });
        }
        return this.breakpoints;
    }
    getFunctionBreakpoints() {
        return this.functionBreakpoints;
    }
    getDataBreakpoints() {
        return this.dataBreakpoints;
    }
    getExceptionBreakpoints() {
        return this.exceptionBreakpoints;
    }
    getExceptionBreakpointsForSession(sessionId) {
        return this.exceptionBreakpoints.filter(ebp => ebp.isSupportedSession(sessionId));
    }
    getInstructionBreakpoints() {
        return this.instructionBreakpoints;
    }
    setExceptionBreakpointsForSession(sessionId, filters) {
        if (!filters) {
            return;
        }
        let didChangeBreakpoints = false;
        filters.forEach((d) => {
            let ebp = this.exceptionBreakpoints.filter((exbp) => exbp.matches(d)).pop();
            if (!ebp) {
                didChangeBreakpoints = true;
                ebp = new ExceptionBreakpoint({
                    filter: d.filter,
                    label: d.label,
                    enabled: !!d.default,
                    supportsCondition: !!d.supportsCondition,
                    description: d.description,
                    conditionDescription: d.conditionDescription,
                });
                this.exceptionBreakpoints.push(ebp);
            }
            ebp.setSupportedSession(sessionId, true);
        });
        if (didChangeBreakpoints) {
            this._onDidChangeBreakpoints.fire(undefined);
        }
    }
    removeExceptionBreakpointsForSession(sessionId) {
        this.exceptionBreakpoints.forEach(ebp => ebp.setSupportedSession(sessionId, false));
    }
    // Set last focused session as fallback session.
    // This is done to keep track of the exception breakpoints to show when no session is active.
    setExceptionBreakpointFallbackSession(sessionId) {
        this.exceptionBreakpoints.forEach(ebp => ebp.setFallback(ebp.isSupportedSession(sessionId)));
    }
    setExceptionBreakpointCondition(exceptionBreakpoint, condition) {
        exceptionBreakpoint.condition = condition;
        this._onDidChangeBreakpoints.fire(undefined);
    }
    areBreakpointsActivated() {
        return this.breakpointsActivated;
    }
    setBreakpointsActivated(activated) {
        this.breakpointsActivated = activated;
        this._onDidChangeBreakpoints.fire(undefined);
    }
    addBreakpoints(uri, rawData, fireEvent = true) {
        const newBreakpoints = rawData.map(rawBp => {
            return new Breakpoint({
                uri,
                lineNumber: rawBp.lineNumber,
                column: rawBp.column,
                enabled: rawBp.enabled ?? true,
                condition: rawBp.condition,
                hitCondition: rawBp.hitCondition,
                logMessage: rawBp.logMessage,
                triggeredBy: rawBp.triggeredBy,
                adapterData: undefined,
                mode: rawBp.mode,
                modeLabel: rawBp.modeLabel,
            }, this.textFileService, this.uriIdentityService, this.logService, rawBp.id);
        });
        this.breakpoints = this.breakpoints.concat(newBreakpoints);
        this.breakpointsActivated = true;
        this.sortAndDeDup();
        if (fireEvent) {
            this._onDidChangeBreakpoints.fire({ added: newBreakpoints, sessionOnly: false });
        }
        return newBreakpoints;
    }
    removeBreakpoints(toRemove) {
        this.breakpoints = this.breakpoints.filter(bp => !toRemove.some(toRemove => toRemove.getId() === bp.getId()));
        this._onDidChangeBreakpoints.fire({ removed: toRemove, sessionOnly: false });
    }
    updateBreakpoints(data) {
        const updated = [];
        this.breakpoints.forEach(bp => {
            const bpData = data.get(bp.getId());
            if (bpData) {
                bp.update(bpData);
                updated.push(bp);
            }
        });
        this.sortAndDeDup();
        this._onDidChangeBreakpoints.fire({ changed: updated, sessionOnly: false });
    }
    setBreakpointSessionData(sessionId, capabilites, data) {
        this.breakpoints.forEach(bp => {
            if (!data) {
                bp.setSessionData(sessionId, undefined);
            }
            else {
                const bpData = data.get(bp.getId());
                if (bpData) {
                    bp.setSessionData(sessionId, toBreakpointSessionData(bpData, capabilites));
                }
            }
        });
        this.functionBreakpoints.forEach(fbp => {
            if (!data) {
                fbp.setSessionData(sessionId, undefined);
            }
            else {
                const fbpData = data.get(fbp.getId());
                if (fbpData) {
                    fbp.setSessionData(sessionId, toBreakpointSessionData(fbpData, capabilites));
                }
            }
        });
        this.dataBreakpoints.forEach(dbp => {
            if (!data) {
                dbp.setSessionData(sessionId, undefined);
            }
            else {
                const dbpData = data.get(dbp.getId());
                if (dbpData) {
                    dbp.setSessionData(sessionId, toBreakpointSessionData(dbpData, capabilites));
                }
            }
        });
        this.exceptionBreakpoints.forEach(ebp => {
            if (!data) {
                ebp.setSessionData(sessionId, undefined);
            }
            else {
                const ebpData = data.get(ebp.getId());
                if (ebpData) {
                    ebp.setSessionData(sessionId, toBreakpointSessionData(ebpData, capabilites));
                }
            }
        });
        this.instructionBreakpoints.forEach(ibp => {
            if (!data) {
                ibp.setSessionData(sessionId, undefined);
            }
            else {
                const ibpData = data.get(ibp.getId());
                if (ibpData) {
                    ibp.setSessionData(sessionId, toBreakpointSessionData(ibpData, capabilites));
                }
            }
        });
        this._onDidChangeBreakpoints.fire({
            sessionOnly: true
        });
    }
    getDebugProtocolBreakpoint(breakpointId, sessionId) {
        const bp = this.breakpoints.find(bp => bp.getId() === breakpointId);
        if (bp) {
            return bp.getDebugProtocolBreakpoint(sessionId);
        }
        return undefined;
    }
    getBreakpointModes(forBreakpointType) {
        return [...this._breakpointModes.values()].filter(mode => mode.appliesTo.includes(forBreakpointType));
    }
    registerBreakpointModes(debugType, modes) {
        for (const mode of modes) {
            const key = `${mode.mode}/${mode.label}`;
            const rec = this._breakpointModes.get(key);
            if (rec) {
                for (const target of mode.appliesTo) {
                    if (!rec.appliesTo.includes(target)) {
                        rec.appliesTo.push(target);
                    }
                }
            }
            else {
                const duplicate = [...this._breakpointModes.values()].find(r => r !== rec && r.label === mode.label);
                if (duplicate) {
                    duplicate.label = `${duplicate.label} (${duplicate.firstFromDebugType})`;
                }
                this._breakpointModes.set(key, {
                    mode: mode.mode,
                    label: duplicate ? `${mode.label} (${debugType})` : mode.label,
                    firstFromDebugType: debugType,
                    description: mode.description,
                    appliesTo: mode.appliesTo.slice(), // avoid later mutations
                });
            }
        }
    }
    sortAndDeDup() {
        this.breakpoints = this.breakpoints.sort((first, second) => {
            if (first.uri.toString() !== second.uri.toString()) {
                return resources.basenameOrAuthority(first.uri).localeCompare(resources.basenameOrAuthority(second.uri));
            }
            if (first.lineNumber === second.lineNumber) {
                if (first.column && second.column) {
                    return first.column - second.column;
                }
                return 1;
            }
            return first.lineNumber - second.lineNumber;
        });
        this.breakpoints = distinct(this.breakpoints, bp => `${bp.uri.toString()}:${bp.lineNumber}:${bp.column}`);
    }
    setEnablement(element, enable) {
        if (element instanceof Breakpoint || element instanceof FunctionBreakpoint || element instanceof ExceptionBreakpoint || element instanceof DataBreakpoint || element instanceof InstructionBreakpoint) {
            const changed = [];
            if (element.enabled !== enable && (element instanceof Breakpoint || element instanceof FunctionBreakpoint || element instanceof DataBreakpoint || element instanceof InstructionBreakpoint)) {
                changed.push(element);
            }
            element.enabled = enable;
            if (enable) {
                this.breakpointsActivated = true;
            }
            this._onDidChangeBreakpoints.fire({ changed: changed, sessionOnly: false });
        }
    }
    enableOrDisableAllBreakpoints(enable) {
        const changed = [];
        this.breakpoints.forEach(bp => {
            if (bp.enabled !== enable) {
                changed.push(bp);
            }
            bp.enabled = enable;
        });
        this.functionBreakpoints.forEach(fbp => {
            if (fbp.enabled !== enable) {
                changed.push(fbp);
            }
            fbp.enabled = enable;
        });
        this.dataBreakpoints.forEach(dbp => {
            if (dbp.enabled !== enable) {
                changed.push(dbp);
            }
            dbp.enabled = enable;
        });
        this.instructionBreakpoints.forEach(ibp => {
            if (ibp.enabled !== enable) {
                changed.push(ibp);
            }
            ibp.enabled = enable;
        });
        if (enable) {
            this.breakpointsActivated = true;
        }
        this._onDidChangeBreakpoints.fire({ changed: changed, sessionOnly: false });
    }
    addFunctionBreakpoint(opts, id) {
        const newFunctionBreakpoint = new FunctionBreakpoint(opts, id);
        this.functionBreakpoints.push(newFunctionBreakpoint);
        this._onDidChangeBreakpoints.fire({ added: [newFunctionBreakpoint], sessionOnly: false });
        return newFunctionBreakpoint;
    }
    updateFunctionBreakpoint(id, update) {
        const functionBreakpoint = this.functionBreakpoints.find(fbp => fbp.getId() === id);
        if (functionBreakpoint) {
            if (typeof update.name === 'string') {
                functionBreakpoint.name = update.name;
            }
            if (typeof update.condition === 'string') {
                functionBreakpoint.condition = update.condition;
            }
            if (typeof update.hitCondition === 'string') {
                functionBreakpoint.hitCondition = update.hitCondition;
            }
            this._onDidChangeBreakpoints.fire({ changed: [functionBreakpoint], sessionOnly: false });
        }
    }
    removeFunctionBreakpoints(id) {
        let removed;
        if (id) {
            removed = this.functionBreakpoints.filter(fbp => fbp.getId() === id);
            this.functionBreakpoints = this.functionBreakpoints.filter(fbp => fbp.getId() !== id);
        }
        else {
            removed = this.functionBreakpoints;
            this.functionBreakpoints = [];
        }
        this._onDidChangeBreakpoints.fire({ removed, sessionOnly: false });
    }
    addDataBreakpoint(opts, id) {
        const newDataBreakpoint = new DataBreakpoint(opts, id);
        this.dataBreakpoints.push(newDataBreakpoint);
        this._onDidChangeBreakpoints.fire({ added: [newDataBreakpoint], sessionOnly: false });
    }
    updateDataBreakpoint(id, update) {
        const dataBreakpoint = this.dataBreakpoints.find(fbp => fbp.getId() === id);
        if (dataBreakpoint) {
            if (typeof update.condition === 'string') {
                dataBreakpoint.condition = update.condition;
            }
            if (typeof update.hitCondition === 'string') {
                dataBreakpoint.hitCondition = update.hitCondition;
            }
            this._onDidChangeBreakpoints.fire({ changed: [dataBreakpoint], sessionOnly: false });
        }
    }
    removeDataBreakpoints(id) {
        let removed;
        if (id) {
            removed = this.dataBreakpoints.filter(fbp => fbp.getId() === id);
            this.dataBreakpoints = this.dataBreakpoints.filter(fbp => fbp.getId() !== id);
        }
        else {
            removed = this.dataBreakpoints;
            this.dataBreakpoints = [];
        }
        this._onDidChangeBreakpoints.fire({ removed, sessionOnly: false });
    }
    addInstructionBreakpoint(opts) {
        const newInstructionBreakpoint = new InstructionBreakpoint(opts);
        this.instructionBreakpoints.push(newInstructionBreakpoint);
        this._onDidChangeBreakpoints.fire({ added: [newInstructionBreakpoint], sessionOnly: true });
    }
    removeInstructionBreakpoints(instructionReference, offset) {
        let removed = [];
        if (instructionReference) {
            for (let i = 0; i < this.instructionBreakpoints.length; i++) {
                const ibp = this.instructionBreakpoints[i];
                if (ibp.instructionReference === instructionReference && (offset === undefined || ibp.offset === offset)) {
                    removed.push(ibp);
                    this.instructionBreakpoints.splice(i--, 1);
                }
            }
        }
        else {
            removed = this.instructionBreakpoints;
            this.instructionBreakpoints = [];
        }
        this._onDidChangeBreakpoints.fire({ removed, sessionOnly: false });
    }
    getWatchExpressions() {
        return this.watchExpressions;
    }
    addWatchExpression(name) {
        const we = new Expression(name || '');
        this.watchExpressions.push(we);
        this._onDidChangeWatchExpressions.fire(we);
        return we;
    }
    renameWatchExpression(id, newName) {
        const filtered = this.watchExpressions.filter(we => we.getId() === id);
        if (filtered.length === 1) {
            filtered[0].name = newName;
            this._onDidChangeWatchExpressions.fire(filtered[0]);
        }
    }
    removeWatchExpressions(id = null) {
        this.watchExpressions = id ? this.watchExpressions.filter(we => we.getId() !== id) : [];
        this._onDidChangeWatchExpressions.fire(undefined);
    }
    moveWatchExpression(id, position) {
        const we = this.watchExpressions.find(we => we.getId() === id);
        if (we) {
            this.watchExpressions = this.watchExpressions.filter(we => we.getId() !== id);
            this.watchExpressions = this.watchExpressions.slice(0, position).concat(we, this.watchExpressions.slice(position));
            this._onDidChangeWatchExpressions.fire(undefined);
        }
    }
    sourceIsNotAvailable(uri) {
        this.sessions.forEach(s => {
            const source = s.getSourceForUri(uri);
            if (source) {
                source.available = false;
            }
        });
        this._onDidChangeCallStack.fire(undefined);
    }
};
DebugModel = __decorate([
    __param(1, ITextFileService),
    __param(2, IUriIdentityService),
    __param(3, ILogService)
], DebugModel);
export { DebugModel };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWdNb2RlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9jb21tb24vZGVidWdNb2RlbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDN0QsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxlQUFlLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNyRixPQUFPLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxZQUFZLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN6RixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNsRixPQUFPLEVBQUUsT0FBTyxFQUFTLGVBQWUsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEtBQUssU0FBUyxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMvRSxPQUFPLEVBQUUsR0FBRyxFQUFjLE1BQU0sZ0NBQWdDLENBQUM7QUFDakUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQy9ELE9BQU8sRUFBVSxLQUFLLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN4RSxPQUFPLEtB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