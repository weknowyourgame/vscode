/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let productObj = { BUILD_INSERT_PRODUCT_CONFIGURATION: 'BUILD_INSERT_PRODUCT_CONFIGURATION' }; // DO NOT MODIFY, PATCHED DURING BUILD
if (productObj['BUILD_INSERT_PRODUCT_CONFIGURATION']) {
    productObj = require('../product.json'); // Running out of sources
}
let pkgObj = { BUILD_INSERT_PACKAGE_CONFIGURATION: 'BUILD_INSERT_PACKAGE_CONFIGURATION' }; // DO NOT MODIFY, PATCHED DURING BUILD
if (pkgObj['BUILD_INSERT_PACKAGE_CONFIGURATION']) {
    pkgObj = require('../package.json'); // Running out of sources
}
let productOverridesObj = {};
if (process.env['VSCODE_DEV']) {
    try {
        productOverridesObj = require('../product.overrides.json');
        productObj = Object.assign(productObj, productOverridesObj);
    }
    catch (error) { /* ignore */ }
}
export const product = productObj;
export const pkg = pkgObj;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9vdHN0cmFwLW1ldGEuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsiYm9vdHN0cmFwLW1ldGEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUc1QyxNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUUvQyxJQUFJLFVBQVUsR0FBcUYsRUFBRSxrQ0FBa0MsRUFBRSxvQ0FBb0MsRUFBRSxDQUFDLENBQUMsc0NBQXNDO0FBQ3ZOLElBQUksVUFBVSxDQUFDLG9DQUFvQyxDQUFDLEVBQUUsQ0FBQztJQUN0RCxVQUFVLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyx5QkFBeUI7QUFDbkUsQ0FBQztBQUVELElBQUksTUFBTSxHQUFHLEVBQUUsa0NBQWtDLEVBQUUsb0NBQW9DLEVBQUUsQ0FBQyxDQUFDLHNDQUFzQztBQUNqSSxJQUFJLE1BQU0sQ0FBQyxvQ0FBb0MsQ0FBQyxFQUFFLENBQUM7SUFDbEQsTUFBTSxHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMseUJBQXlCO0FBQy9ELENBQUM7QUFFRCxJQUFJLG1CQUFtQixHQUFHLEVBQUUsQ0FBQztBQUM3QixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztJQUMvQixJQUFJLENBQUM7UUFDSixtQkFBbUIsR0FBRyxPQUFPLENBQUMsMkJBQTJCLENBQUMsQ0FBQztRQUMzRCxVQUFVLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztJQUM3RCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ2pDLENBQUM7QUFFRCxNQUFNLENBQUMsTUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDO0FBQ2xDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMifQ==