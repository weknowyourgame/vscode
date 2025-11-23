/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export var OutputMonitorState;
(function (OutputMonitorState) {
    OutputMonitorState["Initial"] = "Initial";
    OutputMonitorState["Idle"] = "Idle";
    OutputMonitorState["PollingForIdle"] = "PollingForIdle";
    OutputMonitorState["Prompting"] = "Prompting";
    OutputMonitorState["Timeout"] = "Timeout";
    OutputMonitorState["Active"] = "Active";
    OutputMonitorState["Cancelled"] = "Cancelled";
})(OutputMonitorState || (OutputMonitorState = {}));
export var PollingConsts;
(function (PollingConsts) {
    PollingConsts[PollingConsts["MinIdleEvents"] = 2] = "MinIdleEvents";
    PollingConsts[PollingConsts["MinPollingDuration"] = 500] = "MinPollingDuration";
    PollingConsts[PollingConsts["FirstPollingMaxDuration"] = 20000] = "FirstPollingMaxDuration";
    PollingConsts[PollingConsts["ExtendedPollingMaxDuration"] = 120000] = "ExtendedPollingMaxDuration";
    PollingConsts[PollingConsts["MaxPollingIntervalDuration"] = 2000] = "MaxPollingIntervalDuration";
    PollingConsts[PollingConsts["MaxRecursionCount"] = 5] = "MaxRecursionCount";
})(PollingConsts || (PollingConsts = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL2Jyb3dzZXIvdG9vbHMvbW9uaXRvcmluZy90eXBlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQThCaEcsTUFBTSxDQUFOLElBQVksa0JBUVg7QUFSRCxXQUFZLGtCQUFrQjtJQUM3Qix5Q0FBbUIsQ0FBQTtJQUNuQixtQ0FBYSxDQUFBO0lBQ2IsdURBQWlDLENBQUE7SUFDakMsNkNBQXVCLENBQUE7SUFDdkIseUNBQW1CLENBQUE7SUFDbkIsdUNBQWlCLENBQUE7SUFDakIsNkNBQXVCLENBQUE7QUFDeEIsQ0FBQyxFQVJXLGtCQUFrQixLQUFsQixrQkFBa0IsUUFRN0I7QUFTRCxNQUFNLENBQU4sSUFBa0IsYUFPakI7QUFQRCxXQUFrQixhQUFhO0lBQzlCLG1FQUFpQixDQUFBO0lBQ2pCLCtFQUF3QixDQUFBO0lBQ3hCLDJGQUErQixDQUFBO0lBQy9CLGtHQUFtQyxDQUFBO0lBQ25DLGdHQUFpQyxDQUFBO0lBQ2pDLDJFQUFxQixDQUFBO0FBQ3RCLENBQUMsRUFQaUIsYUFBYSxLQUFiLGFBQWEsUUFPOUIifQ==