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
var Disposable_1, DocumentSymbol_1, TaskGroup_1, Task_1, TreeItem_1, FileSystemError_1, TestMessage_1;
import { asArray } from '../../../base/common/arrays.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { illegalArgument } from '../../../base/common/errors.js';
import { Mimes } from '../../../base/common/mime.js';
import { nextCharLength } from '../../../base/common/strings.js';
import { isNumber, isObject, isString, isStringArray } from '../../../base/common/types.js';
import { URI } from '../../../base/common/uri.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
import { FileSystemProviderErrorCode, markAsFileSystemProviderError } from '../../../platform/files/common/files.js';
import { RemoteAuthorityResolverErrorCode } from '../../../platform/remote/common/remoteAuthorityResolver.js';
import { es5ClassCompat } from './extHostTypes/es5ClassCompat.js';
import { MarkdownString } from './extHostTypes/markdownString.js';
import { Range } from './extHostTypes/range.js';
export { CodeActionKind } from './extHostTypes/codeActionKind.js';
export { Diagnostic, DiagnosticRelatedInformation, DiagnosticSeverity, DiagnosticTag } from './extHostTypes/diagnostic.js';
export { Location } from './extHostTypes/location.js';
export { MarkdownString } from './extHostTypes/markdownString.js';
export { NotebookCellData, NotebookCellKind, NotebookCellOutput, NotebookCellOutputItem, NotebookData, NotebookEdit, NotebookRange } from './extHostTypes/notebooks.js';
export { Position } from './extHostTypes/position.js';
export { Range } from './extHostTypes/range.js';
export { Selection } from './extHostTypes/selection.js';
export { SnippetString } from './extHostTypes/snippetString.js';
export { SnippetTextEdit } from './extHostTypes/snippetTextEdit.js';
export { SymbolInformation, SymbolKind, SymbolTag } from './extHostTypes/symbolInformation.js';
export { EndOfLine, TextEdit } from './extHostTypes/textEdit.js';
export { FileEditType, WorkspaceEdit } from './extHostTypes/workspaceEdit.js';
export var TerminalOutputAnchor;
(function (TerminalOutputAnchor) {
    TerminalOutputAnchor[TerminalOutputAnchor["Top"] = 0] = "Top";
    TerminalOutputAnchor[TerminalOutputAnchor["Bottom"] = 1] = "Bottom";
})(TerminalOutputAnchor || (TerminalOutputAnchor = {}));
export var TerminalQuickFixType;
(function (TerminalQuickFixType) {
    TerminalQuickFixType[TerminalQuickFixType["TerminalCommand"] = 0] = "TerminalCommand";
    TerminalQuickFixType[TerminalQuickFixType["Opener"] = 1] = "Opener";
    TerminalQuickFixType[TerminalQuickFixType["Command"] = 3] = "Command";
})(TerminalQuickFixType || (TerminalQuickFixType = {}));
let Disposable = Disposable_1 = class Disposable {
    static from(...inDisposables) {
        let disposables = inDisposables;
        return new Disposable_1(function () {
            if (disposables) {
                for (const disposable of disposables) {
                    if (disposable && typeof disposable.dispose === 'function') {
                        disposable.dispose();
                    }
                }
                disposables = undefined;
            }
        });
    }
    #callOnDispose;
    constructor(callOnDispose) {
        this.#callOnDispose = callOnDispose;
    }
    dispose() {
        if (typeof this.#callOnDispose === 'function') {
            this.#callOnDispose();
            this.#callOnDispose = undefined;
        }
    }
};
Disposable = Disposable_1 = __decorate([
    es5ClassCompat
], Disposable);
export { Disposable };
const validateConnectionToken = (connectionToken) => {
    if (typeof connectionToken !== 'string' || connectionToken.length === 0 || !/^[0-9A-Za-z_\-]+$/.test(connectionToken)) {
        throw illegalArgument('connectionToken');
    }
};
export class ResolvedAuthority {
    static isResolvedAuthority(resolvedAuthority) {
        return resolvedAuthority
            && typeof resolvedAuthority === 'object'
            && typeof resolvedAuthority.host === 'string'
            && typeof resolvedAuthority.port === 'number'
            && (resolvedAuthority.connectionToken === undefined || typeof resolvedAuthority.connectionToken === 'string');
    }
    constructor(host, port, connectionToken) {
        if (typeof host !== 'string' || host.length === 0) {
            throw illegalArgument('host');
        }
        if (typeof port !== 'number' || port === 0 || Math.round(port) !== port) {
            throw illegalArgument('port');
        }
        if (typeof connectionToken !== 'undefined') {
            validateConnectionToken(connectionToken);
        }
        this.host = host;
        this.port = Math.round(port);
        this.connectionToken = connectionToken;
    }
}
export class ManagedResolvedAuthority {
    static isManagedResolvedAuthority(resolvedAuthority) {
        return resolvedAuthority
            && typeof resolvedAuthority === 'object'
            && typeof resolvedAuthority.makeConnection === 'function'
            && (resolvedAuthority.connectionToken === undefined || typeof resolvedAuthority.connectionToken === 'string');
    }
    constructor(makeConnection, connectionToken) {
        this.makeConnection = makeConnection;
        this.connectionToken = connectionToken;
        if (typeof connectionToken !== 'undefined') {
            validateConnectionToken(connectionToken);
        }
    }
}
export class RemoteAuthorityResolverError extends Error {
    static NotAvailable(message, handled) {
        return new RemoteAuthorityResolverError(message, RemoteAuthorityResolverErrorCode.NotAvailable, handled);
    }
    static TemporarilyNotAvailable(message) {
        return new RemoteAuthorityResolverError(message, RemoteAuthorityResolverErrorCode.TemporarilyNotAvailable);
    }
    constructor(message, code = RemoteAuthorityResolverErrorCode.Unknown, detail) {
        super(message);
        this._message = message;
        this._code = code;
        this._detail = detail;
        // workaround when extending builtin objects and when compiling to ES5, see:
        // https://github.com/microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(this, RemoteAuthorityResolverError.prototype);
    }
}
export var EnvironmentVariableMutatorType;
(function (EnvironmentVariableMutatorType) {
    EnvironmentVariableMutatorType[EnvironmentVariableMutatorType["Replace"] = 1] = "Replace";
    EnvironmentVariableMutatorType[EnvironmentVariableMutatorType["Append"] = 2] = "Append";
    EnvironmentVariableMutatorType[EnvironmentVariableMutatorType["Prepend"] = 3] = "Prepend";
})(EnvironmentVariableMutatorType || (EnvironmentVariableMutatorType = {}));
let Hover = class Hover {
    constructor(contents, range) {
        if (!contents) {
            throw new Error('Illegal argument, contents must be defined');
        }
        if (Array.isArray(contents)) {
            this.contents = contents;
        }
        else {
            this.contents = [contents];
        }
        this.range = range;
    }
};
Hover = __decorate([
    es5ClassCompat
], Hover);
export { Hover };
let VerboseHover = class VerboseHover extends Hover {
    constructor(contents, range, canIncreaseVerbosity, canDecreaseVerbosity) {
        super(contents, range);
        this.canIncreaseVerbosity = canIncreaseVerbosity;
        this.canDecreaseVerbosity = canDecreaseVerbosity;
    }
};
VerboseHover = __decorate([
    es5ClassCompat
], VerboseHover);
export { VerboseHover };
export var HoverVerbosityAction;
(function (HoverVerbosityAction) {
    HoverVerbosityAction[HoverVerbosityAction["Increase"] = 0] = "Increase";
    HoverVerbosityAction[HoverVerbosityAction["Decrease"] = 1] = "Decrease";
})(HoverVerbosityAction || (HoverVerbosityAction = {}));
export var DocumentHighlightKind;
(function (DocumentHighlightKind) {
    DocumentHighlightKind[DocumentHighlightKind["Text"] = 0] = "Text";
    DocumentHighlightKind[DocumentHighlightKind["Read"] = 1] = "Read";
    DocumentHighlightKind[DocumentHighlightKind["Write"] = 2] = "Write";
})(DocumentHighlightKind || (DocumentHighlightKind = {}));
let DocumentHighlight = class DocumentHighlight {
    constructor(range, kind = DocumentHighlightKind.Text) {
        this.range = range;
        this.kind = kind;
    }
    toJSON() {
        return {
            range: this.range,
            kind: DocumentHighlightKind[this.kind]
        };
    }
};
DocumentHighlight = __decorate([
    es5ClassCompat
], DocumentHighlight);
export { DocumentHighlight };
let MultiDocumentHighlight = class MultiDocumentHighlight {
    constructor(uri, highlights) {
        this.uri = uri;
        this.highlights = highlights;
    }
    toJSON() {
        return {
            uri: this.uri,
            highlights: this.highlights.map(h => h.toJSON())
        };
    }
};
MultiDocumentHighlight = __decorate([
    es5ClassCompat
], MultiDocumentHighlight);
export { MultiDocumentHighlight };
let DocumentSymbol = DocumentSymbol_1 = class DocumentSymbol {
    static validate(candidate) {
        if (!candidate.name) {
            throw new Error('name must not be falsy');
        }
        if (!candidate.range.contains(candidate.selectionRange)) {
            throw new Error('selectionRange must be contained in fullRange');
        }
        candidate.children?.forEach(DocumentSymbol_1.validate);
    }
    constructor(name, detail, kind, range, selectionRange) {
        this.name = name;
        this.detail = detail;
        this.kind = kind;
        this.range = range;
        this.selectionRange = selectionRange;
        this.children = [];
        DocumentSymbol_1.validate(this);
    }
};
DocumentSymbol = DocumentSymbol_1 = __decorate([
    es5ClassCompat
], DocumentSymbol);
export { DocumentSymbol };
export var CodeActionTriggerKind;
(function (CodeActionTriggerKind) {
    CodeActionTriggerKind[CodeActionTriggerKind["Invoke"] = 1] = "Invoke";
    CodeActionTriggerKind[CodeActionTriggerKind["Automatic"] = 2] = "Automatic";
})(CodeActionTriggerKind || (CodeActionTriggerKind = {}));
let CodeAction = class CodeAction {
    constructor(title, kind) {
        this.title = title;
        this.kind = kind;
    }
};
CodeAction = __decorate([
    es5ClassCompat
], CodeAction);
export { CodeAction };
let SelectionRange = class SelectionRange {
    constructor(range, parent) {
        this.range = range;
        this.parent = parent;
        if (parent && !parent.range.contains(this.range)) {
            throw new Error('Invalid argument: parent must contain this range');
        }
    }
};
SelectionRange = __decorate([
    es5ClassCompat
], SelectionRange);
export { SelectionRange };
export class CallHierarchyItem {
    constructor(kind, name, detail, uri, range, selectionRange) {
        this.kind = kind;
        this.name = name;
        this.detail = detail;
        this.uri = uri;
        this.range = range;
        this.selectionRange = selectionRange;
    }
}
export class CallHierarchyIncomingCall {
    constructor(item, fromRanges) {
        this.fromRanges = fromRanges;
        this.from = item;
    }
}
export class CallHierarchyOutgoingCall {
    constructor(item, fromRanges) {
        this.fromRanges = fromRanges;
        this.to = item;
    }
}
export var LanguageStatusSeverity;
(function (LanguageStatusSeverity) {
    LanguageStatusSeverity[LanguageStatusSeverity["Information"] = 0] = "Information";
    LanguageStatusSeverity[LanguageStatusSeverity["Warning"] = 1] = "Warning";
    LanguageStatusSeverity[LanguageStatusSeverity["Error"] = 2] = "Error";
})(LanguageStatusSeverity || (LanguageStatusSeverity = {}));
let CodeLens = class CodeLens {
    constructor(range, command) {
        this.range = range;
        this.command = command;
    }
    get isResolved() {
        return !!this.command;
    }
};
CodeLens = __decorate([
    es5ClassCompat
], CodeLens);
export { CodeLens };
let ParameterInformation = class ParameterInformation {
    constructor(label, documentation) {
        this.label = label;
        this.documentation = documentation;
    }
};
ParameterInformation = __decorate([
    es5ClassCompat
], ParameterInformation);
export { ParameterInformation };
let SignatureInformation = class SignatureInformation {
    constructor(label, documentation) {
        this.label = label;
        this.documentation = documentation;
        this.parameters = [];
    }
};
SignatureInformation = __decorate([
    es5ClassCompat
], SignatureInformation);
export { SignatureInformation };
let SignatureHelp = class SignatureHelp {
    constructor() {
        this.activeSignature = 0;
        this.activeParameter = 0;
        this.signatures = [];
    }
};
SignatureHelp = __decorate([
    es5ClassCompat
], SignatureHelp);
export { SignatureHelp };
export var SignatureHelpTriggerKind;
(function (SignatureHelpTriggerKind) {
    SignatureHelpTriggerKind[SignatureHelpTriggerKind["Invoke"] = 1] = "Invoke";
    SignatureHelpTriggerKind[SignatureHelpTriggerKind["TriggerCharacter"] = 2] = "TriggerCharacter";
    SignatureHelpTriggerKind[SignatureHelpTriggerKind["ContentChange"] = 3] = "ContentChange";
})(SignatureHelpTriggerKind || (SignatureHelpTriggerKind = {}));
export var InlayHintKind;
(function (InlayHintKind) {
    InlayHintKind[InlayHintKind["Type"] = 1] = "Type";
    InlayHintKind[InlayHintKind["Parameter"] = 2] = "Parameter";
})(InlayHintKind || (InlayHintKind = {}));
let InlayHintLabelPart = class InlayHintLabelPart {
    constructor(value) {
        this.value = value;
    }
};
InlayHintLabelPart = __decorate([
    es5ClassCompat
], InlayHintLabelPart);
export { InlayHintLabelPart };
let InlayHint = class InlayHint {
    constructor(position, label, kind) {
        this.position = position;
        this.label = label;
        this.kind = kind;
    }
};
InlayHint = __decorate([
    es5ClassCompat
], InlayHint);
export { InlayHint };
export var CompletionTriggerKind;
(function (CompletionTriggerKind) {
    CompletionTriggerKind[CompletionTriggerKind["Invoke"] = 0] = "Invoke";
    CompletionTriggerKind[CompletionTriggerKind["TriggerCharacter"] = 1] = "TriggerCharacter";
    CompletionTriggerKind[CompletionTriggerKind["TriggerForIncompleteCompletions"] = 2] = "TriggerForIncompleteCompletions";
})(CompletionTriggerKind || (CompletionTriggerKind = {}));
export var CompletionItemKind;
(function (CompletionItemKind) {
    CompletionItemKind[CompletionItemKind["Text"] = 0] = "Text";
    CompletionItemKind[CompletionItemKind["Method"] = 1] = "Method";
    CompletionItemKind[CompletionItemKind["Function"] = 2] = "Function";
    CompletionItemKind[CompletionItemKind["Constructor"] = 3] = "Constructor";
    CompletionItemKind[CompletionItemKind["Field"] = 4] = "Field";
    CompletionItemKind[CompletionItemKind["Variable"] = 5] = "Variable";
    CompletionItemKind[CompletionItemKind["Class"] = 6] = "Class";
    CompletionItemKind[CompletionItemKind["Interface"] = 7] = "Interface";
    CompletionItemKind[CompletionItemKind["Module"] = 8] = "Module";
    CompletionItemKind[CompletionItemKind["Property"] = 9] = "Property";
    CompletionItemKind[CompletionItemKind["Unit"] = 10] = "Unit";
    CompletionItemKind[CompletionItemKind["Value"] = 11] = "Value";
    CompletionItemKind[CompletionItemKind["Enum"] = 12] = "Enum";
    CompletionItemKind[CompletionItemKind["Keyword"] = 13] = "Keyword";
    CompletionItemKind[CompletionItemKind["Snippet"] = 14] = "Snippet";
    CompletionItemKind[CompletionItemKind["Color"] = 15] = "Color";
    CompletionItemKind[CompletionItemKind["File"] = 16] = "File";
    CompletionItemKind[CompletionItemKind["Reference"] = 17] = "Reference";
    CompletionItemKind[CompletionItemKind["Folder"] = 18] = "Folder";
    CompletionItemKind[CompletionItemKind["EnumMember"] = 19] = "EnumMember";
    CompletionItemKind[CompletionItemKind["Constant"] = 20] = "Constant";
    CompletionItemKind[CompletionItemKind["Struct"] = 21] = "Struct";
    CompletionItemKind[CompletionItemKind["Event"] = 22] = "Event";
    CompletionItemKind[CompletionItemKind["Operator"] = 23] = "Operator";
    CompletionItemKind[CompletionItemKind["TypeParameter"] = 24] = "TypeParameter";
    CompletionItemKind[CompletionItemKind["User"] = 25] = "User";
    CompletionItemKind[CompletionItemKind["Issue"] = 26] = "Issue";
})(CompletionItemKind || (CompletionItemKind = {}));
export var CompletionItemTag;
(function (CompletionItemTag) {
    CompletionItemTag[CompletionItemTag["Deprecated"] = 1] = "Deprecated";
})(CompletionItemTag || (CompletionItemTag = {}));
let CompletionItem = class CompletionItem {
    constructor(label, kind) {
        this.label = label;
        this.kind = kind;
    }
    toJSON() {
        return {
            label: this.label,
            kind: this.kind && CompletionItemKind[this.kind],
            detail: this.detail,
            documentation: this.documentation,
            sortText: this.sortText,
            filterText: this.filterText,
            preselect: this.preselect,
            insertText: this.insertText,
            textEdit: this.textEdit
        };
    }
};
CompletionItem = __decorate([
    es5ClassCompat
], CompletionItem);
export { CompletionItem };
let CompletionList = class CompletionList {
    constructor(items = [], isIncomplete = false) {
        this.items = items;
        this.isIncomplete = isIncomplete;
    }
};
CompletionList = __decorate([
    es5ClassCompat
], CompletionList);
export { CompletionList };
let InlineSuggestion = class InlineSuggestion {
    constructor(insertText, range, command) {
        this.insertText = insertText;
        this.range = range;
        this.command = command;
    }
};
InlineSuggestion = __decorate([
    es5ClassCompat
], InlineSuggestion);
export { InlineSuggestion };
let InlineSuggestionList = class InlineSuggestionList {
    constructor(items) {
        this.commands = undefined;
        this.suppressSuggestions = undefined;
        this.items = items;
    }
};
InlineSuggestionList = __decorate([
    es5ClassCompat
], InlineSuggestionList);
export { InlineSuggestionList };
export var PartialAcceptTriggerKind;
(function (PartialAcceptTriggerKind) {
    PartialAcceptTriggerKind[PartialAcceptTriggerKind["Unknown"] = 0] = "Unknown";
    PartialAcceptTriggerKind[PartialAcceptTriggerKind["Word"] = 1] = "Word";
    PartialAcceptTriggerKind[PartialAcceptTriggerKind["Line"] = 2] = "Line";
    PartialAcceptTriggerKind[PartialAcceptTriggerKind["Suggest"] = 3] = "Suggest";
})(PartialAcceptTriggerKind || (PartialAcceptTriggerKind = {}));
export var InlineCompletionEndOfLifeReasonKind;
(function (InlineCompletionEndOfLifeReasonKind) {
    InlineCompletionEndOfLifeReasonKind[InlineCompletionEndOfLifeReasonKind["Accepted"] = 0] = "Accepted";
    InlineCompletionEndOfLifeReasonKind[InlineCompletionEndOfLifeReasonKind["Rejected"] = 1] = "Rejected";
    InlineCompletionEndOfLifeReasonKind[InlineCompletionEndOfLifeReasonKind["Ignored"] = 2] = "Ignored";
})(InlineCompletionEndOfLifeReasonKind || (InlineCompletionEndOfLifeReasonKind = {}));
export var InlineCompletionDisplayLocationKind;
(function (InlineCompletionDisplayLocationKind) {
    InlineCompletionDisplayLocationKind[InlineCompletionDisplayLocationKind["Code"] = 1] = "Code";
    InlineCompletionDisplayLocationKind[InlineCompletionDisplayLocationKind["Label"] = 2] = "Label";
})(InlineCompletionDisplayLocationKind || (InlineCompletionDisplayLocationKind = {}));
export var ViewColumn;
(function (ViewColumn) {
    ViewColumn[ViewColumn["Active"] = -1] = "Active";
    ViewColumn[ViewColumn["Beside"] = -2] = "Beside";
    ViewColumn[ViewColumn["One"] = 1] = "One";
    ViewColumn[ViewColumn["Two"] = 2] = "Two";
    ViewColumn[ViewColumn["Three"] = 3] = "Three";
    ViewColumn[ViewColumn["Four"] = 4] = "Four";
    ViewColumn[ViewColumn["Five"] = 5] = "Five";
    ViewColumn[ViewColumn["Six"] = 6] = "Six";
    ViewColumn[ViewColumn["Seven"] = 7] = "Seven";
    ViewColumn[ViewColumn["Eight"] = 8] = "Eight";
    ViewColumn[ViewColumn["Nine"] = 9] = "Nine";
})(ViewColumn || (ViewColumn = {}));
export var StatusBarAlignment;
(function (StatusBarAlignment) {
    StatusBarAlignment[StatusBarAlignment["Left"] = 1] = "Left";
    StatusBarAlignment[StatusBarAlignment["Right"] = 2] = "Right";
})(StatusBarAlignment || (StatusBarAlignment = {}));
export function asStatusBarItemIdentifier(extension, id) {
    return `${ExtensionIdentifier.toKey(extension)}.${id}`;
}
export var TextEditorLineNumbersStyle;
(function (TextEditorLineNumbersStyle) {
    TextEditorLineNumbersStyle[TextEditorLineNumbersStyle["Off"] = 0] = "Off";
    TextEditorLineNumbersStyle[TextEditorLineNumbersStyle["On"] = 1] = "On";
    TextEditorLineNumbersStyle[TextEditorLineNumbersStyle["Relative"] = 2] = "Relative";
    TextEditorLineNumbersStyle[TextEditorLineNumbersStyle["Interval"] = 3] = "Interval";
})(TextEditorLineNumbersStyle || (TextEditorLineNumbersStyle = {}));
export var TextDocumentSaveReason;
(function (TextDocumentSaveReason) {
    TextDocumentSaveReason[TextDocumentSaveReason["Manual"] = 1] = "Manual";
    TextDocumentSaveReason[TextDocumentSaveReason["AfterDelay"] = 2] = "AfterDelay";
    TextDocumentSaveReason[TextDocumentSaveReason["FocusOut"] = 3] = "FocusOut";
})(TextDocumentSaveReason || (TextDocumentSaveReason = {}));
export var TextEditorRevealType;
(function (TextEditorRevealType) {
    TextEditorRevealType[TextEditorRevealType["Default"] = 0] = "Default";
    TextEditorRevealType[TextEditorRevealType["InCenter"] = 1] = "InCenter";
    TextEditorRevealType[TextEditorRevealType["InCenterIfOutsideViewport"] = 2] = "InCenterIfOutsideViewport";
    TextEditorRevealType[TextEditorRevealType["AtTop"] = 3] = "AtTop";
})(TextEditorRevealType || (TextEditorRevealType = {}));
export var TextEditorSelectionChangeKind;
(function (TextEditorSelectionChangeKind) {
    TextEditorSelectionChangeKind[TextEditorSelectionChangeKind["Keyboard"] = 1] = "Keyboard";
    TextEditorSelectionChangeKind[TextEditorSelectionChangeKind["Mouse"] = 2] = "Mouse";
    TextEditorSelectionChangeKind[TextEditorSelectionChangeKind["Command"] = 3] = "Command";
})(TextEditorSelectionChangeKind || (TextEditorSelectionChangeKind = {}));
export var TextEditorChangeKind;
(function (TextEditorChangeKind) {
    TextEditorChangeKind[TextEditorChangeKind["Addition"] = 1] = "Addition";
    TextEditorChangeKind[TextEditorChangeKind["Deletion"] = 2] = "Deletion";
    TextEditorChangeKind[TextEditorChangeKind["Modification"] = 3] = "Modification";
})(TextEditorChangeKind || (TextEditorChangeKind = {}));
export var TextDocumentChangeReason;
(function (TextDocumentChangeReason) {
    TextDocumentChangeReason[TextDocumentChangeReason["Undo"] = 1] = "Undo";
    TextDocumentChangeReason[TextDocumentChangeReason["Redo"] = 2] = "Redo";
})(TextDocumentChangeReason || (TextDocumentChangeReason = {}));
/**
 * These values match very carefully the values of `TrackedRangeStickiness`
 */
