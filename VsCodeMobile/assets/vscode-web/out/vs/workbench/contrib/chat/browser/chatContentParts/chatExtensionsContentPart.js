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
import './media/chatExtensionsContent.css';
import * as dom from '../../../../../base/browser/dom.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ExtensionsList, getExtensions } from '../../../extensions/browser/extensionsViewer.js';
import { IExtensionsWorkbenchService } from '../../../extensions/common/extensions.js';
import { ChatViewId } from '../chat.js';
import { PagedModel } from '../../../../../base/common/paging.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
let ChatExtensionsContentPart = class ChatExtensionsContentPart extends Disposable {
    get codeblocks() {
        return [];
    }
    get codeblocksPartId() {
        return undefined;
    }
    constructor(extensionsContent, extensionsWorkbenchService, instantiationService) {
        super();
        this.extensionsContent = extensionsContent;
        this._onDidChangeHeight = this._register(new Emitter());
        this.onDidChangeHeight = this._onDidChangeHeight.event;
        this.domNode = dom.$('.chat-extensions-content-part');
        const loadingElement = dom.append(this.domNode, dom.$('.loading-extensions-element'));
        dom.append(loadingElement, dom.$(ThemeIcon.asCSSSelector(ThemeIcon.modify(Codicon.loading, 'spin'))), dom.$('span.loading-message', undefined, localize('chat.extensions.loading', 'Loading extensions...')));
        const extensionsList = dom.append(this.domNode, dom.$('.extensions-list'));
        const list = this._register(instantiationService.createInstance(ExtensionsList, extensionsList, ChatViewId, { alwaysConsumeMouseWheel: false }, { onFocus: Event.None, onBlur: Event.None, filters: {} }));
        getExtensions(extensionsContent.extensions, extensionsWorkbenchService).then(extensions => {
            loadingElement.remove();
            if (this._store.isDisposed) {
                return;
            }
            list.setModel(new PagedModel(extensions));
            list.layout();
            this._onDidChangeHeight.fire();
        });
    }
    hasSameContent(other, followingContent, element) {
        return other.kind === 'extensions' && other.extensions.length === this.extensionsContent.extensions.length && other.extensions.every(ext => this.extensionsContent.extensions.includes(ext));
    }
    addDisposable(disposable) {
        this._register(disposable);
    }
};
ChatExtensionsContentPart = __decorate([
    __param(1, IExtensionsWorkbenchService),
    __param(2, IInstantiationService)
], ChatExtensionsContentPart);
export { ChatExtensionsContentPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEV4dGVuc2lvbnNDb250ZW50UGFydC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy9jaGF0RXh0ZW5zaW9uc0NvbnRlbnRQYXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sbUNBQW1DLENBQUM7QUFDM0MsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQ0FBb0MsQ0FBQztBQUMxRCxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxVQUFVLEVBQWUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNsRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUN0RyxPQUFPLEVBQUUsY0FBYyxFQUFFLGFBQWEsRUFBRSxNQUFNLGlEQUFpRCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBR3ZGLE9BQU8sRUFBZ0IsVUFBVSxFQUFzQixNQUFNLFlBQVksQ0FBQztBQUUxRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFFMUMsSUFBTSx5QkFBeUIsR0FBL0IsTUFBTSx5QkFBMEIsU0FBUSxVQUFVO0lBTXhELElBQVcsVUFBVTtRQUNwQixPQUFPLEVBQUUsQ0FBQztJQUNYLENBQUM7SUFFRCxJQUFXLGdCQUFnQjtRQUMxQixPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsWUFDa0IsaUJBQXlDLEVBQzdCLDBCQUF1RCxFQUM3RCxvQkFBMkM7UUFFbEUsS0FBSyxFQUFFLENBQUM7UUFKUyxzQkFBaUIsR0FBakIsaUJBQWlCLENBQXdCO1FBWm5ELHVCQUFrQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVEsQ0FBQyxDQUFDO1FBQ2pELHNCQUFpQixHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUM7UUFpQmpFLElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO1FBQ3RELE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLDZCQUE2QixDQUFDLENBQUMsQ0FBQztRQUN0RixHQUFHLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLHNCQUFzQixFQUFFLFNBQVMsRUFBRSxRQUFRLENBQUMseUJBQXlCLEVBQUUsdUJBQXVCLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFOU0sTUFBTSxjQUFjLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO1FBQzNFLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsY0FBYyxDQUFDLGNBQWMsRUFBRSxjQUFjLEVBQUUsVUFBVSxFQUFFLEVBQUUsdUJBQXVCLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzNNLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEVBQUUsMEJBQTBCLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDekYsY0FBYyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3hCLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztnQkFDNUIsT0FBTztZQUNSLENBQUM7WUFDRCxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDMUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2QsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2hDLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELGNBQWMsQ0FBQyxLQUEyQixFQUFFLGdCQUF3QyxFQUFFLE9BQXFCO1FBQzFHLE9BQU8sS0FBSyxDQUFDLElBQUksS0FBSyxZQUFZLElBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzlMLENBQUM7SUFFRCxhQUFhLENBQUMsVUFBdUI7UUFDcEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUM1QixDQUFDO0NBQ0QsQ0FBQTtBQTdDWSx5QkFBeUI7SUFnQm5DLFdBQUEsMkJBQTJCLENBQUE7SUFDM0IsV0FBQSxxQkFBcUIsQ0FBQTtHQWpCWCx5QkFBeUIsQ0E2Q3JDIn0=