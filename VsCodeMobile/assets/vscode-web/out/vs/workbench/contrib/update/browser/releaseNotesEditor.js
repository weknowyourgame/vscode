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
import './media/releasenoteseditor.css';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { escapeMarkdownSyntaxTokens } from '../../../../base/common/htmlContent.js';
import { KeybindingParser } from '../../../../base/common/keybindingParser.js';
import { escape } from '../../../../base/common/strings.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { TokenizationRegistry } from '../../../../editor/common/languages.js';
import { generateTokensCSSForColorMap } from '../../../../editor/common/languages/supports/tokenization.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import * as nls from '../../../../nls.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { asTextOrError, IRequestService } from '../../../../platform/request/common/request.js';
import { DEFAULT_MARKDOWN_STYLES, renderMarkdownDocument } from '../../markdown/browser/markdownDocumentRenderer.js';
import { IWebviewWorkbenchService } from '../../webviewPanel/browser/webviewWorkbenchService.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { ACTIVE_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { getTelemetryLevel, supportsTelemetry } from '../../../../platform/telemetry/common/telemetryUtils.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { SimpleSettingRenderer } from '../../markdown/browser/markdownSettingRenderer.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Schemas } from '../../../../base/common/network.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { dirname } from '../../../../base/common/resources.js';
import { asWebviewUri } from '../../webview/common/webview.js';
let ReleaseNotesManager = class ReleaseNotesManager extends Disposable {
    constructor(_environmentService, _keybindingService, _languageService, _openerService, _requestService, _configurationService, _editorService, _editorGroupService, _codeEditorService, _webviewWorkbenchService, _extensionService, _productService, _instantiationService) {
        super();
        this._environmentService = _environmentService;
        this._keybindingService = _keybindingService;
        this._languageService = _languageService;
        this._openerService = _openerService;
        this._requestService = _requestService;
        this._configurationService = _configurationService;
        this._editorService = _editorService;
        this._editorGroupService = _editorGroupService;
        this._codeEditorService = _codeEditorService;
        this._webviewWorkbenchService = _webviewWorkbenchService;
        this._extensionService = _extensionService;
        this._productService = _productService;
        this._instantiationService = _instantiationService;
        this._releaseNotesCache = new Map();
        this._currentReleaseNotes = undefined;
        this._register(TokenizationRegistry.onDidChange(() => {
            return this.updateHtml();
        }));
        this._register(_configurationService.onDidChangeConfiguration(this.onDidChangeConfiguration));
        this._register(_webviewWorkbenchService.onDidChangeActiveWebviewEditor(this.onDidChangeActiveWebviewEditor));
        this._simpleSettingRenderer = this._instantiationService.createInstance(SimpleSettingRenderer);
    }
    async updateHtml() {
        if (!this._currentReleaseNotes || !this._lastMeta) {
            return;
        }
        const html = await this.renderBody(this._lastMeta);
        if (this._currentReleaseNotes) {
            this._currentReleaseNotes.webview.setHtml(html);
        }
    }
    async getBase(useCurrentFile) {
        if (useCurrentFile) {
            const currentFileUri = this._codeEditorService.getActiveCodeEditor()?.getModel()?.uri;
            if (currentFileUri) {
                return dirname(currentFileUri);
            }
        }
        return URI.parse('https://code.visualstudio.com/raw');
    }
    async show(version, useCurrentFile) {
        const releaseNoteText = await this.loadReleaseNotes(version, useCurrentFile);
        const base = await this.getBase(useCurrentFile);
        this._lastMeta = { text: releaseNoteText, base };
        const html = await this.renderBody(this._lastMeta);
        const title = nls.localize('releaseNotesInputName', "Release Notes: {0}", version);
        const activeEditorPane = this._editorService.activeEditorPane;
        if (this._currentReleaseNotes) {
            this._currentReleaseNotes.setWebviewTitle(title);
            this._currentReleaseNotes.webview.setHtml(html);
            this._webviewWorkbenchService.revealWebview(this._currentReleaseNotes, activeEditorPane ? activeEditorPane.group : this._editorGroupService.activeGroup, false);
        }
        else {
            this._currentReleaseNotes = this._webviewWorkbenchService.openWebview({
                title,
                options: {
                    tryRestoreScrollPosition: true,
                    enableFindWidget: true,
                    disableServiceWorker: useCurrentFile ? false : true,
                },
                contentOptions: {
                    localResourceRoots: useCurrentFile ? [base] : [],
                    allowScripts: true
                },
                extension: undefined
            }, 'releaseNotes', title, undefined, { group: ACTIVE_GROUP, preserveFocus: false });
            const disposables = new DisposableStore();
            disposables.add(this._currentReleaseNotes.webview.onDidClickLink(uri => this.onDidClickLink(URI.parse(uri))));
            disposables.add(this._currentReleaseNotes.webview.onMessage(e => {
                if (e.message.type === 'showReleaseNotes') {
                    this._configurationService.updateValue('update.showReleaseNotes', e.message.value);
                }
                else if (e.message.type === 'clickSetting') {
                    const x = this._currentReleaseNotes?.webview.container.offsetLeft + e.message.value.x;
                    const y = this._currentReleaseNotes?.webview.container.offsetTop + e.message.value.y;
                    this._simpleSettingRenderer.updateSetting(URI.parse(e.message.value.uri), x, y);
                }
            }));
            disposables.add(this._currentReleaseNotes.onWillDispose(() => {
                disposables.dispose();
                this._currentReleaseNotes = undefined;
            }));
            this._currentReleaseNotes.webview.setHtml(html);
        }
        return true;
    }
    async loadReleaseNotes(version, useCurrentFile) {
        const match = /^(\d+\.\d+)\./.exec(version);
        if (!match) {
            throw new Error('not found');
        }
        const versionLabel = match[1].replace(/\./g, '_');
        const baseUrl = 'https://code.visualstudio.com/raw';
        const url = `${baseUrl}/v${versionLabel}.md`;
        const unassigned = nls.localize('unassigned', "unassigned");
        const escapeMdHtml = (text) => {
            return escape(text).replace(/\\/g, '\\\\');
        };
        const patchKeybindings = (text) => {
            const kb = (match, kb) => {
                const keybinding = this._keybindingService.lookupKeybinding(kb);
                if (!keybinding) {
                    return unassigned;
                }
                return keybinding.getLabel() || unassigned;
            };
            const kbstyle = (match, kb) => {
                const keybinding = KeybindingParser.parseKeybinding(kb);
                if (!keybinding) {
                    return unassigned;
                }
                const resolvedKeybindings = this._keybindingService.resolveKeybinding(keybinding);
                if (resolvedKeybindings.length === 0) {
                    return unassigned;
                }
                return resolvedKeybindings[0].getLabel() || unassigned;
            };
            const kbCode = (match, binding) => {
                const resolved = kb(match, binding);
                return resolved ? `<code title="${binding}">${escapeMdHtml(resolved)}</code>` : resolved;
            };
            const kbstyleCode = (match, binding) => {
                const resolved = kbstyle(match, binding);
                return resolved ? `<code title="${binding}">${escapeMdHtml(resolved)}</code>` : resolved;
            };
            return text
                .replace(/`kb\(([a-z.\d\-]+)\)`/gi, kbCode)
                .replace(/`kbstyle\(([^\)]+)\)`/gi, kbstyleCode)
                .replace(/kb\(([a-z.\d\-]+)\)/gi, (match, binding) => escapeMarkdownSyntaxTokens(kb(match, binding)))
                .replace(/kbstyle\(([^\)]+)\)/gi, (match, binding) => escapeMarkdownSyntaxTokens(kbstyle(match, binding)));
        };
        const fetchReleaseNotes = async () => {
            let text;
            try {
                if (useCurrentFile) {
                    const file = this._codeEditorService.getActiveCodeEditor()?.getModel()?.getValue();
                    text = file ? file.substring(file.indexOf('#')) : undefined;
                }
                else {
                    text = await asTextOrError(await this._requestService.request({ url }, CancellationToken.None));
                }
            }
            catch {
                throw new Error('Failed to fetch release notes');
            }
            if (!text || (!/^#\s/.test(text) && !useCurrentFile)) { // release notes always starts with `#` followed by whitespace, except when using the current file
                throw new Error('Invalid release notes');
            }
            return patchKeybindings(text);
        };
        // Don't cache the current file
        if (useCurrentFile) {
            return fetchReleaseNotes();
        }
        if (!this._releaseNotesCache.has(version)) {
            this._releaseNotesCache.set(version, (async () => {
                try {
                    return await fetchReleaseNotes();
                }
                catch (err) {
                    this._releaseNotesCache.delete(version);
                    throw err;
                }
            })());
        }
        return this._releaseNotesCache.get(version);
    }
    async onDidClickLink(uri) {
        if (uri.scheme === Schemas.codeSetting) {
            // handled in receive message
        }
        else {
            this.addGAParameters(uri, 'ReleaseNotes')
                .then(updated => this._openerService.open(updated, { allowCommands: ['workbench.action.openSettings', 'summarize.release.notes'] }))
                .then(undefined, onUnexpectedError);
        }
    }
    async addGAParameters(uri, origin, experiment = '1') {
        if (supportsTelemetry(this._productService, this._environmentService) && getTelemetryLevel(this._configurationService) === 3 /* TelemetryLevel.USAGE */) {
            if (uri.scheme === 'https' && uri.authority === 'code.visualstudio.com') {
                return uri.with({ query: `${uri.query ? uri.query + '&' : ''}utm_source=VsCode&utm_medium=${encodeURIComponent(origin)}&utm_content=${encodeURIComponent(experiment)}` });
            }
        }
        return uri;
    }
    async renderBody(fileContent) {
        const nonce = generateUuid();
        const processedContent = await renderReleaseNotesMarkdown(fileContent.text, this._extensionService, this._languageService, this._simpleSettingRenderer);
        const colorMap = TokenizationRegistry.getColorMap();
        const css = colorMap ? generateTokensCSSForColorMap(colorMap) : '';
        const showReleaseNotes = Boolean(this._configurationService.getValue('update.showReleaseNotes'));
        return `<!DOCTYPE html>
		<html>
			<head>
				<base href="${asWebviewUri(fileContent.base).toString(true)}/" >
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; media-src https:; style-src 'nonce-${nonce}' https://code.visualstudio.com; script-src 'nonce-${nonce}';">
				<style nonce="${nonce}">
					${DEFAULT_MARKDOWN_STYLES}
					${css}

					/* codesetting */

					code:has(.codesetting) {
						background-color: var(--vscode-textPreformat-background);
						color: var(--vscode-textPreformat-foreground);
						padding-left: 1px;
						margin-right: 3px;
						padding-right: 0px;
					}

					code:has(.codesetting):focus {
						border: 1px solid var(--vscode-button-border, transparent);
					}

					.codesetting {
						color: var(--vscode-textPreformat-foreground);
						padding: 0px 1px 1px 0px;
						font-size: 0px;
						overflow: hidden;
						text-overflow: ellipsis;
						outline-offset: 2px !important;
						box-sizing: border-box;
						text-align: center;
						cursor: pointer;
						display: inline;
						margin-right: 3px;
					}
					.codesetting svg {
						font-size: 12px;
						text-align: center;
						cursor: pointer;
						border: 1px solid var(--vscode-button-secondaryBorder, transparent);
						outline: 1px solid transparent;
						line-height: 9px;
						margin-bottom: -5px;
						padding-left: 0px;
						padding-top: 2px;
						padding-bottom: 2px;
						padding-right: 2px;
						display: inline-block;
						text-decoration: none;
						text-rendering: auto;
						text-transform: none;
						-webkit-font-smoothing: antialiased;
						-moz-osx-font-smoothing: grayscale;
						user-select: none;
						-webkit-user-select: none;
					}
					.codesetting .setting-name {
						font-size: 13px;
						padding-left: 2px;
						padding-right: 3px;
						padding-top: 1px;
						padding-bottom: 1px;
						margin-top: -3px;
					}
					.codesetting:hover {
						color: var(--vscode-textPreformat-foreground) !important;
						text-decoration: none !important;
					}
					code:has(.codesetting):hover {
						filter: brightness(140%);
						text-decoration: none !important;
					}
					.codesetting:focus {
						outline: 0 !important;
						text-decoration: none !important;
						color: var(--vscode-button-hoverForeground) !important;
					}
					.codesetting .separator {
						width: 1px;
						height: 14px;
						margin-bottom: -3px;
						display: inline-block;
						background-color: var(--vscode-editor-background);
						font-size: 12px;
						margin-right: 4px;
					}

					header { display: flex; align-items: center; padding-top: 1em; }

					/* Release notes enhancements from vscode-docs */
					html {
						font-size: 10px;
						height: 100%;
						overscroll-behavior: none;
					}

					body {
						margin: 0 auto;
						max-width: 980px;
						height: auto;
						overflow-y: auto;
						overscroll-behavior: none;
					}

					/* Scroll to top button */
					#scroll-to-top {
						position: fixed;
						width: 40px;
						height: 40px;
						right: 25px;
						bottom: 25px;
						background-color: var(--vscode-button-background, #444);
						border-color: var(--vscode-button-border);
						border-radius: 50%;
						cursor: pointer;
						box-shadow: 1px 1px 1px rgba(0,0,0,.25);
						outline: none;
						display: flex;
						justify-content: center;
						align-items: center;
					}

					#scroll-to-top:hover {
						background-color: var(--vscode-button-hoverBackground);
						box-shadow: 2px 2px 2px rgba(0,0,0,.25);
					}

					body.vscode-high-contrast #scroll-to-top {
						border-width: 2px;
						border-style: solid;
						box-shadow: none;
					}

					#scroll-to-top span.icon::before {
						content: "";
						display: block;
						background: var(--vscode-button-foreground);
						/* Chevron up icon */
						-webkit-mask-image: url('data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDE5LjIuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCAxNiAxNiIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMTYgMTY7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPHN0eWxlIHR5cGU9InRleHQvY3NzIj4KCS5zdDB7ZmlsbDojRkZGRkZGO30KCS5zdDF7ZmlsbDpub25lO30KPC9zdHlsZT4KPHRpdGxlPnVwY2hldnJvbjwvdGl0bGU+CjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik04LDUuMWwtNy4zLDcuM0wwLDExLjZsOC04bDgsOGwtMC43LDAuN0w4LDUuMXoiLz4KPHJlY3QgY2xhc3M9InN0MSIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ii8+Cjwvc3ZnPgo=');
						mask-image: url('data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDE5LjIuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCAxNiAxNiIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMTYgMTY7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPHN0eWxlIHR5cGU9InRleHQvY3NzIj4KCS5zdDB7ZmlsbDojRkZGRkZGO30KCS5zdDF7ZmlsbDpub25lO30KPC9zdHlsZT4KPHRpdGxlPnVwY2hldnJvbjwvdGl0bGU+CjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik04LDUuMWwtNy4zLDcuM0wwLDExLjZsOC04bDgsOGwtMC43LDAuN0w4LDUuMXoiLz4KPHJlY3QgY2xhc3M9InN0MSIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ii8+Cjwvc3ZnPgo=');
						width: 16px;
						height: 16px;
					}

					/* Header styling */
					h2 {
						margin-top: 1.2em;
						scroll-margin-top: 1.2em;
					}

					h2:not(:first-of-type) {
						margin-top: 4em;
						scroll-margin-top: 1em;
					}

					h3 {
						margin-top: 4em;
						scroll-margin-top: 1em;
					}

					h2 + h3 {
						margin-top: 0;
					}

					/* Highlights table styling */
					.highlights-table {
						border-collapse: collapse;
						border: none;
					}

					.highlights-table th {
						vertical-align: top;
						border: none;
						padding-top: 2em;
						font-weight: bold;
					}

					.highlights-table td {
						vertical-align: top;
						border: none;
					}

					.highlights-table tr:nth-child(2) td {
						padding-bottom: 1em;
					}

					/* Main content layout */
					.toc-nav-layout {
						display: flex;
						align-items: flex-start;
					}

					/* TOC Navigation */
					#toc-nav {
						position: sticky;
						top: 20px;
						width: 10vw;
						min-width: 120px;
						margin-right: 32px;
						margin-top: 2em;
					}

					#toc-nav > div {
						font-weight: bold;
						font-size: 1em;
						margin-bottom: 1em;
						text-transform: uppercase;
					}

					#toc-nav ul {
						list-style: none;
						padding: 0;
						margin: 0;
					}

					#toc-nav ul li {
						margin-bottom: 0.5em;
					}

					#toc-nav a {
						color: var(--vscode-editor-foreground, #ccc);
						text-decoration: none !important;
						transition: background-color 0.2s, color 0.2s;
						padding: 4px 6px;
						margin: -4px -6px;
						border-radius: 4px;
						display: block;
						outline: none;
					}

					#toc-nav a:hover {
						background-color: var(--vscode-button-secondaryHoverBackground, #1177bb);
						color: var(--vscode-button-secondaryForeground, #ffffff);
						cursor: pointer;
						text-decoration: none !important;
					}

					/* Main content area */
					.notes-main {
						flex: 1;
						min-width: 0;
					}

					/* Responsive breakpoint - Hide TOC on smaller screens */
					@media (max-width: 576px) {
						#toc-nav {
							display: none;
						}

						.toc-nav-layout {
							flex-direction: column;
						}

						.notes-main {
							margin-left: 0;
						}
					}
				</style>
			</head>
			<body>
				${processedContent}
				<script nonce="${nonce}">
					const vscode = acquireVsCodeApi();
					const container = document.createElement('p');
					container.style.display = 'flex';
					container.style.alignItems = 'center';

					const input = document.createElement('input');
					input.type = 'checkbox';
					input.id = 'showReleaseNotes';
					input.checked = ${showReleaseNotes};
					container.appendChild(input);

					const label = document.createElement('label');
					label.htmlFor = 'showReleaseNotes';
					label.textContent = '${nls.localize('showOnUpdate', "Show release notes after an update")}';
					container.appendChild(label);

					const beforeElement = document.querySelector("body > h1")?.nextElementSibling;
					if (beforeElement) {
						document.body.insertBefore(container, beforeElement);
					} else {
						document.body.appendChild(container);
					}

					window.addEventListener('message', event => {
						if (event.data.type === 'showReleaseNotes') {
							input.checked = event.data.value;
						}
					});

					window.addEventListener('click', event => {
						const href = event.target.href ?? event.target.parentElement?.href ?? event.target.parentElement?.parentElement?.href;
						if (href && (href.startsWith('${Schemas.codeSetting}'))) {
							vscode.postMessage({ type: 'clickSetting', value: { uri: href, x: event.clientX, y: event.clientY }});
						}
					});

					window.addEventListener('keypress', event => {
						if (event.keyCode === 13) {
							if (event.target.children.length > 0 && event.target.children[0].href) {
								const clientRect = event.target.getBoundingClientRect();
								vscode.postMessage({ type: 'clickSetting', value: { uri: event.target.children[0].href, x: clientRect.right , y: clientRect.bottom }});
							}
						}
					});

					input.addEventListener('change', event => {
						vscode.postMessage({ type: 'showReleaseNotes', value: input.checked }, '*');
					});
				</script>
			</body>
		</html>`;
    }
    onDidChangeConfiguration(e) {
        if (e.affectsConfiguration('update.showReleaseNotes')) {
            this.updateCheckboxWebview();
        }
    }
    onDidChangeActiveWebviewEditor(input) {
        if (input && input === this._currentReleaseNotes) {
            this.updateCheckboxWebview();
        }
    }
    updateCheckboxWebview() {
        if (this._currentReleaseNotes) {
            this._currentReleaseNotes.webview.postMessage({
                type: 'showReleaseNotes',
                value: this._configurationService.getValue('update.showReleaseNotes')
            });
        }
    }
};
ReleaseNotesManager = __decorate([
    __param(0, IEnvironmentService),
    __param(1, IKeybindingService),
    __param(2, ILanguageService),
    __param(3, IOpenerService),
    __param(4, IRequestService),
    __param(5, IConfigurationService),
    __param(6, IEditorService),
    __param(7, IEditorGroupsService),
    __param(8, ICodeEditorService),
    __param(9, IWebviewWorkbenchService),
    __param(10, IExtensionService),
    __param(11, IProductService),
    __param(12, IInstantiationService)
], ReleaseNotesManager);
export { ReleaseNotesManager };
export async function renderReleaseNotesMarkdown(text, extensionService, languageService, simpleSettingRenderer) {
    // Remove HTML comment markers around table of contents navigation
    text = text
        .toString()
        .replace(/<!--\s*TOC\s*/gi, '')
        .replace(/\s*Navigation End\s*-->/gi, '');
    return renderMarkdownDocument(text, extensionService, languageService, {
        sanitizerConfig: {
            allowRelativeMediaPaths: true,
            allowedLinkProtocols: {
                override: [Schemas.http, Schemas.https, Schemas.command, Schemas.codeSetting]
            },
            allowedTags: { augment: ['nav', 'svg', 'path'] },
            allowedAttributes: { augment: ['aria-role', 'viewBox', 'fill', 'xmlns', 'd'] }
        },
        markedExtensions: [{
                renderer: {
                    html: simpleSettingRenderer.getHtmlRenderer(),
                    codespan: simpleSettingRenderer.getCodeSpanRenderer(),
                }
            }]
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVsZWFzZU5vdGVzRWRpdG9yLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3VwZGF0ZS9icm93c2VyL3JlbGVhc2VOb3Rlc0VkaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLGdDQUFnQyxDQUFDO0FBQ3hDLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM1RCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQzVHLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ25GLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDN0YsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN4RixPQUFP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