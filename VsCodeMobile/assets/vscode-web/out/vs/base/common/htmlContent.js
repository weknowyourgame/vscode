/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { illegalArgument } from './errors.js';
import { escapeIcons } from './iconLabels.js';
import { Schemas } from './network.js';
import { isEqual } from './resources.js';
import { escapeRegExpCharacters } from './strings.js';
import { URI } from './uri.js';
export var MarkdownStringTextNewlineStyle;
(function (MarkdownStringTextNewlineStyle) {
    MarkdownStringTextNewlineStyle[MarkdownStringTextNewlineStyle["Paragraph"] = 0] = "Paragraph";
    MarkdownStringTextNewlineStyle[MarkdownStringTextNewlineStyle["Break"] = 1] = "Break";
})(MarkdownStringTextNewlineStyle || (MarkdownStringTextNewlineStyle = {}));
export class MarkdownString {
    static lift(dto) {
        const markdownString = new MarkdownString(dto.value, dto);
        markdownString.uris = dto.uris;
        markdownString.baseUri = dto.baseUri ? URI.revive(dto.baseUri) : undefined;
        return markdownString;
    }
    constructor(value = '', isTrustedOrOptions = false) {
        this.value = value;
        if (typeof this.value !== 'string') {
            throw illegalArgument('value');
        }
        if (typeof isTrustedOrOptions === 'boolean') {
            this.isTrusted = isTrustedOrOptions;
            this.supportThemeIcons = false;
            this.supportHtml = false;
            this.supportAlertSyntax = false;
        }
        else {
            this.isTrusted = isTrustedOrOptions.isTrusted ?? undefined;
            this.supportThemeIcons = isTrustedOrOptions.supportThemeIcons ?? false;
            this.supportHtml = isTrustedOrOptions.supportHtml ?? false;
            this.supportAlertSyntax = isTrustedOrOptions.supportAlertSyntax ?? false;
        }
    }
    appendText(value, newlineStyle = 0 /* MarkdownStringTextNewlineStyle.Paragraph */) {
        this.value += escapeMarkdownSyntaxTokens(this.supportThemeIcons ? escapeIcons(value) : value) // CodeQL [SM02383] The Markdown is fully sanitized after being rendered.
            .replace(/([ \t]+)/g, (_match, g1) => '&nbsp;'.repeat(g1.length)) // CodeQL [SM02383] The Markdown is fully sanitized after being rendered.
            .replace(/\>/gm, '\\>') // CodeQL [SM02383] The Markdown is fully sanitized after being rendered.
            .replace(/\n/g, newlineStyle === 1 /* MarkdownStringTextNewlineStyle.Break */ ? '\\\n' : '\n\n'); // CodeQL [SM02383] The Markdown is fully sanitized after being rendered.
        return this;
    }
    appendMarkdown(value) {
        this.value += value;
        return this;
    }
    appendCodeblock(langId, code) {
        this.value += `\n${appendEscapedMarkdownCodeBlockFence(code, langId)}\n`;
        return this;
    }
    appendLink(target, label, title) {
        this.value += '[';
        this.value += this._escape(label, ']');
        this.value += '](';
        this.value += this._escape(String(target), ')');
        if (title) {
            this.value += ` "${this._escape(this._escape(title, '"'), ')')}"`;
        }
        this.value += ')';
        return this;
    }
    _escape(value, ch) {
        const r = new RegExp(escapeRegExpCharacters(ch), 'g');
        return value.replace(r, (match, offset) => {
            if (value.charAt(offset - 1) !== '\\') {
                return `\\${match}`;
            }
            else {
                return match;
            }
        });
    }
}
export function isEmptyMarkdownString(oneOrMany) {
    if (isMarkdownString(oneOrMany)) {
        return !oneOrMany.value;
    }
    else if (Array.isArray(oneOrMany)) {
        return oneOrMany.every(isEmptyMarkdownString);
    }
    else {
        return true;
    }
}
export function isMarkdownString(thing) {
    if (thing instanceof MarkdownString) {
        return true;
    }
    else if (thing && typeof thing === 'object') {
        return typeof thing.value === 'string'
            && (typeof thing.isTrusted === 'boolean' || typeof thing.isTrusted === 'object' || thing.isTrusted === undefined)
            && (typeof thing.supportThemeIcons === 'boolean' || thing.supportThemeIcons === undefined)
            && (typeof thing.supportAlertSyntax === 'boolean' || thing.supportAlertSyntax === undefined);
    }
    return false;
}
export function markdownStringEqual(a, b) {
    if (a === b) {
        return true;
    }
    else if (!a || !b) {
        return false;
    }
    else {
        return a.value === b.value
            && a.isTrusted === b.isTrusted
            && a.supportThemeIcons === b.supportThemeIcons
            && a.supportHtml === b.supportHtml
            && a.supportAlertSyntax === b.supportAlertSyntax
            && (a.baseUri === b.baseUri || !!a.baseUri && !!b.baseUri && isEqual(URI.from(a.baseUri), URI.from(b.baseUri)));
    }
}
export function escapeMarkdownSyntaxTokens(text) {
    // escape markdown syntax tokens: http://daringfireball.net/projects/markdown/syntax#backslash
    return text.replace(/[\\`*_{}[\]()#+\-!~]/g, '\\$&'); // CodeQL [SM02383] Backslash is escaped in the character class
}
/**
 * @see https://github.com/microsoft/vscode/issues/193746
 */
export function appendEscapedMarkdownCodeBlockFence(code, langId) {
    const longestFenceLength = code.match(/^`+/gm)?.reduce((a, b) => (a.length > b.length ? a : b)).length ??
        0;
    const desiredFenceLength = longestFenceLength >= 3 ? longestFenceLength + 1 : 3;
    // the markdown result
    return [
        `${'`'.repeat(desiredFenceLength)}${langId}`,
        code,
        `${'`'.repeat(desiredFenceLength)}`,
    ].join('\n');
}
export function escapeDoubleQuotes(input) {
    return input.replace(/"/g, '&quot;');
}
export function removeMarkdownEscapes(text) {
    if (!text) {
        return text;
    }
    return text.replace(/\\([\\`*_{}[\]()#+\-.!~])/g, '$1');
}
export function parseHrefAndDimensions(href) {
    const dimensions = [];
    const splitted = href.split('|').map(s => s.trim());
    href = splitted[0];
    const parameters = splitted[1];
    if (parameters) {
        const heightFromParams = /height=(\d+)/.exec(parameters);
        const widthFromParams = /width=(\d+)/.exec(parameters);
        const height = heightFromParams ? heightFromParams[1] : '';
        const width = widthFromParams ? widthFromParams[1] : '';
        const widthIsFinite = isFinite(parseInt(width));
        const heightIsFinite = isFinite(parseInt(height));
        if (widthIsFinite) {
            dimensions.push(`width="${width}"`);
        }
        if (heightIsFinite) {
            dimensions.push(`height="${height}"`);
        }
    }
    return { href, dimensions };
}
export function createMarkdownLink(text, href, title, escapeTokens = true) {
    return `[${escapeTokens ? escapeMarkdownSyntaxTokens(text) : text}](${href}${title ? ` "${escapeMarkdownSyntaxTokens(title)}"` : ''})`;
}
export function createMarkdownCommandLink(command, escapeTokens = true) {
    const uri = createCommandUri(command.id, ...(command.arguments || [])).toString();
    return createMarkdownLink(command.title, uri, command.tooltip, escapeTokens);
}
export function createCommandUri(commandId, ...commandArgs) {
    return URI.from({
        scheme: Schemas.command,
        path: commandId,
        query: commandArgs.length ? encodeURIComponent(JSON.stringify(commandArgs)) : undefined,
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHRtbENvbnRlbnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vaHRtbENvbnRlbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUM5QyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDOUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUN2QyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDekMsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ3RELE9BQU8sRUFBRSxHQUFHLEVBQWlCLE1BQU0sVUFBVSxDQUFDO0FBaUI5QyxNQUFNLENBQU4sSUFBa0IsOEJBR2pCO0FBSEQsV0FBa0IsOEJBQThCO0lBQy9DLDZGQUFhLENBQUE7SUFDYixxRkFBUyxDQUFBO0FBQ1YsQ0FBQyxFQUhpQiw4QkFBOEIsS0FBOUIsOEJBQThCLFFBRy9DO0FBRUQsTUFBTSxPQUFPLGNBQWM7SUFVbkIsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFvQjtRQUN0QyxNQUFNLGNBQWMsR0FBRyxJQUFJLGNBQWMsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzFELGNBQWMsQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQztRQUMvQixjQUFjLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDM0UsT0FBTyxjQUFjLENBQUM7SUFDdkIsQ0FBQztJQUVELFlBQ0MsUUFBZ0IsRUFBRSxFQUNsQixxQkFBeUssS0FB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