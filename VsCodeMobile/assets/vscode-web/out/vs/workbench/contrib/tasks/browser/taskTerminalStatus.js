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
import * as nls from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import Severity from '../../../../base/common/severity.js';
import { StartStopProblemCollector } from '../common/problemCollectors.js';
import { TaskEventKind } from '../common/tasks.js';
import { ITaskService } from '../common/taskService.js';
import { MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { spinningLoading } from '../../../../platform/theme/common/iconRegistry.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
const TASK_TERMINAL_STATUS_ID = 'task_terminal_status';
export const ACTIVE_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: spinningLoading, severity: Severity.Info, tooltip: nls.localize('taskTerminalStatus.active', "Task is running") };
export const SUCCEEDED_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.check, severity: Severity.Info, tooltip: nls.localize('taskTerminalStatus.succeeded', "Task succeeded") };
const SUCCEEDED_INACTIVE_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.check, severity: Severity.Info, tooltip: nls.localize('taskTerminalStatus.succeededInactive', "Task succeeded and waiting...") };
export const FAILED_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.error, severity: Severity.Error, tooltip: nls.localize('taskTerminalStatus.errors', "Task has errors") };
const FAILED_INACTIVE_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.error, severity: Severity.Error, tooltip: nls.localize('taskTerminalStatus.errorsInactive', "Task has errors and is waiting...") };
const WARNING_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.warning, severity: Severity.Warning, tooltip: nls.localize('taskTerminalStatus.warnings', "Task has warnings") };
const WARNING_INACTIVE_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.warning, severity: Severity.Warning, tooltip: nls.localize('taskTerminalStatus.warningsInactive', "Task has warnings and is waiting...") };
const INFO_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.info, severity: Severity.Info, tooltip: nls.localize('taskTerminalStatus.infos', "Task has infos") };
const INFO_INACTIVE_TASK_STATUS = { id: TASK_TERMINAL_STATUS_ID, icon: Codicon.info, severity: Severity.Info, tooltip: nls.localize('taskTerminalStatus.infosInactive', "Task has infos and is waiting...") };
let TaskTerminalStatus = class TaskTerminalStatus extends Disposable {
    constructor(taskService, _accessibilitySignalService) {
        super();
        this._accessibilitySignalService = _accessibilitySignalService;
        this.terminalMap = new Map();
        this._register(taskService.onDidStateChange((event) => {
            switch (event.kind) {
                case TaskEventKind.ProcessStarted:
                case TaskEventKind.Active:
                    this.eventActive(event);
                    break;
                case TaskEventKind.Inactive:
                    this.eventInactive(event);
                    break;
                case TaskEventKind.ProcessEnded:
                    this.eventEnd(event);
                    break;
            }
        }));
        this._register(toDisposable(() => {
            for (const terminalData of this.terminalMap.values()) {
                terminalData.disposeListener?.dispose();
            }
            this.terminalMap.clear();
        }));
    }
    addTerminal(task, terminal, problemMatcher) {
        const status = { id: TASK_TERMINAL_STATUS_ID, severity: Severity.Info };
        terminal.statusList.add(status);
        this._register(problemMatcher.onDidFindFirstMatch(() => {
            this._marker = terminal.registerMarker();
            if (this._marker) {
                this._register(this._marker);
            }
        }));
        this._register(problemMatcher.onDidFindErrors(() => {
            if (this._marker) {
                terminal.addBufferMarker({ marker: this._marker, hoverMessage: nls.localize('task.watchFirstError', "Beginning of detected errors for this run"), disableCommandStorage: true });
            }
        }));
        this._register(problemMatcher.onDidRequestInvalidateLastMarker(() => {
            this._marker?.dispose();
            this._marker = undefined;
        }));
        this.terminalMap.set(terminal.instanceId, { terminal, task, status, problemMatcher, taskRunEnded: false });
    }
    terminalFromEvent(event) {
        if (!('terminalId' in event) || !event.terminalId) {
            return undefined;
        }
        return this.terminalMap.get(event.terminalId);
    }
    eventEnd(event) {
        const terminalData = this.terminalFromEvent(event);
        if (!terminalData) {
            return;
        }
        terminalData.taskRunEnded = true;
        terminalData.terminal.statusList.remove(terminalData.status);
        if ((event.exitCode === 0) && (!terminalData.problemMatcher.maxMarkerSeverity || terminalData.problemMatcher.maxMarkerSeverity < MarkerSeverity.Warning)) {
            this._accessibilitySignalService.playSignal(AccessibilitySignal.taskCompleted);
            if (terminalData.task.configurationProperties.isBackground) {
                for (const status of terminalData.terminal.statusList.statuses) {
                    terminalData.terminal.statusList.remove(status);
                }
            }
            else {
                terminalData.terminal.statusList.add(SUCCEEDED_TASK_STATUS);
            }
        }
        else if (event.exitCode || (terminalData.problemMatcher.maxMarkerSeverity !== undefined && terminalData.problemMatcher.maxMarkerSeverity === MarkerSeverity.Error)) {
            this._accessibilitySignalService.playSignal(AccessibilitySignal.taskFailed);
            terminalData.terminal.statusList.add(FAILED_TASK_STATUS);
        }
        else if (terminalData.problemMatcher.maxMarkerSeverity === MarkerSeverity.Warning) {
            this._accessibilitySignalService.playSignal(AccessibilitySignal.taskFailed);
            terminalData.terminal.statusList.add(WARNING_TASK_STATUS);
        }
        else if (terminalData.problemMatcher.maxMarkerSeverity === MarkerSeverity.Info) {
            terminalData.terminal.statusList.add(INFO_TASK_STATUS);
        }
    }
    eventInactive(event) {
        const terminalData = this.terminalFromEvent(event);
        if (!terminalData || !terminalData.problemMatcher || terminalData.taskRunEnded) {
            return;
        }
        terminalData.terminal.statusList.remove(terminalData.status);
        if (terminalData.problemMatcher.numberOfMatches === 0) {
            this._accessibilitySignalService.playSignal(AccessibilitySignal.taskCompleted);
            terminalData.terminal.statusList.add(SUCCEEDED_INACTIVE_TASK_STATUS);
        }
        else if (terminalData.problemMatcher.maxMarkerSeverity === MarkerSeverity.Error) {
            this._accessibilitySignalService.playSignal(AccessibilitySignal.taskFailed);
            terminalData.terminal.statusList.add(FAILED_INACTIVE_TASK_STATUS);
        }
        else if (terminalData.problemMatcher.maxMarkerSeverity === MarkerSeverity.Warning) {
            terminalData.terminal.statusList.add(WARNING_INACTIVE_TASK_STATUS);
        }
        else if (terminalData.problemMatcher.maxMarkerSeverity === MarkerSeverity.Info) {
            terminalData.terminal.statusList.add(INFO_INACTIVE_TASK_STATUS);
        }
    }
    eventActive(event) {
        const terminalData = this.terminalFromEvent(event);
        if (!terminalData) {
            return;
        }
        if (!terminalData.disposeListener) {
            terminalData.disposeListener = this._register(new MutableDisposable());
            terminalData.disposeListener.value = terminalData.terminal.onDisposed(() => {
                if (!event.terminalId) {
                    return;
                }
                this.terminalMap.delete(event.terminalId);
                terminalData.disposeListener?.dispose();
            });
        }
        terminalData.taskRunEnded = false;
        terminalData.terminal.statusList.remove(terminalData.status);
        // We don't want to show an infinite status for a background task that doesn't have a problem matcher.
        if ((terminalData.problemMatcher instanceof StartStopProblemCollector) || (terminalData.problemMatcher?.problemMatchers.length > 0) || event.runType === "singleRun" /* TaskRunType.SingleRun */) {
            terminalData.terminal.statusList.add(ACTIVE_TASK_STATUS);
        }
    }
};
TaskTerminalStatus = __decorate([
    __param(0, ITaskService),
    __param(1, IAccessibilitySignalService)
], TaskTerminalStatus);
export { TaskTerminalStatus };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFza1Rlcm1pbmFsU3RhdHVzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rhc2tzL2Jyb3dzZXIvdGFza1Rlcm1pbmFsU3RhdHVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxVQUFVLEVBQWUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDaEgsT0FBTyxRQUFRLE1BQU0scUNBQXFDLENBQUM7QUFDM0QsT0FBTyxFQUE0Qix5QkFBeUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JHLE9BQU8sRUFBdUUsYUFBYSxFQUFlLE1BQU0sb0JBQW9CLENBQUM7QUFDckksT0FBTyxFQUFFLFlBQVksRUFBUSxNQUFNLDBCQUEwQixDQUFDO0FBRTlELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNoRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFFcEYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLDJCQUEyQixFQUFFLE1BQU0sZ0ZBQWdGLENBQUM7QUFZbEosTUFBTSx1QkFBdUIsR0FBRyxzQkFBc0IsQ0FBQztBQUN2RCxNQUFNLENBQUMsTUFBTSxrQkFBa0IsR0FBb0IsRUFBRSxFQUFFLEVBQUUsdUJBQXVCLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQywyQkFBMkIsRUFBRSxpQkFBaUIsQ0FBQyxFQUFFLENBQUM7QUFDMU0sTUFBTSxDQUFDLE1BQU0scUJBQXFC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