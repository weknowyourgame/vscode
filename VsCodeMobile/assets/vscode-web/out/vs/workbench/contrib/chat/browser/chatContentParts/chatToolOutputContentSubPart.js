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
import * as dom from '../../../../../base/browser/dom.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { basename, joinPath } from '../../../../../base/common/resources.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { localize, localize2 } from '../../../../../nls.js';
import { MenuWorkbenchToolBar } from '../../../../../platform/actions/browser/toolbar.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IFileDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IProgressService } from '../../../../../platform/progress/common/progress.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { REVEAL_IN_EXPLORER_COMMAND_ID } from '../../../files/browser/fileConstants.js';
import { getAttachableImageExtension } from '../../common/chatModel.js';
import { ChatAttachmentsContentPart } from './chatAttachmentsContentPart.js';
/**
 * A reusable component for rendering tool output consisting of code blocks and/or resources.
 * This is used by both ChatCollapsibleInputOutputContentPart and ChatToolPostExecuteConfirmationPart.
 */
let ChatToolOutputContentSubPart = class ChatToolOutputContentSubPart extends Disposable {
    constructor(context, parts, contextKeyService, _instantiationService, _contextMenuService, _fileService) {
        super();
        this.context = context;
        this.parts = parts;
        this.contextKeyService = contextKeyService;
        this._instantiationService = _instantiationService;
        this._contextMenuService = _contextMenuService;
        this._fileService = _fileService;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this._currentWidth = 0;
        this._editorReferences = [];
        this.codeblocks = [];
        this.domNode = this.createOutputContents();
        this._currentWidth = context.currentWidth();
    }
    createOutputContents() {
        const container = dom.$('div');
        for (let i = 0; i < this.parts.length; i++) {
            const part = this.parts[i];
            if (part.kind === 'code') {
                this.addCodeBlock(part, container);
                continue;
            }
            const group = [];
            for (let k = i; k < this.parts.length; k++) {
                const part = this.parts[k];
                if (part.kind !== 'data') {
                    break;
                }
                group.push(part);
            }
            this.addResourceGroup(group, container);
            i += group.length - 1; // Skip the parts we just added
        }
        return container;
    }
    addResourceGroup(parts, container) {
        const el = dom.h('.chat-collapsible-io-resource-group', [
            dom.h('.chat-collapsible-io-resource-items@items'),
            dom.h('.chat-collapsible-io-resource-actions@actions'),
        ]);
        this.fillInResourceGroup(parts, el.items, el.actions).then(() => this._onDidChangeHeight.fire());
        container.appendChild(el.root);
        return el.root;
    }
    async fillInResourceGroup(parts, itemsContainer, actionsContainer) {
        const entries = await Promise.all(parts.map(async (part) => {
            if (part.mimeType && getAttachableImageExtension(part.mimeType)) {
                const value = part.value ?? await this._fileService.readFile(part.uri).then(f => f.value.buffer, () => undefined);
                return { kind: 'image', id: generateUuid(), name: basename(part.uri), value, mimeType: part.mimeType, isURL: false, references: [{ kind: 'reference', reference: part.uri }] };
            }
            else {
                return { kind: 'file', id: generateUuid(), name: basename(part.uri), fullName: part.uri.path, value: part.uri };
            }
        }));
        const attachments = this._register(this._instantiationService.createInstance(ChatAttachmentsContentPart, {
            variables: entries,
            limit: 5,
            contentReferences: undefined,
            domNode: undefined
        }));
        attachments.contextMenuHandler = (attachment, event) => {
            const index = entries.indexOf(attachment);
            const part = parts[index];
            if (part) {
                event.preventDefault();
                event.stopPropagation();
                this._contextMenuService.showContextMenu({
                    menuId: MenuId.ChatToolOutputResourceContext,
                    menuActionOptions: { shouldForwardArgs: true },
                    getAnchor: () => ({ x: event.pageX, y: event.pageY }),
                    getActionsContext: () => ({ parts: [part] }),
                });
            }
        };
        itemsContainer.appendChild(attachments.domNode);
        const toolbar = this._register(this._instantiationService.createInstance(MenuWorkbenchToolBar, actionsContainer, MenuId.ChatToolOutputResourceToolbar, {
            menuOptions: {
                shouldForwardArgs: true,
            },
        }));
        toolbar.context = { parts };
    }
    addCodeBlock(part, container) {
        const data = {
            languageId: part.languageId,
            textModel: Promise.resolve(part.textModel),
            codeBlockIndex: part.codeBlockInfo.codeBlockIndex,
            codeBlockPartIndex: 0,
            element: this.context.element,
            parentContextKeyService: this.contextKeyService,
            renderOptions: part.options,
            chatSessionResource: this.context.element.sessionResource,
        };
        const editorReference = this._register(this.context.editorPool.get());
        editorReference.object.render(data, this._currentWidth || 300);
        this._register(editorReference.object.onDidChangeContentHeight(() => this._onDidChangeHeight.fire()));
        container.appendChild(editorReference.object.element);
        this._editorReferences.push(editorReference);
        this.codeblocks.push(part.codeBlockInfo);
    }
    layout(width) {
        this._currentWidth = width;
        this._editorReferences.forEach(r => r.object.layout(width));
    }
};
ChatToolOutputContentSubPart = __decorate([
    __param(2, IContextKeyService),
    __param(3, IInstantiationService),
    __param(4, IContextMenuService),
    __param(5, IFileService)
], ChatToolOutputContentSubPart);
export { ChatToolOutputContentSubPart };
class SaveResourcesAction extends Action2 {
    static { this.ID = 'chat.toolOutput.save'; }
    constructor() {
        super({
            id: SaveResourcesAction.ID,
            title: localize2('chat.saveResources', "Save As..."),
            icon: Codicon.cloudDownload,
            menu: [{
                    id: MenuId.ChatToolOutputResourceToolbar,
                    group: 'navigation',
                    order: 1
                }, {
                    id: MenuId.ChatToolOutputResourceContext,
                }]
        });
    }
    async run(accessor, context) {
        const fileDialog = accessor.get(IFileDialogService);
        const fileService = accessor.get(IFileService);
        const notificationService = accessor.get(INotificationService);
        const progressService = accessor.get(IProgressService);
        const workspaceContextService = accessor.get(IWorkspaceContextService);
        const commandService = accessor.get(ICommandService);
        const labelService = accessor.get(ILabelService);
        const defaultFilepath = await fileDialog.defaultFilePath();
        const savePart = async (part, isFolder, uri) => {
            const target = isFolder ? joinPath(uri, basename(part.uri)) : uri;
            try {
                if (part.kind === 'data') {
                    await fileService.copy(part.uri, target, true);
                }
                else {
                    // MCP doesn't support streaming data, so no sense trying
                    const contents = await fileService.readFile(part.uri);
                    await fileService.writeFile(target, contents.value);
                }
            }
            catch (e) {
                notificationService.error(localize('chat.saveResources.error', "Failed to save {0}: {1}", basename(part.uri), e));
            }
        };
        const withProgress = async (thenReveal, todo) => {
            await progressService.withProgress({
                location: 15 /* ProgressLocation.Notification */,
                delay: 5_000,
                title: localize('chat.saveResources.progress', "Saving resources..."),
            }, async (report) => {
                for (const task of todo) {
                    await task();
                    report.report({ increment: 1, total: todo.length });
                }
            });
            if (workspaceContextService.isInsideWorkspace(thenReveal)) {
                commandService.executeCommand(REVEAL_IN_EXPLORER_COMMAND_ID, thenReveal);
            }
            else {
                notificationService.info(localize('chat.saveResources.reveal', "Saved resources to {0}", labelService.getUriLabel(thenReveal)));
            }
        };
        if (context.parts.length === 1) {
            const part = context.parts[0];
            const uri = await fileDialog.pickFileToSave(joinPath(defaultFilepath, basename(part.uri)));
            if (!uri) {
                return;
            }
            await withProgress(uri, [() => savePart(part, false, uri)]);
        }
        else {
            const uris = await fileDialog.showOpenDialog({
                title: localize('chat.saveResources.title', "Pick folder to save resources"),
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                defaultUri: workspaceContextService.getWorkspace().folders[0]?.uri,
            });
            if (!uris?.length) {
                return;
            }
            await withProgress(uris[0], context.parts.map(part => () => savePart(part, true, uris[0])));
        }
    }
}
registerAction2(SaveResourcesAction);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvb2xPdXRwdXRDb250ZW50U3ViUGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy9jaGF0VG9vbE91dHB1dENvbnRlbnRTdWJQYXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckUsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUU3RSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDbEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNyRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDdEYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDN0YsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDakcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDdkYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzdFLE9BQU8s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