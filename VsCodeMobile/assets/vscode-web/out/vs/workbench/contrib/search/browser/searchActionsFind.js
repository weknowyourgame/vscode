/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { dirname } from '../../../../base/common/resources.js';
import * as nls from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IListService } from '../../../../platform/list/browser/listService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import * as Constants from '../common/constants.js';
import * as SearchEditorConstants from '../../searchEditor/browser/constants.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { resolveResourcesForSearchIncludes } from '../../../services/search/common/queryBuilder.js';
import { getMultiSelectedResources, IExplorerService } from '../../files/browser/files.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ExplorerFolderContext, ExplorerRootContext, FilesExplorerFocusCondition, VIEWLET_ID as VIEWLET_ID_FILES } from '../../files/common/files.js';
import { IPaneCompositePartService } from '../../../services/panecomposite/browser/panecomposite.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { category, getElementsToOperateOn, getSearchView, openSearchView } from './searchActionsBase.js';
import { IConfigurationResolverService } from '../../../services/configurationResolver/common/configurationResolver.js';
import { IHistoryService } from '../../../services/history/common/history.js';
import { Schemas } from '../../../../base/common/network.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { forcedExpandRecursively } from './searchActionsTopBar.js';
import { isSearchTreeFileMatch, isSearchTreeMatch } from './searchTreeModel/searchTreeCommon.js';
//#endregion
registerAction2(class RestrictSearchToFolderAction extends Action2 {
    constructor() {
        super({
            id: "search.action.restrictSearchToFolder" /* Constants.SearchCommandIds.RestrictSearchToFolderId */,
            title: nls.localize2('restrictResultsToFolder', "Restrict Search to Folder"),
            category,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                when: ContextKeyExpr.and(Constants.SearchContext.SearchViewVisibleKey, Constants.SearchContext.ResourceFolderFocusKey),
                primary: 1024 /* KeyMod.Shift */ | 512 /* KeyMod.Alt */ | 36 /* KeyCode.KeyF */,
            },
            menu: [
                {
                    id: MenuId.SearchContext,
                    group: 'search',
                    order: 3,
                    when: ContextKeyExpr.and(Constants.SearchContext.ResourceFolderFocusKey)
                }
            ]
        });
    }
    async run(accessor, folderMatch) {
        await searchWithFolderCommand(accessor, false, true, undefined, folderMatch);
    }
});
registerAction2(class ExpandSelectedTreeCommandAction extends Action2 {
    constructor() {
        super({
            id: "search.action.expandRecursively" /* Constants.SearchCommandIds.ExpandRecursivelyCommandId */,
            title: nls.localize('search.expandRecursively', "Expand Recursively"),
            category,
            menu: [{
                    id: MenuId.SearchContext,
                    when: ContextKeyExpr.and(Constants.SearchContext.FolderFocusKey, Constants.SearchContext.HasSearchResults),
                    group: 'search',
                    order: 4
                }]
        });
    }
    async run(accessor) {
        return expandSelectSubtree(accessor);
    }
});
registerAction2(class ExcludeFolderFromSearchAction extends Action2 {
    constructor() {
        super({
            id: "search.action.excludeFromSearch" /* Constants.SearchCommandIds.ExcludeFolderFromSearchId */,
            title: nls.localize2('excludeFolderFromSearch', "Exclude Folder from Search"),
            category,
            menu: [
                {
                    id: MenuId.SearchContext,
                    group: 'search',
                    order: 4,
                    when: Constants.SearchContext.ResourceFolderFocusKey
                }
            ]
        });
    }
    async run(accessor, folderMatch) {
        await searchWithFolderCommand(accessor, false, false, undefined, folderMatch);
    }
});
registerAction2(class ExcludeFileTypeFromSearchAction extends Action2 {
    constructor() {
        super({
            id: "search.action.excludeFileTypeFromSearch" /* Constants.SearchCommandIds.ExcludeFileTypeFromSearchId */,
            title: nls.localize2('excludeFileTypeFromSearch', "Exclude File Type from Search"),
            category,
            menu: [
                {
                    id: MenuId.SearchContext,
                    group: 'search',
                    order: 5,
                    when: Constants.SearchContext.FileFocusKey
                }
            ]
        });
    }
    async run(accessor, fileMatch) {
        await modifySearchFileTypePattern(accessor, fileMatch, true);
    }
});
registerAction2(class IncludeFileTypeInSearchAction extends Action2 {
    constructor() {
        super({
            id: "search.action.includeFileTypeInSearch" /* Constants.SearchCommandIds.IncludeFileTypeInSearchId */,
            title: nls.localize2('includeFileTypeInSearch', "Include File Type from Search"),
            category,
            menu: [
                {
                    id: MenuId.SearchContext,
                    group: 'search',
                    order: 6,
                    when: Constants.SearchContext.FileFocusKey
                }
            ]
        });
    }
    async run(accessor, fileMatch) {
        await modifySearchFileTypePattern(accessor, fileMatch, false);
    }
});
registerAction2(class RevealInSideBarForSearchResultsAction extends Action2 {
    constructor() {
        super({
            id: "search.action.revealInSideBar" /* Constants.SearchCommandIds.RevealInSideBarForSearchResults */,
            title: nls.localize2('revealInSideBar', "Reveal in Explorer View"),
            category,
            menu: [{
                    id: MenuId.SearchContext,
                    when: ContextKeyExpr.and(Constants.SearchContext.FileFocusKey, Constants.SearchContext.HasSearchResults),
                    group: 'search_3',
                    order: 1
                }]
        });
    }
    async run(accessor, args) {
        const paneCompositeService = accessor.get(IPaneCompositePartService);
        const explorerService = accessor.get(IExplorerService);
        const contextService = accessor.get(IWorkspaceContextService);
        const searchView = getSearchView(accessor.get(IViewsService));
        if (!searchView) {
            return;
        }
        let fileMatch;
        if (isSearchTreeFileMatch(args)) {
            fileMatch = args;
        }
        else {
            args = searchView.getControl().getFocus()[0];
            return;
        }
        paneCompositeService.openPaneComposite(VIEWLET_ID_FILES, 0 /* ViewContainerLocation.Sidebar */, false).then((viewlet) => {
            if (!viewlet) {
                return;
            }
            const explorerViewContainer = viewlet.getViewPaneContainer();
            const uri = fileMatch.resource;
            if (uri && contextService.isInsideWorkspace(uri)) {
                const explorerView = explorerViewContainer.getExplorerView();
                explorerView.setExpanded(true);
                explorerService.select(uri, true).then(() => explorerView.focus(), onUnexpectedError);
            }
        });
    }
});
// Find in Files by default is the same as View: Show Search, but can be configured to open a search editor instead with the `search.mode` binding
registerAction2(class FindInFilesAction extends Action2 {
    constructor() {
        super({
            id: "workbench.action.findInFiles" /* Constants.SearchCommandIds.FindInFilesActionId */,
            title: {
                ...nls.localize2('findInFiles', "Find in Files"),
                mnemonicTitle: nls.localize({ key: 'miFindInFiles', comment: ['&& denotes a mnemonic'] }, "Find &&in Files"),
            },
            metadata: {
                description: nls.localize('findInFiles.description', "Open a workspace search"),
                args: [
                    {
                        name: nls.localize('findInFiles.args', "A set of options for the search"),
                        schema: {
                            type: 'object',
                            properties: {
                                query: { 'type': 'string' },
                                replace: { 'type': 'string' },
                                preserveCase: { 'type': 'boolean' },
                                triggerSearch: { 'type': 'boolean' },
                                filesToInclude: { 'type': 'string' },
                                filesToExclude: { 'type': 'string' },
                                isRegex: { 'type': 'boolean' },
                                isCaseSensitive: { 'type': 'boolean' },
                                matchWholeWord: { 'type': 'boolean' },
                                useExcludeSettingsAndIgnoreFiles: { 'type': 'boolean' },
                                onlyOpenEditors: { 'type': 'boolean' },
                                showIncludesExcludes: { 'type': 'boolean' }
                            }
                        }
                    },
                ]
            },
            category,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 36 /* KeyCode.KeyF */,
            },
            menu: [{
                    id: MenuId.MenubarEditMenu,
                    group: '4_find_global',
                    order: 1,
                }],
            f1: true
        });
    }
    async run(accessor, args = {}) {
        findInFilesCommand(accessor, args);
    }
});
registerAction2(class FindInFolderAction extends Action2 {
    // from explorer
    constructor() {
        super({
            id: "filesExplorer.findInFolder" /* Constants.SearchCommandIds.FindInFolderId */,
            title: nls.localize2('findInFolder', "Find in Folder..."),
            category,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                when: ContextKeyExpr.and(FilesExplorerFocusCondition, ExplorerFolderContext),
                primary: 1024 /* KeyMod.Shift */ | 512 /* KeyMod.Alt */ | 36 /* KeyCode.KeyF */,
            },
            menu: [
                {
                    id: MenuId.ExplorerContext,
                    group: '4_search',
                    order: 10,
                    when: ExplorerFolderContext
                }
            ]
        });
    }
    async run(accessor, resource) {
        await searchWithFolderCommand(accessor, true, true, resource);
    }
});
registerAction2(class FindInWorkspaceAction extends Action2 {
    // from explorer
    constructor() {
        super({
            id: "filesExplorer.findInWorkspace" /* Constants.SearchCommandIds.FindInWorkspaceId */,
            title: nls.localize2('findInWorkspace', "Find in Workspace..."),
            category,
            menu: [
                {
                    id: MenuId.ExplorerContext,
                    group: '4_search',
                    order: 10,
                    when: ContextKeyExpr.and(ExplorerRootContext, ExplorerFolderContext.toNegated())
                }
            ]
        });
    }
    async run(accessor) {
        const searchConfig = accessor.get(IConfigurationService).getValue().search;
        const mode = searchConfig.mode;
        if (mode === 'view') {
            const searchView = await openSearchView(accessor.get(IViewsService), true);
            searchView?.searchInFolders();
        }
        else {
            await accessor.get(ICommandService).executeCommand(SearchEditorConstants.OpenEditorCommandId, {
                location: mode === 'newEditor' ? 'new' : 'reuse',
                filesToInclude: '',
            });
        }
    }
});
//#region Helpers
async function expandSelectSubtree(accessor) {
    const viewsService = accessor.get(IViewsService);
    const searchView = getSearchView(viewsService);
    if (searchView) {
        const viewer = searchView.getControl();
        const selected = viewer.getFocus()[0];
        await forcedExpandRecursively(viewer, selected);
    }
}
function extractSearchFilePattern(fileName) {
    const parts = fileName.split('.');
    if (parts.length <= 1) {
        return fileName;
    }
    const extensionParts = parts.slice(1);
    return `*.${extensionParts.join('.')}`;
}
function mergeSearchPatternIfNotExists(currentPatterns, newPattern) {
    if (!currentPatterns.trim()) {
        return newPattern;
    }
    const existingPatterns = currentPatterns.split(',').map(pattern => pattern.trim()).filter(pattern => pattern.length > 0);
    if (existingPatterns.includes(newPattern)) {
        return currentPatterns;
    }
    return `${currentPatterns}, ${newPattern}`;
}
async function searchWithFolderCommand(accessor, isFromExplorer, isIncludes, resource, folderMatch) {
    const fileService = accessor.get(IFileService);
    const viewsService = accessor.get(IViewsService);
    const contextService = accessor.get(IWorkspaceContextService);
    const commandService = accessor.get(ICommandService);
    const searchConfig = accessor.get(IConfigurationService).getValue().search;
    const mode = searchConfig.mode;
    let resources;
    if (isFromExplorer) {
        resources = getMultiSelectedResources(resource, accessor.get(IListService), accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IExplorerService));
    }
    else {
        const searchView = getSearchView(viewsService);
        if (!searchView) {
            return;
        }
        resources = getMultiSelectedSearchResources(searchView.getControl(), folderMatch, searchConfig);
    }
    const resolvedResources = fileService.resolveAll(resources.map(resource => ({ resource }))).then(results => {
        const folders = [];
        results.forEach(result => {
            if (result.success && result.stat) {
                folders.push(result.stat.isDirectory ? result.stat.resource : dirname(result.stat.resource));
            }
        });
        return resolveResourcesForSearchIncludes(folders, contextService);
    });
    if (mode === 'view') {
        const searchView = await openSearchView(viewsService, true);
        if (resources && resources.length && searchView) {
            if (isIncludes) {
                searchView.searchInFolders(await resolvedResources);
            }
            else {
                searchView.searchOutsideOfFolders(await resolvedResources);
            }
        }
        return undefined;
    }
    else {
        if (isIncludes) {
            return commandService.executeCommand(SearchEditorConstants.OpenEditorCommandId, {
                filesToInclude: (await resolvedResources).join(', '),
                showIncludesExcludes: true,
                location: mode === 'newEditor' ? 'new' : 'reuse',
            });
        }
        else {
            return commandService.executeCommand(SearchEditorConstants.OpenEditorCommandId, {
                filesToExclude: (await resolvedResources).join(', '),
                showIncludesExcludes: true,
                location: mode === 'newEditor' ? 'new' : 'reuse',
            });
        }
    }
}
function getMultiSelectedSearchResources(viewer, currElement, sortConfig) {
    return getElementsToOperateOn(viewer, currElement, sortConfig)
        .map((renderableMatch) => ((isSearchTreeMatch(renderableMatch)) ? null : renderableMatch.resource))
        .filter((renderableMatch) => (renderableMatch !== null));
}
export async function findInFilesCommand(accessor, _args = {}) {
    const searchConfig = accessor.get(IConfigurationService).getValue().search;
    const viewsService = accessor.get(IViewsService);
    const commandService = accessor.get(ICommandService);
    const args = {};
    if (Object.keys(_args).length !== 0) {
        // resolve variables in the same way as in
        // https://github.com/microsoft/vscode/blob/8b76efe9d317d50cb5b57a7658e09ce6ebffaf36/src/vs/workbench/contrib/searchEditor/browser/searchEditorActions.ts#L152-L158
        const configurationResolverService = accessor.get(IConfigurationResolverService);
        const historyService = accessor.get(IHistoryService);
        const workspaceContextService = accessor.get(IWorkspaceContextService);
        const activeWorkspaceRootUri = historyService.getLastActiveWorkspaceRoot();
        const filteredActiveWorkspaceRootUri = activeWorkspaceRootUri?.scheme === Schemas.file || activeWorkspaceRootUri?.scheme === Schemas.vscodeRemote ? activeWorkspaceRootUri : undefined;
        const lastActiveWorkspaceRoot = filteredActiveWorkspaceRootUri ? workspaceContextService.getWorkspaceFolder(filteredActiveWorkspaceRootUri) ?? undefined : undefined;
        for (const entry of Object.entries(_args)) {
            const name = entry[0];
            const value = entry[1];
            if (value !== undefined) {
                // eslint-disable-next-line local/code-no-any-casts
                args[name] = (typeof value === 'string') ? await configurationResolverService.resolveAsync(lastActiveWorkspaceRoot, value) : value;
            }
        }
    }
    const mode = searchConfig.mode;
    if (mode === 'view') {
        openSearchView(viewsService, false).then(openedView => {
            if (openedView) {
                const searchAndReplaceWidget = openedView.searchAndReplaceWidget;
                searchAndReplaceWidget.toggleReplace(typeof args.replace === 'string');
                let updatedText = false;
                if (typeof args.query !== 'string') {
                    updatedText = openedView.updateTextFromFindWidgetOrSelection({ allowUnselectedWord: typeof args.replace !== 'string' });
                }
                openedView.setSearchParameters(args);
                if (typeof args.showIncludesExcludes === 'boolean') {
                    openedView.toggleQueryDetails(false, args.showIncludesExcludes);
                }
                openedView.searchAndReplaceWidget.focus(undefined, updatedText, updatedText);
            }
        });
    }
    else {
        const convertArgs = (args) => ({
            location: mode === 'newEditor' ? 'new' : 'reuse',
            query: args.query,
            filesToInclude: args.filesToInclude,
            filesToExclude: args.filesToExclude,
            matchWholeWord: args.matchWholeWord,
            isCaseSensitive: args.isCaseSensitive,
            isRegexp: args.isRegex,
            useExcludeSettingsAndIgnoreFiles: args.useExcludeSettingsAndIgnoreFiles,
            onlyOpenEditors: args.onlyOpenEditors,
            showIncludesExcludes: !!(args.filesToExclude || args.filesToExclude || !args.useExcludeSettingsAndIgnoreFiles),
        });
        commandService.executeCommand(SearchEditorConstants.OpenEditorCommandId, convertArgs(args));
    }
}
async function modifySearchFileTypePattern(accessor, fileMatch, isExclude) {
    const viewsService = accessor.get(IViewsService);
    const searchView = getSearchView(viewsService);
    if (!searchView || !fileMatch) {
        return;
    }
    const resource = fileMatch.resource;
    const fileName = resource.path.split('/').pop() || '';
    const newPattern = extractSearchFilePattern(fileName);
    const patternWidget = isExclude ? searchView.searchExcludePattern : searchView.searchIncludePattern;
    const currentPatterns = patternWidget.getValue();
    const updatedPatterns = mergeSearchPatternIfNotExists(currentPatterns, newPattern);
    if (updatedPatterns !== currentPatterns) {
        patternWidget.setValue(updatedPatterns);
        searchView.toggleQueryDetails(false, true);
        searchView.triggerQueryChange({ preserveFocus: false });
    }
}
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VhcmNoQWN0aW9uc0ZpbmQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvc2VhcmNoL2Jyb3dzZXIvc2VhcmNoQWN0aW9uc0ZpbmQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFDaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQy9ELE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRW5HLE9BQU8sRUFBRSxZQUFZLEVBQXNDLE1BQU0sa0RBQWtELENBQUM7QUFFcEgsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQy9FLE9BQU8sS0FBSyxTQUFTLE1BQU0sd0JBQXdCLENBQUM7QUFDcEQsT0FBTyxLQUFLLHFCQUFxQixNQUFNLHlDQUF5QyxDQUFDO0FBSWpGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN0RixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUdsRyxPQUFPLEVBQUUsaUNBQWlDLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUNwRyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMzRixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDMUUsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDOUYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLG1CQUFtQixFQUFFLDJCQUEyQixFQUFFLFVBQVUsSUFBSSxnQkFBZ0IsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3RKLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBRXJHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxRQUFRLEVBQUUsc0JBQXNCLEVBQUUsYUFBYSxFQUFFLGNBQWMsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pHLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHlFQUF5RSxDQUFDO0FBQ3hILE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDOUYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ2xGLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ25FLE9BQU8sRUFBNEYscUJBQXFCLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQWlCM0wsWUFBWTtBQUVaLGVBQWUsQ0FBQyxNQUFNLDRCQUE2QixTQUFRLE9BQU87SUFDakU7UUFDQyxLQUFLLENBQUM7WUFDTCxFQUFFLGtHQUFxRDtZQUN2RCxLQUFLLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyx5QkFBeUIsRUFBRSwyQkFBMkIsQ0FBQztZQUM1RSxRQUFRO1lBQ1IsVUFBVSxFQUFFO2dCQUNYLE1BQU0sNkNBQW1DO2dCQUN6QyxJQUFJLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLG9CQUFvQixFQUFFLFNBQVMsQ0FBQyxhQUFhLENBQUMsc0JBQXNCLENBQUM7Z0JBQ3RILE9BQU8sRUFBRSw4Q0FBeUIsd0JBQWU7YUFDakQ7WUFDRCxJQUFJLEVBQUU7Z0JBQ0w7b0JBQ0MsRUFBRSxFQUFFLE1BQU0sQ0FBQyxhQUFhO29CQUN4QixLQUFLLEVBQUUsUUFBUTtvQkFDZixLQUFLLEVBQUUsQ0FBQztvQkFDUixJQUFJLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLHNCQUFzQixDQUFDO2lCQUN4RTthQUNEO1NBQ0QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUNELEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBMEIsRUFBRSxXQUFnRDtRQUNyRixNQUFNLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUM5RSxDQUFDO0NBQ0QsQ0FBQyxDQUFDO0FBR0gsZUFBZSxDQUFDLE1BQU0sK0JBQWdDLFNBQVEsT0FBTztJQUNwRTtRQUVDLEtBQUssQ0FBQztZQUNMLEVBQUUsK0ZBQXVEO1lBQ3pELEtBQUssRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLDBCQUEwQixFQUFFLG9CQUFvQixDQUFDO1lBQ3JFLFFBQVE7WUFDUixJQUFJLEVBQUUsQ0FBQztvQkFDTixFQUFFLEVBQUUsTUFBTSxDQUFDLGFBQWE7b0JBQ3hCLElBQUksRUFBRSxjQUFjLENBQUMsR0FBRyxDQUN2QixTQUFTLENBQUMsYUFBYSxDQUFDLGNBQWMsRUFDdEMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FDeEM7b0JBQ0QsS0FBSyxFQUFFLFFBQVE7b0JBQ2YsS0FBSyxFQUFFLENBQUM7aUJBQ1IsQ0FBQztTQUNGLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFUSxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQWE7UUFDL0IsT0FBTyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN0QyxDQUFDO0NBQ0QsQ0FBQyxDQUFDO0FBRUgsZUFBZSxDQUFDLE1BQU0sNkJBQThCLFNBQVEsT0FBTztJQUNsRTtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsOEZBQXNEO1lBQ3hELEtBQUssRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLHlCQUF5QixFQUFFLDRCQUE0QixDQUFDO1lBQzdFLFFBQVE7WUFDUixJQUFJLEVBQUU7Z0JBQ0w7b0JBQ0MsRUFBRSxFQUFFLE1BQU0sQ0FBQyxhQUFhO29CQUN4QixLQUFLLEVBQUUsUUFBUTtvQkFDZixLQUFLLEVBQUUsQ0FBQztvQkFDUixJQUFJLEVBQUUsU0FBUyxDQUFDLGFBQWEsQ0FBQyxzQkFBc0I7aUJBQ3BEO2FBQ0Q7U0FDRCxDQUFDLENBQUM7SUFDSixDQUFDO0lBQ0QsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUEwQixFQUFFLFdBQWdEO1FBQ3JGLE1BQU0sdUJBQXVCLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQy9FLENBQUM7Q0FDRCxDQUFDLENBQUM7QUFFSCxlQUFlLENBQUMsTUFBTSwrQkFBZ0MsU0FBUSxPQUFPO0lBQ3BFO1FBQ0MsS0FBSyxDQUFDO1lBQ0wsRUFBRSx3R0FBd0Q7WUFDMUQsS0FBSyxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsMkJBQTJCLEVBQUUsK0JBQStCLENBQUM7WUFDbEYsUUFBUTtZQUNSLElBQUksRUFBRTtnQkFDTDtvQkFDQyxFQUFFLEVBQUUsTUFBTSxDQUFDLGFBQWE7b0JBQ3hCLEtBQUssRUFBRSxRQUFRO29CQUNmLEtBQUssRUFBRSxDQUFDO29CQUNSLElBQUksRUFBRSxTQUFTLENBQUMsYUFBYSxDQUFDLFlBQVk7aUJBQzFDO2FBQ0Q7U0FDRCxDQUFDLENBQUM7SUFDSixDQUFDO0lBQ0QsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUEwQixFQUFFLFNBQWdDO1FBQ3JFLE1BQU0sMkJBQTJCLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM5RCxDQUFDO0NBQ0QsQ0FBQyxDQUFDO0FBRUgsZUFBZSxDQUFDLE1BQU0sNkJBQThCLFNBQVEsT0FBTztJQUNsRTtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsb0dBQXNEO1lBQ3hELEtBQUssRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLHlCQUF5QixFQUFFLCtCQUErQixDQUFDO1lBQ2hGLFFBQVE7WUFDUixJQUFJLEVBQUU7Z0JBQ0w7b0JBQ0MsRUFBRSxFQUFFLE1BQU0sQ0FBQyxhQUFhO29CQUN4QixLQUFLLEVBQUUsUUFBUTtvQkFDZixLQUFLLEVBQUUsQ0FBQztvQkFDUixJQUFJLEVBQUUsU0FBUyxDQUFDLGFBQWEsQ0FBQyxZQUFZO2lCQUMxQzthQUNEO1NBQ0QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUNELEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBMEIsRUFBRSxTQUFnQztRQUNyRSxNQUFNLDJCQUEyQixDQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDL0QsQ0FBQztDQUNELENBQUMsQ0FBQztBQUVILGVBQWUsQ0FBQyxNQUFNLHFDQUFzQyxTQUFRLE9BQU87SUFFMUU7UUFFQyxLQUFLLENBQUM7WUFDTCxFQUFFLGtHQUE0RDtZQUM5RCxLQUFLLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxpQkFBaUIsRUFBRSx5QkFBeUIsQ0FBQztZQUNsRSxRQUFRO1lBQ1IsSUFBSSxFQUFFLENBQUM7b0JBQ04sRUFBRSxFQUFFLE1BQU0sQ0FBQyxhQUFhO29CQUN4QixJQUFJLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxTQUFTLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDO29CQUN4RyxLQUFLLEVBQUUsVUFBVTtvQkFDakIsS0FBSyxFQUFFLENBQUM7aUJBQ1IsQ0FBQztTQUNGLENBQUMsQ0FBQztJQUVKLENBQUM7SUFFUSxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQTBCLEVBQUUsSUFBUztRQUN2RCxNQUFNLG9CQUFvQixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMseUJBQXlCLENBQUMsQ0FBQztRQUNyRSxNQUFNLGVBQWUsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDdkQsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBRTlELE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7UUFDOUQsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2pCLE9BQU87UUFDUixDQUFDO1FBRUQsSUFBSSxTQUErQixDQUFDO1FBQ3BDLElBQUkscUJBQXFCLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUNqQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1FBQ2xCLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxHQUFHLFVBQVUsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM3QyxPQUFPO1FBQ1IsQ0FBQztRQUVELG9CQUFvQixDQUFDLGlCQUFpQixDQUFDLGdCQUFnQix5Q0FBaUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDL0csSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNkLE9BQU87WUFDUixDQUFDO1lBRUQsTUFBTSxxQkFBcUIsR0FBRyxPQUFPLENBQUMsb0JBQW9CLEVBQStCLENBQUM7WUFDMUYsTUFBTSxHQUFHLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQztZQUMvQixJQUFJLEdBQUcsSUFBSSxjQUFjLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDbEQsTUFBTSxZQUFZLEdBQUcscUJBQXFCLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQzdELFlBQVksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQy9CLGVBQWUsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztZQUN2RixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0NBQ0QsQ0FBQyxDQUFDO0FBRUgsa0pBQWtKO0FBQ2xKLGVBQWUsQ0FBQyxNQUFNLGlCQUFrQixTQUFRLE9BQU87SUFFdEQ7UUFFQyxLQUFLLENBQUM7WUFDTCxFQUFFLHFGQUFnRDtZQUNsRCxLQUFLLEVBQUU7Z0JBQ04sR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDLGFBQWEsRUFBRSxlQUFlLENBQUM7Z0JBQ2hELGFBQWEsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsR0FBRyxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLEVBQUUsaUJBQWlCLENBQUM7YUFDNUc7WUFDRCxRQUFRLEVBQUU7Z0JBQ1QsV0FBVyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMseUJBQXlCLEVBQUUseUJBQXlCLENBQUM7Z0JBQy9FLElBQUksRUFBRTtvQkFDTDt3QkFDQyxJQUFJLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSxpQ0FBaUMsQ0FBQzt3QkFDekUsTUFBTSxFQUFFOzRCQUNQLElBQUksRUFBRSxRQUFROzRCQUNkLFVBQVUsRUFBRTtnQ0FDWCxLQUFLLEVBQUUsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO2dDQUMzQixPQUFPLEVBQUUsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO2dDQUM3QixZQUFZLEVBQUUsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFO2dDQUNuQyxhQUFhLEVBQUUsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFO2dDQUNwQyxjQUFjLEVBQUUsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO2dDQUNwQyxjQUFjLEVBQUUsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO2dDQUNwQyxPQUFPLEVBQUUsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFO2dDQUM5QixlQUFlLEVBQUUsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFO2dDQUN0QyxjQUFjLEVBQUUsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFO2dDQUNyQyxnQ0FBZ0MsRUFBRSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUU7Z0NBQ3ZELGVBQWUsRUFBRSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUU7Z0NBQ3RDLG9CQUFvQixFQUFFLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRTs2QkFDM0M7eUJBQ0Q7cUJBQ0Q7aUJBQ0Q7YUFDRDtZQUNELFFBQVE7WUFDUixVQUFVLEVBQUU7Z0JBQ1gsTUFBTSw2Q0FBbUM7Z0JBQ3pDLE9BQU8sRUFBRSxtREFBNkIsd0JBQWU7YUFDckQ7WUFDRCxJQUFJLEVBQUUsQ0FBQztvQkFDTixFQUFFLEVBQUUsTUFBTSxDQUFDLGVBQWU7b0JBQzFCLEtBQUssRUFBRSxlQUFlO29CQUN0QixLQUFLLEVBQUUsQ0FBQztpQkFDUixDQUFDO1lBQ0YsRUFBRSxFQUFFLElBQUk7U0FDUixDQUFDLENBQUM7SUFFSixDQUFDO0lBRVEsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUEwQixFQUFFLE9BQXlCLEVBQUU7UUFDekUsa0JBQWtCLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3BDLENBQUM7Q0FDRCxDQUFDLENBQUM7QUFFSCxlQUFlLENBQUMsTUFBTSxrQkFBbUIsU0FBUSxPQUFPO0lBQ3ZELGdCQUFnQjtJQUNoQjtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsOEVBQTJDO1lBQzdDLEtBQUssRUFBRSxHQUFHLENBQUMsU0FBUyxDQUFDLGNBQWMsRUFBRSxtQkFBbUIsQ0FBQztZQUN6RCxRQUFRO1lBQ1IsVUFBVSxFQUFFO2dCQUNYLE1BQU0sNkNBQW1DO2dCQUN6QyxJQUFJLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsRUFBRSxxQkFBcUIsQ0FBQztnQkFDNUUsT0FBTyxFQUFFLDhDQUF5Qix3QkFBZTthQUNqRDtZQUNELElBQUksRUFBRTtnQkFDTDtvQkFDQyxFQUFFLEVBQUUsTUFBTSxDQUFDLGVBQWU7b0JBQzFCLEtBQUssRUFBRSxVQUFVO29CQUNqQixLQUFLLEVBQUUsRUFBRTtvQkFDVCxJQUFJLEVBQUUscUJBQXFCO2lCQUMzQjthQUNEO1NBQ0QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUNELEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBMEIsRUFBRSxRQUFjO1FBQ25ELE1BQU0sdUJBQXVCLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDL0QsQ0FBQztDQUNELENBQUMsQ0FBQztBQUVILGVBQWUsQ0FBQyxNQUFNLHFCQUFzQixTQUFRLE9BQU87SUFDMUQsZ0JBQWdCO0lBQ2hCO1FBQ0MsS0FBSyxDQUFDO1lBQ0wsRUFBRSxvRkFBOEM7WUFDaEQsS0FBSyxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsaUJBQWlCLEVBQUUsc0JBQXNCLENBQUM7WUFDL0QsUUFBUTtZQUNSLElBQUksRUFBRTtnQkFDTDtvQkFDQyxFQUFFLEVBQUUsTUFBTSxDQUFDLGVBQWU7b0JBQzFCLEtBQUssRUFBRSxVQUFVO29CQUNqQixLQUFLLEVBQUUsRUFBRTtvQkFDVCxJQUFJLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsRUFBRSxxQkFBcUIsQ0FBQyxTQUFTLEVBQUUsQ0FBQztpQkFFaEY7YUFDRDtTQUNELENBQUMsQ0FBQztJQUNKLENBQUM7SUFDRCxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQTBCO1FBQ25DLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsQ0FBQyxRQUFRLEVBQXdCLENBQUMsTUFBTSxDQUFDO1FBQ2pHLE1BQU0sSUFBSSxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUM7UUFFL0IsSUFBSSxJQUFJLEtBQUssTUFBTSxFQUFFLENBQUM7WUFDckIsTUFBTSxVQUFVLEdBQUcsTUFBTSxjQUFjLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUMzRSxVQUFVLEVBQUUsZUFBZSxFQUFFLENBQUM7UUFDL0IsQ0FBQzthQUNJLENBQUM7WUFDTCxNQUFNLFFBQVEsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUMsY0FBYyxDQUFDLHFCQUFxQixDQUFDLG1CQUFtQixFQUFFO2dCQUM3RixRQUFRLEVBQUUsSUFBSSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPO2dCQUNoRCxjQUFjLEVBQUUsRUFBRTthQUNsQixDQUFDLENBQUM7UUFDSixDQUFDO0lBQ0YsQ0FBQztDQUNELENBQUMsQ0FBQztBQUVILGlCQUFpQjtBQUNqQixLQUFLLFVBQVUsbUJBQW1CLENBQUMsUUFBMEI7SUFDNUQsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNqRCxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDL0MsSUFBSSxVQUFVLEVBQUUsQ0FBQztRQUNoQixNQUFNLE1BQU0sR0FBRyxVQUFVLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDdkMsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3RDLE1BQU0sdUJBQXVCLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2pELENBQUM7QUFDRixDQUFDO0FBRUQsU0FBUyx3QkFBd0IsQ0FBQyxRQUFnQjtJQUNqRCxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRWxDLElBQUksS0FBSyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUN2QixPQUFPLFFBQVEsQ0FBQztJQUNqQixDQUFDO0lBRUQsTUFBTSxjQUFjLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN0QyxPQUFPLEtBQUssY0FBYyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO0FBQ3hDLENBQUM7QUFFRCxTQUFTLDZCQUE2QixDQUFDLGVBQXVCLEVBQUUsVUFBa0I7SUFDakYsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO1FBQzdCLE9BQU8sVUFBVSxDQUFDO0lBQ25CLENBQUM7SUFFRCxNQUFNLGdCQUFnQixHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztJQUV6SCxJQUFJLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO1FBQzNDLE9BQU8sZUFBZSxDQUFDO0lBQ3hCLENBQUM7SUFFRCxPQUFPLEdBQUcsZUFBZSxLQUFLLFVBQVUsRUFBRSxDQUFDO0FBQzVDLENBQUM7QUFFRCxLQUFLLFVBQVUsdUJBQXVCLENBQUMsUUFBMEIsRUFBRSxjQUF1QixFQUFFLFVBQW1CLEVBQUUsUUFBYyxFQUFFLFdBQWdEO0lBQ2hMLE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDL0MsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNqRCxNQUFNLGNBQWMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLHdCQUF3QixDQUFDLENBQUM7SUFDOUQsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUNyRCxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUMsUUFBUSxFQUF3QixDQUFDLE1BQU0sQ0FBQztJQUNqRyxNQUFNLElBQUksR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDO0lBRS9CLElBQUksU0FBZ0IsQ0FBQztJQUVyQixJQUFJLGNBQWMsRUFBRSxDQUFDO1FBQ3BCLFNBQVMsR0FBRyx5QkFBeUIsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQztJQUMvSyxDQUFDO1NBQU0sQ0FBQztRQUNQLE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUMvQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDakIsT0FBTztRQUNSLENBQUM7UUFDRCxTQUFTLEdBQUcsK0JBQStCLENBQUMsVUFBVSxDQUFDLFVBQVUsRUFBRSxFQUFFLFdBQVcsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUNqRyxDQUFDO0lBRUQsTUFBTSxpQkFBaUIsR0FBRyxXQUFXLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQzFHLE1BQU0sT0FBTyxHQUFVLEVBQUUsQ0FBQztRQUMxQixPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3hCLElBQUksTUFBTSxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ25DLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBQzlGLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztRQUNILE9BQU8saUNBQWlDLENBQUMsT0FBTyxFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBQ25FLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxJQUFJLEtBQUssTUFBTSxFQUFFLENBQUM7UUFDckIsTUFBTSxVQUFVLEdBQUcsTUFBTSxjQUFjLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzVELElBQUksU0FBUyxJQUFJLFNBQVMsQ0FBQyxNQUFNLElBQUksVUFBVSxFQUFFLENBQUM7WUFDakQsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDaEIsVUFBVSxDQUFDLGVBQWUsQ0FBQyxNQUFNLGlCQUFpQixDQUFDLENBQUM7WUFDckQsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLFVBQVUsQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLGlCQUFpQixDQUFDLENBQUM7WUFDNUQsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO1NBQU0sQ0FBQztRQUNQLElBQUksVUFBVSxFQUFFLENBQUM7WUFDaEIsT0FBTyxjQUFjLENBQUMsY0FBYyxDQUFDLHFCQUFxQixDQUFDLG1CQUFtQixFQUFFO2dCQUMvRSxjQUFjLEVBQUUsQ0FBQyxNQUFNLGlCQUFpQixDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztnQkFDcEQsb0JBQW9CLEVBQUUsSUFBSTtnQkFDMUIsUUFBUSxFQUFFLElBQUksS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsT0FBTzthQUNoRCxDQUFDLENBQUM7UUFDSixDQUFDO2FBQ0ksQ0FBQztZQUNMLE9BQU8sY0FBYyxDQUFDLGNBQWMsQ0FBQyxxQkFBcUIsQ0FBQyxtQkFBbUIsRUFBRTtnQkFDL0UsY0FBYyxFQUFFLENBQUMsTUFBTSxpQkFBaUIsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Z0JBQ3BELG9CQUFvQixFQUFFLElBQUk7Z0JBQzFCLFFBQVEsRUFBRSxJQUFJLEtBQUssV0FBVyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU87YUFDaEQsQ0FBQyxDQUFDO1FBQ0osQ0FBQztJQUNGLENBQUM7QUFDRixDQUFDO0FBRUQsU0FBUywrQkFBK0IsQ0FBQyxNQUFnRixFQUFFLFdBQXdDLEVBQUUsVUFBMEM7SUFDOU0sT0FBTyxzQkFBc0IsQ0FBQyxNQUFNLEVBQUUsV0FBVyxFQUFFLFVBQVUsQ0FBQztTQUM1RCxHQUFHLENBQUMsQ0FBQyxlQUFlLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUNsRyxNQUFNLENBQUMsQ0FBQyxlQUFlLEVBQTBCLEVBQUUsQ0FBQyxDQUFDLGVBQWUsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ25GLENBQUM7QUFFRCxNQUFNLENBQUMsS0FBSyxVQUFVLGtCQUFrQixDQUFDLFFBQTBCLEVBQUUsUUFBMEIsRUFBRTtJQUVoRyxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUMsUUFBUSxFQUF3QixDQUFDLE1BQU0sQ0FBQztJQUNqRyxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ2pELE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDckQsTUFBTSxJQUFJLEdBQXFCLEVBQUUsQ0FBQztJQUNsQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ3JDLDBDQUEwQztRQUMxQyxtS0FBbUs7UUFDbkssTUFBTSw0QkFBNEIsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLDZCQUE2QixDQUFDLENBQUM7UUFDakYsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUNyRCxNQUFNLHVCQUF1QixHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsd0JBQXdCLENBQUMsQ0FBQztRQUN2RSxNQUFNLHNCQUFzQixHQUFHLGNBQWMsQ0FBQywwQkFBMEIsRUFBRSxDQUFDO1FBQzNFLE1BQU0sOEJBQThCLEdBQUcsc0JBQXNCLEVBQUUsTUFBTSxLQUFLLE9BQU8sQ0FBQyxJQUFJLElBQUksc0JBQXNCLEVBQUUsTUFBTSxLQUFLLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDdkwsTUFBTSx1QkFBdUIsR0FBRyw4QkFBOEIsQ0FBQyxDQUFDLENBQUMsdUJBQXVCLENBQUMsa0JBQWtCLENBQUMsOEJBQThCLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUVySyxLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUMzQyxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdEIsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUN6QixtREFBbUQ7Z0JBQ2xELElBQVksQ0FBQyxJQUFXLENBQUMsR0FBRyxDQUFDLE9BQU8sS0FBSyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLDRCQUE0QixDQUFDLFlBQVksQ0FBQyx1QkFBdUIsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1lBQ3BKLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUVELE1BQU0sSUFBSSxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUM7SUFDL0IsSUFBSSxJQUFJLEtBQUssTUFBTSxFQUFFLENBQUM7UUFDckIsY0FBYyxDQUFDLFlBQVksRUFBRSxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDckQsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDaEIsTUFBTSxzQkFBc0IsR0FBRyxVQUFVLENBQUMsc0JBQXNCLENBQUM7Z0JBQ2pFLHNCQUFzQixDQUFDLGFBQWEsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUM7Z0JBQ3ZFLElBQUksV0FBVyxHQUFHLEtBQUssQ0FBQztnQkFDeEIsSUFBSSxPQUFPLElBQUksQ0FBQyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7b0JBQ3BDLFdBQVcsR0FBRyxVQUFVLENBQUMsbUNBQW1DLENBQUMsRUFBRSxtQkFBbUIsRUFBRSxPQUFPLElBQUksQ0FBQyxPQUFPLEtBQUssUUFBUSxFQUFFLENBQUMsQ0FBQztnQkFDekgsQ0FBQztnQkFDRCxVQUFVLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3JDLElBQUksT0FBTyxJQUFJLENBQUMsb0JBQW9CLEtBQUssU0FBUyxFQUFFLENBQUM7b0JBQ3BELFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7Z0JBQ2pFLENBQUM7Z0JBRUQsVUFBVSxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1lBQzlFLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7U0FBTSxDQUFDO1FBQ1AsTUFBTSxXQUFXLEdBQUcsQ0FBQyxJQUFzQixFQUF3QixFQUFFLENBQUMsQ0FBQztZQUN0RSxRQUFRLEVBQUUsSUFBSSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPO1lBQ2hELEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSztZQUNqQixjQUFjLEVBQUUsSUFBSSxDQUFDLGNBQWM7WUFDbkMsY0FBYyxFQUFFLElBQUksQ0FBQyxjQUFjO1lBQ25DLGNBQWMsRUFBRSxJQUFJLENBQUMsY0FBYztZQUNuQyxlQUFlLEVBQUUsSUFBSSxDQUFDLGVBQWU7WUFDckMsUUFBUSxFQUFFLElBQUksQ0FBQyxPQUFPO1lBQ3RCLGdDQUFnQyxFQUFFLElBQUksQ0FBQyxnQ0FBZ0M7WUFDdkUsZUFBZSxFQUFFLElBQUksQ0FBQyxlQUFlO1lBQ3JDLG9CQUFvQixFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLElBQUksSUFBSSxDQUFDLGNBQWMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQztTQUM5RyxDQUFDLENBQUM7UUFDSCxjQUFjLENBQUMsY0FBYyxDQUFDLHFCQUFxQixDQUFDLG1CQUFtQixFQUFFLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzdGLENBQUM7QUFDRixDQUFDO0FBRUQsS0FBSyxVQUFVLDJCQUEyQixDQUFDLFFBQTBCLEVBQUUsU0FBMkMsRUFBRSxTQUFrQjtJQUNySSxNQUFNLFlBQVksR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ2pELE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUUvQyxJQUFJLENBQUMsVUFBVSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDL0IsT0FBTztJQUNSLENBQUM7SUFFRCxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDO0lBQ3BDLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsQ0FBQztJQUV0RCxNQUFNLFVBQVUsR0FBRyx3QkFBd0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN0RCxNQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLG9CQUFvQixDQUFDO0lBQ3BHLE1BQU0sZUFBZSxHQUFHLGFBQWEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNqRCxNQUFNLGVBQWUsR0FBRyw2QkFBNkIsQ0FBQyxlQUFlLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFFbkYsSUFBSSxlQUFlLEtBQUssZUFBZSxFQUFFLENBQUM7UUFDekMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUN4QyxVQUFVLENBQUMsa0JBQWtCLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzNDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ3pELENBQUM7QUFDRixDQUFDO0FBR0QsWUFBWSJ9