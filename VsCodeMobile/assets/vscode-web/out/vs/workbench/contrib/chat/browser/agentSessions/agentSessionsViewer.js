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
var AgentSessionRenderer_1;
import './media/agentsessionsviewer.css';
import { h } from '../../../../../base/browser/dom.js';
import { localize } from '../../../../../nls.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { isAgentSession, isAgentSessionsViewModel } from './agentSessionViewModel.js';
import { IconLabel } from '../../../../../base/browser/ui/iconLabel/iconLabel.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { fromNow, getDurationString } from '../../../../../base/common/date.js';
import { createMatches } from '../../../../../base/common/filters.js';
import { IMarkdownRendererService } from '../../../../../platform/markdown/browser/markdownRenderer.js';
import { allowedChatMarkdownHtmlTags } from '../chatContentMarkdownRenderer.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { coalesce } from '../../../../../base/common/arrays.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { fillEditorsDragData } from '../../../../browser/dnd.js';
import { IWorkbenchLayoutService } from '../../../../services/layout/browser/layoutService.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { AGENT_SESSIONS_VIEW_ID } from './agentSessions.js';
import { IntervalTimer } from '../../../../../base/common/async.js';
import { ActionBar } from '../../../../../base/browser/ui/actionbar/actionbar.js';
import { AgentSessionDiffActionViewItem, AgentSessionShowDiffAction } from './agentSessionsActions.js';
let AgentSessionRenderer = class AgentSessionRenderer {
    static { AgentSessionRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'agent-session'; }
    constructor(markdownRendererService, productService, layoutService, viewDescriptorService, hoverService, instantiationService) {
        this.markdownRendererService = markdownRendererService;
        this.productService = productService;
        this.layoutService = layoutService;
        this.viewDescriptorService = viewDescriptorService;
        this.hoverService = hoverService;
        this.instantiationService = instantiationService;
        this.templateId = AgentSessionRenderer_1.TEMPLATE_ID;
    }
    renderTemplate(container) {
        const disposables = new DisposableStore();
        const elementDisposable = disposables.add(new DisposableStore());
        const elements = h('div.agent-session-item@item', [
            h('div.agent-session-icon-col', [
                h('div.agent-session-icon@icon')
            ]),
            h('div.agent-session-main-col', [
                h('div.agent-session-title-row', [
                    h('div.agent-session-title@title'),
                ]),
                h('div.agent-session-details-row', [
                    h('div.agent-session-toolbar@toolbar'),
                    h('div.agent-session-description@description'),
                    h('div.agent-session-status@status')
                ])
            ])
        ]);
        container.appendChild(elements.item);
        const toolbar = disposables.add(new ActionBar(elements.toolbar, {
            actionViewItemProvider: (action, options) => {
                if (action.id === AgentSessionShowDiffAction.ID) {
                    return this.instantiationService.createInstance(AgentSessionDiffActionViewItem, action, options);
                }
                return undefined;
            },
        }));
        return {
            element: elements.item,
            icon: elements.icon,
            title: disposables.add(new IconLabel(elements.title, { supportHighlights: true, supportIcons: true })),
            toolbar,
            description: elements.description,
            status: elements.status,
            elementDisposable,
            disposables
        };
    }
    renderElement(session, index, template, details) {
        // Clear old state
        template.elementDisposable.clear();
        template.toolbar.clear();
        template.description.textContent = '';
        // Icon
        template.icon.className = `agent-session-icon ${ThemeIcon.asClassName(this.getIcon(session.element))}`;
        // Title
        template.title.setLabel(session.element.label, undefined, { matches: createMatches(session.filterData) });
        // Diff if provided and finished
        const { statistics: diff } = session.element;
        if (session.element.status !== 2 /* ChatSessionStatus.InProgress */ && diff && (diff.files > 0 || diff.insertions > 0 || diff.deletions > 0)) {
            const diffAction = template.elementDisposable.add(new AgentSessionShowDiffAction(session.element));
            template.toolbar.push([diffAction], { icon: false, label: true });
        }
        // Description otherwise
        else {
            this.renderDescription(session, template);
        }
        // Status
        this.renderStatus(session, template);
        // Hover
        this.renderHover(session, template);
    }
    getIcon(session) {
        if (session.status === 2 /* ChatSessionStatus.InProgress */) {
            return ThemeIcon.modify(Codicon.loading, 'spin');
        }
        if (session.status === 0 /* ChatSessionStatus.Failed */) {
            return Codicon.error;
        }
        return session.icon;
    }
    renderDescription(session, template) {
        // Support description as string
        if (typeof session.element.description === 'string') {
            template.description.textContent = session.element.description;
        }
        // or as markdown
        else if (session.element.description) {
            template.elementDisposable.add(this.markdownRendererService.render(session.element.description, {
                sanitizerConfig: {
                    replaceWithPlaintext: true,
                    allowedTags: {
                        override: allowedChatMarkdownHtmlTags,
                    },
                    allowedLinkSchemes: { augment: [this.productService.urlProtocol] }
                },
            }, template.description));
        }
        // Fallback to state label
        else {
            if (session.element.status === 2 /* ChatSessionStatus.InProgress */) {
                template.description.textContent = localize('chat.session.status.inProgress', "Working...");
            }
            else if (session.element.timing.finishedOrFailedTime &&
                session.element.timing.inProgressTime &&
                session.element.timing.finishedOrFailedTime > session.element.timing.inProgressTime) {
                const duration = this.toDuration(session.element.timing.inProgressTime, session.element.timing.finishedOrFailedTime);
                template.description.textContent = session.element.status === 0 /* ChatSessionStatus.Failed */ ?
                    localize('chat.session.status.failedAfter', "Failed after {0}.", duration ?? '1s') :
                    localize('chat.session.status.completedAfter', "Finished in {0}.", duration ?? '1s');
            }
            else {
                template.description.textContent = session.element.status === 0 /* ChatSessionStatus.Failed */ ?
                    localize('chat.session.status.failed', "Failed") :
                    localize('chat.session.status.completed', "Finished");
            }
        }
    }
    toDuration(startTime, endTime) {
        const elapsed = Math.round((endTime - startTime) / 1000) * 1000;
        if (elapsed < 1000) {
            return undefined;
        }
        return getDurationString(elapsed);
    }
    renderStatus(session, template) {
        const getStatus = (session) => {
            let timeLabel;
            if (session.status === 2 /* ChatSessionStatus.InProgress */ && session.timing.inProgressTime) {
                timeLabel = this.toDuration(session.timing.inProgressTime, Date.now());
            }
            if (!timeLabel) {
                timeLabel = fromNow(session.timing.endTime || session.timing.startTime, true);
            }
            return `${session.providerLabel} • ${timeLabel}`;
        };
        template.status.textContent = getStatus(session.element);
        const timer = template.elementDisposable.add(new IntervalTimer());
        timer.cancelAndSet(() => template.status.textContent = getStatus(session.element), session.element.status === 2 /* ChatSessionStatus.InProgress */ ? 1000 /* every second */ : 60 * 1000 /* every minute */);
    }
    renderHover(session, template) {
        const tooltip = session.element.tooltip;
        if (tooltip) {
            template.elementDisposable.add(this.hoverService.setupDelayedHover(template.element, () => ({
                content: tooltip,
                style: 1 /* HoverStyle.Pointer */,
                position: {
                    hoverPosition: (() => {
                        const sideBarPosition = this.layoutService.getSideBarPosition();
                        const viewLocation = this.viewDescriptorService.getViewLocationById(AGENT_SESSIONS_VIEW_ID);
                        switch (viewLocation) {
                            case 0 /* ViewContainerLocation.Sidebar */:
                                return sideBarPosition === 0 /* Position.LEFT */ ? 1 /* HoverPosition.RIGHT */ : 0 /* HoverPosition.LEFT */;
                            case 2 /* ViewContainerLocation.AuxiliaryBar */:
                                return sideBarPosition === 0 /* Position.LEFT */ ? 0 /* HoverPosition.LEFT */ : 1 /* HoverPosition.RIGHT */;
                            default:
                                return 1 /* HoverPosition.RIGHT */;
                        }
                    })()
                }
            }), { groupId: 'agent.sessions' }));
        }
    }
    renderCompressedElements(node, index, templateData, details) {
        throw new Error('Should never happen since session is incompressible');
    }
    disposeElement(element, index, template, details) {
        template.elementDisposable.clear();
    }
    disposeTemplate(templateData) {
        templateData.disposables.dispose();
    }
};
AgentSessionRenderer = AgentSessionRenderer_1 = __decorate([
    __param(0, IMarkdownRendererService),
    __param(1, IProductService),
    __param(2, IWorkbenchLayoutService),
    __param(3, IViewDescriptorService),
    __param(4, IHoverService),
    __param(5, IInstantiationService)
], AgentSessionRenderer);
export { AgentSessionRenderer };
export class AgentSessionsListDelegate {
    static { this.ITEM_HEIGHT = 44; }
    getHeight(element) {
        return AgentSessionsListDelegate.ITEM_HEIGHT;
    }
    getTemplateId(element) {
        return AgentSessionRenderer.TEMPLATE_ID;
    }
}
export class AgentSessionsAccessibilityProvider {
    getWidgetAriaLabel() {
        return localize('agentSessions', "Agent Sessions");
    }
    getAriaLabel(element) {
        return element.label;
    }
}
export class AgentSessionsDataSource {
    hasChildren(element) {
        return isAgentSessionsViewModel(element);
    }
    getChildren(element) {
        if (!isAgentSessionsViewModel(element)) {
            return [];
        }
        return element.sessions;
    }
}
export class AgentSessionsIdentityProvider {
    getId(element) {
        if (isAgentSession(element)) {
            return element.resource.toString();
        }
        return 'agent-sessions-id';
    }
}
export class AgentSessionsCompressionDelegate {
    isIncompressible(element) {
        return true;
    }
}
export class AgentSessionsSorter {
    compare(sessionA, sessionB) {
        const aInProgress = sessionA.status === 2 /* ChatSessionStatus.InProgress */;
        const bInProgress = sessionB.status === 2 /* ChatSessionStatus.InProgress */;
        if (aInProgress && !bInProgress) {
            return -1; // a (in-progress) comes before b (finished)
        }
        if (!aInProgress && bInProgress) {
            return 1; // a (finished) comes after b (in-progress)
        }
        // Both in-progress or finished: sort by end or start time (most recent first)
        return (sessionB.timing.endTime || sessionB.timing.startTime) - (sessionA.timing.endTime || sessionA.timing.startTime);
    }
}
export class AgentSessionsKeyboardNavigationLabelProvider {
    getKeyboardNavigationLabel(element) {
        return element.label;
    }
    getCompressedNodeKeyboardNavigationLabel(elements) {
        return undefined; // not enabled
    }
}
let AgentSessionsDragAndDrop = class AgentSessionsDragAndDrop extends Disposable {
    constructor(instantiationService) {
        super();
        this.instantiationService = instantiationService;
    }
    onDragStart(data, originalEvent) {
        const elements = data.getData();
        const uris = coalesce(elements.map(e => e.resource));
        this.instantiationService.invokeFunction(accessor => fillEditorsDragData(accessor, uris, originalEvent));
    }
    getDragURI(element) {
        return element.resource.toString();
    }
    getDragLabel(elements, originalEvent) {
        if (elements.length === 1) {
            return elements[0].label;
        }
        return localize('agentSessions.dragLabel', "{0} agent sessions", elements.length);
    }
    onDragOver(data, targetElement, targetIndex, targetSector, originalEvent) {
        return false;
    }
    drop(data, targetElement, targetIndex, targetSector, originalEvent) { }
};
AgentSessionsDragAndDrop = __decorate([
    __param(0, IInstantiationService)
], AgentSessionsDragAndDrop);
export { AgentSessionsDragAndDrop };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRTZXNzaW9uc1ZpZXdlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWdlbnRTZXNzaW9ucy9hZ2VudFNlc3Npb25zVmlld2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLGlDQUFpQyxDQUFDO0FBQ3pDLE9BQU8sRUFBRSxDQUFDLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUN2RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFPakQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNuRyxPQUFPLEVBQW1ELGNBQWMsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ3ZJLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNsRixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDcEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUNoRixPQUFPLEVBQWMsYUFBYSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDbEYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sOERBQThELENBQUM7QUFDeEcsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBRzNGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNoRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFP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