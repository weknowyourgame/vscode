/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Barrier } from '../../../base/common/async.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
export class McpGalleryManifestIPCService extends Disposable {
    get mcpGalleryManifestStatus() {
        return this._mcpGalleryManifest ? "available" /* McpGalleryManifestStatus.Available */ : "unavailable" /* McpGalleryManifestStatus.Unavailable */;
    }
    constructor(server) {
        super();
        this._onDidChangeMcpGalleryManifest = this._register(new Emitter());
        this.onDidChangeMcpGalleryManifest = this._onDidChangeMcpGalleryManifest.event;
        this._onDidChangeMcpGalleryManifestStatus = this._register(new Emitter());
        this.onDidChangeMcpGalleryManifestStatus = this._onDidChangeMcpGalleryManifestStatus.event;
        this.barrier = new Barrier();
        server.registerChannel('mcpGalleryManifest', {
            listen: () => Event.None,
            call: async (context, command, args) => {
                switch (command) {
                    case 'setMcpGalleryManifest': {
                        const manifest = Array.isArray(args) ? args[0] : null;
                        return Promise.resolve(this.setMcpGalleryManifest(manifest));
                    }
                }
                throw new Error('Invalid call');
            }
        });
    }
    async getMcpGalleryManifest() {
        await this.barrier.wait();
        return this._mcpGalleryManifest ?? null;
    }
    setMcpGalleryManifest(manifest) {
        this._mcpGalleryManifest = manifest;
        this._onDidChangeMcpGalleryManifest.fire(manifest);
        this._onDidChangeMcpGalleryManifestStatus.fire(this.mcpGalleryManifestStatus);
        this.barrier.open();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwR2FsbGVyeU1hbmlmZXN0U2VydmljZUlwYy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9tY3AvY29tbW9uL21jcEdhbGxlcnlNYW5pZmVzdFNlcnZpY2VJcGMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBSS9ELE1BQU0sT0FBTyw0QkFBNkIsU0FBUSxVQUFVO0lBYTNELElBQUksd0JBQXdCO1FBQzNCLE9BQU8sSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUMsc0RBQW9DLENBQUMseURBQXFDLENBQUM7SUFDN0csQ0FBQztJQUVELFlBQVksTUFBK0I7UUFDMUMsS0FBSyxFQUFFLENBQUM7UUFkRCxtQ0FBOEIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUE4QixDQUFDLENBQUM7UUFDMUYsa0NBQTZCLEdBQUcsSUFBSSxDQUFDLDhCQUE4QixDQUFDLEtBQUssQ0FBQztRQUUzRSx5Q0FBb0MsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUE0QixDQUFDLENBQUM7UUFDOUYsd0NBQW1DLEdBQUcsSUFBSSxDQUFDLG9DQUFvQyxDQUFDLEtBQUssQ0FBQztRQUc5RSxZQUFPLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQztRQVF4QyxNQUFNLENBQUMsZUFBZSxDQUFDLG9CQUFvQixFQUFFO1lBQzVDLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSTtZQUN4QixJQUFJLEVBQUUsS0FBSyxFQUFLLE9BQWdCLEVBQUUsT0FBZSxFQUFFLElBQWMsRUFBYyxFQUFFO2dCQUNoRixRQUFRLE9BQU8sRUFBRSxDQUFDO29CQUNqQixLQUFLLHVCQUF1QixDQUFDLENBQUMsQ0FBQzt3QkFDOUIsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBK0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO3dCQUNwRixPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxDQUFNLENBQUM7b0JBQ25FLENBQUM7Z0JBQ0YsQ0FBQztnQkFDRCxNQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQ2pDLENBQUM7U0FDRCxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsS0FBSyxDQUFDLHFCQUFxQjtRQUMxQixNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDMUIsT0FBTyxJQUFJLENBQUMsbUJBQW1CLElBQUksSUFBSSxDQUFDO0lBQ3pDLENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxRQUFvQztRQUNqRSxJQUFJLENBQUMsbUJBQW1CLEdBQUcsUUFBUSxDQUFDO1FBQ3BDLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbkQsSUFBSSxDQUFDLG9DQUFvQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsQ0FBQztRQUM5RSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ3JCLENBQUM7Q0FFRCJ9