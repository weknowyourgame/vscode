/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { ActiveEditorContext } from '../../../../common/contextkeys.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { ACTIVE_GROUP, AUX_WINDOW_GROUP, IEditorService } from '../../../../services/editor/common/editorService.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { isChatViewTitleActionContext } from '../../common/chatActions.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { ChatAgentLocation } from '../../common/constants.js';
import { ChatViewId, IChatWidgetService } from '../chat.js';
import { ChatEditor } from '../chatEditor.js';
import { ChatEditorInput } from '../chatEditorInput.js';
import { CHAT_CATEGORY } from './chatActions.js';
var MoveToNewLocation;
(function (MoveToNewLocation) {
    MoveToNewLocation["Editor"] = "Editor";
    MoveToNewLocation["Window"] = "Window";
})(MoveToNewLocation || (MoveToNewLocation = {}));
export function registerMoveActions() {
    registerAction2(class GlobalMoveToEditorAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.openInEditor',
                title: localize2('chat.openInEditor.label', "Move Chat into Editor Area"),
                category: CHAT_CATEGORY,
                precondition: ChatContextKeys.enabled,
                f1: true,
                menu: {
                    id: MenuId.ViewTitle,
                    when: ContextKeyExpr.equals('view', ChatViewId),
                    order: 0,
                    group: '1_open'
                },
            });
        }
        async run(accessor, ...args) {
            const context = args[0];
            executeMoveToAction(accessor, MoveToNewLocation.Editor, isChatViewTitleActionContext(context) ? context.sessionResource : undefined);
        }
    });
    registerAction2(class GlobalMoveToNewWindowAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.openInNewWindow',
                title: localize2('chat.openInNewWindow.label', "Move Chat into New Window"),
                category: CHAT_CATEGORY,
                precondition: ChatContextKeys.enabled,
                f1: true,
                menu: {
                    id: MenuId.ViewTitle,
                    when: ContextKeyExpr.equals('view', ChatViewId),
                    order: 0,
                    group: '1_open'
                },
            });
        }
        async run(accessor, ...args) {
            const context = args[0];
            executeMoveToAction(accessor, MoveToNewLocation.Window, isChatViewTitleActionContext(context) ? context.sessionResource : undefined);
        }
    });
    registerAction2(class GlobalMoveToSidebarAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.openInSidebar',
                title: localize2('interactiveSession.openInSidebar.label', "Move Chat into Side Bar"),
                category: CHAT_CATEGORY,
                precondition: ChatContextKeys.enabled,
                f1: true
            });
        }
        async run(accessor, ...args) {
            return moveToSidebar(accessor);
        }
    });
    function appendOpenChatInViewMenuItem(menuId, title, icon, locationContextKey) {
        MenuRegistry.appendMenuItem(menuId, {
            command: { id: 'workbench.action.chat.openInSidebar', title, icon },
            when: ContextKeyExpr.and(ActiveEditorContext.isEqualTo(ChatEditorInput.EditorID), locationContextKey),
            group: menuId === MenuId.CompactWindowEditorTitle ? 'navigation' : undefined,
            order: 0
        });
    }
    [MenuId.EditorTitle, MenuId.CompactWindowEditorTitle].forEach(id => {
        appendOpenChatInViewMenuItem(id, localize('interactiveSession.openInSecondarySidebar.label', "Move Chat into Secondary Side Bar"), Codicon.layoutSidebarRightDock, ChatContextKeys.panelLocation.isEqualTo(2 /* ViewContainerLocation.AuxiliaryBar */));
        appendOpenChatInViewMenuItem(id, localize('interactiveSession.openInPrimarySidebar.label', "Move Chat into Primary Side Bar"), Codicon.layoutSidebarLeftDock, ChatContextKeys.panelLocation.isEqualTo(0 /* ViewContainerLocation.Sidebar */));
        appendOpenChatInViewMenuItem(id, localize('interactiveSession.openInPanel.label', "Move Chat into Panel"), Codicon.layoutPanelDock, ChatContextKeys.panelLocation.isEqualTo(1 /* ViewContainerLocation.Panel */));
    });
}
async function executeMoveToAction(accessor, moveTo, sessionResource) {
    const widgetService = accessor.get(IChatWidgetService);
    const editorService = accessor.get(IEditorService);
    const auxiliary = { compact: true, bounds: { width: 800, height: 640 } };
    const widget = (sessionResource ? widgetService.getWidgetBySessionResource(sessionResource) : undefined)
        ?? widgetService.lastFocusedWidget;
    if (!widget || !widget.viewModel || widget.location !== ChatAgentLocation.Chat) {
        await editorService.openEditor({ resource: ChatEditorInput.getNewEditorUri(), options: { pinned: true, auxiliary } }, moveTo === MoveToNewLocation.Window ? AUX_WINDOW_GROUP : ACTIVE_GROUP);
        return;
    }
    const existingWidget = widgetService.getWidgetBySessionResource(widget.viewModel.sessionResource);
    if (!existingWidget) {
        // Do NOT attempt to open a session that isn't already open since we cannot guarantee its state.
        await editorService.openEditor({ resource: ChatEditorInput.getNewEditorUri(), options: { pinned: true, auxiliary } }, moveTo === MoveToNewLocation.Window ? AUX_WINDOW_GROUP : ACTIVE_GROUP);
        return;
    }
    // Save off the session resource before clearing
    const resourceToOpen = widget.viewModel.sessionResource;
    // Todo: can possibly go away with https://github.com/microsoft/vscode/pull/278476
    const modelInputState = existingWidget.getViewState();
    await widget.clear();
    const options = { pinned: true, modelInputState, auxiliary };
    await editorService.openEditor({ resource: resourceToOpen, options }, moveTo === MoveToNewLocation.Window ? AUX_WINDOW_GROUP : ACTIVE_GROUP);
}
async function moveToSidebar(accessor) {
    const viewsService = accessor.get(IViewsService);
    const editorService = accessor.get(IEditorService);
    const editorGroupService = accessor.get(IEditorGroupsService);
    const chatEditor = editorService.activeEditorPane;
    const chatEditorInput = chatEditor?.input;
    let view;
    if (chatEditor instanceof ChatEditor && chatEditorInput instanceof ChatEditorInput && chatEditorInput.sessionResource) {
        const previousViewState = chatEditor.widget.getViewState();
        await editorService.closeEditor({ editor: chatEditor.input, groupId: editorGroupService.activeGroup.id });
        view = await viewsService.openView(ChatViewId);
        // Todo: can possibly go away with https://github.com/microsoft/vscode/pull/278476
        const newModel = await view.loadSession(chatEditorInput.sessionResource);
        if (previousViewState && newModel && !newModel.inputModel.state.get()) {
            newModel.inputModel.setState(previousViewState);
        }
    }
    else {
        view = await viewsService.openView(ChatViewId);
    }
    view.focus();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1vdmVBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9hY3Rpb25zL2NoYXRNb3ZlQWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFHakUsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbkgsT0FBTyxFQUFFLGNBQWMsRUFBd0IsTUFBTSx5REFBeUQsQ0FBQztBQUUvRyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUV4RSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUNqRyxPQUFPLEVBQUUsWUFBWSxFQUFFLGdCQUFnQixFQUFFLGNBQWMsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3JILE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNsRixPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUMzRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDOUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUM1RCxPQUFPLEVBQUUsVUFBVSxFQUFzQixNQUFNLGtCQUFrQixDQUFDO0FBQ2xFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUV4RCxPQUFPLEVBQUUs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