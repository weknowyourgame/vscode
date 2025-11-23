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
import { diffSets } from '../../../base/common/collections.js';
import { Emitter } from '../../../base/common/event.js';
import { assertReturnsDefined } from '../../../base/common/types.js';
import { URI } from '../../../base/common/uri.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { MainContext } from './extHost.protocol.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import * as typeConverters from './extHostTypeConverters.js';
import { ChatEditorTabInput, CustomEditorTabInput, InteractiveWindowInput, NotebookDiffEditorTabInput, NotebookEditorTabInput, TerminalEditorTabInput, TextDiffTabInput, TextMergeTabInput, TextTabInput, WebviewEditorTabInput, TextMultiDiffTabInput } from './extHostTypes.js';
export const IExtHostEditorTabs = createDecorator('IExtHostEditorTabs');
class ExtHostEditorTab {
    constructor(dto, parentGroup, activeTabIdGetter) {
        this._activeTabIdGetter = activeTabIdGetter;
        this._parentGroup = parentGroup;
        this.acceptDtoUpdate(dto);
    }
    get apiObject() {
        if (!this._apiObject) {
            // Don't want to lose reference to parent `this` in the getters
            const that = this;
            const obj = {
                get isActive() {
                    // We use a getter function here to always ensure at most 1 active tab per group and prevent iteration for being required
                    return that._dto.id === that._activeTabIdGetter();
                },
                get label() {
                    return that._dto.label;
                },
                get input() {
                    return that._input;
                },
                get isDirty() {
                    return that._dto.isDirty;
                },
                get isPinned() {
                    return that._dto.isPinned;
                },
                get isPreview() {
                    return that._dto.isPreview;
                },
                get group() {
                    return that._parentGroup.apiObject;
                }
            };
            this._apiObject = Object.freeze(obj);
        }
        return this._apiObject;
    }
    get tabId() {
        return this._dto.id;
    }
    acceptDtoUpdate(dto) {
        this._dto = dto;
        this._input = this._initInput();
    }
    _initInput() {
        switch (this._dto.input.kind) {
            case 1 /* TabInputKind.TextInput */:
                return new TextTabInput(URI.revive(this._dto.input.uri));
            case 2 /* TabInputKind.TextDiffInput */:
                return new TextDiffTabInput(URI.revive(this._dto.input.original), URI.revive(this._dto.input.modified));
            case 3 /* TabInputKind.TextMergeInput */:
                return new TextMergeTabInput(URI.revive(this._dto.input.base), URI.revive(this._dto.input.input1), URI.revive(this._dto.input.input2), URI.revive(this._dto.input.result));
            case 6 /* TabInputKind.CustomEditorInput */:
                return new CustomEditorTabInput(URI.revive(this._dto.input.uri), this._dto.input.viewType);
            case 7 /* TabInputKind.WebviewEditorInput */:
                return new WebviewEditorTabInput(this._dto.input.viewType);
            case 4 /* TabInputKind.NotebookInput */:
                return new NotebookEditorTabInput(URI.revive(this._dto.input.uri), this._dto.input.notebookType);
            case 5 /* TabInputKind.NotebookDiffInput */:
                return new NotebookDiffEditorTabInput(URI.revive(this._dto.input.original), URI.revive(this._dto.input.modified), this._dto.input.notebookType);
            case 8 /* TabInputKind.TerminalEditorInput */:
                return new TerminalEditorTabInput();
            case 9 /* TabInputKind.InteractiveEditorInput */:
                return new InteractiveWindowInput(URI.revive(this._dto.input.uri), URI.revive(this._dto.input.inputBoxUri));
            case 10 /* TabInputKind.ChatEditorInput */:
                return new ChatEditorTabInput();
            case 11 /* TabInputKind.MultiDiffEditorInput */:
                return new TextMultiDiffTabInput(this._dto.input.diffEditors.map(diff => new TextDiffTabInput(URI.revive(diff.original), URI.revive(diff.modified))));
            default:
                return undefined;
        }
    }
}
class ExtHostEditorTabGroup {
    constructor(dto, activeGroupIdGetter) {
        this._tabs = [];
        this._activeTabId = '';
        this._dto = dto;
        this._activeGroupIdGetter = activeGroupIdGetter;
        // Construct all tabs from the given dto
        for (const tabDto of dto.tabs) {
            if (tabDto.isActive) {
                this._activeTabId = tabDto.id;
            }
            this._tabs.push(new ExtHostEditorTab(tabDto, this, () => this.activeTabId()));
        }
    }
    get apiObject() {
        if (!this._apiObject) {
            // Don't want to lose reference to parent `this` in the getters
            const that = this;
            const obj = {
                get isActive() {
                    // We use a getter function here to always ensure at most 1 active group and prevent iteration for being required
                    return that._dto.groupId === that._activeGroupIdGetter();
                },
                get viewColumn() {
                    return typeConverters.ViewColumn.to(that._dto.viewColumn);
                },
                get activeTab() {
                    return that._tabs.find(tab => tab.tabId === that._activeTabId)?.apiObject;
                },
                get tabs() {
                    return Object.freeze(that._tabs.map(tab => tab.apiObject));
                }
            };
            this._apiObject = Object.freeze(obj);
        }
        return this._apiObject;
    }
    get groupId() {
        return this._dto.groupId;
    }
    get tabs() {
        return this._tabs;
    }
    acceptGroupDtoUpdate(dto) {
        this._dto = dto;
    }
    acceptTabOperation(operation) {
        // In the open case we add the tab to the group
        if (operation.kind === 0 /* TabModelOperationKind.TAB_OPEN */) {
            const tab = new ExtHostEditorTab(operation.tabDto, this, () => this.activeTabId());
            // Insert tab at editor index
            this._tabs.splice(operation.index, 0, tab);
            if (operation.tabDto.isActive) {
                this._activeTabId = tab.tabId;
            }
            return tab;
        }
        else if (operation.kind === 1 /* TabModelOperationKind.TAB_CLOSE */) {
            const tab = this._tabs.splice(operation.index, 1)[0];
            if (!tab) {
                throw new Error(`Tab close updated received for index ${operation.index} which does not exist`);
            }
            if (tab.tabId === this._activeTabId) {
                this._activeTabId = '';
            }
            return tab;
        }
        else if (operation.kind === 3 /* TabModelOperationKind.TAB_MOVE */) {
            if (operation.oldIndex === undefined) {
                throw new Error('Invalid old index on move IPC');
            }
            // Splice to remove at old index and insert at new index === moving the tab
            const tab = this._tabs.splice(operation.oldIndex, 1)[0];
            if (!tab) {
                throw new Error(`Tab move updated received for index ${operation.oldIndex} which does not exist`);
            }
            this._tabs.splice(operation.index, 0, tab);
            return tab;
        }
        const tab = this._tabs.find(extHostTab => extHostTab.tabId === operation.tabDto.id);
        if (!tab) {
            throw new Error('INVALID tab');
        }
        if (operation.tabDto.isActive) {
            this._activeTabId = operation.tabDto.id;
        }
        else if (this._activeTabId === operation.tabDto.id && !operation.tabDto.isActive) {
            // Events aren't guaranteed to be in order so if we receive a dto that matches the active tab id
            // but isn't active we mark the active tab id as empty. This prevent onDidActiveTabChange from
            // firing incorrectly
            this._activeTabId = '';
        }
        tab.acceptDtoUpdate(operation.tabDto);
        return tab;
    }
    // Not a getter since it must be a function to be used as a callback for the tabs
    activeTabId() {
        return this._activeTabId;
    }
}
let ExtHostEditorTabs = class ExtHostEditorTabs {
    constructor(extHostRpc) {
        this._onDidChangeTabs = new Emitter();
        this._onDidChangeTabGroups = new Emitter();
        this._extHostTabGroups = [];
        this._proxy = extHostRpc.getProxy(MainContext.MainThreadEditorTabs);
    }
    get tabGroups() {
        if (!this._apiObject) {
            const that = this;
            const obj = {
                // never changes -> simple value
                onDidChangeTabGroups: that._onDidChangeTabGroups.event,
                onDidChangeTabs: that._onDidChangeTabs.event,
                // dynamic -> getters
                get all() {
                    return Object.freeze(that._extHostTabGroups.map(group => group.apiObject));
                },
                get activeTabGroup() {
                    const activeTabGroupId = that._activeGroupId;
                    const activeTabGroup = assertReturnsDefined(that._extHostTabGroups.find(candidate => candidate.groupId === activeTabGroupId)?.apiObject);
                    return activeTabGroup;
                },
                close: async (tabOrTabGroup, preserveFocus) => {
                    const tabsOrTabGroups = Array.isArray(tabOrTabGroup) ? tabOrTabGroup : [tabOrTabGroup];
                    if (!tabsOrTabGroups.length) {
                        return true;
                    }
                    // Check which type was passed in and call the appropriate close
                    // Casting is needed as typescript doesn't seem to infer enough from this
                    if (isTabGroup(tabsOrTabGroups[0])) {
                        return this._closeGroups(tabsOrTabGroups, preserveFocus);
                    }
                    else {
                        return this._closeTabs(tabsOrTabGroups, preserveFocus);
                    }
                },
                // move: async (tab: vscode.Tab, viewColumn: ViewColumn, index: number, preserveFocus?: boolean) => {
                // 	const extHostTab = this._findExtHostTabFromApi(tab);
                // 	if (!extHostTab) {
                // 		throw new Error('Invalid tab');
                // 	}
                // 	this._proxy.$moveTab(extHostTab.tabId, index, typeConverters.ViewColumn.from(viewColumn), preserveFocus);
                // 	return;
                // }
            };
            this._apiObject = Object.freeze(obj);
        }
        return this._apiObject;
    }
    $acceptEditorTabModel(tabGroups) {
        const groupIdsBefore = new Set(this._extHostTabGroups.map(group => group.groupId));
        const groupIdsAfter = new Set(tabGroups.map(dto => dto.groupId));
        const diff = diffSets(groupIdsBefore, groupIdsAfter);
        const closed = this._extHostTabGroups.filter(group => diff.removed.includes(group.groupId)).map(group => group.apiObject);
        const opened = [];
        const changed = [];
        this._extHostTabGroups = tabGroups.map(tabGroup => {
            const group = new ExtHostEditorTabGroup(tabGroup, () => this._activeGroupId);
            if (diff.added.includes(group.groupId)) {
                opened.push(group.apiObject);
            }
            else {
                changed.push(group.apiObject);
            }
            return group;
        });
        // Set the active tab group id
        const activeTabGroupId = assertReturnsDefined(tabGroups.find(group => group.isActive === true)?.groupId);
        if (activeTabGroupId !== undefined && this._activeGroupId !== activeTabGroupId) {
            this._activeGroupId = activeTabGroupId;
        }
        this._onDidChangeTabGroups.fire(Object.freeze({ opened, closed, changed }));
    }
    $acceptTabGroupUpdate(groupDto) {
        const group = this._extHostTabGroups.find(group => group.groupId === groupDto.groupId);
        if (!group) {
            throw new Error('Update Group IPC call received before group creation.');
        }
        group.acceptGroupDtoUpdate(groupDto);
        if (groupDto.isActive) {
            this._activeGroupId = groupDto.groupId;
        }
        this._onDidChangeTabGroups.fire(Object.freeze({ changed: [group.apiObject], opened: [], closed: [] }));
    }
    $acceptTabOperation(operation) {
        const group = this._extHostTabGroups.find(group => group.groupId === operation.groupId);
        if (!group) {
            throw new Error('Update Tabs IPC call received before group creation.');
        }
        const tab = group.acceptTabOperation(operation);
        // Construct the tab change event based on the operation
        switch (operation.kind) {
            case 0 /* TabModelOperationKind.TAB_OPEN */:
                this._onDidChangeTabs.fire(Object.freeze({
                    opened: [tab.apiObject],
                    closed: [],
                    changed: []
                }));
                return;
            case 1 /* TabModelOperationKind.TAB_CLOSE */:
                this._onDidChangeTabs.fire(Object.freeze({
                    opened: [],
                    closed: [tab.apiObject],
                    changed: []
                }));
                return;
            case 3 /* TabModelOperationKind.TAB_MOVE */:
            case 2 /* TabModelOperationKind.TAB_UPDATE */:
                this._onDidChangeTabs.fire(Object.freeze({
                    opened: [],
                    closed: [],
                    changed: [tab.apiObject]
                }));
                return;
        }
    }
    _findExtHostTabFromApi(apiTab) {
        for (const group of this._extHostTabGroups) {
            for (const tab of group.tabs) {
                if (tab.apiObject === apiTab) {
                    return tab;
                }
            }
        }
        return;
    }
    _findExtHostTabGroupFromApi(apiTabGroup) {
        return this._extHostTabGroups.find(candidate => candidate.apiObject === apiTabGroup);
    }
    async _closeTabs(tabs, preserveFocus) {
        const extHostTabIds = [];
        for (const tab of tabs) {
            const extHostTab = this._findExtHostTabFromApi(tab);
            if (!extHostTab) {
                throw new Error('Tab close: Invalid tab not found!');
            }
            extHostTabIds.push(extHostTab.tabId);
        }
        return this._proxy.$closeTab(extHostTabIds, preserveFocus);
    }
    async _closeGroups(groups, preserverFoucs) {
        const extHostGroupIds = [];
        for (const group of groups) {
            const extHostGroup = this._findExtHostTabGroupFromApi(group);
            if (!extHostGroup) {
                throw new Error('Group close: Invalid group not found!');
            }
            extHostGroupIds.push(extHostGroup.groupId);
        }
        return this._proxy.$closeGroup(extHostGroupIds, preserverFoucs);
    }
};
ExtHostEditorTabs = __decorate([
    __param(0, IExtHostRpcService)
], ExtHostEditorTabs);
export { ExtHostEditorTabs };
//#region Utils
function isTabGroup(obj) {
    const tabGroup = obj;
    if (tabGroup.tabs !== undefined) {
        return true;
    }
    return false;
}
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdEVkaXRvclRhYnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9jb21tb24vZXh0SG9zdEVkaXRvclRhYnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN4RCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNyRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDbEQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzFGLE9BQU8sRUFBOEQsV0FBVyxFQUFnRixNQUFNLHVCQUF1QixDQUFDO0FBQzlMLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQzVELE9BQU8sS0FBSyxjQUFjLE1BQU0sNEJBQTRCLENBQUM7QUFDN0QsT0FBTyxFQUFFLGtCQUFrQixFQUFFLG9CQUFvQixFQUFFLHNCQUFzQixFQUFFLDBCQUEwQixFQUFFLHNCQUFzQixFQUFFLHNCQUFzQixFQUFFLGdCQUFnQixFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxxQkFBcUIsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBUWxSLE1BQU0sQ0FBQyxNQUFNLGtCQUFrQixHQUFHLGVBQWUsQ0FBcUIsb0JBQW9CLENBQUMsQ0FBQztBQUk1RixNQUFNLGdCQUFnQjtJQU9yQixZQUFZLEdBQWtCLEVBQUUsV0FBa0MsRUFBRSxpQkFBK0I7UUFDbEcsSUFBSSxDQUFDLGtCQUFrQixHQUFHLGlCQUFpQixDQUFDO1FBQzVDLElBQUksQ0FBQyxZQUFZLEdBQUcsV0FBVyxDQUFDO1FB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