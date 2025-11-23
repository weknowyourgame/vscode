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
var PreferencesEditor_1;
import './media/preferencesEditor.css';
import * as DOM from '../../../../base/browser/dom.js';
import { localize } from '../../../../nls.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { Event } from '../../../../base/common/event.js';
import { getInputBoxStyle } from '../../../../platform/theme/browser/defaultStyles.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { CONTEXT_PREFERENCES_SEARCH_FOCUS } from '../common/preferences.js';
import { settingsTextInputBorder } from '../common/settingsEditorColorRegistry.js';
import { SearchWidget } from './preferencesWidgets.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions } from './preferencesEditorRegistry.js';
import { Action } from '../../../../base/common/actions.js';
import { MutableDisposable } from '../../../../base/common/lifecycle.js';
class PreferenceTabAction extends Action {
    constructor(descriptor, actionCallback) {
        super(descriptor.id, descriptor.title, '', true, actionCallback);
        this.descriptor = descriptor;
    }
}
let PreferencesEditor = class PreferencesEditor extends EditorPane {
    static { PreferencesEditor_1 = this; }
    static { this.ID = 'workbench.editor.preferences'; }
    constructor(group, telemetryService, themeService, storageService, instantiationService, contextKeyService) {
        super(PreferencesEditor_1.ID, group, telemetryService, themeService, storageService);
        this.instantiationService = instantiationService;
        this.editorPanesRegistry = Registry.as(Extensions.PreferencesEditorPane);
        this.preferencesTabActions = [];
        this.preferencesEditorPane = this._register(new MutableDisposable());
        this.searchFocusContextKey = CONTEXT_PREFERENCES_SEARCH_FOCUS.bindTo(contextKeyService);
        this.element = DOM.$('.preferences-editor');
        const headerContainer = DOM.append(this.element, DOM.$('.preferences-editor-header'));
        const searchContainer = DOM.append(headerContainer, DOM.$('.search-container'));
        this.searchWidget = this._register(this.instantiationService.createInstance(SearchWidget, searchContainer, {
            focusKey: this.searchFocusContextKey,
            inputBoxStyles: getInputBoxStyle({
                inputBorder: settingsTextInputBorder
            })
        }));
        this._register(Event.debounce(this.searchWidget.onDidChange, () => undefined, 300)(() => {
            this.preferencesEditorPane.value?.search(this.searchWidget.getValue());
        }));
        const preferencesTabsContainer = DOM.append(headerContainer, DOM.$('.preferences-tabs-container'));
        this.preferencesTabActionBar = this._register(new ActionBar(preferencesTabsContainer, {
            orientation: 0 /* ActionsOrientation.HORIZONTAL */,
            focusOnlyEnabledItems: true,
            ariaLabel: localize('preferencesTabSwitcherBarAriaLabel', "Preferences Tab Switcher"),
            ariaRole: 'tablist',
        }));
        this.onDidChangePreferencesEditorPane(this.editorPanesRegistry.getPreferencesEditorPanes(), []);
        this._register(this.editorPanesRegistry.onDidRegisterPreferencesEditorPanes(descriptors => this.onDidChangePreferencesEditorPane(descriptors, [])));
        this._register(this.editorPanesRegistry.onDidDeregisterPreferencesEditorPanes(descriptors => this.onDidChangePreferencesEditorPane([], descriptors)));
        this.bodyElement = DOM.append(this.element, DOM.$('.preferences-editor-body'));
    }
    createEditor(parent) {
        DOM.append(parent, this.element);
    }
    layout(dimension) {
        this.dimension = dimension;
        this.searchWidget.layout(dimension);
        this.searchWidget.inputBox.inputElement.style.paddingRight = `12px`;
        this.preferencesEditorPane.value?.layout(new DOM.Dimension(this.bodyElement.clientWidth, dimension.height - 87 /* header height */));
    }
    async setInput(input, options, context, token) {
        await super.setInput(input, options, context, token);
        if (this.preferencesTabActions.length) {
            this.onDidSelectPreferencesEditorPane(this.preferencesTabActions[0].id);
        }
    }
    onDidChangePreferencesEditorPane(toAdd, toRemove) {
        for (const desc of toRemove) {
            const index = this.preferencesTabActions.findIndex(action => action.id === desc.id);
            if (index !== -1) {
                this.preferencesTabActionBar.pull(index);
                this.preferencesTabActions[index].dispose();
                this.preferencesTabActions.splice(index, 1);
            }
        }
        if (toAdd.length > 0) {
            const all = this.editorPanesRegistry.getPreferencesEditorPanes();
            for (const desc of toAdd) {
                const index = all.findIndex(action => action.id === desc.id);
                if (index !== -1) {
                    const action = new PreferenceTabAction(desc, () => this.onDidSelectPreferencesEditorPane(desc.id));
                    this.preferencesTabActions.splice(index, 0, action);
                    this.preferencesTabActionBar.push(action, { index });
                }
            }
        }
    }
    onDidSelectPreferencesEditorPane(id) {
        let selectedAction;
        for (const action of this.preferencesTabActions) {
            if (action.id === id) {
                action.checked = true;
                selectedAction = action;
            }
            else {
                action.checked = false;
            }
        }
        if (selectedAction) {
            this.searchWidget.inputBox.setPlaceHolder(localize('FullTextSearchPlaceholder', "Search {0}", selectedAction.descriptor.title));
            this.searchWidget.inputBox.setAriaLabel(localize('FullTextSearchPlaceholder', "Search {0}", selectedAction.descriptor.title));
        }
        this.renderBody(selectedAction?.descriptor);
        if (this.dimension) {
            this.layout(this.dimension);
        }
    }
    renderBody(descriptor) {
        this.preferencesEditorPane.value = undefined;
        DOM.clearNode(this.bodyElement);
        if (descriptor) {
            const editorPane = this.instantiationService.createInstance(descriptor.ctorDescriptor.ctor);
            this.preferencesEditorPane.value = editorPane;
            this.bodyElement.appendChild(editorPane.getDomNode());
        }
    }
    dispose() {
        super.dispose();
        this.preferencesTabActions.forEach(action => action.dispose());
    }
};
PreferencesEditor = PreferencesEditor_1 = __decorate([
    __param(1, ITelemetryService),
    __param(2, IThemeService),
    __param(3, IStorageService),
    __param(4, IInstantiationService),
    __param(5, IContextKeyService)
], PreferencesEditor);
export { PreferencesEditor };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmVyZW5jZXNFZGl0b3IuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvcHJlZmVyZW5jZXMvYnJvd3Nlci9wcmVmZXJlbmNlc0VkaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTywrQkFBK0IsQ0FBQztBQUN2QyxPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQWUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN2RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDakYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDdkYsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNsRixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFekUsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDNUUsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxTQUFTLEVBQXNCLE1BQU0sb0RBQW9ELENBQUM7QUFDbkcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQzVFLE9BQU8s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