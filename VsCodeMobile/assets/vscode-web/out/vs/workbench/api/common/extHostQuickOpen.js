/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CancellationToken } from '../../../base/common/cancellation.js';
import { Emitter } from '../../../base/common/event.js';
import { dispose } from '../../../base/common/lifecycle.js';
import { MainContext } from './extHost.protocol.js';
import { QuickInputButtons, QuickPickItemKind, InputBoxValidationSeverity, QuickInputButtonLocation } from './extHostTypes.js';
import { isCancellationError } from '../../../base/common/errors.js';
import { coalesce } from '../../../base/common/arrays.js';
import Severity from '../../../base/common/severity.js';
import { checkProposedApiEnabled } from '../../services/extensions/common/extensions.js';
import { IconPath, MarkdownString } from './extHostTypeConverters.js';
export function createExtHostQuickOpen(mainContext, workspace, commands) {
    const proxy = mainContext.getProxy(MainContext.MainThreadQuickOpen);
    class ExtHostQuickOpenImpl {
        constructor(workspace, commands) {
            this._sessions = new Map();
            this._instances = 0;
            this._workspace = workspace;
            this._commands = commands;
        }
        showQuickPick(extension, itemsOrItemsPromise, options, token = CancellationToken.None) {
            // clear state from last invocation
            this._onDidSelectItem = undefined;
            const itemsPromise = Promise.resolve(itemsOrItemsPromise);
            const instance = ++this._instances;
            if (options?.prompt) {
                checkProposedApiEnabled(extension, 'quickPickPrompt');
            }
            const quickPickWidget = proxy.$show(instance, {
                title: options?.title,
                placeHolder: options?.placeHolder,
                prompt: options?.prompt,
                matchOnDescription: options?.matchOnDescription,
                matchOnDetail: options?.matchOnDetail,
                ignoreFocusLost: options?.ignoreFocusOut,
                canPickMany: options?.canPickMany,
            }, token);
            const widgetClosedMarker = {};
            const widgetClosedPromise = quickPickWidget.then(() => widgetClosedMarker);
            return Promise.race([widgetClosedPromise, itemsPromise]).then(result => {
                if (result === widgetClosedMarker) {
                    return undefined;
                }
                return itemsPromise.then(items => {
                    const pickItems = [];
                    for (let handle = 0; handle < items.length; handle++) {
                        const item = items[handle];
                        if (typeof item === 'string') {
                            pickItems.push({ label: item, handle });
                        }
                        else if (item.kind === QuickPickItemKind.Separator) {
                            pickItems.push({ type: 'separator', label: item.label });
                        }
                        else {
                            if (item.tooltip) {
                                checkProposedApiEnabled(extension, 'quickPickItemTooltip');
                            }
                            if (item.resourceUri) {
                                checkProposedApiEnabled(extension, 'quickPickItemResource');
                            }
                            pickItems.push({
                                label: item.label,
                                iconPathDto: IconPath.from(item.iconPath),
                                description: item.description,
                                detail: item.detail,
                                picked: item.picked,
                                alwaysShow: item.alwaysShow,
                                tooltip: MarkdownString.fromStrict(item.tooltip),
                                resourceUri: item.resourceUri,
                                handle
                            });
                        }
                    }
                    // handle selection changes
                    if (options && typeof options.onDidSelectItem === 'function') {
                        this._onDidSelectItem = (handle) => {
                            options.onDidSelectItem(items[handle]);
                        };
                    }
                    // show items
                    proxy.$setItems(instance, pickItems);
                    return quickPickWidget.then(handle => {
                        if (typeof handle === 'number') {
                            return items[handle];
                        }
                        else if (Array.isArray(handle)) {
                            return handle.map(h => items[h]);
                        }
                        return undefined;
                    });
                });
            }).then(undefined, err => {
                if (isCancellationError(err)) {
                    return undefined;
                }
                proxy.$setError(instance, err);
                return Promise.reject(err);
            });
        }
        $onItemSelected(handle) {
            this._onDidSelectItem?.(handle);
        }
        // ---- input
        showInput(options, token = CancellationToken.None) {
            // global validate fn used in callback below
            this._validateInput = options?.validateInput;
            return proxy.$input(options, typeof this._validateInput === 'function', token)
                .then(undefined, err => {
                if (isCancellationError(err)) {
                    return undefined;
                }
                return Promise.reject(err);
            });
        }
        async $validateInput(input) {
            if (!this._validateInput) {
                return;
            }
            const result = await this._validateInput(input);
            if (!result || typeof result === 'string') {
                return result;
            }
            let severity;
            switch (result.severity) {
                case InputBoxValidationSeverity.Info:
                    severity = Severity.Info;
                    break;
                case InputBoxValidationSeverity.Warning:
                    severity = Severity.Warning;
                    break;
                case InputBoxValidationSeverity.Error:
                    severity = Severity.Error;
                    break;
                default:
                    severity = result.message ? Severity.Error : Severity.Ignore;
                    break;
            }
            return {
                content: result.message,
                severity
            };
        }
        // ---- workspace folder picker
        async showWorkspaceFolderPick(options, token = CancellationToken.None) {
            const selectedFolder = await this._commands.executeCommand('_workbench.pickWorkspaceFolder', [options]);
            if (!selectedFolder) {
                return undefined;
            }
            const workspaceFolders = await this._workspace.getWorkspaceFolders2();
            if (!workspaceFolders) {
                return undefined;
            }
            return workspaceFolders.find(folder => folder.uri.toString() === selectedFolder.uri.toString());
        }
        // ---- QuickInput
        createQuickPick(extension) {
            const session = new ExtHostQuickPick(extension, () => this._sessions.delete(session._id));
            this._sessions.set(session._id, session);
            return session;
        }
        createInputBox(extension) {
            const session = new ExtHostInputBox(extension, () => this._sessions.delete(session._id));
            this._sessions.set(session._id, session);
            return session;
        }
        $onDidChangeValue(sessionId, value) {
            const session = this._sessions.get(sessionId);
            session?._fireDidChangeValue(value);
        }
        $onDidAccept(sessionId) {
            const session = this._sessions.get(sessionId);
            session?._fireDidAccept();
        }
        $onDidChangeActive(sessionId, handles) {
            const session = this._sessions.get(sessionId);
            if (session instanceof ExtHostQuickPick) {
                session._fireDidChangeActive(handles);
            }
        }
        $onDidChangeSelection(sessionId, handles) {
            const session = this._sessions.get(sessionId);
            if (session instanceof ExtHostQuickPick) {
                session._fireDidChangeSelection(handles);
            }
        }
        $onDidTriggerButton(sessionId, handle, checked) {
            const session = this._sessions.get(sessionId);
            session?._fireDidTriggerButton(handle, checked);
        }
        $onDidTriggerItemButton(sessionId, itemHandle, buttonHandle) {
            const session = this._sessions.get(sessionId);
            if (session instanceof ExtHostQuickPick) {
                session._fireDidTriggerItemButton(itemHandle, buttonHandle);
            }
        }
        $onDidHide(sessionId) {
            const session = this._sessions.get(sessionId);
            session?._fireDidHide();
        }
    }
    class ExtHostQuickInput {
        static { this._nextId = 1; }
        constructor(_extension, _onDidDispose) {
            this._extension = _extension;
            this._onDidDispose = _onDidDispose;
            this._id = ExtHostQuickPick._nextId++;
            this._visible = false;
            this._expectingHide = false;
            this._enabled = true;
            this._busy = false;
            this._ignoreFocusOut = true;
            this._value = '';
            this._valueSelection = undefined;
            this._buttons = [];
            this._handlesToButtons = new Map();
            this._onDidAcceptEmitter = new Emitter();
            this._onDidChangeValueEmitter = new Emitter();
            this._onDidTriggerButtonEmitter = new Emitter();
            this._onDidHideEmitter = new Emitter();
            this._pendingUpdate = { id: this._id };
            this._disposed = false;
            this._disposables = [
                this._onDidTriggerButtonEmitter,
                this._onDidHideEmitter,
                this._onDidAcceptEmitter,
                this._onDidChangeValueEmitter
            ];
            this.onDidChangeValue = this._onDidChangeValueEmitter.event;
            this.onDidAccept = this._onDidAcceptEmitter.event;
            this.onDidTriggerButton = this._onDidTriggerButtonEmitter.event;
            this.onDidHide = this._onDidHideEmitter.event;
        }
        get title() {
            return this._title;
        }
        set title(title) {
            this._title = title;
            this.update({ title });
        }
        get step() {
            return this._steps;
        }
        set step(step) {
            this._steps = step;
            this.update({ step });
        }
        get totalSteps() {
            return this._totalSteps;
        }
        set totalSteps(totalSteps) {
            this._totalSteps = totalSteps;
            this.update({ totalSteps });
        }
        get enabled() {
            return this._enabled;
        }
        set enabled(enabled) {
            this._enabled = enabled;
            this.update({ enabled });
        }
        get busy() {
            return this._busy;
        }
        set busy(busy) {
            this._busy = busy;
            this.update({ busy });
        }
        get ignoreFocusOut() {
            return this._ignoreFocusOut;
        }
        set ignoreFocusOut(ignoreFocusOut) {
            this._ignoreFocusOut = ignoreFocusOut;
            this.update({ ignoreFocusOut });
        }
        get value() {
            return this._value;
        }
        set value(value) {
            this._value = value;
            this.update({ value });
        }
        get valueSelection() {
            return this._valueSelection;
        }
        set valueSelection(valueSelection) {
            this._valueSelection = valueSelection;
            this.update({ valueSelection });
        }
        get placeholder() {
            return this._placeholder;
        }
        set placeholder(placeholder) {
            this._placeholder = placeholder;
            this.update({ placeholder });
        }
        get buttons() {
            return this._buttons;
        }
        set buttons(buttons) {
            if (buttons.some(button => typeof button.location === 'number' ||
                typeof button.toggle === 'object' && typeof button.toggle.checked === 'boolean')) {
                checkProposedApiEnabled(this._extension, 'quickInputButtonLocation');
            }
            if (buttons.some(button => typeof button.location === 'number' &&
                button.location !== QuickInputButtonLocation.Input &&
                typeof button.toggle === 'object' &&
                typeof button.toggle.checked === 'boolean')) {
                throw new Error('QuickInputButtons with toggle set are only supported in the Input location.');
            }
            this._buttons = buttons.slice();
            this._handlesToButtons.clear();
            buttons.forEach((button, i) => {
                const handle = button === QuickInputButtons.Back ? -1 : i;
                this._handlesToButtons.set(handle, button);
            });
            this.update({
                buttons: buttons.map((button, i) => {
                    return {
                        iconPathDto: IconPath.from(button.iconPath),
                        tooltip: button.tooltip,
                        handle: button === QuickInputButtons.Back ? -1 : i,
                        location: typeof button.location === 'number' ? button.location : undefined,
                        checked: typeof button.toggle === 'object' && typeof button.toggle.checked === 'boolean' ? button.toggle.checked : undefined
                    };
                })
            });
        }
        show() {
            this._visible = true;
            this._expectingHide = true;
            this.update({ visible: true });
        }
        hide() {
            this._visible = false;
            this.update({ visible: false });
        }
        _fireDidAccept() {
            this._onDidAcceptEmitter.fire();
        }
        _fireDidChangeValue(value) {
            this._value = value;
            this._onDidChangeValueEmitter.fire(value);
        }
        _fireDidTriggerButton(handle, checked) {
            const button = this._handlesToButtons.get(handle);
            if (button) {
                if (checked !== undefined && button.toggle) {
                    button.toggle.checked = checked;
                }
                this._onDidTriggerButtonEmitter.fire(button);
            }
        }
        _fireDidHide() {
            if (this._expectingHide) {
                // if this._visible is true, it means that .show() was called between
                // .hide() and .onDidHide. To ensure the correct number of onDidHide events
                // are emitted, we set this._expectingHide to this value so that
                // the next time .hide() is called, we can emit the event again.
                // Example:
                // .show() -> .hide() -> .show() -> .hide() should emit 2 onDidHide events.
                // .show() -> .hide() -> .hide() should emit 1 onDidHide event.
                // Fixes #135747
                this._expectingHide = this._visible;
                this._onDidHideEmitter.fire();
            }
        }
        dispose() {
            if (this._disposed) {
                return;
            }
            this._disposed = true;
            this._fireDidHide();
            this._disposables = dispose(this._disposables);
            if (this._updateTimeout) {
                clearTimeout(this._updateTimeout);
                this._updateTimeout = undefined;
            }
            this._onDidDispose();
            proxy.$dispose(this._id);
        }
        update(properties) {
            if (this._disposed) {
                return;
            }
            for (const key of Object.keys(properties)) {
                const value = properties[key];
                this._pendingUpdate[key] = value === undefined ? null : value;
            }
            if ('visible' in this._pendingUpdate) {
                if (this._updateTimeout) {
                    clearTimeout(this._updateTimeout);
                    this._updateTimeout = undefined;
                }
                this.dispatchUpdate();
            }
            else if (this._visible && !this._updateTimeout) {
                // Defer the update so that multiple changes to setters don't cause a redraw each
                this._updateTimeout = setTimeout(() => {
                    this._updateTimeout = undefined;
                    this.dispatchUpdate();
                }, 0);
            }
        }
        dispatchUpdate() {
            proxy.$createOrUpdate(this._pendingUpdate);
            this._pendingUpdate = { id: this._id };
        }
    }
    class ExtHostQuickPick extends ExtHostQuickInput {
        constructor(extension, onDispose) {
            super(extension, onDispose);
            this._items = [];
            this._handlesToItems = new Map();
            this._itemsToHandles = new Map();
            this._canSelectMany = false;
            this._matchOnDescription = true;
            this._matchOnDetail = true;
            this._sortByLabel = true;
            this._keepScrollPosition = false;
            this._activeItems = [];
            this._onDidChangeActiveEmitter = new Emitter();
            this._selectedItems = [];
            this._onDidChangeSelectionEmitter = new Emitter();
            this._onDidTriggerItemButtonEmitter = new Emitter();
            this.onDidChangeActive = this._onDidChangeActiveEmitter.event;
            this.onDidChangeSelection = this._onDidChangeSelectionEmitter.event;
            this.onDidTriggerItemButton = this._onDidTriggerItemButtonEmitter.event;
            this._disposables.push(this._onDidChangeActiveEmitter, this._onDidChangeSelectionEmitter, this._onDidTriggerItemButtonEmitter);
            this.update({ type: 'quickPick' });
        }
        get items() {
            return this._items;
        }
        set items(items) {
            this._items = items.slice();
            this._handlesToItems.clear();
            this._itemsToHandles.clear();
            items.forEach((item, i) => {
                this._handlesToItems.set(i, item);
                this._itemsToHandles.set(item, i);
            });
            const pickItems = [];
            for (let handle = 0; handle < items.length; handle++) {
                const item = items[handle];
                if (item.kind === QuickPickItemKind.Separator) {
                    pickItems.push({ type: 'separator', label: item.label });
                }
                else {
                    if (item.tooltip) {
                        checkProposedApiEnabled(this._extension, 'quickPickItemTooltip');
                    }
                    if (item.resourceUri) {
                        checkProposedApiEnabled(this._extension, 'quickPickItemResource');
                    }
                    pickItems.push({
                        handle,
                        label: item.label,
                        iconPathDto: IconPath.from(item.iconPath),
                        description: item.description,
                        detail: item.detail,
                        picked: item.picked,
                        alwaysShow: item.alwaysShow,
                        tooltip: MarkdownString.fromStrict(item.tooltip),
                        resourceUri: item.resourceUri,
                        buttons: item.buttons?.map((button, i) => {
                            return {
                                iconPathDto: IconPath.from(button.iconPath),
                                tooltip: button.tooltip,
                                handle: i
                            };
                        }),
                    });
                }
            }
            this.update({
                items: pickItems,
            });
        }
        get canSelectMany() {
            return this._canSelectMany;
        }
        set canSelectMany(canSelectMany) {
            this._canSelectMany = canSelectMany;
            this.update({ canSelectMany });
        }
        get matchOnDescription() {
            return this._matchOnDescription;
        }
        set matchOnDescription(matchOnDescription) {
            this._matchOnDescription = matchOnDescription;
            this.update({ matchOnDescription });
        }
        get matchOnDetail() {
            return this._matchOnDetail;
        }
        set matchOnDetail(matchOnDetail) {
            this._matchOnDetail = matchOnDetail;
            this.update({ matchOnDetail });
        }
        get sortByLabel() {
            return this._sortByLabel;
        }
        set sortByLabel(sortByLabel) {
            this._sortByLabel = sortByLabel;
            this.update({ sortByLabel });
        }
        get keepScrollPosition() {
            return this._keepScrollPosition;
        }
        set keepScrollPosition(keepScrollPosition) {
            this._keepScrollPosition = keepScrollPosition;
            this.update({ keepScrollPosition });
        }
        get prompt() {
            return this._prompt;
        }
        set prompt(prompt) {
            checkProposedApiEnabled(this._extension, 'quickPickPrompt');
            this._prompt = prompt;
            this.update({ prompt });
        }
        get activeItems() {
            return this._activeItems;
        }
        set activeItems(activeItems) {
            this._activeItems = activeItems.filter(item => this._itemsToHandles.has(item));
            this.update({ activeItems: this._activeItems.map(item => this._itemsToHandles.get(item)) });
        }
        get selectedItems() {
            return this._selectedItems;
        }
        set selectedItems(selectedItems) {
            this._selectedItems = selectedItems.filter(item => this._itemsToHandles.has(item));
            this.update({ selectedItems: this._selectedItems.map(item => this._itemsToHandles.get(item)) });
        }
        _fireDidChangeActive(handles) {
            const items = coalesce(handles.map(handle => this._handlesToItems.get(handle)));
            this._activeItems = items;
            this._onDidChangeActiveEmitter.fire(items);
        }
        _fireDidChangeSelection(handles) {
            const items = coalesce(handles.map(handle => this._handlesToItems.get(handle)));
            this._selectedItems = items;
            this._onDidChangeSelectionEmitter.fire(items);
        }
        _fireDidTriggerItemButton(itemHandle, buttonHandle) {
            const item = this._handlesToItems.get(itemHandle);
            if (!item || !item.buttons || !item.buttons.length) {
                return;
            }
            const button = item.buttons[buttonHandle];
            if (button) {
                this._onDidTriggerItemButtonEmitter.fire({
                    button,
                    item
                });
            }
        }
    }
    class ExtHostInputBox extends ExtHostQuickInput {
        constructor(extension, onDispose) {
            super(extension, onDispose);
            this._password = false;
            this.update({ type: 'inputBox' });
        }
        get password() {
            return this._password;
        }
        set password(password) {
            this._password = password;
            this.update({ password });
        }
        get prompt() {
            return this._prompt;
        }
        set prompt(prompt) {
            this._prompt = prompt;
            this.update({ prompt });
        }
        get validationMessage() {
            return this._validationMessage;
        }
        set validationMessage(validationMessage) {
            this._validationMessage = validationMessage;
            if (!validationMessage) {
                this.update({ validationMessage: undefined, severity: Severity.Ignore });
            }
            else if (typeof validationMessage === 'string') {
                this.update({ validationMessage, severity: Severity.Error });
            }
            else {
                this.update({ validationMessage: validationMessage.message, severity: validationMessage.severity ?? Severity.Error });
            }
        }
    }
    return new ExtHostQuickOpenImpl(workspace, commands);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdFF1aWNrT3Blbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0UXVpY2tPcGVuLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN4RCxPQUFPLEVBQUUsT0FBTyxFQUFlLE1BQU0sbUNBQW1DLENBQUM7QUFJekUsT0FBTyxFQUF1QyxXQUFXLEVBQWtGLE1BQU0sdUJBQXVCLENBQUM7QUFDekssT0FBTyxFQUFFLGlCQUFpQixFQUFFLGlCQUFpQixFQUFFLDBCQUEwQixFQUFFLHdCQUF3QixFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDL0gsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFckUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzFELE9BQU8sUUFBUSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxRQUFRLEVBQUUsY0FBYyxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFtQnRFLE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxXQUF5QixFQUFFLFNBQW9DLEVBQUUsUUFBeUI7SUFDaEksTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUVwRSxNQUFNLG9CQUFvQjtRQVl6QixZQUFZLFNBQW9DLEVBQUUsUUFBeUI7WUFKbkUsY0FBUyxHQUFHLElBQUksR0FBRyxFQUE2QixDQUFDO1lBRWpELGVBQVUsR0FBRyxDQUFDLENBQUM7WUFHdEIs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