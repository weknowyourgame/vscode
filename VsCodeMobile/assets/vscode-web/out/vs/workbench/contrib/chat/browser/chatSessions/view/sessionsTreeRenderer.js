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
var SessionsRenderer_1;
import * as DOM from '../../../../../../base/browser/dom.js';
import { $, append } from '../../../../../../base/browser/dom.js';
import { ActionBar } from '../../../../../../base/browser/ui/actionbar/actionbar.js';
import { IconLabel } from '../../../../../../base/browser/ui/iconLabel/iconLabel.js';
import { InputBox } from '../../../../../../base/browser/ui/inputbox/inputBox.js';
import { timeout } from '../../../../../../base/common/async.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../../base/common/codicons.js';
import { createMatches } from '../../../../../../base/common/filters.js';
import { createSingleCallFunction } from '../../../../../../base/common/functional.js';
import { isMarkdownString } from '../../../../../../base/common/htmlContent.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../../../base/common/lifecycle.js';
import { ResourceSet } from '../../../../../../base/common/map.js';
import Severity from '../../../../../../base/common/severity.js';
import { ThemeIcon } from '../../../../../../base/common/themables.js';
import * as nls from '../../../../../../nls.js';
import { getActionBarActions } from '../../../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IMenuService, MenuId } from '../../../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IContextViewService } from '../../../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../../../platform/hover/browser/hover.js';
import { IMarkdownRendererService } from '../../../../../../platform/markdown/browser/markdownRenderer.js';
import product from '../../../../../../platform/product/common/product.js';
import { defaultInputBoxStyles } from '../../../../../../platform/theme/browser/defaultStyles.js';
import { IEditorGroupsService } from '../../../../../services/editor/common/editorGroupsService.js';
import { IWorkbenchLayoutService } from '../../../../../services/layout/browser/layoutService.js';
import { getLocalHistoryDateFormatter } from '../../../../localHistory/browser/localHistory.js';
import { IChatService } from '../../../common/chatService.js';
import { IChatSessionsService, localChatSessionType } from '../../../common/chatSessionsService.js';
import { LocalChatSessionUri } from '../../../common/chatUri.js';
import { ChatConfiguration } from '../../../common/constants.js';
import { IChatWidgetService } from '../../chat.js';
import { allowedChatMarkdownHtmlTags } from '../../chatContentMarkdownRenderer.js';
import '../../media/chatSessions.css';
import { extractTimestamp, getSessionItemContextOverlay, processSessionsWithTimeGrouping } from '../common.js';
export class ArchivedSessionItems {
    constructor(label) {
        this.label = label;
        this.items = new Map();
    }
    pushItem(item) {
        const key = item.resource.toString();
        this.items.set(key, item);
    }
    getItems() {
        return Array.from(this.items.values());
    }
    clear() {
        this.items.clear();
    }
}
export class GettingStartedDelegate {
    getHeight() {
        return 22;
    }
    getTemplateId() {
        return 'gettingStartedItem';
    }
}
export class GettingStartedRenderer {
    constructor(labels) {
        this.labels = labels;
        this.templateId = 'gettingStartedItem';
    }
    renderTemplate(container) {
        const resourceLabel = this.labels.create(container, { supportHighlights: true });
        return { resourceLabel };
    }
    renderElement(element, index, templateData) {
        templateData.resourceLabel.setResource({
            name: element.label,
            resource: undefined
        }, {
            icon: element.icon,
            hideIcon: false
        });
        templateData.resourceLabel.element.setAttribute('data-command', element.commandId);
    }
    disposeTemplate(templateData) {
        templateData.resourceLabel.dispose();
    }
}
let SessionsRenderer = class SessionsRenderer extends Disposable {
    static { SessionsRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'session'; }
    constructor(viewLocation, contextViewService, configurationService, chatSessionsService, menuService, contextKeyService, hoverService, chatWidgetService, chatService, editorGroupsService, layoutService, markdownRendererService) {
        super();
        this.viewLocation = viewLocation;
        this.contextViewService = contextViewService;
        this.configurationService = configurationService;
        this.chatSessionsService = chatSessionsService;
        this.menuService = menuService;
        this.contextKeyService = contextKeyService;
        this.hoverService = hoverService;
        this.chatWidgetService = chatWidgetService;
        this.chatService = chatService;
        this.editorGroupsService = editorGroupsService;
        this.layoutService = layoutService;
        this.markdownRendererService = markdownRendererService;
    }
    get templateId() {
        return SessionsRenderer_1.TEMPLATE_ID;
    }
    getHoverPosition() {
        const sideBarPosition = this.layoutService.getSideBarPosition();
        switch (this.viewLocation) {
            case 0 /* ViewContainerLocation.Sidebar */:
                return sideBarPosition === 0 /* Position.LEFT */ ? 1 /* HoverPosition.RIGHT */ : 0 /* HoverPosition.LEFT */;
            case 2 /* ViewContainerLocation.AuxiliaryBar */:
                return sideBarPosition === 0 /* Position.LEFT */ ? 0 /* HoverPosition.LEFT */ : 1 /* HoverPosition.RIGHT */;
            default:
                return 1 /* HoverPosition.RIGHT */;
        }
    }
    renderTemplate(container) {
        const element = append(container, $('.chat-session-item'));
        // Create a container that holds the label, timestamp, and actions
        const contentContainer = append(element, $('.session-content'));
        // Custom icon element rendered separately from label text
        const customIcon = append(contentContainer, $('.chat-session-custom-icon'));
        const iconLabel = new IconLabel(contentContainer, { supportHighlights: true, supportIcons: true });
        const descriptionRow = append(element, $('.description-row'));
        const descriptionLabel = append(descriptionRow, $('span.description'));
        const statisticsLabel = append(descriptionRow, $('span.statistics'));
        // Create timestamp container and element
        const timestampContainer = append(contentContainer, $('.timestamp-container'));
        const timestamp = append(timestampContainer, $('.timestamp'));
        const actionsContainer = append(contentContainer, $('.actions'));
        const actionBar = new ActionBar(actionsContainer);
        const elementDisposable = new DisposableStore();
        return {
            container: element,
            iconLabel,
            customIcon,
            actionBar,
            elementDisposable,
            timestamp,
            descriptionRow,
            descriptionLabel,
            statisticsLabel,
        };
    }
    statusToIcon(status) {
        switch (status) {
            case 2 /* ChatSessionStatus.InProgress */:
                return ThemeIcon.modify(Codicon.loading, 'spin');
            case 1 /* ChatSessionStatus.Completed */:
                return Codicon.pass;
            case 0 /* ChatSessionStatus.Failed */:
                return Codicon.error;
            default:
                return Codicon.circleOutline;
        }
    }
    renderArchivedNode(node, templateData) {
        templateData.customIcon.className = '';
        templateData.descriptionRow.style.display = 'none';
        templateData.timestamp.parentElement.style.display = 'none';
        const childCount = node.getItems().length;
        templateData.iconLabel.setLabel(node.label, undefined, {
            title: childCount === 1 ? nls.localize('chat.sessions.groupNode.single', '1 session') : nls.localize('chat.sessions.groupNode.multiple', '{0} sessions', childCount)
        });
    }
    renderElement(element, index, templateData) {
        if (element.element instanceof ArchivedSessionItems) {
            this.renderArchivedNode(element.element, templateData);
            return;
        }
        const session = element.element;
        // Add CSS class for local sessions
        let editableData;
        if (LocalChatSessionUri.parseLocalSessionId(session.resource)) {
            templateData.container.classList.add('local-session');
            editableData = this.chatSessionsService.getEditableData(session.resource);
        }
        else {
            templateData.container.classList.remove('local-session');
        }
        // Check if this session is being edited using the actual session ID
        if (editableData) {
            // Render input box for editing
            templateData.actionBar.clear();
            const editDisposable = this.renderInputBox(templateData.container, session, editableData);
            templateData.elementDisposable.add(editDisposable);
            return;
        }
        // Normal rendering - clear the action bar in case it was used for editing
        templateData.actionBar.clear();
        // Handle different icon types
        let iconTheme;
        if (!session.iconPath) {
            iconTheme = this.statusToIcon(session.status);
        }
        else {
            iconTheme = session.iconPath;
        }
        const renderDescriptionOnSecondRow = this.configurationService.getValue(ChatConfiguration.ShowAgentSessionsViewDescription);
        if (renderDescriptionOnSecondRow && session.description) {
            templateData.container.classList.toggle('multiline', true);
            templateData.descriptionRow.style.display = 'flex';
            if (typeof session.description === 'string') {
                templateData.descriptionLabel.textContent = session.description;
            }
            else {
                templateData.elementDisposable.add(this.markdownRendererService.render(session.description, {
                    sanitizerConfig: {
                        replaceWithPlaintext: true,
                        allowedTags: {
                            override: allowedChatMarkdownHtmlTags,
                        },
                        allowedLinkSchemes: { augment: [product.urlProtocol] }
                    },
                }, templateData.descriptionLabel));
                templateData.elementDisposable.add(DOM.addDisposableListener(templateData.descriptionLabel, 'mousedown', e => e.stopPropagation()));
                templateData.elementDisposable.add(DOM.addDisposableListener(templateData.descriptionLabel, 'click', e => e.stopPropagation()));
                templateData.elementDisposable.add(DOM.addDisposableListener(templateData.descriptionLabel, 'auxclick', e => e.stopPropagation()));
            }
            DOM.clearNode(templateData.statisticsLabel);
            const insertionNode = append(templateData.statisticsLabel, $('span.insertions'));
            insertionNode.textContent = session.statistics ? `+${session.statistics.insertions}` : '';
            const deletionNode = append(templateData.statisticsLabel, $('span.deletions'));
            deletionNode.textContent = session.statistics ? `-${session.statistics.deletions}` : '';
        }
        else {
            templateData.container.classList.toggle('multiline', false);
        }
        // Prepare tooltip content
        const tooltipContent = 'tooltip' in session && session.tooltip ?
            (typeof session.tooltip === 'string' ? session.tooltip :
                isMarkdownString(session.tooltip) ? {
                    markdown: session.tooltip,
                    markdownNotSupportedFallback: session.tooltip.value
                } : undefined) :
            undefined;
        templateData.customIcon.className = iconTheme ? `chat-session-custom-icon ${ThemeIcon.asClassName(iconTheme)}` : '';
        // Set the icon label
        templateData.iconLabel.setLabel(session.label, !renderDescriptionOnSecondRow && typeof session.description === 'string' ? session.description : undefined, {
            title: !renderDescriptionOnSecondRow || !session.description ? tooltipContent : undefined,
            matches: createMatches(element.filterData)
        });
        // For two-row items, set tooltip on the container instead
        if (renderDescriptionOnSecondRow && session.description && tooltipContent) {
            if (typeof tooltipContent === 'string') {
                templateData.elementDisposable.add(this.hoverService.setupDelayedHover(templateData.container, () => ({
                    content: tooltipContent,
                    style: 1 /* HoverStyle.Pointer */,
                    position: { hoverPosition: this.getHoverPosition() }
                }), { groupId: 'chat.sessions' }));
            }
            else if (tooltipContent && typeof tooltipContent === 'object' && 'markdown' in tooltipContent) {
                templateData.elementDisposable.add(this.hoverService.setupDelayedHover(templateData.container, () => ({
                    content: tooltipContent.markdown,
                    style: 1 /* HoverStyle.Pointer */,
                    position: { hoverPosition: this.getHoverPosition() }
                }), { groupId: 'chat.sessions' }));
            }
        }
        // Handle timestamp display and grouping
        const hasTimestamp = session.timing?.startTime !== undefined;
        if (hasTimestamp) {
            templateData.timestamp.textContent = session.relativeTime ?? '';
            templateData.timestamp.ariaLabel = session.relativeTimeFullWord ?? '';
            templateData.timestamp.parentElement.classList.toggle('timestamp-duplicate', session.hideRelativeTime === true);
            templateData.timestamp.parentElement.style.display = '';
            // Add tooltip showing full date/time when hovering over the timestamp
            if (session.timing?.startTime) {
                const fullDateTime = getLocalHistoryDateFormatter().format(session.timing.startTime);
                templateData.elementDisposable.add(this.hoverService.setupDelayedHover(templateData.timestamp, () => ({
                    content: nls.localize('chat.sessions.lastActivity', 'Last Activity: {0}', fullDateTime),
                    style: 1 /* HoverStyle.Pointer */,
                    position: { hoverPosition: this.getHoverPosition() }
                }), { groupId: 'chat.sessions' }));
            }
        }
        else {
            // Hide timestamp container if no timestamp available
            templateData.timestamp.parentElement.style.display = 'none';
        }
        // Create context overlay for this specific session item
        const contextOverlay = getSessionItemContextOverlay(session, session.provider, this.chatWidgetService, this.chatService, this.editorGroupsService);
        const contextKeyService = this.contextKeyService.createOverlay(contextOverlay);
        // Create menu for this session item
        const menu = templateData.elementDisposable.add(this.menuService.createMenu(MenuId.ChatSessionsMenu, contextKeyService));
        // Setup action bar with contributed actions
        const setupActionBar = () => {
            templateData.actionBar.clear();
            // Create marshalled context for command execution
            const marshalledSession = {
                session: session,
                $mid: 25 /* MarshalledId.ChatSessionContext */
            };
            const actions = menu.getActions({ arg: marshalledSession, shouldForwardArgs: true });
            const { primary } = getActionBarActions(actions, 'inline');
            templateData.actionBar.push(primary, { icon: true, label: false });
            // Set context for the action bar
            templateData.actionBar.context = session;
        };
        // Setup initial action bar and listen for menu changes
        templateData.elementDisposable.add(menu.onDidChange(() => setupActionBar()));
        setupActionBar();
    }
    disposeElement(_element, _index, templateData) {
        templateData.elementDisposable.clear();
        templateData.actionBar.clear();
    }
    renderInputBox(container, session, editableData) {
        // Hide the existing resource label element and session content
        // eslint-disable-next-line no-restricted-syntax
        const existingResourceLabelElement = container.querySelector('.monaco-icon-label');
        if (existingResourceLabelElement) {
            existingResourceLabelElement.style.display = 'none';
        }
        // Hide the session content container to avoid layout conflicts
        // eslint-disable-next-line no-restricted-syntax
        const sessionContentElement = container.querySelector('.session-content');
        if (sessionContentElement) {
            sessionContentElement.style.display = 'none';
        }
        // Create a simple container that mimics the file explorer's structure
        const editContainer = DOM.append(container, DOM.$('.explorer-item.explorer-item-edited'));
        // Add the icon
        const iconElement = DOM.append(editContainer, DOM.$('.codicon'));
        if (session.iconPath && ThemeIcon.isThemeIcon(session.iconPath)) {
            iconElement.classList.add(`codicon-${session.iconPath.id}`);
        }
        else {
            iconElement.classList.add('codicon-file'); // Default file icon
        }
        // Create the input box directly
        const inputBox = new InputBox(editContainer, this.contextViewService, {
            validationOptions: {
                validation: (value) => {
                    const message = editableData.validationMessage(value);
                    if (!message || message.severity !== Severity.Error) {
                        return null;
                    }
                    return {
                        content: message.content,
                        formatContent: true,
                        type: 3 /* MessageType.ERROR */
                    };
                }
            },
            ariaLabel: nls.localize('chatSessionInputAriaLabel', "Type session name. Press Enter to confirm or Escape to cancel."),
            inputBoxStyles: defaultInputBoxStyles,
        });
        inputBox.value = session.label;
        inputBox.focus();
        inputBox.select({ start: 0, end: session.label.length });
        const done = createSingleCallFunction((success, finishEditing) => {
            const value = inputBox.value;
            // Clean up the edit container
            editContainer.style.display = 'none';
            editContainer.remove();
            // Restore the original resource label
            if (existingResourceLabelElement) {
                existingResourceLabelElement.style.display = '';
            }
            // Restore the session content container
            // eslint-disable-next-line no-restricted-syntax
            const sessionContentElement = container.querySelector('.session-content');
            if (sessionContentElement) {
                sessionContentElement.style.display = '';
            }
            if (finishEditing) {
                editableData.onFinish(value, success);
            }
        });
        const showInputBoxNotification = () => {
            if (inputBox.isInputValid()) {
                const message = editableData.validationMessage(inputBox.value);
                if (message) {
                    inputBox.showMessage({
                        content: message.content,
                        formatContent: true,
                        type: message.severity === Severity.Info ? 1 /* MessageType.INFO */ : message.severity === Severity.Warning ? 2 /* MessageType.WARNING */ : 3 /* MessageType.ERROR */
                    });
                }
                else {
                    inputBox.hideMessage();
                }
            }
        };
        showInputBoxNotification();
        const disposables = [
            inputBox,
            DOM.addStandardDisposableListener(inputBox.inputElement, DOM.EventType.KEY_DOWN, (e) => {
                if (e.equals(3 /* KeyCode.Enter */)) {
                    if (!inputBox.validate()) {
                        done(true, true);
                    }
                }
                else if (e.equals(9 /* KeyCode.Escape */)) {
                    done(false, true);
                }
            }),
            DOM.addStandardDisposableListener(inputBox.inputElement, DOM.EventType.KEY_UP, () => {
                showInputBoxNotification();
            }),
            DOM.addDisposableListener(inputBox.inputElement, DOM.EventType.BLUR, async () => {
                while (true) {
                    await timeout(0);
                    const ownerDocument = inputBox.inputElement.ownerDocument;
                    if (!ownerDocument.hasFocus()) {
                        break;
                    }
                    if (DOM.isActiveElement(inputBox.inputElement)) {
                        return;
                    }
                    else if (DOM.isHTMLElement(ownerDocument.activeElement) && DOM.hasParentWithClass(ownerDocument.activeElement, 'context-view')) {
                        // Do nothing - context menu is open
                    }
                    else {
                        break;
                    }
                }
                done(inputBox.isInputValid(), true);
            })
        ];
        const disposableStore = new DisposableStore();
        disposables.forEach(d => disposableStore.add(d));
        disposableStore.add(toDisposable(() => done(false, false)));
        return disposableStore;
    }
    disposeTemplate(templateData) {
        templateData.elementDisposable.dispose();
        templateData.iconLabel.dispose();
        templateData.actionBar.dispose();
    }
};
SessionsRenderer = SessionsRenderer_1 = __decorate([
    __param(1, IContextViewService),
    __param(2, IConfigurationService),
    __param(3, IChatSessionsService),
    __param(4, IMenuService),
    __param(5, IContextKeyService),
    __param(6, IHoverService),
    __param(7, IChatWidgetService),
    __param(8, IChatService),
    __param(9, IEditorGroupsService),
    __param(10, IWorkbenchLayoutService),
    __param(11, IMarkdownRendererService)
], SessionsRenderer);
export { SessionsRenderer };
// Chat sessions item data source for the tree
export class SessionsDataSource {
    constructor(provider, sessionTracker) {
        this.provider = provider;
        this.sessionTracker = sessionTracker;
        // For now call it History until we support archive on all providers
        this.archivedItems = new ArchivedSessionItems(nls.localize('chat.sessions.archivedSessions', 'History'));
    }
    hasChildren(element) {
        if (element === this.provider) {
            // Root provider always has children
            return true;
        }
        if (element instanceof ArchivedSessionItems) {
            return element.getItems().length > 0;
        }
        return false;
    }
    async getChildren(element) {
        if (element === this.provider) {
            try {
                const items = await this.provider.provideChatSessionItems(CancellationToken.None);
                // Clear archived items from previous calls
                this.archivedItems.clear();
                let ungroupedItems = items.map(item => {
                    const itemWithProvider = { ...item, provider: this.provider, timing: { startTime: extractTimestamp(item) ?? 0 } };
                    if (itemWithProvider.archived) {
                        this.archivedItems.pushItem(itemWithProvider);
                        return;
                    }
                    return itemWithProvider;
                }).filter(item => item !== undefined);
                // Add hybrid local editor sessions for this provider
                if (this.provider.chatSessionType !== localChatSessionType) {
                    const hybridSessions = await this.sessionTracker.getHybridSessionsForProvider(this.provider);
                    const existingSessions = new ResourceSet();
                    // Iterate only over the ungrouped items, the only group we support for now is history
                    ungroupedItems.forEach(s => existingSessions.add(s.resource));
                    hybridSessions.forEach(session => {
                        if (!existingSessions.has(session.resource)) {
                            ungroupedItems.push(session);
                            existingSessions.add(session.resource);
                        }
                    });
                    ungroupedItems = processSessionsWithTimeGrouping(ungroupedItems);
                }
                const result = [];
                result.push(...ungroupedItems);
                if (this.archivedItems.getItems().length > 0) {
                    result.push(this.archivedItems);
                }
                return result;
            }
            catch (error) {
                return [];
            }
        }
        if (element instanceof ArchivedSessionItems) {
            return processSessionsWithTimeGrouping(element.getItems());
        }
        // Individual session items don't have children
        return [];
    }
}
export class SessionsDelegate {
    static { this.ITEM_HEIGHT = 22; }
    static { this.ITEM_HEIGHT_WITH_DESCRIPTION = 44; } // Slightly smaller for cleaner look
    constructor(configurationService) {
        this.configurationService = configurationService;
    }
    getHeight(element) {
        // Return consistent height for all items (single-line layout)
        if (this.configurationService.getValue(ChatConfiguration.ShowAgentSessionsViewDescription) && !(element instanceof ArchivedSessionItems) && element.description) {
            return SessionsDelegate.ITEM_HEIGHT_WITH_DESCRIPTION;
        }
        else {
            return SessionsDelegate.ITEM_HEIGHT;
        }
    }
    getTemplateId(element) {
        return SessionsRenderer.TEMPLATE_ID;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Vzc2lvbnNUcmVlUmVuZGVyZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRTZXNzaW9ucy92aWV3L3Nlc3Npb25zVHJlZVJlbmRlcmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLHVDQUF1QyxDQUFDO0FBQzdELE9BQU8sRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFbEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBR3JGLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUNyRixPQUFPLEVBQUUsUUFBUSxFQUFlLE1BQU0sd0RBQXdELENBQUM7QUFHL0YsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUNwRSxPQUFPLEVBQWMsYUFBYSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDckYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDdkYsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFFaEYsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsWUFBWSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDcEgsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRW5FLE9BQU8sUUFBUSxNQUFNLDJDQUEyQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN2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