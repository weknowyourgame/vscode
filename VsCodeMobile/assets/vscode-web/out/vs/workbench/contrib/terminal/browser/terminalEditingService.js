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
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { TERMINAL_VIEW_ID } from '../common/terminal.js';
let TerminalEditingService = class TerminalEditingService {
    constructor(_viewsService) {
        this._viewsService = _viewsService;
    }
    getEditableData(instance) {
        return this._editable && this._editable.instance === instance ? this._editable.data : undefined;
    }
    setEditable(instance, data) {
        if (!data) {
            this._editable = undefined;
        }
        else {
            this._editable = { instance: instance, data };
        }
        const pane = this._viewsService.getActiveViewWithId(TERMINAL_VIEW_ID);
        const isEditing = this.isEditable(instance);
        pane?.terminalTabbedView?.setEditable(isEditing);
    }
    isEditable(instance) {
        return !!this._editable && (this._editable.instance === instance || !instance);
    }
    getEditingTerminal() {
        return this._editingTerminal;
    }
    setEditingTerminal(instance) {
        this._editingTerminal = instance;
    }
};
TerminalEditingService = __decorate([
    __param(0, IViewsService)
], TerminalEditingService);
export { TerminalEditingService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxFZGl0aW5nU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsRWRpdGluZ1NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBRS9FLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBR2xELElBQU0sc0JBQXNCLEdBQTVCLE1BQU0sc0JBQXNCO0lBTWxDLFlBQ2lDLGFBQTRCO1FBQTVCLGtCQUFhLEdBQWIsYUFBYSxDQUFlO0lBRTdELENBQUM7SUFFRCxlQUFlLENBQUMsUUFBMkI7UUFDMUMsT0FBTyxJQUFJLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUNqRyxDQUFDO0lBRUQsV0FBVyxDQUFDLFFBQTJCLEVBQUUsSUFBMEI7UUFDbEUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ1gsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDNUIsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsU0FBUyxHQUFHLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUMvQyxDQUFDO1FBQ0QsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBbUIsZ0JBQWdCLENBQUMsQ0FBQztRQUN4RixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzVDLElBQUksRUFBRSxrQkFBa0IsRUFBRSxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVELFVBQVUsQ0FBQyxRQUF1QztRQUNqRCxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEtBQUssUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDaEYsQ0FBQztJQUVELGtCQUFrQjtRQUNqQixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztJQUM5QixDQUFDO0lBRUQsa0JBQWtCLENBQUMsUUFBdUM7UUFDekQsSUFBSSxDQUFDLGdCQUFnQixHQUFHLFFBQVEsQ0FBQztJQUNsQyxDQUFDO0NBQ0QsQ0FBQTtBQXJDWSxzQkFBc0I7SUFPaEMsV0FBQSxhQUFhLENBQUE7R0FQSCxzQkFBc0IsQ0FxQ2xDIn0=