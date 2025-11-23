/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createTrustedTypesPolicy } from '../../../base/browser/trustedTypes.js';
import { coalesce } from '../../../base/common/arrays.js';
import { onUnexpectedError } from '../../../base/common/errors.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable, toDisposable } from '../../../base/common/lifecycle.js';
import { COI } from '../../../base/common/network.js';
import { WebWorkerClient } from '../../../base/common/worker/webWorker.js';
import { getNLSLanguage, getNLSMessages } from '../../../nls.js';
export class WebWorkerService {
    static { this._workerIdPool = 0; }
    createWorkerClient(workerDescriptor) {
        let worker;
        const id = ++WebWorkerService._workerIdPool;
        if (workerDescriptor instanceof Worker || isPromiseLike(workerDescriptor)) {
            worker = Promise.resolve(workerDescriptor);
        }
        else {
            worker = this._createWorker(workerDescriptor);
        }
        return new WebWorkerClient(new WebWorker(worker, id));
    }
    _createWorker(descriptor) {
        const workerRunnerUrl = this.getWorkerUrl(descriptor);
        const workerUrlWithNls = getWorkerBootstrapUrl(descriptor.label, workerRunnerUrl);
        const worker = new Worker(ttPolicy ? ttPolicy.createScriptURL(workerUrlWithNls) : workerUrlWithNls, { name: descriptor.label, type: 'module' });
        return whenESMWorkerReady(worker);
    }
    getWorkerUrl(descriptor) {
        if (!descriptor.esmModuleLocation) {
            throw new Error('Missing esmModuleLocation in WebWorkerDescriptor');
        }
        const uri = typeof descriptor.esmModuleLocation === 'function' ? descriptor.esmModuleLocation() : descriptor.esmModuleLocation;
        const urlStr = uri.toString(true);
        return urlStr;
    }
}
const ttPolicy = (() => {
    // Reuse the trusted types policy defined from worker bootstrap
    // when available.
    // Refs https://github.com/microsoft/vscode/issues/222193
    const workerGlobalThis = globalThis;
    if (typeof self === 'object' && self.constructor && self.constructor.name === 'DedicatedWorkerGlobalScope' && workerGlobalThis.workerttPolicy !== undefined) {
        return workerGlobalThis.workerttPolicy;
    }
    else {
        return createTrustedTypesPolicy('defaultWorkerFactory', { createScriptURL: value => value });
    }
})();
export function createBlobWorker(blobUrl, options) {
    if (!blobUrl.startsWith('blob:')) {
        throw new URIError('Not a blob-url: ' + blobUrl);
    }
    return new Worker(ttPolicy ? ttPolicy.createScriptURL(blobUrl) : blobUrl, { ...options, type: 'module' });
}
function getWorkerBootstrapUrl(label, workerScriptUrl) {
    if (/^((http:)|(https:)|(file:))/.test(workerScriptUrl) && workerScriptUrl.substring(0, globalThis.origin.length) !== globalThis.origin) {
        // this is the cross-origin case
        // i.e. the webpage is running at a different origin than where the scripts are loaded from
    }
    else {
        const start = workerScriptUrl.lastIndexOf('?');
        const end = workerScriptUrl.lastIndexOf('#', start);
        const params = start > 0
            ? new URLSearchParams(workerScriptUrl.substring(start + 1, ~end ? end : undefined))
            : new URLSearchParams();
        COI.addSearchParam(params, true, true);
        const search = params.toString();
        if (!search) {
            workerScriptUrl = `${workerScriptUrl}#${label}`;
        }
        else {
            workerScriptUrl = `${workerScriptUrl}?${params.toString()}#${label}`;
        }
    }
    // In below blob code, we are using JSON.stringify to ensure the passed
    // in values are not breaking our script. The values may contain string
    // terminating characters (such as ' or ").
    const blob = new Blob([coalesce([
            `/*${label}*/`,
            `globalThis._VSCODE_NLS_MESSAGES = ${JSON.stringify(getNLSMessages())};`,
            `globalThis._VSCODE_NLS_LANGUAGE = ${JSON.stringify(getNLSLanguage())};`,
            `globalThis._VSCODE_FILE_ROOT = ${JSON.stringify(globalThis._VSCODE_FILE_ROOT)};`,
            `const ttPolicy = globalThis.trustedTypes?.createPolicy('defaultWorkerFactory', { createScriptURL: value => value });`,
            `globalThis.workerttPolicy = ttPolicy;`,
            `await import(ttPolicy?.createScriptURL(${JSON.stringify(workerScriptUrl)}) ?? ${JSON.stringify(workerScriptUrl)});`,
            `globalThis.postMessage({ type: 'vscode-worker-ready' });`,
            `/*${label}*/`
        ]).join('')], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
}
function whenESMWorkerReady(worker) {
    return new Promise((resolve, reject) => {
        worker.onmessage = function (e) {
            if (e.data.type === 'vscode-worker-ready') {
                worker.onmessage = null;
                resolve(worker);
            }
        };
        worker.onerror = reject;
    });
}
function isPromiseLike(obj) {
    return !!obj && typeof obj.then === 'function';
}
export class WebWorker extends Disposable {
    constructor(worker, id) {
        super();
        this._onMessage = this._register(new Emitter());
        this.onMessage = this._onMessage.event;
        this._onError = this._register(new Emitter());
        this.onError = this._onError.event;
        this.id = id;
        this.worker = worker;
        this.postMessage('-please-ignore-', []); // TODO: Eliminate this extra message
        const errorHandler = (ev) => {
            this._onError.fire(ev);
        };
        this.worker.then((w) => {
            w.onmessage = (ev) => {
                this._onMessage.fire(ev.data);
            };
            w.onmessageerror = (ev) => {
                this._onError.fire(ev);
            };
            if (typeof w.addEventListener === 'function') {
                w.addEventListener('error', errorHandler);
            }
        });
        this._register(toDisposable(() => {
            this.worker?.then(w => {
                w.onmessage = null;
                w.onmessageerror = null;
                w.removeEventListener('error', errorHandler);
                w.terminate();
            });
            this.worker = null;
        }));
    }
    getId() {
        return this.id;
    }
    postMessage(message, transfer) {
        this.worker?.then(w => {
            try {
                w.postMessage(message, transfer);
            }
            catch (err) {
                onUnexpectedError(err);
                onUnexpectedError(new Error(`FAILED to post message to worker`, { cause: err }));
            }
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViV29ya2VyU2VydmljZUltcGwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vd2ViV29ya2VyL2Jyb3dzZXIvd2ViV29ya2VyU2VydmljZUltcGwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDakYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzFELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN4RCxPQUFPLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUN0RCxPQUFPLEVBQXlDLGVBQWUsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ2xILE9BQU8sRUFBRSxjQUFjLEVBQUUsY0FBYyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFJakUsTUFBTSxPQUFPLGdCQUFnQjthQUNiLGtCQUFhLEdBQVcsQ0FBQyxDQUFDO0lBR3pDLGtCQUFrQixDQUFtQixnQkFBZ0U7UUFDcEcsSUFBSSxNQUFnQyxDQUFDO1FBQ3JDLE1BQU0sRUFBRSxHQUFHLEVBQUUsZ0JBQWdCLENBQUMsYUFBYSxDQUFDO1FBQzVDLElBQUksZ0JBQWdCLFlBQVksTUFBTSxJQUFJLGFBQWEsQ0FBUyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUM7WUFDbkYsTUFBTSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUM1QyxDQUFDO2FBQU0sQ0FBQztZQUNQLE1BQU0sR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLENB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