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
import { assertNever } from '../../../../base/common/assert.js';
import { disposableTimeout, RunOnceScheduler, timeout } from '../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, derived, ObservablePromise, observableSignalFromEvent, observableValue } from '../../../../base/common/observable.js';
import { basename } from '../../../../base/common/resources.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { getIconClasses } from '../../../../editor/common/services/getIconClasses.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { localize } from '../../../../nls.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { QueryBuilder } from '../../../services/search/common/queryBuilder.js';
import { ISearchService } from '../../../services/search/common/search.js';
import { ITerminalGroupService, ITerminalService } from '../../terminal/browser/terminal.js';
const SHELL_INTEGRATION_TIMEOUT = 5000;
const NO_SHELL_INTEGRATION_IDLE = 1000;
const SUGGEST_DEBOUNCE = 200;
let McpPromptArgumentPick = class McpPromptArgumentPick extends Disposable {
    constructor(prompt, _quickInputService, _terminalService, _searchService, _workspaceContextService, _labelService, _fileService, _modelService, _languageService, _terminalGroupService, _instantiationService, _codeEditorService, _editorService) {
        super();
        this.prompt = prompt;
        this._quickInputService = _quickInputService;
        this._terminalService = _terminalService;
        this._searchService = _searchService;
        this._workspaceContextService = _workspaceContextService;
        this._labelService = _labelService;
        this._fileService = _fileService;
        this._modelService = _modelService;
        this._languageService = _languageService;
        this._terminalGroupService = _terminalGroupService;
        this._instantiationService = _instantiationService;
        this._codeEditorService = _codeEditorService;
        this._editorService = _editorService;
        this.quickPick = this._register(_quickInputService.createQuickPick({ useSeparators: true }));
    }
    async createArgs(token) {
        const { quickPick, prompt } = this;
        quickPick.totalSteps = prompt.arguments.length;
        quickPick.step = 0;
        quickPick.ignoreFocusOut = true;
        quickPick.sortByLabel = false;
        const args = {};
        const backSnapshots = [];
        for (let i = 0; i < prompt.arguments.length; i++) {
            const arg = prompt.arguments[i];
            const restore = backSnapshots.at(i);
            quickPick.step = i + 1;
            quickPick.placeholder = arg.required ? arg.description : `${arg.description || ''} (${localize('optional', 'Optional')})`;
            quickPick.title = localize('mcp.prompt.pick.title', 'Value for: {0}', arg.title || arg.name);
            quickPick.value = restore?.value ?? ((args.hasOwnProperty(arg.name) && args[arg.name]) || '');
            quickPick.items = restore?.items ?? [];
            quickPick.activeItems = restore?.activeItems ?? [];
            quickPick.buttons = i > 0 ? [this._quickInputService.backButton] : [];
            const value = await this._getArg(arg, !!restore, args, token);
            if (value.type === 'back') {
                i -= 2;
            }
            else if (value.type === 'cancel') {
                return undefined;
            }
            else if (value.type === 'arg') {
                backSnapshots[i] = { value: quickPick.value, items: quickPick.items.slice(), activeItems: quickPick.activeItems.slice() };
                args[arg.name] = value.value;
            }
            else {
                assertNever(value);
            }
        }
        quickPick.value = '';
        quickPick.placeholder = localize('loading', 'Loading...');
        quickPick.busy = true;
        return args;
    }
    async _getArg(arg, didRestoreState, argsSoFar, token) {
        const { quickPick } = this;
        const store = new DisposableStore();
        const input$ = observableValue(this, quickPick.value);
        const asyncPicks = [
            {
                name: localize('mcp.arg.suggestions', 'Suggestions'),
                observer: this._promptCompletions(arg, input$, argsSoFar),
            },
            {
                name: localize('mcp.arg.activeFiles', 'Active File'),
                observer: this._activeFileCompletions(),
            },
            {
                name: localize('mcp.arg.files', 'Files'),
                observer: this._fileCompletions(input$),
            }
        ];
        store.add(autorun(reader => {
            if (didRestoreState) {
                input$.read(reader);
                return; // don't overwrite initial items until the user types
            }
            let items = [];
            items.push({ id: 'insert-text', label: localize('mcp.arg.asText', 'Insert as text'), iconClass: ThemeIcon.asClassName(Codicon.textSize), action: 'text', alwaysShow: true });
            items.push({ id: 'run-command', label: localize('mcp.arg.asCommand', 'Run as Command'), description: localize('mcp.arg.asCommand.description', 'Inserts the command output as the prompt argument'), iconClass: ThemeIcon.asClassName(Codicon.terminal), action: 'command', alwaysShow: true });
            let busy = false;
            for (const pick of asyncPicks) {
                const state = pick.observer.read(reader);
                busy ||= state.busy;
                if (state.picks) {
                    items.push({ label: pick.name, type: 'separator' });
                    items = items.concat(state.picks);
                }
            }
            const previouslyActive = quickPick.activeItems;
            quickPick.busy = busy;
            quickPick.items = items;
            const lastActive = items.find(i => previouslyActive.some(a => a.id === i.id));
            const serverSuggestions = asyncPicks[0].observer;
            // Keep any selection state, but otherwise select the first completion item, and avoid default-selecting the top item unless there are no compltions
            if (lastActive) {
                quickPick.activeItems = [lastActive];
            }
            else if (serverSuggestions.read(reader).picks?.length) {
                quickPick.activeItems = [items[3]];
            }
            else if (busy) {
                quickPick.activeItems = [];
            }
            else {
                quickPick.activeItems = [items[0]];
            }
        }));
        try {
            const value = await new Promise(resolve => {
                if (token) {
                    store.add(token.onCancellationRequested(() => {
                        resolve(undefined);
                    }));
                }
                store.add(quickPick.onDidChangeValue(value => {
                    quickPick.validationMessage = undefined;
                    input$.set(value, undefined);
                }));
                store.add(quickPick.onDidAccept(() => {
                    const item = quickPick.selectedItems[0];
                    if (!quickPick.value && arg.required && (!item || item.action === 'text' || item.action === 'command')) {
                        quickPick.validationMessage = localize('mcp.arg.required', "This argument is required");
                    }
                    else if (!item) {
                        // For optional arguments when no item is selected, return empty text action
                        resolve({ id: 'insert-text', label: '', action: 'text' });
                    }
                    else {
                        resolve(item);
                    }
                }));
                store.add(quickPick.onDidTriggerButton(() => {
                    resolve('back');
                }));
                store.add(quickPick.onDidHide(() => {
                    resolve(undefined);
                }));
                quickPick.show();
            });
            if (value === 'back') {
                return { type: 'back' };
            }
            if (value === undefined) {
                return { type: 'cancel' };
            }
            store.clear();
            const cts = new CancellationTokenSource();
            store.add(toDisposable(() => cts.dispose(true)));
            store.add(quickPick.onDidHide(() => store.dispose()));
            switch (value.action) {
                case 'text':
                    return { type: 'arg', value: quickPick.value || undefined };
                case 'command':
                    if (!quickPick.value) {
                        return { type: 'arg', value: undefined };
                    }
                    quickPick.busy = true;
                    return { type: 'arg', value: await this._getTerminalOutput(quickPick.value, cts.token) };
                case 'suggest':
                    return { type: 'arg', value: value.label };
                case 'file':
                    quickPick.busy = true;
                    return { type: 'arg', value: await this._fileService.readFile(value.uri).then(c => c.value.toString()) };
                case 'selectedText':
                    return { type: 'arg', value: value.selectedText };
                default:
                    assertNever(value);
            }
        }
        finally {
            store.dispose();
        }
    }
    _promptCompletions(arg, input, argsSoFar) {
        const alreadyResolved = {};
        for (const [key, value] of Object.entries(argsSoFar)) {
            if (value) {
                alreadyResolved[key] = value;
            }
        }
        return this._asyncCompletions(input, async (i, t) => {
            const items = await this.prompt.complete(arg.name, i, alreadyResolved, t);
            return items.map((i) => ({ id: `suggest:${i}`, label: i, action: 'suggest' }));
        });
    }
    _fileCompletions(input) {
        const qb = this._instantiationService.createInstance(QueryBuilder);
        return this._asyncCompletions(input, async (i, token) => {
            if (!i) {
                return [];
            }
            const query = qb.file(this._workspaceContextService.getWorkspace().folders, {
                filePattern: i,
                maxResults: 10,
            });
            const { results } = await this._searchService.fileSearch(query, token);
            return results.map((i) => ({
                id: i.resource.toString(),
                label: basename(i.resource),
                description: this._labelService.getUriLabel(i.resource),
                iconClasses: getIconClasses(this._modelService, this._languageService, i.resource),
                uri: i.resource,
                action: 'file',
            }));
        });
    }
    _activeFileCompletions() {
        const activeEditorChange = observableSignalFromEvent(this, this._editorService.onDidActiveEditorChange);
        const activeEditor = derived(reader => {
            activeEditorChange.read(reader);
            return this._codeEditorService.getActiveCodeEditor();
        });
        const resourceObs = activeEditor
            .map(e => e ? observableSignalFromEvent(this, e.onDidChangeModel).map(() => e.getModel()?.uri) : undefined)
            .map((o, reader) => o?.read(reader));
        const selectionObs = activeEditor
            .map(e => e ? observableSignalFromEvent(this, e.onDidChangeCursorSelection).map(() => ({ range: e.getSelection(), model: e.getModel() })) : undefined)
            .map((o, reader) => o?.read(reader));
        return derived(reader => {
            const resource = resourceObs.read(reader);
            if (!resource) {
                return { busy: false, picks: [] };
            }
            const items = [];
            // Add active file option
            items.push({
                id: 'active-file',
                label: localize('mcp.arg.activeFile', 'Active File'),
                description: this._labelService.getUriLabel(resource),
                iconClasses: getIconClasses(this._modelService, this._languageService, resource),
                uri: resource,
                action: 'file',
            });
            const selection = selectionObs.read(reader);
            // Add selected text option if there's a selection
            if (selection && selection.model && selection.range && !selection.range.isEmpty()) {
                const selectedText = selection.model.getValueInRange(selection.range);
                const lineCount = selection.range.endLineNumber - selection.range.startLineNumber + 1;
                const description = lineCount === 1
                    ? localize('mcp.arg.selectedText.singleLine', 'line {0}', selection.range.startLineNumber)
                    : localize('mcp.arg.selectedText.multiLine', '{0} lines', lineCount);
                items.push({
                    id: 'selected-text',
                    label: localize('mcp.arg.selectedText', 'Selected Text'),
                    description,
                    selectedText,
                    iconClass: ThemeIcon.asClassName(Codicon.selection),
                    uri: resource,
                    action: 'selectedText',
                });
            }
            return { picks: items, busy: false };
        });
    }
    _asyncCompletions(input, mapper) {
        const promise = derived(reader => {
            const queryValue = input.read(reader);
            const cts = new CancellationTokenSource();
            reader.store.add(toDisposable(() => cts.dispose(true)));
            return new ObservablePromise(timeout(SUGGEST_DEBOUNCE, cts.token)
                .then(() => mapper(queryValue, cts.token))
                .catch(() => []));
        });
        return promise.map((value, reader) => {
            const result = value.promiseResult.read(reader);
            return { picks: result?.data || [], busy: result === undefined };
        });
    }
    async _getTerminalOutput(command, token) {
        // The terminal outlives the specific pick argument. This is both a feature and a bug.
        // Feature: we can reuse the terminal if the user puts in multiple args
        // Bug workaround: if we dispose the terminal here and that results in the panel
        // closing, then focus moves out of the quickpick and into the active editor pane (chat input)
        // https://github.com/microsoft/vscode/blob/6a016f2507cd200b12ca6eecdab2f59da15aacb1/src/vs/workbench/browser/parts/editor/editorGroupView.ts#L1084
        const terminal = (this._terminal ??= this._register(await this._terminalService.createTerminal({
            config: {
                name: localize('mcp.terminal.name', "MCP Terminal"),
                isTransient: true,
                forceShellIntegration: true,
                isFeatureTerminal: true,
            },
            location: TerminalLocation.Panel,
        })));
        this._terminalService.setActiveInstance(terminal);
        this._terminalGroupService.showPanel(false);
        const shellIntegration = terminal.capabilities.get(2 /* TerminalCapability.CommandDetection */);
        if (shellIntegration) {
            return this._getTerminalOutputInner(terminal, command, shellIntegration, token);
        }
        const store = new DisposableStore();
        return await new Promise(resolve => {
            store.add(terminal.capabilities.onDidAddCapability(e => {
                if (e.id === 2 /* TerminalCapability.CommandDetection */) {
                    store.dispose();
                    resolve(this._getTerminalOutputInner(terminal, command, e.capability, token));
                }
            }));
            store.add(token.onCancellationRequested(() => {
                store.dispose();
                resolve(undefined);
            }));
            store.add(disposableTimeout(() => {
                store.dispose();
                resolve(this._getTerminalOutputInner(terminal, command, undefined, token));
            }, SHELL_INTEGRATION_TIMEOUT));
        });
    }
    async _getTerminalOutputInner(terminal, command, shellIntegration, token) {
        const store = new DisposableStore();
        return new Promise(resolve => {
            let allData = '';
            store.add(terminal.onLineData(d => allData += d + '\n'));
            if (shellIntegration) {
                store.add(shellIntegration.onCommandFinished(e => resolve(e.getOutput() || allData)));
            }
            else {
                const done = store.add(new RunOnceScheduler(() => resolve(allData), NO_SHELL_INTEGRATION_IDLE));
                store.add(terminal.onData(() => done.schedule()));
            }
            store.add(token.onCancellationRequested(() => resolve(undefined)));
            store.add(terminal.onDisposed(() => resolve(undefined)));
            terminal.runCommand(command, true);
        }).finally(() => {
            store.dispose();
        });
    }
};
McpPromptArgumentPick = __decorate([
    __param(1, IQuickInputService),
    __param(2, ITerminalService),
    __param(3, ISearchService),
    __param(4, IWorkspaceContextService),
    __param(5, ILabelService),
    __param(6, IFileService),
    __param(7, IModelService),
    __param(8, ILanguageService),
    __param(9, ITerminalGroupService),
    __param(10, IInstantiationService),
    __param(11, ICodeEditorService),
    __param(12, IEditorService)
], McpPromptArgumentPick);
export { McpPromptArgumentPick };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwUHJvbXB0QXJndW1lbnRQaWNrLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL21jcC9icm93c2VyL21jcFByb21wdEFyZ3VtZW50UGljay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLGdCQUFnQixFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2hHLE9BQU8sRUFBcUIsdUJBQXVCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakcsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQWUsaUJBQWlCLEVBQUUseUJBQXlCLEVBQUUsZUFBZSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDckosT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUVqRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUM5RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUNuRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdEYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNENB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