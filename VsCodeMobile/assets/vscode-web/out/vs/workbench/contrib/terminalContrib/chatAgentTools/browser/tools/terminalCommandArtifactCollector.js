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
import { ITerminalLogService } from '../../../../../../platform/terminal/common/terminal.js';
let TerminalCommandArtifactCollector = class TerminalCommandArtifactCollector {
    constructor(_logService) {
        this._logService = _logService;
    }
    async capture(toolSpecificData, instance, commandId) {
        if (commandId) {
            try {
                toolSpecificData.terminalCommandUri = this._createTerminalCommandUri(instance, commandId);
            }
            catch (error) {
                this._logService.warn(`RunInTerminalTool: Failed to create terminal command URI for ${commandId}`, error);
            }
            const command = await this._tryGetCommand(instance, commandId);
            if (command) {
                toolSpecificData.terminalCommandState = {
                    exitCode: command.exitCode,
                    timestamp: command.timestamp,
                    duration: command.duration
                };
                this._applyTheme(toolSpecificData, instance);
                return;
            }
        }
        this._applyTheme(toolSpecificData, instance);
    }
    _applyTheme(toolSpecificData, instance) {
        const theme = instance.xterm?.getXtermTheme();
        if (theme) {
            toolSpecificData.terminalTheme = { background: theme.background, foreground: theme.foreground };
        }
    }
    _createTerminalCommandUri(instance, commandId) {
        const params = new URLSearchParams(instance.resource.query);
        params.set('command', commandId);
        return instance.resource.with({ query: params.toString() });
    }
    async _tryGetCommand(instance, commandId) {
        const commandDetection = instance.capabilities.get(2 /* TerminalCapability.CommandDetection */);
        return commandDetection?.commands.find(c => c.id === commandId);
    }
};
TerminalCommandArtifactCollector = __decorate([
    __param(0, ITerminalLogService)
], TerminalCommandArtifactCollector);
export { TerminalCommandArtifactCollector };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDb21tYW5kQXJ0aWZhY3RDb2xsZWN0b3IuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL2Jyb3dzZXIvdG9vbHMvdGVybWluYWxDb21tYW5kQXJ0aWZhY3RDb2xsZWN0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFNaEcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFFdEYsSUFBTSxnQ0FBZ0MsR0FBdEMsTUFBTSxnQ0FBZ0M7SUFDNUMsWUFDdUMsV0FBZ0M7UUFBaEMsZ0JBQVcsR0FBWCxXQUFXLENBQXFCO0lBQ25FLENBQUM7SUFFTCxLQUFLLENBQUMsT0FBTyxDQUNaLGdCQUFpRCxFQUNqRCxRQUEyQixFQUMzQixTQUE2QjtRQUU3QixJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2YsSUFBSSxDQUFDO2dCQUNKLGdCQUFnQixDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDM0YsQ0FBQztZQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7Z0JBQ2hCLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGdFQUFnRSxTQUFTLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUMzRyxDQUFDO1lBRUQsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUMvRCxJQUFJLE9BQU8sRUFBRSxDQUFDO2dCQUNiLGdCQUFnQixDQUFDLG9CQUFvQixHQUFHO29CQUN2QyxRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7b0JBQzFCLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUztvQkFDNUIsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRO2lCQUMxQixDQUFDO2dCQUNGLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQzdDLE9BQU87WUFDUixDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQUVPLFdBQVcsQ0FBQyxnQkFBaUQsRUFBRSxRQUEyQjtRQUNqRyxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsS0FBSyxFQUFFLGFBQWEsRUFBRSxDQUFDO1FBQzlDLElBQUksS0FBSyxFQUFFLENBQUM7WUFDWCxnQkFBZ0IsQ0FBQyxhQUFhLEdBQUcsRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLFVBQVUsRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2pHLENBQUM7SUFDRixDQUFDO0lBRU8seUJBQXlCLENBQUMsUUFBMkIsRUFBRSxTQUFpQjtRQUMvRSxNQUFNLE1BQU0sR0FBRyxJQUFJLGVBQWUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzVELE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ2pDLE9BQU8sUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUM3RCxDQUFDO0lBRU8sS0FBSyxDQUFDLGNBQWMsQ0FBQyxRQUEyQixFQUFFLFNBQWlCO1FBQzFFLE1BQU0sZ0JBQWdCLEdBQUcsUUFBUSxDQUFDLFlBQVksQ0FBQyxHQUFHLDZDQUFxQyxDQUFDO1FBQ3hGLE9BQU8sZ0JBQWdCLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssU0FBUyxDQUFDLENBQUM7SUFDakUsQ0FBQztDQUNELENBQUE7QUFqRFksZ0NBQWdDO0lBRTFDLFdBQUEsbUJBQW1CLENBQUE7R0FGVCxnQ0FBZ0MsQ0FpRDVDIn0=