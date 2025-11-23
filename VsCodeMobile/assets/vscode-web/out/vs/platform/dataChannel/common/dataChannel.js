/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
export const IDataChannelService = createDecorator('dataChannelService');
export class NullDataChannelService {
    get onDidSendData() {
        return Event.None;
    }
    getDataChannel(_channelId) {
        return {
            sendData: () => { },
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YUNoYW5uZWwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vZGF0YUNoYW5uZWwvY29tbW9uL2RhdGFDaGFubmVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN0RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFOUUsTUFBTSxDQUFDLE1BQU0sbUJBQW1CLEdBQUcsZUFBZSxDQUFzQixvQkFBb0IsQ0FBQyxDQUFDO0FBbUI5RixNQUFNLE9BQU8sc0JBQXNCO0lBRWxDLElBQUksYUFBYTtRQUNoQixPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUM7SUFDbkIsQ0FBQztJQUNELGNBQWMsQ0FBSSxVQUFrQjtRQUNuQyxPQUFPO1lBQ04sUUFBUSxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7U0FDbkIsQ0FBQztJQUNILENBQUM7Q0FDRCJ9