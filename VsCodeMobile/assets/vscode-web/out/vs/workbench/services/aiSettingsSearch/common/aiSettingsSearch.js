/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
export const IAiSettingsSearchService = createDecorator('IAiSettingsSearchService');
export var AiSettingsSearchResultKind;
(function (AiSettingsSearchResultKind) {
    AiSettingsSearchResultKind[AiSettingsSearchResultKind["EMBEDDED"] = 1] = "EMBEDDED";
    AiSettingsSearchResultKind[AiSettingsSearchResultKind["LLM_RANKED"] = 2] = "LLM_RANKED";
    AiSettingsSearchResultKind[AiSettingsSearchResultKind["CANCELED"] = 3] = "CANCELED";
})(AiSettingsSearchResultKind || (AiSettingsSearchResultKind = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWlTZXR0aW5nc1NlYXJjaC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvYWlTZXR0aW5nc1NlYXJjaC9jb21tb24vYWlTZXR0aW5nc1NlYXJjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUtoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFFN0YsTUFBTSxDQUFDLE1BQU0sd0JBQXdCLEdBQUcsZUFBZSxDQUEyQiwwQkFBMEIsQ0FBQyxDQUFDO0FBRTlHLE1BQU0sQ0FBTixJQUFZLDBCQUlYO0FBSkQsV0FBWSwwQkFBMEI7SUFDckMsbUZBQVksQ0FBQTtJQUNaLHVGQUFjLENBQUE7SUFDZCxtRkFBWSxDQUFBO0FBQ2IsQ0FBQyxFQUpXLDBCQUEwQixLQUExQiwwQkFBMEIsUUFJckMifQ==