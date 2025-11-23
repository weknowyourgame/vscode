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
import { Dimension, getActiveDocument } from '../../../../base/browser/dom.js';
import { codiconsLibrary } from '../../../../base/common/codiconsLibrary.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { defaultInputBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { getIconRegistry } from '../../../../platform/theme/common/iconRegistry.js';
import { WorkbenchIconSelectBox } from '../../../services/userDataProfile/browser/iconSelectBox.js';
const icons = new Lazy(() => {
    const iconDefinitions = getIconRegistry().getIcons();
    const includedChars = new Set();
    const dedupedIcons = iconDefinitions.filter(e => {
        if (e.id === codiconsLibrary.blank.id) {
            return false;
        }
        if (ThemeIcon.isThemeIcon(e.defaults)) {
            return false;
        }
        if (includedChars.has(e.defaults.fontCharacter)) {
            return false;
        }
        includedChars.add(e.defaults.fontCharacter);
        return true;
    });
    return dedupedIcons;
});
let TerminalIconPicker = class TerminalIconPicker extends Disposable {
    constructor(instantiationService, _hoverService, _layoutService) {
        super();
        this._hoverService = _hoverService;
        this._layoutService = _layoutService;
        this._iconSelectBox = instantiationService.createInstance(WorkbenchIconSelectBox, {
            icons: icons.value,
            inputBoxStyles: defaultInputBoxStyles
        });
    }
    async pickIcons() {
        const dimension = new Dimension(486, 260);
        return new Promise(resolve => {
            this._register(this._iconSelectBox.onDidSelect(e => {
                resolve(e);
                this._iconSelectBox.dispose();
            }));
            this._iconSelectBox.clearInput();
            const body = getActiveDocument().body;
            const bodyRect = body.getBoundingClientRect();
            const hoverWidget = this._hoverService.showInstantHover({
                content: this._iconSelectBox.domNode,
                target: {
                    targetElements: [body],
                    x: bodyRect.left + (bodyRect.width - dimension.width) / 2,
                    y: bodyRect.top + this._layoutService.activeContainerOffset.quickPickTop - 2
                },
                position: {
                    hoverPosition: 2 /* HoverPosition.BELOW */,
                },
                persistence: {
                    sticky: true,
                },
            }, true);
            if (hoverWidget) {
                this._register(hoverWidget);
            }
            this._iconSelectBox.layout(dimension);
            this._iconSelectBox.focus();
        });
    }
};
TerminalIconPicker = __decorate([
    __param(0, IInstantiationService),
    __param(1, IHoverService),
    __param(2, ILayoutService)
], TerminalIconPicker);
export { TerminalIconPicker };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxJY29uUGlja2VyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL2Jyb3dzZXIvdGVybWluYWxJY29uUGlja2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxTQUFTLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUUvRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDN0UsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN0RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUM1RixPQUFPLEVBQUUsZUFBZSxFQUFvQixNQUFNLG1EQUFtRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRXBHLE1BQU0sS0FBSyxHQUFHLElBQUksSUFBSSxDQUFxQixHQUFHLEVBQUU7SUFDL0MsTUFBTSxlQUFlLEdBQUcsZUFBZSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDckQsTUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztJQUN4QyxNQUFNLFlBQVksR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFO1FB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