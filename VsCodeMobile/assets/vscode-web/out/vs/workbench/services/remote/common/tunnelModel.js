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
import * as nls from '../../../../nls.js';
import { debounce } from '../../../../base/common/decorators.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { hash } from '../../../../base/common/hash.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IRemoteAuthorityResolverService } from '../../../../platform/remote/common/remoteAuthorityResolver.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITunnelService, TunnelProtocol, TunnelPrivacyId, LOCALHOST_ADDRESSES, isLocalhost, isAllInterfaces, ProvidedOnAutoForward, ALL_INTERFACES_ADDRESSES } from '../../../../platform/tunnel/common/tunnel.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { IExtensionService } from '../../extensions/common/extensions.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { isNumber, isObject, isString } from '../../../../base/common/types.js';
import { deepClone } from '../../../../base/common/objects.js';
import { IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
const MISMATCH_LOCAL_PORT_COOLDOWN = 10 * 1000; // 10 seconds
const TUNNELS_TO_RESTORE = 'remote.tunnels.toRestore';
const TUNNELS_TO_RESTORE_EXPIRATION = 'remote.tunnels.toRestoreExpiration';
const RESTORE_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 14; // 2 weeks
export const ACTIVATION_EVENT = 'onTunnel';
export const forwardedPortsFeaturesEnabled = new RawContextKey('forwardedPortsViewEnabled', false, nls.localize('tunnel.forwardedPortsViewEnabled', "Whether the Ports view is enabled."));
export const forwardedPortsViewEnabled = new RawContextKey('forwardedPortsViewOnlyEnabled', false, nls.localize('tunnel.forwardedPortsViewEnabled', "Whether the Ports view is enabled."));
export function parseAddress(address) {
    const matches = address.match(/^([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*:)?([0-9]+)$/);
    if (!matches) {
        return undefined;
    }
    return { host: matches[1]?.substring(0, matches[1].length - 1) || 'localhost', port: Number(matches[2]) };
}
export var TunnelCloseReason;
(function (TunnelCloseReason) {
    TunnelCloseReason["Other"] = "Other";
    TunnelCloseReason["User"] = "User";
    TunnelCloseReason["AutoForwardEnd"] = "AutoForwardEnd";
})(TunnelCloseReason || (TunnelCloseReason = {}));
export var TunnelSource;
(function (TunnelSource) {
    TunnelSource[TunnelSource["User"] = 0] = "User";
    TunnelSource[TunnelSource["Auto"] = 1] = "Auto";
    TunnelSource[TunnelSource["Extension"] = 2] = "Extension";
})(TunnelSource || (TunnelSource = {}));
export const UserTunnelSource = {
    source: TunnelSource.User,
    description: nls.localize('tunnel.source.user', "User Forwarded")
};
export const AutoTunnelSource = {
    source: TunnelSource.Auto,
    description: nls.localize('tunnel.source.auto', "Auto Forwarded")
};
export function mapHasAddress(map, host, port) {
    const initialAddress = map.get(makeAddress(host, port));
    if (initialAddress) {
        return initialAddress;
    }
    if (isLocalhost(host)) {
        // Do localhost checks
        for (const testHost of LOCALHOST_ADDRESSES) {
            const testAddress = makeAddress(testHost, port);
            if (map.has(testAddress)) {
                return map.get(testAddress);
            }
        }
    }
    else if (isAllInterfaces(host)) {
        // Do all interfaces checks
        for (const testHost of ALL_INTERFACES_ADDRESSES) {
            const testAddress = makeAddress(testHost, port);
            if (map.has(testAddress)) {
                return map.get(testAddress);
            }
        }
    }
    return undefined;
}
export function mapHasAddressLocalhostOrAllInterfaces(map, host, port) {
    const originalAddress = mapHasAddress(map, host, port);
    if (originalAddress) {
        return originalAddress;
    }
    const otherHost = isAllInterfaces(host) ? 'localhost' : (isLocalhost(host) ? '0.0.0.0' : undefined);
    if (otherHost) {
        return mapHasAddress(map, otherHost, port);
    }
    return undefined;
}
export function makeAddress(host, port) {
    return host + ':' + port;
}
export var OnPortForward;
(function (OnPortForward) {
    OnPortForward["Notify"] = "notify";
    OnPortForward["OpenBrowser"] = "openBrowser";
    OnPortForward["OpenBrowserOnce"] = "openBrowserOnce";
    OnPortForward["OpenPreview"] = "openPreview";
    OnPortForward["Silent"] = "silent";
    OnPortForward["Ignore"] = "ignore";
})(OnPortForward || (OnPortForward = {}));
export function isCandidatePort(candidate) {
    return candidate && 'host' in candidate && typeof candidate.host === 'string'
        && 'port' in candidate && typeof candidate.port === 'number'
        && (!('detail' in candidate) || typeof candidate.detail === 'string')
        && (!('pid' in candidate) || typeof candidate.pid === 'string');
}
export class PortsAttributes extends Disposable {
    static { this.SETTING = 'remote.portsAttributes'; }
    static { this.DEFAULTS = 'remote.otherPortsAttributes'; }
    static { this.RANGE = /^(\d+)\-(\d+)$/; }
    static { this.HOST_AND_PORT = /^([a-z0-9\-]+):(\d{1,5})$/; }
    constructor(configurationService) {
        super();
        this.configurationService = configurationService;
        this.portsAttributes = [];
        this._onDidChangeAttributes = new Emitter();
        this.onDidChangeAttributes = this._onDidChangeAttributes.event;
        this._register(configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(PortsAttributes.SETTING) || e.affectsConfiguration(PortsAttributes.DEFAULTS)) {
                this.updateAttributes();
            }
        }));
        this.updateAttributes();
    }
    updateAttributes() {
        this.portsAttributes = this.readSetting();
        this._onDidChangeAttributes.fire();
    }
    getAttributes(port, host, commandLine) {
        let index = this.findNextIndex(port, host, commandLine, this.portsAttributes, 0);
        const attributes = {
            label: undefined,
            onAutoForward: undefined,
            elevateIfNeeded: undefined,
            requireLocalPort: undefined,
            protocol: undefined
        };
        while (index >= 0) {
            const found = this.portsAttributes[index];
            if (found.key === port) {
                attributes.onAutoForward = found.onAutoForward ?? attributes.onAutoForward;
                attributes.elevateIfNeeded = (found.elevateIfNeeded !== undefined) ? found.elevateIfNeeded : attributes.elevateIfNeeded;
                attributes.label = found.label ?? attributes.label;
                attributes.requireLocalPort = found.requireLocalPort;
                attributes.protocol = found.protocol;
            }
            else {
                // It's a range or regex, which means that if the attribute is already set, we keep it
                attributes.onAutoForward = attributes.onAutoForward ?? found.onAutoForward;
                attributes.elevateIfNeeded = (attributes.elevateIfNeeded !== undefined) ? attributes.elevateIfNeeded : found.elevateIfNeeded;
                attributes.label = attributes.label ?? found.label;
                attributes.requireLocalPort = (attributes.requireLocalPort !== undefined) ? attributes.requireLocalPort : undefined;
                attributes.protocol = attributes.protocol ?? found.protocol;
            }
            index = this.findNextIndex(port, host, commandLine, this.portsAttributes, index + 1);
        }
        if (attributes.onAutoForward !== undefined || attributes.elevateIfNeeded !== undefined
            || attributes.label !== undefined || attributes.requireLocalPort !== undefined
            || attributes.protocol !== undefined) {
            return attributes;
        }
        // If we find no matches, then use the other port attributes.
        return this.getOtherAttributes();
    }
    hasStartEnd(value) {
        return value.start !== undefined && value.end !== undefined;
    }
    hasHostAndPort(value) {
        return (value.host !== undefined) && (value.port !== undefined)
            && isString(value.host) && isNumber(value.port);
    }
    findNextIndex(port, host, commandLine, attributes, fromIndex) {
        if (fromIndex >= attributes.length) {
            return -1;
        }
        const shouldUseHost = !isLocalhost(host) && !isAllInterfaces(host);
        const sliced = attributes.slice(fromIndex);
        const foundIndex = sliced.findIndex((value) => {
            if (isNumber(value.key)) {
                return shouldUseHost ? false : value.key === port;
            }
            else if (this.hasStartEnd(value.key)) {
                return shouldUseHost ? false : (port >= value.key.start && port <= value.key.end);
            }
            else if (this.hasHostAndPort(value.key)) {
                return (port === value.key.port) && (host === value.key.host);
            }
            else {
                return commandLine ? value.key.test(commandLine) : false;
            }
        });
        return foundIndex >= 0 ? foundIndex + fromIndex : -1;
    }
    readSetting() {
        const settingValue = this.configurationService.getValue(PortsAttributes.SETTING);
        if (!settingValue || !isObject(settingValue)) {
            return [];
        }
        const attributes = [];
        for (const attributesKey in settingValue) {
            if (attributesKey === undefined) {
                continue;
            }
            const setting = settingValue[attributesKey];
            let key = undefined;
            if (Number(attributesKey)) {
                key = Number(attributesKey);
            }
            else if (isString(attributesKey)) {
                if (PortsAttributes.RANGE.test(attributesKey)) {
                    const match = attributesKey.match(PortsAttributes.RANGE);
                    key = { start: Number(match[1]), end: Number(match[2]) };
                }
                else if (PortsAttributes.HOST_AND_PORT.test(attributesKey)) {
                    const match = attributesKey.match(PortsAttributes.HOST_AND_PORT);
                    key = { host: match[1], port: Number(match[2]) };
                }
                else {
                    let regTest = undefined;
                    try {
                        regTest = RegExp(attributesKey);
                    }
                    catch (e) {
                        // The user entered an invalid regular expression.
                    }
                    if (regTest) {
                        key = regTest;
                    }
                }
            }
            if (!key) {
                continue;
            }
            attributes.push({
                key: key,
                elevateIfNeeded: setting.elevateIfNeeded,
                onAutoForward: setting.onAutoForward,
                label: setting.label,
                requireLocalPort: setting.requireLocalPort,
                protocol: setting.protocol
            });
        }
        const defaults = this.configurationService.getValue(PortsAttributes.DEFAULTS);
        if (defaults) {
            this.defaultPortAttributes = {
                elevateIfNeeded: defaults.elevateIfNeeded,
                label: defaults.label,
                onAutoForward: defaults.onAutoForward,
                requireLocalPort: defaults.requireLocalPort,
                protocol: defaults.protocol
            };
        }
        return this.sortAttributes(attributes);
    }
    sortAttributes(attributes) {
        function getVal(item, thisRef) {
            if (isNumber(item.key)) {
                return item.key;
            }
            else if (thisRef.hasStartEnd(item.key)) {
                return item.key.start;
            }
            else if (thisRef.hasHostAndPort(item.key)) {
                return item.key.port;
            }
            else {
                return Number.MAX_VALUE;
            }
        }
        return attributes.sort((a, b) => {
            return getVal(a, this) - getVal(b, this);
        });
    }
    getOtherAttributes() {
        return this.defaultPortAttributes;
    }
    static providedActionToAction(providedAction) {
        switch (providedAction) {
            case ProvidedOnAutoForward.Notify: return OnPortForward.Notify;
            case ProvidedOnAutoForward.OpenBrowser: return OnPortForward.OpenBrowser;
            case ProvidedOnAutoForward.OpenBrowserOnce: return OnPortForward.OpenBrowserOnce;
            case ProvidedOnAutoForward.OpenPreview: return OnPortForward.OpenPreview;
            case ProvidedOnAutoForward.Silent: return OnPortForward.Silent;
            case ProvidedOnAutoForward.Ignore: return OnPortForward.Ignore;
            default: return undefined;
        }
    }
    async addAttributes(port, attributes, target) {
        const settingValue = this.configurationService.inspect(PortsAttributes.SETTING);
        const remoteValue = settingValue.userRemoteValue;
        let newRemoteValue;
        if (!remoteValue || !isObject(remoteValue)) {
            newRemoteValue = {};
        }
        else {
            newRemoteValue = deepClone(remoteValue);
        }
        if (!newRemoteValue[`${port}`]) {
            newRemoteValue[`${port}`] = {};
        }
        for (const attribute in attributes) {
            newRemoteValue[`${port}`][attribute] = attributes[attribute];
        }
        return this.configurationService.updateValue(PortsAttributes.SETTING, newRemoteValue, target);
    }
}
let TunnelModel = class TunnelModel extends Disposable {
    constructor(tunnelService, storageService, configurationService, environmentService, remoteAuthorityResolverService, workspaceContextService, logService, dialogService, extensionService, contextKeyService) {
        super();
        this.tunnelService = tunnelService;
        this.storageService = storageService;
        this.configurationService = configurationService;
        this.environmentService = environmentService;
        this.remoteAuthorityResolverService = remoteAuthorityResolverService;
        this.workspaceContextService = workspaceContextService;
        this.logService = logService;
        this.dialogService = dialogService;
        this.extensionService = extensionService;
        this.contextKeyService = contextKeyService;
        this.inProgress = new Map();
        this._onForwardPort = new Emitter();
        this.onForwardPort = this._onForwardPort.event;
        this._onClosePort = new Emitter();
        this.onClosePort = this._onClosePort.event;
        this._onPortName = new Emitter();
        this.onPortName = this._onPortName.event;
        this._onCandidatesChanged = new Emitter();
        // onCandidateChanged returns the removed candidates
        this.onCandidatesChanged = this._onCandidatesChanged.event;
        this._onEnvironmentTunnelsSet = new Emitter();
        this.onEnvironmentTunnelsSet = this._onEnvironmentTunnelsSet.event;
        this._environmentTunnelsSet = false;
        this.restoreListener = undefined;
        this.restoreComplete = false;
        this.onRestoreComplete = new Emitter();
        this.unrestoredExtensionTunnels = new Map();
        this.sessionCachedProperties = new Map();
        this.portAttributesProviders = [];
        this.hasCheckedExtensionsOnTunnelOpened = false;
        this.mismatchCooldown = new Date();
        this.configPortsAttributes = new PortsAttributes(configurationService);
        this.tunnelRestoreValue = this.getTunnelRestoreValue();
        this._register(this.configPortsAttributes.onDidChangeAttributes(this.updateAttributes, this));
        this.forwarded = new Map();
        this.remoteTunnels = new Map();
        this.tunnelService.tunnels.then(async (tunnels) => {
            const attributes = await this.getAttributes(tunnels.map(tunnel => {
                return { port: tunnel.tunnelRemotePort, host: tunnel.tunnelRemoteHost };
            }));
            for (const tunnel of tunnels) {
                if (tunnel.localAddress) {
                    const key = makeAddress(tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort);
                    const matchingCandidate = mapHasAddressLocalhostOrAllInterfaces(this._candidates ?? new Map(), tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort);
                    this.forwarded.set(key, {
                        remotePort: tunnel.tunnelRemotePort,
                        remoteHost: tunnel.tunnelRemoteHost,
                        localAddress: tunnel.localAddress,
                        protocol: attributes?.get(tunnel.tunnelRemotePort)?.protocol ?? TunnelProtocol.Http,
                        localUri: await this.makeLocalUri(tunnel.localAddress, attributes?.get(tunnel.tunnelRemotePort)),
                        localPort: tunnel.tunnelLocalPort,
                        name: attributes?.get(tunnel.tunnelRemotePort)?.label,
                        runningProcess: matchingCandidate?.detail,
                        hasRunningProcess: !!matchingCandidate,
                        pid: matchingCandidate?.pid,
                        privacy: tunnel.privacy,
                        source: UserTunnelSource,
                    });
                    this.remoteTunnels.set(key, tunnel);
                }
            }
        });
        this.detected = new Map();
        this._register(this.tunnelService.onTunnelOpened(async (tunnel) => {
            const key = makeAddress(tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort);
            if (!mapHasAddressLocalhostOrAllInterfaces(this.forwarded, tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort)
                && !mapHasAddressLocalhostOrAllInterfaces(this.detected, tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort)
                && !mapHasAddressLocalhostOrAllInterfaces(this.inProgress, tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort)
                && tunnel.localAddress) {
                const matchingCandidate = mapHasAddressLocalhostOrAllInterfaces(this._candidates ?? new Map(), tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort);
                const attributes = (await this.getAttributes([{ port: tunnel.tunnelRemotePort, host: tunnel.tunnelRemoteHost }]))?.get(tunnel.tunnelRemotePort);
                this.forwarded.set(key, {
                    remoteHost: tunnel.tunnelRemoteHost,
                    remotePort: tunnel.tunnelRemotePort,
                    localAddress: tunnel.localAddress,
                    protocol: attributes?.protocol ?? TunnelProtocol.Http,
                    localUri: await this.makeLocalUri(tunnel.localAddress, attributes),
                    localPort: tunnel.tunnelLocalPort,
                    name: attributes?.label,
                    closeable: true,
                    runningProcess: matchingCandidate?.detail,
                    hasRunningProcess: !!matchingCandidate,
                    pid: matchingCandidate?.pid,
                    privacy: tunnel.privacy,
                    source: UserTunnelSource,
                });
            }
            await this.storeForwarded();
            this.checkExtensionActivationEvents(true);
            this.remoteTunnels.set(key, tunnel);
            this._onForwardPort.fire(this.forwarded.get(key));
        }));
        this._register(this.tunnelService.onTunnelClosed(address => {
            return this.onTunnelClosed(address, TunnelCloseReason.Other);
        }));
        this.checkExtensionActivationEvents(false);
    }
    extensionHasActivationEvent() {
        if (this.extensionService.extensions.find(extension => extension.activationEvents?.includes(ACTIVATION_EVENT))) {
            this.contextKeyService.createKey(forwardedPortsViewEnabled.key, true);
            return true;
        }
        return false;
    }
    checkExtensionActivationEvents(tunnelOpened) {
        if (this.hasCheckedExtensionsOnTunnelOpened) {
            return;
        }
        if (tunnelOpened) {
            this.hasCheckedExtensionsOnTunnelOpened = true;
        }
        const hasRemote = this.environmentService.remoteAuthority !== undefined;
        if (hasRemote && !tunnelOpened) {
            // We don't activate extensions on startup if there is a remote
            return;
        }
        if (this.extensionHasActivationEvent()) {
            return;
        }
        const activationDisposable = this._register(this.extensionService.onDidRegisterExtensions(() => {
            if (this.extensionHasActivationEvent()) {
                activationDisposable.dispose();
            }
        }));
    }
    async onTunnelClosed(address, reason) {
        const key = makeAddress(address.host, address.port);
        if (this.forwarded.delete(key)) {
            await this.storeForwarded();
            this._onClosePort.fire(address);
        }
    }
    makeLocalUri(localAddress, attributes) {
        if (localAddress.startsWith('http')) {
            return URI.parse(localAddress);
        }
        const protocol = attributes?.protocol ?? 'http';
        return URI.parse(`${protocol}://${localAddress}`);
    }
    async addStorageKeyPostfix(prefix) {
        const workspace = this.workspaceContextService.getWorkspace();
        const workspaceHash = workspace.configuration ? hash(workspace.configuration.path) : (workspace.folders.length > 0 ? hash(workspace.folders[0].uri.path) : undefined);
        if (workspaceHash === undefined) {
            this.logService.debug('Could not get workspace hash for forwarded ports storage key.');
            return undefined;
        }
        return `${prefix}.${this.environmentService.remoteAuthority}.${workspaceHash}`;
    }
    async getTunnelRestoreStorageKey() {
        return this.addStorageKeyPostfix(TUNNELS_TO_RESTORE);
    }
    async getRestoreExpirationStorageKey() {
        return this.addStorageKeyPostfix(TUNNELS_TO_RESTORE_EXPIRATION);
    }
    async getTunnelRestoreValue() {
        const deprecatedValue = this.storageService.get(TUNNELS_TO_RESTORE, 1 /* StorageScope.WORKSPACE */);
        if (deprecatedValue) {
            this.storageService.remove(TUNNELS_TO_RESTORE, 1 /* StorageScope.WORKSPACE */);
            await this.storeForwarded();
            return deprecatedValue;
        }
        const storageKey = await this.getTunnelRestoreStorageKey();
        if (!storageKey) {
            return undefined;
        }
        return this.storageService.get(storageKey, 0 /* StorageScope.PROFILE */);
    }
    async restoreForwarded() {
        this.cleanupExpiredTunnelsForRestore();
        if (this.configurationService.getValue('remote.restoreForwardedPorts')) {
            const tunnelRestoreValue = await this.tunnelRestoreValue;
            if (tunnelRestoreValue && (tunnelRestoreValue !== this.knownPortsRestoreValue)) {
                const tunnels = JSON.parse(tunnelRestoreValue) ?? [];
                this.logService.trace(`ForwardedPorts: (TunnelModel) restoring ports ${tunnels.map(tunnel => tunnel.remotePort).join(', ')}`);
                for (const tunnel of tunnels) {
                    const alreadyForwarded = mapHasAddressLocalhostOrAllInterfaces(this.detected, tunnel.remoteHost, tunnel.remotePort);
                    // Extension forwarded ports should only be updated, not restored.
                    if ((tunnel.source.source !== TunnelSource.Extension && !alreadyForwarded) || (tunnel.source.source === TunnelSource.Extension && alreadyForwarded)) {
                        await this.doForward({
                            remote: { host: tunnel.remoteHost, port: tunnel.remotePort },
                            local: tunnel.localPort,
                            name: tunnel.name,
                            elevateIfNeeded: true,
                            source: tunnel.source
                        });
                    }
                    else if (tunnel.source.source === TunnelSource.Extension && !alreadyForwarded) {
                        this.unrestoredExtensionTunnels.set(makeAddress(tunnel.remoteHost, tunnel.remotePort), tunnel);
                    }
                }
            }
        }
        this.restoreComplete = true;
        this.onRestoreComplete.fire();
        if (!this.restoreListener) {
            // It's possible that at restore time the value hasn't synced.
            const key = await this.getTunnelRestoreStorageKey();
            this.restoreListener = this._register(new DisposableStore());
            this.restoreListener.add(this.storageService.onDidChangeValue(0 /* StorageScope.PROFILE */, undefined, this.restoreListener)(async (e) => {
                if (e.key === key) {
                    this.tunnelRestoreValue = Promise.resolve(this.storageService.get(key, 0 /* StorageScope.PROFILE */));
                    await this.restoreForwarded();
                }
            }));
        }
    }
    cleanupExpiredTunnelsForRestore() {
        const keys = this.storageService.keys(0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */).filter(key => key.startsWith(TUNNELS_TO_RESTORE_EXPIRATION));
        for (const key of keys) {
            const expiration = this.storageService.getNumber(key, 0 /* StorageScope.PROFILE */);
            if (expiration && expiration < Date.now()) {
                this.tunnelRestoreValue = Promise.resolve(undefined);
                const storageKey = key.replace(TUNNELS_TO_RESTORE_EXPIRATION, TUNNELS_TO_RESTORE);
                this.storageService.remove(key, 0 /* StorageScope.PROFILE */);
                this.storageService.remove(storageKey, 0 /* StorageScope.PROFILE */);
            }
        }
    }
    async storeForwarded() {
        if (this.configurationService.getValue('remote.restoreForwardedPorts')) {
            const forwarded = Array.from(this.forwarded.values());
            const restorableTunnels = forwarded.map(tunnel => {
                return {
                    remoteHost: tunnel.remoteHost,
                    remotePort: tunnel.remotePort,
                    localPort: tunnel.localPort,
                    name: tunnel.name,
                    localAddress: tunnel.localAddress,
                    localUri: tunnel.localUri,
                    protocol: tunnel.protocol,
                    source: tunnel.source,
                };
            });
            let valueToStore;
            if (forwarded.length > 0) {
                valueToStore = JSON.stringify(restorableTunnels);
            }
            const key = await this.getTunnelRestoreStorageKey();
            const expirationKey = await this.getRestoreExpirationStorageKey();
            if (!valueToStore && key && expirationKey) {
                this.storageService.remove(key, 0 /* StorageScope.PROFILE */);
                this.storageService.remove(expirationKey, 0 /* StorageScope.PROFILE */);
            }
            else if ((valueToStore !== this.knownPortsRestoreValue) && key && expirationKey) {
                this.storageService.store(key, valueToStore, 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
                this.storageService.store(expirationKey, Date.now() + RESTORE_EXPIRATION_TIME, 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
            }
            this.knownPortsRestoreValue = valueToStore;
        }
    }
    async showPortMismatchModalIfNeeded(tunnel, expectedLocal, attributes) {
        if (!tunnel.tunnelLocalPort || !attributes?.requireLocalPort) {
            return;
        }
        if (tunnel.tunnelLocalPort === expectedLocal) {
            return;
        }
        const newCooldown = new Date();
        if ((this.mismatchCooldown.getTime() + MISMATCH_LOCAL_PORT_COOLDOWN) > newCooldown.getTime()) {
            return;
        }
        this.mismatchCooldown = newCooldown;
        const mismatchString = nls.localize('remote.localPortMismatch.single', "Local port {0} could not be used for forwarding to remote port {1}.\n\nThis usually happens when there is already another process using local port {0}.\n\nPort number {2} has been used instead.", expectedLocal, tunnel.tunnelRemotePort, tunnel.tunnelLocalPort);
        return this.dialogService.info(mismatchString);
    }
    async forward(tunnelProperties, attributes) {
        if (!this.restoreComplete && this.environmentService.remoteAuthority) {
            await Event.toPromise(this.onRestoreComplete.event);
        }
        return this.doForward(tunnelProperties, attributes);
    }
    async doForward(tunnelProperties, attributes) {
        await this.extensionService.activateByEvent(ACTIVATION_EVENT);
        const existingTunnel = mapHasAddressLocalhostOrAllInterfaces(this.forwarded, tunnelProperties.remote.host, tunnelProperties.remote.port);
        attributes = attributes ??
            ((attributes !== null)
                ? (await this.getAttributes([tunnelProperties.remote]))?.get(tunnelProperties.remote.port)
                : undefined);
        const localPort = (tunnelProperties.local !== undefined) ? tunnelProperties.local : tunnelProperties.remote.port;
        let noTunnelValue;
        if (!existingTunnel) {
            const authority = this.environmentService.remoteAuthority;
            const addressProvider = authority ? {
                getAddress: async () => { return (await this.remoteAuthorityResolverService.resolveAuthority(authority)).authority; }
            } : undefined;
            const key = makeAddress(tunnelProperties.remote.host, tunnelProperties.remote.port);
            this.inProgress.set(key, true);
            tunnelProperties = this.mergeCachedAndUnrestoredProperties(key, tunnelProperties);
            const tunnel = await this.tunnelService.openTunnel(addressProvider, tunnelProperties.remote.host, tunnelProperties.remote.port, undefined, localPort, (!tunnelProperties.elevateIfNeeded) ? attributes?.elevateIfNeeded : tunnelProperties.elevateIfNeeded, tunnelProperties.privacy, attributes?.protocol);
            if (typeof tunnel === 'string') {
                // There was an error  while creating the tunnel.
                noTunnelValue = tunnel;
            }
            else if (tunnel && tunnel.localAddress) {
                const matchingCandidate = mapHasAddressLocalhostOrAllInterfaces(this._candidates ?? new Map(), tunnelProperties.remote.host, tunnelProperties.remote.port);
                const protocol = (tunnel.protocol ?
                    ((tunnel.protocol === TunnelProtocol.Https) ? TunnelProtocol.Https : TunnelProtocol.Http)
                    : (attributes?.protocol ?? TunnelProtocol.Http));
                const newForward = {
                    remoteHost: tunnel.tunnelRemoteHost,
                    remotePort: tunnel.tunnelRemotePort,
                    localPort: tunnel.tunnelLocalPort,
                    name: attributes?.label ?? tunnelProperties.name,
                    closeable: true,
                    localAddress: tunnel.localAddress,
                    protocol,
                    localUri: await this.makeLocalUri(tunnel.localAddress, attributes),
                    runningProcess: matchingCandidate?.detail,
                    hasRunningProcess: !!matchingCandidate,
                    pid: matchingCandidate?.pid,
                    source: tunnelProperties.source ?? UserTunnelSource,
                    privacy: tunnel.privacy,
                };
                this.forwarded.set(key, newForward);
                this.remoteTunnels.set(key, tunnel);
                this.inProgress.delete(key);
                await this.storeForwarded();
                await this.showPortMismatchModalIfNeeded(tunnel, localPort, attributes);
                this._onForwardPort.fire(newForward);
                return tunnel;
            }
            this.inProgress.delete(key);
        }
        else {
            return this.mergeAttributesIntoExistingTunnel(existingTunnel, tunnelProperties, attributes);
        }
        return noTunnelValue;
    }
    mergeCachedAndUnrestoredProperties(key, tunnelProperties) {
        const map = this.unrestoredExtensionTunnels.has(key) ? this.unrestoredExtensionTunnels : (this.sessionCachedProperties.has(key) ? this.sessionCachedProperties : undefined);
        if (map) {
            const updateProps = map.get(key);
            map.delete(key);
            if (updateProps) {
                tunnelProperties.name = updateProps.name ?? tunnelProperties.name;
                tunnelProperties.local = (('local' in updateProps) ? updateProps.local : (('localPort' in updateProps) ? updateProps.localPort : undefined)) ?? tunnelProperties.local;
                tunnelProperties.privacy = tunnelProperties.privacy;
            }
        }
        return tunnelProperties;
    }
    async mergeAttributesIntoExistingTunnel(existingTunnel, tunnelProperties, attributes) {
        const newName = attributes?.label ?? tunnelProperties.name;
        let MergedAttributeAction;
        (function (MergedAttributeAction) {
            MergedAttributeAction[MergedAttributeAction["None"] = 0] = "None";
            MergedAttributeAction[MergedAttributeAction["Fire"] = 1] = "Fire";
            MergedAttributeAction[MergedAttributeAction["Reopen"] = 2] = "Reopen";
        })(MergedAttributeAction || (MergedAttributeAction = {}));
        let mergedAction = MergedAttributeAction.None;
        if (newName !== existingTunnel.name) {
            existingTunnel.name = newName;
            mergedAction = MergedAttributeAction.Fire;
        }
        // Source of existing tunnel wins so that original source is maintained
        if ((attributes?.protocol || (existingTunnel.protocol !== TunnelProtocol.Http)) && (attributes?.protocol !== existingTunnel.protocol)) {
            tunnelProperties.source = existingTunnel.source;
            mergedAction = MergedAttributeAction.Reopen;
        }
        // New privacy value wins
        if (tunnelProperties.privacy && (existingTunnel.privacy !== tunnelProperties.privacy)) {
            mergedAction = MergedAttributeAction.Reopen;
        }
        switch (mergedAction) {
            case MergedAttributeAction.Fire: {
                this._onForwardPort.fire();
                break;
            }
            case MergedAttributeAction.Reopen: {
                await this.close(existingTunnel.remoteHost, existingTunnel.remotePort, TunnelCloseReason.User);
                await this.doForward(tunnelProperties, attributes);
            }
        }
        return mapHasAddressLocalhostOrAllInterfaces(this.remoteTunnels, tunnelProperties.remote.host, tunnelProperties.remote.port);
    }
    async name(host, port, name) {
        const existingForwarded = mapHasAddressLocalhostOrAllInterfaces(this.forwarded, host, port);
        const key = makeAddress(host, port);
        if (existingForwarded) {
            existingForwarded.name = name;
            await this.storeForwarded();
            this._onPortName.fire({ host, port });
            return;
        }
        else if (this.detected.has(key)) {
            this.detected.get(key).name = name;
            this._onPortName.fire({ host, port });
        }
    }
    async close(host, port, reason) {
        const key = makeAddress(host, port);
        const oldTunnel = this.forwarded.get(key);
        if ((reason === TunnelCloseReason.AutoForwardEnd) && oldTunnel && (oldTunnel.source.source === TunnelSource.Auto)) {
            this.sessionCachedProperties.set(key, {
                local: oldTunnel.localPort,
                name: oldTunnel.name,
                privacy: oldTunnel.privacy,
            });
        }
        await this.tunnelService.closeTunnel(host, port);
        return this.onTunnelClosed({ host, port }, reason);
    }
    address(host, port) {
        const key = makeAddress(host, port);
        return (this.forwarded.get(key) || this.detected.get(key))?.localAddress;
    }
    get environmentTunnelsSet() {
        return this._environmentTunnelsSet;
    }
    addEnvironmentTunnels(tunnels) {
        if (tunnels) {
            for (const tunnel of tunnels) {
                const matchingCandidate = mapHasAddressLocalhostOrAllInterfaces(this._candidates ?? new Map(), tunnel.remoteAddress.host, tunnel.remoteAddress.port);
                const localAddress = typeof tunnel.localAddress === 'string' ? tunnel.localAddress : makeAddress(tunnel.localAddress.host, tunnel.localAddress.port);
                this.detected.set(makeAddress(tunnel.remoteAddress.host, tunnel.remoteAddress.port), {
                    remoteHost: tunnel.remoteAddress.host,
                    remotePort: tunnel.remoteAddress.port,
                    localAddress: localAddress,
                    protocol: TunnelProtocol.Http,
                    localUri: this.makeLocalUri(localAddress),
                    closeable: false,
                    runningProcess: matchingCandidate?.detail,
                    hasRunningProcess: !!matchingCandidate,
                    pid: matchingCandidate?.pid,
                    privacy: TunnelPrivacyId.ConstantPrivate,
                    source: {
                        source: TunnelSource.Extension,
                        description: nls.localize('tunnel.staticallyForwarded', "Statically Forwarded")
                    }
                });
                this.tunnelService.setEnvironmentTunnel(tunnel.remoteAddress.host, tunnel.remoteAddress.port, localAddress, TunnelPrivacyId.ConstantPrivate, TunnelProtocol.Http);
            }
        }
        this._environmentTunnelsSet = true;
        this._onEnvironmentTunnelsSet.fire();
        this._onForwardPort.fire();
    }
    setCandidateFilter(filter) {
        this._candidateFilter = filter;
    }
    async setCandidates(candidates) {
        let processedCandidates = candidates;
        if (this._candidateFilter) {
            // When an extension provides a filter, we do the filtering on the extension host before the candidates are set here.
            // However, when the filter doesn't come from an extension we filter here.
            processedCandidates = await this._candidateFilter(candidates);
        }
        const removedCandidates = this.updateInResponseToCandidates(processedCandidates);
        this.logService.trace(`ForwardedPorts: (TunnelModel) removed candidates ${Array.from(removedCandidates.values()).map(candidate => candidate.port).join(', ')}`);
        this._onCandidatesChanged.fire(removedCandidates);
    }
    // Returns removed candidates
    updateInResponseToCandidates(candidates) {
        const removedCandidates = this._candidates ?? new Map();
        const candidatesMap = new Map();
        this._candidates = candidatesMap;
        candidates.forEach(value => {
            const addressKey = makeAddress(value.host, value.port);
            candidatesMap.set(addressKey, {
                host: value.host,
                port: value.port,
                detail: value.detail,
                pid: value.pid
            });
            removedCandidates.delete(addressKey);
            const forwardedValue = mapHasAddressLocalhostOrAllInterfaces(this.forwarded, value.host, value.port);
            if (forwardedValue) {
                forwardedValue.runningProcess = value.detail;
                forwardedValue.hasRunningProcess = true;
                forwardedValue.pid = value.pid;
            }
        });
        removedCandidates.forEach((_value, key) => {
            const parsedAddress = parseAddress(key);
            if (!parsedAddress) {
                return;
            }
            const forwardedValue = mapHasAddressLocalhostOrAllInterfaces(this.forwarded, parsedAddress.host, parsedAddress.port);
            if (forwardedValue) {
                forwardedValue.runningProcess = undefined;
                forwardedValue.hasRunningProcess = false;
                forwardedValue.pid = undefined;
            }
            const detectedValue = mapHasAddressLocalhostOrAllInterfaces(this.detected, parsedAddress.host, parsedAddress.port);
            if (detectedValue) {
                detectedValue.runningProcess = undefined;
                detectedValue.hasRunningProcess = false;
                detectedValue.pid = undefined;
            }
        });
        return removedCandidates;
    }
    get candidates() {
        return this._candidates ? Array.from(this._candidates.values()) : [];
    }
    get candidatesOrUndefined() {
        return this._candidates ? this.candidates : undefined;
    }
    async updateAttributes() {
        // If the label changes in the attributes, we should update it.
        const tunnels = Array.from(this.forwarded.values());
        const allAttributes = await this.getAttributes(tunnels.map(tunnel => {
            return { port: tunnel.remotePort, host: tunnel.remoteHost };
        }), false);
        if (!allAttributes) {
            return;
        }
        for (const forwarded of tunnels) {
            const attributes = allAttributes.get(forwarded.remotePort);
            if ((attributes?.protocol || (forwarded.protocol !== TunnelProtocol.Http)) && (attributes?.protocol !== forwarded.protocol)) {
                await this.doForward({
                    remote: { host: forwarded.remoteHost, port: forwarded.remotePort },
                    local: forwarded.localPort,
                    name: forwarded.name,
                    source: forwarded.source
                }, attributes);
            }
            if (!attributes) {
                continue;
            }
            if (attributes.label && attributes.label !== forwarded.name) {
                await this.name(forwarded.remoteHost, forwarded.remotePort, attributes.label);
            }
        }
    }
    async getAttributes(forwardedPorts, checkProviders = true) {
        const matchingCandidates = new Map();
        const pidToPortsMapping = new Map();
        forwardedPorts.forEach(forwardedPort => {
            const matchingCandidate = mapHasAddressLocalhostOrAllInterfaces(this._candidates ?? new Map(), LOCALHOST_ADDRESSES[0], forwardedPort.port) ?? forwardedPort;
            if (matchingCandidate) {
                matchingCandidates.set(forwardedPort.port, matchingCandidate);
                const pid = isCandidatePort(matchingCandidate) ? matchingCandidate.pid : undefined;
                if (!pidToPortsMapping.has(pid)) {
                    pidToPortsMapping.set(pid, []);
                }
                pidToPortsMapping.get(pid)?.push(forwardedPort.port);
            }
        });
        const configAttributes = new Map();
        forwardedPorts.forEach(forwardedPort => {
            const attributes = this.configPortsAttributes.getAttributes(forwardedPort.port, forwardedPort.host, matchingCandidates.get(forwardedPort.port)?.detail);
            if (attributes) {
                configAttributes.set(forwardedPort.port, attributes);
            }
        });
        if ((this.portAttributesProviders.length === 0) || !checkProviders) {
            return (configAttributes.size > 0) ? configAttributes : undefined;
        }
        // Group calls to provide attributes by pid.
        const allProviderResults = await Promise.all(this.portAttributesProviders.flatMap(provider => {
            return Array.from(pidToPortsMapping.entries()).map(entry => {
                const portGroup = entry[1];
                const matchingCandidate = matchingCandidates.get(portGroup[0]);
                return provider.providePortAttributes(portGroup, matchingCandidate?.pid, matchingCandidate?.detail, CancellationToken.None);
            });
        }));
        const providedAttributes = new Map();
        allProviderResults.forEach(attributes => attributes.forEach(attribute => {
            if (attribute) {
                providedAttributes.set(attribute.port, attribute);
            }
        }));
        if (!configAttributes && !providedAttributes) {
            return undefined;
        }
        // Merge. The config wins.
        const mergedAttributes = new Map();
        forwardedPorts.forEach(forwardedPorts => {
            const config = configAttributes.get(forwardedPorts.port);
            const provider = providedAttributes.get(forwardedPorts.port);
            mergedAttributes.set(forwardedPorts.port, {
                elevateIfNeeded: config?.elevateIfNeeded,
                label: config?.label,
                onAutoForward: config?.onAutoForward ?? PortsAttributes.providedActionToAction(provider?.autoForwardAction),
                requireLocalPort: config?.requireLocalPort,
                protocol: config?.protocol
            });
        });
        return mergedAttributes;
    }
    addAttributesProvider(provider) {
        this.portAttributesProviders.push(provider);
    }
};
__decorate([
    debounce(1000)
], TunnelModel.prototype, "storeForwarded", null);
TunnelModel = __decorate([
    __param(0, ITunnelService),
    __param(1, IStorageService),
    __param(2, IConfigurationService),
    __param(3, IWorkbenchEnvironmentService),
    __param(4, IRemoteAuthorityResolverService),
    __param(5, IWorkspaceContextService),
    __param(6, ILogService),
    __param(7, IDialogService),
    __param(8, IExtensionService),
    __param(9, IContextKeyService)
], TunnelModel);
export { TunnelModel };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHVubmVsTW9kZWwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vdHVubmVsTW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDakUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNuRixPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDckQsT0FBTyxFQUF1QixxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ3hILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNoRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFFckUsT0FBTyxFQUFFLCtCQUErQixFQUFxQixNQUFNLCtEQUErRCxDQUFDO0FBQ25JLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sZ0RBQWdELENBQUM7QUFDOUcsT0FBTyxFQUFnQixjQUFjLEVBQUUsY0FBYyxFQUFFLGVBQWUsRUFBRSxtQkFBbUIsRUFBa0QsV0FBVyxFQUFFLGVBQWUsRUFBRSxxQkFBcUIsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ2pSLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQzlGLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLGdEQUFnRCxDQUFD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