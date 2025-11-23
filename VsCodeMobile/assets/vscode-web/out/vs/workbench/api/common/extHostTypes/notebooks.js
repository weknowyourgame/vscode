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
var NotebookEdit_1;
import { es5ClassCompat } from './es5ClassCompat.js';
import { illegalArgument } from '../../../../base/common/errors.js';
import { Mimes, normalizeMimeType, isTextStreamMime } from '../../../../base/common/mime.js';
import { generateUuid } from '../../../../base/common/uuid.js';
/* eslint-disable local/code-no-native-private */
export var NotebookCellKind;
(function (NotebookCellKind) {
    NotebookCellKind[NotebookCellKind["Markup"] = 1] = "Markup";
    NotebookCellKind[NotebookCellKind["Code"] = 2] = "Code";
})(NotebookCellKind || (NotebookCellKind = {}));
export class NotebookRange {
    static isNotebookRange(thing) {
        if (thing instanceof NotebookRange) {
            return true;
        }
        if (!thing) {
            return false;
        }
        return typeof thing.start === 'number'
            && typeof thing.end === 'number';
    }
    get start() {
        return this._start;
    }
    get end() {
        return this._end;
    }
    get isEmpty() {
        return this._start === this._end;
    }
    constructor(start, end) {
        if (start < 0) {
            throw illegalArgument('start must be positive');
        }
        if (end < 0) {
            throw illegalArgument('end must be positive');
        }
        if (start <= end) {
            this._start = start;
            this._end = end;
        }
        else {
            this._start = end;
            this._end = start;
        }
    }
    with(change) {
        let start = this._start;
        let end = this._end;
        if (change.start !== undefined) {
            start = change.start;
        }
        if (change.end !== undefined) {
            end = change.end;
        }
        if (start === this._start && end === this._end) {
            return this;
        }
        return new NotebookRange(start, end);
    }
}
export class NotebookCellData {
    static validate(data) {
        if (typeof data.kind !== 'number') {
            throw new Error('NotebookCellData MUST have \'kind\' property');
        }
        if (typeof data.value !== 'string') {
            throw new Error('NotebookCellData MUST have \'value\' property');
        }
        if (typeof data.languageId !== 'string') {
            throw new Error('NotebookCellData MUST have \'languageId\' property');
        }
    }
    static isNotebookCellDataArray(value) {
        return Array.isArray(value) && value.every(elem => NotebookCellData.isNotebookCellData(elem));
    }
    static isNotebookCellData(value) {
        // return value instanceof NotebookCellData;
        return true;
    }
    constructor(kind, value, languageId, mime, outputs, metadata, executionSummary) {
        this.kind = kind;
        this.value = value;
        this.languageId = languageId;
        this.mime = mime;
        this.outputs = outputs ?? [];
        this.metadata = metadata;
        this.executionSummary = executionSummary;
        NotebookCellData.validate(this);
    }
}
export class NotebookData {
    constructor(cells) {
        this.cells = cells;
    }
}
let NotebookEdit = NotebookEdit_1 = class NotebookEdit {
    static isNotebookCellEdit(thing) {
        if (thing instanceof NotebookEdit_1) {
            return true;
        }
        if (!thing) {
            return false;
        }
        return NotebookRange.isNotebookRange(thing)
            && Array.isArray(thing.newCells);
    }
    static replaceCells(range, newCells) {
        return new NotebookEdit_1(range, newCells);
    }
    static insertCells(index, newCells) {
        return new NotebookEdit_1(new NotebookRange(index, index), newCells);
    }
    static deleteCells(range) {
        return new NotebookEdit_1(range, []);
    }
    static updateCellMetadata(index, newMetadata) {
        const edit = new NotebookEdit_1(new NotebookRange(index, index), []);
        edit.newCellMetadata = newMetadata;
        return edit;
    }
    static updateNotebookMetadata(newMetadata) {
        const edit = new NotebookEdit_1(new NotebookRange(0, 0), []);
        edit.newNotebookMetadata = newMetadata;
        return edit;
    }
    constructor(range, newCells) {
        this.range = range;
        this.newCells = newCells;
    }
};
NotebookEdit = NotebookEdit_1 = __decorate([
    es5ClassCompat
], NotebookEdit);
export { NotebookEdit };
export class NotebookCellOutputItem {
    static isNotebookCellOutputItem(obj) {
        if (obj instanceof NotebookCellOutputItem) {
            return true;
        }
        if (!obj) {
            return false;
        }
        return typeof obj.mime === 'string'
            && obj.data instanceof Uint8Array;
    }
    static error(err) {
        const obj = {
            name: err.name,
            message: err.message,
            stack: err.stack
        };
        return NotebookCellOutputItem.json(obj, 'application/vnd.code.notebook.error');
    }
    static stdout(value) {
        return NotebookCellOutputItem.text(value, 'application/vnd.code.notebook.stdout');
    }
    static stderr(value) {
        return NotebookCellOutputItem.text(value, 'application/vnd.code.notebook.stderr');
    }
    static bytes(value, mime = 'application/octet-stream') {
        return new NotebookCellOutputItem(value, mime);
    }
    static #encoder = new TextEncoder();
    static text(value, mime = Mimes.text) {
        const bytes = NotebookCellOutputItem.#encoder.encode(String(value));
        return new NotebookCellOutputItem(bytes, mime);
    }
    static json(value, mime = 'text/x-json') {
        const rawStr = JSON.stringify(value, undefined, '\t');
        return NotebookCellOutputItem.text(rawStr, mime);
    }
    constructor(data, mime) {
        this.data = data;
        this.mime = mime;
        const mimeNormalized = normalizeMimeType(mime, true);
        if (!mimeNormalized) {
            throw new Error(`INVALID mime type: ${mime}. Must be in the format "type/subtype[;optionalparameter]"`);
        }
        this.mime = mimeNormalized;
    }
}
export class NotebookCellOutput {
    static isNotebookCellOutput(candidate) {
        if (candidate instanceof NotebookCellOutput) {
            return true;
        }
        if (!candidate || typeof candidate !== 'object') {
            return false;
        }
        return typeof candidate.id === 'string' && Array.isArray(candidate.items);
    }
    static ensureUniqueMimeTypes(items, warn = false) {
        const seen = new Set();
        const removeIdx = new Set();
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const normalMime = normalizeMimeType(item.mime);
            // We can have multiple text stream mime types in the same output.
            if (!seen.has(normalMime) || isTextStreamMime(normalMime)) {
                seen.add(normalMime);
                continue;
            }
            // duplicated mime types... first has won
            removeIdx.add(i);
            if (warn) {
                console.warn(`DUPLICATED mime type '${item.mime}' will be dropped`);
            }
        }
        if (removeIdx.size === 0) {
            return items;
        }
        return items.filter((_item, index) => !removeIdx.has(index));
    }
    constructor(items, idOrMetadata, metadata) {
        this.items = NotebookCellOutput.ensureUniqueMimeTypes(items, true);
        if (typeof idOrMetadata === 'string') {
            this.id = idOrMetadata;
            this.metadata = metadata;
        }
        else {
            this.id = generateUuid();
            this.metadata = idOrMetadata ?? metadata;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvY29tbW9uL2V4dEhvc3RUeXBlcy9ub3RlYm9va3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDcEUsT0FBTyxFQUFFLEtBQUssRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzdGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUUvRCxpREFBaUQ7QUFFakQsTUFBTSxDQUFOLElBQVksZ0JBR1g7QUFIRCxXQUFZLGdCQUFnQjtJQUMzQiwyREFBVSxDQUFBO0lBQ1YsdURBQVEsQ0FBQTtBQUNULENBQUMsRUFIVyxnQkFBZ0IsS0FBaEIsZ0JBQWdCLFFBRzNCO0FBRUQsTUFBTSxPQUFPLGFBQWE7SUFDekIsTUFBTSxDQUFDLGVBQWUsQ0FBQyxLQUFjO1FBQ3BDLElBQUksS0FBSyxZQUFZLGFBQWEsRUFBRSxDQUFDO1lBQ3BDLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUNELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNaLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELE9BQU8sT0FBdUIsS0FBTSxDQUFDLEtBQUssS0FBSyxRQUFRO2VBQ25ELE9BQXVCLEtBQU0sQ0FBQyxHQUFHLEtBQUssUUFBUSxDQUFDO0lBQ3BELENBQUM7SUFLRCxJQUFJLEtBQUs7UUFDUixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDcEIsQ0FBQztJQUVELElBQUksR0FBRztRQUNOLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQztJQUNsQixDQUFD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