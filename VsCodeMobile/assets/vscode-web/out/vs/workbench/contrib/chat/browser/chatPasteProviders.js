var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CopyAttachmentsProvider_1;
import { Codicon } from '../../../../base/common/codicons.js';
import { createStringDataTransferItem, VSDataTransfer } from '../../../../base/common/dataTransfer.js';
import { HierarchicalKind } from '../../../../base/common/hierarchicalKind.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { revive } from '../../../../base/common/marshalling.js';
import { Mimes } from '../../../../base/common/mime.js';
import { Schemas } from '../../../../base/common/network.js';
import { basename, joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { localize } from '../../../../nls.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IExtensionService, isProposedApiEnabled } from '../../../services/extensions/common/extensions.js';
import { IChatVariablesService } from '../common/chatVariables.js';
import { IChatWidgetService } from './chat.js';
import { ChatDynamicVariableModel } from './contrib/chatDynamicVariables.js';
import { cleanupOldImages, createFileForMedia, resizeImage } from './imageUtils.js';
const COPY_MIME_TYPES = 'application/vnd.code.additional-editor-data';
let PasteImageProvider = class PasteImageProvider {
    constructor(chatWidgetService, extensionService, fileService, environmentService, logService) {
        this.chatWidgetService = chatWidgetService;
        this.extensionService = extensionService;
        this.fileService = fileService;
        this.environmentService = environmentService;
        this.logService = logService;
        this.kind = new HierarchicalKind('chat.attach.image');
        this.providedPasteEditKinds = [this.kind];
        this.copyMimeTypes = [];
        this.pasteMimeTypes = ['image/*'];
        this.imagesFolder = joinPath(this.environmentService.workspaceStorageHome, 'vscode-chat-images');
        cleanupOldImages(this.fileService, this.logService, this.imagesFolder);
    }
    async provideDocumentPasteEdits(model, ranges, dataTransfer, context, token) {
        if (!this.extensionService.extensions.some(ext => isProposedApiEnabled(ext, 'chatReferenceBinaryData'))) {
            return;
        }
        const supportedMimeTypes = [
            'image/png',
            'image/jpeg',
            'image/jpg',
            'image/bmp',
            'image/gif',
            'image/tiff'
        ];
        let mimeType;
        let imageItem;
        // Find the first matching image type in the dataTransfer
        for (const type of supportedMimeTypes) {
            imageItem = dataTransfer.get(type);
            if (imageItem) {
                mimeType = type;
                break;
            }
        }
        if (!imageItem || !mimeType) {
            return;
        }
        const currClipboard = await imageItem.asFile()?.data();
        if (token.isCancellationRequested || !currClipboard) {
            return;
        }
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget) {
            return;
        }
        const attachedVariables = widget.attachmentModel.attachments;
        const displayName = localize('pastedImageName', 'Pasted Image');
        let tempDisplayName = displayName;
        for (let appendValue = 2; attachedVariables.some(attachment => attachment.name === tempDisplayName); appendValue++) {
            tempDisplayName = `${displayName} ${appendValue}`;
        }
        const fileReference = await createFileForMedia(this.fileService, this.imagesFolder, currClipboard, mimeType);
        if (token.isCancellationRequested || !fileReference) {
            return;
        }
        const scaledImageData = await resizeImage(currClipboard);
        if (token.isCancellationRequested || !scaledImageData) {
            return;
        }
        const scaledImageContext = await getImageAttachContext(scaledImageData, mimeType, token, tempDisplayName, fileReference);
        if (token.isCancellationRequested || !scaledImageContext) {
            return;
        }
        // Make sure to attach only new contexts
        const currentContextIds = widget.attachmentModel.getAttachmentIDs();
        if (currentContextIds.has(scaledImageContext.id)) {
            return;
        }
        const edit = createCustomPasteEdit(model, [scaledImageContext], mimeType, this.kind, localize('pastedImageAttachment', 'Pasted Image Attachment'), this.chatWidgetService);
        return createEditSession(edit);
    }
};
PasteImageProvider = __decorate([
    __param(2, IFileService),
    __param(3, IEnvironmentService),
    __param(4, ILogService)
], PasteImageProvider);
export { PasteImageProvider };
async function getImageAttachContext(data, mimeType, token, displayName, resource) {
    const imageHash = await imageToHash(data);
    if (token.isCancellationRequested) {
        return undefined;
    }
    return {
        kind: 'image',
        value: data,
        id: imageHash,
        name: displayName,
        icon: Codicon.fileMedia,
        mimeType,
        isPasted: true,
        references: [{ reference: resource, kind: 'reference' }]
    };
}
export async function imageToHash(data) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
export function isImage(array) {
    if (array.length < 4) {
        return false;
    }
    // Magic numbers (identification bytes) for various image formats
    const identifier = {
        png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
        jpeg: [0xFF, 0xD8, 0xFF],
        bmp: [0x42, 0x4D],
        gif: [0x47, 0x49, 0x46, 0x38],
        tiff: [0x49, 0x49, 0x2A, 0x00]
    };
    return Object.values(identifier).some((signature) => signature.every((byte, index) => array[index] === byte));
}
export class CopyTextProvider {
    constructor() {
        this.providedPasteEditKinds = [];
        this.copyMimeTypes = [COPY_MIME_TYPES];
        this.pasteMimeTypes = [];
    }
    async prepareDocumentPaste(model, ranges, dataTransfer, token) {
        if (model.uri.scheme === Schemas.vscodeChatInput) {
            return;
        }
        const customDataTransfer = new VSDataTransfer();
        const data = { range: ranges[0], uri: model.uri.toJSON() };
        customDataTransfer.append(COPY_MIME_TYPES, createStringDataTransferItem(JSON.stringify(data)));
        return customDataTransfer;
    }
}
let CopyAttachmentsProvider = class CopyAttachmentsProvider {
    static { CopyAttachmentsProvider_1 = this; }
    static { this.ATTACHMENT_MIME_TYPE = 'application/vnd.chat.attachment+json'; }
    constructor(chatWidgetService, chatVariableService) {
        this.chatWidgetService = chatWidgetService;
        this.chatVariableService = chatVariableService;
        this.kind = new HierarchicalKind('chat.attach.attachments');
        this.providedPasteEditKinds = [this.kind];
        this.copyMimeTypes = [CopyAttachmentsProvider_1.ATTACHMENT_MIME_TYPE];
        this.pasteMimeTypes = [CopyAttachmentsProvider_1.ATTACHMENT_MIME_TYPE];
    }
    async prepareDocumentPaste(model, _ranges, _dataTransfer, _token) {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget || !widget.viewModel) {
            return undefined;
        }
        const attachments = widget.attachmentModel.attachments;
        const dynamicVariables = this.chatVariableService.getDynamicVariables(widget.viewModel.sessionResource);
        if (attachments.length === 0 && dynamicVariables.length === 0) {
            return undefined;
        }
        const result = new VSDataTransfer();
        result.append(CopyAttachmentsProvider_1.ATTACHMENT_MIME_TYPE, createStringDataTransferItem(JSON.stringify({ attachments, dynamicVariables })));
        return result;
    }
    async provideDocumentPasteEdits(model, _ranges, dataTransfer, _context, token) {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget || !widget.viewModel) {
            return undefined;
        }
        const chatDynamicVariable = widget.getContrib(ChatDynamicVariableModel.ID);
        if (!chatDynamicVariable) {
            return undefined;
        }
        const text = dataTransfer.get(Mimes.text);
        const data = dataTransfer.get(CopyAttachmentsProvider_1.ATTACHMENT_MIME_TYPE);
        const rawData = await data?.asString();
        const textdata = await text?.asString();
        if (textdata === undefined || rawData === undefined) {
            return;
        }
        if (token.isCancellationRequested) {
            return;
        }
        let pastedData;
        try {
            pastedData = revive(JSON.parse(rawData));
        }
        catch {
            //
        }
        if (!Array.isArray(pastedData?.attachments) && !Array.isArray(pastedData?.dynamicVariables)) {
            return;
        }
        const edit = {
            insertText: textdata,
            title: localize('pastedChatAttachments', 'Insert Prompt & Attachments'),
            kind: this.kind,
            handledMimeType: CopyAttachmentsProvider_1.ATTACHMENT_MIME_TYPE,
            additionalEdit: {
                edits: []
            }
        };
        edit.additionalEdit?.edits.push({
            resource: model.uri,
            redo: () => {
                widget.attachmentModel.addContext(...pastedData.attachments);
                for (const dynamicVariable of pastedData.dynamicVariables) {
                    chatDynamicVariable?.addReference(dynamicVariable);
                }
                widget.refreshParsedInput();
            },
            undo: () => {
                widget.attachmentModel.delete(...pastedData.attachments.map(c => c.id));
                widget.refreshParsedInput();
            }
        });
        return createEditSession(edit);
    }
};
CopyAttachmentsProvider = CopyAttachmentsProvider_1 = __decorate([
    __param(0, IChatWidgetService),
    __param(1, IChatVariablesService)
], CopyAttachmentsProvider);
export class PasteTextProvider {
    constructor(chatWidgetService, modelService) {
        this.chatWidgetService = chatWidgetService;
        this.modelService = modelService;
        this.kind = new HierarchicalKind('chat.attach.text');
        this.providedPasteEditKinds = [this.kind];
        this.copyMimeTypes = [];
        this.pasteMimeTypes = [COPY_MIME_TYPES];
    }
    async provideDocumentPasteEdits(model, ranges, dataTransfer, _context, token) {
        if (model.uri.scheme !== Schemas.vscodeChatInput) {
            return;
        }
        const text = dataTransfer.get(Mimes.text);
        const editorData = dataTransfer.get('vscode-editor-data');
        const additionalEditorData = dataTransfer.get(COPY_MIME_TYPES);
        if (!editorData || !text || !additionalEditorData) {
            return;
        }
        const textdata = await text.asString();
        const metadata = JSON.parse(await editorData.asString());
        const additionalData = JSON.parse(await additionalEditorData.asString());
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget) {
            return;
        }
        const start = additionalData.range.startLineNumber;
        const end = additionalData.range.endLineNumber;
        if (start === end) {
            const textModel = this.modelService.getModel(URI.revive(additionalData.uri));
            if (!textModel) {
                return;
            }
            // If copied line text data is the entire line content, then we can paste it as a code attachment. Otherwise, we ignore and use default paste provider.
            const lineContent = textModel.getLineContent(start);
            if (lineContent !== textdata) {
                return;
            }
        }
        const copiedContext = getCopiedContext(textdata, URI.revive(additionalData.uri), metadata.mode, additionalData.range);
        if (token.isCancellationRequested || !copiedContext) {
            return;
        }
        const currentContextIds = widget.attachmentModel.getAttachmentIDs();
        if (currentContextIds.has(copiedContext.id)) {
            return;
        }
        const edit = createCustomPasteEdit(model, [copiedContext], Mimes.text, this.kind, localize('pastedCodeAttachment', 'Pasted Code Attachment'), this.chatWidgetService);
        edit.yieldTo = [{ kind: HierarchicalKind.Empty.append('text', 'plain') }];
        return createEditSession(edit);
    }
}
function getCopiedContext(code, file, language, range) {
    const fileName = basename(file);
    const start = range.startLineNumber;
    const end = range.endLineNumber;
    const resultText = `Copied Selection of Code: \n\n\n From the file: ${fileName} From lines ${start} to ${end} \n \`\`\`${code}\`\`\``;
    const pastedLines = start === end ? localize('pastedAttachment.oneLine', '1 line') : localize('pastedAttachment.multipleLines', '{0} lines', end + 1 - start);
    return {
        kind: 'paste',
        value: resultText,
        id: `${fileName}${start}${end}${range.startColumn}${range.endColumn}`,
        name: `${fileName} ${pastedLines}`,
        icon: Codicon.code,
        pastedLines,
        language,
        fileName: file.toString(),
        copiedFrom: {
            uri: file,
            range
        },
        code,
        references: [{
                reference: file,
                kind: 'reference'
            }]
    };
}
function createCustomPasteEdit(model, context, handledMimeType, kind, title, chatWidgetService) {
    const label = context.length === 1
        ? context[0].name
        : localize('pastedAttachment.multiple', '{0} and {1} more', context[0].name, context.length - 1);
    const customEdit = {
        resource: model.uri,
        variable: context,
        undo: () => {
            const widget = chatWidgetService.getWidgetByInputUri(model.uri);
            if (!widget) {
                throw new Error('No widget found for undo');
            }
            widget.attachmentModel.delete(...context.map(c => c.id));
        },
        redo: () => {
            const widget = chatWidgetService.getWidgetByInputUri(model.uri);
            if (!widget) {
                throw new Error('No widget found for redo');
            }
            widget.attachmentModel.addContext(...context);
        },
        metadata: {
            needsConfirmation: false,
            label
        }
    };
    return {
        insertText: '',
        title,
        kind,
        handledMimeType,
        additionalEdit: {
            edits: [customEdit],
        }
    };
}
function createEditSession(edit) {
    return {
        edits: [edit],
        dispose: () => { },
    };
}
let ChatPasteProvidersFeature = class ChatPasteProvidersFeature extends Disposable {
    constructor(instaService, languageFeaturesService, chatWidgetService, extensionService, fileService, modelService, environmentService, logService) {
        super();
        this._register(languageFeaturesService.documentPasteEditProvider.register({ scheme: Schemas.vscodeChatInput, pattern: '*', hasAccessToAllModels: true }, instaService.createInstance(CopyAttachmentsProvider)));
        this._register(languageFeaturesService.documentPasteEditProvider.register({ scheme: Schemas.vscodeChatInput, pattern: '*', hasAccessToAllModels: true }, new PasteImageProvider(chatWidgetService, extensionService, fileService, environmentService, logService)));
        this._register(languageFeaturesService.documentPasteEditProvider.register({ scheme: Schemas.vscodeChatInput, pattern: '*', hasAccessToAllModels: true }, new PasteTextProvider(chatWidgetService, modelService)));
        this._register(languageFeaturesService.documentPasteEditProvider.register('*', new CopyTextProvider()));
        this._register(languageFeaturesService.documentPasteEditProvider.register('*', new CopyTextProvider()));
    }
};
ChatPasteProvidersFeature = __decorate([
    __param(0, IInstantiationService),
    __param(1, ILanguageFeaturesService),
    __param(2, IChatWidgetService),
    __param(3, IExtensionService),
    __param(4, IFileService),
    __param(5, IModelService),
    __param(6, IEnvironmentService),
    __param(7, ILogService)
], ChatPasteProvidersFeature);
export { ChatPasteProvidersFeature };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFBhc3RlUHJvdmlkZXJzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0UGFzdGVQcm92aWRlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUtBLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsNEJBQTRCLEVBQThDLGNBQWMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ25KLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDaEUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxHQUFHLEVBQWlCLE1BQU0sZ0NBQWdDLENBQUM7QUFJcEUsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDbEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUM3RixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDMUUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFN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