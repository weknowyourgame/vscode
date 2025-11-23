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
import { MainContext } from './extHost.protocol.js';
import { ProgressLocation } from './extHostTypeConverters.js';
import { Progress } from '../../../platform/progress/common/progress.js';
import { CancellationTokenSource, CancellationToken } from '../../../base/common/cancellation.js';
import { throttle } from '../../../base/common/decorators.js';
import { onUnexpectedExternalError } from '../../../base/common/errors.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { IExtHostRpcService } from './extHostRpcService.js';
export const IExtHostProgress = createDecorator('IExtHostProgress');
let ExtHostProgress = class ExtHostProgress {
    constructor(extHostRpc) {
        this._handles = 0;
        this._mapHandleToCancellationSource = new Map();
        this._proxy = extHostRpc.getProxy(MainContext.MainThreadProgress);
    }
    async withProgress(extension, options, task) {
        const handle = this._handles++;
        const { title, location, cancellable } = options;
        const source = { label: extension.displayName || extension.name, id: extension.identifier.value };
        this._proxy.$startProgress(handle, { location: ProgressLocation.from(location), title, source, cancellable }, !extension.isUnderDevelopment ? extension.identifier.value : undefined).catch(onUnexpectedExternalError);
        return this._withProgress(handle, task, !!cancellable);
    }
    async withProgressFromSource(source, options, task) {
        const handle = this._handles++;
        const { title, location, cancellable } = options;
        this._proxy.$startProgress(handle, { location: ProgressLocation.from(location), title, source, cancellable }, undefined).catch(onUnexpectedExternalError);
        return this._withProgress(handle, task, !!cancellable);
    }
    _withProgress(handle, task, cancellable) {
        let source;
        if (cancellable) {
            source = new CancellationTokenSource();
            this._mapHandleToCancellationSource.set(handle, source);
        }
        const progressEnd = (handle) => {
            this._proxy.$progressEnd(handle);
            this._mapHandleToCancellationSource.delete(handle);
            source?.dispose();
        };
        let p;
        try {
            p = task(new ProgressCallback(this._proxy, handle), cancellable && source ? source.token : CancellationToken.None);
        }
        catch (err) {
            progressEnd(handle);
            throw err;
        }
        p.then(result => progressEnd(handle), err => progressEnd(handle));
        return p;
    }
    $acceptProgressCanceled(handle) {
        const source = this._mapHandleToCancellationSource.get(handle);
        if (source) {
            source.cancel();
            this._mapHandleToCancellationSource.delete(handle);
        }
    }
};
ExtHostProgress = __decorate([
    __param(0, IExtHostRpcService)
], ExtHostProgress);
export { ExtHostProgress };
function mergeProgress(result, currentValue) {
    result.message = currentValue.message;
    if (typeof currentValue.increment === 'number') {
        if (typeof result.increment === 'number') {
            result.increment += currentValue.increment;
        }
        else {
            result.increment = currentValue.increment;
        }
    }
    return result;
}
class ProgressCallback extends Progress {
    constructor(_proxy, _handle) {
        super(p => this.throttledReport(p));
        this._proxy = _proxy;
        this._handle = _handle;
    }
    throttledReport(p) {
        this._proxy.$progressReport(this._handle, p);
    }
}
__decorate([
    throttle(100, (result, currentValue) => mergeProgress(result, currentValue), () => Object.create(null))
], ProgressCallback.prototype, "throttledReport", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdFByb2dyZXNzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvY29tbW9uL2V4dEhvc3RQcm9ncmVzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQWlELFdBQVcsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ25HLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQzlELE9BQU8sRUFBRSxRQUFRLEVBQWlCLE1BQU0sK0NBQStDLENBQUM7QUFDeEYsT0FBTyxFQUFFLHVCQUF1QixFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBRTlELE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRTNFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUc1RCxNQUFNLENBQUMsTUFBTSxnQkFBZ0IsR0FBRyxlQUFlLENBQW1CLGtCQUFrQixDQUFDLENBQUM7QUFFL0UsSUFBTSxlQUFlLEdBQXJCLE1BQU0sZUFBZTtJQVEzQixZQUFnQyxVQUE4QjtRQUh0RCxhQUFRLEdBQVcsQ0FBQyxDQUFDO1FBQ3JCLG1DQUE4QixHQUF5QyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBR3hGLElBQUksQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUNuRSxDQUFDO0lBRUQsS0FBSyxDQUFDLFlBQVksQ0FBSSxTQUFnQyxFQUFFLE9BQXdCLEVBQUUsSUFBa0Y7UUFDbkssTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQy9CLE1BQU0sRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxHQUFHLE9BQU8sQ0FBQztRQUNqRCxNQUFNLE1BQU0sR0FBRyxFQUFFLEtBQUssRUFBRSxTQUFTLENBQUMsV0FBVyxJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFbEcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLEVBQUUsUUFBUSxFQUFFLGdCQUFnQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFDdk4sT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFFRCxLQUFLLENBQUMsc0JBQXNCLENBQUksTUFBb0MsRUFBRSxPQUF3QixFQUFFLElBQWtGO1FBQ2pMLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUMvQixNQUFNLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsR0FBRyxPQUFPLENBQUM7UUFFakQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLEVBQUUsUUFBUSxFQUFFLGdCQUFnQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1FBQzFKLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUN4RCxDQUFDO0lBRU8sYUFBYSxDQUFJLE1BQWMsRUFBRSxJQUFrRixFQUFFLFdBQW9CO1FBQ2hKLElBQUksTUFBMkMsQ0FBQztRQUNoRCxJQUFJLFdBQVcsRUFBRSxDQUFDO1lBQ2pCLE1BQU0sR0FBRyxJQUFJLHVCQUF1QixFQUFFLENBQUM7WUFDdkMsSUFBSSxDQUFDLDhCQUE4QixDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDekQsQ0FBQztRQUVELE1BQU0sV0FBVyxHQUFHLENBQUMsTUFBYyxFQUFRLEVBQUU7WUFDNUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDakMsSUFBSSxDQUFDLDhCQUE4QixDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNuRCxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUM7UUFDbkIsQ0FBQyxDQUFDO1FBRUYsSUFBSSxDQUFjLENBQUM7UUFFbkIsSUFBSSxDQUFDO1lBQ0osQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLEVBQUUsV0FBVyxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDcEgsQ0FBQztRQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7WUFDZCxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDcEIsTUFBTSxHQUFHLENBQUM7UUFDWCxDQUFDO1FBRUQsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ2xFLE9BQU8sQ0FBQyxDQUFDO0lBQ1YsQ0FBQztJQUVNLHVCQUF1QixDQUFDLE1BQWM7UUFDNUMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLDhCQUE4QixDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMvRCxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1osTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDcEQsQ0FBQztJQUNGLENBQUM7Q0FDRCxDQUFBO0FBOURZLGVBQWU7SUFRZCxXQUFBLGtCQUFrQixDQUFBO0dBUm5CLGVBQWUsQ0E4RDNCOztBQUVELFNBQVMsYUFBYSxDQUFDLE1BQXFCLEVBQUUsWUFBMkI7SUFDeEUsTUFBTSxDQUFDLE9BQU8sR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDO0lBQ3RDLElBQUksT0FBTyxZQUFZLENBQUMsU0FBUyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQ2hELElBQUksT0FBTyxNQUFNLENBQUMsU0FBUyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzFDLE1BQU0sQ0FBQyxTQUFTLElBQUksWUFBWSxDQUFDLFNBQVMsQ0FBQztRQUM1QyxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sQ0FBQyxTQUFTLEdBQUcsWUFBWSxDQUFDLFNBQVMsQ0FBQztRQUMzQyxDQUFDO0lBQ0YsQ0FBQztJQUVELE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVELE1BQU0sZ0JBQWlCLFNBQVEsUUFBdUI7SUFDckQsWUFBb0IsTUFBK0IsRUFBVSxPQUFlO1FBQzNFLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQURqQixXQUFNLEdBQU4sTUFBTSxDQUF5QjtRQUFVLFlBQU8sR0FBUCxPQUFPLENBQVE7SUFFNUUsQ0FBQztJQUdELGVBQWUsQ0FBQyxDQUFnQjtRQUMvQixJQUFJLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzlDLENBQUM7Q0FDRDtBQUhBO0lBREMsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQXFCLEVBQUUsWUFBMkIsRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxZQUFZLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO3VEQUdySSJ9