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
import './codeBlockPart.css';
import * as dom from '../../../../base/browser/dom.js';
import { renderFormattedText } from '../../../../base/browser/formattedTextRenderer.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { combinedDisposable, Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { isEqual } from '../../../../base/common/resources.js';
import { assertType } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { EditorExtensionsRegistry } from '../../../../editor/browser/editorExtensions.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { CodeEditorWidget } from '../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { DiffEditorWidget } from '../../../../editor/browser/widget/diffEditor/diffEditorWidget.js';
import { EDITOR_FONT_DEFAULTS } from '../../../../editor/common/config/fontInfo.js';
import { Range } from '../../../../editor/common/core/range.js';
import { TextEdit } from '../../../../editor/common/languages.js';
import { TextModelText } from '../../../../editor/common/model/textModelText.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { DefaultModelSHA1Computer } from '../../../../editor/common/services/modelService.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { BracketMatchingController } from '../../../../editor/contrib/bracketMatching/browser/bracketMatching.js';
import { ColorDetector } from '../../../../editor/contrib/colorPicker/browser/colorDetector.js';
import { ContextMenuController } from '../../../../editor/contrib/contextmenu/browser/contextmenu.js';
import { GotoDefinitionAtPositionEditorContribution } from '../../../../editor/contrib/gotoSymbol/browser/link/goToDefinitionAtPosition.js';
import { ContentHoverController } from '../../../../editor/contrib/hover/browser/contentHoverController.js';
import { GlyphHoverController } from '../../../../editor/contrib/hover/browser/glyphHoverController.js';
import { LinkDetector } from '../../../../editor/contrib/links/browser/links.js';
import { MessageController } from '../../../../editor/contrib/message/browser/messageController.js';
import { ViewportSemanticTokensContribution } from '../../../../editor/contrib/semanticTokens/browser/viewportSemanticTokens.js';
import { SmartSelectController } from '../../../../editor/contrib/smartSelect/browser/smartSelect.js';
import { WordHighlighterContribution } from '../../../../editor/contrib/wordHighlighter/browser/wordHighlighter.js';
import { localize } from '../../../../nls.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { MenuWorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { FileKind } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ResourceLabel } from '../../../browser/labels.js';
import { ResourceContextKey } from '../../../common/contextkeys.js';
import { InspectEditorTokensController } from '../../codeEditor/browser/inspectEditorTokens/inspectEditorTokens.js';
import { MenuPreventer } from '../../codeEditor/browser/menuPreventer.js';
import { SelectionClipboardContributionID } from '../../codeEditor/browser/selectionClipboard.js';
import { getSimpleEditorOptions } from '../../codeEditor/browser/simpleEditorOptions.js';
import { ChatContextKeys } from '../common/chatContextKeys.js';
import { isRequestVM, isResponseVM } from '../common/chatViewModel.js';
import { emptyProgressRunner, IEditorProgressService } from '../../../../platform/progress/common/progress.js';
import { SuggestController } from '../../../../editor/contrib/suggest/browser/suggestController.js';
import { SnippetController2 } from '../../../../editor/contrib/snippet/browser/snippetController2.js';
const $ = dom.$;
/**
 * Special markdown code block language id used to render a local file.
 *
 * The text of the code path should be a {@link LocalFileCodeBlockData} json object.
 */
