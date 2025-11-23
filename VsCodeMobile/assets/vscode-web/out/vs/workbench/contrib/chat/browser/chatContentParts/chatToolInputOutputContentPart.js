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
import * as dom from '../../../../../base/browser/dom.js';
import { ButtonWithIcon } from '../../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { autorun, observableValue } from '../../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { LanguageModelPartAudience } from '../../common/languageModels.js';
import { ChatQueryTitlePart } from './chatConfirmationWidget.js';
import { ChatToolOutputContentSubPart } from './chatToolOutputContentSubPart.js';
let ChatCollapsibleInputOutputContentPart = class ChatCollapsibleInputOutputContentPart extends Disposable {
    get codeblocks() {
        const inputCodeblocks = this._editorReferences.map(ref => {
            const cbi = this.input.codeBlockInfo;
            return cbi;
        });
        const outputCodeblocks = this._outputSubPart?.codeblocks ?? [];
        return [...inputCodeblocks, ...outputCodeblocks];
    }
    set title(s) {
        this._titlePart.title = s;
    }
    get title() {
        return this._titlePart.title;
    }
    get expanded() {
        return this._expanded.get();
    }
    constructor(title, subtitle, progressTooltip, context, input, output, isError, initiallyExpanded, contextKeyService, _instantiationService, hoverService) {
        super();
        this.context = context;
        this.input = input;
        this.output = output;
        this.contextKeyService = contextKeyService;
        this._instantiationService = _instantiationService;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this._currentWidth = 0;
        this._editorReferences = [];
        this._currentWidth = context.currentWidth();
        const container = dom.h('.chat-confirmation-widget-container');
        const titleEl = dom.h('.chat-confirmation-widget-title-inner');
        const elements = dom.h('.chat-confirmation-widget');
        this.domNode = container.root;
        container.root.appendChild(elements.root);
        const titlePart = this._titlePart = this._register(_instantiationService.createInstance(ChatQueryTitlePart, titleEl.root, title, subtitle));
        this._register(titlePart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
        const spacer = document.createElement('span');
        spacer.style.flexGrow = '1';
        const btn = this._register(new ButtonWithIcon(elements.root, {}));
        btn.element.classList.add('chat-confirmation-widget-title', 'monaco-text-button');
        btn.labelElement.append(titleEl.root);
        const check = dom.h(isError
            ? ThemeIcon.asCSSSelector(Codicon.error)
            : output
                ? ThemeIcon.asCSSSelector(Codicon.check)
                : ThemeIcon.asCSSSelector(ThemeIcon.modify(Codicon.loading, 'spin')));
        if (progressTooltip) {
            this._register(hoverService.setupDelayedHover(check.root, {
                content: progressTooltip,
                style: 1 /* HoverStyle.Pointer */,
            }));
        }
        const expanded = this._expanded = observableValue(this, initiallyExpanded);
        this._register(autorun(r => {
            const value = expanded.read(r);
            btn.icon = isError
                ? Codicon.error
                : output
                    ? Codicon.check
                    : ThemeIcon.modify(Codicon.loading, 'spin');
            elements.root.classList.toggle('collapsed', !value);
            this._onDidChangeHeight.fire();
        }));
        const toggle = (e) => {
            if (!e.defaultPrevented) {
                const value = expanded.get();
                expanded.set(!value, undefined);
                e.preventDefault();
            }
        };
        this._register(btn.onDidClick(toggle));
        const message = dom.h('.chat-confirmation-widget-message');
        message.root.appendChild(this.createMessageContents());
        elements.root.appendChild(message.root);
        const topLevelResources = this.output?.parts
            .filter(p => p.kind === 'data')
            .filter(p => !p.audience || p.audience.includes(LanguageModelPartAudience.User));
        if (topLevelResources?.length) {
            const resourceSubPart = this._register(this._instantiationService.createInstance(ChatToolOutputContentSubPart, this.context, topLevelResources));
            const group = resourceSubPart.domNode;
            group.classList.add('chat-collapsible-top-level-resource-group');
            container.root.appendChild(group);
            this._register(autorun(r => {
                group.style.display = expanded.read(r) ? 'none' : '';
            }));
        }
    }
    createMessageContents() {
        const contents = dom.h('div', [
            dom.h('h3@inputTitle'),
            dom.h('div@input'),
            dom.h('h3@outputTitle'),
            dom.h('div@output'),
        ]);
        const { input, output } = this;
        contents.inputTitle.textContent = localize('chat.input', "Input");
        this.addCodeBlock(input, contents.input);
        if (!output) {
            contents.output.remove();
            contents.outputTitle.remove();
        }
        else {
            contents.outputTitle.textContent = localize('chat.output', "Output");
            const outputSubPart = this._register(this._instantiationService.createInstance(ChatToolOutputContentSubPart, this.context, output.parts));
            this._outputSubPart = outputSubPart;
            this._register(outputSubPart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
            contents.output.appendChild(outputSubPart.domNode);
        }
        return contents.root;
    }
    addCodeBlock(part, container) {
        const data = {
            languageId: part.languageId,
            textModel: Promise.resolve(part.textModel),
            codeBlockIndex: part.codeBlockInfo.codeBlockIndex,
            codeBlockPartIndex: 0,
            element: this.context.element,
            parentContextKeyService: this.contextKeyService,
            renderOptions: part.options,
            chatSessionResource: this.context.element.sessionResource,
        };
        const editorReference = this._register(this.context.editorPool.get());
        editorReference.object.render(data, this._currentWidth || 300);
        this._register(editorReference.object.onDidChangeContentHeight(() => this._onDidChangeHeight.fire()));
        container.appendChild(editorReference.object.element);
        this._editorReferences.push(editorReference);
    }
    hasSameContent(other, followingContent, element) {
        // For now, we consider content different unless it's exactly the same instance
        return false;
    }
    layout(width) {
        this._currentWidth = width;
        this._editorReferences.forEach(r => r.object.layout(width));
        this._outputSubPart?.layout(width);
    }
};
ChatCollapsibleInputOutputContentPart = __decorate([
    __param(8, IContextKeyService),
    __param(9, IInstantiationService),
    __param(10, IHoverService)
], ChatCollapsibleInputOutputContentPart);
export { ChatCollapsibleInputOutputContentPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRvb2xJbnB1dE91dHB1dENvbnRlbnRQYXJ0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGVudFBhcnRzL2NoYXRUb29sSW5wdXRPdXRwdXRDb250ZW50UGFydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9DQUFvQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUVqRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRTlELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsT0FBTyxFQUF1QixlQUFlLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN6RyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFHcEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMvRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUV0RyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUkzRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUVqRSxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQXlCMUUsSUFBTSxxQ0FBcUMsR0FBM0MsTUFBTSxxQ0FB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