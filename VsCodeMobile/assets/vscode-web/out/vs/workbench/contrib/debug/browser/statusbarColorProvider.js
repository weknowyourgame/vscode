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
import { localize } from '../../../../nls.js';
import { asCssVariable, asCssVariableName, registerColor, transparent } from '../../../../platform/theme/common/colorRegistry.js';
import { IDebugService } from '../common/debug.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { STATUS_BAR_FOREGROUND, STATUS_BAR_BORDER, COMMAND_CENTER_BACKGROUND } from '../../../common/theme.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IStatusbarService } from '../../../services/statusbar/browser/statusbar.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { createStyleSheet } from '../../../../base/browser/domStylesheets.js';
// colors for theming
export const STATUS_BAR_DEBUGGING_BACKGROUND = registerColor('statusBar.debuggingBackground', {
    dark: '#CC6633',
    light: '#CC6633',
    hcDark: '#BA592C',
    hcLight: '#B5200D'
}, localize('statusBarDebuggingBackground', "Status bar background color when a program is being debugged. The status bar is shown in the bottom of the window"));
export const STATUS_BAR_DEBUGGING_FOREGROUND = registerColor('statusBar.debuggingForeground', {
    dark: STATUS_BAR_FOREGROUND,
    light: STATUS_BAR_FOREGROUND,
    hcDark: STATUS_BAR_FOREGROUND,
    hcLight: '#FFFFFF'
}, localize('statusBarDebuggingForeground', "Status bar foreground color when a program is being debugged. The status bar is shown in the bottom of the window"));
export const STATUS_BAR_DEBUGGING_BORDER = registerColor('statusBar.debuggingBorder', STATUS_BAR_BORDER, localize('statusBarDebuggingBorder', "Status bar border color separating to the sidebar and editor when a program is being debugged. The status bar is shown in the bottom of the window"));
export const COMMAND_CENTER_DEBUGGING_BACKGROUND = registerColor('commandCenter.debuggingBackground', transparent(STATUS_BAR_DEBUGGING_BACKGROUND, 0.258), localize('commandCenter-activeBackground', "Command center background color when a program is being debugged"), true);
let StatusBarColorProvider = class StatusBarColorProvider {
    set enabled(enabled) {
        if (enabled === !!this.disposable) {
            return;
        }
        if (enabled) {
            this.disposable = this.statusbarService.overrideStyle({
                priority: 10,
                foreground: STATUS_BAR_DEBUGGING_FOREGROUND,
                background: STATUS_BAR_DEBUGGING_BACKGROUND,
                border: STATUS_BAR_DEBUGGING_BORDER,
            });
        }
        else {
            this.disposable.dispose();
            this.disposable = undefined;
        }
    }
    constructor(debugService, contextService, statusbarService, configurationService) {
        this.debugService = debugService;
        this.contextService = contextService;
        this.statusbarService = statusbarService;
        this.configurationService = configurationService;
        this.disposables = new DisposableStore();
        this.styleSheet = createStyleSheet();
        this.debugService.onDidChangeState(this.update, this, this.disposables);
        this.contextService.onDidChangeWorkbenchState(this.update, this, this.disposables);
        this.configurationService.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('debug.enableStatusBarColor') || e.affectsConfiguration('debug.toolBarLocation')) {
                this.update();
            }
        }, undefined, this.disposables);
        this.update();
    }
    update() {
        const debugConfig = this.configurationService.getValue('debug');
        const isInDebugMode = isStatusbarInDebugMode(this.debugService.state, this.debugService.getModel().getSessions());
        if (!debugConfig.enableStatusBarColor) {
            this.enabled = false;
        }
        else {
            this.enabled = isInDebugMode;
        }
        const isInCommandCenter = debugConfig.toolBarLocation === 'commandCenter';
        this.styleSheet.textContent = isInCommandCenter && isInDebugMode ? `
			.monaco-workbench {
				${asCssVariableName(COMMAND_CENTER_BACKGROUND)}: ${asCssVariable(COMMAND_CENTER_DEBUGGING_BACKGROUND)};
			}
		` : '';
    }
    dispose() {
        this.disposable?.dispose();
        this.disposables.dispose();
    }
};
StatusBarColorProvider = __decorate([
    __param(0, IDebugService),
    __param(1, IWorkspaceContextService),
    __param(2, IStatusbarService),
    __param(3, IConfigurationService)
], StatusBarColorProvider);
export { StatusBarColorProvider };
export function isStatusbarInDebugMode(state, sessions) {
    if (state === 0 /* State.Inactive */ || state === 1 /* State.Initializing */ || sessions.every(s => s.suppressDebugStatusbar || s.configuration?.noDebug)) {
        return false;
    }
    return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHVzYmFyQ29sb3JQcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL3N0YXR1c2JhckNvbG9yUHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBRWxJLE9BQU8sRUFBRSxhQUFhLEVBQTZDLE1BQU0sb0JBQW9CLENBQUM7QUFDOUYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDOUYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLGlCQUFpQixFQUFFLHlCQUF5QixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDL0csT0FBTyxFQUFFLGVBQWUsRUFBZSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBRzlFLHFCQUFxQjtBQUVyQixNQUFNLENBQUMsTUFBTSwrQkFBK0IsR0FBRyxhQUFhLENBQUMsK0JBQStCLEVBQUU7SUFDN0YsSUFBSSxFQUFFLFNBQVM7SUFDZixLQUFLLEVBQUUsU0FBUztJQUNoQixNQUFNLEVBQUUsU0FBUztJQUNqQixPQUFPLEVBQUUsU0FBUztDQUNsQixFQUFFLFFBQVEsQ0FBQyw4QkFBOEIsRUFBRSxtSEFBbUgsQ0FBQyxDQUFDLENBQUM7QUFFbEssTUFBTSxDQUFDLE1BQU0sK0JBQStCLEdBQUcsYUFBYSxDQUFDLCtCQUErQixFQUFFO0lBQzdGLElBQUksRUFBRSxxQkFBcUI7SUFDM0IsS0FBSyxFQUFFLHFCQUFxQjtJQUM1QixNQUFNLEVBQUUscUJBQXFCO0lBQzdCLE9BQU8sRUFBRSxTQUFTO0NBQ2xCLEVBQUUsUUFBUSxDQUFDLDhCQUE4QixFQUFFLG1IQUFtSCxDQUFDLENBQUMsQ0FBQztBQUVsSyxNQUFNLENBQUMsTUFBTSwyQkFBMkIsR0FBRyxhQUFhLENBQUMsMkJBQTJCLEVBQUUsaUJBQWlCLEVBQUUsUUFBUSxDQUFDLDBCQUEwQixFQUFFLG9KQUFvSixDQUFDLENBQUMsQ0FBQztBQUVyUyxNQUFNLENBQUMsTUFBTSxtQ0FBbUMsR0FBRyxhQUFhLENBQy9ELG1DQUFtQyxFQUNuQyxXQUFXLENBQUMsK0JBQStCLEVBQUUsS0FBSyxDQUFDLEVBQ25ELFFBQVEsQ0FBQyxnQ0FBZ0MsRUFBRSxrRUFBa0UsQ0FBQyxFQUM5RyxJQUFJLENBQ0osQ0FBQztBQUVLLElBQU0sc0JBQXNCLEdBQTVCLE1BQU0sc0JBQXNCO0lBT2xDLElBQVksT0FBTyxDQUFDLE9BQWdCO1FBQ25DLElBQUksT0FBTyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDbkMsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ2IsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDO2dCQUNyRCxRQUFRLEVBQUUsRUFBRTtnQkFDWixVQUFVLEVBQUUsK0JBQStCO2dCQUMzQyxVQUFVLEVBQUUsK0JBQStCO2dCQUMzQyxNQUFNLEVBQUUsMkJBQTJCO2FBQ25DLENBQUMsQ0FBQztRQUNKLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLFVBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUMzQixJQUFJLENBQUMsVUFBVSxHQUFHLFNBQVMsQ0FBQztRQUM3QixDQUFDO0lBQ0YsQ0FBQztJQUVELFlBQ2dCLFlBQTRDLEVBQ2pDLGNBQXlELEVBQ2hFLGdCQUFvRCxFQUNoRCxvQkFBNEQ7UUFIbkQsaUJBQVksR0FBWixZQUFZLENBQWU7UUFDaEIsbUJBQWMsR0FBZCxjQUFjLENBQTBCO1FBQy9DLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBbUI7UUFDL0IseUJBQW9CLEdBQXBCLG9CQUFvQixDQUF1QjtRQTNCbkUsZ0JBQVcsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBR3BDLGVBQVUsR0FBRyxnQkFBZ0IsRUFBRSxDQUFDO1FBMEJoRCxJQUFJLENBQUMsWUFBWSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN4RSxJQUFJLENBQUMsY0FBYyxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNuRixJQUFJLENBQUMsb0JBQW9CLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtZQUN4RCxJQUFJLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyx1QkFBdUIsQ0FBQyxFQUFFLENBQUM7Z0JBQzdHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNmLENBQUM7UUFDRixDQUFDLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNoQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDZixDQUFDO0lBRVMsTUFBTTtRQUNmLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQXNCLE9BQU8sQ0FBQyxDQUFDO1FBQ3JGLE1BQU0sYUFBYSxHQUFHLHNCQUFzQixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUNsSCxJQUFJLENBQUMsV0FBVyxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFDdkMsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUM7UUFDdEIsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsT0FBTyxHQUFHLGFBQWEsQ0FBQztRQUM5QixDQUFDO1FBRUQsTUFBTSxpQkFBaUIsR0FBRyxXQUFXLENBQUMsZUFBZSxLQUFLLGVBQWUsQ0FBQztRQUUxRSxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsR0FBRyxpQkFBaUIsSUFBSSxhQUFhLENBQUMsQ0FBQyxDQUFDOztNQUUvRCxpQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQyxLQUFLLGFBQWEsQ0FBQyxtQ0FBbUMsQ0FBQzs7R0FFdEcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0lBQ1IsQ0FBQztJQUVELE9BQU87UUFDTixJQUFJLENBQUMsVUFBVSxFQUFFLE9BQU8sRUFBRSxDQUFDO1FBQzNCLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDNUIsQ0FBQztDQUNELENBQUE7QUEvRFksc0JBQXNCO0lBMEJoQyxXQUFBLGFBQWEsQ0FBQTtJQUNiLFdBQUEsd0JBQXdCLENBQUE7SUFDeEIsV0FBQSxpQkFBaUIsQ0FBQTtJQUNqQixXQUFBLHFCQUFxQixDQUFBO0dBN0JYLHNCQUFzQixDQStEbEM7O0FBRUQsTUFBTSxVQUFVLHNCQUFzQixDQUFDLEtBQVksRUFBRSxRQUF5QjtJQUM3RSxJQUFJLEtBQUssMkJBQW1CLElBQUksS0FBSywrQkFBdUIsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLHNCQUFzQixJQUFJLENBQUMsQ0FBQyxhQUFhLEVBQUUsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUMzSSxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFRCxPQUFPLElBQUksQ0FBQztBQUNiLENBQUMifQ==