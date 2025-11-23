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
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { MainContext } from '../common/extHost.protocol.js';
import { IClipboardService } from '../../../platform/clipboard/common/clipboardService.js';
import { ILogService } from '../../../platform/log/common/log.js';
let MainThreadClipboard = class MainThreadClipboard {
    constructor(_context, _clipboardService, _logService) {
        this._clipboardService = _clipboardService;
        this._logService = _logService;
    }
    dispose() {
        // nothing
    }
    $readText() {
        this._logService.trace('MainThreadClipboard#readText');
        const readText = this._clipboardService.readText();
        return readText;
    }
    $writeText(value) {
        this._logService.trace('MainThreadClipboard#writeText with text.length : ', value.length);
        return this._clipboardService.writeText(value);
    }
};
MainThreadClipboard = __decorate([
    extHostNamedCustomer(MainContext.MainThreadClipboard),
    __param(1, IClipboardService),
    __param(2, ILogService)
], MainThreadClipboard);
export { MainThreadClipboard };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZENsaXBib2FyZC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZENsaXBib2FyZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsb0JBQW9CLEVBQW1CLE1BQU0sc0RBQXNELENBQUM7QUFDN0csT0FBTyxFQUFFLFdBQVcsRUFBNEIsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUMzRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFHM0QsSUFBTSxtQkFBbUIsR0FBekIsTUFBTSxtQkFBbUI7SUFFL0IsWUFDQyxRQUF5QixFQUNXLGlCQUFvQyxFQUMxQyxXQUF3QjtRQURsQixzQkFBaUIsR0FBakIsaUJBQWlCLENBQW1CO1FBQzFDLGdCQUFXLEdBQVgsV0FBVyxDQUFhO0lBQ25ELENBQUM7SUFFTCxPQUFPO1FBQ04sVUFBVTtJQUNYLENBQUM7SUFFRCxTQUFTO1FBQ1IsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsOEJBQThCLENBQUMsQ0FBQztRQUN2RCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDbkQsT0FBTyxRQUFRLENBQUM7SUFDakIsQ0FBQztJQUVELFVBQVUsQ0FBQyxLQUFhO1FBQ3ZCLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLG1EQUFtRCxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMxRixPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDaEQsQ0FBQztDQUNELENBQUE7QUF0QlksbUJBQW1CO0lBRC9CLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQztJQUtuRCxXQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFdBQUEsV0FBVyxDQUFBO0dBTEQsbUJBQW1CLENBc0IvQiJ9