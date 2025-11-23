"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRemoteSourceActions = getRemoteSourceActions;
exports.pickRemoteSource = pickRemoteSource;
const vscode_1 = require("vscode");
const decorators_1 = require("./decorators");
async function getQuickPickResult(quickpick) {
    const listeners = [];
    const result = await new Promise(c => {
        listeners.push(quickpick.onDidAccept(() => c(quickpick.selectedItems[0])), quickpick.onDidHide(() => c(undefined)));
        quickpick.show();
    });
    quickpick.hide();
    listeners.forEach(l => l.dispose());
    return result;
}
let RemoteSourceProviderQuickPick = (() => {
    let _instanceExtraInitializers = [];
    let _onDidChangeValue_decorators;
    let _query_decorators;
    return class RemoteSourceProviderQuickPick {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _onDidChangeValue_decorators = [(0, decorators_1.debounce)(300)];
            _query_decorators = [decorators_1.throttle];
            __esDecorate(this, null, _onDidChangeValue_decorators, { kind: "method", name: "onDidChangeValue", static: false, private: false, access: { has: obj => "onDidChangeValue" in obj, get: obj => obj.onDidChangeValue }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _query_decorators, { kind: "method", name: "query", static: false, private: false, access: { has: obj => "query" in obj, get: obj => obj.query }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        provider = __runInitializers(this, _instanceExtraInitializers);
        disposables = [];
        isDisposed = false;
        quickpick;
        constructor(provider) {
            this.provider = provider;
        }
        dispose() {
            this.disposables.forEach(d => d.dispose());
            this.disposables = [];
            this.quickpick = undefined;
            this.isDisposed = true;
        }
        ensureQuickPick() {
            if (!this.quickpick) {
                this.quickpick = vscode_1.window.createQuickPick();
                this.disposables.push(this.quickpick);
                this.quickpick.ignoreFocusOut = true;
                this.disposables.push(this.quickpick.onDidHide(() => this.dispose()));
                if (this.provider.supportsQuery) {
                    this.quickpick.placeholder = this.provider.placeholder ?? vscode_1.l10n.t('Repository name (type to search)');
                    this.disposables.push(this.quickpick.onDidChangeValue(this.onDidChangeValue, this));
                }
                else {
                    this.quickpick.placeholder = this.provider.placeholder ?? vscode_1.l10n.t('Repository name');
                }
            }
        }
        onDidChangeValue() {
            this.query();
        }
        async query() {
            try {
                if (this.isDisposed) {
                    return;
                }
                this.ensureQuickPick();
                this.quickpick.busy = true;
                this.quickpick.show();
                const remoteSources = await this.provider.getRemoteSources(this.quickpick?.value) || [];
                // The user may have cancelled the picker in the meantime
                if (this.isDisposed) {
                    return;
                }
                if (remoteSources.length === 0) {
                    this.quickpick.items = [{
                            label: vscode_1.l10n.t('No remote repositories found.'),
                            alwaysShow: true
                        }];
                }
                else {
                    this.quickpick.items = remoteSources.map(remoteSource => ({
                        label: remoteSource.icon ? `$(${remoteSource.icon}) ${remoteSource.name}` : remoteSource.name,
                        description: remoteSource.description || (typeof remoteSource.url === 'string' ? remoteSource.url : remoteSource.url[0]),
                        detail: remoteSource.detail,
                        remoteSource,
                        alwaysShow: true
                    }));
                }
            }
            catch (err) {
                this.quickpick.items = [{ label: vscode_1.l10n.t('{0} Error: {1}', '$(error)', err.message), alwaysShow: true }];
                console.error(err);
            }
            finally {
                if (!this.isDisposed) {
                    this.quickpick.busy = false;
                }
            }
        }
        async pick() {
            await this.query();
            if (this.isDisposed) {
                return;
            }
            const result = await getQuickPickResult(this.quickpick);
            return result?.remoteSource;
        }
    };
})();
async function getRemoteSourceActions(model, url) {
    const providers = model.getRemoteProviders();
    const remoteSourceActions = [];
    for (const provider of providers) {
        const providerActions = await provider.getRemoteSourceActions?.(url);
        if (providerActions?.length) {
            remoteSourceActions.push(...providerActions);
        }
    }
    return remoteSourceActions;
}
async function pickRemoteSource(model, options = {}) {
    const quickpick = vscode_1.window.createQuickPick();
    quickpick.title = options.title;
    if (options.providerName) {
        const provider = model.getRemoteProviders()
            .filter(provider => provider.name === options.providerName)[0];
        if (provider) {
            return await pickProviderSource(provider, options);
        }
    }
    const remoteProviders = model.getRemoteProviders()
        .map(provider => ({ label: (provider.icon ? `$(${provider.icon}) ` : '') + (options.providerLabel ? options.providerLabel(provider) : provider.name), alwaysShow: true, provider }));
    const recentSources = [];
    if (options.showRecentSources) {
        for (const { provider } of remoteProviders) {
            const sources = (await provider.getRecentRemoteSources?.() ?? []).map((item) => {
                return {
                    ...item,
                    label: (item.icon ? `$(${item.icon}) ` : '') + item.name,
                    url: typeof item.url === 'string' ? item.url : item.url[0],
                };
            });
            recentSources.push(...sources);
        }
    }
    const items = [
        { kind: vscode_1.QuickPickItemKind.Separator, label: vscode_1.l10n.t('remote sources') },
        ...remoteProviders,
        { kind: vscode_1.QuickPickItemKind.Separator, label: vscode_1.l10n.t('recently opened') },
        ...recentSources.sort((a, b) => b.timestamp - a.timestamp)
    ];
    quickpick.placeholder = options.placeholder ?? (remoteProviders.length === 0
        ? vscode_1.l10n.t('Provide repository URL')
        : vscode_1.l10n.t('Provide repository URL or pick a repository source.'));
    const updatePicks = (value) => {
        if (value) {
            const label = (typeof options.urlLabel === 'string' ? options.urlLabel : options.urlLabel?.(value)) ?? vscode_1.l10n.t('URL');
            quickpick.items = [{
                    label: label,
                    description: value,
                    alwaysShow: true,
                    url: value
                },
                ...items
            ];
        }
        else {
            quickpick.items = items;
        }
    };
    quickpick.onDidChangeValue(updatePicks);
    updatePicks();
    const result = await getQuickPickResult(quickpick);
    if (result) {
        if (result.url) {
            return result.url;
        }
        else if (result.provider) {
            return await pickProviderSource(result.provider, options);
        }
    }
    return undefined;
}
async function pickProviderSource(provider, options = {}) {
    const quickpick = new RemoteSourceProviderQuickPick(provider);
    const remote = await quickpick.pick();
    quickpick.dispose();
    let url;
    if (remote) {
        if (typeof remote.url === 'string') {
            url = remote.url;
        }
        else if (remote.url.length > 0) {
            url = await vscode_1.window.showQuickPick(remote.url, { ignoreFocusOut: true, placeHolder: vscode_1.l10n.t('Choose a URL to clone from.') });
        }
    }
    if (!url || !options.branch) {
        return url;
    }
    if (!provider.getBranches) {
        return { url };
    }
    const branches = await provider.getBranches(url);
    if (!branches) {
        return { url };
    }
    const branch = await vscode_1.window.showQuickPick(branches, {
        placeHolder: vscode_1.l10n.t('Branch name')
    });
    if (!branch) {
        return { url };
    }
    return { url, branch };
}
//# sourceMappingURL=remoteSource.js.map