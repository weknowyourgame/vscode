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
import { AsyncReader, AsyncReaderEndOfStream } from '../../../../../base/common/async.js';
import { CachedFunction } from '../../../../../base/common/cache.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { observableValue, runOnChange } from '../../../../../base/common/observable.js';
import { AnnotatedStringEdit } from '../../../../../editor/common/core/edits/stringEdit.js';
import { IEditorWorkerService } from '../../../../../editor/common/services/editorWorker.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { iterateObservableChanges, mapObservableDelta } from './utils.js';
/**
 * Creates a document that is a delayed copy of the original document,
 * but with edits annotated with the source of the edit.
*/
export class DocumentWithSourceAnnotatedEdits extends Disposable {
    constructor(_originalDoc) {
        super();
        this._originalDoc = _originalDoc;
        const v = this.value = observableValue(this, _originalDoc.value.get());
        this._register(runOnChange(this._originalDoc.value, (val, _prevVal, edits) => {
            const eComposed = AnnotatedStringEdit.compose(edits.map(e => {
                const editSourceData = new EditSourceData(e.reason);
                return e.mapData(() => editSourceData);
            }));
            v.set(val, undefined, { edit: eComposed });
        }));
    }
    waitForQueue() {
        return Promise.resolve();
    }
}
/**
 * Only joins touching edits if the source and the metadata is the same (e.g. requestUuids must be equal).
*/
export class EditSourceData {
    constructor(editSource) {
        this.editSource = editSource;
        this.key = this.editSource.toKey(1);
        this.source = EditSourceBase.create(this.editSource);
    }
    join(data) {
        if (this.editSource !== data.editSource) {
            return undefined;
        }
        return this;
    }
    toEditSourceData() {
        return new EditKeySourceData(this.key, this.source, this.editSource);
    }
}
export class EditKeySourceData {
    constructor(key, source, representative) {
        this.key = key;
        this.source = source;
        this.representative = representative;
    }
    join(data) {
        if (this.key !== data.key) {
            return undefined;
        }
        if (this.source !== data.source) {
            return undefined;
        }
        // The representatives could be different! (But equal modulo key)
        return this;
    }
}
export class EditSourceBase {
    static { this._cache = new CachedFunction({ getCacheKey: v => v.toString() }, (arg) => arg); }
    static create(reason) {
        const data = reason.metadata;
        switch (data.source) {
            case 'reloadFromDisk':
                return this._cache.get(new ExternalEditSource());
            case 'inlineCompletionPartialAccept':
            case 'inlineCompletionAccept': {
                const type = 'type' in data ? data.type : undefined;
                if ('$nes' in data && data.$nes) {
                    return this._cache.get(new InlineSuggestEditSource('nes', data.$extensionId ?? '', data.$providerId ?? '', type));
                }
                return this._cache.get(new InlineSuggestEditSource('completion', data.$extensionId ?? '', data.$providerId ?? '', type));
            }
            case 'snippet':
                return this._cache.get(new IdeEditSource('suggest'));
            case 'unknown':
                if (!data.name) {
                    return this._cache.get(new UnknownEditSource());
                }
                switch (data.name) {
                    case 'formatEditsCommand':
                        return this._cache.get(new IdeEditSource('format'));
                }
                return this._cache.get(new UnknownEditSource());
            case 'Chat.applyEdits':
                return this._cache.get(new ChatEditSource('sidebar'));
            case 'inlineChat.applyEdits':
                return this._cache.get(new ChatEditSource('inline'));
            case 'cursor':
                return this._cache.get(new UserEditSource());
            default:
                return this._cache.get(new UnknownEditSource());
        }
    }
}
export class InlineSuggestEditSource extends EditSourceBase {
    constructor(kind, extensionId, providerId, type) {
        super();
        this.kind = kind;
        this.extensionId = extensionId;
        this.providerId = providerId;
        this.type = type;
        this.category = 'ai';
        this.feature = 'inlineSuggest';
    }
    toString() { return `${this.category}/${this.feature}/${this.kind}/${this.extensionId}/${this.type}`; }
    getColor() { return '#00ff0033'; }
}
class ChatEditSource extends EditSourceBase {
    constructor(kind) {
        super();
        this.kind = kind;
        this.category = 'ai';
        this.feature = 'chat';
    }
    toString() { return `${this.category}/${this.feature}/${this.kind}`; }
    getColor() { return '#00ff0066'; }
}
class IdeEditSource extends EditSourceBase {
    constructor(feature) {
        super();
        this.feature = feature;
        this.category = 'ide';
    }
    toString() { return `${this.category}/${this.feature}`; }
    getColor() { return this.feature === 'format' ? '#0000ff33' : '#80808033'; }
}
class UserEditSource extends EditSourceBase {
    constructor() {
        super();
        this.category = 'user';
    }
    toString() { return this.category; }
    getColor() { return '#d3d3d333'; }
}
/** Caused by external tools that trigger a reload from disk */
class ExternalEditSource extends EditSourceBase {
    constructor() {
        super();
        this.category = 'external';
    }
    toString() { return this.category; }
    getColor() { return '#009ab254'; }
}
class UnknownEditSource extends EditSourceBase {
    constructor() {
        super();
        this.category = 'unknown';
    }
    toString() { return this.category; }
    getColor() { return '#ff000033'; }
}
let CombineStreamedChanges = class CombineStreamedChanges extends Disposable {
    constructor(_originalDoc, _instantiationService) {
        super();
        this._originalDoc = _originalDoc;
        this._instantiationService = _instantiationService;
        this._runStore = this._register(new DisposableStore());
        this._runQueue = Promise.resolve();
        this._diffService = this._instantiationService.createInstance(DiffService);
        this.value = this._value = observableValue(this, _originalDoc.value.get());
        this._restart();
    }
    async _restart() {
        this._runStore.clear();
        const iterator = iterateObservableChanges(this._originalDoc.value, this._runStore)[Symbol.asyncIterator]();
        const p = this._runQueue;
        this._runQueue = this._runQueue.then(() => this._run(iterator));
        await p;
    }
    async _run(iterator) {
        const reader = new AsyncReader(iterator);
        while (true) {
            let peeked = await reader.peek();
            if (peeked === AsyncReaderEndOfStream) {
                return;
            }
            else if (isChatEdit(peeked)) {
                const first = peeked;
                let last = first;
                let chatEdit = AnnotatedStringEdit.empty;
                do {
                    reader.readBufferedOrThrow();
                    last = peeked;
                    chatEdit = chatEdit.compose(AnnotatedStringEdit.compose(peeked.change.map(c => c.edit)));
                    const peekedOrUndefined = await reader.peekTimeout(1000);
                    if (!peekedOrUndefined) {
                        break;
                    }
                    peeked = peekedOrUndefined;
                } while (peeked !== AsyncReaderEndOfStream && isChatEdit(peeked));
                if (!chatEdit.isEmpty()) {
                    const data = chatEdit.replacements[0].data;
                    const diffEdit = await this._diffService.computeDiff(first.prevValue.value, last.value.value);
                    const edit = diffEdit.mapData(_e => data);
                    this._value.set(last.value, undefined, { edit });
                }
            }
            else {
                reader.readBufferedOrThrow();
                const e = AnnotatedStringEdit.compose(peeked.change.map(c => c.edit));
                this._value.set(peeked.value, undefined, { edit: e });
            }
        }
    }
    async waitForQueue() {
        await this._originalDoc.waitForQueue();
        await this._restart();
    }
};
CombineStreamedChanges = __decorate([
    __param(1, IInstantiationService)
], CombineStreamedChanges);
export { CombineStreamedChanges };
let DiffService = class DiffService {
    constructor(_editorWorkerService) {
        this._editorWorkerService = _editorWorkerService;
    }
    async computeDiff(original, modified) {
        const diffEdit = await this._editorWorkerService.computeStringEditFromDiff(original, modified, { maxComputationTimeMs: 500 }, 'advanced');
        return diffEdit;
    }
};
DiffService = __decorate([
    __param(0, IEditorWorkerService)
], DiffService);
export { DiffService };
function isChatEdit(next) {
    return next.change.every(c => c.edit.replacements.every(e => {
        if (e.data.source.category === 'ai' && e.data.source.feature === 'chat') {
            return true;
        }
        return false;
    }));
}
export class MinimizeEditsProcessor extends Disposable {
    constructor(_originalDoc) {
        super();
        this._originalDoc = _originalDoc;
        const v = this.value = observableValue(this, _originalDoc.value.get());
        let prevValue = this._originalDoc.value.get().value;
        this._register(runOnChange(this._originalDoc.value, (val, _prevVal, edits) => {
            const eComposed = AnnotatedStringEdit.compose(edits.map(e => e.edit));
            const e = eComposed.removeCommonSuffixAndPrefix(prevValue);
            prevValue = val.value;
            v.set(val, undefined, { edit: e });
        }));
    }
    async waitForQueue() {
        await this._originalDoc.waitForQueue();
    }
}
/**
 * Removing the metadata allows touching edits from the same source to merged, even if they were caused by different actions (e.g. two user edits).
 */
