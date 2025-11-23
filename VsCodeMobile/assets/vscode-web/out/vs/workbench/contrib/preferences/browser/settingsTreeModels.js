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
import * as arrays from '../../../../base/common/arrays.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { escapeRegExpCharacters, isFalsyOrWhitespace } from '../../../../base/common/strings.js';
import { isUndefinedOrNull } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { getLanguageTagSettingPlainKey } from '../../../../platform/configuration/common/configuration.js';
import { EditPresentationTypes, Extensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { USER_LOCAL_AND_REMOTE_SETTINGS } from '../../../../platform/request/common/request.js';
import { APPLICATION_SCOPES, FOLDER_SCOPES, IWorkbenchConfigurationService, LOCAL_MACHINE_SCOPES, REMOTE_MACHINE_SCOPES, WORKSPACE_SCOPES } from '../../../services/configuration/common/configuration.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { SettingMatchType, SettingValueType } from '../../../services/preferences/common/preferences.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { ENABLE_EXTENSION_TOGGLE_SETTINGS, ENABLE_LANGUAGE_FILTER, MODIFIED_SETTING_TAG, POLICY_SETTING_TAG, REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG, compareTwoNullableNumbers, wordifyKey } from '../common/preferences.js';
import { tocData } from './settingsLayout.js';
export const ONLINE_SERVICES_SETTING_TAG = 'usesOnlineServices';
export class SettingsTreeElement extends Disposable {
    get onDidChangeTabbable() { return this._onDidChangeTabbable.event; }
    constructor(_id) {
        super();
        this._tabbable = false;
        this._onDidChangeTabbable = this._register(new Emitter());
        this.id = _id;
    }
    get tabbable() {
        return this._tabbable;
    }
    set tabbable(value) {
        this._tabbable = value;
        this._onDidChangeTabbable.fire();
    }
}
export class SettingsTreeGroupElement extends SettingsTreeElement {
    get children() {
        return this._children;
    }
    set children(newChildren) {
        this._children = newChildren;
        this._childSettingKeys = new Set();
        this._children.forEach(child => {
            if (child instanceof SettingsTreeSettingElement) {
                this._childSettingKeys.add(child.setting.key);
            }
        });
    }
    constructor(_id, count, label, level, isFirstGroup) {
        super(_id);
        this._childSettingKeys = new Set();
        this._children = [];
        this.count = count;
        this.label = label;
        this.level = level;
        this.isFirstGroup = isFirstGroup;
    }
    /**
     * Returns whether this group contains the given child key (to a depth of 1 only)
     */
    containsSetting(key) {
        return this._childSettingKeys.has(key);
    }
}
export class SettingsTreeNewExtensionsElement extends SettingsTreeElement {
    constructor(_id, extensionIds) {
        super(_id);
        this.extensionIds = extensionIds;
    }
}
export class SettingsTreeSettingElement extends SettingsTreeElement {
    static { this.MAX_DESC_LINES = 20; }
    constructor(setting, parent, settingsTarget, isWorkspaceTrusted, languageFilter, languageService, productService, userDataProfileService, configurationService) {
        super(sanitizeId(parent.id + '_' + setting.key));
        this.settingsTarget = settingsTarget;
        this.isWorkspaceTrusted = isWorkspaceTrusted;
        this.languageFilter = languageFilter;
        this.languageService = languageService;
        this.productService = productService;
        this.userDataProfileService = userDataProfileService;
        this.configurationService = configurationService;
        this._displayCategory = null;
        this._displayLabel = null;
        /**
         * Whether the setting is configured in the selected scope.
         */
        this.isConfigured = false;
        /**
         * Whether the setting requires trusted target
         */
        this.isUntrusted = false;
        /**
         * Whether the setting is under a policy that blocks all changes.
         */
        this.hasPolicyValue = false;
        this.overriddenScopeList = [];
        this.overriddenDefaultsLanguageList = [];
        /**
         * For each language that contributes setting values or default overrides, we can see those values here.
         */
        this.languageOverrideValues = new Map();
        this.setting = setting;
        this.parent = parent;
        // Make sure description and valueType are initialized
        this.initSettingDescription();
        this.initSettingValueType();
    }
    get displayCategory() {
        if (!this._displayCategory) {
            this.initLabels();
        }
        return this._displayCategory;
    }
    get displayLabel() {
        if (!this._displayLabel) {
            this.initLabels();
        }
        return this._displayLabel;
    }
    initLabels() {
        if (this.setting.title) {
            this._displayLabel = this.setting.title;
            this._displayCategory = this.setting.categoryLabel ?? null;
            return;
        }
        const displayKeyFormat = settingKeyToDisplayFormat(this.setting.key, this.parent.id, this.setting.isLanguageTagSetting);
        this._displayLabel = displayKeyFormat.label;
        this._displayCategory = displayKeyFormat.category;
    }
    initSettingDescription() {
        if (this.setting.description.length > SettingsTreeSettingElement.MAX_DESC_LINES) {
            const truncatedDescLines = this.setting.description.slice(0, SettingsTreeSettingElement.MAX_DESC_LINES);
            truncatedDescLines.push('[...]');
            this.description = truncatedDescLines.join('\n');
        }
        else {
            this.description = this.setting.description.join('\n');
        }
    }
    initSettingValueType() {
        if (isExtensionToggleSetting(this.setting, this.productService)) {
            this.valueType = SettingValueType.ExtensionToggle;
        }
        else if (this.setting.enum && (!this.setting.type || settingTypeEnumRenderable(this.setting.type))) {
            this.valueType = SettingValueType.Enum;
        }
        else if (this.setting.type === 'string') {
            if (this.setting.editPresentation === EditPresentationTypes.Multiline) {
                this.valueType = SettingValueType.MultilineString;
            }
            else {
                this.valueType = SettingValueType.String;
            }
        }
        else if (isExcludeSetting(this.setting)) {
            this.valueType = SettingValueType.Exclude;
        }
        else if (isIncludeSetting(this.setting)) {
            this.valueType = SettingValueType.Include;
        }
        else if (this.setting.type === 'integer') {
            this.valueType = SettingValueType.Integer;
        }
        else if (this.setting.type === 'number') {
            this.valueType = SettingValueType.Number;
        }
        else if (this.setting.type === 'boolean') {
            this.valueType = SettingValueType.Boolean;
        }
        else if (this.setting.type === 'array' && this.setting.arrayItemType &&
            ['string', 'enum', 'number', 'integer'].includes(this.setting.arrayItemType)) {
            this.valueType = SettingValueType.Array;
        }
        else if (Array.isArray(this.setting.type) && this.setting.type.includes(SettingValueType.Null) && this.setting.type.length === 2) {
            if (this.setting.type.includes(SettingValueType.Integer)) {
                this.valueType = SettingValueType.NullableInteger;
            }
            else if (this.setting.type.includes(SettingValueType.Number)) {
                this.valueType = SettingValueType.NullableNumber;
            }
            else {
                this.valueType = SettingValueType.Complex;
            }
        }
        else {
            const schemaType = getObjectSettingSchemaType(this.setting);
            if (schemaType) {
                if (this.setting.allKeysAreBoolean) {
                    this.valueType = SettingValueType.BooleanObject;
                }
                else if (schemaType === 'simple') {
                    this.valueType = SettingValueType.Object;
                }
                else {
                    this.valueType = SettingValueType.ComplexObject;
                }
            }
            else if (this.setting.isLanguageTagSetting) {
                this.valueType = SettingValueType.LanguageTag;
            }
            else {
                this.valueType = SettingValueType.Complex;
            }
        }
    }
    inspectSelf() {
        const targetToInspect = this.getTargetToInspect(this.setting);
        const inspectResult = inspectSetting(this.setting.key, targetToInspect, this.languageFilter, this.configurationService);
        this.update(inspectResult, this.isWorkspaceTrusted);
    }
    getTargetToInspect(setting) {
        if (!this.userDataProfileService.currentProfile.isDefault && !this.userDataProfileService.currentProfile.useDefaultFlags?.settings) {
            if (setting.scope === 1 /* ConfigurationScope.APPLICATION */) {
                return 1 /* ConfigurationTarget.APPLICATION */;
            }
            if (this.configurationService.isSettingAppliedForAllProfiles(setting.key) && this.settingsTarget === 3 /* ConfigurationTarget.USER_LOCAL */) {
                return 1 /* ConfigurationTarget.APPLICATION */;
            }
        }
        return this.settingsTarget;
    }
    update(inspectResult, isWorkspaceTrusted) {
        let { isConfigured, inspected, targetSelector, inspectedLanguageOverrides, languageSelector } = inspectResult;
        switch (targetSelector) {
            case 'workspaceFolderValue':
            case 'workspaceValue':
                this.isUntrusted = !!this.setting.restricted && !isWorkspaceTrusted;
                break;
        }
        let displayValue = isConfigured ? inspected[targetSelector] : inspected.defaultValue;
        const overriddenScopeList = [];
        const overriddenDefaultsLanguageList = [];
        if ((languageSelector || targetSelector !== 'workspaceValue') && typeof inspected.workspaceValue !== 'undefined') {
            overriddenScopeList.push('workspace:');
        }
        if ((languageSelector || targetSelector !== 'userRemoteValue') && typeof inspected.userRemoteValue !== 'undefined') {
            overriddenScopeList.push('remote:');
        }
        if ((languageSelector || targetSelector !== 'userLocalValue') && typeof inspected.userLocalValue !== 'undefined') {
            overriddenScopeList.push('user:');
        }
        if (inspected.overrideIdentifiers) {
            for (const overrideIdentifier of inspected.overrideIdentifiers) {
                const inspectedOverride = inspectedLanguageOverrides.get(overrideIdentifier);
                if (inspectedOverride) {
                    if (this.languageService.isRegisteredLanguageId(overrideIdentifier)) {
                        if (languageSelector !== overrideIdentifier && typeof inspectedOverride.default?.override !== 'undefined') {
                            overriddenDefaultsLanguageList.push(overrideIdentifier);
                        }
                        if ((languageSelector !== overrideIdentifier || targetSelector !== 'workspaceValue') && typeof inspectedOverride.workspace?.override !== 'undefined') {
                            overriddenScopeList.push(`workspace:${overrideIdentifier}`);
                        }
                        if ((languageSelector !== overrideIdentifier || targetSelector !== 'userRemoteValue') && typeof inspectedOverride.userRemote?.override !== 'undefined') {
                            overriddenScopeList.push(`remote:${overrideIdentifier}`);
                        }
                        if ((languageSelector !== overrideIdentifier || targetSelector !== 'userLocalValue') && typeof inspectedOverride.userLocal?.override !== 'undefined') {
                            overriddenScopeList.push(`user:${overrideIdentifier}`);
                        }
                    }
                    this.languageOverrideValues.set(overrideIdentifier, inspectedOverride);
                }
            }
        }
        this.overriddenScopeList = overriddenScopeList;
        this.overriddenDefaultsLanguageList = overriddenDefaultsLanguageList;
        // The user might have added, removed, or modified a language filter,
        // so we reset the default value source to the non-language-specific default value source for now.
        this.defaultValueSource = this.setting.nonLanguageSpecificDefaultValueSource;
        if (inspected.policyValue !== undefined) {
            this.hasPolicyValue = true;
            isConfigured = false; // The user did not manually configure the setting themselves.
            displayValue = inspected.policyValue;
            this.scopeValue = inspected.policyValue;
            this.defaultValue = inspected.defaultValue;
        }
        else if (languageSelector && this.languageOverrideValues.has(languageSelector)) {
            const overrideValues = this.languageOverrideValues.get(languageSelector);
            // In the worst case, go back to using the previous display value.
            // Also, sometimes the override is in the form of a default value override, so consider that second.
            displayValue = (isConfigured ? overrideValues[targetSelector] : overrideValues.defaultValue) ?? displayValue;
            this.scopeValue = isConfigured && overrideValues[targetSelector];
            this.defaultValue = overrideValues.defaultValue ?? inspected.defaultValue;
            const registryValues = Registry.as(Extensions.Configuration).getConfigurationDefaultsOverrides();
            const source = registryValues.get(`[${languageSelector}]`)?.source;
            const overrideValueSource = source instanceof Map ? source.get(this.setting.key) : undefined;
            if (overrideValueSource) {
                this.defaultValueSource = overrideValueSource;
            }
        }
        else {
            this.scopeValue = isConfigured && inspected[targetSelector];
            this.defaultValue = inspected.defaultValue;
        }
        this.value = displayValue;
        this.isConfigured = isConfigured;
        if (isConfigured || this.setting.tags || this.tags || this.setting.restricted || this.hasPolicyValue) {
            // Don't create an empty Set for all 1000 settings, only if needed
            this.tags = new Set();
            if (isConfigured) {
                this.tags.add(MODIFIED_SETTING_TAG);
            }
            this.setting.tags?.forEach(tag => this.tags.add(tag));
            if (this.setting.restricted) {
                this.tags.add(REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG);
            }
            if (this.hasPolicyValue) {
                this.tags.add(POLICY_SETTING_TAG);
            }
        }
    }
    matchesAllTags(tagFilters) {
        if (!tagFilters?.size) {
            // This setting, which may have tags,
            // matches against a query with no tags.
            return true;
        }
        if (!this.tags) {
            // The setting must inspect itself to get tag information
            // including for the hasPolicy tag.
            this.inspectSelf();
        }
        // Handle the special 'stable' tag filter
        if (tagFilters.has('stable')) {
            // For stable filter, exclude preview and experimental settings
            if (this.tags?.has('preview') || this.tags?.has('experimental')) {
                return false;
            }
            // Check other filters (excluding 'stable' itself)
            const otherFilters = new Set(Array.from(tagFilters).filter(tag => tag !== 'stable'));
            if (otherFilters.size === 0) {
                return true;
            }
            return !!this.tags?.size &&
                Array.from(otherFilters).every(tag => this.tags.has(tag));
        }
        // Check that the filter tags are a subset of this setting's tags
        return !!this.tags?.size &&
            Array.from(tagFilters).every(tag => this.tags.has(tag));
    }
    matchesScope(scope, isRemote) {
        const configTarget = URI.isUri(scope) ? 6 /* ConfigurationTarget.WORKSPACE_FOLDER */ : scope;
        if (!this.setting.scope) {
            return true;
        }
        if (configTarget === 1 /* ConfigurationTarget.APPLICATION */) {
            return APPLICATION_SCOPES.includes(this.setting.scope);
        }
        if (configTarget === 6 /* ConfigurationTarget.WORKSPACE_FOLDER */) {
            return FOLDER_SCOPES.includes(this.setting.scope);
        }
        if (configTarget === 5 /* ConfigurationTarget.WORKSPACE */) {
            return WORKSPACE_SCOPES.includes(this.setting.scope);
        }
        if (configTarget === 4 /* ConfigurationTarget.USER_REMOTE */) {
            return REMOTE_MACHINE_SCOPES.includes(this.setting.scope) || USER_LOCAL_AND_REMOTE_SETTINGS.includes(this.setting.key);
        }
        if (configTarget === 3 /* ConfigurationTarget.USER_LOCAL */) {
            if (isRemote) {
                return LOCAL_MACHINE_SCOPES.includes(this.setting.scope) || USER_LOCAL_AND_REMOTE_SETTINGS.includes(this.setting.key);
            }
        }
        return true;
    }
    matchesAnyExtension(extensionFilters) {
        if (!extensionFilters || !extensionFilters.size) {
            return true;
        }
        if (!this.setting.extensionInfo) {
            return false;
        }
        return Array.from(extensionFilters).some(extensionId => extensionId.toLowerCase() === this.setting.extensionInfo.id.toLowerCase());
    }
    matchesAnyFeature(featureFilters) {
        if (!featureFilters || !featureFilters.size) {
            return true;
        }
        const features = tocData.children.find(child => child.id === 'features');
        return Array.from(featureFilters).some(filter => {
            if (features && features.children) {
                const feature = features.children.find(feature => 'features/' + filter === feature.id);
                if (feature) {
                    const patterns = feature.settings?.map(setting => createSettingMatchRegExp(setting));
                    return patterns && !this.setting.extensionInfo && patterns.some(pattern => pattern.test(this.setting.key.toLowerCase()));
                }
                else {
                    return false;
                }
            }
            else {
                return false;
            }
        });
    }
    matchesAnyId(idFilters) {
        if (!idFilters || !idFilters.size) {
            return true;
        }
        // Check for exact match first
        if (idFilters.has(this.setting.key)) {
            return true;
        }
        // Check for wildcard patterns (ending with .*)
        for (const filter of idFilters) {
            if (filter.endsWith('*')) {
                const prefix = filter.slice(0, -1); // Remove '*' suffix
                if (this.setting.key.startsWith(prefix)) {
                    return true;
                }
            }
        }
        return false;
    }
    matchesAllLanguages(languageFilter) {
        if (!languageFilter) {
            // We're not filtering by language.
            return true;
        }
        if (!this.languageService.isRegisteredLanguageId(languageFilter)) {
            // We're trying to filter by an invalid language.
            return false;
        }
        // We have a language filter in the search widget at this point.
        // We decide to show all language overridable settings to make the
        // lang filter act more like a scope filter,
        // rather than adding on an implicit @modified as well.
        if (this.setting.scope === 6 /* ConfigurationScope.LANGUAGE_OVERRIDABLE */) {
            return true;
        }
        return false;
    }
}
function createSettingMatchRegExp(pattern) {
    pattern = escapeRegExpCharacters(pattern)
        .replace(/\\\*/g, '.*');
    return new RegExp(`^${pattern}$`, 'i');
}
let SettingsTreeModel = class SettingsTreeModel {
    constructor(_viewState, _isWorkspaceTrusted, _configurationService, _languageService, _userDataProfileService, _productService) {
        this._viewState = _viewState;
        this._isWorkspaceTrusted = _isWorkspaceTrusted;
        this._configurationService = _configurationService;
        this._languageService = _languageService;
        this._userDataProfileService = _userDataProfileService;
        this._productService = _productService;
        this._treeElementsBySettingName = new Map();
    }
    get root() {
        return this._root;
    }
    update(newTocRoot = this._tocRoot) {
        this._treeElementsBySettingName.clear();
        const newRoot = this.createSettingsTreeGroupElement(newTocRoot);
        if (newRoot.children[0] instanceof SettingsTreeGroupElement) {
            newRoot.children[0].isFirstGroup = true;
        }
        if (this._root) {
            this.disposeChildren(this._root.children);
            this._root.children = newRoot.children;
            newRoot.dispose();
        }
        else {
            this._root = newRoot;
        }
    }
    updateWorkspaceTrust(workspaceTrusted) {
        this._isWorkspaceTrusted = workspaceTrusted;
        this.updateRequireTrustedTargetElements();
    }
    disposeChildren(children) {
        for (const child of children) {
            this.disposeChildAndRecurse(child);
        }
    }
    disposeChildAndRecurse(element) {
        if (element instanceof SettingsTreeGroupElement) {
            this.disposeChildren(element.children);
        }
        element.dispose();
    }
    getElementsByName(name) {
        return this._treeElementsBySettingName.get(name) ?? null;
    }
    updateElementsByName(name) {
        if (!this._treeElementsBySettingName.has(name)) {
            return;
        }
        this.reinspectSettings(this._treeElementsBySettingName.get(name));
    }
    updateRequireTrustedTargetElements() {
        this.reinspectSettings([...this._treeElementsBySettingName.values()].flat().filter(s => s.isUntrusted));
    }
    reinspectSettings(settings) {
        for (const element of settings) {
            element.inspectSelf();
        }
    }
    createSettingsTreeGroupElement(tocEntry, parent) {
        const depth = parent ? this.getDepth(parent) + 1 : 0;
        const element = new SettingsTreeGroupElement(tocEntry.id, undefined, tocEntry.label, depth, false);
        element.parent = parent;
        const children = [];
        if (tocEntry.settings) {
            const settingChildren = tocEntry.settings.map(s => this.createSettingsTreeSettingElement(s, element));
            for (const child of settingChildren) {
                if (!child.setting.deprecationMessage) {
                    children.push(child);
                }
                else {
                    child.inspectSelf();
                    if (child.isConfigured) {
                        children.push(child);
                    }
                    else {
                        child.dispose();
                    }
                }
            }
        }
        if (tocEntry.children) {
            const groupChildren = tocEntry.children.map(child => this.createSettingsTreeGroupElement(child, element));
            children.push(...groupChildren);
        }
        element.children = children;
        return element;
    }
    getDepth(element) {
        if (element.parent) {
            return 1 + this.getDepth(element.parent);
        }
        else {
            return 0;
        }
    }
    createSettingsTreeSettingElement(setting, parent) {
        const element = new SettingsTreeSettingElement(setting, parent, this._viewState.settingsTarget, this._isWorkspaceTrusted, this._viewState.languageFilter, this._languageService, this._productService, this._userDataProfileService, this._configurationService);
        const nameElements = this._treeElementsBySettingName.get(setting.key) ?? [];
        nameElements.push(element);
        this._treeElementsBySettingName.set(setting.key, nameElements);
        return element;
    }
    dispose() {
        this._treeElementsBySettingName.clear();
        this.disposeChildAndRecurse(this._root);
    }
};
SettingsTreeModel = __decorate([
    __param(2, IWorkbenchConfigurationService),
    __param(3, ILanguageService),
    __param(4, IUserDataProfileService),
    __param(5, IProductService)
], SettingsTreeModel);
export { SettingsTreeModel };
export function inspectSetting(key, target, languageFilter, configurationService) {
    const inspectOverrides = URI.isUri(target) ? { resource: target } : undefined;
    const inspected = configurationService.inspect(key, inspectOverrides);
    const targetSelector = target === 1 /* ConfigurationTarget.APPLICATION */ ? 'applicationValue' :
        target === 3 /* ConfigurationTarget.USER_LOCAL */ ? 'userLocalValue' :
            target === 4 /* ConfigurationTarget.USER_REMOTE */ ? 'userRemoteValue' :
                target === 5 /* ConfigurationTarget.WORKSPACE */ ? 'workspaceValue' :
                    'workspaceFolderValue';
    const targetOverrideSelector = target === 1 /* ConfigurationTarget.APPLICATION */ ? 'application' :
        target === 3 /* ConfigurationTarget.USER_LOCAL */ ? 'userLocal' :
            target === 4 /* ConfigurationTarget.USER_REMOTE */ ? 'userRemote' :
                target === 5 /* ConfigurationTarget.WORKSPACE */ ? 'workspace' :
                    'workspaceFolder';
    let isConfigured = typeof inspected[targetSelector] !== 'undefined';
    const overrideIdentifiers = inspected.overrideIdentifiers;
    const inspectedLanguageOverrides = new Map();
    // We must reset isConfigured to be false if languageFilter is set, and manually
    // determine whether it can be set to true later.
    if (languageFilter) {
        isConfigured = false;
    }
    if (overrideIdentifiers) {
        // The setting we're looking at has language overrides.
        for (const overrideIdentifier of overrideIdentifiers) {
            inspectedLanguageOverrides.set(overrideIdentifier, configurationService.inspect(key, { overrideIdentifier }));
        }
        // For all language filters, see if there's an override for that filter.
        if (languageFilter) {
            if (inspectedLanguageOverrides.has(languageFilter)) {
                const overrideValue = inspectedLanguageOverrides.get(languageFilter)[targetOverrideSelector]?.override;
                if (typeof overrideValue !== 'undefined') {
                    isConfigured = true;
                }
            }
        }
    }
    return { isConfigured, inspected, targetSelector, inspectedLanguageOverrides, languageSelector: languageFilter };
}
function sanitizeId(id) {
    return id.replace(/[\.\/]/, '_');
}
export function settingKeyToDisplayFormat(key, groupId = '', isLanguageTagSetting = false) {
    const lastDotIdx = key.lastIndexOf('.');
    let category = '';
    if (lastDotIdx >= 0) {
        category = key.substring(0, lastDotIdx);
        key = key.substring(lastDotIdx + 1);
    }
    groupId = groupId.replace(/\//g, '.');
    category = trimCategoryForGroup(category, groupId);
    category = wordifyKey(category);
    if (isLanguageTagSetting) {
        key = getLanguageTagSettingPlainKey(key);
        key = '$(bracket) ' + key;
    }
    const label = wordifyKey(key);
    return { category, label };
}
/**
 * Removes redundant sections of the category label.
 * A redundant section is a section already reflected in the groupId.
 *
 * @param category The category of the specific setting.
 * @param groupId The author + extension ID.
 * @returns The new category label to use.
 */
function trimCategoryForGroup(category, groupId) {
    const doTrim = (forward) => {
        // Remove the Insiders portion if the category doesn't use it.
        if (!/insiders$/i.test(category)) {
            groupId = groupId.replace(/-?insiders$/i, '');
        }
        const parts = groupId.split('.')
            .map(part => {
            // Remove hyphens, but only if that results in a match with the category.
            if (part.replace(/-/g, '').toLowerCase() === category.toLowerCase()) {
                return part.replace(/-/g, '');
            }
            else {
                return part;
            }
        });
        while (parts.length) {
            const reg = new RegExp(`^${parts.join('\\.')}(\\.|$)`, 'i');
            if (reg.test(category)) {
                return category.replace(reg, '');
            }
            if (forward) {
                parts.pop();
            }
            else {
                parts.shift();
            }
        }
        return null;
    };
    let trimmed = doTrim(true);
    if (trimmed === null) {
        trimmed = doTrim(false);
    }
    if (trimmed === null) {
        trimmed = category;
    }
    return trimmed;
}
function isExtensionToggleSetting(setting, productService) {
    return ENABLE_EXTENSION_TOGGLE_SETTINGS &&
        !!productService.extensionRecommendations &&
        !!setting.displayExtensionId;
}
function isExcludeSetting(setting) {
    return setting.key === 'files.exclude' ||
        setting.key === 'search.exclude' ||
        setting.key === 'workbench.localHistory.exclude' ||
        setting.key === 'explorer.autoRevealExclude' ||
        setting.key === 'files.readonlyExclude' ||
        setting.key === 'files.watcherExclude';
}
function isIncludeSetting(setting) {
    return setting.key === 'files.readonlyInclude';
}
// The values of the following settings when a default values has been removed
export function objectSettingSupportsRemoveDefaultValue(key) {
    return key === 'workbench.editor.customLabels.patterns';
}
function isSimpleType(type) {
    return type === 'string' || type === 'boolean' || type === 'integer' || type === 'number';
}
function getObjectRenderableSchemaType(schema, key) {
    const { type } = schema;
    if (Array.isArray(type)) {
        if (objectSettingSupportsRemoveDefaultValue(key) && type.length === 2) {
            if (type.includes('null') && (type.includes('string') || type.includes('boolean') || type.includes('integer') || type.includes('number'))) {
                return 'simple';
            }
        }
        for (const t of type) {
            if (!isSimpleType(t)) {
                return false;
            }
        }
        return 'complex';
    }
    if (isSimpleType(type)) {
        return 'simple';
    }
    if (type === 'array') {
        if (schema.items) {
            const itemSchemas = Array.isArray(schema.items) ? schema.items : [schema.items];
            for (const { type } of itemSchemas) {
                if (Array.isArray(type)) {
                    for (const t of type) {
                        if (!isSimpleType(t)) {
                            return false;
                        }
                    }
                    return 'complex';
                }
                if (!isSimpleType(type)) {
                    return false;
                }
                return 'complex';
            }
        }
        return false;
    }
    return false;
}
function getObjectSettingSchemaType({ key, type, objectProperties, objectPatternProperties, objectAdditionalProperties }) {
    if (type !== 'object') {
        return false;
    }
    // object can have any shape
    if (isUndefinedOrNull(objectProperties) &&
        isUndefinedOrNull(objectPatternProperties) &&
        isUndefinedOrNull(objectAdditionalProperties)) {
        return false;
    }
    // objectAdditionalProperties allow the setting to have any shape,
    // but if there's a pattern property that handles everything, then every
    // property will match that patternProperty, so we don't need to look at
    // the value of objectAdditionalProperties in that case.
    if ((objectAdditionalProperties === true || objectAdditionalProperties === undefined)
        && !Object.keys(objectPatternProperties ?? {}).includes('.*')) {
        return false;
    }
    const schemas = [...Object.values(objectProperties ?? {}), ...Object.values(objectPatternProperties ?? {})];
    if (objectAdditionalProperties && typeof objectAdditionalProperties === 'object') {
        schemas.push(objectAdditionalProperties);
    }
    let schemaType = 'simple';
    for (const schema of schemas) {
        for (const subSchema of Array.isArray(schema.anyOf) ? schema.anyOf : [schema]) {
            const subSchemaType = getObjectRenderableSchemaType(subSchema, key);
            if (subSchemaType === false) {
                return false;
            }
            if (subSchemaType === 'complex') {
                schemaType = 'complex';
            }
        }
    }
    return schemaType;
}
function settingTypeEnumRenderable(_type) {
    const enumRenderableSettingTypes = ['string', 'boolean', 'null', 'integer', 'number'];
    const type = Array.isArray(_type) ? _type : [_type];
    return type.every(type => enumRenderableSettingTypes.includes(type));
}
export var SearchResultIdx;
(function (SearchResultIdx) {
    SearchResultIdx[SearchResultIdx["Local"] = 0] = "Local";
    SearchResultIdx[SearchResultIdx["Remote"] = 1] = "Remote";
    SearchResultIdx[SearchResultIdx["NewExtensions"] = 2] = "NewExtensions";
    SearchResultIdx[SearchResultIdx["Embeddings"] = 3] = "Embeddings";
    SearchResultIdx[SearchResultIdx["AiSelected"] = 4] = "AiSelected";
})(SearchResultIdx || (SearchResultIdx = {}));
let SearchResultModel = class SearchResultModel extends SettingsTreeModel {
    constructor(viewState, settingsOrderByTocIndex, isWorkspaceTrusted, configurationService, environmentService, languageService, userDataProfileService, productService) {
        super(viewState, isWorkspaceTrusted, configurationService, languageService, userDataProfileService, productService);
        this.environmentService = environmentService;
        this.rawSearchResults = null;
        this.newExtensionSearchResults = null;
        this.searchResultCount = null;
        this.aiFilterEnabled = false;
        this.id = 'searchResultModel';
        this.settingsOrderByTocIndex = settingsOrderByTocIndex;
        this.cachedUniqueSearchResults = new Map();
        this.update({ id: 'searchResultModel', label: '' });
    }
    set showAiResults(show) {
        this.aiFilterEnabled = show;
        this.updateChildren();
    }
    sortResults(filterMatches) {
        if (this.settingsOrderByTocIndex) {
            for (const match of filterMatches) {
                match.setting.internalOrder = this.settingsOrderByTocIndex.get(match.setting.key);
            }
        }
        // The search only has filters, so we can sort by the order in the TOC.
        if (!this._viewState.query) {
            return filterMatches.sort((a, b) => compareTwoNullableNumbers(a.setting.internalOrder, b.setting.internalOrder));
        }
        // Sort the settings according to their relevancy.
        // https://github.com/microsoft/vscode/issues/197773
        filterMatches.sort((a, b) => {
            if (a.matchType !== b.matchType) {
                // Sort by match type if the match types are not the same.
                // The priority of the match type is given by the SettingMatchType enum.
                return b.matchType - a.matchType;
            }
            else if ((a.matchType & SettingMatchType.NonContiguousWordsInSettingsLabel) || (a.matchType & SettingMatchType.ContiguousWordsInSettingsLabel)) {
                // The match types of a and b are the same and can be sorted by their number of matched words.
                // If those numbers are the same, sort by the order in the table of contents.
                return (b.keyMatchScore - a.keyMatchScore) || compareTwoNullableNumbers(a.setting.internalOrder, b.setting.internalOrder);
            }
            else if (a.matchType === SettingMatchType.RemoteMatch) {
                // The match types are the same and are RemoteMatch.
                // Sort by score.
                return b.score - a.score;
            }
            else {
                // The match types are the same but are not RemoteMatch.
                // Sort by their order in the table of contents.
                return compareTwoNullableNumbers(a.setting.internalOrder, b.setting.internalOrder);
            }
        });
        // Remove duplicates, which sometimes occur with settings
        // such as the experimental toggle setting.
        return arrays.distinct(filterMatches, (match) => match.setting.key);
    }
    getUniqueSearchResults() {
        const cachedResults = this.cachedUniqueSearchResults.get(this.aiFilterEnabled);
        if (cachedResults) {
            return cachedResults;
        }
        if (!this.rawSearchResults) {
            return null;
        }
        let combinedFilterMatches = [];
        if (this.aiFilterEnabled) {
            const aiSelectedKeys = new Set();
            const aiSelectedResult = this.rawSearchResults[4 /* SearchResultIdx.AiSelected */];
            if (aiSelectedResult) {
                aiSelectedResult.filterMatches.forEach(m => aiSelectedKeys.add(m.setting.key));
                combinedFilterMatches = aiSelectedResult.filterMatches;
            }
            const embeddingsResult = this.rawSearchResults[3 /* SearchResultIdx.Embeddings */];
            if (embeddingsResult) {
                embeddingsResult.filterMatches = embeddingsResult.filterMatches.filter(m => !aiSelectedKeys.has(m.setting.key));
                combinedFilterMatches = combinedFilterMatches.concat(embeddingsResult.filterMatches);
            }
            const result = {
                filterMatches: combinedFilterMatches,
                exactMatch: false
            };
            this.cachedUniqueSearchResults.set(true, result);
            return result;
        }
        const localMatchKeys = new Set();
        const localResult = this.rawSearchResults[0 /* SearchResultIdx.Local */];
        if (localResult) {
            localResult.filterMatches.forEach(m => localMatchKeys.add(m.setting.key));
            combinedFilterMatches = localResult.filterMatches;
        }
        const remoteResult = this.rawSearchResults[1 /* SearchResultIdx.Remote */];
        if (remoteResult) {
            remoteResult.filterMatches = remoteResult.filterMatches.filter(m => !localMatchKeys.has(m.setting.key));
            combinedFilterMatches = combinedFilterMatches.concat(remoteResult.filterMatches);
            this.newExtensionSearchResults = this.rawSearchResults[2 /* SearchResultIdx.NewExtensions */];
        }
        combinedFilterMatches = this.sortResults(combinedFilterMatches);
        const result = {
            filterMatches: combinedFilterMatches,
            exactMatch: localResult.exactMatch // remote results should never have an exact match
        };
        this.cachedUniqueSearchResults.set(false, result);
        return result;
    }
    getRawResults() {
        return this.rawSearchResults ?? [];
    }
    getUniqueSearchResultSettings() {
        return this.getUniqueSearchResults()?.filterMatches.map(m => m.setting) ?? [];
    }
    updateChildren() {
        this.update({
            id: 'searchResultModel',
            label: 'searchResultModel',
            settings: this.getUniqueSearchResultSettings()
        });
        // Save time by filtering children in the search model instead of relying on the tree filter, which still requires heights to be calculated.
        const isRemote = !!this.environmentService.remoteAuthority;
        const newChildren = [];
        for (const child of this.root.children) {
            if (child instanceof SettingsTreeSettingElement
                && child.matchesAllTags(this._viewState.tagFilters)
                && child.matchesScope(this._viewState.settingsTarget, isRemote)
                && child.matchesAnyExtension(this._viewState.extensionFilters)
                && child.matchesAnyId(this._viewState.idFilters)
                && child.matchesAnyFeature(this._viewState.featureFilters)
                && child.matchesAllLanguages(this._viewState.languageFilter)) {
                newChildren.push(child);
            }
            else {
                child.dispose();
            }
        }
        this.root.children = newChildren;
        this.searchResultCount = this.root.children.length;
        if (this.newExtensionSearchResults?.filterMatches.length) {
            let resultExtensionIds = this.newExtensionSearchResults.filterMatches
                .map(result => result.setting)
                .filter(setting => setting.extensionName && setting.extensionPublisher)
                .map(setting => `${setting.extensionPublisher}.${setting.extensionName}`);
            resultExtensionIds = arrays.distinct(resultExtensionIds);
            if (resultExtensionIds.length) {
                const newExtElement = new SettingsTreeNewExtensionsElement('newExtensions', resultExtensionIds);
                newExtElement.parent = this._root;
                this._root.children.push(newExtElement);
            }
        }
    }
    setResult(order, result) {
        this.cachedUniqueSearchResults.clear();
        this.newExtensionSearchResults = null;
        if (this.rawSearchResults && order === 0 /* SearchResultIdx.Local */) {
            // To prevent the Settings editor from showing
            // stale remote results mid-search.
            delete this.rawSearchResults[1 /* SearchResultIdx.Remote */];
        }
        this.rawSearchResults ??= [];
        if (!result) {
            delete this.rawSearchResults[order];
            return;
        }
        this.rawSearchResults[order] = result;
        this.updateChildren();
    }
    getUniqueResultsCount() {
        return this.searchResultCount ?? 0;
    }
};
SearchResultModel = __decorate([
    __param(3, IWorkbenchConfigurationService),
    __param(4, IWorkbenchEnvironmentService),
    __param(5, ILanguageService),
    __param(6, IUserDataProfileService),
    __param(7, IProductService)
], SearchResultModel);
export { SearchResultModel };
const tagRegex = /(^|\s)@tag:("([^"]*)"|[^"]\S*)/g;
const extensionRegex = /(^|\s)@ext:("([^"]*)"|[^"]\S*)?/g;
const featureRegex = /(^|\s)@feature:("([^"]*)"|[^"]\S*)?/g;
const idRegex = /(^|\s)@id:("([^"]*)"|[^"]\S*)?/g;
const languageRegex = /(^|\s)@lang:("([^"]*)"|[^"]\S*)?/g;
export function parseQuery(query) {
    /**
     * A helper function to parse the query on one type of regex.
     *
     * @param query The search query
     * @param filterRegex The regex to use on the query
     * @param parsedParts The parts that the regex parses out will be appended to the array passed in here.
     * @returns The query with the parsed parts removed
     */
    function getTagsForType(query, filterRegex, parsedParts) {
        return query.replace(filterRegex, (_, __, quotedParsedElement, unquotedParsedElement) => {
            const parsedElement = unquotedParsedElement || quotedParsedElement;
            if (parsedElement) {
                parsedParts.push(...parsedElement.split(',').map(s => s.trim()).filter(s => !isFalsyOrWhitespace(s)));
            }
            return '';
        });
    }
    const tags = [];
    query = query.replace(tagRegex, (_, __, quotedTag, tag) => {
        tags.push(tag || quotedTag);
        return '';
    });
    query = query.replace(`@${MODIFIED_SETTING_TAG}`, () => {
        tags.push(MODIFIED_SETTING_TAG);
        return '';
    });
    query = query.replace(`@${POLICY_SETTING_TAG}`, () => {
        tags.push(POLICY_SETTING_TAG);
        return '';
    });
    // Handle @stable by excluding preview and experimental tags
    query = query.replace(/@stable/g, () => {
        tags.push('stable');
        return '';
    });
    const extensions = [];
    const features = [];
    const ids = [];
    const langs = [];
    query = getTagsForType(query, extensionRegex, extensions);
    query = getTagsForType(query, featureRegex, features);
    query = getTagsForType(query, idRegex, ids);
    if (ENABLE_LANGUAGE_FILTER) {
        query = getTagsForType(query, languageRegex, langs);
    }
    query = query.trim();
    // For now, only return the first found language filter
    return {
        tags,
        extensionFilters: extensions,
        featureFilters: features,
        idFilters: ids,
        languageFilter: langs.length ? langs[0] : undefined,
        query,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3NUcmVlTW9kZWxzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3ByZWZlcmVuY2VzL2Jyb3dzZXIvc2V0dGluZ3NUcmVlTW9kZWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxNQUFNLE1BQU0sbUNBQW1DLENBQUM7QUFDNUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRTNELE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMvRSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNqRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDbkYsT0FBTyxFQUF1Qiw2QkFBNkIsRUFBdUIsTUFBTSw0REFBNEQsQ0FBQztBQUNySixPQUFPLEVBQXVELHFCQUFxQixFQUFFLFVBQVUsRUFBMEIsTUFBTSxvRUFBb0UsQ0FBQztBQUNwTSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDeEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzVFLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxhQUFhLEVBQUUsOEJBQThCLEVBQUUsb0JBQW9CLEVBQUUscUJBQXFCLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMzTSxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSw0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