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
import './standaloneCodeEditorService.js';
import './standaloneLayoutService.js';
import '../../../platform/undoRedo/common/undoRedoService.js';
import '../../common/services/languageFeatureDebounce.js';
import '../../common/services/semanticTokensStylingService.js';
import '../../common/services/languageFeaturesService.js';
import '../../../platform/hover/browser/hoverService.js';
import '../../browser/services/inlineCompletionsService.js';
import * as strings from '../../../base/common/strings.js';
import * as dom from '../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../base/browser/keyboardEvent.js';
import { Emitter, Event, ValueWithChangeEvent } from '../../../base/common/event.js';
import { KeyCodeChord, decodeKeybinding } from '../../../base/common/keybindings.js';
import { ImmortalReference, toDisposable, DisposableStore, Disposable, combinedDisposable } from '../../../base/common/lifecycle.js';
import { OS, isLinux, isMacintosh } from '../../../base/common/platform.js';
import Severity from '../../../base/common/severity.js';
import { URI } from '../../../base/common/uri.js';
import { IBulkEditService, ResourceEdit, ResourceTextEdit } from '../../browser/services/bulkEditService.js';
import { isDiffEditorConfigurationKey, isEditorConfigurationKey } from '../../common/config/editorConfigurationSchema.js';
import { EditOperation } from '../../common/core/editOperation.js';
import { Position as Pos } from '../../common/core/position.js';
import { Range } from '../../common/core/range.js';
import { IModelService } from '../../common/services/model.js';
import { ITextModelService } from '../../common/services/resolverService.js';
import { ITextResourceConfigurationService, ITextResourcePropertiesService } from '../../common/services/textResourceConfiguration.js';
import { CommandsRegistry, ICommandService } from '../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { Configuration, ConfigurationModel, ConfigurationChangeEvent } from '../../../platform/configuration/common/configurationModels.js';
import { IContextKeyService } from '../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../platform/dialogs/common/dialogs.js';
import { createDecorator, IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { AbstractKeybindingService } from '../../../platform/keybinding/common/abstractKeybindingService.js';
import { IKeybindingService } from '../../../platform/keybinding/common/keybinding.js';
import { KeybindingResolver } from '../../../platform/keybinding/common/keybindingResolver.js';
import { KeybindingsRegistry } from '../../../platform/keybinding/common/keybindingsRegistry.js';
import { ResolvedKeybindingItem } from '../../../platform/keybinding/common/resolvedKeybindingItem.js';
import { USLayoutResolvedKeybinding } from '../../../platform/keybinding/common/usLayoutResolvedKeybinding.js';
import { ILabelService } from '../../../platform/label/common/label.js';
import { INotificationService, NoOpNotification, NotificationsFilter } from '../../../platform/notification/common/notification.js';
import { IEditorProgressService, IProgressService } from '../../../platform/progress/common/progress.js';
import { ITelemetryService } from '../../../platform/telemetry/common/telemetry.js';
import { IWorkspaceContextService, WorkspaceFolder, STANDALONE_EDITOR_WORKSPACE_ID } from '../../../platform/workspace/common/workspace.js';
import { ILayoutService } from '../../../platform/layout/browser/layoutService.js';
import { StandaloneServicesNLS } from '../../common/standaloneStrings.js';
import { basename } from '../../../base/common/resources.js';
import { ICodeEditorService } from '../../browser/services/codeEditorService.js';
import { ConsoleLogger, ILoggerService, ILogService, NullLoggerService } from '../../../platform/log/common/log.js';
import { IWorkspaceTrustManagementService } from '../../../platform/workspace/common/workspaceTrust.js';
import { IContextMenuService, IContextViewService } from '../../../platform/contextview/browser/contextView.js';
import { ContextViewService } from '../../../platform/contextview/browser/contextViewService.js';
import { LanguageService } from '../../common/services/languageService.js';
import { ContextMenuService } from '../../../platform/contextview/browser/contextMenuService.js';
import { getSingletonServiceDescriptors, registerSingleton } from '../../../platform/instantiation/common/extensions.js';
import { OpenerService } from '../../browser/services/openerService.js';
import { ILanguageService } from '../../common/languages/language.js';
import { MarkerDecorationsService } from '../../common/services/markerDecorationsService.js';
import { IMarkerDecorationsService } from '../../common/services/markerDecorations.js';
import { ModelService } from '../../common/services/modelService.js';
import { StandaloneQuickInputService } from './quickInput/standaloneQuickInputService.js';
import { StandaloneThemeService } from './standaloneThemeService.js';
import { IStandaloneThemeService } from '../common/standaloneTheme.js';
import { AccessibilityService } from '../../../platform/accessibility/browser/accessibilityService.js';
import { IAccessibilityService } from '../../../platform/accessibility/common/accessibility.js';
import { IMenuService } from '../../../platform/actions/common/actions.js';
import { MenuService } from '../../../platform/actions/common/menuService.js';
import { BrowserClipboardService } from '../../../platform/clipboard/browser/clipboardService.js';
import { IClipboardService } from '../../../platform/clipboard/common/clipboardService.js';
import { ContextKeyService } from '../../../platform/contextkey/browser/contextKeyService.js';
import { SyncDescriptor } from '../../../platform/instantiation/common/descriptors.js';
import { InstantiationService } from '../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../platform/instantiation/common/serviceCollection.js';
import { IListService, ListService } from '../../../platform/list/browser/listService.js';
import { IMarkerService } from '../../../platform/markers/common/markers.js';
import { MarkerService } from '../../../platform/markers/common/markerService.js';
import { IOpenerService } from '../../../platform/opener/common/opener.js';
import { IQuickInputService } from '../../../platform/quickinput/common/quickInput.js';
import { IStorageService, InMemoryStorageService } from '../../../platform/storage/common/storage.js';
import { DefaultConfiguration } from '../../../platform/configuration/common/configurations.js';
import { IAccessibilitySignalService } from '../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { LogService } from '../../../platform/log/common/logService.js';
import { getEditorFeatures } from '../../common/editorFeatures.js';
import { onUnexpectedError } from '../../../base/common/errors.js';
import { IEnvironmentService } from '../../../platform/environment/common/environment.js';
import { mainWindow } from '../../../base/browser/window.js';
import { ResourceMap } from '../../../base/common/map.js';
import { ITreeSitterLibraryService } from '../../common/services/treeSitter/treeSitterLibraryService.js';
import { StandaloneTreeSitterLibraryService } from './standaloneTreeSitterLibraryService.js';
import { IDataChannelService, NullDataChannelService } from '../../../platform/dataChannel/common/dataChannel.js';
import { IWebWorkerService } from '../../../platform/webWorker/browser/webWorkerService.js';
import { StandaloneWebWorkerService } from './services/standaloneWebWorkerService.js';
class SimpleModel {
    constructor(model) {
        this.disposed = false;
        this.model = model;
        this._onWillDispose = new Emitter();
    }
    get onWillDispose() {
        return this._onWillDispose.event;
    }
    resolve() {
        return Promise.resolve();
    }
    get textEditorModel() {
        return this.model;
    }
    createSnapshot() {
        return this.model.createSnapshot();
    }
    isReadonly() {
        return false;
    }
    dispose() {
        this.disposed = true;
        this._onWillDispose.fire();
    }
    isDisposed() {
        return this.disposed;
    }
    isResolved() {
        return true;
    }
    getLanguageId() {
        return this.model.getLanguageId();
    }
}
let StandaloneTextModelService = class StandaloneTextModelService {
    constructor(modelService) {
        this.modelService = modelService;
    }
    createModelReference(resource) {
        const model = this.modelService.getModel(resource);
        if (!model) {
            return Promise.reject(new Error(`Model not found`));
        }
        return Promise.resolve(new ImmortalReference(new SimpleModel(model)));
    }
    registerTextModelContentProvider(scheme, provider) {
        return {
            dispose: function () { }
        };
    }
    canHandleResource(resource) {
        return false;
    }
};
StandaloneTextModelService = __decorate([
    __param(0, IModelService)
], StandaloneTextModelService);
class StandaloneEditorProgressService {
    static { this.NULL_PROGRESS_RUNNER = {
        done: () => { },
        total: () => { },
        worked: () => { }
    }; }
    show() {
        return StandaloneEditorProgressService.NULL_PROGRESS_RUNNER;
    }
    async showWhile(promise, delay) {
        await promise;
    }
}
class StandaloneProgressService {
    withProgress(_options, task, onDidCancel) {
        return task({
            report: () => { },
        });
    }
}
class StandaloneEnvironmentService {
    constructor() {
        this.stateResource = URI.from({ scheme: 'monaco', authority: 'stateResource' });
        this.userRoamingDataHome = URI.from({ scheme: 'monaco', authority: 'userRoamingDataHome' });
        this.keyboardLayoutResource = URI.from({ scheme: 'monaco', authority: 'keyboardLayoutResource' });
        this.argvResource = URI.from({ scheme: 'monaco', authority: 'argvResource' });
        this.untitledWorkspacesHome = URI.from({ scheme: 'monaco', authority: 'untitledWorkspacesHome' });
        this.workspaceStorageHome = URI.from({ scheme: 'monaco', authority: 'workspaceStorageHome' });
        this.localHistoryHome = URI.from({ scheme: 'monaco', authority: 'localHistoryHome' });
        this.cacheHome = URI.from({ scheme: 'monaco', authority: 'cacheHome' });
        this.userDataSyncHome = URI.from({ scheme: 'monaco', authority: 'userDataSyncHome' });
        this.sync = undefined;
        this.continueOn = undefined;
        this.editSessionId = undefined;
        this.debugExtensionHost = { port: null, break: false };
        this.isExtensionDevelopment = false;
        this.disableExtensions = false;
        this.disableExperiments = false;
        this.enableExtensions = undefined;
        this.extensionDevelopmentLocationURI = undefined;
        this.extensionDevelopmentKind = undefined;
        this.extensionTestsLocationURI = undefined;
        this.logsHome = URI.from({ scheme: 'monaco', authority: 'logsHome' });
        this.logLevel = undefined;
        this.extensionLogLevel = undefined;
        this.verbose = false;
        this.isBuilt = false;
        this.disableTelemetry = false;
        this.serviceMachineIdResource = URI.from({ scheme: 'monaco', authority: 'serviceMachineIdResource' });
        this.policyFile = undefined;
    }
}
class StandaloneDialogService {
    constructor() {
        this.onWillShowDialog = Event.None;
        this.onDidShowDialog = Event.None;
    }
    async confirm(confirmation) {
        const confirmed = this.doConfirm(confirmation.message, confirmation.detail);
        return {
            confirmed,
            checkboxChecked: false // unsupported
        };
    }
    doConfirm(message, detail) {
        let messageText = message;
        if (detail) {
            messageText = messageText + '\n\n' + detail;
        }
        return mainWindow.confirm(messageText);
    }
    async prompt(prompt) {
        let result = undefined;
        const confirmed = this.doConfirm(prompt.message, prompt.detail);
        if (confirmed) {
            const promptButtons = [...(prompt.buttons ?? [])];
            if (prompt.cancelButton && typeof prompt.cancelButton !== 'string' && typeof prompt.cancelButton !== 'boolean') {
                promptButtons.push(prompt.cancelButton);
            }
            result = await promptButtons[0]?.run({ checkboxChecked: false });
        }
        return { result };
    }
    async info(message, detail) {
        await this.prompt({ type: Severity.Info, message, detail });
    }
    async warn(message, detail) {
        await this.prompt({ type: Severity.Warning, message, detail });
    }
    async error(message, detail) {
        await this.prompt({ type: Severity.Error, message, detail });
    }
    input() {
        return Promise.resolve({ confirmed: false }); // unsupported
    }
    about() {
        return Promise.resolve(undefined);
    }
}
export class StandaloneNotificationService {
    constructor() {
        this.onDidChangeFilter = Event.None;
    }
    static { this.NO_OP = new NoOpNotification(); }
    info(message) {
        return this.notify({ severity: Severity.Info, message });
    }
    warn(message) {
        return this.notify({ severity: Severity.Warning, message });
    }
    error(error) {
        return this.notify({ severity: Severity.Error, message: error });
    }
    notify(notification) {
        switch (notification.severity) {
            case Severity.Error:
                console.error(notification.message);
                break;
            case Severity.Warning:
                console.warn(notification.message);
                break;
            default:
                console.log(notification.message);
                break;
        }
        return StandaloneNotificationService.NO_OP;
    }
    prompt(severity, message, choices, options) {
        return StandaloneNotificationService.NO_OP;
    }
    status(message, options) {
        return { close: () => { } };
    }
    setFilter(filter) { }
    getFilter(source) {
        return NotificationsFilter.OFF;
    }
    getFilters() {
        return [];
    }
    removeFilter(sourceId) { }
}
let StandaloneCommandService = class StandaloneCommandService {
    constructor(instantiationService) {
        this._onWillExecuteCommand = new Emitter();
        this._onDidExecuteCommand = new Emitter();
        this.onWillExecuteCommand = this._onWillExecuteCommand.event;
        this.onDidExecuteCommand = this._onDidExecuteCommand.event;
        this._instantiationService = instantiationService;
    }
    executeCommand(id, ...args) {
        const command = CommandsRegistry.getCommand(id);
        if (!command) {
            return Promise.reject(new Error(`command '${id}' not found`));
        }
        try {
            this._onWillExecuteCommand.fire({ commandId: id, args });
            const result = this._instantiationService.invokeFunction.apply(this._instantiationService, [command.handler, ...args]);
            this._onDidExecuteCommand.fire({ commandId: id, args });
            return Promise.resolve(result);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
};
StandaloneCommandService = __decorate([
    __param(0, IInstantiationService)
], StandaloneCommandService);
export { StandaloneCommandService };
let StandaloneKeybindingService = class StandaloneKeybindingService extends AbstractKeybindingService {
    constructor(contextKeyService, commandService, telemetryService, notificationService, logService, codeEditorService) {
        super(contextKeyService, commandService, telemetryService, notificationService, logService);
        this._cachedResolver = null;
        this._dynamicKeybindings = [];
        this._domNodeListeners = [];
        const addContainer = (domNode) => {
            const disposables = new DisposableStore();
            // for standard keybindings
            disposables.add(dom.addDisposableListener(domNode, dom.EventType.KEY_DOWN, (e) => {
                const keyEvent = new StandardKeyboardEvent(e);
                const shouldPreventDefault = this._dispatch(keyEvent, keyEvent.target);
                if (shouldPreventDefault) {
                    keyEvent.preventDefault();
                    keyEvent.stopPropagation();
                }
            }));
            // for single modifier chord keybindings (e.g. shift shift)
            disposables.add(dom.addDisposableListener(domNode, dom.EventType.KEY_UP, (e) => {
                const keyEvent = new StandardKeyboardEvent(e);
                const shouldPreventDefault = this._singleModifierDispatch(keyEvent, keyEvent.target);
                if (shouldPreventDefault) {
                    keyEvent.preventDefault();
                }
            }));
            this._domNodeListeners.push(new DomNodeListeners(domNode, disposables));
        };
        const removeContainer = (domNode) => {
            for (let i = 0; i < this._domNodeListeners.length; i++) {
                const domNodeListeners = this._domNodeListeners[i];
                if (domNodeListeners.domNode === domNode) {
                    this._domNodeListeners.splice(i, 1);
                    domNodeListeners.dispose();
                }
            }
        };
        const addCodeEditor = (codeEditor) => {
            if (codeEditor.getOption(70 /* EditorOption.inDiffEditor */)) {
                return;
            }
            addContainer(codeEditor.getContainerDomNode());
        };
        const removeCodeEditor = (codeEditor) => {
            if (codeEditor.getOption(70 /* EditorOption.inDiffEditor */)) {
                return;
            }
            removeContainer(codeEditor.getContainerDomNode());
        };
        this._register(codeEditorService.onCodeEditorAdd(addCodeEditor));
        this._register(codeEditorService.onCodeEditorRemove(removeCodeEditor));
        codeEditorService.listCodeEditors().forEach(addCodeEditor);
        const addDiffEditor = (diffEditor) => {
            addContainer(diffEditor.getContainerDomNode());
        };
        const removeDiffEditor = (diffEditor) => {
            removeContainer(diffEditor.getContainerDomNode());
        };
        this._register(codeEditorService.onDiffEditorAdd(addDiffEditor));
        this._register(codeEditorService.onDiffEditorRemove(removeDiffEditor));
        codeEditorService.listDiffEditors().forEach(addDiffEditor);
    }
    addDynamicKeybinding(command, keybinding, handler, when) {
        return combinedDisposable(CommandsRegistry.registerCommand(command, handler), this.addDynamicKeybindings([{
                keybinding,
                command,
                when
            }]));
    }
    addDynamicKeybindings(rules) {
        const entries = rules.map((rule) => {
            const keybinding = decodeKeybinding(rule.keybinding, OS);
            return {
                keybinding,
                command: rule.command ?? null,
                commandArgs: rule.commandArgs,
                when: rule.when,
                weight1: 1000,
                weight2: 0,
                extensionId: null,
                isBuiltinExtension: false
            };
        });
        this._dynamicKeybindings = this._dynamicKeybindings.concat(entries);
        this.updateResolver();
        return toDisposable(() => {
            // Search the first entry and remove them all since they will be contiguous
            for (let i = 0; i < this._dynamicKeybindings.length; i++) {
                if (this._dynamicKeybindings[i] === entries[0]) {
                    this._dynamicKeybindings.splice(i, entries.length);
                    this.updateResolver();
                    return;
                }
            }
        });
    }
    updateResolver() {
        this._cachedResolver = null;
        this._onDidUpdateKeybindings.fire();
    }
    _getResolver() {
        if (!this._cachedResolver) {
            const defaults = this._toNormalizedKeybindingItems(KeybindingsRegistry.getDefaultKeybindings(), true);
            const overrides = this._toNormalizedKeybindingItems(this._dynamicKeybindings, false);
            this._cachedResolver = new KeybindingResolver(defaults, overrides, (str) => this._log(str));
        }
        return this._cachedResolver;
    }
    _documentHasFocus() {
        return mainWindow.document.hasFocus();
    }
    _toNormalizedKeybindingItems(items, isDefault) {
        const result = [];
        let resultLen = 0;
        for (const item of items) {
            const when = item.when || undefined;
            const keybinding = item.keybinding;
            if (!keybinding) {
                // This might be a removal keybinding item in user settings => accept it
                result[resultLen++] = new ResolvedKeybindingItem(undefined, item.command, item.commandArgs, when, isDefault, null, false);
            }
            else {
                const resolvedKeybindings = USLayoutResolvedKeybinding.resolveKeybinding(keybinding, OS);
                for (const resolvedKeybinding of resolvedKeybindings) {
                    result[resultLen++] = new ResolvedKeybindingItem(resolvedKeybinding, item.command, item.commandArgs, when, isDefault, null, false);
                }
            }
        }
        return result;
    }
    resolveKeybinding(keybinding) {
        return USLayoutResolvedKeybinding.resolveKeybinding(keybinding, OS);
    }
    resolveKeyboardEvent(keyboardEvent) {
        const chord = new KeyCodeChord(keyboardEvent.ctrlKey, keyboardEvent.shiftKey, keyboardEvent.altKey, keyboardEvent.metaKey, keyboardEvent.keyCode);
        return new USLayoutResolvedKeybinding([chord], OS);
    }
    resolveUserBinding(userBinding) {
        return [];
    }
    _dumpDebugInfo() {
        return '';
    }
    _dumpDebugInfoJSON() {
        return '';
    }
    registerSchemaContribution(contribution) {
        return Disposable.None;
    }
    /**
     * not yet supported
     */
    enableKeybindingHoldMode(commandId) {
        return undefined;
    }
};
StandaloneKeybindingService = __decorate([
    __param(0, IContextKeyService),
    __param(1, ICommandService),
    __param(2, ITelemetryService),
    __param(3, INotificationService),
    __param(4, ILogService),
    __param(5, ICodeEditorService)
], StandaloneKeybindingService);
export { StandaloneKeybindingService };
class DomNodeListeners extends Disposable {
    constructor(domNode, disposables) {
        super();
        this.domNode = domNode;
        this._register(disposables);
    }
}
function isConfigurationOverrides(thing) {
    return !!thing
        && typeof thing === 'object'
        && (!thing.overrideIdentifier || typeof thing.overrideIdentifier === 'string')
        && (!thing.resource || thing.resource instanceof URI);
}
let StandaloneConfigurationService = class StandaloneConfigurationService {
    constructor(logService) {
        this.logService = logService;
        this._onDidChangeConfiguration = new Emitter();
        this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
        const defaultConfiguration = new DefaultConfiguration(logService);
        this._configuration = new Configuration(defaultConfiguration.reload(), ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), new ResourceMap(), ConfigurationModel.createEmptyModel(logService), new ResourceMap(), logService);
        defaultConfiguration.dispose();
    }
    getValue(arg1, arg2) {
        const section = typeof arg1 === 'string' ? arg1 : undefined;
        const overrides = isConfigurationOverrides(arg1) ? arg1 : isConfigurationOverrides(arg2) ? arg2 : {};
        return this._configuration.getValue(section, overrides, undefined);
    }
    updateValues(values) {
        const previous = { data: this._configuration.toData() };
        const changedKeys = [];
        for (const entry of values) {
            const [key, value] = entry;
            if (this.getValue(key) === value) {
                continue;
            }
            this._configuration.updateValue(key, value);
            changedKeys.push(key);
        }
        if (changedKeys.length > 0) {
            const configurationChangeEvent = new ConfigurationChangeEvent({ keys: changedKeys, overrides: [] }, previous, this._configuration, undefined, this.logService);
            configurationChangeEvent.source = 8 /* ConfigurationTarget.MEMORY */;
            this._onDidChangeConfiguration.fire(configurationChangeEvent);
        }
        return Promise.resolve();
    }
    updateValue(key, value, arg3, arg4) {
        return this.updateValues([[key, value]]);
    }
    inspect(key, options = {}) {
        return this._configuration.inspect(key, options, undefined);
    }
    keys() {
        return this._configuration.keys(undefined);
    }
    reloadConfiguration() {
        return Promise.resolve(undefined);
    }
    getConfigurationData() {
        const emptyModel = {
            contents: {},
            keys: [],
            overrides: []
        };
        return {
            defaults: emptyModel,
            policy: emptyModel,
            application: emptyModel,
            userLocal: emptyModel,
            userRemote: emptyModel,
            workspace: emptyModel,
            folders: []
        };
    }
};
StandaloneConfigurationService = __decorate([
    __param(0, ILogService)
], StandaloneConfigurationService);
export { StandaloneConfigurationService };
let StandaloneResourceConfigurationService = class StandaloneResourceConfigurationService {
    constructor(configurationService, modelService, languageService) {
        this.configurationService = configurationService;
        this.modelService = modelService;
        this.languageService = languageService;
        this._onDidChangeConfiguration = new Emitter();
        this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
        this.configurationService.onDidChangeConfiguration((e) => {
            this._onDidChangeConfiguration.fire({ affectedKeys: e.affectedKeys, affectsConfiguration: (resource, configuration) => e.affectsConfiguration(configuration) });
        });
    }
    getValue(resource, arg2, arg3) {
        const position = Pos.isIPosition(arg2) ? arg2 : null;
        const section = position ? (typeof arg3 === 'string' ? arg3 : undefined) : (typeof arg2 === 'string' ? arg2 : undefined);
        const language = resource ? this.getLanguage(resource, position) : undefined;
        if (typeof section === 'undefined') {
            return this.configurationService.getValue({
                resource,
                overrideIdentifier: language
            });
        }
        return this.configurationService.getValue(section, {
            resource,
            overrideIdentifier: language
        });
    }
    inspect(resource, position, section) {
        const language = resource ? this.getLanguage(resource, position) : undefined;
        return this.configurationService.inspect(section, { resource, overrideIdentifier: language });
    }
    getLanguage(resource, position) {
        const model = this.modelService.getModel(resource);
        if (model) {
            return position ? model.getLanguageIdAtPosition(position.lineNumber, position.column) : model.getLanguageId();
        }
        return this.languageService.guessLanguageIdByFilepathOrFirstLine(resource);
    }
    updateValue(resource, key, value, configurationTarget) {
        return this.configurationService.updateValue(key, value, { resource }, configurationTarget);
    }
};
StandaloneResourceConfigurationService = __decorate([
    __param(0, IConfigurationService),
    __param(1, IModelService),
    __param(2, ILanguageService)
], StandaloneResourceConfigurationService);
let StandaloneResourcePropertiesService = class StandaloneResourcePropertiesService {
    constructor(configurationService) {
        this.configurationService = configurationService;
    }
    getEOL(resource, language) {
        const eol = this.configurationService.getValue('files.eol', { overrideIdentifier: language, resource });
        if (eol && typeof eol === 'string' && eol !== 'auto') {
            return eol;
        }
        return (isLinux || isMacintosh) ? '\n' : '\r\n';
    }
};
StandaloneResourcePropertiesService = __decorate([
    __param(0, IConfigurationService)
], StandaloneResourcePropertiesService);
class StandaloneTelemetryService {
    constructor() {
        this.telemetryLevel = 0 /* TelemetryLevel.NONE */;
        this.sessionId = 'someValue.sessionId';
        this.machineId = 'someValue.machineId';
        this.sqmId = 'someValue.sqmId';
        this.devDeviceId = 'someValue.devDeviceId';
        this.firstSessionDate = 'someValue.firstSessionDate';
        this.sendErrorTelemetry = false;
    }
    setEnabled() { }
    setExperimentProperty() { }
    publicLog() { }
    publicLog2() { }
    publicLogError() { }
    publicLogError2() { }
}
class StandaloneWorkspaceContextService {
    static { this.SCHEME = 'inmemory'; }
    constructor() {
        this._onDidChangeWorkspaceName = new Emitter();
        this.onDidChangeWorkspaceName = this._onDidChangeWorkspaceName.event;
        this._onWillChangeWorkspaceFolders = new Emitter();
        this.onWillChangeWorkspaceFolders = this._onWillChangeWorkspaceFolders.event;
        this._onDidChangeWorkspaceFolders = new Emitter();
        this.onDidChangeWorkspaceFolders = this._onDidChangeWorkspaceFolders.event;
        this._onDidChangeWorkbenchState = new Emitter();
        this.onDidChangeWorkbenchState = this._onDidChangeWorkbenchState.event;
        const resource = URI.from({ scheme: StandaloneWorkspaceContextService.SCHEME, authority: 'model', path: '/' });
        this.workspace = { id: STANDALONE_EDITOR_WORKSPACE_ID, folders: [new WorkspaceFolder({ uri: resource, name: '', index: 0 })] };
    }
    getCompleteWorkspace() {
        return Promise.resolve(this.getWorkspace());
    }
    getWorkspace() {
        return this.workspace;
    }
    getWorkbenchState() {
        if (this.workspace) {
            if (this.workspace.configuration) {
                return 3 /* WorkbenchState.WORKSPACE */;
            }
            return 2 /* WorkbenchState.FOLDER */;
        }
        return 1 /* WorkbenchState.EMPTY */;
    }
    getWorkspaceFolder(resource) {
        return resource && resource.scheme === StandaloneWorkspaceContextService.SCHEME ? this.workspace.folders[0] : null;
    }
    isInsideWorkspace(resource) {
        return resource && resource.scheme === StandaloneWorkspaceContextService.SCHEME;
    }
    isCurrentWorkspace(workspaceIdOrFolder) {
        return true;
    }
}
export function updateConfigurationService(configurationService, source, isDiffEditor) {
    if (!source) {
        return;
    }
    if (!(configurationService instanceof StandaloneConfigurationService)) {
        return;
    }
    const toUpdate = [];
    Object.keys(source).forEach((key) => {
        if (isEditorConfigurationKey(key)) {
            toUpdate.push([`editor.${key}`, source[key]]);
        }
        if (isDiffEditor && isDiffEditorConfigurationKey(key)) {
            toUpdate.push([`diffEditor.${key}`, source[key]]);
        }
    });
    if (toUpdate.length > 0) {
        configurationService.updateValues(toUpdate);
    }
}
let StandaloneBulkEditService = class StandaloneBulkEditService {
    constructor(_modelService) {
        this._modelService = _modelService;
        //
    }
    hasPreviewHandler() {
        return false;
    }
    setPreviewHandler() {
        return Disposable.None;
    }
    async apply(editsIn, _options) {
        const edits = Array.isArray(editsIn) ? editsIn : ResourceEdit.convert(editsIn);
        const textEdits = new Map();
        for (const edit of edits) {
            if (!(edit instanceof ResourceTextEdit)) {
                throw new Error('bad edit - only text edits are supported');
            }
            const model = this._modelService.getModel(edit.resource);
            if (!model) {
                throw new Error('bad edit - model not found');
            }
            if (typeof edit.versionId === 'number' && model.getVersionId() !== edit.versionId) {
                throw new Error('bad state - model changed in the meantime');
            }
            let array = textEdits.get(model);
            if (!array) {
                array = [];
                textEdits.set(model, array);
            }
            array.push(EditOperation.replaceMove(Range.lift(edit.textEdit.range), edit.textEdit.text));
        }
        let totalEdits = 0;
        let totalFiles = 0;
        for (const [model, edits] of textEdits) {
            model.pushStackElement();
            model.pushEditOperations([], edits, () => []);
            model.pushStackElement();
            totalFiles += 1;
            totalEdits += edits.length;
        }
        return {
            ariaSummary: strings.format(StandaloneServicesNLS.bulkEditServiceSummary, totalEdits, totalFiles),
            isApplied: totalEdits > 0
        };
    }
};
StandaloneBulkEditService = __decorate([
    __param(0, IModelService)
], StandaloneBulkEditService);
class StandaloneUriLabelService {
    constructor() {
        this.onDidChangeFormatters = Event.None;
    }
    getUriLabel(resource, options) {
        if (resource.scheme === 'file') {
            return resource.fsPath;
        }
        return resource.path;
    }
    getUriBasenameLabel(resource) {
        return basename(resource);
    }
    getWorkspaceLabel(workspace, options) {
        return '';
    }
    getSeparator(scheme, authority) {
        return '/';
    }
    registerFormatter(formatter) {
        throw new Error('Not implemented');
    }
    registerCachedFormatter(formatter) {
        return this.registerFormatter(formatter);
    }
    getHostLabel() {
        return '';
    }
    getHostTooltip() {
        return undefined;
    }
}
let StandaloneContextViewService = class StandaloneContextViewService extends ContextViewService {
    constructor(layoutService, _codeEditorService) {
        super(layoutService);
        this._codeEditorService = _codeEditorService;
    }
    showContextView(delegate, container, shadowRoot) {
        if (!container) {
            const codeEditor = this._codeEditorService.getFocusedCodeEditor() || this._codeEditorService.getActiveCodeEditor();
            if (codeEditor) {
                container = codeEditor.getContainerDomNode();
            }
        }
        return super.showContextView(delegate, container, shadowRoot);
    }
};
StandaloneContextViewService = __decorate([
    __param(0, ILayoutService),
    __param(1, ICodeEditorService)
], StandaloneContextViewService);
class StandaloneWorkspaceTrustManagementService {
    constructor() {
        this._neverEmitter = new Emitter();
        this.onDidChangeTrust = this._neverEmitter.event;
        this.onDidChangeTrustedFolders = this._neverEmitter.event;
        this.workspaceResolved = Promise.resolve();
        this.workspaceTrustInitialized = Promise.resolve();
        this.acceptsOutOfWorkspaceFiles = true;
    }
    isWorkspaceTrusted() {
        return true;
    }
    isWorkspaceTrustForced() {
        return false;
    }
    canSetParentFolderTrust() {
        return false;
    }
    async setParentFolderTrust(trusted) {
        // noop
    }
    canSetWorkspaceTrust() {
        return false;
    }
    async setWorkspaceTrust(trusted) {
        // noop
    }
    getUriTrustInfo(uri) {
        throw new Error('Method not supported.');
    }
    async setUrisTrust(uri, trusted) {
        // noop
    }
    getTrustedUris() {
        return [];
    }
    async setTrustedUris(uris) {
        // noop
    }
    addWorkspaceTrustTransitionParticipant(participant) {
        throw new Error('Method not supported.');
    }
}
class StandaloneLanguageService extends LanguageService {
    constructor() {
        super();
    }
}
class StandaloneLogService extends LogService {
    constructor() {
        super(new ConsoleLogger());
    }
}
let StandaloneContextMenuService = class StandaloneContextMenuService extends ContextMenuService {
    constructor(telemetryService, notificationService, contextViewService, keybindingService, menuService, contextKeyService) {
        super(telemetryService, notificationService, contextViewService, keybindingService, menuService, contextKeyService);
        this.configure({ blockMouse: false }); // we do not want that in the standalone editor
    }
};
StandaloneContextMenuService = __decorate([
    __param(0, ITelemetryService),
    __param(1, INotificationService),
    __param(2, IContextViewService),
    __param(3, IKeybindingService),
    __param(4, IMenuService),
    __param(5, IContextKeyService)
], StandaloneContextMenuService);
class StandaloneAccessbilitySignalService {
    async playSignal(cue, options) {
    }
    async playSignals(cues) {
    }
    getEnabledState(signal, userGesture, modality) {
        return ValueWithChangeEvent.const(false);
    }
    getDelayMs(signal, modality) {
        return 0;
    }
    isSoundEnabled(cue) {
        return false;
    }
    isAnnouncementEnabled(cue) {
        return false;
    }
    onSoundEnabledChanged(cue) {
        return Event.None;
    }
    async playSound(cue, allowManyInParallel) {
    }
    playSignalLoop(cue) {
        return toDisposable(() => { });
    }
}
registerSingleton(IWebWorkerService, StandaloneWebWorkerService, 0 /* InstantiationType.Eager */);
registerSingleton(ILogService, StandaloneLogService, 0 /* InstantiationType.Eager */);
registerSingleton(IConfigurationService, StandaloneConfigurationService, 0 /* InstantiationType.Eager */);
registerSingleton(ITextResourceConfigurationService, StandaloneResourceConfigurationService, 0 /* InstantiationType.Eager */);
registerSingleton(ITextResourcePropertiesService, StandaloneResourcePropertiesService, 0 /* InstantiationType.Eager */);
registerSingleton(IWorkspaceContextService, StandaloneWorkspaceContextService, 0 /* InstantiationType.Eager */);
registerSingleton(ILabelService, StandaloneUriLabelService, 0 /* InstantiationType.Eager */);
registerSingleton(ITelemetryService, StandaloneTelemetryService, 0 /* InstantiationType.Eager */);
registerSingleton(IDialogService, StandaloneDialogService, 0 /* InstantiationType.Eager */);
registerSingleton(IEnvironmentService, StandaloneEnvironmentService, 0 /* InstantiationType.Eager */);
registerSingleton(INotificationService, StandaloneNotificationService, 0 /* InstantiationType.Eager */);
registerSingleton(IMarkerService, MarkerService, 0 /* InstantiationType.Eager */);
registerSingleton(ILanguageService, StandaloneLanguageService, 0 /* InstantiationType.Eager */);
registerSingleton(IStandaloneThemeService, StandaloneThemeService, 0 /* InstantiationType.Eager */);
registerSingleton(IModelService, ModelService, 0 /* InstantiationType.Eager */);
registerSingleton(IMarkerDecorationsService, MarkerDecorationsService, 0 /* InstantiationType.Eager */);
registerSingleton(IContextKeyService, ContextKeyService, 0 /* InstantiationType.Eager */);
registerSingleton(IProgressService, StandaloneProgressService, 0 /* InstantiationType.Eager */);
registerSingleton(IEditorProgressService, StandaloneEditorProgressService, 0 /* InstantiationType.Eager */);
registerSingleton(IStorageService, InMemoryStorageService, 0 /* InstantiationType.Eager */);
registerSingleton(IBulkEditService, StandaloneBulkEditService, 0 /* InstantiationType.Eager */);
registerSingleton(IWorkspaceTrustManagementService, StandaloneWorkspaceTrustManagementService, 0 /* InstantiationType.Eager */);
registerSingleton(ITextModelService, StandaloneTextModelService, 0 /* InstantiationType.Eager */);
registerSingleton(IAccessibilityService, AccessibilityService, 0 /* InstantiationType.Eager */);
registerSingleton(IListService, ListService, 0 /* InstantiationType.Eager */);
registerSingleton(ICommandService, StandaloneCommandService, 0 /* InstantiationType.Eager */);
registerSingleton(IKeybindingService, StandaloneKeybindingService, 0 /* InstantiationType.Eager */);
registerSingleton(IQuickInputService, StandaloneQuickInputService, 0 /* InstantiationType.Eager */);
registerSingleton(IContextViewService, StandaloneContextViewService, 0 /* InstantiationType.Eager */);
registerSingleton(IOpenerService, OpenerService, 0 /* InstantiationType.Eager */);
registerSingleton(IClipboardService, BrowserClipboardService, 0 /* InstantiationType.Eager */);
registerSingleton(IContextMenuService, StandaloneContextMenuService, 0 /* InstantiationType.Eager */);
registerSingleton(IMenuService, MenuService, 0 /* InstantiationType.Eager */);
registerSingleton(IAccessibilitySignalService, StandaloneAccessbilitySignalService, 0 /* InstantiationType.Eager */);
registerSingleton(ITreeSitterLibraryService, StandaloneTreeSitterLibraryService, 0 /* InstantiationType.Eager */);
registerSingleton(ILoggerService, NullLoggerService, 0 /* InstantiationType.Eager */);
registerSingleton(IDataChannelService, NullDataChannelService, 0 /* InstantiationType.Eager */);
/**
 * We don't want to eagerly instantiate services because embedders get a one time chance
 * to override services when they create the first editor.
 */
export var StandaloneServices;
(function (StandaloneServices) {
    const serviceCollection = new ServiceCollection();
    for (const [id, descriptor] of getSingletonServiceDescriptors()) {
        serviceCollection.set(id, descriptor);
    }
    const instantiationService = new InstantiationService(serviceCollection, true);
    serviceCollection.set(IInstantiationService, instantiationService);
    function get(serviceId) {
        if (!initialized) {
            initialize({});
        }
        const r = serviceCollection.get(serviceId);
        if (!r) {
            throw new Error('Missing service ' + serviceId);
        }
        if (r instanceof SyncDescriptor) {
            return instantiationService.invokeFunction((accessor) => accessor.get(serviceId));
        }
        else {
            return r;
        }
    }
    StandaloneServices.get = get;
    let initialized = false;
    const onDidInitialize = new Emitter();
    function initialize(overrides) {
        if (initialized) {
            return instantiationService;
        }
        initialized = true;
        // Add singletons that were registered after this module loaded
        for (const [id, descriptor] of getSingletonServiceDescriptors()) {
            if (!serviceCollection.get(id)) {
                serviceCollection.set(id, descriptor);
            }
        }
        // Initialize the service collection with the overrides, but only if the
        // service was not instantiated in the meantime.
        for (const serviceId in overrides) {
            if (overrides.hasOwnProperty(serviceId)) {
                const serviceIdentifier = createDecorator(serviceId);
                const r = serviceCollection.get(serviceIdentifier);
                if (r instanceof SyncDescriptor) {
                    serviceCollection.set(serviceIdentifier, overrides[serviceId]);
                }
            }
        }
        // Instantiate all editor features
        const editorFeatures = getEditorFeatures();
        for (const feature of editorFeatures) {
            try {
                instantiationService.createInstance(feature);
            }
            catch (err) {
                onUnexpectedError(err);
            }
        }
        onDidInitialize.fire();
        return instantiationService;
    }
    StandaloneServices.initialize = initialize;
    /**
     * Executes callback once services are initialized.
     */
    function withServices(callback) {
        if (initialized) {
            return callback();
        }
        const disposable = new DisposableStore();
        const listener = disposable.add(onDidInitialize.event(() => {
            listener.dispose();
            disposable.add(callback());
        }));
        return disposable;
    }
    StandaloneServices.withServices = withServices;
})(StandaloneServices || (StandaloneServices = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhbG9uZVNlcnZpY2VzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9zdGFuZGFsb25lL2Jyb3dzZXIvc3RhbmRhbG9uZVNlcnZpY2VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sa0NBQWtDLENBQUM7QUFDMUMsT0FBTyw4QkFBOEIsQ0FBQztBQUN0QyxPQUFPLHNEQUFzRCxDQUFDO0FBQzlELE9BQU8sa0RBQWtELENBQUM7QUFDMUQsT0FBTyx1REFBdUQsQ0FBQztBQUMvRCxPQUFPLGtEQUFrRCxDQUFDO0FBQzFELE9BQU8saURBQWlELENBQUM7QUFDekQsT0FBTyxvREFBb0QsQ0FBQztBQUU1RCxPQUFPLEtBQUssT0FBTyxNQUFNLGlDQUFpQyxDQUFDO0FBQzNELE9BQU8sS0FBSyxHQUFHLE1BQU0sOEJBQThCLENBQUM7QUFDcEQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDL0UsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQXlCLG9CQUFvQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDNUcsT0FBTyxFQUFzQixZQUFZLEVBQWMsZ0JBQWdCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNySCxPQUFPLEVBQTJCLGlCQUFpQixFQUFFLFlBQVksRUFBRSxlQUFlLEVBQUUsVUFBVSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUosT0FBTyxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDNUUsT0FBTyxRQUFRLE1BQU0sa0NBQWtDLENBQUM7QUFDeEQsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ2xELE9BQU8sRUFBcUMsZ0JBQWdCLEVBQUUsWUFBWSxFQUFFLGdCQUFn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