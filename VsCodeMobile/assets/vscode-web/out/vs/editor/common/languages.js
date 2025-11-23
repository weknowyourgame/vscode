/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../base/common/codicons.js';
import { URI } from '../../base/common/uri.js';
import { EditOperation } from './core/editOperation.js';
import { Range } from './core/range.js';
import { TokenizationRegistry as TokenizationRegistryImpl } from './tokenizationRegistry.js';
import { localize } from '../../nls.js';
export class Token {
    constructor(offset, type, language) {
        this.offset = offset;
        this.type = type;
        this.language = language;
        this._tokenBrand = undefined;
    }
    toString() {
        return '(' + this.offset + ', ' + this.type + ')';
    }
}
/**
 * @internal
 */
export class TokenizationResult {
    constructor(tokens, endState) {
        this.tokens = tokens;
        this.endState = endState;
        this._tokenizationResultBrand = undefined;
    }
}
/**
 * @internal
 */
export class EncodedTokenizationResult {
    constructor(
    /**
     * The tokens in binary format. Each token occupies two array indices. For token i:
     *  - at offset 2*i => startIndex
     *  - at offset 2*i + 1 => metadata
     *
     */
    tokens, endState) {
        this.tokens = tokens;
        this.endState = endState;
        this._encodedTokenizationResultBrand = undefined;
    }
}
export var HoverVerbosityAction;
(function (HoverVerbosityAction) {
    /**
     * Increase the verbosity of the hover
     */
    HoverVerbosityAction[HoverVerbosityAction["Increase"] = 0] = "Increase";
    /**
     * Decrease the verbosity of the hover
     */
    HoverVerbosityAction[HoverVerbosityAction["Decrease"] = 1] = "Decrease";
})(HoverVerbosityAction || (HoverVerbosityAction = {}));
export var CompletionItemKind;
(function (CompletionItemKind) {
    CompletionItemKind[CompletionItemKind["Method"] = 0] = "Method";
    CompletionItemKind[CompletionItemKind["Function"] = 1] = "Function";
    CompletionItemKind[CompletionItemKind["Constructor"] = 2] = "Constructor";
    CompletionItemKind[CompletionItemKind["Field"] = 3] = "Field";
    CompletionItemKind[CompletionItemKind["Variable"] = 4] = "Variable";
    CompletionItemKind[CompletionItemKind["Class"] = 5] = "Class";
    CompletionItemKind[CompletionItemKind["Struct"] = 6] = "Struct";
    CompletionItemKind[CompletionItemKind["Interface"] = 7] = "Interface";
    CompletionItemKind[CompletionItemKind["Module"] = 8] = "Module";
    CompletionItemKind[CompletionItemKind["Property"] = 9] = "Property";
    CompletionItemKind[CompletionItemKind["Event"] = 10] = "Event";
    CompletionItemKind[CompletionItemKind["Operator"] = 11] = "Operator";
    CompletionItemKind[CompletionItemKind["Unit"] = 12] = "Unit";
    CompletionItemKind[CompletionItemKind["Value"] = 13] = "Value";
    CompletionItemKind[CompletionItemKind["Constant"] = 14] = "Constant";
    CompletionItemKind[CompletionItemKind["Enum"] = 15] = "Enum";
    CompletionItemKind[CompletionItemKind["EnumMember"] = 16] = "EnumMember";
    CompletionItemKind[CompletionItemKind["Keyword"] = 17] = "Keyword";
    CompletionItemKind[CompletionItemKind["Text"] = 18] = "Text";
    CompletionItemKind[CompletionItemKind["Color"] = 19] = "Color";
    CompletionItemKind[CompletionItemKind["File"] = 20] = "File";
    CompletionItemKind[CompletionItemKind["Reference"] = 21] = "Reference";
    CompletionItemKind[CompletionItemKind["Customcolor"] = 22] = "Customcolor";
    CompletionItemKind[CompletionItemKind["Folder"] = 23] = "Folder";
    CompletionItemKind[CompletionItemKind["TypeParameter"] = 24] = "TypeParameter";
    CompletionItemKind[CompletionItemKind["User"] = 25] = "User";
    CompletionItemKind[CompletionItemKind["Issue"] = 26] = "Issue";
    CompletionItemKind[CompletionItemKind["Tool"] = 27] = "Tool";
    CompletionItemKind[CompletionItemKind["Snippet"] = 28] = "Snippet";
})(CompletionItemKind || (CompletionItemKind = {}));
/**
 * @internal
 */
