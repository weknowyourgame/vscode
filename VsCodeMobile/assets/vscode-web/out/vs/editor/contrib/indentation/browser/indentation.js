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
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import * as strings from '../../../../base/common/strings.js';
import * as nls from '../../../../nls.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { EditorAction, registerEditorAction, registerEditorContribution } from '../../../browser/editorExtensions.js';
import { ShiftCommand } from '../../../common/commands/shiftCommand.js';
import { Range } from '../../../common/core/range.js';
import { EditorContextKeys } from '../../../common/editorContextKeys.js';
import { getGoodIndentForLine, getIndentMetadata } from '../../../common/languages/autoIndent.js';
import { ILanguageConfigurationService } from '../../../common/languages/languageConfigurationRegistry.js';
import { IModelService } from '../../../common/services/model.js';
import { getStandardTokenTypeAtPosition } from '../../../common/tokens/lineTokens.js';
import { getReindentEditOperations } from '../common/indentation.js';
import * as indentUtils from '../common/indentUtils.js';
export class IndentationToSpacesAction extends EditorAction {
    static { this.ID = 'editor.action.indentationToSpaces'; }
    constructor() {
        super({
            id: IndentationToSpacesAction.ID,
            label: nls.localize2('indentationToSpaces', "Convert Indentation to Spaces"),
            precondition: EditorContextKeys.writable,
            metadata: {
                description: nls.localize2('indentationToSpacesDescription', "Convert the tab indentation to spaces."),
            }
        });
    }
    run(accessor, editor) {
        const model = editor.getModel();
        if (!model) {
            return;
        }
        const modelOpts = model.getOptions();
        const selection = editor.getSelection();
        if (!selection) {
            return;
        }
        const command = new IndentationToSpacesCommand(selection, modelOpts.tabSize);
        editor.pushUndoStop();
        editor.executeCommands(this.id, [command]);
        editor.pushUndoStop();
        model.updateOptions({
            insertSpaces: true
        });
    }
}
export class IndentationToTabsAction extends EditorAction {
    static { this.ID = 'editor.action.indentationToTabs'; }
    constructor() {
        super({
            id: IndentationToTabsAction.ID,
            label: nls.localize2('indentationToTabs', "Convert Indentation to Tabs"),
            precondition: EditorContextKeys.writable,
            metadata: {
                description: nls.localize2('indentationToTabsDescription', "Convert the spaces indentation to tabs."),
            }
        });
    }
    run(accessor, editor) {
        const model = editor.getModel();
        if (!model) {
            return;
        }
        const modelOpts = model.getOptions();
        const selection = editor.getSelection();
        if (!selection) {
            return;
        }
        const command = new IndentationToTabsCommand(selection, modelOpts.tabSize);
        editor.pushUndoStop();
        editor.executeCommands(this.id, [command]);
        editor.pushUndoStop();
        model.updateOptions({
            insertSpaces: false
        });
    }
}
export class ChangeIndentationSizeAction extends EditorAction {
    constructor(insertSpaces, displaySizeOnly, opts) {
        super(opts);
        this.insertSpaces = insertSpaces;
        this.displaySizeOnly = displaySizeOnly;
    }
    run(accessor, editor) {
        const quickInputService = accessor.get(IQuickInputService);
        const modelService = accessor.get(IModelService);
        const model = editor.getModel();
        if (!model) {
            return;
        }
        const creationOpts = modelService.getCreationOptions(model.getLanguageId(), model.uri, model.isForSimpleWidget);
        const modelOpts = model.getOptions();
        const picks = [1, 2, 3, 4, 5, 6, 7, 8].map(n => ({
            id: n.toString(),
            label: n.toString(),
            // add description for tabSize value set in the configuration
            description: (n === creationOpts.tabSize && n === modelOpts.tabSize
                ? nls.localize('configuredTabSize', "Configured Tab Size")
                : n === creationOpts.tabSize
                    ? nls.localize('defaultTabSize', "Default Tab Size")
                    : n === modelOpts.tabSize
                        ? nls.localize('currentTabSize', "Current Tab Size")
                        : undefined)
        }));
        // auto focus the tabSize set for the current editor
        const autoFocusIndex = Math.min(model.getOptions().tabSize - 1, 7);
        setTimeout(() => {
            quickInputService.pick(picks, { placeHolder: nls.localize({ key: 'selectTabWidth', comment: ['Tab corresponds to the tab key'] }, "Select Tab Size for Current File"), activeItem: picks[autoFocusIndex] }).then(pick => {
                if (pick) {
                    if (model && !model.isDisposed()) {
                        const pickedVal = parseInt(pick.label, 10);
                        if (this.displaySizeOnly) {
                            model.updateOptions({
                                tabSize: pickedVal
                            });
                        }
                        else {
                            model.updateOptions({
                                tabSize: pickedVal,
                                indentSize: pickedVal,
                                insertSpaces: this.insertSpaces
                            });
                        }
                    }
                }
            });
        }, 50 /* quick input is sensitive to being opened so soon after another */);
    }
}
export class IndentUsingTabs extends ChangeIndentationSizeAction {
    static { this.ID = 'editor.action.indentUsingTabs'; }
    constructor() {
        super(false, false, {
            id: IndentUsingTabs.ID,
            label: nls.localize2('indentUsingTabs', "Indent Using Tabs"),
            precondition: undefined,
            metadata: {
                description: nls.localize2('indentUsingTabsDescription', "Use indentation with tabs."),
            }
        });
    }
}
export class IndentUsingSpaces extends ChangeIndentationSizeAction {
    static { this.ID = 'editor.action.indentUsingSpaces'; }
    constructor() {
        super(true, false, {
            id: IndentUsingSpaces.ID,
            label: nls.localize2('indentUsingSpaces', "Indent Using Spaces"),
            precondition: undefined,
            metadata: {
                description: nls.localize2('indentUsingSpacesDescription', "Use indentation with spaces."),
            }
        });
    }
}
export class ChangeTabDisplaySize extends ChangeIndentationSizeAction {
    static { this.ID = 'editor.action.changeTabDisplaySize'; }
    constructor() {
        super(true, true, {
            id: ChangeTabDisplaySize.ID,
            label: nls.localize2('changeTabDisplaySize', "Change Tab Display Size"),
            precondition: undefined,
            metadata: {
                description: nls.localize2('changeTabDisplaySizeDescription', "Change the space size equivalent of the tab."),
            }
        });
    }
}
export class DetectIndentation extends EditorAction {
    static { this.ID = 'editor.action.detectIndentation'; }
    constructor() {
        super({
            id: DetectIndentation.ID,
            label: nls.localize2('detectIndentation', "Detect Indentation from Content"),
            precondition: undefined,
            metadata: {
                description: nls.localize2('detectIndentationDescription', "Detect the indentation from content."),
            }
        });
    }
    run(accessor, editor) {
        const modelService = accessor.get(IModelService);
        const model = editor.getModel();
        if (!model) {
            return;
        }
        const creationOpts = modelService.getCreationOptions(model.getLanguageId(), model.uri, model.isForSimpleWidget);
        model.detectIndentation(creationOpts.insertSpaces, creationOpts.tabSize);
    }
}
export class ReindentLinesAction extends EditorAction {
    constructor() {
        super({
            id: 'editor.action.reindentlines',
            label: nls.localize2('editor.reindentlines', "Reindent Lines"),
            precondition: EditorContextKeys.writable,
            metadata: {
                description: nls.localize2('editor.reindentlinesDescription', "Reindent the lines of the editor."),
            },
            canTriggerInlineEdits: true,
        });
    }
    run(accessor, editor) {
        const languageConfigurationService = accessor.get(ILanguageConfigurationService);
        const model = editor.getModel();
        if (!model) {
            return;
        }
        const edits = getReindentEditOperations(model, languageConfigurationService, 1, model.getLineCount());
        if (edits.length > 0) {
            editor.pushUndoStop();
            editor.executeEdits(this.id, edits);
            editor.pushUndoStop();
        }
    }
}
export class ReindentSelectedLinesAction extends EditorAction {
    constructor() {
        super({
            id: 'editor.action.reindentselectedlines',
            label: nls.localize2('editor.reindentselectedlines', "Reindent Selected Lines"),
            precondition: EditorContextKeys.writable,
            metadata: {
                description: nls.localize2('editor.reindentselectedlinesDescription', "Reindent the selected lines of the editor."),
            },
            canTriggerInlineEdits: true,
        });
    }
    run(accessor, editor) {
        const languageConfigurationService = accessor.get(ILanguageConfigurationService);
        const model = editor.getModel();
        if (!model) {
            return;
        }
        const selections = editor.getSelections();
        if (selections === null) {
            return;
        }
        const edits = [];
        for (const selection of selections) {
            let startLineNumber = selection.startLineNumber;
            let endLineNumber = selection.endLineNumber;
            if (startLineNumber !== endLineNumber && selection.endColumn === 1) {
                endLineNumber--;
            }
            if (startLineNumber === 1) {
                if (startLineNumber === endLineNumber) {
                    continue;
                }
            }
            else {
                startLineNumber--;
            }
            const editOperations = getReindentEditOperations(model, languageConfigurationService, startLineNumber, endLineNumber);
            edits.push(...editOperations);
        }
        if (edits.length > 0) {
            editor.pushUndoStop();
            editor.executeEdits(this.id, edits);
            editor.pushUndoStop();
        }
    }
}
export class AutoIndentOnPasteCommand {
    constructor(edits, initialSelection) {
        this._initialSelection = initialSelection;
        this._edits = [];
        this._selectionId = null;
        for (const edit of edits) {
            if (edit.range && typeof edit.text === 'string') {
                this._edits.push(edit);
            }
        }
    }
    getEditOperations(model, builder) {
        for (const edit of this._edits) {
            builder.addEditOperation(Range.lift(edit.range), edit.text);
        }
        let selectionIsSet = false;
        if (Array.isArray(this._edits) && this._edits.length === 1 && this._initialSelection.isEmpty()) {
            if (this._edits[0].range.startColumn === this._initialSelection.endColumn &&
                this._edits[0].range.startLineNumber === this._initialSelection.endLineNumber) {
                selectionIsSet = true;
                this._selectionId = builder.trackSelection(this._initialSelection, true);
            }
            else if (this._edits[0].range.endColumn === this._initialSelection.startColumn &&
                this._edits[0].range.endLineNumber === this._initialSelection.startLineNumber) {
                selectionIsSet = true;
                this._selectionId = builder.trackSelection(this._initialSelection, false);
            }
        }
        if (!selectionIsSet) {
            this._selectionId = builder.trackSelection(this._initialSelection);
        }
    }
    computeCursorState(model, helper) {
        return helper.getTrackedSelection(this._selectionId);
    }
}
let AutoIndentOnPaste = class AutoIndentOnPaste {
    static { this.ID = 'editor.contrib.autoIndentOnPaste'; }
    constructor(editor, _languageConfigurationService) {
        this.editor = editor;
        this._languageConfigurationService = _languageConfigurationService;
        this.callOnDispose = new DisposableStore();
        this.callOnModel = new DisposableStore();
        this.callOnDispose.add(editor.onDidChangeConfiguration(() => this.update()));
        this.callOnDispose.add(editor.onDidChangeModel(() => this.update()));
        this.callOnDispose.add(editor.onDidChangeModelLanguage(() => this.update()));
    }
    update() {
        // clean up
        this.callOnModel.clear();
        // we are disabled
        if (!this.editor.getOption(17 /* EditorOption.autoIndentOnPaste */) || this.editor.getOption(16 /* EditorOption.autoIndent */) < 4 /* EditorAutoIndentStrategy.Full */) {
            return;
        }
        // no model
        if (!this.editor.hasModel()) {
            return;
        }
        this.callOnModel.add(this.editor.onDidPaste(({ range }) => {
            this.trigger(range);
        }));
    }
    trigger(range) {
        const selections = this.editor.getSelections();
        if (selections === null || selections.length > 1) {
            return;
        }
        const model = this.editor.getModel();
        if (!model) {
            return;
        }
        const containsOnlyWhitespace = this.rangeContainsOnlyWhitespaceCharacters(model, range);
        if (containsOnlyWhitespace) {
            return;
        }
        if (!this.editor.getOption(18 /* EditorOption.autoIndentOnPasteWithinString */) && isStartOrEndInString(model, range)) {
            return;
        }
        if (!model.tokenization.isCheapToTokenize(range.getStartPosition().lineNumber)) {
            return;
        }
        const autoIndent = this.editor.getOption(16 /* EditorOption.autoIndent */);
        const { tabSize, indentSize, insertSpaces } = model.getOptions();
        const textEdits = [];
        const indentConverter = {
            shiftIndent: (indentation) => {
                return ShiftCommand.shiftIndent(indentation, indentation.length + 1, tabSize, indentSize, insertSpaces);
            },
            unshiftIndent: (indentation) => {
                return ShiftCommand.unshiftIndent(indentation, indentation.length + 1, tabSize, indentSize, insertSpaces);
            }
        };
        let startLineNumber = range.startLineNumber;
        let firstLineText = model.getLineContent(startLineNumber);
        if (!/\S/.test(firstLineText.substring(0, range.startColumn - 1))) {
            const indentOfFirstLine = getGoodIndentForLine(autoIndent, model, model.getLanguageId(), startLineNumber, indentConverter, this._languageConfigurationService);
            if (indentOfFirstLine !== null) {
                const oldIndentation = strings.getLeadingWhitespace(firstLineText);
                const newSpaceCnt = indentUtils.getSpaceCnt(indentOfFirstLine, tabSize);
                const oldSpaceCnt = indentUtils.getSpaceCnt(oldIndentation, tabSize);
                if (newSpaceCnt !== oldSpaceCnt) {
                    const newIndent = indentUtils.generateIndent(newSpaceCnt, tabSize, insertSpaces);
                    textEdits.push({
                        range: new Range(startLineNumber, 1, startLineNumber, oldIndentation.length + 1),
                        text: newIndent
                    });
                    firstLineText = newIndent + firstLineText.substring(oldIndentation.length);
                }
                else {
                    const indentMetadata = getIndentMetadata(model, startLineNumber, this._languageConfigurationService);
                    if (indentMetadata === 0 || indentMetadata === 8 /* IndentConsts.UNINDENT_MASK */) {
                        // we paste content into a line where only contains whitespaces
                        // after pasting, the indentation of the first line is already correct
                        // the first line doesn't match any indentation rule
                        // then no-op.
                        return;
                    }
                }
            }
        }
        const firstLineNumber = startLineNumber;
        // ignore empty or ignored lines
        while (startLineNumber < range.endLineNumber) {
            if (!/\S/.test(model.getLineContent(startLineNumber + 1))) {
                startLineNumber++;
                continue;
            }
            break;
        }
        if (startLineNumber !== range.endLineNumber) {
            const virtualModel = {
                tokenization: {
                    getLineTokens: (lineNumber) => {
                        return model.tokenization.getLineTokens(lineNumber);
                    },
                    getLanguageId: () => {
                        return model.getLanguageId();
                    },
                    getLanguageIdAtPosition: (lineNumber, column) => {
                        return model.getLanguageIdAtPosition(lineNumber, column);
                    },
                },
                getLineContent: (lineNumber) => {
                    if (lineNumber === firstLineNumber) {
                        return firstLineText;
                    }
                    else {
                        return model.getLineContent(lineNumber);
                    }
                }
            };
            const indentOfSecondLine = getGoodIndentForLine(autoIndent, virtualModel, model.getLanguageId(), startLineNumber + 1, indentConverter, this._languageConfigurationService);
            if (indentOfSecondLine !== null) {
                const newSpaceCntOfSecondLine = indentUtils.getSpaceCnt(indentOfSecondLine, tabSize);
                const oldSpaceCntOfSecondLine = indentUtils.getSpaceCnt(strings.getLeadingWhitespace(model.getLineContent(startLineNumber + 1)), tabSize);
                if (newSpaceCntOfSecondLine !== oldSpaceCntOfSecondLine) {
                    const spaceCntOffset = newSpaceCntOfSecondLine - oldSpaceCntOfSecondLine;
                    for (let i = startLineNumber + 1; i <= range.endLineNumber; i++) {
                        const lineContent = model.getLineContent(i);
                        const originalIndent = strings.getLeadingWhitespace(lineContent);
                        const originalSpacesCnt = indentUtils.getSpaceCnt(originalIndent, tabSize);
                        const newSpacesCnt = originalSpacesCnt + spaceCntOffset;
                        const newIndent = indentUtils.generateIndent(newSpacesCnt, tabSize, insertSpaces);
                        if (newIndent !== originalIndent) {
                            textEdits.push({
                                range: new Range(i, 1, i, originalIndent.length + 1),
                                text: newIndent
                            });
                        }
                    }
                }
            }
        }
        if (textEdits.length > 0) {
            this.editor.pushUndoStop();
            const cmd = new AutoIndentOnPasteCommand(textEdits, this.editor.getSelection());
            this.editor.executeCommand('autoIndentOnPaste', cmd);
            this.editor.pushUndoStop();
        }
    }
    rangeContainsOnlyWhitespaceCharacters(model, range) {
        const lineContainsOnlyWhitespace = (content) => {
            return content.trim().length === 0;
        };
        let containsOnlyWhitespace = true;
        if (range.startLineNumber === range.endLineNumber) {
            const lineContent = model.getLineContent(range.startLineNumber);
            const linePart = lineContent.substring(range.startColumn - 1, range.endColumn - 1);
            containsOnlyWhitespace = lineContainsOnlyWhitespace(linePart);
        }
        else {
            for (let i = range.startLineNumber; i <= range.endLineNumber; i++) {
                const lineContent = model.getLineContent(i);
                if (i === range.startLineNumber) {
                    const linePart = lineContent.substring(range.startColumn - 1);
                    containsOnlyWhitespace = lineContainsOnlyWhitespace(linePart);
                }
                else if (i === range.endLineNumber) {
                    const linePart = lineContent.substring(0, range.endColumn - 1);
                    containsOnlyWhitespace = lineContainsOnlyWhitespace(linePart);
                }
                else {
                    containsOnlyWhitespace = model.getLineFirstNonWhitespaceColumn(i) === 0;
                }
                if (!containsOnlyWhitespace) {
                    break;
                }
            }
        }
        return containsOnlyWhitespace;
    }
    dispose() {
        this.callOnDispose.dispose();
        this.callOnModel.dispose();
    }
};
AutoIndentOnPaste = __decorate([
    __param(1, ILanguageConfigurationService)
], AutoIndentOnPaste);
export { AutoIndentOnPaste };
function isStartOrEndInString(model, range) {
    const isPositionInString = (position) => {
        const tokenType = getStandardTokenTypeAtPosition(model, position);
        return tokenType === 2 /* StandardTokenType.String */;
    };
    return isPositionInString(range.getStartPosition()) || isPositionInString(range.getEndPosition());
}
function getIndentationEditOperations(model, builder, tabSize, tabsToSpaces) {
    if (model.getLineCount() === 1 && model.getLineMaxColumn(1) === 1) {
        // Model is empty
        return;
    }
    let spaces = '';
    for (let i = 0; i < tabSize; i++) {
        spaces += ' ';
    }
    const spacesRegExp = new RegExp(spaces, 'gi');
    for (let lineNumber = 1, lineCount = model.getLineCount(); lineNumber <= lineCount; lineNumber++) {
        let lastIndentationColumn = model.getLineFirstNonWhitespaceColumn(lineNumber);
        if (lastIndentationColumn === 0) {
            lastIndentationColumn = model.getLineMaxColumn(lineNumber);
        }
        if (lastIndentationColumn === 1) {
            continue;
        }
        const originalIndentationRange = new Range(lineNumber, 1, lineNumber, lastIndentationColumn);
        const originalIndentation = model.getValueInRange(originalIndentationRange);
        const newIndentation = (tabsToSpaces
            ? originalIndentation.replace(/\t/ig, spaces)
            : originalIndentation.replace(spacesRegExp, '\t'));
        builder.addEditOperation(originalIndentationRange, newIndentation);
    }
}
export class IndentationToSpacesCommand {
    constructor(selection, tabSize) {
        this.selection = selection;
        this.tabSize = tabSize;
        this.selectionId = null;
    }
    getEditOperations(model, builder) {
        this.selectionId = builder.trackSelection(this.selection);
        getIndentationEditOperations(model, builder, this.tabSize, true);
    }
    computeCursorState(model, helper) {
        return helper.getTrackedSelection(this.selectionId);
    }
}
export class IndentationToTabsCommand {
    constructor(selection, tabSize) {
        this.selection = selection;
        this.tabSize = tabSize;
        this.selectionId = null;
    }
    getEditOperations(model, builder) {
        this.selectionId = builder.trackSelection(this.selection);
        getIndentationEditOperations(model, builder, this.tabSize, false);
    }
    computeCursorState(model, helper) {
        return helper.getTrackedSelection(this.selectionId);
    }
}
registerEditorContribution(AutoIndentOnPaste.ID, AutoIndentOnPaste, 2 /* EditorContributionInstantiation.BeforeFirstInteraction */);
registerEditorAction(IndentationToSpacesAction);
registerEditorAction(IndentationToTabsAction);
registerEditorAction(IndentUsingTabs);
registerEditorAction(IndentUsingSpaces);
registerEditorAction(ChangeTabDisplaySize);
registerEditorAction(DetectIndentation);
registerEditorAction(ReindentLinesAction);
registerEditorAction(ReindentSelectedLinesAction);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZW50YXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaW5kZW50YXRpb24vYnJvd3Nlci9pbmRlbnRhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdkUsT0FBTyxLQUFLLE9BQU8sTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RCxPQUFPLEtBQUssR0FBRyxNQUFNLG9CQUFvQixDQUFDO0FBQzFDLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBRTFGLE9BQU8sRUFBRSxZQUFZLEVBQW1ELG9CQUFvQixFQUFFLDBCQUEwQixFQUFvQixNQUFNLHNDQUFzQyxDQUFDO0FBQ3pMLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUl4RSxPQUFPLEVBQVUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFHOUQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFHekUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLGlCQUFpQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDbEcsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFHM0csT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3JFLE9BQU8sS0FBSyxXQUFXLE1BQU0sMEJBQTBCLENBQUM7QUFFeEQsTUFBTSxPQUFPLHlCQUEwQixTQUFRLFlBQVk7YUFDbkMsT0FBRSxHQUFHLG1DQUFtQyxDQUFDO0lBRWhF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