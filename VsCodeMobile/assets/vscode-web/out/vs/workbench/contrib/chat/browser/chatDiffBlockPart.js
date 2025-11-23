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
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter } from '../../../../base/common/event.js';
import { hashAsync } from '../../../../base/common/hash.js';
import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { EditorModel } from '../../../common/editor/editorModel.js';
/**
 * Parses unified diff format into before/after content.
 * Supports standard unified diff format with - and + prefixes.
 */
export function parseUnifiedDiff(diffText) {
    const lines = diffText.split('\n');
    const beforeLines = [];
    const afterLines = [];
    for (const line of lines) {
        if (line.startsWith('- ')) {
            beforeLines.push(line.substring(2));
        }
        else if (line.startsWith('-')) {
            beforeLines.push(line.substring(1));
        }
        else if (line.startsWith('+ ')) {
            afterLines.push(line.substring(2));
        }
        else if (line.startsWith('+')) {
            afterLines.push(line.substring(1));
        }
        else if (line.startsWith(' ')) {
            // Context line - appears in both
            const content = line.substring(1);
            beforeLines.push(content);
            afterLines.push(content);
        }
        else if (!line.startsWith('@@') && !line.startsWith('---') && !line.startsWith('+++') && !line.startsWith('diff ')) {
            // Regular line without prefix - treat as context
            beforeLines.push(line);
            afterLines.push(line);
        }
    }
    return {
        before: beforeLines.join('\n'),
        after: afterLines.join('\n')
    };
}
/**
 * Simple diff editor model for inline diffs in markdown code blocks
 */
class SimpleDiffEditorModel extends EditorModel {
    constructor(_original, _modified) {
        super();
        this._original = _original;
        this._modified = _modified;
        this.original = this._original.object.textEditorModel;
        this.modified = this._modified.object.textEditorModel;
    }
    dispose() {
        super.dispose();
        this._original.dispose();
        this._modified.dispose();
    }
}
/**
 * Renders a diff block from markdown content.
 * This is a lightweight wrapper that uses CodeCompareBlockPart for the actual rendering.
 */
let MarkdownDiffBlockPart = class MarkdownDiffBlockPart extends Disposable {
    constructor(data, diffEditorPool, currentWidth, modelService, textModelService, languageService) {
        super();
        this.modelService = modelService;
        this.textModelService = textModelService;
        this.languageService = languageService;
        this._onDidChangeContentHeight = this._register(new Emitter());
        this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
        this.modelRef = this._register(new MutableDisposable());
        this.comparePart = this._register(diffEditorPool.get());
        this._register(this.comparePart.object.onDidChangeContentHeight(() => {
            this._onDidChangeContentHeight.fire();
        }));
        // Create in-memory models for the diff
        const originalUri = URI.from({
            scheme: Schemas.vscodeChatCodeBlock,
            path: `/chat-diff-original-${data.codeBlockIndex}-${generateUuid()}`,
        });
        const modifiedUri = URI.from({
            scheme: Schemas.vscodeChatCodeBlock,
            path: `/chat-diff-modified-${data.codeBlockIndex}-${generateUuid()}`,
        });
        const languageSelection = this.languageService.createById(data.languageId);
        // Create the models
        this._register(this.modelService.createModel(data.beforeContent, languageSelection, originalUri, false));
        this._register(this.modelService.createModel(data.afterContent, languageSelection, modifiedUri, false));
        const modelsPromise = Promise.all([
            this.textModelService.createModelReference(originalUri),
            this.textModelService.createModelReference(modifiedUri)
        ]).then(([originalRef, modifiedRef]) => {
            return new SimpleDiffEditorModel(originalRef, modifiedRef);
        });
        const compareData = {
            element: data.element,
            isReadOnly: data.isReadOnly,
            horizontalPadding: data.horizontalPadding,
            edit: {
                uri: data.codeBlockResource || modifiedUri,
                edits: [],
                kind: 'textEditGroup',
                done: true
            },
            diffData: modelsPromise.then(async (model) => {
                this.modelRef.value = model;
                const diffData = {
                    original: model.original,
                    modified: model.modified,
                    originalSha1: await hashAsync(model.original.getValue()),
                };
                return diffData;
            })
        };
        this.comparePart.object.render(compareData, currentWidth, CancellationToken.None);
        this.element = this.comparePart.object.element;
    }
    layout(width) {
        this.comparePart.object.layout(width);
    }
    reset() {
        this.modelRef.clear();
    }
};
MarkdownDiffBlockPart = __decorate([
    __param(3, IModelService),
    __param(4, ITextModelService),
    __param(5, ILanguageService)
], MarkdownDiffBlockPart);
export { MarkdownDiffBlockPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdERpZmZCbG9ja1BhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXREaWZmQmxvY2tQYXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDNUQsT0FBTyxFQUFFLFVBQVUsRUFBYyxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBRW5GLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM1RSxPQUFPLEVBQTRCLGlCQUFpQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDcEgsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBTXBFOzs7R0FHRztBQUNILE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxRQUFnQjtJQUNoRCxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ25DLE1BQU0sV0FBVyxHQUFhLEVBQUUsQ0FBQztJQUNqQyxNQUFNLFVBQVUsR0FBYSxFQUFFLENBQUM7SUFFaEMsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FB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