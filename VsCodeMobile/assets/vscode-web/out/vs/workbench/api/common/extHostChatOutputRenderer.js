/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { MainContext } from './extHost.protocol.js';
import { Disposable } from './extHostTypes.js';
export class ExtHostChatOutputRenderer {
    constructor(mainContext, webviews) {
        this.webviews = webviews;
        this._renderers = new Map();
        this._proxy = mainContext.getProxy(MainContext.MainThreadChatOutputRenderer);
    }
    registerChatOutputRenderer(extension, viewType, renderer) {
        if (this._renderers.has(viewType)) {
            throw new Error(`Chat output renderer already registered for: ${viewType}`);
        }
        this._renderers.set(viewType, { extension, renderer });
        this._proxy.$registerChatOutputRenderer(viewType, extension.identifier, extension.extensionLocation);
        return new Disposable(() => {
            this._renderers.delete(viewType);
            this._proxy.$unregisterChatOutputRenderer(viewType);
        });
    }
    async $renderChatOutput(viewType, mime, valueData, webviewHandle, token) {
        const entry = this._renderers.get(viewType);
        if (!entry) {
            throw new Error(`No chat output renderer registered for: ${viewType}`);
        }
        const webview = this.webviews.createNewWebview(webviewHandle, {}, entry.extension);
        return entry.renderer.renderChatOutput(Object.freeze({ mime, value: valueData.buffer }), webview, {}, token);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdENoYXRPdXRwdXRSZW5kZXJlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0Q2hhdE91dHB1dFJlbmRlcmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBSWhHLE9BQU8sRUFBZ0QsV0FBVyxFQUFxQyxNQUFNLHVCQUF1QixDQUFDO0FBQ3JJLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUsvQyxNQUFNLE9BQU8seUJBQXlCO0lBU3JDLFlBQ0MsV0FBeUIsRUFDUixRQUF5QjtRQUF6QixhQUFRLEdBQVIsUUFBUSxDQUFpQjtRQVAxQixlQUFVLEdBQUcsSUFBSSxHQUFHLEVBR2pDLENBQUM7UUFNSixJQUFJLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLDRCQUE0QixDQUFDLENBQUM7SUFDOUUsQ0FBQztJQUVELDBCQUEwQixDQUFDLFNBQWdDLEVBQUUsUUFBZ0IsRUFBRSxRQUFtQztRQUNqSCxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDbkMsTUFBTSxJQUFJLEtBQUssQ0FBQyxnREFBZ0QsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUM3RSxDQUFDO1FBRUQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDdkQsSUFBSSxDQUFDLE1BQU0sQ0FBQywyQkFBMkIsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLFVBQVUsRUFBRSxTQUFTLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUVyRyxPQUFPLElBQUksVUFBVSxDQUFDLEdBQUcsRUFBRTtZQUMxQixJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNqQyxJQUFJLENBQUMsTUFBTSxDQUFDLDZCQUE2QixDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3JELENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxRQUFnQixFQUFFLElBQVksRUFBRSxTQUFtQixFQUFFLGFBQXFCLEVBQUUsS0FBd0I7UUFDM0gsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDNUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1osTUFBTSxJQUFJLEtBQUssQ0FBQywyQ0FBMkMsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUN4RSxDQUFDO1FBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNuRixPQUFPLEtBQUssQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUM5RyxDQUFDO0NBQ0QifQ==