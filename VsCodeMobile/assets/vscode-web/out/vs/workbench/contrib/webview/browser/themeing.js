/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { DEFAULT_FONT_FAMILY } from '../../../../base/browser/fonts.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { EditorFontLigatures } from '../../../../editor/common/config/editorOptions.js';
import { EDITOR_FONT_DEFAULTS } from '../../../../editor/common/config/fontInfo.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import * as colorRegistry from '../../../../platform/theme/common/colorRegistry.js';
import { ColorScheme } from '../../../../platform/theme/common/theme.js';
import { IWorkbenchThemeService } from '../../../services/themes/common/workbenchThemeService.js';
let WebviewThemeDataProvider = class WebviewThemeDataProvider extends Disposable {
    constructor(_themeService, _configurationService) {
        super();
        this._themeService = _themeService;
        this._configurationService = _configurationService;
        this._cachedWebViewThemeData = undefined;
        this._onThemeDataChanged = this._register(new Emitter());
        this.onThemeDataChanged = this._onThemeDataChanged.event;
        this._register(this._themeService.onDidColorThemeChange(() => {
            this._reset();
        }));
        const webviewConfigurationKeys = ['editor.fontFamily', 'editor.fontWeight', 'editor.fontSize', 'editor.fontLigatures', 'accessibility.underlineLinks'];
        this._register(this._configurationService.onDidChangeConfiguration(e => {
            if (webviewConfigurationKeys.some(key => e.affectsConfiguration(key))) {
                this._reset();
            }
        }));
    }
    getTheme() {
        return this._themeService.getColorTheme();
    }
    getWebviewThemeData() {
        if (!this._cachedWebViewThemeData) {
            const configuration = this._configurationService.getValue('editor');
            const editorFontFamily = configuration.fontFamily || EDITOR_FONT_DEFAULTS.fontFamily;
            const editorFontWeight = configuration.fontWeight || EDITOR_FONT_DEFAULTS.fontWeight;
            const editorFontSize = configuration.fontSize || EDITOR_FONT_DEFAULTS.fontSize;
            const editorFontLigatures = new EditorFontLigatures().validate(configuration.fontLigatures);
            const linkUnderlines = this._configurationService.getValue('accessibility.underlineLinks');
            const theme = this._themeService.getColorTheme();
            const exportedColors = colorRegistry.getColorRegistry().getColors().reduce((colors, entry) => {
                const color = theme.getColor(entry.id);
                if (color) {
                    colors['vscode-' + entry.id.replace('.', '-')] = color.toString();
                }
                return colors;
            }, {});
            const styles = {
                'vscode-font-family': DEFAULT_FONT_FAMILY,
                'vscode-font-weight': 'normal',
                'vscode-font-size': '13px',
                'vscode-editor-font-family': editorFontFamily,
                'vscode-editor-font-weight': editorFontWeight,
                'vscode-editor-font-size': editorFontSize + 'px',
                'text-link-decoration': linkUnderlines ? 'underline' : 'none',
                ...exportedColors,
                'vscode-editor-font-feature-settings': editorFontLigatures,
            };
            const activeTheme = ApiThemeClassName.fromTheme(theme);
            this._cachedWebViewThemeData = { styles, activeTheme, themeLabel: theme.label, themeId: theme.settingsId };
        }
        return this._cachedWebViewThemeData;
    }
    _reset() {
        this._cachedWebViewThemeData = undefined;
        this._onThemeDataChanged.fire();
    }
};
WebviewThemeDataProvider = __decorate([
    __param(0, IWorkbenchThemeService),
    __param(1, IConfigurationService)
], WebviewThemeDataProvider);
export { WebviewThemeDataProvider };
var ApiThemeClassName;
(function (ApiThemeClassName) {
    ApiThemeClassName["light"] = "vscode-light";
    ApiThemeClassName["dark"] = "vscode-dark";
    ApiThemeClassName["highContrast"] = "vscode-high-contrast";
    ApiThemeClassName["highContrastLight"] = "vscode-high-contrast-light";
})(ApiThemeClassName || (ApiThemeClassName = {}));
(function (ApiThemeClassName) {
    function fromTheme(theme) {
        switch (theme.type) {
            case ColorScheme.LIGHT: return ApiThemeClassName.light;
            case ColorScheme.DARK: return ApiThemeClassName.dark;
            case ColorScheme.HIGH_CONTRAST_DARK: return ApiThemeClassName.highContrast;
            case ColorScheme.HIGH_CONTRAST_LIGHT: return ApiThemeClassName.highContrastLight;
        }
    }
    ApiThemeClassName.fromTheme = fromTheme;
})(ApiThemeClassName || (ApiThemeClassName = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhlbWVpbmcuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvd2Vidmlldy9icm93c2VyL3RoZW1laW5nLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFrQixtQkFBbUIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3hHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sS0FBSyxhQUFhLE1BQU0sb0RBQW9ELENBQUM7QUFDcEYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3pFLE9BQU8sRUFBd0Isc0JBQXNCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQVVqSCxJQUFNLHdCQUF3QixHQUE5QixNQUFNLHdCQUF5QixTQUFRLFVBQVU7SUFPdkQsWUFDeUIsYUFBc0QsRUFDdkQscUJBQTZEO1FBRXBGLEtBQUssRUFBRSxDQUFDO1FBSGlDLGtCQUFhLEdBQWIsYUFBYSxDQUF3QjtRQUN0QywwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO1FBUDdFLDRCQUF1QixHQUFpQyxTQUFTLENBQUM7UUFFekQsd0JBQW1CLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBUSxDQUFDLENBQUM7UUFDM0QsdUJBQWtCLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQztRQVFuRSxJQUFJLENBQUMs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