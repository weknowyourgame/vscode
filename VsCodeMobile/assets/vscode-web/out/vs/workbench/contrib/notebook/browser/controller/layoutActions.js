/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Codicon } from '../../../../../base/common/codicons.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../../nls.js';
import { Categories } from '../../../../../platform/action/common/actionCommonCategories.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { NOTEBOOK_ACTIONS_CATEGORY } from './coreActions.js';
import { getNotebookEditorFromEditorPane } from '../notebookBrowser.js';
import { INotebookEditorService } from '../services/notebookEditorService.js';
import { NotebookSetting } from '../../common/notebookCommon.js';
import { NOTEBOOK_EDITOR_FOCUSED, NOTEBOOK_IS_ACTIVE_EDITOR } from '../../common/notebookContextKeys.js';
import { INotebookService } from '../../common/notebookService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IPreferencesService } from '../../../../services/preferences/common/preferences.js';
registerAction2(class NotebookConfigureLayoutAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.notebook.layout.select',
            title: localize2('workbench.notebook.layout.select.label', "Select between Notebook Layouts"),
            f1: true,
            precondition: ContextKeyExpr.equals(`config.${NotebookSetting.openGettingStarted}`, true),
            category: NOTEBOOK_ACTIONS_CATEGORY,
            menu: [
                {
                    id: MenuId.EditorTitle,
                    group: 'notebookLayout',
                    when: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, ContextKeyExpr.notEquals('config.notebook.globalToolbar', true), ContextKeyExpr.equals(`config.${NotebookSetting.openGettingStarted}`, true)),
                    order: 0
                },
                {
                    id: MenuId.NotebookToolbar,
                    group: 'notebookLayout',
                    when: ContextKeyExpr.and(ContextKeyExpr.equals('config.notebook.globalToolbar', true), ContextKeyExpr.equals(`config.${NotebookSetting.openGettingStarted}`, true)),
                    order: 0
                }
            ]
        });
    }
    run(accessor) {
        accessor.get(ICommandService).executeCommand('workbench.action.openWalkthrough', { category: 'notebooks', step: 'notebookProfile' }, true);
    }
});
registerAction2(class NotebookConfigureLayoutAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.notebook.layout.configure',
            title: localize2('workbench.notebook.layout.configure.label', "Customize Notebook Layout"),
            f1: true,
            category: NOTEBOOK_ACTIONS_CATEGORY,
            menu: [
                {
                    id: MenuId.NotebookToolbar,
                    group: 'notebookLayout',
                    when: ContextKeyExpr.equals('config.notebook.globalToolbar', true),
                    order: 1
                }
            ]
        });
    }
    run(accessor) {
        accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: '@tag:notebookLayout' });
    }
});
registerAction2(class NotebookConfigureLayoutFromEditorTitle extends Action2 {
    constructor() {
        super({
            id: 'workbench.notebook.layout.configure.editorTitle',
            title: localize2('workbench.notebook.layout.configure.label', "Customize Notebook Layout"),
            f1: false,
            category: NOTEBOOK_ACTIONS_CATEGORY,
            menu: [
                {
                    id: MenuId.NotebookEditorLayoutConfigure,
                    group: 'notebookLayout',
                    when: NOTEBOOK_IS_ACTIVE_EDITOR,
                    order: 1
                }
            ]
        });
    }
    run(accessor) {
        accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: '@tag:notebookLayout' });
    }
});
MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
    submenu: MenuId.NotebookEditorLayoutConfigure,
    title: localize2('customizeNotebook', "Customize Notebook..."),
    icon: Codicon.gear,
    group: 'navigation',
    order: -1,
    when: NOTEBOOK_IS_ACTIVE_EDITOR
});
registerAction2(class ToggleLineNumberFromEditorTitle extends Action2 {
    constructor() {
        super({
            id: 'notebook.toggleLineNumbersFromEditorTitle',
            title: localize2('notebook.toggleLineNumbers', 'Toggle Notebook Line Numbers'),
            precondition: NOTEBOOK_EDITOR_FOCUSED,
            menu: [
                {
                    id: MenuId.NotebookEditorLayoutConfigure,
                    group: 'notebookLayoutDetails',
                    order: 1,
                    when: NOTEBOOK_IS_ACTIVE_EDITOR
                }
            ],
            category: NOTEBOOK_ACTIONS_CATEGORY,
            f1: true,
            toggled: {
                condition: ContextKeyExpr.notEquals('config.notebook.lineNumbers', 'off'),
                title: localize('notebook.showLineNumbers', "Notebook Line Numbers"),
            }
        });
    }
    async run(accessor) {
        return accessor.get(ICommandService).executeCommand('notebook.toggleLineNumbers');
    }
});
registerAction2(class ToggleCellToolbarPositionFromEditorTitle extends Action2 {
    constructor() {
        super({
            id: 'notebook.toggleCellToolbarPositionFromEditorTitle',
            title: localize2('notebook.toggleCellToolbarPosition', 'Toggle Cell Toolbar Position'),
            menu: [{
                    id: MenuId.NotebookEditorLayoutConfigure,
                    group: 'notebookLayoutDetails',
                    order: 3
                }],
            category: NOTEBOOK_ACTIONS_CATEGORY,
            f1: false
        });
    }
    async run(accessor, ...args) {
        return accessor.get(ICommandService).executeCommand('notebook.toggleCellToolbarPosition', ...args);
    }
});
registerAction2(class ToggleBreadcrumbFromEditorTitle extends Action2 {
    constructor() {
        super({
            id: 'breadcrumbs.toggleFromEditorTitle',
            title: localize2('notebook.toggleBreadcrumb', 'Toggle Breadcrumbs'),
            menu: [{
                    id: MenuId.NotebookEditorLayoutConfigure,
                    group: 'notebookLayoutDetails',
                    order: 2
                }],
            f1: false
        });
    }
    async run(accessor) {
        return accessor.get(ICommandService).executeCommand('breadcrumbs.toggle');
    }
});
registerAction2(class SaveMimeTypeDisplayOrder extends Action2 {
    constructor() {
        super({
            id: 'notebook.saveMimeTypeOrder',
            title: localize2('notebook.saveMimeTypeOrder', "Save Mimetype Display Order"),
            f1: true,
            category: NOTEBOOK_ACTIONS_CATEGORY,
            precondition: NOTEBOOK_IS_ACTIVE_EDITOR,
        });
    }
    run(accessor) {
        const service = accessor.get(INotebookService);
        const disposables = new DisposableStore();
        const qp = disposables.add(accessor.get(IQuickInputService).createQuickPick());
        qp.placeholder = localize('notebook.placeholder', 'Settings file to save in');
        qp.items = [
            { target: 2 /* ConfigurationTarget.USER */, label: localize('saveTarget.machine', 'User Settings') },
            { target: 5 /* ConfigurationTarget.WORKSPACE */, label: localize('saveTarget.workspace', 'Workspace Settings') },
        ];
        disposables.add(qp.onDidAccept(() => {
            const target = qp.selectedItems[0]?.target;
            if (target !== undefined) {
                service.saveMimeDisplayOrder(target);
            }
            qp.dispose();
        }));
        disposables.add(qp.onDidHide(() => disposables.dispose()));
        qp.show();
    }
});
registerAction2(class NotebookWebviewResetAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.notebook.layout.webview.reset',
            title: localize2('workbench.notebook.layout.webview.reset.label', "Reset Notebook Webview"),
            f1: false,
            category: NOTEBOOK_ACTIONS_CATEGORY
        });
    }
    run(accessor, args) {
        const editorService = accessor.get(IEditorService);
        if (args) {
            const uri = URI.revive(args);
            const notebookEditorService = accessor.get(INotebookEditorService);
            const widgets = notebookEditorService.listNotebookEditors().filter(widget => widget.hasModel() && widget.textModel.uri.toString() === uri.toString());
            for (const widget of widgets) {
                if (widget.hasModel()) {
                    widget.getInnerWebview()?.reload();
                }
            }
        }
        else {
            const editor = getNotebookEditorFromEditorPane(editorService.activeEditorPane);
            if (!editor) {
                return;
            }
            editor.getInnerWebview()?.reload();
        }
    }
});
registerAction2(class ToggleNotebookStickyScroll extends Action2 {
    constructor() {
        super({
            id: 'notebook.action.toggleNotebookStickyScroll',
            title: {
                ...localize2('toggleStickyScroll', "Toggle Notebook Sticky Scroll"),
                mnemonicTitle: localize({ key: 'mitoggleNotebookStickyScroll', comment: ['&& denotes a mnemonic'] }, "&&Toggle Notebook Sticky Scroll"),
            },
            category: Categories.View,
            toggled: {
                condition: ContextKeyExpr.equals('config.notebook.stickyScroll.enabled', true),
                title: localize('notebookStickyScroll', "Toggle Notebook Sticky Scroll"),
                mnemonicTitle: localize({ key: 'mitoggleNotebookStickyScroll', comment: ['&& denotes a mnemonic'] }, "&&Toggle Notebook Sticky Scroll"),
            },
            menu: [
                { id: MenuId.CommandPalette },
                { id: MenuId.NotebookStickyScrollContext, group: 'notebookView', order: 2 },
                { id: MenuId.NotebookToolbarContext, group: 'notebookView', order: 2 }
            ]
        });
    }
    async run(accessor) {
        const configurationService = accessor.get(IConfigurationService);
        const newValue = !configurationService.getValue('notebook.stickyScroll.enabled');
        return configurationService.updateValue('notebook.stickyScroll.enabled', newValue);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5b3V0QWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyb2xsZXIvbGF5b3V0QWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxHQUFHLEVBQWlCLE1BQU0sbUNBQW1DLENBQUM7QUFDdkUsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUM1RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0saUVBQWlFLENBQUM7QUFDN0YsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ25ILE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN0RixPQUFPLEVBQXVCLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDM0gsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBRXpGLE9BQU8sRUFBRSxrQkFBa0IsRUFBa0IsTUFBTSx5REFBeUQsQ0FBQztBQUM3RyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUM3RCxPQUFPLEVBQUUsK0JBQStCLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUN4RSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUM5RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDakUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLHlCQUF5QixFQUFFLE1B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