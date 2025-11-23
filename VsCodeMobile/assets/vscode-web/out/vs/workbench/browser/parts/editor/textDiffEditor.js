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
var TextDiffEditor_1;
import { localize } from '../../../../nls.js';
import { deepClone } from '../../../../base/common/objects.js';
import { isObject, assertReturnsDefined } from '../../../../base/common/types.js';
import { AbstractTextEditor } from './textEditor.js';
import { TEXT_DIFF_EDITOR_ID, EditorExtensions, isEditorInput, isTextEditorViewState, createTooLargeFileError } from '../../../common/editor.js';
import { applyTextEditorOptions } from '../../../common/editor/editorOptions.js';
import { DiffEditorInput } from '../../../common/editor/diffEditorInput.js';
import { TextDiffEditorModel } from '../../../common/editor/textDiffEditorModel.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITextResourceConfigurationService } from '../../../../editor/common/services/textResourceConfiguration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { URI } from '../../../../base/common/uri.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { EditorActivation } from '../../../../platform/editor/common/editor.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { isEqual } from '../../../../base/common/resources.js';
import { multibyteAwareBtoa } from '../../../../base/common/strings.js';
import { ByteSize, IFileService, TooLargeFileOperationError } from '../../../../platform/files/common/files.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';
import { DiffEditorWidget } from '../../../../editor/browser/widget/diffEditor/diffEditorWidget.js';
/**
 * The text editor that leverages the diff text editor for the editing experience.
 */
