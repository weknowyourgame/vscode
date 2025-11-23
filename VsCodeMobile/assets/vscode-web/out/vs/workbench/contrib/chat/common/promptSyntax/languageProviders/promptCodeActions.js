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
import { Range } from '../../../../../../editor/common/core/range.js';
import { localize } from '../../../../../../nls.js';
import { ILanguageModelToolsService } from '../../languageModelToolsService.js';
import { getPromptsTypeForLanguageId, PromptsType } from '../promptTypes.js';
import { IPromptsService } from '../service/promptsService.js';
import { PromptHeaderAttributes } from '../promptFileParser.js';
import { Lazy } from '../../../../../../base/common/lazy.js';
import { LEGACY_MODE_FILE_EXTENSION } from '../config/promptFileLocations.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { isGithubTarget } from './promptValidator.js';
let PromptCodeActionProvider = class PromptCodeActionProvider {
    constructor(promptsService, languageModelToolsService, fileService) {
        this.promptsService = promptsService;
        this.languageModelToolsService = languageModelToolsService;
        this.fileService = fileService;
        /**
         * Debug display name for this provider.
         */
        this._debugDisplayName = 'PromptCodeActionProvider';
    }
    async provideCodeActions(model, range, context, token) {
        const promptType = getPromptsTypeForLanguageId(model.getLanguageId());
        if (!promptType || promptType === PromptsType.instructions) {
            // if the model is not a prompt, we don't provide any code actions
            return undefined;
        }
        const result = [];
        const promptAST = this.promptsService.getParsedPromptFile(model);
        switch (promptType) {
            case PromptsType.agent:
                this.getUpdateToolsCodeActions(promptAST, promptType, model, range, result);
                await this.getMigrateModeFileCodeActions(model.uri, result);
                break;
            case PromptsType.prompt:
                this.getUpdateModeCodeActions(promptAST, model, range, result);
                this.getUpdateToolsCodeActions(promptAST, promptType, model, range, result);
                break;
        }
        if (result.length === 0) {
            return undefined;
        }
        return {
            actions: result,
            dispose: () => { }
        };
    }
    getUpdateModeCodeActions(promptFile, model, range, result) {
        const modeAttr = promptFile.header?.getAttribute(PromptHeaderAttributes.mode);
        if (!modeAttr?.range.containsRange(range)) {
            return;
        }
        const keyRange = new Range(modeAttr.range.startLineNumber, modeAttr.range.startColumn, modeAttr.range.startLineNumber, modeAttr.range.startColumn + modeAttr.key.length);
        result.push({
            title: localize('renameToAgent', "Rename to 'agent'"),
            edit: {
                edits: [asWorkspaceTextEdit(model, { range: keyRange, text: 'agent' })]
            }
        });
    }
    async getMigrateModeFileCodeActions(uri, result) {
        if (uri.path.endsWith(LEGACY_MODE_FILE_EXTENSION)) {
            const location = this.promptsService.getAgentFileURIFromModeFile(uri);
            if (location && await this.fileService.canMove(uri, location)) {
                const edit = { oldResource: uri, newResource: location, options: { overwrite: false, copy: false } };
                result.push({
                    title: localize('migrateToAgent', "Migrate to custom agent file"),
                    edit: {
                        edits: [edit]
                    }
                });
            }
        }
    }
    getUpdateToolsCodeActions(promptFile, promptType, model, range, result) {
        const toolsAttr = promptFile.header?.getAttribute(PromptHeaderAttributes.tools);
        if (toolsAttr?.value.type !== 'array' || !toolsAttr.value.range.containsRange(range)) {
            return;
        }
        if (isGithubTarget(promptType, promptFile.header?.target)) {
            // GitHub Copilot custom agents use a fixed set of tool names that are not deprecated
            return;
        }
        const values = toolsAttr.value.items;
        const deprecatedNames = new Lazy(() => this.languageModelToolsService.getDeprecatedQualifiedToolNames());
        const edits = [];
        for (const item of values) {
            if (item.type !== 'string') {
                continue;
            }
            const newNames = deprecatedNames.value.get(item.value);
            if (newNames && newNames.size > 0) {
                const quote = model.getValueInRange(new Range(item.range.startLineNumber, item.range.startColumn, item.range.endLineNumber, item.range.startColumn + 1));
                if (newNames.size === 1) {
                    const newName = Array.from(newNames)[0];
                    const text = (quote === `'` || quote === '"') ? (quote + newName + quote) : newName;
                    const edit = { range: item.range, text };
                    edits.push(edit);
                    if (item.range.containsRange(range)) {
                        result.push({
                            title: localize('updateToolName', "Update to '{0}'", newName),
                            edit: {
                                edits: [asWorkspaceTextEdit(model, edit)]
                            }
                        });
                    }
                }
                else {
                    // Multiple new names - expand to include all of them
                    const newNamesArray = Array.from(newNames).sort((a, b) => a.localeCompare(b));
                    const separator = model.getValueInRange(new Range(item.range.startLineNumber, item.range.endColumn, item.range.endLineNumber, item.range.endColumn + 2));
                    const useCommaSpace = separator.includes(',');
                    const delimiterText = useCommaSpace ? ', ' : ',';
                    const newNamesText = newNamesArray.map(name => (quote === `'` || quote === '"') ? (quote + name + quote) : name).join(delimiterText);
                    const edit = { range: item.range, text: newNamesText };
                    edits.push(edit);
                    if (item.range.containsRange(range)) {
                        result.push({
                            title: localize('expandToolNames', "Expand to {0} tools", newNames.size),
                            edit: {
                                edits: [asWorkspaceTextEdit(model, edit)]
                            }
                        });
                    }
                }
            }
        }
        if (edits.length && result.length === 0 || edits.length > 1) {
            result.push({
                title: localize('updateAllToolNames', "Update all tool names"),
                edit: {
                    edits: edits.map(edit => asWorkspaceTextEdit(model, edit))
                }
            });
        }
    }
};
PromptCodeActionProvider = __decorate([
    __param(0, IPromptsService),
    __param(1, ILanguageModelToolsService),
    __param(2, IFileService)
], PromptCodeActionProvider);
export { PromptCodeActionProvider };
function asWorkspaceTextEdit(model, textEdit) {
    return {
        versionId: model.getVersionId(),
        resource: model.uri,
        textEdit
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0Q29kZUFjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vcHJvbXB0U3ludGF4L2xhbmd1YWdlUHJvdmlkZXJzL3Byb21wdENvZGVBY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUd0RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDcEQsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDaEYsT0FBTyxFQUFFLDJCQUEyQixFQUFFLFdBQVcsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQzdFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMvRCxPQUFPLEVBQW9CLHNCQUFzQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFFbEYsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQzdELE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUVoRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFFL0MsSUFBTSx3QkFBd0IsR0FBOUIsTUFBTSx3QkFBd0I7SUFNcEMsWUFDa0IsY0FBZ0QsRUFDckMseUJBQXNFLEVBQ3BGLFdBQTBDO1FBRnRCLG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUNwQiw4QkFBeUIsR0FBekIseUJBQXlCLENBQTRCO1FBQ25FLGdCQUFXLEdBQVgsV0FBVyxDQUFjO1FBUnpEOztXQUVHO1FBQ2Esc0JBQWlCLEdBQVcsMEJBQTBCLENBQUM7SUFPdkUsQ0FB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