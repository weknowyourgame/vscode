/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../../../../nls.js';
import { OutputMonitorState } from '../monitoring/types.js';
import { MarkdownString } from '../../../../../../../base/common/htmlContent.js';
export function toolResultDetailsFromResponse(terminalResults) {
    return Array.from(new Map(terminalResults
        .flatMap(r => r.resources?.filter(res => res.uri).map(res => {
        const range = res.range;
        const item = range !== undefined ? { uri: res.uri, range } : res.uri;
        const key = range !== undefined
            ? `${res.uri.toString()}-${range.toString()}`
            : `${res.uri.toString()}`;
        return [key, item];
    }) ?? [])).values());
}
export function toolResultMessageFromResponse(result, taskLabel, toolResultDetails, terminalResults, getOutputTool) {
    let resultSummary = '';
    if (result?.exitCode) {
        resultSummary = localize('copilotChat.taskFailedWithExitCode', 'Task `{0}` failed with exit code {1}.', taskLabel, result.exitCode);
    }
    else {
        resultSummary += `\`${taskLabel}\` task `;
        const problemCount = toolResultDetails.length;
        if (getOutputTool) {
            return problemCount ? new MarkdownString(`Got output for ${resultSummary} with \`${problemCount}\` problem${problemCount === 1 ? '' : 's'}`) : new MarkdownString(`Got output for ${resultSummary}`);
        }
        else {
            const problemCount = toolResultDetails.length;
            resultSummary += terminalResults.every(r => r.state === OutputMonitorState.Idle)
                ? (problemCount
                    ? `finished with \`${problemCount}\` problem${problemCount === 1 ? '' : 's'}`
                    : 'finished')
                : (problemCount
                    ? `started and will continue to run in the background with \`${problemCount}\` problem${problemCount === 1 ? '' : 's'}`
                    : 'started and will continue to run in the background');
        }
    }
    return new MarkdownString(resultSummary);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFza0hlbHBlcnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2NoYXRBZ2VudFRvb2xzL2Jyb3dzZXIvdG9vbHMvdGFzay90YXNrSGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQU1oRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDNUQsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBRWpGLE1BQU0sVUFBVSw2QkFBNkIsQ0FBQyxlQUFrRTtJQUMvRyxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQ3hCLGVBQWU7U0FDYixPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FDWixDQUFDLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDN0MsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQztRQUN4QixNQUFNLElBQUksR0FBRyxLQUFLLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO1FBQ3JFLE1BQU0sR0FBRyxHQUFHLEtBQUssS0FBSyxTQUFTO1lBQzlCLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksS0FBSyxDQUFDLFFBQVEsRUFBRSxFQUFFO1lBQzdDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQztRQUMzQixPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBNkIsQ0FBQztJQUNoRCxDQUFDLENBQUMsSUFBSSxFQUFFLENBQ1IsQ0FDRixDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFDYixDQUFDO0FBRUQsTUFBTSxVQUFVLDZCQUE2QixDQUFDLE1BQWdDLEVBQUUsU0FBaUIsRUFBRSxpQkFBcUMsRUFBRSxlQUE2RixFQUFFLGFBQXVCO0lBQy9QLElBQUksYUFBYSxHQUFHLEVBQUUsQ0FBQztJQUN2QixJQUFJLE1BQU0sRUFBRSxRQUFRLEVBQUUsQ0FBQztRQUN0QixhQUFhLEdBQUcsUUFBUSxDQUFDLG9DQUFvQyxFQUFFLHVDQUF1QyxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDckksQ0FBQztTQUFNLENBQUM7UUFDUCxhQUFhLElBQUksS0FBSyxTQUFTLFVBQVUsQ0FBQztRQUMxQyxNQUFNLFlBQVksR0FBRyxpQkFBaUIsQ0FBQyxNQUFNLENBQUM7UUFDOUMsSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUNuQixPQUFPLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxjQUFjLENBQUMsa0JBQWtCLGFBQWEsV0FBVyxZQUFZLGFBQWEsWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxrQkFBa0IsYUFBYSxFQUFFLENBQUMsQ0FBQztRQUN0TSxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sWUFBWSxHQUFHLGlCQUFpQixDQUFDLE1BQU0sQ0FBQztZQUM5QyxhQUFhLElBQUksZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEtBQUssa0JBQWtCLENBQUMsSUFBSSxDQUFDO2dCQUMvRSxDQUFDLENBQUMsQ0FBQyxZQUFZO29CQUNkLENBQUMsQ0FBQyxtQkFBbUIsWUFBWSxhQUFhLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFO29CQUM3RSxDQUFDLENBQUMsVUFBVSxDQUFDO2dCQUNkLENBQUMsQ0FBQyxDQUFDLFlBQVk7b0JBQ2QsQ0FBQyxDQUFDLDZEQUE2RCxZQUFZLGFBQWEsWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUU7b0JBQ3ZILENBQUMsQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO1FBQzNELENBQUM7SUFDRixDQUFDO0lBQ0QsT0FBTyxJQUFJLGNBQWMsQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUMxQyxDQUFDIn0=