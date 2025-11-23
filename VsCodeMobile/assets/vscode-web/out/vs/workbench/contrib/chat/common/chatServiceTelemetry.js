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
import { URI } from '../../../../base/common/uri.js';
import { isLocation } from '../../../../editor/common/languages.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { ChatAgentVoteDirection, ChatCopyKind } from './chatService.js';
import { isImageVariableEntry } from './chatVariableEntries.js';
import { ILanguageModelsService } from './languageModels.js';
let ChatServiceTelemetry = class ChatServiceTelemetry {
    constructor(telemetryService) {
        this.telemetryService = telemetryService;
    }
    notifyUserAction(action) {
        if (action.action.kind === 'vote') {
            this.telemetryService.publicLog2('interactiveSessionVote', {
                direction: action.action.direction === ChatAgentVoteDirection.Up ? 'up' : 'down',
                agentId: action.agentId ?? '',
                command: action.command,
                reason: action.action.reason,
            });
        }
        else if (action.action.kind === 'copy') {
            this.telemetryService.publicLog2('interactiveSessionCopy', {
                copyKind: action.action.copyKind === ChatCopyKind.Action ? 'action' : 'toolbar',
                agentId: action.agentId ?? '',
                command: action.command,
            });
        }
        else if (action.action.kind === 'insert') {
            this.telemetryService.publicLog2('interactiveSessionInsert', {
                newFile: !!action.action.newFile,
                agentId: action.agentId ?? '',
                command: action.command,
            });
        }
        else if (action.action.kind === 'apply') {
            this.telemetryService.publicLog2('interactiveSessionApply', {
                newFile: !!action.action.newFile,
                codeMapper: action.action.codeMapper,
                agentId: action.agentId ?? '',
                command: action.command,
                editsProposed: !!action.action.editsProposed,
            });
        }
        else if (action.action.kind === 'runInTerminal') {
            this.telemetryService.publicLog2('interactiveSessionRunInTerminal', {
                languageId: action.action.languageId ?? '',
                agentId: action.agentId ?? '',
                command: action.command,
            });
        }
        else if (action.action.kind === 'followUp') {
            this.telemetryService.publicLog2('chatFollowupClicked', {
                agentId: action.agentId ?? '',
                command: action.command,
            });
        }
        else if (action.action.kind === 'chatEditingHunkAction') {
            this.telemetryService.publicLog2('chatEditHunk', {
                agentId: action.agentId ?? '',
                outcome: action.action.outcome,
                lineCount: action.action.lineCount,
                hasRemainingEdits: action.action.hasRemainingEdits,
            });
        }
    }
    retrievedFollowups(agentId, command, numFollowups) {
        this.telemetryService.publicLog2('chatFollowupsRetrieved', {
            agentId,
            command,
            numFollowups,
        });
    }
};
ChatServiceTelemetry = __decorate([
    __param(0, ITelemetryService)
], ChatServiceTelemetry);
export { ChatServiceTelemetry };
function getCodeBlocks(text) {
    const lines = text.split('\n');
    const codeBlockLanguages = [];
    let codeBlockState;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (codeBlockState) {
            if (new RegExp(`^\\s*${codeBlockState.delimiter}\\s*$`).test(line)) {
                codeBlockLanguages.push(codeBlockState.languageId);
                codeBlockState = undefined;
            }
        }
        else {
            const match = line.match(/^(\s*)(`{3,}|~{3,})(\w*)/);
            if (match) {
                codeBlockState = { delimiter: match[2], languageId: match[3] };
            }
        }
    }
    return codeBlockLanguages;
}
let ChatRequestTelemetry = class ChatRequestTelemetry {
    constructor(opts, telemetryService, languageModelsService) {
        this.opts = opts;
        this.telemetryService = telemetryService;
        this.languageModelsService = languageModelsService;
        this.isComplete = false;
    }
    complete({ timeToFirstProgress, totalTime, result, requestType, request, detectedAgent }) {
        if (this.isComplete) {
            return;
        }
        this.isComplete = true;
        this.telemetryService.publicLog2('interactiveSessionProviderInvoked', {
            timeToFirstProgress,
            totalTime,
            result,
            requestType,
            agent: detectedAgent?.id ?? this.opts.agent.id,
            agentExtensionId: detectedAgent?.extensionId.value ?? this.opts.agent.extensionId.value,
            slashCommand: this.opts.agentSlashCommandPart ? this.opts.agentSlashCommandPart.command.name : this.opts.commandPart?.slashCommand.command,
            chatSessionId: this.opts.sessionId,
            enableCommandDetection: this.opts.enableCommandDetection,
            isParticipantDetected: !!detectedAgent,
            location: this.opts.location,
            citations: request.response?.codeCitations.length ?? 0,
            numCodeBlocks: getCodeBlocks(request.response?.response.toString() ?? '').length,
            attachmentKinds: this.attachmentKindsForTelemetry(request.variableData),
            model: this.resolveModelId(this.opts.options?.userSelectedModelId),
        });
    }
    attachmentKindsForTelemetry(variableData) {
        // this shows why attachments still have to be cleaned up somewhat
        return variableData.variables.map(v => {
            if (v.kind === 'implicit') {
                return 'implicit';
            }
            else if (v.range) {
                // 'range' is range within the prompt text
                if (v.kind === 'tool') {
                    return 'toolInPrompt';
                }
                else if (v.kind === 'toolset') {
                    return 'toolsetInPrompt';
                }
                else {
                    return 'fileInPrompt';
                }
            }
            else if (v.kind === 'command') {
                return 'command';
            }
            else if (v.kind === 'symbol') {
                return 'symbol';
            }
            else if (isImageVariableEntry(v)) {
                return 'image';
            }
            else if (v.kind === 'directory') {
                return 'directory';
            }
            else if (v.kind === 'tool') {
                return 'tool';
            }
            else if (v.kind === 'toolset') {
                return 'toolset';
            }
            else {
                if (URI.isUri(v.value)) {
                    return 'file';
                }
                else if (isLocation(v.value)) {
                    return 'location';
                }
                else {
                    return 'otherAttachment';
                }
            }
        });
    }
    resolveModelId(userSelectedModelId) {
        return userSelectedModelId && this.languageModelsService.lookupLanguageModel(userSelectedModelId)?.id;
    }
};
ChatRequestTelemetry = __decorate([
    __param(1, ITelemetryService),
    __param(2, ILanguageModelsService)
], ChatRequestTelemetry);
export { ChatRequestTelemetry };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFNlcnZpY2VUZWxlbWV0cnkuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vY2hhdFNlcnZpY2VUZWxlbWV0cnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNwRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUl2RixPQUFPLEVBQUUsc0JBQXNCLEVBQUUsWUFBWSxFQUFpRCxNQUFNLGtCQUFrQixDQUFDO0FBQ3ZILE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBRWhFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBOEp0RCxJQUFNLG9CQUFvQixHQUExQixNQUFNLG9CQUFvQjtJQUNoQyxZQUNxQyxnQkFBbUM7UUFBbkMscUJBQWdCLEdBQWhCLGdCQUFnQixDQUFtQjtJQUNwRSxDQUFDO0lBRUwsZ0JBQWdCLENBQUMsTUFBNEI7UUFDNUMsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUNuQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUF3Qyx3QkFBd0IsRUFBRTtnQkFDakcsU0FBUyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxLQUFLLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNO2dCQUNoRixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sSUFBSSxFQUFFO2dCQUM3QixPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU87Z0JBQ3ZC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