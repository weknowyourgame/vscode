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
import { onUnexpectedError } from '../../../base/common/errors.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../base/common/lifecycle.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { reviveWebviewExtension } from './mainThreadWebviews.js';
import * as extHostProtocol from '../common/extHost.protocol.js';
import { IWebviewViewService } from '../../contrib/webviewView/browser/webviewViewService.js';
import { ITelemetryService } from '../../../platform/telemetry/common/telemetry.js';
let MainThreadWebviewsViews = class MainThreadWebviewsViews extends Disposable {
    constructor(context, mainThreadWebviews, _telemetryService, _webviewViewService) {
        super();
        this.mainThreadWebviews = mainThreadWebviews;
        this._telemetryService = _telemetryService;
        this._webviewViewService = _webviewViewService;
        this._webviewViews = this._register(new DisposableMap());
        this._webviewViewProviders = this._register(new DisposableMap());
        this._proxy = context.getProxy(extHostProtocol.ExtHostContext.ExtHostWebviewViews);
    }
    $setWebviewViewTitle(handle, value) {
        const webviewView = this.getWebviewView(handle);
        webviewView.title = value;
    }
    $setWebviewViewDescription(handle, value) {
        const webviewView = this.getWebviewView(handle);
        webviewView.description = value;
    }
    $setWebviewViewBadge(handle, badge) {
        const webviewView = this.getWebviewView(handle);
        webviewView.badge = badge;
    }
    $show(handle, preserveFocus) {
        const webviewView = this.getWebviewView(handle);
        webviewView.show(preserveFocus);
    }
    $registerWebviewViewProvider(extensionData, viewType, options) {
        if (this._webviewViewProviders.has(viewType)) {
            throw new Error(`View provider for ${viewType} already registered`);
        }
        const extension = reviveWebviewExtension(extensionData);
        const registration = this._webviewViewService.register(viewType, {
            resolve: async (webviewView, cancellation) => {
                const handle = generateUuid();
                this._webviewViews.set(handle, webviewView);
                this.mainThreadWebviews.addWebview(handle, webviewView.webview, { serializeBuffersForPostMessage: options.serializeBuffersForPostMessage });
                let state = undefined;
                if (webviewView.webview.state) {
                    try {
                        state = JSON.parse(webviewView.webview.state);
                    }
                    catch (e) {
                        console.error('Could not load webview state', e, webviewView.webview.state);
                    }
                }
                webviewView.webview.extension = extension;
                if (options) {
                    webviewView.webview.options = options;
                }
                const subscriptions = new DisposableStore();
                subscriptions.add(webviewView.onDidChangeVisibility(visible => {
                    this._proxy.$onDidChangeWebviewViewVisibility(handle, visible);
                }));
                subscriptions.add(webviewView.onDispose(() => {
                    this._proxy.$disposeWebviewView(handle);
                    this._webviewViews.deleteAndDispose(handle);
                    subscriptions.dispose();
                }));
                this._telemetryService.publicLog2('webviews:createWebviewView', {
                    extensionId: extension.id.value,
                    id: viewType,
                });
                try {
                    await this._proxy.$resolveWebviewView(handle, viewType, webviewView.title, state, cancellation);
                }
                catch (error) {
                    onUnexpectedError(error);
                    webviewView.webview.setHtml(this.mainThreadWebviews.getWebviewResolvedFailedContent(viewType));
                }
            }
        });
        this._webviewViewProviders.set(viewType, registration);
    }
    $unregisterWebviewViewProvider(viewType) {
        if (!this._webviewViewProviders.has(viewType)) {
            throw new Error(`No view provider for ${viewType} registered`);
        }
        this._webviewViewProviders.deleteAndDispose(viewType);
    }
    getWebviewView(handle) {
        const webviewView = this._webviewViews.get(handle);
        if (!webviewView) {
            throw new Error('unknown webview view');
        }
        return webviewView;
    }
};
MainThreadWebviewsViews = __decorate([
    __param(2, ITelemetryService),
    __param(3, IWebviewViewService)
], MainThreadWebviewsViews);
export { MainThreadWebviewsViews };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZFdlYnZpZXdWaWV3cy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZFdlYnZpZXdWaWV3cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUdoRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMvRixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDNUQsT0FBTyxFQUFzQixzQkFBc0IsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ3JGLE9BQU8sS0FBSyxlQUFlLE1BQU0sK0JBQStCLENBQUM7QUFFakUsT0FBTyxFQUFFLG1CQUFtQixFQUFlLE1BQU0seURBQXlELENBQUM7QUFDM0csT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0saURBQWlELENBQUM7QUFJN0UsSUFBTSx1QkFBdUIsR0FBN0IsTUFBTSx1QkFBd0IsU0FBUSxVQUFVO0lBT3RELFlBQ0MsT0FBd0IsRUFDUCxrQkFBc0MsRUFDcEMsaUJBQXFELEVBQ25ELG1CQUF5RDtRQUU5RSxLQUFLLEVBQUUsQ0FBQztRQUpTLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBb0I7UUFDbkIsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFtQjtRQUNsQyx3QkFBbUIsR0FBbkIsbUJBQW1CLENBQXFCO1FBUDlELGtCQUFhLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGFBQWEsRUFBdUIsQ0FBQyxDQUFDO1FBQ3pFLDBCQUFxQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxhQUFhLEVBQVUsQ0FBQyxDQUFDO1FBVXBGLElBQUksQ0FBQyxNQUFNLEdBQUcs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