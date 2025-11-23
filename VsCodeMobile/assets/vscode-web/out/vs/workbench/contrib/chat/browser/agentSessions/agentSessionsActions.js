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
import './media/agentsessionsactions.css';
import { localize, localize2 } from '../../../../../nls.js';
import { Action } from '../../../../../base/common/actions.js';
import { ActionViewItem } from '../../../../../base/browser/ui/actionbar/actionViewItems.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { EventHelper, h, hide, show } from '../../../../../base/browser/dom.js';
import { assertReturnsDefined } from '../../../../../base/common/types.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ViewAction } from '../../../../browser/parts/views/viewPane.js';
import { AGENT_SESSIONS_VIEW_ID, AgentSessionProviders } from './agentSessions.js';
import { IChatService } from '../../common/chatService.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { resetFilter } from './agentSessionsViewFilter.js';
//#region Diff Statistics Action
export class AgentSessionShowDiffAction extends Action {
    static { this.ID = 'agentSession.showDiff'; }
    constructor(session) {
        super(AgentSessionShowDiffAction.ID, localize('showDiff', "Open Changes"), undefined, true);
        this.session = session;
    }
    async run() {
        // This will be handled by the action view item
    }
    getSession() {
        return this.session;
    }
}
let AgentSessionDiffActionViewItem = class AgentSessionDiffActionViewItem extends ActionViewItem {
    get action() {
        return super.action;
    }
    constructor(action, options, commandService) {
        super(null, action, options);
        this.commandService = commandService;
    }
    render(container) {
        super.render(container);
        const label = assertReturnsDefined(this.label);
        label.textContent = '';
        const session = this.action.getSession();
        const diff = session.statistics;
        if (!diff) {
            return;
        }
        const elements = h('div.agent-session-diff-container@diffContainer', [
            h('span.agent-session-diff-files@filesSpan'),
            h('span.agent-session-diff-added@addedSpan'),
            h('span.agent-session-diff-removed@removedSpan')
        ]);
        if (diff.files > 0) {
            elements.filesSpan.textContent = diff.files === 1 ? localize('diffFile', "1 file") : localize('diffFiles', "{0} files", diff.files);
            show(elements.filesSpan);
        }
        else {
            hide(elements.filesSpan);
        }
        if (diff.insertions > 0) {
            elements.addedSpan.textContent = `+${diff.insertions}`;
            show(elements.addedSpan);
        }
        else {
            hide(elements.addedSpan);
        }
        if (diff.deletions > 0) {
            elements.removedSpan.textContent = `-${diff.deletions}`;
            show(elements.removedSpan);
        }
        else {
            hide(elements.removedSpan);
        }
        label.appendChild(elements.diffContainer);
    }
    onClick(event) {
        EventHelper.stop(event, true);
        const session = this.action.getSession();
        this.commandService.executeCommand(`agentSession.${session.providerType}.openChanges`, this.action.getSession().resource);
    }
};
AgentSessionDiffActionViewItem = __decorate([
    __param(2, ICommandService)
], AgentSessionDiffActionViewItem);
export { AgentSessionDiffActionViewItem };
CommandsRegistry.registerCommand(`agentSession.${AgentSessionProviders.Local}.openChanges`, async (accessor, resource) => {
    const chatService = accessor.get(IChatService);
    const session = chatService.getSession(resource);
    session?.editingSession?.show();
});
//#endregion
//#region View Actions
registerAction2(class extends ViewAction {
    constructor() {
        super({
            id: 'agentSessionsView.refresh',
            title: localize2('refresh', "Refresh Agent Sessions"),
            icon: Codicon.refresh,
            menu: {
                id: MenuId.AgentSessionsTitle,
                group: 'navigation',
                order: 1
            },
            viewId: AGENT_SESSIONS_VIEW_ID
        });
    }
    runInView(accessor, view) {
        view.refresh();
    }
});
registerAction2(class extends ViewAction {
    constructor() {
        super({
            id: 'agentSessionsView.find',
            title: localize2('find', "Find Agent Session"),
            icon: Codicon.search,
            menu: {
                id: MenuId.AgentSessionsTitle,
                group: 'navigation',
                order: 2
            },
            viewId: AGENT_SESSIONS_VIEW_ID
        });
    }
    runInView(accessor, view) {
        view.openFind();
    }
});
MenuRegistry.appendMenuItem(MenuId.AgentSessionsTitle, {
    submenu: MenuId.AgentSessionsFilterSubMenu,
    title: localize('filterAgentSessions', "Filter Agent Sessions"),
    group: 'navigation',
    order: 100,
    icon: Codicon.filter
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'agentSessions.filter.resetExcludes',
            title: localize('agentSessions.filter.reset', 'Reset'),
            menu: {
                id: MenuId.AgentSessionsFilterSubMenu,
                group: '4_reset',
                order: 0,
            },
        });
    }
    run(accessor) {
        const storageService = accessor.get(IStorageService);
        resetFilter(storageService);
    }
});
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRTZXNzaW9uc0FjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2FnZW50U2Vzc2lvbnMvYWdlbnRTZXNzaW9uc0FjdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxrQ0FBa0MsQ0FBQztBQUMxQyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBRTVELE9BQU8sRUFBRSxNQUFNLEVBQVcsTUFBTSx1Q0FBdUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsY0FBYyxFQUEwQixNQUFNLDZEQUE2RCxDQUFDO0FBQ3JILE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxlQUFlLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN4RyxPQUFPLEVBQUUsV0FBVyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDaEYsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDM0UsT0FBTyxFQUFFLE9BQU8sRUFBZ0IsTUFBTSxFQUFFLFlBQVksRUFBRSxlQUFlLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNqSSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFakUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBR25GLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUMzRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDcEYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDhCQUE4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