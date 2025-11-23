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
var WalkThroughPart_1;
import '../common/walkThroughUtils.js';
import './media/walkThroughPart.css';
import { DomScrollableElement } from '../../../../base/browser/ui/scrollbar/scrollableElement.js';
import { EventType as TouchEventType, Gesture } from '../../../../base/browser/touch.js';
import * as strings from '../../../../base/common/strings.js';
import { URI } from '../../../../base/common/uri.js';
import { dispose, toDisposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { WalkThroughInput } from './walkThroughInput.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITextResourceConfigurationService } from '../../../../editor/common/services/textResourceConfiguration.js';
import { CodeEditorWidget } from '../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { localize } from '../../../../nls.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { RawContextKey, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { isObject } from '../../../../base/common/types.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { UILabelProvider } from '../../../../base/common/keybindingLabels.js';
import { OS } from '../../../../base/common/platform.js';
import { deepClone } from '../../../../base/common/objects.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { addDisposableListener, isHTMLAnchorElement, isHTMLButtonElement, isHTMLElement, size } from '../../../../base/browser/dom.js';
import * as domSanitize from '../../../../base/browser/domSanitize.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
export const WALK_THROUGH_FOCUS = new RawContextKey('interactivePlaygroundFocus', false);
const UNBOUND_COMMAND = localize('walkThrough.unboundCommand', "unbound");
const WALK_THROUGH_EDITOR_VIEW_STATE_PREFERENCE_KEY = 'walkThroughEditorViewState';
let WalkThroughPart = class WalkThroughPart extends EditorPane {
    static { WalkThroughPart_1 = this; }
    static { this.ID = 'workbench.editor.walkThroughPart'; }
    constructor(group, telemetryService, themeService, textResourceConfigurationService, instantiationService, openerService, keybindingService, storageService, contextKeyService, configurationService, notificationService, extensionService, editorGroupService) {
        super(WalkThroughPart_1.ID, group, telemetryService, themeService, storageService);
        this.instantiationService = instantiationService;
        this.openerService = openerService;
        this.keybindingService = keybindingService;
        this.contextKeyService = contextKeyService;
        this.configurationService = configurationService;
        this.notificationService = notificationService;
        this.extensionService = extensionService;
        this.disposables = new DisposableStore();
        this.contentDisposables = [];
        this.editorFocus = WALK_THROUGH_FOCUS.bindTo(this.contextKeyService);
        this.editorMemento = this.getEditorMemento(editorGroupService, textResourceConfigurationService, WALK_THROUGH_EDITOR_VIEW_STATE_PREFERENCE_KEY);
    }
    createEditor(container) {
        this.content = document.createElement('div');
        this.content.classList.add('welcomePageFocusElement');
        this.content.tabIndex = 0;
        this.content.style.outlineStyle = 'none';
        this.scrollbar = new DomScrollableElement(this.content, {
            horizontal: 1 /* ScrollbarVisibility.Auto */,
            vertical: 1 /* ScrollbarVisibility.Auto */
        });
        this.disposables.add(this.scrollbar);
        container.appendChild(this.scrollbar.getDomNode());
        this.registerFocusHandlers();
        this.registerClickHandler();
        this.disposables.add(this.scrollbar.onScroll(e => this.updatedScrollPosition()));
    }
    updatedScrollPosition() {
        const scrollDimensions = this.scrollbar.getScrollDimensions();
        const scrollPosition = this.scrollbar.getScrollPosition();
        const scrollHeight = scrollDimensions.scrollHeight;
        if (scrollHeight && this.input instanceof WalkThroughInput) {
            const scrollTop = scrollPosition.scrollTop;
            const height = scrollDimensions.height;
            this.input.relativeScrollPosition(scrollTop / scrollHeight, (scrollTop + height) / scrollHeight);
        }
    }
    onTouchChange(event) {
        event.preventDefault();
        event.stopPropagation();
        const scrollPosition = this.scrollbar.getScrollPosition();
        this.scrollbar.setScrollPosition({ scrollTop: scrollPosition.scrollTop - event.translationY });
    }
    addEventListener(element, type, listener, useCapture) {
        element.addEventListener(type, listener, useCapture);
        return toDisposable(() => { element.removeEventListener(type, listener, useCapture); });
    }
    registerFocusHandlers() {
        this.disposables.add(this.addEventListener(this.content, 'mousedown', e => {
            this.focus();
        }));
        this.disposables.add(this.addEventListener(this.content, 'focus', e => {
            this.editorFocus.set(true);
        }));
        this.disposables.add(this.addEventListener(this.content, 'blur', e => {
            this.editorFocus.reset();
        }));
        this.disposables.add(this.addEventListener(this.content, 'focusin', (e) => {
            // Work around scrolling as side-effect of setting focus on the offscreen zone widget (#18929)
            if (isHTMLElement(e.target) && e.target.classList.contains('zone-widget-container')) {
                const scrollPosition = this.scrollbar.getScrollPosition();
                this.content.scrollTop = scrollPosition.scrollTop;
                this.content.scrollLeft = scrollPosition.scrollLeft;
            }
            if (isHTMLElement(e.target)) {
                this.lastFocus = e.target;
            }
        }));
    }
    registerClickHandler() {
        this.content.addEventListener('click', event => {
            for (let node = event.target; node; node = node.parentNode) {
                if (isHTMLAnchorElement(node) && node.href) {
                    // eslint-disable-next-line no-restricted-syntax
                    const baseElement = node.ownerDocument.getElementsByTagName('base')[0] || this.window.location;
                    if (baseElement && node.href.indexOf(baseElement.href) >= 0 && node.hash) {
                        // eslint-disable-next-line no-restricted-syntax
                        const scrollTarget = this.content.querySelector(node.hash);
                        const innerContent = this.content.firstElementChild;
                        if (scrollTarget && innerContent) {
                            const targetTop = scrollTarget.getBoundingClientRect().top - 20;
                            const containerTop = innerContent.getBoundingClientRect().top;
                            this.scrollbar.setScrollPosition({ scrollTop: targetTop - containerTop });
                        }
                    }
                    else {
                        this.open(URI.parse(node.href));
                    }
                    event.preventDefault();
                    break;
                }
                else if (isHTMLButtonElement(node)) {
                    const href = node.getAttribute('data-href');
                    if (href) {
                        this.open(URI.parse(href));
                    }
                    break;
                }
                else if (node === event.currentTarget) {
                    break;
                }
            }
        });
    }
    open(uri) {
        if (uri.scheme === 'command' && uri.path === 'git.clone' && !CommandsRegistry.getCommand('git.clone')) {
            this.notificationService.info(localize('walkThrough.gitNotFound', "It looks like Git is not installed on your system."));
            return;
        }
        this.openerService.open(this.addFrom(uri), { allowCommands: true });
    }
    addFrom(uri) {
        if (uri.scheme !== 'command' || !(this.input instanceof WalkThroughInput)) {
            return uri;
        }
        const query = uri.query ? JSON.parse(uri.query) : {};
        query.from = this.input.getTelemetryFrom();
        return uri.with({ query: JSON.stringify(query) });
    }
    layout(dimension) {
        this.size = dimension;
        size(this.content, dimension.width, dimension.height);
        this.updateSizeClasses();
        this.contentDisposables.forEach(disposable => {
            if (disposable instanceof CodeEditorWidget) {
                disposable.layout();
            }
        });
        const walkthroughInput = this.input instanceof WalkThroughInput && this.input;
        if (walkthroughInput && walkthroughInput.layout) {
            walkthroughInput.layout(dimension);
        }
        this.scrollbar.scanDomNode();
    }
    updateSizeClasses() {
        const innerContent = this.content.firstElementChild;
        if (this.size && innerContent) {
            innerContent.classList.toggle('max-height-685px', this.size.height <= 685);
        }
    }
    focus() {
        super.focus();
        let active = this.content.ownerDocument.activeElement;
        while (active && active !== this.content) {
            active = active.parentElement;
        }
        if (!active) {
            (this.lastFocus || this.content).focus();
        }
        this.editorFocus.set(true);
    }
    arrowUp() {
        const scrollPosition = this.scrollbar.getScrollPosition();
        this.scrollbar.setScrollPosition({ scrollTop: scrollPosition.scrollTop - this.getArrowScrollHeight() });
    }
    arrowDown() {
        const scrollPosition = this.scrollbar.getScrollPosition();
        this.scrollbar.setScrollPosition({ scrollTop: scrollPosition.scrollTop + this.getArrowScrollHeight() });
    }
    getArrowScrollHeight() {
        let fontSize = this.configurationService.getValue('editor.fontSize');
        if (typeof fontSize !== 'number' || fontSize < 1) {
            fontSize = 12;
        }
        return 3 * fontSize;
    }
    pageUp() {
        const scrollDimensions = this.scrollbar.getScrollDimensions();
        const scrollPosition = this.scrollbar.getScrollPosition();
        this.scrollbar.setScrollPosition({ scrollTop: scrollPosition.scrollTop - scrollDimensions.height });
    }
    pageDown() {
        const scrollDimensions = this.scrollbar.getScrollDimensions();
        const scrollPosition = this.scrollbar.getScrollPosition();
        this.scrollbar.setScrollPosition({ scrollTop: scrollPosition.scrollTop + scrollDimensions.height });
    }
    setInput(input, options, context, token) {
        const store = new DisposableStore();
        this.contentDisposables.push(store);
        this.content.innerText = '';
        return super.setInput(input, options, context, token)
            .then(async () => {
            if (input.resource.path.endsWith('.md')) {
                await this.extensionService.whenInstalledExtensionsRegistered();
            }
            return input.resolve();
        })
            .then(model => {
            if (token.isCancellationRequested) {
                return;
            }
            const content = model.main;
            if (!input.resource.path.endsWith('.md')) {
                this.safeSetInnerHtml(this.content, content);
                this.updateSizeClasses();
                this.decorateContent();
                this.contentDisposables.push(this.keybindingService.onDidUpdateKeybindings(() => this.decorateContent()));
                input.onReady?.(this.content.firstElementChild, store);
                this.scrollbar.scanDomNode();
                this.loadTextEditorViewState(input);
                this.updatedScrollPosition();
                return;
            }
            const innerContent = document.createElement('div');
            innerContent.classList.add('walkThroughContent'); // only for markdown files
            const markdown = this.expandMacros(content);
            this.safeSetInnerHtml(innerContent, markdown);
            this.content.appendChild(innerContent);
            model.snippets.forEach((snippet, i) => {
                const model = snippet.textEditorModel;
                if (!model) {
                    return;
                }
                const id = `snippet-${model.uri.fragment}`;
                // eslint-disable-next-line no-restricted-syntax
                const div = innerContent.querySelector(`#${id.replace(/[\\.]/g, '\\$&')}`);
                const options = this.getEditorOptions(model.getLanguageId());
                const telemetryData = {
                    target: this.input instanceof WalkThroughInput ? this.input.getTelemetryFrom() : undefined,
                    snippet: i
                };
                const editor = this.instantiationService.createInstance(CodeEditorWidget, div, options, {
                    telemetryData: telemetryData
                });
                editor.setModel(model);
                this.contentDisposables.push(editor);
                const updateHeight = (initial) => {
                    const position = editor.getPosition();
                    const lineHeight = position ? editor.getLineHeightForPosition(position) : editor.getOption(75 /* EditorOption.lineHeight */);
                    const height = `${Math.max(model.getLineCount() + 1, 4) * lineHeight}px`;
                    if (div.style.height !== height) {
                        div.style.height = height;
                        editor.layout();
                        if (!initial) {
                            this.scrollbar.scanDomNode();
                        }
                    }
                };
                updateHeight(true);
                this.contentDisposables.push(editor.onDidChangeModelContent(() => updateHeight(false)));
                this.contentDisposables.push(editor.onDidChangeCursorPosition(e => {
                    const innerContent = this.content.firstElementChild;
                    if (innerContent) {
                        const targetTop = div.getBoundingClientRect().top;
                        const containerTop = innerContent.getBoundingClientRect().top;
                        const lineHeight = editor.getLineHeightForPosition(e.position);
                        const lineTop = (targetTop + (e.position.lineNumber - 1) * lineHeight) - containerTop;
                        const lineBottom = lineTop + lineHeight;
                        const scrollDimensions = this.scrollbar.getScrollDimensions();
                        const scrollPosition = this.scrollbar.getScrollPosition();
                        const scrollTop = scrollPosition.scrollTop;
                        const height = scrollDimensions.height;
                        if (scrollTop > lineTop) {
                            this.scrollbar.setScrollPosition({ scrollTop: lineTop });
                        }
                        else if (scrollTop < lineBottom - height) {
                            this.scrollbar.setScrollPosition({ scrollTop: lineBottom - height });
                        }
                    }
                }));
                this.contentDisposables.push(this.configurationService.onDidChangeConfiguration(e => {
                    if (e.affectsConfiguration('editor') && snippet.textEditorModel) {
                        editor.updateOptions(this.getEditorOptions(snippet.textEditorModel.getLanguageId()));
                    }
                }));
            });
            this.updateSizeClasses();
            this.multiCursorModifier();
            this.contentDisposables.push(this.configurationService.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('editor.multiCursorModifier')) {
                    this.multiCursorModifier();
                }
            }));
            input.onReady?.(innerContent, store);
            this.scrollbar.scanDomNode();
            this.loadTextEditorViewState(input);
            this.updatedScrollPosition();
            this.contentDisposables.push(Gesture.addTarget(innerContent));
            this.contentDisposables.push(addDisposableListener(innerContent, TouchEventType.Change, e => this.onTouchChange(e)));
        });
    }
    safeSetInnerHtml(node, content) {
        domSanitize.safeSetInnerHtml(node, content, {
            allowedAttributes: {
                augment: [
                    'id',
                    'class',
                    'style',
                    'data-command',
                    'data-href',
                ]
            }
        });
    }
    getEditorOptions(language) {
        const config = deepClone(this.configurationService.getValue('editor', { overrideIdentifier: language }));
        return {
            ...isObject(config) ? config : Object.create(null),
            scrollBeyondLastLine: false,
            scrollbar: {
                verticalScrollbarSize: 14,
                horizontal: 'auto',
                useShadows: true,
                verticalHasArrows: false,
                horizontalHasArrows: false,
                alwaysConsumeMouseWheel: false
            },
            overviewRulerLanes: 3,
            fixedOverflowWidgets: false,
            lineNumbersMinChars: 1,
            minimap: { enabled: false },
        };
    }
    expandMacros(input) {
        return input.replace(/kb\(([a-z.\d\-]+)\)/gi, (match, kb) => {
            const keybinding = this.keybindingService.lookupKeybinding(kb);
            const shortcut = keybinding ? keybinding.getLabel() || '' : UNBOUND_COMMAND;
            return `<span class="shortcut">${strings.escape(shortcut)}</span>`;
        });
    }
    decorateContent() {
        // eslint-disable-next-line no-restricted-syntax
        const keys = this.content.querySelectorAll('.shortcut[data-command]');
        Array.prototype.forEach.call(keys, (key) => {
            const command = key.getAttribute('data-command');
            const keybinding = command && this.keybindingService.lookupKeybinding(command);
            const label = keybinding ? keybinding.getLabel() || '' : UNBOUND_COMMAND;
            while (key.firstChild) {
                key.firstChild.remove();
            }
            key.appendChild(document.createTextNode(label));
        });
        // eslint-disable-next-line no-restricted-syntax
        const ifkeys = this.content.querySelectorAll('.if_shortcut[data-command]');
        Array.prototype.forEach.call(ifkeys, (key) => {
            const command = key.getAttribute('data-command');
            const keybinding = command && this.keybindingService.lookupKeybinding(command);
            key.style.display = !keybinding ? 'none' : '';
        });
    }
    multiCursorModifier() {
        const labels = UILabelProvider.modifierLabels[OS];
        const value = this.configurationService.getValue('editor.multiCursorModifier');
        const modifier = labels[value === 'ctrlCmd' ? (OS === 2 /* OperatingSystem.Macintosh */ ? 'metaKey' : 'ctrlKey') : 'altKey'];
        // eslint-disable-next-line no-restricted-syntax
        const keys = this.content.querySelectorAll('.multi-cursor-modifier');
        Array.prototype.forEach.call(keys, (key) => {
            while (key.firstChild) {
                key.firstChild.remove();
            }
            key.appendChild(document.createTextNode(modifier));
        });
    }
    saveTextEditorViewState(input) {
        const scrollPosition = this.scrollbar.getScrollPosition();
        this.editorMemento.saveEditorState(this.group, input, {
            viewState: {
                scrollTop: scrollPosition.scrollTop,
                scrollLeft: scrollPosition.scrollLeft
            }
        });
    }
    loadTextEditorViewState(input) {
        const state = this.editorMemento.loadEditorState(this.group, input);
        if (state) {
            this.scrollbar.setScrollPosition(state.viewState);
        }
    }
    clearInput() {
        if (this.input instanceof WalkThroughInput) {
            this.saveTextEditorViewState(this.input);
        }
        this.contentDisposables = dispose(this.contentDisposables);
        super.clearInput();
    }
    saveState() {
        if (this.input instanceof WalkThroughInput) {
            this.saveTextEditorViewState(this.input);
        }
        super.saveState();
    }
    dispose() {
        this.editorFocus.reset();
        this.contentDisposables = dispose(this.contentDisposables);
        this.disposables.dispose();
        super.dispose();
    }
};
WalkThroughPart = WalkThroughPart_1 = __decorate([
    __param(1, ITelemetryService),
    __param(2, IThemeService),
    __param(3, ITextResourceConfigurationService),
    __param(4, IInstantiationService),
    __param(5, IOpenerService),
    __param(6, IKeybindingService),
    __param(7, IStorageService),
    __param(8, IContextKeyService),
    __param(9, IConfigurationService),
    __param(10, INotificationService),
    __param(11, IExtensionService),
    __param(12, IEditorGroupsService)
], WalkThroughPart);
export { WalkThroughPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2Fsa1Rocm91Z2hQYXJ0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3dlbGNvbWVXYWxrdGhyb3VnaC9icm93c2VyL3dhbGtUaHJvdWdoUGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTywrQkFBK0IsQ0FBQztBQUN2QyxPQUFPLDZCQUE2QixDQUFDO0FBQ3JDLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxTQUFTLElBQUksY0FBYyxFQUFnQixPQUFPLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUV2RyxPQUFPLEtBQUssT0FBTyxNQUFNLG9DQUFvQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQWUsT0FBTyxFQUFFLFlBQVksRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUUzRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDekUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDdkYsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDekQsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxpQ0FBaUMsRUFBRSxNQUFNLGlFQUFpRSxDQUFDO0FBQ3BILE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFB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