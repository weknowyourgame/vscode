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
import { SimpleFindWidget } from '../../../codeEditor/browser/find/simpleFindWidget.js';
import { IContextMenuService, IContextViewService } from '../../../../../platform/contextview/browser/contextView.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { TerminalContextKeys } from '../../../terminal/common/terminalContextKey.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { Event } from '../../../../../base/common/event.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { TerminalClipboardContribution } from '../../clipboard/browser/terminal.clipboard.contribution.js';
import { StandardMouseEvent } from '../../../../../base/browser/mouseEvent.js';
import { createTextInputActions } from '../../../../browser/actions/textInputActions.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
const TERMINAL_FIND_WIDGET_INITIAL_WIDTH = 419;
let TerminalFindWidget = class TerminalFindWidget extends SimpleFindWidget {
    constructor(_instance, clipboardService, configurationService, contextKeyService, contextMenuService, contextViewService, hoverService, keybindingService, themeService, logService) {
        super({
            showCommonFindToggles: true,
            checkImeCompletionState: true,
            showResultCount: true,
            initialWidth: TERMINAL_FIND_WIDGET_INITIAL_WIDTH,
            enableSash: true,
            appendCaseSensitiveActionId: "workbench.action.terminal.toggleFindCaseSensitive" /* TerminalFindCommandId.ToggleFindCaseSensitive */,
            appendRegexActionId: "workbench.action.terminal.toggleFindRegex" /* TerminalFindCommandId.ToggleFindRegex */,
            appendWholeWordsActionId: "workbench.action.terminal.toggleFindWholeWord" /* TerminalFindCommandId.ToggleFindWholeWord */,
            previousMatchActionId: "workbench.action.terminal.findPrevious" /* TerminalFindCommandId.FindPrevious */,
            nextMatchActionId: "workbench.action.terminal.findNext" /* TerminalFindCommandId.FindNext */,
            closeWidgetActionId: "workbench.action.terminal.hideFind" /* TerminalFindCommandId.FindHide */,
            type: 'Terminal',
            matchesLimit: 20000 /* XtermTerminalConstants.SearchHighlightLimit */
        }, contextViewService, contextKeyService, hoverService, keybindingService);
        this._instance = _instance;
        this._register(this.state.onFindReplaceStateChange(() => {
            this.show();
        }));
        this._findInputFocused = TerminalContextKeys.findInputFocus.bindTo(contextKeyService);
        this._findWidgetFocused = TerminalContextKeys.findFocus.bindTo(contextKeyService);
        this._findWidgetVisible = TerminalContextKeys.findVisible.bindTo(contextKeyService);
        const innerDom = this.getDomNode().firstChild;
        if (innerDom) {
            this._register(dom.addDisposableListener(innerDom, 'mousedown', (event) => {
                event.stopPropagation();
            }));
            this._register(dom.addDisposableListener(innerDom, 'contextmenu', (event) => {
                event.stopPropagation();
            }));
        }
        const findInputDomNode = this.getFindInputDomNode();
        this._register(dom.addDisposableListener(findInputDomNode, 'contextmenu', (event) => {
            const targetWindow = dom.getWindow(findInputDomNode);
            const standardEvent = new StandardMouseEvent(targetWindow, event);
            const actions = createTextInputActions(clipboardService, logService);
            contextMenuService.showContextMenu({
                getAnchor: () => standardEvent,
                getActions: () => actions,
                getActionsContext: () => event.target,
            });
            event.stopPropagation();
        }));
        this._register(themeService.onDidColorThemeChange(() => {
            if (this.isVisible()) {
                this.find(true, true);
            }
        }));
        this._register(configurationService.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('workbench.colorCustomizations') && this.isVisible()) {
                this.find(true, true);
            }
        }));
        this.updateResultCount();
    }
    find(previous, update) {
        const xterm = this._instance.xterm;
        if (!xterm) {
            return;
        }
        if (previous) {
            this._findPreviousWithEvent(xterm, this.inputValue, { regex: this._getRegexValue(), wholeWord: this._getWholeWordValue(), caseSensitive: this._getCaseSensitiveValue(), incremental: update });
        }
        else {
            this._findNextWithEvent(xterm, this.inputValue, { regex: this._getRegexValue(), wholeWord: this._getWholeWordValue(), caseSensitive: this._getCaseSensitiveValue() });
        }
    }
    reveal() {
        const initialInput = this._instance.hasSelection() && !this._instance.selection.includes('\n') ? this._instance.selection : undefined;
        const inputValue = initialInput ?? this.inputValue;
        const xterm = this._instance.xterm;
        if (xterm && inputValue && inputValue !== '') {
            // trigger highlight all matches
            this._findPreviousWithEvent(xterm, inputValue, { incremental: true, regex: this._getRegexValue(), wholeWord: this._getWholeWordValue(), caseSensitive: this._getCaseSensitiveValue() }).then(foundMatch => {
                this.updateButtons(foundMatch);
                this._register(Event.once(xterm.onDidChangeSelection)(() => xterm.clearActiveSearchDecoration()));
            });
        }
        this.updateButtons(false);
        super.reveal(inputValue);
        this._findWidgetVisible.set(true);
    }
    show() {
        const initialInput = this._instance.hasSelection() && !this._instance.selection.includes('\n') ? this._instance.selection : undefined;
        super.show(initialInput);
        this._findWidgetVisible.set(true);
    }
    hide() {
        super.hide();
        this._findWidgetVisible.reset();
        this._instance.focus(true);
        this._instance.xterm?.clearSearchDecorations();
    }
    async _getResultCount() {
        return this._instance.xterm?.findResult;
    }
    _onInputChanged() {
        // Ignore input changes for now
        const xterm = this._instance.xterm;
        if (xterm) {
            this._findPreviousWithEvent(xterm, this.inputValue, { regex: this._getRegexValue(), wholeWord: this._getWholeWordValue(), caseSensitive: this._getCaseSensitiveValue(), incremental: true }).then(foundMatch => {
                this.updateButtons(foundMatch);
            });
        }
        return false;
    }
    _onFocusTrackerFocus() {
        if (TerminalClipboardContribution.get(this._instance)?.overrideCopyOnSelection) {
            this._overrideCopyOnSelectionDisposable = TerminalClipboardContribution.get(this._instance)?.overrideCopyOnSelection(false);
        }
        this._findWidgetFocused.set(true);
    }
    _onFocusTrackerBlur() {
        this._overrideCopyOnSelectionDisposable?.dispose();
        this._instance.xterm?.clearActiveSearchDecoration();
        this._findWidgetFocused.reset();
    }
    _onFindInputFocusTrackerFocus() {
        this._findInputFocused.set(true);
    }
    _onFindInputFocusTrackerBlur() {
        this._findInputFocused.reset();
    }
    findFirst() {
        const instance = this._instance;
        if (instance.hasSelection()) {
            instance.clearSelection();
        }
        const xterm = instance.xterm;
        if (xterm) {
            this._findPreviousWithEvent(xterm, this.inputValue, { regex: this._getRegexValue(), wholeWord: this._getWholeWordValue(), caseSensitive: this._getCaseSensitiveValue() });
        }
    }
    async _findNextWithEvent(xterm, term, options) {
        return xterm.findNext(term, options).then(foundMatch => {
            this._register(Event.once(xterm.onDidChangeSelection)(() => xterm.clearActiveSearchDecoration()));
            return foundMatch;
        });
    }
    async _findPreviousWithEvent(xterm, term, options) {
        return xterm.findPrevious(term, options).then(foundMatch => {
            this._register(Event.once(xterm.onDidChangeSelection)(() => xterm.clearActiveSearchDecoration()));
            return foundMatch;
        });
    }
};
TerminalFindWidget = __decorate([
    __param(1, IClipboardService),
    __param(2, IConfigurationService),
    __param(3, IContextKeyService),
    __param(4, IContextMenuService),
    __param(5, IContextViewService),
    __param(6, IHoverService),
    __param(7, IKeybindingService),
    __param(8, IThemeService),
    __param(9, ILogService)
], TerminalFindWidget);
export { TerminalFindWidget };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxGaW5kV2lkZ2V0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9maW5kL2Jyb3dzZXIvdGVybWluYWxGaW5kV2lkZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0NBQW9DLENBQUM7QUFDMUQsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDeEYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLG1CQUFtQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDdEgsT0FBTyxFQUFFLGtCQUFrQixFQUFlLE1BQU0seURBQXlELENBQUM7QUFFMUcsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDckYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUU1RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUVqRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFFL0UsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDM0csT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDL0UsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDekYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBRXhF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