export const localFileLanguageId = 'vscode-local-file';
export function parseLocalFileData(text) {
    let data;
    try {
        data = JSON.parse(text);
    }
    catch (e) {
        throw new Error('Could not parse code block local file data');
    }
    let uri;
    try {
        uri = URI.revive(data?.uri);
    }
    catch (e) {
        throw new Error('Invalid code block local file data URI');
    }
    let range;
    if (data.range) {
        // Note that since this is coming from extensions, position are actually zero based and must be converted.
        range = new Range(data.range.startLineNumber + 1, data.range.startColumn + 1, data.range.endLineNumber + 1, data.range.endColumn + 1);
    }
    return { uri, range };
}
const defaultCodeblockPadding = 10;
let CodeBlockPart = class CodeBlockPart extends Disposable {
    get verticalPadding() {
        return this.currentCodeBlockData?.renderOptions?.verticalPadding ?? defaultCodeblockPadding;
    }
    constructor(editorOptions, menuId, delegate, overflowWidgetsDomNode, isSimpleWidget = false, instantiationService, contextKeyService, modelService, configurationService, accessibilityService) {
        super();
        this.editorOptions = editorOptions;
        this.menuId = menuId;
        this.isSimpleWidget = isSimpleWidget;
        this.modelService = modelService;
        this.configurationService = configurationService;
        this.accessibilityService = accessibilityService;
        this._onDidChangeContentHeight = this._register(new Emitter());
        this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
        this.currentScrollWidth = 0;
        this.isDisposed = false;
        this.element = $('.interactive-result-code-block');
        this.resourceContextKey = this._register(instantiationService.createInstance(ResourceContextKey));
        this.contextKeyService = this._register(contextKeyService.createScoped(this.element));
        const scopedInstantiationService = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, this.contextKeyService])));
        const editorElement = dom.append(this.element, $('.interactive-result-editor'));
        this.editor = this.createEditor(scopedInstantiationService, editorElement, {
            ...getSimpleEditorOptions(this.configurationService),
            readOnly: true,
            lineNumbers: 'off',
            selectOnLineNumbers: true,
            scrollBeyondLastLine: false,
            lineDecorationsWidth: 8,
            dragAndDrop: false,
            padding: { top: this.verticalPadding, bottom: this.verticalPadding },
            mouseWheelZoom: false,
            scrollbar: {
                vertical: 'hidden',
                alwaysConsumeMouseWheel: false
            },
            definitionLinkOpensInPeek: false,
            gotoLocation: {
                multiple: 'goto',
                multipleDeclarations: 'goto',
                multipleDefinitions: 'goto',
                multipleImplementations: 'goto',
            },
            ariaLabel: localize('chat.codeBlockHelp', 'Code block'),
            overflowWidgetsDomNode,
            tabFocusMode: true,
            ...this.getEditorOptionsFromConfig(),
        });
        const toolbarElement = dom.append(this.element, $('.interactive-result-code-block-toolbar'));
        const editorScopedService = this.editor.contextKeyService.createScoped(toolbarElement);
        const editorScopedInstantiationService = this._register(scopedInstantiationService.createChild(new ServiceCollection([IContextKeyService, editorScopedService])));
        this.toolbar = this._register(editorScopedInstantiationService.createInstance(MenuWorkbenchToolBar, toolbarElement, menuId, {
            menuOptions: {
                shouldForwardArgs: true
            }
        }));
        const vulnsContainer = dom.append(this.element, $('.interactive-result-vulns'));
        const vulnsHeaderElement = dom.append(vulnsContainer, $('.interactive-result-vulns-header', undefined));
        this.vulnsButton = this._register(new Button(vulnsHeaderElement, {
            buttonBackground: undefined,
            buttonBorder: undefined,
            buttonForeground: undefined,
            buttonHoverBackground: undefined,
            buttonSecondaryBackground: undefined,
            buttonSecondaryForeground: undefined,
            buttonSecondaryHoverBackground: undefined,
            buttonSeparator: undefined,
            supportIcons: true
        }));
        this.vulnsListElement = dom.append(vulnsContainer, $('ul.interactive-result-vulns-list'));
        this._register(this.vulnsButton.onDidClick(() => {
            const element = this.currentCodeBlockData.element;
            element.vulnerabilitiesListExpanded = !element.vulnerabilitiesListExpanded;
            this.vulnsButton.label = this.getVulnerabilitiesLabel();
            this.element.classList.toggle('chat-vulnerabilities-collapsed', !element.vulnerabilitiesListExpanded);
            this._onDidChangeContentHeight.fire();
            // this.updateAriaLabel(collapseButton.element, referencesLabel, element.usedReferencesExpanded);
        }));
        this._register(this.toolbar.onDidChangeDropdownVisibility(e => {
            toolbarElement.classList.toggle('force-visibility', e);
        }));
        this._configureForScreenReader();
        this._register(this.accessibilityService.onDidChangeScreenReaderOptimized(() => this._configureForScreenReader()));
        this._register(this.configurationService.onDidChangeConfiguration((e) => {
            if (e.affectedKeys.has("accessibility.verbosity.panelChat" /* AccessibilityVerbositySettingId.Chat */)) {
                this._configureForScreenReader();
            }
        }));
        this._register(this.editorOptions.onDidChange(() => {
            this.editor.updateOptions(this.getEditorOptionsFromConfig());
        }));
        this._register(this.editor.onDidScrollChange(e => {
            this.currentScrollWidth = e.scrollWidth;
        }));
        this._register(this.editor.onDidContentSizeChange(e => {
            if (e.contentHeightChanged) {
                this._onDidChangeContentHeight.fire();
            }
        }));
        this._register(this.editor.onDidBlurEditorWidget(() => {
            this.element.classList.remove('focused');
            WordHighlighterContribution.get(this.editor)?.stopHighlighting();
            this.clearWidgets();
        }));
        this._register(this.editor.onDidFocusEditorWidget(() => {
            this.element.classList.add('focused');
            WordHighlighterContribution.get(this.editor)?.restoreViewState(true);
        }));
        this._register(Event.any(this.editor.onDidChangeModel, this.editor.onDidChangeModelContent)(() => {
            if (this.currentCodeBlockData) {
                this.updateContexts(this.currentCodeBlockData);
            }
        }));
        // Parent list scrolled
        if (delegate.onDidScroll) {
            this._register(delegate.onDidScroll(e => {
                this.clearWidgets();
            }));
        }
    }
    dispose() {
        this.isDisposed = true;
        super.dispose();
    }
    get uri() {
        return this.editor.getModel()?.uri;
    }
    createEditor(instantiationService, parent, options) {
        return this._register(instantiationService.createInstance(CodeEditorWidget, parent, options, {
            isSimpleWidget: this.isSimpleWidget,
            contributions: EditorExtensionsRegistry.getSomeEditorContributions([
                MenuPreventer.ID,
                SelectionClipboardContributionID,
                ContextMenuController.ID,
                WordHighlighterContribution.ID,
                ViewportSemanticTokensContribution.ID,
                BracketMatchingController.ID,
                SmartSelectController.ID,
                ContentHoverController.ID,
                GlyphHoverController.ID,
                MessageController.ID,
                GotoDefinitionAtPositionEditorContribution.ID,
                SuggestController.ID,
                SnippetController2.ID,
                ColorDetector.ID,
                LinkDetector.ID,
                InspectEditorTokensController.ID,
            ])
        }));
    }
    focus() {
        this.editor.focus();
    }
    updatePaddingForLayout() {
        // scrollWidth = "the width of the content that needs to be scrolled"
        // contentWidth = "the width of the area where content is displayed"
        const horizontalScrollbarVisible = this.currentScrollWidth > this.editor.getLayoutInfo().contentWidth;
        const scrollbarHeight = this.editor.getLayoutInfo().horizontalScrollbarHeight;
        const bottomPadding = horizontalScrollbarVisible ?
            Math.max(this.verticalPadding - scrollbarHeight, 2) :
            this.verticalPadding;
        this.editor.updateOptions({ padding: { top: this.verticalPadding, bottom: bottomPadding } });
    }
    _configureForScreenReader() {
        const toolbarElt = this.toolbar.getElement();
        if (this.accessibilityService.isScreenReaderOptimized()) {
            toolbarElt.style.display = 'block';
        }
        else {
            toolbarElt.style.display = '';
        }
    }
    getEditorOptionsFromConfig() {
        return {
            wordWrap: this.editorOptions.configuration.resultEditor.wordWrap,
            fontLigatures: this.editorOptions.configuration.resultEditor.fontLigatures,
            bracketPairColorization: this.editorOptions.configuration.resultEditor.bracketPairColorization,
            fontFamily: this.editorOptions.configuration.resultEditor.fontFamily === 'default' ?
                EDITOR_FONT_DEFAULTS.fontFamily :
                this.editorOptions.configuration.resultEditor.fontFamily,
            fontSize: this.editorOptions.configuration.resultEditor.fontSize,
            fontWeight: this.editorOptions.configuration.resultEditor.fontWeight,
            lineHeight: this.editorOptions.configuration.resultEditor.lineHeight,
            ...this.currentCodeBlockData?.renderOptions?.editorOptions,
        };
    }
    layout(width) {
        const contentHeight = this.getContentHeight();
        let height = contentHeight;
        if (this.currentCodeBlockData?.renderOptions?.maxHeightInLines) {
            height = Math.min(contentHeight, this.editor.getOption(75 /* EditorOption.lineHeight */) * this.currentCodeBlockData?.renderOptions?.maxHeightInLines);
        }
        const editorBorder = 2;
        width = width - editorBorder - (this.currentCodeBlockData?.renderOptions?.reserveWidth ?? 0);
        this.editor.layout({ width: isRequestVM(this.currentCodeBlockData?.element) ? width * 0.9 : width, height });
        this.updatePaddingForLayout();
    }
    getContentHeight() {
        if (this.currentCodeBlockData?.range) {
            const lineCount = this.currentCodeBlockData.range.endLineNumber - this.currentCodeBlockData.range.startLineNumber + 1;
            const lineHeight = this.editor.getOption(75 /* EditorOption.lineHeight */);
            return lineCount * lineHeight;
        }
        return this.editor.getContentHeight();
    }
    async render(data, width) {
        this.currentCodeBlockData = data;
        if (data.parentContextKeyService) {
            this.contextKeyService.updateParent(data.parentContextKeyService);
        }
        if (this.getEditorOptionsFromConfig().wordWrap === 'on') {
            // Initialize the editor with the new proper width so that getContentHeight
            // will be computed correctly in the next call to layout()
            this.layout(width);
        }
        const didUpdate = await this.updateEditor(data);
        if (!didUpdate || this.isDisposed || this.currentCodeBlockData !== data) {
            return;
        }
        this.editor.updateOptions({
            ...this.getEditorOptionsFromConfig(),
        });
        if (!this.editor.getOption(8 /* EditorOption.ariaLabel */)) {
            // Don't override the ariaLabel if it was set by the editor options
            this.editor.updateOptions({
                ariaLabel: localize('chat.codeBlockLabel', "Code block {0}", data.codeBlockIndex + 1),
            });
        }
        this.layout(width);
        this.toolbar.setAriaLabel(localize('chat.codeBlockToolbarLabel', "Code block {0}", data.codeBlockIndex + 1));
        if (data.renderOptions?.hideToolbar) {
            dom.hide(this.toolbar.getElement());
        }
        else {
            dom.show(this.toolbar.getElement());
        }
        if (data.vulns?.length && isResponseVM(data.element)) {
            dom.clearNode(this.vulnsListElement);
            this.element.classList.remove('no-vulns');
            this.element.classList.toggle('chat-vulnerabilities-collapsed', !data.element.vulnerabilitiesListExpanded);
            dom.append(this.vulnsListElement, ...data.vulns.map(v => $('li', undefined, $('span.chat-vuln-title', undefined, v.title), ' ' + v.description)));
            this.vulnsButton.label = this.getVulnerabilitiesLabel();
        }
        else {
            this.element.classList.add('no-vulns');
        }
    }
    reset() {
        this.clearWidgets();
        this.currentCodeBlockData = undefined;
    }
    clearWidgets() {
        ContentHoverController.get(this.editor)?.hideContentHover();
        GlyphHoverController.get(this.editor)?.hideGlyphHover();
    }
    async updateEditor(data) {
        const textModel = await data.textModel;
        if (this.isDisposed || this.currentCodeBlockData !== data || !textModel || textModel.isDisposed()) {
            return false;
        }
        this.editor.setModel(textModel);
        if (data.range) {
            this.editor.setSelection(data.range);
            this.editor.revealRangeInCenter(data.range, 1 /* ScrollType.Immediate */);
        }
        this.updateContexts(data);
        return true;
    }
    getVulnerabilitiesLabel() {
        if (!this.currentCodeBlockData || !this.currentCodeBlockData.vulns) {
            return '';
        }
        const referencesLabel = this.currentCodeBlockData.vulns.length > 1 ?
            localize('vulnerabilitiesPlural', "{0} vulnerabilities", this.currentCodeBlockData.vulns.length) :
            localize('vulnerabilitiesSingular', "{0} vulnerability", 1);
        const icon = (element) => element.vulnerabilitiesListExpanded ? Codicon.chevronDown : Codicon.chevronRight;
        return `${referencesLabel} $(${icon(this.currentCodeBlockData.element).id})`;
    }
    updateContexts(data) {
        const textModel = this.editor.getModel();
        if (!textModel) {
            return;
        }
        this.toolbar.context = {
            code: textModel.getTextBuffer().getValueInRange(data.range ?? textModel.getFullModelRange(), 0 /* EndOfLinePreference.TextDefined */),
            codeBlockIndex: data.codeBlockIndex,
            element: data.element,
            languageId: textModel.getLanguageId(),
            codemapperUri: data.codemapperUri,
            chatSessionResource: data.chatSessionResource
        };
        this.resourceContextKey.set(textModel.uri);
    }
};
CodeBlockPart = __decorate([
    __param(5, IInstantiationService),
    __param(6, IContextKeyService),
    __param(7, IModelService),
    __param(8, IConfigurationService),
    __param(9, IAccessibilityService)
], CodeBlockPart);
export { CodeBlockPart };
let ChatCodeBlockContentProvider = class ChatCodeBlockContentProvider extends Disposable {
    constructor(textModelService, _modelService) {
        super();
        this._modelService = _modelService;
        this._register(textModelService.registerTextModelContentProvider(Schemas.vscodeChatCodeBlock, this));
    }
    async provideTextContent(resource) {
        const existing = this._modelService.getModel(resource);
        if (existing) {
            return existing;
        }
        return this._modelService.createModel('', null, resource);
    }
};
ChatCodeBlockContentProvider = __decorate([
    __param(0, ITextModelService),
    __param(1, IModelService)
], ChatCodeBlockContentProvider);
export { ChatCodeBlockContentProvider };
// long-lived object that sits in the DiffPool and that gets reused
let CodeCompareBlockPart = class CodeCompareBlockPart extends Disposable {
    constructor(options, menuId, delegate, overflowWidgetsDomNode, isSimpleWidget = false, instantiationService, contextKeyService, modelService, configurationService, accessibilityService, labelService, openerService) {
        super();
        this.options = options;
        this.menuId = menuId;
        this.isSimpleWidget = isSimpleWidget;
        this.modelService = modelService;
        this.configurationService = configurationService;
        this.accessibilityService = accessibilityService;
        this.labelService = labelService;
        this.openerService = openerService;
        this._onDidChangeContentHeight = this._register(new Emitter());
        this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
        this._lastDiffEditorViewModel = this._store.add(new MutableDisposable());
        this.currentScrollWidth = 0;
        this.currentHorizontalPadding = 0;
        this.element = $('.interactive-result-code-block');
        this.element.classList.add('compare');
        this.messageElement = dom.append(this.element, $('.message'));
        this.messageElement.setAttribute('role', 'status');
        this.messageElement.tabIndex = 0;
        this.contextKeyService = this._register(contextKeyService.createScoped(this.element));
        const scopedInstantiationService = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, this.contextKeyService], [IEditorProgressService, new class {
                show(_total, _delay) {
                    return emptyProgressRunner;
                }
                async showWhile(promise, _delay) {
                    await promise;
                }
            }])));
        const editorHeader = this.editorHeader = dom.append(this.element, $('.interactive-result-header.show-file-icons'));
        const editorElement = dom.append(this.element, $('.interactive-result-editor'));
        this.diffEditor = this.createDiffEditor(scopedInstantiationService, editorElement, {
            ...getSimpleEditorOptions(this.configurationService),
            lineNumbers: 'on',
            selectOnLineNumbers: true,
            scrollBeyondLastLine: false,
            lineDecorationsWidth: 12,
            dragAndDrop: false,
            padding: { top: defaultCodeblockPadding, bottom: defaultCodeblockPadding },
            mouseWheelZoom: false,
            scrollbar: {
                vertical: 'hidden',
                alwaysConsumeMouseWheel: false
            },
            definitionLinkOpensInPeek: false,
            gotoLocation: {
                multiple: 'goto',
                multipleDeclarations: 'goto',
                multipleDefinitions: 'goto',
                multipleImplementations: 'goto',
            },
            ariaLabel: localize('chat.codeBlockHelp', 'Code block'),
            overflowWidgetsDomNode,
            ...this.getEditorOptionsFromConfig(),
        });
        this.resourceLabel = this._register(scopedInstantiationService.createInstance(ResourceLabel, editorHeader, { supportIcons: true }));
        const editorScopedService = this.diffEditor.getModifiedEditor().contextKeyService.createScoped(editorHeader);
        const editorScopedInstantiationService = this._register(scopedInstantiationService.createChild(new ServiceCollection([IContextKeyService, editorScopedService])));
        this.toolbar = this._register(editorScopedInstantiationService.createInstance(MenuWorkbenchToolBar, editorHeader, menuId, {
            menuOptions: {
                shouldForwardArgs: true
            }
        }));
        this._configureForScreenReader();
        this._register(this.accessibilityService.onDidChangeScreenReaderOptimized(() => this._configureForScreenReader()));
        this._register(this.configurationService.onDidChangeConfiguration((e) => {
            if (e.affectedKeys.has("accessibility.verbosity.panelChat" /* AccessibilityVerbositySettingId.Chat */)) {
                this._configureForScreenReader();
            }
        }));
        this._register(this.options.onDidChange(() => {
            this.diffEditor.updateOptions(this.getEditorOptionsFromConfig());
        }));
        this._register(this.diffEditor.getModifiedEditor().onDidScrollChange(e => {
            this.currentScrollWidth = e.scrollWidth;
        }));
        this._register(this.diffEditor.onDidContentSizeChange(e => {
            if (e.contentHeightChanged) {
                this._onDidChangeContentHeight.fire();
            }
        }));
        this._register(this.diffEditor.getModifiedEditor().onDidBlurEditorWidget(() => {
            this.element.classList.remove('focused');
            WordHighlighterContribution.get(this.diffEditor.getModifiedEditor())?.stopHighlighting();
            this.clearWidgets();
        }));
        this._register(this.diffEditor.getModifiedEditor().onDidFocusEditorWidget(() => {
            this.element.classList.add('focused');
            WordHighlighterContribution.get(this.diffEditor.getModifiedEditor())?.restoreViewState(true);
        }));
        // Parent list scrolled
        if (delegate.onDidScroll) {
            this._register(delegate.onDidScroll(e => {
                this.clearWidgets();
            }));
        }
    }
    get uri() {
        return this.diffEditor.getModifiedEditor().getModel()?.uri;
    }
    createDiffEditor(instantiationService, parent, options) {
        const widgetOptions = {
            isSimpleWidget: this.isSimpleWidget,
            contributions: EditorExtensionsRegistry.getSomeEditorContributions([
                MenuPreventer.ID,
                SelectionClipboardContributionID,
                ContextMenuController.ID,
                WordHighlighterContribution.ID,
                ViewportSemanticTokensContribution.ID,
                BracketMatchingController.ID,
                SmartSelectController.ID,
                ContentHoverController.ID,
                GlyphHoverController.ID,
                GotoDefinitionAtPositionEditorContribution.ID,
            ])
        };
        return this._register(instantiationService.createInstance(DiffEditorWidget, parent, {
            scrollbar: { useShadows: false, alwaysConsumeMouseWheel: false, ignoreHorizontalScrollbarInContentHeight: true, },
            renderMarginRevertIcon: false,
            diffCodeLens: false,
            scrollBeyondLastLine: false,
            stickyScroll: { enabled: false },
            originalAriaLabel: localize('original', 'Original'),
            modifiedAriaLabel: localize('modified', 'Modified'),
            diffAlgorithm: 'advanced',
            readOnly: false,
            isInEmbeddedEditor: true,
            useInlineViewWhenSpaceIsLimited: true,
            experimental: {
                useTrueInlineView: true,
            },
            renderSideBySideInlineBreakpoint: 300,
            renderOverviewRuler: false,
            compactMode: true,
            hideUnchangedRegions: { enabled: true, contextLineCount: 1 },
            renderGutterMenu: false,
            lineNumbersMinChars: 1,
            ...options
        }, { originalEditor: widgetOptions, modifiedEditor: widgetOptions }));
    }
    focus() {
        this.diffEditor.focus();
    }
    updatePaddingForLayout() {
        // scrollWidth = "the width of the content that needs to be scrolled"
        // contentWidth = "the width of the area where content is displayed"
        const horizontalScrollbarVisible = this.currentScrollWidth > this.diffEditor.getModifiedEditor().getLayoutInfo().contentWidth;
        const scrollbarHeight = this.diffEditor.getModifiedEditor().getLayoutInfo().horizontalScrollbarHeight;
        const bottomPadding = horizontalScrollbarVisible ?
            Math.max(defaultCodeblockPadding - scrollbarHeight, 2) :
            defaultCodeblockPadding;
        this.diffEditor.updateOptions({ padding: { top: defaultCodeblockPadding, bottom: bottomPadding } });
    }
    _configureForScreenReader() {
        const toolbarElt = this.toolbar.getElement();
        if (this.accessibilityService.isScreenReaderOptimized()) {
            toolbarElt.style.display = 'block';
            toolbarElt.ariaLabel = localize('chat.codeBlock.toolbar', 'Code block toolbar');
        }
        else {
            toolbarElt.style.display = '';
        }
    }
    getEditorOptionsFromConfig() {
        return {
            wordWrap: this.options.configuration.resultEditor.wordWrap,
            fontLigatures: this.options.configuration.resultEditor.fontLigatures,
            bracketPairColorization: this.options.configuration.resultEditor.bracketPairColorization,
            fontFamily: this.options.configuration.resultEditor.fontFamily === 'default' ?
                EDITOR_FONT_DEFAULTS.fontFamily :
                this.options.configuration.resultEditor.fontFamily,
            fontSize: this.options.configuration.resultEditor.fontSize,
            fontWeight: this.options.configuration.resultEditor.fontWeight,
            lineHeight: this.options.configuration.resultEditor.lineHeight,
        };
    }
    layout(width) {
        const editorBorder = 2;
        const toolbar = dom.getTotalHeight(this.editorHeader);
        const content = this.diffEditor.getModel()
            ? this.diffEditor.getContentHeight()
            : dom.getTotalHeight(this.messageElement);
        const dimension = new dom.Dimension(width - editorBorder - this.currentHorizontalPadding * 2, toolbar + content);
        this.element.style.height = `${dimension.height}px`;
        this.element.style.width = `${dimension.width}px`;
        this.diffEditor.layout(dimension.with(undefined, content - editorBorder));
        this.updatePaddingForLayout();
    }
    async render(data, width, token) {
        this.currentHorizontalPadding = data.horizontalPadding || 0;
        if (data.parentContextKeyService) {
            this.contextKeyService.updateParent(data.parentContextKeyService);
        }
        if (this.options.configuration.resultEditor.wordWrap === 'on') {
            // Initialize the editor with the new proper width so that getContentHeight
            // will be computed correctly in the next call to layout()
            this.layout(width);
        }
        await this.updateEditor(data, token);
        this.layout(width);
        this.diffEditor.updateOptions({
            ariaLabel: localize('chat.compareCodeBlockLabel', "Code Edits"),
            readOnly: !!data.isReadOnly,
        });
        this.resourceLabel.element.setFile(data.edit.uri, {
            fileKind: FileKind.FILE,
            fileDecorations: { colors: true, badges: false }
        });
        this._onDidChangeContentHeight.fire();
    }
    reset() {
        this.clearWidgets();
    }
    clearWidgets() {
        ContentHoverController.get(this.diffEditor.getOriginalEditor())?.hideContentHover();
        ContentHoverController.get(this.diffEditor.getModifiedEditor())?.hideContentHover();
        GlyphHoverController.get(this.diffEditor.getOriginalEditor())?.hideGlyphHover();
        GlyphHoverController.get(this.diffEditor.getModifiedEditor())?.hideGlyphHover();
    }
    async updateEditor(data, token) {
        if (!isResponseVM(data.element)) {
            return;
        }
        const isEditApplied = Boolean(data.edit.state?.applied ?? 0);
        ChatContextKeys.editApplied.bindTo(this.contextKeyService).set(isEditApplied);
        this.element.classList.toggle('no-diff', isEditApplied);
        if (isEditApplied) {
            assertType(data.edit.state?.applied);
            const uriLabel = this.labelService.getUriLabel(data.edit.uri, { relative: true, noPrefix: true });
            let template;
            if (data.edit.state.applied === 1) {
                template = localize('chat.edits.1', "Applied 1 change in [[``{0}``]]", uriLabel);
            }
            else if (data.edit.state.applied < 0) {
                template = localize('chat.edits.rejected', "Edits in [[``{0}``]] have been rejected", uriLabel);
            }
            else {
                template = localize('chat.edits.N', "Applied {0} changes in [[``{1}``]]", data.edit.state.applied, uriLabel);
            }
            const message = renderFormattedText(template, {
                renderCodeSegments: true,
                actionHandler: {
                    callback: () => {
                        this.openerService.open(data.edit.uri, { fromUserGesture: true, allowCommands: false });
                    },
                    disposables: this._store,
                }
            });
            dom.reset(this.messageElement, message);
        }
        const diffData = await data.diffData;
        if (!isEditApplied && diffData) {
            const viewModel = this.diffEditor.createViewModel({
                original: diffData.original,
                modified: diffData.modified
            });
            await viewModel.waitForDiff();
            if (token.isCancellationRequested) {
                return;
            }
            const listener = Event.any(diffData.original.onWillDispose, diffData.modified.onWillDispose)(() => {
                // this a bit weird and basically duplicates https://github.com/microsoft/vscode/blob/7cbcafcbcc88298cfdcd0238018fbbba8eb6853e/src/vs/editor/browser/widget/diffEditor/diffEditorWidget.ts#L328
                // which cannot call `setModel(null)` without first complaining
                this.diffEditor.setModel(null);
            });
            this.diffEditor.setModel(viewModel);
            this._lastDiffEditorViewModel.value = combinedDisposable(listener, viewModel);
        }
        else {
            this.diffEditor.setModel(null);
            this._lastDiffEditorViewModel.value = undefined;
            this._onDidChangeContentHeight.fire();
        }
        this.toolbar.context = {
            edit: data.edit,
            element: data.element,
            diffEditor: this.diffEditor,
        };
    }
};
CodeCompareBlockPart = __decorate([
    __param(5, IInstantiationService),
    __param(6, IContextKeyService),
    __param(7, IModelService),
    __param(8, IConfigurationService),
    __param(9, IAccessibilityService),
    __param(10, ILabelService),
    __param(11, IOpenerService)
], CodeCompareBlockPart);
export { CodeCompareBlockPart };
let DefaultChatTextEditor = class DefaultChatTextEditor {
    constructor(modelService, editorService, dialogService) {
        this.modelService = modelService;
        this.editorService = editorService;
        this.dialogService = dialogService;
        this._sha1 = new DefaultModelSHA1Computer();
    }
    async apply(response, item, diffEditor) {
        if (!response.response.value.includes(item)) {
            // bogous item
            return;
        }
        if (item.state?.applied) {
            // already applied
            return;
        }
        if (!diffEditor) {
            for (const candidate of this.editorService.listDiffEditors()) {
                if (!candidate.getContainerDomNode().isConnected) {
                    continue;
                }
                const model = candidate.getModel();
                if (!model || !isEqual(model.original.uri, item.uri) || model.modified.uri.scheme !== Schemas.vscodeChatCodeCompareBlock) {
                    diffEditor = candidate;
                    break;
                }
            }
        }
        const edits = diffEditor
            ? await this._applyWithDiffEditor(diffEditor, item)
            : await this._apply(item);
        response.setEditApplied(item, edits);
    }
    async _applyWithDiffEditor(diffEditor, item) {
        const model = diffEditor.getModel();
        if (!model) {
            return 0;
        }
        const diff = diffEditor.getDiffComputationResult();
        if (!diff || diff.identical) {
            return 0;
        }
        if (!await this._checkSha1(model.original, item)) {
            return 0;
        }
        const modified = new TextModelText(model.modified);
        const edits = diff.changes2.map(i => i.toRangeMapping().toTextEdit(modified).toSingleEditOperation());
        model.original.pushStackElement();
        model.original.pushEditOperations(null, edits, () => null);
        model.original.pushStackElement();
        return edits.length;
    }
    async _apply(item) {
        const ref = await this.modelService.createModelReference(item.uri);
        try {
            if (!await this._checkSha1(ref.object.textEditorModel, item)) {
                return 0;
            }
            ref.object.textEditorModel.pushStackElement();
            let total = 0;
            for (const group of item.edits) {
                const edits = group.map(TextEdit.asEditOperation);
                ref.object.textEditorModel.pushEditOperations(null, edits, () => null);
                total += edits.length;
            }
            ref.object.textEditorModel.pushStackElement();
            return total;
        }
        finally {
            ref.dispose();
        }
    }
    async _checkSha1(model, item) {
        if (item.state?.sha1 && this._sha1.computeSHA1(model) && this._sha1.computeSHA1(model) !== item.state.sha1) {
            const result = await this.dialogService.confirm({
                message: localize('interactive.compare.apply.confirm', "The original file has been modified."),
                detail: localize('interactive.compare.apply.confirm.detail', "Do you want to apply the changes anyway?"),
            });
            if (!result.confirmed) {
                return false;
            }
        }
        return true;
    }
    discard(response, item) {
        if (!response.response.value.includes(item)) {
            // bogous item
            return;
        }
        if (item.state?.applied) {
            // already applied
            return;
        }
        response.setEditApplied(item, -1);
    }
};
DefaultChatTextEditor = __decorate([
    __param(0, ITextModelService),
    __param(1, ICodeEditorService),
    __param(2, IDialogService)
], DefaultChatTextEditor);
export { DefaultChatTextEditor };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZUJsb2NrUGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY29kZUJsb2NrUGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLHFCQUFxQixDQUFDO0FBRTdCLE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDeEYsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBRXRFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN6RyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM5RCxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLGdDQUFnQyxDQUFDO0FBR3BFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBNEIsTUFBTSxrRUFBa0UsQ0FBQztBQUM5SCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUVwRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw4Q0FB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