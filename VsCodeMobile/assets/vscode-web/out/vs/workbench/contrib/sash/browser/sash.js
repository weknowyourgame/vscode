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
import { clamp } from '../../../../base/common/numbers.js';
import { setGlobalSashSize, setGlobalHoverDelay } from '../../../../base/browser/ui/sash/sash.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { createStyleSheet } from '../../../../base/browser/domStylesheets.js';
export const minSize = 1;
export const maxSize = 20; // see also https://ux.stackexchange.com/questions/39023/what-is-the-optimum-button-size-of-touch-screen-applications
let SashSettingsController = class SashSettingsController extends Disposable {
    static { this.ID = 'workbench.contrib.sash'; }
    constructor(configurationService) {
        super();
        this.configurationService = configurationService;
        this.styleSheet = createStyleSheet();
        const onDidChangeSize = Event.filter(configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('workbench.sash.size'));
        onDidChangeSize(this.onDidChangeSize, this, this._store);
        this.onDidChangeSize();
        const onDidChangeHoverDelay = Event.filter(configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('workbench.sash.hoverDelay'));
        onDidChangeHoverDelay(this.onDidChangeHoverDelay, this, this._store);
        this.onDidChangeHoverDelay();
    }
    onDidChangeSize() {
        const configuredSize = this.configurationService.getValue('workbench.sash.size');
        const size = clamp(configuredSize, 4, 20);
        const hoverSize = clamp(configuredSize, 1, 8);
        this.styleSheet.textContent = `
			.monaco-workbench {
				--vscode-sash-size: ${size}px;
				--vscode-sash-hover-size: ${hoverSize}px;
			}
		`;
        setGlobalSashSize(size);
    }
    onDidChangeHoverDelay() {
        setGlobalHoverDelay(this.configurationService.getValue('workbench.sash.hoverDelay'));
    }
};
SashSettingsController = __decorate([
    __param(0, IConfigurationService)
], SashSettingsController);
export { SashSettingsController };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2FzaC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9zYXNoL2Jyb3dzZXIvc2FzaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDM0QsT0FBTyxFQUFFLGlCQUFpQixFQUFFLG1CQUFtQixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUVuRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUU5RSxNQUFNLENBQUMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDO0FBQ3pCLE1BQU0sQ0FBQyxNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUMsQ0FBQyxxSEFBcUg7QUFFekksSUFBTSxzQkFBc0IsR0FBNUIsTUFBTSxzQkFBdUIsU0FBUSxVQUFVO2FBRXJDLE9BQUUsR0FBRyx3QkFBd0IsQUFBM0IsQ0FBNEI7SUFJOUMsWUFDd0Isb0JBQTREO1FBRW5GLEtBQUssRUFBRSxDQUFDO1FBRmdDLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBdUI7UUFIbkUsZUFBVSxHQUFHLGdCQUFnQixFQUFFLENBQUM7UUFPaEQsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUM7UUFDeEksZUFBZSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN6RCxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7UUFFdkIsTUFBTSxxQkFBcUIsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLG9CQUFvQixDQUFDLHdCQUF3QixFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQztRQUNwSixxQkFBcUIsQ0FBQyxJQUFJLENBQUMscUJBQXFCLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNyRSxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztJQUM5QixDQUFDO0lBRU8sZUFBZTtRQUN0QixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsUUFBUSxDQUFTLHFCQUFxQixDQUFDLENBQUM7UUFDekYsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDMUMsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLGNBQWMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFOUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLEdBQUc7OzBCQUVOLElBQUk7Z0NBQ0UsU0FBUzs7R0FFdEMsQ0FBQztRQUVGLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pCLENBQUM7SUFFTyxxQkFBcUI7UUFDNUIsbUJBQW1CLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFFBQVEsQ0FBUywyQkFBMkIsQ0FBQyxDQUFDLENBQUM7SUFDOUYsQ0FBQzs7QUFyQ1csc0JBQXNCO0lBT2hDLFdBQUEscUJBQXFCLENBQUE7R0FQWCxzQkFBc0IsQ0FzQ2xDIn0=