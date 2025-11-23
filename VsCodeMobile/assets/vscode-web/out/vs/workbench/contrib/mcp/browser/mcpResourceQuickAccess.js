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
import { DeferredPromise, disposableTimeout, RunOnceScheduler } from '../../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Event } from '../../../../base/common/event.js';
import { DisposableStore, toDisposable, Disposable } from '../../../../base/common/lifecycle.js';
import { autorun, derived, observableValue } from '../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { localize } from '../../../../nls.js';
import { ByteSize, IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { DefaultQuickAccessFilterValue } from '../../../../platform/quickinput/common/quickAccess.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IChatWidgetService } from '../../chat/browser/chat.js';
import { IChatAttachmentResolveService } from '../../chat/browser/chatAttachmentResolveService.js';
import { IMcpService, isMcpResourceTemplate, McpResourceURI } from '../common/mcpTypes.js';
import { McpIcons } from '../common/mcpIcons.js';
import { openPanelChatAndGetWidget } from './openPanelChatAndGetWidget.js';
import { LinkedList } from '../../../../base/common/linkedList.js';
let McpResourcePickHelper = class McpResourcePickHelper extends Disposable {
    static sep(server) {
        return {
            id: server.definition.id,
            type: 'separator',
            label: server.definition.label,
        };
    }
    addCurrentMCPQuickPickItemLevel(server, resources) {
        let isValidPush = false;
        isValidPush = this._pickItemsStack.isEmpty();
        if (!isValidPush) {
            const stackedItem = this._pickItemsStack.peek();
            if (stackedItem?.server === server && stackedItem.resources === resources) {
                isValidPush = false;
            }
            else {
                isValidPush = true;
            }
        }
        if (isValidPush) {
            this._pickItemsStack.push({ server, resources });
        }
    }
    navigateBack() {
        const items = this._pickItemsStack.pop();
        if (items) {
            this._inDirectory.set({ server: items.server, resources: items.resources }, undefined);
            return true;
        }
        else {
            return false;
        }
    }
    static item(resource) {
        const iconPath = resource.icons.getUrl(22);
        if (isMcpResourceTemplate(resource)) {
            return {
                id: resource.template.template,
                label: resource.title || resource.name,
                description: resource.description,
                detail: localize('mcp.resource.template', 'Resource template: {0}', resource.template.template),
                iconPath,
            };
        }
        return {
            id: resource.uri.toString(),
            label: resource.title || resource.name,
            description: resource.description,
            detail: resource.mcpUri + (resource.sizeInBytes !== undefined ? ' (' + ByteSize.formatSize(resource.sizeInBytes) + ')' : ''),
            iconPath,
        };
    }
    constructor(_mcpService, _fileService, _quickInputService, _notificationService, _chatAttachmentResolveService) {
        super();
        this._mcpService = _mcpService;
        this._fileService = _fileService;
        this._quickInputService = _quickInputService;
        this._notificationService = _notificationService;
        this._chatAttachmentResolveService = _chatAttachmentResolveService;
        this._resources = observableValue(this, { picks: new Map(), isBusy: false });
        this._pickItemsStack = new LinkedList();
        this._inDirectory = observableValue(this, undefined);
        this.hasServersWithResources = derived(reader => {
            let enabled = false;
            for (const server of this._mcpService.servers.read(reader)) {
                const cap = server.capabilities.read(undefined);
                if (cap === undefined) {
                    enabled = true; // until we know more
                }
                else if (cap & 16 /* McpCapability.Resources */) {
                    enabled = true;
                    break;
                }
            }
            return enabled;
        });
        this.checkIfNestedResources = () => !this._pickItemsStack.isEmpty();
    }
    /**
     * Navigate to a resource if it's a directory.
     * Returns true if the resource is a directory with children (navigation succeeded).
     * Returns false if the resource is a leaf file (no navigation).
     * When returning true, statefully updates the picker state to display directory contents.
     */
    async navigate(resource, server) {
        const uri = await this.toURI(resource);
        if (!uri) {
            return false;
        }
        let stat = undefined;
        try {
            stat = await this._fileService.resolve(uri, { resolveMetadata: false });
        }
        catch (e) {
            return false;
        }
        if (stat && this._isDirectoryResource(resource) && (stat.children?.length ?? 0) > 0) {
            // Save current state to stack before navigating
            const currentResources = this._resources.get().picks.get(server);
            if (currentResources) {
                this.addCurrentMCPQuickPickItemLevel(server, currentResources);
            }
            // Convert all the children to IMcpResource objects
            const childResources = stat.children.map(child => {
                const mcpUri = McpResourceURI.fromServer(server.definition, child.resource.toString());
                return {
                    uri: mcpUri,
                    mcpUri: child.resource.path,
                    name: child.name,
                    title: child.name,
                    description: resource.description,
                    mimeType: undefined,
                    sizeInBytes: child.size,
                    icons: McpIcons.fromParsed(undefined)
                };
            });
            this._inDirectory.set({ server, resources: childResources }, undefined);
            return true;
        }
        return false;
    }
    toAttachment(resource, server) {
        const noop = 'noop';
        if (this._isDirectoryResource(resource)) {
            //Check if directory
            this.checkIfDirectoryAndPopulate(resource, server);
            return noop;
        }
        if (isMcpResourceTemplate(resource)) {
            return this._resourceTemplateToAttachment(resource).then(val => val || noop);
        }
        else {
            return this._resourceToAttachment(resource).then(val => val || noop);
        }
    }
    async checkIfDirectoryAndPopulate(resource, server) {
        try {
            return !await this.navigate(resource, server);
        }
        catch (error) {
            return false;
        }
    }
    async toURI(resource) {
        if (isMcpResourceTemplate(resource)) {
            const maybeUri = await this._resourceTemplateToURI(resource);
            return maybeUri && await this._verifyUriIfNeeded(maybeUri);
        }
        else {
            return resource.uri;
        }
    }
    async _resourceToAttachment(resource) {
        const asImage = await this._chatAttachmentResolveService.resolveImageEditorAttachContext(resource.uri, undefined, resource.mimeType);
        if (asImage) {
            return asImage;
        }
        return {
            id: resource.uri.toString(),
            kind: 'file',
            name: resource.name,
            value: resource.uri,
        };
    }
    async _resourceTemplateToAttachment(rt) {
        const maybeUri = await this._resourceTemplateToURI(rt);
        const uri = maybeUri && await this._verifyUriIfNeeded(maybeUri);
        return uri && this._resourceToAttachment({
            uri,
            name: rt.name,
            mimeType: rt.mimeType,
        });
    }
    async _verifyUriIfNeeded({ uri, needsVerification }) {
        if (!needsVerification) {
            return uri;
        }
        const exists = await this._fileService.exists(uri);
        if (exists) {
            return uri;
        }
        this._notificationService.warn(localize('mcp.resource.template.notFound', "The resource {0} was not found.", McpResourceURI.toServer(uri).resourceURL.toString()));
        return undefined;
    }
    async _resourceTemplateToURI(rt) {
        const todo = rt.template.components.flatMap(c => typeof c === 'object' ? c.variables : []);
        const quickInput = this._quickInputService.createQuickPick();
        const cts = new CancellationTokenSource();
        const vars = {};
        quickInput.totalSteps = todo.length;
        quickInput.ignoreFocusOut = true;
        let needsVerification = false;
        try {
            for (let i = 0; i < todo.length; i++) {
                const variable = todo[i];
                const resolved = await this._promptForTemplateValue(quickInput, variable, vars, rt);
                if (resolved === undefined) {
                    return undefined;
                }
                // mark the URI as needing verification if any part was not a completion pick
                needsVerification ||= !resolved.completed;
                vars[todo[i].name] = variable.repeatable ? resolved.value.split('/') : resolved.value;
            }
            return { uri: rt.resolveURI(vars), needsVerification };
        }
        finally {
            cts.dispose(true);
            quickInput.dispose();
        }
    }
    _promptForTemplateValue(input, variable, variablesSoFar, rt) {
        const store = new DisposableStore();
        const completions = new Map([]);
        const variablesWithPlaceholders = { ...variablesSoFar };
        for (const variable of rt.template.components.flatMap(c => typeof c === 'object' ? c.variables : [])) {
            if (!variablesWithPlaceholders.hasOwnProperty(variable.name)) {
                variablesWithPlaceholders[variable.name] = `$${variable.name.toUpperCase()}`;
            }
        }
        let placeholder = localize('mcp.resource.template.placeholder', "Value for ${0} in {1}", variable.name.toUpperCase(), rt.template.resolve(variablesWithPlaceholders).replaceAll('%24', '$'));
        if (variable.optional) {
            placeholder += ' (' + localize('mcp.resource.template.optional', "Optional") + ')';
        }
        input.placeholder = placeholder;
        input.value = '';
        input.items = [];
        input.show();
        const currentID = generateUuid();
        const setItems = (value, completed = []) => {
            const items = completed.filter(c => c !== value).map(c => ({ id: c, label: c }));
            if (value) {
                items.unshift({ id: currentID, label: value });
            }
            else if (variable.optional) {
                items.unshift({ id: currentID, label: localize('mcp.resource.template.empty', "<Empty>") });
            }
            input.items = items;
        };
        let changeCancellation = store.add(new CancellationTokenSource());
        const getCompletionItems = () => {
            const inputValue = input.value;
            let promise = completions.get(inputValue);
            if (!promise) {
                promise = rt.complete(variable.name, inputValue, variablesSoFar, changeCancellation.token);
                completions.set(inputValue, promise);
            }
            promise.then(values => {
                if (!changeCancellation.token.isCancellationRequested) {
                    setItems(inputValue, values);
                }
            }).catch(() => {
                completions.delete(inputValue);
            }).finally(() => {
                if (!changeCancellation.token.isCancellationRequested) {
                    input.busy = false;
                }
            });
        };
        const getCompletionItemsScheduler = store.add(new RunOnceScheduler(getCompletionItems, 300));
        return new Promise(resolve => {
            store.add(input.onDidHide(() => resolve(undefined)));
            store.add(input.onDidAccept(() => {
                const item = input.selectedItems[0];
                if (item.id === currentID) {
                    resolve({ value: input.value, completed: false });
                }
                else if (variable.explodable && item.label.endsWith('/') && item.label !== input.value) {
                    // if navigating in a path structure, picking a `/` should let the user pick in a subdirectory
                    input.value = item.label;
                }
                else {
                    resolve({ value: item.label, completed: true });
                }
            }));
            store.add(input.onDidChangeValue(value => {
                input.busy = true;
                changeCancellation.dispose(true);
                store.delete(changeCancellation);
                changeCancellation = store.add(new CancellationTokenSource());
                getCompletionItemsScheduler.cancel();
                setItems(value);
                if (completions.has(input.value)) {
                    getCompletionItems();
                }
                else {
                    getCompletionItemsScheduler.schedule();
                }
            }));
            getCompletionItems();
        }).finally(() => store.dispose());
    }
    _isDirectoryResource(resource) {
        if (resource.mimeType && resource.mimeType === 'inode/directory') {
            return true;
        }
        else if (isMcpResourceTemplate(resource)) {
            return resource.template.template.endsWith('/');
        }
        else {
            return resource.uri.path.endsWith('/');
        }
    }
    getPicks(token) {
        const cts = new CancellationTokenSource(token);
        let isBusyLoadingPicks = true;
        this._register(toDisposable(() => cts.dispose(true)));
        // We try to show everything in-sequence to avoid flickering (#250411) as long as
        // it loads within 5 seconds. Otherwise we just show things as the load in parallel.
        let showInSequence = true;
        this._register(disposableTimeout(() => {
            showInSequence = false;
            publish();
        }, 5_000));
        const publish = () => {
            const output = new Map();
            for (const [server, rec] of servers) {
                const r = [];
                output.set(server, r);
                if (rec.templates.isResolved) {
                    r.push(...rec.templates.value);
                }
                else if (showInSequence) {
                    break;
                }
                r.push(...rec.resourcesSoFar);
                if (!rec.resources.isSettled && showInSequence) {
                    break;
                }
            }
            this._resources.set({ picks: output, isBusy: isBusyLoadingPicks }, undefined);
        };
        const servers = new Map();
        // Enumerate servers and start servers that need to be started to get capabilities
        Promise.all((this.explicitServers || this._mcpService.servers.get()).map(async (server) => {
            let cap = server.capabilities.get();
            const rec = {
                templates: new DeferredPromise(),
                resourcesSoFar: [],
                resources: new DeferredPromise(),
            };
            servers.set(server, rec); // always add it to retain order
            if (cap === undefined) {
                cap = await new Promise(resolve => {
                    server.start().then(state => {
                        if (state.state === 3 /* McpConnectionState.Kind.Error */ || state.state === 0 /* McpConnectionState.Kind.Stopped */) {
                            resolve(undefined);
                        }
                    });
                    this._register(cts.token.onCancellationRequested(() => resolve(undefined)));
                    this._register(autorun(reader => {
                        const cap2 = server.capabilities.read(reader);
                        if (cap2 !== undefined) {
                            resolve(cap2);
                        }
                    }));
                });
            }
            if (cap && (cap & 16 /* McpCapability.Resources */)) {
                await Promise.all([
                    rec.templates.settleWith(server.resourceTemplates(cts.token).catch(() => [])).finally(publish),
                    rec.resources.settleWith((async () => {
                        for await (const page of server.resources(cts.token)) {
                            rec.resourcesSoFar = rec.resourcesSoFar.concat(page);
                            publish();
                        }
                    })())
                ]);
            }
            else {
                rec.templates.complete([]);
                rec.resources.complete([]);
            }
        })).finally(() => {
            isBusyLoadingPicks = false;
            publish();
        });
        // Use derived to compute the appropriate resource map based on directory navigation state
        return derived(this, reader => {
            const directoryResource = this._inDirectory.read(reader);
            return directoryResource
                ? { picks: new Map([[directoryResource.server, directoryResource.resources]]), isBusy: false }
                : this._resources.read(reader);
        });
    }
};
McpResourcePickHelper = __decorate([
    __param(0, IMcpService),
    __param(1, IFileService),
    __param(2, IQuickInputService),
    __param(3, INotificationService),
    __param(4, IChatAttachmentResolveService)
], McpResourcePickHelper);
export { McpResourcePickHelper };
let AbstractMcpResourceAccessPick = class AbstractMcpResourceAccessPick {
    constructor(_scopeTo, _instantiationService, _editorService, _chatWidgetService, _viewsService) {
        this._scopeTo = _scopeTo;
        this._instantiationService = _instantiationService;
        this._editorService = _editorService;
        this._chatWidgetService = _chatWidgetService;
        this._viewsService = _viewsService;
    }
    applyToPick(picker, token, runOptions) {
        picker.canAcceptInBackground = true;
        picker.busy = true;
        picker.keepScrollPosition = true;
        const store = new DisposableStore();
        const goBackId = '_goback_';
        const attachButton = localize('mcp.quickaccess.attach', "Attach to chat");
        const helper = store.add(this._instantiationService.createInstance(McpResourcePickHelper));
        if (this._scopeTo) {
            helper.explicitServers = [this._scopeTo];
        }
        const picksObservable = helper.getPicks(token);
        store.add(autorun(reader => {
            const pickItems = picksObservable.read(reader);
            const isBusy = pickItems.isBusy;
            const items = [];
            for (const [server, resources] of pickItems.picks) {
                items.push(McpResourcePickHelper.sep(server));
                for (const resource of resources) {
                    const pickItem = McpResourcePickHelper.item(resource);
                    pickItem.buttons = [{ iconClass: ThemeIcon.asClassName(Codicon.attach), tooltip: attachButton }];
                    items.push({ ...pickItem, resource, server });
                }
            }
            if (helper.checkIfNestedResources()) {
                // Add go back item
                const goBackItem = {
                    id: goBackId,
                    label: localize('goBack', 'Go back ↩'),
                    alwaysShow: true
                };
                items.push(goBackItem);
            }
            picker.items = items;
            picker.busy = isBusy;
        }));
        store.add(picker.onDidTriggerItemButton(event => {
            if (event.button.tooltip === attachButton) {
                picker.busy = true;
                const resourceItem = event.item;
                const attachment = helper.toAttachment(resourceItem.resource, resourceItem.server);
                if (attachment instanceof Promise) {
                    attachment.then(async (a) => {
                        if (a !== 'noop') {
                            const widget = await openPanelChatAndGetWidget(this._viewsService, this._chatWidgetService);
                            widget?.attachmentModel.addContext(a);
                        }
                        picker.hide();
                    });
                }
            }
        }));
        store.add(picker.onDidHide(() => {
            helper.dispose();
        }));
        store.add(picker.onDidAccept(async (event) => {
            try {
                picker.busy = true;
                const [item] = picker.selectedItems;
                // Check if go back item was selected
                if (item.id === goBackId) {
                    helper.navigateBack();
                    picker.busy = false;
                    return;
                }
                const resourceItem = item;
                const resource = resourceItem.resource;
                // Try to navigate into the resource if it's a directory
                const isNested = await helper.navigate(resource, resourceItem.server);
                if (!isNested) {
                    const uri = await helper.toURI(resource);
                    if (uri) {
                        picker.hide();
                        this._editorService.openEditor({ resource: uri, options: { preserveFocus: event.inBackground } });
                    }
                }
            }
            finally {
                picker.busy = false;
            }
        }));
        return store;
    }
};
AbstractMcpResourceAccessPick = __decorate([
    __param(1, IInstantiationService),
    __param(2, IEditorService),
    __param(3, IChatWidgetService),
    __param(4, IViewsService)
], AbstractMcpResourceAccessPick);
export { AbstractMcpResourceAccessPick };
let McpResourceQuickPick = class McpResourceQuickPick extends AbstractMcpResourceAccessPick {
    constructor(scopeTo, instantiationService, editorService, chatWidgetService, viewsService, _quickInputService) {
        super(scopeTo, instantiationService, editorService, chatWidgetService, viewsService);
        this._quickInputService = _quickInputService;
    }
    async pick(token = CancellationToken.None) {
        const store = new DisposableStore();
        const qp = store.add(this._quickInputService.createQuickPick({ useSeparators: true }));
        qp.placeholder = localize('mcp.quickaccess.placeholder', "Search for resources");
        store.add(this.applyToPick(qp, token));
        store.add(qp.onDidHide(() => store.dispose()));
        qp.show();
        await Event.toPromise(qp.onDidHide);
    }
};
McpResourceQuickPick = __decorate([
    __param(1, IInstantiationService),
    __param(2, IEditorService),
    __param(3, IChatWidgetService),
    __param(4, IViewsService),
    __param(5, IQuickInputService)
], McpResourceQuickPick);
export { McpResourceQuickPick };
let McpResourceQuickAccess = class McpResourceQuickAccess extends AbstractMcpResourceAccessPick {
    static { this.PREFIX = 'mcpr '; }
    constructor(instantiationService, editorService, chatWidgetService, viewsService) {
        super(undefined, instantiationService, editorService, chatWidgetService, viewsService);
        this.defaultFilterValue = DefaultQuickAccessFilterValue.LAST;
    }
    provide(picker, token, runOptions) {
        return this.applyToPick(picker, token, runOptions);
    }
};
McpResourceQuickAccess = __decorate([
    __param(0, IInstantiationService),
    __param(1, IEditorService),
    __param(2, IChatWidgetService),
    __param(3, IViewsService)
], McpResourceQuickAccess);
export { McpResourceQuickAccess };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwUmVzb3VyY2VRdWlja0FjY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvYnJvd3Nlci9tY3BSZXNvdXJjZVF1aWNrQWNjZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN4RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNyRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBRSxlQUFlLEVBQWUsWUFBWSxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzlHLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBZSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUVqRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDL0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFhLE1BQU0sNENBQTRDLENBQUM7QUFDL0YsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDaEcsT0FBTyxFQUFFLDZCQUE2QixFQUF3RCxNQUFNLHVEQUF1RCxDQUFDO0FBQzVKLE9BQU8sRUFBRSxrQkFBa0IsRUFBbUQsTUFB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