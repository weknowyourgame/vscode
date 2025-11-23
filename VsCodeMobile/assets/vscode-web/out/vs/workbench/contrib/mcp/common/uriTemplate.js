/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Represents an RFC 6570 URI Template.
 */
export class UriTemplate {
    constructor(template, components) {
        this.template = template;
        this.template = template;
        this.components = components;
    }
    /**
     * Parses a URI template string into a UriTemplate instance.
     */
    static parse(template) {
        const components = [];
        const regex = /\{([^{}]+)\}/g;
        let match;
        let lastPos = 0;
        while ((match = regex.exec(template))) {
            const [expression, inner] = match;
            components.push(template.slice(lastPos, match.index));
            lastPos = match.index + expression.length;
            // Handle escaped braces: treat '{{' and '}}' as literals, not expressions
            if (template[match.index - 1] === '{' || template[lastPos] === '}') {
                components.push(inner);
                continue;
            }
            let operator = '';
            let rest = inner;
            if (rest.length > 0 && UriTemplate._isOperator(rest[0])) {
                operator = rest[0];
                rest = rest.slice(1);
            }
            const variables = rest.split(',').map((v) => {
                let name = v;
                let explodable = false;
                let repeatable = false;
                let prefixLength = undefined;
                let optional = false;
                if (name.endsWith('*')) {
                    explodable = true;
                    repeatable = true;
                    name = name.slice(0, -1);
                }
                const prefixMatch = name.match(/^(.*?):(\d+)$/);
                if (prefixMatch) {
                    name = prefixMatch[1];
                    prefixLength = parseInt(prefixMatch[2], 10);
                }
                if (name.endsWith('?')) {
                    optional = true;
                    name = name.slice(0, -1);
                }
                return { explodable, name, optional, prefixLength, repeatable };
            });
            components.push({ expression, operator, variables });
        }
        components.push(template.slice(lastPos));
        return new UriTemplate(template, components);
    }
    static { this._operators = ['+', '#', '.', '/', ';', '?', '&']; }
    static _isOperator(ch) {
        return UriTemplate._operators.includes(ch);
    }
    /**
     * Resolves the template with the given variables.
     */
    resolve(variables) {
        let result = '';
        for (const comp of this.components) {
            if (typeof comp === 'string') {
                result += comp;
            }
            else {
                result += this._expand(comp, variables);
            }
        }
        return result;
    }
    _expand(comp, variables) {
        const op = comp.operator;
        const varSpecs = comp.variables;
        if (varSpecs.length === 0) {
            return comp.expression;
        }
        const vals = [];
        const isNamed = op === ';' || op === '?' || op === '&';
        const isReserved = op === '+' || op === '#';
        const isFragment = op === '#';
        const isLabel = op === '.';
        const isPath = op === '/';
        const isForm = op === '?';
        const isFormCont = op === '&';
        const isParam = op === ';';
        let prefix = '';
        if (op === '+') {
            prefix = '';
        }
        else if (op === '#') {
            prefix = '#';
        }
        else if (op === '.') {
            prefix = '.';
        }
        else if (op === '/') {
            prefix = '';
        }
        else if (op === ';') {
            prefix = ';';
        }
        else if (op === '?') {
            prefix = '?';
        }
        else if (op === '&') {
            prefix = '&';
        }
        for (const v of varSpecs) {
            const value = variables[v.name];
            const defined = Object.prototype.hasOwnProperty.call(variables, v.name);
            if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
                if (isParam) {
                    if (defined && (value === null || value === undefined)) {
                        vals.push(v.name);
                    }
                    continue;
                }
                if (isForm || isFormCont) {
                    if (defined) {
                        vals.push(UriTemplate._formPair(v.name, '', isNamed));
                    }
                    continue;
                }
                continue;
            }
            if (typeof value === 'object' && !Array.isArray(value)) {
                if (v.explodable) {
                    const pairs = [];
                    for (const k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            const thisVal = String(value[k]);
                            if (isParam) {
                                pairs.push(k + '=' + thisVal);
                            }
                            else if (isForm || isFormCont) {
                                pairs.push(k + '=' + thisVal);
                            }
                            else if (isLabel) {
                                pairs.push(k + '=' + thisVal);
                            }
                            else if (isPath) {
                                pairs.push('/' + k + '=' + UriTemplate._encode(thisVal, isReserved));
                            }
                            else {
                                pairs.push(k + '=' + UriTemplate._encode(thisVal, isReserved));
                            }
                        }
                    }
                    if (isLabel) {
                        vals.push(pairs.join('.'));
                    }
                    else if (isPath) {
                        vals.push(pairs.join(''));
                    }
                    else if (isParam) {
                        vals.push(pairs.join(';'));
                    }
                    else if (isForm || isFormCont) {
                        vals.push(pairs.join('&'));
                    }
                    else {
                        vals.push(pairs.join(','));
                    }
                }
                else {
                    // Not explodable: join as k1,v1,k2,v2,... and assign to variable name
                    const pairs = [];
                    for (const k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            pairs.push(k);
                            pairs.push(String(value[k]));
                        }
                    }
                    // For label, param, form, join as keys=semi,;,dot,.,comma,, (no encoding of , or ;)
                    const joined = pairs.join(',');
                    if (isLabel) {
                        vals.push(joined);
                    }
                    else if (isParam || isForm || isFormCont) {
                        vals.push(v.name + '=' + joined);
                    }
                    else {
                        vals.push(joined);
                    }
                }
                continue;
            }
            if (Array.isArray(value)) {
                if (v.explodable) {
                    if (isLabel) {
                        vals.push(value.join('.'));
                    }
                    else if (isPath) {
                        vals.push(value.map(x => '/' + UriTemplate._encode(x, isReserved)).join(''));
                    }
                    else if (isParam) {
                        vals.push(value.map(x => v.name + '=' + String(x)).join(';'));
                    }
                    else if (isForm || isFormCont) {
                        vals.push(value.map(x => v.name + '=' + String(x)).join('&'));
                    }
                    else {
                        vals.push(value.map(x => UriTemplate._encode(x, isReserved)).join(','));
                    }
                }
                else {
                    if (isLabel) {
                        vals.push(value.join(','));
                    }
                    else if (isParam) {
                        vals.push(v.name + '=' + value.join(','));
                    }
                    else if (isForm || isFormCont) {
                        vals.push(v.name + '=' + value.join(','));
                    }
                    else {
                        vals.push(value.map(x => UriTemplate._encode(x, isReserved)).join(','));
                    }
                }
                continue;
            }
            let str = String(value);
            if (v.prefixLength !== undefined) {
                str = str.substring(0, v.prefixLength);
            }
            // For simple expansion, encode ! as well (not reserved)
            // Only + and # are reserved
            const enc = UriTemplate._encode(str, op === '+' || op === '#');
            if (isParam) {
                vals.push(v.name + '=' + enc);
            }
            else if (isForm || isFormCont) {
                vals.push(v.name + '=' + enc);
            }
            else if (isLabel) {
                vals.push(enc);
            }
            else if (isPath) {
                vals.push('/' + enc);
            }
            else {
                vals.push(enc);
            }
        }
        let joined = '';
        if (isLabel) {
            // Remove trailing dot for missing values
            const filtered = vals.filter(v => v !== '');
            joined = filtered.length ? prefix + filtered.join('.') : '';
        }
        else if (isPath) {
            // Remove empty segments for undefined/null
            const filtered = vals.filter(v => v !== '');
            joined = filtered.length ? filtered.join('') : '';
            if (joined && !joined.startsWith('/')) {
                joined = '/' + joined;
            }
        }
        else if (isParam) {
            // For param, if value is empty string, just append ;name
            joined = vals.length ? prefix + vals.map(v => v.replace(/=\s*$/, '')).join(';') : '';
        }
        else if (isForm) {
            joined = vals.length ? prefix + vals.join('&') : '';
        }
        else if (isFormCont) {
            joined = vals.length ? prefix + vals.join('&') : '';
        }
        else if (isFragment) {
            joined = prefix + vals.join(',');
        }
        else if (isReserved) {
            joined = vals.join(',');
        }
        else {
            joined = vals.join(',');
        }
        return joined;
    }
    static _encode(str, reserved) {
        return reserved ? encodeURI(str) : pctEncode(str);
    }
    static _formPair(k, v, named) {
        return named ? k + '=' + encodeURIComponent(String(v)) : encodeURIComponent(String(v));
    }
}
function pctEncode(str) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i);
        if (
        // alphanum ranges:
        (chr >= 0x30 && chr <= 0x39 || chr >= 0x41 && chr <= 0x5a || chr >= 0x61 && chr <= 0x7a) ||
            // unreserved characters:
            (chr === 0x2d || chr === 0x2e || chr === 0x5f || chr === 0x7e)) {
            out += str[i];
        }
        else {
            out += '%' + chr.toString(16).toUpperCase();
        }
    }
    return out;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXJpVGVtcGxhdGUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2NvbW1vbi91cmlUZW1wbGF0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQWdCaEc7O0dBRUc7QUFDSCxNQUFNLE9BQU8sV0FBVztJQU12QixZQUNpQixRQUFnQixFQUNoQyxVQUF5RDtRQUR6QyxhQUFRLEdBQVIsUUFBUSxDQUFRO1FBR2hDLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO0lBQzlCLENBQUM7SUFFRDs7T0FFRztJQUNJLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBZ0I7UUFDbkMsTUFBTSxVQUFVLEdBQTBDLEVBQUUsQ0FBQztRQUM3RCxNQUFNLEtBQUssR0FBRyxlQUFlLENBQUM7UUFDOUIsSUFBSSxLQUE2QixDQUFDO1FBQ2xDLElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQztRQUNoQixPQUFPLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ3ZDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDO1lBQ2xDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDdEQsT0FBTyxHQUFHLEtBQUssQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQztZQUUxQywwRUFBMEU7WUFDMUUsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLElBQUksUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO2dCQUNw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