let TextDiffEditor = class TextDiffEditor extends AbstractTextEditor {
    static { TextDiffEditor_1 = this; }
    static { this.ID = TEXT_DIFF_EDITOR_ID; }
    get scopedContextKeyService() {
        if (!this.diffEditorControl) {
            return undefined;
        }
        const originalEditor = this.diffEditorControl.getOriginalEditor();
        const modifiedEditor = this.diffEditorControl.getModifiedEditor();
        return (originalEditor.hasTextFocus() ? originalEditor : modifiedEditor).invokeWithinContext(accessor => accessor.get(IContextKeyService));
    }
    constructor(group, telemetryService, instantiationService, storageService, configurationService, editorService, themeService, editorGroupService, fileService, preferencesService) {
        super(TextDiffEditor_1.ID, group, telemetryService, instantiationService, storageService, configurationService, themeService, editorService, editorGroupService, fileService);
        this.preferencesService = preferencesService;
        this.diffEditorControl = undefined;
        this.inputLifecycleStopWatch = undefined;
        this._previousViewModel = null;
    }
    getTitle() {
        if (this.input) {
            return this.input.getName();
        }
        return localize('textDiffEditor', "Text Diff Editor");
    }
    createEditorControl(parent, configuration) {
        this.diffEditorControl = this._register(this.instantiationService.createInstance(DiffEditorWidget, parent, configuration, {}));
    }
    updateEditorControlOptions(options) {
        this.diffEditorControl?.updateOptions(options);
    }
    getMainControl() {
        return this.diffEditorControl?.getModifiedEditor();
    }
    async setInput(input, options, context, token) {
        if (this._previousViewModel) {
            this._previousViewModel.dispose();
            this._previousViewModel = null;
        }
        // Cleanup previous things associated with the input
        this.inputLifecycleStopWatch = undefined;
        // Set input and resolve
        await super.setInput(input, options, context, token);
        try {
            const resolvedModel = await input.resolve();
            // Check for cancellation
            if (token.isCancellationRequested) {
                return undefined;
            }
            // Fallback to open as binary if not text
            if (!(resolvedModel instanceof TextDiffEditorModel)) {
                this.openAsBinary(input, options);
                return undefined;
            }
            // Set Editor Model
            const control = assertReturnsDefined(this.diffEditorControl);
            const resolvedDiffEditorModel = resolvedModel;
            const vm = resolvedDiffEditorModel.textDiffEditorModel ? control.createViewModel(resolvedDiffEditorModel.textDiffEditorModel) : null;
            this._previousViewModel = vm;
            await vm?.waitForDiff();
            control.setModel(vm);
            // Restore view state (unless provided by options)
            let hasPreviousViewState = false;
            if (!isTextEditorViewState(options?.viewState)) {
                hasPreviousViewState = this.restoreTextDiffEditorViewState(input, options, context, control);
            }
            // Apply options to editor if any
            let optionsGotApplied = false;
            if (options) {
                optionsGotApplied = applyTextEditorOptions(options, control, 1 /* ScrollType.Immediate */);
            }
            if (!optionsGotApplied && !hasPreviousViewState) {
                control.revealFirstDiff();
            }
            // Since the resolved model provides information about being readonly
            // or not, we apply it here to the editor even though the editor input
            // was already asked for being readonly or not. The rationale is that
            // a resolved model might have more specific information about being
            // readonly or not that the input did not have.
            control.updateOptions({
                ...this.getReadonlyConfiguration(resolvedDiffEditorModel.modifiedModel?.isReadonly()),
                originalEditable: !resolvedDiffEditorModel.originalModel?.isReadonly()
            });
            control.handleInitialized();
            // Start to measure input lifecycle
            this.inputLifecycleStopWatch = new StopWatch(false);
        }
        catch (error) {
            await this.handleSetInputError(error, input, options);
        }
    }
    async handleSetInputError(error, input, options) {
        // Handle case where content appears to be binary
        if (this.isFileBinaryError(error)) {
            return this.openAsBinary(input, options);
        }
        // Handle case where a file is too large to open without confirmation
        if (error.fileOperationResult === 7 /* FileOperationResult.FILE_TOO_LARGE */) {
            let message;
            if (error instanceof TooLargeFileOperationError) {
                message = localize('fileTooLargeForHeapErrorWithSize', "At least one file is not displayed in the text compare editor because it is very large ({0}).", ByteSize.formatSize(error.size));
            }
            else {
                message = localize('fileTooLargeForHeapErrorWithoutSize', "At least one file is not displayed in the text compare editor because it is very large.");
            }
            throw createTooLargeFileError(this.group, input, options, message, this.preferencesService);
        }
        // Otherwise make sure the error bubbles up
        throw error;
    }
    restoreTextDiffEditorViewState(editor, options, context, control) {
        const editorViewState = this.loadEditorViewState(editor, context);
        if (editorViewState) {
            if (options?.selection && editorViewState.modified) {
                editorViewState.modified.cursorState = []; // prevent duplicate selections via options
            }
            control.restoreViewState(editorViewState);
            if (options?.revealIfVisible) {
                control.revealFirstDiff();
            }
            return true;
        }
        return false;
    }
    openAsBinary(input, options) {
        const original = input.original;
        const modified = input.modified;
        const binaryDiffInput = this.instantiationService.createInstance(DiffEditorInput, input.getName(), input.getDescription(), original, modified, true);
        // Forward binary flag to input if supported
        const fileEditorFactory = Registry.as(EditorExtensions.EditorFactory).getFileEditorFactory();
        if (fileEditorFactory.isFileEditor(original)) {
            original.setForceOpenAsBinary();
        }
        if (fileEditorFactory.isFileEditor(modified)) {
            modified.setForceOpenAsBinary();
        }
        // Replace this editor with the binary one
        this.group.replaceEditors([{
                editor: input,
                replacement: binaryDiffInput,
                options: {
                    ...options,
                    // Make sure to not steal away the currently active group
                    // because we are triggering another openEditor() call
                    // and do not control the initial intent that resulted
                    // in us now opening as binary.
                    activation: EditorActivation.PRESERVE,
                    pinned: this.group.isPinned(input),
                    sticky: this.group.isSticky(input)
                }
            }]);
    }
    setOptions(options) {
        super.setOptions(options);
        if (options) {
            applyTextEditorOptions(options, assertReturnsDefined(this.diffEditorControl), 0 /* ScrollType.Smooth */);
        }
    }
    shouldHandleConfigurationChangeEvent(e, resource) {
        if (super.shouldHandleConfigurationChangeEvent(e, resource)) {
            return true;
        }
        return e.affectsConfiguration(resource, 'diffEditor') || e.affectsConfiguration(resource, 'accessibility.verbosity.diffEditor');
    }
    computeConfiguration(configuration) {
        const editorConfiguration = super.computeConfiguration(configuration);
        // Handle diff editor specially by merging in diffEditor configuration
        if (isObject(configuration.diffEditor)) {
            const diffEditorConfiguration = deepClone(configuration.diffEditor);
            // User settings defines `diffEditor.codeLens`, but here we rename that to `diffEditor.diffCodeLens` to avoid collisions with `editor.codeLens`.
            diffEditorConfiguration.diffCodeLens = diffEditorConfiguration.codeLens;
            delete diffEditorConfiguration.codeLens;
            // User settings defines `diffEditor.wordWrap`, but here we rename that to `diffEditor.diffWordWrap` to avoid collisions with `editor.wordWrap`.
            diffEditorConfiguration.diffWordWrap = diffEditorConfiguration.wordWrap;
            delete diffEditorConfiguration.wordWrap;
            Object.assign(editorConfiguration, diffEditorConfiguration);
        }
        const verbose = configuration.accessibility?.verbosity?.diffEditor ?? false;
        editorConfiguration.accessibilityVerbose = verbose;
        return editorConfiguration;
    }
    getConfigurationOverrides(configuration) {
        return {
            ...super.getConfigurationOverrides(configuration),
            ...this.getReadonlyConfiguration(this.input?.isReadonly()),
            originalEditable: this.input instanceof DiffEditorInput && !this.input.original.isReadonly(),
            lineDecorationsWidth: '2ch'
        };
    }
    updateReadonly(input) {
        if (input instanceof DiffEditorInput) {
            this.diffEditorControl?.updateOptions({
                ...this.getReadonlyConfiguration(input.isReadonly()),
                originalEditable: !input.original.isReadonly(),
            });
        }
        else {
            super.updateReadonly(input);
        }
    }
    isFileBinaryError(error) {
        if (Array.isArray(error)) {
            const errors = error;
            return errors.some(error => this.isFileBinaryError(error));
        }
        return error.textFileOperationResult === 0 /* TextFileOperationResult.FILE_IS_BINARY */;
    }
    clearInput() {
        if (this._previousViewModel) {
            this._previousViewModel.dispose();
            this._previousViewModel = null;
        }
        super.clearInput();
        // Log input lifecycle telemetry
        const inputLifecycleElapsed = this.inputLifecycleStopWatch?.elapsed();
        this.inputLifecycleStopWatch = undefined;
        if (typeof inputLifecycleElapsed === 'number') {
            this.logInputLifecycleTelemetry(inputLifecycleElapsed, this.getControl()?.getModel()?.modified?.getLanguageId());
        }
        // Clear Model
        this.diffEditorControl?.setModel(null);
    }
    logInputLifecycleTelemetry(duration, languageId) {
        let collapseUnchangedRegions = false;
        if (this.diffEditorControl instanceof DiffEditorWidget) {
            collapseUnchangedRegions = this.diffEditorControl.collapseUnchangedRegions;
        }
        this.telemetryService.publicLog2('diffEditor.editorVisibleTime', {
            editorVisibleTimeMs: duration,
            languageId: languageId ?? '',
            collapseUnchangedRegions,
        });
    }
    getControl() {
        return this.diffEditorControl;
    }
    focus() {
        super.focus();
        this.diffEditorControl?.focus();
    }
    hasFocus() {
        return this.diffEditorControl?.hasTextFocus() || super.hasFocus();
    }
    setEditorVisible(visible) {
        super.setEditorVisible(visible);
        if (visible) {
            this.diffEditorControl?.onVisible();
        }
        else {
            this.diffEditorControl?.onHide();
        }
    }
    layout(dimension) {
        this.diffEditorControl?.layout(dimension);
    }
    setBoundarySashes(sashes) {
        this.diffEditorControl?.setBoundarySashes(sashes);
    }
    tracksEditorViewState(input) {
        return input instanceof DiffEditorInput;
    }
    computeEditorViewState(resource) {
        if (!this.diffEditorControl) {
            return undefined;
        }
        const model = this.diffEditorControl.getModel();
        if (!model?.modified || !model.original) {
            return undefined; // view state always needs a model
        }
        const modelUri = this.toEditorViewStateResource(model);
        if (!modelUri) {
            return undefined; // model URI is needed to make sure we save the view state correctly
        }
        if (!isEqual(modelUri, resource)) {
            return undefined; // prevent saving view state for a model that is not the expected one
        }
        return this.diffEditorControl.saveViewState() ?? undefined;
    }
    toEditorViewStateResource(modelOrInput) {
        let original;
        let modified;
        if (modelOrInput instanceof DiffEditorInput) {
            original = modelOrInput.original.resource;
            modified = modelOrInput.modified.resource;
        }
        else if (!isEditorInput(modelOrInput)) {
            original = modelOrInput.original.uri;
            modified = modelOrInput.modified.uri;
        }
        if (!original || !modified) {
            return undefined;
        }
        // create a URI that is the Base64 concatenation of original + modified resource
        return URI.from({ scheme: 'diff', path: `${multibyteAwareBtoa(original.toString())}${multibyteAwareBtoa(modified.toString())}` });
    }
};
TextDiffEditor = TextDiffEditor_1 = __decorate([
    __param(1, ITelemetryService),
    __param(2, IInstantiationService),
    __param(3, IStorageService),
    __param(4, ITextResourceConfigurationService),
    __param(5, IEditorService),
    __param(6, IThemeService),
    __param(7, IEditorGroupsService),
    __param(8, IFileService),
    __param(9, IPreferencesService)
], TextDiffEditor);
export { TextDiffEditor };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dERpZmZFZGl0b3IuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2Jyb3dzZXIvcGFydHMvZWRpdG9yL3RleHREaWZmRWRpdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxRQUFRLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUdsRixPQUFPLEVBQUUsa0JBQWtCLEVBQXdCLE1BQU0saUJBQWlCLENBQUM7QUFDM0UsT0FBTyxFQUFFLG1CQUFtQixFQUEwQixnQkFBZ0IsRUFBMkMsYUFBYSxFQUFFLHFCQUFxQixFQUFFLHVCQUF1QixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFFbE4sT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDakYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNqRixPQUFPLEVBQXlDLGlDQUFpQyxFQUFFLE1BQU0saUVBQWlFLENBQUM7QUFDM0osT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBR2xGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUsR0FBRyxF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