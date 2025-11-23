/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
//#region Types
import { URI } from '../../../base/common/uri.js';
function createNodeTree(nodes) {
    if (nodes.length === 0) {
        return null;
    }
    // Create a map of node IDs to their corresponding nodes for quick lookup
    const nodeLookup = new Map();
    for (const node of nodes) {
        nodeLookup.set(node.nodeId, node);
    }
    // Helper function to get all non-ignored descendants of a node
    function getNonIgnoredDescendants(nodeId) {
        const node = nodeLookup.get(nodeId);
        if (!node || !node.childIds) {
            return [];
        }
        const result = [];
        for (const childId of node.childIds) {
            const childNode = nodeLookup.get(childId);
            if (!childNode) {
                continue;
            }
            if (childNode.ignored) {
                // If child is ignored, add its non-ignored descendants instead
                result.push(...getNonIgnoredDescendants(childId));
            }
            else {
                // Otherwise, add the child itself
                result.push(childId);
            }
        }
        return result;
    }
    // Create tree nodes only for non-ignored nodes
    const nodeMap = new Map();
    for (const node of nodes) {
        if (!node.ignored) {
            nodeMap.set(node.nodeId, { node, children: [], parent: null });
        }
    }
    // Establish parent-child relationships, bypassing ignored nodes
    for (const node of nodes) {
        if (node.ignored) {
            continue;
        }
        const treeNode = nodeMap.get(node.nodeId);
        if (node.childIds) {
            for (const childId of node.childIds) {
                const childNode = nodeLookup.get(childId);
                if (!childNode) {
                    continue;
                }
                if (childNode.ignored) {
                    // If child is ignored, connect its non-ignored descendants to this node
                    const nonIgnoredDescendants = getNonIgnoredDescendants(childId);
                    for (const descendantId of nonIgnoredDescendants) {
                        const descendantTreeNode = nodeMap.get(descendantId);
                        if (descendantTreeNode) {
                            descendantTreeNode.parent = treeNode;
                            treeNode.children.push(descendantTreeNode);
                        }
                    }
                }
                else {
                    // Normal case: add non-ignored child directly
                    const childTreeNode = nodeMap.get(childId);
                    if (childTreeNode) {
                        childTreeNode.parent = treeNode;
                        treeNode.children.push(childTreeNode);
                    }
                }
            }
        }
    }
    // Find the root node (a node without a parent)
    for (const node of nodeMap.values()) {
        if (!node.parent) {
            return node;
        }
    }
    return null;
}
/**
 * When possible, we will make sure lines are no longer than 80. This is to help
 * certain pieces of software that can't handle long lines.
 */
const LINE_MAX_LENGTH = 80;
/**
 * Converts an accessibility tree represented by AXNode objects into a markdown string.
 *
 * @param uri The URI of the document
 * @param axNodes The array of AXNode objects representing the accessibility tree
 * @returns A markdown representation of the accessibility tree
 */
