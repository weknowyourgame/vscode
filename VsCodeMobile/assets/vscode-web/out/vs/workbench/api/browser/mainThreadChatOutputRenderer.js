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
import { VSBuffer } from '../../../base/common/buffer.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { IChatOutputRendererService } from '../../contrib/chat/browser/chatOutputItemRenderer.js';
import { ExtHostContext } from '../common/extHost.protocol.js';
let MainThreadChatOutputRenderer = class MainThreadChatOutputRenderer extends Disposable {
    constructor(extHostContext, _mainThreadWebview, _rendererService) {
        super();
        this._mainThreadWebview = _mainThreadWebview;
        this._rendererService = _rendererService;
        this._webviewHandlePool = 0;
        this.registeredRenderers = new Map();
        this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostChatOutputRenderer);
    }
    dispose() {
        super.dispose();
        this.registeredRenderers.forEach(disposable => disposable.dispose());
        this.registeredRenderers.clear();
    }
    $registerChatOutputRenderer(viewType, extensionId, extensionLocation) {
        this._rendererService.registerRenderer(viewType, {
            renderOutputPart: async (mime, data, webview, token) => {
                const webviewHandle = `chat-output-${++this._webviewHandlePool}`;
                this._mainThreadWebview.addWebview(webviewHandle, webview, {
                    serializeBuffersForPostMessage: true,
                });
                this._proxy.$renderChatOutput(viewType, mime, VSBuffer.wrap(data), webviewHandle, token);
            },
        }, {
            extension: { id: extensionId, location: URI.revive(extensionLocation) }
        });
    }
    $unregisterChatOutputRenderer(viewType) {
        this.registeredRenderers.get(viewType)?.dispose();
    }
};
MainThreadChatOutputRenderer = __decorate([
    __param(2, IChatOutputRendererService)
], MainThreadChatOutputRenderer);
export { MainThreadChatOutputRenderer };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpblRocmVhZENoYXRPdXRwdXRSZW5kZXJlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZENoYXRPdXRwdXRSZW5kZXJlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDMUQsT0FBTyxFQUFFLFVBQVUsRUFBZSxNQUFNLG1DQUFtQyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxHQUFHLEVBQWlCLE1BQU0sNkJBQTZCLENBQUM7QUFFakUsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFFbEcsT0FBTyxFQUFrQyxjQUFjLEVBQXFDLE1BQU0sK0JBQStCLENBQUM7QUFHM0gsSUFBTSw0QkFBNEIsR0FBbEMsTUFBTSw0QkFBNkIsU0FBUSxVQUFVO0lBUTNELFlBQ0MsY0FBK0IsRUFDZCxrQkFBc0MsRUFDM0IsZ0JBQTZEO1FBRXpGLEtBQUssRUFBRSxDQUFDO1FBSFMsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUFvQjtRQUNWLHFCQUFnQixHQUFoQixnQkFBZ0IsQ0FBNEI7UUFQbEYsdUJBQWtCLEdBQUcsQ0FBQyxDQUFDO1FBRWQsd0JBQW1CLEdBQUcsSUFBSSxHQUFHLEVBQXNDLENBQUM7UUFRcEYsSUFBSSxDQUFDLE1BQU0sR0FBRyxjQUFjLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQ2pGLENBQUM7SUFFUSxPQUFPO1FBQ2YsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBRWhCLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUNyRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDbEMsQ0FBQztJQUVELDJCQUEyQixDQUFDLFFBQWdCLEVBQUUsV0FBZ0MsRUFBRSxpQkFBZ0M7UUFDL0csSUFBSSxDQUFDLGdCQUFnQixDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRTtZQUNoRCxnQkFBZ0IsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEVBQUU7Z0JBQ3RELE1BQU0sYUFBYSxHQUFHLGVBQWUsRUFBRSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztnQkFFakUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxhQUFhLEVBQUUsT0FBTyxFQUFFO29CQUMxRCw4QkFBOEIsRUFBRSxJQUFJO2lCQUNwQyxDQUFDLENBQUM7Z0JBRUgsSUFBSSxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsYUFBYSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzFGLENBQUM7U0FDRCxFQUFFO1lBQ0YsU0FBUyxFQUFFLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO1NBQ3ZFLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCw2QkFBNkIsQ0FBQyxRQUFnQjtRQUM3QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDO0lBQ25ELENBQUM7Q0FDRCxDQUFBO0FBM0NZLDRCQUE0QjtJQVd0QyxXQUFBLDBCQUEwQixDQUFBO0dBWGhCLDRCQUE0QixDQTJDeEMifQ==