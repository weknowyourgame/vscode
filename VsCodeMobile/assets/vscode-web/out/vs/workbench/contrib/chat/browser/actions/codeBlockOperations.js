var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { AsyncIterableObject } from '../../../../../base/common/async.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { isCancellationError } from '../../../../../base/common/errors.js';
import { isEqual } from '../../../../../base/common/resources.js';
import * as strings from '../../../../../base/common/strings.js';
import { URI } from '../../../../../base/common/uri.js';
import { getCodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { IBulkEditService, ResourceTextEdit } from '../../../../../editor/browser/services/bulkEditService.js';
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { EditDeltaInfo } from '../../../../../editor/common/textModelEditSource.js';
import { localize } from '../../../../../nls.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IProgressService } from '../../../../../platform/progress/common/progress.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { ITextFileService } from '../../../../services/textfile/common/textfiles.js';
import { IAiEditTelemetryService } from '../../../editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js';
import { reviewEdits, reviewNotebookEdits } from '../../../inlineChat/browser/inlineChatController.js';
import { insertCell } from '../../../notebook/browser/controller/cellOperations.js';
import { CellKind, NOTEBOOK_EDITOR_ID } from '../../../notebook/common/notebookCommon.js';
import { INotebookService } from '../../../notebook/common/notebookService.js';
import { ICodeMapperService } from '../../common/chatCodeMapperService.js';
import { IChatService } from '../../common/chatService.js';
import { isRequestVM, isResponseVM } from '../../common/chatViewModel.js';
let InsertCodeBlockOperation = class InsertCodeBlockOperation {
    constructor(editorService, textFileService, bulkEditService, codeEditorService, chatService, languageService, dialogService, aiEditTelemetryService) {
        this.editorService = editorService;
        this.textFileService = textFileService;
        this.bulkEditService = bulkEditService;
        this.codeEditorService = codeEditorService;
        this.chatService = chatService;
        this.languageService = languageService;
        this.dialogService = dialogService;
        this.aiEditTelemetryService = aiEditTelemetryService;
    }
    async run(context) {
        const activeEditorControl = getEditableActiveCodeEditor(this.editorService);
        if (activeEditorControl) {
            await this.handleTextEditor(activeEditorControl, context);
        }
        else {
            const activeNotebookEditor = getActiveNotebookEditor(this.editorService);
            if (activeNotebookEditor) {
                await this.handleNotebookEditor(activeNotebookEditor, context);
            }
            else {
                this.notify(localize('insertCodeBlock.noActiveEditor', "To insert the code block, open a code editor or notebook editor and set the cursor at the location where to insert the code block."));
            }
        }
        if (isResponseVM(context.element)) {
            const requestId = context.element.requestId;
            const request = context.element.session.getItems().find(item => item.id === requestId && isRequestVM(item));
            notifyUserAction(this.chatService, context, {
                kind: 'insert',
                codeBlockIndex: context.codeBlockIndex,
                totalCharacters: context.code.length,
                totalLines: context.code.split('\n').length,
                languageId: context.languageId,
                modelId: request?.modelId ?? '',
            });
            const codeBlockInfo = context.element.model.codeBlockInfos?.at(context.codeBlockIndex);
            this.aiEditTelemetryService.handleCodeAccepted({
                acceptanceMethod: 'insertAtCursor',
                suggestionId: codeBlockInfo?.suggestionId,
                editDeltaInfo: EditDeltaInfo.fromText(context.code),
                feature: 'sideBarChat',
                languageId: context.languageId,
                modeId: context.element.model.request?.modeInfo?.modeId,
                modelId: request?.modelId,
                presentation: 'codeBlock',
                applyCodeBlockSuggestionId: undefined,
                source: undefined,
            });
        }
    }
    async handleNotebookEditor(notebookEditor, codeBlockContext) {
        if (notebookEditor.isReadOnly) {
            this.notify(localize('insertCodeBlock.readonlyNotebook', "Cannot insert the code block to read-only notebook editor."));
            return false;
        }
        const focusRange = notebookEditor.getFocus();
        const next = Math.max(focusRange.end - 1, 0);
        insertCell(this.languageService, notebookEditor, next, CellKind.Code, 'below', codeBlockContext.code, true);
        return true;
    }
    async handleTextEditor(codeEditor, codeBlockContext) {
        const activeModel = codeEditor.getModel();
        if (isReadOnly(activeModel, this.textFileService)) {
            this.notify(localize('insertCodeBlock.readonly', "Cannot insert the code block to read-only code editor."));
            return false;
        }
        const range = codeEditor.getSelection() ?? new Range(activeModel.getLineCount(), 1, activeModel.getLineCount(), 1);
        const text = reindent(codeBlockContext.code, activeModel, range.startLineNumber);
        const edits = [new ResourceTextEdit(activeModel.uri, { range, text })];
        await this.bulkEditService.apply(edits);
        this.codeEditorService.listCodeEditors().find(editor => editor.getModel()?.uri.toString() === activeModel.uri.toString())?.focus();
        return true;
    }
    notify(message) {
        //this.notificationService.notify({ severity: Severity.Info, message });
        this.dialogService.info(message);
    }
};
InsertCodeBlockOperation = __decorate([
    __param(0, IEditorService),
    __param(1, ITextFileService),
    __param(2, IBulkEditService),
    __param(3, ICodeEditorService),
    __param(4, IChatService),
    __param(5, ILanguageService),
    __param(6, IDialogService),
    __param(7, IAiEditTelemetryService)
], InsertCodeBlockOperation);
export { InsertCodeBlockOperation };
let ApplyCodeBlockOperation = class ApplyCodeBlockOperation {
    constructor(editorService, textFileService, chatService, fileService, dialogService, logService, codeMapperService, progressService, quickInputService, labelService, instantiationService, notebookService) {
        this.editorService = editorService;
        this.textFileService = textFileService;
        this.chatService = chatService;
        this.fileService = fileService;
        this.dialogService = dialogService;
        this.logService = logService;
        this.codeMapperService = codeMapperService;
        this.progressService = progressService;
        this.quickInputService = quickInputService;
        this.labelService = labelService;
        this.instantiationService = instantiationService;
        this.notebookService = notebookService;
    }
    async run(context) {
        let activeEditorControl = getEditableActiveCodeEditor(this.editorService);
        const codemapperUri = await this.evaluateURIToUse(context.codemapperUri, activeEditorControl);
        if (!codemapperUri) {
            return;
        }
        if (codemapperUri && !isEqual(activeEditorControl?.getModel().uri, codemapperUri) && !this.notebookService.hasSupportedNotebooks(codemapperUri)) {
            // reveal the target file
            try {
                const editorPane = await this.editorService.openEditor({ resource: codemapperUri });
                const codeEditor = getCodeEditor(editorPane?.getControl());
                if (codeEditor && codeEditor.hasModel()) {
                    this.tryToRevealCodeBlock(codeEditor, context.code);
                    activeEditorControl = codeEditor;
                }
                else {
                    this.notify(localize('applyCodeBlock.errorOpeningFile', "Failed to open {0} in a code editor.", codemapperUri.toString()));
                    return;
                }
            }
            catch (e) {
                this.logService.info('[ApplyCodeBlockOperation] error opening code mapper file', codemapperUri, e);
                return;
            }
        }
        let codeBlockSuggestionId = undefined;
        if (isResponseVM(context.element)) {
            const codeBlockInfo = context.element.model.codeBlockInfos?.at(context.codeBlockIndex);
            if (codeBlockInfo) {
                codeBlockSuggestionId = codeBlockInfo.suggestionId;
            }
        }
        let result = undefined;
        if (activeEditorControl && !this.notebookService.hasSupportedNotebooks(codemapperUri)) {
            result = await this.handleTextEditor(activeEditorControl, context.chatSessionResource, context.code, codeBlockSuggestionId);
        }
        else {
            const activeNotebookEditor = getActiveNotebookEditor(this.editorService);
            if (activeNotebookEditor) {
                result = await this.handleNotebookEditor(activeNotebookEditor, context.chatSessionResource, context.code);
            }
            else {
                this.notify(localize('applyCodeBlock.noActiveEditor', "To apply this code block, open a code or notebook editor."));
            }
        }
        if (isResponseVM(context.element)) {
            const requestId = context.element.requestId;
            const request = context.element.session.getItems().find(item => item.id === requestId && isRequestVM(item));
            notifyUserAction(this.chatService, context, {
                kind: 'apply',
                codeBlockIndex: context.codeBlockIndex,
                totalCharacters: context.code.length,
                codeMapper: result?.codeMapper,
                editsProposed: !!result?.editsProposed,
                totalLines: context.code.split('\n').length,
                modelId: request?.modelId ?? '',
                languageId: context.languageId,
            });
        }
    }
    async evaluateURIToUse(resource, activeEditorControl) {
        if (resource && await this.fileService.exists(resource)) {
            return resource;
        }
        const activeEditorOption = activeEditorControl?.getModel().uri ? { label: localize('activeEditor', "Active editor '{0}'", this.labelService.getUriLabel(activeEditorControl.getModel().uri, { relative: true })), id: 'activeEditor' } : undefined;
        const untitledEditorOption = { label: localize('newUntitledFile', "New untitled editor"), id: 'newUntitledFile' };
        const options = [];
        if (resource) {
            // code block had an URI, but it doesn't exist
            options.push({ label: localize('createFile', "New file '{0}'", this.labelService.getUriLabel(resource, { relative: true })), id: 'createFile' });
            options.push(untitledEditorOption);
            if (activeEditorOption) {
                options.push(activeEditorOption);
            }
        }
        else {
            // code block had no URI
            if (activeEditorOption) {
                options.push(activeEditorOption);
            }
            options.push(untitledEditorOption);
        }
        const selected = options.length > 1 ? await this.quickInputService.pick(options, { placeHolder: localize('selectOption', "Select where to apply the code block") }) : options[0];
        if (selected) {
            switch (selected.id) {
                case 'createFile':
                    if (resource) {
                        try {
                            await this.fileService.writeFile(resource, VSBuffer.fromString(''));
                        }
                        catch (error) {
                            this.notify(localize('applyCodeBlock.fileWriteError', "Failed to create file: {0}", error.message));
                            return URI.from({ scheme: 'untitled', path: resource.path });
                        }
                    }
                    return resource;
                case 'newUntitledFile':
                    return URI.from({ scheme: 'untitled', path: resource ? resource.path : 'Untitled-1' });
                case 'activeEditor':
                    return activeEditorControl?.getModel().uri;
            }
        }
        return undefined;
    }
    async handleNotebookEditor(notebookEditor, chatSessionResource, code) {
        if (notebookEditor.isReadOnly) {
            this.notify(localize('applyCodeBlock.readonlyNotebook', "Cannot apply code block to read-only notebook editor."));
            return undefined;
        }
        const uri = notebookEditor.textModel.uri;
        const codeBlock = { code, resource: uri, markdownBeforeBlock: undefined };
        const codeMapper = this.codeMapperService.providers[0]?.displayName;
        if (!codeMapper) {
            this.notify(localize('applyCodeBlock.noCodeMapper', "No code mapper available."));
            return undefined;
        }
        let editsProposed = false;
        const cancellationTokenSource = new CancellationTokenSource();
        try {
            const iterable = await this.progressService.withProgress({ location: 15 /* ProgressLocation.Notification */, delay: 500, sticky: true, cancellable: true }, async (progress) => {
                progress.report({ message: localize('applyCodeBlock.progress', "Applying code block using {0}...", codeMapper) });
                const editsIterable = this.getNotebookEdits(codeBlock, chatSessionResource, cancellationTokenSource.token);
                return await this.waitForFirstElement(editsIterable);
            }, () => cancellationTokenSource.cancel());
            editsProposed = await this.applyNotebookEditsWithInlinePreview(iterable, uri, cancellationTokenSource);
        }
        catch (e) {
            if (!isCancellationError(e)) {
                this.notify(localize('applyCodeBlock.error', "Failed to apply code block: {0}", e.message));
            }
        }
        finally {
            cancellationTokenSource.dispose();
        }
        return {
            editsProposed,
            codeMapper
        };
    }
    async handleTextEditor(codeEditor, chatSessionResource, code, applyCodeBlockSuggestionId) {
        const activeModel = codeEditor.getModel();
        if (isReadOnly(activeModel, this.textFileService)) {
            this.notify(localize('applyCodeBlock.readonly', "Cannot apply code block to read-only file."));
            return undefined;
        }
        const codeBlock = { code, resource: activeModel.uri, chatSessionResource, markdownBeforeBlock: undefined };
        const codeMapper = this.codeMapperService.providers[0]?.displayName;
        if (!codeMapper) {
            this.notify(localize('applyCodeBlock.noCodeMapper', "No code mapper available."));
            return undefined;
        }
        let editsProposed = false;
        const cancellationTokenSource = new CancellationTokenSource();
        try {
            const iterable = await this.progressService.withProgress({ location: 15 /* ProgressLocation.Notification */, delay: 500, sticky: true, cancellable: true }, async (progress) => {
                progress.report({ message: localize('applyCodeBlock.progress', "Applying code block using {0}...", codeMapper) });
                const editsIterable = this.getTextEdits(codeBlock, chatSessionResource, cancellationTokenSource.token);
                return await this.waitForFirstElement(editsIterable);
            }, () => cancellationTokenSource.cancel());
            editsProposed = await this.applyWithInlinePreview(iterable, codeEditor, cancellationTokenSource, applyCodeBlockSuggestionId);
        }
        catch (e) {
            if (!isCancellationError(e)) {
                this.notify(localize('applyCodeBlock.error', "Failed to apply code block: {0}", e.message));
            }
        }
        finally {
            cancellationTokenSource.dispose();
        }
        return {
            editsProposed,
            codeMapper
        };
    }
    getTextEdits(codeBlock, chatSessionResource, token) {
        return new AsyncIterableObject(async (executor) => {
            const request = {
                codeBlocks: [codeBlock],
                chatSessionResource,
            };
            const response = {
                textEdit: (target, edit) => {
                    executor.emitOne(edit);
                },
                notebookEdit(_resource, _edit) {
                    //
                },
            };
            const result = await this.codeMapperService.mapCode(request, response, token);
            if (result?.errorMessage) {
                executor.reject(new Error(result.errorMessage));
            }
        });
    }
    getNotebookEdits(codeBlock, chatSessionResource, token) {
        return new AsyncIterableObject(async (executor) => {
            const request = {
                codeBlocks: [codeBlock],
                chatSessionResource,
                location: 'panel'
            };
            const response = {
                textEdit: (target, edits) => {
                    executor.emitOne([target, edits]);
                },
                notebookEdit(_resource, edit) {
                    executor.emitOne(edit);
                },
            };
            const result = await this.codeMapperService.mapCode(request, response, token);
            if (result?.errorMessage) {
                executor.reject(new Error(result.errorMessage));
            }
        });
    }
    async waitForFirstElement(iterable) {
        const iterator = iterable[Symbol.asyncIterator]();
        let result = await iterator.next();
        if (result.done) {
            return {
                async *[Symbol.asyncIterator]() {
                    return;
                }
            };
        }
        return {
            async *[Symbol.asyncIterator]() {
                while (!result.done) {
                    yield result.value;
                    result = await iterator.next();
                }
            }
        };
    }
    async applyWithInlinePreview(edits, codeEditor, tokenSource, applyCodeBlockSuggestionId) {
        return this.instantiationService.invokeFunction(reviewEdits, codeEditor, edits, tokenSource.token, applyCodeBlockSuggestionId);
    }
    async applyNotebookEditsWithInlinePreview(edits, uri, tokenSource) {
        return this.instantiationService.invokeFunction(reviewNotebookEdits, uri, edits, tokenSource.token);
    }
    tryToRevealCodeBlock(codeEditor, codeBlock) {
        const match = codeBlock.match(/(\S[^\n]*)\n/); // substring that starts with a non-whitespace character and ends with a newline
        if (match && match[1].length > 10) {
            const findMatch = codeEditor.getModel().findNextMatch(match[1], { lineNumber: 1, column: 1 }, false, false, null, false);
            if (findMatch) {
                codeEditor.revealRangeInCenter(findMatch.range);
            }
        }
    }
    notify(message) {
        //this.notificationService.notify({ severity: Severity.Info, message });
        this.dialogService.info(message);
    }
};
ApplyCodeBlockOperation = __decorate([
    __param(0, IEditorService),
    __param(1, ITextFileService),
    __param(2, IChatService),
    __param(3, IFileService),
    __param(4, IDialogService),
    __param(5, ILogService),
    __param(6, ICodeMapperService),
    __param(7, IProgressService),
    __param(8, IQuickInputService),
    __param(9, ILabelService),
    __param(10, IInstantiationService),
    __param(11, INotebookService)
], ApplyCodeBlockOperation);
export { ApplyCodeBlockOperation };
function notifyUserAction(chatService, context, action) {
    if (isResponseVM(context.element)) {
        chatService.notifyUserAction({
            agentId: context.element.agent?.id,
            command: context.element.slashCommand?.name,
            sessionResource: context.element.sessionResource,
            requestId: context.element.requestId,
            result: context.element.result,
            action
        });
    }
}
function getActiveNotebookEditor(editorService) {
    const activeEditorPane = editorService.activeEditorPane;
    if (activeEditorPane?.getId() === NOTEBOOK_EDITOR_ID) {
        const notebookEditor = activeEditorPane.getControl();
        if (notebookEditor.hasModel()) {
            return notebookEditor;
        }
    }
    return undefined;
}
function getEditableActiveCodeEditor(editorService) {
    const activeCodeEditorInNotebook = getActiveNotebookEditor(editorService)?.activeCodeEditor;
    if (activeCodeEditorInNotebook && activeCodeEditorInNotebook.hasTextFocus() && activeCodeEditorInNotebook.hasModel()) {
        return activeCodeEditorInNotebook;
    }
    let codeEditor = getCodeEditor(editorService.activeTextEditorControl);
    if (!codeEditor) {
        for (const editor of editorService.visibleTextEditorControls) {
            codeEditor = getCodeEditor(editor);
            if (codeEditor) {
                break;
            }
        }
    }
    if (!codeEditor || !codeEditor.hasModel()) {
        return undefined;
    }
    return codeEditor;
}
function isReadOnly(model, textFileService) {
    // Check if model is editable, currently only support untitled and text file
    const activeTextModel = textFileService.files.get(model.uri) ?? textFileService.untitled.get(model.uri);
    return !!activeTextModel?.isReadonly();
}
function reindent(codeBlockContent, model, seletionStartLine) {
    const newContent = strings.splitLines(codeBlockContent);
    if (newContent.length === 0) {
        return codeBlockContent;
    }
    const formattingOptions = model.getFormattingOptions();
    const codeIndentLevel = computeIndentation(model.getLineContent(seletionStartLine), formattingOptions.tabSize).level;
    const indents = newContent.map(line => computeIndentation(line, formattingOptions.tabSize));
    // find the smallest indent level in the code block
    const newContentIndentLevel = indents.reduce((min, indent, index) => {
        if (indent.length !== newContent[index].length) { // ignore empty lines
            return Math.min(indent.level, min);
        }
        return min;
    }, Number.MAX_VALUE);
    if (newContentIndentLevel === Number.MAX_VALUE || newContentIndentLevel === codeIndentLevel) {
        // all lines are empty or the indent is already correct
        return codeBlockContent;
    }
    const newLines = [];
    for (let i = 0; i < newContent.length; i++) {
        const { level, length } = indents[i];
        const newLevel = Math.max(0, codeIndentLevel + level - newContentIndentLevel);
        const newIndentation = formattingOptions.insertSpaces ? ' '.repeat(formattingOptions.tabSize * newLevel) : '\t'.repeat(newLevel);
        newLines.push(newIndentation + newContent[i].substring(length));
    }
    return newLines.join('\n');
}
/**
 * Returns:
 *  - level: the line's the ident level in tabs
 *  - length: the number of characters of the leading whitespace
 */
export function computeIndentation(line, tabSize) {
    let nSpaces = 0;
    let level = 0;
    let i = 0;
    let length = 0;
    const len = line.length;
    while (i < len) {
        const chCode = line.charCodeAt(i);
        if (chCode === 32 /* CharCode.Space */) {
            nSpaces++;
            if (nSpaces === tabSize) {
                level++;
                nSpaces = 0;
                length = i + 1;
            }
        }
        else if (chCode === 9 /* CharCode.Tab */) {
            level++;
            nSpaces = 0;
            length = i + 1;
        }
        else {
            break;
        }
        i++;
    }
    return { level, length };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZUJsb2NrT3BlcmF0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jb2RlQmxvY2tPcGVyYXRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBOzs7Z0dBR2dHO0FBQ2hHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRSxPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFeEcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDM0UsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2xFLE9BQU8sS0FBSyxPQUFPLE1BQU0sdUNBQXVDLENBQUM7QUFDakUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxhQUFhLEVBQXFCLE1BQU0sZ0RBQWdELENBQUM7QUFDbEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDL0csT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDakcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBRW5FLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBRXRGLE9BQU8sRUFBRSxhQUFhLEVBQW9CLE1BQU0scURBQXFELENBQUM7QUFDdEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNuRixPQUFPLEVBQUUs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