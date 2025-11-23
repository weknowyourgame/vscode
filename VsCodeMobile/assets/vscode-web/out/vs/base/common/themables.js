/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from './codicons.js';
export var ThemeColor;
(function (ThemeColor) {
    function isThemeColor(obj) {
        return !!obj && typeof obj === 'object' && typeof obj.id === 'string';
    }
    ThemeColor.isThemeColor = isThemeColor;
})(ThemeColor || (ThemeColor = {}));
export function themeColorFromId(id) {
    return { id };
}
export var ThemeIcon;
(function (ThemeIcon) {
    ThemeIcon.iconNameSegment = '[A-Za-z0-9]+';
    ThemeIcon.iconNameExpression = '[A-Za-z0-9-]+';
    ThemeIcon.iconModifierExpression = '~[A-Za-z]+';
    ThemeIcon.iconNameCharacter = '[A-Za-z0-9~-]';
    const ThemeIconIdRegex = new RegExp(`^(${ThemeIcon.iconNameExpression})(${ThemeIcon.iconModifierExpression})?$`);
    function asClassNameArray(icon) {
        const match = ThemeIconIdRegex.exec(icon.id);
        if (!match) {
            return asClassNameArray(Codicon.error);
        }
        const [, id, modifier] = match;
        const classNames = ['codicon', 'codicon-' + id];
        if (modifier) {
            classNames.push('codicon-modifier-' + modifier.substring(1));
        }
        return classNames;
    }
    ThemeIcon.asClassNameArray = asClassNameArray;
    function asClassName(icon) {
        return asClassNameArray(icon).join(' ');
    }
    ThemeIcon.asClassName = asClassName;
    function asCSSSelector(icon) {
        return '.' + asClassNameArray(icon).join('.');
    }
    ThemeIcon.asCSSSelector = asCSSSelector;
    function isThemeIcon(obj) {
        return !!obj && typeof obj === 'object' && typeof obj.id === 'string' && (typeof obj.color === 'undefined' || ThemeColor.isThemeColor(obj.color));
    }
    ThemeIcon.isThemeIcon = isThemeIcon;
    const _regexFromString = new RegExp(`^\\$\\((${ThemeIcon.iconNameExpression}(?:${ThemeIcon.iconModifierExpression})?)\\)$`);
    function fromString(str) {
        const match = _regexFromString.exec(str);
        if (!match) {
            return undefined;
        }
        const [, name] = match;
        return { id: name };
    }
    ThemeIcon.fromString = fromString;
    function fromId(id) {
        return { id };
    }
    ThemeIcon.fromId = fromId;
    function modify(icon, modifier) {
        let id = icon.id;
        const tildeIndex = id.lastIndexOf('~');
        if (tildeIndex !== -1) {
            id = id.substring(0, tildeIndex);
        }
        if (modifier) {
            id = `${id}~${modifier}`;
        }
        return { id };
    }
    ThemeIcon.modify = modify;
    function getModifier(icon) {
        const tildeIndex = icon.id.lastIndexOf('~');
        if (tildeIndex !== -1) {
            return icon.id.substring(tildeIndex + 1);
        }
        return undefined;
    }
    ThemeIcon.getModifier = getModifier;
    function isEqual(ti1, ti2) {
        return ti1.id === ti2.id && ti1.color?.id === ti2.color?.id;
    }
    ThemeIcon.isEqual = isEqual;
    /**
     * Returns whether specified icon is defined and has 'file' ID.
     */
    function isFile(icon) {
        return icon?.id === Codicon.file.id;
    }
    ThemeIcon.isFile = isFile;
    /**
     * Returns whether specified icon is defined and has 'folder' ID.
     */
    function isFolder(icon) {
        return icon?.id === Codicon.folder.id;
    }
    ThemeIcon.isFolder = isFolder;
})(ThemeIcon || (ThemeIcon = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhlbWFibGVzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBVXhDLE1BQU0sS0FBVyxVQUFVLENBSTFCO0FBSkQsV0FBaUIsVUFBVTtJQUMxQixTQUFnQixZQUFZLENBQUMsR0FBWTtRQUN4QyxPQUFPLENBQUMsQ0FBQyxHQUFHLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxJQUFJLE9BQW9CLEdBQUksQ0FBQyxFQUFFLEtBQUssUUFBUSxDQUFDO0lBQ3JGLENBQUM7SUFGZSx1QkFBWSxlQUUzQixDQUFBO0FBQ0YsQ0FBQyxFQUpnQixVQUFVLEtBQVYsVUFBVSxRQUkxQjtBQUVELE1BQU0sVUFBVSxnQkFBZ0IsQ0FBQyxFQUFtQjtJQUNuRCxPQUFPLEVBQUUsRUFBRSxFQUFFLENBQUM7QUFDZixDQUFDO0FBUUQsTUFBTSxLQUFXLFNBQVMsQ0FxRnpCO0FBckZELFdBQWlCLFNBQVM7SUFDWix5QkFBZSxHQUFHLGNBQWMsQ0FBQztJQUNqQyw0QkFBa0IsR0FBRyxlQUFlLENBQUM7SUFDckMsZ0NBQXNCLEdBQUcsWUFBWSxDQUFDO0lBQ3RDLDJCQUFpQixHQUFHLGVBQWUsQ0FBQztJQUVqRCxNQUFNLGdCQUFnQixHQUFHLElBQUksTUFBTSxDQUFDLEtBQUssVUFBQSxrQkFBa0IsS0FBSyxVQUFBLHNCQUFzQixLQUFLLENBQUMsQ0FBQztJQUU3RixTQUFnQixnQkFBZ0IsQ0FBQyxJQUFlO1FBQy9DLE1BQU0sS0FBSyxHQUFHLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDN0MsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1osT0FBTyxnQkFBZ0IsQ0FBQyxP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