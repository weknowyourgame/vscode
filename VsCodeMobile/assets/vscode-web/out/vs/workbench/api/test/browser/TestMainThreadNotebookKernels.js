/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { mock } from '../../../test/common/workbenchTestServices.js';
import { TestInstantiationService } from '../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { INotebookKernelService } from '../../../contrib/notebook/common/notebookKernelService.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { INotebookExecutionStateService } from '../../../contrib/notebook/common/notebookExecutionStateService.js';
import { INotebookService } from '../../../contrib/notebook/common/notebookService.js';
import { INotebookEditorService } from '../../../contrib/notebook/browser/services/notebookEditorService.js';
import { Event } from '../../../../base/common/event.js';
import { MainThreadNotebookKernels } from '../../browser/mainThreadNotebookKernels.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
export class TestMainThreadNotebookKernels extends Disposable {
    constructor(extHostContext) {
        super();
        this.registeredKernels = new Map();
        this.kernelHandle = 0;
        this.instantiationService = this._register(new TestInstantiationService());
        this.setupDefaultStubs();
        this.mainThreadNotebookKernels = this._register(this.instantiationService.createInstance(MainThreadNotebookKernels, extHostContext));
    }
    setupDefaultStubs() {
        this.instantiationService.stub(ILanguageService, new class extends mock() {
            getRegisteredLanguageIds() {
                return ['typescript', 'javascript', 'python'];
            }
        });
        this.instantiationService.stub(INotebookKernelService, new class extends mock() {
            constructor(builder) {
                super();
                this.builder = builder;
                this.onDidChangeSelectedNotebooks = Event.None;
            }
            registerKernel(kernel) {
                this.builder.registeredKernels.set(kernel.id, kernel);
                return Disposable.None;
            }
            getMatchingKernel() {
                return {
                    selected: undefined,
                    suggestions: [],
                    all: [],
                    hidden: []
                };
            }
        }(this));
        this.instantiationService.stub(INotebookExecutionStateService, new class extends mock() {
            createCellExecution() {
                return new class extends mock() {
                };
            }
            createExecution() {
                return new class extends mock() {
                };
            }
        });
        this.instantiationService.stub(INotebookService, new class extends mock() {
            getNotebookTextModel() {
                return undefined;
            }
        });
        this.instantiationService.stub(INotebookEditorService, new class extends mock() {
            constructor() {
                super(...arguments);
                this.onDidAddNotebookEditor = Event.None;
                this.onDidRemoveNotebookEditor = Event.None;
            }
            listNotebookEditors() {
                return [];
            }
        });
    }
    get instance() {
        return this.mainThreadNotebookKernels;
    }
    async addKernel(id) {
        const handle = this.kernelHandle++;
        await this.instance.$addKernel(handle, {
            id,
            notebookType: 'test-notebook',
            extensionId: new ExtensionIdentifier('test.extension'),
            extensionLocation: { scheme: 'test', path: '/test' },
            label: 'Test Kernel',
            description: 'A test kernel',
            hasVariableProvider: true
        });
    }
    getKernel(id) {
        return this.registeredKernels.get(id);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGVzdE1haW5UaHJlYWROb3RlYm9va0tlcm5lbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS90ZXN0L2Jyb3dzZXIvVGVzdE1haW5UaHJlYWROb3RlYm9va0tlcm5lbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLDRFQUE0RSxDQUFDO0FBRXRILE9BQU8sRUFBbUIsc0JBQXNCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUNwSCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDbkYsT0FBTyxFQUE4Qyw4QkFBOEIsRUFBRSxNQUFNLG1FQUFtRSxDQUFDO0FBQy9KLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHFFQUFxRSxDQUFDO0FBQzdHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUN2RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUUzRixNQUFNLE9BQU8sNkJBQThCLFNBQVEsVUFBVTtJQU01RCxZQUFZLGNBQStCO1FBQzFDLEtBQUssRUFBRSxDQUFDO1FBTFEsc0JBQWlCLEdBQUcsSUFBSSxHQUFHLEVBQTJCLENBQUM7UUFFaEUsaUJBQVksR0FBRyxDQUFDLENBQUM7UUFJeEIsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSx3QkFB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