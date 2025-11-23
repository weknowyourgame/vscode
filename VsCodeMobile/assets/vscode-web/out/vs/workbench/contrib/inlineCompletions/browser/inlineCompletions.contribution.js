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
import { withoutDuplicates } from '../../../../base/common/arrays.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { autorun, observableFromEvent } from '../../../../base/common/observable.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { inlineCompletionProviderGetMatcher, providerIdSchemaUri } from '../../../../editor/contrib/inlineCompletions/browser/controller/commands.js';
import { Extensions } from '../../../../platform/jsonschemas/common/jsonContributionRegistry.js';
import { wrapInHotClass1 } from '../../../../platform/observable/common/wrapInHotClass.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { InlineCompletionLanguageStatusBarContribution } from './inlineCompletionLanguageStatusBarContribution.js';
registerWorkbenchContribution2(InlineCompletionLanguageStatusBarContribution.Id, wrapInHotClass1(InlineCompletionLanguageStatusBarContribution.hot), 4 /* WorkbenchPhase.Eventually */);
let InlineCompletionSchemaContribution = class InlineCompletionSchemaContribution extends Disposable {
    static { this.Id = 'vs.contrib.InlineCompletionSchemaContribution'; }
    constructor(_languageFeaturesService) {
        super();
        this._languageFeaturesService = _languageFeaturesService;
        const registry = Registry.as(Extensions.JSONContribution);
        const inlineCompletionsProvider = observableFromEvent(this, this._languageFeaturesService.inlineCompletionsProvider.onDidChange, () => this._languageFeaturesService.inlineCompletionsProvider.allNoModel());
        this._register(autorun(reader => {
            const provider = inlineCompletionsProvider.read(reader);
            registry.registerSchema(providerIdSchemaUri, {
                enum: withoutDuplicates(provider.flatMap(p => inlineCompletionProviderGetMatcher(p))),
            }, reader.store);
        }));
    }
};
InlineCompletionSchemaContribution = __decorate([
    __param(0, ILanguageFeaturesService)
], InlineCompletionSchemaContribution);
export { InlineCompletionSchemaContribution };
registerWorkbenchContribution2(InlineCompletionSchemaContribution.Id, InlineCompletionSchemaContribution, 4 /* WorkbenchPhase.Eventually */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ29tcGxldGlvbnMuY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvaW5saW5lQ29tcGxldGlvbnMuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDckYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDbEcsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sNkVBQTZFLENBQUM7QUFDdEosT0FBTyxFQUFFLFVBQVUsRUFBNkIsTUFBTSxxRUFBcUUsQ0FBQztBQUM1SCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDM0YsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzVFLE9BQU8sRUFBMEIsOEJBQThCLEVBQWtCLE1BQU0sa0NBQWtDLENBQUM7QUFDMUgsT0FBTyxFQUFFLDZDQUE2QyxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFFbkgsOEJBQThCLENBQUMsNkNBQTZDLENBQUMsRUFBRSxFQUFFLGVBQWUsQ0FBQyw2Q0FBNkMsQ0FBQyxHQUFHLENBQUMsb0NBQTRCLENBQUM7QUFFekssSUFBTSxrQ0FBa0MsR0FBeEMsTUFBTSxrQ0FBbUMsU0FBUSxVQUFVO2FBQ25ELE9BQUUsR0FBRywrQ0FBK0MsQUFBbEQsQ0FBbUQ7SUFFbkUsWUFDNEMsd0JBQWtEO1FBRTdGLEtBQUssRUFBRSxDQUFDO1FBRm1DLDZCQUF3QixHQUF4Qix3QkFBd0IsQ0FBMEI7UUFJN0YsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLEVBQUUsQ0FBNEIsVUFBVSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDckYsTUFBTSx5QkFBeUIsR0FBRyxtQkFBbUIsQ0FBQyxJQUFJLEVBQ3pELElBQUksQ0FBQyx3QkFBd0IsQ0FBQyx5QkFBeUIsQ0FBQyxXQUFXLEVBQ25FLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyx5QkFBeUIsQ0FBQyxVQUFVLEVBQUUsQ0FDMUUsQ0FBQztRQUVGLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQy9CLE1BQU0sUUFBUSxHQUFHLHlCQUF5QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN4RCxRQUFRLENBQUMsY0FBYyxDQUFDLG1CQUFtQixFQUFFO2dCQUM1QyxJQUFJLEVBQUUsaUJBQWlCLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGtDQUFrQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDckYsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7O0FBcEJXLGtDQUFrQztJQUk1QyxXQUFBLHdCQUF3QixDQUFBO0dBSmQsa0NBQWtDLENBcUI5Qzs7QUFFRCw4QkFBOEIsQ0FBQyxrQ0FBa0MsQ0FBQyxFQUFFLEVBQUUsa0NBQWtDLG9DQUE0QixDQUFDIn0=