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
var QuickInputTreeRenderer_1;
import * as cssJs from '../../../../base/browser/cssValue.js';
import * as dom from '../../../../base/browser/dom.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { IconLabel } from '../../../../base/browser/ui/iconLabel/iconLabel.js';
import { TriStateCheckbox } from '../../../../base/browser/ui/toggle/toggle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { defaultCheckboxStyles } from '../../../theme/browser/defaultStyles.js';
import { isDark } from '../../../theme/common/theme.js';
import { escape } from '../../../../base/common/strings.js';
import { IThemeService } from '../../../theme/common/themeService.js';
import { quickInputButtonToAction } from '../quickInputUtils.js';
const $ = dom.$;
export class QuickInputCheckboxStateHandler extends Disposable {
    constructor() {
        super(...arguments);
        this._onDidChangeCheckboxState = this._register(new Emitter());
        this.onDidChangeCheckboxState = this._onDidChangeCheckboxState.event;
    }
    setCheckboxState(node, checked) {
        this._onDidChangeCheckboxState.fire({ item: node, checked });
    }
}
let QuickInputTreeRenderer = class QuickInputTreeRenderer extends Disposable {
    static { QuickInputTreeRenderer_1 = this; }
    static { this.ID = 'quickInputTreeElement'; }
    constructor(_hoverDelegate, _buttonTriggeredEmitter, onCheckedEvent, _checkboxStateHandler, _themeService) {
        super();
        this._hoverDelegate = _hoverDelegate;
        this._buttonTriggeredEmitter = _buttonTriggeredEmitter;
        this.onCheckedEvent = onCheckedEvent;
        this._checkboxStateHandler = _checkboxStateHandler;
        this._themeService = _themeService;
        this.templateId = QuickInputTreeRenderer_1.ID;
    }
    renderTemplate(container) {
        const store = new DisposableStore();
        // Main entry container
        const entry = dom.append(container, $('.quick-input-tree-entry'));
        const checkbox = store.add(new TriStateCheckbox('', false, { ...defaultCheckboxStyles, size: 15 }));
        entry.appendChild(checkbox.domNode);
        const checkboxLabel = dom.append(entry, $('label.quick-input-tree-label'));
        const rows = dom.append(checkboxLabel, $('.quick-input-tree-rows'));
        const row1 = dom.append(rows, $('.quick-input-tree-row'));
        const icon = dom.prepend(row1, $('.quick-input-tree-icon'));
        const label = store.add(new IconLabel(row1, {
            supportHighlights: true,
            supportDescriptionHighlights: true,
            supportIcons: true,
            hoverDelegate: this._hoverDelegate
        }));
        const actionBar = store.add(new ActionBar(entry, this._hoverDelegate ? { hoverDelegate: this._hoverDelegate } : undefined));
        actionBar.domNode.classList.add('quick-input-tree-entry-action-bar');
        return {
            toDisposeTemplate: store,
            entry,
            checkbox,
            icon,
            label,
            actionBar,
            toDisposeElement: new DisposableStore(),
        };
    }
    renderElement(node, _index, templateData, _details) {
        const store = templateData.toDisposeElement;
        const quickTreeItem = node.element;
        // Checkbox
        if (quickTreeItem.pickable === false) {
            // Hide checkbox for non-pickable items
            templateData.checkbox.domNode.style.display = 'none';
        }
        else {
            const checkbox = templateData.checkbox;
            checkbox.domNode.style.display = '';
            checkbox.checked = quickTreeItem.checked ?? false;
            store.add(Event.filter(this.onCheckedEvent, e => e.item === quickTreeItem)(e => checkbox.checked = e.checked));
            if (quickTreeItem.disabled) {
                checkbox.disable();
            }
            store.add(checkbox.onChange((e) => this._checkboxStateHandler.setCheckboxState(quickTreeItem, checkbox.checked)));
        }
        // Icon
        if (quickTreeItem.iconPath) {
            const icon = isDark(this._themeService.getColorTheme().type) ? quickTreeItem.iconPath.dark : (quickTreeItem.iconPath.light ?? quickTreeItem.iconPath.dark);
            const iconUrl = URI.revive(icon);
            templateData.icon.className = 'quick-input-tree-icon';
            templateData.icon.style.backgroundImage = cssJs.asCSSUrl(iconUrl);
        }
        else {
            templateData.icon.style.backgroundImage = '';
            templateData.icon.className = quickTreeItem.iconClass ? `quick-input-tree-icon ${quickTreeItem.iconClass}` : '';
        }
        const { labelHighlights: matches, descriptionHighlights: descriptionMatches } = node.filterData || {};
        // Label and Description
        let descriptionTitle;
        // NOTE: If we bring back quick tool tips, we need to check that here like we do in the QuickInputListRenderer
        if (quickTreeItem.description) {
            descriptionTitle = {
                markdown: {
                    value: escape(quickTreeItem.description),
                    supportThemeIcons: true
                },
                markdownNotSupportedFallback: quickTreeItem.description
            };
        }
        templateData.label.setLabel(quickTreeItem.label, quickTreeItem.description, {
            matches,
            descriptionMatches,
            extraClasses: quickTreeItem.iconClasses,
            italic: quickTreeItem.italic,
            strikethrough: quickTreeItem.strikethrough,
            labelEscapeNewLines: true,
            descriptionTitle
        });
        // Action Bar
        const buttons = quickTreeItem.buttons;
        if (buttons && buttons.length) {
            templateData.actionBar.push(buttons.map((button, index) => quickInputButtonToAction(button, `tree-${index}`, () => this._buttonTriggeredEmitter.fire({ item: quickTreeItem, button }))), { icon: true, label: false });
            templateData.entry.classList.add('has-actions');
        }
        else {
            templateData.entry.classList.remove('has-actions');
        }
    }
    disposeElement(_element, _index, templateData, _details) {
        templateData.toDisposeElement.clear();
        templateData.actionBar.clear();
    }
    disposeTemplate(templateData) {
        templateData.toDisposeElement.dispose();
        templateData.toDisposeTemplate.dispose();
    }
};
QuickInputTreeRenderer = QuickInputTreeRenderer_1 = __decorate([
    __param(4, IThemeService)
], QuickInputTreeRenderer);
export { QuickInputTreeRenderer };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVpY2tJbnB1dFRyZWVSZW5kZXJlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9xdWlja2lucHV0L2Jyb3dzZXIvdHJlZS9xdWlja0lucHV0VHJlZVJlbmRlcmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssS0FBSyxNQUFNLHNDQUFzQyxDQUFDO0FBQzlELE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBRy9FLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUMvRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUVoRixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbkYsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUN4RCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDNUQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBRXRFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBR2pFLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFZaEIsTUFBTSxPQUFPLDhCQUFrQyxTQUFRLFVBQVU7SUFBakU7O1FBQ2tCLDhCQUF5QixHQUFHLElBQUksQ0FB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