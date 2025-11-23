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
import { localize, localize2 } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { EditorExtensions } from '../../../common/editor.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../services/editor/common/editorResolverService.js';
import { ProcessExplorerEditorInput } from './processExplorerEditorInput.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { AUX_WINDOW_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IAuxiliaryWindowService } from '../../../services/auxiliaryWindow/browser/auxiliaryWindowService.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { RemoteNameContext } from '../../../common/contextkeys.js';
import { IsWebContext } from '../../../../platform/contextkey/common/contextkeys.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
//#region --- process explorer
let ProcessExplorerEditorContribution = class ProcessExplorerEditorContribution {
    static { this.ID = 'workbench.contrib.processExplorerEditor'; }
    constructor(editorResolverService, instantiationService) {
        editorResolverService.registerEditor(`${ProcessExplorerEditorInput.RESOURCE.scheme}:**/**`, {
            id: ProcessExplorerEditorInput.ID,
            label: localize('promptOpenWith.processExplorer.displayName', "Process Explorer"),
            priority: RegisteredEditorPriority.exclusive
        }, {
            singlePerResource: true,
            canSupportResource: resource => resource.scheme === ProcessExplorerEditorInput.RESOURCE.scheme
        }, {
            createEditorInput: () => {
                return {
                    editor: instantiationService.createInstance(ProcessExplorerEditorInput),
                    options: {
                        pinned: true
                    }
                };
            }
        });
    }
};
ProcessExplorerEditorContribution = __decorate([
    __param(0, IEditorResolverService),
    __param(1, IInstantiationService)
], ProcessExplorerEditorContribution);
registerWorkbenchContribution2(ProcessExplorerEditorContribution.ID, ProcessExplorerEditorContribution, 1 /* WorkbenchPhase.BlockStartup */);
class ProcessExplorerEditorInputSerializer {
    canSerialize(editorInput) {
        return true;
    }
    serialize(editorInput) {
        return '';
    }
    deserialize(instantiationService) {
        return ProcessExplorerEditorInput.instance;
    }
}
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(ProcessExplorerEditorInput.ID, ProcessExplorerEditorInputSerializer);
//#endregion
//#region --- process explorer commands
const supported = ContextKeyExpr.or(IsWebContext.negate(), RemoteNameContext.notEqualsTo('')); // only on desktop or in web with a remote
class OpenProcessExplorer extends Action2 {
    static { this.ID = 'workbench.action.openProcessExplorer'; }
    static { this.STATE_KEY = 'workbench.processExplorerWindowState'; }
    static { this.DEFAULT_STATE = { bounds: { width: 800, height: 500 } }; }
    constructor() {
        super({
            id: OpenProcessExplorer.ID,
            title: localize2('openProcessExplorer', 'Open Process Explorer'),
            category: Categories.Developer,
            precondition: supported,
            f1: true
        });
    }
    async run(accessor) {
        const editorService = accessor.get(IEditorService);
        const editorGroupService = accessor.get(IEditorGroupsService);
        const auxiliaryWindowService = accessor.get(IAuxiliaryWindowService);
        const storageService = accessor.get(IStorageService);
        const pane = await editorService.openEditor({
            resource: ProcessExplorerEditorInput.RESOURCE,
            options: {
                pinned: true,
                revealIfOpened: true,
                auxiliary: {
                    ...this.loadState(storageService),
                    compact: true,
                    alwaysOnTop: true
                }
            }
        }, AUX_WINDOW_GROUP);
        if (pane) {
            const listener = pane.input?.onWillDispose(() => {
                listener?.dispose();
                this.saveState(pane.group.id, storageService, editorGroupService, auxiliaryWindowService);
            });
        }
    }
    loadState(storageService) {
        const stateRaw = storageService.get(OpenProcessExplorer.STATE_KEY, -1 /* StorageScope.APPLICATION */);
        if (!stateRaw) {
            return OpenProcessExplorer.DEFAULT_STATE;
        }
        try {
            return JSON.parse(stateRaw);
        }
        catch {
            return OpenProcessExplorer.DEFAULT_STATE;
        }
    }
    saveState(group, storageService, editorGroupService, auxiliaryWindowService) {
        const auxiliaryWindow = auxiliaryWindowService.getWindow(editorGroupService.getPart(group).windowId);
        if (!auxiliaryWindow) {
            return;
        }
        const bounds = auxiliaryWindow.createState().bounds;
        if (!bounds) {
            return;
        }
        storageService.store(OpenProcessExplorer.STATE_KEY, JSON.stringify({ bounds }), -1 /* StorageScope.APPLICATION */, 1 /* StorageTarget.MACHINE */);
    }
}
registerAction2(OpenProcessExplorer);
MenuRegistry.appendMenuItem(MenuId.MenubarHelpMenu, {
    group: '5_tools',
    command: {
        id: OpenProcessExplorer.ID,
        title: localize({ key: 'miOpenProcessExplorerer', comment: ['&& denotes a mnemonic'] }, "Open &&Process Explorer")
    },
    when: supported,
    order: 2
});
//#endregion
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzc0V4cGxvcmVyLmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9wcm9jZXNzRXhwbG9yZXIvYnJvd3Nlci9wcm9jZXNzRXhwbG9yZXIuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFFLHFCQUFxQixFQUFvQixNQUFNLDREQUE0RCxDQUFDO0FBQ3JILE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RSxPQUFPLEVBQTBCLDhCQUE4QixFQUFrQixNQUFNLGtDQUFrQyxDQUFDO0FBQzFILE9BQU8sRUFBcUIsZ0JBQWdCLEVBQTJDLE1BQU0sMkJBQTJCLENBQUM7QUFFekgsT0FBTyxFQUFFLHNCQUFzQixFQUFFLHdCQUF3QixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDNUgsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDN0UsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2hILE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSw4REFBOEQsQ0FBQztBQUMxRixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDcEcsT0FBTyxFQUFFLGVBQWUsRUFBK0IsTUFBTSxnREFBZ0QsQ0FBQztBQUU5RyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxxRUFBcUUsQ0FBQztBQUM5RyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUM5RixPQUFPLEVBQUUsaUJB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