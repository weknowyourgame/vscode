/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { IAccessibilitySignalService } from '../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { UriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentityService.js';
import { TestWorkspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { EditorAutoSave } from '../../../../browser/parts/editor/editorAutoSave.js';
import { DEFAULT_EDITOR_ASSOCIATION } from '../../../../common/editor.js';
import { EditorService } from '../../../../services/editor/browser/editorService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IFilesConfigurationService } from '../../../../services/filesConfiguration/common/filesConfigurationService.js';
import { createEditorPart, registerTestFileEditor, TestEnvironmentService, TestFilesConfigurationService, TestServiceAccessor, TestTextResourceConfigurationService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { TestContextService, TestFileService, TestMarkerService } from '../../../../test/common/workbenchTestServices.js';
suite('EditorAutoSave', () => {
    const disposables = new DisposableStore();
    setup(() => {
        disposables.add(registerTestFileEditor());
    });
    teardown(() => {
        disposables.clear();
    });
    async function createEditorAutoSave(autoSaveConfig) {
        const instantiationService = workbenchInstantiationService(undefined, disposables);
        const configurationService = new TestConfigurationService();
        configurationService.setUserConfiguration('files', autoSaveConfig);
        instantiationService.stub(IConfigurationService, configurationService);
        // eslint-disable-next-line local/code-no-any-casts
        instantiationService.stub(IAccessibilitySignalService, {
            playSignal: async () => { },
            isSoundEnabled(signal) { return false; },
        });
        instantiationService.stub(IFilesConfigurationService, disposables.add(new TestFilesConfigurationService(instantiationService.createInstance(MockContextKeyService), configurationService, new TestContextService(TestWorkspace), TestEnvironmentService, disposables.add(new UriIdentityService(disposables.add(new TestFileService()))), disposables.add(new TestFileService()), new TestMarkerService(), new TestTextResourceConfigurationService(configurationService))));
        const part = await createEditorPart(instantiationService, disposables);
        instantiationService.stub(IEditorGroupsService, part);
        const editorService = disposables.add(instantiationService.createInstance(EditorService, undefined));
        instantiationService.stub(IEditorService, editorService);
        const accessor = instantiationService.createInstance(TestServiceAccessor);
        disposables.add(accessor.textFileService.files);
        disposables.add(instantiationService.createInstance(EditorAutoSave));
        return accessor;
    }
    test('editor auto saves after short delay if configured', async function () {
        const accessor = await createEditorAutoSave({ autoSave: 'afterDelay', autoSaveDelay: 1 });
        const resource = toResource.call(this, '/path/index.txt');
        const model = disposables.add(await accessor.textFileService.files.resolve(resource));
        model.textEditorModel?.setValue('Super Good');
        assert.ok(model.isDirty());
        await awaitModelSaved(model);
        assert.strictEqual(model.isDirty(), false);
    });
    test('editor auto saves on focus change if configured', async function () {
        const accessor = await createEditorAutoSave({ autoSave: 'onFocusChange' });
        const resource = toResource.call(this, '/path/index.txt');
        await accessor.editorService.openEditor({ resource, options: { override: DEFAULT_EDITOR_ASSOCIATION.id } });
        const model = disposables.add(await accessor.textFileService.files.resolve(resource));
        model.textEditorModel?.setValue('Super Good');
        assert.ok(model.isDirty());
        const editorPane = await accessor.editorService.openEditor({ resource: toResource.call(this, '/path/index_other.txt') });
        await awaitModelSaved(model);
        assert.strictEqual(model.isDirty(), false);
        await editorPane?.group.closeAllEditors();
    });
    function awaitModelSaved(model) {
        return Event.toPromise(Event.once(model.onDidChangeDirty));
    }
    ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yQXV0b1NhdmUudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy90ZXN0L2Jyb3dzZXIvZWRpdG9yQXV0b1NhdmUudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsVUFBVSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDL0csT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sbUZBQW1GLENBQUM7QUFDaEksT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDdEcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFFekgsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0seUVBQXlFLENBQUM7QUFDaEgsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDdEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGdFQUFnRSxDQUFDO0FBQy9GLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxvREFBb0QsQ0FBQztBQUNwRixPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUMxRSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDckYsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDakcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3JGLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLDZF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