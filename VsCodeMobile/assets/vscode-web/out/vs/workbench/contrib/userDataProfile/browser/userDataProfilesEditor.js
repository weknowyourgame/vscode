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
var UserDataProfilesEditor_1, ExistingProfileResourceTreeRenderer_1, NewProfileResourceTreeRenderer_1, ProfileResourceChildTreeItemRenderer_1, WorkspaceUriHostColumnRenderer_1, WorkspaceUriPathColumnRenderer_1, WorkspaceUriActionsColumnRenderer_1, UserDataProfilesEditorInput_1;
import './media/userDataProfilesEditor.css';
import { $, addDisposableListener, append, clearNode, Dimension, EventHelper, EventType, trackFocus } from '../../../../base/browser/dom.js';
import { Action, Separator, SubmenuAction, toAction } from '../../../../base/common/actions.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IContextMenuService, IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { defaultUserDataProfileIcon, IUserDataProfileManagementService, IUserDataProfileService, PROFILE_FILTER } from '../../../services/userDataProfile/common/userDataProfile.js';
import { Sizing, SplitView } from '../../../../base/browser/ui/splitview/splitview.js';
import { Button, ButtonBar, ButtonWithDropdown } from '../../../../base/browser/ui/button/button.js';
import { defaultButtonStyles, defaultCheckboxStyles, defaultInputBoxStyles, defaultSelectBoxStyles, getInputBoxStyle, getListStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { editorBackground, foreground, registerColor } from '../../../../platform/theme/common/colorRegistry.js';
import { PANEL_BORDER } from '../../../common/theme.js';
import { WorkbenchAsyncDataTree, WorkbenchList, WorkbenchTable } from '../../../../platform/list/browser/listService.js';
import { CachedListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { InputBox } from '../../../../base/browser/ui/inputbox/inputBox.js';
import { Checkbox } from '../../../../base/browser/ui/toggle/toggle.js';
import { DEFAULT_ICON, ICONS } from '../../../services/userDataProfile/common/userDataProfileIcons.js';
import { WorkbenchIconSelectBox } from '../../../services/userDataProfile/browser/iconSelectBox.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { IHoverService, WorkbenchHoverDelegate } from '../../../../platform/hover/browser/hover.js';
import { SelectBox, SeparatorSelectOption } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { URI } from '../../../../base/common/uri.js';
import { IEditorProgressService } from '../../../../platform/progress/common/progress.js';
import { isString, isUndefined } from '../../../../base/common/types.js';
import { basename } from '../../../../base/common/resources.js';
import { RenderIndentGuides } from '../../../../base/browser/ui/tree/abstractTree.js';
import { DEFAULT_LABELS_CONTAINER, ResourceLabels } from '../../../browser/labels.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { AbstractUserDataProfileElement, isProfileResourceChildElement, isProfileResourceTypeElement, NewProfileElement, UserDataProfileElement, UserDataProfilesEditorModel } from './userDataProfilesEditorModel.js';
import { WorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { createInstantHoverDelegate, getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Radio } from '../../../../base/browser/ui/radio/radio.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { settingsTextInputBorder } from '../../preferences/common/settingsEditorColorRegistry.js';
import { renderMarkdown } from '../../../../base/browser/markdownRenderer.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { Schemas } from '../../../../base/common/network.js';
import { posix, win32 } from '../../../../base/common/path.js';
import { hasDriveLetter } from '../../../../base/common/extpath.js';
import { normalizeDriveLetter } from '../../../../base/common/labels.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { DropdownMenuActionViewItem } from '../../../../base/browser/ui/dropdown/dropdownActionViewItem.js';
const editIcon = registerIcon('profiles-editor-edit-folder', Codicon.edit, localize('editIcon', 'Icon for the edit folder icon in the profiles editor.'));
const removeIcon = registerIcon('profiles-editor-remove-folder', Codicon.close, localize('removeIcon', 'Icon for the remove folder icon in the profiles editor.'));
export const profilesSashBorder = registerColor('profiles.sashBorder', PANEL_BORDER, localize('profilesSashBorder', "The color of the Profiles editor splitview sash border."));
const listStyles = getListStyles({
    listActiveSelectionBackground: editorBackground,
    listActiveSelectionForeground: foreground,
    listFocusAndSelectionBackground: editorBackground,
    listFocusAndSelectionForeground: foreground,
    listFocusBackground: editorBackground,
    listFocusForeground: foreground,
    listHoverForeground: foreground,
    listHoverBackground: editorBackground,
    listHoverOutline: editorBackground,
    listFocusOutline: editorBackground,
    listInactiveSelectionBackground: editorBackground,
    listInactiveSelectionForeground: foreground,
    listInactiveFocusBackground: editorBackground,
    listInactiveFocusOutline: editorBackground,
    treeIndentGuidesStroke: undefined,
    treeInactiveIndentGuidesStroke: undefined,
    tableOddRowsBackgroundColor: editorBackground,
});
let UserDataProfilesEditor = class UserDataProfilesEditor extends EditorPane {
    static { UserDataProfilesEditor_1 = this; }
    static { this.ID = 'workbench.editor.userDataProfiles'; }
    constructor(group, telemetryService, themeService, storageService, quickInputService, fileDialogService, contextMenuService, instantiationService) {
        super(UserDataProfilesEditor_1.ID, group, telemetryService, themeService, storageService);
        this.quickInputService = quickInputService;
        this.fileDialogService = fileDialogService;
        this.contextMenuService = contextMenuService;
        this.instantiationService = instantiationService;
        this.templates = [];
    }
    layout(dimension, position) {
        if (this.container && this.splitView) {
            const height = dimension.height - 20;
            this.splitView.layout(this.container?.clientWidth, height);
            this.splitView.el.style.height = `${height}px`;
        }
    }
    createEditor(parent) {
        this.container = append(parent, $('.profiles-editor'));
        const sidebarView = append(this.container, $('.sidebar-view'));
        const sidebarContainer = append(sidebarView, $('.sidebar-container'));
        const contentsView = append(this.container, $('.contents-view'));
        const contentsContainer = append(contentsView, $('.contents-container'));
        this.profileWidget = this._register(this.instantiationService.createInstance(ProfileWidget, contentsContainer));
        this.splitView = new SplitView(this.container, {
            orientation: 1 /* Orientation.HORIZONTAL */,
            proportionalLayout: true
        });
        this.renderSidebar(sidebarContainer);
        this.splitView.addView({
            onDidChange: Event.None,
            element: sidebarView,
            minimumSize: 200,
            maximumSize: 350,
            layout: (width, _, height) => {
                sidebarView.style.width = `${width}px`;
                if (height && this.profilesList) {
                    const listHeight = height - 40 /* new profile button */ - 15 /* marginTop */;
                    this.profilesList.getHTMLElement().style.height = `${listHeight}px`;
                    this.profilesList.layout(listHeight, width);
                }
            }
        }, 300, undefined, true);
        this.splitView.addView({
            onDidChange: Event.None,
            element: contentsView,
            minimumSize: 550,
            maximumSize: Number.POSITIVE_INFINITY,
            layout: (width, _, height) => {
                contentsView.style.width = `${width}px`;
                if (height) {
                    this.profileWidget?.layout(new Dimension(width, height));
                }
            }
        }, Sizing.Distribute, undefined, true);
        this.registerListeners();
        this.updateStyles();
    }
    updateStyles() {
        const borderColor = this.theme.getColor(profilesSashBorder);
        this.splitView?.style({ separatorBorder: borderColor });
    }
    renderSidebar(parent) {
        // render New Profile Button
        this.renderNewProfileButton(append(parent, $('.new-profile-button')));
        // render profiles list
        const renderer = this.instantiationService.createInstance(ProfileElementRenderer);
        const delegate = new ProfileElementDelegate();
        this.profilesList = this._register(this.instantiationService.createInstance((WorkbenchList), 'ProfilesList', append(parent, $('.profiles-list')), delegate, [renderer], {
            multipleSelectionSupport: false,
            setRowLineHeight: false,
            horizontalScrolling: false,
            accessibilityProvider: {
                getAriaLabel(profileElement) {
                    return profileElement?.name ?? '';
                },
                getWidgetAriaLabel() {
                    return localize('profiles', "Profiles");
                }
            },
            openOnSingleClick: true,
            identityProvider: {
                getId(e) {
                    if (e instanceof UserDataProfileElement) {
                        return e.profile.id;
                    }
                    return e.name;
                }
            },
            alwaysConsumeMouseWheel: false,
        }));
    }
    renderNewProfileButton(parent) {
        const button = this._register(new ButtonWithDropdown(parent, {
            actions: {
                getActions: () => {
                    const actions = [];
                    if (this.templates.length) {
                        actions.push(new SubmenuAction('from.template', localize('from template', "From Template"), this.getCreateFromTemplateActions()));
                        actions.push(new Separator());
                    }
                    actions.push(toAction({
                        id: 'importProfile',
                        label: localize('importProfile', "Import Profile..."),
                        run: () => this.importProfile()
                    }));
                    return actions;
                }
            },
            addPrimaryActionToDropdown: false,
            contextMenuProvider: this.contextMenuService,
            supportIcons: true,
            ...defaultButtonStyles
        }));
        button.label = localize('newProfile', "New Profile");
        this._register(button.onDidClick(e => this.createNewProfile()));
    }
    getCreateFromTemplateActions() {
        return this.templates.map(template => toAction({
            id: `template:${template.url}`,
            label: template.name,
            run: () => this.createNewProfile(URI.parse(template.url))
        }));
    }
    registerListeners() {
        if (this.profilesList) {
            this._register(this.profilesList.onDidChangeSelection(e => {
                const [element] = e.elements;
                if (element instanceof AbstractUserDataProfileElement) {
                    this.profileWidget?.render(element);
                }
            }));
            this._register(this.profilesList.onContextMenu(e => {
                const actions = [];
                if (!e.element) {
                    actions.push(...this.getTreeContextMenuActions());
                }
                if (e.element instanceof AbstractUserDataProfileElement) {
                    actions.push(...e.element.actions[1]);
                }
                if (actions.length) {
                    this.contextMenuService.showContextMenu({
                        getAnchor: () => e.anchor,
                        getActions: () => actions,
                        getActionsContext: () => e.element
                    });
                }
            }));
            this._register(this.profilesList.onMouseDblClick(e => {
                if (!e.element) {
                    this.createNewProfile();
                }
            }));
        }
    }
    getTreeContextMenuActions() {
        const actions = [];
        actions.push(toAction({
            id: 'newProfile',
            label: localize('newProfile', "New Profile"),
            run: () => this.createNewProfile()
        }));
        const templateActions = this.getCreateFromTemplateActions();
        if (templateActions.length) {
            actions.push(new SubmenuAction('from.template', localize('new from template', "New Profile From Template"), templateActions));
        }
        actions.push(new Separator());
        actions.push(toAction({
            id: 'importProfile',
            label: localize('importProfile', "Import Profile..."),
            run: () => this.importProfile()
        }));
        return actions;
    }
    async importProfile() {
        const disposables = new DisposableStore();
        const quickPick = disposables.add(this.quickInputService.createQuickPick());
        const updateQuickPickItems = (value) => {
            const quickPickItems = [];
            if (value) {
                quickPickItems.push({ label: quickPick.value, description: localize('import from url', "Import from URL") });
            }
            quickPickItems.push({ label: localize('import from file', "Select File...") });
            quickPick.items = quickPickItems;
        };
        quickPick.title = localize('import profile quick pick title', "Import from Profile Template...");
        quickPick.placeholder = localize('import profile placeholder', "Provide Profile Template URL");
        quickPick.ignoreFocusOut = true;
        disposables.add(quickPick.onDidChangeValue(updateQuickPickItems));
        updateQuickPickItems();
        quickPick.matchOnLabel = false;
        quickPick.matchOnDescription = false;
        disposables.add(quickPick.onDidAccept(async () => {
            quickPick.hide();
            const selectedItem = quickPick.selectedItems[0];
            if (!selectedItem) {
                return;
            }
            const url = selectedItem.label === quickPick.value ? URI.parse(quickPick.value) : await this.getProfileUriFromFileSystem();
            if (url) {
                this.createNewProfile(url);
            }
        }));
        disposables.add(quickPick.onDidHide(() => disposables.dispose()));
        quickPick.show();
    }
    async createNewProfile(copyFrom) {
        await this.model?.createNewProfile(copyFrom);
    }
    selectProfile(profile) {
        const index = this.model?.profiles.findIndex(p => p instanceof UserDataProfileElement && p.profile.id === profile.id);
        if (index !== undefined && index >= 0) {
            this.profilesList?.setSelection([index]);
        }
    }
    async getProfileUriFromFileSystem() {
        const profileLocation = await this.fileDialogService.showOpenDialog({
            canSelectFolders: false,
            canSelectFiles: true,
            canSelectMany: false,
            filters: PROFILE_FILTER,
            title: localize('import profile dialog', "Select Profile Template File"),
        });
        if (!profileLocation) {
            return null;
        }
        return profileLocation[0];
    }
    async setInput(input, options, context, token) {
        await super.setInput(input, options, context, token);
        this.model = await input.resolve();
        this.model.getTemplates().then(templates => {
            this.templates = templates;
            if (this.profileWidget) {
                this.profileWidget.templates = templates;
            }
        });
        this.updateProfilesList();
        this._register(this.model.onDidChange(element => this.updateProfilesList(element)));
    }
    focus() {
        super.focus();
        this.profilesList?.domFocus();
    }
    updateProfilesList(elementToSelect) {
        if (!this.model) {
            return;
        }
        const currentSelectionIndex = this.profilesList?.getSelection()?.[0];
        const currentSelection = currentSelectionIndex !== undefined ? this.profilesList?.element(currentSelectionIndex) : undefined;
        this.profilesList?.splice(0, this.profilesList.length, this.model.profiles);
        if (elementToSelect) {
            this.profilesList?.setSelection([this.model.profiles.indexOf(elementToSelect)]);
        }
        else if (currentSelection) {
            if (!this.model.profiles.includes(currentSelection)) {
                const elementToSelect = this.model.profiles.find(profile => profile.name === currentSelection.name) ?? this.model.profiles[0];
                if (elementToSelect) {
                    this.profilesList?.setSelection([this.model.profiles.indexOf(elementToSelect)]);
                }
            }
        }
        else {
            const elementToSelect = this.model.profiles.find(profile => profile.active) ?? this.model.profiles[0];
            if (elementToSelect) {
                this.profilesList?.setSelection([this.model.profiles.indexOf(elementToSelect)]);
            }
        }
    }
};
UserDataProfilesEditor = UserDataProfilesEditor_1 = __decorate([
    __param(1, ITelemetryService),
    __param(2, IThemeService),
    __param(3, IStorageService),
    __param(4, IQuickInputService),
    __param(5, IFileDialogService),
    __param(6, IContextMenuService),
    __param(7, IInstantiationService)
], UserDataProfilesEditor);
export { UserDataProfilesEditor };
class ProfileElementDelegate {
    getHeight(element) {
        return 22;
    }
    getTemplateId() { return 'profileListElement'; }
}
let ProfileElementRenderer = class ProfileElementRenderer {
    constructor(instantiationService) {
        this.instantiationService = instantiationService;
        this.templateId = 'profileListElement';
    }
    renderTemplate(container) {
        const disposables = new DisposableStore();
        const elementDisposables = new DisposableStore();
        container.classList.add('profile-list-item');
        const icon = append(container, $('.profile-list-item-icon'));
        const label = append(container, $('.profile-list-item-label'));
        const dirty = append(container, $(`span${ThemeIcon.asCSSSelector(Codicon.circleFilled)}`));
        const description = append(container, $('.profile-list-item-description'));
        append(description, $(`span${ThemeIcon.asCSSSelector(Codicon.check)}`), $('span', undefined, localize('activeProfile', "Active")));
        const actionsContainer = append(container, $('.profile-tree-item-actions-container'));
        const actionBar = disposables.add(this.instantiationService.createInstance(WorkbenchToolBar, actionsContainer, {
            hoverDelegate: disposables.add(createInstantHoverDelegate()),
            highlightToggledItems: true
        }));
        return { label, icon, dirty, description, actionBar, disposables, elementDisposables };
    }
    renderElement(element, index, templateData) {
        templateData.elementDisposables.clear();
        templateData.label.textContent = element.name;
        templateData.label.classList.toggle('new-profile', element instanceof NewProfileElement);
        templateData.icon.className = ThemeIcon.asClassName(element.icon ? ThemeIcon.fromId(element.icon) : DEFAULT_ICON);
        templateData.dirty.classList.toggle('hide', !(element instanceof NewProfileElement));
        templateData.description.classList.toggle('hide', !element.active);
        templateData.elementDisposables.add(element.onDidChange(e => {
            if (e.name) {
                templateData.label.textContent = element.name;
            }
            if (e.icon) {
                if (element.icon) {
                    templateData.icon.className = ThemeIcon.asClassName(ThemeIcon.fromId(element.icon));
                }
                else {
                    templateData.icon.className = 'hide';
                }
            }
            if (e.active) {
                templateData.description.classList.toggle('hide', !element.active);
            }
        }));
        const setActions = () => templateData.actionBar.setActions(element.actions[0].filter(a => a.enabled), element.actions[1].filter(a => a.enabled));
        setActions();
        const events = [];
        for (const action of element.actions.flat()) {
            if (action instanceof Action) {
                events.push(action.onDidChange);
            }
        }
        templateData.elementDisposables.add(Event.any(...events)(e => {
            if (e.enabled !== undefined) {
                setActions();
            }
        }));
    }
    disposeElement(element, index, templateData) {
        templateData.elementDisposables.clear();
    }
    disposeTemplate(templateData) {
        templateData.disposables.dispose();
        templateData.elementDisposables.dispose();
    }
};
ProfileElementRenderer = __decorate([
    __param(0, IInstantiationService)
], ProfileElementRenderer);
let ProfileWidget = class ProfileWidget extends Disposable {
    set templates(templates) {
        this.copyFromProfileRenderer.setTemplates(templates);
        this.profileTree.rerender();
    }
    constructor(parent, editorProgressService, instantiationService) {
        super();
        this.editorProgressService = editorProgressService;
        this.instantiationService = instantiationService;
        this._profileElement = this._register(new MutableDisposable());
        this.layoutParticipants = [];
        const header = append(parent, $('.profile-header'));
        const title = append(header, $('.profile-title-container'));
        this.profileTitle = append(title, $(''));
        const body = append(parent, $('.profile-body'));
        const delegate = new ProfileTreeDelegate();
        const contentsRenderer = this._register(this.instantiationService.createInstance(ContentsProfileRenderer));
        const associationsRenderer = this._register(this.instantiationService.createInstance(ProfileWorkspacesRenderer));
        this.layoutParticipants.push(associationsRenderer);
        this.copyFromProfileRenderer = this._register(this.instantiationService.createInstance(CopyFromProfileRenderer));
        this.profileTreeContainer = append(body, $('.profile-tree'));
        this.profileTree = this._register(this.instantiationService.createInstance((WorkbenchAsyncDataTree), 'ProfileEditor-Tree', this.profileTreeContainer, delegate, [
            this._register(this.instantiationService.createInstance(ProfileNameRenderer)),
            this._register(this.instantiationService.createInstance(ProfileIconRenderer)),
            this._register(this.instantiationService.createInstance(UseForCurrentWindowPropertyRenderer)),
            this._register(this.instantiationService.createInstance(UseAsDefaultProfileRenderer)),
            this.copyFromProfileRenderer,
            contentsRenderer,
            associationsRenderer,
        ], this.instantiationService.createInstance(ProfileTreeDataSource), {
            multipleSelectionSupport: false,
            horizontalScrolling: false,
            accessibilityProvider: {
                getAriaLabel(element) {
                    return element?.element ?? '';
                },
                getWidgetAriaLabel() {
                    return '';
                },
            },
            identityProvider: {
                getId(element) {
                    return element.element;
                }
            },
            expandOnlyOnTwistieClick: true,
            renderIndentGuides: RenderIndentGuides.None,
            enableStickyScroll: false,
            openOnSingleClick: false,
            setRowLineHeight: false,
            supportDynamicHeights: true,
            alwaysConsumeMouseWheel: false,
        }));
        this.profileTree.style(listStyles);
        this._register(contentsRenderer.onDidChangeContentHeight((e) => this.profileTree.updateElementHeight(e, undefined)));
        this._register(associationsRenderer.onDidChangeContentHeight((e) => this.profileTree.updateElementHeight(e, undefined)));
        this._register(contentsRenderer.onDidChangeSelection((e) => {
            if (e.selected) {
                this.profileTree.setFocus([]);
                this.profileTree.setSelection([]);
            }
        }));
        this._register(this.profileTree.onDidChangeContentHeight((e) => {
            if (this.dimension) {
                this.layout(this.dimension);
            }
        }));
        this._register(this.profileTree.onDidChangeSelection((e) => {
            if (e.elements.length) {
                contentsRenderer.clearSelection();
            }
        }));
        this.buttonContainer = append(body, $('.profile-row-container.profile-button-container'));
    }
    layout(dimension) {
        this.dimension = dimension;
        const treeContentHeight = this.profileTree.contentHeight;
        const height = Math.min(treeContentHeight, dimension.height - (this._profileElement.value?.element instanceof NewProfileElement ? 116 : 54));
        this.profileTreeContainer.style.height = `${height}px`;
        this.profileTree.layout(height, dimension.width);
        for (const participant of this.layoutParticipants) {
            participant.layout();
        }
    }
    render(profileElement) {
        if (this._profileElement.value?.element === profileElement) {
            return;
        }
        if (this._profileElement.value?.element instanceof UserDataProfileElement) {
            this._profileElement.value.element.reset();
        }
        this.profileTree.setInput(profileElement);
        const disposables = new DisposableStore();
        this._profileElement.value = { element: profileElement, dispose: () => disposables.dispose() };
        this.profileTitle.textContent = profileElement.name;
        disposables.add(profileElement.onDidChange(e => {
            if (e.name) {
                this.profileTitle.textContent = profileElement.name;
            }
        }));
        const [primaryTitleButtons, secondatyTitleButtons] = profileElement.titleButtons;
        if (primaryTitleButtons?.length || secondatyTitleButtons?.length) {
            this.buttonContainer.classList.remove('hide');
            if (secondatyTitleButtons?.length) {
                for (const action of secondatyTitleButtons) {
                    const button = disposables.add(new Button(this.buttonContainer, {
                        ...defaultButtonStyles,
                        secondary: true
                    }));
                    button.label = action.label;
                    button.enabled = action.enabled;
                    disposables.add(button.onDidClick(() => this.editorProgressService.showWhile(action.run())));
                    disposables.add(action.onDidChange((e) => {
                        if (!isUndefined(e.enabled)) {
                            button.enabled = action.enabled;
                        }
                        if (!isUndefined(e.label)) {
                            button.label = action.label;
                        }
                    }));
                }
            }
            if (primaryTitleButtons?.length) {
                for (const action of primaryTitleButtons) {
                    const button = disposables.add(new Button(this.buttonContainer, {
                        ...defaultButtonStyles
                    }));
                    button.label = action.label;
                    button.enabled = action.enabled;
                    disposables.add(button.onDidClick(() => this.editorProgressService.showWhile(action.run())));
                    disposables.add(action.onDidChange((e) => {
                        if (!isUndefined(e.enabled)) {
                            button.enabled = action.enabled;
                        }
                        if (!isUndefined(e.label)) {
                            button.label = action.label;
                        }
                    }));
                    disposables.add(profileElement.onDidChange(e => {
                        if (e.message) {
                            button.setTitle(profileElement.message ?? action.label);
                            button.element.classList.toggle('error', !!profileElement.message);
                        }
                    }));
                }
            }
        }
        else {
            this.buttonContainer.classList.add('hide');
        }
        if (profileElement instanceof NewProfileElement) {
            this.profileTree.focusFirst();
        }
        if (this.dimension) {
            this.layout(this.dimension);
        }
    }
};
ProfileWidget = __decorate([
    __param(1, IEditorProgressService),
    __param(2, IInstantiationService)
], ProfileWidget);
class ProfileTreeDelegate extends CachedListVirtualDelegate {
    getTemplateId({ element }) {
        return element;
    }
    hasDynamicHeight({ element }) {
        return element === 'contents' || element === 'workspaces';
    }
    estimateHeight({ element, root }) {
        switch (element) {
            case 'name':
                return 72;
            case 'icon':
                return 68;
            case 'copyFrom':
                return 90;
            case 'useForCurrent':
            case 'useAsDefault':
                return 68;
            case 'contents':
                return 258;
            case 'workspaces':
                return (root.workspaces ? (root.workspaces.length * 24) + 30 : 0) + 112;
        }
    }
}
class ProfileTreeDataSource {
    hasChildren(element) {
        return element instanceof AbstractUserDataProfileElement;
    }
    async getChildren(element) {
        if (element instanceof AbstractUserDataProfileElement) {
            const children = [];
            if (element instanceof NewProfileElement) {
                children.push({ element: 'name', root: element });
                children.push({ element: 'icon', root: element });
                children.push({ element: 'copyFrom', root: element });
                children.push({ element: 'contents', root: element });
            }
            else if (element instanceof UserDataProfileElement) {
                if (!element.profile.isDefault) {
                    children.push({ element: 'name', root: element });
                    children.push({ element: 'icon', root: element });
                }
                children.push({ element: 'useAsDefault', root: element });
                children.push({ element: 'contents', root: element });
                children.push({ element: 'workspaces', root: element });
            }
            return children;
        }
        return [];
    }
}
class ProfileContentTreeElementDelegate {
    getTemplateId(element) {
        if (!element.element.resourceType) {
            return ProfileResourceChildTreeItemRenderer.TEMPLATE_ID;
        }
        if (element.root instanceof NewProfileElement) {
            return NewProfileResourceTreeRenderer.TEMPLATE_ID;
        }
        return ExistingProfileResourceTreeRenderer.TEMPLATE_ID;
    }
    getHeight(element) {
        return 24;
    }
}
let ProfileResourceTreeDataSource = class ProfileResourceTreeDataSource {
    constructor(editorProgressService) {
        this.editorProgressService = editorProgressService;
    }
    hasChildren(element) {
        if (element instanceof AbstractUserDataProfileElement) {
            return true;
        }
        if (element.element.resourceType) {
            if (element.element.resourceType !== "extensions" /* ProfileResourceType.Extensions */ && element.element.resourceType !== "snippets" /* ProfileResourceType.Snippets */) {
                return false;
            }
            if (element.root instanceof NewProfileElement) {
                const resourceType = element.element.resourceType;
                if (element.root.getFlag(resourceType)) {
                    return true;
                }
                if (!element.root.hasResource(resourceType)) {
                    return false;
                }
                if (element.root.copyFrom === undefined) {
                    return false;
                }
                if (!element.root.getCopyFlag(resourceType)) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }
    async getChildren(element) {
        if (element instanceof AbstractUserDataProfileElement) {
            const children = await element.getChildren();
            return children.map(e => ({ element: e, root: element }));
        }
        if (element.element.resourceType) {
            const progressRunner = this.editorProgressService.show(true, 500);
            try {
                const extensions = await element.root.getChildren(element.element.resourceType);
                return extensions.map(e => ({ element: e, root: element.root }));
            }
            finally {
                progressRunner.done();
            }
        }
        return [];
    }
};
ProfileResourceTreeDataSource = __decorate([
    __param(0, IEditorProgressService)
], ProfileResourceTreeDataSource);
class AbstractProfileResourceTreeRenderer extends Disposable {
    getResourceTypeTitle(resourceType) {
        switch (resourceType) {
            case "settings" /* ProfileResourceType.Settings */:
                return localize('settings', "Settings");
            case "keybindings" /* ProfileResourceType.Keybindings */:
                return localize('keybindings', "Keyboard Shortcuts");
            case "snippets" /* ProfileResourceType.Snippets */:
                return localize('snippets', "Snippets");
            case "tasks" /* ProfileResourceType.Tasks */:
                return localize('tasks', "Tasks");
            case "mcp" /* ProfileResourceType.Mcp */:
                return localize('mcp', "MCP Servers");
            case "extensions" /* ProfileResourceType.Extensions */:
                return localize('extensions', "Extensions");
        }
        return '';
    }
    disposeElement(element, index, templateData) {
        templateData.elementDisposables.clear();
    }
    disposeTemplate(templateData) {
        templateData.disposables.dispose();
    }
}
class ProfilePropertyRenderer extends AbstractProfileResourceTreeRenderer {
    renderElement({ element }, index, templateData) {
        templateData.elementDisposables.clear();
        templateData.element = element;
    }
}
let ProfileNameRenderer = class ProfileNameRenderer extends ProfilePropertyRenderer {
    constructor(userDataProfilesService, contextViewService) {
        super();
        this.userDataProfilesService = userDataProfilesService;
        this.contextViewService = contextViewService;
        this.templateId = 'name';
    }
    renderTemplate(parent) {
        const disposables = new DisposableStore();
        const elementDisposables = disposables.add(new DisposableStore());
        let profileElement;
        const nameContainer = append(parent, $('.profile-row-container'));
        append(nameContainer, $('.profile-label-element', undefined, localize('name', "Name")));
        const nameInput = disposables.add(new InputBox(nameContainer, this.contextViewService, {
            inputBoxStyles: getInputBoxStyle({
                inputBorder: settingsTextInputBorder
            }),
            ariaLabel: localize('profileName', "Profile Name"),
            placeholder: localize('profileName', "Profile Name"),
            validationOptions: {
                validation: (value) => {
                    if (!value) {
                        return {
                            content: localize('name required', "Profile name is required and must be a non-empty value."),
                            type: 2 /* MessageType.WARNING */
                        };
                    }
                    if (profileElement?.root.disabled) {
                        return null;
                    }
                    if (!profileElement?.root.shouldValidateName()) {
                        return null;
                    }
                    const initialName = profileElement?.root.getInitialName();
                    value = value.trim();
                    if (initialName !== value && this.userDataProfilesService.profiles.some(p => !p.isTransient && p.name === value)) {
                        return {
                            content: localize('profileExists', "Profile with name {0} already exists.", value),
                            type: 2 /* MessageType.WARNING */
                        };
                    }
                    return null;
                }
            }
        }));
        disposables.add(nameInput.onDidChange(value => {
            if (profileElement && value) {
                profileElement.root.name = value;
            }
        }));
        const focusTracker = disposables.add(trackFocus(nameInput.inputElement));
        disposables.add(focusTracker.onDidBlur(() => {
            if (profileElement && !nameInput.value) {
                nameInput.value = profileElement.root.name;
            }
        }));
        const renderName = (profileElement) => {
            nameInput.value = profileElement.root.name;
            nameInput.validate();
            const isDefaultProfile = profileElement.root instanceof UserDataProfileElement && profileElement.root.profile.isDefault;
            if (profileElement.root.disabled || isDefaultProfile) {
                nameInput.disable();
            }
            else {
                nameInput.enable();
            }
            if (isDefaultProfile) {
                nameInput.setTooltip(localize('defaultProfileName', "Name cannot be changed for the default profile"));
            }
            else {
                nameInput.setTooltip(localize('profileName', "Profile Name"));
            }
        };
        return {
            set element(element) {
                profileElement = element;
                renderName(profileElement);
                elementDisposables.add(profileElement.root.onDidChange(e => {
                    if (e.name || e.disabled) {
                        renderName(element);
                    }
                    if (e.profile) {
                        nameInput.validate();
                    }
                }));
            },
            disposables,
            elementDisposables
        };
    }
};
ProfileNameRenderer = __decorate([
    __param(0, IUserDataProfilesService),
    __param(1, IContextViewService)
], ProfileNameRenderer);
let ProfileIconRenderer = class ProfileIconRenderer extends ProfilePropertyRenderer {
    constructor(instantiationService, hoverService) {
        super();
        this.instantiationService = instantiationService;
        this.hoverService = hoverService;
        this.templateId = 'icon';
        this.hoverDelegate = getDefaultHoverDelegate('element');
    }
    renderTemplate(parent) {
        const disposables = new DisposableStore();
        const elementDisposables = disposables.add(new DisposableStore());
        let profileElement;
        const iconContainer = append(parent, $('.profile-row-container'));
        append(iconContainer, $('.profile-label-element', undefined, localize('icon-label', "Icon")));
        const iconValueContainer = append(iconContainer, $('.profile-icon-container'));
        const iconElement = append(iconValueContainer, $(`${ThemeIcon.asCSSSelector(DEFAULT_ICON)}`, { 'tabindex': '0', 'role': 'button', 'aria-label': localize('icon', "Profile Icon") }));
        const iconHover = disposables.add(this.hoverService.setupManagedHover(this.hoverDelegate, iconElement, ''));
        const iconSelectBox = disposables.add(this.instantiationService.createInstance(WorkbenchIconSelectBox, { icons: ICONS, inputBoxStyles: defaultInputBoxStyles }));
        let hoverWidget;
        const showIconSelectBox = () => {
            if (profileElement?.root instanceof UserDataProfileElement && profileElement.root.profile.isDefault) {
                return;
            }
            if (profileElement?.root.disabled) {
                return;
            }
            if (profileElement?.root instanceof UserDataProfileElement && profileElement.root.profile.isDefault) {
                return;
            }
            iconSelectBox.clearInput();
            hoverWidget = this.hoverService.showInstantHover({
                content: iconSelectBox.domNode,
                target: iconElement,
                position: {
                    hoverPosition: 2 /* HoverPosition.BELOW */,
                },
                persistence: {
                    sticky: true,
                },
                appearance: {
                    showPointer: true,
                },
            }, true);
            if (hoverWidget) {
                iconSelectBox.layout(new Dimension(486, 292));
                iconSelectBox.focus();
            }
        };
        disposables.add(addDisposableListener(iconElement, EventType.CLICK, (e) => {
            EventHelper.stop(e, true);
            showIconSelectBox();
        }));
        disposables.add(addDisposableListener(iconElement, EventType.KEY_DOWN, e => {
            const event = new StandardKeyboardEvent(e);
            if (event.equals(3 /* KeyCode.Enter */) || event.equals(10 /* KeyCode.Space */)) {
                EventHelper.stop(event, true);
                showIconSelectBox();
            }
        }));
        disposables.add(addDisposableListener(iconSelectBox.domNode, EventType.KEY_DOWN, e => {
            const event = new StandardKeyboardEvent(e);
            if (event.equals(9 /* KeyCode.Escape */)) {
                EventHelper.stop(event, true);
                hoverWidget?.dispose();
                iconElement.focus();
            }
        }));
        disposables.add(iconSelectBox.onDidSelect(selectedIcon => {
            hoverWidget?.dispose();
            iconElement.focus();
            if (profileElement) {
                profileElement.root.icon = selectedIcon.id;
            }
        }));
        append(iconValueContainer, $('.profile-description-element', undefined, localize('icon-description', "Profile icon to be shown in the activity bar")));
        const renderIcon = (profileElement) => {
            if (profileElement?.root instanceof UserDataProfileElement && profileElement.root.profile.isDefault) {
                iconValueContainer.classList.add('disabled');
                iconHover.update(localize('defaultProfileIcon', "Icon cannot be changed for the default profile"));
            }
            else {
                iconHover.update(localize('changeIcon', "Click to change icon"));
                iconValueContainer.classList.remove('disabled');
            }
            if (profileElement.root.icon) {
                iconElement.className = ThemeIcon.asClassName(ThemeIcon.fromId(profileElement.root.icon));
            }
            else {
                iconElement.className = ThemeIcon.asClassName(ThemeIcon.fromId(DEFAULT_ICON.id));
            }
        };
        return {
            set element(element) {
                profileElement = element;
                renderIcon(profileElement);
                elementDisposables.add(profileElement.root.onDidChange(e => {
                    if (e.icon) {
                        renderIcon(element);
                    }
                }));
            },
            disposables,
            elementDisposables
        };
    }
};
ProfileIconRenderer = __decorate([
    __param(0, IInstantiationService),
    __param(1, IHoverService)
], ProfileIconRenderer);
let UseForCurrentWindowPropertyRenderer = class UseForCurrentWindowPropertyRenderer extends ProfilePropertyRenderer {
    constructor(userDataProfileService) {
        super();
        this.userDataProfileService = userDataProfileService;
        this.templateId = 'useForCurrent';
    }
    renderTemplate(parent) {
        const disposables = new DisposableStore();
        const elementDisposables = disposables.add(new DisposableStore());
        let profileElement;
        const useForCurrentWindowContainer = append(parent, $('.profile-row-container'));
        append(useForCurrentWindowContainer, $('.profile-label-element', undefined, localize('use for curren window', "Use for Current Window")));
        const useForCurrentWindowValueContainer = append(useForCurrentWindowContainer, $('.profile-use-for-current-container'));
        const useForCurrentWindowTitle = localize('enable for current window', "Use this profile for the current window");
        const useForCurrentWindowCheckbox = disposables.add(new Checkbox(useForCurrentWindowTitle, false, defaultCheckboxStyles));
        append(useForCurrentWindowValueContainer, useForCurrentWindowCheckbox.domNode);
        const useForCurrentWindowLabel = append(useForCurrentWindowValueContainer, $('.profile-description-element', undefined, useForCurrentWindowTitle));
        disposables.add(useForCurrentWindowCheckbox.onChange(() => {
            if (profileElement?.root instanceof UserDataProfileElement) {
                profileElement.root.toggleCurrentWindowProfile();
            }
        }));
        disposables.add(addDisposableListener(useForCurrentWindowLabel, EventType.CLICK, () => {
            if (profileElement?.root instanceof UserDataProfileElement) {
                profileElement.root.toggleCurrentWindowProfile();
            }
        }));
        const renderUseCurrentProfile = (profileElement) => {
            useForCurrentWindowCheckbox.checked = profileElement.root instanceof UserDataProfileElement && this.userDataProfileService.currentProfile.id === profileElement.root.profile.id;
            if (useForCurrentWindowCheckbox.checked && this.userDataProfileService.currentProfile.isDefault) {
                useForCurrentWindowCheckbox.disable();
            }
            else {
                useForCurrentWindowCheckbox.enable();
            }
        };
        const that = this;
        return {
            set element(element) {
                profileElement = element;
                renderUseCurrentProfile(profileElement);
                elementDisposables.add(that.userDataProfileService.onDidChangeCurrentProfile(e => {
                    renderUseCurrentProfile(element);
                }));
            },
            disposables,
            elementDisposables
        };
    }
};
UseForCurrentWindowPropertyRenderer = __decorate([
    __param(0, IUserDataProfileService)
], UseForCurrentWindowPropertyRenderer);
class UseAsDefaultProfileRenderer extends ProfilePropertyRenderer {
    constructor() {
        super(...arguments);
        this.templateId = 'useAsDefault';
    }
    renderTemplate(parent) {
        const disposables = new DisposableStore();
        const elementDisposables = disposables.add(new DisposableStore());
        let profileElement;
        const useAsDefaultProfileContainer = append(parent, $('.profile-row-container'));
        append(useAsDefaultProfileContainer, $('.profile-label-element', undefined, localize('use for new windows', "Use for New Windows")));
        const useAsDefaultProfileValueContainer = append(useAsDefaultProfileContainer, $('.profile-use-as-default-container'));
        const useAsDefaultProfileTitle = localize('enable for new windows', "Use this profile as the default for new windows");
        const useAsDefaultProfileCheckbox = disposables.add(new Checkbox(useAsDefaultProfileTitle, false, defaultCheckboxStyles));
        append(useAsDefaultProfileValueContainer, useAsDefaultProfileCheckbox.domNode);
        const useAsDefaultProfileLabel = append(useAsDefaultProfileValueContainer, $('.profile-description-element', undefined, useAsDefaultProfileTitle));
        disposables.add(useAsDefaultProfileCheckbox.onChange(() => {
            if (profileElement?.root instanceof UserDataProfileElement) {
                profileElement.root.toggleNewWindowProfile();
            }
        }));
        disposables.add(addDisposableListener(useAsDefaultProfileLabel, EventType.CLICK, () => {
            if (profileElement?.root instanceof UserDataProfileElement) {
                profileElement.root.toggleNewWindowProfile();
            }
        }));
        const renderUseAsDefault = (profileElement) => {
            useAsDefaultProfileCheckbox.checked = profileElement.root instanceof UserDataProfileElement && profileElement.root.isNewWindowProfile;
        };
        return {
            set element(element) {
                profileElement = element;
                renderUseAsDefault(profileElement);
                elementDisposables.add(profileElement.root.onDidChange(e => {
                    if (e.newWindowProfile) {
                        renderUseAsDefault(element);
                    }
                }));
            },
            disposables,
            elementDisposables
        };
    }
}
let CopyFromProfileRenderer = class CopyFromProfileRenderer extends ProfilePropertyRenderer {
    constructor(userDataProfilesService, instantiationService, uriIdentityService, contextViewService) {
        super();
        this.userDataProfilesService = userDataProfilesService;
        this.instantiationService = instantiationService;
        this.uriIdentityService = uriIdentityService;
        this.contextViewService = contextViewService;
        this.templateId = 'copyFrom';
        this.templates = [];
    }
    renderTemplate(parent) {
        const disposables = new DisposableStore();
        const elementDisposables = disposables.add(new DisposableStore());
        let profileElement;
        const copyFromContainer = append(parent, $('.profile-row-container.profile-copy-from-container'));
        append(copyFromContainer, $('.profile-label-element', undefined, localize('create from', "Copy from")));
        append(copyFromContainer, $('.profile-description-element', undefined, localize('copy from description', "Select the profile source from which you want to copy contents")));
        const copyFromSelectBox = disposables.add(this.instantiationService.createInstance(SelectBox, [], 0, this.contextViewService, defaultSelectBoxStyles, {
            useCustomDrawn: true,
            ariaLabel: localize('copy profile from', "Copy profile from"),
        }));
        copyFromSelectBox.render(append(copyFromContainer, $('.profile-select-container')));
        const render = (profileElement, copyFromOptions) => {
            copyFromSelectBox.setOptions(copyFromOptions);
            const id = profileElement.copyFrom instanceof URI ? profileElement.copyFrom.toString() : profileElement.copyFrom?.id;
            const index = id
                ? copyFromOptions.findIndex(option => option.id === id)
                : 0;
            copyFromSelectBox.select(index);
        };
        const that = this;
        return {
            set element(element) {
                profileElement = element;
                if (profileElement.root instanceof NewProfileElement) {
                    const newProfileElement = profileElement.root;
                    let copyFromOptions = that.getCopyFromOptions(newProfileElement);
                    render(newProfileElement, copyFromOptions);
                    copyFromSelectBox.setEnabled(!newProfileElement.previewProfile && !newProfileElement.disabled);
                    elementDisposables.add(profileElement.root.onDidChange(e => {
                        if (e.copyFrom || e.copyFromInfo) {
                            copyFromOptions = that.getCopyFromOptions(newProfileElement);
                            render(newProfileElement, copyFromOptions);
                        }
                        if (e.preview || e.disabled) {
                            copyFromSelectBox.setEnabled(!newProfileElement.previewProfile && !newProfileElement.disabled);
                        }
                    }));
                    elementDisposables.add(copyFromSelectBox.onDidSelect(option => {
                        newProfileElement.copyFrom = copyFromOptions[option.index].source;
                    }));
                }
            },
            disposables,
            elementDisposables
        };
    }
    setTemplates(templates) {
        this.templates = templates;
    }
    getCopyFromOptions(profileElement) {
        const copyFromOptions = [];
        copyFromOptions.push({ text: localize('empty profile', "None") });
        for (const [copyFromTemplate, name] of profileElement.copyFromTemplates) {
            if (!this.templates.some(template => this.uriIdentityService.extUri.isEqual(URI.parse(template.url), copyFromTemplate))) {
                copyFromOptions.push({ text: `${name} (${basename(copyFromTemplate)})`, id: copyFromTemplate.toString(), source: copyFromTemplate });
            }
        }
        if (this.templates.length) {
            copyFromOptions.push({ ...SeparatorSelectOption, decoratorRight: localize('from templates', "Profile Templates") });
            for (const template of this.templates) {
                copyFromOptions.push({ text: template.name, id: template.url, source: URI.parse(template.url) });
            }
        }
        copyFromOptions.push({ ...SeparatorSelectOption, decoratorRight: localize('from existing profiles', "Existing Profiles") });
        for (const profile of this.userDataProfilesService.profiles) {
            if (!profile.isTransient) {
                copyFromOptions.push({ text: profile.name, id: profile.id, source: profile });
            }
        }
        return copyFromOptions;
    }
};
CopyFromProfileRenderer = __decorate([
    __param(0, IUserDataProfilesService),
    __param(1, IInstantiationService),
    __param(2, IUriIdentityService),
    __param(3, IContextViewService)
], CopyFromProfileRenderer);
let ContentsProfileRenderer = class ContentsProfileRenderer extends ProfilePropertyRenderer {
    constructor(userDataProfilesService, contextMenuService, instantiationService) {
        super();
        this.userDataProfilesService = userDataProfilesService;
        this.contextMenuService = contextMenuService;
        this.instantiationService = instantiationService;
        this.templateId = 'contents';
        this._onDidChangeContentHeight = this._register(new Emitter());
        this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
        this._onDidChangeSelection = this._register(new Emitter());
        this.onDidChangeSelection = this._onDidChangeSelection.event;
    }
    renderTemplate(parent) {
        const disposables = new DisposableStore();
        const elementDisposables = disposables.add(new DisposableStore());
        let profileElement;
        const configureRowContainer = append(parent, $('.profile-row-container'));
        append(configureRowContainer, $('.profile-label-element', undefined, localize('contents', "Contents")));
        const contentsDescriptionElement = append(configureRowContainer, $('.profile-description-element'));
        const contentsTreeHeader = append(configureRowContainer, $('.profile-content-tree-header'));
        const optionsLabel = $('.options-header', undefined, $('span', undefined, localize('options', "Source")));
        append(contentsTreeHeader, $(''), $('', undefined, localize('contents', "Contents")), optionsLabel, $(''));
        const delegate = new ProfileContentTreeElementDelegate();
        const profilesContentTree = this.profilesContentTree = disposables.add(this.instantiationService.createInstance((WorkbenchAsyncDataTree), 'ProfileEditor-ContentsTree', append(configureRowContainer, $('.profile-content-tree.file-icon-themable-tree.show-file-icons')), delegate, [
            this.instantiationService.createInstance(ExistingProfileResourceTreeRenderer),
            this.instantiationService.createInstance(NewProfileResourceTreeRenderer),
            this.instantiationService.createInstance(ProfileResourceChildTreeItemRenderer),
        ], this.instantiationService.createInstance(ProfileResourceTreeDataSource), {
            multipleSelectionSupport: false,
            horizontalScrolling: false,
            accessibilityProvider: {
                getAriaLabel(element) {
                    if ((element?.element).resourceType) {
                        return (element?.element).resourceType;
                    }
                    if ((element?.element).label) {
                        return (element?.element).label;
                    }
                    return '';
                },
                getWidgetAriaLabel() {
                    return '';
                },
            },
            identityProvider: {
                getId(element) {
                    if (element?.element.handle) {
                        return element.element.handle;
                    }
                    return '';
                }
            },
            expandOnlyOnTwistieClick: true,
            renderIndentGuides: RenderIndentGuides.None,
            enableStickyScroll: false,
            openOnSingleClick: false,
            alwaysConsumeMouseWheel: false,
        }));
        this.profilesContentTree.style(listStyles);
        disposables.add(toDisposable(() => this.profilesContentTree = undefined));
        disposables.add(this.profilesContentTree.onDidChangeContentHeight(height => {
            this.profilesContentTree?.layout(height);
            if (profileElement) {
                this._onDidChangeContentHeight.fire(profileElement);
            }
        }));
        disposables.add(this.profilesContentTree.onDidChangeSelection((e => {
            if (profileElement) {
                this._onDidChangeSelection.fire({ element: profileElement, selected: !!e.elements.length });
            }
        })));
        disposables.add(this.profilesContentTree.onDidOpen(async (e) => {
            if (!e.browserEvent) {
                return;
            }
            if (e.element?.element.openAction) {
                await e.element.element.openAction.run();
            }
        }));
        disposables.add(this.profilesContentTree.onContextMenu(async (e) => {
            if (!e.element?.element.actions?.contextMenu?.length) {
                return;
            }
            this.contextMenuService.showContextMenu({
                getAnchor: () => e.anchor,
                getActions: () => e.element?.element?.actions?.contextMenu ?? [],
                getActionsContext: () => e.element
            });
        }));
        const updateDescription = (element) => {
            clearNode(contentsDescriptionElement);
            const markdown = new MarkdownString();
            if (element.root instanceof UserDataProfileElement && element.root.profile.isDefault) {
                markdown.appendMarkdown(localize('default profile contents description', "Browse contents of this profile\n"));
            }
            else {
                markdown.appendMarkdown(localize('contents source description', "Configure source of contents for this profile\n"));
                if (element.root instanceof NewProfileElement) {
                    const copyFromName = element.root.getCopyFromName();
                    const optionName = copyFromName === this.userDataProfilesService.defaultProfile.name
                        ? localize('copy from default', "{0} (Copy)", copyFromName)
                        : copyFromName;
                    if (optionName) {
                        markdown
                            .appendMarkdown(localize('copy info', "- *{0}:* Copy contents from the {1} profile\n", optionName, copyFromName));
                    }
                    markdown
                        .appendMarkdown(localize('default info', "- *Default:* Use contents from the Default profile\n"))
                        .appendMarkdown(localize('none info', "- *None:* Create empty contents\n"));
                }
            }
            append(contentsDescriptionElement, elementDisposables.add(renderMarkdown(markdown)).element);
        };
        const that = this;
        return {
            set element(element) {
                profileElement = element;
                updateDescription(element);
                if (element.root instanceof NewProfileElement) {
                    contentsTreeHeader.classList.remove('default-profile');
                }
                else if (element.root instanceof UserDataProfileElement) {
                    contentsTreeHeader.classList.toggle('default-profile', element.root.profile.isDefault);
                }
                profilesContentTree.setInput(profileElement.root);
                elementDisposables.add(profileElement.root.onDidChange(e => {
                    if (e.copyFrom || e.copyFlags || e.flags || e.extensions || e.snippets || e.preview) {
                        profilesContentTree.updateChildren(element.root);
                    }
                    if (e.copyFromInfo) {
                        updateDescription(element);
                        that._onDidChangeContentHeight.fire(element);
                    }
                }));
            },
            disposables,
            elementDisposables
        };
    }
    clearSelection() {
        if (this.profilesContentTree) {
            this.profilesContentTree.setSelection([]);
            this.profilesContentTree.setFocus([]);
        }
    }
};
ContentsProfileRenderer = __decorate([
    __param(0, IUserDataProfilesService),
    __param(1, IContextMenuService),
    __param(2, IInstantiationService)
], ContentsProfileRenderer);
let ProfileWorkspacesRenderer = class ProfileWorkspacesRenderer extends ProfilePropertyRenderer {
    constructor(labelService, uriIdentityService, fileDialogService, instantiationService) {
        super();
        this.labelService = labelService;
        this.uriIdentityService = uriIdentityService;
        this.fileDialogService = fileDialogService;
        this.instantiationService = instantiationService;
        this.templateId = 'workspaces';
        this._onDidChangeContentHeight = this._register(new Emitter());
        this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
        this._onDidChangeSelection = this._register(new Emitter());
        this.onDidChangeSelection = this._onDidChangeSelection.event;
    }
    renderTemplate(parent) {
        const disposables = new DisposableStore();
        const elementDisposables = disposables.add(new DisposableStore());
        let profileElement;
        const profileWorkspacesRowContainer = append(parent, $('.profile-row-container'));
        append(profileWorkspacesRowContainer, $('.profile-label-element', undefined, localize('folders_workspaces', "Folders & Workspaces")));
        const profileWorkspacesDescriptionElement = append(profileWorkspacesRowContainer, $('.profile-description-element'));
        const workspacesTableContainer = append(profileWorkspacesRowContainer, $('.profile-associations-table'));
        const table = this.workspacesTable = disposables.add(this.instantiationService.createInstance((WorkbenchTable), 'ProfileEditor-AssociationsTable', workspacesTableContainer, new class {
            constructor() {
                this.headerRowHeight = 30;
            }
            getHeight() { return 24; }
        }, [
            {
                label: '',
                tooltip: '',
                weight: 1,
                minimumWidth: 30,
                maximumWidth: 30,
                templateId: WorkspaceUriEmptyColumnRenderer.TEMPLATE_ID,
                project(row) { return row; },
            },
            {
                label: localize('hostColumnLabel', "Host"),
                tooltip: '',
                weight: 2,
                templateId: WorkspaceUriHostColumnRenderer.TEMPLATE_ID,
                project(row) { return row; },
            },
            {
                label: localize('pathColumnLabel', "Path"),
                tooltip: '',
                weight: 7,
                templateId: WorkspaceUriPathColumnRenderer.TEMPLATE_ID,
                project(row) { return row; }
            },
            {
                label: '',
                tooltip: '',
                weight: 1,
                minimumWidth: 84,
                maximumWidth: 84,
                templateId: WorkspaceUriActionsColumnRenderer.TEMPLATE_ID,
                project(row) { return row; }
            },
        ], [
            new WorkspaceUriEmptyColumnRenderer(),
            this.instantiationService.createInstance(WorkspaceUriHostColumnRenderer),
            this.instantiationService.createInstance(WorkspaceUriPathColumnRenderer),
            this.instantiationService.createInstance(WorkspaceUriActionsColumnRenderer),
        ], {
            horizontalScrolling: false,
            alwaysConsumeMouseWheel: false,
            openOnSingleClick: false,
            multipleSelectionSupport: false,
            accessibilityProvider: {
                getAriaLabel: (item) => {
                    const hostLabel = getHostLabel(this.labelService, item.workspace);
                    if (hostLabel === undefined || hostLabel.length === 0) {
                        return localize('trustedFolderAriaLabel', "{0}, trusted", this.labelService.getUriLabel(item.workspace));
                    }
                    return localize('trustedFolderWithHostAriaLabel', "{0} on {1}, trusted", this.labelService.getUriLabel(item.workspace), hostLabel);
                },
                getWidgetAriaLabel: () => localize('trustedFoldersAndWorkspaces', "Trusted Folders & Workspaces")
            },
            identityProvider: {
                getId(element) {
                    return element.workspace.toString();
                },
            }
        }));
        this.workspacesTable.style(listStyles);
        disposables.add(toDisposable(() => this.workspacesTable = undefined));
        disposables.add(this.workspacesTable.onDidChangeSelection((e => {
            if (profileElement) {
                this._onDidChangeSelection.fire({ element: profileElement, selected: !!e.elements.length });
            }
        })));
        const addButtonBarElement = append(profileWorkspacesRowContainer, $('.profile-workspaces-button-container'));
        const buttonBar = disposables.add(new ButtonBar(addButtonBarElement));
        const addButton = this._register(buttonBar.addButton({ title: localize('addButton', "Add Folder"), ...defaultButtonStyles }));
        addButton.label = localize('addButton', "Add Folder");
        disposables.add(addButton.onDidClick(async () => {
            const uris = await this.fileDialogService.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: true,
                openLabel: localize('addFolder', "Add Folder"),
                title: localize('addFolderTitle', "Select Folders To Add")
            });
            if (uris) {
                if (profileElement?.root instanceof UserDataProfileElement) {
                    profileElement.root.updateWorkspaces(uris, []);
                }
            }
        }));
        disposables.add(table.onDidOpen(item => {
            if (item?.element) {
                item.element.profileElement.openWorkspace(item.element.workspace);
            }
        }));
        const updateTable = () => {
            if (profileElement?.root instanceof UserDataProfileElement && profileElement.root.workspaces?.length) {
                profileWorkspacesDescriptionElement.textContent = localize('folders_workspaces_description', "Following folders and workspaces are using this profile");
                workspacesTableContainer.classList.remove('hide');
                table.splice(0, table.length, profileElement.root.workspaces
                    .map(workspace => ({ workspace, profileElement: profileElement.root }))
                    .sort((a, b) => this.uriIdentityService.extUri.compare(a.workspace, b.workspace)));
                this.layout();
            }
            else {
                profileWorkspacesDescriptionElement.textContent = localize('no_folder_description', "No folders or workspaces are using this profile");
                workspacesTableContainer.classList.add('hide');
            }
        };
        const that = this;
        return {
            set element(element) {
                profileElement = element;
                if (element.root instanceof UserDataProfileElement) {
                    updateTable();
                }
                elementDisposables.add(profileElement.root.onDidChange(e => {
                    if (profileElement && e.workspaces) {
                        updateTable();
                        that._onDidChangeContentHeight.fire(profileElement);
                    }
                }));
            },
            disposables,
            elementDisposables
        };
    }
    layout() {
        if (this.workspacesTable) {
            this.workspacesTable.layout((this.workspacesTable.length * 24) + 30, undefined);
        }
    }
    clearSelection() {
        if (this.workspacesTable) {
            this.workspacesTable.setSelection([]);
            this.workspacesTable.setFocus([]);
        }
    }
};
ProfileWorkspacesRenderer = __decorate([
    __param(0, ILabelService),
    __param(1, IUriIdentityService),
    __param(2, IFileDialogService),
    __param(3, IInstantiationService)
], ProfileWorkspacesRenderer);
let ExistingProfileResourceTreeRenderer = class ExistingProfileResourceTreeRenderer extends AbstractProfileResourceTreeRenderer {
    static { ExistingProfileResourceTreeRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'ExistingProfileResourceTemplate'; }
    constructor(instantiationService) {
        super();
        this.instantiationService = instantiationService;
        this.templateId = ExistingProfileResourceTreeRenderer_1.TEMPLATE_ID;
    }
    renderTemplate(parent) {
        const disposables = new DisposableStore();
        const container = append(parent, $('.profile-tree-item-container.existing-profile-resource-type-container'));
        const label = append(container, $('.profile-resource-type-label'));
        const radio = disposables.add(new Radio({ items: [] }));
        append(append(container, $('.profile-resource-options-container')), radio.domNode);
        const actionsContainer = append(container, $('.profile-resource-actions-container'));
        const actionBar = disposables.add(this.instantiationService.createInstance(WorkbenchToolBar, actionsContainer, {
            hoverDelegate: disposables.add(createInstantHoverDelegate()),
            highlightToggledItems: true
        }));
        return { label, radio, actionBar, disposables, elementDisposables: disposables.add(new DisposableStore()) };
    }
    renderElement({ element: profileResourceTreeElement }, index, templateData) {
        templateData.elementDisposables.clear();
        const { element, root } = profileResourceTreeElement;
        if (!(root instanceof UserDataProfileElement)) {
            throw new Error('ExistingProfileResourceTreeRenderer can only render existing profile element');
        }
        if (isString(element) || !isProfileResourceTypeElement(element)) {
            throw new Error('Invalid profile resource element');
        }
        const updateRadioItems = () => {
            templateData.radio.setItems([{
                    text: localize('default', "Default"),
                    tooltip: localize('default description', "Use {0} from the Default profile", resourceTypeTitle),
                    isActive: root.getFlag(element.resourceType)
                },
                {
                    text: root.name,
                    tooltip: localize('current description', "Use {0} from the {1} profile", resourceTypeTitle, root.name),
                    isActive: !root.getFlag(element.resourceType)
                }]);
        };
        const resourceTypeTitle = this.getResourceTypeTitle(element.resourceType);
        templateData.label.textContent = resourceTypeTitle;
        if (root instanceof UserDataProfileElement && root.profile.isDefault) {
            templateData.radio.domNode.classList.add('hide');
        }
        else {
            templateData.radio.domNode.classList.remove('hide');
            updateRadioItems();
            templateData.elementDisposables.add(root.onDidChange(e => {
                if (e.name) {
                    updateRadioItems();
                }
            }));
            templateData.elementDisposables.add(templateData.radio.onDidSelect((index) => root.setFlag(element.resourceType, index === 0)));
        }
        const actions = [];
        if (element.openAction) {
            actions.push(element.openAction);
        }
        if (element.actions?.primary) {
            actions.push(...element.actions.primary);
        }
        templateData.actionBar.setActions(actions);
    }
};
ExistingProfileResourceTreeRenderer = ExistingProfileResourceTreeRenderer_1 = __decorate([
    __param(0, IInstantiationService)
], ExistingProfileResourceTreeRenderer);
let NewProfileResourceTreeRenderer = class NewProfileResourceTreeRenderer extends AbstractProfileResourceTreeRenderer {
    static { NewProfileResourceTreeRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'NewProfileResourceTemplate'; }
    constructor(userDataProfilesService, instantiationService) {
        super();
        this.userDataProfilesService = userDataProfilesService;
        this.instantiationService = instantiationService;
        this.templateId = NewProfileResourceTreeRenderer_1.TEMPLATE_ID;
    }
    renderTemplate(parent) {
        const disposables = new DisposableStore();
        const container = append(parent, $('.profile-tree-item-container.new-profile-resource-type-container'));
        const labelContainer = append(container, $('.profile-resource-type-label-container'));
        const label = append(labelContainer, $('span.profile-resource-type-label'));
        const radio = disposables.add(new Radio({ items: [] }));
        append(append(container, $('.profile-resource-options-container')), radio.domNode);
        const actionsContainer = append(container, $('.profile-resource-actions-container'));
        const actionBar = disposables.add(this.instantiationService.createInstance(WorkbenchToolBar, actionsContainer, {
            hoverDelegate: disposables.add(createInstantHoverDelegate()),
            highlightToggledItems: true
        }));
        return { label, radio, actionBar, disposables, elementDisposables: disposables.add(new DisposableStore()) };
    }
    renderElement({ element: profileResourceTreeElement }, index, templateData) {
        templateData.elementDisposables.clear();
        const { element, root } = profileResourceTreeElement;
        if (!(root instanceof NewProfileElement)) {
            throw new Error('NewProfileResourceTreeRenderer can only render new profile element');
        }
        if (isString(element) || !isProfileResourceTypeElement(element)) {
            throw new Error('Invalid profile resource element');
        }
        const resourceTypeTitle = this.getResourceTypeTitle(element.resourceType);
        templateData.label.textContent = resourceTypeTitle;
        const renderRadioItems = () => {
            const options = [{
                    text: localize('default', "Default"),
                    tooltip: localize('default description', "Use {0} from the Default profile", resourceTypeTitle),
                },
                {
                    text: localize('none', "None"),
                    tooltip: localize('none description', "Create empty {0}", resourceTypeTitle)
                }];
            const copyFromName = root.getCopyFromName();
            const name = copyFromName === this.userDataProfilesService.defaultProfile.name
                ? localize('copy from default', "{0} (Copy)", copyFromName)
                : copyFromName;
            if (root.copyFrom && name) {
                templateData.radio.setItems([
                    {
                        text: name,
                        tooltip: name ? localize('copy from profile description', "Copy {0} from the {1} profile", resourceTypeTitle, name) : localize('copy description', "Copy"),
                    },
                    ...options
                ]);
                templateData.radio.setActiveItem(root.getCopyFlag(element.resourceType) ? 0 : root.getFlag(element.resourceType) ? 1 : 2);
            }
            else {
                templateData.radio.setItems(options);
                templateData.radio.setActiveItem(root.getFlag(element.resourceType) ? 0 : 1);
            }
        };
        if (root.copyFrom) {
            templateData.elementDisposables.add(templateData.radio.onDidSelect(index => {
                root.setFlag(element.resourceType, index === 1);
                root.setCopyFlag(element.resourceType, index === 0);
            }));
        }
        else {
            templateData.elementDisposables.add(templateData.radio.onDidSelect(index => {
                root.setFlag(element.resourceType, index === 0);
            }));
        }
        renderRadioItems();
        templateData.radio.setEnabled(!root.disabled && !root.previewProfile);
        templateData.elementDisposables.add(root.onDidChange(e => {
            if (e.disabled || e.preview) {
                templateData.radio.setEnabled(!root.disabled && !root.previewProfile);
            }
            if (e.copyFrom || e.copyFromInfo) {
                renderRadioItems();
            }
        }));
        const actions = [];
        if (element.openAction) {
            actions.push(element.openAction);
        }
        if (element.actions?.primary) {
            actions.push(...element.actions.primary);
        }
        templateData.actionBar.setActions(actions);
    }
};
NewProfileResourceTreeRenderer = NewProfileResourceTreeRenderer_1 = __decorate([
    __param(0, IUserDataProfilesService),
    __param(1, IInstantiationService)
], NewProfileResourceTreeRenderer);
let ProfileResourceChildTreeItemRenderer = class ProfileResourceChildTreeItemRenderer extends AbstractProfileResourceTreeRenderer {
    static { ProfileResourceChildTreeItemRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'ProfileResourceChildTreeItemTemplate'; }
    constructor(instantiationService) {
        super();
        this.instantiationService = instantiationService;
        this.templateId = ProfileResourceChildTreeItemRenderer_1.TEMPLATE_ID;
        this.labels = instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER);
        this.hoverDelegate = this._register(instantiationService.createInstance(WorkbenchHoverDelegate, 'mouse', undefined, {}));
    }
    renderTemplate(parent) {
        const disposables = new DisposableStore();
        const container = append(parent, $('.profile-tree-item-container.profile-resource-child-container'));
        const checkbox = disposables.add(new Checkbox('', false, defaultCheckboxStyles));
        append(container, checkbox.domNode);
        const resourceLabel = disposables.add(this.labels.create(container, { hoverDelegate: this.hoverDelegate }));
        const actionsContainer = append(container, $('.profile-resource-actions-container'));
        const actionBar = disposables.add(this.instantiationService.createInstance(WorkbenchToolBar, actionsContainer, {
            hoverDelegate: disposables.add(createInstantHoverDelegate()),
            highlightToggledItems: true
        }));
        return { checkbox, resourceLabel, actionBar, disposables, elementDisposables: disposables.add(new DisposableStore()) };
    }
    renderElement({ element: profileResourceTreeElement }, index, templateData) {
        templateData.elementDisposables.clear();
        const { element } = profileResourceTreeElement;
        if (isString(element) || !isProfileResourceChildElement(element)) {
            throw new Error('Invalid profile resource element');
        }
        if (element.checkbox) {
            templateData.checkbox.domNode.setAttribute('tabindex', '0');
            templateData.checkbox.domNode.classList.remove('hide');
            templateData.checkbox.checked = element.checkbox.isChecked;
            templateData.checkbox.domNode.ariaLabel = element.checkbox.accessibilityInformation?.label ?? '';
            if (element.checkbox.accessibilityInformation?.role) {
                templateData.checkbox.domNode.role = element.checkbox.accessibilityInformation.role;
            }
        }
        else {
            templateData.checkbox.domNode.removeAttribute('tabindex');
            templateData.checkbox.domNode.classList.add('hide');
        }
        templateData.resourceLabel.setResource({
            name: element.resource ? basename(element.resource) : element.label,
            description: element.description,
            resource: element.resource
        }, {
            forceLabel: true,
            icon: element.icon,
            hideIcon: !element.resource && !element.icon,
        });
        const actions = [];
        if (element.openAction) {
            actions.push(element.openAction);
        }
        if (element.actions?.primary) {
            actions.push(...element.actions.primary);
        }
        templateData.actionBar.setActions(actions);
    }
};
ProfileResourceChildTreeItemRenderer = ProfileResourceChildTreeItemRenderer_1 = __decorate([
    __param(0, IInstantiationService)
], ProfileResourceChildTreeItemRenderer);
class WorkspaceUriEmptyColumnRenderer {
    constructor() {
        this.templateId = WorkspaceUriEmptyColumnRenderer.TEMPLATE_ID;
    }
    static { this.TEMPLATE_ID = 'empty'; }
    renderTemplate(container) {
        return {};
    }
    renderElement(item, index, templateData) {
    }
    disposeTemplate() {
    }
}
let WorkspaceUriHostColumnRenderer = class WorkspaceUriHostColumnRenderer {
    static { WorkspaceUriHostColumnRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'host'; }
    constructor(uriIdentityService, labelService) {
        this.uriIdentityService = uriIdentityService;
        this.labelService = labelService;
        this.templateId = WorkspaceUriHostColumnRenderer_1.TEMPLATE_ID;
    }
    renderTemplate(container) {
        const disposables = new DisposableStore();
        const renderDisposables = disposables.add(new DisposableStore());
        const element = container.appendChild($('.host'));
        const hostContainer = element.appendChild($('div.host-label'));
        const buttonBarContainer = element.appendChild($('div.button-bar'));
        return {
            element,
            hostContainer,
            buttonBarContainer,
            disposables,
            renderDisposables
        };
    }
    renderElement(item, index, templateData) {
        templateData.renderDisposables.clear();
        templateData.renderDisposables.add({ dispose: () => { clearNode(templateData.buttonBarContainer); } });
        templateData.hostContainer.innerText = getHostLabel(this.labelService, item.workspace);
        templateData.element.classList.toggle('current-workspace', this.uriIdentityService.extUri.isEqual(item.workspace, item.profileElement.getCurrentWorkspace()));
        templateData.hostContainer.style.display = '';
        templateData.buttonBarContainer.style.display = 'none';
    }
    disposeTemplate(templateData) {
        templateData.disposables.dispose();
    }
};
WorkspaceUriHostColumnRenderer = WorkspaceUriHostColumnRenderer_1 = __decorate([
    __param(0, IUriIdentityService),
    __param(1, ILabelService)
], WorkspaceUriHostColumnRenderer);
let WorkspaceUriPathColumnRenderer = class WorkspaceUriPathColumnRenderer {
    static { WorkspaceUriPathColumnRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'path'; }
    constructor(uriIdentityService, hoverService) {
        this.uriIdentityService = uriIdentityService;
        this.hoverService = hoverService;
        this.templateId = WorkspaceUriPathColumnRenderer_1.TEMPLATE_ID;
        this.hoverDelegate = getDefaultHoverDelegate('mouse');
    }
    renderTemplate(container) {
        const disposables = new DisposableStore();
        const element = container.appendChild($('.path'));
        const pathLabel = element.appendChild($('div.path-label'));
        const pathHover = disposables.add(this.hoverService.setupManagedHover(this.hoverDelegate, pathLabel, ''));
        const renderDisposables = disposables.add(new DisposableStore());
        return {
            element,
            pathLabel,
            pathHover,
            disposables,
            renderDisposables
        };
    }
    renderElement(item, index, templateData) {
        templateData.renderDisposables.clear();
        const stringValue = this.formatPath(item.workspace);
        templateData.pathLabel.innerText = stringValue;
        templateData.element.classList.toggle('current-workspace', this.uriIdentityService.extUri.isEqual(item.workspace, item.profileElement.getCurrentWorkspace()));
        templateData.pathHover.update(stringValue);
    }
    disposeTemplate(templateData) {
        templateData.disposables.dispose();
        templateData.renderDisposables.dispose();
    }
    formatPath(uri) {
        if (uri.scheme === Schemas.file) {
            return normalizeDriveLetter(uri.fsPath);
        }
        // If the path is not a file uri, but points to a windows remote, we should create windows fs path
        // e.g. /c:/user/directory => C:\user\directory
        if (uri.path.startsWith(posix.sep)) {
            const pathWithoutLeadingSeparator = uri.path.substring(1);
            const isWindowsPath = hasDriveLetter(pathWithoutLeadingSeparator, true);
            if (isWindowsPath) {
                return normalizeDriveLetter(win32.normalize(pathWithoutLeadingSeparator), true);
            }
        }
        return uri.path;
    }
};
WorkspaceUriPathColumnRenderer = WorkspaceUriPathColumnRenderer_1 = __decorate([
    __param(0, IUriIdentityService),
    __param(1, IHoverService)
], WorkspaceUriPathColumnRenderer);
let ChangeProfileAction = class ChangeProfileAction {
    constructor(item, userDataProfilesService) {
        this.item = item;
        this.userDataProfilesService = userDataProfilesService;
        this.id = 'changeProfile';
        this.label = 'Change Profile';
        this.class = ThemeIcon.asClassName(editIcon);
        this.enabled = true;
        this.tooltip = localize('change profile', "Change Profile");
        this.checked = false;
    }
    run() { }
    getSwitchProfileActions() {
        return this.userDataProfilesService.profiles
            .filter(profile => !profile.isTransient)
            .sort((a, b) => a.isDefault ? -1 : b.isDefault ? 1 : a.name.localeCompare(b.name))
            .map(profile => ({
            id: `switchProfileTo${profile.id}`,
            label: profile.name,
            class: undefined,
            enabled: true,
            checked: profile.id === this.item.profileElement.profile.id,
            tooltip: '',
            run: () => {
                if (profile.id === this.item.profileElement.profile.id) {
                    return;
                }
                this.userDataProfilesService.updateProfile(profile, { workspaces: [...(profile.workspaces ?? []), this.item.workspace] });
            }
        }));
    }
};
ChangeProfileAction = __decorate([
    __param(1, IUserDataProfilesService)
], ChangeProfileAction);
let WorkspaceUriActionsColumnRenderer = class WorkspaceUriActionsColumnRenderer {
    static { WorkspaceUriActionsColumnRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'actions'; }
    constructor(userDataProfilesService, userDataProfileManagementService, contextMenuService, uriIdentityService) {
        this.userDataProfilesService = userDataProfilesService;
        this.userDataProfileManagementService = userDataProfileManagementService;
        this.contextMenuService = contextMenuService;
        this.uriIdentityService = uriIdentityService;
        this.templateId = WorkspaceUriActionsColumnRenderer_1.TEMPLATE_ID;
    }
    renderTemplate(container) {
        const disposables = new DisposableStore();
        const element = container.appendChild($('.profile-workspaces-actions-container'));
        const hoverDelegate = disposables.add(createInstantHoverDelegate());
        const actionBar = disposables.add(new ActionBar(element, {
            hoverDelegate,
            actionViewItemProvider: (action) => {
                if (action instanceof ChangeProfileAction) {
                    return new DropdownMenuActionViewItem(action, { getActions: () => action.getSwitchProfileActions() }, this.contextMenuService, {
                        classNames: action.class,
                        hoverDelegate,
                    });
                }
                return undefined;
            }
        }));
        return { actionBar, disposables };
    }
    renderElement(item, index, templateData) {
        templateData.actionBar.clear();
        const actions = [];
        actions.push(this.createOpenAction(item));
        actions.push(new ChangeProfileAction(item, this.userDataProfilesService));
        actions.push(this.createDeleteAction(item));
        templateData.actionBar.push(actions, { icon: true });
    }
    createOpenAction(item) {
        return {
            label: '',
            class: ThemeIcon.asClassName(Codicon.window),
            enabled: !this.uriIdentityService.extUri.isEqual(item.workspace, item.profileElement.getCurrentWorkspace()),
            id: 'openWorkspace',
            tooltip: localize('open', "Open in New Window"),
            run: () => item.profileElement.openWorkspace(item.workspace)
        };
    }
    createDeleteAction(item) {
        return {
            label: '',
            class: ThemeIcon.asClassName(removeIcon),
            enabled: this.userDataProfileManagementService.getDefaultProfileToUse().id !== item.profileElement.profile.id,
            id: 'deleteTrustedUri',
            tooltip: localize('deleteTrustedUri', "Delete Path"),
            run: () => item.profileElement.updateWorkspaces([], [item.workspace])
        };
    }
    disposeTemplate(templateData) {
        templateData.disposables.dispose();
    }
};
WorkspaceUriActionsColumnRenderer = WorkspaceUriActionsColumnRenderer_1 = __decorate([
    __param(0, IUserDataProfilesService),
    __param(1, IUserDataProfileManagementService),
    __param(2, IContextMenuService),
    __param(3, IUriIdentityService)
], WorkspaceUriActionsColumnRenderer);
function getHostLabel(labelService, workspaceUri) {
    return workspaceUri.authority ? labelService.getHostLabel(workspaceUri.scheme, workspaceUri.authority) : localize('localAuthority', "Local");
}
let UserDataProfilesEditorInput = class UserDataProfilesEditorInput extends EditorInput {
    static { UserDataProfilesEditorInput_1 = this; }
    static { this.ID = 'workbench.input.userDataProfiles'; }
    get dirty() { return this._dirty; }
    set dirty(dirty) {
        if (this._dirty !== dirty) {
            this._dirty = dirty;
            this._onDidChangeDirty.fire();
        }
    }
    constructor(instantiationService) {
        super();
        this.instantiationService = instantiationService;
        this.resource = undefined;
        this._dirty = false;
        this.model = UserDataProfilesEditorModel.getInstance(this.instantiationService);
        this._register(this.model.onDidChange(e => this.dirty = this.model.profiles.some(profile => profile instanceof NewProfileElement)));
    }
    get typeId() { return UserDataProfilesEditorInput_1.ID; }
    getName() { return localize('userDataProfiles', "Profiles"); }
    getIcon() { return defaultUserDataProfileIcon; }
    async resolve() {
        await this.model.resolve();
        return this.model;
    }
    isDirty() {
        return this.dirty;
    }
    async save() {
        await this.model.saveNewProfile();
        return this;
    }
    async revert() {
        this.model.revert();
    }
    matches(otherInput) { return otherInput instanceof UserDataProfilesEditorInput_1; }
    dispose() {
        for (const profile of this.model.profiles) {
            if (profile instanceof UserDataProfileElement) {
                profile.reset();
            }
        }
        super.dispose();
    }
};
UserDataProfilesEditorInput = UserDataProfilesEditorInput_1 = __decorate([
    __param(0, IInstantiationService)
], UserDataProfilesEditorInput);
export { UserDataProfilesEditorInput };
export class UserDataProfilesEditorInputSerializer {
    canSerialize(editorInput) { return true; }
    serialize(editorInput) { return ''; }
    deserialize(instantiationService) { return instantiationService.createInstance(UserDataProfilesEditorInput); }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlckRhdGFQcm9maWxlc0VkaXRvci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi91c2VyRGF0YVByb2ZpbGUvYnJvd3Nlci91c2VyRGF0YVByb2ZpbGVzRWRpdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLG9DQUFvQyxDQUFDO0FBQzVDLE9BQU8sRUFBRSxDQUFDLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBZ0IsVUFBVSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDM0osT0FBTyxFQUFFLE1BQU0sRUFBK0IsU0FBUyxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3SCxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLG1CQUFtQixFQUFFLG1CQUFtQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDbkgsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNsRixPQUFPLEVBQW9CLHdCQUF3QixFQUF1QixNQUFNLGdFQUFnRSxDQUFDO0FBQ2pKLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw2Q0FBNkMsQ0FB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