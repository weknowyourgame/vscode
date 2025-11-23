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
var BrowserDialogHandler_1;
import { localize } from '../../../../nls.js';
import { AbstractDialogHandler } from '../../../../platform/dialogs/common/dialogs.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import Severity from '../../../../base/common/severity.js';
import { Dialog } from '../../../../base/browser/ui/dialog/dialog.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IMarkdownRendererService, openLinkFromMarkdown } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { createWorkbenchDialogOptions } from '../../../../platform/dialogs/browser/dialog.js';
let BrowserDialogHandler = class BrowserDialogHandler extends AbstractDialogHandler {
    static { BrowserDialogHandler_1 = this; }
    static { this.ALLOWABLE_COMMANDS = [
        'copy',
        'cut',
        'editor.action.selectAll',
        'editor.action.clipboardCopyAction',
        'editor.action.clipboardCutAction',
        'editor.action.clipboardPasteAction'
    ]; }
    constructor(logService, layoutService, keybindingService, instantiationService, clipboardService, openerService, markdownRendererService) {
        super();
        this.logService = logService;
        this.layoutService = layoutService;
        this.keybindingService = keybindingService;
        this.clipboardService = clipboardService;
        this.openerService = openerService;
        this.markdownRendererService = markdownRendererService;
    }
    async prompt(prompt) {
        this.logService.trace('DialogService#prompt', prompt.message);
        const buttons = this.getPromptButtons(prompt);
        const { button, checkboxChecked } = await this.doShow(prompt.type, prompt.message, buttons, prompt.detail, prompt.cancelButton ? buttons.length - 1 : -1 /* Disabled */, prompt.checkbox, undefined, typeof prompt?.custom === 'object' ? prompt.custom : undefined);
        return this.getPromptResult(prompt, button, checkboxChecked);
    }
    async confirm(confirmation) {
        this.logService.trace('DialogService#confirm', confirmation.message);
        const buttons = this.getConfirmationButtons(confirmation);
        const { button, checkboxChecked } = await this.doShow(confirmation.type ?? 'question', confirmation.message, buttons, confirmation.detail, buttons.length - 1, confirmation.checkbox, undefined, typeof confirmation?.custom === 'object' ? confirmation.custom : undefined);
        return { confirmed: button === 0, checkboxChecked };
    }
    async input(input) {
        this.logService.trace('DialogService#input', input.message);
        const buttons = this.getInputButtons(input);
        const { button, checkboxChecked, values } = await this.doShow(input.type ?? 'question', input.message, buttons, input.detail, buttons.length - 1, input?.checkbox, input.inputs, typeof input.custom === 'object' ? input.custom : undefined);
        return { confirmed: button === 0, checkboxChecked, values };
    }
    async about(title, details, detailsToCopy) {
        const { button } = await this.doShow(Severity.Info, title, [
            localize({ key: 'copy', comment: ['&& denotes a mnemonic'] }, "&&Copy"),
            localize('ok', "OK")
        ], details, 1);
        if (button === 0) {
            this.clipboardService.writeText(detailsToCopy);
        }
    }
    async doShow(type, message, buttons, detail, cancelId, checkbox, inputs, customOptions) {
        const dialogDisposables = new DisposableStore();
        const renderBody = customOptions ? (parent) => {
            parent.classList.add(...(customOptions.classes || []));
            customOptions.markdownDetails?.forEach(markdownDetail => {
                const result = dialogDisposables.add(this.markdownRendererService.render(markdownDetail.markdown, {
                    actionHandler: markdownDetail.actionHandler || ((link, mdStr) => {
                        return openLinkFromMarkdown(this.openerService, link, mdStr.isTrusted, true /* skip URL validation to prevent another dialog from showing which is unsupported */);
                    }),
                }));
                parent.appendChild(result.element);
                result.element.classList.add(...(markdownDetail.classes || []));
            });
        } : undefined;
        const dialog = new Dialog(this.layoutService.activeContainer, message, buttons, createWorkbenchDialogOptions({
            detail,
            cancelId,
            type: this.getDialogType(type),
            renderBody,
            icon: customOptions?.icon,
            disableCloseAction: customOptions?.disableCloseAction,
            buttonOptions: customOptions?.buttonDetails?.map(detail => ({ sublabel: detail })),
            checkboxLabel: checkbox?.label,
            checkboxChecked: checkbox?.checked,
            inputs
        }, this.keybindingService, this.layoutService, BrowserDialogHandler_1.ALLOWABLE_COMMANDS));
        dialogDisposables.add(dialog);
        const result = await dialog.show();
        dialogDisposables.dispose();
        return result;
    }
};
BrowserDialogHandler = BrowserDialogHandler_1 = __decorate([
    __param(0, ILogService),
    __param(1, ILayoutService),
    __param(2, IKeybindingService),
    __param(3, IInstantiationService),
    __param(4, IClipboardService),
    __param(5, IOpenerService),
    __param(6, IMarkdownRendererService)
], BrowserDialogHandler);
export { BrowserDialogHandler };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhbG9nSGFuZGxlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9kaWFsb2dzL2RpYWxvZ0hhbmRsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQTRHLHFCQUFxQixFQUEyQyxNQUFNLGdEQUFnRCxDQUFDO0FBQzFPLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN0RixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDckUsT0FBTyxRQUFRLE1BQU0scUNBQXFDLENBQUM7QUFDM0QsT0FBTyxFQUFFLE1BQU0sRUFBaUIsTUFBTSw4Q0FBOEMsQ0FBQztBQUNyRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdkUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDOUYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLG9CQUFvQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDM0gsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBRXZGLElBQU0sb0JBQW9CLEdBQTFCLE1BQU0sb0JBQXFCLFNBQVEscUJBQXFCOzthQUV0Qyx1QkFBa0IsR0FBRztRQUM1QyxNQUFNO1FBQ04sS0FBSztRQUNMLHlCQUF5QjtRQUN6QixtQ0FBbUM7UUFDbkMsa0NBQWtDO1FBQ2xDLG9DQUFvQztLQUNwQyxBQVB5QyxDQU94QztJQUVGLFlBQytCLFVBQXVCLEVBQ3BCLGFBQTZCLEVBQ3pCLGlCQUFxQyxFQUNuRCxvQkFBMkMsRUFDOUIsZ0JBQW1DLEVBQ3RDLGFBQTZCLEVBQ25CLHVCQUFpRDtRQUU1RixLQUFLLEVBQUUsQ0FBQztRQVJzQixlQUFVLEdBQVYsVUFBVSxDQUFhO1FBQ3BCLGtCQUFhLEdBQWIsYUFBYSxDQUFnQjtRQUN6QixzQkFBaUIsR0FBakIsaUJBQWlCLENBQW9CO1FBRXRDLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBbUI7UUFDdEMsa0JBQWEsR0FBYixhQUFhLENBQWdCO1FBQ25CLDRCQUF1QixHQUF2Qix1QkFBdUIsQ0FBMEI7SUFHN0YsQ0FBQztJQUVELEtBQUssQ0FBQyxNQUFNLENBQUksTUFBa0I7UUFDakMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsc0JBQXNCLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTlELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUU5QyxNQUFNLEVBQUUsTUFBTSxFQUFFLGVBQWUsRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsUUFBUSxFQUFFLFNBQVMsRUFBRSxPQUFPLE1BQU0sRUFBRSxNQUFNLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUVyUSxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxlQUFlLENBQUMsQ0FBQztJQUM5RCxDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQU8sQ0FBQyxZQUEyQjtRQUN4QyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFckUsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRTFELE1BQU0sRUFBRSxNQUFNLEVBQUUsZUFBZSxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxJQUFJLElBQUksVUFBVSxFQUFFLFlBQVksQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLFlBQVksQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsWUFBWSxDQUFDLFFBQVEsRUFBRSxTQUFTLEVBQUUsT0FBTyxZQUFZLEVBQUUsTUFBTSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFN1EsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLEtBQUssQ0FBQyxFQUFFLGVBQWUsRUFBRSxDQUFDO0lBQ3JELENBQUM7SUFFRCxLQUFLLENBQUMsS0FBSyxDQUFDLEtBQWE7UUFDeEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMscUJBQXFCLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRTVELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFNUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksVUFBVSxFQUFFLEtBQUssQ0FBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsTUFBTSxFQUFFLE9BQU8sS0FBSyxDQUFDLE1BQU0sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRTlPLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxLQUFLLENBQUMsRUFBRSxlQUFlLEVBQUUsTUFBTSxFQUFFLENBQUM7SUFDN0QsQ0FBQztJQUVELEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBYSxFQUFFLE9BQWUsRUFBRSxhQUFxQjtRQUVoRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUNuQyxRQUFRLENBQUMsSUFBSSxFQUNiLEtBQUssRUFDTDtZQUNDLFFBQVEsQ0FBQyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUMsdUJBQXVCLENBQUMsRUFBRSxFQUFFLFFBQVEsQ0FBQztZQUN2RSxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQztTQUNwQixFQUNELE9BQU8sRUFDUCxDQUFDLENBQ0QsQ0FBQztRQUVGLElBQUksTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ2xCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDaEQsQ0FBQztJQUNGLENBQUM7SUFFTyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQXVDLEVBQUUsT0FBZSxFQUFFLE9BQWtCLEVBQUUsTUFBZSxFQUFFLFFBQWlCLEVBQUUsUUFBb0IsRUFBRSxNQUF3QixFQUFFLGFBQW9DO1FBQzFOLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztRQUVoRCxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBbUIsRUFBRSxFQUFFO1lBQzFELE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDdkQsYUFBYSxDQUFDLGVBQWUsRUFBRSxPQUFPLENBQUMsY0FBYyxDQUFDLEVBQUU7Z0JBQ3ZELE1BQU0sTUFBTSxHQUFHLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUU7b0JBQ2pHLGFBQWEsRUFBRSxjQUFjLENBQUMsYUFBYSxJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEVBQUU7d0JBQy9ELE9BQU8sb0JBQW9CLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMscUZBQXFGLENBQUMsQ0FBQztvQkFDcEssQ0FBQyxDQUFDO2lCQUNGLENBQUMsQ0FBQyxDQUFDO2dCQUNKLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNuQyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNqRSxDQUFDLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBRWQsTUFBTSxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQ3hCLElBQUksQ0FBQyxhQUFhLENBQUMsZUFBZSxFQUNsQyxPQUFPLEVBQ1AsT0FBTyxFQUNQLDRCQUE0QixDQUFDO1lBQzVCLE1BQU07WUFDTixRQUFRO1lBQ1IsSUFBSSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDO1lBQzlCLFVBQVU7WUFDVixJQUFJLEVBQUUsYUFBYSxFQUFFLElBQUk7WUFDekIsa0JBQWtCLEVBQUUsYUFBYSxFQUFFLGtCQUFrQjtZQUNyRCxhQUFhLEVBQUUsYUFBYSxFQUFFLGFBQWEsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7WUFDbEYsYUFBYSxFQUFFLFFBQVEsRUFBRSxLQUFLO1lBQzlCLGVBQWUsRUFBRSxRQUFRLEVBQUUsT0FBTztZQUNsQyxNQUFNO1NBQ04sRUFBRSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFBRSxzQkFBb0IsQ0FBQyxrQkFBa0IsQ0FBQyxDQUN2RixDQUFDO1FBRUYsaUJBQWlCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRTlCLE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ25DLGlCQUFpQixDQUFDLE9BQU8sRUFBRSxDQUFDO1FBRTVCLE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQzs7QUEvR1csb0JBQW9CO0lBWTlCLFdBQUEsV0FBVyxDQUFBO0lBQ1gsV0FBQSxjQUFjLENBQUE7SUFDZCxXQUFBLGtCQUFrQixDQUFBO0lBQ2xCLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxpQkFBaUIsQ0FBQTtJQUNqQixXQUFBLGNBQWMsQ0FBQTtJQUNkLFdBQUEsd0JBQXdCLENBQUE7R0FsQmQsb0JBQW9CLENBZ0hoQyJ9