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
import * as DOM from '../../../../../../base/browser/dom.js';
import { alert as alertFn } from '../../../../../../base/browser/ui/aria/aria.js';
import { Lazy } from '../../../../../../base/common/lazy.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import * as strings from '../../../../../../base/common/strings.js';
import { MATCHES_LIMIT, CONTEXT_FIND_WIDGET_VISIBLE } from '../../../../../../editor/contrib/find/browser/findModel.js';
import { FindReplaceState } from '../../../../../../editor/contrib/find/browser/findState.js';
import { NLS_MATCHES_LOCATION, NLS_NO_RESULTS } from '../../../../../../editor/contrib/find/browser/findWidget.js';
import { FindWidgetSearchHistory } from '../../../../../../editor/contrib/find/browser/findWidgetSearchHistory.js';
import { ReplaceWidgetHistory } from '../../../../../../editor/contrib/find/browser/replaceWidgetHistory.js';
import { localize } from '../../../../../../nls.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService, IContextViewService } from '../../../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { FindModel } from './findModel.js';
import { SimpleFindReplaceWidget } from './notebookFindReplaceWidget.js';
import { CellEditState } from '../../notebookBrowser.js';
import { KEYBINDING_CONTEXT_NOTEBOOK_FIND_WIDGET_FOCUSED } from '../../../common/notebookContextKeys.js';
const FIND_HIDE_TRANSITION = 'find-hide-transition';
const FIND_SHOW_TRANSITION = 'find-show-transition';
let MAX_MATCHES_COUNT_WIDTH = 69;
const PROGRESS_BAR_DELAY = 200; // show progress for at least 200ms
let NotebookFindContrib = class NotebookFindContrib extends Disposable {
    static { this.id = 'workbench.notebook.find'; }
    constructor(notebookEditor, instantiationService) {
        super();
        this.notebookEditor = notebookEditor;
        this.instantiationService = instantiationService;
        this._widget = new Lazy(() => this._register(this.instantiationService.createInstance(NotebookFindWidget, this.notebookEditor)));
    }
    get widget() {
        return this._widget.value;
    }
    show(initialInput, options) {
        return this._widget.value.show(initialInput, options);
    }
    hide() {
        this._widget.rawValue?.hide();
    }
    replace(searchString) {
        return this._widget.value.replace(searchString);
    }
    isVisible() {
        return this._widget.rawValue?.isVisible ?? false;
    }
    findNext() {
        if (this._widget.rawValue) {
            this._widget.value.findNext();
        }
    }
    findPrevious() {
        if (this._widget.rawValue) {
            this._widget.value.findPrevious();
        }
    }
};
NotebookFindContrib = __decorate([
    __param(1, IInstantiationService)
], NotebookFindContrib);
export { NotebookFindContrib };
let NotebookFindWidget = class NotebookFindWidget extends SimpleFindReplaceWidget {
    constructor(_notebookEditor, contextViewService, contextKeyService, configurationService, contextMenuService, hoverService, instantiationService, storageService) {
        const findSearchHistory = FindWidgetSearchHistory.getOrCreate(storageService);
        const replaceHistory = ReplaceWidgetHistory.getOrCreate(storageService);
        super(contextViewService, contextKeyService, configurationService, contextMenuService, instantiationService, hoverService, new FindReplaceState(), _notebookEditor, findSearchHistory, replaceHistory);
        this._isFocused = false;
        this._showTimeout = null;
        this._hideTimeout = null;
        this._findModel = new FindModel(this._notebookEditor, this._state, this._configurationService);
        DOM.append(this._notebookEditor.getDomNode(), this.getDomNode());
        this._findWidgetFocused = KEYBINDING_CONTEXT_NOTEBOOK_FIND_WIDGET_FOCUSED.bindTo(contextKeyService);
        this._findWidgetVisible = CONTEXT_FIND_WIDGET_VISIBLE.bindTo(contextKeyService);
        this._register(this._findInput.onKeyDown((e) => this._onFindInputKeyDown(e)));
        this._register(this._replaceInput.onKeyDown((e) => this._onReplaceInputKeyDown(e)));
        this._register(this._state.onFindReplaceStateChange((e) => {
            this.onInputChanged();
            if (e.isSearching) {
                if (this._state.isSearching) {
                    this._progressBar.infinite().show(PROGRESS_BAR_DELAY);
                }
                else {
                    this._progressBar.stop().hide();
                }
            }
            if (this._findModel.currentMatch >= 0) {
                const currentMatch = this._findModel.getCurrentMatch();
                this._replaceBtn.setEnabled(currentMatch.isModelMatch);
            }
            const matches = this._findModel.findMatches;
            this._replaceAllBtn.setEnabled(matches.length > 0 && matches.find(match => match.webviewMatches.length > 0) === undefined);
            if (e.filters) {
                this._findInput.updateFilterState(this._state.filters?.isModified() ?? false);
            }
        }));
        this._register(DOM.addDisposableListener(this.getDomNode(), DOM.EventType.FOCUS, e => {
            this._previousFocusElement = DOM.isHTMLElement(e.relatedTarget) ? e.relatedTarget : undefined;
        }, true));
    }
    get findModel() {
        return this._findModel;
    }
    get isFocused() {
        return this._isFocused;
    }
    _onFindInputKeyDown(e) {
        if (e.equals(3 /* KeyCode.Enter */)) {
            this.find(false);
            e.preventDefault();
            return;
        }
        else if (e.equals(1024 /* KeyMod.Shift */ | 3 /* KeyCode.Enter */)) {
            this.find(true);
            e.preventDefault();
            return;
        }
    }
    _onReplaceInputKeyDown(e) {
        if (e.equals(3 /* KeyCode.Enter */)) {
            this.replaceOne();
            e.preventDefault();
            return;
        }
    }
    onInputChanged() {
        this._state.change({ searchString: this.inputValue }, false);
        // this._findModel.research();
        const findMatches = this._findModel.findMatches;
        if (findMatches && findMatches.length) {
            return true;
        }
        return false;
    }
    findIndex(index) {
        this._findModel.find({ index });
    }
    find(previous) {
        this._findModel.find({ previous });
    }
    findNext() {
        this.find(false);
    }
    findPrevious() {
        this.find(true);
    }
    replaceOne() {
        if (!this._notebookEditor.hasModel()) {
            return;
        }
        if (!this._findModel.findMatches.length) {
            return;
        }
        this._findModel.ensureFindMatches();
        if (this._findModel.currentMatch < 0) {
            this._findModel.find({ previous: false });
        }
        const currentMatch = this._findModel.getCurrentMatch();
        const cell = currentMatch.cell;
        if (currentMatch.isModelMatch) {
            const match = currentMatch.match;
            this._progressBar.infinite().show(PROGRESS_BAR_DELAY);
            const replacePattern = this.replacePattern;
            const replaceString = replacePattern.buildReplaceString(match.matches, this._state.preserveCase);
            const viewModel = this._notebookEditor.getViewModel();
            viewModel.replaceOne(cell, match.range, replaceString).then(() => {
                this._progressBar.stop();
            });
        }
        else {
            // this should not work
            console.error('Replace does not work for output match');
        }
    }
    replaceAll() {
        if (!this._notebookEditor.hasModel()) {
            return;
        }
        this._progressBar.infinite().show(PROGRESS_BAR_DELAY);
        const replacePattern = this.replacePattern;
        const cellFindMatches = this._findModel.findMatches;
        const replaceStrings = [];
        cellFindMatches.forEach(cellFindMatch => {
            cellFindMatch.contentMatches.forEach(match => {
                const matches = match.matches;
                replaceStrings.push(replacePattern.buildReplaceString(matches, this._state.preserveCase));
            });
        });
        const viewModel = this._notebookEditor.getViewModel();
        viewModel.replaceAll(this._findModel.findMatches, replaceStrings).then(() => {
            this._progressBar.stop();
        });
    }
    findFirst() { }
    onFocusTrackerFocus() {
        this._findWidgetFocused.set(true);
        this._isFocused = true;
    }
    onFocusTrackerBlur() {
        this._previousFocusElement = undefined;
        this._findWidgetFocused.reset();
        this._isFocused = false;
    }
    onReplaceInputFocusTrackerFocus() {
        // throw new Error('Method not implemented.');
    }
    onReplaceInputFocusTrackerBlur() {
        // throw new Error('Method not implemented.');
    }
    onFindInputFocusTrackerFocus() { }
    onFindInputFocusTrackerBlur() { }
    async show(initialInput, options) {
        const searchStringUpdate = this._state.searchString !== initialInput;
        super.show(initialInput, options);
        this._state.change({ searchString: initialInput ?? this._state.searchString, isRevealed: true }, false);
        this._findWidgetVisible.set(true);
        if (typeof options?.matchIndex === 'number') {
            if (!this._findModel.findMatches.length) {
                await this._findModel.research();
            }
            this.findIndex(options.matchIndex);
        }
        else if (options?.focus !== false) {
            this._findInput.select();
        }
        if (!searchStringUpdate && options?.searchStringSeededFrom) {
            this._findModel.refreshCurrentMatch(options.searchStringSeededFrom);
        }
        if (this._showTimeout === null) {
            if (this._hideTimeout !== null) {
                DOM.getWindow(this.getDomNode()).clearTimeout(this._hideTimeout);
                this._hideTimeout = null;
                this._notebookEditor.removeClassName(FIND_HIDE_TRANSITION);
            }
            this._notebookEditor.addClassName(FIND_SHOW_TRANSITION);
            this._showTimeout = DOM.getWindow(this.getDomNode()).setTimeout(() => {
                this._notebookEditor.removeClassName(FIND_SHOW_TRANSITION);
                this._showTimeout = null;
            }, 200);
        }
        else {
            // no op
        }
    }
    replace(initialFindInput, initialReplaceInput) {
        super.showWithReplace(initialFindInput, initialReplaceInput);
        this._state.change({ searchString: initialFindInput ?? '', replaceString: initialReplaceInput ?? '', isRevealed: true }, false);
        this._replaceInput.select();
        if (this._showTimeout === null) {
            if (this._hideTimeout !== null) {
                DOM.getWindow(this.getDomNode()).clearTimeout(this._hideTimeout);
                this._hideTimeout = null;
                this._notebookEditor.removeClassName(FIND_HIDE_TRANSITION);
            }
            this._notebookEditor.addClassName(FIND_SHOW_TRANSITION);
            this._showTimeout = DOM.getWindow(this.getDomNode()).setTimeout(() => {
                this._notebookEditor.removeClassName(FIND_SHOW_TRANSITION);
                this._showTimeout = null;
            }, 200);
        }
        else {
            // no op
        }
    }
    hide() {
        super.hide();
        this._state.change({ isRevealed: false }, false);
        this._findWidgetVisible.set(false);
        this._findModel.clear();
        this._notebookEditor.findStop();
        this._progressBar.stop();
        if (this._hideTimeout === null) {
            if (this._showTimeout !== null) {
                DOM.getWindow(this.getDomNode()).clearTimeout(this._showTimeout);
                this._showTimeout = null;
                this._notebookEditor.removeClassName(FIND_SHOW_TRANSITION);
            }
            this._notebookEditor.addClassName(FIND_HIDE_TRANSITION);
            this._hideTimeout = DOM.getWindow(this.getDomNode()).setTimeout(() => {
                this._notebookEditor.removeClassName(FIND_HIDE_TRANSITION);
            }, 200);
        }
        else {
            // no op
        }
        if (this._previousFocusElement && this._previousFocusElement.offsetParent) {
            this._previousFocusElement.focus();
            this._previousFocusElement = undefined;
        }
        if (this._notebookEditor.hasModel()) {
            for (let i = 0; i < this._notebookEditor.getLength(); i++) {
                const cell = this._notebookEditor.cellAt(i);
                if (cell.getEditState() === CellEditState.Editing && cell.editStateSource === 'find') {
                    cell.updateEditState(CellEditState.Preview, 'closeFind');
                }
            }
        }
    }
    _updateMatchesCount() {
        if (!this._findModel || !this._findModel.findMatches) {
            return;
        }
        this._matchesCount.style.minWidth = MAX_MATCHES_COUNT_WIDTH + 'px';
        this._matchesCount.title = '';
        // remove previous content
        this._matchesCount.firstChild?.remove();
        let label;
        if (this._state.matchesCount > 0) {
            let matchesCount = String(this._state.matchesCount);
            if (this._state.matchesCount >= MATCHES_LIMIT) {
                matchesCount += '+';
            }
            const matchesPosition = this._findModel.currentMatch < 0 ? '?' : String((this._findModel.currentMatch + 1));
            label = strings.format(NLS_MATCHES_LOCATION, matchesPosition, matchesCount);
        }
        else {
            label = NLS_NO_RESULTS;
        }
        this._matchesCount.appendChild(document.createTextNode(label));
        alertFn(this._getAriaLabel(label, this._state.currentMatch, this._state.searchString));
        MAX_MATCHES_COUNT_WIDTH = Math.max(MAX_MATCHES_COUNT_WIDTH, this._matchesCount.clientWidth);
    }
    _getAriaLabel(label, currentMatch, searchString) {
        if (label === NLS_NO_RESULTS) {
            return searchString === ''
                ? localize('ariaSearchNoResultEmpty', "{0} found", label)
                : localize('ariaSearchNoResult', "{0} found for '{1}'", label, searchString);
        }
        // TODO@rebornix, aria for `cell ${index}, line {line}`
        return localize('ariaSearchNoResultWithLineNumNoCurrentMatch', "{0} found for '{1}'", label, searchString);
    }
    dispose() {
        this._notebookEditor?.removeClassName(FIND_SHOW_TRANSITION);
        this._notebookEditor?.removeClassName(FIND_HIDE_TRANSITION);
        this._findModel.dispose();
        super.dispose();
    }
};
NotebookFindWidget = __decorate([
    __param(1, IContextViewService),
    __param(2, IContextKeyService),
    __param(3, IConfigurationService),
    __param(4, IContextMenuService),
    __param(5, IHoverService),
    __param(6, IInstantiationService),
    __param(7, IStorageService)
], NotebookFindWidget);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tGaW5kV2lkZ2V0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL25vdGVib29rL2Jyb3dzZXIvY29udHJpYi9maW5kL25vdGVib29rRmluZFdpZGdldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLHVDQUF1QyxDQUFDO0FBRTdELE9BQU8sRUFBRSxLQUFLLElBQUksT0FBTyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFFbEYsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQzdELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN4RSxPQUFPLEtBQUssT0FBTyxNQUFNLDBDQUEwQyxDQUFDO0FBR3BFLE9BQU8sRUFBRSxhQUFhLEVBQUUsMkJBQTJCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUN4SCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUM5RixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsY0FBYyxFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDbkgsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sMEVBQTBFLENBQUM7QUFDbkgsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sdUVBQXVFLENBQUM7QUFDN0csT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3BELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3pHLE9BQU8sRUFBZSxrQkFBa0IsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzdHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3pILE9BQU8sRUFBRSxhQUFhLEVBQUUs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