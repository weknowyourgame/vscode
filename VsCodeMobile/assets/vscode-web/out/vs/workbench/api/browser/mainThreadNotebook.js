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
import { VSBuffer } from '../../../base/common/buffer.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { Emitter } from '../../../base/common/event.js';
import { DisposableStore, dispose } from '../../../base/common/lifecycle.js';
import { StopWatch } from '../../../base/common/stopwatch.js';
import { assertType } from '../../../base/common/types.js';
import { URI } from '../../../base/common/uri.js';
import { CommandsRegistry } from '../../../platform/commands/common/commands.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { NotebookDto } from './mainThreadNotebookDto.js';
import { INotebookCellStatusBarService } from '../../contrib/notebook/common/notebookCellStatusBarService.js';
import { INotebookService, SimpleNotebookProviderInfo } from '../../contrib/notebook/common/notebookService.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { SerializableObjectWithBuffers } from '../../services/extensions/common/proxyIdentifier.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { revive } from '../../../base/common/marshalling.js';
import { coalesce } from '../../../base/common/arrays.js';
import { FileOperationError } from '../../../platform/files/common/files.js';
let MainThreadNotebooks = class MainThreadNotebooks {
    constructor(extHostContext, _notebookService, _cellStatusBarService, _logService) {
        this._notebookService = _notebookService;
        this._cellStatusBarService = _cellStatusBarService;
        this._logService = _logService;
        this._disposables = new DisposableStore();
        this._notebookSerializer = new Map();
        this._notebookCellStatusBarRegistrations = new Map();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostNotebook);
    }
    dispose() {
        this._disposables.dispose();
        dispose(this._notebookSerializer.values());
    }
    $registerNotebookSerializer(handle, extension, viewType, options, data) {
        const disposables = new DisposableStore();
        disposables.add(this._notebookService.registerNotebookSerializer(viewType, extension, {
            options,
            dataToNotebook: async (data) => {
                const sw = new StopWatch();
                let result;
                if (data.byteLength === 0 && viewType === 'interactive') {
                    // we don't want any starting cells for an empty interactive window.
                    result = NotebookDto.fromNotebookDataDto({ cells: [], metadata: {} });
                }
                else {
                    const dto = await this._proxy.$dataToNotebook(handle, data, CancellationToken.None);
                    result = NotebookDto.fromNotebookDataDto(dto.value);
                }
                this._logService.trace(`[NotebookSerializer] dataToNotebook DONE after ${sw.elapsed()}ms`, {
                    viewType,
                    extensionId: extension.id.value,
                });
                return result;
            },
            notebookToData: (data) => {
                const sw = new StopWatch();
                const result = this._proxy.$notebookToData(handle, new SerializableObjectWithBuffers(NotebookDto.toNotebookDataDto(data)), CancellationToken.None);
                this._logService.trace(`[NotebookSerializer] notebookToData DONE after ${sw.elapsed()}`, {
                    viewType,
                    extensionId: extension.id.value,
                });
                return result;
            },
            save: async (uri, versionId, options, token) => {
                const stat = await this._proxy.$saveNotebook(handle, uri, versionId, options, token);
                if (isFileOperationError(stat)) {
                    throw new FileOperationError(stat.message, stat.fileOperationResult, stat.options);
                }
                return {
                    ...stat,
                    children: undefined,
                    resource: uri
                };
            },
            searchInNotebooks: async (textQuery, token, allPriorityInfo) => {
                const contributedType = this._notebookService.getContributedNotebookType(viewType);
                if (!contributedType) {
                    return { results: [], limitHit: false };
                }
                const fileNames = contributedType.selectors;
                const includes = fileNames.map((selector) => {
                    const globPattern = selector.include || selector;
                    return globPattern.toString();
                });
                if (!includes.length) {
                    return {
                        results: [], limitHit: false
                    };
                }
                const thisPriorityInfo = coalesce([{ isFromSettings: false, filenamePatterns: includes }, ...allPriorityInfo.get(viewType) ?? []]);
                const otherEditorsPriorityInfo = Array.from(allPriorityInfo.keys())
                    .flatMap(key => {
                    if (key !== viewType) {
                        return allPriorityInfo.get(key) ?? [];
                    }
                    return [];
                });
                const searchComplete = await this._proxy.$searchInNotebooks(handle, textQuery, thisPriorityInfo, otherEditorsPriorityInfo, token);
                const revivedResults = searchComplete.results.map(result => {
                    const resource = URI.revive(result.resource);
                    return {
                        resource,
                        cellResults: result.cellResults.map(e => revive(e))
                    };
                });
                return { results: revivedResults, limitHit: searchComplete.limitHit };
            }
        }));
        if (data) {
            disposables.add(this._notebookService.registerContributedNotebookType(viewType, data));
        }
        this._notebookSerializer.set(handle, disposables);
        this._logService.trace('[NotebookSerializer] registered notebook serializer', {
            viewType,
            extensionId: extension.id.value,
        });
    }
    $unregisterNotebookSerializer(handle) {
        this._notebookSerializer.get(handle)?.dispose();
        this._notebookSerializer.delete(handle);
    }
    $emitCellStatusBarEvent(eventHandle) {
        const emitter = this._notebookCellStatusBarRegistrations.get(eventHandle);
        if (emitter instanceof Emitter) {
            emitter.fire(undefined);
        }
    }
    async $registerNotebookCellStatusBarItemProvider(handle, eventHandle, viewType) {
        const that = this;
        const provider = {
            async provideCellStatusBarItems(uri, index, token) {
                const result = await that._proxy.$provideNotebookCellStatusBarItems(handle, uri, index, token);
                return {
                    items: result?.items ?? [],
                    dispose() {
                        if (result) {
                            that._proxy.$releaseNotebookCellStatusBarItems(result.cacheId);
                        }
                    }
                };
            },
            viewType
        };
        if (typeof eventHandle === 'number') {
            const emitter = new Emitter();
            this._notebookCellStatusBarRegistrations.set(eventHandle, emitter);
            provider.onDidChangeStatusBarItems = emitter.event;
        }
        const disposable = this._cellStatusBarService.registerCellStatusBarItemProvider(provider);
        this._notebookCellStatusBarRegistrations.set(handle, disposable);
    }
    async $unregisterNotebookCellStatusBarItemProvider(handle, eventHandle) {
        const unregisterThing = (handle) => {
            const entry = this._notebookCellStatusBarRegistrations.get(handle);
            if (entry) {
                this._notebookCellStatusBarRegistrations.get(handle)?.dispose();
                this._notebookCellStatusBarRegistrations.delete(handle);
            }
        };
        unregisterThing(handle);
        if (typeof eventHandle === 'number') {
            unregisterThing(eventHandle);
        }
    }
};
MainThreadNotebooks = __decorate([
    extHostNamedCustomer(MainContext.MainThreadNotebook),
    __param(1, INotebookService),
    __param(2, INotebookCellStatusBarService),
    __param(3, ILogService)
], MainThreadNotebooks);
export { MainThreadNotebooks };
CommandsRegistry.registerCommand('_executeDataToNotebook', async (accessor, ...args) => {
    const [notebookType, bytes] = args;
    assertType(typeof notebookType === 'string', 'string');
    assertType(bytes instanceof VSBuffer, 'VSBuffer');
    const notebookService = accessor.get(INotebookService);
    const info = await notebookService.withNotebookDataProvider(notebookType);
    if (!(info instanceof SimpleNotebookProviderInfo)) {
        return;
    }
    const dto = await info.serializer.dataToNotebook(bytes);
    return new SerializableObjectWithBuffers(NotebookDto.toNotebookDataDto(dto));
});
CommandsRegistry.registerCommand('_executeNotebookToData', async (accessor, notebookType, dto) => {
    assertType(typeof notebookType === 'string', 'string');
    const notebookService = accessor.get(INotebookService);
    const info = await notebookService.withNotebookDataProvider(notebookType);
    if (!(info instanceof SimpleNotebookProviderInfo)) {
        return;
    }
    const data = NotebookDto.fromNotebookDataDto(dto.value);
    const bytes = await info.serializer.notebookToData(data);
    return bytes;
});
function isFileOperationError(error) {
    const candidate = error;
    return typeof candidate?.fileOperationResult === 'number' && typeof candidate?.message === 'string';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZE5vdGVib29rLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvYnJvd3Nlci9tYWluVGhyZWFkTm90ZWJvb2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN4RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBZSxNQUFNLG1DQUFtQyxDQUFDO0FBQzFGLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDM0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ2xELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDekQsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFFOUcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLDBCQUEwQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDaEgsT0FBTyxFQUFFLG9CQUFvQixFQUFtQixNQUFNLHNEQUFzRCxDQUFDO0FBQzdHLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxjQUFjLEVBQXdCLFdBQVcsRUFBNEMsTUFBTSwrQkFBK0IsQ0FBQztBQUU1SSxPQUFP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