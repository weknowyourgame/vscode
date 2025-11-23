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
import { CancellationToken } from '../../../base/common/cancellation.js';
import { Disposable, DisposableMap } from '../../../base/common/lifecycle.js';
import { revive } from '../../../base/common/marshalling.js';
import { ILanguageModelToolsService, toolResultHasBuffers } from '../../contrib/chat/common/languageModelToolsService.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { SerializableObjectWithBuffers } from '../../services/extensions/common/proxyIdentifier.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
let MainThreadLanguageModelTools = class MainThreadLanguageModelTools extends Disposable {
    constructor(extHostContext, _languageModelToolsService) {
        super();
        this._languageModelToolsService = _languageModelToolsService;
        this._tools = this._register(new DisposableMap());
        this._runningToolCalls = new Map();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostLanguageModelTools);
        this._register(this._languageModelToolsService.onDidChangeTools(e => this._proxy.$onDidChangeTools(this.getToolDtos())));
    }
    getToolDtos() {
        return Array.from(this._languageModelToolsService.getTools())
            .map(tool => ({
            id: tool.id,
            displayName: tool.displayName,
            toolReferenceName: tool.toolReferenceName,
            legacyToolReferenceFullNames: tool.legacyToolReferenceFullNames,
            tags: tool.tags,
            userDescription: tool.userDescription,
            modelDescription: tool.modelDescription,
            inputSchema: tool.inputSchema,
            source: tool.source,
        }));
    }
    async $getTools() {
        return this.getToolDtos();
    }
    async $invokeTool(dto, token) {
        const result = await this._languageModelToolsService.invokeTool(revive(dto), (input, token) => this._proxy.$countTokensForInvocation(dto.callId, input, token), token ?? CancellationToken.None);
        // Only return content and metadata to EH
        const out = {
            content: result.content,
            toolMetadata: result.toolMetadata
        };
        return toolResultHasBuffers(result) ? new SerializableObjectWithBuffers(out) : out;
    }
    $acceptToolProgress(callId, progress) {
        this._runningToolCalls.get(callId)?.progress.report(progress);
    }
    $countTokensForInvocation(callId, input, token) {
        const fn = this._runningToolCalls.get(callId);
        if (!fn) {
            throw new Error(`Tool invocation call ${callId} not found`);
        }
        return fn.countTokens(input, token);
    }
    $registerTool(id) {
        const disposable = this._languageModelToolsService.registerToolImplementation(id, {
            invoke: async (dto, countTokens, progress, token) => {
                try {
                    this._runningToolCalls.set(dto.callId, { countTokens, progress });
                    const resultSerialized = await this._proxy.$invokeTool(dto, token);
                    const resultDto = resultSerialized instanceof SerializableObjectWithBuffers ? resultSerialized.value : resultSerialized;
                    return revive(resultDto);
                }
                finally {
                    this._runningToolCalls.delete(dto.callId);
                }
            },
            prepareToolInvocation: (context, token) => this._proxy.$prepareToolInvocation(id, context, token),
        });
        this._tools.set(id, disposable);
    }
    $unregisterTool(name) {
        this._tools.deleteAndDispose(name);
    }
};
MainThreadLanguageModelTools = __decorate([
    extHostNamedCustomer(MainContext.MainThreadLanguageModelTools),
    __param(1, ILanguageModelToolsService)
], MainThreadLanguageModelTools);
export { MainThreadLanguageModelTools };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZExhbmd1YWdlTW9kZWxUb29scy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZExhbmd1YWdlTW9kZWxUb29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM3RCxPQUFPLEVBQXVCLDBCQUEwQixFQUFpRSxvQkFBb0IsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzlNLE9BQU8sRUFBbUIsb0JBQW9CLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUM3RyxPQUFPLEVBQU8sNkJBQTZCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN6RyxPQUFPLEVBQUUsY0FBYyxFQUFnRCxXQUFXLEVBQXFDLE1BQU0sK0JBQStCLENBQUM7QUFHdEosSUFBTSw0QkFBNEIsR0FBbEMsTUFBTSw0QkFBNkIsU0FBUSxVQUFVO0lBUzNELFlBQ0MsY0FBK0IsRUFDSCwwQkFBdUU7UUFFbkcsS0FBSyxFQUFFLENBQUM7UUFGcUMsK0JBQTBCLEdBQTFCLDBCQUEwQixDQUE0QjtRQVJuRixXQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGFBQWEsRUFBVSxDQUFDLENBQUM7UUFDckQsc0JBQWlCLEdBQUcsSUFBSSxHQUFHLEVBR3hDLENBQUM7UUFPSixJQUFJLENBQUMsTUFBTSxHQUFHLGNBQWMsQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFFaEYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMs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