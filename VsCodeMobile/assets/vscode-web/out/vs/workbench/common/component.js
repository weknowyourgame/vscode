/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Memento } from './memento.js';
import { Themable } from '../../platform/theme/common/themeService.js';
export class Component extends Themable {
    constructor(id, themeService, storageService) {
        super(themeService);
        this.id = id;
        this.memento = new Memento(this.id, storageService);
        this._register(storageService.onWillSaveState(() => {
            // Ask the component to persist state into the memento
            this.saveState();
            // Then save the memento into storage
            this.memento.saveMemento();
        }));
    }
    getId() {
        return this.id;
    }
    getMemento(scope, target) {
        return this.memento.getMemento(scope, target);
    }
    reloadMemento(scope) {
        this.memento.reloadMemento(scope);
    }
    onDidChangeMementoValue(scope, disposables) {
        return this.memento.onDidChangeValue(scope, disposables);
    }
    saveState() {
        // Subclasses to implement for storing state
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb21tb24vY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFDdkMsT0FBTyxFQUFpQixRQUFRLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUt0RixNQUFNLE9BQU8sU0FBK0MsU0FBUSxRQUFRO0lBSTNFLFlBQ2tCLEVBQVUsRUFDM0IsWUFBMkIsRUFDM0IsY0FBK0I7UUFFL0IsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBSkgsT0FBRSxHQUFGLEVBQUUsQ0FBUTtRQU0zQixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFFcEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRTtZQUVsRCxzREFBc0Q7WUFDdEQsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBRWpCLHFDQUFxQztZQUNyQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQzVCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsS0FBSztRQUNKLE9BQU8sSUFBSSxDQUFDLEVBQUUsQ0FBQztJQUNoQixDQUFDO0lBRVMsVUFBVSxDQUFDLEtBQW1CLEVBQUUsTUFBcUI7UUFDOUQsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUVTLGFBQWEsQ0FBQyxLQUFtQjtRQUMxQyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRVMsdUJBQXVCLENBQUMsS0FBbUIsRUFBRSxXQUE0QjtRQUNsRixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFUyxTQUFTO1FBQ2xCLDRDQUE0QztJQUM3QyxDQUFDO0NBQ0QifQ==