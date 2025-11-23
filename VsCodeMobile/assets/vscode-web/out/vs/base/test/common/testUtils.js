/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export function flakySuite(title, fn) {
    return suite(title, function () {
        // Flaky suites need retries and timeout to complete
        // e.g. because they access browser features which can
        // be unreliable depending on the environment.
        this.retries(3);
        this.timeout(1000 * 20);
        // Invoke suite ensuring that `this` is
        // properly wired in.
        fn.call(this);
    });
}
/**
 * (pseudo)Random boolean generator.
 *
 * ## Examples
 *
 * ```typescript
 * randomBoolean(); // generates either `true` or `false`
 * ```
 *
 */
export const randomBoolean = () => {
    return Math.random() > 0.5;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdFV0aWxzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvdGVzdC9jb21tb24vdGVzdFV0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE1BQU0sVUFBVSxVQUFVLENBQUMsS0FBYSxFQUFFLEVBQWM7SUFDdkQsT0FBTyxLQUFLLENBQUMsS0FBSyxFQUFFO1FBRW5CLG9EQUFvRDtRQUNwRCxzREFBc0Q7UUFDdEQsOENBQThDO1FBQzlDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFFeEIsdUNBQXVDO1FBQ3ZDLHFCQUFxQjtRQUNyQixFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2YsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQ7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sYUFBYSxHQUFHLEdBQVksRUFBRTtJQUMxQyxPQUFPLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUM7QUFDNUIsQ0FBQyxDQUFDIn0=