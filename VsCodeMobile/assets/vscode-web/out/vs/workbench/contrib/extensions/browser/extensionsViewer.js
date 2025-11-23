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
var ExtensionRenderer_1;
import * as dom from '../../../../base/browser/dom.js';
import { localize } from '../../../../nls.js';
import { dispose, Disposable, DisposableStore, toDisposable, isDisposable } from '../../../../base/common/lifecycle.js';
import { Action, ActionRunner, Separator } from '../../../../base/common/actions.js';
import { IExtensionsWorkbenchService } from '../common/extensions.js';
import { Event } from '../../../../base/common/event.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IListService, WorkbenchAsyncDataTree, WorkbenchPagedList } from '../../../../platform/list/browser/listService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { registerThemingParticipant } from '../../../../platform/theme/common/themeService.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { isNonEmptyArray } from '../../../../base/common/arrays.js';
import { Delegate, Renderer } from './extensionsList.js';
import { listFocusForeground, listFocusBackground, foreground, editorBackground } from '../../../../platform/theme/common/colorRegistry.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { StandardMouseEvent } from '../../../../base/browser/mouseEvent.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { areSameExtensions } from '../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { ExtensionAction, getContextMenuActions, ManageExtensionAction } from './extensionsActions.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { getLocationBasedViewColors } from '../../../browser/parts/views/viewPane.js';
import { DelayedPagedModel } from '../../../../base/common/paging.js';
import { ExtensionIconWidget } from './extensionsWidgets.js';
function getAriaLabelForExtension(extension) {
    if (!extension) {
        return '';
    }
    const publisher = extension.publisherDomain?.verified ? localize('extension.arialabel.verifiedPublisher', "Verified Publisher {0}", extension.publisherDisplayName) : localize('extension.arialabel.publisher', "Publisher {0}", extension.publisherDisplayName);
    const deprecated = extension?.deprecationInfo ? localize('extension.arialabel.deprecated', "Deprecated") : '';
    const rating = extension?.rating ? localize('extension.arialabel.rating', "Rated {0} out of 5 stars by {1} users", extension.rating.toFixed(2), extension.ratingCount) : '';
    return `${extension.displayName}, ${deprecated ? `${deprecated}, ` : ''}${extension.version}, ${publisher}, ${extension.description} ${rating ? `, ${rating}` : ''}`;
}
let ExtensionsList = class ExtensionsList extends Disposable {
    constructor(parent, viewId, options, extensionsViewState, extensionsWorkbenchService, viewDescriptorService, layoutService, notificationService, contextMenuService, contextKeyService, instantiationService) {
        super();
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.contextMenuService = contextMenuService;
        this.contextKeyService = contextKeyService;
        this.instantiationService = instantiationService;
        this.contextMenuActionRunner = this._register(new ActionRunner());
        this._register(this.contextMenuActionRunner.onDidRun(({ error }) => error && notificationService.error(error)));
        const delegate = new Delegate();
        const renderer = instantiationService.createInstance(Renderer, extensionsViewState, {
            hoverOptions: {
                position: () => {
                    const viewLocation = viewDescriptorService.getViewLocationById(viewId);
                    if (viewLocation === 0 /* ViewContainerLocation.Sidebar */) {
                        return layoutService.getSideBarPosition() === 0 /* Position.LEFT */ ? 1 /* HoverPosition.RIGHT */ : 0 /* HoverPosition.LEFT */;
                    }
                    if (viewLocation === 2 /* ViewContainerLocation.AuxiliaryBar */) {
                        return layoutService.getSideBarPosition() === 0 /* Position.LEFT */ ? 0 /* HoverPosition.LEFT */ : 1 /* HoverPosition.RIGHT */;
                    }
                    return 1 /* HoverPosition.RIGHT */;
                }
            }
        });
        this.list = instantiationService.createInstance(WorkbenchPagedList, `${viewId}-Extensions`, parent, delegate, [renderer], {
            multipleSelectionSupport: false,
            setRowLineHeight: false,
            horizontalScrolling: false,
            accessibilityProvider: {
                getAriaLabel(extension) {
                    return getAriaLabelForExtension(extension);
                },
                getWidgetAriaLabel() {
                    return localize('extensions', "Extensions");
                }
            },
            overrideStyles: getLocationBasedViewColors(viewDescriptorService.getViewLocationById(viewId)).listOverrideStyles,
            openOnSingleClick: true,
            ...options
        });
        this._register(this.list.onContextMenu(e => this.onContextMenu(e), this));
        this._register(this.list);
        this._register(Event.debounce(Event.filter(this.list.onDidOpen, e => e.element !== null), (_, event) => event, 75, true)(options => {
            this.openExtension(options.element, { sideByside: options.sideBySide, ...options.editorOptions });
        }));
    }
    setModel(model) {
        this.list.model = new DelayedPagedModel(model);
    }
    layout(height, width) {
        this.list.layout(height, width);
    }
    openExtension(extension, options) {
        extension = this.extensionsWorkbenchService.local.filter(e => areSameExtensions(e.identifier, extension.identifier))[0] || extension;
        this.extensionsWorkbenchService.open(extension, options);
    }
    async onContextMenu(e) {
        if (e.element) {
            const disposables = new DisposableStore();
            const manageExtensionAction = disposables.add(this.instantiationService.createInstance(ManageExtensionAction));
            const extension = e.element ? this.extensionsWorkbenchService.local.find(local => areSameExtensions(local.identifier, e.element.identifier) && (!e.element.server || e.element.server === local.server)) || e.element
                : e.element;
            manageExtensionAction.extension = extension;
            let groups = [];
            if (manageExtensionAction.enabled) {
                groups = await manageExtensionAction.getActionGroups();
            }
            else if (extension) {
                groups = await getContextMenuActions(extension, this.contextKeyService, this.instantiationService);
                groups.forEach(group => group.forEach(extensionAction => {
                    if (extensionAction instanceof ExtensionAction) {
                        extensionAction.extension = extension;
                    }
                }));
            }
            const actions = [];
            for (const menuActions of groups) {
                for (const menuAction of menuActions) {
                    actions.push(menuAction);
                    if (isDisposable(menuAction)) {
                        disposables.add(menuAction);
                    }
                }
                actions.push(new Separator());
            }
            actions.pop();
            this.contextMenuService.showContextMenu({
                getAnchor: () => e.anchor,
                getActions: () => actions,
                actionRunner: this.contextMenuActionRunner,
                onHide: () => disposables.dispose()
            });
        }
    }
};
ExtensionsList = __decorate([
    __param(4, IExtensionsWorkbenchService),
    __param(5, IViewDescriptorService),
    __param(6, IWorkbenchLayoutService),
    __param(7, INotificationService),
    __param(8, IContextMenuService),
    __param(9, IContextKeyService),
    __param(10, IInstantiationService)
], ExtensionsList);
export { ExtensionsList };
let ExtensionsGridView = class ExtensionsGridView extends Disposable {
    constructor(parent, delegate, instantiationService) {
        super();
        this.instantiationService = instantiationService;
        this.element = dom.append(parent, dom.$('.extensions-grid-view'));
        this.renderer = this.instantiationService.createInstance(Renderer, { onFocus: Event.None, onBlur: Event.None, filters: {} }, { hoverOptions: { position() { return 2 /* HoverPosition.BELOW */; } } });
        this.delegate = delegate;
        this.disposableStore = this._register(new DisposableStore());
    }
    setExtensions(extensions) {
        this.disposableStore.clear();
        extensions.forEach((e, index) => this.renderExtension(e, index));
    }
    renderExtension(extension, index) {
        const extensionContainer = dom.append(this.element, dom.$('.extension-container'));
        extensionContainer.style.height = `${this.delegate.getHeight()}px`;
        extensionContainer.setAttribute('tabindex', '0');
        const template = this.renderer.renderTemplate(extensionContainer);
        this.disposableStore.add(toDisposable(() => this.renderer.disposeTemplate(template)));
        const openExtensionAction = this.instantiationService.createInstance(OpenExtensionAction);
        openExtensionAction.extension = extension;
        template.name.setAttribute('tabindex', '0');
        const handleEvent = (e) => {
            if (e instanceof StandardKeyboardEvent && e.keyCode !== 3 /* KeyCode.Enter */) {
                return;
            }
            openExtensionAction.run(e.ctrlKey || e.metaKey);
            e.stopPropagation();
            e.preventDefault();
        };
        this.disposableStore.add(dom.addDisposableListener(template.name, dom.EventType.CLICK, (e) => handleEvent(new StandardMouseEvent(dom.getWindow(template.name), e))));
        this.disposableStore.add(dom.addDisposableListener(template.name, dom.EventType.KEY_DOWN, (e) => handleEvent(new StandardKeyboardEvent(e))));
        this.disposableStore.add(dom.addDisposableListener(extensionContainer, dom.EventType.KEY_DOWN, (e) => handleEvent(new StandardKeyboardEvent(e))));
        this.renderer.renderElement(extension, index, template);
    }
};
ExtensionsGridView = __decorate([
    __param(2, IInstantiationService)
], ExtensionsGridView);
export { ExtensionsGridView };
class AsyncDataSource {
    hasChildren({ hasChildren }) {
        return hasChildren;
    }
    getChildren(extensionData) {
        return extensionData.getChildren();
    }
}
class VirualDelegate {
    getHeight(element) {
        return 62;
    }
    getTemplateId({ extension }) {
        return extension ? ExtensionRenderer.TEMPLATE_ID : UnknownExtensionRenderer.TEMPLATE_ID;
    }
}
let ExtensionRenderer = class ExtensionRenderer {
    static { ExtensionRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'extension-template'; }
    constructor(instantiationService) {
        this.instantiationService = instantiationService;
    }
    get templateId() {
        return ExtensionRenderer_1.TEMPLATE_ID;
    }
    renderTemplate(container) {
        container.classList.add('extension');
        const iconWidget = this.instantiationService.createInstance(ExtensionIconWidget, container);
        const details = dom.append(container, dom.$('.details'));
        const header = dom.append(details, dom.$('.header'));
        const name = dom.append(header, dom.$('span.name'));
        const openExtensionAction = this.instantiationService.createInstance(OpenExtensionAction);
        const extensionDisposables = [dom.addDisposableListener(name, 'click', (e) => {
                openExtensionAction.run(e.ctrlKey || e.metaKey);
                e.stopPropagation();
                e.preventDefault();
            }), iconWidget, openExtensionAction];
        const identifier = dom.append(header, dom.$('span.identifier'));
        const footer = dom.append(details, dom.$('.footer'));
        const author = dom.append(footer, dom.$('.author'));
        return {
            name,
            identifier,
            author,
            extensionDisposables,
            set extensionData(extensionData) {
                iconWidget.extension = extensionData.extension;
                openExtensionAction.extension = extensionData.extension;
            }
        };
    }
    renderElement(node, index, data) {
        const extension = node.element.extension;
        data.name.textContent = extension.displayName;
        data.identifier.textContent = extension.identifier.id;
        data.author.textContent = extension.publisherDisplayName;
        data.extensionData = node.element;
    }
    disposeTemplate(templateData) {
        templateData.extensionDisposables = dispose(templateData.extensionDisposables);
    }
};
ExtensionRenderer = ExtensionRenderer_1 = __decorate([
    __param(0, IInstantiationService)
], ExtensionRenderer);
class UnknownExtensionRenderer {
    static { this.TEMPLATE_ID = 'unknown-extension-template'; }
    get templateId() {
        return UnknownExtensionRenderer.TEMPLATE_ID;
    }
    renderTemplate(container) {
        const messageContainer = dom.append(container, dom.$('div.unknown-extension'));
        dom.append(messageContainer, dom.$('span.error-marker')).textContent = localize('error', "Error");
        dom.append(messageContainer, dom.$('span.message')).textContent = localize('Unknown Extension', "Unknown Extension:");
        const identifier = dom.append(messageContainer, dom.$('span.message'));
        return { identifier };
    }
    renderElement(node, index, data) {
        data.identifier.textContent = node.element.extension.identifier.id;
    }
    disposeTemplate(data) {
    }
}
let OpenExtensionAction = class OpenExtensionAction extends Action {
    constructor(extensionsWorkdbenchService) {
        super('extensions.action.openExtension', '');
        this.extensionsWorkdbenchService = extensionsWorkdbenchService;
    }
    set extension(extension) {
        this._extension = extension;
    }
    run(sideByside) {
        if (this._extension) {
            return this.extensionsWorkdbenchService.open(this._extension, { sideByside });
        }
        return Promise.resolve();
    }
};
OpenExtensionAction = __decorate([
    __param(0, IExtensionsWorkbenchService)
], OpenExtensionAction);
let ExtensionsTree = class ExtensionsTree extends WorkbenchAsyncDataTree {
    constructor(input, container, overrideStyles, contextKeyService, listService, instantiationService, configurationService, extensionsWorkdbenchService) {
        const delegate = new VirualDelegate();
        const dataSource = new AsyncDataSource();
        const renderers = [instantiationService.createInstance(ExtensionRenderer), instantiationService.createInstance(UnknownExtensionRenderer)];
        const identityProvider = {
            getId({ extension, parent }) {
                return parent ? this.getId(parent) + '/' + extension.identifier.id : extension.identifier.id;
            }
        };
        super('ExtensionsTree', container, delegate, renderers, dataSource, {
            indent: 40,
            identityProvider,
            multipleSelectionSupport: false,
            overrideStyles,
            accessibilityProvider: {
                getAriaLabel(extensionData) {
                    return getAriaLabelForExtension(extensionData.extension);
                },
                getWidgetAriaLabel() {
                    return localize('extensions', "Extensions");
                }
            }
        }, instantiationService, contextKeyService, listService, configurationService);
        this.setInput(input);
        this.disposables.add(this.onDidChangeSelection(event => {
            if (dom.isKeyboardEvent(event.browserEvent)) {
                extensionsWorkdbenchService.open(event.elements[0].extension, { sideByside: false });
            }
        }));
    }
};
ExtensionsTree = __decorate([
    __param(3, IContextKeyService),
    __param(4, IListService),
    __param(5, IInstantiationService),
    __param(6, IConfigurationService),
    __param(7, IExtensionsWorkbenchService)
], ExtensionsTree);
export { ExtensionsTree };
export class ExtensionData {
    constructor(extension, parent, getChildrenExtensionIds, extensionsWorkbenchService) {
        this.extension = extension;
        this.parent = parent;
        this.getChildrenExtensionIds = getChildrenExtensionIds;
        this.extensionsWorkbenchService = extensionsWorkbenchService;
        this.childrenExtensionIds = this.getChildrenExtensionIds(extension);
    }
    get hasChildren() {
        return isNonEmptyArray(this.childrenExtensionIds);
    }
    async getChildren() {
        if (this.hasChildren) {
            const result = await getExtensions(this.childrenExtensionIds, this.extensionsWorkbenchService);
            return result.map(extension => new ExtensionData(extension, this, this.getChildrenExtensionIds, this.extensionsWorkbenchService));
        }
        return null;
    }
}
export async function getExtensions(extensions, extensionsWorkbenchService) {
    const localById = extensionsWorkbenchService.local.reduce((result, e) => { result.set(e.identifier.id.toLowerCase(), e); return result; }, new Map());
    const result = [];
    const toQuery = [];
    for (const extensionId of extensions) {
        const id = extensionId.toLowerCase();
        const local = localById.get(id);
        if (local) {
            result.push(local);
        }
        else {
            toQuery.push(id);
        }
    }
    if (toQuery.length) {
        const galleryResult = await extensionsWorkbenchService.getExtensions(toQuery.map(id => ({ id })), CancellationToken.None);
        result.push(...galleryResult);
    }
    return result;
}
registerThemingParticipant((theme, collector) => {
    const focusBackground = theme.getColor(listFocusBackground);
    if (focusBackground) {
        collector.addRule(`.extensions-grid-view .extension-container:focus { background-color: ${focusBackground}; outline: none; }`);
    }
    const focusForeground = theme.getColor(listFocusForeground);
    if (focusForeground) {
        collector.addRule(`.extensions-grid-view .extension-container:focus { color: ${focusForeground}; }`);
    }
    const foregroundColor = theme.getColor(foreground);
    const editorBackgroundColor = theme.getColor(editorBackground);
    if (foregroundColor && editorBackgroundColor) {
        const authorForeground = foregroundColor.transparent(.9).makeOpaque(editorBackgroundColor);
        collector.addRule(`.extensions-grid-view .extension-container:not(.disabled) .author { color: ${authorForeground}; }`);
        const disabledExtensionForeground = foregroundColor.transparent(.5).makeOpaque(editorBackgroundColor);
        collector.addRule(`.extensions-grid-view .extension-container.disabled { color: ${disabledExtensionForeground}; }`);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uc1ZpZXdlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvZXh0ZW5zaW9uc1ZpZXdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQ0FBaUMsQ0FBQztBQUN2RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDOUMsT0FBTyxFQUFlLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNySSxPQUFPLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBVyxTQUFTLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RixPQUFPLEVBQUUsMkJBQTJCLEVBQW9DLE1BQU0seUJBQXlCLENBQUM7QUFDeEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxZQUFZLEVBQThCLHNCQUFzQixFQUFFLGtCQUFrQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDeEosT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLDBCQUEwQixFQUFtQyxNQUFNLG1EQUFtRCxDQUFDO0FBR2hJLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxN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