/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { raceTimeout } from '../../../../base/common/async.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { localize } from '../../../../nls.js';
import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
export const IPreferencesSearchService = createDecorator('preferencesSearchService');
export const PREFERENCES_EDITOR_COMMAND_OPEN = 'workbench.preferences.action.openPreferencesEditor';
export const CONTEXT_PREFERENCES_SEARCH_FOCUS = new RawContextKey('inPreferencesSearch', false);
export const SETTINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS = 'settings.action.clearSearchResults';
export const SETTINGS_EDITOR_COMMAND_SHOW_AI_RESULTS = 'settings.action.showAIResults';
export const SETTINGS_EDITOR_COMMAND_TOGGLE_AI_SEARCH = 'settings.action.toggleAiSearch';
export const SETTINGS_EDITOR_COMMAND_SHOW_CONTEXT_MENU = 'settings.action.showContextMenu';
export const SETTINGS_EDITOR_COMMAND_SUGGEST_FILTERS = 'settings.action.suggestFilters';
export const CONTEXT_SETTINGS_EDITOR = new RawContextKey('inSettingsEditor', false);
export const CONTEXT_SETTINGS_JSON_EDITOR = new RawContextKey('inSettingsJSONEditor', false);
export const CONTEXT_SETTINGS_SEARCH_FOCUS = new RawContextKey('inSettingsSearch', false);
export const CONTEXT_TOC_ROW_FOCUS = new RawContextKey('settingsTocRowFocus', false);
export const CONTEXT_SETTINGS_ROW_FOCUS = new RawContextKey('settingRowFocus', false);
export const CONTEXT_KEYBINDINGS_EDITOR = new RawContextKey('inKeybindings', false);
export const CONTEXT_KEYBINDINGS_SEARCH_FOCUS = new RawContextKey('inKeybindingsSearch', false);
export const CONTEXT_KEYBINDING_FOCUS = new RawContextKey('keybindingFocus', false);
export const CONTEXT_WHEN_FOCUS = new RawContextKey('whenFocus', false);
export const CONTEXT_AI_SETTING_RESULTS_AVAILABLE = new RawContextKey('aiSettingResultsAvailable', false);
export const KEYBINDINGS_EDITOR_COMMAND_SEARCH = 'keybindings.editor.searchKeybindings';
export const KEYBINDINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS = 'keybindings.editor.clearSearchResults';
export const KEYBINDINGS_EDITOR_COMMAND_CLEAR_SEARCH_HISTORY = 'keybindings.editor.clearSearchHistory';
export const KEYBINDINGS_EDITOR_COMMAND_RECORD_SEARCH_KEYS = 'keybindings.editor.recordSearchKeys';
export const KEYBINDINGS_EDITOR_COMMAND_SORTBY_PRECEDENCE = 'keybindings.editor.toggleSortByPrecedence';
export const KEYBINDINGS_EDITOR_COMMAND_DEFINE = 'keybindings.editor.defineKeybinding';
export const KEYBINDINGS_EDITOR_COMMAND_ADD = 'keybindings.editor.addKeybinding';
export const KEYBINDINGS_EDITOR_COMMAND_DEFINE_WHEN = 'keybindings.editor.defineWhenExpression';
export const KEYBINDINGS_EDITOR_COMMAND_ACCEPT_WHEN = 'keybindings.editor.acceptWhenExpression';
export const KEYBINDINGS_EDITOR_COMMAND_REJECT_WHEN = 'keybindings.editor.rejectWhenExpression';
export const KEYBINDINGS_EDITOR_COMMAND_REMOVE = 'keybindings.editor.removeKeybinding';
export const KEYBINDINGS_EDITOR_COMMAND_RESET = 'keybindings.editor.resetKeybinding';
export const KEYBINDINGS_EDITOR_COMMAND_COPY = 'keybindings.editor.copyKeybindingEntry';
export const KEYBINDINGS_EDITOR_COMMAND_COPY_COMMAND = 'keybindings.editor.copyCommandKeybindingEntry';
export const KEYBINDINGS_EDITOR_COMMAND_COPY_COMMAND_TITLE = 'keybindings.editor.copyCommandTitle';
export const KEYBINDINGS_EDITOR_COMMAND_SHOW_SIMILAR = 'keybindings.editor.showConflicts';
export const KEYBINDINGS_EDITOR_COMMAND_FOCUS_KEYBINDINGS = 'keybindings.editor.focusKeybindings';
export const KEYBINDINGS_EDITOR_SHOW_DEFAULT_KEYBINDINGS = 'keybindings.editor.showDefaultKeybindings';
export const KEYBINDINGS_EDITOR_SHOW_USER_KEYBINDINGS = 'keybindings.editor.showUserKeybindings';
export const KEYBINDINGS_EDITOR_SHOW_EXTENSION_KEYBINDINGS = 'keybindings.editor.showExtensionKeybindings';
export const MODIFIED_SETTING_TAG = 'modified';
export const EXTENSION_SETTING_TAG = 'ext:';
export const FEATURE_SETTING_TAG = 'feature:';
export const ID_SETTING_TAG = 'id:';
export const LANGUAGE_SETTING_TAG = 'lang:';
export const GENERAL_TAG_SETTING_TAG = 'tag:';
export const POLICY_SETTING_TAG = 'hasPolicy';
export const WORKSPACE_TRUST_SETTING_TAG = 'workspaceTrust';
export const REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG = 'requireTrustedWorkspace';
export const ADVANCED_SETTING_TAG = 'advanced';
export const KEYBOARD_LAYOUT_OPEN_PICKER = 'workbench.action.openKeyboardLayoutPicker';
export const ENABLE_LANGUAGE_FILTER = true;
export const ENABLE_EXTENSION_TOGGLE_SETTINGS = true;
export const EXTENSION_FETCH_TIMEOUT_MS = 1000;
export const STRING_MATCH_SEARCH_PROVIDER_NAME = 'local';
export const TF_IDF_SEARCH_PROVIDER_NAME = 'tfIdf';
export const FILTER_MODEL_SEARCH_PROVIDER_NAME = 'filterModel';
export const EMBEDDINGS_ONLY_SEARCH_PROVIDER_NAME = 'embeddingsOnly';
export const EMBEDDINGS_SEARCH_PROVIDER_NAME = 'embeddingsFull';
export const LLM_RANKED_SEARCH_PROVIDER_NAME = 'llmRanked';
export var WorkbenchSettingsEditorSettings;
(function (WorkbenchSettingsEditorSettings) {
    WorkbenchSettingsEditorSettings["ShowAISearchToggle"] = "workbench.settings.showAISearchToggle";
    WorkbenchSettingsEditorSettings["EnableNaturalLanguageSearch"] = "workbench.settings.enableNaturalLanguageSearch";
})(WorkbenchSettingsEditorSettings || (WorkbenchSettingsEditorSettings = {}));
let cachedExtensionToggleData;
export async function getExperimentalExtensionToggleData(chatEntitlementService, extensionGalleryService, productService) {
    if (!ENABLE_EXTENSION_TOGGLE_SETTINGS) {
        return undefined;
    }
    if (!extensionGalleryService.isEnabled()) {
        return undefined;
    }
    if (chatEntitlementService.sentiment.hidden || chatEntitlementService.sentiment.disabled) {
        return undefined;
    }
    if (cachedExtensionToggleData) {
        return cachedExtensionToggleData;
    }
    if (productService.extensionRecommendations && productService.commonlyUsedSettings) {
        const settingsEditorRecommendedExtensions = {};
        Object.keys(productService.extensionRecommendations).forEach(extensionId => {
            const extensionInfo = productService.extensionRecommendations[extensionId];
            if (extensionInfo.onSettingsEditorOpen) {
                settingsEditorRecommendedExtensions[extensionId] = extensionInfo;
            }
        });
        const recommendedExtensionsGalleryInfo = {};
        for (const key in settingsEditorRecommendedExtensions) {
            const extensionId = key;
            // Recommend prerelease if not on Stable.
            const isStable = productService.quality === 'stable';
            try {
                const extensions = await raceTimeout(extensionGalleryService.getExtensions([{ id: extensionId, preRelease: !isStable }], CancellationToken.None), EXTENSION_FETCH_TIMEOUT_MS);
                if (extensions?.length === 1) {
                    recommendedExtensionsGalleryInfo[key] = extensions[0];
                }
                else {
                    // same as network connection fail. we do not want a blank settings page: https://github.com/microsoft/vscode/issues/195722
                    // so instead of returning partial data we return undefined here
                    return undefined;
                }
            }
            catch (e) {
                // Network connection fail. Return nothing rather than partial data.
                return undefined;
            }
        }
        cachedExtensionToggleData = {
            settingsEditorRecommendedExtensions,
            recommendedExtensionsGalleryInfo,
            commonlyUsed: productService.commonlyUsedSettings
        };
        return cachedExtensionToggleData;
    }
    return undefined;
}
/**
 * Compares two nullable numbers such that null values always come after defined ones.
 */
