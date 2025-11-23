/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IDataChannelService } from '../../../../platform/dataChannel/common/dataChannel.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
export class DataChannelService extends Disposable {
    constructor() {
        super();
        this._onDidSendData = this._register(new Emitter());
        this.onDidSendData = this._onDidSendData.event;
    }
    getDataChannel(channelId) {
        return new CoreDataChannelImpl(channelId, this._onDidSendData);
    }
}
class CoreDataChannelImpl {
    constructor(channelId, _onDidSendData) {
        this.channelId = channelId;
        this._onDidSendData = _onDidSendData;
    }
    sendData(data) {
        this._onDidSendData.fire({
            channelId: this.channelId,
            data
        });
    }
}
registerSingleton(IDataChannelService, DataChannelService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YUNoYW5uZWxTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9kYXRhQ2hhbm5lbC9icm93c2VyL2RhdGFDaGFubmVsU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDM0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxtQkFBbUIsRUFBc0MsTUFBTSx3REFBd0QsQ0FBQztBQUNqSSxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFFL0csTUFBTSxPQUFPLGtCQUFtQixTQUFRLFVBQVU7SUFNakQ7UUFDQyxLQUFLLEVBQUUsQ0FBQztRQUpRLG1CQUFjLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBcUIsQ0FBQyxDQUFDO1FBQzFFLGtCQUFhLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUM7SUFJbkQsQ0FBQztJQUVELGNBQWMsQ0FBSSxTQUFpQjtRQUNsQyxPQUFPLElBQUksbUJBQW1CLENBQUksU0FBUyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUNuRSxDQUFDO0NBQ0Q7QUFFRCxNQUFNLG1CQUFtQjtJQUN4QixZQUNrQixTQUFpQixFQUNqQixjQUEwQztRQUQxQyxjQUFTLEdBQVQsU0FBUyxDQUFRO1FBQ2pCLG1CQUFjLEdBQWQsY0FBYyxDQUE0QjtJQUN4RCxDQUFDO0lBRUwsUUFBUSxDQUFDLElBQU87UUFDZixJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQztZQUN4QixTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVM7WUFDekIsSUFBSTtTQUNKLENBQUMsQ0FBQztJQUNKLENBQUM7Q0FDRDtBQUVELGlCQUFpQixDQUFDLG1CQUFtQixFQUFFLGtCQUFrQixvQ0FBNEIsQ0FBQyJ9