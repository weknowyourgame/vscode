/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as ViewExtensions } from '../../../common/views.js';
import { VIEW_CONTAINER } from '../../files/browser/explorerViewlet.js';
import { ITimelineService, TimelinePaneId } from '../common/timeline.js';
import { TimelineHasProviderContext, TimelineService } from '../common/timelineService.js';
import { TimelinePane } from './timelinePane.js';
import { Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ExplorerFolderContext } from '../../files/common/files.js';
import { ResourceContextKey } from '../../../common/contextkeys.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { URI } from '../../../../base/common/uri.js';
const timelineViewIcon = registerIcon('timeline-view-icon', Codicon.history, localize('timelineViewIcon', 'View icon of the timeline view.'));
const timelineOpenIcon = registerIcon('timeline-open', Codicon.history, localize('timelineOpenIcon', 'Icon for the open timeline action.'));
export class TimelinePaneDescriptor {
    constructor() {
        this.id = TimelinePaneId;
        this.name = TimelinePane.TITLE;
        this.containerIcon = timelineViewIcon;
        this.ctorDescriptor = new SyncDescriptor(TimelinePane);
        this.order = 2;
        this.weight = 30;
        this.collapsed = true;
        this.canToggleVisibility = true;
        this.hideByDefault = false;
        this.canMoveView = true;
        this.when = TimelineHasProviderContext;
        this.focusCommand = { id: 'timeline.focus' };
    }
}
// Configuration
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
    id: 'timeline',
    order: 1001,
    title: localize('timelineConfigurationTitle', "Timeline"),
    type: 'object',
    properties: {
        'timeline.pageSize': {
            type: ['number', 'null'],
            default: 50,
            markdownDescription: localize('timeline.pageSize', "The number of items to show in the Timeline view by default and when loading more items. Setting to `null` will automatically choose a page size based on the visible area of the Timeline view."),
        },
        'timeline.pageOnScroll': {
            type: 'boolean',
            default: true,
            description: localize('timeline.pageOnScroll', "Controls whether the Timeline view will load the next page of items when you scroll to the end of the list."),
        },
    }
});
Registry.as(ViewExtensions.ViewsRegistry).registerViews([new TimelinePaneDescriptor()], VIEW_CONTAINER);
var OpenTimelineAction;
(function (OpenTimelineAction) {
    OpenTimelineAction.ID = 'files.openTimeline';
    OpenTimelineAction.LABEL = localize('files.openTimeline', "Open Timeline");
    function handler() {
        return (accessor, arg) => {
            const service = accessor.get(ITimelineService);
            if (URI.isUri(arg)) {
                return service.setUri(arg);
            }
        };
    }
    OpenTimelineAction.handler = handler;
})(OpenTimelineAction || (OpenTimelineAction = {}));
CommandsRegistry.registerCommand(OpenTimelineAction.ID, OpenTimelineAction.handler());
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, ({
    group: '4_timeline',
    order: 1,
    command: {
        id: OpenTimelineAction.ID,
        title: OpenTimelineAction.LABEL,
        icon: timelineOpenIcon
    },
    when: ContextKeyExpr.and(ExplorerFolderContext.toNegated(), ResourceContextKey.HasResource, TimelineHasProviderContext)
}));
const timelineFilter = registerIcon('timeline-filter', Codicon.filter, localize('timelineFilter', 'Icon for the filter timeline action.'));
MenuRegistry.appendMenuItem(MenuId.TimelineTitle, {
    submenu: MenuId.TimelineFilterSubMenu,
    title: localize('filterTimeline', "Filter Timeline"),
    group: 'navigation',
    order: 100,
    icon: timelineFilter
});
registerSingleton(ITimelineService, TimelineService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGltZWxpbmUuY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3RpbWVsaW5lL2Jyb3dzZXIvdGltZWxpbmUuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDMUYsT0FBTyxFQUFxQixpQkFBaUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQy9HLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQW1DLFVBQVUsSUFBSSxjQUFjLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUN6RyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLGNBQWMsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ3pFLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxlQUFlLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMzRixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDakQsT0FBTyxFQUEwQixVQUFVLElBQUksdUJBQXVCLEVBQUUsTUFBTSxvRUFBb0UsQ0FBQztBQUNuSixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdEYsT0FBTyxFQUFnQixNQUFNLEVBQUUsWUFBWSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDcEcsT0FBTyxFQUFtQixnQkFBZ0IsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3BFLE9BQU8sRUFBRSxrQkFBa0Is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