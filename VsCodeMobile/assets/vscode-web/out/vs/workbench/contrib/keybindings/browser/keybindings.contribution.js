/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { showWindowLogActionId } from '../../../services/log/common/logConstants.js';
import { DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { $, addDisposableListener, append, getDomNodePagePosition, getWindows, onDidRegisterWindow } from '../../../../base/browser/dom.js';
import { createCSSRule, createStyleSheet } from '../../../../base/browser/domStylesheets.js';
import { Emitter } from '../../../../base/common/event.js';
class ToggleKeybindingsLogAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.action.toggleKeybindingsLog',
            title: nls.localize2('toggleKeybindingsLog', "Toggle Keyboard Shortcuts Troubleshooting"),
            category: Categories.Developer,
            f1: true
        });
    }
    run(accessor) {
        const logging = accessor.get(IKeybindingService).toggleLogging();
        if (logging) {
            const commandService = accessor.get(ICommandService);
            commandService.executeCommand(showWindowLogActionId);
        }
        if (ToggleKeybindingsLogAction.disposable) {
            ToggleKeybindingsLogAction.disposable.dispose();
            ToggleKeybindingsLogAction.disposable = undefined;
            return;
        }
        const layoutService = accessor.get(ILayoutService);
        const disposables = new DisposableStore();
        const container = layoutService.activeContainer;
        const focusMarker = append(container, $('.focus-troubleshooting-marker'));
        disposables.add(toDisposable(() => focusMarker.remove()));
        // Add CSS rule for focus marker
        const stylesheet = createStyleSheet(undefined, undefined, disposables);
        createCSSRule('.focus-troubleshooting-marker', `
			position: fixed;
			pointer-events: none;
			z-index: 100000;
			background-color: rgba(255, 0, 0, 0.2);
			border: 2px solid rgba(255, 0, 0, 0.8);
			border-radius: 2px;
			display: none;
		`, stylesheet);
        const onKeyDown = disposables.add(new Emitter());
        function registerWindowListeners(window, disposables) {
            disposables.add(addDisposableListener(window, 'keydown', e => onKeyDown.fire(e), true));
        }
        for (const { window, disposables } of getWindows()) {
            registerWindowListeners(window, disposables);
        }
        disposables.add(onDidRegisterWindow(({ window, disposables }) => registerWindowListeners(window, disposables)));
        disposables.add(layoutService.onDidChangeActiveContainer(() => {
            layoutService.activeContainer.appendChild(focusMarker);
        }));
        disposables.add(onKeyDown.event(e => {
            const target = e.target;
            if (target) {
                const position = getDomNodePagePosition(target);
                focusMarker.style.top = `${position.top}px`;
                focusMarker.style.left = `${position.left}px`;
                focusMarker.style.width = `${position.width}px`;
                focusMarker.style.height = `${position.height}px`;
                focusMarker.style.display = 'block';
                // Hide after timeout
                setTimeout(() => {
                    focusMarker.style.display = 'none';
                }, 800);
            }
        }));
        ToggleKeybindingsLogAction.disposable = disposables;
    }
}
registerAction2(ToggleKeybindingsLogAction);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2V5YmluZGluZ3MuY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2tleWJpbmRpbmdzL2Jyb3dzZXIva2V5YmluZGluZ3MuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUUxRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sOERBQThELENBQUM7QUFDMUYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxlQUFlLEVBQWUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxDQUFDLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxFQUFFLHNCQUFzQixFQUFFLFVBQVUsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzVJLE9BQU8sRUFBRSxhQUFhLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUM3RixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFM0QsTUFBTSwwQkFBMkIsU0FBUSxPQUFPO0lBRy9DO1FBQ0MsS0FBSyxDQUFDO1lBQ0wsRUFBRSxFQUFFLHVDQUF1QztZQUMzQyxLQUFLLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxzQkFBc0IsRUFBRSwyQ0FBMkMsQ0FBQztZQUN6RixRQUFRLEVBQUUsVUFBVSxDQUFDLFNBQVM7WUFDOUIsRUFBRSxFQUFFLElBQUk7U0FDUixDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsR0FBRyxDQUFDLFFBQTBCO1FBQzdCLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUNqRSxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ2IsTUFBTSxjQUFjLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztZQUNyRCxjQUFjLENBQUMsY0FBYyxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDdEQsQ0FBQztRQUVELElBQUksMEJBQTBCLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDM0MsMEJBQTBCLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2hELDBCQUEwQixDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUM7WUFDbEQsT0FBTztRQUNSLENBQUM7UUFFRCxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ25ELE1BQU0sV0FBVyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7UUFFMUMsTUFBTSxTQUFTLEdBQUcsYUFBYSxDQUFDLGVBQWUsQ0FBQztRQUNoRCxNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQywrQkFBK0IsQ0FBQyxDQUFDLENBQUM7UUFDMUUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUUxRCxnQ0FBZ0M7UUFDaEMsTUFBTSxVQUFVLEdBQUcsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxXQUFXLENBQUMsQ0FBQztRQUN2RSxhQUFhLENBQUMsK0JBQStCLEVBQUU7Ozs7Ozs7O0dBUTlDLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFFZixNQUFNLFNBQVMsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxFQUFpQixDQUFDLENBQUM7UUFFaEUsU0FBUyx1QkFBdUIsQ0FBQyxNQUFjLEVBQUUsV0FBNEI7WUFDNUUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3pGLENBQUM7UUFFRCxLQUFLLE1BQU0sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLElBQUksVUFBVSxFQUFFLEVBQUUsQ0FBQztZQUNwRCx1QkFBdUIsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDOUMsQ0FBQztRQUVELFdBQVcsQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFFLENBQUMsdUJBQXVCLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVoSCxXQUFXLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQywwQkFBMEIsQ0FBQyxHQUFHLEVBQUU7WUFDN0QsYUFBYSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDeEQsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLFdBQVcsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNuQyxNQUFNLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBcUIsQ0FBQztZQUN2QyxJQUFJLE1BQU0sRUFBRSxDQUFDO2dCQUNaLE1BQU0sUUFBUSxHQUFHLHNCQUFzQixDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNoRCxXQUFXLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxHQUFHLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQztnQkFDNUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsR0FBRyxRQUFRLENBQUMsSUFBSSxJQUFJLENBQUM7Z0JBQzlDLFdBQVcsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUcsUUFBUSxDQUFDLEtBQUssSUFBSSxDQUFDO2dCQUNoRCxXQUFXLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxNQUFNLElBQUksQ0FBQztnQkFDbEQsV0FBVyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO2dCQUVwQyxxQkFBcUI7Z0JBQ3JCLFVBQVUsQ0FBQyxHQUFHLEVBQUU7b0JBQ2YsV0FBVyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDO2dCQUNwQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDVCxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVKLDBCQUEwQixDQUFDLFVBQVUsR0FBRyxXQUFXLENBQUM7SUFDckQsQ0FBQztDQUNEO0FBRUQsZUFBZSxDQUFDLDBCQUEwQixDQUFDLENBQUMifQ==