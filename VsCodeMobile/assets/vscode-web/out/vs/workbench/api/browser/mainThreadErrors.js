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
import { onUnexpectedError, transformErrorFromSerialization } from '../../../base/common/errors.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { MainContext } from '../common/extHost.protocol.js';
let MainThreadErrors = class MainThreadErrors {
    dispose() {
        //
    }
    $onUnexpectedError(err) {
        if (err?.$isError) {
            err = transformErrorFromSerialization(err);
        }
        onUnexpectedError(err);
    }
};
MainThreadErrors = __decorate([
    extHostNamedCustomer(MainContext.MainThreadErrors)
], MainThreadErrors);
export { MainThreadErrors };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZEVycm9ycy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZEVycm9ycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7OztBQUVoRyxPQUFPLEVBQW1CLGlCQUFpQixFQUFFLCtCQUErQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckgsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDNUYsT0FBTyxFQUFFLFdBQVcsRUFBeUIsTUFBTSwrQkFBK0IsQ0FBQztBQUc1RSxJQUFNLGdCQUFnQixHQUF0QixNQUFNLGdCQUFnQjtJQUU1QixPQUFPO1FBQ04sRUFBRTtJQUNILENBQUM7SUFFRCxrQkFBa0IsQ0FBQyxHQUE4QjtRQUNoRCxJQUFLLEdBQW1DLEVBQUUsUUFBUSxFQUFFLENBQUM7WUFDcEQsR0FBRyxHQUFHLCtCQUErQixDQUFDLEdBQXNCLENBQUMsQ0FBQztRQUMvRCxDQUFDO1FBQ0QsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDeEIsQ0FBQztDQUNELENBQUE7QUFaWSxnQkFBZ0I7SUFENUIsb0JBQW9CLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDO0dBQ3RDLGdCQUFnQixDQVk1QiJ9