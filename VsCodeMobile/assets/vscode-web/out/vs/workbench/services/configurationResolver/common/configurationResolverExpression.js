/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Iterable } from '../../../../base/common/iterator.js';
import { isLinux, isMacintosh, isWindows } from '../../../../base/common/platform.js';
export class ConfigurationResolverExpression {
    static { this.VARIABLE_LHS = '${'; }
    constructor(object) {
        this.locations = new Map();
        /**
         * Callbacks when a new replacement is made, so that nested resolutions from
         * `expr.unresolved()` can be fulfilled in the same iteration.
         */
        this.newReplacementNotifiers = new Set();
        // If the input is a string, wrap it in an object so we can use the same logic
        if (typeof object === 'string') {
            this.stringRoot = true;
            // eslint-disable-next-line local/code-no-any-casts
            this.root = { value: object };
        }
        else {
            this.stringRoot = false;
            this.root = structuredClone(object);
        }
    }
    /**
     * Creates a new {@link ConfigurationResolverExpression} from an object.
     * Note that platform-specific keys (i.e. `windows`, `osx`, `linux`) are
     * applied during parsing.
     */
    static parse(object) {
        if (object instanceof ConfigurationResolverExpression) {
            return object;
        }
        const expr = new ConfigurationResolverExpression(object);
        expr.applyPlatformSpecificKeys();
        expr.parseObject(expr.root);
        return expr;
    }
    applyPlatformSpecificKeys() {
        // eslint-disable-next-line local/code-no-any-casts
        const config = this.root; // already cloned by ctor, safe to change
        const key = isWindows ? 'windows' : isMacintosh ? 'osx' : isLinux ? 'linux' : undefined;
        if (key && config && typeof config === 'object' && config.hasOwnProperty(key)) {
            Object.keys(config[key]).forEach(k => config[k] = config[key][k]);
        }
        delete config.windows;
        delete config.osx;
        delete config.linux;
    }
    parseVariable(str, start) {
        if (str[start] !== '$' || str[start + 1] !== '{') {
            return undefined;
        }
        let end = start + 2;
        let braceCount = 1;
        while (end < str.length) {
            if (str[end] === '{') {
                braceCount++;
            }
            else if (str[end] === '}') {
                braceCount--;
                if (braceCount === 0) {
                    break;
                }
            }
            end++;
        }
        if (braceCount !== 0) {
            return undefined;
        }
        const id = str.slice(start, end + 1);
        const inner = str.substring(start + 2, end);
        const colonIdx = inner.indexOf(':');
        if (colonIdx === -1) {
            return { replacement: { id, name: inner, inner }, end };
        }
        return {
            replacement: {
                id,
                inner,
                name: inner.slice(0, colonIdx),
                arg: inner.slice(colonIdx + 1)
            },
            end
        };
    }
    parseObject(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return;
        }
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                const value = obj[i];
                if (typeof value === 'string') {
                    this.parseString(obj, i, value);
                }
                else {
                    this.parseObject(value);
                }
            }
            return;
        }
        for (const [key, value] of Object.entries(obj)) {
            this.parseString(obj, key, key, true); // parse key
            if (typeof value === 'string') {
                this.parseString(obj, key, value);
            }
            else {
                this.parseObject(value);
            }
        }
    }
    parseString(object, propertyName, value, replaceKeyName, replacementPath) {
        let pos = 0;
        while (pos < value.length) {
            const match = value.indexOf('${', pos);
            if (match === -1) {
                break;
            }
            const parsed = this.parseVariable(value, match);
            if (parsed) {
                pos = parsed.end + 1;
                if (replacementPath?.includes(parsed.replacement.id)) {
                    continue;
                }
                const locations = this.locations.get(parsed.replacement.id) || { locations: [], replacement: parsed.replacement };
                const newLocation = { object, propertyName, replaceKeyName };
                locations.locations.push(newLocation);
                this.locations.set(parsed.replacement.id, locations);
                if (locations.resolved) {
                    this._resolveAtLocation(parsed.replacement, newLocation, locations.resolved, replacementPath);
                }
                else {
                    this.newReplacementNotifiers.forEach(n => n(parsed.replacement));
                }
            }
            else {
                pos = match + 2;
            }
        }
    }
    *unresolved() {
        const newReplacements = new Map();
        const notifier = (replacement) => {
            newReplacements.set(replacement.id, replacement);
        };
        for (const location of this.locations.values()) {
            if (location.resolved === undefined) {
                newReplacements.set(location.replacement.id, location.replacement);
            }
        }
        this.newReplacementNotifiers.add(notifier);
        while (true) {
            const next = Iterable.first(newReplacements);
            if (!next) {
                break;
            }
            const [key, value] = next;
            yield value;
            newReplacements.delete(key);
        }
        this.newReplacementNotifiers.delete(notifier);
    }
    resolved() {
        return Iterable.map(Iterable.filter(this.locations.values(), l => !!l.resolved), l => [l.replacement, l.resolved]);
    }
    resolve(replacement, data) {
        if (typeof data !== 'object') {
            data = { value: String(data) };
        }
        const location = this.locations.get(replacement.id);
        if (!location) {
            return;
        }
        location.resolved = data;
        if (data.value !== undefined) {
            for (const l of location.locations || Iterable.empty()) {
                this._resolveAtLocation(replacement, l, data);
            }
        }
    }
    _resolveAtLocation(replacement, { replaceKeyName, propertyName, object }, data, path = []) {
        if (data.value === undefined) {
            return;
        }
        // avoid recursive resolution, e.g. ${env:FOO} -> ${env:BAR}=${env:FOO}
        path.push(replacement.id);
        // note: in nested `this.parseString`, parse only the new substring for any replacements, don't reparse the whole string
        if (replaceKeyName && typeof propertyName === 'string') {
            const value = object[propertyName];
            const newKey = propertyName.replaceAll(replacement.id, data.value);
            delete object[propertyName];
            object[newKey] = value;
            this._renameKeyInLocations(object, propertyName, newKey);
            this.parseString(object, newKey, data.value, true, path);
        }
        else {
            object[propertyName] = object[propertyName].replaceAll(replacement.id, data.value);
            this.parseString(object, propertyName, data.value, false, path);
        }
        path.pop();
    }
    _renameKeyInLocations(obj, oldKey, newKey) {
        for (const location of this.locations.values()) {
            for (const loc of location.locations) {
                if (loc.object === obj && loc.propertyName === oldKey) {
                    loc.propertyName = newKey;
                }
            }
        }
    }
    toObject() {
        // If we wrapped a string, unwrap it
        if (this.stringRoot) {
            // eslint-disable-next-line local/code-no-any-casts
            return this.root.value;
        }
        return this.root;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvY29uZmlndXJhdGlvblJlc29sdmVyL2NvbW1vbi9jb25maWd1cmF0aW9uUmVzb2x2ZXJFeHByZXNzaW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQTBEdEYsTUFBTSxPQUFPLCtCQUErQjthQUNwQixpQkFBWSxHQUFHLElBQUksQUFBUCxDQUFRO0lBVzNDLFlBQW9CLE1BQVM7UUFUWixjQUFTLEdBQUcsSUFBSSxHQUFHLEVBQWdDLENBQUM7UUFHckU7OztXQUdHO1FBQ0ssNEJBQXVCLEdBQUcsSUFBSSxHQUFHLEVBQTRCLENBQUM7UUFHckUsOEVBQThFO1FBQzlFLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDaEMsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7WUFDdkIsbURBQW1EO1lBQ25ELElBQUksQ0FBQyxJQUFJLEdBQUcsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFTLENBQUM7UUFDdEMsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztZQUN4QixJQUFJLENBQUMsSUFBSSxHQUFHLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNyQyxDQUFDO0lBQ0YsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxNQUFNLENBQUMsS0FBSyxDQUFJLE1BQVM7UUFDL0IsSUFBSSxNQUFNLFlBQVksK0JBQStCLEVBQUUsQ0FBQztZQUN2RCxPQUFPLE1BQU0sQ0FBQztRQUNm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