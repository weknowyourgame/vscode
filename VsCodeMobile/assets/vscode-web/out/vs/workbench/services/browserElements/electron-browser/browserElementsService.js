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
import { INativeBrowserElementsService } from '../../../../platform/browserElements/common/browserElements.js';
import { ipcRenderer } from '../../../../base/parts/sandbox/electron-browser/globals.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IBrowserElementsService } from '../browser/browserElementsService.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { INativeWorkbenchEnvironmentService } from '../../environment/electron-browser/environmentService.js';
import { NativeBrowserElementsService } from '../../../../platform/browserElements/common/nativeBrowserElementsService.js';
let WorkbenchNativeBrowserElementsService = class WorkbenchNativeBrowserElementsService extends NativeBrowserElementsService {
    constructor(environmentService, mainProcessService) {
        super(environmentService.window.id, mainProcessService);
    }
};
WorkbenchNativeBrowserElementsService = __decorate([
    __param(0, INativeWorkbenchEnvironmentService),
    __param(1, IMainProcessService)
], WorkbenchNativeBrowserElementsService);
let cancelSelectionIdPool = 0;
let cancelAndDetachIdPool = 0;
let WorkbenchBrowserElementsService = class WorkbenchBrowserElementsService {
    constructor(simpleBrowser) {
        this.simpleBrowser = simpleBrowser;
    }
    async startDebugSession(token, browserType) {
        const cancelAndDetachId = cancelAndDetachIdPool++;
        const onCancelChannel = `vscode:cancelCurrentSession${cancelAndDetachId}`;
        const disposable = token.onCancellationRequested(() => {
            ipcRenderer.send(onCancelChannel, cancelAndDetachId);
            disposable.dispose();
        });
        try {
            await this.simpleBrowser.startDebugSession(token, browserType, cancelAndDetachId);
        }
        catch (error) {
            disposable.dispose();
            throw new Error('No debug session target found', error);
        }
    }
    async getElementData(rect, token, browserType) {
        if (!browserType) {
            return undefined;
        }
        const cancelSelectionId = cancelSelectionIdPool++;
        const onCancelChannel = `vscode:cancelElementSelection${cancelSelectionId}`;
        const disposable = token.onCancellationRequested(() => {
            ipcRenderer.send(onCancelChannel, cancelSelectionId);
        });
        try {
            const elementData = await this.simpleBrowser.getElementData(rect, token, browserType, cancelSelectionId);
            return elementData;
        }
        catch (error) {
            disposable.dispose();
            throw new Error(`Native Host: Error getting element data: ${error}`);
        }
        finally {
            disposable.dispose();
        }
    }
};
WorkbenchBrowserElementsService = __decorate([
    __param(0, INativeBrowserElementsService)
], WorkbenchBrowserElementsService);
registerSingleton(IBrowserElementsService, WorkbenchBrowserElementsService, 1 /* InstantiationType.Delayed */);
registerSingleton(INativeBrowserElementsService, WorkbenchNativeBrowserElementsService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJvd3NlckVsZW1lbnRzU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvYnJvd3NlckVsZW1lbnRzL2VsZWN0cm9uLWJyb3dzZXIvYnJvd3NlckVsZW1lbnRzU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQTZCLDZCQUE2QixFQUFFLE1BQU0sZ0VBQWdFLENBQUM7QUFFMUksT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRXpGLE9BQU8sRUFBRSxpQkFBaUIsRUFBcUIsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMvRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUM1RixPQUFPLEVBQUUsa0NBQWtDLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUM5RyxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSw2RUFBNkUsQ0FBQztBQUUzSCxJQUFNLHFDQUFxQyxHQUEzQyxNQUFNLHFDQUFzQyxTQUFRLDRCQUE0QjtJQUUvRSxZQUNxQyxrQkFBc0QsRUFDckUsa0JBQXVDO1FBRTVELEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLGtCQUFrQixDQUFDLENBQUM7SUFDekQsQ0FBQztDQUNELENBQUE7QUFSSyxxQ0FBcUM7SUFHeEMsV0FBQSxrQ0FBa0MsQ0FBQTtJQUNsQyxXQUFBLG1CQUFtQixDQUFBO0dBSmhCLHFDQUFxQyxDQVExQztBQUVELElBQUkscUJBQXFCLEdBQUcsQ0FBQyxDQUFDO0FBQzlCLElBQUkscUJBQXFCLEdBQUcsQ0FBQyxDQUFDO0FBRTlCLElBQU0sK0JBQStCLEdBQXJDLE1BQU0sK0JBQStCO0lBR3BDLFlBQ2lELGFBQTRDO1FBQTVDLGtCQUFhLEdBQWIsYUFBYSxDQUErQjtJQUN6RixDQUFDO0lBRUwsS0FBSyxDQUFDLGlCQUFpQixDQUFDLEtBQXdCLEVBQUUsV0FBd0I7UUFDekUsTUFBTSxpQkFBaUIsR0FBRyxxQkFBcUIsRUFBRSxDQUFDO1FBQ2xELE1BQU0sZUFBZSxHQUFHLDhCQUE4QixpQkFBaUIsRUFBRSxDQUFDO1FBRTFFLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLEVBQUU7WUFDckQsV0FBVyxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztZQUNyRCxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDdEIsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUM7WUFDSixNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLFdBQVcsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1FBQ25GLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2hCLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNyQixNQUFNLElBQUksS0FBSyxDQUFDLCtCQUErQixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3pELENBQUM7SUFDRixDQUFDO0lBRUQsS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFnQixFQUFFLEtBQXdCLEVBQUUsV0FBb0M7UUFDcEcsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ2xCLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFDRCxNQUFNLGlCQUFpQixHQUFHLHFCQUFxQixFQUFFLENBQUM7UUFDbEQsTUFBTSxlQUFlLEdBQUcsZ0NBQWdDLGlCQUFpQixFQUFFLENBQUM7UUFDNUUsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLHVCQUF1QixDQUFDLEdBQUcsRUFBRTtZQUNyRCxXQUFXLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3RELENBQUMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDO1lBQ0osTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1lBQ3pHLE9BQU8sV0FBVyxDQUFDO1FBQ3BCLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2hCLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNyQixNQUFNLElBQUksS0FBSyxDQUFDLDRDQUE0QyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQ3RFLENBQUM7Z0JBQVMsQ0FBQztZQUNWLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN0QixDQUFDO0lBQ0YsQ0FBQztDQUNELENBQUE7QUExQ0ssK0JBQStCO0lBSWxDLFdBQUEsNkJBQTZCLENBQUE7R0FKMUIsK0JBQStCLENBMENwQztBQUVELGlCQUFpQixDQUFDLHVCQUF1QixFQUFFLCtCQUErQixvQ0FBNEIsQ0FBQztBQUN2RyxpQkFBaUIsQ0FBQyw2QkFBNkIsRUFBRSxxQ0FBcUMsb0NBQTRCLENBQUMifQ==