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
import { Disposable } from '../../../base/common/lifecycle.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { SequencerByKey } from '../../../base/common/async.js';
import { ISecretStorageService } from '../../../platform/secrets/common/secrets.js';
import { IBrowserWorkbenchEnvironmentService } from '../../services/environment/browser/environmentService.js';
let MainThreadSecretState = class MainThreadSecretState extends Disposable {
    constructor(extHostContext, secretStorageService, logService, environmentService) {
        super();
        this.secretStorageService = secretStorageService;
        this.logService = logService;
        this._sequencer = new SequencerByKey();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostSecretState);
        this._register(this.secretStorageService.onDidChangeSecret((e) => {
            const parsedKey = this.parseKey(e);
            if (parsedKey) {
                this._proxy.$onDidChangePassword(parsedKey);
            }
        }));
    }
    $getPassword(extensionId, key) {
        this.logService.trace(`[mainThreadSecretState] Getting password for ${extensionId} extension: `, key);
        return this._sequencer.queue(extensionId, () => this.doGetPassword(extensionId, key));
    }
    async doGetPassword(extensionId, key) {
        const fullKey = this.getKey(extensionId, key);
        const password = await this.secretStorageService.get(fullKey);
        this.logService.trace(`[mainThreadSecretState] ${password ? 'P' : 'No p'}assword found for: `, extensionId, key);
        return password;
    }
    $setPassword(extensionId, key, value) {
        this.logService.trace(`[mainThreadSecretState] Setting password for ${extensionId} extension: `, key);
        return this._sequencer.queue(extensionId, () => this.doSetPassword(extensionId, key, value));
    }
    async doSetPassword(extensionId, key, value) {
        const fullKey = this.getKey(extensionId, key);
        await this.secretStorageService.set(fullKey, value);
        this.logService.trace('[mainThreadSecretState] Password set for: ', extensionId, key);
    }
    $deletePassword(extensionId, key) {
        this.logService.trace(`[mainThreadSecretState] Deleting password for ${extensionId} extension: `, key);
        return this._sequencer.queue(extensionId, () => this.doDeletePassword(extensionId, key));
    }
    async doDeletePassword(extensionId, key) {
        const fullKey = this.getKey(extensionId, key);
        await this.secretStorageService.delete(fullKey);
        this.logService.trace('[mainThreadSecretState] Password deleted for: ', extensionId, key);
    }
    $getKeys(extensionId) {
        this.logService.trace(`[mainThreadSecretState] Getting keys for ${extensionId} extension: `);
        return this._sequencer.queue(extensionId, () => this.doGetKeys(extensionId));
    }
    async doGetKeys(extensionId) {
        if (!this.secretStorageService.keys) {
            throw new Error('Secret storage service does not support keys() method');
        }
        const allKeys = await this.secretStorageService.keys();
        const keys = allKeys
            .map(key => this.parseKey(key))
            .filter((parsedKey) => parsedKey !== undefined && parsedKey.extensionId === extensionId)
            .map(({ key }) => key); // Return only my keys
        this.logService.trace(`[mainThreadSecretState] Got ${keys.length}key(s) for: `, extensionId);
        return keys;
    }
    getKey(extensionId, key) {
        return JSON.stringify({ extensionId, key });
    }
    parseKey(key) {
        try {
            return JSON.parse(key);
        }
        catch {
            return undefined;
        }
    }
};
MainThreadSecretState = __decorate([
    extHostNamedCustomer(MainContext.MainThreadSecretState),
    __param(1, ISecretStorageService),
    __param(2, ILogService),
    __param(3, IBrowserWorkbenchEnvironmentService)
], MainThreadSecretState);
export { MainThreadSecretState };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZFNlY3JldFN0YXRlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvYnJvd3Nlci9tYWluVGhyZWFkU2VjcmV0U3RhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxvQkFBb0IsRUFBbUIsTUFBTSxzREFBc0QsQ0FBQztBQUM3RyxPQUFPLEVBQUUsY0FBYyxFQUEyQixXQUFXLEVBQThCLE1BQU0sK0JBQStCLENBQUM7QUFDakksT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUNwRixPQUFPLEVBQUUsbUNBQW1DLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUd4RyxJQUFNLHFCQUFxQixHQUEzQixNQUFNLHFCQUFzQixTQUFRLFVBQVU7SUFLcEQsWUFDQyxjQUErQixFQUNSLG9CQUE0RCxFQUN0RSxVQUF3QyxFQUNoQixrQkFBdUQ7UUFFNUYsS0FBSyxFQUFFLENBQUM7UUFKZ0MseUJBQW9CLEdBQXBCLG9CQUFvQixDQUF1QjtRQUNyRCxlQUFVLEdBQVYsVUFBVSxDQUFhO1FBTHJDLGVBQVUsR0FBRyxJQUFJLGNBQWMsRUFBVSxDQUFDO1FBVTFELElBQUksQ0FBQyxNQUFNLEdBQUcsY0FBYyxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUV6RSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQVMsRUFBRSxFQUFFO1lBQ3hFLE1B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