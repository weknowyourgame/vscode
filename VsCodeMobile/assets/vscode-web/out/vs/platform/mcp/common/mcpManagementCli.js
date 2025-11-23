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
import { IMcpManagementService } from './mcpManagement.js';
let McpManagementCli = class McpManagementCli {
    constructor(_logger, _mcpManagementService) {
        this._logger = _logger;
        this._mcpManagementService = _mcpManagementService;
    }
    async addMcpDefinitions(definitions) {
        const configs = definitions.map((config) => this.validateConfiguration(config));
        await this.updateMcpInResource(configs);
        this._logger.info(`Added MCP servers: ${configs.map(c => c.name).join(', ')}`);
    }
    async updateMcpInResource(configs) {
        await Promise.all(configs.map(({ name, config, inputs }) => this._mcpManagementService.install({ name, config, inputs })));
    }
    validateConfiguration(config) {
        let parsed;
        try {
            parsed = JSON.parse(config);
        }
        catch (e) {
            throw new InvalidMcpOperationError(`Invalid JSON '${config}': ${e}`);
        }
        if (!parsed.name) {
            throw new InvalidMcpOperationError(`Missing name property in ${config}`);
        }
        if (!('command' in parsed) && !('url' in parsed)) {
            throw new InvalidMcpOperationError(`Missing command or URL property in ${config}`);
        }
        const { name, inputs, ...rest } = parsed;
        return { name, inputs, config: rest };
    }
};
McpManagementCli = __decorate([
    __param(1, IMcpManagementService)
], McpManagementCli);
export { McpManagementCli };
class InvalidMcpOperationError extends Error {
    constructor(message) {
        super(message);
        this.stack = message;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwTWFuYWdlbWVudENsaS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9tY3AvY29tbW9uL21jcE1hbmFnZW1lbnRDbGkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFJaEcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFJcEQsSUFBTSxnQkFBZ0IsR0FBdEIsTUFBTSxnQkFBZ0I7SUFDNUIsWUFDa0IsT0FBZ0IsRUFDTyxxQkFBNEM7UUFEbkUsWUFBTyxHQUFQLE9BQU8sQ0FBUztRQUNPLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBdUI7SUFDakYsQ0FBQztJQUVMLEtBQUssQ0FBQyxpQkFBaUIsQ0FDdEIsV0FBcUI7UUFFckIsTUFBTSxPQUFPLEdBQUcsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDaEYsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDeEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsc0JBQXNCLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNoRixDQUFDO0lBRU8sS0FBSyxDQUFDLG1CQUFtQixDQUFDLE9BQTBCO1FBQzNELE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1SCxDQUFDO0lBRU8scUJBQXFCLENBQUMsTUFBYztRQUMzQyxJQUFJLE1BQWlGLENBQUM7UUFDdEYsSUFBSSxDQUFDO1lBQ0osTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDN0IsQ0FBQztRQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDWixNQUFNLElBQUksd0JBQXdCLENBQUMsaUJBQWlCLE1BQU0sTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3RFLENBQUM7UUFFRCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2xCLE1BQU0sSUFBSSx3QkFBd0IsQ0FBQyw0QkFBNEIsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBRUQsSUFBSSxDQUFDLENBQUMsU0FBUyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLElBQUksTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUNsRCxNQUFNLElBQUksd0JBQXdCLENBQUMsc0NBQXNDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDcEYsQ0FBQztRQUVELE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEdBQUcsSUFBSSxFQUFFLEdBQUcsTUFBTSxDQUFDO1FBQ3pDLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUErQixFQUFFLENBQUM7SUFDbEUsQ0FBQztDQUNELENBQUE7QUFyQ1ksZ0JBQWdCO0lBRzFCLFdBQUEscUJBQXFCLENBQUE7R0FIWCxnQkFBZ0IsQ0FxQzVCOztBQUVELE1BQU0sd0JBQXlCLFNBQVEsS0FBSztJQUMzQyxZQUFZLE9BQWU7UUFDMUIsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2YsSUFBSSxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUM7SUFDdEIsQ0FBQztDQUNEIn0=