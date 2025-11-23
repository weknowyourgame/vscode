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
import { decodeBase64, VSBuffer } from '../../../../base/common/buffer.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { Disposable, DisposableMap, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { equals } from '../../../../base/common/objects.js';
import { autorun } from '../../../../base/common/observable.js';
import { basename } from '../../../../base/common/resources.js';
import { isDefined } from '../../../../base/common/types.js';
import { localize } from '../../../../nls.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IImageResizeService } from '../../../../platform/imageResize/common/imageResizeService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { ChatResponseResource, getAttachableImageExtension } from '../../chat/common/chatModel.js';
import { LanguageModelPartAudience } from '../../chat/common/languageModels.js';
import { ILanguageModelToolsService } from '../../chat/common/languageModelToolsService.js';
import { IMcpRegistry } from './mcpRegistryTypes.js';
import { IMcpService, McpResourceURI, McpToolResourceLinkMimeType } from './mcpTypes.js';
import { mcpServerToSourceData } from './mcpTypesUtils.js';
let McpLanguageModelToolContribution = class McpLanguageModelToolContribution extends Disposable {
    static { this.ID = 'workbench.contrib.mcp.languageModelTools'; }
    constructor(_toolsService, mcpService, _instantiationService, _mcpRegistry) {
        super();
        this._toolsService = _toolsService;
        this._instantiationService = _instantiationService;
        this._mcpRegistry = _mcpRegistry;
        // Keep tools in sync with the tools service.
        const previous = this._register(new DisposableMap());
        this._register(autorun(reader => {
            const servers = mcpService.servers.read(reader);
            const toDelete = new Set(previous.keys());
            for (const server of servers) {
                const previousRec = previous.get(server);
                if (previousRec) {
                    toDelete.delete(server);
                    if (!previousRec.source || equals(previousRec.source, mcpServerToSourceData(server, reader))) {
                        continue; // same definition, no need to update
                    }
                    previousRec.dispose();
                }
                const store = new DisposableStore();
                const rec = { dispose: () => store.dispose() };
                const toolSet = new Lazy(() => {
                    const source = rec.source = mcpServerToSourceData(server);
                    const referenceName = server.definition.label.toLowerCase().replace(/\s+/g, '-'); // see issue https://github.com/microsoft/vscode/issues/278152
                    const toolSet = store.add(this._toolsService.createToolSet(source, server.definition.id, referenceName, {
                        icon: Codicon.mcp,
                        description: localize('mcp.toolset', "{0}: All Tools", server.definition.label)
                    }));
                    return { toolSet, source };
                });
                this._syncTools(server, toolSet, store);
                previous.set(server, rec);
            }
            for (const key of toDelete) {
                previous.deleteAndDispose(key);
            }
        }));
    }
    _syncTools(server, collectionData, store) {
        const tools = new Map();
        const collectionObservable = this._mcpRegistry.collections.map(collections => collections.find(c => c.id === server.collection.id));
        store.add(autorun(reader => {
            const toDelete = new Set(tools.keys());
            // toRegister is deferred until deleting tools that moving a tool between
            // servers (or deleting one instance of a multi-instance server) doesn't cause an error.
            const toRegister = [];
            const registerTool = (tool, toolData, store) => {
                store.add(this._toolsService.registerTool(toolData, this._instantiationService.createInstance(McpToolImplementation, tool, server)));
                store.add(collectionData.value.toolSet.addTool(toolData));
            };
            const collection = collectionObservable.read(reader);
            for (const tool of server.tools.read(reader)) {
                const existing = tools.get(tool.id);
                const icons = tool.icons.getUrl(22);
                const toolData = {
                    id: tool.id,
                    source: collectionData.value.source,
                    icon: icons || Codicon.tools,
                    // duplicative: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/813
                    displayName: tool.definition.annotations?.title || tool.definition.title || tool.definition.name,
                    toolReferenceName: tool.referenceName,
                    modelDescription: tool.definition.description ?? '',
                    userDescription: tool.definition.description ?? '',
                    inputSchema: tool.definition.inputSchema,
                    canBeReferencedInPrompt: true,
                    alwaysDisplayInputOutput: true,
                    canRequestPreApproval: !tool.definition.annotations?.readOnlyHint,
                    canRequestPostApproval: !!tool.definition.annotations?.openWorldHint,
                    runsInWorkspace: collection?.scope === 1 /* StorageScope.WORKSPACE */ || !!collection?.remoteAuthority,
                    tags: ['mcp'],
                };
                if (existing) {
                    if (!equals(existing.toolData, toolData)) {
                        existing.toolData = toolData;
                        existing.store.clear();
                        // We need to re-register both the data and implementation, as the
                        // implementation is discarded when the data is removed (#245921)
                        registerTool(tool, toolData, existing.store);
                    }
                    toDelete.delete(tool.id);
                }
                else {
                    const store = new DisposableStore();
                    toRegister.push(() => registerTool(tool, toolData, store));
                    tools.set(tool.id, { toolData, store });
                }
            }
            for (const id of toDelete) {
                const tool = tools.get(id);
                if (tool) {
                    tool.store.dispose();
                    tools.delete(id);
                }
            }
            for (const fn of toRegister) {
                fn();
            }
            // Important: flush tool updates when the server is fully registered so that
            // any consuming (e.g. autostarting) requests have the tools available immediately.
            this._toolsService.flushToolUpdates();
        }));
        store.add(toDisposable(() => {
            for (const tool of tools.values()) {
                tool.store.dispose();
            }
        }));
    }
};
McpLanguageModelToolContribution = __decorate([
    __param(0, ILanguageModelToolsService),
    __param(1, IMcpService),
    __param(2, IInstantiationService),
    __param(3, IMcpRegistry)
], McpLanguageModelToolContribution);
export { McpLanguageModelToolContribution };
let McpToolImplementation = class McpToolImplementation {
    constructor(_tool, _server, _productService, _fileService, _imageResizeService) {
        this._tool = _tool;
        this._server = _server;
        this._productService = _productService;
        this._fileService = _fileService;
        this._imageResizeService = _imageResizeService;
    }
    async prepareToolInvocation(context) {
        const tool = this._tool;
        const server = this._server;
        const mcpToolWarning = localize('mcp.tool.warning', "Note that MCP servers or malicious conversation content may attempt to misuse '{0}' through tools.", this._productService.nameShort);
        // duplicative: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/813
        const title = tool.definition.annotations?.title || tool.definition.title || ('`' + tool.definition.name + '`');
        const confirm = {};
        if (!tool.definition.annotations?.readOnlyHint) {
            confirm.title = new MarkdownString(localize('msg.title', "Run {0}", title));
            confirm.message = new MarkdownString(tool.definition.description, { supportThemeIcons: true });
            confirm.disclaimer = mcpToolWarning;
            confirm.allowAutoConfirm = true;
        }
        if (tool.definition.annotations?.openWorldHint) {
            confirm.confirmResults = true;
        }
        return {
            confirmationMessages: confirm,
            invocationMessage: new MarkdownString(localize('msg.run', "Running {0}", title)),
            pastTenseMessage: new MarkdownString(localize('msg.ran', "Ran {0} ", title)),
            originMessage: localize('msg.subtitle', "{0} (MCP Server)", server.definition.label),
            toolSpecificData: {
                kind: 'input',
                rawInput: context.parameters
            }
        };
    }
    async invoke(invocation, _countTokens, progress, token) {
        const result = {
            content: []
        };
        const callResult = await this._tool.callWithProgress(invocation.parameters, progress, { chatRequestId: invocation.chatRequestId, chatSessionId: invocation.context?.sessionId }, token);
        const details = {
            input: JSON.stringify(invocation.parameters, undefined, 2),
            output: [],
            isError: callResult.isError === true,
        };
        for (const item of callResult.content) {
            const audience = item.annotations?.audience?.map(a => {
                if (a === 'assistant') {
                    return LanguageModelPartAudience.Assistant;
                }
                else if (a === 'user') {
                    return LanguageModelPartAudience.User;
                }
                else {
                    return undefined;
                }
            }).filter(isDefined);
            // Explicit user parts get pushed to progress to show in the status UI
            if (audience?.includes(LanguageModelPartAudience.User)) {
                if (item.type === 'text') {
                    progress.report({ message: item.text });
                }
            }
            // Rewrite image resources to images so they are inlined nicely
            const addAsInlineData = async (mimeType, value, uri) => {
                details.output.push({ type: 'embed', mimeType, value, uri, audience });
                if (isForModel) {
                    let finalData;
                    try {
                        const resized = await this._imageResizeService.resizeImage(decodeBase64(value).buffer, mimeType);
                        finalData = VSBuffer.wrap(resized);
                    }
                    catch {
                        finalData = decodeBase64(value);
                    }
                    result.content.push({ kind: 'data', value: { mimeType, data: finalData }, audience });
                }
            };
            const addAsLinkedResource = (uri, mimeType) => {
                const json = { uri, underlyingMimeType: mimeType };
                result.content.push({
                    kind: 'data',
                    audience,
                    value: {
                        mimeType: McpToolResourceLinkMimeType,
                        data: VSBuffer.fromString(JSON.stringify(json)),
                    },
                });
            };
            const isForModel = !audience || audience.includes(LanguageModelPartAudience.Assistant);
            if (item.type === 'text') {
                details.output.push({ type: 'embed', isText: true, value: item.text });
                // structured content 'represents the result of the tool call', so take
                // that in place of any textual description when present.
                if (isForModel && !callResult.structuredContent) {
                    result.content.push({
                        kind: 'text',
                        audience,
                        value: item.text
                    });
                }
            }
            else if (item.type === 'image' || item.type === 'audio') {
                // default to some image type if not given to hint
                await addAsInlineData(item.mimeType || 'image/png', item.data);
            }
            else if (item.type === 'resource_link') {
                const uri = McpResourceURI.fromServer(this._server.definition, item.uri);
                details.output.push({
                    type: 'ref',
                    uri,
                    audience,
                    mimeType: item.mimeType,
                });
                if (isForModel) {
                    if (item.mimeType && getAttachableImageExtension(item.mimeType)) {
                        result.content.push({
                            kind: 'data',
                            audience,
                            value: {
                                mimeType: item.mimeType,
                                data: await this._fileService.readFile(uri).then(f => f.value).catch(() => VSBuffer.alloc(0)),
                            }
                        });
                    }
                    else {
                        addAsLinkedResource(uri, item.mimeType);
                    }
                }
            }
            else if (item.type === 'resource') {
                const uri = McpResourceURI.fromServer(this._server.definition, item.resource.uri);
                if (item.resource.mimeType && getAttachableImageExtension(item.resource.mimeType) && 'blob' in item.resource) {
                    await addAsInlineData(item.resource.mimeType, item.resource.blob, uri);
                }
                else {
                    details.output.push({
                        type: 'embed',
                        uri,
                        isText: 'text' in item.resource,
                        mimeType: item.resource.mimeType,
                        value: 'blob' in item.resource ? item.resource.blob : item.resource.text,
                        audience,
                        asResource: true,
                    });
                    if (isForModel) {
                        const permalink = invocation.context && ChatResponseResource.createUri(invocation.context.sessionId, invocation.callId, result.content.length, basename(uri));
                        addAsLinkedResource(permalink || uri, item.resource.mimeType);
                    }
                }
            }
        }
        if (callResult.structuredContent) {
            details.output.push({ type: 'embed', isText: true, value: JSON.stringify(callResult.structuredContent, null, 2), audience: [LanguageModelPartAudience.Assistant] });
            result.content.push({ kind: 'text', value: JSON.stringify(callResult.structuredContent), audience: [LanguageModelPartAudience.Assistant] });
        }
        result.toolResultDetails = details;
        return result;
    }
};
McpToolImplementation = __decorate([
    __param(2, IProductService),
    __param(3, IFileService),
    __param(4, IImageResizeService)
], McpToolImplementation);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwTGFuZ3VhZ2VNb2RlbFRvb2xDb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2NvbW1vbi9tY3BMYW5ndWFnZU1vZGVsVG9vbENvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsWUFBWSxFQUFFLFFBQVEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRTNFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBZSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM3SCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDNUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFN0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUNwRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFHeEYsT0FBTyxFQUFFLG9CQUFv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