export var DecorationRangeBehavior;
(function (DecorationRangeBehavior) {
    /**
     * TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges
     */
    DecorationRangeBehavior[DecorationRangeBehavior["OpenOpen"] = 0] = "OpenOpen";
    /**
     * TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
     */
    DecorationRangeBehavior[DecorationRangeBehavior["ClosedClosed"] = 1] = "ClosedClosed";
    /**
     * TrackedRangeStickiness.GrowsOnlyWhenTypingBefore
     */
    DecorationRangeBehavior[DecorationRangeBehavior["OpenClosed"] = 2] = "OpenClosed";
    /**
     * TrackedRangeStickiness.GrowsOnlyWhenTypingAfter
     */
    DecorationRangeBehavior[DecorationRangeBehavior["ClosedOpen"] = 3] = "ClosedOpen";
})(DecorationRangeBehavior || (DecorationRangeBehavior = {}));
(function (TextEditorSelectionChangeKind) {
    function fromValue(s) {
        switch (s) {
            case 'keyboard': return TextEditorSelectionChangeKind.Keyboard;
            case 'mouse': return TextEditorSelectionChangeKind.Mouse;
            case "api" /* TextEditorSelectionSource.PROGRAMMATIC */:
            case "code.jump" /* TextEditorSelectionSource.JUMP */:
            case "code.navigation" /* TextEditorSelectionSource.NAVIGATION */:
                return TextEditorSelectionChangeKind.Command;
        }
        return undefined;
    }
    TextEditorSelectionChangeKind.fromValue = fromValue;
})(TextEditorSelectionChangeKind || (TextEditorSelectionChangeKind = {}));
export var SyntaxTokenType;
(function (SyntaxTokenType) {
    SyntaxTokenType[SyntaxTokenType["Other"] = 0] = "Other";
    SyntaxTokenType[SyntaxTokenType["Comment"] = 1] = "Comment";
    SyntaxTokenType[SyntaxTokenType["String"] = 2] = "String";
    SyntaxTokenType[SyntaxTokenType["RegEx"] = 3] = "RegEx";
})(SyntaxTokenType || (SyntaxTokenType = {}));
(function (SyntaxTokenType) {
    function toString(v) {
        switch (v) {
            case SyntaxTokenType.Other: return 'other';
            case SyntaxTokenType.Comment: return 'comment';
            case SyntaxTokenType.String: return 'string';
            case SyntaxTokenType.RegEx: return 'regex';
        }
        return 'other';
    }
    SyntaxTokenType.toString = toString;
})(SyntaxTokenType || (SyntaxTokenType = {}));
let DocumentLink = class DocumentLink {
    constructor(range, target) {
        if (target && !(URI.isUri(target))) {
            throw illegalArgument('target');
        }
        if (!Range.isRange(range) || range.isEmpty) {
            throw illegalArgument('range');
        }
        this.range = range;
        this.target = target;
    }
};
DocumentLink = __decorate([
    es5ClassCompat
], DocumentLink);
export { DocumentLink };
let Color = class Color {
    constructor(red, green, blue, alpha) {
        this.red = red;
        this.green = green;
        this.blue = blue;
        this.alpha = alpha;
    }
};
Color = __decorate([
    es5ClassCompat
], Color);
export { Color };
let ColorInformation = class ColorInformation {
    constructor(range, color) {
        if (color && !(color instanceof Color)) {
            throw illegalArgument('color');
        }
        if (!Range.isRange(range) || range.isEmpty) {
            throw illegalArgument('range');
        }
        this.range = range;
        this.color = color;
    }
};
ColorInformation = __decorate([
    es5ClassCompat
], ColorInformation);
export { ColorInformation };
let ColorPresentation = class ColorPresentation {
    constructor(label) {
        if (!label || typeof label !== 'string') {
            throw illegalArgument('label');
        }
        this.label = label;
    }
};
ColorPresentation = __decorate([
    es5ClassCompat
], ColorPresentation);
export { ColorPresentation };
export var ColorFormat;
(function (ColorFormat) {
    ColorFormat[ColorFormat["RGB"] = 0] = "RGB";
    ColorFormat[ColorFormat["HEX"] = 1] = "HEX";
    ColorFormat[ColorFormat["HSL"] = 2] = "HSL";
})(ColorFormat || (ColorFormat = {}));
export var SourceControlInputBoxValidationType;
(function (SourceControlInputBoxValidationType) {
    SourceControlInputBoxValidationType[SourceControlInputBoxValidationType["Error"] = 0] = "Error";
    SourceControlInputBoxValidationType[SourceControlInputBoxValidationType["Warning"] = 1] = "Warning";
    SourceControlInputBoxValidationType[SourceControlInputBoxValidationType["Information"] = 2] = "Information";
})(SourceControlInputBoxValidationType || (SourceControlInputBoxValidationType = {}));
export var TerminalExitReason;
(function (TerminalExitReason) {
    TerminalExitReason[TerminalExitReason["Unknown"] = 0] = "Unknown";
    TerminalExitReason[TerminalExitReason["Shutdown"] = 1] = "Shutdown";
    TerminalExitReason[TerminalExitReason["Process"] = 2] = "Process";
    TerminalExitReason[TerminalExitReason["User"] = 3] = "User";
    TerminalExitReason[TerminalExitReason["Extension"] = 4] = "Extension";
})(TerminalExitReason || (TerminalExitReason = {}));
export var TerminalShellExecutionCommandLineConfidence;
(function (TerminalShellExecutionCommandLineConfidence) {
    TerminalShellExecutionCommandLineConfidence[TerminalShellExecutionCommandLineConfidence["Low"] = 0] = "Low";
    TerminalShellExecutionCommandLineConfidence[TerminalShellExecutionCommandLineConfidence["Medium"] = 1] = "Medium";
    TerminalShellExecutionCommandLineConfidence[TerminalShellExecutionCommandLineConfidence["High"] = 2] = "High";
})(TerminalShellExecutionCommandLineConfidence || (TerminalShellExecutionCommandLineConfidence = {}));
export var TerminalShellType;
(function (TerminalShellType) {
    TerminalShellType[TerminalShellType["Sh"] = 1] = "Sh";
    TerminalShellType[TerminalShellType["Bash"] = 2] = "Bash";
    TerminalShellType[TerminalShellType["Fish"] = 3] = "Fish";
    TerminalShellType[TerminalShellType["Csh"] = 4] = "Csh";
    TerminalShellType[TerminalShellType["Ksh"] = 5] = "Ksh";
    TerminalShellType[TerminalShellType["Zsh"] = 6] = "Zsh";
    TerminalShellType[TerminalShellType["CommandPrompt"] = 7] = "CommandPrompt";
    TerminalShellType[TerminalShellType["GitBash"] = 8] = "GitBash";
    TerminalShellType[TerminalShellType["PowerShell"] = 9] = "PowerShell";
    TerminalShellType[TerminalShellType["Python"] = 10] = "Python";
    TerminalShellType[TerminalShellType["Julia"] = 11] = "Julia";
    TerminalShellType[TerminalShellType["NuShell"] = 12] = "NuShell";
    TerminalShellType[TerminalShellType["Node"] = 13] = "Node";
})(TerminalShellType || (TerminalShellType = {}));
export class TerminalLink {
    constructor(startIndex, length, tooltip) {
        this.startIndex = startIndex;
        this.length = length;
        this.tooltip = tooltip;
        if (typeof startIndex !== 'number' || startIndex < 0) {
            throw illegalArgument('startIndex');
        }
        if (typeof length !== 'number' || length < 1) {
            throw illegalArgument('length');
        }
        if (tooltip !== undefined && typeof tooltip !== 'string') {
            throw illegalArgument('tooltip');
        }
    }
}
export class TerminalQuickFixOpener {
    constructor(uri) {
        this.uri = uri;
    }
}
export class TerminalQuickFixCommand {
    constructor(terminalCommand) {
        this.terminalCommand = terminalCommand;
    }
}
export var TerminalLocation;
(function (TerminalLocation) {
    TerminalLocation[TerminalLocation["Panel"] = 1] = "Panel";
    TerminalLocation[TerminalLocation["Editor"] = 2] = "Editor";
})(TerminalLocation || (TerminalLocation = {}));
export class TerminalProfile {
    constructor(options) {
        this.options = options;
        if (typeof options !== 'object') {
            throw illegalArgument('options');
        }
    }
}
export var TerminalCompletionItemKind;
(function (TerminalCompletionItemKind) {
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
    TerminalCompletionItemKind[TerminalCompletionItemKind["ScmCommit"] = 10] = "ScmCommit";
    TerminalCompletionItemKind[TerminalCompletionItemKind["ScmBranch"] = 11] = "ScmBranch";
    TerminalCompletionItemKind[TerminalCompletionItemKind["ScmTag"] = 12] = "ScmTag";
    TerminalCompletionItemKind[TerminalCompletionItemKind["ScmStash"] = 13] = "ScmStash";
    TerminalCompletionItemKind[TerminalCompletionItemKind["ScmRemote"] = 14] = "ScmRemote";
    TerminalCompletionItemKind[TerminalCompletionItemKind["PullRequest"] = 15] = "PullRequest";
    TerminalCompletionItemKind[TerminalCompletionItemKind["PullRequestDone"] = 16] = "PullRequestDone";
})(TerminalCompletionItemKind || (TerminalCompletionItemKind = {}));
export class TerminalCompletionItem {
    constructor(label, replacementRange, kind, detail, documentation, isFile, isDirectory, isKeyword) {
        this.label = label;
        this.replacementRange = replacementRange;
        this.kind = kind;
        this.detail = detail;
        this.documentation = documentation;
        this.isFile = isFile;
        this.isDirectory = isDirectory;
        this.isKeyword = isKeyword;
    }
}
/**
 * Represents a collection of {@link CompletionItem completion items} to be presented
 * in the editor.
 */
export class TerminalCompletionList {
    /**
     * Creates a new completion list.
     *
     * @param items The completion items.
     * @param isIncomplete The list is not complete.
     */
    constructor(items, resourceOptions) {
        this.items = items ?? [];
        this.resourceOptions = resourceOptions;
    }
}
export var TaskRevealKind;
(function (TaskRevealKind) {
    TaskRevealKind[TaskRevealKind["Always"] = 1] = "Always";
    TaskRevealKind[TaskRevealKind["Silent"] = 2] = "Silent";
    TaskRevealKind[TaskRevealKind["Never"] = 3] = "Never";
})(TaskRevealKind || (TaskRevealKind = {}));
export var TaskEventKind;
(function (TaskEventKind) {
    /** Indicates a task's properties or configuration have changed */
    TaskEventKind["Changed"] = "changed";
    /** Indicates a task has begun executing */
    TaskEventKind["ProcessStarted"] = "processStarted";
    /** Indicates a task process has completed */
    TaskEventKind["ProcessEnded"] = "processEnded";
    /** Indicates a task was terminated, either by user action or by the system */
    TaskEventKind["Terminated"] = "terminated";
    /** Indicates a task has started running */
    TaskEventKind["Start"] = "start";
    /** Indicates a task has acquired all needed input/variables to execute */
    TaskEventKind["AcquiredInput"] = "acquiredInput";
    /** Indicates a dependent task has started */
    TaskEventKind["DependsOnStarted"] = "dependsOnStarted";
    /** Indicates a task is actively running/processing */
    TaskEventKind["Active"] = "active";
    /** Indicates a task is paused/waiting but not complete */
    TaskEventKind["Inactive"] = "inactive";
    /** Indicates a task has completed fully */
    TaskEventKind["End"] = "end";
    /** Indicates the task's problem matcher has started */
    TaskEventKind["ProblemMatcherStarted"] = "problemMatcherStarted";
    /** Indicates the task's problem matcher has ended without errors */
    TaskEventKind["ProblemMatcherEnded"] = "problemMatcherEnded";
    /** Indicates the task's problem matcher has ended with errors */
    TaskEventKind["ProblemMatcherFoundErrors"] = "problemMatcherFoundErrors";
})(TaskEventKind || (TaskEventKind = {}));
export var TaskPanelKind;
(function (TaskPanelKind) {
    TaskPanelKind[TaskPanelKind["Shared"] = 1] = "Shared";
    TaskPanelKind[TaskPanelKind["Dedicated"] = 2] = "Dedicated";
    TaskPanelKind[TaskPanelKind["New"] = 3] = "New";
})(TaskPanelKind || (TaskPanelKind = {}));
let TaskGroup = class TaskGroup {
    static { TaskGroup_1 = this; }
    static { this.Clean = new TaskGroup_1('clean', 'Clean'); }
    static { this.Build = new TaskGroup_1('build', 'Build'); }
    static { this.Rebuild = new TaskGroup_1('rebuild', 'Rebuild'); }
    static { this.Test = new TaskGroup_1('test', 'Test'); }
    static from(value) {
        switch (value) {
            case 'clean':
                return TaskGroup_1.Clean;
            case 'build':
                return TaskGroup_1.Build;
            case 'rebuild':
                return TaskGroup_1.Rebuild;
            case 'test':
                return TaskGroup_1.Test;
            default:
                return undefined;
        }
    }
    constructor(id, label) {
        this.label = label;
        if (typeof id !== 'string') {
            throw illegalArgument('name');
        }
        if (typeof label !== 'string') {
            throw illegalArgument('name');
        }
        this._id = id;
    }
    get id() {
        return this._id;
    }
};
TaskGroup = TaskGroup_1 = __decorate([
    es5ClassCompat
], TaskGroup);
export { TaskGroup };
function computeTaskExecutionId(values) {
    let id = '';
    for (let i = 0; i < values.length; i++) {
        id += values[i].replace(/,/g, ',,') + ',';
    }
    return id;
}
let ProcessExecution = class ProcessExecution {
    constructor(process, varg1, varg2) {
        if (typeof process !== 'string') {
            throw illegalArgument('process');
        }
        this._args = [];
        this._process = process;
        if (varg1 !== undefined) {
            if (Array.isArray(varg1)) {
                this._args = varg1;
                this._options = varg2;
            }
            else {
                this._options = varg1;
            }
        }
    }
    get process() {
        return this._process;
    }
    set process(value) {
        if (typeof value !== 'string') {
            throw illegalArgument('process');
        }
        this._process = value;
    }
    get args() {
        return this._args;
    }
    set args(value) {
        if (!Array.isArray(value)) {
            value = [];
        }
        this._args = value;
    }
    get options() {
        return this._options;
    }
    set options(value) {
        this._options = value;
    }
    computeId() {
        const props = [];
        props.push('process');
        if (this._process !== undefined) {
            props.push(this._process);
        }
        if (this._args && this._args.length > 0) {
            for (const arg of this._args) {
                props.push(arg);
            }
        }
        return computeTaskExecutionId(props);
    }
};
ProcessExecution = __decorate([
    es5ClassCompat
], ProcessExecution);
export { ProcessExecution };
let ShellExecution = class ShellExecution {
    constructor(arg0, arg1, arg2) {
        this._args = [];
        if (Array.isArray(arg1)) {
            if (!arg0) {
                throw illegalArgument('command can\'t be undefined or null');
            }
            if (typeof arg0 !== 'string' && typeof arg0.value !== 'string') {
                throw illegalArgument('command');
            }
            this._command = arg0;
            if (arg1) {
                this._args = arg1;
            }
            this._options = arg2;
        }
        else {
            if (typeof arg0 !== 'string') {
                throw illegalArgument('commandLine');
            }
            this._commandLine = arg0;
            this._options = arg1;
        }
    }
    get commandLine() {
        return this._commandLine;
    }
    set commandLine(value) {
        if (typeof value !== 'string') {
            throw illegalArgument('commandLine');
        }
        this._commandLine = value;
    }
    get command() {
        return this._command ? this._command : '';
    }
    set command(value) {
        if (typeof value !== 'string' && typeof value.value !== 'string') {
            throw illegalArgument('command');
        }
        this._command = value;
    }
    get args() {
        return this._args;
    }
    set args(value) {
        this._args = value || [];
    }
    get options() {
        return this._options;
    }
    set options(value) {
        this._options = value;
    }
    computeId() {
        const props = [];
        props.push('shell');
        if (this._commandLine !== undefined) {
            props.push(this._commandLine);
        }
        if (this._command !== undefined) {
            props.push(typeof this._command === 'string' ? this._command : this._command.value);
        }
        if (this._args && this._args.length > 0) {
            for (const arg of this._args) {
                props.push(typeof arg === 'string' ? arg : arg.value);
            }
        }
        return computeTaskExecutionId(props);
    }
};
ShellExecution = __decorate([
    es5ClassCompat
], ShellExecution);
export { ShellExecution };
export var ShellQuoting;
(function (ShellQuoting) {
    ShellQuoting[ShellQuoting["Escape"] = 1] = "Escape";
    ShellQuoting[ShellQuoting["Strong"] = 2] = "Strong";
    ShellQuoting[ShellQuoting["Weak"] = 3] = "Weak";
})(ShellQuoting || (ShellQuoting = {}));
export var TaskScope;
(function (TaskScope) {
    TaskScope[TaskScope["Global"] = 1] = "Global";
    TaskScope[TaskScope["Workspace"] = 2] = "Workspace";
})(TaskScope || (TaskScope = {}));
export class CustomExecution {
    constructor(callback) {
        this._callback = callback;
    }
    computeId() {
        return 'customExecution' + generateUuid();
    }
    set callback(value) {
        this._callback = value;
    }
    get callback() {
        return this._callback;
    }
}
let Task = class Task {
    static { Task_1 = this; }
    static { this.ExtensionCallbackType = 'customExecution'; }
    static { this.ProcessType = 'process'; }
    static { this.ShellType = 'shell'; }
    static { this.EmptyType = '$empty'; }
    constructor(definition, arg2, arg3, arg4, arg5, arg6) {
        this.__deprecated = false;
        this._definition = this.definition = definition;
        let problemMatchers;
        if (typeof arg2 === 'string') {
            this._name = this.name = arg2;
            this._source = this.source = arg3;
            this.execution = arg4;
            problemMatchers = arg5;
            this.__deprecated = true;
        }
        else if (arg2 === TaskScope.Global || arg2 === TaskScope.Workspace) {
            this.target = arg2;
            this._name = this.name = arg3;
            this._source = this.source = arg4;
            this.execution = arg5;
            problemMatchers = arg6;
        }
        else {
            this.target = arg2;
            this._name = this.name = arg3;
            this._source = this.source = arg4;
            this.execution = arg5;
            problemMatchers = arg6;
        }
        if (typeof problemMatchers === 'string') {
            this._problemMatchers = [problemMatchers];
            this._hasDefinedMatchers = true;
        }
        else if (Array.isArray(problemMatchers)) {
            this._problemMatchers = problemMatchers;
            this._hasDefinedMatchers = true;
        }
        else {
            this._problemMatchers = [];
            this._hasDefinedMatchers = false;
        }
        this._isBackground = false;
        this._presentationOptions = Object.create(null);
        this._runOptions = Object.create(null);
    }
    get _id() {
        return this.__id;
    }
    set _id(value) {
        this.__id = value;
    }
    get _deprecated() {
        return this.__deprecated;
    }
    clear() {
        if (this.__id === undefined) {
            return;
        }
        this.__id = undefined;
        this._scope = undefined;
        this.computeDefinitionBasedOnExecution();
    }
    computeDefinitionBasedOnExecution() {
        if (this._execution instanceof ProcessExecution) {
            this._definition = {
                type: Task_1.ProcessType,
                id: this._execution.computeId()
            };
        }
        else if (this._execution instanceof ShellExecution) {
            this._definition = {
                type: Task_1.ShellType,
                id: this._execution.computeId()
            };
        }
        else if (this._execution instanceof CustomExecution) {
            this._definition = {
                type: Task_1.ExtensionCallbackType,
                id: this._execution.computeId()
            };
        }
        else {
            this._definition = {
                type: Task_1.EmptyType,
                id: generateUuid()
            };
        }
    }
    get definition() {
        return this._definition;
    }
    set definition(value) {
        if (value === undefined || value === null) {
            throw illegalArgument('Kind can\'t be undefined or null');
        }
        this.clear();
        this._definition = value;
    }
    get scope() {
        return this._scope;
    }
    set target(value) {
        this.clear();
        this._scope = value;
    }
    get name() {
        return this._name;
    }
    set name(value) {
        if (typeof value !== 'string') {
            throw illegalArgument('name');
        }
        this.clear();
        this._name = value;
    }
    get execution() {
        return this._execution;
    }
    set execution(value) {
        if (value === null) {
            value = undefined;
        }
        this.clear();
        this._execution = value;
        const type = this._definition.type;
        if (Task_1.EmptyType === type || Task_1.ProcessType === type || Task_1.ShellType === type || Task_1.ExtensionCallbackType === type) {
            this.computeDefinitionBasedOnExecution();
        }
    }
    get problemMatchers() {
        return this._problemMatchers;
    }
    set problemMatchers(value) {
        if (!Array.isArray(value)) {
            this.clear();
            this._problemMatchers = [];
            this._hasDefinedMatchers = false;
            return;
        }
        else {
            this.clear();
            this._problemMatchers = value;
            this._hasDefinedMatchers = true;
        }
    }
    get hasDefinedMatchers() {
        return this._hasDefinedMatchers;
    }
    get isBackground() {
        return this._isBackground;
    }
    set isBackground(value) {
        if (value !== true && value !== false) {
            value = false;
        }
        this.clear();
        this._isBackground = value;
    }
    get source() {
        return this._source;
    }
    set source(value) {
        if (typeof value !== 'string' || value.length === 0) {
            throw illegalArgument('source must be a string of length > 0');
        }
        this.clear();
        this._source = value;
    }
    get group() {
        return this._group;
    }
    set group(value) {
        if (value === null) {
            value = undefined;
        }
        this.clear();
        this._group = value;
    }
    get detail() {
        return this._detail;
    }
    set detail(value) {
        if (value === null) {
            value = undefined;
        }
        this._detail = value;
    }
    get presentationOptions() {
        return this._presentationOptions;
    }
    set presentationOptions(value) {
        if (value === null || value === undefined) {
            value = Object.create(null);
        }
        this.clear();
        this._presentationOptions = value;
    }
    get runOptions() {
        return this._runOptions;
    }
    set runOptions(value) {
        if (value === null || value === undefined) {
            value = Object.create(null);
        }
        this.clear();
        this._runOptions = value;
    }
};
Task = Task_1 = __decorate([
    es5ClassCompat
], Task);
export { Task };
export var ProgressLocation;
(function (ProgressLocation) {
    ProgressLocation[ProgressLocation["SourceControl"] = 1] = "SourceControl";
    ProgressLocation[ProgressLocation["Window"] = 10] = "Window";
    ProgressLocation[ProgressLocation["Notification"] = 15] = "Notification";
})(ProgressLocation || (ProgressLocation = {}));
export var ViewBadge;
(function (ViewBadge) {
    function isViewBadge(thing) {
        const viewBadgeThing = thing;
        if (!isNumber(viewBadgeThing.value)) {
            console.log('INVALID view badge, invalid value', viewBadgeThing.value);
            return false;
        }
        if (viewBadgeThing.tooltip && !isString(viewBadgeThing.tooltip)) {
            console.log('INVALID view badge, invalid tooltip', viewBadgeThing.tooltip);
            return false;
        }
        return true;
    }
    ViewBadge.isViewBadge = isViewBadge;
})(ViewBadge || (ViewBadge = {}));
let TreeItem = TreeItem_1 = class TreeItem {
    static isTreeItem(thing, extension) {
        const treeItemThing = thing;
        if (treeItemThing.checkboxState !== undefined) {
            const checkbox = isNumber(treeItemThing.checkboxState) ? treeItemThing.checkboxState :
                isObject(treeItemThing.checkboxState) && isNumber(treeItemThing.checkboxState.state) ? treeItemThing.checkboxState.state : undefined;
            const tooltip = !isNumber(treeItemThing.checkboxState) && isObject(treeItemThing.checkboxState) ? treeItemThing.checkboxState.tooltip : undefined;
            if (checkbox === undefined || (checkbox !== TreeItemCheckboxState.Checked && checkbox !== TreeItemCheckboxState.Unchecked) || (tooltip !== undefined && !isString(tooltip))) {
                console.log('INVALID tree item, invalid checkboxState', treeItemThing.checkboxState);
                return false;
            }
        }
        if (thing instanceof TreeItem_1) {
            return true;
        }
        if (treeItemThing.label !== undefined && !isString(treeItemThing.label) && !(treeItemThing.label?.label)) {
            console.log('INVALID tree item, invalid label', treeItemThing.label);
            return false;
        }
        if ((treeItemThing.id !== undefined) && !isString(treeItemThing.id)) {
            console.log('INVALID tree item, invalid id', treeItemThing.id);
            return false;
        }
        if ((treeItemThing.iconPath !== undefined) && !isString(treeItemThing.iconPath) && !URI.isUri(treeItemThing.iconPath) && (!treeItemThing.iconPath || !isString(treeItemThing.iconPath.id))) {
            const asLightAndDarkThing = treeItemThing.iconPath;
            if (!asLightAndDarkThing || (!isString(asLightAndDarkThing.light) && !URI.isUri(asLightAndDarkThing.light) && !isString(asLightAndDarkThing.dark) && !URI.isUri(asLightAndDarkThing.dark))) {
                console.log('INVALID tree item, invalid iconPath', treeItemThing.iconPath);
                return false;
            }
        }
        if ((treeItemThing.description !== undefined) && !isString(treeItemThing.description) && (typeof treeItemThing.description !== 'boolean')) {
            console.log('INVALID tree item, invalid description', treeItemThing.description);
            return false;
        }
        if ((treeItemThing.resourceUri !== undefined) && !URI.isUri(treeItemThing.resourceUri)) {
            console.log('INVALID tree item, invalid resourceUri', treeItemThing.resourceUri);
            return false;
        }
        if ((treeItemThing.tooltip !== undefined) && !isString(treeItemThing.tooltip) && !(treeItemThing.tooltip instanceof MarkdownString)) {
            console.log('INVALID tree item, invalid tooltip', treeItemThing.tooltip);
            return false;
        }
        if ((treeItemThing.command !== undefined) && !treeItemThing.command.command) {
            console.log('INVALID tree item, invalid command', treeItemThing.command);
            return false;
        }
        if ((treeItemThing.collapsibleState !== undefined) && (treeItemThing.collapsibleState < TreeItemCollapsibleState.None) && (treeItemThing.collapsibleState > TreeItemCollapsibleState.Expanded)) {
            console.log('INVALID tree item, invalid collapsibleState', treeItemThing.collapsibleState);
            return false;
        }
        if ((treeItemThing.contextValue !== undefined) && !isString(treeItemThing.contextValue)) {
            console.log('INVALID tree item, invalid contextValue', treeItemThing.contextValue);
            return false;
        }
        if ((treeItemThing.accessibilityInformation !== undefined) && !treeItemThing.accessibilityInformation?.label) {
            console.log('INVALID tree item, invalid accessibilityInformation', treeItemThing.accessibilityInformation);
            return false;
        }
        return true;
    }
    constructor(arg1, collapsibleState = TreeItemCollapsibleState.None) {
        this.collapsibleState = collapsibleState;
        if (URI.isUri(arg1)) {
            this.resourceUri = arg1;
        }
        else {
            this.label = arg1;
        }
    }
};
TreeItem = TreeItem_1 = __decorate([
    es5ClassCompat
], TreeItem);
export { TreeItem };
export var TreeItemCollapsibleState;
(function (TreeItemCollapsibleState) {
    TreeItemCollapsibleState[TreeItemCollapsibleState["None"] = 0] = "None";
    TreeItemCollapsibleState[TreeItemCollapsibleState["Collapsed"] = 1] = "Collapsed";
    TreeItemCollapsibleState[TreeItemCollapsibleState["Expanded"] = 2] = "Expanded";
})(TreeItemCollapsibleState || (TreeItemCollapsibleState = {}));
export var TreeItemCheckboxState;
(function (TreeItemCheckboxState) {
    TreeItemCheckboxState[TreeItemCheckboxState["Unchecked"] = 0] = "Unchecked";
    TreeItemCheckboxState[TreeItemCheckboxState["Checked"] = 1] = "Checked";
})(TreeItemCheckboxState || (TreeItemCheckboxState = {}));
let DataTransferItem = class DataTransferItem {
    async asString() {
        return typeof this.value === 'string' ? this.value : JSON.stringify(this.value);
    }
    asFile() {
        return undefined;
    }
    constructor(value) {
        this.value = value;
    }
};
DataTransferItem = __decorate([
    es5ClassCompat
], DataTransferItem);
export { DataTransferItem };
/**
 * A data transfer item that has been created by VS Code instead of by a extension.
 *
 * Intentionally not exported to extensions.
 */
export class InternalDataTransferItem extends DataTransferItem {
}
/**
 * A data transfer item for a file.
 *
 * Intentionally not exported to extensions as only we can create these.
 */
export class InternalFileDataTransferItem extends InternalDataTransferItem {
    #file;
    constructor(file) {
        super('');
        this.#file = file;
    }
    asFile() {
        return this.#file;
    }
}
/**
 * Intentionally not exported to extensions
 */
export class DataTransferFile {
    constructor(name, uri, itemId, getData) {
        this.name = name;
        this.uri = uri;
        this._itemId = itemId;
        this._getData = getData;
    }
    data() {
        return this._getData();
    }
}
let DataTransfer = class DataTransfer {
    #items = new Map();
    constructor(init) {
        for (const [mime, item] of init ?? []) {
            const existing = this.#items.get(this.#normalizeMime(mime));
            if (existing) {
                existing.push(item);
            }
            else {
                this.#items.set(this.#normalizeMime(mime), [item]);
            }
        }
    }
    get(mimeType) {
        return this.#items.get(this.#normalizeMime(mimeType))?.[0];
    }
    set(mimeType, value) {
        // This intentionally overwrites all entries for a given mimetype.
        // This is similar to how the DOM DataTransfer type works
        this.#items.set(this.#normalizeMime(mimeType), [value]);
    }
    forEach(callbackfn, thisArg) {
        for (const [mime, items] of this.#items) {
            for (const item of items) {
                callbackfn.call(thisArg, item, mime, this);
            }
        }
    }
    *[Symbol.iterator]() {
        for (const [mime, items] of this.#items) {
            for (const item of items) {
                yield [mime, item];
            }
        }
    }
    #normalizeMime(mimeType) {
        return mimeType.toLowerCase();
    }
};
DataTransfer = __decorate([
    es5ClassCompat
], DataTransfer);
export { DataTransfer };
let DocumentDropEdit = class DocumentDropEdit {
    constructor(insertText, title, kind) {
        this.insertText = insertText;
        this.title = title;
        this.kind = kind;
    }
};
DocumentDropEdit = __decorate([
    es5ClassCompat
], DocumentDropEdit);
export { DocumentDropEdit };
export var DocumentPasteTriggerKind;
(function (DocumentPasteTriggerKind) {
    DocumentPasteTriggerKind[DocumentPasteTriggerKind["Automatic"] = 0] = "Automatic";
    DocumentPasteTriggerKind[DocumentPasteTriggerKind["PasteAs"] = 1] = "PasteAs";
})(DocumentPasteTriggerKind || (DocumentPasteTriggerKind = {}));
export class DocumentDropOrPasteEditKind {
    static { this.sep = '.'; }
    constructor(value) {
        this.value = value;
    }
    append(...parts) {
        return new DocumentDropOrPasteEditKind((this.value ? [this.value, ...parts] : parts).join(DocumentDropOrPasteEditKind.sep));
    }
    intersects(other) {
        return this.contains(other) || other.contains(this);
    }
    contains(other) {
        return this.value === other.value || other.value.startsWith(this.value + DocumentDropOrPasteEditKind.sep);
    }
}
DocumentDropOrPasteEditKind.Empty = new DocumentDropOrPasteEditKind('');
DocumentDropOrPasteEditKind.Text = new DocumentDropOrPasteEditKind('text');
DocumentDropOrPasteEditKind.TextUpdateImports = DocumentDropOrPasteEditKind.Text.append('updateImports');
export class DocumentPasteEdit {
    constructor(insertText, title, kind) {
        this.title = title;
        this.insertText = insertText;
        this.kind = kind;
    }
}
let ThemeIcon = class ThemeIcon {
    constructor(id, color) {
        this.id = id;
        this.color = color;
    }
    static isThemeIcon(thing) {
        if (typeof thing.id !== 'string') {
            console.log('INVALID ThemeIcon, invalid id', thing.id);
            return false;
        }
        return true;
    }
};
ThemeIcon = __decorate([
    es5ClassCompat
], ThemeIcon);
export { ThemeIcon };
ThemeIcon.File = new ThemeIcon('file');
ThemeIcon.Folder = new ThemeIcon('folder');
let ThemeColor = class ThemeColor {
    constructor(id) {
        this.id = id;
    }
};
ThemeColor = __decorate([
    es5ClassCompat
], ThemeColor);
export { ThemeColor };
export var ConfigurationTarget;
(function (ConfigurationTarget) {
    ConfigurationTarget[ConfigurationTarget["Global"] = 1] = "Global";
    ConfigurationTarget[ConfigurationTarget["Workspace"] = 2] = "Workspace";
    ConfigurationTarget[ConfigurationTarget["WorkspaceFolder"] = 3] = "WorkspaceFolder";
})(ConfigurationTarget || (ConfigurationTarget = {}));
let RelativePattern = class RelativePattern {
    get base() {
        return this._base;
    }
    set base(base) {
        this._base = base;
        this._baseUri = URI.file(base);
    }
    get baseUri() {
        return this._baseUri;
    }
    set baseUri(baseUri) {
        this._baseUri = baseUri;
        this._base = baseUri.fsPath;
    }
    constructor(base, pattern) {
        if (typeof base !== 'string') {
            if (!base || !URI.isUri(base) && !URI.isUri(base.uri)) {
                throw illegalArgument('base');
            }
        }
        if (typeof pattern !== 'string') {
            throw illegalArgument('pattern');
        }
        if (typeof base === 'string') {
            this.baseUri = URI.file(base);
        }
        else if (URI.isUri(base)) {
            this.baseUri = base;
        }
        else {
            this.baseUri = base.uri;
        }
        this.pattern = pattern;
    }
    toJSON() {
        return {
            pattern: this.pattern,
            base: this.base,
            baseUri: this.baseUri.toJSON()
        };
    }
};
RelativePattern = __decorate([
    es5ClassCompat
], RelativePattern);
export { RelativePattern };
const breakpointIds = new WeakMap();
/**
 * We want to be able to construct Breakpoints internally that have a particular id, but we don't want extensions to be
 * able to do this with the exposed Breakpoint classes in extension API.
 * We also want "instanceof" to work with debug.breakpoints and the exposed breakpoint classes.
 * And private members will be renamed in the built js, so casting to any and setting a private member is not safe.
 * So, we store internal breakpoint IDs in a WeakMap. This function must be called after constructing a Breakpoint
 * with a known id.
 */
