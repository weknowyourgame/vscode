/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { onUnexpectedError } from './commonFacade/deps.js';
/**
 * This function is used to indicate that the caller recovered from an error that indicates a bug.
*/
export function handleBugIndicatingErrorRecovery(message) {
    const err = new Error('BugIndicatingErrorRecovery: ' + message);
    onUnexpectedError(err);
    console.error('recovered from an error that indicates a bug', err);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQW1CLGlCQUFpQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUEySzVFOztFQUVFO0FBQ0YsTUFBTSxVQUFVLGdDQUFnQyxDQUFDLE9BQWU7SUFDL0QsTUFBTSxHQUFHLEdBQUcsSUFBSSxLQUFLLENBQUMsOEJBQThCLEdBQUcsT0FBTyxDQUFDLENBQUM7SUFDaEUsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDdkIsT0FBTyxDQUFDLEtBQUssQ0FBQyw4Q0FBOEMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNwRSxDQUFDIn0=