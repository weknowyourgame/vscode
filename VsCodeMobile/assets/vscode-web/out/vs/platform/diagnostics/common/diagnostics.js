/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../instantiation/common/instantiation.js';
export const ID = 'diagnosticsService';
export const IDiagnosticsService = createDecorator(ID);
export function isRemoteDiagnosticError(x) {
    const candidate = x;
    return !!candidate?.hostName && !!candidate?.errorMessage;
}
export class NullDiagnosticsService {
    async getPerformanceInfo(mainProcessInfo, remoteInfo) {
        return {};
    }
    async getSystemInfo(mainProcessInfo, remoteInfo) {
        return {
            processArgs: 'nullProcessArgs',
            gpuStatus: 'nullGpuStatus',
            screenReader: 'nullScreenReader',
            remoteData: [],
            os: 'nullOs',
            memory: 'nullMemory',
            vmHint: 'nullVmHint',
        };
    }
    async getDiagnostics(mainProcessInfo, remoteInfo) {
        return '';
    }
    async getWorkspaceFileExtensions(workspace) {
        return { extensions: [] };
    }
    async reportWorkspaceStats(workspace) { }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhZ25vc3RpY3MuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vZGlhZ25vc3RpY3MvY29tbW9uL2RpYWdub3N0aWNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBS2hHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUc5RSxNQUFNLENBQUMsTUFBTSxFQUFFLEdBQUcsb0JBQW9CLENBQUM7QUFDdkMsTUFBTSxDQUFDLE1BQU0sbUJBQW1CLEdBQUcsZUFBZSxDQUFzQixFQUFFLENBQUMsQ0FBQztBQW1GNUUsTUFBTSxVQUFVLHVCQUF1QixDQUFDLENBQVU7SUFDakQsTUFBTSxTQUFTLEdBQUcsQ0FBdUMsQ0FBQztJQUMxRCxPQUFPLENBQUMsQ0FBQyxTQUFTLEVBQUUsUUFBUSxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsWUFBWSxDQUFDO0FBQzNELENBQUM7QUFFRCxNQUFNLE9BQU8sc0JBQXNCO0lBR2xDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxlQUF3QyxFQUFFLFVBQThEO1FBQ2hJLE9BQU8sRUFBRSxDQUFDO0lBQ1gsQ0FBQztJQUVELEtBQUssQ0FBQyxhQUFhLENBQUMsZUFBd0MsRUFBRSxVQUE4RDtRQUMzSCxPQUFPO1lBQ04sV0FBVyxFQUFFLGlCQUFpQjtZQUM5QixTQUFTLEVBQUUsZUFBZTtZQUMxQixZQUFZLEVBQUUsa0JBQWtCO1lBQ2hDLFVBQVUsRUFBRSxFQUFFO1lBQ2QsRUFBRSxFQUFFLFFBQVE7WUFDWixNQUFNLEVBQUUsWUFBWTtZQUNwQixNQUFNLEVBQUUsWUFBWTtTQUNwQixDQUFDO0lBQ0gsQ0FBQztJQUVELEtBQUssQ0FBQyxjQUFjLENBQUMsZUFBd0MsRUFBRSxVQUE4RDtRQUM1SCxPQUFPLEVBQUUsQ0FBQztJQUNYLENBQUM7SUFFRCxLQUFLLENBQUMsMEJBQTBCLENBQUMsU0FBcUI7UUFDckQsT0FBTyxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUUsQ0FBQztJQUMzQixDQUFDO0lBRUQsS0FBSyxDQUFDLG9CQUFvQixDQUFDLFNBQWdDLElBQW1CLENBQUM7Q0FFL0UifQ==