export function setBreakpointId(bp, id) {
    breakpointIds.set(bp, id);
}
let Breakpoint = class Breakpoint {
    constructor(enabled, condition, hitCondition, logMessage, mode) {
        this.enabled = typeof enabled === 'boolean' ? enabled : true;
        if (typeof condition === 'string') {
            this.condition = condition;
        }
        if (typeof hitCondition === 'string') {
            this.hitCondition = hitCondition;
        }
        if (typeof logMessage === 'string') {
            this.logMessage = logMessage;
        }
        if (typeof mode === 'string') {
            this.mode = mode;
        }
    }
    get id() {
        if (!this._id) {
            this._id = breakpointIds.get(this) ?? generateUuid();
        }
        return this._id;
    }
};
Breakpoint = __decorate([
    es5ClassCompat
], Breakpoint);
export { Breakpoint };
let SourceBreakpoint = class SourceBreakpoint extends Breakpoint {
    constructor(location, enabled, condition, hitCondition, logMessage, mode) {
        super(enabled, condition, hitCondition, logMessage, mode);
        if (location === null) {
            throw illegalArgument('location');
        }
        this.location = location;
    }
};
SourceBreakpoint = __decorate([
    es5ClassCompat
], SourceBreakpoint);
export { SourceBreakpoint };
let FunctionBreakpoint = class FunctionBreakpoint extends Breakpoint {
    constructor(functionName, enabled, condition, hitCondition, logMessage, mode) {
        super(enabled, condition, hitCondition, logMessage, mode);
        this.functionName = functionName;
    }
};
FunctionBreakpoint = __decorate([
    es5ClassCompat
], FunctionBreakpoint);
export { FunctionBreakpoint };
let DataBreakpoint = class DataBreakpoint extends Breakpoint {
    constructor(label, dataId, canPersist, enabled, condition, hitCondition, logMessage, mode) {
        super(enabled, condition, hitCondition, logMessage, mode);
        if (!dataId) {
            throw illegalArgument('dataId');
        }
        this.label = label;
        this.dataId = dataId;
        this.canPersist = canPersist;
    }
};
DataBreakpoint = __decorate([
    es5ClassCompat
], DataBreakpoint);
export { DataBreakpoint };
let DebugAdapterExecutable = class DebugAdapterExecutable {
    constructor(command, args, options) {
        this.command = command;
        this.args = args || [];
        this.options = options;
    }
};
DebugAdapterExecutable = __decorate([
    es5ClassCompat
], DebugAdapterExecutable);
export { DebugAdapterExecutable };
let DebugAdapterServer = class DebugAdapterServer {
    constructor(port, host) {
        this.port = port;
        this.host = host;
    }
};
DebugAdapterServer = __decorate([
    es5ClassCompat
], DebugAdapterServer);
export { DebugAdapterServer };
let DebugAdapterNamedPipeServer = class DebugAdapterNamedPipeServer {
    constructor(path) {
        this.path = path;
    }
};
DebugAdapterNamedPipeServer = __decorate([
    es5ClassCompat
], DebugAdapterNamedPipeServer);
export { DebugAdapterNamedPipeServer };
let DebugAdapterInlineImplementation = class DebugAdapterInlineImplementation {
    constructor(impl) {
        this.implementation = impl;
    }
};
DebugAdapterInlineImplementation = __decorate([
    es5ClassCompat
], DebugAdapterInlineImplementation);
export { DebugAdapterInlineImplementation };
export class DebugStackFrame {
    constructor(session, threadId, frameId) {
        this.session = session;
        this.threadId = threadId;
        this.frameId = frameId;
    }
}
export class DebugThread {
    constructor(session, threadId) {
        this.session = session;
        this.threadId = threadId;
    }
}
let EvaluatableExpression = class EvaluatableExpression {
    constructor(range, expression) {
        this.range = range;
        this.expression = expression;
    }
};
EvaluatableExpression = __decorate([
    es5ClassCompat
], EvaluatableExpression);
export { EvaluatableExpression };
export var InlineCompletionTriggerKind;
(function (InlineCompletionTriggerKind) {
    InlineCompletionTriggerKind[InlineCompletionTriggerKind["Invoke"] = 0] = "Invoke";
    InlineCompletionTriggerKind[InlineCompletionTriggerKind["Automatic"] = 1] = "Automatic";
})(InlineCompletionTriggerKind || (InlineCompletionTriggerKind = {}));
export var InlineCompletionsDisposeReasonKind;
(function (InlineCompletionsDisposeReasonKind) {
    InlineCompletionsDisposeReasonKind[InlineCompletionsDisposeReasonKind["Other"] = 0] = "Other";
    InlineCompletionsDisposeReasonKind[InlineCompletionsDisposeReasonKind["Empty"] = 1] = "Empty";
    InlineCompletionsDisposeReasonKind[InlineCompletionsDisposeReasonKind["TokenCancellation"] = 2] = "TokenCancellation";
    InlineCompletionsDisposeReasonKind[InlineCompletionsDisposeReasonKind["LostRace"] = 3] = "LostRace";
    InlineCompletionsDisposeReasonKind[InlineCompletionsDisposeReasonKind["NotTaken"] = 4] = "NotTaken";
})(InlineCompletionsDisposeReasonKind || (InlineCompletionsDisposeReasonKind = {}));
let InlineValueText = class InlineValueText {
    constructor(range, text) {
        this.range = range;
        this.text = text;
    }
};
InlineValueText = __decorate([
    es5ClassCompat
], InlineValueText);
export { InlineValueText };
let InlineValueVariableLookup = class InlineValueVariableLookup {
    constructor(range, variableName, caseSensitiveLookup = true) {
        this.range = range;
        this.variableName = variableName;
        this.caseSensitiveLookup = caseSensitiveLookup;
    }
};
InlineValueVariableLookup = __decorate([
    es5ClassCompat
], InlineValueVariableLookup);
export { InlineValueVariableLookup };
let InlineValueEvaluatableExpression = class InlineValueEvaluatableExpression {
    constructor(range, expression) {
        this.range = range;
        this.expression = expression;
    }
};
InlineValueEvaluatableExpression = __decorate([
    es5ClassCompat
], InlineValueEvaluatableExpression);
export { InlineValueEvaluatableExpression };
let InlineValueContext = class InlineValueContext {
    constructor(frameId, range) {
        this.frameId = frameId;
        this.stoppedLocation = range;
    }
};
InlineValueContext = __decorate([
    es5ClassCompat
], InlineValueContext);
export { InlineValueContext };
export var NewSymbolNameTag;
(function (NewSymbolNameTag) {
    NewSymbolNameTag[NewSymbolNameTag["AIGenerated"] = 1] = "AIGenerated";
})(NewSymbolNameTag || (NewSymbolNameTag = {}));
export var NewSymbolNameTriggerKind;
(function (NewSymbolNameTriggerKind) {
    NewSymbolNameTriggerKind[NewSymbolNameTriggerKind["Invoke"] = 0] = "Invoke";
    NewSymbolNameTriggerKind[NewSymbolNameTriggerKind["Automatic"] = 1] = "Automatic";
})(NewSymbolNameTriggerKind || (NewSymbolNameTriggerKind = {}));
export class NewSymbolName {
    constructor(newSymbolName, tags) {
        this.newSymbolName = newSymbolName;
        this.tags = tags;
    }
}
//#region file api
export var FileChangeType;
(function (FileChangeType) {
    FileChangeType[FileChangeType["Changed"] = 1] = "Changed";
    FileChangeType[FileChangeType["Created"] = 2] = "Created";
    FileChangeType[FileChangeType["Deleted"] = 3] = "Deleted";
})(FileChangeType || (FileChangeType = {}));
let FileSystemError = FileSystemError_1 = class FileSystemError extends Error {
    static FileExists(messageOrUri) {
        return new FileSystemError_1(messageOrUri, FileSystemProviderErrorCode.FileExists, FileSystemError_1.FileExists);
    }
    static FileNotFound(messageOrUri) {
        return new FileSystemError_1(messageOrUri, FileSystemProviderErrorCode.FileNotFound, FileSystemError_1.FileNotFound);
    }
    static FileNotADirectory(messageOrUri) {
        return new FileSystemError_1(messageOrUri, FileSystemProviderErrorCode.FileNotADirectory, FileSystemError_1.FileNotADirectory);
    }
    static FileIsADirectory(messageOrUri) {
        return new FileSystemError_1(messageOrUri, FileSystemProviderErrorCode.FileIsADirectory, FileSystemError_1.FileIsADirectory);
    }
    static NoPermissions(messageOrUri) {
        return new FileSystemError_1(messageOrUri, FileSystemProviderErrorCode.NoPermissions, FileSystemError_1.NoPermissions);
    }
    static Unavailable(messageOrUri) {
        return new FileSystemError_1(messageOrUri, FileSystemProviderErrorCode.Unavailable, FileSystemError_1.Unavailable);
    }
    constructor(uriOrMessage, code = FileSystemProviderErrorCode.Unknown, terminator) {
        super(URI.isUri(uriOrMessage) ? uriOrMessage.toString(true) : uriOrMessage);
        this.code = terminator?.name ?? 'Unknown';
        // mark the error as file system provider error so that
        // we can extract the error code on the receiving side
        markAsFileSystemProviderError(this, code);
        // workaround when extending builtin objects and when compiling to ES5, see:
        // https://github.com/microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
        Object.setPrototypeOf(this, FileSystemError_1.prototype);
        if (typeof Error.captureStackTrace === 'function' && typeof terminator === 'function') {
            // nice stack traces
            Error.captureStackTrace(this, terminator);
        }
    }
};
FileSystemError = FileSystemError_1 = __decorate([
    es5ClassCompat
], FileSystemError);
export { FileSystemError };
//#endregion
//#region folding api
let FoldingRange = class FoldingRange {
    constructor(start, end, kind) {
        this.start = start;
        this.end = end;
        this.kind = kind;
    }
};
FoldingRange = __decorate([
    es5ClassCompat
], FoldingRange);
export { FoldingRange };
export var FoldingRangeKind;
(function (FoldingRangeKind) {
    FoldingRangeKind[FoldingRangeKind["Comment"] = 1] = "Comment";
    FoldingRangeKind[FoldingRangeKind["Imports"] = 2] = "Imports";
    FoldingRangeKind[FoldingRangeKind["Region"] = 3] = "Region";
})(FoldingRangeKind || (FoldingRangeKind = {}));
//#endregion
//#region Comment
export var CommentThreadCollapsibleState;
(function (CommentThreadCollapsibleState) {
    /**
     * Determines an item is collapsed
     */
    CommentThreadCollapsibleState[CommentThreadCollapsibleState["Collapsed"] = 0] = "Collapsed";
    /**
     * Determines an item is expanded
     */
    CommentThreadCollapsibleState[CommentThreadCollapsibleState["Expanded"] = 1] = "Expanded";
})(CommentThreadCollapsibleState || (CommentThreadCollapsibleState = {}));
export var CommentMode;
(function (CommentMode) {
    CommentMode[CommentMode["Editing"] = 0] = "Editing";
    CommentMode[CommentMode["Preview"] = 1] = "Preview";
})(CommentMode || (CommentMode = {}));
export var CommentState;
(function (CommentState) {
    CommentState[CommentState["Published"] = 0] = "Published";
    CommentState[CommentState["Draft"] = 1] = "Draft";
})(CommentState || (CommentState = {}));
export var CommentThreadState;
(function (CommentThreadState) {
    CommentThreadState[CommentThreadState["Unresolved"] = 0] = "Unresolved";
    CommentThreadState[CommentThreadState["Resolved"] = 1] = "Resolved";
})(CommentThreadState || (CommentThreadState = {}));
export var CommentThreadApplicability;
(function (CommentThreadApplicability) {
    CommentThreadApplicability[CommentThreadApplicability["Current"] = 0] = "Current";
    CommentThreadApplicability[CommentThreadApplicability["Outdated"] = 1] = "Outdated";
})(CommentThreadApplicability || (CommentThreadApplicability = {}));
export var CommentThreadFocus;
(function (CommentThreadFocus) {
    CommentThreadFocus[CommentThreadFocus["Reply"] = 1] = "Reply";
    CommentThreadFocus[CommentThreadFocus["Comment"] = 2] = "Comment";
})(CommentThreadFocus || (CommentThreadFocus = {}));
//#endregion
//#region Semantic Coloring
export class SemanticTokensLegend {
    constructor(tokenTypes, tokenModifiers = []) {
        this.tokenTypes = tokenTypes;
        this.tokenModifiers = tokenModifiers;
    }
}
function isStrArrayOrUndefined(arg) {
    return ((typeof arg === 'undefined') || isStringArray(arg));
}
export class SemanticTokensBuilder {
    constructor(legend) {
        this._prevLine = 0;
        this._prevChar = 0;
        this._dataIsSortedAndDeltaEncoded = true;
        this._data = [];
        this._dataLen = 0;
        this._tokenTypeStrToInt = new Map();
        this._tokenModifierStrToInt = new Map();
        this._hasLegend = false;
        if (legend) {
            this._hasLegend = true;
            for (let i = 0, len = legend.tokenTypes.length; i < len; i++) {
                this._tokenTypeStrToInt.set(legend.tokenTypes[i], i);
            }
            for (let i = 0, len = legend.tokenModifiers.length; i < len; i++) {
                this._tokenModifierStrToInt.set(legend.tokenModifiers[i], i);
            }
        }
    }
    push(arg0, arg1, arg2, arg3, arg4) {
        if (typeof arg0 === 'number' && typeof arg1 === 'number' && typeof arg2 === 'number' && typeof arg3 === 'number' && (typeof arg4 === 'number' || typeof arg4 === 'undefined')) {
            if (typeof arg4 === 'undefined') {
                arg4 = 0;
            }
            // 1st overload
            return this._pushEncoded(arg0, arg1, arg2, arg3, arg4);
        }
        if (Range.isRange(arg0) && typeof arg1 === 'string' && isStrArrayOrUndefined(arg2)) {
            // 2nd overload
            return this._push(arg0, arg1, arg2);
        }
        throw illegalArgument();
    }
    _push(range, tokenType, tokenModifiers) {
        if (!this._hasLegend) {
            throw new Error('Legend must be provided in constructor');
        }
        if (range.start.line !== range.end.line) {
            throw new Error('`range` cannot span multiple lines');
        }
        if (!this._tokenTypeStrToInt.has(tokenType)) {
            throw new Error('`tokenType` is not in the provided legend');
        }
        const line = range.start.line;
        const char = range.start.character;
        const length = range.end.character - range.start.character;
        const nTokenType = this._tokenTypeStrToInt.get(tokenType);
        let nTokenModifiers = 0;
        if (tokenModifiers) {
            for (const tokenModifier of tokenModifiers) {
                if (!this._tokenModifierStrToInt.has(tokenModifier)) {
                    throw new Error('`tokenModifier` is not in the provided legend');
                }
                const nTokenModifier = this._tokenModifierStrToInt.get(tokenModifier);
                nTokenModifiers |= (1 << nTokenModifier) >>> 0;
            }
        }
        this._pushEncoded(line, char, length, nTokenType, nTokenModifiers);
    }
    _pushEncoded(line, char, length, tokenType, tokenModifiers) {
        if (this._dataIsSortedAndDeltaEncoded && (line < this._prevLine || (line === this._prevLine && char < this._prevChar))) {
            // push calls were ordered and are no longer ordered
            this._dataIsSortedAndDeltaEncoded = false;
            // Remove delta encoding from data
            const tokenCount = (this._data.length / 5) | 0;
            let prevLine = 0;
            let prevChar = 0;
            for (let i = 0; i < tokenCount; i++) {
                let line = this._data[5 * i];
                let char = this._data[5 * i + 1];
                if (line === 0) {
                    // on the same line as previous token
                    line = prevLine;
                    char += prevChar;
                }
                else {
                    // on a different line than previous token
                    line += prevLine;
                }
                this._data[5 * i] = line;
                this._data[5 * i + 1] = char;
                prevLine = line;
                prevChar = char;
            }
        }
        let pushLine = line;
        let pushChar = char;
        if (this._dataIsSortedAndDeltaEncoded && this._dataLen > 0) {
            pushLine -= this._prevLine;
            if (pushLine === 0) {
                pushChar -= this._prevChar;
            }
        }
        this._data[this._dataLen++] = pushLine;
        this._data[this._dataLen++] = pushChar;
        this._data[this._dataLen++] = length;
        this._data[this._dataLen++] = tokenType;
        this._data[this._dataLen++] = tokenModifiers;
        this._prevLine = line;
        this._prevChar = char;
    }
    static _sortAndDeltaEncode(data) {
        const pos = [];
        const tokenCount = (data.length / 5) | 0;
        for (let i = 0; i < tokenCount; i++) {
            pos[i] = i;
        }
        pos.sort((a, b) => {
            const aLine = data[5 * a];
            const bLine = data[5 * b];
            if (aLine === bLine) {
                const aChar = data[5 * a + 1];
                const bChar = data[5 * b + 1];
                return aChar - bChar;
            }
            return aLine - bLine;
        });
        const result = new Uint32Array(data.length);
        let prevLine = 0;
        let prevChar = 0;
        for (let i = 0; i < tokenCount; i++) {
            const srcOffset = 5 * pos[i];
            const line = data[srcOffset + 0];
            const char = data[srcOffset + 1];
            const length = data[srcOffset + 2];
            const tokenType = data[srcOffset + 3];
            const tokenModifiers = data[srcOffset + 4];
            const pushLine = line - prevLine;
            const pushChar = (pushLine === 0 ? char - prevChar : char);
            const dstOffset = 5 * i;
            result[dstOffset + 0] = pushLine;
            result[dstOffset + 1] = pushChar;
            result[dstOffset + 2] = length;
            result[dstOffset + 3] = tokenType;
            result[dstOffset + 4] = tokenModifiers;
            prevLine = line;
            prevChar = char;
        }
        return result;
    }
    build(resultId) {
        if (!this._dataIsSortedAndDeltaEncoded) {
            return new SemanticTokens(SemanticTokensBuilder._sortAndDeltaEncode(this._data), resultId);
        }
        return new SemanticTokens(new Uint32Array(this._data), resultId);
    }
}
export class SemanticTokens {
    constructor(data, resultId) {
        this.resultId = resultId;
        this.data = data;
    }
}
export class SemanticTokensEdit {
    constructor(start, deleteCount, data) {
        this.start = start;
        this.deleteCount = deleteCount;
        this.data = data;
    }
}
export class SemanticTokensEdits {
    constructor(edits, resultId) {
        this.resultId = resultId;
        this.edits = edits;
    }
}
//#endregion
//#region debug
export var DebugConsoleMode;
(function (DebugConsoleMode) {
    /**
     * Debug session should have a separate debug console.
     */
    DebugConsoleMode[DebugConsoleMode["Separate"] = 0] = "Separate";
    /**
     * Debug session should share debug console with its parent session.
     * This value has no effect for sessions which do not have a parent session.
     */
    DebugConsoleMode[DebugConsoleMode["MergeWithParent"] = 1] = "MergeWithParent";
})(DebugConsoleMode || (DebugConsoleMode = {}));
export class DebugVisualization {
    constructor(name) {
        this.name = name;
    }
}
//#endregion
export var QuickInputButtonLocation;
(function (QuickInputButtonLocation) {
    QuickInputButtonLocation[QuickInputButtonLocation["Title"] = 1] = "Title";
    QuickInputButtonLocation[QuickInputButtonLocation["Inline"] = 2] = "Inline";
    QuickInputButtonLocation[QuickInputButtonLocation["Input"] = 3] = "Input";
})(QuickInputButtonLocation || (QuickInputButtonLocation = {}));
let QuickInputButtons = class QuickInputButtons {
    static { this.Back = { iconPath: new ThemeIcon('arrow-left') }; }
    constructor() { }
};
QuickInputButtons = __decorate([
    es5ClassCompat
], QuickInputButtons);
export { QuickInputButtons };
export var QuickPickItemKind;
(function (QuickPickItemKind) {
    QuickPickItemKind[QuickPickItemKind["Separator"] = -1] = "Separator";
    QuickPickItemKind[QuickPickItemKind["Default"] = 0] = "Default";
})(QuickPickItemKind || (QuickPickItemKind = {}));
export var InputBoxValidationSeverity;
(function (InputBoxValidationSeverity) {
    InputBoxValidationSeverity[InputBoxValidationSeverity["Info"] = 1] = "Info";
    InputBoxValidationSeverity[InputBoxValidationSeverity["Warning"] = 2] = "Warning";
    InputBoxValidationSeverity[InputBoxValidationSeverity["Error"] = 3] = "Error";
})(InputBoxValidationSeverity || (InputBoxValidationSeverity = {}));
export var ExtensionKind;
(function (ExtensionKind) {
    ExtensionKind[ExtensionKind["UI"] = 1] = "UI";
    ExtensionKind[ExtensionKind["Workspace"] = 2] = "Workspace";
})(ExtensionKind || (ExtensionKind = {}));
export class FileDecoration {
    static validate(d) {
        if (typeof d.badge === 'string') {
            let len = nextCharLength(d.badge, 0);
            if (len < d.badge.length) {
                len += nextCharLength(d.badge, len);
            }
            if (d.badge.length > len) {
                throw new Error(`The 'badge'-property must be undefined or a short character`);
            }
        }
        else if (d.badge) {
            if (!ThemeIcon.isThemeIcon(d.badge)) {
                throw new Error(`The 'badge'-property is not a valid ThemeIcon`);
            }
        }
        if (!d.color && !d.badge && !d.tooltip) {
            throw new Error(`The decoration is empty`);
        }
        return true;
    }
    constructor(badge, tooltip, color) {
        this.badge = badge;
        this.tooltip = tooltip;
        this.color = color;
    }
}
//#region Theming
let ColorTheme = class ColorTheme {
    constructor(kind) {
        this.kind = kind;
    }
};
ColorTheme = __decorate([
    es5ClassCompat
], ColorTheme);
export { ColorTheme };
export var ColorThemeKind;
(function (ColorThemeKind) {
    ColorThemeKind[ColorThemeKind["Light"] = 1] = "Light";
    ColorThemeKind[ColorThemeKind["Dark"] = 2] = "Dark";
    ColorThemeKind[ColorThemeKind["HighContrast"] = 3] = "HighContrast";
    ColorThemeKind[ColorThemeKind["HighContrastLight"] = 4] = "HighContrastLight";
})(ColorThemeKind || (ColorThemeKind = {}));
//#endregion Theming
//#region Notebook
export class CellErrorStackFrame {
    /**
     * @param label The name of the stack frame
     * @param file The file URI of the stack frame
     * @param position The position of the stack frame within the file
     */
    constructor(label, uri, position) {
        this.label = label;
        this.uri = uri;
        this.position = position;
    }
}
export var NotebookCellExecutionState;
(function (NotebookCellExecutionState) {
    NotebookCellExecutionState[NotebookCellExecutionState["Idle"] = 1] = "Idle";
    NotebookCellExecutionState[NotebookCellExecutionState["Pending"] = 2] = "Pending";
    NotebookCellExecutionState[NotebookCellExecutionState["Executing"] = 3] = "Executing";
})(NotebookCellExecutionState || (NotebookCellExecutionState = {}));
export var NotebookCellStatusBarAlignment;
(function (NotebookCellStatusBarAlignment) {
    NotebookCellStatusBarAlignment[NotebookCellStatusBarAlignment["Left"] = 1] = "Left";
    NotebookCellStatusBarAlignment[NotebookCellStatusBarAlignment["Right"] = 2] = "Right";
})(NotebookCellStatusBarAlignment || (NotebookCellStatusBarAlignment = {}));
export var NotebookEditorRevealType;
(function (NotebookEditorRevealType) {
    NotebookEditorRevealType[NotebookEditorRevealType["Default"] = 0] = "Default";
    NotebookEditorRevealType[NotebookEditorRevealType["InCenter"] = 1] = "InCenter";
    NotebookEditorRevealType[NotebookEditorRevealType["InCenterIfOutsideViewport"] = 2] = "InCenterIfOutsideViewport";
    NotebookEditorRevealType[NotebookEditorRevealType["AtTop"] = 3] = "AtTop";
})(NotebookEditorRevealType || (NotebookEditorRevealType = {}));
export class NotebookCellStatusBarItem {
    constructor(text, alignment) {
        this.text = text;
        this.alignment = alignment;
    }
}
export var NotebookControllerAffinity;
(function (NotebookControllerAffinity) {
    NotebookControllerAffinity[NotebookControllerAffinity["Default"] = 1] = "Default";
    NotebookControllerAffinity[NotebookControllerAffinity["Preferred"] = 2] = "Preferred";
})(NotebookControllerAffinity || (NotebookControllerAffinity = {}));
export var NotebookControllerAffinity2;
(function (NotebookControllerAffinity2) {
    NotebookControllerAffinity2[NotebookControllerAffinity2["Default"] = 1] = "Default";
    NotebookControllerAffinity2[NotebookControllerAffinity2["Preferred"] = 2] = "Preferred";
    NotebookControllerAffinity2[NotebookControllerAffinity2["Hidden"] = -1] = "Hidden";
})(NotebookControllerAffinity2 || (NotebookControllerAffinity2 = {}));
export class NotebookRendererScript {
    constructor(uri, provides = []) {
        this.uri = uri;
        this.provides = asArray(provides);
    }
}
export class NotebookKernelSourceAction {
    constructor(label) {
        this.label = label;
    }
}
export var NotebookVariablesRequestKind;
(function (NotebookVariablesRequestKind) {
    NotebookVariablesRequestKind[NotebookVariablesRequestKind["Named"] = 1] = "Named";
    NotebookVariablesRequestKind[NotebookVariablesRequestKind["Indexed"] = 2] = "Indexed";
})(NotebookVariablesRequestKind || (NotebookVariablesRequestKind = {}));
//#endregion
//#region Timeline
let TimelineItem = class TimelineItem {
    constructor(label, timestamp) {
        this.label = label;
        this.timestamp = timestamp;
    }
};
TimelineItem = __decorate([
    es5ClassCompat
], TimelineItem);
export { TimelineItem };
//#endregion Timeline
//#region ExtensionContext
export var ExtensionMode;
(function (ExtensionMode) {
    /**
     * The extension is installed normally (for example, from the marketplace
     * or VSIX) in VS Code.
     */
    ExtensionMode[ExtensionMode["Production"] = 1] = "Production";
    /**
     * The extension is running from an `--extensionDevelopmentPath` provided
     * when launching VS Code.
     */
    ExtensionMode[ExtensionMode["Development"] = 2] = "Development";
    /**
     * The extension is running from an `--extensionDevelopmentPath` and
     * the extension host is running unit tests.
     */
    ExtensionMode[ExtensionMode["Test"] = 3] = "Test";
})(ExtensionMode || (ExtensionMode = {}));
export var ExtensionRuntime;
(function (ExtensionRuntime) {
    /**
     * The extension is running in a NodeJS extension host. Runtime access to NodeJS APIs is available.
     */
    ExtensionRuntime[ExtensionRuntime["Node"] = 1] = "Node";
    /**
     * The extension is running in a Webworker extension host. Runtime access is limited to Webworker APIs.
     */
    ExtensionRuntime[ExtensionRuntime["Webworker"] = 2] = "Webworker";
})(ExtensionRuntime || (ExtensionRuntime = {}));
//#endregion ExtensionContext
export var StandardTokenType;
(function (StandardTokenType) {
    StandardTokenType[StandardTokenType["Other"] = 0] = "Other";
    StandardTokenType[StandardTokenType["Comment"] = 1] = "Comment";
    StandardTokenType[StandardTokenType["String"] = 2] = "String";
    StandardTokenType[StandardTokenType["RegEx"] = 3] = "RegEx";
})(StandardTokenType || (StandardTokenType = {}));
export class LinkedEditingRanges {
    constructor(ranges, wordPattern) {
        this.ranges = ranges;
        this.wordPattern = wordPattern;
    }
}
//#region ports
export class PortAttributes {
    constructor(autoForwardAction) {
        this._autoForwardAction = autoForwardAction;
    }
    get autoForwardAction() {
        return this._autoForwardAction;
    }
}
//#endregion ports
//#region Testing
export var TestResultState;
(function (TestResultState) {
    TestResultState[TestResultState["Queued"] = 1] = "Queued";
    TestResultState[TestResultState["Running"] = 2] = "Running";
    TestResultState[TestResultState["Passed"] = 3] = "Passed";
    TestResultState[TestResultState["Failed"] = 4] = "Failed";
    TestResultState[TestResultState["Skipped"] = 5] = "Skipped";
    TestResultState[TestResultState["Errored"] = 6] = "Errored";
})(TestResultState || (TestResultState = {}));
export var TestRunProfileKind;
(function (TestRunProfileKind) {
    TestRunProfileKind[TestRunProfileKind["Run"] = 1] = "Run";
    TestRunProfileKind[TestRunProfileKind["Debug"] = 2] = "Debug";
    TestRunProfileKind[TestRunProfileKind["Coverage"] = 3] = "Coverage";
})(TestRunProfileKind || (TestRunProfileKind = {}));
export class TestRunProfileBase {
    constructor(controllerId, profileId, kind) {
        this.controllerId = controllerId;
        this.profileId = profileId;
        this.kind = kind;
    }
}
let TestRunRequest = class TestRunRequest {
    constructor(include = undefined, exclude = undefined, profile = undefined, continuous = false, preserveFocus = true) {
        this.include = include;
        this.exclude = exclude;
        this.profile = profile;
        this.continuous = continuous;
        this.preserveFocus = preserveFocus;
    }
};
TestRunRequest = __decorate([
    es5ClassCompat
], TestRunRequest);
export { TestRunRequest };
let TestMessage = TestMessage_1 = class TestMessage {
    static diff(message, expected, actual) {
        const msg = new TestMessage_1(message);
        msg.expectedOutput = expected;
        msg.actualOutput = actual;
        return msg;
    }
    constructor(message) {
        this.message = message;
    }
};
TestMessage = TestMessage_1 = __decorate([
    es5ClassCompat
], TestMessage);
export { TestMessage };
let TestTag = class TestTag {
    constructor(id) {
        this.id = id;
    }
};
TestTag = __decorate([
    es5ClassCompat
], TestTag);
export { TestTag };
export class TestMessageStackFrame {
    /**
     * @param label The name of the stack frame
     * @param file The file URI of the stack frame
     * @param position The position of the stack frame within the file
     */
    constructor(label, uri, position) {
        this.label = label;
        this.uri = uri;
        this.position = position;
    }
}
//#endregion
//#region Test Coverage
export class TestCoverageCount {
    constructor(covered, total) {
        this.covered = covered;
        this.total = total;
        validateTestCoverageCount(this);
    }
}
export function validateTestCoverageCount(cc) {
    if (!cc) {
        return;
    }
    if (cc.covered > cc.total) {
        throw new Error(`The total number of covered items (${cc.covered}) cannot be greater than the total (${cc.total})`);
    }
    if (cc.total < 0) {
        throw new Error(`The number of covered items (${cc.total}) cannot be negative`);
    }
}
export class FileCoverage {
    static fromDetails(uri, details) {
        const statements = new TestCoverageCount(0, 0);
        const branches = new TestCoverageCount(0, 0);
        const decl = new TestCoverageCount(0, 0);
        for (const detail of details) {
            if ('branches' in detail) {
                statements.total += 1;
                statements.covered += detail.executed ? 1 : 0;
                for (const branch of detail.branches) {
                    branches.total += 1;
                    branches.covered += branch.executed ? 1 : 0;
                }
            }
            else {
                decl.total += 1;
                decl.covered += detail.executed ? 1 : 0;
            }
        }
        const coverage = new FileCoverage(uri, statements, branches.total > 0 ? branches : undefined, decl.total > 0 ? decl : undefined);
        coverage.detailedCoverage = details;
        return coverage;
    }
    constructor(uri, statementCoverage, branchCoverage, declarationCoverage, includesTests = []) {
        this.uri = uri;
        this.statementCoverage = statementCoverage;
        this.branchCoverage = branchCoverage;
        this.declarationCoverage = declarationCoverage;
        this.includesTests = includesTests;
    }
}
export class StatementCoverage {
    // back compat until finalization:
    get executionCount() { return +this.executed; }
    set executionCount(n) { this.executed = n; }
    constructor(executed, location, branches = []) {
        this.executed = executed;
        this.location = location;
        this.branches = branches;
    }
}
export class BranchCoverage {
    // back compat until finalization:
    get executionCount() { return +this.executed; }
    set executionCount(n) { this.executed = n; }
    constructor(executed, location, label) {
        this.executed = executed;
        this.location = location;
        this.label = label;
    }
}
export class DeclarationCoverage {
    // back compat until finalization:
    get executionCount() { return +this.executed; }
    set executionCount(n) { this.executed = n; }
    constructor(name, executed, location) {
        this.name = name;
        this.executed = executed;
        this.location = location;
    }
}
//#endregion
export var ExternalUriOpenerPriority;
(function (ExternalUriOpenerPriority) {
    ExternalUriOpenerPriority[ExternalUriOpenerPriority["None"] = 0] = "None";
    ExternalUriOpenerPriority[ExternalUriOpenerPriority["Option"] = 1] = "Option";
    ExternalUriOpenerPriority[ExternalUriOpenerPriority["Default"] = 2] = "Default";
    ExternalUriOpenerPriority[ExternalUriOpenerPriority["Preferred"] = 3] = "Preferred";
})(ExternalUriOpenerPriority || (ExternalUriOpenerPriority = {}));
export var WorkspaceTrustState;
(function (WorkspaceTrustState) {
    WorkspaceTrustState[WorkspaceTrustState["Untrusted"] = 0] = "Untrusted";
    WorkspaceTrustState[WorkspaceTrustState["Trusted"] = 1] = "Trusted";
    WorkspaceTrustState[WorkspaceTrustState["Unspecified"] = 2] = "Unspecified";
})(WorkspaceTrustState || (WorkspaceTrustState = {}));
export var PortAutoForwardAction;
(function (PortAutoForwardAction) {
    PortAutoForwardAction[PortAutoForwardAction["Notify"] = 1] = "Notify";
    PortAutoForwardAction[PortAutoForwardAction["OpenBrowser"] = 2] = "OpenBrowser";
    PortAutoForwardAction[PortAutoForwardAction["OpenPreview"] = 3] = "OpenPreview";
    PortAutoForwardAction[PortAutoForwardAction["Silent"] = 4] = "Silent";
    PortAutoForwardAction[PortAutoForwardAction["Ignore"] = 5] = "Ignore";
    PortAutoForwardAction[PortAutoForwardAction["OpenBrowserOnce"] = 6] = "OpenBrowserOnce";
})(PortAutoForwardAction || (PortAutoForwardAction = {}));
export class TypeHierarchyItem {
    constructor(kind, name, detail, uri, range, selectionRange) {
        this.kind = kind;
        this.name = name;
        this.detail = detail;
        this.uri = uri;
        this.range = range;
        this.selectionRange = selectionRange;
    }
}
//#region Tab Inputs
export class TextTabInput {
    constructor(uri) {
        this.uri = uri;
    }
}
export class TextDiffTabInput {
    constructor(original, modified) {
        this.original = original;
        this.modified = modified;
    }
}
export class TextMergeTabInput {
    constructor(base, input1, input2, result) {
        this.base = base;
        this.input1 = input1;
        this.input2 = input2;
        this.result = result;
    }
}
export class CustomEditorTabInput {
    constructor(uri, viewType) {
        this.uri = uri;
        this.viewType = viewType;
    }
}
export class WebviewEditorTabInput {
    constructor(viewType) {
        this.viewType = viewType;
    }
}
export class NotebookEditorTabInput {
    constructor(uri, notebookType) {
        this.uri = uri;
        this.notebookType = notebookType;
    }
}
export class NotebookDiffEditorTabInput {
    constructor(original, modified, notebookType) {
        this.original = original;
        this.modified = modified;
        this.notebookType = notebookType;
    }
}
export class TerminalEditorTabInput {
    constructor() { }
}
export class InteractiveWindowInput {
    constructor(uri, inputBoxUri) {
        this.uri = uri;
        this.inputBoxUri = inputBoxUri;
    }
}
export class ChatEditorTabInput {
    constructor() { }
}
export class TextMultiDiffTabInput {
    constructor(textDiffs) {
        this.textDiffs = textDiffs;
    }
}
//#endregion
//#region Chat
export var InteractiveSessionVoteDirection;
(function (InteractiveSessionVoteDirection) {
    InteractiveSessionVoteDirection[InteractiveSessionVoteDirection["Down"] = 0] = "Down";
    InteractiveSessionVoteDirection[InteractiveSessionVoteDirection["Up"] = 1] = "Up";
})(InteractiveSessionVoteDirection || (InteractiveSessionVoteDirection = {}));
export var ChatCopyKind;
(function (ChatCopyKind) {
    ChatCopyKind[ChatCopyKind["Action"] = 1] = "Action";
    ChatCopyKind[ChatCopyKind["Toolbar"] = 2] = "Toolbar";
})(ChatCopyKind || (ChatCopyKind = {}));
export var ChatVariableLevel;
(function (ChatVariableLevel) {
    ChatVariableLevel[ChatVariableLevel["Short"] = 1] = "Short";
    ChatVariableLevel[ChatVariableLevel["Medium"] = 2] = "Medium";
    ChatVariableLevel[ChatVariableLevel["Full"] = 3] = "Full";
})(ChatVariableLevel || (ChatVariableLevel = {}));
export class ChatCompletionItem {
    constructor(id, label, values) {
        this.id = id;
        this.label = label;
        this.values = values;
    }
}
export var ChatEditingSessionActionOutcome;
(function (ChatEditingSessionActionOutcome) {
    ChatEditingSessionActionOutcome[ChatEditingSessionActionOutcome["Accepted"] = 1] = "Accepted";
    ChatEditingSessionActionOutcome[ChatEditingSessionActionOutcome["Rejected"] = 2] = "Rejected";
    ChatEditingSessionActionOutcome[ChatEditingSessionActionOutcome["Saved"] = 3] = "Saved";
})(ChatEditingSessionActionOutcome || (ChatEditingSessionActionOutcome = {}));
export var ChatRequestEditedFileEventKind;
(function (ChatRequestEditedFileEventKind) {
    ChatRequestEditedFileEventKind[ChatRequestEditedFileEventKind["Keep"] = 1] = "Keep";
    ChatRequestEditedFileEventKind[ChatRequestEditedFileEventKind["Undo"] = 2] = "Undo";
    ChatRequestEditedFileEventKind[ChatRequestEditedFileEventKind["UserModification"] = 3] = "UserModification";
})(ChatRequestEditedFileEventKind || (ChatRequestEditedFileEventKind = {}));
//#endregion
//#region Interactive Editor
export var InteractiveEditorResponseFeedbackKind;
(function (InteractiveEditorResponseFeedbackKind) {
    InteractiveEditorResponseFeedbackKind[InteractiveEditorResponseFeedbackKind["Unhelpful"] = 0] = "Unhelpful";
    InteractiveEditorResponseFeedbackKind[InteractiveEditorResponseFeedbackKind["Helpful"] = 1] = "Helpful";
    InteractiveEditorResponseFeedbackKind[InteractiveEditorResponseFeedbackKind["Undone"] = 2] = "Undone";
    InteractiveEditorResponseFeedbackKind[InteractiveEditorResponseFeedbackKind["Accepted"] = 3] = "Accepted";
    InteractiveEditorResponseFeedbackKind[InteractiveEditorResponseFeedbackKind["Bug"] = 4] = "Bug";
})(InteractiveEditorResponseFeedbackKind || (InteractiveEditorResponseFeedbackKind = {}));
export var ChatResultFeedbackKind;
(function (ChatResultFeedbackKind) {
    ChatResultFeedbackKind[ChatResultFeedbackKind["Unhelpful"] = 0] = "Unhelpful";
    ChatResultFeedbackKind[ChatResultFeedbackKind["Helpful"] = 1] = "Helpful";
})(ChatResultFeedbackKind || (ChatResultFeedbackKind = {}));
export class ChatResponseMarkdownPart {
    constructor(value) {
        if (typeof value !== 'string' && value.isTrusted === true) {
            throw new Error('The boolean form of MarkdownString.isTrusted is NOT supported for chat participants.');
        }
        this.value = typeof value === 'string' ? new MarkdownString(value) : value;
    }
}
/**
 * TODO if 'vulnerabilities' is finalized, this should be merged with the base ChatResponseMarkdownPart. I just don't see how to do that while keeping
 * vulnerabilities in a seperate API proposal in a clean way.
 */
