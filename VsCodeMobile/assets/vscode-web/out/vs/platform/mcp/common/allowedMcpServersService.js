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
import { Disposable } from '../../../base/common/lifecycle.js';
import * as nls from '../../../nls.js';
import { createCommandUri, MarkdownString } from '../../../base/common/htmlContent.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { Emitter } from '../../../base/common/event.js';
import { mcpAccessConfig } from './mcpManagement.js';
let AllowedMcpServersService = class AllowedMcpServersService extends Disposable {
    constructor(configurationService) {
        super();
        this.configurationService = configurationService;
        this._onDidChangeAllowedMcpServers = this._register(new Emitter());
        this.onDidChangeAllowedMcpServers = this._onDidChangeAllowedMcpServers.event;
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(mcpAccessConfig)) {
                this._onDidChangeAllowedMcpServers.fire();
            }
        }));
    }
    isAllowed(mcpServer) {
        if (this.configurationService.getValue(mcpAccessConfig) !== "none" /* McpAccessValue.None */) {
            return true;
        }
        const settingsCommandLink = createCommandUri('workbench.action.openSettings', { query: `@id:${mcpAccessConfig}` }).toString();
        return new MarkdownString(nls.localize('mcp servers are not allowed', "Model Context Protocol servers are disabled in the Editor. Please check your [settings]({0}).", settingsCommandLink));
    }
};
AllowedMcpServersService = __decorate([
    __param(0, IConfigurationService)
], AllowedMcpServersService);
export { AllowedMcpServersService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxsb3dlZE1jcFNlcnZlcnNTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL21jcC9jb21tb24vYWxsb3dlZE1jcFNlcnZlcnNTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUMvRCxPQUFPLEtBQUssR0FBRyxNQUFNLGlCQUFpQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBbUIsY0FBYyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDeEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDcEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBd0YsZUFBZSxFQUFrQixNQUFNLG9CQUFvQixDQUFDO0FBRXBKLElBQU0sd0JBQXdCLEdBQTlCLE1BQU0sd0JBQXlCLFNBQVEsVUFBVTtJQU92RCxZQUN3QixvQkFBNEQ7UUFFbkYsS0FBSyxFQUFFLENBQUM7UUFGZ0MseUJBQW9CLEdBQXBCLG9CQUFvQixDQUF1QjtRQUo1RSxrQ0FBNkIsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUNuRSxpQ0FBNEIsR0FBRyxJQUFJLENBQUMsNkJBQTZCLENBQUMsS0FBSyxDQUFDO1FBTWhGLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ3JFLElBQUksQ0FBQyxDQUFDLG9CQUFvQixDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUM7Z0JBQzdDLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUMzQyxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxTQUFTLENBQUMsU0FBc0U7UUFDL0UsSUFBSSxJQUFJLENBQUMsb0JBQW9CLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxxQ0FBd0IsRUFBRSxDQUFDO1lBQ2pGLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELE1BQU0sbUJBQW1CLEdBQUcsZ0JBQWdCLENBQUMsK0JBQStCLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxlQUFlLEVBQUUsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDOUgsT0FBTyxJQUFJLGNBQWMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLDZCQUE2QixFQUFFLCtGQUErRixFQUFFLG1CQUFtQixDQUFDLENBQUMsQ0FBQztJQUM5TCxDQUFDO0NBQ0QsQ0FBQTtBQTFCWSx3QkFBd0I7SUFRbEMsV0FBQSxxQkFBcUIsQ0FBQTtHQVJYLHdCQUF3QixDQTBCcEMifQ==