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
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { autorun } from '../../../../base/common/observable.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { mcpAccessConfig } from '../../../../platform/mcp/common/mcpManagement.js';
import { observableConfigValue } from '../../../../platform/observable/common/platformObservableUtils.js';
import { mcpDiscoveryRegistry } from '../common/discovery/mcpDiscovery.js';
let McpDiscovery = class McpDiscovery extends Disposable {
    static { this.ID = 'workbench.contrib.mcp.discovery'; }
    constructor(instantiationService, configurationService) {
        super();
        const mcpAccessValue = observableConfigValue(mcpAccessConfig, "all" /* McpAccessValue.All */, configurationService);
        const store = this._register(new DisposableStore());
        this._register(autorun(reader => {
            store.clear();
            const value = mcpAccessValue.read(reader);
            if (value === "none" /* McpAccessValue.None */) {
                return;
            }
            for (const descriptor of mcpDiscoveryRegistry.getAll()) {
                const mcpDiscovery = instantiationService.createInstance(descriptor);
                if (value === "registry" /* McpAccessValue.Registry */ && !mcpDiscovery.fromGallery) {
                    mcpDiscovery.dispose();
                    continue;
                }
                store.add(mcpDiscovery);
                mcpDiscovery.start();
            }
        }));
    }
};
McpDiscovery = __decorate([
    __param(0, IInstantiationService),
    __param(1, IConfigurationService)
], McpDiscovery);
export { McpDiscovery };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwRGlzY292ZXJ5LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL21jcC9icm93c2VyL21jcERpc2NvdmVyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ25GLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsZUFBZSxFQUFrQixNQUFNLGtEQUFrRCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLG1FQUFtRSxDQUFDO0FBRTFHLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBRXBFLElBQU0sWUFBWSxHQUFsQixNQUFNLFlBQWEsU0FBUSxVQUFVO2FBQ3BCLE9BQUUsR0FBRyxpQ0FBaUMsQUFBcEMsQ0FBcUM7SUFFOUQsWUFDd0Isb0JBQTJDLEVBQzNDLG9CQUEyQztRQUVsRSxLQUFLLEVBQUUsQ0FBQztRQUVSLE1BQU0sY0FBYyxHQUFHLHFCQUFxQixDQUFDLGVBQWUsa0NBQXNCLG9CQUFvQixDQUFDLENBQUM7UUFDeEcsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGVBQWUsRUFBRSxDQUFDLENBQUM7UUFFcEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDL0IsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2QsTUFBTSxLQUFLLEdBQUcsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMxQyxJQUFJLEtBQUsscUNBQXdCLEVBQUUsQ0FBQztnQkFDbkMsT0FBTztZQUNSLENBQUM7WUFDRCxLQUFLLE1BQU0sVUFBVSxJQUFJLG9CQUFvQixDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUM7Z0JBQ3hELE1BQU0sWUFBWSxHQUFHLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDckUsSUFBSSxLQUFLLDZDQUE0QixJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsRUFBRSxDQUFDO29CQUNwRSxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQ3ZCLFNBQVM7Z0JBQ1YsQ0FBQztnQkFDRCxLQUFLLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUN4QixZQUFZLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDdEIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDOztBQTVCVyxZQUFZO0lBSXRCLFdBQUEscUJBQXFCLENBQUE7SUFDckIsV0FBQSxxQkFBcUIsQ0FBQTtHQUxYLFlBQVksQ0E2QnhCIn0=