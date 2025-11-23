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
import { Barrier } from '../../../base/common/async.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { IProductService } from '../../product/common/productService.js';
import { ExtensionGalleryManifestService } from './extensionGalleryManifestService.js';
let ExtensionGalleryManifestIPCService = class ExtensionGalleryManifestIPCService extends ExtensionGalleryManifestService {
    get extensionGalleryManifestStatus() {
        return this._extensionGalleryManifest ? "available" /* ExtensionGalleryManifestStatus.Available */ : "unavailable" /* ExtensionGalleryManifestStatus.Unavailable */;
    }
    constructor(server, productService) {
        super(productService);
        this._onDidChangeExtensionGalleryManifest = this._register(new Emitter());
        this.onDidChangeExtensionGalleryManifest = this._onDidChangeExtensionGalleryManifest.event;
        this._onDidChangeExtensionGalleryManifestStatus = this._register(new Emitter());
        this.onDidChangeExtensionGalleryManifestStatus = this._onDidChangeExtensionGalleryManifestStatus.event;
        this.barrier = new Barrier();
        server.registerChannel('extensionGalleryManifest', {
            listen: () => Event.None,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            call: async (context, command, args) => {
                switch (command) {
                    case 'setExtensionGalleryManifest': return Promise.resolve(this.setExtensionGalleryManifest(args[0]));
                }
                throw new Error('Invalid call');
            }
        });
    }
    async getExtensionGalleryManifest() {
        await this.barrier.wait();
        return this._extensionGalleryManifest ?? null;
    }
    setExtensionGalleryManifest(manifest) {
        this._extensionGalleryManifest = manifest;
        this._onDidChangeExtensionGalleryManifest.fire(manifest);
        this._onDidChangeExtensionGalleryManifestStatus.fire(this.extensionGalleryManifestStatus);
        this.barrier.open();
    }
};
ExtensionGalleryManifestIPCService = __decorate([
    __param(1, IProductService)
], ExtensionGalleryManifestIPCService);
export { ExtensionGalleryManifestIPCService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZUlwYy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlSXBjLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUN4RCxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBRS9ELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUV6RSxPQUFPLEVBQUUsK0JBQStCLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUVoRixJQUFNLGtDQUFrQyxHQUF4QyxNQUFNLGtDQUFtQyxTQUFRLCtCQUErQjtJQWF0RixJQUFhLDhCQUE4QjtRQUMxQyxPQUFPLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLDREQUEwQyxDQUFDLCtEQUEyQyxDQUFDO0lBQy9ILENBQUM7SUFFRCxZQUNDLE1BQStCLEVBQ2QsY0FBK0I7UUFFaEQsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBakJmLHlDQUFvQyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQW9DLENBQUMsQ0FBQztRQUM3Rix3Q0FBbUMsR0FBRyxJQUFJLENBQUMsb0NBQW9DLENBQUMsS0FBSyxDQUFDO1FBRWhHLCtDQUEwQyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQWtDLENBQUMsQ0FBQztRQUNqRyw4Q0FBeUMsR0FBRyxJQUFJLENBQUMsMENBQTBDLENBQUMsS0FBSyxDQUFDO1FBR25HLFlBQU8sR0FBRyxJQUFJLE9BQU8sRUFBRSxDQUFDO1FBV3hDLE1BQU0sQ0FBQyxlQUFlLENBQUMsMEJBQTBCLEVBQUU7WUFDbEQsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxJQUFJO1lBQ3hCLDhEQUE4RDtZQUM5RCxJQUFJLEVBQUUsS0FBSyxFQUFFLE9BQVksRUFBRSxPQUFlLEVBQUUsSUFBVSxFQUFnQixFQUFFO2dCQUN2RSxRQUFRLE9BQU8sRUFBRSxDQUFDO29CQUNqQixLQUFLLDZCQUE2QixDQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN2RyxDQUFDO2dCQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDakMsQ0FBQztTQUNELENBQUMsQ0FBQztJQUNKLENBQUM7SUFFUSxLQUFLLENBQUMsMkJBQTJCO1FBQ3pDLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUMxQixPQUFPLElBQUksQ0FBQyx5QkFBeUIsSUFBSSxJQUFJLENBQUM7SUFDL0MsQ0FBQztJQUVPLDJCQUEyQixDQUFDLFFBQTBDO1FBQzdFLElBQUksQ0FBQyx5QkFBeUIsR0FBRyxRQUFRLENBQUM7UUFDMUMsSUFBSSxDQUFDLG9DQUFvQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN6RCxJQUFJLENBQUMsMENBQTBDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO1FBQzFGLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDckIsQ0FBQztDQUVELENBQUE7QUE5Q1ksa0NBQWtDO0lBbUI1QyxXQUFBLGVBQWUsQ0FBQTtHQW5CTCxrQ0FBa0MsQ0E4QzlDIn0=