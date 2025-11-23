/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
export class NullLanguageModelsService {
    constructor() {
        this.onDidChangeLanguageModels = Event.None;
    }
    registerLanguageModelProvider(vendor, provider) {
        return Disposable.None;
    }
    updateModelPickerPreference(modelIdentifier, showInModelPicker) {
        return;
    }
    getVendors() {
        return [];
    }
    getLanguageModelIds() {
        return [];
    }
    lookupLanguageModel(identifier) {
        return undefined;
    }
    getLanguageModels() {
        return [];
    }
    setContributedSessionModels() {
        return;
    }
    clearContributedSessionModels() {
        return;
    }
    async selectLanguageModels(selector) {
        return [];
    }
    sendChatRequest(identifier, from, messages, options, token) {
        throw new Error('Method not implemented.');
    }
    computeTokenLength(identifier, message, token) {
        throw new Error('Method not implemented.');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFuZ3VhZ2VNb2RlbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2NvbW1vbi9sYW5ndWFnZU1vZGVscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDNUQsT0FBTyxFQUFFLFVBQVUsRUFBZSxNQUFNLHlDQUF5QyxDQUFDO0FBSWxGLE1BQU0sT0FBTyx5QkFBeUI7SUFBdEM7UUFPQyw4QkFBeUIsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO0lBeUN4QyxDQUFDO0lBN0NBLDZCQUE2QixDQUFDLE1BQWMsRUFBRSxRQUFvQztRQUNqRixPQUFPLFVBQVUsQ0FBQyxJQUFJLENBQUM7SUFDeEIsQ0FBQztJQUlELDJCQUEyQixDQUFDLGVBQXVCLEVBQUUsaUJBQTBCO1FBQzlFLE9BQU87SUFDUixDQUFDO0lBRUQsVUFBVTtRQUNULE9BQU8sRUFBRSxDQUFDO0lBQ1gsQ0FBQztJQUVELG1CQUFtQjtRQUNsQixPQUFPLEVBQUUsQ0FBQztJQUNYLENBQUM7SUFFRCxtQkFBbUIsQ0FBQyxVQUFrQjtRQUNyQyxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsaUJBQWlCO1FBQ2hCLE9BQU8sRUFBRSxDQUFDO0lBQ1gsQ0FBQztJQUVELDJCQUEyQjtRQUMxQixPQUFPO0lBQ1IsQ0FBQztJQUVELDZCQUE2QjtRQUM1QixPQUFPO0lBQ1IsQ0FBQztJQUVELEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxRQUFvQztRQUM5RCxPQUFPLEVBQUUsQ0FBQztJQUNYLENBQUM7SUFFRCxlQUFlLENBQUMsVUFBa0IsRUFBRSxJQUF5QixFQUFFLFFBQXdCLEVBQUUsT0FBZ0MsRUFBRSxLQUF3QjtRQUNsSixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVELGtCQUFrQixDQUFDLFVBQWtCLEVBQUUsT0FBOEIsRUFBRSxLQUF3QjtRQUM5RixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUNEIn0=