export function convertAXTreeToMarkdown(uri, axNodes) {
    const tree = createNodeTree(axNodes);
    if (!tree) {
        return ''; // Return empty string for empty tree
    }
    // Process tree to extract main content and navigation links
    const mainContent = extractMainContent(uri, tree);
    const navLinks = collectNavigationLinks(tree);
    // Combine main content and navigation links
    return mainContent + (navLinks.length > 0 ? '\n\n## Additional Links\n' + navLinks.join('\n') : '');
}
function extractMainContent(uri, tree) {
    const contentBuffer = [];
    processNode(uri, tree, contentBuffer, 0, true);
    return contentBuffer.join('');
}
function processNode(uri, node, buffer, depth, allowWrap) {
    const role = getNodeRole(node.node);
    switch (role) {
        case 'navigation':
            return; // Skip navigation nodes
        case 'heading':
            processHeadingNode(uri, node, buffer, depth);
            return;
        case 'paragraph':
            processParagraphNode(uri, node, buffer, depth, allowWrap);
            return;
        case 'list':
            buffer.push('\n');
            for (const descChild of node.children) {
                processNode(uri, descChild, buffer, depth + 1, true);
            }
            buffer.push('\n');
            return;
        case 'ListMarker':
            // TODO: Should we normalize these ListMarkers to `-` and normal lists?
            buffer.push(getNodeText(node.node, allowWrap));
            return;
        case 'listitem': {
            const tempBuffer = [];
            // Process the children of the list item
            for (const descChild of node.children) {
                processNode(uri, descChild, tempBuffer, depth + 1, true);
            }
            const indent = getLevel(node.node) > 1 ? ' '.repeat(getLevel(node.node)) : '';
            buffer.push(`${indent}${tempBuffer.join('').trim()}\n`);
            return;
        }
        case 'link':
            if (!isNavigationLink(node)) {
                const linkText = getNodeText(node.node, allowWrap);
                const url = getLinkUrl(node.node);
                if (!isSameUriIgnoringQueryAndFragment(uri, node.node)) {
                    buffer.push(`[${linkText}](${url})`);
                }
                else {
                    buffer.push(linkText);
                }
            }
            return;
        case 'StaticText': {
            const staticText = getNodeText(node.node, allowWrap);
            if (staticText) {
                buffer.push(staticText);
            }
            break;
        }
        case 'image': {
            const altText = getNodeText(node.node, allowWrap) || 'Image';
            const imageUrl = getImageUrl(node.node);
            if (imageUrl) {
                buffer.push(`![${altText}](${imageUrl})\n\n`);
            }
            else {
                buffer.push(`[Image: ${altText}]\n\n`);
            }
            break;
        }
        case 'DescriptionList':
            processDescriptionListNode(uri, node, buffer, depth);
            return;
        case 'blockquote':
            buffer.push('> ' + getNodeText(node.node, allowWrap).replace(/\n/g, '\n> ') + '\n\n');
            break;
        // TODO: Is this the correct way to handle the generic role?
        case 'generic':
            buffer.push(' ');
            break;
        case 'code': {
            processCodeNode(uri, node, buffer, depth);
            return;
        }
        case 'pre':
            buffer.push('```\n' + getNodeText(node.node, false) + '\n```\n\n');
            break;
        case 'table':
            processTableNode(node, buffer);
            return;
    }
    // Process children if not already handled in specific cases
    for (const child of node.children) {
        processNode(uri, child, buffer, depth + 1, allowWrap);
    }
}
function getNodeRole(node) {
    return node.role?.value || '';
}
function getNodeText(node, allowWrap) {
    const text = node.name?.value || node.value?.value || '';
    if (!allowWrap) {
        return text;
    }
    if (text.length <= LINE_MAX_LENGTH) {
        return text;
    }
    const chars = text.split('');
    let lastSpaceIndex = -1;
    for (let i = 1; i < chars.length; i++) {
        if (chars[i] === ' ') {
            lastSpaceIndex = i;
        }
        // Check if we reached the line max length, try to break at the last space
        // before the line max length
        if (i % LINE_MAX_LENGTH === 0 && lastSpaceIndex !== -1) {
            // replace the space with a new line
            chars[lastSpaceIndex] = '\n';
            lastSpaceIndex = i;
        }
    }
    return chars.join('');
}
function getLevel(node) {
    const levelProp = node.properties?.find(p => p.name === 'level');
    return levelProp ? Math.min(Number(levelProp.value.value) || 1, 6) : 1;
}
function getLinkUrl(node) {
    // Find URL in properties
    const urlProp = node.properties?.find(p => p.name === 'url');
    return urlProp?.value.value || '#';
}
function getImageUrl(node) {
    // Find URL in properties
    const urlProp = node.properties?.find(p => p.name === 'url');
    return urlProp?.value.value || null;
}
function isNavigationLink(node) {
    // Check if this link is part of navigation
    let current = node;
    while (current) {
        const role = getNodeRole(current.node);
        if (['navigation', 'menu', 'menubar'].includes(role)) {
            return true;
        }
        current = current.parent;
    }
    return false;
}
function isSameUriIgnoringQueryAndFragment(uri, node) {
    // Check if this link is an anchor link
    const link = getLinkUrl(node);
    try {
        const parsed = URI.parse(link);
        return parsed.scheme === uri.scheme && parsed.authority === uri.authority && parsed.path === uri.path;
    }
    catch (e) {
        return false;
    }
}
function processParagraphNode(uri, node, buffer, depth, allowWrap) {
    buffer.push('\n');
    // Process the children of the paragraph
    for (const child of node.children) {
        processNode(uri, child, buffer, depth + 1, allowWrap);
    }
    buffer.push('\n\n');
}
function processHeadingNode(uri, node, buffer, depth) {
    buffer.push('\n');
    const level = getLevel(node.node);
    buffer.push(`${'#'.repeat(level)} `);
    // Process children nodes of the heading
    for (const child of node.children) {
        if (getNodeRole(child.node) === 'StaticText') {
            buffer.push(getNodeText(child.node, false));
        }
        else {
            processNode(uri, child, buffer, depth + 1, false);
        }
    }
    buffer.push('\n\n');
}
function processDescriptionListNode(uri, node, buffer, depth) {
    buffer.push('\n');
    // Process each child of the description list
    for (const child of node.children) {
        if (getNodeRole(child.node) === 'term') {
            buffer.push('- **');
            // Process term nodes
            for (const termChild of child.children) {
                processNode(uri, termChild, buffer, depth + 1, true);
            }
            buffer.push('** ');
        }
        else if (getNodeRole(child.node) === 'definition') {
            // Process description nodes
            for (const descChild of child.children) {
                processNode(uri, descChild, buffer, depth + 1, true);
            }
            buffer.push('\n');
        }
    }
    buffer.push('\n');
}
function isTableCell(role) {
    // Match cell, gridcell, columnheader, rowheader roles
    return role === 'cell' || role === 'gridcell' || role === 'columnheader' || role === 'rowheader';
}
function processTableNode(node, buffer) {
    buffer.push('\n');
    // Find rows
    const rows = node.children.filter(child => getNodeRole(child.node).includes('row'));
    if (rows.length > 0) {
        // First row as header
        const headerCells = rows[0].children.filter(cell => isTableCell(getNodeRole(cell.node)));
        // Generate header row
        const headerContent = headerCells.map(cell => getNodeText(cell.node, false) || ' ');
        buffer.push('| ' + headerContent.join(' | ') + ' |\n');
        // Generate separator row
        buffer.push('| ' + headerCells.map(() => '---').join(' | ') + ' |\n');
        // Generate data rows
        for (let i = 1; i < rows.length; i++) {
            const dataCells = rows[i].children.filter(cell => isTableCell(getNodeRole(cell.node)));
            const rowContent = dataCells.map(cell => getNodeText(cell.node, false) || ' ');
            buffer.push('| ' + rowContent.join(' | ') + ' |\n');
        }
    }
    buffer.push('\n');
}
function processCodeNode(uri, node, buffer, depth) {
    const tempBuffer = [];
    // Process the children of the code node
    for (const child of node.children) {
        processNode(uri, child, tempBuffer, depth + 1, false);
    }
    const isCodeblock = tempBuffer.some(text => text.includes('\n'));
    if (isCodeblock) {
        buffer.push('\n```\n');
        // Append the processed text to the buffer
        buffer.push(tempBuffer.join(''));
        buffer.push('\n```\n');
    }
    else {
        buffer.push('`');
        let characterCount = 0;
        // Append the processed text to the buffer
        for (const tempItem of tempBuffer) {
            characterCount += tempItem.length;
            if (characterCount > LINE_MAX_LENGTH) {
                buffer.push('\n');
                characterCount = 0;
            }
            buffer.push(tempItem);
            buffer.push('`');
        }
    }
}
function collectNavigationLinks(tree) {
    const links = [];
    collectLinks(tree, links);
    return links;
}
function collectLinks(node, links) {
    const role = getNodeRole(node.node);
    if (role === 'link' && isNavigationLink(node)) {
        const linkText = getNodeText(node.node, true);
        const url = getLinkUrl(node.node);
        const description = node.node.description?.value || '';
        links.push(`- [${linkText}](${url})${description ? ' - ' + description : ''}`);
    }
    // Process children
    for (const child of node.children) {
        collectLinks(child, links);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RwQWNjZXNzaWJpbGl0eURvbWFpbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS93ZWJDb250ZW50RXh0cmFjdG9yL2VsZWN0cm9uLW1haW4vY2RwQWNjZXNzaWJpbGl0eURvbWFpbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxlQUFlO0FBRWYsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBd0RsRCxTQUFTLGNBQWMsQ0FBQyxLQUFlO0lBQ3RDLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUN4QixPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCx5RUFBeUU7SUFDekUsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQWtCLENBQUM7SUFDN0MsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQztRQUMxQixVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUVELCtEQUErRDtJQUMvRCxTQUFTLHdCQUF3QixDQUFDLE1BQWM7UUFDL0MsTUFBTSxJQUFJLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNwQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQzdCLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztRQUVELE1BQU0sTUFBTSxHQUFhLEVBQUUsQ0FBQztRQUM1QixLQUFLLE1BQU0sT0FBTyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNyQyxNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzFDLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDaEIs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