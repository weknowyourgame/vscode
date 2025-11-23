/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable } from '../../../../../../../base/common/lifecycle.js';
import { isPowerShell } from '../../runInTerminalHelpers.js';
export class CommandLinePwshChainOperatorRewriter extends Disposable {
    constructor(_treeSitterCommandParser) {
        super();
        this._treeSitterCommandParser = _treeSitterCommandParser;
    }
    async rewrite(options) {
        // TODO: This should just be Windows PowerShell in the future when the powershell grammar
        // supports chain operators https://github.com/airbus-cert/tree-sitter-powershell/issues/27
        if (isPowerShell(options.shell, options.os)) {
            let doubleAmpersandCaptures;
            try {
                doubleAmpersandCaptures = await this._treeSitterCommandParser.extractPwshDoubleAmpersandChainOperators(options.commandLine);
            }
            catch {
                // Swallow tree sitter failures
            }
            if (doubleAmpersandCaptures && doubleAmpersandCaptures.length > 0) {
                let rewritten = options.commandLine;
                for (const capture of doubleAmpersandCaptures.reverse()) {
                    rewritten = `${rewritten.substring(0, capture.node.startIndex)};${rewritten.substring(capture.node.endIndex)}`;
                }
                return {
                    rewritten,
                    reasoning: '&& re-written to ;'
                };
            }
        }
        return undefined;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWFuZExpbmVQd3NoQ2hhaW5PcGVyYXRvclJld3JpdGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9jaGF0QWdlbnRUb29scy9icm93c2VyL3Rvb2xzL2NvbW1hbmRMaW5lUmV3cml0ZXIvY29tbWFuZExpbmVQd3NoQ2hhaW5PcGVyYXRvclJld3JpdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUMzRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFJN0QsTUFBTSxPQUFPLG9DQUFxQyxTQUFRLFVBQVU7SUFDbkUsWUFDa0Isd0JBQWlEO1FBRWxFLEtBQUssRUFBRSxDQUFDO1FBRlMsNkJBQXdCLEdBQXhCLHdCQUF3QixDQUF5QjtJQUduRSxDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFvQztRQUNqRCx5RkFBeUY7UUFDekYsMkZBQTJGO1FBQzNGLElBQUksWUFBWSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7WUFDN0MsSUFBSSx1QkFBbUQsQ0FBQztZQUN4RCxJQUFJLENBQUM7Z0JBQ0osdUJBQXVCLEdBQUcsTUFBTSxJQUFJLENBQUMsd0JBQXdCLENBQUMsd0NBQXdDLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQzdILENBQUM7WUFBQyxNQUFNLENBQUM7Z0JBQ1IsK0JBQStCO1lBQ2hDLENBQUM7WUFFRCxJQUFJLHVCQUF1QixJQUFJLHVCQUF1QixDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDbkUsSUFBSSxTQUFTLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQztnQkFDcEMsS0FBSyxNQUFNLE9BQU8sSUFBSSx1QkFBdUIsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDO29CQUN6RCxTQUFTLEdBQUcsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO2dCQUNoSCxDQUFDO2dCQUNELE9BQU87b0JBQ04sU0FBUztvQkFDVCxTQUFTLEVBQUUsb0JBQW9CO2lCQUMvQixDQUFDO1lBQ0gsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0NBQ0QifQ==