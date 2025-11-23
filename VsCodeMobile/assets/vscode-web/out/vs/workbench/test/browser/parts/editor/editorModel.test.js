/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { BaseTextEditorModel } from '../../../../common/editor/textEditorModel.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { LanguageService } from '../../../../../editor/common/services/languageService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ModelService } from '../../../../../editor/common/services/modelService.js';
import { createTextBufferFactory } from '../../../../../editor/common/model/textModel.js';
import { ITextResourcePropertiesService } from '../../../../../editor/common/services/textResourceConfiguration.js';
import { IUndoRedoService } from '../../../../../platform/undoRedo/common/undoRedo.js';
import { UndoRedoService } from '../../../../../platform/undoRedo/common/undoRedoService.js';
import { TestDialogService } from '../../../../../platform/dialogs/test/common/testDialogService.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { TestNotificationService } from '../../../../../platform/notification/test/common/testNotificationService.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { TestStorageService, TestTextResourcePropertiesService } from '../../../common/workbenchTestServices.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { TestThemeService } from '../../../../../platform/theme/test/common/testThemeService.js';
import { EditorModel } from '../../../../common/editor/editorModel.js';
import { Mimes } from '../../../../../base/common/mime.js';
import { LanguageDetectionService } from '../../../../services/languageDetection/browser/languageDetectionWorkerServiceImpl.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { TestEditorService, TestEnvironmentService } from '../../workbenchTestServices.js';
import { TestLanguageConfigurationService } from '../../../../../editor/test/common/modes/testLanguageConfigurationService.js';
import { ILanguageConfigurationService } from '../../../../../editor/common/languages/languageConfigurationRegistry.js';
import { TestAccessibilityService } from '../../../../../platform/accessibility/test/common/testAccessibilityService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ITreeSitterLibraryService } from '../../../../../editor/common/services/treeSitter/treeSitterLibraryService.js';
import { TestTreeSitterLibraryService } from '../../../../../editor/test/common/services/testTreeSitterLibraryService.js';
suite('EditorModel', () => {
    class MyEditorModel extends EditorModel {
    }
    class MyTextEditorModel extends BaseTextEditorModel {
        testCreateTextEditorModel(value, resource, preferredLanguageId) {
            return super.createTextEditorModel(value, resource, preferredLanguageId);
        }
        isReadonly() {
            return false;
        }
    }
    function stubModelService(instantiationService) {
        const dialogService = new TestDialogService();
        const notificationService = new TestNotificationService();
        const undoRedoService = new UndoRedoService(dialogService, notificationService);
        instantiationService.stub(IWorkbenchEnvironmentService, TestEnvironmentService);
        instantiationService.stub(IConfigurationService, new TestConfigurationService());
        instantiationService.stub(ITextResourcePropertiesService, new TestTextResourcePropertiesService(instantiationService.get(IConfigurationService)));
        instantiationService.stub(IDialogService, dialogService);
        instantiationService.stub(INotificationService, notificationService);
        instantiationService.stub(IUndoRedoService, undoRedoService);
        instantiationService.stub(IEditorService, disposables.add(new TestEditorService()));
        instantiationService.stub(IThemeService, new TestThemeService());
        instantiationService.stub(ILanguageConfigurationService, disposables.add(new TestLanguageConfigurationService()));
        instantiationService.stub(IStorageService, disposables.add(new TestStorageService()));
        instantiationService.stub(ITreeSitterLibraryService, new TestTreeSitterLibraryService());
        return disposables.add(instantiationService.createInstance(ModelService));
    }
    let instantiationService;
    let languageService;
    const disposables = new DisposableStore();
    setup(() => {
        instantiationService = disposables.add(new TestInstantiationService());
        languageService = instantiationService.stub(ILanguageService, LanguageService);
    });
    teardown(() => {
        disposables.clear();
    });
    test('basics', async () => {
        let counter = 0;
        const model = disposables.add(new MyEditorModel());
        disposables.add(model.onWillDispose(() => {
            assert(true);
            counter++;
        }));
        await model.resolve();
        assert.strictEqual(model.isDisposed(), false);
        assert.strictEqual(model.isResolved(), true);
        model.dispose();
        assert.strictEqual(counter, 1);
        assert.strictEqual(model.isDisposed(), true);
    });
    test('BaseTextEditorModel', async () => {
        const modelService = stubModelService(instantiationService);
        const model = disposables.add(new MyTextEditorModel(modelService, languageService, disposables.add(instantiationService.createInstance(LanguageDetectionService)), instantiationService.createInstance(TestAccessibilityService)));
        await model.resolve();
        disposables.add(model.testCreateTextEditorModel(createTextBufferFactory('foo'), null, Mimes.text));
        assert.strictEqual(model.isResolved(), true);
    });
    ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yTW9kZWwudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvdGVzdC9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JNb2RlbC50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUN6SCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUVuRixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUN0RixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMERBQTBELENBQUM7QUFDM0YsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFDekgsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBR3JGLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQzFGLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxNQUFNLG9FQUFvRSxDQUFDO0FBQ3BILE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUM3RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUNyRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDbkYsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sNkVBQTZFLENBQUM7QUFDdEgsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFD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