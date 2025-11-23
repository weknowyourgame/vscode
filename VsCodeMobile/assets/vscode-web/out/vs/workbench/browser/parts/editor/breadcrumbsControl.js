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
var OutlineItem_1, FileItem_1, BreadcrumbsControl_1;
import * as dom from '../../../../base/browser/dom.js';
import { StandardMouseEvent } from '../../../../base/browser/mouseEvent.js';
import { PixelRatio } from '../../../../base/browser/pixelRatio.js';
import { BreadcrumbsItem, BreadcrumbsWidget } from '../../../../base/browser/ui/breadcrumbs/breadcrumbsWidget.js';
import { applyDragImage } from '../../../../base/browser/ui/dnd/dnd.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { timeout } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter } from '../../../../base/common/event.js';
import { combinedDisposable, DisposableStore, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { basename, extUri } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { OutlineElement } from '../../../../editor/contrib/documentSymbols/browser/outlineModel.js';
import { localize, localize2 } from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { fillInSymbolsDragData, LocalSelectionTransfer } from '../../../../platform/dnd/browser/dnd.js';
import { FileKind, IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingsRegistry } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IListService, WorkbenchAsyncDataTree, WorkbenchDataTree, WorkbenchListFocusContextKey } from '../../../../platform/list/browser/listService.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { defaultBreadcrumbsWidgetStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { EditorResourceAccessor, SideBySideEditor } from '../../../common/editor.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { DraggedEditorIdentifier, fillEditorsDragData } from '../../dnd.js';
import { DEFAULT_LABELS_CONTAINER, ResourceLabels } from '../../labels.js';
import { BreadcrumbsConfig, IBreadcrumbsService } from './breadcrumbs.js';
import { BreadcrumbsModel, FileElement, OutlineElement2 } from './breadcrumbsModel.js';
import { BreadcrumbsFilePicker, BreadcrumbsOutlinePicker } from './breadcrumbsPicker.js';
import './media/breadcrumbscontrol.css';
let OutlineItem = OutlineItem_1 = class OutlineItem extends BreadcrumbsItem {
    constructor(model, element, options, _instantiationService) {
        super();
        this.model = model;
        this.element = element;
        this.options = options;
        this._instantiationService = _instantiationService;
        this._disposables = new DisposableStore();
    }
    dispose() {
        this._disposables.dispose();
    }
    equals(other) {
        if (!(other instanceof OutlineItem_1)) {
            return false;
        }
        return this.element.element === other.element.element &&
            this.options.showFileIcons === other.options.showFileIcons &&
            this.options.showSymbolIcons === other.options.showSymbolIcons;
    }
    render(container) {
        const { element, outline } = this.element;
        if (element === outline) {
            const element = dom.$('span', undefined, '…');
            container.appendChild(element);
            return;
        }
        const templateId = outline.config.delegate.getTemplateId(element);
        const renderer = outline.config.renderers.find(renderer => renderer.templateId === templateId);
        if (!renderer) {
            container.textContent = '<<NO RENDERER>>';
            return;
        }
        const template = renderer.renderTemplate(container);
        renderer.renderElement({
            element,
            children: [],
            depth: 0,
            visibleChildrenCount: 0,
            visibleChildIndex: 0,
            collapsible: false,
            collapsed: false,
            visible: true,
            filterData: undefined
        }, 0, template, undefined);
        if (!this.options.showSymbolIcons) {
            dom.hide(template.iconClass);
        }
        this._disposables.add(toDisposable(() => { renderer.disposeTemplate(template); }));
        if (element instanceof OutlineElement && outline.uri) {
            this._disposables.add(this._instantiationService.invokeFunction(accessor => createBreadcrumbDndObserver(accessor, container, element.symbol.name, { symbol: element.symbol, uri: outline.uri }, this.model, this.options.dragEditor)));
        }
    }
};
OutlineItem = OutlineItem_1 = __decorate([
    __param(3, IInstantiationService)
], OutlineItem);
let FileItem = FileItem_1 = class FileItem extends BreadcrumbsItem {
    constructor(model, element, options, _labels, _hoverDelegate, _instantiationService) {
        super();
        this.model = model;
        this.element = element;
        this.options = options;
        this._labels = _labels;
        this._hoverDelegate = _hoverDelegate;
        this._instantiationService = _instantiationService;
        this._disposables = new DisposableStore();
    }
    dispose() {
        this._disposables.dispose();
    }
    equals(other) {
        if (!(other instanceof FileItem_1)) {
            return false;
        }
        return (extUri.isEqual(this.element.uri, other.element.uri) &&
            this.options.showFileIcons === other.options.showFileIcons &&
            this.options.showSymbolIcons === other.options.showSymbolIcons);
    }
    render(container) {
        // file/folder
        const label = this._labels.create(container, { hoverDelegate: this._hoverDelegate });
        label.setFile(this.element.uri, {
            hidePath: true,
            hideIcon: this.element.kind === FileKind.FOLDER || !this.options.showFileIcons,
            fileKind: this.element.kind,
            fileDecorations: { colors: this.options.showDecorationColors, badges: false },
        });
        container.classList.add(FileKind[this.element.kind].toLowerCase());
        this._disposables.add(label);
        this._disposables.add(this._instantiationService.invokeFunction(accessor => createBreadcrumbDndObserver(accessor, container, basename(this.element.uri), this.element.uri, this.model, this.options.dragEditor)));
    }
};
FileItem = FileItem_1 = __decorate([
    __param(5, IInstantiationService)
], FileItem);
function createBreadcrumbDndObserver(accessor, container, label, item, model, dragEditor) {
    const instantiationService = accessor.get(IInstantiationService);
    container.draggable = true;
    return new dom.DragAndDropObserver(container, {
        onDragStart: event => {
            if (!event.dataTransfer) {
                return;
            }
            // Set data transfer
            event.dataTransfer.effectAllowed = 'copyMove';
            instantiationService.invokeFunction(accessor => {
                if (URI.isUri(item)) {
                    fillEditorsDragData(accessor, [item], event);
                }
                else { // Symbol
                    fillEditorsDragData(accessor, [{ resource: item.uri, selection: item.symbol.range }], event);
                    fillInSymbolsDragData([{
                            name: item.symbol.name,
                            fsPath: item.uri.fsPath,
                            range: item.symbol.range,
                            kind: item.symbol.kind
                        }], event);
                }
                if (dragEditor && model.editor?.input) {
                    const editorTransfer = LocalSelectionTransfer.getInstance();
                    editorTransfer.setData([new DraggedEditorIdentifier({ editor: model.editor.input, groupId: model.editor.group.id })], DraggedEditorIdentifier.prototype);
                }
            });
            applyDragImage(event, container, label);
        }
    });
}
const separatorIcon = registerIcon('breadcrumb-separator', Codicon.chevronRight, localize('separatorIcon', 'Icon for the separator in the breadcrumbs.'));
let BreadcrumbsControl = class BreadcrumbsControl {
    static { BreadcrumbsControl_1 = this; }
    static { this.HEIGHT = 22; }
    static { this.SCROLLBAR_SIZES = {
        default: 3,
        large: 8
    }; }
    static { this.SCROLLBAR_VISIBILITY = {
        auto: 1 /* ScrollbarVisibility.Auto */,
        visible: 3 /* ScrollbarVisibility.Visible */,
        hidden: 2 /* ScrollbarVisibility.Hidden */
    }; }
    static { this.Payload_Reveal = {}; }
    static { this.Payload_RevealAside = {}; }
    static { this.Payload_Pick = {}; }
    static { this.CK_BreadcrumbsPossible = new RawContextKey('breadcrumbsPossible', false, localize('breadcrumbsPossible', "Whether the editor can show breadcrumbs")); }
    static { this.CK_BreadcrumbsVisible = new RawContextKey('breadcrumbsVisible', false, localize('breadcrumbsVisible', "Whether breadcrumbs are currently visible")); }
    static { this.CK_BreadcrumbsActive = new RawContextKey('breadcrumbsActive', false, localize('breadcrumbsActive', "Whether breadcrumbs have focus")); }
    get onDidVisibilityChange() { return this._onDidVisibilityChange.event; }
    constructor(container, _options, _editorGroup, _contextKeyService, _contextViewService, _instantiationService, _quickInputService, _fileService, _editorService, _labelService, configurationService, breadcrumbsService) {
        this._options = _options;
        this._editorGroup = _editorGroup;
        this._contextKeyService = _contextKeyService;
        this._contextViewService = _contextViewService;
        this._instantiationService = _instantiationService;
        this._quickInputService = _quickInputService;
        this._fileService = _fileService;
        this._editorService = _editorService;
        this._labelService = _labelService;
        this._disposables = new DisposableStore();
        this._breadcrumbsDisposables = new DisposableStore();
        this._model = new MutableDisposable();
        this._breadcrumbsPickerShowing = false;
        this._onDidVisibilityChange = this._disposables.add(new Emitter());
        this.domNode = document.createElement('div');
        this.domNode.classList.add('breadcrumbs-control');
        dom.append(container, this.domNode);
        this._cfUseQuickPick = BreadcrumbsConfig.UseQuickPick.bindTo(configurationService);
        this._cfShowIcons = BreadcrumbsConfig.Icons.bindTo(configurationService);
        this._cfTitleScrollbarSizing = BreadcrumbsConfig.TitleScrollbarSizing.bindTo(configurationService);
        this._cfTitleScrollbarVisibility = BreadcrumbsConfig.TitleScrollbarVisibility.bindTo(configurationService);
        this._labels = this._instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER);
        const sizing = this._cfTitleScrollbarSizing.getValue() ?? 'default';
        const styles = _options.widgetStyles ?? defaultBreadcrumbsWidgetStyles;
        const visibility = this._cfTitleScrollbarVisibility?.getValue() ?? 'auto';
        this._widget = new BreadcrumbsWidget(this.domNode, BreadcrumbsControl_1.SCROLLBAR_SIZES[sizing], BreadcrumbsControl_1.SCROLLBAR_VISIBILITY[visibility], separatorIcon, styles);
        this._widget.onDidSelectItem(this._onSelectEvent, this, this._disposables);
        this._widget.onDidFocusItem(this._onFocusEvent, this, this._disposables);
        this._widget.onDidChangeFocus(this._updateCkBreadcrumbsActive, this, this._disposables);
        this._ckBreadcrumbsPossible = BreadcrumbsControl_1.CK_BreadcrumbsPossible.bindTo(this._contextKeyService);
        this._ckBreadcrumbsVisible = BreadcrumbsControl_1.CK_BreadcrumbsVisible.bindTo(this._contextKeyService);
        this._ckBreadcrumbsActive = BreadcrumbsControl_1.CK_BreadcrumbsActive.bindTo(this._contextKeyService);
        this._hoverDelegate = getDefaultHoverDelegate('mouse');
        this._disposables.add(breadcrumbsService.register(this._editorGroup.id, this._widget));
        this.hide();
    }
    dispose() {
        this._disposables.dispose();
        this._breadcrumbsDisposables.dispose();
        this._model.dispose();
        this._ckBreadcrumbsPossible.reset();
        this._ckBreadcrumbsVisible.reset();
        this._ckBreadcrumbsActive.reset();
        this._cfUseQuickPick.dispose();
        this._cfShowIcons.dispose();
        this._cfTitleScrollbarSizing.dispose();
        this._cfTitleScrollbarVisibility.dispose();
        this._widget.dispose();
        this._labels.dispose();
        this.domNode.remove();
    }
    get model() {
        return this._model.value;
    }
    layout(dim) {
        this._widget.layout(dim);
    }
    isHidden() {
        return this.domNode.classList.contains('hidden');
    }
    hide() {
        const wasHidden = this.isHidden();
        this._breadcrumbsDisposables.clear();
        this._ckBreadcrumbsVisible.set(false);
        this.domNode.classList.toggle('hidden', true);
        if (!wasHidden) {
            this._onDidVisibilityChange.fire();
        }
    }
    show() {
        const wasHidden = this.isHidden();
        this._ckBreadcrumbsVisible.set(true);
        this.domNode.classList.toggle('hidden', false);
        if (wasHidden) {
            this._onDidVisibilityChange.fire();
        }
    }
    revealLast() {
        this._widget.revealLast();
    }
    update() {
        this._breadcrumbsDisposables.clear();
        // honor diff editors and such
        const uri = EditorResourceAccessor.getCanonicalUri(this._editorGroup.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
        const wasHidden = this.isHidden();
        if (!uri || !this._fileService.hasProvider(uri)) {
            // cleanup and return when there is no input or when
            // we cannot handle this input
            this._ckBreadcrumbsPossible.set(false);
            if (!wasHidden) {
                this.hide();
                return true;
            }
            else {
                return false;
            }
        }
        // display uri which can be derived from certain inputs
        const fileInfoUri = EditorResourceAccessor.getOriginalUri(this._editorGroup.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
        this.show();
        this._ckBreadcrumbsPossible.set(true);
        const model = this._instantiationService.createInstance(BreadcrumbsModel, fileInfoUri ?? uri, this._editorGroup.activeEditorPane);
        this._model.value = model;
        this.domNode.classList.toggle('backslash-path', this._labelService.getSeparator(uri.scheme, uri.authority) === '\\');
        const updateBreadcrumbs = () => {
            this.domNode.classList.toggle('relative-path', model.isRelative());
            const showIcons = this._cfShowIcons.getValue();
            const options = {
                ...this._options,
                showFileIcons: this._options.showFileIcons && showIcons,
                showSymbolIcons: this._options.showSymbolIcons && showIcons
            };
            const items = model.getElements().map(element => element instanceof FileElement
                ? this._instantiationService.createInstance(FileItem, model, element, options, this._labels, this._hoverDelegate)
                : this._instantiationService.createInstance(OutlineItem, model, element, options));
            if (items.length === 0) {
                this._widget.setEnabled(false);
                this._widget.setItems([new class extends BreadcrumbsItem {
                        render(container) {
                            container.textContent = localize('empty', "no elements");
                        }
                        equals(other) {
                            return other === this;
                        }
                        dispose() {
                        }
                    }]);
            }
            else {
                this._widget.setEnabled(true);
                this._widget.setItems(items);
                this._widget.reveal(items[items.length - 1]);
            }
        };
        const listener = model.onDidUpdate(updateBreadcrumbs);
        const configListener = this._cfShowIcons.onDidChange(updateBreadcrumbs);
        updateBreadcrumbs();
        this._breadcrumbsDisposables.clear();
        this._breadcrumbsDisposables.add(listener);
        this._breadcrumbsDisposables.add(toDisposable(() => this._model.clear()));
        this._breadcrumbsDisposables.add(configListener);
        this._breadcrumbsDisposables.add(toDisposable(() => this._widget.setItems([])));
        const updateScrollbarSizing = () => {
            const sizing = this._cfTitleScrollbarSizing.getValue() ?? 'default';
            const visibility = this._cfTitleScrollbarVisibility?.getValue() ?? 'auto';
            this._widget.setHorizontalScrollbarSize(BreadcrumbsControl_1.SCROLLBAR_SIZES[sizing]);
            this._widget.setHorizontalScrollbarVisibility(BreadcrumbsControl_1.SCROLLBAR_VISIBILITY[visibility]);
        };
        updateScrollbarSizing();
        const updateScrollbarSizeListener = this._cfTitleScrollbarSizing.onDidChange(updateScrollbarSizing);
        const updateScrollbarVisibilityListener = this._cfTitleScrollbarVisibility.onDidChange(updateScrollbarSizing);
        this._breadcrumbsDisposables.add(updateScrollbarSizeListener);
        this._breadcrumbsDisposables.add(updateScrollbarVisibilityListener);
        // close picker on hide/update
        this._breadcrumbsDisposables.add({
            dispose: () => {
                if (this._breadcrumbsPickerShowing) {
                    this._contextViewService.hideContextView({ source: this });
                }
            }
        });
        return wasHidden !== this.isHidden();
    }
    _onFocusEvent(event) {
        if (event.item && this._breadcrumbsPickerShowing) {
            this._breadcrumbsPickerIgnoreOnceItem = undefined;
            this._widget.setSelection(event.item);
        }
    }
    _onSelectEvent(event) {
        if (!event.item) {
            return;
        }
        if (event.item === this._breadcrumbsPickerIgnoreOnceItem) {
            this._breadcrumbsPickerIgnoreOnceItem = undefined;
            this._widget.setFocused(undefined);
            this._widget.setSelection(undefined);
            return;
        }
        const { element } = event.item;
        this._editorGroup.focus();
        const group = this._getEditorGroup(event.payload);
        if (group !== undefined) {
            // reveal the item
            this._widget.setFocused(undefined);
            this._widget.setSelection(undefined);
            this._revealInEditor(event, element, group);
            return;
        }
        if (this._cfUseQuickPick.getValue()) {
            // using quick pick
            this._widget.setFocused(undefined);
            this._widget.setSelection(undefined);
            this._quickInputService.quickAccess.show(element instanceof OutlineElement2 ? '@' : '');
            return;
        }
        // show picker
        let picker;
        let pickerAnchor;
        this._contextViewService.showContextView({
            render: (parent) => {
                if (event.item instanceof FileItem) {
                    picker = this._instantiationService.createInstance(BreadcrumbsFilePicker, parent, event.item.model.resource);
                }
                else if (event.item instanceof OutlineItem) {
                    picker = this._instantiationService.createInstance(BreadcrumbsOutlinePicker, parent, event.item.model.resource);
                }
                const selectListener = picker.onWillPickElement(() => this._contextViewService.hideContextView({ source: this, didPick: true }));
                const zoomListener = PixelRatio.getInstance(dom.getWindow(this.domNode)).onDidChange(() => this._contextViewService.hideContextView({ source: this }));
                const focusTracker = dom.trackFocus(parent);
                const blurListener = focusTracker.onDidBlur(() => {
                    this._breadcrumbsPickerIgnoreOnceItem = this._widget.isDOMFocused() ? event.item : undefined;
                    this._contextViewService.hideContextView({ source: this });
                });
                this._breadcrumbsPickerShowing = true;
                this._updateCkBreadcrumbsActive();
                return combinedDisposable(picker, selectListener, zoomListener, focusTracker, blurListener);
            },
            getAnchor: () => {
                if (!pickerAnchor) {
                    const window = dom.getWindow(this.domNode);
                    const maxInnerWidth = window.innerWidth - 8 /*a little less the full widget*/;
                    let maxHeight = Math.min(window.innerHeight * 0.7, 300);
                    const pickerWidth = Math.min(maxInnerWidth, Math.max(240, maxInnerWidth / 4.17));
                    const pickerArrowSize = 8;
                    let pickerArrowOffset;
                    const data = dom.getDomNodePagePosition(event.node.firstChild);
                    const y = data.top + data.height + pickerArrowSize;
                    if (y + maxHeight >= window.innerHeight) {
                        maxHeight = window.innerHeight - y - 30 /* room for shadow and status bar*/;
                    }
                    let x = data.left;
                    if (x + pickerWidth >= maxInnerWidth) {
                        x = maxInnerWidth - pickerWidth;
                    }
                    if (event.payload instanceof StandardMouseEvent) {
                        const maxPickerArrowOffset = pickerWidth - 2 * pickerArrowSize;
                        pickerArrowOffset = event.payload.posx - x;
                        if (pickerArrowOffset > maxPickerArrowOffset) {
                            x = Math.min(maxInnerWidth - pickerWidth, x + pickerArrowOffset - maxPickerArrowOffset);
                            pickerArrowOffset = maxPickerArrowOffset;
                        }
                    }
                    else {
                        pickerArrowOffset = (data.left + (data.width * 0.3)) - x;
                    }
                    picker.show(element, maxHeight, pickerWidth, pickerArrowSize, Math.max(0, pickerArrowOffset));
                    pickerAnchor = { x, y };
                }
                return pickerAnchor;
            },
            onHide: (data) => {
                if (!data?.didPick) {
                    picker.restoreViewState();
                }
                this._breadcrumbsPickerShowing = false;
                this._updateCkBreadcrumbsActive();
                if (data?.source === this) {
                    this._widget.setFocused(undefined);
                    this._widget.setSelection(undefined);
                }
                picker.dispose();
            }
        });
    }
    _updateCkBreadcrumbsActive() {
        const value = this._widget.isDOMFocused() || this._breadcrumbsPickerShowing;
        this._ckBreadcrumbsActive.set(value);
    }
    async _revealInEditor(event, element, group, pinned = false) {
        if (element instanceof FileElement) {
            if (element.kind === FileKind.FILE) {
                await this._editorService.openEditor({ resource: element.uri, options: { pinned } }, group);
            }
            else {
                // show next picker
                const items = this._widget.getItems();
                const idx = items.indexOf(event.item);
                this._widget.setFocused(items[idx + 1]);
                this._widget.setSelection(items[idx + 1], BreadcrumbsControl_1.Payload_Pick);
            }
        }
        else {
            element.outline.reveal(element, { pinned }, group === SIDE_GROUP, false);
        }
    }
    _getEditorGroup(data) {
        if (data === BreadcrumbsControl_1.Payload_RevealAside) {
            return SIDE_GROUP;
        }
        else if (data === BreadcrumbsControl_1.Payload_Reveal) {
            return ACTIVE_GROUP;
        }
        else {
            return undefined;
        }
    }
};
BreadcrumbsControl = BreadcrumbsControl_1 = __decorate([
    __param(3, IContextKeyService),
    __param(4, IContextViewService),
    __param(5, IInstantiationService),
    __param(6, IQuickInputService),
    __param(7, IFileService),
    __param(8, IEditorService),
    __param(9, ILabelService),
    __param(10, IConfigurationService),
    __param(11, IBreadcrumbsService)
], BreadcrumbsControl);
export { BreadcrumbsControl };
let BreadcrumbsControlFactory = class BreadcrumbsControlFactory {
    get control() { return this._control; }
    get onDidEnablementChange() { return this._onDidEnablementChange.event; }
    get onDidVisibilityChange() { return this._onDidVisibilityChange.event; }
    constructor(_container, _editorGroup, _options, configurationService, _instantiationService, fileService) {
        this._container = _container;
        this._editorGroup = _editorGroup;
        this._options = _options;
        this._instantiationService = _instantiationService;
        this._disposables = new DisposableStore();
        this._controlDisposables = new DisposableStore();
        this._onDidEnablementChange = this._disposables.add(new Emitter());
        this._onDidVisibilityChange = this._disposables.add(new Emitter());
        const config = this._disposables.add(BreadcrumbsConfig.IsEnabled.bindTo(configurationService));
        this._disposables.add(config.onDidChange(() => {
            const value = config.getValue();
            if (!value && this._control) {
                this._controlDisposables.clear();
                this._control = undefined;
                this._onDidEnablementChange.fire();
            }
            else if (value && !this._control) {
                this._control = this.createControl();
                this._control.update();
                this._onDidEnablementChange.fire();
            }
        }));
        if (config.getValue()) {
            this._control = this.createControl();
        }
        this._disposables.add(fileService.onDidChangeFileSystemProviderRegistrations(e => {
            if (this._control?.model && this._control.model.resource.scheme !== e.scheme) {
                // ignore if the scheme of the breadcrumbs resource is not affected
                return;
            }
            if (this._control?.update()) {
                this._onDidEnablementChange.fire();
            }
        }));
    }
    createControl() {
        const control = this._controlDisposables.add(this._instantiationService.createInstance(BreadcrumbsControl, this._container, this._options, this._editorGroup));
        this._controlDisposables.add(control.onDidVisibilityChange(() => this._onDidVisibilityChange.fire()));
        return control;
    }
    dispose() {
        this._disposables.dispose();
        this._controlDisposables.dispose();
    }
};
BreadcrumbsControlFactory = __decorate([
    __param(3, IConfigurationService),
    __param(4, IInstantiationService),
    __param(5, IFileService)
], BreadcrumbsControlFactory);
export { BreadcrumbsControlFactory };
//#region commands
// toggle command
registerAction2(class ToggleBreadcrumb extends Action2 {
    constructor() {
        super({
            id: 'breadcrumbs.toggle',
            title: localize2('cmd.toggle', "Toggle Breadcrumbs"),
            category: Categories.View,
            toggled: {
                condition: ContextKeyExpr.equals('config.breadcrumbs.enabled', true),
                title: localize('cmd.toggle2', "Toggle Breadcrumbs"),
                mnemonicTitle: localize({ key: 'miBreadcrumbs2', comment: ['&& denotes a mnemonic'] }, "&&Breadcrumbs")
            },
            menu: [
                { id: MenuId.CommandPalette },
                { id: MenuId.MenubarAppearanceMenu, group: '4_editor', order: 2 },
                { id: MenuId.NotebookToolbar, group: 'notebookLayout', order: 2 },
                { id: MenuId.StickyScrollContext },
                { id: MenuId.NotebookStickyScrollContext, group: 'notebookView', order: 2 },
                { id: MenuId.NotebookToolbarContext, group: 'notebookView', order: 2 }
            ]
        });
    }
    run(accessor) {
        const config = accessor.get(IConfigurationService);
        const breadCrumbsConfig = BreadcrumbsConfig.IsEnabled.bindTo(config);
        const value = breadCrumbsConfig.getValue();
        breadCrumbsConfig.updateValue(!value);
        breadCrumbsConfig.dispose();
    }
});
// focus/focus-and-select
function focusAndSelectHandler(accessor, select) {
    // find widget and focus/select
    const groups = accessor.get(IEditorGroupsService);
    const breadcrumbs = accessor.get(IBreadcrumbsService);
    const widget = breadcrumbs.getWidget(groups.activeGroup.id);
    if (widget) {
        const item = widget.getItems().at(-1);
        widget.setFocused(item);
        if (select) {
            widget.setSelection(item, BreadcrumbsControl.Payload_Pick);
        }
    }
}
registerAction2(class FocusAndSelectBreadcrumbs extends Action2 {
    constructor() {
        super({
            id: 'breadcrumbs.focusAndSelect',
            title: localize2('cmd.focusAndSelect', "Focus and Select Breadcrumbs"),
            precondition: BreadcrumbsControl.CK_BreadcrumbsVisible,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 89 /* KeyCode.Period */,
                when: BreadcrumbsControl.CK_BreadcrumbsPossible,
            },
            f1: true
        });
    }
    run(accessor, ...args) {
        focusAndSelectHandler(accessor, true);
    }
});
registerAction2(class FocusBreadcrumbs extends Action2 {
    constructor() {
        super({
            id: 'breadcrumbs.focus',
            title: localize2('cmd.focus', "Focus Breadcrumbs"),
            precondition: BreadcrumbsControl.CK_BreadcrumbsVisible,
            keybinding: {
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 85 /* KeyCode.Semicolon */,
                when: BreadcrumbsControl.CK_BreadcrumbsPossible,
            },
            f1: true
        });
    }
    run(accessor, ...args) {
        focusAndSelectHandler(accessor, false);
    }
});
// this commands is only enabled when breadcrumbs are
// disabled which it then enables and focuses
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'breadcrumbs.toggleToOn',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 89 /* KeyCode.Period */,
    when: ContextKeyExpr.not('config.breadcrumbs.enabled'),
    handler: async (accessor) => {
        const instant = accessor.get(IInstantiationService);
        const config = accessor.get(IConfigurationService);
        // check if enabled and iff not enable
        const isEnabled = BreadcrumbsConfig.IsEnabled.bindTo(config);
        if (!isEnabled.getValue()) {
            await isEnabled.updateValue(true);
            await timeout(50); // hacky - the widget might not be ready yet...
        }
        isEnabled.dispose();
        return instant.invokeFunction(focusAndSelectHandler, true);
    }
});
// navigation
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'breadcrumbs.focusNext',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    primary: 17 /* KeyCode.RightArrow */,
    secondary: [2048 /* KeyMod.CtrlCmd */ | 17 /* KeyCode.RightArrow */],
    mac: {
        primary: 17 /* KeyCode.RightArrow */,
        secondary: [512 /* KeyMod.Alt */ | 17 /* KeyCode.RightArrow */],
    },
    when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive),
    handler(accessor) {
        const groups = accessor.get(IEditorGroupsService);
        const breadcrumbs = accessor.get(IBreadcrumbsService);
        const widget = breadcrumbs.getWidget(groups.activeGroup.id);
        if (!widget) {
            return;
        }
        widget.focusNext();
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'breadcrumbs.focusPrevious',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    primary: 15 /* KeyCode.LeftArrow */,
    secondary: [2048 /* KeyMod.CtrlCmd */ | 15 /* KeyCode.LeftArrow */],
    mac: {
        primary: 15 /* KeyCode.LeftArrow */,
        secondary: [512 /* KeyMod.Alt */ | 15 /* KeyCode.LeftArrow */],
    },
    when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive),
    handler(accessor) {
        const groups = accessor.get(IEditorGroupsService);
        const breadcrumbs = accessor.get(IBreadcrumbsService);
        const widget = breadcrumbs.getWidget(groups.activeGroup.id);
        if (!widget) {
            return;
        }
        widget.focusPrev();
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'breadcrumbs.focusNextWithPicker',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
    primary: 2048 /* KeyMod.CtrlCmd */ | 17 /* KeyCode.RightArrow */,
    mac: {
        primary: 512 /* KeyMod.Alt */ | 17 /* KeyCode.RightArrow */,
    },
    when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive, WorkbenchListFocusContextKey),
    handler(accessor) {
        const groups = accessor.get(IEditorGroupsService);
        const breadcrumbs = accessor.get(IBreadcrumbsService);
        const widget = breadcrumbs.getWidget(groups.activeGroup.id);
        if (!widget) {
            return;
        }
        widget.focusNext();
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'breadcrumbs.focusPreviousWithPicker',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
    primary: 2048 /* KeyMod.CtrlCmd */ | 15 /* KeyCode.LeftArrow */,
    mac: {
        primary: 512 /* KeyMod.Alt */ | 15 /* KeyCode.LeftArrow */,
    },
    when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive, WorkbenchListFocusContextKey),
    handler(accessor) {
        const groups = accessor.get(IEditorGroupsService);
        const breadcrumbs = accessor.get(IBreadcrumbsService);
        const widget = breadcrumbs.getWidget(groups.activeGroup.id);
        if (!widget) {
            return;
        }
        widget.focusPrev();
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'breadcrumbs.selectFocused',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    primary: 3 /* KeyCode.Enter */,
    secondary: [18 /* KeyCode.DownArrow */],
    when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive),
    handler(accessor) {
        const groups = accessor.get(IEditorGroupsService);
        const breadcrumbs = accessor.get(IBreadcrumbsService);
        const widget = breadcrumbs.getWidget(groups.activeGroup.id);
        if (!widget) {
            return;
        }
        widget.setSelection(widget.getFocused(), BreadcrumbsControl.Payload_Pick);
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'breadcrumbs.revealFocused',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    primary: 10 /* KeyCode.Space */,
    secondary: [2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */],
    when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive),
    handler(accessor) {
        const groups = accessor.get(IEditorGroupsService);
        const breadcrumbs = accessor.get(IBreadcrumbsService);
        const widget = breadcrumbs.getWidget(groups.activeGroup.id);
        if (!widget) {
            return;
        }
        widget.setSelection(widget.getFocused(), BreadcrumbsControl.Payload_Reveal);
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'breadcrumbs.selectEditor',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
    primary: 9 /* KeyCode.Escape */,
    when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive),
    handler(accessor) {
        const groups = accessor.get(IEditorGroupsService);
        const breadcrumbs = accessor.get(IBreadcrumbsService);
        const widget = breadcrumbs.getWidget(groups.activeGroup.id);
        if (!widget) {
            return;
        }
        widget.setFocused(undefined);
        widget.setSelection(undefined);
        groups.activeGroup.activeEditorPane?.focus();
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'breadcrumbs.revealFocusedFromTreeAside',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */,
    when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive, WorkbenchListFocusContextKey),
    handler(accessor) {
        const editors = accessor.get(IEditorService);
        const lists = accessor.get(IListService);
        const tree = lists.lastFocusedList;
        if (!(tree instanceof WorkbenchDataTree) && !(tree instanceof WorkbenchAsyncDataTree)) {
            return;
        }
        const element = tree.getFocus()[0];
        if (URI.isUri(element?.resource)) {
            // IFileStat: open file in editor
            return editors.openEditor({
                resource: element.resource,
                options: { pinned: true }
            }, SIDE_GROUP);
        }
        // IOutline: check if this the outline and iff so reveal element
        const input = tree.getInput();
        if (input && typeof input.outlineKind === 'string') {
            return input.reveal(element, {
                pinned: true,
                preserveFocus: false
            }, true, false);
        }
    }
});
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJlYWRjcnVtYnNDb250cm9sLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9icm93c2VyL3BhcnRzL2VkaXRvci9icmVhZGNydW1ic0NvbnRyb2wudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDNUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQW1ELE1BQU0sOERBQThELENBQUM7QUFDbkssT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRXhFLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRTNELE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxlQUFlLEVBQWUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDekksT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFckQsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLG9FQUFvRSxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFFLFVBQVUsRUFB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