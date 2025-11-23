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
var TerminalStickyScrollContribution_1;
import { Event } from '../../../../../base/common/event.js';
import { Disposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { TerminalInstance, TerminalInstanceColorProvider } from '../../../terminal/browser/terminalInstance.js';
import './media/stickyScroll.css';
import { TerminalStickyScrollOverlay } from './terminalStickyScrollOverlay.js';
let TerminalStickyScrollContribution = class TerminalStickyScrollContribution extends Disposable {
    static { TerminalStickyScrollContribution_1 = this; }
    static { this.ID = 'terminal.stickyScroll'; }
    static get(instance) {
        return instance.getContribution(TerminalStickyScrollContribution_1.ID);
    }
    constructor(_ctx, _configurationService, _contextKeyService, _instantiationService, _keybindingService) {
        super();
        this._ctx = _ctx;
        this._configurationService = _configurationService;
        this._contextKeyService = _contextKeyService;
        this._instantiationService = _instantiationService;
        this._keybindingService = _keybindingService;
        this._overlay = this._register(new MutableDisposable());
        this._enableListeners = this._register(new MutableDisposable());
        this._disableListeners = this._register(new MutableDisposable());
        this._richCommandDetectionListeners = this._register(new MutableDisposable());
        this._register(Event.runAndSubscribe(this._configurationService.onDidChangeConfiguration, e => {
            if (!e || e.affectsConfiguration("terminal.integrated.stickyScroll.enabled" /* TerminalStickyScrollSettingId.Enabled */)) {
                this._refreshState();
            }
        }));
    }
    xtermReady(xterm) {
        this._xterm = xterm;
        this._refreshState();
    }
    xtermOpen(xterm) {
        this._refreshState();
    }
    hideLock() {
        this._overlay.value?.lockHide();
    }
    hideUnlock() {
        this._overlay.value?.unlockHide();
    }
    _refreshState() {
        if (this._overlay.value) {
            this._tryDisable();
        }
        else {
            this._tryEnable();
        }
        if (this._overlay.value) {
            this._enableListeners.clear();
            if (!this._disableListeners.value) {
                this._disableListeners.value = this._ctx.instance.capabilities.onDidRemoveCapability(e => {
                    if (e.id === 2 /* TerminalCapability.CommandDetection */) {
                        this._refreshState();
                    }
                });
            }
        }
        else {
            this._disableListeners.clear();
            if (!this._enableListeners.value) {
                this._enableListeners.value = this._ctx.instance.capabilities.onDidAddCapability(e => {
                    if (e.id === 2 /* TerminalCapability.CommandDetection */) {
                        this._refreshState();
                    }
                });
            }
        }
    }
    _tryEnable() {
        const capability = this._ctx.instance.capabilities.get(2 /* TerminalCapability.CommandDetection */);
        if (this._shouldBeEnabled()) {
            const xtermCtorEventually = TerminalInstance.getXtermConstructor(this._keybindingService, this._contextKeyService);
            this._overlay.value = this._instantiationService.createInstance(TerminalStickyScrollOverlay, this._ctx.instance, this._xterm, this._instantiationService.createInstance(TerminalInstanceColorProvider, this._ctx.instance.targetRef), capability, xtermCtorEventually);
            this._richCommandDetectionListeners.clear();
        }
        else if (capability && !capability.hasRichCommandDetection) {
            this._richCommandDetectionListeners.value = capability.onSetRichCommandDetection(() => {
                this._refreshState();
            });
        }
        else {
            // No or Rich shell integration does not need listener
            this._richCommandDetectionListeners.clear();
        }
    }
    _tryDisable() {
        if (!this._shouldBeEnabled()) {
            this._overlay.clear();
            this._richCommandDetectionListeners.clear();
        }
    }
    _shouldBeEnabled() {
        const capability = this._ctx.instance.capabilities.get(2 /* TerminalCapability.CommandDetection */);
        const result = !!(this._configurationService.getValue("terminal.integrated.stickyScroll.enabled" /* TerminalStickyScrollSettingId.Enabled */) && capability && capability.hasRichCommandDetection && this._xterm?.raw?.element);
        return result;
    }
};
TerminalStickyScrollContribution = TerminalStickyScrollContribution_1 = __decorate([
    __param(1, IConfigurationService),
    __param(2, IContextKeyService),
    __param(3, IInstantiationService),
    __param(4, IKeybindingService)
], TerminalStickyScrollContribution);
export { TerminalStickyScrollContribution };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxTdGlja3lTY3JvbGxDb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVybWluYWxDb250cmliL3N0aWNreVNjcm9sbC9icm93c2VyL3Rlcm1pbmFsU3RpY2t5U2Nyb2xsQ29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDNUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBSTdGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSw2QkFBNkIsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBRWhILE9BQU8sMEJBQTBCLENBQUM7QUFDbEMsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFeEUsSUFBTSxnQ0FBZ0MsR0FBdEMsTUFBTSxnQ0FBaUMsU0FBUSxVQUFVOzthQUMvQyxPQUFFLEdBQUcsdUJBQXVCLEFBQTFCLENBQTJCO0lBRTdDLE1BQU0sQ0FBQyxHQUFHLENBQUMsUUFBMkI7UUFDckMsT0FBTyxRQUFRLENBQUMsZUFBZSxDQUFtQyxrQ0FBZ0MsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUN4RyxDQUFDO0lBVUQsWUFDa0IsSUFBa0MsRUFDNUIscUJBQTZELEVBQ2hFLGtCQUF1RCxFQUNwRCxxQkFB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