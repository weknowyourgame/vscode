/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isWindows } from '../../../../../base/common/platform.js';
import { count } from '../../../../../base/common/strings.js';
import { isString } from '../../../../../base/common/types.js';
import { SimpleCompletionModel } from '../../../../services/suggest/browser/simpleCompletionModel.js';
import { TerminalCompletionItemKind } from './terminalCompletionItem.js';
export class TerminalCompletionModel extends SimpleCompletionModel {
    constructor(items, lineContext) {
        super(items, lineContext, compareCompletionsFn);
    }
}
const compareCompletionsFn = (leadingLineContent, a, b) => {
    // Boost always on top inline completions
    if (a.completion.kind === TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop && a.completion.kind !== b.completion.kind) {
        return -1;
    }
    if (b.completion.kind === TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop && a.completion.kind !== b.completion.kind) {
        return 1;
    }
    // Sort by the score
    let score = b.score[0] - a.score[0];
    if (score !== 0) {
        return score;
    }
    // Boost inline completions
    if (a.completion.kind === TerminalCompletionItemKind.InlineSuggestion && a.completion.kind !== b.completion.kind) {
        return -1;
    }
    if (b.completion.kind === TerminalCompletionItemKind.InlineSuggestion && a.completion.kind !== b.completion.kind) {
        return 1;
    }
    if (a.punctuationPenalty !== b.punctuationPenalty) {
        // Sort by underscore penalty (eg. `__init__/` should be penalized)
        // Sort by punctuation penalty (eg. `;` should be penalized)
        return a.punctuationPenalty - b.punctuationPenalty;
    }
    // Sort files of the same name by extension
    const isArg = leadingLineContent.includes(' ');
    if (!isArg && a.completion.kind === TerminalCompletionItemKind.File && b.completion.kind === TerminalCompletionItemKind.File) {
        // If the file name excluding the extension is different, just do a regular sort
        if (a.labelLowExcludeFileExt !== b.labelLowExcludeFileExt) {
            return a.labelLowExcludeFileExt.localeCompare(b.labelLowExcludeFileExt, undefined, { ignorePunctuation: true });
        }
        // Then by label length ascending (excluding file extension if it's a file)
        score = a.labelLowExcludeFileExt.length - b.labelLowExcludeFileExt.length;
        if (score !== 0) {
            return score;
        }
        // If they're files at the start of the command line, boost extensions depending on the operating system
        score = fileExtScore(b.fileExtLow) - fileExtScore(a.fileExtLow);
        if (score !== 0) {
            return score;
        }
        // Then by file extension length ascending
        score = a.fileExtLow.length - b.fileExtLow.length;
        if (score !== 0) {
            return score;
        }
    }
    // Boost main and master branches for git commands
    // HACK: Currently this just matches leading line content, it should eventually check the
    //       completion type is a branch
    if (a.completion.kind === TerminalCompletionItemKind.Argument && b.completion.kind === TerminalCompletionItemKind.Argument && /^\s*git\b/.test(leadingLineContent)) {
        const aLabel = isString(a.completion.label) ? a.completion.label : a.completion.label.label;
        const bLabel = isString(b.completion.label) ? b.completion.label : b.completion.label.label;
        const aIsMainOrMaster = aLabel === 'main' || aLabel === 'master';
        const bIsMainOrMaster = bLabel === 'main' || bLabel === 'master';
        if (aIsMainOrMaster && !bIsMainOrMaster) {
            return -1;
        }
        if (bIsMainOrMaster && !aIsMainOrMaster) {
            return 1;
        }
    }
    // Sort by more detailed completions
    if (a.completion.kind === TerminalCompletionItemKind.Method && b.completion.kind === TerminalCompletionItemKind.Method) {
        if (!isString(a.completion.label) && a.completion.label.description && !isString(b.completion.label) && b.completion.label.description) {
            score = 0;
        }
        else if (!isString(a.completion.label) && a.completion.label.description) {
            score = -2;
        }
        else if (!isString(b.completion.label) && b.completion.label.description) {
            score = 2;
        }
        score += (b.completion.detail ? 1 : 0) + (b.completion.documentation ? 2 : 0) - (a.completion.detail ? 1 : 0) - (a.completion.documentation ? 2 : 0);
        if (score !== 0) {
            return score;
        }
    }
    // Sort by folder depth (eg. `vscode/` should come before `vscode-.../`)
    if (a.completion.kind === TerminalCompletionItemKind.Folder && b.completion.kind === TerminalCompletionItemKind.Folder) {
        if (a.labelLowNormalizedPath && b.labelLowNormalizedPath) {
            // Directories
            // Count depth of path (number of / or \ occurrences)
            score = count(a.labelLowNormalizedPath, '/') - count(b.labelLowNormalizedPath, '/');
            if (score !== 0) {
                return score;
            }
            // Ensure shorter prefixes appear first
            if (b.labelLowNormalizedPath.startsWith(a.labelLowNormalizedPath)) {
                return -1; // `a` is a prefix of `b`, so `a` should come first
            }
            if (a.labelLowNormalizedPath.startsWith(b.labelLowNormalizedPath)) {
                return 1; // `b` is a prefix of `a`, so `b` should come first
            }
        }
    }
    if (a.completion.kind !== b.completion.kind) {
        // Sort by kind
        if ((a.completion.kind === TerminalCompletionItemKind.Method || a.completion.kind === TerminalCompletionItemKind.Alias) && (b.completion.kind !== TerminalCompletionItemKind.Method && b.completion.kind !== TerminalCompletionItemKind.Alias)) {
            return -1; // Methods and aliases should come first
        }
        if ((b.completion.kind === TerminalCompletionItemKind.Method || b.completion.kind === TerminalCompletionItemKind.Alias) && (a.completion.kind !== TerminalCompletionItemKind.Method && a.completion.kind !== TerminalCompletionItemKind.Alias)) {
            return 1; // Methods and aliases should come first
        }
        if (a.completion.kind === TerminalCompletionItemKind.Argument && b.completion.kind !== TerminalCompletionItemKind.Argument) {
            return -1; // Arguments should come before other kinds
        }
        if (b.completion.kind === TerminalCompletionItemKind.Argument && a.completion.kind !== TerminalCompletionItemKind.Argument) {
            return 1; // Arguments should come before other kinds
        }
        if (isResourceKind(a.completion.kind) && !isResourceKind(b.completion.kind)) {
            return 1; // Resources should come last
        }
        if (isResourceKind(b.completion.kind) && !isResourceKind(a.completion.kind)) {
            return -1; // Resources should come last
        }
    }
    // Sort alphabetically, ignoring punctuation causes dot files to be mixed in rather than
    // all at the top
    return a.labelLow.localeCompare(b.labelLow, undefined, { ignorePunctuation: true });
};
const isResourceKind = (kind) => kind === TerminalCompletionItemKind.File ||
    kind === TerminalCompletionItemKind.Folder ||
    kind === TerminalCompletionItemKind.SymbolicLinkFile ||
    kind === TerminalCompletionItemKind.SymbolicLinkFolder;
