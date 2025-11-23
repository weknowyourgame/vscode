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
var TerminalQuickFixContribution_1;
import { DisposableStore, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { localize2 } from '../../../../../nls.js';
import { registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { registerActiveInstanceAction } from '../../../terminal/browser/terminalActions.js';
import { registerTerminalContribution } from '../../../terminal/browser/terminalExtensions.js';
import { TerminalContextKeys } from '../../../terminal/common/terminalContextKey.js';
import './media/terminalQuickFix.css';
import { ITerminalQuickFixService } from './quickFix.js';
import { TerminalQuickFixAddon } from './quickFixAddon.js';
import { freePort, gitCreatePr, gitFastForwardPull, gitPushSetUpstream, gitSimilar, gitTwoDashes, pwshGeneralError, pwshUnixCommandNotFoundError } from './terminalQuickFixBuiltinActions.js';
import { TerminalQuickFixService } from './terminalQuickFixService.js';
// #region Services
registerSingleton(ITerminalQuickFixService, TerminalQuickFixService, 1 /* InstantiationType.Delayed */);
// #endregion
// #region Contributions
let TerminalQuickFixContribution = class TerminalQuickFixContribution extends DisposableStore {
    static { TerminalQuickFixContribution_1 = this; }
    static { this.ID = 'quickFix'; }
    static get(instance) {
        return instance.getContribution(TerminalQuickFixContribution_1.ID);
    }
    get addon() { return this._addon; }
    constructor(_ctx, _instantiationService) {
        super();
        this._ctx = _ctx;
        this._instantiationService = _instantiationService;
        this._quickFixMenuItems = this.add(new MutableDisposable());
    }
    xtermReady(xterm) {
        // Create addon
        this._addon = this._instantiationService.createInstance(TerminalQuickFixAddon, this._ctx.instance.sessionId, undefined, this._ctx.instance.capabilities);
        xterm.raw.loadAddon(this._addon);
        // Hook up listeners
        this.add(this._addon.onDidRequestRerunCommand((e) => this._ctx.instance.runCommand(e.command, e.shouldExecute || false)));
        this.add(this._addon.onDidUpdateQuickFixes(e => {
            // Only track the latest command's quick fixes
            this._quickFixMenuItems.value = e.actions ? xterm.decorationAddon.registerMenuItems(e.command, e.actions) : undefined;
        }));
        // Register quick fixes
        for (const actionOption of [
            gitTwoDashes(),
            gitFastForwardPull(),
            freePort((port, command) => this._ctx.instance.freePortKillProcess(port, command)),
            gitSimilar(),
            gitPushSetUpstream(),
            gitCreatePr(),
            pwshUnixCommandNotFoundError(),
            pwshGeneralError()
        ]) {
            this._addon.registerCommandFinishedListener(actionOption);
        }
    }
};
TerminalQuickFixContribution = TerminalQuickFixContribution_1 = __decorate([
    __param(1, IInstantiationService)
], TerminalQuickFixContribution);
registerTerminalContribution(TerminalQuickFixContribution.ID, TerminalQuickFixContribution);
// #endregion
// #region Actions
var TerminalQuickFixCommandId;
(function (TerminalQuickFixCommandId) {
    TerminalQuickFixCommandId["ShowQuickFixes"] = "workbench.action.terminal.showQuickFixes";
})(TerminalQuickFixCommandId || (TerminalQuickFixCommandId = {}));
registerActiveInstanceAction({
    id: "workbench.action.terminal.showQuickFixes" /* TerminalQuickFixCommandId.ShowQuickFixes */,
    title: localize2('workbench.action.terminal.showQuickFixes', 'Show Terminal Quick Fixes'),
    precondition: TerminalContextKeys.focus,
    keybinding: {
        primary: 2048 /* KeyMod.CtrlCmd */ | 89 /* KeyCode.Period */,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */
    },
    run: (activeInstance) => TerminalQuickFixContribution.get(activeInstance)?.addon?.showMenu()
});
// #endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWwucXVpY2tGaXguY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9xdWlja0ZpeC9icm93c2VyL3Rlcm1pbmFsLnF1aWNrRml4LmNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFJaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzdGLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNsRCxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbEgsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFHdEcsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDNUYsT0FBTyxFQUFFLDRCQUE0QixFQUFxQyxNQUFNLGlEQUFpRCxDQUFDO0FBQ2xJLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3JGLE9BQU8sOEJBQThCLENBQUM7QUFDdEMsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3pELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzNELE9BQU8sRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGtCQUFrQixFQUFFLGtCQUFrQixFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsZ0JBQWdCLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5TCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUV2RSxtQkFBbUI7QUFFbkIsaUJBQWlCLENBQUMsd0JBQXdCLEVBQUUsdUJBQXVCLG9DQUE0QixDQUFDO0FBRWhHLGFBQWE7QUFFYix3QkFBd0I7QUFFeEIsSUFBTSw0QkFBNEIsR0FBbEMsTUFBTSw0QkFBNkIsU0FBUSxlQUFlOzthQUN6QyxPQUFFLEdBQUcsVUFBVSxBQUFiLENBQWM7SUFFaEMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUEyQjtRQUNyQyxPQUFPLFFBQVEsQ0FBQyxlQUFlLENBQStCLDhCQUE0QixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ2hHLENBQUM7SUFHRCxJQUFJLEtBQUssS0FBd0MsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUl0RSxZQUNrQixJQUFrQyxFQUM1QixxQkFBNkQ7UUFFcEYsS0FBSyxFQUFFLENBQUM7UUFIUyxTQUFJLEdBQUosSUFBSSxDQUE4QjtRQUNYLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBdUI7UUFKcEUsdUJBQWtCLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLGlCQUFpQixFQUFFLENBQUMsQ0FBQztJQU94RSxDQUFDO0lBRUQsVUFBVSxDQUFDLEtBQWlEO1FBQzNELGVBQWU7UUFDZixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLENBQUMscUJBQXFCLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUN6SixLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFakMsb0JBQW9CO1FBQ3BCLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLGFBQWEsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDMUgsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLHFCQUFxQixDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQzlDLDhDQUE4QztZQUM5QyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUN2SCxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosdUJBQXVCO1FBQ3ZCLEtBQUssTUFBTSxZQUFZLElBQUk7WUFDMUIsWUFBWSxFQUFFO1lBQ2Qsa0JBQWtCLEVBQUU7WUFDcEIsUUFBUSxDQUFDLENBQUMsSUFBWSxFQUFFLE9BQWUsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ2xHLFVBQVUsRUFBRTtZQUNaLGtCQUFrQixFQUFFO1lBQ3BCLFdBQVcsRUFBRTtZQUNiLDRCQUE0QixFQUFFO1lBQzlCLGdCQUFnQixFQUFFO1NBQ2xCLEVBQUUsQ0FBQztZQUNILElBQUksQ0FBQyxNQUFNLENBQUMsK0JBQStCLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDM0QsQ0FBQztJQUNGLENBQUM7O0FBNUNJLDRCQUE0QjtJQWMvQixXQUFBLHFCQUFxQixDQUFBO0dBZGxCLDRCQUE0QixDQTZDakM7QUFDRCw0QkFBNEIsQ0FBQyw0QkFBNEIsQ0FBQyxFQUFFLEVBQUUsNEJBQTRCLENBQUMsQ0FBQztBQUU1RixhQUFhO0FBRWIsa0JBQWtCO0FBRWxCLElBQVcseUJBRVY7QUFGRCxXQUFXLHlCQUF5QjtJQUNuQyx3RkFBMkQsQ0FBQTtBQUM1RCxDQUFDLEVBRlUseUJBQXlCLEtBQXpCLHlCQUF5QixRQUVuQztBQUVELDRCQUE0QixDQUFDO0lBQzVCLEVBQUUsMkZBQTBDO0lBQzVDLEtBQUssRUFBRSxTQUFTLENBQUMsMENBQTBDLEVBQUUsMkJBQTJCLENBQUM7SUFDekYsWUFBWSxFQUFFLG1CQUFtQixDQUFDLEtBQUs7SUFDdkMsVUFBVSxFQUFFO1FBQ1gsT0FBTyxFQUFFLG1EQUErQjtRQUN4QyxNQUFNLDZDQUFtQztLQUN6QztJQUNELEdBQUcsRUFBRSxDQUFDLGNBQWMsRUFBRSxFQUFFLENBQUMsNEJBQTRCLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUU7Q0FDNUYsQ0FBQyxDQUFDO0FBRUgsYUFBYSJ9