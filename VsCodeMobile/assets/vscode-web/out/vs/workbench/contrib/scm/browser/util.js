/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { MenuItemAction } from '../../../../platform/actions/common/actions.js';
import { Action } from '../../../../base/common/actions.js';
import { createActionViewItem, getActionBarActions, getContextMenuActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { equals } from '../../../../base/common/arrays.js';
import { ActionViewItem } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { renderLabelWithIcons } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { reset } from '../../../../base/browser/dom.js';
import { ResourceTree } from '../../../../base/common/resourceTree.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Codicon } from '../../../../base/common/codicons.js';
export function isSCMViewService(element) {
    return Array.isArray(element.repositories) && Array.isArray(element.visibleRepositories);
}
export function isSCMRepository(element) {
    return !!element.provider && !!element.input;
}
export function isSCMInput(element) {
    return !!element.validateInput && typeof element.value === 'string';
}
export function isSCMActionButton(element) {
    return element.type === 'actionButton';
}
export function isSCMResourceGroup(element) {
    return !!element.provider && !!element.resources;
}
export function isSCMResource(element) {
    return !!element.sourceUri && isSCMResourceGroup(element.resourceGroup);
}
export function isSCMResourceNode(element) {
    return ResourceTree.isResourceNode(element) && isSCMResourceGroup(element.context);
}
export function isSCMHistoryItemViewModelTreeElement(element) {
    return element.type === 'historyItemViewModel';
}
export function isSCMHistoryItemLoadMoreTreeElement(element) {
    return element.type === 'historyItemLoadMore';
}
export function isSCMHistoryItemChangeViewModelTreeElement(element) {
    return element.type === 'historyItemChangeViewModel';
}
export function isSCMHistoryItemChangeNode(element) {
    return ResourceTree.isResourceNode(element) && isSCMHistoryItemViewModelTreeElement(element.context);
}
export function isSCMArtifactGroupTreeElement(element) {
    return element.type === 'artifactGroup';
}
export function isSCMArtifactNode(element) {
    return ResourceTree.isResourceNode(element) && isSCMArtifactGroupTreeElement(element.context);
}
export function isSCMArtifactTreeElement(element) {
    return element.type === 'artifact';
}
const compareActions = (a, b) => {
    if (a instanceof MenuItemAction && b instanceof MenuItemAction) {
        return a.id === b.id && a.enabled === b.enabled && a.hideActions?.isHidden === b.hideActions?.isHidden;
    }
    return a.id === b.id && a.enabled === b.enabled;
};
export function connectPrimaryMenu(menu, callback, primaryGroup, arg) {
    let cachedPrimary = [];
    let cachedSecondary = [];
    const updateActions = () => {
        const { primary, secondary } = getActionBarActions(menu.getActions({ arg, shouldForwardArgs: true }), primaryGroup);
        if (equals(cachedPrimary, primary, compareActions) && equals(cachedSecondary, secondary, compareActions)) {
            return;
        }
        cachedPrimary = primary;
        cachedSecondary = secondary;
        callback(primary, secondary);
    };
    updateActions();
    return menu.onDidChange(updateActions);
}
export function collectContextMenuActions(menu, arg) {
    return getContextMenuActions(menu.getActions({ arg, shouldForwardArgs: true }), 'inline').secondary;
}
export class StatusBarAction extends Action {
    constructor(command, commandService) {
        super(`statusbaraction{${command.id}}`, getStatusBarCommandGenericName(command), '', true);
        this.command = command;
        this.commandService = commandService;
        this.commandTitle = command.title;
        this.tooltip = command.tooltip || '';
    }
    run() {
        return this.commandService.executeCommand(this.command.id, ...(this.command.arguments || []));
    }
}
class StatusBarActionViewItem extends ActionViewItem {
    constructor(action, options) {
        super(null, action, { ...options, icon: false, label: true });
        this._commandTitle = action.commandTitle;
    }
    render(container) {
        container.classList.add('scm-status-bar-action');
        super.render(container);
    }
    updateLabel() {
        if (this.options.label && this.label) {
            // Convert text nodes to span elements to enable
            // text overflow on the left hand side of the label
            const elements = renderLabelWithIcons(this._commandTitle ?? this.action.label)
                .map(element => {
                if (typeof element === 'string') {
                    const span = document.createElement('span');
                    span.textContent = element;
                    return span;
                }
                return element;
            });
            reset(this.label, ...elements);
        }
    }
}
export function getActionViewItemProvider(instaService) {
    return (action, options) => {
        if (action instanceof StatusBarAction) {
            return new StatusBarActionViewItem(action, options);
        }
        return createActionViewItem(instaService, action, options);
    };
}
export function getProviderKey(provider) {
    return `${provider.providerId}:${provider.label}${provider.rootUri ? `:${provider.rootUri.toString()}` : ''}`;
}
export function getRepositoryResourceCount(provider) {
    return provider.groups.reduce((r, g) => r + g.resources.length, 0);
}
export function getHistoryItemEditorTitle(historyItem) {
    return `${historyItem.displayId ?? historyItem.id} - ${historyItem.subject}`;
}
export function getSCMRepositoryIcon(activeRepository, repository) {
    if (!ThemeIcon.isThemeIcon(repository.provider.iconPath)) {
        return Codicon.repo;
    }
    if (activeRepository?.pinned === true &&
        activeRepository?.repository.id === repository.id &&
        repository.provider.iconPath.id === Codicon.repo.id) {
        return Codicon.repoPinned;
    }
    return repository.provider.iconPath;
}
export function getStatusBarCommandGenericName(command) {
    let genericName = undefined;
    // Get a generic name for the status bar action, derive this from the first
    // command argument which is in the form of "<extension>.<command>/<number>"
    if (typeof command.arguments?.[0] === 'string') {
        const lastIndex = command.arguments[0].lastIndexOf('/');
        genericName = lastIndex !== -1
            ? command.arguments[0].substring(0, lastIndex)
            : command.arguments[0];
        genericName = genericName
            .replace(/^(?:git\.|remoteHub\.)/, '')
            .trim();
        if (genericName.length === 0) {
            return undefined;
        }
        // Capitalize first letter
        genericName = genericName[0].toLocaleUpperCase() + genericName.slice(1);
    }
    return genericName;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9zY20vYnJvd3Nlci91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBSWhHLE9BQU8sRUFBUyxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUd2RixPQUFPLEVBQUUsTUFBTSxFQUFXLE1BQU0sb0NBQW9DLENBQUM7QUFDckUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLG1CQUFtQixFQUFFLHFCQUFxQixFQUFFLE1BQU0saUVBQWlFLENBQUM7QUFDbkosT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxjQUFjLEVBQThCLE1BQU0sMERBQTBELENBQUM7QUFDdEgsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0scURBQXFELENBQUM7QUFHM0YsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRXhELE9BQU8sRUFBaUIsWUFBWSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDdEYsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUc5RCxNQUFNLFVBQVUsZ0JBQWdCLENBQUMsT0FBZ0I7SUFDaEQsT0FBTyxLQUFLLENBQUMsT0FBTyxDQUFFLE9BQTJCLENBQUMsWUFBWSxDQUFDLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBRSxPQUEyQixDQUFDLG1CQUFtQixDQUFDLENBQUM7QUFDcEksQ0FBQztBQUVELE1BQU0sVUFBVSxlQUFlLENBQUMsT0FBZ0I7SUFDL0MsT0FBTyxDQUFDLENBQUUsT0FBMEIsQ0FBQyxRQUFRLElBQUksQ0FBQyxDQUFFLE9BQTBCLENBQUMsS0FBSyxDQUFDO0FBQ3RGLENBQUM7QUFFRCxN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