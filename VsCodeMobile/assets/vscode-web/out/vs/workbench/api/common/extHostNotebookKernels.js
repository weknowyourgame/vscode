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
import { asArray } from '../../../base/common/arrays.js';
import { DeferredPromise, timeout } from '../../../base/common/async.js';
import { CancellationTokenSource } from '../../../base/common/cancellation.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../base/common/map.js';
import { URI } from '../../../base/common/uri.js';
import { ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { MainContext } from './extHost.protocol.js';
import { ApiCommand, ApiCommandArgument, ApiCommandResult } from './extHostCommands.js';
import * as extHostTypeConverters from './extHostTypeConverters.js';
import { NotebookCellOutput, NotebookControllerAffinity2, NotebookVariablesRequestKind } from './extHostTypes.js';
import { asWebviewUri } from '../../contrib/webview/common/webview.js';
import { CellExecutionUpdateType } from '../../contrib/notebook/common/notebookExecutionService.js';
import { checkProposedApiEnabled } from '../../services/extensions/common/extensions.js';
import { SerializableObjectWithBuffers } from '../../services/extensions/common/proxyIdentifier.js';
import { variablePageSize } from '../../contrib/notebook/common/notebookKernelService.js';
let ExtHostNotebookKernels = class ExtHostNotebookKernels {
    constructor(mainContext, _initData, _extHostNotebook, _commands, _logService) {
        this._initData = _initData;
        this._extHostNotebook = _extHostNotebook;
        this._commands = _commands;
        this._logService = _logService;
        this._activeExecutions = new ResourceMap();
        this._activeNotebookExecutions = new ResourceMap();
        this._kernelDetectionTask = new Map();
        this._kernelDetectionTaskHandlePool = 0;
        this._kernelSourceActionProviders = new Map();
        this._kernelSourceActionProviderHandlePool = 0;
        this._kernelData = new Map();
        this._handlePool = 0;
        this.id = 0;
        this.variableStore = {};
        this._proxy = mainContext.getProxy(MainContext.MainThreadNotebookKernels);
        // todo@rebornix @joyceerhl: move to APICommands once stabilized.
        const selectKernelApiCommand = new ApiCommand('notebook.selectKernel', '_notebook.selectKernel', 'Trigger kernel picker for specified notebook editor widget', [
            new ApiCommandArgument('options', 'Select kernel options', v => true, (v) => {
                if (v && 'notebookEditor' in v && 'id' in v) {
                    const notebookEditorId = this._extHostNotebook.getIdByEditor(v.notebookEditor);
                    return {
                        id: v.id, extension: v.extension, notebookEditorId
                    };
                }
                else if (v && 'notebookEditor' in v) {
                    const notebookEditorId = this._extHostNotebook.getIdByEditor(v.notebookEditor);
                    if (notebookEditorId === undefined) {
                        throw new Error(`Cannot invoke 'notebook.selectKernel' for unrecognized notebook editor ${v.notebookEditor.notebook.uri.toString()}`);
                    }
                    if ('skipIfAlreadySelected' in v) {
                        return { notebookEditorId, skipIfAlreadySelected: v.skipIfAlreadySelected };
                    }
                    return { notebookEditorId };
                }
                return v;
            })
        ], ApiCommandResult.Void);
        const requestKernelVariablesApiCommand = new ApiCommand('vscode.executeNotebookVariableProvider', '_executeNotebookVariableProvider', 'Execute notebook variable provider', [ApiCommandArgument.Uri], new ApiCommandResult('A promise that resolves to an array of variables', (value, apiArgs) => {
            return value.map(variable => {
                return {
                    variable: {
                        name: variable.name,
                        value: variable.value,
                        expression: variable.expression,
                        type: variable.type,
                        language: variable.language
                    },
                    hasNamedChildren: variable.hasNamedChildren,
                    indexedChildrenCount: variable.indexedChildrenCount
                };
            });
        }));
        this._commands.registerApiCommand(selectKernelApiCommand);
        this._commands.registerApiCommand(requestKernelVariablesApiCommand);
    }
    createNotebookController(extension, id, viewType, label, handler, preloads) {
        for (const data of this._kernelData.values()) {
            if (data.controller.id === id && ExtensionIdentifier.equals(extension.identifier, data.extensionId)) {
                throw new Error(`notebook controller with id '${id}' ALREADY exist`);
            }
        }
        const handle = this._handlePool++;
        const that = this;
        this._logService.trace(`NotebookController[${handle}], CREATED by ${extension.identifier.value}, ${id}`);
        const _defaultExecutHandler = () => console.warn(`NO execute handler from notebook controller '${data.id}' of extension: '${extension.identifier}'`);
        let isDisposed = false;
        const onDidChangeSelection = new Emitter();
        const onDidReceiveMessage = new Emitter();
        const data = {
            id: createKernelId(extension.identifier, id),
            notebookType: viewType,
            extensionId: extension.identifier,
            extensionLocation: extension.extensionLocation,
            label: label || extension.identifier.value,
            preloads: preloads ? preloads.map(extHostTypeConverters.NotebookRendererScript.from) : []
        };
        //
        let _executeHandler = handler ?? _defaultExecutHandler;
        let _interruptHandler;
        let _variableProvider;
        this._proxy.$addKernel(handle, data).catch(err => {
            // this can happen when a kernel with that ID is already registered
            console.log(err);
            isDisposed = true;
        });
        // update: all setters write directly into the dto object
        // and trigger an update. the actual update will only happen
        // once per event loop execution
        let tokenPool = 0;
        const _update = () => {
            if (isDisposed) {
                return;
            }
            const myToken = ++tokenPool;
            Promise.resolve().then(() => {
                if (myToken === tokenPool) {
                    this._proxy.$updateKernel(handle, data);
                }
            });
        };
        // notebook documents that are associated to this controller
        const associatedNotebooks = new ResourceMap();
        const controller = {
            get id() { return id; },
            get notebookType() { return data.notebookType; },
            onDidChangeSelectedNotebooks: onDidChangeSelection.event,
            get label() {
                return data.label;
            },
            set label(value) {
                data.label = value ?? extension.displayName ?? extension.name;
                _update();
            },
            get detail() {
                return data.detail ?? '';
            },
            set detail(value) {
                data.detail = value;
                _update();
            },
            get description() {
                return data.description ?? '';
            },
            set description(value) {
                data.description = value;
                _update();
            },
            get supportedLanguages() {
                return data.supportedLanguages;
            },
            set supportedLanguages(value) {
                data.supportedLanguages = value;
                _update();
            },
            get supportsExecutionOrder() {
                return data.supportsExecutionOrder ?? false;
            },
            set supportsExecutionOrder(value) {
                data.supportsExecutionOrder = value;
                _update();
            },
            get rendererScripts() {
                return data.preloads ? data.preloads.map(extHostTypeConverters.NotebookRendererScript.to) : [];
            },
            get executeHandler() {
                return _executeHandler;
            },
            set executeHandler(value) {
                _executeHandler = value ?? _defaultExecutHandler;
            },
            get interruptHandler() {
                return _interruptHandler;
            },
            set interruptHandler(value) {
                _interruptHandler = value;
                data.supportsInterrupt = Boolean(value);
                _update();
            },
            set variableProvider(value) {
                checkProposedApiEnabled(extension, 'notebookVariableProvider');
                _variableProvider = value;
                data.hasVariableProvider = !!value;
                value?.onDidChangeVariables(e => that._proxy.$variablesUpdated(e.uri));
                _update();
            },
            get variableProvider() {
                return _variableProvider;
            },
            createNotebookCellExecution(cell) {
                if (isDisposed) {
                    throw new Error('notebook controller is DISPOSED');
                }
                if (!associatedNotebooks.has(cell.notebook.uri)) {
                    that._logService.trace(`NotebookController[${handle}] NOT associated to notebook, associated to THESE notebooks:`, Array.from(associatedNotebooks.keys()).map(u => u.toString()));
                    throw new Error(`notebook controller is NOT associated to notebook: ${cell.notebook.uri.toString()}`);
                }
                return that._createNotebookCellExecution(cell, createKernelId(extension.identifier, this.id));
            },
            createNotebookExecution(notebook) {
                checkProposedApiEnabled(extension, 'notebookExecution');
                if (isDisposed) {
                    throw new Error('notebook controller is DISPOSED');
                }
                if (!associatedNotebooks.has(notebook.uri)) {
                    that._logService.trace(`NotebookController[${handle}] NOT associated to notebook, associated to THESE notebooks:`, Array.from(associatedNotebooks.keys()).map(u => u.toString()));
                    throw new Error(`notebook controller is NOT associated to notebook: ${notebook.uri.toString()}`);
                }
                return that._createNotebookExecution(notebook, createKernelId(extension.identifier, this.id));
            },
            dispose: () => {
                if (!isDisposed) {
                    this._logService.trace(`NotebookController[${handle}], DISPOSED`);
                    isDisposed = true;
                    this._kernelData.delete(handle);
                    onDidChangeSelection.dispose();
                    onDidReceiveMessage.dispose();
                    this._proxy.$removeKernel(handle);
                }
            },
            // --- priority
            updateNotebookAffinity(notebook, priority) {
                if (priority === NotebookControllerAffinity2.Hidden) {
                    // This api only adds an extra enum value, the function is the same, so just gate on the new value being passed
                    // for proposedAPI check.
                    checkProposedApiEnabled(extension, 'notebookControllerAffinityHidden');
                }
                that._proxy.$updateNotebookPriority(handle, notebook.uri, priority);
            },
            // --- ipc
            onDidReceiveMessage: onDidReceiveMessage.event,
            postMessage(message, editor) {
                checkProposedApiEnabled(extension, 'notebookMessaging');
                return that._proxy.$postMessage(handle, editor && that._extHostNotebook.getIdByEditor(editor), message);
            },
            asWebviewUri(uri) {
                checkProposedApiEnabled(extension, 'notebookMessaging');
                return asWebviewUri(uri, that._initData.remote);
            },
        };
        this._kernelData.set(handle, {
            extensionId: extension.identifier,
            controller,
            onDidReceiveMessage,
            onDidChangeSelection,
            associatedNotebooks
        });
        return controller;
    }
    getIdByController(controller) {
        for (const [_, candidate] of this._kernelData) {
            if (candidate.controller === controller) {
                return createKernelId(candidate.extensionId, controller.id);
            }
        }
        return null;
    }
    createNotebookControllerDetectionTask(extension, viewType) {
        const handle = this._kernelDetectionTaskHandlePool++;
        const that = this;
        this._logService.trace(`NotebookControllerDetectionTask[${handle}], CREATED by ${extension.identifier.value}`);
        this._proxy.$addKernelDetectionTask(handle, viewType);
        const detectionTask = {
            dispose: () => {
                this._kernelDetectionTask.delete(handle);
                that._proxy.$removeKernelDetectionTask(handle);
            }
        };
        this._kernelDetectionTask.set(handle, detectionTask);
        return detectionTask;
    }
    registerKernelSourceActionProvider(extension, viewType, provider) {
        const handle = this._kernelSourceActionProviderHandlePool++;
        const eventHandle = typeof provider.onDidChangeNotebookKernelSourceActions === 'function' ? handle : undefined;
        const that = this;
        this._kernelSourceActionProviders.set(handle, provider);
        this._logService.trace(`NotebookKernelSourceActionProvider[${handle}], CREATED by ${extension.identifier.value}`);
        this._proxy.$addKernelSourceActionProvider(handle, handle, viewType);
        let subscription;
        if (eventHandle !== undefined) {
            subscription = provider.onDidChangeNotebookKernelSourceActions(_ => this._proxy.$emitNotebookKernelSourceActionsChangeEvent(eventHandle));
        }
        return {
            dispose: () => {
                this._kernelSourceActionProviders.delete(handle);
                that._proxy.$removeKernelSourceActionProvider(handle, handle);
                subscription?.dispose();
            }
        };
    }
    async $provideKernelSourceActions(handle, token) {
        const provider = this._kernelSourceActionProviders.get(handle);
        if (provider) {
            const disposables = new DisposableStore();
            const ret = await provider.provideNotebookKernelSourceActions(token);
            return (ret ?? []).map(item => extHostTypeConverters.NotebookKernelSourceAction.from(item, this._commands.converter, disposables));
        }
        return [];
    }
    $acceptNotebookAssociation(handle, uri, value) {
        const obj = this._kernelData.get(handle);
        if (obj) {
            // update data structure
            const notebook = this._extHostNotebook.getNotebookDocument(URI.revive(uri));
            if (value) {
                obj.associatedNotebooks.set(notebook.uri, true);
            }
            else {
                obj.associatedNotebooks.delete(notebook.uri);
            }
            this._logService.trace(`NotebookController[${handle}] ASSOCIATE notebook`, notebook.uri.toString(), value);
            // send event
            obj.onDidChangeSelection.fire({
                selected: value,
                notebook: notebook.apiNotebook
            });
        }
    }
    async $executeCells(handle, uri, handles) {
        const obj = this._kernelData.get(handle);
        if (!obj) {
            // extension can dispose kernels in the meantime
            return;
        }
        const document = this._extHostNotebook.getNotebookDocument(URI.revive(uri));
        const cells = [];
        for (const cellHandle of handles) {
            const cell = document.getCell(cellHandle);
            if (cell) {
                cells.push(cell.apiCell);
            }
        }
        try {
            this._logService.trace(`NotebookController[${handle}] EXECUTE cells`, document.uri.toString(), cells.length);
            await obj.controller.executeHandler.call(obj.controller, cells, document.apiNotebook, obj.controller);
        }
        catch (err) {
            //
            this._logService.error(`NotebookController[${handle}] execute cells FAILED`, err);
            console.error(err);
        }
    }
    async $cancelCells(handle, uri, handles) {
        const obj = this._kernelData.get(handle);
        if (!obj) {
            // extension can dispose kernels in the meantime
            return;
        }
        // cancel or interrupt depends on the controller. When an interrupt handler is used we
        // don't trigger the cancelation token of executions.
        const document = this._extHostNotebook.getNotebookDocument(URI.revive(uri));
        if (obj.controller.interruptHandler) {
            await obj.controller.interruptHandler.call(obj.controller, document.apiNotebook);
        }
        else {
            for (const cellHandle of handles) {
                const cell = document.getCell(cellHandle);
                if (cell) {
                    this._activeExecutions.get(cell.uri)?.cancel();
                }
            }
        }
        if (obj.controller.interruptHandler) {
            // If we're interrupting all cells, we also need to cancel the notebook level execution.
            const items = this._activeNotebookExecutions.get(document.uri);
            this._activeNotebookExecutions.delete(document.uri);
            if (handles.length && Array.isArray(items) && items.length) {
                items.forEach(d => d.dispose());
            }
        }
    }
    async $provideVariables(handle, requestId, notebookUri, parentId, kind, start, token) {
        const obj = this._kernelData.get(handle);
        if (!obj) {
            return;
        }
        const document = this._extHostNotebook.getNotebookDocument(URI.revive(notebookUri));
        const variableProvider = obj.controller.variableProvider;
        if (!variableProvider) {
            return;
        }
        let parent = undefined;
        if (parentId !== undefined) {
            parent = this.variableStore[parentId];
            if (!parent) {
                // request for unknown parent
                return;
            }
        }
        else {
            // root request, clear store
            this.variableStore = {};
        }
        const requestKind = kind === 'named' ? NotebookVariablesRequestKind.Named : NotebookVariablesRequestKind.Indexed;
        const variableResults = variableProvider.provideVariables(document.apiNotebook, parent, requestKind, start, token);
        let resultCount = 0;
        for await (const result of variableResults) {
            if (token.isCancellationRequested) {
                return;
            }
            const variable = {
                id: this.id++,
                name: result.variable.name,
                value: result.variable.value,
                type: result.variable.type,
                interfaces: result.variable.interfaces,
                language: result.variable.language,
                expression: result.variable.expression,
                hasNamedChildren: result.hasNamedChildren,
                indexedChildrenCount: result.indexedChildrenCount,
                extensionId: obj.extensionId.value,
            };
            this.variableStore[variable.id] = result.variable;
            this._proxy.$receiveVariable(requestId, variable);
            if (resultCount++ >= variablePageSize) {
                return;
            }
        }
    }
    $acceptKernelMessageFromRenderer(handle, editorId, message) {
        const obj = this._kernelData.get(handle);
        if (!obj) {
            // extension can dispose kernels in the meantime
            return;
        }
        const editor = this._extHostNotebook.getEditorById(editorId);
        obj.onDidReceiveMessage.fire(Object.freeze({ editor: editor.apiEditor, message }));
    }
    // ---
    _createNotebookCellExecution(cell, controllerId) {
        if (cell.index < 0) {
            throw new Error('CANNOT execute cell that has been REMOVED from notebook');
        }
        const notebook = this._extHostNotebook.getNotebookDocument(cell.notebook.uri);
        const cellObj = notebook.getCellFromApiCell(cell);
        if (!cellObj) {
            throw new Error('invalid cell');
        }
        if (this._activeExecutions.has(cellObj.uri)) {
            throw new Error(`duplicate execution for ${cellObj.uri}`);
        }
        const execution = new NotebookCellExecutionTask(controllerId, cellObj, this._proxy);
        this._activeExecutions.set(cellObj.uri, execution);
        const listener = execution.onDidChangeState(() => {
            if (execution.state === NotebookCellExecutionTaskState.Resolved) {
                execution.dispose();
                listener.dispose();
                this._activeExecutions.delete(cellObj.uri);
            }
        });
        return execution.asApiObject();
    }
    // ---
    _createNotebookExecution(nb, controllerId) {
        const notebook = this._extHostNotebook.getNotebookDocument(nb.uri);
        const runningCell = nb.getCells().find(cell => {
            const apiCell = notebook.getCellFromApiCell(cell);
            return apiCell && this._activeExecutions.has(apiCell.uri);
        });
        if (runningCell) {
            throw new Error(`duplicate cell execution for ${runningCell.document.uri}`);
        }
        if (this._activeNotebookExecutions.has(notebook.uri)) {
            throw new Error(`duplicate notebook execution for ${notebook.uri}`);
        }
        const execution = new NotebookExecutionTask(controllerId, notebook, this._proxy);
        const listener = execution.onDidChangeState(() => {
            if (execution.state === NotebookExecutionTaskState.Resolved) {
                execution.dispose();
                listener.dispose();
                this._activeNotebookExecutions.delete(notebook.uri);
            }
        });
        this._activeNotebookExecutions.set(notebook.uri, [execution, listener]);
        return execution.asApiObject();
    }
};
ExtHostNotebookKernels = __decorate([
    __param(4, ILogService)
], ExtHostNotebookKernels);
export { ExtHostNotebookKernels };
var NotebookCellExecutionTaskState;
(function (NotebookCellExecutionTaskState) {
    NotebookCellExecutionTaskState[NotebookCellExecutionTaskState["Init"] = 0] = "Init";
    NotebookCellExecutionTaskState[NotebookCellExecutionTaskState["Started"] = 1] = "Started";
    NotebookCellExecutionTaskState[NotebookCellExecutionTaskState["Resolved"] = 2] = "Resolved";
})(NotebookCellExecutionTaskState || (NotebookCellExecutionTaskState = {}));
class NotebookCellExecutionTask extends Disposable {
    static { this.HANDLE = 0; }
    get state() { return this._state; }
    constructor(controllerId, _cell, _proxy) {
        super();
        this._cell = _cell;
        this._proxy = _proxy;
        this._handle = NotebookCellExecutionTask.HANDLE++;
        this._onDidChangeState = new Emitter();
        this.onDidChangeState = this._onDidChangeState.event;
        this._state = NotebookCellExecutionTaskState.Init;
        this._tokenSource = this._register(new CancellationTokenSource());
        this._collector = new TimeoutBasedCollector(10, updates => this.update(updates));
        this._executionOrder = _cell.internalMetadata.executionOrder;
        this._proxy.$createExecution(this._handle, controllerId, this._cell.notebook.uri, this._cell.handle);
    }
    cancel() {
        this._tokenSource.cancel();
    }
    async updateSoon(update) {
        await this._collector.addItem(update);
    }
    async update(update) {
        const updates = Array.isArray(update) ? update : [update];
        return this._proxy.$updateExecution(this._handle, new SerializableObjectWithBuffers(updates));
    }
    verifyStateForOutput() {
        if (this._state === NotebookCellExecutionTaskState.Init) {
            throw new Error('Must call start before modifying cell output');
        }
        if (this._state === NotebookCellExecutionTaskState.Resolved) {
            throw new Error('Cannot modify cell output after calling resolve');
        }
    }
    cellIndexToHandle(cellOrCellIndex) {
        let cell = this._cell;
        if (cellOrCellIndex) {
            cell = this._cell.notebook.getCellFromApiCell(cellOrCellIndex);
        }
        if (!cell) {
            throw new Error('INVALID cell');
        }
        return cell.handle;
    }
    validateAndConvertOutputs(items) {
        return items.map(output => {
            const newOutput = NotebookCellOutput.ensureUniqueMimeTypes(output.items, true);
            if (newOutput === output.items) {
                return extHostTypeConverters.NotebookCellOutput.from(output);
            }
            return extHostTypeConverters.NotebookCellOutput.from({
                items: newOutput,
                id: output.id,
                metadata: output.metadata
            });
        });
    }
    async updateOutputs(outputs, cell, append) {
        const handle = this.cellIndexToHandle(cell);
        const outputDtos = this.validateAndConvertOutputs(asArray(outputs));
        return this.updateSoon({
            editType: CellExecutionUpdateType.Output,
            cellHandle: handle,
            append,
            outputs: outputDtos
        });
    }
    async updateOutputItems(items, output, append) {
        items = NotebookCellOutput.ensureUniqueMimeTypes(asArray(items), true);
        return this.updateSoon({
            editType: CellExecutionUpdateType.OutputItems,
            items: items.map(extHostTypeConverters.NotebookCellOutputItem.from),
            outputId: output.id,
            append
        });
    }
    asApiObject() {
        const that = this;
        const result = {
            get token() { return that._tokenSource.token; },
            get cell() { return that._cell.apiCell; },
            get executionOrder() { return that._executionOrder; },
            set executionOrder(v) {
                that._executionOrder = v;
                that.update([{
                        editType: CellExecutionUpdateType.ExecutionState,
                        executionOrder: that._executionOrder
                    }]);
            },
            start(startTime) {
                if (that._state === NotebookCellExecutionTaskState.Resolved || that._state === NotebookCellExecutionTaskState.Started) {
                    throw new Error('Cannot call start again');
                }
                that._state = NotebookCellExecutionTaskState.Started;
                that._onDidChangeState.fire();
                that.update({
                    editType: CellExecutionUpdateType.ExecutionState,
                    runStartTime: startTime
                });
            },
            end(success, endTime, executionError) {
                if (that._state === NotebookCellExecutionTaskState.Resolved) {
                    throw new Error('Cannot call resolve twice');
                }
                that._state = NotebookCellExecutionTaskState.Resolved;
                that._onDidChangeState.fire();
                // The last update needs to be ordered correctly and applied immediately,
                // so we use updateSoon and immediately flush.
                that._collector.flush();
                const error = createSerializeableError(executionError);
                that._proxy.$completeExecution(that._handle, new SerializableObjectWithBuffers({
                    runEndTime: endTime,
                    lastRunSuccess: success,
                    error
                }));
            },
            clearOutput(cell) {
                that.verifyStateForOutput();
                return that.updateOutputs([], cell, false);
            },
            appendOutput(outputs, cell) {
                that.verifyStateForOutput();
                return that.updateOutputs(outputs, cell, true);
            },
            replaceOutput(outputs, cell) {
                that.verifyStateForOutput();
                return that.updateOutputs(outputs, cell, false);
            },
            appendOutputItems(items, output) {
                that.verifyStateForOutput();
                return that.updateOutputItems(items, output, true);
            },
            replaceOutputItems(items, output) {
                that.verifyStateForOutput();
                return that.updateOutputItems(items, output, false);
            }
        };
        return Object.freeze(result);
    }
}
function createSerializeableError(executionError) {
    const convertRange = (range) => (range ? {
        startLineNumber: range.start.line,
        startColumn: range.start.character,
        endLineNumber: range.end.line,
        endColumn: range.end.character
    } : undefined);
    const convertStackFrame = (frame) => ({
        uri: frame.uri,
        position: frame.position,
        label: frame.label
    });
    const error = executionError ? {
        name: executionError.name,
        message: executionError.message,
        stack: executionError.stack instanceof Array
            ? executionError.stack.map(frame => convertStackFrame(frame))
            : executionError.stack,
        location: convertRange(executionError.location),
        uri: executionError.uri
    } : undefined;
    return error;
}
var NotebookExecutionTaskState;
(function (NotebookExecutionTaskState) {
    NotebookExecutionTaskState[NotebookExecutionTaskState["Init"] = 0] = "Init";
    NotebookExecutionTaskState[NotebookExecutionTaskState["Started"] = 1] = "Started";
    NotebookExecutionTaskState[NotebookExecutionTaskState["Resolved"] = 2] = "Resolved";
})(NotebookExecutionTaskState || (NotebookExecutionTaskState = {}));
class NotebookExecutionTask extends Disposable {
    static { this.HANDLE = 0; }
    get state() { return this._state; }
    constructor(controllerId, _notebook, _proxy) {
        super();
        this._notebook = _notebook;
        this._proxy = _proxy;
        this._handle = NotebookExecutionTask.HANDLE++;
        this._onDidChangeState = new Emitter();
        this.onDidChangeState = this._onDidChangeState.event;
        this._state = NotebookExecutionTaskState.Init;
        this._tokenSource = this._register(new CancellationTokenSource());
        this._proxy.$createNotebookExecution(this._handle, controllerId, this._notebook.uri);
    }
    cancel() {
        this._tokenSource.cancel();
    }
    asApiObject() {
        const result = {
            start: () => {
                if (this._state === NotebookExecutionTaskState.Resolved || this._state === NotebookExecutionTaskState.Started) {
                    throw new Error('Cannot call start again');
                }
                this._state = NotebookExecutionTaskState.Started;
                this._onDidChangeState.fire();
                this._proxy.$beginNotebookExecution(this._handle);
            },
            end: () => {
                if (this._state === NotebookExecutionTaskState.Resolved) {
                    throw new Error('Cannot call resolve twice');
                }
                this._state = NotebookExecutionTaskState.Resolved;
                this._onDidChangeState.fire();
                this._proxy.$completeNotebookExecution(this._handle);
            },
        };
        return Object.freeze(result);
    }
}
class TimeoutBasedCollector {
    constructor(delay, callback) {
        this.delay = delay;
        this.callback = callback;
        this.batch = [];
        this.startedTimer = Date.now();
    }
    addItem(item) {
        this.batch.push(item);
        if (!this.currentDeferred) {
            this.currentDeferred = new DeferredPromise();
            this.startedTimer = Date.now();
            timeout(this.delay).then(() => {
                return this.flush();
            });
        }
        // This can be called by the extension repeatedly for a long time before the timeout is able to run.
        // Force a flush after the delay.
        if (Date.now() - this.startedTimer > this.delay) {
            return this.flush();
        }
        return this.currentDeferred.p;
    }
    flush() {
        if (this.batch.length === 0 || !this.currentDeferred) {
            return Promise.resolve();
        }
        const deferred = this.currentDeferred;
        this.currentDeferred = undefined;
        const batch = this.batch;
        this.batch = [];
        return this.callback(batch)
            .finally(() => deferred.complete());
    }
}
export function createKernelId(extensionIdentifier, id) {
    return `${extensionIdentifier.value}/${id}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdE5vdGVib29rS2VybmVscy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0Tm90ZWJvb2tLZXJuZWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3pFLE9BQU8sRUFBcUIsdUJBQXVCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDeEQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM3RixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDMUQsT0FBTyxFQUFFLEdBQUcsRUFBaUIsTUFBTSw2QkFBNkIsQ0FBQztBQUNqRSxPQUFPLEVBQUUsbUJBQW1CLEVBQXlCLE1BQU0sbURBQW1ELENBQUM7QUFDL0csT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2xFLE9BQU8sRUFBeUYsV0FBVyxFQUFzRSxNQUFNLHVCQUF1QixDQUFDO0FBQy9NLE9BQU8sRUFBRSxVQUFVLEVBQUUsa0JBQWtCLEVBQUUsZ0JBQWdCLEVBQW1CLE1BQU0sc0JBQXNCLENBQUM7QUFJekcsT0FBTyxLQUFLLHFCQUFxQixNQUFNLDRCQUE0QixDQUFDO0FBQ3BFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSwyQkFBMkIsRUFBRSw0QkFBNEIsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ2xILE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUV2RSxPQUFPLEVBQUUs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