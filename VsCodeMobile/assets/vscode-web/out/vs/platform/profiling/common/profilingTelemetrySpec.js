/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { errorHandler } from '../../../base/common/errors.js';
export function reportSample(data, telemetryService, logService, sendAsErrorTelemtry) {
    const { sample, perfBaseline, source } = data;
    // send telemetry event
    telemetryService.publicLog2(`unresponsive.sample`, {
        perfBaseline,
        selfTime: sample.selfTime,
        totalTime: sample.totalTime,
        percentage: sample.percentage,
        functionName: sample.location,
        callers: sample.caller.map(c => c.location).join('<'),
        callersAnnotated: sample.caller.map(c => `${c.percentage}|${c.location}`).join('<'),
        source
    });
    // log a fake error with a clearer stack
    const fakeError = new PerformanceError(data);
    if (sendAsErrorTelemtry) {
        errorHandler.onUnexpectedError(fakeError);
    }
    else {
        logService.error(fakeError);
    }
}
class PerformanceError extends Error {
    constructor(data) {
        // Since the stacks are available via the sample
        // we can avoid collecting them when constructing the error.
        if (Error.hasOwnProperty('stackTraceLimit')) {
            // eslint-disable-next-line local/code-no-any-casts
            const Err = Error; // For the monaco editor checks.
            const stackTraceLimit = Err.stackTraceLimit;
            Err.stackTraceLimit = 0;
            super(`PerfSampleError: by ${data.source} in ${data.sample.location}`);
            Err.stackTraceLimit = stackTraceLimit;
        }
        else {
            super(`PerfSampleError: by ${data.source} in ${data.sample.location}`);
        }
        this.name = 'PerfSampleError';
        this.selfTime = data.sample.selfTime;
        const trace = [data.sample.absLocation, ...data.sample.caller.map(c => c.absLocation)];
        this.stack = `\n\t at ${trace.join('\n\t at ')}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZmlsaW5nVGVsZW1ldHJ5U3BlYy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9wcm9maWxpbmcvY29tbW9uL3Byb2ZpbGluZ1RlbGVtZXRyeVNwZWMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFLaEcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBZ0M5RCxNQUFNLFVBQVUsWUFBWSxDQUFDLElBQWdCLEVBQUUsZ0JBQW1DLEVBQUUsVUFBdUIsRUFBRSxtQkFBNEI7SUFFeEksTUFBTSxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDO0lBRTlDLHVCQUF1QjtJQUN2QixnQkFBZ0IsQ0FBQyxVQUFVLENBQXlELHFCQUFxQixFQUFFO1FBQzFHLFlBQVk7UUFDWixRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7UUFDekIsU0FBUyxFQUFFLE1BQU0sQ0FBQyxTQUFTO1FBQzNCLFVBQVUsRUFBRSxNQUFNLENBQUMsVUFBVTtRQUM3QixZQUFZLEVBQUUsTUFBTSxDQUFDLFFBQVE7UUFDN0IsT0FBTyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7UUFDckQsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUNuRixNQUFNO0tBQ04sQ0FBQyxDQUFDO0lBRUgsd0NBQXdDO0lBQ3hDLE1BQU0sU0FBUyxHQUFHLElBQUksZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDN0MsSUFBSSxtQkFBbUIsRUFBRSxDQUFDO1FBQ3pCLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUMzQyxDQUFDO1NBQU0sQ0FBQztRQUNQLFVBQVUsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDN0IsQ0FBQztBQUNGLENBQUM7QUFFRCxNQUFNLGdCQUFpQixTQUFRLEtBQUs7SUFHbkMsWUFBWSxJQUFnQjtRQUMzQixnREFBZ0Q7UUFDaEQsNERBQTREO1FBQzVELElBQUksS0FBSyxDQUFDLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUM7WUFDN0MsbURBQW1EO1lBQ25ELE1BQU0sR0FBRyxHQUFHLEtBQTJDLENBQUMsQ0FBQyxnQ0FBZ0M7WUFDekYsTUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUM1QyxHQUFHLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQztZQUN4QixLQUFLLENBQUMsdUJBQXVCLElBQUksQ0FBQyxNQUFNLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZFLEdBQUcsQ0FBQyxlQUFlLEdBQUcsZUFBZSxDQUFDO1FBQ3ZDLENBQUM7YUFBTSxDQUFDO1lBQ1AsS0FBSyxDQUFDLHVCQUF1QixJQUFJLENBQUMsTUFBTSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUN4RSxDQUFDO1FBQ0QsSUFBSSxDQUFDLElBQUksR0FBRyxpQkFBaUIsQ0FBQztRQUM5QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO1FBRXJDLE1BQU0sS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUN2RixJQUFJLENBQUMsS0FBSyxHQUFHLFdBQVcsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO0lBQ2xELENBQUM7Q0FDRCJ9