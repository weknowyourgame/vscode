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
var TextFileEditor_1;
import { localize } from '../../../../../nls.js';
import { mark } from '../../../../../base/common/performance.js';
import { assertReturnsDefined } from '../../../../../base/common/types.js';
import { IPathService } from '../../../../services/path/common/pathService.js';
import { toAction } from '../../../../../base/common/actions.js';
import { VIEWLET_ID, TEXT_FILE_EDITOR_ID, BINARY_TEXT_FILE_MODE } from '../../common/files.js';
import { ITextFileService } from '../../../../services/textfile/common/textfiles.js';
import { AbstractTextCodeEditor } from '../../../../browser/parts/editor/textCodeEditor.js';
import { isTextEditorViewState, DEFAULT_EDITOR_ASSOCIATION, createEditorOpenError, createTooLargeFileError } from '../../../../common/editor.js';
import { applyTextEditorOptions } from '../../../../common/editor/editorOptions.js';
import { BinaryEditorModel } from '../../../../common/editor/binaryEditorModel.js';
import { FileEditorInput } from './fileEditorInput.js';
import { FileOperationError, IFileService, ByteSize, TooLargeFileOperationError } from '../../../../../platform/files/common/files.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { ITextResourceConfigurationService } from '../../../../../editor/common/services/textResourceConfiguration.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { EditorActivation } from '../../../../../platform/editor/common/editor.js';
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { IExplorerService } from '../files.js';
import { IPaneCompositePartService } from '../../../../services/panecomposite/browser/panecomposite.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IPreferencesService } from '../../../../services/preferences/common/preferences.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { IFilesConfigurationService } from '../../../../services/filesConfiguration/common/filesConfigurationService.js';
/**
 * An implementation of editor for file system resources.
 */
