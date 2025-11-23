/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { importAMDNodeModule, resolveAmdNodeModulePath } from '../../../../amdX.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { katexContainerLatexAttributeName, MarkedKatexExtension } from '../common/markedKatexExtension.js';
export class MarkedKatexSupport {
    static getSanitizerOptions(baseConfig) {
        return {
            allowedTags: {
                override: [
                    ...baseConfig.allowedTags,
                    ...trustedMathMlTags,
                ]
            },
            allowedAttributes: {
                override: [
                    ...baseConfig.allowedAttributes,
                    // Math
                    'stretchy',
                    'encoding',
                    'accent',
                    katexContainerLatexAttributeName,
                    // SVG
                    'd',
                    'viewBox',
                    'preserveAspectRatio',
                    // Allow all classes since we don't have a list of allowed katex classes
                    'class',
                    // Sanitize allowed styles for katex
                    {
                        attributeName: 'style',
                        shouldKeep: (_el, data) => this.sanitizeKatexStyles(data.attrValue),
                    },
                ]
            },
        };
    }
    static { this.tempSanitizerRule = new Lazy(() => {
        // Create a CSSStyleDeclaration object via a style sheet rule
        const styleSheet = new CSSStyleSheet();
        styleSheet.insertRule(`.temp{}`);
        const rule = styleSheet.cssRules[0];
        if (!(rule instanceof CSSStyleRule)) {
            throw new Error('Invalid CSS rule');
        }
        return rule.style;
    }); }
    static sanitizeStyles(styleString, allowedProperties) {
        const style = this.tempSanitizerRule.value;
        style.cssText = styleString;
        const sanitizedProps = [];
        for (let i = 0; i < style.length; i++) {
            const prop = style[i];
            if (allowedProperties.includes(prop)) {
                const value = style.getPropertyValue(prop);
                // Allow through lists of numbers with units or bare words like 'block'
                // Main goal is to block things like 'url()'.
                if (/^(([\d\.\-]+\w*\s?)+|\w+)$/.test(value)) {
                    sanitizedProps.push(`${prop}: ${value}`);
                }
            }
        }
        return sanitizedProps.join('; ');
    }
    static sanitizeKatexStyles(styleString) {
        const allowedProperties = [
            'display',
            'position',
            'font-family',
            'font-style',
            'font-weight',
            'font-size',
            'height',
            'min-height',
            'max-height',
            'width',
            'min-width',
            'max-width',
            'margin',
            'margin-top',
            'margin-right',
            'margin-bottom',
            'margin-left',
            'padding',
            'padding-top',
            'padding-right',
            'padding-bottom',
            'padding-left',
            'top',
            'left',
            'right',
            'bottom',
            'vertical-align',
            'transform',
            'border',
            'border-top-width',
            'border-right-width',
            'border-bottom-width',
            'border-left-width',
            'color',
            'white-space',
            'text-align',
            'line-height',
            'float',
            'clear',
        ];
        return this.sanitizeStyles(styleString, allowedProperties);
    }
    static { this._katexPromise = new Lazy(async () => {
        this._katex = await importAMDNodeModule('katex', 'dist/katex.min.js');
        return this._katex;
    }); }
    static getExtension(window, options = {}) {
        if (!this._katex) {
            return undefined;
        }
        this.ensureKatexStyles(window);
        return MarkedKatexExtension.extension(this._katex, options);
    }
    static async loadExtension(window, options = {}) {
        const katex = await this._katexPromise.value;
        this.ensureKatexStyles(window);
        return MarkedKatexExtension.extension(katex, options);
    }
    static ensureKatexStyles(window) {
        const doc = window.document;
        // eslint-disable-next-line no-restricted-syntax
        if (!doc.querySelector('link.katex')) {
            const katexStyle = document.createElement('link');
            katexStyle.classList.add('katex');
            katexStyle.rel = 'stylesheet';
            katexStyle.href = resolveAmdNodeModulePath('katex', 'dist/katex.min.css');
            doc.head.appendChild(katexStyle);
        }
    }
}
const trustedMathMlTags = Object.freeze([
    'semantics',
    'annotation',
    'math',
    'menclose',
    'merror',
    'mfenced',
    'mfrac',
    'mglyph',
    'mi',
    'mlabeledtr',
    'mmultiscripts',
    'mn',
    'mo',
    'mover',
    'mpadded',
    'mphantom',
    'mroot',
    'mrow',
    'ms',
    'mspace',
    'msqrt',
    'mstyle',
    'msub',
    'msup',
    'msubsup',
    'mtable',
    'mtd',
    'mtext',
    'mtr',
    'munder',
    'munderover',
    'mprescripts',
    // svg tags
    'svg',
    'altglyph',
    'altglyphdef',
    'altglyphitem',
    'circle',
    'clippath',
    'defs',
    'desc',
    'ellipse',
    'filter',
    'font',
    'g',
    'glyph',
    'glyphref',
    'hkern',
    'line',
    'lineargradient',
    'marker',
    'mask',
    'metadata',
    'mpath',
    'path',
    'pattern',
    'polygon',
    'polyline',
    'radialgradient',
    'rect',
    'stop',
    'style',
    'switch',
    'symbol',
    'text',
    'textpath',
    'title',
    'tref',
    'tspan',
    'view',
    'vkern',
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFya2VkS2F0ZXhTdXBwb3J0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL21hcmtkb3duL2Jyb3dzZXIvbWFya2VkS2F0ZXhTdXBwb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBSXBGLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUV2RCxPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUUzRyxNQUFNLE9BQU8sa0JBQWtCO0lBRXZCLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxVQUdqQztRQUNBLE9BQU87WUFDTixXQUFXLEVBQUU7Z0JBQ1osUUFBUSxFQUFFO29CQUNULEdBQUcsVUFBVSxDQUFDLFdBQVc7b0JBQ3pCLEdBQUcsaUJBQWlCO2lCQUNwQjthQUNEO1lBQ0QsaUJBQWlCLEVBQUU7Z0JBQ2xCLFFBQVEsRUFBRTtvQkFDVCxHQUFHLFVBQVUsQ0FBQyxpQkFBaUI7b0JBRS9CLE9BQU87b0JBQ1AsVUFBVTtvQkFDVixVQUFVO29CQUNWLFFBQVE7b0JBQ1IsZ0NBQWdDO29CQUVoQyxNQUFNO29CQUNOLEdBQUc7b0JBQ0gsU0FBUztvQkFDVCxxQkFBcUI7b0JBRXJCLHdFQUF3RTtvQkFDeEUsT0FBTztvQkFFUCxvQ0FBb0M7b0JBQ3BDO3dCQUNDLGFBQWEsRUFBRSxPQUFPO3dCQUN0QixVQUFVLEVBQUUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztxQkFDbkU7aUJBQ0Q7YUFDRDtTQUNELENBQUM7SUFDSCxDQUFDO2FBRWMsc0JBQWlCLEdBQUcsSUFB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