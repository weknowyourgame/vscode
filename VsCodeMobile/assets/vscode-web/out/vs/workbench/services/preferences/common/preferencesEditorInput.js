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
var SettingsEditor2Input_1;
import { Codicon } from '../../../../base/common/codicons.js';
import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import * as nls from '../../../../nls.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IPreferencesService } from './preferences.js';
const SettingsEditorIcon = registerIcon('settings-editor-label-icon', Codicon.settings, nls.localize('settingsEditorLabelIcon', 'Icon of the settings editor label.'));
let SettingsEditor2Input = class SettingsEditor2Input extends EditorInput {
    static { SettingsEditor2Input_1 = this; }
    static { this.ID = 'workbench.input.settings2'; }
    constructor(_preferencesService) {
        super();
        this.resource = URI.from({
            scheme: Schemas.vscodeSettings,
            path: `settingseditor`
        });
        this._settingsModel = _preferencesService.createSettings2EditorModel();
    }
    matches(otherInput) {
        return super.matches(otherInput) || otherInput instanceof SettingsEditor2Input_1;
    }
    get typeId() {
        return SettingsEditor2Input_1.ID;
    }
    getName() {
        return nls.localize('settingsEditor2InputName', "Settings");
    }
    getIcon() {
        return SettingsEditorIcon;
    }
    async resolve() {
        return this._settingsModel;
    }
    dispose() {
        this._settingsModel.dispose();
        super.dispose();
    }
};
SettingsEditor2Input = SettingsEditor2Input_1 = __decorate([
    __param(0, IPreferencesService)
], SettingsEditor2Input);
export { SettingsEditor2Input };
const PreferencesEditorIcon = registerIcon('preferences-editor-label-icon', Codicon.settings, nls.localize('preferencesEditorLabelIcon', 'Icon of the preferences editor label.'));
export class PreferencesEditorInput extends EditorInput {
    constructor() {
        super(...arguments);
        this.resource = URI.from({
            scheme: Schemas.vscodeSettings,
            path: `preferenceseditor`
        });
    }
    static { this.ID = 'workbench.input.preferences'; }
    matches(otherInput) {
        return super.matches(otherInput) || otherInput instanceof PreferencesEditorInput;
    }
    get typeId() {
        return PreferencesEditorInput.ID;
    }
    getName() {
        return nls.localize('preferencesEditorInputName', "Preferences");
    }
    getIcon() {
        return PreferencesEditorIcon;
    }
    async resolve() {
        return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmVyZW5jZXNFZGl0b3JJbnB1dC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzRWRpdG9ySW5wdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFFN0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBRWpGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUd2RCxNQUFNLGtCQUFrQixHQUFHLFlBQVksQ0FBQyw0QkFBNEIsRUFBRSxPQUFPLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMseUJBQXlCLEVBQUUsb0NBQW9DLENBQUMsQ0FBQyxDQUFDO0FBRWhLLElBQU0sb0JBQW9CLEdBQTFCLE1BQU0sb0JBQXFCLFNBQVEsV0FBVzs7YUFFcEMsT0FBRSxHQUFXLDJCQUEyQixBQUF0QyxDQUF1QztJQVF6RCxZQUNzQixtQkFBd0M7UUFFN0QsS0FBSyxFQUFFLENBQUM7UUFSQSxhQUFRLEdBQVEsR0FBRyxDQUFDLElBQUksQ0FBQztZQUNqQyxNQUFNLEVBQUUsT0FBTyxDQUFDLGNBQWM7WUFDOUIsSUFBSSxFQUFFLGdCQUFnQjtTQUN0QixDQUFDLENBQUM7UUFPRixJQUFJLENBQUMsY0FBYyxHQUFHLG1CQUFtQixDQUFDLDBCQUEwQixFQUFFLENBQUM7SUFDeEUsQ0FBQztJQUVRLE9BQU8sQ0FBQyxVQUE2QztRQUM3RCxPQUFPLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksVUFBVSxZQUFZLHNCQUFvQixDQUFDO0lBQ2hGLENBQUM7SUFFRCxJQUFhLE1BQU07UUFDbEIsT0FBTyxzQkFBb0IsQ0FBQyxFQUFFLENBQUM7SUFDaEMsQ0FBQztJQUVRLE9BQU87UUFDZixPQUFPLEdBQUcsQ0FBQyxRQUFRLENBQUMsMEJBQTBCLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUVRLE9BQU87UUFDZixPQUFPLGtCQUFrQixDQUFDO0lBQzNCLENBQUM7SUFFUSxLQUFLLENBQUMsT0FBTztRQUNyQixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUM7SUFDNUIsQ0FBQztJQUVRLE9BQU87UUFDZixJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBRTlCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNqQixDQUFDOztBQTFDVyxvQkFBb0I7SUFXOUIsV0FBQSxtQkFBbUIsQ0FBQTtHQVhULG9CQUFvQixDQTJDaEM7O0FBRUQsTUFBTSxxQkFBcUIsR0FBRyxZQUFZLENBQUMsK0JBQStCLEVBQUUsT0FBTyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLDRCQUE0QixFQUFFLHVDQUF1QyxDQUFDLENBQUMsQ0FBQztBQUVuTCxNQUFNLE9BQU8sc0JBQXVCLFNBQVEsV0FBVztJQUF2RDs7UUFJVSxhQUFRLEdBQVEsR0FBRyxDQUFDLElBQUksQ0FBQztZQUNqQyxNQUFNLEVBQUUsT0FBTyxDQUFDLGNBQWM7WUFDOUIsSUFBSSxFQUFFLG1CQUFtQjtTQUN6QixDQUFDLENBQUM7SUFxQkosQ0FBQzthQTFCZ0IsT0FBRSxHQUFXLDZCQUE2QixBQUF4QyxDQUF5QztJQU9sRCxPQUFPLENBQUMsVUFBNkM7UUFDN0QsT0FBTyxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLFVBQVUsWUFBWSxzQkFBc0IsQ0FBQztJQUNsRixDQUFDO0lBRUQsSUFBYSxNQUFNO1FBQ2xCLE9BQU8sc0JBQXNCLENBQUMsRUFBRSxDQUFDO0lBQ2xDLENBQUM7SUFFUSxPQUFPO1FBQ2YsT0FBTyxHQUFHLENBQUMsUUFBUSxDQUFDLDRCQUE0QixFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQ2xFLENBQUM7SUFFUSxPQUFPO1FBQ2YsT0FBTyxxQkFBcUIsQ0FBQztJQUM5QixDQUFDO0lBRVEsS0FBSyxDQUFDLE9BQU87UUFDckIsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDIn0=