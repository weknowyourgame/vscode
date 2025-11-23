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
import * as dom from '../../../../../../base/browser/dom.js';
import { status } from '../../../../../../base/browser/ui/aria/aria.js';
import { MarkdownString } from '../../../../../../base/common/htmlContent.js';
import { autorun } from '../../../../../../base/common/observable.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IChatToolInvocation } from '../../../common/chatService.js';
import { ChatProgressContentPart } from '../chatProgressContentPart.js';
import { BaseChatToolInvocationSubPart } from './chatToolInvocationSubPart.js';
let ChatToolProgressSubPart = class ChatToolProgressSubPart extends BaseChatToolInvocationSubPart {
    constructor(toolInvocation, context, renderer, announcedToolProgressKeys, instantiationService, configurationService) {
        super(toolInvocation);
        this.context = context;
        this.renderer = renderer;
        this.announcedToolProgressKeys = announcedToolProgressKeys;
        this.instantiationService = instantiationService;
        this.configurationService = configurationService;
        this.codeblocks = [];
        this.domNode = this.createProgressPart();
    }
    createProgressPart() {
        if (IChatToolInvocation.isComplete(this.toolInvocation) && this.toolIsConfirmed && this.toolInvocation.pastTenseMessage) {
            const key = this.getAnnouncementKey('complete');
            const completionContent = this.toolInvocation.pastTenseMessage ?? this.toolInvocation.invocationMessage;
            const shouldAnnounce = this.toolInvocation.kind === 'toolInvocation' && this.hasMeaningfulContent(completionContent) ? this.computeShouldAnnounce(key) : false;
            const part = this.renderProgressContent(completionContent, shouldAnnounce);
            this._register(part);
            return part.domNode;
        }
        else {
            const container = document.createElement('div');
            const progressObservable = this.toolInvocation.kind === 'toolInvocation' ? this.toolInvocation.state.map((s, r) => s.type === 1 /* IChatToolInvocation.StateKind.Executing */ ? s.progress.read(r) : undefined) : undefined;
            this._register(autorun(reader => {
                const progress = progressObservable?.read(reader);
                const key = this.getAnnouncementKey('progress');
                const progressContent = progress?.message ?? this.toolInvocation.invocationMessage;
                const shouldAnnounce = this.toolInvocation.kind === 'toolInvocation' && this.hasMeaningfulContent(progressContent) ? this.computeShouldAnnounce(key) : false;
                const part = reader.store.add(this.renderProgressContent(progressContent, shouldAnnounce));
                dom.reset(container, part.domNode);
            }));
            return container;
        }
    }
    get toolIsConfirmed() {
        const c = IChatToolInvocation.executionConfirmedOrDenied(this.toolInvocation);
        return !!c && c.type !== 0 /* ToolConfirmKind.Denied */;
    }
    renderProgressContent(content, shouldAnnounce) {
        if (typeof content === 'string') {
            content = new MarkdownString().appendText(content);
        }
        const progressMessage = {
            kind: 'progressMessage',
            content
        };
        if (shouldAnnounce) {
            this.provideScreenReaderStatus(content);
        }
        return this.instantiationService.createInstance(ChatProgressContentPart, progressMessage, this.renderer, this.context, undefined, true, this.getIcon(), this.toolInvocation);
    }
    getAnnouncementKey(kind) {
        return `${kind}:${this.toolInvocation.toolCallId}`;
    }
    computeShouldAnnounce(key) {
        if (!this.announcedToolProgressKeys) {
            return false;
        }
        if (!this.configurationService.getValue("accessibility.verboseChatProgressUpdates" /* AccessibilityWorkbenchSettingId.VerboseChatProgressUpdates */)) {
            return false;
        }
        if (this.announcedToolProgressKeys.has(key)) {
            return false;
        }
        this.announcedToolProgressKeys.add(key);
        return true;
    }
    provideScreenReaderStatus(content) {
        const message = typeof content === 'string' ? content : content.value;
        status(message);
    }
    hasMeaningfulContent(content) {
        if (!content) {
            return false;
        }
        const text = typeof content === 'string' ? content : content.value;
        return text.trim().length > 0;
    }
};
ChatToolProgressSubPart = __decorate([
    __param(4, IInstantiationService),
    __param(5, IConfigurationService)
], ChatToolProgressSubPart);
export { ChatToolProgressSubPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvb2xQcm9ncmVzc1BhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRDb250ZW50UGFydHMvdG9vbEludm9jYXRpb25QYXJ0cy9jaGF0VG9vbFByb2dyZXNzUGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLHVDQUF1QyxDQUFDO0FBQzdELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUN4RSxPQUFPLEVBQW1CLGNBQWMsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQy9GLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUV0RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUN6RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUN6RyxPQUFPLEVBQXdCLG1CQUFtQixFQUFrRCxNQUFNLGdDQUFnQyxDQUFDO0FBSTNJLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hFLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRXhFLElBQU0sdUJBQXVCLEdBQTdCLE1BQU0sdUJBQXdCLFNBQVEsNkJBQTZCO0lBS3pFLFlBQ0MsY0FBbUUsRUFDbEQsT0FBc0MsRUFDdEMsUUFBMkIsRUFDM0IseUJBQWtELEVBQzVDLG9CQUE0RCxFQUM1RCxvQkFBNEQ7UUFFbkYsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBTkwsWUFBTyxHQUFQLE9BQU8sQ0FBK0I7UUFDdEMsYUFBUSxHQUFSLFFBQVEsQ0FBbUI7UUFDM0IsOEJBQXlCLEdBQXpCLHlCQUF5QixDQUF5QjtRQUMzQix5QkFBb0IsR0FBcEIsb0JBQW9CLENBQXVCO1FBQzNDLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBdUI7UUFSM0QsZUFBVSxHQUF5QixFQUFFLENBQUM7UUFZOUQsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztJQUMxQyxDQUFDO0lBRU8sa0JBQWtCO1FBQ3pCLElBQUksbUJBQW1CLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxJQUFJLENBQUMsZUFBZSxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUN6SCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDaEQsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsaUJBQWlCLENBQUM7WUFDeEcsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEtBQUssZ0JBQWdCLElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1lBQy9KLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxpQkFBaUIsRUFBRSxjQUFjLENBQUMsQ0FBQztZQUMzRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3JCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUNyQixDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDaEQsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksS0FBSyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksb0RBQTRDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1lBQ3BOLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUMvQixNQUFNLFFBQVEsR0FBRyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ2xELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDaEQsTUFBTSxlQUFlLEdBQUcsUUFBUSxFQUFFLE9BQU8sSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLGlCQUFpQixDQUFDO2dCQUNuRixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksS0FBSyxnQkFBZ0IsSUFBSSxJQUFJLENBQUMsb0JBQW9CLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO2dCQUM3SixNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsZUFBZSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7Z0JBQzNGLEdBQUcsQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNwQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ0osT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztJQUNGLENBQUM7SUFFRCxJQUFZLGVBQWU7UUFDMUIsTUFBTSxDQUFDLEdBQUcsbUJBQW1CLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzlFLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxtQ0FBMkIsQ0FBQztJQUNqRCxDQUFDO0lBRU8scUJBQXFCLENBQUMsT0FBaUMsRUFBRSxjQUF1QjtRQUN2RixJQUFJLE9BQU8sT0FBTyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ2pDLE9BQU8sR0FBRyxJQUFJLGNBQWMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwRCxDQUFDO1FBRUQsTUFBTSxlQUFlLEdBQXlCO1lBQzdDLElBQUksRUFBRSxpQkFBaUI7WUFDdkIsT0FBTztTQUNQLENBQUM7UUFFRixJQUFJLGNBQWMsRUFBRSxDQUFDO1lBQ3BCLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN6QyxDQUFDO1FBRUQsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLHVCQUF1QixFQUFFLGVBQWUsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQzlLLENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxJQUE2QjtRQUN2RCxPQUFPLEdBQUcsSUFBSSxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDcEQsQ0FBQztJQUVPLHFCQUFxQixDQUFDLEdBQVc7UUFDeEMsSUFBSSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO1lBQ3JDLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsUUFBUSw2R0FBNEQsRUFBRSxDQUFDO1lBQ3JHLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELElBQUksSUFBSSxDQUFDLHlCQUF5QixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQzdDLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUNELElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDeEMsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRU8seUJBQXlCLENBQUMsT0FBaUM7UUFDbEUsTUFBTSxPQUFPLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7UUFDdEUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2pCLENBQUM7SUFFTyxvQkFBb0IsQ0FBQyxPQUE2QztRQUN6RSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDZCxPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFFRCxNQUFNLElBQUksR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztRQUNuRSxPQUFPLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQy9CLENBQUM7Q0FDRCxDQUFBO0FBOUZZLHVCQUF1QjtJQVVqQyxXQUFBLHFCQUFxQixDQUFBO0lBQ3JCLFdBQUEscUJBQXFCLENBQUE7R0FYWCx1QkFBdUIsQ0E4Rm5DIn0=