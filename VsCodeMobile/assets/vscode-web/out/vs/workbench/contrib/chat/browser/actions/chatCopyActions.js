/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as dom from '../../../../../base/browser/dom.js';
import { localize2 } from '../../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { katexContainerClassName, katexContainerLatexAttributeName } from '../../../markdown/common/markedKatexExtension.js';
import { ChatContextKeys } from '../../common/chatContextKeys.js';
import { isChatTreeItem, isRequestVM, isResponseVM } from '../../common/chatViewModel.js';
import { IChatWidgetService } from '../chat.js';
import { CHAT_CATEGORY, stringifyItem } from './chatActions.js';
export function registerChatCopyActions() {
    registerAction2(class CopyAllAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.copyAll',
                title: localize2('interactive.copyAll.label', "Copy All"),
                f1: false,
                category: CHAT_CATEGORY,
                menu: {
                    id: MenuId.ChatContext,
                    when: ChatContextKeys.responseIsFiltered.negate(),
                    group: 'copy',
                }
            });
        }
        run(accessor, context) {
            const clipboardService = accessor.get(IClipboardService);
            const chatWidgetService = accessor.get(IChatWidgetService);
            const widget = (context?.sessionResource && chatWidgetService.getWidgetBySessionResource(context.sessionResource)) || chatWidgetService.lastFocusedWidget;
            if (widget) {
                const viewModel = widget.viewModel;
                const sessionAsText = viewModel?.getItems()
                    .filter((item) => isRequestVM(item) || (isResponseVM(item) && !item.errorDetails?.responseIsFiltered))
                    .map(item => stringifyItem(item))
                    .join('\n\n');
                if (sessionAsText) {
                    clipboardService.writeText(sessionAsText);
                }
            }
        }
    });
    registerAction2(class CopyItemAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.copyItem',
                title: localize2('interactive.copyItem.label', "Copy"),
                f1: false,
                category: CHAT_CATEGORY,
                menu: {
                    id: MenuId.ChatContext,
                    when: ChatContextKeys.responseIsFiltered.negate(),
                    group: 'copy',
                }
            });
        }
        async run(accessor, ...args) {
            const chatWidgetService = accessor.get(IChatWidgetService);
            const clipboardService = accessor.get(IClipboardService);
            const widget = chatWidgetService.lastFocusedWidget;
            let item = args[0];
            if (!isChatTreeItem(item)) {
                item = widget?.getFocus();
                if (!item) {
                    return;
                }
            }
            // If there is a text selection, and focus is inside the widget, copy the selected text.
            // Otherwise, context menu with no selection -> copy the full item
            const nativeSelection = dom.getActiveWindow().getSelection();
            const selectedText = nativeSelection?.toString();
            if (widget && selectedText && selectedText.length > 0 && dom.isAncestor(dom.getActiveElement(), widget.domNode)) {
                await clipboardService.writeText(selectedText);
                return;
            }
            const text = stringifyItem(item, false);
            await clipboardService.writeText(text);
        }
    });
    registerAction2(class CopyKatexMathSourceAction extends Action2 {
        constructor() {
            super({
                id: 'workbench.action.chat.copyKatexMathSource',
                title: localize2('chat.copyKatexMathSource.label', "Copy Math Source"),
                f1: false,
                category: CHAT_CATEGORY,
                menu: {
                    id: MenuId.ChatContext,
                    group: 'copy',
                    when: ChatContextKeys.isKatexMathElement,
                }
            });
        }
        async run(accessor, ...args) {
            const chatWidgetService = accessor.get(IChatWidgetService);
            const clipboardService = accessor.get(IClipboardService);
            const widget = chatWidgetService.lastFocusedWidget;
            let item = args[0];
            if (!isChatTreeItem(item)) {
                item = widget?.getFocus();
                if (!item) {
                    return;
                }
            }
            // Try to find a KaTeX element from the selection or active element
            let selectedElement = null;
            // If there is a selection, and focus is inside the widget, extract the inner KaTeX element.
            const activeElement = dom.getActiveElement();
            const nativeSelection = dom.getActiveWindow().getSelection();
            if (widget && nativeSelection && nativeSelection.rangeCount > 0 && dom.isAncestor(activeElement, widget.domNode)) {
                const range = nativeSelection.getRangeAt(0);
                selectedElement = range.commonAncestorContainer;
                // If it's a text node, get its parent element
                if (selectedElement.nodeType === Node.TEXT_NODE) {
                    selectedElement = selectedElement.parentElement;
                }
            }
            // Otherwise, fallback to querying from the active element
            if (!selectedElement) {
                // eslint-disable-next-line no-restricted-syntax
                selectedElement = activeElement?.querySelector(`.${katexContainerClassName}`) ?? null;
            }
            // Extract the LaTeX source from the annotation element
            const katexElement = dom.isHTMLElement(selectedElement) ? selectedElement.closest(`.${katexContainerClassName}`) : null;
            const latexSource = katexElement?.getAttribute(katexContainerLatexAttributeName) || '';
            if (latexSource) {
                await clipboardService.writeText(latexSource);
            }
        }
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdENvcHlBY3Rpb25zLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9hY3Rpb25zL2NoYXRDb3B5QWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9DQUFvQyxDQUFDO0FBRTFELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNsRCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNyRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUNqRyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM3SCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDbEUsT0FBTyxFQUFpRCxjQUFjLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3pJLE9BQU8sRUFBZ0Isa0JBQWtCLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDOUQsT0FBTyxFQUFFLGFBQWEsRUFBRSxhQUFhLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUVoRSxNQUFNLFVBQVUsdUJBQXVCO0lBQ3RDLGVBQWUsQ0FBQyxNQUFNLGFBQWMsU0FBUSxPQUFPO1FBQ2xEO1lBQ0MsS0FBSyxDQUFDO2dCQUNMLEVBQUUsRUFBRSwrQkFBK0I7Z0JBQ25DLEtBQUssRUFBRSxTQUFTLENBQUMsMkJBQTJCLEVBQUUsVUFBVSxDQUFDO2dCQUN6RCxFQUFFLEVBQUUsS0FBSztnQkFDVCxRQUFRLEVBQUUsYUFBYTtnQkFDdkIsSUFBSSxFQUFFO29CQUNMLEVBQUUsRUFBRSxNQUFNLENBQUMsV0FBVztvQkFDdEIs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