/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { derived, ObservableSet } from '../../../../base/common/observable.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { ByteSize } from '../../../../platform/files/common/files.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { stringifyPromptElementJSON } from './tools/promptTsxTypes.js';
export var ToolDataSource;
(function (ToolDataSource) {
    ToolDataSource.Internal = { type: 'internal', label: 'Built-In' };
    /** External tools may not be contributed or invoked, but may be invoked externally and described in an IChatToolInvocationSerialized */
    ToolDataSource.External = { type: 'external', label: 'External' };
    function toKey(source) {
        switch (source.type) {
            case 'extension': return `extension:${source.extensionId.value}`;
            case 'mcp': return `mcp:${source.collectionId}:${source.definitionId}`;
            case 'user': return `user:${source.file.toString()}`;
            case 'internal': return 'internal';
            case 'external': return 'external';
        }
    }
    ToolDataSource.toKey = toKey;
    function equals(a, b) {
        return toKey(a) === toKey(b);
    }
    ToolDataSource.equals = equals;
    function classify(source) {
        if (source.type === 'internal') {
            return { ordinal: 1, label: localize('builtin', 'Built-In') };
        }
        else if (source.type === 'mcp') {
            return { ordinal: 2, label: source.label };
        }
        else if (source.type === 'user') {
            return { ordinal: 0, label: localize('user', 'User Defined') };
        }
        else {
            return { ordinal: 3, label: source.label };
        }
    }
    ToolDataSource.classify = classify;
})(ToolDataSource || (ToolDataSource = {}));
export function isToolInvocationContext(obj) {
    return typeof obj === 'object' && typeof obj.sessionId === 'string' && URI.isUri(obj.sessionResource);
}
export function isToolResultInputOutputDetails(obj) {
    return typeof obj === 'object' && typeof obj?.input === 'string' && (typeof obj?.output === 'string' || Array.isArray(obj?.output));
}
export function isToolResultOutputDetails(obj) {
    return typeof obj === 'object' && typeof obj?.output === 'object' && typeof obj?.output?.mimeType === 'string' && obj?.output?.type === 'data';
}
export function toolContentToA11yString(part) {
    return part.map(p => {
        switch (p.kind) {
            case 'promptTsx':
                return stringifyPromptTsxPart(p);
            case 'text':
                return p.value;
            case 'data':
                return localize('toolResultDataPartA11y', "{0} of {1} binary data", ByteSize.formatSize(p.value.data.byteLength), p.value.mimeType || 'unknown');
        }
    }).join(', ');
}
export function toolResultHasBuffers(result) {
    return result.content.some(part => part.kind === 'data');
}
export function stringifyPromptTsxPart(part) {
    return stringifyPromptElementJSON(part.value);
}
export var ToolInvocationPresentation;
(function (ToolInvocationPresentation) {
    ToolInvocationPresentation["Hidden"] = "hidden";
    ToolInvocationPresentation["HiddenAfterComplete"] = "hiddenAfterComplete";
})(ToolInvocationPresentation || (ToolInvocationPresentation = {}));
export class ToolSet {
    constructor(id, referenceName, icon, source, description, legacyFullNames) {
        this.id = id;
        this.referenceName = referenceName;
        this.icon = icon;
        this.source = source;
        this.description = description;
        this.legacyFullNames = legacyFullNames;
        this._tools = new ObservableSet();
        this._toolSets = new ObservableSet();
        this.isHomogenous = derived(r => {
            return !Iterable.some(this._tools.observable.read(r), tool => !ToolDataSource.equals(tool.source, this.source))
                && !Iterable.some(this._toolSets.observable.read(r), toolSet => !ToolDataSource.equals(toolSet.source, this.source));
        });
    }
    addTool(data, tx) {
        this._tools.add(data, tx);
        return toDisposable(() => {
            this._tools.delete(data);
        });
    }
    addToolSet(toolSet, tx) {
        if (toolSet === this) {
            return Disposable.None;
        }
        this._toolSets.add(toolSet, tx);
        return toDisposable(() => {
            this._toolSets.delete(toolSet);
        });
    }
    getTools(r) {
        return Iterable.concat(this._tools.observable.read(r), ...Iterable.map(this._toolSets.observable.read(r), toolSet => toolSet.getTools(r)));
    }
}
export const ILanguageModelToolsService = createDecorator('ILanguageModelToolsService');
export function createToolInputUri(toolCallId) {
    return URI.from({ scheme: Schemas.inMemory, path: `/lm/tool/${toolCallId}/tool_input.json` });
}
export function createToolSchemaUri(toolOrId) {
    if (typeof toolOrId !== 'string') {
        toolOrId = toolOrId.id;
    }
    return URI.from({ scheme: Schemas.vscode, authority: 'schemas', path: `/lm/tool/${toolOrId}` });
}
export var GithubCopilotToolReference;
(function (GithubCopilotToolReference) {
    GithubCopilotToolReference.shell = 'shell';
    GithubCopilotToolReference.edit = 'edit';
    GithubCopilotToolReference.search = 'search';
    GithubCopilotToolReference.customAgent = 'custom-agent';
})(GithubCopilotToolReference || (GithubCopilotToolReference = {}));
export var VSCodeToolReference;
(function (VSCodeToolReference) {
    VSCodeToolReference.agent = 'agent';
    VSCodeToolReference.execute = 'execute';
    VSCodeToolReference.runSubagent = 'runSubagent';
    VSCodeToolReference.vscode = 'vscode';
    VSCodeToolReference.read = 'read';
})(VSCodeToolReference || (VSCodeToolReference = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9sYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBT2hHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUUvRCxPQUFPLEVBQUUsVUFBVSxFQUFlLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzdGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RCxPQUFPLEVBQUUsT0FBTyxFQUFzQyxhQUFhLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUVuSCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFckQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBRzlDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFPN0YsT0FBTyxFQUFxQiwwQkFBMEIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBOEQxRixNQUFNLEtBQVcsY0FBYyxDQWdDOUI7QUFoQ0QsV0FBaUIsY0FBYztJQUVqQix1QkFBUSxHQUFtQixFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxDQUFDO0lBRWhGLHdJQUF3STtJQUMzSCx1QkFBUSxHQUFtQixFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxDQUFDO0lBRWhGLFNBQWdCLEtBQUssQ0FBQyxNQUFzQjtRQUMzQyxRQUFRLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNyQixLQUFLLFdBQVcsQ0FB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