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
import { generateUuid } from '../../../../base/common/uuid.js';
import { generateTokensCSSForColorMap } from '../../../../editor/common/languages/supports/tokenization.js';
import { TokenizationRegistry } from '../../../../editor/common/languages.js';
import { DEFAULT_MARKDOWN_STYLES, renderMarkdownDocument } from '../../markdown/browser/markdownDocumentRenderer.js';
import { language } from '../../../../base/common/platform.js';
import { joinPath } from '../../../../base/common/resources.js';
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { asWebviewUri } from '../../webview/common/webview.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { gettingStartedContentRegistry } from '../common/gettingStartedContent.js';
let GettingStartedDetailsRenderer = class GettingStartedDetailsRenderer {
    constructor(fileService, notificationService, extensionService, languageService) {
        this.fileService = fileService;
        this.notificationService = notificationService;
        this.extensionService = extensionService;
        this.languageService = languageService;
        this.mdCache = new ResourceMap();
        this.svgCache = new ResourceMap();
    }
    async renderMarkdown(path, base) {
        const content = await this.readAndCacheStepMarkdown(path, base);
        const nonce = generateUuid();
        const colorMap = TokenizationRegistry.getColorMap();
        const css = colorMap ? generateTokensCSSForColorMap(colorMap) : '';
        const inDev = document.location.protocol === 'http:';
        const imgSrcCsp = inDev ? 'img-src https: data: http:' : 'img-src https: data:';
        return `<!DOCTYPE html>
		<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; ${imgSrcCsp}; media-src https:; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
				<style nonce="${nonce}">
					${DEFAULT_MARKDOWN_STYLES}
					${css}
					body > img {
						align-self: flex-start;
					}
					body > img[centered] {
						align-self: center;
					}
					body {
						display: flex;
						flex-direction: column;
						padding: 0;
						height: inherit;
					}
					.theme-picker-row {
						display: flex;
						justify-content: center;
						gap: 32px;
					}
					checklist {
						display: flex;
						gap: 32px;
						flex-direction: column;
					}
					checkbox {
						display: flex;
						flex-direction: column;
						align-items: center;
						margin: 5px;
						cursor: pointer;
					}
					checkbox > img {
						margin-bottom: 8px !important;
					}
					checkbox.checked > img {
						box-sizing: border-box;
					}
					checkbox.checked > img {
						outline: 2px solid var(--vscode-focusBorder);
						outline-offset: 4px;
						border-radius: 4px;
					}
					.theme-picker-link {
						margin-top: 16px;
						color: var(--vscode-textLink-foreground);
					}
					blockquote > p:first-child {
						margin-top: 0;
					}
					body > * {
						margin-block-end: 0.25em;
						margin-block-start: 0.25em;
					}
					vertically-centered {
						padding-top: 5px;
						padding-bottom: 5px;
						display: flex;
						justify-content: center;
						flex-direction: column;
					}
					html {
						height: 100%;
						padding-right: 32px;
					}
					h1 {
						font-size: 19.5px;
					}
					h2 {
						font-size: 18.5px;
					}
				</style>
			</head>
			<body>
				<vertically-centered>
					${content}
				</vertically-centered>
			</body>
			<script nonce="${nonce}">
				const vscode = acquireVsCodeApi();

				document.querySelectorAll('[when-checked]').forEach(el => {
					el.addEventListener('click', () => {
						vscode.postMessage(el.getAttribute('when-checked'));
					});
				});

				let ongoingLayout = undefined;
				const doLayout = () => {
					document.querySelectorAll('vertically-centered').forEach(element => {
						element.style.marginTop = Math.max((document.body.clientHeight - element.scrollHeight) * 3/10, 0) + 'px';
					});
					ongoingLayout = undefined;
				};

				const layout = () => {
					if (ongoingLayout) {
						clearTimeout(ongoingLayout);
					}
					ongoingLayout = setTimeout(doLayout, 0);
				};

				layout();

				document.querySelectorAll('img').forEach(element => {
					element.onload = layout;
				})

				window.addEventListener('message', event => {
					if (event.data.layoutMeNow) {
						layout();
					}
					if (event.data.enabledContextKeys) {
						document.querySelectorAll('.checked').forEach(element => element.classList.remove('checked'))
						for (const key of event.data.enabledContextKeys) {
							document.querySelectorAll('[checked-on="' + key + '"]').forEach(element => element.classList.add('checked'))
						}
					}
				});
		</script>
		</html>`;
    }
    async renderSVG(path) {
        const content = await this.readAndCacheSVGFile(path);
        const nonce = generateUuid();
        const colorMap = TokenizationRegistry.getColorMap();
        const css = colorMap ? generateTokensCSSForColorMap(colorMap) : '';
        return `<!DOCTYPE html>
		<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'nonce-${nonce}';">
				<style nonce="${nonce}">
					${DEFAULT_MARKDOWN_STYLES}
					${css}
					svg {
						position: fixed;
						height: 100%;
						width: 80%;
						left: 50%;
						top: 50%;
						max-width: 530px;
						min-width: 350px;
						transform: translate(-50%,-50%);
					}
				</style>
			</head>
			<body>
				${content}
			</body>
		</html>`;
    }
    async renderVideo(path, poster, description) {
        const nonce = generateUuid();
        return `<!DOCTYPE html>
		<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; media-src https:; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
				<style nonce="${nonce}">
					video {
						max-width: 100%;
						max-height: 100%;
						object-fit: cover;
					}
				</style>
			</head>
			<body>
				<video controls autoplay ${poster ? `poster="${poster.toString(true)}"` : ''} muted ${description ? `aria-label="${description}"` : ''}>
					<source src="${path.toString(true)}" type="video/mp4">
				</video>
			</body>
		</html>`;
    }
    async readAndCacheSVGFile(path) {
        if (!this.svgCache.has(path)) {
            const contents = await this.readContentsOfPath(path, false);
            this.svgCache.set(path, contents);
        }
        return assertReturnsDefined(this.svgCache.get(path));
    }
    async readAndCacheStepMarkdown(path, base) {
        if (!this.mdCache.has(path)) {
            const contents = await this.readContentsOfPath(path);
            const markdownContents = await renderMarkdownDocument(transformUris(contents, base), this.extensionService, this.languageService, {
                sanitizerConfig: {
                    allowedLinkProtocols: {
                        override: '*'
                    },
                    allowedTags: {
                        augment: [
                            'select',
                            'checkbox',
                            'checklist',
                        ]
                    },
                    allowedAttributes: {
                        augment: [
                            'x-dispatch',
                            'data-command',
                            'when-checked',
                            'checked-on',
                            'checked',
                        ]
                    },
                }
            });
            this.mdCache.set(path, markdownContents);
        }
        return assertReturnsDefined(this.mdCache.get(path));
    }
    async readContentsOfPath(path, useModuleId = true) {
        try {
            const moduleId = JSON.parse(path.query).moduleId;
            if (useModuleId && moduleId) {
                const contents = await new Promise((resolve, reject) => {
                    const provider = gettingStartedContentRegistry.getProvider(moduleId);
                    if (!provider) {
                        reject(`Getting started: no provider registered for ${moduleId}`);
                    }
                    else {
                        resolve(provider());
                    }
                });
                return contents;
            }
        }
        catch { }
        try {
            const localizedPath = path.with({ path: path.path.replace(/\.md$/, `.nls.${language}.md`) });
            const generalizedLocale = language?.replace(/-.*$/, '');
            const generalizedLocalizedPath = path.with({ path: path.path.replace(/\.md$/, `.nls.${generalizedLocale}.md`) });
            const fileExists = (file) => this.fileService
                .stat(file)
                .then((stat) => !!stat.size) // Double check the file actually has content for fileSystemProviders that fake `stat`. #131809
                .catch(() => false);
            const [localizedFileExists, generalizedLocalizedFileExists] = await Promise.all([
                fileExists(localizedPath),
                fileExists(generalizedLocalizedPath),
            ]);
            const bytes = await this.fileService.readFile(localizedFileExists
                ? localizedPath
                : generalizedLocalizedFileExists
                    ? generalizedLocalizedPath
                    : path);
            return bytes.value.toString();
        }
        catch (e) {
            this.notificationService.error('Error reading markdown document at `' + path + '`: ' + e);
            return '';
        }
    }
};
GettingStartedDetailsRenderer = __decorate([
    __param(0, IFileService),
    __param(1, INotificationService),
    __param(2, IExtensionService),
    __param(3, ILanguageService)
], GettingStartedDetailsRenderer);
export { GettingStartedDetailsRenderer };
const transformUri = (src, base) => {
    const path = joinPath(base, src);
    return asWebviewUri(path).toString(true);
};
const transformUris = (content, base) => content
    .replace(/src="([^"]*)"/g, (_, src) => {
    if (src.startsWith('https://')) {
        return `src="${src}"`;
    }
    return `src="${transformUri(src, base)}"`;
})
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (_, title, src) => {
    if (src.startsWith('https://')) {
        return `![${title}](${src})`;
    }
    return `![${title}](${transformUri(src, base)})`;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0dGluZ1N0YXJ0ZWREZXRhaWxzUmVuZGVyZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvd2VsY29tZUdldHRpbmdTdGFydGVkL2Jyb3dzZXIvZ2V0dGluZ1N0YXJ0ZWREZXRhaWxzUmVuZGVyZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQzVHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBRXJILE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDaEUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDMUUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDaEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDbkYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDdEYsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFHNUUsSUFBTSw2QkFBNkIsR0FBbkMs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