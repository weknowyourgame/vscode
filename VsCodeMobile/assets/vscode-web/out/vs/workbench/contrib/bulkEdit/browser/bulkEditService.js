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
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { LinkedList } from '../../../../base/common/linkedList.js';
import { ResourceMap, ResourceSet } from '../../../../base/common/map.js';
import { isCodeEditor, isDiffEditor } from '../../../../editor/browser/editorBrowser.js';
import { IBulkEditService, ResourceFileEdit, ResourceTextEdit } from '../../../../editor/browser/services/bulkEditService.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Extensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Progress } from '../../../../platform/progress/common/progress.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { UndoRedoGroup } from '../../../../platform/undoRedo/common/undoRedo.js';
import { BulkCellEdits, ResourceNotebookCellEdit } from './bulkCellEdits.js';
import { BulkFileEdits } from './bulkFileEdits.js';
import { BulkTextEdits } from './bulkTextEdits.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { IWorkingCopyService } from '../../../services/workingCopy/common/workingCopyService.js';
import { OpaqueEdits, ResourceAttachmentEdit } from './opaqueEdits.js';
import { isMacintosh } from '../../../../base/common/platform.js';
function liftEdits(edits) {
    return edits.map(edit => {
        if (ResourceTextEdit.is(edit)) {
            return ResourceTextEdit.lift(edit);
        }
        if (ResourceFileEdit.is(edit)) {
            return ResourceFileEdit.lift(edit);
        }
        if (ResourceNotebookCellEdit.is(edit)) {
            return ResourceNotebookCellEdit.lift(edit);
        }
        if (ResourceAttachmentEdit.is(edit)) {
            return ResourceAttachmentEdit.lift(edit);
        }
        throw new Error('Unsupported edit');
    });
}
let BulkEdit = class BulkEdit {
    constructor(_label, _code, _editor, _progress, _token, _edits, _undoRedoGroup, _undoRedoSource, _confirmBeforeUndo, _instaService, _logService) {
        this._label = _label;
        this._code = _code;
        this._editor = _editor;
        this._progress = _progress;
        this._token = _token;
        this._edits = _edits;
        this._undoRedoGroup = _undoRedoGroup;
        this._undoRedoSource = _undoRedoSource;
        this._confirmBeforeUndo = _confirmBeforeUndo;
        this._instaService = _instaService;
        this._logService = _logService;
    }
    ariaMessage() {
        const otherResources = new ResourceMap();
        const textEditResources = new ResourceMap();
        let textEditCount = 0;
        for (const edit of this._edits) {
            if (edit instanceof ResourceTextEdit) {
                textEditCount += 1;
                textEditResources.set(edit.resource, true);
            }
            else if (edit instanceof ResourceFileEdit) {
                otherResources.set(edit.oldResource ?? edit.newResource, true);
            }
        }
        if (this._edits.length === 0) {
            return localize('summary.0', "Made no edits");
        }
        else if (otherResources.size === 0) {
            if (textEditCount > 1 && textEditResources.size > 1) {
                return localize('summary.nm', "Made {0} text edits in {1} files", textEditCount, textEditResources.size);
            }
            else {
                return localize('summary.n0', "Made {0} text edits in one file", textEditCount);
            }
        }
        else {
            return localize('summary.textFiles', "Made {0} text edits in {1} files, also created or deleted {2} files", textEditCount, textEditResources.size, otherResources.size);
        }
    }
    async perform(reason) {
        if (this._edits.length === 0) {
            return [];
        }
        const ranges = [1];
        for (let i = 1; i < this._edits.length; i++) {
            if (Object.getPrototypeOf(this._edits[i - 1]) === Object.getPrototypeOf(this._edits[i])) {
                ranges[ranges.length - 1]++;
            }
            else {
                ranges.push(1);
            }
        }
        // Show infinte progress when there is only 1 item since we do not know how long it takes
        const increment = this._edits.length > 1 ? 0 : undefined;
        this._progress.report({ increment, total: 100 });
        // Increment by percentage points since progress API expects that
        const progress = { report: _ => this._progress.report({ increment: 100 / this._edits.length }) };
        const resources = [];
        let index = 0;
        for (const range of ranges) {
            if (this._token.isCancellationRequested) {
                break;
            }
            const group = this._edits.slice(index, index + range);
            if (group[0] instanceof ResourceFileEdit) {
                resources.push(await this._performFileEdits(group, this._undoRedoGroup, this._undoRedoSource, this._confirmBeforeUndo, progress));
            }
            else if (group[0] instanceof ResourceTextEdit) {
                resources.push(await this._performTextEdits(group, this._undoRedoGroup, this._undoRedoSource, progress, reason));
            }
            else if (group[0] instanceof ResourceNotebookCellEdit) {
                resources.push(await this._performCellEdits(group, this._undoRedoGroup, this._undoRedoSource, progress));
            }
            else if (group[0] instanceof ResourceAttachmentEdit) {
                resources.push(await this._performOpaqueEdits(group, this._undoRedoGroup, this._undoRedoSource, progress));
            }
            else {
                console.log('UNKNOWN EDIT');
            }
            index = index + range;
        }
        return resources.flat();
    }
    async _performFileEdits(edits, undoRedoGroup, undoRedoSource, confirmBeforeUndo, progress) {
        this._logService.debug('_performFileEdits', JSON.stringify(edits));
        const model = this._instaService.createInstance(BulkFileEdits, this._label || localize('workspaceEdit', "Workspace Edit"), this._code || 'undoredo.workspaceEdit', undoRedoGroup, undoRedoSource, confirmBeforeUndo, progress, this._token, edits);
        return await model.apply();
    }
    async _performTextEdits(edits, undoRedoGroup, undoRedoSource, progress, reason) {
        this._logService.debug('_performTextEdits', JSON.stringify(edits));
        const model = this._instaService.createInstance(BulkTextEdits, this._label || localize('workspaceEdit', "Workspace Edit"), this._code || 'undoredo.workspaceEdit', this._editor, undoRedoGroup, undoRedoSource, progress, this._token, edits);
        return await model.apply(reason);
    }
    async _performCellEdits(edits, undoRedoGroup, undoRedoSource, progress) {
        this._logService.debug('_performCellEdits', JSON.stringify(edits));
        const model = this._instaService.createInstance(BulkCellEdits, undoRedoGroup, undoRedoSource, progress, this._token, edits);
        return await model.apply();
    }
    async _performOpaqueEdits(edits, undoRedoGroup, undoRedoSource, progress) {
        this._logService.debug('_performOpaqueEdits', JSON.stringify(edits));
        const model = this._instaService.createInstance(OpaqueEdits, undoRedoGroup, undoRedoSource, progress, this._token, edits);
        return await model.apply();
    }
};
BulkEdit = __decorate([
    __param(9, IInstantiationService),
    __param(10, ILogService)
], BulkEdit);
let BulkEditService = class BulkEditService {
    constructor(_instaService, _logService, _editorService, _lifecycleService, _dialogService, _workingCopyService, _configService) {
        this._instaService = _instaService;
        this._logService = _logService;
        this._editorService = _editorService;
        this._lifecycleService = _lifecycleService;
        this._dialogService = _dialogService;
        this._workingCopyService = _workingCopyService;
        this._configService = _configService;
        this._activeUndoRedoGroups = new LinkedList();
    }
    setPreviewHandler(handler) {
        this._previewHandler = handler;
        return toDisposable(() => {
            if (this._previewHandler === handler) {
                this._previewHandler = undefined;
            }
        });
    }
    hasPreviewHandler() {
        return Boolean(this._previewHandler);
    }
    async apply(editsIn, options) {
        let edits = liftEdits(Array.isArray(editsIn) ? editsIn : editsIn.edits);
        if (edits.length === 0) {
            return { ariaSummary: localize('nothing', "Made no edits"), isApplied: false };
        }
        if (this._previewHandler && (options?.showPreview || edits.some(value => value.metadata?.needsConfirmation))) {
            edits = await this._previewHandler(edits, options);
        }
        let codeEditor = options?.editor;
        // try to find code editor
        if (!codeEditor) {
            const candidate = this._editorService.activeTextEditorControl;
            if (isCodeEditor(candidate)) {
                codeEditor = candidate;
            }
            else if (isDiffEditor(candidate)) {
                codeEditor = candidate.getModifiedEditor();
            }
        }
        if (codeEditor && codeEditor.getOption(104 /* EditorOption.readOnly */)) {
            // If the code editor is readonly still allow bulk edits to be applied #68549
            codeEditor = undefined;
        }
        // undo-redo-group: if a group id is passed then try to find it
        // in the list of active edits. otherwise (or when not found)
        // create a separate undo-redo-group
        let undoRedoGroup;
        let undoRedoGroupRemove = () => { };
        if (typeof options?.undoRedoGroupId === 'number') {
            for (const candidate of this._activeUndoRedoGroups) {
                if (candidate.id === options.undoRedoGroupId) {
                    undoRedoGroup = candidate;
                    break;
                }
            }
        }
        if (!undoRedoGroup) {
            undoRedoGroup = new UndoRedoGroup();
            undoRedoGroupRemove = this._activeUndoRedoGroups.push(undoRedoGroup);
        }
        const label = options?.quotableLabel || options?.label;
        const bulkEdit = this._instaService.createInstance(BulkEdit, label, options?.code, codeEditor, options?.progress ?? Progress.None, options?.token ?? CancellationToken.None, edits, undoRedoGroup, options?.undoRedoSource, !!options?.confirmBeforeUndo);
        let listener;
        try {
            listener = this._lifecycleService.onBeforeShutdown(e => e.veto(this._shouldVeto(label, e.reason), 'veto.blukEditService'));
            const resources = await bulkEdit.perform(options?.reason);
            // when enabled (option AND setting) loop over all dirty working copies and trigger save
            // for those that were involved in this bulk edit operation.
            if (options?.respectAutoSaveConfig && this._configService.getValue(autoSaveSetting) === true && resources.length > 1) {
                await this._saveAll(resources);
            }
            return { ariaSummary: bulkEdit.ariaMessage(), isApplied: edits.length > 0 };
        }
        catch (err) {
            // console.log('apply FAILED');
            // console.log(err);
            this._logService.error(err);
            throw err;
        }
        finally {
            listener?.dispose();
            undoRedoGroupRemove();
        }
    }
    async _saveAll(resources) {
        const set = new ResourceSet(resources);
        const saves = this._workingCopyService.dirtyWorkingCopies.map(async (copy) => {
            if (set.has(copy.resource)) {
                await copy.save();
            }
        });
        const result = await Promise.allSettled(saves);
        for (const item of result) {
            if (item.status === 'rejected') {
                this._logService.warn(item.reason);
            }
        }
    }
    async _shouldVeto(label, reason) {
        let message;
        switch (reason) {
            case 1 /* ShutdownReason.CLOSE */:
                message = localize('closeTheWindow.message', "Are you sure you want to close the window?");
                break;
            case 4 /* ShutdownReason.LOAD */:
                message = localize('changeWorkspace.message', "Are you sure you want to change the workspace?");
                break;
            case 3 /* ShutdownReason.RELOAD */:
                message = localize('reloadTheWindow.message', "Are you sure you want to reload the window?");
                break;
            default:
                message = isMacintosh ? localize('quitMessageMac', "Are you sure you want to quit?") : localize('quitMessage', "Are you sure you want to exit?");
                break;
        }
        const result = await this._dialogService.confirm({
            message,
            detail: localize('areYouSureQuiteBulkEdit.detail', "'{0}' is in progress.", label || localize('fileOperation', "File operation")),
        });
        return !result.confirmed;
    }
};
BulkEditService = __decorate([
    __param(0, IInstantiationService),
    __param(1, ILogService),
    __param(2, IEditorService),
    __param(3, ILifecycleService),
    __param(4, IDialogService),
    __param(5, IWorkingCopyService),
    __param(6, IConfigurationService)
], BulkEditService);
export { BulkEditService };
registerSingleton(IBulkEditService, BulkEditService, 1 /* InstantiationType.Delayed */);
const autoSaveSetting = 'files.refactoring.autoSave';
Registry.as(Extensions.Configuration).registerConfiguration({
    id: 'files',
    properties: {
        [autoSaveSetting]: {
            description: localize('refactoring.autoSave', "Controls if files that were part of a refactoring are saved automatically"),
            default: true,
            type: 'boolean'
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVsa0VkaXRTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2J1bGtFZGl0L2Jyb3dzZXIvYnVsa0VkaXRTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzVFLE9BQU8sRUFBZSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqRixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDbkUsT0FBTyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUUxRSxPQUFPLEVBQWUsWUFBWSxFQUFFLFlBQVksRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RHLE9BQU8sRUFBOEQsZ0JBQWdCLEVBQWdCLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFHeE0sT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxVQUFVLEVBQTBCLE1BQU0sb0VBQW9FLENBQUM7QUFDeEgsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2hGLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDckUsT0FBTyxFQUE0QixRQUFRLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RB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