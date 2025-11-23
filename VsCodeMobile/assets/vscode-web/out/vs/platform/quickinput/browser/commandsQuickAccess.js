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
var AbstractCommandsQuickAccessProvider_1, CommandsHistory_1;
import { Codicon } from '../../../base/common/codicons.js';
import { toErrorMessage } from '../../../base/common/errorMessage.js';
import { isCancellationError } from '../../../base/common/errors.js';
import { matchesBaseContiguousSubString, matchesWords, or } from '../../../base/common/filters.js';
import { createSingleCallFunction } from '../../../base/common/functional.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { LRUCache } from '../../../base/common/map.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { TfIdfCalculator, normalizeTfIdfScores } from '../../../base/common/tfIdf.js';
import { localize } from '../../../nls.js';
import { ICommandService } from '../../commands/common/commands.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IDialogService } from '../../dialogs/common/dialogs.js';
import { IInstantiationService } from '../../instantiation/common/instantiation.js';
import { IKeybindingService } from '../../keybinding/common/keybinding.js';
import { ILogService } from '../../log/common/log.js';
import { PickerQuickAccessProvider, TriggerAction } from './pickerQuickAccess.js';
import { IStorageService, WillSaveStateReason } from '../../storage/common/storage.js';
import { ITelemetryService } from '../../telemetry/common/telemetry.js';
import { Categories } from '../../action/common/actionCommonCategories.js';
let AbstractCommandsQuickAccessProvider = class AbstractCommandsQuickAccessProvider extends PickerQuickAccessProvider {
    static { AbstractCommandsQuickAccessProvider_1 = this; }
    static { this.PREFIX = '>'; }
    static { this.TFIDF_THRESHOLD = 0.5; }
    static { this.TFIDF_MAX_RESULTS = 5; }
    static { this.WORD_FILTER = or(matchesBaseContiguousSubString, matchesWords); }
    constructor(options, instantiationService, keybindingService, commandService, telemetryService, dialogService) {
        super(AbstractCommandsQuickAccessProvider_1.PREFIX, options);
        this.keybindingService = keybindingService;
        this.commandService = commandService;
        this.telemetryService = telemetryService;
        this.dialogService = dialogService;
        this.commandsHistory = this._register(instantiationService.createInstance(CommandsHistory));
        this.options = options;
    }
    async _getPicks(filter, _disposables, token, runOptions) {
        // Ask subclass for all command picks
        const allCommandPicks = await this.getCommandPicks(token);
        if (token.isCancellationRequested) {
            return [];
        }
        const runTfidf = createSingleCallFunction(() => {
            const tfidf = new TfIdfCalculator();
            tfidf.updateDocuments(allCommandPicks.map(commandPick => ({
                key: commandPick.commandId,
                textChunks: [this.getTfIdfChunk(commandPick)]
            })));
            const result = tfidf.calculateScores(filter, token);
            return normalizeTfIdfScores(result)
                .filter(score => score.score > AbstractCommandsQuickAccessProvider_1.TFIDF_THRESHOLD)
                .slice(0, AbstractCommandsQuickAccessProvider_1.TFIDF_MAX_RESULTS);
        });
        // Filter
        const filteredCommandPicks = [];
        for (const commandPick of allCommandPicks) {
            const labelHighlights = AbstractCommandsQuickAccessProvider_1.WORD_FILTER(filter, commandPick.label) ?? undefined;
            let aliasHighlights;
            if (commandPick.commandAlias) {
                aliasHighlights = AbstractCommandsQuickAccessProvider_1.WORD_FILTER(filter, commandPick.commandAlias) ?? undefined;
            }
            // Add if matching in label or alias
            if (labelHighlights || aliasHighlights) {
                commandPick.highlights = {
                    label: labelHighlights,
                    detail: this.options.showAlias ? aliasHighlights : undefined
                };
                filteredCommandPicks.push(commandPick);
            }
            // Also add if we have a 100% command ID match
            else if (filter === commandPick.commandId) {
                filteredCommandPicks.push(commandPick);
            }
            // Handle tf-idf scoring for the rest if there's a filter
            else if (filter.length >= 3) {
                const tfidf = runTfidf();
                if (token.isCancellationRequested) {
                    return [];
                }
                // Add if we have a tf-idf score
                const tfidfScore = tfidf.find(score => score.key === commandPick.commandId);
                if (tfidfScore) {
                    commandPick.tfIdfScore = tfidfScore.score;
                    filteredCommandPicks.push(commandPick);
                }
            }
        }
        // Add description to commands that have duplicate labels
        const mapLabelToCommand = new Map();
        for (const commandPick of filteredCommandPicks) {
            const existingCommandForLabel = mapLabelToCommand.get(commandPick.label);
            if (existingCommandForLabel) {
                commandPick.description = commandPick.commandId;
                existingCommandForLabel.description = existingCommandForLabel.commandId;
            }
            else {
                mapLabelToCommand.set(commandPick.label, commandPick);
            }
        }
        // Sort by MRU order and fallback to name otherwise
        filteredCommandPicks.sort((commandPickA, commandPickB) => {
            // If a result came from tf-idf, we want to put that towards the bottom
            if (commandPickA.tfIdfScore && commandPickB.tfIdfScore) {
                if (commandPickA.tfIdfScore === commandPickB.tfIdfScore) {
                    return commandPickA.label.localeCompare(commandPickB.label); // prefer lexicographically smaller command
                }
                return commandPickB.tfIdfScore - commandPickA.tfIdfScore; // prefer higher tf-idf score
            }
            else if (commandPickA.tfIdfScore) {
                return 1; // first command has a score but other doesn't so other wins
            }
            else if (commandPickB.tfIdfScore) {
                return -1; // other command has a score but first doesn't so first wins
            }
            const commandACounter = this.commandsHistory.peek(commandPickA.commandId);
            const commandBCounter = this.commandsHistory.peek(commandPickB.commandId);
            if (commandACounter && commandBCounter) {
                return commandACounter > commandBCounter ? -1 : 1; // use more recently used command before older
            }
            if (commandACounter) {
                return -1; // first command was used, so it wins over the non used one
            }
            if (commandBCounter) {
                return 1; // other command was used so it wins over the command
            }
            if (this.options.suggestedCommandIds) {
                const commandASuggestion = this.options.suggestedCommandIds.has(commandPickA.commandId);
                const commandBSuggestion = this.options.suggestedCommandIds.has(commandPickB.commandId);
                if (commandASuggestion && commandBSuggestion) {
                    return 0; // honor the order of the array
                }
                if (commandASuggestion) {
                    return -1; // first command was suggested, so it wins over the non suggested one
                }
                if (commandBSuggestion) {
                    return 1; // other command was suggested so it wins over the command
                }
            }
            // if one is Developer and the other isn't, put non-Developer first
            const isDeveloperA = commandPickA.commandCategory === Categories.Developer.value;
            const isDeveloperB = commandPickB.commandCategory === Categories.Developer.value;
            if (isDeveloperA && !isDeveloperB) {
                return 1;
            }
            if (!isDeveloperA && isDeveloperB) {
                return -1;
            }
            // both commands were never used, so we sort by name
            return commandPickA.label.localeCompare(commandPickB.label);
        });
        const commandPicks = [];
        let addOtherSeparator = false;
        let addSuggestedSeparator = true;
        let addCommonlyUsedSeparator = !!this.options.suggestedCommandIds;
        for (let i = 0; i < filteredCommandPicks.length; i++) {
            const commandPick = filteredCommandPicks[i];
            const isInHistory = !!this.commandsHistory.peek(commandPick.commandId);
            // Separator: recently used
            if (i === 0 && isInHistory) {
                commandPicks.push({ type: 'separator', label: localize('recentlyUsed', "recently used") });
                addOtherSeparator = true;
            }
            if (addSuggestedSeparator && commandPick.tfIdfScore !== undefined) {
                commandPicks.push({ type: 'separator', label: localize('suggested', "similar commands") });
                addSuggestedSeparator = false;
            }
            // Separator: commonly used
            if (addCommonlyUsedSeparator && commandPick.tfIdfScore === undefined && !isInHistory && this.options.suggestedCommandIds?.has(commandPick.commandId)) {
                commandPicks.push({ type: 'separator', label: localize('commonlyUsed', "commonly used") });
                addOtherSeparator = true;
                addCommonlyUsedSeparator = false;
            }
            // Separator: other commands
            if (addOtherSeparator && commandPick.tfIdfScore === undefined && !isInHistory && !this.options.suggestedCommandIds?.has(commandPick.commandId)) {
                commandPicks.push({ type: 'separator', label: localize('morecCommands', "other commands") });
                addOtherSeparator = false;
            }
            // Command
            commandPicks.push(this.toCommandPick(commandPick, runOptions, isInHistory));
        }
        if (!this.hasAdditionalCommandPicks(filter, token)) {
            return commandPicks;
        }
        return {
            picks: commandPicks,
            additionalPicks: (async () => {
                const additionalCommandPicks = await this.getAdditionalCommandPicks(allCommandPicks, filteredCommandPicks, filter, token);
                if (token.isCancellationRequested) {
                    return [];
                }
                const commandPicks = additionalCommandPicks.map(commandPick => this.toCommandPick(commandPick, runOptions));
                // Basically, if we haven't already added a separator, we add one before the additional picks so long
                // as one hasn't been added to the start of the array.
                if (addSuggestedSeparator && commandPicks[0]?.type !== 'separator') {
                    commandPicks.unshift({ type: 'separator', label: localize('suggested', "similar commands") });
                }
                return commandPicks;
            })()
        };
    }
    toCommandPick(commandPick, runOptions, isRecentlyUsed = false) {
        if (commandPick.type === 'separator') {
            return commandPick;
        }
        const keybinding = this.keybindingService.lookupKeybinding(commandPick.commandId);
        const ariaLabel = keybinding ?
            localize('commandPickAriaLabelWithKeybinding', "{0}, {1}", commandPick.label, keybinding.getAriaLabel()) :
            commandPick.label;
        // Add remove button for recently used items (as the last button, to the right)
        const existingButtons = commandPick.buttons || [];
        const buttons = isRecentlyUsed ? [
            ...existingButtons,
            {
                iconClass: ThemeIcon.asClassName(Codicon.close),
                tooltip: localize('removeFromRecentlyUsed', "Remove from Recently Used")
            }
        ] : commandPick.buttons;
        return {
            ...commandPick,
            ariaLabel,
            detail: this.options.showAlias && commandPick.commandAlias !== commandPick.label ? commandPick.commandAlias : undefined,
            keybinding,
            buttons,
            accept: async () => {
                // Add to history
                this.commandsHistory.push(commandPick.commandId);
                // Telementry
                this.telemetryService.publicLog2('workbenchActionExecuted', {
                    id: commandPick.commandId,
                    from: runOptions?.from ?? 'quick open'
                });
                // Run
                try {
                    commandPick.args?.length
                        ? await this.commandService.executeCommand(commandPick.commandId, ...commandPick.args)
                        : await this.commandService.executeCommand(commandPick.commandId);
                }
                catch (error) {
                    if (!isCancellationError(error)) {
                        this.dialogService.error(localize('canNotRun', "Command '{0}' resulted in an error", commandPick.label), toErrorMessage(error));
                    }
                }
            },
            trigger: isRecentlyUsed ? (buttonIndex, keyMods) => {
                // The remove button is now the last button
                const removeButtonIndex = existingButtons.length;
                if (buttonIndex === removeButtonIndex) {
                    this.commandsHistory.remove(commandPick.commandId);
                    return TriggerAction.REMOVE_ITEM;
                }
                // Handle other buttons (e.g., configure keybinding button)
                if (commandPick.trigger) {
                    return commandPick.trigger(buttonIndex, keyMods);
                }
                return TriggerAction.NO_ACTION;
            } : commandPick.trigger
        };
    }
    // TF-IDF string to be indexed
    getTfIdfChunk({ label, commandAlias, commandDescription }) {
        let chunk = label;
        if (commandAlias && commandAlias !== label) {
            chunk += ` - ${commandAlias}`;
        }
        if (commandDescription && commandDescription.value !== label) {
            // If the original is the same as the value, don't add it
            chunk += ` - ${commandDescription.value === commandDescription.original ? commandDescription.value : `${commandDescription.value} (${commandDescription.original})`}`;
        }
        return chunk;
    }
};
AbstractCommandsQuickAccessProvider = AbstractCommandsQuickAccessProvider_1 = __decorate([
    __param(1, IInstantiationService),
    __param(2, IKeybindingService),
    __param(3, ICommandService),
    __param(4, ITelemetryService),
    __param(5, IDialogService)
], AbstractCommandsQuickAccessProvider);
export { AbstractCommandsQuickAccessProvider };
let CommandsHistory = class CommandsHistory extends Disposable {
    static { CommandsHistory_1 = this; }
    static { this.DEFAULT_COMMANDS_HISTORY_LENGTH = 50; }
    static { this.PREF_KEY_CACHE = 'commandPalette.mru.cache'; }
    static { this.PREF_KEY_COUNTER = 'commandPalette.mru.counter'; }
    static { this.counter = 1; }
    static { this.hasChanges = false; }
    constructor(storageService, configurationService, logService) {
        super();
        this.storageService = storageService;
        this.configurationService = configurationService;
        this.logService = logService;
        this.configuredCommandsHistoryLength = 0;
        this.updateConfiguration();
        this.load();
        this.registerListeners();
    }
    registerListeners() {
        this._register(this.configurationService.onDidChangeConfiguration(e => this.updateConfiguration(e)));
        this._register(this.storageService.onWillSaveState(e => {
            if (e.reason === WillSaveStateReason.SHUTDOWN) {
                // Commands history is very dynamic and so we limit impact
                // on storage to only save on shutdown. This helps reduce
                // the overhead of syncing this data across machines.
                this.saveState();
            }
        }));
    }
    updateConfiguration(e) {
        if (e && !e.affectsConfiguration('workbench.commandPalette.history')) {
            return;
        }
        this.configuredCommandsHistoryLength = CommandsHistory_1.getConfiguredCommandHistoryLength(this.configurationService);
        if (CommandsHistory_1.cache && CommandsHistory_1.cache.limit !== this.configuredCommandsHistoryLength) {
            CommandsHistory_1.cache.limit = this.configuredCommandsHistoryLength;
            CommandsHistory_1.hasChanges = true;
        }
    }
    load() {
        const raw = this.storageService.get(CommandsHistory_1.PREF_KEY_CACHE, 0 /* StorageScope.PROFILE */);
        let serializedCache;
        if (raw) {
            try {
                serializedCache = JSON.parse(raw);
            }
            catch (error) {
                this.logService.error(`[CommandsHistory] invalid data: ${error}`);
            }
        }
        const cache = CommandsHistory_1.cache = new LRUCache(this.configuredCommandsHistoryLength, 1);
        if (serializedCache) {
            let entries;
            if (serializedCache.usesLRU) {
                entries = serializedCache.entries;
            }
            else {
                entries = serializedCache.entries.sort((a, b) => a.value - b.value);
            }
            entries.forEach(entry => cache.set(entry.key, entry.value));
        }
        CommandsHistory_1.counter = this.storageService.getNumber(CommandsHistory_1.PREF_KEY_COUNTER, 0 /* StorageScope.PROFILE */, CommandsHistory_1.counter);
    }
    push(commandId) {
        if (!CommandsHistory_1.cache) {
            return;
        }
        CommandsHistory_1.cache.set(commandId, CommandsHistory_1.counter++); // set counter to command
        CommandsHistory_1.hasChanges = true;
    }
    peek(commandId) {
        return CommandsHistory_1.cache?.peek(commandId);
    }
    remove(commandId) {
        if (!CommandsHistory_1.cache) {
            return;
        }
        CommandsHistory_1.cache.delete(commandId);
        CommandsHistory_1.hasChanges = true;
    }
    saveState() {
        if (!CommandsHistory_1.cache) {
            return;
        }
        if (!CommandsHistory_1.hasChanges) {
            return;
        }
        const serializedCache = { usesLRU: true, entries: [] };
        CommandsHistory_1.cache.forEach((value, key) => serializedCache.entries.push({ key, value }));
        this.storageService.store(CommandsHistory_1.PREF_KEY_CACHE, JSON.stringify(serializedCache), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        this.storageService.store(CommandsHistory_1.PREF_KEY_COUNTER, CommandsHistory_1.counter, 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        CommandsHistory_1.hasChanges = false;
    }
    static getConfiguredCommandHistoryLength(configurationService) {
        const config = configurationService.getValue();
        const configuredCommandHistoryLength = config.workbench?.commandPalette?.history;
        if (typeof configuredCommandHistoryLength === 'number') {
            return configuredCommandHistoryLength;
        }
        return CommandsHistory_1.DEFAULT_COMMANDS_HISTORY_LENGTH;
    }
    static clearHistory(configurationService, storageService) {
        const commandHistoryLength = CommandsHistory_1.getConfiguredCommandHistoryLength(configurationService);
        CommandsHistory_1.cache = new LRUCache(commandHistoryLength);
        CommandsHistory_1.counter = 1;
        CommandsHistory_1.hasChanges = true;
    }
};
CommandsHistory = CommandsHistory_1 = __decorate([
    __param(0, IStorageService),
    __param(1, IConfigurationService),
    __param(2, ILogService)
], CommandsHistory);
export { CommandsHistory };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWFuZHNRdWlja0FjY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9xdWlja2lucHV0L2Jyb3dzZXIvY29tbWFuZHNRdWlja0FjY2Vzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFJaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN0RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRSxPQUFPLEVBQVUsOEJBQThCLEVBQUUsWUFBWSxFQUFFLEVBQUUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzNHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxVQUFVLEVBQWdDLE1BQU0sbUNBQW1DLENBQUM7QUFDN0YsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsZUFBZSxFQUFFLG9CQUFvQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDdEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBRTNDLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNwRSxPQUFPLEVBQTZCLHFCQUFxQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDL0csT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FB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