export var CompletionItemKinds;
(function (CompletionItemKinds) {
    const byKind = new Map();
    byKind.set(0 /* CompletionItemKind.Method */, Codicon.symbolMethod);
    byKind.set(1 /* CompletionItemKind.Function */, Codicon.symbolFunction);
    byKind.set(2 /* CompletionItemKind.Constructor */, Codicon.symbolConstructor);
    byKind.set(3 /* CompletionItemKind.Field */, Codicon.symbolField);
    byKind.set(4 /* CompletionItemKind.Variable */, Codicon.symbolVariable);
    byKind.set(5 /* CompletionItemKind.Class */, Codicon.symbolClass);
    byKind.set(6 /* CompletionItemKind.Struct */, Codicon.symbolStruct);
    byKind.set(7 /* CompletionItemKind.Interface */, Codicon.symbolInterface);
    byKind.set(8 /* CompletionItemKind.Module */, Codicon.symbolModule);
    byKind.set(9 /* CompletionItemKind.Property */, Codicon.symbolProperty);
    byKind.set(10 /* CompletionItemKind.Event */, Codicon.symbolEvent);
    byKind.set(11 /* CompletionItemKind.Operator */, Codicon.symbolOperator);
    byKind.set(12 /* CompletionItemKind.Unit */, Codicon.symbolUnit);
    byKind.set(13 /* CompletionItemKind.Value */, Codicon.symbolValue);
    byKind.set(15 /* CompletionItemKind.Enum */, Codicon.symbolEnum);
    byKind.set(14 /* CompletionItemKind.Constant */, Codicon.symbolConstant);
    byKind.set(15 /* CompletionItemKind.Enum */, Codicon.symbolEnum);
    byKind.set(16 /* CompletionItemKind.EnumMember */, Codicon.symbolEnumMember);
    byKind.set(17 /* CompletionItemKind.Keyword */, Codicon.symbolKeyword);
    byKind.set(28 /* CompletionItemKind.Snippet */, Codicon.symbolSnippet);
    byKind.set(18 /* CompletionItemKind.Text */, Codicon.symbolText);
    byKind.set(19 /* CompletionItemKind.Color */, Codicon.symbolColor);
    byKind.set(20 /* CompletionItemKind.File */, Codicon.symbolFile);
    byKind.set(21 /* CompletionItemKind.Reference */, Codicon.symbolReference);
    byKind.set(22 /* CompletionItemKind.Customcolor */, Codicon.symbolCustomColor);
    byKind.set(23 /* CompletionItemKind.Folder */, Codicon.symbolFolder);
    byKind.set(24 /* CompletionItemKind.TypeParameter */, Codicon.symbolTypeParameter);
    byKind.set(25 /* CompletionItemKind.User */, Codicon.account);
    byKind.set(26 /* CompletionItemKind.Issue */, Codicon.issues);
    byKind.set(27 /* CompletionItemKind.Tool */, Codicon.tools);
    /**
     * @internal
     */
    function toIcon(kind) {
        let codicon = byKind.get(kind);
        if (!codicon) {
            console.info('No codicon found for CompletionItemKind ' + kind);
            codicon = Codicon.symbolProperty;
        }
        return codicon;
    }
    CompletionItemKinds.toIcon = toIcon;
    /**
     * @internal
     */
    function toLabel(kind) {
        switch (kind) {
            case 0 /* CompletionItemKind.Method */: return localize('suggestWidget.kind.method', 'Method');
            case 1 /* CompletionItemKind.Function */: return localize('suggestWidget.kind.function', 'Function');
            case 2 /* CompletionItemKind.Constructor */: return localize('suggestWidget.kind.constructor', 'Constructor');
            case 3 /* CompletionItemKind.Field */: return localize('suggestWidget.kind.field', 'Field');
            case 4 /* CompletionItemKind.Variable */: return localize('suggestWidget.kind.variable', 'Variable');
            case 5 /* CompletionItemKind.Class */: return localize('suggestWidget.kind.class', 'Class');
            case 6 /* CompletionItemKind.Struct */: return localize('suggestWidget.kind.struct', 'Struct');
            case 7 /* CompletionItemKind.Interface */: return localize('suggestWidget.kind.interface', 'Interface');
            case 8 /* CompletionItemKind.Module */: return localize('suggestWidget.kind.module', 'Module');
            case 9 /* CompletionItemKind.Property */: return localize('suggestWidget.kind.property', 'Property');
            case 10 /* CompletionItemKind.Event */: return localize('suggestWidget.kind.event', 'Event');
            case 11 /* CompletionItemKind.Operator */: return localize('suggestWidget.kind.operator', 'Operator');
            case 12 /* CompletionItemKind.Unit */: return localize('suggestWidget.kind.unit', 'Unit');
            case 13 /* CompletionItemKind.Value */: return localize('suggestWidget.kind.value', 'Value');
            case 14 /* CompletionItemKind.Constant */: return localize('suggestWidget.kind.constant', 'Constant');
            case 15 /* CompletionItemKind.Enum */: return localize('suggestWidget.kind.enum', 'Enum');
            case 16 /* CompletionItemKind.EnumMember */: return localize('suggestWidget.kind.enumMember', 'Enum Member');
            case 17 /* CompletionItemKind.Keyword */: return localize('suggestWidget.kind.keyword', 'Keyword');
            case 18 /* CompletionItemKind.Text */: return localize('suggestWidget.kind.text', 'Text');
            case 19 /* CompletionItemKind.Color */: return localize('suggestWidget.kind.color', 'Color');
            case 20 /* CompletionItemKind.File */: return localize('suggestWidget.kind.file', 'File');
            case 21 /* CompletionItemKind.Reference */: return localize('suggestWidget.kind.reference', 'Reference');
            case 22 /* CompletionItemKind.Customcolor */: return localize('suggestWidget.kind.customcolor', 'Custom Color');
            case 23 /* CompletionItemKind.Folder */: return localize('suggestWidget.kind.folder', 'Folder');
            case 24 /* CompletionItemKind.TypeParameter */: return localize('suggestWidget.kind.typeParameter', 'Type Parameter');
            case 25 /* CompletionItemKind.User */: return localize('suggestWidget.kind.user', 'User');
            case 26 /* CompletionItemKind.Issue */: return localize('suggestWidget.kind.issue', 'Issue');
            case 27 /* CompletionItemKind.Tool */: return localize('suggestWidget.kind.tool', 'Tool');
            case 28 /* CompletionItemKind.Snippet */: return localize('suggestWidget.kind.snippet', 'Snippet');
            default: return '';
        }
    }
    CompletionItemKinds.toLabel = toLabel;
    const data = new Map();
    data.set('method', 0 /* CompletionItemKind.Method */);
    data.set('function', 1 /* CompletionItemKind.Function */);
    data.set('constructor', 2 /* CompletionItemKind.Constructor */);
    data.set('field', 3 /* CompletionItemKind.Field */);
    data.set('variable', 4 /* CompletionItemKind.Variable */);
    data.set('class', 5 /* CompletionItemKind.Class */);
    data.set('struct', 6 /* CompletionItemKind.Struct */);
    data.set('interface', 7 /* CompletionItemKind.Interface */);
    data.set('module', 8 /* CompletionItemKind.Module */);
    data.set('property', 9 /* CompletionItemKind.Property */);
    data.set('event', 10 /* CompletionItemKind.Event */);
    data.set('operator', 11 /* CompletionItemKind.Operator */);
    data.set('unit', 12 /* CompletionItemKind.Unit */);
    data.set('value', 13 /* CompletionItemKind.Value */);
    data.set('constant', 14 /* CompletionItemKind.Constant */);
    data.set('enum', 15 /* CompletionItemKind.Enum */);
    data.set('enum-member', 16 /* CompletionItemKind.EnumMember */);
    data.set('enumMember', 16 /* CompletionItemKind.EnumMember */);
    data.set('keyword', 17 /* CompletionItemKind.Keyword */);
    data.set('snippet', 28 /* CompletionItemKind.Snippet */);
    data.set('text', 18 /* CompletionItemKind.Text */);
    data.set('color', 19 /* CompletionItemKind.Color */);
    data.set('file', 20 /* CompletionItemKind.File */);
    data.set('reference', 21 /* CompletionItemKind.Reference */);
    data.set('customcolor', 22 /* CompletionItemKind.Customcolor */);
    data.set('folder', 23 /* CompletionItemKind.Folder */);
    data.set('type-parameter', 24 /* CompletionItemKind.TypeParameter */);
    data.set('typeParameter', 24 /* CompletionItemKind.TypeParameter */);
    data.set('account', 25 /* CompletionItemKind.User */);
    data.set('issue', 26 /* CompletionItemKind.Issue */);
    data.set('tool', 27 /* CompletionItemKind.Tool */);
    /**
     * @internal
     */
    function fromString(value, strict) {
        let res = data.get(value);
        if (typeof res === 'undefined' && !strict) {
            res = 9 /* CompletionItemKind.Property */;
        }
        return res;
    }
    CompletionItemKinds.fromString = fromString;
})(CompletionItemKinds || (CompletionItemKinds = {}));
export var CompletionItemTag;
(function (CompletionItemTag) {
    CompletionItemTag[CompletionItemTag["Deprecated"] = 1] = "Deprecated";
})(CompletionItemTag || (CompletionItemTag = {}));
export var CompletionItemInsertTextRule;
(function (CompletionItemInsertTextRule) {
    CompletionItemInsertTextRule[CompletionItemInsertTextRule["None"] = 0] = "None";
    /**
     * Adjust whitespace/indentation of multiline insert texts to
     * match the current line indentation.
     */
    CompletionItemInsertTextRule[CompletionItemInsertTextRule["KeepWhitespace"] = 1] = "KeepWhitespace";
    /**
     * `insertText` is a snippet.
     */
    CompletionItemInsertTextRule[CompletionItemInsertTextRule["InsertAsSnippet"] = 4] = "InsertAsSnippet";
})(CompletionItemInsertTextRule || (CompletionItemInsertTextRule = {}));
/**
 * How a partial acceptance was triggered.
 */
