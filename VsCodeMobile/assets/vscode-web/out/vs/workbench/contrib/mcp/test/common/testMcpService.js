/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { observableValue } from '../../../../../base/common/observable.js';
export class TestMcpService {
    constructor() {
        this.servers = observableValue(this, []);
        this.lazyCollectionState = observableValue(this, { state: 2 /* LazyCollectionState.AllKnown */, collections: [] });
    }
    resetCaches() {
    }
    resetTrust() {
    }
    cancelAutostart() {
    }
    autostart() {
        return observableValue(this, { working: false, starting: [], serversRequiringInteraction: [] });
    }
    activateCollections() {
        return Promise.resolve();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdE1jcFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL3Rlc3QvY29tbW9uL3Rlc3RNY3BTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUczRSxNQUFNLE9BQU8sY0FBYztJQUEzQjtRQUVRLFlBQU8sR0FBRyxlQUFlLENBQXdCLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztRQWdCM0Qsd0JBQW1CLEdBQUcsZUFBZSxDQUFDLElBQUksRUFBRSxFQUFFLEtBQUssc0NBQThCLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFLOUcsQ0FBQztJQXBCQSxXQUFXO0lBRVgsQ0FBQztJQUNELFVBQVU7SUFFVixDQUFDO0lBRUQsZUFBZTtJQUVmLENBQUM7SUFFRCxTQUFTO1FBQ1IsT0FBTyxlQUFlLENBQW1CLElBQUksRUFBRSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSwyQkFBMkIsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ25ILENBQUM7SUFJRCxtQkFBbUI7UUFDbEIsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDMUIsQ0FBQztDQUNEIn0=