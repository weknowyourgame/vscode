/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var LazyValueState;
(function (LazyValueState) {
    LazyValueState[LazyValueState["Uninitialized"] = 0] = "Uninitialized";
    LazyValueState[LazyValueState["Running"] = 1] = "Running";
    LazyValueState[LazyValueState["Completed"] = 2] = "Completed";
})(LazyValueState || (LazyValueState = {}));
export class Lazy {
    constructor(executor) {
        this.executor = executor;
        this._state = LazyValueState.Uninitialized;
    }
    /**
     * True if the lazy value has been resolved.
     */
    get hasValue() { return this._state === LazyValueState.Completed; }
    /**
     * Get the wrapped value.
     *
     * This will force evaluation of the lazy value if it has not been resolved yet. Lazy values are only
     * resolved once. `getValue` will re-throw exceptions that are hit while resolving the value
     */
    get value() {
        if (this._state === LazyValueState.Uninitialized) {
            this._state = LazyValueState.Running;
            try {
                this._value = this.executor();
            }
            catch (err) {
                this._error = err;
            }
            finally {
                this._state = LazyValueState.Completed;
            }
        }
        else if (this._state === LazyValueState.Running) {
            throw new Error('Cannot read the value of a lazy that is being initialized');
        }
        if (this._error) {
            throw this._error;
        }
        return this._value;
    }
    /**
     * Get the wrapped value without forcing evaluation.
     */
    get rawValue() { return this._value; }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF6eS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi9sYXp5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLElBQUssY0FJSjtBQUpELFdBQUssY0FBYztJQUNsQixxRUFBYSxDQUFBO0lBQ2IseURBQU8sQ0FBQTtJQUNQLDZEQUFTLENBQUE7QUFDVixDQUFDLEVBSkksY0FBYyxLQUFkLGNBQWMsUUFJbEI7QUFFRCxNQUFNLE9BQU8sSUFBSTtJQU1oQixZQUNrQixRQUFpQjtRQUFqQixhQUFRLEdBQVIsUUFBUSxDQUFTO1FBTDNCLFdBQU0sR0FBRyxjQUFjLENBQUMsYUFBYSxDQUFDO0lBTTFDLENBQUM7SUFFTDs7T0FFRztJQUNILElBQUksUUFBUSxLQUFjLE9BQU8sSUFBSSxDQUFDLE1BQU0sS0FBSyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztJQUU1RTs7Ozs7T0FLRztJQUNILElBQUksS0FBSztRQUNSLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxjQUFjLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDbEQsSUFBSSxDQUFDLE1BQU0sR0FBRyxjQUFjLENBQUMsT0FBTyxDQUFDO1lBQ3JDLElBQUksQ0FBQztnQkFDSixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUMvQixDQUFDO1lBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztnQkFDZCxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQztZQUNuQixDQUFDO29CQUFTLENBQUM7Z0JBQ1YsSUFBSSxDQUFDLE1BQU0sR0FBRyxjQUFjLENBQUMsU0FBUyxDQUFDO1lBQ3hDLENBQUM7UUFDRixDQUFDO2FBQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLGNBQWMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNuRCxNQUFNLElBQUksS0FBSyxDQUFDLDJEQUEyRCxDQUFDLENBQUM7UUFDOUUsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2pCLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUNuQixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsTUFBTyxDQUFDO0lBQ3JCLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksUUFBUSxLQUFvQixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0NBQ3JEIn0=