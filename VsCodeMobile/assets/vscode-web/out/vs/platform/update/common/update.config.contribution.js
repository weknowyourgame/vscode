/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isWeb, isWindows } from '../../../base/common/platform.js';
import { PolicyCategory } from '../../../base/common/policy.js';
import { localize } from '../../../nls.js';
import { Extensions as ConfigurationExtensions } from '../../configuration/common/configurationRegistry.js';
import { Registry } from '../../registry/common/platform.js';
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
    id: 'update',
    order: 15,
    title: localize('updateConfigurationTitle', "Update"),
    type: 'object',
    properties: {
        'update.mode': {
            type: 'string',
            enum: ['none', 'manual', 'start', 'default'],
            default: 'default',
            scope: 1 /* ConfigurationScope.APPLICATION */,
            description: localize('updateMode', "Configure whether you receive automatic updates. Requires a restart after change. The updates are fetched from a Microsoft online service."),
            tags: ['usesOnlineServices'],
            enumDescriptions: [
                localize('none', "Disable updates."),
                localize('manual', "Disable automatic background update checks. Updates will be available if you manually check for updates."),
                localize('start', "Check for updates only on startup. Disable automatic background update checks."),
                localize('default', "Enable automatic update checks. Code will check for updates automatically and periodically.")
            ],
            policy: {
                name: 'UpdateMode',
                category: PolicyCategory.Update,
                minimumVersion: '1.67',
                localization: {
                    description: { key: 'updateMode', value: localize('updateMode', "Configure whether you receive automatic updates. Requires a restart after change. The updates are fetched from a Microsoft online service."), },
                    enumDescriptions: [
                        {
                            key: 'none',
                            value: localize('none', "Disable updates."),
                        },
                        {
                            key: 'manual',
                            value: localize('manual', "Disable automatic background update checks. Updates will be available if you manually check for updates."),
                        },
                        {
                            key: 'start',
                            value: localize('start', "Check for updates only on startup. Disable automatic background update checks."),
                        },
                        {
                            key: 'default',
                            value: localize('default', "Enable automatic update checks. Code will check for updates automatically and periodically."),
                        }
                    ]
                },
            }
        },
        'update.channel': {
            type: 'string',
            default: 'default',
            scope: 1 /* ConfigurationScope.APPLICATION */,
            description: localize('updateMode', "Configure whether you receive automatic updates. Requires a restart after change. The updates are fetched from a Microsoft online service."),
            deprecationMessage: localize('deprecated', "This setting is deprecated, please use '{0}' instead.", 'update.mode')
        },
        'update.enableWindowsBackgroundUpdates': {
            type: 'boolean',
            default: true,
            scope: 1 /* ConfigurationScope.APPLICATION */,
            title: localize('enableWindowsBackgroundUpdatesTitle', "Enable Background Updates on Windows"),
            description: localize('enableWindowsBackgroundUpdates', "Enable to download and install new VS Code versions in the background on Windows."),
            included: isWindows && !isWeb
        },
        'update.showReleaseNotes': {
            type: 'boolean',
            default: true,
            scope: 1 /* ConfigurationScope.APPLICATION */,
            description: localize('showReleaseNotes', "Show Release Notes after an update. The Release Notes are fetched from a Microsoft online service."),
            tags: ['usesOnlineServices']
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBkYXRlLmNvbmZpZy5jb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vdXBkYXRlL2NvbW1vbi91cGRhdGUuY29uZmlnLmNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDM0MsT0FBTyxFQUFzQixVQUFVLElBQUksdUJBQXVCLEVBQTBCLE1BQU0scURBQXFELENBQUM7QUFDeEosT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRTdELE1BQU0scUJBQXFCLEdBQUcsUUFBUSxDQUFDLEVBQUUsQ0FBeUIsdUJBQXVCLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDekcscUJBQXFCLENBQUMscUJBQXFCLENBQUM7SUFDM0MsRUFBRSxFQUFFLFFBQVE7SUFDWixLQUFLLEVBQUUsRUFBRTtJQUNULEtBQUssRUFBRSxRQUFRLENBQUMsMEJBQTBCLEVBQUUsUUFBUSxDQUFDO0lBQ3JELElBQUksRUFBRSxRQUFRO0lBQ2QsVUFBVSxFQUFFO1FBQ1gsYUFBYSxFQUFFO1lBQ2QsSUFBSSxFQUFFLFFBQVE7WUFDZCxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxTQUFTLENBQUM7WUFDNUMsT0FBTyxFQUFFLFNBQVM7WUFDbEIsS0FBSyx3Q0FBZ0M7WUFDckMsV0FBVyxFQUFFLFFBQVEsQ0FBQyxZQUFZLEVBQUUsNElBQTRJLENBQUM7WUFDakwsSUFBSSxFQUFFLENBQUMsb0JBQW9CLENBQUM7WUFDNUIsZ0JBQWdCLEVBQUU7Z0JBQ2pCLFFBQVEsQ0FBQyxNQUFNLEVBQUUsa0JBQWtCLENBQUM7Z0JBQ3BDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsMEdBQTBHLENBQUM7Z0JBQzlILFFBQVEsQ0FBQyxPQUFPLEVBQUUsZ0ZBQWdGLENBQUM7Z0JBQ25HLFFBQVEsQ0FBQyxTQUFTLEVBQUUsNkZBQTZGLENBQUM7YUFDbEg7WUFDRCxNQUFNLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLFlBQVk7Z0JBQ2xCLFFBQVEsRUFBRSxjQUFjLENBQUMsTUFBTTtnQkFDL0IsY0FBYyxFQUFFLE1BQU07Z0JBQ3RCLFlBQVksRUFBRTtvQkFDYixXQUFXLEVBQUUsRUFBRSxHQUFHLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsWUFBWSxFQUFFLDRJQUE0SSxDQUFDLEdBQUc7b0JBQ2hOLGdCQUFnQixFQUFFO3dCQUNqQjs0QkFDQyxHQUFHLEVBQUUsTUFBTTs0QkFDWCxLQUFLLEVBQUUsUUFBUSxDQUFDLE1BQU0sRUFBRSxrQkFBa0IsQ0FBQzt5QkFDM0M7d0JBQ0Q7NEJBQ0MsR0FBRyxFQUFFLFFBQVE7NEJBQ2IsS0FBSyxFQUFFLFFBQVEsQ0FBQyxRQUFRLEVBQUUsMEdBQTBHLENBQUM7eUJBQ3JJO3dCQUNEOzRCQUNDLEdBQUcsRUFBRSxPQUFPOzRCQUNaLEtBQUssRUFBRSxRQUFRLENBQUMsT0FBTyxFQUFFLGdGQUFnRixDQUFDO3lCQUMxRzt3QkFDRDs0QkFDQyxHQUFHLEVBQUUsU0FBUzs0QkFDZCxLQUFLLEVBQUUsUUFBUSxDQUFDLFNBQVMsRUFBRSw2RkFBNkYsQ0FBQzt5QkFDekg7cUJBQ0Q7aUJBQ0Q7YUFDRDtTQUNEO1FBQ0QsZ0JBQWdCLEVBQUU7WUFDakIsSUFBSSxFQUFFLFFBQVE7WUFDZCxPQUFPLEVBQUUsU0FBUztZQUNsQixLQUFLLHdDQUFnQztZQUNyQyxXQUFXLEVBQUUsUUFBUSxDQUFDLFlBQVksRUFBRSw0SUFBNEksQ0FBQztZQUNqTCxrQkFBa0IsRUFBRSxRQUFRLENBQUMsWUFBWSxFQUFFLHVEQUF1RCxFQUFFLGFBQWEsQ0FBQztTQUNsSDtRQUNELHVDQUF1QyxFQUFFO1lBQ3hDLElBQUksRUFBRSxTQUFTO1lBQ2YsT0FBTyxFQUFFLElBQUk7WUFDYixLQUFLLHdDQUFnQztZQUNyQyxLQUFLLEVBQUUsUUFBUSxDQUFDLHFDQUFxQyxFQUFFLHNDQUFzQyxDQUFDO1lBQzlGLFdBQVcsRUFBRSxRQUFRLENBQUMsZ0NBQWdDLEVBQUUsbUZBQW1GLENBQUM7WUFDNUksUUFBUSxFQUFFLFNBQVMsSUFBSSxDQUFDLEtBQUs7U0FDN0I7UUFDRCx5QkFBeUIsRUFBRTtZQUMxQixJQUFJLEVBQUUsU0FBUztZQUNmLE9BQU8sRUFBRSxJQUFJO1lBQ2IsS0FBSyx3Q0FBZ0M7WUFDckMsV0FBVyxFQUFFLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSxvR0FBb0csQ0FBQztZQUMvSSxJQUFJLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQztTQUM1QjtLQUNEO0NBQ0QsQ0FBQyxDQUFDIn0=