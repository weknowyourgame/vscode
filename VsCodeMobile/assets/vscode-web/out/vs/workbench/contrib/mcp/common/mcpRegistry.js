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
import { assertNever } from '../../../../base/common/assert.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter } from '../../../../base/common/event.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { derived, observableValue, autorunSelfDisposable } from '../../../../base/common/observable.js';
import { isDefined } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { mcpAccessConfig } from '../../../../platform/mcp/common/mcpManagement.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { observableConfigValue } from '../../../../platform/observable/common/platformObservableUtils.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IConfigurationResolverService } from '../../../services/configurationResolver/common/configurationResolver.js';
import { ConfigurationResolverExpression } from '../../../services/configurationResolver/common/configurationResolverExpression.js';
import { AUX_WINDOW_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { IMcpDevModeDebugging } from './mcpDevMode.js';
import { McpRegistryInputStorage } from './mcpRegistryInputStorage.js';
import { McpServerConnection } from './mcpServerConnection.js';
import { McpStartServerInteraction, UserInteractionRequiredError } from './mcpTypes.js';
const notTrustedNonce = '__vscode_not_trusted';
let McpRegistry = class McpRegistry extends Disposable {
    get delegates() {
        return this._delegates;
    }
    constructor(_instantiationService, _configurationResolverService, _dialogService, _notificationService, _editorService, configurationService, _quickInputService, _labelService, _logService) {
        super();
        this._instantiationService = _instantiationService;
        this._configurationResolverService = _configurationResolverService;
        this._dialogService = _dialogService;
        this._notificationService = _notificationService;
        this._editorService = _editorService;
        this._quickInputService = _quickInputService;
        this._labelService = _labelService;
        this._logService = _logService;
        this._collections = observableValue('collections', []);
        this._delegates = observableValue('delegates', []);
        this.collections = derived(reader => {
            if (this._mcpAccessValue.read(reader) === "none" /* McpAccessValue.None */) {
                return [];
            }
            return this._collections.read(reader);
        });
        this._workspaceStorage = new Lazy(() => this._register(this._instantiationService.createInstance(McpRegistryInputStorage, 1 /* StorageScope.WORKSPACE */, 0 /* StorageTarget.USER */)));
        this._profileStorage = new Lazy(() => this._register(this._instantiationService.createInstance(McpRegistryInputStorage, 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */)));
        this._ongoingLazyActivations = observableValue(this, 0);
        this.lazyCollectionState = derived(reader => {
            if (this._mcpAccessValue.read(reader) === "none" /* McpAccessValue.None */) {
                return { state: 2 /* LazyCollectionState.AllKnown */, collections: [] };
            }
            if (this._ongoingLazyActivations.read(reader) > 0) {
                return { state: 1 /* LazyCollectionState.LoadingUnknown */, collections: [] };
            }
            const collections = this._collections.read(reader);
            const hasUnknown = collections.some(c => c.lazy && c.lazy.isCached === false);
            return hasUnknown ? { state: 0 /* LazyCollectionState.HasUnknown */, collections: collections.filter(c => c.lazy && c.lazy.isCached === false) } : { state: 2 /* LazyCollectionState.AllKnown */, collections: [] };
        });
        this._onDidChangeInputs = this._register(new Emitter());
        this.onDidChangeInputs = this._onDidChangeInputs.event;
        this._mcpAccessValue = observableConfigValue(mcpAccessConfig, "all" /* McpAccessValue.All */, configurationService);
    }
    registerDelegate(delegate) {
        const delegates = this._delegates.get().slice();
        delegates.push(delegate);
        delegates.sort((a, b) => b.priority - a.priority);
        this._delegates.set(delegates, undefined);
        return {
            dispose: () => {
                const delegates = this._delegates.get().filter(d => d !== delegate);
                this._delegates.set(delegates, undefined);
            }
        };
    }
    registerCollection(collection) {
        const currentCollections = this._collections.get();
        const toReplace = currentCollections.find(c => c.lazy && c.id === collection.id);
        // Incoming collections replace the "lazy" versions. See `ExtensionMcpDiscovery` for an example.
        if (toReplace) {
            this._collections.set(currentCollections.map(c => c === toReplace ? collection : c), undefined);
        }
        else {
            this._collections.set([...currentCollections, collection]
                .sort((a, b) => (a.presentation?.order || 0) - (b.presentation?.order || 0)), undefined);
        }
        return {
            dispose: () => {
                const currentCollections = this._collections.get();
                this._collections.set(currentCollections.filter(c => c !== collection), undefined);
            }
        };
    }
    getServerDefinition(collectionRef, definitionRef) {
        const collectionObs = this._collections.map(cols => cols.find(c => c.id === collectionRef.id));
        return collectionObs.map((collection, reader) => {
            const server = collection?.serverDefinitions.read(reader).find(s => s.id === definitionRef.id);
            return { collection, server };
        });
    }
    async discoverCollections() {
        const toDiscover = this._collections.get().filter(c => c.lazy && !c.lazy.isCached);
        this._ongoingLazyActivations.set(this._ongoingLazyActivations.get() + 1, undefined);
        await Promise.all(toDiscover.map(c => c.lazy?.load())).finally(() => {
            this._ongoingLazyActivations.set(this._ongoingLazyActivations.get() - 1, undefined);
        });
        const found = [];
        const current = this._collections.get();
        for (const collection of toDiscover) {
            const rec = current.find(c => c.id === collection.id);
            if (!rec) {
                // ignored
            }
            else if (rec.lazy) {
                rec.lazy.removed?.(); // did not get replaced by the non-lazy version
            }
            else {
                found.push(rec);
            }
        }
        return found;
    }
    _getInputStorage(scope) {
        return scope === 1 /* StorageScope.WORKSPACE */ ? this._workspaceStorage.value : this._profileStorage.value;
    }
    _getInputStorageInConfigTarget(configTarget) {
        return this._getInputStorage(configTarget === 5 /* ConfigurationTarget.WORKSPACE */ || configTarget === 6 /* ConfigurationTarget.WORKSPACE_FOLDER */
            ? 1 /* StorageScope.WORKSPACE */
            : 0 /* StorageScope.PROFILE */);
    }
    async clearSavedInputs(scope, inputId) {
        const storage = this._getInputStorage(scope);
        if (inputId) {
            await storage.clear(inputId);
        }
        else {
            storage.clearAll();
        }
        this._onDidChangeInputs.fire();
    }
    async editSavedInput(inputId, folderData, configSection, target) {
        const storage = this._getInputStorageInConfigTarget(target);
        const expr = ConfigurationResolverExpression.parse(inputId);
        const stored = await storage.getMap();
        const previous = stored[inputId].value;
        await this._configurationResolverService.resolveWithInteraction(folderData, expr, configSection, previous ? { [inputId.slice(2, -1)]: previous } : {}, target);
        await this._updateStorageWithExpressionInputs(storage, expr);
    }
    async setSavedInput(inputId, target, value) {
        const storage = this._getInputStorageInConfigTarget(target);
        const expr = ConfigurationResolverExpression.parse(inputId);
        for (const unresolved of expr.unresolved()) {
            expr.resolve(unresolved, value);
            break;
        }
        await this._updateStorageWithExpressionInputs(storage, expr);
    }
    getSavedInputs(scope) {
        return this._getInputStorage(scope).getMap();
    }
    async _checkTrust(collection, definition, { trustNonceBearer, interaction, promptType = 'only-new', autoTrustChanges = false, errorOnUserInteraction = false, }) {
        if (collection.trustBehavior === 0 /* McpServerTrust.Kind.Trusted */) {
            this._logService.trace(`MCP server ${definition.id} is trusted, no trust prompt needed`);
            return true;
        }
        else if (collection.trustBehavior === 1 /* McpServerTrust.Kind.TrustedOnNonce */) {
            if (definition.cacheNonce === trustNonceBearer.trustedAtNonce) {
                this._logService.trace(`MCP server ${definition.id} is unchanged, no trust prompt needed`);
                return true;
            }
            if (autoTrustChanges) {
                this._logService.trace(`MCP server ${definition.id} is was changed but user explicitly executed`);
                trustNonceBearer.trustedAtNonce = definition.cacheNonce;
                return true;
            }
            if (trustNonceBearer.trustedAtNonce === notTrustedNonce) {
                if (promptType === 'all-untrusted') {
                    if (errorOnUserInteraction) {
                        throw new UserInteractionRequiredError('serverTrust');
                    }
                    return this._promptForTrust(definition, collection, interaction, trustNonceBearer);
                }
                else {
                    this._logService.trace(`MCP server ${definition.id} is untrusted, denying trust prompt`);
                    return false;
                }
            }
            if (promptType === 'never') {
                this._logService.trace(`MCP server ${definition.id} trust state is unknown, skipping prompt`);
                return false;
            }
            if (errorOnUserInteraction) {
                throw new UserInteractionRequiredError('serverTrust');
            }
            const didTrust = await this._promptForTrust(definition, collection, interaction, trustNonceBearer);
            if (didTrust) {
                return true;
            }
            if (didTrust === undefined) {
                return undefined;
            }
            trustNonceBearer.trustedAtNonce = notTrustedNonce;
            return false;
        }
        else {
            assertNever(collection.trustBehavior);
        }
    }
    async _promptForTrust(definition, collection, interaction, trustNonceBearer) {
        interaction ??= new McpStartServerInteraction();
        interaction.participants.set(definition.id, { s: 'waiting', definition, collection });
        const trustedDefinitionIds = await new Promise(resolve => {
            autorunSelfDisposable(reader => {
                const map = interaction.participants.observable.read(reader);
                if (Iterable.some(map.values(), p => p.s === 'unknown')) {
                    return; // wait to gather all calls
                }
                reader.dispose();
                interaction.choice ??= this._promptForTrustOpenDialog([...map.values()].map((v) => v.s === 'waiting' ? v : undefined).filter(isDefined));
                resolve(interaction.choice);
            });
        });
        this._logService.trace(`MCP trusted servers:`, trustedDefinitionIds);
        if (trustedDefinitionIds) {
            trustNonceBearer.trustedAtNonce = trustedDefinitionIds.includes(definition.id)
                ? definition.cacheNonce
                : notTrustedNonce;
        }
        return !!trustedDefinitionIds?.includes(definition.id);
    }
    /**
     * Confirms with the user which of the provided definitions should be trusted.
     * Returns undefined if the user cancelled the flow, or the list of trusted
     * definition IDs otherwise.
     */
    async _promptForTrustOpenDialog(definitions) {
        function labelFor(r) {
            const originURI = r.definition.presentation?.origin?.uri || r.collection.presentation?.origin;
            let labelWithOrigin = originURI ? `[\`${r.definition.label}\`](${originURI})` : '`' + r.definition.label + '`';
            if (r.collection.source instanceof ExtensionIdentifier) {
                labelWithOrigin += ` (${localize('trustFromExt', 'from {0}', r.collection.source.value)})`;
            }
            return labelWithOrigin;
        }
        if (definitions.length === 1) {
            const def = definitions[0];
            const originURI = def.definition.presentation?.origin?.uri;
            const { result } = await this._dialogService.prompt({
                message: localize('trustTitleWithOrigin', 'Trust and run MCP server {0}?', def.definition.label),
                custom: {
                    icon: Codicon.shield,
                    markdownDetails: [{
                            markdown: new MarkdownString(localize('mcp.trust.details', 'The MCP server {0} was updated. MCP servers may add context to your chat session and lead to unexpected behavior. Do you want to trust and run this server?', labelFor(def))),
                            actionHandler: () => {
                                const editor = this._editorService.openEditor({ resource: originURI }, AUX_WINDOW_GROUP);
                                return editor.then(Boolean);
                            },
                        }]
                },
                buttons: [
                    { label: localize('mcp.trust.yes', 'Trust'), run: () => true },
                    { label: localize('mcp.trust.no', 'Do not trust'), run: () => false }
                ],
            });
            return result === undefined ? undefined : (result ? [def.definition.id] : []);
        }
        const list = definitions.map(d => `- ${labelFor(d)}`).join('\n');
        const { result } = await this._dialogService.prompt({
            message: localize('trustTitleWithOriginMulti', 'Trust and run {0} MCP servers?', definitions.length),
            custom: {
                icon: Codicon.shield,
                markdownDetails: [{
                        markdown: new MarkdownString(localize('mcp.trust.detailsMulti', 'Several updated MCP servers were discovered:\n\n{0}\n\n MCP servers may add context to your chat session and lead to unexpected behavior. Do you want to trust and run these server?', list)),
                        actionHandler: (uri) => {
                            const editor = this._editorService.openEditor({ resource: URI.parse(uri) }, AUX_WINDOW_GROUP);
                            return editor.then(Boolean);
                        },
                    }]
            },
            buttons: [
                { label: localize('mcp.trust.yes', 'Trust'), run: () => 'all' },
                { label: localize('mcp.trust.pick', 'Pick Trusted'), run: () => 'pick' },
                { label: localize('mcp.trust.no', 'Do not trust'), run: () => 'none' },
            ],
        });
        if (result === undefined) {
            return undefined;
        }
        else if (result === 'all') {
            return definitions.map(d => d.definition.id);
        }
        else if (result === 'none') {
            return [];
        }
        function isActionableButton(obj) {
            return typeof obj.action === 'function';
        }
        const store = new DisposableStore();
        const picker = store.add(this._quickInputService.createQuickPick({ useSeparators: false }));
        picker.canSelectMany = true;
        picker.items = definitions.map(({ definition, collection }) => {
            const buttons = [];
            if (definition.presentation?.origin) {
                const origin = definition.presentation.origin;
                buttons.push({
                    iconClass: 'codicon-go-to-file',
                    tooltip: 'Go to Definition',
                    action: () => this._editorService.openEditor({ resource: origin.uri, options: { selection: origin.range } })
                });
            }
            return {
                type: 'item',
                label: definition.label,
                definitonId: definition.id,
                description: collection.source instanceof ExtensionIdentifier
                    ? collection.source.value
                    : (definition.presentation?.origin ? this._labelService.getUriLabel(definition.presentation.origin.uri) : undefined),
                picked: false,
                buttons
            };
        });
        picker.placeholder = 'Select MCP servers to trust';
        picker.ignoreFocusOut = true;
        store.add(picker.onDidTriggerItemButton(e => {
            if (isActionableButton(e.button)) {
                e.button.action();
            }
        }));
        return new Promise(resolve => {
            picker.onDidAccept(() => {
                resolve(picker.selectedItems.map(item => item.definitonId));
                picker.hide();
            });
            picker.onDidHide(() => {
                resolve(undefined);
            });
            picker.show();
        }).finally(() => store.dispose());
    }
    async _updateStorageWithExpressionInputs(inputStorage, expr) {
        const secrets = {};
        const inputs = {};
        for (const [replacement, resolved] of expr.resolved()) {
            if (resolved.input?.type === 'promptString' && resolved.input.password) {
                secrets[replacement.id] = resolved;
            }
            else {
                inputs[replacement.id] = resolved;
            }
        }
        inputStorage.setPlainText(inputs);
        await inputStorage.setSecrets(secrets);
        this._onDidChangeInputs.fire();
    }
    async _replaceVariablesInLaunch(delegate, definition, launch, errorOnUserInteraction) {
        if (!definition.variableReplacement) {
            return launch;
        }
        const { section, target, folder } = definition.variableReplacement;
        const inputStorage = this._getInputStorageInConfigTarget(target);
        const [previouslyStored, withRemoteFilled] = await Promise.all([
            inputStorage.getMap(),
            delegate.substituteVariables(definition, launch),
        ]);
        // pre-fill the variables we already resolved to avoid extra prompting
        const expr = ConfigurationResolverExpression.parse(withRemoteFilled);
        for (const replacement of expr.unresolved()) {
            if (previouslyStored.hasOwnProperty(replacement.id)) {
                expr.resolve(replacement, previouslyStored[replacement.id]);
            }
        }
        // Check if there are still unresolved variables that would require interaction
        if (errorOnUserInteraction) {
            const unresolved = Array.from(expr.unresolved());
            if (unresolved.length > 0) {
                throw new UserInteractionRequiredError('variables');
            }
        }
        // resolve variables requiring user input
        await this._configurationResolverService.resolveWithInteraction(folder, expr, section, undefined, target);
        await this._updateStorageWithExpressionInputs(inputStorage, expr);
        // resolve other non-interactive variables, returning the final object
        return await this._configurationResolverService.resolveAsync(folder, expr);
    }
    async resolveConnection(opts) {
        const { collectionRef, definitionRef, interaction, logger, debug } = opts;
        let collection = this._collections.get().find(c => c.id === collectionRef.id);
        if (collection?.lazy) {
            await collection.lazy.load();
            collection = this._collections.get().find(c => c.id === collectionRef.id);
        }
        const definition = collection?.serverDefinitions.get().find(s => s.id === definitionRef.id);
        if (!collection || !definition) {
            throw new Error(`Collection or definition not found for ${collectionRef.id} and ${definitionRef.id}`);
        }
        const delegate = this._delegates.get().find(d => d.canStart(collection, definition));
        if (!delegate) {
            throw new Error('No delegate found that can handle the connection');
        }
        const trusted = await this._checkTrust(collection, definition, opts);
        interaction?.participants.set(definition.id, { s: 'resolved' });
        if (!trusted) {
            return undefined;
        }
        let launch = definition.launch;
        if (collection.resolveServerLanch) {
            launch = await collection.resolveServerLanch(definition);
            if (!launch) {
                return undefined; // interaction cancelled by user
            }
        }
        try {
            launch = await this._replaceVariablesInLaunch(delegate, definition, launch, opts.errorOnUserInteraction);
            if (definition.devMode && debug) {
                launch = await this._instantiationService.invokeFunction(accessor => accessor.get(IMcpDevModeDebugging).transform(definition, launch));
            }
        }
        catch (e) {
            if (e instanceof UserInteractionRequiredError) {
                throw e;
            }
            this._notificationService.notify({
                severity: Severity.Error,
                message: localize('mcp.launchError', 'Error starting {0}: {1}', definition.label, String(e)),
                actions: {
                    primary: collection.presentation?.origin && [
                        {
                            id: 'mcp.launchError.openConfig',
                            class: undefined,
                            enabled: true,
                            tooltip: '',
                            label: localize('mcp.launchError.openConfig', 'Open Configuration'),
                            run: () => this._editorService.openEditor({
                                resource: collection.presentation.origin,
                                options: { selection: definition.presentation?.origin?.range }
                            }),
                        }
                    ]
                }
            });
            return;
        }
        return this._instantiationService.createInstance(McpServerConnection, collection, definition, delegate, launch, logger, opts.errorOnUserInteraction);
    }
};
McpRegistry = __decorate([
    __param(0, IInstantiationService),
    __param(1, IConfigurationResolverService),
    __param(2, IDialogService),
    __param(3, INotificationService),
    __param(4, IEditorService),
    __param(5, IConfigurationService),
    __param(6, IQuickInputService),
    __param(7, ILabelService),
    __param(8, ILogService)
], McpRegistry);
export { McpRegistry };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwUmVnaXN0cnkuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2NvbW1vbi9tY3BSZWdpc3RyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxPQUFPLEVBQWUsZUFBZSxFQUFFLHFCQUFxQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDckgsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUF1QixxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ3hILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNoRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMzRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsYUFBYSxFQUFF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