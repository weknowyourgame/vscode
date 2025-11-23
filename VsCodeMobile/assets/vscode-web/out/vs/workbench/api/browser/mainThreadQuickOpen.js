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
import { Toggle } from '../../../base/browser/ui/toggle/toggle.js';
import { Lazy } from '../../../base/common/lazy.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { basenameOrAuthority, dirname, hasTrailingPathSeparator } from '../../../base/common/resources.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { isUriComponents, URI } from '../../../base/common/uri.js';
import { ILanguageService } from '../../../editor/common/languages/language.js';
import { getIconClasses } from '../../../editor/common/services/getIconClasses.js';
import { IModelService } from '../../../editor/common/services/model.js';
import { FileKind } from '../../../platform/files/common/files.js';
import { ILabelService } from '../../../platform/label/common/label.js';
import { IQuickInputService, QuickInputButtonLocation } from '../../../platform/quickinput/common/quickInput.js';
import { asCssVariable, inputActiveOptionBackground, inputActiveOptionBorder, inputActiveOptionForeground } from '../../../platform/theme/common/colorRegistry.js';
import { ICustomEditorLabelService } from '../../services/editor/common/customEditorLabelService.js';
import { extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { ExtHostContext, MainContext } from '../common/extHost.protocol.js';
let MainThreadQuickOpen = class MainThreadQuickOpen {
    constructor(extHostContext, quickInputService, labelService, customEditorLabelService, modelService, languageService) {
        this.labelService = labelService;
        this.customEditorLabelService = customEditorLabelService;
        this.modelService = modelService;
        this.languageService = languageService;
        this._items = {};
        // ---- QuickInput
        this.sessions = new Map();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostQuickOpen);
        this._quickInputService = quickInputService;
    }
    dispose() {
        for (const [_id, session] of this.sessions) {
            session.store.dispose();
        }
    }
    $show(instance, options, token) {
        const contents = new Promise((resolve, reject) => {
            this._items[instance] = { resolve, reject };
        });
        options = {
            ...options,
            onDidFocus: el => {
                if (el) {
                    this._proxy.$onItemSelected(el.handle);
                }
            }
        };
        if (options.canPickMany) {
            return this._quickInputService.pick(contents, options, token).then(items => {
                if (items) {
                    return items.map(item => item.handle);
                }
                return undefined;
            });
        }
        else {
            return this._quickInputService.pick(contents, options, token).then(item => {
                if (item) {
                    return item.handle;
                }
                return undefined;
            });
        }
    }
    $setItems(instance, items) {
        if (this._items[instance]) {
            items.forEach(item => this.expandItemProps(item));
            this._items[instance].resolve(items);
            delete this._items[instance];
        }
        return Promise.resolve();
    }
    $setError(instance, error) {
        if (this._items[instance]) {
            this._items[instance].reject(error);
            delete this._items[instance];
        }
        return Promise.resolve();
    }
    // ---- input
    $input(options, validateInput, token) {
        const inputOptions = Object.create(null);
        if (options) {
            inputOptions.title = options.title;
            inputOptions.password = options.password;
            inputOptions.placeHolder = options.placeHolder;
            inputOptions.valueSelection = options.valueSelection;
            inputOptions.prompt = options.prompt;
            inputOptions.value = options.value;
            inputOptions.ignoreFocusLost = options.ignoreFocusOut;
        }
        if (validateInput) {
            inputOptions.validateInput = (value) => {
                return this._proxy.$validateInput(value);
            };
        }
        return this._quickInputService.input(inputOptions, token);
    }
    $createOrUpdate(params) {
        const sessionId = params.id;
        let session = this.sessions.get(sessionId);
        if (!session) {
            const store = new DisposableStore();
            const input = params.type === 'quickPick' ? this._quickInputService.createQuickPick() : this._quickInputService.createInputBox();
            store.add(input);
            store.add(input.onDidAccept(() => {
                this._proxy.$onDidAccept(sessionId);
            }));
            store.add(input.onDidTriggerButton(button => {
                this._proxy.$onDidTriggerButton(sessionId, button.handle);
            }));
            store.add(input.onDidChangeValue(value => {
                this._proxy.$onDidChangeValue(sessionId, value);
            }));
            store.add(input.onDidHide(() => {
                this._proxy.$onDidHide(sessionId);
            }));
            if (params.type === 'quickPick') {
                // Add extra events specific for quickpick
                const quickpick = input;
                store.add(quickpick.onDidChangeActive(items => {
                    this._proxy.$onDidChangeActive(sessionId, items.map(item => item.handle));
                }));
                store.add(quickpick.onDidChangeSelection(items => {
                    this._proxy.$onDidChangeSelection(sessionId, items.map(item => item.handle));
                }));
                store.add(quickpick.onDidTriggerItemButton((e) => {
                    this._proxy.$onDidTriggerItemButton(sessionId, e.item.handle, e.button.handle);
                }));
            }
            session = {
                input,
                handlesToItems: new Map(),
                handlesToToggles: new Map(),
                store
            };
            this.sessions.set(sessionId, session);
        }
        const { input, handlesToItems } = session;
        const quickPick = input;
        for (const param in params) {
            switch (param) {
                case 'id':
                case 'type':
                    continue;
                case 'visible':
                    if (params.visible) {
                        input.show();
                    }
                    else {
                        input.hide();
                    }
                    break;
                case 'items': {
                    handlesToItems.clear();
                    params.items?.forEach((item) => {
                        this.expandItemProps(item);
                        if (item.type !== 'separator') {
                            item.buttons?.forEach(button => this.expandIconPath(button));
                            handlesToItems.set(item.handle, item);
                        }
                    });
                    quickPick.items = params.items;
                    break;
                }
                case 'activeItems':
                    quickPick.activeItems = params.activeItems
                        ?.map((handle) => handlesToItems.get(handle))
                        .filter(Boolean);
                    break;
                case 'selectedItems':
                    quickPick.selectedItems = params.selectedItems
                        ?.map((handle) => handlesToItems.get(handle))
                        .filter(Boolean);
                    break;
                case 'buttons': {
                    const buttons = [], toggles = [];
                    for (const button of params.buttons) {
                        if (button.handle === -1) {
                            buttons.push(this._quickInputService.backButton);
                        }
                        else {
                            this.expandIconPath(button);
                            // Currently buttons are only supported outside of the input box
                            // and toggles only inside. When/if that changes, this will need to be updated.
                            if (button.location === QuickInputButtonLocation.Input) {
                                toggles.push(button);
                            }
                            else {
                                buttons.push(button);
                            }
                        }
                    }
                    input.buttons = buttons;
                    this.updateToggles(sessionId, session, toggles);
                    break;
                }
                default:
                    // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
                    input[param] = params[param];
                    break;
            }
        }
        return Promise.resolve(undefined);
    }
    $dispose(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.store.dispose();
            this.sessions.delete(sessionId);
        }
        return Promise.resolve(undefined);
    }
    /**
    * Derives icon, label and description for Quick Pick items that represent a resource URI.
    */
    expandItemProps(item) {
        if (item.type === 'separator') {
            return;
        }
        if (!item.resourceUri) {
            this.expandIconPath(item);
            return;
        }
        // Derive missing label and description from resourceUri.
        const resourceUri = URI.from(item.resourceUri);
        item.label ??= this.customEditorLabelService.getName(resourceUri) || '';
        if (item.label) {
            item.description ??= this.labelService.getUriLabel(resourceUri, { relative: true });
        }
        else {
            item.label = basenameOrAuthority(resourceUri);
            item.description ??= this.labelService.getUriLabel(dirname(resourceUri), { relative: true });
        }
        // Derive icon props from resourceUri if icon is set to ThemeIcon.File or ThemeIcon.Folder.
        const icon = item.iconPathDto;
        if (ThemeIcon.isThemeIcon(icon) && (ThemeIcon.isFile(icon) || ThemeIcon.isFolder(icon))) {
            const fileKind = ThemeIcon.isFolder(icon) || hasTrailingPathSeparator(resourceUri) ? FileKind.FOLDER : FileKind.FILE;
            const iconClasses = new Lazy(() => getIconClasses(this.modelService, this.languageService, resourceUri, fileKind));
            Object.defineProperty(item, 'iconClasses', { get: () => iconClasses.value });
        }
        else {
            this.expandIconPath(item);
        }
    }
    /**
    * Converts IconPath DTO into iconPath/iconClass properties.
    */
    expandIconPath(target) {
        const icon = target.iconPathDto;
        if (!icon) {
            return;
        }
        else if (ThemeIcon.isThemeIcon(icon)) {
            // TODO: Since IQuickPickItem and IQuickInputButton do not support ThemeIcon directly, the color ID is lost here.
            // We should consider changing changing iconPath/iconClass to IconPath in both interfaces.
            // Request for color support: https://github.com/microsoft/vscode/issues/185356..
            target.iconClass = ThemeIcon.asClassName(icon);
        }
        else if (isUriComponents(icon)) {
            const uri = URI.from(icon);
            target.iconPath = { dark: uri, light: uri };
        }
        else {
            const { dark, light } = icon;
            target.iconPath = { dark: URI.from(dark), light: URI.from(light) };
        }
    }
    /**
    * Updates the toggles for a given quick input session by creating new {@link Toggle}-s
    * from buttons, updating existing toggles props and removing old ones.
    */
    updateToggles(sessionId, session, buttons) {
        const { input, handlesToToggles, store } = session;
        // Add new or update existing toggles.
        const toggles = [];
        for (const button of buttons) {
            const title = button.tooltip || '';
            const isChecked = !!button.checked;
            // TODO: Toggle class only supports ThemeIcon at the moment, but not other formats of IconPath.
            // We should consider adding support for the full IconPath to Toggle, in this code should be updated.
            const icon = ThemeIcon.isThemeIcon(button.iconPathDto) ? button.iconPathDto : undefined;
            let { toggle } = handlesToToggles.get(button.handle) || {};
            if (toggle) {
                // Toggle already exists, update its props.
                toggle.setTitle(title);
                toggle.setIcon(icon);
                toggle.checked = isChecked;
            }
            else {
                // Create a new toggle from the button.
                toggle = store.add(new Toggle({
                    title,
                    icon,
                    isChecked,
                    inputActiveOptionBorder: asCssVariable(inputActiveOptionBorder),
                    inputActiveOptionForeground: asCssVariable(inputActiveOptionForeground),
                    inputActiveOptionBackground: asCssVariable(inputActiveOptionBackground)
                }));
                const listener = store.add(toggle.onChange(() => {
                    this._proxy.$onDidTriggerButton(sessionId, button.handle, toggle.checked);
                }));
                handlesToToggles.set(button.handle, { toggle, listener });
            }
            toggles.push(toggle);
        }
        // Remove toggles that are no longer present from the session map.
        for (const [handle, { toggle, listener }] of handlesToToggles) {
            if (!buttons.some(button => button.handle === handle)) {
                handlesToToggles.delete(handle);
                store.delete(toggle);
                store.delete(listener);
            }
        }
        // Update toggle interfaces on the input widget.
        input.toggles = toggles;
    }
};
MainThreadQuickOpen = __decorate([
    extHostNamedCustomer(MainContext.MainThreadQuickOpen),
    __param(1, IQuickInputService),
    __param(2, ILabelService),
    __param(3, ICustomEditorLabelService),
    __param(4, IModelService),
    __param(5, ILanguageService)
], MainThreadQuickOpen);
export { MainThreadQuickOpen };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZFF1aWNrT3Blbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZFF1aWNrT3Blbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFFbkUsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3BELE9BQU8sRUFBRSxlQUFlLEVBQWUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNqRixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDM0csT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxlQUFlLEVBQUUsR0FBRyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDbkUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDaEYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN6RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDbkUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3hFLE9BQU8sRUFBNEMsa0JBQWtCLEVBQThCLHdCQUF3QixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDdkwsT0FBTyxFQUFFLGFBQWEsRUFBRSwyQkFBMkIsRUFBRSx1QkFBdUIsRUFBRSwyQkFBMkIsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ25LLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQ3JHLE9B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