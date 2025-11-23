/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { VSBuffer } from '../../../../base/common/buffer.js';
import * as glob from '../../../../base/common/glob.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Mimes } from '../../../../base/common/mime.js';
import { Schemas } from '../../../../base/common/network.js';
import { basename } from '../../../../base/common/path.js';
import { isWindows } from '../../../../base/common/platform.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { generateMetadataUri, generate as generateUri, extractCellOutputDetails, parseMetadataUri, parse as parseUri } from '../../../services/notebook/common/notebookDocumentService.js';
export const NOTEBOOK_EDITOR_ID = 'workbench.editor.notebook';
export const NOTEBOOK_DIFF_EDITOR_ID = 'workbench.editor.notebookTextDiffEditor';
export const NOTEBOOK_MULTI_DIFF_EDITOR_ID = 'workbench.editor.notebookMultiTextDiffEditor';
export const INTERACTIVE_WINDOW_EDITOR_ID = 'workbench.editor.interactive';
export const REPL_EDITOR_ID = 'workbench.editor.repl';
export const NOTEBOOK_OUTPUT_EDITOR_ID = 'workbench.editor.notebookOutputEditor';
export const EXECUTE_REPL_COMMAND_ID = 'replNotebook.input.execute';
export var CellKind;
(function (CellKind) {
    CellKind[CellKind["Markup"] = 1] = "Markup";
    CellKind[CellKind["Code"] = 2] = "Code";
})(CellKind || (CellKind = {}));
export const NOTEBOOK_DISPLAY_ORDER = [
    'application/json',
    'application/javascript',
    'text/html',
    'image/svg+xml',
    Mimes.latex,
    Mimes.markdown,
    'image/png',
    'image/jpeg',
    Mimes.text
];
export const ACCESSIBLE_NOTEBOOK_DISPLAY_ORDER = [
    Mimes.latex,
    Mimes.markdown,
    'application/json',
    'text/html',
    'image/svg+xml',
    'image/png',
    'image/jpeg',
    Mimes.text,
];
/**
 * A mapping of extension IDs who contain renderers, to notebook ids who they
 * should be treated as the same in the renderer selection logic. This is used
 * to prefer the 1st party Jupyter renderers even though they're in a separate
 * extension, for instance. See #136247.
 */
export const RENDERER_EQUIVALENT_EXTENSIONS = new Map([
    ['ms-toolsai.jupyter', new Set(['jupyter-notebook', 'interactive'])],
    ['ms-toolsai.jupyter-renderers', new Set(['jupyter-notebook', 'interactive'])],
]);
export const RENDERER_NOT_AVAILABLE = '_notAvailable';
export var NotebookRunState;
(function (NotebookRunState) {
    NotebookRunState[NotebookRunState["Running"] = 1] = "Running";
    NotebookRunState[NotebookRunState["Idle"] = 2] = "Idle";
})(NotebookRunState || (NotebookRunState = {}));
export var NotebookCellExecutionState;
(function (NotebookCellExecutionState) {
    NotebookCellExecutionState[NotebookCellExecutionState["Unconfirmed"] = 1] = "Unconfirmed";
    NotebookCellExecutionState[NotebookCellExecutionState["Pending"] = 2] = "Pending";
    NotebookCellExecutionState[NotebookCellExecutionState["Executing"] = 3] = "Executing";
})(NotebookCellExecutionState || (NotebookCellExecutionState = {}));
export var NotebookExecutionState;
(function (NotebookExecutionState) {
    NotebookExecutionState[NotebookExecutionState["Unconfirmed"] = 1] = "Unconfirmed";
    NotebookExecutionState[NotebookExecutionState["Pending"] = 2] = "Pending";
    NotebookExecutionState[NotebookExecutionState["Executing"] = 3] = "Executing";
})(NotebookExecutionState || (NotebookExecutionState = {}));
/** Note: enum values are used for sorting */
export var NotebookRendererMatch;
(function (NotebookRendererMatch) {
    /** Renderer has a hard dependency on an available kernel */
    NotebookRendererMatch[NotebookRendererMatch["WithHardKernelDependency"] = 0] = "WithHardKernelDependency";
    /** Renderer works better with an available kernel */
    NotebookRendererMatch[NotebookRendererMatch["WithOptionalKernelDependency"] = 1] = "WithOptionalKernelDependency";
    /** Renderer is kernel-agnostic */
    NotebookRendererMatch[NotebookRendererMatch["Pure"] = 2] = "Pure";
    /** Renderer is for a different mimeType or has a hard dependency which is unsatisfied */
    NotebookRendererMatch[NotebookRendererMatch["Never"] = 3] = "Never";
})(NotebookRendererMatch || (NotebookRendererMatch = {}));
/**
 * Renderer messaging requirement. While this allows for 'optional' messaging,
 * VS Code effectively treats it the same as true right now. "Partial
 * activation" of extensions is a very tricky problem, which could allow
 * solving this. But for now, optional is mostly only honored for aznb.
 */
