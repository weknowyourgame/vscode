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
import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { NotebookEditorWidgetService } from '../../browser/services/notebookEditorServiceImpl.js';
import { NotebookEditorInput } from '../../common/notebookEditorInput.js';
import { setupInstantiationService } from './testNotebookEditor.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
let TestNotebookEditorWidgetService = class TestNotebookEditorWidgetService extends NotebookEditorWidgetService {
    constructor(editorGroupService, editorService, contextKeyService, instantiationService) {
        super(editorGroupService, editorService, contextKeyService, instantiationService);
    }
    createWidget() {
        return new class extends mock() {
            constructor() {
                super(...arguments);
                this.onWillHide = () => { };
                this.getDomNode = () => { return { remove: () => { } }; };
                this.dispose = () => { };
            }
        };
    }
};
TestNotebookEditorWidgetService = __decorate([
    __param(0, IEditorGroupsService),
    __param(1, IEditorService),
    __param(2, IContextKeyService),
    __param(3, IInstantiationService)
], TestNotebookEditorWidgetService);
function createNotebookInput(path, editorType) {
    return new class extends mock() {
        constructor() {
            super(...arguments);
            this.resource = URI.parse(path);
        }
        get typeId() { return editorType; }
    };
}
suite('NotebookEditorWidgetService', () => {
    let disposables;
    let instantiationService;
    let editorGroup1;
    let editorGroup2;
    let ondidRemoveGroup;
    let onDidCloseEditor;
    let onWillMoveEditor;
    teardown(() => disposables.dispose());
    ensureNoDisposablesAreLeakedInTestSuite();
    setup(() => {
        disposables = new DisposableStore();
        ondidRemoveGroup = new Emitter();
        onDidCloseEditor = new Emitter();
        onWillMoveEditor = new Emitter();
        editorGroup1 = new class extends mock() {
            constructor() {
                super(...arguments);
                this.id = 1;
                this.onDidCloseEditor = onDidCloseEditor.event;
                this.onWillMoveEditor = onWillMoveEditor.event;
            }
        };
        editorGroup2 = new class extends mock() {
            constructor() {
                super(...arguments);
                this.id = 2;
                this.onDidCloseEditor = Event.None;
                this.onWillMoveEditor = Event.None;
            }
        };
        instantiationService = setupInstantiationService(disposables);
        instantiationService.stub(IEditorGroupsService, new class extends mock() {
            constructor() {
                super(...arguments);
                this.onDidRemoveGroup = ondidRemoveGroup.event;
                this.onDidAddGroup = Event.None;
                this.whenReady = Promise.resolve();
                this.groups = [editorGroup1, editorGroup2];
            }
            getPart(container) {
                return { windowId: 0 };
            }
        });
        instantiationService.stub(IEditorService, new class extends mock() {
            constructor() {
                super(...arguments);
                this.onDidEditorsChange = Event.None;
            }
        });
    });
    test('Retrieve widget within group', async function () {
        const notebookEditorInput = createNotebookInput('/test.np', 'type1');
        const notebookEditorService = disposables.add(instantiationService.createInstance(TestNotebookEditorWidgetService));
        const widget = notebookEditorService.retrieveWidget(instantiationService, 1, notebookEditorInput);
        const value = widget.value;
        const widget2 = notebookEditorService.retrieveWidget(instantiationService, 1, notebookEditorInput);
        assert.notStrictEqual(widget2.value, undefined, 'should create a widget');
        assert.strictEqual(value, widget2.value, 'should return the same widget');
        assert.strictEqual(widget.value, undefined, 'initial borrow should no longer have widget');
    });
    test('Retrieve independent widgets', async function () {
        const inputType1 = createNotebookInput('/test.np', 'type1');
        const inputType2 = createNotebookInput('/test.np', 'type2');
        const notebookEditorService = disposables.add(instantiationService.createInstance(TestNotebookEditorWidgetService));
        const widget = notebookEditorService.retrieveWidget(instantiationService, 1, inputType1);
        const widgetDiffGroup = notebookEditorService.retrieveWidget(instantiationService, 2, inputType1);
        const widgetDiffType = notebookEditorService.retrieveWidget(instantiationService, 1, inputType2);
        assert.notStrictEqual(widget.value, undefined, 'should create a widget');
        assert.notStrictEqual(widgetDiffGroup.value, undefined, 'should create a widget');
        assert.notStrictEqual(widgetDiffType.value, undefined, 'should create a widget');
        assert.notStrictEqual(widget.value, widgetDiffGroup.value, 'should return a different widget');
        assert.notStrictEqual(widget.value, widgetDiffType.value, 'should return a different widget');
    });
    test('Only relevant widgets get disposed', async function () {
        const inputType1 = createNotebookInput('/test.np', 'type1');
        const inputType2 = createNotebookInput('/test.np', 'type2');
        const notebookEditorService = disposables.add(instantiationService.createInstance(TestNotebookEditorWidgetService));
        const widget = notebookEditorService.retrieveWidget(instantiationService, 1, inputType1);
        const widgetDiffType = notebookEditorService.retrieveWidget(instantiationService, 1, inputType2);
        const widgetDiffGroup = notebookEditorService.retrieveWidget(instantiationService, 2, inputType1);
        ondidRemoveGroup.fire(editorGroup1);
        assert.strictEqual(widget.value, undefined, 'widgets in group should get disposed');
        assert.strictEqual(widgetDiffType.value, undefined, 'widgets in group should get disposed');
        assert.notStrictEqual(widgetDiffGroup.value, undefined, 'other group should not be disposed');
        notebookEditorService.dispose();
    });
    test('Widget should move between groups when editor is moved', async function () {
        const inputType1 = createNotebookInput('/test.np', NotebookEditorInput.ID);
        const notebookEditorService = disposables.add(instantiationService.createInstance(TestNotebookEditorWidgetService));
        const initialValue = notebookEditorService.retrieveWidget(instantiationService, 1, inputType1).value;
        await new Promise(resolve => setTimeout(resolve, 0));
        onWillMoveEditor.fire({
            editor: inputType1,
            groupId: 1,
            target: 2,
        });
        const widgetDiffGroup = notebookEditorService.retrieveWidget(instantiationService, 2, inputType1);
        const widgetFirstGroup = notebookEditorService.retrieveWidget(instantiationService, 1, inputType1);
        assert.notStrictEqual(initialValue, undefined, 'valid widget');
        assert.strictEqual(widgetDiffGroup.value, initialValue, 'widget should be reused in new group');
        assert.notStrictEqual(widgetFirstGroup.value, initialValue, 'should create a new widget in the first group');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTm90ZWJvb2tFZGl0b3JXaWRnZXRTZXJ2aWNlLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbm90ZWJvb2svdGVzdC9icm93c2VyL05vdGVib29rRWRpdG9yV2lkZ2V0U2VydmljZS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEQsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQy9ELE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBSXRHLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ2xHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzFFLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ3BFLE9BQU8sRUFBZ0Isb0JBQW9CLEVBQWUsTUFBTSwyREFBMkQsQ0FBQztBQUM1SCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFFckYsSUFBTSwrQkFBK0IsR0FBckMsTUFBTSwrQkFBZ0MsU0FBUSwyQkFBMkI7SUFDeEUsWUFDdUIsa0JBQXdDLEVBQzlDLGFBQTZCLEVBQ3pC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