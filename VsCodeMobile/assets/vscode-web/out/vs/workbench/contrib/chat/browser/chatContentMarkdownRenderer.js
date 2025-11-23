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
import { $ } from '../../../../base/browser/dom.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import product from '../../../../platform/product/common/product.js';
export const allowedChatMarkdownHtmlTags = Object.freeze([
    'b',
    'blockquote',
    'br',
    'code',
    'del',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'ins',
    'li',
    'ol',
    'p',
    'pre',
    's',
    'strong',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'ul',
    'a',
    'img',
    // TODO@roblourens when we sanitize attributes in markdown source, we can ban these elements at that step. microsoft/vscode-copilot#5091
    // Not in the official list, but used for codicons and other vscode markdown extensions
    'span',
    'div',
    'input', // Allowed for rendering checkboxes. Other types of inputs are removed and the inputs are always disabled
]);
/**
 * This wraps the MarkdownRenderer and applies sanitizer options needed for chat content.
 */
let ChatContentMarkdownRenderer = class ChatContentMarkdownRenderer {
    constructor(languageService, openerService, configurationService, hoverService, markdownRendererService) {
        this.hoverService = hoverService;
        this.markdownRendererService = markdownRendererService;
    }
    render(markdown, options, outElement) {
        options = {
            ...options,
            sanitizerConfig: {
                replaceWithPlaintext: true,
                allowedTags: {
                    override: allowedChatMarkdownHtmlTags,
                },
                ...options?.sanitizerConfig,
                allowedLinkSchemes: { augment: [product.urlProtocol] },
                remoteImageIsAllowed: (_uri) => false,
            }
        };
        const mdWithBody = (markdown && markdown.supportHtml) ?
            {
                ...markdown,
                // dompurify uses DOMParser, which strips leading comments. Wrapping it all in 'body' prevents this.
                // The \n\n prevents marked.js from parsing the body contents as just text in an 'html' token, instead of actual markdown.
                value: `<body>\n\n${markdown.value}</body>`,
            }
            : markdown;
        const result = this.markdownRendererService.render(mdWithBody, options, outElement);
        // In some cases, the renderer can return top level text nodes  but our CSS expects
        // all text to be in a <p> for margin to be applied properly.
        // So just normalize it.
        result.element.normalize();
        for (const child of result.element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
                child.replaceWith($('p', undefined, child.textContent));
            }
        }
        return this.attachCustomHover(result);
    }
    attachCustomHover(result) {
        const store = new DisposableStore();
        // eslint-disable-next-line no-restricted-syntax
        result.element.querySelectorAll('a').forEach((element) => {
            if (element.title) {
                const title = element.title;
                element.title = '';
                store.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate('element'), element, title));
            }
        });
        return {
            element: result.element,
            dispose: () => {
                result.dispose();
                store.dispose();
            }
        };
    }
};
ChatContentMarkdownRenderer = __decorate([
    __param(0, ILanguageService),
    __param(1, IOpenerService),
    __param(2, IConfigurationService),
    __param(3, IHoverService),
    __param(4, IMarkdownRendererService)
], ChatContentMarkdownRenderer);
export { ChatContentMarkdownRenderer };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdENvbnRlbnRNYXJrZG93blJlbmRlcmVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGVudE1hcmtkb3duUmVuZGVyZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRXBELE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBRXBHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN2RSxPQUFPLEVBQXFCLHdCQUF3QixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDeEgsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDbkYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUM5RSxPQUFPLE9BQU8sTUFBTSxnREFBZ0QsQ0FBQztBQUVyRSxNQUFNLENBQUMsTUFBTSwyQkFBMkIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ3hELEdBQUc7SUFDSCxZQUFZO0lBQ1osSUFBSTtJQUNKLE1BQU07SUFDTixLQUFLO0lBQ0wsSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixHQUFHO0lBQ0gsS0FBSztJQUNMLElBQUk7SUFDSixJQUFJO0lBQ0osR0FBRztJQUNILEtBQUs7SUFDTCxHQUFHO0lBQ0gsUUFBUTtJQUNSLEtBQUs7SUFDTCxLQUFLO0lBQ0ws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