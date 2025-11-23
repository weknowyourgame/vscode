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
import { ProxyChannel } from '../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../ipc/common/mainProcessService.js';
// @ts-ignore: interface is implemented via proxy
let NativeBrowserElementsService = class NativeBrowserElementsService {
    constructor(windowId, mainProcessService) {
        this.windowId = windowId;
        return ProxyChannel.toService(mainProcessService.getChannel('browserElements'), {
            context: windowId,
            properties: (() => {
                const properties = new Map();
                properties.set('windowId', windowId);
                return properties;
            })()
        });
    }
};
NativeBrowserElementsService = __decorate([
    __param(1, IMainProcessService)
], NativeBrowserElementsService);
export { NativeBrowserElementsService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmF0aXZlQnJvd3NlckVsZW1lbnRzU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9icm93c2VyRWxlbWVudHMvY29tbW9uL25hdGl2ZUJyb3dzZXJFbGVtZW50c1NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRzdFLGlEQUFpRDtBQUMxQyxJQUFNLDRCQUE0QixHQUFsQyxNQUFNLDRCQUE0QjtJQUl4QyxZQUNVLFFBQWdCLEVBQ0osa0JBQXVDO1FBRG5ELGFBQVEsR0FBUixRQUFRLENBQVE7UUFHekIsT0FBTyxZQUFZLENBQUMsU0FBUyxDQUFnQyxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsaUJBQWlCLENBQUMsRUFBRTtZQUM5RyxPQUFPLEVBQUUsUUFBUTtZQUNqQixVQUFVLEVBQUUsQ0FBQyxHQUFHLEVBQUU7Z0JBQ2pCLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxFQUFtQixDQUFDO2dCQUM5QyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztnQkFFckMsT0FBTyxVQUFVLENBQUM7WUFDbkIsQ0FBQyxDQUFDLEVBQUU7U0FDSixDQUFDLENBQUM7SUFDSixDQUFDO0NBQ0QsQ0FBQTtBQWxCWSw0QkFBNEI7SUFNdEMsV0FBQSxtQkFBbUIsQ0FBQTtHQU5ULDRCQUE0QixDQWtCeEMifQ==