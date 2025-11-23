/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable } from '../../../../../../../base/common/lifecycle.js';
import { isPowerShell } from '../../runInTerminalHelpers.js';
export class CommandLineCdPrefixRewriter extends Disposable {
    rewrite(options) {
        if (!options.cwd) {
            return undefined;
        }
        const isPwsh = isPowerShell(options.shell, options.os);
        // Re-write the command if it starts with `cd <dir> && <suffix>` or `cd <dir>; <suffix>`
        // to just `<suffix>` if the directory matches the current terminal's cwd. This simplifies
        // the result in the chat by removing redundancies that some models like to add.
        const cdPrefixMatch = options.commandLine.match(isPwsh
            ? /^(?:cd(?: \/d)?|Set-Location(?: -Path)?) (?<dir>[^\s]+) ?(?:&&|;)\s+(?<suffix>.+)$/i
            : /^cd (?<dir>[^\s]+) &&\s+(?<suffix>.+)$/);
        const cdDir = cdPrefixMatch?.groups?.dir;
        const cdSuffix = cdPrefixMatch?.groups?.suffix;
        if (cdDir && cdSuffix) {
            // Remove any surrounding quotes
            let cdDirPath = cdDir;
            if (cdDirPath.startsWith('"') && cdDirPath.endsWith('"')) {
                cdDirPath = cdDirPath.slice(1, -1);
            }
            // Normalize trailing slashes
            cdDirPath = cdDirPath.replace(/(?:[\\\/])$/, '');
            let cwdFsPath = options.cwd.fsPath.replace(/(?:[\\\/])$/, '');
            // Case-insensitive comparison on Windows
            if (options.os === 1 /* OperatingSystem.Windows */) {
                cdDirPath = cdDirPath.toLowerCase();
                cwdFsPath = cwdFsPath.toLowerCase();
            }
            if (cdDirPath === cwdFsPath) {
                return { rewritten: cdSuffix, reasoning: 'Removed redundant cd command' };
            }
        }
        return undefined;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWFuZExpbmVDZFByZWZpeFJld3JpdGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9jaGF0QWdlbnRUb29scy9icm93c2VyL3Rvb2xzL2NvbW1hbmRMaW5lUmV3cml0ZXIvY29tbWFuZExpbmVDZFByZWZpeFJld3JpdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUUzRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFHN0QsTUFBTSxPQUFPLDJCQUE0QixTQUFRLFVBQVU7SUFDMUQsT0FBTyxDQUFDLE9BQW9DO1FBQzNDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDbEIsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELE1BQU0sTUFBTSxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUV2RCx3RkFBd0Y7UUFDeEYsMEZBQTBGO1FBQzFGLGdGQUFnRjtRQUNoRixNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FDOUMsTUFBTTtZQUNMLENBQUMsQ0FBQyxxRkFBcUY7WUFDdkYsQ0FBQyxDQUFDLHdDQUF3QyxDQUMzQyxDQUFDO1FBQ0YsTUFBTSxLQUFLLEdBQUcsYUFBYSxFQUFFLE1BQU0sRUFBRSxHQUFHLENBQUM7UUFDekMsTUFBTSxRQUFRLEdBQUcsYUFBYSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUM7UUFDL0MsSUFBSSxLQUFLLElBQUksUUFBUSxFQUFFLENBQUM7WUFDdkIsZ0NBQWdDO1lBQ2hDLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQztZQUN0QixJQUFJLFNBQVMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksU0FBUyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUMxRCxTQUFTLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNwQyxDQUFDO1lBQ0QsNkJBQTZCO1lBQzdCLFNBQVMsR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNqRCxJQUFJLFNBQVMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzlELHlDQUF5QztZQUN6QyxJQUFJLE9BQU8sQ0FBQyxFQUFFLG9DQUE0QixFQUFFLENBQUM7Z0JBQzVDLFNBQVMsR0FBRyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ3BDLFNBQVMsR0FBRyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDckMsQ0FBQztZQUNELElBQUksU0FBUyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUM3QixPQUFPLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsOEJBQThCLEVBQUUsQ0FBQztZQUMzRSxDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7Q0FDRCJ9