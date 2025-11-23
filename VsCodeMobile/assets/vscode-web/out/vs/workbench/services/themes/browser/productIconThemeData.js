/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from '../../../../nls.js';
import * as Paths from '../../../../base/common/path.js';
import * as resources from '../../../../base/common/resources.js';
import * as Json from '../../../../base/common/json.js';
import { ExtensionData, ThemeSettingDefaults } from '../common/workbenchThemeService.js';
import { getParseErrorMessage } from '../../../../base/common/jsonErrorMessages.js';
import { isObject, isString } from '../../../../base/common/types.js';
import { getIconRegistry, IconFontDefinition, fontIdRegex, fontWeightRegex, fontStyleRegex, fontFormatRegex } from '../../../../platform/theme/common/iconRegistry.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
export const DEFAULT_PRODUCT_ICON_THEME_ID = ''; // TODO
export class ProductIconThemeData {
    static { this.STORAGE_KEY = 'productIconThemeData'; }
    constructor(id, label, settingsId) {
        this.iconThemeDocument = { iconDefinitions: new Map() };
        this.id = id;
        this.label = label;
        this.settingsId = settingsId;
        this.isLoaded = false;
    }
    getIcon(iconContribution) {
        return _resolveIconDefinition(iconContribution, this.iconThemeDocument);
    }
    ensureLoaded(fileService, logService) {
        return !this.isLoaded ? this.load(fileService, logService) : Promise.resolve(this.styleSheetContent);
    }
    reload(fileService, logService) {
        return this.load(fileService, logService);
    }
    async load(fileService, logService) {
        const location = this.location;
        if (!location) {
            return Promise.resolve(this.styleSheetContent);
        }
        const warnings = [];
        this.iconThemeDocument = await _loadProductIconThemeDocument(fileService, location, warnings);
        this.isLoaded = true;
        if (warnings.length) {
            logService.error(nls.localize('error.parseicondefs', "Problems processing product icons definitions in {0}:\n{1}", location.toString(), warnings.join('\n')));
        }
        return this.styleSheetContent;
    }
    static fromExtensionTheme(iconTheme, iconThemeLocation, extensionData) {
        const id = extensionData.extensionId + '-' + iconTheme.id;
        const label = iconTheme.label || Paths.basename(iconTheme.path);
        const settingsId = iconTheme.id;
        const themeData = new ProductIconThemeData(id, label, settingsId);
        themeData.description = iconTheme.description;
        themeData.location = iconThemeLocation;
        themeData.extensionData = extensionData;
        themeData.watch = iconTheme._watch;
        themeData.isLoaded = false;
        return themeData;
    }
    static createUnloadedTheme(id) {
        const themeData = new ProductIconThemeData(id, '', '__' + id);
        themeData.isLoaded = false;
        themeData.extensionData = undefined;
        themeData.watch = false;
        return themeData;
    }
    static { this._defaultProductIconTheme = null; }
    static get defaultTheme() {
        let themeData = ProductIconThemeData._defaultProductIconTheme;
        if (!themeData) {
            themeData = ProductIconThemeData._defaultProductIconTheme = new ProductIconThemeData(DEFAULT_PRODUCT_ICON_THEME_ID, nls.localize('defaultTheme', 'Default'), ThemeSettingDefaults.PRODUCT_ICON_THEME);
            themeData.isLoaded = true;
            themeData.extensionData = undefined;
            themeData.watch = false;
        }
        return themeData;
    }
    static fromStorageData(storageService) {
        const input = storageService.get(ProductIconThemeData.STORAGE_KEY, 0 /* StorageScope.PROFILE */);
        if (!input) {
            return undefined;
        }
        try {
            const data = JSON.parse(input);
            const theme = new ProductIconThemeData('', '', '');
            for (const key in data) {
                switch (key) {
                    case 'id':
                    case 'label':
                    case 'description':
                    case 'settingsId':
                    case 'styleSheetContent':
                    case 'watch':
                        // eslint-disable-next-line local/code-no-any-casts
                        theme[key] = data[key];
                        break;
                    case 'location':
                        // ignore, no longer restore
                        break;
                    case 'extensionData':
                        theme.extensionData = ExtensionData.fromJSONObject(data.extensionData);
                        break;
                }
            }
            const { iconDefinitions, iconFontDefinitions } = data;
            if (Array.isArray(iconDefinitions) && isObject(iconFontDefinitions)) {
                const restoredIconDefinitions = new Map();
                for (const entry of iconDefinitions) {
                    const { id, fontCharacter, fontId } = entry;
                    if (isString(id) && isString(fontCharacter)) {
                        if (isString(fontId)) {
                            const iconFontDefinition = IconFontDefinition.fromJSONObject(iconFontDefinitions[fontId]);
                            if (iconFontDefinition) {
                                restoredIconDefinitions.set(id, { fontCharacter, font: { id: fontId, definition: iconFontDefinition } });
                            }
                        }
                        else {
                            restoredIconDefinitions.set(id, { fontCharacter });
                        }
                    }
                }
                theme.iconThemeDocument = { iconDefinitions: restoredIconDefinitions };
            }
            return theme;
        }
        catch (e) {
            return undefined;
        }
    }
    toStorage(storageService) {
        const iconDefinitions = [];
        const iconFontDefinitions = {};
        for (const entry of this.iconThemeDocument.iconDefinitions.entries()) {
            const font = entry[1].font;
            iconDefinitions.push({ id: entry[0], fontCharacter: entry[1].fontCharacter, fontId: font?.id });
            if (font && iconFontDefinitions[font.id] === undefined) {
                iconFontDefinitions[font.id] = IconFontDefinition.toJSONObject(font.definition);
            }
        }
        const data = JSON.stringify({
            id: this.id,
            label: this.label,
            description: this.description,
            settingsId: this.settingsId,
            styleSheetContent: this.styleSheetContent,
            watch: this.watch,
            extensionData: ExtensionData.toJSONObject(this.extensionData),
            iconDefinitions,
            iconFontDefinitions
        });
        storageService.store(ProductIconThemeData.STORAGE_KEY, data, 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
    }
}
function _loadProductIconThemeDocument(fileService, location, warnings) {
    return fileService.readExtensionResource(location).then((content) => {
        const parseErrors = [];
        const contentValue = Json.parse(content, parseErrors);
        if (parseErrors.length > 0) {
            return Promise.reject(new Error(nls.localize('error.cannotparseicontheme', "Problems parsing product icons file: {0}", parseErrors.map(e => getParseErrorMessage(e.error)).join(', '))));
        }
        else if (Json.getNodeType(contentValue) !== 'object') {
            return Promise.reject(new Error(nls.localize('error.invalidformat', "Invalid format for product icons theme file: Object expected.")));
        }
        else if (!contentValue.iconDefinitions || !Array.isArray(contentValue.fonts) || !contentValue.fonts.length) {
            return Promise.reject(new Error(nls.localize('error.missingProperties', "Invalid format for product icons theme file: Must contain iconDefinitions and fonts.")));
        }
        const iconThemeDocumentLocationDirname = resources.dirname(location);
        const sanitizedFonts = new Map();
        for (const font of contentValue.fonts) {
            const fontId = font.id;
            if (isString(fontId) && fontId.match(fontIdRegex)) {
                let fontWeight = undefined;
                if (isString(font.weight) && font.weight.match(fontWeightRegex)) {
                    fontWeight = font.weight;
                }
                else {
                    warnings.push(nls.localize('error.fontWeight', 'Invalid font weight in font \'{0}\'. Ignoring setting.', font.id));
                }
                let fontStyle = undefined;
                if (isString(font.style) && font.style.match(fontStyleRegex)) {
                    fontStyle = font.style;
                }
                else {
                    warnings.push(nls.localize('error.fontStyle', 'Invalid font style in font \'{0}\'. Ignoring setting.', font.id));
                }
                const sanitizedSrc = [];
                if (Array.isArray(font.src)) {
                    for (const s of font.src) {
                        if (isString(s.path) && isString(s.format) && s.format.match(fontFormatRegex)) {
                            const iconFontLocation = resources.joinPath(iconThemeDocumentLocationDirname, s.path);
                            sanitizedSrc.push({ location: iconFontLocation, format: s.format });
                        }
                        else {
                            warnings.push(nls.localize('error.fontSrc', 'Invalid font source in font \'{0}\'. Ignoring source.', font.id));
                        }
                    }
                }
                if (sanitizedSrc.length) {
                    sanitizedFonts.set(fontId, { weight: fontWeight, style: fontStyle, src: sanitizedSrc });
                }
                else {
                    warnings.push(nls.localize('error.noFontSrc', 'No valid font source in font \'{0}\'. Ignoring font definition.', font.id));
                }
            }
            else {
                warnings.push(nls.localize('error.fontId', 'Missing or invalid font id \'{0}\'. Skipping font definition.', font.id));
            }
        }
        const iconDefinitions = new Map();
        const primaryFontId = contentValue.fonts[0].id;
        for (const iconId in contentValue.iconDefinitions) {
            const definition = contentValue.iconDefinitions[iconId];
            if (isString(definition.fontCharacter)) {
                const fontId = definition.fontId ?? primaryFontId;
                const fontDefinition = sanitizedFonts.get(fontId);
                if (fontDefinition) {
                    const font = { id: `pi-${fontId}`, definition: fontDefinition };
                    iconDefinitions.set(iconId, { fontCharacter: definition.fontCharacter, font });
                }
                else {
                    warnings.push(nls.localize('error.icon.font', 'Skipping icon definition \'{0}\'. Unknown font.', iconId));
                }
            }
            else {
                warnings.push(nls.localize('error.icon.fontCharacter', 'Skipping icon definition \'{0}\': Needs to be defined', iconId));
            }
        }
        return { iconDefinitions };
    });
}
const iconRegistry = getIconRegistry();
function _resolveIconDefinition(iconContribution, iconThemeDocument) {
    const iconDefinitions = iconThemeDocument.iconDefinitions;
    let definition = iconDefinitions.get(iconContribution.id);
    let defaults = iconContribution.defaults;
    while (!definition && ThemeIcon.isThemeIcon(defaults)) {
        // look if an inherited icon has a definition
        const ic = iconRegistry.getIcon(defaults.id);
        if (ic) {
            definition = iconDefinitions.get(ic.id);
            defaults = ic.defaults;
        }
        else {
            return undefined;
        }
    }
    if (definition) {
        return definition;
    }
    if (!ThemeIcon.isThemeIcon(defaults)) {
        return defaults;
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZHVjdEljb25UaGVtZURhdGEuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL3RoZW1lcy9icm93c2VyL3Byb2R1Y3RJY29uVGhlbWVEYXRhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxLQUFLLEtBQUssTUFBTSxpQ0FBaUMsQ0FBQztBQUN6RCxPQUFPLEtBQUssU0FBUyxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sS0FBSyxJQUFJLE1BQU0saUNBQWlDLENBQUM7QUFDeEQsT0FBTyxFQUFFLGFBQWEsRUFBb0Qsb0JBQW9CLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMzSSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUVwRixPQUFPLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRXRFLE9BQU8sRUFBa0IsZUFBZSxFQUFvQixrQkFBa0IsRUFBa0IsV0FBVyxFQUFFLGVBQWUsRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDek4sT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBR2pFLE1BQU0sQ0FBQyxNQUFNLDZCQUE2QixHQUFHLEVBQUUsQ0FBQyxDQUFDLE9BQU87QUFFeEQsTUFBTSxPQUFPLG9CQUFvQjthQUVoQixnQkFBVyxHQUFHLHNCQUFzQixBQUF6QixDQUEwQjtJQWNyRCxZQUFvQixFQUFVLEVBQUUsS0FBYSxFQUFFLFVBQWtCO1FBSGpFLHNCQUFpQixHQUE2QixFQUFFLGVBQWUsRUFBRSxJQUFJLEdBQUcsRUFBRSxFQUFFLENBQUM7UUFJNUUsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUM7UUFD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