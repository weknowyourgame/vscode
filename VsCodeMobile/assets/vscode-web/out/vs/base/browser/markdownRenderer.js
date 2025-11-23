/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { onUnexpectedError } from '../common/errors.js';
import { escapeDoubleQuotes, parseHrefAndDimensions, removeMarkdownEscapes } from '../common/htmlContent.js';
import { markdownEscapeEscapedIcons } from '../common/iconLabels.js';
import { defaultGenerator } from '../common/idGenerator.js';
import { Lazy } from '../common/lazy.js';
import { DisposableStore } from '../common/lifecycle.js';
import * as marked from '../common/marked/marked.js';
import { parse } from '../common/marshalling.js';
import { FileAccess, Schemas } from '../common/network.js';
import { cloneAndChange } from '../common/objects.js';
import { dirname, resolvePath } from '../common/resources.js';
import { escape } from '../common/strings.js';
import { URI } from '../common/uri.js';
import * as DOM from './dom.js';
import * as domSanitize from './domSanitize.js';
import { convertTagToPlaintext } from './domSanitize.js';
import { StandardKeyboardEvent } from './keyboardEvent.js';
import { StandardMouseEvent } from './mouseEvent.js';
import { renderIcon, renderLabelWithIcons } from './ui/iconLabel/iconLabels.js';
const defaultMarkedRenderers = Object.freeze({
    image: ({ href, title, text }) => {
        let dimensions = [];
        let attributes = [];
        if (href) {
            ({ href, dimensions } = parseHrefAndDimensions(href));
            attributes.push(`src="${escapeDoubleQuotes(href)}"`);
        }
        if (text) {
            attributes.push(`alt="${escapeDoubleQuotes(text)}"`);
        }
        if (title) {
            attributes.push(`title="${escapeDoubleQuotes(title)}"`);
        }
        if (dimensions.length) {
            attributes = attributes.concat(dimensions);
        }
        return '<img ' + attributes.join(' ') + '>';
    },
    paragraph({ tokens }) {
        return `<p>${this.parser.parseInline(tokens)}</p>`;
    },
    link({ href, title, tokens }) {
        let text = this.parser.parseInline(tokens);
        if (typeof href !== 'string') {
            return '';
        }
        // Remove markdown escapes. Workaround for https://github.com/chjj/marked/issues/829
        if (href === text) { // raw link case
            text = removeMarkdownEscapes(text);
        }
        title = typeof title === 'string' ? escapeDoubleQuotes(removeMarkdownEscapes(title)) : '';
        href = removeMarkdownEscapes(href);
        // HTML Encode href
        href = href.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        return `<a href="${href}" title="${title || href}" draggable="false">${text}</a>`;
    },
});
/**
 * Blockquote renderer that processes GitHub-style alert syntax.
 * Transforms blockquotes like "> [!NOTE]" into structured alert markup with icons.
 *
 * Based on GitHub's alert syntax: https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts
 */
function createAlertBlockquoteRenderer(fallbackRenderer) {
    return function (token) {
        const { tokens } = token;
        // Check if this blockquote starts with alert syntax [!TYPE]
        const firstToken = tokens[0];
        if (firstToken?.type !== 'paragraph') {
            return fallbackRenderer.call(this, token);
        }
        const paragraphTokens = firstToken.tokens;
        if (!paragraphTokens || paragraphTokens.length === 0) {
            return fallbackRenderer.call(this, token);
        }
        const firstTextToken = paragraphTokens[0];
        if (firstTextToken?.type !== 'text') {
            return fallbackRenderer.call(this, token);
        }
        const pattern = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*?\n*/i;
        const match = firstTextToken.raw.match(pattern);
        if (!match) {
            return fallbackRenderer.call(this, token);
        }
        // Remove the alert marker from the token
        firstTextToken.raw = firstTextToken.raw.replace(pattern, '');
        firstTextToken.text = firstTextToken.text.replace(pattern, '');
        const alertIcons = {
            'note': 'info',
            'tip': 'light-bulb',
            'important': 'comment',
            'warning': 'alert',
            'caution': 'stop'
        };
        const type = match[1];
        const typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
        const severity = type.toLowerCase();
        const iconHtml = renderIcon({ id: alertIcons[severity] }).outerHTML;
        // Render the remaining content
        const content = this.parser.parse(tokens);
        // Return alert markup with icon and severity (skipping the first 3 characters: `<p>`)
        return `<blockquote data-severity="${severity}"><p><span>${iconHtml}${typeCapitalized}</span>${content.substring(3)}</blockquote>\n`;
    };
}
/**
 * Low-level way create a html element from a markdown string.
 *
 * **Note** that for most cases you should be using {@link import('../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js').MarkdownRenderer MarkdownRenderer}
 * which comes with support for pretty code block rendering and which uses the default way of handling links.
 */
