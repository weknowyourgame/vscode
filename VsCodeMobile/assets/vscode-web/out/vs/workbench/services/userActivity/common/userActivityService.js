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
import { disposableTimeout, RunOnceScheduler, runWhenGlobalIdle } from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService, createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { userActivityRegistry } from './userActivityRegistry.js';
const MARK_INACTIVE_DEBOUNCE = 10_000;
export const IUserActivityService = createDecorator('IUserActivityService');
let UserActivityService = class UserActivityService extends Disposable {
    constructor(instantiationService) {
        super();
        this.markInactive = this._register(new RunOnceScheduler(() => {
            this.isActive = false;
            this.changeEmitter.fire(false);
        }, MARK_INACTIVE_DEBOUNCE));
        this.changeEmitter = this._register(new Emitter);
        this.active = 0;
        /**
         * @inheritdoc
         *
         * Note: initialized to true, since the user just did something to open the
         * window. The bundled DomActivityTracker will initially assume activity
         * as well in order to unset this if the window gets abandoned.
         */
        this.isActive = true;
        /** @inheritdoc */
        this.onDidChangeIsActive = this.changeEmitter.event;
        this._register(runWhenGlobalIdle(() => userActivityRegistry.take(this, instantiationService)));
    }
    /** @inheritdoc */
    markActive(opts) {
        if (opts?.extendOnly && !this.isActive) {
            return Disposable.None;
        }
        if (opts?.whenHeldFor) {
            const store = new DisposableStore();
            store.add(disposableTimeout(() => store.add(this.markActive()), opts.whenHeldFor));
            return store;
        }
        if (++this.active === 1) {
            this.isActive = true;
            this.changeEmitter.fire(true);
            this.markInactive.cancel();
        }
        return toDisposable(() => {
            if (--this.active === 0) {
                this.markInactive.schedule();
            }
        });
    }
};
UserActivityService = __decorate([
    __param(0, IInstantiationService)
], UserActivityService);
export { UserActivityService };
registerSingleton(IUserActivityService, UserActivityService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlckFjdGl2aXR5U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvdXNlckFjdGl2aXR5L2NvbW1vbi91c2VyQWN0aXZpdHlTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzFHLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM5RyxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLHFCQUFxQixFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ3BILE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBbUNqRSxNQUFNLHNCQUFzQixHQUFHLE1BQU0sQ0FBQztBQUV0QyxNQUFNLENBQUMsTUFBTSxvQkFBb0IsR0FBRyxlQUFlLENBQXVCLHNCQUFzQixDQUFDLENBQUM7QUFFM0YsSUFBTSxtQkFBbUIsR0FBekIsTUFBTSxtQkFBb0IsU0FBUSxVQUFVO0lBc0JsRCxZQUFtQyxvQkFBMkM7UUFDN0UsS0FBSyxFQUFFLENBQUM7UUFyQlEsaUJBQVksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksZ0JBQWdCLENBQUMsR0FBRyxFQUFFO1lBQ3hFLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1lBQ3RCLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2hDLENBQUMsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDLENBQUM7UUFFWCxrQkFBYSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFnQixDQUFDLENBQUM7UUFDOUQsV0FBTSxHQUFHLENBQUMsQ0FBQztRQUVuQjs7Ozs7O1dBTUc7UUFDSSxhQUFRLEdBQUcsSUFBSSxDQUFDO1FBRXZCLGtCQUFrQjtRQUNULHdCQUFtQixHQUFtQixJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQztRQUl2RSxJQUFJLENBQUMsU0FBUyxDQUFDLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDaEcsQ0FBQztJQUVELGtCQUFrQjtJQUNsQixVQUFVLENBQUMsSUFBeUI7UUFDbkMsSUFBSSxJQUFJLEVBQUUsVUFBVSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3hDLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQztRQUN4QixDQUFDO1FBRUQsSUFBSSxJQUFJLEVBQUUsV0FBVyxFQUFFLENBQUM7WUFDdkIsTUFBTSxLQUFLLEdBQUcsSUFBSSxlQUFlLEVBQUUsQ0FBQztZQUNwQyxLQUFLLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFDbkYsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBRUQsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7WUFDckIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDOUIsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUM1QixDQUFDO1FBRUQsT0FBTyxZQUFZLENBQUMsR0FBRyxFQUFFO1lBQ3hCLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUN6QixJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQzlCLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7Q0FDRCxDQUFBO0FBbkRZLG1CQUFtQjtJQXNCbEIsV0FBQSxxQkFBcUIsQ0FBQTtHQXRCdEIsbUJBQW1CLENBbUQvQjs7QUFFRCxpQkFBaUIsQ0FBQyxvQkFBb0IsRUFBRSxtQkFBbUIsb0NBQTRCLENBQUMifQ==