/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { encodeBase64 } from '../../../../../base/common/buffer.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { localize } from '../../../../../nls.js';
import { IChatToolInvocation } from '../chatService.js';
import { isToolResultOutputDetails } from '../languageModelToolsService.js';
export class ChatToolInvocation {
    get state() {
        return this._state;
    }
    constructor(preparedInvocation, toolData, toolCallId, fromSubAgent, parameters) {
        this.toolCallId = toolCallId;
        this.kind = 'toolInvocation';
        this._progress = observableValue(this, { progress: 0 });
        const defaultMessage = localize('toolInvocationMessage', "Using {0}", `"${toolData.displayName}"`);
        const invocationMessage = preparedInvocation?.invocationMessage ?? defaultMessage;
        this.invocationMessage = invocationMessage;
        this.pastTenseMessage = preparedInvocation?.pastTenseMessage;
        this.originMessage = preparedInvocation?.originMessage;
        this.confirmationMessages = preparedInvocation?.confirmationMessages;
        this.presentation = preparedInvocation?.presentation;
        this.toolSpecificData = preparedInvocation?.toolSpecificData;
        this.toolId = toolData.id;
        this.source = toolData.source;
        this.fromSubAgent = fromSubAgent;
        this.parameters = parameters;
        if (!this.confirmationMessages?.title) {
            this._state = observableValue(this, { type: 1 /* IChatToolInvocation.StateKind.Executing */, confirmed: { type: 1 /* ToolConfirmKind.ConfirmationNotNeeded */ }, progress: this._progress });
        }
        else {
            this._state = observableValue(this, {
                type: 0 /* IChatToolInvocation.StateKind.WaitingForConfirmation */,
                confirm: reason => {
                    if (reason.type === 0 /* ToolConfirmKind.Denied */ || reason.type === 5 /* ToolConfirmKind.Skipped */) {
                        this._state.set({ type: 4 /* IChatToolInvocation.StateKind.Cancelled */, reason: reason.type }, undefined);
                    }
                    else {
                        this._state.set({ type: 1 /* IChatToolInvocation.StateKind.Executing */, confirmed: reason, progress: this._progress }, undefined);
                    }
                }
            });
        }
    }
    _setCompleted(result, postConfirmed) {
        if (postConfirmed && (postConfirmed.type === 0 /* ToolConfirmKind.Denied */ || postConfirmed.type === 5 /* ToolConfirmKind.Skipped */)) {
            this._state.set({ type: 4 /* IChatToolInvocation.StateKind.Cancelled */, reason: postConfirmed.type }, undefined);
            return;
        }
        this._state.set({
            type: 3 /* IChatToolInvocation.StateKind.Completed */,
            confirmed: IChatToolInvocation.executionConfirmedOrDenied(this) || { type: 1 /* ToolConfirmKind.ConfirmationNotNeeded */ },
            resultDetails: result?.toolResultDetails,
            postConfirmed,
            contentForModel: result?.content || [],
        }, undefined);
    }
    didExecuteTool(result, final) {
        if (result?.toolResultMessage) {
            this.pastTenseMessage = result.toolResultMessage;
        }
        else if (this._progress.get().message) {
            this.pastTenseMessage = this._progress.get().message;
        }
        if (this.confirmationMessages?.confirmResults && !result?.toolResultError && result?.confirmResults !== false && !final) {
            this._state.set({
                type: 2 /* IChatToolInvocation.StateKind.WaitingForPostApproval */,
                confirmed: IChatToolInvocation.executionConfirmedOrDenied(this) || { type: 1 /* ToolConfirmKind.ConfirmationNotNeeded */ },
                resultDetails: result?.toolResultDetails,
                contentForModel: result?.content || [],
                confirm: reason => this._setCompleted(result, reason),
            }, undefined);
        }
        else {
            this._setCompleted(result);
        }
        return this._state.get();
    }
    acceptProgress(step) {
        const prev = this._progress.get();
        this._progress.set({
            progress: step.progress || prev.progress || 0,
            message: step.message,
        }, undefined);
    }
    toJSON() {
        // persist the serialized call as 'skipped' if we were waiting for postapproval
        const waitingForPostApproval = this.state.get().type === 2 /* IChatToolInvocation.StateKind.WaitingForPostApproval */;
        const details = waitingForPostApproval ? undefined : IChatToolInvocation.resultDetails(this);
        return {
            kind: 'toolInvocationSerialized',
            presentation: this.presentation,
            invocationMessage: this.invocationMessage,
            pastTenseMessage: this.pastTenseMessage,
            originMessage: this.originMessage,
            isConfirmed: waitingForPostApproval ? { type: 5 /* ToolConfirmKind.Skipped */ } : IChatToolInvocation.executionConfirmedOrDenied(this),
            isComplete: true,
            source: this.source,
            resultDetails: isToolResultOutputDetails(details)
                ? { output: { type: 'data', mimeType: details.output.mimeType, base64Data: encodeBase64(details.output.value) } }
                : details,
            toolSpecificData: this.toolSpecificData,
            toolCallId: this.toolCallId,
            toolId: this.toolId,
            fromSubAgent: this.fromSubAgent,
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvb2xJbnZvY2F0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL2NoYXRQcm9ncmVzc1R5cGVzL2NoYXRUb29sSW52b2NhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFcEUsT0FBTyxFQUFvQyxlQUFlLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUM3RyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUErRixtQkFBbUIsRUFBd0YsTUFBTSxtQkFBbUIsQ0FBQztBQUMzTyxPQUFPLEVBQTJCLHlCQUF5QixFQUF3RixNQUFNLGlDQUFpQyxDQUFDO0FBRTNMLE1BQU0sT0FBTyxrQkFBa0I7SUFrQjlCLElBQVcsS0FBSztRQUNmLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUNwQixDQUFDO0lBR0QsWUFBWSxrQkFBdUQsRUFBRSxRQUFtQixFQUFrQixVQUFrQixFQUFFLFlBQWlDLEVBQUUsVUFBbUI7UUFBMUUsZUFBVSxHQUFWLFVBQVUsQ0FBUTtRQXRCNUcsU0FBSSxHQUFxQixnQkFBZ0IsQ0FBQztRQWN6QyxjQUFTLEdBQUcsZUFBZSxDQUF1RSxJQUFJLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQVN6SSxNQUFNLGNBQWMsR0FBRyxRQUFRLENBQUMsdUJBQXVCLEVBQUUsV0FBVyxFQUFFLElBQUksUUFBUSxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUM7UUFDbkcsTUFBTSxpQkFBaUIsR0FBRyxrQkFBa0IsRUFBRSxpQkFBaUIsSUFBSSxjQUFjLENBQUM7UUFDbEYsSUFBSSxDQUFDLGlCQUFpQixHQUFHLGlCQUFpQixDQUFDO1FBQzND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