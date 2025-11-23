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
import { readHotReloadableExport } from '../../../base/common/hotReloadHelpers.js';
import { autorunWithStore } from '../../../base/common/observable.js';
import { IInstantiationService } from '../../instantiation/common/instantiation.js';
/**
 * Wrap a class in a reloadable wrapper.
 * When the wrapper is created, the original class is created.
 * When the original class changes, the instance is re-created.
*/
export function wrapInReloadableClass0(getClass) {
    return !isHotReloadEnabled() ? getClass() : createWrapper(getClass, BaseClass0);
}
class BaseClass {
    constructor(instantiationService) {
        this.instantiationService = instantiationService;
    }
    init(...params) { }
}
function createWrapper(getClass, B) {
    // eslint-disable-next-line local/code-no-any-casts
    return (class ReloadableWrapper extends B {
        constructor() {
            super(...arguments);
            this._autorun = undefined;
        }
        init(...params) {
            this._autorun = autorunWithStore((reader, store) => {
                const clazz = readHotReloadableExport(getClass(), reader);
                store.add(this.instantiationService.createInstance(clazz, ...params));
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
export function wrapInReloadableClass1(getClass) {
    // eslint-disable-next-line local/code-no-any-casts
    return !isHotReloadEnabled() ? getClass() : createWrapper(getClass, BaseClass1);
}
let BaseClass1 = class BaseClass1 extends BaseClass {
    constructor(param1, i) { super(i); this.init(param1); }
};
BaseClass1 = __decorate([
    __param(1, IInstantiationService)
], BaseClass1);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3JhcEluUmVsb2FkYWJsZUNsYXNzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL29ic2VydmFibGUvY29tbW9uL3dyYXBJblJlbG9hZGFibGVDbGFzcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQTs7O2dHQUdnRztBQUNoRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUVuRixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN0RSxPQUFPLEVBQTRDLHFCQUFxQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFOUg7Ozs7RUFJRTtBQUNGLE1BQU0sVUFBVSxzQkFBc0IsQ0FBaUMsUUFBNkI7SUFDbkcsT0FBTyxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ2pGLENBQUM7QUFJRCxNQUFNLFNBQVM7SUFDZCxZQUNpQixvQkFBMkM7UUFBM0MseUJBQW9CLEdBQXBCLG9CQUFvQixDQUF1QjtJQUN4RCxDQUFDO0lBRUUsSUFBSSxDQUFDLEdBQUcsTUFBYSxJQUFVLENBQUM7Q0FDdkM7QUFFRCxTQUFTLGFBQWEsQ0FBa0IsUUFBbUIsRUFBRSxDQUFnQztJQUM1RixtREFBbUQ7SUFDbkQsT0FBTyxDQUFDLE1BQU0saUJBQWtCLFNBQVEsQ0FBQztRQUFqQzs7WUFDQyxhQUFRLEdBQTRCLFNBQVMsQ0FBQztRQVl2RCxDQUFDO1FBVlMsSUFBSSxDQUFDLEdBQUcsTUFBYTtZQUM3QixJQUFJLENBQUMsUUFBUSxHQUFHLGdCQUFnQixDQUFDLENBQUMsTUFBTSxFQUFFLEtBQUssRUFBRSxFQUFFO2dCQUNsRCxNQUFNLEtBQUssR0FBRyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDMUQsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDdkUsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO1FBRUQsT0FBTztZQUNOLElBQUksQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLENBQUM7UUFDMUIsQ0FBQztLQUNELENBQVEsQ0FBQztBQUNYLENBQUM7QUFFRCxJQUFNLFVBQVUsR0FBaEIsTUFBTSxVQUFXLFNBQVEsU0FBUztJQUNqQyxZQUFtQyxDQUF3QixJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7Q0FDdkYsQ0FBQTtBQUZLLFVBQVU7SUFDRixXQUFBLHFCQUFxQixDQUFBO0dBRDdCLFVBQVUsQ0FFZjtBQUVEOzs7O0VBSUU7QUFDRixNQUFNLFVBQVUsc0JBQXNCLENBQTJDLFFBQTZCO0lBQzdHLG1EQUFtRDtJQUNuRCxPQUFPLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFTLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDeEYsQ0FBQztBQUVELElBQU0sVUFBVSxHQUFoQixNQUFNLFVBQVcsU0FBUSxTQUFTO0lBQ2pDLFlBQVksTUFBVyxFQUF5QixDQUF3QixJQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQzNHLENBQUE7QUFGSyxVQUFVO0lBQ1csV0FBQSxxQkFBcUIsQ0FBQTtHQUQxQyxVQUFVLENBRWYifQ==