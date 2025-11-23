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
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { REVEAL_IN_EXPLORER_COMMAND_ID } from '../../files/browser/fileConstants.js';
let WorkbenchOpenerContribution = class WorkbenchOpenerContribution extends Disposable {
    static { this.ID = 'workbench.contrib.opener'; }
    constructor(openerService, commandService, fileService, workspaceContextService) {
        super();
        this.commandService = commandService;
        this.fileService = fileService;
        this.workspaceContextService = workspaceContextService;
        this._register(openerService.registerOpener(this));
    }
    async open(link, options) {
        try {
            const uri = typeof link === 'string' ? URI.parse(link) : link;
            if (this.workspaceContextService.isInsideWorkspace(uri)) {
                if ((await this.fileService.stat(uri)).isDirectory) {
                    await this.commandService.executeCommand(REVEAL_IN_EXPLORER_COMMAND_ID, uri);
                    return true;
                }
            }
        }
        catch {
            // noop
        }
        return false;
    }
};
WorkbenchOpenerContribution = __decorate([
    __param(0, IOpenerService),
    __param(1, ICommandService),
    __param(2, IFileService),
    __param(3, IWorkspaceContextService)
], WorkbenchOpenerContribution);
registerWorkbenchContribution2(WorkbenchOpenerContribution.ID, WorkbenchOpenerContribution, 4 /* WorkbenchPhase.Eventually */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BlbmVyLmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9vcGVuZXIvYnJvd3Nlci9vcGVuZXIuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMxRSxPQUFPLEVBQVcsY0FBYyxFQUE0QyxNQUFNLDhDQUE4QyxDQUFDO0FBQ2pJLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQzlGLE9BQU8sRUFBRSw4QkFBOEIsRUFBa0IsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRyxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUVyRixJQUFNLDJCQUEyQixHQUFqQyxNQUFNLDJCQUE0QixTQUFRLFVBQVU7YUFDNUIsT0FBRSxHQUFHLDBCQUEwQixBQUE3QixDQUE4QjtJQUV2RCxZQUNpQixhQUE2QixFQUNYLGNBQStCLEVBQ2xDLFdBQXlCLEVBQ2IsdUJBQWlEO1FBRTVGLEtBQUssRUFBRSxDQUFDO1FBSjBCLG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUNsQyxnQkFBVyxHQUFYLFdBQVcsQ0FBYztRQUNiLDRCQUF1QixHQUF2Qix1QkFBdUIsQ0FBMEI7UUFJNUYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBa0IsRUFBRSxPQUFtRDtRQUNqRixJQUFJLENBQUM7WUFDSixNQUFNLEdBQUcsR0FBRyxPQUFPLElBQUksS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUM5RCxJQUFJLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUN6RCxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO29CQUNwRCxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDLDZCQUE2QixFQUFFLEdBQUcsQ0FBQyxDQUFDO29CQUM3RSxPQUFPLElBQUksQ0FBQztnQkFDYixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFBQyxNQUFNLENBQUM7WUFDUixPQUFPO1FBQ1IsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQzs7QUE1QkksMkJBQTJCO0lBSTlCLFdBQUEsY0FBYyxDQUFBO0lBQ2QsV0FBQSxlQUFlLENBQUE7SUFDZixXQUFBLFlBQVksQ0FBQTtJQUNaLFdBQUEsd0JBQXdCLENBQUE7R0FQckIsMkJBQTJCLENBNkJoQztBQUdELDhCQUE4QixDQUFDLDJCQUEyQixDQUFDLEVBQUUsRUFBRSwyQkFBMkIsb0NBQTRCLENBQUMifQ==