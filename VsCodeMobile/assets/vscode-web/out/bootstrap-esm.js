/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as fs from 'node:fs';
import { register } from 'node:module';
import { product, pkg } from './bootstrap-meta.js';
import './bootstrap-node.js';
import * as performance from './vs/base/common/performance.js';
// Install a hook to module resolution to map 'fs' to 'original-fs'
if (process.env['ELECTRON_RUN_AS_NODE'] || process.versions['electron']) {
    const jsCode = `
	export async function resolve(specifier, context, nextResolve) {
		if (specifier === 'fs') {
			return {
				format: 'builtin',
				shortCircuit: true,
				url: 'node:original-fs'
			};
		}

		// Defer to the next hook in the chain, which would be the
		// Node.js default resolve if this is the last user-specified loader.
		return nextResolve(specifier, context);
	}`;
    register(`data:text/javascript;base64,${Buffer.from(jsCode).toString('base64')}`, import.meta.url);
}
// Prepare globals that are needed for running
globalThis._VSCODE_PRODUCT_JSON = { ...product };
globalThis._VSCODE_PACKAGE_JSON = { ...pkg };
globalThis._VSCODE_FILE_ROOT = import.meta.dirname;
//#region NLS helpers
let setupNLSResult = undefined;
function setupNLS() {
    if (!setupNLSResult) {
        setupNLSResult = doSetupNLS();
    }
    return setupNLSResult;
}
async function doSetupNLS() {
    performance.mark('code/willLoadNls');
    let nlsConfig = undefined;
    let messagesFile;
    if (process.env['VSCODE_NLS_CONFIG']) {
        try {
            nlsConfig = JSON.parse(process.env['VSCODE_NLS_CONFIG']);
            if (nlsConfig?.languagePack?.messagesFile) {
                messagesFile = nlsConfig.languagePack.messagesFile;
            }
            else if (nlsConfig?.defaultMessagesFile) {
                messagesFile = nlsConfig.defaultMessagesFile;
            }
            globalThis._VSCODE_NLS_LANGUAGE = nlsConfig?.resolvedLanguage;
        }
        catch (e) {
            console.error(`Error reading VSCODE_NLS_CONFIG from environment: ${e}`);
        }
    }
    if (process.env['VSCODE_DEV'] || // no NLS support in dev mode
        !messagesFile // no NLS messages file
    ) {
        return undefined;
    }
    try {
        globalThis._VSCODE_NLS_MESSAGES = JSON.parse((await fs.promises.readFile(messagesFile)).toString());
    }
    catch (error) {
        console.error(`Error reading NLS messages file ${messagesFile}: ${error}`);
        // Mark as corrupt: this will re-create the language pack cache next startup
        if (nlsConfig?.languagePack?.corruptMarkerFile) {
            try {
                await fs.promises.writeFile(nlsConfig.languagePack.corruptMarkerFile, 'corrupted');
            }
            catch (error) {
                console.error(`Error writing corrupted NLS marker file: ${error}`);
            }
        }
        // Fallback to the default message file to ensure english translation at least
        if (nlsConfig?.defaultMessagesFile && nlsConfig.defaultMessagesFile !== messagesFile) {
            try {
                globalThis._VSCODE_NLS_MESSAGES = JSON.parse((await fs.promises.readFile(nlsConfig.defaultMessagesFile)).toString());
            }
            catch (error) {
                console.error(`Error reading default NLS messages file ${nlsConfig.defaultMessagesFile}: ${error}`);
            }
        }
    }
    performance.mark('code/didLoadNls');
    return nlsConfig;
}
//#endregion
export async function bootstrapESM() {
    // NLS
    await setupNLS();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9vdHN0cmFwLWVzbS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJib290c3RyYXAtZXNtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxFQUFFLE1BQU0sU0FBUyxDQUFDO0FBQzlCLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDdkMsT0FBTyxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUNuRCxPQUFPLHFCQUFxQixDQUFDO0FBQzdCLE9BQU8sS0FBSyxXQUFXLE1BQU0saUNBQWlDLENBQUM7QUFHL0QsbUVBQW1FO0FBQ25FLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztJQUN6RSxNQUFNLE1BQU0sR0FBRzs7Ozs7Ozs7Ozs7OztHQWFiLENBQUM7SUFDSCxRQUFRLENBQUMsK0JBQStCLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNwRyxDQUFDO0FBRUQsOENBQThDO0FBQzlDLFVBQVUsQ0FBQyxvQkFBb0IsR0FBRyxFQUFFLEdBQUcsT0FBTyxFQUFFLENBQUM7QUFDakQsVUFBVSxDQUFDLG9CQUFvQixHQUFHLEVBQUUsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUM3QyxVQUFVLENBQUMsaUJBQWlCLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7QUFFbkQscUJBQXFCO0FBRXJCLElBQUksY0FBYyxHQUF1RCxTQUFTLENBQUM7QUFFbkYsU0FBUyxRQUFRO0lBQ2hCLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUNyQixjQUFj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