/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { Disposable, DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { constObservable, observableValue, subtransaction } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { StringReplacement } from '../../../../../editor/common/core/edits/stringEdit.js';
import { OffsetRange } from '../../../../../editor/common/core/ranges/offsetRange.js';
import { StringText } from '../../../../../editor/common/core/text/abstractText.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { AnnotatedDocuments, UriVisibilityProvider } from '../../browser/helpers/annotatedDocuments.js';
import { ObservableWorkspace, StringEditWithReason } from '../../browser/helpers/observableWorkspace.js';
import { EditSourceTrackingImpl } from '../../browser/telemetry/editSourceTrackingImpl.js';
import { ScmAdapter } from '../../browser/telemetry/scmAdapter.js';
import { EditSources } from '../../../../../editor/common/textModelEditSource.js';
import { DiffService } from '../../browser/helpers/documentWithAnnotatedEdits.js';
import { computeStringDiff } from '../../../../../editor/common/services/editorWebWorker.js';
import { runWithFakedTimers } from '../../../../../base/test/common/timeTravelScheduler.js';
import { timeout } from '../../../../../base/common/async.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IAiEditTelemetryService } from '../../browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js';
import { Random } from '../../../../../editor/test/common/core/random.js';
import { AiEditTelemetryServiceImpl } from '../../browser/telemetry/aiEditTelemetry/aiEditTelemetryServiceImpl.js';
import { IRandomService, RandomService } from '../../browser/randomService.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
suite('Edit Telemetry', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('1', async () => runWithFakedTimers({}, async () => {
        const disposables = new DisposableStore();
        const instantiationService = disposables.add(new TestInstantiationService(new ServiceCollection([IAiEditTelemetryService, new SyncDescriptor(AiEditTelemetryServiceImpl)])));
        const sentTelemetry = [];
        instantiationService.stub(ITelemetryService, {
            publicLog2(eventName, data) {
                sentTelemetry.push(`${formatTime(Date.now())} ${eventName}: ${JSON.stringify(data)}`);
            },
        });
        instantiationService.stubInstance(DiffService, { computeDiff: async (original, modified) => computeStringDiff(original, modified, { maxComputationTimeMs: 500 }, 'advanced') });
        instantiationService.stubInstance(ScmAdapter, { getRepo: (uri, reader) => undefined, });
        instantiationService.stubInstance(UriVisibilityProvider, { isVisible: (uri, reader) => true, });
        instantiationService.stub(IRandomService, new DeterministicRandomService());
        const w = new MutableObservableWorkspace();
        const docs = disposables.add(new AnnotatedDocuments(w, instantiationService));
        disposables.add(new EditSourceTrackingImpl(constObservable(true), docs, instantiationService));
        const d1 = disposables.add(w.createDocument({
            uri: URI.parse('file:///a'), initialValue: `
function fib(n) {
	if (n <= 1) return n;
	return fib(n - 1) + fib(n - 2);
}
`
        }, undefined));
        await timeout(10);
        const chatEdit = EditSources.chatApplyEdits({
            languageId: 'plaintext',
            modelId: undefined,
            codeBlockSuggestionId: undefined,
            extensionId: undefined,
            mode: undefined,
            requestId: undefined,
            sessionId: undefined,
        });
        d1.applyEdit(StringEditWithReason.replace(d1.findRange('≪≫function fib(n) {'), '// Computes the nth fibonacci number\n', chatEdit));
        await timeout(5000);
        d1.applyEdit(new StringEditWithReason([
            StringReplacement.replace(d1.findRange('≪//≫ Computes'), '/*'),
            StringReplacement.replace(d1.findRange('fibonacci number≪≫'), ' */'),
        ], EditSources.cursor({ kind: 'type' })));
        await timeout(5000);
        d1.applyEdit(StringEditWithReason.replace(d1.findRange('Computes the nth fibonacci number'), 'Berechnet die nte Fibonacci Zahl', chatEdit));
        await timeout(6 * 60 * 1000);
        assert.deepStrictEqual(sentTelemetry, [
            '00:01:010 editTelemetry.reportEditArc: {"sourceKeyCleaned":"source:Chat.applyEdits","languageId":"plaintext","uniqueEditId":"8c97b7d8-9adb-4bd8-ac9f-a562704ce40e","didBranchChange":0,"timeDelayMs":0,"originalCharCount":37,"originalLineCount":1,"originalDeletedLineCount":0,"arc":37,"currentLineCount":1,"currentDeletedLineCount":0}',
            '00:01:010 editTelemetry.codeSuggested: {"eventId":"evt-055ed5f5-c723-4ede-ba79-cccd7685c7ad","suggestionId":"sgt-f645627a-cacf-477a-9164-ecd6125616a5","presentation":"highlightedEdit","feature":"sideBarChat","languageId":"plaintext","editCharsInserted":37,"editCharsDeleted":0,"editLinesInserted":1,"editLinesDeleted":0,"modelId":{"isTrustedTelemetryValue":true}}',
            '00:11:010 editTelemetry.reportEditArc: {"sourceKeyCleaned":"source:Chat.applyEdits","languageId":"plaintext","uniqueEditId":"1eb8a394-2489-41c2-851b-6a79432fc6bc","didBranchChange":0,"timeDelayMs":0,"originalCharCount":19,"originalLineCount":1,"originalDeletedLineCount":1,"arc":19,"currentLineCount":1,"currentDeletedLineCount":1}',
            '00:11:010 editTelemetry.codeSuggested: {"eventId":"evt-5c9c6fe7-b219-4ff8-aaa7-ab2b355b21c0","suggestionId":"sgt-74379122-0452-4e26-9c38-9d62f1e7ae73","presentation":"highlightedEdit","feature":"sideBarChat","languageId":"plaintext","editCharsInserted":19,"editCharsDeleted":20,"editLinesInserted":1,"editLinesDeleted":1,"modelId":{"isTrustedTelemetryValue":true}}',
            '01:01:010 editTelemetry.reportEditArc: {"sourceKeyCleaned":"source:Chat.applyEdits","languageId":"plaintext","uniqueEditId":"8c97b7d8-9adb-4bd8-ac9f-a562704ce40e","didBranchChange":0,"timeDelayMs":60000,"originalCharCount":37,"originalLineCount":1,"originalDeletedLineCount":0,"arc":16,"currentLineCount":1,"currentDeletedLineCount":0}',
            '01:11:010 editTelemetry.reportEditArc: {"sourceKeyCleaned":"source:Chat.applyEdits","languageId":"plaintext","uniqueEditId":"1eb8a394-2489-41c2-851b-6a79432fc6bc","didBranchChange":0,"timeDelayMs":60000,"originalCharCount":19,"originalLineCount":1,"originalDeletedLineCount":1,"arc":19,"currentLineCount":1,"currentDeletedLineCount":1}',
            '05:00:000 editTelemetry.editSources.details: {"mode":"5minWindow","sourceKey":"source:Chat.applyEdits","sourceKeyCleaned":"source:Chat.applyEdits","trigger":"time","languageId":"plaintext","statsUuid":"509b5d53-9109-40a2-bdf5-1aa735a229fe","modifiedCount":35,"deltaModifiedCount":56,"totalModifiedCount":39}',
            '05:00:000 editTelemetry.editSources.details: {"mode":"5minWindow","sourceKey":"source:cursor-kind:type","sourceKeyCleaned":"source:cursor-kind:type","trigger":"time","languageId":"plaintext","statsUuid":"509b5d53-9109-40a2-bdf5-1aa735a229fe","modifiedCount":4,"deltaModifiedCount":4,"totalModifiedCount":39}',
            '05:00:000 editTelemetry.editSources.stats: {"mode":"5minWindow","languageId":"plaintext","statsUuid":"509b5d53-9109-40a2-bdf5-1aa735a229fe","nesModifiedCount":0,"inlineCompletionsCopilotModifiedCount":0,"inlineCompletionsNESModifiedCount":0,"otherAIModifiedCount":35,"unknownModifiedCount":0,"userModifiedCount":4,"ideModifiedCount":0,"totalModifiedCharacters":39,"externalModifiedCount":0,"isTrackedByGit":0}',
            '05:01:010 editTelemetry.reportEditArc: {"sourceKeyCleaned":"source:Chat.applyEdits","languageId":"plaintext","uniqueEditId":"8c97b7d8-9adb-4bd8-ac9f-a562704ce40e","didBranchChange":0,"timeDelayMs":300000,"originalCharCount":37,"originalLineCount":1,"originalDeletedLineCount":0,"arc":16,"currentLineCount":1,"currentDeletedLineCount":0}',
            '05:11:010 editTelemetry.reportEditArc: {"sourceKeyCleaned":"source:Chat.applyEdits","languageId":"plaintext","uniqueEditId":"1eb8a394-2489-41c2-851b-6a79432fc6bc","didBranchChange":0,"timeDelayMs":300000,"originalCharCount":19,"originalLineCount":1,"originalDeletedLineCount":1,"arc":19,"currentLineCount":1,"currentDeletedLineCount":1}',
        ]);
        disposables.dispose();
    }));
});
function formatTime(timeMs) {
    const totalMs = Math.floor(timeMs);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;
    const str = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${ms.toString().padStart(3, '0')}`;
    return str;
}
class DeterministicRandomService extends RandomService {
    constructor() {
        super(...arguments);
        this._rand = Random.create(0);
    }
    generateUuid() {
        return this._rand.nextUuid();
    }
}
export class FakeAnnotatedDocuments extends Disposable {
    constructor() {
        super();
        this.documents = constObservable([]);
    }
}
function findOffsetRange(str, search) {
    const startContextIndex = search.indexOf('≪');
    const endContextIndex = search.indexOf('≫');
    let searchStr;
    let beforeContext = '';
    let afterContext = '';
    if (startContextIndex !== -1 && endContextIndex !== -1 && endContextIndex > startContextIndex) {
        beforeContext = search.substring(0, startContextIndex);
        afterContext = search.substring(endContextIndex + 1);
        searchStr = search.substring(startContextIndex + 1, endContextIndex);
    }
    else {
        searchStr = search;
    }
    const startIndex = str.indexOf(beforeContext + searchStr + afterContext);
    if (startIndex === -1) {
        throw new Error(`Could not find context "${beforeContext}" + "${searchStr}" + "${afterContext}" in string "${str}"`);
    }
    const matchStart = startIndex + beforeContext.length;
    return new OffsetRange(matchStart, matchStart + searchStr.length);
}
export class MutableObservableWorkspace extends ObservableWorkspace {
    constructor() {
        super();
        this._openDocuments = observableValue(this, []);
        this.documents = this._openDocuments;
        this._documents = new Map();
    }
    /**
     * Dispose to remove.
    */
    createDocument(options, tx = undefined) {
        assert(!this._documents.has(options.uri.toString()));
        const document = new MutableObservableDocument(options.uri, new StringText(options.initialValue ?? ''), [], options.languageId ?? 'plaintext', () => {
            this._documents.delete(options.uri.toString());
            const docs = this._openDocuments.get();
            const filteredDocs = docs.filter(d => d.uri.toString() !== document.uri.toString());
            if (filteredDocs.length !== docs.length) {
                this._openDocuments.set(filteredDocs, tx, { added: [], removed: [document] });
            }
        }, options.initialVersionId ?? 0, options.workspaceRoot);
        this._documents.set(options.uri.toString(), document);
        this._openDocuments.set([...this._openDocuments.get(), document], tx, { added: [document], removed: [] });
        return document;
    }
    getDocument(id) {
        return this._documents.get(id.toString());
    }
    clear() {
        this._openDocuments.set([], undefined, { added: [], removed: this._openDocuments.get() });
        for (const doc of this._documents.values()) {
            doc.dispose();
        }
        this._documents.clear();
    }
}
export class MutableObservableDocument extends Disposable {
    get value() { return this._value; }
    get selection() { return this._selection; }
    get visibleRanges() { return this._visibleRanges; }
    get languageId() { return this._languageId; }
    get version() { return this._version; }
    constructor(uri, value, selection, languageId, onDispose, versionId, workspaceRoot) {
        super();
        this.uri = uri;
        this.workspaceRoot = workspaceRoot;
        this._value = observableValue(this, value);
        this._selection = observableValue(this, selection);
        this._visibleRanges = observableValue(this, []);
        this._languageId = observableValue(this, languageId);
        this._version = observableValue(this, versionId);
        this._register(toDisposable(onDispose));
    }
    setSelection(selection, tx = undefined) {
        this._selection.set(selection, tx);
    }
    setVisibleRange(visibleRanges, tx = undefined) {
        this._visibleRanges.set(visibleRanges, tx);
    }
    applyEdit(edit, tx = undefined, newVersion = undefined) {
        const newValue = edit.applyOnText(this.value.get());
        const e = edit instanceof StringEditWithReason ? edit : new StringEditWithReason(edit.replacements, EditSources.unknown({}));
        subtransaction(tx, tx => {
            this._value.set(newValue, tx, e);
            this._version.set(newVersion ?? this._version.get() + 1, tx);
        });
    }
    updateSelection(selection, tx = undefined) {
        this._selection.set(selection, tx);
    }
    setValue(value, tx = undefined, newVersion = undefined) {
        const reason = EditSources.unknown({});
        const e = new StringEditWithReason([StringReplacement.replace(new OffsetRange(0, this.value.get().value.length), value.value)], reason);
        subtransaction(tx, tx => {
            this._value.set(value, tx, e);
            this._version.set(newVersion ?? this._version.get() + 1, tx);
        });
    }
    findRange(search) {
        return findOffsetRange(this.value.get().value, search);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdFRlbGVtZXRyeS50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2VkaXRUZWxlbWV0cnkvdGVzdC9icm93c2VyL2VkaXRUZWxlbWV0cnkudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDcEcsT0FBTyxFQUFFLGVBQWUsRUFBeUUsZUFBZSxFQUFFLGNBQWMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25MLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQWMsaUJBQWlCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN0RyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0seURBQXlELENBQUM7QUFDdEYsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1FQUFtRSxDQUFDO0FBQ3RHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLCtFQUErRSxDQUFDO0FBQ3pILE9BQU8sRUFBcUIsa0JBQWtCLEVBQXVCLHFCQUFxQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDaEosT0FBTyxFQUF1QixtQkFBbUIsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQzlILE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQzNGLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDbEYsT0FBTyxFQUFFLFdB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