export class ChatResponseMarkdownWithVulnerabilitiesPart {
    constructor(value, vulnerabilities) {
        if (typeof value !== 'string' && value.isTrusted === true) {
            throw new Error('The boolean form of MarkdownString.isTrusted is NOT supported for chat participants.');
        }
        this.value = typeof value === 'string' ? new MarkdownString(value) : value;
        this.vulnerabilities = vulnerabilities;
    }
}
export class ChatResponseConfirmationPart {
    constructor(title, message, data, buttons) {
        this.title = title;
        this.message = message;
        this.data = data;
        this.buttons = buttons;
    }
}
export class ChatResponseFileTreePart {
    constructor(value, baseUri) {
        this.value = value;
        this.baseUri = baseUri;
    }
}
export class ChatResponseMultiDiffPart {
    constructor(value, title, readOnly) {
        this.value = value;
        this.title = title;
        this.readOnly = readOnly;
    }
}
export class ChatResponseExternalEditPart {
    constructor(uris, callback) {
        this.uris = uris;
        this.callback = callback;
        this.applied = new Promise((resolve) => {
            this.didGetApplied = resolve;
        });
    }
}
export class ChatResponseAnchorPart {
    constructor(value, title) {
        // eslint-disable-next-line local/code-no-any-casts
        this.value = value;
        this.value2 = value;
        this.title = title;
    }
}
export class ChatResponseProgressPart {
    constructor(value) {
        this.value = value;
    }
}
export class ChatResponseProgressPart2 {
    constructor(value, task) {
        this.value = value;
        this.task = task;
    }
}
export class ChatResponseThinkingProgressPart {
    constructor(value, id, metadata) {
        this.value = value;
        this.id = id;
        this.metadata = metadata;
    }
}
export class ChatResponseWarningPart {
    constructor(value) {
        if (typeof value !== 'string' && value.isTrusted === true) {
            throw new Error('The boolean form of MarkdownString.isTrusted is NOT supported for chat participants.');
        }
        this.value = typeof value === 'string' ? new MarkdownString(value) : value;
    }
}
export class ChatResponseCommandButtonPart {
    constructor(value) {
        this.value = value;
    }
}
export class ChatResponseReferencePart {
    constructor(value, iconPath, options) {
        this.value = value;
        this.iconPath = iconPath;
        this.options = options;
    }
}
export class ChatResponseCodeblockUriPart {
    constructor(value, isEdit) {
        this.value = value;
        this.isEdit = isEdit;
    }
}
export class ChatResponseCodeCitationPart {
    constructor(value, license, snippet) {
        this.value = value;
        this.license = license;
        this.snippet = snippet;
    }
}
export class ChatResponseMovePart {
    constructor(uri, range) {
        this.uri = uri;
        this.range = range;
    }
}
export class ChatResponseExtensionsPart {
    constructor(extensions) {
        this.extensions = extensions;
    }
}
export class ChatResponsePullRequestPart {
    constructor(uri, title, description, author, linkTag) {
        this.uri = uri;
        this.title = title;
        this.description = description;
        this.author = author;
        this.linkTag = linkTag;
    }
    toJSON() {
        return {
            $mid: 26 /* MarshalledId.ChatResponsePullRequestPart */,
            uri: this.uri,
            title: this.title,
            description: this.description,
            author: this.author
        };
    }
}
export class ChatResponseTextEditPart {
    constructor(uri, editsOrDone) {
        this.uri = uri;
        if (editsOrDone === true) {
            this.isDone = true;
            this.edits = [];
        }
        else {
            this.edits = Array.isArray(editsOrDone) ? editsOrDone : [editsOrDone];
        }
    }
}
export class ChatResponseNotebookEditPart {
    constructor(uri, editsOrDone) {
        this.uri = uri;
        if (editsOrDone === true) {
            this.isDone = true;
            this.edits = [];
        }
        else {
            this.edits = Array.isArray(editsOrDone) ? editsOrDone : [editsOrDone];
        }
    }
}
export class ChatPrepareToolInvocationPart {
    /**
     * @param toolName The name of the tool being prepared for invocation.
     */
    constructor(toolName) {
        this.toolName = toolName;
    }
}
export class ChatToolInvocationPart {
    constructor(toolName, toolCallId, isError) {
        this.toolName = toolName;
        this.toolCallId = toolCallId;
        this.isError = isError;
    }
}
export class ChatRequestTurn {
    constructor(prompt, command, references, participant, toolReferences, editedFileEvents) {
        this.prompt = prompt;
        this.command = command;
        this.references = references;
        this.participant = participant;
        this.toolReferences = toolReferences;
        this.editedFileEvents = editedFileEvents;
    }
}
export class ChatResponseTurn {
    constructor(response, result, participant, command) {
        this.response = response;
        this.result = result;
        this.participant = participant;
        this.command = command;
    }
}
export class ChatResponseTurn2 {
    constructor(response, result, participant, command) {
        this.response = response;
        this.result = result;
        this.participant = participant;
        this.command = command;
    }
}
export var ChatLocation;
(function (ChatLocation) {
    ChatLocation[ChatLocation["Panel"] = 1] = "Panel";
    ChatLocation[ChatLocation["Terminal"] = 2] = "Terminal";
    ChatLocation[ChatLocation["Notebook"] = 3] = "Notebook";
    ChatLocation[ChatLocation["Editor"] = 4] = "Editor";
})(ChatLocation || (ChatLocation = {}));
export var ChatSessionStatus;
(function (ChatSessionStatus) {
    ChatSessionStatus[ChatSessionStatus["Failed"] = 0] = "Failed";
    ChatSessionStatus[ChatSessionStatus["Completed"] = 1] = "Completed";
    ChatSessionStatus[ChatSessionStatus["InProgress"] = 2] = "InProgress";
})(ChatSessionStatus || (ChatSessionStatus = {}));
export var ChatResponseReferencePartStatusKind;
(function (ChatResponseReferencePartStatusKind) {
    ChatResponseReferencePartStatusKind[ChatResponseReferencePartStatusKind["Complete"] = 1] = "Complete";
    ChatResponseReferencePartStatusKind[ChatResponseReferencePartStatusKind["Partial"] = 2] = "Partial";
    ChatResponseReferencePartStatusKind[ChatResponseReferencePartStatusKind["Omitted"] = 3] = "Omitted";
})(ChatResponseReferencePartStatusKind || (ChatResponseReferencePartStatusKind = {}));
export var ChatResponseClearToPreviousToolInvocationReason;
(function (ChatResponseClearToPreviousToolInvocationReason) {
    ChatResponseClearToPreviousToolInvocationReason[ChatResponseClearToPreviousToolInvocationReason["NoReason"] = 0] = "NoReason";
    ChatResponseClearToPreviousToolInvocationReason[ChatResponseClearToPreviousToolInvocationReason["FilteredContentRetry"] = 1] = "FilteredContentRetry";
    ChatResponseClearToPreviousToolInvocationReason[ChatResponseClearToPreviousToolInvocationReason["CopyrightContentRetry"] = 2] = "CopyrightContentRetry";
})(ChatResponseClearToPreviousToolInvocationReason || (ChatResponseClearToPreviousToolInvocationReason = {}));
export class ChatRequestEditorData {
    constructor(document, selection, wholeRange) {
        this.document = document;
        this.selection = selection;
        this.wholeRange = wholeRange;
    }
}
export class ChatRequestNotebookData {
    constructor(cell) {
        this.cell = cell;
    }
}
export class ChatReferenceBinaryData {
    constructor(mimeType, data, reference) {
        this.mimeType = mimeType;
        this.data = data;
        this.reference = reference;
    }
}
export class ChatReferenceDiagnostic {
    constructor(diagnostics) {
        this.diagnostics = diagnostics;
    }
}
export var LanguageModelChatMessageRole;
(function (LanguageModelChatMessageRole) {
    LanguageModelChatMessageRole[LanguageModelChatMessageRole["User"] = 1] = "User";
    LanguageModelChatMessageRole[LanguageModelChatMessageRole["Assistant"] = 2] = "Assistant";
    LanguageModelChatMessageRole[LanguageModelChatMessageRole["System"] = 3] = "System";
})(LanguageModelChatMessageRole || (LanguageModelChatMessageRole = {}));
export class LanguageModelToolResultPart {
    constructor(callId, content, isError) {
        this.callId = callId;
        this.content = content;
        this.isError = isError ?? false;
    }
}
export var ChatErrorLevel;
(function (ChatErrorLevel) {
    ChatErrorLevel[ChatErrorLevel["Info"] = 0] = "Info";
    ChatErrorLevel[ChatErrorLevel["Warning"] = 1] = "Warning";
    ChatErrorLevel[ChatErrorLevel["Error"] = 2] = "Error";
})(ChatErrorLevel || (ChatErrorLevel = {}));
export class LanguageModelChatMessage {
    static User(content, name) {
        return new LanguageModelChatMessage(LanguageModelChatMessageRole.User, content, name);
    }
    static Assistant(content, name) {
        return new LanguageModelChatMessage(LanguageModelChatMessageRole.Assistant, content, name);
    }
    set content(value) {
        if (typeof value === 'string') {
            // we changed this and still support setting content with a string property. this keep the API runtime stable
            // despite the breaking change in the type definition.
            this._content = [new LanguageModelTextPart(value)];
        }
        else {
            this._content = value;
        }
    }
    get content() {
        return this._content;
    }
    constructor(role, content, name) {
        this._content = [];
        this.role = role;
        this.content = content;
        this.name = name;
    }
}
export class LanguageModelChatMessage2 {
    static User(content, name) {
        return new LanguageModelChatMessage2(LanguageModelChatMessageRole.User, content, name);
    }
    static Assistant(content, name) {
        return new LanguageModelChatMessage2(LanguageModelChatMessageRole.Assistant, content, name);
    }
    set content(value) {
        if (typeof value === 'string') {
            // we changed this and still support setting content with a string property. this keep the API runtime stable
            // despite the breaking change in the type definition.
            this._content = [new LanguageModelTextPart(value)];
        }
        else {
            this._content = value;
        }
    }
    get content() {
        return this._content;
    }
    // Temp to avoid breaking changes
    set content2(value) {
        if (value) {
            this.content = value.map(part => {
                if (typeof part === 'string') {
                    return new LanguageModelTextPart(part);
                }
                return part;
            });
        }
    }
    get content2() {
        return this.content.map(part => {
            if (part instanceof LanguageModelTextPart) {
                return part.value;
            }
            return part;
        });
    }
    constructor(role, content, name) {
        this._content = [];
        this.role = role;
        this.content = content;
        this.name = name;
    }
}
export class LanguageModelToolCallPart {
    constructor(callId, name, input) {
        this.callId = callId;
        this.name = name;
        this.input = input;
    }
}
export var LanguageModelPartAudience;
(function (LanguageModelPartAudience) {
    LanguageModelPartAudience[LanguageModelPartAudience["Assistant"] = 0] = "Assistant";
    LanguageModelPartAudience[LanguageModelPartAudience["User"] = 1] = "User";
    LanguageModelPartAudience[LanguageModelPartAudience["Extension"] = 2] = "Extension";
})(LanguageModelPartAudience || (LanguageModelPartAudience = {}));
export class LanguageModelTextPart {
    constructor(value, audience) {
        this.value = value;
        audience = audience;
    }
    toJSON() {
        return {
            $mid: 21 /* MarshalledId.LanguageModelTextPart */,
            value: this.value,
            audience: this.audience,
        };
    }
}
export class LanguageModelDataPart {
    constructor(data, mimeType, audience) {
        this.mimeType = mimeType;
        this.data = data;
        this.audience = audience;
    }
    static image(data, mimeType) {
        return new LanguageModelDataPart(data, mimeType);
    }
    static json(value, mime = 'text/x-json') {
        const rawStr = JSON.stringify(value, undefined, '\t');
        return new LanguageModelDataPart(VSBuffer.fromString(rawStr).buffer, mime);
    }
    static text(value, mime = Mimes.text) {
        return new LanguageModelDataPart(VSBuffer.fromString(value).buffer, mime);
    }
    toJSON() {
        return {
            $mid: 24 /* MarshalledId.LanguageModelDataPart */,
            mimeType: this.mimeType,
            data: this.data,
            audience: this.audience
        };
    }
}
export var ChatImageMimeType;
(function (ChatImageMimeType) {
    ChatImageMimeType["PNG"] = "image/png";
    ChatImageMimeType["JPEG"] = "image/jpeg";
    ChatImageMimeType["GIF"] = "image/gif";
    ChatImageMimeType["WEBP"] = "image/webp";
    ChatImageMimeType["BMP"] = "image/bmp";
})(ChatImageMimeType || (ChatImageMimeType = {}));
export class LanguageModelThinkingPart {
    constructor(value, id, metadata) {
        this.value = value;
        this.id = id;
        this.metadata = metadata;
    }
    toJSON() {
        return {
            $mid: 22 /* MarshalledId.LanguageModelThinkingPart */,
            value: this.value,
            id: this.id,
            metadata: this.metadata,
        };
    }
}
export class LanguageModelPromptTsxPart {
    constructor(value) {
        this.value = value;
    }
    toJSON() {
        return {
            $mid: 23 /* MarshalledId.LanguageModelPromptTsxPart */,
            value: this.value,
        };
    }
}
/**
 * @deprecated
 */
