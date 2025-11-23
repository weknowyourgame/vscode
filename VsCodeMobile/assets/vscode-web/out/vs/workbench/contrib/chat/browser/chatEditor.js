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
import * as dom from '../../../../base/browser/dom.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { raceCancellationError } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import * as nls from '../../../../nls.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { editorBackground, editorForeground, inputBackground } from '../../../../platform/theme/common/colorRegistry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { EDITOR_DRAG_AND_DROP_BACKGROUND } from '../../../common/theme.js';
import { ChatContextKeys } from '../common/chatContextKeys.js';
import { IChatService } from '../common/chatService.js';
import { IChatSessionsService, localChatSessionType } from '../common/chatSessionsService.js';
import { ChatAgentLocation, ChatModeKind } from '../common/constants.js';
import { clearChatEditor } from './actions/chatClear.js';
import { ChatEditorInput } from './chatEditorInput.js';
import { ChatWidget } from './chatWidget.js';
let ChatEditor = class ChatEditor extends EditorPane {
    get widget() {
        return this._widget;
    }
    get scopedContextKeyService() {
        return this._scopedContextKeyService;
    }
    constructor(group, telemetryService, themeService, instantiationService, storageService, chatSessionsService, contextKeyService, chatService) {
        super(ChatEditorInput.EditorID, group, telemetryService, themeService, storageService);
        this.instantiationService = instantiationService;
        this.chatSessionsService = chatSessionsService;
        this.contextKeyService = contextKeyService;
        this.chatService = chatService;
        this.dimension = new dom.Dimension(0, 0);
    }
    async clear() {
        if (this.input) {
            return this.instantiationService.invokeFunction(clearChatEditor, this.input);
        }
    }
    createEditor(parent) {
        this._editorContainer = parent;
        // Ensure the container has position relative for the loading overlay
        parent.classList.add('chat-editor-relative');
        this._scopedContextKeyService = this._register(this.contextKeyService.createScoped(parent));
        const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, this.scopedContextKeyService])));
        ChatContextKeys.inChatEditor.bindTo(this._scopedContextKeyService).set(true);
        this._widget = this._register(scopedInstantiationService.createInstance(ChatWidget, ChatAgentLocation.Chat, undefined, {
            autoScroll: mode => mode !== ChatModeKind.Ask,
            renderFollowups: true,
            supportsFileReferences: true,
            clear: () => this.clear(),
            rendererOptions: {
                renderTextEditsAsSummary: (uri) => {
                    return true;
                },
                referencesExpandedWhenEmptyResponse: false,
                progressMessageAtBottomOfResponse: mode => mode !== ChatModeKind.Ask,
            },
            enableImplicitContext: true,
            enableWorkingSet: 'explicit',
            supportsChangingModes: true,
        }, {
            listForeground: editorForeground,
            listBackground: editorBackground,
            overlayBackground: EDITOR_DRAG_AND_DROP_BACKGROUND,
            inputEditorBackground: inputBackground,
            resultEditorBackground: editorBackground
        }));
        this._register(this.widget.onDidSubmitAgent(() => {
            this.group.pinEditor(this.input);
        }));
        this.widget.render(parent);
        this.widget.setVisible(true);
    }
    setEditorVisible(visible) {
        super.setEditorVisible(visible);
        this.widget?.setVisible(visible);
        if (visible && this.widget) {
            this.widget.layout(this.dimension.height, this.dimension.width);
        }
    }
    focus() {
        super.focus();
        this.widget?.focusInput();
    }
    clearInput() {
        this.saveState();
        this.widget.setModel(undefined);
        super.clearInput();
    }
    showLoadingInChatWidget(message) {
        if (!this._editorContainer) {
            return;
        }
        // If already showing, just update text
        if (this._loadingContainer) {
            // eslint-disable-next-line no-restricted-syntax
            const existingText = this._loadingContainer.querySelector('.chat-loading-content span');
            if (existingText) {
                existingText.textContent = message;
                return; // aria-live will announce the text change
            }
            this.hideLoadingInChatWidget(); // unexpected structure
        }
        // Mark container busy for assistive technologies
        this._editorContainer.setAttribute('aria-busy', 'true');
        this._loadingContainer = dom.append(this._editorContainer, dom.$('.chat-loading-overlay'));
        // Accessibility: announce loading state politely without stealing focus
        this._loadingContainer.setAttribute('role', 'status');
        this._loadingContainer.setAttribute('aria-live', 'polite');
        // Rely on live region text content instead of aria-label to avoid duplicate announcements
        this._loadingContainer.tabIndex = -1; // ensure it isn't focusable
        const loadingContent = dom.append(this._loadingContainer, dom.$('.chat-loading-content'));
        const spinner = renderIcon(ThemeIcon.modify(Codicon.loading, 'spin'));
        spinner.setAttribute('aria-hidden', 'true');
        loadingContent.appendChild(spinner);
        const text = dom.append(loadingContent, dom.$('span'));
        text.textContent = message;
    }
    hideLoadingInChatWidget() {
        if (this._loadingContainer) {
            this._loadingContainer.remove();
            this._loadingContainer = undefined;
        }
        if (this._editorContainer) {
            this._editorContainer.removeAttribute('aria-busy');
        }
    }
    async setInput(input, options, context, token) {
        // Show loading indicator early for non-local sessions to prevent layout shifts
        let isContributedChatSession = false;
        const chatSessionType = input.getSessionType();
        if (chatSessionType !== localChatSessionType) {
            const loadingMessage = nls.localize('chatEditor.loadingSession', "Loading...");
            this.showLoadingInChatWidget(loadingMessage);
        }
        await super.setInput(input, options, context, token);
        if (token.isCancellationRequested) {
            this.hideLoadingInChatWidget();
            return;
        }
        if (!this.widget) {
            throw new Error('ChatEditor lifecycle issue: no editor widget');
        }
        if (chatSessionType !== localChatSessionType) {
            try {
                await raceCancellationError(this.chatSessionsService.canResolveChatSession(input.resource), token);
                const contributions = this.chatSessionsService.getAllChatSessionContributions();
                const contribution = contributions.find(c => c.type === chatSessionType);
                if (contribution) {
                    this.widget.lockToCodingAgent(contribution.name, contribution.displayName, contribution.type);
                    isContributedChatSession = true;
                }
                else {
                    this.widget.unlockFromCodingAgent();
                }
            }
            catch (error) {
                this.hideLoadingInChatWidget();
                throw error;
            }
        }
        else {
            this.widget.unlockFromCodingAgent();
        }
        try {
            const editorModel = await raceCancellationError(input.resolve(), token);
            if (!editorModel) {
                throw new Error(`Failed to get model for chat editor. resource: ${input.sessionResource}`);
            }
            // Hide loading state before updating model
            if (chatSessionType !== localChatSessionType) {
                this.hideLoadingInChatWidget();
            }
            if (options?.modelInputState) {
                editorModel.model.inputModel.setState(options.modelInputState);
            }
            this.updateModel(editorModel.model);
            if (isContributedChatSession && options?.title?.preferred && input.sessionResource) {
                this.chatService.setChatSessionTitle(input.sessionResource, options.title.preferred);
            }
        }
        catch (error) {
            this.hideLoadingInChatWidget();
            throw error;
        }
    }
    updateModel(model) {
        this.widget.setModel(model);
    }
    layout(dimension, position) {
        this.dimension = dimension;
        if (this.widget) {
            this.widget.layout(dimension.height, dimension.width);
        }
    }
};
ChatEditor = __decorate([
    __param(1, ITelemetryService),
    __param(2, IThemeService),
    __param(3, IInstantiationService),
    __param(4, IStorageService),
    __param(5, IChatSessionsService),
    __param(6, IContextKeyService),
    __param(7, IChatService)
], ChatEditor);
export { ChatEditor };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRvci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNqRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUV6RSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFFLGtCQUFrQixFQUE0QixNQUFNLHNEQUFzRCxDQUFDO0FBRXBILE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBQ25HLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNqRixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN2RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsZ0JBQWdCLEVBQUUsZUFBZSxFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDekgsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUV6RSxPQUFPLEVBQUUsK0JBQStCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUUzRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sOEJBQThC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