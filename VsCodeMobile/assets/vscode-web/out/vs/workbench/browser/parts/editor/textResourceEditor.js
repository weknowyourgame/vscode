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
var TextResourceEditor_1;
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { isTextEditorViewState } from '../../../common/editor.js';
import { applyTextEditorOptions } from '../../../common/editor/editorOptions.js';
import { TextResourceEditorInput } from '../../../common/editor/textResourceEditorInput.js';
import { BaseTextEditorModel } from '../../../common/editor/textEditorModel.js';
import { UntitledTextEditorInput } from '../../../services/untitled/common/untitledTextEditorInput.js';
import { AbstractTextCodeEditor } from './textCodeEditor.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITextResourceConfigurationService } from '../../../../editor/common/services/textResourceConfiguration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { PLAINTEXT_LANGUAGE_ID } from '../../../../editor/common/languages/modesRegistry.js';
import { IFileService } from '../../../../platform/files/common/files.js';
/**
 * An editor implementation that is capable of showing the contents of resource inputs. Uses
 * the TextEditor widget to show the contents.
 */
let AbstractTextResourceEditor = class AbstractTextResourceEditor extends AbstractTextCodeEditor {
    constructor(id, group, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorGroupService, editorService, fileService) {
        super(id, group, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorService, editorGroupService, fileService);
    }
    async setInput(input, options, context, token) {
        // Set input and resolve
        await super.setInput(input, options, context, token);
        const resolvedModel = await input.resolve();
        // Check for cancellation
        if (token.isCancellationRequested) {
            return undefined;
        }
        // Assert Model instance
        if (!(resolvedModel instanceof BaseTextEditorModel)) {
            throw new Error('Unable to open file as text');
        }
        // Set Editor Model
        const control = assertReturnsDefined(this.editorControl);
        const textEditorModel = resolvedModel.textEditorModel;
        control.setModel(textEditorModel);
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
        control.updateOptions(this.getReadonlyConfiguration(resolvedModel.isReadonly()));
    }
    /**
     * Reveals the last line of this editor if it has a model set.
     */
    revealLastLine() {
        const control = this.editorControl;
        if (!control) {
            return;
        }
        const model = control.getModel();
        if (model) {
            const lastLine = model.getLineCount();
            control.revealPosition({ lineNumber: lastLine, column: model.getLineMaxColumn(lastLine) }, 0 /* ScrollType.Smooth */);
        }
    }
    clearInput() {
        super.clearInput();
        // Clear Model
        this.editorControl?.setModel(null);
    }
    tracksEditorViewState(input) {
        // editor view state persistence is only enabled for untitled and resource inputs
        return input instanceof UntitledTextEditorInput || input instanceof TextResourceEditorInput;
    }
};
AbstractTextResourceEditor = __decorate([
    __param(2, ITelemetryService),
    __param(3, IInstantiationService),
    __param(4, IStorageService),
    __param(5, ITextResourceConfigurationService),
    __param(6, IThemeService),
    __param(7, IEditorGroupsService),
    __param(8, IEditorService),
    __param(9, IFileService)
], AbstractTextResourceEditor);
export { AbstractTextResourceEditor };
let TextResourceEditor = class TextResourceEditor extends AbstractTextResourceEditor {
    static { TextResourceEditor_1 = this; }
    static { this.ID = 'workbench.editors.textResourceEditor'; }
    constructor(group, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorService, editorGroupService, modelService, languageService, fileService) {
        super(TextResourceEditor_1.ID, group, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorGroupService, editorService, fileService);
        this.modelService = modelService;
        this.languageService = languageService;
    }
    createEditorControl(parent, configuration) {
        super.createEditorControl(parent, configuration);
        // Install a listener for paste to update this editors
        // language if the paste includes a specific language
        const control = this.editorControl;
        if (control) {
            this._register(control.onDidPaste(e => this.onDidEditorPaste(e, control)));
        }
    }
    onDidEditorPaste(e, codeEditor) {
        if (this.input instanceof UntitledTextEditorInput && this.input.hasLanguageSetExplicitly) {
            return; // do not override language if it was set explicitly
        }
        if (e.range.startLineNumber !== 1 || e.range.startColumn !== 1) {
            return; // document had existing content before the pasted text, don't override.
        }
        if (codeEditor.getOption(104 /* EditorOption.readOnly */)) {
            return; // not for readonly editors
        }
        const textModel = codeEditor.getModel();
        if (!textModel) {
            return; // require a live model
        }
        const pasteIsWholeContents = textModel.getLineCount() === e.range.endLineNumber && textModel.getLineMaxColumn(e.range.endLineNumber) === e.range.endColumn;
        if (!pasteIsWholeContents) {
            return; // document had existing content after the pasted text, don't override.
        }
        const currentLanguageId = textModel.getLanguageId();
        if (currentLanguageId !== PLAINTEXT_LANGUAGE_ID) {
            return; // require current languageId to be unspecific
        }
        let candidateLanguage = undefined;
        // A languageId is provided via the paste event so text was copied using
        // VSCode. As such we trust this languageId and use it if specific
        if (e.languageId) {
            candidateLanguage = { id: e.languageId, source: 'event' };
        }
        // A languageId was not provided, so the data comes from outside VSCode
        // We can still try to guess a good languageId from the first line if
        // the paste changed the first line
        else {
            const guess = this.languageService.guessLanguageIdByFilepathOrFirstLine(textModel.uri, textModel.getLineContent(1).substr(0, 1000 /* ModelConstants.FIRST_LINE_DETECTION_LENGTH_LIMIT */)) ?? undefined;
            if (guess) {
                candidateLanguage = { id: guess, source: 'guess' };
            }
        }
        // Finally apply languageId to model if specified
        if (candidateLanguage && candidateLanguage.id !== PLAINTEXT_LANGUAGE_ID) {
            if (this.input instanceof UntitledTextEditorInput && candidateLanguage.source === 'event') {
                // High confidence, set language id at TextEditorModel level to block future auto-detection
                this.input.setLanguageId(candidateLanguage.id);
            }
            else {
                textModel.setLanguage(this.languageService.createById(candidateLanguage.id));
            }
            const opts = this.modelService.getCreationOptions(textModel.getLanguageId(), textModel.uri, textModel.isForSimpleWidget);
            textModel.detectIndentation(opts.insertSpaces, opts.tabSize);
        }
    }
};
TextResourceEditor = TextResourceEditor_1 = __decorate([
    __param(1, ITelemetryService),
    __param(2, IInstantiationService),
    __param(3, IStorageService),
    __param(4, ITextResourceConfigurationService),
    __param(5, IThemeService),
    __param(6, IEditorService),
    __param(7, IEditorGroupsService),
    __param(8, IModelService),
    __param(9, ILanguageService),
    __param(10, IFileService)
], TextResourceEditor);
export { TextResourceEditor };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dFJlc291cmNlRWRpdG9yLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9icm93c2VyL3BhcnRzL2VkaXRvci90ZXh0UmVzb3VyY2VFZGl0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRXhFLE9BQU8sRUFBc0IscUJBQXFCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUV0RixPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNqRixPQUFPLEVBQW1DLHVCQUF1QixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDN0gsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDaEYsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sOERBQThELENBQUM7QUFDdkcsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDN0QsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDdkYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxpQ0FBaUMsRUFBRSxNQUFNLGlFQUFpRSxDQUFDO0FBQ3BILE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUVsRixPQUFPLEVBQWdCLG9CQUFvQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFFNUcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsZ0JBQWdC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