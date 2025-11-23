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
import { extname, isEqual } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { ToggleCaseSensitiveKeybinding, ToggleRegexKeybinding, ToggleWholeWordKeybinding } from '../../../../editor/contrib/find/browser/findModel.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor } from '../../../browser/editor.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { EditorExtensions, DEFAULT_EDITOR_ASSOCIATION } from '../../../common/editor.js';
import { ActiveEditorContext } from '../../../common/contextkeys.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { getSearchView } from '../../search/browser/searchActionsBase.js';
import { searchNewEditorIcon, searchRefreshIcon } from '../../search/browser/searchIcons.js';
import * as SearchConstants from '../../search/common/constants.js';
import * as SearchEditorConstants from './constants.js';
import { SearchEditor } from './searchEditor.js';
import { createEditorFromSearchResult, modifySearchEditorContextLinesCommand, openNewSearchEditor, openSearchEditor, selectAllSearchEditorMatchesCommand, toggleSearchEditorCaseSensitiveCommand, toggleSearchEditorContextLinesCommand, toggleSearchEditorRegexCommand, toggleSearchEditorWholeWordCommand } from './searchEditorActions.js';
import { getOrMakeSearchEditorInput, SearchEditorInput, SEARCH_EDITOR_EXT } from './searchEditorInput.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { VIEW_ID } from '../../../services/search/common/search.js';
import { RegisteredEditorPriority, IEditorResolverService } from '../../../services/editor/common/editorResolverService.js';
import { IWorkingCopyEditorService } from '../../../services/workingCopy/common/workingCopyEditorService.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { getActiveElement } from '../../../../base/browser/dom.js';
const OpenInEditorCommandId = 'search.action.openInEditor';
const OpenNewEditorToSideCommandId = 'search.action.openNewEditorToSide';
const FocusQueryEditorWidgetCommandId = 'search.action.focusQueryEditorWidget';
const FocusQueryEditorFilesToIncludeCommandId = 'search.action.focusFilesToInclude';
const FocusQueryEditorFilesToExcludeCommandId = 'search.action.focusFilesToExclude';
const ToggleSearchEditorCaseSensitiveCommandId = 'toggleSearchEditorCaseSensitive';
const ToggleSearchEditorWholeWordCommandId = 'toggleSearchEditorWholeWord';
const ToggleSearchEditorRegexCommandId = 'toggleSearchEditorRegex';
const IncreaseSearchEditorContextLinesCommandId = 'increaseSearchEditorContextLines';
const DecreaseSearchEditorContextLinesCommandId = 'decreaseSearchEditorContextLines';
const RerunSearchEditorSearchCommandId = 'rerunSearchEditorSearch';
const CleanSearchEditorStateCommandId = 'cleanSearchEditorState';
const SelectAllSearchEditorMatchesCommandId = 'selectAllSearchEditorMatches';
//#region Editor Descriptior
Registry.as(EditorExtensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(SearchEditor, SearchEditor.ID, localize('searchEditor', "Search Editor")), [
    new SyncDescriptor(SearchEditorInput)
]);
//#endregion
//#region Startup Contribution
let SearchEditorContribution = class SearchEditorContribution {
    static { this.ID = 'workbench.contrib.searchEditor'; }
    constructor(editorResolverService, instantiationService) {
        editorResolverService.registerEditor('*' + SEARCH_EDITOR_EXT, {
            id: SearchEditorInput.ID,
            label: localize('promptOpenWith.searchEditor.displayName', "Search Editor"),
            detail: DEFAULT_EDITOR_ASSOCIATION.providerDisplayName,
            priority: RegisteredEditorPriority.default,
        }, {
            singlePerResource: true,
            canSupportResource: resource => (extname(resource) === SEARCH_EDITOR_EXT)
        }, {
            createEditorInput: ({ resource }) => {
                return { editor: instantiationService.invokeFunction(getOrMakeSearchEditorInput, { from: 'existingFile', fileUri: resource }) };
            }
        });
    }
};
SearchEditorContribution = __decorate([
    __param(0, IEditorResolverService),
    __param(1, IInstantiationService)
], SearchEditorContribution);
registerWorkbenchContribution2(SearchEditorContribution.ID, SearchEditorContribution, 1 /* WorkbenchPhase.BlockStartup */);
class SearchEditorInputSerializer {
    canSerialize(input) {
        return !!input.tryReadConfigSync();
    }
    serialize(input) {
        if (!this.canSerialize(input)) {
            return undefined;
        }
        if (input.isDisposed()) {
            return JSON.stringify({ modelUri: undefined, dirty: false, config: input.tryReadConfigSync(), name: input.getName(), matchRanges: [], backingUri: input.backingUri?.toString() });
        }
        let modelUri = undefined;
        if (input.modelUri.path || input.modelUri.fragment && input.isDirty()) {
            modelUri = input.modelUri.toString();
        }
        const config = input.tryReadConfigSync();
        const dirty = input.isDirty();
        const matchRanges = dirty ? input.getMatchRanges() : [];
        const backingUri = input.backingUri;
        return JSON.stringify({ modelUri, dirty, config, name: input.getName(), matchRanges, backingUri: backingUri?.toString() });
    }
    deserialize(instantiationService, serializedEditorInput) {
        const { modelUri, dirty, config, matchRanges, backingUri } = JSON.parse(serializedEditorInput);
        if (config && (config.query !== undefined)) {
            if (modelUri) {
                const input = instantiationService.invokeFunction(getOrMakeSearchEditorInput, { from: 'model', modelUri: URI.parse(modelUri), config, backupOf: backingUri ? URI.parse(backingUri) : undefined });
                input.setDirty(dirty);
                input.setMatchRanges(matchRanges);
                return input;
            }
            else {
                if (backingUri) {
                    return instantiationService.invokeFunction(getOrMakeSearchEditorInput, { from: 'existingFile', fileUri: URI.parse(backingUri) });
                }
                else {
                    return instantiationService.invokeFunction(getOrMakeSearchEditorInput, { from: 'rawData', resultsContents: '', config });
                }
            }
        }
        return undefined;
    }
}
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(SearchEditorInput.ID, SearchEditorInputSerializer);
//#endregion
//#region Commands
CommandsRegistry.registerCommand(CleanSearchEditorStateCommandId, (accessor) => {
    const activeEditorPane = accessor.get(IEditorService).activeEditorPane;
    if (activeEditorPane instanceof SearchEditor) {
        activeEditorPane.cleanState();
    }
});
//#endregion
//#region Actions
const category = localize2('search', 'Search Editor');
const translateLegacyConfig = (legacyConfig = {}) => {
    const config = {};
    const overrides = {
        includes: 'filesToInclude',
        excludes: 'filesToExclude',
        wholeWord: 'matchWholeWord',
        caseSensitive: 'isCaseSensitive',
        regexp: 'isRegexp',
        useIgnores: 'useExcludeSettingsAndIgnoreFiles',
    };
    Object.entries(legacyConfig).forEach(([key, value]) => {
        // eslint-disable-next-line local/code-no-any-casts
        config[overrides[key] ?? key] = value;
    });
    return config;
};
const openArgMetadata = {
    description: 'Open a new search editor. Arguments passed can include variables like ${relativeFileDirname}.',
    args: [{
            name: 'Open new Search Editor args',
            schema: {
                properties: {
                    query: { type: 'string' },
                    filesToInclude: { type: 'string' },
                    filesToExclude: { type: 'string' },
                    contextLines: { type: 'number' },
                    matchWholeWord: { type: 'boolean' },
                    isCaseSensitive: { type: 'boolean' },
                    isRegexp: { type: 'boolean' },
                    useExcludeSettingsAndIgnoreFiles: { type: 'boolean' },
                    showIncludesExcludes: { type: 'boolean' },
                    triggerSearch: { type: 'boolean' },
                    focusResults: { type: 'boolean' },
                    onlyOpenEditors: { type: 'boolean' },
                }
            }
        }]
};
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'search.searchEditor.action.deleteFileResults',
            title: localize2('searchEditor.deleteResultBlock', 'Delete File Results'),
            keybinding: {
                weight: 100 /* KeybindingWeight.EditorContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 1 /* KeyCode.Backspace */,
            },
            precondition: SearchEditorConstants.InSearchEditor,
            category,
            f1: true,
        });
    }
    async run(accessor) {
        const contextService = accessor.get(IContextKeyService).getContext(getActiveElement());
        if (contextService.getValue(SearchEditorConstants.InSearchEditor.serialize())) {
            accessor.get(IEditorService).activeEditorPane.deleteResultBlock();
        }
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: SearchEditorConstants.OpenNewEditorCommandId,
            title: localize2('search.openNewSearchEditor', 'New Search Editor'),
            category,
            f1: true,
            metadata: openArgMetadata
        });
    }
    async run(accessor, args) {
        await accessor.get(IInstantiationService).invokeFunction(openNewSearchEditor, translateLegacyConfig({ location: 'new', ...args }));
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: SearchEditorConstants.OpenEditorCommandId,
            title: localize2('search.openSearchEditor', 'Open Search Editor'),
            category,
            f1: true,
            metadata: openArgMetadata
        });
    }
    async run(accessor, args) {
        await accessor.get(IInstantiationService).invokeFunction(openNewSearchEditor, translateLegacyConfig({ location: 'reuse', ...args }));
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: OpenNewEditorToSideCommandId,
            title: localize2('search.openNewEditorToSide', 'Open New Search Editor to the Side'),
            category,
            f1: true,
            metadata: openArgMetadata
        });
    }
    async run(accessor, args) {
        await accessor.get(IInstantiationService).invokeFunction(openNewSearchEditor, translateLegacyConfig(args), true);
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: OpenInEditorCommandId,
            title: localize2('search.openResultsInEditor', 'Open Results in Editor'),
            category,
            f1: true,
            keybinding: {
                primary: 512 /* KeyMod.Alt */ | 3 /* KeyCode.Enter */,
                when: ContextKeyExpr.and(SearchConstants.SearchContext.HasSearchResults, SearchConstants.SearchContext.SearchViewFocusedKey),
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                mac: {
                    primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */
                }
            },
        });
    }
    async run(accessor) {
        const viewsService = accessor.get(IViewsService);
        const instantiationService = accessor.get(IInstantiationService);
        const searchView = getSearchView(viewsService);
        if (searchView) {
            await instantiationService.invokeFunction(createEditorFromSearchResult, searchView.searchResult, searchView.searchIncludePattern.getValue(), searchView.searchExcludePattern.getValue(), searchView.searchIncludePattern.onlySearchInOpenEditors());
        }
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: RerunSearchEditorSearchCommandId,
            title: localize2('search.rerunSearchInEditor', 'Search Again'),
            category,
            keybinding: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 48 /* KeyCode.KeyR */,
                when: SearchEditorConstants.InSearchEditor,
                weight: 100 /* KeybindingWeight.EditorContrib */
            },
            icon: searchRefreshIcon,
            menu: [...[MenuId.EditorTitle, MenuId.CompactWindowEditorTitle].map(id => ({
                    id,
                    group: 'navigation',
                    when: ActiveEditorContext.isEqualTo(SearchEditorConstants.SearchEditorID)
                })),
                {
                    id: MenuId.CommandPalette,
                    when: ActiveEditorContext.isEqualTo(SearchEditorConstants.SearchEditorID)
                }]
        });
    }
    async run(accessor) {
        const editorService = accessor.get(IEditorService);
        const input = editorService.activeEditor;
        if (input instanceof SearchEditorInput) {
            editorService.activeEditorPane.triggerSearch({ resetCursor: false });
        }
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: FocusQueryEditorWidgetCommandId,
            title: localize2('search.action.focusQueryEditorWidget', 'Focus Search Editor Input'),
            category,
            f1: true,
            precondition: SearchEditorConstants.InSearchEditor,
            keybinding: {
                primary: 9 /* KeyCode.Escape */,
                weight: 100 /* KeybindingWeight.EditorContrib */
            }
        });
    }
    async run(accessor) {
        const editorService = accessor.get(IEditorService);
        const input = editorService.activeEditor;
        if (input instanceof SearchEditorInput) {
            editorService.activeEditorPane.focusSearchInput();
        }
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: FocusQueryEditorFilesToIncludeCommandId,
            title: localize2('search.action.focusFilesToInclude', 'Focus Search Editor Files to Include'),
            category,
            f1: true,
            precondition: SearchEditorConstants.InSearchEditor,
        });
    }
    async run(accessor) {
        const editorService = accessor.get(IEditorService);
        const input = editorService.activeEditor;
        if (input instanceof SearchEditorInput) {
            editorService.activeEditorPane.focusFilesToIncludeInput();
        }
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: FocusQueryEditorFilesToExcludeCommandId,
            title: localize2('search.action.focusFilesToExclude', 'Focus Search Editor Files to Exclude'),
            category,
            f1: true,
            precondition: SearchEditorConstants.InSearchEditor,
        });
    }
    async run(accessor) {
        const editorService = accessor.get(IEditorService);
        const input = editorService.activeEditor;
        if (input instanceof SearchEditorInput) {
            editorService.activeEditorPane.focusFilesToExcludeInput();
        }
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: ToggleSearchEditorCaseSensitiveCommandId,
            title: localize2('searchEditor.action.toggleSearchEditorCaseSensitive', 'Toggle Match Case'),
            category,
            f1: true,
            precondition: SearchEditorConstants.InSearchEditor,
            keybinding: Object.assign({
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                when: SearchConstants.SearchContext.SearchInputBoxFocusedKey,
            }, ToggleCaseSensitiveKeybinding)
        });
    }
    run(accessor) {
        toggleSearchEditorCaseSensitiveCommand(accessor);
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: ToggleSearchEditorWholeWordCommandId,
            title: localize2('searchEditor.action.toggleSearchEditorWholeWord', 'Toggle Match Whole Word'),
            category,
            f1: true,
            precondition: SearchEditorConstants.InSearchEditor,
            keybinding: Object.assign({
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                when: SearchConstants.SearchContext.SearchInputBoxFocusedKey,
            }, ToggleWholeWordKeybinding)
        });
    }
    run(accessor) {
        toggleSearchEditorWholeWordCommand(accessor);
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: ToggleSearchEditorRegexCommandId,
            title: localize2('searchEditor.action.toggleSearchEditorRegex', "Toggle Use Regular Expression"),
            category,
            f1: true,
            precondition: SearchEditorConstants.InSearchEditor,
            keybinding: Object.assign({
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                when: SearchConstants.SearchContext.SearchInputBoxFocusedKey,
            }, ToggleRegexKeybinding)
        });
    }
    run(accessor) {
        toggleSearchEditorRegexCommand(accessor);
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: SearchEditorConstants.ToggleSearchEditorContextLinesCommandId,
            title: localize2('searchEditor.action.toggleSearchEditorContextLines', "Toggle Context Lines"),
            category,
            f1: true,
            precondition: SearchEditorConstants.InSearchEditor,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 512 /* KeyMod.Alt */ | 42 /* KeyCode.KeyL */,
                mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 42 /* KeyCode.KeyL */ }
            }
        });
    }
    run(accessor) {
        toggleSearchEditorContextLinesCommand(accessor);
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: IncreaseSearchEditorContextLinesCommandId,
            title: localize2('searchEditor.action.increaseSearchEditorContextLines', "Increase Context Lines"),
            category,
            f1: true,
            precondition: SearchEditorConstants.InSearchEditor,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 512 /* KeyMod.Alt */ | 86 /* KeyCode.Equal */
            }
        });
    }
    run(accessor) { modifySearchEditorContextLinesCommand(accessor, true); }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: DecreaseSearchEditorContextLinesCommandId,
            title: localize2('searchEditor.action.decreaseSearchEditorContextLines', "Decrease Context Lines"),
            category,
            f1: true,
            precondition: SearchEditorConstants.InSearchEditor,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 512 /* KeyMod.Alt */ | 88 /* KeyCode.Minus */
            }
        });
    }
    run(accessor) { modifySearchEditorContextLinesCommand(accessor, false); }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: SelectAllSearchEditorMatchesCommandId,
            title: localize2('searchEditor.action.selectAllSearchEditorMatches', "Select All Matches"),
            category,
            f1: true,
            precondition: SearchEditorConstants.InSearchEditor,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 42 /* KeyCode.KeyL */,
            }
        });
    }
    run(accessor) {
        selectAllSearchEditorMatchesCommand(accessor);
    }
});
registerAction2(class OpenSearchEditorAction extends Action2 {
    constructor() {
        super({
            id: 'search.action.openNewEditorFromView',
            title: localize('search.openNewEditor', "Open New Search Editor"),
            category,
            icon: searchNewEditorIcon,
            menu: [{
                    id: MenuId.ViewTitle,
                    group: 'navigation',
                    order: 2,
                    when: ContextKeyExpr.equals('view', VIEW_ID),
                }]
        });
    }
    run(accessor, ...args) {
        return openSearchEditor(accessor);
    }
});
//#endregion
//#region Search Editor Working Copy Editor Handler
let SearchEditorWorkingCopyEditorHandler = class SearchEditorWorkingCopyEditorHandler extends Disposable {
    static { this.ID = 'workbench.contrib.searchEditorWorkingCopyEditorHandler'; }
    constructor(instantiationService, workingCopyEditorService) {
        super();
        this.instantiationService = instantiationService;
        this._register(workingCopyEditorService.registerHandler(this));
    }
    handles(workingCopy) {
        return workingCopy.resource.scheme === SearchEditorConstants.SearchEditorScheme;
    }
    isOpen(workingCopy, editor) {
        if (!this.handles(workingCopy)) {
            return false;
        }
        return editor instanceof SearchEditorInput && isEqual(workingCopy.resource, editor.modelUri);
    }
    createEditor(workingCopy) {
        const input = this.instantiationService.invokeFunction(getOrMakeSearchEditorInput, { from: 'model', modelUri: workingCopy.resource });
        input.setDirty(true);
        return input;
    }
};
SearchEditorWorkingCopyEditorHandler = __decorate([
    __param(0, IInstantiationService),
    __param(1, IWorkingCopyEditorService)
], SearchEditorWorkingCopyEditorHandler);
registerWorkbenchContribution2(SearchEditorWorkingCopyEditorHandler.ID, SearchEditorWorkingCopyEditorHandler, 2 /* WorkbenchPhase.BlockRestore */);
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VhcmNoRWRpdG9yLmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2hFZGl0b3IvYnJvd3Nlci9zZWFyY2hFZGl0b3IuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDeEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBR3JELE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxxQkFBcUIsRUFBRSx5QkFBeUIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3ZKLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDbEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDcEYsT0FBTyxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzFHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUMxRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUVuRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDNUUsT0FBTyxFQUFFLG9CQUFvQixFQUF1QixNQUFNLDRCQUE0QixDQUFDO0FBQ3ZGLE9BQU8sRUFBMEMsOEJBQThCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMxSCxPQUFPLEVBQTZDLGdCQUFnQixFQUFFLDBCQUEwQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDcEksT0FB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