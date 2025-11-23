var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { localize } from '../../../../nls.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IAuthenticationService } from '../../../services/authentication/common/authentication.js';
import { IIssueFormService } from '../common/issue.js';
import { BaseIssueReporterService } from './baseIssueReporterService.js';
// GitHub has let us know that we could up our limit here to 8k. We chose 7500 to play it safe.
// ref https://github.com/microsoft/vscode/issues/159191
let IssueWebReporter = class IssueWebReporter extends BaseIssueReporterService {
    constructor(disableExtensions, data, os, product, window, issueFormService, themeService, fileService, fileDialogService, contextMenuService, authenticationService, openerService) {
        super(disableExtensions, data, os, product, window, true, issueFormService, themeService, fileService, fileDialogService, contextMenuService, authenticationService, openerService);
        // eslint-disable-next-line no-restricted-syntax
        const target = this.window.document.querySelector('.block-system .block-info');
        const webInfo = this.window.navigator.userAgent;
        if (webInfo) {
            target?.appendChild(this.window.document.createTextNode(webInfo));
            this.receivedSystemInfo = true;
            this.issueReporterModel.update({ systemInfoWeb: webInfo });
        }
        this.setEventHandlers();
    }
    setEventHandlers() {
        super.setEventHandlers();
        this.addEventListener('issue-type', 'change', (event) => {
            const issueType = parseInt(event.target.value);
            this.issueReporterModel.update({ issueType: issueType });
            // Resets placeholder
            // eslint-disable-next-line no-restricted-syntax
            const descriptionTextArea = this.getElementById('issue-title');
            if (descriptionTextArea) {
                descriptionTextArea.placeholder = localize('undefinedPlaceholder', "Please enter a title");
            }
            this.updateButtonStates();
            this.setSourceOptions();
            this.render();
        });
    }
};
IssueWebReporter = __decorate([
    __param(5, IIssueFormService),
    __param(6, IThemeService),
    __param(7, IFileService),
    __param(8, IFileDialogService),
    __param(9, IContextMenuService),
    __param(10, IAuthenticationService),
    __param(11, IOpenerService)
], IssueWebReporter);
export { IssueWebReporter };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXNzdWVSZXBvcnRlclNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvaXNzdWUvYnJvd3Nlci9pc3N1ZVJlcG9ydGVyU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFLQSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDOUYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDcEYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUM5RSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbEYsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDbkcsT0FBTyxFQUFFLGlCQUFpQixFQUFxQixNQUFNLG9CQUFvQixDQUFDO0FBQzFFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBRXpFLCtGQUErRjtBQUMvRix3REFBd0Q7QUFFakQsSUFBTSxnQkFBZ0IsR0FBdEIsTUFBTSxnQkFBaUIsU0FBUSx3QkFBd0I7SUFDN0QsWUFDQyxpQkFBMEIsRUFDMUIsSUFBdUIsRUFDdkIsRUFJQyxFQUNELE9BQThCLEVBQzlCLE1BQWMsRUFDSyxnQkFBbUMsRUFDdkMsWUFBMkIsRUFDNUIsV0FBeUIsRUFDbkIsaUJBQXFDLEVBQ3BDLGtCQUF1QyxFQUNwQyxxQkFBNkMsRUFDckQsYUFBNkI7UUFFN0MsS0FBSyxDQUFDLGlCQUFpQixFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUUsWUFBWSxFQUFFLFdBQVcsRUFBRSxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBRSxxQkFBcUIsRUFBRSxhQUFhLENBQUMsQ0FBQztRQUVwTCxnREFBZ0Q7UUFDaEQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFjLDJCQUEyQixDQUFDLENBQUM7UUFFNUYsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDO1FBQ2hELElBQUksT0FBTyxFQUFFLENBQUM7WUFDYixNQUFNLEVBQUUsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2xFLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUM7WUFDL0IsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxFQUFFLGFBQWEsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQzVELENBQUM7UUFFRCxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztJQUN6QixDQUFDO0lBRWUsZ0JBQWdCO1FBQy9CLEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBRXpCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLEVBQUUsUUFBUSxFQUFFLENBQUMsS0FBWSxFQUFFLEVBQUU7WUFDOUQsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFvQixLQUFLLENBQUMsTUFBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ25FLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztZQUV6RCxxQkFBcUI7WUFDckIsZ0RBQWdEO1lBQ2hELE1BQU0sbUJBQW1CLEdBQXFCLElBQUksQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDakYsSUFBSSxtQkFBbUIsRUFBRSxDQUFDO2dCQUN6QixtQkFBbUIsQ0FBQyxXQUFXLEdBQUcsUUFBUSxDQUFDLHNCQUFzQixFQUFFLHNCQUFzQixDQUFDLENBQUM7WUFDNUYsQ0FBQztZQUVELElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQzFCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ3hCLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNmLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztDQUNELENBQUE7QUFyRFksZ0JBQWdCO0lBVzFCLFdBQUEsaUJBQWlCLENBQUE7SUFDakIsV0FBQSxhQUFhLENBQUE7SUFDYixXQUFBLFlBQVksQ0FBQTtJQUNaLFdBQUEsa0JBQWtCLENBQUE7SUFDbEIsV0FBQSxtQkFBbUIsQ0FBQTtJQUNuQixZQUFBLHNCQUFzQixDQUFBO0lBQ3RCLFlBQUEsY0FBYyxDQUFBO0dBakJKLGdCQUFnQixDQXFENUIifQ==