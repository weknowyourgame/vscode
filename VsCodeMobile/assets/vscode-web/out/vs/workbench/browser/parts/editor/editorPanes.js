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
import { localize } from '../../../../nls.js';
import { Emitter } from '../../../../base/common/event.js';
import Severity from '../../../../base/common/severity.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { EditorExtensions, isEditorOpenError } from '../../../common/editor.js';
import { Dimension, show, hide, isAncestor, getActiveElement, getWindowById, isEditableElement, $ } from '../../../../base/browser/dom.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorProgressService, LongRunningOperation } from '../../../../platform/progress/common/progress.js';
import { DEFAULT_EDITOR_MIN_DIMENSIONS, DEFAULT_EDITOR_MAX_DIMENSIONS } from './editor.js';
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { ErrorPlaceholderEditor, WorkspaceTrustRequiredPlaceholderEditor } from './editorPlaceholder.js';
import { EditorOpenSource } from '../../../../platform/editor/common/editor.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { toErrorMessage } from '../../../../base/common/errorMessage.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IHostService } from '../../../services/host/browser/host.js';
let EditorPanes = class EditorPanes extends Disposable {
    //#endregion
    get minimumWidth() { return this._activeEditorPane?.minimumWidth ?? DEFAULT_EDITOR_MIN_DIMENSIONS.width; }
    get minimumHeight() { return this._activeEditorPane?.minimumHeight ?? DEFAULT_EDITOR_MIN_DIMENSIONS.height; }
    get maximumWidth() { return this._activeEditorPane?.maximumWidth ?? DEFAULT_EDITOR_MAX_DIMENSIONS.width; }
    get maximumHeight() { return this._activeEditorPane?.maximumHeight ?? DEFAULT_EDITOR_MAX_DIMENSIONS.height; }
    get activeEditorPane() { return this._activeEditorPane; }
    constructor(editorGroupParent, editorPanesParent, groupView, layoutService, instantiationService, editorProgressService, workspaceTrustService, logService, dialogService, hostService) {
        super();
        this.editorGroupParent = editorGroupParent;
        this.editorPanesParent = editorPanesParent;
        this.groupView = groupView;
        this.layoutService = layoutService;
        this.instantiationService = instantiationService;
        this.workspaceTrustService = workspaceTrustService;
        this.logService = logService;
        this.dialogService = dialogService;
        this.hostService = hostService;
        //#region Events
        this._onDidFocus = this._register(new Emitter());
        this.onDidFocus = this._onDidFocus.event;
        this._onDidChangeSizeConstraints = this._register(new Emitter());
        this.onDidChangeSizeConstraints = this._onDidChangeSizeConstraints.event;
        this._activeEditorPane = null;
        this.editorPanes = [];
        this.mapEditorPaneToPendingSetInput = new Map();
        this.activeEditorPaneDisposables = this._register(new DisposableStore());
        this.editorPanesRegistry = Registry.as(EditorExtensions.EditorPane);
        this.editorOperation = this._register(new LongRunningOperation(editorProgressService));
        this.registerListeners();
    }
    registerListeners() {
        this._register(this.workspaceTrustService.onDidChangeTrust(() => this.onDidChangeWorkspaceTrust()));
    }
    onDidChangeWorkspaceTrust() {
        // If the active editor pane requires workspace trust
        // we need to re-open it anytime trust changes to
        // account for it.
        // For that we explicitly call into the group-view
        // to handle errors properly.
        const editor = this._activeEditorPane?.input;
        const options = this._activeEditorPane?.options;
        if (editor?.hasCapability(16 /* EditorInputCapabilities.RequiresTrust */)) {
            this.groupView.openEditor(editor, options);
        }
    }
    async openEditor(editor, options, internalOptions, context = Object.create(null)) {
        try {
            return await this.doOpenEditor(this.getEditorPaneDescriptor(editor), editor, options, internalOptions, context);
        }
        catch (error) {
            // First check if caller instructed us to ignore error handling
            if (options?.ignoreError) {
                return { error };
            }
            // In case of an error when opening an editor, we still want to show
            // an editor in the desired location to preserve the user intent and
            // view state (e.g. when restoring).
            //
            // For that reason we have place holder editors that can convey a
            // message with actions the user can click on.
            return this.doShowError(error, editor, options, internalOptions, context);
        }
    }
    async doShowError(error, editor, options, internalOptions, context) {
        // Always log the error to figure out what is going on
        this.logService.error(error);
        // Show as modal dialog when explicit user action unless disabled
        let errorHandled = false;
        if (options?.source === EditorOpenSource.USER && (!isEditorOpenError(error) || error.allowDialog)) {
            errorHandled = await this.doShowErrorDialog(error, editor);
        }
        // Return early if the user dealt with the error already
        if (errorHandled) {
            return { error };
        }
        // Show as editor placeholder: pass over the error to display
        const editorPlaceholderOptions = { ...options };
        if (!isCancellationError(error)) {
            editorPlaceholderOptions.error = error;
        }
        return {
            ...(await this.doOpenEditor(ErrorPlaceholderEditor.DESCRIPTOR, editor, editorPlaceholderOptions, internalOptions, context)),
            error
        };
    }
    async doShowErrorDialog(error, editor) {
        let severity = Severity.Error;
        let message = undefined;
        let detail = toErrorMessage(error);
        let errorActions = undefined;
        if (isEditorOpenError(error)) {
            errorActions = error.actions;
            severity = error.forceSeverity ?? Severity.Error;
            if (error.forceMessage) {
                message = error.message;
                detail = undefined;
            }
        }
        if (!message) {
            message = localize('editorOpenErrorDialog', "Unable to open '{0}'", editor.getName());
        }
        const buttons = [];
        if (errorActions && errorActions.length > 0) {
            for (const errorAction of errorActions) {
                buttons.push({
                    label: errorAction.label,
                    run: () => errorAction
                });
            }
        }
        else {
            buttons.push({
                label: localize({ key: 'ok', comment: ['&& denotes a mnemonic'] }, "&&OK"),
                run: () => undefined
            });
        }
        let cancelButton = undefined;
        if (buttons.length === 1) {
            cancelButton = {
                run: () => {
                    errorHandled = true; // treat cancel as handled and do not show placeholder
                    return undefined;
                }
            };
        }
        let errorHandled = false; // by default, show placeholder
        const { result } = await this.dialogService.prompt({
            type: severity,
            message,
            detail,
            buttons,
            cancelButton
        });
        if (result) {
            const errorActionResult = result.run();
            if (errorActionResult instanceof Promise) {
                errorActionResult.catch(error => this.dialogService.error(toErrorMessage(error)));
            }
            errorHandled = true; // treat custom error action as handled and do not show placeholder
        }
        return errorHandled;
    }
    async doOpenEditor(descriptor, editor, options, internalOptions, context = Object.create(null)) {
        // Editor pane
        const pane = this.doShowEditorPane(descriptor);
        // Remember current active element for deciding to restore focus later
        const activeElement = getActiveElement();
        // Apply input to pane
        const { changed, cancelled } = await this.doSetInput(pane, editor, options, context);
        // Make sure to pass focus to the pane or otherwise
        // make sure that the pane window is visible unless
        // this has been explicitly disabled.
        if (!cancelled) {
            const focus = !options?.preserveFocus;
            if (focus && this.shouldRestoreFocus(activeElement)) {
                pane.focus();
            }
            else if (!internalOptions?.preserveWindowOrder) {
                this.hostService.moveTop(getWindowById(this.groupView.windowId, true).window);
            }
        }
        return { pane, changed, cancelled };
    }
    shouldRestoreFocus(expectedActiveElement) {
        if (!this.layoutService.isRestored()) {
            return true; // restore focus if we are not restored yet on startup
        }
        if (!expectedActiveElement) {
            return true; // restore focus if nothing was focused
        }
        const activeElement = getActiveElement();
        if (!activeElement || activeElement === expectedActiveElement.ownerDocument.body) {
            return true; // restore focus if nothing is focused currently
        }
        const same = expectedActiveElement === activeElement;
        if (same) {
            return true; // restore focus if same element is still active
        }
        if (!isEditableElement(activeElement)) {
            // This is to avoid regressions from not restoring focus as we used to:
            // Only allow a different input element (or textarea) to remain focused
            // but not other elements that do not accept text input.
            return true;
        }
        if (isAncestor(activeElement, this.editorGroupParent)) {
            return true; // restore focus if active element is still inside our editor group
        }
        return false; // do not restore focus
    }
    getEditorPaneDescriptor(editor) {
        if (editor.hasCapability(16 /* EditorInputCapabilities.RequiresTrust */) && !this.workspaceTrustService.isWorkspaceTrusted()) {
            // Workspace trust: if an editor signals it needs workspace trust
            // but the current workspace is untrusted, we fallback to a generic
            // editor descriptor to indicate this an do NOT load the registered
            // editor.
            return WorkspaceTrustRequiredPlaceholderEditor.DESCRIPTOR;
        }
        return assertReturnsDefined(this.editorPanesRegistry.getEditorPane(editor));
    }
    doShowEditorPane(descriptor) {
        // Return early if the currently active editor pane can handle the input
        if (this._activeEditorPane && descriptor.describes(this._activeEditorPane)) {
            return this._activeEditorPane;
        }
        // Hide active one first
        this.doHideActiveEditorPane();
        // Create editor pane
        const editorPane = this.doCreateEditorPane(descriptor);
        // Set editor as active
        this.doSetActiveEditorPane(editorPane);
        // Show editor
        const container = assertReturnsDefined(editorPane.getContainer());
        this.editorPanesParent.appendChild(container);
        show(container);
        // Indicate to editor that it is now visible
        editorPane.setVisible(true);
        // Layout
        if (this.pagePosition) {
            editorPane.layout(new Dimension(this.pagePosition.width, this.pagePosition.height), { top: this.pagePosition.top, left: this.pagePosition.left });
        }
        // Boundary sashes
        if (this.boundarySashes) {
            editorPane.setBoundarySashes(this.boundarySashes);
        }
        return editorPane;
    }
    doCreateEditorPane(descriptor) {
        // Instantiate editor
        const editorPane = this.doInstantiateEditorPane(descriptor);
        // Create editor container as needed
        if (!editorPane.getContainer()) {
            const editorPaneContainer = $('.editor-instance');
            // It is cruicial to append the container to its parent before
            // passing on to the create() method of the pane so that the
            // right `window` can be determined in floating window cases.
            this.editorPanesParent.appendChild(editorPaneContainer);
            try {
                editorPane.create(editorPaneContainer);
            }
            catch (error) {
                // At this point the editor pane container is not healthy
                // and as such, we remove it from the pane parent and hide
                // it so that we have a chance to show an error placeholder.
                // Not doing so would result in multiple `.editor-instance`
                // lingering around in the DOM.
                editorPaneContainer.remove();
                hide(editorPaneContainer);
                throw error;
            }
        }
        return editorPane;
    }
    doInstantiateEditorPane(descriptor) {
        // Return early if already instantiated
        const existingEditorPane = this.editorPanes.find(editorPane => descriptor.describes(editorPane));
        if (existingEditorPane) {
            return existingEditorPane;
        }
        // Otherwise instantiate new
        const editorPane = this._register(descriptor.instantiate(this.instantiationService, this.groupView));
        this.editorPanes.push(editorPane);
        return editorPane;
    }
    doSetActiveEditorPane(editorPane) {
        this._activeEditorPane = editorPane;
        // Clear out previous active editor pane listeners
        this.activeEditorPaneDisposables.clear();
        // Listen to editor pane changes
        if (editorPane) {
            this.activeEditorPaneDisposables.add(editorPane.onDidChangeSizeConstraints(e => this._onDidChangeSizeConstraints.fire(e)));
            this.activeEditorPaneDisposables.add(editorPane.onDidFocus(() => this._onDidFocus.fire()));
        }
        // Indicate that size constraints could have changed due to new editor
        this._onDidChangeSizeConstraints.fire(undefined);
    }
    async doSetInput(editorPane, editor, options, context) {
        // If the input did not change, return early and only
        // apply the options unless the options instruct us to
        // force open it even if it is the same
        let inputMatches = editorPane.input?.matches(editor);
        if (inputMatches && !options?.forceReload) {
            // We have to await a pending `setInput()` call for this
            // pane before we can call into `setOptions()`, otherwise
            // we risk calling when the input is not yet fully applied.
            if (this.mapEditorPaneToPendingSetInput.has(editorPane)) {
                await this.mapEditorPaneToPendingSetInput.get(editorPane);
            }
            // At this point, the input might have changed, so we check again
            inputMatches = editorPane.input?.matches(editor);
            if (inputMatches) {
                editorPane.setOptions(options);
            }
            return { changed: false, cancelled: !inputMatches };
        }
        // Start a new editor input operation to report progress
        // and to support cancellation. Any new operation that is
        // started will cancel the previous one.
        const operation = this.editorOperation.start(this.layoutService.isRestored() ? 800 : 3200);
        let cancelled = false;
        try {
            // Clear the current input before setting new input
            // This ensures that a slow loading input will not
            // be visible for the duration of the new input to
            // load (https://github.com/microsoft/vscode/issues/34697)
            editorPane.clearInput();
            // Set the input to the editor pane and keep track of it
            const pendingSetInput = editorPane.setInput(editor, options, context, operation.token);
            this.mapEditorPaneToPendingSetInput.set(editorPane, pendingSetInput);
            await pendingSetInput;
            if (!operation.isCurrent()) {
                cancelled = true;
            }
        }
        catch (error) {
            if (!operation.isCurrent()) {
                cancelled = true;
            }
            else {
                throw error;
            }
        }
        finally {
            if (operation.isCurrent()) {
                this.mapEditorPaneToPendingSetInput.delete(editorPane);
            }
            operation.stop();
        }
        return { changed: !inputMatches, cancelled };
    }
    doHideActiveEditorPane() {
        if (!this._activeEditorPane) {
            return;
        }
        // Stop any running operation
        this.editorOperation.stop();
        // Indicate to editor pane before removing the editor from
        // the DOM to give a chance to persist certain state that
        // might depend on still being the active DOM element.
        this.safeRun(() => this._activeEditorPane?.clearInput());
        this.safeRun(() => this._activeEditorPane?.setVisible(false));
        // Clear any pending setInput promise
        this.mapEditorPaneToPendingSetInput.delete(this._activeEditorPane);
        // Remove editor pane from parent
        const editorPaneContainer = this._activeEditorPane.getContainer();
        if (editorPaneContainer) {
            editorPaneContainer.remove();
            hide(editorPaneContainer);
        }
        // Clear active editor pane
        this.doSetActiveEditorPane(null);
    }
    closeEditor(editor) {
        if (this._activeEditorPane?.input && editor.matches(this._activeEditorPane.input)) {
            this.doHideActiveEditorPane();
        }
    }
    setVisible(visible) {
        this.safeRun(() => this._activeEditorPane?.setVisible(visible));
    }
    layout(pagePosition) {
        this.pagePosition = pagePosition;
        this.safeRun(() => this._activeEditorPane?.layout(new Dimension(pagePosition.width, pagePosition.height), pagePosition));
    }
    setBoundarySashes(sashes) {
        this.boundarySashes = sashes;
        this.safeRun(() => this._activeEditorPane?.setBoundarySashes(sashes));
    }
    safeRun(fn) {
        // We delegate many calls to the active editor pane which
        // can be any kind of editor. We must ensure that our calls
        // do not throw, for example in `layout()` because that can
        // mess with the grid layout.
        try {
            fn();
        }
        catch (error) {
            this.logService.error(error);
        }
    }
};
EditorPanes = __decorate([
    __param(3, IWorkbenchLayoutService),
    __param(4, IInstantiationService),
    __param(5, IEditorProgressService),
    __param(6, IWorkspaceTrustManagementService),
    __param(7, ILogService),
    __param(8, IDialogService),
    __param(9, IHostService)
], EditorPanes);
export { EditorPanes };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yUGFuZXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvclBhbmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUU5QyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDM0QsT0FBTyxRQUFRLE1BQU0scUNBQXFDLENBQUM7QUFDM0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRixPQUFPLEVBQUUsZ0JBQWdCLEVBQW1FLGlCQUFpQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFFakosT0FBTyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUF3QixVQUFVLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxFQUFFLGlCQUFpQixFQUFFLENBQUMsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ2pLLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUU1RSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUU1RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNoSCxPQUFPLEVBQW9CLDZCQUE2QixFQUFFLDZCQUE2QixFQUE4QixNQUFNLGFBQWEsQ0FBQztBQUN6SSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMzRyxPQUFPLEVBQUUsc0JBQXNCLEVBQWtDLHVDQUF1QyxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDekksT0FBTyxFQUFFLGdCQUFnQixFQUFrQixNQUFNLDhDQUE4QyxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDckUsT0FBTyxFQUFFLGNBQWMsRUFBc0MsTUFBTSxnREFBZ0QsQ0FBQztBQUVwSCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFvQy9ELElBQU0sV0FBVyxHQUFqQixNQUFNLFdBQVksU0FBUSxVQUFVO0lBVTFDLFlBQVk7SUFFWixJQUFJLFlBQVksS0FBSyxPQUFPLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxZQUFZLElBQUksNkJBQTZCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUMxRyxJQUFJLGFBQWEsS0FBSyxPQUFPLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxhQUFhLElBQUksNkJBQTZCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUM3RyxJQUFJLFlBQVksS0FBSyxPQUFPLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxZQUFZLElBQUksNkJBQTZCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUMxRyxJQUFJLGFBQWEsS0FBSyxPQUFPLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxhQUFhLElBQUksNkJBQTZCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUc3RyxJQUFJLGdCQUFnQixLQUFnQyxPQUFPLElBQUksQ0FBQyxpQkFBOEMsQ0FBQyxDQUFDLENBQUM7SUFhakgsWUFDa0IsaUJBQThCLEVBQzlCLGlCQUE4QixFQUM5QixTQUEyQixFQUNuQixhQUF1RCxFQUN6RCxvQkFBNEQsRUFDM0QscUJBQTZDLEVBQ25DLHFCQUF3RSxFQUM3RixVQUF3QyxFQUNyQyxhQUE4QyxFQUNoRCxXQUEwQztRQUV4RCxLQUFLLEVBQUUsQ0FBQztRQVhTLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBYTtRQUM5QixzQkFBaUIsR0FBakIsaUJBQWlCLENBQWE7UUFDOUIsY0FBUyxHQUFULFNBQVMsQ0FBa0I7UUFDRixrQkFBYSxHQUFiLGFBQWEsQ0FBeUI7UUFDeEMseUJBQW9CLEdBQXBCLG9CQUFvQixDQUF1QjtRQUVoQywwQkFBcUIsR0FBckIscUJBQXFCLENBQWtDO1FBQzVFLGVBQVUsR0FBVixVQUFVLENBQWE7UUFDcEIsa0JBQWEsR0FBYixhQUFhLENBQWdCO1FBQy9CLGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBdkN6RCxnQkFBZ0I7UUFFQyxnQkFBVyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVEsQ0FBQyxDQUFDO1FBQzFELGVBQVUsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQztRQUVyQyxnQ0FBMkIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFpRCxDQUFDLENBQUM7UUFDMUcsK0JBQTBCLEdBQUcsSUFBSSxDQUFDLDJCQUEyQixDQUFDLEtBQUssQ0FBQztRQVNyRSxzQkFBaUIsR0FBc0IsSUFBSSxDQUFDO1FBR25DLGdCQUFXLEdBQWlCLEVBQUUsQ0FBQztRQUMvQixtQ0FBOEIsR0FBRyxJQUFJLEdBQUcsRUFBNkIsQ0FBQztRQUV0RSxnQ0FBMkIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksZUFBZSxFQUFFLENBQUMsQ0FBQztRQU1wRSx3QkFBbUIsR0FBRyxRQUFRLENBQUMsRUFBRSxDQUFzQixnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQWdCcEcsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksb0JBQW9CLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDO1FBRXZGLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO0lBQzFCLENBQUM7SUFFTyxpQkFBaUI7UUFDeEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLHlCQUF5QixFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3JHLENBQUM7SUFFTyx5QkFBeUI7UUFFaEMscURBQXFEO1FBQ3JELGlEQUFpRDtRQUNqRCxrQkFBa0I7UUFDbEIsa0RBQWtEO1FBQ2xELDZCQUE2QjtRQUM3QixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsS0FBSyxDQUFDO1FBQzdDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxPQUFPLENBQUM7UUFDaEQsSUFBSSxNQUFNLEVBQUUsYUFBYSxnREFBdUMsRUFBRSxDQUFDO1lBQ2xFLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM1QyxDQUFDO0lBQ0YsQ0FBQztJQUVELEtBQUssQ0FBQyxVQUFVLENBQUMsTUFBbUIsRUFBRSxPQUFtQyxFQUFFLGVBQXVELEVBQUUsVUFBOEIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDcEwsSUFBSSxDQUFDO1lBQ0osT0FBTyxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sQ0FBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2pILENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBRWhCLCtEQUErRDtZQUMvRCxJQUFJLE9BQU8sRUFBRSxXQUFXLEVBQUUsQ0FBQztnQkFDMUIsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO1lBQ2xCLENBQUM7WUFFRCxvRUFBb0U7WUFDcEUsb0VBQW9FO1lBQ3BFLG9DQUFvQztZQUNwQyxFQUFFO1lBQ0YsaUVBQWlFO1lBQ2pFLDhDQUE4QztZQUU5QyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzNFLENBQUM7SUFDRixDQUFDO0lBRU8sS0FBSyxDQUFDLFdBQVcsQ0FBQyxLQUFZLEVBQUUsTUFBbUIsRUFBRSxPQUFtQyxFQUFFLGVBQXVELEVBQUUsT0FBNEI7UUFFdEwsc0RBQXNEO1FBQ3RELElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTdCLGlFQUFpRTtRQUNqRSxJQUFJLFlBQVksR0FBRyxLQUFLLENBQUM7UUFDekIsSUFBSSxPQUFPLEVBQUUsTUFBTSxLQUFLLGdCQUFnQixDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7WUFDbkcsWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztRQUM1RCxDQUFDO1FBRUQsd0RBQXdEO1FBQ3hELElBQUksWUFBWSxFQUFFLENBQUM7WUFDbEIsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO1FBQ2xCLENBQUM7UUFFRCw2REFBNkQ7UUFDN0QsTUFBTSx3QkFBd0IsR0FBbUMsRUFBRSxHQUFHLE9BQU8sRUFBRSxDQUFDO1FBQ2hGLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ2pDLHdCQUF3QixDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDeEMsQ0FBQztRQUVELE9BQU87WUFDTixHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLHNCQUFzQixDQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUUsd0JBQXdCLEVBQUUsZUFBZSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzNILEtBQUs7U0FDTCxDQUFDO0lBQ0gsQ0FBQztJQUVPLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxLQUFZLEVBQUUsTUFBbUI7UUFDaEUsSUFBSSxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQztRQUM5QixJQUFJLE9BQU8sR0FBdUIsU0FBUyxDQUFDO1FBQzVDLElBQUksTUFBTSxHQUF1QixjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdkQsSUFBSSxZQUFZLEdBQW1DLFNBQVMsQ0FBQztRQUU3RCxJQUFJLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDOUIsWUFBWSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUM7WUFDN0IsUUFBUSxHQUFHLEtBQUssQ0FBQyxhQUFhLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQztZQUNqRCxJQUFJLEtBQUssQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFDeEIsT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUM7Z0JBQ3hCLE1BQU0sR0FBRyxTQUFTLENBQUM7WUFDcEIsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDZCxPQUFPLEdBQUcsUUFBUSxDQUFDLHVCQUF1QixFQUFFLHNCQUFzQixFQUFFLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZGLENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBeUMsRUFBRSxDQUFDO1FBQ3pELElBQUksWUFBWSxJQUFJLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDN0MsS0FBSyxNQUFNLFdBQVcsSUFBSSxZQUFZLEVBQUUsQ0FBQztnQkFDeEMsT0FBTyxDQUFDLElBQUksQ0FBQztvQkFDWixLQUFLLEVBQUUsV0FBVyxDQUFDLEtBQUs7b0JBQ3hCLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxXQUFXO2lCQUN0QixDQUFDLENBQUM7WUFDSixDQUFDO1FBQ0YsQ0FBQzthQUFNLENBQUM7WUFDUCxPQUFPLENBQUMsSUFBSSxDQUFDO2dCQUNaLEtBQUssRUFBRSxRQUFRLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxDQUFDLHVCQUF1QixDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUM7Z0JBQzFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxTQUFTO2FBQ3BCLENBQUMsQ0FBQztRQUNKLENBQUM7UUFFRCxJQUFJLFlBQVksR0FBK0MsU0FBUyxDQUFDO1FBQ3pFLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUMxQixZQUFZLEdBQUc7Z0JBQ2QsR0FBRyxFQUFFLEdBQUcsRUFBRTtvQkFDVCxZQUFZLEdBQUcsSUFBSSxDQUFDLENBQUMsc0RBQXNEO29CQUUzRSxPQUFPLFNBQVMsQ0FBQztnQkFDbEIsQ0FBQzthQUNELENBQUM7UUFDSCxDQUFDO1FBRUQsSUFBSSxZQUFZLEdBQUcsS0FBSyxDQUFDLENBQUUsK0JBQStCO1FBRTFELE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDO1lBQ2xELElBQUksRUFBRSxRQUFRO1lBQ2QsT0FBTztZQUNQLE1BQU07WUFDTixPQUFPO1lBQ1AsWUFBWTtTQUNaLENBQUMsQ0FBQztRQUVILElBQUksTUFBTSxFQUFFLENBQUM7WUFDWixNQUFNLGlCQUFpQixHQUFHLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUN2QyxJQUFJLGlCQUFpQixZQUFZLE9BQU8sRUFBRSxDQUFDO2dCQUMxQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25GLENBQUM7WUFFRCxZQUFZLEdBQUcsSUFBSSxDQUFDLENBQUMsbUVBQW1FO1FBQ3pGLENBQUM7UUFFRCxPQUFPLFlBQVksQ0FBQztJQUNyQixDQUFDO0lBRU8sS0FBSyxDQUFDLFlBQVksQ0FBQyxVQUFpQyxFQUFFLE1BQW1CLEVBQUUsT0FBbUMsRUFBRSxlQUF1RCxFQUFFLFVBQThCLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBRWpPLGNBQWM7UUFDZCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFL0Msc0VBQXNFO1FBQ3RFLE1BQU0sYUFBYSxHQUFHLGdCQUFnQixFQUFFLENBQUM7UUFFekMsc0JBQXNCO1FBQ3RCLE1BQU0sRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRXJGLG1EQUFtRDtRQUNuRCxtREFBbUQ7UUFDbkQscUNBQXFDO1FBQ3JDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNoQixNQUFNLEtBQUssR0FBRyxDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUM7WUFDdEMsSUFBSSxLQUFLLElBQUksSUFBSSxDQUFDLGtCQUFrQixDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7Z0JBQ3JELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNkLENBQUM7aUJBQU0sSUFBSSxDQUFDLGVBQWUsRUFBRSxtQkFBbUIsRUFBRSxDQUFDO2dCQUNsRCxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDL0UsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsQ0FBQztJQUNyQyxDQUFDO0lBRU8sa0JBQWtCLENBQUMscUJBQXFDO1FBQy9ELElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUM7WUFDdEMsT0FBTyxJQUFJLENBQUMsQ0FBQyxzREFBc0Q7UUFDcEUsQ0FBQztRQUVELElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1lBQzVCLE9BQU8sSUFBSSxDQUFDLENBQUMsdUNBQXVDO1FBQ3JELENBQUM7UUFFRCxNQUFNLGFBQWEsR0FBRyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3pDLElBQUksQ0FBQyxhQUFhLElBQUksYUFBYSxLQUFLLHFCQUFxQixDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNsRixPQUFPLElBQUksQ0FBQyxDQUFDLGdEQUFnRDtRQUM5RCxDQUFDO1FBRUQsTUFBTSxJQUFJLEdBQUcscUJBQXFCLEtBQUssYUFBYSxDQUFDO1FBQ3JELElBQUksSUFBSSxFQUFFLENBQUM7WUFDVixPQUFPLElBQUksQ0FBQyxDQUFDLGdEQUFnRDtRQUM5RCxDQUFDO1FBRUQsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7WUFFdkMsdUVBQXVFO1lBQ3ZFLHVFQUF1RTtZQUN2RSx3REFBd0Q7WUFFeEQsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBRUQsSUFBSSxVQUFVLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUM7WUFDdkQsT0FBTyxJQUFJLENBQUMsQ0FBQyxtRUFBbUU7UUFDakYsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDLENBQUMsdUJBQXVCO0lBQ3RDLENBQUM7SUFFTyx1QkFBdUIsQ0FBQyxNQUFtQjtRQUNsRCxJQUFJLE1BQU0sQ0FBQyxhQUFhLGdEQUF1QyxJQUFJLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLGtCQUFrQixFQUFFLEVBQUUsQ0FBQztZQUNySCxpRUFBaUU7WUFDakUsbUVBQW1FO1lBQ25FLG1FQUFtRTtZQUNuRSxVQUFVO1lBQ1YsT0FBTyx1Q0FBdUMsQ0FBQyxVQUFVLENBQUM7UUFDM0QsQ0FBQztRQUVELE9BQU8sb0JBQW9CLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQzdFLENBQUM7SUFFTyxnQkFBZ0IsQ0FBQyxVQUFpQztRQUV6RCx3RUFBd0U7UUFDeEUsSUFBSSxJQUFJLENBQUMsaUJBQWlCLElBQUksVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsRUFBRSxDQUFDO1lBQzVFLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDO1FBQy9CLENBQUM7UUFFRCx3QkFBd0I7UUFDeEIsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7UUFFOUIscUJBQXFCO1FBQ3JCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUV2RCx1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRXZDLGNBQWM7UUFDZCxNQUFNLFNBQVMsR0FBRyxvQkFBb0IsQ0FBQyxVQUFVLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztRQUNsRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzlDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUVoQiw0Q0FBNEM7UUFDNUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUU1QixTQUFTO1FBQ1QsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDdkIsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7UUFDbkosQ0FBQztRQUVELGtCQUFrQjtRQUNsQixJQUFJLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN6QixVQUFVLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ25ELENBQUM7UUFFRCxPQUFPLFVBQVUsQ0FBQztJQUNuQixDQUFDO0lBRU8sa0JBQWtCLENBQUMsVUFBaUM7UUFFM0QscUJBQXFCO1FBQ3JCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUU1RCxvQ0FBb0M7UUFDcEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDO1lBQ2hDLE1BQU0sbUJBQW1CLEdBQUcsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUM7WUFFbEQsOERBQThEO1lBQzlELDREQUE0RDtZQUM1RCw2REFBNkQ7WUFDN0QsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1lBRXhELElBQUksQ0FBQztnQkFDSixVQUFVLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFDeEMsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBRWhCLHlEQUF5RDtnQkFDekQsMERBQTBEO2dCQUMxRCw0REFBNEQ7Z0JBQzVELDJEQUEyRDtnQkFDM0QsK0JBQStCO2dCQUUvQixtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDN0IsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7Z0JBRTFCLE1BQU0sS0FBSyxDQUFDO1lBQ2IsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLFVBQVUsQ0FBQztJQUNuQixDQUFDO0lBRU8sdUJBQXVCLENBQUMsVUFBaUM7UUFFaEUsdUNBQXVDO1FBQ3ZDLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDakcsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO1lBQ3hCLE9BQU8sa0JBQWtCLENBQUM7UUFDM0IsQ0FBQztRQUVELDRCQUE0QjtRQUM1QixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLG9CQUFvQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ3JHLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRWxDLE9BQU8sVUFBVSxDQUFDO0lBQ25CLENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxVQUE2QjtRQUMxRCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsVUFBVSxDQUFDO1FBRXBDLGtEQUFrRDtRQUNsRCxJQUFJLENBQUMsMkJBQTJCLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFekMsZ0NBQWdDO1FBQ2hDLElBQUksVUFBVSxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDLDJCQUEyQixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzSCxJQUFJLENBQUMsMkJBQTJCLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUYsQ0FBQztRQUVELHNFQUFzRTtRQUN0RSxJQUFJLENBQUMsMkJBQTJCLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFFTyxLQUFLLENBQUMsVUFBVSxDQUFDLFVBQXNCLEVBQUUsTUFBbUIsRUFBRSxPQUFtQyxFQUFFLE9BQTJCO1FBRXJJLHFEQUFxRDtRQUNyRCxzREFBc0Q7UUFDdEQsdUNBQXVDO1FBQ3ZDLElBQUksWUFBWSxHQUFHLFVBQVUsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JELElBQUksWUFBWSxJQUFJLENBQUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxDQUFDO1lBRTNDLHdEQUF3RDtZQUN4RCx5REFBeUQ7WUFDekQsMkRBQTJEO1lBQzNELElBQUksSUFBSSxDQUFDLDhCQUE4QixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO2dCQUN6RCxNQUFNLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDM0QsQ0FBQztZQUVELGlFQUFpRTtZQUNqRSxZQUFZLEdBQUcsVUFBVSxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDakQsSUFBSSxZQUFZLEVBQUUsQ0FBQztnQkFDbEIsVUFBVSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNoQyxDQUFDO1lBRUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDckQsQ0FBQztRQUVELHdEQUF3RDtRQUN4RCx5REFBeUQ7UUFDekQsd0NBQXdDO1FBQ3hDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFM0YsSUFBSSxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBQ3RCLElBQUksQ0FBQztZQUVKLG1EQUFtRDtZQUNuRCxrREFBa0Q7WUFDbEQsa0RBQWtEO1lBQ2xELDBEQUEwRDtZQUMxRCxVQUFVLENBQUMsVUFBVSxFQUFFLENBQUM7WUFFeEIsd0RBQXdEO1lBQ3hELE1BQU0sZUFBZSxHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3ZGLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBQ3JFLE1BQU0sZUFBZSxDQUFDO1lBRXRCLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQztnQkFDNUIsU0FBUyxHQUFHLElBQUksQ0FBQztZQUNsQixDQUFDO1FBQ0YsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDO2dCQUM1QixTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ2xCLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxNQUFNLEtBQUssQ0FBQztZQUNiLENBQUM7UUFDRixDQUFDO2dCQUFTLENBQUM7WUFDVixJQUFJLFNBQVMsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDO2dCQUMzQixJQUFJLENBQUMsOEJBQThCLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3hELENBQUM7WUFDRCxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDbEIsQ0FBQztRQUVELE9BQU8sRUFBRSxPQUFPLEVBQUUsQ0FBQyxZQUFZLEVBQUUsU0FBUyxFQUFFLENBQUM7SUFDOUMsQ0FBQztJQUVPLHNCQUFzQjtRQUM3QixJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDN0IsT0FBTztRQUNSLENBQUM7UUFFRCw2QkFBNkI7UUFDN0IsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUU1QiwwREFBMEQ7UUFDMUQseURBQXlEO1FBQ3pELHNEQUFzRDtRQUN0RCxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQ3pELElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBRTlELHFDQUFxQztRQUNyQyxJQUFJLENBQUMsOEJBQThCLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBRW5FLGlDQUFpQztRQUNqQyxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNsRSxJQUFJLG1CQUFtQixFQUFFLENBQUM7WUFDekIsbUJBQW1CLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0IsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDM0IsQ0FBQztRQUVELDJCQUEyQjtRQUMzQixJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbEMsQ0FBQztJQUVELFdBQVcsQ0FBQyxNQUFtQjtRQUM5QixJQUFJLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxLQUFLLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNuRixJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUMvQixDQUFDO0lBQ0YsQ0FBQztJQUVELFVBQVUsQ0FBQyxPQUFnQjtRQUMxQixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRUQsTUFBTSxDQUFDLFlBQWtDO1FBQ3hDLElBQUksQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDO1FBRWpDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxJQUFJLFNBQVMsQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLFlBQVksQ0FBQyxNQUFNLENBQUMsRUFBRSxZQUFZLENBQUMsQ0FBQyxDQUFDO0lBQzFILENBQUM7SUFFRCxpQkFBaUIsQ0FBQyxNQUF1QjtRQUN4QyxJQUFJLENBQUMsY0FBYyxHQUFHLE1BQU0sQ0FBQztRQUU3QixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFFTyxPQUFPLENBQUMsRUFBYztRQUU3Qix5REFBeUQ7UUFDekQsMkRBQTJEO1FBQzNELDJEQUEyRDtRQUMzRCw2QkFBNkI7UUFFN0IsSUFBSSxDQUFDO1lBQ0osRUFBRSxFQUFFLENBQUM7UUFDTixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNoQixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM5QixDQUFDO0lBQ0YsQ0FBQztDQUNELENBQUE7QUFwZVksV0FBVztJQW1DckIsV0FBQSx1QkFBdUIsQ0FBQTtJQUN2QixXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEsc0JBQXNCLENBQUE7SUFDdEIsV0FBQSxnQ0FBZ0MsQ0FBQTtJQUNoQyxXQUFBLFdBQVcsQ0FBQTtJQUNYLFdBQUEsY0FBYyxDQUFBO0lBQ2QsV0FBQSxZQUFZLENBQUE7R0F6Q0YsV0FBVyxDQW9ldkIifQ==