/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { mcpDiscoveryRegistry } from '../common/discovery/mcpDiscovery.js';
import { IMcpDevModeDebugging } from '../common/mcpDevMode.js';
import { McpDevModeDebuggingNode } from './mcpDevModeDebuggingNode.js';
import { NativeMcpDiscovery } from './nativeMpcDiscovery.js';
mcpDiscoveryRegistry.register(new SyncDescriptor(NativeMcpDiscovery));
registerSingleton(IMcpDevModeDebugging, McpDevModeDebuggingNode, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLmNvbnRyaWJ1dGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9tY3AvZWxlY3Ryb24tYnJvd3Nlci9tY3AuY29udHJpYnV0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUMxRixPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDM0UsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDL0QsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDdkUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFFN0Qsb0JBQW9CLENBQUMsUUFBUSxDQUFDLElBQUksY0FBYyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztBQUN0RSxpQkFBaUIsQ0FBQyxvQkFBb0IsRUFBRSx1QkFBdUIsb0NBQTRCLENBQUMifQ==