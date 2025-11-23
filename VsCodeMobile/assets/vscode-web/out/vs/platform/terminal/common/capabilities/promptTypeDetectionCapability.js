/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
export class PromptTypeDetectionCapability extends Disposable {
    constructor() {
        super(...arguments);
        this.type = 6 /* TerminalCapability.PromptTypeDetection */;
        this._onPromptTypeChanged = this._register(new Emitter());
        this.onPromptTypeChanged = this._onPromptTypeChanged.event;
    }
    get promptType() { return this._promptType; }
    setPromptType(value) {
        this._promptType = value;
        this._onPromptTypeChanged.fire(value);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0VHlwZURldGVjdGlvbkNhcGFiaWxpdHkuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9wcm9tcHRUeXBlRGV0ZWN0aW9uQ2FwYWJpbGl0eS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDM0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBR2xFLE1BQU0sT0FBTyw2QkFBOEIsU0FBUSxVQUFVO0lBQTdEOztRQUNVLFNBQUksa0RBQTBDO1FBS3RDLHlCQUFvQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQXNCLENBQUMsQ0FBQztRQUNqRix3QkFBbUIsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDO0lBTWhFLENBQUM7SUFUQSxJQUFJLFVBQVUsS0FBeUIsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztJQUtqRSxhQUFhLENBQUMsS0FBYTtRQUMxQixJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQztRQUN6QixJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7Q0FDRCJ9