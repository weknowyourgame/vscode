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
var CurrentlyFilteredToRenderer_1, FileCoverageRenderer_1, DeclarationCoverageRenderer_1;
import * as dom from '../../../../base/browser/dom.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { findLast } from '../../../../base/common/arraysFind.js';
import { assertNever } from '../../../../base/common/assert.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { memoize } from '../../../../base/common/decorators.js';
import { createMatches } from '../../../../base/common/filters.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, observableValue } from '../../../../base/common/observable.js';
import { basenameOrAuthority } from '../../../../base/common/resources.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Position } from '../../../../editor/common/core/position.js';
import { Range } from '../../../../editor/common/core/range.js';
import { localize, localize2 } from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { getActionBarActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { Action2, IMenuService, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { EditorOpenSource } from '../../../../platform/editor/common/editor.js';
import { FileKind } from '../../../../platform/files/common/files.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { WorkbenchCompressibleObjectTree } from '../../../../platform/list/browser/listService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ResourceLabels } from '../../../browser/labels.js';
import { ViewAction, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { onObservableChange } from '../common/observableUtils.js';
import { BypassedFileCoverage, FileCoverage, getTotalCoveragePercent } from '../common/testCoverage.js';
import { ITestCoverageService } from '../common/testCoverageService.js';
import { TestId } from '../common/testId.js';
import { TestingContextKeys } from '../common/testingContextKeys.js';
import * as coverUtils from './codeCoverageDisplayUtils.js';
import { testingStatesToIcons, testingWasCovered } from './icons.js';
import { ManagedTestCoverageBars } from './testCoverageBars.js';
var CoverageSortOrder;
(function (CoverageSortOrder) {
    CoverageSortOrder[CoverageSortOrder["Coverage"] = 0] = "Coverage";
    CoverageSortOrder[CoverageSortOrder["Location"] = 1] = "Location";
    CoverageSortOrder[CoverageSortOrder["Name"] = 2] = "Name";
})(CoverageSortOrder || (CoverageSortOrder = {}));
let TestCoverageView = class TestCoverageView extends ViewPane {
    constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, coverageService) {
        super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this.coverageService = coverageService;
        this.tree = new MutableDisposable();
        this.sortOrder = observableValue('sortOrder', 1 /* CoverageSortOrder.Location */);
    }
    renderBody(container) {
        super.renderBody(container);
        const labels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility }));
        this._register(autorun(reader => {
            const coverage = this.coverageService.selected.read(reader);
            if (coverage) {
                const t = (this.tree.value ??= this.instantiationService.createInstance(TestCoverageTree, container, labels, this.sortOrder));
                t.setInput(coverage, this.coverageService.filterToTest.read(reader));
            }
            else {
                this.tree.clear();
            }
        }));
    }
    layoutBody(height, width) {
        super.layoutBody(height, width);
        this.tree.value?.layout(height, width);
    }
    collapseAll() {
        this.tree.value?.collapseAll();
    }
};
TestCoverageView = __decorate([
    __param(1, IKeybindingService),
    __param(2, IContextMenuService),
    __param(3, IConfigurationService),
    __param(4, IContextKeyService),
    __param(5, IViewDescriptorService),
    __param(6, IInstantiationService),
    __param(7, IOpenerService),
    __param(8, IThemeService),
    __param(9, IHoverService),
    __param(10, ITestCoverageService)
], TestCoverageView);
export { TestCoverageView };
let fnNodeId = 0;
class DeclarationCoverageNode {
    get hits() {
        return this.data.count;
    }
    get label() {
        return this.data.name;
    }
    get location() {
        return this.data.location;
    }
    get tpc() {
        const attr = this.attributableCoverage();
        return attr && getTotalCoveragePercent(attr.statement, attr.branch, undefined);
    }
    constructor(uri, data, details) {
        this.uri = uri;
        this.data = data;
        this.id = String(fnNodeId++);
        this.containedDetails = new Set();
        this.children = [];
        if (data.location instanceof Range) {
            for (const detail of details) {
                if (this.contains(detail.location)) {
                    this.containedDetails.add(detail);
                }
            }
        }
    }
    /** Gets whether this function has a defined range and contains the given range. */
    contains(location) {
        const own = this.data.location;
        return own instanceof Range && (location instanceof Range ? own.containsRange(location) : own.containsPosition(location));
    }
    /**
     * If the function defines a range, we can look at statements within the
     * function to get total coverage for the function, rather than a boolean
     * yes/no.
     */
    attributableCoverage() {
        const { location, count } = this.data;
        if (!(location instanceof Range) || !count) {
            return;
        }
        const statement = { covered: 0, total: 0 };
        const branch = { covered: 0, total: 0 };
        for (const detail of this.containedDetails) {
            if (detail.type !== 1 /* DetailType.Statement */) {
                continue;
            }
            statement.covered += detail.count ? 1 : 0;
            statement.total++;
            if (detail.branches) {
                for (const { count } of detail.branches) {
                    branch.covered += count ? 1 : 0;
                    branch.total++;
                }
            }
        }
        return { statement, branch };
    }
}
__decorate([
    memoize
], DeclarationCoverageNode.prototype, "attributableCoverage", null);
class RevealUncoveredDeclarations {
    get label() {
        return localize('functionsWithoutCoverage', "{0} declarations without coverage...", this.n);
    }
    constructor(n) {
        this.n = n;
        this.id = String(fnNodeId++);
    }
}
class CurrentlyFilteredTo {
    get label() {
        return localize('filteredToTest', "Showing coverage for \"{0}\"", this.testItem.label);
    }
    constructor(testItem) {
        this.testItem = testItem;
        this.id = String(fnNodeId++);
    }
}
class LoadingDetails {
    constructor() {
        this.id = String(fnNodeId++);
        this.label = localize('loadingCoverageDetails', "Loading Coverage Details...");
    }
}
const isFileCoverage = (c) => typeof c === 'object' && 'value' in c;
const isDeclarationCoverage = (c) => c instanceof DeclarationCoverageNode;
const shouldShowDeclDetailsOnExpand = (c) => isFileCoverage(c) && c.value instanceof FileCoverage && !!c.value.declaration?.total;
let TestCoverageTree = class TestCoverageTree extends Disposable {
    constructor(container, labels, sortOrder, instantiationService, editorService, commandService) {
        super();
        this.inputDisposables = this._register(new DisposableStore());
        container.classList.add('testing-stdtree');
        this.tree = instantiationService.createInstance((WorkbenchCompressibleObjectTree), 'TestCoverageView', container, new TestCoverageTreeListDelegate(), [
            instantiationService.createInstance(FileCoverageRenderer, labels),
            instantiationService.createInstance(DeclarationCoverageRenderer),
            instantiationService.createInstance(BasicRenderer),
            instantiationService.createInstance(CurrentlyFilteredToRenderer),
        ], {
            expandOnlyOnTwistieClick: true,
            sorter: new Sorter(sortOrder),
            keyboardNavigationLabelProvider: {
                getCompressedNodeKeyboardNavigationLabel(elements) {
                    return elements.map(e => this.getKeyboardNavigationLabel(e)).join('/');
                },
                getKeyboardNavigationLabel(e) {
                    return isFileCoverage(e)
                        ? basenameOrAuthority(e.value.uri)
                        : e.label;
                },
            },
            accessibilityProvider: {
                getAriaLabel(element) {
                    if (isFileCoverage(element)) {
                        const name = basenameOrAuthority(element.value.uri);
                        return localize('testCoverageItemLabel', "{0} coverage: {0}%", name, (element.value.tpc * 100).toFixed(2));
                    }
                    else {
                        return element.label;
                    }
                },
                getWidgetAriaLabel() {
                    return localize('testCoverageTreeLabel', "Test Coverage Explorer");
                }
            },
            identityProvider: new TestCoverageIdentityProvider(),
        });
        this._register(autorun(reader => {
            sortOrder.read(reader);
            this.tree.resort(null, true);
        }));
        this._register(this.tree);
        this._register(this.tree.onDidChangeCollapseState(e => {
            const el = e.node.element;
            if (!e.node.collapsed && !e.node.children.length && el && shouldShowDeclDetailsOnExpand(el)) {
                if (el.value.hasSynchronousDetails) {
                    this.tree.setChildren(el, [{ element: new LoadingDetails(), incompressible: true }]);
                }
                el.value.details().then(details => this.updateWithDetails(el, details));
            }
        }));
        this._register(this.tree.onDidOpen(e => {
            let resource;
            let selection;
            if (e.element) {
                if (isFileCoverage(e.element) && !e.element.children?.size) {
                    resource = e.element.value.uri;
                }
                else if (isDeclarationCoverage(e.element)) {
                    resource = e.element.uri;
                    selection = e.element.location;
                }
                else if (e.element instanceof CurrentlyFilteredTo) {
                    commandService.executeCommand("testing.coverageFilterToTest" /* TestCommandId.CoverageFilterToTest */);
                    return;
                }
            }
            if (!resource) {
                return;
            }
            editorService.openEditor({
                resource,
                options: {
                    selection: selection instanceof Position ? Range.fromPositions(selection, selection) : selection,
                    revealIfOpened: true,
                    selectionRevealType: 3 /* TextEditorSelectionRevealType.NearTopIfOutsideViewport */,
                    preserveFocus: e.editorOptions.preserveFocus,
                    pinned: e.editorOptions.pinned,
                    source: EditorOpenSource.USER,
                },
            }, e.sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
        }));
    }
    setInput(coverage, showOnlyTest) {
        this.inputDisposables.clear();
        let tree = coverage.tree;
        // Filter to only a test, generate a new tree with only those items selected
        if (showOnlyTest) {
            tree = coverage.filterTreeForTest(showOnlyTest);
        }
        const files = [];
        for (let node of tree.nodes) {
            // when showing initial children, only show from the first file or tee
            while (!(node.value instanceof FileCoverage) && node.children?.size === 1) {
                node = Iterable.first(node.children.values());
            }
            files.push(node);
        }
        const toChild = (value) => {
            const isFile = !value.children?.size;
            return {
                element: value,
                incompressible: isFile,
                collapsed: isFile,
                // directories can be expanded, and items with function info can be expanded
                collapsible: !isFile || !!value.value?.declaration?.total,
                children: value.children && Iterable.map(value.children?.values(), toChild)
            };
        };
        this.inputDisposables.add(onObservableChange(coverage.didAddCoverage, nodes => {
            const toRender = findLast(nodes, n => this.tree.hasElement(n));
            if (toRender) {
                this.tree.setChildren(toRender, Iterable.map(toRender.children?.values() || [], toChild), { diffIdentityProvider: { getId: el => el.value.id } });
            }
        }));
        let children = Iterable.map(files, toChild);
        const filteredTo = showOnlyTest && coverage.result.getTestById(showOnlyTest.toString());
        if (filteredTo) {
            children = Iterable.concat(Iterable.single({
                element: new CurrentlyFilteredTo(filteredTo),
                incompressible: true,
            }), children);
        }
        this.tree.setChildren(null, children);
    }
    layout(height, width) {
        this.tree.layout(height, width);
    }
    collapseAll() {
        this.tree.collapseAll();
    }
    updateWithDetails(el, details) {
        if (!this.tree.hasElement(el)) {
            return; // avoid any issues if the tree changes in the meanwhile
        }
        const decl = [];
        for (const fn of details) {
            if (fn.type !== 0 /* DetailType.Declaration */) {
                continue;
            }
            let arr = decl;
            while (true) {
                const parent = arr.find(p => p.containedDetails.has(fn));
                if (parent) {
                    arr = parent.children;
                }
                else {
                    break;
                }
            }
            arr.push(new DeclarationCoverageNode(el.value.uri, fn, details));
        }
        const makeChild = (fn) => ({
            element: fn,
            incompressible: true,
            collapsed: true,
            collapsible: fn.children.length > 0,
            children: fn.children.map(makeChild)
        });
        this.tree.setChildren(el, decl.map(makeChild));
    }
};
TestCoverageTree = __decorate([
    __param(3, IInstantiationService),
    __param(4, IEditorService),
    __param(5, ICommandService)
], TestCoverageTree);
class TestCoverageTreeListDelegate {
    getHeight(element) {
        return 22;
    }
    getTemplateId(element) {
        if (isFileCoverage(element)) {
            return FileCoverageRenderer.ID;
        }
        if (isDeclarationCoverage(element)) {
            return DeclarationCoverageRenderer.ID;
        }
        if (element instanceof LoadingDetails || element instanceof RevealUncoveredDeclarations) {
            return BasicRenderer.ID;
        }
        if (element instanceof CurrentlyFilteredTo) {
            return CurrentlyFilteredToRenderer.ID;
        }
        assertNever(element);
    }
}
class Sorter {
    constructor(order) {
        this.order = order;
    }
    compare(a, b) {
        const order = this.order.get();
        if (isFileCoverage(a) && isFileCoverage(b)) {
            switch (order) {
                case 1 /* CoverageSortOrder.Location */:
                case 2 /* CoverageSortOrder.Name */:
                    return a.value.uri.toString().localeCompare(b.value.uri.toString());
                case 0 /* CoverageSortOrder.Coverage */:
                    return b.value.tpc - a.value.tpc;
            }
        }
        else if (isDeclarationCoverage(a) && isDeclarationCoverage(b)) {
            switch (order) {
                case 1 /* CoverageSortOrder.Location */:
                    return Position.compare(a.location instanceof Range ? a.location.getStartPosition() : a.location, b.location instanceof Range ? b.location.getStartPosition() : b.location);
                case 2 /* CoverageSortOrder.Name */:
                    return a.label.localeCompare(b.label);
                case 0 /* CoverageSortOrder.Coverage */: {
                    const attrA = a.tpc;
                    const attrB = b.tpc;
                    return (attrA !== undefined && attrB !== undefined && attrB - attrA)
                        || (+b.hits - +a.hits)
                        || a.label.localeCompare(b.label);
                }
            }
        }
        else {
            return 0;
        }
    }
}
let CurrentlyFilteredToRenderer = class CurrentlyFilteredToRenderer {
    static { CurrentlyFilteredToRenderer_1 = this; }
    static { this.ID = 'C'; }
    constructor(menuService, contextKeyService) {
        this.menuService = menuService;
        this.contextKeyService = contextKeyService;
        this.templateId = CurrentlyFilteredToRenderer_1.ID;
    }
    renderCompressedElements(node, index, templateData) {
        this.renderInner(node.element.elements[node.element.elements.length - 1], templateData);
    }
    renderTemplate(container) {
        container.classList.add('testing-stdtree-container');
        const label = dom.append(container, dom.$('.label'));
        const menu = this.menuService.getMenuActions(MenuId.TestCoverageFilterItem, this.contextKeyService, {
            shouldForwardArgs: true,
        });
        const actions = new ActionBar(container);
        actions.push(getActionBarActions(menu, 'inline').primary, { icon: true, label: false });
        actions.domNode.style.display = 'block';
        return { label, actions };
    }
    renderElement(element, index, templateData) {
        this.renderInner(element.element, templateData);
    }
    disposeTemplate(templateData) {
        templateData.actions.dispose();
    }
    renderInner(element, container) {
        container.label.innerText = element.label;
    }
};
CurrentlyFilteredToRenderer = CurrentlyFilteredToRenderer_1 = __decorate([
    __param(0, IMenuService),
    __param(1, IContextKeyService)
], CurrentlyFilteredToRenderer);
let FileCoverageRenderer = class FileCoverageRenderer {
    static { FileCoverageRenderer_1 = this; }
    static { this.ID = 'F'; }
    constructor(labels, labelService, instantiationService) {
        this.labels = labels;
        this.labelService = labelService;
        this.instantiationService = instantiationService;
        this.templateId = FileCoverageRenderer_1.ID;
    }
    /** @inheritdoc */
    renderTemplate(container) {
        const templateDisposables = new DisposableStore();
        container.classList.add('testing-stdtree-container', 'test-coverage-list-item');
        return {
            container,
            bars: templateDisposables.add(this.instantiationService.createInstance(ManagedTestCoverageBars, { compact: false, container })),
            label: templateDisposables.add(this.labels.create(container, {
                supportHighlights: true,
            })),
            elementsDisposables: templateDisposables.add(new DisposableStore()),
            templateDisposables,
        };
    }
    /** @inheritdoc */
    renderElement(node, _index, templateData) {
        this.doRender(node.element, templateData, node.filterData);
    }
    /** @inheritdoc */
    renderCompressedElements(node, _index, templateData) {
        this.doRender(node.element.elements, templateData, node.filterData);
    }
    disposeTemplate(templateData) {
        templateData.templateDisposables.dispose();
    }
    /** @inheritdoc */
    doRender(element, templateData, filterData) {
        templateData.elementsDisposables.clear();
        const stat = (element instanceof Array ? element[element.length - 1] : element);
        const file = stat.value;
        const name = element instanceof Array ? element.map(e => basenameOrAuthority(e.value.uri)) : basenameOrAuthority(file.uri);
        if (file instanceof BypassedFileCoverage) {
            templateData.bars.setCoverageInfo(undefined);
        }
        else {
            templateData.elementsDisposables.add(autorun(reader => {
                stat.value?.didChange.read(reader);
                templateData.bars.setCoverageInfo(file);
            }));
            templateData.bars.setCoverageInfo(file);
        }
        templateData.label.setResource({ resource: file.uri, name }, {
            fileKind: stat.children?.size ? FileKind.FOLDER : FileKind.FILE,
            matches: createMatches(filterData),
            separator: this.labelService.getSeparator(file.uri.scheme, file.uri.authority),
            extraClasses: ['label'],
        });
    }
};
FileCoverageRenderer = FileCoverageRenderer_1 = __decorate([
    __param(1, ILabelService),
    __param(2, IInstantiationService)
], FileCoverageRenderer);
let DeclarationCoverageRenderer = class DeclarationCoverageRenderer {
    static { DeclarationCoverageRenderer_1 = this; }
    static { this.ID = 'N'; }
    constructor(instantiationService) {
        this.instantiationService = instantiationService;
        this.templateId = DeclarationCoverageRenderer_1.ID;
    }
    /** @inheritdoc */
    renderTemplate(container) {
        const templateDisposables = new DisposableStore();
        container.classList.add('test-coverage-list-item', 'testing-stdtree-container');
        const icon = dom.append(container, dom.$('.state'));
        const label = dom.append(container, dom.$('.label'));
        return {
            container,
            bars: templateDisposables.add(this.instantiationService.createInstance(ManagedTestCoverageBars, { compact: false, container })),
            templateDisposables,
            icon,
            label,
        };
    }
    /** @inheritdoc */
    renderElement(node, _index, templateData) {
        this.doRender(node.element, templateData, node.filterData);
    }
    /** @inheritdoc */
    renderCompressedElements(node, _index, templateData) {
        this.doRender(node.element.elements[node.element.elements.length - 1], templateData, node.filterData);
    }
    disposeTemplate(templateData) {
        templateData.templateDisposables.dispose();
    }
    /** @inheritdoc */
    doRender(element, templateData, _filterData) {
        const covered = !!element.hits;
        const icon = covered ? testingWasCovered : testingStatesToIcons.get(0 /* TestResultState.Unset */);
        templateData.container.classList.toggle('not-covered', !covered);
        templateData.icon.className = `computed-state ${ThemeIcon.asClassName(icon)}`;
        templateData.label.innerText = element.label;
        templateData.bars.setCoverageInfo(element.attributableCoverage());
    }
};
DeclarationCoverageRenderer = DeclarationCoverageRenderer_1 = __decorate([
    __param(0, IInstantiationService)
], DeclarationCoverageRenderer);
class BasicRenderer {
    constructor() {
        this.templateId = BasicRenderer.ID;
    }
    static { this.ID = 'B'; }
    renderCompressedElements(node, _index, container) {
        this.renderInner(node.element.elements[node.element.elements.length - 1], container);
    }
    renderTemplate(container) {
        return container;
    }
    renderElement(node, index, container) {
        this.renderInner(node.element, container);
    }
    disposeTemplate() {
        // no-op
    }
    renderInner(element, container) {
        container.innerText = element.label;
    }
}
class TestCoverageIdentityProvider {
    getId(element) {
        return isFileCoverage(element)
            ? element.value.uri.toString()
            : element.id;
    }
}
registerAction2(class TestCoverageChangePerTestFilterAction extends Action2 {
    constructor() {
        super({
            id: "testing.coverageFilterToTest" /* TestCommandId.CoverageFilterToTest */,
            category: Categories.Test,
            title: localize2('testing.changeCoverageFilter', 'Filter Coverage by Test'),
            icon: Codicon.filter,
            toggled: {
                icon: Codicon.filterFilled,
                condition: TestingContextKeys.isCoverageFilteredToTest,
            },
            menu: [
                { id: MenuId.CommandPalette, when: TestingContextKeys.hasPerTestCoverage },
                { id: MenuId.TestCoverageFilterItem, group: 'inline' },
                {
                    id: MenuId.ViewTitle,
                    when: ContextKeyExpr.and(TestingContextKeys.hasPerTestCoverage, ContextKeyExpr.equals('view', "workbench.view.testCoverage" /* Testing.CoverageViewId */)),
                    group: 'navigation',
                },
            ]
        });
    }
    run(accessor) {
        const coverageService = accessor.get(ITestCoverageService);
        const quickInputService = accessor.get(IQuickInputService);
        const coverage = coverageService.selected.get();
        if (!coverage) {
            return;
        }
        const tests = [...coverage.allPerTestIDs()].map(TestId.fromString);
        const commonPrefix = TestId.getLengthOfCommonPrefix(tests.length, i => tests[i]);
        const result = coverage.result;
        const previousSelection = coverageService.filterToTest.get();
        const previousSelectionStr = previousSelection?.toString();
        const items = [
            { label: coverUtils.labels.allTests, id: undefined },
            { type: 'separator' },
            ...tests.map(testId => ({ label: coverUtils.getLabelForItem(result, testId, commonPrefix), testId })),
        ];
        quickInputService.pick(items, {
            activeItem: items.find((item) => 'testId' in item && item.testId?.toString() === previousSelectionStr),
            placeHolder: coverUtils.labels.pickShowCoverage,
            onDidFocus: (entry) => {
                coverageService.filterToTest.set(entry.testId, undefined);
            },
        }).then(selected => {
            coverageService.filterToTest.set(selected ? selected.testId : previousSelection, undefined);
        });
    }
});
registerAction2(class TestCoverageChangeSortingAction extends ViewAction {
    constructor() {
        super({
            id: "testing.coverageViewChangeSorting" /* TestCommandId.CoverageViewChangeSorting */,
            viewId: "workbench.view.testCoverage" /* Testing.CoverageViewId */,
            title: localize2('testing.changeCoverageSort', 'Change Sort Order'),
            icon: Codicon.sortPrecedence,
            menu: {
                id: MenuId.ViewTitle,
                when: ContextKeyExpr.equals('view', "workbench.view.testCoverage" /* Testing.CoverageViewId */),
                group: 'navigation',
                order: 1,
            }
        });
    }
    runInView(accessor, view) {
        const disposables = new DisposableStore();
        const quickInput = disposables.add(accessor.get(IQuickInputService).createQuickPick());
        const items = [
            { label: localize('testing.coverageSortByLocation', 'Sort by Location'), value: 1 /* CoverageSortOrder.Location */, description: localize('testing.coverageSortByLocationDescription', 'Files are sorted alphabetically, declarations are sorted by position') },
            { label: localize('testing.coverageSortByCoverage', 'Sort by Coverage'), value: 0 /* CoverageSortOrder.Coverage */, description: localize('testing.coverageSortByCoverageDescription', 'Files and declarations are sorted by total coverage') },
            { label: localize('testing.coverageSortByName', 'Sort by Name'), value: 2 /* CoverageSortOrder.Name */, description: localize('testing.coverageSortByNameDescription', 'Files and declarations are sorted alphabetically') },
        ];
        quickInput.placeholder = localize('testing.coverageSortPlaceholder', 'Sort the Test Coverage view...');
        quickInput.items = items;
        quickInput.show();
        disposables.add(quickInput.onDidHide(() => disposables.dispose()));
        disposables.add(quickInput.onDidAccept(() => {
            const picked = quickInput.selectedItems[0]?.value;
            if (picked !== undefined) {
                view.sortOrder.set(picked, undefined);
                quickInput.dispose();
            }
        }));
    }
});
registerAction2(class TestCoverageCollapseAllAction extends ViewAction {
    constructor() {
        super({
            id: "testing.coverageViewCollapseAll" /* TestCommandId.CoverageViewCollapseAll */,
            viewId: "workbench.view.testCoverage" /* Testing.CoverageViewId */,
            title: localize2('testing.coverageCollapseAll', 'Collapse All Coverage'),
            icon: Codicon.collapseAll,
            menu: {
                id: MenuId.ViewTitle,
                when: ContextKeyExpr.equals('view', "workbench.view.testCoverage" /* Testing.CoverageViewId */),
                group: 'navigation',
                order: 2,
            }
        });
    }
    runInView(_accessor, view) {
        view.collapseAll();
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdENvdmVyYWdlVmlldy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2Jyb3dzZXIvdGVzdENvdmVyYWdlVmlldy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFLL0UsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2hFLE9BQU8sRUFBYyxhQUFhLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN0RyxPQUFPLEVBQWUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBRTlGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUVqRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDdEUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FB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