let TextFileEditor = class TextFileEditor extends AbstractTextCodeEditor {
    static { TextFileEditor_1 = this; }
    static { this.ID = TEXT_FILE_EDITOR_ID; }
    constructor(group, telemetryService, fileService, paneCompositeService, instantiationService, contextService, storageService, textResourceConfigurationService, editorService, themeService, editorGroupService, textFileService, explorerService, uriIdentityService, pathService, configurationService, preferencesService, hostService, filesConfigurationService) {
        super(TextFileEditor_1.ID, group, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorService, editorGroupService, fileService);
        this.paneCompositeService = paneCompositeService;
        this.contextService = contextService;
        this.textFileService = textFileService;
        this.explorerService = explorerService;
        this.uriIdentityService = uriIdentityService;
        this.pathService = pathService;
        this.configurationService = configurationService;
        this.preferencesService = preferencesService;
        this.hostService = hostService;
        this.filesConfigurationService = filesConfigurationService;
        // Clear view state for deleted files
        this._register(this.fileService.onDidFilesChange(e => this.onDidFilesChange(e)));
        // Move view state for moved files
        this._register(this.fileService.onDidRunOperation(e => this.onDidRunOperation(e)));
    }
    onDidFilesChange(e) {
        for (const resource of e.rawDeleted) {
            this.clearEditorViewState(resource);
        }
    }
    onDidRunOperation(e) {
        if (e.operation === 2 /* FileOperation.MOVE */ && e.target) {
            this.moveEditorViewState(e.resource, e.target.resource, this.uriIdentityService.extUri);
        }
    }
    getTitle() {
        if (this.input) {
            return this.input.getName();
        }
        return localize('textFileEditor', "Text File Editor");
    }
    get input() {
        return this._input;
    }
    async setInput(input, options, context, token) {
        mark('code/willSetInputToTextFileEditor');
        // Set input and resolve
        await super.setInput(input, options, context, token);
        try {
            const resolvedModel = await input.resolve(options);
            // Check for cancellation
            if (token.isCancellationRequested) {
                return;
            }
            // There is a special case where the text editor has to handle binary
            // file editor input: if a binary file has been resolved and cached
            // before, it maybe an actual instance of BinaryEditorModel. In this
            // case our text editor has to open this model using the binary editor.
            // We return early in this case.
            if (resolvedModel instanceof BinaryEditorModel) {
                return this.openAsBinary(input, options);
            }
            const textFileModel = resolvedModel;
            // Editor
            const control = assertReturnsDefined(this.editorControl);
            control.setModel(textFileModel.textEditorModel);
            // Restore view state (unless provided by options)
            if (!isTextEditorViewState(options?.viewState)) {
                const editorViewState = this.loadEditorViewState(input, context);
                if (editorViewState) {
                    if (options?.selection) {
                        editorViewState.cursorState = []; // prevent duplicate selections via options
                    }
                    control.restoreViewState(editorViewState);
                }
            }
            // Apply options to editor if any
            if (options) {
                applyTextEditorOptions(options, control, 1 /* ScrollType.Immediate */);
            }
            // Since the resolved model provides information about being readonly
            // or not, we apply it here to the editor even though the editor input
            // was already asked for being readonly or not. The rationale is that
            // a resolved model might have more specific information about being
            // readonly or not that the input did not have.
            control.updateOptions(this.getReadonlyConfiguration(textFileModel.isReadonly()));
            if (control.handleInitialized) {
                control.handleInitialized();
            }
        }
        catch (error) {
            await this.handleSetInputError(error, input, options);
        }
        mark('code/didSetInputToTextFileEditor');
    }
    async handleSetInputError(error, input, options) {
        // Handle case where content appears to be binary
        if (error.textFileOperationResult === 0 /* TextFileOperationResult.FILE_IS_BINARY */) {
            return this.openAsBinary(input, options);
        }
        // Handle case where we were asked to open a folder
        if (error.fileOperationResult === 0 /* FileOperationResult.FILE_IS_DIRECTORY */) {
            const actions = [];
            actions.push(toAction({
                id: 'workbench.files.action.openFolder', label: localize('openFolder', "Open Folder"), run: async () => {
                    return this.hostService.openWindow([{ folderUri: input.resource }], { forceNewWindow: true });
                }
            }));
            if (this.contextService.isInsideWorkspace(input.preferredResource)) {
                actions.push(toAction({
                    id: 'workbench.files.action.reveal', label: localize('reveal', "Reveal Folder"), run: async () => {
                        await this.paneCompositeService.openPaneComposite(VIEWLET_ID, 0 /* ViewContainerLocation.Sidebar */, true);
                        return this.explorerService.select(input.preferredResource, true);
                    }
                }));
            }
            throw createEditorOpenError(localize('fileIsDirectory', "The file is not displayed in the text editor because it is a directory."), actions, { forceMessage: true });
        }
        // Handle case where a file is too large to open without confirmation
        if (error.fileOperationResult === 7 /* FileOperationResult.FILE_TOO_LARGE */) {
            let message;
            if (error instanceof TooLargeFileOperationError) {
                message = localize('fileTooLargeForHeapErrorWithSize', "The file is not displayed in the text editor because it is very large ({0}).", ByteSize.formatSize(error.size));
            }
            else {
                message = localize('fileTooLargeForHeapErrorWithoutSize', "The file is not displayed in the text editor because it is very large.");
            }
            throw createTooLargeFileError(this.group, input, options, message, this.preferencesService);
        }
        // Offer to create a file from the error if we have a file not found and the name is valid and not readonly
        if (error.fileOperationResult === 1 /* FileOperationResult.FILE_NOT_FOUND */ &&
            !this.filesConfigurationService.isReadonly(input.preferredResource) &&
            await this.pathService.hasValidBasename(input.preferredResource)) {
            const fileNotFoundError = createEditorOpenError(new FileOperationError(localize('unavailableResourceErrorEditorText', "The editor could not be opened because the file was not found."), 1 /* FileOperationResult.FILE_NOT_FOUND */), [
                toAction({
                    id: 'workbench.files.action.createMissingFile', label: localize('createFile', "Create File"), run: async () => {
                        await this.textFileService.create([{ resource: input.preferredResource }]);
                        return this.editorService.openEditor({
                            resource: input.preferredResource,
                            options: {
                                pinned: true // new file gets pinned by default
                            }
                        });
                    }
                })
            ], {
                // Support the flow of directly pressing `Enter` on the dialog to
                // create the file on the go. This is nice when for example following
                // a link to a file that does not exist to scaffold it quickly.
                allowDialog: true
            });
            throw fileNotFoundError;
        }
        // Otherwise make sure the error bubbles up
        throw error;
    }
    openAsBinary(input, options) {
        const defaultBinaryEditor = this.configurationService.getValue('workbench.editor.defaultBinaryEditor');
        const editorOptions = {
            ...options,
            // Make sure to not steal away the currently active group
            // because we are triggering another openEditor() call
            // and do not control the initial intent that resulted
            // in us now opening as binary.
            activation: EditorActivation.PRESERVE
        };
        // Check configuration and determine whether we open the binary
        // file input in a different editor or going through the same
        // editor.
        // Going through the same editor is debt, and a better solution
        // would be to introduce a real editor for the binary case
        // and avoid enforcing binary or text on the file editor input.
        if (defaultBinaryEditor && defaultBinaryEditor !== '' && defaultBinaryEditor !== DEFAULT_EDITOR_ASSOCIATION.id) {
            this.doOpenAsBinaryInDifferentEditor(this.group, defaultBinaryEditor, input, editorOptions);
        }
        else {
            this.doOpenAsBinaryInSameEditor(this.group, defaultBinaryEditor, input, editorOptions);
        }
    }
    doOpenAsBinaryInDifferentEditor(group, editorId, editor, editorOptions) {
        this.editorService.replaceEditors([{
                editor,
                replacement: { resource: editor.resource, options: { ...editorOptions, override: editorId } }
            }], group);
    }
    doOpenAsBinaryInSameEditor(group, editorId, editor, editorOptions) {
        // Open binary as text
        if (editorId === DEFAULT_EDITOR_ASSOCIATION.id) {
            editor.setForceOpenAsText();
            editor.setPreferredLanguageId(BINARY_TEXT_FILE_MODE); // https://github.com/microsoft/vscode/issues/131076
            editorOptions = { ...editorOptions, forceReload: true }; // Same pane and same input, must force reload to clear cached state
        }
        // Open as binary
        else {
            editor.setForceOpenAsBinary();
        }
        group.openEditor(editor, editorOptions);
    }
    clearInput() {
        super.clearInput();
        // Clear Model
        this.editorControl?.setModel(null);
    }
    createEditorControl(parent, initialOptions) {
        mark('code/willCreateTextFileEditorControl');
        super.createEditorControl(parent, initialOptions);
        mark('code/didCreateTextFileEditorControl');
    }
    tracksEditorViewState(input) {
        return input instanceof FileEditorInput;
    }
    tracksDisposedEditorViewState() {
        return true; // track view state even for disposed editors
    }
};
TextFileEditor = TextFileEditor_1 = __decorate([
    __param(1, ITelemetryService),
    __param(2, IFileService),
    __param(3, IPaneCompositePartService),
    __param(4, IInstantiationService),
    __param(5, IWorkspaceContextService),
    __param(6, IStorageService),
    __param(7, ITextResourceConfigurationService),
    __param(8, IEditorService),
    __param(9, IThemeService),
    __param(10, IEditorGroupsService),
    __param(11, ITextFileService),
    __param(12, IExplorerService),
    __param(13, IUriIdentityService),
    __param(14, IPathService),
    __param(15, IConfigurationService),
    __param(16, IPreferencesService),
    __param(17, IHostService),
    __param(18, IFilesConfigurationService)
], TextFileEditor);
export { TextFileEditor };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dEZpbGVFZGl0b3IuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZmlsZXMvYnJvd3Nlci9lZGl0b3JzL3RleHRGaWxlRWRpdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUMvRSxPQUFPLEVBQVcsUUFBUSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxtQkFBbUIsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQy9GLE9BQU8sRUFBRSxnQkFBZ0IsRUFBbUQsTUFBTSxtREFBbUQsQ0FBQztBQUN0SSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUM1RixPQUFPLEVBQXNCLHFCQUFxQixFQUFFLDBCQUEwQixFQUFFLHFCQUFxQixFQUEyQix1QkFBdUIsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRTlMLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsa0JBQWtCLEVBQXlDLFlBQVksRUFBcUMsUUFBUSxFQUFFLDBCQUEwQixFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDak4sT0FBTyxFQUFFLGlCQUFp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