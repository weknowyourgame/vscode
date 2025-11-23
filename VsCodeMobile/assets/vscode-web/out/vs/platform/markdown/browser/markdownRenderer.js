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
import { renderMarkdown } from '../../../base/browser/markdownRenderer.js';
import { onUnexpectedError } from '../../../base/common/errors.js';
import { registerSingleton } from '../../instantiation/common/extensions.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { IOpenerService } from '../../opener/common/opener.js';
export const IMarkdownRendererService = createDecorator('markdownRendererService');
let MarkdownRendererService = class MarkdownRendererService {
    constructor(_openerService) {
        this._openerService = _openerService;
    }
    render(markdown, options, outElement) {
        const resolvedOptions = { ...options };
        if (!resolvedOptions.actionHandler) {
            resolvedOptions.actionHandler = (link, mdStr) => {
                return openLinkFromMarkdown(this._openerService, link, mdStr.isTrusted);
            };
        }
        if (!resolvedOptions.codeBlockRenderer) {
            resolvedOptions.codeBlockRenderer = (alias, value) => {
                return this._defaultCodeBlockRenderer?.renderCodeBlock(alias, value, resolvedOptions ?? {}) ?? Promise.resolve(document.createElement('span'));
            };
        }
        const rendered = renderMarkdown(markdown, resolvedOptions, outElement);
        rendered.element.classList.add('rendered-markdown');
        return rendered;
    }
    setDefaultCodeBlockRenderer(renderer) {
        this._defaultCodeBlockRenderer = renderer;
    }
};
MarkdownRendererService = __decorate([
    __param(0, IOpenerService)
], MarkdownRendererService);
export { MarkdownRendererService };
export async function openLinkFromMarkdown(openerService, link, isTrusted, skipValidation) {
    try {
        return await openerService.open(link, {
            fromUserGesture: true,
            allowContributedOpeners: true,
            allowCommands: toAllowCommandsOption(isTrusted),
            skipValidation
        });
    }
    catch (e) {
        onUnexpectedError(e);
        return false;
    }
}
function toAllowCommandsOption(isTrusted) {
    if (isTrusted === true) {
        return true; // Allow all commands
    }
    if (isTrusted && Array.isArray(isTrusted.enabledCommands)) {
        return isTrusted.enabledCommands; // Allow subset of commands
    }
    return false; // Block commands
}
registerSingleton(IMarkdownRendererService, MarkdownRendererService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFya2Rvd25SZW5kZXJlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9tYXJrZG93bi9icm93c2VyL21hcmtkb3duUmVuZGVyZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUE0QyxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUNySCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVuRSxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQXlCL0QsTUFBTSxDQUFDLE1BQU0sd0JBQXdCLEdBQUcsZUFBZSxDQUEyQix5QkFBeUIsQ0FBQyxDQUFDO0FBbUJ0RyxJQUFNLHVCQUF1QixHQUE3QixNQUFNLHVCQUF1QjtJQUtuQyxZQUNrQyxjQUE4QjtRQUE5QixtQkFBYyxHQUFkLGNBQWMsQ0FBZ0I7SUFDNUQsQ0FBQztJQUVMLE1BQU0sQ0FBQyxRQUF5QixFQUFFLE9BQStELEVBQUUsVUFBd0I7UUFDMUgsTUFBTSxlQUFlLEdBQUcsRUFBRSxHQUFHLE9BQU8sRUFBRSxDQUFDO1FBRXZDLElBQUksQ0FBQyxlQUFlLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDcEMsZUFBZSxDQUFDLGFBQWEsR0FBRyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsRUFBRTtnQkFDL0MsT0FBTyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDekUsQ0FBQyxDQUFDO1FBQ0gsQ0FBQztRQUVELElBQUksQ0FBQyxlQUFlLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUN4QyxlQUFlLENBQUMsaUJBQWlCLEdBQUcsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEVBQUU7Z0JBQ3BELE9BQU8sSUFBSSxDQUFDLHlCQUF5QixFQUFFLGVBQWUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLGVBQWUsSUFBSSxFQUFFLENBQUMsSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUNoSixDQUFDLENBQUM7UUFDSCxDQUFDO1FBRUQsTUFBTSxRQUFRLEdBQUcsY0FBYyxDQUFDLFFBQVEsRUFBRSxlQUFlLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDdkUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUM7UUFDcEQsT0FBTyxRQUFRLENBQUM7SUFDakIsQ0FBQztJQUVELDJCQUEyQixDQUFDLFFBQW9DO1FBQy9ELElBQUksQ0FBQyx5QkFBeUIsR0FBRyxRQUFRLENBQUM7SUFDM0MsQ0FBQztDQUNELENBQUE7QUFoQ1ksdUJBQXVCO0lBTWpDLFdBQUEsY0FBYyxDQUFBO0dBTkosdUJBQXVCLENBZ0NuQzs7QUFFRCxNQUFNLENBQUMsS0FBSyxVQUFVLG9CQUFvQixDQUFDLGFBQTZCLEVBQUUsSUFBWSxFQUFFLFNBQTZELEVBQUUsY0FBd0I7SUFDOUssSUFBSSxDQUFDO1FBQ0osT0FBTyxNQUFNLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFO1lBQ3JDLGVBQWUsRUFBRSxJQUFJO1lBQ3JCLHVCQUF1QixFQUFFLElBQUk7WUFDN0IsYUFBYSxFQUFFLHFCQUFxQixDQUFDLFNBQVMsQ0FBQztZQUMvQyxjQUFjO1NBQ2QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDWixpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyQixPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7QUFDRixDQUFDO0FBRUQsU0FBUyxxQkFBcUIsQ0FBQyxTQUE2RDtJQUMzRixJQUFJLFNBQVMsS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUN4QixPQUFPLElBQUksQ0FBQyxDQUFDLHFCQUFxQjtJQUNuQyxDQUFDO0lBRUQsSUFBSSxTQUFTLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLEVBQUUsQ0FBQztRQUMzRCxPQUFPLFNBQVMsQ0FBQyxlQUFlLENBQUMsQ0FBQywyQkFBMkI7SUFDOUQsQ0FBQztJQUVELE9BQU8sS0FBSyxDQUFDLENBQUMsaUJBQWlCO0FBQ2hDLENBQUM7QUFFRCxpQkFBaUIsQ0FBQyx3QkFBd0IsRUFBRSx1QkFBdUIsb0NBQTRCLENBQUMifQ==