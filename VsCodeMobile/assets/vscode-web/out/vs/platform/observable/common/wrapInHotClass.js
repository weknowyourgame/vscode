var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isHotReloadEnabled } from '../../../base/common/hotReload.js';
import { autorunWithStore } from '../../../base/common/observable.js';
import { IInstantiationService } from '../../instantiation/common/instantiation.js';
export function hotClassGetOriginalInstance(value) {
    if (value instanceof BaseClass) {
        // eslint-disable-next-line local/code-no-any-casts
        return value._instance;
    }
    return value;
}
/**
 * Wrap a class in a reloadable wrapper.
 * When the wrapper is created, the original class is created.
 * When the original class changes, the instance is re-created.
*/
export function wrapInHotClass0(clazz) {
    return !isHotReloadEnabled() ? clazz.get() : createWrapper(clazz, BaseClass0);
}
class BaseClass {
    constructor(instantiationService) {
        this.instantiationService = instantiationService;
    }
    init(...params) { }
}
function createWrapper(clazz, B) {
    // eslint-disable-next-line local/code-no-any-casts
    return (class ReloadableWrapper extends B {
        constructor() {
            super(...arguments);
            this._autorun = undefined;
        }
        init(...params) {
            this._autorun = autorunWithStore((reader, store) => {
                const clazz_ = clazz.read(reader);
                this._instance = store.add(this.instantiationService.createInstance(clazz_, ...params));
            });
        }
        dispose() {
            this._autorun?.dispose();
        }
    });
}
let BaseClass0 = class BaseClass0 extends BaseClass {
    constructor(i) { super(i); this.init(); }
};
BaseClass0 = __decorate([
    __param(0, IInstantiationService)
], BaseClass0);
/**
 * Wrap a class in a reloadable wrapper.
 * When the wrapper is created, the original class is created.
 * When the original class changes, the instance is re-created.
*/
export function wrapInHotClass1(clazz) {
    return !isHotReloadEnabled() ? clazz.get() : createWrapper(clazz, BaseClass1);
}
let BaseClass1 = class BaseClass1 extends BaseClass {
    constructor(param1, i) { super(i); this.init(param1); }
};
BaseClass1 = __decorate([
    __param(1, IInstantiationService)
], BaseClass1);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3JhcEluSG90Q2xhc3MuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vb2JzZXJ2YWJsZS9jb21tb24vd3JhcEluSG90Q2xhc3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUE7OztnR0FHZ0c7QUFDaEcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFdkUsT0FBTyxFQUFFLGdCQUFnQixFQUFlLE1BQU0sb0NBQW9DLENBQUM7QUFDbkYsT0FBTyxFQUFrQixxQkFBcUIsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRXBHLE1BQU0sVUFBVSwyQkFBMkIsQ0FBSSxLQUFRO0lBQ3RELElBQUksS0FBSyxZQUFZLFNBQVMsRUFBRSxDQUFDO1FBQ2hDLG1EQUFtRDtRQUNuRCxPQUFPLEtBQUssQ0FBQyxTQUFnQixDQUFDO0lBQy9CLENBQUM7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNkLENBQUM7QUFFRDs7OztFQUlFO0FBQ0YsTUFBTSxVQUFVLGVBQWUsQ0FBaUMsS0FBaUM7SUFDaEcsT0FBTyxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQztBQUMvRSxDQUFDO0FBSUQsTUFBTSxTQUFTO0lBR2QsWUFDaUIsb0JBQTJDO1FBQTNDLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBdUI7SUFDeEQsQ0FBQztJQUVFLElBQUksQ0FBQyxHQUFHLE1BQWEsSUFBVSxDQUFDO0NBQ3ZDO0FBRUQsU0FBUyxhQUFhLENBQWtCLEtBQXVCLEVBQUUsQ0FBZ0M7SUFDaEcsbURBQW1EO0lBQ25ELE9BQU8sQ0FBQyxNQUFNLGlCQUFrQixTQUFRLENBQUM7UUFBakM7O1lBQ0MsYUFBUSxHQUE0QixTQUFTLENBQUM7UUFZdkQsQ0FBQztRQVZTLElBQUksQ0FBQyxHQUFHLE1BQWE7WUFDN0IsSUFBSSxDQUFDLFFBQVEsR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsRUFBRTtnQkFDbEQsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDbEMsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUN6RixDQUFDLENBQUMsQ0FBQztRQUNKLENBQUM7UUFFRCxPQUFPO1lBQ04sSUFBSSxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsQ0FBQztRQUMxQixDQUFDO0tBQ0QsQ0FBUSxDQUFDO0FBQ1gsQ0FBQztBQUVELElBQU0sVUFBVSxHQUFoQixNQUFNLFVBQVcsU0FBUSxTQUFTO0lBQ2pDLFlBQW1DLENBQXdCLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztDQUN2RixDQUFBO0FBRkssVUFBVTtJQUNGLFdBQUEscUJBQXFCLENBQUE7R0FEN0IsVUFBVSxDQUVmO0FBRUQ7Ozs7RUFJRTtBQUNGLE1BQU0sVUFBVSxlQUFlLENBQTJDLEtBQWlDO0lBQzFHLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDL0UsQ0FBQztBQUVELElBQU0sVUFBVSxHQUFoQixNQUFNLFVBQVcsU0FBUSxTQUFTO0lBQ2pDLFlBQVksTUFBVyxFQUF5QixDQUF3QixJQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzNHLENBQUE7QUFGSyxVQUFVO0lBQ1csV0FBQSxxQkFBcUIsQ0FBQTtHQUQxQyxVQUFVLENBRWYifQ==