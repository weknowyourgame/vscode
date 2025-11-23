/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { mapLspKindToTerminalKind, TerminalCompletionItemKind } from './terminalCompletionItem.js';
import { Position } from '../../../../../editor/common/core/position.js';
export class LspCompletionProviderAddon extends Disposable {
    constructor(provider, textVirtualModel, lspTerminalModelContentProvider) {
        super();
        this.id = 'lsp';
        this.isBuiltin = true;
        this._provider = provider;
        this._textVirtualModel = textVirtualModel;
        this._lspTerminalModelContentProvider = lspTerminalModelContentProvider;
        this.triggerCharacters = provider.triggerCharacters ? [...provider.triggerCharacters, ' ', '('] : [' ', '('];
    }
    activate(terminal) {
        // console.log('activate');
    }
    async provideCompletions(value, cursorPosition, token) {
        // Apply edit for non-executed current commandline --> Pretend we are typing in the real-document.
        this._lspTerminalModelContentProvider.trackPromptInputToVirtualFile(value);
        const textBeforeCursor = value.substring(0, cursorPosition);
        const lines = textBeforeCursor.split('\n');
        const column = lines[lines.length - 1].length + 1;
        // Get line from virtualDocument, not from terminal
        const lineNum = this._textVirtualModel.object.textEditorModel.getLineCount();
        const positionVirtualDocument = new Position(lineNum, column);
        const completions = [];
        if (this._provider && this._provider._debugDisplayName !== 'wordbasedCompletions') {
            const result = await this._provider.provideCompletionItems(this._textVirtualModel.object.textEditorModel, positionVirtualDocument, { triggerKind: 1 /* CompletionTriggerKind.TriggerCharacter */ }, token);
            for (const item of (result?.suggestions || [])) {
                // TODO: Support more terminalCompletionItemKind for [different LSP providers](https://github.com/microsoft/vscode/issues/249479)
                const convertedKind = item.kind ? mapLspKindToTerminalKind(item.kind) : TerminalCompletionItemKind.Method;
                const completionItemTemp = createCompletionItemPython(cursorPosition, textBeforeCursor, convertedKind, 'lspCompletionItem', undefined);
                const terminalCompletion = {
                    label: item.label,
                    provider: `lsp:${item.extensionId?.value}`,
                    detail: item.detail,
                    documentation: item.documentation,
                    kind: convertedKind,
                    replacementRange: completionItemTemp.replacementRange,
                };
                // Store unresolved item and provider for lazy resolution if needed
                if (this._provider.resolveCompletionItem && (!item.detail || !item.documentation)) {
                    terminalCompletion._unresolvedItem = item;
                    terminalCompletion._resolveProvider = this._provider;
                }
                completions.push(terminalCompletion);
            }
        }
        return completions;
    }
}
export function createCompletionItemPython(cursorPosition, prefix, kind, label, detail) {
    const lastWord = getLastWord(prefix);
    return {
        label,
        detail: detail ?? '',
        replacementRange: [cursorPosition - lastWord.length, cursorPosition],
        kind: kind ?? TerminalCompletionItemKind.Method
    };
}
function getLastWord(prefix) {
    if (prefix.endsWith(' ')) {
        return '';
    }
    if (prefix.endsWith('.')) {
        return '';
    }
    const lastSpaceIndex = prefix.lastIndexOf(' ');
    const lastDotIndex = prefix.lastIndexOf('.');
    const lastParenIndex = prefix.lastIndexOf('(');
    // Get the maximum index (most recent delimiter)
    const lastDelimiterIndex = Math.max(lastSpaceIndex, lastDotIndex, lastParenIndex);
    // If no delimiter found, return the entire prefix
    if (lastDelimiterIndex === -1) {
        return prefix;
    }
    // Return the substring after the last delimiter
    return prefix.substring(lastDelimiterIndex + 1);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibHNwQ29tcGxldGlvblByb3ZpZGVyQWRkb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL3N1Z2dlc3QvYnJvd3Nlci9sc3BDb21wbGV0aW9uUHJvdmlkZXJBZGRvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsVUFBVSxFQUFjLE1BQU0seUNBQXlDLENBQUM7QUFHakYsT0FBTyxFQUF1Qix3QkFBd0IsRUFBRSwwQkFBMEIsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBRXhILE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUt6RSxNQUFNLE9BQU8sMEJBQTJCLFNBQVEsVUFBVTtJQVF6RCxZQUNDLFFBQWdDLEVBQ2hDLGdCQUFzRCxFQUN0RCwrQkFBZ0U7UUFFaEUsS0FBSyxFQUFFLENBQUM7UUFaQSxPQUFFLEdBQUcsS0FBSyxDQUFDO1FBQ1gsY0FBUyxHQUFHLElBQUksQ0FBQztRQVl6QixJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQztRQUMxQixJQUFJLENBQUMsaUJBQWlCLEdBQUcsZ0JBQWdCLENBQUM7UUFDMUMsSUFBSSxDQUFDLGdDQUFnQyxHQUFHLCtCQUErQixDQUFDO1FBQ3hFLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxRQUFRLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsaUJBQWlCLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUM5RyxDQUFDO0lBRUQsUUFBUSxDQUFDLFFBQWtCO1FBQzFCLDJCQUEyQjtJQUM1QixDQUFDO0lBRUQsS0FBSyxDQUFDLGtCQUFrQixDQUFDLEtBQWEsRUFBRSxjQUFzQixFQUFF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