// TODO: This should be based on the process OS, not the local OS
// File score boosts for specific file extensions on Windows. This only applies when the file is the
// _first_ part of the command line.
const fileExtScores = new Map(isWindows ? [
    // Windows - .ps1 > .exe > .bat > .cmd. This is the command precedence when running the files
    //           without an extension, tested manually in pwsh v7.4.4
    ['ps1', 0.09],
    ['exe', 0.08],
    ['bat', 0.07],
    ['cmd', 0.07],
    ['msi', 0.06],
    ['com', 0.06],
    // Non-Windows
    ['sh', -0.05],
    ['bash', -0.05],
    ['zsh', -0.05],
    ['fish', -0.05],
    ['csh', -0.06], // C shell
    ['ksh', -0.06], // Korn shell
    // Scripting language files are excluded here as the standard behavior on Windows will just open
    // the file in a text editor, not run the file
] : [
    // Pwsh
    ['ps1', 0.05],
    // Windows
    ['bat', -0.05],
    ['cmd', -0.05],
    ['exe', -0.05],
    // Non-Windows
    ['sh', 0.05],
    ['bash', 0.05],
    ['zsh', 0.05],
    ['fish', 0.05],
    ['csh', 0.04], // C shell
    ['ksh', 0.04], // Korn shell
    // Scripting languages
    ['py', 0.05], // Python
    ['pl', 0.05], // Perl
]);
function fileExtScore(ext) {
    return fileExtScores.get(ext) || 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDb21wbGV0aW9uTW9kZWwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL3N1Z2dlc3QvYnJvd3Nlci90ZXJtaW5hbENvbXBsZXRpb25Nb2RlbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbkUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQzlELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUscUJBQXFCLEVBQW9CLE1BQU0sK0RBQStELENBQUM7QUFDeEgsT0FBTyxFQUFFLDBCQUEwQixFQUErQixNQUFNLDZCQUE2QixDQUFDO0FBRXRHLE1BQU0sT0FBTyx1QkFBd0IsU0FBUSxxQkFBNkM7SUFDekYsWUFDQyxLQUErQixFQUMvQixXQUF3QjtRQUV4QixLQUFLLENBQUMsS0FBSyxFQUFFLFdBQVcsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO0lBQ2pELENBQUM7Q0FDRDtBQUVELE1BQU0sb0JBQW9CLEdBQUcsQ0FBQyxrQkFBMEIsRUFBRSxDQUF5QixFQUFFLENBQXlCLEVBQUUsRUFBRTtJQUNqSCx5Q0FBeUM7SUFDekMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSywwQkFBMEIsQ0FBQywyQkFBMkIsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQzdILE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDWCxDQUFDO0lBQ0QsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksS0FBSywwQkFBMEIsQ0FBQywyQkFBMkIsSUFBSSxDQUFDLENBQUMs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