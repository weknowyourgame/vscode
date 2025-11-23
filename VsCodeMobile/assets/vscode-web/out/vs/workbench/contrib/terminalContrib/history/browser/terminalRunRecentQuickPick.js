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
var TerminalOutputProvider_1;
import { Toggle } from '../../../../../base/browser/ui/toggle/toggle.js';
import { isMacintosh } from '../../../../../base/common/platform.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../../nls.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { collapseTildePath } from '../../../../../platform/terminal/common/terminalEnvironment.js';
import { asCssVariable, inputActiveOptionBackground, inputActiveOptionBorder, inputActiveOptionForeground } from '../../../../../platform/theme/common/colorRegistry.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { commandHistoryFuzzySearchIcon, commandHistoryOpenFileIcon, commandHistoryOutputIcon, commandHistoryRemoveIcon } from '../../../terminal/browser/terminalIcons.js';
import { terminalStrings } from '../../../terminal/common/terminalStrings.js';
import { URI } from '../../../../../base/common/uri.js';
import { fromNow } from '../../../../../base/common/date.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { showWithPinnedItems } from '../../../../../platform/quickinput/browser/quickPickPin.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IAccessibleViewService } from '../../../../../platform/accessibility/browser/accessibleView.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { getCommandHistory, getDirectoryHistory, getShellFileHistory } from '../common/history.js';
import { ResourceSet } from '../../../../../base/common/map.js';
import { extUri, extUriIgnorePathCase } from '../../../../../base/common/resources.js';
import { IPathService } from '../../../../services/path/common/pathService.js';
import { isObject } from '../../../../../base/common/types.js';
export async function showRunRecentQuickPick(accessor, instance, terminalInRunCommandPicker, type, filterMode, value) {
    if (!instance.xterm) {
        return;
    }
    const accessibleViewService = accessor.get(IAccessibleViewService);
    const editorService = accessor.get(IEditorService);
    const instantiationService = accessor.get(IInstantiationService);
    const quickInputService = accessor.get(IQuickInputService);
    const storageService = accessor.get(IStorageService);
    const pathService = accessor.get(IPathService);
    const runRecentStorageKey = `${"terminal.pinnedRecentCommands" /* TerminalStorageKeys.PinnedRecentCommandsPrefix */}.${instance.shellType}`;
    let placeholder;
    let items = [];
    const commandMap = new Set();
    const removeFromCommandHistoryButton = {
        iconClass: ThemeIcon.asClassName(commandHistoryRemoveIcon),
        tooltip: localize('removeCommand', "Remove from Command History")
    };
    const commandOutputButton = {
        iconClass: ThemeIcon.asClassName(commandHistoryOutputIcon),
        tooltip: localize('viewCommandOutput', "View Command Output"),
        alwaysVisible: false
    };
    const openResourceButtons = [];
    if (type === 'command') {
        placeholder = isMacintosh ? localize('selectRecentCommandMac', 'Select a command to run (hold Option-key to edit the command)') : localize('selectRecentCommand', 'Select a command to run (hold Alt-key to edit the command)');
        const cmdDetection = instance.capabilities.get(2 /* TerminalCapability.CommandDetection */);
        const commands = cmdDetection?.commands;
        // Current session history
        const executingCommand = cmdDetection?.executingCommand;
        if (executingCommand) {
            commandMap.add(executingCommand);
        }
        function formatLabel(label) {
            return label
                // Replace new lines with "enter" symbol
                .replace(/\r?\n/g, '\u23CE')
                // Replace 3 or more spaces with midline horizontal ellipsis which looks similar
                // to whitespace in the editor
                .replace(/\s\s\s+/g, '\u22EF');
        }
        if (commands && commands.length > 0) {
            for (let i = commands.length - 1; i >= 0; i--) {
                const entry = commands[i];
                // Trim off any whitespace and/or line endings, replace new lines with the
                // Downwards Arrow with Corner Leftwards symbol
                const label = entry.command.trim();
                if (label.length === 0 || commandMap.has(label)) {
                    continue;
                }
                let description = collapseTildePath(entry.cwd, instance.userHome, instance.os === 1 /* OperatingSystem.Windows */ ? '\\' : '/');
                if (entry.exitCode) {
                    // Since you cannot get the last command's exit code on pwsh, just whether it failed
                    // or not, -1 is treated specially as simply failed
                    if (entry.exitCode === -1) {
                        description += ' failed';
                    }
                    else {
                        description += ` exitCode: ${entry.exitCode}`;
                    }
                }
                description = description.trim();
                const buttons = [commandOutputButton];
                // Merge consecutive commands
                const lastItem = items.length > 0 ? items[items.length - 1] : undefined;
                if (lastItem?.type !== 'separator' && lastItem?.label === label) {
                    lastItem.id = entry.timestamp.toString();
                    lastItem.description = description;
                    continue;
                }
                items.push({
                    label: formatLabel(label),
                    rawLabel: label,
                    description,
                    id: entry.timestamp.toString(),
                    command: entry,
                    buttons: entry.hasOutput() ? buttons : undefined
                });
                commandMap.add(label);
            }
        }
        if (executingCommand) {
            items.unshift({
                label: formatLabel(executingCommand),
                rawLabel: executingCommand,
                description: cmdDetection.cwd
            });
        }
        if (items.length > 0) {
            items.unshift({
                type: 'separator',
                buttons: [], // HACK: Force full sized separators as there's no flag currently
                label: terminalStrings.currentSessionCategory
            });
        }
        // Gather previous session history
        const history = instantiationService.invokeFunction(getCommandHistory);
        const previousSessionItems = [];
        for (const [label, info] of history.entries) {
            // Only add previous session item if it's not in this session
            if (!commandMap.has(label) && info.shellType === instance.shellType) {
                previousSessionItems.unshift({
                    label: formatLabel(label),
                    rawLabel: label,
                    buttons: [removeFromCommandHistoryButton]
                });
                commandMap.add(label);
            }
        }
        if (previousSessionItems.length > 0) {
            items.push({
                type: 'separator',
                buttons: [], // HACK: Force full sized separators as there's no flag currently
                label: terminalStrings.previousSessionCategory
            }, ...previousSessionItems);
        }
        // Gather shell file history
        const shellFileHistory = await instantiationService.invokeFunction(getShellFileHistory, instance.shellType);
        if (shellFileHistory !== undefined) {
            const dedupedShellFileItems = [];
            for (const label of shellFileHistory.commands) {
                if (!commandMap.has(label)) {
                    dedupedShellFileItems.unshift({
                        label: formatLabel(label),
                        rawLabel: label
                    });
                }
            }
            if (dedupedShellFileItems.length > 0) {
                const button = {
                    iconClass: ThemeIcon.asClassName(commandHistoryOpenFileIcon),
                    tooltip: localize('openShellHistoryFile', "Open File"),
                    alwaysVisible: false,
                    resource: shellFileHistory.sourceResource
                };
                openResourceButtons.push(button);
                items.push({
                    type: 'separator',
                    buttons: [button],
                    label: localize('shellFileHistoryCategory', '{0} history', instance.shellType),
                    description: shellFileHistory.sourceLabel
                }, ...dedupedShellFileItems);
            }
        }
    }
    else {
        placeholder = isMacintosh
            ? localize('selectRecentDirectoryMac', 'Select a directory to go to (hold Option-key to edit the command)')
            : localize('selectRecentDirectory', 'Select a directory to go to (hold Alt-key to edit the command)');
        // Check path uniqueness following target platform's case sensitivity rules.
        const uriComparer = instance.os === 1 /* OperatingSystem.Windows */ ? extUriIgnorePathCase : extUri;
        const uniqueUris = new ResourceSet(o => uriComparer.getComparisonKey(o));
        const cwds = instance.capabilities.get(0 /* TerminalCapability.CwdDetection */)?.cwds || [];
        if (cwds && cwds.length > 0) {
            for (const label of cwds) {
                const itemUri = URI.file(label);
                if (!uniqueUris.has(itemUri)) {
                    uniqueUris.add(itemUri);
                    items.push({
                        label: await instance.getUriLabelForShell(itemUri),
                        rawLabel: label
                    });
                }
            }
            items = items.reverse();
            items.unshift({ type: 'separator', label: terminalStrings.currentSessionCategory });
        }
        // Gather previous session history
        const history = instantiationService.invokeFunction(getDirectoryHistory);
        const previousSessionItems = [];
        // Only add previous session item if it's not in this session and it matches the remote authority
        for (const [label, info] of history.entries) {
            if (info === null || info.remoteAuthority === instance.remoteAuthority) {
                const itemUri = info?.remoteAuthority ? await pathService.fileURI(label) : URI.file(label);
                if (!uniqueUris.has(itemUri)) {
                    uniqueUris.add(itemUri);
                    previousSessionItems.unshift({
                        label: await instance.getUriLabelForShell(itemUri),
                        rawLabel: label,
                        buttons: [removeFromCommandHistoryButton]
                    });
                }
            }
        }
        if (previousSessionItems.length > 0) {
            items.push({ type: 'separator', label: terminalStrings.previousSessionCategory }, ...previousSessionItems);
        }
    }
    if (items.length === 0) {
        return;
    }
    const disposables = new DisposableStore();
    const fuzzySearchToggle = disposables.add(new Toggle({
        title: 'Fuzzy search',
        icon: commandHistoryFuzzySearchIcon,
        isChecked: filterMode === 'fuzzy',
        inputActiveOptionBorder: asCssVariable(inputActiveOptionBorder),
        inputActiveOptionForeground: asCssVariable(inputActiveOptionForeground),
        inputActiveOptionBackground: asCssVariable(inputActiveOptionBackground)
    }));
    disposables.add(fuzzySearchToggle.onChange(() => {
        instantiationService.invokeFunction(showRunRecentQuickPick, instance, terminalInRunCommandPicker, type, fuzzySearchToggle.checked ? 'fuzzy' : 'contiguous', quickPick.value);
    }));
    const outputProvider = disposables.add(instantiationService.createInstance(TerminalOutputProvider));
    const quickPick = disposables.add(quickInputService.createQuickPick({ useSeparators: true }));
    const originalItems = items;
    quickPick.items = [...originalItems];
    quickPick.sortByLabel = false;
    quickPick.placeholder = placeholder;
    quickPick.matchOnLabelMode = filterMode || 'contiguous';
    quickPick.toggles = [fuzzySearchToggle];
    disposables.add(quickPick.onDidTriggerItemButton(async (e) => {
        if (e.button === removeFromCommandHistoryButton) {
            if (type === 'command') {
                instantiationService.invokeFunction(getCommandHistory)?.remove(e.item.label);
            }
            else {
                instantiationService.invokeFunction(getDirectoryHistory)?.remove(e.item.rawLabel);
            }
        }
        else if (e.button === commandOutputButton) {
            const selectedCommand = e.item.command;
            const output = selectedCommand?.getOutput();
            if (output && selectedCommand?.command) {
                const textContent = await outputProvider.provideTextContent(URI.from({
                    scheme: TerminalOutputProvider.scheme,
                    path: `${selectedCommand.command}... ${fromNow(selectedCommand.timestamp, true)}`,
                    fragment: output,
                    query: `terminal-output-${selectedCommand.timestamp}-${instance.instanceId}`
                }));
                if (textContent) {
                    await editorService.openEditor({
                        resource: textContent.uri
                    });
                }
            }
        }
        await instantiationService.invokeFunction(showRunRecentQuickPick, instance, terminalInRunCommandPicker, type, filterMode, value);
    }));
    disposables.add(quickPick.onDidTriggerSeparatorButton(async (e) => {
        const resource = openResourceButtons.find(openResourceButton => e.button === openResourceButton)?.resource;
        if (resource) {
            await editorService.openEditor({
                resource
            });
        }
    }));
    disposables.add(quickPick.onDidChangeValue(async (value) => {
        if (!value) {
            await instantiationService.invokeFunction(showRunRecentQuickPick, instance, terminalInRunCommandPicker, type, filterMode, value);
        }
    }));
    let terminalScrollStateSaved = false;
    function restoreScrollState() {
        terminalScrollStateSaved = false;
        instance.xterm?.markTracker.restoreScrollState();
        instance.xterm?.markTracker.clear();
    }
    disposables.add(quickPick.onDidChangeActive(async () => {
        const xterm = instance.xterm;
        if (!xterm) {
            return;
        }
        const [item] = quickPick.activeItems;
        if (!item) {
            return;
        }
        function isItem(obj) {
            return isObject(obj) && 'rawLabel' in obj;
        }
        if (isItem(item) && item.command && item.command.marker) {
            if (!terminalScrollStateSaved) {
                xterm.markTracker.saveScrollState();
                terminalScrollStateSaved = true;
            }
            const promptRowCount = item.command.getPromptRowCount();
            const commandRowCount = item.command.getCommandRowCount();
            xterm.markTracker.revealRange({
                start: {
                    x: 1,
                    y: item.command.marker.line - (promptRowCount - 1) + 1
                },
                end: {
                    x: instance.cols,
                    y: item.command.marker.line + (commandRowCount - 1) + 1
                }
            });
        }
        else {
            restoreScrollState();
        }
    }));
    disposables.add(quickPick.onDidAccept(async () => {
        const result = quickPick.activeItems[0];
        let text;
        if (type === 'cwd') {
            text = `cd ${await instance.preparePathForShell(result.rawLabel)}`;
        }
        else { // command
            text = result.rawLabel;
        }
        quickPick.hide();
        terminalScrollStateSaved = false;
        instance.xterm?.markTracker.clear();
        instance.scrollToBottom();
        instance.runCommand(text, !quickPick.keyMods.alt);
        if (quickPick.keyMods.alt) {
            instance.focus();
        }
    }));
    disposables.add(quickPick.onDidHide(() => restoreScrollState()));
    if (value) {
        quickPick.value = value;
    }
    return new Promise(r => {
        terminalInRunCommandPicker.set(true);
        disposables.add(showWithPinnedItems(storageService, runRecentStorageKey, quickPick, true));
        disposables.add(quickPick.onDidHide(() => {
            terminalInRunCommandPicker.set(false);
            accessibleViewService.showLastProvider("terminal" /* AccessibleViewProviderId.Terminal */);
            r();
            disposables.dispose();
        }));
    });
}
let TerminalOutputProvider = class TerminalOutputProvider extends Disposable {
    static { TerminalOutputProvider_1 = this; }
    static { this.scheme = 'TERMINAL_OUTPUT'; }
    constructor(textModelResolverService, _modelService) {
        super();
        this._modelService = _modelService;
        this._register(textModelResolverService.registerTextModelContentProvider(TerminalOutputProvider_1.scheme, this));
    }
    async provideTextContent(resource) {
        const existing = this._modelService.getModel(resource);
        if (existing && !existing.isDisposed()) {
            return existing;
        }
        return this._modelService.createModel(resource.fragment, null, resource, false);
    }
};
TerminalOutputProvider = TerminalOutputProvider_1 = __decorate([
    __param(0, ITextModelService),
    __param(1, IModelService)
], TerminalOutputProvider);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxSdW5SZWNlbnRRdWlja1BpY2suanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2hpc3RvcnkvYnJvd3Nlci90ZXJtaW5hbFJ1blJlY2VudFF1aWNrUGljay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxXQUFXLEVBQW1CLE1BQU0sd0NBQXdDLENBQUM7QUFFdEYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQy9FLE9BQU8sRUFBNkIsaUJBQWlCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUN4SCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLHFCQUFxQixFQUFvQixNQUFNLCtEQUErRCxDQUFDO0FBQ3hILE9BQU8sRUFBcUIsa0JBQWtCLEVBQXVDLE1BQU0seURBQXlELENBQUM7QUFFckosT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0VBQWdFLENBQUM7QUFDbkcsT0FBTyxFQUFFLGFBQWEsRUFBRSwyQkFBMkIsRUFBRSx1QkFBdUIsRUFBRSwyQkFBMkIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3pLLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUVwRSxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsMEJBQTBCLEVBQUUsd0JBQXdCLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUUzSyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDOUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8s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