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
var WebviewProtocolProvider_1;
import { protocol } from 'electron';
import { COI, FileAccess, Schemas } from '../../../base/common/network.js';
import { URI } from '../../../base/common/uri.js';
import { IFileService } from '../../files/common/files.js';
let WebviewProtocolProvider = class WebviewProtocolProvider {
    static { WebviewProtocolProvider_1 = this; }
    static { this.validWebviewFilePaths = new Map([
        ['/index.html', { mime: 'text/html' }],
        ['/fake.html', { mime: 'text/html' }],
        ['/service-worker.js', { mime: 'application/javascript' }],
    ]); }
    constructor(_fileService) {
        this._fileService = _fileService;
        // Register the protocol for loading webview html
        const webviewHandler = this.handleWebviewRequest.bind(this);
        protocol.handle(Schemas.vscodeWebview, webviewHandler);
    }
    dispose() {
        protocol.unhandle(Schemas.vscodeWebview);
    }
    async handleWebviewRequest(request) {
        try {
            const uri = URI.parse(request.url);
            const entry = WebviewProtocolProvider_1.validWebviewFilePaths.get(uri.path);
            if (entry) {
                const relativeResourcePath = `vs/workbench/contrib/webview/browser/pre${uri.path}`;
                const url = FileAccess.asFileUri(relativeResourcePath);
                const content = await this._fileService.readFile(url);
                return new Response(content.value.buffer.buffer, {
                    headers: {
                        'Content-Type': entry.mime,
                        ...COI.getHeadersFromQuery(request.url),
                        'Cross-Origin-Resource-Policy': 'cross-origin',
                    }
                });
            }
            else {
                return new Response(null, { status: 403 });
            }
        }
        catch {
            // noop
        }
        return new Response(null, { status: 500 });
    }
};
WebviewProtocolProvider = WebviewProtocolProvider_1 = __decorate([
    __param(0, IFileService)
], WebviewProtocolProvider);
export { WebviewProtocolProvider };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2Vidmlld1Byb3RvY29sUHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vd2Vidmlldy9lbGVjdHJvbi1tYWluL3dlYnZpZXdQcm90b2NvbFByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRXBDLE9BQU8sRUFBbUIsR0FBRyxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUM1RixPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDbEQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBR3BELElBQU0sdUJBQXVCLEdBQTdCLE1BQU0sdUJBQXVCOzthQUVwQiwwQkFBcUIsR0FBRyxJQUFJLEdBQUcsQ0FBb0M7UUFDakYsQ0FBQyxhQUFhLEVBQUUsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLENBQUM7UUFDdEMsQ0FBQyxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLENBQUM7UUFDckMsQ0FBQyxvQkFBb0IsRUFBRSxFQUFFLElBQUksRUFBRSx3QkFBd0IsRUFBRSxDQUFDO0tBQzFELENBQUMsQUFKa0MsQ0FJakM7SUFFSCxZQUNnQyxZQUEwQjtRQUExQixpQkFBWSxHQUFaLFlBQVksQ0FBYztRQUV6RCxpREFBaUQ7UUFDakQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM1RCxRQUFRLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDeEQsQ0FBQztJQUVELE9BQU87UUFDTixRQUFRLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRU8sS0FBSyxDQUFDLG9CQUFvQixDQUFDLE9BQXNCO1FBQ3hELElBQUksQ0FBQztZQUNKLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ25DLE1BQU0sS0FBSyxHQUFHLHlCQUF1QixDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDMUUsSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDWCxNQUFNLG9CQUFvQixHQUFvQiwyQ0FBMkMsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNwRyxNQUFNLEdBQUcsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLG9CQUFvQixDQUFDLENBQUM7Z0JBRXZELE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ3RELE9BQU8sSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBcUIsRUFBRTtvQkFDL0QsT0FBTyxFQUFFO3dCQUNSLGNBQWMsRUFBRSxLQUFLLENBQUMsSUFBSTt3QkFDMUIsR0FBRyxHQUFHLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQzt3QkFDdkMsOEJBQThCLEVBQUUsY0FBYztxQkFDOUM7aUJBQ0QsQ0FBQyxDQUFDO1lBQ0osQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE9BQU8sSUFBSSxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7WUFDNUMsQ0FBQztRQUNGLENBQUM7UUFBQyxNQUFNLENBQUM7WUFDUixPQUFPO1FBQ1IsQ0FBQztRQUNELE9BQU8sSUFBSSxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDNUMsQ0FBQzs7QUEzQ1csdUJBQXVCO0lBU2pDLFdBQUEsWUFBWSxDQUFBO0dBVEYsdUJBQXVCLENBNENuQyJ9