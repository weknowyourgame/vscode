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
import { dirname, extUri } from '../../../../../../base/common/resources.js';
import { getPromptsTypeForLanguageId, PromptsType } from '../promptTypes.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { Range } from '../../../../../../editor/common/core/range.js';
import { getWordAtText } from '../../../../../../editor/common/core/wordHelper.js';
import { chatVariableLeader } from '../../chatParserTypes.js';
import { ILanguageModelToolsService } from '../../languageModelToolsService.js';
/**
 * Provides autocompletion for the variables inside prompt bodies.
 * - #file: paths to files and folders in the workspace
 * - # tool names
 */
let PromptBodyAutocompletion = class PromptBodyAutocompletion {
    constructor(fileService, languageModelToolsService) {
        this.fileService = fileService;
        this.languageModelToolsService = languageModelToolsService;
        /**
         * Debug display name for this provider.
         */
        this._debugDisplayName = 'PromptBodyAutocompletion';
        /**
         * List of trigger characters handled by this provider.
         */
        this.triggerCharacters = [':', '.', '/', '\\'];
    }
    /**
     * The main function of this provider that calculates
     * completion items based on the provided arguments.
     */
    async provideCompletionItems(model, position, context, token) {
        const promptsType = getPromptsTypeForLanguageId(model.getLanguageId());
        if (!promptsType) {
            return undefined;
        }
        const reference = await this.findVariableReference(model, position, token);
        if (!reference) {
            return undefined;
        }
        const suggestions = [];
        switch (reference.type) {
            case 'file':
                if (reference.contentRange.containsPosition(position)) {
                    // inside the link range
                    await this.collectFilePathCompletions(model, position, reference.contentRange, suggestions);
                }
                else {
                    await this.collectDefaultCompletions(model, reference.range, promptsType, suggestions);
                }
                break;
            case 'tool':
                if (reference.contentRange.containsPosition(position)) {
                    if (promptsType === PromptsType.agent || promptsType === PromptsType.prompt) {
                        await this.collectToolCompletions(model, position, reference.contentRange, suggestions);
                    }
                }
                else {
                    await this.collectDefaultCompletions(model, reference.range, promptsType, suggestions);
                }
                break;
            default:
                await this.collectDefaultCompletions(model, reference.range, promptsType, suggestions);
        }
        return { suggestions };
    }
    async collectToolCompletions(model, position, toolRange, suggestions) {
        for (const toolName of this.languageModelToolsService.getQualifiedToolNames()) {
            suggestions.push({
                label: toolName,
                kind: 13 /* CompletionItemKind.Value */,
                filterText: toolName,
                insertText: toolName,
                range: toolRange,
            });
        }
    }
    async collectFilePathCompletions(model, position, pathRange, suggestions) {
        const pathUntilPosition = model.getValueInRange(pathRange.setEndPosition(position.lineNumber, position.column));
        const pathSeparator = pathUntilPosition.includes('/') || !pathUntilPosition.includes('\\') ? '/' : '\\';
        let parentFolderPath;
        if (pathUntilPosition.match(/[^\/]\.\.$/i)) { // ends with `..`
            parentFolderPath = pathUntilPosition + pathSeparator;
        }
        else {
            let i = pathUntilPosition.length - 1;
            while (i >= 0 && ![47 /* CharCode.Slash */, 92 /* CharCode.Backslash */].includes(pathUntilPosition.charCodeAt(i))) {
                i--;
            }
            parentFolderPath = pathUntilPosition.substring(0, i + 1); // the segment up to the `/` or `\` before the position
        }
        const retriggerCommand = { id: 'editor.action.triggerSuggest', title: 'Suggest' };
        try {
            const currentFolder = extUri.resolvePath(dirname(model.uri), parentFolderPath);
            const { children } = await this.fileService.resolve(currentFolder);
            if (children) {
                for (const child of children) {
                    const insertText = (parentFolderPath || ('.' + pathSeparator)) + child.name;
                    suggestions.push({
                        label: child.name + (child.isDirectory ? pathSeparator : ''),
                        kind: child.isDirectory ? 23 /* CompletionItemKind.Folder */ : 20 /* CompletionItemKind.File */,
                        range: pathRange,
                        insertText: insertText + (child.isDirectory ? pathSeparator : ''),
                        filterText: insertText,
                        command: child.isDirectory ? retriggerCommand : undefined
                    });
                }
            }
        }
        catch (e) {
            // ignore errors accessing the folder location
        }
        suggestions.push({
            label: '..',
            kind: 23 /* CompletionItemKind.Folder */,
            insertText: parentFolderPath + '..' + pathSeparator,
            range: pathRange,
            filterText: parentFolderPath + '..',
            command: retriggerCommand
        });
    }
    /**
     * Finds a file reference that suites the provided `position`.
     */
    async findVariableReference(model, position, token) {
        if (model.getLineContent(1).trimEnd() === '---') {
            let i = 2;
            while (i <= model.getLineCount() && model.getLineContent(i).trimEnd() !== '---') {
                i++;
            }
            if (i >= position.lineNumber) {
                // inside front matter
                return undefined;
            }
        }
        const reg = new RegExp(`${chatVariableLeader}[^\\s#]*`, 'g');
        const varWord = getWordAtText(position.column, reg, model.getLineContent(position.lineNumber), 0);
        if (!varWord) {
            return undefined;
        }
        const range = new Range(position.lineNumber, varWord.startColumn + 1, position.lineNumber, varWord.endColumn);
        const nameMatch = varWord.word.match(/^#(\w+:)?/);
        if (nameMatch) {
            const contentCol = varWord.startColumn + nameMatch[0].length;
            if (nameMatch[1] === 'file:') {
                return { type: 'file', contentRange: new Range(position.lineNumber, contentCol, position.lineNumber, varWord.endColumn), range };
            }
            else if (nameMatch[1] === 'tool:') {
                return { type: 'tool', contentRange: new Range(position.lineNumber, contentCol, position.lineNumber, varWord.endColumn), range };
            }
        }
        return { type: '', contentRange: range, range };
    }
    async collectDefaultCompletions(model, range, promptFileType, suggestions) {
        const labels = promptFileType === PromptsType.instructions ? ['file'] : ['file', 'tool'];
        labels.forEach(label => {
            suggestions.push({
                label: `${label}:`,
                kind: 17 /* CompletionItemKind.Keyword */,
                insertText: `${label}:`,
                range: range,
                command: { id: 'editor.action.triggerSuggest', title: 'Suggest' }
            });
        });
    }
};
PromptBodyAutocompletion = __decorate([
    __param(0, IFileService),
    __param(1, ILanguageModelToolsService)
], PromptBodyAutocompletion);
export { PromptBodyAutocompletion };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0Qm9keUF1dG9jb21wbGV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Byb21wdFN5bnRheC9sYW5ndWFnZVByb3ZpZGVycy9wcm9tcHRCb2R5QXV0b2NvbXBsZXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUU3RSxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFFN0UsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBR2hGLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUV0RSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDbkYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDOUQsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFFaEY7Ozs7R0FJRztBQUNJLElBQU0sd0JBQXdCLEdBQTlCLE1BQU0sd0JBQXdCO0lBV3BDLFlBQ2UsV0FBMEMsRUFDNUIseUJBQXNFO1FBRG5FLGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBQ1gsOEJBQXlCLEdBQXpCLHlCQUF5QixDQUE0QjtRQVpuRzs7V0FFRztRQUNhLHNCQUFpQixHQUFXLDBCQUEwQixDQUFDO1FBRXZFOztXQUVHO1FBQ2Esc0JBQWlCLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztJQU0xRCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0ksS0FBSyxDQUFDLHNCQUFzQixDQUFDLEtBQWlCLEVBQUUsUUFBa0Is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