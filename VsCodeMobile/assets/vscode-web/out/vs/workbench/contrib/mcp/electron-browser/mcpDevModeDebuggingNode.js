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
import { timeout } from '../../../../base/common/async.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { INativeHostService } from '../../../../platform/native/common/native.js';
import { IDebugService } from '../../debug/common/debug.js';
import { McpDevModeDebugging } from '../common/mcpDevMode.js';
let McpDevModeDebuggingNode = class McpDevModeDebuggingNode extends McpDevModeDebugging {
    constructor(debugService, commandService, _nativeHostService) {
        super(debugService, commandService);
        this._nativeHostService = _nativeHostService;
    }
    async ensureListeningOnPort(port) {
        const deadline = Date.now() + 30_000;
        while (await this._nativeHostService.isPortFree(port) && Date.now() < deadline) {
            await timeout(50);
        }
    }
    getDebugPort() {
        return this._nativeHostService.findFreePort(5000, 10 /* try 10 ports */, 5000 /* try up to 5 seconds */, 2048 /* skip 2048 ports between attempts */);
    }
};
McpDevModeDebuggingNode = __decorate([
    __param(0, IDebugService),
    __param(1, ICommandService),
    __param(2, INativeHostService)
], McpDevModeDebuggingNode);
export { McpDevModeDebuggingNode };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwRGV2TW9kZURlYnVnZ2luZ05vZGUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2VsZWN0cm9uLWJyb3dzZXIvbWNwRGV2TW9kZURlYnVnZ2luZ05vZGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNuRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNsRixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDNUQsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFFdkQsSUFBTSx1QkFBdUIsR0FBN0IsTUFBTSx1QkFBd0IsU0FBUSxtQkFBbUI7SUFDL0QsWUFDZ0IsWUFBMkIsRUFDekIsY0FBK0IsRUFDWCxrQkFBc0M7UUFFM0UsS0FBSyxDQUFDLFlBQVksRUFBRSxjQUFjLENBQUMsQ0FBQztRQUZDLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBb0I7SUFHNUUsQ0FBQztJQUVrQixLQUFLLENBQUMscUJBQXFCLENBQUMsSUFBWTtRQUMxRCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsTUFBTSxDQUFDO1FBQ3JDLE9BQU8sTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxRQUFRLEVBQUUsQ0FBQztZQUNoRixNQUFNLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNuQixDQUFDO0lBQ0YsQ0FBQztJQUVrQixZQUFZO1FBQzlCLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixFQUFFLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxJQUFJLENBQUMsc0NBQXNDLENBQUMsQ0FBQztJQUN2SixDQUFDO0NBQ0QsQ0FBQTtBQW5CWSx1QkFBdUI7SUFFakMsV0FBQSxhQUFhLENBQUE7SUFDYixXQUFBLGVBQWUsQ0FBQTtJQUNmLFdBQUEsa0JBQWtCLENBQUE7R0FKUix1QkFBdUIsQ0FtQm5DIn0=