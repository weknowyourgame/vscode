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
import { net } from 'electron';
import { RequestService as NodeRequestService } from '../node/requestService.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { INativeEnvironmentService } from '../../environment/common/environment.js';
import { ILogService } from '../../log/common/log.js';
function getRawRequest(options) {
    // eslint-disable-next-line local/code-no-any-casts
    return net.request;
}
let RequestService = class RequestService extends NodeRequestService {
    constructor(configurationService, environmentService, logService) {
        super('local', configurationService, environmentService, logService);
    }
    request(options, token) {
        return super.request({ ...(options || {}), getRawRequest, isChromiumNetwork: true }, token);
    }
};
RequestService = __decorate([
    __param(0, IConfigurationService),
    __param(1, INativeEnvironmentService),
    __param(2, ILogService)
], RequestService);
export { RequestService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vcmVxdWVzdC9lbGVjdHJvbi11dGlsaXR5L3JlcXVlc3RTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFHL0IsT0FBTyxFQUF1QixjQUFjLElBQUksa0JBQWtCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUN0RyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUNwRixPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFFdEQsU0FBUyxhQUFhLENBQUMsT0FBd0I7SUFDOUMsbURBQW1EO0lBQ25ELE9BQU8sR0FBRyxDQUFDLE9BQXFDLENBQUM7QUFDbEQsQ0FBQztBQUVNLElBQU0sY0FBYyxHQUFwQixNQUFNLGNBQWUsU0FBUSxrQkFBa0I7SUFFckQsWUFDd0Isb0JBQTJDLEVBQ3ZDLGtCQUE2QyxFQUMzRCxVQUF1QjtRQUVwQyxLQUFLLENBQUMsT0FBTyxFQUFFLG9CQUFvQixFQUFFLGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ3RFLENBQUM7SUFFUSxPQUFPLENBQUMsT0FBd0IsRUFBRSxLQUF3QjtRQUNsRSxPQUFPLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxHQUFHLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxFQUFFLGFBQWEsRUFBRSxpQkFBaUIsRUFBRSxJQUFJLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUM3RixDQUFDO0NBQ0QsQ0FBQTtBQWJZLGNBQWM7SUFHeEIsV0FBQSxxQkFBcUIsQ0FBQTtJQUNyQixXQUFBLHlCQUF5QixDQUFBO0lBQ3pCLFdBQUEsV0FBVyxDQUFBO0dBTEQsY0FBYyxDQWExQiJ9