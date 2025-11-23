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
var ChatGettingStartedContribution_1;
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { IExtensionManagementService } from '../../../../../platform/extensionManagement/common/extensionManagement.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IChatWidgetService } from '../chat.js';
let ChatGettingStartedContribution = class ChatGettingStartedContribution extends Disposable {
    static { ChatGettingStartedContribution_1 = this; }
    static { this.ID = 'workbench.contrib.chatGettingStarted'; }
    static { this.hideWelcomeView = 'workbench.chat.hideWelcomeView'; }
    constructor(productService, extensionService, extensionManagementService, storageService, chatWidgetService) {
        super();
        this.productService = productService;
        this.extensionService = extensionService;
        this.extensionManagementService = extensionManagementService;
        this.storageService = storageService;
        this.chatWidgetService = chatWidgetService;
        this.recentlyInstalled = false;
        const defaultChatAgent = this.productService.defaultChatAgent;
        const hideWelcomeView = this.storageService.getBoolean(ChatGettingStartedContribution_1.hideWelcomeView, -1 /* StorageScope.APPLICATION */, false);
        if (!defaultChatAgent || hideWelcomeView) {
            return;
        }
        this.registerListeners(defaultChatAgent);
    }
    registerListeners(defaultChatAgent) {
        this._register(this.extensionManagementService.onDidInstallExtensions(async (result) => {
            for (const e of result) {
                if (ExtensionIdentifier.equals(defaultChatAgent.extensionId, e.identifier.id) && e.operation === 2 /* InstallOperation.Install */) {
                    this.recentlyInstalled = true;
                    return;
                }
            }
        }));
        this._register(this.extensionService.onDidChangeExtensionsStatus(async (event) => {
            for (const ext of event) {
                if (ExtensionIdentifier.equals(defaultChatAgent.extensionId, ext.value)) {
                    const extensionStatus = this.extensionService.getExtensionsStatus();
                    if (extensionStatus[ext.value].activationTimes && this.recentlyInstalled) {
                        this.onDidInstallChat();
                        return;
                    }
                }
            }
        }));
    }
    async onDidInstallChat() {
        // Open Chat view
        this.chatWidgetService.revealWidget();
        // Only do this once
        this.storageService.store(ChatGettingStartedContribution_1.hideWelcomeView, true, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
        this.recentlyInstalled = false;
    }
};
ChatGettingStartedContribution = ChatGettingStartedContribution_1 = __decorate([
    __param(0, IProductService),
    __param(1, IExtensionService),
    __param(2, IExtensionManagementService),
    __param(3, IStorageService),
    __param(4, IChatWidgetService)
], ChatGettingStartedContribution);
export { ChatGettingStartedContribution };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEdldHRpbmdTdGFydGVkLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9hY3Rpb25zL2NoYXRHZXR0aW5nU3RhcnRlZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUMzRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN6RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM5RixPQUFPLEVBQUUsMkJBQTJCLEVBQW9CLE1BQU0sMkVBQTJFLENBQUM7QUFDMUksT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxtREFBbUQsQ0FBQztBQUVqSCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFekMsSUFBTSw4QkFBOEIsR0FBcEMsTUFBTSw4QkFBK0IsU0FBUSxVQUFVOzthQUM3QyxPQUFFLEdBQUcsc0NBQXNDLEFBQXpDLENBQTBDO2FBR3BDLG9CQUFlLEdBQUcsZ0NBQWdDLEFBQW5DLENBQW9DO0lBRTNFLFlBQ2tCLGNBQWdELEVBQzlDLGdCQUFvRCxFQUMxQywwQkFBd0UsRUFDcEYsY0FBZ0QsRUFDN0MsaUJBQXNEO1FBRTFFLEtBQUssRUFBRSxDQUFDO1FBTjBCLG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUM3QixxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQW1CO1FBQ3pCLCtCQUEwQixHQUExQiwwQkFBMEIsQ0FBNkI7UUFDbkUsbUJBQWMsR0FBZCxjQUFjLENBQWlCO1FBQzVCLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBb0I7UUFUbkUsc0JBQWlCLEdBQVksS0FBSyxDQUFDO1FBYTFDLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQztRQUM5RCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxnQ0FBOEIsQ0FBQyxlQUFlLHFDQUE0QixLQUFLLENBQUMsQ0FBQztRQUN4SSxJQUFJLENBQUMsZ0JBQWdCLElBQUksZUFBZSxFQUFFLENBQUM7WUFDMUMsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRU8saUJBQWlCLENBQUMsZ0JBQW1DO1FBRTVELElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLHNCQUFzQixDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUN0RixLQUFLLE1BQU0sQ0FBQyxJQUFJLE1BQU0sRUFBRSxDQUFDO2dCQUN4QixJQUFJLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxxQ0FBNkIsRUFBRSxDQUFDO29CQUMzSCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDO29CQUM5QixPQUFPO2dCQUNSLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLDJCQUEyQixDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsRUFBRTtZQUNoRixLQUFLLE1BQU0sR0FBRyxJQUFJLEtBQUssRUFBRSxDQUFDO2dCQUN6QixJQUFJLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ3pFLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO29CQUNwRSxJQUFJLGVBQWUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsZUFBZSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO3dCQUMxRSxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQzt3QkFDeEIsT0FBTztvQkFDUixDQUFDO2dCQUNGLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsZ0JBQWdCO1FBRTdCLGlCQUFpQjtRQUNqQixJQUFJLENBQUMsaUJBQWlCLENBQUMsWUFBWSxFQUFFLENBQUM7UUFFdEMsb0JBQW9CO1FBQ3BCLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLGdDQUE4QixDQUFDLGVBQWUsRUFBRSxJQUFJLG1FQUFrRCxDQUFDO1FBQ2pJLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxLQUFLLENBQUM7SUFDaEMsQ0FBQzs7QUF4RFcsOEJBQThCO0lBT3hDLFdBQUEsZUFBZSxDQUFBO0lBQ2YsV0FBQSxpQkFBaUIsQ0FBQTtJQUNqQixXQUFBLDJCQUEyQixDQUFBO0lBQzNCLFdBQUEsZUFBZSxDQUFBO0lBQ2YsV0FBQSxrQkFBa0IsQ0FBQTtHQVhSLDhCQUE4QixDQXlEMUMifQ==