export class LanguageModelChatSystemMessage {
    constructor(content) {
        this.content = content;
    }
}
/**
 * @deprecated
 */
export class LanguageModelChatUserMessage {
    constructor(content, name) {
        this.content = content;
        this.name = name;
    }
}
/**
 * @deprecated
 */
export class LanguageModelChatAssistantMessage {
    constructor(content, name) {
        this.content = content;
        this.name = name;
    }
}
export class LanguageModelError extends Error {
    static #name = 'LanguageModelError';
    static NotFound(message) {
        return new LanguageModelError(message, LanguageModelError.NotFound.name);
    }
    static NoPermissions(message) {
        return new LanguageModelError(message, LanguageModelError.NoPermissions.name);
    }
    static Blocked(message) {
        return new LanguageModelError(message, LanguageModelError.Blocked.name);
    }
    static tryDeserialize(data) {
        if (data.name !== LanguageModelError.#name) {
            return undefined;
        }
        return new LanguageModelError(data.message, data.code, data.cause);
    }
    constructor(message, code, cause) {
        super(message, { cause });
        this.name = LanguageModelError.#name;
        this.code = code ?? '';
    }
}
export class LanguageModelToolResult {
    constructor(content) {
        this.content = content;
    }
    toJSON() {
        return {
            $mid: 20 /* MarshalledId.LanguageModelToolResult */,
            content: this.content,
        };
    }
}
export class LanguageModelToolResult2 {
    constructor(content) {
        this.content = content;
    }
    toJSON() {
        return {
            $mid: 20 /* MarshalledId.LanguageModelToolResult */,
            content: this.content,
        };
    }
}
export class ExtendedLanguageModelToolResult extends LanguageModelToolResult {
}
export var LanguageModelChatToolMode;
(function (LanguageModelChatToolMode) {
    LanguageModelChatToolMode[LanguageModelChatToolMode["Auto"] = 1] = "Auto";
    LanguageModelChatToolMode[LanguageModelChatToolMode["Required"] = 2] = "Required";
})(LanguageModelChatToolMode || (LanguageModelChatToolMode = {}));
export class LanguageModelToolExtensionSource {
    constructor(id, label) {
        this.id = id;
        this.label = label;
    }
}
export class LanguageModelToolMCPSource {
    constructor(label, name, instructions) {
        this.label = label;
        this.name = name;
        this.instructions = instructions;
    }
}
//#endregion
//#region ai
export var RelatedInformationType;
(function (RelatedInformationType) {
    RelatedInformationType[RelatedInformationType["SymbolInformation"] = 1] = "SymbolInformation";
    RelatedInformationType[RelatedInformationType["CommandInformation"] = 2] = "CommandInformation";
    RelatedInformationType[RelatedInformationType["SearchInformation"] = 3] = "SearchInformation";
    RelatedInformationType[RelatedInformationType["SettingInformation"] = 4] = "SettingInformation";
})(RelatedInformationType || (RelatedInformationType = {}));
export var SettingsSearchResultKind;
(function (SettingsSearchResultKind) {
    SettingsSearchResultKind[SettingsSearchResultKind["EMBEDDED"] = 1] = "EMBEDDED";
    SettingsSearchResultKind[SettingsSearchResultKind["LLM_RANKED"] = 2] = "LLM_RANKED";
    SettingsSearchResultKind[SettingsSearchResultKind["CANCELED"] = 3] = "CANCELED";
})(SettingsSearchResultKind || (SettingsSearchResultKind = {}));
//#endregion
//#region Speech
export var SpeechToTextStatus;
(function (SpeechToTextStatus) {
    SpeechToTextStatus[SpeechToTextStatus["Started"] = 1] = "Started";
    SpeechToTextStatus[SpeechToTextStatus["Recognizing"] = 2] = "Recognizing";
    SpeechToTextStatus[SpeechToTextStatus["Recognized"] = 3] = "Recognized";
    SpeechToTextStatus[SpeechToTextStatus["Stopped"] = 4] = "Stopped";
    SpeechToTextStatus[SpeechToTextStatus["Error"] = 5] = "Error";
})(SpeechToTextStatus || (SpeechToTextStatus = {}));
export var TextToSpeechStatus;
(function (TextToSpeechStatus) {
    TextToSpeechStatus[TextToSpeechStatus["Started"] = 1] = "Started";
    TextToSpeechStatus[TextToSpeechStatus["Stopped"] = 2] = "Stopped";
    TextToSpeechStatus[TextToSpeechStatus["Error"] = 3] = "Error";
})(TextToSpeechStatus || (TextToSpeechStatus = {}));
export var KeywordRecognitionStatus;
(function (KeywordRecognitionStatus) {
    KeywordRecognitionStatus[KeywordRecognitionStatus["Recognized"] = 1] = "Recognized";
    KeywordRecognitionStatus[KeywordRecognitionStatus["Stopped"] = 2] = "Stopped";
})(KeywordRecognitionStatus || (KeywordRecognitionStatus = {}));
//#endregion
//#region MCP
export var McpToolAvailability;
(function (McpToolAvailability) {
    McpToolAvailability[McpToolAvailability["Initial"] = 0] = "Initial";
    McpToolAvailability[McpToolAvailability["Dynamic"] = 1] = "Dynamic";
})(McpToolAvailability || (McpToolAvailability = {}));
export class McpStdioServerDefinition {
    constructor(label, command, args, env = {}, version, metadata) {
        this.label = label;
        this.command = command;
        this.args = args;
        this.env = env;
        this.version = version;
        this.metadata = metadata;
    }
}
export class McpHttpServerDefinition {
    constructor(label, uri, headers = {}, version, metadata, authentication) {
        this.label = label;
        this.uri = uri;
        this.headers = headers;
        this.version = version;
        this.metadata = metadata;
        this.authentication = authentication;
    }
}
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdFR5cGVzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvY29tbW9uL2V4dEhvc3RUeXBlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7QUFLaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsZUFBZSxFQUFtQixNQUFNLGdDQUFnQyxDQUFDO0FBR2xGLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDakUsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQzVGLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNsRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFFNUQsT0FBTyxFQUFFLG1CQUFtQixFQUF5QixNQUFNLG1EQUFtRCxDQUFDO0FBQy9HLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JILE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBSTlHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUVsRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFbEUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBTWhELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQ04sVUFBVSxF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