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
import * as dom from '../../../../base/browser/dom.js';
import { $ } from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { StandardMouseEvent } from '../../../../base/browser/mouseEvent.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { createInstantHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { Codicon } from '../../../../base/common/codicons.js';
import * as event from '../../../../base/common/event.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { basename, dirname } from '../../../../base/common/path.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../nls.js';
import { getFlatContextMenuActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IMenuService, MenuId } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { fillInSymbolsDragData } from '../../../../platform/dnd/browser/dnd.js';
import { registerOpenEditorListeners } from '../../../../platform/editor/browser/editor.js';
import { FileKind, IFileService } from '../../../../platform/files/common/files.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { FolderThemeIcon, IThemeService } from '../../../../platform/theme/common/themeService.js';
import { fillEditorsDragData } from '../../../browser/dnd.js';
import { ResourceContextKey } from '../../../common/contextkeys.js';
import { IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { revealInSideBarCommand } from '../../files/browser/fileActions.contribution.js';
import { CellUri } from '../../notebook/common/notebookCommon.js';
import { INotebookService } from '../../notebook/common/notebookService.js';
import { toHistoryItemHoverContent } from '../../scm/browser/scmHistory.js';
import { getHistoryItemEditorTitle } from '../../scm/browser/util.js';
import { ITerminalService } from '../../terminal/browser/terminal.js';
import { PromptFileVariableKind } from '../common/chatVariableEntries.js';
import { ILanguageModelsService } from '../common/languageModels.js';
import { ILanguageModelToolsService, ToolSet } from '../common/languageModelToolsService.js';
import { getCleanPromptName } from '../common/promptSyntax/config/promptFileLocations.js';
const commonHoverOptions = {
    style: 1 /* HoverStyle.Pointer */,
    position: {
        hoverPosition: 2 /* HoverPosition.BELOW */
    },
    trapFocus: true,
};
const commonHoverLifecycleOptions = {
    groupId: 'chat-attachments',
};
let AbstractChatAttachmentWidget = class AbstractChatAttachmentWidget extends Disposable {
    get onDidDelete() {
        return this._onDidDelete.event;
    }
    get onDidOpen() {
        return this._onDidOpen.event;
    }
    constructor(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, terminalService) {
        super();
        this.attachment = attachment;
        this.options = options;
        this.currentLanguageModel = currentLanguageModel;
        this.commandService = commandService;
        this.openerService = openerService;
        this.terminalService = terminalService;
        this._onDidDelete = this._register(new event.Emitter());
        this._onDidOpen = this._register(new event.Emitter());
        this.element = dom.append(container, $('.chat-attached-context-attachment.show-file-icons'));
        this.label = contextResourceLabels.create(this.element, { supportIcons: true, hoverTargetOverride: this.element });
        this._register(this.label);
        this.element.tabIndex = 0;
        this.element.role = 'button';
        // Add middle-click support for removal
        this._register(dom.addDisposableListener(this.element, dom.EventType.AUXCLICK, (e) => {
            if (e.button === 1 /* Middle Button */ && this.options.supportsDeletion && !this.attachment.range) {
                e.preventDefault();
                e.stopPropagation();
                this._onDidDelete.fire(e);
            }
        }));
    }
    modelSupportsVision() {
        return modelSupportsVision(this.currentLanguageModel);
    }
    attachClearButton() {
        if (this.attachment.range || !this.options.supportsDeletion) {
            // no clear button for attachments with ranges because range means
            // referenced from prompt
            return;
        }
        const clearButton = new Button(this.element, {
            supportIcons: true,
            hoverDelegate: createInstantHoverDelegate(),
            title: localize('chat.attachment.clearButton', "Remove from context")
        });
        clearButton.element.tabIndex = -1;
        clearButton.icon = Codicon.close;
        this._register(clearButton);
        this._register(event.Event.once(clearButton.onDidClick)((e) => {
            this._onDidDelete.fire(e);
        }));
        this._register(dom.addStandardDisposableListener(this.element, dom.EventType.KEY_DOWN, e => {
            if (e.keyCode === 1 /* KeyCode.Backspace */ || e.keyCode === 20 /* KeyCode.Delete */) {
                this._onDidDelete.fire(e.browserEvent);
            }
        }));
    }
    addResourceOpenHandlers(resource, range) {
        this.element.style.cursor = 'pointer';
        this._register(registerOpenEditorListeners(this.element, async (options) => {
            if (this.attachment.kind === 'directory') {
                await this.openResource(resource, options, true);
            }
            else {
                await this.openResource(resource, options, false, range);
            }
        }));
    }
    async openResource(resource, openOptions, isDirectory, range) {
        if (isDirectory) {
            // Reveal Directory in explorer
            this.commandService.executeCommand(revealInSideBarCommand.id, resource);
            return;
        }
        if (resource.scheme === Schemas.vscodeTerminal) {
            this.terminalService?.openResource(resource);
            return;
        }
        // Open file in editor
        const openTextEditorOptions = range ? { selection: range } : undefined;
        const options = {
            fromUserGesture: true,
            openToSide: openOptions.openToSide,
            editorOptions: {
                ...openTextEditorOptions,
                ...openOptions.editorOptions
            },
        };
        await this.openerService.open(resource, options);
        this._onDidOpen.fire();
        this.element.focus();
    }
};
AbstractChatAttachmentWidget = __decorate([
    __param(5, ICommandService),
    __param(6, IOpenerService),
    __param(7, ITerminalService)
], AbstractChatAttachmentWidget);
function modelSupportsVision(currentLanguageModel) {
    return currentLanguageModel?.metadata.capabilities?.vision ?? false;
}
let FileAttachmentWidget = class FileAttachmentWidget extends AbstractChatAttachmentWidget {
    constructor(resource, range, attachment, correspondingContentReference, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, themeService, hoverService, languageModelsService, instantiationService) {
        super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService);
        this.themeService = themeService;
        this.hoverService = hoverService;
        this.languageModelsService = languageModelsService;
        this.instantiationService = instantiationService;
        const fileBasename = basename(resource.path);
        const fileDirname = dirname(resource.path);
        const friendlyName = `${fileBasename} ${fileDirname}`;
        let ariaLabel = range ? localize('chat.fileAttachmentWithRange', "Attached file, {0}, line {1} to line {2}", friendlyName, range.startLineNumber, range.endLineNumber) : localize('chat.fileAttachment', "Attached file, {0}", friendlyName);
        if (attachment.omittedState === 2 /* OmittedState.Full */) {
            ariaLabel = localize('chat.omittedFileAttachment', "Omitted this file: {0}", attachment.name);
            this.renderOmittedWarning(friendlyName, ariaLabel);
        }
        else {
            const fileOptions = { hidePath: true, title: correspondingContentReference?.options?.status?.description };
            this.label.setFile(resource, attachment.kind === 'file' ? {
                ...fileOptions,
                fileKind: FileKind.FILE,
                range,
            } : {
                ...fileOptions,
                fileKind: FileKind.FOLDER,
                icon: !this.themeService.getFileIconTheme().hasFolderIcons ? FolderThemeIcon : undefined
            });
        }
        this.element.ariaLabel = ariaLabel;
        this.instantiationService.invokeFunction(accessor => {
            this._register(hookUpResourceAttachmentDragAndContextMenu(accessor, this.element, resource));
        });
        this.addResourceOpenHandlers(resource, range);
        this.attachClearButton();
    }
    renderOmittedWarning(friendlyName, ariaLabel) {
        const pillIcon = dom.$('div.chat-attached-context-pill', {}, dom.$('span.codicon.codicon-warning'));
        const textLabel = dom.$('span.chat-attached-context-custom-text', {}, friendlyName);
        this.element.appendChild(pillIcon);
        this.element.appendChild(textLabel);
        const hoverElement = dom.$('div.chat-attached-context-hover');
        hoverElement.setAttribute('aria-label', ariaLabel);
        this.element.classList.add('warning');
        hoverElement.textContent = localize('chat.fileAttachmentHover', "{0} does not support this file type.", this.currentLanguageModel ? this.languageModelsService.lookupLanguageModel(this.currentLanguageModel.identifier)?.name : this.currentLanguageModel ?? 'This model');
        this._register(this.hoverService.setupDelayedHover(this.element, {
            ...commonHoverOptions,
            content: hoverElement,
        }, commonHoverLifecycleOptions));
    }
};
FileAttachmentWidget = __decorate([
    __param(8, ICommandService),
    __param(9, IOpenerService),
    __param(10, IThemeService),
    __param(11, IHoverService),
    __param(12, ILanguageModelsService),
    __param(13, IInstantiationService)
], FileAttachmentWidget);
export { FileAttachmentWidget };
let TerminalCommandAttachmentWidget = class TerminalCommandAttachmentWidget extends AbstractChatAttachmentWidget {
    constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, hoverService, terminalService) {
        super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService, terminalService);
        this.hoverService = hoverService;
        this.terminalService = terminalService;
        const ariaLabel = localize('chat.terminalCommand', "Terminal command, {0}", attachment.command);
        const clickHandler = () => this.openResource(attachment.resource, { editorOptions: { preserveFocus: true } }, false, undefined);
        this._register(createTerminalCommandElements(this.element, attachment, ariaLabel, this.hoverService, clickHandler));
        this._register(dom.addDisposableListener(this.element, dom.EventType.KEY_DOWN, async (e) => {
            const event = new StandardKeyboardEvent(e);
            if (event.equals(3 /* KeyCode.Enter */) || event.equals(10 /* KeyCode.Space */)) {
                dom.EventHelper.stop(e, true);
                await clickHandler();
            }
        }));
        this.attachClearButton();
    }
};
TerminalCommandAttachmentWidget = __decorate([
    __param(5, ICommandService),
    __param(6, IOpenerService),
    __param(7, IHoverService),
    __param(8, ITerminalService)
], TerminalCommandAttachmentWidget);
export { TerminalCommandAttachmentWidget };
var TerminalConstants;
(function (TerminalConstants) {
    TerminalConstants[TerminalConstants["MaxAttachmentOutputLineCount"] = 5] = "MaxAttachmentOutputLineCount";
    TerminalConstants[TerminalConstants["MaxAttachmentOutputLineLength"] = 80] = "MaxAttachmentOutputLineLength";
})(TerminalConstants || (TerminalConstants = {}));
function createTerminalCommandElements(element, attachment, ariaLabel, hoverService, clickHandler) {
    const disposable = new DisposableStore();
    element.ariaLabel = ariaLabel;
    element.style.cursor = 'pointer';
    const terminalIconSpan = dom.$('span');
    terminalIconSpan.classList.add(...ThemeIcon.asClassNameArray(Codicon.terminal));
    const pillIcon = dom.$('div.chat-attached-context-pill', {}, terminalIconSpan);
    const textLabel = dom.$('span.chat-attached-context-custom-text', {}, attachment.command);
    element.appendChild(pillIcon);
    element.appendChild(textLabel);
    disposable.add(dom.addDisposableListener(element, dom.EventType.CLICK, e => {
        e.preventDefault();
        e.stopPropagation();
        clickHandler();
    }));
    const hoverElement = dom.$('div.chat-attached-context-hover');
    hoverElement.setAttribute('aria-label', ariaLabel);
    const commandTitle = dom.$('div', {}, typeof attachment.exitCode === 'number'
        ? localize('chat.terminalCommandHoverCommandTitleExit', "Command: {0}, exit code: {1}", attachment.command, attachment.exitCode)
        : localize('chat.terminalCommandHoverCommandTitle', "Command"));
    commandTitle.classList.add('attachment-additional-info');
    const commandBlock = dom.$('pre.chat-terminal-command-block');
    hoverElement.append(commandTitle, commandBlock);
    if (attachment.output && attachment.output.trim().length > 0) {
        const outputTitle = dom.$('div', {}, localize('chat.terminalCommandHoverOutputTitle', "Output:"));
        outputTitle.classList.add('attachment-additional-info');
        const outputBlock = dom.$('pre.chat-terminal-command-output');
        const fullOutputLines = attachment.output.split('\n');
        const hoverOutputLines = [];
        for (const line of fullOutputLines) {
            if (hoverOutputLines.length >= 5 /* TerminalConstants.MaxAttachmentOutputLineCount */) {
                hoverOutputLines.push('...');
                break;
            }
            const trimmed = line.trim();
            if (trimmed.length === 0) {
                continue;
            }
            if (trimmed.length > 80 /* TerminalConstants.MaxAttachmentOutputLineLength */) {
                hoverOutputLines.push(`${trimmed.slice(0, 80 /* TerminalConstants.MaxAttachmentOutputLineLength */)}...`);
            }
            else {
                hoverOutputLines.push(trimmed);
            }
        }
        outputBlock.textContent = hoverOutputLines.join('\n');
        hoverElement.append(outputTitle, outputBlock);
    }
    const hint = dom.$('div', {}, localize('chat.terminalCommandHoverHint', "Click to focus this command in the terminal."));
    hint.classList.add('attachment-additional-info');
    hoverElement.appendChild(hint);
    disposable.add(hoverService.setupDelayedHover(element, {
        ...commonHoverOptions,
        content: hoverElement,
    }, commonHoverLifecycleOptions));
    return disposable;
}
let ImageAttachmentWidget = class ImageAttachmentWidget extends AbstractChatAttachmentWidget {
    constructor(resource, attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, hoverService, languageModelsService, instantiationService, labelService) {
        super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService);
        this.hoverService = hoverService;
        this.languageModelsService = languageModelsService;
        this.labelService = labelService;
        let ariaLabel;
        if (attachment.omittedState === 2 /* OmittedState.Full */) {
            ariaLabel = localize('chat.omittedImageAttachment', "Omitted this image: {0}", attachment.name);
        }
        else if (attachment.omittedState === 1 /* OmittedState.Partial */) {
            ariaLabel = localize('chat.partiallyOmittedImageAttachment', "Partially omitted this image: {0}", attachment.name);
        }
        else {
            ariaLabel = localize('chat.imageAttachment', "Attached image, {0}", attachment.name);
        }
        const ref = attachment.references?.[0]?.reference;
        resource = ref && URI.isUri(ref) ? ref : undefined;
        const clickHandler = async () => {
            if (resource) {
                await this.openResource(resource, { editorOptions: { preserveFocus: true } }, false, undefined);
            }
        };
        const currentLanguageModelName = this.currentLanguageModel ? this.languageModelsService.lookupLanguageModel(this.currentLanguageModel.identifier)?.name ?? this.currentLanguageModel.identifier : 'Current model';
        const fullName = resource ? this.labelService.getUriLabel(resource) : (attachment.fullName || attachment.name);
        this._register(createImageElements(resource, attachment.name, fullName, this.element, attachment.value, this.hoverService, ariaLabel, currentLanguageModelName, clickHandler, this.currentLanguageModel, attachment.omittedState));
        if (resource) {
            this.addResourceOpenHandlers(resource, undefined);
            instantiationService.invokeFunction(accessor => {
                this._register(hookUpResourceAttachmentDragAndContextMenu(accessor, this.element, resource));
            });
        }
        this.attachClearButton();
    }
};
ImageAttachmentWidget = __decorate([
    __param(6, ICommandService),
    __param(7, IOpenerService),
    __param(8, IHoverService),
    __param(9, ILanguageModelsService),
    __param(10, IInstantiationService),
    __param(11, ILabelService)
], ImageAttachmentWidget);
export { ImageAttachmentWidget };
function createImageElements(resource, name, fullName, element, buffer, hoverService, ariaLabel, currentLanguageModelName, clickHandler, currentLanguageModel, omittedState) {
    const disposable = new DisposableStore();
    if (omittedState === 1 /* OmittedState.Partial */) {
        element.classList.add('partial-warning');
    }
    element.ariaLabel = ariaLabel;
    element.style.position = 'relative';
    if (resource) {
        element.style.cursor = 'pointer';
        disposable.add(dom.addDisposableListener(element, 'click', clickHandler));
    }
    const supportsVision = modelSupportsVision(currentLanguageModel);
    const pillIcon = dom.$('div.chat-attached-context-pill', {}, dom.$(supportsVision ? 'span.codicon.codicon-file-media' : 'span.codicon.codicon-warning'));
    const textLabel = dom.$('span.chat-attached-context-custom-text', {}, name);
    element.appendChild(pillIcon);
    element.appendChild(textLabel);
    const hoverElement = dom.$('div.chat-attached-context-hover');
    hoverElement.setAttribute('aria-label', ariaLabel);
    if ((!supportsVision && currentLanguageModel) || omittedState === 2 /* OmittedState.Full */) {
        element.classList.add('warning');
        hoverElement.textContent = localize('chat.imageAttachmentHover', "{0} does not support images.", currentLanguageModelName ?? 'This model');
        disposable.add(hoverService.setupDelayedHover(element, {
            content: hoverElement,
            style: 1 /* HoverStyle.Pointer */,
        }));
    }
    else {
        disposable.add(hoverService.setupDelayedHover(element, {
            content: hoverElement,
            style: 1 /* HoverStyle.Pointer */,
        }));
        const blob = new Blob([buffer], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const pillImg = dom.$('img.chat-attached-context-pill-image', { src: url, alt: '' });
        const pill = dom.$('div.chat-attached-context-pill', {}, pillImg);
        // eslint-disable-next-line no-restricted-syntax
        const existingPill = element.querySelector('.chat-attached-context-pill');
        if (existingPill) {
            existingPill.replaceWith(pill);
        }
        const hoverImage = dom.$('img.chat-attached-context-image', { src: url, alt: '' });
        const imageContainer = dom.$('div.chat-attached-context-image-container', {}, hoverImage);
        hoverElement.appendChild(imageContainer);
        if (resource) {
            const urlContainer = dom.$('a.chat-attached-context-url', {}, omittedState === 1 /* OmittedState.Partial */ ? localize('chat.imageAttachmentWarning', "This GIF was partially omitted - current frame will be sent.") : fullName);
            const separator = dom.$('div.chat-attached-context-url-separator');
            disposable.add(dom.addDisposableListener(urlContainer, 'click', () => clickHandler()));
            hoverElement.append(separator, urlContainer);
        }
        hoverImage.onload = () => { URL.revokeObjectURL(url); };
        hoverImage.onerror = () => {
            // reset to original icon on error or invalid image
            const pillIcon = dom.$('div.chat-attached-context-pill', {}, dom.$('span.codicon.codicon-file-media'));
            const pill = dom.$('div.chat-attached-context-pill', {}, pillIcon);
            // eslint-disable-next-line no-restricted-syntax
            const existingPill = element.querySelector('.chat-attached-context-pill');
            if (existingPill) {
                existingPill.replaceWith(pill);
            }
        };
    }
    return disposable;
}
let PasteAttachmentWidget = class PasteAttachmentWidget extends AbstractChatAttachmentWidget {
    constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, hoverService, instantiationService) {
        super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService);
        this.hoverService = hoverService;
        this.instantiationService = instantiationService;
        const ariaLabel = localize('chat.attachment', "Attached context, {0}", attachment.name);
        this.element.ariaLabel = ariaLabel;
        const classNames = ['file-icon', `${attachment.language}-lang-file-icon`];
        let resource;
        let range;
        if (attachment.copiedFrom) {
            resource = attachment.copiedFrom.uri;
            range = attachment.copiedFrom.range;
            const filename = basename(resource.path);
            this.label.setLabel(filename, undefined, { extraClasses: classNames });
        }
        else {
            this.label.setLabel(attachment.fileName, undefined, { extraClasses: classNames });
        }
        this.element.appendChild(dom.$('span.attachment-additional-info', {}, `Pasted ${attachment.pastedLines}`));
        this.element.style.position = 'relative';
        const sourceUri = attachment.copiedFrom?.uri;
        const hoverContent = new MarkdownString(`${sourceUri ? this.instantiationService.invokeFunction(accessor => accessor.get(ILabelService).getUriLabel(sourceUri, { relative: true })) : attachment.fileName}\n\n---\n\n\`\`\`${attachment.language}\n\n${attachment.code}\n\`\`\``);
        this._register(this.hoverService.setupDelayedHover(this.element, {
            ...commonHoverOptions,
            content: hoverContent,
        }, commonHoverLifecycleOptions));
        const copiedFromResource = attachment.copiedFrom?.uri;
        if (copiedFromResource) {
            this._register(this.instantiationService.invokeFunction(hookUpResourceAttachmentDragAndContextMenu, this.element, copiedFromResource));
            this.addResourceOpenHandlers(copiedFromResource, range);
        }
        this.attachClearButton();
    }
};
PasteAttachmentWidget = __decorate([
    __param(5, ICommandService),
    __param(6, IOpenerService),
    __param(7, IHoverService),
    __param(8, IInstantiationService)
], PasteAttachmentWidget);
export { PasteAttachmentWidget };
let DefaultChatAttachmentWidget = class DefaultChatAttachmentWidget extends AbstractChatAttachmentWidget {
    constructor(resource, range, attachment, correspondingContentReference, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, contextKeyService, instantiationService) {
        super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService);
        this.contextKeyService = contextKeyService;
        this.instantiationService = instantiationService;
        const attachmentLabel = attachment.fullName ?? attachment.name;
        const withIcon = attachment.icon?.id ? `$(${attachment.icon.id})\u00A0${attachmentLabel}` : attachmentLabel;
        this.label.setLabel(withIcon, correspondingContentReference?.options?.status?.description);
        this.element.ariaLabel = localize('chat.attachment', "Attached context, {0}", attachment.name);
        if (attachment.kind === 'diagnostic') {
            if (attachment.filterUri) {
                resource = attachment.filterUri ? URI.revive(attachment.filterUri) : undefined;
                range = attachment.filterRange;
            }
            else {
                this.element.style.cursor = 'pointer';
                this._register(dom.addDisposableListener(this.element, dom.EventType.CLICK, () => {
                    this.commandService.executeCommand('workbench.panel.markers.view.focus');
                }));
            }
        }
        if (attachment.kind === 'symbol') {
            const scopedContextKeyService = this._register(this.contextKeyService.createScoped(this.element));
            this._register(this.instantiationService.invokeFunction(hookUpSymbolAttachmentDragAndContextMenu, this.element, scopedContextKeyService, { ...attachment, kind: attachment.symbolKind }, MenuId.ChatInputSymbolAttachmentContext));
        }
        if (resource) {
            this.addResourceOpenHandlers(resource, range);
        }
        this.attachClearButton();
    }
};
DefaultChatAttachmentWidget = __decorate([
    __param(8, ICommandService),
    __param(9, IOpenerService),
    __param(10, IContextKeyService),
    __param(11, IInstantiationService)
], DefaultChatAttachmentWidget);
export { DefaultChatAttachmentWidget };
let PromptFileAttachmentWidget = class PromptFileAttachmentWidget extends AbstractChatAttachmentWidget {
    constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, labelService, instantiationService) {
        super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService);
        this.labelService = labelService;
        this.instantiationService = instantiationService;
        this.hintElement = dom.append(this.element, dom.$('span.prompt-type'));
        this.updateLabel(attachment);
        this.instantiationService.invokeFunction(accessor => {
            this._register(hookUpResourceAttachmentDragAndContextMenu(accessor, this.element, attachment.value));
        });
        this.addResourceOpenHandlers(attachment.value, undefined);
        this.attachClearButton();
    }
    updateLabel(attachment) {
        const resource = attachment.value;
        const fileBasename = basename(resource.path);
        const fileDirname = dirname(resource.path);
        const friendlyName = `${fileBasename} ${fileDirname}`;
        const isPrompt = attachment.id.startsWith(PromptFileVariableKind.PromptFile);
        const ariaLabel = isPrompt
            ? localize('chat.promptAttachment', "Prompt file, {0}", friendlyName)
            : localize('chat.instructionsAttachment', "Instructions attachment, {0}", friendlyName);
        const typeLabel = isPrompt
            ? localize('prompt', "Prompt")
            : localize('instructions', "Instructions");
        const title = this.labelService.getUriLabel(resource) + (attachment.originLabel ? `\n${attachment.originLabel}` : '');
        //const { topError } = this.promptFile;
        this.element.classList.remove('warning', 'error');
        // if there are some errors/warning during the process of resolving
        // attachment references (including all the nested child references),
        // add the issue details in the hover title for the attachment, one
        // error/warning at a time because there is a limited space available
        // if (topError) {
        // 	const { errorSubject: subject } = topError;
        // 	const isError = (subject === 'root');
        // 	this.element.classList.add((isError) ? 'error' : 'warning');
        // 	const severity = (isError)
        // 		? localize('error', "Error")
        // 		: localize('warning', "Warning");
        // 	title += `\n[${severity}]: ${topError.localizedMessage}`;
        // }
        const fileWithoutExtension = getCleanPromptName(resource);
        this.label.setFile(URI.file(fileWithoutExtension), {
            fileKind: FileKind.FILE,
            hidePath: true,
            range: undefined,
            title,
            icon: ThemeIcon.fromId(Codicon.bookmark.id),
            extraClasses: [],
        });
        this.hintElement.innerText = typeLabel;
        this.element.ariaLabel = ariaLabel;
    }
};
PromptFileAttachmentWidget = __decorate([
    __param(5, ICommandService),
    __param(6, IOpenerService),
    __param(7, ILabelService),
    __param(8, IInstantiationService)
], PromptFileAttachmentWidget);
export { PromptFileAttachmentWidget };
let PromptTextAttachmentWidget = class PromptTextAttachmentWidget extends AbstractChatAttachmentWidget {
    constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, preferencesService, hoverService) {
        super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService);
        if (attachment.settingId) {
            const openSettings = () => preferencesService.openSettings({ jsonEditor: false, query: `@id:${attachment.settingId}` });
            this.element.style.cursor = 'pointer';
            this._register(dom.addDisposableListener(this.element, dom.EventType.CLICK, async (e) => {
                dom.EventHelper.stop(e, true);
                openSettings();
            }));
            this._register(dom.addDisposableListener(this.element, dom.EventType.KEY_DOWN, async (e) => {
                const event = new StandardKeyboardEvent(e);
                if (event.equals(3 /* KeyCode.Enter */) || event.equals(10 /* KeyCode.Space */)) {
                    dom.EventHelper.stop(e, true);
                    openSettings();
                }
            }));
        }
        this.label.setLabel(localize('instructions.label', 'Additional Instructions'), undefined, undefined);
        this._register(hoverService.setupDelayedHover(this.element, {
            ...commonHoverOptions,
            content: attachment.value,
        }, commonHoverLifecycleOptions));
    }
};
PromptTextAttachmentWidget = __decorate([
    __param(5, ICommandService),
    __param(6, IOpenerService),
    __param(7, IPreferencesService),
    __param(8, IHoverService)
], PromptTextAttachmentWidget);
export { PromptTextAttachmentWidget };
let ToolSetOrToolItemAttachmentWidget = class ToolSetOrToolItemAttachmentWidget extends AbstractChatAttachmentWidget {
    constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, toolsService, commandService, openerService, hoverService) {
        super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService);
        const toolOrToolSet = Iterable.find(toolsService.getTools(), tool => tool.id === attachment.id) ?? Iterable.find(toolsService.toolSets.get(), toolSet => toolSet.id === attachment.id);
        let name = attachment.name;
        const icon = attachment.icon ?? Codicon.tools;
        if (toolOrToolSet instanceof ToolSet) {
            name = toolOrToolSet.referenceName;
        }
        else if (toolOrToolSet) {
            name = toolOrToolSet.toolReferenceName ?? name;
        }
        this.label.setLabel(`$(${icon.id})\u00A0${name}`, undefined);
        this.element.style.cursor = 'pointer';
        this.element.ariaLabel = localize('chat.attachment', "Attached context, {0}", name);
        let hoverContent;
        if (toolOrToolSet instanceof ToolSet) {
            hoverContent = localize('toolset', "{0} - {1}", toolOrToolSet.description ?? toolOrToolSet.referenceName, toolOrToolSet.source.label);
        }
        else if (toolOrToolSet) {
            hoverContent = localize('tool', "{0} - {1}", toolOrToolSet.userDescription ?? toolOrToolSet.modelDescription, toolOrToolSet.source.label);
        }
        if (hoverContent) {
            this._register(hoverService.setupDelayedHover(this.element, {
                ...commonHoverOptions,
                content: hoverContent,
            }, commonHoverLifecycleOptions));
        }
        this.attachClearButton();
    }
};
ToolSetOrToolItemAttachmentWidget = __decorate([
    __param(5, ILanguageModelToolsService),
    __param(6, ICommandService),
    __param(7, IOpenerService),
    __param(8, IHoverService)
], ToolSetOrToolItemAttachmentWidget);
export { ToolSetOrToolItemAttachmentWidget };
let NotebookCellOutputChatAttachmentWidget = class NotebookCellOutputChatAttachmentWidget extends AbstractChatAttachmentWidget {
    constructor(resource, attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, hoverService, languageModelsService, notebookService, instantiationService) {
        super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService);
        this.hoverService = hoverService;
        this.languageModelsService = languageModelsService;
        this.notebookService = notebookService;
        this.instantiationService = instantiationService;
        switch (attachment.mimeType) {
            case 'application/vnd.code.notebook.error': {
                this.renderErrorOutput(resource, attachment);
                break;
            }
            case 'image/png':
            case 'image/jpeg':
            case 'image/svg': {
                this.renderImageOutput(resource, attachment);
                break;
            }
            default: {
                this.renderGenericOutput(resource, attachment);
            }
        }
        this.instantiationService.invokeFunction(accessor => {
            this._register(hookUpResourceAttachmentDragAndContextMenu(accessor, this.element, resource));
        });
        this.addResourceOpenHandlers(resource, undefined);
        this.attachClearButton();
    }
    getAriaLabel(attachment) {
        return localize('chat.NotebookImageAttachment', "Attached Notebook output, {0}", attachment.name);
    }
    renderErrorOutput(resource, attachment) {
        const attachmentLabel = attachment.name;
        const withIcon = attachment.icon?.id ? `$(${attachment.icon.id})\u00A0${attachmentLabel}` : attachmentLabel;
        const buffer = this.getOutputItem(resource, attachment)?.data.buffer ?? new Uint8Array();
        let title = undefined;
        try {
            const error = JSON.parse(new TextDecoder().decode(buffer));
            if (error.name && error.message) {
                title = `${error.name}: ${error.message}`;
            }
        }
        catch {
            //
        }
        this.label.setLabel(withIcon, undefined, { title });
        this.element.ariaLabel = this.getAriaLabel(attachment);
    }
    renderGenericOutput(resource, attachment) {
        this.element.ariaLabel = this.getAriaLabel(attachment);
        this.label.setFile(resource, { hidePath: true, icon: ThemeIcon.fromId('output') });
    }
    renderImageOutput(resource, attachment) {
        let ariaLabel;
        if (attachment.omittedState === 2 /* OmittedState.Full */) {
            ariaLabel = localize('chat.omittedNotebookImageAttachment', "Omitted this Notebook ouput: {0}", attachment.name);
        }
        else if (attachment.omittedState === 1 /* OmittedState.Partial */) {
            ariaLabel = localize('chat.partiallyOmittedNotebookImageAttachment', "Partially omitted this Notebook output: {0}", attachment.name);
        }
        else {
            ariaLabel = this.getAriaLabel(attachment);
        }
        const clickHandler = async () => await this.openResource(resource, { editorOptions: { preserveFocus: true } }, false, undefined);
        const currentLanguageModelName = this.currentLanguageModel ? this.languageModelsService.lookupLanguageModel(this.currentLanguageModel.identifier)?.name ?? this.currentLanguageModel.identifier : undefined;
        const buffer = this.getOutputItem(resource, attachment)?.data.buffer ?? new Uint8Array();
        this._register(createImageElements(resource, attachment.name, attachment.name, this.element, buffer, this.hoverService, ariaLabel, currentLanguageModelName, clickHandler, this.currentLanguageModel, attachment.omittedState));
    }
    getOutputItem(resource, attachment) {
        const parsedInfo = CellUri.parseCellOutputUri(resource);
        if (!parsedInfo || typeof parsedInfo.cellHandle !== 'number' || typeof parsedInfo.outputIndex !== 'number') {
            return undefined;
        }
        const notebook = this.notebookService.getNotebookTextModel(parsedInfo.notebook);
        if (!notebook) {
            return undefined;
        }
        const cell = notebook.cells.find(c => c.handle === parsedInfo.cellHandle);
        if (!cell) {
            return undefined;
        }
        const output = cell.outputs.length > parsedInfo.outputIndex ? cell.outputs[parsedInfo.outputIndex] : undefined;
        return output?.outputs.find(o => o.mime === attachment.mimeType);
    }
};
NotebookCellOutputChatAttachmentWidget = __decorate([
    __param(6, ICommandService),
    __param(7, IOpenerService),
    __param(8, IHoverService),
    __param(9, ILanguageModelsService),
    __param(10, INotebookService),
    __param(11, IInstantiationService)
], NotebookCellOutputChatAttachmentWidget);
export { NotebookCellOutputChatAttachmentWidget };
let ElementChatAttachmentWidget = class ElementChatAttachmentWidget extends AbstractChatAttachmentWidget {
    constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, editorService) {
        super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService);
        const ariaLabel = localize('chat.elementAttachment', "Attached element, {0}", attachment.name);
        this.element.ariaLabel = ariaLabel;
        this.element.style.position = 'relative';
        this.element.style.cursor = 'pointer';
        const attachmentLabel = attachment.name;
        const withIcon = attachment.icon?.id ? `$(${attachment.icon.id})\u00A0${attachmentLabel}` : attachmentLabel;
        this.label.setLabel(withIcon, undefined, { title: localize('chat.clickToViewContents', "Click to view the contents of: {0}", attachmentLabel) });
        this._register(dom.addDisposableListener(this.element, dom.EventType.CLICK, async () => {
            const content = attachment.value?.toString() || '';
            await editorService.openEditor({
                resource: undefined,
                contents: content,
                options: {
                    pinned: true
                }
            });
        }));
        this.attachClearButton();
    }
};
ElementChatAttachmentWidget = __decorate([
    __param(5, ICommandService),
    __param(6, IOpenerService),
    __param(7, IEditorService)
], ElementChatAttachmentWidget);
export { ElementChatAttachmentWidget };
let SCMHistoryItemAttachmentWidget = class SCMHistoryItemAttachmentWidget extends AbstractChatAttachmentWidget {
    constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, markdownRendererService, hoverService, openerService, themeService) {
        super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService);
        this.label.setLabel(attachment.name, undefined);
        this.element.style.cursor = 'pointer';
        this.element.ariaLabel = localize('chat.attachment', "Attached context, {0}", attachment.name);
        const { content, disposables } = toHistoryItemHoverContent(markdownRendererService, attachment.historyItem, false);
        this._store.add(hoverService.setupDelayedHover(this.element, {
            ...commonHoverOptions,
            content,
        }, commonHoverLifecycleOptions));
        this._store.add(disposables);
        this._store.add(dom.addDisposableListener(this.element, dom.EventType.CLICK, (e) => {
            dom.EventHelper.stop(e, true);
            this._openAttachment(attachment);
        }));
        this._store.add(dom.addDisposableListener(this.element, dom.EventType.KEY_DOWN, (e) => {
            const event = new StandardKeyboardEvent(e);
            if (event.equals(3 /* KeyCode.Enter */) || event.equals(10 /* KeyCode.Space */)) {
                dom.EventHelper.stop(e, true);
                this._openAttachment(attachment);
            }
        }));
        this.attachClearButton();
    }
    async _openAttachment(attachment) {
        await this.commandService.executeCommand('_workbench.openMultiDiffEditor', {
            title: getHistoryItemEditorTitle(attachment.historyItem), multiDiffSourceUri: attachment.value
        });
    }
};
SCMHistoryItemAttachmentWidget = __decorate([
    __param(5, ICommandService),
    __param(6, IMarkdownRendererService),
    __param(7, IHoverService),
    __param(8, IOpenerService),
    __param(9, IThemeService)
], SCMHistoryItemAttachmentWidget);
export { SCMHistoryItemAttachmentWidget };
let SCMHistoryItemChangeAttachmentWidget = class SCMHistoryItemChangeAttachmentWidget extends AbstractChatAttachmentWidget {
    constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, hoverService, markdownRendererService, openerService, themeService, editorService) {
        super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService);
        this.editorService = editorService;
        const nameSuffix = `\u00A0$(${Codicon.gitCommit.id})${attachment.historyItem.displayId ?? attachment.historyItem.id}`;
        this.label.setFile(attachment.value, { fileKind: FileKind.FILE, hidePath: true, nameSuffix });
        this.element.ariaLabel = localize('chat.attachment', "Attached context, {0}", attachment.name);
        const { content, disposables } = toHistoryItemHoverContent(markdownRendererService, attachment.historyItem, false);
        this._store.add(hoverService.setupDelayedHover(this.element, {
            ...commonHoverOptions, content,
        }, commonHoverLifecycleOptions));
        this._store.add(disposables);
        this.addResourceOpenHandlers(attachment.value, undefined);
        this.attachClearButton();
    }
    async openResource(resource, options, isDirectory, range) {
        const attachment = this.attachment;
        const historyItem = attachment.historyItem;
        await this.editorService.openEditor({
            resource,
            label: `${basename(resource.path)} (${historyItem.displayId ?? historyItem.id})`,
            options: { ...options.editorOptions }
        }, options.openToSide ? SIDE_GROUP : undefined);
    }
};
SCMHistoryItemChangeAttachmentWidget = __decorate([
    __param(5, ICommandService),
    __param(6, IHoverService),
    __param(7, IMarkdownRendererService),
    __param(8, IOpenerService),
    __param(9, IThemeService),
    __param(10, IEditorService)
], SCMHistoryItemChangeAttachmentWidget);
export { SCMHistoryItemChangeAttachmentWidget };
let SCMHistoryItemChangeRangeAttachmentWidget = class SCMHistoryItemChangeRangeAttachmentWidget extends AbstractChatAttachmentWidget {
    constructor(attachment, currentLanguageModel, options, container, contextResourceLabels, commandService, openerService, editorService) {
        super(attachment, options, container, contextResourceLabels, currentLanguageModel, commandService, openerService);
        this.editorService = editorService;
        const historyItemStartId = attachment.historyItemChangeStart.historyItem.displayId ?? attachment.historyItemChangeStart.historyItem.id;
        const historyItemEndId = attachment.historyItemChangeEnd.historyItem.displayId ?? attachment.historyItemChangeEnd.historyItem.id;
        const nameSuffix = `\u00A0$(${Codicon.gitCommit.id})${historyItemStartId}..${historyItemEndId}`;
        this.label.setFile(attachment.value, { fileKind: FileKind.FILE, hidePath: true, nameSuffix });
        this.element.ariaLabel = localize('chat.attachment', "Attached context, {0}", attachment.name);
        this.addResourceOpenHandlers(attachment.value, undefined);
        this.attachClearButton();
    }
    async openResource(resource, options, isDirectory, range) {
        const attachment = this.attachment;
        const historyItemChangeStart = attachment.historyItemChangeStart;
        const historyItemChangeEnd = attachment.historyItemChangeEnd;
        const originalUriTitle = `${basename(historyItemChangeStart.uri.fsPath)} (${historyItemChangeStart.historyItem.displayId ?? historyItemChangeStart.historyItem.id})`;
        const modifiedUriTitle = `${basename(historyItemChangeEnd.uri.fsPath)} (${historyItemChangeEnd.historyItem.displayId ?? historyItemChangeEnd.historyItem.id})`;
        await this.editorService.openEditor({
            original: { resource: historyItemChangeStart.uri },
            modified: { resource: historyItemChangeEnd.uri },
            label: `${originalUriTitle} ↔ ${modifiedUriTitle}`,
            options: { ...options.editorOptions }
        }, options.openToSide ? SIDE_GROUP : undefined);
    }
};
SCMHistoryItemChangeRangeAttachmentWidget = __decorate([
    __param(5, ICommandService),
    __param(6, IOpenerService),
    __param(7, IEditorService)
], SCMHistoryItemChangeRangeAttachmentWidget);
export { SCMHistoryItemChangeRangeAttachmentWidget };
export function hookUpResourceAttachmentDragAndContextMenu(accessor, widget, resource) {
    const contextKeyService = accessor.get(IContextKeyService);
    const instantiationService = accessor.get(IInstantiationService);
    const store = new DisposableStore();
    // Context
    const scopedContextKeyService = store.add(contextKeyService.createScoped(widget));
    store.add(setResourceContext(accessor, scopedContextKeyService, resource));
    // Drag and drop
    widget.draggable = true;
    store.add(dom.addDisposableListener(widget, 'dragstart', e => {
        instantiationService.invokeFunction(accessor => fillEditorsDragData(accessor, [resource], e));
        e.dataTransfer?.setDragImage(widget, 0, 0);
    }));
    // Context menu
    store.add(addBasicContextMenu(accessor, widget, scopedContextKeyService, MenuId.ChatInputResourceAttachmentContext, resource));
    return store;
}
export function hookUpSymbolAttachmentDragAndContextMenu(accessor, widget, scopedContextKeyService, attachment, contextMenuId) {
    const instantiationService = accessor.get(IInstantiationService);
    const languageFeaturesService = accessor.get(ILanguageFeaturesService);
    const textModelService = accessor.get(ITextModelService);
    const store = new DisposableStore();
    // Context
    store.add(setResourceContext(accessor, scopedContextKeyService, attachment.value.uri));
    const chatResourceContext = chatAttachmentResourceContextKey.bindTo(scopedContextKeyService);
    chatResourceContext.set(attachment.value.uri.toString());
    // Drag and drop
    widget.draggable = true;
    store.add(dom.addDisposableListener(widget, 'dragstart', e => {
        instantiationService.invokeFunction(accessor => fillEditorsDragData(accessor, [{ resource: attachment.value.uri, selection: attachment.value.range }], e));
        fillInSymbolsDragData([{
                fsPath: attachment.value.uri.fsPath,
                range: attachment.value.range,
                name: attachment.name,
                kind: attachment.kind,
            }], e);
        e.dataTransfer?.setDragImage(widget, 0, 0);
    }));
    // Context menu
    const providerContexts = [
        [EditorContextKeys.hasDefinitionProvider.bindTo(scopedContextKeyService), languageFeaturesService.definitionProvider],
        [EditorContextKeys.hasReferenceProvider.bindTo(scopedContextKeyService), languageFeaturesService.referenceProvider],
        [EditorContextKeys.hasImplementationProvider.bindTo(scopedContextKeyService), languageFeaturesService.implementationProvider],
        [EditorContextKeys.hasTypeDefinitionProvider.bindTo(scopedContextKeyService), languageFeaturesService.typeDefinitionProvider],
    ];
    const updateContextKeys = async () => {
        const modelRef = await textModelService.createModelReference(attachment.value.uri);
        try {
            const model = modelRef.object.textEditorModel;
            for (const [contextKey, registry] of providerContexts) {
                contextKey.set(registry.has(model));
            }
        }
        finally {
            modelRef.dispose();
        }
    };
    store.add(addBasicContextMenu(accessor, widget, scopedContextKeyService, contextMenuId, attachment.value, updateContextKeys));
    return store;
}
function setResourceContext(accessor, scopedContextKeyService, resource) {
    const fileService = accessor.get(IFileService);
    const languageService = accessor.get(ILanguageService);
    const modelService = accessor.get(IModelService);
    const resourceContextKey = new ResourceContextKey(scopedContextKeyService, fileService, languageService, modelService);
    resourceContextKey.set(resource);
    return resourceContextKey;
}
function addBasicContextMenu(accessor, widget, scopedContextKeyService, menuId, arg, updateContextKeys) {
    const contextMenuService = accessor.get(IContextMenuService);
    const menuService = accessor.get(IMenuService);
    return dom.addDisposableListener(widget, dom.EventType.CONTEXT_MENU, async (domEvent) => {
        const event = new StandardMouseEvent(dom.getWindow(domEvent), domEvent);
        dom.EventHelper.stop(domEvent, true);
        try {
            await updateContextKeys?.();
        }
        catch (e) {
            console.error(e);
        }
        contextMenuService.showContextMenu({
            contextKeyService: scopedContextKeyService,
            getAnchor: () => event,
            getActions: () => {
                const menu = menuService.getMenuActions(menuId, scopedContextKeyService, { arg });
                return getFlatContextMenuActions(menu);
            },
        });
    });
}
export const chatAttachmentResourceContextKey = new RawContextKey('chatAttachmentResource', undefined, { type: 'URI', description: localize('resource', "The full value of the chat attachment resource, including scheme and path") });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEF0dGFjaG1lbnRXaWRnZXRzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0QXR0YWNobWVudFdpZGdldHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDcEQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDbEYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDNUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBRXRFLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBRXZHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEtBQUssS0FBSyxNQUFNLGtDQUFrQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRXJELE9BQU8sRUFBRSxpQkFBaUIsRUFB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