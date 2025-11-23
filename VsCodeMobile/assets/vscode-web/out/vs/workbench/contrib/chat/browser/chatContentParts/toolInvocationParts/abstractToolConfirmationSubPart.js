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
import { Codicon } from '../../../../../../base/common/codicons.js';
import { toDisposable } from '../../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../../nls.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../../platform/keybinding/common/keybinding.js';
import { ChatContextKeys } from '../../../common/chatContextKeys.js';
import { IChatToolInvocation } from '../../../common/chatService.js';
import { ILanguageModelToolsService } from '../../../common/languageModelToolsService.js';
import { IChatWidgetService } from '../../chat.js';
import { ChatCustomConfirmationWidget } from '../chatConfirmationWidget.js';
import { BaseChatToolInvocationSubPart } from './chatToolInvocationSubPart.js';
/**
 * Base class for a tool confirmation.
 *
 * note that implementors MUST call render() after they construct.
 */
let AbstractToolConfirmationSubPart = class AbstractToolConfirmationSubPart extends BaseChatToolInvocationSubPart {
    constructor(toolInvocation, context, instantiationService, keybindingService, contextKeyService, chatWidgetService, languageModelToolsService) {
        super(toolInvocation);
        this.toolInvocation = toolInvocation;
        this.context = context;
        this.instantiationService = instantiationService;
        this.keybindingService = keybindingService;
        this.contextKeyService = contextKeyService;
        this.chatWidgetService = chatWidgetService;
        this.languageModelToolsService = languageModelToolsService;
        if (toolInvocation.kind !== 'toolInvocation') {
            throw new Error('Confirmation only works with live tool invocations');
        }
    }
    render(config) {
        const { keybindingService, languageModelToolsService, toolInvocation } = this;
        const allowKeybinding = keybindingService.lookupKeybinding(config.allowActionId)?.getLabel();
        const allowTooltip = allowKeybinding ? `${config.allowLabel} (${allowKeybinding})` : config.allowLabel;
        const skipKeybinding = keybindingService.lookupKeybinding(config.skipActionId)?.getLabel();
        const skipTooltip = skipKeybinding ? `${config.skipLabel} (${skipKeybinding})` : config.skipLabel;
        const additionalActions = this.additionalPrimaryActions();
        const buttons = [
            {
                label: config.allowLabel,
                tooltip: allowTooltip,
                data: () => {
                    this.confirmWith(toolInvocation, { type: 4 /* ToolConfirmKind.UserAction */ });
                },
                moreActions: additionalActions.length > 0 ? additionalActions : undefined,
            },
            {
                label: localize('skip', "Skip"),
                tooltip: skipTooltip,
                data: () => {
                    this.confirmWith(toolInvocation, { type: 5 /* ToolConfirmKind.Skipped */ });
                },
                isSecondary: true,
            }
        ];
        const contentElement = this.createContentElement();
        const tool = languageModelToolsService.getTool(toolInvocation.toolId);
        const confirmWidget = this._register(this.instantiationService.createInstance((ChatCustomConfirmationWidget), this.context, {
            title: this.getTitle(),
            icon: tool?.icon && 'id' in tool.icon ? tool.icon : Codicon.tools,
            subtitle: config.subtitle,
            buttons,
            message: contentElement,
            toolbarData: {
                arg: toolInvocation,
                partType: config.partType,
                partSource: toolInvocation.source.type
            }
        }));
        const hasToolConfirmation = ChatContextKeys.Editing.hasToolConfirmation.bindTo(this.contextKeyService);
        hasToolConfirmation.set(true);
        this._register(confirmWidget.onDidClick(button => {
            button.data();
            this.chatWidgetService.getWidgetBySessionResource(this.context.element.sessionResource)?.focusInput();
        }));
        this._register(confirmWidget.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
        this._register(toDisposable(() => hasToolConfirmation.reset()));
        this.domNode = confirmWidget.domNode;
    }
    confirmWith(toolInvocation, reason) {
        IChatToolInvocation.confirmWith(toolInvocation, reason);
    }
    additionalPrimaryActions() {
        return [];
    }
};
AbstractToolConfirmationSubPart = __decorate([
    __param(2, IInstantiationService),
    __param(3, IKeybindingService),
    __param(4, IContextKeyService),
    __param(5, IChatWidgetService),
    __param(6, ILanguageModelToolsService)
], AbstractToolConfirmationSubPart);
export { AbstractToolConfirmationSubPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJzdHJhY3RUb29sQ29uZmlybWF0aW9uU3ViUGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy90b29sSW52b2NhdGlvblBhcnRzL2Fic3RyYWN0VG9vbENvbmZpcm1hdGlvblN1YlBhcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDcEQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDaEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDekcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3JFLE9BQU8sRUFBbUIsbUJBQW1CLEVBQW1CLE1BQU0sZ0NBQWdDLENBQUM7QUFDdkcsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDMUYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ25ELE9BQU8sRUFBRSw0QkFBNEIsRUFBMkIsTUFBTSw4QkFBOEIsQ0FBQztBQUVyRyxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQWEvRTs7OztHQUlHO0FBQ0ksSUFBZSwrQkFBK0IsR0FBOUMsTUFBZSwrQkFBZ0MsU0FBUSw2QkFBNkI7SUFHMUYsWUFDNkIsY0FBbUMsRUFDNUMsT0FBc0MsRUFDZixv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