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
import { transformOutgoingURIs } from '../../../base/common/uriIpc.js';
import { INativeMcpDiscoveryHelperService } from '../common/nativeMcpDiscoveryHelper.js';
let NativeMcpDiscoveryHelperChannel = class NativeMcpDiscoveryHelperChannel {
    constructor(getUriTransformer, nativeMcpDiscoveryHelperService) {
        this.getUriTransformer = getUriTransformer;
        this.nativeMcpDiscoveryHelperService = nativeMcpDiscoveryHelperService;
    }
    listen(context, event) {
        throw new Error('Invalid listen');
    }
    async call(context, command, args) {
        const uriTransformer = this.getUriTransformer?.(context);
        switch (command) {
            case 'load': {
                const result = await this.nativeMcpDiscoveryHelperService.load();
                return (uriTransformer ? transformOutgoingURIs(result, uriTransformer) : result);
            }
        }
        throw new Error('Invalid call');
    }
};
NativeMcpDiscoveryHelperChannel = __decorate([
    __param(1, INativeMcpDiscoveryHelperService)
], NativeMcpDiscoveryHelperChannel);
export { NativeMcpDiscoveryHelperChannel };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmF0aXZlTWNwRGlzY292ZXJ5SGVscGVyQ2hhbm5lbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9tY3Avbm9kZS9uYXRpdmVNY3BEaXNjb3ZlcnlIZWxwZXJDaGFubmVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBR2hHLE9BQU8sRUFBbUIscUJBQXFCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUd4RixPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUVsRixJQUFNLCtCQUErQixHQUFyQyxNQUFNLCtCQUErQjtJQUUzQyxZQUNrQixpQkFBa0csRUFDekUsK0JBQWlFO1FBRDFGLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBaUY7UUFDekUsb0NBQStCLEdBQS9CLCtCQUErQixDQUFrQztJQUN4RyxDQUFDO0lBRUwsTUFBTSxDQUFJLE9BQXFDLEVBQUUsS0FBYTtRQUM3RCxNQUFNLElBQUksS0FBSyxDQUFDLGdCQUFnQixDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUVELEtBQUssQ0FBQyxJQUFJLENBQUksT0FBcUMsRUFBRSxPQUFlLEVBQUUsSUFBYztRQUNuRixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN6RCxRQUFRLE9BQU8sRUFBRSxDQUFDO1lBQ2pCLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFDYixNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDakUsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMscUJBQXFCLENBQUMsTUFBTSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQU0sQ0FBQztZQUN2RixDQUFDO1FBQ0YsQ0FBQztRQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDakMsQ0FBQztDQUNELENBQUE7QUFyQlksK0JBQStCO0lBSXpDLFdBQUEsZ0NBQWdDLENBQUE7R0FKdEIsK0JBQStCLENBcUIzQyJ9