export var RendererMessagingSpec;
(function (RendererMessagingSpec) {
    RendererMessagingSpec["Always"] = "always";
    RendererMessagingSpec["Never"] = "never";
    RendererMessagingSpec["Optional"] = "optional";
})(RendererMessagingSpec || (RendererMessagingSpec = {}));
export var NotebookCellsChangeType;
(function (NotebookCellsChangeType) {
    NotebookCellsChangeType[NotebookCellsChangeType["ModelChange"] = 1] = "ModelChange";
    NotebookCellsChangeType[NotebookCellsChangeType["Move"] = 2] = "Move";
    NotebookCellsChangeType[NotebookCellsChangeType["ChangeCellLanguage"] = 5] = "ChangeCellLanguage";
    NotebookCellsChangeType[NotebookCellsChangeType["Initialize"] = 6] = "Initialize";
    NotebookCellsChangeType[NotebookCellsChangeType["ChangeCellMetadata"] = 7] = "ChangeCellMetadata";
    NotebookCellsChangeType[NotebookCellsChangeType["Output"] = 8] = "Output";
    NotebookCellsChangeType[NotebookCellsChangeType["OutputItem"] = 9] = "OutputItem";
    NotebookCellsChangeType[NotebookCellsChangeType["ChangeCellContent"] = 10] = "ChangeCellContent";
    NotebookCellsChangeType[NotebookCellsChangeType["ChangeDocumentMetadata"] = 11] = "ChangeDocumentMetadata";
    NotebookCellsChangeType[NotebookCellsChangeType["ChangeCellInternalMetadata"] = 12] = "ChangeCellInternalMetadata";
    NotebookCellsChangeType[NotebookCellsChangeType["ChangeCellMime"] = 13] = "ChangeCellMime";
    NotebookCellsChangeType[NotebookCellsChangeType["Unknown"] = 100] = "Unknown";
})(NotebookCellsChangeType || (NotebookCellsChangeType = {}));
export var SelectionStateType;
(function (SelectionStateType) {
    SelectionStateType[SelectionStateType["Handle"] = 0] = "Handle";
    SelectionStateType[SelectionStateType["Index"] = 1] = "Index";
})(SelectionStateType || (SelectionStateType = {}));
export var CellEditType;
(function (CellEditType) {
    CellEditType[CellEditType["Replace"] = 1] = "Replace";
    CellEditType[CellEditType["Output"] = 2] = "Output";
    CellEditType[CellEditType["Metadata"] = 3] = "Metadata";
    CellEditType[CellEditType["CellLanguage"] = 4] = "CellLanguage";
    CellEditType[CellEditType["DocumentMetadata"] = 5] = "DocumentMetadata";
    CellEditType[CellEditType["Move"] = 6] = "Move";
    CellEditType[CellEditType["OutputItems"] = 7] = "OutputItems";
    CellEditType[CellEditType["PartialMetadata"] = 8] = "PartialMetadata";
    CellEditType[CellEditType["PartialInternalMetadata"] = 9] = "PartialInternalMetadata";
})(CellEditType || (CellEditType = {}));
export var NotebookMetadataUri;
(function (NotebookMetadataUri) {
    NotebookMetadataUri.scheme = Schemas.vscodeNotebookMetadata;
    function generate(notebook) {
        return generateMetadataUri(notebook);
    }
    NotebookMetadataUri.generate = generate;
    function parse(metadata) {
        return parseMetadataUri(metadata);
    }
    NotebookMetadataUri.parse = parse;
})(NotebookMetadataUri || (NotebookMetadataUri = {}));
export var CellUri;
(function (CellUri) {
    CellUri.scheme = Schemas.vscodeNotebookCell;
    function generate(notebook, handle) {
        return generateUri(notebook, handle);
    }
    CellUri.generate = generate;
    function parse(cell) {
        return parseUri(cell);
    }
    CellUri.parse = parse;
    /**
     * Generates a URI for a cell output in a notebook using the output ID.
     * Used when URI should be opened as text in the editor.
     */
    function generateCellOutputUriWithId(notebook, outputId) {
        return notebook.with({
            scheme: Schemas.vscodeNotebookCellOutput,
            query: new URLSearchParams({
                openIn: 'editor',
                outputId: outputId ?? '',
                notebookScheme: notebook.scheme !== Schemas.file ? notebook.scheme : '',
            }).toString()
        });
    }
    CellUri.generateCellOutputUriWithId = generateCellOutputUriWithId;
    /**
     * Generates a URI for a cell output in a notebook using the output index.
     * Used when URI should be opened in notebook editor.
     */
    function generateCellOutputUriWithIndex(notebook, cellUri, outputIndex) {
        return notebook.with({
            scheme: Schemas.vscodeNotebookCellOutput,
            fragment: cellUri.fragment,
            query: new URLSearchParams({
                openIn: 'notebook',
                outputIndex: String(outputIndex),
            }).toString()
        });
    }
    CellUri.generateCellOutputUriWithIndex = generateCellOutputUriWithIndex;
    function generateOutputEditorUri(notebook, cellId, cellIndex, outputId, outputIndex) {
        return notebook.with({
            scheme: Schemas.vscodeNotebookCellOutput,
            query: new URLSearchParams({
                openIn: 'notebookOutputEditor',
                notebook: notebook.toString(),
                cellIndex: String(cellIndex),
                outputId: outputId,
                outputIndex: String(outputIndex),
            }).toString()
        });
    }
    CellUri.generateOutputEditorUri = generateOutputEditorUri;
    function parseCellOutputUri(uri) {
        return extractCellOutputDetails(uri);
    }
    CellUri.parseCellOutputUri = parseCellOutputUri;
    function generateCellPropertyUri(notebook, handle, scheme) {
        return CellUri.generate(notebook, handle).with({ scheme: scheme });
    }
    CellUri.generateCellPropertyUri = generateCellPropertyUri;
    function parseCellPropertyUri(uri, propertyScheme) {
        if (uri.scheme !== propertyScheme) {
            return undefined;
        }
        return CellUri.parse(uri.with({ scheme: CellUri.scheme }));
    }
    CellUri.parseCellPropertyUri = parseCellPropertyUri;
})(CellUri || (CellUri = {}));
const normalizeSlashes = (str) => isWindows ? str.replace(/\//g, '\\') : str;
export class MimeTypeDisplayOrder {
    constructor(initialValue = [], defaultOrder = NOTEBOOK_DISPLAY_ORDER) {
        this.defaultOrder = defaultOrder;
        this.order = [...new Set(initialValue)].map(pattern => ({
            pattern,
            matches: glob.parse(normalizeSlashes(pattern), { ignoreCase: true })
        }));
    }
    /**
     * Returns a sorted array of the input mimeTypes.
     */
    sort(mimeTypes) {
        const remaining = new Map(Iterable.map(mimeTypes, m => [m, normalizeSlashes(m)]));
        let sorted = [];
        for (const { matches } of this.order) {
            for (const [original, normalized] of remaining) {
                if (matches(normalized)) {
                    sorted.push(original);
                    remaining.delete(original);
                    break;
                }
            }
        }
        if (remaining.size) {
            sorted = sorted.concat([...remaining.keys()].sort((a, b) => this.defaultOrder.indexOf(a) - this.defaultOrder.indexOf(b)));
        }
        return sorted;
    }
    /**
     * Records that the user selected the given mimetype over the other
     * possible mimeTypes, prioritizing it for future reference.
     */
    prioritize(chosenMimetype, otherMimeTypes) {
        const chosenIndex = this.findIndex(chosenMimetype);
        if (chosenIndex === -1) {
            // always first, nothing more to do
            this.order.unshift({ pattern: chosenMimetype, matches: glob.parse(normalizeSlashes(chosenMimetype), { ignoreCase: true }) });
            return;
        }
        // Get the other mimeTypes that are before the chosenMimetype. Then, move
        // them after it, retaining order.
        const uniqueIndices = new Set(otherMimeTypes.map(m => this.findIndex(m, chosenIndex)));
        uniqueIndices.delete(-1);
        const otherIndices = Array.from(uniqueIndices).sort();
        this.order.splice(chosenIndex + 1, 0, ...otherIndices.map(i => this.order[i]));
        for (let oi = otherIndices.length - 1; oi >= 0; oi--) {
            this.order.splice(otherIndices[oi], 1);
        }
    }
    /**
     * Gets an array of in-order mimetype preferences.
     */
    toArray() {
        return this.order.map(o => o.pattern);
    }
    findIndex(mimeType, maxIndex = this.order.length) {
        const normalized = normalizeSlashes(mimeType);
        for (let i = 0; i < maxIndex; i++) {
            if (this.order[i].matches(normalized)) {
                return i;
            }
        }
        return -1;
    }
}
export function diff(before, after, contains, equal = (a, b) => a === b) {
    const result = [];
    function pushSplice(start, deleteCount, toInsert) {
        if (deleteCount === 0 && toInsert.length === 0) {
            return;
        }
        const latest = result[result.length - 1];
        if (latest && latest.start + latest.deleteCount === start) {
            latest.deleteCount += deleteCount;
            latest.toInsert.push(...toInsert);
        }
        else {
            result.push({ start, deleteCount, toInsert });
        }
    }
    let beforeIdx = 0;
    let afterIdx = 0;
    while (true) {
        if (beforeIdx === before.length) {
            pushSplice(beforeIdx, 0, after.slice(afterIdx));
            break;
        }
        if (afterIdx === after.length) {
            pushSplice(beforeIdx, before.length - beforeIdx, []);
            break;
        }
        const beforeElement = before[beforeIdx];
        const afterElement = after[afterIdx];
        if (equal(beforeElement, afterElement)) {
            // equal
            beforeIdx += 1;
            afterIdx += 1;
            continue;
        }
        if (contains(afterElement)) {
            // `afterElement` exists before, which means some elements before `afterElement` are deleted
            pushSplice(beforeIdx, 1, []);
            beforeIdx += 1;
        }
        else {
            // `afterElement` added
            pushSplice(beforeIdx, 0, [afterElement]);
            afterIdx += 1;
        }
    }
    return result;
}
export const NOTEBOOK_EDITOR_CURSOR_BOUNDARY = new RawContextKey('notebookEditorCursorAtBoundary', 'none');
export const NOTEBOOK_EDITOR_CURSOR_LINE_BOUNDARY = new RawContextKey('notebookEditorCursorAtLineBoundary', 'none');
export var NotebookEditorPriority;
(function (NotebookEditorPriority) {
    NotebookEditorPriority["default"] = "default";
    NotebookEditorPriority["option"] = "option";
})(NotebookEditorPriority || (NotebookEditorPriority = {}));
export var NotebookFindScopeType;
(function (NotebookFindScopeType) {
    NotebookFindScopeType["Cells"] = "cells";
    NotebookFindScopeType["Text"] = "text";
    NotebookFindScopeType["None"] = "none";
})(NotebookFindScopeType || (NotebookFindScopeType = {}));
//TODO@rebornix test
export function isDocumentExcludePattern(filenamePattern) {
    const arg = filenamePattern;
    if ((typeof arg.include === 'string' || glob.isRelativePattern(arg.include))
        && (typeof arg.exclude === 'string' || glob.isRelativePattern(arg.exclude))) {
        return true;
    }
    return false;
}
export function notebookDocumentFilterMatch(filter, viewType, resource) {
    if (Array.isArray(filter.viewType) && filter.viewType.indexOf(viewType) >= 0) {
        return true;
    }
    if (filter.viewType === viewType) {
        return true;
    }
    if (filter.filenamePattern) {
        const filenamePattern = isDocumentExcludePattern(filter.filenamePattern) ? filter.filenamePattern.include : filter.filenamePattern;
        const excludeFilenamePattern = isDocumentExcludePattern(filter.filenamePattern) ? filter.filenamePattern.exclude : undefined;
        if (glob.match(filenamePattern, basename(resource.fsPath), { ignoreCase: true })) {
            if (excludeFilenamePattern) {
                if (glob.match(excludeFilenamePattern, basename(resource.fsPath), { ignoreCase: true })) {
                    // should exclude
                    return false;
                }
            }
            return true;
        }
    }
    return false;
}
export const NotebookSetting = {
    displayOrder: 'notebook.displayOrder',
    cellToolbarLocation: 'notebook.cellToolbarLocation',
    cellToolbarVisibility: 'notebook.cellToolbarVisibility',
    showCellStatusBar: 'notebook.showCellStatusBar',
    cellExecutionTimeVerbosity: 'notebook.cellExecutionTimeVerbosity',
    textDiffEditorPreview: 'notebook.diff.enablePreview',
    diffOverviewRuler: 'notebook.diff.overviewRuler',
    experimentalInsertToolbarAlignment: 'notebook.experimental.insertToolbarAlignment',
    compactView: 'notebook.compactView',
    focusIndicator: 'notebook.cellFocusIndicator',
    insertToolbarLocation: 'notebook.insertToolbarLocation',
    globalToolbar: 'notebook.globalToolbar',
    stickyScrollEnabled: 'notebook.stickyScroll.enabled',
    stickyScrollMode: 'notebook.stickyScroll.mode',
    undoRedoPerCell: 'notebook.undoRedoPerCell',
    consolidatedOutputButton: 'notebook.consolidatedOutputButton',
    openOutputInPreviewEditor: 'notebook.output.openInPreviewEditor.enabled',
    showFoldingControls: 'notebook.showFoldingControls',
    dragAndDropEnabled: 'notebook.dragAndDropEnabled',
    cellEditorOptionsCustomizations: 'notebook.editorOptionsCustomizations',
    consolidatedRunButton: 'notebook.consolidatedRunButton',
    openGettingStarted: 'notebook.experimental.openGettingStarted',
    globalToolbarShowLabel: 'notebook.globalToolbarShowLabel',
    markupFontSize: 'notebook.markup.fontSize',
    markdownLineHeight: 'notebook.markdown.lineHeight',
    interactiveWindowCollapseCodeCells: 'interactiveWindow.collapseCellInputCode',
    outputScrollingDeprecated: 'notebook.experimental.outputScrolling',
    outputScrolling: 'notebook.output.scrolling',
    textOutputLineLimit: 'notebook.output.textLineLimit',
    LinkifyOutputFilePaths: 'notebook.output.linkifyFilePaths',
    minimalErrorRendering: 'notebook.output.minimalErrorRendering',
    formatOnSave: 'notebook.formatOnSave.enabled',
    insertFinalNewline: 'notebook.insertFinalNewline',
    defaultFormatter: 'notebook.defaultFormatter',
    formatOnCellExecution: 'notebook.formatOnCellExecution',
    codeActionsOnSave: 'notebook.codeActionsOnSave',
    outputWordWrap: 'notebook.output.wordWrap',
    outputLineHeightDeprecated: 'notebook.outputLineHeight',
    outputLineHeight: 'notebook.output.lineHeight',
    outputFontSizeDeprecated: 'notebook.outputFontSize',
    outputFontSize: 'notebook.output.fontSize',
    outputFontFamilyDeprecated: 'notebook.outputFontFamily',
    outputFontFamily: 'notebook.output.fontFamily',
    findFilters: 'notebook.find.filters',
    logging: 'notebook.logging',
    confirmDeleteRunningCell: 'notebook.confirmDeleteRunningCell',
    remoteSaving: 'notebook.experimental.remoteSave',
    gotoSymbolsAllSymbols: 'notebook.gotoSymbols.showAllSymbols',
    outlineShowMarkdownHeadersOnly: 'notebook.outline.showMarkdownHeadersOnly',
    outlineShowCodeCells: 'notebook.outline.showCodeCells',
    outlineShowCodeCellSymbols: 'notebook.outline.showCodeCellSymbols',
    breadcrumbsShowCodeCells: 'notebook.breadcrumbs.showCodeCells',
    scrollToRevealCell: 'notebook.scrolling.revealNextCellOnExecute',
    cellChat: 'notebook.experimental.cellChat',
    cellGenerate: 'notebook.experimental.generate',
    notebookVariablesView: 'notebook.variablesView',
    notebookInlineValues: 'notebook.inlineValues',
    InteractiveWindowPromptToSave: 'interactiveWindow.promptToSaveOnClose',
    cellFailureDiagnostics: 'notebook.cellFailureDiagnostics',
    outputBackupSizeLimit: 'notebook.backup.sizeLimit',
    multiCursor: 'notebook.multiCursor.enabled',
    markupFontFamily: 'notebook.markup.fontFamily',
};
export var CellStatusbarAlignment;
(function (CellStatusbarAlignment) {
    CellStatusbarAlignment[CellStatusbarAlignment["Left"] = 1] = "Left";
    CellStatusbarAlignment[CellStatusbarAlignment["Right"] = 2] = "Right";
})(CellStatusbarAlignment || (CellStatusbarAlignment = {}));
export class NotebookWorkingCopyTypeIdentifier {
    static { this._prefix = 'notebook/'; }
    static create(notebookType, viewType) {
        return `${NotebookWorkingCopyTypeIdentifier._prefix}${notebookType}/${viewType ?? notebookType}`;
    }
    static parse(candidate) {
        if (candidate.startsWith(NotebookWorkingCopyTypeIdentifier._prefix)) {
            const split = candidate.substring(NotebookWorkingCopyTypeIdentifier._prefix.length).split('/');
            if (split.length === 2) {
                return { notebookType: split[0], viewType: split[1] };
            }
        }
        return undefined;
    }
}
const textDecoder = new TextDecoder();
/**
 * Given a stream of individual stdout outputs, this function will return the compressed lines, escaping some of the common terminal escape codes.
 * E.g. some terminal escape codes would result in the previous line getting cleared, such if we had 3 lines and
 * last line contained such a code, then the result string would be just the first two lines.
 * @returns a single VSBuffer with the concatenated and compressed data, and whether any compression was done.
 */
export function compressOutputItemStreams(outputs) {
    const buffers = [];
    let startAppending = false;
    // Pick the first set of outputs with the same mime type.
    for (const output of outputs) {
        if ((buffers.length === 0 || startAppending)) {
            buffers.push(output);
            startAppending = true;
        }
    }
    let didCompression = compressStreamBuffer(buffers);
    const concatenated = VSBuffer.concat(buffers.map(buffer => VSBuffer.wrap(buffer)));
    const data = formatStreamText(concatenated);
    didCompression = didCompression || data.byteLength !== concatenated.byteLength;
    return { data, didCompression };
}
export const MOVE_CURSOR_1_LINE_COMMAND = `${String.fromCharCode(27)}[A`;
const MOVE_CURSOR_1_LINE_COMMAND_BYTES = MOVE_CURSOR_1_LINE_COMMAND.split('').map(c => c.charCodeAt(0));
const LINE_FEED = 10;
function compressStreamBuffer(streams) {
    let didCompress = false;
    streams.forEach((stream, index) => {
        if (index === 0 || stream.length < MOVE_CURSOR_1_LINE_COMMAND.length) {
            return;
        }
        const previousStream = streams[index - 1];
        // Remove the previous line if required.
        const command = stream.subarray(0, MOVE_CURSOR_1_LINE_COMMAND.length);
        if (command[0] === MOVE_CURSOR_1_LINE_COMMAND_BYTES[0] && command[1] === MOVE_CURSOR_1_LINE_COMMAND_BYTES[1] && command[2] === MOVE_CURSOR_1_LINE_COMMAND_BYTES[2]) {
            const lastIndexOfLineFeed = previousStream.lastIndexOf(LINE_FEED);
            if (lastIndexOfLineFeed === -1) {
                return;
            }
            didCompress = true;
            streams[index - 1] = previousStream.subarray(0, lastIndexOfLineFeed);
            streams[index] = stream.subarray(MOVE_CURSOR_1_LINE_COMMAND.length);
        }
    });
    return didCompress;
}
/**
 * Took this from jupyter/notebook
 * https://github.com/jupyter/notebook/blob/b8b66332e2023e83d2ee04f83d8814f567e01a4e/notebook/static/base/js/utils.js
 * Remove characters that are overridden by backspace characters
 */
function fixBackspace(txt) {
    let tmp = txt;
    do {
        txt = tmp;
        // Cancel out anything-but-newline followed by backspace
        tmp = txt.replace(/[^\n]\x08/gm, '');
    } while (tmp.length < txt.length);
    return txt;
}
/**
 * Remove chunks that should be overridden by the effect of carriage return characters
 * From https://github.com/jupyter/notebook/blob/master/notebook/static/base/js/utils.js
 */
function fixCarriageReturn(txt) {
    txt = txt.replace(/\r+\n/gm, '\n'); // \r followed by \n --> newline
    while (txt.search(/\r[^$]/g) > -1) {
        const base = txt.match(/^(.*)\r+/m)[1];
        let insert = txt.match(/\r+(.*)$/m)[1];
        insert = insert + base.slice(insert.length, base.length);
        txt = txt.replace(/\r+.*$/m, '\r').replace(/^.*\r/m, insert);
    }
    return txt;
}
const BACKSPACE_CHARACTER = '\b'.charCodeAt(0);
const CARRIAGE_RETURN_CHARACTER = '\r'.charCodeAt(0);
function formatStreamText(buffer) {
    // We have special handling for backspace and carriage return characters.
    // Don't unnecessary decode the bytes if we don't need to perform any processing.
    if (!buffer.buffer.includes(BACKSPACE_CHARACTER) && !buffer.buffer.includes(CARRIAGE_RETURN_CHARACTER)) {
        return buffer;
    }
    // Do the same thing jupyter is doing
    return VSBuffer.fromString(fixCarriageReturn(fixBackspace(textDecoder.decode(buffer.buffer))));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tDb21tb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svY29tbW9uL25vdGVib29rQ29tbW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUk3RCxPQUFPLEtBQUssSUFBSSxNQUFNLGlDQUFpQyxDQUFDO0FBRXhELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUUvRCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDeEQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMzRCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFTaEUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBVXJGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxRQUFRLElBQUksV0FBVyxFQUFFLHdCQUF3QixFQUFFLGdCQUFnQixFQUFFLEtBQUssSUFBSSxRQUFRLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUkzTCxNQUFNLENBQUMsTUFBTSxrQkFBa0IsR0FBRywyQkFBMkIsQ0FBQztBQUM5RCxNQUFNLENBQUMsTUFBTSx1QkFBdUIsR0FBRyx5Q0FBeUMsQ0FBQztBQUNqRixNQUFNLENBQUMsTUFBTSw2QkFBNkIsR0FBRyw4Q0FBOEMsQ0FBQztBQUM1RixNQUFNLENBQUMsTUFBTSw0QkFBNEIsR0FBRyw4QkFBOEIsQ0FBQztBQUMzRSxNQUFNLENBQUMsTUFBTSxjQUFjLEdBQUcsdUJBQXVCLENBQUM7QUFDdEQsTUFBTSxDQUFDLE1BQU0seUJBQXlCLEdBQUcsdUNB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