/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { sumBy } from '../../base/common/arrays.js';
import { prefixedUuid } from '../../base/common/uuid.js';
import { LineEdit } from './core/edits/lineEdit.js';
import { TextLength } from './core/text/textLength.js';
const privateSymbol = Symbol('TextModelEditSource');
export class TextModelEditSource {
    constructor(metadata, _privateCtorGuard) {
        this.metadata = metadata;
    }
    toString() {
        return `${this.metadata.source}`;
    }
    getType() {
        const metadata = this.metadata;
        switch (metadata.source) {
            case 'cursor':
                return metadata.kind;
            case 'inlineCompletionAccept':
                return metadata.source + (metadata.$nes ? ':nes' : '');
            case 'unknown':
                return metadata.name || 'unknown';
            default:
                return metadata.source;
        }
    }
    /**
     * Converts the metadata to a key string.
     * Only includes properties/values that have `level` many `$` prefixes or less.
    */
    toKey(level, filter = {}) {
        const metadata = this.metadata;
        const keys = Object.entries(metadata).filter(([key, value]) => {
            const filterVal = filter[key];
            if (filterVal !== undefined) {
                return filterVal;
            }
            const prefixCount = (key.match(/\$/g) || []).length;
            return prefixCount <= level && value !== undefined && value !== null && value !== '';
        }).map(([key, value]) => `${key}:${value}`);
        return keys.join('-');
    }
    get props() {
        // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
        return this.metadata;
    }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createEditSource(metadata) {
    // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
    return new TextModelEditSource(metadata, privateSymbol);
}
export function isAiEdit(source) {
    switch (source.metadata.source) {
        case 'inlineCompletionAccept':
        case 'inlineCompletionPartialAccept':
        case 'inlineChat.applyEdits':
        case 'Chat.applyEdits':
            return true;
    }
    return false;
}
export function isUserEdit(source) {
    switch (source.metadata.source) {
        case 'cursor':
            return source.metadata.kind === 'type';
    }
    return false;
}
export const EditSources = {
    unknown(data) {
        return createEditSource({
            source: 'unknown',
            name: data.name,
        });
    },
    rename: (oldName, newName) => createEditSource({ source: 'rename', $$$oldName: oldName, $$$newName: newName }),
    chatApplyEdits(data) {
        return createEditSource({
            source: 'Chat.applyEdits',
            $modelId: avoidPathRedaction(data.modelId),
            $extensionId: data.extensionId?.extensionId,
            $extensionVersion: data.extensionId?.version,
            $$languageId: data.languageId,
            $$sessionId: data.sessionId,
            $$requestId: data.requestId,
            $$mode: data.mode,
            $$codeBlockSuggestionId: data.codeBlockSuggestionId,
        });
    },
    chatUndoEdits: () => createEditSource({ source: 'Chat.undoEdits' }),
    chatReset: () => createEditSource({ source: 'Chat.reset' }),
    inlineCompletionAccept(data) {
        return createEditSource({
            source: 'inlineCompletionAccept',
            $nes: data.nes,
            ...toProperties(data.providerId),
            $$requestUuid: data.requestUuid,
            $$languageId: data.languageId,
        });
    },
    inlineCompletionPartialAccept(data) {
        return createEditSource({
            source: 'inlineCompletionPartialAccept',
            type: data.type,
            $nes: data.nes,
            ...toProperties(data.providerId),
            $$requestUuid: data.requestUuid,
            $$languageId: data.languageId,
        });
    },
    inlineChatApplyEdit(data) {
        return createEditSource({
            source: 'inlineChat.applyEdits',
            $modelId: avoidPathRedaction(data.modelId),
            $extensionId: data.extensionId?.extensionId,
            $extensionVersion: data.extensionId?.version,
            $$sessionId: data.sessionId,
            $$requestId: data.requestId,
            $$languageId: data.languageId,
        });
    },
    reloadFromDisk: () => createEditSource({ source: 'reloadFromDisk' }),
    cursor(data) {
        return createEditSource({
            source: 'cursor',
            kind: data.kind,
            detailedSource: data.detailedSource,
        });
    },
    setValue: () => createEditSource({ source: 'setValue' }),
    eolChange: () => createEditSource({ source: 'eolChange' }),
    applyEdits: () => createEditSource({ source: 'applyEdits' }),
    snippet: () => createEditSource({ source: 'snippet' }),
    suggest: (data) => createEditSource({ source: 'suggest', ...toProperties(data.providerId) }),
    codeAction: (data) => createEditSource({ source: 'codeAction', $kind: data.kind, ...toProperties(data.providerId) })
};
function toProperties(version) {
    if (!version) {
        return {};
    }
    return {
        $extensionId: version.extensionId,
        $extensionVersion: version.extensionVersion,
        $providerId: version.providerId,
    };
}
function avoidPathRedaction(str) {
    if (str === undefined) {
        return undefined;
    }
    // To avoid false-positive file path redaction.
    return str.replaceAll('/', '|');
}
export class EditDeltaInfo {
    static fromText(text) {
        const linesAdded = TextLength.ofText(text).lineCount;
        const charsAdded = text.length;
        return new EditDeltaInfo(linesAdded, 0, charsAdded, 0);
    }
    /** @internal */
    static fromEdit(edit, originalString) {
        const lineEdit = LineEdit.fromStringEdit(edit, originalString);
        const linesAdded = sumBy(lineEdit.replacements, r => r.newLines.length);
        const linesRemoved = sumBy(lineEdit.replacements, r => r.lineRange.length);
        const charsAdded = sumBy(edit.replacements, r => r.getNewLength());
        const charsRemoved = sumBy(edit.replacements, r => r.replaceRange.length);
        return new EditDeltaInfo(linesAdded, linesRemoved, charsAdded, charsRemoved);
    }
    static tryCreate(linesAdded, linesRemoved, charsAdded, charsRemoved) {
        if (linesAdded === undefined || linesRemoved === undefined || charsAdded === undefined || charsRemoved === undefined) {
            return undefined;
        }
        return new EditDeltaInfo(linesAdded, linesRemoved, charsAdded, charsRemoved);
    }
    constructor(linesAdded, linesRemoved, charsAdded, charsRemoved) {
        this.linesAdded = linesAdded;
        this.linesRemoved = linesRemoved;
        this.charsAdded = charsAdded;
        this.charsRemoved = charsRemoved;
    }
}
export var EditSuggestionId;
(function (EditSuggestionId) {
    /**
     * Use AiEditTelemetryServiceImpl to create a new id!
    */
    function newId(genPrefixedUuid) {
        const id = genPrefixedUuid ? genPrefixedUuid('sgt') : prefixedUuid('sgt');
        return toEditIdentity(id);
    }
    EditSuggestionId.newId = newId;
})(EditSuggestionId || (EditSuggestionId = {}));
function toEditIdentity(id) {
    return id;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dE1vZGVsRWRpdFNvdXJjZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL3RleHRNb2RlbEVkaXRTb3VyY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ3BELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUN6RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFHcEQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBR3ZELE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0FBRXBELE1BQU0sT0FBTyxtQkFBbUI7SUFDL0IsWUFDaUIsUUFBc0MsRUFDdEQsaUJBQXVDO1FBRHZCLGFBQVEsR0FBUixRQUFRLENBQThCO0lBRW5ELENBQUM7SUFFRSxRQUFRO1FBQ2QsT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDbEMsQ0FBQztJQUVNLE9BQU87UUFDYixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQy9CLFFBQVEsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3pCLEtBQUssUUFBUTtnQkFDWixPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUM7WUFDdEIsS0FBSyx3QkFBd0I7Z0JBQzVCLE9BQU8sUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDeEQsS0FBSyxTQUFTO2dCQUNiLE9BQU8sUUFBUSxDQUFDLElBQUksSUFBSSxTQUFTLENBQUM7WUFDbkM7Z0JBQ0MsT0FBTyxRQUFRLENB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