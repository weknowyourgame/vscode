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
var TestRunElementRenderer_1;
import * as dom from '../../../../../base/browser/dom.js';
import { ActionBar } from '../../../../../base/browser/ui/actionbar/actionbar.js';
import { renderLabelWithIcons } from '../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Action, ActionRunner, Separator } from '../../../../../base/common/actions.js';
import { RunOnceScheduler } from '../../../../../base/common/async.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Iterable } from '../../../../../base/common/iterator.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { autorun } from '../../../../../base/common/observable.js';
import { count } from '../../../../../base/common/strings.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { isDefined } from '../../../../../base/common/types.js';
import { localize } from '../../../../../nls.js';
import { MenuEntryActionViewItem, fillInActionBarActions } from '../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IMenuService, MenuId, MenuItemAction } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchCompressibleObjectTree } from '../../../../../platform/list/browser/listService.js';
import { IProgressService } from '../../../../../platform/progress/common/progress.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { widgetClose } from '../../../../../platform/theme/common/iconRegistry.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { ITestCoverageService } from '../../common/testCoverageService.js';
import { ITestExplorerFilterState } from '../../common/testExplorerFilterState.js';
import { TestId } from '../../common/testId.js';
import { ITestProfileService } from '../../common/testProfileService.js';
import { LiveTestResult, maxCountPriority } from '../../common/testResult.js';
import { ITestResultService } from '../../common/testResultService.js';
import { InternalTestItem, testResultStateToContextValues } from '../../common/testTypes.js';
import { TestingContextKeys } from '../../common/testingContextKeys.js';
import { cmpPriority, isFailedState } from '../../common/testingStates.js';
import { buildTestUri } from '../../common/testingUri.js';
import { getTestItemContextOverlay } from '../explorerProjections/testItemContextOverlay.js';
import * as icons from '../icons.js';
import { renderTestMessageAsText } from '../testMessageColorizer.js';
import { MessageSubject, TaskSubject, TestOutputSubject, getMessageArgs, mapFindTestMessage } from './testResultsSubject.js';
function getTaskContext(resultId, task) {
    return { testRunName: task.name, controllerId: task.ctrlId, resultId, taskId: task.id };
}
class TestResultElement {
    get icon() {
        return icons.testingStatesToIcons.get(this.value.completedAt === undefined
            ? 2 /* TestResultState.Running */
            : maxCountPriority(this.value.counts));
    }
    constructor(value) {
        this.value = value;
        this.changeEmitter = new Emitter();
        this.onDidChange = this.changeEmitter.event;
        this.type = 'result';
        this.id = value.id;
        this.context = value.id;
        this.label = value.name;
    }
}
const openCoverageLabel = localize('openTestCoverage', 'View Test Coverage');
const closeCoverageLabel = localize('closeTestCoverage', 'Close Test Coverage');
class CoverageElement {
    get label() {
        return this.isOpen ? closeCoverageLabel : openCoverageLabel;
    }
    get icon() {
        return this.isOpen ? widgetClose : icons.testingCoverageReport;
    }
    get isOpen() {
        return this.coverageService.selected.get()?.fromTaskId === this.task.id;
    }
    constructor(results, task, coverageService) {
        this.task = task;
        this.coverageService = coverageService;
        this.type = 'coverage';
        this.id = `coverage-${results.id}/${task.id}`;
        this.onDidChange = Event.fromObservableLight(coverageService.selected);
    }
}
class OlderResultsElement {
    constructor(n) {
        this.n = n;
        this.type = 'older';
        this.onDidChange = Event.None;
        this.label = n === 1
            ? localize('oneOlderResult', '1 older result')
            : localize('nOlderResults', '{0} older results', n);
        this.id = `older-${this.n}`;
    }
}
class TestCaseElement {
    get onDidChange() {
        if (!(this.results instanceof LiveTestResult)) {
            return Event.None;
        }
        return Event.filter(this.results.onChange, e => e.item.item.extId === this.test.item.extId && e.reason !== 2 /* TestResultItemChangeReason.NewMessage */);
    }
    get state() {
        return this.test.tasks[this.taskIndex].state;
    }
    get label() {
        return this.test.item.label;
    }
    get labelWithIcons() {
        return renderLabelWithIcons(this.label);
    }
    get icon() {
        return icons.testingStatesToIcons.get(this.state);
    }
    get outputSubject() {
        return new TestOutputSubject(this.results, this.taskIndex, this.test);
    }
    constructor(results, test, taskIndex) {
        this.results = results;
        this.test = test;
        this.taskIndex = taskIndex;
        this.type = 'test';
        this.id = `${results.id}/${test.item.extId}`;
        const parentId = TestId.fromString(test.item.extId).parentId;
        if (parentId) {
            this.description = '';
            for (const part of parentId.idsToRoot()) {
                if (part.isRoot) {
                    break;
                }
                const test = results.getStateById(part.toString());
                if (!test) {
                    break;
                }
                if (this.description.length) {
                    this.description += ' \u2039 ';
                }
                this.description += test.item.label;
            }
        }
        this.context = new ActionSpreadArgs([
            {
                $mid: 16 /* MarshalledId.TestItemContext */,
                tests: [InternalTestItem.serialize(test)],
            },
            getTaskContext(results.id, results.tasks[this.taskIndex])
        ]);
    }
}
class TaskElement {
    get icon() {
        return this.results.tasks[this.index].running ? icons.testingStatesToIcons.get(2 /* TestResultState.Running */) : undefined;
    }
    constructor(results, task, index) {
        this.results = results;
        this.task = task;
        this.index = index;
        this.changeEmitter = new Emitter();
        this.onDidChange = this.changeEmitter.event;
        this.type = 'task';
        this.itemsCache = new CreationCache();
        this.id = `${results.id}/${index}`;
        this.task = results.tasks[index];
        this.context = getTaskContext(results.id, this.task);
        this.label = this.task.name;
    }
}
class TestMessageElement {
    get onDidChange() {
        if (!(this.result instanceof LiveTestResult)) {
            return Event.None;
        }
        // rerender when the test case changes so it gets retired events
        return Event.filter(this.result.onChange, e => e.item.item.extId === this.test.item.extId && e.reason !== 2 /* TestResultItemChangeReason.NewMessage */);
    }
    get context() {
        return new ActionSpreadArgs([
            getMessageArgs(this.test, this.message),
            getTaskContext(this.result.id, this.result.tasks[this.taskIndex])
        ]);
    }
    get outputSubject() {
        return new TestOutputSubject(this.result, this.taskIndex, this.test);
    }
    constructor(result, test, taskIndex, messageIndex) {
        this.result = result;
        this.test = test;
        this.taskIndex = taskIndex;
        this.messageIndex = messageIndex;
        this.type = 'message';
        const m = this.message = test.tasks[taskIndex].messages[messageIndex];
        this.location = m.location;
        this.contextValue = m.type === 0 /* TestMessageType.Error */ ? m.contextValue : undefined;
        this.uri = buildTestUri({
            type: 2 /* TestUriType.ResultMessage */,
            messageIndex,
            resultId: result.id,
            taskIndex,
            testExtId: test.item.extId
        });
        this.id = this.uri.toString();
        const asPlaintext = renderTestMessageAsText(m.message);
        const lines = count(asPlaintext.trimEnd(), '\n');
        this.label = firstLine(asPlaintext);
        if (lines > 0) {
            this.description = lines > 1
                ? localize('messageMoreLinesN', '+ {0} more lines', lines)
                : localize('messageMoreLines1', '+ 1 more line');
        }
    }
}
let OutputPeekTree = class OutputPeekTree extends Disposable {
    constructor(container, onDidReveal, options, contextMenuService, results, instantiationService, explorerFilter, coverageService, progressService, telemetryService) {
        super();
        this.onDidReveal = onDidReveal;
        this.contextMenuService = contextMenuService;
        this.disposed = false;
        this.requestReveal = this._register(new Emitter());
        this.contextMenuActionRunner = this._register(new SpreadableActionRunner());
        this.onDidRequestReview = this.requestReveal.event;
        this.treeActions = instantiationService.createInstance(TreeActionsProvider, options.showRevealLocationOnMessages, this.requestReveal);
        const diffIdentityProvider = {
            getId(e) {
                return e.id;
            }
        };
        this.tree = this._register(instantiationService.createInstance(WorkbenchCompressibleObjectTree, 'Test Output Peek', container, {
            getHeight: () => 22,
            getTemplateId: () => TestRunElementRenderer.ID,
        }, [instantiationService.createInstance(TestRunElementRenderer, this.treeActions)], {
            compressionEnabled: true,
            hideTwistiesOfChildlessElements: true,
            identityProvider: diffIdentityProvider,
            alwaysConsumeMouseWheel: false,
            sorter: {
                compare(a, b) {
                    if (a instanceof TestCaseElement && b instanceof TestCaseElement) {
                        return cmpPriority(a.state, b.state);
                    }
                    return 0;
                },
            },
            accessibilityProvider: {
                getAriaLabel(element) {
                    return element.ariaLabel || element.label;
                },
                getWidgetAriaLabel() {
                    return localize('testingPeekLabel', 'Test Result Messages');
                }
            }
        }));
        const cc = new CreationCache();
        const getTaskChildren = (taskElem) => {
            const { results, index, itemsCache, task } = taskElem;
            const tests = Iterable.filter(results.tests, test => test.tasks[index].state >= 2 /* TestResultState.Running */ || test.tasks[index].messages.length > 0);
            let result = Iterable.map(tests, test => ({
                element: itemsCache.getOrCreate(test, () => new TestCaseElement(results, test, index)),
                incompressible: true,
                children: getTestChildren(results, test, index),
            }));
            if (task.coverage.get()) {
                result = Iterable.concat(Iterable.single({
                    element: new CoverageElement(results, task, coverageService),
                    collapsible: true,
                    incompressible: true,
                }), result);
            }
            return result;
        };
        const getTestChildren = (result, test, taskIndex) => {
            return test.tasks[taskIndex].messages
                .map((m, messageIndex) => m.type === 0 /* TestMessageType.Error */
                ? { element: cc.getOrCreate(m, () => new TestMessageElement(result, test, taskIndex, messageIndex)), incompressible: false }
                : undefined)
                .filter(isDefined);
        };
        const getResultChildren = (result) => {
            return result.tasks.map((task, taskIndex) => {
                const taskElem = cc.getOrCreate(task, () => new TaskElement(result, task, taskIndex));
                return ({
                    element: taskElem,
                    incompressible: false,
                    collapsible: true,
                    children: getTaskChildren(taskElem),
                });
            });
        };
        const getRootChildren = () => {
            let children = [];
            const older = [];
            for (const result of results.results) {
                if (!children.length && result.tasks.length) {
                    children = getResultChildren(result);
                }
                else if (children) {
                    const element = cc.getOrCreate(result, () => new TestResultElement(result));
                    older.push({
                        element,
                        incompressible: true,
                        collapsible: true,
                        collapsed: this.tree.hasElement(element) ? this.tree.isCollapsed(element) : true,
                        children: getResultChildren(result)
                    });
                }
            }
            if (!children.length) {
                return older;
            }
            if (older.length) {
                children.push({
                    element: new OlderResultsElement(older.length),
                    incompressible: true,
                    collapsible: true,
                    collapsed: true,
                    children: older,
                });
            }
            return children;
        };
        // Queued result updates to prevent spamming CPU when lots of tests are
        // completing and messaging quickly (#142514)
        const taskChildrenToUpdate = new Set();
        const taskChildrenUpdate = this._register(new RunOnceScheduler(() => {
            for (const taskNode of taskChildrenToUpdate) {
                if (this.tree.hasElement(taskNode)) {
                    this.tree.setChildren(taskNode, getTaskChildren(taskNode), { diffIdentityProvider });
                }
            }
            taskChildrenToUpdate.clear();
        }, 300));
        const queueTaskChildrenUpdate = (taskNode) => {
            taskChildrenToUpdate.add(taskNode);
            if (!taskChildrenUpdate.isScheduled()) {
                taskChildrenUpdate.schedule();
            }
        };
        const attachToResults = (result) => {
            const disposable = new DisposableStore();
            disposable.add(result.onNewTask(i => {
                this.tree.setChildren(null, getRootChildren(), { diffIdentityProvider });
                if (result.tasks.length === 1) {
                    this.requestReveal.fire(new TaskSubject(result, 0)); // reveal the first task in new runs
                }
                // note: tasks are bounded and their lifetime is equivalent to that of
                // the test result, so this doesn't leak indefinitely.
                const task = result.tasks[i];
                disposable.add(autorun(reader => {
                    task.coverage.read(reader); // add it to the autorun
                    queueTaskChildrenUpdate(cc.get(task));
                }));
            }));
            disposable.add(result.onEndTask(index => {
                cc.get(result.tasks[index])?.changeEmitter.fire();
            }));
            disposable.add(result.onChange(e => {
                // try updating the item in each of its tasks
                for (const [index, task] of result.tasks.entries()) {
                    const taskNode = cc.get(task);
                    if (!this.tree.hasElement(taskNode)) {
                        continue;
                    }
                    const itemNode = taskNode.itemsCache.get(e.item);
                    if (itemNode && this.tree.hasElement(itemNode)) {
                        if (e.reason === 2 /* TestResultItemChangeReason.NewMessage */ && e.message.type === 0 /* TestMessageType.Error */) {
                            this.tree.setChildren(itemNode, getTestChildren(result, e.item, index), { diffIdentityProvider });
                        }
                        return;
                    }
                    queueTaskChildrenUpdate(taskNode);
                }
            }));
            disposable.add(result.onComplete(() => {
                cc.get(result)?.changeEmitter.fire();
                disposable.dispose();
            }));
        };
        this._register(results.onResultsChanged(e => {
            // little hack here: a result change can cause the peek to be disposed,
            // but this listener will still be queued. Doing stuff with the tree
            // will cause errors.
            if (this.disposed) {
                return;
            }
            if ('completed' in e) {
                cc.get(e.completed)?.changeEmitter.fire();
            }
            else if ('started' in e) {
                attachToResults(e.started);
            }
            else {
                this.tree.setChildren(null, getRootChildren(), { diffIdentityProvider });
            }
        }));
        const revealItem = (element, preserveFocus) => {
            this.tree.setFocus([element]);
            this.tree.setSelection([element]);
            if (!preserveFocus) {
                this.tree.domFocus();
            }
        };
        this._register(onDidReveal(async ({ subject, preserveFocus = false }) => {
            if (subject instanceof TaskSubject) {
                const resultItem = this.tree.getNode(null).children.find(c => {
                    if (c.element instanceof TaskElement) {
                        return c.element.results.id === subject.result.id && c.element.index === subject.taskIndex;
                    }
                    if (c.element instanceof TestResultElement) {
                        return c.element.id === subject.result.id;
                    }
                    return false;
                });
                if (resultItem) {
                    revealItem(resultItem.element, preserveFocus);
                }
                return;
            }
            const revealElement = subject instanceof TestOutputSubject
                ? cc.get(subject.task)?.itemsCache.get(subject.test)
                : cc.get(subject.message);
            if (!revealElement || !this.tree.hasElement(revealElement)) {
                return;
            }
            const parents = [];
            for (let parent = this.tree.getParentElement(revealElement); parent; parent = this.tree.getParentElement(parent)) {
                parents.unshift(parent);
            }
            for (const parent of parents) {
                this.tree.expand(parent);
            }
            if (this.tree.getRelativeTop(revealElement) === null) {
                this.tree.reveal(revealElement, 0.5);
            }
            revealItem(revealElement, preserveFocus);
        }));
        this._register(this.tree.onDidOpen(async (e) => {
            if (e.element instanceof TestMessageElement) {
                this.requestReveal.fire(new MessageSubject(e.element.result, e.element.test, e.element.taskIndex, e.element.messageIndex));
            }
            else if (e.element instanceof TestCaseElement) {
                const t = e.element;
                const message = mapFindTestMessage(e.element.test, (_t, _m, mesasgeIndex, taskIndex) => new MessageSubject(t.results, t.test, taskIndex, mesasgeIndex));
                this.requestReveal.fire(message || new TestOutputSubject(t.results, 0, t.test));
            }
            else if (e.element instanceof CoverageElement) {
                const task = e.element.task;
                if (e.element.isOpen) {
                    return coverageService.closeCoverage();
                }
                progressService.withProgress({ location: options.locationForProgress }, () => coverageService.openCoverage(task, true));
            }
        }));
        this._register(this.tree.onDidChangeSelection(evt => {
            for (const element of evt.elements) {
                if (element && 'test' in element) {
                    explorerFilter.reveal.set(element.test.item.extId, undefined);
                    break;
                }
            }
        }));
        this._register(explorerFilter.onDidSelectTestInExplorer(testId => {
            if (this.tree.getSelection().some(e => e && 'test' in e && e.test.item.extId === testId)) {
                return;
            }
            for (const node of this.tree.getNode(null).children) {
                if (node.element instanceof TaskElement) {
                    for (const testNode of node.children) {
                        if (testNode.element instanceof TestCaseElement && testNode.element.test.item.extId === testId) {
                            this.tree.setSelection([testNode.element]);
                            if (this.tree.getRelativeTop(testNode.element) === null) {
                                this.tree.reveal(testNode.element, 0.5);
                            }
                            break;
                        }
                    }
                }
            }
        }));
        this._register(this.tree.onContextMenu(e => this.onContextMenu(e)));
        this._register(this.tree.onDidChangeCollapseState(e => {
            if (e.node.element instanceof OlderResultsElement && !e.node.collapsed) {
                telemetryService.publicLog2('testing.expandOlderResults');
            }
        }));
        this.tree.setChildren(null, getRootChildren());
        for (const result of results.results) {
            if (!result.completedAt && result instanceof LiveTestResult) {
                attachToResults(result);
            }
        }
    }
    layout(height, width) {
        this.tree.layout(height, width);
    }
    onContextMenu(evt) {
        if (!evt.element) {
            return;
        }
        const actions = this.treeActions.provideActionBar(evt.element);
        this.contextMenuService.showContextMenu({
            getAnchor: () => evt.anchor,
            getActions: () => actions.secondary.length
                ? [...actions.primary, new Separator(), ...actions.secondary]
                : actions.primary,
            getActionsContext: () => evt.element?.context,
            actionRunner: this.contextMenuActionRunner,
        });
    }
    dispose() {
        super.dispose();
        this.disposed = true;
    }
};
OutputPeekTree = __decorate([
    __param(3, IContextMenuService),
    __param(4, ITestResultService),
    __param(5, IInstantiationService),
    __param(6, ITestExplorerFilterState),
    __param(7, ITestCoverageService),
    __param(8, IProgressService),
    __param(9, ITelemetryService)
], OutputPeekTree);
export { OutputPeekTree };
let TestRunElementRenderer = class TestRunElementRenderer {
    static { TestRunElementRenderer_1 = this; }
    static { this.ID = 'testRunElementRenderer'; }
    constructor(treeActions, instantiationService) {
        this.treeActions = treeActions;
        this.instantiationService = instantiationService;
        this.templateId = TestRunElementRenderer_1.ID;
    }
    /** @inheritdoc */
    renderCompressedElements(node, _index, templateData) {
        const chain = node.element.elements;
        const lastElement = chain[chain.length - 1];
        if ((lastElement instanceof TaskElement || lastElement instanceof TestMessageElement) && chain.length >= 2) {
            this.doRender(chain[chain.length - 2], templateData, lastElement);
        }
        else {
            this.doRender(lastElement, templateData);
        }
    }
    /** @inheritdoc */
    renderTemplate(container) {
        const templateDisposable = new DisposableStore();
        container.classList.add('testing-stdtree-container');
        const icon = dom.append(container, dom.$('.state'));
        const label = dom.append(container, dom.$('.label'));
        const actionBar = new ActionBar(container, {
            actionRunner: templateDisposable.add(new SpreadableActionRunner()),
            actionViewItemProvider: (action, options) => action instanceof MenuItemAction
                ? this.instantiationService.createInstance(MenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate })
                : undefined
        });
        const elementDisposable = new DisposableStore();
        templateDisposable.add(elementDisposable);
        templateDisposable.add(actionBar);
        return {
            icon,
            label,
            actionBar,
            elementDisposable,
            templateDisposable,
        };
    }
    /** @inheritdoc */
    renderElement(element, _index, templateData) {
        this.doRender(element.element, templateData);
    }
    /** @inheritdoc */
    disposeTemplate(templateData) {
        templateData.templateDisposable.dispose();
    }
    /** Called to render a new element */
    doRender(element, templateData, subjectElement) {
        templateData.elementDisposable.clear();
        templateData.elementDisposable.add(element.onDidChange(() => this.doRender(element, templateData, subjectElement)));
        this.doRenderInner(element, templateData, subjectElement);
    }
    /** Called, and may be re-called, to render or re-render an element */
    doRenderInner(element, templateData, subjectElement) {
        let { label, labelWithIcons, description } = element;
        if (subjectElement instanceof TestMessageElement) {
            description = subjectElement.label;
            if (element.description) {
                description = `${description} @ ${element.description}`;
            }
        }
        const descriptionElement = description ? dom.$('span.test-label-description', {}, description) : '';
        if (labelWithIcons) {
            dom.reset(templateData.label, ...labelWithIcons, descriptionElement);
        }
        else {
            dom.reset(templateData.label, label, descriptionElement);
        }
        const icon = element.icon;
        templateData.icon.className = `computed-state ${icon ? ThemeIcon.asClassName(icon) : ''}`;
        const actions = this.treeActions.provideActionBar(element);
        templateData.actionBar.clear();
        templateData.actionBar.context = element.context;
        templateData.actionBar.push(actions.primary, { icon: true, label: false });
    }
};
TestRunElementRenderer = TestRunElementRenderer_1 = __decorate([
    __param(1, IInstantiationService)
], TestRunElementRenderer);
let TreeActionsProvider = class TreeActionsProvider {
    constructor(showRevealLocationOnMessages, requestReveal, contextKeyService, menuService, commandService, testProfileService, editorService) {
        this.showRevealLocationOnMessages = showRevealLocationOnMessages;
        this.requestReveal = requestReveal;
        this.contextKeyService = contextKeyService;
        this.menuService = menuService;
        this.commandService = commandService;
        this.testProfileService = testProfileService;
        this.editorService = editorService;
    }
    provideActionBar(element) {
        const test = element instanceof TestCaseElement ? element.test : undefined;
        const capabilities = test ? this.testProfileService.capabilitiesForTest(test.item) : 0;
        const contextKeys = [
            ['peek', "editor.contrib.testingOutputPeek" /* Testing.OutputPeekContributionId */],
            [TestingContextKeys.peekItemType.key, element.type],
        ];
        let id = MenuId.TestPeekElement;
        const primary = [];
        const secondary = [];
        if (element instanceof TaskElement) {
            primary.push(new Action('testing.outputPeek.showResultOutput', localize('testing.showResultOutput', "Show Result Output"), ThemeIcon.asClassName(Codicon.terminal), undefined, () => this.requestReveal.fire(new TaskSubject(element.results, element.index))));
            if (element.task.running) {
                primary.push(new Action('testing.outputPeek.cancel', localize('testing.cancelRun', 'Cancel Test Run'), ThemeIcon.asClassName(icons.testingCancelIcon), undefined, () => this.commandService.executeCommand("testing.cancelRun" /* TestCommandId.CancelTestRunAction */, element.results.id, element.task.id)));
            }
            else {
                primary.push(new Action('testing.outputPeek.rerun', localize('testing.reRunLastRun', 'Rerun Last Run'), ThemeIcon.asClassName(icons.testingRerunIcon), undefined, () => this.commandService.executeCommand("testing.reRunLastRun" /* TestCommandId.ReRunLastRun */, element.results.id)));
                const hasFailedTests = Iterable.some(element.results.tests, test => isFailedState(test.ownComputedState));
                if (hasFailedTests) {
                    primary.push(new Action('testing.outputPeek.rerunFailed', localize('testing.reRunFailedFromLastRun', 'Rerun Failed Tests'), ThemeIcon.asClassName(icons.testingRerunIcon), undefined, () => this.commandService.executeCommand("testing.reRunFailedFromLastRun" /* TestCommandId.ReRunFailedFromLastRun */, element.results.id)));
                }
                primary.push(new Action('testing.outputPeek.debug', localize('testing.debugLastRun', 'Debug Last Run'), ThemeIcon.asClassName(icons.testingDebugIcon), undefined, () => this.commandService.executeCommand("testing.debugLastRun" /* TestCommandId.DebugLastRun */, element.results.id)));
                if (hasFailedTests) {
                    primary.push(new Action('testing.outputPeek.debugFailed', localize('testing.debugFailedFromLastRun', 'Debug Failed Tests'), ThemeIcon.asClassName(icons.testingDebugIcon), undefined, () => this.commandService.executeCommand("testing.debugFailedFromLastRun" /* TestCommandId.DebugFailedFromLastRun */, element.results.id)));
                }
            }
        }
        if (element instanceof TestResultElement) {
            // only show if there are no collapsed test nodes that have more specific choices
            if (element.value.tasks.length === 1) {
                primary.push(new Action('testing.outputPeek.showResultOutput', localize('testing.showResultOutput', "Show Result Output"), ThemeIcon.asClassName(Codicon.terminal), undefined, () => this.requestReveal.fire(new TaskSubject(element.value, 0))));
            }
            primary.push(new Action('testing.outputPeek.reRunLastRun', localize('testing.reRunTest', "Rerun Test"), ThemeIcon.asClassName(icons.testingRunIcon), undefined, () => this.commandService.executeCommand('testing.reRunLastRun', element.value.id)));
            const hasFailedTests = Iterable.some(element.value.tests, test => isFailedState(test.ownComputedState));
            if (hasFailedTests) {
                primary.push(new Action('testing.outputPeek.rerunFailedResult', localize('testing.reRunFailedFromLastRun', 'Rerun Failed Tests'), ThemeIcon.asClassName(icons.testingRerunIcon), undefined, () => this.commandService.executeCommand("testing.reRunFailedFromLastRun" /* TestCommandId.ReRunFailedFromLastRun */, element.value.id)));
            }
            if (capabilities & 4 /* TestRunProfileBitset.Debug */) {
                primary.push(new Action('testing.outputPeek.debugLastRun', localize('testing.debugTest', "Debug Test"), ThemeIcon.asClassName(icons.testingDebugIcon), undefined, () => this.commandService.executeCommand('testing.debugLastRun', element.value.id)));
                if (hasFailedTests) {
                    primary.push(new Action('testing.outputPeek.debugFailedResult', localize('testing.debugFailedFromLastRun', 'Debug Failed Tests'), ThemeIcon.asClassName(icons.testingDebugIcon), undefined, () => this.commandService.executeCommand("testing.debugFailedFromLastRun" /* TestCommandId.DebugFailedFromLastRun */, element.value.id)));
                }
            }
        }
        if (element instanceof TestCaseElement || element instanceof TestMessageElement) {
            contextKeys.push([TestingContextKeys.testResultOutdated.key, element.test.retired], [TestingContextKeys.testResultState.key, testResultStateToContextValues[element.test.ownComputedState]], ...getTestItemContextOverlay(element.test, capabilities));
            const { extId, uri } = element.test.item;
            if (uri) {
                primary.push(new Action('testing.outputPeek.goToTest', localize('testing.goToTest', "Go to Test"), ThemeIcon.asClassName(Codicon.goToFile), undefined, () => this.commandService.executeCommand('vscode.revealTest', extId)));
            }
            if (element.test.tasks[element.taskIndex].messages.some(m => m.type === 1 /* TestMessageType.Output */)) {
                primary.push(new Action('testing.outputPeek.showResultOutput', localize('testing.showResultOutput', "Show Result Output"), ThemeIcon.asClassName(Codicon.terminal), undefined, () => this.requestReveal.fire(element.outputSubject)));
            }
            secondary.push(new Action('testing.outputPeek.revealInExplorer', localize('testing.revealInExplorer', "Reveal in Test Explorer"), ThemeIcon.asClassName(Codicon.listTree), undefined, () => this.commandService.executeCommand('_revealTestInExplorer', extId)));
            if (capabilities & 2 /* TestRunProfileBitset.Run */) {
                primary.push(new Action('testing.outputPeek.runTest', localize('run test', 'Run Test'), ThemeIcon.asClassName(icons.testingRunIcon), undefined, () => this.commandService.executeCommand('vscode.runTestsById', 2 /* TestRunProfileBitset.Run */, extId)));
            }
            if (capabilities & 4 /* TestRunProfileBitset.Debug */) {
                primary.push(new Action('testing.outputPeek.debugTest', localize('debug test', 'Debug Test'), ThemeIcon.asClassName(icons.testingDebugIcon), undefined, () => this.commandService.executeCommand('vscode.runTestsById', 4 /* TestRunProfileBitset.Debug */, extId)));
            }
        }
        if (element instanceof TestMessageElement) {
            id = MenuId.TestMessageContext;
            contextKeys.push([TestingContextKeys.testMessageContext.key, element.contextValue]);
            if (this.showRevealLocationOnMessages && element.location) {
                primary.push(new Action('testing.outputPeek.goToError', localize('testing.goToError', "Go to Error"), ThemeIcon.asClassName(Codicon.debugStackframe), undefined, () => this.editorService.openEditor({
                    resource: element.location.uri,
                    options: {
                        selection: element.location.range,
                        preserveFocus: true,
                    }
                })));
            }
        }
        const contextOverlay = this.contextKeyService.createOverlay(contextKeys);
        const result = { primary, secondary };
        const menu = this.menuService.getMenuActions(id, contextOverlay, { shouldForwardArgs: true });
        fillInActionBarActions(menu, result, 'inline');
        return result;
    }
};
TreeActionsProvider = __decorate([
    __param(2, IContextKeyService),
    __param(3, IMenuService),
    __param(4, ICommandService),
    __param(5, ITestProfileService),
    __param(6, IEditorService)
], TreeActionsProvider);
class CreationCache {
    constructor() {
        this.v = new WeakMap();
    }
    get(key) {
        return this.v.get(key);
    }
    getOrCreate(ref, factory) {
        const existing = this.v.get(ref);
        if (existing) {
            return existing;
        }
        const fresh = factory();
        this.v.set(ref, fresh);
        return fresh;
    }
}
const firstLine = (str) => {
    const index = str.indexOf('\n');
    return index === -1 ? str : str.slice(0, index);
};
class ActionSpreadArgs {
    constructor(value) {
        this.value = value;
    }
}
class SpreadableActionRunner extends ActionRunner {
    async runAction(action, context) {
        if (context instanceof ActionSpreadArgs) {
            await action.run(...context.value);
        }
        else {
            await action.run(context);
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdFJlc3VsdHNUcmVlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlc3RpbmcvYnJvd3Nlci90ZXN0UmVzdWx0c1ZpZXcvdGVzdFJlc3VsdHNUcmVlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9DQUFvQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNsRixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUs5RixPQUFPLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBVyxTQUFTLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNqRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUVyRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUV0RixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQzlELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFaEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxzQkFBc0IsRUFB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