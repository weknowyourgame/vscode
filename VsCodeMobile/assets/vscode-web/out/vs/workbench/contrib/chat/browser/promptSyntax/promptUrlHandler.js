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
import { streamToBuffer, VSBuffer } from '../../../../../base/common/buffer.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IRequestService } from '../../../../../platform/request/common/request.js';
import { IURLService } from '../../../../../platform/url/common/url.js';
import { askForPromptFileName } from './pickers/askForPromptName.js';
import { askForPromptSourceFolder } from './pickers/askForPromptSourceFolder.js';
import { getCleanPromptName } from '../../common/promptSyntax/config/promptFileLocations.js';
import { PromptsType } from '../../common/promptSyntax/promptTypes.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { localize } from '../../../../../nls.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { Schemas } from '../../../../../base/common/network.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { mainWindow } from '../../../../../base/browser/window.js';
// example URL: code-oss:chat-prompt/install?url=https://gist.githubusercontent.com/aeschli/43fe78babd5635f062aef0195a476aad/raw/dfd71f60058a4dd25f584b55de3e20f5fd580e63/filterEvenNumbers.prompt.md
let PromptUrlHandler = class PromptUrlHandler extends Disposable {
    static { this.ID = 'workbench.contrib.promptUrlHandler'; }
    constructor(urlService, notificationService, requestService, instantiationService, fileService, openerService, logService, dialogService, hostService) {
        super();
        this.notificationService = notificationService;
        this.requestService = requestService;
        this.instantiationService = instantiationService;
        this.fileService = fileService;
        this.openerService = openerService;
        this.logService = logService;
        this.dialogService = dialogService;
        this.hostService = hostService;
        this._register(urlService.registerHandler(this));
    }
    async handleURL(uri) {
        let promptType;
        switch (uri.path) {
            case 'chat-prompt/install':
                promptType = PromptsType.prompt;
                break;
            case 'chat-instructions/install':
                promptType = PromptsType.instructions;
                break;
            case 'chat-mode/install':
            case 'chat-agent/install':
                promptType = PromptsType.agent;
                break;
            default:
                return false;
        }
        try {
            const query = decodeURIComponent(uri.query);
            if (!query || !query.startsWith('url=')) {
                return true;
            }
            const urlString = query.substring(4);
            const url = URI.parse(urlString);
            if (url.scheme !== Schemas.https && url.scheme !== Schemas.http) {
                this.logService.error(`[PromptUrlHandler] Invalid URL: ${urlString}`);
                return true;
            }
            await this.hostService.focus(mainWindow);
            if (await this.shouldBlockInstall(promptType, url)) {
                return true;
            }
            const result = await this.requestService.request({ type: 'GET', url: urlString }, CancellationToken.None);
            if (result.res.statusCode !== 200) {
                this.logService.error(`[PromptUrlHandler] Failed to fetch URL: ${urlString}`);
                this.notificationService.error(localize('failed', 'Failed to fetch URL: {0}', urlString));
                return true;
            }
            const responseData = (await streamToBuffer(result.stream)).toString();
            const newFolder = await this.instantiationService.invokeFunction(askForPromptSourceFolder, promptType);
            if (!newFolder) {
                return true;
            }
            const newName = await this.instantiationService.invokeFunction(askForPromptFileName, promptType, newFolder.uri, getCleanPromptName(url));
            if (!newName) {
                return true;
            }
            const promptUri = URI.joinPath(newFolder.uri, newName);
            await this.fileService.createFolder(newFolder.uri);
            await this.fileService.createFile(promptUri, VSBuffer.fromString(responseData));
            await this.openerService.open(promptUri);
            return true;
        }
        catch (error) {
            this.logService.error(`Error handling prompt URL ${uri.toString()}`, error);
            return true;
        }
    }
    async shouldBlockInstall(promptType, url) {
        let uriLabel = url.toString();
        if (uriLabel.length > 50) {
            uriLabel = `${uriLabel.substring(0, 35)}...${uriLabel.substring(uriLabel.length - 15)}`;
        }
        const detail = new MarkdownString('', { supportHtml: true });
        detail.appendMarkdown(localize('confirmOpenDetail2', "This will access {0}.\n\n", `[${uriLabel}](${url.toString()})`));
        detail.appendMarkdown(localize('confirmOpenDetail3', "If you did not initiate this request, it may represent an attempted attack on your system. Unless you took an explicit action to initiate this request, you should press 'No'"));
        let message;
        switch (promptType) {
            case PromptsType.prompt:
                message = localize('confirmInstallPrompt', "An external application wants to create a prompt file with content from a URL. Do you want to continue by selecting a destination folder and name?");
                break;
            case PromptsType.instructions:
                message = localize('confirmInstallInstructions', "An external application wants to create an instructions file with content from a URL. Do you want to continue by selecting a destination folder and name?");
                break;
            default:
                message = localize('confirmInstallAgent', "An external application wants to create a custom agent with content from a URL. Do you want to continue by selecting a destination folder and name?");
                break;
        }
        const { confirmed } = await this.dialogService.confirm({
            type: 'warning',
            primaryButton: localize({ key: 'yesButton', comment: ['&& denotes a mnemonic'] }, "&&Yes"),
            cancelButton: localize('noButton', "No"),
            message,
            custom: {
                markdownDetails: [{
                        markdown: detail
                    }]
            }
        });
        return !confirmed;
    }
};
PromptUrlHandler = __decorate([
    __param(0, IURLService),
    __param(1, INotificationService),
    __param(2, IRequestService),
    __param(3, IInstantiationService),
    __param(4, IFileService),
    __param(5, IOpenerService),
    __param(6, ILogService),
    __param(7, IDialogService),
    __param(8, IHostService)
], PromptUrlHandler);
export { PromptUrlHandler };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0VXJsSGFuZGxlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvcHJvbXB0U3ludGF4L3Byb21wdFVybEhhbmRsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMvRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUM3RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0saURBQWlELENBQUM7QUFDakYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3BGLE9BQU8sRUFBZSxXQUFXLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUVyRixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUNyRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNqRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM3RixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDdkUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbkYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDekUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBRW5FLHFNQUFxTTtBQUU5TCxJQUFNLGdCQUFnQixHQUF0QixNQUFNLGdCQUFpQixTQUFRLFVBQVU7YUFFL0IsT0FBRSxHQUFHLG9DQUFvQyxBQUF2QyxDQUF3QztJQUUxRCxZQUNjLFVBQXVCLEVBQ0csbUJBQXlDLEVBQzlDLGNBQStCLEVBQ3pCLG9CQUEyQyxFQUNwRCxXQUF5QixFQUN2QixhQUE2QixFQUNoQyxVQUF1QixFQUNwQixhQUE2QixFQUUvQixXQUF5QjtRQUV4RCxLQUFLLEVBQUUsQ0FBQztRQVYrQix3QkFBbUIsR0FBbkIsbUJBQW1CLENBQXNCO1FBQzlDLG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUN6Qix5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXVCO1FBQ3BELGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBQ3ZCLGtCQUFhLEdBQWIsYUFBYSxDQUFnQjtRQUNoQyxlQUFVLEdBQVYsVUFBVSxDQUFhO1FBQ3BCLGtCQUFhLEdBQWIsYUFBYSxDQUFnQjtRQUUvQixnQkFBVyxHQUFYLFdBQVcsQ0FBYztRQUd4RCxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNsRCxDQUFDO0lBRUQsS0FBSyxDQUFDLFNBQVMsQ0FBQyxHQUFRO1FBQ3ZCLElBQUksVUFBbUMsQ0FBQztRQUN4QyxRQUFRLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNsQixLQUFLLHFCQUFxQjtnQkFDekIsVUFBVSxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUM7Z0JBQ2hDLE1BQU07WUFDUCxLQUFLLDJCQUEyQjtnQkFDL0IsVUFBVSxHQUFHLFdBQVcsQ0FBQyxZQUFZLENBQUM7Z0JBQ3RDLE1BQU07WUFDUCxLQUFLLG1CQUFtQixDQUFDO1lBQ3pCLEtBQUssb0JBQW9CO2dCQUN4QixVQUFVLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQztnQkFDL0IsTUFBTTtZQUNQO2dCQUNDLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUVELElBQUksQ0FBQztZQUNKLE1BQU0sS0FBSyxHQUFHLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM1QyxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO2dCQUN6QyxPQUFPLElBQUksQ0FBQztZQUNiLENBQUM7WUFFRCxNQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3JDLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDakMsSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLE9BQU8sQ0FBQyxLQUFLLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ2pFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO2dCQUN0RSxPQUFPLElBQUksQ0FBQztZQUNiLENBQUM7WUFFRCxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBRXpDLElBQUksTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ3BELE9BQU8sSUFBSSxDQUFDO1lBQ2IsQ0FBQztZQUVELE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMxRyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBVSxLQUFLLEdBQUcsRUFBRSxDQUFDO2dCQUNuQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQywyQ0FBMkMsU0FBUyxFQUFFLENBQUMsQ0FBQztnQkFDOUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLDBCQUEwQixFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQzFGLE9BQU8sSUFBSSxDQUFDO1lBQ2IsQ0FBQztZQUVELE1BQU0sWUFBWSxHQUFHLENBQUMsTUFBTSxjQUFjLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7WUFFdEUsTUFBTSxTQUFTLEdBQUcsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLHdCQUF3QixFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQ3ZHLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDaEIsT0FBTyxJQUFJLENBQUM7WUFDYixDQUFDO1lBRUQsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLG9CQUFvQixFQUFFLFVBQVUsRUFBRSxTQUFTLENBQUMsR0FBRyxFQUFFLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDekksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNkLE9BQU8sSUFBSSxDQUFDO1lBQ2IsQ0FBQztZQUVELE1BQU0sU0FBUyxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUV2RCxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNuRCxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7WUFFaEYsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN6QyxPQUFPLElBQUksQ0FBQztRQUViLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLDZCQUE2QixHQUFHLENBQUMsUUFBUSxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUM1RSxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7SUFDRixDQUFDO0lBRU8sS0FBSyxDQUFDLGtCQUFrQixDQUFDLFVBQXVCLEVBQUUsR0FBUTtRQUNqRSxJQUFJLFFBQVEsR0FBRyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDOUIsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLEVBQUUsRUFBRSxDQUFDO1lBQzFCLFFBQVEsR0FBRyxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxNQUFNLFFBQVEsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDO1FBQ3pGLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxJQUFJLGNBQWMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUM3RCxNQUFNLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSwyQkFBMkIsRUFBRSxJQUFJLFFBQVEsS0FBSyxHQUFHLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdkgsTUFBTSxDQUFDLGNBQWMsQ0FBQyxRQUFRLENBQUMsb0JBQW9CLEVBQUUsK0tBQStLLENBQUMsQ0FBQyxDQUFDO1FBRXZPLElBQUksT0FBZSxDQUFDO1FBQ3BCLFFBQVEsVUFBVSxFQUFFLENBQUM7WUFDcEIsS0FBSyxXQUFXLENBQUMsTUFBTTtnQkFDdEIsT0FBTyxHQUFHLFFBQVEsQ0FBQyxzQkFBc0IsRUFBRSxvSkFBb0osQ0FBQyxDQUFDO2dCQUNqTSxNQUFNO1lBQ1AsS0FBSyxXQUFXLENBQUMsWUFBWTtnQkFDNUIsT0FBTyxHQUFHLFFBQVEsQ0FBQyw0QkFBNEIsRUFBRSwySkFBMkosQ0FBQyxDQUFDO2dCQUM5TSxNQUFNO1lBQ1A7Z0JBQ0MsT0FBTyxHQUFHLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSxxSkFBcUosQ0FBQyxDQUFDO2dCQUNqTSxNQUFNO1FBQ1IsQ0FBQztRQUVELE1BQU0sRUFBRSxTQUFTLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDO1lBQ3RELElBQUksRUFBRSxTQUFTO1lBQ2YsYUFBYSxFQUFFLFFBQVEsQ0FBQyxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLENBQUMsdUJBQXVCLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQztZQUMxRixZQUFZLEVBQUUsUUFBUSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUM7WUFDeEMsT0FBTztZQUNQLE1BQU0sRUFBRTtnQkFDUCxlQUFlLEVBQUUsQ0FBQzt3QkFDakIsUUFBUSxFQUFFLE1BQU07cUJBQ2hCLENBQUM7YUFDRjtTQUNELENBQUMsQ0FBQztRQUVILE9BQU8sQ0FBQyxTQUFTLENBQUM7SUFFbkIsQ0FBQzs7QUE5SFcsZ0JBQWdCO0lBSzFCLFdBQUEsV0FBVyxDQUFBO0lBQ1gsV0FBQSxvQkFBb0IsQ0FBQTtJQUNwQixXQUFBLGVBQWUsQ0FBQTtJQUNmLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxZQUFZLENBQUE7SUFDWixXQUFBLGNBQWMsQ0FBQTtJQUNkLFdBQUEsV0FBVyxDQUFBO0lBQ1gsV0FBQSxjQUFjLENBQUE7SUFFZCxXQUFBLFlBQVksQ0FBQTtHQWRGLGdCQUFnQixDQStINUIifQ==