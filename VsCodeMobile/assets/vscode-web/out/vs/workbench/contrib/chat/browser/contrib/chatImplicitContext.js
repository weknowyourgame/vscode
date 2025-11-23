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
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { autorun } from '../../../../../base/common/observable.js';
import { basename, isEqual } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { getCodeEditor } from '../../../../../editor/browser/editorBrowser.js';
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { getNotebookEditorFromEditorPane } from '../../../notebook/browser/notebookBrowser.js';
import { WebviewInput } from '../../../webviewPanel/browser/webviewEditorInput.js';
import { IChatEditingService } from '../../common/chatEditingService.js';
import { IChatService } from '../../common/chatService.js';
import { isStringImplicitContextValue } from '../../common/chatVariableEntries.js';
import { ChatAgentLocation } from '../../common/constants.js';
import { ILanguageModelIgnoredFilesService } from '../../common/ignoredFiles.js';
import { getPromptsTypeForLanguageId } from '../../common/promptSyntax/promptTypes.js';
import { IChatWidgetService } from '../chat.js';
import { IChatContextService } from '../chatContextService.js';
let ChatImplicitContextContribution = class ChatImplicitContextContribution extends Disposable {
    static { this.ID = 'chat.implicitContext'; }
    constructor(codeEditorService, editorService, chatWidgetService, chatService, chatEditingService, configurationService, ignoredFilesService, chatContextService) {
        super();
        this.codeEditorService = codeEditorService;
        this.editorService = editorService;
        this.chatWidgetService = chatWidgetService;
        this.chatService = chatService;
        this.chatEditingService = chatEditingService;
        this.configurationService = configurationService;
        this.ignoredFilesService = ignoredFilesService;
        this.chatContextService = chatContextService;
        this._currentCancelTokenSource = this._register(new MutableDisposable());
        this._implicitContextEnablement = this.configurationService.getValue('chat.implicitContext.enabled');
        const activeEditorDisposables = this._register(new DisposableStore());
        this._register(Event.runAndSubscribe(editorService.onDidActiveEditorChange, (() => {
            activeEditorDisposables.clear();
            const codeEditor = this.findActiveCodeEditor();
            if (codeEditor) {
                activeEditorDisposables.add(Event.debounce(Event.any(codeEditor.onDidChangeModel, codeEditor.onDidChangeModelLanguage, codeEditor.onDidChangeCursorSelection, codeEditor.onDidScrollChange), () => undefined, 500)(() => this.updateImplicitContext()));
            }
            const notebookEditor = this.findActiveNotebookEditor();
            if (notebookEditor) {
                const activeCellDisposables = activeEditorDisposables.add(new DisposableStore());
                activeEditorDisposables.add(notebookEditor.onDidChangeActiveCell(() => {
                    activeCellDisposables.clear();
                    const codeEditor = this.codeEditorService.getActiveCodeEditor();
                    if (codeEditor && codeEditor.getModel()?.uri.scheme === Schemas.vscodeNotebookCell) {
                        activeCellDisposables.add(Event.debounce(Event.any(codeEditor.onDidChangeModel, codeEditor.onDidChangeCursorSelection, codeEditor.onDidScrollChange), () => undefined, 500)(() => this.updateImplicitContext()));
                    }
                }));
                activeEditorDisposables.add(Event.debounce(Event.any(notebookEditor.onDidChangeModel, notebookEditor.onDidChangeActiveCell), () => undefined, 500)(() => this.updateImplicitContext()));
            }
            const webviewEditor = this.findActiveWebviewEditor();
            if (webviewEditor) {
                activeEditorDisposables.add(Event.debounce(webviewEditor.input.webview.onMessage, () => undefined, 500)(() => {
                    this.updateImplicitContext();
                }));
            }
            this.updateImplicitContext();
        })));
        this._register(autorun((reader) => {
            this.chatEditingService.editingSessionsObs.read(reader);
            this.updateImplicitContext();
        }));
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('chat.implicitContext.enabled')) {
                this._implicitContextEnablement = this.configurationService.getValue('chat.implicitContext.enabled');
                this.updateImplicitContext();
            }
        }));
        this._register(this.chatService.onDidSubmitRequest(({ chatSessionResource }) => {
            const widget = this.chatWidgetService.getWidgetBySessionResource(chatSessionResource);
            if (!widget?.input.implicitContext) {
                return;
            }
            if (this._implicitContextEnablement[widget.location] === 'first' && widget.viewModel?.getItems().length !== 0) {
                widget.input.implicitContext.setValue(undefined, false, undefined);
            }
        }));
        this._register(this.chatWidgetService.onDidAddWidget(async (widget) => {
            await this.updateImplicitContext(widget);
        }));
    }
    findActiveCodeEditor() {
        const codeEditor = this.codeEditorService.getActiveCodeEditor();
        if (codeEditor) {
            const model = codeEditor.getModel();
            if (model?.uri.scheme === Schemas.vscodeNotebookCell) {
                return undefined;
            }
            if (model) {
                return codeEditor;
            }
        }
        for (const codeOrDiffEditor of this.editorService.getVisibleTextEditorControls(0 /* EditorsOrder.MOST_RECENTLY_ACTIVE */)) {
            const codeEditor = getCodeEditor(codeOrDiffEditor);
            if (!codeEditor) {
                continue;
            }
            const model = codeEditor.getModel();
            if (model) {
                return codeEditor;
            }
        }
        return undefined;
    }
    findActiveWebviewEditor() {
        const activeEditorPane = this.editorService.activeEditorPane;
        if (activeEditorPane?.input instanceof WebviewInput) {
            return activeEditorPane;
        }
        return undefined;
    }
    findActiveNotebookEditor() {
        return getNotebookEditorFromEditorPane(this.editorService.activeEditorPane);
    }
    async updateImplicitContext(updateWidget) {
        const cancelTokenSource = this._currentCancelTokenSource.value = new CancellationTokenSource();
        const codeEditor = this.findActiveCodeEditor();
        const model = codeEditor?.getModel();
        const selection = codeEditor?.getSelection();
        let newValue;
        let isSelection = false;
        let languageId;
        if (model) {
            languageId = model.getLanguageId();
            if (selection && !selection.isEmpty()) {
                newValue = { uri: model.uri, range: selection };
                isSelection = true;
            }
            else {
                if (this.configurationService.getValue('chat.implicitContext.suggestedContext')) {
                    newValue = model.uri;
                }
                else {
                    const visibleRanges = codeEditor?.getVisibleRanges();
                    if (visibleRanges && visibleRanges.length > 0) {
                        // Merge visible ranges. Maybe the reference value could actually be an array of Locations?
                        // Something like a Location with an array of Ranges?
                        let range = visibleRanges[0];
                        visibleRanges.slice(1).forEach(r => {
                            range = range.plusRange(r);
                        });
                        newValue = { uri: model.uri, range };
                    }
                    else {
                        newValue = model.uri;
                    }
                }
            }
        }
        const notebookEditor = this.findActiveNotebookEditor();
        if (notebookEditor) {
            const activeCell = notebookEditor.getActiveCell();
            if (activeCell) {
                const codeEditor = this.codeEditorService.getActiveCodeEditor();
                const selection = codeEditor?.getSelection();
                const visibleRanges = codeEditor?.getVisibleRanges() || [];
                newValue = activeCell.uri;
                if (isEqual(codeEditor?.getModel()?.uri, activeCell.uri)) {
                    if (selection && !selection.isEmpty()) {
                        newValue = { uri: activeCell.uri, range: selection };
                        isSelection = true;
                    }
                    else if (visibleRanges.length > 0) {
                        // Merge visible ranges. Maybe the reference value could actually be an array of Locations?
                        // Something like a Location with an array of Ranges?
                        let range = visibleRanges[0];
                        visibleRanges.slice(1).forEach(r => {
                            range = range.plusRange(r);
                        });
                        newValue = { uri: activeCell.uri, range };
                    }
                }
            }
            else {
                newValue = notebookEditor.textModel?.uri;
            }
        }
        const webviewEditor = this.findActiveWebviewEditor();
        if (webviewEditor?.input?.resource) {
            const webviewContext = await this.chatContextService.contextForResource(webviewEditor.input.resource);
            if (webviewContext) {
                newValue = webviewContext;
            }
        }
        const uri = newValue instanceof URI ? newValue : (isStringImplicitContextValue(newValue) ? undefined : newValue?.uri);
        if (uri && (await this.ignoredFilesService.fileIsIgnored(uri, cancelTokenSource.token) ||
            uri.path.endsWith('.copilotmd'))) {
            newValue = undefined;
        }
        if (cancelTokenSource.token.isCancellationRequested) {
            return;
        }
        const isPromptFile = languageId && getPromptsTypeForLanguageId(languageId) !== undefined;
        const widgets = updateWidget ? [updateWidget] : [...this.chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Chat), ...this.chatWidgetService.getWidgetsByLocations(ChatAgentLocation.EditorInline)];
        for (const widget of widgets) {
            if (!widget.input.implicitContext) {
                continue;
            }
            const setting = this._implicitContextEnablement[widget.location];
            const isFirstInteraction = widget.viewModel?.getItems().length === 0;
            if ((setting === 'always' || setting === 'first' && isFirstInteraction) && !isPromptFile) { // disable implicit context for prompt files
                widget.input.implicitContext.setValue(newValue, isSelection, languageId);
            }
            else {
                widget.input.implicitContext.setValue(undefined, false, undefined);
            }
        }
    }
};
ChatImplicitContextContribution = __decorate([
    __param(0, ICodeEditorService),
    __param(1, IEditorService),
    __param(2, IChatWidgetService),
    __param(3, IChatService),
    __param(4, IChatEditingService),
    __param(5, IConfigurationService),
    __param(6, ILanguageModelIgnoredFilesService),
    __param(7, IChatContextService)
], ChatImplicitContextContribution);
export { ChatImplicitContextContribution };
export class ChatImplicitContext extends Disposable {
    constructor() {
        super(...arguments);
        this.kind = 'implicit';
        this.isFile = true;
        this._isSelection = false;
        this._onDidChangeValue = this._register(new Emitter());
        this.onDidChangeValue = this._onDidChangeValue.event;
        this._enabled = true;
    }
    get id() {
        if (URI.isUri(this.value)) {
            return 'vscode.implicit.file';
        }
        else if (isStringImplicitContextValue(this.value)) {
            return 'vscode.implicit.string';
        }
        else if (this.value) {
            if (this._isSelection) {
                return 'vscode.implicit.selection';
            }
            else {
                return 'vscode.implicit.viewport';
            }
        }
        else {
            return 'vscode.implicit';
        }
    }
    get name() {
        if (URI.isUri(this.value)) {
            return `file:${basename(this.value)}`;
        }
        else if (isStringImplicitContextValue(this.value)) {
            return this.value.name;
        }
        else if (this.value) {
            return `file:${basename(this.value.uri)}`;
        }
        else {
            return 'implicit';
        }
    }
    get modelDescription() {
        if (URI.isUri(this.value)) {
            return `User's active file`;
        }
        else if (isStringImplicitContextValue(this.value)) {
            return this.value.modelDescription ?? `User's active context from ${this.value.name}`;
        }
        else if (this._isSelection) {
            return `User's active selection`;
        }
        else {
            return `User's current visible code`;
        }
    }
    get isSelection() {
        return this._isSelection;
    }
    get value() {
        return this._value;
    }
    get enabled() {
        return this._enabled;
    }
    set enabled(value) {
        this._enabled = value;
        this._onDidChangeValue.fire();
    }
    get uri() {
        if (isStringImplicitContextValue(this.value)) {
            return this.value.uri;
        }
        return this._uri;
    }
    get icon() {
        if (isStringImplicitContextValue(this.value)) {
            return this.value.icon;
        }
        return undefined;
    }
    setValue(value, isSelection, languageId) {
        if (isStringImplicitContextValue(value)) {
            this._value = value;
        }
        else {
            this._value = value;
            this._uri = URI.isUri(value) ? value : value?.uri;
        }
        this._isSelection = isSelection;
        this._onDidChangeValue.fire();
    }
    toBaseEntries() {
        if (!this.value) {
            return [];
        }
        if (isStringImplicitContextValue(this.value)) {
            return [
                {
                    kind: 'string',
                    id: this.id,
                    name: this.name,
                    value: this.value.value ?? this.name,
                    modelDescription: this.modelDescription,
                    icon: this.value.icon,
                    uri: this.value.uri
                }
            ];
        }
        return [{
                kind: 'file',
                id: this.id,
                name: this.name,
                value: this.value,
                modelDescription: this.modelDescription,
            }];
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEltcGxpY2l0Q29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY29udHJpYi9jaGF0SW1wbGljaXRDb250ZXh0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDckUsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN6RyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFFNUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxhQUFhLEVBQWUsTUFBTSxnREFBZ0QsQ0FBQztBQUM1RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUVqRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUd0RyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDckYsT0FBTyxFQUFFLCtCQUErQixFQUFtQixNQUFNLDhDQUE4QyxDQUFDO0FBRWhILE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNuRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN6RSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1B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