export var PartialAcceptTriggerKind;
(function (PartialAcceptTriggerKind) {
    PartialAcceptTriggerKind[PartialAcceptTriggerKind["Word"] = 0] = "Word";
    PartialAcceptTriggerKind[PartialAcceptTriggerKind["Line"] = 1] = "Line";
    PartialAcceptTriggerKind[PartialAcceptTriggerKind["Suggest"] = 2] = "Suggest";
})(PartialAcceptTriggerKind || (PartialAcceptTriggerKind = {}));
/**
 * How a suggest provider was triggered.
 */
export var CompletionTriggerKind;
(function (CompletionTriggerKind) {
    CompletionTriggerKind[CompletionTriggerKind["Invoke"] = 0] = "Invoke";
    CompletionTriggerKind[CompletionTriggerKind["TriggerCharacter"] = 1] = "TriggerCharacter";
    CompletionTriggerKind[CompletionTriggerKind["TriggerForIncompleteCompletions"] = 2] = "TriggerForIncompleteCompletions";
})(CompletionTriggerKind || (CompletionTriggerKind = {}));
/**
 * How an {@link InlineCompletionsProvider inline completion provider} was triggered.
 */
export var InlineCompletionTriggerKind;
(function (InlineCompletionTriggerKind) {
    /**
     * Completion was triggered automatically while editing.
     * It is sufficient to return a single completion item in this case.
     */
    InlineCompletionTriggerKind[InlineCompletionTriggerKind["Automatic"] = 0] = "Automatic";
    /**
     * Completion was triggered explicitly by a user gesture.
     * Return multiple completion items to enable cycling through them.
     */
    InlineCompletionTriggerKind[InlineCompletionTriggerKind["Explicit"] = 1] = "Explicit";
})(InlineCompletionTriggerKind || (InlineCompletionTriggerKind = {}));
export class SelectedSuggestionInfo {
    constructor(range, text, completionKind, isSnippetText) {
        this.range = range;
        this.text = text;
        this.completionKind = completionKind;
        this.isSnippetText = isSnippetText;
    }
    equals(other) {
        return Range.lift(this.range).equalsRange(other.range)
            && this.text === other.text
            && this.completionKind === other.completionKind
            && this.isSnippetText === other.isSnippetText;
    }
}
export var InlineCompletionHintStyle;
(function (InlineCompletionHintStyle) {
    InlineCompletionHintStyle[InlineCompletionHintStyle["Code"] = 1] = "Code";
    InlineCompletionHintStyle[InlineCompletionHintStyle["Label"] = 2] = "Label";
})(InlineCompletionHintStyle || (InlineCompletionHintStyle = {}));
/** @internal */
export class ProviderId {
    static fromExtensionId(extensionId) {
        return new ProviderId(extensionId, undefined, undefined);
    }
    constructor(extensionId, extensionVersion, providerId) {
        this.extensionId = extensionId;
        this.extensionVersion = extensionVersion;
        this.providerId = providerId;
    }
    toString() {
        let result = '';
        if (this.extensionId) {
            result += this.extensionId;
        }
        if (this.extensionVersion) {
            result += `@${this.extensionVersion}`;
        }
        if (this.providerId) {
            result += `:${this.providerId}`;
        }
        if (result.length === 0) {
            result = 'unknown';
        }
        return result;
    }
    toStringWithoutVersion() {
        let result = '';
        if (this.extensionId) {
            result += this.extensionId;
        }
        if (this.providerId) {
            result += `:${this.providerId}`;
        }
        return result;
    }
}
/** @internal */
export class VersionedExtensionId {
    static tryCreate(extensionId, version) {
        if (!extensionId || !version) {
            return undefined;
        }
        return new VersionedExtensionId(extensionId, version);
    }
    constructor(extensionId, version) {
        this.extensionId = extensionId;
        this.version = version;
    }
    toString() {
        return `${this.extensionId}@${this.version}`;
    }
}
export var InlineCompletionEndOfLifeReasonKind;
(function (InlineCompletionEndOfLifeReasonKind) {
    InlineCompletionEndOfLifeReasonKind[InlineCompletionEndOfLifeReasonKind["Accepted"] = 0] = "Accepted";
    InlineCompletionEndOfLifeReasonKind[InlineCompletionEndOfLifeReasonKind["Rejected"] = 1] = "Rejected";
    InlineCompletionEndOfLifeReasonKind[InlineCompletionEndOfLifeReasonKind["Ignored"] = 2] = "Ignored";
})(InlineCompletionEndOfLifeReasonKind || (InlineCompletionEndOfLifeReasonKind = {}));
export var CodeActionTriggerType;
(function (CodeActionTriggerType) {
    CodeActionTriggerType[CodeActionTriggerType["Invoke"] = 1] = "Invoke";
    CodeActionTriggerType[CodeActionTriggerType["Auto"] = 2] = "Auto";
})(CodeActionTriggerType || (CodeActionTriggerType = {}));
/**
 * @internal
 */
