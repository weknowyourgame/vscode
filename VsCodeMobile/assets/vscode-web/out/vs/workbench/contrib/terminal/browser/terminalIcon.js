/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { hash } from '../../../../base/common/hash.js';
import { URI } from '../../../../base/common/uri.js';
import { getIconRegistry } from '../../../../platform/theme/common/iconRegistry.js';
import { isDark } from '../../../../platform/theme/common/theme.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { ITerminalProfileResolverService } from '../common/terminal.js';
import { ansiColorMap } from '../common/terminalColorRegistry.js';
import { createStyleSheet } from '../../../../base/browser/domStylesheets.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { isString } from '../../../../base/common/types.js';
export function getColorClass(terminalOrColorKey) {
    let color = undefined;
    if (isString(terminalOrColorKey)) {
        color = terminalOrColorKey;
    }
    else if (terminalOrColorKey.color) {
        color = terminalOrColorKey.color.replace(/\./g, '_');
    }
    else if (ThemeIcon.isThemeIcon(terminalOrColorKey.icon) && terminalOrColorKey.icon.color) {
        color = terminalOrColorKey.icon.color.id.replace(/\./g, '_');
    }
    if (color) {
        return `terminal-icon-${color.replace(/\./g, '_')}`;
    }
    return undefined;
}
export function getStandardColors(colorTheme) {
    const standardColors = [];
    for (const colorKey in ansiColorMap) {
        const color = colorTheme.getColor(colorKey);
        if (color && !colorKey.toLowerCase().includes('bright')) {
            standardColors.push(colorKey);
        }
    }
    return standardColors;
}
export function createColorStyleElement(colorTheme) {
    const disposable = new DisposableStore();
    const standardColors = getStandardColors(colorTheme);
    const styleElement = createStyleSheet(undefined, undefined, disposable);
    let css = '';
    for (const colorKey of standardColors) {
        const colorClass = getColorClass(colorKey);
        const color = colorTheme.getColor(colorKey);
        if (color) {
            css += (`.monaco-workbench .${colorClass} .codicon:first-child:not(.codicon-split-horizontal):not(.codicon-trashcan):not(.file-icon)` +
                `{ color: ${color} !important; }`);
        }
    }
    styleElement.textContent = css;
    return disposable;
}
export function getColorStyleContent(colorTheme, editor) {
    const standardColors = getStandardColors(colorTheme);
    let css = '';
    for (const colorKey of standardColors) {
        const colorClass = getColorClass(colorKey);
        const color = colorTheme.getColor(colorKey);
        if (color) {
            if (editor) {
                css += (`.monaco-workbench .show-file-icons .predefined-file-icon.terminal-tab.${colorClass}::before,` +
                    `.monaco-workbench .show-file-icons .file-icon.terminal-tab.${colorClass}::before` +
                    `{ color: ${color} !important; }`);
            }
            else {
                css += (`.monaco-workbench .${colorClass} .codicon:first-child:not(.codicon-split-horizontal):not(.codicon-trashcan):not(.file-icon)` +
                    `{ color: ${color} !important; }`);
            }
        }
    }
    return css;
}
export function getUriClasses(terminal, colorScheme, extensionContributed) {
    const icon = terminal.icon;
    if (!icon) {
        return undefined;
    }
    const iconClasses = [];
    let uri = undefined;
    if (extensionContributed) {
        if (isString(icon) && (icon.startsWith('$(') || getIconRegistry().getIcon(icon))) {
            return iconClasses;
        }
        else if (isString(icon)) {
            uri = URI.parse(icon);
        }
    }
    if (URI.isUri(icon)) {
        uri = icon;
    }
    else if (!ThemeIcon.isThemeIcon(icon) && !isString(icon)) {
        uri = isDark(colorScheme) ? icon.dark : icon.light;
    }
    if (uri instanceof URI) {
        const uriIconKey = hash(uri.path).toString(36);
        const className = `terminal-uri-icon-${uriIconKey}`;
        iconClasses.push(className);
        iconClasses.push(`terminal-uri-icon`);
    }
    return iconClasses;
}
export function getIconId(accessor, terminal) {
    if (isString(terminal.icon)) {
        return terminal.icon;
    }
    if (ThemeIcon.isThemeIcon(terminal.icon)) {
        return terminal.icon.id;
    }
    return accessor.get(ITerminalProfileResolverService).getDefaultIcon().id;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxJY29uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL2Jyb3dzZXIvdGVybWluYWxJY29uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFHckQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3BGLE9BQU8sRUFBZSxNQUFNLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUVqRixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFakUsT0FBTyxFQUFFLCtCQUErQixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDeEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxlQUFlLEVBQWUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNwRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFPNUQsTUFBTSxVQUFVLGFBQWEsQ0FBQyxrQkFBNkY7SUFDMUgsSUFBSSxLQUFLLEdBQUcsU0FBUyxDQUFDO0lBQ3RCLElBQUksUUFBUSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsQ0FBQztRQUNsQyxLQUFLLEdBQUcsa0JBQWtCLENBQUM7SUFDNUIsQ0FBQztTQUFNLElBQUksa0JBQWtCLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDckMsS0FBSyxHQUFHLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3RELENBQUM7U0FBTSxJQUFJ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