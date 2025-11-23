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
var SideBySideEditor_1;
import './media/sidebysideeditor.css';
import { localize } from '../../../../nls.js';
import { Dimension, $, clearNode } from '../../../../base/browser/dom.js';
import { multibyteAwareBtoa } from '../../../../base/common/strings.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorExtensions, SIDE_BY_SIDE_EDITOR_ID, SideBySideEditor as Side, isEditorPaneWithSelection } from '../../../common/editor.js';
import { SideBySideEditorInput } from '../../../common/editor/sideBySideEditorInput.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { SplitView, Sizing } from '../../../../base/browser/ui/splitview/splitview.js';
import { Event, Relay, Emitter } from '../../../../base/common/event.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { DEFAULT_EDITOR_MIN_DIMENSIONS } from './editor.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { SIDE_BY_SIDE_EDITOR_HORIZONTAL_BORDER, SIDE_BY_SIDE_EDITOR_VERTICAL_BORDER } from '../../../common/theme.js';
import { AbstractEditorWithViewState } from './editorWithViewState.js';
import { ITextResourceConfigurationService } from '../../../../editor/common/services/textResourceConfiguration.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { isEqual } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
function isSideBySideEditorViewState(thing) {
    const candidate = thing;
    return typeof candidate?.primary === 'object' && typeof candidate.secondary === 'object';
}
let SideBySideEditor = class SideBySideEditor extends AbstractEditorWithViewState {
    static { SideBySideEditor_1 = this; }
    static { this.ID = SIDE_BY_SIDE_EDITOR_ID; }
    static { this.SIDE_BY_SIDE_LAYOUT_SETTING = 'workbench.editor.splitInGroupLayout'; }
    static { this.VIEW_STATE_PREFERENCE_KEY = 'sideBySideEditorViewState'; }
    //#region Layout Constraints
    get minimumPrimaryWidth() { return this.primaryEditorPane ? this.primaryEditorPane.minimumWidth : 0; }
    get maximumPrimaryWidth() { return this.primaryEditorPane ? this.primaryEditorPane.maximumWidth : Number.POSITIVE_INFINITY; }
    get minimumPrimaryHeight() { return this.primaryEditorPane ? this.primaryEditorPane.minimumHeight : 0; }
    get maximumPrimaryHeight() { return this.primaryEditorPane ? this.primaryEditorPane.maximumHeight : Number.POSITIVE_INFINITY; }
    get minimumSecondaryWidth() { return this.secondaryEditorPane ? this.secondaryEditorPane.minimumWidth : 0; }
    get maximumSecondaryWidth() { return this.secondaryEditorPane ? this.secondaryEditorPane.maximumWidth : Number.POSITIVE_INFINITY; }
    get minimumSecondaryHeight() { return this.secondaryEditorPane ? this.secondaryEditorPane.minimumHeight : 0; }
    get maximumSecondaryHeight() { return this.secondaryEditorPane ? this.secondaryEditorPane.maximumHeight : Number.POSITIVE_INFINITY; }
    set minimumWidth(value) { }
    set maximumWidth(value) { }
    set minimumHeight(value) { }
    set maximumHeight(value) { }
    get minimumWidth() { return this.minimumPrimaryWidth + this.minimumSecondaryWidth; }
    get maximumWidth() { return this.maximumPrimaryWidth + this.maximumSecondaryWidth; }
    get minimumHeight() { return this.minimumPrimaryHeight + this.minimumSecondaryHeight; }
    get maximumHeight() { return this.maximumPrimaryHeight + this.maximumSecondaryHeight; }
    constructor(group, telemetryService, instantiationService, themeService, storageService, configurationService, textResourceConfigurationService, editorService, editorGroupService) {
        super(SideBySideEditor_1.ID, group, SideBySideEditor_1.VIEW_STATE_PREFERENCE_KEY, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorService, editorGroupService);
        this.configurationService = configurationService;
        //#endregion
        //#region Events
        this.onDidCreateEditors = this._register(new Emitter());
        this._onDidChangeSizeConstraints = this._register(new Relay());
        this.onDidChangeSizeConstraints = Event.any(this.onDidCreateEditors.event, this._onDidChangeSizeConstraints.event);
        this._onDidChangeSelection = this._register(new Emitter());
        this.onDidChangeSelection = this._onDidChangeSelection.event;
        //#endregion
        this.primaryEditorPane = undefined;
        this.secondaryEditorPane = undefined;
        this.splitviewDisposables = this._register(new DisposableStore());
        this.editorDisposables = this._register(new DisposableStore());
        this.dimension = new Dimension(0, 0);
        this.lastFocusedSide = undefined;
        this.orientation = this.configurationService.getValue(SideBySideEditor_1.SIDE_BY_SIDE_LAYOUT_SETTING) === 'vertical' ? 0 /* Orientation.VERTICAL */ : 1 /* Orientation.HORIZONTAL */;
        this.registerListeners();
    }
    registerListeners() {
        this._register(this.configurationService.onDidChangeConfiguration(e => this.onConfigurationUpdated(e)));
    }
    onConfigurationUpdated(event) {
        if (event.affectsConfiguration(SideBySideEditor_1.SIDE_BY_SIDE_LAYOUT_SETTING)) {
            this.orientation = this.configurationService.getValue(SideBySideEditor_1.SIDE_BY_SIDE_LAYOUT_SETTING) === 'vertical' ? 0 /* Orientation.VERTICAL */ : 1 /* Orientation.HORIZONTAL */;
            // If config updated from event, re-create the split
            // editor using the new layout orientation if it was
            // already created.
            if (this.splitview) {
                this.recreateSplitview();
            }
        }
    }
    recreateSplitview() {
        const container = assertReturnsDefined(this.getContainer());
        // Clear old (if any) but remember ratio
        const ratio = this.getSplitViewRatio();
        if (this.splitview) {
            this.splitview.el.remove();
            this.splitviewDisposables.clear();
        }
        // Create new
        this.createSplitView(container, ratio);
        this.layout(this.dimension);
    }
    getSplitViewRatio() {
        let ratio = undefined;
        if (this.splitview) {
            const leftViewSize = this.splitview.getViewSize(0);
            const rightViewSize = this.splitview.getViewSize(1);
            // Only return a ratio when the view size is significantly
            // enough different for left and right view sizes
            if (Math.abs(leftViewSize - rightViewSize) > 1) {
                const totalSize = this.splitview.orientation === 1 /* Orientation.HORIZONTAL */ ? this.dimension.width : this.dimension.height;
                ratio = leftViewSize / totalSize;
            }
        }
        return ratio;
    }
    createEditor(parent) {
        parent.classList.add('side-by-side-editor');
        // Editor pane containers
        this.secondaryEditorContainer = $('.side-by-side-editor-container.editor-instance');
        this.primaryEditorContainer = $('.side-by-side-editor-container.editor-instance');
        // Split view
        this.createSplitView(parent);
    }
    createSplitView(parent, ratio) {
        // Splitview widget
        this.splitview = this.splitviewDisposables.add(new SplitView(parent, { orientation: this.orientation }));
        this.splitviewDisposables.add(this.splitview.onDidSashReset(() => this.splitview?.distributeViewSizes()));
        if (this.orientation === 1 /* Orientation.HORIZONTAL */) {
            this.splitview.orthogonalEndSash = this._boundarySashes?.bottom;
        }
        else {
            this.splitview.orthogonalStartSash = this._boundarySashes?.left;
            this.splitview.orthogonalEndSash = this._boundarySashes?.right;
        }
        // Figure out sizing
        let leftSizing = Sizing.Distribute;
        let rightSizing = Sizing.Distribute;
        if (ratio) {
            const totalSize = this.splitview.orientation === 1 /* Orientation.HORIZONTAL */ ? this.dimension.width : this.dimension.height;
            leftSizing = Math.round(totalSize * ratio);
            rightSizing = totalSize - leftSizing;
            // We need to call `layout` for the `ratio` to have any effect
            this.splitview.layout(this.orientation === 1 /* Orientation.HORIZONTAL */ ? this.dimension.width : this.dimension.height);
        }
        // Secondary (left)
        const secondaryEditorContainer = assertReturnsDefined(this.secondaryEditorContainer);
        this.splitview.addView({
            element: secondaryEditorContainer,
            layout: size => this.layoutPane(this.secondaryEditorPane, size),
            minimumSize: this.orientation === 1 /* Orientation.HORIZONTAL */ ? DEFAULT_EDITOR_MIN_DIMENSIONS.width : DEFAULT_EDITOR_MIN_DIMENSIONS.height,
            maximumSize: Number.POSITIVE_INFINITY,
            onDidChange: Event.None
        }, leftSizing);
        // Primary (right)
        const primaryEditorContainer = assertReturnsDefined(this.primaryEditorContainer);
        this.splitview.addView({
            element: primaryEditorContainer,
            layout: size => this.layoutPane(this.primaryEditorPane, size),
            minimumSize: this.orientation === 1 /* Orientation.HORIZONTAL */ ? DEFAULT_EDITOR_MIN_DIMENSIONS.width : DEFAULT_EDITOR_MIN_DIMENSIONS.height,
            maximumSize: Number.POSITIVE_INFINITY,
            onDidChange: Event.None
        }, rightSizing);
        this.updateStyles();
    }
    getTitle() {
        if (this.input) {
            return this.input.getName();
        }
        return localize('sideBySideEditor', "Side by Side Editor");
    }
    async setInput(input, options, context, token) {
        const oldInput = this.input;
        await super.setInput(input, options, context, token);
        // Create new side by side editors if either we have not
        // been created before or the input no longer matches.
        if (!oldInput || !input.matches(oldInput)) {
            if (oldInput) {
                this.disposeEditors();
            }
            this.createEditors(input);
        }
        // Restore any previous view state
        const { primary, secondary, viewState } = this.loadViewState(input, options, context);
        this.lastFocusedSide = viewState?.focus;
        if (typeof viewState?.ratio === 'number' && this.splitview) {
            const totalSize = this.splitview.orientation === 1 /* Orientation.HORIZONTAL */ ? this.dimension.width : this.dimension.height;
            this.splitview.resizeView(0, Math.round(totalSize * viewState.ratio));
        }
        else {
            this.splitview?.distributeViewSizes();
        }
        // Set input to both sides
        await Promise.all([
            this.secondaryEditorPane?.setInput(input.secondary, secondary, context, token),
            this.primaryEditorPane?.setInput(input.primary, primary, context, token)
        ]);
        // Update focus if target is provided
        if (typeof options?.target === 'number') {
            this.lastFocusedSide = options.target;
        }
    }
    loadViewState(input, options, context) {
        const viewState = isSideBySideEditorViewState(options?.viewState) ? options?.viewState : this.loadEditorViewState(input, context);
        let primaryOptions = Object.create(null);
        let secondaryOptions = undefined;
        // Depending on the optional `target` property, we apply
        // the provided options to either the primary or secondary
        // side
        if (options?.target === Side.SECONDARY) {
            secondaryOptions = { ...options };
        }
        else {
            primaryOptions = { ...options };
        }
        primaryOptions.viewState = viewState?.primary;
        if (viewState?.secondary) {
            if (!secondaryOptions) {
                secondaryOptions = { viewState: viewState.secondary };
            }
            else {
                secondaryOptions.viewState = viewState?.secondary;
            }
        }
        return { primary: primaryOptions, secondary: secondaryOptions, viewState };
    }
    createEditors(newInput) {
        // Create editors
        this.secondaryEditorPane = this.doCreateEditor(newInput.secondary, assertReturnsDefined(this.secondaryEditorContainer));
        this.primaryEditorPane = this.doCreateEditor(newInput.primary, assertReturnsDefined(this.primaryEditorContainer));
        // Layout
        this.layout(this.dimension);
        // Eventing
        this._onDidChangeSizeConstraints.input = Event.any(Event.map(this.secondaryEditorPane.onDidChangeSizeConstraints, () => undefined), Event.map(this.primaryEditorPane.onDidChangeSizeConstraints, () => undefined));
        this.onDidCreateEditors.fire(undefined);
        // Track focus and signal active control change via event
        this.editorDisposables.add(this.primaryEditorPane.onDidFocus(() => this.onDidFocusChange(Side.PRIMARY)));
        this.editorDisposables.add(this.secondaryEditorPane.onDidFocus(() => this.onDidFocusChange(Side.SECONDARY)));
    }
    doCreateEditor(editorInput, container) {
        const editorPaneDescriptor = Registry.as(EditorExtensions.EditorPane).getEditorPane(editorInput);
        if (!editorPaneDescriptor) {
            throw new Error('No editor pane descriptor for editor found');
        }
        // Create editor pane and make visible
        const editorPane = editorPaneDescriptor.instantiate(this.instantiationService, this.group);
        editorPane.create(container);
        editorPane.setVisible(this.isVisible());
        // Track selections if supported
        if (isEditorPaneWithSelection(editorPane)) {
            this.editorDisposables.add(editorPane.onDidChangeSelection(e => this._onDidChangeSelection.fire(e)));
        }
        // Track for disposal
        this.editorDisposables.add(editorPane);
        return editorPane;
    }
    onDidFocusChange(side) {
        this.lastFocusedSide = side;
        // Signal to outside that our active control changed
        this._onDidChangeControl.fire();
    }
    getSelection() {
        const lastFocusedEditorPane = this.getLastFocusedEditorPane();
        if (isEditorPaneWithSelection(lastFocusedEditorPane)) {
            const selection = lastFocusedEditorPane.getSelection();
            if (selection) {
                return new SideBySideAwareEditorPaneSelection(selection, lastFocusedEditorPane === this.primaryEditorPane ? Side.PRIMARY : Side.SECONDARY);
            }
        }
        return undefined;
    }
    setOptions(options) {
        super.setOptions(options);
        // Update focus if target is provided
        if (typeof options?.target === 'number') {
            this.lastFocusedSide = options.target;
        }
        // Apply to focused side
        this.getLastFocusedEditorPane()?.setOptions(options);
    }
    setEditorVisible(visible) {
        // Forward to both sides
        this.primaryEditorPane?.setVisible(visible);
        this.secondaryEditorPane?.setVisible(visible);
        super.setEditorVisible(visible);
    }
    clearInput() {
        super.clearInput();
        // Forward to both sides
        this.primaryEditorPane?.clearInput();
        this.secondaryEditorPane?.clearInput();
        // Since we do not keep side editors alive
        // we dispose any editor created for recreation
        this.disposeEditors();
    }
    focus() {
        super.focus();
        this.getLastFocusedEditorPane()?.focus();
    }
    getLastFocusedEditorPane() {
        if (this.lastFocusedSide === Side.SECONDARY) {
            return this.secondaryEditorPane;
        }
        return this.primaryEditorPane;
    }
    layout(dimension) {
        this.dimension = dimension;
        const splitview = assertReturnsDefined(this.splitview);
        splitview.layout(this.orientation === 1 /* Orientation.HORIZONTAL */ ? dimension.width : dimension.height);
    }
    setBoundarySashes(sashes) {
        this._boundarySashes = sashes;
        if (this.splitview) {
            this.splitview.orthogonalEndSash = sashes.bottom;
        }
    }
    layoutPane(pane, size) {
        pane?.layout(this.orientation === 1 /* Orientation.HORIZONTAL */ ? new Dimension(size, this.dimension.height) : new Dimension(this.dimension.width, size));
    }
    getControl() {
        return this.getLastFocusedEditorPane()?.getControl();
    }
    getPrimaryEditorPane() {
        return this.primaryEditorPane;
    }
    getSecondaryEditorPane() {
        return this.secondaryEditorPane;
    }
    tracksEditorViewState(input) {
        return input instanceof SideBySideEditorInput;
    }
    computeEditorViewState(resource) {
        if (!this.input || !isEqual(resource, this.toEditorViewStateResource(this.input))) {
            return; // unexpected state
        }
        const primarViewState = this.primaryEditorPane?.getViewState();
        const secondaryViewState = this.secondaryEditorPane?.getViewState();
        if (!primarViewState || !secondaryViewState) {
            return; // we actually need view states
        }
        return {
            primary: primarViewState,
            secondary: secondaryViewState,
            focus: this.lastFocusedSide,
            ratio: this.getSplitViewRatio()
        };
    }
    toEditorViewStateResource(input) {
        let primary;
        let secondary;
        if (input instanceof SideBySideEditorInput) {
            primary = input.primary.resource;
            secondary = input.secondary.resource;
        }
        if (!secondary || !primary) {
            return undefined;
        }
        // create a URI that is the Base64 concatenation of original + modified resource
        return URI.from({ scheme: 'sideBySide', path: `${multibyteAwareBtoa(secondary.toString())}${multibyteAwareBtoa(primary.toString())}` });
    }
    updateStyles() {
        super.updateStyles();
        if (this.primaryEditorContainer) {
            if (this.orientation === 1 /* Orientation.HORIZONTAL */) {
                this.primaryEditorContainer.style.borderLeftWidth = '1px';
                this.primaryEditorContainer.style.borderLeftStyle = 'solid';
                this.primaryEditorContainer.style.borderLeftColor = this.getColor(SIDE_BY_SIDE_EDITOR_VERTICAL_BORDER) ?? '';
                this.primaryEditorContainer.style.borderTopWidth = '0';
            }
            else {
                this.primaryEditorContainer.style.borderTopWidth = '1px';
                this.primaryEditorContainer.style.borderTopStyle = 'solid';
                this.primaryEditorContainer.style.borderTopColor = this.getColor(SIDE_BY_SIDE_EDITOR_HORIZONTAL_BORDER) ?? '';
                this.primaryEditorContainer.style.borderLeftWidth = '0';
            }
        }
    }
    dispose() {
        this.disposeEditors();
        super.dispose();
    }
    disposeEditors() {
        this.editorDisposables.clear();
        this.secondaryEditorPane = undefined;
        this.primaryEditorPane = undefined;
        this.lastFocusedSide = undefined;
        if (this.secondaryEditorContainer) {
            clearNode(this.secondaryEditorContainer);
        }
        if (this.primaryEditorContainer) {
            clearNode(this.primaryEditorContainer);
        }
    }
};
SideBySideEditor = SideBySideEditor_1 = __decorate([
    __param(1, ITelemetryService),
    __param(2, IInstantiationService),
    __param(3, IThemeService),
    __param(4, IStorageService),
    __param(5, IConfigurationService),
    __param(6, ITextResourceConfigurationService),
    __param(7, IEditorService),
    __param(8, IEditorGroupsService)
], SideBySideEditor);
export { SideBySideEditor };
class SideBySideAwareEditorPaneSelection {
    constructor(selection, side) {
        this.selection = selection;
        this.side = side;
    }
    compare(other) {
        if (!(other instanceof SideBySideAwareEditorPaneSelection)) {
            return 3 /* EditorPaneSelectionCompareResult.DIFFERENT */;
        }
        if (this.side !== other.side) {
            return 3 /* EditorPaneSelectionCompareResult.DIFFERENT */;
        }
        return this.selection.compare(other.selection);
    }
    restore(options) {
        const sideBySideEditorOptions = {
            ...options,
            target: this.side
        };
        return this.selection.restore(sideBySideEditorOptions);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2lkZUJ5U2lkZUVkaXRvci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3Ivc2lkZUJ5U2lkZUVkaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyw4QkFBOEIsQ0FBQztBQUN0QyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDMUUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDeEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzVFLE9BQU8sRUFBbUQsZ0JBQWdCLEVBQUUsc0JBQXNCLEVBQUUsZ0JBQWdCLElBQUksSUFBSSxFQUFtRix5QkFBeUIsRUFBb0MsTUFBTSwyQkFBMkIsQ0FBQztBQUM5UyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUd4RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN2RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFHbEYsT0FBTyxFQUFnQixvQkFBb0IsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzVHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFlLE1BQU0sb0RBQW9ELENBQUM7QUFDcEcsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FB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