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
import { $, clearNode } from '../../../../../base/browser/dom.js';
import { ThinkingDisplayMode } from '../../common/constants.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { IMarkdownRendererService } from '../../../../../platform/markdown/browser/markdownRenderer.js';
import { ChatCollapsibleContentPart } from './chatCollapsibleContentPart.js';
import { localize } from '../../../../../nls.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { autorun } from '../../../../../base/common/observable.js';
import './media/chatThinkingContent.css';
function extractTextFromPart(content) {
    const raw = Array.isArray(content.value) ? content.value.join('') : (content.value || '');
    return raw.trim();
}
function extractTitleFromThinkingContent(content) {
    const headerMatch = content.match(/^\*\*([^*]+)\*\*/);
    return headerMatch ? headerMatch[1] : undefined;
}
let ChatThinkingContentPart = class ChatThinkingContentPart extends ChatCollapsibleContentPart {
    constructor(content, context, instantiationService, configurationService, markdownRendererService) {
        const initialText = extractTextFromPart(content);
        const extractedTitle = extractTitleFromThinkingContent(initialText)
            ?? localize('chat.thinking.header', 'Thinking...');
        super(extractedTitle, context);
        this.configurationService = configurationService;
        this.markdownRendererService = markdownRendererService;
        this.defaultTitle = localize('chat.thinking.header', 'Thinking...');
        this.fixedScrollingMode = false;
        this.hasMultipleItems = false;
        this.id = content.id;
        const configuredMode = this.configurationService.getValue('chat.agent.thinkingStyle') ?? ThinkingDisplayMode.Collapsed;
        this.fixedScrollingMode = configuredMode === ThinkingDisplayMode.FixedScrolling;
        this.currentTitle = extractedTitle;
        if (extractedTitle !== this.defaultTitle) {
            this.lastExtractedTitle = extractedTitle;
        }
        this.currentThinkingValue = initialText;
        if (configuredMode === ThinkingDisplayMode.Collapsed) {
            this.setExpanded(false);
        }
        else {
            this.setExpanded(true);
        }
        if (this.fixedScrollingMode) {
            this.setExpanded(false);
        }
        const node = this.domNode;
        node.classList.add('chat-thinking-box');
        node.tabIndex = 0;
        if (this.fixedScrollingMode) {
            node.classList.add('chat-thinking-fixed-mode');
            this.currentTitle = this.defaultTitle;
            if (this._collapseButton) {
                this._collapseButton.icon = ThemeIcon.modify(Codicon.loading, 'spin');
            }
            // override for codicon chevron in the collapsible part
            this._register(autorun(r => {
                this.expanded.read(r);
                if (this._collapseButton && this.wrapper) {
                    if (this.wrapper.classList.contains('chat-thinking-streaming')) {
                        this._collapseButton.icon = ThemeIcon.modify(Codicon.loading, 'spin');
                    }
                    else {
                        this._collapseButton.icon = Codicon.check;
                    }
                }
            }));
        }
        const label = (this.lastExtractedTitle ?? '') + (this.hasMultipleItems ? '...' : '');
        this.setTitle(label);
    }
    // @TODO: @justschen Convert to template for each setting?
    initContent() {
        this.wrapper = $('.chat-used-context-list.chat-thinking-collapsible');
        if (this.fixedScrollingMode) {
            this.wrapper.classList.add('chat-thinking-streaming');
        }
        this.textContainer = $('.chat-thinking-item.markdown-content');
        this.wrapper.appendChild(this.textContainer);
        if (this.currentThinkingValue) {
            this.renderMarkdown(this.currentThinkingValue);
        }
        this.updateDropdownClickability();
        return this.wrapper;
    }
    renderMarkdown(content, reuseExisting) {
        // Guard against rendering after disposal to avoid leaking disposables
        if (this._store.isDisposed) {
            return;
        }
        const cleanedContent = content.trim();
        if (!cleanedContent) {
            if (this.markdownResult) {
                this.markdownResult.dispose();
                this.markdownResult = undefined;
            }
            clearNode(this.textContainer);
            return;
        }
        // If the entire content is bolded, strip the bold markers for rendering
        let contentToRender = cleanedContent;
        if (cleanedContent.startsWith('**') && cleanedContent.endsWith('**')) {
            contentToRender = cleanedContent.slice(2, -2);
        }
        const target = reuseExisting ? this.markdownResult?.element : undefined;
        if (this.markdownResult) {
            this.markdownResult.dispose();
            this.markdownResult = undefined;
        }
        const rendered = this._register(this.markdownRendererService.render(new MarkdownString(contentToRender), undefined, target));
        this.markdownResult = rendered;
        if (!target) {
            clearNode(this.textContainer);
            this.textContainer.appendChild(rendered.element);
        }
    }
    setDropdownClickable(clickable) {
        if (this._collapseButton) {
            this._collapseButton.element.style.pointerEvents = clickable ? 'auto' : 'none';
        }
    }
    updateDropdownClickability() {
        if (this.wrapper && this.wrapper.children.length > 1) {
            this.setDropdownClickable(true);
            return;
        }
        const contentWithoutTitle = this.currentThinkingValue.trim();
        const titleToCompare = this.lastExtractedTitle ?? this.currentTitle;
        const stripMarkdown = (text) => {
            return text
                .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1').trim();
        };
        const strippedContent = stripMarkdown(contentWithoutTitle);
        const shouldDisable = !strippedContent || strippedContent === titleToCompare;
        this.setDropdownClickable(!shouldDisable);
    }
    resetId() {
        this.id = undefined;
    }
    collapseContent() {
        this.setExpanded(false);
    }
    updateThinking(content) {
        // If disposed, ignore late updates coming from renderer diffing
        if (this._store.isDisposed) {
            return;
        }
        const raw = extractTextFromPart(content);
        const next = raw;
        if (next === this.currentThinkingValue) {
            return;
        }
        const previousValue = this.currentThinkingValue;
        const reuseExisting = !!(this.markdownResult && next.startsWith(previousValue) && next.length > previousValue.length);
        this.currentThinkingValue = next;
        this.renderMarkdown(next, reuseExisting);
        if (this.fixedScrollingMode && this.wrapper) {
            this.wrapper.scrollTop = this.wrapper.scrollHeight;
        }
        const extractedTitle = extractTitleFromThinkingContent(raw);
        if (!extractedTitle || extractedTitle === this.currentTitle) {
            return;
        }
        this.lastExtractedTitle = extractedTitle;
        const label = (this.lastExtractedTitle ?? '') + (this.hasMultipleItems ? '...' : '');
        this.setTitle(label);
        this.currentTitle = label;
        this.updateDropdownClickability();
    }
    finalizeTitleIfDefault() {
        if (this.fixedScrollingMode) {
            let finalLabel;
            if (this.lastExtractedTitle) {
                finalLabel = localize('chat.thinking.fixed.done.withHeader', '{0}{1}', this.lastExtractedTitle, this.hasMultipleItems ? '...' : '');
            }
            else {
                finalLabel = localize('chat.thinking.fixed.done.generic', 'Thought for a few seconds');
            }
            this.currentTitle = finalLabel;
            this.wrapper.classList.remove('chat-thinking-streaming');
            if (this._collapseButton) {
                this._collapseButton.icon = Codicon.check;
                this._collapseButton.label = finalLabel;
            }
        }
        else {
            if (this.currentTitle === this.defaultTitle) {
                const suffix = localize('chat.thinking.fixed.done.generic', 'Thought for a few seconds');
                this.setTitle(suffix);
                this.currentTitle = suffix;
            }
        }
        this.updateDropdownClickability();
    }
    appendItem(content) {
        this.wrapper.appendChild(content);
        if (this.fixedScrollingMode && this.wrapper) {
            this.wrapper.scrollTop = this.wrapper.scrollHeight;
        }
        const dropdownClickable = this.wrapper.children.length > 1;
        this.setDropdownClickable(dropdownClickable);
    }
    // makes a new text container. when we update, we now update this container.
    setupThinkingContainer(content, context) {
        // Avoid creating new containers after disposal
        if (this._store.isDisposed) {
            return;
        }
        this.hasMultipleItems = true;
        this.textContainer = $('.chat-thinking-item.markdown-content');
        this.wrapper.appendChild(this.textContainer);
        this.id = content?.id;
        this.updateThinking(content);
        this.updateDropdownClickability();
    }
    setTitle(title) {
        if (this.fixedScrollingMode && this._collapseButton && this.wrapper.classList.contains('chat-thinking-streaming')) {
            const thinkingLabel = localize('chat.thinking.fixed.progress.withHeader', 'Thinking: {0}', title);
            this._collapseButton.label = thinkingLabel;
        }
        else {
            super.setTitle(title);
        }
    }
    hasSameContent(other, _followingContent, _element) {
        // only need this check if we are adding tools into thinking dropdown.
        // if (other.kind === 'toolInvocation' || other.kind === 'toolInvocationSerialized') {
        // 	return true;
        // }
        if (other.kind !== 'thinking') {
            return false;
        }
        return other?.id !== this.id;
    }
    dispose() {
        if (this.markdownResult) {
            this.markdownResult.dispose();
            this.markdownResult = undefined;
        }
        super.dispose();
    }
};
ChatThinkingContentPart = __decorate([
    __param(2, IInstantiationService),
    __param(3, IConfigurationService),
    __param(4, IMarkdownRendererService)
], ChatThinkingContentPart);
export { ChatThinkingContentPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRoaW5raW5nQ29udGVudFBhcnQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRDb250ZW50UGFydHMvY2hhdFRoaW5raW5nQ29udGVudFBhcnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUlsRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUVoRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDM0UsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sOERBQThELENBQUM7QUFFeEcsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDN0UsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDcEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25FLE9BQU8saUNBQWlDLENBQUM7QUFHekMsU0FBUyxtQkFBbUIsQ0FBQyxPQUEwQjtJQUN0RCxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMs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