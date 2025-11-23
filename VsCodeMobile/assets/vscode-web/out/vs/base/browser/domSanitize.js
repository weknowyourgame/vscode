/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Schemas } from '../common/network.js';
import { reset } from './dom.js';
// eslint-disable-next-line no-restricted-imports
import dompurify from './dompurify/dompurify.js';
/**
 * List of safe, non-input html tags.
 */
export const basicMarkupHtmlTags = Object.freeze([
    'a',
    'abbr',
    'b',
    'bdo',
    'blockquote',
    'br',
    'caption',
    'cite',
    'code',
    'col',
    'colgroup',
    'dd',
    'del',
    'details',
    'dfn',
    'div',
    'dl',
    'dt',
    'em',
    'figcaption',
    'figure',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'img',
    'ins',
    'kbd',
    'label',
    'li',
    'mark',
    'ol',
    'p',
    'pre',
    'q',
    'rp',
    'rt',
    'ruby',
    's',
    'samp',
    'small',
    'small',
    'source',
    'span',
    'strike',
    'strong',
    'sub',
    'summary',
    'sup',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'time',
    'tr',
    'tt',
    'u',
    'ul',
    'var',
    'video',
    'wbr',
]);
export const defaultAllowedAttrs = Object.freeze([
    'href',
    'target',
    'src',
    'alt',
    'title',
    'for',
    'name',
    'role',
    'tabindex',
    'x-dispatch',
    'required',
    'checked',
    'placeholder',
    'type',
    'start',
    'width',
    'height',
    'align',
]);
const fakeRelativeUrlProtocol = 'vscode-relative-path';
function validateLink(value, allowedProtocols) {
    if (allowedProtocols.override === '*') {
        return true; // allow all protocols
    }
    try {
        const url = new URL(value, fakeRelativeUrlProtocol + '://');
        if (allowedProtocols.override.includes(url.protocol.replace(/:$/, ''))) {
            return true;
        }
        if (allowedProtocols.allowRelativePaths
            && url.protocol === fakeRelativeUrlProtocol + ':'
            && !value.trim().toLowerCase().startsWith(fakeRelativeUrlProtocol)) {
            return true;
        }
        return false;
    }
    catch (e) {
        return false;
    }
}
/**
 * Hooks dompurify using `afterSanitizeAttributes` to check that all `href` and `src`
 * attributes are valid.
 */
function hookDomPurifyHrefAndSrcSanitizer(allowedLinkProtocols, allowedMediaProtocols) {
    dompurify.addHook('afterSanitizeAttributes', (node) => {
        // check all href/src attributes for validity
        for (const attr of ['href', 'src']) {
            if (node.hasAttribute(attr)) {
                const attrValue = node.getAttribute(attr);
                if (attr === 'href') {
                    if (!attrValue.startsWith('#') && !validateLink(attrValue, allowedLinkProtocols)) {
                        node.removeAttribute(attr);
                    }
                }
                else { // 'src'
                    if (!validateLink(attrValue, allowedMediaProtocols)) {
                        node.removeAttribute(attr);
                    }
                }
            }
        }
    });
}
const defaultDomPurifyConfig = Object.freeze({
    ALLOWED_TAGS: [...basicMarkupHtmlTags],
    ALLOWED_ATTR: [...defaultAllowedAttrs],
    // We sanitize the src/href attributes later if needed
    ALLOW_UNKNOWN_PROTOCOLS: true,
});
/**
 * Sanitizes an html string.
 *
 * @param untrusted The HTML string to sanitize.
 * @param config Optional configuration for sanitization. If not provided, defaults to a safe configuration.
 *
 * @returns A sanitized string of html.
 */
