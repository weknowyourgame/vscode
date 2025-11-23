/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as dom from '../../dom.js';
import { getBaseLayerHoverDelegate } from '../hover/hoverDelegate2.js';
import { getDefaultHoverDelegate } from '../hover/hoverDelegateFactory.js';
import { renderLabelWithIcons } from '../iconLabel/iconLabels.js';
import { Disposable } from '../../../common/lifecycle.js';
import * as objects from '../../../common/objects.js';
/**
 * A widget which can render a label with substring highlights, often
 * originating from a filter function like the fuzzy matcher.
 */
export class HighlightedLabel extends Disposable {
    /**
     * Create a new {@link HighlightedLabel}.
     *
     * @param container The parent container to append to.
     */
    constructor(container, options) {
        super();
        this.options = options;
        this.text = '';
        this.title = '';
        this.highlights = [];
        this.didEverRender = false;
        this.domNode = dom.append(container, dom.$('span.monaco-highlighted-label'));
    }
    /**
     * The label's DOM node.
     */
    get element() {
        return this.domNode;
    }
    /**
     * Set the label and highlights.
     *
     * @param text The label to display.
     * @param highlights The ranges to highlight.
     * @param title An optional title for the hover tooltip.
     * @param escapeNewLines Whether to escape new lines.
     * @returns
     */
    set(text, highlights = [], title = '', escapeNewLines, supportIcons) {
        if (!text) {
            text = '';
        }
        if (escapeNewLines) {
            // adjusts highlights inplace
            text = HighlightedLabel.escapeNewLines(text, highlights);
        }
        if (this.didEverRender && this.text === text && this.title === title && objects.equals(this.highlights, highlights)) {
            return;
        }
        this.text = text;
        this.title = title;
        this.highlights = highlights;
        this.render(supportIcons);
    }
    render(supportIcons) {
        const children = [];
        let pos = 0;
        for (const highlight of this.highlights) {
            if (highlight.end === highlight.start) {
                continue;
            }
            if (pos < highlight.start) {
                const substring = this.text.substring(pos, highlight.start);
                if (supportIcons) {
                    children.push(...renderLabelWithIcons(substring));
                }
                else {
                    children.push(substring);
                }
                pos = highlight.start;
            }
            const substring = this.text.substring(pos, highlight.end);
            const element = dom.$('span.highlight', undefined, ...supportIcons ? renderLabelWithIcons(substring) : [substring]);
            if (highlight.extraClasses) {
                element.classList.add(...highlight.extraClasses);
            }
            children.push(element);
            pos = highlight.end;
        }
        if (pos < this.text.length) {
            const substring = this.text.substring(pos);
            if (supportIcons) {
                children.push(...renderLabelWithIcons(substring));
            }
            else {
                children.push(substring);
            }
        }
        dom.reset(this.domNode, ...children);
        if (!this.customHover && this.title !== '') {
            const hoverDelegate = this.options?.hoverDelegate ?? getDefaultHoverDelegate('mouse');
            this.customHover = this._register(getBaseLayerHoverDelegate().setupManagedHover(hoverDelegate, this.domNode, this.title));
        }
        else if (this.customHover) {
            this.customHover.update(this.title);
        }
        this.didEverRender = true;
    }
    static escapeNewLines(text, highlights) {
        let total = 0;
        let extra = 0;
        return text.replace(/\r\n|\r|\n/g, (match, offset) => {
            extra = match === '\r\n' ? -1 : 0;
            offset += total;
            for (const highlight of highlights) {
                if (highlight.end <= offset) {
                    continue;
                }
                if (highlight.start >= offset) {
                    highlight.start += extra;
                }
                if (highlight.end >= offset) {
                    highlight.end += extra;
                }
            }
            total += extra;
            return '\u23CE';
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGlnaGxpZ2h0ZWRMYWJlbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2Jyb3dzZXIvdWkvaGlnaGxpZ2h0ZWRsYWJlbC9oaWdobGlnaHRlZExhYmVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sY0FBYyxDQUFDO0FBR3BDLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ3ZFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ2xFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMxRCxPQUFPLEtBQUssT0FBTyxNQUFNLDRCQUE0QixDQUFDO0FBZXREOzs7R0FHRztBQUNILE1BQU0sT0FBTyxnQkFBaUIsU0FBUSxVQUFVO0lBUy9DOzs7O09BSUc7SUFDSCxZQUFZLFNBQXNCLEVBQW1CLE9BQWtDO1FBQ3RGLEtBQUssRUFBRSxDQUFDO1FBRDRDLFlBQU8sR0FBUCxPQUFPLENBQTJCO1FBWC9FLFNBQUksR0FBVyxFQUFFLENBQUM7UUFDbEIsVUFBSyxHQUFXLEVBQUUsQ0FBQztRQUNuQixlQUFVLEdBQTBCLEVBQUUsQ0FBQztRQUN2QyxrQkFBYSxHQUFZLEtBQUssQ0FBQztRQVd0QyxJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsK0JBQStCLENBQUMsQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksT0FBTztRQUNWLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQztJQUNyQixDQUFDO0lBRUQ7Ozs7Ozs7O09BUUc7SUFDSCxHQUFHLENBQUMsSUFB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