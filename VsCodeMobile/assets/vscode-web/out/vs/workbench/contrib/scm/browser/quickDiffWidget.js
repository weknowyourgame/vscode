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
var QuickDiffEditorController_1;
import * as nls from '../../../../nls.js';
import * as dom from '../../../../base/browser/dom.js';
import * as domStylesheetsJs from '../../../../base/browser/domStylesheets.js';
import { Action, ActionRunner } from '../../../../base/common/actions.js';
import { Event } from '../../../../base/common/event.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { SelectActionViewItem } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { peekViewBorder, peekViewTitleBackground, peekViewTitleForeground, peekViewTitleInfoForeground, PeekViewWidget } from '../../../../editor/contrib/peekView/browser/peekView.js';
import { editorBackground } from '../../../../platform/theme/common/colorRegistry.js';
import { IMenuService, MenuId, MenuItemAction, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { EditorAction, registerEditorAction } from '../../../../editor/browser/editorExtensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { EmbeddedDiffEditorWidget } from '../../../../editor/browser/widget/diffEditor/embeddedDiffEditorWidget.js';
import { IQuickDiffModelService } from './quickDiffModel.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { rot } from '../../../../base/common/numbers.js';
import { ChangeType, getChangeHeight, getChangeType, getChangeTypeColor, getModifiedEndLineNumber, IQuickDiffService, lineIntersectsChange } from '../common/quickDiff.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { TextCompareEditorActiveContext } from '../../../common/contextkeys.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { KeybindingsRegistry } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { basename } from '../../../../base/common/resources.js';
import { Position } from '../../../../editor/common/core/position.js';
import { getFlatActionBarActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { gotoNextLocation, gotoPreviousLocation } from '../../../../platform/theme/common/iconRegistry.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Color } from '../../../../base/common/color.js';
import { getOuterEditor } from '../../../../editor/browser/widget/codeEditor/embeddedCodeEditorWidget.js';
import { quickDiffDecorationCount } from './quickDiffDecorator.js';
import { hasNativeContextMenu } from '../../../../platform/window/common/window.js';
export const isQuickDiffVisible = new RawContextKey('dirtyDiffVisible', false);
let QuickDiffPickerViewItem = class QuickDiffPickerViewItem extends SelectActionViewItem {
    constructor(action, contextViewService, themeService, configurationService) {
        const styles = { ...defaultSelectBoxStyles };
        const theme = themeService.getColorTheme();
        const editorBackgroundColor = theme.getColor(editorBackground);
        const peekTitleColor = theme.getColor(peekViewTitleBackground);
        const opaqueTitleColor = peekTitleColor?.makeOpaque(editorBackgroundColor) ?? editorBackgroundColor;
        styles.selectBackground = opaqueTitleColor.lighten(.6).toString();
        super(null, action, [], 0, contextViewService, styles, { ariaLabel: nls.localize('remotes', 'Switch quick diff base'), useCustomDrawn: !hasNativeContextMenu(configurationService) });
        this.optionsItems = [];
    }
    setSelection(quickDiffs, providerId) {
        this.optionsItems = quickDiffs.map(quickDiff => ({ providerId: quickDiff.id, text: quickDiff.label }));
        const index = this.optionsItems.findIndex(item => item.providerId === providerId);
        this.setOptions(this.optionsItems, index);
    }
    getActionContext(_, index) {
        return this.optionsItems[index];
    }
    render(container) {
        super.render(container);
        this.setFocusable(true);
    }
};
QuickDiffPickerViewItem = __decorate([
    __param(1, IContextViewService),
    __param(2, IThemeService),
    __param(3, IConfigurationService)
], QuickDiffPickerViewItem);
export { QuickDiffPickerViewItem };
export class QuickDiffPickerBaseAction extends Action {
    static { this.ID = 'quickDiff.base.switch'; }
    static { this.LABEL = nls.localize('quickDiff.base.switch', "Switch Quick Diff Base"); }
    constructor(callback) {
        super(QuickDiffPickerBaseAction.ID, QuickDiffPickerBaseAction.LABEL, undefined, undefined);
        this.callback = callback;
    }
    async run(event) {
        return this.callback(event);
    }
}
class QuickDiffWidgetActionRunner extends ActionRunner {
    runAction(action, context) {
        if (action instanceof MenuItemAction) {
            return action.run(...context);
        }
        return super.runAction(action, context);
    }
}
let QuickDiffWidgetEditorAction = class QuickDiffWidgetEditorAction extends Action {
    constructor(editor, action, cssClass, keybindingService, instantiationService) {
        const keybinding = keybindingService.lookupKeybinding(action.id);
        const label = action.label + (keybinding ? ` (${keybinding.getLabel()})` : '');
        super(action.id, label, cssClass);
        this.instantiationService = instantiationService;
        this.action = action;
        this.editor = editor;
    }
    run() {
        return Promise.resolve(this.instantiationService.invokeFunction(accessor => this.action.run(accessor, this.editor, null)));
    }
};
QuickDiffWidgetEditorAction = __decorate([
    __param(3, IKeybindingService),
    __param(4, IInstantiationService)
], QuickDiffWidgetEditorAction);
let QuickDiffWidget = class QuickDiffWidget extends PeekViewWidget {
    constructor(editor, model, themeService, instantiationService, menuService, contextKeyService, quickDiffService) {
        super(editor, { isResizeable: true, frameWidth: 1, keepEditorSelection: true, className: 'dirty-diff' }, instantiationService);
        this.model = model;
        this.themeService = themeService;
        this.menuService = menuService;
        this.contextKeyService = contextKeyService;
        this.quickDiffService = quickDiffService;
        this._index = 0;
        this._providerId = '';
        this.height = undefined;
        this._disposables.add(themeService.onDidColorThemeChange(this._applyTheme, this));
        this._applyTheme(themeService.getColorTheme());
        if (!Iterable.isEmpty(this.model.originalTextModels)) {
            contextKeyService = contextKeyService.createOverlay([
                ['originalResourceScheme', Iterable.first(this.model.originalTextModels)?.uri.scheme],
                ['originalResourceSchemes', Iterable.map(this.model.originalTextModels, textModel => textModel.uri.scheme)]
            ]);
        }
        this.create();
        if (editor.hasModel()) {
            this.title = basename(editor.getModel().uri);
        }
        else {
            this.title = '';
        }
        this.setTitle(this.title);
    }
    get providerId() {
        return this._providerId;
    }
    get index() {
        return this._index;
    }
    get visibleRange() {
        const visibleRanges = this.diffEditor.getModifiedEditor().getVisibleRanges();
        return visibleRanges.length >= 0 ? visibleRanges[0] : undefined;
    }
    showChange(index, usePosition = true) {
        const labeledChange = this.model.changes[index];
        const change = labeledChange.change;
        this._index = index;
        this.contextKeyService.createKey('originalResource', this.model.changes[index].original.toString());
        this.contextKeyService.createKey('originalResourceScheme', this.model.changes[index].original.scheme);
        this.updateActions();
        this.change = change;
        this._providerId = labeledChange.providerId;
        if (Iterable.isEmpty(this.model.originalTextModels)) {
            return;
        }
        const onFirstDiffUpdate = Event.once(this.diffEditor.onDidUpdateDiff);
        // TODO@joao TODO@alex need this setTimeout probably because the
        // non-side-by-side diff still hasn't created the view zones
        onFirstDiffUpdate(() => setTimeout(() => this.revealChange(change), 0));
        const diffEditorModel = this.model.getDiffEditorModel(labeledChange.original);
        if (!diffEditorModel) {
            return;
        }
        this.diffEditor.setModel(diffEditorModel);
        const position = new Position(getModifiedEndLineNumber(change), 1);
        const lineHeight = this.editor.getOption(75 /* EditorOption.lineHeight */);
        const editorHeight = this.editor.getLayoutInfo().height;
        const editorHeightInLines = Math.floor(editorHeight / lineHeight);
        const height = Math.min(getChangeHeight(change) + 2 /* arrow, frame, header */ + 6 /* 3 lines above/below the change */, Math.floor(editorHeightInLines / 3));
        this.renderTitle();
        this.updateDropdown();
        const changeType = getChangeType(change);
        const changeTypeColor = getChangeTypeColor(this.themeService.getColorTheme(), changeType);
        this.style({ frameColor: changeTypeColor, arrowColor: changeTypeColor });
        const providerSpecificChanges = [];
        let contextIndex = index;
        for (const change of this.model.changes) {
            if (change.providerId === this.model.changes[this._index].providerId) {
                providerSpecificChanges.push(change.change);
                if (labeledChange === change) {
                    contextIndex = providerSpecificChanges.length - 1;
                }
            }
        }
        this._actionbarWidget.context = [diffEditorModel.modified.uri, providerSpecificChanges, contextIndex];
        if (usePosition) {
            // In order to account for the 1px border-top of the content element we
            // have to add 1px. The pixel value needs to be expressed as a fraction
            // of the line height.
            this.show(position, height + (1 / lineHeight));
            this.editor.setPosition(position);
            this.editor.focus();
        }
    }
    renderTitle() {
        const providerChanges = this.model.quickDiffChanges.get(this._providerId);
        const providerIndex = providerChanges.indexOf(this._index);
        let detail;
        if (!this.shouldUseDropdown()) {
            const label = this.model.quickDiffs
                .find(quickDiff => quickDiff.id === this._providerId)?.label ?? '';
            detail = this.model.changes.length > 1
                ? nls.localize('changes', "{0} - {1} of {2} changes", label, providerIndex + 1, providerChanges.length)
                : nls.localize('change', "{0} - {1} of {2} change", label, providerIndex + 1, providerChanges.length);
            this.dropdownContainer.style.display = 'none';
        }
        else {
            detail = this.model.changes.length > 1
                ? nls.localize('multiChanges', "{0} of {1} changes", providerIndex + 1, providerChanges.length)
                : nls.localize('multiChange', "{0} of {1} change", providerIndex + 1, providerChanges.length);
            this.dropdownContainer.style.display = 'inherit';
        }
        this.setTitle(this.title, detail);
    }
    switchQuickDiff(event) {
        const newProviderId = event?.providerId;
        if (newProviderId === this.model.changes[this._index].providerId) {
            return;
        }
        let closestGreaterIndex = this._index < this.model.changes.length - 1 ? this._index + 1 : 0;
        for (let i = closestGreaterIndex; i !== this._index; i < this.model.changes.length - 1 ? i++ : i = 0) {
            if (this.model.changes[i].providerId === newProviderId) {
                closestGreaterIndex = i;
                break;
            }
        }
        let closestLesserIndex = this._index > 0 ? this._index - 1 : this.model.changes.length - 1;
        for (let i = closestLesserIndex; i !== this._index; i > 0 ? i-- : i = this.model.changes.length - 1) {
            if (this.model.changes[i].providerId === newProviderId) {
                closestLesserIndex = i;
                break;
            }
        }
        const closestIndex = Math.abs(this.model.changes[closestGreaterIndex].change.modifiedEndLineNumber - this.model.changes[this._index].change.modifiedEndLineNumber)
            < Math.abs(this.model.changes[closestLesserIndex].change.modifiedEndLineNumber - this.model.changes[this._index].change.modifiedEndLineNumber)
            ? closestGreaterIndex : closestLesserIndex;
        this.showChange(closestIndex, false);
    }
    shouldUseDropdown() {
        const quickDiffs = this.getQuickDiffsContainingChange();
        return quickDiffs.length > 1;
    }
    updateActions() {
        if (!this._actionbarWidget) {
            return;
        }
        const previous = this.instantiationService.createInstance(QuickDiffWidgetEditorAction, this.editor, new ShowPreviousChangeAction(this.editor), ThemeIcon.asClassName(gotoPreviousLocation));
        const next = this.instantiationService.createInstance(QuickDiffWidgetEditorAction, this.editor, new ShowNextChangeAction(this.editor), ThemeIcon.asClassName(gotoNextLocation));
        this._disposables.add(previous);
        this._disposables.add(next);
        if (this.menu) {
            this.menu.dispose();
        }
        this.menu = this.menuService.createMenu(MenuId.SCMChangeContext, this.contextKeyService);
        const actions = getFlatActionBarActions(this.menu.getActions({ shouldForwardArgs: true }));
        this._actionbarWidget.clear();
        this._actionbarWidget.push(actions.reverse(), { label: false, icon: true });
        this._actionbarWidget.push([next, previous], { label: false, icon: true });
        this._actionbarWidget.push(this._disposables.add(new Action('peekview.close', nls.localize('label.close', "Close"), ThemeIcon.asClassName(Codicon.close), true, () => this.dispose())), { label: false, icon: true });
    }
    updateDropdown() {
        const quickDiffs = this.getQuickDiffsContainingChange();
        this.dropdown?.setSelection(quickDiffs, this._providerId);
    }
    getQuickDiffsContainingChange() {
        const change = this.model.changes[this._index];
        const quickDiffsWithChange = this.model.changes
            .filter(c => change.change2.modified.intersectsOrTouches(c.change2.modified))
            .map(c => c.providerId);
        return this.model.quickDiffs
            .filter(quickDiff => quickDiffsWithChange.includes(quickDiff.id) &&
            this.quickDiffService.isQuickDiffProviderVisible(quickDiff.id));
    }
    _fillHead(container) {
        super._fillHead(container, true);
        // Render an empty picker which will be populated later
        this.dropdownContainer = dom.prepend(this._titleElement, dom.$('.dropdown'));
        this.dropdown = this.instantiationService.createInstance(QuickDiffPickerViewItem, new QuickDiffPickerBaseAction((event) => this.switchQuickDiff(event)));
        this.dropdown.render(this.dropdownContainer);
    }
    _getActionBarOptions() {
        const actionRunner = new QuickDiffWidgetActionRunner();
        this._disposables.add(actionRunner);
        // close widget on successful action
        this._disposables.add(actionRunner.onDidRun(e => {
            if (!(e.action instanceof QuickDiffWidgetEditorAction) && !e.error) {
                this.dispose();
            }
        }));
        return {
            ...super._getActionBarOptions(),
            actionRunner
        };
    }
    _fillBody(container) {
        const options = {
            diffAlgorithm: 'advanced',
            fixedOverflowWidgets: true,
            ignoreTrimWhitespace: false,
            minimap: { enabled: false },
            readOnly: false,
            renderGutterMenu: false,
            renderIndicators: false,
            renderOverviewRuler: false,
            renderSideBySide: false,
            scrollbar: {
                verticalScrollbarSize: 14,
                horizontal: 'auto',
                useShadows: true,
                verticalHasArrows: false,
                horizontalHasArrows: false
            },
            scrollBeyondLastLine: false,
            stickyScroll: { enabled: false }
        };
        this.diffEditor = this.instantiationService.createInstance(EmbeddedDiffEditorWidget, container, options, {}, this.editor);
        this._disposables.add(this.diffEditor);
    }
    _onWidth(width) {
        if (typeof this.height === 'undefined') {
            return;
        }
        this.diffEditor.layout({ height: this.height, width });
    }
    _doLayoutBody(height, width) {
        super._doLayoutBody(height, width);
        this.diffEditor.layout({ height, width });
        if (typeof this.height === 'undefined' && this.change) {
            this.revealChange(this.change);
        }
        this.height = height;
    }
    revealChange(change) {
        let start, end;
        if (change.modifiedEndLineNumber === 0) { // deletion
            start = change.modifiedStartLineNumber;
            end = change.modifiedStartLineNumber + 1;
        }
        else if (change.originalEndLineNumber > 0) { // modification
            start = change.modifiedStartLineNumber - 1;
            end = change.modifiedEndLineNumber + 1;
        }
        else { // insertion
            start = change.modifiedStartLineNumber;
            end = change.modifiedEndLineNumber;
        }
        this.diffEditor.revealLinesInCenter(start, end, 1 /* ScrollType.Immediate */);
    }
    _applyTheme(theme) {
        const borderColor = theme.getColor(peekViewBorder) || Color.transparent;
        this.style({
            arrowColor: borderColor,
            frameColor: borderColor,
            headerBackgroundColor: theme.getColor(peekViewTitleBackground) || Color.transparent,
            primaryHeadingColor: theme.getColor(peekViewTitleForeground),
            secondaryHeadingColor: theme.getColor(peekViewTitleInfoForeground)
        });
    }
    revealRange(range) {
        this.editor.revealLineInCenterIfOutsideViewport(range.endLineNumber, 0 /* ScrollType.Smooth */);
    }
    hasFocus() {
        return this.diffEditor.hasTextFocus();
    }
    dispose() {
        super.dispose();
        this.menu?.dispose();
    }
};
QuickDiffWidget = __decorate([
    __param(2, IThemeService),
    __param(3, IInstantiationService),
    __param(4, IMenuService),
    __param(5, IContextKeyService),
    __param(6, IQuickDiffService)
], QuickDiffWidget);
let QuickDiffEditorController = class QuickDiffEditorController extends Disposable {
    static { QuickDiffEditorController_1 = this; }
    static { this.ID = 'editor.contrib.quickdiff'; }
    static get(editor) {
        return editor.getContribution(QuickDiffEditorController_1.ID);
    }
    constructor(editor, contextKeyService, configurationService, quickDiffModelService, instantiationService) {
        super();
        this.editor = editor;
        this.configurationService = configurationService;
        this.quickDiffModelService = quickDiffModelService;
        this.instantiationService = instantiationService;
        this.model = null;
        this.widget = null;
        this.session = Disposable.None;
        this.mouseDownInfo = null;
        this.enabled = false;
        this.gutterActionDisposables = new DisposableStore();
        this.enabled = !contextKeyService.getContextKeyValue('isInDiffEditor');
        this.stylesheet = domStylesheetsJs.createStyleSheet(undefined, undefined, this._store);
        if (this.enabled) {
            this.isQuickDiffVisible = isQuickDiffVisible.bindTo(contextKeyService);
            this._register(editor.onDidChangeModel(() => this.close()));
            const onDidChangeGutterAction = Event.filter(configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('scm.diffDecorationsGutterAction'));
            this._register(onDidChangeGutterAction(this.onDidChangeGutterAction, this));
            this.onDidChangeGutterAction();
        }
    }
    onDidChangeGutterAction() {
        const gutterAction = this.configurationService.getValue('scm.diffDecorationsGutterAction');
        this.gutterActionDisposables.clear();
        if (gutterAction === 'diff') {
            this.gutterActionDisposables.add(this.editor.onMouseDown(e => this.onEditorMouseDown(e)));
            this.gutterActionDisposables.add(this.editor.onMouseUp(e => this.onEditorMouseUp(e)));
            this.stylesheet.textContent = `
				.monaco-editor .dirty-diff-glyph {
					cursor: pointer;
				}

				.monaco-editor .margin-view-overlays .dirty-diff-glyph:hover::before {
					height: 100%;
					width: 6px;
					left: -6px;
				}

				.monaco-editor .margin-view-overlays .dirty-diff-deleted:hover::after {
					bottom: 0;
					border-top-width: 0;
					border-bottom-width: 0;
				}
			`;
        }
        else {
            this.stylesheet.textContent = ``;
        }
    }
    canNavigate() {
        return !this.widget || (this.widget?.index === -1) || (!!this.model && this.model.changes.length > 1);
    }
    refresh() {
        this.widget?.showChange(this.widget.index, false);
    }
    next(lineNumber) {
        if (!this.assertWidget()) {
            return;
        }
        if (!this.widget || !this.model) {
            return;
        }
        let index;
        if (this.editor.hasModel() && (typeof lineNumber === 'number' || !this.widget.providerId)) {
            index = this.model.findNextClosestChange(typeof lineNumber === 'number' ? lineNumber : this.editor.getPosition().lineNumber, true, this.widget.providerId);
        }
        else {
            const providerChanges = this.model.quickDiffChanges.get(this.widget.providerId) ?? this.model.quickDiffChanges.values().next().value;
            const mapIndex = providerChanges.findIndex(value => value === this.widget.index);
            index = providerChanges[rot(mapIndex + 1, providerChanges.length)];
        }
        this.widget.showChange(index);
    }
    previous(lineNumber) {
        if (!this.assertWidget()) {
            return;
        }
        if (!this.widget || !this.model) {
            return;
        }
        let index;
        if (this.editor.hasModel() && (typeof lineNumber === 'number' || !this.widget.providerId)) {
            index = this.model.findPreviousClosestChange(typeof lineNumber === 'number' ? lineNumber : this.editor.getPosition().lineNumber, true, this.widget.providerId);
        }
        else {
            const providerChanges = this.model.quickDiffChanges.get(this.widget.providerId) ?? this.model.quickDiffChanges.values().next().value;
            const mapIndex = providerChanges.findIndex(value => value === this.widget.index);
            index = providerChanges[rot(mapIndex - 1, providerChanges.length)];
        }
        this.widget.showChange(index);
    }
    close() {
        this.session.dispose();
        this.session = Disposable.None;
    }
    assertWidget() {
        if (!this.enabled) {
            return false;
        }
        if (this.widget) {
            if (!this.model || this.model.changes.length === 0) {
                this.close();
                return false;
            }
            return true;
        }
        const editorModel = this.editor.getModel();
        if (!editorModel) {
            return false;
        }
        const modelRef = this.quickDiffModelService.createQuickDiffModelReference(editorModel.uri);
        if (!modelRef) {
            return false;
        }
        if (modelRef.object.changes.length === 0) {
            modelRef.dispose();
            return false;
        }
        this.model = modelRef.object;
        this.widget = this.instantiationService.createInstance(QuickDiffWidget, this.editor, this.model);
        this.isQuickDiffVisible.set(true);
        const disposables = new DisposableStore();
        disposables.add(Event.once(this.widget.onDidClose)(this.close, this));
        const onDidModelChange = Event.chain(this.model.onDidChange, $ => $.filter(e => e.diff.length > 0)
            .map(e => e.diff));
        onDidModelChange(this.onDidModelChange, this, disposables);
        disposables.add(modelRef);
        disposables.add(this.widget);
        disposables.add(toDisposable(() => {
            this.model = null;
            this.widget = null;
            this.isQuickDiffVisible.set(false);
            this.editor.focus();
        }));
        this.session = disposables;
        return true;
    }
    onDidModelChange(splices) {
        if (!this.model || !this.widget || this.widget.hasFocus()) {
            return;
        }
        for (const splice of splices) {
            if (splice.start <= this.widget.index) {
                this.next();
                return;
            }
        }
        this.refresh();
    }
    onEditorMouseDown(e) {
        this.mouseDownInfo = null;
        const range = e.target.range;
        if (!range) {
            return;
        }
        if (!e.event.leftButton) {
            return;
        }
        if (e.target.type !== 4 /* MouseTargetType.GUTTER_LINE_DECORATIONS */) {
            return;
        }
        if (!e.target.element) {
            return;
        }
        if (e.target.element.className.indexOf('dirty-diff-glyph') < 0) {
            return;
        }
        const data = e.target.detail;
        const offsetLeftInGutter = e.target.element.offsetLeft;
        const gutterOffsetX = data.offsetX - offsetLeftInGutter;
        // TODO@joao TODO@alex TODO@martin this is such that we don't collide with folding
        if (gutterOffsetX < -3 || gutterOffsetX > 3) { // dirty diff decoration on hover is 6px wide
            return;
        }
        this.mouseDownInfo = { lineNumber: range.startLineNumber };
    }
    onEditorMouseUp(e) {
        if (!this.mouseDownInfo) {
            return;
        }
        const { lineNumber } = this.mouseDownInfo;
        this.mouseDownInfo = null;
        const range = e.target.range;
        if (!range || range.startLineNumber !== lineNumber) {
            return;
        }
        if (e.target.type !== 4 /* MouseTargetType.GUTTER_LINE_DECORATIONS */) {
            return;
        }
        const editorModel = this.editor.getModel();
        if (!editorModel) {
            return;
        }
        const modelRef = this.quickDiffModelService.createQuickDiffModelReference(editorModel.uri);
        if (!modelRef) {
            return;
        }
        try {
            const index = modelRef.object.changes
                .findIndex(change => lineIntersectsChange(lineNumber, change.change));
            if (index < 0) {
                return;
            }
            if (index === this.widget?.index) {
                this.close();
            }
            else {
                this.next(lineNumber);
            }
        }
        finally {
            modelRef.dispose();
        }
    }
    dispose() {
        this.gutterActionDisposables.dispose();
        super.dispose();
    }
};
QuickDiffEditorController = QuickDiffEditorController_1 = __decorate([
    __param(1, IContextKeyService),
    __param(2, IConfigurationService),
    __param(3, IQuickDiffModelService),
    __param(4, IInstantiationService)
], QuickDiffEditorController);
export { QuickDiffEditorController };
export class ShowPreviousChangeAction extends EditorAction {
    constructor(outerEditor) {
        super({
            id: 'editor.action.dirtydiff.previous',
            label: nls.localize2('show previous change', "Show Previous Change"),
            precondition: TextCompareEditorActiveContext.toNegated(),
            kbOpts: { kbExpr: EditorContextKeys.editorTextFocus, primary: 1024 /* KeyMod.Shift */ | 512 /* KeyMod.Alt */ | 61 /* KeyCode.F3 */, weight: 100 /* KeybindingWeight.EditorContrib */ }
        });
        this.outerEditor = outerEditor;
    }
    run(accessor) {
        const outerEditor = this.outerEditor ?? getOuterEditorFromDiffEditor(accessor);
        if (!outerEditor) {
            return;
        }
        const controller = QuickDiffEditorController.get(outerEditor);
        if (!controller) {
            return;
        }
        if (!controller.canNavigate()) {
            return;
        }
        controller.previous();
    }
}
registerEditorAction(ShowPreviousChangeAction);
export class ShowNextChangeAction extends EditorAction {
    constructor(outerEditor) {
        super({
            id: 'editor.action.dirtydiff.next',
            label: nls.localize2('show next change', "Show Next Change"),
            precondition: TextCompareEditorActiveContext.toNegated(),
            kbOpts: { kbExpr: EditorContextKeys.editorTextFocus, primary: 512 /* KeyMod.Alt */ | 61 /* KeyCode.F3 */, weight: 100 /* KeybindingWeight.EditorContrib */ }
        });
        this.outerEditor = outerEditor;
    }
    run(accessor) {
        const outerEditor = this.outerEditor ?? getOuterEditorFromDiffEditor(accessor);
        if (!outerEditor) {
            return;
        }
        const controller = QuickDiffEditorController.get(outerEditor);
        if (!controller) {
            return;
        }
        if (!controller.canNavigate()) {
            return;
        }
        controller.next();
    }
}
registerEditorAction(ShowNextChangeAction);
export class GotoPreviousChangeAction extends EditorAction {
    constructor() {
        super({
            id: 'workbench.action.editor.previousChange',
            label: nls.localize2('move to previous change', "Go to Previous Change"),
            precondition: ContextKeyExpr.and(TextCompareEditorActiveContext.toNegated(), quickDiffDecorationCount.notEqualsTo(0)),
            kbOpts: { kbExpr: EditorContextKeys.editorTextFocus, primary: 1024 /* KeyMod.Shift */ | 512 /* KeyMod.Alt */ | 63 /* KeyCode.F5 */, weight: 100 /* KeybindingWeight.EditorContrib */ }
        });
    }
    async run(accessor) {
        const outerEditor = getOuterEditorFromDiffEditor(accessor);
        const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
        const accessibilityService = accessor.get(IAccessibilityService);
        const codeEditorService = accessor.get(ICodeEditorService);
        const quickDiffModelService = accessor.get(IQuickDiffModelService);
        if (!outerEditor || !outerEditor.hasModel()) {
            return;
        }
        const modelRef = quickDiffModelService.createQuickDiffModelReference(outerEditor.getModel().uri);
        try {
            if (!modelRef || modelRef.object.changes.length === 0) {
                return;
            }
            const lineNumber = outerEditor.getPosition().lineNumber;
            const index = modelRef.object.findPreviousClosestChange(lineNumber, false);
            const change = modelRef.object.changes[index];
            await playAccessibilitySymbolForChange(change.change, accessibilitySignalService);
            setPositionAndSelection(change.change, outerEditor, accessibilityService, codeEditorService);
        }
        finally {
            modelRef?.dispose();
        }
    }
}
registerEditorAction(GotoPreviousChangeAction);
export class GotoNextChangeAction extends EditorAction {
    constructor() {
        super({
            id: 'workbench.action.editor.nextChange',
            label: nls.localize2('move to next change', "Go to Next Change"),
            precondition: ContextKeyExpr.and(TextCompareEditorActiveContext.toNegated(), quickDiffDecorationCount.notEqualsTo(0)),
            kbOpts: { kbExpr: EditorContextKeys.editorTextFocus, primary: 512 /* KeyMod.Alt */ | 63 /* KeyCode.F5 */, weight: 100 /* KeybindingWeight.EditorContrib */ }
        });
    }
    async run(accessor) {
        const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
        const outerEditor = getOuterEditorFromDiffEditor(accessor);
        const accessibilityService = accessor.get(IAccessibilityService);
        const codeEditorService = accessor.get(ICodeEditorService);
        const quickDiffModelService = accessor.get(IQuickDiffModelService);
        if (!outerEditor || !outerEditor.hasModel()) {
            return;
        }
        const modelRef = quickDiffModelService.createQuickDiffModelReference(outerEditor.getModel().uri);
        try {
            if (!modelRef || modelRef.object.changes.length === 0) {
                return;
            }
            const lineNumber = outerEditor.getPosition().lineNumber;
            const index = modelRef.object.findNextClosestChange(lineNumber, false);
            const change = modelRef.object.changes[index].change;
            await playAccessibilitySymbolForChange(change, accessibilitySignalService);
            setPositionAndSelection(change, outerEditor, accessibilityService, codeEditorService);
        }
        finally {
            modelRef?.dispose();
        }
    }
}
registerEditorAction(GotoNextChangeAction);
MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
    group: '7_change_nav',
    command: {
        id: 'editor.action.dirtydiff.next',
        title: nls.localize({ key: 'miGotoNextChange', comment: ['&& denotes a mnemonic'] }, "Next &&Change")
    },
    order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
    group: '7_change_nav',
    command: {
        id: 'editor.action.dirtydiff.previous',
        title: nls.localize({ key: 'miGotoPreviousChange', comment: ['&& denotes a mnemonic'] }, "Previous &&Change")
    },
    order: 2
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'closeQuickDiff',
    weight: 100 /* KeybindingWeight.EditorContrib */ + 50,
    primary: 9 /* KeyCode.Escape */,
    secondary: [1024 /* KeyMod.Shift */ | 9 /* KeyCode.Escape */],
    when: ContextKeyExpr.and(isQuickDiffVisible),
    handler: (accessor) => {
        const outerEditor = getOuterEditorFromDiffEditor(accessor);
        if (!outerEditor) {
            return;
        }
        const controller = QuickDiffEditorController.get(outerEditor);
        if (!controller) {
            return;
        }
        controller.close();
    }
});
function setPositionAndSelection(change, editor, accessibilityService, codeEditorService) {
    const position = new Position(change.modifiedStartLineNumber, 1);
    editor.setPosition(position);
    editor.revealPositionInCenter(position);
    if (accessibilityService.isScreenReaderOptimized()) {
        editor.setSelection({ startLineNumber: change.modifiedStartLineNumber, startColumn: 0, endLineNumber: change.modifiedStartLineNumber, endColumn: Number.MAX_VALUE });
        codeEditorService.getActiveCodeEditor()?.writeScreenReaderContent('diff-navigation');
    }
}
async function playAccessibilitySymbolForChange(change, accessibilitySignalService) {
    const changeType = getChangeType(change);
    switch (changeType) {
        case ChangeType.Add:
            accessibilitySignalService.playSignal(AccessibilitySignal.diffLineInserted, { allowManyInParallel: true, source: 'quickDiffDecoration' });
            break;
        case ChangeType.Delete:
            accessibilitySignalService.playSignal(AccessibilitySignal.diffLineDeleted, { allowManyInParallel: true, source: 'quickDiffDecoration' });
            break;
        case ChangeType.Modify:
            accessibilitySignalService.playSignal(AccessibilitySignal.diffLineModified, { allowManyInParallel: true, source: 'quickDiffDecoration' });
            break;
    }
}
function getOuterEditorFromDiffEditor(accessor) {
    const diffEditors = accessor.get(ICodeEditorService).listDiffEditors();
    for (const diffEditor of diffEditors) {
        if (diffEditor.hasTextFocus() && diffEditor instanceof EmbeddedDiffEditorWidget) {
            return diffEditor.getParentEditor();
        }
    }
    return getOuterEditor(accessor);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVpY2tEaWZmV2lkZ2V0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3NjbS9icm93c2VyL3F1aWNrRGlmZldpZGdldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUMxQyxPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sS0FBSyxnQkFBZ0IsTUFBTSw0Q0FBNEMsQ0FBQztBQUMvRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBVyxNQUFNLG9DQUFvQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUU5RixPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUNoRyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUM3RixPQUFPLEVBQWUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDL0YsT0FBTyxFQUFFLGNBQWMsRUFBRSx1QkFBdUIsRUFBRSx1QkFBdUIsRUFBRSwyQkFBMkIsRUFBRSxjQUFjLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN4TCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN0RixPQUFPLEVBQVMsWUFBWSxFQUFFLE1BQU0sRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFFM0gsT0FBTyxFQUFFLFlBQVksRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxxQkFBcUIsRUFBb0IsTUFBTSw0REFBNEQsQ0FBQztB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