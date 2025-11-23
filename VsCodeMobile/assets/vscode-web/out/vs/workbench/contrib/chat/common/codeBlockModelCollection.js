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
import { encodeBase64, VSBuffer } from '../../../../base/common/buffer.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { Range } from '../../../../editor/common/core/range.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { PLAINTEXT_LANGUAGE_ID } from '../../../../editor/common/languages/modesRegistry.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { extractCodeblockUrisFromText, extractVulnerabilitiesFromText } from './annotations.js';
import { isResponseVM } from './chatViewModel.js';
let CodeBlockModelCollection = class CodeBlockModelCollection extends Disposable {
    constructor(tag, languageService, textModelService) {
        super();
        this.tag = tag;
        this.languageService = languageService;
        this.textModelService = textModelService;
        this._models = new Map();
        /**
         * Max number of models to keep in memory.
         *
         * Currently always maintains the most recently created models.
         */
        this.maxModelCount = 100;
        this._register(this.languageService.onDidChange(async () => {
            for (const entry of this._models.values()) {
                if (!entry.inLanguageId) {
                    continue;
                }
                const model = (await entry.model).object;
                const existingLanguageId = model.getLanguageId();
                if (!existingLanguageId || existingLanguageId === PLAINTEXT_LANGUAGE_ID) {
                    this.trySetTextModelLanguage(entry.inLanguageId, model.textEditorModel);
                }
            }
        }));
    }
    dispose() {
        super.dispose();
        this.clear();
    }
    get(sessionResource, chat, codeBlockIndex) {
        const entry = this._models.get(this.getKey(sessionResource, chat, codeBlockIndex));
        if (!entry) {
            return;
        }
        return {
            model: entry.model.then(ref => ref.object.textEditorModel),
            vulns: entry.vulns,
            codemapperUri: entry.codemapperUri,
            isEdit: entry.isEdit,
        };
    }
    getOrCreate(sessionResource, chat, codeBlockIndex) {
        const existing = this.get(sessionResource, chat, codeBlockIndex);
        if (existing) {
            return existing;
        }
        const uri = this.getCodeBlockUri(sessionResource, chat, codeBlockIndex);
        const model = this.textModelService.createModelReference(uri);
        this._models.set(this.getKey(sessionResource, chat, codeBlockIndex), {
            model: model,
            vulns: [],
            inLanguageId: undefined,
            codemapperUri: undefined,
        });
        while (this._models.size > this.maxModelCount) {
            const first = Iterable.first(this._models.keys());
            if (!first) {
                break;
            }
            this.delete(first);
        }
        return { model: model.then(x => x.object.textEditorModel), vulns: [], codemapperUri: undefined };
    }
    delete(key) {
        const entry = this._models.get(key);
        if (!entry) {
            return;
        }
        entry.model.then(ref => ref.dispose());
        this._models.delete(key);
    }
    clear() {
        this._models.forEach(async (entry) => await entry.model.then(ref => ref.dispose()));
        this._models.clear();
    }
    updateSync(sessionResource, chat, codeBlockIndex, content) {
        const entry = this.getOrCreate(sessionResource, chat, codeBlockIndex);
        this.updateInternalCodeBlockEntry(content, sessionResource, chat, codeBlockIndex);
        return this.get(sessionResource, chat, codeBlockIndex) ?? entry;
    }
    markCodeBlockCompleted(sessionResource, chat, codeBlockIndex) {
        const entry = this._models.get(this.getKey(sessionResource, chat, codeBlockIndex));
        if (!entry) {
            return;
        }
        // TODO: fill this in once we've implemented https://github.com/microsoft/vscode/issues/232538
    }
    async update(sessionResource, chat, codeBlockIndex, content) {
        const entry = this.getOrCreate(sessionResource, chat, codeBlockIndex);
        const newText = this.updateInternalCodeBlockEntry(content, sessionResource, chat, codeBlockIndex);
        const textModel = await entry.model;
        if (!textModel || textModel.isDisposed()) {
            // Somehow we get an undefined textModel sometimes - #237782
            return entry;
        }
        if (content.languageId) {
            this.trySetTextModelLanguage(content.languageId, textModel);
        }
        const currentText = textModel.getValue(1 /* EndOfLinePreference.LF */);
        if (newText === currentText) {
            return entry;
        }
        if (newText.startsWith(currentText)) {
            const text = newText.slice(currentText.length);
            const lastLine = textModel.getLineCount();
            const lastCol = textModel.getLineMaxColumn(lastLine);
            textModel.applyEdits([{ range: new Range(lastLine, lastCol, lastLine, lastCol), text }]);
        }
        else {
            // console.log(`Failed to optimize setText`);
            textModel.setValue(newText);
        }
        return entry;
    }
    updateInternalCodeBlockEntry(content, sessionResource, chat, codeBlockIndex) {
        const entry = this._models.get(this.getKey(sessionResource, chat, codeBlockIndex));
        if (entry) {
            entry.inLanguageId = content.languageId;
        }
        const extractedVulns = extractVulnerabilitiesFromText(content.text);
        let newText = fixCodeText(extractedVulns.newText, content.languageId);
        if (entry) {
            entry.vulns = extractedVulns.vulnerabilities;
        }
        const codeblockUri = extractCodeblockUrisFromText(newText);
        if (codeblockUri) {
            if (entry) {
                entry.codemapperUri = codeblockUri.uri;
                entry.isEdit = codeblockUri.isEdit;
            }
            newText = codeblockUri.textWithoutResult;
        }
        if (content.isComplete) {
            this.markCodeBlockCompleted(sessionResource, chat, codeBlockIndex);
        }
        return newText;
    }
    trySetTextModelLanguage(inLanguageId, textModel) {
        const vscodeLanguageId = this.languageService.getLanguageIdByLanguageName(inLanguageId);
        if (vscodeLanguageId && vscodeLanguageId !== textModel.getLanguageId()) {
            textModel.setLanguage(vscodeLanguageId);
        }
    }
    getKey(sessionResource, chat, index) {
        return `${sessionResource.toString()}/${chat.id}/${index}`;
    }
    getCodeBlockUri(sessionResource, chat, index) {
        const metadata = this.getUriMetaData(chat);
        const indexPart = this.tag ? `${this.tag}-${index}` : `${index}`;
        const encodedSessionId = encodeBase64(VSBuffer.wrap(new TextEncoder().encode(sessionResource.toString())), false, true);
        return URI.from({
            scheme: Schemas.vscodeChatCodeBlock,
            authority: encodedSessionId,
            path: `/${chat.id}/${indexPart}`,
            fragment: metadata ? JSON.stringify(metadata) : undefined,
        });
    }
    getUriMetaData(chat) {
        if (!isResponseVM(chat)) {
            return undefined;
        }
        return {
            references: chat.contentReferences.map(ref => {
                if (typeof ref.reference === 'string') {
                    return;
                }
                const uriOrLocation = 'variableName' in ref.reference ?
                    ref.reference.value :
                    ref.reference;
                if (!uriOrLocation) {
                    return;
                }
                if (URI.isUri(uriOrLocation)) {
                    return {
                        uri: uriOrLocation.toJSON()
                    };
                }
                return {
                    uri: uriOrLocation.uri.toJSON(),
                    range: uriOrLocation.range,
                };
            })
        };
    }
};
CodeBlockModelCollection = __decorate([
    __param(1, ILanguageService),
    __param(2, ITextModelService)
], CodeBlockModelCollection);
export { CodeBlockModelCollection };
function fixCodeText(text, languageId) {
    if (languageId === 'php') {
        // <?php or short tag version <?
        if (!text.trim().startsWith('<?')) {
            return `<?php\n${text}`;
        }
    }
    return text;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL2NvZGVCbG9ja01vZGVsQ29sbGVjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsWUFBWSxFQUFFLFFBQVEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFjLE1BQU0sc0NBQXNDLENBQUM7QUFDOUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDaEUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDbkYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFN0YsT0FBTyxFQUE0QixpQkFBaUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3BILE9BQU8sRUFBRSw0QkFBNEIsRUFBRSw4QkFBOEIsRUFBMEIsTUFBTSxrQkFBa0IsQ0FBQztBQUN4SCxPQUFPLEVBQWlELFlBQVksRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBZ0IxRixJQUFNLHdCQUF3QixHQUE5QixNQUFNLHdCQUF5QixTQUFRLFVBQVU7SUFpQnZELFlBQ2tCLEdBQXVCLEVBQ3RCLGVBQWtELEVBQ2pELGdCQUFvRDtRQUV2RSxLQUFLLEVBQUUsQ0FBQztRQUpTLFFBQUcsR0FBSCxHQUFHLENBQW9CO1FBQ0wsb0JBQWUsR0FBZixlQUFlLENBQWtCO1FBQ2hDLHFCQUFn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