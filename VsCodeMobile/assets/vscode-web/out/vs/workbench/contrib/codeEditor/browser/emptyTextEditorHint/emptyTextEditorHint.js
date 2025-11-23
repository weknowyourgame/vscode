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
var EmptyTextEditorHintContentWidget_1;
import { $, addDisposableListener, getActiveWindow } from '../../../../../base/browser/dom.js';
import { renderFormattedText } from '../../../../../base/browser/formattedTextRenderer.js';
import { StandardMouseEvent } from '../../../../../base/browser/mouseEvent.js';
import { status } from '../../../../../base/browser/ui/aria/aria.js';
import { Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { registerEditorContribution } from '../../../../../editor/browser/editorExtensions.js';
import { Position } from '../../../../../editor/common/core/position.js';
import { PLAINTEXT_LANGUAGE_ID } from '../../../../../editor/common/languages/modesRegistry.js';
import { localize } from '../../../../../nls.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { ChangeLanguageAction } from '../../../../browser/parts/editor/editorStatus.js';
import { LOG_MODE_ID, OUTPUT_MODE_ID } from '../../../../services/output/common/output.js';
import { SEARCH_RESULT_LANGUAGE_ID } from '../../../../services/search/common/search.js';
import { IChatAgentService } from '../../../chat/common/chatAgents.js';
import { ChatAgentLocation } from '../../../chat/common/constants.js';
import { IInlineChatSessionService } from '../../../inlineChat/browser/inlineChatSessionService.js';
import './emptyTextEditorHint.css';
export const emptyTextEditorHintSetting = 'workbench.editor.empty.hint';
let EmptyTextEditorHintContribution = class EmptyTextEditorHintContribution extends Disposable {
    static { this.ID = 'editor.contrib.emptyTextEditorHint'; }
    constructor(editor, configurationService, inlineChatSessionService, chatAgentService, instantiationService) {
        super();
        this.editor = editor;
        this.configurationService = configurationService;
        this.inlineChatSessionService = inlineChatSessionService;
        this.chatAgentService = chatAgentService;
        this.instantiationService = instantiationService;
        this._register(this.editor.onDidChangeModel(() => this.update()));
        this._register(this.editor.onDidChangeModelLanguage(() => this.update()));
        this._register(this.editor.onDidChangeModelContent(() => this.update()));
        this._register(this.chatAgentService.onDidChangeAgents(() => this.update()));
        this._register(this.editor.onDidChangeModelDecorations(() => this.update()));
        this._register(this.editor.onDidChangeConfiguration((e) => {
            if (e.hasChanged(104 /* EditorOption.readOnly */)) {
                this.update();
            }
        }));
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(emptyTextEditorHintSetting)) {
                this.update();
            }
        }));
        this._register(inlineChatSessionService.onWillStartSession(editor => {
            if (this.editor === editor) {
                this.textHintContentWidget?.dispose();
            }
        }));
        this._register(inlineChatSessionService.onDidEndSession(e => {
            if (this.editor === e.editor) {
                this.update();
            }
        }));
    }
    shouldRenderHint() {
        const configValue = this.configurationService.getValue(emptyTextEditorHintSetting);
        if (configValue === 'hidden') {
            return false;
        }
        if (this.editor.getOption(104 /* EditorOption.readOnly */)) {
            return false;
        }
        const model = this.editor.getModel();
        const languageId = model?.getLanguageId();
        if (!model || languageId === OUTPUT_MODE_ID || languageId === LOG_MODE_ID || languageId === SEARCH_RESULT_LANGUAGE_ID) {
            return false;
        }
        if (this.inlineChatSessionService.getSession(this.editor, model.uri)) {
            return false;
        }
        if (this.editor.getModel()?.getValueLength()) {
            return false;
        }
        const hasConflictingDecorations = Boolean(this.editor.getLineDecorations(1)?.find((d) => d.options.beforeContentClassName
            || d.options.afterContentClassName
            || d.options.before?.content
            || d.options.after?.content));
        if (hasConflictingDecorations) {
            return false;
        }
        const hasEditorAgents = Boolean(this.chatAgentService.getDefaultAgent(ChatAgentLocation.EditorInline));
        const shouldRenderDefaultHint = model?.uri.scheme === Schemas.untitled && languageId === PLAINTEXT_LANGUAGE_ID;
        return hasEditorAgents || shouldRenderDefaultHint;
    }
    update() {
        const shouldRenderHint = this.shouldRenderHint();
        if (shouldRenderHint && !this.textHintContentWidget) {
            this.textHintContentWidget = this.instantiationService.createInstance(EmptyTextEditorHintContentWidget, this.editor);
        }
        else if (!shouldRenderHint && this.textHintContentWidget) {
            this.textHintContentWidget.dispose();
            this.textHintContentWidget = undefined;
        }
    }
    dispose() {
        super.dispose();
        this.textHintContentWidget?.dispose();
    }
};
EmptyTextEditorHintContribution = __decorate([
    __param(1, IConfigurationService),
    __param(2, IInlineChatSessionService),
    __param(3, IChatAgentService),
    __param(4, IInstantiationService)
], EmptyTextEditorHintContribution);
export { EmptyTextEditorHintContribution };
let EmptyTextEditorHintContentWidget = class EmptyTextEditorHintContentWidget extends Disposable {
    static { EmptyTextEditorHintContentWidget_1 = this; }
    static { this.ID = 'editor.widget.emptyHint'; }
    constructor(editor, commandService, configurationService, keybindingService, chatAgentService, telemetryService, contextMenuService) {
        super();
        this.editor = editor;
        this.commandService = commandService;
        this.configurationService = configurationService;
        this.keybindingService = keybindingService;
        this.chatAgentService = chatAgentService;
        this.telemetryService = telemetryService;
        this.contextMenuService = contextMenuService;
        this.isVisible = false;
        this.ariaLabel = '';
        this._register(this.editor.onDidChangeConfiguration((e) => {
            if (this.domNode && e.hasChanged(59 /* EditorOption.fontInfo */)) {
                this.editor.applyFontInfo(this.domNode);
            }
        }));
        const onDidFocusEditorText = Event.debounce(this.editor.onDidFocusEditorText, () => undefined, 500);
        this._register(onDidFocusEditorText(() => {
            if (this.editor.hasTextFocus() && this.isVisible && this.ariaLabel && this.configurationService.getValue("accessibility.verbosity.emptyEditorHint" /* AccessibilityVerbositySettingId.EmptyEditorHint */)) {
                status(this.ariaLabel);
            }
        }));
        this.editor.addContentWidget(this);
    }
    getId() {
        return EmptyTextEditorHintContentWidget_1.ID;
    }
    disableHint(e) {
        const disableHint = () => {
            this.configurationService.updateValue(emptyTextEditorHintSetting, 'hidden');
            this.dispose();
            this.editor.focus();
        };
        if (!e) {
            disableHint();
            return;
        }
        this.contextMenuService.showContextMenu({
            getAnchor: () => { return new StandardMouseEvent(getActiveWindow(), e); },
            getActions: () => {
                return [{
                        id: 'workench.action.disableEmptyEditorHint',
                        label: localize('disableEditorEmptyHint', "Disable Empty Editor Hint"),
                        tooltip: localize('disableEditorEmptyHint', "Disable Empty Editor Hint"),
                        enabled: true,
                        class: undefined,
                        run: () => {
                            disableHint();
                        }
                    }
                ];
            }
        });
    }
    getHint() {
        const hasInlineChatProvider = this.chatAgentService.getActivatedAgents().filter(candidate => candidate.locations.includes(ChatAgentLocation.EditorInline)).length > 0;
        const hintHandler = {
            disposables: this._store,
            callback: (index, event) => {
                switch (index) {
                    case '0':
                        hasInlineChatProvider ? askSomething(event.browserEvent) : languageOnClickOrTap(event.browserEvent);
                        break;
                    case '1':
                        hasInlineChatProvider ? languageOnClickOrTap(event.browserEvent) : this.disableHint();
                        break;
                    case '2':
                        this.disableHint();
                        break;
                }
            }
        };
        // the actual command handlers...
        const askSomethingCommandId = 'inlineChat.start';
        const askSomething = async (e) => {
            e.stopPropagation();
            this.telemetryService.publicLog2('workbenchActionExecuted', {
                id: askSomethingCommandId,
                from: 'hint'
            });
            await this.commandService.executeCommand(askSomethingCommandId, { from: 'hint' });
        };
        const languageOnClickOrTap = async (e) => {
            e.stopPropagation();
            // Need to focus editor before so current editor becomes active and the command is properly executed
            this.editor.focus();
            this.telemetryService.publicLog2('workbenchActionExecuted', {
                id: ChangeLanguageAction.ID,
                from: 'hint'
            });
            await this.commandService.executeCommand(ChangeLanguageAction.ID);
            this.editor.focus();
        };
        const keybindingsLookup = [askSomethingCommandId, ChangeLanguageAction.ID];
        const keybindingLabels = keybindingsLookup.map(id => this.keybindingService.lookupKeybinding(id)?.getLabel());
        const hintMsg = (hasInlineChatProvider ? localize({
            key: 'emptyTextEditorHintWithInlineChat',
            comment: [
                'Preserve double-square brackets and their order',
                'language refers to a programming language'
            ]
        }, '[[Generate code]] ({0}), or [[select a language]] ({1}). Start typing to dismiss or [[don\'t show]] this again.', keybindingLabels.at(0) ?? '', keybindingLabels.at(1) ?? '') : localize({
            key: 'emptyTextEditorHintWithoutInlineChat',
            comment: [
                'Preserve double-square brackets and their order',
                'language refers to a programming language'
            ]
        }, '[[Select a language]] ({0}) to get started. Start typing to dismiss or [[don\'t show]] this again.', keybindingLabels.at(1) ?? '')).replaceAll(' ()', '');
        const hintElement = renderFormattedText(hintMsg, {
            actionHandler: hintHandler,
            renderCodeSegments: false,
        });
        hintElement.style.fontStyle = 'italic';
        const ariaLabel = hasInlineChatProvider ?
            localize('defaultHintAriaLabelWithInlineChat', 'Execute {0} to ask a question, execute {1} to select a language and get started. Start typing to dismiss.', ...keybindingLabels) :
            localize('defaultHintAriaLabelWithoutInlineChat', 'Execute {0} to select a language and get started. Start typing to dismiss.', ...keybindingLabels);
        // eslint-disable-next-line no-restricted-syntax
        for (const anchor of hintElement.querySelectorAll('a')) {
            anchor.style.cursor = 'pointer';
        }
        return { hintElement, ariaLabel };
    }
    getDomNode() {
        if (!this.domNode) {
            this.domNode = $('.empty-editor-hint');
            this.domNode.style.width = 'max-content';
            this.domNode.style.paddingLeft = '4px';
            const { hintElement, ariaLabel } = this.getHint();
            this.domNode.append(hintElement);
            this.ariaLabel = ariaLabel.concat(localize('disableHint', ' Toggle {0} in settings to disable this hint.', "accessibility.verbosity.emptyEditorHint" /* AccessibilityVerbositySettingId.EmptyEditorHint */));
            this._register(addDisposableListener(this.domNode, 'click', () => {
                this.editor.focus();
            }));
            this.editor.applyFontInfo(this.domNode);
            const lineHeight = this.editor.getLineHeightForPosition(new Position(1, 1));
            this.domNode.style.lineHeight = lineHeight + 'px';
        }
        return this.domNode;
    }
    getPosition() {
        return {
            position: { lineNumber: 1, column: 1 },
            preference: [0 /* ContentWidgetPositionPreference.EXACT */]
        };
    }
    dispose() {
        super.dispose();
        this.editor.removeContentWidget(this);
    }
};
EmptyTextEditorHintContentWidget = EmptyTextEditorHintContentWidget_1 = __decorate([
    __param(1, ICommandService),
    __param(2, IConfigurationService),
    __param(3, IKeybindingService),
    __param(4, IChatAgentService),
    __param(5, ITelemetryService),
    __param(6, IContextMenuService)
], EmptyTextEditorHintContentWidget);
registerEditorContribution(EmptyTextEditorHintContribution.ID, EmptyTextEditorHintContribution, 0 /* EditorContributionInstantiation.Eager */); // eager because it needs to render a help message
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW1wdHlUZXh0RWRpdG9ySGludC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvZW1wdHlUZXh0RWRpdG9ySGludC9lbXB0eVRleHRFZGl0b3JIaW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsQ0FBQyxFQUFFLHFCQUFxQixFQUFFLGVBQWUsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQy9GLE9BQU8sRUFBeUIsbUJBQW1CLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNsSCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMvRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFckUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFaEUsT0FBTyxFQUFtQywwQkFBMEIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBRWhJLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUV6RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUNoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSxxQkFBcUIsRUFB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