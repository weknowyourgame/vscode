/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import './bootstrap-server.js'; // this MUST come before other imports as it changes global state
import { join } from 'node:path';
import { devInjectNodeModuleLookupPath } from './bootstrap-node.js';
import { bootstrapESM } from './bootstrap-esm.js';
import { resolveNLSConfiguration } from './vs/base/node/nls.js';
import { product } from './bootstrap-meta.js';
// NLS
const nlsConfiguration = await resolveNLSConfiguration({ userLocale: 'en', osLocale: 'en', commit: product.commit, userDataPath: '', nlsMetadataPath: import.meta.dirname });
process.env['VSCODE_NLS_CONFIG'] = JSON.stringify(nlsConfiguration); // required for `bootstrap-esm` to pick up NLS messages
if (process.env['VSCODE_DEV']) {
    // When running out of sources, we need to load node modules from remote/node_modules,
    // which are compiled against nodejs, not electron
    process.env['VSCODE_DEV_INJECT_NODE_MODULE_LOOKUP_PATH'] = process.env['VSCODE_DEV_INJECT_NODE_MODULE_LOOKUP_PATH'] || join(import.meta.dirname, '..', 'remote', 'node_modules');
    devInjectNodeModuleLookupPath(process.env['VSCODE_DEV_INJECT_NODE_MODULE_LOOKUP_PATH']);
}
else {
    delete process.env['VSCODE_DEV_INJECT_NODE_MODULE_LOOKUP_PATH'];
}
// Bootstrap ESM
await bootstrapESM();
// Load Server
await import('./vs/server/node/server.cli.js');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLWNsaS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJzZXJ2ZXItY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sdUJBQXVCLENBQUMsQ0FBQyxpRUFBaUU7QUFDakcsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUNqQyxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNwRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDbEQsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDaEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBRTlDLE1BQU07QUFDTixNQUFNLGdCQUFnQixHQUFHLE1BQU0sdUJBQXVCLENBQUMsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNLEVBQUUsWUFBWSxFQUFFLEVBQUUsRUFBRSxlQUFlLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQzdLLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyx1REFBdUQ7QUFFNUgsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7SUFDL0Isc0ZBQXNGO0lBQ3RGLGtEQUFrRDtJQUNsRCxPQUFPLENBQUMsR0FBRyxDQUFDLDJDQUEyQyxDQUFDLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQywyQ0FBMkMsQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBQ2pMLDZCQUE2QixDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsMkNBQTJDLENBQUMsQ0FBQyxDQUFDO0FBQ3pGLENBQUM7S0FBTSxDQUFDO0lBQ1AsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLDJDQUEyQyxDQUFDLENBQUM7QUFDakUsQ0FBQztBQUVELGdCQUFnQjtBQUNoQixNQUFNLFlBQVksRUFBRSxDQUFDO0FBRXJCLGNBQWM7QUFDZCxNQUFNLE1BQU0sQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDIn0=