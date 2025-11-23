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
import { KeyChord } from '../../../../base/common/keyCodes.js';
import { ModesRegistry } from '../../../../editor/common/languages/modesRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { MenuId, registerAction2, Action2, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { OutputService } from './outputServices.js';
import { OUTPUT_MODE_ID, OUTPUT_MIME, OUTPUT_VIEW_ID, IOutputService, CONTEXT_IN_OUTPUT, LOG_MODE_ID, LOG_MIME, CONTEXT_OUTPUT_SCROLL_LOCK, ACTIVE_OUTPUT_CHANNEL_CONTEXT, CONTEXT_ACTIVE_OUTPUT_LEVEL_SETTABLE, Extensions, CONTEXT_ACTIVE_OUTPUT_LEVEL, CONTEXT_ACTIVE_OUTPUT_LEVEL_IS_DEFAULT, SHOW_INFO_FILTER_CONTEXT, SHOW_TRACE_FILTER_CONTEXT, SHOW_DEBUG_FILTER_CONTEXT, SHOW_ERROR_FILTER_CONTEXT, SHOW_WARNING_FILTER_CONTEXT, OUTPUT_FILTER_FOCUS_CONTEXT, CONTEXT_ACTIVE_LOG_FILE_OUTPUT, isSingleSourceOutputChannelDescriptor } from '../../../services/output/common/output.js';
import { OutputViewPane } from './outputView.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { Extensions as ViewContainerExtensions } from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { AUX_WINDOW_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Disposable, dispose, toDisposable } from '../../../../base/common/lifecycle.js';
import { AccessibilitySignal, IAccessibilitySignalService } from '../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { ILoggerService, LogLevel, LogLevelToLocalizedString, LogLevelToString } from '../../../../platform/log/common/log.js';
import { IDefaultLogLevelsService } from '../../logs/common/defaultLogLevels.js';
import { KeybindingsRegistry } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from '../../../../platform/accessibility/common/accessibility.js';
import { IsWindowsContext } from '../../../../platform/contextkey/common/contextkeys.js';
import { FocusedViewContext } from '../../../common/contextkeys.js';
import { localize, localize2 } from '../../../../nls.js';
import { viewFilterSubmenu } from '../../../browser/parts/views/viewFilter.js';
import { ViewAction } from '../../../browser/parts/views/viewPane.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { basename } from '../../../../base/common/resources.js';
import { hasKey } from '../../../../base/common/types.js';
const IMPORTED_LOG_ID_PREFIX = 'importedLog.';
// Register Service
registerSingleton(IOutputService, OutputService, 1 /* InstantiationType.Delayed */);
// Register Output Mode
ModesRegistry.registerLanguage({
    id: OUTPUT_MODE_ID,
    extensions: [],
    mimetypes: [OUTPUT_MIME]
});
// Register Log Output Mode
ModesRegistry.registerLanguage({
    id: LOG_MODE_ID,
    extensions: [],
    mimetypes: [LOG_MIME]
});
// register output container
const outputViewIcon = registerIcon('output-view-icon', Codicon.output, nls.localize('outputViewIcon', 'View icon of the output view.'));
const VIEW_CONTAINER = Registry.as(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
    id: OUTPUT_VIEW_ID,
    title: nls.localize2('output', "Output"),
    icon: outputViewIcon,
    order: 1,
    ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [OUTPUT_VIEW_ID, { mergeViewWithContainerWhenSingleView: true }]),
    storageId: OUTPUT_VIEW_ID,
    hideIfEmpty: true,
}, 1 /* ViewContainerLocation.Panel */, { doNotRegisterOpenCommand: true });
Registry.as(ViewContainerExtensions.ViewsRegistry).registerViews([{
        id: OUTPUT_VIEW_ID,
        name: nls.localize2('output', "Output"),
        containerIcon: outputViewIcon,
        canMoveView: true,
        canToggleVisibility: true,
        ctorDescriptor: new SyncDescriptor(OutputViewPane),
        openCommandActionDescriptor: {
            id: 'workbench.action.output.toggleOutput',
            mnemonicTitle: nls.localize({ key: 'miToggleOutput', comment: ['&& denotes a mnemonic'] }, "&&Output"),
            keybindings: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 51 /* KeyCode.KeyU */,
                linux: {
                    primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 2048 /* KeyMod.CtrlCmd */ | 38 /* KeyCode.KeyH */) // On Ubuntu Ctrl+Shift+U is taken by some global OS command
                }
            },
            order: 1,
        }
    }], VIEW_CONTAINER);
