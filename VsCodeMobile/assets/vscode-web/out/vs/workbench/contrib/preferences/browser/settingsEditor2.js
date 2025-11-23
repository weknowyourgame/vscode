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
var SettingsEditor2_1;
import * as DOM from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import * as aria from '../../../../base/browser/ui/aria/aria.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Sizing, SplitView } from '../../../../base/browser/ui/splitview/splitview.js';
import { ToggleActionViewItem } from '../../../../base/browser/ui/toggle/toggle.js';
import { Action } from '../../../../base/common/actions.js';
import { createCancelablePromise, Delayer, raceTimeout } from '../../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Color } from '../../../../base/common/color.js';
import { fromNow } from '../../../../base/common/date.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable, DisposableStore, dispose, MutableDisposable } from '../../../../base/common/lifecycle.js';
import * as platform from '../../../../base/common/platform.js';
import { StopWatch } from '../../../../base/common/stopwatch.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { ITextResourceConfigurationService } from '../../../../editor/common/services/textResourceConfiguration.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { Extensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IExtensionGalleryService, IExtensionManagementService } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IEditorProgressService } from '../../../../platform/progress/common/progress.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { defaultButtonStyles, defaultToggleStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { asCssVariable, asCssVariableWithDefault, badgeBackground, badgeForeground, contrastBorder, editorForeground, inputBackground } from '../../../../platform/theme/common/colorRegistry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IUserDataSyncEnablementService, IUserDataSyncService } from '../../../../platform/userDataSync/common/userDataSync.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { registerNavigableContainer } from '../../../browser/actions/widgetNavigationCommands.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IChatEntitlementService } from '../../../services/chat/common/chatEntitlementService.js';
import { APPLICATION_SCOPES, IWorkbenchConfigurationService } from '../../../services/configuration/common/configuration.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IPreferencesService, SettingMatchType, SettingValueType, validateSettingsEditorOptions } from '../../../services/preferences/common/preferences.js';
import { nullRange, Settings2EditorModel } from '../../../services/preferences/common/preferencesModels.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { IUserDataSyncWorkbenchService } from '../../../services/userDataSync/common/userDataSync.js';
import { SuggestEnabledInput } from '../../codeEditor/browser/suggestEnabledInput/suggestEnabledInput.js';
import { ADVANCED_SETTING_TAG, CONTEXT_AI_SETTING_RESULTS_AVAILABLE, CONTEXT_SETTINGS_EDITOR, CONTEXT_SETTINGS_ROW_FOCUS, CONTEXT_SETTINGS_SEARCH_FOCUS, CONTEXT_TOC_ROW_FOCUS, EMBEDDINGS_SEARCH_PROVIDER_NAME, ENABLE_LANGUAGE_FILTER, EXTENSION_FETCH_TIMEOUT_MS, EXTENSION_SETTING_TAG, FEATURE_SETTING_TAG, FILTER_MODEL_SEARCH_PROVIDER_NAME, getExperimentalExtensionToggleData, ID_SETTING_TAG, IPreferencesSearchService, LANGUAGE_SETTING_TAG, LLM_RANKED_SEARCH_PROVIDER_NAME, MODIFIED_SETTING_TAG, POLICY_SETTING_TAG, REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG, SETTINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS, SETTINGS_EDITOR_COMMAND_SHOW_AI_RESULTS, SETTINGS_EDITOR_COMMAND_SUGGEST_FILTERS, SETTINGS_EDITOR_COMMAND_TOGGLE_AI_SEARCH, STRING_MATCH_SEARCH_PROVIDER_NAME, TF_IDF_SEARCH_PROVIDER_NAME, WorkbenchSettingsEditorSettings, WORKSPACE_TRUST_SETTING_TAG } from '../common/preferences.js';
import { settingsHeaderBorder, settingsSashBorder, settingsTextInputBorder } from '../common/settingsEditorColorRegistry.js';
import './media/settingsEditor2.css';
import { preferencesAiResultsIcon, preferencesClearInputIcon, preferencesFilterIcon } from './preferencesIcons.js';
import { SettingsTargetsWidget } from './preferencesWidgets.js';
import { getCommonlyUsedData, tocData } from './settingsLayout.js';
import { SettingsSearchFilterDropdownMenuActionViewItem } from './settingsSearchMenu.js';
import { AbstractSettingRenderer, createTocTreeForExtensionSettings, resolveConfiguredUntrustedSettings, resolveSettingsTree, SettingsTree, SettingTreeRenderers } from './settingsTree.js';
import { parseQuery, SearchResultModel, SettingsTreeGroupElement, SettingsTreeModel, SettingsTreeSettingElement } from './settingsTreeModels.js';
import { createTOCIterator, TOCTree, TOCTreeModel } from './tocTree.js';
export var SettingsFocusContext;
(function (SettingsFocusContext) {
    SettingsFocusContext[SettingsFocusContext["Search"] = 0] = "Search";
    SettingsFocusContext[SettingsFocusContext["TableOfContents"] = 1] = "TableOfContents";
    SettingsFocusContext[SettingsFocusContext["SettingTree"] = 2] = "SettingTree";
    SettingsFocusContext[SettingsFocusContext["SettingControl"] = 3] = "SettingControl";
})(SettingsFocusContext || (SettingsFocusContext = {}));
export function createGroupIterator(group) {
    return Iterable.map(group.children, g => {
        return {
            element: g,
            children: g instanceof SettingsTreeGroupElement ?
                createGroupIterator(g) :
                undefined
        };
    });
}
const $ = DOM.$;
const searchBoxLabel = localize('SearchSettings.AriaLabel', "Search settings");
const SEARCH_TOC_BEHAVIOR_KEY = 'workbench.settings.settingsSearchTocBehavior';
const SHOW_AI_RESULTS_ENABLED_LABEL = localize('showAiResultsEnabled', "Show AI-recommended results");
const SHOW_AI_RESULTS_DISABLED_LABEL = localize('showAiResultsDisabled', "No AI results available at this time...");
const SETTINGS_EDITOR_STATE_KEY = 'settingsEditorState';
let SettingsEditor2 = class SettingsEditor2 extends EditorPane {
    static { SettingsEditor2_1 = this; }
    static { this.ID = 'workbench.editor.settings2'; }
    static { this.NUM_INSTANCES = 0; }
    static { this.SEARCH_DEBOUNCE = 200; }
    static { this.SETTING_UPDATE_FAST_DEBOUNCE = 200; }
    static { this.SETTING_UPDATE_SLOW_DEBOUNCE = 1000; }
    static { this.CONFIG_SCHEMA_UPDATE_DELAYER = 500; }
    static { this.TOC_MIN_WIDTH = 100; }
    static { this.TOC_RESET_WIDTH = 200; }
    static { this.EDITOR_MIN_WIDTH = 500; }
    // Below NARROW_TOTAL_WIDTH, we only render the editor rather than the ToC.
    static { this.NARROW_TOTAL_WIDTH = this.TOC_RESET_WIDTH + this.EDITOR_MIN_WIDTH; }
    static { this.SUGGESTIONS = [
        `@${MODIFIED_SETTING_TAG}`,
        '@tag:notebookLayout',
        '@tag:notebookOutputLayout',
        `@tag:${REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG}`,
        `@tag:${WORKSPACE_TRUST_SETTING_TAG}`,
        '@tag:sync',
        '@tag:usesOnlineServices',
        '@tag:telemetry',
        '@tag:accessibility',
        '@tag:preview',
        '@tag:experimental',
        `@tag:${ADVANCED_SETTING_TAG}`,
        `@${ID_SETTING_TAG}`,
        `@${EXTENSION_SETTING_TAG}`,
        `@${FEATURE_SETTING_TAG}scm`,
        `@${FEATURE_SETTING_TAG}explorer`,
        `@${FEATURE_SETTING_TAG}search`,
        `@${FEATURE_SETTING_TAG}debug`,
        `@${FEATURE_SETTING_TAG}extensions`,
        `@${FEATURE_SETTING_TAG}terminal`,
        `@${FEATURE_SETTING_TAG}task`,
        `@${FEATURE_SETTING_TAG}problems`,
        `@${FEATURE_SETTING_TAG}output`,
        `@${FEATURE_SETTING_TAG}comments`,
        `@${FEATURE_SETTING_TAG}remote`,
        `@${FEATURE_SETTING_TAG}timeline`,
        `@${FEATURE_SETTING_TAG}notebook`,
        `@${POLICY_SETTING_TAG}`
    ]; }
    static shouldSettingUpdateFast(type) {
        if (Array.isArray(type)) {
            // nullable integer/number or complex
            return false;
        }
        return type === SettingValueType.Enum ||
            type === SettingValueType.Array ||
            type === SettingValueType.BooleanObject ||
            type === SettingValueType.Object ||
            type === SettingValueType.Complex ||
            type === SettingValueType.Boolean ||
            type === SettingValueType.Exclude ||
            type === SettingValueType.Include;
    }
    constructor(group, telemetryService, configurationService, textResourceConfigurationService, themeService, preferencesService, instantiationService, preferencesSearchService, logService, contextKeyService, storageService, editorGroupService, userDataSyncWorkbenchService, userDataSyncEnablementService, workspaceTrustManagementService, extensionService, languageService, extensionManagementService, productService, extensionGalleryService, editorProgressService, userDataProfileService, keybindingService, chatEntitlementService) {
        super(SettingsEditor2_1.ID, group, telemetryService, themeService, storageService);
        this.configurationService = configurationService;
        this.preferencesService = preferencesService;
        this.instantiationService = instantiationService;
        this.preferencesSearchService = preferencesSearchService;
        this.logService = logService;
        this.storageService = storageService;
        this.editorGroupService = editorGroupService;
        this.userDataSyncWorkbenchService = userDataSyncWorkbenchService;
        this.userDataSyncEnablementService = userDataSyncEnablementService;
        this.workspaceTrustManagementService = workspaceTrustManagementService;
        this.extensionService = extensionService;
        this.languageService = languageService;
        this.extensionManagementService = extensionManagementService;
        this.productService = productService;
        this.extensionGalleryService = extensionGalleryService;
        this.editorProgressService = editorProgressService;
        this.keybindingService = keybindingService;
        this.chatEntitlementService = chatEntitlementService;
        this.searchContainer = null;
        this.settingsTreeModel = this._register(new MutableDisposable());
        this.searchInProgress = null;
        this.aiSearchPromise = null;
        this.showAiResultsAction = null;
        this.pendingSettingUpdate = null;
        this._searchResultModel = this._register(new MutableDisposable());
        this.searchResultLabel = null;
        this.lastSyncedLabel = null;
        this.settingsOrderByTocIndex = null;
        this._currentFocusContext = 0 /* SettingsFocusContext.Search */;
        /** Don't spam warnings */
        this.hasWarnedMissingSettings = false;
        this.tocTreeDisposed = false;
        this.tocFocusedElement = null;
        this.treeFocusedElement = null;
        this.settingsTreeScrollTop = 0;
        this.installedExtensionIds = [];
        this.dismissedExtensionSettings = [];
        this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY = 'settingsEditor2.dismissedExtensionSettings';
        this.DISMISSED_EXTENSION_SETTINGS_DELIMITER = '\t';
        this.searchInputActionBar = null;
        this.searchDelayer = new Delayer(200);
        this.viewState = { settingsTarget: 3 /* ConfigurationTarget.USER_LOCAL */ };
        this.settingFastUpdateDelayer = new Delayer(SettingsEditor2_1.SETTING_UPDATE_FAST_DEBOUNCE);
        this.settingSlowUpdateDelayer = new Delayer(SettingsEditor2_1.SETTING_UPDATE_SLOW_DEBOUNCE);
        this.searchInputDelayer = new Delayer(SettingsEditor2_1.SEARCH_DEBOUNCE);
        this.updatedConfigSchemaDelayer = new Delayer(SettingsEditor2_1.CONFIG_SCHEMA_UPDATE_DELAYER);
        this.inSettingsEditorContextKey = CONTEXT_SETTINGS_EDITOR.bindTo(contextKeyService);
        this.searchFocusContextKey = CONTEXT_SETTINGS_SEARCH_FOCUS.bindTo(contextKeyService);
        this.tocRowFocused = CONTEXT_TOC_ROW_FOCUS.bindTo(contextKeyService);
        this.settingRowFocused = CONTEXT_SETTINGS_ROW_FOCUS.bindTo(contextKeyService);
        this.aiResultsAvailable = CONTEXT_AI_SETTING_RESULTS_AVAILABLE.bindTo(contextKeyService);
        this.scheduledRefreshes = new Map();
        this.stopWatch = new StopWatch(false);
        this.editorMemento = this.getEditorMemento(editorGroupService, textResourceConfigurationService, SETTINGS_EDITOR_STATE_KEY);
        this.dismissedExtensionSettings = this.storageService
            .get(this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY, 0 /* StorageScope.PROFILE */, '')
            .split(this.DISMISSED_EXTENSION_SETTINGS_DELIMITER);
        this._register(configurationService.onDidChangeConfiguration(e => {
            if (e.affectedKeys.has(WorkbenchSettingsEditorSettings.ShowAISearchToggle)
                || e.affectedKeys.has(WorkbenchSettingsEditorSettings.EnableNaturalLanguageSearch)) {
                this.updateAiSearchToggleVisibility();
            }
            if (e.source !== 7 /* ConfigurationTarget.DEFAULT */) {
                this.onConfigUpdate(e.affectedKeys);
            }
        }));
        this._register(chatEntitlementService.onDidChangeSentiment(() => {
            this.updateAiSearchToggleVisibility();
        }));
        this._register(userDataProfileService.onDidChangeCurrentProfile(e => {
            e.join(this.whenCurrentProfileChanged());
        }));
        this._register(workspaceTrustManagementService.onDidChangeTrust(() => {
            this.searchResultModel?.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted());
            if (this.settingsTreeModel.value) {
                this.settingsTreeModel.value.updateWorkspaceTrust(workspaceTrustManagementService.isWorkspaceTrusted());
                this.renderTree();
            }
        }));
        this._register(configurationService.onDidChangeRestrictedSettings(e => {
            if (e.default.length && this.currentSettingsModel) {
                this.updateElementsByKey(new Set(e.default));
            }
        }));
        this._register(extensionManagementService.onDidInstallExtensions(() => {
            this.refreshInstalledExtensionsList();
        }));
        this._register(extensionManagementService.onDidUninstallExtension(() => {
            this.refreshInstalledExtensionsList();
        }));
        this.modelDisposables = this._register(new DisposableStore());
        if (ENABLE_LANGUAGE_FILTER && !SettingsEditor2_1.SUGGESTIONS.includes(`@${LANGUAGE_SETTING_TAG}`)) {
            SettingsEditor2_1.SUGGESTIONS.push(`@${LANGUAGE_SETTING_TAG}`);
        }
        this.inputChangeListener = this._register(new MutableDisposable());
    }
    async whenCurrentProfileChanged() {
        this.updatedConfigSchemaDelayer.trigger(() => {
            this.dismissedExtensionSettings = this.storageService
                .get(this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY, 0 /* StorageScope.PROFILE */, '')
                .split(this.DISMISSED_EXTENSION_SETTINGS_DELIMITER);
            this.onConfigUpdate(undefined, true);
        });
    }
    canShowAdvancedSettings() {
        return this.viewState.tagFilters?.has(ADVANCED_SETTING_TAG) ?? false;
    }
    /**
     * Determines whether a setting should be shown even when advanced settings are filtered out.
     * Returns true if:
     * - The setting is not tagged as advanced, OR
     * - The setting matches an ID filter (@id:settingKey), OR
     * - The setting key appears in the search query, OR
     * - The @hasPolicy filter is active (policy settings should always be shown when filtering by policy)
     */
    shouldShowSetting(setting) {
        if (!setting.tags?.includes(ADVANCED_SETTING_TAG)) {
            return true;
        }
        if (this.viewState.idFilters?.has(setting.key)) {
            return true;
        }
        if (this.viewState.query?.toLowerCase().includes(setting.key.toLowerCase())) {
            return true;
        }
        if (this.viewState.tagFilters?.has(POLICY_SETTING_TAG)) {
            return true;
        }
        return false;
    }
    disableAiSearchToggle() {
        if (this.showAiResultsAction) {
            this.showAiResultsAction.checked = false;
            this.showAiResultsAction.enabled = false;
            this.aiResultsAvailable.set(false);
            this.showAiResultsAction.label = SHOW_AI_RESULTS_DISABLED_LABEL;
        }
    }
    updateAiSearchToggleVisibility() {
        if (!this.searchContainer || !this.showAiResultsAction || !this.searchInputActionBar) {
            return;
        }
        const showAiToggle = this.configurationService.getValue(WorkbenchSettingsEditorSettings.ShowAISearchToggle);
        const enableNaturalLanguageSearch = this.configurationService.getValue(WorkbenchSettingsEditorSettings.EnableNaturalLanguageSearch);
        const chatHidden = this.chatEntitlementService.sentiment.hidden || this.chatEntitlementService.sentiment.disabled;
        const canShowToggle = showAiToggle && enableNaturalLanguageSearch && !chatHidden;
        const alreadyVisible = this.searchInputActionBar.hasAction(this.showAiResultsAction);
        if (!alreadyVisible && canShowToggle) {
            this.searchInputActionBar.push(this.showAiResultsAction, {
                index: 0,
                label: false,
                icon: true
            });
            this.searchContainer.classList.add('with-ai-toggle');
        }
        else if (alreadyVisible) {
            this.searchInputActionBar.pull(0);
            this.searchContainer.classList.remove('with-ai-toggle');
            this.showAiResultsAction.checked = false;
        }
    }
    get minimumWidth() { return SettingsEditor2_1.EDITOR_MIN_WIDTH; }
    get maximumWidth() { return Number.POSITIVE_INFINITY; }
    get minimumHeight() { return 180; }
    // these setters need to exist because this extends from EditorPane
    set minimumWidth(value) { }
    set maximumWidth(value) { }
    get currentSettingsModel() {
        return this.searchResultModel || this.settingsTreeModel.value;
    }
    get searchResultModel() {
        return this._searchResultModel.value ?? null;
    }
    set searchResultModel(value) {
        this._searchResultModel.value = value ?? undefined;
        this.rootElement.classList.toggle('search-mode', !!this._searchResultModel.value);
    }
    get focusedSettingDOMElement() {
        const focused = this.settingsTree.getFocus()[0];
        if (!(focused instanceof SettingsTreeSettingElement)) {
            return;
        }
        return this.settingRenderers.getDOMElementsForSettingKey(this.settingsTree.getHTMLElement(), focused.setting.key)[0];
    }
    get currentFocusContext() {
        return this._currentFocusContext;
    }
    createEditor(parent) {
        parent.setAttribute('tabindex', '-1');
        this.rootElement = DOM.append(parent, $('.settings-editor', { tabindex: '-1' }));
        this.createHeader(this.rootElement);
        this.createBody(this.rootElement);
        this.addCtrlAInterceptor(this.rootElement);
        this.updateStyles();
        this._register(registerNavigableContainer({
            name: 'settingsEditor2',
            focusNotifiers: [this],
            focusNextWidget: () => {
                if (this.searchWidget.inputWidget.hasWidgetFocus()) {
                    this.focusTOC();
                }
            },
            focusPreviousWidget: () => {
                if (!this.searchWidget.inputWidget.hasWidgetFocus()) {
                    this.focusSearch();
                }
            }
        }));
    }
    async setInput(input, options, context, token) {
        this.inSettingsEditorContextKey.set(true);
        await super.setInput(input, options, context, token);
        if (!this.input) {
            return;
        }
        const model = await this.input.resolve();
        if (token.isCancellationRequested || !(model instanceof Settings2EditorModel)) {
            return;
        }
        this.modelDisposables.clear();
        this.modelDisposables.add(model.onDidChangeGroups(() => {
            this.updatedConfigSchemaDelayer.trigger(() => {
                this.onConfigUpdate(undefined, false, true);
            });
        }));
        this.defaultSettingsEditorModel = model;
        options = options || validateSettingsEditorOptions({});
        if (!this.viewState.settingsTarget || !this.settingsTargetsWidget.settingsTarget) {
            const optionsHasViewStateTarget = options.viewState && options.viewState.settingsTarget;
            if (!options.target && !optionsHasViewStateTarget) {
                options.target = 3 /* ConfigurationTarget.USER_LOCAL */;
            }
        }
        this._setOptions(options);
        // Don't block setInput on render (which can trigger an async search)
        this.onConfigUpdate(undefined, true).then(() => {
            // This event runs when the editor closes.
            this.inputChangeListener.value = input.onWillDispose(() => {
                this.searchWidget.setValue('');
            });
            // Init TOC selection
            this.updateTreeScrollSync();
        });
        await this.refreshInstalledExtensionsList();
    }
    async refreshInstalledExtensionsList() {
        const installedExtensions = await this.extensionManagementService.getInstalled();
        this.installedExtensionIds = installedExtensions
            .filter(ext => ext.manifest.contributes?.configuration)
            .map(ext => ext.identifier.id);
    }
    restoreCachedState() {
        const cachedState = this.input && this.editorMemento.loadEditorState(this.group, this.input);
        if (cachedState && typeof cachedState.target === 'object') {
            cachedState.target = URI.revive(cachedState.target);
        }
        if (cachedState) {
            const settingsTarget = cachedState.target;
            this.settingsTargetsWidget.settingsTarget = settingsTarget;
            this.viewState.settingsTarget = settingsTarget;
            if (!this.searchWidget.getValue()) {
                this.searchWidget.setValue(cachedState.searchQuery);
            }
        }
        if (this.input) {
            this.editorMemento.clearEditorState(this.input, this.group);
        }
        return cachedState ?? null;
    }
    getViewState() {
        return this.viewState;
    }
    setOptions(options) {
        super.setOptions(options);
        if (options) {
            this._setOptions(options);
        }
    }
    _setOptions(options) {
        if (options.focusSearch && !platform.isIOS) {
            // isIOS - #122044
            this.focusSearch();
        }
        const recoveredViewState = options.viewState ?
            options.viewState : undefined;
        const query = recoveredViewState?.query ?? options.query;
        if (query !== undefined) {
            this.searchWidget.setValue(query);
            this.viewState.query = query;
        }
        const target = options.folderUri ?? recoveredViewState?.settingsTarget ?? options.target;
        if (target) {
            this.settingsTargetsWidget.updateTarget(target);
        }
    }
    clearInput() {
        this.inSettingsEditorContextKey.set(false);
        super.clearInput();
    }
    layout(dimension) {
        this.dimension = dimension;
        if (!this.isVisible()) {
            return;
        }
        this.layoutSplitView(dimension);
        const innerWidth = Math.min(this.headerContainer.clientWidth, dimension.width) - 24 * 2; // 24px padding on left and right;
        // minus padding inside inputbox, controls width, and extra padding before countElement
        const monacoWidth = innerWidth - 10 - this.controlsElement.clientWidth - 12;
        this.searchWidget.layout(new DOM.Dimension(monacoWidth, 20));
        this.rootElement.classList.toggle('narrow-width', dimension.width < SettingsEditor2_1.NARROW_TOTAL_WIDTH);
    }
    focus() {
        super.focus();
        if (this._currentFocusContext === 0 /* SettingsFocusContext.Search */) {
            if (!platform.isIOS) {
                // #122044
                this.focusSearch();
            }
        }
        else if (this._currentFocusContext === 3 /* SettingsFocusContext.SettingControl */) {
            const element = this.focusedSettingDOMElement;
            if (element) {
                // eslint-disable-next-line no-restricted-syntax
                const control = element.querySelector(AbstractSettingRenderer.CONTROL_SELECTOR);
                if (control) {
                    control.focus();
                    return;
                }
            }
        }
        else if (this._currentFocusContext === 2 /* SettingsFocusContext.SettingTree */) {
            this.settingsTree.domFocus();
        }
        else if (this._currentFocusContext === 1 /* SettingsFocusContext.TableOfContents */) {
            this.tocTree.domFocus();
        }
    }
    setEditorVisible(visible) {
        super.setEditorVisible(visible);
        if (!visible) {
            // Wait for editor to be removed from DOM #106303
            setTimeout(() => {
                this.searchWidget.onHide();
                this.settingRenderers.cancelSuggesters();
            }, 0);
        }
    }
    focusSettings(focusSettingInput = false) {
        const focused = this.settingsTree.getFocus();
        if (!focused.length) {
            this.settingsTree.focusFirst();
        }
        this.settingsTree.domFocus();
        if (focusSettingInput) {
            // eslint-disable-next-line no-restricted-syntax
            const controlInFocusedRow = this.settingsTree.getHTMLElement().querySelector(`.focused ${AbstractSettingRenderer.CONTROL_SELECTOR}`);
            if (controlInFocusedRow) {
                controlInFocusedRow.focus();
            }
        }
    }
    focusTOC() {
        this.tocTree.domFocus();
    }
    showContextMenu() {
        const focused = this.settingsTree.getFocus()[0];
        const rowElement = this.focusedSettingDOMElement;
        if (rowElement && focused instanceof SettingsTreeSettingElement) {
            this.settingRenderers.showContextMenu(focused, rowElement);
        }
    }
    focusSearch(filter, selectAll = true) {
        if (filter && this.searchWidget) {
            this.searchWidget.setValue(filter);
        }
        // Do not select all if the user is already searching.
        this.searchWidget.focus(selectAll && !this.searchInputDelayer.isTriggered);
    }
    clearSearchResults() {
        this.disableAiSearchToggle();
        this.searchWidget.setValue('');
        this.focusSearch();
    }
    clearSearchFilters() {
        const query = this.searchWidget.getValue();
        const splitQuery = query.split(' ').filter(word => {
            return word.length && !SettingsEditor2_1.SUGGESTIONS.some(suggestion => word.startsWith(suggestion));
        });
        this.searchWidget.setValue(splitQuery.join(' '));
    }
    updateInputAriaLabel() {
        let label = searchBoxLabel;
        if (this.searchResultLabel) {
            label += `. ${this.searchResultLabel}`;
        }
        if (this.lastSyncedLabel) {
            label += `. ${this.lastSyncedLabel}`;
        }
        this.searchWidget.updateAriaLabel(label);
    }
    /**
     * Render the header of the Settings editor, which includes the content above the splitview.
     */
    createHeader(parent) {
        this.headerContainer = DOM.append(parent, $('.settings-header'));
        this.searchContainer = DOM.append(this.headerContainer, $('.search-container'));
        const clearInputAction = this._register(new Action(SETTINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS, localize('clearInput', "Clear Settings Search Input"), ThemeIcon.asClassName(preferencesClearInputIcon), false, async () => this.clearSearchResults()));
        const showAiResultActionClassNames = ['action-label', ThemeIcon.asClassName(preferencesAiResultsIcon)];
        this.showAiResultsAction = this._register(new Action(SETTINGS_EDITOR_COMMAND_SHOW_AI_RESULTS, SHOW_AI_RESULTS_DISABLED_LABEL, showAiResultActionClassNames.join(' '), true));
        this._register(this.showAiResultsAction.onDidChange(async () => {
            await this.onDidToggleAiSearch();
        }));
        const filterAction = this._register(new Action(SETTINGS_EDITOR_COMMAND_SUGGEST_FILTERS, localize('filterInput', "Filter Settings"), ThemeIcon.asClassName(preferencesFilterIcon)));
        this.searchWidget = this._register(this.instantiationService.createInstance(SuggestEnabledInput, `${SettingsEditor2_1.ID}.searchbox`, this.searchContainer, {
            triggerCharacters: ['@', ':'],
            provideResults: (query) => {
                // Based on testing, the trigger character is always at the end of the query.
                // for the ':' trigger, only return suggestions if there was a '@' before it in the same word.
                const queryParts = query.split(/\s/g);
                if (queryParts[queryParts.length - 1].startsWith(`@${LANGUAGE_SETTING_TAG}`)) {
                    const sortedLanguages = this.languageService.getRegisteredLanguageIds().map(languageId => {
                        return `@${LANGUAGE_SETTING_TAG}${languageId} `;
                    }).sort();
                    return sortedLanguages.filter(langFilter => !query.includes(langFilter));
                }
                else if (queryParts[queryParts.length - 1].startsWith(`@${EXTENSION_SETTING_TAG}`)) {
                    const installedExtensionsTags = this.installedExtensionIds.map(extensionId => {
                        return `@${EXTENSION_SETTING_TAG}${extensionId} `;
                    }).sort();
                    return installedExtensionsTags.filter(extFilter => !query.includes(extFilter));
                }
                else if (queryParts[queryParts.length - 1].startsWith('@')) {
                    return SettingsEditor2_1.SUGGESTIONS.filter(tag => !query.includes(tag)).map(tag => tag.endsWith(':') ? tag : tag + ' ');
                }
                return [];
            }
        }, searchBoxLabel, 'settingseditor:searchinput' + SettingsEditor2_1.NUM_INSTANCES++, {
            placeholderText: searchBoxLabel,
            focusContextKey: this.searchFocusContextKey,
            styleOverrides: {
                inputBorder: settingsTextInputBorder
            }
            // TODO: Aria-live
        }));
        this._register(this.searchWidget.onDidFocus(() => {
            this._currentFocusContext = 0 /* SettingsFocusContext.Search */;
        }));
        this._register(this.searchWidget.onInputDidChange(() => {
            const searchVal = this.searchWidget.getValue();
            clearInputAction.enabled = !!searchVal;
            this.searchInputDelayer.trigger(() => this.onSearchInputChanged(true));
        }));
        const headerControlsContainer = DOM.append(this.headerContainer, $('.settings-header-controls'));
        headerControlsContainer.style.borderColor = asCssVariable(settingsHeaderBorder);
        const targetWidgetContainer = DOM.append(headerControlsContainer, $('.settings-target-container'));
        this.settingsTargetsWidget = this._register(this.instantiationService.createInstance(SettingsTargetsWidget, targetWidgetContainer, { enableRemoteSettings: true }));
        this.settingsTargetsWidget.settingsTarget = 3 /* ConfigurationTarget.USER_LOCAL */;
        this._register(this.settingsTargetsWidget.onDidTargetChange(target => this.onDidSettingsTargetChange(target)));
        this._register(DOM.addDisposableListener(targetWidgetContainer, DOM.EventType.KEY_DOWN, e => {
            const event = new StandardKeyboardEvent(e);
            if (event.keyCode === 18 /* KeyCode.DownArrow */) {
                this.focusSettings();
            }
        }));
        if (this.userDataSyncWorkbenchService.enabled && this.userDataSyncEnablementService.canToggleEnablement()) {
            const syncControls = this._register(this.instantiationService.createInstance(SyncControls, this.window, headerControlsContainer));
            this._register(syncControls.onDidChangeLastSyncedLabel(lastSyncedLabel => {
                this.lastSyncedLabel = lastSyncedLabel;
                this.updateInputAriaLabel();
            }));
        }
        this.controlsElement = DOM.append(this.searchContainer, DOM.$('.search-container-widgets'));
        this.countElement = DOM.append(this.controlsElement, DOM.$('.settings-count-widget.monaco-count-badge.long'));
        this.countElement.style.backgroundColor = asCssVariable(badgeBackground);
        this.countElement.style.color = asCssVariable(badgeForeground);
        this.countElement.style.border = `1px solid ${asCssVariableWithDefault(contrastBorder, asCssVariable(inputBackground))}`;
        this.searchInputActionBar = this._register(new ActionBar(this.controlsElement, {
            actionViewItemProvider: (action, options) => {
                if (action.id === filterAction.id) {
                    return this.instantiationService.createInstance(SettingsSearchFilterDropdownMenuActionViewItem, action, options, this.actionRunner, this.searchWidget);
                }
                if (this.showAiResultsAction && action.id === this.showAiResultsAction.id) {
                    const keybindingLabel = this.keybindingService.lookupKeybinding(SETTINGS_EDITOR_COMMAND_TOGGLE_AI_SEARCH)?.getLabel();
                    return new ToggleActionViewItem(null, action, { ...options, keybinding: keybindingLabel, toggleStyles: defaultToggleStyles });
                }
                return undefined;
            }
        }));
        const actionsToPush = [clearInputAction, filterAction];
        this.searchInputActionBar.push(actionsToPush, { label: false, icon: true });
        this.disableAiSearchToggle();
        this.updateAiSearchToggleVisibility();
    }
    toggleAiSearch() {
        if (this.searchInputActionBar && this.showAiResultsAction && this.searchInputActionBar.hasAction(this.showAiResultsAction)) {
            if (!this.showAiResultsAction.enabled) {
                aria.status(localize('noAiResults', "No AI results available at this time."));
            }
            this.showAiResultsAction.checked = !this.showAiResultsAction.checked;
        }
    }
    async onDidToggleAiSearch() {
        if (this.searchResultModel && this.showAiResultsAction) {
            this.searchResultModel.showAiResults = this.showAiResultsAction.checked ?? false;
            this.renderResultCountMessages(false);
            this.onDidFinishSearch(true, undefined);
        }
    }
    onDidSettingsTargetChange(target) {
        this.viewState.settingsTarget = target;
        // TODO Instead of rebuilding the whole model, refresh and uncache the inspected setting value
        this.onConfigUpdate(undefined, true);
    }
    onDidDismissExtensionSetting(extensionId) {
        if (!this.dismissedExtensionSettings.includes(extensionId)) {
            this.dismissedExtensionSettings.push(extensionId);
        }
        this.storageService.store(this.DISMISSED_EXTENSION_SETTINGS_STORAGE_KEY, this.dismissedExtensionSettings.join(this.DISMISSED_EXTENSION_SETTINGS_DELIMITER), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        this.onConfigUpdate(undefined, true);
    }
    onDidClickSetting(evt, recursed) {
        // eslint-disable-next-line no-restricted-syntax
        const targetElement = this.currentSettingsModel?.getElementsByName(evt.targetKey)?.[0];
        let revealFailed = false;
        if (targetElement) {
            let sourceTop = 0.5;
            try {
                const _sourceTop = this.settingsTree.getRelativeTop(evt.source);
                if (_sourceTop !== null) {
                    sourceTop = _sourceTop;
                }
            }
            catch {
                // e.g. clicked a searched element, now the search has been cleared
            }
            // If we search for something and focus on a category, the settings tree
            // only renders settings in that category.
            // If the target display category is different than the source's, unfocus the category
            // so that we can render all found settings again.
            // Then, the reveal call will correctly find the target setting.
            if (this.viewState.filterToCategory && evt.source.displayCategory !== targetElement.displayCategory) {
                this.tocTree.setFocus([]);
            }
            try {
                this.settingsTree.reveal(targetElement, sourceTop);
            }
            catch (_) {
                // The listwidget couldn't find the setting to reveal,
                // even though it's in the model, meaning there might be a filter
                // preventing it from showing up.
                revealFailed = true;
            }
            if (!revealFailed) {
                // We need to shift focus from the setting that contains the link to the setting that's
                // linked. Clicking on the link sets focus on the setting that contains the link,
                // which is why we need the setTimeout.
                setTimeout(() => {
                    this.settingsTree.setFocus([targetElement]);
                }, 50);
                const domElements = this.settingRenderers.getDOMElementsForSettingKey(this.settingsTree.getHTMLElement(), evt.targetKey);
                if (domElements && domElements[0]) {
                    // eslint-disable-next-line no-restricted-syntax
                    const control = domElements[0].querySelector(AbstractSettingRenderer.CONTROL_SELECTOR);
                    if (control) {
                        control.focus();
                    }
                }
            }
        }
        if (!recursed && (!targetElement || revealFailed)) {
            // We'll call this event handler again after clearing the search query,
            // so that more settings show up in the list.
            const p = this.triggerSearch('', true);
            p.then(() => {
                this.searchWidget.setValue('');
                this.onDidClickSetting(evt, true);
            });
        }
    }
    switchToSettingsFile() {
        const query = parseQuery(this.searchWidget.getValue()).query;
        return this.openSettingsFile({ query });
    }
    async openSettingsFile(options) {
        const currentSettingsTarget = this.settingsTargetsWidget.settingsTarget;
        const openOptions = { jsonEditor: true, groupId: this.group.id, ...options };
        if (currentSettingsTarget === 3 /* ConfigurationTarget.USER_LOCAL */) {
            if (options?.revealSetting) {
                const configurationProperties = Registry.as(Extensions.Configuration).getConfigurationProperties();
                const configurationScope = configurationProperties[options?.revealSetting.key]?.scope;
                if (configurationScope && APPLICATION_SCOPES.includes(configurationScope)) {
                    return this.preferencesService.openApplicationSettings(openOptions);
                }
            }
            return this.preferencesService.openUserSettings(openOptions);
        }
        else if (currentSettingsTarget === 4 /* ConfigurationTarget.USER_REMOTE */) {
            return this.preferencesService.openRemoteSettings(openOptions);
        }
        else if (currentSettingsTarget === 5 /* ConfigurationTarget.WORKSPACE */) {
            return this.preferencesService.openWorkspaceSettings(openOptions);
        }
        else if (URI.isUri(currentSettingsTarget)) {
            return this.preferencesService.openFolderSettings({ folderUri: currentSettingsTarget, ...openOptions });
        }
        return undefined;
    }
    createBody(parent) {
        this.bodyContainer = DOM.append(parent, $('.settings-body'));
        this.noResultsMessage = DOM.append(this.bodyContainer, $('.no-results-message'));
        this.noResultsMessage.innerText = localize('noResults', "No Settings Found");
        this.clearFilterLinkContainer = $('span.clear-search-filters');
        this.clearFilterLinkContainer.textContent = ' - ';
        const clearFilterLink = DOM.append(this.clearFilterLinkContainer, $('a.pointer.prominent', { tabindex: 0 }, localize('clearSearchFilters', 'Clear Filters')));
        this._register(DOM.addDisposableListener(clearFilterLink, DOM.EventType.CLICK, (e) => {
            DOM.EventHelper.stop(e, false);
            this.clearSearchFilters();
        }));
        DOM.append(this.noResultsMessage, this.clearFilterLinkContainer);
        this.noResultsMessage.style.color = asCssVariable(editorForeground);
        this.tocTreeContainer = $('.settings-toc-container');
        this.settingsTreeContainer = $('.settings-tree-container');
        this.createTOC(this.tocTreeContainer);
        this.createSettingsTree(this.settingsTreeContainer);
        this.splitView = this._register(new SplitView(this.bodyContainer, {
            orientation: 1 /* Orientation.HORIZONTAL */,
            proportionalLayout: true
        }));
        const startingWidth = this.storageService.getNumber('settingsEditor2.splitViewWidth', 0 /* StorageScope.PROFILE */, SettingsEditor2_1.TOC_RESET_WIDTH);
        this.splitView.addView({
            onDidChange: Event.None,
            element: this.tocTreeContainer,
            minimumSize: SettingsEditor2_1.TOC_MIN_WIDTH,
            maximumSize: Number.POSITIVE_INFINITY,
            layout: (width, _, height) => {
                this.tocTreeContainer.style.width = `${width}px`;
                this.tocTree.layout(height, width);
            }
        }, startingWidth, undefined, true);
        this.splitView.addView({
            onDidChange: Event.None,
            element: this.settingsTreeContainer,
            minimumSize: SettingsEditor2_1.EDITOR_MIN_WIDTH,
            maximumSize: Number.POSITIVE_INFINITY,
            layout: (width, _, height) => {
                this.settingsTreeContainer.style.width = `${width}px`;
                this.settingsTree.layout(height, width);
            }
        }, Sizing.Distribute, undefined, true);
        this._register(this.splitView.onDidSashReset(() => {
            const totalSize = this.splitView.getViewSize(0) + this.splitView.getViewSize(1);
            this.splitView.resizeView(0, SettingsEditor2_1.TOC_RESET_WIDTH);
            this.splitView.resizeView(1, totalSize - SettingsEditor2_1.TOC_RESET_WIDTH);
        }));
        this._register(this.splitView.onDidSashChange(() => {
            const width = this.splitView.getViewSize(0);
            this.storageService.store('settingsEditor2.splitViewWidth', width, 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        }));
        const borderColor = this.theme.getColor(settingsSashBorder);
        this.splitView.style({ separatorBorder: borderColor });
    }
    addCtrlAInterceptor(container) {
        this._register(DOM.addStandardDisposableListener(container, DOM.EventType.KEY_DOWN, (e) => {
            if (e.keyCode === 31 /* KeyCode.KeyA */ &&
                (platform.isMacintosh ? e.metaKey : e.ctrlKey) &&
                !DOM.isEditableElement(e.target)) {
                // Avoid browser ctrl+a
                e.browserEvent.stopPropagation();
                e.browserEvent.preventDefault();
            }
        }));
    }
    createTOC(container) {
        this.tocTreeModel = this.instantiationService.createInstance(TOCTreeModel, this.viewState);
        this.tocTree = this._register(this.instantiationService.createInstance(TOCTree, DOM.append(container, $('.settings-toc-wrapper', {
            'role': 'navigation',
            'aria-label': localize('settings', "Settings"),
        })), this.viewState));
        this.tocTreeDisposed = false;
        this._register(this.tocTree.onDidFocus(() => {
            this._currentFocusContext = 1 /* SettingsFocusContext.TableOfContents */;
        }));
        this._register(this.tocTree.onDidChangeFocus(e => {
            const element = e.elements?.[0] ?? null;
            if (this.tocFocusedElement === element) {
                return;
            }
            this.tocFocusedElement = element;
            this.tocTree.setSelection(element ? [element] : []);
            if (this.searchResultModel) {
                if (this.viewState.filterToCategory !== element) {
                    this.viewState.filterToCategory = element ?? undefined;
                    // Force render in this case, because
                    // onDidClickSetting relies on the updated view.
                    this.renderTree(undefined, true);
                    this.settingsTree.scrollTop = 0;
                }
            }
            else if (element && (!e.browserEvent || !e.browserEvent.fromScroll)) {
                this.settingsTree.reveal(element, 0);
                this.settingsTree.setFocus([element]);
            }
        }));
        this._register(this.tocTree.onDidFocus(() => {
            this.tocRowFocused.set(true);
        }));
        this._register(this.tocTree.onDidBlur(() => {
            this.tocRowFocused.set(false);
        }));
        this._register(this.tocTree.onDidDispose(() => {
            this.tocTreeDisposed = true;
        }));
    }
    applyFilter(filter) {
        if (this.searchWidget && !this.searchWidget.getValue().includes(filter)) {
            // Prepend the filter to the query.
            const newQuery = `${filter} ${this.searchWidget.getValue().trimStart()}`;
            this.focusSearch(newQuery, false);
        }
    }
    removeLanguageFilters() {
        if (this.searchWidget && this.searchWidget.getValue().includes(`@${LANGUAGE_SETTING_TAG}`)) {
            const query = this.searchWidget.getValue().split(' ');
            const newQuery = query.filter(word => !word.startsWith(`@${LANGUAGE_SETTING_TAG}`)).join(' ');
            this.focusSearch(newQuery, false);
        }
    }
    createSettingsTree(container) {
        this.settingRenderers = this._register(this.instantiationService.createInstance(SettingTreeRenderers));
        this._register(this.settingRenderers.onDidChangeSetting(e => this.onDidChangeSetting(e.key, e.value, e.type, e.manualReset, e.scope)));
        this._register(this.settingRenderers.onDidDismissExtensionSetting((e) => this.onDidDismissExtensionSetting(e)));
        this._register(this.settingRenderers.onDidOpenSettings(settingKey => {
            this.openSettingsFile({ revealSetting: { key: settingKey, edit: true } });
        }));
        this._register(this.settingRenderers.onDidClickSettingLink(settingName => this.onDidClickSetting(settingName)));
        this._register(this.settingRenderers.onDidFocusSetting(element => {
            this.settingsTree.setFocus([element]);
            this._currentFocusContext = 3 /* SettingsFocusContext.SettingControl */;
            this.settingRowFocused.set(false);
        }));
        this._register(this.settingRenderers.onDidChangeSettingHeight((params) => {
            const { element, height } = params;
            try {
                this.settingsTree.updateElementHeight(element, height);
            }
            catch (e) {
                // the element was not found
            }
        }));
        this._register(this.settingRenderers.onApplyFilter((filter) => this.applyFilter(filter)));
        this._register(this.settingRenderers.onDidClickOverrideElement((element) => {
            this.removeLanguageFilters();
            if (element.language) {
                this.applyFilter(`@${LANGUAGE_SETTING_TAG}${element.language}`);
            }
            if (element.scope === 'workspace') {
                this.settingsTargetsWidget.updateTarget(5 /* ConfigurationTarget.WORKSPACE */);
            }
            else if (element.scope === 'user') {
                this.settingsTargetsWidget.updateTarget(3 /* ConfigurationTarget.USER_LOCAL */);
            }
            else if (element.scope === 'remote') {
                this.settingsTargetsWidget.updateTarget(4 /* ConfigurationTarget.USER_REMOTE */);
            }
            this.applyFilter(`@${ID_SETTING_TAG}${element.settingKey}`);
        }));
        this.settingsTree = this._register(this.instantiationService.createInstance(SettingsTree, container, this.viewState, this.settingRenderers.allRenderers));
        this._register(this.settingsTree.onDidScroll(() => {
            if (this.settingsTree.scrollTop === this.settingsTreeScrollTop) {
                return;
            }
            this.settingsTreeScrollTop = this.settingsTree.scrollTop;
            // setTimeout because calling setChildren on the settingsTree can trigger onDidScroll, so it fires when
            // setChildren has called on the settings tree but not the toc tree yet, so their rendered elements are out of sync
            setTimeout(() => {
                this.updateTreeScrollSync();
            }, 0);
        }));
        this._register(this.settingsTree.onDidFocus(() => {
            const classList = container.ownerDocument.activeElement?.classList;
            if (classList && classList.contains('monaco-list') && classList.contains('settings-editor-tree')) {
                this._currentFocusContext = 2 /* SettingsFocusContext.SettingTree */;
                this.settingRowFocused.set(true);
                this.treeFocusedElement ??= this.settingsTree.firstVisibleElement ?? null;
                if (this.treeFocusedElement) {
                    this.treeFocusedElement.tabbable = true;
                }
            }
        }));
        this._register(this.settingsTree.onDidBlur(() => {
            this.settingRowFocused.set(false);
            // Clear out the focused element, otherwise it could be
            // out of date during the next onDidFocus event.
            this.treeFocusedElement = null;
        }));
        // There is no different select state in the settings tree
        this._register(this.settingsTree.onDidChangeFocus(e => {
            const element = e.elements[0];
            if (this.treeFocusedElement === element) {
                return;
            }
            if (this.treeFocusedElement) {
                this.treeFocusedElement.tabbable = false;
            }
            this.treeFocusedElement = element;
            if (this.treeFocusedElement) {
                this.treeFocusedElement.tabbable = true;
            }
            this.settingsTree.setSelection(element ? [element] : []);
        }));
    }
    onDidChangeSetting(key, value, type, manualReset, scope) {
        const parsedQuery = parseQuery(this.searchWidget.getValue());
        const languageFilter = parsedQuery.languageFilter;
        if (manualReset || (this.pendingSettingUpdate && this.pendingSettingUpdate.key !== key)) {
            this.updateChangedSetting(key, value, manualReset, languageFilter, scope);
        }
        this.pendingSettingUpdate = { key, value, languageFilter };
        if (SettingsEditor2_1.shouldSettingUpdateFast(type)) {
            this.settingFastUpdateDelayer.trigger(() => this.updateChangedSetting(key, value, manualReset, languageFilter, scope));
        }
        else {
            this.settingSlowUpdateDelayer.trigger(() => this.updateChangedSetting(key, value, manualReset, languageFilter, scope));
        }
    }
    updateTreeScrollSync() {
        this.settingRenderers.cancelSuggesters();
        if (this.searchResultModel) {
            return;
        }
        if (!this.tocTreeModel) {
            return;
        }
        const elementToSync = this.settingsTree.firstVisibleElement;
        const element = elementToSync instanceof SettingsTreeSettingElement ? elementToSync.parent :
            elementToSync instanceof SettingsTreeGroupElement ? elementToSync :
                null;
        // It's possible for this to be called when the TOC and settings tree are out of sync - e.g. when the settings tree has deferred a refresh because
        // it is focused. So, bail if element doesn't exist in the TOC.
        let nodeExists = true;
        try {
            this.tocTree.getNode(element);
        }
        catch (e) {
            nodeExists = false;
        }
        if (!nodeExists) {
            return;
        }
        if (element && this.tocTree.getSelection()[0] !== element) {
            const ancestors = this.getAncestors(element);
            ancestors.forEach(e => this.tocTree.expand(e));
            this.tocTree.reveal(element);
            const elementTop = this.tocTree.getRelativeTop(element);
            if (typeof elementTop !== 'number') {
                return;
            }
            this.tocTree.collapseAll();
            ancestors.forEach(e => this.tocTree.expand(e));
            if (elementTop < 0 || elementTop > 1) {
                this.tocTree.reveal(element);
            }
            else {
                this.tocTree.reveal(element, elementTop);
            }
            this.tocTree.expand(element);
            this.tocTree.setSelection([element]);
            const fakeKeyboardEvent = new KeyboardEvent('keydown');
            fakeKeyboardEvent.fromScroll = true;
            this.tocTree.setFocus([element], fakeKeyboardEvent);
        }
    }
    getAncestors(element) {
        const ancestors = [];
        while (element.parent) {
            if (element.parent.id !== 'root') {
                ancestors.push(element.parent);
            }
            element = element.parent;
        }
        return ancestors.reverse();
    }
    updateChangedSetting(key, value, manualReset, languageFilter, scope) {
        // ConfigurationService displays the error if this fails.
        // Force a render afterwards because onDidConfigurationUpdate doesn't fire if the update doesn't result in an effective setting value change.
        const settingsTarget = this.settingsTargetsWidget.settingsTarget;
        const resource = URI.isUri(settingsTarget) ? settingsTarget : undefined;
        const configurationTarget = (resource ? 6 /* ConfigurationTarget.WORKSPACE_FOLDER */ : settingsTarget) ?? 3 /* ConfigurationTarget.USER_LOCAL */;
        const overrides = { resource, overrideIdentifiers: languageFilter ? [languageFilter] : undefined };
        const configurationTargetIsWorkspace = configurationTarget === 5 /* ConfigurationTarget.WORKSPACE */ || configurationTarget === 6 /* ConfigurationTarget.WORKSPACE_FOLDER */;
        const userPassedInManualReset = configurationTargetIsWorkspace || !!languageFilter;
        const isManualReset = userPassedInManualReset ? manualReset : value === undefined;
        // If the user is changing the value back to the default, and we're not targeting a workspace scope, do a 'reset' instead
        const inspected = this.configurationService.inspect(key, overrides);
        if (!userPassedInManualReset && inspected.defaultValue === value) {
            value = undefined;
        }
        return this.configurationService.updateValue(key, value, overrides, configurationTarget, { handleDirtyFile: 'save' })
            .then(() => {
            const query = this.searchWidget.getValue();
            if (query.includes(`@${MODIFIED_SETTING_TAG}`)) {
                // The user might have reset a setting.
                this.refreshTOCTree();
            }
            this.renderTree(key, isManualReset);
            this.pendingSettingUpdate = null;
            const reportModifiedProps = {
                key,
                query,
                searchResults: this.searchResultModel?.getUniqueSearchResults() ?? null,
                rawResults: this.searchResultModel?.getRawResults() ?? null,
                showConfiguredOnly: !!this.viewState.tagFilters && this.viewState.tagFilters.has(MODIFIED_SETTING_TAG),
                isReset: typeof value === 'undefined',
                settingsTarget: this.settingsTargetsWidget.settingsTarget
            };
            return this.reportModifiedSetting(reportModifiedProps);
        });
    }
    reportModifiedSetting(props) {
        let groupId = undefined;
        let providerName = undefined;
        let nlpIndex = undefined;
        let displayIndex = undefined;
        if (props.searchResults) {
            displayIndex = props.searchResults.filterMatches.findIndex(m => m.setting.key === props.key);
            if (this.searchResultModel) {
                providerName = props.searchResults.filterMatches.find(m => m.setting.key === props.key)?.providerName;
                const rawResults = this.searchResultModel.getRawResults();
                if (rawResults[0 /* SearchResultIdx.Local */] && displayIndex >= 0) {
                    const settingInLocalResults = rawResults[0 /* SearchResultIdx.Local */].filterMatches.some(m => m.setting.key === props.key);
                    groupId = settingInLocalResults ? 'local' : 'remote';
                }
                if (rawResults[1 /* SearchResultIdx.Remote */]) {
                    const _nlpIndex = rawResults[1 /* SearchResultIdx.Remote */].filterMatches.findIndex(m => m.setting.key === props.key);
                    nlpIndex = _nlpIndex >= 0 ? _nlpIndex : undefined;
                }
            }
        }
        const reportedTarget = props.settingsTarget === 3 /* ConfigurationTarget.USER_LOCAL */ ? 'user' :
            props.settingsTarget === 4 /* ConfigurationTarget.USER_REMOTE */ ? 'user_remote' :
                props.settingsTarget === 5 /* ConfigurationTarget.WORKSPACE */ ? 'workspace' :
                    'folder';
        const data = {
            key: props.key,
            groupId,
            providerName,
            nlpIndex,
            displayIndex,
            showConfiguredOnly: props.showConfiguredOnly,
            isReset: props.isReset,
            target: reportedTarget
        };
        this.telemetryService.publicLog2('settingsEditor.settingModified', data);
    }
    scheduleRefresh(element, key = '') {
        if (key && this.scheduledRefreshes.has(key)) {
            return;
        }
        if (!key) {
            dispose(this.scheduledRefreshes.values());
            this.scheduledRefreshes.clear();
        }
        const store = new DisposableStore();
        const scheduledRefreshTracker = DOM.trackFocus(element);
        store.add(scheduledRefreshTracker);
        store.add(scheduledRefreshTracker.onDidBlur(() => {
            this.scheduledRefreshes.get(key)?.dispose();
            this.scheduledRefreshes.delete(key);
            this.onConfigUpdate(new Set([key]));
        }));
        this.scheduledRefreshes.set(key, store);
    }
    createSettingsOrderByTocIndex(resolvedSettingsRoot) {
        const index = new Map();
        function indexSettings(resolvedSettingsRoot, counter = 0) {
            if (resolvedSettingsRoot.settings) {
                for (const setting of resolvedSettingsRoot.settings) {
                    if (!index.has(setting.key)) {
                        index.set(setting.key, counter++);
                    }
                }
            }
            if (resolvedSettingsRoot.children) {
                for (const child of resolvedSettingsRoot.children) {
                    counter = indexSettings(child, counter);
                }
            }
            return counter;
        }
        indexSettings(resolvedSettingsRoot);
        return index;
    }
    refreshModels(resolvedSettingsRoot) {
        // Both calls to refreshModels require a valid settingsTreeModel.
        this.settingsTreeModel.value.update(resolvedSettingsRoot);
        this.tocTreeModel.settingsTreeRoot = this.settingsTreeModel.value.root;
        this.settingsOrderByTocIndex = this.createSettingsOrderByTocIndex(resolvedSettingsRoot);
    }
    async onConfigUpdate(keys, forceRefresh = false, schemaChange = false) {
        if (keys && this.settingsTreeModel) {
            return this.updateElementsByKey(keys);
        }
        if (!this.defaultSettingsEditorModel) {
            return;
        }
        const groups = this.defaultSettingsEditorModel.settingsGroups.slice(1); // Without commonlyUsed
        const coreSettingsGroups = [], extensionSettingsGroups = [];
        for (const group of groups) {
            if (group.extensionInfo) {
                extensionSettingsGroups.push(group);
            }
            else {
                coreSettingsGroups.push(group);
            }
        }
        const filter = this.canShowAdvancedSettings() ? undefined : { exclude: { tags: [ADVANCED_SETTING_TAG] } };
        const settingsResult = resolveSettingsTree(tocData, coreSettingsGroups, filter, this.logService);
        const resolvedSettingsRoot = settingsResult.tree;
        // Warn for settings not included in layout
        if (settingsResult.leftoverSettings.size && !this.hasWarnedMissingSettings) {
            const settingKeyList = [];
            settingsResult.leftoverSettings.forEach(s => {
                settingKeyList.push(s.key);
            });
            this.logService.warn(`SettingsEditor2: Settings not included in settingsLayout.ts: ${settingKeyList.join(', ')}`);
            this.hasWarnedMissingSettings = true;
        }
        const additionalGroups = [];
        let setAdditionalGroups = false;
        const toggleData = await getExperimentalExtensionToggleData(this.chatEntitlementService, this.extensionGalleryService, this.productService);
        if (toggleData && groups.filter(g => g.extensionInfo).length) {
            for (const key in toggleData.settingsEditorRecommendedExtensions) {
                const extension = toggleData.recommendedExtensionsGalleryInfo[key];
                if (!extension) {
                    continue;
                }
                const extensionId = extension.identifier.id;
                // prevent race between extension update handler and this (onConfigUpdate) handler
                await this.refreshInstalledExtensionsList();
                const extensionInstalled = this.installedExtensionIds.includes(extensionId);
                // Drill down to see whether the group and setting already exist
                // and need to be removed.
                const matchingGroupIndex = groups.findIndex(g => g.extensionInfo && g.extensionInfo.id.toLowerCase() === extensionId.toLowerCase() &&
                    g.sections.length === 1 && g.sections[0].settings.length === 1 && g.sections[0].settings[0].displayExtensionId);
                if (extensionInstalled || this.dismissedExtensionSettings.includes(extensionId)) {
                    if (matchingGroupIndex !== -1) {
                        groups.splice(matchingGroupIndex, 1);
                        setAdditionalGroups = true;
                    }
                    continue;
                }
                if (matchingGroupIndex !== -1) {
                    continue;
                }
                // Create the entry. extensionInstalled is false in this case.
                let manifest = null;
                try {
                    manifest = await raceTimeout(this.extensionGalleryService.getManifest(extension, CancellationToken.None), EXTENSION_FETCH_TIMEOUT_MS) ?? null;
                }
                catch (e) {
                    // Likely a networking issue.
                    // Skip adding a button for this extension to the Settings editor.
                    continue;
                }
                if (manifest === null) {
                    continue;
                }
                const contributesConfiguration = manifest?.contributes?.configuration;
                let groupTitle;
                if (!Array.isArray(contributesConfiguration)) {
                    groupTitle = contributesConfiguration?.title;
                }
                else if (contributesConfiguration.length === 1) {
                    groupTitle = contributesConfiguration[0].title;
                }
                const recommendationInfo = toggleData.settingsEditorRecommendedExtensions[key];
                const extensionName = extension.displayName ?? extension.name ?? extensionId;
                const settingKey = `${key}.manageExtension`;
                const setting = {
                    range: nullRange,
                    key: settingKey,
                    keyRange: nullRange,
                    value: null,
                    valueRange: nullRange,
                    description: [recommendationInfo.onSettingsEditorOpen?.descriptionOverride ?? extension.description],
                    descriptionIsMarkdown: false,
                    descriptionRanges: [],
                    scope: 4 /* ConfigurationScope.WINDOW */,
                    type: 'null',
                    displayExtensionId: extensionId,
                    extensionGroupTitle: groupTitle ?? extensionName,
                    categoryLabel: 'Extensions',
                    title: extensionName
                };
                const additionalGroup = {
                    sections: [{
                            settings: [setting],
                        }],
                    id: extensionId,
                    title: setting.extensionGroupTitle,
                    titleRange: nullRange,
                    range: nullRange,
                    extensionInfo: {
                        id: extensionId,
                        displayName: extension.displayName,
                    }
                };
                groups.push(additionalGroup);
                additionalGroups.push(additionalGroup);
                setAdditionalGroups = true;
            }
        }
        resolvedSettingsRoot.children.push(await createTocTreeForExtensionSettings(this.extensionService, extensionSettingsGroups, filter));
        resolvedSettingsRoot.children.unshift(getCommonlyUsedData(groups, toggleData?.commonlyUsed));
        if (toggleData && setAdditionalGroups) {
            // Add the additional groups to the model to help with searching.
            this.defaultSettingsEditorModel.setAdditionalGroups(additionalGroups);
        }
        if (!this.workspaceTrustManagementService.isWorkspaceTrusted() && (this.viewState.settingsTarget instanceof URI || this.viewState.settingsTarget === 5 /* ConfigurationTarget.WORKSPACE */)) {
            const configuredUntrustedWorkspaceSettings = resolveConfiguredUntrustedSettings(groups, this.viewState.settingsTarget, this.viewState.languageFilter, this.configurationService);
            if (configuredUntrustedWorkspaceSettings.length) {
                resolvedSettingsRoot.children.unshift({
                    id: 'workspaceTrust',
                    label: localize('settings require trust', "Workspace Trust"),
                    settings: configuredUntrustedWorkspaceSettings
                });
            }
        }
        this.searchResultModel?.updateChildren();
        if (this.settingsTreeModel.value) {
            this.refreshModels(resolvedSettingsRoot);
            if (schemaChange && this.searchResultModel) {
                // If an extension's settings were just loaded and a search is active, retrigger the search so it shows up
                return await this.onSearchInputChanged(false);
            }
            this.refreshTOCTree();
            this.renderTree(undefined, forceRefresh);
        }
        else {
            this.settingsTreeModel.value = this.instantiationService.createInstance(SettingsTreeModel, this.viewState, this.workspaceTrustManagementService.isWorkspaceTrusted());
            this.refreshModels(resolvedSettingsRoot);
            // Don't restore the cached state if we already have a query value from calling _setOptions().
            const cachedState = !this.viewState.query ? this.restoreCachedState() : undefined;
            if (cachedState?.searchQuery || this.searchWidget.getValue()) {
                await this.onSearchInputChanged(true);
            }
            else {
                this.refreshTOCTree();
                this.refreshTree();
                this.tocTree.collapseAll();
            }
        }
    }
    updateElementsByKey(keys) {
        if (keys.size) {
            if (this.searchResultModel) {
                keys.forEach(key => this.searchResultModel.updateElementsByName(key));
            }
            if (this.settingsTreeModel.value) {
                keys.forEach(key => this.settingsTreeModel.value.updateElementsByName(key));
            }
            keys.forEach(key => this.renderTree(key));
        }
        else {
            this.renderTree();
        }
    }
    getActiveControlInSettingsTree() {
        const element = this.settingsTree.getHTMLElement();
        const activeElement = element.ownerDocument.activeElement;
        return (activeElement && DOM.isAncestorOfActiveElement(element)) ?
            activeElement :
            null;
    }
    renderTree(key, force = false) {
        if (!force && key && this.scheduledRefreshes.has(key)) {
            this.updateModifiedLabelForKey(key);
            return;
        }
        // If the context view is focused, delay rendering settings
        if (this.contextViewFocused()) {
            // eslint-disable-next-line no-restricted-syntax
            const element = this.window.document.querySelector('.context-view');
            if (element) {
                this.scheduleRefresh(element, key);
            }
            return;
        }
        // If a setting control is currently focused, schedule a refresh for later
        const activeElement = this.getActiveControlInSettingsTree();
        const focusedSetting = activeElement && this.settingRenderers.getSettingDOMElementForDOMElement(activeElement);
        if (focusedSetting && !force) {
            // If a single setting is being refreshed, it's ok to refresh now if that is not the focused setting
            if (key) {
                const focusedKey = focusedSetting.getAttribute(AbstractSettingRenderer.SETTING_KEY_ATTR);
                if (focusedKey === key &&
                    // update `list`s live, as they have a separate "submit edit" step built in before this
                    (focusedSetting.parentElement && !focusedSetting.parentElement.classList.contains('setting-item-list'))) {
                    this.updateModifiedLabelForKey(key);
                    this.scheduleRefresh(focusedSetting, key);
                    return;
                }
            }
            else {
                this.scheduleRefresh(focusedSetting);
                return;
            }
        }
        this.renderResultCountMessages(false);
        if (key) {
            // eslint-disable-next-line no-restricted-syntax
            const elements = this.currentSettingsModel?.getElementsByName(key);
            if (elements?.length) {
                if (elements.length >= 2) {
                    console.warn('More than one setting with key ' + key + ' found');
                }
                this.refreshSingleElement(elements[0]);
            }
            else {
                // Refresh requested for a key that we don't know about
                return;
            }
        }
        else {
            this.refreshTree();
        }
        return;
    }
    contextViewFocused() {
        return !!DOM.findParentWithClass(this.rootElement.ownerDocument.activeElement, 'context-view');
    }
    refreshSingleElement(element) {
        if (this.isVisible()
            && this.settingsTree.hasElement(element)
            && (!element.setting.deprecationMessage || element.isConfigured)) {
            this.settingsTree.rerender(element);
        }
    }
    refreshTree() {
        if (this.isVisible() && this.currentSettingsModel) {
            this.settingsTree.setChildren(null, createGroupIterator(this.currentSettingsModel.root));
        }
    }
    refreshTOCTree() {
        if (this.isVisible()) {
            this.tocTreeModel.update();
            this.tocTree.setChildren(null, createTOCIterator(this.tocTreeModel, this.tocTree));
        }
    }
    updateModifiedLabelForKey(key) {
        if (!this.currentSettingsModel) {
            return;
        }
        // eslint-disable-next-line no-restricted-syntax
        const dataElements = this.currentSettingsModel.getElementsByName(key);
        const isModified = dataElements && dataElements[0] && dataElements[0].isConfigured; // all elements are either configured or not
        const elements = this.settingRenderers.getDOMElementsForSettingKey(this.settingsTree.getHTMLElement(), key);
        if (elements && elements[0]) {
            elements[0].classList.toggle('is-configured', !!isModified);
        }
    }
    async onSearchInputChanged(expandResults) {
        if (!this.currentSettingsModel) {
            // Initializing search widget value
            return;
        }
        const query = this.searchWidget.getValue().trim();
        this.viewState.query = query;
        await this.triggerSearch(query.replace(/\u203A/g, ' '), expandResults);
    }
    parseSettingFromJSON(query) {
        const match = query.match(/"([a-zA-Z.]+)": /);
        return match && match[1];
    }
    /**
     * Toggles the visibility of the Settings editor table of contents during a search
     * depending on the behavior.
     */
    toggleTocBySearchBehaviorType() {
        const tocBehavior = this.configurationService.getValue(SEARCH_TOC_BEHAVIOR_KEY);
        const hideToc = tocBehavior === 'hide';
        if (hideToc) {
            this.splitView.setViewVisible(0, false);
            this.splitView.style({
                separatorBorder: Color.transparent
            });
        }
        else {
            this.layoutSplitView(this.dimension);
        }
    }
    async triggerSearch(query, expandResults) {
        const progressRunner = this.editorProgressService.show(true, 800);
        const showAdvanced = this.viewState.tagFilters?.has(ADVANCED_SETTING_TAG);
        this.viewState.tagFilters = new Set();
        this.viewState.extensionFilters = new Set();
        this.viewState.featureFilters = new Set();
        this.viewState.idFilters = new Set();
        this.viewState.languageFilter = undefined;
        if (query) {
            const parsedQuery = parseQuery(query);
            query = parsedQuery.query;
            parsedQuery.tags.forEach(tag => this.viewState.tagFilters.add(tag));
            parsedQuery.extensionFilters.forEach(extensionId => this.viewState.extensionFilters.add(extensionId));
            parsedQuery.featureFilters.forEach(feature => this.viewState.featureFilters.add(feature));
            parsedQuery.idFilters.forEach(id => this.viewState.idFilters.add(id));
            this.viewState.languageFilter = parsedQuery.languageFilter;
        }
        if (showAdvanced !== this.viewState.tagFilters?.has(ADVANCED_SETTING_TAG)) {
            await this.onConfigUpdate();
        }
        this.settingsTargetsWidget.updateLanguageFilterIndicators(this.viewState.languageFilter);
        if (query && query !== '@') {
            query = this.parseSettingFromJSON(query) || query;
            await this.triggerFilterPreferences(query, expandResults, progressRunner);
            this.toggleTocBySearchBehaviorType();
        }
        else {
            if (this.viewState.tagFilters.size || this.viewState.extensionFilters.size || this.viewState.featureFilters.size || this.viewState.idFilters.size || this.viewState.languageFilter) {
                this.searchResultModel = this.createFilterModel();
            }
            else {
                this.searchResultModel = null;
            }
            this.searchDelayer.cancel();
            if (this.searchInProgress) {
                this.searchInProgress.dispose(true);
                this.searchInProgress = null;
            }
            if (expandResults) {
                this.tocTree.setFocus([]);
                this.viewState.filterToCategory = undefined;
            }
            this.tocTreeModel.currentSearchModel = this.searchResultModel;
            if (this.searchResultModel) {
                // Added a filter model
                if (expandResults) {
                    this.tocTree.setSelection([]);
                    this.tocTree.expandAll();
                }
                this.refreshTOCTree();
                this.renderResultCountMessages(false);
                this.refreshTree();
                this.toggleTocBySearchBehaviorType();
            }
            else if (!this.tocTreeDisposed) {
                // Leaving search mode
                this.tocTree.collapseAll();
                this.refreshTOCTree();
                this.renderResultCountMessages(false);
                this.refreshTree();
                this.layoutSplitView(this.dimension);
            }
            progressRunner.done();
        }
    }
    /**
     * Return a fake SearchResultModel which can hold a flat list of all settings, to be filtered (@modified etc)
     */
    createFilterModel() {
        const filterModel = this.instantiationService.createInstance(SearchResultModel, this.viewState, this.settingsOrderByTocIndex, this.workspaceTrustManagementService.isWorkspaceTrusted());
        const fullResult = {
            filterMatches: [],
            exactMatch: false,
        };
        const shouldShowAdvanced = this.canShowAdvancedSettings();
        for (const g of this.defaultSettingsEditorModel.settingsGroups.slice(1)) {
            for (const sect of g.sections) {
                for (const setting of sect.settings) {
                    if (!shouldShowAdvanced && !this.shouldShowSetting(setting)) {
                        continue;
                    }
                    fullResult.filterMatches.push({
                        setting,
                        matches: [],
                        matchType: SettingMatchType.None,
                        keyMatchScore: 0,
                        score: 0,
                        providerName: FILTER_MODEL_SEARCH_PROVIDER_NAME
                    });
                }
            }
        }
        filterModel.setResult(0, fullResult);
        return filterModel;
    }
    async triggerFilterPreferences(query, expandResults, progressRunner) {
        if (this.searchInProgress) {
            this.searchInProgress.dispose(true);
            this.searchInProgress = null;
        }
        const searchInProgress = this.searchInProgress = new CancellationTokenSource();
        return this.searchDelayer.trigger(async () => {
            if (searchInProgress.token.isCancellationRequested) {
                return;
            }
            this.disableAiSearchToggle();
            const localResults = await this.doLocalSearch(query, searchInProgress.token);
            if (!this.searchResultModel || searchInProgress.token.isCancellationRequested) {
                return;
            }
            this.searchResultModel.showAiResults = false;
            if (localResults && localResults.filterMatches.length > 0) {
                // The remote results might take a while and
                // are always appended to the end anyway, so
                // show some results now.
                this.onDidFinishSearch(expandResults, undefined);
            }
            if (!localResults || !localResults.exactMatch) {
                await this.doRemoteSearch(query, searchInProgress.token);
            }
            if (searchInProgress.token.isCancellationRequested) {
                return;
            }
            if (this.aiSearchPromise) {
                this.aiSearchPromise.cancel();
            }
            // Kick off an AI search in the background if the toggle is shown.
            // We purposely do not await it.
            if (this.searchInputActionBar && this.showAiResultsAction && this.searchInputActionBar.hasAction(this.showAiResultsAction)) {
                this.aiSearchPromise = createCancelablePromise(token => {
                    return this.doAiSearch(query, token).then((results) => {
                        if (results && this.showAiResultsAction) {
                            this.showAiResultsAction.enabled = true;
                            this.aiResultsAvailable.set(true);
                            this.showAiResultsAction.label = SHOW_AI_RESULTS_ENABLED_LABEL;
                            this.renderResultCountMessages(true);
                        }
                    }).catch(e => {
                        if (!isCancellationError(e)) {
                            this.logService.trace('Error during AI settings search:', e);
                        }
                    });
                });
            }
            this.onDidFinishSearch(expandResults, progressRunner);
        });
    }
    onDidFinishSearch(expandResults, progressRunner) {
        this.tocTreeModel.currentSearchModel = this.searchResultModel;
        if (expandResults) {
            this.tocTree.setFocus([]);
            this.viewState.filterToCategory = undefined;
            this.tocTree.expandAll();
            this.settingsTree.scrollTop = 0;
        }
        this.refreshTOCTree();
        this.renderTree(undefined, true);
        progressRunner?.done();
    }
    doLocalSearch(query, token) {
        const localSearchProvider = this.preferencesSearchService.getLocalSearchProvider(query);
        return this.searchWithProvider(0 /* SearchResultIdx.Local */, localSearchProvider, STRING_MATCH_SEARCH_PROVIDER_NAME, token);
    }
    doRemoteSearch(query, token) {
        const remoteSearchProvider = this.preferencesSearchService.getRemoteSearchProvider(query);
        if (!remoteSearchProvider) {
            return Promise.resolve(null);
        }
        return this.searchWithProvider(1 /* SearchResultIdx.Remote */, remoteSearchProvider, TF_IDF_SEARCH_PROVIDER_NAME, token);
    }
    async doAiSearch(query, token) {
        const aiSearchProvider = this.preferencesSearchService.getAiSearchProvider(query);
        if (!aiSearchProvider) {
            return null;
        }
        const embeddingsResults = await this.searchWithProvider(3 /* SearchResultIdx.Embeddings */, aiSearchProvider, EMBEDDINGS_SEARCH_PROVIDER_NAME, token);
        if (!embeddingsResults || token.isCancellationRequested) {
            return null;
        }
        const llmResults = await this.getLLMRankedResults(query, token);
        if (token.isCancellationRequested) {
            return null;
        }
        return {
            filterMatches: embeddingsResults.filterMatches.concat(llmResults?.filterMatches ?? []),
            exactMatch: false
        };
    }
    async getLLMRankedResults(query, token) {
        const aiSearchProvider = this.preferencesSearchService.getAiSearchProvider(query);
        if (!aiSearchProvider) {
            return null;
        }
        this.stopWatch.reset();
        const result = await aiSearchProvider.getLLMRankedResults(token);
        this.stopWatch.stop();
        if (token.isCancellationRequested) {
            return null;
        }
        // Only log the elapsed time if there are actual results.
        if (result && result.filterMatches.length > 0) {
            const elapsed = this.stopWatch.elapsed();
            this.logSearchPerformance(LLM_RANKED_SEARCH_PROVIDER_NAME, elapsed);
        }
        this.searchResultModel.setResult(4 /* SearchResultIdx.AiSelected */, result);
        return result;
    }
    async searchWithProvider(type, searchProvider, providerName, token) {
        this.stopWatch.reset();
        const result = await this._searchPreferencesModel(this.defaultSettingsEditorModel, searchProvider, token);
        this.stopWatch.stop();
        if (token.isCancellationRequested) {
            // Handle cancellation like this because cancellation is lost inside the search provider due to async/await
            return null;
        }
        // Filter out advanced settings unless the advanced tag is explicitly set or setting matches an ID filter
        if (result && !this.canShowAdvancedSettings()) {
            result.filterMatches = result.filterMatches.filter(match => this.shouldShowSetting(match.setting));
        }
        // Only log the elapsed time if there are actual results.
        if (result && result.filterMatches.length > 0) {
            const elapsed = this.stopWatch.elapsed();
            this.logSearchPerformance(providerName, elapsed);
        }
        this.searchResultModel ??= this.instantiationService.createInstance(SearchResultModel, this.viewState, this.settingsOrderByTocIndex, this.workspaceTrustManagementService.isWorkspaceTrusted());
        this.searchResultModel.setResult(type, result);
        return result;
    }
    logSearchPerformance(providerName, elapsed) {
        this.telemetryService.publicLog2('settingsEditor.searchPerformance', {
            providerName,
            elapsedMs: elapsed,
        });
    }
    renderResultCountMessages(showAiResultsMessage) {
        if (!this.currentSettingsModel) {
            return;
        }
        this.clearFilterLinkContainer.style.display = this.viewState.tagFilters && this.viewState.tagFilters.size > 0
            ? 'initial'
            : 'none';
        if (!this.searchResultModel) {
            if (this.countElement.style.display !== 'none') {
                this.searchResultLabel = null;
                this.updateInputAriaLabel();
                this.countElement.style.display = 'none';
                this.countElement.innerText = '';
                this.layout(this.dimension);
            }
            this.rootElement.classList.remove('no-results');
            this.splitView.el.style.visibility = 'visible';
            return;
        }
        else {
            const count = this.searchResultModel.getUniqueResultsCount();
            let resultString;
            if (showAiResultsMessage) {
                switch (count) {
                    case 0:
                        resultString = localize('noResultsWithAiAvailable', "No Settings Found. AI Results Available");
                        break;
                    case 1:
                        resultString = localize('oneResultWithAiAvailable', "1 Setting Found. AI Results Available");
                        break;
                    default: resultString = localize('moreThanOneResultWithAiAvailable', "{0} Settings Found. AI Results Available", count);
                }
            }
            else {
                switch (count) {
                    case 0:
                        resultString = localize('noResults', "No Settings Found");
                        break;
                    case 1:
                        resultString = localize('oneResult', "1 Setting Found");
                        break;
                    default: resultString = localize('moreThanOneResult', "{0} Settings Found", count);
                }
            }
            this.searchResultLabel = resultString;
            this.updateInputAriaLabel();
            this.countElement.innerText = resultString;
            aria.status(resultString);
            if (this.countElement.style.display !== 'block') {
                this.countElement.style.display = 'block';
            }
            this.layout(this.dimension);
            this.rootElement.classList.toggle('no-results', count === 0);
            this.splitView.el.style.visibility = count === 0 ? 'hidden' : 'visible';
        }
    }
    async _searchPreferencesModel(model, provider, token) {
        try {
            return await provider.searchModel(model, token);
        }
        catch (err) {
            if (isCancellationError(err)) {
                return Promise.reject(err);
            }
            else {
                return null;
            }
        }
    }
    layoutSplitView(dimension) {
        if (!this.isVisible()) {
            return;
        }
        const listHeight = dimension.height - (72 + 11 + 14 /* header height + editor padding */);
        this.splitView.el.style.height = `${listHeight}px`;
        // We call layout first so the splitView has an idea of how much
        // space it has, otherwise setViewVisible results in the first panel
        // showing up at the minimum size whenever the Settings editor
        // opens for the first time.
        this.splitView.layout(this.bodyContainer.clientWidth, listHeight);
        const tocBehavior = this.configurationService.getValue(SEARCH_TOC_BEHAVIOR_KEY);
        const hideTocForSearch = tocBehavior === 'hide' && this.searchResultModel;
        if (!hideTocForSearch) {
            const firstViewWasVisible = this.splitView.isViewVisible(0);
            const firstViewVisible = this.bodyContainer.clientWidth >= SettingsEditor2_1.NARROW_TOTAL_WIDTH;
            this.splitView.setViewVisible(0, firstViewVisible);
            // If the first view is again visible, and we have enough space, immediately set the
            // editor to use the reset width rather than the cached min width
            if (!firstViewWasVisible && firstViewVisible && this.bodyContainer.clientWidth >= SettingsEditor2_1.EDITOR_MIN_WIDTH + SettingsEditor2_1.TOC_RESET_WIDTH) {
                this.splitView.resizeView(0, SettingsEditor2_1.TOC_RESET_WIDTH);
            }
            this.splitView.style({
                separatorBorder: firstViewVisible ? this.theme.getColor(settingsSashBorder) : Color.transparent
            });
        }
    }
    saveState() {
        if (this.isVisible()) {
            const searchQuery = this.searchWidget.getValue().trim();
            const target = this.settingsTargetsWidget.settingsTarget;
            if (this.input) {
                this.editorMemento.saveEditorState(this.group, this.input, { searchQuery, target });
            }
        }
        else if (this.input) {
            this.editorMemento.clearEditorState(this.input, this.group);
        }
        super.saveState();
    }
};
SettingsEditor2 = SettingsEditor2_1 = __decorate([
    __param(1, ITelemetryService),
    __param(2, IWorkbenchConfigurationService),
    __param(3, ITextResourceConfigurationService),
    __param(4, IThemeService),
    __param(5, IPreferencesService),
    __param(6, IInstantiationService),
    __param(7, IPreferencesSearchService),
    __param(8, ILogService),
    __param(9, IContextKeyService),
    __param(10, IStorageService),
    __param(11, IEditorGroupsService),
    __param(12, IUserDataSyncWorkbenchService),
    __param(13, IUserDataSyncEnablementService),
    __param(14, IWorkspaceTrustManagementService),
    __param(15, IExtensionService),
    __param(16, ILanguageService),
    __param(17, IExtensionManagementService),
    __param(18, IProductService),
    __param(19, IExtensionGalleryService),
    __param(20, IEditorProgressService),
    __param(21, IUserDataProfileService),
    __param(22, IKeybindingService),
    __param(23, IChatEntitlementService)
], SettingsEditor2);
export { SettingsEditor2 };
let SyncControls = class SyncControls extends Disposable {
    constructor(window, container, commandService, userDataSyncService, userDataSyncEnablementService, telemetryService) {
        super();
        this.commandService = commandService;
        this.userDataSyncService = userDataSyncService;
        this.userDataSyncEnablementService = userDataSyncEnablementService;
        this._onDidChangeLastSyncedLabel = this._register(new Emitter());
        this.onDidChangeLastSyncedLabel = this._onDidChangeLastSyncedLabel.event;
        const headerRightControlsContainer = DOM.append(container, $('.settings-right-controls'));
        const turnOnSyncButtonContainer = DOM.append(headerRightControlsContainer, $('.turn-on-sync'));
        this.turnOnSyncButton = this._register(new Button(turnOnSyncButtonContainer, { title: true, ...defaultButtonStyles }));
        this.lastSyncedLabel = DOM.append(headerRightControlsContainer, $('.last-synced-label'));
        DOM.hide(this.lastSyncedLabel);
        this.turnOnSyncButton.enabled = true;
        this.turnOnSyncButton.label = localize('turnOnSyncButton', "Backup and Sync Settings");
        DOM.hide(this.turnOnSyncButton.element);
        this._register(this.turnOnSyncButton.onDidClick(async () => {
            await this.commandService.executeCommand('workbench.userDataSync.actions.turnOn');
        }));
        this.updateLastSyncedTime();
        this._register(this.userDataSyncService.onDidChangeLastSyncTime(() => {
            this.updateLastSyncedTime();
        }));
        const updateLastSyncedTimer = this._register(new DOM.WindowIntervalTimer());
        updateLastSyncedTimer.cancelAndSet(() => this.updateLastSyncedTime(), 60 * 1000, window);
        this.update();
        this._register(this.userDataSyncService.onDidChangeStatus(() => {
            this.update();
        }));
        this._register(this.userDataSyncEnablementService.onDidChangeEnablement(() => {
            this.update();
        }));
    }
    updateLastSyncedTime() {
        const last = this.userDataSyncService.lastSyncTime;
        let label;
        if (typeof last === 'number') {
            const d = fromNow(last, true, undefined, true);
            label = localize('lastSyncedLabel', "Last synced: {0}", d);
        }
        else {
            label = '';
        }
        this.lastSyncedLabel.textContent = label;
        this._onDidChangeLastSyncedLabel.fire(label);
    }
    update() {
        if (this.userDataSyncService.status === "uninitialized" /* SyncStatus.Uninitialized */) {
            return;
        }
        if (this.userDataSyncEnablementService.isEnabled() || this.userDataSyncService.status !== "idle" /* SyncStatus.Idle */) {
            DOM.show(this.lastSyncedLabel);
            DOM.hide(this.turnOnSyncButton.element);
        }
        else {
            DOM.hide(this.lastSyncedLabel);
            DOM.show(this.turnOnSyncButton.element);
        }
    }
};
SyncControls = __decorate([
    __param(2, ICommandService),
    __param(3, IUserDataSyncService),
    __param(4, IUserDataSyncEnablementService),
    __param(5, ITelemetryService)
], SyncControls);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3NFZGl0b3IyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3ByZWZlcmVuY2VzL2Jyb3dzZXIvc2V0dGluZ3NFZGl0b3IyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUMvRSxPQUFPLEtBQUssSUFBSSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUN0RSxPQUFPLEVBQWUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBR3BGLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM1RCxPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNwSCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFDQUFx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