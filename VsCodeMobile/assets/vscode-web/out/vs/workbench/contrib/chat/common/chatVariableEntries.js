/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../base/common/codicons.js';
import { basename } from '../../../../base/common/resources.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { isLocation } from '../../../../editor/common/languages.js';
import { localize } from '../../../../nls.js';
export var OmittedState;
(function (OmittedState) {
    OmittedState[OmittedState["NotOmitted"] = 0] = "NotOmitted";
    OmittedState[OmittedState["Partial"] = 1] = "Partial";
    OmittedState[OmittedState["Full"] = 2] = "Full";
})(OmittedState || (OmittedState = {}));
export var IDiagnosticVariableEntryFilterData;
(function (IDiagnosticVariableEntryFilterData) {
    IDiagnosticVariableEntryFilterData.icon = Codicon.error;
    function fromMarker(marker) {
        return {
            filterUri: marker.resource,
            owner: marker.owner,
            problemMessage: marker.message,
            filterRange: { startLineNumber: marker.startLineNumber, endLineNumber: marker.endLineNumber, startColumn: marker.startColumn, endColumn: marker.endColumn }
        };
    }
    IDiagnosticVariableEntryFilterData.fromMarker = fromMarker;
    function toEntry(data) {
        return {
            id: id(data),
            name: label(data),
            icon: IDiagnosticVariableEntryFilterData.icon,
            value: data,
            kind: 'diagnostic',
            ...data,
        };
    }
    IDiagnosticVariableEntryFilterData.toEntry = toEntry;
    function id(data) {
        return [data.filterUri, data.owner, data.filterSeverity, data.filterRange?.startLineNumber, data.filterRange?.startColumn].join(':');
    }
    IDiagnosticVariableEntryFilterData.id = id;
    function label(data) {
        let TrimThreshold;
        (function (TrimThreshold) {
            TrimThreshold[TrimThreshold["MaxChars"] = 30] = "MaxChars";
            TrimThreshold[TrimThreshold["MaxSpaceLookback"] = 10] = "MaxSpaceLookback";
        })(TrimThreshold || (TrimThreshold = {}));
        if (data.problemMessage) {
            if (data.problemMessage.length < 30 /* TrimThreshold.MaxChars */) {
                return data.problemMessage;
            }
            // Trim the message, on a space if it would not lose too much
            // data (MaxSpaceLookback) or just blindly otherwise.
            const lastSpace = data.problemMessage.lastIndexOf(' ', 30 /* TrimThreshold.MaxChars */);
            if (lastSpace === -1 || lastSpace + 10 /* TrimThreshold.MaxSpaceLookback */ < 30 /* TrimThreshold.MaxChars */) {
                return data.problemMessage.substring(0, 30 /* TrimThreshold.MaxChars */) + '…';
            }
            return data.problemMessage.substring(0, lastSpace) + '…';
        }
        let labelStr = localize('chat.attachment.problems.all', "All Problems");
        if (data.filterUri) {
            labelStr = localize('chat.attachment.problems.inFile', "Problems in {0}", basename(data.filterUri));
        }
        return labelStr;
    }
    IDiagnosticVariableEntryFilterData.label = label;
})(IDiagnosticVariableEntryFilterData || (IDiagnosticVariableEntryFilterData = {}));
export var IChatRequestVariableEntry;
(function (IChatRequestVariableEntry) {
    /**
     * Returns URI of the passed variant entry. Return undefined if not found.
     */
    function toUri(entry) {
        return URI.isUri(entry.value)
            ? entry.value
            : isLocation(entry.value)
                ? entry.value.uri
                : undefined;
    }
    IChatRequestVariableEntry.toUri = toUri;
})(IChatRequestVariableEntry || (IChatRequestVariableEntry = {}));
export function isImplicitVariableEntry(obj) {
    return obj.kind === 'implicit';
}
export function isStringVariableEntry(obj) {
    return obj.kind === 'string';
}
export function isTerminalVariableEntry(obj) {
    return obj.kind === 'terminalCommand';
}
export function isPasteVariableEntry(obj) {
    return obj.kind === 'paste';
}
export function isWorkspaceVariableEntry(obj) {
    return obj.kind === 'workspace';
}
export function isImageVariableEntry(obj) {
    return obj.kind === 'image';
}
export function isNotebookOutputVariableEntry(obj) {
    return obj.kind === 'notebookOutput';
}
export function isElementVariableEntry(obj) {
    return obj.kind === 'element';
}
export function isDiagnosticsVariableEntry(obj) {
    return obj.kind === 'diagnostic';
}
export function isChatRequestFileEntry(obj) {
    return obj.kind === 'file';
}
export function isPromptFileVariableEntry(obj) {
    return obj.kind === 'promptFile';
}
export function isPromptTextVariableEntry(obj) {
    return obj.kind === 'promptText';
}
export function isChatRequestVariableEntry(obj) {
    const entry = obj;
    return typeof entry === 'object' &&
        entry !== null &&
        typeof entry.id === 'string' &&
        typeof entry.name === 'string';
}
export function isSCMHistoryItemVariableEntry(obj) {
    return obj.kind === 'scmHistoryItem';
}
export function isSCMHistoryItemChangeVariableEntry(obj) {
    return obj.kind === 'scmHistoryItemChange';
}
export function isSCMHistoryItemChangeRangeVariableEntry(obj) {
    return obj.kind === 'scmHistoryItemChangeRange';
}
export function isStringImplicitContextValue(value) {
    const asStringImplicitContextValue = value;
    return (typeof asStringImplicitContextValue === 'object' &&
        asStringImplicitContextValue !== null &&
        (typeof asStringImplicitContextValue.value === 'string' || typeof asStringImplicitContextValue.value === 'undefined') &&
        typeof asStringImplicitContextValue.name === 'string' &&
        ThemeIcon.isThemeIcon(asStringImplicitContextValue.icon) &&
        URI.isUri(asStringImplicitContextValue.uri));
}
export var PromptFileVariableKind;
(function (PromptFileVariableKind) {
    PromptFileVariableKind["Instruction"] = "vscode.prompt.instructions.root";
    PromptFileVariableKind["InstructionReference"] = "vscode.prompt.instructions";
    PromptFileVariableKind["PromptFile"] = "vscode.prompt.file";
})(PromptFileVariableKind || (PromptFileVariableKind = {}));
/**
 * Utility to convert a {@link uri} to a chat variable entry.
 * The `id` of the chat variable can be one of the following:
 *
 * - `vscode.prompt.instructions__<URI>`: for all non-root prompt instructions references
 * - `vscode.prompt.instructions.root__<URI>`: for *root* prompt instructions references
 * - `vscode.prompt.file__<URI>`: for prompt file references
 *
 * @param uri A resource URI that points to a prompt instructions file.
 * @param kind The kind of the prompt file variable entry.
 */
