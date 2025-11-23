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
import { onUnexpectedError } from '../../../../../base/common/errors.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { runOnChange } from '../../../../../base/common/observable.js';
import { AnnotatedStringEdit } from '../../../../../editor/common/core/edits/stringEdit.js';
import { EditDeltaInfo } from '../../../../../editor/common/textModelEditSource.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { createDocWithJustReason } from '../helpers/documentWithAnnotatedEdits.js';
import { IAiEditTelemetryService } from './aiEditTelemetry/aiEditTelemetryService.js';
import { forwardToChannelIf, isCopilotLikeExtension } from '../../../../../platform/dataChannel/browser/forwardingTelemetryService.js';
import { ProviderId } from '../../../../../editor/common/languages.js';
import { ArcTelemetryReporter } from './arcTelemetryReporter.js';
import { IRandomService } from '../randomService.js';
let EditTelemetryReportInlineEditArcSender = class EditTelemetryReportInlineEditArcSender extends Disposable {
    constructor(docWithAnnotatedEdits, scmRepoBridge, _instantiationService) {
        super();
        this._instantiationService = _instantiationService;
        this._register(runOnChange(docWithAnnotatedEdits.value, (_val, _prev, changes) => {
            const edit = AnnotatedStringEdit.compose(changes.map(c => c.edit));
            if (!edit.replacements.some(r => r.data.editSource.metadata.source === 'inlineCompletionAccept')) {
                return;
            }
            if (!edit.replacements.every(r => r.data.editSource.metadata.source === 'inlineCompletionAccept')) {
                onUnexpectedError(new Error('ArcTelemetrySender: Not all edits are inline completion accept edits!'));
                return;
            }
            if (edit.replacements[0].data.editSource.metadata.source !== 'inlineCompletionAccept') {
                return;
            }
            const data = edit.replacements[0].data.editSource.metadata;
            const docWithJustReason = createDocWithJustReason(docWithAnnotatedEdits, this._store);
            const reporter = this._store.add(this._instantiationService.createInstance(ArcTelemetryReporter, [0, 30, 120, 300, 600, 900].map(s => s * 1000), _prev, docWithJustReason, scmRepoBridge, edit, res => {
                res.telemetryService.publicLog2('editTelemetry.reportInlineEditArc', {
                    extensionId: data.$extensionId ?? '',
                    extensionVersion: data.$extensionVersion ?? '',
                    opportunityId: data.$$requestUuid ?? 'unknown',
                    languageId: data.$$languageId,
                    didBranchChange: res.didBranchChange ? 1 : 0,
                    timeDelayMs: res.timeDelayMs,
                    originalCharCount: res.originalCharCount,
                    originalLineCount: res.originalLineCount,
                    originalDeletedLineCount: res.originalDeletedLineCount,
                    arc: res.arc,
                    currentLineCount: res.currentLineCount,
                    currentDeletedLineCount: res.currentDeletedLineCount,
                    ...forwardToChannelIf(isCopilotLikeExtension(data.$extensionId)),
                });
            }, () => {
                this._store.deleteAndLeak(reporter);
            }));
        }));
    }
};
EditTelemetryReportInlineEditArcSender = __decorate([
    __param(2, IInstantiationService)
], EditTelemetryReportInlineEditArcSender);
export { EditTelemetryReportInlineEditArcSender };
let CreateSuggestionIdForChatOrInlineChatCaller = class CreateSuggestionIdForChatOrInlineChatCaller extends Disposable {
    constructor(docWithAnnotatedEdits, _aiEditTelemetryService) {
        super();
        this._aiEditTelemetryService = _aiEditTelemetryService;
        this._register(runOnChange(docWithAnnotatedEdits.value, (_val, _prev, changes) => {
            const edit = AnnotatedStringEdit.compose(changes.map(c => c.edit));
            const supportedSource = new Set(['Chat.applyEdits', 'inlineChat.applyEdits']);
            if (!edit.replacements.some(r => supportedSource.has(r.data.editSource.metadata.source))) {
                return;
            }
            if (!edit.replacements.every(r => supportedSource.has(r.data.editSource.metadata.source))) {
                onUnexpectedError(new Error(`ArcTelemetrySender: Not all edits are ${edit.replacements[0].data.editSource.metadata.source}!`));
                return;
            }
            let applyCodeBlockSuggestionId = undefined;
            const data = edit.replacements[0].data.editSource;
            let feature;
            if (data.metadata.source === 'Chat.applyEdits') {
                feature = 'sideBarChat';
                if (data.metadata.$$mode === 'applyCodeBlock') {
                    applyCodeBlockSuggestionId = data.metadata.$$codeBlockSuggestionId;
                }
            }
            else {
                feature = 'inlineChat';
            }
            const providerId = new ProviderId(data.props.$extensionId, data.props.$extensionVersion, data.props.$providerId);
            // TODO@hediet tie this suggestion id to hunks, so acceptance can be correlated.
            this._aiEditTelemetryService.createSuggestionId({
                applyCodeBlockSuggestionId,
                languageId: data.props.$$languageId,
                presentation: 'highlightedEdit',
                feature,
                source: providerId,
                modelId: data.props.$modelId,
                // eslint-disable-next-line local/code-no-any-casts
                modeId: data.props.$$mode,
                editDeltaInfo: EditDeltaInfo.fromEdit(edit, _prev),
            });
        }));
    }
};
CreateSuggestionIdForChatOrInlineChatCaller = __decorate([
    __param(1, IAiEditTelemetryService)
], CreateSuggestionIdForChatOrInlineChatCaller);
export { CreateSuggestionIdForChatOrInlineChatCaller };
let EditTelemetryReportEditArcForChatOrInlineChatSender = class EditTelemetryReportEditArcForChatOrInlineChatSender extends Disposable {
    constructor(docWithAnnotatedEdits, scmRepoBridge, _instantiationService, _randomService) {
        super();
        this._instantiationService = _instantiationService;
        this._randomService = _randomService;
        this._register(runOnChange(docWithAnnotatedEdits.value, (_val, _prev, changes) => {
            const edit = AnnotatedStringEdit.compose(changes.map(c => c.edit));
            const supportedSource = new Set(['Chat.applyEdits', 'inlineChat.applyEdits']);
            if (!edit.replacements.some(r => supportedSource.has(r.data.editSource.metadata.source))) {
                return;
            }
            if (!edit.replacements.every(r => supportedSource.has(r.data.editSource.metadata.source))) {
                onUnexpectedError(new Error(`ArcTelemetrySender: Not all edits are ${edit.replacements[0].data.editSource.metadata.source}!`));
                return;
            }
            const data = edit.replacements[0].data.editSource;
            const uniqueEditId = this._randomService.generateUuid();
            const docWithJustReason = createDocWithJustReason(docWithAnnotatedEdits, this._store);
            const reporter = this._store.add(this._instantiationService.createInstance(ArcTelemetryReporter, [0, 60, 300].map(s => s * 1000), _prev, docWithJustReason, scmRepoBridge, edit, res => {
                res.telemetryService.publicLog2('editTelemetry.reportEditArc', {
                    sourceKeyCleaned: data.toKey(Number.MAX_SAFE_INTEGER, {
                        $extensionId: false,
                        $extensionVersion: false,
                        $$requestUuid: false,
                        $$sessionId: false,
                        $$requestId: false,
                        $$languageId: false,
                        $modelId: false,
                    }),
                    extensionId: data.props.$extensionId,
                    extensionVersion: data.props.$extensionVersion,
                    opportunityId: data.props.$$requestUuid,
                    editSessionId: data.props.$$sessionId,
                    requestId: data.props.$$requestId,
                    modelId: data.props.$modelId,
                    languageId: data.props.$$languageId,
                    mode: data.props.$$mode,
                    uniqueEditId,
                    didBranchChange: res.didBranchChange ? 1 : 0,
                    timeDelayMs: res.timeDelayMs,
                    originalCharCount: res.originalCharCount,
                    originalLineCount: res.originalLineCount,
                    originalDeletedLineCount: res.originalDeletedLineCount,
                    arc: res.arc,
                    currentLineCount: res.currentLineCount,
                    currentDeletedLineCount: res.currentDeletedLineCount,
                    ...forwardToChannelIf(isCopilotLikeExtension(data.props.$extensionId)),
                });
            }, () => {
                this._store.deleteAndLeak(reporter);
            }));
        }));
    }
};
EditTelemetryReportEditArcForChatOrInlineChatSender = __decorate([
    __param(2, IInstantiationService),
    __param(3, IRandomService)
], EditTelemetryReportEditArcForChatOrInlineChatSender);
export { EditTelemetryReportEditArcForChatOrInlineChatSender };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJjVGVsZW1ldHJ5U2VuZGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2VkaXRUZWxlbWV0cnkvYnJvd3Nlci90ZWxlbWV0cnkvYXJjVGVsZW1ldHJ5U2VuZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLEVBQWUsV0FBVyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDcEYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDNUYsT0FBTyxFQUFFLGFBQWEsRUFBa0QsTUFBTSxxREFBcUQsQ0FBQztBQUNwSSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQStDLHVCQUF1QixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDaEksT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFdEYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLHNCQUFzQixFQUFFLE1BQU0sMkVBQTJFLENBQUM7QUFDdkksT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ2pFLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUU5QyxJQUFNLHNDQUFzQyxHQUE1QyxNQUFNLHNDQUF1QyxTQUFRLFVBQVU7SUFDckUsWUFDQyxxQkFBa0UsRUFDbEUsYUFBc0QsRUFDZCxxQkFBNEM7UUFFcEYsS0FBSyxFQUFFLENBQUM7UUFGZ0MsMEJBQXFCLEdBQXJCLHFC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