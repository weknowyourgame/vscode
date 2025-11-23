/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import './bootstrap-cli.js'; // this MUST come before other imports as it changes global state
import { configurePortable } from './bootstrap-node.js';
import { bootstrapESM } from './bootstrap-esm.js';
import { resolveNLSConfiguration } from './vs/base/node/nls.js';
import { product } from './bootstrap-meta.js';
// NLS
const nlsConfiguration = await resolveNLSConfiguration({ userLocale: 'en', osLocale: 'en', commit: product.commit, userDataPath: '', nlsMetadataPath: import.meta.dirname });
process.env['VSCODE_NLS_CONFIG'] = JSON.stringify(nlsConfiguration); // required for `bootstrap-esm` to pick up NLS messages
// Enable portable support
configurePortable(product);
// Signal processes that we got launched as CLI
process.env['VSCODE_CLI'] = '1';
// Bootstrap ESM
await bootstrapESM();
// Load Server
await import('./vs/code/node/cli.js');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbImNsaS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLG9CQUFvQixDQUFDLENBQUMsaUVBQWlFO0FBQzlGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUNsRCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUNoRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFFOUMsTUFBTTtBQUNOLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSx1QkFBdUIsQ0FBQyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sRUFBRSxZQUFZLEVBQUUsRUFBRSxFQUFFLGVBQWUsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDN0ssT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLHVEQUF1RDtBQUU1SCwwQkFBMEI7QUFDMUIsaUJBQWlCLENBQUMsT0FBTyxDQUFDLENBQUM7QUFFM0IsK0NBQStDO0FBQy9DLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBRWhDLGdCQUFnQjtBQUNoQixNQUFNLFlBQVksRUFBRSxDQUFDO0FBRXJCLGNBQWM7QUFDZCxNQUFNLE1BQU0sQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDIn0=