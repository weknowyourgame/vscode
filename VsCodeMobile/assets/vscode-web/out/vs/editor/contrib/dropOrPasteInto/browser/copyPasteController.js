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
var CopyPasteController_1;
import { addDisposableListener } from '../../../../base/browser/dom.js';
import { coalesce } from '../../../../base/common/arrays.js';
import { createCancelablePromise, DeferredPromise, raceCancellation } from '../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { createStringDataTransferItem, matchesMimeType, UriList } from '../../../../base/common/dataTransfer.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { HierarchicalKind } from '../../../../base/common/hierarchicalKind.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Mimes } from '../../../../base/common/mime.js';
import * as platform from '../../../../base/common/platform.js';
import { upcast } from '../../../../base/common/types.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { localize } from '../../../../nls.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ClipboardEventUtils, InMemoryClipboardMetadataManager } from '../../../browser/controller/editContext/clipboardUtils.js';
import { toExternalVSDataTransfer, toVSDataTransfer } from '../../../browser/dataTransfer.js';
import { IBulkEditService } from '../../../browser/services/bulkEditService.js';
import { Range } from '../../../common/core/range.js';
import { DocumentPasteTriggerKind } from '../../../common/languages.js';
import { ILanguageFeaturesService } from '../../../common/services/languageFeatures.js';
import { EditorStateCancellationTokenSource } from '../../editorState/browser/editorState.js';
import { InlineProgressManager } from '../../inlineProgress/browser/inlineProgress.js';
import { MessageController } from '../../message/browser/messageController.js';
import { DefaultTextPasteOrDropEditProvider } from './defaultProviders.js';
import { createCombinedWorkspaceEdit, sortEditsByYieldTo } from './edit.js';
import { PostEditWidgetManager } from './postEditWidget.js';
export const changePasteTypeCommandId = 'editor.changePasteType';
export const pasteAsPreferenceConfig = 'editor.pasteAs.preferences';
export const pasteWidgetVisibleCtx = new RawContextKey('pasteWidgetVisible', false, localize('pasteWidgetVisible', "Whether the paste widget is showing"));
const vscodeClipboardMime = 'application/vnd.code.copymetadata';
let CopyPasteController = class CopyPasteController extends Disposable {
    static { CopyPasteController_1 = this; }
    static { this.ID = 'editor.contrib.copyPasteActionController'; }
    static get(editor) {
        return editor.getContribution(CopyPasteController_1.ID);
    }
    static setConfigureDefaultAction(action) {
        CopyPasteController_1._configureDefaultAction = action;
    }
    constructor(editor, instantiationService, _logService, _bulkEditService, _clipboardService, _commandService, _configService, _languageFeaturesService, _quickInputService, _progressService) {
        super();
        this._logService = _logService;
        this._bulkEditService = _bulkEditService;
        this._clipboardService = _clipboardService;
        this._commandService = _commandService;
        this._configService = _configService;
        this._languageFeaturesService = _languageFeaturesService;
        this._quickInputService = _quickInputService;
        this._progressService = _progressService;
        this._editor = editor;
        const container = editor.getContainerDomNode();
        this._register(addDisposableListener(container, 'copy', e => this.handleCopy(e)));
        this._register(addDisposableListener(container, 'cut', e => this.handleCopy(e)));
        this._register(addDisposableListener(container, 'paste', e => this.handlePaste(e), true));
        this._pasteProgressManager = this._register(new InlineProgressManager('pasteIntoEditor', editor, instantiationService));
        this._postPasteWidgetManager = this._register(instantiationService.createInstance(PostEditWidgetManager, 'pasteIntoEditor', editor, pasteWidgetVisibleCtx, { id: changePasteTypeCommandId, label: localize('postPasteWidgetTitle', "Show paste options...") }, () => CopyPasteController_1._configureDefaultAction ? [CopyPasteController_1._configureDefaultAction] : []));
    }
    changePasteType() {
        this._postPasteWidgetManager.tryShowSelector();
    }
    async pasteAs(preferred) {
        this._logService.trace('CopyPasteController.pasteAs');
        this._editor.focus();
        try {
            this._logService.trace('Before calling editor.action.clipboardPasteAction');
            this._pasteAsActionContext = { preferred };
            await this._commandService.executeCommand('editor.action.clipboardPasteAction');
        }
        finally {
            this._pasteAsActionContext = undefined;
        }
    }
    clearWidgets() {
        this._postPasteWidgetManager.clear();
    }
    isPasteAsEnabled() {
        return this._editor.getOption(97 /* EditorOption.pasteAs */).enabled;
    }
    async finishedPaste() {
        await this._currentPasteOperation;
    }
    handleCopy(e) {
        let id = null;
        if (e.clipboardData) {
            const [text, metadata] = ClipboardEventUtils.getTextData(e.clipboardData);
            const storedMetadata = metadata || InMemoryClipboardMetadataManager.INSTANCE.get(text);
            id = storedMetadata?.id || null;
            this._logService.trace('CopyPasteController#handleCopy for id : ', id, ' with text.length : ', text.length);
        }
        else {
            this._logService.trace('CopyPasteController#handleCopy');
        }
        if (!this._editor.hasTextFocus()) {
            return;
        }
        // Explicitly clear the clipboard internal state.
        // This is needed because on web, the browser clipboard is faked out using an in-memory store.
        // This means the resources clipboard is not properly updated when copying from the editor.
        this._clipboardService.clearInternalState?.();
        if (!e.clipboardData || !this.isPasteAsEnabled()) {
            return;
        }
        const model = this._editor.getModel();
        const selections = this._editor.getSelections();
        if (!model || !selections?.length) {
            return;
        }
        const enableEmptySelectionClipboard = this._editor.getOption(45 /* EditorOption.emptySelectionClipboard */);
        let ranges = selections;
        const wasFromEmptySelection = selections.length === 1 && selections[0].isEmpty();
        if (wasFromEmptySelection) {
            if (!enableEmptySelectionClipboard) {
                return;
            }
            ranges = [new Range(ranges[0].startLineNumber, 1, ranges[0].startLineNumber, 1 + model.getLineLength(ranges[0].startLineNumber))];
        }
        const toCopy = this._editor._getViewModel()?.getPlainTextToCopy(selections, enableEmptySelectionClipboard, platform.isWindows);
        const multicursorText = Array.isArray(toCopy) ? toCopy : null;
        const defaultPastePayload = {
            multicursorText,
            pasteOnNewLine: wasFromEmptySelection,
            mode: null
        };
        const providers = this._languageFeaturesService.documentPasteEditProvider
            .ordered(model)
            .filter(x => !!x.prepareDocumentPaste);
        if (!providers.length) {
            this.setCopyMetadata(e.clipboardData, { defaultPastePayload });
            return;
        }
        const dataTransfer = toVSDataTransfer(e.clipboardData);
        const providerCopyMimeTypes = providers.flatMap(x => x.copyMimeTypes ?? []);
        // Save off a handle pointing to data that VS Code maintains.
        const handle = id ?? generateUuid();
        this.setCopyMetadata(e.clipboardData, {
            id: handle,
            providerCopyMimeTypes,
            defaultPastePayload
        });
        const operations = providers.map((provider) => {
            return {
                providerMimeTypes: provider.copyMimeTypes,
                operation: createCancelablePromise(token => provider.prepareDocumentPaste(model, ranges, dataTransfer, token)
                    .catch(err => {
                    console.error(err);
                    return undefined;
                }))
            };
        });
        CopyPasteController_1._currentCopyOperation?.operations.forEach(entry => entry.operation.cancel());
        CopyPasteController_1._currentCopyOperation = { handle, operations };
    }
    async handlePaste(e) {
        if (e.clipboardData) {
            const [text, metadata] = ClipboardEventUtils.getTextData(e.clipboardData);
            const metadataComputed = metadata || InMemoryClipboardMetadataManager.INSTANCE.get(text);
            this._logService.trace('CopyPasteController#handlePaste for id : ', metadataComputed?.id);
        }
        else {
            this._logService.trace('CopyPasteController#handlePaste');
        }
        if (!e.clipboardData || !this._editor.hasTextFocus()) {
            return;
        }
        MessageController.get(this._editor)?.closeMessage();
        this._currentPasteOperation?.cancel();
        this._currentPasteOperation = undefined;
        const model = this._editor.getModel();
        const selections = this._editor.getSelections();
        if (!selections?.length || !model) {
            return;
        }
        if (this._editor.getOption(104 /* EditorOption.readOnly */) // Never enabled if editor is readonly.
            || (!this.isPasteAsEnabled() && !this._pasteAsActionContext) // Or feature disabled (but still enable if paste was explicitly requested)
        ) {
            return;
        }
        const metadata = this.fetchCopyMetadata(e);
        this._logService.trace('CopyPasteController#handlePaste with metadata : ', metadata?.id, ' and text.length : ', e.clipboardData.getData('text/plain').length);
        const dataTransfer = toExternalVSDataTransfer(e.clipboardData);
        dataTransfer.delete(vscodeClipboardMime);
        const fileTypes = Array.from(e.clipboardData.files).map(file => file.type);
        const allPotentialMimeTypes = [
            ...e.clipboardData.types,
            ...fileTypes,
            ...metadata?.providerCopyMimeTypes ?? [],
            // TODO: always adds `uri-list` because this get set if there are resources in the system clipboard.
            // However we can only check the system clipboard async. For this early check, just add it in.
            // We filter providers again once we have the final dataTransfer we will use.
            Mimes.uriList,
        ];
        const allProviders = this._languageFeaturesService.documentPasteEditProvider
            .ordered(model)
            .filter(provider => {
            // Filter out providers that don't match the requested paste types
            const preference = this._pasteAsActionContext?.preferred;
            if (preference) {
                if (!this.providerMatchesPreference(provider, preference)) {
                    return false;
                }
            }
            // And providers that don't handle any of mime types in the clipboard
            return provider.pasteMimeTypes?.some(type => matchesMimeType(type, allPotentialMimeTypes));
        });
        if (!allProviders.length) {
            if (this._pasteAsActionContext?.preferred) {
                this.showPasteAsNoEditMessage(selections, this._pasteAsActionContext.preferred);
                // Also prevent default paste from applying
                e.preventDefault();
                e.stopImmediatePropagation();
            }
            return;
        }
        // Prevent the editor's default paste handler from running.
        // Note that after this point, we are fully responsible for handling paste.
        // If we can't provider a paste for any reason, we need to explicitly delegate pasting back to the editor.
        e.preventDefault();
        e.stopImmediatePropagation();
        if (this._pasteAsActionContext) {
            this.showPasteAsPick(this._pasteAsActionContext.preferred, allProviders, selections, dataTransfer, metadata);
        }
        else {
            this.doPasteInline(allProviders, selections, dataTransfer, metadata, e);
        }
    }
    showPasteAsNoEditMessage(selections, preference) {
        const kindLabel = 'only' in preference
            ? preference.only.value
            : 'preferences' in preference
                ? (preference.preferences.length ? preference.preferences.map(preference => preference.value).join(', ') : localize('noPreferences', "empty"))
                : preference.providerId;
        MessageController.get(this._editor)?.showMessage(localize('pasteAsError', "No paste edits for '{0}' found", kindLabel), selections[0].getStartPosition());
    }
    doPasteInline(allProviders, selections, dataTransfer, metadata, clipboardEvent) {
        this._logService.trace('CopyPasteController#doPasteInline');
        const editor = this._editor;
        if (!editor.hasModel()) {
            return;
        }
        const editorStateCts = new EditorStateCancellationTokenSource(editor, 1 /* CodeEditorStateFlag.Value */ | 2 /* CodeEditorStateFlag.Selection */, undefined);
        const p = createCancelablePromise(async (pToken) => {
            const editor = this._editor;
            if (!editor.hasModel()) {
                return;
            }
            const model = editor.getModel();
            const disposables = new DisposableStore();
            const cts = disposables.add(new CancellationTokenSource(pToken));
            disposables.add(editorStateCts.token.onCancellationRequested(() => cts.cancel()));
            const token = cts.token;
            try {
                await this.mergeInDataFromCopy(allProviders, dataTransfer, metadata, token);
                if (token.isCancellationRequested) {
                    return;
                }
                const supportedProviders = allProviders.filter(provider => this.isSupportedPasteProvider(provider, dataTransfer));
                if (!supportedProviders.length
                    || (supportedProviders.length === 1 && supportedProviders[0] instanceof DefaultTextPasteOrDropEditProvider) // Only our default text provider is active
                ) {
                    return this.applyDefaultPasteHandler(dataTransfer, metadata, token, clipboardEvent);
                }
                const context = {
                    triggerKind: DocumentPasteTriggerKind.Automatic,
                };
                const editSession = await this.getPasteEdits(supportedProviders, dataTransfer, model, selections, context, token);
                disposables.add(editSession);
                if (token.isCancellationRequested) {
                    return;
                }
                // If the only edit returned is our default text edit, use the default paste handler
                if (editSession.edits.length === 1 && editSession.edits[0].provider instanceof DefaultTextPasteOrDropEditProvider) {
                    return this.applyDefaultPasteHandler(dataTransfer, metadata, token, clipboardEvent);
                }
                if (editSession.edits.length) {
                    const canShowWidget = editor.getOption(97 /* EditorOption.pasteAs */).showPasteSelector === 'afterPaste';
                    return this._postPasteWidgetManager.applyEditAndShowIfNeeded(selections, { activeEditIndex: this.getInitialActiveEditIndex(model, editSession.edits), allEdits: editSession.edits }, canShowWidget, async (edit, resolveToken) => {
                        if (!edit.provider.resolveDocumentPasteEdit) {
                            return edit;
                        }
                        const resolveP = edit.provider.resolveDocumentPasteEdit(edit, resolveToken);
                        const showP = new DeferredPromise();
                        const resolved = await this._pasteProgressManager.showWhile(selections[0].getEndPosition(), localize('resolveProcess', "Resolving paste edit for '{0}'. Click to cancel", edit.title), raceCancellation(Promise.race([showP.p, resolveP]), resolveToken), {
                            cancel: () => showP.cancel()
                        }, 0);
                        if (resolved) {
                            edit.insertText = resolved.insertText;
                            edit.additionalEdit = resolved.additionalEdit;
                        }
                        return edit;
                    }, token);
                }
                await this.applyDefaultPasteHandler(dataTransfer, metadata, token, clipboardEvent);
            }
            finally {
                disposables.dispose();
                if (this._currentPasteOperation === p) {
                    this._currentPasteOperation = undefined;
                }
            }
        });
        this._pasteProgressManager.showWhile(selections[0].getEndPosition(), localize('pasteIntoEditorProgress', "Running paste handlers. Click to cancel and do basic paste"), p, {
            cancel: async () => {
                p.cancel();
                if (editorStateCts.token.isCancellationRequested) {
                    return;
                }
                await this.applyDefaultPasteHandler(dataTransfer, metadata, editorStateCts.token, clipboardEvent);
            }
        }).finally(() => {
            editorStateCts.dispose();
        });
        this._currentPasteOperation = p;
    }
    showPasteAsPick(preference, allProviders, selections, dataTransfer, metadata) {
        this._logService.trace('CopyPasteController#showPasteAsPick');
        const p = createCancelablePromise(async (token) => {
            const editor = this._editor;
            if (!editor.hasModel()) {
                return;
            }
            const model = editor.getModel();
            const disposables = new DisposableStore();
            const tokenSource = disposables.add(new EditorStateCancellationTokenSource(editor, 1 /* CodeEditorStateFlag.Value */ | 2 /* CodeEditorStateFlag.Selection */, undefined, token));
            try {
                await this.mergeInDataFromCopy(allProviders, dataTransfer, metadata, tokenSource.token);
                if (tokenSource.token.isCancellationRequested) {
                    return;
                }
                // Filter out any providers the don't match the full data transfer we will send them.
                let supportedProviders = allProviders.filter(provider => this.isSupportedPasteProvider(provider, dataTransfer, preference));
                if (preference) {
                    // We are looking for a specific edit
                    supportedProviders = supportedProviders.filter(provider => this.providerMatchesPreference(provider, preference));
                }
                const context = {
                    triggerKind: DocumentPasteTriggerKind.PasteAs,
                    only: preference && 'only' in preference ? preference.only : undefined,
                };
                let editSession = disposables.add(await this.getPasteEdits(supportedProviders, dataTransfer, model, selections, context, tokenSource.token));
                if (tokenSource.token.isCancellationRequested) {
                    return;
                }
                // Filter out any edits that don't match the requested kind
                if (preference) {
                    editSession = {
                        edits: editSession.edits.filter(edit => {
                            if ('only' in preference) {
                                return preference.only.contains(edit.kind);
                            }
                            else if ('preferences' in preference) {
                                return preference.preferences.some(preference => preference.contains(edit.kind));
                            }
                            else {
                                return preference.providerId === edit.provider.id;
                            }
                        }),
                        dispose: editSession.dispose
                    };
                }
                if (!editSession.edits.length) {
                    if (preference) {
                        this.showPasteAsNoEditMessage(selections, preference);
                    }
                    return;
                }
                let pickedEdit;
                if (preference) {
                    pickedEdit = editSession.edits.at(0);
                }
                else {
                    const configureDefaultItem = {
                        id: 'editor.pasteAs.default',
                        label: localize('pasteAsDefault', "Configure default paste action"),
                        edit: undefined,
                    };
                    const selected = await this._quickInputService.pick([
                        ...editSession.edits.map((edit) => ({
                            label: edit.title,
                            description: edit.kind?.value,
                            edit,
                        })),
                        ...(CopyPasteController_1._configureDefaultAction ? [
                            upcast({ type: 'separator' }),
                            {
                                label: CopyPasteController_1._configureDefaultAction.label,
                                edit: undefined,
                            }
                        ] : [])
                    ], {
                        placeHolder: localize('pasteAsPickerPlaceholder', "Select Paste Action"),
                    });
                    if (selected === configureDefaultItem) {
                        CopyPasteController_1._configureDefaultAction?.run();
                        return;
                    }
                    pickedEdit = selected?.edit;
                }
                if (!pickedEdit) {
                    return;
                }
                const combinedWorkspaceEdit = createCombinedWorkspaceEdit(model.uri, selections, pickedEdit);
                await this._bulkEditService.apply(combinedWorkspaceEdit, { editor: this._editor });
            }
            finally {
                disposables.dispose();
                if (this._currentPasteOperation === p) {
                    this._currentPasteOperation = undefined;
                }
            }
        });
        this._progressService.withProgress({
            location: 10 /* ProgressLocation.Window */,
            title: localize('pasteAsProgress', "Running paste handlers"),
        }, () => p);
    }
    setCopyMetadata(dataTransfer, metadata) {
        this._logService.trace('CopyPasteController#setCopyMetadata new id : ', metadata.id);
        dataTransfer.setData(vscodeClipboardMime, JSON.stringify(metadata));
    }
    fetchCopyMetadata(e) {
        this._logService.trace('CopyPasteController#fetchCopyMetadata');
        if (!e.clipboardData) {
            return;
        }
        // Prefer using the clipboard data we saved off
        const rawMetadata = e.clipboardData.getData(vscodeClipboardMime);
        if (rawMetadata) {
            try {
                return JSON.parse(rawMetadata);
            }
            catch {
                return undefined;
            }
        }
        // Otherwise try to extract the generic text editor metadata
        const [_, metadata] = ClipboardEventUtils.getTextData(e.clipboardData);
        if (metadata) {
            return {
                defaultPastePayload: {
                    mode: metadata.mode,
                    multicursorText: metadata.multicursorText ?? null,
                    pasteOnNewLine: !!metadata.isFromEmptySelection,
                },
            };
        }
        return undefined;
    }
    async mergeInDataFromCopy(allProviders, dataTransfer, metadata, token) {
        this._logService.trace('CopyPasteController#mergeInDataFromCopy with metadata : ', metadata?.id);
        if (metadata?.id && CopyPasteController_1._currentCopyOperation?.handle === metadata.id) {
            // Only resolve providers that have data we may care about
            const toResolve = CopyPasteController_1._currentCopyOperation.operations
                .filter(op => allProviders.some(provider => provider.pasteMimeTypes.some(type => matchesMimeType(type, op.providerMimeTypes))))
                .map(op => op.operation);
            const toMergeResults = await Promise.all(toResolve);
            if (token.isCancellationRequested) {
                return;
            }
            // Values from higher priority providers should overwrite values from lower priority ones.
            // Reverse the array to so that the calls to `DataTransfer.replace` later will do this
            for (const toMergeData of toMergeResults.reverse()) {
                if (toMergeData) {
                    for (const [key, value] of toMergeData) {
                        dataTransfer.replace(key, value);
                    }
                }
            }
        }
        if (!dataTransfer.has(Mimes.uriList)) {
            const resources = await this._clipboardService.readResources();
            if (token.isCancellationRequested) {
                return;
            }
            if (resources.length) {
                dataTransfer.append(Mimes.uriList, createStringDataTransferItem(UriList.create(resources)));
            }
        }
    }
    async getPasteEdits(providers, dataTransfer, model, selections, context, token) {
        const disposables = new DisposableStore();
        const results = await raceCancellation(Promise.all(providers.map(async (provider) => {
            try {
                const edits = await provider.provideDocumentPasteEdits?.(model, selections, dataTransfer, context, token);
                if (edits) {
                    disposables.add(edits);
                }
                return edits?.edits?.map(edit => ({ ...edit, provider }));
            }
            catch (err) {
                if (!isCancellationError(err)) {
                    console.error(err);
                }
                return undefined;
            }
        })), token);
        const edits = coalesce(results ?? []).flat().filter(edit => {
            return !context.only || context.only.contains(edit.kind);
        });
        return {
            edits: sortEditsByYieldTo(edits),
            dispose: () => disposables.dispose()
        };
    }
    async applyDefaultPasteHandler(dataTransfer, metadata, token, clipboardEvent) {
        const textDataTransfer = dataTransfer.get(Mimes.text) ?? dataTransfer.get('text');
        const text = (await textDataTransfer?.asString()) ?? '';
        if (token.isCancellationRequested) {
            return;
        }
        const payload = {
            clipboardEvent,
            text,
            pasteOnNewLine: metadata?.defaultPastePayload.pasteOnNewLine ?? false,
            multicursorText: metadata?.defaultPastePayload.multicursorText ?? null,
            mode: null,
        };
        this._logService.trace('CopyPasteController#applyDefaultPasteHandler for id : ', metadata?.id);
        this._editor.trigger('keyboard', "paste" /* Handler.Paste */, payload);
    }
    /**
     * Filter out providers if they:
     * - Don't handle any of the data transfer types we have
     * - Don't match the preferred paste kind
     */
    isSupportedPasteProvider(provider, dataTransfer, preference) {
        if (!provider.pasteMimeTypes?.some(type => dataTransfer.matches(type))) {
            return false;
        }
        return !preference || this.providerMatchesPreference(provider, preference);
    }
    providerMatchesPreference(provider, preference) {
        if ('only' in preference) {
            return provider.providedPasteEditKinds.some(providedKind => preference.only.contains(providedKind));
        }
        else if ('preferences' in preference) {
            return preference.preferences.some(providedKind => preference.preferences.some(preferredKind => preferredKind.contains(providedKind)));
        }
        else {
            return provider.id === preference.providerId;
        }
    }
    getInitialActiveEditIndex(model, edits) {
        const preferredProviders = this._configService.getValue(pasteAsPreferenceConfig, { resource: model.uri });
        for (const config of Array.isArray(preferredProviders) ? preferredProviders : []) {
            const desiredKind = new HierarchicalKind(config);
            const editIndex = edits.findIndex(edit => desiredKind.contains(edit.kind));
            if (editIndex >= 0) {
                return editIndex;
            }
        }
        return 0;
    }
};
CopyPasteController = CopyPasteController_1 = __decorate([
    __param(1, IInstantiationService),
    __param(2, ILogService),
    __param(3, IBulkEditService),
    __param(4, IClipboardService),
    __param(5, ICommandService),
    __param(6, IConfigurationService),
    __param(7, ILanguageFeaturesService),
    __param(8, IQuickInputService),
    __param(9, IProgressService)
], CopyPasteController);
export { CopyPasteController };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29weVBhc3RlQ29udHJvbGxlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9kcm9wT3JQYXN0ZUludG8vYnJvd3Nlci9jb3B5UGFzdGVDb250cm9sbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUV4RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDN0QsT0FBTyxFQUFxQix1QkFBdUIsRUFBRSxlQUFlLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNqSSxPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckcsT0FBTyxFQUFFLDRCQUE0QixFQUEyQixlQUFlLEVBQUUsT0FBTyxFQUFrQixNQUFNLHlDQUF5QyxDQUFDO0FBQzFKLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbkYsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3hELE9BQU8sS0FBSyxRQUFRLE1BQU0scUNBQXFDLENBQUM7QUFDaEUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDOUYsT0FBTyxFQUFF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