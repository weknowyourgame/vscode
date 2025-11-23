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
var ChatInputPart_1;
import * as dom from '../../../../base/browser/dom.js';
import { addDisposableListener } from '../../../../base/browser/dom.js';
import { DEFAULT_FONT_FAMILY } from '../../../../base/browser/fonts.js';
import { hasModifierKeys } from '../../../../base/browser/keyboardEvent.js';
import { ActionViewItem } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import * as aria from '../../../../base/browser/ui/aria/aria.js';
import { Button, ButtonWithIcon } from '../../../../base/browser/ui/button/button.js';
import { createInstantHoverDelegate, getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { renderLabelWithIcons } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { equals as arraysEqual } from '../../../../base/common/arrays.js';
import { DeferredPromise, RunOnceScheduler } from '../../../../base/common/async.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter } from '../../../../base/common/event.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { ResourceSet } from '../../../../base/common/map.js';
import { Schemas } from '../../../../base/common/network.js';
import { autorun, derived, derivedOpts, observableValue } from '../../../../base/common/observable.js';
import { isMacintosh } from '../../../../base/common/platform.js';
import { isEqual } from '../../../../base/common/resources.js';
import { assertType } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { EditorExtensionsRegistry } from '../../../../editor/browser/editorExtensions.js';
import { CodeEditorWidget } from '../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { EditorOptions } from '../../../../editor/common/config/editorOptions.js';
import { isLocation } from '../../../../editor/common/languages.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { CopyPasteController } from '../../../../editor/contrib/dropOrPasteInto/browser/copyPasteController.js';
import { DropIntoEditorController } from '../../../../editor/contrib/dropOrPasteInto/browser/dropIntoEditorController.js';
import { ContentHoverController } from '../../../../editor/contrib/hover/browser/contentHoverController.js';
import { GlyphHoverController } from '../../../../editor/contrib/hover/browser/glyphHoverController.js';
import { LinkDetector } from '../../../../editor/contrib/links/browser/links.js';
import { SuggestController } from '../../../../editor/contrib/suggest/browser/suggestController.js';
import { localize } from '../../../../nls.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { MenuWorkbenchButtonBar } from '../../../../platform/actions/browser/buttonbar.js';
import { MenuWorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { MenuId, MenuItemAction } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { registerAndCreateHistoryNavigationContext } from '../../../../platform/history/browser/contextScopedHistoryWidget.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ISharedWebContentExtractorService } from '../../../../platform/webContentExtractor/common/webContentExtractor.js';
import { ResourceLabels } from '../../../browser/labels.js';
import { IWorkbenchAssignmentService } from '../../../services/assignment/common/assignmentService.js';
import { IChatEntitlementService } from '../../../services/chat/common/chatEntitlementService.js';
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { getSimpleCodeEditorWidgetOptions, getSimpleEditorOptions, setupSimpleEditorSelectionStyling } from '../../codeEditor/browser/simpleEditorOptions.js';
import { IChatAgentService } from '../common/chatAgents.js';
import { ChatContextKeys } from '../common/chatContextKeys.js';
import { ChatMode, IChatModeService } from '../common/chatModes.js';
import { IChatService } from '../common/chatService.js';
import { IChatSessionsService } from '../common/chatSessionsService.js';
import { ChatRequestVariableSet, isElementVariableEntry, isImageVariableEntry, isNotebookOutputVariableEntry, isPasteVariableEntry, isPromptFileVariableEntry, isPromptTextVariableEntry, isSCMHistoryItemChangeRangeVariableEntry, isSCMHistoryItemChangeVariableEntry, isSCMHistoryItemVariableEntry, isStringVariableEntry } from '../common/chatVariableEntries.js';
import { ChatHistoryNavigator } from '../common/chatWidgetHistoryService.js';
import { ChatConfiguration, ChatModeKind, validateChatMode } from '../common/constants.js';
import { ILanguageModelChatMetadata, ILanguageModelsService } from '../common/languageModels.js';
import { ILanguageModelToolsService } from '../common/languageModelToolsService.js';
import { ChatContinueInSessionActionItem, ContinueChatInSessionAction } from './actions/chatContinueInAction.js';
import { ChatOpenModelPickerActionId, ChatSessionPrimaryPickerAction, ChatSubmitAction, OpenModePickerAction } from './actions/chatExecuteActions.js';
import { ImplicitContextAttachmentWidget } from './attachments/implicitContextAttachment.js';
import { ChatAttachmentModel } from './chatAttachmentModel.js';
import { DefaultChatAttachmentWidget, ElementChatAttachmentWidget, FileAttachmentWidget, ImageAttachmentWidget, NotebookCellOutputChatAttachmentWidget, PasteAttachmentWidget, PromptFileAttachmentWidget, PromptTextAttachmentWidget, SCMHistoryItemAttachmentWidget, SCMHistoryItemChangeAttachmentWidget, SCMHistoryItemChangeRangeAttachmentWidget, TerminalCommandAttachmentWidget, ToolSetOrToolItemAttachmentWidget } from './chatAttachmentWidgets.js';
import { CollapsibleListPool } from './chatContentParts/chatReferencesContentPart.js';
import { ChatTodoListWidget } from './chatContentParts/chatTodoListWidget.js';
import { IChatContextService } from './chatContextService.js';
import { ChatDragAndDrop } from './chatDragAndDrop.js';
import { ChatEditingShowChangesAction, ViewPreviousEditsAction } from './chatEditing/chatEditingActions.js';
import { ChatFollowups } from './chatFollowups.js';
import { ChatSelectedTools } from './chatSelectedTools.js';
import { ChatSessionPickerActionItem } from './chatSessions/chatSessionPickerActionItem.js';
import { ChatImplicitContext } from './contrib/chatImplicitContext.js';
import { ChatRelatedFiles } from './contrib/chatInputRelatedFilesContrib.js';
import { resizeImage } from './imageUtils.js';
import { ModelPickerActionItem } from './modelPicker/modelPickerActionItem.js';
import { ModePickerActionItem } from './modelPicker/modePickerActionItem.js';
const $ = dom.$;
const INPUT_EDITOR_MAX_HEIGHT = 250;
let ChatInputPart = class ChatInputPart extends Disposable {
    static { ChatInputPart_1 = this; }
    static { this._counter = 0; }
    get attachmentModel() {
        return this._attachmentModel;
    }
    getAttachedContext(sessionResource) {
        const contextArr = new ChatRequestVariableSet();
        contextArr.add(...this.attachmentModel.attachments, ...this.chatContextService.getWorkspaceContextItems());
        return contextArr;
    }
    getAttachedAndImplicitContext(sessionResource) {
        const contextArr = this.getAttachedContext(sessionResource);
        if ((this.implicitContext?.enabled && this.implicitContext?.value) || (this.implicitContext && !URI.isUri(this.implicitContext.value) && this.configurationService.getValue('chat.implicitContext.suggestedContext'))) {
            const implicitChatVariables = this.implicitContext.toBaseEntries();
            contextArr.add(...implicitChatVariables);
        }
        return contextArr;
    }
    get implicitContext() {
        return this._implicitContext;
    }
    get relatedFiles() {
        return this._relatedFiles;
    }
    get inputPartHeight() {
        return this._inputPartHeight;
    }
    get followupsHeight() {
        return this._followupsHeight;
    }
    get editSessionWidgetHeight() {
        return this._editSessionWidgetHeight;
    }
    get todoListWidgetHeight() {
        return this.chatInputTodoListWidgetContainer.offsetHeight;
    }
    get attachmentsHeight() {
        return this.attachmentsContainer.offsetHeight + (this.attachmentsContainer.checkVisibility() ? 6 : 0);
    }
    get inputEditor() {
        return this._inputEditor;
    }
    get currentLanguageModel() {
        return this._currentLanguageModel?.identifier;
    }
    get selectedLanguageModel() {
        return this._currentLanguageModel;
    }
    get currentModeKind() {
        const mode = this._currentModeObservable.get();
        return mode.kind === ChatModeKind.Agent && !this.agentService.hasToolsAgent ?
            ChatModeKind.Edit :
            mode.kind;
    }
    get currentModeObs() {
        return this._currentModeObservable;
    }
    get currentModeInfo() {
        const mode = this._currentModeObservable.get();
        const modeId = mode.isBuiltin ? this.currentModeKind : 'custom';
        const modeInstructions = mode.modeInstructions?.get();
        return {
            kind: this.currentModeKind,
            isBuiltin: mode.isBuiltin,
            modeInstructions: modeInstructions ? {
                name: mode.name.get(),
                content: modeInstructions.content,
                toolReferences: this.toolService.toToolReferences(modeInstructions.toolReferences),
                metadata: modeInstructions.metadata,
            } : undefined,
            modeId: modeId,
            applyCodeBlockSuggestionId: undefined,
        };
    }
    get selectedElements() {
        const edits = [];
        const editsList = this._chatEditList?.object;
        const selectedElements = editsList?.getSelectedElements() ?? [];
        for (const element of selectedElements) {
            if (element.kind === 'reference' && URI.isUri(element.reference)) {
                edits.push(element.reference);
            }
        }
        return edits;
    }
    /**
     * The number of working set entries that the user actually wanted to attach.
     * This is less than or equal to {@link ChatInputPart.chatEditWorkingSetFiles}.
     */
    get attemptedWorkingSetEntriesCount() {
        return this._attemptedWorkingSetEntriesCount;
    }
    constructor(
    // private readonly editorOptions: ChatEditorOptions, // TODO this should be used
    location, options, styles, inline, modelService, instantiationService, contextKeyService, configurationService, keybindingService, accessibilityService, languageModelsService, logService, fileService, editorService, themeService, textModelResolverService, storageService, labelService, agentService, sharedWebExtracterService, experimentService, entitlementService, chatModeService, toolService, chatService, chatSessionsService, chatContextService) {
        super();
        this.location = location;
        this.options = options;
        this.inline = inline;
        this.modelService = modelService;
        this.instantiationService = instantiationService;
        this.contextKeyService = contextKeyService;
        this.configurationService = configurationService;
        this.keybindingService = keybindingService;
        this.accessibilityService = accessibilityService;
        this.languageModelsService = languageModelsService;
        this.logService = logService;
        this.fileService = fileService;
        this.editorService = editorService;
        this.themeService = themeService;
        this.textModelResolverService = textModelResolverService;
        this.storageService = storageService;
        this.labelService = labelService;
        this.agentService = agentService;
        this.sharedWebExtracterService = sharedWebExtracterService;
        this.experimentService = experimentService;
        this.entitlementService = entitlementService;
        this.chatModeService = chatModeService;
        this.toolService = toolService;
        this.chatService = chatService;
        this.chatSessionsService = chatSessionsService;
        this.chatContextService = chatContextService;
        this._workingSetCollapsed = true;
        this._chatInputTodoListWidget = this._register(new MutableDisposable());
        this._chatEditingTodosDisposables = this._register(new DisposableStore());
        this._onDidLoadInputState = this._register(new Emitter());
        this.onDidLoadInputState = this._onDidLoadInputState.event;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this._onDidFocus = this._register(new Emitter());
        this.onDidFocus = this._onDidFocus.event;
        this._onDidBlur = this._register(new Emitter());
        this.onDidBlur = this._onDidBlur.event;
        this._onDidChangeContext = this._register(new Emitter());
        this.onDidChangeContext = this._onDidChangeContext.event;
        this._onDidAcceptFollowup = this._register(new Emitter());
        this.onDidAcceptFollowup = this._onDidAcceptFollowup.event;
        this._onDidClickOverlay = this._register(new Emitter());
        this.onDidClickOverlay = this._onDidClickOverlay.event;
        this._indexOfLastAttachedContextDeletedWithKeyboard = -1;
        this._indexOfLastOpenedContext = -1;
        this._onDidChangeVisibility = this._register(new Emitter());
        this.inputEditorHeight = 0;
        this.followupsDisposables = this._register(new DisposableStore());
        this.overlayClickListener = this._register(new MutableDisposable());
        this.attachedContextDisposables = this._register(new MutableDisposable());
        this._inputPartHeight = 0;
        this._followupsHeight = 0;
        this._editSessionWidgetHeight = 0;
        // Disposables for model observation
        this._modelSyncDisposables = this._register(new DisposableStore());
        // Flag to prevent circular updates between view and model
        this._isSyncingToOrFromInputModel = false;
        this.chatSessionPickerWidgets = new Map();
        this._waitForPersistedLanguageModel = this._register(new MutableDisposable());
        this._onDidChangeCurrentLanguageModel = this._register(new Emitter());
        this._chatSessionOptionEmitters = new Map();
        this._onDidChangeCurrentChatMode = this._register(new Emitter());
        this.onDidChangeCurrentChatMode = this._onDidChangeCurrentChatMode.event;
        this.inputUri = URI.parse(`${Schemas.vscodeChatInput}:input-${ChatInputPart_1._counter++}`);
        this._workingSetLinesAddedSpan = new Lazy(() => dom.$('.working-set-lines-added'));
        this._workingSetLinesRemovedSpan = new Lazy(() => dom.$('.working-set-lines-removed'));
        this._chatEditsActionsDisposables = this._register(new DisposableStore());
        this._chatEditsDisposables = this._register(new DisposableStore());
        this._renderingChatEdits = this._register(new MutableDisposable());
        this._attemptedWorkingSetEntriesCount = 0;
        // Initialize debounced text sync scheduler
        this._syncTextDebounced = this._register(new RunOnceScheduler(() => this._syncInputStateToModel(), 150));
        this._contextResourceLabels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this._onDidChangeVisibility.event }));
        this._currentModeObservable = observableValue('currentMode', this.options.defaultMode ?? ChatMode.Agent);
        this._register(this.editorService.onDidActiveEditorChange(() => {
            this._indexOfLastOpenedContext = -1;
            this.refreshChatSessionPickers();
        }));
        this._attachmentModel = this._register(this.instantiationService.createInstance(ChatAttachmentModel));
        this._register(this._attachmentModel.onDidChange(() => this._syncInputStateToModel()));
        this.selectedToolsModel = this._register(this.instantiationService.createInstance(ChatSelectedTools, this.currentModeObs));
        this.dnd = this._register(this.instantiationService.createInstance(ChatDragAndDrop, () => this._widget, this._attachmentModel, styles));
        this.inputEditorMaxHeight = this.options.renderStyle === 'compact' ? INPUT_EDITOR_MAX_HEIGHT / 3 : INPUT_EDITOR_MAX_HEIGHT;
        this.inputEditorHasText = ChatContextKeys.inputHasText.bindTo(contextKeyService);
        this.chatCursorAtTop = ChatContextKeys.inputCursorAtTop.bindTo(contextKeyService);
        this.inputEditorHasFocus = ChatContextKeys.inputHasFocus.bindTo(contextKeyService);
        this.chatModeKindKey = ChatContextKeys.chatModeKind.bindTo(contextKeyService);
        this.withinEditSessionKey = ChatContextKeys.withinEditSessionDiff.bindTo(contextKeyService);
        this.filePartOfEditSessionKey = ChatContextKeys.filePartOfEditSession.bindTo(contextKeyService);
        this.chatSessionHasOptions = ChatContextKeys.chatSessionHasModels.bindTo(contextKeyService);
        const chatToolCount = ChatContextKeys.chatToolCount.bindTo(contextKeyService);
        this._register(autorun(reader => {
            let count = 0;
            const userSelectedTools = this.selectedToolsModel.userSelectedTools.read(reader);
            for (const key in userSelectedTools) {
                if (userSelectedTools[key] === true) {
                    count++;
                }
            }
            chatToolCount.set(count);
        }));
        this.history = this._register(this.instantiationService.createInstance(ChatHistoryNavigator, this.location));
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            const newOptions = {};
            if (e.affectsConfiguration("accessibility.verbosity.panelChat" /* AccessibilityVerbositySettingId.Chat */)) {
                newOptions.ariaLabel = this._getAriaLabel();
            }
            if (e.affectsConfiguration('editor.wordSegmenterLocales')) {
                newOptions.wordSegmenterLocales = this.configurationService.getValue('editor.wordSegmenterLocales');
            }
            if (e.affectsConfiguration('editor.autoClosingBrackets')) {
                newOptions.autoClosingBrackets = this.configurationService.getValue('editor.autoClosingBrackets');
            }
            if (e.affectsConfiguration('editor.autoClosingQuotes')) {
                newOptions.autoClosingQuotes = this.configurationService.getValue('editor.autoClosingQuotes');
            }
            if (e.affectsConfiguration('editor.autoSurround')) {
                newOptions.autoSurround = this.configurationService.getValue('editor.autoSurround');
            }
            this.inputEditor.updateOptions(newOptions);
        }));
        this._chatEditsListPool = this._register(this.instantiationService.createInstance(CollapsibleListPool, this._onDidChangeVisibility.event, MenuId.ChatEditingWidgetModifiedFilesToolbar, { verticalScrollMode: 3 /* ScrollbarVisibility.Visible */ }));
        this._hasFileAttachmentContextKey = ChatContextKeys.hasFileAttachments.bindTo(contextKeyService);
        this.initSelectedModel();
        this._register(this.languageModelsService.onDidChangeLanguageModels((vendor) => {
            // Remove vendor from cache since the models changed and what is stored is no longer valid
            // TODO @lramos15 - The cache should be less confusing since we have the LM Service cache + the view cache interacting weirdly
            this.storageService.store('chat.cachedLanguageModels', this.storageService.getObject('chat.cachedLanguageModels', -1 /* StorageScope.APPLICATION */, []).filter(m => !m.identifier.startsWith(vendor)), -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
            // We've changed models and the current one is no longer available. Select a new one
            const selectedModel = this._currentLanguageModel ? this.getModels().find(m => m.identifier === this._currentLanguageModel?.identifier) : undefined;
            const selectedModelNotAvailable = this._currentLanguageModel && (!selectedModel?.metadata.isUserSelectable);
            if (!this.currentLanguageModel || selectedModelNotAvailable) {
                this.setCurrentLanguageModelToDefault();
            }
        }));
        this._register(this.onDidChangeCurrentChatMode(() => {
            this.accessibilityService.alert(this._currentModeObservable.get().label.get());
            if (this._inputEditor) {
                this._inputEditor.updateOptions({ ariaLabel: this._getAriaLabel() });
            }
            if (this.implicitContext && this.configurationService.getValue('chat.implicitContext.suggestedContext')) {
                this.implicitContext.enabled = this._currentModeObservable.get() !== ChatMode.Agent;
            }
        }));
        this._register(this._onDidChangeCurrentLanguageModel.event(() => {
            if (this._currentLanguageModel?.metadata.name) {
                this.accessibilityService.alert(this._currentLanguageModel.metadata.name);
            }
            this._inputEditor?.updateOptions({ ariaLabel: this._getAriaLabel() });
        }));
        this._register(this.chatModeService.onDidChangeChatModes(() => this.validateCurrentChatMode()));
        this._register(autorun(r => {
            const mode = this._currentModeObservable.read(r);
            this.chatModeKindKey.set(mode.kind);
            const model = mode.model?.read(r);
            if (model) {
                this.switchModelByQualifiedName(model);
            }
        }));
        // Validate the initial mode - if Agent mode is set by default but disabled by policy, switch to Ask
        this.validateCurrentChatMode();
    }
    setIsWithinEditSession(inInsideDiff, isFilePartOfEditSession) {
        this.withinEditSessionKey.set(inInsideDiff);
        this.filePartOfEditSessionKey.set(isFilePartOfEditSession);
    }
    getSelectedModelStorageKey() {
        return `chat.currentLanguageModel.${this.location}`;
    }
    getSelectedModelIsDefaultStorageKey() {
        return `chat.currentLanguageModel.${this.location}.isDefault`;
    }
    initSelectedModel() {
        const persistedSelection = this.storageService.get(this.getSelectedModelStorageKey(), -1 /* StorageScope.APPLICATION */);
        const persistedAsDefault = this.storageService.getBoolean(this.getSelectedModelIsDefaultStorageKey(), -1 /* StorageScope.APPLICATION */, persistedSelection === 'copilot/gpt-4.1');
        if (persistedSelection) {
            const model = this.getModels().find(m => m.identifier === persistedSelection);
            if (model) {
                // Only restore the model if it wasn't the default at the time of storing or it is now the default
                if (!persistedAsDefault || model.metadata.isDefault) {
                    this.setCurrentLanguageModel(model);
                    this.checkModelSupported();
                }
            }
            else {
                this._waitForPersistedLanguageModel.value = this.languageModelsService.onDidChangeLanguageModels(e => {
                    const persistedModel = this.languageModelsService.lookupLanguageModel(persistedSelection);
                    if (persistedModel) {
                        this._waitForPersistedLanguageModel.clear();
                        // Only restore the model if it wasn't the default at the time of storing or it is now the default
                        if (!persistedAsDefault || persistedModel.isDefault) {
                            if (persistedModel.isUserSelectable) {
                                this.setCurrentLanguageModel({ metadata: persistedModel, identifier: persistedSelection });
                                this.checkModelSupported();
                            }
                        }
                    }
                    else {
                        this.setCurrentLanguageModelToDefault();
                    }
                });
            }
        }
        this._register(this._onDidChangeCurrentChatMode.event(() => {
            this.checkModelSupported();
        }));
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(ChatConfiguration.Edits2Enabled)) {
                this.checkModelSupported();
            }
        }));
    }
    setEditing(enabled) {
        this.currentlyEditingInputKey?.set(enabled);
    }
    switchModel(modelMetadata) {
        const models = this.getModels();
        const model = models.find(m => m.metadata.vendor === modelMetadata.vendor && m.metadata.id === modelMetadata.id && m.metadata.family === modelMetadata.family);
        if (model) {
            this.setCurrentLanguageModel(model);
        }
    }
    switchModelByQualifiedName(qualifiedModelName) {
        const models = this.getModels();
        const model = models.find(m => ILanguageModelChatMetadata.matchesQualifiedName(qualifiedModelName, m.metadata));
        if (model) {
            this.setCurrentLanguageModel(model);
            return true;
        }
        return false;
    }
    switchToNextModel() {
        const models = this.getModels();
        if (models.length > 0) {
            const currentIndex = models.findIndex(model => model.identifier === this._currentLanguageModel?.identifier);
            const nextIndex = (currentIndex + 1) % models.length;
            this.setCurrentLanguageModel(models[nextIndex]);
        }
    }
    openModelPicker() {
        this.modelWidget?.show();
    }
    openModePicker() {
        this.modeWidget?.show();
    }
    openChatSessionPicker() {
        // Open the first available picker widget
        const firstWidget = this.chatSessionPickerWidgets?.values()?.next().value;
        firstWidget?.show();
    }
    /**
     * Create picker widgets for all option groups available for the current session type.
     */
    createChatSessionPickerWidgets(action) {
        this._lastSessionPickerAction = action;
        // Helper to resolve chat session context
        const resolveChatSessionContext = () => {
            const sessionResource = this._widget?.viewModel?.model.sessionResource;
            if (!sessionResource) {
                return undefined;
            }
            return this.chatService.getChatSessionFromInternalUri(sessionResource);
        };
        // Get all option groups for the current session type
        const ctx = resolveChatSessionContext();
        const optionGroups = ctx ? this.chatSessionsService.getOptionGroupsForSessionType(ctx.chatSessionType) : undefined;
        if (!optionGroups || optionGroups.length === 0) {
            return [];
        }
        // Clear existing widgets
        this.disposeSessionPickerWidgets();
        // Create a widget for each option group in effect for this specific session
        const widgets = [];
        for (const optionGroup of optionGroups) {
            if (!ctx) {
                continue;
            }
            if (!this.chatSessionsService.getSessionOption(ctx.chatSessionResource, optionGroup.id)) {
                // This session does not have a value to contribute for this option group
                continue;
            }
            const initialItem = this.getCurrentOptionForGroup(optionGroup.id);
            const initialState = { group: optionGroup, item: initialItem };
            // Create delegate for this option group
            const itemDelegate = {
                getCurrentOption: () => this.getCurrentOptionForGroup(optionGroup.id),
                onDidChangeOption: this.getOrCreateOptionEmitter(optionGroup.id).event,
                setOption: (option) => {
                    const ctx = resolveChatSessionContext();
                    if (!ctx) {
                        return;
                    }
                    this.getOrCreateOptionEmitter(optionGroup.id).fire(option);
                    this.chatSessionsService.notifySessionOptionsChange(ctx.chatSessionResource, [{ optionId: optionGroup.id, value: option.id }]).catch(err => this.logService.error(`Failed to notify extension of ${optionGroup.id} change:`, err));
                },
                getAllOptions: () => {
                    const ctx = resolveChatSessionContext();
                    if (!ctx) {
                        return [];
                    }
                    const groups = this.chatSessionsService.getOptionGroupsForSessionType(ctx.chatSessionType);
                    const group = groups?.find(g => g.id === optionGroup.id);
                    return group?.items ?? [];
                }
            };
            const widget = this.instantiationService.createInstance(ChatSessionPickerActionItem, action, initialState, itemDelegate);
            this.chatSessionPickerWidgets.set(optionGroup.id, widget);
            widgets.push(widget);
        }
        return widgets;
    }
    /**
     * Set the input model reference for syncing input state
     */
    setInputModel(model) {
        this._inputModel = model;
        this._modelSyncDisposables.clear();
        if (!model) {
            return;
        }
        // Observe changes from model and sync to view
        this._modelSyncDisposables.add(autorun(reader => {
            const state = model.state.read(reader);
            this._syncFromModel(state);
        }));
    }
    /**
     * Sync from model to view (when model state changes)
     */
    _syncFromModel(state) {
        // Prevent circular updates
        if (this._isSyncingToOrFromInputModel) {
            return;
        }
        try {
            this._isSyncingToOrFromInputModel = true;
            // Sync mode
            if (state) {
                const currentMode = this._currentModeObservable.get();
                if (currentMode.id !== state.mode.id) {
                    this.setChatMode(state.mode.id, false);
                }
            }
            // Sync selected model
            if (state?.selectedModel) {
                if (!this._currentLanguageModel || this._currentLanguageModel.identifier !== state.selectedModel.identifier) {
                    this.setCurrentLanguageModel(state.selectedModel);
                }
            }
            // Sync attachments
            const currentAttachments = this._attachmentModel.attachments;
            if (!state) {
                this._attachmentModel.clear();
            }
            else if (!arraysEqual(currentAttachments, state.attachments)) {
                this._attachmentModel.clearAndSetContext(...state.attachments);
            }
            // Sync input text
            if (this._inputEditor) {
                this._inputEditor.setValue(state?.inputText || '');
                if (state?.selections.length) {
                    this._inputEditor.setSelections(state.selections);
                }
            }
            if (state) {
                this._widget?.contribs.forEach(contrib => {
                    contrib.setInputState?.(state.contrib);
                });
            }
        }
        finally {
            this._isSyncingToOrFromInputModel = false;
        }
    }
    /**
     * Sync current input state to the input model
     */
    _syncInputStateToModel() {
        if (!this._inputModel || this._isSyncingToOrFromInputModel) {
            return;
        }
        this._isSyncingToOrFromInputModel = true;
        this._inputModel.setState(this.getCurrentInputState());
        this._isSyncingToOrFromInputModel = false;
    }
    setCurrentLanguageModel(model) {
        this._currentLanguageModel = model;
        if (this.cachedDimensions) {
            // For quick chat and editor chat, relayout because the input may need to shrink to accomodate the model name
            this.layout(this.cachedDimensions.height, this.cachedDimensions.width);
        }
        // Store as global user preference (session-specific state is in the model's inputModel)
        this.storageService.store(this.getSelectedModelStorageKey(), model.identifier, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
        this.storageService.store(this.getSelectedModelIsDefaultStorageKey(), !!model.metadata.isDefault, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
        this._onDidChangeCurrentLanguageModel.fire(model);
        // Sync to model
        this._syncInputStateToModel();
    }
    checkModelSupported() {
        if (this._currentLanguageModel && !this.modelSupportedForDefaultAgent(this._currentLanguageModel)) {
            this.setCurrentLanguageModelToDefault();
        }
    }
    /**
     * By ID- prefer this method
     */
    setChatMode(mode, storeSelection = true) {
        if (!this.options.supportsChangingModes) {
            return;
        }
        const mode2 = this.chatModeService.findModeById(mode) ??
            this.chatModeService.findModeById(ChatModeKind.Agent) ??
            ChatMode.Ask;
        this.setChatMode2(mode2, storeSelection);
    }
    setChatMode2(mode, storeSelection = true) {
        if (!this.options.supportsChangingModes) {
            return;
        }
        this._currentModeObservable.set(mode, undefined);
        this._onDidChangeCurrentChatMode.fire();
        // Sync to model (mode is now persisted in the model's input state)
        this._syncInputStateToModel();
    }
    modelSupportedForDefaultAgent(model) {
        // Probably this logic could live in configuration on the agent, or somewhere else, if it gets more complex
        if (this.currentModeKind === ChatModeKind.Agent || (this.currentModeKind === ChatModeKind.Edit && this.configurationService.getValue(ChatConfiguration.Edits2Enabled))) {
            return ILanguageModelChatMetadata.suitableForAgentMode(model.metadata);
        }
        return true;
    }
    getModels() {
        const cachedModels = this.storageService.getObject('chat.cachedLanguageModels', -1 /* StorageScope.APPLICATION */, []);
        let models = this.languageModelsService.getLanguageModelIds()
            .map(modelId => ({ identifier: modelId, metadata: this.languageModelsService.lookupLanguageModel(modelId) }));
        if (models.length === 0 || models.some(m => m.metadata.isDefault) === false) {
            models = cachedModels;
        }
        else {
            this.storageService.store('chat.cachedLanguageModels', models, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
        }
        models.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
        return models.filter(entry => entry.metadata?.isUserSelectable && this.modelSupportedForDefaultAgent(entry));
    }
    setCurrentLanguageModelToDefault() {
        const allModels = this.getModels();
        const defaultModel = allModels.find(m => m.metadata.isDefault) || allModels.find(m => m.metadata.isUserSelectable);
        if (defaultModel) {
            this.setCurrentLanguageModel(defaultModel);
        }
    }
    /**
     * Get the current input state for history
     */
    getCurrentInputState() {
        const mode = this._currentModeObservable.get();
        const state = {
            inputText: this._inputEditor?.getValue() ?? '',
            attachments: this._attachmentModel.attachments,
            mode: {
                id: mode.id,
                kind: mode.kind
            },
            selectedModel: this._currentLanguageModel,
            selections: this._inputEditor?.getSelections() || [],
            contrib: {},
        };
        for (const contrib of this._widget?.contribs || Iterable.empty()) {
            contrib.getInputState?.(state.contrib);
        }
        return state;
    }
    _getAriaLabel() {
        const verbose = this.configurationService.getValue("accessibility.verbosity.panelChat" /* AccessibilityVerbositySettingId.Chat */);
        let kbLabel;
        if (verbose) {
            kbLabel = this.keybindingService.lookupKeybinding("editor.action.accessibilityHelp" /* AccessibilityCommandId.OpenAccessibilityHelp */)?.getLabel();
        }
        const mode = this._currentModeObservable.get();
        // Include model information if available
        const modelName = this._currentLanguageModel?.metadata.name;
        const modelInfo = modelName ? localize('chatInput.model', ", {0}. ", modelName) : '';
        let modeLabel = '';
        if (!mode.isBuiltin) {
            const mode = this.currentModeObs.get();
            modeLabel = localize('chatInput.mode.custom', "({0}), {1}", mode.label.get(), mode.description.get());
        }
        else {
            switch (this.currentModeKind) {
                case ChatModeKind.Agent:
                    modeLabel = localize('chatInput.mode.agent', "(Agent), edit files in your workspace.");
                    break;
                case ChatModeKind.Edit:
                    modeLabel = localize('chatInput.mode.edit', "(Edit), edit files in your workspace.");
                    break;
                case ChatModeKind.Ask:
                default:
                    modeLabel = localize('chatInput.mode.ask', "(Ask), ask questions or type / for topics.");
                    break;
            }
        }
        if (verbose) {
            return kbLabel
                ? localize('actions.chat.accessibiltyHelp', "Chat Input {0}{1} Press Enter to send out the request. Use {2} for Chat Accessibility Help.", modeLabel, modelInfo, kbLabel)
                : localize('chatInput.accessibilityHelpNoKb', "Chat Input {0}{1} Press Enter to send out the request. Use the Chat Accessibility Help command for more information.", modeLabel, modelInfo);
        }
        else {
            return localize('chatInput.accessibilityHelp', "Chat Input {0}{1}.", modeLabel, modelInfo);
        }
    }
    validateCurrentChatMode() {
        const currentMode = this._currentModeObservable.get();
        const validMode = this.chatModeService.findModeById(currentMode.id);
        const isAgentModeEnabled = this.configurationService.getValue(ChatConfiguration.AgentEnabled);
        if (!validMode) {
            this.setChatMode(isAgentModeEnabled ? ChatModeKind.Agent : ChatModeKind.Ask);
            return;
        }
        if (currentMode.kind === ChatModeKind.Agent && !isAgentModeEnabled) {
            this.setChatMode(ChatModeKind.Ask);
            return;
        }
    }
    initForNewChatModel(state, chatSessionIsEmpty) {
        this.selectedToolsModel.resetSessionEnablementState();
        // TODO@roblourens This is for an experiment which will be obsolete in a month or two and can then be removed.
        if (chatSessionIsEmpty) {
            const storageKey = this.getDefaultModeExperimentStorageKey();
            const hasSetDefaultMode = this.storageService.getBoolean(storageKey, 1 /* StorageScope.WORKSPACE */, false);
            if (!hasSetDefaultMode) {
                const isAnonymous = this.entitlementService.anonymous;
                this.experimentService.getTreatment('chat.defaultMode')
                    .then((defaultModeTreatment => {
                    if (isAnonymous) {
                        // be deterministic for anonymous users
                        // to support agentic flows with default
                        // model.
                        defaultModeTreatment = ChatModeKind.Agent;
                    }
                    if (typeof defaultModeTreatment === 'string') {
                        this.storageService.store(storageKey, true, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
                        const defaultMode = validateChatMode(defaultModeTreatment);
                        if (defaultMode) {
                            this.logService.trace(`Applying default mode from experiment: ${defaultMode}`);
                            this.setChatMode(defaultMode, false);
                            this.checkModelSupported();
                        }
                    }
                }));
            }
        }
    }
    getDefaultModeExperimentStorageKey() {
        const tag = this.options.widgetViewKindTag;
        return `chat.${tag}.hasSetDefaultModeByExperiment`;
    }
    logInputHistory() {
        const historyStr = this.history.values.map(entry => JSON.stringify(entry)).join('\n');
        this.logService.info(`[${this.location}] Chat input history:`, historyStr);
    }
    setVisible(visible) {
        this._onDidChangeVisibility.fire(visible);
    }
    /** If consumers are busy generating the chat input, returns the promise resolved when they finish */
    get generating() {
        return this._generating?.defer.p;
    }
    /** Disables the input submissions buttons until the disposable is disposed. */
    startGenerating() {
        this.logService.trace('ChatWidget#startGenerating');
        if (this._generating) {
            this._generating.rc++;
        }
        else {
            this._generating = { rc: 1, defer: new DeferredPromise() };
        }
        return toDisposable(() => {
            this.logService.trace('ChatWidget#doneGenerating');
            if (this._generating && !--this._generating.rc) {
                this._generating.defer.complete();
                this._generating = undefined;
            }
        });
    }
    get element() {
        return this.container;
    }
    async showPreviousValue() {
        if (this.history.isAtStart()) {
            return;
        }
        const state = this.getCurrentInputState();
        if (state.inputText || state.attachments.length) {
            this.history.overlay(state);
        }
        this.navigateHistory(true);
    }
    async showNextValue() {
        if (this.history.isAtEnd()) {
            return;
        }
        const state = this.getCurrentInputState();
        if (state.inputText || state.attachments.length) {
            this.history.overlay(state);
        }
        this.navigateHistory(false);
    }
    async navigateHistory(previous) {
        const historyEntry = previous ?
            this.history.previous() : this.history.next();
        let historyAttachments = historyEntry?.attachments ?? [];
        // Check for images in history to restore the value.
        if (historyAttachments.length > 0) {
            historyAttachments = (await Promise.all(historyAttachments.map(async (attachment) => {
                if (isImageVariableEntry(attachment) && attachment.references?.length && URI.isUri(attachment.references[0].reference)) {
                    const currReference = attachment.references[0].reference;
                    try {
                        const imageBinary = currReference.toString(true).startsWith('http') ? await this.sharedWebExtracterService.readImage(currReference, CancellationToken.None) : (await this.fileService.readFile(currReference)).value;
                        if (!imageBinary) {
                            return undefined;
                        }
                        const newAttachment = { ...attachment };
                        newAttachment.value = (isImageVariableEntry(attachment) && attachment.isPasted) ? imageBinary.buffer : await resizeImage(imageBinary.buffer); // if pasted image, we do not need to resize.
                        return newAttachment;
                    }
                    catch (err) {
                        this.logService.error('Failed to fetch and reference.', err);
                        return undefined;
                    }
                }
                return attachment;
            }))).filter(attachment => attachment !== undefined);
        }
        this._attachmentModel.clearAndSetContext(...historyAttachments);
        const inputText = historyEntry?.inputText ?? '';
        const contribData = historyEntry?.contrib ?? {};
        aria.status(inputText);
        this.setValue(inputText, true);
        this._widget?.contribs.forEach(contrib => {
            contrib.setInputState?.(contribData);
        });
        this._onDidLoadInputState.fire();
        const model = this._inputEditor.getModel();
        if (!model) {
            return;
        }
        if (previous) {
            // When navigating to previous history, always position cursor at the start (line 1, column 1)
            // This ensures that pressing up again will continue to navigate history
            this._inputEditor.setPosition({ lineNumber: 1, column: 1 });
        }
        else {
            this._inputEditor.setPosition(getLastPosition(model));
        }
    }
    setValue(value, transient) {
        this.inputEditor.setValue(value);
        // always leave cursor at the end
        const model = this.inputEditor.getModel();
        if (model) {
            this.inputEditor.setPosition(getLastPosition(model));
        }
    }
    focus() {
        this._inputEditor.focus();
    }
    hasFocus() {
        return this._inputEditor.hasWidgetFocus();
    }
    /**
     * Reset the input and update history.
     * @param userQuery If provided, this will be added to the history. Followups and programmatic queries should not be passed.
     */
    async acceptInput(isUserQuery) {
        if (isUserQuery) {
            const userQuery = this.getCurrentInputState();
            this.history.append(this._getFilteredEntry(userQuery));
        }
        // Clear attached context, fire event to clear input state, and clear the input editor
        this.attachmentModel.clear();
        this._onDidLoadInputState.fire();
        if (this.accessibilityService.isScreenReaderOptimized() && isMacintosh) {
            this._acceptInputForVoiceover();
        }
        else {
            this._inputEditor.focus();
            this._inputEditor.setValue('');
        }
    }
    validateAgentMode() {
        if (!this.agentService.hasToolsAgent && this._currentModeObservable.get().kind === ChatModeKind.Agent) {
            this.setChatMode(ChatModeKind.Edit);
        }
    }
    // A function that filters out specifically the `value` property of the attachment.
    _getFilteredEntry(inputState) {
        const attachmentsWithoutImageValues = inputState.attachments.map(attachment => {
            if (isImageVariableEntry(attachment) && attachment.references?.length && attachment.value) {
                const newAttachment = { ...attachment };
                newAttachment.value = undefined;
                return newAttachment;
            }
            return attachment;
        });
        return { ...inputState, attachments: attachmentsWithoutImageValues };
    }
    _acceptInputForVoiceover() {
        const domNode = this._inputEditor.getDomNode();
        if (!domNode) {
            return;
        }
        // Remove the input editor from the DOM temporarily to prevent VoiceOver
        // from reading the cleared text (the request) to the user.
        domNode.remove();
        this._inputEditor.setValue('');
        this._inputEditorElement.appendChild(domNode);
        this._inputEditor.focus();
    }
    _handleAttachedContextChange() {
        this._hasFileAttachmentContextKey.set(Boolean(this._attachmentModel.attachments.find(a => a.kind === 'file')));
        this.renderAttachedContext();
    }
    getOrCreateOptionEmitter(optionGroupId) {
        let emitter = this._chatSessionOptionEmitters.get(optionGroupId);
        if (!emitter) {
            emitter = this._register(new Emitter());
            this._chatSessionOptionEmitters.set(optionGroupId, emitter);
        }
        return emitter;
    }
    /**
     * Refresh all registered option groups for the current chat session.
     * Fires events for each option group with their current selection.
     */
    refreshChatSessionPickers() {
        const sessionResource = this._widget?.viewModel?.model.sessionResource;
        const hideAll = () => {
            this.chatSessionHasOptions.set(false);
            this.hideAllSessionPickerWidgets();
        };
        if (!sessionResource) {
            return hideAll();
        }
        const ctx = this.chatService.getChatSessionFromInternalUri(sessionResource);
        if (!ctx) {
            return hideAll();
        }
        const optionGroups = this.chatSessionsService.getOptionGroupsForSessionType(ctx.chatSessionType);
        if (!optionGroups || optionGroups.length === 0) {
            return hideAll();
        }
        if (!this.chatSessionsService.hasAnySessionOptions(ctx.chatSessionResource)) {
            return hideAll();
        }
        this.chatSessionHasOptions.set(true);
        const currentWidgetGroupIds = new Set(this.chatSessionPickerWidgets.keys());
        const requiredGroupIds = new Set(optionGroups.map(g => g.id));
        const needsRecreation = currentWidgetGroupIds.size !== requiredGroupIds.size ||
            !Array.from(requiredGroupIds).every(id => currentWidgetGroupIds.has(id));
        if (needsRecreation && this._lastSessionPickerAction && this.chatSessionPickerContainer) {
            const widgets = this.createChatSessionPickerWidgets(this._lastSessionPickerAction);
            dom.clearNode(this.chatSessionPickerContainer);
            for (const widget of widgets) {
                const container = dom.$('.action-item.chat-sessionPicker-item');
                widget.render(container);
                this.chatSessionPickerContainer.appendChild(container);
            }
        }
        if (this.chatSessionPickerContainer) {
            this.chatSessionPickerContainer.style.display = '';
        }
        for (const [optionGroupId] of this.chatSessionPickerWidgets.entries()) {
            const currentOption = this.chatSessionsService.getSessionOption(ctx.chatSessionResource, optionGroupId);
            if (currentOption) {
                const optionGroup = optionGroups.find(g => g.id === optionGroupId);
                if (optionGroup) {
                    const item = optionGroup.items.find(m => m.id === currentOption);
                    if (item) {
                        this.getOrCreateOptionEmitter(optionGroupId).fire(item);
                    }
                }
            }
        }
    }
    hideAllSessionPickerWidgets() {
        if (this.chatSessionPickerContainer) {
            this.chatSessionPickerContainer.style.display = 'none';
        }
    }
    disposeSessionPickerWidgets() {
        for (const widget of this.chatSessionPickerWidgets.values()) {
            widget.dispose();
        }
        this.chatSessionPickerWidgets.clear();
    }
    /**
     * Get the current option for a specific option group.
     * If no option is currently set, initializes with the first item as default.
     */
    getCurrentOptionForGroup(optionGroupId) {
        const sessionResource = this._widget?.viewModel?.model.sessionResource;
        if (!sessionResource) {
            return;
        }
        const ctx = this.chatService.getChatSessionFromInternalUri(sessionResource);
        if (!ctx) {
            return;
        }
        const optionGroups = this.chatSessionsService.getOptionGroupsForSessionType(ctx.chatSessionType);
        const optionGroup = optionGroups?.find(g => g.id === optionGroupId);
        if (!optionGroup || optionGroup.items.length === 0) {
            return;
        }
        const currentOptionValue = this.chatSessionsService.getSessionOption(ctx.chatSessionResource, optionGroupId);
        if (!currentOptionValue) {
            return;
        }
        if (typeof currentOptionValue === 'string') {
            return optionGroup.items.find(m => m.id === currentOptionValue);
        }
        else {
            return currentOptionValue;
        }
    }
    render(container, initialValue, widget) {
        this._widget = widget;
        let elements;
        if (this.options.renderStyle === 'compact') {
            elements = dom.h('.interactive-input-part', [
                dom.h('.interactive-input-and-edit-session', [
                    dom.h('.chat-todo-list-widget-container@chatInputTodoListWidgetContainer'),
                    dom.h('.chat-editing-session@chatEditingSessionWidgetContainer'),
                    dom.h('.interactive-input-and-side-toolbar@inputAndSideToolbar', [
                        dom.h('.chat-input-container@inputContainer', [
                            dom.h('.chat-editor-container@editorContainer'),
                            dom.h('.chat-input-toolbars@inputToolbars'),
                        ]),
                    ]),
                    dom.h('.chat-attachments-container@attachmentsContainer', [
                        dom.h('.chat-attachment-toolbar@attachmentToolbar'),
                        dom.h('.chat-attached-context@attachedContextContainer'),
                        dom.h('.chat-related-files@relatedFilesContainer'),
                    ]),
                    dom.h('.interactive-input-followups@followupsContainer'),
                ])
            ]);
        }
        else {
            elements = dom.h('.interactive-input-part', [
                dom.h('.interactive-input-followups@followupsContainer'),
                dom.h('.chat-todo-list-widget-container@chatInputTodoListWidgetContainer'),
                dom.h('.chat-editing-session@chatEditingSessionWidgetContainer'),
                dom.h('.interactive-input-and-side-toolbar@inputAndSideToolbar', [
                    dom.h('.chat-input-container@inputContainer', [
                        dom.h('.chat-attachments-container@attachmentsContainer', [
                            dom.h('.chat-attachment-toolbar@attachmentToolbar'),
                            dom.h('.chat-related-files@relatedFilesContainer'),
                            dom.h('.chat-attached-context@attachedContextContainer'),
                        ]),
                        dom.h('.chat-editor-container@editorContainer'),
                        dom.h('.chat-input-toolbars@inputToolbars'),
                    ]),
                ]),
            ]);
        }
        this.container = elements.root;
        this.chatInputOverlay = dom.$('.chat-input-overlay');
        container.append(this.container);
        this.container.append(this.chatInputOverlay);
        this.container.classList.toggle('compact', this.options.renderStyle === 'compact');
        this.followupsContainer = elements.followupsContainer;
        const inputAndSideToolbar = elements.inputAndSideToolbar; // The chat input and toolbar to the right
        const inputContainer = elements.inputContainer; // The chat editor, attachments, and toolbars
        const editorContainer = elements.editorContainer;
        this.attachmentsContainer = elements.attachmentsContainer;
        this.attachedContextContainer = elements.attachedContextContainer;
        this.relatedFilesContainer = elements.relatedFilesContainer;
        const toolbarsContainer = elements.inputToolbars;
        const attachmentToolbarContainer = elements.attachmentToolbar;
        this.chatEditingSessionWidgetContainer = elements.chatEditingSessionWidgetContainer;
        this.chatInputTodoListWidgetContainer = elements.chatInputTodoListWidgetContainer;
        if (this.options.enableImplicitContext) {
            this._implicitContext = this._register(this.instantiationService.createInstance(ChatImplicitContext));
            this._register(this._implicitContext.onDidChangeValue(() => {
                this._indexOfLastAttachedContextDeletedWithKeyboard = -1;
                this._handleAttachedContextChange();
            }));
        }
        this.renderAttachedContext();
        this._register(this._attachmentModel.onDidChange((e) => {
            if (e.added.length > 0) {
                this._indexOfLastAttachedContextDeletedWithKeyboard = -1;
            }
            this._handleAttachedContextChange();
        }));
        this.renderChatEditingSessionState(null);
        if (this.options.renderWorkingSet) {
            this._relatedFiles = this._register(new ChatRelatedFiles());
            this._register(this._relatedFiles.onDidChange(() => this.renderChatRelatedFiles()));
        }
        this.renderChatRelatedFiles();
        this.dnd.addOverlay(this.options.dndContainer ?? container, this.options.dndContainer ?? container);
        const inputScopedContextKeyService = this._register(this.contextKeyService.createScoped(inputContainer));
        ChatContextKeys.inChatInput.bindTo(inputScopedContextKeyService).set(true);
        this.currentlyEditingInputKey = ChatContextKeys.currentlyEditingInput.bindTo(inputScopedContextKeyService);
        const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, inputScopedContextKeyService])));
        const { historyNavigationBackwardsEnablement, historyNavigationForwardsEnablement } = this._register(registerAndCreateHistoryNavigationContext(inputScopedContextKeyService, this));
        this.historyNavigationBackwardsEnablement = historyNavigationBackwardsEnablement;
        this.historyNavigationForewardsEnablement = historyNavigationForwardsEnablement;
        const options = getSimpleEditorOptions(this.configurationService);
        options.overflowWidgetsDomNode = this.options.editorOverflowWidgetsDomNode;
        options.pasteAs = EditorOptions.pasteAs.defaultValue;
        options.readOnly = false;
        options.ariaLabel = this._getAriaLabel();
        options.fontFamily = DEFAULT_FONT_FAMILY;
        options.fontSize = 13;
        options.lineHeight = 20;
        options.padding = this.options.renderStyle === 'compact' ? { top: 2, bottom: 2 } : { top: 8, bottom: 8 };
        options.cursorWidth = 1;
        options.wrappingStrategy = 'advanced';
        options.bracketPairColorization = { enabled: false };
        // Respect user's editor settings for auto-closing and auto-surrounding behavior
        options.autoClosingBrackets = this.configurationService.getValue('editor.autoClosingBrackets');
        options.autoClosingQuotes = this.configurationService.getValue('editor.autoClosingQuotes');
        options.autoSurround = this.configurationService.getValue('editor.autoSurround');
        options.suggest = {
            showIcons: true,
            showSnippets: false,
            showWords: true,
            showStatusBar: false,
            insertMode: 'insert',
        };
        options.scrollbar = { ...(options.scrollbar ?? {}), vertical: 'hidden' };
        options.stickyScroll = { enabled: false };
        this._inputEditorElement = dom.append(editorContainer, $(chatInputEditorContainerSelector));
        const editorOptions = getSimpleCodeEditorWidgetOptions();
        editorOptions.contributions?.push(...EditorExtensionsRegistry.getSomeEditorContributions([ContentHoverController.ID, GlyphHoverController.ID, DropIntoEditorController.ID, CopyPasteController.ID, LinkDetector.ID]));
        this._inputEditor = this._register(scopedInstantiationService.createInstance(CodeEditorWidget, this._inputEditorElement, options, editorOptions));
        SuggestController.get(this._inputEditor)?.forceRenderingAbove();
        options.overflowWidgetsDomNode?.classList.add('hideSuggestTextIcons');
        this._inputEditorElement.classList.add('hideSuggestTextIcons');
        // Prevent Enter key from creating new lines - but respect user's custom keybindings
        // Only prevent default behavior if ChatSubmitAction is bound to Enter AND its precondition is met
        this._register(this._inputEditor.onKeyDown((e) => {
            if (e.keyCode === 3 /* KeyCode.Enter */ && !hasModifierKeys(e)) {
                // Check if ChatSubmitAction has a keybinding for plain Enter in the current context
                // This respects user's custom keybindings that disable the submit action
                for (const keybinding of this.keybindingService.lookupKeybindings(ChatSubmitAction.ID)) {
                    const chords = keybinding.getDispatchChords();
                    const isPlainEnter = chords.length === 1 && chords[0] === '[Enter]';
                    if (isPlainEnter) {
                        // Do NOT call stopPropagation() so the keybinding service can still process this event
                        e.preventDefault();
                        break;
                    }
                }
            }
        }));
        this._register(this._inputEditor.onDidChangeModelContent(() => {
            const currentHeight = Math.min(this._inputEditor.getContentHeight(), this.inputEditorMaxHeight);
            if (currentHeight !== this.inputEditorHeight) {
                this.inputEditorHeight = currentHeight;
                this._onDidChangeHeight.fire();
            }
            const model = this._inputEditor.getModel();
            const inputHasText = !!model && model.getValue().trim().length > 0;
            this.inputEditorHasText.set(inputHasText);
            // Debounced sync to model for text changes
            this._syncTextDebounced.schedule();
        }));
        this._register(this._inputEditor.onDidContentSizeChange(e => {
            if (e.contentHeightChanged) {
                this.inputEditorHeight = !this.inline ? e.contentHeight : this.inputEditorHeight;
                this._onDidChangeHeight.fire();
            }
        }));
        this._register(this._inputEditor.onDidFocusEditorText(() => {
            this.inputEditorHasFocus.set(true);
            this._onDidFocus.fire();
            inputContainer.classList.toggle('focused', true);
        }));
        this._register(this._inputEditor.onDidBlurEditorText(() => {
            this.inputEditorHasFocus.set(false);
            inputContainer.classList.toggle('focused', false);
            this._onDidBlur.fire();
        }));
        this._register(this._inputEditor.onDidBlurEditorWidget(() => {
            CopyPasteController.get(this._inputEditor)?.clearWidgets();
            DropIntoEditorController.get(this._inputEditor)?.clearWidgets();
        }));
        const hoverDelegate = this._register(createInstantHoverDelegate());
        this._register(dom.addStandardDisposableListener(toolbarsContainer, dom.EventType.CLICK, e => this.inputEditor.focus()));
        this._register(dom.addStandardDisposableListener(this.attachmentsContainer, dom.EventType.CLICK, e => this.inputEditor.focus()));
        this.inputActionsToolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, this.options.renderInputToolbarBelowInput ? this.attachmentsContainer : toolbarsContainer, MenuId.ChatInput, {
            telemetrySource: this.options.menus.telemetrySource,
            menuOptions: { shouldForwardArgs: true },
            hiddenItemStrategy: -1 /* HiddenItemStrategy.NoHide */,
            hoverDelegate,
            actionViewItemProvider: (action, options) => {
                if (action.id === ChatOpenModelPickerActionId && action instanceof MenuItemAction) {
                    if (!this._currentLanguageModel) {
                        this.setCurrentLanguageModelToDefault();
                    }
                    const itemDelegate = {
                        getCurrentModel: () => this._currentLanguageModel,
                        onDidChangeModel: this._onDidChangeCurrentLanguageModel.event,
                        setModel: (model) => {
                            this._waitForPersistedLanguageModel.clear();
                            this.setCurrentLanguageModel(model);
                            this.renderAttachedContext();
                        },
                        getModels: () => this.getModels()
                    };
                    return this.modelWidget = this.instantiationService.createInstance(ModelPickerActionItem, action, this._currentLanguageModel, undefined, itemDelegate);
                }
                else if (action.id === OpenModePickerAction.ID && action instanceof MenuItemAction) {
                    const delegate = {
                        currentMode: this._currentModeObservable,
                        sessionResource: () => this._widget?.viewModel?.sessionResource,
                    };
                    return this.modeWidget = this.instantiationService.createInstance(ModePickerActionItem, action, delegate);
                }
                else if (action.id === ChatSessionPrimaryPickerAction.ID && action instanceof MenuItemAction) {
                    // Create all pickers and return a container action view item
                    const widgets = this.createChatSessionPickerWidgets(action);
                    if (widgets.length === 0) {
                        return undefined;
                    }
                    // Create a container to hold all picker widgets
                    return this.instantiationService.createInstance(ChatSessionPickersContainerActionItem, action, widgets);
                }
                return undefined;
            }
        }));
        this.inputActionsToolbar.getElement().classList.add('chat-input-toolbar');
        this.inputActionsToolbar.context = { widget };
        this._register(this.inputActionsToolbar.onDidChangeMenuItems(() => {
            // Update container reference for the pickers
            const toolbarElement = this.inputActionsToolbar.getElement();
            // eslint-disable-next-line no-restricted-syntax
            const container = toolbarElement.querySelector('.chat-sessionPicker-container');
            this.chatSessionPickerContainer = container;
            if (this.cachedDimensions && typeof this.cachedInputToolbarWidth === 'number' && this.cachedInputToolbarWidth !== this.inputActionsToolbar.getItemsWidth()) {
                this.layout(this.cachedDimensions.height, this.cachedDimensions.width);
            }
        }));
        this.executeToolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, toolbarsContainer, this.options.menus.executeToolbar, {
            telemetrySource: this.options.menus.telemetrySource,
            menuOptions: {
                shouldForwardArgs: true
            },
            hoverDelegate,
            hiddenItemStrategy: -1 /* HiddenItemStrategy.NoHide */,
            actionViewItemProvider: (action, options) => {
                if (action.id === ContinueChatInSessionAction.ID && action instanceof MenuItemAction) {
                    return this.instantiationService.createInstance(ChatContinueInSessionActionItem, action, "chatWidget" /* ActionLocation.ChatWidget */);
                }
                return undefined;
            }
        }));
        this.executeToolbar.getElement().classList.add('chat-execute-toolbar');
        this.executeToolbar.context = { widget };
        this._register(this.executeToolbar.onDidChangeMenuItems(() => {
            if (this.cachedDimensions && typeof this.cachedExecuteToolbarWidth === 'number' && this.cachedExecuteToolbarWidth !== this.executeToolbar.getItemsWidth()) {
                this.layout(this.cachedDimensions.height, this.cachedDimensions.width);
            }
        }));
        if (this.options.menus.inputSideToolbar) {
            const toolbarSide = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, inputAndSideToolbar, this.options.menus.inputSideToolbar, {
                telemetrySource: this.options.menus.telemetrySource,
                menuOptions: {
                    shouldForwardArgs: true
                },
                hoverDelegate
            }));
            this.inputSideToolbarContainer = toolbarSide.getElement();
            toolbarSide.getElement().classList.add('chat-side-toolbar');
            toolbarSide.context = { widget };
        }
        let inputModel = this.modelService.getModel(this.inputUri);
        if (!inputModel) {
            inputModel = this.modelService.createModel('', null, this.inputUri, true);
        }
        this.textModelResolverService.createModelReference(this.inputUri).then(ref => {
            // make sure to hold a reference so that the model doesn't get disposed by the text model service
            if (this._store.isDisposed) {
                ref.dispose();
                return;
            }
            this._register(ref);
        });
        this.inputModel = inputModel;
        this.inputModel.updateOptions({ bracketColorizationOptions: { enabled: false, independentColorPoolPerBracketType: false } });
        this._inputEditor.setModel(this.inputModel);
        if (initialValue) {
            this.inputModel.setValue(initialValue);
            const lineNumber = this.inputModel.getLineCount();
            this._inputEditor.setPosition({ lineNumber, column: this.inputModel.getLineMaxColumn(lineNumber) });
        }
        const onDidChangeCursorPosition = () => {
            const model = this._inputEditor.getModel();
            if (!model) {
                return;
            }
            const position = this._inputEditor.getPosition();
            if (!position) {
                return;
            }
            const atTop = position.lineNumber === 1 && position.column === 1;
            this.chatCursorAtTop.set(atTop);
            this.historyNavigationBackwardsEnablement.set(atTop);
            this.historyNavigationForewardsEnablement.set(position.equals(getLastPosition(model)));
            // Sync cursor and selection to model
            this._syncInputStateToModel();
        };
        this._register(this._inputEditor.onDidChangeCursorPosition(e => onDidChangeCursorPosition()));
        onDidChangeCursorPosition();
        this._register(this.themeService.onDidFileIconThemeChange(() => {
            this.renderAttachedContext();
        }));
        this.addFilesToolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, attachmentToolbarContainer, MenuId.ChatInputAttachmentToolbar, {
            telemetrySource: this.options.menus.telemetrySource,
            label: true,
            menuOptions: { shouldForwardArgs: true, renderShortTitle: true },
            hiddenItemStrategy: -1 /* HiddenItemStrategy.NoHide */,
            hoverDelegate,
            actionViewItemProvider: (action, options) => {
                if (action.id === 'workbench.action.chat.attachContext') {
                    const viewItem = this.instantiationService.createInstance(AddFilesButton, this._attachmentModel, action, options);
                    viewItem.setShowLabel(this._attachmentModel.size === 0 && !this.hasImplicitContextBlock());
                    this.addFilesButton = viewItem;
                    return this.addFilesButton;
                }
                return undefined;
            }
        }));
        this.addFilesToolbar.context = { widget, placeholder: localize('chatAttachFiles', 'Search for files and context to add to your request') };
        this._register(this.addFilesToolbar.onDidChangeMenuItems(() => {
            if (this.cachedDimensions) {
                this._onDidChangeHeight.fire();
            }
        }));
    }
    toggleChatInputOverlay(editing) {
        this.chatInputOverlay.classList.toggle('disabled', editing);
        if (editing) {
            this.overlayClickListener.value = dom.addStandardDisposableListener(this.chatInputOverlay, dom.EventType.CLICK, e => {
                e.preventDefault();
                e.stopPropagation();
                this._onDidClickOverlay.fire();
            });
        }
        else {
            this.overlayClickListener.clear();
        }
    }
    renderAttachedContext() {
        const container = this.attachedContextContainer;
        // Note- can't measure attachedContextContainer, because it has `display: contents`, so measure the parent to check for height changes
        const oldHeight = this.attachmentsContainer.offsetHeight;
        const store = new DisposableStore();
        this.attachedContextDisposables.value = store;
        dom.clearNode(container);
        store.add(dom.addStandardDisposableListener(this.attachmentsContainer, dom.EventType.KEY_DOWN, (e) => {
            this.handleAttachmentNavigation(e);
        }));
        const attachments = [...this.attachmentModel.attachments.entries()];
        const hasAttachments = Boolean(attachments.length) || Boolean(this.implicitContext?.value);
        dom.setVisibility(Boolean(this.options.renderInputToolbarBelowInput || hasAttachments || (this.addFilesToolbar && !this.addFilesToolbar.isEmpty())), this.attachmentsContainer);
        dom.setVisibility(hasAttachments, this.attachedContextContainer);
        if (!attachments.length) {
            this._indexOfLastAttachedContextDeletedWithKeyboard = -1;
            this._indexOfLastOpenedContext = -1;
        }
        const isSuggestedEnabled = this.configurationService.getValue('chat.implicitContext.suggestedContext');
        if (this.implicitContext?.value && !isSuggestedEnabled) {
            const implicitPart = store.add(this.instantiationService.createInstance(ImplicitContextAttachmentWidget, () => this._widget, this.implicitContext, this._contextResourceLabels, this.attachmentModel));
            container.appendChild(implicitPart.domNode);
        }
        for (const [index, attachment] of attachments) {
            const resource = URI.isUri(attachment.value) ? attachment.value : isLocation(attachment.value) ? attachment.value.uri : undefined;
            const range = isLocation(attachment.value) ? attachment.value.range : undefined;
            const shouldFocusClearButton = index === Math.min(this._indexOfLastAttachedContextDeletedWithKeyboard, this.attachmentModel.size - 1) && this._indexOfLastAttachedContextDeletedWithKeyboard > -1;
            let attachmentWidget;
            const options = { shouldFocusClearButton, supportsDeletion: true };
            if (attachment.kind === 'tool' || attachment.kind === 'toolset') {
                attachmentWidget = this.instantiationService.createInstance(ToolSetOrToolItemAttachmentWidget, attachment, this._currentLanguageModel, options, container, this._contextResourceLabels);
            }
            else if (resource && isNotebookOutputVariableEntry(attachment)) {
                attachmentWidget = this.instantiationService.createInstance(NotebookCellOutputChatAttachmentWidget, resource, attachment, this._currentLanguageModel, options, container, this._contextResourceLabels);
            }
            else if (isPromptFileVariableEntry(attachment)) {
                attachmentWidget = this.instantiationService.createInstance(PromptFileAttachmentWidget, attachment, this._currentLanguageModel, options, container, this._contextResourceLabels);
            }
            else if (isPromptTextVariableEntry(attachment)) {
                attachmentWidget = this.instantiationService.createInstance(PromptTextAttachmentWidget, attachment, undefined, options, container, this._contextResourceLabels);
            }
            else if (resource && (attachment.kind === 'file' || attachment.kind === 'directory')) {
                attachmentWidget = this.instantiationService.createInstance(FileAttachmentWidget, resource, range, attachment, undefined, this._currentLanguageModel, options, container, this._contextResourceLabels);
            }
            else if (attachment.kind === 'terminalCommand') {
                attachmentWidget = this.instantiationService.createInstance(TerminalCommandAttachmentWidget, attachment, this._currentLanguageModel, options, container, this._contextResourceLabels);
            }
            else if (isImageVariableEntry(attachment)) {
                attachmentWidget = this.instantiationService.createInstance(ImageAttachmentWidget, resource, attachment, this._currentLanguageModel, options, container, this._contextResourceLabels);
            }
            else if (isElementVariableEntry(attachment)) {
                attachmentWidget = this.instantiationService.createInstance(ElementChatAttachmentWidget, attachment, this._currentLanguageModel, options, container, this._contextResourceLabels);
            }
            else if (isPasteVariableEntry(attachment)) {
                attachmentWidget = this.instantiationService.createInstance(PasteAttachmentWidget, attachment, this._currentLanguageModel, options, container, this._contextResourceLabels);
            }
            else if (isSCMHistoryItemVariableEntry(attachment)) {
                attachmentWidget = this.instantiationService.createInstance(SCMHistoryItemAttachmentWidget, attachment, this._currentLanguageModel, options, container, this._contextResourceLabels);
            }
            else if (isSCMHistoryItemChangeVariableEntry(attachment)) {
                attachmentWidget = this.instantiationService.createInstance(SCMHistoryItemChangeAttachmentWidget, attachment, this._currentLanguageModel, options, container, this._contextResourceLabels);
            }
            else if (isSCMHistoryItemChangeRangeVariableEntry(attachment)) {
                attachmentWidget = this.instantiationService.createInstance(SCMHistoryItemChangeRangeAttachmentWidget, attachment, this._currentLanguageModel, options, container, this._contextResourceLabels);
            }
            else {
                attachmentWidget = this.instantiationService.createInstance(DefaultChatAttachmentWidget, resource, range, attachment, undefined, this._currentLanguageModel, options, container, this._contextResourceLabels);
            }
            if (shouldFocusClearButton) {
                attachmentWidget.element.focus();
            }
            if (index === Math.min(this._indexOfLastOpenedContext, this.attachmentModel.size - 1)) {
                attachmentWidget.element.focus();
            }
            store.add(attachmentWidget);
            store.add(attachmentWidget.onDidDelete(e => {
                this.handleAttachmentDeletion(e, index, attachment);
            }));
            store.add(attachmentWidget.onDidOpen(e => {
                this.handleAttachmentOpen(index, attachment);
            }));
        }
        const implicitValue = this.implicitContext?.value;
        if (isSuggestedEnabled && implicitValue) {
            const targetUri = this.implicitContext.uri;
            const currentlyAttached = attachments.some(([, attachment]) => {
                let uri;
                if (URI.isUri(attachment.value)) {
                    uri = attachment.value;
                }
                else if (isStringVariableEntry(attachment)) {
                    uri = attachment.uri;
                }
                return uri && isEqual(uri, targetUri);
            });
            const shouldShowImplicit = !isLocation(implicitValue) ? !currentlyAttached : implicitValue.range;
            if (shouldShowImplicit) {
                const implicitPart = store.add(this.instantiationService.createInstance(ImplicitContextAttachmentWidget, () => this._widget, this.implicitContext, this._contextResourceLabels, this._attachmentModel));
                container.appendChild(implicitPart.domNode);
            }
        }
        if (oldHeight !== this.attachmentsContainer.offsetHeight) {
            this._onDidChangeHeight.fire();
        }
        this.addFilesButton?.setShowLabel(this._attachmentModel.size === 0 && !this.hasImplicitContextBlock());
        this._indexOfLastOpenedContext = -1;
    }
    hasImplicitContextBlock() {
        const implicit = this.implicitContext?.value;
        if (!implicit) {
            return false;
        }
        const isSuggestedEnabled = this.configurationService.getValue('chat.implicitContext.suggestedContext');
        if (!isSuggestedEnabled) {
            return true;
        }
        // TODO @justschen: merge this with above showing implicit logic
        const isUri = URI.isUri(implicit);
        if (isUri || isLocation(implicit)) {
            const targetUri = isUri ? implicit : implicit.uri;
            const attachments = [...this._attachmentModel.attachments.entries()];
            const currentlyAttached = attachments.some(([, a]) => URI.isUri(a.value) && isEqual(a.value, targetUri));
            const shouldShowImplicit = isUri ? !currentlyAttached : implicit.range;
            return !!shouldShowImplicit;
        }
        return false;
    }
    handleAttachmentDeletion(e, index, attachment) {
        // Set focus to the next attached context item if deletion was triggered by a keystroke (vs a mouse click)
        if (dom.isKeyboardEvent(e)) {
            this._indexOfLastAttachedContextDeletedWithKeyboard = index;
        }
        this._attachmentModel.delete(attachment.id);
        if (this.configurationService.getValue('chat.implicitContext.enableImplicitContext')) {
            // if currently opened file is deleted, do not show implicit context
            const implicitValue = URI.isUri(this.implicitContext?.value) && URI.isUri(attachment.value) && isEqual(this.implicitContext.value, attachment.value);
            if (this.implicitContext?.isFile && implicitValue) {
                this.implicitContext.enabled = false;
            }
        }
        if (this._attachmentModel.size === 0) {
            this.focus();
        }
        this._onDidChangeContext.fire({ removed: [attachment] });
        this.renderAttachedContext();
    }
    handleAttachmentOpen(index, attachment) {
        this._indexOfLastOpenedContext = index;
        this._indexOfLastAttachedContextDeletedWithKeyboard = -1;
        if (this._attachmentModel.size === 0) {
            this.focus();
        }
    }
    handleAttachmentNavigation(e) {
        if (!e.equals(15 /* KeyCode.LeftArrow */) && !e.equals(17 /* KeyCode.RightArrow */)) {
            return;
        }
        // eslint-disable-next-line no-restricted-syntax
        const toolbar = this.addFilesToolbar?.getElement().querySelector('.action-label');
        if (!toolbar) {
            return;
        }
        // eslint-disable-next-line no-restricted-syntax
        const attachments = Array.from(this.attachedContextContainer.querySelectorAll('.chat-attached-context-attachment'));
        if (!attachments.length) {
            return;
        }
        attachments.unshift(toolbar);
        const activeElement = dom.getWindow(this.attachmentsContainer).document.activeElement;
        const currentIndex = attachments.findIndex(attachment => attachment === activeElement);
        let newIndex = currentIndex;
        if (e.equals(15 /* KeyCode.LeftArrow */)) {
            newIndex = currentIndex > 0 ? currentIndex - 1 : attachments.length - 1;
        }
        else if (e.equals(17 /* KeyCode.RightArrow */)) {
            newIndex = currentIndex < attachments.length - 1 ? currentIndex + 1 : 0;
        }
        if (newIndex !== -1) {
            const nextElement = attachments[newIndex];
            nextElement.focus();
            e.preventDefault();
            e.stopPropagation();
        }
    }
    async renderChatTodoListWidget(chatSessionResource) {
        const isTodoWidgetEnabled = this.configurationService.getValue(ChatConfiguration.TodosShowWidget) !== false;
        if (!isTodoWidgetEnabled) {
            return;
        }
        if (!this._chatInputTodoListWidget.value) {
            const widget = this._chatEditingTodosDisposables.add(this.instantiationService.createInstance(ChatTodoListWidget));
            this._chatInputTodoListWidget.value = widget;
            // Add the widget's DOM node to the dedicated todo list container
            dom.clearNode(this.chatInputTodoListWidgetContainer);
            dom.append(this.chatInputTodoListWidgetContainer, widget.domNode);
            // Listen to height changes
            this._chatEditingTodosDisposables.add(widget.onDidChangeHeight(() => {
                this._onDidChangeHeight.fire();
            }));
        }
        this._chatInputTodoListWidget.value.render(chatSessionResource);
    }
    clearTodoListWidget(sessionResource, force) {
        this._chatInputTodoListWidget.value?.clear(sessionResource, force);
    }
    renderChatEditingSessionState(chatEditingSession) {
        dom.setVisibility(Boolean(chatEditingSession), this.chatEditingSessionWidgetContainer);
        if (chatEditingSession) {
            if (!isEqual(chatEditingSession.chatSessionResource, this._lastEditingSessionResource)) {
                this._workingSetCollapsed = true;
            }
            this._lastEditingSessionResource = chatEditingSession.chatSessionResource;
        }
        const modifiedEntries = derivedOpts({ equalsFn: arraysEqual }, r => {
            return chatEditingSession?.entries.read(r).filter(entry => entry.state.read(r) === 0 /* ModifiedFileEntryState.Modified */) || [];
        });
        const listEntries = derived((reader) => {
            const seenEntries = new ResourceSet();
            const entries = [];
            for (const entry of modifiedEntries.read(reader)) {
                if (entry.state.read(reader) !== 0 /* ModifiedFileEntryState.Modified */) {
                    continue;
                }
                if (!seenEntries.has(entry.modifiedURI)) {
                    seenEntries.add(entry.modifiedURI);
                    const linesAdded = entry.linesAdded?.read(reader);
                    const linesRemoved = entry.linesRemoved?.read(reader);
                    entries.push({
                        reference: entry.modifiedURI,
                        state: 0 /* ModifiedFileEntryState.Modified */,
                        kind: 'reference',
                        options: {
                            status: undefined,
                            diffMeta: { added: linesAdded ?? 0, removed: linesRemoved ?? 0 }
                        }
                    });
                }
            }
            entries.sort((a, b) => {
                if (a.kind === 'reference' && b.kind === 'reference') {
                    if (a.state === b.state || a.state === undefined || b.state === undefined) {
                        return a.reference.toString().localeCompare(b.reference.toString());
                    }
                    return a.state - b.state;
                }
                return 0;
            });
            return entries;
        });
        const shouldRender = listEntries.map(r => r.length > 0);
        this._renderingChatEdits.value = autorun(reader => {
            if (this.options.renderWorkingSet && shouldRender.read(reader)) {
                this.renderChatEditingSessionWithEntries(reader.store, chatEditingSession, modifiedEntries, listEntries);
            }
            else {
                dom.clearNode(this.chatEditingSessionWidgetContainer);
                this._chatEditsDisposables.clear();
                this._chatEditList = undefined;
            }
        });
    }
    renderChatEditingSessionWithEntries(store, chatEditingSession, modifiedEntries, listEntries) {
        // Summary of number of files changed
        // eslint-disable-next-line no-restricted-syntax
        const innerContainer = this.chatEditingSessionWidgetContainer.querySelector('.chat-editing-session-container.show-file-icons') ?? dom.append(this.chatEditingSessionWidgetContainer, $('.chat-editing-session-container.show-file-icons'));
        // eslint-disable-next-line no-restricted-syntax
        const overviewRegion = innerContainer.querySelector('.chat-editing-session-overview') ?? dom.append(innerContainer, $('.chat-editing-session-overview'));
        // eslint-disable-next-line no-restricted-syntax
        const overviewTitle = overviewRegion.querySelector('.working-set-title') ?? dom.append(overviewRegion, $('.working-set-title'));
        // Clear out the previous actions (if any)
        this._chatEditsActionsDisposables.clear();
        // Chat editing session actions
        // eslint-disable-next-line no-restricted-syntax
        const actionsContainer = overviewRegion.querySelector('.chat-editing-session-actions') ?? dom.append(overviewRegion, $('.chat-editing-session-actions'));
        this._chatEditsActionsDisposables.add(this.instantiationService.createInstance(MenuWorkbenchButtonBar, actionsContainer, MenuId.ChatEditingWidgetToolbar, {
            telemetrySource: this.options.menus.telemetrySource,
            menuOptions: {
                arg: { sessionResource: chatEditingSession.chatSessionResource },
            },
            buttonConfigProvider: (action) => {
                if (action.id === ChatEditingShowChangesAction.ID || action.id === ViewPreviousEditsAction.Id) {
                    return { showIcon: true, showLabel: false, isSecondary: true };
                }
                return undefined;
            }
        }));
        if (!chatEditingSession) {
            return;
        }
        // Working set
        // eslint-disable-next-line no-restricted-syntax
        const workingSetContainer = innerContainer.querySelector('.chat-editing-session-list') ?? dom.append(innerContainer, $('.chat-editing-session-list'));
        const button = this._chatEditsActionsDisposables.add(new ButtonWithIcon(overviewTitle, {
            supportIcons: true,
            secondary: true,
            ariaLabel: localize('chatEditingSession.toggleWorkingSet', 'Toggle changed files.'),
        }));
        store.add(autorun(reader => {
            let added = 0;
            let removed = 0;
            const entries = modifiedEntries.read(reader);
            for (const entry of entries) {
                if (entry.linesAdded && entry.linesRemoved) {
                    added += entry.linesAdded.read(reader);
                    removed += entry.linesRemoved.read(reader);
                }
            }
            const baseLabel = entries.length === 1 ? localize('chatEditingSession.oneFile.1', '1 file changed') : localize('chatEditingSession.manyFiles.1', '{0} files changed', entries.length);
            button.label = baseLabel;
            this._workingSetLinesAddedSpan.value.textContent = `+${added}`;
            this._workingSetLinesRemovedSpan.value.textContent = `-${removed}`;
            button.element.setAttribute('aria-label', localize('chatEditingSession.ariaLabelWithCounts', '{0}, {1} lines added, {2} lines removed', baseLabel, added, removed));
            const shouldShowEditingSession = added > 0 || removed > 0;
            dom.setVisibility(shouldShowEditingSession, this.chatEditingSessionWidgetContainer);
            if (!shouldShowEditingSession) {
                this._onDidChangeHeight.fire();
            }
        }));
        const countsContainer = dom.$('.working-set-line-counts');
        button.element.appendChild(countsContainer);
        countsContainer.appendChild(this._workingSetLinesAddedSpan.value);
        countsContainer.appendChild(this._workingSetLinesRemovedSpan.value);
        const applyCollapseState = () => {
            button.icon = this._workingSetCollapsed ? Codicon.chevronRight : Codicon.chevronDown;
            workingSetContainer.classList.toggle('collapsed', this._workingSetCollapsed);
            this._onDidChangeHeight.fire();
        };
        const toggleWorkingSet = () => {
            this._workingSetCollapsed = !this._workingSetCollapsed;
            applyCollapseState();
        };
        this._chatEditsActionsDisposables.add(button.onDidClick(() => { toggleWorkingSet(); }));
        this._chatEditsActionsDisposables.add(addDisposableListener(overviewRegion, 'click', e => {
            if (e.defaultPrevented) {
                return;
            }
            const target = e.target;
            if (target.closest('.monaco-button')) {
                return;
            }
            toggleWorkingSet();
        }));
        applyCollapseState();
        if (!this._chatEditList) {
            this._chatEditList = this._chatEditsListPool.get();
            const list = this._chatEditList.object;
            this._chatEditsDisposables.add(this._chatEditList);
            this._chatEditsDisposables.add(list.onDidFocus(() => {
                this._onDidFocus.fire();
            }));
            this._chatEditsDisposables.add(list.onDidOpen(async (e) => {
                if (e.element?.kind === 'reference' && URI.isUri(e.element.reference)) {
                    const modifiedFileUri = e.element.reference;
                    const entry = chatEditingSession.getEntry(modifiedFileUri);
                    const pane = await this.editorService.openEditor({
                        resource: modifiedFileUri,
                        options: e.editorOptions
                    }, e.sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
                    if (pane) {
                        entry?.getEditorIntegration(pane).reveal(true, e.editorOptions.preserveFocus);
                    }
                }
            }));
            this._chatEditsDisposables.add(addDisposableListener(list.getHTMLElement(), 'click', e => {
                if (!this.hasFocus()) {
                    this._onDidFocus.fire();
                }
            }, true));
            dom.append(workingSetContainer, list.getHTMLElement());
            dom.append(innerContainer, workingSetContainer);
        }
        store.add(autorun(reader => {
            const entries = listEntries.read(reader);
            const maxItemsShown = 6;
            const itemsShown = Math.min(entries.length, maxItemsShown);
            const height = itemsShown * 22;
            const list = this._chatEditList.object;
            list.layout(height);
            list.getHTMLElement().style.height = `${height}px`;
            list.splice(0, list.length, entries);
            this._onDidChangeHeight.fire();
        }));
    }
    async renderChatRelatedFiles() {
        const anchor = this.relatedFilesContainer;
        dom.clearNode(anchor);
        const shouldRender = this.configurationService.getValue('chat.renderRelatedFiles');
        dom.setVisibility(Boolean(this.relatedFiles?.value.length && shouldRender), anchor);
        if (!shouldRender || !this.relatedFiles?.value.length) {
            return;
        }
        const hoverDelegate = getDefaultHoverDelegate('element');
        for (const { uri, description } of this.relatedFiles.value) {
            const uriLabel = this._chatEditsActionsDisposables.add(new Button(anchor, {
                supportIcons: true,
                secondary: true,
                hoverDelegate
            }));
            uriLabel.label = this.labelService.getUriBasenameLabel(uri);
            uriLabel.element.classList.add('monaco-icon-label');
            uriLabel.element.title = localize('suggeste.title', "{0} - {1}", this.labelService.getUriLabel(uri, { relative: true }), description ?? '');
            this._chatEditsActionsDisposables.add(uriLabel.onDidClick(async () => {
                group.remove(); // REMOVE asap
                await this._attachmentModel.addFile(uri);
                this.relatedFiles?.remove(uri);
            }));
            const addButton = this._chatEditsActionsDisposables.add(new Button(anchor, {
                supportIcons: false,
                secondary: true,
                hoverDelegate,
                ariaLabel: localize('chatEditingSession.addSuggestion', 'Add suggestion {0}', this.labelService.getUriLabel(uri, { relative: true })),
            }));
            addButton.icon = Codicon.add;
            addButton.setTitle(localize('chatEditingSession.addSuggested', 'Add suggestion'));
            this._chatEditsActionsDisposables.add(addButton.onDidClick(async () => {
                group.remove(); // REMOVE asap
                await this._attachmentModel.addFile(uri);
                this.relatedFiles?.remove(uri);
            }));
            const sep = document.createElement('div');
            sep.classList.add('separator');
            const group = document.createElement('span');
            group.classList.add('monaco-button-dropdown', 'sidebyside-button');
            group.appendChild(addButton.element);
            group.appendChild(sep);
            group.appendChild(uriLabel.element);
            dom.append(anchor, group);
            this._chatEditsActionsDisposables.add(toDisposable(() => {
                group.remove();
            }));
        }
        this._onDidChangeHeight.fire();
    }
    async renderFollowups(items, response) {
        if (!this.options.renderFollowups) {
            return;
        }
        this.followupsDisposables.clear();
        dom.clearNode(this.followupsContainer);
        if (items && items.length > 0) {
            this.followupsDisposables.add(this.instantiationService.createInstance(ChatFollowups, this.followupsContainer, items, this.location, undefined, followup => this._onDidAcceptFollowup.fire({ followup, response })));
        }
        this._onDidChangeHeight.fire();
    }
    get contentHeight() {
        const data = this.getLayoutData();
        return data.followupsHeight + data.inputPartEditorHeight + data.inputPartVerticalPadding + data.inputEditorBorder + data.attachmentsHeight + data.toolbarsHeight + data.chatEditingStateHeight + data.todoListWidgetContainerHeight;
    }
    layout(height, width) {
        this.cachedDimensions = new dom.Dimension(width, height);
        return this._layout(height, width);
    }
    _layout(height, width, allowRecurse = true) {
        const data = this.getLayoutData();
        const inputEditorHeight = Math.min(data.inputPartEditorHeight, height - data.followupsHeight - data.attachmentsHeight - data.inputPartVerticalPadding - data.toolbarsHeight - data.chatEditingStateHeight - data.todoListWidgetContainerHeight);
        const followupsWidth = width - data.inputPartHorizontalPadding;
        this.followupsContainer.style.width = `${followupsWidth}px`;
        this._inputPartHeight = data.inputPartVerticalPadding + data.followupsHeight + inputEditorHeight + data.inputEditorBorder + data.attachmentsHeight + data.toolbarsHeight + data.chatEditingStateHeight + data.todoListWidgetContainerHeight;
        this._followupsHeight = data.followupsHeight;
        this._editSessionWidgetHeight = data.chatEditingStateHeight;
        const initialEditorScrollWidth = this._inputEditor.getScrollWidth();
        const newEditorWidth = width - data.inputPartHorizontalPadding - data.editorBorder - data.inputPartHorizontalPaddingInside - data.toolbarsWidth - data.sideToolbarWidth;
        const newDimension = { width: newEditorWidth, height: inputEditorHeight };
        if (!this.previousInputEditorDimension || (this.previousInputEditorDimension.width !== newDimension.width || this.previousInputEditorDimension.height !== newDimension.height)) {
            // This layout call has side-effects that are hard to understand. eg if we are calling this inside a onDidChangeContent handler, this can trigger the next onDidChangeContent handler
            // to be invoked, and we have a lot of these on this editor. Only doing a layout this when the editor size has actually changed makes it much easier to follow.
            this._inputEditor.layout(newDimension);
            this.previousInputEditorDimension = newDimension;
        }
        if (allowRecurse && initialEditorScrollWidth < 10) {
            // This is probably the initial layout. Now that the editor is layed out with its correct width, it should report the correct contentHeight
            return this._layout(height, width, false);
        }
    }
    getLayoutData() {
        // ###########################################################################
        // #                                                                         #
        // #    CHANGING THIS METHOD HAS RENDERING IMPLICATIONS FOR THE CHAT VIEW    #
        // #    IF YOU MAKE CHANGES HERE, PLEASE TEST THE CHAT VIEW THOROUGHLY:      #
        // #    - produce various chat responses                                     #
        // #    - click the response to get a focus outline                          #
        // #    - ensure the outline is not cut off at the bottom                    #
        // #                                                                         #
        // ###########################################################################
        const executeToolbarWidth = this.cachedExecuteToolbarWidth = this.executeToolbar.getItemsWidth();
        const inputToolbarWidth = this.cachedInputToolbarWidth = this.inputActionsToolbar.getItemsWidth();
        const inputSideToolbarWidth = this.inputSideToolbarContainer ? dom.getTotalWidth(this.inputSideToolbarContainer) : 0;
        const executeToolbarPadding = (this.executeToolbar.getItemsLength() - 1) * 4;
        const inputToolbarPadding = this.inputActionsToolbar.getItemsLength() ? (this.inputActionsToolbar.getItemsLength() - 1) * 4 : 0;
        return {
            inputEditorBorder: 2,
            followupsHeight: this.followupsContainer.offsetHeight,
            inputPartEditorHeight: Math.min(this._inputEditor.getContentHeight(), this.inputEditorMaxHeight),
            inputPartHorizontalPadding: this.options.renderStyle === 'compact' ? 16 : 32,
            inputPartVerticalPadding: this.options.renderStyle === 'compact' ? 12 : (16 /* entire part */ + 6 /* input container */ + (2 * 4) /* flex gap: todo|edits|input */),
            attachmentsHeight: this.attachmentsHeight,
            editorBorder: 2,
            inputPartHorizontalPaddingInside: 12,
            toolbarsWidth: this.options.renderStyle === 'compact' ? executeToolbarWidth + executeToolbarPadding + (this.options.renderInputToolbarBelowInput ? 0 : inputToolbarWidth + inputToolbarPadding) : 0,
            toolbarsHeight: this.options.renderStyle === 'compact' ? 0 : 22,
            chatEditingStateHeight: this.chatEditingSessionWidgetContainer.offsetHeight,
            sideToolbarWidth: inputSideToolbarWidth > 0 ? inputSideToolbarWidth + 4 /*gap*/ : 0,
            todoListWidgetContainerHeight: this.chatInputTodoListWidgetContainer.offsetHeight,
        };
    }
};
ChatInputPart = ChatInputPart_1 = __decorate([
    __param(4, IModelService),
    __param(5, IInstantiationService),
    __param(6, IContextKeyService),
    __param(7, IConfigurationService),
    __param(8, IKeybindingService),
    __param(9, IAccessibilityService),
    __param(10, ILanguageModelsService),
    __param(11, ILogService),
    __param(12, IFileService),
    __param(13, IEditorService),
    __param(14, IThemeService),
    __param(15, ITextModelService),
    __param(16, IStorageService),
    __param(17, ILabelService),
    __param(18, IChatAgentService),
    __param(19, ISharedWebContentExtractorService),
    __param(20, IWorkbenchAssignmentService),
    __param(21, IChatEntitlementService),
    __param(22, IChatModeService),
    __param(23, ILanguageModelToolsService),
    __param(24, IChatService),
    __param(25, IChatSessionsService),
    __param(26, IChatContextService)
], ChatInputPart);
export { ChatInputPart };
function getLastPosition(model) {
    return { lineNumber: model.getLineCount(), column: model.getLineLength(model.getLineCount()) + 1 };
}
const chatInputEditorContainerSelector = '.interactive-input-editor';
setupSimpleEditorSelectionStyling(chatInputEditorContainerSelector);
class ChatSessionPickersContainerActionItem extends ActionViewItem {
    constructor(action, widgets, options) {
        super(null, action, options ?? {});
        this.widgets = widgets;
    }
    render(container) {
        container.classList.add('chat-sessionPicker-container');
        for (const widget of this.widgets) {
            const itemContainer = dom.$('.action-item.chat-sessionPicker-item');
            widget.render(itemContainer);
            container.appendChild(itemContainer);
        }
    }
    dispose() {
        for (const widget of this.widgets) {
            widget.dispose();
        }
        super.dispose();
    }
}
class AddFilesButton extends ActionViewItem {
    constructor(context, action, options) {
        super(context, action, {
            ...options,
            icon: false,
            label: true,
            keybindingNotRenderedWithLabel: true,
        });
    }
    setShowLabel(show) {
        this.showLabel = show;
        this.updateLabel();
    }
    render(container) {
        container.classList.add('chat-attachment-button');
        super.render(container);
        this.updateLabel();
    }
    updateLabel() {
        if (!this.label) {
            return;
        }
        assertType(this.label);
        this.label.classList.toggle('has-label', this.showLabel);
        const message = this.showLabel ? `$(attach) ${this.action.label}` : `$(attach)`;
        dom.reset(this.label, ...renderLabelWithIcons(message));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdElucHV0UGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdElucHV0UGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUV4RSxPQUFPLEVBQUUsZUFBZSxFQUF5QixNQUFNLDJDQUEyQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxjQUFjLEVBQTBCLE1BQU0sMERBQTBELENBQUM7QUFDbEgsT0FBTyxLQUFLLElBQUksTUFBTSwwQ0FBMEMsQ0FBQztBQUNqRSxPQUFPLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ2hJLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBRTNGLE9BQU8sRUFBRSxNQUFNLElBQUksV0FBVyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDMUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRS9ELE9BQU8s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