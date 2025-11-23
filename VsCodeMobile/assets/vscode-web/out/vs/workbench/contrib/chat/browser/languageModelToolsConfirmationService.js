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
import { Toggle } from '../../../../base/browser/ui/toggle/toggle.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { LRUCache } from '../../../../base/common/map.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { inputActiveOptionBackground, inputActiveOptionBorder, inputActiveOptionForeground } from '../../../../platform/theme/common/colorRegistry.js';
import { asCssVariable } from '../../../../platform/theme/common/colorUtils.js';
const RUN_WITHOUT_APPROVAL = localize('runWithoutApproval', "without approval");
const CONTINUE_WITHOUT_REVIEWING_RESULTS = localize('continueWithoutReviewingResults', "without reviewing result");
class GenericConfirmStore extends Disposable {
    constructor(_storageKey, _instantiationService) {
        super();
        this._storageKey = _storageKey;
        this._instantiationService = _instantiationService;
        this._memoryStore = new Set();
        this._workspaceStore = new Lazy(() => this._register(this._instantiationService.createInstance(ToolConfirmStore, 1 /* StorageScope.WORKSPACE */, this._storageKey)));
        this._profileStore = new Lazy(() => this._register(this._instantiationService.createInstance(ToolConfirmStore, 0 /* StorageScope.PROFILE */, this._storageKey)));
    }
    setAutoConfirmation(id, scope) {
        // Clear from all scopes first
        this._workspaceStore.value.setAutoConfirm(id, false);
        this._profileStore.value.setAutoConfirm(id, false);
        this._memoryStore.delete(id);
        // Set in the appropriate scope
        if (scope === 'workspace') {
            this._workspaceStore.value.setAutoConfirm(id, true);
        }
        else if (scope === 'profile') {
            this._profileStore.value.setAutoConfirm(id, true);
        }
        else if (scope === 'session') {
            this._memoryStore.add(id);
        }
    }
    getAutoConfirmation(id) {
        if (this._workspaceStore.value.getAutoConfirm(id)) {
            return 'workspace';
        }
        if (this._profileStore.value.getAutoConfirm(id)) {
            return 'profile';
        }
        if (this._memoryStore.has(id)) {
            return 'session';
        }
        return 'never';
    }
    getAutoConfirmationIn(id, scope) {
        if (scope === 'workspace') {
            return this._workspaceStore.value.getAutoConfirm(id);
        }
        else if (scope === 'profile') {
            return this._profileStore.value.getAutoConfirm(id);
        }
        else {
            return this._memoryStore.has(id);
        }
    }
    reset() {
        this._workspaceStore.value.reset();
        this._profileStore.value.reset();
        this._memoryStore.clear();
    }
    checkAutoConfirmation(id) {
        if (this._workspaceStore.value.getAutoConfirm(id)) {
            return { type: 3 /* ToolConfirmKind.LmServicePerTool */, scope: 'workspace' };
        }
        if (this._profileStore.value.getAutoConfirm(id)) {
            return { type: 3 /* ToolConfirmKind.LmServicePerTool */, scope: 'profile' };
        }
        if (this._memoryStore.has(id)) {
            return { type: 3 /* ToolConfirmKind.LmServicePerTool */, scope: 'session' };
        }
        return undefined;
    }
    getAllConfirmed() {
        const all = new Set();
        for (const key of this._workspaceStore.value.getAll()) {
            all.add(key);
        }
        for (const key of this._profileStore.value.getAll()) {
            all.add(key);
        }
        for (const key of this._memoryStore) {
            all.add(key);
        }
        return all;
    }
}
let ToolConfirmStore = class ToolConfirmStore extends Disposable {
    constructor(_scope, _storageKey, storageService) {
        super();
        this._scope = _scope;
        this._storageKey = _storageKey;
        this.storageService = storageService;
        this._autoConfirmTools = new LRUCache(100);
        this._didChange = false;
        const stored = storageService.getObject(this._storageKey, this._scope);
        if (stored) {
            for (const key of stored) {
                this._autoConfirmTools.set(key, true);
            }
        }
        this._register(storageService.onWillSaveState(() => {
            if (this._didChange) {
                this.storageService.store(this._storageKey, [...this._autoConfirmTools.keys()], this._scope, 1 /* StorageTarget.MACHINE */);
                this._didChange = false;
            }
        }));
    }
    reset() {
        this._autoConfirmTools.clear();
        this._didChange = true;
    }
    getAutoConfirm(id) {
        if (this._autoConfirmTools.get(id)) {
            this._didChange = true;
            return true;
        }
        return false;
    }
    setAutoConfirm(id, autoConfirm) {
        if (autoConfirm) {
            this._autoConfirmTools.set(id, true);
        }
        else {
            this._autoConfirmTools.delete(id);
        }
        this._didChange = true;
    }
    getAll() {
        return [...this._autoConfirmTools.keys()];
    }
};
ToolConfirmStore = __decorate([
    __param(2, IStorageService)
], ToolConfirmStore);
let LanguageModelToolsConfirmationService = class LanguageModelToolsConfirmationService extends Disposable {
    constructor(_instantiationService, _quickInputService) {
        super();
        this._instantiationService = _instantiationService;
        this._quickInputService = _quickInputService;
        this._contributions = new Map();
        this._preExecutionToolConfirmStore = this._register(new GenericConfirmStore('chat/autoconfirm', this._instantiationService));
        this._postExecutionToolConfirmStore = this._register(new GenericConfirmStore('chat/autoconfirm-post', this._instantiationService));
        this._preExecutionServerConfirmStore = this._register(new GenericConfirmStore('chat/servers/autoconfirm', this._instantiationService));
        this._postExecutionServerConfirmStore = this._register(new GenericConfirmStore('chat/servers/autoconfirm-post', this._instantiationService));
    }
    getPreConfirmAction(ref) {
        // Check contribution first
        const contribution = this._contributions.get(ref.toolId);
        if (contribution?.getPreConfirmAction) {
            const result = contribution.getPreConfirmAction(ref);
            if (result) {
                return result;
            }
        }
        // If contribution disables default approvals, don't check default stores
        if (contribution && contribution.canUseDefaultApprovals === false) {
            return undefined;
        }
        // Check tool-level confirmation
        const toolResult = this._preExecutionToolConfirmStore.checkAutoConfirmation(ref.toolId);
        if (toolResult) {
            return toolResult;
        }
        // Check server-level confirmation for MCP tools
        if (ref.source.type === 'mcp') {
            const serverResult = this._preExecutionServerConfirmStore.checkAutoConfirmation(ref.source.definitionId);
            if (serverResult) {
                return serverResult;
            }
        }
        return undefined;
    }
    getPostConfirmAction(ref) {
        // Check contribution first
        const contribution = this._contributions.get(ref.toolId);
        if (contribution?.getPostConfirmAction) {
            const result = contribution.getPostConfirmAction(ref);
            if (result) {
                return result;
            }
        }
        // If contribution disables default approvals, don't check default stores
        if (contribution && contribution.canUseDefaultApprovals === false) {
            return undefined;
        }
        // Check tool-level confirmation
        const toolResult = this._postExecutionToolConfirmStore.checkAutoConfirmation(ref.toolId);
        if (toolResult) {
            return toolResult;
        }
        // Check server-level confirmation for MCP tools
        if (ref.source.type === 'mcp') {
            const serverResult = this._postExecutionServerConfirmStore.checkAutoConfirmation(ref.source.definitionId);
            if (serverResult) {
                return serverResult;
            }
        }
        return undefined;
    }
    getPreConfirmActions(ref) {
        const actions = [];
        // Add contribution actions first
        const contribution = this._contributions.get(ref.toolId);
        if (contribution?.getPreConfirmActions) {
            actions.push(...contribution.getPreConfirmActions(ref));
        }
        // If contribution disables default approvals, only return contribution actions
        if (contribution && contribution.canUseDefaultApprovals === false) {
            return actions;
        }
        // Add default tool-level actions
        actions.push({
            label: localize('allowSession', 'Allow in this Session'),
            detail: localize('allowSessionTooltip', 'Allow this tool to run in this session without confirmation.'),
            divider: !!actions.length,
            select: async () => {
                this._preExecutionToolConfirmStore.setAutoConfirmation(ref.toolId, 'session');
                return true;
            }
        }, {
            label: localize('allowWorkspace', 'Allow in this Workspace'),
            detail: localize('allowWorkspaceTooltip', 'Allow this tool to run in this workspace without confirmation.'),
            select: async () => {
                this._preExecutionToolConfirmStore.setAutoConfirmation(ref.toolId, 'workspace');
                return true;
            }
        }, {
            label: localize('allowGlobally', 'Always Allow'),
            detail: localize('allowGloballyTooltip', 'Always allow this tool to run without confirmation.'),
            select: async () => {
                this._preExecutionToolConfirmStore.setAutoConfirmation(ref.toolId, 'profile');
                return true;
            }
        });
        // Add server-level actions for MCP tools
        if (ref.source.type === 'mcp') {
            const { serverLabel, definitionId } = ref.source;
            actions.push({
                label: localize('allowServerSession', 'Allow Tools from {0} in this Session', serverLabel),
                detail: localize('allowServerSessionTooltip', 'Allow all tools from this server to run in this session without confirmation.'),
                divider: true,
                select: async () => {
                    this._preExecutionServerConfirmStore.setAutoConfirmation(definitionId, 'session');
                    return true;
                }
            }, {
                label: localize('allowServerWorkspace', 'Allow Tools from {0} in this Workspace', serverLabel),
                detail: localize('allowServerWorkspaceTooltip', 'Allow all tools from this server to run in this workspace without confirmation.'),
                select: async () => {
                    this._preExecutionServerConfirmStore.setAutoConfirmation(definitionId, 'workspace');
                    return true;
                }
            }, {
                label: localize('allowServerGlobally', 'Always Allow Tools from {0}', serverLabel),
                detail: localize('allowServerGloballyTooltip', 'Always allow all tools from this server to run without confirmation.'),
                select: async () => {
                    this._preExecutionServerConfirmStore.setAutoConfirmation(definitionId, 'profile');
                    return true;
                }
            });
        }
        return actions;
    }
    getPostConfirmActions(ref) {
        const actions = [];
        // Add contribution actions first
        const contribution = this._contributions.get(ref.toolId);
        if (contribution?.getPostConfirmActions) {
            actions.push(...contribution.getPostConfirmActions(ref));
        }
        // If contribution disables default approvals, only return contribution actions
        if (contribution && contribution.canUseDefaultApprovals === false) {
            return actions;
        }
        // Add default tool-level actions
        actions.push({
            label: localize('allowSessionPost', 'Allow Without Review in this Session'),
            detail: localize('allowSessionPostTooltip', 'Allow results from this tool to be sent without confirmation in this session.'),
            divider: !!actions.length,
            select: async () => {
                this._postExecutionToolConfirmStore.setAutoConfirmation(ref.toolId, 'session');
                return true;
            }
        }, {
            label: localize('allowWorkspacePost', 'Allow Without Review in this Workspace'),
            detail: localize('allowWorkspacePostTooltip', 'Allow results from this tool to be sent without confirmation in this workspace.'),
            select: async () => {
                this._postExecutionToolConfirmStore.setAutoConfirmation(ref.toolId, 'workspace');
                return true;
            }
        }, {
            label: localize('allowGloballyPost', 'Always Allow Without Review'),
            detail: localize('allowGloballyPostTooltip', 'Always allow results from this tool to be sent without confirmation.'),
            select: async () => {
                this._postExecutionToolConfirmStore.setAutoConfirmation(ref.toolId, 'profile');
                return true;
            }
        });
        // Add server-level actions for MCP tools
        if (ref.source.type === 'mcp') {
            const { serverLabel, definitionId } = ref.source;
            actions.push({
                label: localize('allowServerSessionPost', 'Allow Tools from {0} Without Review in this Session', serverLabel),
                detail: localize('allowServerSessionPostTooltip', 'Allow results from all tools from this server to be sent without confirmation in this session.'),
                divider: true,
                select: async () => {
                    this._postExecutionServerConfirmStore.setAutoConfirmation(definitionId, 'session');
                    return true;
                }
            }, {
                label: localize('allowServerWorkspacePost', 'Allow Tools from {0} Without Review in this Workspace', serverLabel),
                detail: localize('allowServerWorkspacePostTooltip', 'Allow results from all tools from this server to be sent without confirmation in this workspace.'),
                select: async () => {
                    this._postExecutionServerConfirmStore.setAutoConfirmation(definitionId, 'workspace');
                    return true;
                }
            }, {
                label: localize('allowServerGloballyPost', 'Always Allow Tools from {0} Without Review', serverLabel),
                detail: localize('allowServerGloballyPostTooltip', 'Always allow results from all tools from this server to be sent without confirmation.'),
                select: async () => {
                    this._postExecutionServerConfirmStore.setAutoConfirmation(definitionId, 'profile');
                    return true;
                }
            });
        }
        return actions;
    }
    registerConfirmationContribution(toolName, contribution) {
        this._contributions.set(toolName, contribution);
        return {
            dispose: () => {
                this._contributions.delete(toolName);
            }
        };
    }
    manageConfirmationPreferences(tools, options) {
        // Helper to track tools under servers
        const trackServerTool = (serverId, label, toolId, serversWithTools) => {
            if (!serversWithTools.has(serverId)) {
                serversWithTools.set(serverId, { label, tools: new Set() });
            }
            serversWithTools.get(serverId).tools.add(toolId);
        };
        // Helper to add server tool from source
        const addServerToolFromSource = (source, toolId, serversWithTools) => {
            if (source.type === 'mcp') {
                trackServerTool(source.definitionId, source.serverLabel || source.label, toolId, serversWithTools);
            }
            else if (source.type === 'extension') {
                trackServerTool(source.extensionId.value, source.label, toolId, serversWithTools);
            }
        };
        // Determine which tools should be shown
        const relevantTools = new Set();
        const serversWithTools = new Map();
        // Add tools that request approval
        for (const tool of tools) {
            if (tool.canRequestPreApproval || tool.canRequestPostApproval || this._contributions.has(tool.id)) {
                relevantTools.add(tool.id);
                addServerToolFromSource(tool.source, tool.id, serversWithTools);
            }
        }
        // Add tools that have stored approvals (but we can't display them without metadata)
        for (const id of this._preExecutionToolConfirmStore.getAllConfirmed()) {
            if (!relevantTools.has(id)) {
                // Only add if we have the tool data
                const tool = tools.find(t => t.id === id);
                if (tool) {
                    relevantTools.add(id);
                    addServerToolFromSource(tool.source, id, serversWithTools);
                }
            }
        }
        for (const id of this._postExecutionToolConfirmStore.getAllConfirmed()) {
            if (!relevantTools.has(id)) {
                // Only add if we have the tool data
                const tool = tools.find(t => t.id === id);
                if (tool) {
                    relevantTools.add(id);
                    addServerToolFromSource(tool.source, id, serversWithTools);
                }
            }
        }
        if (relevantTools.size === 0) {
            return; // Nothing to show
        }
        // Determine initial scope from options
        let currentScope = options?.defaultScope ?? 'workspace';
        // Helper function to build tree items based on current scope
        const buildTreeItems = () => {
            const treeItems = [];
            // Add server nodes
            for (const [serverId, serverInfo] of serversWithTools) {
                const serverChildren = [];
                // Add server-level controls as first children
                const hasAnyPre = Array.from(serverInfo.tools).some(toolId => {
                    const tool = tools.find(t => t.id === toolId);
                    return tool?.canRequestPreApproval;
                });
                const hasAnyPost = Array.from(serverInfo.tools).some(toolId => {
                    const tool = tools.find(t => t.id === toolId);
                    return tool?.canRequestPostApproval;
                });
                const serverPreConfirmed = this._preExecutionServerConfirmStore.getAutoConfirmationIn(serverId, currentScope);
                const serverPostConfirmed = this._postExecutionServerConfirmStore.getAutoConfirmationIn(serverId, currentScope);
                // Add individual tools from this server as children
                for (const toolId of serverInfo.tools) {
                    const tool = tools.find(t => t.id === toolId);
                    if (!tool) {
                        continue;
                    }
                    const toolChildren = [];
                    const hasPre = !serverPreConfirmed && (tool.canRequestPreApproval || this._preExecutionToolConfirmStore.getAutoConfirmationIn(tool.id, currentScope));
                    const hasPost = !serverPostConfirmed && (tool.canRequestPostApproval || this._postExecutionToolConfirmStore.getAutoConfirmationIn(tool.id, currentScope));
                    // Add child items for granular control when both approval types exist
                    if (hasPre && hasPost) {
                        toolChildren.push({
                            type: 'tool-pre',
                            toolId: tool.id,
                            label: RUN_WITHOUT_APPROVAL,
                            checked: this._preExecutionToolConfirmStore.getAutoConfirmationIn(tool.id, currentScope)
                        });
                        toolChildren.push({
                            type: 'tool-post',
                            toolId: tool.id,
                            label: CONTINUE_WITHOUT_REVIEWING_RESULTS,
                            checked: this._postExecutionToolConfirmStore.getAutoConfirmationIn(tool.id, currentScope)
                        });
                    }
                    // Tool item always has a checkbox
                    const preApproval = this._preExecutionToolConfirmStore.getAutoConfirmationIn(tool.id, currentScope);
                    const postApproval = this._postExecutionToolConfirmStore.getAutoConfirmationIn(tool.id, currentScope);
                    let checked;
                    let description;
                    if (hasPre && hasPost) {
                        // Both: checkbox is mixed if only one is enabled
                        checked = preApproval && postApproval ? true : (!preApproval && !postApproval ? false : 'mixed');
                    }
                    else if (hasPre) {
                        checked = preApproval;
                        description = RUN_WITHOUT_APPROVAL;
                    }
                    else if (hasPost) {
                        checked = postApproval;
                        description = CONTINUE_WITHOUT_REVIEWING_RESULTS;
                    }
                    else {
                        continue;
                    }
                    serverChildren.push({
                        type: 'tool',
                        toolId: tool.id,
                        label: tool.displayName || tool.id,
                        description,
                        checked,
                        collapsed: true,
                        children: toolChildren.length > 0 ? toolChildren : undefined
                    });
                }
                serverChildren.sort((a, b) => a.label.localeCompare(b.label));
                if (hasAnyPost) {
                    serverChildren.unshift({
                        type: 'server-post',
                        serverId,
                        iconClass: ThemeIcon.asClassName(Codicon.play),
                        label: localize('continueWithoutReviewing', "Continue without reviewing any tool results"),
                        checked: serverPostConfirmed
                    });
                }
                if (hasAnyPre) {
                    serverChildren.unshift({
                        type: 'server-pre',
                        serverId,
                        iconClass: ThemeIcon.asClassName(Codicon.play),
                        label: localize('runToolsWithoutApproval', "Run any tool without approval"),
                        checked: serverPreConfirmed
                    });
                }
                // Server node has checkbox to control both pre and post
                const serverHasPre = this._preExecutionServerConfirmStore.getAutoConfirmationIn(serverId, currentScope);
                const serverHasPost = this._postExecutionServerConfirmStore.getAutoConfirmationIn(serverId, currentScope);
                let serverChecked;
                if (hasAnyPre && hasAnyPost) {
                    serverChecked = serverHasPre && serverHasPost ? true : (!serverHasPre && !serverHasPost ? false : 'mixed');
                }
                else if (hasAnyPre) {
                    serverChecked = serverHasPre;
                }
                else if (hasAnyPost) {
                    serverChecked = serverHasPost;
                }
                else {
                    serverChecked = false;
                }
                const existingItem = quickTree.itemTree.find(i => i.serverId === serverId);
                treeItems.push({
                    type: 'server',
                    serverId,
                    label: serverInfo.label,
                    checked: serverChecked,
                    children: serverChildren,
                    collapsed: existingItem ? quickTree.isCollapsed(existingItem) : true,
                    pickable: false
                });
            }
            // Add individual tool nodes (only for non-MCP/extension tools)
            const sortedTools = tools.slice().sort((a, b) => a.displayName.localeCompare(b.displayName));
            for (const tool of sortedTools) {
                if (!relevantTools.has(tool.id)) {
                    continue;
                }
                // Skip tools that belong to MCP/extension servers (they're shown under server nodes)
                if (tool.source.type === 'mcp' || tool.source.type === 'extension') {
                    continue;
                }
                const contributed = this._contributions.get(tool.id);
                const toolChildren = [];
                const manageActions = contributed?.getManageActions?.();
                if (manageActions) {
                    toolChildren.push(...manageActions.map(action => ({
                        type: 'manage',
                        ...action,
                    })));
                }
                let checked = false;
                let description;
                let pickable = false;
                if (contributed?.canUseDefaultApprovals !== false) {
                    pickable = true;
                    const hasPre = tool.canRequestPreApproval || this._preExecutionToolConfirmStore.getAutoConfirmationIn(tool.id, currentScope);
                    const hasPost = tool.canRequestPostApproval || this._postExecutionToolConfirmStore.getAutoConfirmationIn(tool.id, currentScope);
                    // Add child items for granular control when both approval types exist
                    if (hasPre && hasPost) {
                        toolChildren.push({
                            type: 'tool-pre',
                            toolId: tool.id,
                            label: RUN_WITHOUT_APPROVAL,
                            checked: this._preExecutionToolConfirmStore.getAutoConfirmationIn(tool.id, currentScope)
                        });
                        toolChildren.push({
                            type: 'tool-post',
                            toolId: tool.id,
                            label: CONTINUE_WITHOUT_REVIEWING_RESULTS,
                            checked: this._postExecutionToolConfirmStore.getAutoConfirmationIn(tool.id, currentScope)
                        });
                    }
                    // Tool item always has a checkbox
                    const preApproval = this._preExecutionToolConfirmStore.getAutoConfirmationIn(tool.id, currentScope);
                    const postApproval = this._postExecutionToolConfirmStore.getAutoConfirmationIn(tool.id, currentScope);
                    if (hasPre && hasPost) {
                        // Both: checkbox is mixed if only one is enabled
                        checked = preApproval && postApproval ? true : (!preApproval && !postApproval ? false : 'mixed');
                    }
                    else if (hasPre) {
                        checked = preApproval;
                        description = RUN_WITHOUT_APPROVAL;
                    }
                    else if (hasPost) {
                        checked = postApproval;
                        description = CONTINUE_WITHOUT_REVIEWING_RESULTS;
                    }
                    else {
                        // No approval capabilities - shouldn't happen but handle it
                        checked = false;
                    }
                }
                treeItems.push({
                    type: 'tool',
                    toolId: tool.id,
                    label: tool.displayName || tool.id,
                    description,
                    checked,
                    pickable,
                    collapsed: true,
                    children: toolChildren.length > 0 ? toolChildren : undefined
                });
            }
            return treeItems;
        };
        const disposables = new DisposableStore();
        const quickTree = disposables.add(this._quickInputService.createQuickTree());
        quickTree.ignoreFocusOut = true;
        quickTree.sortByLabel = false;
        // Only show toggle if not in session scope
        if (currentScope !== 'session') {
            const scopeToggle = disposables.add(new Toggle({
                title: localize('workspaceScope', "Configure for this workspace only"),
                icon: Codicon.folder,
                isChecked: currentScope === 'workspace',
                inputActiveOptionBorder: asCssVariable(inputActiveOptionBorder),
                inputActiveOptionForeground: asCssVariable(inputActiveOptionForeground),
                inputActiveOptionBackground: asCssVariable(inputActiveOptionBackground)
            }));
            quickTree.toggles = [scopeToggle];
            disposables.add(scopeToggle.onChange(() => {
                currentScope = currentScope === 'workspace' ? 'profile' : 'workspace';
                updatePlaceholder();
                quickTree.setItemTree(buildTreeItems());
            }));
        }
        const updatePlaceholder = () => {
            if (currentScope === 'session') {
                quickTree.placeholder = localize('configureSessionToolApprovals', "Configure session tool approvals");
            }
            else {
                quickTree.placeholder = currentScope === 'workspace'
                    ? localize('configureWorkspaceToolApprovals', "Configure workspace tool approvals")
                    : localize('configureGlobalToolApprovals', "Configure global tool approvals");
            }
        };
        updatePlaceholder();
        quickTree.setItemTree(buildTreeItems());
        disposables.add(quickTree.onDidChangeCheckboxState(item => {
            const newState = item.checked ? currentScope : 'never';
            if (item.type === 'server' && item.serverId) {
                // Server-level checkbox: update both pre and post based on server capabilities
                const serverInfo = serversWithTools.get(item.serverId);
                if (serverInfo) {
                    this._preExecutionServerConfirmStore.setAutoConfirmation(item.serverId, newState);
                    this._postExecutionServerConfirmStore.setAutoConfirmation(item.serverId, newState);
                }
            }
            else if (item.type === 'tool' && item.toolId) {
                const tool = tools.find(t => t.id === item.toolId);
                if (tool?.canRequestPostApproval || newState === 'never') {
                    this._postExecutionToolConfirmStore.setAutoConfirmation(item.toolId, newState);
                }
                if (tool?.canRequestPreApproval || newState === 'never') {
                    this._preExecutionToolConfirmStore.setAutoConfirmation(item.toolId, newState);
                }
            }
            else if (item.type === 'tool-pre' && item.toolId) {
                this._preExecutionToolConfirmStore.setAutoConfirmation(item.toolId, newState);
            }
            else if (item.type === 'tool-post' && item.toolId) {
                this._postExecutionToolConfirmStore.setAutoConfirmation(item.toolId, newState);
            }
            else if (item.type === 'server-pre' && item.serverId) {
                this._preExecutionServerConfirmStore.setAutoConfirmation(item.serverId, newState);
                quickTree.setItemTree(buildTreeItems());
            }
            else if (item.type === 'server-post' && item.serverId) {
                this._postExecutionServerConfirmStore.setAutoConfirmation(item.serverId, newState);
                quickTree.setItemTree(buildTreeItems());
            }
            else if (item.type === 'manage') {
                item.onDidChangeChecked?.(!!item.checked);
            }
        }));
        disposables.add(quickTree.onDidTriggerItemButton(i => {
            if (i.item.type === 'manage') {
                i.item.onDidTriggerItemButton?.(i.button);
            }
        }));
        disposables.add(quickTree.onDidAccept(() => {
            for (const item of quickTree.activeItems) {
                if (item.type === 'manage') {
                    item.onDidOpen?.();
                }
            }
            quickTree.hide();
        }));
        disposables.add(quickTree.onDidHide(() => {
            disposables.dispose();
        }));
        quickTree.show();
    }
    resetToolAutoConfirmation() {
        this._preExecutionToolConfirmStore.reset();
        this._postExecutionToolConfirmStore.reset();
        this._preExecutionServerConfirmStore.reset();
        this._postExecutionServerConfirmStore.reset();
        // Reset all contributions
        for (const contribution of this._contributions.values()) {
            contribution.reset?.();
        }
    }
};
LanguageModelToolsConfirmationService = __decorate([
    __param(0, IInstantiationService),
    __param(1, IQuickInputService)
], LanguageModelToolsConfirmationService);
export { LanguageModelToolsConfirmationService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFuZ3VhZ2VNb2RlbFRvb2xzQ29uZmlybWF0aW9uU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvbGFuZ3VhZ2VNb2RlbFRvb2xzQ29uZmlybWF0aW9uU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDdEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxrQkFBa0IsRUFBa0IsTUFBTSxzREFBc0QsQ0FBQztBQUMxRyxPQUFPLEVBQUUsZUFBZSxFQUErQixNQUFNLGdEQUFnRCxDQUFDO0FBQzlHLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSx1QkFBdUIsRUFBRSwyQkFBMkIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3ZKLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUtoRixNQUFNLG9CQUFvQixHQUFHLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO0FBQ2hGLE1BQU0sa0NBQWtDLEdBQUcsUUFBUSxDQUFDLGlD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