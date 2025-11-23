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
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { localize2 } from '../../../../../../nls.js';
import { Categories } from '../../../../../../platform/action/common/actionCommonCategories.js';
import { Action2, registerAction2 } from '../../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { Registry } from '../../../../../../platform/registry/common/platform.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { Extensions as WorkbenchExtensions } from '../../../../../common/contributions.js';
import { Memento } from '../../../../../common/memento.js';
import { NotebookSetting } from '../../../common/notebookCommon.js';
import { HAS_OPENED_NOTEBOOK } from '../../../common/notebookContextKeys.js';
import { NotebookEditorInput } from '../../../common/notebookEditorInput.js';
import { IEditorService } from '../../../../../services/editor/common/editorService.js';
const hasOpenedNotebookKey = 'hasOpenedNotebook';
const hasShownGettingStartedKey = 'hasShownNotebookGettingStarted';
/**
 * Sets a context key when a notebook has ever been opened by the user
 */
let NotebookGettingStarted = class NotebookGettingStarted extends Disposable {
    constructor(_editorService, _storageService, _contextKeyService, _commandService, _configurationService) {
        super();
        const hasOpenedNotebook = HAS_OPENED_NOTEBOOK.bindTo(_contextKeyService);
        const memento = new Memento('notebookGettingStarted2', _storageService);
        const storedValue = memento.getMemento(0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        if (storedValue[hasOpenedNotebookKey]) {
            hasOpenedNotebook.set(true);
        }
        const needToShowGettingStarted = _configurationService.getValue(NotebookSetting.openGettingStarted) && !storedValue[hasShownGettingStartedKey];
        if (!storedValue[hasOpenedNotebookKey] || needToShowGettingStarted) {
            const onDidOpenNotebook = () => {
                hasOpenedNotebook.set(true);
                storedValue[hasOpenedNotebookKey] = true;
                if (needToShowGettingStarted) {
                    _commandService.executeCommand('workbench.action.openWalkthrough', { category: 'notebooks', step: 'notebookProfile' }, true);
                    storedValue[hasShownGettingStartedKey] = true;
                }
                memento.saveMemento();
            };
            if (_editorService.activeEditor?.typeId === NotebookEditorInput.ID) {
                // active editor is notebook
                onDidOpenNotebook();
                return;
            }
            const listener = this._register(_editorService.onDidActiveEditorChange(() => {
                if (_editorService.activeEditor?.typeId === NotebookEditorInput.ID) {
                    listener.dispose();
                    onDidOpenNotebook();
                }
            }));
        }
    }
};
NotebookGettingStarted = __decorate([
    __param(0, IEditorService),
    __param(1, IStorageService),
    __param(2, IContextKeyService),
    __param(3, ICommandService),
    __param(4, IConfigurationService)
], NotebookGettingStarted);
export { NotebookGettingStarted };
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(NotebookGettingStarted, 3 /* LifecyclePhase.Restored */);
registerAction2(class NotebookClearNotebookLayoutAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.notebook.layout.gettingStarted',
            title: localize2('workbench.notebook.layout.gettingStarted.label', "Reset notebook getting started"),
            f1: true,
            precondition: ContextKeyExpr.equals(`config.${NotebookSetting.openGettingStarted}`, true),
            category: Categories.Developer,
        });
    }
    run(accessor) {
        const storageService = accessor.get(IStorageService);
        const memento = new Memento('notebookGettingStarted', storageService);
        const storedValue = memento.getMemento(0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        storedValue[hasOpenedNotebookKey] = undefined;
        memento.saveMemento();
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tHZXR0aW5nU3RhcnRlZC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIvZ2V0dGluZ1N0YXJ0ZWQvbm90ZWJvb2tHZXR0aW5nU3RhcnRlZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3JELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxvRUFBb0UsQ0FBQztBQUNoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUN6RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUN6RyxPQUFPLEVBQUUsY0FBYyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFFaEgsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sc0RBQXNELENBQUM7QUFDcEgsT0FBTyxFQUEyRCxVQUFVLElBQUksbUJBQW1CLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNwSixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDM0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQzdFLE9BQU8sRUFB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