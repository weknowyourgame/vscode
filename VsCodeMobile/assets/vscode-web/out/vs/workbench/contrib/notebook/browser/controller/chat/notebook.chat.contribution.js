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
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { codiconsLibrary } from '../../../../../../base/common/codiconsLibrary.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../../base/common/network.js';
import { Range } from '../../../../../../editor/common/core/range.js';
import { ILanguageFeaturesService } from '../../../../../../editor/common/services/languageFeatures.js';
import { localize } from '../../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IQuickInputService } from '../../../../../../platform/quickinput/common/quickInput.js';
import { registerWorkbenchContribution2 } from '../../../../../common/contributions.js';
import { IEditorService } from '../../../../../services/editor/common/editorService.js';
import { IChatWidgetService } from '../../../../chat/browser/chat.js';
import { IChatContextPickService } from '../../../../chat/browser/chatContextPickService.js';
import { ChatDynamicVariableModel } from '../../../../chat/browser/contrib/chatDynamicVariables.js';
import { computeCompletionRanges } from '../../../../chat/browser/contrib/chatInputCompletions.js';
import { IChatAgentService } from '../../../../chat/common/chatAgents.js';
import { ChatContextKeys } from '../../../../chat/common/chatContextKeys.js';
import { chatVariableLeader } from '../../../../chat/common/chatParserTypes.js';
import { ChatAgentLocation } from '../../../../chat/common/constants.js';
import { NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT, NOTEBOOK_CELL_OUTPUT_MIMETYPE } from '../../../common/notebookContextKeys.js';
import { INotebookKernelService } from '../../../common/notebookKernelService.js';
import { createNotebookOutputVariableEntry, NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST } from '../../contrib/chat/notebookChatUtils.js';
import { getNotebookEditorFromEditorPane } from '../../notebookBrowser.js';
import * as icons from '../../notebookIcons.js';
import { getOutputViewModelFromId } from '../cellOutputActions.js';
import { NOTEBOOK_ACTIONS_CATEGORY } from '../coreActions.js';
import './cellChatActions.js';
import { CTX_NOTEBOOK_CHAT_HAS_AGENT } from './notebookChatContext.js';
const NotebookKernelVariableKey = 'kernelVariable';
let NotebookChatContribution = class NotebookChatContribution extends Disposable {
    static { this.ID = 'workbench.contrib.notebookChatContribution'; }
    constructor(contextKeyService, chatAgentService, editorService, chatWidgetService, notebookKernelService, languageFeaturesService, chatContextPickService) {
        super();
        this.editorService = editorService;
        this.chatWidgetService = chatWidgetService;
        this.notebookKernelService = notebookKernelService;
        this.languageFeaturesService = languageFeaturesService;
        this._register(chatContextPickService.registerChatContextItem(new KernelVariableContextPicker(this.editorService, this.notebookKernelService)));
        this._ctxHasProvider = CTX_NOTEBOOK_CHAT_HAS_AGENT.bindTo(contextKeyService);
        const updateNotebookAgentStatus = () => {
            const hasNotebookAgent = Boolean(chatAgentService.getDefaultAgent(ChatAgentLocation.Notebook));
            this._ctxHasProvider.set(hasNotebookAgent);
        };
        updateNotebookAgentStatus();
        this._register(chatAgentService.onDidChangeAgents(updateNotebookAgentStatus));
        this._register(this.languageFeaturesService.completionProvider.register({ scheme: Schemas.vscodeChatInput, hasAccessToAllModels: true }, {
            _debugDisplayName: 'chatKernelDynamicCompletions',
            triggerCharacters: [chatVariableLeader],
            provideCompletionItems: async (model, position, _context, token) => {
                const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
                if (!widget || !widget.supportsFileReferences) {
                    return null;
                }
                if (widget.location !== ChatAgentLocation.Notebook) {
                    return null;
                }
                const variableNameDef = new RegExp(`${chatVariableLeader}\\w*`, 'g');
                const range = computeCompletionRanges(model, position, variableNameDef, true);
                if (!range) {
                    return null;
                }
                const result = { suggestions: [] };
                const afterRange = new Range(position.lineNumber, range.replace.startColumn, position.lineNumber, range.replace.startColumn + `${chatVariableLeader}${NotebookKernelVariableKey}:`.length);
                result.suggestions.push({
                    label: `${chatVariableLeader}${NotebookKernelVariableKey}`,
                    insertText: `${chatVariableLeader}${NotebookKernelVariableKey}:`,
                    detail: localize('pickKernelVariableLabel', "Pick a variable from the kernel"),
                    range,
                    kind: 18 /* CompletionItemKind.Text */,
                    command: { id: SelectAndInsertKernelVariableAction.ID, title: SelectAndInsertKernelVariableAction.ID, arguments: [{ widget, range: afterRange }] },
                    sortText: 'z'
                });
                await this.addKernelVariableCompletion(widget, result, range, token);
                return result;
            }
        }));
        // output context
        NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT.bindTo(contextKeyService).set(NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST);
    }
    async addKernelVariableCompletion(widget, result, info, token) {
        let pattern;
        if (info.varWord?.word && info.varWord.word.startsWith(chatVariableLeader)) {
            pattern = info.varWord.word.toLowerCase().slice(1);
        }
        const notebook = getNotebookEditorFromEditorPane(this.editorService.activeEditorPane)?.getViewModel()?.notebookDocument;
        if (!notebook) {
            return;
        }
        const selectedKernel = this.notebookKernelService.getMatchingKernel(notebook).selected;
        const hasVariableProvider = selectedKernel?.hasVariableProvider;
        if (!hasVariableProvider) {
            return;
        }
        const variables = selectedKernel.provideVariables(notebook.uri, undefined, 'named', 0, CancellationToken.None);
        for await (const variable of variables) {
            if (pattern && !variable.name.toLowerCase().includes(pattern)) {
                continue;
            }
            result.suggestions.push({
                label: { label: variable.name, description: variable.type },
                insertText: `${chatVariableLeader}${NotebookKernelVariableKey}:${variable.name} `,
                filterText: `${chatVariableLeader}${variable.name}`,
                range: info,
                kind: 4 /* CompletionItemKind.Variable */,
                sortText: 'z',
                command: { id: SelectAndInsertKernelVariableAction.ID, title: SelectAndInsertKernelVariableAction.ID, arguments: [{ widget, range: info.insert, variable: variable.name }] },
                detail: variable.type,
                documentation: variable.value,
            });
        }
    }
};
NotebookChatContribution = __decorate([
    __param(0, IContextKeyService),
    __param(1, IChatAgentService),
    __param(2, IEditorService),
    __param(3, IChatWidgetService),
    __param(4, INotebookKernelService),
    __param(5, ILanguageFeaturesService),
    __param(6, IChatContextPickService)
], NotebookChatContribution);
export class SelectAndInsertKernelVariableAction extends Action2 {
    constructor() {
        super({
            id: SelectAndInsertKernelVariableAction.ID,
            title: '' // not displayed
        });
    }
    static { this.ID = 'notebook.chat.selectAndInsertKernelVariable'; }
    async run(accessor, ...args) {
        const editorService = accessor.get(IEditorService);
        const notebookKernelService = accessor.get(INotebookKernelService);
        const quickInputService = accessor.get(IQuickInputService);
        const notebook = getNotebookEditorFromEditorPane(editorService.activeEditorPane)?.getViewModel()?.notebookDocument;
        if (!notebook) {
            return;
        }
        const context = args[0];
        if (!context || !('widget' in context) || !('range' in context)) {
            return;
        }
        const widget = context.widget;
        const range = context.range;
        const variable = context.variable;
        if (variable !== undefined) {
            this.addVariableReference(widget, variable, range, false);
            return;
        }
        const selectedKernel = notebookKernelService.getMatchingKernel(notebook).selected;
        const hasVariableProvider = selectedKernel?.hasVariableProvider;
        if (!hasVariableProvider) {
            return;
        }
        const variables = selectedKernel.provideVariables(notebook.uri, undefined, 'named', 0, CancellationToken.None);
        const quickPickItems = [];
        for await (const variable of variables) {
            quickPickItems.push({
                label: variable.name,
                description: variable.value,
                detail: variable.type,
            });
        }
        const placeHolder = quickPickItems.length > 0
            ? localize('selectKernelVariablePlaceholder', "Select a kernel variable")
            : localize('noKernelVariables', "No kernel variables found");
        const pickedVariable = await quickInputService.pick(quickPickItems, { placeHolder });
        if (!pickedVariable) {
            return;
        }
        this.addVariableReference(widget, pickedVariable.label, range, true);
    }
    addVariableReference(widget, variableName, range, updateText) {
        if (range) {
            const text = `#kernelVariable:${variableName}`;
            if (updateText) {
                const editor = widget.inputEditor;
                const success = editor.executeEdits('chatInsertFile', [{ range, text: text + ' ' }]);
                if (!success) {
                    return;
                }
            }
            widget.getContrib(ChatDynamicVariableModel.ID)?.addReference({
                id: 'vscode.notebook.variable',
                range: { startLineNumber: range.startLineNumber, startColumn: range.startColumn, endLineNumber: range.endLineNumber, endColumn: range.startColumn + text.length },
                data: variableName,
                fullName: variableName,
                icon: codiconsLibrary.variable,
            });
        }
        else {
            widget.attachmentModel.addContext({
                id: 'vscode.notebook.variable',
                name: variableName,
                value: variableName,
                icon: codiconsLibrary.variable,
                kind: 'generic'
            });
        }
    }
}
let KernelVariableContextPicker = class KernelVariableContextPicker {
    constructor(editorService, notebookKernelService) {
        this.editorService = editorService;
        this.notebookKernelService = notebookKernelService;
        this.type = 'pickerPick';
        this.label = localize('chatContext.notebook.kernelVariable', 'Kernel Variable...');
        this.icon = Codicon.serverEnvironment;
    }
    isEnabled(widget) {
        return widget.location === ChatAgentLocation.Notebook && Boolean(getNotebookEditorFromEditorPane(this.editorService.activeEditorPane)?.getViewModel()?.notebookDocument);
    }
    asPicker() {
        const picks = (async () => {
            const notebook = getNotebookEditorFromEditorPane(this.editorService.activeEditorPane)?.getViewModel()?.notebookDocument;
            if (!notebook) {
                return [];
            }
            const selectedKernel = this.notebookKernelService.getMatchingKernel(notebook).selected;
            const hasVariableProvider = selectedKernel?.hasVariableProvider;
            if (!hasVariableProvider) {
                return [];
            }
            const variables = selectedKernel.provideVariables(notebook.uri, undefined, 'named', 0, CancellationToken.None);
            const result = [];
            for await (const variable of variables) {
                result.push({
                    label: variable.name,
                    description: variable.value,
                    asAttachment: () => {
                        return {
                            kind: 'generic',
                            id: 'vscode.notebook.variable',
                            name: variable.name,
                            value: variable.value,
                            icon: codiconsLibrary.variable,
                        };
                    },
                });
            }
            return result;
        })();
        return {
            placeholder: localize('chatContext.notebook.kernelVariable.placeholder', 'Select a kernel variable'),
            picks
        };
    }
};
KernelVariableContextPicker = __decorate([
    __param(0, IEditorService),
    __param(1, INotebookKernelService)
], KernelVariableContextPicker);
registerAction2(class AddCellOutputToChatAction extends Action2 {
    constructor() {
        super({
            id: 'notebook.cellOutput.addToChat',
            title: localize('notebookActions.addOutputToChat', "Add Cell Output to Chat"),
            menu: {
                id: MenuId.NotebookOutputToolbar,
                when: ContextKeyExpr.and(NOTEBOOK_CELL_HAS_OUTPUTS, ContextKeyExpr.in(NOTEBOOK_CELL_OUTPUT_MIMETYPE.key, NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT.key)),
                order: 10,
                group: 'notebook_chat_actions'
            },
            category: NOTEBOOK_ACTIONS_CATEGORY,
            icon: icons.copyIcon,
            precondition: ChatContextKeys.enabled
        });
    }
    getNoteboookEditor(editorService, outputContext) {
        if (outputContext && 'notebookEditor' in outputContext) {
            return outputContext.notebookEditor;
        }
        return getNotebookEditorFromEditorPane(editorService.activeEditorPane);
    }
    async run(accessor, outputContext) {
        const notebookEditor = this.getNoteboookEditor(accessor.get(IEditorService), outputContext);
        if (!notebookEditor) {
            return;
        }
        let outputViewModel;
        if (outputContext && 'outputId' in outputContext && typeof outputContext.outputId === 'string') {
            outputViewModel = getOutputViewModelFromId(outputContext.outputId, notebookEditor);
        }
        else if (outputContext && 'outputViewModel' in outputContext) {
            outputViewModel = outputContext.outputViewModel;
        }
        if (!outputViewModel) {
            // not able to find the output from the provided context, use the active cell
            const activeCell = notebookEditor.getActiveCell();
            if (!activeCell) {
                return;
            }
            if (activeCell.focusedOutputId !== undefined) {
                outputViewModel = activeCell.outputsViewModels.find(output => {
                    return output.model.outputId === activeCell.focusedOutputId;
                });
            }
            else {
                outputViewModel = activeCell.outputsViewModels.find(output => output.pickedMimeType?.isTrusted);
            }
        }
        if (!outputViewModel) {
            return;
        }
        const mimeType = outputViewModel.pickedMimeType?.mimeType;
        const chatWidgetService = accessor.get(IChatWidgetService);
        const widget = await chatWidgetService.revealWidget();
        if (widget && mimeType && NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST.includes(mimeType)) {
            const entry = createNotebookOutputVariableEntry(outputViewModel, mimeType, notebookEditor);
            if (!entry) {
                return;
            }
            widget.attachmentModel.addContext(entry);
            (await chatWidgetService.revealWidget())?.focusInput();
        }
    }
});
registerAction2(SelectAndInsertKernelVariableAction);
registerWorkbenchContribution2(NotebookChatContribution.ID, NotebookChatContribution, 2 /* WorkbenchPhase.BlockRestore */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2suY2hhdC5jb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svYnJvd3Nlci9jb250cm9sbGVyL2NoYXQvbm90ZWJvb2suY2hhdC5jb250cmlidXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDbEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNuRixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDeEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRW5FLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUl0RSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUN4RyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDcEQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDeEcsT0FBTyxFQUFFLGNBQWMsRUFBZSxrQkFBa0IsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRTdILE9BQU8sRUFBRSxrQkFBa0IsRUFBa0IsTUFBTSw0REFBNEQsQ0FBQztBQUNoSCxPQUFPLEVBQTBCLDhCQUE4QixFQUFrQixNQUFNLHdDQUF3QyxDQUFDO0FBQ2hJLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUN4RixPQUFPLEVBQWUsa0JBQWtCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNuRixPQUFP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