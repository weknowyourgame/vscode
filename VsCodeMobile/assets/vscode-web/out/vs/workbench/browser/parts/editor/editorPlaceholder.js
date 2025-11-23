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
var EditorPlaceholder_1, WorkspaceTrustRequiredPlaceholderEditor_1, ErrorPlaceholderEditor_1;
import './media/editorplaceholder.css';
import { localize } from '../../../../nls.js';
import { truncate } from '../../../../base/common/strings.js';
import Severity from '../../../../base/common/severity.js';
import { isEditorOpenError } from '../../../common/editor.js';
import { EditorPane } from './editorPane.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { DomScrollableElement } from '../../../../base/browser/ui/scrollbar/scrollableElement.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { size, clearNode, $, EventHelper } from '../../../../base/browser/dom.js';
import { DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { assertReturnsAllDefined } from '../../../../base/common/types.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IWorkspaceContextService, isSingleFolderWorkspaceIdentifier, toWorkspaceIdentifier } from '../../../../platform/workspace/common/workspace.js';
import { EditorOpenSource } from '../../../../platform/editor/common/editor.js';
import { computeEditorAriaLabel, EditorPaneDescriptor } from '../../editor.js';
import { ButtonBar } from '../../../../base/browser/ui/button/button.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { SimpleIconLabel } from '../../../../base/browser/ui/iconLabel/simpleIconLabel.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { toErrorMessage } from '../../../../base/common/errorMessage.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { showWindowLogActionId } from '../../../services/log/common/logConstants.js';
let EditorPlaceholder = class EditorPlaceholder extends EditorPane {
    static { EditorPlaceholder_1 = this; }
    static { this.PLACEHOLDER_LABEL_MAX_LENGTH = 1024; }
    constructor(id, group, telemetryService, themeService, storageService) {
        super(id, group, telemetryService, themeService, storageService);
        this.inputDisposable = this._register(new MutableDisposable());
    }
    createEditor(parent) {
        // Container
        this.container = $('.monaco-editor-pane-placeholder', {
            tabIndex: 0 // enable focus support from the editor part (do not remove)
        });
        this.container.style.outline = 'none';
        // Custom Scrollbars
        this.scrollbar = this._register(new DomScrollableElement(this.container, { horizontal: 1 /* ScrollbarVisibility.Auto */, vertical: 1 /* ScrollbarVisibility.Auto */ }));
        parent.appendChild(this.scrollbar.getDomNode());
    }
    async setInput(input, options, context, token) {
        await super.setInput(input, options, context, token);
        // Check for cancellation
        if (token.isCancellationRequested) {
            return;
        }
        // Render Input
        this.inputDisposable.value = await this.renderInput(input, options);
    }
    async renderInput(input, options) {
        const [container, scrollbar] = assertReturnsAllDefined(this.container, this.scrollbar);
        // Reset any previous contents
        clearNode(container);
        // Delegate to implementation for contents
        const disposables = new DisposableStore();
        const { icon, label, actions } = await this.getContents(input, options, disposables);
        const truncatedLabel = truncate(label, EditorPlaceholder_1.PLACEHOLDER_LABEL_MAX_LENGTH);
        // Icon
        const iconContainer = container.appendChild($('.editor-placeholder-icon-container'));
        const iconWidget = disposables.add(new SimpleIconLabel(iconContainer));
        iconWidget.text = icon;
        // Label
        const labelContainer = container.appendChild($('.editor-placeholder-label-container'));
        const labelWidget = $('span');
        labelWidget.textContent = truncatedLabel;
        labelContainer.appendChild(labelWidget);
        // ARIA label
        container.setAttribute('aria-label', `${computeEditorAriaLabel(input, undefined, this.group, undefined)}, ${truncatedLabel}`);
        // Buttons
        if (actions.length) {
            const actionsContainer = container.appendChild($('.editor-placeholder-buttons-container'));
            const buttons = disposables.add(new ButtonBar(actionsContainer));
            for (let i = 0; i < actions.length; i++) {
                const button = disposables.add(buttons.addButton({
                    ...defaultButtonStyles,
                    secondary: i !== 0
                }));
                button.label = actions[i].label;
                disposables.add(button.onDidClick(e => {
                    if (e) {
                        EventHelper.stop(e, true);
                    }
                    actions[i].run();
                }));
            }
        }
        // Adjust scrollbar
        scrollbar.scanDomNode();
        return disposables;
    }
    clearInput() {
        if (this.container) {
            clearNode(this.container);
        }
        this.inputDisposable.clear();
        super.clearInput();
    }
    layout(dimension) {
        const [container, scrollbar] = assertReturnsAllDefined(this.container, this.scrollbar);
        // Pass on to Container
        size(container, dimension.width, dimension.height);
        // Adjust scrollbar
        scrollbar.scanDomNode();
        // Toggle responsive class
        container.classList.toggle('max-height-200px', dimension.height <= 200);
    }
    focus() {
        super.focus();
        this.container?.focus();
    }
    dispose() {
        this.container?.remove();
        super.dispose();
    }
};
EditorPlaceholder = EditorPlaceholder_1 = __decorate([
    __param(2, ITelemetryService),
    __param(3, IThemeService),
    __param(4, IStorageService)
], EditorPlaceholder);
export { EditorPlaceholder };
let WorkspaceTrustRequiredPlaceholderEditor = class WorkspaceTrustRequiredPlaceholderEditor extends EditorPlaceholder {
    static { WorkspaceTrustRequiredPlaceholderEditor_1 = this; }
    static { this.ID = 'workbench.editors.workspaceTrustRequiredEditor'; }
    static { this.LABEL = localize('trustRequiredEditor', "Workspace Trust Required"); }
    static { this.DESCRIPTOR = EditorPaneDescriptor.create(this, this.ID, this.LABEL); }
    constructor(group, telemetryService, themeService, commandService, workspaceService, storageService) {
        super(WorkspaceTrustRequiredPlaceholderEditor_1.ID, group, telemetryService, themeService, storageService);
        this.commandService = commandService;
        this.workspaceService = workspaceService;
    }
    getTitle() {
        return WorkspaceTrustRequiredPlaceholderEditor_1.LABEL;
    }
    async getContents() {
        return {
            icon: '$(workspace-untrusted)',
            label: isSingleFolderWorkspaceIdentifier(toWorkspaceIdentifier(this.workspaceService.getWorkspace())) ?
                localize('requiresFolderTrustText', "The file is not displayed in the editor because trust has not been granted to the folder.") :
                localize('requiresWorkspaceTrustText', "The file is not displayed in the editor because trust has not been granted to the workspace."),
            actions: [
                {
                    label: localize('manageTrust', "Manage Workspace Trust"),
                    run: () => this.commandService.executeCommand('workbench.trust.manage')
                }
            ]
        };
    }
};
WorkspaceTrustRequiredPlaceholderEditor = WorkspaceTrustRequiredPlaceholderEditor_1 = __decorate([
    __param(1, ITelemetryService),
    __param(2, IThemeService),
    __param(3, ICommandService),
    __param(4, IWorkspaceContextService),
    __param(5, IStorageService)
], WorkspaceTrustRequiredPlaceholderEditor);
export { WorkspaceTrustRequiredPlaceholderEditor };
let ErrorPlaceholderEditor = class ErrorPlaceholderEditor extends EditorPlaceholder {
    static { ErrorPlaceholderEditor_1 = this; }
    static { this.ID = 'workbench.editors.errorEditor'; }
    static { this.LABEL = localize('errorEditor', "Error Editor"); }
    static { this.DESCRIPTOR = EditorPaneDescriptor.create(this, this.ID, this.LABEL); }
    constructor(group, telemetryService, themeService, storageService, fileService, dialogService, commandService) {
        super(ErrorPlaceholderEditor_1.ID, group, telemetryService, themeService, storageService);
        this.fileService = fileService;
        this.dialogService = dialogService;
        this.commandService = commandService;
    }
    async getContents(input, options, disposables) {
        const resource = input.resource;
        const error = options.error;
        const isFileNotFound = error?.fileOperationResult === 1 /* FileOperationResult.FILE_NOT_FOUND */;
        // Error Label
        let label;
        if (isFileNotFound) {
            label = localize('unavailableResourceErrorEditorText', "The editor could not be opened because the file was not found.");
        }
        else if (isEditorOpenError(error) && error.forceMessage) {
            label = error.message;
        }
        else if (error) {
            label = localize('unknownErrorEditorTextWithError', "The editor could not be opened due to an unexpected error. Please consult the log for more details.");
        }
        else {
            label = localize('unknownErrorEditorTextWithoutError', "The editor could not be opened due to an unexpected error.");
        }
        // Error Icon
        let icon = '$(error)';
        if (isEditorOpenError(error)) {
            if (error.forceSeverity === Severity.Info) {
                icon = '$(info)';
            }
            else if (error.forceSeverity === Severity.Warning) {
                icon = '$(warning)';
            }
        }
        // Actions
        let actions = undefined;
        if (isEditorOpenError(error) && error.actions.length > 0) {
            actions = error.actions.map(action => {
                return {
                    label: action.label,
                    run: () => {
                        const result = action.run();
                        if (result instanceof Promise) {
                            result.catch(error => this.dialogService.error(toErrorMessage(error)));
                        }
                    }
                };
            });
        }
        else {
            actions = [
                {
                    label: localize('retry', "Try Again"),
                    run: () => this.group.openEditor(input, { ...options, source: EditorOpenSource.USER /* explicit user gesture */ })
                },
                {
                    label: localize('showLogs', "Show Logs"),
                    run: () => this.commandService.executeCommand(showWindowLogActionId)
                }
            ];
        }
        // Auto-reload when file is added
        if (isFileNotFound && resource && this.fileService.hasProvider(resource)) {
            disposables.add(this.fileService.onDidFilesChange(e => {
                if (e.contains(resource, 1 /* FileChangeType.ADDED */, 0 /* FileChangeType.UPDATED */)) {
                    this.group.openEditor(input, options);
                }
            }));
        }
        return { icon, label, actions: actions ?? [] };
    }
};
ErrorPlaceholderEditor = ErrorPlaceholderEditor_1 = __decorate([
    __param(1, ITelemetryService),
    __param(2, IThemeService),
    __param(3, IStorageService),
    __param(4, IFileService),
    __param(5, IDialogService),
    __param(6, ICommandService)
], ErrorPlaceholderEditor);
export { ErrorPlaceholderEditor };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yUGxhY2Vob2xkZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvclBsYWNlaG9sZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLCtCQUErQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDOUQsT0FBTyxRQUFRLE1BQU0scUNBQXFDLENBQUM7QUFDM0QsT0FBTyxFQUFzQixpQkFBaUIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBRWxGLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUM3QyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN2RixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUVsRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFhLElBQUksRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRTdGLE9BQU8sRUFBRSxlQUFlLEVBQWUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN2RyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDakYsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxpQ0FBaUMsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3hKLE9BQU8sRUFBRSxnQkFBZ0IsRUFBa0IsTUFBTSw4Q0FBOEMsQ0FBQztBQUNoRyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMvRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDekUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0scURBQXFELENBQUM7QUFDMUYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzNGLE9BQU8sRUFBMkQsWUFBWSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDbkksT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUVoRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQWlCOUUsSUFBZSxpQkFBaUIsR0FBaEMsTUFBZSxpQkFBa0IsU0FBUSxVQUFVOzthQUVqQyxpQ0FBNEIsR0FBRyxJQUFJLEFBQVAsQ0FBUTtJQU01RCxZQUNDLEVBQVUsRUFDVixLQUFtQixFQUNBLGdCQUFtQyxFQUN2QyxZQUEyQixFQUN6QixjQUErQjtRQUVoRCxLQUFLLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxZQUFZLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFUakQsb0JBQWUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO0lBVTNFLENBQUM7SUFFUyxZQUFZLENBQUMsTUFBbUI7UUFFekMsWUFBWTtRQUNaLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLGlDQUFpQyxFQUFFO1lBQ3JELFFBQVEsRUFBRSxDQUFDLENBQUMsNERBQTREO1NBQ3hFLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFFdEMsb0JBQW9CO1FBQ3BCLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLG9CQUFvQixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsRUFBRSxVQUFVLGtDQUEwQixFQUFFLFFBQVEsa0NBQTBCLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDeEosTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUVRLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBa0IsRUFBRSxPQUFtQyxFQUFFLE9BQTJCLEVBQUUsS0FBd0I7UUFDckksTUFBTSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXJELHlCQUF5QjtRQUN6QixJQUFJLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQ25DLE9BQU87UUFDUixDQUFDO1FBRUQsZUFBZTtRQUNmLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDckUsQ0FBQztJQUVPLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBa0IsRUFBRSxPQUFtQztRQUNoRixNQUFNLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxHQUFHLHVCQUF1QixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRXZGLDhCQUE4QjtRQUM5QixTQUFTLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFckIsMENBQTBDO1FBQzFDLE1BQU0sV0FBVyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFDMUMsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDckYsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLEtBQUssRUFBRSxtQkFBaUIsQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDO1FBRXZGLE9BQU87UUFDUCxNQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDLENBQUM7UUFDckYsTUFBTSxVQUFVLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLGVBQWUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1FBQ3ZFLFVBQVUsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBRXZCLFFBQVE7UUFDUixNQUFNLGNBQWMsR0FBRyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDLENBQUM7UUFDdkYsTUFBTSxXQUFXLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlCLFdBQVcsQ0FBQyxXQUFXLEdBQUcsY0FBYyxDQUFDO1FBQ3pDLGNBQWMsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFeEMsYUFBYTtRQUNiLFNBQVMsQ0FBQyxZQUFZLENBQUMsWUFBWSxFQUFFLEdBQUcsc0JBQXNCLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxLQUFLLGNBQWMsRUFBRSxDQUFDLENBQUM7UUFFOUgsVUFBVTtRQUNWLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3BCLE1BQU0sZ0JBQWdCLEdBQUcsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsdUNBQXVDLENBQUMsQ0FBQyxDQUFDO1lBQzNGLE1BQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO1lBRWpFLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ3pDLE1BQU0sTUFBTSxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQztvQkFDaEQsR0FBRyxtQkFBbUI7b0JBQ3RCLFNBQVMsRUFBRSxDQUFDLEtBQUssQ0FBQztpQkFDbEIsQ0FBQyxDQUFDLENBQUM7Z0JBRUosTUFBTSxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO2dCQUNoQyxXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUU7b0JBQ3JDLElBQUksQ0FBQyxFQUFFLENBQUM7d0JBQ1AsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBQzNCLENBQUM7b0JBRUQsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNsQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQztRQUNGLENBQUM7UUFFRCxtQkFBbUI7UUFDbkIsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRXhCLE9BQU8sV0FBVyxDQUFDO0lBQ3BCLENBQUM7SUFJUSxVQUFVO1FBQ2xCLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3BCLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDM0IsQ0FBQztRQUVELElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFN0IsS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3BCLENBQUM7SUFFRCxNQUFNLENBQUMsU0FBb0I7UUFDMUIsTUFBTSxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsR0FBRyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUV2Rix1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUVuRCxtQkFBbUI7UUFDbkIsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRXhCLDBCQUEwQjtRQUMxQixTQUFTLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRSxTQUFTLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBQ3pFLENBQUM7SUFFUSxLQUFLO1FBQ2IsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBRWQsSUFBSSxDQUFDLFNBQVMsRUFBRSxLQUFLLEVBQUUsQ0FBQztJQUN6QixDQUFDO0lBRVEsT0FBTztRQUNmLElBQUksQ0FBQyxTQUFTLEVBQUUsTUFBTSxFQUFFLENBQUM7UUFFekIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2pCLENBQUM7O0FBbklvQixpQkFBaUI7SUFXcEMsV0FBQSxpQkFBaUIsQ0FBQTtJQUNqQixXQUFBLGFBQWEsQ0FBQTtJQUNiLFdBQUEsZUFBZSxDQUFBO0dBYkksaUJBQWlCLENBb0l0Qzs7QUFFTSxJQUFNLHVDQUF1QyxHQUE3QyxNQUFNLHVDQUF3QyxTQUFRLGlCQUFpQjs7YUFFN0QsT0FBRSxHQUFHLGdEQUFnRCxBQUFuRCxDQUFvRDthQUM5QyxVQUFLLEdBQUcsUUFBUSxDQUFDLHFCQUFxQixFQUFFLDBCQUEwQixDQUFDLEFBQTlELENBQStEO2FBRTVFLGVBQVUsR0FBRyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxBQUF6RCxDQUEwRDtJQUVwRixZQUNDLEtBQW1CLEVBQ0EsZ0JBQW1DLEVBQ3ZDLFlBQTJCLEVBQ1IsY0FBK0IsRUFDdEIsZ0JBQTBDLEVBQ3BFLGNBQStCO1FBRWhELEtBQUssQ0FBQyx5Q0FBdUMsQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLGdCQUFnQixFQUFFLFlBQVksRUFBRSxjQUFjLENBQUMsQ0FBQztRQUp2RSxtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7UUFDdEIscUJBQWdCLEdBQWhCLGdCQUFnQixDQUEwQjtJQUl0RixDQUFDO0lBRVEsUUFBUTtRQUNoQixPQUFPLHlDQUF1QyxDQUFDLEtBQUssQ0FBQztJQUN0RCxDQUFDO0lBRVMsS0FBSyxDQUFDLFdBQVc7UUFDMUIsT0FBTztZQUNOLElBQUksRUFBRSx3QkFBd0I7WUFDOUIsS0FBSyxFQUFFLGlDQUFpQyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdEcsUUFBUSxDQUFDLHlCQUF5QixFQUFFLDJGQUEyRixDQUFDLENBQUMsQ0FBQztnQkFDbEksUUFBUSxDQUFDLDRCQUE0QixFQUFFLDhGQUE4RixDQUFDO1lBQ3ZJLE9BQU8sRUFBRTtnQkFDUjtvQkFDQyxLQUFLLEVBQUUsUUFBUSxDQUFDLGFBQWEsRUFBRSx3QkFBd0IsQ0FBQztvQkFDeEQsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLHdCQUF3QixDQUFDO2lCQUN2RTthQUNEO1NBQ0QsQ0FBQztJQUNILENBQUM7O0FBbkNXLHVDQUF1QztJQVNqRCxXQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFdBQUEsYUFBYSxDQUFBO0lBQ2IsV0FBQSxlQUFlLENBQUE7SUFDZixXQUFBLHdCQUF3QixDQUFBO0lBQ3hCLFdBQUEsZUFBZSxDQUFBO0dBYkwsdUNBQXVDLENBb0NuRDs7QUFFTSxJQUFNLHNCQUFzQixHQUE1QixNQUFNLHNCQUF1QixTQUFRLGlCQUFpQjs7YUFFcEMsT0FBRSxHQUFHLCtCQUErQixBQUFsQyxDQUFtQzthQUNyQyxVQUFLLEdBQUcsUUFBUSxDQUFDLGFBQWEsRUFBRSxjQUFjLENBQUMsQUFBMUMsQ0FBMkM7YUFFeEQsZUFBVSxHQUFHLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEFBQXpELENBQTBEO0lBRXBGLFlBQ0MsS0FBbUIsRUFDQSxnQkFBbUMsRUFDdkMsWUFBMkIsRUFDekIsY0FBK0IsRUFDakIsV0FBeUIsRUFDdkIsYUFBNkIsRUFDNUIsY0FBK0I7UUFFakUsS0FBSyxDQUFDLHdCQUFzQixDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsWUFBWSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBSnpELGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBQ3ZCLGtCQUFhLEdBQWIsYUFBYSxDQUFnQjtRQUM1QixtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7SUFHbEUsQ0FBQztJQUVTLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBa0IsRUFBRSxPQUF1QyxFQUFFLFdBQTRCO1FBQ3BILE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUM7UUFDaEMsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQztRQUM1QixNQUFNLGNBQWMsR0FBb0MsS0FBTSxFQUFFLG1CQUFtQiwrQ0FBdUMsQ0FBQztRQUUzSCxjQUFjO1FBQ2QsSUFBSSxLQUFhLENBQUM7UUFDbEIsSUFBSSxjQUFjLEVBQUUsQ0FBQztZQUNwQixLQUFLLEdBQUcsUUFBUSxDQUFDLG9DQUFvQyxFQUFFLGdFQUFnRSxDQUFDLENBQUM7UUFDMUgsQ0FBQzthQUFNLElBQUksaUJBQWlCLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQzNELEtBQUssR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDO1FBQ3ZCLENBQUM7YUFBTSxJQUFJLEtBQUssRUFBRSxDQUFDO1lBQ2xCLEtBQUssR0FBRyxRQUFRLENBQUMsaUNBQWlDLEVBQUUscUdBQXFHLENBQUMsQ0FBQztRQUM1SixDQUFDO2FBQU0sQ0FBQztZQUNQLEtBQUssR0FBRyxRQUFRLENBQUMsb0NBQW9DLEVBQUUsNERBQTRELENBQUMsQ0FBQztRQUN0SCxDQUFDO1FBRUQsYUFBYTtRQUNiLElBQUksSUFBSSxHQUFHLFVBQVUsQ0FBQztRQUN0QixJQUFJLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDOUIsSUFBSSxLQUFLLENBQUMsYUFBYSxLQUFLLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDM0MsSUFBSSxHQUFHLFNBQVMsQ0FBQztZQUNsQixDQUFDO2lCQUFNLElBQUksS0FBSyxDQUFDLGFBQWEsS0FBSyxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3JELElBQUksR0FBRyxZQUFZLENBQUM7WUFDckIsQ0FBQztRQUNGLENBQUM7UUFFRCxVQUFVO1FBQ1YsSUFBSSxPQUFPLEdBQW1ELFNBQVMsQ0FBQztRQUN4RSxJQUFJLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQzFELE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDcEMsT0FBTztvQkFDTixLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUs7b0JBQ25CLEdBQUcsRUFBRSxHQUFHLEVBQUU7d0JBQ1QsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDO3dCQUM1QixJQUFJLE1BQU0sWUFBWSxPQUFPLEVBQUUsQ0FBQzs0QkFDL0IsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ3hFLENBQUM7b0JBQ0YsQ0FBQztpQkFDRCxDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO2FBQU0sQ0FBQztZQUNQLE9BQU8sR0FBRztnQkFDVDtvQkFDQyxLQUFLLEVBQUUsUUFBUSxDQUFDLE9BQU8sRUFBRSxXQUFXLENBQUM7b0JBQ3JDLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxHQUFHLE9BQU8sRUFBRSxNQUFNLEVBQUUsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUM7aUJBQ2xIO2dCQUNEO29CQUNDLEtBQUssRUFBRSxRQUFRLENBQUMsVUFBVSxFQUFFLFdBQVcsQ0FBQztvQkFDeEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLHFCQUFxQixDQUFDO2lCQUNwRTthQUNELENBQUM7UUFDSCxDQUFDO1FBRUQsaUNBQWlDO1FBQ2pDLElBQUksY0FBYyxJQUFJLFFBQVEsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQzFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDckQsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsK0RBQStDLEVBQUUsQ0FBQztvQkFDeEUsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUN2QyxDQUFDO1lBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxPQUFPLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsT0FBTyxJQUFJLEVBQUUsRUFBRSxDQUFDO0lBQ2hELENBQUM7O0FBbkZXLHNCQUFzQjtJQVNoQyxXQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFdBQUEsYUFBYSxDQUFBO0lBQ2IsV0FBQSxlQUFlLENBQUE7SUFDZixXQUFBLFlBQVksQ0FBQTtJQUNaLFdBQUEsY0FBYyxDQUFBO0lBQ2QsV0FBQSxlQUFlLENBQUE7R0FkTCxzQkFBc0IsQ0FvRmxDIn0=