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
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { derived, observableFromEvent, ObservableMap } from '../../../../base/common/observable.js';
import { isObject } from '../../../../base/common/types.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { observableMemento } from '../../../../platform/observable/common/observableMemento.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ChatModeKind } from '../common/constants.js';
import { ILanguageModelToolsService, ToolSet } from '../common/languageModelToolsService.js';
import { PromptsStorage } from '../common/promptSyntax/service/promptsService.js';
import { PromptFileRewriter } from './promptSyntax/promptFileRewriter.js';
var ToolEnablementStates;
(function (ToolEnablementStates) {
    function fromMap(map) {
        const toolSets = new Map(), tools = new Map();
        for (const [entry, enabled] of map.entries()) {
            if (entry instanceof ToolSet) {
                toolSets.set(entry.id, enabled);
            }
            else {
                tools.set(entry.id, enabled);
            }
        }
        return { toolSets, tools };
    }
    ToolEnablementStates.fromMap = fromMap;
    function isStoredDataV1(data) {
        return isObject(data) && data.version === undefined
            && (data.disabledTools === undefined || Array.isArray(data.disabledTools))
            && (data.disabledToolSets === undefined || Array.isArray(data.disabledToolSets));
    }
    function isStoredDataV2(data) {
        return isObject(data) && data.version === 2 && Array.isArray(data.toolSetEntries) && Array.isArray(data.toolEntries);
    }
    function fromStorage(storage) {
        try {
            const parsed = JSON.parse(storage);
            if (isStoredDataV2(parsed)) {
                return { toolSets: new Map(parsed.toolSetEntries), tools: new Map(parsed.toolEntries) };
            }
            else if (isStoredDataV1(parsed)) {
                const toolSetEntries = parsed.disabledToolSets?.map(id => [id, false]);
                const toolEntries = parsed.disabledTools?.map(id => [id, false]);
                return { toolSets: new Map(toolSetEntries), tools: new Map(toolEntries) };
            }
        }
        catch {
            // ignore
        }
        // invalid data
        return { toolSets: new Map(), tools: new Map() };
    }
    ToolEnablementStates.fromStorage = fromStorage;
    function toStorage(state) {
        const storageData = {
            version: 2,
            toolSetEntries: Array.from(state.toolSets.entries()),
            toolEntries: Array.from(state.tools.entries())
        };
        return JSON.stringify(storageData);
    }
    ToolEnablementStates.toStorage = toStorage;
})(ToolEnablementStates || (ToolEnablementStates = {}));
export var ToolsScope;
(function (ToolsScope) {
    ToolsScope[ToolsScope["Global"] = 0] = "Global";
    ToolsScope[ToolsScope["Session"] = 1] = "Session";
    ToolsScope[ToolsScope["Agent"] = 2] = "Agent";
    ToolsScope[ToolsScope["Agent_ReadOnly"] = 3] = "Agent_ReadOnly";
})(ToolsScope || (ToolsScope = {}));
let ChatSelectedTools = class ChatSelectedTools extends Disposable {
    constructor(_mode, _toolsService, _storageService, _instantiationService) {
        super();
        this._mode = _mode;
        this._toolsService = _toolsService;
        this._instantiationService = _instantiationService;
        this._sessionStates = new ObservableMap();
        /**
         * All tools and tool sets with their enabled state.
         */
        this.entriesMap = derived(r => {
            const map = new Map();
            // look up the tools in the hierarchy: session > mode > global
            const currentMode = this._mode.read(r);
            let currentMap = this._sessionStates.observable.read(r).get(currentMode.id);
            if (!currentMap && currentMode.kind === ChatModeKind.Agent) {
                const modeTools = currentMode.customTools?.read(r);
                if (modeTools) {
                    const target = currentMode.target?.read(r);
                    currentMap = ToolEnablementStates.fromMap(this._toolsService.toToolAndToolSetEnablementMap(modeTools, target));
                }
            }
            if (!currentMap) {
                currentMap = this._globalState.read(r);
            }
            for (const tool of this._allTools.read(r)) {
                if (tool.canBeReferencedInPrompt) {
                    map.set(tool, currentMap.tools.get(tool.id) !== false); // if unknown, it's enabled
                }
            }
            for (const toolSet of this._toolsService.toolSets.read(r)) {
                const toolSetEnabled = currentMap.toolSets.get(toolSet.id) !== false; // if unknown, it's enabled
                map.set(toolSet, toolSetEnabled);
                for (const tool of toolSet.getTools(r)) {
                    map.set(tool, toolSetEnabled || currentMap.tools.get(tool.id) === true); // if unknown, use toolSetEnabled
                }
            }
            return map;
        });
        this.userSelectedTools = derived(r => {
            // extract a map of tool ids
            const result = {};
            const map = this.entriesMap.read(r);
            for (const [item, enabled] of map) {
                if (!(item instanceof ToolSet)) {
                    result[item.id] = enabled;
                }
            }
            return result;
        });
        const globalStateMemento = observableMemento({
            key: 'chat/selectedTools',
            defaultValue: { toolSets: new Map(), tools: new Map() },
            fromStorage: ToolEnablementStates.fromStorage,
            toStorage: ToolEnablementStates.toStorage
        });
        this._globalState = this._store.add(globalStateMemento(0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */, _storageService));
        this._allTools = observableFromEvent(_toolsService.onDidChangeTools, () => Array.from(_toolsService.getTools()));
    }
    get entriesScope() {
        const mode = this._mode.get();
        if (this._sessionStates.has(mode.id)) {
            return ToolsScope.Session;
        }
        if (mode.kind === ChatModeKind.Agent && mode.customTools?.get() && mode.uri) {
            return mode.source?.storage !== PromptsStorage.extension ? ToolsScope.Agent : ToolsScope.Agent_ReadOnly;
        }
        return ToolsScope.Global;
    }
    get currentMode() {
        return this._mode.get();
    }
    resetSessionEnablementState() {
        const mode = this._mode.get();
        this._sessionStates.delete(mode.id);
    }
    set(enablementMap, sessionOnly) {
        const mode = this._mode.get();
        if (sessionOnly || this._sessionStates.has(mode.id)) {
            this._sessionStates.set(mode.id, ToolEnablementStates.fromMap(enablementMap));
            return;
        }
        if (mode.kind === ChatModeKind.Agent && mode.customTools?.get() && mode.uri) {
            if (mode.source?.storage !== PromptsStorage.extension) {
                // apply directly to mode file.
                this.updateCustomModeTools(mode.uri.get(), enablementMap);
                return;
            }
            else {
                // can not write to extensions, store
                this._sessionStates.set(mode.id, ToolEnablementStates.fromMap(enablementMap));
                return;
            }
        }
        this._globalState.set(ToolEnablementStates.fromMap(enablementMap), undefined);
    }
    async updateCustomModeTools(uri, enablementMap) {
        await this._instantiationService.createInstance(PromptFileRewriter).openAndRewriteTools(uri, enablementMap, CancellationToken.None);
    }
};
ChatSelectedTools = __decorate([
    __param(1, ILanguageModelToolsService),
    __param(2, IStorageService),
    __param(3, IInstantiationService)
], ChatSelectedTools);
export { ChatSelectedTools };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNlbGVjdGVkVG9vbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRTZWxlY3RlZFRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsT0FBTyxFQUFlLG1CQUFtQixFQUFFLGFBQWEsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2pILE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUU1RCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDbkgsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxnREFBZ0QsQ0FBQztBQUc5RyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdEQsT0FBTyxFQUFFLDBCQUEwQixFQUEyQyxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN0SSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDbEYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFvQjFFLElBQVUsb0JBQW9CLENBZ0Q3QjtBQWhERCxXQUFVLG9CQUFvQjtJQUM3QixTQUFnQixPQUFPLENBQUMsR0FBaUM7UUFDeEQsTUFBTSxRQUFRLEdBQXlCLElBQUksR0FBRyxFQUFFLEVBQUUsS0FBSyxHQUF5QixJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQzFGLEtBQUssTUFBTSxDQUFDLEtBQUssRUFBRSxP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