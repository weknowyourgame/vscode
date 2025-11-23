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
var TestResultsViewContent_1;
import * as dom from '../../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../../base/browser/keyboardEvent.js';
import { renderLabelWithIcons } from '../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Sizing, SplitView } from '../../../../../base/browser/ui/splitview/splitview.js';
import { findAsync } from '../../../../../base/common/arrays.js';
import { Limiter } from '../../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { Emitter, Event, Relay } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../../nls.js';
import { FloatingClickMenu } from '../../../../../platform/actions/browser/floatingMenu.js';
import { createActionViewItem } from '../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { MenuWorkbenchToolBar } from '../../../../../platform/actions/browser/toolbar.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { CallStackFrame, CallStackWidget, CustomStackFrame } from '../../../debug/browser/callStackWidget.js';
import { getTestingConfiguration } from '../../common/configuration.js';
import { capabilityContextKeys, ITestProfileService } from '../../common/testProfileService.js';
import { LiveTestResult } from '../../common/testResult.js';
import { ITestService } from '../../common/testService.js';
import { TestingContextKeys } from '../../common/testingContextKeys.js';
import * as icons from '../icons.js';
import { DiffContentProvider, MarkdownTestMessagePeek, PlainTextMessagePeek, TerminalMessagePeek } from './testResultsOutput.js';
import { equalsSubject, getSubjectTestItem, MessageSubject, TaskSubject, TestOutputSubject } from './testResultsSubject.js';
import { OutputPeekTree } from './testResultsTree.js';
import './testResultsViewContent.css';
let MessageStackFrame = class MessageStackFrame extends CustomStackFrame {
    constructor(message, followup, subject, instantiationService, contextKeyService, profileService) {
        super();
        this.message = message;
        this.followup = followup;
        this.subject = subject;
        this.instantiationService = instantiationService;
        this.contextKeyService = contextKeyService;
        this.profileService = profileService;
        this.height = observableValue('MessageStackFrame.height', 100);
        this.icon = icons.testingViewIcon;
        this.label = subject instanceof MessageSubject
            ? subject.test.label
            : subject instanceof TestOutputSubject
                ? subject.test.item.label
                : subject.result.name;
    }
    render(container) {
        this.message.style.visibility = 'visible';
        container.appendChild(this.message);
        return toDisposable(() => this.message.remove());
    }
    renderActions(container) {
        const store = new DisposableStore();
        container.appendChild(this.followup.domNode);
        store.add(toDisposable(() => this.followup.domNode.remove()));
        const test = getSubjectTestItem(this.subject);
        const capabilities = test && this.profileService.capabilitiesForTest(test);
        let contextKeyService;
        if (capabilities) {
            contextKeyService = this.contextKeyService.createOverlay(capabilityContextKeys(capabilities));
        }
        else {
            const profiles = this.profileService.getControllerProfiles(this.subject.controllerId);
            contextKeyService = this.contextKeyService.createOverlay([
                [TestingContextKeys.hasRunnableTests.key, profiles.some(p => p.group & 2 /* TestRunProfileBitset.Run */)],
                [TestingContextKeys.hasDebuggableTests.key, profiles.some(p => p.group & 4 /* TestRunProfileBitset.Debug */)],
            ]);
        }
        const instaService = store.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
        const toolbar = store.add(instaService.createInstance(MenuWorkbenchToolBar, container, MenuId.TestCallStack, {
            menuOptions: { shouldForwardArgs: true },
            actionViewItemProvider: (action, options) => createActionViewItem(this.instantiationService, action, options),
        }));
        toolbar.context = this.subject;
        store.add(toolbar);
        return store;
    }
};
MessageStackFrame = __decorate([
    __param(3, IInstantiationService),
    __param(4, IContextKeyService),
    __param(5, ITestProfileService)
], MessageStackFrame);
function runInLast(accessor, bitset, subject) {
    // Let the full command do its thing if we want to run the whole set of tests
    if (subject instanceof TaskSubject) {
        return accessor.get(ICommandService).executeCommand(bitset === 4 /* TestRunProfileBitset.Debug */ ? "testing.debugLastRun" /* TestCommandId.DebugLastRun */ : "testing.reRunLastRun" /* TestCommandId.ReRunLastRun */, subject.result.id);
    }
    const testService = accessor.get(ITestService);
    const plainTest = subject instanceof MessageSubject ? subject.test : subject.test.item;
    const currentTest = testService.collection.getNodeById(plainTest.extId);
    if (!currentTest) {
        return;
    }
    return testService.runTests({
        group: bitset,
        tests: [currentTest],
    });
}
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'testing.callStack.run',
            title: localize('testing.callStack.run', "Rerun Test"),
            icon: icons.testingRunIcon,
            menu: {
                id: MenuId.TestCallStack,
                when: TestingContextKeys.hasRunnableTests,
                group: 'navigation',
            },
        });
    }
    run(accessor, subject) {
        runInLast(accessor, 2 /* TestRunProfileBitset.Run */, subject);
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'testing.callStack.debug',
            title: localize('testing.callStack.debug', "Debug Test"),
            icon: icons.testingDebugIcon,
            menu: {
                id: MenuId.TestCallStack,
                when: TestingContextKeys.hasDebuggableTests,
                group: 'navigation',
            },
        });
    }
    run(accessor, subject) {
        runInLast(accessor, 4 /* TestRunProfileBitset.Debug */, subject);
    }
});
let TestResultsViewContent = class TestResultsViewContent extends Disposable {
    static { TestResultsViewContent_1 = this; }
    get uiState() {
        return {
            splitViewWidths: Array.from({ length: this.splitView.length }, (_, i) => this.splitView.getViewSize(i)),
        };
    }
    get onDidChangeContentHeight() {
        return this.callStackWidget.onDidChangeContentHeight;
    }
    get contentHeight() {
        return this.callStackWidget?.contentHeight || 0;
    }
    get diffViewIndex() {
        return this.isTreeLeft ? 1 : 0; // Content view index
    }
    get historyViewIndex() {
        return this.isTreeLeft ? 0 : 1; // Tree view index
    }
    constructor(editor, options, instantiationService, modelService, contextKeyService, uriIdentityService, configurationService) {
        super();
        this.editor = editor;
        this.options = options;
        this.instantiationService = instantiationService;
        this.modelService = modelService;
        this.contextKeyService = contextKeyService;
        this.uriIdentityService = uriIdentityService;
        this.configurationService = configurationService;
        this.didReveal = this._register(new Emitter());
        this.currentSubjectStore = this._register(new DisposableStore());
        this.onCloseEmitter = this._register(new Relay());
        this.contentProvidersUpdateLimiter = this._register(new Limiter(1));
        this.isTreeLeft = false; // Track layout setting
        this.onClose = this.onCloseEmitter.event;
    }
    swapViews() {
        const leftSize = this.splitView.getViewSize(0);
        const rightSize = this.splitView.getViewSize(1);
        const leftView = this.splitView.removeView(1);
        const rightView = this.splitView.removeView(0);
        this.splitView.addView(leftView, rightSize);
        this.splitView.addView(rightView, leftSize);
    }
    fillBody(containerElement) {
        const initialSpitWidth = TestResultsViewContent_1.lastSplitWidth;
        this.splitView = new SplitView(containerElement, { orientation: 1 /* Orientation.HORIZONTAL */ });
        const { historyVisible, showRevealLocationOnMessages } = this.options;
        const isInPeekView = this.editor !== undefined;
        const layout = getTestingConfiguration(this.configurationService, "testing.resultsView.layout" /* TestingConfigKeys.ResultsViewLayout */);
        this.isTreeLeft = layout === "treeLeft" /* TestingResultsViewLayout.TreeLeft */;
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("testing.resultsView.layout" /* TestingConfigKeys.ResultsViewLayout */)) {
                const newLayout = getTestingConfiguration(this.configurationService, "testing.resultsView.layout" /* TestingConfigKeys.ResultsViewLayout */);
                const newIsTreeLeft = newLayout === "treeLeft" /* TestingResultsViewLayout.TreeLeft */;
                if (newIsTreeLeft !== this.isTreeLeft) {
                    this.isTreeLeft = newIsTreeLeft;
                    this.swapViews();
                }
            }
        }));
        const messageContainer = this.messageContainer = dom.$('.test-output-peek-message-container');
        this.stackContainer = dom.append(containerElement, dom.$('.test-output-call-stack-container'));
        this.callStackWidget = this._register(this.instantiationService.createInstance(CallStackWidget, this.stackContainer, this.editor));
        this.followupWidget = this._register(this.instantiationService.createInstance(FollowupActionWidget, this.editor));
        this.onCloseEmitter.input = this.followupWidget.onClose;
        this.contentProviders = [
            this._register(this.instantiationService.createInstance(DiffContentProvider, this.editor, messageContainer)),
            this._register(this.instantiationService.createInstance(MarkdownTestMessagePeek, messageContainer)),
            this._register(this.instantiationService.createInstance(TerminalMessagePeek, messageContainer, isInPeekView)),
            this._register(this.instantiationService.createInstance(PlainTextMessagePeek, this.editor, messageContainer)),
        ];
        this.messageContextKeyService = this._register(this.contextKeyService.createScoped(containerElement));
        this.contextKeyTestMessage = TestingContextKeys.testMessageContext.bindTo(this.messageContextKeyService);
        this.contextKeyResultOutdated = TestingContextKeys.testResultOutdated.bindTo(this.messageContextKeyService);
        const treeContainer = dom.append(containerElement, dom.$('.test-output-peek-tree.testing-stdtree'));
        const tree = this._register(this.instantiationService.createInstance(OutputPeekTree, treeContainer, this.didReveal.event, { showRevealLocationOnMessages, locationForProgress: this.options.locationForProgress }));
        this.onDidRequestReveal = tree.onDidRequestReview;
        // Add views in the correct order based on layout setting
        const stackView = {
            onDidChange: Event.None,
            element: this.stackContainer,
            minimumSize: 200,
            maximumSize: Number.MAX_VALUE,
            layout: (width) => {
                TestResultsViewContent_1.lastSplitWidth = width;
                if (this.dimension) {
                    this.callStackWidget?.layout(this.dimension.height, width);
                    this.layoutContentWidgets(this.dimension, width);
                }
            },
        };
        const treeView = {
            onDidChange: Event.None,
            element: treeContainer,
            minimumSize: 100,
            maximumSize: Number.MAX_VALUE,
            layout: (width) => {
                if (this.dimension) {
                    tree.layout(this.dimension.height, width);
                }
            },
        };
        this.splitView.addView(stackView, Sizing.Distribute);
        this.splitView.addView(treeView, Sizing.Distribute);
        if (this.isTreeLeft) {
            this.swapViews();
        }
        // Configure visibility for the tree view
        this.splitView.setViewVisible(this.historyViewIndex, historyVisible.value);
        this._register(historyVisible.onDidChange(visible => {
            this.splitView.setViewVisible(this.historyViewIndex, visible);
        }));
        if (initialSpitWidth) {
            queueMicrotask(() => this.splitView.resizeView(this.diffViewIndex, initialSpitWidth));
        }
    }
    /**
     * Shows a message in-place without showing or changing the peek location.
     * This is mostly used if peeking a message without a location.
     */
    reveal(opts) {
        this.didReveal.fire(opts);
        if (this.current && equalsSubject(this.current, opts.subject)) {
            return Promise.resolve();
        }
        this.current = opts.subject;
        return this.contentProvidersUpdateLimiter.queue(async () => {
            this.currentSubjectStore.clear();
            const callFrames = this.getCallFrames(opts.subject) || [];
            const topFrame = await this.prepareTopFrame(opts.subject, callFrames);
            this.setCallStackFrames(topFrame, callFrames);
            this.followupWidget.show(opts.subject);
            this.populateFloatingClick(opts.subject);
        });
    }
    setCallStackFrames(messageFrame, stack) {
        this.callStackWidget.setFrames([messageFrame, ...stack.map(frame => new CallStackFrame(frame.label, frame.uri, frame.position?.lineNumber, frame.position?.column))]);
    }
    /**
     * Collapses all displayed stack frames.
     */
    collapseStack() {
        this.callStackWidget.collapseAll();
    }
    getCallFrames(subject) {
        if (!(subject instanceof MessageSubject)) {
            return undefined;
        }
        const frames = subject.stack;
        if (!frames?.length || !this.editor) {
            return frames;
        }
        // If the test extension just sets the top frame as the same location
        // where the message is displayed, in the case of a peek in an editor,
        // don't show it again because it's just a duplicate
        const topFrame = frames[0];
        const peekLocation = subject.revealLocation;
        const isTopFrameSame = peekLocation && topFrame.position && topFrame.uri
            && topFrame.position.lineNumber === peekLocation.range.startLineNumber
            && topFrame.position.column === peekLocation.range.startColumn
            && this.uriIdentityService.extUri.isEqual(topFrame.uri, peekLocation.uri);
        return isTopFrameSame ? frames.slice(1) : frames;
    }
    async prepareTopFrame(subject, callFrames) {
        // ensure the messageContainer is in the DOM so renderers can calculate the
        // dimensions before it's rendered in the list.
        this.messageContainer.style.visibility = 'hidden';
        this.stackContainer.appendChild(this.messageContainer);
        const topFrame = this.currentTopFrame = this.instantiationService.createInstance(MessageStackFrame, this.messageContainer, this.followupWidget, subject);
        const hasMultipleFrames = callFrames.length > 0;
        topFrame.showHeader.set(hasMultipleFrames, undefined);
        const provider = await findAsync(this.contentProviders, p => p.update(subject));
        if (provider) {
            const width = this.splitView.getViewSize(this.diffViewIndex);
            if (width !== -1 && this.dimension) {
                topFrame.height.set(provider.layout({ width, height: this.dimension?.height }, hasMultipleFrames), undefined);
            }
            if (provider.onScrolled) {
                this.currentSubjectStore.add(this.callStackWidget.onDidScroll(evt => {
                    provider.onScrolled(evt);
                }));
            }
            if (provider.onDidContentSizeChange) {
                this.currentSubjectStore.add(provider.onDidContentSizeChange(() => {
                    const width = this.splitView.getViewSize(this.diffViewIndex);
                    if (this.dimension && !this.isDoingLayoutUpdate && width !== -1) {
                        this.isDoingLayoutUpdate = true;
                        topFrame.height.set(provider.layout({ width, height: this.dimension.height }, hasMultipleFrames), undefined);
                        this.isDoingLayoutUpdate = false;
                    }
                }));
            }
        }
        return topFrame;
    }
    layoutContentWidgets(dimension, width = this.splitView.getViewSize(this.diffViewIndex)) {
        this.isDoingLayoutUpdate = true;
        for (const provider of this.contentProviders) {
            const frameHeight = provider.layout({ height: dimension.height, width }, !!this.currentTopFrame?.showHeader.get());
            if (frameHeight) {
                this.currentTopFrame?.height.set(frameHeight, undefined);
            }
        }
        this.isDoingLayoutUpdate = false;
    }
    populateFloatingClick(subject) {
        if (!(subject instanceof MessageSubject)) {
            return;
        }
        this.currentSubjectStore.add(toDisposable(() => {
            this.contextKeyResultOutdated.reset();
            this.contextKeyTestMessage.reset();
        }));
        this.contextKeyTestMessage.set(subject.contextValue || '');
        if (subject.result instanceof LiveTestResult) {
            this.contextKeyResultOutdated.set(subject.result.getStateById(subject.test.extId)?.retired ?? false);
            this.currentSubjectStore.add(subject.result.onChange(ev => {
                if (ev.item.item.extId === subject.test.extId) {
                    this.contextKeyResultOutdated.set(ev.item.retired ?? false);
                }
            }));
        }
        else {
            this.contextKeyResultOutdated.set(true);
        }
        const instaService = this.currentSubjectStore.add(this.instantiationService
            .createChild(new ServiceCollection([IContextKeyService, this.messageContextKeyService])));
        this.currentSubjectStore.add(instaService.createInstance(FloatingClickMenu, {
            container: this.messageContainer,
            menuId: MenuId.TestMessageContent,
            getActionArg: () => subject.context,
        }));
    }
    onLayoutBody(height, width) {
        this.dimension = new dom.Dimension(width, height);
        this.splitView.layout(width);
    }
    onWidth(width) {
        this.splitView.layout(width);
    }
};
TestResultsViewContent = TestResultsViewContent_1 = __decorate([
    __param(2, IInstantiationService),
    __param(3, ITextModelService),
    __param(4, IContextKeyService),
    __param(5, IUriIdentityService),
    __param(6, IConfigurationService)
], TestResultsViewContent);
export { TestResultsViewContent };
const FOLLOWUP_ANIMATION_MIN_TIME = 500;
let FollowupActionWidget = class FollowupActionWidget extends Disposable {
    get domNode() {
        return this.el.root;
    }
    constructor(editor, testService, quickInput) {
        super();
        this.editor = editor;
        this.testService = testService;
        this.quickInput = quickInput;
        this.el = dom.h('div.testing-followup-action', []);
        this.visibleStore = this._register(new DisposableStore());
        this.onCloseEmitter = this._register(new Emitter());
        this.onClose = this.onCloseEmitter.event;
    }
    show(subject) {
        this.visibleStore.clear();
        if (subject instanceof MessageSubject) {
            this.showMessage(subject);
        }
    }
    async showMessage(subject) {
        const cts = this.visibleStore.add(new CancellationTokenSource());
        const start = Date.now();
        // Wait for completion otherwise results will not be available to the ext host:
        if (subject.result instanceof LiveTestResult && !subject.result.completedAt) {
            await new Promise(r => Event.once(subject.result.onComplete)(r));
        }
        const followups = await this.testService.provideTestFollowups({
            extId: subject.test.extId,
            messageIndex: subject.messageIndex,
            resultId: subject.result.id,
            taskIndex: subject.taskIndex,
        }, cts.token);
        if (!followups.followups.length || cts.token.isCancellationRequested) {
            followups.dispose();
            return;
        }
        this.visibleStore.add(followups);
        dom.clearNode(this.el.root);
        this.el.root.classList.toggle('animated', Date.now() - start > FOLLOWUP_ANIMATION_MIN_TIME);
        this.el.root.appendChild(this.makeFollowupLink(followups.followups[0]));
        if (followups.followups.length > 1) {
            this.el.root.appendChild(this.makeMoreLink(followups.followups));
        }
        this.visibleStore.add(toDisposable(() => {
            this.el.root.remove();
        }));
    }
    makeFollowupLink(first) {
        const link = this.makeLink(() => this.actionFollowup(link, first));
        dom.reset(link, ...renderLabelWithIcons(first.message));
        return link;
    }
    makeMoreLink(followups) {
        const link = this.makeLink(() => this.quickInput.pick(followups.map((f, i) => ({
            label: f.message,
            index: i
        }))).then(picked => {
            if (picked?.length) {
                followups[picked[0].index].execute();
            }
        }));
        link.innerText = localize('testFollowup.more', '+{0} More...', followups.length - 1);
        return link;
    }
    makeLink(onClick) {
        const link = document.createElement('a');
        link.tabIndex = 0;
        this.visibleStore.add(dom.addDisposableListener(link, 'click', onClick));
        this.visibleStore.add(dom.addDisposableListener(link, 'keydown', e => {
            const event = new StandardKeyboardEvent(e);
            if (event.equals(10 /* KeyCode.Space */) || event.equals(3 /* KeyCode.Enter */)) {
                onClick();
            }
        }));
        return link;
    }
    actionFollowup(link, fu) {
        if (link.ariaDisabled !== 'true') {
            link.ariaDisabled = 'true';
            fu.execute();
            if (this.editor) {
                this.onCloseEmitter.fire();
            }
        }
    }
};
FollowupActionWidget = __decorate([
    __param(1, ITestService),
    __param(2, IQuickInputService)
], FollowupActionWidget);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdFJlc3VsdHNWaWV3Q29udGVudC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2Jyb3dzZXIvdGVzdFJlc3VsdHNWaWV3L3Rlc3RSZXN1bHRzVmlld0NvbnRlbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDckYsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDOUYsT0FBTyxFQUFlLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN2RyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRTVFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2pILE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUUzRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUM3RixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDNUYsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sb0VBQW9FLENBQUM7QUFDMUcs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