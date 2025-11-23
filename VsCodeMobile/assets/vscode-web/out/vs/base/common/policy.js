/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../nls.js';
/**
 * System-wide policy file path for Linux systems.
 */
export const LINUX_SYSTEM_POLICY_FILE_PATH = '/etc/vscode/policy.json';
export var PolicyCategory;
(function (PolicyCategory) {
    PolicyCategory["Extensions"] = "Extensions";
    PolicyCategory["IntegratedTerminal"] = "IntegratedTerminal";
    PolicyCategory["InteractiveSession"] = "InteractiveSession";
    PolicyCategory["Telemetry"] = "Telemetry";
    PolicyCategory["Update"] = "Update";
})(PolicyCategory || (PolicyCategory = {}));
export const PolicyCategoryData = {
    [PolicyCategory.Extensions]: {
        name: {
            key: 'extensionsConfigurationTitle', value: localize('extensionsConfigurationTitle', "Extensions"),
        }
    },
    [PolicyCategory.IntegratedTerminal]: {
        name: {
            key: 'terminalIntegratedConfigurationTitle', value: localize('terminalIntegratedConfigurationTitle', "Integrated Terminal"),
        }
    },
    [PolicyCategory.InteractiveSession]: {
        name: {
            key: 'interactiveSessionConfigurationTitle', value: localize('interactiveSessionConfigurationTitle', "Chat"),
        }
    },
    [PolicyCategory.Telemetry]: {
        name: {
            key: 'telemetryConfigurationTitle', value: localize('telemetryConfigurationTitle', "Telemetry"),
        }
    },
    [PolicyCategory.Update]: {
        name: {
            key: 'updateConfigurationTitle', value: localize('updateConfigurationTitle', "Update"),
        }
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9saWN5LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvY29tbW9uL3BvbGljeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBR3hDOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sNkJBQTZCLEdBQUcseUJBQXlCLENBQUM7QUFRdkUsTUFBTSxDQUFOLElBQVksY0FNWDtBQU5ELFdBQVksY0FBYztJQUN6QiwyQ0FBeUIsQ0FBQTtJQUN6QiwyREFBeUMsQ0FBQTtJQUN6QywyREFBeUMsQ0FBQTtJQUN6Qyx5Q0FBdUIsQ0FBQTtJQUN2QixtQ0FBaUIsQ0FBQTtBQUNsQixDQUFDLEVBTlcsY0FBYyxLQUFkLGNBQWMsUUFNekI7QUFFRCxNQUFNLENBQUMsTUFBTSxrQkFBa0IsR0FFM0I7SUFDSCxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRTtRQUM1QixJQUFJLEVBQUU7WUFDTCxHQUFHLEVBQUUsOEJBQThCLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyw4QkFBOEIsRUFBRSxZQUFZLENBQUM7U0FDbEc7S0FDRDtJQUNELENBQUMsY0FBYyxDQUFDLGtCQUFrQixDQUFDLEVBQUU7UUFDcEMsSUFBSSxFQUFFO1lBQ0wsR0FBRyxFQUFFLHNDQUFzQyxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsc0NBQXNDLEVBQUUscUJBQXFCLENBQUM7U0FDM0g7S0FDRDtJQUNELENBQUMsY0FBYyxDQUFDLGtCQUFrQixDQUFDLEVBQUU7UUFDcEMsSUFBSSxFQUFFO1lBQ0wsR0FBRyxFQUFFLHNDQUFzQyxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsc0NBQXNDLEVBQUUsTUFBTSxDQUFDO1NBQzVHO0tBQ0Q7SUFDRCxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsRUFBRTtRQUMzQixJQUFJLEVBQUU7WUFDTCxHQUFHLEVBQUUsNkJBQTZCLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyw2QkFBNkIsRUFBRSxXQUFXLENBQUM7U0FDL0Y7S0FDRDtJQUNELENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1FBQ3hCLElBQUksRUFBRTtZQUNMLEdBQUcsRUFBRSwwQkFBMEIsRUFBRSxLQUFLLEVBQUUsUUFBUSxDQUFDLDBCQUEwQixFQUFFLFFBQVEsQ0FBQztTQUN0RjtLQUNEO0NBQ0QsQ0FBQyJ9