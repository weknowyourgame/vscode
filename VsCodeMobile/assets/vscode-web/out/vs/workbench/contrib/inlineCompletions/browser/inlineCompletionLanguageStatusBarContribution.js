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
import { createHotClass } from '../../../../base/common/hotReloadHelpers.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { autorunWithStore, debouncedObservable, derived, observableFromEvent } from '../../../../base/common/observable.js';
import Severity from '../../../../base/common/severity.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { InlineCompletionsController } from '../../../../editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController.js';
import { localize } from '../../../../nls.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ILanguageStatusService } from '../../../services/languageStatus/common/languageStatusService.js';
let InlineCompletionLanguageStatusBarContribution = class InlineCompletionLanguageStatusBarContribution extends Disposable {
    static { this.hot = createHotClass(this); }
    static { this.Id = 'vs.contrib.inlineCompletionLanguageStatusBarContribution'; }
    static { this.languageStatusBarDisposables = new Set(); }
    constructor(_languageStatusService, _editorService) {
        super();
        this._languageStatusService = _languageStatusService;
        this._editorService = _editorService;
        this._activeEditor = observableFromEvent(this, _editorService.onDidActiveEditorChange, () => this._editorService.activeTextEditorControl);
        this._state = derived(this, reader => {
            const editor = this._activeEditor.read(reader);
            if (!editor || !isCodeEditor(editor)) {
                return undefined;
            }
            const c = InlineCompletionsController.get(editor);
            const model = c?.model.read(reader);
            if (!model) {
                return undefined;
            }
            return {
                model,
                status: debouncedObservable(model.status, 300),
            };
        });
        this._register(autorunWithStore((reader, store) => {
            const state = this._state.read(reader);
            if (!state) {
                return;
            }
            const status = state.status.read(reader);
            const statusMap = {
                loading: { shortLabel: '', label: localize('inlineSuggestionLoading', "Loading..."), loading: true, },
                ghostText: { shortLabel: '$(lightbulb)', label: '$(copilot) ' + localize('inlineCompletionAvailable', "Inline completion available"), loading: false, },
                inlineEdit: { shortLabel: '$(lightbulb-sparkle)', label: '$(copilot) ' + localize('inlineEditAvailable', "Inline edit available"), loading: false, },
                noSuggestion: { shortLabel: '$(circle-slash)', label: '$(copilot) ' + localize('noInlineSuggestionAvailable', "No inline suggestion available"), loading: false, },
            };
            store.add(this._languageStatusService.addStatus({
                accessibilityInfo: undefined,
                busy: statusMap[status].loading,
                command: undefined,
                detail: localize('inlineSuggestionsSmall', "Inline suggestions"),
                id: 'inlineSuggestions',
                label: { value: statusMap[status].label, shortValue: statusMap[status].shortLabel },
                name: localize('inlineSuggestions', "Inline Suggestions"),
                selector: { pattern: state.model.textModel.uri.fsPath },
                severity: Severity.Info,
                source: 'inlineSuggestions',
            }));
        }));
    }
};
InlineCompletionLanguageStatusBarContribution = __decorate([
    __param(0, ILanguageStatusService),
    __param(1, IEditorService)
], InlineCompletionLanguageStatusBarContribution);
export { InlineCompletionLanguageStatusBarContribution };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lQ29tcGxldGlvbkxhbmd1YWdlU3RhdHVzQmFyQ29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvaW5saW5lQ29tcGxldGlvbkxhbmd1YWdlU3RhdHVzQmFyQ29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM3RSxPQUFPLEVBQUUsVUFBVSxFQUFtQixNQUFNLHNDQUFzQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxtQkFBbUIsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUM1SCxPQUFPLFFBQVEsTUFBTSxxQ0FBcUMsQ0FBQztBQUMzRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDM0UsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sZ0dBQWdHLENBQUM7QUFDN0ksT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBRTlDLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNsRixPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUVuRyxJQUFNLDZDQUE2QyxHQUFuRCxNQUFNLDZDQUE4QyxTQUFRLFVBQVU7YUFDckQsUUFBRyxHQUFHLGNBQWMsQ0FBQyxJQUFJLENBQUMsQUFBdkIsQ0FBd0I7YUFFcEMsT0FBRSxHQUFHLDBEQUEwRCxBQUE3RCxDQUE4RDthQUN2RCxpQ0FBNEIsR0FBRyxJQUFJLEdBQUcsRUFBbUIsQUFBN0IsQ0FBOEI7SUFLakYsWUFDMEMsc0JBQThDLEVBQ3RELGNBQThCO1FB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