export function renderMarkdown(markdown, options = {}, target) {
    const disposables = new DisposableStore();
    let isDisposed = false;
    const markedInstance = new marked.Marked(...(options.markedExtensions ?? []));
    const { renderer, codeBlocks, syncCodeBlocks } = createMarkdownRenderer(markedInstance, options, markdown);
    const value = preprocessMarkdownString(markdown);
    let renderedMarkdown;
    if (options.fillInIncompleteTokens) {
        // The defaults are applied by parse but not lexer()/parser(), and they need to be present
        const opts = {
            ...markedInstance.defaults,
            ...options.markedOptions,
            renderer
        };
        const tokens = markedInstance.lexer(value, opts);
        const newTokens = fillInIncompleteTokens(tokens);
        renderedMarkdown = markedInstance.parser(newTokens, opts);
    }
    else {
        renderedMarkdown = markedInstance.parse(value, { ...options?.markedOptions, renderer, async: false });
    }
    // Rewrite theme icons
    if (markdown.supportThemeIcons) {
        const elements = renderLabelWithIcons(renderedMarkdown);
        renderedMarkdown = elements.map(e => typeof e === 'string' ? e : e.outerHTML).join('');
    }
    const renderedContent = document.createElement('div');
    const sanitizerConfig = getDomSanitizerConfig(markdown, options.sanitizerConfig ?? {});
    domSanitize.safeSetInnerHtml(renderedContent, renderedMarkdown, sanitizerConfig);
    // Rewrite links and images before potentially inserting them into the real dom
    rewriteRenderedLinks(markdown, options, renderedContent);
    let outElement;
    if (target) {
        outElement = target;
        DOM.reset(target, ...renderedContent.childNodes);
    }
    else {
        outElement = renderedContent;
    }
    if (codeBlocks.length > 0) {
        Promise.all(codeBlocks).then((tuples) => {
            if (isDisposed) {
                return;
            }
            const renderedElements = new Map(tuples);
            // eslint-disable-next-line no-restricted-syntax
            const placeholderElements = outElement.querySelectorAll(`div[data-code]`);
            for (const placeholderElement of placeholderElements) {
                const renderedElement = renderedElements.get(placeholderElement.dataset['code'] ?? '');
                if (renderedElement) {
                    DOM.reset(placeholderElement, renderedElement);
                }
            }
            options.asyncRenderCallback?.();
        });
    }
    else if (syncCodeBlocks.length > 0) {
        const renderedElements = new Map(syncCodeBlocks);
        // eslint-disable-next-line no-restricted-syntax
        const placeholderElements = outElement.querySelectorAll(`div[data-code]`);
        for (const placeholderElement of placeholderElements) {
            const renderedElement = renderedElements.get(placeholderElement.dataset['code'] ?? '');
            if (renderedElement) {
                DOM.reset(placeholderElement, renderedElement);
            }
        }
    }
    // Signal size changes for image tags
    if (options.asyncRenderCallback) {
        // eslint-disable-next-line no-restricted-syntax
        for (const img of outElement.getElementsByTagName('img')) {
            const listener = disposables.add(DOM.addDisposableListener(img, 'load', () => {
                listener.dispose();
                options.asyncRenderCallback();
            }));
        }
    }
    // Add event listeners for links
    if (options.actionHandler) {
        const clickCb = (e) => {
            const mouseEvent = new StandardMouseEvent(DOM.getWindow(outElement), e);
            if (!mouseEvent.leftButton && !mouseEvent.middleButton) {
                return;
            }
            activateLink(markdown, options, mouseEvent);
        };
        disposables.add(DOM.addDisposableListener(outElement, 'click', clickCb));
        disposables.add(DOM.addDisposableListener(outElement, 'auxclick', clickCb));
        disposables.add(DOM.addDisposableListener(outElement, 'keydown', (e) => {
            const keyboardEvent = new StandardKeyboardEvent(e);
            if (!keyboardEvent.equals(10 /* KeyCode.Space */) && !keyboardEvent.equals(3 /* KeyCode.Enter */)) {
                return;
            }
            activateLink(markdown, options, keyboardEvent);
        }));
    }
    // Remove/disable inputs
    // eslint-disable-next-line no-restricted-syntax
    for (const input of [...outElement.getElementsByTagName('input')]) {
        if (input.attributes.getNamedItem('type')?.value === 'checkbox') {
            input.setAttribute('disabled', '');
        }
        else {
            if (options.sanitizerConfig?.replaceWithPlaintext) {
                const replacement = convertTagToPlaintext(input);
                if (replacement) {
                    input.parentElement?.replaceChild(replacement, input);
                }
                else {
                    input.remove();
                }
            }
            else {
                input.remove();
            }
        }
    }
    return {
        element: outElement,
        dispose: () => {
            isDisposed = true;
            disposables.dispose();
        }
    };
}
function rewriteRenderedLinks(markdown, options, root) {
    // eslint-disable-next-line no-restricted-syntax
    for (const el of root.querySelectorAll('img, audio, video, source')) {
        const src = el.getAttribute('src'); // Get the raw 'src' attribute value as text, not the resolved 'src'
        if (src) {
            let href = src;
            try {
                if (markdown.baseUri) { // absolute or relative local path, or file: uri
                    href = resolveWithBaseUri(URI.from(markdown.baseUri), href);
                }
            }
            catch (err) { }
            el.setAttribute('src', massageHref(markdown, href, true));
            if (options.sanitizerConfig?.remoteImageIsAllowed) {
                const uri = URI.parse(href);
                if (uri.scheme !== Schemas.file && uri.scheme !== Schemas.data && !options.sanitizerConfig.remoteImageIsAllowed(uri)) {
                    el.replaceWith(DOM.$('', undefined, el.outerHTML));
                }
            }
        }
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const el of root.querySelectorAll('a')) {
        const href = el.getAttribute('href'); // Get the raw 'href' attribute value as text, not the resolved 'href'
        el.setAttribute('href', ''); // Clear out href. We use the `data-href` for handling clicks instead
        if (!href
            || /^data:|javascript:/i.test(href)
            || (/^command:/i.test(href) && !markdown.isTrusted)
            || /^command:(\/\/\/)?_workbench\.downloadResource/i.test(href)) {
            // drop the link
            el.replaceWith(...el.childNodes);
        }
        else {
            let resolvedHref = massageHref(markdown, href, false);
            if (markdown.baseUri) {
                resolvedHref = resolveWithBaseUri(URI.from(markdown.baseUri), href);
            }
            el.dataset.href = resolvedHref;
        }
    }
}
function createMarkdownRenderer(marked, options, markdown) {
    const renderer = new marked.Renderer(options.markedOptions);
    renderer.image = defaultMarkedRenderers.image;
    renderer.link = defaultMarkedRenderers.link;
    renderer.paragraph = defaultMarkedRenderers.paragraph;
    if (markdown.supportAlertSyntax) {
        renderer.blockquote = createAlertBlockquoteRenderer(renderer.blockquote);
    }
    // Will collect [id, renderedElement] tuples
    const codeBlocks = [];
    const syncCodeBlocks = [];
    if (options.codeBlockRendererSync) {
        renderer.code = ({ text, lang, raw }) => {
            const id = defaultGenerator.nextId();
            const value = options.codeBlockRendererSync(postProcessCodeBlockLanguageId(lang), text, raw);
            syncCodeBlocks.push([id, value]);
            return `<div class="code" data-code="${id}">${escape(text)}</div>`;
        };
    }
    else if (options.codeBlockRenderer) {
        renderer.code = ({ text, lang }) => {
            const id = defaultGenerator.nextId();
            const value = options.codeBlockRenderer(postProcessCodeBlockLanguageId(lang), text);
            codeBlocks.push(value.then(element => [id, element]));
            return `<div class="code" data-code="${id}">${escape(text)}</div>`;
        };
    }
    if (!markdown.supportHtml) {
        // Note: we always pass the output through dompurify after this so that we don't rely on
        // marked for real sanitization.
        renderer.html = ({ text }) => {
            if (options.sanitizerConfig?.replaceWithPlaintext) {
                return escape(text);
            }
            const match = markdown.isTrusted ? text.match(/^(<span[^>]+>)|(<\/\s*span>)$/) : undefined;
            return match ? text : '';
        };
    }
    return { renderer, codeBlocks, syncCodeBlocks };
}
function preprocessMarkdownString(markdown) {
    let value = markdown.value;
    // values that are too long will freeze the UI
    if (value.length > 100_000) {
        value = `${value.substr(0, 100_000)}…`;
    }
    // escape theme icons
    if (markdown.supportThemeIcons) {
        value = markdownEscapeEscapedIcons(value);
    }
    return value;
}
function activateLink(mdStr, options, event) {
    const target = event.target.closest('a[data-href]');
    if (!DOM.isHTMLElement(target)) {
        return;
    }
    try {
        let href = target.dataset['href'];
        if (href) {
            if (mdStr.baseUri) {
                href = resolveWithBaseUri(URI.from(mdStr.baseUri), href);
            }
            options.actionHandler?.(href, mdStr);
        }
    }
    catch (err) {
        onUnexpectedError(err);
    }
    finally {
        event.preventDefault();
        event.stopPropagation();
    }
}
function uriMassage(markdown, part) {
    let data;
    try {
        data = parse(decodeURIComponent(part));
    }
    catch (e) {
        // ignore
    }
    if (!data) {
        return part;
    }
    data = cloneAndChange(data, value => {
        if (markdown.uris && markdown.uris[value]) {
            return URI.revive(markdown.uris[value]);
        }
        else {
            return undefined;
        }
    });
    return encodeURIComponent(JSON.stringify(data));
}
function massageHref(markdown, href, isDomUri) {
    const data = markdown.uris && markdown.uris[href];
    let uri = URI.revive(data);
    if (isDomUri) {
        if (href.startsWith(Schemas.data + ':')) {
            return href;
        }
        if (!uri) {
            uri = URI.parse(href);
        }
        // this URI will end up as "src"-attribute of a dom node
        // and because of that special rewriting needs to be done
        // so that the URI uses a protocol that's understood by
        // browsers (like http or https)
        return FileAccess.uriToBrowserUri(uri).toString(true);
    }
    if (!uri) {
        return href;
    }
    if (URI.parse(href).toString() === uri.toString()) {
        return href; // no transformation performed
    }
    if (uri.query) {
        uri = uri.with({ query: uriMassage(markdown, uri.query) });
    }
    return uri.toString();
}
function postProcessCodeBlockLanguageId(lang) {
    if (!lang) {
        return '';
    }
    const parts = lang.split(/[\s+|:|,|\{|\?]/, 1);
    if (parts.length) {
        return parts[0];
    }
    return lang;
}
function resolveWithBaseUri(baseUri, href) {
    const hasScheme = /^\w[\w\d+.-]*:/.test(href);
    if (hasScheme) {
        return href;
    }
    if (baseUri.path.endsWith('/')) {
        return resolvePath(baseUri, href).toString();
    }
    else {
        return resolvePath(dirname(baseUri), href).toString();
    }
}
function sanitizeRenderedMarkdown(renderedMarkdown, originalMdStrConfig, options = {}) {
    const sanitizerConfig = getDomSanitizerConfig(originalMdStrConfig, options);
    return domSanitize.sanitizeHtml(renderedMarkdown, sanitizerConfig);
}
export const allowedMarkdownHtmlTags = Object.freeze([
    ...domSanitize.basicMarkupHtmlTags,
    'input', // Allow inputs for rendering checkboxes. Other types of inputs are removed and the inputs are always disabled
]);
export const allowedMarkdownHtmlAttributes = Object.freeze([
    'align',
    'autoplay',
    'alt',
    'colspan',
    'controls',
    'draggable',
    'height',
    'href',
    'loop',
    'muted',
    'playsinline',
    'poster',
    'rowspan',
    'src',
    'target',
    'title',
    'type',
    'width',
    'start',
    // Input (For disabled inputs)
    'checked',
    'disabled',
    'value',
    // Custom markdown attributes
    'data-code',
    'data-href',
    'data-severity',
    // Only allow very specific styles
    {
        attributeName: 'style',
        shouldKeep: (element, data) => {
            if (element.tagName === 'SPAN') {
                if (data.attrName === 'style') {
                    return /^(color\:(#[0-9a-fA-F]+|var\(--vscode(-[a-zA-Z0-9]+)+\));)?(background-color\:(#[0-9a-fA-F]+|var\(--vscode(-[a-zA-Z0-9]+)+\));)?(border-radius:[0-9]+px;)?$/.test(data.attrValue);
                }
            }
            return false;
        }
    },
    // Only allow codicons for classes
    {
        attributeName: 'class',
        shouldKeep: (element, data) => {
            if (element.tagName === 'SPAN') {
                if (data.attrName === 'class') {
                    return /^codicon codicon-[a-z\-]+( codicon-modifier-[a-z\-]+)?$/.test(data.attrValue);
                }
            }
            return false;
        },
    },
]);
function getDomSanitizerConfig(mdStrConfig, options) {
    const isTrusted = mdStrConfig.isTrusted ?? false;
    const allowedLinkSchemes = [
        Schemas.http,
        Schemas.https,
        Schemas.mailto,
        Schemas.file,
        Schemas.vscodeFileResource,
        Schemas.vscodeRemote,
        Schemas.vscodeRemoteResource,
        Schemas.vscodeNotebookCell,
        // For links that are handled entirely by the action handler
        Schemas.internal,
    ];
    if (isTrusted) {
        allowedLinkSchemes.push(Schemas.command);
    }
    if (options.allowedLinkSchemes?.augment) {
        allowedLinkSchemes.push(...options.allowedLinkSchemes.augment);
    }
    return {
        // allowedTags should included everything that markdown renders to.
        // Since we have our own sanitize function for marked, it's possible we missed some tag so let dompurify make sure.
        // HTML tags that can result from markdown are from reading https://spec.commonmark.org/0.29/
        // HTML table tags that can result from markdown are from https://github.github.com/gfm/#tables-extension-
        allowedTags: {
            override: options.allowedTags?.override ?? allowedMarkdownHtmlTags
        },
        allowedAttributes: {
            override: options.allowedAttributes?.override ?? allowedMarkdownHtmlAttributes,
        },
        allowedLinkProtocols: {
            override: allowedLinkSchemes,
        },
        allowRelativeLinkPaths: !!mdStrConfig.baseUri,
        allowedMediaProtocols: {
            override: [
                Schemas.http,
                Schemas.https,
                Schemas.data,
                Schemas.file,
                Schemas.vscodeFileResource,
                Schemas.vscodeRemote,
                Schemas.vscodeRemoteResource,
            ]
        },
        allowRelativeMediaPaths: !!mdStrConfig.baseUri,
        replaceWithPlaintext: options.replaceWithPlaintext,
    };
}
/**
 * Renders `str` as plaintext, stripping out Markdown syntax if it's a {@link IMarkdownString}.
 *
 * For example `# Header` would be output as `Header`.
 */
export function renderAsPlaintext(str, options) {
    if (typeof str === 'string') {
        return str;
    }
    // values that are too long will freeze the UI
    let value = str.value ?? '';
    if (value.length > 100_000) {
        value = `${value.substr(0, 100_000)}…`;
    }
    const html = marked.parse(value, { async: false, renderer: options?.includeCodeBlocksFences ? plainTextWithCodeBlocksRenderer.value : plainTextRenderer.value });
    return sanitizeRenderedMarkdown(html, { isTrusted: false }, {})
        .toString()
        .replace(/&(#\d+|[a-zA-Z]+);/g, m => unescapeInfo.get(m) ?? m)
        .trim();
}
const unescapeInfo = new Map([
    ['&quot;', '"'],
    ['&nbsp;', ' '],
    ['&amp;', '&'],
    ['&#39;', '\''],
    ['&lt;', '<'],
    ['&gt;', '>'],
]);
function createPlainTextRenderer() {
    const renderer = new marked.Renderer();
    renderer.code = ({ text }) => {
        return escape(text);
    };
    renderer.blockquote = ({ text }) => {
        return text + '\n';
    };
    renderer.html = (_) => {
        return '';
    };
    renderer.heading = function ({ tokens }) {
        return this.parser.parseInline(tokens) + '\n';
    };
    renderer.hr = () => {
        return '';
    };
    renderer.list = function ({ items }) {
        return items.map(x => this.listitem(x)).join('\n') + '\n';
    };
    renderer.listitem = ({ text }) => {
        return text + '\n';
    };
    renderer.paragraph = function ({ tokens }) {
        return this.parser.parseInline(tokens) + '\n';
    };
    renderer.table = function ({ header, rows }) {
        return header.map(cell => this.tablecell(cell)).join(' ') + '\n' + rows.map(cells => cells.map(cell => this.tablecell(cell)).join(' ')).join('\n') + '\n';
    };
    renderer.tablerow = ({ text }) => {
        return text;
    };
    renderer.tablecell = function ({ tokens }) {
        return this.parser.parseInline(tokens);
    };
    renderer.strong = ({ text }) => {
        return text;
    };
    renderer.em = ({ text }) => {
        return text;
    };
    renderer.codespan = ({ text }) => {
        return escape(text);
    };
    renderer.br = (_) => {
        return '\n';
    };
    renderer.del = ({ text }) => {
        return text;
    };
    renderer.image = (_) => {
        return '';
    };
    renderer.text = ({ text }) => {
        return text;
    };
    renderer.link = ({ text }) => {
        return text;
    };
    return renderer;
}
const plainTextRenderer = new Lazy(createPlainTextRenderer);
const plainTextWithCodeBlocksRenderer = new Lazy(() => {
    const renderer = createPlainTextRenderer();
    renderer.code = ({ text }) => {
        return `\n\`\`\`\n${escape(text)}\n\`\`\`\n`;
    };
    return renderer;
});
function mergeRawTokenText(tokens) {
    let mergedTokenText = '';
    tokens.forEach(token => {
        mergedTokenText += token.raw;
    });
    return mergedTokenText;
}
function completeSingleLinePattern(token) {
    if (!token.tokens) {
        return undefined;
    }
    for (let i = token.tokens.length - 1; i >= 0; i--) {
        const subtoken = token.tokens[i];
        if (subtoken.type === 'text') {
            const lines = subtoken.raw.split('\n');
            const lastLine = lines[lines.length - 1];
            if (lastLine.includes('`')) {
                return completeCodespan(token);
            }
            else if (lastLine.includes('**')) {
                return completeDoublestar(token);
            }
            else if (lastLine.match(/\*\w/)) {
                return completeStar(token);
            }
            else if (lastLine.match(/(^|\s)__\w/)) {
                return completeDoubleUnderscore(token);
            }
            else if (lastLine.match(/(^|\s)_\w/)) {
                return completeUnderscore(token);
            }
            else if (
            // Text with start of link target
            hasLinkTextAndStartOfLinkTarget(lastLine) ||
                // This token doesn't have the link text, eg if it contains other markdown constructs that are in other subtokens.
                // But some preceding token does have an unbalanced [ at least
                hasStartOfLinkTargetAndNoLinkText(lastLine) && token.tokens.slice(0, i).some(t => t.type === 'text' && t.raw.match(/\[[^\]]*$/))) {
                const nextTwoSubTokens = token.tokens.slice(i + 1);
                // A markdown link can look like
                // [link text](https://microsoft.com "more text")
                // Where "more text" is a title for the link or an argument to a vscode command link
                if (
                // If the link was parsed as a link, then look for a link token and a text token with a quote
                nextTwoSubTokens[0]?.type === 'link' && nextTwoSubTokens[1]?.type === 'text' && nextTwoSubTokens[1].raw.match(/^ *"[^"]*$/) ||
                    // And if the link was not parsed as a link (eg command link), just look for a single quote in this token
                    lastLine.match(/^[^"]* +"[^"]*$/)) {
                    return completeLinkTargetArg(token);
                }
                return completeLinkTarget(token);
            }
            // Contains the start of link text, and no following tokens contain the link target
            else if (lastLine.match(/(^|\s)\[\w*[^\]]*$/)) {
                return completeLinkText(token);
            }
        }
    }
    return undefined;
}
function hasLinkTextAndStartOfLinkTarget(str) {
    return !!str.match(/(^|\s)\[.*\]\(\w*/);
}
function hasStartOfLinkTargetAndNoLinkText(str) {
    return !!str.match(/^[^\[]*\]\([^\)]*$/);
}
function completeListItemPattern(list) {
    // Patch up this one list item
    const lastListItem = list.items[list.items.length - 1];
    const lastListSubToken = lastListItem.tokens ? lastListItem.tokens[lastListItem.tokens.length - 1] : undefined;
    /*
    Example list token structures:

    list
        list_item
            text
                text
                codespan
                link
        list_item
            text
            code // Complete indented codeblock
        list_item
            text
            space
            text
                text // Incomplete indented codeblock
        list_item
            text
            list // Nested list
                list_item
                    text
                        text

    Contrast with paragraph:
    paragraph
        text
        codespan
    */
    const listEndsInHeading = (list) => {
        // A list item can be rendered as a heading for some reason when it has a subitem where we haven't rendered the text yet like this:
        // 1. list item
        //    -
        const lastItem = list.items.at(-1);
        const lastToken = lastItem?.tokens.at(-1);
        return lastToken?.type === 'heading' || lastToken?.type === 'list' && listEndsInHeading(lastToken);
    };
    let newToken;
    if (lastListSubToken?.type === 'text' && !('inRawBlock' in lastListItem)) { // Why does Tag have a type of 'text'
        newToken = completeSingleLinePattern(lastListSubToken);
    }
    else if (listEndsInHeading(list)) {
        const newList = marked.lexer(list.raw.trim() + ' &nbsp;')[0];
        if (newList.type !== 'list') {
            // Something went wrong
            return;
        }
        return newList;
    }
    if (!newToken || newToken.type !== 'paragraph') { // 'text' item inside the list item turns into paragraph
        // Nothing to fix, or not a pattern we were expecting
        return;
    }
    const previousListItemsText = mergeRawTokenText(list.items.slice(0, -1));
    // Grabbing the `- ` or `1. ` or `* ` off the list item because I can't find a better way to do this
    const lastListItemLead = lastListItem.raw.match(/^(\s*(-|\d+\.|\*) +)/)?.[0];
    if (!lastListItemLead) {
        // Is badly formatted
        return;
    }
    const newListItemText = lastListItemLead +
        mergeRawTokenText(lastListItem.tokens.slice(0, -1)) +
        newToken.raw;
    const newList = marked.lexer(previousListItemsText + newListItemText)[0];
    if (newList.type !== 'list') {
        // Something went wrong
        return;
    }
    return newList;
}
function completeHeading(token, fullRawText) {
    if (token.raw.match(/-\s*$/)) {
        return marked.lexer(fullRawText + ' &nbsp;');
    }
}
const maxIncompleteTokensFixRounds = 3;
export function fillInIncompleteTokens(tokens) {
    for (let i = 0; i < maxIncompleteTokensFixRounds; i++) {
        const newTokens = fillInIncompleteTokensOnce(tokens);
        if (newTokens) {
            tokens = newTokens;
        }
        else {
            break;
        }
    }
    return tokens;
}
function fillInIncompleteTokensOnce(tokens) {
    let i;
    let newTokens;
    for (i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.type === 'paragraph' && token.raw.match(/(\n|^)\|/)) {
            newTokens = completeTable(tokens.slice(i));
            break;
        }
    }
    const lastToken = tokens.at(-1);
    if (!newTokens && lastToken?.type === 'list') {
        const newListToken = completeListItemPattern(lastToken);
        if (newListToken) {
            newTokens = [newListToken];
            i = tokens.length - 1;
        }
    }
    if (!newTokens && lastToken?.type === 'paragraph') {
        // Only operates on a single token, because any newline that follows this should break these patterns
        const newToken = completeSingleLinePattern(lastToken);
        if (newToken) {
            newTokens = [newToken];
            i = tokens.length - 1;
        }
    }
    if (newTokens) {
        const newTokensList = [
            ...tokens.slice(0, i),
            ...newTokens
        ];
        newTokensList.links = tokens.links;
        return newTokensList;
    }
    if (lastToken?.type === 'heading') {
        const completeTokens = completeHeading(lastToken, mergeRawTokenText(tokens));
        if (completeTokens) {
            return completeTokens;
        }
    }
    return null;
}
function completeCodespan(token) {
    return completeWithString(token, '`');
}
function completeStar(tokens) {
    return completeWithString(tokens, '*');
}
function completeUnderscore(tokens) {
    return completeWithString(tokens, '_');
}
function completeLinkTarget(tokens) {
    return completeWithString(tokens, ')', false);
}
function completeLinkTargetArg(tokens) {
    return completeWithString(tokens, '")', false);
}
function completeLinkText(tokens) {
    return completeWithString(tokens, '](https://microsoft.com)', false);
}
function completeDoublestar(tokens) {
    return completeWithString(tokens, '**');
}
function completeDoubleUnderscore(tokens) {
    return completeWithString(tokens, '__');
}
function completeWithString(tokens, closingString, shouldTrim = true) {
    const mergedRawText = mergeRawTokenText(Array.isArray(tokens) ? tokens : [tokens]);
    // If it was completed correctly, this should be a single token.
    // Expecting either a Paragraph or a List
    const trimmedRawText = shouldTrim ? mergedRawText.trimEnd() : mergedRawText;
    return marked.lexer(trimmedRawText + closingString)[0];
}
function completeTable(tokens) {
    const mergedRawText = mergeRawTokenText(tokens);
    const lines = mergedRawText.split('\n');
    let numCols; // The number of line1 col headers
    let hasSeparatorRow = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (typeof numCols === 'undefined' && line.match(/^\s*\|/)) {
            const line1Matches = line.match(/(\|[^\|]+)(?=\||$)/g);
            if (line1Matches) {
                numCols = line1Matches.length;
            }
        }
        else if (typeof numCols === 'number') {
            if (line.match(/^\s*\|/)) {
                if (i !== lines.length - 1) {
                    // We got the line1 header row, and the line2 separator row, but there are more lines, and it wasn't parsed as a table!
                    // That's strange and means that the table is probably malformed in the source, so I won't try to patch it up.
                    return undefined;
                }
                // Got a line2 separator row- partial or complete, doesn't matter, we'll replace it with a correct one
                hasSeparatorRow = true;
            }
            else {
                // The line after the header row isn't a valid separator row, so the table is malformed, don't fix it up
                return undefined;
            }
        }
    }
    if (typeof numCols === 'number' && numCols > 0) {
        const prefixText = hasSeparatorRow ? lines.slice(0, -1).join('\n') : mergedRawText;
        const line1EndsInPipe = !!prefixText.match(/\|\s*$/);
        const newRawText = prefixText + (line1EndsInPipe ? '' : '|') + `\n|${' --- |'.repeat(numCols)}`;
        return marked.lexer(newRawText);
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFya2Rvd25SZW5kZXJlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUN4RCxPQUFPLEVBQUUsa0JBQWtCLEVBQWlELHNCQUFzQixFQUFFLHFCQUFxQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDNUosT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDckUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFFNUQsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ3pDLE9BQU8sRUFBRSxlQUFlLEVBQWUsTUFBTSx3QkFBd0IsQ0FBQztBQUN0RSxPQUFPLEtBQUssTUFBTSxNQUFNLDRCQUE0QixDQUFDO0FBQ3JELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQzNELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUN0RCxPQUFPLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQzlELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLGtCQUFrQixDQUFDO0FBQ3RELE9BQU8sS0FBSyxHQUFHLE1BQU0sVUFBVSxDQUFDO0FBQ2hDLE9BQU8sS0FBSyxXQUFXLE1BQU0sa0JBQWtCLENBQUM7QUFDaEQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0JBQWtCLENB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