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
var ExtensionUrlBootstrapHandler_1;
import { localize, localize2 } from '../../../../nls.js';
import { combinedDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IURLService } from '../../../../platform/url/common/url.js';
import { IHostService } from '../../host/browser/host.js';
import { IExtensionService } from '../common/extensions.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IsWebContext } from '../../../../platform/contextkey/common/contextkeys.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { disposableWindowInterval } from '../../../../base/browser/dom.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { equalsIgnoreCase } from '../../../../base/common/strings.js';
const FIVE_MINUTES = 5 * 60 * 1000;
const THIRTY_SECONDS = 30 * 1000;
const URL_TO_HANDLE = 'extensionUrlHandler.urlToHandle';
const USER_TRUSTED_EXTENSIONS_CONFIGURATION_KEY = 'extensions.confirmedUriHandlerExtensionIds';
const USER_TRUSTED_EXTENSIONS_STORAGE_KEY = 'extensionUrlHandler.confirmedExtensions';
function isExtensionId(value) {
    return /^[a-z0-9][a-z0-9\-]*\.[a-z0-9][a-z0-9\-]*$/i.test(value);
}
class UserTrustedExtensionIdStorage {
    get extensions() {
        const userTrustedExtensionIdsJson = this.storageService.get(USER_TRUSTED_EXTENSIONS_STORAGE_KEY, 0 /* StorageScope.PROFILE */, '[]');
        try {
            return JSON.parse(userTrustedExtensionIdsJson);
        }
        catch {
            return [];
        }
    }
    constructor(storageService) {
        this.storageService = storageService;
    }
    has(id) {
        return this.extensions.indexOf(id) > -1;
    }
    add(id) {
        this.set([...this.extensions, id]);
    }
    set(ids) {
        this.storageService.store(USER_TRUSTED_EXTENSIONS_STORAGE_KEY, JSON.stringify(ids), 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
    }
}
export const IExtensionUrlHandler = createDecorator('extensionUrlHandler');
export class ExtensionUrlHandlerOverrideRegistry {
    static { this.handlers = new Set(); }
    static registerHandler(handler) {
        this.handlers.add(handler);
        return toDisposable(() => this.handlers.delete(handler));
    }
    static getHandler(uri) {
        for (const handler of this.handlers) {
            if (handler.canHandleURL(uri)) {
                return handler;
            }
        }
        return undefined;
    }
}
/**
 * This class handles URLs which are directed towards extensions.
 * If a URL is directed towards an inactive extension, it buffers it,
 * activates the extension and re-opens the URL once the extension registers
 * a URL handler. If the extension never registers a URL handler, the urls
 * will eventually be garbage collected.
 *
 * It also makes sure the user confirms opening URLs directed towards extensions.
 */
let ExtensionUrlHandler = class ExtensionUrlHandler {
    constructor(urlService, extensionService, dialogService, commandService, hostService, storageService, configurationService, notificationService, productService) {
        this.extensionService = extensionService;
        this.dialogService = dialogService;
        this.commandService = commandService;
        this.hostService = hostService;
        this.storageService = storageService;
        this.configurationService = configurationService;
        this.notificationService = notificationService;
        this.productService = productService;
        this.extensionHandlers = new Map();
        this.uriBuffer = new Map();
        this.userTrustedExtensionsStorage = new UserTrustedExtensionIdStorage(storageService);
        const interval = disposableWindowInterval(mainWindow, () => this.garbageCollect(), THIRTY_SECONDS);
        const urlToHandleValue = this.storageService.get(URL_TO_HANDLE, 1 /* StorageScope.WORKSPACE */);
        if (urlToHandleValue) {
            this.storageService.remove(URL_TO_HANDLE, 1 /* StorageScope.WORKSPACE */);
            this.handleURL(URI.revive(JSON.parse(urlToHandleValue)), { trusted: true });
        }
        this.disposable = combinedDisposable(urlService.registerHandler(this), interval);
        const cache = ExtensionUrlBootstrapHandler.cache;
        setTimeout(() => cache.forEach(([uri, option]) => this.handleURL(uri, option)));
    }
    async handleURL(uri, options) {
        if (!isExtensionId(uri.authority)) {
            return false;
        }
        const overrideHandler = ExtensionUrlHandlerOverrideRegistry.getHandler(uri);
        if (overrideHandler) {
            const handled = await overrideHandler.handleURL(uri);
            if (handled) {
                return handled;
            }
        }
        const extensionId = uri.authority;
        const initialHandler = this.extensionHandlers.get(ExtensionIdentifier.toKey(extensionId));
        let extensionDisplayName;
        if (!initialHandler) {
            // The extension is not yet activated, so let's check if it is installed and enabled
            const extension = await this.extensionService.getExtension(extensionId);
            if (!extension) {
                await this.handleUnhandledURL(uri, extensionId, options);
                return true;
            }
            else {
                extensionDisplayName = extension.displayName ?? '';
            }
        }
        else {
            extensionDisplayName = initialHandler.extensionDisplayName;
        }
        const trusted = options?.trusted
            || this.productService.trustedExtensionProtocolHandlers?.some(value => equalsIgnoreCase(value, extensionId))
            || this.didUserTrustExtension(ExtensionIdentifier.toKey(extensionId));
        if (!trusted) {
            const uriString = uri.toString(false);
            let uriLabel = uriString;
            if (uriLabel.length > 40) {
                uriLabel = `${uriLabel.substring(0, 30)}...${uriLabel.substring(uriLabel.length - 5)}`;
            }
            const result = await this.dialogService.confirm({
                message: localize('confirmUrl', "Allow '{0}' extension to open this URI?", extensionDisplayName),
                checkbox: {
                    label: localize('rememberConfirmUrl', "Do not ask me again for this extension"),
                },
                primaryButton: localize({ key: 'open', comment: ['&& denotes a mnemonic'] }, "&&Open"),
                custom: {
                    markdownDetails: [{
                            markdown: new MarkdownString(`<div title="${uriString}" aria-label='${uriString}'>${uriLabel}</div>`, { supportHtml: true }),
                        }]
                }
            });
            if (!result.confirmed) {
                return true;
            }
            if (result.checkboxChecked) {
                this.userTrustedExtensionsStorage.add(ExtensionIdentifier.toKey(extensionId));
            }
        }
        const handler = this.extensionHandlers.get(ExtensionIdentifier.toKey(extensionId));
        if (handler) {
            if (!initialHandler) {
                // forward it directly
                return await this.handleURLByExtension(extensionId, handler, uri, options);
            }
            // let the ExtensionUrlHandler instance handle this
            return false;
        }
        // collect URI for eventual extension activation
        const timestamp = new Date().getTime();
        let uris = this.uriBuffer.get(ExtensionIdentifier.toKey(extensionId));
        if (!uris) {
            uris = [];
            this.uriBuffer.set(ExtensionIdentifier.toKey(extensionId), uris);
        }
        uris.push({ timestamp, uri });
        // activate the extension using ActivationKind.Immediate because URI handling might be part
        // of resolving authorities (via authentication extensions)
        await this.extensionService.activateByEvent(`onUri:${ExtensionIdentifier.toKey(extensionId)}`, 1 /* ActivationKind.Immediate */);
        return true;
    }
    registerExtensionHandler(extensionId, handler) {
        this.extensionHandlers.set(ExtensionIdentifier.toKey(extensionId), handler);
        const uris = this.uriBuffer.get(ExtensionIdentifier.toKey(extensionId)) || [];
        for (const { uri } of uris) {
            this.handleURLByExtension(extensionId, handler, uri);
        }
        this.uriBuffer.delete(ExtensionIdentifier.toKey(extensionId));
    }
    unregisterExtensionHandler(extensionId) {
        this.extensionHandlers.delete(ExtensionIdentifier.toKey(extensionId));
    }
    async handleURLByExtension(extensionId, handler, uri, options) {
        return await handler.handleURL(uri, options);
    }
    async handleUnhandledURL(uri, extensionId, options) {
        try {
            await this.commandService.executeCommand('workbench.extensions.installExtension', extensionId, {
                justification: {
                    reason: `${localize('installDetail', "This extension wants to open a URI:")}\n${uri.toString()}`,
                    action: localize('openUri', "Open URI")
                },
                enable: true,
                installPreReleaseVersion: this.productService.quality !== 'stable'
            });
        }
        catch (error) {
            if (!isCancellationError(error)) {
                this.notificationService.error(error);
            }
            return;
        }
        const extension = await this.extensionService.getExtension(extensionId);
        if (extension) {
            await this.handleURL(uri, { ...options, trusted: true });
        }
        /* Extension cannot be added and require window reload */
        else {
            const result = await this.dialogService.confirm({
                message: localize('reloadAndHandle', "Extension '{0}' is not loaded. Would you like to reload the window to load the extension and open the URL?", extensionId),
                primaryButton: localize({ key: 'reloadAndOpen', comment: ['&& denotes a mnemonic'] }, "&&Reload Window and Open")
            });
            if (!result.confirmed) {
                return;
            }
            this.storageService.store(URL_TO_HANDLE, JSON.stringify(uri.toJSON()), 1 /* StorageScope.WORKSPACE */, 1 /* StorageTarget.MACHINE */);
            await this.hostService.reload();
        }
    }
    // forget about all uris buffered more than 5 minutes ago
    garbageCollect() {
        const now = new Date().getTime();
        const uriBuffer = new Map();
        this.uriBuffer.forEach((uris, extensionId) => {
            uris = uris.filter(({ timestamp }) => now - timestamp < FIVE_MINUTES);
            if (uris.length > 0) {
                uriBuffer.set(extensionId, uris);
            }
        });
        this.uriBuffer = uriBuffer;
    }
    didUserTrustExtension(id) {
        if (this.userTrustedExtensionsStorage.has(id)) {
            return true;
        }
        return this.getConfirmedTrustedExtensionIdsFromConfiguration().indexOf(id) > -1;
    }
    getConfirmedTrustedExtensionIdsFromConfiguration() {
        const trustedExtensionIds = this.configurationService.getValue(USER_TRUSTED_EXTENSIONS_CONFIGURATION_KEY);
        if (!Array.isArray(trustedExtensionIds)) {
            return [];
        }
        return trustedExtensionIds;
    }
    dispose() {
        this.disposable.dispose();
        this.extensionHandlers.clear();
        this.uriBuffer.clear();
    }
};
ExtensionUrlHandler = __decorate([
    __param(0, IURLService),
    __param(1, IExtensionService),
    __param(2, IDialogService),
    __param(3, ICommandService),
    __param(4, IHostService),
    __param(5, IStorageService),
    __param(6, IConfigurationService),
    __param(7, INotificationService),
    __param(8, IProductService)
], ExtensionUrlHandler);
registerSingleton(IExtensionUrlHandler, ExtensionUrlHandler, 0 /* InstantiationType.Eager */);
/**
 * This class handles URLs before `ExtensionUrlHandler` is instantiated.
 * More info: https://github.com/microsoft/vscode/issues/73101
 */
let ExtensionUrlBootstrapHandler = class ExtensionUrlBootstrapHandler {
    static { ExtensionUrlBootstrapHandler_1 = this; }
    static { this.ID = 'workbench.contrib.extensionUrlBootstrapHandler'; }
    static { this._cache = []; }
    static get cache() {
        ExtensionUrlBootstrapHandler_1.disposable.dispose();
        const result = ExtensionUrlBootstrapHandler_1._cache;
        ExtensionUrlBootstrapHandler_1._cache = [];
        return result;
    }
    constructor(urlService) {
        ExtensionUrlBootstrapHandler_1.disposable = urlService.registerHandler(this);
    }
    async handleURL(uri, options) {
        if (!isExtensionId(uri.authority)) {
            return false;
        }
        ExtensionUrlBootstrapHandler_1._cache.push([uri, options]);
        return true;
    }
};
ExtensionUrlBootstrapHandler = ExtensionUrlBootstrapHandler_1 = __decorate([
    __param(0, IURLService)
], ExtensionUrlBootstrapHandler);
registerWorkbenchContribution2(ExtensionUrlBootstrapHandler.ID, ExtensionUrlBootstrapHandler, 2 /* WorkbenchPhase.BlockRestore */);
class ManageAuthorizedExtensionURIsAction extends Action2 {
    constructor() {
        super({
            id: 'workbench.extensions.action.manageAuthorizedExtensionURIs',
            title: localize2('manage', 'Manage Authorized Extension URIs...'),
            category: localize2('extensions', 'Extensions'),
            menu: {
                id: MenuId.CommandPalette,
                when: IsWebContext.toNegated()
            }
        });
    }
    async run(accessor) {
        const storageService = accessor.get(IStorageService);
        const quickInputService = accessor.get(IQuickInputService);
        const storage = new UserTrustedExtensionIdStorage(storageService);
        const items = storage.extensions.map((label) => ({ label, picked: true }));
        if (items.length === 0) {
            await quickInputService.pick([{ label: localize('no', 'There are currently no authorized extension URIs.') }]);
            return;
        }
        const result = await quickInputService.pick(items, { canPickMany: true });
        if (!result) {
            return;
        }
        storage.set(result.map(item => item.label));
    }
}
registerAction2(ManageAuthorizedExtensionURIsAction);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uVXJsSGFuZGxlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9ucy9icm93c2VyL2V4dGVuc2lvblVybEhhbmRsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFlLGtCQUFrQixFQUFFLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEYsT0FBTyxFQUFFLGVBQWUsRUFBb0IsTUFBTSw0REFBNEQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsZUFBZSxFQUErQixNQUFNLGdEQUFnRCxDQUFDO0FBQzlHLE9BQU8sRUFBZSxXQUFXLEVBQW1CLE1BQU0sd0NBQXdDLENBQUM7QUFDbkcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQzFELE9BQU8sRUFBa0IsaUJBQWlCLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUM1RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUMzRixPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUEwQyw4QkFBOEIsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzFILE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxrQkFBa0Is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