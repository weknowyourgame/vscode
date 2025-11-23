/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isIOS } from '../../../../base/common/platform.js';
import { localize } from '../../../../nls.js';
import { Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { workbenchConfigurationNodeBase } from '../../../common/configuration.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { SashSettingsController } from './sash.js';
// Sash size contribution
registerWorkbenchContribution2(SashSettingsController.ID, SashSettingsController, 3 /* WorkbenchPhase.AfterRestored */);
// Sash size configuration contribution
Registry.as(ConfigurationExtensions.Configuration)
    .registerConfiguration({
    ...workbenchConfigurationNodeBase,
    properties: {
        'workbench.sash.size': {
            type: 'number',
            default: isIOS ? 20 : 4,
            minimum: 1,
            maximum: 20,
            description: localize('sashSize', "Controls the feedback area size in pixels of the dragging area in between views/editors. Set it to a larger value if you feel it's hard to resize views using the mouse.")
        },
        'workbench.sash.hoverDelay': {
            type: 'number',
            default: 300,
            minimum: 0,
            maximum: 2000,
            description: localize('sashHoverDelay', "Controls the hover feedback delay in milliseconds of the dragging area in between views/editors.")
        },
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2FzaC5jb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvc2FzaC9icm93c2VyL3Nhc2guY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUEwQixVQUFVLElBQUksdUJBQXVCLEVBQUUsTUFBTSxvRUFBb0UsQ0FBQztBQUNuSixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDNUUsT0FBTyxFQUFFLDhCQUE4QixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEYsT0FBTyxFQUFFLDhCQUE4QixFQUFrQixNQUFNLGtDQUFrQyxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUVuRCx5QkFBeUI7QUFDekIsOEJBQThCLENBQUMsc0JBQXNCLENBQUMsRUFBRSxFQUFFLHNCQUFzQix1Q0FBK0IsQ0FBQztBQUVoSCx1Q0FBdUM7QUFDdkMsUUFBUSxDQUFDLEVBQUUsQ0FBeUIsdUJBQXVCLENBQUMsYUFBYSxDQUFDO0tBQ3hFLHFCQUFxQixDQUFDO0lBQ3RCLEdBQUcsOEJBQThCO0lBQ2pDLFVBQVUsRUFBRTtRQUNYLHFCQUFxQixFQUFFO1lBQ3RCLElBQUksRUFBRSxRQUFRO1lBQ2QsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLE9BQU8sRUFBRSxDQUFDO1lBQ1YsT0FBTyxFQUFFLEVBQUU7WUFDWCxXQUFXLEVBQUUsUUFBUSxDQUFDLFVBQVUsRUFBRSwwS0FBMEssQ0FBQztTQUM3TTtRQUNELDJCQUEyQixFQUFFO1lBQzVCLElBQUksRUFBRSxRQUFRO1lBQ2QsT0FBTyxFQUFFLEdBQUc7WUFDWixPQUFPLEVBQUUsQ0FBQztZQUNWLE9BQU8sRUFBRSxJQUFJO1lBQ2IsV0FBVyxFQUFFLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRSxrR0FBa0csQ0FBQztTQUMzSTtLQUNEO0NBQ0QsQ0FBQyxDQUFDIn0=