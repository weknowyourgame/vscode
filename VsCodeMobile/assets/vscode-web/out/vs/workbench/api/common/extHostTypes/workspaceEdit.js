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
import { coalesceInPlace } from '../../../../base/common/arrays.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { NotebookEdit } from './notebooks.js';
import { SnippetTextEdit } from './snippetTextEdit.js';
import { es5ClassCompat } from './es5ClassCompat.js';
import { Range } from './range.js';
import { TextEdit } from './textEdit.js';
export var FileEditType;
(function (FileEditType) {
    FileEditType[FileEditType["File"] = 1] = "File";
    FileEditType[FileEditType["Text"] = 2] = "Text";
    FileEditType[FileEditType["Cell"] = 3] = "Cell";
    FileEditType[FileEditType["CellReplace"] = 5] = "CellReplace";
    FileEditType[FileEditType["Snippet"] = 6] = "Snippet";
})(FileEditType || (FileEditType = {}));
let WorkspaceEdit = class WorkspaceEdit {
    constructor() {
        this._edits = [];
    }
    _allEntries() {
        return this._edits;
    }
    // --- file
    renameFile(from, to, options, metadata) {
        this._edits.push({ _type: 1 /* FileEditType.File */, from, to, options, metadata });
    }
    createFile(uri, options, metadata) {
        this._edits.push({ _type: 1 /* FileEditType.File */, from: undefined, to: uri, options, metadata });
    }
    deleteFile(uri, options, metadata) {
        this._edits.push({ _type: 1 /* FileEditType.File */, from: uri, to: undefined, options, metadata });
    }
    // --- notebook
    replaceNotebookMetadata(uri, value, metadata) {
        this._edits.push({ _type: 3 /* FileEditType.Cell */, metadata, uri, edit: { editType: 5 /* CellEditType.DocumentMetadata */, metadata: value } });
    }
    replaceNotebookCells(uri, startOrRange, cellData, metadata) {
        const start = startOrRange.start;
        const end = startOrRange.end;
        if (start !== end || cellData.length > 0) {
            this._edits.push({ _type: 5 /* FileEditType.CellReplace */, uri, index: start, count: end - start, cells: cellData, metadata });
        }
    }
    replaceNotebookCellMetadata(uri, index, cellMetadata, metadata) {
        this._edits.push({ _type: 3 /* FileEditType.Cell */, metadata, uri, edit: { editType: 3 /* CellEditType.Metadata */, index, metadata: cellMetadata } });
    }
    // --- text
    replace(uri, range, newText, metadata) {
        this._edits.push({ _type: 2 /* FileEditType.Text */, uri, edit: new TextEdit(range, newText), metadata });
    }
    insert(resource, position, newText, metadata) {
        this.replace(resource, new Range(position, position), newText, metadata);
    }
    delete(resource, range, metadata) {
        this.replace(resource, range, '', metadata);
    }
    // --- text (Maplike)
    has(uri) {
        return this._edits.some(edit => edit._type === 2 /* FileEditType.Text */ && edit.uri.toString() === uri.toString());
    }
    set(uri, edits) {
        if (!edits) {
            // remove all text, snippet, or notebook edits for `uri`
            for (let i = 0; i < this._edits.length; i++) {
                const element = this._edits[i];
                switch (element._type) {
                    case 2 /* FileEditType.Text */:
                    case 6 /* FileEditType.Snippet */:
                    case 3 /* FileEditType.Cell */:
                    case 5 /* FileEditType.CellReplace */:
                        if (element.uri.toString() === uri.toString()) {
                            this._edits[i] = undefined; // will be coalesced down below
                        }
                        break;
                }
            }
            coalesceInPlace(this._edits);
        }
        else {
            // append edit to the end
            for (const editOrTuple of edits) {
                if (!editOrTuple) {
                    continue;
                }
                let edit;
                let metadata;
                if (Array.isArray(editOrTuple)) {
                    edit = editOrTuple[0];
                    metadata = editOrTuple[1];
                }
                else {
                    edit = editOrTuple;
                }
                if (NotebookEdit.isNotebookCellEdit(edit)) {
                    if (edit.newCellMetadata) {
                        this.replaceNotebookCellMetadata(uri, edit.range.start, edit.newCellMetadata, metadata);
                    }
                    else if (edit.newNotebookMetadata) {
                        this.replaceNotebookMetadata(uri, edit.newNotebookMetadata, metadata);
                    }
                    else {
                        this.replaceNotebookCells(uri, edit.range, edit.newCells, metadata);
                    }
                }
                else if (SnippetTextEdit.isSnippetTextEdit(edit)) {
                    this._edits.push({ _type: 6 /* FileEditType.Snippet */, uri, range: edit.range, edit: edit.snippet, metadata, keepWhitespace: edit.keepWhitespace });
                }
                else {
                    this._edits.push({ _type: 2 /* FileEditType.Text */, uri, edit, metadata });
                }
            }
        }
    }
    get(uri) {
        const res = [];
        for (const candidate of this._edits) {
            if (candidate._type === 2 /* FileEditType.Text */ && candidate.uri.toString() === uri.toString()) {
                res.push(candidate.edit);
            }
        }
        return res;
    }
    entries() {
        const textEdits = new ResourceMap();
        for (const candidate of this._edits) {
            if (candidate._type === 2 /* FileEditType.Text */) {
                let textEdit = textEdits.get(candidate.uri);
                if (!textEdit) {
                    textEdit = [candidate.uri, []];
                    textEdits.set(candidate.uri, textEdit);
                }
                textEdit[1].push(candidate.edit);
            }
        }
        return [...textEdits.values()];
    }
    get size() {
        return this.entries().length;
    }
    toJSON() {
        return this.entries();
    }
};
WorkspaceEdit = __decorate([
    es5ClassCompat
], WorkspaceEdit);
export { WorkspaceEdit };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya3NwYWNlRWRpdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0VHlwZXMvd29ya3NwYWNlRWRpdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDcEUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRzdELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDdkQsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBRXJELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDbkMsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQVV6QyxNQUFNLENBQU4sSUFBa0IsWUFNakI7QUFORCxXQUFrQixZQUFZO0lBQzdCLCtDQUFRLENBQUE7SUFDUiwrQ0FBUSxDQUFBO0lBQ1IsK0NBQVEsQ0FBQTtJQUNSLDZEQUFlLENBQUE7SUFDZixxREFBVyxDQUFBO0FBQ1osQ0FBQyxFQU5pQixZQUFZLEtBQVosWUFBWSxRQU03QjtBQTZDTSxJQUFNLGFBQWEsR0FBbkIsTUFBTSxhQUFhO0lBQW5CO1FBRVcsV0FBTSxHQUF5QixFQUFFLENBQUM7SUE4SXBELENBQUM7SUEzSUEsV0FBVztRQUNWLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUNwQixDQUFDO0lBRUQsV0FBVztJQUNYLFVBQVUsQ0FBQyxJQUFnQixFQUFFLEVBQWMsRUFBRSxPQUE2RSxFQUFFLFFBQTRDO1FBQ3ZLLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSywyQkFBbUIs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