export var DocumentPasteTriggerKind;
(function (DocumentPasteTriggerKind) {
    DocumentPasteTriggerKind[DocumentPasteTriggerKind["Automatic"] = 0] = "Automatic";
    DocumentPasteTriggerKind[DocumentPasteTriggerKind["PasteAs"] = 1] = "PasteAs";
})(DocumentPasteTriggerKind || (DocumentPasteTriggerKind = {}));
export var SignatureHelpTriggerKind;
(function (SignatureHelpTriggerKind) {
    SignatureHelpTriggerKind[SignatureHelpTriggerKind["Invoke"] = 1] = "Invoke";
    SignatureHelpTriggerKind[SignatureHelpTriggerKind["TriggerCharacter"] = 2] = "TriggerCharacter";
    SignatureHelpTriggerKind[SignatureHelpTriggerKind["ContentChange"] = 3] = "ContentChange";
})(SignatureHelpTriggerKind || (SignatureHelpTriggerKind = {}));
/**
 * A document highlight kind.
 */
export var DocumentHighlightKind;
(function (DocumentHighlightKind) {
    /**
     * A textual occurrence.
     */
    DocumentHighlightKind[DocumentHighlightKind["Text"] = 0] = "Text";
    /**
     * Read-access of a symbol, like reading a variable.
     */
    DocumentHighlightKind[DocumentHighlightKind["Read"] = 1] = "Read";
    /**
     * Write-access of a symbol, like writing to a variable.
     */
    DocumentHighlightKind[DocumentHighlightKind["Write"] = 2] = "Write";
})(DocumentHighlightKind || (DocumentHighlightKind = {}));
/**
 * @internal
 */
