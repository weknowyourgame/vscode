/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as platform from '../../../base/common/platform.js';
export const ASSIGNMENT_STORAGE_KEY = 'VSCode.ABExp.FeatureData';
export const ASSIGNMENT_REFETCH_INTERVAL = 60 * 60 * 1000; // 1 hour
export var TargetPopulation;
(function (TargetPopulation) {
    TargetPopulation["Insiders"] = "insider";
    TargetPopulation["Public"] = "public";
    TargetPopulation["Exploration"] = "exploration";
})(TargetPopulation || (TargetPopulation = {}));
/*
Based upon the official VSCode currently existing filters in the
ExP backend for the VSCode cluster.
https://experimentation.visualstudio.com/Analysis%20and%20Experimentation/_git/AnE.ExP.TAS.TachyonHost.Configuration?path=%2FConfigurations%2Fvscode%2Fvscode.json&version=GBmaster
"X-MSEdge-Market": "detection.market",
"X-FD-Corpnet": "detection.corpnet",
"X-VSCode-AppVersion": "appversion",
"X-VSCode-Build": "build",
"X-MSEdge-ClientId": "clientid",
"X-VSCode-ExtensionName": "extensionname",
"X-VSCode-ExtensionVersion": "extensionversion",
"X-VSCode-TargetPopulation": "targetpopulation",
"X-VSCode-Language": "language",
"X-VSCode-Platform": "platform",
"X-VSCode-ReleaseDate": "releasedate"
*/
export var Filters;
(function (Filters) {
    /**
     * The market in which the extension is distributed.
     */
    Filters["Market"] = "X-MSEdge-Market";
    /**
     * The corporation network.
     */
    Filters["CorpNet"] = "X-FD-Corpnet";
    /**
     * Version of the application which uses experimentation service.
     */
    Filters["ApplicationVersion"] = "X-VSCode-AppVersion";
    /**
     * Insiders vs Stable.
     */
    Filters["Build"] = "X-VSCode-Build";
    /**
     * Client Id which is used as primary unit for the experimentation.
     */
    Filters["ClientId"] = "X-MSEdge-ClientId";
    /**
     * Developer Device Id which can be used as an alternate unit for experimentation.
     */
    Filters["DeveloperDeviceId"] = "X-VSCode-DevDeviceId";
    /**
     * Extension header.
     */
    Filters["ExtensionName"] = "X-VSCode-ExtensionName";
    /**
     * The version of the extension.
     */
    Filters["ExtensionVersion"] = "X-VSCode-ExtensionVersion";
    /**
     * The language in use by VS Code
     */
    Filters["Language"] = "X-VSCode-Language";
    /**
     * The target population.
     * This is used to separate internal, early preview, GA, etc.
     */
    Filters["TargetPopulation"] = "X-VSCode-TargetPopulation";
    /**
     * The platform (OS) on which VS Code is running.
     */
    Filters["Platform"] = "X-VSCode-Platform";
    /**
     * The release/build date of VS Code (UTC) in the format yyyymmddHHMMSS.
     */
    Filters["ReleaseDate"] = "X-VSCode-ReleaseDate";
})(Filters || (Filters = {}));
export class AssignmentFilterProvider {
    constructor(version, appName, machineId, devDeviceId, targetPopulation, releaseDate) {
        this.version = version;
        this.appName = appName;
        this.machineId = machineId;
        this.devDeviceId = devDeviceId;
        this.targetPopulation = targetPopulation;
        this.releaseDate = releaseDate;
    }
    /**
     * Returns a version string that can be parsed by the TAS client.
     * The tas client cannot handle suffixes lke "-insider"
     * Ref: https://github.com/microsoft/tas-client/blob/30340d5e1da37c2789049fcf45928b954680606f/vscode-tas-client/src/vscode-tas-client/VSCodeFilterProvider.ts#L35
     *
     * @param version Version string to be trimmed.
    */
    static trimVersionSuffix(version) {
        const regex = /\-[a-zA-Z0-9]+$/;
        const result = version.split(regex);
        return result[0];
    }
    getFilterValue(filter) {
        switch (filter) {
            case Filters.ApplicationVersion:
                return AssignmentFilterProvider.trimVersionSuffix(this.version); // productService.version
            case Filters.Build:
                return this.appName; // productService.nameLong
            case Filters.ClientId:
                return this.machineId;
            case Filters.DeveloperDeviceId:
                return this.devDeviceId;
            case Filters.Language:
                return platform.language;
            case Filters.ExtensionName:
                return 'vscode-core'; // always return vscode-core for exp service
            case Filters.ExtensionVersion:
                return '999999.0'; // always return a very large number for cross-extension experimentation
            case Filters.TargetPopulation:
                return this.targetPopulation;
            case Filters.Platform:
                return platform.PlatformToString(platform.platform);
            case Filters.ReleaseDate:
                return AssignmentFilterProvider.formatReleaseDate(this.releaseDate);
            default:
                return '';
        }
    }
    static formatReleaseDate(iso) {
        // Expect ISO format, fall back to empty string if not provided
        if (!iso) {
            return '';
        }
        // Remove separators and milliseconds: YYYY-MM-DDTHH:MM:SS.sssZ -> YYYYMMDDHHMMSS
        const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})/.exec(iso);
        if (!match) {
            return '';
        }
        return match.slice(1, 7).join('');
    }
    getFilters() {
        const filters = new Map();
        const filterValues = Object.values(Filters);
        for (const value of filterValues) {
            filters.set(value, this.getFilterValue(value));
        }
        return filters;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzaWdubWVudC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9hc3NpZ25tZW50L2NvbW1vbi9hc3NpZ25tZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sS0FBSyxRQUFRLE1BQU0sa0NBQWtDLENBQUM7QUFHN0QsTUFBTSxDQUFDLE1BQU0sc0JBQXNCLEdBQUcsMEJBQTBCLENBQUM7QUFDakUsTUFBTSxDQUFDLE1BQU0sMkJBQTJCLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxTQUFTO0FBU3BFLE1BQU0sQ0FBTixJQUFZLGdCQUlYO0FBSkQsV0FBWSxnQkFBZ0I7SUFDM0Isd0NBQW9CLENBQUE7SUFDcEIscUNBQWlCLENBQUE7SUFDakIsK0NBQTJCLENBQUE7QUFDNUIsQ0FBQyxFQUpXLGdCQUFnQixLQUFoQixnQkFBZ0IsUUFJM0I7QUFFRDs7Ozs7Ozs7Ozs7Ozs7O0VBZUU7QUFDRixNQUFNLENBQU4sSUFBWSxPQTZEWDtBQTdERCxXQUFZLE9BQU87SUFDbEI7O09BRUc7SUFDSCxxQ0FBMEIsQ0FBQTtJQUUxQjs7T0FFRztJQUNILG1DQUF3QixDQUFBO0lBRXhCOztPQUVHO0lBQ0gscURBQTBDLENBQUE7SUFFMUM7O09BRUc7SUFDSCxtQ0FBd0IsQ0FBQTtJQUV4Qjs7T0FFRztJQUNILHlDQUE4QixDQUFBO0lBRTlCOztPQUVHO0lBQ0gscURBQTBDLENBQUE7SUFFMUM7O09BRUc7SUFDSCxtREFBd0MsQ0FBQTtJQUV4Qzs7T0FFRztJQUNILHlEQUE4QyxDQUFBO0lBRTlDOztPQUVHO0lBQ0gseUNBQThCLENBQUE7SUFFOUI7OztPQUdHO0lBQ0gseURBQThDLENBQUE7SUFFOUM7O09BRUc7SUFDSCx5Q0FBOEIsQ0FBQTtJQUU5Qjs7T0FFRztJQUNILCtDQUFvQyxDQUFBO0FBQ3JDLENBQUMs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