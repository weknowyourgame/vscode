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
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INativeHostService } from '../../../../platform/native/common/native.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { BrowserDialogHandler } from '../../../browser/parts/dialogs/dialogHandler.js';
import { NativeDialogHandler } from './dialogHandler.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { createNativeAboutDialogDetails } from '../../../../platform/dialogs/electron-browser/dialog.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
let DialogHandlerContribution = class DialogHandlerContribution extends Disposable {
    static { this.ID = 'workbench.contrib.dialogHandler'; }
    constructor(configurationService, dialogService, logService, layoutService, keybindingService, instantiationService, productService, clipboardService, nativeHostService, environmentService, openerService, markdownRendererService) {
        super();
        this.configurationService = configurationService;
        this.dialogService = dialogService;
        this.productService = productService;
        this.nativeHostService = nativeHostService;
        this.environmentService = environmentService;
        this.browserImpl = new Lazy(() => new BrowserDialogHandler(logService, layoutService, keybindingService, instantiationService, clipboardService, openerService, markdownRendererService));
        this.nativeImpl = new Lazy(() => new NativeDialogHandler(logService, nativeHostService, clipboardService));
        this.model = this.dialogService.model;
        this._register(this.model.onWillShowDialog(() => {
            if (!this.currentDialog) {
                this.processDialogs();
            }
        }));
        this.processDialogs();
    }
    async processDialogs() {
        while (this.model.dialogs.length) {
            this.currentDialog = this.model.dialogs[0];
            let result = undefined;
            try {
                // Confirm
                if (this.currentDialog.args.confirmArgs) {
                    const args = this.currentDialog.args.confirmArgs;
                    result = (this.useCustomDialog || args?.confirmation.custom) ?
                        await this.browserImpl.value.confirm(args.confirmation) :
                        await this.nativeImpl.value.confirm(args.confirmation);
                }
                // Input (custom only)
                else if (this.currentDialog.args.inputArgs) {
                    const args = this.currentDialog.args.inputArgs;
                    result = await this.browserImpl.value.input(args.input);
                }
                // Prompt
                else if (this.currentDialog.args.promptArgs) {
                    const args = this.currentDialog.args.promptArgs;
                    result = (this.useCustomDialog || args?.prompt.custom) ?
                        await this.browserImpl.value.prompt(args.prompt) :
                        await this.nativeImpl.value.prompt(args.prompt);
                }
                // About
                else {
                    const aboutDialogDetails = createNativeAboutDialogDetails(this.productService, await this.nativeHostService.getOSProperties());
                    if (this.useCustomDialog) {
                        await this.browserImpl.value.about(aboutDialogDetails.title, aboutDialogDetails.details, aboutDialogDetails.detailsToCopy);
                    }
                    else {
                        await this.nativeImpl.value.about(aboutDialogDetails.title, aboutDialogDetails.details, aboutDialogDetails.detailsToCopy);
                    }
                }
            }
            catch (error) {
                result = error;
            }
            this.currentDialog.close(result);
            this.currentDialog = undefined;
        }
    }
    get useCustomDialog() {
        return this.configurationService.getValue('window.dialogStyle') === 'custom' ||
            // Use the custom dialog while driven so that the driver can interact with it
            !!this.environmentService.enableSmokeTestDriver;
    }
};
DialogHandlerContribution = __decorate([
    __param(0, IConfigurationService),
    __param(1, IDialogService),
    __param(2, ILogService),
    __param(3, ILayoutService),
    __param(4, IKeybindingService),
    __param(5, IInstantiationService),
    __param(6, IProductService),
    __param(7, IClipboardService),
    __param(8, INativeHostService),
    __param(9, IWorkbenchEnvironmentService),
    __param(10, IOpenerService),
    __param(11, IMarkdownRendererService)
], DialogHandlerContribution);
export { DialogHandlerContribution };
registerWorkbenchContribution2(DialogHandlerContribution.ID, DialogHandlerContribution, 1 /* WorkbenchPhase.BlockStartup */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhbG9nLmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvZWxlY3Ryb24tYnJvd3Nlci9wYXJ0cy9kaWFsb2dzL2RpYWxvZy5jb250cmlidXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDOUYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFpQyxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMvRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdEYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN4RixPQUFPLEVBQTBDLDhCQUE4QixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFMUgsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDdkYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFekQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDOUUsT0FBTyxFQUFFLDhC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