export function sanitizeHtml(untrusted, config) {
    return doSanitizeHtml(untrusted, config, 'trusted');
}
function doSanitizeHtml(untrusted, config, outputType) {
    try {
        const resolvedConfig = { ...defaultDomPurifyConfig };
        if (config?.allowedTags) {
            if (config.allowedTags.override) {
                resolvedConfig.ALLOWED_TAGS = [...config.allowedTags.override];
            }
            if (config.allowedTags.augment) {
                resolvedConfig.ALLOWED_TAGS = [...(resolvedConfig.ALLOWED_TAGS ?? []), ...config.allowedTags.augment];
            }
        }
        let resolvedAttributes = [...defaultAllowedAttrs];
        if (config?.allowedAttributes) {
            if (config.allowedAttributes.override) {
                resolvedAttributes = [...config.allowedAttributes.override];
            }
            if (config.allowedAttributes.augment) {
                resolvedAttributes = [...resolvedAttributes, ...config.allowedAttributes.augment];
            }
        }
        // All attr names are lower-case in the sanitizer hooks
        resolvedAttributes = resolvedAttributes.map((attr) => {
            if (typeof attr === 'string') {
                return attr.toLowerCase();
            }
            return {
                attributeName: attr.attributeName.toLowerCase(),
                shouldKeep: attr.shouldKeep,
            };
        });
        const allowedAttrNames = new Set(resolvedAttributes.map(attr => typeof attr === 'string' ? attr : attr.attributeName));
        const allowedAttrPredicates = new Map();
        for (const attr of resolvedAttributes) {
            if (typeof attr === 'string') {
                // New string attribute value clears previously set predicates
                allowedAttrPredicates.delete(attr);
            }
            else {
                allowedAttrPredicates.set(attr.attributeName, attr);
            }
        }
        resolvedConfig.ALLOWED_ATTR = Array.from(allowedAttrNames);
        hookDomPurifyHrefAndSrcSanitizer({
            override: config?.allowedLinkProtocols?.override ?? [Schemas.http, Schemas.https],
            allowRelativePaths: config?.allowRelativeLinkPaths ?? false
        }, {
            override: config?.allowedMediaProtocols?.override ?? [Schemas.http, Schemas.https],
            allowRelativePaths: config?.allowRelativeMediaPaths ?? false
        });
        if (config?.replaceWithPlaintext) {
            dompurify.addHook('uponSanitizeElement', replaceWithPlainTextHook);
        }
        if (allowedAttrPredicates.size) {
            dompurify.addHook('uponSanitizeAttribute', (node, e) => {
                const predicate = allowedAttrPredicates.get(e.attrName);
                if (predicate) {
                    const result = predicate.shouldKeep(node, e);
                    if (typeof result === 'string') {
                        e.keepAttr = true;
                        e.attrValue = result;
                    }
                    else {
                        e.keepAttr = result;
                    }
                }
                else {
                    e.keepAttr = allowedAttrNames.has(e.attrName);
                }
            });
        }
        if (outputType === 'dom') {
            return dompurify.sanitize(untrusted, {
                ...resolvedConfig,
                RETURN_DOM_FRAGMENT: true
            });
        }
        else {
            return dompurify.sanitize(untrusted, {
                ...resolvedConfig,
                RETURN_TRUSTED_TYPE: true
            }); // Cast from lib TrustedHTML to global TrustedHTML
        }
    }
    finally {
        dompurify.removeAllHooks();
    }
}
const selfClosingTags = ['area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
const replaceWithPlainTextHook = (node, data, _config) => {
    if (!data.allowedTags[data.tagName] && data.tagName !== 'body') {
        const replacement = convertTagToPlaintext(node);
        if (replacement) {
            if (node.nodeType === Node.COMMENT_NODE) {
                // Workaround for https://github.com/cure53/DOMPurify/issues/1005
                // The comment will be deleted in the next phase. However if we try to remove it now, it will cause
                // an exception. Instead we insert the text node before the comment.
                node.parentElement?.insertBefore(replacement, node);
            }
            else {
                node.parentElement?.replaceChild(replacement, node);
            }
        }
    }
};
export function convertTagToPlaintext(node) {
    if (!node.ownerDocument) {
        return;
    }
    let startTagText;
    let endTagText;
    if (node.nodeType === Node.COMMENT_NODE) {
        startTagText = `<!--${node.textContent}-->`;
    }
    else if (node instanceof Element) {
        const tagName = node.tagName.toLowerCase();
        const isSelfClosing = selfClosingTags.includes(tagName);
        const attrString = node.attributes.length ?
            ' ' + Array.from(node.attributes)
                .map(attr => `${attr.name}="${attr.value}"`)
                .join(' ')
            : '';
        startTagText = `<${tagName}${attrString}>`;
        if (!isSelfClosing) {
            endTagText = `</${tagName}>`;
        }
    }
    else {
        return;
    }
    const fragment = document.createDocumentFragment();
    const textNode = node.ownerDocument.createTextNode(startTagText);
    fragment.appendChild(textNode);
    while (node.firstChild) {
        fragment.appendChild(node.firstChild);
    }
    const endTagTextNode = endTagText ? node.ownerDocument.createTextNode(endTagText) : undefined;
    if (endTagTextNode) {
        fragment.appendChild(endTagTextNode);
    }
    return fragment;
}
/**
 * Sanitizes the given `value` and reset the given `node` with it.
 */
export function safeSetInnerHtml(node, untrusted, config) {
    const fragment = doSanitizeHtml(untrusted, config, 'dom');
    reset(node, fragment);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9tU2FuaXRpemUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9icm93c2VyL2RvbVNhbml0aXplLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUMvQyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQ2pDLGlEQUFpRDtBQUNqRCxPQUFPLFNBQThCLE1BQU0sMEJBQTBCLENBQUM7QUFFdEU7O0dBRUc7QUFDSCxNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ2hELEdBQUc7SUFDSCxNQUFNO0lBQ04sR0FBRztJQUNILEtBQUs7SUFDTCxZQUFZO0lBQ1osSUFBSTtJQUNKLFNBQVM7SUFDVCxNQUFNO0lBQ04sTUFBTTtJQUNOLEtBQUs7SUFDTCxVQUFVO0lBQ1YsSUFBSTtJQUNKLEtBQUs7SUFDTCxTQUFTO0lBQ1QsS0FBSztJQUNMLEtBQUs7SUFDTCxJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixZQUFZO0lBQ1osUUFBUTtJQUNSLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixHQUFHO0lBQ0gsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0wsT0FBTztJQUNQLElBQUk7SUFDSixNQUFNO0lBQ04sSUFBSTtJQUNKLEdBQUc7SUFDSCxLQUFLO0lBQ0wsR0FBRztJQUNILElBQUk7SUFDSixJQUFJO0lBQ0osTUFBTTtJQUNOLEdBQUc7SUFDSCxNQUFNO0lBQ04sT0FBTztJQUNQLE9BQU87SUFDUCxRQUFRO0lBQ1IsTUFBTTtJQUNOLFFBQVE7SUFDUixRQUFRO0lBQ1IsS0FBSztJQUNMLFNBQVM7SUFDVCxLQUFLO0lBQ0wsT0FB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