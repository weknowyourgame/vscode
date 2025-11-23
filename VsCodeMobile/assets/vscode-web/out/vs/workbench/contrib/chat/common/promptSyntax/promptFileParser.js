/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Iterable } from '../../../../../base/common/iterator.js';
import { dirname, joinPath } from '../../../../../base/common/resources.js';
import { splitLinesIncludeSeparators } from '../../../../../base/common/strings.js';
import { URI } from '../../../../../base/common/uri.js';
import { parse } from '../../../../../base/common/yaml.js';
import { Range } from '../../../../../editor/common/core/range.js';
export class PromptFileParser {
    constructor() {
    }
    parse(uri, content) {
        const linesWithEOL = splitLinesIncludeSeparators(content);
        if (linesWithEOL.length === 0) {
            return new ParsedPromptFile(uri, undefined, undefined);
        }
        let header = undefined;
        let body = undefined;
        let bodyStartLine = 0;
        if (linesWithEOL[0].match(/^---[\s\r\n]*$/)) {
            let headerEndLine = linesWithEOL.findIndex((line, index) => index > 0 && line.match(/^---[\s\r\n]*$/));
            if (headerEndLine === -1) {
                headerEndLine = linesWithEOL.length;
                bodyStartLine = linesWithEOL.length;
            }
            else {
                bodyStartLine = headerEndLine + 1;
            }
            // range starts on the line after the ---, and ends at the beginning of the line that has the closing ---
            const range = new Range(2, 1, headerEndLine + 1, 1);
            header = new PromptHeader(range, linesWithEOL);
        }
        if (bodyStartLine < linesWithEOL.length) {
            // range starts  on the line after the ---, and ends at the beginning of line after the last line
            const range = new Range(bodyStartLine + 1, 1, linesWithEOL.length + 1, 1);
            body = new PromptBody(range, linesWithEOL, uri);
        }
        return new ParsedPromptFile(uri, header, body);
    }
}
export class ParsedPromptFile {
    constructor(uri, header, body) {
        this.uri = uri;
        this.header = header;
        this.body = body;
    }
}
export var PromptHeaderAttributes;
(function (PromptHeaderAttributes) {
    PromptHeaderAttributes.name = 'name';
    PromptHeaderAttributes.description = 'description';
    PromptHeaderAttributes.agent = 'agent';
    PromptHeaderAttributes.mode = 'mode';
    PromptHeaderAttributes.model = 'model';
    PromptHeaderAttributes.applyTo = 'applyTo';
    PromptHeaderAttributes.tools = 'tools';
    PromptHeaderAttributes.handOffs = 'handoffs';
    PromptHeaderAttributes.advancedOptions = 'advancedOptions';
    PromptHeaderAttributes.argumentHint = 'argument-hint';
    PromptHeaderAttributes.excludeAgent = 'excludeAgent';
    PromptHeaderAttributes.target = 'target';
})(PromptHeaderAttributes || (PromptHeaderAttributes = {}));
export var GithubPromptHeaderAttributes;
(function (GithubPromptHeaderAttributes) {
    GithubPromptHeaderAttributes.mcpServers = 'mcp-servers';
})(GithubPromptHeaderAttributes || (GithubPromptHeaderAttributes = {}));
export var Target;
(function (Target) {
    Target["VSCode"] = "vscode";
    Target["GitHubCopilot"] = "github-copilot";
})(Target || (Target = {}));
export class PromptHeader {
    constructor(range, linesWithEOL) {
        this.range = range;
        this.linesWithEOL = linesWithEOL;
    }
    get _parsedHeader() {
        if (this._parsed === undefined) {
            const yamlErrors = [];
            const lines = this.linesWithEOL.slice(this.range.startLineNumber - 1, this.range.endLineNumber - 1).join('');
            const node = parse(lines, yamlErrors);
            const attributes = [];
            const errors = yamlErrors.map(err => ({ message: err.message, range: this.asRange(err), code: err.code }));
            if (node) {
                if (node.type !== 'object') {
                    errors.push({ message: 'Invalid header, expecting <key: value> pairs', range: this.range, code: 'INVALID_YAML' });
                }
                else {
                    for (const property of node.properties) {
                        attributes.push({
                            key: property.key.value,
                            range: this.asRange({ start: property.key.start, end: property.value.end }),
                            value: this.asValue(property.value)
                        });
                    }
                }
            }
            this._parsed = { node, attributes, errors };
        }
        return this._parsed;
    }
    asRange({ start, end }) {
        return new Range(this.range.startLineNumber + start.line, start.character + 1, this.range.startLineNumber + end.line, end.character + 1);
    }
    asValue(node) {
        switch (node.type) {
            case 'string':
                return { type: 'string', value: node.value, range: this.asRange(node) };
            case 'number':
                return { type: 'number', value: node.value, range: this.asRange(node) };
            case 'boolean':
                return { type: 'boolean', value: node.value, range: this.asRange(node) };
            case 'null':
                return { type: 'null', value: node.value, range: this.asRange(node) };
            case 'array':
                return { type: 'array', items: node.items.map(item => this.asValue(item)), range: this.asRange(node) };
            case 'object': {
                const properties = node.properties.map(property => ({ key: this.asValue(property.key), value: this.asValue(property.value) }));
                return { type: 'object', properties, range: this.asRange(node) };
            }
        }
    }
    get attributes() {
        return this._parsedHeader.attributes;
    }
    getAttribute(key) {
        return this._parsedHeader.attributes.find(attr => attr.key === key);
    }
    get errors() {
        return this._parsedHeader.errors;
    }
    getStringAttribute(key) {
        const attribute = this._parsedHeader.attributes.find(attr => attr.key === key);
        if (attribute?.value.type === 'string') {
            return attribute.value.value;
        }
        return undefined;
    }
    get name() {
        return this.getStringAttribute(PromptHeaderAttributes.name);
    }
    get description() {
        return this.getStringAttribute(PromptHeaderAttributes.description);
    }
    get agent() {
        return this.getStringAttribute(PromptHeaderAttributes.agent) ?? this.getStringAttribute(PromptHeaderAttributes.mode);
    }
    get model() {
        return this.getStringAttribute(PromptHeaderAttributes.model);
    }
    get applyTo() {
        return this.getStringAttribute(PromptHeaderAttributes.applyTo);
    }
    get argumentHint() {
        return this.getStringAttribute(PromptHeaderAttributes.argumentHint);
    }
    get target() {
        return this.getStringAttribute(PromptHeaderAttributes.target);
    }
    get tools() {
        const toolsAttribute = this._parsedHeader.attributes.find(attr => attr.key === PromptHeaderAttributes.tools);
        if (!toolsAttribute) {
            return undefined;
        }
        if (toolsAttribute.value.type === 'array') {
            const tools = [];
            for (const item of toolsAttribute.value.items) {
                if (item.type === 'string' && item.value) {
                    tools.push(item.value);
                }
            }
            return tools;
        }
        else if (toolsAttribute.value.type === 'object') {
            const tools = [];
            const collectLeafs = ({ key, value }) => {
                if (value.type === 'boolean') {
                    tools.push(key.value);
                }
                else if (value.type === 'object') {
                    value.properties.forEach(collectLeafs);
                }
            };
            toolsAttribute.value.properties.forEach(collectLeafs);
            return tools;
        }
        return undefined;
    }
    get handOffs() {
        const handoffsAttribute = this._parsedHeader.attributes.find(attr => attr.key === PromptHeaderAttributes.handOffs);
        if (!handoffsAttribute) {
            return undefined;
        }
        if (handoffsAttribute.value.type === 'array') {
            // Array format: list of objects: { agent, label, prompt, send?, showContinueOn? }
            const handoffs = [];
            for (const item of handoffsAttribute.value.items) {
                if (item.type === 'object') {
                    let agent;
                    let label;
                    let prompt;
                    let send;
                    let showContinueOn;
                    for (const prop of item.properties) {
                        if (prop.key.value === 'agent' && prop.value.type === 'string') {
                            agent = prop.value.value;
                        }
                        else if (prop.key.value === 'label' && prop.value.type === 'string') {
                            label = prop.value.value;
                        }
                        else if (prop.key.value === 'prompt' && prop.value.type === 'string') {
                            prompt = prop.value.value;
                        }
                        else if (prop.key.value === 'send' && prop.value.type === 'boolean') {
                            send = prop.value.value;
                        }
                        else if (prop.key.value === 'showContinueOn' && prop.value.type === 'boolean') {
                            showContinueOn = prop.value.value;
                        }
                    }
                    if (agent && label && prompt !== undefined) {
                        const handoff = {
                            agent,
                            label,
                            prompt,
                            ...(send !== undefined ? { send } : {}),
                            ...(showContinueOn !== undefined ? { showContinueOn } : {})
                        };
                        handoffs.push(handoff);
                    }
                }
            }
            return handoffs;
        }
        return undefined;
    }
}
export class PromptBody {
    constructor(range, linesWithEOL, uri) {
        this.range = range;
        this.linesWithEOL = linesWithEOL;
        this.uri = uri;
    }
    get fileReferences() {
        return this.getParsedBody().fileReferences;
    }
    get variableReferences() {
        return this.getParsedBody().variableReferences;
    }
    get offset() {
        return this.getParsedBody().bodyOffset;
    }
    getParsedBody() {
        if (this._parsed === undefined) {
            const markdownLinkRanges = [];
            const fileReferences = [];
            const variableReferences = [];
            const bodyOffset = Iterable.reduce(Iterable.slice(this.linesWithEOL, 0, this.range.startLineNumber - 1), (len, line) => line.length + len, 0);
            for (let i = this.range.startLineNumber - 1, lineStartOffset = bodyOffset; i < this.range.endLineNumber - 1; i++) {
                const line = this.linesWithEOL[i];
                // Match markdown links: [text](link)
                const linkMatch = line.matchAll(/\[(.*?)\]\((.+?)\)/g);
                for (const match of linkMatch) {
                    const linkEndOffset = match.index + match[0].length - 1; // before the parenthesis
                    const linkStartOffset = match.index + match[0].length - match[2].length - 1;
                    const range = new Range(i + 1, linkStartOffset + 1, i + 1, linkEndOffset + 1);
                    fileReferences.push({ content: match[2], range, isMarkdownLink: true });
                    markdownLinkRanges.push(new Range(i + 1, match.index + 1, i + 1, match.index + match[0].length + 1));
                }
                // Match #file:<filePath> and #tool:<toolName>
                // Regarding the <toolName> pattern below, see also the variableReg regex in chatRequestParser.ts.
                const reg = /#file:(?<filePath>[^\s#]+)|#tool:(?<toolName>[\w_\-\.\/]+)/gi;
                const matches = line.matchAll(reg);
                for (const match of matches) {
                    const fullMatch = match[0];
                    const fullRange = new Range(i + 1, match.index + 1, i + 1, match.index + fullMatch.length + 1);
                    if (markdownLinkRanges.some(mdRange => Range.areIntersectingOrTouching(mdRange, fullRange))) {
                        continue;
                    }
                    const contentMatch = match.groups?.['filePath'] || match.groups?.['toolName'];
                    if (!contentMatch) {
                        continue;
                    }
                    const startOffset = match.index + fullMatch.length - contentMatch.length;
                    const endOffset = match.index + fullMatch.length;
                    const range = new Range(i + 1, startOffset + 1, i + 1, endOffset + 1);
                    if (match.groups?.['filePath']) {
                        fileReferences.push({ content: match.groups?.['filePath'], range, isMarkdownLink: false });
                    }
                    else if (match.groups?.['toolName']) {
                        variableReferences.push({ name: match.groups?.['toolName'], range, offset: lineStartOffset + match.index });
                    }
                }
                lineStartOffset += line.length;
            }
            this._parsed = { fileReferences: fileReferences.sort((a, b) => Range.compareRangesUsingStarts(a.range, b.range)), variableReferences, bodyOffset };
        }
        return this._parsed;
    }
    getContent() {
        return this.linesWithEOL.slice(this.range.startLineNumber - 1, this.range.endLineNumber - 1).join('');
    }
    resolveFilePath(path) {
        try {
            if (path.startsWith('/')) {
                return this.uri.with({ path });
            }
            else if (path.match(/^[a-zA-Z]+:\//)) {
                return URI.parse(path);
            }
            else {
                const dirName = dirname(this.uri);
                return joinPath(dirName, path);
            }
        }
        catch {
            return undefined;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0RmlsZVBhcnNlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvcHJvbXB0RmlsZVBhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNwRixPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEQsT0FBTyxFQUFFLEtBQUssRUFBc0QsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFbkUsTUFBTSxPQUFPLGdCQUFnQjtJQUM1QjtJQUNBLENBQUM7SUFFTSxLQUFLLENBQUMsR0FBUSxFQUFFLE9BQWU7UUFDckMsTUFBTSxZQUFZLEdBQUcsMkJBQTJCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDMUQsSUFBSSxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQy9CLE9BQU8sSUFBSSxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3hELENBQUM7UUFDRCxJQUFJLE1BQU0sR0FBNkIsU0FBUyxDQUFDO1FBQ2pELElBQUksSUFBSSxHQUEyQixTQUFTLENBQUM7UUFDN0MsSUFBSSxhQUFhLEdBQUcsQ0FBQyxDQUFDO1FBQ3RCLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUM7WUFDN0MsSUFBSSxhQUFhLEdBQUcsWUFB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