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
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { isITextModel } from '../../../../../editor/common/model.js';
import { ILanguageFeaturesService } from '../../../../../editor/common/services/languageFeatures.js';
import { localize } from '../../../../../nls.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { showToolsPicker } from '../actions/chatToolPicker.js';
import { ILanguageModelToolsService } from '../../common/languageModelToolsService.js';
import { ALL_PROMPTS_LANGUAGE_SELECTOR, getPromptsTypeForLanguageId, PromptsType } from '../../common/promptSyntax/promptTypes.js';
import { IPromptsService } from '../../common/promptSyntax/service/promptsService.js';
import { registerEditorFeature } from '../../../../../editor/common/editorFeatures.js';
import { PromptFileRewriter } from './promptFileRewriter.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { PromptHeaderAttributes } from '../../common/promptSyntax/promptFileParser.js';
import { isGithubTarget } from '../../common/promptSyntax/languageProviders/promptValidator.js';
let PromptToolsCodeLensProvider = class PromptToolsCodeLensProvider extends Disposable {
    constructor(promptsService, languageService, languageModelToolsService, instantiationService) {
        super();
        this.promptsService = promptsService;
        this.languageService = languageService;
        this.languageModelToolsService = languageModelToolsService;
        this.instantiationService = instantiationService;
        // `_`-prefix marks this as private command
        this.cmdId = `_configure/${generateUuid()}`;
        this._register(this.languageService.codeLensProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, this));
        this._register(CommandsRegistry.registerCommand(this.cmdId, (_accessor, ...args) => {
            const [first, second, third, forth] = args;
            const model = first;
            if (isITextModel(model) && Range.isIRange(second) && Array.isArray(third) && (typeof forth === 'string' || forth === undefined)) {
                this.updateTools(model, Range.lift(second), third, forth);
            }
        }));
    }
    async provideCodeLenses(model, token) {
        const promptType = getPromptsTypeForLanguageId(model.getLanguageId());
        if (!promptType || promptType === PromptsType.instructions) {
            // if the model is not a prompt, we don't provide any code actions
            return undefined;
        }
        const promptAST = this.promptsService.getParsedPromptFile(model);
        const header = promptAST.header;
        if (!header) {
            return undefined;
        }
        if (isGithubTarget(promptType, header.target)) {
            return undefined;
        }
        const toolsAttr = header.getAttribute(PromptHeaderAttributes.tools);
        if (!toolsAttr || toolsAttr.value.type !== 'array') {
            return undefined;
        }
        const items = toolsAttr.value.items;
        const selectedTools = items.filter(item => item.type === 'string').map(item => item.value);
        const codeLens = {
            range: toolsAttr.range.collapseToStart(),
            command: {
                title: localize('configure-tools.capitalized.ellipsis', "Configure Tools..."),
                id: this.cmdId,
                arguments: [model, toolsAttr.value.range, selectedTools, header.target]
            }
        };
        return { lenses: [codeLens] };
    }
    async updateTools(model, range, selectedTools, target) {
        const selectedToolsNow = () => this.languageModelToolsService.toToolAndToolSetEnablementMap(selectedTools, target);
        const newSelectedAfter = await this.instantiationService.invokeFunction(showToolsPicker, localize('placeholder', "Select tools"), undefined, selectedToolsNow);
        if (!newSelectedAfter) {
            return;
        }
        await this.instantiationService.createInstance(PromptFileRewriter).rewriteTools(model, newSelectedAfter, range);
    }
};
PromptToolsCodeLensProvider = __decorate([
    __param(0, IPromptsService),
    __param(1, ILanguageFeaturesService),
    __param(2, ILanguageModelToolsService),
    __param(3, IInstantiationService)
], PromptToolsCodeLensProvider);
registerEditorFeature(PromptToolsCodeLensProvider);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0VG9vbHNDb2RlTGVuc1Byb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9wcm9tcHRTeW50YXgvcHJvbXB0VG9vbHNDb2RlTGVuc1Byb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFFbEUsT0FBTyxFQUFFLFlBQVksRUFBYyxNQUFNLHVDQUF1QyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN2RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDL0QsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDdkYsT0FBTyxFQUFFLDZCQUE2QixFQUFFLDJCQUEyQixFQUFFLFdBQVcsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25JLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN0RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUN2RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUM3RCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFbkUsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDdkYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBRWhHLElBQU0sMkJBQTJCLEdBQWpDLE1BQU0sMkJBQTRCLFNBQVEsVUFBVTtJQUtuRCxZQUNrQixjQUFnRCxFQUN2QyxlQUEwRCxFQUN4RCx5QkFBc0UsRUFDM0Usb0JBQTREO1FBRW5GLEtBQUssRUFBRSxDQUFDO1FBTDBCLG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUN0QixvQkFBZSxHQUFmLGVBQWUsQ0FBMEI7UUFDdkMsOEJBQXlCLEdBQXpCLHlCQUF5QixDQUE0QjtRQUMxRCx5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXVCO1FBUHBGLDJDQUEyQztRQUMxQixVQUFLLEdBQUcsY0FBYyxZQUFZLEVBQUUsRUFBRSxDQUFDO1FBV3ZELElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsNkJBQTZCLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUVwRyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsU0FBUyxFQUFFLEdBQUcsSUFBSSxFQUFFLEVBQUU7WUFDbEYsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQztZQUMzQyxNQUFNLEtBQUssR0FBRyxLQUFxQixDQUFDO1lBQ3BDLElBQUksWUFBWSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxLQUFLLEtBQUssU0FBUyxDQUFDLEVBQUUsQ0FBQztnQkFDakksSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFtQixFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3pFLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxLQUFpQixFQUFFLEtBQXdCO1FBQ2xFLE1BQU0sVUFBVSxHQUFHLDJCQUEyQixDQUFDLEtBQUssQ0FBQyxhQUFhLEVBQUUsQ0FBQyxDQUFDO1FBQ3RFLElBQUksQ0FBQyxVQUFVLElBQUksVUFBVSxLQUFLLFdBQVcsQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUM1RCxrRUFBa0U7WUFDbEUsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDakUsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQztRQUNoQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDYixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsSUFBSSxjQUFjLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQy9DLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3BFLElBQUksQ0FBQyxTQUFTLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssT0FBTyxFQUFFLENBQUM7WUFDcEQsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUNELE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQ3BDLE1BQU0sYUFBYSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUUzRixNQUFNLFFBQVEsR0FBYTtZQUMxQixLQUFLLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxlQUFlLEVBQUU7WUFDeEMsT0FBTyxFQUFFO2dCQUNSLEtBQUssRUFBRSxRQUFRLENBQUMsc0NBQXNDLEVBQUUsb0JBQW9CLENBQUM7Z0JBQzdFLEVBQUUsRUFBRSxJQUFJLENBQUMsS0FBSztnQkFDZCxTQUFTLEVBQUUsQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsYUFBYSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUM7YUFDdkU7U0FDRCxDQUFDO1FBQ0YsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7SUFDL0IsQ0FBQztJQUVPLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBaUIsRUFBRSxLQUFZLEVBQUUsYUFBZ0MsRUFBRSxNQUEwQjtRQUN0SCxNQUFNLGdCQUFnQixHQUFHLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyw2QkFBNkIsQ0FBQyxhQUFhLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDbkgsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsZUFBZSxFQUFFLFFBQVEsQ0FBQyxhQUFhLEVBQUUsY0FBYyxDQUFDLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDL0osSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDdkIsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2pILENBQUM7Q0FDRCxDQUFBO0FBcEVLLDJCQUEyQjtJQU05QixXQUFBLGVBQWUsQ0FBQTtJQUNmLFdBQUEsd0JBQXdCLENBQUE7SUFDeEIsV0FBQSwwQkFBMEIsQ0FBQTtJQUMxQixXQUFBLHFCQUFxQixDQUFBO0dBVGxCLDJCQUEyQixDQW9FaEM7QUFFRCxxQkFBcUIsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDIn0=