export function createDocWithJustReason(docWithAnnotatedEdits, store) {
    const docWithJustReason = {
        value: mapObservableDelta(docWithAnnotatedEdits.value, edit => ({ edit: edit.edit.mapData(d => d.data.toEditSourceData()) }), store),
        waitForQueue: () => docWithAnnotatedEdits.waitForQueue(),
    };
    return docWithJustReason;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG9jdW1lbnRXaXRoQW5ub3RhdGVkRWRpdHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvZWRpdFRlbGVtZXRyeS9icm93c2VyL2hlbHBlcnMvZG9jdW1lbnRXaXRoQW5ub3RhdGVkRWRpdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzFGLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNyRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3RGLE9BQU8sRUFBOEMsZUFBZSxFQUFFLFdBQVcsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ3BJLE9BQU8sRUFBRSxtQkFBbUIsRUFBeUIsTUFBTSx1REFBdUQsQ0FBQztBQUVuSCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUU3RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUV0RyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFPMUU7OztFQUdFO0FBQ0YsTUFBTSxPQUFPLGdDQUFpQyxTQUFRLFVBQVU7SUFHL0QsWUFBNkIsWUFBaUM7UUFDN0QsS0FBSyxFQUFFLENBQUM7UUFEb0IsaUJBQVksR0FBWixZQUFZLENBQXFCO1FBRzdELE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLEdBQUcsZUFBZSxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFFdkUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFlBQVks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