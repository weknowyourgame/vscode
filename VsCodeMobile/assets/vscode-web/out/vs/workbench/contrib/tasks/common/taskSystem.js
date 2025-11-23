/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export var TaskErrors;
(function (TaskErrors) {
    TaskErrors[TaskErrors["NotConfigured"] = 0] = "NotConfigured";
    TaskErrors[TaskErrors["RunningTask"] = 1] = "RunningTask";
    TaskErrors[TaskErrors["NoBuildTask"] = 2] = "NoBuildTask";
    TaskErrors[TaskErrors["NoTestTask"] = 3] = "NoTestTask";
    TaskErrors[TaskErrors["ConfigValidationError"] = 4] = "ConfigValidationError";
    TaskErrors[TaskErrors["TaskNotFound"] = 5] = "TaskNotFound";
    TaskErrors[TaskErrors["NoValidTaskRunner"] = 6] = "NoValidTaskRunner";
    TaskErrors[TaskErrors["UnknownError"] = 7] = "UnknownError";
})(TaskErrors || (TaskErrors = {}));
export class VerifiedTask {
    constructor(task, resolver, trigger) {
        this.task = task;
        this.resolver = resolver;
        this.trigger = trigger;
    }
    verify() {
        let verified = false;
        if (this.trigger && this.resolvedVariables && this.workspaceFolder && (this.shellLaunchConfig !== undefined)) {
            verified = true;
        }
        return verified;
    }
    getVerifiedTask() {
        if (this.verify()) {
            return { task: this.task, resolver: this.resolver, trigger: this.trigger, resolvedVariables: this.resolvedVariables, systemInfo: this.systemInfo, workspaceFolder: this.workspaceFolder, shellLaunchConfig: this.shellLaunchConfig };
        }
        else {
            throw new Error('VerifiedTask was not checked. verify must be checked before getVerifiedTask.');
        }
    }
}
export class TaskError {
    constructor(severity, message, code) {
        this.severity = severity;
        this.message = message;
        this.code = code;
    }
}
export var Triggers;
(function (Triggers) {
    Triggers.shortcut = 'shortcut';
    Triggers.command = 'command';
    Triggers.reconnect = 'reconnect';
})(Triggers || (Triggers = {}));
export var TaskExecuteKind;
(function (TaskExecuteKind) {
    TaskExecuteKind[TaskExecuteKind["Started"] = 1] = "Started";
    TaskExecuteKind[TaskExecuteKind["Active"] = 2] = "Active";
})(TaskExecuteKind || (TaskExecuteKind = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFza1N5c3RlbS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9jb21tb24vdGFza1N5c3RlbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQWVoRyxNQUFNLENBQU4sSUFBa0IsVUFTakI7QUFURCxXQUFrQixVQUFVO0lBQzNCLDZEQUFhLENBQUE7SUFDYix5REFBVyxDQUFBO0lBQ1gseURBQVcsQ0FBQTtJQUNYLHVEQUFVLENBQUE7SUFDViw2RUFBcUIsQ0FBQTtJQUNyQiwyREFBWSxDQUFBO0lBQ1oscUVBQWlCLENBQUE7SUFDakIsMkRBQVksQ0FBQTtBQUNiLENBQUMsRUFUaUIsVUFBVSxLQUFWLFVBQVUsUUFTM0I7QUFFRCxNQUFNLE9BQU8sWUFBWTtJQVN4QixZQUFZLElBQVUsRUFBRSxRQUF1QixFQUFFLE9BQWU7UUFDL0QsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFDakIsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDekIsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7SUFDeEIsQ0FBQztJQUVNLE1BQU07UUFDWixJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUM7UUFDckIsSUFBSSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxpQkFBaUIsSUFBSSxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixLQUFLLFNBQVMsQ0FBQyxFQUFFLENBQUM7WUFDOUcsUUFBUSxHQUFHLElBQUksQ0FBQztRQUNqQixDQUFDO1FBQ0QsT0FBTyxRQUFRLENBQUM7SUFDakIsQ0FBQztJQUVNLGVBQWU7UUFDckIsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztZQUNuQixPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGlCQUFrQixFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsVUFBVyxFQUFFLGVBQWUsRUFBRSxJQUFJLENBQUMsZUFBZ0IsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLENBQUMsaUJBQWtCLEVBQUUsQ0FBQztRQUMxTyxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sSUFBSSxLQUFLLENBQUMsOEVBQThFLENBQUMsQ0FBQztRQUNqRyxDQUFDO0lBQ0YsQ0FBQztDQUNEO0FBRUQsTUFBTSxPQUFPLFNBQVM7SUFLckIsWUFBWSxRQUFrQixFQUFFLE9BQWUsRUFBRSxJQUFnQjtRQUNoRSxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztJQUNsQixDQUFDO0NBQ0Q7QUFFRCxNQUFNLEtBQVcsUUFBUSxDQUl4QjtBQUpELFdBQWlCLFFBQVE7SUFDWCxpQkFBUSxHQUFXLFVBQVUsQ0FBQztJQUM5QixnQkFBTyxHQUFXLFNBQVMsQ0FBQztJQUM1QixrQkFBUyxHQUFXLFdBQVcsQ0FBQztBQUM5QyxDQUFDLEVBSmdCLFFBQVEsS0FBUixRQUFRLFFBSXhCO0FBU0QsTUFBTSxDQUFOLElBQWtCLGVBR2pCO0FBSEQsV0FBa0IsZUFBZTtJQUNoQywyREFBVyxDQUFBO0lBQ1gseURBQVUsQ0FBQTtBQUNYLENBQUMsRUFIaUIsZUFBZSxLQUFmLGVBQWUsUUFHaEMifQ==