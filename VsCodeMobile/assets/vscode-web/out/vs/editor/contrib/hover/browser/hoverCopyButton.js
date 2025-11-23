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
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { localize } from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { SimpleButton } from '../../find/browser/findWidget.js';
import { status } from '../../../../base/browser/ui/aria/aria.js';
/**
 * A button that appears in hover parts to copy their content to the clipboard.
 */
let HoverCopyButton = class HoverCopyButton extends Disposable {
    constructor(_container, _getContent, _clipboardService, _hoverService) {
        super();
        this._container = _container;
        this._getContent = _getContent;
        this._clipboardService = _clipboardService;
        this._hoverService = _hoverService;
        this._container.classList.add('hover-row-with-copy');
        this._button = this._register(new SimpleButton({
            label: localize('hover.copy', "Copy"),
            icon: Codicon.copy,
            onTrigger: () => this._copyContent(),
            className: 'hover-copy-button',
        }, this._hoverService));
        this._container.appendChild(this._button.domNode);
    }
    async _copyContent() {
        const content = this._getContent();
        if (content) {
            await this._clipboardService.writeText(content);
            status(localize('hover.copied', "Copied to clipboard"));
        }
    }
};
HoverCopyButton = __decorate([
    __param(2, IClipboardService),
    __param(3, IHoverService)
], HoverCopyButton);
export { HoverCopyButton };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG92ZXJDb3B5QnV0dG9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2hvdmVyL2Jyb3dzZXIvaG92ZXJDb3B5QnV0dG9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUM5RixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDNUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDaEUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBRWxFOztHQUVHO0FBQ0ksSUFBTSxlQUFlLEdBQXJCLE1BQU0sZUFBZ0IsU0FBUSxVQUFVO0lBSTlDLFlBQ2tCLFVBQXVCLEVBQ3ZCLFdBQXlCLEVBQ04saUJBQW9DLEVBQ3hDLGFBQTRCO1FBRTVELEtBQUssRUFBRSxDQUFDO1FBTFMsZUFBVSxHQUFWLFVBQVUsQ0FBYTtRQUN2QixnQkFBVyxHQUFYLFdBQVcsQ0FBYztRQUNOLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBbUI7UUFDeEMsa0JBQWEsR0FBYixhQUFhLENBQWU7UUFJNUQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFFckQsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksWUFBWSxDQUFDO1lBQzlDLEtBQUssRUFBRSxRQUFRLENBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQztZQUNyQyxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7WUFDbEIsU0FBUyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDcEMsU0FBUyxFQUFFLG1CQUFtQjtTQUM5QixFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1FBRXhCLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVPLEtBQUssQ0FBQyxZQUFZO1FBQ3pCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNuQyxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ2IsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ2hELE1BQU0sQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFLHFCQUFxQixDQUFDLENBQUMsQ0FBQztRQUN6RCxDQUFDO0lBQ0YsQ0FBQztDQUNELENBQUE7QUEvQlksZUFBZTtJQU96QixXQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFdBQUEsYUFBYSxDQUFBO0dBUkgsZUFBZSxDQStCM0IifQ==