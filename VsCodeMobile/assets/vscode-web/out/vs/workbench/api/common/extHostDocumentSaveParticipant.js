/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { URI } from '../../../base/common/uri.js';
import { illegalState } from '../../../base/common/errors.js';
import { TextEdit } from './extHostTypes.js';
import { Range, TextDocumentSaveReason, EndOfLine } from './extHostTypeConverters.js';
import { LinkedList } from '../../../base/common/linkedList.js';
import { SerializableObjectWithBuffers } from '../../services/extensions/common/proxyIdentifier.js';
export class ExtHostDocumentSaveParticipant {
    constructor(_logService, _documents, _mainThreadBulkEdits, _thresholds = { timeout: 1500, errors: 3 }) {
        this._logService = _logService;
        this._documents = _documents;
        this._mainThreadBulkEdits = _mainThreadBulkEdits;
        this._thresholds = _thresholds;
        this._callbacks = new LinkedList();
        this._badListeners = new WeakMap();
        //
    }
    dispose() {
        this._callbacks.clear();
    }
    getOnWillSaveTextDocumentEvent(extension) {
        return (listener, thisArg, disposables) => {
            const remove = this._callbacks.push([listener, thisArg, extension]);
            const result = { dispose: remove };
            if (Array.isArray(disposables)) {
                disposables.push(result);
            }
            return result;
        };
    }
    async $participateInSave(data, reason) {
        const resource = URI.revive(data);
        let didTimeout = false;
        const didTimeoutHandle = setTimeout(() => didTimeout = true, this._thresholds.timeout);
        const results = [];
        try {
            for (const listener of [...this._callbacks]) { // copy to prevent concurrent modifications
                if (didTimeout) {
                    // timeout - no more listeners
                    break;
                }
                const document = this._documents.getDocument(resource);
                const success = await this._deliverEventAsyncAndBlameBadListeners(listener, { document, reason: TextDocumentSaveReason.to(reason) });
                results.push(success);
            }
        }
        finally {
            clearTimeout(didTimeoutHandle);
        }
        return results;
    }
    _deliverEventAsyncAndBlameBadListeners([listener, thisArg, extension], stubEvent) {
        const errors = this._badListeners.get(listener);
        if (typeof errors === 'number' && errors > this._thresholds.errors) {
            // bad listener - ignore
            return Promise.resolve(false);
        }
        return this._deliverEventAsync(extension, listener, thisArg, stubEvent).then(() => {
            // don't send result across the wire
            return true;
        }, err => {
            this._logService.error(`onWillSaveTextDocument-listener from extension '${extension.identifier.value}' threw ERROR`);
            this._logService.error(err);
            if (!(err instanceof Error) || err.message !== 'concurrent_edits') {
                const errors = this._badListeners.get(listener);
                this._badListeners.set(listener, !errors ? 1 : errors + 1);
                if (typeof errors === 'number' && errors > this._thresholds.errors) {
                    this._logService.info(`onWillSaveTextDocument-listener from extension '${extension.identifier.value}' will now be IGNORED because of timeouts and/or errors`);
                }
            }
            return false;
        });
    }
    _deliverEventAsync(extension, listener, thisArg, stubEvent) {
        const promises = [];
        const t1 = Date.now();
        const { document, reason } = stubEvent;
        const { version } = document;
        const event = Object.freeze({
            document,
            reason,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            waitUntil(p) {
                if (Object.isFrozen(promises)) {
                    throw illegalState('waitUntil can not be called async');
                }
                promises.push(Promise.resolve(p));
            }
        });
        try {
            // fire event
            listener.apply(thisArg, [event]);
        }
        catch (err) {
            return Promise.reject(err);
        }
        // freeze promises after event call
        Object.freeze(promises);
        return new Promise((resolve, reject) => {
            // join on all listener promises, reject after timeout
            const handle = setTimeout(() => reject(new Error('timeout')), this._thresholds.timeout);
            return Promise.all(promises).then(edits => {
                this._logService.debug(`onWillSaveTextDocument-listener from extension '${extension.identifier.value}' finished after ${(Date.now() - t1)}ms`);
                clearTimeout(handle);
                resolve(edits);
            }).catch(err => {
                clearTimeout(handle);
                reject(err);
            });
        }).then(values => {
            const dto = { edits: [] };
            for (const value of values) {
                if (Array.isArray(value) && value.every(e => e instanceof TextEdit)) {
                    for (const { newText, newEol, range } of value) {
                        dto.edits.push({
                            resource: document.uri,
                            versionId: undefined,
                            textEdit: {
                                range: range && Range.from(range),
                                text: newText,
                                eol: newEol && EndOfLine.from(newEol),
                            }
                        });
                    }
                }
            }
            // apply edits if any and if document
            // didn't change somehow in the meantime
            if (dto.edits.length === 0) {
                return undefined;
            }
            if (version === document.version) {
                return this._mainThreadBulkEdits.$tryApplyWorkspaceEdit(new SerializableObjectWithBuffers(dto));
            }
            return Promise.reject(new Error('concurrent_edits'));
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdERvY3VtZW50U2F2ZVBhcnRpY2lwYW50LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvY29tbW9uL2V4dEhvc3REb2N1bWVudFNhdmVQYXJ0aWNpcGFudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLDZCQUE2QixDQUFDO0FBQ2pFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUU5RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDN0MsT0FBTyxFQUFFLEtBQUssRUFBRSxzQkFBc0IsRUFBRSxTQUFTLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUl0RixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFHaEUsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0scURBQXFELENBQUM7QUFJcEcsTUFBTSxPQUFPLDhCQUE4QjtJQUsxQyxZQUNrQixXQUF3QixFQUN4QixVQUE0QixFQUM1QixvQkFBOEMsRUFDOUMsY0FBbUQsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUU7UUFIL0UsZ0JBQVcsR0FBWCxXQUFXLENBQWE7UUFDeEIsZUFBVSxHQUFWLFVBQVUsQ0FBa0I7UUFDNUIseUJBQW9CLEdBQXBCLG9CQUFvQixDQUEwQjtRQUM5QyxnQkFBVyxHQUFYLFdBQVcsQ0FBb0U7UUFQaEYsZUFBVSxHQUFHLElBQUksVUFBVSxFQUFZLENBQUM7UUFDeEMsa0JBQWEsR0FBRyxJQUFJLE9BQU8sRUFBb0IsQ0FBQztRQVFoRSxFQUFFO0lBQ0gsQ0FBQztJQUVELE9BQU87UUFDTixJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3pCLENBQUM7SUFFRCw4QkFBOEIs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