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
var ErrorRenderer_1, TestItemRenderer_1;
import * as dom from '../../../../base/browser/dom.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { renderLabelWithIcons } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { DefaultKeyboardNavigationDelegate } from '../../../../base/browser/ui/list/listWidget.js';
import { Action, ActionRunner, Separator, toAction } from '../../../../base/common/actions.js';
import { mapFindFirst } from '../../../../base/common/arraysFind.js';
import { RunOnceScheduler, disposableTimeout } from '../../../../base/common/async.js';
import { groupBy } from '../../../../base/common/collections.js';
import { Color, RGBA } from '../../../../base/common/color.js';
import { compareFileNames } from '../../../../base/common/comparers.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, observableFromEvent } from '../../../../base/common/observable.js';
import { fuzzyContains } from '../../../../base/common/strings.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { isDefined } from '../../../../base/common/types.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { localize } from '../../../../nls.js';
import { DropdownWithPrimaryActionViewItem } from '../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js';
import { MenuEntryActionViewItem, createActionViewItem, getActionBarActions, getFlatContextMenuActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IMenuService, MenuId, MenuItemAction } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { UnmanagedProgress } from '../../../../platform/progress/common/progress.js';
import { IStorageService, WillSaveStateReason } from '../../../../platform/storage/common/storage.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { foreground } from '../../../../platform/theme/common/colorRegistry.js';
import { spinningLoading } from '../../../../platform/theme/common/iconRegistry.js';
import { IThemeService, registerThemingParticipant } from '../../../../platform/theme/common/themeService.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { registerNavigableContainer } from '../../../browser/actions/widgetNavigationCommands.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { DiffEditorInput } from '../../../common/editor/diffEditorInput.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IActivityService, IconBadge, NumberBadge } from '../../../services/activity/common/activity.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { getTestingConfiguration } from '../common/configuration.js';
import { labelForTestInState } from '../common/constants.js';
import { StoredValue } from '../common/storedValue.js';
import { ITestExplorerFilterState } from '../common/testExplorerFilterState.js';
import { TestId } from '../common/testId.js';
import { ITestProfileService, canUseProfileWithTest } from '../common/testProfileService.js';
import { LiveTestResult } from '../common/testResult.js';
import { ITestResultService } from '../common/testResultService.js';
import { ITestService, testCollectionIsEmpty } from '../common/testService.js';
import { testProfileBitset, testResultStateToContextValues } from '../common/testTypes.js';
import { TestingContextKeys } from '../common/testingContextKeys.js';
import { ITestingContinuousRunService } from '../common/testingContinuousRunService.js';
import { ITestingPeekOpener } from '../common/testingPeekOpener.js';
import { collectTestStateCounts, getTestProgressText } from '../common/testingProgressMessages.js';
import { cmpPriority, isFailedState, isStateWithResult, statesInOrder } from '../common/testingStates.js';
import { TestItemTreeElement, TestTreeErrorMessage } from './explorerProjections/index.js';
import { ListProjection } from './explorerProjections/listProjection.js';
import { getTestItemContextOverlay } from './explorerProjections/testItemContextOverlay.js';
import { TestingObjectTree } from './explorerProjections/testingObjectTree.js';
import { TreeProjection } from './explorerProjections/treeProjection.js';
import * as icons from './icons.js';
import './media/testing.css';
import { DebugLastRun, ReRunLastRun } from './testExplorerActions.js';
import { TestingExplorerFilter } from './testingExplorerFilter.js';
var LastFocusState;
(function (LastFocusState) {
    LastFocusState[LastFocusState["Input"] = 0] = "Input";
    LastFocusState[LastFocusState["Tree"] = 1] = "Tree";
})(LastFocusState || (LastFocusState = {}));
let TestingExplorerView = class TestingExplorerView extends ViewPane {
    get focusedTreeElements() {
        return this.viewModel.tree.getFocus().filter(isDefined);
    }
    constructor(options, contextMenuService, keybindingService, configurationService, instantiationService, viewDescriptorService, contextKeyService, openerService, themeService, testService, hoverService, testProfileService, commandService, menuService, crService) {
        super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this.testService = testService;
        this.testProfileService = testProfileService;
        this.commandService = commandService;
        this.menuService = menuService;
        this.crService = crService;
        this.filterActionBar = this._register(new MutableDisposable());
        this.discoveryProgress = this._register(new MutableDisposable());
        this.filter = this._register(new MutableDisposable());
        this.filterFocusListener = this._register(new MutableDisposable());
        this.dimensions = { width: 0, height: 0 };
        this.lastFocusState = 0 /* LastFocusState.Input */;
        const relayout = this._register(new RunOnceScheduler(() => this.layoutBody(), 1));
        this._register(this.onDidChangeViewWelcomeState(() => {
            if (!this.shouldShowWelcome()) {
                relayout.schedule();
            }
        }));
        this._register(Event.any(crService.onDidChange, testProfileService.onDidChange)(() => {
            this.updateActions();
        }));
        this._register(testService.collection.onBusyProvidersChange(busy => {
            this.updateDiscoveryProgress(busy);
        }));
        this._register(testProfileService.onDidChange(() => this.updateActions()));
    }
    shouldShowWelcome() {
        return this.viewModel?.welcomeExperience === 1 /* WelcomeExperience.ForWorkspace */;
    }
    focus() {
        super.focus();
        if (this.lastFocusState === 1 /* LastFocusState.Tree */) {
            this.viewModel.tree.domFocus();
        }
        else {
            this.filter.value?.focus();
        }
    }
    /**
     * Gets include/exclude items in the tree, based either on visible tests
     * or a use selection. If a profile is given, only tests in that profile
     * are collected. If a bitset is given, any test that can run in that
     * bitset is collected.
     */
    getTreeIncludeExclude(profileOrBitset, withinItems, filterToType = 'visible') {
        const projection = this.viewModel.projection.value;
        if (!projection) {
            return { include: [], exclude: [] };
        }
        // To calculate includes and excludes, we include the first children that
        // have a majority of their items included too, and then apply exclusions.
        const include = new Set();
        const exclude = [];
        const runnableWithProfileOrBitset = new Map();
        const isRunnableWithProfileOrBitset = (item) => {
            let value = runnableWithProfileOrBitset.get(item);
            if (value === undefined) {
                value = typeof profileOrBitset === 'number'
                    ? !!this.testProfileService.getDefaultProfileForTest(profileOrBitset, item)
                    : canUseProfileWithTest(profileOrBitset, item);
                runnableWithProfileOrBitset.set(item, value);
            }
            return value;
        };
        const attempt = (element, alreadyIncluded) => {
            // sanity check hasElement since updates are debounced and they may exist
            // but not be rendered yet
            if (!(element instanceof TestItemTreeElement) || !this.viewModel.tree.hasElement(element)) {
                return;
            }
            // If the current node is not visible or runnable in the current profile, it's excluded
            const inTree = this.viewModel.tree.getNode(element);
            if (!inTree.visible) {
                if (alreadyIncluded) {
                    exclude.push(element.test);
                }
                return;
            }
            // Only count relevant children when deciding whether to include this node, #229120
            const visibleRunnableChildren = inTree.children.filter(c => c.visible
                && c.element instanceof TestItemTreeElement
                && isRunnableWithProfileOrBitset(c.element.test)).length;
            // If it's not already included but most of its children are, then add it
            // if it can be run under the current profile (when specified)
            if (
            // If it's not already included...
            !alreadyIncluded
                // And it can be run using the current profile (if any)
                && isRunnableWithProfileOrBitset(element.test)
                // And either it's a leaf node or most children are included, then include it.
                && (visibleRunnableChildren === 0 || visibleRunnableChildren * 2 >= inTree.children.length)
                // And not if we're only showing a single of its children, since it
                // probably fans out later. (Worse case we'll directly include its single child)
                && visibleRunnableChildren !== 1) {
                include.add(element.test);
                alreadyIncluded = true;
            }
            // Recurse ✨
            for (const child of element.children) {
                attempt(child, alreadyIncluded);
            }
        };
        if (filterToType === 'selected') {
            const sel = this.viewModel.tree.getSelection().filter(isDefined);
            if (sel.length) {
                L: for (const node of sel) {
                    if (node instanceof TestItemTreeElement) {
                        // avoid adding an item if its parent is already included
                        for (let i = node; i; i = i.parent) {
                            if (include.has(i.test)) {
                                continue L;
                            }
                        }
                        include.add(node.test);
                        node.children.forEach(c => attempt(c, true));
                    }
                }
                return { include: [...include], exclude };
            }
        }
        for (const root of withinItems || this.testService.collection.rootItems) {
            const element = projection.getElementByTestId(root.item.extId);
            if (!element) {
                continue;
            }
            if (typeof profileOrBitset === 'object' && !canUseProfileWithTest(profileOrBitset, root)) {
                continue;
            }
            include.add(element.test);
            element.children.forEach(c => attempt(c, true));
        }
        return { include: [...include], exclude };
    }
    render() {
        super.render();
        this._register(registerNavigableContainer({
            name: 'testingExplorerView',
            focusNotifiers: [this],
            focusNextWidget: () => {
                if (!this.viewModel.tree.isDOMFocused()) {
                    this.viewModel.tree.domFocus();
                }
            },
            focusPreviousWidget: () => {
                if (this.viewModel.tree.isDOMFocused()) {
                    this.filter.value?.focus();
                }
            }
        }));
    }
    /**
     * @override
     */
    renderBody(container) {
        super.renderBody(container);
        this.container = dom.append(container, dom.$('.test-explorer'));
        this.treeHeader = dom.append(this.container, dom.$('.test-explorer-header'));
        this.filterActionBar.value = this.createFilterActionBar();
        const messagesContainer = dom.append(this.treeHeader, dom.$('.result-summary-container'));
        this._register(this.instantiationService.createInstance(ResultSummaryView, messagesContainer));
        const listContainer = dom.append(this.container, dom.$('.test-explorer-tree'));
        this.viewModel = this.instantiationService.createInstance(TestingExplorerViewModel, listContainer, this.onDidChangeBodyVisibility);
        this._register(this.viewModel.tree.onDidFocus(() => this.lastFocusState = 1 /* LastFocusState.Tree */));
        this._register(this.viewModel.onChangeWelcomeVisibility(() => this._onDidChangeViewWelcomeState.fire()));
        this._register(this.viewModel);
        this._onDidChangeViewWelcomeState.fire();
    }
    /** @override  */
    createActionViewItem(action, options) {
        switch (action.id) {
            case "workbench.actions.treeView.testExplorer.filter" /* TestCommandId.FilterAction */:
                this.filter.value = this.instantiationService.createInstance(TestingExplorerFilter, action, options);
                this.filterFocusListener.value = this.filter.value.onDidFocus(() => this.lastFocusState = 0 /* LastFocusState.Input */);
                return this.filter.value;
            case "testing.runSelected" /* TestCommandId.RunSelectedAction */:
                return this.getRunGroupDropdown(2 /* TestRunProfileBitset.Run */, action, options);
            case "testing.debugSelected" /* TestCommandId.DebugSelectedAction */:
                return this.getRunGroupDropdown(4 /* TestRunProfileBitset.Debug */, action, options);
            case "testing.startContinuousRun" /* TestCommandId.StartContinousRun */:
            case "testing.stopContinuousRun" /* TestCommandId.StopContinousRun */:
                return this.getContinuousRunDropdown(action, options);
            default:
                return super.createActionViewItem(action, options);
        }
    }
    /** @inheritdoc */
    getTestConfigGroupActions(group) {
        const profileActions = [];
        let participatingGroups = 0;
        let participatingProfiles = 0;
        let hasConfigurable = false;
        const defaults = this.testProfileService.getGroupDefaultProfiles(group);
        for (const { profiles, controller } of this.testProfileService.all()) {
            let hasAdded = false;
            for (const profile of profiles) {
                if (profile.group !== group) {
                    continue;
                }
                if (!hasAdded) {
                    hasAdded = true;
                    participatingGroups++;
                    profileActions.push(toAction({ id: `${controller.id}.$root`, label: controller.label.get(), enabled: false, checked: false, run: () => { } }));
                }
                hasConfigurable = hasConfigurable || profile.hasConfigurationHandler;
                participatingProfiles++;
                profileActions.push(toAction({
                    id: `${controller.id}.${profile.profileId}`,
                    label: defaults.includes(profile) ? localize('defaultTestProfile', '{0} (Default)', profile.label) : profile.label,
                    run: () => {
                        const { include, exclude } = this.getTreeIncludeExclude(profile);
                        this.testService.runResolvedTests({
                            exclude: exclude.map(e => e.item.extId),
                            group: profile.group,
                            targets: [{
                                    profileId: profile.profileId,
                                    controllerId: profile.controllerId,
                                    testIds: include.map(i => i.item.extId),
                                }]
                        });
                    },
                }));
            }
        }
        const contextKeys = [];
        // allow extension author to define context for when to show the test menu actions for run or debug menus
        if (group === 2 /* TestRunProfileBitset.Run */) {
            contextKeys.push(['testing.profile.context.group', 'run']);
        }
        if (group === 4 /* TestRunProfileBitset.Debug */) {
            contextKeys.push(['testing.profile.context.group', 'debug']);
        }
        if (group === 8 /* TestRunProfileBitset.Coverage */) {
            contextKeys.push(['testing.profile.context.group', 'coverage']);
        }
        const key = this.contextKeyService.createOverlay(contextKeys);
        const menu = this.menuService.getMenuActions(MenuId.TestProfilesContext, key);
        // fill if there are any actions
        const menuActions = getFlatContextMenuActions(menu);
        const postActions = [];
        if (participatingProfiles > 1) {
            postActions.push(toAction({
                id: 'selectDefaultTestConfigurations',
                label: localize('selectDefaultConfigs', 'Select Default Profile'),
                run: () => this.commandService.executeCommand("testing.selectDefaultTestProfiles" /* TestCommandId.SelectDefaultTestProfiles */, group),
            }));
        }
        if (hasConfigurable) {
            postActions.push(toAction({
                id: 'configureTestProfiles',
                label: localize('configureTestProfiles', 'Configure Test Profiles'),
                run: () => this.commandService.executeCommand("testing.configureProfile" /* TestCommandId.ConfigureTestProfilesAction */, group),
            }));
        }
        // show menu actions if there are any otherwise don't
        return {
            numberOfProfiles: participatingProfiles,
            actions: menuActions.length > 0
                ? Separator.join(profileActions, menuActions, postActions)
                : Separator.join(profileActions, postActions),
        };
    }
    /**
     * @override
     */
    saveState() {
        this.filter.value?.saveState();
        super.saveState();
    }
    getRunGroupDropdown(group, defaultAction, options) {
        const dropdownActions = this.getTestConfigGroupActions(group);
        if (dropdownActions.numberOfProfiles < 2) {
            return super.createActionViewItem(defaultAction, options);
        }
        const primaryAction = this.instantiationService.createInstance(MenuItemAction, {
            id: defaultAction.id,
            title: defaultAction.label,
            icon: group === 2 /* TestRunProfileBitset.Run */
                ? icons.testingRunAllIcon
                : icons.testingDebugAllIcon,
        }, undefined, undefined, undefined, undefined);
        return this.instantiationService.createInstance(DropdownWithPrimaryActionViewItem, primaryAction, this.getDropdownAction(), dropdownActions.actions, '', options);
    }
    getDropdownAction() {
        return new Action('selectRunConfig', localize('testingSelectConfig', 'Select Configuration...'), 'codicon-chevron-down', true);
    }
    getContinuousRunDropdown(defaultAction, options) {
        const allProfiles = [...Iterable.flatMap(this.testProfileService.all(), (cr) => {
                if (this.testService.collection.getNodeById(cr.controller.id)?.children.size) {
                    return Iterable.filter(cr.profiles, p => p.supportsContinuousRun);
                }
                return Iterable.empty();
            })];
        if (allProfiles.length <= 1) {
            return super.createActionViewItem(defaultAction, options);
        }
        const primaryAction = this.instantiationService.createInstance(MenuItemAction, {
            id: defaultAction.id,
            title: defaultAction.label,
            icon: defaultAction.id === "testing.startContinuousRun" /* TestCommandId.StartContinousRun */ ? icons.testingTurnContinuousRunOn : icons.testingTurnContinuousRunOff,
        }, undefined, undefined, undefined, undefined);
        const dropdownActions = [];
        const groups = groupBy(allProfiles, p => p.group);
        const crService = this.crService;
        for (const group of [2 /* TestRunProfileBitset.Run */, 4 /* TestRunProfileBitset.Debug */, 8 /* TestRunProfileBitset.Coverage */]) {
            const profiles = groups[group];
            if (!profiles) {
                continue;
            }
            if (Object.keys(groups).length > 1) {
                dropdownActions.push({
                    id: `${group}.label`,
                    label: testProfileBitset[group],
                    enabled: false,
                    class: undefined,
                    tooltip: testProfileBitset[group],
                    run: () => { },
                });
            }
            for (const profile of profiles) {
                dropdownActions.push({
                    id: `${group}.${profile.profileId}`,
                    label: profile.label,
                    enabled: true,
                    class: undefined,
                    tooltip: profile.label,
                    checked: crService.isEnabledForProfile(profile),
                    run: () => crService.isEnabledForProfile(profile)
                        ? crService.stopProfile(profile)
                        : crService.start([profile]),
                });
            }
        }
        return this.instantiationService.createInstance(DropdownWithPrimaryActionViewItem, primaryAction, this.getDropdownAction(), dropdownActions, '', options);
    }
    createFilterActionBar() {
        const bar = new ActionBar(this.treeHeader, {
            actionViewItemProvider: (action, options) => this.createActionViewItem(action, options),
            triggerKeys: { keyDown: false, keys: [] },
        });
        bar.push(new Action("workbench.actions.treeView.testExplorer.filter" /* TestCommandId.FilterAction */));
        bar.getContainer().classList.add('testing-filter-action-bar');
        return bar;
    }
    updateDiscoveryProgress(busy) {
        if (!busy && this.discoveryProgress) {
            this.discoveryProgress.clear();
        }
        else if (busy && !this.discoveryProgress.value) {
            this.discoveryProgress.value = this.instantiationService.createInstance(UnmanagedProgress, { location: this.getProgressLocation() });
        }
    }
    /**
     * @override
     */
    layoutBody(height = this.dimensions.height, width = this.dimensions.width) {
        super.layoutBody(height, width);
        this.dimensions.height = height;
        this.dimensions.width = width;
        this.container.style.height = `${height}px`;
        this.viewModel?.layout(height - this.treeHeader.clientHeight, width);
        this.filter.value?.layout(width);
    }
};
TestingExplorerView = __decorate([
    __param(1, IContextMenuService),
    __param(2, IKeybindingService),
    __param(3, IConfigurationService),
    __param(4, IInstantiationService),
    __param(5, IViewDescriptorService),
    __param(6, IContextKeyService),
    __param(7, IOpenerService),
    __param(8, IThemeService),
    __param(9, ITestService),
    __param(10, IHoverService),
    __param(11, ITestProfileService),
    __param(12, ICommandService),
    __param(13, IMenuService),
    __param(14, ITestingContinuousRunService)
], TestingExplorerView);
export { TestingExplorerView };
const SUMMARY_RENDER_INTERVAL = 200;
let ResultSummaryView = class ResultSummaryView extends Disposable {
    constructor(container, resultService, activityService, crService, configurationService, instantiationService, hoverService) {
        super();
        this.container = container;
        this.resultService = resultService;
        this.activityService = activityService;
        this.crService = crService;
        this.elementsWereAttached = false;
        this.badgeDisposable = this._register(new MutableDisposable());
        this.renderLoop = this._register(new RunOnceScheduler(() => this.render(), SUMMARY_RENDER_INTERVAL));
        this.elements = dom.h('div.result-summary', [
            dom.h('div@status'),
            dom.h('div@count'),
            dom.h('div@count'),
            dom.h('span'),
            dom.h('duration@duration'),
            dom.h('a@rerun'),
        ]);
        this.badgeType = configurationService.getValue("testing.countBadge" /* TestingConfigKeys.CountBadge */);
        this._register(resultService.onResultsChanged(this.render, this));
        this._register(configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("testing.countBadge" /* TestingConfigKeys.CountBadge */)) {
                this.badgeType = configurationService.getValue("testing.countBadge" /* TestingConfigKeys.CountBadge */);
                this.render();
            }
        }));
        this.countHover = this._register(hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), this.elements.count, ''));
        const ab = this._register(new ActionBar(this.elements.rerun, {
            actionViewItemProvider: (action, options) => createActionViewItem(instantiationService, action, options),
        }));
        ab.push(instantiationService.createInstance(MenuItemAction, { ...new ReRunLastRun().desc, icon: icons.testingRerunIcon }, { ...new DebugLastRun().desc, icon: icons.testingDebugIcon }, {}, undefined, undefined), { icon: true, label: false });
        this.render();
    }
    render() {
        const { results } = this.resultService;
        const { count, root, status, duration, rerun } = this.elements;
        if (!results.length) {
            if (this.elementsWereAttached) {
                root.remove();
                this.elementsWereAttached = false;
            }
            this.container.innerText = localize('noResults', 'No test results yet.');
            this.badgeDisposable.clear();
            return;
        }
        const live = results.filter(r => !r.completedAt);
        let counts;
        if (live.length) {
            status.className = ThemeIcon.asClassName(spinningLoading);
            counts = collectTestStateCounts(true, live);
            this.renderLoop.schedule();
            const last = live[live.length - 1];
            duration.textContent = formatDuration(Date.now() - last.startedAt);
            rerun.style.display = 'none';
        }
        else {
            const last = results[0];
            const dominantState = mapFindFirst(statesInOrder, s => last.counts[s] > 0 ? s : undefined);
            status.className = ThemeIcon.asClassName(icons.testingStatesToIcons.get(dominantState ?? 0 /* TestResultState.Unset */));
            counts = collectTestStateCounts(false, [last]);
            duration.textContent = last instanceof LiveTestResult ? formatDuration(last.completedAt - last.startedAt) : '';
            rerun.style.display = 'block';
        }
        count.textContent = `${counts.passed}/${counts.totalWillBeRun}`;
        this.countHover.update(getTestProgressText(counts));
        this.renderActivityBadge(counts);
        if (!this.elementsWereAttached) {
            dom.clearNode(this.container);
            this.container.appendChild(root);
            this.elementsWereAttached = true;
        }
    }
    renderActivityBadge(countSummary) {
        if (countSummary && this.badgeType !== "off" /* TestingCountBadge.Off */ && countSummary[this.badgeType] !== 0) {
            if (this.lastBadge instanceof NumberBadge && this.lastBadge.number === countSummary[this.badgeType]) {
                return;
            }
            this.lastBadge = new NumberBadge(countSummary[this.badgeType], num => this.getLocalizedBadgeString(this.badgeType, num));
        }
        else if (this.crService.isEnabled()) {
            if (this.lastBadge instanceof IconBadge && this.lastBadge.icon === icons.testingContinuousIsOn) {
                return;
            }
            this.lastBadge = new IconBadge(icons.testingContinuousIsOn, () => localize('testingContinuousBadge', 'Tests are being watched for changes'));
        }
        else {
            if (!this.lastBadge) {
                return;
            }
            this.lastBadge = undefined;
        }
        this.badgeDisposable.value = this.lastBadge && this.activityService.showViewActivity("workbench.view.testing" /* Testing.ExplorerViewId */, { badge: this.lastBadge });
    }
    getLocalizedBadgeString(countBadgeType, count) {
        switch (countBadgeType) {
            case "passed" /* TestingCountBadge.Passed */:
                return localize('testingCountBadgePassed', '{0} passed tests', count);
            case "skipped" /* TestingCountBadge.Skipped */:
                return localize('testingCountBadgeSkipped', '{0} skipped tests', count);
            default:
                return localize('testingCountBadgeFailed', '{0} failed tests', count);
        }
    }
};
ResultSummaryView = __decorate([
    __param(1, ITestResultService),
    __param(2, IActivityService),
    __param(3, ITestingContinuousRunService),
    __param(4, IConfigurationService),
    __param(5, IInstantiationService),
    __param(6, IHoverService)
], ResultSummaryView);
var WelcomeExperience;
(function (WelcomeExperience) {
    WelcomeExperience[WelcomeExperience["None"] = 0] = "None";
    WelcomeExperience[WelcomeExperience["ForWorkspace"] = 1] = "ForWorkspace";
    WelcomeExperience[WelcomeExperience["ForDocument"] = 2] = "ForDocument";
})(WelcomeExperience || (WelcomeExperience = {}));
let TestingExplorerViewModel = class TestingExplorerViewModel extends Disposable {
    get viewMode() {
        return this._viewMode.get() ?? "true" /* TestExplorerViewMode.Tree */;
    }
    set viewMode(newMode) {
        if (newMode === this._viewMode.get()) {
            return;
        }
        this._viewMode.set(newMode);
        this.updatePreferredProjection();
        this.storageService.store('testing.viewMode', newMode, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
    }
    get viewSorting() {
        return this._viewSorting.get() ?? "status" /* TestExplorerViewSorting.ByStatus */;
    }
    set viewSorting(newSorting) {
        if (newSorting === this._viewSorting.get()) {
            return;
        }
        this._viewSorting.set(newSorting);
        this.tree.resort(null);
        this.storageService.store('testing.viewSorting', newSorting, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
    }
    constructor(listContainer, onDidChangeVisibility, configurationService, editorService, editorGroupsService, menuService, contextMenuService, testService, filterState, instantiationService, storageService, contextKeyService, testResults, peekOpener, testProfileService, crService, commandService) {
        super();
        this.menuService = menuService;
        this.contextMenuService = contextMenuService;
        this.testService = testService;
        this.filterState = filterState;
        this.instantiationService = instantiationService;
        this.storageService = storageService;
        this.contextKeyService = contextKeyService;
        this.testResults = testResults;
        this.peekOpener = peekOpener;
        this.testProfileService = testProfileService;
        this.crService = crService;
        this.projection = this._register(new MutableDisposable());
        this.revealTimeout = new MutableDisposable();
        this.welcomeVisibilityEmitter = new Emitter();
        this.actionRunner = this._register(new TestExplorerActionRunner(() => this.tree.getSelection().filter(isDefined)));
        /**
         * Whether there's a reveal request which has not yet been delivered. This
         * can happen if the user asks to reveal before the test tree is loaded.
         * We check to see if the reveal request is present on each tree update,
         * and do it then if so.
         */
        this.hasPendingReveal = false;
        /**
         * Fires when the visibility of the placeholder state changes.
         */
        this.onChangeWelcomeVisibility = this.welcomeVisibilityEmitter.event;
        /**
         * Gets whether the welcome should be visible.
         */
        this.welcomeExperience = 0 /* WelcomeExperience.None */;
        this.hasPendingReveal = !!filterState.reveal.get();
        this.noTestForDocumentWidget = this._register(instantiationService.createInstance(NoTestsForDocumentWidget, listContainer));
        this.lastViewState = this._register(new StoredValue({
            key: 'testing.treeState',
            scope: 1 /* StorageScope.WORKSPACE */,
            target: 1 /* StorageTarget.MACHINE */,
        }, this.storageService));
        this._viewMode = TestingContextKeys.viewMode.bindTo(contextKeyService);
        this._viewSorting = TestingContextKeys.viewSorting.bindTo(contextKeyService);
        this._viewMode.set(this.storageService.get('testing.viewMode', 1 /* StorageScope.WORKSPACE */, "true" /* TestExplorerViewMode.Tree */));
        this._viewSorting.set(this.storageService.get('testing.viewSorting', 1 /* StorageScope.WORKSPACE */, "location" /* TestExplorerViewSorting.ByLocation */));
        this.reevaluateWelcomeState();
        this.filter = this.instantiationService.createInstance(TestsFilter, testService.collection);
        this.tree = instantiationService.createInstance(TestingObjectTree, 'Test Explorer List', listContainer, new ListDelegate(), [
            instantiationService.createInstance(TestItemRenderer, this.actionRunner),
            instantiationService.createInstance(ErrorRenderer),
        ], {
            identityProvider: instantiationService.createInstance(IdentityProvider),
            hideTwistiesOfChildlessElements: false,
            sorter: instantiationService.createInstance(TreeSorter, this),
            keyboardNavigationLabelProvider: instantiationService.createInstance(TreeKeyboardNavigationLabelProvider),
            accessibilityProvider: instantiationService.createInstance(ListAccessibilityProvider),
            filter: this.filter,
            findWidgetEnabled: false,
        });
        // saves the collapse state so that if items are removed or refreshed, they
        // retain the same state (#170169)
        const collapseStateSaver = this._register(new RunOnceScheduler(() => {
            // reuse the last view state to avoid making a bunch of object garbage:
            const state = this.tree.getOptimizedViewState(this.lastViewState.get({}));
            const projection = this.projection.value;
            if (projection) {
                projection.lastState = state;
            }
        }, 3000));
        this._register(this.tree.onDidChangeCollapseState(evt => {
            if (evt.node.element instanceof TestItemTreeElement) {
                if (!evt.node.collapsed) {
                    this.projection.value?.expandElement(evt.node.element, evt.deep ? Infinity : 0);
                }
                collapseStateSaver.schedule();
            }
        }));
        this._register(this.crService.onDidChange(testId => {
            if (testId) {
                // a continuous run test will sort to the top:
                const elem = this.projection.value?.getElementByTestId(testId);
                this.tree.resort(elem?.parent && this.tree.hasElement(elem.parent) ? elem.parent : null, false);
            }
        }));
        this._register(onDidChangeVisibility(visible => {
            if (visible) {
                this.ensureProjection();
            }
        }));
        this._register(this.tree.onContextMenu(e => this.onContextMenu(e)));
        this._register(Event.any(filterState.text.onDidChange, filterState.fuzzy.onDidChange, testService.excluded.onTestExclusionsChanged)(() => {
            if (!filterState.text.value) {
                return this.tree.refilter();
            }
            const items = this.filter.lastIncludedTests = new Set();
            this.tree.refilter();
            this.filter.lastIncludedTests = undefined;
            for (const test of items) {
                this.tree.expandTo(test);
            }
        }));
        this._register(this.tree.onDidOpen(e => {
            if (!(e.element instanceof TestItemTreeElement)) {
                return;
            }
            filterState.didSelectTestInExplorer(e.element.test.item.extId);
            if (!e.element.children.size && e.element.test.item.uri) {
                if (!this.tryPeekError(e.element)) {
                    commandService.executeCommand('vscode.revealTest', e.element.test.item.extId, {
                        openToSide: e.sideBySide,
                        preserveFocus: true,
                    });
                }
            }
        }));
        this._register(this.tree);
        this._register(this.onChangeWelcomeVisibility(e => {
            this.noTestForDocumentWidget.setVisible(e === 2 /* WelcomeExperience.ForDocument */);
        }));
        this._register(dom.addStandardDisposableListener(this.tree.getHTMLElement(), 'keydown', evt => {
            if (evt.equals(3 /* KeyCode.Enter */)) {
                this.handleExecuteKeypress(evt);
            }
            else if (DefaultKeyboardNavigationDelegate.mightProducePrintableCharacter(evt)) {
                filterState.text.value = evt.browserEvent.key;
                filterState.focusInput();
            }
        }));
        this._register(autorun(reader => {
            this.revealById(filterState.reveal.read(reader), undefined, false);
        }));
        this._register(onDidChangeVisibility(visible => {
            if (visible) {
                filterState.focusInput();
            }
        }));
        let followRunningTests = getTestingConfiguration(configurationService, "testing.followRunningTest" /* TestingConfigKeys.FollowRunningTest */);
        this._register(configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("testing.followRunningTest" /* TestingConfigKeys.FollowRunningTest */)) {
                followRunningTests = getTestingConfiguration(configurationService, "testing.followRunningTest" /* TestingConfigKeys.FollowRunningTest */);
            }
        }));
        let alwaysRevealTestAfterStateChange = getTestingConfiguration(configurationService, "testing.alwaysRevealTestOnStateChange" /* TestingConfigKeys.AlwaysRevealTestOnStateChange */);
        this._register(configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("testing.alwaysRevealTestOnStateChange" /* TestingConfigKeys.AlwaysRevealTestOnStateChange */)) {
                alwaysRevealTestAfterStateChange = getTestingConfiguration(configurationService, "testing.alwaysRevealTestOnStateChange" /* TestingConfigKeys.AlwaysRevealTestOnStateChange */);
            }
        }));
        this._register(testResults.onTestChanged(evt => {
            if (!followRunningTests) {
                return;
            }
            if (evt.reason !== 1 /* TestResultItemChangeReason.OwnStateChange */) {
                return;
            }
            if (this.tree.selectionSize > 1) {
                return; // don't change a multi-selection #180950
            }
            // follow running tests, or tests whose state changed. Tests that
            // complete very fast may not enter the running state at all.
            if (evt.item.ownComputedState !== 2 /* TestResultState.Running */ && !(evt.previousState === 1 /* TestResultState.Queued */ && isStateWithResult(evt.item.ownComputedState))) {
                return;
            }
            this.revealById(evt.item.item.extId, alwaysRevealTestAfterStateChange, false);
        }));
        this._register(testResults.onResultsChanged(() => {
            this.tree.resort(null);
        }));
        this._register(this.testProfileService.onDidChange(() => {
            this.tree.rerender();
        }));
        const allOpenEditorInputs = observableFromEvent(this, editorService.onDidEditorsChange, () => new Set(editorGroupsService.groups.flatMap(g => g.editors).map(e => e.resource).filter(isDefined)));
        const activeResource = observableFromEvent(this, editorService.onDidActiveEditorChange, () => {
            if (editorService.activeEditor instanceof DiffEditorInput) {
                return editorService.activeEditor.primary.resource;
            }
            else {
                return editorService.activeEditor?.resource;
            }
        });
        const filterText = observableFromEvent(this.filterState.text.onDidChange, () => this.filterState.text);
        this._register(autorun(reader => {
            filterText.read(reader);
            if (this.filterState.isFilteringFor("@openedFiles" /* TestFilterTerm.OpenedFiles */)) {
                this.filter.filterToDocumentUri([...allOpenEditorInputs.read(reader)]);
            }
            else {
                this.filter.filterToDocumentUri([activeResource.read(reader)].filter(isDefined));
            }
            if (this.filterState.isFilteringFor("@doc" /* TestFilterTerm.CurrentDoc */) || this.filterState.isFilteringFor("@openedFiles" /* TestFilterTerm.OpenedFiles */)) {
                this.tree.refilter();
            }
        }));
        this._register(this.storageService.onWillSaveState(({ reason, }) => {
            if (reason === WillSaveStateReason.SHUTDOWN) {
                this.lastViewState.store(this.tree.getOptimizedViewState());
            }
        }));
    }
    /**
     * Re-layout the tree.
     */
    layout(height, width) {
        this.tree.layout(height, width);
    }
    /**
     * Tries to reveal by extension ID. Queues the request if the extension
     * ID is not currently available.
     */
    revealById(id, expand = true, focus = true) {
        if (!id) {
            this.hasPendingReveal = false;
            return;
        }
        const projection = this.ensureProjection();
        // If the item itself is visible in the tree, show it. Otherwise, expand
        // its closest parent.
        let expandToLevel = 0;
        const idPath = [...TestId.fromString(id).idsFromRoot()];
        for (let i = idPath.length - 1; i >= expandToLevel; i--) {
            const element = projection.getElementByTestId(idPath[i].toString());
            // Skip all elements that aren't in the tree.
            if (!element || !this.tree.hasElement(element)) {
                continue;
            }
            // If this 'if' is true, we're at the closest-visible parent to the node
            // we want to expand. Expand that, and then start the loop again because
            // we might already have children for it.
            if (i < idPath.length - 1) {
                if (expand) {
                    this.tree.expand(element);
                    expandToLevel = i + 1; // avoid an infinite loop if the test does not exist
                    i = idPath.length - 1; // restart the loop since new children may now be visible
                    continue;
                }
            }
            // Otherwise, we've arrived!
            // If the node or any of its children are excluded, flip on the 'show
            // excluded tests' checkbox automatically. If we didn't expand, then set
            // target focus target to the first collapsed element.
            let focusTarget = element;
            for (let n = element; n instanceof TestItemTreeElement; n = n.parent) {
                if (n.test && this.testService.excluded.contains(n.test)) {
                    this.filterState.toggleFilteringFor("@hidden" /* TestFilterTerm.Hidden */, true);
                    break;
                }
                if (!expand && (this.tree.hasElement(n) && this.tree.isCollapsed(n))) {
                    focusTarget = n;
                }
            }
            this.filterState.reveal.set(undefined, undefined);
            this.hasPendingReveal = false;
            if (focus) {
                this.tree.domFocus();
            }
            if (this.tree.getRelativeTop(focusTarget) === null) {
                this.tree.reveal(focusTarget, 0.5);
            }
            this.revealTimeout.value = disposableTimeout(() => {
                this.tree.setFocus([focusTarget]);
                this.tree.setSelection([focusTarget]);
            }, 1);
            return;
        }
        // If here, we've expanded all parents we can. Waiting on data to come
        // in to possibly show the revealed test.
        this.hasPendingReveal = true;
    }
    /**
     * Collapse all items in the tree.
     */
    async collapseAll() {
        this.tree.collapseAll();
    }
    /**
     * Tries to peek the first test error, if the item is in a failed state.
     */
    tryPeekError(item) {
        const lookup = item.test && this.testResults.getStateById(item.test.item.extId);
        return lookup && lookup[1].tasks.some(s => isFailedState(s.state))
            ? this.peekOpener.tryPeekFirstError(lookup[0], lookup[1], { preserveFocus: true })
            : false;
    }
    onContextMenu(evt) {
        const element = evt.element;
        if (!(element instanceof TestItemTreeElement)) {
            return;
        }
        const { actions } = getActionableElementActions(this.contextKeyService, this.menuService, this.testService, this.crService, this.testProfileService, element);
        this.contextMenuService.showContextMenu({
            getAnchor: () => evt.anchor,
            getActions: () => actions.secondary,
            getActionsContext: () => element,
            actionRunner: this.actionRunner,
        });
    }
    handleExecuteKeypress(evt) {
        const focused = this.tree.getFocus();
        const selected = this.tree.getSelection();
        let targeted;
        if (focused.length === 1 && selected.includes(focused[0])) {
            evt.browserEvent?.preventDefault();
            targeted = selected;
        }
        else {
            targeted = focused;
        }
        const toRun = targeted
            .filter((e) => e instanceof TestItemTreeElement);
        if (toRun.length) {
            this.testService.runTests({
                group: 2 /* TestRunProfileBitset.Run */,
                tests: toRun.map(t => t.test),
            });
        }
    }
    reevaluateWelcomeState() {
        const shouldShowWelcome = this.testService.collection.busyProviders === 0 && testCollectionIsEmpty(this.testService.collection);
        const welcomeExperience = shouldShowWelcome
            ? (this.filterState.isFilteringFor("@doc" /* TestFilterTerm.CurrentDoc */) ? 2 /* WelcomeExperience.ForDocument */ : 1 /* WelcomeExperience.ForWorkspace */)
            : 0 /* WelcomeExperience.None */;
        if (welcomeExperience !== this.welcomeExperience) {
            this.welcomeExperience = welcomeExperience;
            this.welcomeVisibilityEmitter.fire(welcomeExperience);
        }
    }
    ensureProjection() {
        return this.projection.value ?? this.updatePreferredProjection();
    }
    updatePreferredProjection() {
        this.projection.clear();
        const lastState = this.lastViewState.get({});
        if (this._viewMode.get() === "list" /* TestExplorerViewMode.List */) {
            this.projection.value = this.instantiationService.createInstance(ListProjection, lastState);
        }
        else {
            this.projection.value = this.instantiationService.createInstance(TreeProjection, lastState);
        }
        const scheduler = this._register(new RunOnceScheduler(() => this.applyProjectionChanges(), 200));
        this.projection.value.onUpdate(() => {
            if (!scheduler.isScheduled()) {
                scheduler.schedule();
            }
        });
        this.applyProjectionChanges();
        return this.projection.value;
    }
    applyProjectionChanges() {
        this.reevaluateWelcomeState();
        this.projection.value?.applyTo(this.tree);
        this.tree.refilter();
        if (this.hasPendingReveal) {
            this.revealById(this.filterState.reveal.get());
        }
    }
    /**
     * Gets the selected tests from the tree.
     */
    getSelectedTests() {
        return this.tree.getSelection();
    }
};
TestingExplorerViewModel = __decorate([
    __param(2, IConfigurationService),
    __param(3, IEditorService),
    __param(4, IEditorGroupsService),
    __param(5, IMenuService),
    __param(6, IContextMenuService),
    __param(7, ITestService),
    __param(8, ITestExplorerFilterState),
    __param(9, IInstantiationService),
    __param(10, IStorageService),
    __param(11, IContextKeyService),
    __param(12, ITestResultService),
    __param(13, ITestingPeekOpener),
    __param(14, ITestProfileService),
    __param(15, ITestingContinuousRunService),
    __param(16, ICommandService)
], TestingExplorerViewModel);
var FilterResult;
(function (FilterResult) {
    FilterResult[FilterResult["Exclude"] = 0] = "Exclude";
    FilterResult[FilterResult["Inherit"] = 1] = "Inherit";
    FilterResult[FilterResult["Include"] = 2] = "Include";
})(FilterResult || (FilterResult = {}));
const hasNodeInOrParentOfUri = (collection, ident, testUri, fromNode) => {
    const queue = [fromNode ? [fromNode] : collection.rootIds];
    while (queue.length) {
        for (const id of queue.pop()) {
            const node = collection.getNodeById(id);
            if (!node) {
                continue;
            }
            if (!node.item.uri || !ident.extUri.isEqualOrParent(testUri, node.item.uri)) {
                continue;
            }
            // Only show nodes that can be expanded (and might have a child with
            // a range) or ones that have a physical location.
            if (node.item.range || node.expand === 1 /* TestItemExpandState.Expandable */) {
                return true;
            }
            queue.push(node.children);
        }
    }
    return false;
};
let TestsFilter = class TestsFilter {
    constructor(collection, state, testService, uriIdentityService) {
        this.collection = collection;
        this.state = state;
        this.testService = testService;
        this.uriIdentityService = uriIdentityService;
        this.documentUris = [];
    }
    /**
     * @inheritdoc
     */
    filter(element) {
        if (element instanceof TestTreeErrorMessage) {
            return 1 /* TreeVisibility.Visible */;
        }
        if (element.test
            && !this.state.isFilteringFor("@hidden" /* TestFilterTerm.Hidden */)
            && this.testService.excluded.contains(element.test)) {
            return 0 /* TreeVisibility.Hidden */;
        }
        switch (Math.min(this.testFilterText(element), this.testLocation(element), this.testState(element), this.testTags(element))) {
            case 0 /* FilterResult.Exclude */:
                return 0 /* TreeVisibility.Hidden */;
            case 2 /* FilterResult.Include */:
                this.lastIncludedTests?.add(element);
                return 1 /* TreeVisibility.Visible */;
            default:
                return 2 /* TreeVisibility.Recurse */;
        }
    }
    filterToDocumentUri(uris) {
        this.documentUris = [...uris];
    }
    testTags(element) {
        if (!this.state.includeTags.size && !this.state.excludeTags.size) {
            return 2 /* FilterResult.Include */;
        }
        return (this.state.includeTags.size ?
            element.test.item.tags.some(t => this.state.includeTags.has(t)) :
            true) && element.test.item.tags.every(t => !this.state.excludeTags.has(t))
            ? 2 /* FilterResult.Include */
            : 1 /* FilterResult.Inherit */;
    }
    testState(element) {
        if (this.state.isFilteringFor("@failed" /* TestFilterTerm.Failed */)) {
            return isFailedState(element.state) ? 2 /* FilterResult.Include */ : 1 /* FilterResult.Inherit */;
        }
        if (this.state.isFilteringFor("@executed" /* TestFilterTerm.Executed */)) {
            return element.state !== 0 /* TestResultState.Unset */ ? 2 /* FilterResult.Include */ : 1 /* FilterResult.Inherit */;
        }
        return 2 /* FilterResult.Include */;
    }
    testLocation(element) {
        if (this.documentUris.length === 0) {
            return 2 /* FilterResult.Include */;
        }
        if ((!this.state.isFilteringFor("@doc" /* TestFilterTerm.CurrentDoc */) && !this.state.isFilteringFor("@openedFiles" /* TestFilterTerm.OpenedFiles */)) || !(element instanceof TestItemTreeElement)) {
            return 2 /* FilterResult.Include */;
        }
        if (this.documentUris.some(uri => hasNodeInOrParentOfUri(this.collection, this.uriIdentityService, uri, element.test.item.extId))) {
            return 2 /* FilterResult.Include */;
        }
        return 1 /* FilterResult.Inherit */;
    }
    testFilterText(element) {
        if (this.state.globList.length === 0) {
            return 2 /* FilterResult.Include */;
        }
        const fuzzy = this.state.fuzzy.value;
        for (let e = element; e; e = e.parent) {
            // start as included if the first glob is a negation
            let included = this.state.globList[0].include === false ? 2 /* FilterResult.Include */ : 1 /* FilterResult.Inherit */;
            const data = e.test.item.label.toLowerCase();
            for (const { include, text } of this.state.globList) {
                if (fuzzy ? fuzzyContains(data, text) : data.includes(text)) {
                    included = include ? 2 /* FilterResult.Include */ : 0 /* FilterResult.Exclude */;
                }
            }
            if (included !== 1 /* FilterResult.Inherit */) {
                return included;
            }
        }
        return 1 /* FilterResult.Inherit */;
    }
};
TestsFilter = __decorate([
    __param(1, ITestExplorerFilterState),
    __param(2, ITestService),
    __param(3, IUriIdentityService)
], TestsFilter);
class TreeSorter {
    constructor(viewModel) {
        this.viewModel = viewModel;
    }
    compare(a, b) {
        if (a instanceof TestTreeErrorMessage || b instanceof TestTreeErrorMessage) {
            return (a instanceof TestTreeErrorMessage ? -1 : 0) + (b instanceof TestTreeErrorMessage ? 1 : 0);
        }
        const durationDelta = (b.duration || 0) - (a.duration || 0);
        if (this.viewModel.viewSorting === "duration" /* TestExplorerViewSorting.ByDuration */ && durationDelta !== 0) {
            return durationDelta;
        }
        const stateDelta = cmpPriority(a.state, b.state);
        if (this.viewModel.viewSorting === "status" /* TestExplorerViewSorting.ByStatus */ && stateDelta !== 0) {
            return stateDelta;
        }
        let inSameLocation = false;
        if (a instanceof TestItemTreeElement && b instanceof TestItemTreeElement && a.test.item.uri && b.test.item.uri && a.test.item.uri.toString() === b.test.item.uri.toString() && a.test.item.range && b.test.item.range) {
            inSameLocation = true;
            const delta = a.test.item.range.startLineNumber - b.test.item.range.startLineNumber;
            if (delta !== 0) {
                return delta;
            }
        }
        const sa = a.test.item.sortText;
        const sb = b.test.item.sortText;
        // If tests are in the same location and there's no preferred sortText,
        // keep the extension's insertion order (#163449).
        return inSameLocation && !sa && !sb
            ? 0
            : compareFileNames(sa || a.test.item.label, sb || b.test.item.label);
    }
}
let NoTestsForDocumentWidget = class NoTestsForDocumentWidget extends Disposable {
    constructor(container, filterState) {
        super();
        const el = this.el = dom.append(container, dom.$('.testing-no-test-placeholder'));
        const emptyParagraph = dom.append(el, dom.$('p'));
        emptyParagraph.innerText = localize('testingNoTest', 'No tests were found in this file.');
        const buttonLabel = localize('testingFindExtension', 'Show Workspace Tests');
        const button = this._register(new Button(el, { title: buttonLabel, ...defaultButtonStyles }));
        button.label = buttonLabel;
        this._register(button.onDidClick(() => filterState.toggleFilteringFor("@doc" /* TestFilterTerm.CurrentDoc */, false)));
    }
    setVisible(isVisible) {
        this.el.classList.toggle('visible', isVisible);
    }
};
NoTestsForDocumentWidget = __decorate([
    __param(1, ITestExplorerFilterState)
], NoTestsForDocumentWidget);
class TestExplorerActionRunner extends ActionRunner {
    constructor(getSelectedTests) {
        super();
        this.getSelectedTests = getSelectedTests;
    }
    async runAction(action, context) {
        if (!(action instanceof MenuItemAction)) {
            return super.runAction(action, context);
        }
        const selection = this.getSelectedTests();
        const contextIsSelected = selection.some(s => s === context);
        const actualContext = contextIsSelected ? selection : [context];
        const actionable = actualContext.filter((t) => t instanceof TestItemTreeElement);
        await action.run(...actionable);
    }
}
const getLabelForTestTreeElement = (element) => {
    let label = labelForTestInState(element.description || element.test.item.label, element.state);
    if (element instanceof TestItemTreeElement) {
        if (element.duration !== undefined) {
            label = localize({
                key: 'testing.treeElementLabelDuration',
                comment: ['{0} is the original label in testing.treeElementLabel, {1} is a duration'],
            }, '{0}, in {1}', label, formatDuration(element.duration));
        }
        if (element.retired) {
            label = localize({
                key: 'testing.treeElementLabelOutdated',
                comment: ['{0} is the original label in testing.treeElementLabel'],
            }, '{0}, outdated result', label);
        }
    }
    return label;
};
class ListAccessibilityProvider {
    getWidgetAriaLabel() {
        return localize('testExplorer', "Test Explorer");
    }
    getAriaLabel(element) {
        return element instanceof TestTreeErrorMessage
            ? element.description
            : getLabelForTestTreeElement(element);
    }
}
class TreeKeyboardNavigationLabelProvider {
    getKeyboardNavigationLabel(element) {
        return element instanceof TestTreeErrorMessage ? element.message : element.test.item.label;
    }
}
class ListDelegate {
    getHeight(element) {
        return element instanceof TestTreeErrorMessage ? 17 + 10 : 22;
    }
    getTemplateId(element) {
        if (element instanceof TestTreeErrorMessage) {
            return ErrorRenderer.ID;
        }
        return TestItemRenderer.ID;
    }
}
class IdentityProvider {
    getId(element) {
        return element.treeId;
    }
}
let ErrorRenderer = class ErrorRenderer {
    static { ErrorRenderer_1 = this; }
    static { this.ID = 'error'; }
    constructor(hoverService, markdownRendererService) {
        this.hoverService = hoverService;
        this.markdownRendererService = markdownRendererService;
    }
    get templateId() {
        return ErrorRenderer_1.ID;
    }
    renderTemplate(container) {
        const label = dom.append(container, dom.$('.error'));
        return { label, disposable: new DisposableStore() };
    }
    renderElement({ element }, _, data) {
        dom.clearNode(data.label);
        if (typeof element.message === 'string') {
            data.label.innerText = element.message;
        }
        else {
            const result = this.markdownRendererService.render(element.message, undefined, document.createElement('span'));
            data.label.appendChild(result.element);
        }
        data.disposable.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), data.label, element.description));
    }
    disposeTemplate(data) {
        data.disposable.dispose();
    }
};
ErrorRenderer = ErrorRenderer_1 = __decorate([
    __param(0, IHoverService),
    __param(1, IMarkdownRendererService)
], ErrorRenderer);
let TestItemRenderer = class TestItemRenderer extends Disposable {
    static { TestItemRenderer_1 = this; }
    static { this.ID = 'testItem'; }
    constructor(actionRunner, menuService, testService, profiles, contextKeyService, instantiationService, crService, hoverService) {
        super();
        this.actionRunner = actionRunner;
        this.menuService = menuService;
        this.testService = testService;
        this.profiles = profiles;
        this.contextKeyService = contextKeyService;
        this.instantiationService = instantiationService;
        this.crService = crService;
        this.hoverService = hoverService;
        /**
         * @inheritdoc
         */
        this.templateId = TestItemRenderer_1.ID;
    }
    /**
     * @inheritdoc
     */
    renderTemplate(wrapper) {
        wrapper.classList.add('testing-stdtree-container');
        const icon = dom.append(wrapper, dom.$('.computed-state'));
        const label = dom.append(wrapper, dom.$('.label'));
        const disposable = new DisposableStore();
        dom.append(wrapper, dom.$(ThemeIcon.asCSSSelector(icons.testingHiddenIcon)));
        const actionBar = disposable.add(new ActionBar(wrapper, {
            actionRunner: this.actionRunner,
            actionViewItemProvider: (action, options) => action instanceof MenuItemAction
                ? this.instantiationService.createInstance(MenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate })
                : undefined
        }));
        disposable.add(this.profiles.onDidChange(() => {
            if (templateData.current) {
                this.fillActionBar(templateData.current, templateData);
            }
        }));
        disposable.add(this.crService.onDidChange(changed => {
            const id = templateData.current?.test.item.extId;
            if (id && (!changed || changed === id || TestId.isChild(id, changed))) {
                this.fillActionBar(templateData.current, templateData);
            }
        }));
        const templateData = { wrapper, label, actionBar, icon, elementDisposable: new DisposableStore(), templateDisposable: disposable };
        return templateData;
    }
    /**
     * @inheritdoc
     */
    disposeTemplate(templateData) {
        templateData.templateDisposable.clear();
    }
    /**
     * @inheritdoc
     */
    disposeElement(_element, _, templateData) {
        templateData.elementDisposable.clear();
    }
    fillActionBar(element, data) {
        const { actions, contextOverlay } = getActionableElementActions(this.contextKeyService, this.menuService, this.testService, this.crService, this.profiles, element);
        const crSelf = !!contextOverlay.getContextKeyValue(TestingContextKeys.isContinuousModeOn.key);
        const crChild = !crSelf && this.crService.isEnabledForAChildOf(element.test.item.extId);
        data.actionBar.domNode.classList.toggle('testing-is-continuous-run', crSelf || crChild);
        data.actionBar.clear();
        data.actionBar.context = element;
        data.actionBar.push(actions.primary, { icon: true, label: false });
    }
    /**
     * @inheritdoc
     */
    renderElement(node, _depth, data) {
        data.elementDisposable.clear();
        data.current = node.element;
        data.elementDisposable.add(node.element.onChange(() => this._renderElement(node, data)));
        this._renderElement(node, data);
    }
    _renderElement(node, data) {
        this.fillActionBar(node.element, data);
        const testHidden = this.testService.excluded.contains(node.element.test);
        data.wrapper.classList.toggle('test-is-hidden', testHidden);
        const icon = icons.testingStatesToIcons.get(node.element.test.expand === 2 /* TestItemExpandState.BusyExpanding */ || node.element.test.item.busy
            ? 2 /* TestResultState.Running */
            : node.element.state);
        data.icon.className = 'computed-state ' + (icon ? ThemeIcon.asClassName(icon) : '');
        if (node.element.retired) {
            data.icon.className += ' retired';
        }
        data.elementDisposable.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), data.label, getLabelForTestTreeElement(node.element)));
        if (node.element.test.item.label.trim()) {
            dom.reset(data.label, ...renderLabelWithIcons(node.element.test.item.label));
        }
        else {
            data.label.textContent = String.fromCharCode(0xA0); // &nbsp;
        }
        let description = node.element.description;
        if (node.element.duration !== undefined) {
            description = description
                ? `${description}: ${formatDuration(node.element.duration)}`
                : formatDuration(node.element.duration);
        }
        if (description) {
            dom.append(data.label, dom.$('span.test-label-description', {}, description));
        }
    }
};
TestItemRenderer = TestItemRenderer_1 = __decorate([
    __param(1, IMenuService),
    __param(2, ITestService),
    __param(3, ITestProfileService),
    __param(4, IContextKeyService),
    __param(5, IInstantiationService),
    __param(6, ITestingContinuousRunService),
    __param(7, IHoverService)
], TestItemRenderer);
const formatDuration = (ms) => {
    if (ms < 10) {
        return `${ms.toFixed(1)}ms`;
    }
    if (ms < 1_000) {
        return `${ms.toFixed(0)}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
};
const getActionableElementActions = (contextKeyService, menuService, testService, crService, profiles, element) => {
    const test = element instanceof TestItemTreeElement ? element.test : undefined;
    const contextKeys = getTestItemContextOverlay(test, test ? profiles.capabilitiesForTest(test.item) : 0);
    contextKeys.push(['view', "workbench.view.testing" /* Testing.ExplorerViewId */]);
    if (test) {
        const ctrl = testService.getTestController(test.controllerId);
        const supportsCr = !!ctrl && profiles.getControllerProfiles(ctrl.id).some(p => p.supportsContinuousRun && canUseProfileWithTest(p, test));
        contextKeys.push([
            TestingContextKeys.canRefreshTests.key,
            ctrl && !!(ctrl.capabilities.get() & 2 /* TestControllerCapability.Refresh */) && TestId.isRoot(test.item.extId),
        ], [
            TestingContextKeys.testItemIsHidden.key,
            testService.excluded.contains(test)
        ], [
            TestingContextKeys.isContinuousModeOn.key,
            supportsCr && crService.isSpecificallyEnabledFor(test.item.extId)
        ], [
            TestingContextKeys.isParentRunningContinuously.key,
            supportsCr && crService.isEnabledForAParentOf(test.item.extId)
        ], [
            TestingContextKeys.supportsContinuousRun.key,
            supportsCr,
        ], [
            TestingContextKeys.testResultOutdated.key,
            element.retired,
        ], [
            TestingContextKeys.testResultState.key,
            testResultStateToContextValues[element.state],
        ]);
    }
    const contextOverlay = contextKeyService.createOverlay(contextKeys);
    const menu = menuService.getMenuActions(MenuId.TestItem, contextOverlay, {
        shouldForwardArgs: true,
    });
    const actions = getActionBarActions(menu, 'inline');
    return { actions, contextOverlay };
};
registerThemingParticipant((theme, collector) => {
    if (theme.type === 'dark') {
        const foregroundColor = theme.getColor(foreground);
        if (foregroundColor) {
            const fgWithOpacity = new Color(new RGBA(foregroundColor.rgba.r, foregroundColor.rgba.g, foregroundColor.rgba.b, 0.65));
            collector.addRule(`.test-explorer .test-explorer-messages { color: ${fgWithOpacity}; }`);
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGluZ0V4cGxvcmVyVmlldy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2Jyb3dzZXIvdGVzdGluZ0V4cGxvcmVyVmlldy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUd2RCxPQUFPLEVBQUUsU0FBUyxFQUFtQixNQUFNLG9EQUFvRCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUV0RSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUNwRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUUzRixPQUFPLEVBQUUsaUNBQWlDLEVBQThCLE1BQU0sZ0RBQWdELENBQUM7QUFFL0gsT0FBTyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQVcsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3hHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN2RixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRWxFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUUvRCxPQUFPLEVBQUUs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