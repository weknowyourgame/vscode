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
import { getPromptsTypeForLanguageId } from '../promptTypes.js';
import { IPromptsService } from '../service/promptsService.js';
import { isGithubTarget } from './promptValidator.js';
let PromptDocumentSemanticTokensProvider = class PromptDocumentSemanticTokensProvider {
    constructor(promptsService) {
        this.promptsService = promptsService;
        /**
         * Debug display name for this provider.
         */
        this._debugDisplayName = 'PromptDocumentSemanticTokensProvider';
    }
    provideDocumentSemanticTokens(model, lastResultId, token) {
        const promptType = getPromptsTypeForLanguageId(model.getLanguageId());
        if (!promptType) {
            // if the model is not a prompt, we don't provide any semantic tokens
            return undefined;
        }
        const promptAST = this.promptsService.getParsedPromptFile(model);
        if (!promptAST.body) {
            return undefined;
        }
        if (isGithubTarget(promptType, promptAST.header?.target)) {
            // In GitHub Copilot mode, we don't provide variable semantic tokens to tool references
            return undefined;
        }
        const variableReferences = promptAST.body.variableReferences;
        if (!variableReferences.length) {
            return undefined;
        }
        // Prepare semantic tokens data following the delta-encoded, 5-number tuple format:
        // [deltaLine, deltaStart, length, tokenType, tokenModifiers]
        // We expose a single token type 'variable' (index 0) and no modifiers (bitset 0).
        const data = [];
        let lastLine = 0;
        let lastChar = 0;
        // Ensure stable order (parser already produces them in order, but sort defensively)
        const ordered = [...variableReferences].sort((a, b) => a.range.startLineNumber === b.range.startLineNumber
            ? a.range.startColumn - b.range.startColumn
            : a.range.startLineNumber - b.range.startLineNumber);
        for (const ref of ordered) {
            // Also include the '#tool:' prefix for syntax highlighting purposes, even if it's not originally part of the variable name itself.
            const extraCharCount = '#tool:'.length;
            const line = ref.range.startLineNumber - 1; // zero-based
            const char = ref.range.startColumn - extraCharCount - 1; // zero-based
            const length = ref.range.endColumn - ref.range.startColumn + extraCharCount;
            const deltaLine = line - lastLine;
            const deltaChar = deltaLine === 0 ? char - lastChar : char;
            data.push(deltaLine, deltaChar, length, 0 /* variable token type index */, 0 /* no modifiers */);
            lastLine = line;
            lastChar = char;
            if (token.isCancellationRequested) {
                break; // Return what we have so far if cancelled.
            }
        }
        return { data: new Uint32Array(data) };
    }
    getLegend() {
        return { tokenTypes: ['variable'], tokenModifiers: [] };
    }
    releaseDocumentSemanticTokens(resultId) {
        // No caching/result management needed for the simple, stateless implementation.
    }
};
PromptDocumentSemanticTokensProvider = __decorate([
    __param(0, IPromptsService)
], PromptDocumentSemanticTokensProvider);
export { PromptDocumentSemanticTokensProvider };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0RG9jdW1lbnRTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Byb21wdFN5bnRheC9sYW5ndWFnZVByb3ZpZGVycy9wcm9tcHREb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFLaEcsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDaEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQy9ELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUUvQyxJQUFNLG9DQUFvQyxHQUExQyxNQUFNLG9DQUFvQztJQU1oRCxZQUNrQixjQUFnRDtRQUEvQixtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7UUFObEU7O1dBRUc7UUFDYSxzQkFBaUIsR0FBVyxzQ0FBc0MsQ0FBQztJQUtuRixDQUFDO0lBRUQsNkJBQTZCLENBQUMsS0FBaUIsRUFBRSxZQUEyQixFQUFFLEtBQXdCO1FBQ3JHLE1BQU0sVUFBVSxHQUFHLDJCQUEyQixDQUFDLEtBQUssQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDO1FBQ3RFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNqQixxRUFBcUU7WUFDckUsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDakUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNyQixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsSUFBSSxjQUFjLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FB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