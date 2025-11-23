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
import { ILogService } from '../../../../platform/log/common/log.js';
import { AbstractPolicyService } from '../../../../platform/policy/common/policy.js';
import { IDefaultAccountService } from '../../accounts/common/defaultAccount.js';
let AccountPolicyService = class AccountPolicyService extends AbstractPolicyService {
    constructor(logService, defaultAccountService) {
        super();
        this.logService = logService;
        this.defaultAccountService = defaultAccountService;
        this.account = null;
        this.defaultAccountService.getDefaultAccount()
            .then(account => {
            this.account = account;
            this._updatePolicyDefinitions(this.policyDefinitions);
            this._register(this.defaultAccountService.onDidChangeDefaultAccount(account => {
                this.account = account;
                this._updatePolicyDefinitions(this.policyDefinitions);
            }));
        });
    }
    async _updatePolicyDefinitions(policyDefinitions) {
        this.logService.trace(`AccountPolicyService#_updatePolicyDefinitions: Got ${Object.keys(policyDefinitions).length} policy definitions`);
        const updated = [];
        for (const key in policyDefinitions) {
            const policy = policyDefinitions[key];
            const policyValue = this.account && policy.value ? policy.value(this.account) : undefined;
            if (policyValue !== undefined) {
                if (this.policies.get(key) !== policyValue) {
                    this.policies.set(key, policyValue);
                    updated.push(key);
                }
            }
            else {
                if (this.policies.delete(key)) {
                    updated.push(key);
                }
            }
        }
        if (updated.length) {
            this._onDidChange.fire(updated);
        }
    }
};
AccountPolicyService = __decorate([
    __param(0, ILogService),
    __param(1, IDefaultAccountService)
], AccountPolicyService);
export { AccountPolicyService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWNjb3VudFBvbGljeVNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL3BvbGljaWVzL2NvbW1vbi9hY2NvdW50UG9saWN5U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUloRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDckUsT0FBTyxFQUFFLHFCQUFxQixFQUFvQyxNQUFNLDhDQUE4QyxDQUFDO0FBQ3ZILE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRzFFLElBQU0sb0JBQW9CLEdBQTFCLE1BQU0sb0JBQXFCLFNBQVEscUJBQXFCO0lBSTlELFlBQ2MsVUFBd0MsRUFDN0IscUJBQThEO1FBRXRGLEtBQUssRUFBRSxDQUFDO1FBSHNCLGVBQVUsR0FBVixVQUFVLENBQWE7UUFDWiwwQkFBcUIsR0FBckIscUJBQXFCLENBQXdCO1FBSi9FLFlBQU8sR0FBMkIsSUFBSSxDQUFDO1FBUTlDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxpQkFBaUIsRUFBRTthQUM1QyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDZixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztZQUN2QixJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDdEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMseUJBQXlCLENBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQzdFLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO2dCQUN2QixJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDdkQsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVTLEtBQUssQ0FBQyx3QkFBd0IsQ0FBQyxpQkFBc0Q7UUFDOUYsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsc0RBQXNELE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxNQUFNLHFCQUFxQixDQUFDLENBQUM7UUFDeEksTUFBTSxPQUFPLEdBQWEsRUFBRSxDQUFDO1FBRTdCLEtBQUssTUFBTSxHQUFHLElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUNyQyxNQUFNLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN0QyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDMUYsSUFBSSxXQUFXLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQy9CLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssV0FBVyxFQUFFLENBQUM7b0JBQzVDLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxXQUFXLENBQUMsQ0FBQztvQkFDcEMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDbkIsQ0FBQztZQUNGLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQy9CLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ25CLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3BCLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2pDLENBQUM7SUFDRixDQUFDO0NBQ0QsQ0FBQTtBQTVDWSxvQkFBb0I7SUFLOUIsV0FBQSxXQUFXLENBQUE7SUFDWCxXQUFBLHNCQUFzQixDQUFBO0dBTlosb0JBQW9CLENBNENoQyJ9