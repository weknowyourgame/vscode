/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import './media/compositepart.css';
import { localize } from '../../../nls.js';
import { defaultGenerator } from '../../../base/common/idGenerator.js';
import { dispose, DisposableStore, MutableDisposable, } from '../../../base/common/lifecycle.js';
import { Emitter } from '../../../base/common/event.js';
import { isCancellationError } from '../../../base/common/errors.js';
import { prepareActions } from '../../../base/browser/ui/actionbar/actionbar.js';
import { ProgressBar } from '../../../base/browser/ui/progressbar/progressbar.js';
import { Part } from '../part.js';
import { ServiceCollection } from '../../../platform/instantiation/common/serviceCollection.js';
import { IEditorProgressService } from '../../../platform/progress/common/progress.js';
import { Dimension, append, $, hide, show } from '../../../base/browser/dom.js';
import { assertReturnsDefined } from '../../../base/common/types.js';
import { createActionViewItem } from '../../../platform/actions/browser/menuEntryActionViewItem.js';
import { AbstractProgressScope, ScopedProgressIndicator } from '../../services/progress/browser/progressIndicator.js';
import { WorkbenchToolBar } from '../../../platform/actions/browser/toolbar.js';
import { defaultProgressBarStyles } from '../../../platform/theme/browser/defaultStyles.js';
import { createInstantHoverDelegate, getDefaultHoverDelegate } from '../../../base/browser/ui/hover/hoverDelegateFactory.js';
export class CompositePart extends Part {
    constructor(notificationService, storageService, contextMenuService, layoutService, keybindingService, hoverService, instantiationService, themeService, registry, activeCompositeSettingsKey, defaultCompositeId, nameForTelemetry, compositeCSSClass, titleForegroundColor, titleBorderColor, id, options) {
        super(id, options, themeService, storageService, layoutService);
        this.notificationService = notificationService;
        this.storageService = storageService;
        this.contextMenuService = contextMenuService;
        this.keybindingService = keybindingService;
        this.hoverService = hoverService;
        this.instantiationService = instantiationService;
        this.registry = registry;
        this.activeCompositeSettingsKey = activeCompositeSettingsKey;
        this.defaultCompositeId = defaultCompositeId;
        this.nameForTelemetry = nameForTelemetry;
        this.compositeCSSClass = compositeCSSClass;
        this.titleForegroundColor = titleForegroundColor;
        this.titleBorderColor = titleBorderColor;
        this.onDidCompositeOpen = this._register(new Emitter());
        this.onDidCompositeClose = this._register(new Emitter());
        this.mapCompositeToCompositeContainer = new Map();
        this.mapActionsBindingToComposite = new Map();
        this.instantiatedCompositeItems = new Map();
        this.actionsListener = this._register(new MutableDisposable());
        this.lastActiveCompositeId = storageService.get(activeCompositeSettingsKey, 1 /* StorageScope.WORKSPACE */, this.defaultCompositeId);
        this.toolbarHoverDelegate = this._register(createInstantHoverDelegate());
        this.trailingSeparator = options.trailingSeparator ?? false;
    }
    openComposite(id, focus) {
        // Check if composite already visible and just focus in that case
        if (this.activeComposite?.getId() === id) {
            if (focus) {
                this.activeComposite.focus();
            }
            // Fullfill promise with composite that is being opened
            return this.activeComposite;
        }
        // We cannot open the composite if we have not been created yet
        if (!this.element) {
            return;
        }
        // Open
        return this.doOpenComposite(id, focus);
    }
    doOpenComposite(id, focus = false) {
        // Use a generated token to avoid race conditions from long running promises
        const currentCompositeOpenToken = defaultGenerator.nextId();
        this.currentCompositeOpenToken = currentCompositeOpenToken;
        // Hide current
        if (this.activeComposite) {
            this.hideActiveComposite();
        }
        // Update Title
        this.updateTitle(id);
        // Create composite
        const composite = this.createComposite(id, true);
        // Check if another composite opened meanwhile and return in that case
        if ((this.currentCompositeOpenToken !== currentCompositeOpenToken) || (this.activeComposite && this.activeComposite.getId() !== composite.getId())) {
            return undefined;
        }
        // Check if composite already visible and just focus in that case
        if (this.activeComposite?.getId() === composite.getId()) {
            if (focus) {
                composite.focus();
            }
            this.onDidCompositeOpen.fire({ composite, focus });
            return composite;
        }
        // Show Composite and Focus
        this.showComposite(composite);
        if (focus) {
            composite.focus();
        }
        // Return with the composite that is being opened
        if (composite) {
            this.onDidCompositeOpen.fire({ composite, focus });
        }
        return composite;
    }
    createComposite(id, isActive) {
        // Check if composite is already created
        const compositeItem = this.instantiatedCompositeItems.get(id);
        if (compositeItem) {
            return compositeItem.composite;
        }
        // Instantiate composite from registry otherwise
        const compositeDescriptor = this.registry.getComposite(id);
        if (compositeDescriptor) {
            const that = this;
            const compositeProgressIndicator = new ScopedProgressIndicator(assertReturnsDefined(this.progressBar), this._register(new class extends AbstractProgressScope {
                constructor() {
                    super(compositeDescriptor.id, !!isActive);
                    this._register(that.onDidCompositeOpen.event(e => this.onScopeOpened(e.composite.getId())));
                    this._register(that.onDidCompositeClose.event(e => this.onScopeClosed(e.getId())));
                }
            }()));
            const compositeInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IEditorProgressService, compositeProgressIndicator] // provide the editor progress service for any editors instantiated within the composite
            )));
            const composite = compositeDescriptor.instantiate(compositeInstantiationService);
            const disposable = new DisposableStore();
            // Remember as Instantiated
            this.instantiatedCompositeItems.set(id, { composite, disposable, progress: compositeProgressIndicator });
            // Register to title area update events from the composite
            disposable.add(composite.onTitleAreaUpdate(() => this.onTitleAreaUpdate(composite.getId()), this));
            disposable.add(compositeInstantiationService);
            return composite;
        }
        throw new Error(`Unable to find composite with id ${id}`);
    }
    showComposite(composite) {
        // Remember Composite
        this.activeComposite = composite;
        // Store in preferences
        const id = this.activeComposite.getId();
        if (id !== this.defaultCompositeId) {
            this.storageService.store(this.activeCompositeSettingsKey, id, 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
        }
        else {
            this.storageService.remove(this.activeCompositeSettingsKey, 1 /* StorageScope.WORKSPACE */);
        }
        // Remember
        this.lastActiveCompositeId = this.activeComposite.getId();
        // Composites created for the first time
        let compositeContainer = this.mapCompositeToCompositeContainer.get(composite.getId());
        if (!compositeContainer) {
            // Build Container off-DOM
            compositeContainer = $('.composite');
            compositeContainer.classList.add(...this.compositeCSSClass.split(' '));
            compositeContainer.id = composite.getId();
            composite.create(compositeContainer);
            composite.updateStyles();
            // Remember composite container
            this.mapCompositeToCompositeContainer.set(composite.getId(), compositeContainer);
        }
        // Fill Content and Actions
        // Make sure that the user meanwhile did not open another composite or closed the part containing the composite
        if (!this.activeComposite || composite.getId() !== this.activeComposite.getId()) {
            return undefined;
        }
        // Take Composite on-DOM and show
        this.contentArea?.appendChild(compositeContainer);
        show(compositeContainer);
        // Setup action runner
        const toolBar = assertReturnsDefined(this.toolBar);
        toolBar.actionRunner = composite.getActionRunner();
        // Update title with composite title if it differs from descriptor
        const descriptor = this.registry.getComposite(composite.getId());
        if (descriptor && descriptor.name !== composite.getTitle()) {
            this.updateTitle(composite.getId(), composite.getTitle());
        }
        // Handle Composite Actions
        let actionsBinding = this.mapActionsBindingToComposite.get(composite.getId());
        if (!actionsBinding) {
            actionsBinding = this.collectCompositeActions(composite);
            this.mapActionsBindingToComposite.set(composite.getId(), actionsBinding);
        }
        actionsBinding();
        // Action Run Handling
        this.actionsListener.value = toolBar.actionRunner.onDidRun(e => {
            // Check for Error
            if (e.error && !isCancellationError(e.error)) {
                this.notificationService.error(e.error);
            }
        });
        // Indicate to composite that it is now visible
        composite.setVisible(true);
        // Make sure that the user meanwhile did not open another composite or closed the part containing the composite
        if (!this.activeComposite || composite.getId() !== this.activeComposite.getId()) {
            return;
        }
        // Make sure the composite is layed out
        if (this.contentAreaSize) {
            composite.layout(this.contentAreaSize);
        }
        // Make sure boundary sashes are propagated
        if (this.boundarySashes) {
            composite.setBoundarySashes(this.boundarySashes);
        }
    }
    onTitleAreaUpdate(compositeId) {
        // Title
        const composite = this.instantiatedCompositeItems.get(compositeId);
        if (composite) {
            this.updateTitle(compositeId, composite.composite.getTitle());
        }
        // Active Composite
        if (this.activeComposite?.getId() === compositeId) {
            // Actions
            const actionsBinding = this.collectCompositeActions(this.activeComposite);
            this.mapActionsBindingToComposite.set(this.activeComposite.getId(), actionsBinding);
            actionsBinding();
        }
        // Otherwise invalidate actions binding for next time when the composite becomes visible
        else {
            this.mapActionsBindingToComposite.delete(compositeId);
        }
    }
    updateTitle(compositeId, compositeTitle) {
        const compositeDescriptor = this.registry.getComposite(compositeId);
        if (!compositeDescriptor || !this.titleLabel) {
            return;
        }
        if (!compositeTitle) {
            compositeTitle = compositeDescriptor.name;
        }
        const keybinding = this.keybindingService.lookupKeybinding(compositeId);
        this.titleLabel.updateTitle(compositeId, compositeTitle, keybinding?.getLabel() ?? undefined);
        const toolBar = assertReturnsDefined(this.toolBar);
        toolBar.setAriaLabel(localize('ariaCompositeToolbarLabel', "{0} actions", compositeTitle));
    }
    collectCompositeActions(composite) {
        // From Composite
        const menuIds = composite?.getMenuIds();
        const primaryActions = composite?.getActions().slice(0) || [];
        const secondaryActions = composite?.getSecondaryActions().slice(0) || [];
        // Update context
        const toolBar = assertReturnsDefined(this.toolBar);
        toolBar.context = this.actionsContextProvider();
        // Return fn to set into toolbar
        return () => {
            toolBar.setActions(prepareActions(primaryActions), prepareActions(secondaryActions), menuIds);
            this.titleArea?.classList.toggle('has-actions', primaryActions.length > 0 || secondaryActions.length > 0);
        };
    }
    getActiveComposite() {
        return this.activeComposite;
    }
    getLastActiveCompositeId() {
        return this.lastActiveCompositeId;
    }
    hideActiveComposite() {
        if (!this.activeComposite) {
            return undefined; // Nothing to do
        }
        const composite = this.activeComposite;
        this.activeComposite = undefined;
        const compositeContainer = this.mapCompositeToCompositeContainer.get(composite.getId());
        // Indicate to Composite
        composite.setVisible(false);
        // Take Container Off-DOM and hide
        if (compositeContainer) {
            compositeContainer.remove();
            hide(compositeContainer);
        }
        // Clear any running Progress
        this.progressBar?.stop().hide();
        // Empty Actions
        if (this.toolBar) {
            this.collectCompositeActions()();
        }
        this.onDidCompositeClose.fire(composite);
        return composite;
    }
    createTitleArea(parent) {
        // Title Area Container
        const titleArea = append(parent, $('.composite'));
        titleArea.classList.add('title');
        // Left Title Label
        this.titleLabel = this.createTitleLabel(titleArea);
        // Right Actions Container
        const titleActionsContainer = append(titleArea, $('.title-actions'));
        // Toolbar
        this.toolBar = this._register(this.instantiationService.createInstance(WorkbenchToolBar, titleActionsContainer, {
            actionViewItemProvider: (action, options) => this.actionViewItemProvider(action, options),
            orientation: 0 /* ActionsOrientation.HORIZONTAL */,
            getKeyBinding: action => this.keybindingService.lookupKeybinding(action.id),
            anchorAlignmentProvider: () => this.getTitleAreaDropDownAnchorAlignment(),
            toggleMenuTitle: localize('viewsAndMoreActions', "Views and More Actions..."),
            telemetrySource: this.nameForTelemetry,
            hoverDelegate: this.toolbarHoverDelegate,
            trailingSeparator: this.trailingSeparator,
        }));
        this.collectCompositeActions()();
        return titleArea;
    }
    createTitleLabel(parent) {
        const titleContainer = append(parent, $('.title-label'));
        const titleLabel = append(titleContainer, $('h2'));
        this.titleLabelElement = titleLabel;
        const hover = this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), titleLabel, ''));
        const $this = this;
        return {
            updateTitle: (id, title, keybinding) => {
                // The title label is shared for all composites in the base CompositePart
                if (!this.activeComposite || this.activeComposite.getId() === id) {
                    titleLabel.textContent = title;
                    hover.update(keybinding ? localize('titleTooltip', "{0} ({1})", title, keybinding) : title);
                }
            },
            updateStyles: () => {
                titleLabel.style.color = $this.titleForegroundColor ? $this.getColor($this.titleForegroundColor) || '' : '';
                const borderColor = $this.titleBorderColor ? $this.getColor($this.titleBorderColor) : undefined;
                parent.style.borderBottom = borderColor ? `1px solid ${borderColor}` : '';
            }
        };
    }
    createHeaderArea() {
        return $('.composite');
    }
    createFooterArea() {
        return $('.composite');
    }
    updateStyles() {
        super.updateStyles();
        // Forward to title label
        const titleLabel = assertReturnsDefined(this.titleLabel);
        titleLabel.updateStyles();
    }
    actionViewItemProvider(action, options) {
        // Check Active Composite
        if (this.activeComposite) {
            return this.activeComposite.getActionViewItem(action, options);
        }
        return createActionViewItem(this.instantiationService, action, options);
    }
    actionsContextProvider() {
        // Check Active Composite
        if (this.activeComposite) {
            return this.activeComposite.getActionsContext();
        }
        return null;
    }
    createContentArea(parent) {
        const contentContainer = append(parent, $('.content'));
        this.progressBar = this._register(new ProgressBar(contentContainer, defaultProgressBarStyles));
        this.progressBar.hide();
        return contentContainer;
    }
    getProgressIndicator(id) {
        const compositeItem = this.instantiatedCompositeItems.get(id);
        return compositeItem ? compositeItem.progress : undefined;
    }
    getTitleAreaDropDownAnchorAlignment() {
        return 1 /* AnchorAlignment.RIGHT */;
    }
    layout(width, height, top, left) {
        super.layout(width, height, top, left);
        // Layout contents
        this.contentAreaSize = Dimension.lift(super.layoutContents(width, height).contentSize);
        // Layout composite
        this.activeComposite?.layout(this.contentAreaSize);
    }
    setBoundarySashes(sashes) {
        this.boundarySashes = sashes;
        this.activeComposite?.setBoundarySashes(sashes);
    }
    removeComposite(compositeId) {
        if (this.activeComposite?.getId() === compositeId) {
            return false; // do not remove active composite
        }
        this.mapCompositeToCompositeContainer.delete(compositeId);
        this.mapActionsBindingToComposite.delete(compositeId);
        const compositeItem = this.instantiatedCompositeItems.get(compositeId);
        if (compositeItem) {
            compositeItem.composite.dispose();
            dispose(compositeItem.disposable);
            this.instantiatedCompositeItems.delete(compositeId);
        }
        return true;
    }
    dispose() {
        this.mapCompositeToCompositeContainer.clear();
        this.mapActionsBindingToComposite.clear();
        this.instantiatedCompositeItems.forEach(compositeItem => {
            compositeItem.composite.dispose();
            dispose(compositeItem.disposable);
        });
        this.instantiatedCompositeItems.clear();
        super.dispose();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9zaXRlUGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9jb21wb3NpdGVQYXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sMkJBQTJCLENBQUM7QUFDbkMsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzNDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBZSxPQUFPLEVBQUUsZUFBZSxFQUFFLGlCQUFpQixHQUFHLE1BQU0sbUNBQW1DLENBQUM7QUFDOUcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JFLE9BQU8sRUFBdUMsY0FBYyxFQUFFLE1BQU0saURBQWlELENBQUM7QUFDdEgsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBRWxGLE9BQU8sRUFBRSxJQUFJLEVBQWdCLE1BQU0sWUFBWSxDQUFDO0FBT2hELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQ2hHLE9BQU8sRUFBc0Isc0JBQXNCLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUkzRyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRWhGLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3JFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3RI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