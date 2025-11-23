var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { safeSetInnerHtml } from '../../../../base/browser/domSanitize.js';
import { createStyleSheet } from '../../../../base/browser/domStylesheets.js';
import { getMenuWidgetCSS, Menu, unthemedMenuStyles } from '../../../../base/browser/ui/menu/menu.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { isLinux, isWindows } from '../../../../base/common/platform.js';
import Severity from '../../../../base/common/severity.js';
import { localize } from '../../../../nls.js';
import { IMenuService, MenuId } from '../../../../platform/actions/common/actions.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ExtensionIdentifier, ExtensionIdentifierSet } from '../../../../platform/extensions/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import product from '../../../../platform/product/common/product.js';
import { AuxiliaryWindowMode, IAuxiliaryWindowService } from '../../../services/auxiliaryWindow/browser/auxiliaryWindowService.js';
import { IHostService } from '../../../services/host/browser/host.js';
import BaseHtml from './issueReporterPage.js';
import { IssueWebReporter } from './issueReporterService.js';
import './media/issueReporter.css';
let IssueFormService = class IssueFormService {
    constructor(instantiationService, auxiliaryWindowService, menuService, contextKeyService, logService, dialogService, hostService) {
        this.instantiationService = instantiationService;
        this.auxiliaryWindowService = auxiliaryWindowService;
        this.menuService = menuService;
        this.contextKeyService = contextKeyService;
        this.logService = logService;
        this.dialogService = dialogService;
        this.hostService = hostService;
        this.issueReporterWindow = null;
        this.extensionIdentifierSet = new ExtensionIdentifierSet();
        this.arch = '';
        this.release = '';
        this.type = '';
    }
    async openReporter(data) {
        if (this.hasToReload(data)) {
            return;
        }
        await this.openAuxIssueReporter(data);
        if (this.issueReporterWindow) {
            const issueReporter = this.instantiationService.createInstance(IssueWebReporter, false, data, { type: this.type, arch: this.arch, release: this.release }, product, this.issueReporterWindow);
            issueReporter.render();
        }
    }
    async openAuxIssueReporter(data, bounds) {
        let issueReporterBounds = { width: 700, height: 800 };
        // Center Issue Reporter Window based on bounds from native host service
        if (bounds && bounds.x && bounds.y) {
            const centerX = bounds.x + bounds.width / 2;
            const centerY = bounds.y + bounds.height / 2;
            issueReporterBounds = { ...issueReporterBounds, x: centerX - 350, y: centerY - 400 };
        }
        const disposables = new DisposableStore();
        // Auxiliary Window
        const auxiliaryWindow = disposables.add(await this.auxiliaryWindowService.open({ mode: AuxiliaryWindowMode.Normal, bounds: issueReporterBounds, nativeTitlebar: true, disableFullscreen: true }));
        const platformClass = isWindows ? 'windows' : isLinux ? 'linux' : 'mac';
        if (auxiliaryWindow) {
            await auxiliaryWindow.whenStylesHaveLoaded;
            auxiliaryWindow.window.document.title = 'Issue Reporter';
            auxiliaryWindow.window.document.body.classList.add('issue-reporter-body', 'monaco-workbench', platformClass);
            // removes preset monaco-workbench container
            auxiliaryWindow.container.remove();
            // The Menu class uses a static globalStyleSheet that's created lazily on first menu creation.
            // Since auxiliary windows clone stylesheets from main window, but Menu.globalStyleSheet
            // may not exist yet in main window, we need to ensure menu styles are available here.
            if (!Menu.globalStyleSheet) {
                const menuStyleSheet = createStyleSheet(auxiliaryWindow.window.document.head);
                menuStyleSheet.textContent = getMenuWidgetCSS(unthemedMenuStyles, false);
            }
            // custom issue reporter wrapper that preserves critical auxiliary window container styles
            const div = document.createElement('div');
            div.classList.add('monaco-workbench');
            auxiliaryWindow.window.document.body.appendChild(div);
            safeSetInnerHtml(div, BaseHtml(), {
                // Also allow input elements
                allowedTags: {
                    augment: [
                        'input',
                        'select',
                        'checkbox',
                        'textarea',
                    ]
                },
                allowedAttributes: {
                    augment: [
                        'id',
                        'class',
                        'style',
                        'textarea',
                    ]
                }
            });
            this.issueReporterWindow = auxiliaryWindow.window;
        }
        else {
            console.error('Failed to open auxiliary window');
            disposables.dispose();
        }
        // handle closing issue reporter
        this.issueReporterWindow?.addEventListener('beforeunload', () => {
            auxiliaryWindow.window.close();
            disposables.dispose();
            this.issueReporterWindow = null;
        });
    }
    async sendReporterMenu(extensionId) {
        const menu = this.menuService.createMenu(MenuId.IssueReporter, this.contextKeyService);
        // render menu and dispose
        const actions = menu.getActions({ renderShortTitle: true }).flatMap(entry => entry[1]);
        for (const action of actions) {
            try {
                if (action.item && 'source' in action.item && action.item.source?.id.toLowerCase() === extensionId.toLowerCase()) {
                    this.extensionIdentifierSet.add(extensionId.toLowerCase());
                    await action.run();
                }
            }
            catch (error) {
                console.error(error);
            }
        }
        if (!this.extensionIdentifierSet.has(extensionId)) {
            // send undefined to indicate no action was taken
            return undefined;
        }
        // we found the extension, now we clean up the menu and remove it from the set. This is to ensure that we do duplicate extension identifiers
        this.extensionIdentifierSet.delete(new ExtensionIdentifier(extensionId));
        menu.dispose();
        const result = this.currentData;
        // reset current data.
        this.currentData = undefined;
        return result ?? undefined;
    }
    //#region used by issue reporter
    async closeReporter() {
        this.issueReporterWindow?.close();
    }
    async reloadWithExtensionsDisabled() {
        if (this.issueReporterWindow) {
            try {
                await this.hostService.reload({ disableExtensions: true });
            }
            catch (error) {
                this.logService.error(error);
            }
        }
    }
    async showConfirmCloseDialog() {
        await this.dialogService.prompt({
            type: Severity.Warning,
            message: localize('confirmCloseIssueReporter', "Your input will not be saved. Are you sure you want to close this window?"),
            buttons: [
                {
                    label: localize({ key: 'yes', comment: ['&& denotes a mnemonic'] }, "&&Yes"),
                    run: () => {
                        this.closeReporter();
                        this.issueReporterWindow = null;
                    }
                },
                {
                    label: localize('cancel', "Cancel"),
                    run: () => { }
                }
            ]
        });
    }
    async showClipboardDialog() {
        let result = false;
        await this.dialogService.prompt({
            type: Severity.Warning,
            message: localize('issueReporterWriteToClipboard', "There is too much data to send to GitHub directly. The data will be copied to the clipboard, please paste it into the GitHub issue page that is opened."),
            buttons: [
                {
                    label: localize({ key: 'ok', comment: ['&& denotes a mnemonic'] }, "&&OK"),
                    run: () => { result = true; }
                },
                {
                    label: localize('cancel', "Cancel"),
                    run: () => { result = false; }
                }
            ]
        });
        return result;
    }
    hasToReload(data) {
        if (data.extensionId && this.extensionIdentifierSet.has(data.extensionId)) {
            this.currentData = data;
            this.issueReporterWindow?.focus();
            return true;
        }
        if (this.issueReporterWindow) {
            this.issueReporterWindow.focus();
            return true;
        }
        return false;
    }
};
IssueFormService = __decorate([
    __param(0, IInstantiationService),
    __param(1, IAuxiliaryWindowService),
    __param(2, IMenuService),
    __param(3, IContextKeyService),
    __param(4, ILogService),
    __param(5, IDialogService),
    __param(6, IHostService)
], IssueFormService);
export { IssueFormService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXNzdWVGb3JtU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9pc3N1ZS9icm93c2VyL2lzc3VlRm9ybVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUE7OztnR0FHZ0c7QUFDaEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDOUUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN2RSxPQUFPLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3pFLE9BQU8sUUFBUSxNQUFNLHFDQUFxQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNoRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNuSCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDckUsT0FBTyxPQUFPLE1BQU0sZ0RBQWdELENBQUM7QUFFckUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLHVCQUF1QixFQUFFLE1BQU0scUVBQXFFLENBQUM7QUFDbkksT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRXRFLE9BQU8sUUFBUSxNQUFNLHdCQUF3QixDQUFDO0FBQzlDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQzdELE9BQU8sMkJBQTJCLENBQUM7QUFPNUIsSUFBTSxnQkFBZ0IsR0FBdEIsTUFBTSxnQkFBZ0I7SUFhNUIsWUFDd0Isb0JBQThELEVBQzVELHNCQUFrRSxFQUM3RSxXQUE0QyxFQUN0QyxpQkFBd0QsRUFDL0QsVUFBMEMsRUFDdkMsYUFBZ0QsRUFDbEQsV0FBNEM7UUFOaEIseUJBQW9CLEdBQXBCLG9CQUFvQixDQUF1QjtRQUN6QywyQkFBc0IsR0FBdEIsc0JBQXNCLENBQXlCO1FBQzFELGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBQ25CLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBb0I7UUFDNUMsZUFBVSxHQUFWLFVBQVUsQ0FBYTtRQUNwQixrQkFBYSxHQUFiLGFBQWEsQ0FBZ0I7UUFDL0IsZ0JBQVcsR0FBWCxXQUFXLENBQWM7UUFkakQsd0JBQW1CLEdBQWtCLElBQUksQ0FBQztRQUMxQywyQkFBc0IsR0FBMkIsSUFBSSxzQkFBc0IsRUFBRSxDQUFDO1FBRTlFLFNBQUksR0FBVyxFQUFFLENBQUM7UUFDbEIsWUFBTyxHQUFXLEVBQUUsQ0FBQztRQUNyQixTQUFJLEdBQVcsRUFBRSxDQUFDO0lBVXhCLENBQUM7SUFFTCxLQUFLLENBQUMsWUFBWSxDQUFDLElBQXVCO1FBQ3pDLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQzVCLE9BQU87UUFDUixDQUFDO1FBRUQsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdEMsSUFBSSxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztZQUM5QixNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLGdCQUFnQixFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUM5TCxhQUFhLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDeEIsQ0FBQztJQUNGLENBQUM7SUFFRCxLQUFLLENBQUMsb0JBQW9CLENBQUMsSUFBdUIsRUFBRSxNQUFtQjtRQUV0RSxJQUFJLG1CQUFtQixHQUF3QixFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBRTNFLHdFQUF3RTtRQUN4RSxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNwQyxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO1lBQzVDLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7WUFDN0MsbUJBQW1CLEdBQUcsRUFBRSxHQUFHLG1CQUFtQixFQUFFLENBQUMsRUFBRSxPQUFPLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxPQUFPLEdBQUcsR0FBRyxFQUFFLENBQUM7UUFDdEYsQ0FBQztRQUVELE1BQU0sV0FBVyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFFMUMsbUJBQW1CO1FBQ25CLE1BQU0sZUFBZSxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLG1CQUFtQixDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsbUJBQW1CLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFbE0sTUFBTSxhQUFhLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFFeEUsSUFBSSxlQUFlLEVBQUUsQ0FBQztZQUNyQixNQUFNLGVBQWUsQ0FBQyxvQkFBb0IsQ0FBQztZQUMzQyxlQUFlLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsZ0JBQWdCLENBQUM7WUFDekQsZUFBZSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMscUJBQXFCLEVBQUUsa0JBQWtCLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFFN0csNENBQTRDO1lBQzVDLGVBQWUsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUM7WUFFbkMsOEZBQThGO1lBQzlGLHdGQUF3RjtZQUN4RixzRkFBc0Y7WUFDdEYsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO2dCQUM1QixNQUFNLGNBQWMsR0FBRyxnQkFBZ0IsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDOUUsY0FBYyxDQUFDLFdBQVcsR0FBRyxnQkFBZ0IsQ0FBQyxrQkFBa0IsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUMxRSxDQUFDO1lBRUQsMEZBQTBGO1lBQzFGLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDMUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztZQUN0QyxlQUFlLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3RELGdCQUFnQixDQUFDLEdBQUcsRUFBRSxRQUFRLEVBQUUsRUFBRTtnQkFDakMsNEJBQTRCO2dCQUM1QixXQUFXLEVBQUU7b0JBQ1osT0FBTyxFQUFFO3dCQUNSLE9BQU87d0JBQ1AsUUFBUTt3QkFDUixVQUFVO3dCQUNWLFVBQVU7cUJBQ1Y7aUJBQ0Q7Z0JBQ0QsaUJBQWlCLEVBQUU7b0JBQ2xCLE9BQU8sRUFBRTt3QkFDUixJQUFJO3dCQUNKLE9BQU87d0JBQ1AsT0FBTzt3QkFDUCxVQUFVO3FCQUNWO2lCQUNEO2FBQ0QsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLG1CQUFtQixHQUFHLGVBQWUsQ0FBQyxNQUFNLENBQUM7UUFDbkQsQ0FBQzthQUFNLENBQUM7WUFDUCxPQUFPLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7WUFDakQsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3ZCLENBQUM7UUFFRCxnQ0FBZ0M7UUFDaEMsSUFBSSxDQUFDLG1CQUFtQixFQUFFLGdCQUFnQixDQUFDLGNBQWMsRUFBRSxHQUFHLEVBQUU7WUFDL0QsZUFBZSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUMvQixXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdEIsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQztRQUNqQyxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxLQUFLLENBQUMsZ0JBQWdCLENBQUMsV0FBbUI7UUFDekMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUV2RiwwQkFBMEI7UUFDMUIsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdkYsS0FBSyxNQUFNLE1BQU0sSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUM5QixJQUFJLENBQUM7Z0JBQ0osSUFBSSxNQUFNLENBQUMsSUFBSSxJQUFJLFFBQVEsSUFBSSxNQUFNLENBQUMsSUFBSSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxXQUFXLEVBQUUsS0FBSyxXQUFXLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQztvQkFDbEgsSUFBSSxDQUFDLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztvQkFDM0QsTUFBTSxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ3BCLENBQUM7WUFDRixDQUFDO1lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztnQkFDaEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN0QixDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7WUFDbkQsaURBQWlEO1lBQ2pELE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCw0SUFBNEk7UUFDNUksSUFBSSxDQUFDLHNCQUFzQixDQUFDLE1BQU0sQ0FBQyxJQUFJLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFDekUsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBRWYsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUVoQyxzQkFBc0I7UUFDdEIsSUFBSSxDQUFDLFdBQVcsR0FBRyxTQUFTLENBQUM7UUFFN0IsT0FBTyxNQUFNLElBQUksU0FBUyxDQUFDO0lBQzVCLENBQUM7SUFFRCxnQ0FBZ0M7SUFFaEMsS0FBSyxDQUFDLGFBQWE7UUFDbEIsSUFBSSxDQUFDLG1CQUFtQixFQUFFLEtBQUssRUFBRSxDQUFDO0lBQ25DLENBQUM7SUFFRCxLQUFLLENBQUMsNEJBQTRCO1FBQ2pDLElBQUksSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDO2dCQUNKLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQzVELENBQUM7WUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO2dCQUNoQixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM5QixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFRCxLQUFLLENBQUMsc0JBQXNCO1FBQzNCLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUM7WUFDL0IsSUFBSSxFQUFFLFFBQVEsQ0FBQyxPQUFPO1lBQ3RCLE9BQU8sRUFBRSxRQUFRLENBQUMsMkJBQTJCLEVBQUUsMkVBQTJFLENBQUM7WUFDM0gsT0FBTyxFQUFFO2dCQUNSO29CQUNDLEtBQUssRUFBRSxRQUFRLENBQUMsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxDQUFDLHVCQUF1QixDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUM7b0JBQzVFLEdBQUcsRUFBRSxHQUFHLEVBQUU7d0JBQ1QsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO3dCQUNyQixJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDO29CQUNqQyxDQUFDO2lCQUNEO2dCQUNEO29CQUNDLEtBQUssRUFBRSxRQUFRLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQztvQkFDbkMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7aUJBQ2Q7YUFDRDtTQUNELENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxLQUFLLENBQUMsbUJBQW1CO1FBQ3hCLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQztRQUVuQixNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDO1lBQy9CLElBQUksRUFBRSxRQUFRLENBQUMsT0FBTztZQUN0QixPQUFPLEVBQUUsUUFBUSxDQUFDLCtCQUErQixFQUFFLHlKQUF5SixDQUFDO1lBQzdNLE9BQU8sRUFBRTtnQkFDUjtvQkFDQyxLQUFLLEVBQUUsUUFBUSxDQUFDLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDO29CQUMxRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsTUFBTSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7aUJBQzdCO2dCQUNEO29CQUNDLEtBQUssRUFBRSxRQUFRLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQztvQkFDbkMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLE1BQU0sR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDO2lCQUM5QjthQUNEO1NBQ0QsQ0FBQyxDQUFDO1FBRUgsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBRUQsV0FBVyxDQUFDLElBQXVCO1FBQ2xDLElBQUksSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsc0JBQXNCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO1lBQzNFLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1lBQ3hCLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxLQUFLLEVBQUUsQ0FBQztZQUNsQyxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNqQyxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFFRCxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7Q0FDRCxDQUFBO0FBcE5ZLGdCQUFnQjtJQWMxQixXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEsdUJBQXVCLENBQUE7SUFDdkIsV0FBQSxZQUFZLENBQUE7SUFDWixXQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFdBQUEsV0FBVyxDQUFBO0lBQ1gsV0FBQSxjQUFjLENBQUE7SUFDZCxXQUFBLFlBQVksQ0FBQTtHQXBCRixnQkFBZ0IsQ0FvTjVCIn0=