export function isLocationLink(thing) {
    return !!thing
        && URI.isUri(thing.uri)
        && Range.isIRange(thing.range)
        && (Range.isIRange(thing.originSelectionRange) || Range.isIRange(thing.targetSelectionRange));
}
/**
 * @internal
 */
export function isLocation(thing) {
    return !!thing
        && URI.isUri(thing.uri)
        && Range.isIRange(thing.range);
}
/**
 * A symbol kind.
 */
export var SymbolKind;
(function (SymbolKind) {
    SymbolKind[SymbolKind["File"] = 0] = "File";
    SymbolKind[SymbolKind["Module"] = 1] = "Module";
    SymbolKind[SymbolKind["Namespace"] = 2] = "Namespace";
    SymbolKind[SymbolKind["Package"] = 3] = "Package";
    SymbolKind[SymbolKind["Class"] = 4] = "Class";
    SymbolKind[SymbolKind["Method"] = 5] = "Method";
    SymbolKind[SymbolKind["Property"] = 6] = "Property";
    SymbolKind[SymbolKind["Field"] = 7] = "Field";
    SymbolKind[SymbolKind["Constructor"] = 8] = "Constructor";
    SymbolKind[SymbolKind["Enum"] = 9] = "Enum";
    SymbolKind[SymbolKind["Interface"] = 10] = "Interface";
    SymbolKind[SymbolKind["Function"] = 11] = "Function";
    SymbolKind[SymbolKind["Variable"] = 12] = "Variable";
    SymbolKind[SymbolKind["Constant"] = 13] = "Constant";
    SymbolKind[SymbolKind["String"] = 14] = "String";
    SymbolKind[SymbolKind["Number"] = 15] = "Number";
    SymbolKind[SymbolKind["Boolean"] = 16] = "Boolean";
    SymbolKind[SymbolKind["Array"] = 17] = "Array";
    SymbolKind[SymbolKind["Object"] = 18] = "Object";
    SymbolKind[SymbolKind["Key"] = 19] = "Key";
    SymbolKind[SymbolKind["Null"] = 20] = "Null";
    SymbolKind[SymbolKind["EnumMember"] = 21] = "EnumMember";
    SymbolKind[SymbolKind["Struct"] = 22] = "Struct";
    SymbolKind[SymbolKind["Event"] = 23] = "Event";
    SymbolKind[SymbolKind["Operator"] = 24] = "Operator";
    SymbolKind[SymbolKind["TypeParameter"] = 25] = "TypeParameter";
})(SymbolKind || (SymbolKind = {}));
/**
 * @internal
 */
