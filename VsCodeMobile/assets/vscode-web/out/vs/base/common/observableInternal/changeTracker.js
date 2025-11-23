/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BugIndicatingError } from './commonFacade/deps.js';
/**
 * Subscribes to and records changes and the last value of the given observables.
 * Don't use the key "changes", as it is reserved for the changes array!
*/
export function recordChanges(obs) {
    return {
        createChangeSummary: (_previousChangeSummary) => {
            // eslint-disable-next-line local/code-no-any-casts
            return {
                changes: [],
            };
        },
        handleChange(ctx, changeSummary) {
            for (const key in obs) {
                if (ctx.didChange(obs[key])) {
                    // eslint-disable-next-line local/code-no-any-casts
                    changeSummary.changes.push({ key, change: ctx.change });
                }
            }
            return true;
        },
        beforeUpdate(reader, changeSummary) {
            for (const key in obs) {
                if (key === 'changes') {
                    throw new BugIndicatingError('property name "changes" is reserved for change tracking');
                }
                changeSummary[key] = obs[key].read(reader);
            }
        }
    };
}
/**
 * Subscribes to and records changes and the last value of the given observables.
 * Don't use the key "changes", as it is reserved for the changes array!
*/
export function recordChangesLazy(getObs) {
    let obs = undefined;
    return {
        createChangeSummary: (_previousChangeSummary) => {
            // eslint-disable-next-line local/code-no-any-casts
            return {
                changes: [],
            };
        },
        handleChange(ctx, changeSummary) {
            if (!obs) {
                obs = getObs();
            }
            for (const key in obs) {
                if (ctx.didChange(obs[key])) {
                    // eslint-disable-next-line local/code-no-any-casts
                    changeSummary.changes.push({ key, change: ctx.change });
                }
            }
            return true;
        },
        beforeUpdate(reader, changeSummary) {
            if (!obs) {
                obs = getObs();
            }
            for (const key in obs) {
                if (key === 'changes') {
                    throw new BugIndicatingError('property name "changes" is reserved for change tracking');
                }
                changeSummary[key] = obs[key].read(reader);
            }
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhbmdlVHJhY2tlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvY2hhbmdlVHJhY2tlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQW1CNUQ7OztFQUdFO0FBQ0YsTUFBTSxVQUFVLGFBQWEsQ0FBNEQsR0FBUztJQUdqRyxPQUFPO1FBQ04sbUJBQW1CLEVBQUUsQ0FBQyxzQkFBc0IsRUFBRSxFQUFFO1lBQy9DLG1EQUFtRDtZQUNuRCxPQUFPO2dCQUNOLE9BQU8sRUFBRSxFQUFFO2FBQ0osQ0FBQztRQUNWLENBQUM7UUFDRCxZQUFZLENBQUMsR0FBRyxFQUFFLGFBQWE7WUFDOUIsS0FBSyxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDdkIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQzdCLG1EQUFtRDtvQkFDbEQsYUFBYSxDQUFDLE9BQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO2dCQUNsRSxDQUFDO1lBQ0YsQ0FBQztZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUNELFlBQVksQ0FBQyxNQUFNLEVBQUUsYUFBYTtZQUNqQyxLQUFLLE1BQU0sR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO2dCQUN2QixJQUFJLEdBQUcsS0FBSyxTQUFTLEVBQUUsQ0FBQztvQkFDdkIsTUFBTSxJQUFJLGtCQUFrQixDQUFDLHlEQUF5RCxDQUFDLENBQUM7Z0JBQ3pGLENBQUM7Z0JBQ0QsYUFBYSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDNUMsQ0FBQztRQUNGLENBQUM7S0FDRCxDQUFDO0FBQ0gsQ0FBQztBQUVEOzs7RUFHRTtBQUNGLE1BQU0sVUFBVSxpQkFBaUIsQ0FBNEQsTUFBa0I7SUFHOUcsSUFBSSxHQUFHLEdBQXFCLFNBQVMsQ0FBQztJQUN0QyxPQUFPO1FBQ04sbUJBQW1CLEVBQUUsQ0FBQyxzQkFBc0IsRUFBRSxFQUFFO1lBQy9DLG1EQUFtRDtZQUNuRCxPQUFPO2dCQUNOLE9BQU8sRUFBRSxFQUFFO2FBQ0osQ0FBQztRQUNWLENBQUM7UUFDRCxZQUFZLENBQUMsR0FBRyxFQUFFLGFBQWE7WUFDOUIsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNWLEdBQUcsR0FBRyxNQUFNLEVBQUUsQ0FBQztZQUNoQixDQUFDO1lBQ0QsS0FBSyxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDdkIsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQzdCLG1EQUFtRDtvQkFDbEQsYUFBYSxDQUFDLE9BQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO2dCQUNsRSxDQUFDO1lBQ0YsQ0FBQztZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUNELFlBQVksQ0FBQyxNQUFNLEVBQUUsYUFBYTtZQUNqQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ1YsR0FBRyxHQUFHLE1BQU0sRUFBRSxDQUFDO1lBQ2hCLENBQUM7WUFDRCxLQUFLLE1BQU0sR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO2dCQUN2QixJQUFJLEdBQUcsS0FBSyxTQUFTLEVBQUUsQ0FBQztvQkFDdkIsTUFBTSxJQUFJLGtCQUFrQixDQUFDLHlEQUF5RCxDQUFDLENBQUM7Z0JBQ3pGLENBQUM7Z0JBQ0QsYUFBYSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDNUMsQ0FBQztRQUNGLENBQUM7S0FDRCxDQUFDO0FBQ0gsQ0FBQyJ9