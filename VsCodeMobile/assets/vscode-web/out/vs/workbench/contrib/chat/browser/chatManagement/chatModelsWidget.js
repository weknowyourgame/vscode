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
var ModelNameColumnRenderer_1, TokenLimitsColumnRenderer_1, ActionsColumnRenderer_1, ChatModelsWidget_1;
import './media/chatModelsWidget.css';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../../base/common/event.js';
import * as DOM from '../../../../../base/browser/dom.js';
import { Button } from '../../../../../base/browser/ui/button/button.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { ILanguageModelsService } from '../../../chat/common/languageModels.js';
import { localize } from '../../../../../nls.js';
import { defaultButtonStyles } from '../../../../../platform/theme/browser/defaultStyles.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchTable } from '../../../../../platform/list/browser/listService.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { toAction, Action, Separator, SubmenuAction } from '../../../../../base/common/actions.js';
import { ActionBar } from '../../../../../base/browser/ui/actionbar/actionbar.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ChatModelsViewModel, SEARCH_SUGGESTIONS, isVendorEntry, isGroupEntry } from './chatModelsViewModel.js';
import { HighlightedLabel } from '../../../../../base/browser/ui/highlightedlabel/highlightedLabel.js';
import { SuggestEnabledInput } from '../../../codeEditor/browser/suggestEnabledInput/suggestEnabledInput.js';
import { Delayer } from '../../../../../base/common/async.js';
import { settingsTextInputBorder } from '../../../preferences/common/settingsEditorColorRegistry.js';
import { IChatEntitlementService, ChatEntitlement } from '../../../../services/chat/common/chatEntitlementService.js';
import { DropdownMenuActionViewItem } from '../../../../../base/browser/ui/dropdown/dropdownActionViewItem.js';
import { ToolBar } from '../../../../../base/browser/ui/toolbar/toolbar.js';
import { preferencesClearInputIcon } from '../../../preferences/browser/preferencesIcons.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IEditorProgressService } from '../../../../../platform/progress/common/progress.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { CONTEXT_MODELS_SEARCH_FOCUS } from '../../common/constants.js';
const $ = DOM.$;
const HEADER_HEIGHT = 30;
const VENDOR_ROW_HEIGHT = 30;
const MODEL_ROW_HEIGHT = 26;
export function getModelHoverContent(model) {
    const markdown = new MarkdownString('', { isTrusted: true, supportThemeIcons: true });
    markdown.appendMarkdown(`**${model.metadata.name}**`);
    if (model.metadata.id !== model.metadata.version) {
        markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${model.metadata.id}@${model.metadata.version}_&nbsp;</span>`);
    }
    else {
        markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${model.metadata.id}_&nbsp;</span>`);
    }
    markdown.appendText(`\n`);
    if (model.metadata.statusIcon && model.metadata.tooltip) {
        if (model.metadata.statusIcon) {
            markdown.appendMarkdown(`$(${model.metadata.statusIcon.id})&nbsp;`);
        }
        markdown.appendMarkdown(`${model.metadata.tooltip}`);
        markdown.appendText(`\n`);
    }
    if (model.metadata.detail) {
        markdown.appendMarkdown(`${localize('models.cost', 'Multiplier')}: `);
        markdown.appendMarkdown(model.metadata.detail);
        markdown.appendText(`\n`);
    }
    if (model.metadata.maxInputTokens || model.metadata.maxOutputTokens) {
        markdown.appendMarkdown(`${localize('models.contextSize', 'Context Size')}: `);
        let addSeparator = false;
        if (model.metadata.maxInputTokens) {
            markdown.appendMarkdown(`$(arrow-down) ${formatTokenCount(model.metadata.maxInputTokens)} (${localize('models.input', 'Input')})`);
            addSeparator = true;
        }
        if (model.metadata.maxOutputTokens) {
            if (addSeparator) {
                markdown.appendText(`  |  `);
            }
            markdown.appendMarkdown(`$(arrow-up) ${formatTokenCount(model.metadata.maxOutputTokens)} (${localize('models.output', 'Output')})`);
        }
        markdown.appendText(`\n`);
    }
    if (model.metadata.capabilities) {
        markdown.appendMarkdown(`${localize('models.capabilities', 'Capabilities')}: `);
        if (model.metadata.capabilities?.toolCalling) {
            markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${localize('models.toolCalling', 'Tools')}_&nbsp;</span>`);
        }
        if (model.metadata.capabilities?.vision) {
            markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${localize('models.vision', 'Vision')}_&nbsp;</span>`);
        }
        if (model.metadata.capabilities?.agentMode) {
            markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${localize('models.agentMode', 'Agent Mode')}_&nbsp;</span>`);
        }
        for (const editTool of model.metadata.capabilities.editTools ?? []) {
            markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${editTool}_&nbsp;</span>`);
        }
        markdown.appendText(`\n`);
    }
    return markdown;
}
class ModelsFilterAction extends Action {
    constructor() {
        super('workbench.models.filter', localize('filter', "Filter"), ThemeIcon.asClassName(Codicon.filter));
    }
    async run() {
    }
}
function toggleFilter(currentQuery, query, alternativeQueries = []) {
    const allQueries = [query, ...alternativeQueries];
    const isChecked = allQueries.some(q => currentQuery.includes(q));
    if (!isChecked) {
        const trimmedQuery = currentQuery.trim();
        return trimmedQuery ? `${trimmedQuery} ${query}` : query;
    }
    else {
        let queryWithRemovedFilter = currentQuery;
        for (const q of allQueries) {
            queryWithRemovedFilter = queryWithRemovedFilter.replace(q, '');
        }
        return queryWithRemovedFilter.replace(/\s+/g, ' ').trim();
    }
}
let ModelsSearchFilterDropdownMenuActionViewItem = class ModelsSearchFilterDropdownMenuActionViewItem extends DropdownMenuActionViewItem {
    constructor(action, options, searchWidget, viewModel, contextMenuService) {
        super(action, { getActions: () => this.getActions() }, contextMenuService, {
            ...options,
            classNames: action.class,
            anchorAlignmentProvider: () => 1 /* AnchorAlignment.RIGHT */,
            menuAsChild: true
        });
        this.searchWidget = searchWidget;
        this.viewModel = viewModel;
    }
    createGroupByAction(grouping, label) {
        return {
            id: `groupBy.${grouping}`,
            label,
            class: undefined,
            enabled: true,
            tooltip: localize('groupByTooltip', "Group by {0}", label),
            checked: this.viewModel.groupBy === grouping,
            run: () => {
                this.viewModel.groupBy = grouping;
            }
        };
    }
    createProviderAction(vendor, displayName) {
        const query = `@provider:"${displayName}"`;
        const currentQuery = this.searchWidget.getValue();
        const isChecked = currentQuery.includes(query) || currentQuery.includes(`@provider:${vendor}`);
        return {
            id: `provider-${vendor}`,
            label: displayName,
            tooltip: localize('filterByProvider', "Filter by {0}", displayName),
            class: undefined,
            enabled: true,
            checked: isChecked,
            run: () => this.toggleFilterAndSearch(query, [`@provider:${vendor}`])
        };
    }
    createCapabilityAction(capability, label) {
        const query = `@capability:${capability}`;
        const currentQuery = this.searchWidget.getValue();
        const isChecked = currentQuery.includes(query);
        return {
            id: `capability-${capability}`,
            label,
            tooltip: localize('filterByCapability', "Filter by {0}", label),
            class: undefined,
            enabled: true,
            checked: isChecked,
            run: () => this.toggleFilterAndSearch(query)
        };
    }
    createVisibleAction(visible, label) {
        const query = `@visible:${visible}`;
        const oppositeQuery = `@visible:${!visible}`;
        const currentQuery = this.searchWidget.getValue();
        const isChecked = currentQuery.includes(query);
        return {
            id: `visible-${visible}`,
            label,
            tooltip: localize('filterByVisible', "Filter by {0}", label),
            class: undefined,
            enabled: true,
            checked: isChecked,
            run: () => this.toggleFilterAndSearch(query, [oppositeQuery])
        };
    }
    toggleFilterAndSearch(query, alternativeQueries = []) {
        const currentQuery = this.searchWidget.getValue();
        const newQuery = toggleFilter(currentQuery, query, alternativeQueries);
        this.searchWidget.setValue(newQuery);
        this.searchWidget.focus();
    }
    getActions() {
        const actions = [];
        // Visibility filters
        actions.push(this.createVisibleAction(true, localize('filter.visible', 'Visible')));
        actions.push(this.createVisibleAction(false, localize('filter.hidden', 'Hidden')));
        // Capability filters
        actions.push(new Separator());
        actions.push(this.createCapabilityAction('tools', localize('capability.tools', 'Tools')), this.createCapabilityAction('vision', localize('capability.vision', 'Vision')), this.createCapabilityAction('agent', localize('capability.agent', 'Agent Mode')));
        // Provider filters - only show providers with configured models
        const configuredVendors = this.viewModel.getConfiguredVendors();
        if (configuredVendors.length > 1) {
            actions.push(new Separator());
            actions.push(...configuredVendors.map(vendor => this.createProviderAction(vendor.vendor, vendor.vendorDisplayName)));
        }
        // Group By
        actions.push(new Separator());
        const groupByActions = [];
        groupByActions.push(this.createGroupByAction("vendor" /* ChatModelGroup.Vendor */, localize('groupBy.provider', 'Provider')));
        groupByActions.push(this.createGroupByAction("visibility" /* ChatModelGroup.Visibility */, localize('groupBy.visibility', 'Visibility')));
        actions.push(new SubmenuAction('groupBy', localize('groupBy', "Group By"), groupByActions));
        return actions;
    }
};
ModelsSearchFilterDropdownMenuActionViewItem = __decorate([
    __param(4, IContextMenuService)
], ModelsSearchFilterDropdownMenuActionViewItem);
class Delegate {
    constructor() {
        this.headerRowHeight = HEADER_HEIGHT;
    }
    getHeight(element) {
        return isVendorEntry(element) || isGroupEntry(element) ? VENDOR_ROW_HEIGHT : MODEL_ROW_HEIGHT;
    }
}
class ModelsTableColumnRenderer {
    renderElement(element, index, templateData) {
        templateData.elementDisposables.clear();
        const isVendor = isVendorEntry(element);
        const isGroup = isGroupEntry(element);
        templateData.container.classList.add('models-table-column');
        templateData.container.parentElement.classList.toggle('models-vendor-row', isVendor || isGroup);
        templateData.container.parentElement.classList.toggle('models-model-row', !isVendor && !isGroup);
        templateData.container.parentElement.classList.toggle('model-hidden', !isVendor && !isGroup && !element.modelEntry.metadata.isUserSelectable);
        if (isVendor) {
            this.renderVendorElement(element, index, templateData);
        }
        else if (isGroup) {
            this.renderGroupElement(element, index, templateData);
        }
        else {
            this.renderModelElement(element, index, templateData);
        }
    }
    disposeTemplate(templateData) {
        templateData.elementDisposables.dispose();
        templateData.disposables.dispose();
    }
}
class GutterColumnRenderer extends ModelsTableColumnRenderer {
    static { this.TEMPLATE_ID = 'gutter'; }
    constructor(viewModel) {
        super();
        this.viewModel = viewModel;
        this.templateId = GutterColumnRenderer.TEMPLATE_ID;
    }
    renderTemplate(container) {
        const disposables = new DisposableStore();
        const elementDisposables = new DisposableStore();
        container.classList.add('models-gutter-column');
        const actionBar = disposables.add(new ActionBar(container));
        return {
            rowContainer: container.parentElement,
            container,
            actionBar,
            disposables,
            elementDisposables
        };
    }
    renderElement(entry, index, templateData) {
        templateData.actionBar.clear();
        super.renderElement(entry, index, templateData);
    }
    renderVendorElement(entry, index, templateData) {
        templateData.actionBar.push(this.createToggleCollapseAction(entry), { icon: true, label: false });
    }
    renderGroupElement(entry, index, templateData) {
        templateData.actionBar.push(this.createToggleCollapseAction(entry), { icon: true, label: false });
    }
    createToggleCollapseAction(entry) {
        const label = entry.collapsed ? localize('expand', 'Expand') : localize('collapse', 'Collapse');
        return {
            id: 'toggleCollapse',
            label,
            tooltip: label,
            enabled: true,
            class: ThemeIcon.asClassName(entry.collapsed ? Codicon.chevronRight : Codicon.chevronDown),
            run: () => this.viewModel.toggleCollapsed(entry)
        };
    }
    renderModelElement(entry, index, templateData) {
        const { modelEntry } = entry;
        const isVisible = modelEntry.metadata.isUserSelectable ?? false;
        const toggleVisibilityAction = toAction({
            id: 'toggleVisibility',
            label: isVisible ? localize('models.hide', 'Hide') : localize('models.show', 'Show'),
            class: `model-visibility-toggle ${isVisible ? `${ThemeIcon.asClassName(Codicon.eye)} model-visible` : `${ThemeIcon.asClassName(Codicon.eyeClosed)} model-hidden`}`,
            tooltip: isVisible ? localize('models.visible', 'Hide in the chat model picker') : localize('models.hidden', 'Show in the chat model picker'),
            checked: !isVisible,
            run: async () => this.viewModel.toggleVisibility(entry)
        });
        templateData.actionBar.push(toggleVisibilityAction, { icon: true, label: false });
    }
}
let ModelNameColumnRenderer = class ModelNameColumnRenderer extends ModelsTableColumnRenderer {
    static { ModelNameColumnRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'modelName'; }
    constructor(hoverService) {
        super();
        this.hoverService = hoverService;
        this.templateId = ModelNameColumnRenderer_1.TEMPLATE_ID;
    }
    renderTemplate(container) {
        const disposables = new DisposableStore();
        const elementDisposables = new DisposableStore();
        const nameContainer = DOM.append(container, $('.model-name-container'));
        const nameLabel = disposables.add(new HighlightedLabel(DOM.append(nameContainer, $('.model-name'))));
        const statusIcon = DOM.append(nameContainer, $('.model-status-icon'));
        const actionBar = disposables.add(new ActionBar(DOM.append(nameContainer, $('.model-name-actions'))));
        return {
            container,
            statusIcon,
            nameLabel,
            actionBar,
            disposables,
            elementDisposables
        };
    }
    renderElement(entry, index, templateData) {
        DOM.clearNode(templateData.statusIcon);
        templateData.actionBar.clear();
        super.renderElement(entry, index, templateData);
    }
    renderVendorElement(entry, index, templateData) {
        templateData.nameLabel.set(entry.vendorEntry.vendorDisplayName, undefined);
    }
    renderGroupElement(entry, index, templateData) {
        templateData.nameLabel.set(entry.label, undefined);
    }
    renderModelElement(entry, index, templateData) {
        const { modelEntry, modelNameMatches } = entry;
        templateData.statusIcon.className = 'model-status-icon';
        if (modelEntry.metadata.statusIcon) {
            templateData.statusIcon.classList.add(...ThemeIcon.asClassNameArray(modelEntry.metadata.statusIcon));
            templateData.statusIcon.style.display = '';
        }
        else {
            templateData.statusIcon.style.display = 'none';
        }
        templateData.nameLabel.set(modelEntry.metadata.name, modelNameMatches);
        const markdown = new MarkdownString('', { isTrusted: true, supportThemeIcons: true });
        markdown.appendMarkdown(`**${entry.modelEntry.metadata.name}**`);
        if (entry.modelEntry.metadata.id !== entry.modelEntry.metadata.version) {
            markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${entry.modelEntry.metadata.id}@${entry.modelEntry.metadata.version}_&nbsp;</span>`);
        }
        else {
            markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">&nbsp;_${entry.modelEntry.metadata.id}_&nbsp;</span>`);
        }
        markdown.appendText(`\n`);
        if (entry.modelEntry.metadata.statusIcon && entry.modelEntry.metadata.tooltip) {
            if (entry.modelEntry.metadata.statusIcon) {
                markdown.appendMarkdown(`$(${entry.modelEntry.metadata.statusIcon.id})&nbsp;`);
            }
            markdown.appendMarkdown(`${entry.modelEntry.metadata.tooltip}`);
            markdown.appendText(`\n`);
        }
        if (!entry.modelEntry.metadata.isUserSelectable) {
            markdown.appendMarkdown(`\n\n${localize('models.userSelectable', 'This model is hidden in the chat model picker')}`);
        }
        templateData.elementDisposables.add(this.hoverService.setupDelayedHoverAtMouse(templateData.container, () => ({
            content: markdown,
            appearance: {
                compact: true,
                skipFadeInAnimation: true,
            }
        })));
    }
};
ModelNameColumnRenderer = ModelNameColumnRenderer_1 = __decorate([
    __param(0, IHoverService)
], ModelNameColumnRenderer);
class MultiplierColumnRenderer extends ModelsTableColumnRenderer {
    constructor() {
        super(...arguments);
        this.templateId = MultiplierColumnRenderer.TEMPLATE_ID;
    }
    static { this.TEMPLATE_ID = 'multiplier'; }
    renderTemplate(container) {
        const disposables = new DisposableStore();
        const elementDisposables = new DisposableStore();
        const multiplierElement = DOM.append(container, $('.model-multiplier'));
        return {
            container,
            multiplierElement,
            disposables,
            elementDisposables
        };
    }
    renderVendorElement(entry, index, templateData) {
        templateData.multiplierElement.textContent = '';
    }
    renderGroupElement(entry, index, templateData) {
        templateData.multiplierElement.textContent = '';
    }
    renderModelElement(entry, index, templateData) {
        templateData.multiplierElement.textContent = (entry.modelEntry.metadata.detail && entry.modelEntry.metadata.detail.trim().toLowerCase() !== entry.modelEntry.vendor.trim().toLowerCase()) ? entry.modelEntry.metadata.detail : '-';
    }
}
let TokenLimitsColumnRenderer = class TokenLimitsColumnRenderer extends ModelsTableColumnRenderer {
    static { TokenLimitsColumnRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'tokenLimits'; }
    constructor(hoverService) {
        super();
        this.hoverService = hoverService;
        this.templateId = TokenLimitsColumnRenderer_1.TEMPLATE_ID;
    }
    renderTemplate(container) {
        const disposables = new DisposableStore();
        const elementDisposables = new DisposableStore();
        const tokenLimitsElement = DOM.append(container, $('.model-token-limits'));
        return {
            container,
            tokenLimitsElement,
            disposables,
            elementDisposables
        };
    }
    renderElement(entry, index, templateData) {
        DOM.clearNode(templateData.tokenLimitsElement);
        super.renderElement(entry, index, templateData);
    }
    renderVendorElement(entry, index, templateData) {
    }
    renderGroupElement(entry, index, templateData) {
    }
    renderModelElement(entry, index, templateData) {
        const { modelEntry } = entry;
        const markdown = new MarkdownString('', { isTrusted: true, supportThemeIcons: true });
        if (modelEntry.metadata.maxInputTokens || modelEntry.metadata.maxOutputTokens) {
            let addSeparator = false;
            markdown.appendMarkdown(`${localize('models.contextSize', 'Context Size')}: `);
            if (modelEntry.metadata.maxInputTokens) {
                const inputDiv = DOM.append(templateData.tokenLimitsElement, $('.token-limit-item'));
                DOM.append(inputDiv, $('span.codicon.codicon-arrow-down'));
                const inputText = DOM.append(inputDiv, $('span'));
                inputText.textContent = formatTokenCount(modelEntry.metadata.maxInputTokens);
                markdown.appendMarkdown(`$(arrow-down) ${modelEntry.metadata.maxInputTokens} (${localize('models.input', 'Input')})`);
                addSeparator = true;
            }
            if (modelEntry.metadata.maxOutputTokens) {
                const outputDiv = DOM.append(templateData.tokenLimitsElement, $('.token-limit-item'));
                DOM.append(outputDiv, $('span.codicon.codicon-arrow-up'));
                const outputText = DOM.append(outputDiv, $('span'));
                outputText.textContent = formatTokenCount(modelEntry.metadata.maxOutputTokens);
                if (addSeparator) {
                    markdown.appendText(`  |  `);
                }
                markdown.appendMarkdown(`$(arrow-up) ${modelEntry.metadata.maxOutputTokens} (${localize('models.output', 'Output')})`);
            }
        }
        templateData.elementDisposables.add(this.hoverService.setupDelayedHoverAtMouse(templateData.container, () => ({
            content: markdown,
            appearance: {
                compact: true,
                skipFadeInAnimation: true,
            }
        })));
    }
};
TokenLimitsColumnRenderer = TokenLimitsColumnRenderer_1 = __decorate([
    __param(0, IHoverService)
], TokenLimitsColumnRenderer);
class CapabilitiesColumnRenderer extends ModelsTableColumnRenderer {
    constructor() {
        super(...arguments);
        this.templateId = CapabilitiesColumnRenderer.TEMPLATE_ID;
        this._onDidClickCapability = new Emitter();
        this.onDidClickCapability = this._onDidClickCapability.event;
    }
    static { this.TEMPLATE_ID = 'capabilities'; }
    renderTemplate(container) {
        const disposables = new DisposableStore();
        const elementDisposables = new DisposableStore();
        container.classList.add('model-capability-column');
        const metadataRow = DOM.append(container, $('.model-capabilities'));
        return {
            container,
            metadataRow,
            disposables,
            elementDisposables
        };
    }
    renderElement(entry, index, templateData) {
        DOM.clearNode(templateData.metadataRow);
        super.renderElement(entry, index, templateData);
    }
    renderVendorElement(entry, index, templateData) {
    }
    renderGroupElement(entry, index, templateData) {
    }
    renderModelElement(entry, index, templateData) {
        const { modelEntry, capabilityMatches } = entry;
        if (modelEntry.metadata.capabilities?.toolCalling) {
            templateData.elementDisposables.add(this.createCapabilityButton(templateData.metadataRow, capabilityMatches?.includes('toolCalling') || false, localize('models.tools', 'Tools'), 'tools'));
        }
        if (modelEntry.metadata.capabilities?.vision) {
            templateData.elementDisposables.add(this.createCapabilityButton(templateData.metadataRow, capabilityMatches?.includes('vision') || false, localize('models.vision', 'Vision'), 'vision'));
        }
    }
    createCapabilityButton(container, isActive, label, capability) {
        const disposables = new DisposableStore();
        const buttonContainer = DOM.append(container, $('.model-badge-container'));
        const button = disposables.add(new Button(buttonContainer, { secondary: true }));
        button.element.classList.add('model-capability');
        button.element.classList.toggle('active', isActive);
        button.label = label;
        disposables.add(button.onDidClick(() => this._onDidClickCapability.fire(capability)));
        return disposables;
    }
}
let ActionsColumnRenderer = class ActionsColumnRenderer extends ModelsTableColumnRenderer {
    static { ActionsColumnRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'actions'; }
    constructor(viewModel, commandService) {
        super();
        this.viewModel = viewModel;
        this.commandService = commandService;
        this.templateId = ActionsColumnRenderer_1.TEMPLATE_ID;
    }
    renderTemplate(container) {
        const disposables = new DisposableStore();
        const elementDisposables = new DisposableStore();
        const parent = DOM.append(container, $('.actions-column'));
        const actionBar = disposables.add(new ActionBar(parent));
        return {
            container,
            actionBar,
            disposables,
            elementDisposables
        };
    }
    renderElement(entry, index, templateData) {
        templateData.actionBar.clear();
        super.renderElement(entry, index, templateData);
    }
    renderVendorElement(entry, index, templateData) {
        if (entry.vendorEntry.managementCommand) {
            const { vendorEntry } = entry;
            const action = toAction({
                id: 'manageVendor',
                label: localize('models.manageProvider', 'Manage {0}...', entry.vendorEntry.vendorDisplayName),
                class: ThemeIcon.asClassName(Codicon.gear),
                run: async () => {
                    await this.commandService.executeCommand(vendorEntry.managementCommand, vendorEntry.vendor);
                    this.viewModel.refresh();
                }
            });
            templateData.actionBar.push(action, { icon: true, label: false });
        }
    }
    renderGroupElement(entry, index, templateData) {
    }
    renderModelElement(entry, index, templateData) {
        // Visibility action moved to name column
    }
};
ActionsColumnRenderer = ActionsColumnRenderer_1 = __decorate([
    __param(1, ICommandService)
], ActionsColumnRenderer);
class ProviderColumnRenderer extends ModelsTableColumnRenderer {
    constructor() {
        super(...arguments);
        this.templateId = ProviderColumnRenderer.TEMPLATE_ID;
    }
    static { this.TEMPLATE_ID = 'provider'; }
    renderTemplate(container) {
        const disposables = new DisposableStore();
        const elementDisposables = new DisposableStore();
        const providerElement = DOM.append(container, $('.model-provider'));
        return {
            container,
            providerElement,
            disposables,
            elementDisposables
        };
    }
    renderVendorElement(entry, index, templateData) {
        templateData.providerElement.textContent = '';
    }
    renderGroupElement(entry, index, templateData) {
        templateData.providerElement.textContent = '';
    }
    renderModelElement(entry, index, templateData) {
        templateData.providerElement.textContent = entry.modelEntry.vendorDisplayName;
    }
}
function formatTokenCount(count) {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
    }
    else if (count >= 1000) {
        return `${(count / 1000).toFixed(0)}K`;
    }
    return count.toString();
}
let ChatModelsWidget = class ChatModelsWidget extends Disposable {
    static { ChatModelsWidget_1 = this; }
    static { this.NUM_INSTANCES = 0; }
    constructor(languageModelsService, instantiationService, extensionService, contextMenuService, chatEntitlementService, editorProgressService, commandService, contextKeyService) {
        super();
        this.languageModelsService = languageModelsService;
        this.instantiationService = instantiationService;
        this.extensionService = extensionService;
        this.contextMenuService = contextMenuService;
        this.chatEntitlementService = chatEntitlementService;
        this.editorProgressService = editorProgressService;
        this.commandService = commandService;
        this.dropdownActions = [];
        this.tableDisposables = this._register(new DisposableStore());
        this.searchFocusContextKey = CONTEXT_MODELS_SEARCH_FOCUS.bindTo(contextKeyService);
        this.delayedFiltering = new Delayer(200);
        this.viewModel = this._register(this.instantiationService.createInstance(ChatModelsViewModel));
        this.element = DOM.$('.models-widget');
        this.create(this.element);
        const loadingPromise = this.extensionService.whenInstalledExtensionsRegistered().then(() => this.viewModel.refresh());
        this.editorProgressService.showWhile(loadingPromise, 300);
    }
    create(container) {
        const searchAndButtonContainer = DOM.append(container, $('.models-search-and-button-container'));
        const placeholder = localize('Search.FullTextSearchPlaceholder', "Type to search...");
        const searchContainer = DOM.append(searchAndButtonContainer, $('.models-search-container'));
        this.searchWidget = this._register(this.instantiationService.createInstance(SuggestEnabledInput, 'chatModelsWidget.searchbox', searchContainer, {
            triggerCharacters: ['@', ':'],
            provideResults: (query) => {
                const providerSuggestions = this.viewModel.getVendors().map(v => `@provider:"${v.displayName}"`);
                const allSuggestions = [
                    ...providerSuggestions,
                    ...SEARCH_SUGGESTIONS.CAPABILITIES,
                    ...SEARCH_SUGGESTIONS.VISIBILITY,
                ];
                if (!query.trim()) {
                    return allSuggestions;
                }
                const queryParts = query.split(/\s/g);
                const lastPart = queryParts[queryParts.length - 1];
                if (lastPart.startsWith('@provider:')) {
                    return providerSuggestions;
                }
                else if (lastPart.startsWith('@capability:')) {
                    return SEARCH_SUGGESTIONS.CAPABILITIES;
                }
                else if (lastPart.startsWith('@visible:')) {
                    return SEARCH_SUGGESTIONS.VISIBILITY;
                }
                else if (lastPart.startsWith('@')) {
                    return allSuggestions;
                }
                return [];
            }
        }, placeholder, `chatModelsWidget:searchinput:${ChatModelsWidget_1.NUM_INSTANCES++}`, {
            placeholderText: placeholder,
            styleOverrides: {
                inputBorder: settingsTextInputBorder
            },
            focusContextKey: this.searchFocusContextKey,
        }));
        const filterAction = this._register(new ModelsFilterAction());
        const clearSearchAction = this._register(new Action('workbench.models.clearSearch', localize('clearSearch', "Clear Search"), ThemeIcon.asClassName(preferencesClearInputIcon), false, () => {
            this.searchWidget.setValue('');
            this.searchWidget.focus();
        }));
        this._register(this.searchWidget.onInputDidChange(() => {
            clearSearchAction.enabled = !!this.searchWidget.getValue();
            this.filterModels();
        }));
        this.searchActionsContainer = DOM.append(searchContainer, $('.models-search-actions'));
        const actions = [clearSearchAction, filterAction];
        const toolBar = this._register(new ToolBar(this.searchActionsContainer, this.contextMenuService, {
            actionViewItemProvider: (action, options) => {
                if (action.id === filterAction.id) {
                    return this.instantiationService.createInstance(ModelsSearchFilterDropdownMenuActionViewItem, action, options, this.searchWidget, this.viewModel);
                }
                return undefined;
            },
            getKeyBinding: () => undefined
        }));
        toolBar.setActions(actions);
        // Add padding to input box for toolbar
        this.searchWidget.inputWidget.getContainerDomNode().style.paddingRight = `${DOM.getTotalWidth(this.searchActionsContainer) + 12}px`;
        this.addButtonContainer = DOM.append(searchAndButtonContainer, $('.section-title-actions'));
        const buttonOptions = {
            ...defaultButtonStyles,
            supportIcons: true,
        };
        this.addButton = this._register(new Button(this.addButtonContainer, buttonOptions));
        this.addButton.label = `$(${Codicon.add.id}) ${localize('models.enableModelProvider', 'Add Models...')}`;
        this.addButton.element.classList.add('models-add-model-button');
        this.addButton.enabled = false;
        this._register(this.addButton.onDidClick((e) => {
            if (this.dropdownActions.length > 0) {
                this.contextMenuService.showContextMenu({
                    getAnchor: () => this.addButton.element,
                    getActions: () => this.dropdownActions,
                });
            }
        }));
        // Table container
        this.tableContainer = DOM.append(container, $('.models-table-container'));
        // Create table
        this.createTable();
        this._register(this.viewModel.onDidChangeGrouping(() => this.createTable()));
        return;
    }
    createTable() {
        this.tableDisposables.clear();
        DOM.clearNode(this.tableContainer);
        const gutterColumnRenderer = this.instantiationService.createInstance(GutterColumnRenderer, this.viewModel);
        const modelNameColumnRenderer = this.instantiationService.createInstance(ModelNameColumnRenderer);
        const costColumnRenderer = this.instantiationService.createInstance(MultiplierColumnRenderer);
        const tokenLimitsColumnRenderer = this.instantiationService.createInstance(TokenLimitsColumnRenderer);
        const capabilitiesColumnRenderer = this.instantiationService.createInstance(CapabilitiesColumnRenderer);
        const actionsColumnRenderer = this.instantiationService.createInstance(ActionsColumnRenderer, this.viewModel);
        const providerColumnRenderer = this.instantiationService.createInstance(ProviderColumnRenderer);
        this.tableDisposables.add(capabilitiesColumnRenderer.onDidClickCapability(capability => {
            const currentQuery = this.searchWidget.getValue();
            const query = `@capability:${capability}`;
            const newQuery = toggleFilter(currentQuery, query);
            this.searchWidget.setValue(newQuery);
            this.searchWidget.focus();
        }));
        const columns = [
            {
                label: '',
                tooltip: '',
                weight: 0.05,
                minimumWidth: 40,
                maximumWidth: 40,
                templateId: GutterColumnRenderer.TEMPLATE_ID,
                project(row) { return row; }
            },
            {
                label: localize('modelName', 'Name'),
                tooltip: '',
                weight: 0.35,
                minimumWidth: 200,
                templateId: ModelNameColumnRenderer.TEMPLATE_ID,
                project(row) { return row; }
            }
        ];
        if (this.viewModel.groupBy === "visibility" /* ChatModelGroup.Visibility */) {
            columns.push({
                label: localize('provider', 'Provider'),
                tooltip: '',
                weight: 0.15,
                minimumWidth: 100,
                templateId: ProviderColumnRenderer.TEMPLATE_ID,
                project(row) { return row; }
            });
        }
        columns.push({
            label: localize('capabilities', 'Capabilities'),
            tooltip: '',
            weight: 0.25,
            minimumWidth: 180,
            templateId: CapabilitiesColumnRenderer.TEMPLATE_ID,
            project(row) { return row; }
        }, {
            label: localize('tokenLimits', 'Context Size'),
            tooltip: '',
            weight: 0.1,
            minimumWidth: 140,
            templateId: TokenLimitsColumnRenderer.TEMPLATE_ID,
            project(row) { return row; }
        }, {
            label: localize('cost', 'Multiplier'),
            tooltip: '',
            weight: 0.05,
            minimumWidth: 60,
            templateId: MultiplierColumnRenderer.TEMPLATE_ID,
            project(row) { return row; }
        }, {
            label: '',
            tooltip: '',
            weight: 0.05,
            minimumWidth: 64,
            maximumWidth: 64,
            templateId: ActionsColumnRenderer.TEMPLATE_ID,
            project(row) { return row; }
        });
        this.table = this.tableDisposables.add(this.instantiationService.createInstance(WorkbenchTable, 'ModelsWidget', this.tableContainer, new Delegate(), columns, [
            gutterColumnRenderer,
            modelNameColumnRenderer,
            costColumnRenderer,
            tokenLimitsColumnRenderer,
            capabilitiesColumnRenderer,
            actionsColumnRenderer,
            providerColumnRenderer
        ], {
            identityProvider: { getId: (e) => e.id },
            horizontalScrolling: false,
            accessibilityProvider: {
                getAriaLabel: (e) => {
                    if (isVendorEntry(e)) {
                        return localize('vendor.ariaLabel', '{0} provider', e.vendorEntry.vendorDisplayName);
                    }
                    else if (isGroupEntry(e)) {
                        return e.label;
                    }
                    return localize('model.ariaLabel', '{0} from {1}', e.modelEntry.metadata.name, e.modelEntry.vendorDisplayName);
                },
                getWidgetAriaLabel: () => localize('modelsTable.ariaLabel', 'Language Models')
            },
            multipleSelectionSupport: false,
            setRowLineHeight: false,
            openOnSingleClick: true,
            alwaysConsumeMouseWheel: false,
        }));
        this.tableDisposables.add(this.table.onContextMenu(e => {
            if (!e.element) {
                return;
            }
            const entry = e.element;
            if (isVendorEntry(entry) && entry.vendorEntry.managementCommand) {
                const actions = [
                    toAction({
                        id: 'manageVendor',
                        label: localize('models.manageProvider', 'Manage {0}...', entry.vendorEntry.vendorDisplayName),
                        run: async () => {
                            await this.commandService.executeCommand(entry.vendorEntry.managementCommand, entry.vendorEntry.vendor);
                            await this.viewModel.refresh();
                        }
                    })
                ];
                this.contextMenuService.showContextMenu({
                    getAnchor: () => e.anchor,
                    getActions: () => actions
                });
            }
        }));
        this.table.splice(0, this.table.length, this.viewModel.viewModelEntries);
        this.tableDisposables.add(this.viewModel.onDidChange(({ at, removed, added }) => {
            this.table.splice(at, removed, added);
            if (this.viewModel.selectedEntry) {
                const selectedEntryIndex = this.viewModel.viewModelEntries.indexOf(this.viewModel.selectedEntry);
                this.table.setFocus([selectedEntryIndex]);
                this.table.setSelection([selectedEntryIndex]);
            }
            const vendors = this.viewModel.getVendors();
            const configuredVendors = new Set(this.viewModel.getConfiguredVendors().map(cv => cv.vendor));
            const vendorsWithoutModels = vendors.filter(v => !configuredVendors.has(v.vendor));
            const hasPlan = this.chatEntitlementService.entitlement !== ChatEntitlement.Unknown && this.chatEntitlementService.entitlement !== ChatEntitlement.Available;
            this.addButton.enabled = hasPlan && vendorsWithoutModels.length > 0;
            this.dropdownActions = vendorsWithoutModels.map(vendor => toAction({
                id: `enable-${vendor.vendor}`,
                label: vendor.displayName,
                run: async () => {
                    await this.enableProvider(vendor.vendor);
                }
            }));
        }));
        this.tableDisposables.add(this.table.onDidOpen(async ({ element, browserEvent }) => {
            if (!element) {
                return;
            }
            if (isVendorEntry(element) || isGroupEntry(element)) {
                this.viewModel.toggleCollapsed(element);
            }
            else if (!DOM.isMouseEvent(browserEvent) || browserEvent.detail === 2) {
                this.viewModel.toggleVisibility(element);
            }
        }));
        this.tableDisposables.add(this.table.onDidChangeSelection(e => this.viewModel.selectedEntry = e.elements[0]));
        this.tableDisposables.add(this.table.onDidBlur(() => {
            if (this.viewModel.shouldRefilter()) {
                this.viewModel.filter(this.searchWidget.getValue());
            }
        }));
        this.layout(this.element.clientHeight, this.element.clientWidth);
    }
    filterModels() {
        this.delayedFiltering.trigger(() => {
            this.viewModel.filter(this.searchWidget.getValue());
        });
    }
    async enableProvider(vendorId) {
        await this.languageModelsService.selectLanguageModels({ vendor: vendorId }, true);
        await this.viewModel.refresh();
    }
    layout(height, width) {
        width = width - 24;
        this.searchWidget.layout(new DOM.Dimension(width - this.searchActionsContainer.clientWidth - this.addButtonContainer.clientWidth - 8, 22));
        const tableHeight = height - 40;
        this.tableContainer.style.height = `${tableHeight}px`;
        this.table.layout(tableHeight, width);
    }
    focusSearch() {
        this.searchWidget.focus();
    }
    search(filter) {
        this.focusSearch();
        this.searchWidget.setValue(filter);
    }
    clearSearch() {
        this.searchWidget.setValue('');
    }
    render() {
        if (this.viewModel.shouldRefilter()) {
            this.viewModel.filter(this.searchWidget.getValue());
        }
    }
};
ChatModelsWidget = ChatModelsWidget_1 = __decorate([
    __param(0, ILanguageModelsService),
    __param(1, IInstantiationService),
    __param(2, IExtensionService),
    __param(3, IContextMenuService),
    __param(4, IChatEntitlementService),
    __param(5, IEditorProgressService),
    __param(6, ICommandService),
    __param(7, IContextKeyService)
], ChatModelsWidget);
export { ChatModelsWidget };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1vZGVsc1dpZGdldC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdE1hbmFnZW1lbnQvY2hhdE1vZGVsc1dpZGdldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyw4QkFBOEIsQ0FBQztBQUN0QyxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxNQUFNLHlDQUF5QyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEtBQUssR0FBRyxNQUFNLG9DQUFvQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxNQUFNLEVBQWtCLE1BQU0saURBQWlELENBQUM7QUFDekYsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUM3RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFFckYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQy9FLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN6RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNqRyxPQUFPLEVBQVcsUUFBUSxFQUFFLE1BQU0sRUFBRSxTQUFT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