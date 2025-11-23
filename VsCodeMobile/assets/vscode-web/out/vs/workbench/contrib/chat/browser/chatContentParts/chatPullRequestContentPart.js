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
import './media/chatPullRequestContent.css';
import * as dom from '../../../../../base/browser/dom.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { addDisposableListener } from '../../../../../base/browser/dom.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { renderAsPlaintext } from '../../../../../base/browser/markdownRenderer.js';
let ChatPullRequestContentPart = class ChatPullRequestContentPart extends Disposable {
    constructor(pullRequestContent, openerService) {
        super();
        this.pullRequestContent = pullRequestContent;
        this.openerService = openerService;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this.domNode = dom.$('.chat-pull-request-content-part');
        const container = dom.append(this.domNode, dom.$('.container'));
        const contentContainer = dom.append(container, dom.$('.content-container'));
        const titleContainer = dom.append(contentContainer, dom.$('.title-container'));
        const icon = dom.append(titleContainer, dom.$('.icon'));
        icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.gitPullRequest));
        const titleElement = dom.append(titleContainer, dom.$('.title'));
        titleElement.textContent = `${this.pullRequestContent.title} - ${this.pullRequestContent.author}`;
        const descriptionElement = dom.append(contentContainer, dom.$('.description'));
        const descriptionWrapper = dom.append(descriptionElement, dom.$('.description-wrapper'));
        const plainText = renderAsPlaintext({ value: this.pullRequestContent.description });
        descriptionWrapper.textContent = plainText;
        const seeMoreContainer = dom.append(descriptionElement, dom.$('.see-more'));
        const seeMore = dom.append(seeMoreContainer, dom.$('a'));
        seeMore.textContent = localize('chatPullRequest.seeMore', 'See more');
        this._register(addDisposableListener(seeMore, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openerService.open(this.pullRequestContent.uri);
        }));
        seeMore.href = this.pullRequestContent.uri.toString();
    }
    hasSameContent(other, followingContent, element) {
        return other.kind === 'pullRequest';
    }
    addDisposable(disposable) {
        this._register(disposable);
    }
};
ChatPullRequestContentPart = __decorate([
    __param(1, IOpenerService)
], ChatPullRequestContentPart);
export { ChatPullRequestContentPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFB1bGxSZXF1ZXN0Q29udGVudFBhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRDb250ZW50UGFydHMvY2hhdFB1bGxSZXF1ZXN0Q29udGVudFBhcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxvQ0FBb0MsQ0FBQztBQUM1QyxPQUFPLEtBQUssR0FBRyxNQUFNLG9DQUFvQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFlLE1BQU0seUNBQXlDLENBQUM7QUFLbEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDM0UsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBRTdFLElBQU0sMEJBQTBCLEdBQWhDLE1BQU0sMEJBQTJCLFNBQVEsVUFBVTtJQU16RCxZQUNrQixrQkFBMkMsRUFDNUMsYUFBOEM7UUFFOUQsS0FBSyxFQUFFLENBQUM7UUFIUyx1QkFBa0IsR0FBbEIsa0JBQWtCLENBQXlCO1FBQzNCLGtCQUFhLEdBQWIsYUFBYSxDQUFnQjtRQUx2RCx1QkFBa0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUNqRCxzQkFBaUIsR0FBRyxJQUFJLENBQUMsa0JB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