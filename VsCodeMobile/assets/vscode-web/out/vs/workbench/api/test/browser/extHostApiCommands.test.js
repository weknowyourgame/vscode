/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import '../../../../editor/contrib/codeAction/browser/codeAction.js';
import '../../../../editor/contrib/codelens/browser/codelens.js';
import '../../../../editor/contrib/colorPicker/browser/colorPickerContribution.js';
import '../../../../editor/contrib/format/browser/format.js';
import '../../../../editor/contrib/gotoSymbol/browser/goToCommands.js';
import '../../../../editor/contrib/documentSymbols/browser/documentSymbols.js';
import '../../../../editor/contrib/hover/browser/getHover.js';
import '../../../../editor/contrib/links/browser/getLinks.js';
import '../../../../editor/contrib/parameterHints/browser/provideSignatureHelp.js';
import '../../../../editor/contrib/smartSelect/browser/smartSelect.js';
import '../../../../editor/contrib/suggest/browser/suggest.js';
import '../../../../editor/contrib/rename/browser/rename.js';
import '../../../../editor/contrib/inlayHints/browser/inlayHintsController.js';
import assert from 'assert';
import { setUnexpectedErrorHandler, errorHandler } from '../../../../base/common/errors.js';
import { URI } from '../../../../base/common/uri.js';
import { Event } from '../../../../base/common/event.js';
import * as types from '../../common/extHostTypes.js';
import { createTextModel } from '../../../../editor/test/common/testTextModel.js';
import { TestRPCProtocol } from '../common/testRPCProtocol.js';
import { MarkerService } from '../../../../platform/markers/common/markerService.js';
import { IMarkerService } from '../../../../platform/markers/common/markers.js';
import { ICommandService, CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ExtHostLanguageFeatures } from '../../common/extHostLanguageFeatures.js';
import { MainThreadLanguageFeatures } from '../../browser/mainThreadLanguageFeatures.js';
import { ExtHostApiCommands } from '../../common/extHostApiCommands.js';
import { ExtHostCommands } from '../../common/extHostCommands.js';
import { MainThreadCommands } from '../../browser/mainThreadCommands.js';
import { ExtHostDocuments } from '../../common/extHostDocuments.js';
import { ExtHostDocumentsAndEditors } from '../../common/extHostDocumentsAndEditors.js';
import { MainContext, ExtHostContext } from '../../common/extHost.protocol.js';
import { ExtHostDiagnostics } from '../../common/extHostDiagnostics.js';
import '../../../contrib/search/browser/search.contribution.js';
import { ILogService, NullLogService } from '../../../../platform/log/common/log.js';
import { nullExtensionDescription, IExtensionService } from '../../../services/extensions/common/extensions.js';
import { dispose, ImmortalReference } from '../../../../base/common/lifecycle.js';
import { IEditorWorkerService } from '../../../../editor/common/services/editorWorker.js';
import { mock } from '../../../../base/test/common/mock.js';
import { NullApiDeprecationService } from '../../common/extHostApiDeprecationService.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { URITransformerService } from '../../common/extHostUriTransformerService.js';
import { IOutlineModelService, OutlineModelService } from '../../../../editor/contrib/documentSymbols/browser/outlineModel.js';
import { ILanguageFeatureDebounceService, LanguageFeatureDebounceService } from '../../../../editor/common/services/languageFeatureDebounce.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { LanguageFeaturesService } from '../../../../editor/common/services/languageFeaturesService.js';
import { assertType } from '../../../../base/common/types.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../platform/configuration/test/common/testConfigurationService.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { TestInstantiationService } from '../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { runWithFakedTimers } from '../../../../base/test/common/timeTravelScheduler.js';
import { timeout } from '../../../../base/common/async.js';
function assertRejects(fn, message = 'Expected rejection') {
    return fn().then(() => assert.ok(false, message), _err => assert.ok(true));
}
function isLocation(value) {
    const candidate = value;
    return candidate && candidate.uri instanceof URI && candidate.range instanceof types.Range;
}
suite('ExtHostLanguageFeatureCommands', function () {
    const defaultSelector = { scheme: 'far' };
    let model;
    let insta;
    let rpcProtocol;
    let extHost;
    let mainThread;
    let commands;
    let disposables = [];
    let originalErrorHandler;
    suiteSetup(() => {
        model = createTextModel([
            'This is the first line',
            'This is the second line',
            'This is the third line',
        ].join('\n'), undefined, undefined, URI.parse('far://testing/file.b'));
        originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
        setUnexpectedErrorHandler(() => { });
        // Use IInstantiationService to get typechecking when instantiating
        rpcProtocol = new TestRPCProtocol();
        const services = new ServiceCollection();
        services.set(IUriIdentityService, new class extends mock() {
            asCanonicalUri(uri) {
                return uri;
            }
        });
        services.set(ILanguageFeaturesService, new SyncDescriptor(LanguageFeaturesService));
        services.set(IExtensionService, new class extends mock() {
            async activateByEvent() {
            }
            activationEventIsDone(activationEvent) {
                return true;
            }
        });
        services.set(ICommandService, new SyncDescriptor(class extends mock() {
            executeCommand(id, ...args) {
                const command = CommandsRegistry.getCommands().get(id);
                if (!command) {
                    return Promise.reject(new Error(id + ' NOT known'));
                }
                const { handler } = command;
                return Promise.resolve(insta.invokeFunction(handler, ...args));
            }
        }));
        services.set(IEnvironmentService, new class extends mock() {
            constructor() {
                super(...arguments);
                this.isBuilt = true;
                this.isExtensionDevelopment = false;
            }
        });
        services.set(IMarkerService, new MarkerService());
        services.set(ILogService, new SyncDescriptor(NullLogService));
        services.set(ILanguageFeatureDebounceService, new SyncDescriptor(LanguageFeatureDebounceService));
        services.set(IModelService, new class extends mock() {
            constructor() {
                super(...arguments);
                this.onModelRemoved = Event.None;
            }
            getModel() { return model; }
        });
        services.set(ITextModelService, new class extends mock() {
            async createModelReference() {
                return new ImmortalReference(new class extends mock() {
                    constructor() {
                        super(...arguments);
                        this.textEditorModel = model;
                    }
                });
            }
        });
        services.set(IEditorWorkerService, new class extends mock() {
            async computeMoreMinimalEdits(_uri, edits) {
                return edits || undefined;
            }
        });
        services.set(ILanguageFeatureDebounceService, new SyncDescriptor(LanguageFeatureDebounceService));
        services.set(IOutlineModelService, new SyncDescriptor(OutlineModelService));
        services.set(IConfigurationService, new TestConfigurationService());
        insta = new TestInstantiationService(services);
        const extHostDocumentsAndEditors = new ExtHostDocumentsAndEditors(rpcProtocol, new NullLogService());
        extHostDocumentsAndEditors.$acceptDocumentsAndEditorsDelta({
            addedDocuments: [{
                    isDirty: false,
                    versionId: model.getVersionId(),
                    languageId: model.getLanguageId(),
                    uri: model.uri,
                    lines: model.getValue().split(model.getEOL()),
                    EOL: model.getEOL(),
                    encoding: 'utf8'
                }]
        });
        const extHostDocuments = new ExtHostDocuments(rpcProtocol, extHostDocumentsAndEditors);
        rpcProtocol.set(ExtHostContext.ExtHostDocuments, extHostDocuments);
        commands = new ExtHostCommands(rpcProtocol, new NullLogService(), new class extends mock() {
            onExtensionError() {
                return true;
            }
        });
        rpcProtocol.set(ExtHostContext.ExtHostCommands, commands);
        rpcProtocol.set(MainContext.MainThreadCommands, insta.createInstance(MainThreadCommands, rpcProtocol));
        ExtHostApiCommands.register(commands);
        const diagnostics = new ExtHostDiagnostics(rpcProtocol, new NullLogService(), new class extends mock() {
        }, extHostDocumentsAndEditors);
        rpcProtocol.set(ExtHostContext.ExtHostDiagnostics, diagnostics);
        extHost = new ExtHostLanguageFeatures(rpcProtocol, new URITransformerService(null), extHostDocuments, commands, diagnostics, new NullLogService(), NullApiDeprecationService, new class extends mock() {
            onExtensionError() {
                return true;
            }
        });
        rpcProtocol.set(ExtHostContext.ExtHostLanguageFeatures, extHost);
        mainThread = rpcProtocol.set(MainContext.MainThreadLanguageFeatures, insta.createInstance(MainThreadLanguageFeatures, rpcProtocol));
        // forcefully create the outline service so that `ensureNoDisposablesAreLeakedInTestSuite` doesn't bark
        insta.get(IOutlineModelService);
        return rpcProtocol.sync();
    });
    suiteTeardown(() => {
        setUnexpectedErrorHandler(originalErrorHandler);
        model.dispose();
        mainThread.dispose();
        insta.get(IOutlineModelService).dispose();
        insta.dispose();
    });
    teardown(() => {
        disposables = dispose(disposables);
        return rpcProtocol.sync();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    // --- workspace symbols
    function testApiCmd(name, fn) {
        test(name, async function () {
            await runWithFakedTimers({}, async () => {
                await fn();
                await timeout(10000); // API commands for things that allow commands dispose their result delay. This is to be nice
                // because otherwise properties like command are disposed too early
            });
        });
    }
    test('WorkspaceSymbols, invalid arguments', function () {
        const promises = [
            assertRejects(() => commands.executeCommand('vscode.executeWorkspaceSymbolProvider')),
            assertRejects(() => commands.executeCommand('vscode.executeWorkspaceSymbolProvider', null)),
            assertRejects(() => commands.executeCommand('vscode.executeWorkspaceSymbolProvider', undefined)),
            assertRejects(() => commands.executeCommand('vscode.executeWorkspaceSymbolProvider', true))
        ];
        return Promise.all(promises);
    });
    test('WorkspaceSymbols, back and forth', function () {
        disposables.push(extHost.registerWorkspaceSymbolProvider(nullExtensionDescription, {
            provideWorkspaceSymbols(query) {
                return [
                    new types.SymbolInformation(query, types.SymbolKind.Array, new types.Range(0, 0, 1, 1), URI.parse('far://testing/first')),
                    new types.SymbolInformation(query, types.SymbolKind.Array, new types.Range(0, 0, 1, 1), URI.parse('far://testing/second'))
                ];
            }
        }));
        disposables.push(extHost.registerWorkspaceSymbolProvider(nullExtensionDescription, {
            provideWorkspaceSymbols(query) {
                return [
                    new types.SymbolInformation(query, types.SymbolKind.Array, new types.Range(0, 0, 1, 1), URI.parse('far://testing/first'))
                ];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeWorkspaceSymbolProvider', 'testing').then(value => {
                assert.strictEqual(value.length, 2); // de-duped
                for (const info of value) {
                    assert.strictEqual(info instanceof types.SymbolInformation, true);
                    assert.strictEqual(info.name, 'testing');
                    assert.strictEqual(info.kind, types.SymbolKind.Array);
                }
            });
        });
    });
    test('executeWorkspaceSymbolProvider should accept empty string, #39522', async function () {
        disposables.push(extHost.registerWorkspaceSymbolProvider(nullExtensionDescription, {
            provideWorkspaceSymbols() {
                return [new types.SymbolInformation('hello', types.SymbolKind.Array, new types.Range(0, 0, 0, 0), URI.parse('foo:bar'))];
            }
        }));
        await rpcProtocol.sync();
        let symbols = await commands.executeCommand('vscode.executeWorkspaceSymbolProvider', '');
        assert.strictEqual(symbols.length, 1);
        await rpcProtocol.sync();
        symbols = await commands.executeCommand('vscode.executeWorkspaceSymbolProvider', '*');
        assert.strictEqual(symbols.length, 1);
    });
    // --- formatting
    test('executeFormatDocumentProvider, back and forth', async function () {
        disposables.push(extHost.registerDocumentFormattingEditProvider(nullExtensionDescription, defaultSelector, new class {
            provideDocumentFormattingEdits() {
                return [types.TextEdit.insert(new types.Position(0, 0), '42')];
            }
        }));
        await rpcProtocol.sync();
        const edits = await commands.executeCommand('vscode.executeFormatDocumentProvider', model.uri, {
            insertSpaces: false,
            tabSize: 4,
        });
        assert.strictEqual(edits.length, 1);
    });
    // --- rename
    test('vscode.prepareRename', async function () {
        disposables.push(extHost.registerRenameProvider(nullExtensionDescription, defaultSelector, new class {
            prepareRename(document, position) {
                return {
                    range: new types.Range(0, 12, 0, 24),
                    placeholder: 'foooPlaceholder'
                };
            }
            provideRenameEdits(document, position, newName) {
                const edit = new types.WorkspaceEdit();
                edit.insert(document.uri, position, newName);
                return edit;
            }
        }));
        await rpcProtocol.sync();
        const data = await commands.executeCommand('vscode.prepareRename', model.uri, new types.Position(0, 12));
        assert.ok(data);
        assert.strictEqual(data.placeholder, 'foooPlaceholder');
        assert.strictEqual(data.range.start.line, 0);
        assert.strictEqual(data.range.start.character, 12);
        assert.strictEqual(data.range.end.line, 0);
        assert.strictEqual(data.range.end.character, 24);
    });
    test('vscode.executeDocumentRenameProvider', async function () {
        disposables.push(extHost.registerRenameProvider(nullExtensionDescription, defaultSelector, new class {
            provideRenameEdits(document, position, newName) {
                const edit = new types.WorkspaceEdit();
                edit.insert(document.uri, position, newName);
                return edit;
            }
        }));
        await rpcProtocol.sync();
        const edit = await commands.executeCommand('vscode.executeDocumentRenameProvider', model.uri, new types.Position(0, 12), 'newNameOfThis');
        assert.ok(edit);
        assert.strictEqual(edit.has(model.uri), true);
        const textEdits = edit.get(model.uri);
        assert.strictEqual(textEdits.length, 1);
        assert.strictEqual(textEdits[0].newText, 'newNameOfThis');
    });
    // --- definition
    test('Definition, invalid arguments', function () {
        const promises = [
            assertRejects(() => commands.executeCommand('vscode.executeDefinitionProvider')),
            assertRejects(() => commands.executeCommand('vscode.executeDefinitionProvider', null)),
            assertRejects(() => commands.executeCommand('vscode.executeDefinitionProvider', undefined)),
            assertRejects(() => commands.executeCommand('vscode.executeDefinitionProvider', true, false))
        ];
        return Promise.all(promises);
    });
    test('Definition, back and forth', function () {
        disposables.push(extHost.registerDefinitionProvider(nullExtensionDescription, defaultSelector, {
            provideDefinition(doc) {
                return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
            }
        }));
        disposables.push(extHost.registerDefinitionProvider(nullExtensionDescription, defaultSelector, {
            provideDefinition(doc) {
                // duplicate result will get removed
                return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
            }
        }));
        disposables.push(extHost.registerDefinitionProvider(nullExtensionDescription, defaultSelector, {
            provideDefinition(doc) {
                return [
                    new types.Location(doc.uri, new types.Range(2, 0, 0, 0)),
                    new types.Location(doc.uri, new types.Range(3, 0, 0, 0)),
                    new types.Location(doc.uri, new types.Range(4, 0, 0, 0)),
                ];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeDefinitionProvider', model.uri, new types.Position(0, 0)).then(values => {
                assert.strictEqual(values.length, 4);
                for (const v of values) {
                    assert.ok(v.uri instanceof URI);
                    assert.ok(v.range instanceof types.Range);
                }
            });
        });
    });
    test('Definition, back and forth (sorting & de-deduping)', function () {
        disposables.push(extHost.registerDefinitionProvider(nullExtensionDescription, defaultSelector, {
            provideDefinition(doc) {
                return new types.Location(URI.parse('file:///b'), new types.Range(1, 0, 0, 0));
            }
        }));
        disposables.push(extHost.registerDefinitionProvider(nullExtensionDescription, defaultSelector, {
            provideDefinition(doc) {
                // duplicate result will get removed
                return new types.Location(URI.parse('file:///b'), new types.Range(1, 0, 0, 0));
            }
        }));
        disposables.push(extHost.registerDefinitionProvider(nullExtensionDescription, defaultSelector, {
            provideDefinition(doc) {
                return [
                    new types.Location(URI.parse('file:///a'), new types.Range(2, 0, 0, 0)),
                    new types.Location(URI.parse('file:///c'), new types.Range(3, 0, 0, 0)),
                    new types.Location(URI.parse('file:///d'), new types.Range(4, 0, 0, 0)),
                ];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeDefinitionProvider', model.uri, new types.Position(0, 0)).then(values => {
                assert.strictEqual(values.length, 4);
                assert.strictEqual(values[0].uri.path, '/a');
                assert.strictEqual(values[1].uri.path, '/b');
                assert.strictEqual(values[2].uri.path, '/c');
                assert.strictEqual(values[3].uri.path, '/d');
            });
        });
    });
    test('Definition Link', () => {
        disposables.push(extHost.registerDefinitionProvider(nullExtensionDescription, defaultSelector, {
            provideDefinition(doc) {
                return [
                    new types.Location(doc.uri, new types.Range(0, 0, 0, 0)),
                    { targetUri: doc.uri, targetRange: new types.Range(1, 0, 0, 0), targetSelectionRange: new types.Range(1, 1, 1, 1), originSelectionRange: new types.Range(2, 2, 2, 2) }
                ];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeDefinitionProvider', model.uri, new types.Position(0, 0)).then(values => {
                assert.strictEqual(values.length, 2);
                for (const v of values) {
                    if (isLocation(v)) {
                        assert.ok(v.uri instanceof URI);
                        assert.ok(v.range instanceof types.Range);
                    }
                    else {
                        assert.ok(v.targetUri instanceof URI);
                        assert.ok(v.targetRange instanceof types.Range);
                        assert.ok(v.targetSelectionRange instanceof types.Range);
                        assert.ok(v.originSelectionRange instanceof types.Range);
                    }
                }
            });
        });
    });
    // --- declaration
    test('Declaration, back and forth', function () {
        disposables.push(extHost.registerDeclarationProvider(nullExtensionDescription, defaultSelector, {
            provideDeclaration(doc) {
                return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
            }
        }));
        disposables.push(extHost.registerDeclarationProvider(nullExtensionDescription, defaultSelector, {
            provideDeclaration(doc) {
                // duplicate result will get removed
                return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
            }
        }));
        disposables.push(extHost.registerDeclarationProvider(nullExtensionDescription, defaultSelector, {
            provideDeclaration(doc) {
                return [
                    new types.Location(doc.uri, new types.Range(2, 0, 0, 0)),
                    new types.Location(doc.uri, new types.Range(3, 0, 0, 0)),
                    new types.Location(doc.uri, new types.Range(4, 0, 0, 0)),
                ];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeDeclarationProvider', model.uri, new types.Position(0, 0)).then(values => {
                assert.strictEqual(values.length, 4);
                for (const v of values) {
                    assert.ok(v.uri instanceof URI);
                    assert.ok(v.range instanceof types.Range);
                }
            });
        });
    });
    test('Declaration Link', () => {
        disposables.push(extHost.registerDeclarationProvider(nullExtensionDescription, defaultSelector, {
            provideDeclaration(doc) {
                return [
                    new types.Location(doc.uri, new types.Range(0, 0, 0, 0)),
                    { targetUri: doc.uri, targetRange: new types.Range(1, 0, 0, 0), targetSelectionRange: new types.Range(1, 1, 1, 1), originSelectionRange: new types.Range(2, 2, 2, 2) }
                ];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeDeclarationProvider', model.uri, new types.Position(0, 0)).then(values => {
                assert.strictEqual(values.length, 2);
                for (const v of values) {
                    if (isLocation(v)) {
                        assert.ok(v.uri instanceof URI);
                        assert.ok(v.range instanceof types.Range);
                    }
                    else {
                        assert.ok(v.targetUri instanceof URI);
                        assert.ok(v.targetRange instanceof types.Range);
                        assert.ok(v.targetSelectionRange instanceof types.Range);
                        assert.ok(v.originSelectionRange instanceof types.Range);
                    }
                }
            });
        });
    });
    // --- type definition
    test('Type Definition, invalid arguments', function () {
        const promises = [
            assertRejects(() => commands.executeCommand('vscode.executeTypeDefinitionProvider')),
            assertRejects(() => commands.executeCommand('vscode.executeTypeDefinitionProvider', null)),
            assertRejects(() => commands.executeCommand('vscode.executeTypeDefinitionProvider', undefined)),
            assertRejects(() => commands.executeCommand('vscode.executeTypeDefinitionProvider', true, false))
        ];
        return Promise.all(promises);
    });
    test('Type Definition, back and forth', function () {
        disposables.push(extHost.registerTypeDefinitionProvider(nullExtensionDescription, defaultSelector, {
            provideTypeDefinition(doc) {
                return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
            }
        }));
        disposables.push(extHost.registerTypeDefinitionProvider(nullExtensionDescription, defaultSelector, {
            provideTypeDefinition(doc) {
                // duplicate result will get removed
                return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
            }
        }));
        disposables.push(extHost.registerTypeDefinitionProvider(nullExtensionDescription, defaultSelector, {
            provideTypeDefinition(doc) {
                return [
                    new types.Location(doc.uri, new types.Range(2, 0, 0, 0)),
                    new types.Location(doc.uri, new types.Range(3, 0, 0, 0)),
                    new types.Location(doc.uri, new types.Range(4, 0, 0, 0)),
                ];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeTypeDefinitionProvider', model.uri, new types.Position(0, 0)).then(values => {
                assert.strictEqual(values.length, 4);
                for (const v of values) {
                    assert.ok(v.uri instanceof URI);
                    assert.ok(v.range instanceof types.Range);
                }
            });
        });
    });
    test('Type Definition Link', () => {
        disposables.push(extHost.registerTypeDefinitionProvider(nullExtensionDescription, defaultSelector, {
            provideTypeDefinition(doc) {
                return [
                    new types.Location(doc.uri, new types.Range(0, 0, 0, 0)),
                    { targetUri: doc.uri, targetRange: new types.Range(1, 0, 0, 0), targetSelectionRange: new types.Range(1, 1, 1, 1), originSelectionRange: new types.Range(2, 2, 2, 2) }
                ];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeTypeDefinitionProvider', model.uri, new types.Position(0, 0)).then(values => {
                assert.strictEqual(values.length, 2);
                for (const v of values) {
                    if (isLocation(v)) {
                        assert.ok(v.uri instanceof URI);
                        assert.ok(v.range instanceof types.Range);
                    }
                    else {
                        assert.ok(v.targetUri instanceof URI);
                        assert.ok(v.targetRange instanceof types.Range);
                        assert.ok(v.targetSelectionRange instanceof types.Range);
                        assert.ok(v.originSelectionRange instanceof types.Range);
                    }
                }
            });
        });
    });
    // --- implementation
    test('Implementation, invalid arguments', function () {
        const promises = [
            assertRejects(() => commands.executeCommand('vscode.executeImplementationProvider')),
            assertRejects(() => commands.executeCommand('vscode.executeImplementationProvider', null)),
            assertRejects(() => commands.executeCommand('vscode.executeImplementationProvider', undefined)),
            assertRejects(() => commands.executeCommand('vscode.executeImplementationProvider', true, false))
        ];
        return Promise.all(promises);
    });
    test('Implementation, back and forth', function () {
        disposables.push(extHost.registerImplementationProvider(nullExtensionDescription, defaultSelector, {
            provideImplementation(doc) {
                return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
            }
        }));
        disposables.push(extHost.registerImplementationProvider(nullExtensionDescription, defaultSelector, {
            provideImplementation(doc) {
                // duplicate result will get removed
                return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
            }
        }));
        disposables.push(extHost.registerImplementationProvider(nullExtensionDescription, defaultSelector, {
            provideImplementation(doc) {
                return [
                    new types.Location(doc.uri, new types.Range(2, 0, 0, 0)),
                    new types.Location(doc.uri, new types.Range(3, 0, 0, 0)),
                    new types.Location(doc.uri, new types.Range(4, 0, 0, 0)),
                ];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeImplementationProvider', model.uri, new types.Position(0, 0)).then(values => {
                assert.strictEqual(values.length, 4);
                for (const v of values) {
                    assert.ok(v.uri instanceof URI);
                    assert.ok(v.range instanceof types.Range);
                }
            });
        });
    });
    test('Implementation Definition Link', () => {
        disposables.push(extHost.registerImplementationProvider(nullExtensionDescription, defaultSelector, {
            provideImplementation(doc) {
                return [
                    new types.Location(doc.uri, new types.Range(0, 0, 0, 0)),
                    { targetUri: doc.uri, targetRange: new types.Range(1, 0, 0, 0), targetSelectionRange: new types.Range(1, 1, 1, 1), originSelectionRange: new types.Range(2, 2, 2, 2) }
                ];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeImplementationProvider', model.uri, new types.Position(0, 0)).then(values => {
                assert.strictEqual(values.length, 2);
                for (const v of values) {
                    if (isLocation(v)) {
                        assert.ok(v.uri instanceof URI);
                        assert.ok(v.range instanceof types.Range);
                    }
                    else {
                        assert.ok(v.targetUri instanceof URI);
                        assert.ok(v.targetRange instanceof types.Range);
                        assert.ok(v.targetSelectionRange instanceof types.Range);
                        assert.ok(v.originSelectionRange instanceof types.Range);
                    }
                }
            });
        });
    });
    // --- references
    test('reference search, back and forth', function () {
        disposables.push(extHost.registerReferenceProvider(nullExtensionDescription, defaultSelector, {
            provideReferences() {
                return [
                    new types.Location(URI.parse('some:uri/path'), new types.Range(0, 1, 0, 5))
                ];
            }
        }));
        return commands.executeCommand('vscode.executeReferenceProvider', model.uri, new types.Position(0, 0)).then(values => {
            assert.strictEqual(values.length, 1);
            const [first] = values;
            assert.strictEqual(first.uri.toString(), 'some:uri/path');
            assert.strictEqual(first.range.start.line, 0);
            assert.strictEqual(first.range.start.character, 1);
            assert.strictEqual(first.range.end.line, 0);
            assert.strictEqual(first.range.end.character, 5);
        });
    });
    // --- document highlights
    test('"vscode.executeDocumentHighlights" API has stopped returning DocumentHighlight[]#200056', async function () {
        disposables.push(extHost.registerDocumentHighlightProvider(nullExtensionDescription, defaultSelector, {
            provideDocumentHighlights() {
                return [
                    new types.DocumentHighlight(new types.Range(0, 17, 0, 25), types.DocumentHighlightKind.Read)
                ];
            }
        }));
        await rpcProtocol.sync();
        return commands.executeCommand('vscode.executeDocumentHighlights', model.uri, new types.Position(0, 0)).then(values => {
            assert.ok(Array.isArray(values));
            assert.strictEqual(values.length, 1);
            const [first] = values;
            assert.strictEqual(first.range.start.line, 0);
            assert.strictEqual(first.range.start.character, 17);
            assert.strictEqual(first.range.end.line, 0);
            assert.strictEqual(first.range.end.character, 25);
        });
    });
    // --- outline
    test('Outline, back and forth', function () {
        disposables.push(extHost.registerDocumentSymbolProvider(nullExtensionDescription, defaultSelector, {
            provideDocumentSymbols() {
                return [
                    new types.SymbolInformation('testing1', types.SymbolKind.Enum, new types.Range(1, 0, 1, 0)),
                    new types.SymbolInformation('testing2', types.SymbolKind.Enum, new types.Range(0, 1, 0, 3)),
                ];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeDocumentSymbolProvider', model.uri).then(values => {
                assert.strictEqual(values.length, 2);
                const [first, second] = values;
                assert.strictEqual(first instanceof types.SymbolInformation, true);
                assert.strictEqual(second instanceof types.SymbolInformation, true);
                assert.strictEqual(first.name, 'testing2');
                assert.strictEqual(second.name, 'testing1');
            });
        });
    });
    test('vscode.executeDocumentSymbolProvider command only returns SymbolInformation[] rather than DocumentSymbol[] #57984', function () {
        disposables.push(extHost.registerDocumentSymbolProvider(nullExtensionDescription, defaultSelector, {
            provideDocumentSymbols() {
                return [
                    new types.SymbolInformation('SymbolInformation', types.SymbolKind.Enum, new types.Range(1, 0, 1, 0))
                ];
            }
        }));
        disposables.push(extHost.registerDocumentSymbolProvider(nullExtensionDescription, defaultSelector, {
            provideDocumentSymbols() {
                const root = new types.DocumentSymbol('DocumentSymbol', 'DocumentSymbol#detail', types.SymbolKind.Enum, new types.Range(1, 0, 1, 0), new types.Range(1, 0, 1, 0));
                root.children = [new types.DocumentSymbol('DocumentSymbol#child', 'DocumentSymbol#detail#child', types.SymbolKind.Enum, new types.Range(1, 0, 1, 0), new types.Range(1, 0, 1, 0))];
                return [root];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeDocumentSymbolProvider', model.uri).then(values => {
                assert.strictEqual(values.length, 2);
                const [first, second] = values;
                assert.strictEqual(first instanceof types.SymbolInformation, true);
                assert.strictEqual(first instanceof types.DocumentSymbol, false);
                assert.strictEqual(second instanceof types.SymbolInformation, true);
                assert.strictEqual(first.name, 'DocumentSymbol');
                assert.strictEqual(first.children.length, 1);
                assert.strictEqual(second.name, 'SymbolInformation');
            });
        });
    });
    // --- suggest
    testApiCmd('triggerCharacter is null when completion provider is called programmatically #159914', async function () {
        let actualContext;
        disposables.push(extHost.registerCompletionItemProvider(nullExtensionDescription, defaultSelector, {
            provideCompletionItems(_doc, _pos, _tok, context) {
                actualContext = context;
                return [];
            }
        }, []));
        await rpcProtocol.sync();
        await commands.executeCommand('vscode.executeCompletionItemProvider', model.uri, new types.Position(0, 4));
        assert.ok(actualContext);
        assert.deepStrictEqual(actualContext, { triggerKind: types.CompletionTriggerKind.Invoke, triggerCharacter: undefined });
    });
    testApiCmd('Suggest, back and forth', async function () {
        disposables.push(extHost.registerCompletionItemProvider(nullExtensionDescription, defaultSelector, {
            provideCompletionItems() {
                const a = new types.CompletionItem('item1');
                a.documentation = new types.MarkdownString('hello_md_string');
                const b = new types.CompletionItem('item2');
                b.textEdit = types.TextEdit.replace(new types.Range(0, 4, 0, 8), 'foo'); // overwite after
                const c = new types.CompletionItem('item3');
                c.textEdit = types.TextEdit.replace(new types.Range(0, 1, 0, 6), 'foobar'); // overwite before & after
                // snippet string!
                const d = new types.CompletionItem('item4');
                d.range = new types.Range(0, 1, 0, 4); // overwite before
                d.insertText = new types.SnippetString('foo$0bar');
                return [a, b, c, d];
            }
        }, []));
        await rpcProtocol.sync();
        const list = await commands.executeCommand('vscode.executeCompletionItemProvider', model.uri, new types.Position(0, 4));
        assert.ok(list instanceof types.CompletionList);
        const values = list.items;
        assert.ok(Array.isArray(values));
        assert.strictEqual(values.length, 4);
        const [first, second, third, fourth] = values;
        assert.strictEqual(first.label, 'item1');
        assert.strictEqual(first.textEdit, undefined); // no text edit, default ranges
        assert.ok(!types.Range.isRange(first.range));
        assert.strictEqual(first.documentation.value, 'hello_md_string');
        assert.strictEqual(second.label, 'item2');
        assert.strictEqual(second.textEdit.newText, 'foo');
        assert.strictEqual(second.textEdit.range.start.line, 0);
        assert.strictEqual(second.textEdit.range.start.character, 4);
        assert.strictEqual(second.textEdit.range.end.line, 0);
        assert.strictEqual(second.textEdit.range.end.character, 8);
        assert.strictEqual(third.label, 'item3');
        assert.strictEqual(third.textEdit.newText, 'foobar');
        assert.strictEqual(third.textEdit.range.start.line, 0);
        assert.strictEqual(third.textEdit.range.start.character, 1);
        assert.strictEqual(third.textEdit.range.end.line, 0);
        assert.strictEqual(third.textEdit.range.end.character, 6);
        assert.strictEqual(fourth.label, 'item4');
        assert.strictEqual(fourth.textEdit, undefined);
        const range = fourth.range;
        assert.ok(types.Range.isRange(range));
        assert.strictEqual(range.start.line, 0);
        assert.strictEqual(range.start.character, 1);
        assert.strictEqual(range.end.line, 0);
        assert.strictEqual(range.end.character, 4);
        assert.ok(fourth.insertText instanceof types.SnippetString);
        assert.strictEqual(fourth.insertText.value, 'foo$0bar');
    });
    testApiCmd('Suggest, return CompletionList !array', async function () {
        disposables.push(extHost.registerCompletionItemProvider(nullExtensionDescription, defaultSelector, {
            provideCompletionItems() {
                const a = new types.CompletionItem('item1');
                const b = new types.CompletionItem('item2');
                // eslint-disable-next-line local/code-no-any-casts
                return new types.CompletionList([a, b], true);
            }
        }, []));
        await rpcProtocol.sync();
        const list = await commands.executeCommand('vscode.executeCompletionItemProvider', model.uri, new types.Position(0, 4));
        assert.ok(list instanceof types.CompletionList);
        assert.strictEqual(list.isIncomplete, true);
    });
    testApiCmd('Suggest, resolve completion items', async function () {
        let resolveCount = 0;
        disposables.push(extHost.registerCompletionItemProvider(nullExtensionDescription, defaultSelector, {
            provideCompletionItems() {
                const a = new types.CompletionItem('item1');
                const b = new types.CompletionItem('item2');
                const c = new types.CompletionItem('item3');
                const d = new types.CompletionItem('item4');
                return new types.CompletionList([a, b, c, d], false);
            },
            resolveCompletionItem(item) {
                resolveCount += 1;
                return item;
            }
        }, []));
        await rpcProtocol.sync();
        const list = await commands.executeCommand('vscode.executeCompletionItemProvider', model.uri, new types.Position(0, 4), undefined, 2 // maxItemsToResolve
        );
        assert.ok(list instanceof types.CompletionList);
        assert.strictEqual(resolveCount, 2);
    });
    testApiCmd('"vscode.executeCompletionItemProvider" doesnot return a preselect field #53749', async function () {
        disposables.push(extHost.registerCompletionItemProvider(nullExtensionDescription, defaultSelector, {
            provideCompletionItems() {
                const a = new types.CompletionItem('item1');
                a.preselect = true;
                const b = new types.CompletionItem('item2');
                const c = new types.CompletionItem('item3');
                c.preselect = true;
                const d = new types.CompletionItem('item4');
                return new types.CompletionList([a, b, c, d], false);
            }
        }, []));
        await rpcProtocol.sync();
        const list = await commands.executeCommand('vscode.executeCompletionItemProvider', model.uri, new types.Position(0, 4), undefined);
        assert.ok(list instanceof types.CompletionList);
        assert.strictEqual(list.items.length, 4);
        const [a, b, c, d] = list.items;
        assert.strictEqual(a.preselect, true);
        assert.strictEqual(b.preselect, undefined);
        assert.strictEqual(c.preselect, true);
        assert.strictEqual(d.preselect, undefined);
    });
    testApiCmd('executeCompletionItemProvider doesn\'t capture commitCharacters #58228', async function () {
        disposables.push(extHost.registerCompletionItemProvider(nullExtensionDescription, defaultSelector, {
            provideCompletionItems() {
                const a = new types.CompletionItem('item1');
                a.commitCharacters = ['a', 'b'];
                const b = new types.CompletionItem('item2');
                return new types.CompletionList([a, b], false);
            }
        }, []));
        await rpcProtocol.sync();
        const list = await commands.executeCommand('vscode.executeCompletionItemProvider', model.uri, new types.Position(0, 4), undefined);
        assert.ok(list instanceof types.CompletionList);
        assert.strictEqual(list.items.length, 2);
        const [a, b] = list.items;
        assert.deepStrictEqual(a.commitCharacters, ['a', 'b']);
        assert.strictEqual(b.commitCharacters, undefined);
    });
    testApiCmd('vscode.executeCompletionItemProvider returns the wrong CompletionItemKinds in insiders #95715', async function () {
        disposables.push(extHost.registerCompletionItemProvider(nullExtensionDescription, defaultSelector, {
            provideCompletionItems() {
                return [
                    new types.CompletionItem('My Method', types.CompletionItemKind.Method),
                    new types.CompletionItem('My Property', types.CompletionItemKind.Property),
                ];
            }
        }, []));
        await rpcProtocol.sync();
        const list = await commands.executeCommand('vscode.executeCompletionItemProvider', model.uri, new types.Position(0, 4), undefined);
        assert.ok(list instanceof types.CompletionList);
        assert.strictEqual(list.items.length, 2);
        const [a, b] = list.items;
        assert.strictEqual(a.kind, types.CompletionItemKind.Method);
        assert.strictEqual(b.kind, types.CompletionItemKind.Property);
    });
    // --- signatureHelp
    test('Parameter Hints, back and forth', async () => {
        disposables.push(extHost.registerSignatureHelpProvider(nullExtensionDescription, defaultSelector, new class {
            provideSignatureHelp(_document, _position, _token, context) {
                return {
                    activeSignature: 0,
                    activeParameter: 1,
                    signatures: [
                        {
                            label: 'abc',
                            documentation: `${context.triggerKind === 1 /* vscode.SignatureHelpTriggerKind.Invoke */ ? 'invoked' : 'unknown'} ${context.triggerCharacter}`,
                            parameters: []
                        }
                    ]
                };
            }
        }, []));
        await rpcProtocol.sync();
        const firstValue = await commands.executeCommand('vscode.executeSignatureHelpProvider', model.uri, new types.Position(0, 1), ',');
        assert.strictEqual(firstValue.activeSignature, 0);
        assert.strictEqual(firstValue.activeParameter, 1);
        assert.strictEqual(firstValue.signatures.length, 1);
        assert.strictEqual(firstValue.signatures[0].label, 'abc');
        assert.strictEqual(firstValue.signatures[0].documentation, 'invoked ,');
    });
    // --- quickfix
    testApiCmd('QuickFix, back and forth', function () {
        disposables.push(extHost.registerCodeActionProvider(nullExtensionDescription, defaultSelector, {
            provideCodeActions() {
                return [{ command: 'testing', title: 'Title', arguments: [1, 2, true] }];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeCodeActionProvider', model.uri, new types.Range(0, 0, 1, 1)).then(value => {
                assert.strictEqual(value.length, 1);
                const [first] = value;
                assert.strictEqual(first.title, 'Title');
                assert.strictEqual(first.command, 'testing');
                assert.deepStrictEqual(first.arguments, [1, 2, true]);
            });
        });
    });
    testApiCmd('vscode.executeCodeActionProvider results seem to be missing their `command` property #45124', function () {
        disposables.push(extHost.registerCodeActionProvider(nullExtensionDescription, defaultSelector, {
            provideCodeActions(document, range) {
                return [{
                        command: {
                            arguments: [document, range],
                            command: 'command',
                            title: 'command_title',
                        },
                        kind: types.CodeActionKind.Empty.append('foo'),
                        title: 'title',
                    }];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeCodeActionProvider', model.uri, new types.Range(0, 0, 1, 1)).then(value => {
                assert.strictEqual(value.length, 1);
                const [first] = value;
                assert.ok(first.command);
                assert.strictEqual(first.command.command, 'command');
                assert.strictEqual(first.command.title, 'command_title');
                assert.strictEqual(first.kind.value, 'foo');
                assert.strictEqual(first.title, 'title');
            });
        });
    });
    testApiCmd('vscode.executeCodeActionProvider passes Range to provider although Selection is passed in #77997', function () {
        disposables.push(extHost.registerCodeActionProvider(nullExtensionDescription, defaultSelector, {
            provideCodeActions(document, rangeOrSelection) {
                return [{
                        command: {
                            arguments: [document, rangeOrSelection],
                            command: 'command',
                            title: 'command_title',
                        },
                        kind: types.CodeActionKind.Empty.append('foo'),
                        title: 'title',
                    }];
            }
        }));
        const selection = new types.Selection(0, 0, 1, 1);
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeCodeActionProvider', model.uri, selection).then(value => {
                assert.strictEqual(value.length, 1);
                const [first] = value;
                assert.ok(first.command);
                assert.ok(first.command.arguments[1] instanceof types.Selection);
                assert.ok(first.command.arguments[1].isEqual(selection));
            });
        });
    });
    testApiCmd('vscode.executeCodeActionProvider results seem to be missing their `isPreferred` property #78098', function () {
        disposables.push(extHost.registerCodeActionProvider(nullExtensionDescription, defaultSelector, {
            provideCodeActions(document, rangeOrSelection) {
                return [{
                        command: {
                            arguments: [document, rangeOrSelection],
                            command: 'command',
                            title: 'command_title',
                        },
                        kind: types.CodeActionKind.Empty.append('foo'),
                        title: 'title',
                        isPreferred: true
                    }];
            }
        }));
        const selection = new types.Selection(0, 0, 1, 1);
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeCodeActionProvider', model.uri, selection).then(value => {
                assert.strictEqual(value.length, 1);
                const [first] = value;
                assert.strictEqual(first.isPreferred, true);
            });
        });
    });
    testApiCmd('resolving code action', async function () {
        let didCallResolve = 0;
        class MyAction extends types.CodeAction {
        }
        disposables.push(extHost.registerCodeActionProvider(nullExtensionDescription, defaultSelector, {
            provideCodeActions(document, rangeOrSelection) {
                return [new MyAction('title', types.CodeActionKind.Empty.append('foo'))];
            },
            resolveCodeAction(action) {
                assert.ok(action instanceof MyAction);
                didCallResolve += 1;
                action.title = 'resolved title';
                action.edit = new types.WorkspaceEdit();
                return action;
            }
        }));
        const selection = new types.Selection(0, 0, 1, 1);
        await rpcProtocol.sync();
        const value = await commands.executeCommand('vscode.executeCodeActionProvider', model.uri, selection, undefined, 1000);
        assert.strictEqual(didCallResolve, 1);
        assert.strictEqual(value.length, 1);
        const [first] = value;
        assert.strictEqual(first.title, 'title'); // does NOT change
        assert.ok(first.edit); // is set
    });
    // --- code lens
    testApiCmd('CodeLens, back and forth', function () {
        const complexArg = {
            foo() { },
            bar() { },
            big: extHost
        };
        disposables.push(extHost.registerCodeLensProvider(nullExtensionDescription, defaultSelector, {
            provideCodeLenses() {
                return [new types.CodeLens(new types.Range(0, 0, 1, 1), { title: 'Title', command: 'cmd', arguments: [1, true, complexArg] })];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeCodeLensProvider', model.uri).then(value => {
                assert.strictEqual(value.length, 1);
                const [first] = value;
                assert.strictEqual(first.command.title, 'Title');
                assert.strictEqual(first.command.command, 'cmd');
                assert.strictEqual(first.command.arguments[0], 1);
                assert.strictEqual(first.command.arguments[1], true);
                assert.strictEqual(first.command.arguments[2], complexArg);
            });
        });
    });
    testApiCmd('CodeLens, resolve', async function () {
        let resolveCount = 0;
        disposables.push(extHost.registerCodeLensProvider(nullExtensionDescription, defaultSelector, {
            provideCodeLenses() {
                return [
                    new types.CodeLens(new types.Range(0, 0, 1, 1)),
                    new types.CodeLens(new types.Range(0, 0, 1, 1)),
                    new types.CodeLens(new types.Range(0, 0, 1, 1)),
                    new types.CodeLens(new types.Range(0, 0, 1, 1), { title: 'Already resolved', command: 'fff' })
                ];
            },
            resolveCodeLens(codeLens) {
                codeLens.command = { title: resolveCount.toString(), command: 'resolved' };
                resolveCount += 1;
                return codeLens;
            }
        }));
        await rpcProtocol.sync();
        let value = await commands.executeCommand('vscode.executeCodeLensProvider', model.uri, 2);
        assert.strictEqual(value.length, 3); // the resolve argument defines the number of results being returned
        assert.strictEqual(resolveCount, 2);
        resolveCount = 0;
        value = await commands.executeCommand('vscode.executeCodeLensProvider', model.uri);
        assert.strictEqual(value.length, 4);
        assert.strictEqual(resolveCount, 0);
    });
    testApiCmd('Links, back and forth', function () {
        disposables.push(extHost.registerDocumentLinkProvider(nullExtensionDescription, defaultSelector, {
            provideDocumentLinks() {
                return [new types.DocumentLink(new types.Range(0, 0, 0, 20), URI.parse('foo:bar'))];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeLinkProvider', model.uri).then(value => {
                assert.strictEqual(value.length, 1);
                const [first] = value;
                assert.strictEqual(first.target + '', 'foo:bar');
                assert.strictEqual(first.range.start.line, 0);
                assert.strictEqual(first.range.start.character, 0);
                assert.strictEqual(first.range.end.line, 0);
                assert.strictEqual(first.range.end.character, 20);
            });
        });
    });
    testApiCmd('What\'s the condition for DocumentLink target to be undefined? #106308', async function () {
        disposables.push(extHost.registerDocumentLinkProvider(nullExtensionDescription, defaultSelector, {
            provideDocumentLinks() {
                return [new types.DocumentLink(new types.Range(0, 0, 0, 20), undefined)];
            },
            resolveDocumentLink(link) {
                link.target = URI.parse('foo:bar');
                return link;
            }
        }));
        await rpcProtocol.sync();
        const links1 = await commands.executeCommand('vscode.executeLinkProvider', model.uri);
        assert.strictEqual(links1.length, 1);
        assert.strictEqual(links1[0].target, undefined);
        const links2 = await commands.executeCommand('vscode.executeLinkProvider', model.uri, 1000);
        assert.strictEqual(links2.length, 1);
        assert.strictEqual(links2[0].target.toString(), URI.parse('foo:bar').toString());
    });
    testApiCmd('DocumentLink[] vscode.executeLinkProvider returns lack tooltip #213970', async function () {
        disposables.push(extHost.registerDocumentLinkProvider(nullExtensionDescription, defaultSelector, {
            provideDocumentLinks() {
                const link = new types.DocumentLink(new types.Range(0, 0, 0, 20), URI.parse('foo:bar'));
                link.tooltip = 'Link Tooltip';
                return [link];
            }
        }));
        await rpcProtocol.sync();
        const links1 = await commands.executeCommand('vscode.executeLinkProvider', model.uri);
        assert.strictEqual(links1.length, 1);
        assert.strictEqual(links1[0].tooltip, 'Link Tooltip');
    });
    test('Color provider', function () {
        disposables.push(extHost.registerColorProvider(nullExtensionDescription, defaultSelector, {
            provideDocumentColors() {
                return [new types.ColorInformation(new types.Range(0, 0, 0, 20), new types.Color(0.1, 0.2, 0.3, 0.4))];
            },
            provideColorPresentations() {
                const cp = new types.ColorPresentation('#ABC');
                cp.textEdit = types.TextEdit.replace(new types.Range(1, 0, 1, 20), '#ABC');
                cp.additionalTextEdits = [types.TextEdit.insert(new types.Position(2, 20), '*')];
                return [cp];
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeDocumentColorProvider', model.uri).then(value => {
                assert.strictEqual(value.length, 1);
                const [first] = value;
                assert.strictEqual(first.color.red, 0.1);
                assert.strictEqual(first.color.green, 0.2);
                assert.strictEqual(first.color.blue, 0.3);
                assert.strictEqual(first.color.alpha, 0.4);
                assert.strictEqual(first.range.start.line, 0);
                assert.strictEqual(first.range.start.character, 0);
                assert.strictEqual(first.range.end.line, 0);
                assert.strictEqual(first.range.end.character, 20);
            });
        }).then(() => {
            const color = new types.Color(0.5, 0.6, 0.7, 0.8);
            const range = new types.Range(0, 0, 0, 20);
            return commands.executeCommand('vscode.executeColorPresentationProvider', color, { uri: model.uri, range }).then(value => {
                assert.strictEqual(value.length, 1);
                const [first] = value;
                assert.strictEqual(first.label, '#ABC');
                assert.strictEqual(first.textEdit.newText, '#ABC');
                assert.strictEqual(first.textEdit.range.start.line, 1);
                assert.strictEqual(first.textEdit.range.start.character, 0);
                assert.strictEqual(first.textEdit.range.end.line, 1);
                assert.strictEqual(first.textEdit.range.end.character, 20);
                assert.strictEqual(first.additionalTextEdits.length, 1);
                assert.strictEqual(first.additionalTextEdits[0].range.start.line, 2);
                assert.strictEqual(first.additionalTextEdits[0].range.start.character, 20);
                assert.strictEqual(first.additionalTextEdits[0].range.end.line, 2);
                assert.strictEqual(first.additionalTextEdits[0].range.end.character, 20);
            });
        });
    });
    test('"TypeError: e.onCancellationRequested is not a function" calling hover provider in Insiders #54174', function () {
        disposables.push(extHost.registerHoverProvider(nullExtensionDescription, defaultSelector, {
            provideHover() {
                return new types.Hover('fofofofo');
            }
        }));
        return rpcProtocol.sync().then(() => {
            return commands.executeCommand('vscode.executeHoverProvider', model.uri, new types.Position(1, 1)).then(value => {
                assert.strictEqual(value.length, 1);
                assert.strictEqual(value[0].contents.length, 1);
            });
        });
    });
    // --- inline hints
    testApiCmd('Inlay Hints, back and forth', async function () {
        disposables.push(extHost.registerInlayHintsProvider(nullExtensionDescription, defaultSelector, {
            provideInlayHints() {
                return [new types.InlayHint(new types.Position(0, 1), 'Foo')];
            }
        }));
        await rpcProtocol.sync();
        const value = await commands.executeCommand('vscode.executeInlayHintProvider', model.uri, new types.Range(0, 0, 20, 20));
        assert.strictEqual(value.length, 1);
        const [first] = value;
        assert.strictEqual(first.label, 'Foo');
        assert.strictEqual(first.position.line, 0);
        assert.strictEqual(first.position.character, 1);
    });
    testApiCmd('Inline Hints, merge', async function () {
        disposables.push(extHost.registerInlayHintsProvider(nullExtensionDescription, defaultSelector, {
            provideInlayHints() {
                const part = new types.InlayHintLabelPart('Bar');
                part.tooltip = 'part_tooltip';
                part.command = { command: 'cmd', title: 'part' };
                const hint = new types.InlayHint(new types.Position(10, 11), [part]);
                hint.tooltip = 'hint_tooltip';
                hint.paddingLeft = true;
                hint.paddingRight = false;
                return [hint];
            }
        }));
        disposables.push(extHost.registerInlayHintsProvider(nullExtensionDescription, defaultSelector, {
            provideInlayHints() {
                const hint = new types.InlayHint(new types.Position(0, 1), 'Foo', types.InlayHintKind.Parameter);
                hint.textEdits = [types.TextEdit.insert(new types.Position(0, 0), 'Hello')];
                return [hint];
            }
        }));
        await rpcProtocol.sync();
        const value = await commands.executeCommand('vscode.executeInlayHintProvider', model.uri, new types.Range(0, 0, 20, 20));
        assert.strictEqual(value.length, 2);
        const [first, second] = value;
        assert.strictEqual(first.label, 'Foo');
        assert.strictEqual(first.position.line, 0);
        assert.strictEqual(first.position.character, 1);
        assert.strictEqual(first.textEdits?.length, 1);
        assert.strictEqual(first.textEdits[0].newText, 'Hello');
        assert.strictEqual(second.position.line, 10);
        assert.strictEqual(second.position.character, 11);
        assert.strictEqual(second.paddingLeft, true);
        assert.strictEqual(second.paddingRight, false);
        assert.strictEqual(second.tooltip, 'hint_tooltip');
        const label = second.label[0];
        assertType(label instanceof types.InlayHintLabelPart);
        assert.strictEqual(label.value, 'Bar');
        assert.strictEqual(label.tooltip, 'part_tooltip');
        assert.strictEqual(label.command?.command, 'cmd');
        assert.strictEqual(label.command?.title, 'part');
    });
    testApiCmd('Inline Hints, bad provider', async function () {
        disposables.push(extHost.registerInlayHintsProvider(nullExtensionDescription, defaultSelector, {
            provideInlayHints() {
                return [new types.InlayHint(new types.Position(0, 1), 'Foo')];
            }
        }));
        disposables.push(extHost.registerInlayHintsProvider(nullExtensionDescription, defaultSelector, {
            provideInlayHints() {
                throw new Error();
            }
        }));
        await rpcProtocol.sync();
        const value = await commands.executeCommand('vscode.executeInlayHintProvider', model.uri, new types.Range(0, 0, 20, 20));
        assert.strictEqual(value.length, 1);
        const [first] = value;
        assert.strictEqual(first.label, 'Foo');
        assert.strictEqual(first.position.line, 0);
        assert.strictEqual(first.position.character, 1);
    });
    // --- selection ranges
    test('Selection Range, back and forth', async function () {
        disposables.push(extHost.registerSelectionRangeProvider(nullExtensionDescription, defaultSelector, {
            provideSelectionRanges() {
                return [
                    new types.SelectionRange(new types.Range(0, 10, 0, 18), new types.SelectionRange(new types.Range(0, 2, 0, 20))),
                ];
            }
        }));
        await rpcProtocol.sync();
        const value = await commands.executeCommand('vscode.executeSelectionRangeProvider', model.uri, [new types.Position(0, 10)]);
        assert.strictEqual(value.length, 1);
        assert.ok(value[0].parent);
    });
    // --- call hierarchy
    test('CallHierarchy, back and forth', async function () {
        disposables.push(extHost.registerCallHierarchyProvider(nullExtensionDescription, defaultSelector, new class {
            prepareCallHierarchy(document, position) {
                return new types.CallHierarchyItem(types.SymbolKind.Constant, 'ROOT', 'ROOT', document.uri, new types.Range(0, 0, 0, 0), new types.Range(0, 0, 0, 0));
            }
            provideCallHierarchyIncomingCalls(item, token) {
                return [new types.CallHierarchyIncomingCall(new types.CallHierarchyItem(types.SymbolKind.Constant, 'INCOMING', 'INCOMING', item.uri, new types.Range(0, 0, 0, 0), new types.Range(0, 0, 0, 0)), [new types.Range(0, 0, 0, 0)])];
            }
            provideCallHierarchyOutgoingCalls(item, token) {
                return [new types.CallHierarchyOutgoingCall(new types.CallHierarchyItem(types.SymbolKind.Constant, 'OUTGOING', 'OUTGOING', item.uri, new types.Range(0, 0, 0, 0), new types.Range(0, 0, 0, 0)), [new types.Range(0, 0, 0, 0)])];
            }
        }));
        await rpcProtocol.sync();
        const root = await commands.executeCommand('vscode.prepareCallHierarchy', model.uri, new types.Position(0, 0));
        assert.ok(Array.isArray(root));
        assert.strictEqual(root.length, 1);
        assert.strictEqual(root[0].name, 'ROOT');
        const incoming = await commands.executeCommand('vscode.provideIncomingCalls', root[0]);
        assert.strictEqual(incoming.length, 1);
        assert.strictEqual(incoming[0].from.name, 'INCOMING');
        const outgoing = await commands.executeCommand('vscode.provideOutgoingCalls', root[0]);
        assert.strictEqual(outgoing.length, 1);
        assert.strictEqual(outgoing[0].to.name, 'OUTGOING');
    });
    test('prepareCallHierarchy throws TypeError if clangd returns empty result #137415', async function () {
        disposables.push(extHost.registerCallHierarchyProvider(nullExtensionDescription, defaultSelector, new class {
            prepareCallHierarchy(document, position) {
                return [];
            }
            provideCallHierarchyIncomingCalls(item, token) {
                return [];
            }
            provideCallHierarchyOutgoingCalls(item, token) {
                return [];
            }
        }));
        await rpcProtocol.sync();
        const root = await commands.executeCommand('vscode.prepareCallHierarchy', model.uri, new types.Position(0, 0));
        assert.ok(Array.isArray(root));
        assert.strictEqual(root.length, 0);
    });
    // --- type hierarchy
    test('TypeHierarchy, back and forth', async function () {
        disposables.push(extHost.registerTypeHierarchyProvider(nullExtensionDescription, defaultSelector, new class {
            prepareTypeHierarchy(document, position, token) {
                return [new types.TypeHierarchyItem(types.SymbolKind.Constant, 'ROOT', 'ROOT', document.uri, new types.Range(0, 0, 0, 0), new types.Range(0, 0, 0, 0))];
            }
            provideTypeHierarchySupertypes(item, token) {
                return [new types.TypeHierarchyItem(types.SymbolKind.Constant, 'SUPER', 'SUPER', item.uri, new types.Range(0, 0, 0, 0), new types.Range(0, 0, 0, 0))];
            }
            provideTypeHierarchySubtypes(item, token) {
                return [new types.TypeHierarchyItem(types.SymbolKind.Constant, 'SUB', 'SUB', item.uri, new types.Range(0, 0, 0, 0), new types.Range(0, 0, 0, 0))];
            }
        }));
        await rpcProtocol.sync();
        const root = await commands.executeCommand('vscode.prepareTypeHierarchy', model.uri, new types.Position(0, 0));
        assert.ok(Array.isArray(root));
        assert.strictEqual(root.length, 1);
        assert.strictEqual(root[0].name, 'ROOT');
        const incoming = await commands.executeCommand('vscode.provideSupertypes', root[0]);
        assert.strictEqual(incoming.length, 1);
        assert.strictEqual(incoming[0].name, 'SUPER');
        const outgoing = await commands.executeCommand('vscode.provideSubtypes', root[0]);
        assert.strictEqual(outgoing.length, 1);
        assert.strictEqual(outgoing[0].name, 'SUB');
    });
    test('selectionRangeProvider on inner array always returns outer array #91852', async function () {
        disposables.push(extHost.registerSelectionRangeProvider(nullExtensionDescription, defaultSelector, {
            provideSelectionRanges(_doc, positions) {
                const [first] = positions;
                return [
                    new types.SelectionRange(new types.Range(first.line, first.character, first.line, first.character)),
                ];
            }
        }));
        await rpcProtocol.sync();
        const value = await commands.executeCommand('vscode.executeSelectionRangeProvider', model.uri, [new types.Position(0, 10)]);
        assert.strictEqual(value.length, 1);
        assert.strictEqual(value[0].range.start.line, 0);
        assert.strictEqual(value[0].range.start.character, 10);
        assert.strictEqual(value[0].range.end.line, 0);
        assert.strictEqual(value[0].range.end.character, 10);
    });
    test('more element test of selectionRangeProvider on inner array always returns outer array #91852', async function () {
        disposables.push(extHost.registerSelectionRangeProvider(nullExtensionDescription, defaultSelector, {
            provideSelectionRanges(_doc, positions) {
                const [first, second] = positions;
                return [
                    new types.SelectionRange(new types.Range(first.line, first.character, first.line, first.character)),
                    new types.SelectionRange(new types.Range(second.line, second.character, second.line, second.character)),
                ];
            }
        }));
        await rpcProtocol.sync();
        const value = await commands.executeCommand('vscode.executeSelectionRangeProvider', model.uri, [new types.Position(0, 0), new types.Position(0, 10)]);
        assert.strictEqual(value.length, 2);
        assert.strictEqual(value[0].range.start.line, 0);
        assert.strictEqual(value[0].range.start.character, 0);
        assert.strictEqual(value[0].range.end.line, 0);
        assert.strictEqual(value[0].range.end.character, 0);
        assert.strictEqual(value[1].range.start.line, 0);
        assert.strictEqual(value[1].range.start.character, 10);
        assert.strictEqual(value[1].range.end.line, 0);
        assert.strictEqual(value[1].range.end.character, 10);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdEFwaUNvbW1hbmRzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS90ZXN0L2Jyb3dzZXIvZXh0SG9zdEFwaUNvbW1hbmRzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyw2REFBNkQsQ0FBQztBQUNyRSxPQUFPLHlEQUF5RCxDQUFDO0FBQ2pFLE9BQU8sMkVBQTJFLENBQUM7QUFDbkYsT0FBTyxxREFBcUQsQ0FBQztBQUM3RCxPQUFPLCtEQUErRCxDQUFDO0FBQ3ZFLE9BQU8sdUVBQXVFLENBQUM7QUFDL0UsT0FBTyxzREFBc0QsQ0FBQztBQUM5RCxPQUFPLHNEQUFzRCxDQUFDO0FBQzlELE9BQU8sMkVBQTJFLENBQUM7QUFDbkYsT0FBTywrREFBK0QsQ0FBQztBQUN2RSxPQUFPLHVEQUF1RCxDQUFDO0FBQy9ELE9BQU8scURBQXFELENBQUM7QUFDN0QsT0FBTyx1RUFBdUUsQ0FBQztBQUUvRSxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLHlCQUF5QixFQUFFLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzVGLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekQsT0FBTyxLQUFLLEtBQUssTUFBTSw4QkFBOEIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0saURBQWlELENBQUM7QUFDbEYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQy9ELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNyRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDaEYsT0FBTyxFQUFF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RUFBRSxDQUFDLENBQUMsQ0FBQztRQUN4RCxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFTLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDN0QsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsUUFBUyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3RELE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMzRCxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDMUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQy9DLE1BQU0sS0FBSyxHQUFRLE1BQU0sQ0FBQyxLQUFNLENBQUM7UUFDakMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ3RDLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDeEMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM3QyxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3RDLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDM0MsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsVUFBVSxZQUFZLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUM1RCxNQUFNLENB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Q0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNwRCxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNqRCxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUN2RCxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMvQyxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN0RCxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIn0=