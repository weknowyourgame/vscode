/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { convertLinkRangeToBuffer, getXtermLineContent } from './terminalLinkHelpers.js';
import { getTerminalLinkType } from './terminalLocalLinkDetector.js';
import { ITerminalLogService } from '../../../../../platform/terminal/common/terminal.js';
var Constants;
(function (Constants) {
    /**
     * The max line length to try extract word links from.
     */
    Constants[Constants["MaxLineLength"] = 2000] = "MaxLineLength";
    /**
     * The maximum length of a link to resolve against the file system. This limit is put in place
     * to avoid sending excessive data when remote connections are in place.
     */
    Constants[Constants["MaxResolvedLinkLength"] = 1024] = "MaxResolvedLinkLength";
})(Constants || (Constants = {}));
const lineNumberPrefixMatchers = [
    // Ripgrep:
    //   /some/file
    //   16:searchresult
    //   16:    searchresult
    // Eslint:
    //   /some/file
    //     16:5  error ...
    /^ *(?<link>(?<line>\d+):(?<col>\d+)?)/
];
const gitDiffMatchers = [
    // --- a/some/file
    // +++ b/some/file
    // @@ -8,11 +8,11 @@ file content...
    /^(?<link>@@ .+ \+(?<toFileLine>\d+),(?<toFileCount>\d+) @@)/
];
let TerminalMultiLineLinkDetector = class TerminalMultiLineLinkDetector {
    static { this.id = 'multiline'; }
    constructor(xterm, _processManager, _linkResolver, _logService, _uriIdentityService, _workspaceContextService) {
        this.xterm = xterm;
        this._processManager = _processManager;
        this._linkResolver = _linkResolver;
        this._logService = _logService;
        this._uriIdentityService = _uriIdentityService;
        this._workspaceContextService = _workspaceContextService;
        // This was chosen as a reasonable maximum line length given the tradeoff between performance
        // and how likely it is to encounter such a large line length. Some useful reference points:
        // - Window old max length: 260 ($MAX_PATH)
        // - Linux max length: 4096 ($PATH_MAX)
        this.maxLinkLength = 500;
    }
    async detect(lines, startLine, endLine) {
        const links = [];
        // Get the text representation of the wrapped line
        const text = getXtermLineContent(this.xterm.buffer.active, startLine, endLine, this.xterm.cols);
        if (text === '' || text.length > 2000 /* Constants.MaxLineLength */) {
            return [];
        }
        this._logService.trace('terminalMultiLineLinkDetector#detect text', text);
        // Match against the fallback matchers which are mainly designed to catch paths with spaces
        // that aren't possible using the regular mechanism.
        for (const matcher of lineNumberPrefixMatchers) {
            const match = text.match(matcher);
            const group = match?.groups;
            if (!group) {
                continue;
            }
            const link = group?.link;
            const line = group?.line;
            const col = group?.col;
            if (!link || line === undefined) {
                continue;
            }
            // Don't try resolve any links of excessive length
            if (link.length > 1024 /* Constants.MaxResolvedLinkLength */) {
                continue;
            }
            this._logService.trace('terminalMultiLineLinkDetector#detect candidate', link);
            // Scan up looking for the first line that could be a path
            let possiblePath;
            for (let index = startLine - 1; index >= 0; index--) {
                // Ignore lines that aren't at the beginning of a wrapped line
                if (this.xterm.buffer.active.getLine(index).isWrapped) {
                    continue;
                }
                const text = getXtermLineContent(this.xterm.buffer.active, index, index, this.xterm.cols);
                if (!text.match(/^\s*\d/)) {
                    possiblePath = text;
                    break;
                }
            }
            if (!possiblePath) {
                continue;
            }
            // Check if the first non-matching line is an absolute or relative link
            const linkStat = await this._linkResolver.resolveLink(this._processManager, possiblePath);
            if (linkStat) {
                const type = getTerminalLinkType(linkStat.uri, linkStat.isDirectory, this._uriIdentityService, this._workspaceContextService);
                // Convert the entire line's text string index into a wrapped buffer range
                const bufferRange = convertLinkRangeToBuffer(lines, this.xterm.cols, {
                    startColumn: 1,
                    startLineNumber: 1,
                    endColumn: 1 + text.length,
                    endLineNumber: 1
                }, startLine);
                const simpleLink = {
                    text: link,
                    uri: linkStat.uri,
                    selection: {
                        startLineNumber: parseInt(line),
                        startColumn: col ? parseInt(col) : 1
                    },
                    disableTrimColon: true,
                    bufferRange: bufferRange,
                    type
                };
                this._logService.trace('terminalMultiLineLinkDetector#detect verified link', simpleLink);
                links.push(simpleLink);
                // Break on the first match
                break;
            }
        }
        if (links.length === 0) {
            for (const matcher of gitDiffMatchers) {
                const match = text.match(matcher);
                const group = match?.groups;
                if (!group) {
                    continue;
                }
                const link = group?.link;
                const toFileLine = group?.toFileLine;
                const toFileCount = group?.toFileCount;
                if (!link || toFileLine === undefined) {
                    continue;
                }
                // Don't try resolve any links of excessive length
                if (link.length > 1024 /* Constants.MaxResolvedLinkLength */) {
                    continue;
                }
                this._logService.trace('terminalMultiLineLinkDetector#detect candidate', link);
                // Scan up looking for the first line that could be a path
                let possiblePath;
                for (let index = startLine - 1; index >= 0; index--) {
                    // Ignore lines that aren't at the beginning of a wrapped line
                    if (this.xterm.buffer.active.getLine(index).isWrapped) {
                        continue;
                    }
                    const text = getXtermLineContent(this.xterm.buffer.active, index, index, this.xterm.cols);
                    const match = text.match(/\+\+\+ b\/(?<path>.+)/);
                    if (match) {
                        possiblePath = match.groups?.path;
                        break;
                    }
                }
                if (!possiblePath) {
                    continue;
                }
                // Check if the first non-matching line is an absolute or relative link
                const linkStat = await this._linkResolver.resolveLink(this._processManager, possiblePath);
                if (linkStat) {
                    const type = getTerminalLinkType(linkStat.uri, linkStat.isDirectory, this._uriIdentityService, this._workspaceContextService);
                    // Convert the link to the buffer range
                    const bufferRange = convertLinkRangeToBuffer(lines, this.xterm.cols, {
                        startColumn: 1,
                        startLineNumber: 1,
                        endColumn: 1 + link.length,
                        endLineNumber: 1
                    }, startLine);
                    const simpleLink = {
                        text: link,
                        uri: linkStat.uri,
                        selection: {
                            startLineNumber: parseInt(toFileLine),
                            startColumn: 1,
                            endLineNumber: parseInt(toFileLine) + parseInt(toFileCount)
                        },
                        bufferRange: bufferRange,
                        type
                    };
                    this._logService.trace('terminalMultiLineLinkDetector#detect verified link', simpleLink);
                    links.push(simpleLink);
                    // Break on the first match
                    break;
                }
            }
        }
        return links;
    }
};
TerminalMultiLineLinkDetector = __decorate([
    __param(3, ITerminalLogService),
    __param(4, IUriIdentityService),
    __param(5, IWorkspaceContextService)
], TerminalMultiLineLinkDetector);
export { TerminalMultiLineLinkDetector };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxNdWx0aUxpbmVMaW5rRGV0ZWN0b3IuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL2xpbmtzL2Jyb3dzZXIvdGVybWluYWxNdWx0aUxpbmVMaW5rRGV0ZWN0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDaEcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFFakcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLG1CQUFtQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDekYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFHckUsT0FBTyxFQUFvQixtQkFBbUIsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBRTVHLElBQVcsU0FXVjtBQVhELFdBQVcsU0FBUztJQUNuQjs7T0FFRztJQUNILDhEQUFvQixDQUFBO0lBRXBCOzs7T0FHRztJQUNILDhFQUE0QixDQUFBO0FBQzdCLENBQUMsRUFYVSxTQUFTLEtBQVQsU0FBUyxRQVduQjtBQUVELE1BQU0sd0JBQXdCLEdBQUc7SUFDaEMsV0FBVztJQUNYLGVBQWU7SUFDZixvQkFBb0I7SUFDcEIsd0JBQXdCO0lBQ3hCLFVBQVU7SUFDVixlQUFlO0lBQ2Ysc0JBQXNCO0lBQ3RCLHVDQUF1QztDQUN2QyxDQUFDO0FBRUYsTUFBTSxlQUFlLEdBQUc7SUFDdkIsa0JBQWtCO0lBQ2xCLGtCQUFrQjtJQUNsQixvQ0FBb0M7SUFDcEMsNkRBQTZEO0NBQzdELENBQUM7QUFFSyxJQUFNLDZCQUE2QixHQUFuQyxNQUFNLDZCQUE2QjthQUNsQyxPQUFFLEdBQUcsV0FBVyxBQUFkLENBQWU7SUFReEIsWUFDVSxLQUFl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