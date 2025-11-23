/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { assertNever } from '../../../../../base/common/assert.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { createMarkdownCommandLink } from '../../../../../base/common/htmlContent.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import Severity from '../../../../../base/common/severity.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IExtensionsWorkbenchService } from '../../../extensions/common/extensions.js';
import { IMcpRegistry } from '../../../mcp/common/mcpRegistryTypes.js';
import { IMcpService, IMcpWorkbenchService } from '../../../mcp/common/mcpTypes.js';
import { startServerAndWaitForLiveTools } from '../../../mcp/common/mcpTypesUtils.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { ILanguageModelToolsService, ToolDataSource } from '../../common/languageModelToolsService.js';
import { ConfigureToolSets } from '../tools/toolSetsContribution.js';
var BucketOrdinal;
(function (BucketOrdinal) {
    BucketOrdinal[BucketOrdinal["User"] = 0] = "User";
    BucketOrdinal[BucketOrdinal["BuiltIn"] = 1] = "BuiltIn";
    BucketOrdinal[BucketOrdinal["Mcp"] = 2] = "Mcp";
    BucketOrdinal[BucketOrdinal["Extension"] = 3] = "Extension";
})(BucketOrdinal || (BucketOrdinal = {}));
// Type guards for new QuickTree types
function isBucketTreeItem(item) {
    return item.itemType === 'bucket';
}
function isToolSetTreeItem(item) {
    return item.itemType === 'toolset';
}
function isToolTreeItem(item) {
    return item.itemType === 'tool';
}
function isCallbackTreeItem(item) {
    return item.itemType === 'callback';
}
/**
 * Maps different icon types (ThemeIcon or URI-based) to QuickTreeItem icon properties.
 * Handles the conversion between ToolSet/IToolData icon formats and tree item requirements.
 * Provides a default tool icon when no icon is specified.
 *
 * @param icon - Icon to map (ThemeIcon, URI object, or undefined)
 * @param useDefaultToolIcon - Whether to use a default tool icon when none is provided
 * @returns Object with iconClass (for ThemeIcon) or iconPath (for URIs) properties
 */
function mapIconToTreeItem(icon, useDefaultToolIcon = false) {
    if (!icon) {
        if (useDefaultToolIcon) {
            return { iconClass: ThemeIcon.asClassName(Codicon.tools) };
        }
        return {};
    }
    if (ThemeIcon.isThemeIcon(icon)) {
        return { iconClass: ThemeIcon.asClassName(icon) };
    }
    else {
        return { iconPath: icon };
    }
}
function createToolTreeItemFromData(tool, checked) {
    const iconProps = mapIconToTreeItem(tool.icon, true); // Use default tool icon if none provided
    return {
        itemType: 'tool',
        tool,
        id: tool.id,
        label: tool.toolReferenceName ?? tool.displayName,
        description: tool.userDescription ?? tool.modelDescription,
        checked,
        ...iconProps
    };
}
function createToolSetTreeItem(toolset, checked, editorService) {
    const iconProps = mapIconToTreeItem(toolset.icon);
    const buttons = [];
    if (toolset.source.type === 'user') {
        const resource = toolset.source.file;
        buttons.push({
            iconClass: ThemeIcon.asClassName(Codicon.edit),
            tooltip: localize('editUserBucket', "Edit Tool Set"),
            action: () => editorService.openEditor({ resource })
        });
    }
    return {
        itemType: 'toolset',
        toolset,
        buttons,
        id: toolset.id,
        label: toolset.referenceName,
        description: toolset.description,
        checked,
        children: undefined,
        collapsed: true,
        ...iconProps
    };
}
/**
 * New QuickTree implementation of the tools picker.
 * Uses IQuickTree to provide a true hierarchical tree structure with:
 * - Collapsible nodes for buckets and toolsets
 * - Checkbox state management with parent-child relationships
 * - Special handling for MCP servers (server as bucket, tools as direct children)
 * - Built-in filtering and search capabilities
 *
 * @param accessor - Service accessor for dependency injection
 * @param placeHolder - Placeholder text shown in the picker
 * @param description - Optional description text shown in the picker
 * @param toolsEntries - Optional initial selection state for tools and toolsets
 * @param onUpdate - Optional callback fired when the selection changes
 * @returns Promise resolving to the final selection map, or undefined if cancelled
 */
