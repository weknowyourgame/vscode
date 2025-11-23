/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../base/common/codicons.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable, toDisposable } from '../../../base/common/lifecycle.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import * as platform from '../../registry/common/platform.js';
import { ColorScheme, ThemeTypeSelector } from './theme.js';
export const IThemeService = createDecorator('themeService');
export function themeColorFromId(id) {
    return { id };
}
export const FileThemeIcon = Codicon.file;
export const FolderThemeIcon = Codicon.folder;
export function getThemeTypeSelector(type) {
    switch (type) {
        case ColorScheme.DARK: return ThemeTypeSelector.VS_DARK;
        case ColorScheme.HIGH_CONTRAST_DARK: return ThemeTypeSelector.HC_BLACK;
        case ColorScheme.HIGH_CONTRAST_LIGHT: return ThemeTypeSelector.HC_LIGHT;
        default: return ThemeTypeSelector.VS;
    }
}
// static theming participant
export const Extensions = {
    ThemingContribution: 'base.contributions.theming'
};
class ThemingRegistry extends Disposable {
    constructor() {
        super();
        this.themingParticipants = [];
        this.themingParticipants = [];
        this.onThemingParticipantAddedEmitter = this._register(new Emitter());
    }
    onColorThemeChange(participant) {
        this.themingParticipants.push(participant);
        this.onThemingParticipantAddedEmitter.fire(participant);
        return toDisposable(() => {
            const idx = this.themingParticipants.indexOf(participant);
            this.themingParticipants.splice(idx, 1);
        });
    }
    get onThemingParticipantAdded() {
        return this.onThemingParticipantAddedEmitter.event;
    }
    getThemingParticipants() {
        return this.themingParticipants;
    }
}
const themingRegistry = new ThemingRegistry();
platform.Registry.add(Extensions.ThemingContribution, themingRegistry);
export function registerThemingParticipant(participant) {
    return themingRegistry.onColorThemeChange(participant);
}
/**
 * Utility base class for all themable components.
 */
export class Themable extends Disposable {
    constructor(themeService) {
        super();
        this.themeService = themeService;
        this.theme = themeService.getColorTheme();
        // Hook up to theme changes
        this._register(this.themeService.onDidColorThemeChange(theme => this.onThemeChange(theme)));
    }
    onThemeChange(theme) {
        this.theme = theme;
        this.updateStyles();
    }
    updateStyles() {
        // Subclasses to override
    }
    getColor(id, modify) {
        let color = this.theme.getColor(id);
        if (color && modify) {
            color = modify(color, this.theme);
        }
        return color ? color.toString() : null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhlbWVTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRTNELE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFlLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRTFGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM5RSxPQUFPLEtBQUssUUFBUSxNQUFNLG1DQUFtQyxDQUFDO0FBRzlELE9BQU8sRUFBRSxXQUFXLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFFNUQsTUFBTSxDQUFDLE1BQU0sYUFBYSxHQUFHLGVBQWUsQ0FBZ0IsY0FBYyxDQUFDLENBQUM7QUFFNUUsTUFBTSxVQUFVLGdCQUFnQixDQUFDLEVBQW1CO0lBQ25ELE9BQU8sRUFBRSxFQUFFLEVBQUUsQ0FBQztBQUNmLENBQUM7QUFFRCxNQUFNLENBQUMsTUFBTSxhQUFhLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQztBQUMxQyxNQUFNLENBQUMsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztBQUU5QyxNQUFNLFVBQVUsb0JBQW9CLENBQUMsSUFBaUI7SUFDckQsUUFBUSxJQUFJLEVBQUUsQ0FBQztRQUNkLEtBQUssV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8saUJBQWlCLENBQUMsT0FBTyxDQUFDO1FBQ3hELEtBQUssV0FBVyxDQUFDLGtCQUFrQixDQUFDLENBQUMsT0FBTyxpQkFBaUIsQ0FBQyxRQUFRLENBQUM7UUFDdkUsS0FBSyxXQUFXLENBQUMsbUJBQW1CLENB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