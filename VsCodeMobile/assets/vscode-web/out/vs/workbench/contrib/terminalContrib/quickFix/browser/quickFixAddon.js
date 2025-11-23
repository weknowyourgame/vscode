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
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import * as dom from '../../../../../base/browser/dom.js';
import { asArray } from '../../../../../base/common/arrays.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { updateLayout } from '../../../terminal/browser/xterm/decorationStyles.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { IActionWidgetService } from '../../../../../platform/actionWidget/browser/actionWidget.js';
import { getLinesForCommand } from '../../../../../platform/terminal/common/capabilities/commandDetectionCapability.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { Schemas } from '../../../../../base/common/network.js';
import { ITerminalQuickFixService, TerminalQuickFixType } from './quickFix.js';
import { CodeActionKind } from '../../../../../editor/contrib/codeAction/common/types.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { hasKey } from '../../../../../base/common/types.js';
var QuickFixDecorationSelector;
(function (QuickFixDecorationSelector) {
    QuickFixDecorationSelector["QuickFix"] = "quick-fix";
})(QuickFixDecorationSelector || (QuickFixDecorationSelector = {}));
const quickFixClasses = [
    "quick-fix" /* QuickFixDecorationSelector.QuickFix */,
    "codicon" /* DecorationSelector.Codicon */,
    "terminal-command-decoration" /* DecorationSelector.CommandDecoration */,
    "xterm-decoration" /* DecorationSelector.XtermDecoration */
];
let TerminalQuickFixAddon = class TerminalQuickFixAddon extends Disposable {
    constructor(_sessionId, _aliases, _capabilities, _accessibilitySignalService, _actionWidgetService, _commandService, _configurationService, _extensionService, _labelService, _openerService, _telemetryService, _quickFixService) {
        super();
        this._sessionId = _sessionId;
        this._aliases = _aliases;
        this._capabilities = _capabilities;
        this._accessibilitySignalService = _accessibilitySignalService;
        this._actionWidgetService = _actionWidgetService;
        this._commandService = _commandService;
        this._configurationService = _configurationService;
        this._extensionService = _extensionService;
        this._labelService = _labelService;
        this._openerService = _openerService;
        this._telemetryService = _telemetryService;
        this._quickFixService = _quickFixService;
        this._commandListeners = new Map();
        this._decoration = this._register(new MutableDisposable());
        this._decorationDisposables = this._register(new MutableDisposable());
        this._registeredSelectors = new Set();
        this._didRun = false;
        this._onDidRequestRerunCommand = new Emitter();
        this.onDidRequestRerunCommand = this._onDidRequestRerunCommand.event;
        this._onDidUpdateQuickFixes = new Emitter();
        this.onDidUpdateQuickFixes = this._onDidUpdateQuickFixes.event;
        const commandDetectionCapability = this._capabilities.get(2 /* TerminalCapability.CommandDetection */);
        if (commandDetectionCapability) {
            this._registerCommandHandlers();
        }
        else {
            this._register(this._capabilities.onDidAddCommandDetectionCapability(() => {
                this._registerCommandHandlers();
            }));
        }
        this._register(this._quickFixService.onDidRegisterProvider(result => this.registerCommandFinishedListener(convertToQuickFixOptions(result))));
        this._quickFixService.extensionQuickFixes.then(quickFixSelectors => {
            for (const selector of quickFixSelectors) {
                this.registerCommandSelector(selector);
            }
        });
        this._register(this._quickFixService.onDidRegisterCommandSelector(selector => this.registerCommandSelector(selector)));
        this._register(this._quickFixService.onDidUnregisterProvider(id => this._commandListeners.delete(id)));
        this._register(this._configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration("terminal.integrated.shellIntegration.quickFixEnabled" /* TerminalSettingId.ShellIntegrationQuickFixEnabled */)) {
                // Clear existing decorations when setting changes
                this._decoration.clear();
                this._decorationDisposables.clear();
            }
        }));
    }
    activate(terminal) {
        this._terminal = terminal;
    }
    showMenu() {
        if (!this._currentRenderContext) {
            return;
        }
        const actions = this._currentRenderContext.quickFixes.map(f => new TerminalQuickFixItem(f, f.type, f.source, f.label, f.kind));
        const actionSet = {
            allActions: actions,
            hasAutoFix: false,
            hasAIFix: false,
            allAIFixes: false,
            validActions: actions,
            dispose: () => { }
        };
        const delegate = {
            onSelect: async (fix) => {
                fix.action?.run();
                this._actionWidgetService.hide();
            },
            onHide: () => {
                this._terminal?.focus();
            },
        };
        this._actionWidgetService.show('quickFixWidget', false, toActionWidgetItems(actionSet.validActions, true), delegate, this._currentRenderContext.anchor, this._currentRenderContext.parentElement);
    }
    registerCommandSelector(selector) {
        if (this._registeredSelectors.has(selector.id)) {
            return;
        }
        const matcherKey = selector.commandLineMatcher.toString();
        const currentOptions = this._commandListeners.get(matcherKey) || [];
        currentOptions.push({
            id: selector.id,
            type: 'unresolved',
            commandLineMatcher: selector.commandLineMatcher,
            outputMatcher: selector.outputMatcher,
            commandExitResult: selector.commandExitResult,
            kind: selector.kind
        });
        this._registeredSelectors.add(selector.id);
        this._commandListeners.set(matcherKey, currentOptions);
    }
    registerCommandFinishedListener(options) {
        const matcherKey = options.commandLineMatcher.toString();
        let currentOptions = this._commandListeners.get(matcherKey) || [];
        // removes the unresolved options
        currentOptions = currentOptions.filter(o => o.id !== options.id);
        currentOptions.push(options);
        this._commandListeners.set(matcherKey, currentOptions);
    }
    _registerCommandHandlers() {
        const terminal = this._terminal;
        const commandDetection = this._capabilities.get(2 /* TerminalCapability.CommandDetection */);
        if (!terminal || !commandDetection) {
            return;
        }
        this._register(commandDetection.onCommandFinished(async (command) => await this._resolveQuickFixes(command, this._aliases)));
    }
    /**
     * Resolves quick fixes, if any, based on the
     * @param command & its output
     */
    async _resolveQuickFixes(command, aliases) {
        const terminal = this._terminal;
        if (!terminal || command.wasReplayed) {
            return;
        }
        if (command.command !== '' && this._lastQuickFixId) {
            this._disposeQuickFix(command, this._lastQuickFixId);
        }
        const resolver = async (selector, lines) => {
            if (lines === undefined) {
                return undefined;
            }
            const id = selector.id;
            await this._extensionService.activateByEvent(`onTerminalQuickFixRequest:${id}`);
            return this._quickFixService.providers.get(id)?.provideTerminalQuickFixes(command, lines, {
                type: 'resolved',
                commandLineMatcher: selector.commandLineMatcher,
                outputMatcher: selector.outputMatcher,
                commandExitResult: selector.commandExitResult,
                kind: selector.kind,
                id: selector.id
            }, new CancellationTokenSource().token);
        };
        const result = await getQuickFixesForCommand(aliases, terminal, command, this._commandListeners, this._commandService, this._openerService, this._labelService, this._onDidRequestRerunCommand, resolver);
        if (!result) {
            return;
        }
        this._quickFixes = result;
        this._lastQuickFixId = this._quickFixes[0].id;
        this._registerQuickFixDecoration();
        this._onDidUpdateQuickFixes.fire({ command, actions: this._quickFixes });
        this._quickFixes = undefined;
    }
    _disposeQuickFix(command, id) {
        this._telemetryService?.publicLog2('terminal/quick-fix', {
            quickFixId: id,
            ranQuickFix: this._didRun,
            terminalSessionId: this._sessionId
        });
        this._decoration.clear();
        this._decorationDisposables.clear();
        this._onDidUpdateQuickFixes.fire({ command, actions: this._quickFixes });
        this._quickFixes = undefined;
        this._lastQuickFixId = undefined;
        this._didRun = false;
    }
    /**
     * Registers a decoration with the quick fixes
     */
    _registerQuickFixDecoration() {
        if (!this._terminal) {
            return;
        }
        // Check if quick fix decorations are enabled
        const quickFixEnabled = this._configurationService.getValue("terminal.integrated.shellIntegration.quickFixEnabled" /* TerminalSettingId.ShellIntegrationQuickFixEnabled */);
        if (!quickFixEnabled) {
            return;
        }
        this._decoration.clear();
        this._decorationDisposables.clear();
        const quickFixes = this._quickFixes;
        if (!quickFixes || quickFixes.length === 0) {
            return;
        }
        const marker = this._terminal.registerMarker();
        if (!marker) {
            return;
        }
        const decoration = this._decoration.value = this._terminal.registerDecoration({ marker, width: 2, layer: 'top' });
        if (!decoration) {
            return;
        }
        const store = this._decorationDisposables.value = new DisposableStore();
        store.add(decoration.onRender(e => {
            const rect = e.getBoundingClientRect();
            const anchor = {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
            };
            if (e.classList.contains("quick-fix" /* QuickFixDecorationSelector.QuickFix */)) {
                if (this._currentRenderContext) {
                    this._currentRenderContext.anchor = anchor;
                }
                return;
            }
            e.classList.add(...quickFixClasses);
            const isExplainOnly = quickFixes.every(e => e.kind === 'explain');
            if (isExplainOnly) {
                e.classList.add('explainOnly');
            }
            e.classList.add(...ThemeIcon.asClassNameArray(isExplainOnly ? Codicon.sparkle : Codicon.lightBulb));
            updateLayout(this._configurationService, e);
            this._accessibilitySignalService.playSignal(AccessibilitySignal.terminalQuickFix);
            const parentElement = e.closest('.xterm')?.parentElement;
            if (!parentElement) {
                return;
            }
            this._currentRenderContext = { quickFixes, anchor, parentElement };
            this._register(dom.addDisposableListener(e, dom.EventType.CLICK, () => this.showMenu()));
        }));
        store.add(decoration.onDispose(() => this._currentRenderContext = undefined));
    }
};
TerminalQuickFixAddon = __decorate([
    __param(3, IAccessibilitySignalService),
    __param(4, IActionWidgetService),
    __param(5, ICommandService),
    __param(6, IConfigurationService),
    __param(7, IExtensionService),
    __param(8, ILabelService),
    __param(9, IOpenerService),
    __param(10, ITelemetryService),
    __param(11, ITerminalQuickFixService)
], TerminalQuickFixAddon);
export { TerminalQuickFixAddon };
export async function getQuickFixesForCommand(aliases, terminal, terminalCommand, quickFixOptions, commandService, openerService, labelService, onDidRequestRerunCommand, getResolvedFixes) {
    // Prevent duplicates by tracking added entries
    const commandQuickFixSet = new Set();
    const openQuickFixSet = new Set();
    const fixes = [];
    const newCommand = terminalCommand.command;
    for (const options of quickFixOptions.values()) {
        for (const option of options) {
            if ((option.commandExitResult === 'success' && terminalCommand.exitCode !== 0) || (option.commandExitResult === 'error' && terminalCommand.exitCode === 0)) {
                continue;
            }
            let quickFixes;
            if (option.type === 'resolved') {
                quickFixes = await option.getQuickFixes(terminalCommand, getLinesForCommand(terminal.buffer.active, terminalCommand, terminal.cols, option.outputMatcher), option, new CancellationTokenSource().token);
            }
            else if (option.type === 'unresolved') {
                if (!getResolvedFixes) {
                    throw new Error('No resolved fix provider');
                }
                quickFixes = await getResolvedFixes(option, option.outputMatcher ? getLinesForCommand(terminal.buffer.active, terminalCommand, terminal.cols, option.outputMatcher) : undefined);
            }
            else if (option.type === 'internal') {
                const commandLineMatch = newCommand.match(option.commandLineMatcher);
                if (!commandLineMatch) {
                    continue;
                }
                const outputMatcher = option.outputMatcher;
                let outputMatch;
                if (outputMatcher) {
                    outputMatch = terminalCommand.getOutputMatch(outputMatcher);
                }
                if (!outputMatch) {
                    continue;
                }
                const matchResult = { commandLineMatch, outputMatch, commandLine: terminalCommand.command };
                quickFixes = option.getQuickFixes(matchResult);
            }
            if (quickFixes) {
                for (const quickFix of asArray(quickFixes)) {
                    let action;
                    if (hasKey(quickFix, { type: true })) {
                        switch (quickFix.type) {
                            case TerminalQuickFixType.TerminalCommand: {
                                const fix = quickFix;
                                if (commandQuickFixSet.has(fix.terminalCommand)) {
                                    continue;
                                }
                                commandQuickFixSet.add(fix.terminalCommand);
                                const label = localize('quickFix.command', 'Run: {0}', fix.terminalCommand);
                                action = {
                                    type: TerminalQuickFixType.TerminalCommand,
                                    kind: option.kind,
                                    class: undefined,
                                    source: quickFix.source,
                                    id: quickFix.id,
                                    label,
                                    enabled: true,
                                    run: () => {
                                        onDidRequestRerunCommand?.fire({
                                            command: fix.terminalCommand,
                                            shouldExecute: fix.shouldExecute ?? true
                                        });
                                    },
                                    tooltip: label,
                                    command: fix.terminalCommand,
                                    shouldExecute: fix.shouldExecute
                                };
                                break;
                            }
                            case TerminalQuickFixType.Opener: {
                                const fix = quickFix;
                                if (!fix.uri) {
                                    return;
                                }
                                if (openQuickFixSet.has(fix.uri.toString())) {
                                    continue;
                                }
                                openQuickFixSet.add(fix.uri.toString());
                                const isUrl = (fix.uri.scheme === Schemas.http || fix.uri.scheme === Schemas.https);
                                const uriLabel = isUrl ? encodeURI(fix.uri.toString(true)) : labelService.getUriLabel(fix.uri);
                                const label = localize('quickFix.opener', 'Open: {0}', uriLabel);
                                action = {
                                    source: quickFix.source,
                                    id: quickFix.id,
                                    label,
                                    type: TerminalQuickFixType.Opener,
                                    kind: option.kind,
                                    class: undefined,
                                    enabled: true,
                                    run: () => openerService.open(fix.uri),
                                    tooltip: label,
                                    uri: fix.uri
                                };
                                break;
                            }
                            case TerminalQuickFixType.Port: {
                                const fix = quickFix;
                                action = {
                                    source: 'builtin',
                                    type: fix.type,
                                    kind: option.kind,
                                    id: fix.id,
                                    label: fix.label,
                                    class: fix.class,
                                    enabled: fix.enabled,
                                    run: () => {
                                        fix.run();
                                    },
                                    tooltip: fix.tooltip
                                };
                                break;
                            }
                            case TerminalQuickFixType.VscodeCommand: {
                                const fix = quickFix;
                                action = {
                                    source: quickFix.source,
                                    type: fix.type,
                                    kind: option.kind,
                                    id: fix.id,
                                    label: fix.title,
                                    class: undefined,
                                    enabled: true,
                                    run: () => commandService.executeCommand(fix.id),
                                    tooltip: fix.title
                                };
                                break;
                            }
                        }
                        if (action) {
                            fixes.push(action);
                        }
                    }
                }
            }
        }
    }
    return fixes.length > 0 ? fixes : undefined;
}
function convertToQuickFixOptions(selectorProvider) {
    return {
        id: selectorProvider.selector.id,
        type: 'resolved',
        commandLineMatcher: selectorProvider.selector.commandLineMatcher,
        outputMatcher: selectorProvider.selector.outputMatcher,
        commandExitResult: selectorProvider.selector.commandExitResult,
        kind: selectorProvider.selector.kind,
        getQuickFixes: selectorProvider.provider.provideTerminalQuickFixes
    };
}
class TerminalQuickFixItem {
    constructor(action, type, source, title, kind = 'fix') {
        this.action = action;
        this.type = type;
        this.source = source;
        this.title = title;
        this.kind = kind;
        this.disabled = false;
    }
}
function toActionWidgetItems(inputQuickFixes, showHeaders) {
    const menuItems = [];
    menuItems.push({
        kind: "header" /* ActionListItemKind.Header */,
        group: {
            kind: CodeActionKind.QuickFix,
            title: localize('codeAction.widget.id.quickfix', 'Quick Fix')
        }
    });
    for (const quickFix of showHeaders ? inputQuickFixes : inputQuickFixes.filter(i => !!i.action)) {
        if (!quickFix.disabled && quickFix.action) {
            menuItems.push({
                kind: "action" /* ActionListItemKind.Action */,
                item: quickFix,
                group: {
                    kind: CodeActionKind.QuickFix,
                    icon: getQuickFixIcon(quickFix),
                    title: quickFix.action.label
                },
                disabled: false,
                label: quickFix.title
            });
        }
    }
    return menuItems;
}
function getQuickFixIcon(quickFix) {
    if (quickFix.kind === 'explain') {
        return Codicon.sparkle;
    }
    switch (quickFix.type) {
        case TerminalQuickFixType.Opener:
            if (quickFix.action.uri) {
                const isUrl = (quickFix.action.uri.scheme === Schemas.http || quickFix.action.uri.scheme === Schemas.https);
                return isUrl ? Codicon.linkExternal : Codicon.goToFile;
            }
        case TerminalQuickFixType.TerminalCommand:
            return Codicon.run;
        case TerminalQuickFixType.Port:
            return Codicon.debugDisconnect;
        case TerminalQuickFixType.VscodeCommand:
            return Codicon.lightbulb;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVpY2tGaXhBZGRvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvcXVpY2tGaXgvYnJvd3Nlci9xdWlja0ZpeEFkZG9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxxQ0FBcUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxpQkFBaUIsRUFBb0IsTUFBTSx5Q0FBeUMsQ0FBQztBQUUzSCxPQUFPLEtBQUssR0FBRyxNQUFNLG9DQUFvQyxDQUFDO0FBRTFELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ2pGLE9BQU8sRUFBc0IsWUFBWSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFFdkcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDMUYsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDckYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDekYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLDJCQUEyQixFQUFFLE1BQU0sbUZBQW1GLENBQUM7QUFDckosT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sOERBQThELENBQUM7QUFFcEcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sb0ZBQW9GLENBQUM7QUFFeEgsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLCtDQUEr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