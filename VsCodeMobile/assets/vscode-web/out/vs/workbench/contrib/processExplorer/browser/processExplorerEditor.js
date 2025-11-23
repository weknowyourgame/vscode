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
var ProcessExplorerEditor_1;
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { BrowserProcessExplorerControl } from './processExplorerControl.js';
let ProcessExplorerEditor = class ProcessExplorerEditor extends EditorPane {
    static { ProcessExplorerEditor_1 = this; }
    static { this.ID = 'workbench.editor.processExplorer'; }
    constructor(group, telemetryService, themeService, storageService, instantiationService) {
        super(ProcessExplorerEditor_1.ID, group, telemetryService, themeService, storageService);
        this.instantiationService = instantiationService;
        this.processExplorerControl = undefined;
    }
    createEditor(parent) {
        this.processExplorerControl = this._register(this.instantiationService.createInstance(BrowserProcessExplorerControl, parent));
    }
    focus() {
        this.processExplorerControl?.focus();
    }
    layout(dimension) {
        this.processExplorerControl?.layout(dimension);
    }
};
ProcessExplorerEditor = ProcessExplorerEditor_1 = __decorate([
    __param(1, ITelemetryService),
    __param(2, IThemeService),
    __param(3, IStorageService),
    __param(4, IInstantiationService)
], ProcessExplorerEditor);
export { ProcessExplorerEditor };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzc0V4cGxvcmVyRWRpdG9yLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Byb2Nlc3NFeHBsb3Jlci9icm93c2VyL3Byb2Nlc3NFeHBsb3JlckVkaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFHaEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNsRixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFekUsT0FBTyxFQUFFLDZCQUE2QixFQUEwQixNQUFNLDZCQUE2QixDQUFDO0FBRTdGLElBQU0scUJBQXFCLEdBQTNCLE1BQU0scUJBQXNCLFNBQVEsVUFBVTs7YUFFcEMsT0FBRSxHQUFXLGtDQUFrQyxBQUE3QyxDQUE4QztJQUloRSxZQUNDLEtBQW1CLEVBQ0EsZ0JBQW1DLEVBQ3ZDLFlBQTJCLEVBQ3pCLGNBQStCLEVBQ3pCLG9CQUE4RDtRQUVyRixLQUFLLENBQUMsdUJBQXFCLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxZQUFZLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFGN0MseUJBQW9CLEdBQXBCLG9CQUFvQixDQUF1QjtRQVA1RSwyQkFBc0IsR0FBdUMsU0FBUyxDQUFDO0lBVWpGLENBQUM7SUFFa0IsWUFBWSxDQUFDLE1BQW1CO1FBQ2xELElBQUksQ0FBQyxzQkFBc0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsNkJBQTZCLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUMvSCxDQUFDO0lBRVEsS0FBSztRQUNiLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxLQUFLLEVBQUUsQ0FBQztJQUN0QyxDQUFDO0lBRVEsTUFBTSxDQUFDLFNBQW9CO1FBQ25DLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDaEQsQ0FBQzs7QUExQlcscUJBQXFCO0lBUS9CLFdBQUEsaUJBQWlCLENBQUE7SUFDakIsV0FBQSxhQUFhLENBQUE7SUFDYixXQUFBLGVBQWUsQ0FBQTtJQUNmLFdBQUEscUJBQXFCLENBQUE7R0FYWCxxQkFBcUIsQ0EyQmpDIn0=