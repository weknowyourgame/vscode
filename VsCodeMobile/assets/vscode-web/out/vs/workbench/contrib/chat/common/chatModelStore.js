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
import { ReferenceCollection } from '../../../../base/common/lifecycle.js';
import { ObservableMap } from '../../../../base/common/observable.js';
import { ILogService } from '../../../../platform/log/common/log.js';
let ChatModelStore = class ChatModelStore extends ReferenceCollection {
    constructor(delegate, logService) {
        super();
        this.delegate = delegate;
        this.logService = logService;
        this._models = new ObservableMap();
        this._modelsToDispose = new Set();
        this._pendingDisposals = new Set();
    }
    get observable() {
        return this._models.observable;
    }
    values() {
        return this._models.values();
    }
    /**
     * Get a ChatModel directly without acquiring a reference.
     */
    get(uri) {
        return this._models.get(this.toKey(uri));
    }
    has(uri) {
        return this._models.has(this.toKey(uri));
    }
    acquireExisting(uri) {
        const key = this.toKey(uri);
        if (!this._models.has(key)) {
            return undefined;
        }
        return this.acquire(key);
    }
    acquireOrCreate(props) {
        return this.acquire(this.toKey(props.sessionResource), props);
    }
    createReferencedObject(key, props) {
        this._modelsToDispose.delete(key);
        const existingModel = this._models.get(key);
        if (existingModel) {
            return existingModel;
        }
        if (!props) {
            throw new Error(`No start session props provided for chat session ${key}`);
        }
        this.logService.trace(`Creating chat session ${key}`);
        const model = this.delegate.createModel(props);
        if (model.sessionResource.toString() !== key) {
            throw new Error(`Chat session key mismatch for ${key}`);
        }
        this._models.set(key, model);
        return model;
    }
    destroyReferencedObject(key, object) {
        this._modelsToDispose.add(key);
        const promise = this.doDestroyReferencedObject(key, object);
        this._pendingDisposals.add(promise);
        promise.finally(() => {
            this._pendingDisposals.delete(promise);
        });
    }
    async doDestroyReferencedObject(key, object) {
        try {
            await this.delegate.willDisposeModel(object);
        }
        catch (error) {
            this.logService.error(error);
        }
        finally {
            if (this._modelsToDispose.has(key)) {
                this.logService.trace(`Disposing chat session ${key}`);
                this._models.delete(key);
                object.dispose();
            }
            this._modelsToDispose.delete(key);
        }
    }
    /**
     * For test use only
     */
    async waitForModelDisposals() {
        await Promise.all(this._pendingDisposals);
    }
    toKey(uri) {
        return uri.toString();
    }
    dispose() {
        this._models.forEach(model => model.dispose());
    }
};
ChatModelStore = __decorate([
    __param(1, ILogService)
], ChatModelStore);
export { ChatModelStore };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1vZGVsU3RvcmUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vY2hhdE1vZGVsU3RvcmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUEyQixtQkFBbUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUV0RSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFvQjlELElBQU0sY0FBYyxHQUFwQixNQUFNLGNBQWUsU0FBUSxtQkFBOEI7SUFLakUsWUFDa0IsUUFBZ0MsRUFDcEMsVUFBd0M7UUFFckQsS0FBSyxFQUFFLENBQUM7UUFIUyxhQUFRLEdBQVIsUUFBUSxDQUF3QjtRQUNuQixlQUFVLEdBQVYsVUFBVSxDQUFhO1FBTnJDLFlBQU8sR0FBRyxJQUFJLGFBQWEsRUFBcUIsQ0FBQztRQUNqRCxxQkFBZ0IsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO1FBQ3JDLHNCQUFpQixHQUFHLElBQUksR0FBRyxFQUFpQixDQUFDO0lBTzlELENBQUM7SUFFRCxJQUFXLFVBQVU7UUFDcEIsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQztJQUNoQyxDQUFDO0lBRU0sTUFBTTtRQUNaLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUM5QixDQUFDO0lBRUQ7O09BRUc7SUFDSSxHQUFHLENBQUMsR0FBUTtRQUNsQixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRU0sR0FBRyxDQUFDLEdBQVE7UUFDbEIsT0FBTyxJQUFJLENBQUMs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