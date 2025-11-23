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
import { derived, observableFromEvent } from '../../../../base/common/observable.js';
import { findMetadata } from '../../themes/common/colorThemeData.js';
import { IWorkbenchThemeService } from '../../themes/common/workbenchThemeService.js';
let TreeSitterThemeService = class TreeSitterThemeService {
    constructor(_themeService) {
        this._themeService = _themeService;
        this._colorTheme = observableFromEvent(this._themeService.onDidColorThemeChange, () => this._themeService.getColorTheme());
        this.onChange = derived(this, (reader) => {
            this._colorTheme.read(reader);
            reader.reportChange(void 0);
        });
    }
    findMetadata(captureNames, languageId, bracket, reader) {
        return findMetadata(this._colorTheme.read(reader), captureNames, languageId, bracket);
    }
};
TreeSitterThemeService = __decorate([
    __param(0, IWorkbenchThemeService)
], TreeSitterThemeService);
export { TreeSitterThemeService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJlZVNpdHRlclRoZW1lU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvdHJlZVNpdHRlci9icm93c2VyL3RyZWVTaXR0ZXJUaGVtZVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBd0IsbUJBQW1CLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUUzRyxPQUFPLEVBQWtCLFlBQVksRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBRS9FLElBQU0sc0JBQXNCLEdBQTVCLE1BQU0sc0JBQXNCO0lBS2xDLFlBQzBDLGFBQXFDO1FBQXJDLGtCQUFhLEdBQWIsYUFBYSxDQUF3QjtRQUU5RSxJQUFJLENBQUMsV0FBVyxHQUFHLG1CQUFtQixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMscUJBQXFCLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLEVBQW9CLENBQUMsQ0FBQztRQUM3SSxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRTtZQUN4QyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM5QixNQUFNLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDN0IsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsWUFBWSxDQUFDLFlBQXNCLEVBQUUsVUFBa0IsRUFBRSxPQUFnQixFQUFFLE1BQTJCO1FBQ3JHLE9BQU8sWUFBWSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdkYsQ0FBQztDQUNELENBQUE7QUFsQlksc0JBQXNCO0lBTWhDLFdBQUEsc0JBQXNCLENBQUE7R0FOWixzQkFBc0IsQ0FrQmxDIn0=