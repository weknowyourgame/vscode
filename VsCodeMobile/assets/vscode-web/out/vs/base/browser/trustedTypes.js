/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { onUnexpectedError } from '../common/errors.js';
import { getMonacoEnvironment } from './browser.js';
export function createTrustedTypesPolicy(policyName, policyOptions) {
    const monacoEnvironment = getMonacoEnvironment();
    if (monacoEnvironment?.createTrustedTypesPolicy) {
        try {
            return monacoEnvironment.createTrustedTypesPolicy(policyName, policyOptions);
        }
        catch (err) {
            onUnexpectedError(err);
            return undefined;
        }
    }
    try {
        // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
        return globalThis.trustedTypes?.createPolicy(policyName, policyOptions);
    }
    catch (err) {
        onUnexpectedError(err);
        return undefined;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJ1c3RlZFR5cGVzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvYnJvd3Nlci90cnVzdGVkVHlwZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDeEQsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sY0FBYyxDQUFDO0FBSXBELE1BQU0sVUFBVSx3QkFBd0IsQ0FDdkMsVUFBa0IsRUFDbEIsYUFBdUI7SUFHdkIsTUFBTSxpQkFBaUIsR0FBRyxvQkFBb0IsRUFBRSxDQUFDO0lBRWpELElBQUksaUJBQWlCLEVBQUUsd0JBQXdCLEVBQUUsQ0FBQztRQUNqRCxJQUFJLENBQUM7WUFDSixPQUFPLGlCQUFpQixDQUFDLHdCQUF3QixDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsQ0FBQztRQUM5RSxDQUFDO1FBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztZQUNkLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3ZCLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7SUFDRixDQUFDO0lBQ0QsSUFBSSxDQUFDO1FBQ0osdUZBQXVGO1FBQ3ZGLE9BQVEsVUFBa0IsQ0FBQyxZQUFZLEVBQUUsWUFBWSxDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUNsRixDQUFDO0lBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUNkLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7QUFDRixDQUFDIn0=