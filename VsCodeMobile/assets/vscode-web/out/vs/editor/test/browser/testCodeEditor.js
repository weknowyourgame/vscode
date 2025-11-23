/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { mock } from '../../../base/test/common/mock.js';
import { ICodeEditorService } from '../../browser/services/codeEditorService.js';
import { CodeEditorWidget } from '../../browser/widget/codeEditor/codeEditorWidget.js';
import { ILanguageService } from '../../common/languages/language.js';
import { ILanguageConfigurationService } from '../../common/languages/languageConfigurationRegistry.js';
import { IEditorWorkerService } from '../../common/services/editorWorker.js';
import { ILanguageFeatureDebounceService, LanguageFeatureDebounceService } from '../../common/services/languageFeatureDebounce.js';
import { ILanguageFeaturesService } from '../../common/services/languageFeatures.js';
import { LanguageFeaturesService } from '../../common/services/languageFeaturesService.js';
import { LanguageService } from '../../common/services/languageService.js';
import { IModelService } from '../../common/services/model.js';
import { ModelService } from '../../common/services/modelService.js';
import { ITextResourcePropertiesService } from '../../common/services/textResourceConfiguration.js';
import { TestConfiguration } from './config/testConfiguration.js';
import { TestCodeEditorService, TestCommandService } from './editorTestServices.js';
import { TestLanguageConfigurationService } from '../common/modes/testLanguageConfigurationService.js';
import { TestEditorWorkerService } from '../common/services/testEditorWorkerService.js';
import { TestTextResourcePropertiesService } from '../common/services/testTextResourcePropertiesService.js';
import { instantiateTextModel } from '../common/testTextModel.js';
import { IAccessibilityService } from '../../../platform/accessibility/common/accessibility.js';
import { TestAccessibilityService } from '../../../platform/accessibility/test/common/testAccessibilityService.js';
import { IClipboardService } from '../../../platform/clipboard/common/clipboardService.js';
import { TestClipboardService } from '../../../platform/clipboard/test/common/testClipboardService.js';
import { ICommandService } from '../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../platform/configuration/test/common/testConfigurationService.js';
import { IContextKeyService } from '../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../platform/dialogs/common/dialogs.js';
import { TestDialogService } from '../../../platform/dialogs/test/common/testDialogService.js';
import { IEnvironmentService } from '../../../platform/environment/common/environment.js';
import { SyncDescriptor } from '../../../platform/instantiation/common/descriptors.js';
import { ServiceCollection } from '../../../platform/instantiation/common/serviceCollection.js';
import { TestInstantiationService } from '../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IKeybindingService } from '../../../platform/keybinding/common/keybinding.js';
import { MockContextKeyService, MockKeybindingService } from '../../../platform/keybinding/test/common/mockKeybindingService.js';
import { ILoggerService, ILogService, NullLoggerService, NullLogService } from '../../../platform/log/common/log.js';
import { INotificationService } from '../../../platform/notification/common/notification.js';
import { TestNotificationService } from '../../../platform/notification/test/common/testNotificationService.js';
import { IOpenerService } from '../../../platform/opener/common/opener.js';
import { NullOpenerService } from '../../../platform/opener/test/common/nullOpenerService.js';
import { ITelemetryService } from '../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryServiceShape } from '../../../platform/telemetry/common/telemetryUtils.js';
import { IThemeService } from '../../../platform/theme/common/themeService.js';
import { TestThemeService } from '../../../platform/theme/test/common/testThemeService.js';
import { IUndoRedoService } from '../../../platform/undoRedo/common/undoRedo.js';
import { UndoRedoService } from '../../../platform/undoRedo/common/undoRedoService.js';
import { ITreeSitterLibraryService } from '../../common/services/treeSitter/treeSitterLibraryService.js';
import { TestTreeSitterLibraryService } from '../common/services/testTreeSitterLibraryService.js';
import { IInlineCompletionsService, InlineCompletionsService } from '../../browser/services/inlineCompletionsService.js';
import { IDataChannelService, NullDataChannelService } from '../../../platform/dataChannel/common/dataChannel.js';
export class TestCodeEditor extends CodeEditorWidget {
    constructor() {
        super(...arguments);
        this._hasTextFocus = false;
    }
    //#region testing overrides
    _createConfiguration(isSimpleWidget, contextMenuId, options) {
        return new TestConfiguration(options);
    }
    _createView(viewModel) {
        // Never create a view
        return [null, false];
    }
    setHasTextFocus(hasTextFocus) {
        this._hasTextFocus = hasTextFocus;
    }
    hasTextFocus() {
        return this._hasTextFocus;
    }
    //#endregion
    //#region Testing utils
    getViewModel() {
        return this._modelData ? this._modelData.viewModel : undefined;
    }
    registerAndInstantiateContribution(id, ctor) {
        const r = this._instantiationService.createInstance(ctor, this);
        this._contributions.set(id, r);
        return r;
    }
    registerDisposable(disposable) {
        this._register(disposable);
    }
    runCommand(command, args) {
        return this._instantiationService.invokeFunction((accessor) => {
            return command.runEditorCommand(accessor, this, args);
        });
    }
    runAction(action, args) {
        return this._instantiationService.invokeFunction((accessor) => {
            return action.run(accessor, this, args);
        });
    }
}
class TestEditorDomElement {
    constructor() {
        this.parentElement = null;
        this.ownerDocument = document;
        this.document = document;
    }
    setAttribute(attr, value) { }
    removeAttribute(attr) { }
    hasAttribute(attr) { return false; }
    getAttribute(attr) { return undefined; }
    addEventListener(event) { }
    removeEventListener(event) { }
}
export function withTestCodeEditor(text, options, callback) {
    return _withTestCodeEditor(text, options, callback);
}
export async function withAsyncTestCodeEditor(text, options, callback) {
    return _withTestCodeEditor(text, options, callback);
}
function isTextModel(arg) {
    return Boolean(arg && arg.uri);
}
function _withTestCodeEditor(arg, options, callback) {
    const disposables = new DisposableStore();
    const instantiationService = createCodeEditorServices(disposables, options.serviceCollection);
    delete options.serviceCollection;
    // create a model if necessary
    let model;
    if (isTextModel(arg)) {
        model = arg;
    }
    else {
        model = disposables.add(instantiateTextModel(instantiationService, Array.isArray(arg) ? arg.join('\n') : arg));
    }
    const editor = disposables.add(instantiateTestCodeEditor(instantiationService, model, options));
    const viewModel = editor.getViewModel();
    viewModel.setHasFocus(true);
    const result = callback(editor, editor.getViewModel(), instantiationService);
    if (result) {
        return result.then(() => disposables.dispose());
    }
    disposables.dispose();
}
export function createCodeEditorServices(disposables, services = new ServiceCollection()) {
    const serviceIdentifiers = [];
    const define = (id, ctor) => {
        if (!services.has(id)) {
            services.set(id, new SyncDescriptor(ctor));
        }
        serviceIdentifiers.push(id);
    };
    const defineInstance = (id, instance) => {
        if (!services.has(id)) {
            services.set(id, instance);
        }
        serviceIdentifiers.push(id);
    };
    define(IAccessibilityService, TestAccessibilityService);
    define(IKeybindingService, MockKeybindingService);
    define(IClipboardService, TestClipboardService);
    define(IEditorWorkerService, TestEditorWorkerService);
    defineInstance(IOpenerService, NullOpenerService);
    define(INotificationService, TestNotificationService);
    define(IDialogService, TestDialogService);
    define(IUndoRedoService, UndoRedoService);
    define(ILanguageService, LanguageService);
    define(ILanguageConfigurationService, TestLanguageConfigurationService);
    define(IConfigurationService, TestConfigurationService);
    define(ITextResourcePropertiesService, TestTextResourcePropertiesService);
    define(IThemeService, TestThemeService);
    define(ILogService, NullLogService);
    define(IModelService, ModelService);
    define(ICodeEditorService, TestCodeEditorService);
    define(IContextKeyService, MockContextKeyService);
    define(ICommandService, TestCommandService);
    define(ITelemetryService, NullTelemetryServiceShape);
    define(ILoggerService, NullLoggerService);
    define(IDataChannelService, NullDataChannelService);
    define(IEnvironmentService, class extends mock() {
        constructor() {
            super(...arguments);
            this.isBuilt = true;
            this.isExtensionDevelopment = false;
        }
    });
    define(ILanguageFeatureDebounceService, LanguageFeatureDebounceService);
    define(ILanguageFeaturesService, LanguageFeaturesService);
    define(ITreeSitterLibraryService, TestTreeSitterLibraryService);
    define(IInlineCompletionsService, InlineCompletionsService);
    const instantiationService = disposables.add(new TestInstantiationService(services, true));
    disposables.add(toDisposable(() => {
        for (const id of serviceIdentifiers) {
            const instanceOrDescriptor = services.get(id);
            if (typeof instanceOrDescriptor.dispose === 'function') {
                instanceOrDescriptor.dispose();
            }
        }
    }));
    return instantiationService;
}
export function createTestCodeEditor(model, options = {}) {
    const disposables = new DisposableStore();
    const instantiationService = createCodeEditorServices(disposables, options.serviceCollection);
    delete options.serviceCollection;
    const editor = instantiateTestCodeEditor(instantiationService, model || null, options);
    editor.registerDisposable(disposables);
    return editor;
}
export function instantiateTestCodeEditor(instantiationService, model, options = {}) {
    const codeEditorWidgetOptions = {
        contributions: []
    };
    const editor = instantiationService.createInstance(TestCodeEditor, 
    // eslint-disable-next-line local/code-no-any-casts
    new TestEditorDomElement(), options, codeEditorWidgetOptions);
    if (typeof options.hasTextFocus === 'undefined') {
        options.hasTextFocus = true;
    }
    editor.setHasTextFocus(options.hasTextFocus);
    editor.setModel(model);
    const viewModel = editor.getViewModel();
    viewModel?.setHasFocus(options.hasTextFocus);
    return editor;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdENvZGVFZGl0b3IuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL3Rlc3QvYnJvd3Nlci90ZXN0Q29kZUVkaXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsZUFBZSxFQUFlLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQy9GLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUd6RCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUVqRixPQUFPLEVBQUUsZ0JBQWdCLEVBQTRCLE1BQU0scURBQXFELENBQUM7QUFHakgsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDdEUsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0seURBQXlELENBQUM7QUFFeEcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDN0UsT0FBTyxFQUFFLCtCQUErQixFQUFFLDhCQUE4QixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDbkksT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDckYsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDM0YsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDckUsT0FBTyxFQUFFLDhCQUE4QixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFFcEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDbEUsT0FBTyxFQUFFLHFCQUFxQixFQUFFLGtCQUFr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