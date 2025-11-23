/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize, localize2 } from '../../../../nls.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { Action2, MenuId } from '../../../../platform/actions/common/actions.js';
import { ILanguagePackService } from '../../../../platform/languagePacks/common/languagePacks.js';
import { ILocaleService } from '../../../services/localization/common/locale.js';
import { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';
export class ConfigureDisplayLanguageAction extends Action2 {
    static { this.ID = 'workbench.action.configureLocale'; }
    constructor() {
        super({
            id: ConfigureDisplayLanguageAction.ID,
            title: localize2('configureLocale', "Configure Display Language"),
            menu: {
                id: MenuId.CommandPalette
            },
            metadata: {
                description: localize2('configureLocaleDescription', "Changes the locale of VS Code based on installed language packs. Common languages include French, Chinese, Spanish, Japanese, German, Korean, and more.")
            }
        });
    }
    async run(accessor) {
        const languagePackService = accessor.get(ILanguagePackService);
        const quickInputService = accessor.get(IQuickInputService);
        const localeService = accessor.get(ILocaleService);
        const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const installedLanguages = await languagePackService.getInstalledLanguages();
        const disposables = new DisposableStore();
        const qp = disposables.add(quickInputService.createQuickPick({ useSeparators: true }));
        qp.matchOnDescription = true;
        qp.placeholder = localize('chooseLocale', "Select Display Language");
        if (installedLanguages?.length) {
            const items = [{ type: 'separator', label: localize('installed', "Installed") }];
            qp.items = items.concat(this.withMoreInfoButton(installedLanguages));
        }
        disposables.add(qp.onDidHide(() => {
            disposables.dispose();
        }));
        const installedSet = new Set(installedLanguages?.map(language => language.id) ?? []);
        languagePackService.getAvailableLanguages().then(availableLanguages => {
            const newLanguages = availableLanguages.filter(l => l.id && !installedSet.has(l.id));
            if (newLanguages.length) {
                qp.items = [
                    ...qp.items,
                    { type: 'separator', label: localize('available', "Available") },
                    ...this.withMoreInfoButton(newLanguages)
                ];
            }
            qp.busy = false;
        });
        disposables.add(qp.onDidAccept(async () => {
            const selectedLanguage = qp.activeItems[0];
            if (selectedLanguage) {
                qp.hide();
                await localeService.setLocale(selectedLanguage);
            }
        }));
        disposables.add(qp.onDidTriggerItemButton(async (e) => {
            qp.hide();
            if (e.item.extensionId) {
                await extensionWorkbenchService.open(e.item.extensionId);
            }
        }));
        qp.show();
        qp.busy = true;
    }
    withMoreInfoButton(items) {
        for (const item of items) {
            if (item.extensionId) {
                item.buttons = [{
                        tooltip: localize('moreInfo', "More Info"),
                        iconClass: 'codicon-info'
                    }];
            }
        }
        return items;
    }
}
export class ClearDisplayLanguageAction extends Action2 {
    static { this.ID = 'workbench.action.clearLocalePreference'; }
    static { this.LABEL = localize2('clearDisplayLanguage', "Clear Display Language Preference"); }
    constructor() {
        super({
            id: ClearDisplayLanguageAction.ID,
            title: ClearDisplayLanguageAction.LABEL,
            menu: {
                id: MenuId.CommandPalette
            }
        });
    }
    async run(accessor) {
        const localeService = accessor.get(ILocaleService);
        await localeService.clearLocalePreference();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYWxpemF0aW9uc0FjdGlvbnMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbG9jYWxpemF0aW9uL2NvbW1vbi9sb2NhbGl6YXRpb25zQWN0aW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3pELE9BQU8sRUFBRSxrQkFBa0IsRUFBdUIsTUFBTSxzREFBc0QsQ0FBQztBQUMvRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDdkUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUVqRixPQUFPLEVBQXFCLG9CQUFvQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDckgsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBRXBGLE1BQU0sT0FBTyw4QkFBK0IsU0FBUSxPQUFPO2FBQ25DLE9BQUUsR0FBRyxrQ0FBa0MsQ0FBQztJQUUvRDtRQUNDLEtBQUssQ0FBQztZQUNMLEVBQUUsRUFBRSw4QkFBOEIsQ0FBQyxFQUFFO1lBQ3JDLEtBQUssRUFBRSxTQUFTLENBQUMsaUJBQWlCLEVBQUUsNEJBQTRCLENBQUM7WUFDakUsSUFBSSxFQUFFO2dCQUNMLEVBQUUsRUFBRSxNQUFNLENBQUMsY0FBYzthQUN6QjtZQUNELFFBQVEsRUFBRTtnQkFDVCxXQUFXLEVBQUUsU0FBUyxDQUFDLDRCQUE0QixFQUFFLHlKQUF5SixDQUFDO2FBQy9NO1NBQ0QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVNLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBMEI7UUFDMUMsTUFBTSxtQkFBbUIs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