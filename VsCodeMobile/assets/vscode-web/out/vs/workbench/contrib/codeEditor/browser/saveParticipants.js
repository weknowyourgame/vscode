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
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { HierarchicalKind } from '../../../../base/common/hierarchicalKind.js';
import { createCommandUri } from '../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import * as strings from '../../../../base/common/strings.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { trimTrailingWhitespace } from '../../../../editor/common/commands/trimTrailingWhitespaceCommand.js';
import { EditOperation } from '../../../../editor/common/core/editOperation.js';
import { Position } from '../../../../editor/common/core/position.js';
import { Range } from '../../../../editor/common/core/range.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { ApplyCodeActionReason, applyCodeAction, getCodeActions } from '../../../../editor/contrib/codeAction/browser/codeAction.js';
import { CodeActionKind, CodeActionTriggerSource } from '../../../../editor/contrib/codeAction/common/types.js';
import { formatDocumentRangesWithSelectedProvider, formatDocumentWithSelectedProvider } from '../../../../editor/contrib/format/browser/format.js';
import { SnippetController2 } from '../../../../editor/contrib/snippet/browser/snippetController2.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Progress } from '../../../../platform/progress/common/progress.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as WorkbenchContributionsExtensions } from '../../../common/contributions.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { getModifiedRanges } from '../../format/browser/formatModified.js';
let TrimWhitespaceParticipant = class TrimWhitespaceParticipant {
    constructor(configurationService, codeEditorService) {
        this.configurationService = configurationService;
        this.codeEditorService = codeEditorService;
        // Nothing
    }
    async participate(model, context) {
        if (!model.textEditorModel) {
            return;
        }
        const trimTrailingWhitespaceOption = this.configurationService.getValue('files.trimTrailingWhitespace', { overrideIdentifier: model.textEditorModel.getLanguageId(), resource: model.resource });
        const trimInRegexAndStrings = this.configurationService.getValue('files.trimTrailingWhitespaceInRegexAndStrings', { overrideIdentifier: model.textEditorModel.getLanguageId(), resource: model.resource });
        if (trimTrailingWhitespaceOption) {
            this.doTrimTrailingWhitespace(model.textEditorModel, context.reason === 2 /* SaveReason.AUTO */, trimInRegexAndStrings);
        }
    }
    doTrimTrailingWhitespace(model, isAutoSaved, trimInRegexesAndStrings) {
        let prevSelection = [];
        let cursors = [];
        const editor = findEditor(model, this.codeEditorService);
        if (editor) {
            // Find `prevSelection` in any case do ensure a good undo stack when pushing the edit
            // Collect active cursors in `cursors` only if `isAutoSaved` to avoid having the cursors jump
            prevSelection = editor.getSelections();
            if (isAutoSaved) {
                cursors = prevSelection.map(s => s.getPosition());
                const snippetsRange = SnippetController2.get(editor)?.getSessionEnclosingRange();
                if (snippetsRange) {
                    for (let lineNumber = snippetsRange.startLineNumber; lineNumber <= snippetsRange.endLineNumber; lineNumber++) {
                        cursors.push(new Position(lineNumber, model.getLineMaxColumn(lineNumber)));
                    }
                }
            }
        }
        const ops = trimTrailingWhitespace(model, cursors, trimInRegexesAndStrings);
        if (!ops.length) {
            return; // Nothing to do
        }
        model.pushEditOperations(prevSelection, ops, (_edits) => prevSelection);
    }
};
TrimWhitespaceParticipant = __decorate([
    __param(0, IConfigurationService),
    __param(1, ICodeEditorService)
], TrimWhitespaceParticipant);
export { TrimWhitespaceParticipant };
function findEditor(model, codeEditorService) {
    let candidate = null;
    if (model.isAttachedToEditor()) {
        for (const editor of codeEditorService.listCodeEditors()) {
            if (editor.hasModel() && editor.getModel() === model) {
                if (editor.hasTextFocus()) {
                    return editor; // favour focused editor if there are multiple
                }
                candidate = editor;
            }
        }
    }
    return candidate;
}
let FinalNewLineParticipant = class FinalNewLineParticipant {
    constructor(configurationService, codeEditorService) {
        this.configurationService = configurationService;
        this.codeEditorService = codeEditorService;
        // Nothing
    }
    async participate(model, context) {
        if (!model.textEditorModel) {
            return;
        }
        if (this.configurationService.getValue('files.insertFinalNewline', { overrideIdentifier: model.textEditorModel.getLanguageId(), resource: model.resource })) {
            this.doInsertFinalNewLine(model.textEditorModel);
        }
    }
    doInsertFinalNewLine(model) {
        const lineCount = model.getLineCount();
        const lastLine = model.getLineContent(lineCount);
        const lastLineIsEmptyOrWhitespace = strings.lastNonWhitespaceIndex(lastLine) === -1;
        if (!lineCount || lastLineIsEmptyOrWhitespace) {
            return;
        }
        const edits = [EditOperation.insert(new Position(lineCount, model.getLineMaxColumn(lineCount)), model.getEOL())];
        const editor = findEditor(model, this.codeEditorService);
        if (editor) {
            editor.executeEdits('insertFinalNewLine', edits, editor.getSelections());
        }
        else {
            model.pushEditOperations([], edits, () => null);
        }
    }
};
FinalNewLineParticipant = __decorate([
    __param(0, IConfigurationService),
    __param(1, ICodeEditorService)
], FinalNewLineParticipant);
export { FinalNewLineParticipant };
let TrimFinalNewLinesParticipant = class TrimFinalNewLinesParticipant {
    constructor(configurationService, codeEditorService) {
        this.configurationService = configurationService;
        this.codeEditorService = codeEditorService;
        // Nothing
    }
    async participate(model, context) {
        if (!model.textEditorModel) {
            return;
        }
        if (this.configurationService.getValue('files.trimFinalNewlines', { overrideIdentifier: model.textEditorModel.getLanguageId(), resource: model.resource })) {
            this.doTrimFinalNewLines(model.textEditorModel, context.reason === 2 /* SaveReason.AUTO */);
        }
    }
    /**
     * returns 0 if the entire file is empty
     */
    findLastNonEmptyLine(model) {
        for (let lineNumber = model.getLineCount(); lineNumber >= 1; lineNumber--) {
            const lineLength = model.getLineLength(lineNumber);
            if (lineLength > 0) {
                // this line has content
                return lineNumber;
            }
        }
        // no line has content
        return 0;
    }
    doTrimFinalNewLines(model, isAutoSaved) {
        const lineCount = model.getLineCount();
        // Do not insert new line if file does not end with new line
        if (lineCount === 1) {
            return;
        }
        let prevSelection = [];
        let cannotTouchLineNumber = 0;
        const editor = findEditor(model, this.codeEditorService);
        if (editor) {
            prevSelection = editor.getSelections();
            if (isAutoSaved) {
                for (let i = 0, len = prevSelection.length; i < len; i++) {
                    const positionLineNumber = prevSelection[i].positionLineNumber;
                    if (positionLineNumber > cannotTouchLineNumber) {
                        cannotTouchLineNumber = positionLineNumber;
                    }
                }
            }
        }
        const lastNonEmptyLine = this.findLastNonEmptyLine(model);
        const deleteFromLineNumber = Math.max(lastNonEmptyLine + 1, cannotTouchLineNumber + 1);
        const deletionRange = model.validateRange(new Range(deleteFromLineNumber, 1, lineCount, model.getLineMaxColumn(lineCount)));
        if (deletionRange.isEmpty()) {
            return;
        }
        model.pushEditOperations(prevSelection, [EditOperation.delete(deletionRange)], _edits => prevSelection);
        editor?.setSelections(prevSelection);
    }
};
TrimFinalNewLinesParticipant = __decorate([
    __param(0, IConfigurationService),
    __param(1, ICodeEditorService)
], TrimFinalNewLinesParticipant);
export { TrimFinalNewLinesParticipant };
let FormatOnSaveParticipant = class FormatOnSaveParticipant {
    constructor(configurationService, codeEditorService, instantiationService) {
        this.configurationService = configurationService;
        this.codeEditorService = codeEditorService;
        this.instantiationService = instantiationService;
        // Nothing
    }
    async participate(model, context, progress, token) {
        if (!model.textEditorModel) {
            return;
        }
        if (context.reason === 2 /* SaveReason.AUTO */) {
            return undefined;
        }
        const textEditorModel = model.textEditorModel;
        const overrides = { overrideIdentifier: textEditorModel.getLanguageId(), resource: textEditorModel.uri };
        const nestedProgress = new Progress(provider => {
            progress.report({
                message: localize({ key: 'formatting2', comment: ['[configure]({1}) is a link. Only translate `configure`. Do not change brackets and parentheses or {1}'] }, "Running '{0}' Formatter ([configure]({1})).", provider.displayName || provider.extensionId && provider.extensionId.value || '???', createCommandUri('workbench.action.openSettings', 'editor.formatOnSave').toString())
            });
        });
        const enabled = this.configurationService.getValue('editor.formatOnSave', overrides);
        if (!enabled) {
            return undefined;
        }
        const editorOrModel = findEditor(textEditorModel, this.codeEditorService) || textEditorModel;
        const mode = this.configurationService.getValue('editor.formatOnSaveMode', overrides);
        if (mode === 'file') {
            await this.instantiationService.invokeFunction(formatDocumentWithSelectedProvider, editorOrModel, 2 /* FormattingMode.Silent */, nestedProgress, token);
        }
        else {
            const ranges = await this.instantiationService.invokeFunction(getModifiedRanges, isCodeEditor(editorOrModel) ? editorOrModel.getModel() : editorOrModel);
            if (ranges === null && mode === 'modificationsIfAvailable') {
                // no SCM, fallback to formatting the whole file iff wanted
                await this.instantiationService.invokeFunction(formatDocumentWithSelectedProvider, editorOrModel, 2 /* FormattingMode.Silent */, nestedProgress, token);
            }
            else if (ranges) {
                // formatted modified ranges
                await this.instantiationService.invokeFunction(formatDocumentRangesWithSelectedProvider, editorOrModel, ranges, 2 /* FormattingMode.Silent */, nestedProgress, token, false);
            }
        }
    }
};
FormatOnSaveParticipant = __decorate([
    __param(0, IConfigurationService),
    __param(1, ICodeEditorService),
    __param(2, IInstantiationService)
], FormatOnSaveParticipant);
let CodeActionOnSaveParticipant = class CodeActionOnSaveParticipant extends Disposable {
    constructor(configurationService, instantiationService, languageFeaturesService, hostService, editorService, codeEditorService) {
        super();
        this.configurationService = configurationService;
        this.instantiationService = instantiationService;
        this.languageFeaturesService = languageFeaturesService;
        this.hostService = hostService;
        this.editorService = editorService;
        this.codeEditorService = codeEditorService;
        this._register(this.hostService.onDidChangeFocus(() => { this.triggerCodeActionsCommand(); }));
        this._register(this.editorService.onDidActiveEditorChange(() => { this.triggerCodeActionsCommand(); }));
    }
    async triggerCodeActionsCommand() {
        if (this.configurationService.getValue('editor.codeActions.triggerOnFocusChange') && this.configurationService.getValue('files.autoSave') === 'afterDelay') {
            const model = this.codeEditorService.getActiveCodeEditor()?.getModel();
            if (!model) {
                return undefined;
            }
            const settingsOverrides = { overrideIdentifier: model.getLanguageId(), resource: model.uri };
            const setting = this.configurationService.getValue('editor.codeActionsOnSave', settingsOverrides);
            if (!setting) {
                return undefined;
            }
            if (Array.isArray(setting)) {
                return undefined;
            }
            const settingItems = Object.keys(setting).filter(x => setting[x] && setting[x] === 'always' && CodeActionKind.Source.contains(new HierarchicalKind(x)));
            const cancellationTokenSource = new CancellationTokenSource();
            const codeActionKindList = [];
            for (const item of settingItems) {
                codeActionKindList.push(new HierarchicalKind(item));
            }
            // run code actions based on what is found from setting === 'always', no exclusions.
            await this.applyOnSaveActions(model, codeActionKindList, [], Progress.None, cancellationTokenSource.token);
        }
    }
    async participate(model, context, progress, token) {
        if (!model.textEditorModel) {
            return;
        }
        const textEditorModel = model.textEditorModel;
        const settingsOverrides = { overrideIdentifier: textEditorModel.getLanguageId(), resource: textEditorModel.uri };
        // Convert boolean values to strings
        const setting = this.configurationService.getValue('editor.codeActionsOnSave', settingsOverrides);
        if (!setting) {
            return undefined;
        }
        if (context.reason === 2 /* SaveReason.AUTO */) {
            return undefined;
        }
        if (context.reason !== 1 /* SaveReason.EXPLICIT */ && Array.isArray(setting)) {
            return undefined;
        }
        const settingItems = Array.isArray(setting)
            ? setting
            : Object.keys(setting).filter(x => setting[x] && setting[x] !== 'never');
        const codeActionsOnSave = this.createCodeActionsOnSave(settingItems);
        if (!Array.isArray(setting)) {
            codeActionsOnSave.sort((a, b) => {
                if (CodeActionKind.SourceFixAll.contains(a)) {
                    if (CodeActionKind.SourceFixAll.contains(b)) {
                        return 0;
                    }
                    return -1;
                }
                if (CodeActionKind.SourceFixAll.contains(b)) {
                    return 1;
                }
                return 0;
            });
        }
        if (!codeActionsOnSave.length) {
            return undefined;
        }
        const excludedActions = Array.isArray(setting)
            ? []
            : Object.keys(setting)
                .filter(x => setting[x] === 'never' || false)
                .map(x => new HierarchicalKind(x));
        progress.report({ message: localize('codeaction', "Quick Fixes") });
        const filteredSaveList = Array.isArray(setting) ? codeActionsOnSave : codeActionsOnSave.filter(x => setting[x.value] === 'always' || ((setting[x.value] === 'explicit' || setting[x.value] === true) && context.reason === 1 /* SaveReason.EXPLICIT */));
        await this.applyOnSaveActions(textEditorModel, filteredSaveList, excludedActions, progress, token);
    }
    createCodeActionsOnSave(settingItems) {
        const kinds = settingItems.map(x => new HierarchicalKind(x));
        // Remove subsets
        return kinds.filter(kind => {
            return kinds.every(otherKind => otherKind.equals(kind) || !otherKind.contains(kind));
        });
    }
    async applyOnSaveActions(model, codeActionsOnSave, excludes, progress, token) {
        const getActionProgress = new class {
            constructor() {
                this._names = new Set();
            }
            _report() {
                progress.report({
                    message: localize({ key: 'codeaction.get2', comment: ['[configure]({1}) is a link. Only translate `configure`. Do not change brackets and parentheses or {1}'] }, "Getting code actions from {0} ([configure]({1})).", [...this._names].map(name => `'${name}'`).join(', '), createCommandUri('workbench.action.openSettings', 'editor.codeActionsOnSave').toString())
                });
            }
            report(provider) {
                if (provider.displayName && !this._names.has(provider.displayName)) {
                    this._names.add(provider.displayName);
                    this._report();
                }
            }
        };
        for (const codeActionKind of codeActionsOnSave) {
            const actionsToRun = await this.getActionsToRun(model, codeActionKind, excludes, getActionProgress, token);
            if (token.isCancellationRequested) {
                actionsToRun.dispose();
                return;
            }
            try {
                for (const action of actionsToRun.validActions) {
                    progress.report({ message: localize('codeAction.apply', "Applying code action '{0}'.", action.action.title) });
                    await this.instantiationService.invokeFunction(applyCodeAction, action, ApplyCodeActionReason.OnSave, {}, token);
                    if (token.isCancellationRequested) {
                        return;
                    }
                }
            }
            catch {
                // Failure to apply a code action should not block other on save actions
            }
            finally {
                actionsToRun.dispose();
            }
        }
    }
    getActionsToRun(model, codeActionKind, excludes, progress, token) {
        return getCodeActions(this.languageFeaturesService.codeActionProvider, model, model.getFullModelRange(), {
            type: 2 /* CodeActionTriggerType.Auto */,
            triggerAction: CodeActionTriggerSource.OnSave,
            filter: { include: codeActionKind, excludes: excludes, includeSourceActions: true },
        }, progress, token);
    }
};
CodeActionOnSaveParticipant = __decorate([
    __param(0, IConfigurationService),
    __param(1, IInstantiationService),
    __param(2, ILanguageFeaturesService),
    __param(3, IHostService),
    __param(4, IEditorService),
    __param(5, ICodeEditorService)
], CodeActionOnSaveParticipant);
let SaveParticipantsContribution = class SaveParticipantsContribution extends Disposable {
    constructor(instantiationService, textFileService) {
        super();
        this.instantiationService = instantiationService;
        this.textFileService = textFileService;
        this.registerSaveParticipants();
    }
    registerSaveParticipants() {
        this._register(this.textFileService.files.addSaveParticipant(this.instantiationService.createInstance(TrimWhitespaceParticipant)));
        this._register(this.textFileService.files.addSaveParticipant(this.instantiationService.createInstance(CodeActionOnSaveParticipant)));
        this._register(this.textFileService.files.addSaveParticipant(this.instantiationService.createInstance(FormatOnSaveParticipant)));
        this._register(this.textFileService.files.addSaveParticipant(this.instantiationService.createInstance(FinalNewLineParticipant)));
        this._register(this.textFileService.files.addSaveParticipant(this.instantiationService.createInstance(TrimFinalNewLinesParticipant)));
    }
};
SaveParticipantsContribution = __decorate([
    __param(0, IInstantiationService),
    __param(1, ITextFileService)
], SaveParticipantsContribution);
export { SaveParticipantsContribution };
const workbenchContributionsRegistry = Registry.as(WorkbenchContributionsExtensions.Workbench);
workbenchContributionsRegistry.registerWorkbenchContribution(SaveParticipantsContribution, 3 /* LifecyclePhase.Restored */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2F2ZVBhcnRpY2lwYW50cy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvc2F2ZVBhcnRpY2lwYW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDL0UsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sS0FBSyxPQUFPLE1BQU0sb0NBQW9DLENBQUM7QUFDOUQsT0FBTyxFQUFxQixZQUFZLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM5RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUM5RixPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxxRUFBcUUsQ0FBQztBQUM3RyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0saURBQWlELENBQUM7QUFDaEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUloRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUNsRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsZUFBZSxFQUFFLGNBQWMsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ3JJLE9BQU8sRUFBRSxjQUFjLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNoSCxPQUFPLEVBQWtCLHdDQUF3QyxFQUFFLGtDQUFrQyxFQUFFLE1BQU0s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