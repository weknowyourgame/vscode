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
var MainThreadLanguageFeatures_1;
import { createStringDataTransferItem, VSDataTransfer } from '../../../base/common/dataTransfer.js';
import { CancellationError } from '../../../base/common/errors.js';
import { Emitter } from '../../../base/common/event.js';
import { HierarchicalKind } from '../../../base/common/hierarchicalKind.js';
import { combinedDisposable, Disposable, DisposableMap, toDisposable } from '../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../base/common/map.js';
import { revive } from '../../../base/common/marshalling.js';
import { mixin } from '../../../base/common/objects.js';
import { URI } from '../../../base/common/uri.js';
import * as languages from '../../../editor/common/languages.js';
import { ILanguageService } from '../../../editor/common/languages/language.js';
import { ILanguageConfigurationService } from '../../../editor/common/languages/languageConfigurationRegistry.js';
import { ILanguageFeaturesService } from '../../../editor/common/services/languageFeatures.js';
import { decodeSemanticTokensDto } from '../../../editor/common/services/semanticTokensDto.js';
import { IUriIdentityService } from '../../../platform/uriIdentity/common/uriIdentity.js';
import { reviveWorkspaceEditDto } from './mainThreadBulkEdits.js';
import * as typeConvert from '../common/extHostTypeConverters.js';
import { DataTransferFileCache } from '../common/shared/dataTransferCache.js';
import * as callh from '../../contrib/callHierarchy/common/callHierarchy.js';
import * as search from '../../contrib/search/common/search.js';
import * as typeh from '../../contrib/typeHierarchy/common/typeHierarchy.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { InlineCompletionEndOfLifeReasonKind } from '../common/extHostTypes.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { DataChannelForwardingTelemetryService, forwardToChannelIf, isCopilotLikeExtension } from '../../../platform/dataChannel/browser/forwardingTelemetryService.js';
import { IAiEditTelemetryService } from '../../contrib/editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js';
import { EditDeltaInfo } from '../../../editor/common/textModelEditSource.js';
import { IInlineCompletionsUnificationService } from '../../services/inlineCompletions/common/inlineCompletionsUnification.js';
import { sendInlineCompletionsEndOfLifeTelemetry } from '../../../editor/contrib/inlineCompletions/browser/telemetry.js';
let MainThreadLanguageFeatures = MainThreadLanguageFeatures_1 = class MainThreadLanguageFeatures extends Disposable {
    constructor(extHostContext, _languageService, _languageConfigurationService, _languageFeaturesService, _uriIdentService, _instantiationService, _inlineCompletionsUnificationService, _aiEditTelemetryService) {
        super();
        this._languageService = _languageService;
        this._languageConfigurationService = _languageConfigurationService;
        this._languageFeaturesService = _languageFeaturesService;
        this._uriIdentService = _uriIdentService;
        this._instantiationService = _instantiationService;
        this._inlineCompletionsUnificationService = _inlineCompletionsUnificationService;
        this._aiEditTelemetryService = _aiEditTelemetryService;
        this._registrations = this._register(new DisposableMap());
        // --- copy paste action provider
        this._pasteEditProviders = new Map();
        // --- document drop Edits
        this._documentOnDropEditProviders = new Map();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostLanguageFeatures);
        if (this._languageService) {
            const updateAllWordDefinitions = () => {
                const wordDefinitionDtos = [];
                for (const languageId of _languageService.getRegisteredLanguageIds()) {
                    const wordDefinition = this._languageConfigurationService.getLanguageConfiguration(languageId).getWordDefinition();
                    wordDefinitionDtos.push({
                        languageId: languageId,
                        regexSource: wordDefinition.source,
                        regexFlags: wordDefinition.flags
                    });
                }
                this._proxy.$setWordDefinitions(wordDefinitionDtos);
            };
            this._register(this._languageConfigurationService.onDidChange((e) => {
                if (!e.languageId) {
                    updateAllWordDefinitions();
                }
                else {
                    const wordDefinition = this._languageConfigurationService.getLanguageConfiguration(e.languageId).getWordDefinition();
                    this._proxy.$setWordDefinitions([{
                            languageId: e.languageId,
                            regexSource: wordDefinition.source,
                            regexFlags: wordDefinition.flags
                        }]);
                }
            }));
            updateAllWordDefinitions();
        }
        if (this._inlineCompletionsUnificationService) {
            this._register(this._inlineCompletionsUnificationService.onDidStateChange(() => {
                this._proxy.$acceptInlineCompletionsUnificationState(this._inlineCompletionsUnificationService.state);
            }));
            this._proxy.$acceptInlineCompletionsUnificationState(this._inlineCompletionsUnificationService.state);
        }
    }
    $unregister(handle) {
        this._registrations.deleteAndDispose(handle);
    }
    static _reviveLocationDto(data) {
        if (!data) {
            return data;
        }
        else if (Array.isArray(data)) {
            data.forEach(l => MainThreadLanguageFeatures_1._reviveLocationDto(l));
            return data;
        }
        else {
            data.uri = URI.revive(data.uri);
            return data;
        }
    }
    static _reviveLocationLinkDto(data) {
        if (!data) {
            return data;
        }
        else if (Array.isArray(data)) {
            data.forEach(l => MainThreadLanguageFeatures_1._reviveLocationLinkDto(l));
            return data;
        }
        else {
            data.uri = URI.revive(data.uri);
            return data;
        }
    }
    static _reviveWorkspaceSymbolDto(data) {
        if (!data) {
            return data;
        }
        else if (Array.isArray(data)) {
            data.forEach(MainThreadLanguageFeatures_1._reviveWorkspaceSymbolDto);
            return data;
        }
        else {
            data.location = MainThreadLanguageFeatures_1._reviveLocationDto(data.location);
            return data;
        }
    }
    static _reviveCodeActionDto(data, uriIdentService) {
        data?.forEach(code => reviveWorkspaceEditDto(code.edit, uriIdentService));
        return data;
    }
    static _reviveLinkDTO(data) {
        if (data.url && typeof data.url !== 'string') {
            data.url = URI.revive(data.url);
        }
        return data;
    }
    static _reviveCallHierarchyItemDto(data) {
        if (data) {
            data.uri = URI.revive(data.uri);
        }
        return data;
    }
    static _reviveTypeHierarchyItemDto(data) {
        if (data) {
            data.uri = URI.revive(data.uri);
        }
        return data;
    }
    //#endregion
    // --- outline
    $registerDocumentSymbolProvider(handle, selector, displayName) {
        this._registrations.set(handle, this._languageFeaturesService.documentSymbolProvider.register(selector, {
            displayName,
            provideDocumentSymbols: (model, token) => {
                return this._proxy.$provideDocumentSymbols(handle, model.uri, token);
            }
        }));
    }
    // --- code lens
    $registerCodeLensSupport(handle, selector, eventHandle) {
        const provider = {
            provideCodeLenses: async (model, token) => {
                const listDto = await this._proxy.$provideCodeLenses(handle, model.uri, token);
                if (!listDto) {
                    return undefined;
                }
                return {
                    lenses: listDto.lenses,
                    dispose: () => listDto.cacheId && this._proxy.$releaseCodeLenses(handle, listDto.cacheId)
                };
            },
            resolveCodeLens: async (model, codeLens, token) => {
                const result = await this._proxy.$resolveCodeLens(handle, codeLens, token);
                if (!result || token.isCancellationRequested) {
                    return undefined;
                }
                return {
                    ...result,
                    range: model.validateRange(result.range),
                };
            }
        };
        if (typeof eventHandle === 'number') {
            const emitter = new Emitter();
            this._registrations.set(eventHandle, emitter);
            provider.onDidChange = emitter.event;
        }
        this._registrations.set(handle, this._languageFeaturesService.codeLensProvider.register(selector, provider));
    }
    $emitCodeLensEvent(eventHandle, event) {
        const obj = this._registrations.get(eventHandle);
        if (obj instanceof Emitter) {
            obj.fire(event);
        }
    }
    // --- declaration
    $registerDefinitionSupport(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.definitionProvider.register(selector, {
            provideDefinition: (model, position, token) => {
                return this._proxy.$provideDefinition(handle, model.uri, position, token).then(MainThreadLanguageFeatures_1._reviveLocationLinkDto);
            }
        }));
    }
    $registerDeclarationSupport(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.declarationProvider.register(selector, {
            provideDeclaration: (model, position, token) => {
                return this._proxy.$provideDeclaration(handle, model.uri, position, token).then(MainThreadLanguageFeatures_1._reviveLocationLinkDto);
            }
        }));
    }
    $registerImplementationSupport(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.implementationProvider.register(selector, {
            provideImplementation: (model, position, token) => {
                return this._proxy.$provideImplementation(handle, model.uri, position, token).then(MainThreadLanguageFeatures_1._reviveLocationLinkDto);
            }
        }));
    }
    $registerTypeDefinitionSupport(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.typeDefinitionProvider.register(selector, {
            provideTypeDefinition: (model, position, token) => {
                return this._proxy.$provideTypeDefinition(handle, model.uri, position, token).then(MainThreadLanguageFeatures_1._reviveLocationLinkDto);
            }
        }));
    }
    // --- extra info
    $registerHoverProvider(handle, selector) {
        /*
        const hoverFinalizationRegistry = new FinalizationRegistry((hoverId: number) => {
            this._proxy.$releaseHover(handle, hoverId);
        });
        */
        this._registrations.set(handle, this._languageFeaturesService.hoverProvider.register(selector, {
            provideHover: async (model, position, token, context) => {
                const serializedContext = {
                    verbosityRequest: context?.verbosityRequest ? {
                        verbosityDelta: context.verbosityRequest.verbosityDelta,
                        previousHover: { id: context.verbosityRequest.previousHover.id }
                    } : undefined,
                };
                const hover = await this._proxy.$provideHover(handle, model.uri, position, serializedContext, token);
                // hoverFinalizationRegistry.register(hover, hover.id);
                return hover;
            }
        }));
    }
    // --- debug hover
    $registerEvaluatableExpressionProvider(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.evaluatableExpressionProvider.register(selector, {
            provideEvaluatableExpression: (model, position, token) => {
                return this._proxy.$provideEvaluatableExpression(handle, model.uri, position, token);
            }
        }));
    }
    // --- inline values
    $registerInlineValuesProvider(handle, selector, eventHandle) {
        const provider = {
            provideInlineValues: (model, viewPort, context, token) => {
                return this._proxy.$provideInlineValues(handle, model.uri, viewPort, context, token);
            }
        };
        if (typeof eventHandle === 'number') {
            const emitter = new Emitter();
            this._registrations.set(eventHandle, emitter);
            provider.onDidChangeInlineValues = emitter.event;
        }
        this._registrations.set(handle, this._languageFeaturesService.inlineValuesProvider.register(selector, provider));
    }
    $emitInlineValuesEvent(eventHandle, event) {
        const obj = this._registrations.get(eventHandle);
        if (obj instanceof Emitter) {
            obj.fire(event);
        }
    }
    // --- occurrences
    $registerDocumentHighlightProvider(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.documentHighlightProvider.register(selector, {
            provideDocumentHighlights: (model, position, token) => {
                return this._proxy.$provideDocumentHighlights(handle, model.uri, position, token);
            }
        }));
    }
    $registerMultiDocumentHighlightProvider(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.multiDocumentHighlightProvider.register(selector, {
            selector: selector,
            provideMultiDocumentHighlights: (model, position, otherModels, token) => {
                return this._proxy.$provideMultiDocumentHighlights(handle, model.uri, position, otherModels.map(model => model.uri), token).then(dto => {
                    // dto should be non-null + non-undefined
                    // dto length of 0 is valid, just no highlights, pass this through.
                    if (dto === undefined || dto === null) {
                        return undefined;
                    }
                    const result = new ResourceMap();
                    dto?.forEach(value => {
                        // check if the URI exists already, if so, combine the highlights, otherwise create a new entry
                        const uri = URI.revive(value.uri);
                        if (result.has(uri)) {
                            result.get(uri).push(...value.highlights);
                        }
                        else {
                            result.set(uri, value.highlights);
                        }
                    });
                    return result;
                });
            }
        }));
    }
    // --- linked editing
    $registerLinkedEditingRangeProvider(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.linkedEditingRangeProvider.register(selector, {
            provideLinkedEditingRanges: async (model, position, token) => {
                const res = await this._proxy.$provideLinkedEditingRanges(handle, model.uri, position, token);
                if (res) {
                    return {
                        ranges: res.ranges,
                        wordPattern: res.wordPattern ? MainThreadLanguageFeatures_1._reviveRegExp(res.wordPattern) : undefined
                    };
                }
                return undefined;
            }
        }));
    }
    // --- references
    $registerReferenceSupport(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.referenceProvider.register(selector, {
            provideReferences: (model, position, context, token) => {
                return this._proxy.$provideReferences(handle, model.uri, position, context, token).then(MainThreadLanguageFeatures_1._reviveLocationDto);
            }
        }));
    }
    // --- code actions
    $registerCodeActionSupport(handle, selector, metadata, displayName, extensionId, supportsResolve) {
        const provider = {
            provideCodeActions: async (model, rangeOrSelection, context, token) => {
                const listDto = await this._proxy.$provideCodeActions(handle, model.uri, rangeOrSelection, context, token);
                if (!listDto) {
                    return undefined;
                }
                return {
                    actions: MainThreadLanguageFeatures_1._reviveCodeActionDto(listDto.actions, this._uriIdentService),
                    dispose: () => {
                        if (typeof listDto.cacheId === 'number') {
                            this._proxy.$releaseCodeActions(handle, listDto.cacheId);
                        }
                    }
                };
            },
            providedCodeActionKinds: metadata.providedKinds,
            documentation: metadata.documentation,
            displayName,
            extensionId,
        };
        if (supportsResolve) {
            provider.resolveCodeAction = async (codeAction, token) => {
                const resolved = await this._proxy.$resolveCodeAction(handle, codeAction.cacheId, token);
                if (resolved.edit) {
                    codeAction.edit = reviveWorkspaceEditDto(resolved.edit, this._uriIdentService);
                }
                if (resolved.command) {
                    codeAction.command = resolved.command;
                }
                return codeAction;
            };
        }
        this._registrations.set(handle, this._languageFeaturesService.codeActionProvider.register(selector, provider));
    }
    $registerPasteEditProvider(handle, selector, metadata) {
        const provider = new MainThreadPasteEditProvider(handle, this._proxy, metadata, this._uriIdentService);
        this._pasteEditProviders.set(handle, provider);
        this._registrations.set(handle, combinedDisposable(this._languageFeaturesService.documentPasteEditProvider.register(selector, provider), toDisposable(() => this._pasteEditProviders.delete(handle))));
    }
    $resolvePasteFileData(handle, requestId, dataId) {
        const provider = this._pasteEditProviders.get(handle);
        if (!provider) {
            throw new Error('Could not find provider');
        }
        return provider.resolveFileData(requestId, dataId);
    }
    // --- formatting
    $registerDocumentFormattingSupport(handle, selector, extensionId, displayName) {
        this._registrations.set(handle, this._languageFeaturesService.documentFormattingEditProvider.register(selector, {
            extensionId,
            displayName,
            provideDocumentFormattingEdits: (model, options, token) => {
                return this._proxy.$provideDocumentFormattingEdits(handle, model.uri, options, token);
            }
        }));
    }
    $registerRangeFormattingSupport(handle, selector, extensionId, displayName, supportsRanges) {
        this._registrations.set(handle, this._languageFeaturesService.documentRangeFormattingEditProvider.register(selector, {
            extensionId,
            displayName,
            provideDocumentRangeFormattingEdits: (model, range, options, token) => {
                return this._proxy.$provideDocumentRangeFormattingEdits(handle, model.uri, range, options, token);
            },
            provideDocumentRangesFormattingEdits: !supportsRanges
                ? undefined
                : (model, ranges, options, token) => {
                    return this._proxy.$provideDocumentRangesFormattingEdits(handle, model.uri, ranges, options, token);
                },
        }));
    }
    $registerOnTypeFormattingSupport(handle, selector, autoFormatTriggerCharacters, extensionId) {
        this._registrations.set(handle, this._languageFeaturesService.onTypeFormattingEditProvider.register(selector, {
            extensionId,
            autoFormatTriggerCharacters,
            provideOnTypeFormattingEdits: (model, position, ch, options, token) => {
                return this._proxy.$provideOnTypeFormattingEdits(handle, model.uri, position, ch, options, token);
            }
        }));
    }
    // --- navigate type
    $registerNavigateTypeSupport(handle, supportsResolve) {
        let lastResultId;
        const provider = {
            provideWorkspaceSymbols: async (search, token) => {
                const result = await this._proxy.$provideWorkspaceSymbols(handle, search, token);
                if (lastResultId !== undefined) {
                    this._proxy.$releaseWorkspaceSymbols(handle, lastResultId);
                }
                lastResultId = result.cacheId;
                return MainThreadLanguageFeatures_1._reviveWorkspaceSymbolDto(result.symbols);
            }
        };
        if (supportsResolve) {
            provider.resolveWorkspaceSymbol = async (item, token) => {
                const resolvedItem = await this._proxy.$resolveWorkspaceSymbol(handle, item, token);
                return resolvedItem && MainThreadLanguageFeatures_1._reviveWorkspaceSymbolDto(resolvedItem);
            };
        }
        this._registrations.set(handle, search.WorkspaceSymbolProviderRegistry.register(provider));
    }
    // --- rename
    $registerRenameSupport(handle, selector, supportResolveLocation) {
        this._registrations.set(handle, this._languageFeaturesService.renameProvider.register(selector, {
            provideRenameEdits: (model, position, newName, token) => {
                return this._proxy.$provideRenameEdits(handle, model.uri, position, newName, token).then(data => reviveWorkspaceEditDto(data, this._uriIdentService));
            },
            resolveRenameLocation: supportResolveLocation
                ? (model, position, token) => this._proxy.$resolveRenameLocation(handle, model.uri, position, token)
                : undefined
        }));
    }
    $registerNewSymbolNamesProvider(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.newSymbolNamesProvider.register(selector, {
            supportsAutomaticNewSymbolNamesTriggerKind: this._proxy.$supportsAutomaticNewSymbolNamesTriggerKind(handle),
            provideNewSymbolNames: (model, range, triggerKind, token) => {
                return this._proxy.$provideNewSymbolNames(handle, model.uri, range, triggerKind, token);
            }
        }));
    }
    // --- semantic tokens
    $registerDocumentSemanticTokensProvider(handle, selector, legend, eventHandle) {
        let event = undefined;
        if (typeof eventHandle === 'number') {
            const emitter = new Emitter();
            this._registrations.set(eventHandle, emitter);
            event = emitter.event;
        }
        this._registrations.set(handle, this._languageFeaturesService.documentSemanticTokensProvider.register(selector, new MainThreadDocumentSemanticTokensProvider(this._proxy, handle, legend, event)));
    }
    $emitDocumentSemanticTokensEvent(eventHandle) {
        const obj = this._registrations.get(eventHandle);
        if (obj instanceof Emitter) {
            obj.fire(undefined);
        }
    }
    $emitDocumentRangeSemanticTokensEvent(eventHandle) {
        const obj = this._registrations.get(eventHandle);
        if (obj instanceof Emitter) {
            obj.fire(undefined);
        }
    }
    $registerDocumentRangeSemanticTokensProvider(handle, selector, legend, eventHandle) {
        let event = undefined;
        if (typeof eventHandle === 'number') {
            const emitter = new Emitter();
            this._registrations.set(eventHandle, emitter);
            event = emitter.event;
        }
        this._registrations.set(handle, this._languageFeaturesService.documentRangeSemanticTokensProvider.register(selector, new MainThreadDocumentRangeSemanticTokensProvider(this._proxy, handle, legend, event)));
    }
    // --- suggest
    static _inflateSuggestDto(defaultRange, data, extensionId) {
        const label = data["a" /* ISuggestDataDtoField.label */];
        const commandId = data["o" /* ISuggestDataDtoField.commandId */];
        const commandIdent = data["n" /* ISuggestDataDtoField.commandIdent */];
        const commitChars = data["k" /* ISuggestDataDtoField.commitCharacters */];
        let command;
        if (commandId) {
            command = {
                $ident: commandIdent,
                id: commandId,
                title: '',
                arguments: commandIdent ? [commandIdent] : data["p" /* ISuggestDataDtoField.commandArguments */], // Automatically fill in ident as first argument
            };
        }
        return {
            label,
            extensionId,
            kind: data["b" /* ISuggestDataDtoField.kind */] ?? 9 /* languages.CompletionItemKind.Property */,
            tags: data["m" /* ISuggestDataDtoField.kindModifier */],
            detail: data["c" /* ISuggestDataDtoField.detail */],
            documentation: data["d" /* ISuggestDataDtoField.documentation */],
            sortText: data["e" /* ISuggestDataDtoField.sortText */],
            filterText: data["f" /* ISuggestDataDtoField.filterText */],
            preselect: data["g" /* ISuggestDataDtoField.preselect */],
            insertText: data["h" /* ISuggestDataDtoField.insertText */] ?? (typeof label === 'string' ? label : label.label),
            range: data["j" /* ISuggestDataDtoField.range */] ?? defaultRange,
            insertTextRules: data["i" /* ISuggestDataDtoField.insertTextRules */],
            commitCharacters: commitChars ? Array.from(commitChars) : undefined,
            additionalTextEdits: data["l" /* ISuggestDataDtoField.additionalTextEdits */],
            command,
            // not-standard
            _id: data.x,
        };
    }
    $registerCompletionsProvider(handle, selector, triggerCharacters, supportsResolveDetails, extensionId) {
        const provider = {
            triggerCharacters,
            _debugDisplayName: `${extensionId.value}(${triggerCharacters.join('')})`,
            provideCompletionItems: async (model, position, context, token) => {
                const result = await this._proxy.$provideCompletionItems(handle, model.uri, position, context, token);
                if (!result) {
                    return result;
                }
                return {
                    suggestions: result["b" /* ISuggestResultDtoField.completions */].map(d => MainThreadLanguageFeatures_1._inflateSuggestDto(result["a" /* ISuggestResultDtoField.defaultRanges */], d, extensionId)),
                    incomplete: result["c" /* ISuggestResultDtoField.isIncomplete */] || false,
                    duration: result["d" /* ISuggestResultDtoField.duration */],
                    dispose: () => {
                        if (typeof result.x === 'number') {
                            this._proxy.$releaseCompletionItems(handle, result.x);
                        }
                    }
                };
            }
        };
        if (supportsResolveDetails) {
            provider.resolveCompletionItem = (suggestion, token) => {
                return this._proxy.$resolveCompletionItem(handle, suggestion._id, token).then(result => {
                    if (!result) {
                        return suggestion;
                    }
                    const newSuggestion = MainThreadLanguageFeatures_1._inflateSuggestDto(suggestion.range, result, extensionId);
                    return mixin(suggestion, newSuggestion, true);
                });
            };
        }
        this._registrations.set(handle, this._languageFeaturesService.completionProvider.register(selector, provider));
    }
    $registerInlineCompletionsSupport(handle, selector, supportsHandleEvents, extensionId, extensionVersion, groupId, yieldsToExtensionIds, displayName, debounceDelayMs, excludesExtensionIds, eventHandle) {
        const providerId = new languages.ProviderId(extensionId, extensionVersion, groupId);
        const provider = {
            provideInlineCompletions: async (model, position, context, token) => {
                const result = await this._proxy.$provideInlineCompletions(handle, model.uri, position, context, token);
                return result;
            },
            handleItemDidShow: async (completions, item, updatedInsertText, editDeltaInfo) => {
                if (item.suggestionId === undefined) {
                    item.suggestionId = this._aiEditTelemetryService.createSuggestionId({
                        applyCodeBlockSuggestionId: undefined,
                        feature: 'inlineSuggestion',
                        source: providerId,
                        languageId: completions.languageId,
                        editDeltaInfo: editDeltaInfo,
                        modeId: undefined,
                        modelId: undefined,
                        presentation: item.isInlineEdit ? 'nextEditSuggestion' : 'inlineCompletion',
                    });
                }
                if (supportsHandleEvents) {
                    await this._proxy.$handleInlineCompletionDidShow(handle, completions.pid, item.idx, updatedInsertText);
                }
            },
            handlePartialAccept: async (completions, item, acceptedCharacters, info) => {
                if (supportsHandleEvents) {
                    await this._proxy.$handleInlineCompletionPartialAccept(handle, completions.pid, item.idx, acceptedCharacters, info);
                }
            },
            handleEndOfLifetime: async (completions, item, reason, lifetimeSummary) => {
                function mapReason(reason, f) {
                    if (reason.kind === languages.InlineCompletionEndOfLifeReasonKind.Ignored) {
                        return {
                            ...reason,
                            supersededBy: reason.supersededBy ? f(reason.supersededBy) : undefined,
                        };
                    }
                    return reason;
                }
                if (supportsHandleEvents) {
                    await this._proxy.$handleInlineCompletionEndOfLifetime(handle, completions.pid, item.idx, mapReason(reason, i => ({ pid: completions.pid, idx: i.idx })));
                }
                if (reason.kind === languages.InlineCompletionEndOfLifeReasonKind.Accepted) {
                    if (item.suggestionId !== undefined) {
                        this._aiEditTelemetryService.handleCodeAccepted({
                            suggestionId: item.suggestionId,
                            feature: 'inlineSuggestion',
                            source: providerId,
                            languageId: completions.languageId,
                            editDeltaInfo: EditDeltaInfo.tryCreate(lifetimeSummary.lineCountModified, lifetimeSummary.lineCountOriginal, lifetimeSummary.characterCountModified, lifetimeSummary.characterCountOriginal),
                            modeId: undefined,
                            modelId: undefined,
                            presentation: item.isInlineEdit ? 'nextEditSuggestion' : 'inlineCompletion',
                            acceptanceMethod: 'accept',
                            applyCodeBlockSuggestionId: undefined,
                        });
                    }
                }
                const endOfLifeSummary = {
                    opportunityId: lifetimeSummary.requestUuid,
                    correlationId: lifetimeSummary.correlationId,
                    shown: lifetimeSummary.shown,
                    shownDuration: lifetimeSummary.shownDuration,
                    shownDurationUncollapsed: lifetimeSummary.shownDurationUncollapsed,
                    timeUntilShown: lifetimeSummary.timeUntilShown,
                    timeUntilProviderRequest: lifetimeSummary.timeUntilProviderRequest,
                    timeUntilProviderResponse: lifetimeSummary.timeUntilProviderResponse,
                    editorType: lifetimeSummary.editorType,
                    viewKind: lifetimeSummary.viewKind,
                    preceeded: lifetimeSummary.preceeded,
                    requestReason: lifetimeSummary.requestReason,
                    typingInterval: lifetimeSummary.typingInterval,
                    typingIntervalCharacterCount: lifetimeSummary.typingIntervalCharacterCount,
                    languageId: lifetimeSummary.languageId,
                    cursorColumnDistance: lifetimeSummary.cursorColumnDistance,
                    cursorLineDistance: lifetimeSummary.cursorLineDistance,
                    lineCountOriginal: lifetimeSummary.lineCountOriginal,
                    lineCountModified: lifetimeSummary.lineCountModified,
                    characterCountOriginal: lifetimeSummary.characterCountOriginal,
                    characterCountModified: lifetimeSummary.characterCountModified,
                    disjointReplacements: lifetimeSummary.disjointReplacements,
                    sameShapeReplacements: lifetimeSummary.sameShapeReplacements,
                    selectedSuggestionInfo: lifetimeSummary.selectedSuggestionInfo,
                    extensionId,
                    extensionVersion,
                    groupId,
                    availableProviders: lifetimeSummary.availableProviders,
                    partiallyAccepted: lifetimeSummary.partiallyAccepted,
                    partiallyAcceptedCountSinceOriginal: lifetimeSummary.partiallyAcceptedCountSinceOriginal,
                    partiallyAcceptedRatioSinceOriginal: lifetimeSummary.partiallyAcceptedRatioSinceOriginal,
                    partiallyAcceptedCharactersSinceOriginal: lifetimeSummary.partiallyAcceptedCharactersSinceOriginal,
                    superseded: reason.kind === InlineCompletionEndOfLifeReasonKind.Ignored && !!reason.supersededBy,
                    reason: reason.kind === InlineCompletionEndOfLifeReasonKind.Accepted ? 'accepted'
                        : reason.kind === InlineCompletionEndOfLifeReasonKind.Rejected ? 'rejected'
                            : reason.kind === InlineCompletionEndOfLifeReasonKind.Ignored ? 'ignored' : undefined,
                    noSuggestionReason: undefined,
                    notShownReason: lifetimeSummary.notShownReason,
                    ...forwardToChannelIf(isCopilotLikeExtension(extensionId)),
                };
                const dataChannelForwardingTelemetryService = this._instantiationService.createInstance(DataChannelForwardingTelemetryService);
                sendInlineCompletionsEndOfLifeTelemetry(dataChannelForwardingTelemetryService, endOfLifeSummary);
            },
            disposeInlineCompletions: (completions, reason) => {
                this._proxy.$freeInlineCompletionsList(handle, completions.pid, reason);
            },
            handleRejection: async (completions, item) => {
                if (supportsHandleEvents) {
                    await this._proxy.$handleInlineCompletionRejection(handle, completions.pid, item.idx);
                }
            },
            groupId: groupId ?? extensionId,
            providerId,
            yieldsToGroupIds: yieldsToExtensionIds,
            excludesGroupIds: excludesExtensionIds,
            debounceDelayMs,
            displayName,
            toString() {
                return `InlineCompletionsProvider(${extensionId})`;
            },
        };
        if (typeof eventHandle === 'number') {
            const emitter = new Emitter();
            this._registrations.set(eventHandle, emitter);
            provider.onDidChangeInlineCompletions = emitter.event;
        }
        this._registrations.set(handle, this._languageFeaturesService.inlineCompletionsProvider.register(selector, provider));
    }
    $emitInlineCompletionsChange(handle) {
        const obj = this._registrations.get(handle);
        if (obj instanceof Emitter) {
            obj.fire(undefined);
        }
    }
    // --- parameter hints
    $registerSignatureHelpProvider(handle, selector, metadata) {
        this._registrations.set(handle, this._languageFeaturesService.signatureHelpProvider.register(selector, {
            signatureHelpTriggerCharacters: metadata.triggerCharacters,
            signatureHelpRetriggerCharacters: metadata.retriggerCharacters,
            provideSignatureHelp: async (model, position, token, context) => {
                const result = await this._proxy.$provideSignatureHelp(handle, model.uri, position, context, token);
                if (!result) {
                    return undefined;
                }
                return {
                    value: result,
                    dispose: () => {
                        this._proxy.$releaseSignatureHelp(handle, result.id);
                    }
                };
            }
        }));
    }
    // --- inline hints
    $registerInlayHintsProvider(handle, selector, supportsResolve, eventHandle, displayName) {
        const provider = {
            displayName,
            provideInlayHints: async (model, range, token) => {
                const result = await this._proxy.$provideInlayHints(handle, model.uri, range, token);
                if (!result) {
                    return;
                }
                return {
                    hints: revive(result.hints),
                    dispose: () => {
                        if (result.cacheId) {
                            this._proxy.$releaseInlayHints(handle, result.cacheId);
                        }
                    }
                };
            }
        };
        if (supportsResolve) {
            provider.resolveInlayHint = async (hint, token) => {
                const dto = hint;
                if (!dto.cacheId) {
                    return hint;
                }
                const result = await this._proxy.$resolveInlayHint(handle, dto.cacheId, token);
                if (token.isCancellationRequested) {
                    throw new CancellationError();
                }
                if (!result) {
                    return hint;
                }
                return {
                    ...hint,
                    tooltip: result.tooltip,
                    label: revive(result.label),
                    textEdits: result.textEdits
                };
            };
        }
        if (typeof eventHandle === 'number') {
            const emitter = new Emitter();
            this._registrations.set(eventHandle, emitter);
            provider.onDidChangeInlayHints = emitter.event;
        }
        this._registrations.set(handle, this._languageFeaturesService.inlayHintsProvider.register(selector, provider));
    }
    $emitInlayHintsEvent(eventHandle) {
        const obj = this._registrations.get(eventHandle);
        if (obj instanceof Emitter) {
            obj.fire(undefined);
        }
    }
    // --- links
    $registerDocumentLinkProvider(handle, selector, supportsResolve) {
        const provider = {
            provideLinks: (model, token) => {
                return this._proxy.$provideDocumentLinks(handle, model.uri, token).then(dto => {
                    if (!dto) {
                        return undefined;
                    }
                    return {
                        links: dto.links.map(MainThreadLanguageFeatures_1._reviveLinkDTO),
                        dispose: () => {
                            if (typeof dto.cacheId === 'number') {
                                this._proxy.$releaseDocumentLinks(handle, dto.cacheId);
                            }
                        }
                    };
                });
            }
        };
        if (supportsResolve) {
            provider.resolveLink = (link, token) => {
                const dto = link;
                if (!dto.cacheId) {
                    return link;
                }
                return this._proxy.$resolveDocumentLink(handle, dto.cacheId, token).then(obj => {
                    return obj && MainThreadLanguageFeatures_1._reviveLinkDTO(obj);
                });
            };
        }
        this._registrations.set(handle, this._languageFeaturesService.linkProvider.register(selector, provider));
    }
    // --- colors
    $registerDocumentColorProvider(handle, selector) {
        const proxy = this._proxy;
        this._registrations.set(handle, this._languageFeaturesService.colorProvider.register(selector, {
            provideDocumentColors: (model, token) => {
                return proxy.$provideDocumentColors(handle, model.uri, token)
                    .then(documentColors => {
                    return documentColors.map(documentColor => {
                        const [red, green, blue, alpha] = documentColor.color;
                        const color = {
                            red: red,
                            green: green,
                            blue: blue,
                            alpha
                        };
                        return {
                            color,
                            range: documentColor.range
                        };
                    });
                });
            },
            provideColorPresentations: (model, colorInfo, token) => {
                return proxy.$provideColorPresentations(handle, model.uri, {
                    color: [colorInfo.color.red, colorInfo.color.green, colorInfo.color.blue, colorInfo.color.alpha],
                    range: colorInfo.range
                }, token);
            }
        }));
    }
    // --- folding
    $registerFoldingRangeProvider(handle, selector, extensionId, eventHandle) {
        const provider = {
            id: extensionId.value,
            provideFoldingRanges: (model, context, token) => {
                return this._proxy.$provideFoldingRanges(handle, model.uri, context, token);
            }
        };
        if (typeof eventHandle === 'number') {
            const emitter = new Emitter();
            this._registrations.set(eventHandle, emitter);
            provider.onDidChange = emitter.event;
        }
        this._registrations.set(handle, this._languageFeaturesService.foldingRangeProvider.register(selector, provider));
    }
    $emitFoldingRangeEvent(eventHandle, event) {
        const obj = this._registrations.get(eventHandle);
        if (obj instanceof Emitter) {
            obj.fire(event);
        }
    }
    // -- smart select
    $registerSelectionRangeProvider(handle, selector) {
        this._registrations.set(handle, this._languageFeaturesService.selectionRangeProvider.register(selector, {
            provideSelectionRanges: (model, positions, token) => {
                return this._proxy.$provideSelectionRanges(handle, model.uri, positions, token);
            }
        }));
    }
    // --- call hierarchy
    $registerCallHierarchyProvider(handle, selector) {
        this._registrations.set(handle, callh.CallHierarchyProviderRegistry.register(selector, {
            prepareCallHierarchy: async (document, position, token) => {
                const items = await this._proxy.$prepareCallHierarchy(handle, document.uri, position, token);
                if (!items || items.length === 0) {
                    return undefined;
                }
                return {
                    dispose: () => {
                        for (const item of items) {
                            this._proxy.$releaseCallHierarchy(handle, item._sessionId);
                        }
                    },
                    roots: items.map(MainThreadLanguageFeatures_1._reviveCallHierarchyItemDto)
                };
            },
            provideOutgoingCalls: async (item, token) => {
                const outgoing = await this._proxy.$provideCallHierarchyOutgoingCalls(handle, item._sessionId, item._itemId, token);
                if (!outgoing) {
                    return outgoing;
                }
                outgoing.forEach(value => {
                    value.to = MainThreadLanguageFeatures_1._reviveCallHierarchyItemDto(value.to);
                });
                // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
                return outgoing;
            },
            provideIncomingCalls: async (item, token) => {
                const incoming = await this._proxy.$provideCallHierarchyIncomingCalls(handle, item._sessionId, item._itemId, token);
                if (!incoming) {
                    return incoming;
                }
                incoming.forEach(value => {
                    value.from = MainThreadLanguageFeatures_1._reviveCallHierarchyItemDto(value.from);
                });
                // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
                return incoming;
            }
        }));
    }
    // --- configuration
    static _reviveRegExp(regExp) {
        return new RegExp(regExp.pattern, regExp.flags);
    }
    static _reviveIndentationRule(indentationRule) {
        return {
            decreaseIndentPattern: MainThreadLanguageFeatures_1._reviveRegExp(indentationRule.decreaseIndentPattern),
            increaseIndentPattern: MainThreadLanguageFeatures_1._reviveRegExp(indentationRule.increaseIndentPattern),
            indentNextLinePattern: indentationRule.indentNextLinePattern ? MainThreadLanguageFeatures_1._reviveRegExp(indentationRule.indentNextLinePattern) : undefined,
            unIndentedLinePattern: indentationRule.unIndentedLinePattern ? MainThreadLanguageFeatures_1._reviveRegExp(indentationRule.unIndentedLinePattern) : undefined,
        };
    }
    static _reviveOnEnterRule(onEnterRule) {
        return {
            beforeText: MainThreadLanguageFeatures_1._reviveRegExp(onEnterRule.beforeText),
            afterText: onEnterRule.afterText ? MainThreadLanguageFeatures_1._reviveRegExp(onEnterRule.afterText) : undefined,
            previousLineText: onEnterRule.previousLineText ? MainThreadLanguageFeatures_1._reviveRegExp(onEnterRule.previousLineText) : undefined,
            action: onEnterRule.action
        };
    }
    static _reviveOnEnterRules(onEnterRules) {
        return onEnterRules.map(MainThreadLanguageFeatures_1._reviveOnEnterRule);
    }
    $setLanguageConfiguration(handle, languageId, _configuration) {
        const configuration = {
            comments: _configuration.comments,
            brackets: _configuration.brackets,
            wordPattern: _configuration.wordPattern ? MainThreadLanguageFeatures_1._reviveRegExp(_configuration.wordPattern) : undefined,
            indentationRules: _configuration.indentationRules ? MainThreadLanguageFeatures_1._reviveIndentationRule(_configuration.indentationRules) : undefined,
            onEnterRules: _configuration.onEnterRules ? MainThreadLanguageFeatures_1._reviveOnEnterRules(_configuration.onEnterRules) : undefined,
            autoClosingPairs: undefined,
            surroundingPairs: undefined,
            __electricCharacterSupport: undefined
        };
        if (_configuration.autoClosingPairs) {
            configuration.autoClosingPairs = _configuration.autoClosingPairs;
        }
        else if (_configuration.__characterPairSupport) {
            // backwards compatibility
            configuration.autoClosingPairs = _configuration.__characterPairSupport.autoClosingPairs;
        }
        if (_configuration.__electricCharacterSupport && _configuration.__electricCharacterSupport.docComment) {
            configuration.__electricCharacterSupport = {
                docComment: {
                    open: _configuration.__electricCharacterSupport.docComment.open,
                    close: _configuration.__electricCharacterSupport.docComment.close
                }
            };
        }
        if (this._languageService.isRegisteredLanguageId(languageId)) {
            this._registrations.set(handle, this._languageConfigurationService.register(languageId, configuration, 100));
        }
    }
    // --- type hierarchy
    $registerTypeHierarchyProvider(handle, selector) {
        this._registrations.set(handle, typeh.TypeHierarchyProviderRegistry.register(selector, {
            prepareTypeHierarchy: async (document, position, token) => {
                const items = await this._proxy.$prepareTypeHierarchy(handle, document.uri, position, token);
                if (!items) {
                    return undefined;
                }
                return {
                    dispose: () => {
                        for (const item of items) {
                            this._proxy.$releaseTypeHierarchy(handle, item._sessionId);
                        }
                    },
                    roots: items.map(MainThreadLanguageFeatures_1._reviveTypeHierarchyItemDto)
                };
            },
            provideSupertypes: async (item, token) => {
                const supertypes = await this._proxy.$provideTypeHierarchySupertypes(handle, item._sessionId, item._itemId, token);
                if (!supertypes) {
                    return supertypes;
                }
                return supertypes.map(MainThreadLanguageFeatures_1._reviveTypeHierarchyItemDto);
            },
            provideSubtypes: async (item, token) => {
                const subtypes = await this._proxy.$provideTypeHierarchySubtypes(handle, item._sessionId, item._itemId, token);
                if (!subtypes) {
                    return subtypes;
                }
                return subtypes.map(MainThreadLanguageFeatures_1._reviveTypeHierarchyItemDto);
            }
        }));
    }
    $registerDocumentOnDropEditProvider(handle, selector, metadata) {
        const provider = new MainThreadDocumentOnDropEditProvider(handle, this._proxy, metadata, this._uriIdentService);
        this._documentOnDropEditProviders.set(handle, provider);
        this._registrations.set(handle, combinedDisposable(this._languageFeaturesService.documentDropEditProvider.register(selector, provider), toDisposable(() => this._documentOnDropEditProviders.delete(handle))));
    }
    async $resolveDocumentOnDropFileData(handle, requestId, dataId) {
        const provider = this._documentOnDropEditProviders.get(handle);
        if (!provider) {
            throw new Error('Could not find provider');
        }
        return provider.resolveDocumentOnDropFileData(requestId, dataId);
    }
};
MainThreadLanguageFeatures = MainThreadLanguageFeatures_1 = __decorate([
    extHostNamedCustomer(MainContext.MainThreadLanguageFeatures),
    __param(1, ILanguageService),
    __param(2, ILanguageConfigurationService),
    __param(3, ILanguageFeaturesService),
    __param(4, IUriIdentityService),
    __param(5, IInstantiationService),
    __param(6, IInlineCompletionsUnificationService),
    __param(7, IAiEditTelemetryService)
], MainThreadLanguageFeatures);
export { MainThreadLanguageFeatures };
let MainThreadPasteEditProvider = class MainThreadPasteEditProvider {
    constructor(_handle, _proxy, metadata, _uriIdentService) {
        this._handle = _handle;
        this._proxy = _proxy;
        this._uriIdentService = _uriIdentService;
        this.dataTransfers = new DataTransferFileCache();
        this.copyMimeTypes = metadata.copyMimeTypes ?? [];
        this.pasteMimeTypes = metadata.pasteMimeTypes ?? [];
        this.providedPasteEditKinds = metadata.providedPasteEditKinds?.map(kind => new HierarchicalKind(kind)) ?? [];
        if (metadata.supportsCopy) {
            this.prepareDocumentPaste = async (model, selections, dataTransfer, token) => {
                const dataTransferDto = await typeConvert.DataTransfer.fromList(dataTransfer);
                if (token.isCancellationRequested) {
                    return undefined;
                }
                const newDataTransfer = await this._proxy.$prepareDocumentPaste(_handle, model.uri, selections, dataTransferDto, token);
                if (!newDataTransfer) {
                    return undefined;
                }
                const dataTransferOut = new VSDataTransfer();
                for (const [type, item] of newDataTransfer.items) {
                    dataTransferOut.replace(type, createStringDataTransferItem(item.asString, item.id));
                }
                return dataTransferOut;
            };
        }
        if (metadata.supportsPaste) {
            this.provideDocumentPasteEdits = async (model, selections, dataTransfer, context, token) => {
                const request = this.dataTransfers.add(dataTransfer);
                try {
                    const dataTransferDto = await typeConvert.DataTransfer.fromList(dataTransfer);
                    if (token.isCancellationRequested) {
                        return;
                    }
                    const edits = await this._proxy.$providePasteEdits(this._handle, request.id, model.uri, selections, dataTransferDto, {
                        only: context.only?.value,
                        triggerKind: context.triggerKind,
                    }, token);
                    if (!edits) {
                        return;
                    }
                    return {
                        edits: edits.map((edit) => {
                            return {
                                ...edit,
                                kind: edit.kind ? new HierarchicalKind(edit.kind.value) : new HierarchicalKind(''),
                                yieldTo: edit.yieldTo?.map(x => ({ kind: new HierarchicalKind(x) })),
                                additionalEdit: edit.additionalEdit ? reviveWorkspaceEditDto(edit.additionalEdit, this._uriIdentService, dataId => this.resolveFileData(request.id, dataId)) : undefined,
                            };
                        }),
                        dispose: () => {
                            this._proxy.$releasePasteEdits(this._handle, request.id);
                        },
                    };
                }
                finally {
                    request.dispose();
                }
            };
        }
        if (metadata.supportsResolve) {
            this.resolveDocumentPasteEdit = async (edit, token) => {
                const resolved = await this._proxy.$resolvePasteEdit(this._handle, edit._cacheId, token);
                if (typeof resolved.insertText !== 'undefined') {
                    edit.insertText = resolved.insertText;
                }
                if (resolved.additionalEdit) {
                    edit.additionalEdit = reviveWorkspaceEditDto(resolved.additionalEdit, this._uriIdentService);
                }
                return edit;
            };
        }
    }
    resolveFileData(requestId, dataId) {
        return this.dataTransfers.resolveFileData(requestId, dataId);
    }
};
MainThreadPasteEditProvider = __decorate([
    __param(3, IUriIdentityService)
], MainThreadPasteEditProvider);
let MainThreadDocumentOnDropEditProvider = class MainThreadDocumentOnDropEditProvider {
    constructor(_handle, _proxy, metadata, _uriIdentService) {
        this._handle = _handle;
        this._proxy = _proxy;
        this._uriIdentService = _uriIdentService;
        this.dataTransfers = new DataTransferFileCache();
        this.dropMimeTypes = metadata?.dropMimeTypes ?? ['*/*'];
        this.providedDropEditKinds = metadata?.providedDropKinds?.map(kind => new HierarchicalKind(kind));
        if (metadata?.supportsResolve) {
            this.resolveDocumentDropEdit = async (edit, token) => {
                const resolved = await this._proxy.$resolvePasteEdit(this._handle, edit._cacheId, token);
                if (resolved.additionalEdit) {
                    edit.additionalEdit = reviveWorkspaceEditDto(resolved.additionalEdit, this._uriIdentService);
                }
                return edit;
            };
        }
    }
    async provideDocumentDropEdits(model, position, dataTransfer, token) {
        const request = this.dataTransfers.add(dataTransfer);
        try {
            const dataTransferDto = await typeConvert.DataTransfer.fromList(dataTransfer);
            if (token.isCancellationRequested) {
                return;
            }
            const edits = await this._proxy.$provideDocumentOnDropEdits(this._handle, request.id, model.uri, position, dataTransferDto, token);
            if (!edits) {
                return;
            }
            return {
                edits: edits.map(edit => {
                    return {
                        ...edit,
                        yieldTo: edit.yieldTo?.map(x => ({ kind: new HierarchicalKind(x) })),
                        kind: edit.kind ? new HierarchicalKind(edit.kind) : undefined,
                        additionalEdit: reviveWorkspaceEditDto(edit.additionalEdit, this._uriIdentService, dataId => this.resolveDocumentOnDropFileData(request.id, dataId)),
                    };
                }),
                dispose: () => {
                    this._proxy.$releaseDocumentOnDropEdits(this._handle, request.id);
                },
            };
        }
        finally {
            request.dispose();
        }
    }
    resolveDocumentOnDropFileData(requestId, dataId) {
        return this.dataTransfers.resolveFileData(requestId, dataId);
    }
};
MainThreadDocumentOnDropEditProvider = __decorate([
    __param(3, IUriIdentityService)
], MainThreadDocumentOnDropEditProvider);
export class MainThreadDocumentSemanticTokensProvider {
    constructor(_proxy, _handle, _legend, onDidChange) {
        this._proxy = _proxy;
        this._handle = _handle;
        this._legend = _legend;
        this.onDidChange = onDidChange;
    }
    releaseDocumentSemanticTokens(resultId) {
        if (resultId) {
            this._proxy.$releaseDocumentSemanticTokens(this._handle, parseInt(resultId, 10));
        }
    }
    getLegend() {
        return this._legend;
    }
    async provideDocumentSemanticTokens(model, lastResultId, token) {
        const nLastResultId = lastResultId ? parseInt(lastResultId, 10) : 0;
        const encodedDto = await this._proxy.$provideDocumentSemanticTokens(this._handle, model.uri, nLastResultId, token);
        if (!encodedDto) {
            return null;
        }
        if (token.isCancellationRequested) {
            return null;
        }
        const dto = decodeSemanticTokensDto(encodedDto);
        if (dto.type === 'full') {
            return {
                resultId: String(dto.id),
                data: dto.data
            };
        }
        return {
            resultId: String(dto.id),
            edits: dto.deltas
        };
    }
}
export class MainThreadDocumentRangeSemanticTokensProvider {
    constructor(_proxy, _handle, _legend, onDidChange) {
        this._proxy = _proxy;
        this._handle = _handle;
        this._legend = _legend;
        this.onDidChange = onDidChange;
    }
    getLegend() {
        return this._legend;
    }
    async provideDocumentRangeSemanticTokens(model, range, token) {
        const encodedDto = await this._proxy.$provideDocumentRangeSemanticTokens(this._handle, model.uri, range, token);
        if (!encodedDto) {
            return null;
        }
        if (token.isCancellationRequested) {
            return null;
        }
        const dto = decodeSemanticTokensDto(encodedDto);
        if (dto.type === 'full') {
            return {
                resultId: String(dto.id),
                data: dto.data
            };
        }
        throw new Error(`Unexpected`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9icm93c2VyL21haW5UaHJlYWRMYW5ndWFnZUZlYXR1cmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUloRyxPQUFPLEVBQUUsNEJBQTRCLEVBQTJCLGNBQWMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzdILE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNoSCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDMUQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFJbEQsT0FBTyxLQUFLLFNBQVMsTUFBTSxxQ0FBcUMsQ0FBQztBQUNqRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUVoRixPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxtRUFBbUUsQ0FBQztBQUVsSCxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUMvRixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUUvRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFB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