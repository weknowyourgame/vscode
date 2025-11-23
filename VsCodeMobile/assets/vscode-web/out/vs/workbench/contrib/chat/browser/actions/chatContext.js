var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { isElectron } from '../../../../../base/common/platform.js';
import { dirname } from '../../../../../base/common/resources.js';
import { localize } from '../../../../../nls.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { EditorResourceAccessor, SideBySideEditor } from '../../../../common/editor.js';
import { DiffEditorInput } from '../../../../common/editor/diffEditorInput.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { UntitledTextEditorInput } from '../../../../services/untitled/common/untitledTextEditorInput.js';
import { FileEditorInput } from '../../../files/browser/editors/fileEditorInput.js';
import { NotebookEditorInput } from '../../../notebook/common/notebookEditorInput.js';
import { IChatContextPickService } from '../chatContextPickService.js';
import { IChatEditingService } from '../../common/chatEditingService.js';
import { toToolSetVariableEntry, toToolVariableEntry } from '../../common/chatVariableEntries.js';
import { ToolDataSource, ToolSet } from '../../common/languageModelToolsService.js';
import { imageToHash, isImage } from '../chatPasteProviders.js';
import { convertBufferToScreenshotVariable } from '../contrib/screenshot.js';
import { ChatInstructionsPickerPick } from '../promptSyntax/attachInstructionsAction.js';
import { ITerminalService } from '../../../terminal/browser/terminal.js';
let ChatContextContributions = class ChatContextContributions extends Disposable {
    static { this.ID = 'chat.contextContributions'; }
    constructor(instantiationService, contextPickService) {
        super();
        // ###############################################################################################
        //
        // Default context picks/values which are "native" to chat. This is NOT the complete list
        // and feature area specific context, like for notebooks, problems, etc, should be contributed
        // by the feature area.
        //
        // ###############################################################################################
        this._store.add(contextPickService.registerChatContextItem(instantiationService.createInstance(ToolsContextPickerPick)));
        this._store.add(contextPickService.registerChatContextItem(instantiationService.createInstance(ChatInstructionsPickerPick)));
        this._store.add(contextPickService.registerChatContextItem(instantiationService.createInstance(OpenEditorContextValuePick)));
        this._store.add(contextPickService.registerChatContextItem(instantiationService.createInstance(RelatedFilesContextPickerPick)));
        this._store.add(contextPickService.registerChatContextItem(instantiationService.createInstance(ClipboardImageContextValuePick)));
        this._store.add(contextPickService.registerChatContextItem(instantiationService.createInstance(ScreenshotContextValuePick)));
    }
};
ChatContextContributions = __decorate([
    __param(0, IInstantiationService),
    __param(1, IChatContextPickService)
], ChatContextContributions);
export { ChatContextContributions };
class ToolsContextPickerPick {
    constructor() {
        this.type = 'pickerPick';
        this.label = localize('chatContext.tools', 'Tools...');
        this.icon = Codicon.tools;
        this.ordinal = -500;
    }
    isEnabled(widget) {
        return !!widget.attachmentCapabilities.supportsToolAttachments;
    }
    asPicker(widget) {
        const items = [];
        for (const [entry, enabled] of widget.input.selectedToolsModel.entriesMap.get()) {
            if (enabled) {
                if (entry instanceof ToolSet) {
                    items.push({
                        toolInfo: ToolDataSource.classify(entry.source),
                        label: entry.referenceName,
                        description: entry.description,
                        asAttachment: () => toToolSetVariableEntry(entry)
                    });
                }
                else {
                    items.push({
                        toolInfo: ToolDataSource.classify(entry.source),
                        label: entry.toolReferenceName ?? entry.displayName,
                        description: entry.userDescription ?? entry.modelDescription,
                        asAttachment: () => toToolVariableEntry(entry)
                    });
                }
            }
        }
        items.sort((a, b) => {
            let res = a.toolInfo.ordinal - b.toolInfo.ordinal;
            if (res === 0) {
                res = a.toolInfo.label.localeCompare(b.toolInfo.label);
            }
            if (res === 0) {
                res = a.label.localeCompare(b.label);
            }
            return res;
        });
        let lastGroupLabel;
        const picks = [];
        for (const item of items) {
            if (lastGroupLabel !== item.toolInfo.label) {
                picks.push({ type: 'separator', label: item.toolInfo.label });
                lastGroupLabel = item.toolInfo.label;
            }
            picks.push(item);
        }
        return {
            placeholder: localize('chatContext.tools.placeholder', 'Select a tool'),
            picks: Promise.resolve(picks)
        };
    }
}
let OpenEditorContextValuePick = class OpenEditorContextValuePick {
    constructor(_editorService, _labelService) {
        this._editorService = _editorService;
        this._labelService = _labelService;
        this.type = 'valuePick';
        this.label = localize('chatContext.editors', 'Open Editors');
        this.icon = Codicon.file;
        this.ordinal = 800;
    }
    isEnabled() {
        return this._editorService.editors.filter(e => e instanceof FileEditorInput || e instanceof DiffEditorInput || e instanceof UntitledTextEditorInput).length > 0;
    }
    async asAttachment() {
        const result = [];
        for (const editor of this._editorService.editors) {
            if (!(editor instanceof FileEditorInput || editor instanceof DiffEditorInput || editor instanceof UntitledTextEditorInput || editor instanceof NotebookEditorInput)) {
                continue;
            }
            const uri = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
            if (!uri) {
                continue;
            }
            result.push({
                kind: 'file',
                id: uri.toString(),
                value: uri,
                name: this._labelService.getUriBasenameLabel(uri),
            });
        }
        return result;
    }
};
OpenEditorContextValuePick = __decorate([
    __param(0, IEditorService),
    __param(1, ILabelService)
], OpenEditorContextValuePick);
let RelatedFilesContextPickerPick = class RelatedFilesContextPickerPick {
    constructor(_chatEditingService, _labelService) {
        this._chatEditingService = _chatEditingService;
        this._labelService = _labelService;
        this.type = 'pickerPick';
        this.label = localize('chatContext.relatedFiles', 'Related Files');
        this.icon = Codicon.sparkle;
        this.ordinal = 300;
    }
    isEnabled(widget) {
        return this._chatEditingService.hasRelatedFilesProviders() && (Boolean(widget.getInput()) || widget.attachmentModel.fileAttachments.length > 0);
    }
    asPicker(widget) {
        const picks = (async () => {
            const chatSessionResource = widget.viewModel?.sessionResource;
            if (!chatSessionResource) {
                return [];
            }
            const relatedFiles = await this._chatEditingService.getRelatedFiles(chatSessionResource, widget.getInput(), widget.attachmentModel.fileAttachments, CancellationToken.None);
            if (!relatedFiles) {
                return [];
            }
            const attachments = widget.attachmentModel.getAttachmentIDs();
            return this._chatEditingService.getRelatedFiles(chatSessionResource, widget.getInput(), widget.attachmentModel.fileAttachments, CancellationToken.None)
                .then((files) => (files ?? []).reduce((acc, cur) => {
                acc.push({ type: 'separator', label: cur.group });
                for (const file of cur.files) {
                    const label = this._labelService.getUriBasenameLabel(file.uri);
                    acc.push({
                        label: label,
                        description: this._labelService.getUriLabel(dirname(file.uri), { relative: true }),
                        disabled: attachments.has(file.uri.toString()),
                        asAttachment: () => {
                            return {
                                kind: 'file',
                                id: file.uri.toString(),
                                value: file.uri,
                                name: label,
                                omittedState: 0 /* OmittedState.NotOmitted */
                            };
                        }
                    });
                }
                return acc;
            }, []));
        })();
        return {
            placeholder: localize('relatedFiles', 'Add related files to your working set'),
            picks,
        };
    }
};
RelatedFilesContextPickerPick = __decorate([
    __param(0, IChatEditingService),
    __param(1, ILabelService)
], RelatedFilesContextPickerPick);
let ClipboardImageContextValuePick = class ClipboardImageContextValuePick {
    constructor(_clipboardService) {
        this._clipboardService = _clipboardService;
        this.type = 'valuePick';
        this.label = localize('imageFromClipboard', 'Image from Clipboard');
        this.icon = Codicon.fileMedia;
    }
    async isEnabled(widget) {
        if (!widget.attachmentCapabilities.supportsImageAttachments) {
            return false;
        }
        if (!widget.input.selectedLanguageModel?.metadata.capabilities?.vision) {
            return false;
        }
        const imageData = await this._clipboardService.readImage();
        return isImage(imageData);
    }
    async asAttachment() {
        const fileBuffer = await this._clipboardService.readImage();
        return {
            id: await imageToHash(fileBuffer),
            name: localize('pastedImage', 'Pasted Image'),
            fullName: localize('pastedImage', 'Pasted Image'),
            value: fileBuffer,
            kind: 'image',
        };
    }
};
ClipboardImageContextValuePick = __decorate([
    __param(0, IClipboardService)
], ClipboardImageContextValuePick);
let TerminalContext = class TerminalContext {
    constructor(_resource, _terminalService) {
        this._resource = _resource;
        this._terminalService = _terminalService;
        this.type = 'valuePick';
        this.icon = Codicon.terminal;
        this.label = localize('terminal', 'Terminal');
    }
    isEnabled(widget) {
        const terminal = this._terminalService.getInstanceFromResource(this._resource);
        return !!widget.attachmentCapabilities.supportsTerminalAttachments && terminal?.isDisposed === false;
    }
    async asAttachment(widget) {
        const terminal = this._terminalService.getInstanceFromResource(this._resource);
        if (!terminal) {
            return;
        }
        const params = new URLSearchParams(this._resource.query);
        const command = terminal.capabilities.get(2 /* TerminalCapability.CommandDetection */)?.commands.find(cmd => cmd.id === params.get('command'));
        if (!command) {
            return;
        }
        const attachment = {
            kind: 'terminalCommand',
            id: `terminalCommand:${Date.now()}}`,
            value: this.asValue(command),
            name: command.command,
            command: command.command,
            output: command.getOutput(),
            exitCode: command.exitCode,
            resource: this._resource
        };
        const cleanup = new DisposableStore();
        let disposed = false;
        const disposeCleanup = () => {
            if (disposed) {
                return;
            }
            disposed = true;
            cleanup.dispose();
        };
        cleanup.add(widget.attachmentModel.onDidChange(e => {
            if (e.deleted.includes(attachment.id)) {
                disposeCleanup();
            }
        }));
        cleanup.add(terminal.onDisposed(() => {
            widget.attachmentModel.delete(attachment.id);
            widget.refreshParsedInput();
            disposeCleanup();
        }));
        return attachment;
    }
    asValue(command) {
        let value = `Command: ${command.command}`;
        const output = command.getOutput();
        if (output) {
            value += `\nOutput:\n${output}`;
        }
        if (typeof command.exitCode === 'number') {
            value += `\nExit Code: ${command.exitCode}`;
        }
        return value;
    }
};
TerminalContext = __decorate([
    __param(1, ITerminalService)
], TerminalContext);
export { TerminalContext };
let ScreenshotContextValuePick = class ScreenshotContextValuePick {
    constructor(_hostService) {
        this._hostService = _hostService;
        this.type = 'valuePick';
        this.icon = Codicon.deviceCamera;
        this.label = (isElectron
            ? localize('chatContext.attachScreenshot.labelElectron.Window', 'Screenshot Window')
            : localize('chatContext.attachScreenshot.labelWeb', 'Screenshot'));
    }
    async isEnabled(widget) {
        return !!widget.attachmentCapabilities.supportsImageAttachments && !!widget.input.selectedLanguageModel?.metadata.capabilities?.vision;
    }
    async asAttachment() {
        const blob = await this._hostService.getScreenshot();
        return blob && convertBufferToScreenshotVariable(blob);
    }
};
ScreenshotContextValuePick = __decorate([
    __param(0, IHostService)
], ScreenshotContextValuePick);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdENvbnRleHQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2FjdGlvbnMvY2hhdENvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUE7OztnR0FHZ0c7QUFDaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDL0UsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDdEYsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUVsRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sOERBQThELENBQUM7QUFDakcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBRzlFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3hGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUMvRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDckYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLGlFQUFpRSxDQUFDO0FBQzFHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNwRixPQUFPLEVBQUUsbUJBQW1C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