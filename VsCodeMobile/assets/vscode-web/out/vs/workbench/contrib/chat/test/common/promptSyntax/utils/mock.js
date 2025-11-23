/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { assert } from '../../../../../../../base/common/assert.js';
import { isOneOf } from '../../../../../../../base/common/types.js';
/**
 * Mocks an `TObject` with the provided `overrides`.
 *
 * If you need to mock an `Service`, please use {@link mockService}
 * instead which provides better type safety guarantees for the case.
 *
 * @throws Reading non-overridden property or function on `TObject` throws an error.
 */
export function mockObject(overrides) {
    // ensure that the overrides object cannot be modified afterward
    overrides = Object.freeze(overrides);
    const keys = [];
    for (const key in overrides) {
        if (Object.hasOwn(overrides, key)) {
            keys.push(key);
        }
    }
    const mocked = new Proxy({}, {
        get: (_target, key) => {
            assert(isOneOf(key, keys), `The '${key}' is not mocked.`);
            // note! it's ok to type assert here, because of the explicit runtime
            //       assertion  above
            return overrides[key];
        },
    });
    // note! it's ok to type assert here, because of the runtime checks in
    //       the `Proxy` getter
    return mocked;
}
/**
 * Mocks provided service with the provided `overrides`.
 * Same as more generic {@link mockObject} utility, but with
 * the service constraint on the `TService` type.
 *
 * @throws Reading non-overridden property or function
 * 		   on `TService` throws an error.
 */
export function mockService(overrides) {
    return mockObject(overrides);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9jay5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3Byb21wdFN5bnRheC91dGlscy9tb2NrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFJcEU7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxVQUFVLENBQ3pCLFNBQTJCO0lBRTNCLGdFQUFnRTtJQUNoRSxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUVyQyxNQUFNLElBQUksR0FBK0IsRUFBRSxDQUFDO0lBQzVDLEtBQUssTUFBTSxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7UUFDN0IsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ25DLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDaEIsQ0FBQztJQUNGLENBQUM7SUFFRCxNQUFNLE1BQU0sR0FBVyxJQUFJLEtBQUssQ0FDL0IsRUFBRSxFQUNGO1FBQ0MsR0FBRyxFQUFFLENBQ0osT0FBZ0IsRUFDaEIsR0FBNkIsRUFDaEIsRUFBRTtZQUNmLE1BQU0sQ0FDTCxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUNsQixRQUFRLEdBQUcsa0JBQWtCLENBQzdCLENBQUM7WUFFRixxRUFBcUU7WUFDckUseUJBQXlCO1lBQ3pCLE9BQU8sU0FBUyxDQUFDLEdBQVEsQ0FBZSxDQUFDO1FBQzFDLENBQUM7S0FDRCxDQUFDLENBQUM7SUFFSixzRUFBc0U7SUFDdEUsMkJBQTJCO0lBQzNCLE9BQU8sTUFBaUIsQ0FBQztBQUMxQixDQUFDO0FBU0Q7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxXQUFXLENBQzFCLFNBQTRCO0lBRTVCLE9BQU8sVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQzlCLENBQUMifQ==