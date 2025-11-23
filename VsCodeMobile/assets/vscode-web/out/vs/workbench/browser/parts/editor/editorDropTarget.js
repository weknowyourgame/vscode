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
var DropOverlay_1;
import './media/editordroptarget.css';
import { DataTransfers } from '../../../../base/browser/dnd.js';
import { $, addDisposableListener, DragAndDropObserver, EventHelper, EventType, getWindow, isAncestor } from '../../../../base/browser/dom.js';
import { renderFormattedText } from '../../../../base/browser/formattedTextRenderer.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { isMacintosh, isWeb } from '../../../../base/common/platform.js';
import { assertReturnsAllDefined, assertReturnsDefined } from '../../../../base/common/types.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { activeContrastBorder } from '../../../../platform/theme/common/colorRegistry.js';
import { IThemeService, Themable } from '../../../../platform/theme/common/themeService.js';
import { isTemporaryWorkspace, IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { CodeDataTransfers, containsDragType, Extensions as DragAndDropExtensions, LocalSelectionTransfer } from '../../../../platform/dnd/browser/dnd.js';
import { DraggedEditorGroupIdentifier, DraggedEditorIdentifier, extractTreeDropData, ResourcesDropHandler } from '../../dnd.js';
import { prepareMoveCopyEditors } from './editor.js';
import { EDITOR_DRAG_AND_DROP_BACKGROUND, EDITOR_DROP_INTO_PROMPT_BACKGROUND, EDITOR_DROP_INTO_PROMPT_BORDER, EDITOR_DROP_INTO_PROMPT_FOREGROUND } from '../../../common/theme.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ITreeViewsDnDService } from '../../../../editor/common/services/treeViewsDndService.js';
import { DraggedTreeItemsIdentifier } from '../../../../editor/common/services/treeViewsDnd.js';
function isDropIntoEditorEnabledGlobally(configurationService) {
    return configurationService.getValue('editor.dropIntoEditor.enabled');
}
function isDragIntoEditorEvent(e) {
    return e.shiftKey;
}
let DropOverlay = class DropOverlay extends Themable {
    static { DropOverlay_1 = this; }
    static { this.OVERLAY_ID = 'monaco-workbench-editor-drop-overlay'; }
    get disposed() { return !!this._disposed; }
    constructor(groupView, themeService, configurationService, instantiationService, editorService, editorGroupService, treeViewsDragAndDropService, contextService) {
        super(themeService);
        this.groupView = groupView;
        this.configurationService = configurationService;
        this.instantiationService = instantiationService;
        this.editorService = editorService;
        this.editorGroupService = editorGroupService;
        this.treeViewsDragAndDropService = treeViewsDragAndDropService;
        this.contextService = contextService;
        this.editorTransfer = LocalSelectionTransfer.getInstance();
        this.groupTransfer = LocalSelectionTransfer.getInstance();
        this.treeItemsTransfer = LocalSelectionTransfer.getInstance();
        this.cleanupOverlayScheduler = this._register(new RunOnceScheduler(() => this.dispose(), 300));
        this.enableDropIntoEditor = isDropIntoEditorEnabledGlobally(this.configurationService) && this.isDropIntoActiveEditorEnabled();
        this.create();
    }
    create() {
        const overlayOffsetHeight = this.getOverlayOffsetHeight();
        // Container
        const container = this.container = $('div', { id: DropOverlay_1.OVERLAY_ID });
        container.style.top = `${overlayOffsetHeight}px`;
        // Parent
        this.groupView.element.appendChild(container);
        this.groupView.element.classList.add('dragged-over');
        this._register(toDisposable(() => {
            container.remove();
            this.groupView.element.classList.remove('dragged-over');
        }));
        // Overlay
        this.overlay = $('.editor-group-overlay-indicator');
        container.appendChild(this.overlay);
        if (this.enableDropIntoEditor) {
            this.dropIntoPromptElement = renderFormattedText(localize('dropIntoEditorPrompt', "Hold __{0}__ to drop into editor", isMacintosh ? '⇧' : 'Shift'), {});
            this.dropIntoPromptElement.classList.add('editor-group-overlay-drop-into-prompt');
            this.overlay.appendChild(this.dropIntoPromptElement);
        }
        // Overlay Event Handling
        this.registerListeners(container);
        // Styles
        this.updateStyles();
    }
    updateStyles() {
        const overlay = assertReturnsDefined(this.overlay);
        // Overlay drop background
        overlay.style.backgroundColor = this.getColor(EDITOR_DRAG_AND_DROP_BACKGROUND) || '';
        // Overlay contrast border (if any)
        const activeContrastBorderColor = this.getColor(activeContrastBorder);
        overlay.style.outlineColor = activeContrastBorderColor || '';
        overlay.style.outlineOffset = activeContrastBorderColor ? '-2px' : '';
        overlay.style.outlineStyle = activeContrastBorderColor ? 'dashed' : '';
        overlay.style.outlineWidth = activeContrastBorderColor ? '2px' : '';
        if (this.dropIntoPromptElement) {
            this.dropIntoPromptElement.style.backgroundColor = this.getColor(EDITOR_DROP_INTO_PROMPT_BACKGROUND) ?? '';
            this.dropIntoPromptElement.style.color = this.getColor(EDITOR_DROP_INTO_PROMPT_FOREGROUND) ?? '';
            const borderColor = this.getColor(EDITOR_DROP_INTO_PROMPT_BORDER);
            if (borderColor) {
                this.dropIntoPromptElement.style.borderWidth = '1px';
                this.dropIntoPromptElement.style.borderStyle = 'solid';
                this.dropIntoPromptElement.style.borderColor = borderColor;
            }
            else {
                this.dropIntoPromptElement.style.borderWidth = '0';
            }
        }
    }
    registerListeners(container) {
        this._register(new DragAndDropObserver(container, {
            onDragOver: e => {
                if (this.enableDropIntoEditor && isDragIntoEditorEvent(e)) {
                    this.dispose();
                    return;
                }
                const isDraggingGroup = this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype);
                const isDraggingEditor = this.editorTransfer.hasData(DraggedEditorIdentifier.prototype);
                // Update the dropEffect to "copy" if there is no local data to be dragged because
                // in that case we can only copy the data into and not move it from its source
                if (!isDraggingEditor && !isDraggingGroup && e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'copy';
                }
                // Find out if operation is valid
                let isCopy = true;
                if (isDraggingGroup) {
                    isCopy = this.isCopyOperation(e);
                }
                else if (isDraggingEditor) {
                    const data = this.editorTransfer.getData(DraggedEditorIdentifier.prototype);
                    if (Array.isArray(data) && data.length > 0) {
                        isCopy = this.isCopyOperation(e, data[0].identifier);
                    }
                }
                if (!isCopy) {
                    const sourceGroupView = this.findSourceGroupView();
                    if (sourceGroupView === this.groupView) {
                        if (isDraggingGroup || (isDraggingEditor && sourceGroupView.count < 2)) {
                            this.hideOverlay();
                            return; // do not allow to drop group/editor on itself if this results in an empty group
                        }
                    }
                }
                // Position overlay and conditionally enable or disable
                // editor group splitting support based on setting and
                // keymodifiers used.
                let splitOnDragAndDrop = !!this.editorGroupService.partOptions.splitOnDragAndDrop;
                if (this.isToggleSplitOperation(e)) {
                    splitOnDragAndDrop = !splitOnDragAndDrop;
                }
                this.positionOverlay(e.offsetX, e.offsetY, isDraggingGroup, splitOnDragAndDrop);
                // Make sure to stop any running cleanup scheduler to remove the overlay
                if (this.cleanupOverlayScheduler.isScheduled()) {
                    this.cleanupOverlayScheduler.cancel();
                }
            },
            onDragLeave: e => this.dispose(),
            onDragEnd: e => this.dispose(),
            onDrop: e => {
                EventHelper.stop(e, true);
                // Dispose overlay
                this.dispose();
                // Handle drop if we have a valid operation
                if (this.currentDropOperation) {
                    this.handleDrop(e, this.currentDropOperation.splitDirection);
                }
            }
        }));
        this._register(addDisposableListener(container, EventType.MOUSE_OVER, () => {
            // Under some circumstances we have seen reports where the drop overlay is not being
            // cleaned up and as such the editor area remains under the overlay so that you cannot
            // type into the editor anymore. This seems related to using VMs and DND via host and
            // guest OS, though some users also saw it without VMs.
            // To protect against this issue we always destroy the overlay as soon as we detect a
            // mouse event over it. The delay is used to guarantee we are not interfering with the
            // actual DROP event that can also trigger a mouse over event.
            if (!this.cleanupOverlayScheduler.isScheduled()) {
                this.cleanupOverlayScheduler.schedule();
            }
        }));
    }
    isDropIntoActiveEditorEnabled() {
        return !!this.groupView.activeEditor?.hasCapability(128 /* EditorInputCapabilities.CanDropIntoEditor */);
    }
    findSourceGroupView() {
        // Check for group transfer
        if (this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype)) {
            const data = this.groupTransfer.getData(DraggedEditorGroupIdentifier.prototype);
            if (Array.isArray(data) && data.length > 0) {
                return this.editorGroupService.getGroup(data[0].identifier);
            }
        }
        // Check for editor transfer
        else if (this.editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
            const data = this.editorTransfer.getData(DraggedEditorIdentifier.prototype);
            if (Array.isArray(data) && data.length > 0) {
                return this.editorGroupService.getGroup(data[0].identifier.groupId);
            }
        }
        return undefined;
    }
    async handleDrop(event, splitDirection) {
        // Determine target group
        const ensureTargetGroup = () => {
            let targetGroup;
            if (typeof splitDirection === 'number') {
                targetGroup = this.editorGroupService.addGroup(this.groupView, splitDirection);
            }
            else {
                targetGroup = this.groupView;
            }
            return targetGroup;
        };
        // Check for group transfer
        if (this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype)) {
            const data = this.groupTransfer.getData(DraggedEditorGroupIdentifier.prototype);
            if (Array.isArray(data) && data.length > 0) {
                const sourceGroup = this.editorGroupService.getGroup(data[0].identifier);
                if (sourceGroup) {
                    if (typeof splitDirection !== 'number' && sourceGroup === this.groupView) {
                        return;
                    }
                    // Split to new group
                    let targetGroup;
                    if (typeof splitDirection === 'number') {
                        if (this.isCopyOperation(event)) {
                            targetGroup = this.editorGroupService.copyGroup(sourceGroup, this.groupView, splitDirection);
                        }
                        else {
                            targetGroup = this.editorGroupService.moveGroup(sourceGroup, this.groupView, splitDirection);
                        }
                    }
                    // Merge into existing group
                    else {
                        let mergeGroupOptions = undefined;
                        if (this.isCopyOperation(event)) {
                            mergeGroupOptions = { mode: 0 /* MergeGroupMode.COPY_EDITORS */ };
                        }
                        this.editorGroupService.mergeGroup(sourceGroup, this.groupView, mergeGroupOptions);
                    }
                    if (targetGroup) {
                        this.editorGroupService.activateGroup(targetGroup);
                    }
                }
                this.groupTransfer.clearData(DraggedEditorGroupIdentifier.prototype);
            }
        }
        // Check for editor transfer
        else if (this.editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
            const data = this.editorTransfer.getData(DraggedEditorIdentifier.prototype);
            if (Array.isArray(data) && data.length > 0) {
                const draggedEditors = data;
                const firstDraggedEditor = data[0].identifier;
                const sourceGroup = this.editorGroupService.getGroup(firstDraggedEditor.groupId);
                if (sourceGroup) {
                    const copyEditor = this.isCopyOperation(event, firstDraggedEditor);
                    let targetGroup = undefined;
                    // Optimization: if we move the last editor of an editor group
                    // and we are configured to close empty editor groups, we can
                    // rather move the entire editor group according to the direction
                    if (this.editorGroupService.partOptions.closeEmptyGroups && sourceGroup.count === 1 && typeof splitDirection === 'number' && !copyEditor) {
                        targetGroup = this.editorGroupService.moveGroup(sourceGroup, this.groupView, splitDirection);
                    }
                    // In any other case do a normal move/copy operation
                    else {
                        targetGroup = ensureTargetGroup();
                        if (sourceGroup === targetGroup) {
                            return;
                        }
                        const editorsWithOptions = prepareMoveCopyEditors(this.groupView, draggedEditors.map(editor => editor.identifier.editor));
                        if (!copyEditor) {
                            sourceGroup.moveEditors(editorsWithOptions, targetGroup);
                        }
                        else {
                            sourceGroup.copyEditors(editorsWithOptions, targetGroup);
                        }
                    }
                    // Ensure target has focus
                    targetGroup.focus();
                }
                this.editorTransfer.clearData(DraggedEditorIdentifier.prototype);
            }
        }
        // Check for tree items
        else if (this.treeItemsTransfer.hasData(DraggedTreeItemsIdentifier.prototype)) {
            const data = this.treeItemsTransfer.getData(DraggedTreeItemsIdentifier.prototype);
            if (Array.isArray(data) && data.length > 0) {
                const editors = [];
                for (const id of data) {
                    const dataTransferItem = await this.treeViewsDragAndDropService.removeDragOperationTransfer(id.identifier);
                    if (dataTransferItem) {
                        const treeDropData = await extractTreeDropData(dataTransferItem);
                        editors.push(...treeDropData.map(editor => ({ ...editor, options: { ...editor.options, pinned: true } })));
                    }
                }
                if (editors.length) {
                    this.editorService.openEditors(editors, ensureTargetGroup(), { validateTrust: true });
                }
            }
            this.treeItemsTransfer.clearData(DraggedTreeItemsIdentifier.prototype);
        }
        // Check for URI transfer
        else {
            const dropHandler = this.instantiationService.createInstance(ResourcesDropHandler, { allowWorkspaceOpen: !isWeb || isTemporaryWorkspace(this.contextService.getWorkspace()) });
            dropHandler.handleDrop(event, getWindow(this.groupView.element), () => ensureTargetGroup(), targetGroup => targetGroup?.focus());
        }
    }
    isCopyOperation(e, draggedEditor) {
        if (draggedEditor?.editor.hasCapability(8 /* EditorInputCapabilities.Singleton */)) {
            return false; // Singleton editors cannot be split
        }
        return (e.ctrlKey && !isMacintosh) || (e.altKey && isMacintosh);
    }
    isToggleSplitOperation(e) {
        return (e.altKey && !isMacintosh) || (e.shiftKey && isMacintosh);
    }
    positionOverlay(mousePosX, mousePosY, isDraggingGroup, enableSplitting) {
        const preferSplitVertically = this.editorGroupService.partOptions.openSideBySideDirection === 'right';
        const editorControlWidth = this.groupView.element.clientWidth;
        const editorControlHeight = this.groupView.element.clientHeight - this.getOverlayOffsetHeight();
        let edgeWidthThresholdFactor;
        let edgeHeightThresholdFactor;
        if (enableSplitting) {
            if (isDraggingGroup) {
                edgeWidthThresholdFactor = preferSplitVertically ? 0.3 : 0.1; // give larger threshold when dragging group depending on preferred split direction
            }
            else {
                edgeWidthThresholdFactor = 0.1; // 10% threshold to split if dragging editors
            }
            if (isDraggingGroup) {
                edgeHeightThresholdFactor = preferSplitVertically ? 0.1 : 0.3; // give larger threshold when dragging group depending on preferred split direction
            }
            else {
                edgeHeightThresholdFactor = 0.1; // 10% threshold to split if dragging editors
            }
        }
        else {
            edgeWidthThresholdFactor = 0;
            edgeHeightThresholdFactor = 0;
        }
        const edgeWidthThreshold = editorControlWidth * edgeWidthThresholdFactor;
        const edgeHeightThreshold = editorControlHeight * edgeHeightThresholdFactor;
        const splitWidthThreshold = editorControlWidth / 3; // offer to split left/right at 33%
        const splitHeightThreshold = editorControlHeight / 3; // offer to split up/down at 33%
        // No split if mouse is above certain threshold in the center of the view
        let splitDirection;
        if (mousePosX > edgeWidthThreshold && mousePosX < editorControlWidth - edgeWidthThreshold &&
            mousePosY > edgeHeightThreshold && mousePosY < editorControlHeight - edgeHeightThreshold) {
            splitDirection = undefined;
        }
        // Offer to split otherwise
        else {
            // User prefers to split vertically: offer a larger hitzone
            // for this direction like so:
            // ----------------------------------------------
            // |		|		SPLIT UP		|			|
            // | SPLIT 	|-----------------------|	SPLIT	|
            // |		|		  MERGE			|			|
            // | LEFT	|-----------------------|	RIGHT	|
            // |		|		SPLIT DOWN		|			|
            // ----------------------------------------------
            if (preferSplitVertically) {
                if (mousePosX < splitWidthThreshold) {
                    splitDirection = 2 /* GroupDirection.LEFT */;
                }
                else if (mousePosX > splitWidthThreshold * 2) {
                    splitDirection = 3 /* GroupDirection.RIGHT */;
                }
                else if (mousePosY < editorControlHeight / 2) {
                    splitDirection = 0 /* GroupDirection.UP */;
                }
                else {
                    splitDirection = 1 /* GroupDirection.DOWN */;
                }
            }
            // User prefers to split horizontally: offer a larger hitzone
            // for this direction like so:
            // ----------------------------------------------
            // |				SPLIT UP					|
            // |--------------------------------------------|
            // |  SPLIT LEFT  |	   MERGE	|  SPLIT RIGHT  |
            // |--------------------------------------------|
            // |				SPLIT DOWN					|
            // ----------------------------------------------
            else {
                if (mousePosY < splitHeightThreshold) {
                    splitDirection = 0 /* GroupDirection.UP */;
                }
                else if (mousePosY > splitHeightThreshold * 2) {
                    splitDirection = 1 /* GroupDirection.DOWN */;
                }
                else if (mousePosX < editorControlWidth / 2) {
                    splitDirection = 2 /* GroupDirection.LEFT */;
                }
                else {
                    splitDirection = 3 /* GroupDirection.RIGHT */;
                }
            }
        }
        // Draw overlay based on split direction
        switch (splitDirection) {
            case 0 /* GroupDirection.UP */:
                this.doPositionOverlay({ top: '0', left: '0', width: '100%', height: '50%' });
                this.toggleDropIntoPrompt(false);
                break;
            case 1 /* GroupDirection.DOWN */:
                this.doPositionOverlay({ top: '50%', left: '0', width: '100%', height: '50%' });
                this.toggleDropIntoPrompt(false);
                break;
            case 2 /* GroupDirection.LEFT */:
                this.doPositionOverlay({ top: '0', left: '0', width: '50%', height: '100%' });
                this.toggleDropIntoPrompt(false);
                break;
            case 3 /* GroupDirection.RIGHT */:
                this.doPositionOverlay({ top: '0', left: '50%', width: '50%', height: '100%' });
                this.toggleDropIntoPrompt(false);
                break;
            default:
                this.doPositionOverlay({ top: '0', left: '0', width: '100%', height: '100%' });
                this.toggleDropIntoPrompt(true);
        }
        // Make sure the overlay is visible now
        const overlay = assertReturnsDefined(this.overlay);
        overlay.style.opacity = '1';
        // Enable transition after a timeout to prevent initial animation
        setTimeout(() => overlay.classList.add('overlay-move-transition'), 0);
        // Remember as current split direction
        this.currentDropOperation = { splitDirection };
    }
    doPositionOverlay(options) {
        const [container, overlay] = assertReturnsAllDefined(this.container, this.overlay);
        // Container
        const offsetHeight = this.getOverlayOffsetHeight();
        if (offsetHeight) {
            container.style.height = `calc(100% - ${offsetHeight}px)`;
        }
        else {
            container.style.height = '100%';
        }
        // Overlay
        overlay.style.top = options.top;
        overlay.style.left = options.left;
        overlay.style.width = options.width;
        overlay.style.height = options.height;
    }
    getOverlayOffsetHeight() {
        // With tabs and opened editors: use the area below tabs as drop target
        if (!this.groupView.isEmpty && this.editorGroupService.partOptions.showTabs === 'multiple') {
            return this.groupView.titleHeight.offset;
        }
        // Without tabs or empty group: use entire editor area as drop target
        return 0;
    }
    hideOverlay() {
        const overlay = assertReturnsDefined(this.overlay);
        // Reset overlay
        this.doPositionOverlay({ top: '0', left: '0', width: '100%', height: '100%' });
        overlay.style.opacity = '0';
        overlay.classList.remove('overlay-move-transition');
        // Reset current operation
        this.currentDropOperation = undefined;
    }
    toggleDropIntoPrompt(showing) {
        if (!this.dropIntoPromptElement) {
            return;
        }
        this.dropIntoPromptElement.style.opacity = showing ? '1' : '0';
    }
    contains(element) {
        return element === this.container || element === this.overlay;
    }
    dispose() {
        super.dispose();
        this._disposed = true;
    }
};
DropOverlay = DropOverlay_1 = __decorate([
    __param(1, IThemeService),
    __param(2, IConfigurationService),
    __param(3, IInstantiationService),
    __param(4, IEditorService),
    __param(5, IEditorGroupsService),
    __param(6, ITreeViewsDnDService),
    __param(7, IWorkspaceContextService)
], DropOverlay);
let EditorDropTarget = class EditorDropTarget extends Themable {
    constructor(container, delegate, editorGroupService, themeService, configurationService, instantiationService) {
        super(themeService);
        this.container = container;
        this.delegate = delegate;
        this.editorGroupService = editorGroupService;
        this.configurationService = configurationService;
        this.instantiationService = instantiationService;
        this.counter = 0;
        this.editorTransfer = LocalSelectionTransfer.getInstance();
        this.groupTransfer = LocalSelectionTransfer.getInstance();
        this.registerListeners();
    }
    get overlay() {
        if (this._overlay && !this._overlay.disposed) {
            return this._overlay;
        }
        return undefined;
    }
    registerListeners() {
        this._register(addDisposableListener(this.container, EventType.DRAG_ENTER, e => this.onDragEnter(e)));
        this._register(addDisposableListener(this.container, EventType.DRAG_LEAVE, () => this.onDragLeave()));
        for (const target of [this.container, getWindow(this.container)]) {
            this._register(addDisposableListener(target, EventType.DRAG_END, () => this.onDragEnd()));
        }
    }
    onDragEnter(event) {
        if (isDropIntoEditorEnabledGlobally(this.configurationService) && isDragIntoEditorEvent(event)) {
            return;
        }
        this.counter++;
        // Validate transfer
        if (!this.editorTransfer.hasData(DraggedEditorIdentifier.prototype) &&
            !this.groupTransfer.hasData(DraggedEditorGroupIdentifier.prototype) &&
            event.dataTransfer) {
            const dndContributions = Registry.as(DragAndDropExtensions.DragAndDropContribution).getAll();
            const dndContributionKeys = Array.from(dndContributions).map(e => e.dataFormatKey);
            if (!containsDragType(event, DataTransfers.FILES, CodeDataTransfers.FILES, DataTransfers.RESOURCES, CodeDataTransfers.EDITORS, ...dndContributionKeys)) { // see https://github.com/microsoft/vscode/issues/25789
                event.dataTransfer.dropEffect = 'none';
                return; // unsupported transfer
            }
        }
        // Signal DND start
        this.updateContainer(true);
        const target = event.target;
        if (target) {
            // Somehow we managed to move the mouse quickly out of the current overlay, so destroy it
            if (this.overlay && !this.overlay.contains(target)) {
                this.disposeOverlay();
            }
            // Create overlay over target
            if (!this.overlay) {
                const targetGroupView = this.findTargetGroupView(target);
                if (targetGroupView) {
                    this._overlay = this.instantiationService.createInstance(DropOverlay, targetGroupView);
                }
            }
        }
    }
    onDragLeave() {
        this.counter--;
        if (this.counter === 0) {
            this.updateContainer(false);
        }
    }
    onDragEnd() {
        this.counter = 0;
        this.updateContainer(false);
        this.disposeOverlay();
    }
    findTargetGroupView(child) {
        const groups = this.editorGroupService.groups;
        return groups.find(groupView => isAncestor(child, groupView.element) || this.delegate.containsGroup?.(groupView));
    }
    updateContainer(isDraggedOver) {
        this.container.classList.toggle('dragged-over', isDraggedOver);
    }
    dispose() {
        super.dispose();
        this.disposeOverlay();
    }
    disposeOverlay() {
        if (this.overlay) {
            this.overlay.dispose();
            this._overlay = undefined;
        }
    }
};
EditorDropTarget = __decorate([
    __param(2, IEditorGroupsService),
    __param(3, IThemeService),
    __param(4, IConfigurationService),
    __param(5, IInstantiationService)
], EditorDropTarget);
export { EditorDropTarget };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yRHJvcFRhcmdldC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yRHJvcFRhcmdldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyw4QkFBOEIsQ0FBQztBQUN0QyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDaEUsT0FBTyxFQUFFLENBQUMsRUFBRSxxQkFBcUIsRUFBRSxtQkFBbUIsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUMvSSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUN4RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNwRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDcEUsT0FBTyxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNqRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzVFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDNUYs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