export function compareTwoNullableNumbers(a, b) {
    const aOrMax = a ?? Number.MAX_SAFE_INTEGER;
    const bOrMax = b ?? Number.MAX_SAFE_INTEGER;
    if (aOrMax < bOrMax) {
        return -1;
    }
    else if (aOrMax > bOrMax) {
        return 1;
    }
    else {
        return 0;
    }
}
export const PREVIEW_INDICATOR_DESCRIPTION = localize('previewIndicatorDescription', "Preview setting: this setting controls a new feature that is still under refinement yet ready to use. Feedback is welcome.");
export const EXPERIMENTAL_INDICATOR_DESCRIPTION = localize('experimentalIndicatorDescription', "Experimental setting: this setting controls a new feature that is actively being developed and may be unstable. It is subject to change or removal.");
export const ADVANCED_INDICATOR_DESCRIPTION = localize('advancedIndicatorDescription', "Advanced setting: this setting is intended for advanced scenarios and configurations. Only modify this if you know what it does.");
export const knownAcronyms = new Set();
[
    'css',
    'html',
    'scss',
    'less',
    'json',
    'js',
    'ts',
    'ie',
    'id',
    'php',
    'scm',
].forEach(str => knownAcronyms.add(str));
export const knownTermMappings = new Map();
knownTermMappings.set('power shell', 'PowerShell');
knownTermMappings.set('powershell', 'PowerShell');
knownTermMappings.set('javascript', 'JavaScript');
knownTermMappings.set('typescript', 'TypeScript');
knownTermMappings.set('github', 'GitHub');
knownTermMappings.set('jet brains', 'JetBrains');
knownTermMappings.set('jetbrains', 'JetBrains');
knownTermMappings.set('re sharper', 'ReSharper');
knownTermMappings.set('resharper', 'ReSharper');
export function wordifyKey(key) {
    key = key
        .replace(/\.([a-z0-9])/g, (_, p1) => ` \u203A ${p1.toUpperCase()}`) // Replace dot with spaced '>'
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // Camel case to spacing, fooBar => foo Bar
        .replace(/([A-Z]{1,})([A-Z][a-z])/g, '$1 $2') // Split consecutive capitals letters, AISearch => AI Search
        .replace(/^[a-z]/g, match => match.toUpperCase()) // Upper casing all first letters, foo => Foo
        .replace(/\b\w+\b/g, match => {
        return knownAcronyms.has(match.toLowerCase()) ?
            match.toUpperCase() :
            match;
    });
    for (const [k, v] of knownTermMappings) {
        key = key.replace(new RegExp(`\\b${k}\\b`, 'gi'), v);
    }
    return key;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmVyZW5jZXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUc1RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBRXJGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQXdCN0YsTUFBTSxDQUFDLE1BQU0seUJBQXlCLEdBQUcsZUFBZSxDQUE0QiwwQkFBMEIsQ0FBQyxDQUFDO0FBc0JoSCxNQUFNLENBQUMsTUFBTSwrQkFBK0IsR0FBRyxvREFBb0QsQ0FBQztBQUNwRyxNQUFNLENBQUMsTUFBTSxnQ0FBZ0MsR0FBRyxJQUFJLGFBQWEsQ0FBVSxxQkFBcUIsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUV6RyxNQUFNLENBQUMsTUFBTSw0Q0FBNEMsR0FBRyxvQ0FBb0MsQ0FBQztBQUNqRyxNQUFNLENBQUMsTUFBTSx1Q0FBdUMsR0FBRywrQkFBK0IsQ0FBQztBQUN2RixNQUFNLENBQUMsTUFBTSx3Q0FBd0MsR0FBRyxnQ0FBZ0MsQ0FBQztBQUN6RixNQUFNLENBQUMsTUFBTSx5Q0FBeUMsR0FBRyxpQ0FBaUMsQ0FBQztBQUMzRixNQUFNLENBQUMsTUFBTSx1Q0FBdUMsR0FBRyxnQ0FBZ0MsQ0FBQztBQUV4RixNQUFNLENBQUMsTUFBTSx1QkFBdUIsR0FBRyxJQUFJLGFBQWEsQ0FBVSxrQkFBa0IsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUM3RixNQUFN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