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
import { AbstractPolicyService } from '../common/policy.js';
import { Throttler } from '../../../base/common/async.js';
import { MutableDisposable } from '../../../base/common/lifecycle.js';
import { ILogService } from '../../log/common/log.js';
let NativePolicyService = class NativePolicyService extends AbstractPolicyService {
    constructor(logService, productName) {
        super();
        this.logService = logService;
        this.productName = productName;
        this.throttler = new Throttler();
        this.watcher = this._register(new MutableDisposable());
    }
    async _updatePolicyDefinitions(policyDefinitions) {
        this.logService.trace(`NativePolicyService#_updatePolicyDefinitions - Found ${Object.keys(policyDefinitions).length} policy definitions`);
        const { createWatcher } = await import('@vscode/policy-watcher');
        await this.throttler.queue(() => new Promise((c, e) => {
            try {
                this.watcher.value = createWatcher(this.productName, policyDefinitions, update => {
                    this._onDidPolicyChange(update);
                    c();
                });
            }
            catch (err) {
                this.logService.error(`NativePolicyService#_updatePolicyDefinitions - Error creating watcher:`, err);
                e(err);
            }
        }));
    }
    _onDidPolicyChange(update) {
        this.logService.trace(`NativePolicyService#_onDidPolicyChange - Updated policy values: ${JSON.stringify(update)}`);
        for (const key in update) {
            const value = update[key];
            if (value === undefined) {
                this.policies.delete(key);
            }
            else {
                this.policies.set(key, value);
            }
        }
        this._onDidChange.fire(Object.keys(update));
    }
};
NativePolicyService = __decorate([
    __param(0, ILogService)
], NativePolicyService);
export { NativePolicyService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmF0aXZlUG9saWN5U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9wb2xpY3kvbm9kZS9uYXRpdmVQb2xpY3lTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxxQkFBcUIsRUFBaUQsTUFBTSxxQkFBcUIsQ0FBQztBQUUzRyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFMUQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdEUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBRS9DLElBQU0sbUJBQW1CLEdBQXpCLE1BQU0sbUJBQW9CLFNBQVEscUJBQXFCO0lBSzdELFlBQ2MsVUFBd0MsRUFDcEMsV0FBbUI7UUFFcEMsS0FBSyxFQUFFLENBQUM7UUFIc0IsZUFBVSxHQUFWLFVBQVUsQ0FBYTtRQUNwQyxnQkFBVyxHQUFYLFdBQVcsQ0FBUTtRQUw3QixjQUFTLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQztRQUNuQixZQUFPLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGlCQUFpQixFQUFXLENBQUMsQ0FBQztJQU81RSxDQUFDO0lBRVMsS0FBSyxDQUFDLHdCQUF3QixDQUFDLGlCQUFzRDtRQUM5RixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyx3REFBd0QsTUFBTSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE1BQU0scUJBQXFCLENBQUMsQ0FBQztRQUUxSSxNQUFNLEVBQUUsYUFBYSxFQUFFLEdBQUcsTUFBTSxNQUFNLENBQUMsd0JBQXdCLENBQUMsQ0FBQztRQUVqRSxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksT0FBTyxDQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzNELElBQUksQ0FBQztnQkFDSixJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLENBQUMsRUFBRTtvQkFDaEYsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUNoQyxDQUFDLEVBQUUsQ0FBQztnQkFDTCxDQUFDLENBQUMsQ0FBQztZQUNKLENBQUM7WUFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO2dCQUNkLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLHdFQUF3RSxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUNyRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDUixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxNQUF5RDtRQUNuRixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxtRUFBbUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFbkgsS0FBSyxNQUFNLEdBQUcsSUFBSSxNQUFpRCxFQUFFLENBQUM7WUFDckUsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBRTFCLElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUN6QixJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUMzQixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQy9CLENBQUM7UUFDRixDQUFDO1FBRUQsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQzdDLENBQUM7Q0FDRCxDQUFBO0FBN0NZLG1CQUFtQjtJQU03QixXQUFBLFdBQVcsQ0FBQTtHQU5ELG1CQUFtQixDQTZDL0IifQ==