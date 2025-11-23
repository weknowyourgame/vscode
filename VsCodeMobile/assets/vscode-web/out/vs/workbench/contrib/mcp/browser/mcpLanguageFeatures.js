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
import { computeLevenshteinDistance } from '../../../../base/common/diff/diff.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { createMarkdownCommandLink, MarkdownString } from '../../../../base/common/htmlContent.js';
import { findNodeAtLocation, parseTree } from '../../../../base/common/json.js';
import { Disposable, DisposableStore, dispose, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { isEqual } from '../../../../base/common/resources.js';
import { Range } from '../../../../editor/common/core/range.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { localize } from '../../../../nls.js';
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { IConfigurationResolverService } from '../../../services/configurationResolver/common/configurationResolver.js';
import { ConfigurationResolverExpression } from '../../../services/configurationResolver/common/configurationResolverExpression.js';
import { mcpConfigurationSection } from '../common/mcpConfiguration.js';
import { IMcpRegistry } from '../common/mcpRegistryTypes.js';
import { IMcpService, IMcpWorkbenchService } from '../common/mcpTypes.js';
const diagnosticOwner = 'vscode.mcp';
let McpLanguageFeatures = class McpLanguageFeatures extends Disposable {
    constructor(languageFeaturesService, _mcpRegistry, _mcpWorkbenchService, _mcpService, _markerService, _configurationResolverService) {
        super();
        this._mcpRegistry = _mcpRegistry;
        this._mcpWorkbenchService = _mcpWorkbenchService;
        this._mcpService = _mcpService;
        this._markerService = _markerService;
        this._configurationResolverService = _configurationResolverService;
        this._cachedMcpSection = this._register(new MutableDisposable());
        const patterns = [
            { pattern: '**/mcp.json' },
            { pattern: '**/workspace.json' },
        ];
        const onDidChangeCodeLens = this._register(new Emitter());
        const codeLensProvider = {
            onDidChange: onDidChangeCodeLens.event,
            provideCodeLenses: (model, range) => this._provideCodeLenses(model, () => onDidChangeCodeLens.fire(codeLensProvider)),
        };
        this._register(languageFeaturesService.codeLensProvider.register(patterns, codeLensProvider));
        this._register(languageFeaturesService.inlayHintsProvider.register(patterns, {
            onDidChangeInlayHints: _mcpRegistry.onDidChangeInputs,
            provideInlayHints: (model, range) => this._provideInlayHints(model, range),
        }));
    }
    /** Simple mechanism to avoid extra json parsing for hints+lenses */
    async _parseModel(model) {
        if (this._cachedMcpSection.value?.model === model) {
            return this._cachedMcpSection.value;
        }
        const uri = model.uri;
        const inConfig = await this._mcpWorkbenchService.getMcpConfigPath(model.uri);
        if (!inConfig) {
            return undefined;
        }
        const value = model.getValue();
        const tree = parseTree(value);
        const listeners = [
            model.onDidChangeContent(() => this._cachedMcpSection.clear()),
            model.onWillDispose(() => this._cachedMcpSection.clear()),
        ];
        this._addDiagnostics(model, value, tree, inConfig);
        return this._cachedMcpSection.value = {
            model,
            tree,
            inConfig,
            dispose: () => {
                this._markerService.remove(diagnosticOwner, [uri]);
                dispose(listeners);
            }
        };
    }
    _addDiagnostics(tm, value, tree, inConfig) {
        const serversNode = findNodeAtLocation(tree, inConfig.section ? [...inConfig.section, 'servers'] : ['servers']);
        if (!serversNode) {
            return;
        }
        const getClosestMatchingVariable = (name) => {
            let bestValue = '';
            let bestDistance = Infinity;
            for (const variable of this._configurationResolverService.resolvableVariables) {
                const distance = computeLevenshteinDistance(name, variable);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestValue = variable;
                }
            }
            return bestValue;
        };
        const diagnostics = [];
        forEachPropertyWithReplacement(serversNode, node => {
            const expr = ConfigurationResolverExpression.parse(node.value);
            for (const { id, name, arg } of expr.unresolved()) {
                if (!this._configurationResolverService.resolvableVariables.has(name)) {
                    const position = value.indexOf(id, node.offset);
                    if (position === -1) {
                        continue;
                    } // unreachable?
                    const start = tm.getPositionAt(position);
                    const end = tm.getPositionAt(position + id.length);
                    diagnostics.push({
                        severity: MarkerSeverity.Warning,
                        message: localize('mcp.variableNotFound', 'Variable `{0}` not found, did you mean ${{1}}?', name, getClosestMatchingVariable(name) + (arg ? `:${arg}` : '')),
                        startLineNumber: start.lineNumber,
                        startColumn: start.column,
                        endLineNumber: end.lineNumber,
                        endColumn: end.column,
                        modelVersionId: tm.getVersionId(),
                    });
                }
            }
        });
        if (diagnostics.length) {
            this._markerService.changeOne(diagnosticOwner, tm.uri, diagnostics);
        }
        else {
            this._markerService.remove(diagnosticOwner, [tm.uri]);
        }
    }
    async _provideCodeLenses(model, onDidChangeCodeLens) {
        const parsed = await this._parseModel(model);
        if (!parsed) {
            return undefined;
        }
        const { tree, inConfig } = parsed;
        const serversNode = findNodeAtLocation(tree, inConfig.section ? [...inConfig.section, 'servers'] : ['servers']);
        if (!serversNode) {
            return undefined;
        }
        const store = new DisposableStore();
        const lenses = [];
        const lensList = { lenses, dispose: () => store.dispose() };
        const read = (observable) => {
            store.add(Event.fromObservableLight(observable)(onDidChangeCodeLens));
            return observable.get();
        };
        const collection = read(this._mcpRegistry.collections).find(c => isEqual(c.presentation?.origin, model.uri));
        if (!collection) {
            return lensList;
        }
        const mcpServers = read(this._mcpService.servers).filter(s => s.collection.id === collection.id);
        for (const node of serversNode.children || []) {
            if (node.type !== 'property' || node.children?.[0]?.type !== 'string') {
                continue;
            }
            const name = node.children[0].value;
            const server = mcpServers.find(s => s.definition.label === name);
            if (!server) {
                continue;
            }
            const range = Range.fromPositions(model.getPositionAt(node.children[0].offset));
            const canDebug = !!server.readDefinitions().get().server?.devMode?.debug;
            const state = read(server.connectionState).state;
            switch (state) {
                case 3 /* McpConnectionState.Kind.Error */:
                    lenses.push({
                        range,
                        command: {
                            id: "workbench.mcp.showOutput" /* McpCommandIds.ShowOutput */,
                            title: '$(error) ' + localize('server.error', 'Error'),
                            arguments: [server.definition.id],
                        },
                    }, {
                        range,
                        command: {
                            id: "workbench.mcp.restartServer" /* McpCommandIds.RestartServer */,
                            title: localize('mcp.restart', "Restart"),
                            arguments: [server.definition.id, { autoTrustChanges: true }],
                        },
                    });
                    if (canDebug) {
                        lenses.push({
                            range,
                            command: {
                                id: "workbench.mcp.restartServer" /* McpCommandIds.RestartServer */,
                                title: localize('mcp.debug', "Debug"),
                                arguments: [server.definition.id, { debug: true, autoTrustChanges: true }],
                            },
                        });
                    }
                    break;
                case 1 /* McpConnectionState.Kind.Starting */:
                    lenses.push({
                        range,
                        command: {
                            id: "workbench.mcp.showOutput" /* McpCommandIds.ShowOutput */,
                            title: '$(loading~spin) ' + localize('server.starting', 'Starting'),
                            arguments: [server.definition.id],
                        },
                    }, {
                        range,
                        command: {
                            id: "workbench.mcp.stopServer" /* McpCommandIds.StopServer */,
                            title: localize('cancel', "Cancel"),
                            arguments: [server.definition.id],
                        },
                    });
                    break;
                case 2 /* McpConnectionState.Kind.Running */:
                    lenses.push({
                        range,
                        command: {
                            id: "workbench.mcp.showOutput" /* McpCommandIds.ShowOutput */,
                            title: '$(check) ' + localize('server.running', 'Running'),
                            arguments: [server.definition.id],
                        },
                    }, {
                        range,
                        command: {
                            id: "workbench.mcp.stopServer" /* McpCommandIds.StopServer */,
                            title: localize('mcp.stop', "Stop"),
                            arguments: [server.definition.id],
                        },
                    }, {
                        range,
                        command: {
                            id: "workbench.mcp.restartServer" /* McpCommandIds.RestartServer */,
                            title: localize('mcp.restart', "Restart"),
                            arguments: [server.definition.id, { autoTrustChanges: true }],
                        },
                    });
                    if (canDebug) {
                        lenses.push({
                            range,
                            command: {
                                id: "workbench.mcp.restartServer" /* McpCommandIds.RestartServer */,
                                title: localize('mcp.debug', "Debug"),
                                arguments: [server.definition.id, { autoTrustChanges: true, debug: true }],
                            },
                        });
                    }
                    break;
                case 0 /* McpConnectionState.Kind.Stopped */:
                    lenses.push({
                        range,
                        command: {
                            id: "workbench.mcp.startServer" /* McpCommandIds.StartServer */,
                            title: '$(debug-start) ' + localize('mcp.start', "Start"),
                            arguments: [server.definition.id, { autoTrustChanges: true }],
                        },
                    });
                    if (canDebug) {
                        lenses.push({
                            range,
                            command: {
                                id: "workbench.mcp.startServer" /* McpCommandIds.StartServer */,
                                title: localize('mcp.debug', "Debug"),
                                arguments: [server.definition.id, { autoTrustChanges: true, debug: true }],
                            },
                        });
                    }
            }
            if (state !== 3 /* McpConnectionState.Kind.Error */) {
                const toolCount = read(server.tools).length;
                if (toolCount) {
                    lenses.push({
                        range,
                        command: {
                            id: '',
                            title: localize('server.toolCount', '{0} tools', toolCount),
                        }
                    });
                }
                const promptCount = read(server.prompts).length;
                if (promptCount) {
                    lenses.push({
                        range,
                        command: {
                            id: "workbench.mcp.startPromptForServer" /* McpCommandIds.StartPromptForServer */,
                            title: localize('server.promptcount', '{0} prompts', promptCount),
                            arguments: [server],
                        }
                    });
                }
                lenses.push({
                    range,
                    command: {
                        id: "workbench.mcp.serverOptions" /* McpCommandIds.ServerOptions */,
                        title: localize('mcp.server.more', 'More...'),
                        arguments: [server.definition.id],
                    }
                });
            }
        }
        return lensList;
    }
    async _provideInlayHints(model, range) {
        const parsed = await this._parseModel(model);
        if (!parsed) {
            return undefined;
        }
        const { tree, inConfig } = parsed;
        const mcpSection = inConfig.section ? findNodeAtLocation(tree, [...inConfig.section]) : tree;
        if (!mcpSection) {
            return undefined;
        }
        const inputsNode = findNodeAtLocation(mcpSection, ['inputs']);
        if (!inputsNode) {
            return undefined;
        }
        const inputs = await this._mcpRegistry.getSavedInputs(inConfig.scope);
        const hints = [];
        const serversNode = findNodeAtLocation(mcpSection, ['servers']);
        if (serversNode) {
            annotateServers(serversNode);
        }
        annotateInputs(inputsNode);
        return { hints, dispose: () => { } };
        function annotateServers(servers) {
            forEachPropertyWithReplacement(servers, node => {
                const expr = ConfigurationResolverExpression.parse(node.value);
                for (const { id } of expr.unresolved()) {
                    const saved = inputs[id];
                    if (saved) {
                        pushAnnotation(id, node.offset + node.value.indexOf(id) + id.length, saved);
                    }
                }
            });
        }
        function annotateInputs(node) {
            if (node.type !== 'array' || !node.children) {
                return;
            }
            for (const input of node.children) {
                if (input.type !== 'object' || !input.children) {
                    continue;
                }
                const idProp = input.children.find(c => c.type === 'property' && c.children?.[0].value === 'id');
                if (!idProp) {
                    continue;
                }
                const id = idProp.children[1];
                if (!id || id.type !== 'string' || !id.value) {
                    continue;
                }
                const savedId = '${input:' + id.value + '}';
                const saved = inputs[savedId];
                if (saved) {
                    pushAnnotation(savedId, id.offset + 1 + id.length, saved);
                }
            }
        }
        function pushAnnotation(savedId, offset, saved) {
            const tooltip = new MarkdownString([
                createMarkdownCommandLink({ id: "workbench.mcp.editStoredInput" /* McpCommandIds.EditStoredInput */, title: localize('edit', 'Edit'), arguments: [savedId, model.uri, mcpConfigurationSection, inConfig.target] }),
                createMarkdownCommandLink({ id: "workbench.mcp.removeStoredInput" /* McpCommandIds.RemoveStoredInput */, title: localize('clear', 'Clear'), arguments: [inConfig.scope, savedId] }),
                createMarkdownCommandLink({ id: "workbench.mcp.removeStoredInput" /* McpCommandIds.RemoveStoredInput */, title: localize('clearAll', 'Clear All'), arguments: [inConfig.scope] }),
            ].join(' | '), { isTrusted: true });
            const hint = {
                label: '= ' + (saved.input?.type === 'promptString' && saved.input.password ? '*'.repeat(10) : (saved.value || '')),
                position: model.getPositionAt(offset),
                tooltip,
                paddingLeft: true,
            };
            hints.push(hint);
            return hint;
        }
    }
};
McpLanguageFeatures = __decorate([
    __param(0, ILanguageFeaturesService),
    __param(1, IMcpRegistry),
    __param(2, IMcpWorkbenchService),
    __param(3, IMcpService),
    __param(4, IMarkerService),
    __param(5, IConfigurationResolverService)
], McpLanguageFeatures);
export { McpLanguageFeatures };
function forEachPropertyWithReplacement(node, callback) {
    if (node.type === 'string' && typeof node.value === 'string' && node.value.includes(ConfigurationResolverExpression.VARIABLE_LHS)) {
        callback(node);
    }
    else if (node.type === 'property') {
        // skip the property name
        node.children?.slice(1).forEach(n => forEachPropertyWithReplacement(n, callback));
    }
    else {
        node.children?.forEach(n => forEachPropertyWithReplacement(n, callback));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwTGFuZ3VhZ2VGZWF0dXJlcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvYnJvd3Nlci9tY3BMYW5ndWFnZUZlYXR1cmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLHlCQUF5QixFQUFFLGNBQWMsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxrQkFBa0IsRUFBUSxTQUFTLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN0RixPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQWUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUU1SCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDL0QsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBR2hFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQWUsY0FBYyxFQUFFLGNBQWMsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBRTdHLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHlFQUF5RSxDQUFDO0FBQ3hILE9BQU8sRUFBRSwrQkFBK0IsRUFBa0IsTUFBTSxtRkFBbUYsQ0FBQztBQUVwSixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN4RSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFD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