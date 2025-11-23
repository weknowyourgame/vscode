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
import { addDisposableListener, getActiveElement, getShadowRoot } from '../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
let FocusTracker = class FocusTracker extends Disposable {
    constructor(_logService, _domNode, _onFocusChange) {
        super();
        this._domNode = _domNode;
        this._onFocusChange = _onFocusChange;
        this._isFocused = false;
        this._isPaused = false;
        this._register(addDisposableListener(this._domNode, 'focus', () => {
            _logService.trace('NativeEditContext.focus');
            if (this._isPaused) {
                return;
            }
            // Here we don't trust the browser and instead we check
            // that the active element is the one we are tracking
            // (this happens when cmd+tab is used to switch apps)
            this.refreshFocusState();
        }));
        this._register(addDisposableListener(this._domNode, 'blur', () => {
            _logService.trace('NativeEditContext.blur');
            if (this._isPaused) {
                return;
            }
            this._handleFocusedChanged(false);
        }));
    }
    pause() {
        this._isPaused = true;
    }
    resume() {
        this._isPaused = false;
        this.refreshFocusState();
    }
    _handleFocusedChanged(focused) {
        if (this._isFocused === focused) {
            return;
        }
        this._isFocused = focused;
        this._onFocusChange(this._isFocused);
    }
    focus() {
        this._domNode.focus();
        this.refreshFocusState();
    }
    refreshFocusState() {
        const shadowRoot = getShadowRoot(this._domNode);
        const activeElement = shadowRoot ? shadowRoot.activeElement : getActiveElement();
        const focused = this._domNode === activeElement;
        this._handleFocusedChanged(focused);
    }
    get isFocused() {
        return this._isFocused;
    }
};
FocusTracker = __decorate([
    __param(0, ILogService)
], FocusTracker);
export { FocusTracker };
export function editContextAddDisposableListener(target, type, listener, options) {
    // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
    target.addEventListener(type, listener, options);
    return {
        dispose() {
            // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
            target.removeEventListener(type, listener);
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmF0aXZlRWRpdENvbnRleHRVdGlscy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvYnJvd3Nlci9jb250cm9sbGVyL2VkaXRDb250ZXh0L25hdGl2ZS9uYXRpdmVFZGl0Q29udGV4dFV0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM1RyxPQUFPLEVBQWUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDbEYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBU2pFLElBQU0sWUFBWSxHQUFsQixNQUFNLFlBQWEsU0FBUSxVQUFVO0lBSTNDLFlBQ2MsV0FBd0IsRUFDcEIsUUFBcUIsRUFDckIsY0FBZ0Q7UUFFakUsS0FBSyxFQUFFLENBQUM7UUFIUyxhQUFRLEdBQVIsUUFBUSxDQUFhO1FBQ3JCLG1CQUFjLEdBQWQsY0FBYyxDQUFrQztRQU4xRCxlQUFVLEdBQVksS0FBSyxDQUFDO1FBQzVCLGNBQVMsR0FBWSxLQUFLLENBQUM7UUFRbEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUU7WUFDakUsV0FBVyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1lBQzdDLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNwQixPQUFPO1lBQ1IsQ0FBQztZQUNELHVEQUF1RDtZQUN2RCxxREFBcUQ7WUFDckQscURBQXFEO1lBQ3JELElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQzFCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDSixJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRTtZQUNoRSxXQUFXLENBQUMsS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUM7WUFDNUMsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ3BCLE9BQU87WUFDUixDQUFDO1lBQ0QsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ25DLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU0sS0FBSztRQUNYLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO0lBQ3ZCLENBQUM7SUFFTSxNQUFNO1FBQ1osSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7UUFDdkIsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7SUFDMUIsQ0FBQztJQUVPLHFCQUFxQixDQUFDLE9BQWdCO1FBQzdDLElBQUksSUFBSSxDQUFDLFVBQVUsS0FBSyxPQUFPLEVBQUUsQ0FBQztZQUNqQyxPQUFPO1FBQ1IsQ0FBQztRQUNELElBQUksQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDO1FBQzFCLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFFTSxLQUFLO1FBQ1gsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUN0QixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztJQUMxQixDQUFDO0lBRU0saUJBQWlCO1FBQ3ZCLE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDaEQsTUFBTSxhQUFhLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ2pGLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLEtBQUssYUFBYSxDQUFDO1FBQ2hELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRUQsSUFBSSxTQUFTO1FBQ1osT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO0lBQ3hCLENBQUM7Q0FDRCxDQUFBO0FBN0RZLFlBQVk7SUFLdEIsV0FBQSxXQUFXLENBQUE7R0FMRCxZQUFZLENBNkR4Qjs7QUFFRCxNQUFNLFVBQVUsZ0NBQWdDLENBQW1ELE1BQW1CLEVBQUUsSUFBTyxFQUFFLFFBQXNGLEVBQUUsT0FBMkM7SUFDblEsdUZBQXVGO0lBQ3ZGLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsUUFBZSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3hELE9BQU87UUFDTixPQUFPO1lBQ04sdUZBQXVGO1lBQ3ZGLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsUUFBZSxDQUFDLENBQUM7UUFDbkQsQ0FBQztLQUNELENBQUM7QUFDSCxDQUFDIn0=