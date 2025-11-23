/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../nls.js';
export const collectTestStateCounts = (isRunning, results) => {
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let running = 0;
    let queued = 0;
    for (const result of results) {
        const count = result.counts;
        failed += count[6 /* TestResultState.Errored */] + count[4 /* TestResultState.Failed */];
        passed += count[3 /* TestResultState.Passed */];
        skipped += count[5 /* TestResultState.Skipped */];
        running += count[2 /* TestResultState.Running */];
        queued += count[1 /* TestResultState.Queued */];
    }
    return {
        isRunning,
        passed,
        failed,
        runSoFar: passed + failed,
        totalWillBeRun: passed + failed + queued + running,
        skipped,
    };
};
export const getTestProgressText = ({ isRunning, passed, runSoFar, totalWillBeRun, skipped, failed }) => {
    let percent = passed / runSoFar * 100;
    if (failed > 0) {
        // fix: prevent from rounding to 100 if there's any failed test
        percent = Math.min(percent, 99.9);
    }
    else if (runSoFar === 0) {
        percent = 0;
    }
    if (isRunning) {
        if (runSoFar === 0) {
            return localize('testProgress.runningInitial', 'Running tests...');
        }
        else if (skipped === 0) {
            return localize('testProgress.running', 'Running tests, {0}/{1} passed ({2}%)', passed, totalWillBeRun, percent.toPrecision(3));
        }
        else {
            return localize('testProgressWithSkip.running', 'Running tests, {0}/{1} tests passed ({2}%, {3} skipped)', passed, totalWillBeRun, percent.toPrecision(3), skipped);
        }
    }
    else {
        if (skipped === 0) {
            return localize('testProgress.completed', '{0}/{1} tests passed ({2}%)', passed, runSoFar, percent.toPrecision(3));
        }
        else {
            return localize('testProgressWithSkip.completed', '{0}/{1} tests passed ({2}%, {3} skipped)', passed, runSoFar, percent.toPrecision(3), skipped);
        }
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGluZ1Byb2dyZXNzTWVzc2FnZXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVzdGluZy9jb21tb24vdGVzdGluZ1Byb2dyZXNzTWVzc2FnZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBTTlDLE1BQU0sQ0FBQyxNQUFNLHNCQUFzQixHQUFHLENBQUMsU0FBa0IsRUFBRSxPQUFtQyxFQUFFLEVBQUU7SUFDakcsSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQ2YsSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQ2YsSUFBSSxPQUFPLEdBQUcsQ0FBQyxDQUFDO0lBQ2hCLElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQztJQUNoQixJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFFZixLQUFLLE1BQU0sTUFBTSxJQUFJLE9BQU8sRUFBRSxDQUFDO1FBQzlCLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDNUIsTUFBTSxJQUFJLEtBQUssaUNBQXlCLEdBQUcsS0FBSyxnQ0FBd0IsQ0FBQztRQUN6RSxNQUFNLElBQUksS0FBSyxnQ0FBd0IsQ0FBQztRQUN4QyxPQUFPLElBQUksS0FBSyxpQ0FBeUIsQ0FBQztRQUMxQyxPQUFPLElBQUksS0FBSyxpQ0FBeUIsQ0FBQztRQUMxQyxNQUFNLElBQUksS0FBSyxnQ0FBd0IsQ0FBQztJQUN6QyxDQUFDO0lBRUQsT0FBTztRQUNOLFNBQVM7UUFDVCxNQUFNO1FBQ04sTUFBTTtRQUNOLFFBQVEsRUFBRSxNQUFNLEdBQUcsTUFBTTtRQUN6QixjQUFjLEVBQUUsTUFBTSxHQUFHLE1BQU0sR0FBRyxNQUFNLEdBQUcsT0FBTztRQUNsRCxPQUFPO0tBQ1AsQ0FBQztBQUNILENBQUMsQ0FBQztBQUVGLE1BQU0sQ0FBQyxNQUFNLG1CQUFtQixHQUFHLENBQUMsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBZ0IsRUFBRSxFQUFFO0lBQ3JILElBQUksT0FBTyxHQUFHLE1BQU0sR0FBRyxRQUFRLEdBQUcsR0FBRyxDQUFDO0lBQ3RDLElBQUksTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQ2hCLCtEQUErRDtRQUMvRCxPQUFPLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDbkMsQ0FBQztTQUFNLElBQUksUUFBUSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQzNCLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDYixDQUFDO0lBRUQsSUFBSSxTQUFTLEVBQUUsQ0FBQztRQUNmLElBQUksUUFBUSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3BCLE9BQU8sUUFBUSxDQUFDLDZCQUE2QixFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDcEUsQ0FBQzthQUFNLElBQUksT0FBTyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzFCLE9BQU8sUUFBUSxDQUFDLHNCQUFzQixFQUFFLHNDQUFzQyxFQUFFLE1BQU0sRUFBRSxjQUFjLEVBQUUsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pJLENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxRQUFRLENBQUMsOEJBQThCLEVBQUUseURBQXlELEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3JLLENBQUM7SUFDRixDQUFDO1NBQU0sQ0FBQztRQUNQLElBQUksT0FBTyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ25CLE9BQU8sUUFBUSxDQUFDLHdCQUF3QixFQUFFLDZCQUE2QixFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BILENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxRQUFRLENBQUMsZ0NBQWdDLEVBQUUsMENBQTBDLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2xKLENBQUM7SUFDRixDQUFDO0FBQ0YsQ0FBQyxDQUFDIn0=