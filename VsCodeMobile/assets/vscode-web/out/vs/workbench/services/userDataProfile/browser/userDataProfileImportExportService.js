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
import './media/userDataProfileView.css';
import { localize } from '../../../../nls.js';
import { isMarkdownString } from '../../../../base/common/htmlContent.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Emitter } from '../../../../base/common/event.js';
import { IUserDataProfileImportExportService, PROFILE_FILTER, PROFILE_EXTENSION, IUserDataProfileService, PROFILES_CATEGORY, IUserDataProfileManagementService, PROFILE_URL_AUTHORITY, toUserDataProfileUri, isProfileURL, PROFILE_URL_AUTHORITY_PREFIX } from '../common/userDataProfile.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { IDialogService, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { ITextFileService } from '../../textfile/common/textfiles.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile.js';
import { SettingsResource, SettingsResourceTreeItem } from './settingsResource.js';
import { KeybindingsResource, KeybindingsResourceTreeItem } from './keybindingsResource.js';
import { SnippetsResource, SnippetsResourceTreeItem } from './snippetsResource.js';
import { TasksResource, TasksResourceTreeItem } from './tasksResource.js';
import { ExtensionsResource, ExtensionsResourceExportTreeItem, ExtensionsResourceTreeItem } from './extensionsResource.js';
import { GlobalStateResource, GlobalStateResourceExportTreeItem, GlobalStateResourceTreeItem } from './globalStateResource.js';
import { InMemoryFileSystemProvider } from '../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { IExtensionService } from '../../extensions/common/extensions.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { joinPath } from '../../../../base/common/resources.js';
import { escapeRegExpCharacters } from '../../../../base/common/strings.js';
import { Schemas } from '../../../../base/common/network.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import Severity from '../../../../base/common/severity.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { asText, IRequestService } from '../../../../platform/request/common/request.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { isUndefined } from '../../../../base/common/types.js';
import { createCancelablePromise } from '../../../../base/common/async.js';
function isUserDataProfileTemplate(thing) {
    const candidate = thing;
    return !!(candidate && typeof candidate === 'object'
        && (candidate.name && typeof candidate.name === 'string')
        && (isUndefined(candidate.icon) || typeof candidate.icon === 'string')
        && (isUndefined(candidate.settings) || typeof candidate.settings === 'string')
        && (isUndefined(candidate.globalState) || typeof candidate.globalState === 'string')
        && (isUndefined(candidate.extensions) || typeof candidate.extensions === 'string'));
}
let UserDataProfileImportExportService = class UserDataProfileImportExportService extends Disposable {
    constructor(instantiationService, userDataProfileService, userDataProfileManagementService, userDataProfilesService, extensionService, quickInputService, progressService, dialogService, clipboardService, openerService, requestService, productService, uriIdentityService) {
        super();
        this.instantiationService = instantiationService;
        this.userDataProfileService = userDataProfileService;
        this.userDataProfileManagementService = userDataProfileManagementService;
        this.userDataProfilesService = userDataProfilesService;
        this.extensionService = extensionService;
        this.quickInputService = quickInputService;
        this.progressService = progressService;
        this.dialogService = dialogService;
        this.clipboardService = clipboardService;
        this.openerService = openerService;
        this.requestService = requestService;
        this.productService = productService;
        this.uriIdentityService = uriIdentityService;
        this.profileContentHandlers = new Map();
        this.registerProfileContentHandler(Schemas.file, this.fileUserDataProfileContentHandler = instantiationService.createInstance(FileUserDataProfileContentHandler));
    }
    registerProfileContentHandler(id, profileContentHandler) {
        if (this.profileContentHandlers.has(id)) {
            throw new Error(`Profile content handler with id '${id}' already registered.`);
        }
        this.profileContentHandlers.set(id, profileContentHandler);
        return toDisposable(() => this.unregisterProfileContentHandler(id));
    }
    unregisterProfileContentHandler(id) {
        this.profileContentHandlers.delete(id);
    }
    async createFromProfile(from, options, token) {
        const disposables = new DisposableStore();
        let creationPromise;
        disposables.add(token.onCancellationRequested(() => creationPromise.cancel()));
        let profile;
        return this.progressService.withProgress({
            location: 15 /* ProgressLocation.Notification */,
            delay: 500,
            sticky: true,
            cancellable: true,
        }, async (progress) => {
            const reportProgress = (message) => progress.report({ message: localize('create from profile', "Create Profile: {0}", message) });
            creationPromise = createCancelablePromise(async (token) => {
                const userDataProfilesExportState = disposables.add(this.instantiationService.createInstance(UserDataProfileExportState, from, { ...options?.resourceTypeFlags, extensions: false }));
                const profileTemplate = await userDataProfilesExportState.getProfileTemplate(options.name ?? from.name, options?.icon);
                profile = await this.getProfileToImport({ ...profileTemplate, name: options.name ?? profileTemplate.name }, !!options.transient, options);
                if (!profile) {
                    return;
                }
                if (token.isCancellationRequested) {
                    return;
                }
                await this.applyProfileTemplate(profileTemplate, profile, options, reportProgress, token);
            });
            try {
                await creationPromise;
                if (profile && (options?.resourceTypeFlags?.extensions ?? true)) {
                    reportProgress(localize('installing extensions', "Installing Extensions..."));
                    await this.instantiationService.createInstance(ExtensionsResource).copy(from, profile, false);
                }
            }
            catch (error) {
                if (profile) {
                    await this.userDataProfilesService.removeProfile(profile);
                    profile = undefined;
                }
            }
            return profile;
        }, () => creationPromise.cancel()).finally(() => disposables.dispose());
    }
    async createProfileFromTemplate(profileTemplate, options, token) {
        const disposables = new DisposableStore();
        let creationPromise;
        disposables.add(token.onCancellationRequested(() => creationPromise.cancel()));
        let profile;
        return this.progressService.withProgress({
            location: 15 /* ProgressLocation.Notification */,
            delay: 500,
            sticky: true,
            cancellable: true,
        }, async (progress) => {
            const reportProgress = (message) => progress.report({ message: localize('create from profile', "Create Profile: {0}", message) });
            creationPromise = createCancelablePromise(async (token) => {
                profile = await this.getProfileToImport({ ...profileTemplate, name: options.name ?? profileTemplate.name }, !!options.transient, options);
                if (!profile) {
                    return;
                }
                if (token.isCancellationRequested) {
                    return;
                }
                await this.applyProfileTemplate(profileTemplate, profile, options, reportProgress, token);
            });
            try {
                await creationPromise;
            }
            catch (error) {
                if (profile) {
                    await this.userDataProfilesService.removeProfile(profile);
                    profile = undefined;
                }
            }
            return profile;
        }, () => creationPromise.cancel()).finally(() => disposables.dispose());
    }
    async applyProfileTemplate(profileTemplate, profile, options, reportProgress, token) {
        if (profileTemplate.settings && (options.resourceTypeFlags?.settings ?? true) && !profile.useDefaultFlags?.settings) {
            reportProgress(localize('creating settings', "Creating Settings..."));
            await this.instantiationService.createInstance(SettingsResource).apply(profileTemplate.settings, profile);
        }
        if (token.isCancellationRequested) {
            return;
        }
        if (profileTemplate.keybindings && (options.resourceTypeFlags?.keybindings ?? true) && !profile.useDefaultFlags?.keybindings) {
            reportProgress(localize('create keybindings', "Creating Keyboard Shortcuts..."));
            await this.instantiationService.createInstance(KeybindingsResource).apply(profileTemplate.keybindings, profile);
        }
        if (token.isCancellationRequested) {
            return;
        }
        if (profileTemplate.tasks && (options.resourceTypeFlags?.tasks ?? true) && !profile.useDefaultFlags?.tasks) {
            reportProgress(localize('create tasks', "Creating Tasks..."));
            await this.instantiationService.createInstance(TasksResource).apply(profileTemplate.tasks, profile);
        }
        if (token.isCancellationRequested) {
            return;
        }
        if (profileTemplate.snippets && (options.resourceTypeFlags?.snippets ?? true) && !profile.useDefaultFlags?.snippets) {
            reportProgress(localize('create snippets', "Creating Snippets..."));
            await this.instantiationService.createInstance(SnippetsResource).apply(profileTemplate.snippets, profile);
        }
        if (token.isCancellationRequested) {
            return;
        }
        if (profileTemplate.globalState && !profile.useDefaultFlags?.globalState) {
            reportProgress(localize('applying global state', "Applying UI State..."));
            await this.instantiationService.createInstance(GlobalStateResource).apply(profileTemplate.globalState, profile);
        }
        if (token.isCancellationRequested) {
            return;
        }
        if (profileTemplate.extensions && (options.resourceTypeFlags?.extensions ?? true) && !profile.useDefaultFlags?.extensions) {
            reportProgress(localize('installing extensions', "Installing Extensions..."));
            await this.instantiationService.createInstance(ExtensionsResource).apply(profileTemplate.extensions, profile, reportProgress, token);
        }
    }
    async exportProfile(profile, exportFlags) {
        const disposables = new DisposableStore();
        try {
            const userDataProfilesExportState = disposables.add(this.instantiationService.createInstance(UserDataProfileExportState, profile, exportFlags));
            await this.doExportProfile(userDataProfilesExportState, 15 /* ProgressLocation.Notification */);
        }
        finally {
            disposables.dispose();
        }
    }
    async createTroubleshootProfile() {
        const userDataProfilesExportState = this.instantiationService.createInstance(UserDataProfileExportState, this.userDataProfileService.currentProfile, undefined);
        try {
            const profileTemplate = await userDataProfilesExportState.getProfileTemplate(localize('troubleshoot issue', "Troubleshoot Issue"), undefined);
            await this.progressService.withProgress({
                location: 15 /* ProgressLocation.Notification */,
                delay: 1000,
                sticky: true,
            }, async (progress) => {
                const reportProgress = (message) => progress.report({ message: localize('troubleshoot profile progress', "Setting up Troubleshoot Profile: {0}", message) });
                const profile = await this.doCreateProfile(profileTemplate, true, false, { useDefaultFlags: this.userDataProfileService.currentProfile.useDefaultFlags }, reportProgress);
                if (profile) {
                    reportProgress(localize('progress extensions', "Applying Extensions..."));
                    await this.instantiationService.createInstance(ExtensionsResource).copy(this.userDataProfileService.currentProfile, profile, true);
                    reportProgress(localize('switching profile', "Switching Profile..."));
                    await this.userDataProfileManagementService.switchProfile(profile);
                }
            });
        }
        finally {
            userDataProfilesExportState.dispose();
        }
    }
    async doExportProfile(userDataProfilesExportState, location) {
        const profile = await userDataProfilesExportState.getProfileToExport();
        if (!profile) {
            return;
        }
        const disposables = new DisposableStore();
        try {
            await this.progressService.withProgress({
                location,
                title: localize('profiles.exporting', "{0}: Exporting...", PROFILES_CATEGORY.value),
            }, async (progress) => {
                const id = await this.pickProfileContentHandler(profile.name);
                if (!id) {
                    return;
                }
                const profileContentHandler = this.profileContentHandlers.get(id);
                if (!profileContentHandler) {
                    return;
                }
                const saveResult = await profileContentHandler.saveProfile(profile.name.replace('/', '-'), JSON.stringify(profile), CancellationToken.None);
                if (!saveResult) {
                    return;
                }
                const message = localize('export success', "Profile '{0}' was exported successfully.", profile.name);
                if (profileContentHandler.extensionId) {
                    const buttons = [];
                    const link = this.productService.webUrl ? `${this.productService.webUrl}/${PROFILE_URL_AUTHORITY}/${id}/${saveResult.id}` : toUserDataProfileUri(`/${id}/${saveResult.id}`, this.productService).toString();
                    buttons.push({
                        label: localize({ key: 'copy', comment: ['&& denotes a mnemonic'] }, "&&Copy Link"),
                        run: () => this.clipboardService.writeText(link)
                    });
                    if (this.productService.webUrl) {
                        buttons.push({
                            label: localize({ key: 'open', comment: ['&& denotes a mnemonic'] }, "&&Open Link"),
                            run: async () => {
                                await this.openerService.open(link);
                            }
                        });
                    }
                    else {
                        buttons.push({
                            label: localize({ key: 'open in', comment: ['&& denotes a mnemonic'] }, "&&Open in {0}", profileContentHandler.name),
                            run: async () => {
                                await this.openerService.open(saveResult.link.toString());
                            }
                        });
                    }
                    await this.dialogService.prompt({
                        type: Severity.Info,
                        message,
                        buttons,
                        cancelButton: localize('close', "Close")
                    });
                }
                else {
                    await this.dialogService.info(message);
                }
            });
        }
        finally {
            disposables.dispose();
        }
    }
    async resolveProfileTemplate(uri, options) {
        const profileContent = await this.resolveProfileContent(uri);
        if (profileContent === null) {
            return null;
        }
        let profileTemplate;
        try {
            profileTemplate = JSON.parse(profileContent);
        }
        catch (error) {
            throw new Error(localize('invalid profile content', "This profile is not valid."));
        }
        if (!isUserDataProfileTemplate(profileTemplate)) {
            throw new Error(localize('invalid profile content', "This profile is not valid."));
        }
        if (options?.name) {
            profileTemplate.name = options.name;
        }
        if (options?.icon) {
            profileTemplate.icon = options.icon;
        }
        if (options?.resourceTypeFlags?.settings === false) {
            profileTemplate.settings = undefined;
        }
        if (options?.resourceTypeFlags?.keybindings === false) {
            profileTemplate.keybindings = undefined;
        }
        if (options?.resourceTypeFlags?.snippets === false) {
            profileTemplate.snippets = undefined;
        }
        if (options?.resourceTypeFlags?.tasks === false) {
            profileTemplate.tasks = undefined;
        }
        if (options?.resourceTypeFlags?.globalState === false) {
            profileTemplate.globalState = undefined;
        }
        if (options?.resourceTypeFlags?.extensions === false) {
            profileTemplate.extensions = undefined;
        }
        return profileTemplate;
    }
    async doCreateProfile(profileTemplate, temporaryProfile, extensions, options, progress) {
        const profile = await this.getProfileToImport(profileTemplate, temporaryProfile, options);
        if (!profile) {
            return undefined;
        }
        if (profileTemplate.settings && !profile.useDefaultFlags?.settings) {
            progress(localize('progress settings', "Applying Settings..."));
            await this.instantiationService.createInstance(SettingsResource).apply(profileTemplate.settings, profile);
        }
        if (profileTemplate.keybindings && !profile.useDefaultFlags?.keybindings) {
            progress(localize('progress keybindings', "Applying Keyboard Shortcuts..."));
            await this.instantiationService.createInstance(KeybindingsResource).apply(profileTemplate.keybindings, profile);
        }
        if (profileTemplate.tasks && !profile.useDefaultFlags?.tasks) {
            progress(localize('progress tasks', "Applying Tasks..."));
            await this.instantiationService.createInstance(TasksResource).apply(profileTemplate.tasks, profile);
        }
        if (profileTemplate.snippets && !profile.useDefaultFlags?.snippets) {
            progress(localize('progress snippets', "Applying Snippets..."));
            await this.instantiationService.createInstance(SnippetsResource).apply(profileTemplate.snippets, profile);
        }
        if (profileTemplate.globalState && !profile.useDefaultFlags?.globalState) {
            progress(localize('progress global state', "Applying State..."));
            await this.instantiationService.createInstance(GlobalStateResource).apply(profileTemplate.globalState, profile);
        }
        if (profileTemplate.extensions && extensions && !profile.useDefaultFlags?.extensions) {
            progress(localize('progress extensions', "Applying Extensions..."));
            await this.instantiationService.createInstance(ExtensionsResource).apply(profileTemplate.extensions, profile);
        }
        return profile;
    }
    async resolveProfileContent(resource) {
        if (await this.fileUserDataProfileContentHandler.canHandle(resource)) {
            return this.fileUserDataProfileContentHandler.readProfile(resource, CancellationToken.None);
        }
        if (isProfileURL(resource)) {
            let handlerId, idOrUri;
            if (resource.authority === PROFILE_URL_AUTHORITY) {
                idOrUri = this.uriIdentityService.extUri.basename(resource);
                handlerId = this.uriIdentityService.extUri.basename(this.uriIdentityService.extUri.dirname(resource));
            }
            else {
                handlerId = resource.authority.substring(PROFILE_URL_AUTHORITY_PREFIX.length);
                idOrUri = URI.parse(resource.path.substring(1));
            }
            await this.extensionService.activateByEvent(`onProfile:${handlerId}`);
            const profileContentHandler = this.profileContentHandlers.get(handlerId);
            if (profileContentHandler) {
                return profileContentHandler.readProfile(idOrUri, CancellationToken.None);
            }
        }
        await this.extensionService.activateByEvent('onProfile');
        for (const profileContentHandler of this.profileContentHandlers.values()) {
            const content = await profileContentHandler.readProfile(resource, CancellationToken.None);
            if (content !== null) {
                return content;
            }
        }
        const context = await this.requestService.request({ type: 'GET', url: resource.toString(true) }, CancellationToken.None);
        if (context.res.statusCode === 200) {
            return await asText(context);
        }
        else {
            const message = await asText(context);
            throw new Error(`Failed to get profile from URL: ${resource.toString()}. Status code: ${context.res.statusCode}. Message: ${message}`);
        }
    }
    async pickProfileContentHandler(name) {
        await this.extensionService.activateByEvent('onProfile');
        if (this.profileContentHandlers.size === 1) {
            return this.profileContentHandlers.keys().next().value;
        }
        const options = [];
        for (const [id, profileContentHandler] of this.profileContentHandlers) {
            options.push({ id, label: profileContentHandler.name, description: profileContentHandler.description });
        }
        const result = await this.quickInputService.pick(options.reverse(), {
            title: localize('select profile content handler', "Export '{0}' profile as...", name),
            hideInput: true
        });
        return result?.id;
    }
    async getProfileToImport(profileTemplate, temp, options) {
        const profileName = profileTemplate.name;
        const profile = this.userDataProfilesService.profiles.find(p => p.name === profileName);
        if (profile) {
            if (temp) {
                return this.userDataProfilesService.createNamedProfile(`${profileName} ${this.getProfileNameIndex(profileName)}`, { ...options, transient: temp });
            }
            const { confirmed } = await this.dialogService.confirm({
                type: Severity.Info,
                message: localize('profile already exists', "Profile with name '{0}' already exists. Do you want to replace its contents?", profileName),
                primaryButton: localize({ key: 'overwrite', comment: ['&& denotes a mnemonic'] }, "&&Replace")
            });
            if (!confirmed) {
                return undefined;
            }
            return profile.isDefault ? profile : this.userDataProfilesService.updateProfile(profile, options);
        }
        else {
            return this.userDataProfilesService.createNamedProfile(profileName, { ...options, transient: temp });
        }
    }
    getProfileNameIndex(name) {
        const nameRegEx = new RegExp(`${escapeRegExpCharacters(name)}\\s(\\d+)`);
        let nameIndex = 0;
        for (const profile of this.userDataProfilesService.profiles) {
            const matches = nameRegEx.exec(profile.name);
            const index = matches ? parseInt(matches[1]) : 0;
            nameIndex = index > nameIndex ? index : nameIndex;
        }
        return nameIndex + 1;
    }
};
UserDataProfileImportExportService = __decorate([
    __param(0, IInstantiationService),
    __param(1, IUserDataProfileService),
    __param(2, IUserDataProfileManagementService),
    __param(3, IUserDataProfilesService),
    __param(4, IExtensionService),
    __param(5, IQuickInputService),
    __param(6, IProgressService),
    __param(7, IDialogService),
    __param(8, IClipboardService),
    __param(9, IOpenerService),
    __param(10, IRequestService),
    __param(11, IProductService),
    __param(12, IUriIdentityService)
], UserDataProfileImportExportService);
export { UserDataProfileImportExportService };
let FileUserDataProfileContentHandler = class FileUserDataProfileContentHandler {
    constructor(fileDialogService, uriIdentityService, fileService, productService, textFileService) {
        this.fileDialogService = fileDialogService;
        this.uriIdentityService = uriIdentityService;
        this.fileService = fileService;
        this.productService = productService;
        this.textFileService = textFileService;
        this.name = localize('local', "Local");
        this.description = localize('file', "file");
    }
    async saveProfile(name, content, token) {
        const link = await this.fileDialogService.showSaveDialog({
            title: localize('export profile dialog', "Save Profile"),
            filters: PROFILE_FILTER,
            defaultUri: this.uriIdentityService.extUri.joinPath(await this.fileDialogService.defaultFilePath(), `${name}.${PROFILE_EXTENSION}`),
        });
        if (!link) {
            return null;
        }
        await this.textFileService.create([{ resource: link, value: content, options: { overwrite: true } }]);
        return { link, id: link.toString() };
    }
    async canHandle(uri) {
        return uri.scheme !== Schemas.http && uri.scheme !== Schemas.https && uri.scheme !== this.productService.urlProtocol && await this.fileService.canHandleResource(uri);
    }
    async readProfile(uri, token) {
        if (await this.canHandle(uri)) {
            return (await this.fileService.readFile(uri, undefined, token)).value.toString();
        }
        return null;
    }
    async selectProfile() {
        const profileLocation = await this.fileDialogService.showOpenDialog({
            canSelectFolders: false,
            canSelectFiles: true,
            canSelectMany: false,
            filters: PROFILE_FILTER,
            title: localize('select profile', "Select Profile"),
        });
        return profileLocation ? profileLocation[0] : null;
    }
};
FileUserDataProfileContentHandler = __decorate([
    __param(0, IFileDialogService),
    __param(1, IUriIdentityService),
    __param(2, IFileService),
    __param(3, IProductService),
    __param(4, ITextFileService)
], FileUserDataProfileContentHandler);
const USER_DATA_PROFILE_EXPORT_SCHEME = 'userdataprofileexport';
const USER_DATA_PROFILE_EXPORT_PREVIEW_SCHEME = 'userdataprofileexportpreview';
let UserDataProfileImportExportState = class UserDataProfileImportExportState extends Disposable {
    constructor(quickInputService) {
        super();
        this.quickInputService = quickInputService;
        this._onDidChangeRoots = this._register(new Emitter());
        this.onDidChangeRoots = this._onDidChangeRoots.event;
        this.roots = [];
    }
    async getChildren(element) {
        if (element) {
            const children = await element.getChildren();
            if (children) {
                for (const child of children) {
                    if (child.parent.checkbox && child.checkbox) {
                        child.checkbox.isChecked = child.parent.checkbox.isChecked && child.checkbox.isChecked;
                    }
                }
            }
            return children;
        }
        else {
            this.rootsPromise = undefined;
            this._onDidChangeRoots.fire();
            return this.getRoots();
        }
    }
    getRoots() {
        if (!this.rootsPromise) {
            this.rootsPromise = (async () => {
                this.roots = await this.fetchRoots();
                for (const root of this.roots) {
                    const labelText = isMarkdownString(root.label.label) ? root.label.label.value : root.label.label;
                    root.checkbox = {
                        isChecked: !root.isFromDefaultProfile(),
                        tooltip: localize('select', "Select {0}", labelText),
                        accessibilityInformation: {
                            label: localize('select', "Select {0}", labelText),
                        }
                    };
                    if (root.isFromDefaultProfile()) {
                        root.description = localize('from default', "From Default Profile");
                    }
                }
                return this.roots;
            })();
        }
        return this.rootsPromise;
    }
    isEnabled(resourceType) {
        if (resourceType !== undefined) {
            return this.roots.some(root => root.type === resourceType && this.isSelected(root));
        }
        return this.roots.some(root => this.isSelected(root));
    }
    async getProfileTemplate(name, icon) {
        const roots = await this.getRoots();
        let settings;
        let keybindings;
        let tasks;
        let snippets;
        let extensions;
        let globalState;
        for (const root of roots) {
            if (!this.isSelected(root)) {
                continue;
            }
            if (root instanceof SettingsResourceTreeItem) {
                settings = await root.getContent();
            }
            else if (root instanceof KeybindingsResourceTreeItem) {
                keybindings = await root.getContent();
            }
            else if (root instanceof TasksResourceTreeItem) {
                tasks = await root.getContent();
            }
            else if (root instanceof SnippetsResourceTreeItem) {
                snippets = await root.getContent();
            }
            else if (root instanceof ExtensionsResourceTreeItem) {
                extensions = await root.getContent();
            }
            else if (root instanceof GlobalStateResourceTreeItem) {
                globalState = await root.getContent();
            }
        }
        return {
            name,
            icon,
            settings,
            keybindings,
            tasks,
            snippets,
            extensions,
            globalState
        };
    }
    isSelected(treeItem) {
        if (treeItem.checkbox) {
            return treeItem.checkbox.isChecked || !!treeItem.children?.some(child => child.checkbox?.isChecked);
        }
        return true;
    }
};
UserDataProfileImportExportState = __decorate([
    __param(0, IQuickInputService)
], UserDataProfileImportExportState);
let UserDataProfileExportState = class UserDataProfileExportState extends UserDataProfileImportExportState {
    constructor(profile, exportFlags, quickInputService, fileService, instantiationService) {
        super(quickInputService);
        this.profile = profile;
        this.exportFlags = exportFlags;
        this.fileService = fileService;
        this.instantiationService = instantiationService;
        this.disposables = this._register(new DisposableStore());
    }
    async fetchRoots() {
        this.disposables.clear();
        this.disposables.add(this.fileService.registerProvider(USER_DATA_PROFILE_EXPORT_SCHEME, this._register(new InMemoryFileSystemProvider())));
        const previewFileSystemProvider = this._register(new InMemoryFileSystemProvider());
        this.disposables.add(this.fileService.registerProvider(USER_DATA_PROFILE_EXPORT_PREVIEW_SCHEME, previewFileSystemProvider));
        const roots = [];
        const exportPreviewProfle = this.createExportPreviewProfile(this.profile);
        if (this.exportFlags?.settings ?? true) {
            const settingsResource = this.instantiationService.createInstance(SettingsResource);
            const settingsContent = await settingsResource.getContent(this.profile);
            await settingsResource.apply(settingsContent, exportPreviewProfle);
            const settingsResourceTreeItem = this.instantiationService.createInstance(SettingsResourceTreeItem, exportPreviewProfle);
            if (await settingsResourceTreeItem.hasContent()) {
                roots.push(settingsResourceTreeItem);
            }
        }
        if (this.exportFlags?.keybindings ?? true) {
            const keybindingsResource = this.instantiationService.createInstance(KeybindingsResource);
            const keybindingsContent = await keybindingsResource.getContent(this.profile);
            await keybindingsResource.apply(keybindingsContent, exportPreviewProfle);
            const keybindingsResourceTreeItem = this.instantiationService.createInstance(KeybindingsResourceTreeItem, exportPreviewProfle);
            if (await keybindingsResourceTreeItem.hasContent()) {
                roots.push(keybindingsResourceTreeItem);
            }
        }
        if (this.exportFlags?.snippets ?? true) {
            const snippetsResource = this.instantiationService.createInstance(SnippetsResource);
            const snippetsContent = await snippetsResource.getContent(this.profile);
            await snippetsResource.apply(snippetsContent, exportPreviewProfle);
            const snippetsResourceTreeItem = this.instantiationService.createInstance(SnippetsResourceTreeItem, exportPreviewProfle);
            if (await snippetsResourceTreeItem.hasContent()) {
                roots.push(snippetsResourceTreeItem);
            }
        }
        if (this.exportFlags?.tasks ?? true) {
            const tasksResource = this.instantiationService.createInstance(TasksResource);
            const tasksContent = await tasksResource.getContent(this.profile);
            await tasksResource.apply(tasksContent, exportPreviewProfle);
            const tasksResourceTreeItem = this.instantiationService.createInstance(TasksResourceTreeItem, exportPreviewProfle);
            if (await tasksResourceTreeItem.hasContent()) {
                roots.push(tasksResourceTreeItem);
            }
        }
        if (this.exportFlags?.globalState ?? true) {
            const globalStateResource = joinPath(exportPreviewProfle.globalStorageHome, 'globalState.json').with({ scheme: USER_DATA_PROFILE_EXPORT_PREVIEW_SCHEME });
            const globalStateResourceTreeItem = this.instantiationService.createInstance(GlobalStateResourceExportTreeItem, exportPreviewProfle, globalStateResource);
            const content = await globalStateResourceTreeItem.getContent();
            if (content) {
                await this.fileService.writeFile(globalStateResource, VSBuffer.fromString(JSON.stringify(JSON.parse(content), null, '\t')));
                roots.push(globalStateResourceTreeItem);
            }
        }
        if (this.exportFlags?.extensions ?? true) {
            const extensionsResourceTreeItem = this.instantiationService.createInstance(ExtensionsResourceExportTreeItem, exportPreviewProfle);
            if (await extensionsResourceTreeItem.hasContent()) {
                roots.push(extensionsResourceTreeItem);
            }
        }
        previewFileSystemProvider.setReadOnly(true);
        return roots;
    }
    createExportPreviewProfile(profile) {
        return {
            id: profile.id,
            name: profile.name,
            location: profile.location,
            isDefault: profile.isDefault,
            icon: profile.icon,
            globalStorageHome: profile.globalStorageHome,
            settingsResource: profile.settingsResource.with({ scheme: USER_DATA_PROFILE_EXPORT_SCHEME }),
            keybindingsResource: profile.keybindingsResource.with({ scheme: USER_DATA_PROFILE_EXPORT_SCHEME }),
            tasksResource: profile.tasksResource.with({ scheme: USER_DATA_PROFILE_EXPORT_SCHEME }),
            mcpResource: profile.mcpResource.with({ scheme: USER_DATA_PROFILE_EXPORT_SCHEME }),
            snippetsHome: profile.snippetsHome.with({ scheme: USER_DATA_PROFILE_EXPORT_SCHEME }),
            promptsHome: profile.promptsHome.with({ scheme: USER_DATA_PROFILE_EXPORT_SCHEME }),
            extensionsResource: profile.extensionsResource,
            cacheHome: profile.cacheHome,
            useDefaultFlags: profile.useDefaultFlags,
            isTransient: profile.isTransient
        };
    }
    async getProfileToExport() {
        let name = this.profile.name;
        if (this.profile.isDefault) {
            name = await this.quickInputService.input({
                placeHolder: localize('export profile name', "Name the profile"),
                title: localize('export profile title', "Export Profile"),
                async validateInput(input) {
                    if (!input.trim()) {
                        return localize('profile name required', "Profile name must be provided.");
                    }
                    return undefined;
                },
            });
            if (!name) {
                return null;
            }
        }
        return super.getProfileTemplate(name, this.profile.icon);
    }
};
UserDataProfileExportState = __decorate([
    __param(2, IQuickInputService),
    __param(3, IFileService),
    __param(4, IInstantiationService)
], UserDataProfileExportState);
registerSingleton(IUserDataProfileImportExportService, UserDataProfileImportExportService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlckRhdGFQcm9maWxlSW1wb3J0RXhwb3J0U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2Jyb3dzZXIvdXNlckRhdGFQcm9maWxlSW1wb3J0RXhwb3J0U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLGlDQUFpQyxDQUFDO0FBQ3pDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUMxRSxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxtQ0FBbUMsRUFBRSxjQUFjLEVBQUUsaUJBQWlCLEVBQWtDLHVCQUF1QixFQUE0QixpQkFBaUIsRUFBRSxpQ0FBaUMsRUFBNkMscUJBQXFCLEVBQUUsb0JBQW9CLEVBQWlDLFlBQVksRUFBRSw0QkFBNEIsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ2xhLE9BQU8sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFlLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzlHLE9BQU8sRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQWlCLE1BQU0sZ0RBQWdELENBQUM7QUFDbkgsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDN0YsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDdEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDRDQUE0QyxDQUFD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