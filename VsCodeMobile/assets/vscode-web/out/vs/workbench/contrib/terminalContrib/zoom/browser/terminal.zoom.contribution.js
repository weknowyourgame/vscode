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
var TerminalMouseWheelZoomContribution_1;
import { Event } from '../../../../../base/common/event.js';
import { MouseWheelClassifier } from '../../../../../base/browser/ui/scrollbar/scrollableElement.js';
import { Disposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { isMacintosh } from '../../../../../base/common/platform.js';
import { registerTerminalContribution } from '../../../terminal/browser/terminalExtensions.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { registerTerminalAction } from '../../../terminal/browser/terminalActions.js';
import { localize2 } from '../../../../../nls.js';
import { isNumber } from '../../../../../base/common/types.js';
import { defaultTerminalFontSize } from '../../../terminal/common/terminalConfiguration.js';
import * as dom from '../../../../../base/browser/dom.js';
let TerminalMouseWheelZoomContribution = class TerminalMouseWheelZoomContribution extends Disposable {
    static { TerminalMouseWheelZoomContribution_1 = this; }
    static { this.ID = 'terminal.mouseWheelZoom'; }
    static get(instance) {
        return instance.getContribution(TerminalMouseWheelZoomContribution_1.ID);
    }
    constructor(_ctx, _configurationService) {
        super();
        this._configurationService = _configurationService;
        this._listener = this._register(new MutableDisposable());
    }
    xtermOpen(xterm) {
        this._register(Event.runAndSubscribe(this._configurationService.onDidChangeConfiguration, e => {
            if (!e || e.affectsConfiguration("terminal.integrated.mouseWheelZoom" /* TerminalZoomSettingId.MouseWheelZoom */)) {
                if (!!this._configurationService.getValue("terminal.integrated.mouseWheelZoom" /* TerminalZoomSettingId.MouseWheelZoom */)) {
                    this._setupMouseWheelZoomListener(xterm.raw);
                }
                else {
                    this._listener.clear();
                }
            }
        }));
    }
    _getConfigFontSize() {
        return this._configurationService.getValue("terminal.integrated.fontSize" /* TerminalSettingId.FontSize */);
    }
    _clampFontSize(fontSize) {
        return clampTerminalFontSize(fontSize);
    }
    _setupMouseWheelZoomListener(raw) {
        // This is essentially a copy of what we do in the editor, just we modify font size directly
        // as there is no separate zoom level concept in the terminal
        const classifier = MouseWheelClassifier.INSTANCE;
        let prevMouseWheelTime = 0;
        let gestureStartFontSize = this._getConfigFontSize();
        let gestureHasZoomModifiers = false;
        let gestureAccumulatedDelta = 0;
        const wheelListener = (browserEvent) => {
            if (classifier.isPhysicalMouseWheel()) {
                if (this._hasMouseWheelZoomModifiers(browserEvent)) {
                    const delta = browserEvent.deltaY > 0 ? -1 : 1;
                    const newFontSize = this._clampFontSize(this._getConfigFontSize() + delta);
                    this._configurationService.updateValue("terminal.integrated.fontSize" /* TerminalSettingId.FontSize */, newFontSize);
                    // EditorZoom.setZoomLevel(zoomLevel + delta);
                    browserEvent.preventDefault();
                    browserEvent.stopPropagation();
                }
            }
            else {
                // we consider mousewheel events that occur within 50ms of each other to be part of the same gesture
                // we don't want to consider mouse wheel events where ctrl/cmd is pressed during the inertia phase
                // we also want to accumulate deltaY values from the same gesture and use that to set the zoom level
                if (Date.now() - prevMouseWheelTime > 50) {
                    // reset if more than 50ms have passed
                    gestureStartFontSize = this._getConfigFontSize();
                    gestureHasZoomModifiers = this._hasMouseWheelZoomModifiers(browserEvent);
                    gestureAccumulatedDelta = 0;
                }
                prevMouseWheelTime = Date.now();
                gestureAccumulatedDelta += browserEvent.deltaY;
                if (gestureHasZoomModifiers) {
                    const deltaAbs = Math.ceil(Math.abs(gestureAccumulatedDelta / 5));
                    const deltaDirection = gestureAccumulatedDelta > 0 ? -1 : 1;
                    const delta = deltaAbs * deltaDirection;
                    const newFontSize = this._clampFontSize(gestureStartFontSize + delta);
                    this._configurationService.updateValue("terminal.integrated.fontSize" /* TerminalSettingId.FontSize */, newFontSize);
                    gestureAccumulatedDelta += browserEvent.deltaY;
                    browserEvent.preventDefault();
                    browserEvent.stopPropagation();
                }
            }
        };
        // Use the capture phase to ensure we catch the event before the terminal's scrollable element consumes it
        this._listener.value = dom.addDisposableListener(raw.element, dom.EventType.MOUSE_WHEEL, wheelListener, { capture: true, passive: false });
    }
    _hasMouseWheelZoomModifiers(browserEvent) {
        return (isMacintosh
            // on macOS we support cmd + two fingers scroll (`metaKey` set)
            // and also the two fingers pinch gesture (`ctrKey` set)
            ? ((browserEvent.metaKey || browserEvent.ctrlKey) && !browserEvent.shiftKey && !browserEvent.altKey)
            : (browserEvent.ctrlKey && !browserEvent.metaKey && !browserEvent.shiftKey && !browserEvent.altKey));
    }
};
TerminalMouseWheelZoomContribution = TerminalMouseWheelZoomContribution_1 = __decorate([
    __param(1, IConfigurationService)
], TerminalMouseWheelZoomContribution);
registerTerminalContribution(TerminalMouseWheelZoomContribution.ID, TerminalMouseWheelZoomContribution, true);
registerTerminalAction({
    id: "workbench.action.terminal.fontZoomIn" /* TerminalZoomCommandId.FontZoomIn */,
    title: localize2('fontZoomIn', 'Increase Font Size'),
    run: async (c, accessor) => {
        const configurationService = accessor.get(IConfigurationService);
        const value = configurationService.getValue("terminal.integrated.fontSize" /* TerminalSettingId.FontSize */);
        if (isNumber(value)) {
            const newFontSize = clampTerminalFontSize(value + 1);
            await configurationService.updateValue("terminal.integrated.fontSize" /* TerminalSettingId.FontSize */, newFontSize);
        }
    }
});
registerTerminalAction({
    id: "workbench.action.terminal.fontZoomOut" /* TerminalZoomCommandId.FontZoomOut */,
    title: localize2('fontZoomOut', 'Decrease Font Size'),
    run: async (c, accessor) => {
        const configurationService = accessor.get(IConfigurationService);
        const value = configurationService.getValue("terminal.integrated.fontSize" /* TerminalSettingId.FontSize */);
        if (isNumber(value)) {
            const newFontSize = clampTerminalFontSize(value - 1);
            await configurationService.updateValue("terminal.integrated.fontSize" /* TerminalSettingId.FontSize */, newFontSize);
        }
    }
});
registerTerminalAction({
    id: "workbench.action.terminal.fontZoomReset" /* TerminalZoomCommandId.FontZoomReset */,
    title: localize2('fontZoomReset', 'Reset Font Size'),
    run: async (c, accessor) => {
        const configurationService = accessor.get(IConfigurationService);
        await configurationService.updateValue("terminal.integrated.fontSize" /* TerminalSettingId.FontSize */, defaultTerminalFontSize);
    }
});
export function clampTerminalFontSize(fontSize) {
    return Math.max(6, Math.min(100, fontSize));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWwuem9vbS5jb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL3pvb20vYnJvd3Nlci90ZXJtaW5hbC56b29tLmNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRTVELE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN4RixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFHckUsT0FBTyxFQUFFLDRCQUE0QixFQUEwRixNQUFNLGlEQUFpRCxDQUFDO0FBQ3ZMLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNsRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDL0QsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFFNUYsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQ0FBb0MsQ0FBQztBQUUxRCxJQUFNLGtDQUFrQyxHQUF4QyxNQUFNLGtDQUFtQyxTQUFRLFVBQVU7O2FBQzFDLE9BQUUsR0FBRyx5QkFBeUIsQUFBNUIsQ0FBNkI7SUFRL0MsTUFBTSxDQUFDLEdBQUcsQ0FBQyxRQUF1RDtRQUNqRSxPQUFPLFFBQVEsQ0FBQyxlQUFlLENBQXFDLG9DQUFrQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzVHLENBQUM7SUFJRCxZQUNDLElBQW1GLEVBQzVELHFCQUE2RDtRQUVwRixLQUFLLEVBQUUsQ0FBQztRQUZnQywwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO1FBSnBFLGNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO0lBT3JFLENBQUM7SUFFRCxTQUFTLENBQUMsS0FBaUQ7UUFDMUQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDLENBQUMsRUFBRTtZQUM3RixJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxvQkFBb0IsaUZBQXNDLEVBQUUsQ0FBQztnQkFDeEUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsaUZBQXNDLEVBQUUsQ0FBQztvQkFDakYsSUFBSSxDQUFDLDRCQUE0QixDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDOUMsQ0FBQztxQkFBTSxDQUFDO29CQUNQLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ3hCLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyxrQkFBa0I7UUFDekIsT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxpRUFBNEIsQ0FBQztJQUN4RSxDQUFDO0lBRU8sY0FBYyxDQUFDLFFBQWdCO1FBQ3RDLE9BQU8scUJBQXFCLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDeEMsQ0FBQztJQUVPLDRCQUE0QixDQUFDLEdBQXFCO1FBQ3pELDRGQUE0RjtRQUM1Riw2REFBNkQ7UUFDN0QsTUFBTSxVQUFVLEdBQUcsb0JBQW9CLENBQUMsUUFBUSxDQUFDO1FBRWpELElBQUksa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO1FBQzNCLElBQUksb0JBQW9CLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDckQsSUFBSSx1QkFBdUIsR0FBRyxLQUFLLENBQUM7UUFDcEMsSUFBSSx1QkFBdUIsR0FBRyxDQUFDLENBQUM7UUFFaEMsTUFBTSxhQUFhLEdBQUcsQ0FBQyxZQUF3QixFQUFFLEVBQUU7WUFDbEQsSUFBSSxVQUFVLENBQUMsb0JBQW9CLEVBQUUsRUFBRSxDQUFDO2dCQUN2QyxJQUFJLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO29CQUNwRCxNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDL0MsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQztvQkFDM0UsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFdBQVcsa0VBQTZCLFdBQVcsQ0FBQyxDQUFDO29CQUNoRiw4Q0FBOEM7b0JBQzlDLFlBQVksQ0FBQyxjQUFjLEVBQUUsQ0FBQztvQkFDOUIsWUFBWSxDQUFDLGVBQWUsRUFBRSxDQUFDO2dCQUNoQyxDQUFDO1lBQ0YsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLG9HQUFvRztnQkFDcEcsa0dBQWtHO2dCQUNsRyxvR0FBb0c7Z0JBQ3BHLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLGtCQUFrQixHQUFHLEVBQUUsRUFBRSxDQUFDO29CQUMxQyxzQ0FBc0M7b0JBQ3RDLG9CQUFvQixHQUFHLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO29CQUNqRCx1QkFBdUIsR0FBRyxJQUFJLENBQUMsMkJBQTJCLENBQUMsWUFBWSxDQUFDLENBQUM7b0JBQ3pFLHVCQUF1QixHQUFHLENBQUMsQ0FBQztnQkFDN0IsQ0FBQztnQkFFRCxrQkFBa0IsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ2hDLHVCQUF1QixJQUFJLFlBQVksQ0FBQyxNQUFNLENBQUM7Z0JBRS9DLElBQUksdUJBQXVCLEVBQUUsQ0FBQztvQkFDN0IsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLHVCQUF1QixHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2xFLE1BQU0sY0FBYyxHQUFHLHVCQUF1QixHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDNUQsTUFBTSxLQUFLLEdBQUcsUUFBUSxHQUFHLGNBQWMsQ0FBQztvQkFDeEMsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxvQkFBb0IsR0FBRyxLQUFLLENBQUMsQ0FBQztvQkFDdEUsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFdBQVcsa0VBQTZCLFdBQVcsQ0FBQyxDQUFDO29CQUNoRix1QkFBdUIsSUFBSSxZQUFZLENBQUMsTUFBTSxDQUFDO29CQUMvQyxZQUFZLENBQUMsY0FBYyxFQUFFLENBQUM7b0JBQzlCLFlBQVksQ0FBQyxlQUFlLEVBQUUsQ0FBQztnQkFDaEMsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDLENBQUM7UUFFRiwwR0FBMEc7UUFDMUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxPQUFRLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsYUFBYSxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUM3SSxDQUFDO0lBRU8sMkJBQTJCLENBQUMsWUFBMkM7UUFDOUUsT0FBTyxDQUNOLFdBQVc7WUFDViwrREFBK0Q7WUFDL0Qsd0RBQXdEO1lBQ3hELENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE9BQU8sSUFBSSxZQUFZLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQztZQUNwRyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQ3BHLENBQUM7SUFDSCxDQUFDOztBQXJHSSxrQ0FBa0M7SUFpQnJDLFdBQUEscUJBQXFCLENBQUE7R0FqQmxCLGtDQUFrQyxDQXNHdkM7QUFFRCw0QkFBNEIsQ0FBQyxrQ0FBa0MsQ0FBQyxFQUFFLEVBQUUsa0NBQWtDLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFFOUcsc0JBQXNCLENBQUM7SUFDdEIsRUFBRSwrRUFBa0M7SUFDcEMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxZQUFZLEVBQUUsb0JBQW9CLENBQUM7SUFDcEQsR0FBRyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUU7UUFDMUIsTUFBTSxvQkFBb0IsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDakUsTUFBTSxLQUFLLEdBQUcsb0JBQW9CLENBQUMsUUFBUSxpRUFBNEIsQ0FBQztRQUN4RSxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3JCLE1BQU0sV0FBVyxHQUFHLHFCQUFxQixDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNyRCxNQUFNLG9CQUFvQixDQUFDLFdBQVcsa0VBQTZCLFdBQVcsQ0FBQyxDQUFDO1FBQ2pGLENBQUM7SUFDRixDQUFDO0NBQ0QsQ0FBQyxDQUFDO0FBRUgsc0JBQXNCLENBQUM7SUFDdEIsRUFBRSxpRkFBbUM7SUFDckMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxhQUFhLEVBQUUsb0JBQW9CLENBQUM7SUFDckQsR0FBRyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUU7UUFDMUIsTUFBTSxvQkFBb0IsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDakUsTUFBTSxLQUFLLEdBQUcsb0JBQW9CLENBQUMsUUFBUSxpRUFBNEIsQ0FBQztRQUN4RSxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3JCLE1BQU0sV0FBVyxHQUFHLHFCQUFxQixDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNyRCxNQUFNLG9CQUFvQixDQUFDLFdBQVcsa0VBQTZCLFdBQVcsQ0FBQyxDQUFDO1FBQ2pGLENBQUM7SUFDRixDQUFDO0NBQ0QsQ0FBQyxDQUFDO0FBRUgsc0JBQXNCLENBQUM7SUFDdEIsRUFBRSxxRkFBcUM7SUFDdkMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxlQUFlLEVBQUUsaUJBQWlCLENBQUM7SUFDcEQsR0FBRyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUU7UUFDMUIsTUFBTSxvQkFBb0IsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDakUsTUFBTSxvQkFBb0IsQ0FBQyxXQUFXLGtFQUE2Qix1QkFBdUIsQ0FBQyxDQUFDO0lBQzdGLENBQUM7Q0FDRCxDQUFDLENBQUM7QUFFSCxNQUFNLFVBQVUscUJBQXFCLENBQUMsUUFBZ0I7SUFDckQsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQzdDLENBQUMifQ==