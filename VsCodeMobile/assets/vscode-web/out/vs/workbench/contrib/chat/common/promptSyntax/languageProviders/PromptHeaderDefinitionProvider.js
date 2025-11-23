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
import { IChatModeService } from '../../chatModes.js';
import { getPromptsTypeForLanguageId } from '../promptTypes.js';
import { PromptHeaderAttributes } from '../promptFileParser.js';
import { IPromptsService } from '../service/promptsService.js';
let PromptHeaderDefinitionProvider = class PromptHeaderDefinitionProvider {
    constructor(promptsService, chatModeService) {
        this.promptsService = promptsService;
        this.chatModeService = chatModeService;
        /**
         * Debug display name for this provider.
         */
        this._debugDisplayName = 'PromptHeaderDefinitionProvider';
    }
    async provideDefinition(model, position, token) {
        const promptType = getPromptsTypeForLanguageId(model.getLanguageId());
        if (!promptType) {
            // if the model is not a prompt, we don't provide any definitions
            return undefined;
        }
        const promptAST = this.promptsService.getParsedPromptFile(model);
        const header = promptAST.header;
        if (!header) {
            return undefined;
        }
        const agentAttr = header.getAttribute(PromptHeaderAttributes.agent) ?? header.getAttribute(PromptHeaderAttributes.mode);
        if (agentAttr && agentAttr.value.type === 'string' && agentAttr.range.containsPosition(position)) {
            const agent = this.chatModeService.findModeByName(agentAttr.value.value);
            if (agent && agent.uri) {
                return {
                    uri: agent.uri.get(),
                    range: new Range(1, 1, 1, 1)
                };
            }
        }
        return undefined;
    }
};
PromptHeaderDefinitionProvider = __decorate([
    __param(0, IPromptsService),
    __param(1, IChatModeService)
], PromptHeaderDefinitionProvider);
export { PromptHeaderDefinitionProvider };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJvbXB0SGVhZGVyRGVmaW5pdGlvblByb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Byb21wdFN5bnRheC9sYW5ndWFnZVByb3ZpZGVycy9Qcm9tcHRIZWFkZXJEZWZpbml0aW9uUHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFJaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBR3RFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3RELE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ2hFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ2hFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUV4RCxJQUFNLDhCQUE4QixHQUFwQyxNQUFNLDhCQUE4QjtJQU0xQyxZQUNrQixjQUFnRCxFQUMvQyxlQUFrRDtRQURsQyxtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7UUFDOUIsb0JBQWUsR0FBZixlQUFlLENBQWtCO1FBUHJFOztXQUVHO1FBQ2Esc0JBQWlCLEdBQVcsZ0NBQWdDLENBQUM7SUFNN0UsQ0FBQztJQUVELEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxLQUFpQixFQUFFLFFBQWtCLEVBQUUsS0FBd0I7UUFDdEYsTUFBTSxVQUFVLEdBQUcsMkJBQTJCLENBQUMsS0FBSyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUM7UUFDdEUsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2pCLGlFQUFpRTtZQUNqRSxPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNqRSxNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDO1FBQ2hDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNiLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxZQUFZLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDeEgsSUFBSSxTQUFTLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLFNBQVMsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUNsRyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3pFLElBQUksS0FBSyxJQUFJLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDeEIsT0FBTztvQkFDTixHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUU7b0JBQ3BCLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7aUJBQzVCLENBQUM7WUFDSCxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7Q0FFRCxDQUFBO0FBdENZLDhCQUE4QjtJQU94QyxXQUFBLGVBQWUsQ0FBQTtJQUNmLFdBQUEsZ0JBQWdCLENBQUE7R0FSTiw4QkFBOEIsQ0FzQzFDIn0=