var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TerminalInitialHintContribution_1;
import * as dom from '../../../../../base/browser/dom.js';
import { renderFormattedText } from '../../../../../base/browser/formattedTextRenderer.js';
import { StandardMouseEvent } from '../../../../../base/browser/mouseEvent.js';
import { status } from '../../../../../base/browser/ui/aria/aria.js';
import { KeybindingLabel } from '../../../../../base/browser/ui/keybindingLabel/keybindingLabel.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { OS } from '../../../../../base/common/platform.js';
import { localize } from '../../../../../nls.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IChatAgentService } from '../../../chat/common/chatAgents.js';
import { ChatAgentLocation } from '../../../chat/common/constants.js';
import { ITerminalEditorService, ITerminalGroupService, ITerminalService } from '../../../terminal/browser/terminal.js';
import { registerTerminalContribution } from '../../../terminal/browser/terminalExtensions.js';
import { TerminalInstance } from '../../../terminal/browser/terminalInstance.js';
import './media/terminalInitialHint.css';
import { hasKey } from '../../../../../base/common/types.js';
const $ = dom.$;
var Constants;
(function (Constants) {
    Constants["InitialHintHideStorageKey"] = "terminal.initialHint.hide";
})(Constants || (Constants = {}));
export class InitialHintAddon extends Disposable {
    get onDidRequestCreateHint() { return this._onDidRequestCreateHint.event; }
    constructor(_capabilities, _onDidChangeAgents) {
        super();
        this._capabilities = _capabilities;
        this._onDidChangeAgents = _onDidChangeAgents;
        this._onDidRequestCreateHint = this._register(new Emitter());
        this._disposables = this._register(new MutableDisposable());
    }
    activate(terminal) {
        const store = this._register(new DisposableStore());
        this._disposables.value = store;
        const capability = this._capabilities.get(2 /* TerminalCapability.CommandDetection */);
        if (capability) {
            store.add(Event.once(capability.promptInputModel.onDidStartInput)(() => this._onDidRequestCreateHint.fire()));
        }
        else {
            this._register(this._capabilities.onDidAddCapability(e => {
                if (e.id === 2 /* TerminalCapability.CommandDetection */) {
                    const capability = e.capability;
                    store.add(Event.once(capability.promptInputModel.onDidStartInput)(() => this._onDidRequestCreateHint.fire()));
                    if (!capability.promptInputModel.value) {
                        this._onDidRequestCreateHint.fire();
                    }
                }
            }));
        }
        const agentListener = this._onDidChangeAgents((e) => {
            if (e?.locations.includes(ChatAgentLocation.Terminal)) {
                this._onDidRequestCreateHint.fire();
                agentListener.dispose();
            }
        });
        this._disposables.value?.add(agentListener);
    }
}
let TerminalInitialHintContribution = class TerminalInitialHintContribution extends Disposable {
    static { TerminalInitialHintContribution_1 = this; }
    static { this.ID = 'terminal.initialHint'; }
    static get(instance) {
        return instance.getContribution(TerminalInitialHintContribution_1.ID);
    }
    constructor(_ctx, _chatAgentService, _configurationService, _instantiationService, _storageService, _terminalEditorService, _terminalGroupService) {
        super();
        this._ctx = _ctx;
        this._chatAgentService = _chatAgentService;
        this._configurationService = _configurationService;
        this._instantiationService = _instantiationService;
        this._storageService = _storageService;
        this._terminalEditorService = _terminalEditorService;
        this._terminalGroupService = _terminalGroupService;
        // Reset hint state when config changes
        this._register(this._configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("terminal.integrated.initialHint" /* TerminalInitialHintSettingId.Enabled */)) {
                this._storageService.remove("terminal.initialHint.hide" /* Constants.InitialHintHideStorageKey */, -1 /* StorageScope.APPLICATION */);
            }
        }));
    }
    xtermOpen(xterm) {
        // Don't show is the terminal was launched by an extension or a feature like debug
        if (hasKey(this._ctx.instance, { shellLaunchConfig: true }) && (this._ctx.instance.shellLaunchConfig.isExtensionOwnedTerminal || this._ctx.instance.shellLaunchConfig.isFeatureTerminal)) {
            return;
        }
        // Don't show if disabled
        if (this._storageService.getBoolean("terminal.initialHint.hide" /* Constants.InitialHintHideStorageKey */, -1 /* StorageScope.APPLICATION */, false)) {
            return;
        }
        // Only show for the first terminal
        if (this._terminalGroupService.instances.length + this._terminalEditorService.instances.length !== 1) {
            return;
        }
        this._xterm = xterm;
        this._addon = this._register(this._instantiationService.createInstance(InitialHintAddon, this._ctx.instance.capabilities, this._chatAgentService.onDidChangeAgents));
        this._xterm.raw.loadAddon(this._addon);
        this._register(this._addon.onDidRequestCreateHint(() => this._createHint()));
    }
    _createHint() {
        const instance = this._ctx.instance instanceof TerminalInstance ? this._ctx.instance : undefined;
        const commandDetectionCapability = instance?.capabilities.get(2 /* TerminalCapability.CommandDetection */);
        if (!instance || !this._xterm || this._hintWidget || !commandDetectionCapability || commandDetectionCapability.promptInputModel.value || !!instance.shellLaunchConfig.attachPersistentProcess) {
            return;
        }
        if (!this._configurationService.getValue("terminal.integrated.initialHint" /* TerminalInitialHintSettingId.Enabled */)) {
            return;
        }
        if (!this._decoration) {
            const marker = this._xterm.raw.registerMarker();
            if (!marker) {
                return;
            }
            if (this._xterm.raw.buffer.active.cursorX === 0) {
                return;
            }
            this._register(marker);
            this._decoration = this._xterm.raw.registerDecoration({
                marker,
                x: this._xterm.raw.buffer.active.cursorX + 1,
            });
            if (this._decoration) {
                this._register(this._decoration);
            }
        }
        this._register(this._xterm.raw.onKey(() => this.dispose()));
        this._register(this._configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("terminal.integrated.initialHint" /* TerminalInitialHintSettingId.Enabled */) && !this._configurationService.getValue("terminal.integrated.initialHint" /* TerminalInitialHintSettingId.Enabled */)) {
                this.dispose();
            }
        }));
        const inputModel = commandDetectionCapability.promptInputModel;
        if (inputModel) {
            this._register(inputModel.onDidChangeInput(() => {
                if (inputModel.value) {
                    this.dispose();
                }
            }));
        }
        if (!this._decoration) {
            return;
        }
        this._register(this._decoration);
        this._register(this._decoration.onRender((e) => {
            if (!this._hintWidget && this._xterm?.isFocused && this._terminalGroupService.instances.length + this._terminalEditorService.instances.length === 1) {
                const terminalAgents = this._chatAgentService.getActivatedAgents().filter(candidate => candidate.locations.includes(ChatAgentLocation.Terminal));
                if (terminalAgents?.length) {
                    const widget = this._register(this._instantiationService.createInstance(TerminalInitialHintWidget, instance));
                    this._addon?.dispose();
                    this._hintWidget = widget.getDomNode(terminalAgents);
                    if (!this._hintWidget) {
                        return;
                    }
                    e.appendChild(this._hintWidget);
                    e.classList.add('terminal-initial-hint');
                    const font = this._xterm.getFont();
                    if (font) {
                        e.style.fontFamily = font.fontFamily;
                        e.style.fontSize = font.fontSize + 'px';
                    }
                }
            }
            if (this._hintWidget && this._xterm) {
                const decoration = this._hintWidget.parentElement;
                if (decoration) {
                    decoration.style.width = (this._xterm.raw.cols - this._xterm.raw.buffer.active.cursorX) / this._xterm.raw.cols * 100 + '%';
                }
            }
        }));
    }
};
TerminalInitialHintContribution = TerminalInitialHintContribution_1 = __decorate([
    __param(1, IChatAgentService),
    __param(2, IConfigurationService),
    __param(3, IInstantiationService),
    __param(4, IStorageService),
    __param(5, ITerminalEditorService),
    __param(6, ITerminalGroupService)
], TerminalInitialHintContribution);
export { TerminalInitialHintContribution };
registerTerminalContribution(TerminalInitialHintContribution.ID, TerminalInitialHintContribution, false);
let TerminalInitialHintWidget = class TerminalInitialHintWidget extends Disposable {
    constructor(_instance, _commandService, _configurationService, _contextMenuService, _keybindingService, _storageService, _telemetryService, _terminalService) {
        super();
        this._instance = _instance;
        this._commandService = _commandService;
        this._configurationService = _configurationService;
        this._contextMenuService = _contextMenuService;
        this._keybindingService = _keybindingService;
        this._storageService = _storageService;
        this._telemetryService = _telemetryService;
        this._terminalService = _terminalService;
        this._toDispose = this._register(new DisposableStore());
        this._isVisible = false;
        this._ariaLabel = '';
        this._toDispose.add(_instance.onDidFocus(() => {
            if (this._instance.hasFocus && this._isVisible && this._ariaLabel && this._configurationService.getValue("accessibility.verbosity.terminalChat" /* AccessibilityVerbositySettingId.TerminalInlineChat */)) {
                status(this._ariaLabel);
            }
        }));
        this._toDispose.add(_terminalService.onDidChangeInstances(() => {
            if (this._terminalService.instances.length !== 1) {
                this.dispose();
            }
        }));
        this._toDispose.add(this._configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("terminal.integrated.initialHint" /* TerminalInitialHintSettingId.Enabled */) && !this._configurationService.getValue("terminal.integrated.initialHint" /* TerminalInitialHintSettingId.Enabled */)) {
                this.dispose();
            }
        }));
    }
    _getHintInlineChat(agents) {
        let ariaLabel = `Open chat.`;
        const handleClick = () => {
            this._storageService.store("terminal.initialHint.hide" /* Constants.InitialHintHideStorageKey */, true, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
            this._telemetryService.publicLog2('workbenchActionExecuted', {
                id: 'terminalInlineChat.hintAction',
                from: 'hint'
            });
            this._commandService.executeCommand("workbench.action.terminal.chat.start" /* TerminalChatCommandId.Start */, { from: 'hint' });
        };
        this._toDispose.add(this._commandService.onDidExecuteCommand(e => {
            if (e.commandId === "workbench.action.terminal.chat.start" /* TerminalChatCommandId.Start */) {
                this._storageService.store("terminal.initialHint.hide" /* Constants.InitialHintHideStorageKey */, true, -1 /* StorageScope.APPLICATION */, 0 /* StorageTarget.USER */);
                this.dispose();
            }
        }));
        const hintHandler = {
            disposables: this._toDispose,
            callback: (index, _event) => {
                switch (index) {
                    case '0':
                        handleClick();
                        break;
                }
            }
        };
        const hintElement = $('div.terminal-initial-hint');
        hintElement.style.display = 'block';
        const keybindingHint = this._keybindingService.lookupKeybinding("workbench.action.terminal.chat.start" /* TerminalChatCommandId.Start */);
        const keybindingHintLabel = keybindingHint?.getLabel();
        if (keybindingHint && keybindingHintLabel) {
            const actionPart = localize('emptyHintText', 'Open chat {0}. ', keybindingHintLabel);
            const [before, after] = actionPart.split(keybindingHintLabel).map((fragment) => {
                const hintPart = $('a', undefined, fragment);
                this._toDispose.add(dom.addDisposableListener(hintPart, dom.EventType.CLICK, handleClick));
                return hintPart;
            });
            hintElement.appendChild(before);
            const label = hintHandler.disposables.add(new KeybindingLabel(hintElement, OS));
            label.set(keybindingHint);
            label.element.style.width = 'min-content';
            label.element.style.display = 'inline';
            label.element.style.cursor = 'pointer';
            this._toDispose.add(dom.addDisposableListener(label.element, dom.EventType.CLICK, handleClick));
            hintElement.appendChild(after);
            const typeToDismiss = localize('hintTextDismiss', 'Start typing to dismiss.');
            const textHint2 = $('span.detail', undefined, typeToDismiss);
            hintElement.appendChild(textHint2);
            ariaLabel = actionPart.concat(typeToDismiss);
        }
        else {
            const hintMsg = localize({
                key: 'inlineChatHint',
                comment: [
                    'Preserve double-square brackets and their order',
                ]
            }, '[[Open chat]] or start typing to dismiss.');
            const rendered = renderFormattedText(hintMsg, { actionHandler: hintHandler });
            hintElement.appendChild(rendered);
        }
        return { ariaLabel, hintHandler, hintElement };
    }
    getDomNode(agents) {
        if (!this._domNode) {
            this._domNode = $('.terminal-initial-hint');
            this._domNode.style.paddingLeft = '4px';
            const { hintElement, ariaLabel } = this._getHintInlineChat(agents);
            this._domNode.append(hintElement);
            this._ariaLabel = ariaLabel.concat(localize('disableHint', ' Toggle {0} in settings to disable this hint.', "accessibility.verbosity.terminalChat" /* AccessibilityVerbositySettingId.TerminalInlineChat */));
            this._toDispose.add(dom.addDisposableListener(this._domNode, 'click', () => {
                this._domNode?.remove();
                this._domNode = undefined;
            }));
            this._toDispose.add(dom.addDisposableListener(this._domNode, dom.EventType.CONTEXT_MENU, (e) => {
                this._contextMenuService.showContextMenu({
                    getAnchor: () => { return new StandardMouseEvent(dom.getActiveWindow(), e); },
                    getActions: () => {
                        return [{
                                id: 'workench.action.disableTerminalInitialHint',
                                label: localize('disableInitialHint', "Disable Initial Hint"),
                                tooltip: localize('disableInitialHint', "Disable Initial Hint"),
                                enabled: true,
                                class: undefined,
                                run: () => this._configurationService.updateValue("terminal.integrated.initialHint" /* TerminalInitialHintSettingId.Enabled */, false)
                            }
                        ];
                    }
                });
            }));
        }
        return this._domNode;
    }
    dispose() {
        this._domNode?.remove();
        super.dispose();
    }
};
TerminalInitialHintWidget = __decorate([
    __param(1, ICommandService),
    __param(2, IConfigurationService),
    __param(3, IContextMenuService),
    __param(4, IKeybindingService),
    __param(5, IStorageService),
    __param(6, ITelemetryService),
    __param(7, ITerminalService)
], TerminalInitialHintWidget);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWwuaW5pdGlhbEhpbnQuY29udHJpYnV0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9jaGF0L2Jyb3dzZXIvdGVybWluYWwuaW5pdGlhbEhpbnQuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFLQSxPQUFPLEtBQUssR0FBRyxNQUFNLG9DQUFvQyxDQUFDO0FBQzFELE9BQU8sRUFBeUIsbUJBQW1CLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNsSCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMvRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDckUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLG1FQUFtRSxDQUFDO0FBRXBHLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDckUsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN6RyxPQUFPLEVBQUUsRUFBRSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDNUQsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUN0RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNqRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM3RixPQUFPLEVBQUUsZUFB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