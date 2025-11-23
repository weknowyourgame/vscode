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
var ChatMarkdownContentPart_1;
import * as dom from '../../../../../base/browser/dom.js';
import { allowedMarkdownHtmlAttributes } from '../../../../../base/browser/markdownRenderer.js';
import { StandardMouseEvent } from '../../../../../base/browser/mouseEvent.js';
import { status } from '../../../../../base/browser/ui/aria/aria.js';
import { DomScrollableElement } from '../../../../../base/browser/ui/scrollbar/scrollableElement.js';
import { coalesce } from '../../../../../base/common/arrays.js';
import { findLast } from '../../../../../base/common/arraysFind.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Lazy } from '../../../../../base/common/lazy.js';
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun, autorunSelfDisposable, derived } from '../../../../../base/common/observable.js';
import { equalsIgnoreCase } from '../../../../../base/common/strings.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { getIconClasses } from '../../../../../editor/common/services/getIconClasses.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { EditDeltaInfo } from '../../../../../editor/common/textModelEditSource.js';
import { localize } from '../../../../../nls.js';
import { getFlatContextMenuActions } from '../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IMenuService, MenuId } from '../../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { registerOpenEditorListeners } from '../../../../../platform/editor/browser/editor.js';
import { FileKind } from '../../../../../platform/files/common/files.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { IEditorService, SIDE_GROUP } from '../../../../services/editor/common/editorService.js';
import { IAiEditTelemetryService } from '../../../editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js';
import { MarkedKatexSupport } from '../../../markdown/browser/markedKatexSupport.js';
import { extractCodeblockUrisFromText } from '../../common/annotations.js';
import { IChatService } from '../../common/chatService.js';
import { isRequestVM, isResponseVM } from '../../common/chatViewModel.js';
import { ChatConfiguration } from '../../common/constants.js';
import { allowedChatMarkdownHtmlTags } from '../chatContentMarkdownRenderer.js';
import { MarkdownDiffBlockPart, parseUnifiedDiff } from '../chatDiffBlockPart.js';
import { ChatMarkdownDecorationsRenderer } from '../chatMarkdownDecorationsRenderer.js';
import { CodeBlockPart, localFileLanguageId, parseLocalFileData } from '../codeBlockPart.js';
import '../media/chatCodeBlockPill.css';
import { ChatExtensionsContentPart } from './chatExtensionsContentPart.js';
import './media/chatMarkdownPart.css';
const $ = dom.$;
let ChatMarkdownContentPart = class ChatMarkdownContentPart extends Disposable {
    static { ChatMarkdownContentPart_1 = this; }
    static { this.ID_POOL = 0; }
    get codeblocks() {
        return this._codeblocks;
    }
    constructor(markdown, context, editorPool, fillInIncompleteTokens = false, codeBlockStartIndex = 0, renderer, markdownRenderOptions, currentWidth, codeBlockModelCollection, rendererOptions, contextKeyService, configurationService, textModelService, instantiationService, aiEditTelemetryService) {
        super();
        this.markdown = markdown;
        this.editorPool = editorPool;
        this.codeBlockModelCollection = codeBlockModelCollection;
        this.rendererOptions = rendererOptions;
        this.textModelService = textModelService;
        this.instantiationService = instantiationService;
        this.aiEditTelemetryService = aiEditTelemetryService;
        this.codeblocksPartId = String(++ChatMarkdownContentPart_1.ID_POOL);
        this.allRefs = [];
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this._codeblocks = [];
        this.mathLayoutParticipants = new Set();
        const element = context.element;
        const inUndoStop = findLast(context.content, e => e.kind === 'undoStop', context.contentIndex)?.id;
        // We release editors in order so that it's more likely that the same editor will
        // be assigned if this element is re-rendered right away, like it often is during
        // progressive rendering
        const orderedDisposablesList = [];
        // Need to track the index of the codeblock within the response so it can have a unique ID,
        // and within this part to find it within the codeblocks array
        let globalCodeBlockIndexStart = codeBlockStartIndex;
        let thisPartCodeBlockIndexStart = 0;
        this.domNode = $('div.chat-markdown-part');
        if (this.rendererOptions.accessibilityOptions?.statusMessage) {
            this.domNode.ariaLabel = this.rendererOptions.accessibilityOptions.statusMessage;
            if (configurationService.getValue("accessibility.verboseChatProgressUpdates" /* AccessibilityWorkbenchSettingId.VerboseChatProgressUpdates */)) {
                status(this.rendererOptions.accessibilityOptions.statusMessage);
            }
        }
        const enableMath = configurationService.getValue(ChatConfiguration.EnableMath);
        const doRenderMarkdown = () => {
            if (this._store.isDisposed) {
                return;
            }
            // TODO: Move katex support into chatMarkdownRenderer
            const markedExtensions = enableMath
                ? coalesce([MarkedKatexSupport.getExtension(dom.getWindow(context.container), {
                        throwOnError: false
                    })])
                : [];
            // Enables github-flavored-markdown + line breaks with single newlines
            // (which matches typical expectations but isn't "proper" in markdown)
            const markedOpts = {
                gfm: true,
                breaks: true,
            };
            const result = this._register(renderer.render(markdown.content, {
                sanitizerConfig: MarkedKatexSupport.getSanitizerOptions({
                    allowedTags: allowedChatMarkdownHtmlTags,
                    allowedAttributes: allowedMarkdownHtmlAttributes,
                }),
                fillInIncompleteTokens,
                codeBlockRendererSync: (languageId, text, raw) => {
                    const isCodeBlockComplete = !isResponseVM(context.element) || context.element.isComplete || !raw || codeblockHasClosingBackticks(raw);
                    if ((!text || (text.startsWith('<vscode_codeblock_uri') && !text.includes('\n'))) && !isCodeBlockComplete) {
                        const hideEmptyCodeblock = $('div');
                        hideEmptyCodeblock.style.display = 'none';
                        return hideEmptyCodeblock;
                    }
                    if (languageId === 'diff' && raw && this.rendererOptions.allowInlineDiffs) {
                        const match = raw.match(/^```diff:(\w+)/);
                        if (match && isResponseVM(context.element)) {
                            const actualLanguageId = match[1];
                            const codeBlockUri = extractCodeblockUrisFromText(text);
                            const { before, after } = parseUnifiedDiff(codeBlockUri?.textWithoutResult ?? text);
                            const diffData = {
                                element: context.element,
                                codeBlockIndex: globalCodeBlockIndexStart++,
                                languageId: actualLanguageId,
                                beforeContent: before,
                                afterContent: after,
                                codeBlockResource: codeBlockUri?.uri,
                                isReadOnly: true,
                                horizontalPadding: this.rendererOptions.horizontalPadding,
                            };
                            const diffPart = this.instantiationService.createInstance(MarkdownDiffBlockPart, diffData, context.diffEditorPool, context.currentWidth());
                            const ref = {
                                object: diffPart,
                                isStale: () => false,
                                dispose: () => diffPart.dispose()
                            };
                            this.allRefs.push(ref);
                            this._register(diffPart.onDidChangeContentHeight(() => this._onDidChangeHeight.fire()));
                            orderedDisposablesList.push(ref);
                            return diffPart.element;
                        }
                    }
                    if (languageId === 'vscode-extensions') {
                        const chatExtensions = this._register(instantiationService.createInstance(ChatExtensionsContentPart, { kind: 'extensions', extensions: text.split(',') }));
                        this._register(chatExtensions.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
                        return chatExtensions.domNode;
                    }
                    const globalIndex = globalCodeBlockIndexStart++;
                    const thisPartIndex = thisPartCodeBlockIndexStart++;
                    let textModel;
                    let range;
                    let vulns;
                    let codeblockEntry;
                    if (equalsIgnoreCase(languageId, localFileLanguageId)) {
                        try {
                            const parsedBody = parseLocalFileData(text);
                            range = parsedBody.range && Range.lift(parsedBody.range);
                            textModel = this.textModelService.createModelReference(parsedBody.uri).then(ref => ref.object.textEditorModel);
                        }
                        catch (e) {
                            return $('div');
                        }
                    }
                    else {
                        if (isResponseVM(element) || isRequestVM(element)) {
                            const modelEntry = this.codeBlockModelCollection.getOrCreate(element.sessionResource, element, globalIndex);
                            const fastUpdateModelEntry = this.codeBlockModelCollection.updateSync(element.sessionResource, element, globalIndex, { text, languageId, isComplete: isCodeBlockComplete });
                            vulns = modelEntry.vulns;
                            codeblockEntry = fastUpdateModelEntry;
                            textModel = modelEntry.model;
                        }
                        else {
                            textModel = undefined;
                        }
                    }
                    const hideToolbar = isResponseVM(element) && element.errorDetails?.responseIsFiltered;
                    const renderOptions = {
                        ...this.rendererOptions.codeBlockRenderOptions,
                    };
                    if (hideToolbar !== undefined) {
                        renderOptions.hideToolbar = hideToolbar;
                    }
                    const codeBlockInfo = { languageId, textModel, codeBlockIndex: globalIndex, codeBlockPartIndex: thisPartIndex, element, range, parentContextKeyService: contextKeyService, vulns, codemapperUri: codeblockEntry?.codemapperUri, renderOptions, chatSessionResource: element.sessionResource };
                    if (element.isCompleteAddedRequest || !codeblockEntry?.codemapperUri || !codeblockEntry.isEdit) {
                        const ref = this.renderCodeBlock(codeBlockInfo, text, isCodeBlockComplete, currentWidth);
                        this.allRefs.push(ref);
                        // Attach this after updating text/layout of the editor, so it should only be fired when the size updates later (horizontal scrollbar, wrapping)
                        // not during a renderElement OR a progressive render (when we will be firing this event anyway at the end of the render)
                        this._register(ref.object.onDidChangeContentHeight(() => this._onDidChangeHeight.fire()));
                        const ownerMarkdownPartId = this.codeblocksPartId;
                        const info = new class {
                            constructor() {
                                this.ownerMarkdownPartId = ownerMarkdownPartId;
                                this.codeBlockIndex = globalIndex;
                                this.elementId = element.id;
                                this.chatSessionResource = element.sessionResource;
                                this.languageId = languageId;
                                this.isStreamingEdit = false;
                                this.editDeltaInfo = EditDeltaInfo.fromText(text);
                                this.codemapperUri = undefined; // will be set async
                                this.uriPromise = textModel?.then(model => model.uri) ?? Promise.resolve(undefined);
                            }
                            get uri() {
                                // here we must do a getter because the ref.object is rendered
                                // async and the uri might be undefined when it's read immediately
                                return ref.object.uri;
                            }
                            focus() {
                                ref.object.focus();
                            }
                        }();
                        this._codeblocks.push(info);
                        orderedDisposablesList.push(ref);
                        return ref.object.element;
                    }
                    else {
                        const requestId = isRequestVM(element) ? element.id : element.requestId;
                        const ref = this.renderCodeBlockPill(element.sessionResource, requestId, inUndoStop, codeBlockInfo.codemapperUri, this.markdown.fromSubagent);
                        if (isResponseVM(codeBlockInfo.element)) {
                            // TODO@joyceerhl: remove this code when we change the codeblockUri API to make the URI available synchronously
                            this.codeBlockModelCollection.update(codeBlockInfo.element.sessionResource, codeBlockInfo.element, codeBlockInfo.codeBlockIndex, { text, languageId: codeBlockInfo.languageId, isComplete: isCodeBlockComplete }).then((e) => {
                                // Update the existing object's codemapperUri
                                this._codeblocks[codeBlockInfo.codeBlockPartIndex].codemapperUri = e.codemapperUri;
                                this._onDidChangeHeight.fire();
                            });
                        }
                        this.allRefs.push(ref);
                        const ownerMarkdownPartId = this.codeblocksPartId;
                        const info = new class {
                            constructor() {
                                this.ownerMarkdownPartId = ownerMarkdownPartId;
                                this.codeBlockIndex = globalIndex;
                                this.elementId = element.id;
                                this.codemapperUri = codeblockEntry?.codemapperUri;
                                this.chatSessionResource = element.sessionResource;
                                this.isStreamingEdit = !isCodeBlockComplete;
                                this.uriPromise = Promise.resolve(undefined);
                                this.languageId = languageId;
                                this.editDeltaInfo = EditDeltaInfo.fromText(text);
                            }
                            get uri() {
                                return undefined;
                            }
                            focus() {
                                return ref.object.element.focus();
                            }
                        }();
                        this._codeblocks.push(info);
                        orderedDisposablesList.push(ref);
                        return ref.object.element;
                    }
                },
                asyncRenderCallback: () => this._onDidChangeHeight.fire(),
                markedOptions: markedOpts,
                markedExtensions,
                ...markdownRenderOptions,
            }, this.domNode));
            // Ideally this would happen earlier, but we need to parse the markdown.
            if (isResponseVM(element) && !element.model.codeBlockInfos && element.model.isComplete) {
                element.model.initializeCodeBlockInfos(this._codeblocks.map(info => {
                    return {
                        suggestionId: this.aiEditTelemetryService.createSuggestionId({
                            presentation: 'codeBlock',
                            feature: 'sideBarChat',
                            editDeltaInfo: info.editDeltaInfo,
                            languageId: info.languageId,
                            modeId: element.model.request?.modeInfo?.modeId,
                            modelId: element.model.request?.modelId,
                            applyCodeBlockSuggestionId: undefined,
                            source: undefined,
                        })
                    };
                }));
            }
            const markdownDecorationsRenderer = instantiationService.createInstance(ChatMarkdownDecorationsRenderer);
            this._register(markdownDecorationsRenderer.walkTreeAndAnnotateReferenceLinks(markdown, result.element));
            const layoutParticipants = new Lazy(() => {
                const observer = new ResizeObserver(() => this.mathLayoutParticipants.forEach(layout => layout()));
                observer.observe(this.domNode);
                this._register(toDisposable(() => observer.disconnect()));
                return this.mathLayoutParticipants;
            });
            // Make katex blocks horizontally scrollable
            // eslint-disable-next-line no-restricted-syntax
            for (const katexBlock of this.domNode.querySelectorAll('.katex-display')) {
                if (!dom.isHTMLElement(katexBlock)) {
                    continue;
                }
                const scrollable = new DomScrollableElement(katexBlock.cloneNode(true), {
                    vertical: 2 /* ScrollbarVisibility.Hidden */,
                    horizontal: 1 /* ScrollbarVisibility.Auto */,
                });
                orderedDisposablesList.push(scrollable);
                katexBlock.replaceWith(scrollable.getDomNode());
                layoutParticipants.value.add(() => { scrollable.scanDomNode(); });
                scrollable.scanDomNode();
            }
            orderedDisposablesList.reverse().forEach(d => this._register(d));
        };
        if (enableMath && !MarkedKatexSupport.getExtension(dom.getWindow(context.container))) {
            // Need to load async
            MarkedKatexSupport.loadExtension(dom.getWindow(context.container))
                .catch(e => {
                console.error('Failed to load MarkedKatexSupport extension:', e);
            }).finally(() => {
                doRenderMarkdown();
                if (!this._store.isDisposed) {
                    this._onDidChangeHeight.fire();
                }
            });
        }
        else {
            doRenderMarkdown();
        }
    }
    renderCodeBlockPill(sessionResource, requestId, inUndoStop, codemapperUri, fromSubagent) {
        const codeBlock = this.instantiationService.createInstance(CollapsedCodeBlock, sessionResource, requestId, inUndoStop);
        if (codemapperUri) {
            codeBlock.render(codemapperUri, fromSubagent);
        }
        return {
            object: codeBlock,
            isStale: () => false,
            dispose: () => codeBlock.dispose()
        };
    }
    renderCodeBlock(data, text, isComplete, currentWidth) {
        const ref = this.editorPool.get();
        const editorInfo = ref.object;
        if (isResponseVM(data.element)) {
            this.codeBlockModelCollection.update(data.element.sessionResource, data.element, data.codeBlockIndex, { text, languageId: data.languageId, isComplete }).then((e) => {
                // Update the existing object's codemapperUri
                this._codeblocks[data.codeBlockPartIndex].codemapperUri = e.codemapperUri;
                this._onDidChangeHeight.fire();
            });
        }
        editorInfo.render(data, currentWidth).then(() => {
            this._onDidChangeHeight.fire();
        });
        return ref;
    }
    hasSameContent(other) {
        if (other.kind !== 'markdownContent') {
            return false;
        }
        if (other.content.value === this.markdown.content.value) {
            return true;
        }
        // If we are streaming in code shown in an edit pill, do not re-render the entire content as long as it's coming in
        const lastCodeblock = this._codeblocks.at(-1);
        if (lastCodeblock && lastCodeblock.codemapperUri !== undefined && lastCodeblock.isStreamingEdit) {
            return other.content.value.lastIndexOf('```') === this.markdown.content.value.lastIndexOf('```');
        }
        return false;
    }
    layout(width) {
        this.allRefs.forEach((ref, index) => {
            if (ref.object instanceof CodeBlockPart) {
                ref.object.layout(width);
            }
            else if (ref.object instanceof MarkdownDiffBlockPart) {
                ref.object.layout(width);
            }
            else if (ref.object instanceof CollapsedCodeBlock) {
                const codeblockModel = this._codeblocks[index];
                if (codeblockModel.codemapperUri && ref.object.uri?.toString() !== codeblockModel.codemapperUri.toString()) {
                    ref.object.render(codeblockModel.codemapperUri);
                }
            }
        });
        this.mathLayoutParticipants.forEach(layout => layout());
    }
    addDisposable(disposable) {
        this._register(disposable);
    }
};
ChatMarkdownContentPart = ChatMarkdownContentPart_1 = __decorate([
    __param(10, IContextKeyService),
    __param(11, IConfigurationService),
    __param(12, ITextModelService),
    __param(13, IInstantiationService),
    __param(14, IAiEditTelemetryService)
], ChatMarkdownContentPart);
export { ChatMarkdownContentPart };
export function codeblockHasClosingBackticks(str) {
    str = str.trim();
    return !!str.match(/\n```+$/);
}
let CollapsedCodeBlock = class CollapsedCodeBlock extends Disposable {
    get uri() { return this._uri; }
    constructor(sessionResource, requestId, inUndoStop, labelService, editorService, modelService, languageService, contextMenuService, contextKeyService, menuService, hoverService, chatService, configurationService) {
        super();
        this.sessionResource = sessionResource;
        this.requestId = requestId;
        this.inUndoStop = inUndoStop;
        this.labelService = labelService;
        this.editorService = editorService;
        this.modelService = modelService;
        this.languageService = languageService;
        this.contextMenuService = contextMenuService;
        this.contextKeyService = contextKeyService;
        this.menuService = menuService;
        this.hoverService = hoverService;
        this.chatService = chatService;
        this.configurationService = configurationService;
        this.hover = this._register(new MutableDisposable());
        this.progressStore = this._store.add(new DisposableStore());
        this.element = $('div.chat-codeblock-pill-container');
        this.statusIndicatorContainer = $('div.status-indicator-container');
        this.pillElement = $('.chat-codeblock-pill-widget');
        this.pillElement.tabIndex = 0;
        this.pillElement.classList.add('show-file-icons');
        this.pillElement.role = 'button';
        this.element.appendChild(this.statusIndicatorContainer);
        this.element.appendChild(this.pillElement);
        this.registerListeners();
    }
    registerListeners() {
        this._register(registerOpenEditorListeners(this.pillElement, e => this.showDiff(e)));
        this._register(dom.addDisposableListener(this.pillElement, dom.EventType.CONTEXT_MENU, e => {
            const event = new StandardMouseEvent(dom.getWindow(e), e);
            dom.EventHelper.stop(e, true);
            this.contextMenuService.showContextMenu({
                contextKeyService: this.contextKeyService,
                getAnchor: () => event,
                getActions: () => {
                    if (!this.uri) {
                        return [];
                    }
                    const menu = this.menuService.getMenuActions(MenuId.ChatEditingCodeBlockContext, this.contextKeyService, {
                        arg: {
                            sessionResource: this.sessionResource,
                            requestId: this.requestId,
                            uri: this.uri,
                            stopId: this.inUndoStop
                        }
                    });
                    return getFlatContextMenuActions(menu);
                },
            });
        }));
    }
    showDiff({ editorOptions: options, openToSide }) {
        if (this.currentDiff) {
            this.editorService.openEditor({
                original: { resource: this.currentDiff.originalURI },
                modified: { resource: this.currentDiff.modifiedURI },
                options
            }, openToSide ? SIDE_GROUP : undefined);
        }
        else if (this.uri) {
            this.editorService.openEditor({ resource: this.uri, options }, openToSide ? SIDE_GROUP : undefined);
        }
    }
    /**
     * @param uri URI of the file on-disk being changed
     * @param isStreaming Whether the edit has completed (at the time of this being rendered)
     */
    render(uri, fromSubagent) {
        this.pillElement.classList.toggle('from-sub-agent', !!fromSubagent);
        this.progressStore.clear();
        this._uri = uri;
        const session = this.chatService.getSession(this.sessionResource);
        const iconText = this.labelService.getUriBasenameLabel(uri);
        const statusIconEl = dom.$('span.status-icon');
        const statusLabelEl = dom.$('span.status-label', {}, '');
        this.statusIndicatorContainer.replaceChildren(statusIconEl, statusLabelEl);
        const iconEl = dom.$('span.icon');
        const iconLabelEl = dom.$('span.icon-label', {}, iconText);
        const labelDetail = dom.$('span.label-detail', {}, '');
        // Create a progress fill element for the animation
        const progressFill = dom.$('span.progress-fill');
        this.pillElement.replaceChildren(progressFill, iconEl, iconLabelEl, labelDetail);
        const tooltipLabel = this.labelService.getUriLabel(uri, { relative: true });
        this.updateTooltip(tooltipLabel);
        const editSession = session?.editingSession;
        if (!editSession) {
            return;
        }
        const diffObservable = derived(reader => {
            const entry = editSession.readEntry(uri, reader);
            return entry && editSession.getEntryDiffBetweenStops(entry.modifiedURI, this.requestId, this.inUndoStop);
        }).map((d, r) => d?.read(r));
        const isStreaming = derived(r => {
            const entry = editSession.readEntry(uri, r);
            const currentlyModified = entry?.isCurrentlyBeingModifiedBy.read(r);
            return !!currentlyModified && currentlyModified.responseModel.requestId === this.requestId && currentlyModified.undoStopId === this.inUndoStop;
        });
        // Set the icon/classes while edits are streaming
        let statusIconClasses = [];
        let pillIconClasses = [];
        this.progressStore.add(autorun(r => {
            statusIconEl.classList.remove(...statusIconClasses);
            iconEl.classList.remove(...pillIconClasses);
            if (isStreaming.read(r)) {
                const codicon = ThemeIcon.modify(Codicon.loading, 'spin');
                statusIconClasses = ThemeIcon.asClassNameArray(codicon);
                statusIconEl.classList.add(...statusIconClasses);
                const entry = editSession.readEntry(uri, r);
                const rwRatio = Math.floor((entry?.rewriteRatio.read(r) || 0) * 100);
                statusLabelEl.textContent = localize('chat.codeblock.applyingEdits', 'Applying edits');
                const showAnimation = this.configurationService.getValue(ChatConfiguration.ShowCodeBlockProgressAnimation);
                if (showAnimation) {
                    progressFill.style.width = `${rwRatio}%`;
                    this.pillElement.classList.add('progress-filling');
                    labelDetail.textContent = '';
                }
                else {
                    progressFill.style.width = '0%';
                    this.pillElement.classList.remove('progress-filling');
                    labelDetail.textContent = rwRatio === 0 || !rwRatio ? localize('chat.codeblock.generating', "Generating edits...") : localize('chat.codeblock.applyingPercentage', "({0}%)...", rwRatio);
                }
            }
            else {
                const statusCodeicon = Codicon.check;
                statusIconClasses = ThemeIcon.asClassNameArray(statusCodeicon);
                statusIconEl.classList.add(...statusIconClasses);
                statusLabelEl.textContent = localize('chat.codeblock.edited', 'Edited');
                const fileKind = uri.path.endsWith('/') ? FileKind.FOLDER : FileKind.FILE;
                pillIconClasses = getIconClasses(this.modelService, this.languageService, uri, fileKind);
                iconEl.classList.add(...pillIconClasses);
                this.pillElement.classList.remove('progress-filling');
                progressFill.style.width = '0%';
                labelDetail.textContent = '';
            }
        }));
        // Render the +/- diff
        this.progressStore.add(autorunSelfDisposable(r => {
            const changes = diffObservable.read(r);
            if (changes === undefined) {
                return;
            }
            // eslint-disable-next-line no-restricted-syntax
            const labelAdded = this.pillElement.querySelector('.label-added') ?? this.pillElement.appendChild(dom.$('span.label-added'));
            // eslint-disable-next-line no-restricted-syntax
            const labelRemoved = this.pillElement.querySelector('.label-removed') ?? this.pillElement.appendChild(dom.$('span.label-removed'));
            if (changes && !changes?.identical && !changes?.quitEarly) {
                this.currentDiff = changes;
                labelAdded.textContent = `+${changes.added}`;
                labelRemoved.textContent = `-${changes.removed}`;
                const insertionsFragment = changes.added === 1 ? localize('chat.codeblock.insertions.one', "1 insertion") : localize('chat.codeblock.insertions', "{0} insertions", changes.added);
                const deletionsFragment = changes.removed === 1 ? localize('chat.codeblock.deletions.one', "1 deletion") : localize('chat.codeblock.deletions', "{0} deletions", changes.removed);
                const summary = localize('summary', 'Edited {0}, {1}, {2}', iconText, insertionsFragment, deletionsFragment);
                this.element.ariaLabel = summary;
                // No need to keep updating once we get the diff info
                if (changes.isFinal) {
                    r.dispose();
                }
            }
        }));
    }
    updateTooltip(tooltip) {
        this.tooltip = tooltip;
        if (!this.hover.value) {
            this.hover.value = this.hoverService.setupDelayedHover(this.pillElement, () => ({
                content: this.tooltip,
                style: 1 /* HoverStyle.Pointer */,
                position: { hoverPosition: 2 /* HoverPosition.BELOW */ },
                persistence: { hideOnKeyDown: true },
            }));
        }
    }
};
CollapsedCodeBlock = __decorate([
    __param(3, ILabelService),
    __param(4, IEditorService),
    __param(5, IModelService),
    __param(6, ILanguageService),
    __param(7, IContextMenuService),
    __param(8, IContextKeyService),
    __param(9, IMenuService),
    __param(10, IHoverService),
    __param(11, IChatService),
    __param(12, IConfigurationService)
], CollapsedCodeBlock);
export { CollapsedCodeBlock };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1hcmtkb3duQ29udGVudFBhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRDb250ZW50UGFydHMvY2hhdE1hcmtkb3duQ29udGVudFBhcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxFQUFFLDZCQUE2QixFQUE2RCxNQUFNLGlEQUFpRCxDQUFDO0FBQzNKLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUdyRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUNyRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLGlCQUFpQixFQUFFLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BJLE9BQU8sRUFBRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsT0FBTyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFbkcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDekUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRXBF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