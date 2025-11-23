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
import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { MutableObservableValue } from './observableValue.js';
import { StoredValue } from './storedValue.js';
let TestExclusions = class TestExclusions extends Disposable {
    constructor(storageService) {
        super();
        this.storageService = storageService;
        this.excluded = this._register(MutableObservableValue.stored(new StoredValue({
            key: 'excludedTestItems',
            scope: 1 /* StorageScope.WORKSPACE */,
            target: 1 /* StorageTarget.MACHINE */,
            serialization: {
                deserialize: v => new Set(JSON.parse(v)),
                serialize: v => JSON.stringify([...v])
            },
        }, this.storageService), new Set()));
        this.onTestExclusionsChanged = this.excluded.onDidChange;
    }
    /**
     * Gets whether there's any excluded tests.
     */
    get hasAny() {
        return this.excluded.value.size > 0;
    }
    /**
     * Gets all excluded tests.
     */
    get all() {
        return this.excluded.value;
    }
    /**
     * Sets whether a test is excluded.
     */
    toggle(test, exclude) {
        if (exclude !== true && this.excluded.value.has(test.item.extId)) {
            this.excluded.value = new Set(Iterable.filter(this.excluded.value, e => e !== test.item.extId));
        }
        else if (exclude !== false && !this.excluded.value.has(test.item.extId)) {
            this.excluded.value = new Set([...this.excluded.value, test.item.extId]);
        }
    }
    /**
     * Gets whether a test is excluded.
     */
    contains(test) {
        return this.excluded.value.has(test.item.extId);
    }
    /**
     * Removes all test exclusions.
     */
    clear() {
        this.excluded.value = new Set();
    }
};
TestExclusions = __decorate([
    __param(0, IStorageService)
], TestExclusions);
export { TestExclusions };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdEV4Y2x1c2lvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVzdGluZy9jb21tb24vdGVzdEV4Y2x1c2lvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsZUFBZSxFQUErQixNQUFNLGdEQUFnRCxDQUFDO0FBQzlHLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQzlELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUd4QyxJQUFNLGNBQWMsR0FBcEIsTUFBTSxjQUFlLFNBQVEsVUFBVTtJQUc3QyxZQUE4QyxjQUErQjtRQUM1RSxLQUFLLEVBQUUsQ0FBQztRQURxQyxtQkFBYyxHQUFkLGNBQWMsQ0FBaUI7UUFFNUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUM3QixzQkFBc0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxXQUFXLENBQXNCO1lBQ2xFLEdBQUcsRUFBRSxtQkFBbUI7WUFDeEIsS0FBSyxnQ0FBd0I7WUFDN0IsTUFBTSwrQkFBdUI7WUFDN0IsYUFBYSxFQUFFO2dCQUNkLFdBQVcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hDLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2FBQ3RDO1NBQ0QsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLEVBQUUsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUNuQyxDQUFDO1FBQ0YsSUFBSSxDQUFDLHVCQUF1QixHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDO0lBQzFELENBQUM7SUFPRDs7T0FFRztJQUNILElBQVcsTUFBTTtRQUNoQixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBVyxHQUFHO1FBQ2IsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQztJQUM1QixDQUFDO0lBRUQ7O09BRUc7SUFDSSxNQUFNLENBQUMsSUFBc0IsRUFBRSxPQUFpQjtRQUN0RCxJQUFJLE9BQU8sS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNsRSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUNqRyxDQUFDO2FBQU0sSUFBSSxPQUFPLEtBQUssS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUMzRSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQzFFLENBQUM7SUFDRixDQUFDO0lBRUQ7O09BRUc7SUFDSSxRQUFRLENBQUMsSUFBc0I7UUFDckMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxLQUFLO1FBQ1gsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUNqQyxDQUFDO0NBQ0QsQ0FBQTtBQTlEWSxjQUFjO0lBR2IsV0FBQSxlQUFlLENBQUE7R0FIaEIsY0FBYyxDQThEMUIifQ==