/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DeferredPromise } from '../../../../../base/common/async.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { AbstractDebugAdapter } from '../../common/abstractDebugAdapter.js';
import { DebugStorage } from '../../common/debugStorage.js';
export class MockDebugService {
    get state() {
        throw new Error('not implemented');
    }
    get onWillNewSession() {
        throw new Error('not implemented');
    }
    get onDidNewSession() {
        throw new Error('not implemented');
    }
    get onDidEndSession() {
        throw new Error('not implemented');
    }
    get onDidChangeState() {
        throw new Error('not implemented');
    }
    getConfigurationManager() {
        throw new Error('not implemented');
    }
    getAdapterManager() {
        throw new Error('Method not implemented.');
    }
    canSetBreakpointsIn(model) {
        throw new Error('Method not implemented.');
    }
    focusStackFrame(focusedStackFrame) {
        throw new Error('not implemented');
    }
    sendAllBreakpoints(session) {
        throw new Error('not implemented');
    }
    sendBreakpoints(modelUri, sourceModified, session) {
        throw new Error('not implemented');
    }
    addBreakpoints(uri, rawBreakpoints) {
        throw new Error('not implemented');
    }
    updateBreakpoints(uri, data, sendOnResourceSaved) {
        throw new Error('not implemented');
    }
    enableOrDisableBreakpoints(enabled) {
        throw new Error('not implemented');
    }
    setBreakpointsActivated() {
        throw new Error('not implemented');
    }
    removeBreakpoints() {
        throw new Error('not implemented');
    }
    addInstructionBreakpoint(opts) {
        throw new Error('Method not implemented.');
    }
    removeInstructionBreakpoints(address) {
        throw new Error('Method not implemented.');
    }
    setExceptionBreakpointCondition(breakpoint, condition) {
        throw new Error('Method not implemented.');
    }
    setExceptionBreakpointsForSession(session, data) {
        throw new Error('Method not implemented.');
    }
    addFunctionBreakpoint() { }
    moveWatchExpression(id, position) { }
    updateFunctionBreakpoint(id, update) {
        throw new Error('not implemented');
    }
    removeFunctionBreakpoints(id) {
        throw new Error('not implemented');
    }
    addDataBreakpoint() {
        throw new Error('Method not implemented.');
    }
    updateDataBreakpoint(id, update) {
        throw new Error('not implemented');
    }
    removeDataBreakpoints(id) {
        throw new Error('Method not implemented.');
    }
    addReplExpression(name) {
        throw new Error('not implemented');
    }
    removeReplExpressions() { }
    addWatchExpression(name) {
        throw new Error('not implemented');
    }
    renameWatchExpression(id, newName) {
        throw new Error('not implemented');
    }
    removeWatchExpressions(id) { }
    startDebugging(launch, configOrName, options) {
        return Promise.resolve(true);
    }
    restartSession() {
        throw new Error('not implemented');
    }
    stopSession() {
        throw new Error('not implemented');
    }
    getModel() {
        throw new Error('not implemented');
    }
    getViewModel() {
        throw new Error('not implemented');
    }
    sourceIsNotAvailable(uri) { }
    tryToAutoFocusStackFrame(thread) {
        throw new Error('not implemented');
    }
    runTo(uri, lineNumber, column) {
        throw new Error('Method not implemented.');
    }
}
export class MockSession {
    constructor() {
        this.suppressDebugToolbar = false;
        this.suppressDebugStatusbar = false;
        this.suppressDebugView = false;
        this.autoExpandLazyVariables = false;
        this.configuration = { type: 'mock', name: 'mock', request: 'launch' };
        this.unresolvedConfiguration = { type: 'mock', name: 'mock', request: 'launch' };
        this.state = 2 /* State.Stopped */;
        this.capabilities = {};
    }
    dispose() {
    }
    getMemory(memoryReference) {
        throw new Error('Method not implemented.');
    }
    get onDidInvalidateMemory() {
        throw new Error('Not implemented');
    }
    readMemory(memoryReference, offset, count) {
        throw new Error('Method not implemented.');
    }
    writeMemory(memoryReference, offset, data, allowPartial) {
        throw new Error('Method not implemented.');
    }
    cancelCorrelatedTestRun() {
    }
    get compoundRoot() {
        return undefined;
    }
    get saveBeforeRestart() {
        return true;
    }
    get isSimpleUI() {
        return false;
    }
    get lifecycleManagedByParent() {
        return false;
    }
    stepInTargets(frameId) {
        throw new Error('Method not implemented.');
    }
    cancel(_progressId) {
        throw new Error('Method not implemented.');
    }
    breakpointsLocations(uri, lineNumber) {
        throw new Error('Method not implemented.');
    }
    dataBytesBreakpointInfo(address, bytes) {
        throw new Error('Method not implemented.');
    }
    dataBreakpointInfo(name, variablesReference, frameId) {
        throw new Error('Method not implemented.');
    }
    sendDataBreakpoints(dbps) {
        throw new Error('Method not implemented.');
    }
    get compact() {
        return false;
    }
    setSubId(subId) {
        throw new Error('Method not implemented.');
    }
    get parentSession() {
        return undefined;
    }
    getReplElements() {
        return [];
    }
    hasSeparateRepl() {
        return true;
    }
    removeReplExpressions() { }
    get onDidChangeReplElements() {
        throw new Error('not implemented');
    }
    addReplExpression(stackFrame, name) {
        return Promise.resolve(undefined);
    }
    appendToRepl(data) { }
    getId() {
        return 'mock';
    }
    getLabel() {
        return 'mockname';
    }
    get name() {
        return 'mockname';
    }
    setName(name) {
        throw new Error('not implemented');
    }
    getSourceForUri(modelUri) {
        throw new Error('not implemented');
    }
    getThread(threadId) {
        throw new Error('not implemented');
    }
    getStoppedDetails() {
        throw new Error('not implemented');
    }
    get onDidCustomEvent() {
        throw new Error('not implemented');
    }
    get onDidLoadedSource() {
        throw new Error('not implemented');
    }
    get onDidChangeState() {
        throw new Error('not implemented');
    }
    get onDidEndAdapter() {
        throw new Error('not implemented');
    }
    get onDidChangeName() {
        throw new Error('not implemented');
    }
    get onDidProgressStart() {
        throw new Error('not implemented');
    }
    get onDidProgressUpdate() {
        throw new Error('not implemented');
    }
    get onDidProgressEnd() {
        throw new Error('not implemented');
    }
    setConfiguration(configuration) { }
    getAllThreads() {
        return [];
    }
    getSource(raw) {
        throw new Error('not implemented');
    }
    getLoadedSources() {
        return Promise.resolve([]);
    }
    completions(frameId, threadId, text, position) {
        throw new Error('not implemented');
    }
    clearThreads(removeThreads, reference) { }
    rawUpdate(data) { }
    initialize(dbgr) {
        throw new Error('Method not implemented.');
    }
    launchOrAttach(config) {
        throw new Error('Method not implemented.');
    }
    restart() {
        throw new Error('Method not implemented.');
    }
    sendBreakpoints(modelUri, bpts, sourceModified) {
        throw new Error('Method not implemented.');
    }
    sendFunctionBreakpoints(fbps) {
        throw new Error('Method not implemented.');
    }
    sendExceptionBreakpoints(exbpts) {
        throw new Error('Method not implemented.');
    }
    sendInstructionBreakpoints(dbps) {
        throw new Error('Method not implemented.');
    }
    getDebugProtocolBreakpoint(breakpointId) {
        throw new Error('Method not implemented.');
    }
    customRequest(request, args) {
        throw new Error('Method not implemented.');
    }
    stackTrace(threadId, startFrame, levels, token) {
        throw new Error('Method not implemented.');
    }
    exceptionInfo(threadId) {
        throw new Error('Method not implemented.');
    }
    scopes(frameId) {
        throw new Error('Method not implemented.');
    }
    variables(variablesReference, threadId, filter, start, count) {
        throw new Error('Method not implemented.');
    }
    evaluate(expression, frameId, context) {
        throw new Error('Method not implemented.');
    }
    restartFrame(frameId, threadId) {
        throw new Error('Method not implemented.');
    }
    next(threadId, granularity) {
        throw new Error('Method not implemented.');
    }
    stepIn(threadId, targetId, granularity) {
        throw new Error('Method not implemented.');
    }
    stepOut(threadId, granularity) {
        throw new Error('Method not implemented.');
    }
    stepBack(threadId, granularity) {
        throw new Error('Method not implemented.');
    }
    continue(threadId) {
        throw new Error('Method not implemented.');
    }
    reverseContinue(threadId) {
        throw new Error('Method not implemented.');
    }
    pause(threadId) {
        throw new Error('Method not implemented.');
    }
    terminateThreads(threadIds) {
        throw new Error('Method not implemented.');
    }
    setVariable(variablesReference, name, value) {
        throw new Error('Method not implemented.');
    }
    setExpression(frameId, expression, value) {
        throw new Error('Method not implemented.');
    }
    loadSource(resource) {
        throw new Error('Method not implemented.');
    }
    disassemble(memoryReference, offset, instructionOffset, instructionCount) {
        throw new Error('Method not implemented.');
    }
    terminate(restart = false) {
        throw new Error('Method not implemented.');
    }
    disconnect(restart = false) {
        throw new Error('Method not implemented.');
    }
    gotoTargets(source, line, column) {
        throw new Error('Method not implemented.');
    }
    goto(threadId, targetId) {
        throw new Error('Method not implemented.');
    }
    resolveLocationReference(locationReference) {
        throw new Error('Method not implemented.');
    }
}
export class MockRawSession {
    constructor() {
        this.capabilities = {};
        this.disconnected = false;
        this.sessionLengthInSeconds = 0;
        this.readyForBreakpoints = true;
        this.emittedStopped = true;
        this.onDidStop = null;
    }
    getLengthInSeconds() {
        return 100;
    }
    stackTrace(args) {
        return Promise.resolve({
            seq: 1,
            type: 'response',
            request_seq: 1,
            success: true,
            command: 'stackTrace',
            body: {
                stackFrames: [{
                        id: 1,
                        name: 'mock',
                        line: 5,
                        column: 6
                    }]
            }
        });
    }
    exceptionInfo(args) {
        throw new Error('not implemented');
    }
    launchOrAttach(args) {
        throw new Error('not implemented');
    }
    scopes(args) {
        throw new Error('not implemented');
    }
    variables(args) {
        throw new Error('not implemented');
    }
    evaluate(args) {
        return Promise.resolve(null);
    }
    custom(request, args) {
        throw new Error('not implemented');
    }
    terminate(restart = false) {
        throw new Error('not implemented');
    }
    disconnect() {
        throw new Error('not implemented');
    }
    threads() {
        throw new Error('not implemented');
    }
    stepIn(args) {
        throw new Error('not implemented');
    }
    stepOut(args) {
        throw new Error('not implemented');
    }
    stepBack(args) {
        throw new Error('not implemented');
    }
    continue(args) {
        throw new Error('not implemented');
    }
    reverseContinue(args) {
        throw new Error('not implemented');
    }
    pause(args) {
        throw new Error('not implemented');
    }
    terminateThreads(args) {
        throw new Error('not implemented');
    }
    setVariable(args) {
        throw new Error('not implemented');
    }
    restartFrame(args) {
        throw new Error('not implemented');
    }
    completions(args) {
        throw new Error('not implemented');
    }
    next(args) {
        throw new Error('not implemented');
    }
    source(args) {
        throw new Error('not implemented');
    }
    loadedSources(args) {
        throw new Error('not implemented');
    }
    setBreakpoints(args) {
        throw new Error('not implemented');
    }
    setFunctionBreakpoints(args) {
        throw new Error('not implemented');
    }
    setExceptionBreakpoints(args) {
        throw new Error('not implemented');
    }
}
export class MockDebugAdapter extends AbstractDebugAdapter {
    constructor() {
        super(...arguments);
        this.seq = 0;
        this.pendingResponses = new Map();
    }
    startSession() {
        return Promise.resolve();
    }
    stopSession() {
        return Promise.resolve();
    }
    sendMessage(message) {
        if (message.type === 'request') {
            setTimeout(() => {
                const request = message;
                switch (request.command) {
                    case 'evaluate':
                        this.evaluate(request, request.arguments);
                        return;
                }
                this.sendResponseBody(request, {});
                return;
            }, 0);
        }
        else if (message.type === 'response') {
            const response = message;
            if (this.pendingResponses.has(response.command)) {
                this.pendingResponses.get(response.command).complete(response);
            }
        }
    }
    sendResponseBody(request, body) {
        const response = {
            seq: ++this.seq,
            type: 'response',
            request_seq: request.seq,
            command: request.command,
            success: true,
            body
        };
        this.acceptMessage(response);
    }
    sendEventBody(event, body) {
        const response = {
            seq: ++this.seq,
            type: 'event',
            event,
            body
        };
        this.acceptMessage(response);
    }
    waitForResponseFromClient(command) {
        const deferred = new DeferredPromise();
        if (this.pendingResponses.has(command)) {
            return this.pendingResponses.get(command).p;
        }
        this.pendingResponses.set(command, deferred);
        return deferred.p;
    }
    sendRequestBody(command, args) {
        const response = {
            seq: ++this.seq,
            type: 'request',
            command,
            arguments: args
        };
        this.acceptMessage(response);
    }
    evaluate(request, args) {
        if (args.expression.indexOf('before.') === 0) {
            this.sendEventBody('output', { output: args.expression });
        }
        this.sendResponseBody(request, {
            result: '=' + args.expression,
            variablesReference: 0
        });
        if (args.expression.indexOf('after.') === 0) {
            this.sendEventBody('output', { output: args.expression });
        }
    }
}
export class MockDebugStorage extends DebugStorage {
    constructor(storageService) {
        super(storageService, undefined, undefined, new NullLogService());
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja0RlYnVnLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2RlYnVnL3Rlc3QvY29tbW9uL21vY2tEZWJ1Zy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFNdEUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBRzNFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBSzVFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUU1RCxNQUFNLE9BQU8sZ0JBQWdCO0lBRzVCLElBQUksS0FBSztRQUNSLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsSUFBSSxnQkFBZ0I7UUFDbkIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxJQUFJLGVBQWU7UUFDbEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxJQUFJLGVBQWU7UUFDbEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxJQUFJLGdCQUFnQjtRQUNuQixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELHVCQUF1QjtRQUN0QixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELGlCQUFpQjtRQUNoQixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVELG1CQUFtQixDQUFDLEtBQWlCO1FBQ3BDLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBRUQsZUFBZSxDQUFDLGlCQUE4QjtRQUM3QyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELGtCQUFrQixDQUFDLE9BQXVCO1FBQ3pDLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsZUFBZSxDQUFDLFFBQWEsRUFBRSxjQUFvQyxFQUFFLE9BQW1DO1FBQ3ZHLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsY0FBYyxDQUFDLEdBQVEsRUFBRSxjQUFpQztRQUN6RCxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELGlCQUFpQixDQUFDLEdBQVEsRUFBRSxJQUF3QyxFQUFFLG1CQUE0QjtRQUNqRyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELDBCQUEwQixDQUFDLE9BQWdCO1FBQzFDLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsdUJBQXVCO1FBQ3RCLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsaUJBQWlCO1FBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsd0JBQXdCLENBQUMsSUFBbUM7UUFDM0QsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCw0QkFBNEIsQ0FBQyxPQUFnQjtRQUM1QyxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVELCtCQUErQixDQUFDLFVBQWdDLEVBQUUsU0FBaUI7UUFDbEYsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxpQ0FBaUMsQ0FBQyxPQUFzQixFQUFFLElBQWdEO1FBQ3pHLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBRUQscUJBQXFCLEtBQVcsQ0FBQztJQUVqQyxtQkFBbUIsQ0FBQyxFQUFVLEVBQUUsUUFBZ0IsSUFBVSxDQUFDO0lBRTNELHdCQUF3QixDQUFDLEVBQVUsRUFBRSxNQUFvRTtRQUN4RyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELHlCQUF5QixDQUFDLEVBQVc7UUFDcEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxpQkFBaUI7UUFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxvQkFBb0IsQ0FBQyxFQUFVLEVBQUUsTUFBcUQ7UUFDckYsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxxQkFBcUIsQ0FBQyxFQUF1QjtRQUM1QyxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVELGlCQUFpQixDQUFDLElBQVk7UUFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxxQkFBcUIsS0FBVyxDQUFDO0lBRWpDLGtCQUFrQixDQUFDLElBQWE7UUFDL0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxxQkFBcUIsQ0FBQyxFQUFVLEVBQUUsT0FBZTtRQUNoRCxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELHNCQUFzQixDQUFDLEVBQVcsSUFBVSxDQUFDO0lBRTdDLGNBQWMsQ0FBQyxNQUFlLEVBQUUsWUFBK0IsRUFBRSxPQUE4QjtRQUM5RixPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVELGNBQWM7UUFDYixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELFdBQVc7UUFDVixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELFFBQVE7UUFDUCxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELFlBQVk7UUFDWCxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELG9CQUFvQixDQUFDLEdBQVEsSUFBVSxDQUFDO0lBRXhDLHdCQUF3QixDQUFDLE1BQWU7UUFDdkMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxLQUFLLENBQUMsR0FBUSxFQUFFLFVBQWtCLEVBQUUsTUFBZTtRQUNsRCxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUNEO0FBRUQsTUFBTSxPQUFPLFdBQVc7SUFBeEI7UUFDVSx5QkFBb0IsR0FBRyxLQUFLLENBQUM7UUFDN0IsMkJBQXNCLEdBQUcsS0FBSyxDQUFDO1FBQy9CLHNCQUFpQixHQUFHLEtBQUssQ0FBQztRQUMxQiw0QkFBdUIsR0FBRyxLQUFLLENBQUM7UUFtR3pDLGtCQUFhLEdBQVksRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxDQUFDO1FBQzNFLDRCQUF1QixHQUFZLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsQ0FBQztRQUNyRixVQUFLLHlCQUFpQjtRQUV0QixpQkFBWSxHQUErQixFQUFFLENBQUM7SUFzTC9DLENBQUM7SUEzUkEsT0FBTztJQUVQLENBQUM7SUFFRCxTQUFTLENBQUMsZUFBdUI7UUFDaEMsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxJQUFJLHFCQUFxQjtRQUN4QixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELFVBQVUsQ0FBQyxlQUF1QixFQUFFLE1BQWMsRUFBRSxLQUFhO1FBQ2hFLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBRUQsV0FBVyxDQUFDLGVBQXVCLEVBQUUsTUFBYyxFQUFFLElBQVksRUFBRSxZQUFzQjtRQUN4RixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVELHVCQUF1QjtJQUV2QixDQUFDO0lBRUQsSUFBSSxZQUFZO1FBQ2YsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVELElBQUksaUJBQWlCO1FBQ3BCLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVELElBQUksVUFBVTtRQUNiLE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVELElBQUksd0JBQXdCO1FBQzNCLE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVELGFBQWEsQ0FBQyxPQUFlO1FBQzVCLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBRUQsTUFBTSxDQUFDLFdBQW1CO1FBQ3pCLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBRUQsb0JBQW9CLENBQUMsR0FBUSxFQUFFLFVBQWtCO1FBQ2hELE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBRUQsdUJBQXVCLENBQUMsT0FBZSxFQUFFLEtBQWE7UUFDckQsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxrQkFBa0IsQ0FBQyxJQUFZLEVBQUUsa0JBQXVDLEVBQUUsT0FBNEI7UUFDckcsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxtQkFBbUIsQ0FBQyxJQUF1QjtRQUMxQyxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUlELElBQUksT0FBTztRQUNWLE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVELFFBQVEsQ0FBQyxLQUF5QjtRQUNqQyxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVELElBQUksYUFBYTtRQUNoQixPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsZUFBZTtRQUNkLE9BQU8sRUFBRSxDQUFDO0lBQ1gsQ0FBQztJQUVELGVBQWU7UUFDZCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxxQkFBcUIsS0FBVyxDQUFDO0lBQ2pDLElBQUksdUJBQXVCO1FBQzFCLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsaUJBQWlCLENBQUMsVUFBdUIsRUFBRSxJQUFZO1FBQ3RELE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRUQsWUFBWSxDQUFDLElBQXlCLElBQVUsQ0FBQztJQVFqRCxLQUFLO1FBQ0osT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBRUQsUUFBUTtRQUNQLE9BQU8sVUFBVSxDQUFDO0lBQ25CLENBQUM7SUFFRCxJQUFJLElBQUk7UUFDUCxPQUFPLFVBQVUsQ0FBQztJQUNuQixDQUFDO0lBRUQsT0FBTyxDQUFDLElBQVk7UUFDbkIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxlQUFlLENBQUMsUUFBYTtRQUM1QixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELFNBQVMsQ0FBQyxRQUFnQjtRQUN6QixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELGlCQUFpQjtRQUNoQixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELElBQUksZ0JBQWdCO1FBQ25CLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsSUFBSSxpQkFBaUI7UUFDcEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxJQUFJLGdCQUFnQjtRQUNuQixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELElBQUksZUFBZTtRQUNsQixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELElBQUksZUFBZTtRQUNsQixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELElBQUksa0JBQWtCO1FBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsSUFBSSxtQkFBbUI7UUFDdEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxJQUFJLGdCQUFnQjtRQUNuQixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELGdCQUFnQixDQUFDLGFBQXlELElBQUksQ0FBQztJQUUvRSxhQUFhO1FBQ1osT0FBTyxFQUFFLENBQUM7SUFDWCxDQUFDO0lBRUQsU0FBUyxDQUFDLEdBQXlCO1FBQ2xDLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsZ0JBQWdCO1FBQ2YsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFFRCxXQUFXLENBQUMsT0FBZSxFQUFFLFFBQWdCLEVBQUUsSUFBWSxFQUFFLFFBQWtCO1FBQzlFLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsWUFBWSxDQUFDLGFBQXNCLEVBQUUsU0FBa0IsSUFBVSxDQUFDO0lBRWxFLFNBQVMsQ0FBQyxJQUFxQixJQUFVLENBQUM7SUFFMUMsVUFBVSxDQUFDLElBQWU7UUFDekIsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxjQUFjLENBQUMsTUFBZTtRQUM3QixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNELE9BQU87UUFDTixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNELGVBQWUsQ0FBQyxRQUFhLEVBQUUsSUFBbUIsRUFBRSxjQUF1QjtRQUMxRSxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNELHVCQUF1QixDQUFDLElBQTJCO1FBQ2xELE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ0Qsd0JBQXdCLENBQUMsTUFBOEI7UUFDdEQsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCwwQkFBMEIsQ0FBQyxJQUE4QjtRQUN4RCxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNELDBCQUEwQixDQUFDLFlBQW9CO1FBQzlDLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ0QsYUFBYSxDQUFDLE9BQWUsRUFBRSxJQUFTO1FBQ3ZDLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ0QsVUFBVSxDQUFDLFFBQWdCLEVBQUUsVUFBa0IsRUFBRSxNQUFjLEVBQUUsS0FBd0I7UUFDeEYsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxhQUFhLENBQUMsUUFBZ0I7UUFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxNQUFNLENBQUMsT0FBZTtRQUNyQixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNELFNBQVMsQ0FBQyxrQkFBMEIsRUFBRSxRQUE0QixFQUFFLE1BQTJCLEVBQUUsS0FBYSxFQUFFLEtBQWE7UUFDNUgsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxRQUFRLENBQUMsVUFBa0IsRUFBRSxPQUFlLEVBQUUsT0FBZ0I7UUFDN0QsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxZQUFZLENBQUMsT0FBZSxFQUFFLFFBQWdCO1FBQzdDLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ0QsSUFBSSxDQUFDLFFBQWdCLEVBQUUsV0FBK0M7UUFDckUsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxNQUFNLENBQUMsUUFBZ0IsRUFBRSxRQUFpQixFQUFFLFdBQStDO1FBQzFGLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ0QsT0FBTyxDQUFDLFFBQWdCLEVBQUUsV0FBK0M7UUFDeEUsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxRQUFRLENBQUMsUUFBZ0IsRUFBRSxXQUErQztRQUN6RSxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNELFFBQVEsQ0FBQyxRQUFnQjtRQUN4QixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNELGVBQWUsQ0FBQyxRQUFnQjtRQUMvQixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNELEtBQUssQ0FBQyxRQUFnQjtRQUNyQixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNELGdCQUFnQixDQUFDLFNBQW1CO1FBQ25DLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ0QsV0FBVyxDQUFDLGtCQUEwQixFQUFFLElBQVksRUFBRSxLQUFhO1FBQ2xFLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBQ0QsYUFBYSxDQUFDLE9BQWUsRUFBRSxVQUFrQixFQUFFLEtBQWE7UUFDL0QsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxVQUFVLENBQUMsUUFBYTtRQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNELFdBQVcsQ0FBQyxlQUF1QixFQUFFLE1BQWMsRUFBRSxpQkFBeUIsRUFBRSxnQkFBd0I7UUFDdkcsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxTQUFTLENBQUMsT0FBTyxHQUFHLEtBQUs7UUFDeEIsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxVQUFVLENBQUMsT0FBTyxHQUFHLEtBQUs7UUFDekIsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRCxXQUFXLENBQUMsTUFBNEIsRUFBRSxJQUFZLEVBQUUsTUFBMkI7UUFDbEYsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFDRCxJQUFJLENBQUMsUUFBZ0IsRUFBRSxRQUFnQjtRQUN0QyxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUNELHdCQUF3QixDQUFDLGlCQUF5QjtRQUNqRCxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUNEO0FBRUQsTUFBTSxPQUFPLGNBQWM7SUFBM0I7UUFFQyxpQkFBWSxHQUErQixFQUFFLENBQUM7UUFDOUMsaUJBQVksR0FBRyxLQUFLLENBQUM7UUFDckIsMkJBQXNCLEdBQVcsQ0FBQyxDQUFDO1FBRW5DLHdCQUFtQixHQUFHLElBQUksQ0FBQztRQUMzQixtQkFBYyxHQUFHLElBQUksQ0FBQztRQTRIYixjQUFTLEdBQXNDLElBQUssQ0FBQztJQUMvRCxDQUFDO0lBM0hBLGtCQUFrQjtRQUNqQixPQUFPLEdBQUcsQ0FBQztJQUNaLENBQUM7SUFFRCxVQUFVLENBQUMsSUFBdUM7UUFDakQsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDO1lBQ3RCLEdBQUcsRUFBRSxDQUFDO1lBQ04sSUFBSSxFQUFFLFVBQVU7WUFDaEIsV0FBVyxFQUFFLENBQUM7WUFDZCxPQUFPLEVBQUUsSUFBSTtZQUNiLE9BQU8sRUFBRSxZQUFZO1lBQ3JCLElBQUksRUFBRTtnQkFDTCxXQUFXLEVBQUUsQ0FBQzt3QkFDYixFQUFFLEVBQUUsQ0FBQzt3QkFDTCxJQUFJLEVBQUUsTUFBTTt3QkFDWixJQUFJLEVBQUUsQ0FBQzt3QkFDUCxNQUFNLEVBQUUsQ0FBQztxQkFDVCxDQUFDO2FBQ0Y7U0FDRCxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsYUFBYSxDQUFDLElBQTBDO1FBQ3ZELE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsY0FBYyxDQUFDLElBQWE7UUFDM0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxNQUFNLENBQUMsSUFBbUM7UUFDekMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxTQUFTLENBQUMsSUFBc0M7UUFDL0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxRQUFRLENBQUMsSUFBcUM7UUFDN0MsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUssQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRCxNQUFNLENBQUMsT0FBZSxFQUFFLElBQVM7UUFDaEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxTQUFTLENBQUMsT0FBTyxHQUFHLEtBQUs7UUFDeEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxVQUFVO1FBQ1QsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxPQUFPO1FBQ04sTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxNQUFNLENBQUMsSUFBbUM7UUFDekMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxPQUFPLENBQUMsSUFBb0M7UUFDM0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxRQUFRLENBQUMsSUFBcUM7UUFDN0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxRQUFRLENBQUMsSUFBcUM7UUFDN0MsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxlQUFlLENBQUMsSUFBNEM7UUFDM0QsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxLQUFLLENBQUMsSUFBa0M7UUFDdkMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxnQkFBZ0IsQ0FBQyxJQUE2QztRQUM3RCxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELFdBQVcsQ0FBQyxJQUF3QztRQUNuRCxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELFlBQVksQ0FBQyxJQUF5QztRQUNyRCxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELFdBQVcsQ0FBQyxJQUF3QztRQUNuRCxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELElBQUksQ0FBQyxJQUFpQztRQUNyQyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELE1BQU0sQ0FBQyxJQUFtQztRQUN6QyxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELGFBQWEsQ0FBQyxJQUEwQztRQUN2RCxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELGNBQWMsQ0FBQyxJQUEyQztRQUN6RCxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELHNCQUFzQixDQUFDLElBQW1EO1FBQ3pFLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsdUJBQXVCLENBQUMsSUFBb0Q7UUFDM0UsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7Q0FHRDtBQUVELE1BQU0sT0FBTyxnQkFBaUIsU0FBUSxvQkFBb0I7SUFBMUQ7O1FBQ1MsUUFBRyxHQUFHLENBQUMsQ0FBQztRQUVSLHFCQUFnQixHQUFHLElBQUksR0FBRyxFQUFtRCxDQUFDO0lBc0Z2RixDQUFDO0lBcEZBLFlBQVk7UUFDWCxPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUMxQixDQUFDO0lBRUQsV0FBVztRQUNWLE9BQU8sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQzFCLENBQUM7SUFFRCxXQUFXLENBQUMsT0FBc0M7UUFDakQsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ2hDLFVBQVUsQ0FBQyxHQUFHLEVBQUU7Z0JBQ2YsTUFBTSxPQUFPLEdBQUcsT0FBZ0MsQ0FBQztnQkFDakQsUUFBUSxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQ3pCLEtBQUssVUFBVTt3QkFDZCxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7d0JBQzFDLE9BQU87Z0JBQ1QsQ0FBQztnQkFDRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUNuQyxPQUFPO1lBQ1IsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQzthQUFNLElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxVQUFVLEVBQUUsQ0FBQztZQUN4QyxNQUFNLFFBQVEsR0FBRyxPQUFpQyxDQUFDO1lBQ25ELElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztnQkFDakQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFFLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2pFLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVELGdCQUFnQixDQUFDLE9BQThCLEVBQUUsSUFBUztRQUN6RCxNQUFNLFFBQVEsR0FBMkI7WUFDeEMsR0FBRyxFQUFFLEVBQUUsSUFBSSxDQUFDLEdBQUc7WUFDZixJQUFJLEVBQUUsVUFBVTtZQUNoQixXQUFXLEVBQUUsT0FBTyxDQUFDLEdBQUc7WUFDeEIsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPO1lBQ3hCLE9BQU8sRUFBRSxJQUFJO1lBQ2IsSUFBSTtTQUNKLENBQUM7UUFDRixJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFRCxhQUFhLENBQUMsS0FBYSxFQUFFLElBQVM7UUFDckMsTUFBTSxRQUFRLEdBQXdCO1lBQ3JDLEdBQUcsRUFBRSxFQUFFLElBQUksQ0FBQyxHQUFHO1lBQ2YsSUFBSSxFQUFFLE9BQU87WUFDYixLQUFLO1lBQ0wsSUFBSTtTQUNKLENBQUM7UUFDRixJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFRCx5QkFBeUIsQ0FBQyxPQUFlO1FBQ3hDLE1BQU0sUUFBUSxHQUFHLElBQUksZUFBZSxFQUEwQixDQUFDO1FBQy9ELElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ3hDLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUUsQ0FBQyxDQUFDLENBQUM7UUFDOUMsQ0FBQztRQUVELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzdDLE9BQU8sUUFBUSxDQUFDLENBQUMsQ0FBQztJQUNuQixDQUFDO0lBRUQsZUFBZSxDQUFDLE9BQWUsRUFBRSxJQUFTO1FBQ3pDLE1BQU0sUUFBUSxHQUEwQjtZQUN2QyxHQUFHLEVBQUUsRUFBRSxJQUFJLENBQUMsR0FBRztZQUNmLElBQUksRUFBRSxTQUFTO1lBQ2YsT0FBTztZQUNQLFNBQVMsRUFBRSxJQUFJO1NBQ2YsQ0FBQztRQUNGLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVELFFBQVEsQ0FBQyxPQUE4QixFQUFFLElBQXFDO1FBQzdFLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDOUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDM0QsQ0FBQztRQUVELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUU7WUFDOUIsTUFBTSxFQUFFLEdBQUcsR0FBRyxJQUFJLENBQUMsVUFBVTtZQUM3QixrQkFBa0IsRUFBRSxDQUFDO1NBQ3JCLENBQUMsQ0FBQztRQUVILElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDN0MsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUUsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDM0QsQ0FBQztJQUNGLENBQUM7Q0FDRDtBQUVELE1BQU0sT0FBTyxnQkFBaUIsU0FBUSxZQUFZO0lBRWpELFlBQVksY0FBK0I7UUFDMUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxTQUFVLEVBQUUsU0FBVSxFQUFFLElBQUksY0FBYyxFQUFFLENBQUMsQ0FBQztJQUNyRSxDQUFDO0NBQ0QifQ==