let OutputContribution = class OutputContribution extends Disposable {
    constructor(outputService, editorService) {
        super();
        this.outputService = outputService;
        this.editorService = editorService;
        this.registerActions();
    }
    registerActions() {
        this.registerSwitchOutputAction();
        this.registerAddCompoundLogAction();
        this.registerRemoveLogAction();
        this.registerShowOutputChannelsAction();
        this.registerClearOutputAction();
        this.registerToggleAutoScrollAction();
        this.registerOpenActiveOutputFileAction();
        this.registerOpenActiveOutputFileInAuxWindowAction();
        this.registerSaveActiveOutputAsAction();
        this.registerShowLogsAction();
        this.registerOpenLogFileAction();
        this.registerConfigureActiveOutputLogLevelAction();
        this.registerLogLevelFilterActions();
        this.registerClearFilterActions();
        this.registerExportLogsAction();
        this.registerImportLogAction();
    }
    registerSwitchOutputAction() {
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: `workbench.output.action.switchBetweenOutputs`,
                    title: nls.localize('switchBetweenOutputs.label', "Switch Output"),
                });
            }
            async run(accessor, channelId) {
                if (channelId) {
                    accessor.get(IOutputService).showChannel(channelId, true);
                }
            }
        }));
        const switchOutputMenu = new MenuId('workbench.output.menu.switchOutput');
        this._register(MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
            submenu: switchOutputMenu,
            title: nls.localize('switchToOutput.label', "Switch Output"),
            group: 'navigation',
            when: ContextKeyExpr.equals('view', OUTPUT_VIEW_ID),
            order: 1,
            isSelection: true
        }));
        const registeredChannels = new Map();
        this._register(toDisposable(() => dispose(registeredChannels.values())));
        const registerOutputChannels = (channels) => {
            for (const channel of channels) {
                const title = channel.label;
                const group = channel.user ? '2_user_outputchannels' : channel.extensionId ? '0_ext_outputchannels' : '1_core_outputchannels';
                registeredChannels.set(channel.id, registerAction2(class extends Action2 {
                    constructor() {
                        super({
                            id: `workbench.action.output.show.${channel.id}`,
                            title,
                            toggled: ACTIVE_OUTPUT_CHANNEL_CONTEXT.isEqualTo(channel.id),
                            menu: {
                                id: switchOutputMenu,
                                group,
                            }
                        });
                    }
                    async run(accessor) {
                        return accessor.get(IOutputService).showChannel(channel.id, true);
                    }
                }));
            }
        };
        registerOutputChannels(this.outputService.getChannelDescriptors());
        const outputChannelRegistry = Registry.as(Extensions.OutputChannels);
        this._register(outputChannelRegistry.onDidRegisterChannel(e => {
            const channel = this.outputService.getChannelDescriptor(e);
            if (channel) {
                registerOutputChannels([channel]);
            }
        }));
        this._register(outputChannelRegistry.onDidRemoveChannel(e => {
            registeredChannels.get(e.id)?.dispose();
            registeredChannels.delete(e.id);
        }));
    }
    registerAddCompoundLogAction() {
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.output.addCompoundLog',
                    title: nls.localize2('addCompoundLog', "Add Compound Log..."),
                    category: nls.localize2('output', "Output"),
                    f1: true,
                    menu: [{
                            id: MenuId.ViewTitle,
                            when: ContextKeyExpr.equals('view', OUTPUT_VIEW_ID),
                            group: '2_add',
                        }],
                });
            }
            async run(accessor) {
                const outputService = accessor.get(IOutputService);
                const quickInputService = accessor.get(IQuickInputService);
                const extensionLogs = [], logs = [];
                for (const channel of outputService.getChannelDescriptors()) {
                    if (channel.log && !channel.user) {
                        if (channel.extensionId) {
                            extensionLogs.push(channel);
                        }
                        else {
                            logs.push(channel);
                        }
                    }
                }
                const entries = [];
                for (const log of logs.sort((a, b) => a.label.localeCompare(b.label))) {
                    entries.push(log);
                }
                if (extensionLogs.length && logs.length) {
                    entries.push({ type: 'separator', label: nls.localize('extensionLogs', "Extension Logs") });
                }
                for (const log of extensionLogs.sort((a, b) => a.label.localeCompare(b.label))) {
                    entries.push(log);
                }
                const result = await quickInputService.pick(entries, { placeHolder: nls.localize('selectlog', "Select Log"), canPickMany: true });
                if (result?.length) {
                    outputService.showChannel(outputService.registerCompoundLogChannel(result));
                }
            }
        }));
    }
    registerRemoveLogAction() {
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.output.remove',
                    title: nls.localize2('removeLog', "Remove Output..."),
                    category: nls.localize2('output', "Output"),
                    f1: true
                });
            }
            async run(accessor) {
                const outputService = accessor.get(IOutputService);
                const quickInputService = accessor.get(IQuickInputService);
                const notificationService = accessor.get(INotificationService);
                const entries = outputService.getChannelDescriptors().filter(channel => channel.user);
                if (entries.length === 0) {
                    notificationService.info(nls.localize('nocustumoutput', "No custom outputs to remove."));
                    return;
                }
                const result = await quickInputService.pick(entries, { placeHolder: nls.localize('selectlog', "Select Log"), canPickMany: true });
                if (!result?.length) {
                    return;
                }
                const outputChannelRegistry = Registry.as(Extensions.OutputChannels);
                for (const channel of result) {
                    outputChannelRegistry.removeChannel(channel.id);
                }
            }
        }));
    }
    registerShowOutputChannelsAction() {
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.showOutputChannels',
                    title: nls.localize2('showOutputChannels', "Show Output Channels..."),
                    category: nls.localize2('output', "Output"),
                    f1: true
                });
            }
            async run(accessor) {
                const outputService = accessor.get(IOutputService);
                const quickInputService = accessor.get(IQuickInputService);
                const extensionChannels = [], coreChannels = [];
                for (const channel of outputService.getChannelDescriptors()) {
                    if (channel.extensionId) {
                        extensionChannels.push(channel);
                    }
                    else {
                        coreChannels.push(channel);
                    }
                }
                const entries = [];
                for (const { id, label } of extensionChannels) {
                    entries.push({ id, label });
                }
                if (extensionChannels.length && coreChannels.length) {
                    entries.push({ type: 'separator' });
                }
                for (const { id, label } of coreChannels) {
                    entries.push({ id, label });
                }
                const entry = await quickInputService.pick(entries, { placeHolder: nls.localize('selectOutput', "Select Output Channel") });
                if (entry) {
                    return outputService.showChannel(entry.id);
                }
            }
        }));
    }
    registerClearOutputAction() {
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: `workbench.output.action.clearOutput`,
                    title: nls.localize2('clearOutput.label', "Clear Output"),
                    category: Categories.View,
                    menu: [{
                            id: MenuId.ViewTitle,
                            when: ContextKeyExpr.equals('view', OUTPUT_VIEW_ID),
                            group: 'navigation',
                            order: 2
                        }, {
                            id: MenuId.CommandPalette
                        }, {
                            id: MenuId.EditorContext,
                            when: CONTEXT_IN_OUTPUT
                        }],
                    icon: Codicon.clearAll
                });
            }
            async run(accessor) {
                const outputService = accessor.get(IOutputService);
                const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
                const activeChannel = outputService.getActiveChannel();
                if (activeChannel) {
                    activeChannel.clear();
                    accessibilitySignalService.playSignal(AccessibilitySignal.clear);
                }
            }
        }));
    }
    registerToggleAutoScrollAction() {
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: `workbench.output.action.toggleAutoScroll`,
                    title: nls.localize2('toggleAutoScroll', "Toggle Auto Scrolling"),
                    tooltip: nls.localize('outputScrollOff', "Turn Auto Scrolling Off"),
                    menu: {
                        id: MenuId.ViewTitle,
                        when: ContextKeyExpr.and(ContextKeyExpr.equals('view', OUTPUT_VIEW_ID)),
                        group: 'navigation',
                        order: 3,
                    },
                    icon: Codicon.lock,
                    toggled: {
                        condition: CONTEXT_OUTPUT_SCROLL_LOCK,
                        icon: Codicon.unlock,
                        tooltip: nls.localize('outputScrollOn', "Turn Auto Scrolling On")
                    }
                });
            }
            async run(accessor) {
                const outputView = accessor.get(IViewsService).getActiveViewWithId(OUTPUT_VIEW_ID);
                outputView.scrollLock = !outputView.scrollLock;
            }
        }));
    }
    registerOpenActiveOutputFileAction() {
        const that = this;
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: `workbench.action.openActiveLogOutputFile`,
                    title: nls.localize2('openActiveOutputFile', "Open Output in Editor"),
                    menu: [{
                            id: MenuId.ViewTitle,
                            when: ContextKeyExpr.equals('view', OUTPUT_VIEW_ID),
                            group: 'navigation',
                            order: 4,
                            isHiddenByDefault: true
                        }],
                    icon: Codicon.goToFile,
                });
            }
            async run() {
                that.openActiveOutput();
            }
        }));
    }
    registerOpenActiveOutputFileInAuxWindowAction() {
        const that = this;
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: `workbench.action.openActiveLogOutputFileInNewWindow`,
                    title: nls.localize2('openActiveOutputFileInNewWindow', "Open Output in New Window"),
                    menu: [{
                            id: MenuId.ViewTitle,
                            when: ContextKeyExpr.equals('view', OUTPUT_VIEW_ID),
                            group: 'navigation',
                            order: 5,
                            isHiddenByDefault: true
                        }],
                    icon: Codicon.emptyWindow,
                });
            }
            async run() {
                that.openActiveOutput(AUX_WINDOW_GROUP);
            }
        }));
    }
    registerSaveActiveOutputAsAction() {
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: `workbench.action.saveActiveLogOutputAs`,
                    title: nls.localize2('saveActiveOutputAs', "Save Output As..."),
                    menu: [{
                            id: MenuId.ViewTitle,
                            when: ContextKeyExpr.equals('view', OUTPUT_VIEW_ID),
                            group: '1_export',
                            order: 1
                        }],
                });
            }
            async run(accessor) {
                const outputService = accessor.get(IOutputService);
                const channel = outputService.getActiveChannel();
                if (channel) {
                    const descriptor = outputService.getChannelDescriptors().find(c => c.id === channel.id);
                    if (descriptor) {
                        await outputService.saveOutputAs(undefined, descriptor);
                    }
                }
            }
        }));
    }
    async openActiveOutput(group) {
        const channel = this.outputService.getActiveChannel();
        if (channel) {
            await this.editorService.openEditor({
                resource: channel.uri,
                options: {
                    pinned: true,
                },
            }, group);
        }
    }
    registerConfigureActiveOutputLogLevelAction() {
        const logLevelMenu = new MenuId('workbench.output.menu.logLevel');
        this._register(MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
            submenu: logLevelMenu,
            title: nls.localize('logLevel.label', "Set Log Level..."),
            group: 'navigation',
            when: ContextKeyExpr.and(ContextKeyExpr.equals('view', OUTPUT_VIEW_ID), CONTEXT_ACTIVE_OUTPUT_LEVEL_SETTABLE),
            icon: Codicon.gear,
            order: 6
        }));
        let order = 0;
        const registerLogLevel = (logLevel) => {
            this._register(registerAction2(class extends Action2 {
                constructor() {
                    super({
                        id: `workbench.action.output.activeOutputLogLevel.${logLevel}`,
                        title: LogLevelToLocalizedString(logLevel).value,
                        toggled: CONTEXT_ACTIVE_OUTPUT_LEVEL.isEqualTo(LogLevelToString(logLevel)),
                        menu: {
                            id: logLevelMenu,
                            order: order++,
                            group: '0_level'
                        }
                    });
                }
                async run(accessor) {
                    const outputService = accessor.get(IOutputService);
                    const channel = outputService.getActiveChannel();
                    if (channel) {
                        const channelDescriptor = outputService.getChannelDescriptor(channel.id);
                        if (channelDescriptor) {
                            outputService.setLogLevel(channelDescriptor, logLevel);
                        }
                    }
                }
            }));
        };
        registerLogLevel(LogLevel.Trace);
        registerLogLevel(LogLevel.Debug);
        registerLogLevel(LogLevel.Info);
        registerLogLevel(LogLevel.Warning);
        registerLogLevel(LogLevel.Error);
        registerLogLevel(LogLevel.Off);
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: `workbench.action.output.activeOutputLogLevelDefault`,
                    title: nls.localize('logLevelDefault.label', "Set As Default"),
                    menu: {
                        id: logLevelMenu,
                        order,
                        group: '1_default'
                    },
                    precondition: CONTEXT_ACTIVE_OUTPUT_LEVEL_IS_DEFAULT.negate()
                });
            }
            async run(accessor) {
                const outputService = accessor.get(IOutputService);
                const loggerService = accessor.get(ILoggerService);
                const defaultLogLevelsService = accessor.get(IDefaultLogLevelsService);
                const channel = outputService.getActiveChannel();
                if (channel) {
                    const channelDescriptor = outputService.getChannelDescriptor(channel.id);
                    if (channelDescriptor && isSingleSourceOutputChannelDescriptor(channelDescriptor)) {
                        const logLevel = loggerService.getLogLevel(channelDescriptor.source.resource);
                        return await defaultLogLevelsService.setDefaultLogLevel(logLevel, channelDescriptor.extensionId);
                    }
                }
            }
        }));
    }
    registerShowLogsAction() {
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.showLogs',
                    title: nls.localize2('showLogs', "Show Logs..."),
                    category: Categories.Developer,
                    menu: {
                        id: MenuId.CommandPalette,
                    },
                });
            }
            async run(accessor) {
                const outputService = accessor.get(IOutputService);
                const quickInputService = accessor.get(IQuickInputService);
                const extensionLogs = [], logs = [];
                for (const channel of outputService.getChannelDescriptors()) {
                    if (channel.log) {
                        if (channel.extensionId) {
                            extensionLogs.push(channel);
                        }
                        else {
                            logs.push(channel);
                        }
                    }
                }
                const entries = [];
                for (const { id, label } of logs) {
                    entries.push({ id, label });
                }
                if (extensionLogs.length && logs.length) {
                    entries.push({ type: 'separator', label: nls.localize('extensionLogs', "Extension Logs") });
                }
                for (const { id, label } of extensionLogs) {
                    entries.push({ id, label });
                }
                const entry = await quickInputService.pick(entries, { placeHolder: nls.localize('selectlog', "Select Log") });
                if (entry) {
                    return outputService.showChannel(entry.id);
                }
            }
        }));
    }
    registerOpenLogFileAction() {
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: 'workbench.action.openLogFile',
                    title: nls.localize2('openLogFile', "Open Log..."),
                    category: Categories.Developer,
                    menu: {
                        id: MenuId.CommandPalette,
                    },
                    metadata: {
                        description: 'workbench.action.openLogFile',
                        args: [{
                                name: 'logFile',
                                schema: {
                                    markdownDescription: nls.localize('logFile', "The id of the log file to open, for example `\"window\"`. Currently the best way to get this is to get the ID by checking the `workbench.action.output.show.<id>` commands"),
                                    type: 'string'
                                }
                            }]
                    },
                });
            }
            async run(accessor, args) {
                const outputService = accessor.get(IOutputService);
                const quickInputService = accessor.get(IQuickInputService);
                const editorService = accessor.get(IEditorService);
                let entry;
                const argName = args && typeof args === 'string' ? args : undefined;
                const extensionChannels = [];
                const coreChannels = [];
                for (const c of outputService.getChannelDescriptors()) {
                    if (c.log) {
                        const e = { id: c.id, label: c.label };
                        if (c.extensionId) {
                            extensionChannels.push(e);
                        }
                        else {
                            coreChannels.push(e);
                        }
                        if (e.id === argName) {
                            entry = e;
                        }
                    }
                }
                if (!entry) {
                    const entries = [...extensionChannels.sort((a, b) => a.label.localeCompare(b.label))];
                    if (entries.length && coreChannels.length) {
                        entries.push({ type: 'separator' });
                        entries.push(...coreChannels.sort((a, b) => a.label.localeCompare(b.label)));
                    }
                    entry = await quickInputService.pick(entries, { placeHolder: nls.localize('selectlogFile', "Select Log File") });
                }
                if (entry?.id) {
                    const channel = outputService.getChannel(entry.id);
                    if (channel) {
                        await editorService.openEditor({
                            resource: channel.uri,
                            options: {
                                pinned: true,
                            }
                        });
                    }
                }
            }
        }));
    }
    registerLogLevelFilterActions() {
        let order = 0;
        const registerLogLevel = (logLevel, toggled) => {
            this._register(registerAction2(class extends ViewAction {
                constructor() {
                    super({
                        id: `workbench.actions.${OUTPUT_VIEW_ID}.toggle.${LogLevelToString(logLevel)}`,
                        title: LogLevelToLocalizedString(logLevel).value,
                        metadata: {
                            description: localize2('toggleTraceDescription', "Show or hide {0} messages in the output", LogLevelToString(logLevel))
                        },
                        toggled,
                        menu: {
                            id: viewFilterSubmenu,
                            group: '2_log_filter',
                            when: ContextKeyExpr.and(ContextKeyExpr.equals('view', OUTPUT_VIEW_ID), CONTEXT_ACTIVE_LOG_FILE_OUTPUT),
                            order: order++
                        },
                        viewId: OUTPUT_VIEW_ID
                    });
                }
                async runInView(serviceAccessor, view) {
                    this.toggleLogLevelFilter(serviceAccessor.get(IOutputService), logLevel);
                }
                toggleLogLevelFilter(outputService, logLevel) {
                    switch (logLevel) {
                        case LogLevel.Trace:
                            outputService.filters.trace = !outputService.filters.trace;
                            break;
                        case LogLevel.Debug:
                            outputService.filters.debug = !outputService.filters.debug;
                            break;
                        case LogLevel.Info:
                            outputService.filters.info = !outputService.filters.info;
                            break;
                        case LogLevel.Warning:
                            outputService.filters.warning = !outputService.filters.warning;
                            break;
                        case LogLevel.Error:
                            outputService.filters.error = !outputService.filters.error;
                            break;
                    }
                }
            }));
        };
        registerLogLevel(LogLevel.Trace, SHOW_TRACE_FILTER_CONTEXT);
        registerLogLevel(LogLevel.Debug, SHOW_DEBUG_FILTER_CONTEXT);
        registerLogLevel(LogLevel.Info, SHOW_INFO_FILTER_CONTEXT);
        registerLogLevel(LogLevel.Warning, SHOW_WARNING_FILTER_CONTEXT);
        registerLogLevel(LogLevel.Error, SHOW_ERROR_FILTER_CONTEXT);
    }
    registerClearFilterActions() {
        this._register(registerAction2(class extends ViewAction {
            constructor() {
                super({
                    id: `workbench.actions.${OUTPUT_VIEW_ID}.clearFilterText`,
                    title: localize('clearFiltersText', "Clear filters text"),
                    keybinding: {
                        when: OUTPUT_FILTER_FOCUS_CONTEXT,
                        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                        primary: 9 /* KeyCode.Escape */
                    },
                    viewId: OUTPUT_VIEW_ID
                });
            }
            async runInView(serviceAccessor, outputView) {
                outputView.clearFilterText();
            }
        }));
    }
    registerExportLogsAction() {
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: `workbench.action.exportLogs`,
                    title: nls.localize2('exportLogs', "Export Logs..."),
                    f1: true,
                    category: Categories.Developer,
                    menu: [{
                            id: MenuId.ViewTitle,
                            when: ContextKeyExpr.equals('view', OUTPUT_VIEW_ID),
                            group: '1_export',
                            order: 2,
                        }],
                });
            }
            async run(accessor, arg) {
                const outputService = accessor.get(IOutputService);
                const quickInputService = accessor.get(IQuickInputService);
                const extensionLogs = [], logs = [], userLogs = [];
                for (const channel of outputService.getChannelDescriptors()) {
                    if (channel.log) {
                        if (channel.extensionId) {
                            extensionLogs.push(channel);
                        }
                        else if (channel.user) {
                            userLogs.push(channel);
                        }
                        else {
                            logs.push(channel);
                        }
                    }
                }
                const entries = [];
                for (const log of logs.sort((a, b) => a.label.localeCompare(b.label))) {
                    entries.push(log);
                }
                if (extensionLogs.length && logs.length) {
                    entries.push({ type: 'separator', label: nls.localize('extensionLogs', "Extension Logs") });
                }
                for (const log of extensionLogs.sort((a, b) => a.label.localeCompare(b.label))) {
                    entries.push(log);
                }
                if (userLogs.length && (extensionLogs.length || logs.length)) {
                    entries.push({ type: 'separator', label: nls.localize('userLogs', "User Logs") });
                }
                for (const log of userLogs.sort((a, b) => a.label.localeCompare(b.label))) {
                    entries.push(log);
                }
                let selectedOutputChannels;
                if (arg?.outputChannelIds) {
                    const requestedIdsNormalized = arg.outputChannelIds.map(id => id.trim().toLowerCase());
                    const candidates = entries.filter((e) => {
                        const isSeparator = hasKey(e, { type: true }) && e.type === 'separator';
                        return !isSeparator;
                    });
                    if (requestedIdsNormalized.includes('*')) {
                        selectedOutputChannels = candidates;
                    }
                    else {
                        selectedOutputChannels = candidates.filter(candidate => requestedIdsNormalized.includes(candidate.id.toLowerCase()));
                    }
                }
                else {
                    selectedOutputChannels = await quickInputService.pick(entries, { placeHolder: nls.localize('selectlog', "Select Log"), canPickMany: true });
                }
                if (selectedOutputChannels?.length) {
                    await outputService.saveOutputAs(arg?.outputPath, ...selectedOutputChannels);
                }
            }
        }));
    }
    registerImportLogAction() {
        this._register(registerAction2(class extends Action2 {
            constructor() {
                super({
                    id: `workbench.action.importLog`,
                    title: nls.localize2('importLog', "Import Log..."),
                    f1: true,
                    category: Categories.Developer,
                    menu: [{
                            id: MenuId.ViewTitle,
                            when: ContextKeyExpr.equals('view', OUTPUT_VIEW_ID),
                            group: '2_add',
                            order: 2,
                        }],
                });
            }
            async run(accessor) {
                const outputService = accessor.get(IOutputService);
                const fileDialogService = accessor.get(IFileDialogService);
                const result = await fileDialogService.showOpenDialog({
                    title: nls.localize('importLogFile', "Import Log File"),
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: true,
                    filters: [{
                            name: nls.localize('logFiles', "Log Files"),
                            extensions: ['log']
                        }]
                });
                if (result?.length) {
                    const channelName = basename(result[0]);
                    const channelId = `${IMPORTED_LOG_ID_PREFIX}${Date.now()}`;
                    // Register and show the channel
                    Registry.as(Extensions.OutputChannels).registerChannel({
                        id: channelId,
                        label: channelName,
                        log: true,
                        user: true,
                        source: result.length === 1
                            ? { resource: result[0] }
                            : result.map(resource => ({ resource, name: basename(resource).split('.')[0] }))
                    });
                    outputService.showChannel(channelId);
                }
            }
        }));
    }
};
OutputContribution = __decorate([
    __param(0, IOutputService),
    __param(1, IEditorService)
], OutputContribution);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(OutputContribution, 3 /* LifecyclePhase.Restored */);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
    id: 'output',
    order: 30,
    title: nls.localize('output', "Output"),
    type: 'object',
    properties: {
        'output.smartScroll.enabled': {
            type: 'boolean',
            description: nls.localize('output.smartScroll.enabled', "Enable/disable the ability of smart scrolling in the output view. Smart scrolling allows you to lock scrolling automatically when you click in the output view and unlocks when you click in the last line."),
            default: true,
            scope: 4 /* ConfigurationScope.WINDOW */,
            tags: ['output']
        }
    }
});
KeybindingsRegistry.registerKeybindingRule({
    id: 'cursorWordAccessibilityLeft',
    when: ContextKeyExpr.and(EditorContextKeys.textInputFocus, CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext, ContextKeyExpr.equals(FocusedViewContext.key, OUTPUT_VIEW_ID)),
    primary: 2048 /* KeyMod.CtrlCmd */ | 15 /* KeyCode.LeftArrow */,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */
});
KeybindingsRegistry.registerKeybindingRule({
    id: 'cursorWordAccessibilityLeftSelect',
    when: ContextKeyExpr.and(EditorContextKeys.textInputFocus, CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext, ContextKeyExpr.equals(FocusedViewContext.key, OUTPUT_VIEW_ID)),
    primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 15 /* KeyCode.LeftArrow */,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */
});
KeybindingsRegistry.registerKeybindingRule({
    id: 'cursorWordAccessibilityRight',
    when: ContextKeyExpr.and(EditorContextKeys.textInputFocus, CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext, ContextKeyExpr.equals(FocusedViewContext.key, OUTPUT_VIEW_ID)),
    primary: 2048 /* KeyMod.CtrlCmd */ | 17 /* KeyCode.RightArrow */,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */
});
KeybindingsRegistry.registerKeybindingRule({
    id: 'cursorWordAccessibilityRightSelect',
    when: ContextKeyExpr.and(EditorContextKeys.textInputFocus, CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext, ContextKeyExpr.equals(FocusedViewContext.key, OUTPUT_VIEW_ID)),
    primary: 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 17 /* KeyCode.RightArrow */,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0LmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9vdXRwdXQvYnJvd3Nlci9vdXRwdXQuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFDMUMsT0FBTyxFQUFVLFFBQVEsRUFBVyxNQUFNLHFDQUFxQyxDQUFDO0FBQ2hGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNyRixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDNUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2hILE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUMvRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDcEQsT0FBTyxFQUFFLGNBQWMsRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUFFLGNBQWMsRUFBRSxpQkFBaUIsRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLDBCQUEwQixFQUE0Qiw2QkFBNkIsRUFBRSxvQ0FBb0MsRUFBMEIsVUFBVSxFQUFFLDJCQUEyQixFQUFFLHNDQUFzQyxFQUFFLHdCQUF3QixFQUFFLHlCQUF5QixFQUFFLHlCQUF5QixFQUFFLHlCQUF5QixFQUFFLDJCQUEyQixFQUFFLDJCQUEyQixFQUFFLDhCQUE4QixFQUFFLHFDQUFxQyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDbG5CLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUNqRCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMERBQTBELENBQUM7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