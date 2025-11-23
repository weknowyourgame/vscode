/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { basename } from '../../../../../base/common/path.js';
import { isWindows } from '../../../../../base/common/platform.js';
import { SimpleCompletionItem } from '../../../../services/suggest/browser/simpleCompletionItem.js';
export var TerminalCompletionItemKind;
(function (TerminalCompletionItemKind) {
    // Extension host kinds
    TerminalCompletionItemKind[TerminalCompletionItemKind["File"] = 0] = "File";
    TerminalCompletionItemKind[TerminalCompletionItemKind["Folder"] = 1] = "Folder";
    TerminalCompletionItemKind[TerminalCompletionItemKind["Method"] = 2] = "Method";
    TerminalCompletionItemKind[TerminalCompletionItemKind["Alias"] = 3] = "Alias";
    TerminalCompletionItemKind[TerminalCompletionItemKind["Argument"] = 4] = "Argument";
    TerminalCompletionItemKind[TerminalCompletionItemKind["Option"] = 5] = "Option";
    TerminalCompletionItemKind[TerminalCompletionItemKind["OptionValue"] = 6] = "OptionValue";
    TerminalCompletionItemKind[TerminalCompletionItemKind["Flag"] = 7] = "Flag";
    TerminalCompletionItemKind[TerminalCompletionItemKind["SymbolicLinkFile"] = 8] = "SymbolicLinkFile";
    TerminalCompletionItemKind[TerminalCompletionItemKind["SymbolicLinkFolder"] = 9] = "SymbolicLinkFolder";
    TerminalCompletionItemKind[TerminalCompletionItemKind["Commit"] = 10] = "Commit";
    TerminalCompletionItemKind[TerminalCompletionItemKind["Branch"] = 11] = "Branch";
    TerminalCompletionItemKind[TerminalCompletionItemKind["Tag"] = 12] = "Tag";
    TerminalCompletionItemKind[TerminalCompletionItemKind["Stash"] = 13] = "Stash";
    TerminalCompletionItemKind[TerminalCompletionItemKind["Remote"] = 14] = "Remote";
    TerminalCompletionItemKind[TerminalCompletionItemKind["PullRequest"] = 15] = "PullRequest";
    TerminalCompletionItemKind[TerminalCompletionItemKind["PullRequestDone"] = 16] = "PullRequestDone";
    // Core-only kinds
    TerminalCompletionItemKind[TerminalCompletionItemKind["InlineSuggestion"] = 100] = "InlineSuggestion";
    TerminalCompletionItemKind[TerminalCompletionItemKind["InlineSuggestionAlwaysOnTop"] = 101] = "InlineSuggestionAlwaysOnTop";
})(TerminalCompletionItemKind || (TerminalCompletionItemKind = {}));
// Maps CompletionItemKind from language server based completion to TerminalCompletionItemKind
export function mapLspKindToTerminalKind(lspKind) {
    // TODO: Add more types for different [LSP providers](https://github.com/microsoft/vscode/issues/249480)
    switch (lspKind) {
        case 20 /* CompletionItemKind.File */:
            return TerminalCompletionItemKind.File;
        case 23 /* CompletionItemKind.Folder */:
            return TerminalCompletionItemKind.Folder;
        case 0 /* CompletionItemKind.Method */:
            return TerminalCompletionItemKind.Method;
        case 18 /* CompletionItemKind.Text */:
            return TerminalCompletionItemKind.Argument; // consider adding new type?
        case 4 /* CompletionItemKind.Variable */:
            return TerminalCompletionItemKind.Argument; // ""
        case 16 /* CompletionItemKind.EnumMember */:
            return TerminalCompletionItemKind.OptionValue; // ""
        case 17 /* CompletionItemKind.Keyword */:
            return TerminalCompletionItemKind.Alias;
        default:
            return TerminalCompletionItemKind.Method;
    }
}
export class TerminalCompletionItem extends SimpleCompletionItem {
    constructor(completion) {
        super(completion);
        this.completion = completion;
        /**
         * The file extension part from {@link labelLow}.
         */
        this.fileExtLow = '';
        /**
         * A penalty that applies to completions that are comprised of only punctuation characters or
         * that applies to files or folders starting with the underscore character.
         */
        this.punctuationPenalty = 0;
        // ensure lower-variants (perf)
        this.labelLowExcludeFileExt = this.labelLow;
        this.labelLowNormalizedPath = this.labelLow;
        // HACK: Treat branch as a path separator, otherwise they get filtered out. Hard code the
        // documentation for now, but this would be better to come in through a `kind`
        // See https://github.com/microsoft/vscode/issues/255864
        if (isFile(completion) || completion.kind === TerminalCompletionItemKind.Branch) {
            if (isWindows) {
                this.labelLow = this.labelLow.replaceAll('/', '\\');
            }
        }
        if (isFile(completion)) {
            // Don't include dotfiles as extensions when sorting
            const extIndex = this.labelLow.lastIndexOf('.');
            if (extIndex > 0) {
                this.labelLowExcludeFileExt = this.labelLow.substring(0, extIndex);
                this.fileExtLow = this.labelLow.substring(extIndex + 1);
            }
        }
        if (isFile(completion) || completion.kind === TerminalCompletionItemKind.Folder) {
            if (isWindows) {
                this.labelLowNormalizedPath = this.labelLow.replaceAll('\\', '/');
            }
            if (completion.kind === TerminalCompletionItemKind.Folder) {
                this.labelLowNormalizedPath = this.labelLowNormalizedPath.replace(/\/$/, '');
            }
        }
        this.punctuationPenalty = shouldPenalizeForPunctuation(this.labelLowExcludeFileExt) ? 1 : 0;
    }
    /**
     * Resolves the completion item's details lazily when needed.
     */
    async resolve(token) {
        if (this.resolveCache) {
            return this.resolveCache;
        }
        const unresolvedItem = this.completion._unresolvedItem;
        const provider = this.completion._resolveProvider;
        if (!unresolvedItem || !provider || !provider.resolveCompletionItem) {
            return;
        }
        this.resolveCache = (async () => {
            try {
                const resolved = await provider.resolveCompletionItem(unresolvedItem, token);
                if (resolved) {
                    // Update the completion with resolved details
                    if (resolved.detail) {
                        this.completion.detail = resolved.detail;
                    }
                    if (resolved.documentation) {
                        this.completion.documentation = resolved.documentation;
                    }
                }
            }
            catch (error) {
                return;
            }
        })();
        return this.resolveCache;
    }
}
function isFile(completion) {
    return !!(completion.kind === TerminalCompletionItemKind.File || completion.isFileOverride);
}
function shouldPenalizeForPunctuation(label) {
    return basename(label).startsWith('_') || /^[\[\]\{\}\(\)\.,;:!?\/\\\-_@#~*%^=$]+$/.test(label);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDb21wbGV0aW9uSXRlbS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvc3VnZ2VzdC9icm93c2VyL3Rlcm1pbmFsQ29tcGxldGlvbkl0ZW0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUVuRSxPQUFPLEVBQXFCLG9CQUFvQixFQUFFLE1BQU0sOERBQThELENBQUM7QUFFdkgsTUFBTSxDQUFOLElBQVksMEJBdUJYO0FBdkJELFdBQVksMEJBQTBCO0lBQ3JDLHVCQUF1QjtJQUN2QiwyRUFBUSxDQUFBO0lBQ1IsK0VBQVUsQ0FBQTtJQUNWLCtFQUFVLENBQUE7SUFDViw2RUFBUyxDQUFBO0lBQ1QsbUZBQVksQ0FBQTtJQUNaLCtFQUFVLENBQUE7SUFDVix5RkFBZSxDQUFBO0lBQ2YsMkVBQVEsQ0FBQTtJQUNSLG1HQUFvQixDQUFBO0lBQ3BCLHVHQUFzQixDQUFBO0lBQ3RCLGdGQUFXLENBQUE7SUFDWCxnRkFBVyxDQUFBO0lBQ1gsMEVBQVEsQ0FBQTtJQUNSLDhFQUFVLENBQUE7SUFDVixnRkFBVyxDQUFBO0lBQ1gsMEZBQWdCLENBQUE7SUFDaEIsa0dBQW9CLENBQUE7SUFFcEIsa0JBQWtCO0lBQ2xCLHFHQUFzQixDQUFBO0lBQ3RCLDJIQUFpQyxDQUFBO0FBQ2xDLENBQUMsRUF2QlcsMEJBQTBCLEtBQTFCLDBCQUEwQixRQXVCckM7QUFFRCw4RkFBOEY7QUFDOUYsTUFBTSxVQUFVLHdCQUF3QixDQUFDLE9BQTJCO0lBQ25FLHdHQUF3RztJQUV4RyxRQUFRLE9BQU8sRUFBRSxDQUFDO1FBQ2pCO1lBQ0MsT0FBTywwQkFBMEIsQ0FB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