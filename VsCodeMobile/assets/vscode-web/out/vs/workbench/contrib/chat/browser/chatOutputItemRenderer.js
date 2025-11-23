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
import { getWindow } from '../../../../base/browser/dom.js';
import { raceCancellationError } from '../../../../base/common/async.js';
import { matchesMimeType } from '../../../../base/common/dataTransfer.js';
import { CancellationError } from '../../../../base/common/errors.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { autorun } from '../../../../base/common/observable.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import * as nls from '../../../../nls.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IWebviewService } from '../../../contrib/webview/browser/webview.js';
import { IExtensionService, isProposedApiEnabled } from '../../../services/extensions/common/extensions.js';
import { ExtensionsRegistry } from '../../../services/extensions/common/extensionsRegistry.js';
export const IChatOutputRendererService = createDecorator('chatOutputRendererService');
let ChatOutputRendererService = class ChatOutputRendererService extends Disposable {
    constructor(_webviewService, _extensionService) {
        super();
        this._webviewService = _webviewService;
        this._extensionService = _extensionService;
        this._contributions = new Map();
        this._renderers = new Map();
        this._register(chatOutputRenderContributionPoint.setHandler(extensions => {
            this.updateContributions(extensions);
        }));
    }
    registerRenderer(viewType, renderer, options) {
        this._renderers.set(viewType, { renderer, options });
        return {
            dispose: () => {
                this._renderers.delete(viewType);
            }
        };
    }
    async renderOutputPart(mime, data, parent, webviewOptions, token) {
        const rendererData = await this.getRenderer(mime, token);
        if (token.isCancellationRequested) {
            throw new CancellationError();
        }
        if (!rendererData) {
            throw new Error(`No renderer registered found for mime type: ${mime}`);
        }
        const store = new DisposableStore();
        const webview = store.add(this._webviewService.createWebviewElement({
            title: '',
            origin: webviewOptions.origin ?? generateUuid(),
            options: {
                enableFindWidget: false,
                purpose: "chatOutputItem" /* WebviewContentPurpose.ChatOutputItem */,
                tryRestoreScrollPosition: false,
            },
            contentOptions: {},
            extension: rendererData.options.extension ? rendererData.options.extension : undefined,
        }));
        const onDidChangeHeight = store.add(new Emitter());
        store.add(autorun(reader => {
            const height = reader.readObservable(webview.intrinsicContentSize);
            if (height) {
                onDidChangeHeight.fire(height.height);
                parent.style.height = `${height.height}px`;
            }
        }));
        webview.mountTo(parent, getWindow(parent));
        await rendererData.renderer.renderOutputPart(mime, data, webview, token);
        return {
            get webview() { return webview; },
            onDidChangeHeight: onDidChangeHeight.event,
            dispose: () => {
                store.dispose();
            },
            reinitialize: () => {
                webview.reinitializeAfterDismount();
            },
        };
    }
    async getRenderer(mime, token) {
        await raceCancellationError(this._extensionService.whenInstalledExtensionsRegistered(), token);
        for (const [id, value] of this._contributions) {
            if (value.mimes.some(m => matchesMimeType(m, [mime]))) {
                await raceCancellationError(this._extensionService.activateByEvent(`onChatOutputRenderer:${id}`), token);
                const rendererData = this._renderers.get(id);
                if (rendererData) {
                    return rendererData;
                }
            }
        }
        return undefined;
    }
    updateContributions(extensions) {
        this._contributions.clear();
        for (const extension of extensions) {
            if (!isProposedApiEnabled(extension.description, 'chatOutputRenderer')) {
                continue;
            }
            for (const contribution of extension.value) {
                if (this._contributions.has(contribution.viewType)) {
                    extension.collector.error(`Chat output renderer with view type '${contribution.viewType}' already registered`);
                    continue;
                }
                this._contributions.set(contribution.viewType, {
                    mimes: contribution.mimeTypes,
                });
            }
        }
    }
};
ChatOutputRendererService = __decorate([
    __param(0, IWebviewService),
    __param(1, IExtensionService)
], ChatOutputRendererService);
export { ChatOutputRendererService };
const chatOutputRendererContributionSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['viewType', 'mimeTypes'],
    properties: {
        viewType: {
            type: 'string',
            description: nls.localize('chatOutputRenderer.viewType', 'Unique identifier for the renderer.'),
        },
        mimeTypes: {
            type: 'array',
            description: nls.localize('chatOutputRenderer.mimeTypes', 'MIME types that this renderer can handle'),
            items: {
                type: 'string'
            }
        }
    }
};
const chatOutputRenderContributionPoint = ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: 'chatOutputRenderers',
    activationEventsGenerator: function* (contributions) {
        for (const contrib of contributions) {
            yield `onChatOutputRenderer:${contrib.viewType}`;
        }
    },
    jsonSchema: {
        description: nls.localize('vscode.extension.contributes.chatOutputRenderer', 'Contributes a renderer for specific MIME types in chat outputs'),
        type: 'array',
        items: chatOutputRendererContributionSchema,
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE91dHB1dEl0ZW1SZW5kZXJlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdE91dHB1dEl0ZW1SZW5kZXJlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDNUQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFFekUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxrQ0FBa0MsQ0FBQztBQUVsRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBZSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUVoRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDL0QsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUUxQyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDN0YsT0FBTyxFQUFZLGVBQWUsRUFBeUIsTUFBTSw2Q0FBNkMsQ0FBQztBQUMvRyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUM1RyxPQUFPLEVBQUUsa0JBQWtCLEVBQXVCLE1BQU0sMkRBQTJELENBQUM7QUFhcEgsTUFBTSxDQUFDLE1BQU0sMEJBQTBCLEdBQUcsZUFBZSxDQUE2QiwyQkFBMkIsQ0FBQyxDQUFDO0FBMkI1RyxJQUFNLHlCQUF5QixHQUEvQixNQUFNLHlCQUEwQixT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