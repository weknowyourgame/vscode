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
import { PromptLinkProvider } from './languageProviders/promptLinkProvider.js';
import { PromptBodyAutocompletion } from './languageProviders/promptBodyAutocompletion.js';
import { PromptHeaderAutocompletion } from './languageProviders/promptHeaderAutocompletion.js';
import { PromptHoverProvider } from './languageProviders/promptHovers.js';
import { PromptHeaderDefinitionProvider } from './languageProviders/PromptHeaderDefinitionProvider.js';
import { PromptValidatorContribution } from './languageProviders/promptValidator.js';
import { PromptDocumentSemanticTokensProvider } from './languageProviders/promptDocumentSemanticTokensProvider.js';
import { PromptCodeActionProvider } from './languageProviders/promptCodeActions.js';
import { ILanguageFeaturesService } from '../../../../../editor/common/services/languageFeatures.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ALL_PROMPTS_LANGUAGE_SELECTOR } from './promptTypes.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
let PromptLanguageFeaturesProvider = class PromptLanguageFeaturesProvider extends Disposable {
    static { this.ID = 'chat.promptLanguageFeatures'; }
    constructor(languageService, instantiationService) {
        super();
        this._register(languageService.linkProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, instantiationService.createInstance(PromptLinkProvider)));
        this._register(languageService.completionProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, instantiationService.createInstance(PromptBodyAutocompletion)));
        this._register(languageService.completionProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, instantiationService.createInstance(PromptHeaderAutocompletion)));
        this._register(languageService.hoverProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, instantiationService.createInstance(PromptHoverProvider)));
        this._register(languageService.definitionProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, instantiationService.createInstance(PromptHeaderDefinitionProvider)));
        this._register(languageService.documentSemanticTokensProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, instantiationService.createInstance(PromptDocumentSemanticTokensProvider)));
        this._register(languageService.codeActionProvider.register(ALL_PROMPTS_LANGUAGE_SELECTOR, instantiationService.createInstance(PromptCodeActionProvider)));
        this._register(instantiationService.createInstance(PromptValidatorContribution));
    }
};
PromptLanguageFeaturesProvider = __decorate([
    __param(0, ILanguageFeaturesService),
    __param(1, IInstantiationService)
], PromptLanguageFeaturesProvider);
export { PromptLanguageFeaturesProvider };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0RmlsZUNvbnRyaWJ1dGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vcHJvbXB0U3ludGF4L3Byb21wdEZpbGVDb250cmlidXRpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQzNGLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQy9GLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzFFLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxvQ0FBb0MsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ25ILE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUNqRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUUvRixJQUFNLDhCQUE4QixHQUFwQyxNQUFNLDhCQUErQixTQUFRLFVBQVU7YUFDN0MsT0FBRSxHQUFHLDZCQUE2QixBQUFoQyxDQUFpQztJQUVuRCxZQUMyQixlQUF5QyxFQUM1QyxvQkFBMkM7UUFFbEUsS0FBSyxFQUFFLENBQUM7UUFFUixJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLDZCQUE2QixFQUFFLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5SSxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsNkJBQTZCLEVBQUUsb0JBQW9CLENBQUMsY0FBYyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzFKLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyw2QkFBNkIsRUFBRSxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUosSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyw2QkFBNkIsRUFBRSxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEosSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLDZCQUE2QixFQUFFLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoSyxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyw4QkFBOEIsQ0FBQyxRQUFRLENBQUMsNkJBQTZCLEVBQUUsb0JBQW9CLENBQUMsY0FBYyxDQUFDLG9DQUFvQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xMLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyw2QkFBNkIsRUFBRSxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFMUosSUFBSSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxDQUFDO0lBQ2xGLENBQUM7O0FBbEJXLDhCQUE4QjtJQUl4QyxXQUFBLHdCQUF3QixDQUFBO0lBQ3hCLFdBQUEscUJBQXFCLENBQUE7R0FMWCw4QkFBOEIsQ0FtQjFDIn0=