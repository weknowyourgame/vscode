/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import * as nls from '../../../../nls.js';
import { Memento } from '../../../common/memento.js';
import { CustomEditorInfo } from './customEditor.js';
import { customEditorsExtensionPoint } from './extensionPoint.js';
import { RegisteredEditorPriority } from '../../../services/editor/common/editorResolverService.js';
export class ContributedCustomEditors extends Disposable {
    static { this.CUSTOM_EDITORS_STORAGE_ID = 'customEditors'; }
    static { this.CUSTOM_EDITORS_ENTRY_ID = 'editors'; }
    constructor(storageService) {
        super();
        this._editors = new Map();
        this._onChange = this._register(new Emitter());
        this.onChange = this._onChange.event;
        this._memento = new Memento(ContributedCustomEditors.CUSTOM_EDITORS_STORAGE_ID, storageService);
        const mementoObject = this._memento.getMemento(0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        for (const info of mementoObject[ContributedCustomEditors.CUSTOM_EDITORS_ENTRY_ID] || []) {
            this.add(new CustomEditorInfo(info));
        }
        this._register(customEditorsExtensionPoint.setHandler(extensions => {
            this.update(extensions);
        }));
    }
    update(extensions) {
        this._editors.clear();
        for (const extension of extensions) {
            for (const webviewEditorContribution of extension.value) {
                this.add(new CustomEditorInfo({
                    id: webviewEditorContribution.viewType,
                    displayName: webviewEditorContribution.displayName,
                    providerDisplayName: extension.description.isBuiltin ? nls.localize('builtinProviderDisplayName', "Built-in") : extension.description.displayName || extension.description.identifier.value,
                    selector: webviewEditorContribution.selector || [],
                    priority: getPriorityFromContribution(webviewEditorContribution, extension.description),
                }));
            }
        }
        const mementoObject = this._memento.getMemento(0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
        mementoObject[ContributedCustomEditors.CUSTOM_EDITORS_ENTRY_ID] = Array.from(this._editors.values());
        this._memento.saveMemento();
        this._onChange.fire();
    }
    [Symbol.iterator]() {
        return this._editors.values();
    }
    get(viewType) {
        return this._editors.get(viewType);
    }
    getContributedEditors(resource) {
        return Array.from(this._editors.values())
            .filter(customEditor => customEditor.matches(resource));
    }
    add(info) {
        if (this._editors.has(info.id)) {
            console.error(`Custom editor with id '${info.id}' already registered`);
            return;
        }
        this._editors.set(info.id, info);
    }
}
function getPriorityFromContribution(contribution, extension) {
    switch (contribution.priority) {
        case "default" /* CustomEditorPriority.default */:
            return RegisteredEditorPriority.default;
        case "option" /* CustomEditorPriority.option */:
            return RegisteredEditorPriority.option;
        case "builtin" /* CustomEditorPriority.builtin */:
            // Builtin is only valid for builtin extensions
            return extension.isBuiltin ? RegisteredEditorPriority.builtin : RegisteredEditorPriority.default;
        default:
            return RegisteredEditorPriority.default;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udHJpYnV0ZWRDdXN0b21FZGl0b3JzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2N1c3RvbUVkaXRvci9jb21tb24vY29udHJpYnV0ZWRDdXN0b21FZGl0b3JzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMzRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFbEUsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUcxQyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDckQsT0FBTyxFQUFnRCxnQkFBZ0IsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ25HLE9BQU8sRUFBRSwyQkFBMkIsRUFBZ0MsTUFBTSxxQkFBcUIsQ0FBQztBQUNoRyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQU9wRyxNQUFNLE9BQU8sd0JBQXlCLFNBQVEsVUFBVTthQUUvQiw4QkFBeUIsR0FBRyxlQUFlLEFBQWxCLENBQW1CO2FBQzVDLDRCQUF1QixHQUFHLFNBQVMsQUFBWixDQUFhO0lBSzVELFlBQVksY0FBK0I7UUFDMUMsS0FBSyxFQUFFLENBQUM7UUFKUSxhQUFRLEdBQUcsSUFBSSxHQUFHLEVBQTRCLENBQUM7UUFrQi9DLGNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUNqRCxhQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUM7UUFiL0MsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyx3QkFBd0IsQ0FBQyx5QkFBeUIsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUVoRyxNQUFNLGFBQWEs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