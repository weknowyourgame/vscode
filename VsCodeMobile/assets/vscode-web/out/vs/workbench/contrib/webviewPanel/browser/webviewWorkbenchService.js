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
import { createCancelablePromise, DeferredPromise } from '../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { memoize } from '../../../../base/common/decorators.js';
import { isCancellationError } from '../../../../base/common/errors.js';
import { Emitter } from '../../../../base/common/event.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { combinedDisposable, Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { EditorActivation } from '../../../../platform/editor/common/editor.js';
import { createDecorator, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { DiffEditorInput } from '../../../common/editor/diffEditorInput.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWebviewService } from '../../webview/browser/webview.js';
import { CONTEXT_ACTIVE_WEBVIEW_PANEL_ID } from './webviewEditor.js';
import { WebviewInput } from './webviewEditorInput.js';
export const IWebviewWorkbenchService = createDecorator('webviewEditorService');
function canRevive(reviver, webview) {
    return reviver.canResolve(webview);
}
let LazilyResolvedWebviewEditorInput = class LazilyResolvedWebviewEditorInput extends WebviewInput {
    constructor(init, webview, themeService, _webviewWorkbenchService) {
        super(init, webview, themeService);
        this._webviewWorkbenchService = _webviewWorkbenchService;
        this._resolved = false;
    }
    dispose() {
        super.dispose();
        this._resolvePromise?.cancel();
        this._resolvePromise = undefined;
    }
    async resolve() {
        if (!this._resolved) {
            this._resolved = true;
            this._resolvePromise = createCancelablePromise(token => this._webviewWorkbenchService.resolveWebview(this, token));
            try {
                await this._resolvePromise;
            }
            catch (e) {
                if (!isCancellationError(e)) {
                    throw e;
                }
            }
        }
        return super.resolve();
    }
    transfer(other) {
        if (!super.transfer(other)) {
            return;
        }
        other._resolved = this._resolved;
        return other;
    }
};
__decorate([
    memoize
], LazilyResolvedWebviewEditorInput.prototype, "resolve", null);
LazilyResolvedWebviewEditorInput = __decorate([
    __param(2, IThemeService),
    __param(3, IWebviewWorkbenchService)
], LazilyResolvedWebviewEditorInput);
export { LazilyResolvedWebviewEditorInput };
class RevivalPool {
    constructor() {
        this._awaitingRevival = [];
    }
    enqueueForRestoration(input, token) {
        const promise = new DeferredPromise();
        const remove = () => {
            const index = this._awaitingRevival.findIndex(entry => input === entry.input);
            if (index >= 0) {
                this._awaitingRevival.splice(index, 1);
            }
        };
        const disposable = combinedDisposable(input.webview.onDidDispose(remove), token.onCancellationRequested(() => {
            remove();
            promise.cancel();
        }));
        this._awaitingRevival.push({ input, promise, disposable });
        return promise.p;
    }
    reviveFor(reviver, token) {
        const toRevive = this._awaitingRevival.filter(({ input }) => canRevive(reviver, input));
        this._awaitingRevival = this._awaitingRevival.filter(({ input }) => !canRevive(reviver, input));
        for (const { input, promise: resolve, disposable } of toRevive) {
            reviver.resolveWebview(input, token).then(x => resolve.complete(x), err => resolve.error(err)).finally(() => {
                disposable.dispose();
            });
        }
    }
}
let WebviewEditorService = class WebviewEditorService extends Disposable {
    constructor(editorGroupsService, _editorService, _instantiationService, _webviewService) {
        super();
        this._editorService = _editorService;
        this._instantiationService = _instantiationService;
        this._webviewService = _webviewService;
        this._revivers = new Set();
        this._revivalPool = new RevivalPool();
        this._onDidChangeActiveWebviewEditor = this._register(new Emitter());
        this.onDidChangeActiveWebviewEditor = this._onDidChangeActiveWebviewEditor.event;
        this._register(editorGroupsService.registerContextKeyProvider({
            contextKey: CONTEXT_ACTIVE_WEBVIEW_PANEL_ID,
            getGroupContextKeyValue: (group) => this.getWebviewId(group.activeEditor),
        }));
        this._register(_editorService.onDidActiveEditorChange(() => {
            this.updateActiveWebview();
        }));
        // The user may have switched focus between two sides of a diff editor
        this._register(_webviewService.onDidChangeActiveWebview(() => {
            this.updateActiveWebview();
        }));
        this.updateActiveWebview();
    }
    getWebviewId(input) {
        let webviewInput;
        if (input instanceof WebviewInput) {
            webviewInput = input;
        }
        else if (input instanceof DiffEditorInput) {
            if (input.primary instanceof WebviewInput) {
                webviewInput = input.primary;
            }
            else if (input.secondary instanceof WebviewInput) {
                webviewInput = input.secondary;
            }
        }
        return webviewInput?.webview.providedViewType ?? '';
    }
    updateActiveWebview() {
        const activeInput = this._editorService.activeEditor;
        let newActiveWebview;
        if (activeInput instanceof WebviewInput) {
            newActiveWebview = activeInput;
        }
        else if (activeInput instanceof DiffEditorInput) {
            if (activeInput.primary instanceof WebviewInput && activeInput.primary.webview === this._webviewService.activeWebview) {
                newActiveWebview = activeInput.primary;
            }
            else if (activeInput.secondary instanceof WebviewInput && activeInput.secondary.webview === this._webviewService.activeWebview) {
                newActiveWebview = activeInput.secondary;
            }
        }
        if (newActiveWebview !== this._activeWebview) {
            this._activeWebview = newActiveWebview;
            this._onDidChangeActiveWebviewEditor.fire(newActiveWebview);
        }
    }
    openWebview(webviewInitInfo, viewType, title, iconPath, showOptions) {
        const webview = this._webviewService.createWebviewOverlay(webviewInitInfo);
        const webviewInput = this._instantiationService.createInstance(WebviewInput, { viewType, name: title, providedId: webviewInitInfo.providedViewType, iconPath }, webview);
        this._editorService.openEditor(webviewInput, {
            pinned: true,
            preserveFocus: showOptions.preserveFocus,
            // preserve pre 1.38 behaviour to not make group active when preserveFocus: true
            // but make sure to restore the editor to fix https://github.com/microsoft/vscode/issues/79633
            activation: showOptions.preserveFocus ? EditorActivation.RESTORE : undefined
        }, showOptions.group);
        return webviewInput;
    }
    revealWebview(webview, group, preserveFocus) {
        const topLevelEditor = this.findTopLevelEditorForWebview(webview);
        this._editorService.openEditor(topLevelEditor, {
            preserveFocus,
            // preserve pre 1.38 behaviour to not make group active when preserveFocus: true
            // but make sure to restore the editor to fix https://github.com/microsoft/vscode/issues/79633
            activation: preserveFocus ? EditorActivation.RESTORE : undefined
        }, group);
    }
    findTopLevelEditorForWebview(webview) {
        for (const editor of this._editorService.editors) {
            if (editor === webview) {
                return editor;
            }
            if (editor instanceof DiffEditorInput) {
                if (webview === editor.primary || webview === editor.secondary) {
                    return editor;
                }
            }
        }
        return webview;
    }
    openRevivedWebview(options) {
        const webview = this._webviewService.createWebviewOverlay(options.webviewInitInfo);
        webview.state = options.state;
        const webviewInput = this._instantiationService.createInstance(LazilyResolvedWebviewEditorInput, {
            viewType: options.viewType,
            providedId: options.webviewInitInfo.providedViewType,
            name: options.title,
            iconPath: options.iconPath
        }, webview);
        webviewInput.iconPath = options.iconPath;
        if (typeof options.group === 'number') {
            webviewInput.updateGroup(options.group);
        }
        return webviewInput;
    }
    registerResolver(reviver) {
        this._revivers.add(reviver);
        const cts = new CancellationTokenSource();
        this._revivalPool.reviveFor(reviver, cts.token);
        return toDisposable(() => {
            this._revivers.delete(reviver);
            cts.dispose(true);
        });
    }
    shouldPersist(webview) {
        // Revived webviews may not have an actively registered reviver but we still want to persist them
        // since a reviver should exist when it is actually needed.
        if (webview instanceof LazilyResolvedWebviewEditorInput) {
            return true;
        }
        return Iterable.some(this._revivers.values(), reviver => canRevive(reviver, webview));
    }
    async tryRevive(webview, token) {
        for (const reviver of this._revivers.values()) {
            if (canRevive(reviver, webview)) {
                await reviver.resolveWebview(webview, token);
                return true;
            }
        }
        return false;
    }
    async resolveWebview(webview, token) {
        const didRevive = await this.tryRevive(webview, token);
        if (!didRevive && !token.isCancellationRequested) {
            // A reviver may not be registered yet. Put into pool and resolve promise when we can revive
            return this._revivalPool.enqueueForRestoration(webview, token);
        }
    }
};
WebviewEditorService = __decorate([
    __param(0, IEditorGroupsService),
    __param(1, IEditorService),
    __param(2, IInstantiationService),
    __param(3, IWebviewService)
], WebviewEditorService);
export { WebviewEditorService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2Vidmlld1dvcmtiZW5jaFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvd2Vidmlld1BhbmVsL2Jyb3dzZXIvd2Vidmlld1dvcmtiZW5jaFNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFxQix1QkFBdUIsRUFBRSxlQUFlLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUMvRyxPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxrQ0FBa0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDL0QsT0FBTyxFQUFFLGtCQUFrQixFQUFFLFVBQVUsRUFBZSxZQUFZLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqSCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNoRixPQUFPLEVBQUUsZUFBZSxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDcEgsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBRWxGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUU1RSxPQUFPLEVBQWdCLG9CQUFvQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDNUcsT0FBTyxFQUFxQixjQUFjLEVBQW1CLE1BQU0sa0RBQWtELENBQUM7QUFDdEgsT0FBTyxFQUFtQixlQUFlLEVBQW1CLE1BQU0sa0NBQWtDLENBQUM7QUFDckcsT0FBTyxF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