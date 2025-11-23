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
/* eslint-disable local/code-no-native-private */
import { URI } from '../../../base/common/uri.js';
import { Event, Emitter } from '../../../base/common/event.js';
import { debounce } from '../../../base/common/decorators.js';
import { DisposableStore, MutableDisposable } from '../../../base/common/lifecycle.js';
import { asPromise } from '../../../base/common/async.js';
import { MainContext } from './extHost.protocol.js';
import { sortedDiff, equals } from '../../../base/common/arrays.js';
import { comparePaths } from '../../../base/common/comparers.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { ExtensionIdentifierMap } from '../../../platform/extensions/common/extensions.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { MarkdownString, SourceControlInputBoxValidationType } from './extHostTypeConverters.js';
import { checkProposedApiEnabled, isProposedApiEnabled } from '../../services/extensions/common/extensions.js';
import { Schemas } from '../../../base/common/network.js';
import { isLinux } from '../../../base/common/platform.js';
import { structuralEquals } from '../../../base/common/equals.js';
import { Iterable } from '../../../base/common/iterator.js';
function isUri(thing) {
    return thing instanceof URI;
}
function uriEquals(a, b) {
    if (a.scheme === Schemas.file && b.scheme === Schemas.file && isLinux) {
        return a.toString() === b.toString();
    }
    return a.toString().toLowerCase() === b.toString().toLowerCase();
}
function getIconResource(decorations) {
    if (!decorations) {
        return undefined;
    }
    else if (typeof decorations.iconPath === 'string') {
        return URI.file(decorations.iconPath);
    }
    else if (URI.isUri(decorations.iconPath)) {
        return decorations.iconPath;
    }
    else if (ThemeIcon.isThemeIcon(decorations.iconPath)) {
        return decorations.iconPath;
    }
    else {
        return undefined;
    }
}
function getHistoryItemIconDto(icon) {
    if (!icon) {
        return undefined;
    }
    else if (URI.isUri(icon)) {
        return icon;
    }
    else if (ThemeIcon.isThemeIcon(icon)) {
        return icon;
    }
    else {
        const iconDto = icon;
        return { light: iconDto.light, dark: iconDto.dark };
    }
}
function toSCMHistoryItemDto(historyItem) {
    const authorIcon = getHistoryItemIconDto(historyItem.authorIcon);
    const tooltip = Array.isArray(historyItem.tooltip)
        ? MarkdownString.fromMany(historyItem.tooltip)
        : historyItem.tooltip ? MarkdownString.from(historyItem.tooltip) : undefined;
    const references = historyItem.references?.map(r => ({
        ...r, icon: getHistoryItemIconDto(r.icon)
    }));
    return { ...historyItem, authorIcon, references, tooltip };
}
function toSCMHistoryItemRefDto(historyItemRef) {
    return historyItemRef ? { ...historyItemRef, icon: getHistoryItemIconDto(historyItemRef.icon) } : undefined;
}
function compareResourceThemableDecorations(a, b) {
    if (!a.iconPath && !b.iconPath) {
        return 0;
    }
    else if (!a.iconPath) {
        return -1;
    }
    else if (!b.iconPath) {
        return 1;
    }
    const aPath = typeof a.iconPath === 'string' ? a.iconPath : URI.isUri(a.iconPath) ? a.iconPath.fsPath : a.iconPath.id;
    const bPath = typeof b.iconPath === 'string' ? b.iconPath : URI.isUri(b.iconPath) ? b.iconPath.fsPath : b.iconPath.id;
    return comparePaths(aPath, bPath);
}
function compareResourceStatesDecorations(a, b) {
    let result = 0;
    if (a.strikeThrough !== b.strikeThrough) {
        return a.strikeThrough ? 1 : -1;
    }
    if (a.faded !== b.faded) {
        return a.faded ? 1 : -1;
    }
    if (a.tooltip !== b.tooltip) {
        return (a.tooltip || '').localeCompare(b.tooltip || '');
    }
    result = compareResourceThemableDecorations(a, b);
    if (result !== 0) {
        return result;
    }
    if (a.light && b.light) {
        result = compareResourceThemableDecorations(a.light, b.light);
    }
    else if (a.light) {
        return 1;
    }
    else if (b.light) {
        return -1;
    }
    if (result !== 0) {
        return result;
    }
    if (a.dark && b.dark) {
        result = compareResourceThemableDecorations(a.dark, b.dark);
    }
    else if (a.dark) {
        return 1;
    }
    else if (b.dark) {
        return -1;
    }
    return result;
}
function compareCommands(a, b) {
    if (a.command !== b.command) {
        return a.command < b.command ? -1 : 1;
    }
    if (a.title !== b.title) {
        return a.title < b.title ? -1 : 1;
    }
    if (a.tooltip !== b.tooltip) {
        if (a.tooltip !== undefined && b.tooltip !== undefined) {
            return a.tooltip < b.tooltip ? -1 : 1;
        }
        else if (a.tooltip !== undefined) {
            return 1;
        }
        else if (b.tooltip !== undefined) {
            return -1;
        }
    }
    if (a.arguments === b.arguments) {
        return 0;
    }
    else if (!a.arguments) {
        return -1;
    }
    else if (!b.arguments) {
        return 1;
    }
    else if (a.arguments.length !== b.arguments.length) {
        return a.arguments.length - b.arguments.length;
    }
    for (let i = 0; i < a.arguments.length; i++) {
        const aArg = a.arguments[i];
        const bArg = b.arguments[i];
        if (aArg === bArg) {
            continue;
        }
        if (isUri(aArg) && isUri(bArg) && uriEquals(aArg, bArg)) {
            continue;
        }
        return aArg < bArg ? -1 : 1;
    }
    return 0;
}
function compareResourceStates(a, b) {
    let result = comparePaths(a.resourceUri.fsPath, b.resourceUri.fsPath, true);
    if (result !== 0) {
        return result;
    }
    if (a.command && b.command) {
        result = compareCommands(a.command, b.command);
    }
    else if (a.command) {
        return 1;
    }
    else if (b.command) {
        return -1;
    }
    if (result !== 0) {
        return result;
    }
    if (a.decorations && b.decorations) {
        result = compareResourceStatesDecorations(a.decorations, b.decorations);
    }
    else if (a.decorations) {
        return 1;
    }
    else if (b.decorations) {
        return -1;
    }
    if (result !== 0) {
        return result;
    }
    if (a.multiFileDiffEditorModifiedUri && b.multiFileDiffEditorModifiedUri) {
        result = comparePaths(a.multiFileDiffEditorModifiedUri.fsPath, b.multiFileDiffEditorModifiedUri.fsPath, true);
    }
    else if (a.multiFileDiffEditorModifiedUri) {
        return 1;
    }
    else if (b.multiFileDiffEditorModifiedUri) {
        return -1;
    }
    if (result !== 0) {
        return result;
    }
    if (a.multiDiffEditorOriginalUri && b.multiDiffEditorOriginalUri) {
        result = comparePaths(a.multiDiffEditorOriginalUri.fsPath, b.multiDiffEditorOriginalUri.fsPath, true);
    }
    else if (a.multiDiffEditorOriginalUri) {
        return 1;
    }
    else if (b.multiDiffEditorOriginalUri) {
        return -1;
    }
    return result;
}
function compareArgs(a, b) {
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
function commandEquals(a, b) {
    return a.command === b.command
        && a.title === b.title
        && a.tooltip === b.tooltip
        && (a.arguments && b.arguments ? compareArgs(a.arguments, b.arguments) : a.arguments === b.arguments);
}
function commandListEquals(a, b) {
    return equals(a, b, commandEquals);
}
export class ExtHostSCMInputBox {
    #proxy;
    #extHostDocuments;
    get value() {
        return this._value;
    }
    set value(value) {
        value = value ?? '';
        this.#proxy.$setInputBoxValue(this._sourceControlHandle, value);
        this.updateValue(value);
    }
    get onDidChange() {
        return this._onDidChange.event;
    }
    get placeholder() {
        return this._placeholder;
    }
    set placeholder(placeholder) {
        this.#proxy.$setInputBoxPlaceholder(this._sourceControlHandle, placeholder);
        this._placeholder = placeholder;
    }
    get validateInput() {
        checkProposedApiEnabled(this._extension, 'scmValidation');
        return this._validateInput;
    }
    set validateInput(fn) {
        checkProposedApiEnabled(this._extension, 'scmValidation');
        if (fn && typeof fn !== 'function') {
            throw new Error(`[${this._extension.identifier.value}]: Invalid SCM input box validation function`);
        }
        this._validateInput = fn;
        this.#proxy.$setValidationProviderIsEnabled(this._sourceControlHandle, !!fn);
    }
    get enabled() {
        return this._enabled;
    }
    set enabled(enabled) {
        enabled = !!enabled;
        if (this._enabled === enabled) {
            return;
        }
        this._enabled = enabled;
        this.#proxy.$setInputBoxEnablement(this._sourceControlHandle, enabled);
    }
    get visible() {
        return this._visible;
    }
    set visible(visible) {
        visible = !!visible;
        if (this._visible === visible) {
            return;
        }
        this._visible = visible;
        this.#proxy.$setInputBoxVisibility(this._sourceControlHandle, visible);
    }
    get document() {
        checkProposedApiEnabled(this._extension, 'scmTextDocument');
        return this.#extHostDocuments.getDocument(this._documentUri);
    }
    constructor(_extension, _extHostDocuments, proxy, _sourceControlHandle, _documentUri) {
        this._extension = _extension;
        this._sourceControlHandle = _sourceControlHandle;
        this._documentUri = _documentUri;
        this._value = '';
        this._onDidChange = new Emitter();
        this._placeholder = '';
        this._enabled = true;
        this._visible = true;
        this.#extHostDocuments = _extHostDocuments;
        this.#proxy = proxy;
    }
    showValidationMessage(message, type) {
        checkProposedApiEnabled(this._extension, 'scmValidation');
        this.#proxy.$showValidationMessage(this._sourceControlHandle, message, SourceControlInputBoxValidationType.from(type));
    }
    $onInputBoxValueChange(value) {
        this.updateValue(value);
    }
    updateValue(value) {
        this._value = value;
        this._onDidChange.fire(value);
    }
}
class ExtHostSourceControlResourceGroup {
    static { this._handlePool = 0; }
    get disposed() { return this._disposed; }
    get id() { return this._id; }
    get label() { return this._label; }
    set label(label) {
        this._label = label;
        this._proxy.$updateGroupLabel(this._sourceControlHandle, this.handle, label);
    }
    get contextValue() {
        return this._contextValue;
    }
    set contextValue(contextValue) {
        this._contextValue = contextValue;
        this._proxy.$updateGroup(this._sourceControlHandle, this.handle, this.features);
    }
    get hideWhenEmpty() { return this._hideWhenEmpty; }
    set hideWhenEmpty(hideWhenEmpty) {
        this._hideWhenEmpty = hideWhenEmpty;
        this._proxy.$updateGroup(this._sourceControlHandle, this.handle, this.features);
    }
    get features() {
        return {
            contextValue: this.contextValue,
            hideWhenEmpty: this.hideWhenEmpty
        };
    }
    get resourceStates() { return [...this._resourceStates]; }
    set resourceStates(resources) {
        this._resourceStates = [...resources];
        this._onDidUpdateResourceStates.fire();
    }
    constructor(_proxy, _commands, _sourceControlHandle, _id, _label, multiDiffEditorEnableViewChanges, _extension) {
        this._proxy = _proxy;
        this._commands = _commands;
        this._sourceControlHandle = _sourceControlHandle;
        this._id = _id;
        this._label = _label;
        this.multiDiffEditorEnableViewChanges = multiDiffEditorEnableViewChanges;
        this._extension = _extension;
        this._resourceHandlePool = 0;
        this._resourceStates = [];
        this._resourceStatesMap = new Map();
        this._resourceStatesCommandsMap = new Map();
        this._resourceStatesDisposablesMap = new Map();
        this._onDidUpdateResourceStates = new Emitter();
        this.onDidUpdateResourceStates = this._onDidUpdateResourceStates.event;
        this._disposed = false;
        this._onDidDispose = new Emitter();
        this.onDidDispose = this._onDidDispose.event;
        this._handlesSnapshot = [];
        this._resourceSnapshot = [];
        this._contextValue = undefined;
        this._hideWhenEmpty = undefined;
        this.handle = ExtHostSourceControlResourceGroup._handlePool++;
    }
    getResourceState(handle) {
        return this._resourceStatesMap.get(handle);
    }
    $executeResourceCommand(handle, preserveFocus) {
        const command = this._resourceStatesCommandsMap.get(handle);
        if (!command) {
            return Promise.resolve(undefined);
        }
        return asPromise(() => this._commands.executeCommand(command.command, ...(command.arguments || []), preserveFocus));
    }
    _takeResourceStateSnapshot() {
        const snapshot = [...this._resourceStates].sort(compareResourceStates);
        const diffs = sortedDiff(this._resourceSnapshot, snapshot, compareResourceStates);
        const splices = diffs.map(diff => {
            const toInsert = diff.toInsert.map(r => {
                const handle = this._resourceHandlePool++;
                this._resourceStatesMap.set(handle, r);
                const sourceUri = r.resourceUri;
                let command;
                if (r.command) {
                    if (r.command.command === 'vscode.open' || r.command.command === 'vscode.diff' || r.command.command === 'vscode.changes') {
                        const disposables = new DisposableStore();
                        command = this._commands.converter.toInternal(r.command, disposables);
                        this._resourceStatesDisposablesMap.set(handle, disposables);
                    }
                    else {
                        this._resourceStatesCommandsMap.set(handle, r.command);
                    }
                }
                const hasScmMultiDiffEditorProposalEnabled = isProposedApiEnabled(this._extension, 'scmMultiDiffEditor');
                const multiFileDiffEditorOriginalUri = hasScmMultiDiffEditorProposalEnabled ? r.multiDiffEditorOriginalUri : undefined;
                const multiFileDiffEditorModifiedUri = hasScmMultiDiffEditorProposalEnabled ? r.multiFileDiffEditorModifiedUri : undefined;
                const icon = getIconResource(r.decorations);
                const lightIcon = r.decorations && getIconResource(r.decorations.light) || icon;
                const darkIcon = r.decorations && getIconResource(r.decorations.dark) || icon;
                const icons = [lightIcon, darkIcon];
                const tooltip = (r.decorations && r.decorations.tooltip) || '';
                const strikeThrough = r.decorations && !!r.decorations.strikeThrough;
                const faded = r.decorations && !!r.decorations.faded;
                const contextValue = r.contextValue || '';
                const rawResource = [handle, sourceUri, icons, tooltip, strikeThrough, faded, contextValue, command, multiFileDiffEditorOriginalUri, multiFileDiffEditorModifiedUri];
                return { rawResource, handle };
            });
            return { start: diff.start, deleteCount: diff.deleteCount, toInsert };
        });
        const rawResourceSplices = splices
            .map(({ start, deleteCount, toInsert }) => [start, deleteCount, toInsert.map(i => i.rawResource)]);
        const reverseSplices = splices.reverse();
        for (const { start, deleteCount, toInsert } of reverseSplices) {
            const handles = toInsert.map(i => i.handle);
            const handlesToDelete = this._handlesSnapshot.splice(start, deleteCount, ...handles);
            for (const handle of handlesToDelete) {
                this._resourceStatesMap.delete(handle);
                this._resourceStatesCommandsMap.delete(handle);
                this._resourceStatesDisposablesMap.get(handle)?.dispose();
                this._resourceStatesDisposablesMap.delete(handle);
            }
        }
        this._resourceSnapshot = snapshot;
        return rawResourceSplices;
    }
    dispose() {
        this._disposed = true;
        this._onDidDispose.fire();
    }
}
class ExtHostSourceControl {
    static { this._handlePool = 0; }
    #proxy;
    get id() {
        return this._id;
    }
    get label() {
        return this._label;
    }
    get rootUri() {
        return this._rootUri;
    }
    get contextValue() {
        checkProposedApiEnabled(this._extension, 'scmProviderOptions');
        return this._contextValue;
    }
    set contextValue(contextValue) {
        checkProposedApiEnabled(this._extension, 'scmProviderOptions');
        if (this._contextValue === contextValue) {
            return;
        }
        this._contextValue = contextValue;
        this.#proxy.$updateSourceControl(this.handle, { contextValue });
    }
    get inputBox() { return this._inputBox; }
    get count() {
        return this._count;
    }
    set count(count) {
        if (this._count === count) {
            return;
        }
        this._count = count;
        this.#proxy.$updateSourceControl(this.handle, { count });
    }
    get quickDiffProvider() {
        return this._quickDiffProvider;
    }
    set quickDiffProvider(quickDiffProvider) {
        this._quickDiffProvider = quickDiffProvider;
        let quickDiffLabel = undefined;
        if (isProposedApiEnabled(this._extension, 'quickDiffProvider')) {
            quickDiffLabel = quickDiffProvider?.label;
        }
        this.#proxy.$updateSourceControl(this.handle, { hasQuickDiffProvider: !!quickDiffProvider, quickDiffLabel });
    }
    get secondaryQuickDiffProvider() {
        checkProposedApiEnabled(this._extension, 'quickDiffProvider');
        return this._secondaryQuickDiffProvider;
    }
    set secondaryQuickDiffProvider(secondaryQuickDiffProvider) {
        checkProposedApiEnabled(this._extension, 'quickDiffProvider');
        this._secondaryQuickDiffProvider = secondaryQuickDiffProvider;
        const secondaryQuickDiffLabel = secondaryQuickDiffProvider?.label;
        this.#proxy.$updateSourceControl(this.handle, { hasSecondaryQuickDiffProvider: !!secondaryQuickDiffProvider, secondaryQuickDiffLabel });
    }
    get historyProvider() {
        checkProposedApiEnabled(this._extension, 'scmHistoryProvider');
        return this._historyProvider;
    }
    set historyProvider(historyProvider) {
        checkProposedApiEnabled(this._extension, 'scmHistoryProvider');
        this._historyProvider = historyProvider;
        this._historyProviderDisposable.value = new DisposableStore();
        this.#proxy.$updateSourceControl(this.handle, { hasHistoryProvider: !!historyProvider });
        if (historyProvider) {
            this._historyProviderDisposable.value.add(historyProvider.onDidChangeCurrentHistoryItemRefs(() => {
                const historyItemRef = toSCMHistoryItemRefDto(historyProvider?.currentHistoryItemRef);
                const historyItemRemoteRef = toSCMHistoryItemRefDto(historyProvider?.currentHistoryItemRemoteRef);
                const historyItemBaseRef = toSCMHistoryItemRefDto(historyProvider?.currentHistoryItemBaseRef);
                this.#proxy.$onDidChangeHistoryProviderCurrentHistoryItemRefs(this.handle, historyItemRef, historyItemRemoteRef, historyItemBaseRef);
            }));
            this._historyProviderDisposable.value.add(historyProvider.onDidChangeHistoryItemRefs((e) => {
                if (e.added.length === 0 && e.modified.length === 0 && e.removed.length === 0) {
                    return;
                }
                const added = e.added.map(ref => ({ ...ref, icon: getHistoryItemIconDto(ref.icon) }));
                const modified = e.modified.map(ref => ({ ...ref, icon: getHistoryItemIconDto(ref.icon) }));
                const removed = e.removed.map(ref => ({ ...ref, icon: getHistoryItemIconDto(ref.icon) }));
                this.#proxy.$onDidChangeHistoryProviderHistoryItemRefs(this.handle, { added, modified, removed, silent: e.silent });
            }));
        }
    }
    get artifactProvider() {
        checkProposedApiEnabled(this._extension, 'scmArtifactProvider');
        return this._artifactProvider;
    }
    set artifactProvider(artifactProvider) {
        checkProposedApiEnabled(this._extension, 'scmArtifactProvider');
        this._artifactProvider = artifactProvider;
        this._artifactProviderDisposable.value = new DisposableStore();
        this.#proxy.$updateSourceControl(this.handle, { hasArtifactProvider: !!artifactProvider });
        if (artifactProvider) {
            this._artifactProviderDisposable.value.add(artifactProvider.onDidChangeArtifacts((groups) => {
                if (groups.length !== 0) {
                    this.#proxy.$onDidChangeArtifacts(this.handle, groups);
                }
            }));
        }
    }
    get commitTemplate() {
        return this._commitTemplate;
    }
    set commitTemplate(commitTemplate) {
        if (commitTemplate === this._commitTemplate) {
            return;
        }
        this._commitTemplate = commitTemplate;
        this.#proxy.$updateSourceControl(this.handle, { commitTemplate });
    }
    get acceptInputCommand() {
        return this._acceptInputCommand;
    }
    set acceptInputCommand(acceptInputCommand) {
        this._acceptInputDisposables.value = new DisposableStore();
        this._acceptInputCommand = acceptInputCommand;
        const internal = this._commands.converter.toInternal(acceptInputCommand, this._acceptInputDisposables.value);
        this.#proxy.$updateSourceControl(this.handle, { acceptInputCommand: internal });
    }
    get actionButton() {
        checkProposedApiEnabled(this._extension, 'scmActionButton');
        return this._actionButton;
    }
    set actionButton(actionButton) {
        checkProposedApiEnabled(this._extension, 'scmActionButton');
        // We have to do this check before converting the command to it's internal
        // representation since that would always create a command with a unique
        // identifier
        if (structuralEquals(this._actionButton, actionButton)) {
            return;
        }
        // In order to prevent disposing the action button command that are still rendered in the UI
        // until the next UI update, we ensure to dispose them after the update has been completed.
        const oldActionButtonDisposables = this._actionButtonDisposables;
        this._actionButtonDisposables = new DisposableStore();
        this._actionButton = actionButton;
        const actionButtonDto = actionButton !== undefined ?
            {
                command: {
                    ...this._commands.converter.toInternal(actionButton.command, this._actionButtonDisposables),
                    shortTitle: actionButton.command.shortTitle
                },
                secondaryCommands: actionButton.secondaryCommands?.map(commandGroup => {
                    return commandGroup.map(command => this._commands.converter.toInternal(command, this._actionButtonDisposables));
                }),
                enabled: actionButton.enabled
            } : null;
        this.#proxy.$updateSourceControl(this.handle, { actionButton: actionButtonDto })
            .finally(() => oldActionButtonDisposables.dispose());
    }
    get statusBarCommands() {
        return this._statusBarCommands;
    }
    set statusBarCommands(statusBarCommands) {
        if (this._statusBarCommands && statusBarCommands && commandListEquals(this._statusBarCommands, statusBarCommands)) {
            return;
        }
        // In order to prevent disposing status bar commands that are still rendered in the UI
        // until the next UI update, we ensure to dispose them after the update has been completed.
        const oldStatusBarDisposables = this._statusBarDisposables;
        this._statusBarDisposables = new DisposableStore();
        this._statusBarCommands = statusBarCommands;
        const internal = (statusBarCommands || []).map(c => this._commands.converter.toInternal(c, this._statusBarDisposables));
        this.#proxy.$updateSourceControl(this.handle, { statusBarCommands: internal })
            .finally(() => oldStatusBarDisposables.dispose());
    }
    get selected() {
        return this._selected;
    }
    constructor(_extension, _extHostDocuments, proxy, _commands, _id, _label, _rootUri, _iconPath, _parent) {
        this._extension = _extension;
        this._commands = _commands;
        this._id = _id;
        this._label = _label;
        this._rootUri = _rootUri;
        this._onDidDispose = new Emitter();
        this.onDidDispose = this._onDidDispose.event;
        this._groups = new Map();
        this._contextValue = undefined;
        this._count = undefined;
        this._quickDiffProvider = undefined;
        this._secondaryQuickDiffProvider = undefined;
        this._historyProviderDisposable = new MutableDisposable();
        this._artifactProviderDisposable = new MutableDisposable();
        this._commitTemplate = undefined;
        this._acceptInputDisposables = new MutableDisposable();
        this._acceptInputCommand = undefined;
        // We know what we're doing here:
        // eslint-disable-next-line local/code-no-potentially-unsafe-disposables
        this._actionButtonDisposables = new DisposableStore();
        // We know what we're doing here:
        // eslint-disable-next-line local/code-no-potentially-unsafe-disposables
        this._statusBarDisposables = new DisposableStore();
        this._statusBarCommands = undefined;
        this._selected = false;
        this._onDidChangeSelection = new Emitter();
        this.onDidChangeSelection = this._onDidChangeSelection.event;
        this.handle = ExtHostSourceControl._handlePool++;
        this.createdResourceGroups = new Map();
        this.updatedResourceGroups = new Set();
        this.#proxy = proxy;
        const inputBoxDocumentUri = URI.from({
            scheme: Schemas.vscodeSourceControl,
            path: `${_id}/scm${this.handle}/input`,
            query: _rootUri ? `rootUri=${encodeURIComponent(_rootUri.toString())}` : undefined
        });
        this._inputBox = new ExtHostSCMInputBox(_extension, _extHostDocuments, this.#proxy, this.handle, inputBoxDocumentUri);
        this.#proxy.$registerSourceControl(this.handle, _parent?.handle, _id, _label, _rootUri, getHistoryItemIconDto(_iconPath), inputBoxDocumentUri);
        this.onDidDisposeParent = _parent ? _parent.onDidDispose : Event.None;
    }
    createResourceGroup(id, label, options) {
        const multiDiffEditorEnableViewChanges = isProposedApiEnabled(this._extension, 'scmMultiDiffEditor') && options?.multiDiffEditorEnableViewChanges === true;
        const group = new ExtHostSourceControlResourceGroup(this.#proxy, this._commands, this.handle, id, label, multiDiffEditorEnableViewChanges, this._extension);
        const disposable = Event.once(group.onDidDispose)(() => this.createdResourceGroups.delete(group));
        this.createdResourceGroups.set(group, disposable);
        this.eventuallyAddResourceGroups();
        return group;
    }
    eventuallyAddResourceGroups() {
        const groups = [];
        const splices = [];
        for (const [group, disposable] of this.createdResourceGroups) {
            disposable.dispose();
            const updateListener = group.onDidUpdateResourceStates(() => {
                this.updatedResourceGroups.add(group);
                this.eventuallyUpdateResourceStates();
            });
            Event.once(group.onDidDispose)(() => {
                this.updatedResourceGroups.delete(group);
                updateListener.dispose();
                this._groups.delete(group.handle);
                this.#proxy.$unregisterGroup(this.handle, group.handle);
            });
            groups.push([group.handle, group.id, group.label, group.features, group.multiDiffEditorEnableViewChanges]);
            const snapshot = group._takeResourceStateSnapshot();
            if (snapshot.length > 0) {
                splices.push([group.handle, snapshot]);
            }
            this._groups.set(group.handle, group);
        }
        this.#proxy.$registerGroups(this.handle, groups, splices);
        this.createdResourceGroups.clear();
    }
    eventuallyUpdateResourceStates() {
        const splices = [];
        this.updatedResourceGroups.forEach(group => {
            const snapshot = group._takeResourceStateSnapshot();
            if (snapshot.length === 0) {
                return;
            }
            splices.push([group.handle, snapshot]);
        });
        if (splices.length > 0) {
            this.#proxy.$spliceResourceStates(this.handle, splices);
        }
        this.updatedResourceGroups.clear();
    }
    getResourceGroup(handle) {
        return this._groups.get(handle);
    }
    setSelectionState(selected) {
        this._selected = selected;
        this._onDidChangeSelection.fire(selected);
    }
    dispose() {
        this._acceptInputDisposables.dispose();
        this._actionButtonDisposables.dispose();
        this._statusBarDisposables.dispose();
        this._historyProviderDisposable.dispose();
        this._artifactProviderDisposable.dispose();
        this._groups.forEach(group => group.dispose());
        this.#proxy.$unregisterSourceControl(this.handle);
        this._onDidDispose.fire();
        this._onDidDispose.dispose();
    }
}
__decorate([
    debounce(100)
], ExtHostSourceControl.prototype, "eventuallyAddResourceGroups", null);
__decorate([
    debounce(100)
], ExtHostSourceControl.prototype, "eventuallyUpdateResourceStates", null);
let ExtHostSCM = class ExtHostSCM {
    get onDidChangeActiveProvider() { return this._onDidChangeActiveProvider.event; }
    constructor(mainContext, _commands, _extHostDocuments, logService) {
        this._commands = _commands;
        this._extHostDocuments = _extHostDocuments;
        this.logService = logService;
        this._sourceControls = new Map();
        this._sourceControlsByExtension = new ExtensionIdentifierMap();
        this._onDidChangeActiveProvider = new Emitter();
        this._proxy = mainContext.getProxy(MainContext.MainThreadSCM);
        this._telemetry = mainContext.getProxy(MainContext.MainThreadTelemetry);
        _commands.registerArgumentProcessor({
            processArgument: arg => {
                if (arg && arg.$mid === 3 /* MarshalledId.ScmResource */) {
                    const sourceControl = this._sourceControls.get(arg.sourceControlHandle);
                    if (!sourceControl) {
                        return arg;
                    }
                    const group = sourceControl.getResourceGroup(arg.groupHandle);
                    if (!group) {
                        return arg;
                    }
                    return group.getResourceState(arg.handle);
                }
                else if (arg && arg.$mid === 4 /* MarshalledId.ScmResourceGroup */) {
                    const sourceControl = this._sourceControls.get(arg.sourceControlHandle);
                    if (!sourceControl) {
                        return arg;
                    }
                    return sourceControl.getResourceGroup(arg.groupHandle);
                }
                else if (arg && arg.$mid === 5 /* MarshalledId.ScmProvider */) {
                    const sourceControl = this._sourceControls.get(arg.handle);
                    if (!sourceControl) {
                        return arg;
                    }
                    return sourceControl;
                }
                return arg;
            }
        });
    }
    createSourceControl(extension, id, label, rootUri, iconPath, parent) {
        this.logService.trace('ExtHostSCM#createSourceControl', extension.identifier.value, id, label, rootUri);
        this._telemetry.$publicLog2('api/scm/createSourceControl', {
            extensionId: extension.identifier.value,
        });
        const parentSourceControl = parent ? Iterable.find(this._sourceControls.values(), s => s === parent) : undefined;
        const sourceControl = new ExtHostSourceControl(extension, this._extHostDocuments, this._proxy, this._commands, id, label, rootUri, iconPath, parentSourceControl);
        this._sourceControls.set(sourceControl.handle, sourceControl);
        const sourceControls = this._sourceControlsByExtension.get(extension.identifier) || [];
        sourceControls.push(sourceControl);
        this._sourceControlsByExtension.set(extension.identifier, sourceControls);
        return sourceControl;
    }
    // Deprecated
    getLastInputBox(extension) {
        this.logService.trace('ExtHostSCM#getLastInputBox', extension.identifier.value);
        const sourceControls = this._sourceControlsByExtension.get(extension.identifier);
        const sourceControl = sourceControls && sourceControls[sourceControls.length - 1];
        return sourceControl && sourceControl.inputBox;
    }
    $provideOriginalResource(sourceControlHandle, uriComponents, token) {
        const uri = URI.revive(uriComponents);
        this.logService.trace('ExtHostSCM#$provideOriginalResource', sourceControlHandle, uri.toString());
        const sourceControl = this._sourceControls.get(sourceControlHandle);
        if (!sourceControl || !sourceControl.quickDiffProvider || !sourceControl.quickDiffProvider.provideOriginalResource) {
            return Promise.resolve(null);
        }
        return asPromise(() => sourceControl.quickDiffProvider.provideOriginalResource(uri, token))
            .then(r => r || null);
    }
    $provideSecondaryOriginalResource(sourceControlHandle, uriComponents, token) {
        const uri = URI.revive(uriComponents);
        this.logService.trace('ExtHostSCM#$provideSecondaryOriginalResource', sourceControlHandle, uri.toString());
        const sourceControl = this._sourceControls.get(sourceControlHandle);
        if (!sourceControl || !sourceControl.secondaryQuickDiffProvider || !sourceControl.secondaryQuickDiffProvider.provideOriginalResource) {
            return Promise.resolve(null);
        }
        return asPromise(() => sourceControl.secondaryQuickDiffProvider.provideOriginalResource(uri, token))
            .then(r => r || null);
    }
    $onInputBoxValueChange(sourceControlHandle, value) {
        this.logService.trace('ExtHostSCM#$onInputBoxValueChange', sourceControlHandle);
        const sourceControl = this._sourceControls.get(sourceControlHandle);
        if (!sourceControl) {
            return Promise.resolve(undefined);
        }
        sourceControl.inputBox.$onInputBoxValueChange(value);
        return Promise.resolve(undefined);
    }
    $executeResourceCommand(sourceControlHandle, groupHandle, handle, preserveFocus) {
        this.logService.trace('ExtHostSCM#$executeResourceCommand', sourceControlHandle, groupHandle, handle);
        const sourceControl = this._sourceControls.get(sourceControlHandle);
        if (!sourceControl) {
            return Promise.resolve(undefined);
        }
        const group = sourceControl.getResourceGroup(groupHandle);
        if (!group) {
            return Promise.resolve(undefined);
        }
        return group.$executeResourceCommand(handle, preserveFocus);
    }
    $validateInput(sourceControlHandle, value, cursorPosition) {
        this.logService.trace('ExtHostSCM#$validateInput', sourceControlHandle);
        const sourceControl = this._sourceControls.get(sourceControlHandle);
        if (!sourceControl) {
            return Promise.resolve(undefined);
        }
        if (!sourceControl.inputBox.validateInput) {
            return Promise.resolve(undefined);
        }
        return asPromise(() => sourceControl.inputBox.validateInput(value, cursorPosition)).then(result => {
            if (!result) {
                return Promise.resolve(undefined);
            }
            const message = MarkdownString.fromStrict(result.message);
            if (!message) {
                return Promise.resolve(undefined);
            }
            return Promise.resolve([message, result.type]);
        });
    }
    $setSelectedSourceControl(selectedSourceControlHandle) {
        this.logService.trace('ExtHostSCM#$setSelectedSourceControl', selectedSourceControlHandle);
        if (selectedSourceControlHandle !== undefined) {
            this._sourceControls.get(selectedSourceControlHandle)?.setSelectionState(true);
        }
        if (this._selectedSourceControlHandle !== undefined) {
            this._sourceControls.get(this._selectedSourceControlHandle)?.setSelectionState(false);
        }
        this._selectedSourceControlHandle = selectedSourceControlHandle;
        return Promise.resolve(undefined);
    }
    async $resolveHistoryItem(sourceControlHandle, historyItemId, token) {
        try {
            const historyProvider = this._sourceControls.get(sourceControlHandle)?.historyProvider;
            const historyItem = await historyProvider?.resolveHistoryItem(historyItemId, token);
            return historyItem ? toSCMHistoryItemDto(historyItem) : undefined;
        }
        catch (err) {
            this.logService.error('ExtHostSCM#$resolveHistoryItem', err);
            return undefined;
        }
    }
    async $resolveHistoryItemChatContext(sourceControlHandle, historyItemId, token) {
        try {
            const historyProvider = this._sourceControls.get(sourceControlHandle)?.historyProvider;
            const chatContext = await historyProvider?.resolveHistoryItemChatContext(historyItemId, token);
            return chatContext ?? undefined;
        }
        catch (err) {
            this.logService.error('ExtHostSCM#$resolveHistoryItemChatContext', err);
            return undefined;
        }
    }
    async $resolveHistoryItemChangeRangeChatContext(sourceControlHandle, historyItemId, historyItemParentId, path, token) {
        try {
            const historyProvider = this._sourceControls.get(sourceControlHandle)?.historyProvider;
            const chatContext = await historyProvider?.resolveHistoryItemChangeRangeChatContext?.(historyItemId, historyItemParentId, path, token);
            return chatContext ?? undefined;
        }
        catch (err) {
            this.logService.error('ExtHostSCM#$resolveHistoryItemChangeRangeChatContext', err);
            return undefined;
        }
    }
    async $resolveHistoryItemRefsCommonAncestor(sourceControlHandle, historyItemRefs, token) {
        try {
            const historyProvider = this._sourceControls.get(sourceControlHandle)?.historyProvider;
            const ancestor = await historyProvider?.resolveHistoryItemRefsCommonAncestor(historyItemRefs, token);
            return ancestor ?? undefined;
        }
        catch (err) {
            this.logService.error('ExtHostSCM#$resolveHistoryItemRefsCommonAncestor', err);
            return undefined;
        }
    }
    async $provideHistoryItemRefs(sourceControlHandle, historyItemRefs, token) {
        try {
            const historyProvider = this._sourceControls.get(sourceControlHandle)?.historyProvider;
            const refs = await historyProvider?.provideHistoryItemRefs(historyItemRefs, token);
            return refs?.map(ref => ({ ...ref, icon: getHistoryItemIconDto(ref.icon) })) ?? undefined;
        }
        catch (err) {
            this.logService.error('ExtHostSCM#$provideHistoryItemRefs', err);
            return undefined;
        }
    }
    async $provideHistoryItems(sourceControlHandle, options, token) {
        try {
            const historyProvider = this._sourceControls.get(sourceControlHandle)?.historyProvider;
            const historyItems = await historyProvider?.provideHistoryItems(options, token);
            return historyItems?.map(item => toSCMHistoryItemDto(item)) ?? undefined;
        }
        catch (err) {
            this.logService.error('ExtHostSCM#$provideHistoryItems', err);
            return undefined;
        }
    }
    async $provideHistoryItemChanges(sourceControlHandle, historyItemId, historyItemParentId, token) {
        try {
            const historyProvider = this._sourceControls.get(sourceControlHandle)?.historyProvider;
            const changes = await historyProvider?.provideHistoryItemChanges(historyItemId, historyItemParentId, token);
            return changes ?? undefined;
        }
        catch (err) {
            this.logService.error('ExtHostSCM#$provideHistoryItemChanges', err);
            return undefined;
        }
    }
    async $provideArtifactGroups(sourceControlHandle, token) {
        try {
            const artifactProvider = this._sourceControls.get(sourceControlHandle)?.artifactProvider;
            const groups = await artifactProvider?.provideArtifactGroups(token);
            return groups?.map(group => ({
                ...group,
                icon: getHistoryItemIconDto(group.icon)
            }));
        }
        catch (err) {
            this.logService.error('ExtHostSCM#$provideArtifactGroups', err);
            return undefined;
        }
    }
    async $provideArtifacts(sourceControlHandle, group, token) {
        try {
            const artifactProvider = this._sourceControls.get(sourceControlHandle)?.artifactProvider;
            const artifacts = await artifactProvider?.provideArtifacts(group, token);
            return artifacts?.map(artifact => ({
                ...artifact,
                icon: getHistoryItemIconDto(artifact.icon)
            }));
        }
        catch (err) {
            this.logService.error('ExtHostSCM#$provideArtifacts', err);
            return undefined;
        }
    }
};
ExtHostSCM = __decorate([
    __param(3, ILogService)
], ExtHostSCM);
export { ExtHostSCM };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdFNDTS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0U0NNLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLGlEQUFpRDtBQUVqRCxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLDZCQUE2QixDQUFDO0FBQ2pFLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxlQUFlLEVBQWUsaUJBQWlCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNwRyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFMUQsT0FBTyxFQUFFLFdBQVcsRUFBc1MsTUFBTSx1QkFBdUIsQ0FBQztBQUN4VixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUdqRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFbEUsT0FBTyxFQUFFLHNCQUFzQixFQUF5QixNQUFNLG1EQUFtRCxDQUFDO0FBRWxILE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUU5RCxPQUFPLEVBQUUsY0FBYyxFQUFFLG1DQUFtQyxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDakcsT0FBTyxFQUFFLHVCQUF1QixFQUFFLG9CQUFvQixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFFL0csT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FB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