export function toPromptFileVariableEntry(uri, kind, originLabel, automaticallyAdded = false, toolReferences) {
    //  `id` for all `prompt files` starts with the well-defined part that the copilot extension(or other chatbot) can rely on
    return {
        id: `${kind}__${uri.toString()}`,
        name: `prompt:${basename(uri)}`,
        value: uri,
        kind: 'promptFile',
        modelDescription: 'Prompt instructions file',
        isRoot: kind !== PromptFileVariableKind.InstructionReference,
        originLabel,
        toolReferences,
        automaticallyAdded
    };
}
export function toPromptTextVariableEntry(content, automaticallyAdded = false, toolReferences) {
    return {
        id: `vscode.prompt.instructions.text`,
        name: `prompt:instructionsList`,
        value: content,
        kind: 'promptText',
        modelDescription: 'Prompt instructions list',
        automaticallyAdded,
        toolReferences
    };
}
export function toFileVariableEntry(uri, range) {
    return {
        kind: 'file',
        value: range ? { uri, range } : uri,
        id: uri.toString() + (range?.toString() ?? ''),
        name: basename(uri),
    };
}
export function toToolVariableEntry(entry, range) {
    return {
        kind: 'tool',
        id: entry.id,
        icon: ThemeIcon.isThemeIcon(entry.icon) ? entry.icon : undefined,
        name: entry.displayName,
        value: undefined,
        range
    };
}
export function toToolSetVariableEntry(entry, range) {
    return {
        kind: 'toolset',
        id: entry.id,
        icon: entry.icon,
        name: entry.referenceName,
        value: Array.from(entry.getTools()).map(t => toToolVariableEntry(t)),
        range
    };
}
export class ChatRequestVariableSet {
    constructor(entries) {
        this._ids = new Set();
        this._entries = [];
        if (entries) {
            this.add(...entries);
        }
    }
    add(...entry) {
        for (const e of entry) {
            if (!this._ids.has(e.id)) {
                this._ids.add(e.id);
                this._entries.push(e);
            }
        }
    }
    insertFirst(entry) {
        if (!this._ids.has(entry.id)) {
            this._ids.add(entry.id);
            this._entries.unshift(entry);
        }
    }
    remove(entry) {
        this._ids.delete(entry.id);
        this._entries = this._entries.filter(e => e.id !== entry.id);
    }
    has(entry) {
        return this._ids.has(entry.id);
    }
    asArray() {
        return this._entries.slice(0); // return a copy
    }
    get length() {
        return this._entries.length;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFZhcmlhYmxlRW50cmllcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0VmFyaWFibGVFbnRyaWVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDaEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUdyRCxPQUFPLEVBQUUsVUFBVSxFQUF3QixNQUFNLHdDQUF3QyxDQUFDO0FBQzFGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQXNDOUMsTUFBTSxDQUFOLElBQWtCLFlBSWpCO0FBSkQsV0FBa0IsWUFBWTtJQUM3QiwyREFBVSxDQUFBO0lBQ1YscURBQU8sQ0FBQTtJQUNQLCtDQUFJLENBQUE7QUFDTCxDQUFDLEVBSmlCLFlBQVksS0FBWixZQUFZLFFBSTdCO0FBOEZELE1BQU0sS0FBVyxrQ0FBa0MsQ0FvRGxEO0FBcERELFdBQWlCLGtDQUFrQztJQUNyQyx1Q0FBSSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFFbEMsU0FBZ0IsVUFBVSxDQUFDLE1BQWU7UUFDekMsT0FBTztZQUNOLFNBQVMsRUFBRSxNQUFNLENBQUMsUUFBUTtZQUMxQixLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUs7WUFDbkIsY0FBYyxFQUFFLE1BQU0sQ0FBQyxPQUFPO1lBQzlCLFdBQVcsRUFBRSxFQUFFLGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZSxFQUFFLGFBQWEsRUFBRSxNQUFNLENBQUMsYUFBYSxFQUFFLFdBQVcsRUFBRSxNQUFN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