export const symbolKindNames = {
    [17 /* SymbolKind.Array */]: localize('Array', "array"),
    [16 /* SymbolKind.Boolean */]: localize('Boolean', "boolean"),
    [4 /* SymbolKind.Class */]: localize('Class', "class"),
    [13 /* SymbolKind.Constant */]: localize('Constant', "constant"),
    [8 /* SymbolKind.Constructor */]: localize('Constructor', "constructor"),
    [9 /* SymbolKind.Enum */]: localize('Enum', "enumeration"),
    [21 /* SymbolKind.EnumMember */]: localize('EnumMember', "enumeration member"),
    [23 /* SymbolKind.Event */]: localize('Event', "event"),
    [7 /* SymbolKind.Field */]: localize('Field', "field"),
    [0 /* SymbolKind.File */]: localize('File', "file"),
    [11 /* SymbolKind.Function */]: localize('Function', "function"),
    [10 /* SymbolKind.Interface */]: localize('Interface', "interface"),
    [19 /* SymbolKind.Key */]: localize('Key', "key"),
    [5 /* SymbolKind.Method */]: localize('Method', "method"),
    [1 /* SymbolKind.Module */]: localize('Module', "module"),
    [2 /* SymbolKind.Namespace */]: localize('Namespace', "namespace"),
    [20 /* SymbolKind.Null */]: localize('Null', "null"),
    [15 /* SymbolKind.Number */]: localize('Number', "number"),
    [18 /* SymbolKind.Object */]: localize('Object', "object"),
    [24 /* SymbolKind.Operator */]: localize('Operator', "operator"),
    [3 /* SymbolKind.Package */]: localize('Package', "package"),
    [6 /* SymbolKind.Property */]: localize('Property', "property"),
    [14 /* SymbolKind.String */]: localize('String', "string"),
    [22 /* SymbolKind.Struct */]: localize('Struct', "struct"),
    [25 /* SymbolKind.TypeParameter */]: localize('TypeParameter', "type parameter"),
    [12 /* SymbolKind.Variable */]: localize('Variable', "variable"),
};
/**
 * @internal
 */
export function getAriaLabelForSymbol(symbolName, kind) {
    return localize('symbolAriaLabel', '{0} ({1})', symbolName, symbolKindNames[kind]);
}
export var SymbolTag;
(function (SymbolTag) {
    SymbolTag[SymbolTag["Deprecated"] = 1] = "Deprecated";
})(SymbolTag || (SymbolTag = {}));
/**
 * @internal
 */
