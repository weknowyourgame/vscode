/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { TextFileEditorModel } from '../../common/textFileEditorModel.js';
import { snapshotToString, isTextFileEditorModel } from '../../common/textfiles.js';
import { createFileEditorInput, workbenchInstantiationService, TestServiceAccessor, TestReadonlyTextFileEditorModel, getLastResolvedFileStat } from '../../../../test/browser/workbenchTestServices.js';
import { assertThrowsAsync, ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { FileOperationError, NotModifiedSinceFileOperationError } from '../../../../../platform/files/common/files.js';
import { DeferredPromise, timeout } from '../../../../../base/common/async.js';
import { assertReturnsDefined } from '../../../../../base/common/types.js';
import { createTextBufferFactory } from '../../../../../editor/common/model/textModel.js';
import { DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { SaveSourceRegistry } from '../../../../common/editor.js';
import { isEqual } from '../../../../../base/common/resources.js';
import { UTF16be } from '../../common/encoding.js';
import { isWeb } from '../../../../../base/common/platform.js';
import { URI } from '../../../../../base/common/uri.js';
suite('Files - TextFileEditorModel', () => {
    function getLastModifiedTime(model) {
        const stat = getLastResolvedFileStat(model);
        return stat ? stat.mtime : -1;
    }
    const disposables = new DisposableStore();
    let instantiationService;
    let accessor;
    let content;
    setup(() => {
        instantiationService = workbenchInstantiationService(undefined, disposables);
        accessor = instantiationService.createInstance(TestServiceAccessor);
        content = accessor.fileService.getContent();
        disposables.add(accessor.textFileService.files);
        disposables.add(toDisposable(() => accessor.fileService.setContent(content)));
    });
    teardown(async () => {
        for (const textFileEditorModel of accessor.textFileService.files.models) {
            textFileEditorModel.dispose();
        }
        disposables.clear();
    });
    test('basic events', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        accessor.workingCopyService.testUnregisterWorkingCopy(model); // causes issues with subsequent resolves otherwise
        let onDidResolveCounter = 0;
        disposables.add(model.onDidResolve(() => onDidResolveCounter++));
        await model.resolve();
        assert.strictEqual(onDidResolveCounter, 1);
        let onDidChangeContentCounter = 0;
        disposables.add(model.onDidChangeContent(() => onDidChangeContentCounter++));
        let onDidChangeDirtyCounter = 0;
        disposables.add(model.onDidChangeDirty(() => onDidChangeDirtyCounter++));
        model.updateTextEditorModel(createTextBufferFactory('bar'));
        assert.strictEqual(onDidChangeContentCounter, 1);
        assert.strictEqual(onDidChangeDirtyCounter, 1);
        model.updateTextEditorModel(createTextBufferFactory('foo'));
        assert.strictEqual(onDidChangeContentCounter, 2);
        assert.strictEqual(onDidChangeDirtyCounter, 1);
        await model.revert();
        assert.strictEqual(onDidChangeDirtyCounter, 2);
    });
    test('isTextFileEditorModel', async function () {
        const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined);
        assert.strictEqual(isTextFileEditorModel(model), true);
        model.dispose();
    });
    test('save', async function () {
        const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined);
        await model.resolve();
        assert.strictEqual(accessor.workingCopyService.dirtyCount, 0);
        let savedEvent = undefined;
        disposables.add(model.onDidSave(e => savedEvent = e));
        await model.save();
        assert.ok(!savedEvent);
        model.updateTextEditorModel(createTextBufferFactory('bar'));
        assert.ok(getLastModifiedTime(model) <= Date.now());
        assert.ok(model.hasState(1 /* TextFileEditorModelState.DIRTY */));
        assert.ok(model.isModified());
        assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
        assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), true);
        let workingCopyEvent = false;
        disposables.add(accessor.workingCopyService.onDidChangeDirty(e => {
            if (e.resource.toString() === model.resource.toString()) {
                workingCopyEvent = true;
            }
        }));
        const source = SaveSourceRegistry.registerSource('testSource', 'Hello Save');
        const pendingSave = model.save({ reason: 2 /* SaveReason.AUTO */, source });
        assert.ok(model.hasState(2 /* TextFileEditorModelState.PENDING_SAVE */));
        await Promise.all([pendingSave, model.joinState(2 /* TextFileEditorModelState.PENDING_SAVE */)]);
        assert.ok(model.hasState(0 /* TextFileEditorModelState.SAVED */));
        assert.ok(!model.isDirty());
        assert.ok(!model.isModified());
        assert.ok(savedEvent);
        assert.ok(savedEvent.stat);
        assert.strictEqual(savedEvent.reason, 2 /* SaveReason.AUTO */);
        assert.strictEqual(savedEvent.source, source);
        assert.ok(workingCopyEvent);
        assert.strictEqual(accessor.workingCopyService.dirtyCount, 0);
        assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), false);
        savedEvent = undefined;
        await model.save({ force: true });
        assert.ok(savedEvent);
        model.dispose();
        assert.ok(!accessor.modelService.getModel(model.resource));
    });
    test('save - touching also emits saved event', async function () {
        const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined);
        await model.resolve();
        let savedEvent = false;
        disposables.add(model.onDidSave(() => savedEvent = true));
        let workingCopyEvent = false;
        disposables.add(accessor.workingCopyService.onDidChangeDirty(e => {
            if (e.resource.toString() === model.resource.toString()) {
                workingCopyEvent = true;
            }
        }));
        await model.save({ force: true });
        assert.ok(savedEvent);
        assert.ok(!workingCopyEvent);
        model.dispose();
        assert.ok(!accessor.modelService.getModel(model.resource));
    });
    test('save - touching with error turns model dirty', async function () {
        const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined);
        await model.resolve();
        let saveErrorEvent = false;
        disposables.add(model.onDidSaveError(() => saveErrorEvent = true));
        let savedEvent = false;
        disposables.add(model.onDidSave(() => savedEvent = true));
        accessor.fileService.writeShouldThrowError = new Error('failed to write');
        try {
            await model.save({ force: true });
            assert.ok(model.hasState(5 /* TextFileEditorModelState.ERROR */));
            assert.ok(model.isDirty());
            assert.ok(model.isModified());
            assert.ok(saveErrorEvent);
            assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
            assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), true);
        }
        finally {
            accessor.fileService.writeShouldThrowError = undefined;
        }
        await model.save({ force: true });
        assert.ok(savedEvent);
        assert.strictEqual(model.isDirty(), false);
        model.dispose();
        assert.ok(!accessor.modelService.getModel(model.resource));
    });
    test('save - returns false when save fails', async function () {
        const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined);
        await model.resolve();
        accessor.fileService.writeShouldThrowError = new Error('failed to write');
        try {
            const res = await model.save({ force: true });
            assert.strictEqual(res, false);
        }
        finally {
            accessor.fileService.writeShouldThrowError = undefined;
        }
        const res = await model.save({ force: true });
        assert.strictEqual(res, true);
        model.dispose();
        assert.ok(!accessor.modelService.getModel(model.resource));
    });
    test('save error (generic)', async function () {
        const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined);
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('bar'));
        let saveErrorEvent = false;
        disposables.add(model.onDidSaveError(() => saveErrorEvent = true));
        accessor.fileService.writeShouldThrowError = new Error('failed to write');
        try {
            const pendingSave = model.save();
            assert.ok(model.hasState(2 /* TextFileEditorModelState.PENDING_SAVE */));
            await pendingSave;
            assert.ok(model.hasState(5 /* TextFileEditorModelState.ERROR */));
            assert.ok(model.isDirty());
            assert.ok(model.isModified());
            assert.ok(saveErrorEvent);
            assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
            assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), true);
            model.dispose();
        }
        finally {
            accessor.fileService.writeShouldThrowError = undefined;
        }
    });
    test('save error (conflict)', async function () {
        const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined);
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('bar'));
        let saveErrorEvent = false;
        disposables.add(model.onDidSaveError(() => saveErrorEvent = true));
        accessor.fileService.writeShouldThrowError = new FileOperationError('save conflict', 3 /* FileOperationResult.FILE_MODIFIED_SINCE */);
        try {
            const pendingSave = model.save();
            assert.ok(model.hasState(2 /* TextFileEditorModelState.PENDING_SAVE */));
            await pendingSave;
            assert.ok(model.hasState(3 /* TextFileEditorModelState.CONFLICT */));
            assert.ok(model.isDirty());
            assert.ok(model.isModified());
            assert.ok(saveErrorEvent);
            assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
            assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), true);
            model.dispose();
        }
        finally {
            accessor.fileService.writeShouldThrowError = undefined;
        }
    });
    test('setEncoding - encode', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        let encodingEvent = false;
        disposables.add(model.onDidChangeEncoding(() => encodingEvent = true));
        await model.setEncoding('utf8', 0 /* EncodingMode.Encode */); // no-op
        assert.strictEqual(getLastModifiedTime(model), -1);
        assert.ok(!encodingEvent);
        await model.setEncoding('utf16', 0 /* EncodingMode.Encode */);
        assert.ok(encodingEvent);
        assert.ok(getLastModifiedTime(model) <= Date.now()); // indicates model was saved due to encoding change
    });
    test('setEncoding - decode', async function () {
        let model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        accessor.workingCopyService.testUnregisterWorkingCopy(model); // causes issues with subsequent resolves otherwise
        await model.setEncoding('utf16', 1 /* EncodingMode.Decode */);
        // we have to get the model again from working copy service
        // because `setEncoding` will resolve it again through the
        // text file service which is outside our scope
        model = accessor.workingCopyService.get(model);
        assert.ok(model.isResolved()); // model got resolved due to decoding
    });
    test('setEncoding - decode dirty file throws', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        accessor.workingCopyService.testUnregisterWorkingCopy(model); // causes issues with subsequent resolves otherwise
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('bar'));
        assert.strictEqual(model.isDirty(), true);
        assertThrowsAsync(() => model.setEncoding('utf16', 1 /* EncodingMode.Decode */));
    });
    test('encoding updates with language based configuration', async function () {
        const languageId = 'text-file-model-test';
        disposables.add(accessor.languageService.registerLanguage({
            id: languageId,
        }));
        accessor.testConfigurationService.setOverrideIdentifiers('files.encoding', [languageId]);
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        accessor.workingCopyService.testUnregisterWorkingCopy(model); // causes issues with subsequent resolves otherwise
        await model.resolve();
        const deferredPromise = new DeferredPromise();
        // We use this listener as a way to figure out that the working
        // copy was resolved again as part of the language change
        disposables.add(accessor.workingCopyService.onDidRegister(e => {
            if (isEqual(e.resource, model.resource)) {
                deferredPromise.complete(model);
            }
        }));
        accessor.testConfigurationService.setUserConfiguration('files.encoding', UTF16be);
        model.setLanguageId(languageId);
        await deferredPromise.p; // this asserts that the model was reloaded due to the language change
    });
    test('create with language', async function () {
        const languageId = 'text-file-model-test';
        disposables.add(accessor.languageService.registerLanguage({
            id: languageId,
        }));
        const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', languageId);
        await model.resolve();
        assert.strictEqual(model.textEditorModel.getLanguageId(), languageId);
        model.dispose();
        assert.ok(!accessor.modelService.getModel(model.resource));
    });
    test('disposes when underlying model is destroyed', async function () {
        const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined);
        await model.resolve();
        model.textEditorModel.dispose();
        assert.ok(model.isDisposed());
    });
    test('Resolve does not trigger save', async function () {
        const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index.txt'), 'utf8', undefined);
        assert.ok(model.hasState(0 /* TextFileEditorModelState.SAVED */));
        disposables.add(model.onDidSave(() => assert.fail()));
        disposables.add(model.onDidChangeDirty(() => assert.fail()));
        await model.resolve();
        assert.ok(model.isResolved());
        model.dispose();
        assert.ok(!accessor.modelService.getModel(model.resource));
    });
    test('Resolve returns dirty model as long as model is dirty', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('foo'));
        assert.ok(model.isDirty());
        assert.ok(model.hasState(1 /* TextFileEditorModelState.DIRTY */));
        await model.resolve();
        assert.ok(model.isDirty());
    });
    test('Resolve with contents', async function () {
        const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined);
        await model.resolve({ contents: createTextBufferFactory('Hello World') });
        assert.strictEqual(model.textEditorModel?.getValue(), 'Hello World');
        assert.strictEqual(model.isDirty(), true);
        await model.resolve({ contents: createTextBufferFactory('Hello Changes') });
        assert.strictEqual(model.textEditorModel?.getValue(), 'Hello Changes');
        assert.strictEqual(model.isDirty(), true);
        // verify that we do not mark the model as saved when undoing once because
        // we never really had a saved state
        await model.textEditorModel.undo();
        assert.ok(model.isDirty());
        model.dispose();
        assert.ok(!accessor.modelService.getModel(model.resource));
    });
    test('Revert', async function () {
        let eventCounter = 0;
        let model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        disposables.add(model.onDidRevert(() => eventCounter++));
        let workingCopyEvent = false;
        disposables.add(accessor.workingCopyService.onDidChangeDirty(e => {
            if (e.resource.toString() === model.resource.toString()) {
                workingCopyEvent = true;
            }
        }));
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('foo'));
        assert.ok(model.isDirty());
        assert.ok(model.isModified());
        assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
        assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), true);
        accessor.workingCopyService.testUnregisterWorkingCopy(model); // causes issues with subsequent resolves otherwise
        await model.revert();
        // we have to get the model again from working copy service
        // because `setEncoding` will resolve it again through the
        // text file service which is outside our scope
        model = accessor.workingCopyService.get(model);
        assert.strictEqual(model.isDirty(), false);
        assert.strictEqual(model.isModified(), false);
        assert.strictEqual(eventCounter, 1);
        assert.ok(workingCopyEvent);
        assert.strictEqual(accessor.workingCopyService.dirtyCount, 0);
        assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), false);
    });
    test('Revert (soft)', async function () {
        let eventCounter = 0;
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        disposables.add(model.onDidRevert(() => eventCounter++));
        let workingCopyEvent = false;
        disposables.add(accessor.workingCopyService.onDidChangeDirty(e => {
            if (e.resource.toString() === model.resource.toString()) {
                workingCopyEvent = true;
            }
        }));
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('foo'));
        assert.ok(model.isDirty());
        assert.ok(model.isModified());
        assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
        assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), true);
        await model.revert({ soft: true });
        assert.strictEqual(model.isDirty(), false);
        assert.strictEqual(model.isModified(), false);
        assert.strictEqual(model.textEditorModel.getValue(), 'foo');
        assert.strictEqual(eventCounter, 1);
        assert.ok(workingCopyEvent);
        assert.strictEqual(accessor.workingCopyService.dirtyCount, 0);
        assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), false);
    });
    test('Undo to saved state turns model non-dirty', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('Hello Text'));
        assert.ok(model.isDirty());
        await model.textEditorModel.undo();
        assert.ok(!model.isDirty());
    });
    test('Resolve and undo turns model dirty', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        await model.resolve();
        accessor.fileService.setContent('Hello Change');
        await model.resolve();
        await model.textEditorModel.undo();
        assert.ok(model.isDirty());
        assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
        assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), true);
    });
    test('Update Dirty', async function () {
        let eventCounter = 0;
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        model.setDirty(true);
        assert.ok(!model.isDirty()); // needs to be resolved
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('foo'));
        assert.ok(model.isDirty());
        await model.revert({ soft: true });
        assert.strictEqual(model.isDirty(), false);
        disposables.add(model.onDidChangeDirty(() => eventCounter++));
        let workingCopyEvent = false;
        disposables.add(accessor.workingCopyService.onDidChangeDirty(e => {
            if (e.resource.toString() === model.resource.toString()) {
                workingCopyEvent = true;
            }
        }));
        model.setDirty(true);
        assert.ok(model.isDirty());
        assert.strictEqual(eventCounter, 1);
        assert.ok(workingCopyEvent);
        model.setDirty(false);
        assert.strictEqual(model.isDirty(), false);
        assert.strictEqual(eventCounter, 2);
    });
    test('No Dirty or saving for readonly models', async function () {
        let workingCopyEvent = false;
        disposables.add(accessor.workingCopyService.onDidChangeDirty(e => {
            if (e.resource.toString() === model.resource.toString()) {
                workingCopyEvent = true;
            }
        }));
        const model = disposables.add(instantiationService.createInstance(TestReadonlyTextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        let saveEvent = false;
        disposables.add(model.onDidSave(() => {
            saveEvent = true;
        }));
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('foo'));
        assert.ok(!model.isDirty());
        await model.save({ force: true });
        assert.strictEqual(saveEvent, false);
        await model.revert({ soft: true });
        assert.ok(!model.isDirty());
        assert.ok(!workingCopyEvent);
    });
    test('File not modified error is handled gracefully', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        await model.resolve();
        const mtime = getLastModifiedTime(model);
        accessor.textFileService.setReadStreamErrorOnce(new FileOperationError('error', 2 /* FileOperationResult.FILE_NOT_MODIFIED_SINCE */));
        await model.resolve();
        assert.ok(model);
        assert.strictEqual(getLastModifiedTime(model), mtime);
    });
    test('stat.readonly and stat.locked can change when decreased mtime is ignored', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        await model.resolve();
        const stat = assertReturnsDefined(getLastResolvedFileStat(model));
        accessor.textFileService.setReadStreamErrorOnce(new NotModifiedSinceFileOperationError('error', { ...stat, mtime: stat.mtime - 1, readonly: !stat.readonly, locked: !stat.locked }));
        await model.resolve();
        assert.ok(model);
        assert.strictEqual(getLastModifiedTime(model), stat.mtime, 'mtime should not decrease');
        assert.notStrictEqual(getLastResolvedFileStat(model)?.readonly, stat.readonly, 'readonly should have changed despite simultaneous attempt to decrease mtime');
        assert.notStrictEqual(getLastResolvedFileStat(model)?.locked, stat.locked, 'locked should have changed despite simultaneous attempt to decrease mtime');
    });
    test('Resolve error is handled gracefully if model already exists', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        await model.resolve();
        accessor.textFileService.setReadStreamErrorOnce(new FileOperationError('error', 1 /* FileOperationResult.FILE_NOT_FOUND */));
        await model.resolve();
        assert.ok(model);
    });
    test('save() and isDirty() - proper with check for mtimes', async function () {
        const input1 = disposables.add(createFileEditorInput(instantiationService, toResource.call(this, '/path/index_async2.txt')));
        const input2 = disposables.add(createFileEditorInput(instantiationService, toResource.call(this, '/path/index_async.txt')));
        const model1 = disposables.add(await input1.resolve());
        const model2 = disposables.add(await input2.resolve());
        model1.updateTextEditorModel(createTextBufferFactory('foo'));
        const m1Mtime = assertReturnsDefined(getLastResolvedFileStat(model1)).mtime;
        const m2Mtime = assertReturnsDefined(getLastResolvedFileStat(model2)).mtime;
        assert.ok(m1Mtime > 0);
        assert.ok(m2Mtime > 0);
        assert.ok(accessor.textFileService.isDirty(toResource.call(this, '/path/index_async2.txt')));
        assert.ok(!accessor.textFileService.isDirty(toResource.call(this, '/path/index_async.txt')));
        model2.updateTextEditorModel(createTextBufferFactory('foo'));
        assert.ok(accessor.textFileService.isDirty(toResource.call(this, '/path/index_async.txt')));
        await timeout(10);
        await accessor.textFileService.save(toResource.call(this, '/path/index_async.txt'));
        await accessor.textFileService.save(toResource.call(this, '/path/index_async2.txt'));
        assert.ok(!accessor.textFileService.isDirty(toResource.call(this, '/path/index_async.txt')));
        assert.ok(!accessor.textFileService.isDirty(toResource.call(this, '/path/index_async2.txt')));
        if (isWeb) {
            // web tests does not ensure timeouts are respected at all, so we cannot
            // really assert the mtime to be different, only that it is equal or greater.
            // https://github.com/microsoft/vscode/issues/161886
            assert.ok(assertReturnsDefined(getLastResolvedFileStat(model1)).mtime >= m1Mtime);
            assert.ok(assertReturnsDefined(getLastResolvedFileStat(model2)).mtime >= m2Mtime);
        }
        else {
            // on desktop we want to assert this condition more strictly though
            assert.ok(assertReturnsDefined(getLastResolvedFileStat(model1)).mtime > m1Mtime);
            assert.ok(assertReturnsDefined(getLastResolvedFileStat(model2)).mtime > m2Mtime);
        }
    });
    test('Save Participant', async function () {
        let eventCounter = 0;
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        disposables.add(model.onDidSave(() => {
            assert.strictEqual(snapshotToString(model.createSnapshot()), eventCounter === 1 ? 'bar' : 'foobar');
            assert.ok(!model.isDirty());
            eventCounter++;
        }));
        const participant = accessor.textFileService.files.addSaveParticipant({
            participate: async (model) => {
                assert.ok(model.isDirty());
                model.updateTextEditorModel(createTextBufferFactory('bar'));
                assert.ok(model.isDirty());
                eventCounter++;
            }
        });
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('foo'));
        assert.ok(model.isDirty());
        await model.save();
        assert.strictEqual(eventCounter, 2);
        participant.dispose();
        model.updateTextEditorModel(createTextBufferFactory('foobar'));
        assert.ok(model.isDirty());
        await model.save();
        assert.strictEqual(eventCounter, 3);
    });
    test('Save Participant - skip', async function () {
        let eventCounter = 0;
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        disposables.add(accessor.textFileService.files.addSaveParticipant({
            participate: async () => {
                eventCounter++;
            }
        }));
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('foo'));
        await model.save({ skipSaveParticipants: true });
        assert.strictEqual(eventCounter, 0);
    });
    test('Save Participant, async participant', async function () {
        let eventCounter = 0;
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        disposables.add(model.onDidSave(() => {
            assert.ok(!model.isDirty());
            eventCounter++;
        }));
        disposables.add(accessor.textFileService.files.addSaveParticipant({
            participate: model => {
                assert.ok(model.isDirty());
                model.updateTextEditorModel(createTextBufferFactory('bar'));
                assert.ok(model.isDirty());
                eventCounter++;
                return timeout(10);
            }
        }));
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('foo'));
        const now = Date.now();
        await model.save();
        assert.strictEqual(eventCounter, 2);
        assert.ok(Date.now() - now >= 10);
    });
    test('Save Participant, bad participant', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        disposables.add(accessor.textFileService.files.addSaveParticipant({
            participate: async () => {
                new Error('boom');
            }
        }));
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('foo'));
        await model.save();
    });
    test('Save Participant, participant cancelled when saved again', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        const participations = [];
        disposables.add(accessor.textFileService.files.addSaveParticipant({
            participate: async (model, context, progress, token) => {
                await timeout(10);
                if (!token.isCancellationRequested) {
                    participations.push(true);
                }
            }
        }));
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('foo'));
        const p1 = model.save();
        model.updateTextEditorModel(createTextBufferFactory('foo 1'));
        const p2 = model.save();
        model.updateTextEditorModel(createTextBufferFactory('foo 2'));
        const p3 = model.save();
        model.updateTextEditorModel(createTextBufferFactory('foo 3'));
        const p4 = model.save();
        await Promise.all([p1, p2, p3, p4]);
        assert.strictEqual(participations.length, 1);
    });
    test('Save Participant, calling save from within is unsupported but does not explode (sync save, no model change)', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        await testSaveFromSaveParticipant(model, false, false, false);
    });
    test('Save Participant, calling save from within is unsupported but does not explode (async save, no model change)', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        await testSaveFromSaveParticipant(model, true, false, false);
    });
    test('Save Participant, calling save from within is unsupported but does not explode (sync save, model change)', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        await testSaveFromSaveParticipant(model, false, true, false);
    });
    test('Save Participant, calling save from within is unsupported but does not explode (async save, model change)', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        await testSaveFromSaveParticipant(model, true, true, false);
    });
    test('Save Participant, calling save from within is unsupported but does not explode (force)', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        await testSaveFromSaveParticipant(model, false, false, true);
    });
    async function testSaveFromSaveParticipant(model, async, modelChange, force) {
        disposables.add(accessor.textFileService.files.addSaveParticipant({
            participate: async () => {
                if (async) {
                    await timeout(10);
                }
                if (modelChange) {
                    model.updateTextEditorModel(createTextBufferFactory('bar'));
                    const newSavePromise = model.save(force ? { force } : undefined);
                    // assert that this is not the same promise as the outer one
                    assert.notStrictEqual(savePromise, newSavePromise);
                    await newSavePromise;
                }
                else {
                    const newSavePromise = model.save(force ? { force } : undefined);
                    // assert that this is the same promise as the outer one
                    assert.strictEqual(savePromise, newSavePromise);
                    await savePromise;
                }
            }
        }));
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('foo'));
        const savePromise = model.save(force ? { force } : undefined);
        await savePromise;
    }
    test('Save Participant carries context', async function () {
        const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/index_async.txt'), 'utf8', undefined));
        const from = URI.file('testFrom');
        let e = undefined;
        disposables.add(accessor.textFileService.files.addSaveParticipant({
            participate: async (wc, context) => {
                try {
                    assert.strictEqual(context.reason, 1 /* SaveReason.EXPLICIT */);
                    assert.strictEqual(context.savedFrom?.toString(), from.toString());
                }
                catch (error) {
                    e = error;
                }
            }
        }));
        await model.resolve();
        model.updateTextEditorModel(createTextBufferFactory('foo'));
        await model.save({ force: true, from });
        if (e) {
            throw e;
        }
    });
    ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dEZpbGVFZGl0b3JNb2RlbC50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy90ZXh0ZmlsZS90ZXN0L2Jyb3dzZXIvdGV4dEZpbGVFZGl0b3JNb2RlbC50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUU1QixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMxRSxPQUFPLEVBQTBDLGdCQUFnQixFQUFFLHFCQUFxQixFQUFpQyxNQUFNLDJCQUEyQixDQUFDO0FBQzNKLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSw2QkFBNkIsRUFBRSxtQkFBbUIsRUFBRSwrQkFBK0IsRUFBRSx1QkFBdUIsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ3hNLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSx1Q0FBdUMsRUFBRSxVQUFVLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUVsSSxPQUFPLEVBQXVCLGtCQUFrQixFQUFFLGtDQUFrQyxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDNUksT0FBTyxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxpREFBaUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3hGLE9BQU8sRUFBYyxrQkFBa0IsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQzlFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7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