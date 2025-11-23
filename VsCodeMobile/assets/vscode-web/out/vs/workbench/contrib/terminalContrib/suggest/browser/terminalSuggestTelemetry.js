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
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { isString } from '../../../../../base/common/types.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { TerminalCompletionItemKind } from './terminalCompletionItem.js';
let TerminalSuggestTelemetry = class TerminalSuggestTelemetry extends Disposable {
    constructor(commandDetection, _promptInputModel, _telemetryService) {
        super();
        this._promptInputModel = _promptInputModel;
        this._telemetryService = _telemetryService;
        this._kindMap = new Map([
            [TerminalCompletionItemKind.File, 'File'],
            [TerminalCompletionItemKind.Folder, 'Folder'],
            [TerminalCompletionItemKind.Method, 'Method'],
            [TerminalCompletionItemKind.Alias, 'Alias'],
            [TerminalCompletionItemKind.Argument, 'Argument'],
            [TerminalCompletionItemKind.Option, 'Option'],
            [TerminalCompletionItemKind.OptionValue, 'Option Value'],
            [TerminalCompletionItemKind.Flag, 'Flag'],
            [TerminalCompletionItemKind.InlineSuggestion, 'Inline Suggestion'],
            [TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop, 'Inline Suggestion'],
        ]);
        this._register(commandDetection.onCommandFinished((e) => {
            this._sendTelemetryInfo(false, e.exitCode);
            this._acceptedCompletions = undefined;
        }));
        this._register(this._promptInputModel.onDidInterrupt(() => {
            this._sendTelemetryInfo(true);
            this._acceptedCompletions = undefined;
        }));
    }
    acceptCompletion(sessionId, completion, commandLine) {
        if (!completion || !commandLine) {
            this._acceptedCompletions = undefined;
            return;
        }
        this._acceptedCompletions = this._acceptedCompletions || [];
        this._acceptedCompletions.push({ label: isString(completion.label) ? completion.label : completion.label.label, kind: this._kindMap.get(completion.kind), sessionId, provider: completion.provider });
    }
    /**
     * Logs the latency (ms) from completion request to completions shown.
     * @param sessionId The terminal session ID
     * @param latency The measured latency in ms
     * @param firstShownFor Object indicating if completions have been shown for window/shell
     */
    logCompletionLatency(sessionId, latency, firstShownFor) {
        this._telemetryService.publicLog2('terminal.suggest.completionLatency', {
            terminalSessionId: sessionId,
            latency,
            firstWindow: firstShownFor.window,
            firstShell: firstShownFor.shell
        });
    }
    _sendTelemetryInfo(fromInterrupt, exitCode) {
        const commandLine = this._promptInputModel?.value;
        for (const completion of this._acceptedCompletions || []) {
            const label = completion?.label;
            const kind = completion?.kind;
            const provider = completion?.provider;
            if (label === undefined || commandLine === undefined || kind === undefined || provider === undefined) {
                return;
            }
            let outcome;
            if (fromInterrupt) {
                outcome = "Interrupted" /* CompletionOutcome.Interrupted */;
            }
            else if (commandLine.trim() && commandLine.includes(label)) {
                outcome = "Accepted" /* CompletionOutcome.Accepted */;
            }
            else if (inputContainsFirstHalfOfLabel(commandLine, label)) {
                outcome = "AcceptedWithEdit" /* CompletionOutcome.AcceptedWithEdit */;
            }
            else {
                outcome = "Deleted" /* CompletionOutcome.Deleted */;
            }
            this._telemetryService.publicLog2('terminal.suggest.acceptedCompletion', {
                kind,
                outcome,
                exitCode,
                terminalSessionId: completion.sessionId,
                provider
            });
        }
    }
};
TerminalSuggestTelemetry = __decorate([
    __param(2, ITelemetryService)
], TerminalSuggestTelemetry);
export { TerminalSuggestTelemetry };
var CompletionOutcome;
(function (CompletionOutcome) {
    CompletionOutcome["Accepted"] = "Accepted";
    CompletionOutcome["Deleted"] = "Deleted";
    CompletionOutcome["AcceptedWithEdit"] = "AcceptedWithEdit";
    CompletionOutcome["Interrupted"] = "Interrupted";
})(CompletionOutcome || (CompletionOutcome = {}));
function inputContainsFirstHalfOfLabel(commandLine, label) {
    return commandLine.includes(label.substring(0, Math.ceil(label.length / 2)));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxTdWdnZXN0VGVsZW1ldHJ5LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvdGVybWluYWxTdWdnZXN0VGVsZW1ldHJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDL0QsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFHMUYsT0FBTyxFQUF1QiwwQkFBMEIsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBRXZGLElBQU0sd0JBQXdCLEdBQTlCLE1BQU0sd0JBQXlCLFNBQVEsVUFBVTtJQWdCdkQsWUFDQyxnQkFBNkMsRUFDNUIsaUJBQW9DLEVBQ2xDLGlCQUFxRDtRQUV4RSxLQUFLLEVBQUUsQ0FBQztRQUhTLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBbUI7UUFDakIsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFtQjtRQWhCakUsYUFBUSxHQUFHLElBQUksR0FBRyxDQUFpQjtZQUMxQyxDQUFDLDBCQUEwQixDQUFDLElBQUksRUFBRSxNQUFNLENBQUM7WUFDekMsQ0FBQywwQkFBMEIsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDO1lBQzdDLENBQUMsMEJBQTBCLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQztZQUM3QyxDQUFDLDBCQUEwQixDQUFDLEtBQUssRUFBRSxPQUFPLENBQUM7WUFDM0MsQ0FBQywwQkFBMEIsQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDO1lBQ2pELENBQUMsMEJBQTBCLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQztZQUM3QyxDQUFDLDBCQUEwQixD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