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
import { groupBy } from '../../../../base/common/arrays.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Emitter } from '../../../../base/common/event.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../base/common/observable.js';
import { isDefined } from '../../../../base/common/types.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { bindContextKey } from '../../../../platform/observable/common/platformObservableUtils.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IWorkspaceTrustRequestService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { getTestingConfiguration } from './configuration.js';
import { MainThreadTestCollection } from './mainThreadTestCollection.js';
import { MutableObservableValue } from './observableValue.js';
import { StoredValue } from './storedValue.js';
import { TestExclusions } from './testExclusions.js';
import { TestId } from './testId.js';
import { TestingContextKeys } from './testingContextKeys.js';
import { canUseProfileWithTest, ITestProfileService } from './testProfileService.js';
import { ITestResultService } from './testResultService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
let TestService = class TestService extends Disposable {
    constructor(contextKeyService, instantiationService, uriIdentityService, storage, editorService, testProfiles, notificationService, configurationService, testResults, workspaceTrustRequestService) {
        super();
        this.editorService = editorService;
        this.testProfiles = testProfiles;
        this.notificationService = notificationService;
        this.configurationService = configurationService;
        this.testResults = testResults;
        this.workspaceTrustRequestService = workspaceTrustRequestService;
        this.testControllers = observableValue('testControllers', new Map());
        this.testExtHosts = new Set();
        this.cancelExtensionTestRunEmitter = new Emitter();
        this.willProcessDiffEmitter = new Emitter();
        this.didProcessDiffEmitter = new Emitter();
        this.testRefreshCancellations = new Set();
        /**
         * Cancellation for runs requested by the user being managed by the UI.
         * Test runs initiated by extensions are not included here.
         */
        this.uiRunningTests = new Map();
        /**
         * @inheritdoc
         */
        this.onWillProcessDiff = this.willProcessDiffEmitter.event;
        /**
         * @inheritdoc
         */
        this.onDidProcessDiff = this.didProcessDiffEmitter.event;
        /**
         * @inheritdoc
         */
        this.onDidCancelTestRun = this.cancelExtensionTestRunEmitter.event;
        this.collection = new MainThreadTestCollection(uriIdentityService, this.expandTest.bind(this));
        this.showInlineOutput = this._register(MutableObservableValue.stored(new StoredValue({
            key: 'inlineTestOutputVisible',
            scope: 1 /* StorageScope.WORKSPACE */,
            target: 0 /* StorageTarget.USER */
        }, storage), true));
        this.excluded = instantiationService.createInstance(TestExclusions);
        this.isRefreshingTests = TestingContextKeys.isRefreshingTests.bindTo(contextKeyService);
        this.activeEditorHasTests = TestingContextKeys.activeEditorHasTests.bindTo(contextKeyService);
        this._register(bindContextKey(TestingContextKeys.providerCount, contextKeyService, reader => this.testControllers.read(reader).size));
        const bindCapability = (key, capability) => this._register(bindContextKey(key, contextKeyService, reader => Iterable.some(this.testControllers.read(reader).values(), ctrl => !!(ctrl.capabilities.read(reader) & capability))));
        bindCapability(TestingContextKeys.canRefreshTests, 2 /* TestControllerCapability.Refresh */);
        bindCapability(TestingContextKeys.canGoToRelatedCode, 4 /* TestControllerCapability.CodeRelatedToTest */);
        bindCapability(TestingContextKeys.canGoToRelatedTest, 8 /* TestControllerCapability.TestRelatedToCode */);
        this._register(editorService.onDidActiveEditorChange(() => this.updateEditorContextKeys()));
    }
    /**
     * @inheritdoc
     */
    async expandTest(id, levels) {
        await this.testControllers.get().get(TestId.fromString(id).controllerId)?.expandTest(id, levels);
    }
    /**
     * @inheritdoc
     */
    cancelTestRun(runId, taskId) {
        this.cancelExtensionTestRunEmitter.fire({ runId, taskId });
        if (runId === undefined) {
            for (const runCts of this.uiRunningTests.values()) {
                runCts.cancel();
            }
        }
        else if (!taskId) {
            this.uiRunningTests.get(runId)?.cancel();
        }
    }
    /**
     * @inheritdoc
     */
    async runTests(req, token = CancellationToken.None) {
        // We try to ensure that all tests in the request will be run, preferring
        // to use default profiles for each controller when possible.
        const byProfile = [];
        for (const test of req.tests) {
            const existing = byProfile.find(p => canUseProfileWithTest(p.profile, test));
            if (existing) {
                existing.tests.push(test);
                continue;
            }
            const bestProfile = this.testProfiles.getDefaultProfileForTest(req.group, test);
            if (!bestProfile) {
                continue;
            }
            byProfile.push({ profile: bestProfile, tests: [test] });
        }
        const resolved = {
            targets: byProfile.map(({ profile, tests }) => ({
                profileId: profile.profileId,
                controllerId: tests[0].controllerId,
                testIds: tests.map(t => t.item.extId),
            })),
            group: req.group,
            exclude: req.exclude?.map(t => t.item.extId),
            continuous: req.continuous,
            preserveFocus: req.preserveFocus,
        };
        // If no tests are covered by the defaults, just use whatever the defaults
        // for their controller are. This can happen if the user chose specific
        // profiles for the run button, but then asked to run a single test from the
        // explorer or decoration. We shouldn't no-op.
        if (resolved.targets.length === 0) {
            for (const byController of groupBy(req.tests, (a, b) => a.controllerId === b.controllerId ? 0 : 1)) {
                const profiles = this.testProfiles.getControllerProfiles(byController[0].controllerId);
                const withControllers = byController.map(test => ({
                    profile: profiles.find(p => p.group === req.group && canUseProfileWithTest(p, test)),
                    test,
                }));
                for (const byProfile of groupBy(withControllers, (a, b) => a.profile === b.profile ? 0 : 1)) {
                    const profile = byProfile[0].profile;
                    if (profile) {
                        resolved.targets.push({
                            testIds: byProfile.map(t => t.test.item.extId),
                            profileId: profile.profileId,
                            controllerId: profile.controllerId,
                        });
                    }
                }
            }
        }
        return this.runResolvedTests(resolved, token);
    }
    /** @inheritdoc */
    async startContinuousRun(req, token) {
        if (!req.exclude) {
            req.exclude = [...this.excluded.all];
        }
        const trust = await this.workspaceTrustRequestService.requestWorkspaceTrust({
            message: localize('testTrust', "Running tests may execute code in your workspace."),
        });
        if (!trust) {
            return;
        }
        const byController = groupBy(req.targets, (a, b) => a.controllerId.localeCompare(b.controllerId));
        const requests = byController.map(group => this.getTestController(group[0].controllerId)?.startContinuousRun(group.map(controlReq => ({
            excludeExtIds: req.exclude.filter(t => !controlReq.testIds.includes(t)),
            profileId: controlReq.profileId,
            controllerId: controlReq.controllerId,
            testIds: controlReq.testIds,
        })), token).then(result => {
            const errs = result.map(r => r.error).filter(isDefined);
            if (errs.length) {
                this.notificationService.error(localize('testError', 'An error occurred attempting to run tests: {0}', errs.join(' ')));
            }
        }));
        await Promise.all(requests);
    }
    /**
     * @inheritdoc
     */
    async runResolvedTests(req, token = CancellationToken.None) {
        if (!req.exclude) {
            req.exclude = [...this.excluded.all];
        }
        const result = this.testResults.createLiveResult(req);
        const trust = await this.workspaceTrustRequestService.requestWorkspaceTrust({
            message: localize('testTrust', "Running tests may execute code in your workspace."),
        });
        if (!trust) {
            result.markComplete();
            return result;
        }
        try {
            const cancelSource = new CancellationTokenSource(token);
            this.uiRunningTests.set(result.id, cancelSource);
            const byController = groupBy(req.targets, (a, b) => a.controllerId.localeCompare(b.controllerId));
            const requests = byController.map(group => this.getTestController(group[0].controllerId)?.runTests(group.map(controlReq => ({
                runId: result.id,
                excludeExtIds: req.exclude.filter(t => !controlReq.testIds.includes(t)),
                profileId: controlReq.profileId,
                controllerId: controlReq.controllerId,
                testIds: controlReq.testIds,
            })), cancelSource.token).then(result => {
                const errs = result.map(r => r.error).filter(isDefined);
                if (errs.length) {
                    this.notificationService.error(localize('testError', 'An error occurred attempting to run tests: {0}', errs.join(' ')));
                }
            }));
            await this.saveAllBeforeTest(req);
            await Promise.all(requests);
            return result;
        }
        finally {
            this.uiRunningTests.delete(result.id);
            result.markComplete();
        }
    }
    /**
     * @inheritdoc
     */
    async provideTestFollowups(req, token) {
        const reqs = await Promise.all([...this.testExtHosts].map(async (ctrl) => ({ ctrl, followups: await ctrl.provideTestFollowups(req, token) })));
        const followups = {
            followups: reqs.flatMap(({ ctrl, followups }) => followups.map(f => ({
                message: f.title,
                execute: () => ctrl.executeTestFollowup(f.id)
            }))),
            dispose: () => {
                for (const { ctrl, followups } of reqs) {
                    ctrl.disposeTestFollowups(followups.map(f => f.id));
                }
            }
        };
        if (token.isCancellationRequested) {
            followups.dispose();
        }
        return followups;
    }
    /**
     * @inheritdoc
     */
    publishDiff(_controllerId, diff) {
        this.willProcessDiffEmitter.fire(diff);
        this.collection.apply(diff);
        this.updateEditorContextKeys();
        this.didProcessDiffEmitter.fire(diff);
    }
    /**
     * @inheritdoc
     */
    getTestController(id) {
        return this.testControllers.get().get(id);
    }
    /**
     * @inheritdoc
     */
    async syncTests() {
        const cts = new CancellationTokenSource();
        try {
            await Promise.all([...this.testControllers.get().values()].map(c => c.syncTests(cts.token)));
        }
        finally {
            cts.dispose(true);
        }
    }
    /**
     * @inheritdoc
     */
    async refreshTests(controllerId) {
        const cts = new CancellationTokenSource();
        this.testRefreshCancellations.add(cts);
        this.isRefreshingTests.set(true);
        try {
            if (controllerId) {
                await this.getTestController(controllerId)?.refreshTests(cts.token);
            }
            else {
                await Promise.all([...this.testControllers.get().values()].map(c => c.refreshTests(cts.token)));
            }
        }
        finally {
            this.testRefreshCancellations.delete(cts);
            this.isRefreshingTests.set(this.testRefreshCancellations.size > 0);
            cts.dispose(true);
        }
    }
    /**
     * @inheritdoc
     */
    cancelRefreshTests() {
        for (const cts of this.testRefreshCancellations) {
            cts.cancel();
        }
        this.testRefreshCancellations.clear();
        this.isRefreshingTests.set(false);
    }
    /**
     * @inheritdoc
     */
    registerExtHost(controller) {
        this.testExtHosts.add(controller);
        return toDisposable(() => this.testExtHosts.delete(controller));
    }
    /**
     * @inheritdoc
     */
    async getTestsRelatedToCode(uri, position, token = CancellationToken.None) {
        const testIds = await Promise.all([...this.testExtHosts.values()].map(v => v.getTestsRelatedToCode(uri, position, token)));
        // ext host will flush diffs before returning, so we should have everything here:
        return testIds.flatMap(ids => ids.map(id => this.collection.getNodeById(id))).filter(isDefined);
    }
    /**
     * @inheritdoc
     */
    registerTestController(id, controller) {
        this.testControllers.set(new Map(this.testControllers.get()).set(id, controller), undefined);
        return toDisposable(() => {
            const diff = [];
            for (const root of this.collection.rootItems) {
                if (root.controllerId === id) {
                    diff.push({ op: 3 /* TestDiffOpType.Remove */, itemId: root.item.extId });
                }
            }
            this.publishDiff(id, diff);
            const next = new Map(this.testControllers.get());
            next.delete(id);
            this.testControllers.set(next, undefined);
        });
    }
    /**
     * @inheritdoc
     */
    async getCodeRelatedToTest(test, token = CancellationToken.None) {
        return (await this.testControllers.get().get(test.controllerId)?.getRelatedCode(test.item.extId, token)) || [];
    }
    updateEditorContextKeys() {
        const uri = this.editorService.activeEditor?.resource;
        if (uri) {
            this.activeEditorHasTests.set(!Iterable.isEmpty(this.collection.getNodeByUrl(uri)));
        }
        else {
            this.activeEditorHasTests.set(false);
        }
    }
    async saveAllBeforeTest(req, configurationService = this.configurationService, editorService = this.editorService) {
        if (req.preserveFocus === true) {
            return;
        }
        const saveBeforeTest = getTestingConfiguration(this.configurationService, "testing.saveBeforeTest" /* TestingConfigKeys.SaveBeforeTest */);
        if (saveBeforeTest) {
            await editorService.saveAll();
        }
        return;
    }
};
TestService = __decorate([
    __param(0, IContextKeyService),
    __param(1, IInstantiationService),
    __param(2, IUriIdentityService),
    __param(3, IStorageService),
    __param(4, IEditorService),
    __param(5, ITestProfileService),
    __param(6, INotificationService),
    __param(7, IConfigurationService),
    __param(8, ITestResultService),
    __param(9, IWorkspaceTrustRequestService)
], TestService);
export { TestService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdFNlcnZpY2VJbXBsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlc3RpbmcvY29tbW9uL3Rlc3RTZXJ2aWNlSW1wbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDNUQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLHVCQUF1QixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFlLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzdGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFJN0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBZSxrQkFBa0IsRUFBaUIsTUFBTSxzREFBc0QsQ0FBQztBQUN0SCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUNoRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFDbkcsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxnREFBZ0QsQ0FBQztBQUM5RyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUM3RixPQUFPLEVBQUUs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