/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { RunOnceScheduler } from '../../../base/common/async.js';
import { Codicon } from '../../../base/common/codicons.js';
import { getCodiconFontCharacters } from '../../../base/common/codiconsUtil.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { Emitter } from '../../../base/common/event.js';
import { isString } from '../../../base/common/types.js';
import { URI } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { Extensions as JSONExtensions } from '../../jsonschemas/common/jsonContributionRegistry.js';
import * as platform from '../../registry/common/platform.js';
import { Disposable } from '../../../base/common/lifecycle.js';
//  ------ API types
// icon registry
export const Extensions = {
    IconContribution: 'base.contributions.icons'
};
export var IconContribution;
(function (IconContribution) {
    function getDefinition(contribution, registry) {
        let definition = contribution.defaults;
        while (ThemeIcon.isThemeIcon(definition)) {
            const c = iconRegistry.getIcon(definition.id);
            if (!c) {
                return undefined;
            }
            definition = c.defaults;
        }
        return definition;
    }
    IconContribution.getDefinition = getDefinition;
})(IconContribution || (IconContribution = {}));
export var IconFontDefinition;
(function (IconFontDefinition) {
    function toJSONObject(iconFont) {
        return {
            weight: iconFont.weight,
            style: iconFont.style,
            src: iconFont.src.map(s => ({ format: s.format, location: s.location.toString() }))
        };
    }
    IconFontDefinition.toJSONObject = toJSONObject;
    function fromJSONObject(json) {
        const stringOrUndef = (s) => isString(s) ? s : undefined;
        if (json && Array.isArray(json.src) && json.src.every((s) => isString(s.format) && isString(s.location))) {
            return {
                weight: stringOrUndef(json.weight),
                style: stringOrUndef(json.style),
                src: json.src.map((s) => ({ format: s.format, location: URI.parse(s.location) }))
            };
        }
        return undefined;
    }
    IconFontDefinition.fromJSONObject = fromJSONObject;
})(IconFontDefinition || (IconFontDefinition = {}));
// regexes for validation of font properties
export const fontIdRegex = /^([\w_-]+)$/;
export const fontStyleRegex = /^(normal|italic|(oblique[ \w\s-]+))$/;
export const fontWeightRegex = /^(normal|bold|lighter|bolder|(\d{0-1000}))$/;
export const fontSizeRegex = /^([\w_.%+-]+)$/;
export const fontFormatRegex = /^woff|woff2|truetype|opentype|embedded-opentype|svg$/;
export const fontColorRegex = /^#[0-9a-fA-F]{0,6}$/;
export const fontIdErrorMessage = localize('schema.fontId.formatError', 'The font ID must only contain letters, numbers, underscores and dashes.');
class IconRegistry extends Disposable {
    constructor() {
        super();
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this.iconSchema = {
            definitions: {
                icons: {
                    type: 'object',
                    properties: {
                        fontId: { type: 'string', description: localize('iconDefinition.fontId', 'The id of the font to use. If not set, the font that is defined first is used.'), pattern: fontIdRegex.source, patternErrorMessage: fontIdErrorMessage },
                        fontCharacter: { type: 'string', description: localize('iconDefinition.fontCharacter', 'The font character associated with the icon definition.') }
                    },
                    additionalProperties: false,
                    defaultSnippets: [{ body: { fontCharacter: '\\\\e030' } }]
                }
            },
            type: 'object',
            properties: {}
        };
        this.iconReferenceSchema = { type: 'string', pattern: `^${ThemeIcon.iconNameExpression}$`, enum: [], enumDescriptions: [] };
        this.iconsById = {};
        this.iconFontsById = {};
    }
    registerIcon(id, defaults, description, deprecationMessage) {
        const existing = this.iconsById[id];
        if (existing) {
            if (description && !existing.description) {
                existing.description = description;
                this.iconSchema.properties[id].markdownDescription = `${description} $(${id})`;
                const enumIndex = this.iconReferenceSchema.enum.indexOf(id);
                if (enumIndex !== -1) {
                    this.iconReferenceSchema.enumDescriptions[enumIndex] = description;
                }
                this._onDidChange.fire();
            }
            return existing;
        }
        const iconContribution = { id, description, defaults, deprecationMessage };
        this.iconsById[id] = iconContribution;
        const propertySchema = { $ref: '#/definitions/icons' };
        if (deprecationMessage) {
            propertySchema.deprecationMessage = deprecationMessage;
        }
        if (description) {
            propertySchema.markdownDescription = `${description}: $(${id})`;
        }
        this.iconSchema.properties[id] = propertySchema;
        this.iconReferenceSchema.enum.push(id);
        this.iconReferenceSchema.enumDescriptions.push(description || '');
        this._onDidChange.fire();
        return { id };
    }
    deregisterIcon(id) {
        delete this.iconsById[id];
        delete this.iconSchema.properties[id];
        const index = this.iconReferenceSchema.enum.indexOf(id);
        if (index !== -1) {
            this.iconReferenceSchema.enum.splice(index, 1);
            this.iconReferenceSchema.enumDescriptions.splice(index, 1);
        }
        this._onDidChange.fire();
    }
    getIcons() {
        return Object.keys(this.iconsById).map(id => this.iconsById[id]);
    }
    getIcon(id) {
        return this.iconsById[id];
    }
    getIconSchema() {
        return this.iconSchema;
    }
    getIconReferenceSchema() {
        return this.iconReferenceSchema;
    }
    registerIconFont(id, definition) {
        const existing = this.iconFontsById[id];
        if (existing) {
            return existing;
        }
        this.iconFontsById[id] = definition;
        this._onDidChange.fire();
        return definition;
    }
    deregisterIconFont(id) {
        delete this.iconFontsById[id];
    }
    getIconFont(id) {
        return this.iconFontsById[id];
    }
    toString() {
        const sorter = (i1, i2) => {
            return i1.id.localeCompare(i2.id);
        };
        const classNames = (i) => {
            while (ThemeIcon.isThemeIcon(i.defaults)) {
                i = this.iconsById[i.defaults.id];
            }
            return `codicon codicon-${i ? i.id : ''}`;
        };
        const reference = [];
        reference.push(`| preview     | identifier                        | default codicon ID                | description`);
        reference.push(`| ----------- | --------------------------------- | --------------------------------- | --------------------------------- |`);
        const contributions = Object.keys(this.iconsById).map(key => this.iconsById[key]);
        for (const i of contributions.filter(i => !!i.description).sort(sorter)) {
            reference.push(`|<i class="${classNames(i)}"></i>|${i.id}|${ThemeIcon.isThemeIcon(i.defaults) ? i.defaults.id : i.id}|${i.description || ''}|`);
        }
        reference.push(`| preview     | identifier                        `);
        reference.push(`| ----------- | --------------------------------- |`);
        for (const i of contributions.filter(i => !ThemeIcon.isThemeIcon(i.defaults)).sort(sorter)) {
            reference.push(`|<i class="${classNames(i)}"></i>|${i.id}|`);
        }
        return reference.join('\n');
    }
}
const iconRegistry = new IconRegistry();
platform.Registry.add(Extensions.IconContribution, iconRegistry);
export function registerIcon(id, defaults, description, deprecationMessage) {
    return iconRegistry.registerIcon(id, defaults, description, deprecationMessage);
}
export function getIconRegistry() {
    return iconRegistry;
}
function initialize() {
    const codiconFontCharacters = getCodiconFontCharacters();
    for (const icon in codiconFontCharacters) {
        const fontCharacter = '\\' + codiconFontCharacters[icon].toString(16);
        iconRegistry.registerIcon(icon, { fontCharacter });
    }
}
initialize();
export const iconsSchemaId = 'vscode://schemas/icons';
const schemaRegistry = platform.Registry.as(JSONExtensions.JSONContribution);
schemaRegistry.registerSchema(iconsSchemaId, iconRegistry.getIconSchema());
const delayer = new RunOnceScheduler(() => schemaRegistry.notifySchemaChanged(iconsSchemaId), 200);
iconRegistry.onDidChange(() => {
    if (!delayer.isScheduled()) {
        delayer.schedule();
    }
});
//setTimeout(_ => console.log(iconRegistry.toString()), 5000);
// common icons
export const widgetClose = registerIcon('widget-close', Codicon.close, localize('widgetClose', 'Icon for the close action in widgets.'));
export const gotoPreviousLocation = registerIcon('goto-previous-location', Codicon.arrowUp, localize('previousChangeIcon', 'Icon for goto previous editor location.'));
export const gotoNextLocation = registerIcon('goto-next-location', Codicon.arrowDown, localize('nextChangeIcon', 'Icon for goto next editor location.'));
export const syncing = ThemeIcon.modify(Codicon.sync, 'spin');
export const spinningLoading = ThemeIcon.modify(Codicon.loading, 'spin');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWNvblJlZ2lzdHJ5LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDakUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxTQUFTLEVBQWtCLE1BQU0sbUNBQW1DLENBQUM7QUFDOUUsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLCtCQUErQixDQUFDO0FBRS9ELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN6RCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDbEQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzNDLE9BQU8sRUFBRSxVQUFVLElBQUksY0FBYyxFQUE2QixNQUFNLHNEQUFzRCxDQUFDO0FBQy9ILE9BQU8sS0FBSyxRQUFRLE1BQU0sbUNBQW1DLENBQUM7QUFDOUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRS9ELG9CQUFvQjtBQUdwQixnQkFBZ0I7QUFDaEIsTUFBTSxDQUFDLE1BQU0sVUFBVSxHQUFHO0lBQ3pCLGdCQUFnQixFQUFFLDBCQUEwQjtDQUM1QyxDQUFDO0FBaUJGLE1BQU0sS0FBVyxnQkFBZ0IsQ0FZaEM7QUFaRCxXQUFpQixnQkFBZ0I7SUFDaEMsU0FBZ0IsYUFBYSxDQUFDLFlBQThCLEVBQUUsUUFBdUI7UUFDcEYsSUFBSSxVQUFVLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQztRQUN2QyxPQUFPLFNBQVMsQ0FB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