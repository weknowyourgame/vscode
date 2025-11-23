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
import { SequencerByKey } from '../../../base/common/async.js';
import { IEncryptionService } from '../../encryption/common/encryptionService.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { IStorageService, InMemoryStorageService } from '../../storage/common/storage.js';
import { Emitter } from '../../../base/common/event.js';
import { ILogService } from '../../log/common/log.js';
import { Disposable, DisposableStore } from '../../../base/common/lifecycle.js';
import { Lazy } from '../../../base/common/lazy.js';
export const ISecretStorageService = createDecorator('secretStorageService');
let BaseSecretStorageService = class BaseSecretStorageService extends Disposable {
    constructor(_useInMemoryStorage, _storageService, _encryptionService, _logService) {
        super();
        this._useInMemoryStorage = _useInMemoryStorage;
        this._storageService = _storageService;
        this._encryptionService = _encryptionService;
        this._logService = _logService;
        this._storagePrefix = 'secret://';
        this.onDidChangeSecretEmitter = this._register(new Emitter());
        this.onDidChangeSecret = this.onDidChangeSecretEmitter.event;
        this._sequencer = new SequencerByKey();
        this._type = 'unknown';
        this._onDidChangeValueDisposable = this._register(new DisposableStore());
        this._lazyStorageService = new Lazy(() => this.initialize());
    }
    /**
     * @Note initialize must be called first so that this can be resolved properly
     * otherwise it will return 'unknown'.
     */
    get type() {
        return this._type;
    }
    get resolvedStorageService() {
        return this._lazyStorageService.value;
    }
    get(key) {
        return this._sequencer.queue(key, async () => {
            const storageService = await this.resolvedStorageService;
            const fullKey = this.getKey(key);
            this._logService.trace('[secrets] getting secret for key:', fullKey);
            const encrypted = storageService.get(fullKey, -1 /* StorageScope.APPLICATION */);
            if (!encrypted) {
                this._logService.trace('[secrets] no secret found for key:', fullKey);
                return undefined;
            }
            try {
                this._logService.trace('[secrets] decrypting gotten secret for key:', fullKey);
                // If the storage service is in-memory, we don't need to decrypt
                const result = this._type === 'in-memory'
                    ? encrypted
                    : await this._encryptionService.decrypt(encrypted);
                this._logService.trace('[secrets] decrypted secret for key:', fullKey);
                return result;
            }
            catch (e) {
                this._logService.error(e);
                this.delete(key);
                return undefined;
            }
        });
    }
    set(key, value) {
        return this._sequencer.queue(key, async () => {
            const storageService = await this.resolvedStorageService;
            this._logService.trace('[secrets] encrypting secret for key:', key);
            let encrypted;
            try {
                // If the storage service is in-memory, we don't need to encrypt
                encrypted = this._type === 'in-memory'
                    ? value
                    : await this._encryptionService.encrypt(value);
            }
            catch (e) {
                this._logService.error(e);
                throw e;
            }
            const fullKey = this.getKey(key);
            this._logService.trace('[secrets] storing encrypted secret for key:', fullKey);
            storageService.store(fullKey, encrypted, -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
            this._logService.trace('[secrets] stored encrypted secret for key:', fullKey);
        });
    }
    delete(key) {
        return this._sequencer.queue(key, async () => {
            const storageService = await this.resolvedStorageService;
            const fullKey = this.getKey(key);
            this._logService.trace('[secrets] deleting secret for key:', fullKey);
            storageService.remove(fullKey, -1 /* StorageScope.APPLICATION */);
            this._logService.trace('[secrets] deleted secret for key:', fullKey);
        });
    }
    keys() {
        return this._sequencer.queue('__keys__', async () => {
            const storageService = await this.resolvedStorageService;
            this._logService.trace('[secrets] fetching keys of all secrets');
            const allKeys = storageService.keys(-1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
            this._logService.trace('[secrets] fetched keys of all secrets');
            return allKeys.filter(key => key.startsWith(this._storagePrefix)).map(key => key.slice(this._storagePrefix.length));
        });
    }
    async initialize() {
        let storageService;
        if (!this._useInMemoryStorage && await this._encryptionService.isEncryptionAvailable()) {
            this._logService.trace(`[SecretStorageService] Encryption is available, using persisted storage`);
            this._type = 'persisted';
            storageService = this._storageService;
        }
        else {
            // If we already have an in-memory storage service, we don't need to recreate it
            if (this._type === 'in-memory') {
                return this._storageService;
            }
            this._logService.trace('[SecretStorageService] Encryption is not available, falling back to in-memory storage');
            this._type = 'in-memory';
            storageService = this._register(new InMemoryStorageService());
        }
        this._onDidChangeValueDisposable.clear();
        this._onDidChangeValueDisposable.add(storageService.onDidChangeValue(-1 /* StorageScope.APPLICATION */, undefined, this._onDidChangeValueDisposable)(e => {
            this.onDidChangeValue(e.key);
        }));
        return storageService;
    }
    reinitialize() {
        this._lazyStorageService = new Lazy(() => this.initialize());
    }
    onDidChangeValue(key) {
        if (!key.startsWith(this._storagePrefix)) {
            return;
        }
        const secretKey = key.slice(this._storagePrefix.length);
        this._logService.trace(`[SecretStorageService] Notifying change in value for secret: ${secretKey}`);
        this.onDidChangeSecretEmitter.fire(secretKey);
    }
    getKey(key) {
        return `${this._storagePrefix}${key}`;
    }
};
BaseSecretStorageService = __decorate([
    __param(1, IStorageService),
    __param(2, IEncryptionService),
    __param(3, ILogService)
], BaseSecretStorageService);
export { BaseSecretStorageService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VjcmV0cy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9zZWNyZXRzL2NvbW1vbi9zZWNyZXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNsRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDOUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxzQkFBc0IsRUFBK0IsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2SCxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ3RELE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEYsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRXBELE1BQU0sQ0FBQyxNQUFNLHFCQUFxQixHQUFHLGVBQWUsQ0FBd0Isc0JBQXNCLENBQUMsQ0FBQztBQWU3RixJQUFNLHdCQUF3QixHQUE5QixNQUFNLHdCQUF5QixTQUFRLFVBQVU7SUFjdkQsWUFDa0IsbUJBQTRCLEVBQzVCLGVBQXdDLEVBQ3JDLGtCQUFnRCxFQUN2RCxXQUEyQztRQUV4RCxLQUFLLEVBQUUsQ0FBQztRQUxTLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBUztRQUNwQixvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUFDM0IsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFvQjtRQUNwQyxnQkFBVyxHQUFYLFdBQVcsQ0FBYTtRQWZ4QyxtQkFBYyxHQUFHLFdBQVcsQ0FBQztRQUUzQiw2QkFBd0IsR0FBRyxJQUFJLENB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