export var SymbolKinds;
(function (SymbolKinds) {
    const byKind = new Map();
    byKind.set(0 /* SymbolKind.File */, Codicon.symbolFile);
    byKind.set(1 /* SymbolKind.Module */, Codicon.symbolModule);
    byKind.set(2 /* SymbolKind.Namespace */, Codicon.symbolNamespace);
    byKind.set(3 /* SymbolKind.Package */, Codicon.symbolPackage);
    byKind.set(4 /* SymbolKind.Class */, Codicon.symbolClass);
    byKind.set(5 /* SymbolKind.Method */, Codicon.symbolMethod);
    byKind.set(6 /* SymbolKind.Property */, Codicon.symbolProperty);
    byKind.set(7 /* SymbolKind.Field */, Codicon.symbolField);
    byKind.set(8 /* SymbolKind.Constructor */, Codicon.symbolConstructor);
    byKind.set(9 /* SymbolKind.Enum */, Codicon.symbolEnum);
    byKind.set(10 /* SymbolKind.Interface */, Codicon.symbolInterface);
    byKind.set(11 /* SymbolKind.Function */, Codicon.symbolFunction);
    byKind.set(12 /* SymbolKind.Variable */, Codicon.symbolVariable);
    byKind.set(13 /* SymbolKind.Constant */, Codicon.symbolConstant);
    byKind.set(14 /* SymbolKind.String */, Codicon.symbolString);
    byKind.set(15 /* SymbolKind.Number */, Codicon.symbolNumber);
    byKind.set(16 /* SymbolKind.Boolean */, Codicon.symbolBoolean);
    byKind.set(17 /* SymbolKind.Array */, Codicon.symbolArray);
    byKind.set(18 /* SymbolKind.Object */, Codicon.symbolObject);
    byKind.set(19 /* SymbolKind.Key */, Codicon.symbolKey);
    byKind.set(20 /* SymbolKind.Null */, Codicon.symbolNull);
    byKind.set(21 /* SymbolKind.EnumMember */, Codicon.symbolEnumMember);
    byKind.set(22 /* SymbolKind.Struct */, Codicon.symbolStruct);
    byKind.set(23 /* SymbolKind.Event */, Codicon.symbolEvent);
    byKind.set(24 /* SymbolKind.Operator */, Codicon.symbolOperator);
    byKind.set(25 /* SymbolKind.TypeParameter */, Codicon.symbolTypeParameter);
    /**
     * @internal
     */
    function toIcon(kind) {
        let icon = byKind.get(kind);
        if (!icon) {
            console.info('No codicon found for SymbolKind ' + kind);
            icon = Codicon.symbolProperty;
        }
        return icon;
    }
    SymbolKinds.toIcon = toIcon;
    const byCompletionKind = new Map();
    byCompletionKind.set(0 /* SymbolKind.File */, 20 /* CompletionItemKind.File */);
    byCompletionKind.set(1 /* SymbolKind.Module */, 8 /* CompletionItemKind.Module */);
    byCompletionKind.set(2 /* SymbolKind.Namespace */, 8 /* CompletionItemKind.Module */);
    byCompletionKind.set(3 /* SymbolKind.Package */, 8 /* CompletionItemKind.Module */);
    byCompletionKind.set(4 /* SymbolKind.Class */, 5 /* CompletionItemKind.Class */);
    byCompletionKind.set(5 /* SymbolKind.Method */, 0 /* CompletionItemKind.Method */);
    byCompletionKind.set(6 /* SymbolKind.Property */, 9 /* CompletionItemKind.Property */);
    byCompletionKind.set(7 /* SymbolKind.Field */, 3 /* CompletionItemKind.Field */);
    byCompletionKind.set(8 /* SymbolKind.Constructor */, 2 /* CompletionItemKind.Constructor */);
    byCompletionKind.set(9 /* SymbolKind.Enum */, 15 /* CompletionItemKind.Enum */);
    byCompletionKind.set(10 /* SymbolKind.Interface */, 7 /* CompletionItemKind.Interface */);
    byCompletionKind.set(11 /* SymbolKind.Function */, 1 /* CompletionItemKind.Function */);
    byCompletionKind.set(12 /* SymbolKind.Variable */, 4 /* CompletionItemKind.Variable */);
    byCompletionKind.set(13 /* SymbolKind.Constant */, 14 /* CompletionItemKind.Constant */);
    byCompletionKind.set(14 /* SymbolKind.String */, 18 /* CompletionItemKind.Text */);
    byCompletionKind.set(15 /* SymbolKind.Number */, 13 /* CompletionItemKind.Value */);
    byCompletionKind.set(16 /* SymbolKind.Boolean */, 13 /* CompletionItemKind.Value */);
    byCompletionKind.set(17 /* SymbolKind.Array */, 13 /* CompletionItemKind.Value */);
    byCompletionKind.set(18 /* SymbolKind.Object */, 13 /* CompletionItemKind.Value */);
    byCompletionKind.set(19 /* SymbolKind.Key */, 17 /* CompletionItemKind.Keyword */);
    byCompletionKind.set(20 /* SymbolKind.Null */, 13 /* CompletionItemKind.Value */);
    byCompletionKind.set(21 /* SymbolKind.EnumMember */, 16 /* CompletionItemKind.EnumMember */);
    byCompletionKind.set(22 /* SymbolKind.Struct */, 6 /* CompletionItemKind.Struct */);
    byCompletionKind.set(23 /* SymbolKind.Event */, 10 /* CompletionItemKind.Event */);
    byCompletionKind.set(24 /* SymbolKind.Operator */, 11 /* CompletionItemKind.Operator */);
    byCompletionKind.set(25 /* SymbolKind.TypeParameter */, 24 /* CompletionItemKind.TypeParameter */);
    /**
     * @internal
     */
    function toCompletionKind(kind) {
        let completionKind = byCompletionKind.get(kind);
        if (completionKind === undefined) {
            console.info('No completion kind found for SymbolKind ' + kind);
            completionKind = 20 /* CompletionItemKind.File */;
        }
        return completionKind;
    }
    SymbolKinds.toCompletionKind = toCompletionKind;
})(SymbolKinds || (SymbolKinds = {}));
/** @internal */
export class TextEdit {
    static asEditOperation(edit) {
        const range = Range.lift(edit.range);
        return range.isEmpty()
            ? EditOperation.insert(range.getStartPosition(), edit.text) // moves marker
            : EditOperation.replace(range, edit.text);
    }
    static isTextEdit(thing) {
        const possibleTextEdit = thing;
        return typeof possibleTextEdit.text === 'string' && Range.isIRange(possibleTextEdit.range);
    }
}
export class FoldingRangeKind {
    /**
     * Kind for folding range representing a comment. The value of the kind is 'comment'.
     */
    static { this.Comment = new FoldingRangeKind('comment'); }
    /**
     * Kind for folding range representing a import. The value of the kind is 'imports'.
     */
    static { this.Imports = new FoldingRangeKind('imports'); }
    /**
     * Kind for folding range representing regions (for example marked by `#region`, `#endregion`).
     * The value of the kind is 'region'.
     */
    static { this.Region = new FoldingRangeKind('region'); }
    /**
     * Returns a {@link FoldingRangeKind} for the given value.
     *
     * @param value of the kind.
     */
    static fromValue(value) {
        switch (value) {
            case 'comment': return FoldingRangeKind.Comment;
            case 'imports': return FoldingRangeKind.Imports;
            case 'region': return FoldingRangeKind.Region;
        }
        return new FoldingRangeKind(value);
    }
    /**
     * Creates a new {@link FoldingRangeKind}.
     *
     * @param value of the kind.
     */
    constructor(value) {
        this.value = value;
    }
}
export var NewSymbolNameTag;
(function (NewSymbolNameTag) {
    NewSymbolNameTag[NewSymbolNameTag["AIGenerated"] = 1] = "AIGenerated";
})(NewSymbolNameTag || (NewSymbolNameTag = {}));
export var NewSymbolNameTriggerKind;
(function (NewSymbolNameTriggerKind) {
    NewSymbolNameTriggerKind[NewSymbolNameTriggerKind["Invoke"] = 0] = "Invoke";
    NewSymbolNameTriggerKind[NewSymbolNameTriggerKind["Automatic"] = 1] = "Automatic";
})(NewSymbolNameTriggerKind || (NewSymbolNameTriggerKind = {}));
/**
 * @internal
 */
