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
var SymbolsQuickAccessProvider_1;
import { localize } from '../../../../nls.js';
import { PickerQuickAccessProvider, TriggerAction } from '../../../../platform/quickinput/browser/pickerQuickAccess.js';
import { ThrottledDelayer } from '../../../../base/common/async.js';
import { getWorkspaceSymbols } from '../common/search.js';
import { SymbolKinds } from '../../../../editor/common/languages.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { Schemas } from '../../../../base/common/network.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IEditorService, SIDE_GROUP, ACTIVE_GROUP } from '../../../services/editor/common/editorService.js';
import { Range } from '../../../../editor/common/core/range.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { getSelectionSearchString } from '../../../../editor/contrib/find/browser/findController.js';
import { prepareQuery, scoreFuzzy2, pieceToQuery } from '../../../../base/common/fuzzyScorer.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
let SymbolsQuickAccessProvider = class SymbolsQuickAccessProvider extends PickerQuickAccessProvider {
    static { SymbolsQuickAccessProvider_1 = this; }
    static { this.PREFIX = '#'; }
    static { this.TYPING_SEARCH_DELAY = 200; } // this delay accommodates for the user typing a word and then stops typing to start searching
    static { this.TREAT_AS_GLOBAL_SYMBOL_TYPES = new Set([
        4 /* SymbolKind.Class */,
        9 /* SymbolKind.Enum */,
        0 /* SymbolKind.File */,
        10 /* SymbolKind.Interface */,
        2 /* SymbolKind.Namespace */,
        3 /* SymbolKind.Package */,
        1 /* SymbolKind.Module */
    ]); }
    get defaultFilterValue() {
        // Prefer the word under the cursor in the active editor as default filter
        const editor = this.codeEditorService.getFocusedCodeEditor();
        if (editor) {
            return getSelectionSearchString(editor) ?? undefined;
        }
        return undefined;
    }
    constructor(labelService, openerService, editorService, configurationService, codeEditorService) {
        super(SymbolsQuickAccessProvider_1.PREFIX, {
            canAcceptInBackground: true,
            noResultsPick: {
                label: localize('noSymbolResults', "No matching workspace symbols")
            }
        });
        this.labelService = labelService;
        this.openerService = openerService;
        this.editorService = editorService;
        this.configurationService = configurationService;
        this.codeEditorService = codeEditorService;
        this.delayer = this._register(new ThrottledDelayer(SymbolsQuickAccessProvider_1.TYPING_SEARCH_DELAY));
    }
    get configuration() {
        const editorConfig = this.configurationService.getValue().workbench?.editor;
        return {
            openEditorPinned: !editorConfig?.enablePreviewFromQuickOpen || !editorConfig?.enablePreview,
            openSideBySideDirection: editorConfig?.openSideBySideDirection
        };
    }
    _getPicks(filter, disposables, token) {
        return this.getSymbolPicks(filter, undefined, token);
    }
    async getSymbolPicks(filter, options, token) {
        return this.delayer.trigger(async () => {
            if (token.isCancellationRequested) {
                return [];
            }
            return this.doGetSymbolPicks(prepareQuery(filter), options, token);
        }, options?.delay);
    }
    async doGetSymbolPicks(query, options, token) {
        // Split between symbol and container query
        let symbolQuery;
        let containerQuery;
        if (query.values && query.values.length > 1) {
            symbolQuery = pieceToQuery(query.values[0]); // symbol: only match on first part
            containerQuery = pieceToQuery(query.values.slice(1)); // container: match on all but first parts
        }
        else {
            symbolQuery = query;
        }
        // Run the workspace symbol query
        const workspaceSymbols = await getWorkspaceSymbols(symbolQuery.original, token);
        if (token.isCancellationRequested) {
            return [];
        }
        const symbolPicks = [];
        // Convert to symbol picks and apply filtering
        const openSideBySideDirection = this.configuration.openSideBySideDirection;
        for (const { symbol, provider } of workspaceSymbols) {
            // Depending on the workspace symbols filter setting, skip over symbols that:
            // - do not have a container
            // - and are not treated explicitly as global symbols (e.g. classes)
            if (options?.skipLocal && !SymbolsQuickAccessProvider_1.TREAT_AS_GLOBAL_SYMBOL_TYPES.has(symbol.kind) && !!symbol.containerName) {
                continue;
            }
            const symbolLabel = symbol.name;
            // Score by symbol label if searching
            let symbolScore = undefined;
            let symbolMatches = undefined;
            let skipContainerQuery = false;
            if (symbolQuery.original.length > 0) {
                // First: try to score on the entire query, it is possible that
                // the symbol matches perfectly (e.g. searching for "change log"
                // can be a match on a markdown symbol "change log"). In that
                // case we want to skip the container query altogether.
                if (symbolQuery !== query) {
                    [symbolScore, symbolMatches] = scoreFuzzy2(symbolLabel, { ...query, values: undefined /* disable multi-query support */ }, 0, 0);
                    if (typeof symbolScore === 'number') {
                        skipContainerQuery = true; // since we consumed the query, skip any container matching
                    }
                }
                // Otherwise: score on the symbol query and match on the container later
                if (typeof symbolScore !== 'number') {
                    [symbolScore, symbolMatches] = scoreFuzzy2(symbolLabel, symbolQuery, 0, 0);
                    if (typeof symbolScore !== 'number') {
                        continue;
                    }
                }
            }
            const symbolUri = symbol.location.uri;
            let containerLabel = undefined;
            if (symbolUri) {
                const containerPath = this.labelService.getUriLabel(symbolUri, { relative: true });
                if (symbol.containerName) {
                    containerLabel = `${symbol.containerName} • ${containerPath}`;
                }
                else {
                    containerLabel = containerPath;
                }
            }
            // Score by container if specified and searching
            let containerScore = undefined;
            let containerMatches = undefined;
            if (!skipContainerQuery && containerQuery && containerQuery.original.length > 0) {
                if (containerLabel) {
                    [containerScore, containerMatches] = scoreFuzzy2(containerLabel, containerQuery);
                }
                if (typeof containerScore !== 'number') {
                    continue;
                }
                if (typeof symbolScore === 'number') {
                    symbolScore += containerScore; // boost symbolScore by containerScore
                }
            }
            const deprecated = symbol.tags ? symbol.tags.indexOf(1 /* SymbolTag.Deprecated */) >= 0 : false;
            symbolPicks.push({
                symbol,
                resource: symbolUri,
                score: symbolScore,
                iconClass: ThemeIcon.asClassName(SymbolKinds.toIcon(symbol.kind)),
                label: symbolLabel,
                ariaLabel: symbolLabel,
                highlights: deprecated ? undefined : {
                    label: symbolMatches,
                    description: containerMatches
                },
                description: containerLabel,
                strikethrough: deprecated,
                buttons: [
                    {
                        iconClass: openSideBySideDirection === 'right' ? ThemeIcon.asClassName(Codicon.splitHorizontal) : ThemeIcon.asClassName(Codicon.splitVertical),
                        tooltip: openSideBySideDirection === 'right' ? localize('openToSide', "Open to the Side") : localize('openToBottom', "Open to the Bottom")
                    }
                ],
                trigger: (buttonIndex, keyMods) => {
                    this.openSymbol(provider, symbol, token, { keyMods, forceOpenSideBySide: true });
                    return TriggerAction.CLOSE_PICKER;
                },
                accept: async (keyMods, event) => this.openSymbol(provider, symbol, token, { keyMods, preserveFocus: event.inBackground, forcePinned: event.inBackground }),
            });
        }
        // Sort picks (unless disabled)
        if (!options?.skipSorting) {
            symbolPicks.sort((symbolA, symbolB) => this.compareSymbols(symbolA, symbolB));
        }
        return symbolPicks;
    }
    async openSymbol(provider, symbol, token, options) {
        // Resolve actual symbol to open for providers that can resolve
        let symbolToOpen = symbol;
        if (typeof provider.resolveWorkspaceSymbol === 'function') {
            symbolToOpen = await provider.resolveWorkspaceSymbol(symbol, token) || symbol;
            if (token.isCancellationRequested) {
                return;
            }
        }
        // Open HTTP(s) links with opener service
        if (symbolToOpen.location.uri.scheme === Schemas.http || symbolToOpen.location.uri.scheme === Schemas.https) {
            await this.openerService.open(symbolToOpen.location.uri, { fromUserGesture: true, allowContributedOpeners: true });
        }
        // Otherwise open as editor
        else {
            await this.editorService.openEditor({
                resource: symbolToOpen.location.uri,
                options: {
                    preserveFocus: options?.preserveFocus,
                    pinned: options.keyMods.ctrlCmd || options.forcePinned || this.configuration.openEditorPinned,
                    selection: symbolToOpen.location.range ? Range.collapseToStart(symbolToOpen.location.range) : undefined
                }
            }, options.keyMods.alt || (this.configuration.openEditorPinned && options.keyMods.ctrlCmd) || options?.forceOpenSideBySide ? SIDE_GROUP : ACTIVE_GROUP);
        }
    }
    compareSymbols(symbolA, symbolB) {
        // By score
        if (typeof symbolA.score === 'number' && typeof symbolB.score === 'number') {
            if (symbolA.score > symbolB.score) {
                return -1;
            }
            if (symbolA.score < symbolB.score) {
                return 1;
            }
        }
        // By name
        if (symbolA.symbol && symbolB.symbol) {
            const symbolAName = symbolA.symbol.name.toLowerCase();
            const symbolBName = symbolB.symbol.name.toLowerCase();
            const res = symbolAName.localeCompare(symbolBName);
            if (res !== 0) {
                return res;
            }
        }
        // By kind
        if (symbolA.symbol && symbolB.symbol) {
            const symbolAKind = SymbolKinds.toIcon(symbolA.symbol.kind).id;
            const symbolBKind = SymbolKinds.toIcon(symbolB.symbol.kind).id;
            return symbolAKind.localeCompare(symbolBKind);
        }
        return 0;
    }
};
SymbolsQuickAccessProvider = SymbolsQuickAccessProvider_1 = __decorate([
    __param(0, ILabelService),
    __param(1, IOpenerService),
    __param(2, IEditorService),
    __param(3, IConfigurationService),
    __param(4, ICodeEditorService)
], SymbolsQuickAccessProvider);
export { SymbolsQuickAccessProvider };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ltYm9sc1F1aWNrQWNjZXNzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3NlYXJjaC9icm93c2VyL3N5bWJvbHNRdWlja0FjY2Vzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBMEIseUJBQXlCLEVBQUUsYUFBYSxFQUFFLE1BQU0sOERBQThELENBQUM7QUFHaEosT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDcEUsT0FBTyxFQUFFLG1CQUFtQixFQUE4QyxNQUFNLHFCQUFxQixDQUFDO0FBQ3RHLE9BQU8sRUFBRSxXQUFXLEVBQXlCLE1BQU0sd0NBQXdDLENBQUM7QUFDNUYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDOUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDNUcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBR25HLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzlGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxZQUFZLEVBQWtCLFdBQVcsRUFBRSxZQUFZLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUVqSCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBTzFELElBQU0sMEJBQTBCLEdBQWhDLE1BQU0sMEJBQTJCLFNBQVEseUJBQStDOzthQUV2RixXQUFNLEdBQUcsR0FBRyxBQUFOLENBQU87YUFFSSx3QkFBbUIsR0FBRyxHQUFHLEFBQU4sQ0FBTyxHQUFDLDhGQUE4RjthQUVsSSxpQ0FBNEIsR0FBRyxJQUFJLEdBQUcsQ0FBYTs7Ozs7Ozs7S0FRakUsQ0FBQyxBQVJ5QyxDQVF4QztJQUlILElBQUksa0JBQWtCO1FBRXJCLDBFQUEwRTtRQUMxRSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztRQUM3RCxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1osT0FBTyx3QkFBd0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxTQUFTLENBQUM7UUFDdEQsQ0FBQztRQUVELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFFRCxZQUNnQixZQUE0QyxFQUMzQyxhQUE4QyxFQUM5QyxhQUE4QyxFQUN2QyxvQkFBNEQsRUFDL0QsaUJBQXNEO1FBRTFFLEtBQUssQ0FBQyw0QkFBMEIsQ0FBQyxNQUFNLEVBQUU7WUFDeEMscUJBQXFCLEVBQUUsSUFBSTtZQUMzQixhQUFhLEVBQUU7Z0JBQ2QsS0FBSyxFQUFFLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRSwrQkFBK0IsQ0FBQzthQUNuRTtTQUNELENBQUMsQ0FBQztRQVg2QixpQkFBWSxHQUFaLFlBQVksQ0FBZTtRQUMxQixrQkFBYSxHQUFiLGFBQWEsQ0FBZ0I7UUFDN0Isa0JBQWEsR0FBYixhQUFhLENBQWdCO1FBQ3RCLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBdUI7UUFDOUMsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFvQjtRQWxCbkUsWUFBTyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxnQkFBZ0IsQ0FBeUIsNEJBQTBCLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO0lBMEIvSCxDQUFDO0lBRUQsSUFBWSxhQUFhO1FBQ3hCLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLEVBQWlDLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQztRQUUzRyxPQUFPO1lBQ04sZ0JBQWdCLEVBQUUsQ0FBQyxZQUFZLEVBQUUsMEJBQTBCLElBQUksQ0FBQyxZQUFZLEVBQUUsYUFBYTtZQUMzRix1QkFBdUIsRUFBRSxZQUFZLEVBQUUsdUJBQXVCO1NBQzlELENBQUM7SUFDSCxDQUFDO0lBRVMsU0FBUyxDQUFDLE1BQWMsRUFBRSxXQUE0QixFQUFFLEtBQXdCO1FBQ3pGLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFRCxLQUFLLENBQUMsY0FBYyxDQUFDLE1BQWMsRUFBRSxPQUFtRixFQUFFLEtBQXdCO1FBQ2pKLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLEVBQUU7WUFDdEMsSUFBSSxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztnQkFDbkMsT0FBTyxFQUFFLENBQUM7WUFDWCxDQUFDO1lBRUQsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNwRSxDQUFDLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3BCLENBQUM7SUFFTyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsS0FBcUIsRUFBRSxPQUFtRSxFQUFFLEtBQXdCO1FBRWxKLDJDQUEyQztRQUMzQyxJQUFJLFdBQTJCLENBQUM7UUFDaEMsSUFBSSxjQUEwQyxDQUFDO1FBQy9DLElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUM3QyxXQUFXLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFLLG1DQUFtQztZQUNwRixjQUFjLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQywwQ0FBMEM7UUFDakcsQ0FBQzthQUFNLENBQUM7WUFDUCxXQUFXLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLENBQUM7UUFFRCxpQ0FBaUM7UUFDakMsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDaEYsSUFBSSxLQUFLLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztZQUNuQyxPQUFPLEVBQUUsQ0FBQztRQUNYLENBQUM7UUFFRCxNQUFNLFdBQVcsR0FBZ0MsRUFBRSxDQUFDO1FBRXBELDhDQUE4QztRQUM5QyxNQUFNLHVCQUF1QixHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsdUJBQXVCLENBQUM7UUFDM0UsS0FBSyxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxJQUFJLGdCQUFnQixFQUFFLENBQUM7WUFFckQsNkVBQTZFO1lBQzdFLDRCQUE0QjtZQUM1QixvRUFBb0U7WUFDcEUsSUFBSSxPQUFPLEVBQUUsU0FBUyxJQUFJLENBQUMsNEJBQTBCLENBQUMsNEJBQTRCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLGFBQWEsRUFBRSxDQUFDO2dCQUMvSCxTQUFTO1lBQ1YsQ0FBQztZQUVELE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7WUFFaEMscUNBQXFDO1lBQ3JDLElBQUksV0FBVyxHQUF1QixTQUFTLENBQUM7WUFDaEQsSUFBSSxhQUFhLEdBQXlCLFNBQVMsQ0FBQztZQUNwRCxJQUFJLGtCQUFrQixHQUFHLEtBQUssQ0FBQztZQUMvQixJQUFJLFdBQVcsQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUVyQywrREFBK0Q7Z0JBQy9ELGdFQUFnRTtnQkFDaEUsNkRBQTZEO2dCQUM3RCx1REFBdUQ7Z0JBQ3ZELElBQUksV0FBVyxLQUFLLEtBQUssRUFBRSxDQUFDO29CQUMzQixDQUFDLFdBQVcsRUFBRSxhQUFhLENBQUMsR0FBRyxXQUFXLENBQUMsV0FBVyxFQUFFLEVBQUUsR0FBRyxLQUFLLEVBQUUsTUFBTSxFQUFFLFNBQVMsQ0FBQyxpQ0FBaUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDakksSUFBSSxPQUFPLFdBQVcsS0FBSyxRQUFRLEVBQUUsQ0FBQzt3QkFDckMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLENBQUMsMkRBQTJEO29CQUN2RixDQUFDO2dCQUNGLENBQUM7Z0JBRUQsd0VBQXdFO2dCQUN4RSxJQUFJLE9BQU8sV0FBVyxLQUFLLFFBQVEsRUFBRSxDQUFDO29CQUNyQyxDQUFDLFdBQVcsRUFBRSxhQUFhLENBQUMsR0FBRyxXQUFXLENBQUMsV0FBVyxFQUFFLFdBQVcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQzNFLElBQUksT0FBTyxXQUFXLEtBQUssUUFBUSxFQUFFLENBQUM7d0JBQ3JDLFNBQVM7b0JBQ1YsQ0FBQztnQkFDRixDQUFDO1lBQ0YsQ0FBQztZQUVELE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDO1lBQ3RDLElBQUksY0FBYyxHQUF1QixTQUFTLENBQUM7WUFDbkQsSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDZixNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztnQkFDbkYsSUFBSSxNQUFNLENBQUMsYUFBYSxFQUFFLENBQUM7b0JBQzFCLGNBQWMsR0FBRyxHQUFHLE1BQU0sQ0FBQyxhQUFhLE1BQU0sYUFBYSxFQUFFLENBQUM7Z0JBQy9ELENBQUM7cUJBQU0sQ0FBQztvQkFDUCxjQUFjLEdBQUcsYUFBYSxDQUFDO2dCQUNoQyxDQUFDO1lBQ0YsQ0FBQztZQUVELGdEQUFnRDtZQUNoRCxJQUFJLGNBQWMsR0FBdUIsU0FBUyxDQUFDO1lBQ25ELElBQUksZ0JBQWdCLEdBQXlCLFNBQVMsQ0FBQztZQUN2RCxJQUFJLENBQUMsa0JBQWtCLElBQUksY0FBYyxJQUFJLGNBQWMsQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUNqRixJQUFJLGNBQWMsRUFBRSxDQUFDO29CQUNwQixDQUFDLGNBQWMsRUFBRSxnQkFBZ0IsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxjQUFjLEVBQUUsY0FBYyxDQUFDLENBQUM7Z0JBQ2xGLENBQUM7Z0JBRUQsSUFBSSxPQUFPLGNBQWMsS0FBSyxRQUFRLEVBQUUsQ0FBQztvQkFDeEMsU0FBUztnQkFDVixDQUFDO2dCQUVELElBQUksT0FBTyxXQUFXLEtBQUssUUFBUSxFQUFFLENBQUM7b0JBQ3JDLFdBQVcsSUFBSSxjQUFjLENBQUMsQ0FBQyxzQ0FBc0M7Z0JBQ3RFLENBQUM7WUFDRixDQUFDO1lBRUQsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLDhCQUFzQixJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1lBRXhGLFdBQVcsQ0FBQyxJQUFJLENBQUM7Z0JBQ2hCLE1BQU07Z0JBQ04sUUFBUSxFQUFFLFNBQVM7Z0JBQ25CLEtBQUssRUFBRSxXQUFXO2dCQUNsQixTQUFTLEVBQUUsU0FBUyxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDakUsS0FBSyxFQUFFLFdBQVc7Z0JBQ2xCLFNBQVMsRUFBRSxXQUFXO2dCQUN0QixVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUNwQyxLQUFLLEVBQUUsYUFBYTtvQkFDcEIsV0FBVyxFQUFFLGdCQUFnQjtpQkFDN0I7Z0JBQ0QsV0FBVyxFQUFFLGNBQWM7Z0JBQzNCLGFBQWEsRUFBRSxVQUFVO2dCQUN6QixPQUFPLEVBQUU7b0JBQ1I7d0JBQ0MsU0FBUyxFQUFFLHVCQUF1QixLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQzt3QkFDOUksT0FBTyxFQUFFLHVCQUF1QixLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksRUFBRSxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFLG9CQUFvQixDQUFDO3FCQUMxSTtpQkFDRDtnQkFDRCxPQUFPLEVBQUUsQ0FBQyxXQUFXLEVBQUUsT0FBTyxFQUFFLEVBQUU7b0JBQ2pDLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztvQkFFakYsT0FBTyxhQUFhLENBQUMsWUFBWSxDQUFDO2dCQUNuQyxDQUFDO2dCQUNELE1BQU0sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsS0FBSyxDQUFDLFlBQVksRUFBRSxXQUFXLEVBQUUsS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDO2FBQzNKLENBQUMsQ0FBQztRQUVKLENBQUM7UUFFRCwrQkFBK0I7UUFDL0IsSUFBSSxDQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsQ0FBQztZQUMzQixXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUMvRSxDQUFDO1FBRUQsT0FBTyxXQUFXLENBQUM7SUFDcEIsQ0FBQztJQUVPLEtBQUssQ0FBQyxVQUFVLENBQUMsUUFBa0MsRUFBRSxNQUF3QixFQUFFLEtBQXdCLEVBQUUsT0FBNkc7UUFFN04sK0RBQStEO1FBQy9ELElBQUksWUFBWSxHQUFHLE1BQU0sQ0FBQztRQUMxQixJQUFJLE9BQU8sUUFBUSxDQUFDLHNCQUFzQixLQUFLLFVBQVUsRUFBRSxDQUFDO1lBQzNELFlBQVksR0FBRyxNQUFNLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDO1lBRTlFLElBQUksS0FBSyxDQUFDLHVCQUF1QixFQUFFLENBQUM7Z0JBQ25DLE9BQU87WUFDUixDQUFDO1FBQ0YsQ0FBQztRQUVELHlDQUF5QztRQUN6QyxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLE1BQU0sS0FBSyxPQUFPLENBQUMsSUFBSSxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLE1BQU0sS0FBSyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDN0csTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxFQUFFLGVBQWUsRUFBRSxJQUFJLEVBQUUsdUJBQXVCLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNwSCxDQUFDO1FBRUQsMkJBQTJCO2FBQ3RCLENBQUM7WUFDTCxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDO2dCQUNuQyxRQUFRLEVBQUUsWUFBWSxDQUFDLFFBQVEsQ0FBQyxHQUFHO2dCQUNuQyxPQUFPLEVBQUU7b0JBQ1IsYUFBYSxFQUFFLE9BQU8sRUFBRSxhQUFhO29CQUNyQyxNQUFNLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQjtvQkFDN0YsU0FBUyxFQUFFLFlBQVksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7aUJBQ3ZHO2FBQ0QsRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxPQUFPLEVBQUUsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDekosQ0FBQztJQUNGLENBQUM7SUFFTyxjQUFjLENBQUMsT0FBNkIsRUFBRSxPQUE2QjtRQUVsRixXQUFXO1FBQ1gsSUFBSSxPQUFPLE9BQU8sQ0FBQyxLQUFLLEtBQUssUUFBUSxJQUFJLE9BQU8sT0FBTyxDQUFDLEtBQUssS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUM1RSxJQUFJLE9BQU8sQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUNuQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ1gsQ0FBQztZQUVELElBQUksT0FBTyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ25DLE9BQU8sQ0FBQyxDQUFDO1lBQ1YsQ0FBQztRQUNGLENBQUM7UUFFRCxVQUFVO1FBQ1YsSUFBSSxPQUFPLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN0QyxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN0RCxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUN0RCxNQUFNLEdBQUcsR0FBRyxXQUFXLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ25ELElBQUksR0FBRyxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUNmLE9BQU8sR0FBRyxDQUFDO1lBQ1osQ0FBQztRQUNGLENBQUM7UUFFRCxVQUFVO1FBQ1YsSUFBSSxPQUFPLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN0QyxNQUFNLFdBQVcsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQy9ELE1BQU0sV0FBVyxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDL0QsT0FBTyxXQUFXLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQy9DLENBQUM7UUFFRCxPQUFPLENBQUMsQ0FBQztJQUNWLENBQUM7O0FBOVBXLDBCQUEwQjtJQThCcEMsV0FBQSxhQUFhLENBQUE7SUFDYixXQUFBLGNBQWMsQ0FBQTtJQUNkLFdBQUEsY0FBYyxDQUFBO0lBQ2QsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLGtCQUFrQixDQUFBO0dBbENSLDBCQUEwQixDQStQdEMifQ==