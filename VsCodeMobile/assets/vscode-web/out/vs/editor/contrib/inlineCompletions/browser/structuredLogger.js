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
var StructuredLogger_1;
import { Disposable } from '../../../../base/common/lifecycle.js';
import { observableFromEvent } from '../../../../base/common/observable.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IDataChannelService } from '../../../../platform/dataChannel/common/dataChannel.js';
/**
 * The sourceLabel must not contain '@'!
*/
export function formatRecordableLogEntry(entry) {
    // eslint-disable-next-line local/code-no-any-casts
    return entry.sourceId + ' @@ ' + JSON.stringify({ ...entry, modelUri: entry.modelUri?.toString(), sourceId: undefined });
}
let StructuredLogger = StructuredLogger_1 = class StructuredLogger extends Disposable {
    static cast() {
        return this;
    }
    constructor(_key, _contextKeyService, _dataChannelService) {
        super();
        this._key = _key;
        this._contextKeyService = _contextKeyService;
        this._dataChannelService = _dataChannelService;
        this._isEnabledContextKeyValue = observableContextKey('structuredLogger.enabled:' + this._key, this._contextKeyService).recomputeInitiallyAndOnChange(this._store);
        this.isEnabled = this._isEnabledContextKeyValue.map(v => v !== undefined);
    }
    log(data) {
        const enabled = this._isEnabledContextKeyValue.get();
        if (!enabled) {
            return false;
        }
        this._dataChannelService.getDataChannel('structuredLogger:' + this._key).sendData(data);
        return true;
    }
};
StructuredLogger = StructuredLogger_1 = __decorate([
    __param(1, IContextKeyService),
    __param(2, IDataChannelService)
], StructuredLogger);
export { StructuredLogger };
function observableContextKey(key, contextKeyService) {
    return observableFromEvent(contextKeyService.onDidChangeContext, () => contextKeyService.getContextKeyValue(key));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RydWN0dXJlZExvZ2dlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3N0cnVjdHVyZWRMb2dnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQWUsbUJBQW1CLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUV6RixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMxRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQTBDN0Y7O0VBRUU7QUFDRixNQUFNLFVBQVUsd0JBQXdCLENBQWdDLEtBQVE7SUFDL0UsbURBQW1EO0lBQ25ELE9BQU8sS0FBSyxDQUFDLFFBQVEsR0FBRyxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsS0FBSyxFQUFFLFFBQVEsRUFBRyxLQUFhLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0FBQ25JLENBQUM7QUFFTSxJQUFNLGdCQUFnQix3QkFBdEIsTUFBTSxnQkFBZ0QsU0FBUSxVQUFVO0lBQ3ZFLE1BQU0sQ0FBQyxJQUFJO1FBQ2pCLE9BQU8sSUFBa0MsQ0FBQztJQUMzQyxDQUFDO0lBS0QsWUFDa0IsSUFBWSxFQUNRLGtCQUFzQyxFQUNyQyxtQkFBd0M7UUFFOUUsS0FBSyxFQUFFLENBQUM7UUFKUyxTQUFJLEdBQUosSUFBSSxDQUFRO1FBQ1EsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFvQjtRQUNyQyx3QkFBbUIsR0FBbkIsbUJBQW1CLENBQXFCO1FBRzlFLElBQUksQ0FBQyx5QkFBeUIsR0FBRyxvQkFBb0IsQ0FBVSwyQkFBMkIsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLDZCQUE2QixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM1SyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssU0FBUyxDQUFDLENBQUM7SUFDM0UsQ0FBQztJQUVNLEdBQUcsQ0FBQyxJQUFPO1FBQ2pCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNyRCxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDZCxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFDRCxJQUFJLENBQUMsbUJBQW1CLENBQUMsY0FBYyxDQUFJLG1CQUFtQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0YsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0NBQ0QsQ0FBQTtBQTFCWSxnQkFBZ0I7SUFVMUIsV0FBQSxrQkFBa0IsQ0FBQTtJQUNsQixXQUFBLG1CQUFtQixDQUFBO0dBWFQsZ0JBQWdCLENBMEI1Qjs7QUFFRCxTQUFTLG9CQUFvQixDQUFJLEdBQVcsRUFBRSxpQkFBcUM7SUFDbEYsT0FBTyxtQkFBbUIsQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsRUFBRSxHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxrQkFBa0IsQ0FBSSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3RILENBQUMifQ==