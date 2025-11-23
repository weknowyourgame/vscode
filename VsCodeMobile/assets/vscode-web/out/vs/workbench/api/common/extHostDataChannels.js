/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { checkProposedApiEnabled } from '../../services/extensions/common/extensions.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
export const IExtHostDataChannels = createDecorator('IExtHostDataChannels');
export class ExtHostDataChannels {
    constructor() {
        this._channels = new Map();
    }
    createDataChannel(extension, channelId) {
        checkProposedApiEnabled(extension, 'dataChannels');
        let channel = this._channels.get(channelId);
        if (!channel) {
            channel = new DataChannelImpl(channelId);
            this._channels.set(channelId, channel);
        }
        return channel;
    }
    $onDidReceiveData(channelId, data) {
        const channel = this._channels.get(channelId);
        if (channel) {
            channel._fireDidReceiveData(data);
        }
    }
}
class DataChannelImpl extends Disposable {
    constructor(channelId) {
        super();
        this.channelId = channelId;
        this._onDidReceiveData = new Emitter();
        this.onDidReceiveData = this._onDidReceiveData.event;
        this._register(this._onDidReceiveData);
    }
    _fireDidReceiveData(data) {
        this._onDidReceiveData.fire({ data });
    }
    toString() {
        return `DataChannel(${this.channelId})`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdERhdGFDaGFubmVscy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0RGF0YUNoYW5uZWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFL0QsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFFekYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBTzFGLE1BQU0sQ0FBQyxNQUFNLG9CQUFvQixHQUFHLGVBQWUsQ0FBdUIsc0JBQXNCLENBQUMsQ0FBQztBQUVsRyxNQUFNLE9BQU8sbUJBQW1CO0lBSy9CO1FBRmlCLGNBQVMsR0FBRyxJQUFJLEdBQUcsRUFBZ0MsQ0FBQztJQUdyRSxDQUFDO0lBRUQsaUJBQWlCLENBQUksU0FBZ0MsRUFBRSxTQUFpQjtRQUN2RSx1QkFBdUIsQ0FBQyxTQUFTLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFFbkQsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDNUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2QsT0FBTyxHQUFHLElBQUksZUFBZSxDQUFJLFNBQVMsQ0FBQyxDQUFDO1lBQzVDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN4QyxDQUFDO1FBQ0QsT0FBTyxPQUFPLENBQUM7SUFDaEIsQ0FBQztJQUVELGlCQUFpQixDQUFDLFNBQWlCLEVBQUUsSUFBUztRQUM3QyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM5QyxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ2IsT0FBTyxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ25DLENBQUM7SUFDRixDQUFDO0NBQ0Q7QUFFRCxNQUFNLGVBQW1CLFNBQVEsVUFBVTtJQUkxQyxZQUE2QixTQUFpQjtRQUM3QyxLQUFLLEVBQUUsQ0FBQztRQURvQixjQUFTLEdBQVQsU0FBUyxDQUFRO1FBSDdCLHNCQUFpQixHQUFHLElBQUksT0FBTyxFQUE4QixDQUFDO1FBQy9ELHFCQUFnQixHQUFzQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDO1FBSWxHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDeEMsQ0FBQztJQUVELG1CQUFtQixDQUFDLElBQU87UUFDMUIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUVRLFFBQVE7UUFDaEIsT0FBTyxlQUFlLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQztJQUN6QyxDQUFDO0NBQ0QifQ==