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
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { $ } from '../../../../base/browser/dom.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ITerminalChatService } from './terminal.js';
import * as dom from '../../../../base/browser/dom.js';
let TerminalTabsChatEntry = class TerminalTabsChatEntry extends Disposable {
    dispose() {
        this._entry.remove();
        this._label.remove();
        super.dispose();
    }
    constructor(container, _tabContainer, _commandService, _terminalChatService) {
        super();
        this._tabContainer = _tabContainer;
        this._commandService = _commandService;
        this._terminalChatService = _terminalChatService;
        this._entry = dom.append(container, $('.terminal-tabs-chat-entry'));
        this._entry.tabIndex = 0;
        this._entry.setAttribute('role', 'button');
        const entry = dom.append(this._entry, $('.terminal-tabs-entry'));
        const icon = dom.append(entry, $('.terminal-tabs-chat-entry-icon'));
        icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.commentDiscussionSparkle));
        this._label = dom.append(entry, $('.terminal-tabs-chat-entry-label'));
        const runChatTerminalsCommand = () => {
            void this._commandService.executeCommand('workbench.action.terminal.chat.viewHiddenChatTerminals');
        };
        this._register(dom.addDisposableListener(this._entry, dom.EventType.CLICK, e => {
            e.preventDefault();
            runChatTerminalsCommand();
        }));
        this._register(dom.addDisposableListener(this._entry, dom.EventType.KEY_DOWN, e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                runChatTerminalsCommand();
            }
        }));
        this.update();
    }
    get element() {
        return this._entry;
    }
    update() {
        const hiddenChatTerminalCount = this._terminalChatService.getToolSessionTerminalInstances(true).length;
        if (hiddenChatTerminalCount <= 0) {
            this._entry.style.display = 'none';
            this._label.textContent = '';
            this._entry.removeAttribute('aria-label');
            this._entry.removeAttribute('title');
            return;
        }
        this._entry.style.display = '';
        const tooltip = localize('terminal.tabs.chatEntryTooltip', "Show hidden chat terminals");
        this._entry.setAttribute('title', tooltip);
        const hasText = this._tabContainer.classList.contains('has-text');
        if (hasText) {
            this._label.textContent = hiddenChatTerminalCount === 1
                ? localize('terminal.tabs.chatEntryLabelSingle', "{0} Hidden Terminal", hiddenChatTerminalCount)
                : localize('terminal.tabs.chatEntryLabelPlural', "{0} Hidden Terminals", hiddenChatTerminalCount);
        }
        else {
            this._label.textContent = `${hiddenChatTerminalCount}`;
        }
        const ariaLabel = hiddenChatTerminalCount === 1
            ? localize('terminal.tabs.chatEntryAriaLabelSingle', "Show 1 hidden chat terminal")
            : localize('terminal.tabs.chatEntryAriaLabelPlural', "Show {0} hidden chat terminals", hiddenChatTerminalCount);
        this._entry.setAttribute('aria-label', ariaLabel);
    }
};
TerminalTabsChatEntry = __decorate([
    __param(2, ICommandService),
    __param(3, ITerminalChatService)
], TerminalTabsChatEntry);
export { TerminalTabsChatEntry };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxUYWJzQ2hhdEVudHJ5LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL2Jyb3dzZXIvdGVybWluYWxUYWJzQ2hhdEVudHJ5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxDQUFDLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNwRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUNyRCxPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBRWhELElBQU0scUJBQXFCLEdBQTNCLE1BQU0scUJBQXNCLFNBQVEsVUFBVTtJQUszQyxPQUFPO1FBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNyQixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3JCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNqQixDQUFDO0lBRUQsWUFDQyxTQUFzQixFQUNMLGFBQTBCLEVBQ1QsZUFBZ0MsRUFDM0Isb0JBQTBDO1FBRWpGLEtBQUssRUFBRSxDQUFDO1FBSlMsa0JBQWEsR0FBYixhQUFhLENBQWE7UUFDVCxvQkFBZSxHQUFmLGVBQWUsQ0FBaUI7UUFDM0IseUJBQW9CLEdBQXBCLG9CQUFvQixDQUFzQjtRQUlqRixJ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