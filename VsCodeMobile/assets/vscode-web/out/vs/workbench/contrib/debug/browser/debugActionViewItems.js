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
import * as dom from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { SelectBox, SeparatorSelectOption } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IDebugService } from '../common/debug.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { selectBorder, selectBackground, asCssVariable } from '../../../../platform/theme/common/colorRegistry.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { dispose } from '../../../../base/common/lifecycle.js';
import { ADD_CONFIGURATION_ID } from './debugCommands.js';
import { BaseActionViewItem, SelectActionViewItem } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { debugStart } from './debugIcons.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { hasNativeContextMenu } from '../../../../platform/window/common/window.js';
import { Gesture, EventType as TouchEventType } from '../../../../base/browser/touch.js';
const $ = dom.$;
let StartDebugActionViewItem = class StartDebugActionViewItem extends BaseActionViewItem {
    constructor(context, action, options, debugService, configurationService, commandService, contextService, contextViewService, keybindingService, hoverService, contextKeyService) {
        super(context, action, options);
        this.context = context;
        this.debugService = debugService;
        this.configurationService = configurationService;
        this.commandService = commandService;
        this.contextService = contextService;
        this.keybindingService = keybindingService;
        this.hoverService = hoverService;
        this.contextKeyService = contextKeyService;
        this.debugOptions = [];
        this.selected = 0;
        this.providers = [];
        this.toDispose = [];
        this.selectBox = new SelectBox([], -1, contextViewService, defaultSelectBoxStyles, { ariaLabel: nls.localize('debugLaunchConfigurations', 'Debug Launch Configurations'), useCustomDrawn: !hasNativeContextMenu(this.configurationService) });
        this.selectBox.setFocusable(false);
        this.toDispose.push(this.selectBox);
        this.registerListeners();
    }
    registerListeners() {
        this.toDispose.push(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('launch')) {
                this.updateOptions();
            }
        }));
        this.toDispose.push(this.debugService.getConfigurationManager().onDidSelectConfiguration(() => {
            this.updateOptions();
        }));
    }
    render(container) {
        this.container = container;
        container.classList.add('start-debug-action-item');
        this.start = dom.append(container, $(ThemeIcon.asCSSSelector(debugStart)));
        const keybinding = this.keybindingService.lookupKeybinding(this.action.id)?.getLabel();
        const keybindingLabel = keybinding ? ` (${keybinding})` : '';
        const title = this.action.label + keybindingLabel;
        this.toDispose.push(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), this.start, title));
        this.start.setAttribute('role', 'button');
        this._setAriaLabel(title);
        this._register(Gesture.addTarget(this.start));
        for (const event of [dom.EventType.CLICK, TouchEventType.Tap]) {
            this.toDispose.push(dom.addDisposableListener(this.start, event, () => {
                this.start.blur();
                if (this.debugService.state !== 1 /* State.Initializing */) {
                    this.actionRunner.run(this.action, this.context);
                }
            }));
        }
        this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.MOUSE_DOWN, (e) => {
            if (this.action.enabled && e.button === 0) {
                this.start.classList.add('active');
            }
        }));
        this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.MOUSE_UP, () => {
            this.start.classList.remove('active');
        }));
        this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.MOUSE_OUT, () => {
            this.start.classList.remove('active');
        }));
        this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.KEY_DOWN, (e) => {
            const event = new StandardKeyboardEvent(e);
            if (event.equals(17 /* KeyCode.RightArrow */)) {
                this.start.tabIndex = -1;
                this.selectBox.focus();
                event.stopPropagation();
            }
        }));
        this.toDispose.push(this.selectBox.onDidSelect(async (e) => {
            const target = this.debugOptions[e.index];
            const shouldBeSelected = target.handler ? await target.handler() : false;
            if (shouldBeSelected) {
                this.selected = e.index;
            }
            else {
                // Some select options should not remain selected https://github.com/microsoft/vscode/issues/31526
                this.selectBox.select(this.selected);
            }
        }));
        const selectBoxContainer = $('.configuration');
        this.selectBox.render(dom.append(container, selectBoxContainer));
        this.toDispose.push(dom.addDisposableListener(selectBoxContainer, dom.EventType.KEY_DOWN, (e) => {
            const event = new StandardKeyboardEvent(e);
            if (event.equals(15 /* KeyCode.LeftArrow */)) {
                this.selectBox.setFocusable(false);
                this.start.tabIndex = 0;
                this.start.focus();
                event.stopPropagation();
                event.preventDefault();
            }
        }));
        this.container.style.border = `1px solid ${asCssVariable(selectBorder)}`;
        selectBoxContainer.style.borderLeft = `1px solid ${asCssVariable(selectBorder)}`;
        this.container.style.backgroundColor = asCssVariable(selectBackground);
        const configManager = this.debugService.getConfigurationManager();
        const updateDynamicConfigs = () => configManager.getDynamicProviders().then(providers => {
            if (providers.length !== this.providers.length) {
                this.providers = providers;
                this.updateOptions();
            }
        });
        this.toDispose.push(configManager.onDidChangeConfigurationProviders(updateDynamicConfigs));
        updateDynamicConfigs();
        this.updateOptions();
    }
    setActionContext(context) {
        this.context = context;
    }
    isEnabled() {
        return true;
    }
    focus(fromRight) {
        if (fromRight) {
            this.selectBox.focus();
        }
        else {
            this.start.tabIndex = 0;
            this.start.focus();
        }
    }
    blur() {
        this.start.tabIndex = -1;
        this.selectBox.blur();
        this.container.blur();
    }
    setFocusable(focusable) {
        if (focusable) {
            this.start.tabIndex = 0;
        }
        else {
            this.start.tabIndex = -1;
            this.selectBox.setFocusable(false);
        }
    }
    dispose() {
        this.toDispose = dispose(this.toDispose);
        super.dispose();
    }
    updateOptions() {
        this.selected = 0;
        this.debugOptions = [];
        const manager = this.debugService.getConfigurationManager();
        const inWorkspace = this.contextService.getWorkbenchState() === 3 /* WorkbenchState.WORKSPACE */;
        let lastGroup;
        const disabledIdxs = [];
        manager.getAllConfigurations().forEach(({ launch, name, presentation }) => {
            if (lastGroup !== presentation?.group) {
                lastGroup = presentation?.group;
                if (this.debugOptions.length) {
                    this.debugOptions.push({ label: SeparatorSelectOption.text, handler: () => Promise.resolve(false) });
                    disabledIdxs.push(this.debugOptions.length - 1);
                }
            }
            if (name === manager.selectedConfiguration.name && launch === manager.selectedConfiguration.launch) {
                this.selected = this.debugOptions.length;
            }
            const label = inWorkspace ? `${name} (${launch.name})` : name;
            this.debugOptions.push({
                label, handler: async () => {
                    await manager.selectConfiguration(launch, name);
                    return true;
                }
            });
        });
        // Only take 3 elements from the recent dynamic configurations to not clutter the dropdown
        manager.getRecentDynamicConfigurations().slice(0, 3).forEach(({ name, type }) => {
            if (type === manager.selectedConfiguration.type && manager.selectedConfiguration.name === name) {
                this.selected = this.debugOptions.length;
            }
            this.debugOptions.push({
                label: name,
                handler: async () => {
                    await manager.selectConfiguration(undefined, name, undefined, { type });
                    return true;
                }
            });
        });
        if (this.debugOptions.length === 0) {
            this.debugOptions.push({ label: nls.localize('noConfigurations', "No Configurations"), handler: async () => false });
        }
        this.debugOptions.push({ label: SeparatorSelectOption.text, handler: () => Promise.resolve(false) });
        disabledIdxs.push(this.debugOptions.length - 1);
        this.providers.forEach(p => {
            this.debugOptions.push({
                label: `${p.label}...`,
                handler: async () => {
                    const picked = await p.pick();
                    if (picked) {
                        await manager.selectConfiguration(picked.launch, picked.config.name, picked.config, { type: p.type });
                        return true;
                    }
                    return false;
                }
            });
        });
        manager.getLaunches().filter(l => !l.hidden).forEach(l => {
            const label = inWorkspace ? nls.localize("addConfigTo", "Add Config ({0})...", l.name) : nls.localize('addConfiguration', "Add Configuration...");
            this.debugOptions.push({
                label, handler: async () => {
                    await this.commandService.executeCommand(ADD_CONFIGURATION_ID, l.uri.toString());
                    return false;
                }
            });
        });
        this.selectBox.setOptions(this.debugOptions.map((data, index) => ({ text: data.label, isDisabled: disabledIdxs.indexOf(index) !== -1 })), this.selected);
    }
    _setAriaLabel(title) {
        let ariaLabel = title;
        let keybinding;
        const verbose = this.configurationService.getValue("accessibility.verbosity.debug" /* AccessibilityVerbositySettingId.Debug */);
        if (verbose) {
            keybinding = this.keybindingService.lookupKeybinding("editor.action.accessibilityHelp" /* AccessibilityCommandId.OpenAccessibilityHelp */, this.contextKeyService)?.getLabel() ?? undefined;
        }
        if (keybinding) {
            ariaLabel = nls.localize('commentLabelWithKeybinding', "{0}, use ({1}) for accessibility help", ariaLabel, keybinding);
        }
        else {
            ariaLabel = nls.localize('commentLabelWithKeybindingNoKeybinding', "{0}, run the command Open Accessibility Help which is currently not triggerable via keybinding.", ariaLabel);
        }
        this.start.ariaLabel = ariaLabel;
    }
};
StartDebugActionViewItem = __decorate([
    __param(3, IDebugService),
    __param(4, IConfigurationService),
    __param(5, ICommandService),
    __param(6, IWorkspaceContextService),
    __param(7, IContextViewService),
    __param(8, IKeybindingService),
    __param(9, IHoverService),
    __param(10, IContextKeyService)
], StartDebugActionViewItem);
export { StartDebugActionViewItem };
let FocusSessionActionViewItem = class FocusSessionActionViewItem extends SelectActionViewItem {
    constructor(action, session, debugService, contextViewService, configurationService) {
        super(null, action, [], -1, contextViewService, defaultSelectBoxStyles, { ariaLabel: nls.localize('debugSession', 'Debug Session'), useCustomDrawn: !hasNativeContextMenu(configurationService) });
        this.debugService = debugService;
        this.configurationService = configurationService;
        this._register(this.debugService.getViewModel().onDidFocusSession(() => {
            const session = this.getSelectedSession();
            if (session) {
                const index = this.getSessions().indexOf(session);
                this.select(index);
            }
        }));
        this._register(this.debugService.onDidNewSession(session => {
            const sessionListeners = [];
            sessionListeners.push(session.onDidChangeName(() => this.update()));
            sessionListeners.push(session.onDidEndAdapter(() => dispose(sessionListeners)));
            this.update();
        }));
        this.getSessions().forEach(session => {
            this._register(session.onDidChangeName(() => this.update()));
        });
        this._register(this.debugService.onDidEndSession(() => this.update()));
        const selectedSession = session ? this.mapFocusedSessionToSelected(session) : undefined;
        this.update(selectedSession);
    }
    getActionContext(_, index) {
        return this.getSessions()[index];
    }
    update(session) {
        if (!session) {
            session = this.getSelectedSession();
        }
        const sessions = this.getSessions();
        const names = sessions.map(s => {
            const label = s.getLabel();
            if (s.parentSession) {
                // Indent child sessions so they look like children
                return `\u00A0\u00A0${label}`;
            }
            return label;
        });
        this.setOptions(names.map((data) => ({ text: data })), session ? sessions.indexOf(session) : undefined);
    }
    getSelectedSession() {
        const session = this.debugService.getViewModel().focusedSession;
        return session ? this.mapFocusedSessionToSelected(session) : undefined;
    }
    getSessions() {
        const showSubSessions = this.configurationService.getValue('debug').showSubSessionsInToolBar;
        const sessions = this.debugService.getModel().getSessions();
        return showSubSessions ? sessions : sessions.filter(s => !s.parentSession);
    }
    mapFocusedSessionToSelected(focusedSession) {
        const showSubSessions = this.configurationService.getValue('debug').showSubSessionsInToolBar;
        while (focusedSession.parentSession && !showSubSessions) {
            focusedSession = focusedSession.parentSession;
        }
        return focusedSession;
    }
};
FocusSessionActionViewItem = __decorate([
    __param(2, IDebugService),
    __param(3, IContextViewService),
    __param(4, IConfigurationService)
], FocusSessionActionViewItem);
export { FocusSessionActionViewItem };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWdBY3Rpb25WaWV3SXRlbXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZGVidWcvYnJvd3Nlci9kZWJ1Z0FjdGlvblZpZXdJdGVtcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9CQUFvQixDQUFDO0FBRzFDLE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDbEYsT0FBTyxFQUFFLFNBQVMsRUFBcUIscUJBQXFCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN6SCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDbkYsT0FBTyxFQUFFLGFBQWEsRUFBK0QsTUFBTSxvQkFBb0IsQ0FBQztBQUNoSCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakUsT0FBTyxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUNuSCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUM5RixPQUFPLEVBQUUsd0JBQXdCLEVBQWtCLE1BQU0sb0RBQW9ELENBQUM7QUFDOUcsT0FBTyxFQUFlLE9BQU8sRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzFELE9BQU8sRUFBRSxrQkFBa0IsRUFBOEIsb0JBQW9CLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUNoSixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0saUJB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