/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IBrowserElementsService } from './browserElementsService.js';
class WebBrowserElementsService {
    constructor() { }
    async getElementData(rect, token) {
        throw new Error('Not implemented');
    }
    startDebugSession(token, browserType) {
        throw new Error('Not implemented');
    }
}
registerSingleton(IBrowserElementsService, WebBrowserElementsService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViQnJvd3NlckVsZW1lbnRzU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvYnJvd3NlckVsZW1lbnRzL2Jyb3dzZXIvd2ViQnJvd3NlckVsZW1lbnRzU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUtoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQXFCLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFFdEUsTUFBTSx5QkFBeUI7SUFHOUIsZ0JBQWdCLENBQUM7SUFFakIsS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFnQixFQUFFLEtBQXdCO1FBQzlELE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsaUJBQWlCLENBQUMsS0FBd0IsRUFBRSxXQUF3QjtRQUNuRSxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDcEMsQ0FBQztDQUNEO0FBRUQsaUJBQWlCLENBQUMsdUJBQXVCLEVBQUUseUJBQXlCLG9DQUE0QixDQUFDIn0=