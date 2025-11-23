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
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { EditOperation } from '../../../../../editor/common/core/editOperation.js';
import { ILanguageModelToolsService } from '../../common/languageModelToolsService.js';
import { PromptHeaderAttributes } from '../../common/promptSyntax/promptFileParser.js';
import { IPromptsService } from '../../common/promptSyntax/service/promptsService.js';
let PromptFileRewriter = class PromptFileRewriter {
    constructor(_codeEditorService, _promptsService, _languageModelToolsService) {
        this._codeEditorService = _codeEditorService;
        this._promptsService = _promptsService;
        this._languageModelToolsService = _languageModelToolsService;
    }
    async openAndRewriteTools(uri, newTools, token) {
        const editor = await this._codeEditorService.openCodeEditor({ resource: uri }, this._codeEditorService.getFocusedCodeEditor());
        if (!editor || !editor.hasModel()) {
            return;
        }
        const model = editor.getModel();
        const promptAST = this._promptsService.getParsedPromptFile(model);
        if (!promptAST.header) {
            return undefined;
        }
        const toolsAttr = promptAST.header.getAttribute(PromptHeaderAttributes.tools);
        if (!toolsAttr) {
            return undefined;
        }
        editor.setSelection(toolsAttr.range);
        if (newTools === undefined) {
            this.rewriteAttribute(model, '', toolsAttr.range);
            return;
        }
        else {
            this.rewriteTools(model, newTools, toolsAttr.value.range);
        }
    }
    rewriteTools(model, newTools, range) {
        const newToolNames = this._languageModelToolsService.toQualifiedToolNames(newTools);
        const newValue = `[${newToolNames.map(s => `'${s}'`).join(', ')}]`;
        this.rewriteAttribute(model, newValue, range);
    }
    rewriteAttribute(model, newValue, range) {
        model.pushStackElement();
        model.pushEditOperations(null, [EditOperation.replaceMove(range, newValue)], () => null);
        model.pushStackElement();
    }
    async openAndRewriteName(uri, newName, token) {
        const editor = await this._codeEditorService.openCodeEditor({ resource: uri }, this._codeEditorService.getFocusedCodeEditor());
        if (!editor || !editor.hasModel()) {
            return;
        }
        const model = editor.getModel();
        const promptAST = this._promptsService.getParsedPromptFile(model);
        if (!promptAST.header) {
            return;
        }
        const nameAttr = promptAST.header.getAttribute(PromptHeaderAttributes.name);
        if (!nameAttr) {
            return;
        }
        if (nameAttr.value.type === 'string' && nameAttr.value.value === newName) {
            return;
        }
        editor.setSelection(nameAttr.range);
        this.rewriteAttribute(model, newName, nameAttr.value.range);
    }
};
PromptFileRewriter = __decorate([
    __param(0, ICodeEditorService),
    __param(1, IPromptsService),
    __param(2, ILanguageModelToolsService)
], PromptFileRewriter);
export { PromptFileRewriter };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0RmlsZVJld3JpdGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9wcm9tcHRTeW50YXgvcHJvbXB0RmlsZVJld3JpdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBSWhHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUduRixPQUFPLEVBQUUsMEJBQTBCLEVBQWdDLE1BQU0sMkNBQTJDLENBQUM7QUFDckgsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDdkYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBRS9FLElBQU0sa0JBQWtCLEdBQXhCLE1BQU0sa0JBQWtCO0lBQzlCLFlBQ3NDLGtCQUFzQyxFQUN6QyxlQUFnQyxFQUNyQiwwQkFBc0Q7UUFGOUQsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFvQjtRQUN6QyxvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUFDckIsK0JBQTBCLEdBQTFCLDBCQUEwQixDQUE0QjtJQUVwRyxDQUFDO0lBRU0sS0FBSyxDQUFDLG1CQUFtQixDQUFDLEdBQVEsRUFBRSxRQUFrRCxFQUFFLEtBQXdCO1FBQ3RILE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxHQUFHLEVBQUUsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsb0JBQW9CLEVBQUUsQ0FBQyxDQUFDO1FBQy9ILElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQztZQUNuQyxPQUFPO1FBQ1IsQ0FBQztRQUNELE1B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