export async function showToolsPicker(accessor, placeHolder, description, getToolsEntries) {
    const quickPickService = accessor.get(IQuickInputService);
    const mcpService = accessor.get(IMcpService);
    const mcpRegistry = accessor.get(IMcpRegistry);
    const commandService = accessor.get(ICommandService);
    const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
    const editorService = accessor.get(IEditorService);
    const mcpWorkbenchService = accessor.get(IMcpWorkbenchService);
    const toolsService = accessor.get(ILanguageModelToolsService);
    const toolLimit = accessor.get(IContextKeyService).getContextKeyValue(ChatContextKeys.chatToolGroupingThreshold.key);
    const mcpServerByTool = new Map();
    for (const server of mcpService.servers.get()) {
        for (const tool of server.tools.get()) {
            mcpServerByTool.set(tool.id, server);
        }
    }
    function computeItems(previousToolsEntries) {
        // Create default entries if none provided
        let toolsEntries = getToolsEntries ? new Map(getToolsEntries()) : undefined;
        if (!toolsEntries) {
            const defaultEntries = new Map();
            for (const tool of toolsService.getTools()) {
                if (tool.canBeReferencedInPrompt) {
                    defaultEntries.set(tool, false);
                }
            }
            for (const toolSet of toolsService.toolSets.get()) {
                defaultEntries.set(toolSet, false);
            }
            toolsEntries = defaultEntries;
        }
        previousToolsEntries?.forEach((value, key) => {
            toolsEntries.set(key, value);
        });
        // Build tree structure
        const treeItems = [];
        const bucketMap = new Map();
        const getKey = (source) => {
            switch (source.type) {
                case 'mcp':
                case 'extension':
                    return ToolDataSource.toKey(source);
                case 'internal':
                    return 1 /* BucketOrdinal.BuiltIn */.toString();
                case 'user':
                    return 0 /* BucketOrdinal.User */.toString();
                case 'external':
                    throw new Error('should not be reachable');
                default:
                    assertNever(source);
            }
        };
        const mcpServers = new Map(mcpService.servers.get().map(s => [s.definition.id, { server: s, seen: false }]));
        const createBucket = (source, key) => {
            if (source.type === 'mcp') {
                const mcpServerEntry = mcpServers.get(source.definitionId);
                if (!mcpServerEntry) {
                    return undefined;
                }
                mcpServerEntry.seen = true;
                const mcpServer = mcpServerEntry.server;
                const buttons = [];
                const collection = mcpRegistry.collections.get().find(c => c.id === mcpServer.collection.id);
                if (collection?.source) {
                    buttons.push({
                        iconClass: ThemeIcon.asClassName(Codicon.settingsGear),
                        tooltip: localize('configMcpCol', "Configure {0}", collection.label),
                        action: () => collection.source ? collection.source instanceof ExtensionIdentifier ? extensionsWorkbenchService.open(collection.source.value, { tab: "features" /* ExtensionEditorTab.Features */, feature: 'mcp' }) : mcpWorkbenchService.open(collection.source, { tab: "configuration" /* McpServerEditorTab.Configuration */ }) : undefined
                    });
                }
                else if (collection?.presentation?.origin) {
                    buttons.push({
                        iconClass: ThemeIcon.asClassName(Codicon.settingsGear),
                        tooltip: localize('configMcpCol', "Configure {0}", collection.label),
                        action: () => editorService.openEditor({
                            resource: collection.presentation.origin,
                        })
                    });
                }
                if (mcpServer.connectionState.get().state === 3 /* McpConnectionState.Kind.Error */) {
                    buttons.push({
                        iconClass: ThemeIcon.asClassName(Codicon.warning),
                        tooltip: localize('mcpShowOutput', "Show Output"),
                        action: () => mcpServer.showOutput(),
                    });
                }
                const cacheState = mcpServer.cacheState.get();
                const children = [];
                let collapsed = true;
                if (cacheState === 0 /* McpServerCacheState.Unknown */ || cacheState === 2 /* McpServerCacheState.Outdated */) {
                    collapsed = false;
                    children.push({
                        itemType: 'callback',
                        iconClass: ThemeIcon.asClassName(Codicon.sync),
                        label: localize('mcpUpdate', "Update Tools"),
                        pickable: false,
                        run: () => {
                            treePicker.busy = true;
                            (async () => {
                                const ok = await startServerAndWaitForLiveTools(mcpServer, { promptType: 'all-untrusted' });
                                if (!ok) {
                                    mcpServer.showOutput();
                                    treePicker.hide();
                                    return;
                                }
                                treePicker.busy = false;
                                computeItems(collectResults());
                            })();
                            return false;
                        },
                    });
                }
                const bucket = {
                    itemType: 'bucket',
                    ordinal: 2 /* BucketOrdinal.Mcp */,
                    id: key,
                    label: source.label,
                    checked: undefined,
                    collapsed,
                    children,
                    buttons,
                    sortOrder: 2,
                };
                const iconPath = mcpServer.serverMetadata.get()?.icons.getUrl(22);
                if (iconPath) {
                    bucket.iconPath = iconPath;
                }
                else {
                    bucket.iconClass = ThemeIcon.asClassName(Codicon.mcp);
                }
                return bucket;
            }
            else if (source.type === 'extension') {
                return {
                    itemType: 'bucket',
                    ordinal: 3 /* BucketOrdinal.Extension */,
                    id: key,
                    label: source.label,
                    checked: undefined,
                    children: [],
                    buttons: [],
                    collapsed: true,
                    iconClass: ThemeIcon.asClassName(Codicon.extensions),
                    sortOrder: 3,
                };
            }
            else if (source.type === 'internal') {
                return {
                    itemType: 'bucket',
                    ordinal: 1 /* BucketOrdinal.BuiltIn */,
                    id: key,
                    label: localize('defaultBucketLabel', "Built-In"),
                    checked: undefined,
                    children: [],
                    buttons: [],
                    collapsed: false,
                    sortOrder: 1,
                };
            }
            else {
                return {
                    itemType: 'bucket',
                    ordinal: 0 /* BucketOrdinal.User */,
                    id: key,
                    label: localize('userBucket', "User Defined Tool Sets"),
                    checked: undefined,
                    children: [],
                    buttons: [],
                    collapsed: true,
                    sortOrder: 4,
                };
            }
        };
        const getBucket = (source) => {
            const key = getKey(source);
            let bucket = bucketMap.get(key);
            if (!bucket) {
                bucket = createBucket(source, key);
                if (bucket) {
                    bucketMap.set(key, bucket);
                }
            }
            return bucket;
        };
        for (const toolSet of toolsService.toolSets.get()) {
            if (!toolsEntries.has(toolSet)) {
                continue;
            }
            const bucket = getBucket(toolSet.source);
            if (!bucket) {
                continue;
            }
            const toolSetChecked = toolsEntries.get(toolSet) === true;
            if (toolSet.source.type === 'mcp') {
                // bucket represents the toolset
                bucket.toolset = toolSet;
                if (toolSetChecked) {
                    bucket.checked = toolSetChecked;
                }
                // all mcp tools are part of toolsService.getTools()
            }
            else {
                const treeItem = createToolSetTreeItem(toolSet, toolSetChecked, editorService);
                bucket.children.push(treeItem);
                const children = [];
                for (const tool of toolSet.getTools()) {
                    const toolChecked = toolSetChecked || toolsEntries.get(tool) === true;
                    const toolTreeItem = createToolTreeItemFromData(tool, toolChecked);
                    children.push(toolTreeItem);
                }
                if (children.length > 0) {
                    treeItem.children = children;
                }
            }
        }
        for (const tool of toolsService.getTools()) {
            if (!tool.canBeReferencedInPrompt || !toolsEntries.has(tool)) {
                continue;
            }
            const bucket = getBucket(tool.source);
            if (!bucket) {
                continue;
            }
            const toolChecked = bucket.checked === true || toolsEntries.get(tool) === true;
            const toolTreeItem = createToolTreeItemFromData(tool, toolChecked);
            bucket.children.push(toolTreeItem);
        }
        // Show entries for MCP servers that don't have any tools in them and might need to be started.
        for (const { server, seen } of mcpServers.values()) {
            const cacheState = server.cacheState.get();
            if (!seen && (cacheState === 0 /* McpServerCacheState.Unknown */ || cacheState === 2 /* McpServerCacheState.Outdated */)) {
                getBucket({ type: 'mcp', definitionId: server.definition.id, label: server.definition.label, instructions: '', serverLabel: '', collectionId: server.collection.id });
            }
        }
        // Convert bucket map to sorted tree items
        const sortedBuckets = Array.from(bucketMap.values()).sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) {
                return a.sortOrder - b.sortOrder;
            }
            return a.label.localeCompare(b.label);
        });
        for (const bucket of sortedBuckets) {
            treeItems.push(bucket);
            // Sort children alphabetically
            bucket.children.sort((a, b) => a.label.localeCompare(b.label));
            for (const child of bucket.children) {
                if (isToolSetTreeItem(child) && child.children) {
                    child.children.sort((a, b) => a.label.localeCompare(b.label));
                }
            }
        }
        if (treeItems.length === 0) {
            treePicker.placeholder = localize('noTools', "Add tools to chat");
        }
        else {
            treePicker.placeholder = placeHolder;
        }
        treePicker.setItemTree(treeItems);
    }
    // Create and configure the tree picker
    const store = new DisposableStore();
    const treePicker = store.add(quickPickService.createQuickTree());
    treePicker.placeholder = placeHolder;
    treePicker.ignoreFocusOut = true;
    treePicker.description = description;
    treePicker.matchOnDescription = true;
    treePicker.matchOnLabel = true;
    treePicker.sortByLabel = false;
    computeItems();
    // Handle button triggers
    store.add(treePicker.onDidTriggerItemButton(e => {
        if (e.button && typeof e.button.action === 'function') {
            e.button.action();
            store.dispose();
        }
    }));
    const updateToolLimitMessage = () => {
        if (toolLimit) {
            let count = 0;
            const traverse = (items) => {
                for (const item of items) {
                    if (isBucketTreeItem(item) || isToolSetTreeItem(item)) {
                        if (item.children) {
                            traverse(item.children);
                        }
                    }
                    else if (isToolTreeItem(item) && item.checked) {
                        count++;
                    }
                }
            };
            traverse(treePicker.itemTree);
            if (count > toolLimit) {
                treePicker.severity = Severity.Warning;
                treePicker.validationMessage = localize('toolLimitExceeded', "{0} tools are enabled. You may experience degraded tool calling above {1} tools.", count, createMarkdownCommandLink({ title: String(toolLimit), id: '_chat.toolPicker.closeAndOpenVirtualThreshold' }));
            }
            else {
                treePicker.severity = Severity.Ignore;
                treePicker.validationMessage = undefined;
            }
        }
    };
    updateToolLimitMessage();
    const collectResults = () => {
        const result = new Map();
        const traverse = (items) => {
            for (const item of items) {
                if (isBucketTreeItem(item)) {
                    if (item.toolset) { // MCP server
                        // MCP toolset is enabled only if all tools are enabled
                        const allChecked = item.checked === true;
                        result.set(item.toolset, allChecked);
                    }
                    traverse(item.children);
                }
                else if (isToolSetTreeItem(item)) {
                    result.set(item.toolset, item.checked === true);
                    if (item.children) {
                        traverse(item.children);
                    }
                }
                else if (isToolTreeItem(item)) {
                    result.set(item.tool, item.checked || result.get(item.tool) === true); // tools can be in user tool sets and other buckets
                }
            }
        };
        traverse(treePicker.itemTree);
        return result;
    };
    // Temporary command to close the picker and open settings, for use in the validation message
    store.add(CommandsRegistry.registerCommand({
        id: '_chat.toolPicker.closeAndOpenVirtualThreshold',
        handler: () => {
            treePicker.hide();
            commandService.executeCommand('workbench.action.openSettings', 'github.copilot.chat.virtualTools.threshold');
        }
    }));
    // Handle checkbox state changes
    store.add(treePicker.onDidChangeCheckedLeafItems(() => updateToolLimitMessage()));
    // Handle acceptance
    let didAccept = false;
    const didAcceptFinalItem = store.add(new Emitter());
    store.add(treePicker.onDidAccept(() => {
        // Check if a callback item was activated
        const activeItems = treePicker.activeItems;
        const callbackItem = activeItems.find(isCallbackTreeItem);
        if (!callbackItem) {
            didAccept = true;
            treePicker.hide();
            return;
        }
        const ret = callbackItem.run();
        if (ret !== false) {
            didAcceptFinalItem.fire();
        }
    }));
    const addMcpServerButton = {
        iconClass: ThemeIcon.asClassName(Codicon.mcp),
        tooltip: localize('addMcpServer', 'Add MCP Server...')
    };
    const installExtension = {
        iconClass: ThemeIcon.asClassName(Codicon.extensions),
        tooltip: localize('addExtensionButton', 'Install Extension...')
    };
    const configureToolSets = {
        iconClass: ThemeIcon.asClassName(Codicon.gear),
        tooltip: localize('configToolSets', 'Configure Tool Sets...')
    };
    treePicker.title = localize('configureTools', "Configure Tools");
    treePicker.buttons = [addMcpServerButton, installExtension, configureToolSets];
    store.add(treePicker.onDidTriggerButton(button => {
        if (button === addMcpServerButton) {
            commandService.executeCommand("workbench.mcp.addConfiguration" /* McpCommandIds.AddConfiguration */);
        }
        else if (button === installExtension) {
            extensionsWorkbenchService.openSearch('@tag:language-model-tools');
        }
        else if (button === configureToolSets) {
            commandService.executeCommand(ConfigureToolSets.ID);
        }
        treePicker.hide();
    }));
    treePicker.show();
    await Promise.race([Event.toPromise(Event.any(treePicker.onDidHide, didAcceptFinalItem.event), store)]);
    store.dispose();
    return didAccept ? collectResults() : undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvb2xQaWNrZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2FjdGlvbnMvY2hhdFRvb2xQaWNrZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFDaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMxRSxPQUFPLFFBQVEsTUFBTSx3Q0FBd0MsQ0FBQztBQUM5RCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFFcEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxlQUFlLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN4RyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM3RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUU5RixPQUFPLEVBQXFCLGtCQUFrQixFQUFrQyxNQUFNLHlEQUF5RCxDQUFDO0FBQ2hKLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNyRixPQUFPLEVBQXNCLDJCQUEyQixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFM0csT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3ZFLE9BQU8sRUFBYyxXQUFXLEVBQUUsb0JBQW9C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