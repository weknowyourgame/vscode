/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditTelemetryContribution } from './editTelemetryContribution.js';
import { EDIT_TELEMETRY_SETTING_ID, AI_STATS_SETTING_ID } from './settingIds.js';
import { Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { localize } from '../../../../nls.js';
import { EDIT_TELEMETRY_DETAILS_SETTING_ID, EDIT_TELEMETRY_SHOW_DECORATIONS, EDIT_TELEMETRY_SHOW_STATUS_BAR } from './settings.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IAiEditTelemetryService } from './telemetry/aiEditTelemetry/aiEditTelemetryService.js';
import { AiEditTelemetryServiceImpl } from './telemetry/aiEditTelemetry/aiEditTelemetryServiceImpl.js';
import { IRandomService, RandomService } from './randomService.js';
registerWorkbenchContribution2('EditTelemetryContribution', EditTelemetryContribution, 3 /* WorkbenchPhase.AfterRestored */);
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
    id: 'task',
    order: 100,
    title: localize('editTelemetry', "Edit Telemetry"),
    type: 'object',
    properties: {
        [EDIT_TELEMETRY_SETTING_ID]: {
            markdownDescription: localize('telemetry.editStats.enabled', "Controls whether to enable telemetry for edit statistics (only sends statistics if general telemetry is enabled)."),
            type: 'boolean',
            default: true,
            tags: ['experimental'],
        },
        [AI_STATS_SETTING_ID]: {
            markdownDescription: localize('editor.aiStats.enabled', "Controls whether to enable AI statistics in the editor. The gauge represents the average amount of code inserted by AI vs manual typing over a 24 hour period."),
            type: 'boolean',
            default: false,
            tags: ['experimental'],
            experiment: {
                mode: 'auto'
            }
        },
        [EDIT_TELEMETRY_DETAILS_SETTING_ID]: {
            markdownDescription: localize('telemetry.editStats.detailed.enabled', "Controls whether to enable telemetry for detailed edit statistics (only sends statistics if general telemetry is enabled)."),
            type: 'boolean',
            default: false,
            tags: ['experimental'],
            experiment: {
                mode: 'auto'
            }
        },
        [EDIT_TELEMETRY_SHOW_STATUS_BAR]: {
            markdownDescription: localize('telemetry.editStats.showStatusBar', "Controls whether to show the status bar for edit telemetry."),
            type: 'boolean',
            default: false,
            tags: ['experimental'],
        },
        [EDIT_TELEMETRY_SHOW_DECORATIONS]: {
            markdownDescription: localize('telemetry.editStats.showDecorations', "Controls whether to show decorations for edit telemetry."),
            type: 'boolean',
            default: false,
            tags: ['experimental'],
        },
    }
});
registerSingleton(IAiEditTelemetryService, AiEditTelemetryServiceImpl, 1 /* InstantiationType.Delayed */);
registerSingleton(IRandomService, RandomService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdFRlbGVtZXRyeS5jb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZWRpdFRlbGVtZXRyeS9icm93c2VyL2VkaXRUZWxlbWV0cnkuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMzRSxPQUFPLEVBQUUseUJBQXlCLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUNqRixPQUFPLEVBQUUsVUFBVSxJQUFJLHVCQUF1QixFQUEwQixNQUFNLG9FQUFvRSxDQUFDO0FBQ25KLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsaUNBQWlDLEVBQUUsK0JBQStCLEVBQUUsOEJBQThCLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDbkksT0FBTyxFQUFFLDhCQUE4QixFQUFrQixNQUFNLGtDQUFrQyxDQUFDO0FBQ2xHLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNoRyxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUN2RyxPQUFPLEVBQUUsY0FBYyxFQUFFLGFBQWEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBRW5FLDhCQUE4QixDQUFDLDJCQUEyQixFQUFFLHlCQUF5Qix1Q0FBK0IsQ0FBQztBQUVySCxNQUFNLHFCQUFxQixHQUFHLFFBQVEsQ0FBQyxFQUFFLENBQXlCLHVCQUF1QixDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ3pHLHFCQUFxQixDQUFDLHFCQUFxQixDQUFDO0lBQzNDLEVBQUUsRUFBRSxNQUFNO0lBQ1YsS0FBSyxFQUFFLEdBQUc7SUFDVixLQUFLLEVBQUUsUUFBUSxDQUFDLGVBQWUsRUFBRSxnQkFBZ0IsQ0FBQztJQUNsRCxJQUFJLEVBQUUsUUFBUTtJQUNkLFVBQVUsRUFBRTtRQUNYLENBQUMseUJBQXlCLENBQUMsRUFBRTtZQUM1QixtQkFBbUIsRUFBRSxRQUFRLENBQUMsNkJBQTZCLEVBQUUsbUhBQW1ILENBQUM7WUFDakwsSUFBSSxFQUFFLFNBQVM7WUFDZixPQUFPLEVBQUUsSUFBSTtZQUNiLElBQUksRUFBRSxDQUFDLGNBQWMsQ0FBQztTQUN0QjtRQUNELENBQUMsbUJBQW1CLENBQUMsRUFBRTtZQUN0QixtQkFBbUIsRUFBRSxRQUFRLENBQUMsd0JBQXdCLEVBQUUsZ0tBQWdLLENBQUM7WUFDek4sSUFBSSxFQUFFLFNBQVM7WUFDZixPQUFPLEVBQUUsS0FBSztZQUNkLElBQUksRUFBRSxDQUFDLGNBQWMsQ0FBQztZQUN0QixVQUFVLEVBQUU7Z0JBQ1gsSUFBSSxFQUFFLE1BQU07YUFDWjtTQUNEO1FBQ0QsQ0FBQyxpQ0FBaUMsQ0FBQyxFQUFFO1lBQ3BDLG1CQUFtQixFQUFFLFFBQVEsQ0FBQyxzQ0FBc0MsRUFBRSw0SEFBNEgsQ0FBQztZQUNuTSxJQUFJLEVBQUUsU0FBUztZQUNmLE9BQU8sRUFBRSxLQUFLO1lBQ2QsSUFBSSxFQUFFLENBQUMsY0FBYyxDQUFDO1lBQ3RCLFVBQVUsRUFBRTtnQkFDWCxJQUFJLEVBQUUsTUFBTTthQUNaO1NBQ0Q7UUFDRCxDQUFDLDhCQUE4QixDQUFDLEVBQUU7WUFDakMsbUJBQW1CLEVBQUUsUUFBUSxDQUFDLG1DQUFtQyxFQUFFLDZEQUE2RCxDQUFDO1lBQ2pJLElBQUksRUFBRSxTQUFTO1lBQ2YsT0FBTyxFQUFFLEtBQUs7WUFDZCxJQUFJLEVBQUUsQ0FBQyxjQUFjLENBQUM7U0FDdEI7UUFDRCxDQUFDLCtCQUErQixDQUFDLEVBQUU7WUFDbEMsbUJBQW1CLEVBQUUsUUFBUSxDQUFDLHFDQUFxQyxFQUFFLDBEQUEwRCxDQUFDO1lBQ2hJLElBQUksRUFBRSxTQUFTO1lBQ2YsT0FBTyxFQUFFLEtBQUs7WUFDZCxJQUFJLEVBQUUsQ0FBQyxjQUFjLENBQUM7U0FDdEI7S0FDRDtDQUNELENBQUMsQ0FBQztBQUVILGlCQUFpQixDQUFDLHVCQUF1QixFQUFFLDBCQUEwQixvQ0FBNEIsQ0FBQztBQUNsRyxpQkFBaUIsQ0FBQyxjQUFjLEVBQUUsYUFBYSxvQ0FBNEIsQ0FBQyJ9