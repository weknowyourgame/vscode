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
import { Codicon } from '../../../../base/common/codicons.js';
import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { SymbolKinds } from '../../../../editor/common/languages.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../nls.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { isUntitledResourceEditorInput } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IExtensionService, isProposedApiEnabled } from '../../../services/extensions/common/extensions.js';
import { UntitledTextEditorInput } from '../../../services/untitled/common/untitledTextEditorInput.js';
import { createNotebookOutputVariableEntry, NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST } from '../../notebook/browser/contrib/chat/notebookChatUtils.js';
import { getOutputViewModelFromId } from '../../notebook/browser/controller/cellOutputActions.js';
import { getNotebookEditorFromEditorPane } from '../../notebook/browser/notebookBrowser.js';
import { CHAT_ATTACHABLE_IMAGE_MIME_TYPES, getAttachableImageExtension } from '../common/chatModel.js';
import { IDiagnosticVariableEntryFilterData, toPromptFileVariableEntry, PromptFileVariableKind } from '../common/chatVariableEntries.js';
import { getPromptsTypeForLanguageId, PromptsType } from '../common/promptSyntax/promptTypes.js';
import { imageToHash } from './chatPasteProviders.js';
import { resizeImage } from './imageUtils.js';
export const IChatAttachmentResolveService = createDecorator('IChatAttachmentResolveService');
let ChatAttachmentResolveService = class ChatAttachmentResolveService {
    constructor(fileService, editorService, textModelService, extensionService, dialogService) {
        this.fileService = fileService;
        this.editorService = editorService;
        this.textModelService = textModelService;
        this.extensionService = extensionService;
        this.dialogService = dialogService;
    }
    // --- EDITORS ---
    async resolveEditorAttachContext(editor) {
        // untitled editor
        if (isUntitledResourceEditorInput(editor)) {
            return await this.resolveUntitledEditorAttachContext(editor);
        }
        if (!editor.resource) {
            return undefined;
        }
        let stat;
        try {
            stat = await this.fileService.stat(editor.resource);
        }
        catch {
            return undefined;
        }
        if (!stat.isDirectory && !stat.isFile) {
            return undefined;
        }
        const imageContext = await this.resolveImageEditorAttachContext(editor.resource);
        if (imageContext) {
            return this.extensionService.extensions.some(ext => isProposedApiEnabled(ext, 'chatReferenceBinaryData')) ? imageContext : undefined;
        }
        return await this.resolveResourceAttachContext(editor.resource, stat.isDirectory);
    }
    async resolveUntitledEditorAttachContext(editor) {
        // If the resource is known, we can use it directly
        if (editor.resource) {
            return await this.resolveResourceAttachContext(editor.resource, false);
        }
        // Otherwise, we need to check if the contents are already open in another editor
        const openUntitledEditors = this.editorService.editors.filter(editor => editor instanceof UntitledTextEditorInput);
        for (const canidate of openUntitledEditors) {
            const model = await canidate.resolve();
            const contents = model.textEditorModel?.getValue();
            if (contents === editor.contents) {
                return await this.resolveResourceAttachContext(canidate.resource, false);
            }
        }
        return undefined;
    }
    async resolveResourceAttachContext(resource, isDirectory) {
        let omittedState = 0 /* OmittedState.NotOmitted */;
        if (!isDirectory) {
            let languageId;
            try {
                const createdModel = await this.textModelService.createModelReference(resource);
                languageId = createdModel.object.getLanguageId();
                createdModel.dispose();
            }
            catch {
                omittedState = 2 /* OmittedState.Full */;
            }
            if (/\.(svg)$/i.test(resource.path)) {
                omittedState = 2 /* OmittedState.Full */;
            }
            if (languageId) {
                const promptsType = getPromptsTypeForLanguageId(languageId);
                if (promptsType === PromptsType.prompt) {
                    return toPromptFileVariableEntry(resource, PromptFileVariableKind.PromptFile);
                }
                else if (promptsType === PromptsType.instructions) {
                    return toPromptFileVariableEntry(resource, PromptFileVariableKind.Instruction);
                }
            }
        }
        return {
            kind: isDirectory ? 'directory' : 'file',
            value: resource,
            id: resource.toString(),
            name: basename(resource),
            omittedState
        };
    }
    // --- IMAGES ---
    async resolveImageEditorAttachContext(resource, data, mimeType) {
        if (!resource) {
            return undefined;
        }
        if (mimeType) {
            if (!getAttachableImageExtension(mimeType)) {
                return undefined;
            }
        }
        else {
            const match = SUPPORTED_IMAGE_EXTENSIONS_REGEX.exec(resource.path);
            if (!match) {
                return undefined;
            }
            mimeType = getMimeTypeFromPath(match);
        }
        const fileName = basename(resource);
        let dataBuffer;
        if (data) {
            dataBuffer = data;
        }
        else {
            let stat;
            try {
                stat = await this.fileService.stat(resource);
            }
            catch {
                return undefined;
            }
            const readFile = await this.fileService.readFile(resource);
            if (stat.size > 30 * 1024 * 1024) { // 30 MB
                this.dialogService.error(localize('imageTooLarge', 'Image is too large'), localize('imageTooLargeMessage', 'The image {0} is too large to be attached.', fileName));
                throw new Error('Image is too large');
            }
            dataBuffer = readFile.value;
        }
        const isPartiallyOmitted = /\.gif$/i.test(resource.path);
        const imageFileContext = await this.resolveImageAttachContext([{
                id: resource.toString(),
                name: fileName,
                data: dataBuffer.buffer,
                icon: Codicon.fileMedia,
                resource: resource,
                mimeType: mimeType,
                omittedState: isPartiallyOmitted ? 1 /* OmittedState.Partial */ : 0 /* OmittedState.NotOmitted */
            }]);
        return imageFileContext[0];
    }
    resolveImageAttachContext(images) {
        return Promise.all(images.map(async (image) => ({
            id: image.id || await imageToHash(image.data),
            name: image.name,
            fullName: image.resource ? image.resource.path : undefined,
            value: await resizeImage(image.data, image.mimeType),
            icon: image.icon,
            kind: 'image',
            isFile: false,
            isDirectory: false,
            omittedState: image.omittedState || 0 /* OmittedState.NotOmitted */,
            references: image.resource ? [{ reference: image.resource, kind: 'reference' }] : []
        })));
    }
    // --- MARKERS ---
    resolveMarkerAttachContext(markers) {
        return markers.map((marker) => {
            let filter;
            if (!('severity' in marker)) {
                filter = { filterUri: URI.revive(marker.uri), filterSeverity: MarkerSeverity.Warning };
            }
            else {
                filter = IDiagnosticVariableEntryFilterData.fromMarker(marker);
            }
            return IDiagnosticVariableEntryFilterData.toEntry(filter);
        });
    }
    // --- SYMBOLS ---
    resolveSymbolsAttachContext(symbols) {
        return symbols.map(symbol => {
            const resource = URI.file(symbol.fsPath);
            return {
                kind: 'symbol',
                id: symbolId(resource, symbol.range),
                value: { uri: resource, range: symbol.range },
                symbolKind: symbol.kind,
                icon: SymbolKinds.toIcon(symbol.kind),
                fullName: symbol.name,
                name: symbol.name,
            };
        });
    }
    // --- NOTEBOOKS ---
    resolveNotebookOutputAttachContext(data) {
        const notebookEditor = getNotebookEditorFromEditorPane(this.editorService.activeEditorPane);
        if (!notebookEditor) {
            return [];
        }
        const outputViewModel = getOutputViewModelFromId(data.outputId, notebookEditor);
        if (!outputViewModel) {
            return [];
        }
        const mimeType = outputViewModel.pickedMimeType?.mimeType;
        if (mimeType && NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST.includes(mimeType)) {
            const entry = createNotebookOutputVariableEntry(outputViewModel, mimeType, notebookEditor);
            if (!entry) {
                return [];
            }
            return [entry];
        }
        return [];
    }
    // --- SOURCE CONTROL ---
    resolveSourceControlHistoryItemAttachContext(data) {
        return data.map(d => ({
            id: d.historyItem.id,
            name: d.name,
            value: URI.revive(d.resource),
            historyItem: {
                ...d.historyItem,
                references: []
            },
            kind: 'scmHistoryItem'
        }));
    }
};
ChatAttachmentResolveService = __decorate([
    __param(0, IFileService),
    __param(1, IEditorService),
    __param(2, ITextModelService),
    __param(3, IExtensionService),
    __param(4, IDialogService)
], ChatAttachmentResolveService);
export { ChatAttachmentResolveService };
function symbolId(resource, range) {
    let rangePart = '';
    if (range) {
        rangePart = `:${range.startLineNumber}`;
        if (range.startLineNumber !== range.endLineNumber) {
            rangePart += `-${range.endLineNumber}`;
        }
    }
    return resource.fsPath + rangePart;
}
const SUPPORTED_IMAGE_EXTENSIONS_REGEX = new RegExp(`\\.(${Object.keys(CHAT_ATTACHABLE_IMAGE_MIME_TYPES).join('|')})$`, 'i');
function getMimeTypeFromPath(match) {
    const ext = match[1].toLowerCase();
    return CHAT_ATTACHABLE_IMAGE_MIME_TYPES[ext];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEF0dGFjaG1lbnRSZXNvbHZlU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEF0dGFjaG1lbnRSZXNvbHZlU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRWhFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUVyRCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDckUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDMUYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUVoRixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDMUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNoRixPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUUxRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDbEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLG9CQUFvQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDNUcsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sOERBQThELENBQUM7QUFDdkcsT0FBTyxFQUFFLGlDQUFpQyxFQUFFLGtEQUFrRCxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDakssT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDbEcsT0FBTyxFQUFFLCtCQUErQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFFNUYsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDdkcsT0FBTyxFQUFxRSxrQ0FBa0MsRUFBd0IseUJBQXlCLEVBQUUsc0JBQXNCLEVBQWdDLE1BQU0sa0NBQWtDLENBQUM7QUFDaFEsT0FBTyxFQUFFLDJCQUEyQixFQUFFLFdBQVcsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFOUMsTUFBTSxDQUFDLE1BQU0sNkJBQTZCLEdBQUcsZUFBZSxDQUFnQywrQkFBK0IsQ0FBQyxDQUFDO0FBaUJ0SCxJQUFNLDRCQUE0QixHQUFsQyxNQUFNLDRCQUE0QjtJQUd4QyxZQUN1QixXQUF5QixFQUN2QixhQUE2QixFQUMxQixnQkFBbUMsRUFDbkMsZ0JBQW1DLEVBQ3RDLGFBQTZCO1FBSi9CLGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBQ3ZCLGtCQUFhLEdBQWIsYUFBYSxDQUFnQjtRQUMxQixxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQW1CO1FBQ25DLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBbUI7UUFDdEMsa0JBQWEsR0FBYixhQUFhLENBQWdCO0lBQ2xELENBQUM7SUFFTCxrQkFBa0I7SUFFWCxLQUFLLENBQUMsMEJBQTBCLENBQUMsTUFBaUQ7UUFDeEYsa0JBQWtCO1FBQ2xCLElBQUksNkJBQTZCLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUMzQyxPQUFPLE1BQU0sSUFBSSxDQUFDLGtDQUFrQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlELENBQUM7UUFFRCxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3RCLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQztRQUNULElBQUksQ0FBQztZQUNKLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNyRCxDQUFDO1FBQUMsTUFBTSxDQUFDO1lBQ1IsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3ZDLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxNQUFNLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDakYsSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUNsQixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsR0FBRyxFQUFFLHlCQUF5QixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDdEksQ0FBQztRQUVELE9BQU8sTUFBTSxJQUFJLENBQUMsNEJBQTRCLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDbkYsQ0FBQztJQUVNLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxNQUFtQztRQUNsRixtREFBbUQ7UUFDbkQsSUFBSSxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDckIsT0FBTyxNQUFNLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3hFLENBQUM7UUFFRCxpRkFBaUY7UUFDakYsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLFlBQVksdUJBQXVCLENBQThCLENBQUM7UUFDaEosS0FBSyxNQUFNLFFBQVEsSUFBSSxtQkFBbUIsRUFBRSxDQUFDO1lBQzVDLE1BQU0sS0FBSyxHQUFHLE1BQU0sUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3ZDLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLENBQUM7WUFDbkQsSUFBSSxRQUFRLEtBQUssTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNsQyxPQUFPLE1BQU0sSUFBSSxDQUFDLDRCQUE0QixDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDMUUsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRU0sS0FBSyxDQUFDLDRCQUE0QixDQUFDLFFBQWEsRUFBRSxXQUFvQjtRQUM1RSxJQUFJLFlBQVksa0NBQTBCLENBQUM7UUFFM0MsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBRWxCLElBQUksVUFBOEIsQ0FBQztZQUNuQyxJQUFJLENBQUM7Z0JBQ0osTUFBTSxZQUFZLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsb0JBQW9CLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ2hGLFVBQVUsR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDLGFBQWEsRUFBRSxDQUFDO2dCQUNqRCxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDeEIsQ0FBQztZQUFDLE1BQU0sQ0FBQztnQkFDUixZQUFZLDRCQUFvQixDQUFDO1lBQ2xDLENBQUM7WUFFRCxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ3JDLFlBQVksNEJBQW9CLENBQUM7WUFDbEMsQ0FBQztZQUNELElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQ2hCLE1BQU0sV0FBVyxHQUFHLDJCQUEyQixDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUM1RCxJQUFJLFdBQVcsS0FBSyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQ3hDLE9BQU8seUJBQXlCLENBQUMsUUFBUSxFQUFFLHNCQUFzQixDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUMvRSxDQUFDO3FCQUFNLElBQUksV0FBVyxLQUFLLFdBQVcsQ0FBQyxZQUFZLEVBQUUsQ0FBQztvQkFDckQsT0FBTyx5QkFBeUIsQ0FBQyxRQUFRLEVBQUUsc0JBQXNCLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQ2hGLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUVELE9BQU87WUFDTixJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE1BQU07WUFDeEMsS0FBSyxFQUFFLFFBQVE7WUFDZixFQUFFLEVBQUUsUUFBUSxDQUFDLFFBQVEsRUFBRTtZQUN2QixJQUFJLEVBQUUsUUFBUSxDQUFDLFFBQVEsQ0FBQztZQUN4QixZQUFZO1NBQ1osQ0FBQztJQUNILENBQUM7SUFFRCxpQkFBaUI7SUFFVixLQUFLLENBQUMsK0JBQStCLENBQUMsUUFBYSxFQUFFLElBQWUsRUFBRSxRQUFpQjtRQUM3RixJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDZixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNkLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO2dCQUM1QyxPQUFPLFNBQVMsQ0FBQztZQUNsQixDQUFDO1FBQ0YsQ0FBQzthQUFNLENBQUM7WUFDUCxNQUFNLEtBQUssR0FBRyxnQ0FBZ0MsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ25FLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDWixPQUFPLFNBQVMsQ0FBQztZQUNsQixDQUFDO1lBRUQsUUFBUSxHQUFHLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3ZDLENBQUM7UUFDRCxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFcEMsSUFBSSxVQUFnQyxDQUFDO1FBQ3JDLElBQUksSUFBSSxFQUFFLENBQUM7WUFDVixVQUFVLEdBQUcsSUFBSSxDQUFDO1FBQ25CLENBQUM7YUFBTSxDQUFDO1lBRVAsSUFBSSxJQUFJLENBQUM7WUFDVCxJQUFJLENBQUM7Z0JBQ0osSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDOUMsQ0FBQztZQUFDLE1BQU0sQ0FBQztnQkFDUixPQUFPLFNBQVMsQ0FBQztZQUNsQixDQUFDO1lBRUQsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUUzRCxJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUcsRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLFFBQVE7Z0JBQzNDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxlQUFlLEVBQUUsb0JBQW9CLENBQUMsRUFBRSxRQUFRLENBQUMsc0JBQXNCLEVBQUUsNENBQTRDLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDcEssTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZDLENBQUM7WUFFRCxVQUFVLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQztRQUM3QixDQUFDO1FBRUQsTUFBTSxrQkFBa0IsR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN6RCxNQUFNLGdCQUFnQixHQUFHLE1BQU0sSUFBSSxDQUFDLHlCQUF5QixDQUFDLENBQUM7Z0JBQzlELEVBQUUsRUFBRSxRQUFRLENBQUMsUUFBUSxFQUFFO2dCQUN2QixJQUFJLEVBQUUsUUFBUTtnQkFDZCxJQUFJLEVBQUUsVUFBVSxDQUFDLE1BQU07Z0JBQ3ZCLElBQUksRUFBRSxPQUFPLENBQUMsU0FBUztnQkFDdkIsUUFBUSxFQUFFLFFBQVE7Z0JBQ2xCLFFBQVEsRUFBRSxRQUFRO2dCQUNsQixZQUFZLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyw4QkFBc0IsQ0FBQyxnQ0FBd0I7YUFDakYsQ0FBQyxDQUFDLENBQUM7UUFFSixPQUFPLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFFTSx5QkFBeUIsQ0FBQyxNQUEyQjtRQUMzRCxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUMsS0FBSyxFQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLEVBQUUsRUFBRSxLQUFLLENBQUMsRUFBRSxJQUFJLE1BQU0sV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDN0MsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJO1lBQ2hCLFFBQVEsRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUztZQUMxRCxLQUFLLEVBQUUsTUFBTSxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDO1lBQ3BELElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTtZQUNoQixJQUFJLEVBQUUsT0FBTztZQUNiLE1BQU0sRUFBRSxLQUFLO1lBQ2IsV0FBVyxFQUFFLEtBQUs7WUFDbEIsWUFBWSxFQUFFLEtBQUssQ0FBQyxZQUFZLG1DQUEyQjtZQUMzRCxVQUFVLEVBQUUsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLFNBQVMsRUFBRSxLQUFLLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO1NBQ3BGLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTixDQUFDO0lBRUQsa0JBQWtCO0lBRVgsMEJBQTBCLENBQUMsT0FBNkI7UUFDOUQsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxFQUE0QixFQUFFO1lBQ3ZELElBQUksTUFBMEMsQ0FBQztZQUMvQyxJQUFJLENBQUMsQ0FBQyxVQUFVLElBQUksTUFBTSxDQUFDLEVBQUUsQ0FBQztnQkFDN0IsTUFBTSxHQUFHLEVBQUUsU0FBUyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLGNBQWMsRUFBRSxjQUFjLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDeEYsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sR0FBRyxrQ0FBa0MsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDaEUsQ0FBQztZQUVELE9BQU8sa0NBQWtDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzNELENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELGtCQUFrQjtJQUVYLDJCQUEyQixDQUFDLE9BQXFDO1FBQ3ZFLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUMzQixNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN6QyxPQUFPO2dCQUNOLElBQUksRUFBRSxRQUFRO2dCQUNkLEVBQUUsRUFBRSxRQUFRLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUM7Z0JBQ3BDLEtBQUssRUFBRSxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLLEVBQUU7Z0JBQzdDLFVBQVUsRUFBRSxNQUFNLENBQUMsSUFBSTtnQkFDdkIsSUFBSSxFQUFFLFdBQVcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFDckMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxJQUFJO2dCQUNyQixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7YUFDakIsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELG9CQUFvQjtJQUViLGtDQUFrQyxDQUFDLElBQW9DO1FBQzdFLE1BQU0sY0FBYyxHQUFHLCtCQUErQixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUM1RixJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDckIsT0FBTyxFQUFFLENBQUM7UUFDWCxDQUFDO1FBRUQsTUFBTSxlQUFlLEdBQUcsd0JBQXdCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUNoRixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDdEIsT0FBTyxFQUFFLENBQUM7UUFDWCxDQUFDO1FBRUQsTUFBTSxRQUFRLEdBQUcsZUFBZSxDQUFDLGNBQWMsRUFBRSxRQUFRLENBQUM7UUFDMUQsSUFBSSxRQUFRLElBQUksa0RBQWtELENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFFdkYsTUFBTSxLQUFLLEdBQUcsaUNBQWlDLENBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxjQUFjLENBQUMsQ0FBQztZQUMzRixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ1osT0FBTyxFQUFFLENBQUM7WUFDWCxDQUFDO1lBRUQsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2hCLENBQUM7UUFFRCxPQUFPLEVBQUUsQ0FBQztJQUNYLENBQUM7SUFFRCx5QkFBeUI7SUFFbEIsNENBQTRDLENBQUMsSUFBa0M7UUFDckYsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNyQixFQUFFLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQ3BCLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSTtZQUNaLEtBQUssRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7WUFDN0IsV0FBVyxFQUFFO2dCQUNaLEdBQUcsQ0FBQyxDQUFDLFdBQVc7Z0JBQ2hCLFVBQVUsRUFBRSxFQUFFO2FBQ2Q7WUFDRCxJQUFJLEVBQUUsZ0JBQWdCO1NBQ2tCLENBQUEsQ0FBQyxDQUFDO0lBQzVDLENBQUM7Q0FDRCxDQUFBO0FBbFBZLDRCQUE0QjtJQUl0QyxXQUFBLFlBQVksQ0FBQTtJQUNaLFdBQUEsY0FBYyxDQUFBO0lBQ2QsV0FBQSxpQkFBaUIsQ0FBQTtJQUNqQixXQUFBLGlCQUFpQixDQUFBO0lBQ2pCLFdBQUEsY0FBYyxDQUFBO0dBUkosNEJBQTRCLENBa1B4Qzs7QUFFRCxTQUFTLFFBQVEsQ0FBQyxRQUFhLEVBQUUsS0FBYztJQUM5QyxJQUFJLFNBQVMsR0FBRyxFQUFFLENBQUM7SUFDbkIsSUFBSSxLQUFLLEVBQUUsQ0FBQztRQUNYLFNBQVMsR0FBRyxJQUFJLEtBQUssQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUN4QyxJQUFJLEtBQUssQ0FBQyxlQUFlLEtBQUssS0FBSyxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ25ELFNBQVMsSUFBSSxJQUFJLEtBQUssQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUN4QyxDQUFDO0lBQ0YsQ0FBQztJQUNELE9BQU8sUUFBUSxDQUFDLE1BQU0sR0FBRyxTQUFTLENBQUM7QUFDcEMsQ0FBQztBQVdELE1BQU0sZ0NBQWdDLEdBQUcsSUFBSSxNQUFNLENBQUMsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLGdDQUFnQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFFN0gsU0FBUyxtQkFBbUIsQ0FBQyxLQUFzQjtJQUNsRCxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDbkMsT0FBTyxnQ0FBZ0MsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM5QyxDQUFDIn0=