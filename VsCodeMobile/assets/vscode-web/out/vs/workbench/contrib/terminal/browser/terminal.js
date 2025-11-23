/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { isNumber } from '../../../../base/common/types.js';
export const ITerminalService = createDecorator('terminalService');
export const ITerminalConfigurationService = createDecorator('terminalConfigurationService');
export const ITerminalEditorService = createDecorator('terminalEditorService');
export const ITerminalEditingService = createDecorator('terminalEditingService');
export const ITerminalGroupService = createDecorator('terminalGroupService');
export const ITerminalInstanceService = createDecorator('terminalInstanceService');
export const ITerminalChatService = createDecorator('terminalChatService');
export var Direction;
(function (Direction) {
    Direction[Direction["Left"] = 0] = "Left";
    Direction[Direction["Right"] = 1] = "Right";
    Direction[Direction["Up"] = 2] = "Up";
    Direction[Direction["Down"] = 3] = "Down";
})(Direction || (Direction = {}));
export var TerminalConnectionState;
(function (TerminalConnectionState) {
    TerminalConnectionState[TerminalConnectionState["Connecting"] = 0] = "Connecting";
    TerminalConnectionState[TerminalConnectionState["Connected"] = 1] = "Connected";
})(TerminalConnectionState || (TerminalConnectionState = {}));
export const isDetachedTerminalInstance = (t) => !isNumber(t.instanceId);
export class TerminalLinkQuickPickEvent extends MouseEvent {
}
export const terminalEditorId = 'terminalEditor';
export var XtermTerminalConstants;
(function (XtermTerminalConstants) {
    XtermTerminalConstants[XtermTerminalConstants["SearchHighlightLimit"] = 20000] = "SearchHighlightLimit";
})(XtermTerminalConstants || (XtermTerminalConstants = {}));
export var LinuxDistro;
(function (LinuxDistro) {
    LinuxDistro[LinuxDistro["Unknown"] = 1] = "Unknown";
    LinuxDistro[LinuxDistro["Fedora"] = 2] = "Fedora";
    LinuxDistro[LinuxDistro["Ubuntu"] = 3] = "Ubuntu";
})(LinuxDistro || (LinuxDistro = {}));
export var TerminalDataTransfers;
(function (TerminalDataTransfers) {
    TerminalDataTransfers["Terminals"] = "Terminals";
})(TerminalDataTransfers || (TerminalDataTransfers = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQVNoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNERBQTRELENBQUM7QUF3QjdGLE9BQU8sRUFBRSxRQUFRLEVBQXFCLE1BQU0sa0NBQWtDLENBQUM7QUFFL0UsTUFBTSxDQUFDLE1BQU0sZ0JBQWdCLEdBQUcsZUFBZSxDQUFtQixpQkFBaUIsQ0FBQyxDQUFDO0FBQ3JGLE1BQU0sQ0FBQyxNQUFNLDZCQUE2QixHQUFHLGVBQWUsQ0FBZ0MsOEJBQThCLENBQUMsQ0FBQztBQUM1SCxNQUFNLENBQUMsTUFBTSxzQkFBc0IsR0FBRyxlQUFlLENBQXlCLHVCQUF1QixDQUFDLENBQUM7QUFDdkcsTUFBTSxDQUFDLE1BQU0sdUJBQXVCLEdBQUcsZUFBZSxDQUEwQix3QkFBd0IsQ0FBQyxDQUFDO0FBQzFHLE1BQU0sQ0FBQyxNQUFNLHFCQUFxQixHQUFHLGVBQWUsQ0FBd0Isc0JBQXNCLENBQUMsQ0FBQztBQUNwRyxNQUFNLENBQUMsTUFBTSx3QkFBd0IsR0FBRyxlQUFlLENBQTJCLHlCQUF5QixDQUFDLENBQUM7QUFDN0csTUFBTSxDQUFDLE1BQU0sb0JBQW9CLEdBQUcsZUFBZSxDQUF1QixxQkFBcUIsQ0FBQyxDQUFDO0FBMk5qRyxNQUFNLENBQU4sSUFBa0IsU0FLakI7QUFMRCxXQUFrQixTQUFTO0lBQzFCLHlDQUFRLENBQUE7SUFDUiwyQ0FBUyxDQUFBO0lBQ1QscUNBQU0sQ0FBQTtJQUNOLHlDQUFRLENBQUE7QUFDVCxDQUFDLEVBTGlCLFNBQVMsS0FBVCxTQUFTLFFBSzFCO0FBc0RELE1BQU0sQ0FBTixJQUFrQix1QkFHakI7QUFIRCxXQUFrQix1QkFBdUI7SUFDeEMsaUZBQVUsQ0FBQTtJQUNWLCtFQUFTLENBQUE7QUFDVixDQUFDLEVBSGlCLHVCQUF1QixLQUF2Qix1QkFBdUIsUUFHeEM7QUFvRkQsTUFBTSxDQUFDLE1BQU0sMEJBQTBCLEdBQUcsQ0FBQyxDQUFnRCxFQUFrQyxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUUsQ0FBdUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQThKL0ssTUFBTSxPQUFPLDBCQUEyQixTQUFRLFVBQVU7Q0FFekQ7QUF3QkQsTUFBTSxDQUFDLE1BQU0sZ0JBQWdCLEdBQUcsZ0JBQWdCLENBQUM7QUF3cEJqRCxNQUFNLENBQU4sSUFBa0Isc0JBRWpCO0FBRkQsV0FBa0Isc0JBQXNCO0lBQ3ZDLHVHQUE0QixDQUFBO0FBQzdCLENBQUMsRUFGaUIsc0JBQXNCLEtBQXRCLHNCQUFzQixRQUV2QztBQXVORCxNQUFNLENBQU4sSUFBa0IsV0FJakI7QUFKRCxXQUFrQixXQUFXO0lBQzVCLG1EQUFXLENBQUE7SUFDWCxpREFBVSxDQUFBO0lBQ1YsaURBQVUsQ0FBQTtBQUNYLENBQUMsRUFKaUIsV0FBVyxLQUFYLFdBQVcsUUFJNUI7QUFFRCxNQUFNLENBQU4sSUFBa0IscUJBRWpCO0FBRkQsV0FBa0IscUJBQXFCO0lBQ3RDLGdEQUF1QixDQUFBO0FBQ3hCLENBQUMsRUFGaUIscUJBQXFCLEtBQXJCLHFCQUFxQixRQUV0QyJ9