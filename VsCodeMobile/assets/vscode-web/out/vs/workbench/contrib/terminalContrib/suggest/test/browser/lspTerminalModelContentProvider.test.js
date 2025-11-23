/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ITextModelService } from '../../../../../../editor/common/services/resolverService.js';
import { IModelService } from '../../../../../../editor/common/services/model.js';
import { createTerminalLanguageVirtualUri, LspTerminalModelContentProvider } from '../../browser/lspTerminalModelContentProvider.js';
import * as sinon from 'sinon';
import assert from 'assert';
import { URI } from '../../../../../../base/common/uri.js';
import { TerminalCapabilityStore } from '../../../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js';
import { IMarkerService } from '../../../../../../platform/markers/common/markers.js';
import { ILanguageService } from '../../../../../../editor/common/languages/language.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { Schemas } from '../../../../../../base/common/network.js';
import { VSCODE_LSP_TERMINAL_PROMPT_TRACKER } from '../../browser/lspTerminalUtil.js';
suite('LspTerminalModelContentProvider', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let capabilityStore;
    let textModelService;
    let modelService;
    let mockTextModel;
    let lspTerminalModelContentProvider;
    let virtualTerminalDocumentUri;
    let setValueSpy;
    let getValueSpy;
    setup(async () => {
        instantiationService = store.add(new TestInstantiationService());
        capabilityStore = store.add(new TerminalCapabilityStore());
        virtualTerminalDocumentUri = URI.from({ scheme: 'vscodeTerminal', path: '/terminal1.py' });
        // Create stubs for the mock text model methods
        setValueSpy = sinon.stub();
        getValueSpy = sinon.stub();
        mockTextModel = {
            setValue: setValueSpy,
            getValue: getValueSpy,
            dispose: sinon.stub(),
            isDisposed: sinon.stub().returns(false)
        };
        // Create a stub for modelService.getModel
        modelService = {};
        modelService.getModel = sinon.stub().callsFake((uri) => {
            return uri.toString() === virtualTerminalDocumentUri.toString() ? mockTextModel : null;
        });
        // Create stub services for instantiation service
        textModelService = {};
        textModelService.registerTextModelContentProvider = sinon.stub().returns({ dispose: sinon.stub() });
        const markerService = {};
        markerService.installResourceFilter = sinon.stub().returns({ dispose: sinon.stub() });
        const languageService = {};
        // Set up the services in the instantiation service
        instantiationService.stub(IModelService, modelService);
        instantiationService.stub(ITextModelService, textModelService);
        instantiationService.stub(IMarkerService, markerService);
        instantiationService.stub(ILanguageService, languageService);
        // Create the provider instance
        lspTerminalModelContentProvider = store.add(instantiationService.createInstance(LspTerminalModelContentProvider, capabilityStore, 1, virtualTerminalDocumentUri, "python" /* GeneralShellType.Python */));
    });
    teardown(() => {
        sinon.restore();
        lspTerminalModelContentProvider?.dispose();
    });
    suite('setContent', () => {
        test('should add delimiter when setting content on empty document', () => {
            getValueSpy.returns('');
            lspTerminalModelContentProvider.setContent('print("hello")');
            assert.strictEqual(setValueSpy.calledOnce, true);
            assert.strictEqual(setValueSpy.args[0][0], VSCODE_LSP_TERMINAL_PROMPT_TRACKER);
        });
        test('should update content with delimiter when document already has content', () => {
            const existingContent = 'previous content\n' + VSCODE_LSP_TERMINAL_PROMPT_TRACKER;
            getValueSpy.returns(existingContent);
            lspTerminalModelContentProvider.setContent('print("hello")');
            assert.strictEqual(setValueSpy.calledOnce, true);
            const expectedContent = 'previous content\n\nprint("hello")\n' + VSCODE_LSP_TERMINAL_PROMPT_TRACKER;
            assert.strictEqual(setValueSpy.args[0][0], expectedContent);
        });
        test('should sanitize content when delimiter is in the middle of existing content', () => {
            // Simulating a corrupted state where the delimiter is in the middle
            const existingContent = 'previous content\n' + VSCODE_LSP_TERMINAL_PROMPT_TRACKER + 'some extra text';
            getValueSpy.returns(existingContent);
            lspTerminalModelContentProvider.setContent('print("hello")');
            assert.strictEqual(setValueSpy.calledOnce, true);
            const expectedContent = 'previous content\n\nprint("hello")\n' + VSCODE_LSP_TERMINAL_PROMPT_TRACKER;
            assert.strictEqual(setValueSpy.args[0][0], expectedContent);
        });
        test('Mac, Linux - createTerminalLanguageVirtualUri should return the correct URI', () => {
            const expectedUri = URI.from({ scheme: Schemas.vscodeTerminal, path: '/terminal1.py' });
            const actualUri = createTerminalLanguageVirtualUri(1, 'py');
            assert.strictEqual(actualUri.toString(), expectedUri.toString());
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibHNwVGVybWluYWxNb2RlbENvbnRlbnRQcm92aWRlci50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9zdWdnZXN0L3Rlc3QvYnJvd3Nlci9sc3BUZXJtaW5hbE1vZGVsQ29udGVudFByb3ZpZGVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sa0ZBQWtGLENBQUM7QUFDNUgsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sNkRBQTZELENBQUM7QUFDaEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBRWxGLE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSwrQkFBK0IsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ3JJLE9BQU8sS0FBSyxLQUFLLE1BQU0sT0FBTyxDQUFDO0FBQy9CLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDM0QsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sb0ZBQW9GLENBQUM7QUFDN0gsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBR3pGLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsa0NBQWtDLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUV0RixLQUFLLENBQUMsaUNBQWlDLEVBQUUsR0FBRyxFQUFFO0lBQzdDLE1BQU0sS0FBSyxHQUFHLHVDQUF1QyxFQUFFLENBQUM7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