export var Command;
(function (Command) {
    /**
     * @internal
     */
    function is(obj) {
        if (!obj || typeof obj !== 'object') {
            return false;
        }
        return typeof obj.id === 'string' &&
            typeof obj.title === 'string';
    }
    Command.is = is;
})(Command || (Command = {}));
/**
 * @internal
 */
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
/**
 * @internal
 */
export var CommentThreadState;
(function (CommentThreadState) {
    CommentThreadState[CommentThreadState["Unresolved"] = 0] = "Unresolved";
    CommentThreadState[CommentThreadState["Resolved"] = 1] = "Resolved";
})(CommentThreadState || (CommentThreadState = {}));
/**
 * @internal
 */
export var CommentThreadApplicability;
(function (CommentThreadApplicability) {
    CommentThreadApplicability[CommentThreadApplicability["Current"] = 0] = "Current";
    CommentThreadApplicability[CommentThreadApplicability["Outdated"] = 1] = "Outdated";
})(CommentThreadApplicability || (CommentThreadApplicability = {}));
/**
 * @internal
 */
export var CommentMode;
(function (CommentMode) {
    CommentMode[CommentMode["Editing"] = 0] = "Editing";
    CommentMode[CommentMode["Preview"] = 1] = "Preview";
})(CommentMode || (CommentMode = {}));
/**
 * @internal
 */
export var CommentState;
(function (CommentState) {
    CommentState[CommentState["Published"] = 0] = "Published";
    CommentState[CommentState["Draft"] = 1] = "Draft";
})(CommentState || (CommentState = {}));
export var InlayHintKind;
(function (InlayHintKind) {
    InlayHintKind[InlayHintKind["Type"] = 1] = "Type";
    InlayHintKind[InlayHintKind["Parameter"] = 2] = "Parameter";
})(InlayHintKind || (InlayHintKind = {}));
/**
 * @internal
 */
export class LazyTokenizationSupport {
    constructor(createSupport) {
        this.createSupport = createSupport;
        this._tokenizationSupport = null;
    }
    dispose() {
        if (this._tokenizationSupport) {
            this._tokenizationSupport.then((support) => {
                if (support) {
                    support.dispose();
                }
            });
        }
    }
    get tokenizationSupport() {
        if (!this._tokenizationSupport) {
            this._tokenizationSupport = this.createSupport();
        }
        return this._tokenizationSupport;
    }
}
/**
 * @internal
 */
export const TokenizationRegistry = new TokenizationRegistryImpl();
/**
 * @internal
 */
export var ExternalUriOpenerPriority;
(function (ExternalUriOpenerPriority) {
    ExternalUriOpenerPriority[ExternalUriOpenerPriority["None"] = 0] = "None";
    ExternalUriOpenerPriority[ExternalUriOpenerPriority["Option"] = 1] = "Option";
    ExternalUriOpenerPriority[ExternalUriOpenerPriority["Default"] = 2] = "Default";
    ExternalUriOpenerPriority[ExternalUriOpenerPriority["Preferred"] = 3] = "Preferred";
})(ExternalUriOpenerPriority || (ExternalUriOpenerPriority = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFuZ3VhZ2VzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBSWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQVF4RCxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLDBCQUEwQixDQUFDO0FBQzlELE9BQU8sRUFBRSxhQUFhLEVBQXdCLE1BQU0seUJBQXlCLENBQUM7QUFFOUUsT0FBTyxFQUFVLEtBQUssRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBS2hELE9BQU8sRUFBRSxvQkFBb0IsSUFBSSx3QkFBd0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBRTdGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFheEMsTUFBTSxPQUFPLEtBQUs7SUFHakIsWUFDaUIsTUFBYyxFQUNkLElBQVksRUFDWixRQUFnQjtRQUZoQixXQUFNLEdBQU4sTUFBTSxDQUFRO1FBQ2QsU0FBSSxHQUFKLElBQUksQ0FBUTtRQUNaLGFBQVEsR0FBUixRQUFRLENBQVE7UUFMakMsZ0JBQVcsR0FBUyxTQUFTLENBQUM7SUFPOUIsQ0FBQztJQUVNLFFBQVE7UUFDZCxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQztJQUNuRCxDQUFDO0NBQ0Q7QUFFRDs7R0FFRztBQUNILE1BQU0sT0FBTyxrQkFBa0I7SUFHOUIsWUFDaUIsTUFBZSxFQUNmLFFBQWdCO1FBRGhCLFdBQU0sR0FBTixNQUFNLENBQVM7UUFDZixhQUFRLEdBQVIsUUFBUSxDQUFRO1FBSmpDLDZCQUF3QixHQUFTLFNBQVMsQ0FBQztJQU0zQyxDQUFDO0NBQ0Q7QUFFRDs7R0FFRztBQUNILE1BQU0sT0FBTyx5QkFB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