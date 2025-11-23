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
import * as perf from '../../../../base/common/performance.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IExtensionService } from '../../extensions/common/extensions.js';
import { IUpdateService } from '../../../../platform/update/common/update.js';
import { ILifecycleService } from '../../lifecycle/common/lifecycle.js';
import { IEditorService } from '../../editor/common/editorService.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { Barrier, timeout } from '../../../../base/common/async.js';
import { IWorkbenchLayoutService } from '../../layout/browser/layoutService.js';
import { IPaneCompositePartService } from '../../panecomposite/browser/panecomposite.js';
import { TelemetryTrustedValue } from '../../../../platform/telemetry/common/telemetryUtils.js';
import { isWeb } from '../../../../base/common/platform.js';
import { createBlobWorker } from '../../../../platform/webWorker/browser/webWorkerServiceImpl.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { TerminalExtensions } from '../../../../platform/terminal/common/terminal.js';
export const ITimerService = createDecorator('timerService');
class PerfMarks {
    constructor() {
        this._entries = [];
    }
    setMarks(source, entries) {
        this._entries.push([source, entries]);
    }
    getDuration(from, to) {
        const fromEntry = this._findEntry(from);
        if (!fromEntry) {
            return 0;
        }
        const toEntry = this._findEntry(to);
        if (!toEntry) {
            return 0;
        }
        return toEntry.startTime - fromEntry.startTime;
    }
    getStartTime(mark) {
        const entry = this._findEntry(mark);
        return entry ? entry.startTime : -1;
    }
    _findEntry(name) {
        for (const [, marks] of this._entries) {
            for (let i = marks.length - 1; i >= 0; i--) {
                if (marks[i].name === name) {
                    return marks[i];
                }
            }
        }
    }
    getEntries() {
        return this._entries.slice(0);
    }
}
let AbstractTimerService = class AbstractTimerService {
    constructor(_lifecycleService, _contextService, _extensionService, _updateService, _paneCompositeService, _editorService, _accessibilityService, _telemetryService, layoutService) {
        this._lifecycleService = _lifecycleService;
        this._contextService = _contextService;
        this._extensionService = _extensionService;
        this._updateService = _updateService;
        this._paneCompositeService = _paneCompositeService;
        this._editorService = _editorService;
        this._accessibilityService = _accessibilityService;
        this._telemetryService = _telemetryService;
        this._barrier = new Barrier();
        this._marks = new PerfMarks();
        this._rndValueShouldSendTelemetry = Math.random() < .03; // 3% of users
        Promise.all([
            this._extensionService.whenInstalledExtensionsRegistered(), // extensions registered
            _lifecycleService.when(3 /* LifecyclePhase.Restored */), // workbench created and parts restored
            layoutService.whenRestored, // layout restored (including visible editors resolved)
            Promise.all(Array.from(Registry.as(TerminalExtensions.Backend).backends.values()).map(e => e.whenReady))
        ]).then(() => {
            // set perf mark from renderer
            this.setPerformanceMarks('renderer', perf.getMarks());
            return this._computeStartupMetrics();
        }).then(metrics => {
            this._startupMetrics = metrics;
            this._reportStartupTimes(metrics);
            this._barrier.open();
        });
        this.perfBaseline = this._barrier.wait()
            .then(() => this._lifecycleService.when(4 /* LifecyclePhase.Eventually */))
            .then(() => timeout(this._startupMetrics.timers.ellapsedRequire))
            .then(() => {
            // we use fibonacci numbers to have a performance baseline that indicates
            // how slow/fast THIS machine actually is.
            const jsSrc = (function () {
                // the following operation took ~16ms (one frame at 64FPS) to complete on my machine. We derive performance observations
                // from that. We also bail if that took too long (>1s)
                let tooSlow = false;
                function fib(n) {
                    if (tooSlow) {
                        return 0;
                    }
                    if (performance.now() - t1 >= 1000) {
                        tooSlow = true;
                    }
                    if (n <= 2) {
                        return n;
                    }
                    return fib(n - 1) + fib(n - 2);
                }
                const t1 = performance.now();
                fib(24);
                const value = Math.round(performance.now() - t1);
                self.postMessage({ value: tooSlow ? -1 : value });
            }).toString();
            const blob = new Blob([`(${jsSrc})();`], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);
            const worker = createBlobWorker(blobUrl, { name: 'perfBaseline' });
            return new Promise(resolve => {
                worker.onmessage = e => resolve(e.data.value);
            }).finally(() => {
                worker.terminate();
                URL.revokeObjectURL(blobUrl);
            });
        });
    }
    whenReady() {
        return this._barrier.wait();
    }
    get startupMetrics() {
        if (!this._startupMetrics) {
            throw new Error('illegal state, MUST NOT access startupMetrics before whenReady has resolved');
        }
        return this._startupMetrics;
    }
    setPerformanceMarks(source, marks) {
        // Perf marks are a shared resource because anyone can generate them
        // and because of that we only accept marks that start with 'code/'
        const codeMarks = marks.filter(mark => mark.name.startsWith('code/'));
        this._marks.setMarks(source, codeMarks);
        this._reportPerformanceMarks(source, codeMarks);
    }
    getPerformanceMarks() {
        return this._marks.getEntries();
    }
    getDuration(from, to) {
        return this._marks.getDuration(from, to);
    }
    getStartTime(mark) {
        return this._marks.getStartTime(mark);
    }
    _reportStartupTimes(metrics) {
        // report IStartupMetrics as telemetry
        /* __GDPR__
            "startupTimeVaried" : {
                "owner": "jrieken",
                "${include}": [
                    "${IStartupMetrics}"
                ]
            }
        */
        this._telemetryService.publicLog('startupTimeVaried', metrics);
    }
    _shouldReportPerfMarks() {
        return this._rndValueShouldSendTelemetry;
    }
    _reportPerformanceMarks(source, marks) {
        if (!this._shouldReportPerfMarks()) {
            // the `startup.timer.mark` event is send very often. In order to save resources
            // we let some of our instances/sessions send this event
            return;
        }
        for (const mark of marks) {
            this._telemetryService.publicLog2('startup.timer.mark', {
                source,
                name: new TelemetryTrustedValue(mark.name),
                startTime: mark.startTime
            });
        }
    }
    async _computeStartupMetrics() {
        const initialStartup = this._isInitialStartup();
        let startMark;
        if (isWeb) {
            startMark = 'code/timeOrigin';
        }
        else {
            startMark = initialStartup ? 'code/didStartMain' : 'code/willOpenNewWindow';
        }
        const activeViewlet = this._paneCompositeService.getActivePaneComposite(0 /* ViewContainerLocation.Sidebar */);
        const activeAuxiliaryViewlet = this._paneCompositeService.getActivePaneComposite(2 /* ViewContainerLocation.AuxiliaryBar */);
        const activePanel = this._paneCompositeService.getActivePaneComposite(1 /* ViewContainerLocation.Panel */);
        const info = {
            ellapsed: this._marks.getDuration(startMark, 'code/didStartWorkbench'),
            // reflections
            isLatestVersion: Boolean(await this._updateService.isLatestVersion()),
            didUseCachedData: this._didUseCachedData(),
            windowKind: this._lifecycleService.startupKind,
            windowCount: await this._getWindowCount(),
            viewletId: activeViewlet?.getId(),
            auxiliaryViewletId: activeAuxiliaryViewlet?.getId(),
            editorIds: this._editorService.visibleEditors.map(input => input.typeId),
            panelId: activePanel ? activePanel.getId() : undefined,
            // timers
            timers: {
                ellapsedAppReady: initialStartup ? this._marks.getDuration('code/didStartMain', 'code/mainAppReady') : undefined,
                ellapsedNlsGeneration: initialStartup ? this._marks.getDuration('code/willGenerateNls', 'code/didGenerateNls') : undefined,
                ellapsedLoadMainBundle: initialStartup ? this._marks.getDuration('code/willLoadMainBundle', 'code/didLoadMainBundle') : undefined,
                ellapsedRunMainBundle: initialStartup ? this._marks.getDuration('code/didStartMain', 'code/didRunMainBundle') : undefined,
                ellapsedCrashReporter: initialStartup ? this._marks.getDuration('code/willStartCrashReporter', 'code/didStartCrashReporter') : undefined,
                ellapsedMainServer: initialStartup ? this._marks.getDuration('code/willStartMainServer', 'code/didStartMainServer') : undefined,
                ellapsedWindowCreate: initialStartup ? this._marks.getDuration('code/willCreateCodeWindow', 'code/didCreateCodeWindow') : undefined,
                ellapsedWindowRestoreState: initialStartup ? this._marks.getDuration('code/willRestoreCodeWindowState', 'code/didRestoreCodeWindowState') : undefined,
                ellapsedBrowserWindowCreate: initialStartup ? this._marks.getDuration('code/willCreateCodeBrowserWindow', 'code/didCreateCodeBrowserWindow') : undefined,
                ellapsedWindowMaximize: initialStartup ? this._marks.getDuration('code/willMaximizeCodeWindow', 'code/didMaximizeCodeWindow') : undefined,
                ellapsedWindowLoad: initialStartup ? this._marks.getDuration('code/mainAppReady', 'code/willOpenNewWindow') : undefined,
                ellapsedWindowLoadToRequire: this._marks.getDuration('code/willOpenNewWindow', 'code/willLoadWorkbenchMain'),
                ellapsedRequire: this._marks.getDuration('code/willLoadWorkbenchMain', 'code/didLoadWorkbenchMain'),
                ellapsedWaitForWindowConfig: this._marks.getDuration('code/willWaitForWindowConfig', 'code/didWaitForWindowConfig'),
                ellapsedStorageInit: this._marks.getDuration('code/willInitStorage', 'code/didInitStorage'),
                ellapsedSharedProcesConnected: this._marks.getDuration('code/willConnectSharedProcess', 'code/didConnectSharedProcess'),
                ellapsedWorkspaceServiceInit: this._marks.getDuration('code/willInitWorkspaceService', 'code/didInitWorkspaceService'),
                ellapsedRequiredUserDataInit: this._marks.getDuration('code/willInitRequiredUserData', 'code/didInitRequiredUserData'),
                ellapsedOtherUserDataInit: this._marks.getDuration('code/willInitOtherUserData', 'code/didInitOtherUserData'),
                ellapsedExtensions: this._marks.getDuration('code/willLoadExtensions', 'code/didLoadExtensions'),
                ellapsedEditorRestore: this._marks.getDuration('code/willRestoreEditors', 'code/didRestoreEditors'),
                ellapsedViewletRestore: this._marks.getDuration('code/willRestoreViewlet', 'code/didRestoreViewlet'),
                ellapsedAuxiliaryViewletRestore: this._marks.getDuration('code/willRestoreAuxiliaryBar', 'code/didRestoreAuxiliaryBar'),
                ellapsedPanelRestore: this._marks.getDuration('code/willRestorePanel', 'code/didRestorePanel'),
                ellapsedWorkbenchContributions: this._marks.getDuration('code/willCreateWorkbenchContributions/1', 'code/didCreateWorkbenchContributions/2'),
                ellapsedWorkbench: this._marks.getDuration('code/willStartWorkbench', 'code/didStartWorkbench'),
                ellapsedExtensionsReady: this._marks.getDuration(startMark, 'code/didLoadExtensions'),
                ellapsedRenderer: this._marks.getDuration('code/didStartRenderer', 'code/didStartWorkbench')
            },
            // system info
            platform: undefined,
            release: undefined,
            arch: undefined,
            totalmem: undefined,
            freemem: undefined,
            meminfo: undefined,
            cpus: undefined,
            loadavg: undefined,
            isVMLikelyhood: undefined,
            initialStartup,
            hasAccessibilitySupport: this._accessibilityService.isScreenReaderOptimized(),
            emptyWorkbench: this._contextService.getWorkbenchState() === 1 /* WorkbenchState.EMPTY */
        };
        await this._extendStartupInfo(info);
        return info;
    }
};
AbstractTimerService = __decorate([
    __param(0, ILifecycleService),
    __param(1, IWorkspaceContextService),
    __param(2, IExtensionService),
    __param(3, IUpdateService),
    __param(4, IPaneCompositePartService),
    __param(5, IEditorService),
    __param(6, IAccessibilityService),
    __param(7, ITelemetryService),
    __param(8, IWorkbenchLayoutService)
], AbstractTimerService);
export { AbstractTimerService };
export class TimerService extends AbstractTimerService {
    _isInitialStartup() {
        return false;
    }
    _didUseCachedData() {
        return false;
    }
    async _getWindowCount() {
        return 1;
    }
    async _extendStartupInfo(info) {
        info.isVMLikelyhood = 0;
        info.isARM64Emulated = false;
        info.platform = navigator.userAgent;
        info.release = navigator.appVersion;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGltZXJTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy90aW1lci9icm93c2VyL3RpbWVyU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssSUFBSSxNQUFNLHdDQUF3QyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUM3RixPQUFPLEVBQUUsd0JBQXdCLEVBQWtCLE1BQU0sb0RBQW9ELENBQUM7QUFDOUcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDMUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxpQkFBaUIsRUFBa0IsTUFBTSxxQ0FBcUMsQ0FBQztBQUN4RixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdEUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFrQixpQkFBaUIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDcEUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEYsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFFekYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxr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