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
var BrowserClipboardService_1;
import { isSafari, isWebkitWebView } from '../../../base/browser/browser.js';
import { $, addDisposableListener, getActiveDocument, getActiveWindow, isHTMLElement, onDidRegisterWindow } from '../../../base/browser/dom.js';
import { mainWindow } from '../../../base/browser/window.js';
import { DeferredPromise } from '../../../base/common/async.js';
import { Event } from '../../../base/common/event.js';
import { hash } from '../../../base/common/hash.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { ILayoutService } from '../../layout/browser/layoutService.js';
import { ILogService } from '../../log/common/log.js';
/**
 * Custom mime type used for storing a list of uris in the clipboard.
 *
 * Requires support for custom web clipboards https://github.com/w3c/clipboard-apis/pull/175
 */
const vscodeResourcesMime = 'application/vnd.code.resources';
let BrowserClipboardService = class BrowserClipboardService extends Disposable {
    static { BrowserClipboardService_1 = this; }
    constructor(layoutService, logService) {
        super();
        this.layoutService = layoutService;
        this.logService = logService;
        this.mapTextToType = new Map(); // unsupported in web (only in-memory)
        this.findText = ''; // unsupported in web (only in-memory)
        this.resources = []; // unsupported in web (only in-memory)
        this.resourcesStateHash = undefined;
        if (isSafari || isWebkitWebView) {
            this.installWebKitWriteTextWorkaround();
        }
        // Keep track of copy operations to reset our set of
        // copied resources: since we keep resources in memory
        // and not in the clipboard, we have to invalidate
        // that state when the user copies other data.
        this._register(Event.runAndSubscribe(onDidRegisterWindow, ({ window, disposables }) => {
            disposables.add(addDisposableListener(window.document, 'copy', () => this.clearResourcesState()));
        }, { window: mainWindow, disposables: this._store }));
    }
    triggerPaste() {
        this.logService.trace('BrowserClipboardService#triggerPaste');
        return undefined;
    }
    async readImage() {
        try {
            const clipboardItems = await navigator.clipboard.read();
            const clipboardItem = clipboardItems[0];
            const supportedImageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/tiff', 'image/bmp'];
            const mimeType = supportedImageTypes.find(type => clipboardItem.types.includes(type));
            if (mimeType) {
                const blob = await clipboardItem.getType(mimeType);
                const buffer = await blob.arrayBuffer();
                return new Uint8Array(buffer);
            }
            else {
                console.error('No supported image type found in the clipboard');
            }
        }
        catch (error) {
            console.error('Error reading image from clipboard:', error);
        }
        // Return an empty Uint8Array if no image is found or an error occurs
        return new Uint8Array(0);
    }
    // In Safari, it has the following note:
    //
    // "The request to write to the clipboard must be triggered during a user gesture.
    // A call to clipboard.write or clipboard.writeText outside the scope of a user
    // gesture(such as "click" or "touch" event handlers) will result in the immediate
    // rejection of the promise returned by the API call."
    // From: https://webkit.org/blog/10855/async-clipboard-api/
    //
    // Since extensions run in a web worker, and handle gestures in an asynchronous way,
    // they are not classified by Safari as "in response to a user gesture" and will reject.
    //
    // This function sets up some handlers to work around that behavior.
    installWebKitWriteTextWorkaround() {
        const handler = () => {
            const currentWritePromise = new DeferredPromise();
            // Cancel the previous promise since we just created a new one in response to this new event
            if (this.webKitPendingClipboardWritePromise && !this.webKitPendingClipboardWritePromise.isSettled) {
                this.webKitPendingClipboardWritePromise.cancel();
            }
            this.webKitPendingClipboardWritePromise = currentWritePromise;
            // The ctor of ClipboardItem allows you to pass in a promise that will resolve to a string.
            // This allows us to pass in a Promise that will either be cancelled by another event or
            // resolved with the contents of the first call to this.writeText.
            // see https://developer.mozilla.org/en-US/docs/Web/API/ClipboardItem/ClipboardItem#parameters
            getActiveWindow().navigator.clipboard.write([new ClipboardItem({
                    'text/plain': currentWritePromise.p,
                })]).catch(async (err) => {
                if (!(err instanceof Error) || err.name !== 'NotAllowedError' || !currentWritePromise.isRejected) {
                    this.logService.error(err);
                }
            });
        };
        this._register(Event.runAndSubscribe(this.layoutService.onDidAddContainer, ({ container, disposables }) => {
            disposables.add(addDisposableListener(container, 'click', handler));
            disposables.add(addDisposableListener(container, 'keydown', handler));
        }, { container: this.layoutService.mainContainer, disposables: this._store }));
    }
    async writeText(text, type) {
        this.logService.trace('BrowserClipboardService#writeText called with type:', type, ' text.length:', text.length);
        // Clear resources given we are writing text
        this.clearResourcesState();
        // With type: only in-memory is supported
        if (type) {
            this.mapTextToType.set(type, text);
            this.logService.trace('BrowserClipboardService#writeText');
            return;
        }
        if (this.webKitPendingClipboardWritePromise) {
            // For Safari, we complete this Promise which allows the call to `navigator.clipboard.write()`
            // above to resolve and successfully copy to the clipboard. If we let this continue, Safari
            // would throw an error because this call stack doesn't appear to originate from a user gesture.
            return this.webKitPendingClipboardWritePromise.complete(text);
        }
        // Guard access to navigator.clipboard with try/catch
        // as we have seen DOMExceptions in certain browsers
        // due to security policies.
        try {
            this.logService.trace('before navigator.clipboard.writeText');
            return await getActiveWindow().navigator.clipboard.writeText(text);
        }
        catch (error) {
            console.error(error);
        }
        // Fallback to textarea and execCommand solution
        this.fallbackWriteText(text);
    }
    fallbackWriteText(text) {
        this.logService.trace('BrowserClipboardService#fallbackWriteText');
        const activeDocument = getActiveDocument();
        const activeElement = activeDocument.activeElement;
        const textArea = activeDocument.body.appendChild($('textarea', { 'aria-hidden': true }));
        textArea.style.height = '1px';
        textArea.style.width = '1px';
        textArea.style.position = 'absolute';
        textArea.value = text;
        textArea.focus();
        textArea.select();
        activeDocument.execCommand('copy');
        if (isHTMLElement(activeElement)) {
            activeElement.focus();
        }
        textArea.remove();
    }
    async readText(type) {
        this.logService.trace('BrowserClipboardService#readText called with type:', type);
        // With type: only in-memory is supported
        if (type) {
            const readText = this.mapTextToType.get(type) || '';
            this.logService.trace('BrowserClipboardService#readText text.length:', readText.length);
            return readText;
        }
        // Guard access to navigator.clipboard with try/catch
        // as we have seen DOMExceptions in certain browsers
        // due to security policies.
        try {
            const readText = await getActiveWindow().navigator.clipboard.readText();
            this.logService.trace('BrowserClipboardService#readText text.length:', readText.length);
            return readText;
        }
        catch (error) {
            console.error(error);
        }
        return '';
    }
    async readFindText() {
        return this.findText;
    }
    async writeFindText(text) {
        this.findText = text;
    }
    static { this.MAX_RESOURCE_STATE_SOURCE_LENGTH = 1000; }
    async writeResources(resources) {
        // Guard access to navigator.clipboard with try/catch
        // as we have seen DOMExceptions in certain browsers
        // due to security policies.
        try {
            await getActiveWindow().navigator.clipboard.write([
                new ClipboardItem({
                    [`web ${vscodeResourcesMime}`]: new Blob([
                        JSON.stringify(resources.map(x => x.toJSON()))
                    ], {
                        type: vscodeResourcesMime
                    })
                })
            ]);
            // Continue to write to the in-memory clipboard as well.
            // This is needed because some browsers allow the paste but then can't read the custom resources.
        }
        catch (error) {
            // Noop
        }
        if (resources.length === 0) {
            this.clearResourcesState();
        }
        else {
            this.resources = resources;
            this.resourcesStateHash = await this.computeResourcesStateHash();
        }
    }
    async readResources() {
        // Guard access to navigator.clipboard with try/catch
        // as we have seen DOMExceptions in certain browsers
        // due to security policies.
        try {
            const items = await getActiveWindow().navigator.clipboard.read();
            for (const item of items) {
                if (item.types.includes(`web ${vscodeResourcesMime}`)) {
                    const blob = await item.getType(`web ${vscodeResourcesMime}`);
                    const resources = JSON.parse(await blob.text()).map(x => URI.from(x));
                    return resources;
                }
            }
        }
        catch (error) {
            // Noop
        }
        const resourcesStateHash = await this.computeResourcesStateHash();
        if (this.resourcesStateHash !== resourcesStateHash) {
            this.clearResourcesState(); // state mismatch, resources no longer valid
        }
        return this.resources;
    }
    async computeResourcesStateHash() {
        if (this.resources.length === 0) {
            return undefined; // no resources, no hash needed
        }
        // Resources clipboard is managed in-memory only and thus
        // fails to invalidate when clipboard data is changing.
        // As such, we compute the hash of the current clipboard
        // and use that to later validate the resources clipboard.
        const clipboardText = await this.readText();
        return hash(clipboardText.substring(0, BrowserClipboardService_1.MAX_RESOURCE_STATE_SOURCE_LENGTH));
    }
    async hasResources() {
        // Guard access to navigator.clipboard with try/catch
        // as we have seen DOMExceptions in certain browsers
        // due to security policies.
        try {
            const items = await getActiveWindow().navigator.clipboard.read();
            for (const item of items) {
                if (item.types.includes(`web ${vscodeResourcesMime}`)) {
                    return true;
                }
            }
        }
        catch (error) {
            // Noop
        }
        return this.resources.length > 0;
    }
    clearInternalState() {
        this.clearResourcesState();
    }
    clearResourcesState() {
        this.resources = [];
        this.resourcesStateHash = undefined;
    }
};
BrowserClipboardService = BrowserClipboardService_1 = __decorate([
    __param(0, ILayoutService),
    __param(1, ILogService)
], BrowserClipboardService);
export { BrowserClipboardService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpcGJvYXJkU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9jbGlwYm9hcmQvYnJvd3Nlci9jbGlwYm9hcmRTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLGVBQWUsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxDQUFDLEVBQUUscUJBQXFCLEVBQUUsaUJBQWlCLEVBQUUsZUFBZSxFQUFFLGFBQWEsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ2hKLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDaEUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3RELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDL0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBRWxELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFFdEQ7Ozs7R0FJRztBQUNILE1BQU0sbUJBQW1CLEdBQUcsZ0NBQWdDLENBQUM7QUFFdEQsSUFBTSx1QkFBdUIsR0FBN0IsTUFBTSx1QkFBd0IsU0FBUSxVQUFVOztJQUl0RCxZQUNpQixhQUE4QyxFQUNqRCxVQUEwQztRQUV2RCxLQUFLLEVBQUUsQ0FBQztRQUh5QixrQkFBYSxHQUFiLGFBQWEsQ0FBZ0I7UUFDOUIsZUFBVSxHQUFWLFVBQVUsQ0FBYTtRQXlG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