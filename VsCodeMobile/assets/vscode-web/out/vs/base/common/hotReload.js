/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
let _isHotReloadEnabled = false;
export function enableHotReload() {
    _isHotReloadEnabled = true;
}
export function isHotReloadEnabled() {
    return _isHotReloadEnabled;
}
export function registerHotReloadHandler(handler) {
    if (!isHotReloadEnabled()) {
        return { dispose() { } };
    }
    else {
        const handlers = registerGlobalHotReloadHandler();
        handlers.add(handler);
        return {
            dispose() { handlers.delete(handler); }
        };
    }
}
function registerGlobalHotReloadHandler() {
    if (!hotReloadHandlers) {
        hotReloadHandlers = new Set();
    }
    const g = globalThis;
    if (!g.$hotReload_applyNewExports) {
        g.$hotReload_applyNewExports = args => {
            const args2 = { config: { mode: undefined }, ...args };
            const results = [];
            for (const h of hotReloadHandlers) {
                const result = h(args2);
                if (result) {
                    results.push(result);
                }
            }
            if (results.length > 0) {
                return newExports => {
                    let result = false;
                    for (const r of results) {
                        if (r(newExports)) {
                            result = true;
                        }
                    }
                    return result;
                };
            }
            return undefined;
        };
    }
    return hotReloadHandlers;
}
let hotReloadHandlers = undefined;
if (isHotReloadEnabled()) {
    // This code does not run in production.
    registerHotReloadHandler(({ oldExports, newSrc, config }) => {
        if (config.mode !== 'patch-prototype') {
            return undefined;
        }
        return newExports => {
            for (const key in newExports) {
                const exportedItem = newExports[key];
                console.log(`[hot-reload] Patching prototype methods of '${key}'`, { exportedItem });
                if (typeof exportedItem === 'function' && exportedItem.prototype) {
                    const oldExportedItem = oldExports[key];
                    if (oldExportedItem) {
                        for (const prop of Object.getOwnPropertyNames(exportedItem.prototype)) {
                            const descriptor = Object.getOwnPropertyDescriptor(exportedItem.prototype, prop);
                            // eslint-disable-next-line local/code-no-any-casts
                            const oldDescriptor = Object.getOwnPropertyDescriptor(oldExportedItem.prototype, prop);
                            if (descriptor?.value?.toString() !== oldDescriptor?.value?.toString()) {
                                console.log(`[hot-reload] Patching prototype method '${key}.${prop}'`);
                            }
                            // eslint-disable-next-line local/code-no-any-casts
                            Object.defineProperty(oldExportedItem.prototype, prop, descriptor);
                        }
                        newExports[key] = oldExportedItem;
                    }
                }
            }
            return true;
        };
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG90UmVsb2FkLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvY29tbW9uL2hvdFJlbG9hZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUloRyxJQUFJLG1CQUFtQixHQUFHLEtBQUssQ0FBQztBQUVoQyxNQUFNLFVBQVUsZUFBZTtJQUM5QixtQkFBbUIsR0FBRyxJQUFJLENBQUM7QUFDNUIsQ0FBQztBQUVELE1BQU0sVUFBVSxrQkFBa0I7SUFDakMsT0FBTyxtQkFBbUIsQ0FBQztBQUM1QixDQUFDO0FBQ0QsTUFBTSxVQUFVLHdCQUF3QixDQUFDLE9BQXlCO0lBQ2pFLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUM7UUFDM0IsT0FBTyxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUUsQ0FBQztJQUMxQixDQUFDO1NBQU0sQ0FBQztRQUNQLE1BQU0sUUFBUSxHQUFHLDhCQUE4QixFQUFFLENBQUM7UUFDbEQsUUFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN0QixPQUFPO1lBQ04sT0FBTyxLQUFLLFFBQVEsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ3ZDLENBQUM7SUFDSCxDQUFDO0FBQ0YsQ0FBQztBQVlELFNBQVMsOEJBQThCO0lBQ3RDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQ3hCLGlCQUFpQixHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7SUFDL0IsQ0FBQztJQUVELE1BQU0sQ0FBQyxHQUFHLFVBQTJDLENBQUM7SUFDdEQsSUFBSSxDQUFDLENBQUMsQ0FBQywwQkFBMEIsRUFBRSxDQUFDO1FBQ25DLENBQUMsQ0FBQywwQkFBMEIsR0FBRyxJQUFJLENBQUMsRUFBRTtZQUNyQyxNQUFNLEtBQUssR0FBRyxFQUFFLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUs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